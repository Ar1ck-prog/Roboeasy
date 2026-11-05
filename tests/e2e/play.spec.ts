import { expect, test } from '@playwright/test'

import { onboard } from './helpers'

/**
 * Self-paced practice and the robot buddy: a maze level and a program
 * puzzle earn coins, the garage sells an accessory, and the buddy wears it.
 */

test('games earn coins that buy an accessory in the garage', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await onboard(page, 'Gamer', '16+')

  // Maze, level 1: four steps forward.
  await page.goto('/ru/play/maze')
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Вперёд', exact: true }).click()
  await page.getByRole('button', { name: 'Запустить' }).click()
  await expect(page.getByText('Финиш!')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/\+\d+ монет · \+\d+ XP/)).toBeVisible()
  await expect(page.getByText('Уровень 1 ·')).toBeVisible()

  // Program puzzle, level 1: lines in order.
  await page.goto('/ru/play/puzzle')
  const pool = page.getByTestId('puzzle-pool')
  for (const line of ['Когда программа запущена', 'Едь вперёд 40 см', 'Остановись', 'Сыграй звук «бип»']) await pool.getByRole('button', { name: line }).click()
  await page.getByRole('button', { name: 'Проверить' }).click()
  await expect(page.getByText('Программа собрана верно!')).toBeVisible()

  // Garage: buy and wear the antenna (two taps: buy, then confirm).
  await page.goto('/ru/garage')
  const coins = Number((await page.getByTestId('coins').innerText()).replace(/\D/g, ''))
  expect(coins).toBeGreaterThan(50)
  await page.getByRole('button', { name: 'Внешний вид' }).click()
  const antenna = page.getByRole('listitem').filter({ hasText: 'Антенна' })
  await antenna.getByRole('button', { name: /Купить/ }).click()
  await antenna.getByRole('button', { name: 'Точно купить?' }).click()
  await expect(antenna.getByText('Надето')).toBeVisible()
  // 40 for the antenna; the "First purchase" achievement may already have paid 15 back.
  await expect(page.getByTestId('coins')).toHaveText(new RegExp(`^(${coins - 40}|${coins - 25})\\D`))

  // The path shows today's quests.
  await page.goto('/ru/path')
  await expect(page.getByTestId('quests').getByRole('heading', { name: 'Задания дня' })).toBeVisible()

  expect(errors).toEqual([])
})
