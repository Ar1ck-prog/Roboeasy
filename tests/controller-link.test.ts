import { expect, it, vi } from 'vitest'

import type { HubTransport } from '@/lib/spike/ble'
import { FrameReader, MSG, packFrame, tunnelMessage } from '@/lib/spike/ble-protocol'
import { ControllerLink } from '@/lib/spike/controller-link'
import { STOPPED } from '@/lib/spike/controller-input'

it('sends fresh input between heartbeats and brakes on release without waiting for a tick', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const reader = new FrameReader()
  const motors: { at: number; speeds: number[] }[] = []
  const acknowledged: typeof motors = []
  const transport: HubTransport = {
    close() {},
    onClose() {},
    onData() {},
    async write(data) {
      for (const message of reader.push(data)) {
        const type = message[0]
        if (type === MSG.infoRequest) {
          transport.onData(packFrame(Uint8Array.of(MSG.infoResponse, 1, 0, 0, 0, 1, 8, 149, 0, 20, 0, 255, 0, 64, 0, 0, 0)))
        } else if (type === MSG.tunnel) {
          const command = decoder.decode(message.subarray(3))
          const speeds = Array.from({ length: 6 }, (_, i) => parseInt(command.slice(3 + 2 * i, 5 + 2 * i), 16) - 100)
          motors.push({ at: performance.now(), speeds })
          transport.onData(packFrame(tunnelMessage(encoder.encode(command.slice(0, 3)))))
        } else {
          transport.onData(packFrame(Uint8Array.of(type + 1, 0)))
        }
      }
    },
  }
  const link = new ControllerLink(transport, 19, {
    onDevices() {},
    onLost() {},
    onApplied: (speeds, at) => acknowledged.push({ speeds: [...speeds], at }),
  }, () => {})
  try {
    await link.initialize()
    const left = [-10, 10, 0, 0, 0, 0]
    const right = [10, -10, 0, 0, 0, 0]
    link.update(left)
    await vi.advanceTimersByTimeAsync(5)
    link.update(right)
    await vi.advanceTimersByTimeAsync(15)
    expect(motors).toEqual([{ at: 0, speeds: STOPPED }, { at: 20, speeds: right }])

    await vi.advanceTimersByTimeAsync(1)
    link.update(STOPPED)
    await vi.advanceTimersByTimeAsync(0)
    expect(motors.at(-1)).toEqual({ at: 21, speeds: STOPPED })
    expect(acknowledged).toEqual(motors)
  } finally {
    link.close()
    vi.useRealTimers()
  }
})

for (const fault of [null, 'brake', 'stop', 'upload'] as const) {
  it(`keeps the brake and slot-write order with ${fault ?? 'a successful upload'}`, async () => {
    const reader = new FrameReader()
    const events: string[] = []
    let saving = false
    const transport: HubTransport = {
      close: () => { events.push('disconnect') },
      onData() {},
      onClose() {},
      async write(data) {
        for (const message of reader.push(data)) {
          const [type, action, slot] = message
          let response: Uint8Array = Uint8Array.of(type + 1, 0)
          if (type === MSG.infoRequest) {
            response = Uint8Array.of(MSG.infoResponse, 1, 0, 0, 0, 1, 8, 149, 0, 20, 0, 255, 0, 64, 0, 0, 0)
          } else if (type === MSG.tunnel) {
            expect(new TextDecoder().decode(message.subarray(6))).toBe('646464646464')
            if (saving && fault === 'brake') continue
            events.push('brake ack')
            response = tunnelMessage(message.subarray(3, 6))
          } else if (type === MSG.flow) {
            expect(slot).toBe(19)
            events.push(action ? 'stop service' : 'start service')
            if (action && fault === 'stop') response[1] = 1
          } else if (type === MSG.clearSlot) {
            events.push(`clear slot ${action}`)
          } else if (type === MSG.startUpload && events.includes('stop service') && fault === 'upload') {
            response[1] = 1
          } else if (type === MSG.chunk) {
            events.push('chunk accepted')
          }
          transport.onData(packFrame(response))
        }
      },
    }
    const link = new ControllerLink(transport, 19, { onDevices() {}, onLost() {} }, () => {})
    try {
      await link.initialize()
      events.length = 0
      saving = true
      const saved = link.saveRoute(() => {
        events.push('route complete')
        return 'print("route")\n'
      }, () => events.push('uploading'), () => {})
      if (fault === 'brake') {
        await expect(saved).rejects.toThrow('brake unconfirmed')
        expect(events).toEqual(['disconnect'])
        return
      }
      if (fault) await expect(saved).rejects.toThrow(fault === 'stop' ? 'stop refused' : 'upload refused')
      else await expect(saved).resolves.toBe(true)
      expect(events).toEqual([
        'brake ack', 'route complete', 'stop service',
        ...(fault === 'stop' ? [] : ['uploading', 'clear slot 19']),
        ...(fault ? [] : ['chunk accepted']),
        'disconnect',
      ])
    } finally {
      link.close()
    }
  })
}
