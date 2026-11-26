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
  // Path: SPIKE Prime is suggested from 10 up; pick it explicitly.
  await page.getByTestId('path-spike').click()
  await expect(page.getByTestId('path-spike').getByRole('radio')).toBeChecked()
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
  await expect(page.getByText('Цель выполнена!')).toBeVisible()

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
})

test('field simulator: the 3D simulator opens in its frame, in our fonts and without emoji', async ({ page }) => {
  await page.goto('/ru/compete')
  await page.getByRole('link', { name: /Симулятор поля BIOGLOW/ }).click()
  await expect(page).toHaveURL(/\/ru\/compete\/simulator$/)
  const title = page.getByRole('heading', { name: 'Симулятор поля FLL', level: 1 })
  await expect(title).toBeVisible()
  // The page sits in the usual container, not against the screen edge.
  expect((await title.boundingBox())!.x).toBeGreaterThanOrEqual(12)
  expect((await page.locator('iframe').boundingBox())!.x).toBeGreaterThanOrEqual(12)
  // One simulator now: no tabs.
  await expect(page.getByRole('tab')).toHaveCount(0)

  const frame = page.frameLocator('iframe[title="3D-симулятор поля FLL BIOGLOW"]')
  const fieldTab = frame.getByRole('button', { name: 'Поле и код' }).or(frame.getByRole('tab', { name: 'Поле и код' }))
  await expect(fieldTab.first()).toBeVisible({ timeout: 60_000 })
  // Icons are drawn, not emoji.
  await expect(fieldTab.first().locator('svg.re-ico')).toHaveCount(1)
  const text = await frame.locator('body').innerText()
  expect(text).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u)
  // The site's fonts: Nunito for text, Rubik for headings.
  expect(await frame.locator('body').evaluate((b) => getComputedStyle(b).fontFamily)).toContain('Nunito')
  expect(await frame.locator('.brand-title').evaluate((b) => getComputedStyle(b).fontFamily)).toContain('Rubik')
})

test("a track card's Start button opens the track's first lesson", async ({ page }) => {
  await page.goto('/ru/learn')
  // A new visitor picks a path first, then sees the map on that tab.
  await page.getByTestId('path-spike').click()
  await expect(page.getByTestId('tab-spike')).toHaveAttribute('aria-selected', 'true')
  const start = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Старт', exact: true }) })
  await start.getByRole('link', { name: 'Начать' }).click()
  await expect(page).toHaveURL(/\/ru\/learn\/start\/start-01$/)
})

test('a learner under 10 picks WeDo 2.0, solves wedo-01 in the simulator and finds SPIKE Prime locked', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.clock.setFixedTime(DAY1)

  // Onboarding: under 10 suggests WeDo 2.0
  await page.goto('/ru/path')
  await page.getByLabel('Ник', { exact: true }).fill('Kid')
  await page.getByText('до 10', { exact: true }).click()
  await expect(page.getByTestId('path-wedo').getByRole('radio')).toBeChecked()
  await expect(page.getByTestId('path-wedo').getByText('Начни здесь')).toBeVisible()
  await page.getByRole('checkbox', { name: /Я взрослый/ }).check()
  await page.getByRole('button', { name: 'Поехали!' }).click()
  // No SPIKE placement test on the WeDo path; Start leads to the first WeDo lesson.
  await expect(page.getByRole('link', { name: 'Тест на уровень' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Начать' }).click()
  await expect(page).toHaveURL(/\/ru\/learn\/wedo-start\/wedo-01$/)

  // wedo-01: theory, a question, then the icon editor and the simulator
  await page.getByRole('button', { name: /Начать урок|Продолжить урок/ }).click()
  await next(page)
  await page.getByRole('radio', { name: 'Смартхаб' }).click()
  await page.getByRole('button', { name: 'Проверить' }).click()
  await next(page)
  await page.getByRole('button', { name: 'Мотор на время' }).click()
  await page.getByRole('button', { name: /Блок 1: мотор включить на 1 с/ }).click()
  await page.locator('main').getByRole('button', { name: 'Проверить' }).click()
  await expect(page.getByText('Почти! Давай поправим.').filter({ visible: true })).toBeVisible()
  // On tablets the check shows the robot tab; go back to the program to fix it.
  const codeTab = page.getByRole('button', { name: 'Программа', exact: true })
  if (await codeTab.isVisible()) await codeTab.click()
  await page.getByRole('button', { name: 'Больше' }).click()
  await page.getByRole('button', { name: 'Больше' }).click()
  await page.locator('main').getByRole('button', { name: 'Проверить' }).click()
  await expect(page.getByText('Всё получилось!').filter({ visible: true })).toBeVisible()
  await page.getByRole('button', { name: 'Урок пройден!' }).click()
  await closeAchievements(page)

  // The map opens on WeDo 2.0; the SPIKE Prime tab is locked with WeDo progress
  await page.goto('/ru/learn')
  await closeAchievements(page)
  await expect(page.getByTestId('tab-wedo')).toHaveAttribute('aria-selected', 'true')
  await page.getByTestId('tab-spike').click()
  await expect(page.getByTestId('spike-locked')).toContainText('Откроется, когда пройдёшь все уроки WeDo')
  await expect(page.getByTestId('spike-locked')).toContainText('WeDo: 1 из 35 уроков')

  // A SPIKE lesson by direct link stays closed and points to the next WeDo lesson
  await page.goto('/ru/learn/start/start-01')
  await expect(page.getByTestId('wedo-first')).toBeVisible()
  await expect(page.getByRole('link', { name: /К уроку WeDo: Смартхаб/ })).toBeVisible()

  expect(errors).toEqual([])
})
