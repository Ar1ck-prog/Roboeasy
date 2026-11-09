import { type Page, expect, test } from '@playwright/test'

import { programToPython } from '../../lib/dsl/compile-python'
import { DEFAULT_ROBOT, type Program } from '../../lib/dsl/types'
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

/** Replaces Chrome's Bluetooth with a stand-in wired to the simulated hub. */
async function fakeBluetooth(page: Page) {
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
  return hub
}

test('uploads the program to the chosen slot, runs it, shows the console and stops it', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const hub = await fakeBluetooth(page)

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

/** The sandbox without the AI service: answers are fixed, everything after them is real. */
async function openSandbox(page: Page, answer: object) {
  await page.route('**/api/generate', (route) =>
    route.fulfill(
      route.request().method() === 'GET' ? { json: { configured: true } } : { json: { ok: true, title: 'Проба', description: '', warnings: [], ...answer } },
    ),
  )
  await page.goto('/ru/sandbox')
}

async function generate(page: Page) {
  await page.getByLabel('Задача для робота').fill('Проедь вперёд и остановись')
  await page.getByRole('button', { name: 'Создать программу' }).click()
}

test('sandbox: connect before generating, then run generated blocks on the robot', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const hub = await fakeBluetooth(page)
  const program: Program = { title: 'Проба', description: '', steps: [{ op: 'move', direction: 'forward', value: 20, unit: 'cm' }] }
  const python = programToPython(program, DEFAULT_ROBOT)
  await openSandbox(page, { format: 'blocks', program, python })

  // The robot can be connected as soon as the page opens.
  const panel = page.getByTestId('robot-panel')
  await panel.getByRole('button', { name: 'Подключить робота' }).click()
  await expect(panel).toContainText('Hub Тест')

  await generate(page)
  await expect(page.getByRole('heading', { name: 'Проба' })).toBeVisible()
  await page.getByRole('button', { name: 'Запустить на роботе' }).click()
  await expect(page.getByTestId('robot-console')).toHaveText('Привет с хаба')
  expect(new TextDecoder().decode(Uint8Array.from(hub.file.bytes))).toBe(python)
  expect(hub.flow).toEqual([{ stop: false, slot: 0 }])
  expect(errors).toEqual([])
})

test('sandbox: free Python goes to the robot unchanged, and one button also connects', async ({ page }) => {
  const hub = await fakeBluetooth(page)
  const code = 'import runloop\n\nasync def main():\n    print("Привет")\n\nrunloop.run(main())\n'
  await openSandbox(page, { format: 'python', code })
  await page.getByRole('button', { name: /^Python/ }).click()
  await page.getByRole('checkbox', { name: /Свободный Python/ }).check()
  await generate(page)
  await page.getByRole('button', { name: 'Подключить и запустить' }).click()
  await expect(page.getByTestId('robot-console')).toHaveText('Привет с хаба')
  expect(new TextDecoder().decode(Uint8Array.from(hub.file.bytes))).toBe(code)
})

test('sandbox: "езжай по кругу" gives blocks and Python, a file to download and a run on the robot', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const hub = await fakeBluetooth(page)
  const program: Program = { title: 'Круг', description: 'Робот проезжает круг.', steps: [{ op: 'circle', direction: 'right', radius: 20, turns: 1 }] }
  const python = programToPython(program, DEFAULT_ROBOT)
  await openSandbox(page, { format: 'blocks', title: 'Круг', program, python })

  await page.getByLabel('Задача для робота').fill('езжай по кругу')
  await page.getByRole('button', { name: 'Создать программу' }).click()
  await expect(page.getByRole('heading', { name: 'Круг' })).toBeVisible()
  await expect(page.getByText(/ехать по кругу/)).toBeVisible()

  await page.getByRole('tab', { name: 'Python' }).click()
  await expect(page.getByText(/move_tank_for_degrees/).first()).toBeVisible()

  await expect(page.getByRole('button', { name: /Скачать/ }).first()).toBeEnabled()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /Скачать/ }).first().click()
  expect((await download).suggestedFilename()).toMatch(/\.llsp3$/)

  await page.getByRole('button', { name: 'Подключить и запустить' }).click()
  await expect(page.getByTestId('robot-console')).toHaveText('Привет с хаба')
  expect(new TextDecoder().decode(Uint8Array.from(hub.file.bytes))).toBe(python)
  expect(errors).toEqual([])
})

test('sandbox: a task the robot cannot do gets a reason and a way forward', async ({ page }) => {
  await page.route('**/api/generate', (route) =>
    route.fulfill(
      route.request().method() === 'GET'
        ? { json: { configured: true } }
        : { json: { ok: false, error: 'unsupported', reason: 'У робота нет крыльев.', suggestion: 'Проедь вперёд и покажи стрелку' } },
    ),
  )
  await page.goto('/ru/sandbox')
  await page.getByLabel('Задача для робота').fill('Полети')
  await page.getByRole('button', { name: 'Создать программу' }).click()
  await expect(page.locator('p[role=alert]')).toContainText('У робота нет крыльев.')
  await page.getByRole('button', { name: /Попробовать: Проедь вперёд/ }).click()
  await expect(page.getByLabel('Задача для робота')).toHaveValue('Проедь вперёд и покажи стрелку')
})
