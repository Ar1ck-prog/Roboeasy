'use client'

/**
 * Talking to a SPIKE Prime hub from the page over Web Bluetooth: connect,
 * upload a Python program to a slot, start and stop it, read the console and
 * the sensors. One connection for the whole site, kept in this module so it
 * survives moving between pages.
 */

import { useSyncExternalStore } from 'react'

import {
  BLE_RX,
  BLE_SERVICE,
  BLE_TX,
  type DeviceUpdate,
  FrameReader,
  type HubInfo,
  MSG,
  PROGRAM_FILE,
  chunkRequest,
  clearSlotRequest,
  deviceSubscribeRequest,
  hubCrc,
  infoRequest,
  packFrame,
  parseMessage,
  programFlowRequest,
  startUploadRequest,
} from './ble-protocol'

import { type TelemetrySample, isTelemetryLine, parseTelemetryLine } from './telemetry'

const REQUEST_TIMEOUT_MS = 10_000
const DEVICE_INTERVAL_MS = 500
/** Web Bluetooth does not write more than this in one operation. */
const MAX_WRITE = 512
const MAX_CONSOLE_LINES = 200
/** About ten minutes of readings. */
const MAX_TELEMETRY = 4000
const SLOT_KEY = 'roboeasy.hub.slot'

/** The link to the hub; tests pass a simulated one. */
export interface HubTransport {
  write(data: Uint8Array): Promise<void>
  close(): void
  /** Set by the client. */
  onData: (data: Uint8Array) => void
  onClose: () => void
}

export class HubError extends Error {}

/** Requests, one at a time, matched to their replies. */
export class HubClient {
  info: HubInfo | null = null
  onFlow: (stopped: boolean) => void = () => {}
  onConsole: (text: string) => void = () => {}
  onDevices: (updates: DeviceUpdate[]) => void = () => {}

  private reader = new FrameReader()
  private pending: { id: number; resolve: (ok: boolean) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null
  private queue: Promise<unknown> = Promise.resolve()

  constructor(
    private transport: HubTransport,
    private timeoutMs = REQUEST_TIMEOUT_MS,
  ) {
    transport.onData = (data) => this.receive(data)
  }

  private receive(data: Uint8Array) {
    for (const bytes of this.reader.push(data)) {
      let m
      try {
        m = parseMessage(bytes)
      } catch {
        continue
      }
      if (!m) continue
      if (m.type === 'info') {
        this.info = m.info
        this.settle(MSG.infoResponse, true)
      } else if (m.type === 'status') this.settle(m.id, m.ok)
      else if (m.type === 'flow') this.onFlow(m.stopped)
      else if (m.type === 'console') this.onConsole(m.text)
      else this.onDevices(m.updates)
    }
  }

  private settle(id: number, ok: boolean) {
    const p = this.pending
    if (!p || p.id !== id) return
    clearTimeout(p.timer)
    this.pending = null
    p.resolve(ok)
  }

  /** Fails the request in progress (the connection is gone). */
  abort() {
    const p = this.pending
    if (!p) return
    clearTimeout(p.timer)
    this.pending = null
    p.reject(new HubError('disconnected'))
  }

  private async send(message: Uint8Array) {
    const frame = packFrame(message)
    const size = this.info ? Math.max(1, Math.min(this.info.maxPacket, MAX_WRITE)) : frame.length
    for (let i = 0; i < frame.length; i += size) await this.transport.write(frame.subarray(i, i + size))
  }

  /** Sends a message and waits for the reply of type `responseId`; true when the hub accepted it. */
  private request(message: Uint8Array, responseId: number): Promise<boolean> {
    const run = () =>
      new Promise<boolean>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending = null
          reject(new HubError('timeout'))
        }, this.timeoutMs)
        this.pending = { id: responseId, resolve, reject, timer }
        this.send(message).catch((e) => {
          clearTimeout(timer)
          this.pending = null
          reject(e)
        })
      })
    const result = this.queue.then(run, run)
    this.queue = result.catch(() => {})
    return result
  }

  /** The first exchange: limits of this hub, then sensor updates. */
  async handshake(): Promise<HubInfo> {
    await this.request(infoRequest(), MSG.infoResponse)
    if (!this.info) throw new HubError('no info')
    await this.request(deviceSubscribeRequest(DEVICE_INTERVAL_MS), MSG.deviceSubscribeResponse)
    return this.info
  }

  async upload(code: string, slot: number, onProgress: (share: number) => void = () => {}) {
    const bytes = new TextEncoder().encode(code)
    if (!bytes.length) throw new HubError('empty program')
    const max = this.info?.maxChunk
    if (!max) throw new HubError('no info')
    // An empty slot answers "not cleared", which is fine.
    await this.request(clearSlotRequest(slot), MSG.clearSlotResponse)
    if (!(await this.request(startUploadRequest(PROGRAM_FILE, slot, hubCrc(bytes)), MSG.startUploadResponse))) throw new HubError('upload refused')
    let crc = 0
    for (let i = 0; i < bytes.length; i += max) {
      const chunk = bytes.subarray(i, i + max)
      crc = hubCrc(chunk, crc)
      if (!(await this.request(chunkRequest(crc, chunk), MSG.chunkResponse))) throw new HubError('chunk refused')
      onProgress(Math.min(1, (i + chunk.length) / bytes.length))
    }
  }

  start(slot: number) {
    return this.request(programFlowRequest(false, slot), MSG.flowResponse)
  }

  stop(slot: number) {
    return this.request(programFlowRequest(true, slot), MSG.flowResponse)
  }
}

// ── Web Bluetooth ────────────────────────────────────────────────────────

interface BtCharacteristic extends EventTarget {
  value?: DataView
  startNotifications(): Promise<unknown>
  writeValueWithoutResponse(data: BufferSource): Promise<void>
}
interface BtDevice extends EventTarget {
  name?: string
  gatt?: {
    connected: boolean
    connect(): Promise<{ getPrimaryService(uuid: string): Promise<{ getCharacteristic(uuid: string): Promise<BtCharacteristic> }> }>
    disconnect(): void
  }
}
interface Bt {
  requestDevice(options: { filters: { services: string[] }[]; optionalServices?: string[] }): Promise<BtDevice>
}
const bluetooth = () => (typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { bluetooth?: Bt }).bluetooth)

export function bluetoothAvailable(): boolean {
  return !!bluetooth() && typeof window !== 'undefined' && window.isSecureContext
}

async function openTransport(): Promise<{ transport: HubTransport; name: string }> {
  const device = await bluetooth()!.requestDevice({ filters: [{ services: [BLE_SERVICE] }], optionalServices: [BLE_SERVICE] })
  const server = await device.gatt!.connect()
  const service = await server.getPrimaryService(BLE_SERVICE)
  const rx = await service.getCharacteristic(BLE_RX)
  const tx = await service.getCharacteristic(BLE_TX)
  const transport: HubTransport = {
    write: (data) => rx.writeValueWithoutResponse(data as BufferSource),
    close: () => device.gatt?.disconnect(),
    onData: () => {},
    onClose: () => {},
  }
  tx.addEventListener('characteristicvaluechanged', () => {
    const v = tx.value
    if (v) transport.onData(new Uint8Array(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength)))
  })
  device.addEventListener('gattserverdisconnected', () => transport.onClose())
  await tx.startNotifications()
  return { transport, name: device.name || 'SPIKE Prime' }
}

// ── The shared connection ────────────────────────────────────────────────

export type HubStatus = 'idle' | 'connecting' | 'ready' | 'uploading' | 'running'
export type HubProblem = 'connect' | 'upload' | 'start' | 'lost'

export interface HubState {
  status: HubStatus
  name: string
  firmware: string
  battery: number | null
  /** Latest reading per sensor or motor, e.g. "motor:A". */
  devices: Record<string, DeviceUpdate>
  console: string[]
  /** Readings of the current run, when it was sent with telemetry. */
  telemetry: TelemetrySample[]
  progress: number
  slot: number
  problem: HubProblem | null
}

const INITIAL: HubState = { status: 'idle', name: '', firmware: '', battery: null, devices: {}, console: [], telemetry: [], progress: 0, slot: 0, problem: null }

let state = INITIAL
let client: HubClient | null = null
let closing: (() => void) | null = null
let partialLine = ''
const listeners = new Set<() => void>()

function set(patch: Partial<HubState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

function readSlot() {
  try {
    const n = Number(localStorage.getItem(SLOT_KEY))
    return Number.isInteger(n) && n >= 0 && n < 20 ? n : 0
  } catch {
    return 0
  }
}

let slotLoaded = false
function subscribe(listener: () => void) {
  if (!slotLoaded) {
    slotLoaded = true
    state = { ...state, slot: readSlot() }
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useHub(): HubState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => INITIAL,
  )
}

/** False on the server and while hydrating, so the first render matches. */
export function useBluetoothAvailable(): boolean {
  return useSyncExternalStore(
    () => () => {},
    bluetoothAvailable,
    () => false,
  )
}

export function setHubSlot(slot: number) {
  set({ slot })
  try {
    localStorage.setItem(SLOT_KEY, String(slot))
  } catch {}
}

function addConsole(text: string) {
  const parts = (partialLine + text).replace(/\r/g, '').split('\n')
  partialLine = parts.pop() ?? ''
  // Telemetry travels over the console, but it is data for the charts and not a message to read.
  const shown = parts.filter((line) => !isTelemetryLine(line))
  const samples = parts.flatMap((line) => parseTelemetryLine(line) ?? [])
  if (shown.length) set({ console: [...state.console, ...shown].slice(-MAX_CONSOLE_LINES) })
  if (samples.length) set({ telemetry: [...state.telemetry, ...samples].slice(-MAX_TELEMETRY) })
}

function applyDevices(updates: DeviceUpdate[]) {
  const devices = { ...state.devices }
  let battery = state.battery
  for (const u of updates) {
    if (u.kind === 'battery') battery = u.percent
    else devices[`${u.kind}:${u.port}`] = u
  }
  set({ battery, devices })
}

/** Connects (asks the browser for the hub). Must run from a click. True when connected. */
export async function connectHub(): Promise<boolean> {
  if (client) return true
  if (!bluetoothAvailable() || state.status === 'connecting') return false
  set({ status: 'connecting', problem: null })
  let transport: HubTransport
  let name: string
  try {
    ;({ transport, name } = await openTransport())
  } catch (e) {
    // Closing the browser's picker is not a problem to report.
    set({ status: 'idle', problem: (e as Error).name === 'NotFoundError' ? null : 'connect' })
    return false
  }
  const c = new HubClient(transport)
  c.onConsole = addConsole
  c.onDevices = applyDevices
  c.onFlow = (stopped) => {
    if (state.status !== 'uploading') set({ status: stopped ? 'ready' : 'running' })
  }
  let closedBy: { problem: HubProblem | null } | null = null
  closing = () => {
    closedBy ??= { problem: null }
    transport.close()
  }
  transport.onClose = () => {
    c.abort()
    client = null
    closing = null
    set({ ...INITIAL, slot: state.slot, console: state.console, problem: closedBy ? closedBy.problem : 'lost' })
  }
  try {
    const info = await c.handshake()
    client = c
    set({ status: 'ready', name, firmware: info.firmware })
    return true
  } catch {
    closedBy = { problem: 'connect' }
    closing?.()
    set({ status: 'idle', problem: 'connect' })
    return false
  }
}

export function disconnectHub() {
  closing?.()
}

/** Uploads the program to the chosen slot and starts it, connecting first if needed. */
export async function runOnHub(code: string) {
  if (!(await connectHub()) || !client) return
  const c = client
  const slot = state.slot
  partialLine = ''
  const wasRunning = state.status === 'running'
  set({ status: 'uploading', progress: 0, problem: null, console: [], telemetry: [] })
  try {
    if (wasRunning) await c.stop(slot).catch(() => false)
    await c.upload(code, slot, (progress) => set({ progress }))
  } catch {
    if (client) set({ status: 'ready', problem: 'upload' })
    return
  }
  // "running" comes first: a short program can report its end before this reply.
  set({ status: 'running' })
  try {
    if (!(await c.start(slot))) set({ status: 'ready', problem: 'start' })
  } catch {
    if (client) set({ status: 'ready', problem: 'start' })
  }
}

export async function stopHub() {
  if (!client) return
  await client.stop(state.slot).catch(() => false)
  if (client && state.status === 'running') set({ status: 'ready' })
}
