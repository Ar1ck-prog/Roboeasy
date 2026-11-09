import { type Page, expect, test } from '@playwright/test'

/**
 * Opening the site on another device: nothing in this browser, an account on
 * the server. The server is answered here, so the real form, session handling
 * and progress sync all run without a database.
 */

const USER = {
  id: '11111111-1111-4111-8111-111111111111',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'kid@test.local',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-01-01T00:00:00Z',
}

async function fakeServer(page: Page, password: string) {
  await page.route('**/auth/v1/token*', (route) => {
    const body = route.request().postDataJSON() as { password?: string }
    return body.password === password
      ? route.fulfill({
          json: {
            access_token: 'token',
            token_type: 'bearer',
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            refresh_token: 'refresh',
            user: USER,
          },
        })
      : route.fulfill({ status: 400, json: { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' } })
  })
  await page.route('**/rest/v1/profiles*', (route) =>
    route.fulfill({
      json: {
        id: USER.id,
        nickname: 'ВернулсяДомой',
        age_range: '16-plus',
        timezone: 'Asia/Almaty',
        settings: { goal: { kind: 'lessons', n: 1 }, skipWeekends: false },
        parent_consent: false,
      },
    }),
  )
  await page.route('**/rest/v1/learn_events*', (route) => route.fulfill({ json: [] }))
}

async function signIn(page: Page, password: string) {
  await page.getByLabel('Почта').fill(USER.email)
  await page.getByLabel('Пароль', { exact: true }).fill(password)
  await page.getByRole('main').getByRole('button', { name: 'Войти', exact: true }).click()
}

test('a new device can sign in from the start screen and gets the account back', async ({ page }) => {
  await fakeServer(page, 'right-password')
  await page.goto('/ru/path')

  // The way in is right on the first screen; the sign-up form is still the default.
  await expect(page.getByRole('heading', { name: 'Давай знакомиться' })).toBeVisible()
  await page.getByTestId('have-account').getByRole('button', { name: 'Войти' }).click()
  await expect(page.getByRole('heading', { name: 'Уже есть аккаунт?' })).toBeVisible()

  await signIn(page, 'wrong')
  await expect(page.getByText('Неверная почта или пароль.')).toBeVisible()

  await signIn(page, 'right-password')
  await expect(page.getByRole('heading', { name: /ВернулсяДомой/ })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('heading', { name: 'Давай знакомиться' })).toHaveCount(0)
})

test('the header says “Sign in” until there is a profile and opens the form', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the header link is for wide screens')
  await page.goto('/ru')
  const link = page.getByRole('banner').getByRole('link', { name: 'Войти' })
  await link.click()
  await expect(page).toHaveURL(/\/ru\/profile#account$/)
  await expect(page.getByRole('heading', { name: 'Уже есть аккаунт?' })).toBeVisible()
  await expect(page.getByLabel('Почта')).toBeVisible()

  await page.getByRole('button', { name: 'Назад к знакомству' }).click()
  await expect(page.getByRole('heading', { name: 'Давай знакомиться' })).toBeVisible()
})

test('the phone tab bar offers sign-in too', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/ru/path')
  await page.getByRole('navigation').getByRole('link', { name: 'Войти' }).click()
  await expect(page.getByRole('heading', { name: 'Уже есть аккаунт?' })).toBeVisible()
})
