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

test('Arduino Uno lessons open the matching wired examples and sketches', async ({ page }) => {
  for (const { title, mission, code, wires } of [
    { title: 'Свой светодиод', mission: 'led', code: 'digitalWrite(LED, HIGH)', wires: 3 },
    { title: 'Кнопка', mission: 'button', code: 'digitalRead(BUTTON)', wires: 5 },
    { title: 'PWM', mission: 'dimmer', code: 'analogWrite(9, brightness)', wires: 7 },
    { title: 'Serial', mission: 'radar', code: 'Serial.println(cm)', wires: 4 },
  ]) {
    await page.goto('/ru/learn')
    const lessons = page.getByRole('region', { name: 'Arduino Uno' })
    await lessons.getByRole('link', { name: `Открыть лабораторию ${title}` }).click()
    await expect(page).toHaveURL(`/ru/electronics/lab?mission=${mission}&setup=example`)
    await expect(page.getByTestId('mission-card')).toBeVisible()
    await expect(page.getByTestId('code-editor').locator('.cm-content')).toContainText(code)
    await expect(page.locator('[data-wire]')).toHaveCount(wires)
  }
})

test('Serial reflects a sketch edit and a disconnected sensor wire', async ({ page }) => {
  const editor = page.getByTestId('code-editor').locator('.cm-content')
  const serial = page.getByTestId('serial')

  await page.goto('/ru/electronics/lab?mission=radar')
  await expect(page.getByTestId('mission-card').getByRole('heading', { name: 'Парктроник' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('roboeasy:electronics:v1'))).toContain('"radar":')

  await page.goto('/ru/learn')
  await page.getByRole('link', { name: 'Открыть лабораторию Serial' }).click()
  await expect(editor).toContainText('Serial.println(cm)')
  await page.getByTestId('run').click()
  await expect(serial).toContainText('40')
  await page.getByRole('button', { name: 'Стоп' }).click()

  const sketch = (await editor.innerText()).replace('Serial.println(cm);', 'Serial.print("distance: ");\n  Serial.println(cm);')
  await editor.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.insertText(sketch)
  await page.getByTestId('run').click()
  await expect(serial).toContainText('distance: 40')

  // The visible stroke is a curved SVG path. Click its midpoint to select the wire.
  const echo = page.locator('[data-wire="w-u1.echo-uno.D8"] path').last()
  await echo.scrollIntoViewIfNeeded()
  const midpoint = await echo.evaluate((element: SVGPathElement) => {
    const point = element.getPointAtLength(element.getTotalLength() / 2)
    const { x, y } = point.matrixTransform(element.getScreenCTM()!)
    return { x, y }
  })
  await page.mouse.click(midpoint.x, midpoint.y)
  await page.getByRole('button', { name: 'Удалить (Del)', exact: true }).click()
  await expect(page.locator('[data-wire]')).toHaveCount(3)
  await expect(serial).toContainText('distance: 0')

  await page.reload()
  await expect(editor).toContainText('distance:')
  await expect(page.locator('[data-wire]')).toHaveCount(3)

  await page.goto('/ru/electronics/lab?mission=radar')
  await expect(page.getByTestId('mission-card')).toBeVisible()
  await expect(editor).not.toContainText('distance:')
  await expect(page.locator('[data-wire]')).toHaveCount(0)
})

test('the Uno page: parts, pinout and specifications', async ({ page }) => {
  await page.goto('/en/electronics/uno')
  await expect(page.getByRole('heading', { name: 'Arduino Uno in 3D' })).toBeVisible()
  await page.getByRole('button', { name: '16 MHz crystal' }).click()
  await expect(page.getByText('16 million oscillations a second')).toBeVisible()
  await page.getByRole('tab', { name: 'Pinout' }).click()
  await expect(page.getByText('A4 is SDA and A5 is SCL')).toBeVisible()
  await page.getByRole('tab', { name: 'Specifications' }).click()
  await expect(page.getByRole('row', { name: /Clock speed/ })).toContainText('16 MHz')
})
