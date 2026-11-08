import { expect, test } from '@playwright/test'

import { closeAchievements, loadProgram, next } from './helpers'

/**
 * A new learner's first two days: onboarding → placement test → first
 * lesson with an autocheck → XP → achievement → next day's lesson keeps
 * the streak. Dates are fixed in Asia/Almaty; the AI mentor is mocked.
 */

const DAY1 = new Date('2026-10-20T10:00:00+05:00')
const DAY2 = new Date('2026-10-21T09:30:00+05:00')

test('new learner: placement, first lesson, XP, achievement, streak next day', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.clock.setFixedTime(DAY1)
  await page.route('**/api/learn/mentor', (route) =>
    route.fulfill({ json: { ok: true, hint: 'Посчитай клетки до финиша: одна клетка — 10 см.', source: 'ai', remaining: 29 } }),
  )

  // Onboarding
  await page.goto('/ru/path')
  await expect(page.getByRole('heading', { name: 'Давай знакомиться' })).toBeVisible()
  await page.getByLabel('Ник', { exact: true }).fill('TestBot')
  await page.getByText('13–15', { exact: true }).click()
  await expect(page.getByRole('button', { name: 'Поехали!' })).toBeDisabled() // grown-up consent first
  await page.getByRole('checkbox', { name: /Я взрослый/ }).check()
  await page.getByRole('button', { name: 'Поехали!' }).click()

  // Placement: answer every question (numbers deliberately wrong), see the result
  await page.getByRole('link', { name: 'Тест на уровень' }).click()
  await page.getByRole('button', { name: 'Начать' }).click()
  for (let i = 0; i < 11; i++) {
    await expect(page.getByText(`Вопрос ${i + 1} из 11`)).toBeVisible()
    const number = page.locator('main input[inputmode=decimal]')
    if (await number.count()) {
      await number.fill('999')
      await page.getByRole('button', { name: 'Проверить' }).click()
    } else {
      await page.locator('main [role=radio]').first().click()
      const run = page.getByRole('button', { name: 'Запустить и проверить' })
      await ((await run.count()) ? run.click() : page.getByRole('button', { name: 'Проверить' }).click())
    }
    await page.getByRole('button', { name: i === 10 ? 'Узнать результат' : 'Следующий вопрос' }).click()
  }
  await expect(page.getByText(/Верно \d+ из 11/)).toBeVisible()

  // First lesson
  await page.goto('/ru/learn/start/start-01')
  await page.getByRole('button', { name: /Начать урок|Продолжить урок/ }).click()
  await next(page) // theory
  const selects = page.locator('main select')
  await selects.nth(0).selectOption({ label: 'Чувствует' })
  await selects.nth(1).selectOption({ label: 'Думает' })
  await selects.nth(2).selectOption({ label: 'Действует' })
  await page.getByRole('button', { name: 'Проверить' }).click()
  await next(page)
  await next(page) // theory with example

  // Code task: a wrong program fails the autocheck with a clear message
  await loadProgram(page, [{ op: 'move', direction: 'forward', value: 20, unit: 'cm' }])
  await page.locator('main').getByRole('button', { name: 'Проверить' }).click()
  await expect(page.getByText('Робот остановился не в зоне «Финиш».').filter({ visible: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Дальше' })).toBeDisabled()

  // Mentor (mocked AI). On tablets the task, code and robot are tabs.
  const taskTab = page.getByRole('button', { name: 'Задание', exact: true })
  if (await taskTab.isVisible()) await taskTab.click()
  await page.getByRole('button', { name: 'Спросить наставника' }).click()
  await page.getByRole('region', { name: 'Наставник' }).getByRole('button', { name: 'Подсказка' }).click()
  await expect(page.getByText('Посчитай клетки до финиша')).toBeVisible()

  // The right program passes
  await loadProgram(page, [{ op: 'move', direction: 'forward', value: 40, unit: 'cm' }])
  await page.locator('main').getByRole('button', { name: 'Проверить' }).click()
  await expect(page.getByText('Всё получилось!').filter({ visible: true })).toBeVisible()
  await next(page)
  await page.getByRole('radio', { name: /Останавливается/ }).click()
  await page.getByRole('button', { name: 'Проверить' }).click()
  await page.getByRole('button', { name: 'Урок пройден!' }).click()

  // XP and the first achievement
  await expect(page.getByText(/\+\d+ XP/)).toBeVisible()
  await expect(page.getByText('Новое достижение!')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Первый шаг' })).toBeVisible()
  await closeAchievements(page)

  await page.goto('/ru/path')
  await closeAchievements(page)
  await expect(page.getByText('1 дн.').first()).toBeVisible()
  await expect(page.getByText('Цель выполнена! 🎉')).toBeVisible()

  // Next day: the streak is kept and today's goal starts over
  await page.clock.setFixedTime(DAY2)
  await page.goto('/ru/path')
  await expect(page.getByText('1 дн.').first()).toBeVisible()
  await expect(page.getByText('0 из 1 ур.')).toBeVisible()

  await page.goto('/ru/learn/start/start-02')
  await page.getByRole('button', { name: /Начать урок|Продолжить урок/ }).click()
  await next(page) // theory
  await page.locator('main input[inputmode=decimal]').fill('6')
  await page.getByRole('button', { name: 'Проверить' }).click()
  await next(page)
  await loadProgram(page, [
    { op: 'show_image', image: 'smile' },
    { op: 'beep', note: 60, seconds: 0.5 },
  ])
  await page.locator('main').getByRole('button', { name: 'Проверить' }).click()
  await expect(page.getByText('Всё получилось!').filter({ visible: true })).toBeVisible()
  await next(page)
  await page.getByRole('radio', { name: /В порт, например A/ }).click()
  await page.getByRole('button', { name: 'Проверить' }).click()
  await page.getByRole('button', { name: 'Урок пройден!' }).click()
  await closeAchievements(page)

  await page.goto('/ru/path')
  await closeAchievements(page)
  await expect(page.getByText('2 дн.').first()).toBeVisible()

  // Profile shows the earned achievement with its date
  await page.goto('/ru/profile')
  await expect(page.getByText('Первый шаг')).toBeVisible()
  await expect(page.getByText(/Получено 20 октября 2026/).first()).toBeVisible()

  expect(errors).toEqual([])
})

test('legal pages and redirects', async ({ page }) => {
  await page.goto('/ru/privacy')
  await expect(page.getByRole('heading', { name: 'Конфиденциальность' })).toBeVisible()
  await page.goto('/ru/parents')
  await expect(page.getByRole('heading', { name: 'Для родителей' })).toBeVisible()
  await page.goto('/ru/workspace')
  await expect(page).toHaveURL(/\/ru\/sandbox$/)
  await page.goto('/ru/fll')
  await expect(page).toHaveURL(/\/ru\/compete$/)
  await page.goto('/ru/class')
  await expect(page).toHaveURL(/\/ru\/path$/)
})

test('field simulator: a run from missions drives the robot and the score sheet counts', async ({ page }) => {
  await page.goto('/ru/compete')
  await page.getByRole('link', { name: /Симулятор поля BIOGLOW/ }).click()
  await expect(page).toHaveURL(/\/ru\/compete\/simulator$/)
  // The 3D simulator (a copy of fll-bioglow-sim) is the default tab; ours is the second.
  await expect(page.getByRole('heading', { name: '3D-симулятор поля FLL' })).toBeVisible()
  await page.getByRole('tab', { name: 'Наш симулятор' }).click()
  await expect(page.getByRole('heading', { name: 'Симулятор поля FLL' })).toBeVisible()
  const robot = page.locator('[data-robot]')
  const start = await robot.getAttribute('transform')
  await page.getByTestId('sim-missions').getByText('Взрывающиеся семена').click()
  await page.getByRole('button', { name: 'Запустить', exact: true }).click()
  await expect.poll(() => robot.getAttribute('transform'), { timeout: 10_000 }).not.toBe(start)
  // Start of a match: habitats in place (20) and six precision tokens (50).
  await expect(page.getByTestId('score-total')).toContainText('70')
  await page.getByRole('button', { name: 'Дрон больше не касается мата' }).click()
  await expect(page.getByTestId('score-total')).toContainText('90')
})
