import { type Page, expect, test } from '@playwright/test'

import { next, onboard } from './helpers'

test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } })

/** Opens a lesson that is still locked, reads the theory and answers its one question. */
async function openTask(page: Page, lesson: string, answer: string) {
  await page.goto(`/ru/learn/ai-basics/${lesson}`)
  await page.getByRole('button', { name: 'Всё равно открыть' }).click()
  await page.getByRole('button', { name: /Начать урок|Продолжить урок/ }).click()
  await next(page)
  await page.getByRole('radio', { name: answer }).click()
  await page.getByRole('button', { name: 'Проверить' }).click()
  await next(page)
}

test('the section is a tab next to lessons and its first lesson is open', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the header is for wide screens')
  await onboard(page, 'Искра', '16+')
  await page.getByRole('banner').getByRole('link', { name: 'ИИ с нуля' }).click()
  await expect(page).toHaveURL(/\/ru\/learn\/ai-basics$/)
  await expect(page.getByRole('banner').getByRole('link', { name: 'ИИ с нуля' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByText('Что умеет ИИ').first()).toBeVisible()
})

test('vibe coding runs the game in a closed frame', async ({ page }) => {
  await page.route('**/api/vibe', (route) =>
    route.fulfill({
      json: { ok: true, title: 'Игра', html: '<!doctype html><html><head></head><body><h1 id="x">Игра работает</h1></body></html>', remaining: 4 },
    }),
  )
  await onboard(page, 'Вайб', '16+')
  await openTask(page, 'ai-11', 'Правила и условие победы')

  await page.getByLabel('Опиши игру или страничку').fill('Круг убегает от курсора')
  await page.getByRole('button', { name: 'Собрать' }).click()
  const frame = page.getByTestId('vibe-frame')
  await expect(frame).toHaveAttribute('sandbox', 'allow-scripts')
  await expect(page.frameLocator('[data-testid=vibe-frame]').getByRole('heading', { name: 'Игра работает' })).toBeVisible()
  await expect(page.getByText('Готово! Можно идти дальше.')).toBeVisible()
})

test('gestures train on a camera picture and never touch the network', async ({ page }) => {
  await onboard(page, 'Жест', '16+')
  const sent: string[] = []
  page.on('request', (r) => {
    if (r.method() === 'POST') sent.push(r.url())
  })
  await openTask(page, 'ai-18', 'Модель будет часто ошибаться')

  await page.getByRole('button', { name: 'Включить камеру' }).click()
  await expect(page.getByRole('button', { name: 'Запомнить: Ладонь' })).toBeEnabled({ timeout: 15_000 })
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: 'Запомнить: Ладонь' }).dispatchEvent('pointerdown')
  await page.getByRole('button', { name: 'Запомнить: Ладонь' }).dispatchEvent('pointerup')
  await page.getByRole('button', { name: 'Запомнить: Кулак' }).dispatchEvent('pointerdown')
  await page.getByRole('button', { name: 'Запомнить: Кулак' }).dispatchEvent('pointerup')
  await expect(page.getByTestId('count-palm')).toContainText('1 / 3')
  await expect(page.getByTestId('count-fist')).toContainText('1 / 3')
  await expect(page.getByTestId('prediction')).toBeVisible()
  await expect(page.getByText('Готово! Можно идти дальше.')).toBeVisible({ timeout: 15_000 })
  expect(sent.filter((u) => u.includes('/api/'))).toEqual([])
})

test('the colour sorter learns from samples without a robot', async ({ page }) => {
  await onboard(page, 'Цвет', '16+')
  await openTask(page, 'ai-17', 'Три числа: красный, зелёный, синий')

  for (const [swatch, label] of [
    ['A', 'Красный'],
    ['B', 'Красный'],
    ['F', 'Красный'],
    ['C', 'Синий'],
    ['D', 'Синий'],
    ['E', 'Синий'],
  ]) {
    await page.getByRole('button', { name: `Образец ${swatch}` }).click()
    await page.getByRole('button', { name: `Это: ${label}` }).click()
  }
  await page.getByRole('button', { name: 'Образец A' }).click()
  await expect(page.getByTestId('color-prediction')).toContainText('Красный')
  await page.getByRole('button', { name: 'Образец C' }).click()
  await expect(page.getByTestId('color-prediction')).toContainText('Синий')
  await page.getByRole('button', { name: 'Образец D' }).click()
  await expect(page.getByText('Готово! Можно идти дальше.')).toBeVisible()
})
