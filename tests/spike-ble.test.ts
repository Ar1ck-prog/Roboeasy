import { describe, expect, it } from 'vitest'

import { HubClient, HubError, type HubTransport } from '@/lib/spike/ble'
import {
  FrameReader,
  MSG,
  type HubMessage,
  chunkRequest,
  cobsDecode,
  cobsEncode,
  hubCrc,
  packFrame,
  parseMessage,
  programFlowRequest,
  startUploadRequest,
} from '@/lib/spike/ble-protocol'

const hex = (b: Uint8Array) => Buffer.from(b).toString('hex')
const bytes = (...n: number[]) => Uint8Array.from(n)
const text = (s: string) => new TextEncoder().encode(s)

describe('framing', () => {
  it('matches frames worked out by hand from LEGO’s algorithm', () => {
    expect(hex(packFrame(bytes(0x00)))).toBe('000002')
    expect(hex(packFrame(bytes(0x0c, 0x70, 0x00, 0x01, 0x02, 0x03, 0xff, 0x00)))).toBe('060f7354a80600fc0002')
  })

  it('splits long runs into blocks of 84', () => {
    const encoded = cobsEncode(new Uint8Array(100).fill(9))
    expect(encoded.length).toBe(102)
    expect(encoded[0]).toBe(0xff)
    expect(encoded[85]).toBe(16 + 1 + 2)
  })

  it('round-trips any bytes, with no control bytes on the wire', () => {
    let seed = 7
    const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff)
    for (let n = 0; n < 300; n++) {
      const data = Uint8Array.from({ length: next() % 400 }, () => (next() % 4 === 0 ? next() % 3 : next() % 256))
      expect(hex(cobsDecode(cobsEncode(data)))).toBe(hex(data))
      const frame = packFrame(data)
      expect(frame.subarray(0, -1).every((b) => b !== 1 && b !== 2)).toBe(true)
      expect(frame[frame.length - 1]).toBe(2)
    }
    const edge = new Uint8Array(84).fill(9)
    edge[83] = 0
    expect(hex(cobsDecode(cobsEncode(edge)))).toBe(hex(edge))
  })

  it('reassembles split messages and lets a high-priority one cut in', () => {
    const normal = packFrame(bytes(0x21, 0x41, 0x00))
    const high = packFrame(bytes(0x20, 0x01))
    const reader = new FrameReader()
    expect(reader.push(normal.subarray(0, 2))).toEqual([])
    const got = reader.push(Uint8Array.from([0x01, ...high, ...normal.subarray(2)]))
    expect(got.map(hex)).toEqual(['2001', '214100'])
  })
})

describe('CRC', () => {
  // Reference values from Python's binascii.crc32 with zero padding to 4 bytes.
  it('pads to four bytes like the hub', () => {
    expect(hubCrc(text('a'))).toBe(2732478330)
    expect(hubCrc(text('abcd'))).toBe(3984772369)
    expect(hubCrc(text('abcde'))).toBe(2338359752)
    expect(hubCrc(text('import runloop\nprint("Привет")\n'))).toBe(4057882045)
  })

  it('continues from a seed', () => {
    expect(hubCrc(text('xyz'), hubCrc(text('abcd')))).toBe(2816721961)
  })
})

describe('messages', () => {
  it('encodes requests as LEGO documents them', () => {
    expect(hex(programFlowRequest(false, 3))).toBe('1e0003')
    expect(hex(programFlowRequest(true, 3))).toBe('1e0103')
    expect(hex(startUploadRequest('a.py', 2, 0x01020304))).toBe('0c' + hex(text('a.py')) + '00' + '02' + '04030201')
    expect(hex(chunkRequest(0x0a0b0c0d, bytes(5, 6)))).toBe('10' + '0d0c0b0a' + '0200' + '0506')
  })

  it('reads the hub info, console and devices', () => {
    const info = new Uint8Array(17)
    const v = new DataView(info.buffer)
    info.set([0x01, 1, 0], 0)
    info.set([3, 4], 5)
    v.setUint16(7, 42, true)
    v.setUint16(9, 509, true)
    v.setUint16(11, 1024, true)
    v.setUint16(13, 960, true)
    expect(parseMessage(info)).toEqual({ type: 'info', info: { firmware: '3.4.42', maxPacket: 509, maxChunk: 960 } })
    expect(parseMessage(bytes(0x21, 0x68, 0x69, 0, 0))).toEqual({ type: 'console', text: 'hi' })

    const motor = new Uint8Array(12)
    const m = new DataView(motor.buffer)
    motor.set([0x0a, 1, 48])
    m.setInt16(3, -10, true)
    m.setInt16(5, 50, true)
    m.setInt8(7, -30)
    m.setInt32(8, 1234, true)
    const distance = new Uint8Array(4)
    distance.set([0x0d, 4])
    new DataView(distance.buffer).setInt16(2, -1, true)
    const imu = new Uint8Array(21)
    imu[0] = 0x01
    const payload = Uint8Array.from([0x00, 87, ...imu, ...motor, ...distance])
    const parsed = parseMessage(Uint8Array.from([0x3c, payload.length, 0, ...payload])) as Extract<HubMessage, { type: 'devices' }>
    expect(parsed.updates).toEqual([
      { kind: 'battery', percent: 87 },
      { kind: 'motor', port: 'B', speed: -30, position: 1234 },
      { kind: 'distance', port: 'E', mm: -1 },
    ])
  })

  it('stops at an unknown device entry instead of misreading the rest', () => {
    const parsed = parseMessage(bytes(0x3c, 4, 0, 0x00, 50, 0x77, 1)) as Extract<HubMessage, { type: 'devices' }>
    expect(parsed.updates).toEqual([{ kind: 'battery', percent: 50 }])
  })

  it('ignores types it does not know', () => {
    expect(parseMessage(bytes(0x99, 1))).toBeNull()
    expect(parseMessage(new Uint8Array())).toBeNull()
  })
})

/** A simulated hub: small packets, split replies, and it checks every CRC like the real one. */
class FakeHub implements HubTransport {
  onData: (d: Uint8Array) => void = () => {}
  onClose: () => void = () => {}
  reader = new FrameReader()
  log: number[] = []
  packets: number[] = []
  file = { name: '', slot: -1, crc: 0, bytes: [] as number[], running: 0 }
  crcOk = true
  refuse = new Set<number>()
  silent = new Set<number>()
  maxPacket = 20
  maxChunk = 7

  async write(data: Uint8Array) {
    this.packets.push(data.length)
    for (const m of this.reader.push(data)) this.handle(m)
  }
  close() {
    this.onClose()
  }
  send(message: Uint8Array) {
    const frame = packFrame(message)
    for (let i = 0; i < frame.length; i += 5) this.onData(frame.slice(i, i + 5))
  }
  reply(id: number, ok = true) {
    this.send(bytes(id, ok ? 0 : 1))
  }
  handle(m: Uint8Array) {
    const id = m[0]
    const v = new DataView(m.buffer, m.byteOffset, m.byteLength)
    this.log.push(id)
    if (this.silent.has(id)) return
    if (id === MSG.infoRequest) {
      const info = new Uint8Array(17)
      const iv = new DataView(info.buffer)
      info.set([MSG.infoResponse, 1, 0], 0)
      info.set([3, 2], 5)
      iv.setUint16(9, this.maxPacket, true)
      iv.setUint16(13, this.maxChunk, true)
      this.send(info)
    } else if (id === MSG.deviceSubscribe) this.reply(MSG.deviceSubscribeResponse)
    else if (id === MSG.clearSlot)
      this.reply(MSG.clearSlotResponse, false) // an empty slot
    else if (id === MSG.startUpload) {
      const end = m.indexOf(0, 1)
      this.file = { name: new TextDecoder().decode(m.subarray(1, end)), slot: m[end + 1], crc: v.getUint32(end + 2, true), bytes: [], running: 0 }
      this.reply(MSG.startUploadResponse, !this.refuse.has(id))
    } else if (id === MSG.chunk) {
      const size = v.getUint16(5, true)
      const chunk = m.subarray(7, 7 + size)
      this.file.running = hubCrc(chunk, this.file.running)
      if (this.file.running !== v.getUint32(1, true)) this.crcOk = false
      this.file.bytes.push(...chunk)
      this.reply(MSG.chunkResponse, !this.refuse.has(id))
    } else if (id === MSG.flow) this.reply(MSG.flowResponse, !this.refuse.has(id))
  }
}

async function connected(hub = new FakeHub(), timeout?: number) {
  const client = new HubClient(hub, timeout)
  await client.handshake()
  return { hub, client }
}

describe('hub client against a simulated hub', () => {
  it('asks for the hub’s limits first, then subscribes to sensors', async () => {
    const { hub, client } = await connected()
    expect(hub.log).toEqual([MSG.infoRequest, MSG.deviceSubscribe])
    expect(client.info).toEqual({ firmware: '3.2.0', maxPacket: 20, maxChunk: 7 })
  })

  it('uploads a program in chunks with correct CRCs, then starts it', async () => {
    const { hub, client } = await connected()
    const code = 'import runloop\nprint("Привет, робот")\nrunloop.run()\n'
    const progress: number[] = []
    await client.upload(code, 4, (p) => progress.push(p))
    expect(await client.start(4)).toBe(true)
    expect(hub.file.name).toBe('program.py')
    expect(hub.file.slot).toBe(4)
    expect(hub.file.crc).toBe(hubCrc(text(code)))
    expect(new TextDecoder().decode(Uint8Array.from(hub.file.bytes))).toBe(code)
    expect(hub.crcOk).toBe(true)
    expect(progress[progress.length - 1]).toBe(1)
    expect(hub.packets.every((n) => n <= 20)).toBe(true)
    expect(hub.log.slice(2, 4)).toEqual([MSG.clearSlot, MSG.startUpload])
    expect(hub.log[hub.log.length - 1]).toBe(MSG.flow)
  })

  it('reports a refused upload or chunk', async () => {
    const a = await connected()
    a.hub.refuse.add(MSG.startUpload)
    await expect(a.client.upload('x = 1', 0)).rejects.toBeInstanceOf(HubError)
    const b = await connected()
    b.hub.refuse.add(MSG.chunk)
    await expect(b.client.upload('x = 1', 0)).rejects.toBeInstanceOf(HubError)
  })

  it('refuses an empty program without touching the hub', async () => {
    const { hub, client } = await connected()
    await expect(client.upload('', 0)).rejects.toBeInstanceOf(HubError)
    expect(hub.log.length).toBe(2)
  })

  it('times out when the hub does not answer, and keeps working after', async () => {
    const hub = new FakeHub()
    const { client } = await connected(hub, 20)
    hub.silent.add(MSG.flow)
    await expect(client.stop(0)).rejects.toBeInstanceOf(HubError)
    hub.silent.clear()
    expect(await client.stop(0)).toBe(true)
  })

  it('fails the request in progress when the connection drops', async () => {
    const hub = new FakeHub()
    const { client } = await connected(hub)
    hub.silent.add(MSG.flow)
    const pending = client.stop(0)
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))
    client.abort()
    await expect(pending).rejects.toBeInstanceOf(HubError)
  })

  it('passes on console text, program state and sensors', async () => {
    const { hub, client } = await connected()
    const seen: unknown[] = []
    client.onConsole = (t) => seen.push(t)
    client.onFlow = (s) => seen.push(s)
    client.onDevices = (u) => seen.push(u)
    hub.send(bytes(MSG.console, 0x6f, 0x6b, 0))
    hub.send(bytes(MSG.flowNotification, 1))
    hub.send(bytes(MSG.devices, 2, 0, 0x00, 90))
    expect(seen).toEqual(['ok', true, [{ kind: 'battery', percent: 90 }]])
  })
})
