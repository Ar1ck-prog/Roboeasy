import { HubClient, HubConnectionError, HubError, type HubTransport, openTransport, reserveControllerHub } from './ble'
import { PORTS, STOPPED, type Port, type Speeds } from './controller-input'
import { CONTROLLER_COMMAND, CONTROLLER_PROGRAM, WATCHDOG_MS } from './controller-program'

const CHANGE_INTERVAL_MS = 20
const ACTIVE_HEARTBEAT_MS = 75
const IDLE_INTERVAL_MS = 500
const INITIAL_PROBES = 8
const PROBE_ACK_MS = 650
const encode = new TextEncoder()
const decode = new TextDecoder()
const hexByte = (value: number) => value.toString(16).padStart(2, '0')

type Listener = {
  onDevices: (ports: Port[]) => void
  onLost: () => void
}

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
  private reply: ((error?: Error, payload?: Uint8Array) => void) | undefined
  private stopWaiters: ((sent: boolean) => void)[] = []

  constructor(private transport: HubTransport, private slot: number, private listener: Listener, private release: () => void) {
    const client = this.client = new HubClient(transport, 4000)
    transport.onClose = () => this.close(this.ready && !this.closing)
    client.onDevices = (updates) => {
      listener.onDevices(PORTS.filter((port) => updates.some((device) => device.kind === 'motor' && device.port === port)))
    }
    client.onTunnel = (payload) => this.reply?.(undefined, payload)
  }

  async initialize() {
    const info = await this.atStage('info', () => this.client.readInfo())
    // Product Group Device 0x0000 = SPIKE Prime, per LEGO's specification.
    if (info.product !== 0) throw new HubError('unsupported')
    // Motor detection is optional. A missing telemetry reply must not prevent driving.
    await this.client.subscribeDevices().catch(() => {})
    await this.atStage('upload', () => this.client.upload(CONTROLLER_PROGRAM, this.slot))
    await this.atStage('start', async () => {
      if (!(await this.client.start(this.slot))) throw new HubError('start refused')
    })
    await this.atStage('control', async () => {
      // Start can be acknowledged before Python enters its loop. A neutral frame
      // can be retried safely and proves both directions of the tunnel work.
      for (let i = 0; i < INITIAL_PROBES; i++) {
        try {
          await this.write(STOPPED, PROBE_ACK_MS)
          return
        } catch (error) {
          if (this.closed || !(error instanceof HubError) || error.message !== 'controller timeout' || i === INITIAL_PROBES - 1) throw error
        }
      }
    })
    this.client.onFlow = (stopped) => {
      if (stopped && !this.closing) this.close(this.ready)
    }
    this.ready = true
    this.schedule()
    return info.firmware
  }

  private async atStage<T>(stage: 'info' | 'upload' | 'start' | 'control', action: () => Promise<T>): Promise<T> {
    try {
      return await action()
    } catch (error) {
      throw new HubConnectionError(stage, error)
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
      this.reply = (error, payload) => {
        if (error) reject(error)
        if (payload && decode.decode(payload) === expected) resolve()
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
    const prefix = CONTROLLER_COMMAND + hexByte(sequence)
    const payload = encode.encode(prefix + speeds.map((speed) => hexByte(speed + 100)).join(''))
    await this.exchange(prefix, timeout, () => this.client.sendTunnel(payload))
    this.sent = speeds
  }

  update(speeds: Speeds) {
    if (!this.ready || this.closing || this.closed) return
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
    } catch {
      stopping.forEach((resolve) => resolve(false))
      this.close(!this.closing)
    } finally {
      this.writing = false
      this.schedule()
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

  close(lost = false) {
    if (this.closed) return
    this.closed = true
    clearTimeout(this.timer)
    this.reply?.(new HubError('disconnected'))
    this.stopWaiters.splice(0).forEach((resolve) => resolve(false))
    this.client.abort()
    this.transport.close()
    this.release()
    if (lost) this.listener.onLost()
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
