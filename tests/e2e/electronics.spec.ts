import { expect, test } from '@playwright/test'

/**
 * The Electronics section: the hub, a lab mission solved with the reference
 * circuit and code (the checker marks the goals and the mission as done),
 * a compile error with its line, and the Uno page without relying on WebGL.
 */

test('a lab mission: build the circuit, load the solution, run, goals met', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('dialog', (d) => d.accept())
  await page.goto('/ru/electronics')
  await expect(page.getByRole('heading', { name: 'Электроника', level: 1 })).toBeVisible()
  await page.getByRole('link', { name: 'Свой светодиод' }).click()
  await expect(page).toHaveURL(/\/ru\/electronics\/lab\?mission=led$/)
  const card = page.getByTestId('mission-card')
  await expect(card.getByRole('heading', { name: 'Свой светодиод' })).toBeVisible()

  await card.getByRole('button', { name: 'Собрать схему за меня' }).click()
  await card.getByRole('button', { name: 'Показать решение' }).click()
  await expect(page.locator('[data-wire]')).toHaveCount(3)
  await page.getByTestId('run').click()
  await expect(page.getByTestId('status')).toHaveText('Работает')
  // The LED blinks every half second: three goals within a few seconds.
  await expect(card.locator('[data-met="true"]')).toHaveCount(3, { timeout: 15_000 })
  await expect(page.getByRole('button', { name: /Свой светодиод/ }).locator('svg')).toBeVisible()
  await page.getByRole('button', { name: 'Стоп' }).click()
  await expect(page.getByTestId('status')).toHaveText('Остановлено')

  // The hub remembers the finished mission.
  await page.goto('/ru/electronics')
  await expect(page.getByRole('listitem').filter({ hasText: 'Свой светодиод' }).getByText('Готово')).toBeVisible()
  expect(errors).toEqual([])
})

test('a mistake in the code is shown with its line, in plain words', async ({ page }) => {
  await page.goto('/ru/electronics/lab')
  await expect(page.getByTestId('code-editor').locator('.cm-content')).toBeVisible()
  await page.getByTestId('code-editor').locator('.cm-content').click()
  await page.keyboard.press('Control+A')
  await page.keyboard.insertText('void setup() {\n  pinmode(13, OUTPUT);\n}\nvoid loop() {}\n')
  await page.getByTestId('run').click()
  await expect(page.getByTestId('code-error')).toContainText('Строка 2')
  await expect(page.getByTestId('code-error')).toContainText('pinmode')
  await expect(page.getByTestId('status')).toHaveText('Ошибка в коде')
})

test('the Uno page: parts, pinout and specifications', async ({ page }) => {
  await page.goto('/en/electronics/uno')
  await expect(page.getByRole('heading', { name: 'Arduino Uno in 3D' })).toBeVisible()
  await page.getByRole('button', { name: '16 MHz crystal' }).click()
  await expect(page.getByRole('tabpanel').getByText('16 million oscillations a second')).toBeVisible()
  await page.getByRole('tab', { name: 'Pinout' }).click()
  await expect(page.getByText('A4 is SDA and A5 is SCL')).toBeVisible()
  await page.getByRole('tab', { name: 'Specifications' }).click()
  await expect(page.getByRole('row', { name: /Clock speed/ })).toContainText('16 MHz')
})

test('ESP32: the 3D page and the lab with the board switched', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/ru/electronics/esp32')
  await expect(page.getByRole('heading', { name: 'ESP32 DevKit в 3D' })).toBeVisible()
  await page.getByRole('button', { name: 'Антенна на плате' }).click()
  await expect(page.getByRole('tabpanel').getByText('дорожка-змейка')).toBeVisible()
  await page.getByRole('tab', { name: 'Распиновка' }).click()
  await expect(page.getByText('Только вход: нет выхода и подтяжки')).toBeVisible()

  await page.getByRole('link', { name: 'В лаборатории' }).first().click()
  await expect(page).toHaveURL(/\/ru\/electronics\/lab\?board=esp32$/)
  await expect(page.locator('[data-board="esp32"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-terminal="esp.G2"]')).toHaveCount(1)
  await page.getByTestId('run').click()
  await expect(page.getByTestId('status')).toHaveText('Работает')
  // Back to the Uno: its own bench and pins.
  await page.locator('[data-board="uno"]').click()
  await expect(page.locator('[data-terminal="uno.D13"]')).toHaveCount(1)
  await expect(page.getByTestId('status')).toHaveText('Остановлено')
  expect(errors).toEqual([])
})

test('lessons: the Arduino tab and a circuit step solved by wiring', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  // A new learner meets the path picker; electronics opens from the card under it, no path needed.
  await page.goto('/ru/learn')
  await page.getByTestId('pick-electronics').click()
  await expect(page).toHaveURL(/family=arduino/)
  await expect(page.getByTestId('tab-arduino')).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('heading', { name: 'Электричество с нуля' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Arduino: первые программы' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Что такое робот' })).toHaveCount(0)

  await page.goto('/ru/learn/electricity/elec-02')
  await page.getByRole('button', { name: 'Всё равно открыть' }).click()
  await page.getByRole('button', { name: 'Начать урок' }).click()
  const next = page.getByRole('button', { name: 'Дальше' })
  await next.click()
  await next.click()
  await page.getByText('Цепь где-то разорвана').click()
  await page.getByRole('button', { name: 'Проверить' }).click()
  await next.click()
  const step = page.getByTestId('circuit-step')
  await expect(step).toBeVisible()
  for (const terminal of ['uno.5V', 'bb.b10', 'bb.b15', 'uno.GND.1']) {
    const el = step.locator(`[data-terminal="${terminal}"]`)
    await el.evaluate((n) => n.scrollIntoView({ block: 'center' }))
    const box = (await el.boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  }
  await expect(step.locator('[data-wire]')).toHaveCount(2)
  await page.getByTestId('circuit-run').click()
  await expect(page.getByTestId('circuit-done')).toBeVisible({ timeout: 15_000 })
  await expect(next).toBeEnabled()
  expect(errors).toEqual([])
})
