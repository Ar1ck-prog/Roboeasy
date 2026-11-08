import { expect, test } from '@playwright/test'

/** The chat around the AI service; the answers are fixed here so the tests stay free and repeatable. */

test('the mentor answers on any page, remembers the talk and sees the sandbox program', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const requests: { page: string; messages: { from: string; text: string }[]; program?: string }[] = []
  await page.route('**/api/mentor', (route) => {
    requests.push(route.request().postDataJSON())
    return route.fulfill({ json: { ok: true, answer: `Ответ ${requests.length}`, remaining: 30 } })
  })
  await page.route('**/api/generate', (route) =>
    route.fulfill(
      route.request().method() === 'GET'
        ? { json: { configured: true } }
        : { json: { ok: true, format: 'python', title: 'Проба', description: '', warnings: [], code: 'print("код песочницы")\n' } },
    ),
  )

  await page.goto('/ru/library')
  await page.getByRole('button', { name: 'Открыть чат с наставником' }).click()
  const chat = page.getByTestId('site-mentor')
  await chat.getByRole('button', { name: 'Как заработать монеты?' }).click()
  await expect(chat.getByText('Ответ 1')).toBeVisible()
  expect(requests[0].page).toBe('/ru/library')
  expect(requests[0].program).toBeUndefined()

  // Close and reopen: the conversation is still there.
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Открыть чат с наставником' }).click()
  await expect(chat.getByText('Ответ 1')).toBeVisible()

  await chat.getByLabel('Напиши вопрос…').fill('А ещё?')
  await chat.getByRole('button', { name: 'Отправить' }).click()
  await expect(chat.getByText('Ответ 2')).toBeVisible()
  expect(requests[1].messages.map((m) => m.from)).toEqual(['me', 'mentor', 'me'])

  await page.keyboard.press('Escape')
  await page.goto('/ru/sandbox')
  await page.getByRole('button', { name: /^Python/ }).click()
  await page.getByRole('checkbox', { name: /Свободный Python/ }).check()
  await page.getByLabel('Задача для робота').fill('Напечатай что-нибудь')
  await page.getByRole('button', { name: 'Создать программу' }).click()
  await expect(page.getByRole('heading', { name: 'Проба' })).toBeVisible()
  await page.getByRole('button', { name: 'Открыть чат с наставником' }).click()
  await chat.getByLabel('Напиши вопрос…').fill('Что делает мой код?')
  await chat.getByRole('button', { name: 'Отправить' }).click()
  await expect.poll(() => requests.at(-1)?.messages.at(-1)?.text).toBe('Что делает мой код?')
  expect(requests.at(-1)?.page).toBe('/ru/sandbox')
  expect(requests.at(-1)?.program).toContain('код песочницы')
  expect(errors).toEqual([])
})

test('failures are told in plain words and do not go back to the AI', async ({ page }) => {
  let calls = 0
  let second: { messages: { text: string }[] } | undefined
  await page.route('**/api/mentor', (route) => {
    calls++
    if (calls === 1) return route.fulfill({ status: 502, json: { ok: false, error: 'unavailable' } })
    second = route.request().postDataJSON()
    return route.fulfill({ json: { ok: true, answer: 'Теперь отвечаю', remaining: 30 } })
  })
  await page.goto('/ru/library')
  await page.getByRole('button', { name: 'Открыть чат с наставником' }).click()
  const chat = page.getByTestId('site-mentor')
  await chat.getByRole('button', { name: 'С чего мне начать?' }).click()
  await expect(chat.getByText('Наставник сейчас занят')).toBeVisible()
  await chat.getByLabel('Напиши вопрос…').fill('Снова')
  await chat.getByRole('button', { name: 'Отправить' }).click()
  await expect(chat.getByText('Теперь отвечаю')).toBeVisible()
  expect(second?.messages.map((m) => m.text)).toEqual(['С чего мне начать?', 'Снова'])
})
