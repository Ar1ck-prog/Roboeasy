import { type Page, expect } from '@playwright/test'

type Steps = Parameters<NonNullable<Window['__roboeasyBlockly']>['load']>[0]

export async function loadProgram(page: Page, steps: Steps) {
  await page.waitForFunction(() => !!window.__roboeasyBlockly, null, { timeout: 60_000 })
  await page.evaluate((s) => window.__roboeasyBlockly!.load(s), steps)
  await page.waitForTimeout(400)
}

export async function closeAchievements(page: Page) {
  const great = page.getByRole('button', { name: 'Класс!' })
  for (let i = 0; i < 6; i++) {
    if (!(await great.isVisible().catch(() => false))) break
    await great.click()
    await page.waitForTimeout(150)
  }
}

export async function next(page: Page) {
  await page.getByRole('button', { name: 'Дальше' }).click()
}

export async function onboard(page: Page, nickname: string, age: '13–15' | '16+') {
  await page.goto('/ru/path')
  await expect(page.getByRole('heading', { name: 'Давай знакомиться' })).toBeVisible()
  await page.getByLabel('Ник', { exact: true }).fill(nickname)
  await page.getByText(age, { exact: true }).click()
  if (age !== '16+') await page.getByRole('checkbox', { name: /Я взрослый/ }).check()
  await page.getByRole('button', { name: 'Поехали!' }).click()
  await expect(page.getByRole('heading', { name: 'С чего начнём?' })).toBeVisible()
}

/** Lesson start-01 from the start, solved right after one wrong try. */
export async function doFirstLesson(page: Page) {
  await page.goto('/ru/learn/start/start-01')
  await page.getByRole('button', { name: /Начать урок|Продолжить урок/ }).click()
  await next(page)
  const selects = page.locator('main select')
  await selects.nth(0).selectOption({ label: 'Чувствует' })
  await selects.nth(1).selectOption({ label: 'Думает' })
  await selects.nth(2).selectOption({ label: 'Действует' })
  await page.getByRole('button', { name: 'Проверить' }).click()
  await next(page)
  await next(page)
  await loadProgram(page, [{ op: 'move', direction: 'forward', value: 20, unit: 'cm' }])
  await page.locator('main').getByRole('button', { name: 'Проверить' }).click()
  await expect(page.getByText('Робот остановился не в зоне «Финиш».').filter({ visible: true })).toBeVisible()
  await loadProgram(page, [{ op: 'move', direction: 'forward', value: 40, unit: 'cm' }])
  await page.locator('main').getByRole('button', { name: 'Проверить' }).click()
  await expect(page.getByText('Всё получилось!').filter({ visible: true })).toBeVisible()
  await next(page)
  await page.getByRole('radio', { name: /Останавливается/ }).click()
  await page.getByRole('button', { name: 'Проверить' }).click()
  await page.getByRole('button', { name: 'Урок пройден!' }).click()
  await expect(page.getByText(/\+\d+ XP/)).toBeVisible()
  await closeAchievements(page)
}
