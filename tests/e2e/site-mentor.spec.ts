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

test('voice: a spoken question is sent, and the answer is read aloud when asked for', async ({ page }) => {
  await page.route('**/api/mentor', (route) => route.fulfill({ json: { ok: true, answer: 'Начни с урока про моторы.', remaining: 5 } }))
  await page.addInitScript(() => {
    class FakeRecognition {
      lang = ''
      interimResults = false
      maxAlternatives = 1
      onresult: ((e: unknown) => void) | null = null
      onerror: (() => void) | null = null
      onend: (() => void) | null = null
      start() {
        ;(window as unknown as { __speechLang: string }).__speechLang = this.lang
        setTimeout(() => {
          this.onresult?.({ results: [[{ transcript: 'С чего начать?' }]] })
          this.onend?.()
        }, 50)
      }
      stop() {
        this.onend?.()
      }
    }
    for (const name of ['SpeechRecognition', 'webkitSpeechRecognition']) Object.defineProperty(window, name, { value: FakeRecognition, configurable: true })
    const spoken: string[] = []
    ;(window as unknown as { __spoken: string[] }).__spoken = spoken
    window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => void spoken.push(u.text)
  })
  await page.goto('/ru/library')
  await page.getByRole('button', { name: 'Открыть чат с наставником' }).click()
  await page.getByRole('checkbox', { name: 'Озвучивать ответы' }).check()
  await page.getByRole('button', { name: 'Спросить голосом' }).click()
  await expect(page.getByText('Начни с урока про моторы.')).toBeVisible()
  await expect(page.getByText('С чего начать?', { exact: true }).first()).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { __speechLang: string }).__speechLang)).toBe('ru-RU')
  await expect.poll(() => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)).toEqual(['Начни с урока про моторы.'])
})

test('the site can work offline-ready: its worker and offline page are served', async ({ request }) => {
  const worker = await request.get('/sw.js')
  expect(worker.ok()).toBe(true)
  expect(await worker.text()).toContain('/offline.html')
  const offline = await request.get('/offline.html')
  expect(await offline.text()).toContain('Нет интернета')
})
