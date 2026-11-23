import { HubClient, HubConnectionError, HubError, type HubTransport, openTransport, reserveControllerHub } from './ble'
import { PORTS, STOPPED, type Port, type Speeds } from './controller-input'
import { CONSOLE_COMMAND, CONTROLLER_COMMAND, CONTROLLER_CONSOLE_PREFIX, CONTROLLER_PROGRAM, WATCHDOG_MS } from './controller-program'

const CHANGE_INTERVAL_MS = 20
const ACTIVE_HEARTBEAT_MS = 75
const IDLE_INTERVAL_MS = 500
const PROBES_PER_CHANNEL = 4
const PROBE_ACK_MS = 650
const encode = new TextEncoder()
const decode = new TextDecoder()
const hexByte = (value: number) => value.toString(16).padStart(2, '0')

type Listener = {
  onDevices: (ports: Port[]) => void
  onLost: (diagnostic?: string) => void
  onPaused?: (problem: 'motorError' | 'commandDelay', diagnostic: string) => void
  onResumed?: () => void
}

class MotorCommandError extends HubError {}

export class ControllerLink {
  private client: HubClient
  private desired = STOPPED
  private sent: Speeds | undefined
  private lastWrite = -Infinity
  private timer: ReturnType<typeof setTimeout> | undefined
  private sequence = 0
  private writing = false
  private closed = false
  private closing = false
  private ready = false
  private recovering = false
  private reply: ((error?: Error, message?: string) => void) | undefined
  private commandMode = CONTROLLER_COMMAND
  private consoleLine = ''
  private startupLog = ''
  private stopWaiters: ((sent: boolean) => void)[] = []

  constructor(private transport: HubTransport, private slot: number, private listener: Listener, private release: () => void) {
    const client = this.client = new HubClient(transport, 4000)
    transport.onClose = () => this.close(this.ready && !this.closing)
    client.onDevices = (updates) => {
      listener.onDevices(PORTS.filter((port) => updates.some((device) => device.kind === 'motor' && device.port === port)))
    }
    client.onTunnel = (payload) => this.reply?.(undefined, decode.decode(payload))
  }

  private receiveConsole(text: string) {
    if (!this.ready) this.startupLog = (this.startupLog + text).slice(-400)
    const lines = (this.consoleLine + text).split('\n')
    this.consoleLine = (lines.pop() ?? '').slice(-256)
    // HubOS may deliver the print's newline in its own notification.
    const partial = this.consoleLine.trim().match(/RBE:(K[\da-f]{2})$/)?.[1]
    const fault = this.consoleLine.match(/RBE:ERR ([MK][\da-f]{2}) ([A-F]) ([^|\n]*)\|$/)
    if (partial || fault) this.consoleLine = ''
    for (const line of lines) {
      const candidate = line.trim().match(/RBE:(K[\da-f]{2})$/)?.[1]
      if (candidate) this.reply?.(undefined, candidate)
      const error = line.match(/RBE:ERR ([MK][\da-f]{2}) ([A-F]) ([^|\n]*)\|$/)
      if (error) this.reply?.(new MotorCommandError(`${error[2]}: ${error[3]}`), error[1])
    }
    if (partial) this.reply?.(undefined, partial)
    if (fault) this.reply?.(new MotorCommandError(`${fault[2]}: ${fault[3]}`), fault[1])
  }

  async initialize() {
    const info = await this.atStage('info', () => this.client.readInfo())
    // Product Group Device 0x0000 = SPIKE Prime, per LEGO's specification.
    if (info.product !== 0) throw new HubError('unsupported')
    // Motor detection is optional. A missing telemetry reply must not prevent driving.
    await this.client.subscribeDevices().catch(() => {})
    await this.atStage('upload', () => this.client.upload(CONTROLLER_PROGRAM, this.slot))
    this.client.onConsole = (text) => this.receiveConsole(text)
    await this.atStage('start', async () => {
      if (!(await this.client.start(this.slot))) throw new HubError('start refused')
    })
    await this.atStage('control', async () => {
      // Start can be acknowledged before Python enters its loop. A neutral frame
      // can be retried safely and proves both directions of the tunnel work.
      for (let i = 0; i < PROBES_PER_CHANNEL * 2; i++) {
        if (i === PROBES_PER_CHANNEL) this.commandMode = CONSOLE_COMMAND
        try {
          await this.write(STOPPED, PROBE_ACK_MS)
          return
        } catch (error) {
          if (this.closed || !(error instanceof HubError) || error.message !== 'controller timeout' || i === PROBES_PER_CHANNEL * 2 - 1) throw error
        }
      }
    })
    this.client.onFlow = (stopped) => {
      if (stopped && !this.closing) this.close(this.ready, 'BT-RUNTIME')
    }
    this.ready = true
    this.schedule()
    return info.firmware
  }

  private async atStage<T>(stage: 'info' | 'upload' | 'start' | 'control', action: () => Promise<T>): Promise<T> {
    try {
      return await action()
    } catch (error) {
      const diagnostic = stage === 'start' || stage === 'control'
        ? this.startupLog.replaceAll(CONTROLLER_CONSOLE_PREFIX, '').trim()
        : ''
      throw new HubConnectionError(stage, error, diagnostic)
    }
  }

  private async exchange(expected: string, timeout: number, send: () => Promise<unknown>) {
    if (this.closed) throw new HubError('disconnected')
    let timer: ReturnType<typeof setTimeout> | undefined
    let written = false
    const expired = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new HubError(written ? 'controller timeout' : 'write timeout')), timeout)
    })
    const received = new Promise<void>((resolve, reject) => {
      this.reply = (error, message) => {
        if (error) {
          if (!(error instanceof MotorCommandError) || message === expected) reject(error)
        } else if (message === expected) resolve()
      }
    })
    try {
      await Promise.race([expired, Promise.all([received, send().then(() => { written = true })])])
    } finally {
      clearTimeout(timer)
      this.reply = undefined
    }
  }

  private async write(speeds: Speeds, timeout = WATCHDOG_MS) {
    const sequence = this.sequence = (this.sequence + 1) % 256
    this.lastWrite = performance.now()
    // ASCII keeps the hub callback usable with either byte or text payloads.
    const prefix = this.commandMode + hexByte(sequence)
    const payload = encode.encode(prefix + speeds.map((speed) => hexByte(speed + 100)).join(''))
    await this.exchange(prefix, timeout, () => this.client.sendTunnel(payload))
    this.sent = speeds
  }

  update(speeds: Speeds) {
    if (!this.ready || this.closing || this.closed || this.recovering) return
    this.desired = speeds
    this.schedule()
  }

  stop(): Promise<boolean> {
    if (this.closed || !this.ready) return Promise.resolve(false)
    this.desired = STOPPED
    const stopped = new Promise<boolean>((resolve) => this.stopWaiters.push(resolve))
    this.schedule()
    return stopped
  }

  private schedule() {
    clearTimeout(this.timer)
    if (this.closed || this.writing || !this.ready) return
    // The full neutral state always precedes the latest input after a reset.
    if (this.stopWaiters.length) {
      void this.flush()
      return
    }
    if (this.closing) return
    const unchanged = this.desired.every((speed, i) => speed === this.sent?.[i])
    const moving = this.desired.some(Boolean)
    // Send changed input ahead of the next heartbeat. A full release brakes immediately.
    const interval = unchanged
      ? (moving ? ACTIVE_HEARTBEAT_MS : IDLE_INTERVAL_MS)
      : (moving ? CHANGE_INTERVAL_MS : 0)
    const delay = this.lastWrite + interval - performance.now()
    if (delay <= 0) void this.flush()
    else this.timer = setTimeout(() => void this.flush(), delay)
  }

  private async flush() {
    this.writing = true
    const stopping = this.stopWaiters.splice(0)
    try {
      await this.write(stopping.length ? STOPPED : this.desired)
      stopping.forEach((resolve) => resolve(true))
    } catch (error) {
      stopping.forEach((resolve) => resolve(false))
      if (!this.closed && !this.closing && (error instanceof MotorCommandError || (error instanceof HubError && error.message === 'controller timeout'))) {
        await this.recover(error)
      } else {
        this.close(!this.closing, 'BT-WRITE')
      }
    } finally {
      this.writing = false
      this.schedule()
    }
  }

  private async recover(error: HubError) {
    this.recovering = true
    this.desired = STOPPED
    const motorError = error instanceof MotorCommandError
    this.listener.onPaused?.(motorError ? 'motorError' : 'commandDelay', motorError ? error.message : '')
    try {
      // Never resend an unconfirmed movement command. Verify braking on the
      // existing connection and require a fresh input before moving again.
      await this.write(STOPPED, PROBE_ACK_MS)
      if (!this.closed && !this.closing) this.listener.onResumed?.()
    } catch {
      this.close(!this.closing, 'BT-ACK')
    } finally {
      this.recovering = false
    }
  }

  async disconnect() {
    if (this.closed || this.closing) return
    this.closing = true
    if (await this.stop()) {
      // The neutral frame was applied before stopping the program and dropping GATT.
      await this.client.stop(this.slot).catch(() => {})
    }
    this.close()
  }

  close(lost = false, diagnostic?: string) {
    if (this.closed) return
    this.closed = true
    clearTimeout(this.timer)
    this.reply?.(new HubError('disconnected'))
    this.stopWaiters.splice(0).forEach((resolve) => resolve(false))
    this.client.abort()
    this.transport.close()
    this.release()
    if (lost) this.listener.onLost(diagnostic)
  }
}

export async function connectController(slot: number, listener: Listener, signal: AbortSignal) {
  const release = reserveControllerHub()
  let link: ControllerLink | undefined
  const abort = () => link?.close()
  try {
    // openTransport calls requestDevice before its first await, in the button's click.
    const { transport, name } = await openTransport(signal)
    link = new ControllerLink(transport, slot, listener, release)
    signal.addEventListener('abort', abort, { once: true })
    signal.throwIfAborted()
    const firmware = await link.initialize()
    return { link, name, firmware }
  } catch (error) {
    if (link) link.close()
    else release()
    throw error
  } finally {
    signal.removeEventListener('abort', abort)
  }
}
