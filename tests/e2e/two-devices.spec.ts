import { type Browser, type Page, expect, test } from '@playwright/test'

/**
 * One account open on a computer and a phone at the same time. Coins spent on
 * one must not stay spendable on the other: the garage checks the server
 * before a purchase, and a page that comes back into view pulls new events.
 * The server (auth, profile, event log) is answered here, shared by both pages.
 */

const USER = {
  id: '22222222-2222-4222-8222-222222222222',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'twin@test.local',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-01-01T00:00:00Z',
}

type Row = { id: string; kind: string; at: string; data: Record<string, unknown> }

function fakeServer() {
  const hour = new Date(Date.now() - 3_600_000).toISOString()
  // 50 welcome coins and 5 lessons: enough for one upgrade, not for two.
  const rows: Row[] = [1, 2, 3, 4, 5].map((n) => ({
    id: `lesson:fake-${n}`,
    kind: 'lesson_done',
    at: hour,
    data: { lesson: `fake-${n}`, track: 'start', unit: 'u', project: false, seconds: 60 },
  }))
  const attach = async (page: Page) => {
    await page.route('**/auth/v1/token*', (route) =>
      route.fulfill({
        json: { access_token: 'token', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'refresh', user: USER },
      }),
    )
    await page.route('**/auth/v1/user*', (route) => route.fulfill({ json: USER }))
    await page.route('**/rest/v1/profiles*', (route) =>
      route.fulfill({
        json: { id: USER.id, nickname: 'Близнец', age_range: '16-plus', timezone: 'Asia/Almaty', settings: { goal: { kind: 'lessons', n: 1 } }, parent_consent: false },
      }),
    )
    await page.route('**/rest/v1/learn_events*', (route) => {
      const since = new URL(route.request().url()).searchParams.get('at')?.replace(/^gte\./, '')
      return route.fulfill({ json: rows.filter((r) => !since || Date.parse(r.at) >= Date.parse(since)) })
    })
    await page.route('**/rest/v1/rpc/record_events*', (route) => {
      const { events } = route.request().postDataJSON() as { events: (Record<string, unknown> & { id: string; kind: string; at: number })[] }
      for (const { id, kind, at, ...data } of events) if (!rows.some((r) => r.id === id)) rows.push({ id, kind, at: new Date(at).toISOString(), data })
      return route.fulfill({ json: rows.length })
    })
  }
  return { rows, attach }
}

async function device(browser: Browser, server: ReturnType<typeof fakeServer>, viewport: { width: number; height: number }) {
  const page = await (await browser.newContext({ viewport })).newPage()
  await server.attach(page)
  await page.goto('/ru/path')
  await page.getByTestId('have-account').getByRole('button', { name: 'Войти' }).click()
  await page.getByLabel('Почта').fill(USER.email)
  await page.getByLabel('Пароль', { exact: true }).fill('any-password')
  await page.getByRole('main').getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Близнец/ })).toBeVisible({ timeout: 20_000 })
  await page.goto('/ru/garage')
  await expect(page.getByTestId('coins')).toBeVisible()
  for (let i = 0; i < 4; i++) {
    const ok = page.getByRole('button', { name: 'Класс!' })
    if (!(await ok.count())) break
    await ok.first().click()
  }
  return page
}

const coins = async (page: Page) => Number((await page.getByTestId('coins').innerText()).replace(/\D/g, ''))
const buy = async (page: Page, title: string) => {
  const btn = page.getByRole('heading', { name: title, exact: true }).locator('xpath=ancestor::*[.//button][1]').locator('button').last()
  await btn.click()
  await btn.click()
}

test('coins spent on the computer cannot be spent again on the phone', async ({ browser }) => {
  const server = fakeServer()
  const pc = await device(browser, server, { width: 1280, height: 900 })
  const phone = await device(browser, server, { width: 390, height: 844 })
  await expect.poll(() => coins(phone)).toBeGreaterThan(0)
  const start = await coins(pc)
  expect(await coins(phone)).toBe(start)

  // The computer buys the motor; it reaches the server a moment later.
  await buy(pc, 'Мотор')
  await expect.poll(() => server.rows.some((r) => r.id === 'buy:upgrade:motor-1')).toBe(true)
  const left = await coins(pc)
  expect(left).toBeLessThan(start)

  // The phone still shows the old balance and tries an upgrade only the old balance covers.
  expect(await coins(phone)).toBe(start)
  await buy(phone, 'Аккумулятор')
  await expect(phone.getByText('Монет уже не хватает')).toBeVisible()
  expect(server.rows.filter((r) => r.kind === 'purchase').map((r) => r.id)).toEqual(['buy:upgrade:motor-1'])
  await expect.poll(() => coins(phone)).toBe(left)

  // Something bought elsewhere shows up when the page comes back into view.
  server.rows.push({ id: 'buy:hat:antenna', kind: 'purchase', at: new Date().toISOString(), data: { item: 'hat:antenna' } })
  await phone.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect.poll(() => coins(phone)).toBe(left - 40)
})
