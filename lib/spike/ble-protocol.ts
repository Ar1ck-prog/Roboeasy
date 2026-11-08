/**
 * The Bluetooth protocol of SPIKE Prime hubs with the SPIKE App 3 firmware,
 * as published by LEGO (https://lego.github.io/spike-prime-docs/). Pure byte
 * work with no browser APIs, so tests can run it against a simulated hub.
 *
 * A message is a type byte plus little-endian fields. On the wire it is
 * COBS-encoded (0x00, 0x01 and 0x02 escaped), XORed with 3 and ended by 0x02.
 */

export const BLE_SERVICE = '0000fd02-0000-1000-8000-00805f9b34fb'
/** The hub receives on RX (write without response) and sends on TX (notifications). */
export const BLE_RX = '0000fd02-0001-1000-8000-00805f9b34fb'
export const BLE_TX = '0000fd02-0002-1000-8000-00805f9b34fb'

/** Hubs have program slots 0–19. */
export const SLOT_COUNT = 20
export const PROGRAM_FILE = 'program.py'

const HIGH_PRIORITY = 0x01
const DELIMITER = 0x02
const NO_DELIMITER = 0xff
const CODE_OFFSET = DELIMITER
const MAX_BLOCK = 84
const XOR = 3

export function cobsEncode(data: Uint8Array): Uint8Array {
  const out: number[] = []
  let codeAt = 0
  let block = 0
  const begin = () => {
    codeAt = out.length
    out.push(NO_DELIMITER)
    block = 1
  }
  begin()
  for (const byte of data) {
    if (byte > DELIMITER) {
      out.push(byte)
      block++
    }
    if (byte <= DELIMITER || block > MAX_BLOCK) {
      if (byte <= DELIMITER) out[codeAt] = byte * MAX_BLOCK + block + CODE_OFFSET
      begin()
    }
  }
  out[codeAt] = block + CODE_OFFSET
  return Uint8Array.from(out)
}

export function cobsDecode(data: Uint8Array): Uint8Array {
  const out: number[] = []
  const unescape = (code: number): [number | null, number] => {
    if (code === NO_DELIMITER) return [null, MAX_BLOCK + 1]
    const offset = code - CODE_OFFSET
    let value = Math.floor(offset / MAX_BLOCK)
    let block = offset % MAX_BLOCK
    if (block === 0) {
      // A full block that ends with a delimiter.
      block = MAX_BLOCK
      value--
    }
    return [value, block]
  }
  let [value, block] = unescape(data[0])
  for (let i = 1; i < data.length; i++) {
    block--
    if (block > 0) {
      out.push(data[i])
      continue
    }
    if (value !== null) out.push(value)
    ;[value, block] = unescape(data[i])
  }
  return Uint8Array.from(out)
}

/** A message → the bytes to send. */
export function packFrame(message: Uint8Array): Uint8Array {
  const encoded = cobsEncode(message)
  const frame = new Uint8Array(encoded.length + 1)
  encoded.forEach((b, i) => (frame[i] = b ^ XOR))
  frame[encoded.length] = DELIMITER
  return frame
}

/** The body of a frame (no priority byte, no delimiter) → the message. */
export function unpackFrame(body: Uint8Array): Uint8Array {
  return cobsDecode(body.map((b) => b ^ XOR))
}

/**
 * Collects notifications into messages. A message may be split over several
 * notifications, and a high-priority one (0x01 … 0x02) may arrive in the
 * middle of a normal one, which then carries on.
 */
export class FrameReader {
  private normal: number[] = []
  private high: number[] = []
  private inHigh = false

  push(chunk: Uint8Array): Uint8Array[] {
    const done: Uint8Array[] = []
    for (const byte of chunk) {
      if (byte === HIGH_PRIORITY) {
        this.inHigh = true
        this.high = []
      } else if (byte === DELIMITER) {
        const body = this.inHigh ? this.high : this.normal
        if (body.length) done.push(unpackFrame(Uint8Array.from(body)))
        if (this.inHigh) this.high = []
        else this.normal = []
        this.inHigh = false
      } else (this.inHigh ? this.high : this.normal).push(byte)
    }
    return done
  }
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

/** CRC-32 of the data padded with zeros to a multiple of 4 bytes, as the hub computes it. */
export function hubCrc(data: Uint8Array, seed = 0): number {
  let c = ~seed >>> 0
  const pad = (4 - (data.length % 4)) % 4
  const step = (b: number) => {
    c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  }
  data.forEach(step)
  for (let i = 0; i < pad; i++) step(0)
  return ~c >>> 0
}

export const MSG = {
  infoRequest: 0x00,
  infoResponse: 0x01,
  startUpload: 0x0c,
  startUploadResponse: 0x0d,
  chunk: 0x10,
  chunkResponse: 0x11,
  flow: 0x1e,
  flowResponse: 0x1f,
  flowNotification: 0x20,
  console: 0x21,
  deviceSubscribe: 0x28,
  deviceSubscribeResponse: 0x29,
  devices: 0x3c,
  clearSlot: 0x46,
  clearSlotResponse: 0x47,
} as const

function message(size: number, fill: (v: DataView) => void): Uint8Array {
  const bytes = new Uint8Array(size)
  fill(new DataView(bytes.buffer))
  return bytes
}

export const infoRequest = () => Uint8Array.of(MSG.infoRequest)
export const clearSlotRequest = (slot: number) => Uint8Array.of(MSG.clearSlot, slot)
export const programFlowRequest = (stop: boolean, slot: number) => Uint8Array.of(MSG.flow, stop ? 1 : 0, slot)
export const deviceSubscribeRequest = (intervalMs: number) =>
  message(3, (v) => {
    v.setUint8(0, MSG.deviceSubscribe)
    v.setUint16(1, intervalMs, true)
  })

export function startUploadRequest(fileName: string, slot: number, crc: number): Uint8Array {
  const name = new TextEncoder().encode(fileName)
  if (name.length > 31) throw new Error('file name too long')
  return message(1 + name.length + 1 + 1 + 4, (v) => {
    v.setUint8(0, MSG.startUpload)
    name.forEach((b, i) => v.setUint8(1 + i, b))
    v.setUint8(1 + name.length + 1, slot)
    v.setUint32(1 + name.length + 2, crc, true)
  })
}

export function chunkRequest(runningCrc: number, chunk: Uint8Array): Uint8Array {
  return message(1 + 4 + 2 + chunk.length, (v) => {
    v.setUint8(0, MSG.chunk)
    v.setUint32(1, runningCrc, true)
    v.setUint16(5, chunk.length, true)
    chunk.forEach((b, i) => v.setUint8(7 + i, b))
  })
}

export interface HubInfo {
  firmware: string
  maxPacket: number
  maxChunk: number
}

export type DeviceUpdate =
  | { kind: 'battery'; percent: number }
  | { kind: 'motor'; port: string; speed: number; position: number }
  | { kind: 'force'; port: string; value: number; pressed: boolean }
  | { kind: 'color'; port: string; color: number; rgb: [number, number, number] }
  | { kind: 'distance'; port: string; mm: number }

export type HubMessage =
  | { type: 'info'; info: HubInfo }
  /** A reply to a request: `id` is the response's type byte. */
  | { type: 'status'; id: number; ok: boolean }
  | { type: 'flow'; stopped: boolean }
  | { type: 'console'; text: string }
  | { type: 'devices'; updates: DeviceUpdate[] }

const STATUS_IDS = new Set<number>([MSG.startUploadResponse, MSG.chunkResponse, MSG.flowResponse, MSG.deviceSubscribeResponse, MSG.clearSlotResponse])
const PORTS = 'ABCDEF'
/** Bytes of each device entry, type byte included (the entries have no length of their own). */
const DEVICE_SIZE: Record<number, number> = { 0x00: 2, 0x01: 21, 0x02: 26, 0x0a: 12, 0x0b: 4, 0x0c: 9, 0x0d: 4, 0x0e: 11 }

function parseDevices(payload: Uint8Array): DeviceUpdate[] {
  const v = new DataView(payload.buffer, payload.byteOffset, payload.byteLength)
  const out: DeviceUpdate[] = []
  for (let i = 0; i < payload.length;) {
    const id = payload[i]
    const size = DEVICE_SIZE[id]
    if (!size || i + size > payload.length) break
    const port = PORTS[payload[i + 1]] ?? '?'
    if (id === 0x00) out.push({ kind: 'battery', percent: payload[i + 1] })
    else if (id === 0x0a) out.push({ kind: 'motor', port, speed: v.getInt8(i + 7), position: v.getInt32(i + 8, true) })
    else if (id === 0x0b) out.push({ kind: 'force', port, value: payload[i + 2], pressed: payload[i + 3] !== 0 })
    else if (id === 0x0c)
      out.push({ kind: 'color', port, color: v.getInt8(i + 2), rgb: [v.getUint16(i + 3, true), v.getUint16(i + 5, true), v.getUint16(i + 7, true)] })
    else if (id === 0x0d) out.push({ kind: 'distance', port, mm: v.getInt16(i + 2, true) })
    i += size
  }
  return out
}

/** A decoded message from the hub, or null for types we do not use. */
export function parseMessage(data: Uint8Array): HubMessage | null {
  if (!data.length) return null
  const id = data[0]
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength)
  if (STATUS_IDS.has(id)) return data.length >= 2 ? { type: 'status', id, ok: data[1] === 0 } : null
  if (id === MSG.infoResponse && data.length >= 17) {
    return {
      type: 'info',
      info: { firmware: `${data[5]}.${data[6]}.${v.getUint16(7, true)}`, maxPacket: v.getUint16(9, true), maxChunk: v.getUint16(13, true) },
    }
  }
  if (id === MSG.flowNotification && data.length >= 2) return { type: 'flow', stopped: data[1] !== 0 }
  if (id === MSG.console) {
    let end = data.indexOf(0, 1)
    if (end < 0) end = data.length
    return { type: 'console', text: new TextDecoder().decode(data.subarray(1, end)) }
  }
  if (id === MSG.devices && data.length >= 3) return { type: 'devices', updates: parseDevices(data.subarray(3)) }
  return null
}
