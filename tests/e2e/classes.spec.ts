import { randomUUID } from 'node:crypto'

import { type Browser, type Page, expect, test } from '@playwright/test'

/** The whole pilot on the local Supabase: a teacher, a learner with a class code, the report. */

async function stackUp(): Promise<boolean> {
  try {
    return (await fetch('http://127.0.0.1:56321/auth/v1/health')).status < 500
  } catch {
    return false
  }
}

async function signUpTeacher(page: Page) {
  const password = `robo-${randomUUID().slice(0, 8)}`
  await page.goto('/ru/teacher')
  await page.getByRole('tab', { name: 'Регистрация' }).click()
  await page.getByLabel('Почта').fill(`teacher-${randomUUID().slice(0, 8)}@test.local`)
  await page.getByLabel('Пароль', { exact: true }).fill(password)
  await page.getByLabel('Повтори пароль').fill(password)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await expect(page.getByRole('heading', { name: 'Новый класс' })).toBeVisible({ timeout: 20_000 })
}

async function answerAll(page: Page) {
  for (let i = 0; i < 20; i++) {
    await expect(page.getByText(`Вопрос ${i + 1} из 20`)).toBeVisible()
    await page.getByRole('radio').first().check()
    await page.getByRole('button', { name: i === 19 ? 'Завершить' : 'Дальше' }).click()
  }
  await expect(page.getByRole('heading', { name: /Твой результат:/ })).toBeVisible()
  await page.getByRole('button', { name: 'Назад к классу' }).click()
}

async function learnerPage(browser: Browser) {
  const context = await browser.newContext({ locale: 'ru-RU', reducedMotion: 'reduce', viewport: { width: 1200, height: 900 } })
  return context.newPage()
}

test('teacher creates a class, a learner joins by code, the report shows before and after', async ({ page, browser }, info) => {
  test.skip(!(await stackUp()), 'local Supabase is not running (npm run db:start)')
  test.skip(info.project.name !== 'desktop', 'one full run is enough')
  test.setTimeout(240_000)

  await signUpTeacher(page)
  await page.getByLabel('Название класса').fill('7А робототехника')
  await page.getByRole('button', { name: 'Создать класс' }).click()
  const codeText = await page.getByTestId('class-code').innerText()
  const code = codeText.replace('Код: ', '').trim()
  expect(code).toMatch(/^[A-Z2-9]{6}$/)

  const kid = await learnerPage(browser)
  await kid.goto(`/ru/class?code=${code}`)
  await expect(kid.getByLabel('Код класса')).toHaveValue(code)
  await kid.getByRole('textbox', { name: /^Ник/ }).fill('Робик')
  await kid.getByLabel('PIN из 4 цифр').fill('4321')
  await kid.getByRole('checkbox', { name: /разрешил/ }).check()
  await kid.getByRole('button', { name: 'Войти в класс' }).click()
  await expect(kid.getByRole('heading', { name: /Робик, ты в классе/ })).toBeVisible({ timeout: 20_000 })

  await kid.getByRole('button', { name: 'Начать: Входной тест' }).click()
  await answerAll(kid)
  await expect(kid.getByText('Учитель откроет его позже')).toBeVisible()

  // The teacher opens the final test.
  await page.getByRole('checkbox', { name: 'Итоговый тест открыт' }).check()
  await expect(page.getByRole('checkbox', { name: 'Итоговый тест открыт' })).toBeChecked()

  await kid.reload()
  await kid.getByRole('button', { name: 'Начать: Итоговый тест' }).click()
  await answerAll(kid)
  await kid.getByRole('button', { name: 'Начать: Было ли понятно' }).click()
  await kid.getByRole('radio', { name: '4' }).check()
  await kid.getByRole('button', { name: 'Отправить' }).click()
  await expect(kid.getByRole('heading', { name: 'Спасибо!' })).toBeVisible()

  await page.getByRole('link', { name: 'Отчёт' }).click()
  await expect(page.getByRole('heading', { name: 'Отчёт: 7А робототехника' })).toBeVisible()
  const table = page.getByTestId('report-table')
  await expect(table).toContainText('Робик')
  await expect(page.getByTestId('chart-average')).toBeVisible()
  const excel = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать Excel' }).click()
  expect((await excel).suggestedFilename()).toMatch(/\.xlsx$/)
  const csv = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать CSV' }).click()
  expect((await csv).suggestedFilename()).toMatch(/\.csv$/)

  await kid.context().close()
})

test('the practice tasks run without the AI mentor', async ({ browser }, info) => {
  test.skip(!(await stackUp()), 'local Supabase is not running (npm run db:start)')
  test.skip(info.project.name !== 'desktop', 'one run is enough')
  test.setTimeout(120_000)

  const teacherPage = await learnerPage(browser)
  await signUpTeacher(teacherPage)
  await teacherPage.getByLabel('Название класса').fill('Практика')
  await teacherPage.getByRole('button', { name: 'Создать класс' }).click()
  const code = (await teacherPage.getByTestId('class-code').innerText()).replace('Код: ', '').trim()

  const kid = await learnerPage(browser)
  let aiCalls = 0
  await kid.route('**/api/**', (route) => {
    if (route.request().url().includes('mentor')) aiCalls++
    return route.continue()
  })
  await kid.goto(`/ru/class?code=${code}`)
  await kid.getByRole('textbox', { name: /^Ник/ }).fill('Практик')
  await kid.getByLabel('PIN из 4 цифр').fill('1234')
  await kid.getByRole('checkbox', { name: /разрешил/ }).check()
  await kid.getByRole('button', { name: 'Войти в класс' }).click()
  await kid.getByRole('button', { name: 'Начать: Входной тест' }).click()
  await answerAll(kid)
  await kid.getByRole('button', { name: 'Начать: Практика в симуляторе' }).click()
  await expect(kid.getByRole('heading', { name: 'Практика без ИИ' })).toBeVisible()
  await expect(kid.getByText('Задание 1 из 5')).toBeVisible()
  // The site-wide AI chat must not be there during tests and practice.
  await expect(kid.getByRole('button', { name: 'Открыть чат с наставником' })).toHaveCount(0)
  expect(aiCalls).toBe(0)

  await kid.context().close()
  await teacherPage.context().close()
})

test('the parental consent page is marked as a draft', async ({ page }) => {
  await page.goto('/ru/parents/consent')
  await expect(page.getByRole('note')).toContainText('Черновик')
  await expect(page.getByRole('heading', { name: 'Согласие родителя' })).toBeVisible()
})
