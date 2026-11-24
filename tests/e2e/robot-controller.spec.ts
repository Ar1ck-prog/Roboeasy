import { devices, expect, test, type Page } from '@playwright/test'

import { BLE_RX, BLE_SERVICE, BLE_TX, FrameReader, MSG, packFrame, tunnelMessage } from '../../lib/spike/ble-protocol'
import { CONSOLE_COMMAND, CONTROLLER_COMMAND, CONTROLLER_CONSOLE_PREFIX } from '../../lib/spike/controller-program'

const zero = [0, 0, 0, 0, 0, 0]
const bytes = (...values: number[]) => Uint8Array.of(...values)
const encoder = new TextEncoder()
const decoder = new TextDecoder()
const url = `http://localhost:${process.env.E2E_PORT ?? 3100}`

async function emulateHub(page: Page, { cancelFirst = false, unsupportedFirst = false, missedBootProbes = 0, gattFails = false, consoleOnly = false, bootLog = '', firstMotorReply = '', programPorts }: {
  cancelFirst?: boolean; unsupportedFirst?: boolean; missedBootProbes?: number; gattFails?: boolean
  consoleOnly?: boolean; bootLog?: string; firstMotorReply?: string; programPorts?: string
} = {}) {
  const reader = new FrameReader()
  const speeds: number[][] = []
  const events: string[] = []
  const uploads: number[][] = []
  const chooser: { active: boolean; service: string }[] = []
  const modes: string[] = []
  let dropAck = false
  let fault: 'refuse-upload' | 'lose-upload' | 'refuse-stop' | undefined
  const portReport = (ports: string) => bytes(MSG.console, ...encoder.encode(`${CONTROLLER_CONSOLE_PREFIX}PORTS ${ports}|\n`), 0)
  await page.exposeFunction('spikePortReport', (ports: string) => Array.from(packFrame(portReport(ports))))
  await page.exposeFunction('spikeChooser', (request: { active: boolean; service: string }) => {
    chooser.push(request)
    return cancelFirst && chooser.length === 1
  })
  await page.exposeFunction('spikeWrite', (data: number[]) => {
    const responses: Uint8Array[] = []
    for (const message of reader.push(Uint8Array.from(data))) {
      if (message[0] === MSG.infoRequest) {
        responses.push(bytes(MSG.infoResponse, 1, 0, 0, 0, 1, 8, 149, 0, 20, 0, 255, 0, 64, 0, unsupportedFirst && chooser.length === 1 ? 1 : 0, 0))
      } else if (message[0] === MSG.deviceSubscribe) {
        const motor = (port: number) => [0x0a, port, 0x30, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        responses.push(bytes(MSG.deviceSubscribeResponse, 0), bytes(MSG.devices, 48, 0, ...motor(0), ...motor(1), ...motor(2), ...motor(3)))
      } else if ([MSG.clearSlot, MSG.startUpload, MSG.chunk, MSG.flow].some((id) => id === message[0])) {
        if (message[0] === MSG.startUpload) {
          uploads.push([])
          if (fault === 'refuse-upload') {
            fault = undefined
            responses.push(bytes(MSG.startUploadResponse, 1))
            continue
          }
        }
        if (message[0] === MSG.chunk) {
          if (fault === 'lose-upload') {
            fault = undefined
            events.push('chunk withheld')
            continue
          }
          uploads.at(-1)?.push(...message.subarray(7))
        }
        if (message[0] === MSG.flow && message[1] && fault === 'refuse-stop') {
          fault = undefined
          events.push('program stop refused')
          responses.push(bytes(MSG.flowResponse, 1))
          continue
        }
        responses.push(bytes(message[0] + 1, 0))
        if (message[0] === MSG.clearSlot) events.push(`slot:${message[1]}`)
        if (message[0] === MSG.flow) {
          events.push(message[1] ? 'program stop' : 'program start')
          if (!message[1] && bootLog) responses.push(bytes(MSG.console, ...encoder.encode(bootLog), 0))
          if (!message[1] && programPorts !== undefined) responses.push(portReport(programPorts))
        }
      } else if (message[0] === MSG.tunnel) {
        const command = decoder.decode(message.slice(3))
        const mode = command[0]
        if (command.length !== 15 || ![CONTROLLER_COMMAND, CONSOLE_COMMAND].includes(mode)) throw new Error('unexpected motor command')
        modes.push(mode)
        const values = Array.from({ length: 6 }, (_, i) => parseInt(command.slice(3 + 2 * i, 5 + 2 * i), 16) - 100)
        speeds.push(values)
        events.push(values.some(Boolean) ? 'move' : 'neutral')
        if (values.some(Boolean) && firstMotorReply) {
          if (firstMotorReply === 'fault') {
            responses.push(bytes(MSG.console, ...encoder.encode(`${CONTROLLER_CONSOLE_PREFIX}ERR ${command.slice(0, 3)} B ENODEV|`), 0))
          }
          firstMotorReply = ''
          continue
        }
        if (!dropAck && missedBootProbes <= 0) {
          if (!values.some(Boolean) && (mode === CONSOLE_COMMAND || !consoleOnly)) events.push('neutral ack')
          const reply = command.slice(0, 3)
          if (mode === CONSOLE_COMMAND) {
            const print = (line: string) => bytes(MSG.console, ...encoder.encode(line), 0)
            responses.push(print(CONTROLLER_CONSOLE_PREFIX), print(reply), print('\n'))
          } else if (!consoleOnly) responses.push(tunnelMessage(encoder.encode(reply)))
        }
        missedBootProbes = Math.max(0, missedBootProbes - 1)
      }
    }
    return responses.map((response) => Array.from(packFrame(response)))
  })
  await page.exposeFunction('spikeClosed', () => events.push('disconnect'))
  await page.addInitScript(({ rxId, txId, gattFails }) => {
    const fake = window as typeof window & {
      spikeChooser: (request: object) => Promise<boolean>
      spikeWrite: (data: number[]) => Promise<number[][]>
      spikeClosed: () => void
      spikeDisconnect: () => void
      spikePortReport: (ports: string) => Promise<number[]>
      spikeReportPorts: (ports: string) => Promise<void>
    }
    Object.defineProperty(navigator, 'bluetooth', {
      value: {
        async requestDevice(options: { filters: { services: string[] }[] }) {
          if (await fake.spikeChooser({ active: navigator.userActivation.isActive, service: options.filters[0].services[0] })) {
            throw new DOMException('cancelled', 'NotFoundError')
          }
          const device = Object.assign(new EventTarget(), { name: 'Test SPIKE Prime' })
          const tx = Object.assign(new EventTarget(), { value: new DataView(new ArrayBuffer(0)), async startNotifications() {} })
          const deliver = (response: number[]) => {
            tx.value = new DataView(Uint8Array.from(response).buffer)
            tx.dispatchEvent(new Event('characteristicvaluechanged'))
          }
          fake.spikeReportPorts = async (ports) => deliver(await fake.spikePortReport(ports))
          const rx = {
            async writeValueWithoutResponse(data: Uint8Array) {
              for (const response of await fake.spikeWrite(Array.from(data))) {
                deliver(response)
              }
            },
          }
          const gatt = {
            connected: false,
            async connect() {
              if (gattFails) throw new DOMException('Connection attempt failed.', 'NetworkError')
              this.connected = true
              return {
                async getPrimaryService() {
                  return {
                    async getCharacteristic(id: string) {
                      if (id === txId) return tx
                      if (id === rxId) return rx
                      throw new Error('unknown characteristic')
                    },
                  }
                },
              }
            },
            disconnect() {
              if (!this.connected) return
              this.connected = false
              fake.spikeClosed()
              device.dispatchEvent(new Event('gattserverdisconnected'))
            },
          }
          fake.spikeDisconnect = () => gatt.disconnect()
          return Object.assign(device, { gatt })
        },
      },
      configurable: true,
    })
  }, { rxId: BLE_RX, txId: BLE_TX, gattFails })
  return {
    speeds, events, chooser, modes,
    lastUpload: () => decoder.decode(Uint8Array.from(uploads.at(-1) ?? [])),
    failNext: (failure: typeof fault) => { fault = failure },
    dropAck: () => { dropAck = true },
    reportPorts: (ports: string) => page.evaluate((value) => (window as unknown as { spikeReportPorts(ports: string): Promise<void> }).spikeReportPorts(value), ports),
  }
}

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const motor = (page: Page, name: string) => page.getByRole('combobox', { name, exact: true })
const status = (page: Page) => page.locator('[aria-labelledby="hub-heading"]').getByRole('status')

async function connect(page: Page) {
  await motor(page, 'Слот программы').selectOption('19')
  await button(page, 'Подключить хаб').click()
  await expect(status(page)).toHaveText('Подключён · Test SPIKE Prime · Прошивка 1.8.149')
}

async function assignDrive(page: Page) {
  await motor(page, 'Левый мотор').selectOption('A')
  await motor(page, 'Правый мотор').selectOption('B')
  await page.getByText('Дополнительные моторы', { exact: true }).click()
  await motor(page, 'Захват').selectOption('C')
}

test.beforeEach(({ browserName }, testInfo) => {
  test.skip(browserName !== 'chromium' || testInfo.project.name !== 'desktop', 'Uses Chromium desktop and a separate emulated phone context')
})

test('connects from navigation, controls motors and clears input on every reset', async ({ page }, testInfo) => {
  const hub = await emulateHub(page, { cancelFirst: true })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  const expectSpeed = (values: number[]) => expect.poll(() => hub.speeds.at(-1)).toEqual([...values, ...zero.slice(values.length)])
  const main = page.getByRole('main')
  await page.goto('/ru')
  await button(page, 'Ещё').click()
  await page.getByRole('link', { name: 'Контроллер робота', exact: true }).click()
  await expect(page).toHaveURL(/\/ru\/controller$/)
  await motor(page, 'Левый мотор').selectOption('A')
  await expect(motor(page, 'Правый мотор').locator('option[value="A"]')).toHaveJSProperty('disabled', true)
  await motor(page, 'Правый мотор').selectOption('B')
  await expect(main.getByRole('heading', { name: 'Управление', exact: true })).toBeHidden()
  await motor(page, 'Слот программы').selectOption('19')
  await button(page, 'Подключить хаб').click()
  await expect(main.getByRole('alert')).toContainText('Выбор хаба отменён')
  await expect(status(page)).toHaveText('Не подключён')
  await connect(page)
  expect(hub.chooser).toEqual(Array(2).fill({ active: true, service: BLE_SERVICE }))
  await expect(main.getByText('Обнаружены моторы на портах A, B, C, D.')).toBeVisible()
  await expect(motor(page, 'Левый мотор')).toHaveValue('A')
  await expect(motor(page, 'Правый мотор')).toHaveValue('B')
  await page.getByText('Дополнительные моторы', { exact: true }).click()
  await motor(page, 'Захват').selectOption('C')
  await expect(motor(page, 'Правый мотор').locator('option[value="A"]')).toHaveJSProperty('disabled', true)
  await expect(motor(page, 'Подъёмник').locator('option[value="C"]')).toHaveJSProperty('disabled', true)
  await main.getByRole('heading', { name: 'Управление', exact: true }).click()
  await expect(main.locator('[aria-labelledby="drive-heading"]')).toBeFocused()
  await page.keyboard.down('KeyA')
  await expectSpeed([-20, -20])
  await page.keyboard.down('KeyD')
  await expectSpeed(zero)
  await page.keyboard.up('KeyA')
  await expectSpeed([20, 20])
  await page.keyboard.up('KeyD')
  await expectSpeed(zero)
  const reverseRight = page.getByRole('checkbox', { name: 'Инверсия · Правый мотор' })
  await expect(reverseRight).toBeChecked()
  await reverseRight.uncheck()
  await main.getByRole('heading', { name: 'Управление', exact: true }).click()
  await page.keyboard.down('KeyW')
  await expectSpeed([50, 50])
  await page.keyboard.up('KeyW')
  await expectSpeed(zero)
  await reverseRight.check()
  await button(page, 'Открыть').scrollIntoViewIfNeeded()
  await expect(button(page, 'Стоп')).toBeInViewport()
  await expect(button(page, 'Открыть')).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('desktop.png') })
  await main.getByRole('heading', { level: 1 }).click()
  await page.keyboard.down('KeyW')
  await expectSpeed([50, -50])
  await page.keyboard.down('KeyA')
  await expectSpeed([21, -50])
  await page.keyboard.down('KeyD')
  await expectSpeed([50, -50])
  await page.keyboard.up('KeyA')
  await expectSpeed([50, -21])
  await page.keyboard.down('KeyS')
  await expectSpeed([20, 20])
  await page.keyboard.up('KeyD')
  await expectSpeed(zero)
  await page.keyboard.up('KeyW')
  await expectSpeed([-50, 50])
  await page.keyboard.up('KeyS')
  await expectSpeed(zero)
  // Physical code, independent of the OS keyboard layout.
  await page.evaluate(() => dispatchEvent(new KeyboardEvent('keydown', { key: 'ф', code: 'KeyA' })))
  await expectSpeed([-20, -20])
  await motor(page, 'Левый мотор').focus()
  await expectSpeed(zero)
  await main.getByRole('heading', { level: 1 }).click()
  await page.keyboard.down('KeyW')
  await expectSpeed([50, -50])
  const open = button(page, 'Открыть')
  await open.hover()
  await page.mouse.down()
  await expectSpeed([50, -50, 100])
  await page.mouse.move(10, 350)
  await page.mouse.up()
  await expectSpeed([50, -50])
  await open.hover()
  await page.mouse.down()
  await page.mouse.move(10, 350)
  await expectSpeed([50, -50, 100])
  await button(page, 'Стоп').dispatchEvent('click')
  await expectSpeed(zero)
  await page.mouse.up()
  await page.keyboard.down('KeyW') // auto-repeat cannot re-arm a stopped controller
  await expectSpeed(zero)
  await page.keyboard.up('KeyW')
  await page.keyboard.down('KeyW')
  await expectSpeed([50, -50])
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await expectSpeed(zero)
  await page.keyboard.up('KeyW')
  await page.keyboard.down('KeyW')
  await expectSpeed([50, -50])
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expectSpeed(zero)
  await page.evaluate(() => Reflect.deleteProperty(document, 'hidden'))
  await page.keyboard.up('KeyW')
  await page.keyboard.down('KeyW')
  await expectSpeed([50, -50])
  await motor(page, 'Левый мотор').selectOption('D')
  await expectSpeed(zero)
  await page.keyboard.up('KeyW')
  await main.getByRole('heading', { level: 1 }).click()
  await page.keyboard.down('KeyW')
  await expectSpeed([0, -50, 0, 50])
  await button(page, 'Отключить').click()
  await expect(status(page)).toHaveText('Не подключён')
  expect(hub.events.slice(-3)).toEqual(['neutral', 'program stop', 'disconnect'])
  const start = hub.speeds.length
  await connect(page)
  await expectSpeed(zero)
  await page.keyboard.up('KeyW')
  expect(hub.speeds.slice(start).every((values) => !values.some(Boolean))).toBe(true)
  await page.keyboard.down('KeyW')
  await expectSpeed([0, -50, 0, 50])
  await page.evaluate(() => (window as unknown as { spikeDisconnect(): void }).spikeDisconnect())
  await expect(status(page)).toContainText('Связь потеряна')
  await expect(main.getByRole('heading', { name: 'Управление', exact: true })).toBeHidden()
  await expect(motor(page, 'Левый мотор')).toHaveValue('D')
  await page.keyboard.up('KeyW')
  await connect(page)
  await page.keyboard.down('KeyW')
  await expectSpeed([0, -50, 0, 50])
  await page.getByRole('link', { name: 'Мой путь', exact: true }).first().click()
  await expect(page).toHaveURL(/\/ru\/path$/)
  await expect.poll(() => hub.events.slice(-3)).toEqual(['neutral', 'program stop', 'disconnect'])
  expect(errors).toEqual([])
})

test('records a drive with a pause and concurrent mechanism, then saves and runs the same Python in FLL', async ({ page }) => {
  const hub = await emulateHub(page)
  await page.goto('/ru/controller')
  await expect(page.getByText(/Подключение заменяет его содержимое/)).toBeVisible()
  await connect(page)
  await assignDrive(page)
  await button(page, 'Начать запись').click()
  await page.getByRole('heading', { level: 1 }).click()
  await page.keyboard.down('KeyW')
  await expect.poll(() => hub.speeds.at(-1)).toEqual([50, -50, 0, 0, 0, 0])
  await page.waitForTimeout(130)
  await page.keyboard.up('KeyW')
  await expect.poll(() => hub.speeds.at(-1)).toEqual(zero)
  await page.waitForTimeout(140)
  await page.keyboard.down('KeyD')
  await expect.poll(() => hub.speeds.at(-1)).toEqual([20, 20, 0, 0, 0, 0])
  const mechanism = await button(page, 'Открыть').boundingBox()
  expect(mechanism).not.toBeNull()
  await page.mouse.move(mechanism!.x + mechanism!.width / 2, mechanism!.y + mechanism!.height / 2)
  await page.mouse.down()
  await expect.poll(() => hub.speeds.at(-1)).toEqual([20, 20, 100, 0, 0, 0])
  const startOfSave = hub.events.length
  await button(page, 'Завершить и сохранить в слот').dispatchEvent('click')
  await page.mouse.up()
  await page.keyboard.up('KeyD')
  await expect(page.getByText('Хаб подтвердил сохранение в слот 19.')).toBeVisible()
  expect(hub.events.slice(startOfSave)).toContain('neutral ack')
  expect(hub.events.indexOf('program stop')).toBeGreaterThan(hub.events.lastIndexOf('neutral ack'))
  expect(hub.events.lastIndexOf('slot:19')).toBeGreaterThan(hub.events.indexOf('program stop'))
  expect(hub.events.filter((event) => event === 'program start')).toHaveLength(1)
  expect(hub.events.filter((event) => event === 'slot:19')).toHaveLength(2)
  const code = hub.lastUpload()
  expect(code).toMatch(/drive\(port.A, 250\)\n +drive\(port.B, -250\)\n +await runloop.sleep_ms\(\d+\)\n +motor.stop\(port.A\)\n +motor.stop\(port.B\)\n +await runloop.sleep_ms\(\d+\)\n +drive\(port.A, 100\)/)
  expect(code).toContain('drive(port.C, 500)')
  await button(page, 'Открыть в FLL').click()
  await expect(page.getByText('Код Python открыт в новой программе FLL.', { exact: false })).toBeVisible({ timeout: 45_000 })
  await expect(page.getByText(/Левый мотор — A, Правый мотор — B, Захват — C/)).toBeVisible()
  const frame = page.frameLocator('iframe[src^="/fll-sim/index.html"]')
  await expect.poll(() => page.evaluate(() => {
    const programs = JSON.parse(localStorage.getItem('fll.bioglow.programs') ?? '[]')
    return programs[Number(localStorage.getItem('fll.bioglow.programs.current'))]?.code
  })).toBe(code)
  await frame.locator('#btnRun').click({ timeout: 45_000 })
  await expect(frame.locator('#console')).toContainText('Программа завершена', { timeout: 45_000 })
  await expect(frame.locator('#console .err')).toHaveCount(0)
})

for (const failure of ['refuse-upload', 'lose-upload', 'refuse-stop'] as const) {
  test(`keeps a completed route after ${failure} and retries without reinstalling the controller`, async ({ page }) => {
    const hub = await emulateHub(page)
    await page.goto('/ru/controller')
    await connect(page)
    await assignDrive(page)
    await button(page, 'Начать запись').click()
    await page.keyboard.down('KeyW')
    await expect.poll(() => hub.speeds.at(-1)).toEqual([50, -50, 0, 0, 0, 0])
    await page.waitForTimeout(120)
    await page.keyboard.up('KeyW')
    await expect.poll(() => hub.speeds.at(-1)).toEqual(zero)
    hub.failNext(failure)
    await button(page, 'Завершить и сохранить в слот').click()
    if (failure === 'lose-upload') {
      await expect.poll(() => hub.events.includes('chunk withheld')).toBe(true)
      await expect(button(page, 'Начать запись')).toBeDisabled()
      await page.evaluate(() => (window as unknown as { spikeDisconnect(): void }).spikeDisconnect())
    }
    await expect(page.getByText(failure === 'refuse-stop' ? /Хаб не подтвердил остановку/ : /Хаб не подтвердил сохранение/)).toBeVisible()
    await expect(page.getByText(/Хаб подтвердил сохранение/)).toHaveCount(0)
    await expect(button(page, 'Открыть в FLL')).toBeEnabled()
    if (failure === 'refuse-stop') expect(hub.events.filter((event) => event === 'slot:19')).toHaveLength(1)
    if (failure === 'lose-upload') {
      await button(page, 'Открыть в FLL').click()
      await expect(page.getByText(/Код Python открыт в новой программе FLL/)).toBeVisible({ timeout: 45_000 })
      await page.goBack()
    }
    await button(page, 'Повторить сохранение в слот 19').click()
    await expect(page.getByText('Хаб подтвердил сохранение в слот 19.')).toBeVisible()
    expect(hub.chooser).toHaveLength(2)
    expect(hub.events.filter((event) => event === 'program start')).toHaveLength(1)
    expect(hub.lastUpload()).toContain('runloop.run(main())')
  })
}

test('does not upload an empty or interrupted route and brakes during focus loss', async ({ page }) => {
  const hub = await emulateHub(page)
  await page.goto('/ru/controller')
  await connect(page)
  await assignDrive(page)
  await button(page, 'Начать запись').click()
  await button(page, 'Завершить и сохранить в слот').click()
  await expect(page.getByText(/В записи нет подтверждённого движения/)).toBeVisible()
  await button(page, 'Начать запись').click()
  await page.keyboard.down('KeyW')
  await expect.poll(() => hub.speeds.at(-1)).toEqual([50, -50, 0, 0, 0, 0])
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await expect.poll(() => hub.speeds.at(-1)).toEqual(zero)
  await page.keyboard.up('KeyW')
  await expect(button(page, 'Завершить и сохранить в слот')).toBeEnabled()
  await button(page, 'Стоп').dispatchEvent('click')
  await expect(page.getByText(/Запись прервана/)).toBeVisible()
  await button(page, 'Начать запись').click()
  hub.dropAck()
  await page.keyboard.down('KeyW')
  await expect(page.getByText(/Запись прервана/)).toBeVisible()
  await page.keyboard.up('KeyW')
  expect(hub.events.filter((event) => event === 'slot:19')).toHaveLength(1)
  await expect(button(page, 'Открыть в FLL')).toHaveCount(0)
})

test('rejects another model and stops accepting input when the bridge stops replying', async ({ page }) => {
  const hub = await emulateHub(page, { unsupportedFirst: true })
  await page.goto('/ru/controller')
  await motor(page, 'Слот программы').selectOption('19')
  await button(page, 'Подключить хаб').click()
  await expect(page.locator('main').getByRole('alert')).toContainText('Нужен LEGO SPIKE Prime')
  await expect.poll(() => hub.events).toEqual(['disconnect'])
  await connect(page)
  await assignDrive(page)
  await page.getByRole('heading', { level: 1 }).click()
  await page.keyboard.down('KeyW')
  await expect.poll(() => hub.speeds.at(-1)).toEqual([50, -50, 0, 0, 0, 0])
  hub.dropAck()
  await expect(status(page)).toContainText('Связь потеряна')
  await expect(button(page, 'Подключить хаб')).toBeEnabled()
})

test('waits for a slow hub program without sending movement or uploading twice', async ({ page }) => {
  const hub = await emulateHub(page, { missedBootProbes: 2 })
  await page.goto('/ru/controller')
  await connect(page)
  expect(hub.speeds.slice(0, 3)).toEqual([zero, zero, zero])
  expect(hub.events.filter((event) => event === 'program start')).toEqual(['program start'])
  expect(hub.events.filter((event) => event === 'slot:19')).toEqual(['slot:19'])
})

test('reports a Bluetooth connection failure before attempting an upload', async ({ page }) => {
  const hub = await emulateHub(page, { gattFails: true })
  await page.goto('/ru/controller')
  await motor(page, 'Слот программы').selectOption('19')
  await button(page, 'Подключить хаб').click()
  await expect(page.locator('main').getByRole('alert')).toContainText('BT-GATT')
  await expect(button(page, 'Подключить хаб')).toBeEnabled()
  expect(hub.events).toEqual([])
})

test('recovers BT-CONTROL with console acknowledgements and drives all directions', async ({ page }) => {
  const hub = await emulateHub(page, { consoleOnly: true })
  await page.goto('/ru/controller')
  await motor(page, 'Левый мотор').selectOption('A')
  await motor(page, 'Правый мотор').selectOption('B')
  await connect(page)
  expect(hub.modes.slice(0, 5)).toEqual([CONTROLLER_COMMAND, CONTROLLER_COMMAND, CONTROLLER_COMMAND, CONTROLLER_COMMAND, CONSOLE_COMMAND])
  const drive = page.getByRole('heading', { name: 'Управление', exact: true })
  await drive.click()
  for (const [key, left, right] of [['KeyW', 50, -50], ['KeyS', -50, 50], ['KeyA', -20, -20], ['KeyD', 20, 20]] as const) {
    await page.keyboard.down(key)
    await expect.poll(() => hub.speeds.at(-1)).toEqual([left, right, 0, 0, 0, 0])
    await page.keyboard.up(key)
    await expect.poll(() => hub.speeds.at(-1)).toEqual(zero)
  }
  await button(page, 'Отключить').click()
  await expect(status(page)).toHaveText('Не подключён')
  expect(hub.events.slice(-3)).toEqual(['neutral', 'program stop', 'disconnect'])
})

test('keeps drive disabled and shows the startup log when neither channel answers', async ({ page }) => {
  const hub = await emulateHub(page, { bootLog: 'RuntimeError: tunnel callback unavailable\n' })
  hub.dropAck()
  await page.goto('/ru/controller')
  await motor(page, 'Левый мотор').selectOption('A')
  await motor(page, 'Правый мотор').selectOption('B')
  await motor(page, 'Слот программы').selectOption('19')
  await button(page, 'Подключить хаб').click()
  const alert = page.locator('main').getByRole('alert')
  await expect(alert).toContainText('BT-CONTROL')
  await expect(alert).toContainText('RuntimeError: tunnel callback unavailable')
  await expect(page.getByRole('heading', { name: 'Управление', exact: true })).toBeHidden()
  expect(hub.speeds).toHaveLength(8)
  expect(hub.speeds.every((speeds) => speeds.every((speed) => speed === 0))).toBe(true)
})

for (const reply of ['fault', 'timeout'] as const) {
  test(`recovers from the first movement ${reply} without disconnecting or replaying input`, async ({ page }) => {
    const hub = await emulateHub(page, { firstMotorReply: reply, consoleOnly: reply === 'fault' })
    await page.goto('/ru/controller')
    await motor(page, 'Левый мотор').selectOption('A')
    await motor(page, 'Правый мотор').selectOption('B')
    await connect(page)
    await page.getByRole('heading', { name: 'Управление', exact: true }).click()
    await page.keyboard.down('KeyW')
    const alert = page.locator('main').getByRole('alert')
    await expect(alert).toContainText(reply === 'fault' ? 'B: ENODEV' : 'Хаб не подтвердил команду вовремя')
    await expect.poll(() => hub.speeds.at(-1)).toEqual(zero)
    await expect(status(page)).toContainText('Подключён')
    expect(hub.events.filter((event) => event === 'move')).toHaveLength(1)
    await page.keyboard.up('KeyW')
    if (reply === 'fault') {
      await expect(motor(page, 'Правый мотор')).toHaveAttribute('aria-invalid', 'true')
      await motor(page, 'Правый мотор').selectOption('D')
      await page.getByRole('heading', { name: 'Управление', exact: true }).click()
    }
    await page.keyboard.down('KeyA')
    await expect.poll(() => hub.speeds.at(-1)).toEqual(reply === 'fault' ? [-20, 0, 0, -20, 0, 0] : [-20, -20, 0, 0, 0, 0])
    await page.keyboard.up('KeyA')
    await expect.poll(() => hub.speeds.at(-1)).toEqual(zero)
    await page.keyboard.down('KeyD')
    await expect.poll(() => hub.speeds.at(-1)).toEqual(reply === 'fault' ? [20, 0, 0, 20, 0, 0] : [20, 20, 0, 0, 0, 0])
    await page.keyboard.up('KeyD')
    await expect.poll(() => hub.speeds.at(-1)).toEqual(zero)
    await button(page, 'Отключить').click()
    await expect(status(page)).toHaveText('Не подключён')
    expect(hub.chooser).toHaveLength(1)
  })
}

test('blocks a missing motor on port D before motion and drives after choosing a detected port', async ({ page }) => {
  const hub = await emulateHub(page, { programPorts: 'AB' })
  await page.goto('/ru/controller')
  await motor(page, 'Левый мотор').selectOption('A')
  await motor(page, 'Правый мотор').selectOption('D')
  await connect(page)
  await expect(page.getByText('Обнаружены моторы на портах A, B.')).toBeVisible()
  await expect(page.getByText('В порту D мотор не обнаружен.', { exact: false })).toBeVisible()
  await expect(motor(page, 'Правый мотор').locator('option[value="D"]')).toHaveJSProperty('disabled', true)
  await page.getByRole('heading', { name: 'Управление', exact: true }).click()
  await page.keyboard.down('KeyW')
  await expect(page.getByRole('img', { name: 'Джойстик движения' })).toHaveAttribute('aria-disabled', 'true')
  await expect.poll(() => hub.speeds.length).toBeGreaterThan(1)
  expect(hub.events).not.toContain('move')
  await page.keyboard.up('KeyW')
  await motor(page, 'Правый мотор').selectOption('B')
  await page.getByRole('heading', { name: 'Управление', exact: true }).click()
  await page.keyboard.down('KeyW')
  await expect.poll(() => hub.speeds.at(-1)).toEqual([50, -50, 0, 0, 0, 0])
  await page.keyboard.up('KeyW')
  await expect.poll(() => hub.speeds.at(-1)).toEqual(zero)
  expect(hub.chooser).toHaveLength(1)
})

test('reacts to an unplugged motor on port D and waits for fresh input after the cable is restored', async ({ page }) => {
  const hub = await emulateHub(page, { programPorts: 'AD' })
  await page.goto('/ru/controller')
  await motor(page, 'Левый мотор').selectOption('A')
  await motor(page, 'Правый мотор').selectOption('D')
  await connect(page)
  await page.getByRole('heading', { name: 'Управление', exact: true }).click()
  await page.keyboard.down('KeyW')
  await expect.poll(() => hub.speeds.at(-1)).toEqual([50, 0, 0, -50, 0, 0])
  await hub.reportPorts('A')
  await expect.poll(() => hub.speeds.at(-1)).toEqual(zero)
  await expect(motor(page, 'Правый мотор')).toHaveAttribute('aria-invalid', 'true')
  const afterStop = hub.speeds.length
  await hub.reportPorts('AD')
  await expect(motor(page, 'Правый мотор')).toHaveAttribute('aria-invalid', 'false')
  await expect.poll(() => hub.speeds.length).toBeGreaterThan(afterStop)
  expect(hub.speeds.slice(afterStop).every((speeds) => speeds.every((speed) => speed === 0))).toBe(true)
  await page.keyboard.up('KeyW')
  await page.keyboard.down('KeyD')
  await expect.poll(() => hub.speeds.at(-1)).toEqual([20, 0, 0, 20, 0, 0])
  await page.keyboard.up('KeyD')
  await expect.poll(() => hub.speeds.at(-1)).toEqual(zero)
})

test('edits drive and turn speeds for keyboard and joystick and requires fresh input after edits', async ({ page }) => {
  const hub = await emulateHub(page)
  await page.goto('/ru/controller')
  await motor(page, 'Левый мотор').selectOption('A')
  await motor(page, 'Правый мотор').selectOption('B')
  const driveSpeed = page.getByRole('spinbutton', { name: 'Скорость движения', exact: true })
  const turnSpeed = page.getByRole('spinbutton', { name: 'Скорость поворота', exact: true })
  const setSpeed = async (field: typeof driveSpeed, value: string) => {
    await field.fill(value)
    await field.press('Enter')
  }
  await expect(driveSpeed).toHaveValue('50')
  await expect(turnSpeed).toHaveValue('20')
  await setSpeed(driveSpeed, '150')
  await setSpeed(turnSpeed, '10')
  await expect(driveSpeed).toHaveValue('100')
  await connect(page)
  const heading = page.getByRole('heading', { name: 'Управление', exact: true })
  const portA = page.locator('[aria-labelledby="drive-heading"] li').first()
  const expectSpeed = (a: number, b: number) => expect.poll(() => hub.speeds.at(-1)).toEqual([a, b, 0, 0, 0, 0])
  await heading.click()
  await page.keyboard.down('KeyW')
  await expectSpeed(100, -100)
  await expect(portA).toContainText('+100%')
  await setSpeed(driveSpeed, '10')
  await expectSpeed(0, 0)
  await expect(portA).toHaveText('A0%')
  await heading.click()
  await page.keyboard.down('KeyW')
  await expectSpeed(0, 0)
  await page.keyboard.up('KeyW')
  await page.keyboard.down('KeyS')
  await expectSpeed(-10, 10)
  await page.keyboard.up('KeyS')
  await page.keyboard.down('KeyA')
  await expectSpeed(-10, -10)
  await page.keyboard.up('KeyA')
  await expectSpeed(0, 0)
  await setSpeed(driveSpeed, '0')
  await setSpeed(turnSpeed, '100')
  await setSpeed(turnSpeed, '')
  await expect(turnSpeed).toHaveValue('100')
  const stick = page.getByRole('img', { name: 'Джойстик движения' })
  await stick.scrollIntoViewIfNeeded()
  const { x, y, width, height } = (await stick.boundingBox())!
  await page.mouse.move(x + width / 2, y + height * 0.1)
  await page.mouse.down()
  await expectSpeed(0, 0)
  await page.mouse.move(x + width * 0.9, y + height / 2)
  await expectSpeed(100, 100)
  await page.mouse.up()
  await expectSpeed(0, 0)
})

test('configures four mechanisms before Bluetooth and operates each on its own port', async ({ page }) => {
  const hub = await emulateHub(page, { programPorts: 'ABCDEF' })
  await page.goto('/ru/controller')
  await motor(page, 'Левый мотор').selectOption('A')
  await motor(page, 'Правый мотор').selectOption('B')
  await page.getByText('Дополнительные моторы', { exact: true }).click()
  await expect(motor(page, 'Захват').locator('option[value="A"]')).toHaveJSProperty('disabled', true)
  const mechanisms = [
    { label: 'Захват', port: 'C', direction: 'Открыть', reverse: 'Закрыть' },
    { label: 'Подъёмник', port: 'D', direction: 'Поднять', reverse: 'Опустить' },
    { label: 'Механизм 3', port: 'E', direction: 'По часовой', reverse: 'Против часовой' },
    { label: 'Механизм 4', port: 'F', direction: 'По часовой', reverse: 'Против часовой' },
  ]
  for (const { label, port } of mechanisms) await motor(page, label).selectOption(port)
  await expect(motor(page, 'Механизм 4').locator('option[value="E"]')).toHaveJSProperty('disabled', true)
  await connect(page)
  await page.getByRole('heading', { name: 'Управление', exact: true }).click()
  await page.keyboard.down('KeyW')
  const drive = [50, -50, 0, 0, 0, 0]
  for (const [index, { label, port, direction, reverse }] of mechanisms.entries()) {
    const group = page.getByRole('group', { name: `${label} · ${port}`, exact: true })
    for (const [name, speed] of [[direction, 100], [reverse, -100]] as const) {
      await group.getByRole('button', { name, exact: true }).hover()
      await page.mouse.down()
      const expected = [...drive]
      expected[index + 2] = speed
      await expect.poll(() => hub.speeds.at(-1)).toEqual(expected)
      await page.mouse.up()
      await expect.poll(() => hub.speeds.at(-1)).toEqual(drive)
    }
  }
  await page.keyboard.up('KeyW')
  await expect.poll(() => hub.speeds.at(-1)).toEqual(zero)
})

test('phone layout supports two independent touch pointers and a visible stop', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ ...devices['Pixel 7'], baseURL: url, reducedMotion: 'reduce' })
  try {
    const page = await context.newPage()
    const hub = await emulateHub(page)
    await page.goto('/ru')
    await page.locator('.menu-toggle').click()
    await page.getByRole('link', { name: 'Контроллер робота', exact: true }).click()
    await connect(page)
    await assignDrive(page)
    const stop = button(page, 'Стоп')
    await expect(stop).toBeInViewport()
    const stick = page.getByRole('img', { name: 'Джойстик движения' })
    const grip = button(page, 'Открыть')
    const close = button(page, 'Закрыть')
    await grip.scrollIntoViewIfNeeded()
    const j = (await stick.boundingBox())!
    const g = (await grip.boundingBox())!
    const c = (await close.boundingBox())!
    expect(g.height).toBeGreaterThanOrEqual(44)
    expect(c.height).toBeGreaterThanOrEqual(44)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(412)
    const cdp = await context.newCDPSession(page)
    const joystick = { x: j.x + j.width / 2, y: j.y + j.height / 2, id: 11 }
    const gripper = { x: g.x + g.width / 2, y: g.y + g.height / 2, id: 22 }
    const opposite = { x: c.x + c.width / 2, y: c.y + c.height / 2, id: 33 }
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', touchPoints: typeof joystick[]) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints })
    const expectSpeed = (values: number[]) => expect.poll(() => hub.speeds.at(-1)).toEqual([...values, ...zero.slice(values.length)])

    await touch('touchStart', [joystick])
    await expectSpeed(zero)
    const mid = { ...joystick, y: joystick.y - j.height * 0.196 }
    await touch('touchMove', [mid])
    await expect.poll(() => hub.speeds.at(-1)?.[0]).toBeGreaterThan(0)
    expect(hub.speeds.at(-1)?.[0]).toBeLessThan(50)
    const full = { ...joystick, y: joystick.y - j.height * 0.4 }
    await touch('touchMove', [full])
    await expectSpeed([50, -50])
    await touch('touchMove', [{ ...joystick, y: joystick.y + j.height * 0.4 }])
    await expectSpeed([-50, 50])
    await touch('touchMove', [{ ...joystick, x: joystick.x - j.width * 0.4 }])
    await expectSpeed([-20, -20])
    await touch('touchMove', [{ ...joystick, x: joystick.x + j.width * 0.4 }])
    await expectSpeed([20, 20])
    await touch('touchMove', [full])
    await expectSpeed([50, -50])
    await touch('touchStart', [full, gripper])
    await expectSpeed([50, -50, 100])
    await touch('touchStart', [full, gripper, opposite])
    await expectSpeed([50, -50, 0])
    await touch('touchEnd', [opposite])
    await expectSpeed([50, -50, 100])
    await touch('touchEnd', [full])
    await expectSpeed([0, 0, 100])
    await touch('touchStart', [gripper, full])
    await expectSpeed([50, -50, 100])
    await touch('touchEnd', [gripper])
    await expectSpeed([50, -50, 0])
    await touch('touchCancel', [])
    await expectSpeed(zero)
    await touch('touchStart', [gripper])
    await expectSpeed([0, 0, 100])
    await touch('touchCancel', [])
    await expectSpeed(zero)
    await expect(stop).toBeInViewport()
    await page.screenshot({ path: testInfo.outputPath('phone.png') })
  } finally {
    await context.close()
  }
})
