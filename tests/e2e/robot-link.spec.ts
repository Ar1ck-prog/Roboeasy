import { expect, test } from '@playwright/test'

import { FrameReader, MSG, hubCrc, packFrame } from '../../lib/spike/ble-protocol'

/**
 * Connecting to a robot from the page. Chrome's Bluetooth is replaced by a
 * stand-in whose writes reach a simulated hub here in Node, so the real
 * client, framing and UI all run; only the radio is fake.
 */

function simulatedHub() {
  const reader = new FrameReader()
  const file = { name: '', slot: -1, crc: 0, bytes: [] as number[], running: 0, crcOk: true }
  const flow: { stop: boolean; slot: number }[] = []
  const frame = (...b: number[]) => Array.from(packFrame(Uint8Array.from(b)))

  function handle(m: Uint8Array): number[][] {
    const v = new DataView(m.buffer, m.byteOffset, m.byteLength)
    switch (m[0]) {
      case MSG.infoRequest: {
        const info = new Uint8Array(17)
        const iv = new DataView(info.buffer)
        info.set([MSG.infoResponse, 1, 0], 0)
        info.set([3, 4], 5)
        iv.setUint16(7, 42, true)
        iv.setUint16(9, 64, true)
        iv.setUint16(13, 100, true)
        return [Array.from(packFrame(info))]
      }
      case MSG.deviceSubscribe:
        return [frame(MSG.deviceSubscribeResponse, 0)]
      case MSG.clearSlot:
        return [frame(MSG.clearSlotResponse, 0)]
      case MSG.startUpload: {
        const end = m.indexOf(0, 1)
        Object.assign(file, { name: new TextDecoder().decode(m.subarray(1, end)), slot: m[end + 1], crc: v.getUint32(end + 2, true), bytes: [], running: 0 })
        return [frame(MSG.startUploadResponse, 0)]
      }
      case MSG.chunk: {
        const chunk = m.subarray(7, 7 + v.getUint16(5, true))
        file.running = hubCrc(chunk, file.running)
        if (file.running !== v.getUint32(1, true)) file.crcOk = false
        file.bytes.push(...chunk)
        return [frame(MSG.chunkResponse, 0)]
      }
      case MSG.flow: {
        const stop = m[1] !== 0
        flow.push({ stop, slot: m[2] })
        if (stop) return [frame(MSG.flowResponse, 0), frame(MSG.flowNotification, 1)]
        const hello = new TextEncoder().encode('Привет с хаба\n')
        return [frame(MSG.flowResponse, 0), frame(MSG.flowNotification, 0), frame(MSG.console, ...hello, 0), frame(MSG.devices, 2, 0, 0x00, 87)]
      }
      default:
        return []
    }
  }

  return { file, flow, write: (data: number[]) => reader.push(Uint8Array.from(data)).flatMap(handle) }
}

declare global {
  interface Window {
    __hubWrite(data: number[]): Promise<number[][]>
    __dropHub(): void
  }
}

test('uploads the program to the chosen slot, runs it, shows the console and stops it', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const hub = simulatedHub()
  await page.exposeFunction('__hubWrite', hub.write)
  await page.addInitScript(() => {
    const tx = new EventTarget() as EventTarget & { value?: DataView; startNotifications(): Promise<void> }
    tx.startNotifications = async () => {}
    const rx = {
      async writeValueWithoutResponse(data: Uint8Array) {
        for (const reply of await window.__hubWrite(Array.from(data))) {
          tx.value = new DataView(Uint8Array.from(reply).buffer)
          tx.dispatchEvent(new Event('characteristicvaluechanged'))
        }
      },
    }
    const device = new EventTarget() as EventTarget & { name: string; gatt: unknown }
    device.name = 'Hub Тест'
    const drop = () => device.dispatchEvent(new Event('gattserverdisconnected'))
    device.gatt = {
      connected: true,
      connect: async () => ({ getPrimaryService: async () => ({ getCharacteristic: async (uuid: string) => (uuid.includes('-0001-') ? rx : tx) }) }),
      disconnect: drop,
    }
    window.__dropHub = drop
    Object.defineProperty(navigator, 'bluetooth', { configurable: true, value: { requestDevice: async () => device } })
  })

  await page.goto('/ru/compete/simulator')
  await page.getByRole('tab', { name: 'Наш симулятор' }).click()
  await page.getByTestId('sim-missions').getByText('Взрывающиеся семена').click()

  const panel = page.getByTestId('robot-panel')
  await panel.getByRole('combobox').selectOption('5')

  await page.getByRole('button', { name: 'Подключить и запустить' }).click()
  await expect(panel).toContainText('Hub Тест')
  await expect(panel).toContainText('3.4.42')
  await expect(panel).toContainText('87')
  await expect(page.getByTestId('robot-console')).toHaveText('Привет с хаба')

  expect(hub.file.name).toBe('program.py')
  expect(hub.file.slot).toBe(5)
  expect(hub.file.crcOk).toBe(true)
  const sent = Uint8Array.from(hub.file.bytes)
  expect(sent.length).toBeGreaterThan(100)
  expect(hub.file.crc).toBe(hubCrc(sent))
  expect(new TextDecoder().decode(sent)).toContain('import')
  expect(hub.flow).toEqual([{ stop: false, slot: 5 }])

  await page.getByRole('button', { name: 'Остановить робота' }).click()
  await expect(page.getByRole('button', { name: 'Остановить робота' })).toHaveCount(0)
  expect(hub.flow[1]).toEqual({ stop: true, slot: 5 })

  // The hub goes out of range: the page says so and offers to reconnect.
  await page.evaluate(() => window.__dropHub())
  await expect(panel.getByRole('alert')).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Подключить робота' })).toBeVisible()
  expect(errors).toEqual([])
})

test('a browser without Bluetooth gets an explanation, not a dead button', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'bluetooth', { configurable: true, value: undefined }))
  await page.goto('/ru/compete/simulator')
  await page.getByRole('tab', { name: 'Наш симулятор' }).click()
  await page.getByTestId('sim-missions').getByText('Взрывающиеся семена').click()
  await expect(page.getByTestId('robot-panel')).toContainText('Chrome')
  await expect(page.getByRole('button', { name: 'Подключить и запустить' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Подключить робота' })).toHaveCount(0)
})
