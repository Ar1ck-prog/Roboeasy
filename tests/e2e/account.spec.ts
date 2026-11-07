import { randomUUID } from 'node:crypto'

import { expect, test } from '@playwright/test'

import { onboard } from './helpers'

/**
 * Accounts with email and password on the local Supabase (no confirmation
 * email). Skipped when the local stack is down (npm run db:start).
 */

const API = 'http://127.0.0.1:56321'

async function stackUp(): Promise<boolean> {
  try {
    return (await fetch(`${API}/auth/v1/health`)).status < 500
  } catch {
    return false
  }
}

test('sign up with a repeated password, sync, sign out and sign in again', async ({ page }) => {
  test.skip(!(await stackUp()), 'local Supabase is not running (npm run db:start)')
  test.setTimeout(120_000)
  const email = `kid-${randomUUID().slice(0, 8)}@test.local`
  const password = `robo-${randomUUID().slice(0, 6)}`

  await onboard(page, 'Pilot', '16+')
  await page.goto('/ru/profile#account')
  await page.getByRole('tab', { name: 'Регистрация' }).click()
  await page.getByLabel('Почта').fill(email)
  await page.getByLabel('Пароль', { exact: true }).fill(password)
  await page.getByLabel('Повтори пароль').fill(`${password}x`)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await expect(page.getByText('Пароли не совпадают.')).toBeVisible()

  await page.getByLabel('Повтори пароль').fill(password)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await expect(page.getByText(`Ты вошёл: ${email}`)).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('Прогресс сохранён в облаке')).toBeVisible({ timeout: 20_000 })

  await page.getByRole('button', { name: 'Выйти' }).click()
  await page.getByLabel('Почта').fill(email)
  await page.getByLabel('Пароль', { exact: true }).fill('wrong-password')
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.getByText('Неверная почта или пароль.')).toBeVisible()

  await page.getByLabel('Пароль', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.getByText(`Ты вошёл: ${email}`)).toBeVisible({ timeout: 20_000 })

  // The same email cannot sign up twice.
  await page.getByRole('button', { name: 'Выйти' }).click()
  await page.getByRole('tab', { name: 'Регистрация' }).click()
  await page.getByLabel('Почта').fill(email)
  await page.getByLabel('Пароль', { exact: true }).fill(password)
  await page.getByLabel('Повтори пароль').fill(password)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await expect(page.getByText(/Аккаунт с этой почтой уже есть/)).toBeVisible()
})
