import { expect, test } from '@playwright/test'

test('when the AI is out of quota the sandbox says so and offers ready programs', async ({ page }) => {
  await page.route('**/api/generate', (route) =>
    route.request().method() === 'POST' ? route.fulfill({ status: 503, json: { ok: false, error: 'ai_busy', retryAfter: 150 } }) : route.fulfill({ json: { configured: true } }),
  )
  await page.goto('/ru/sandbox')
  await page.locator('#prompt').fill('Проедь квадрат')
  await page.getByRole('button', { name: 'Создать программу' }).click()

  await expect(page.locator('p[role=alert]')).toContainText('ИИ отдыхает, попробуй через 3 мин')
  await page.getByRole('button', { name: 'Открыть пример: Квадрат' }).click()

  await expect(page.getByRole('heading', { name: 'Квадрат' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Скачать/ }).first()).toBeEnabled()
})

test('the AI statistics are closed to visitors', async ({ page }) => {
  await page.goto('/ru/admin/ai')
  await expect(page.getByText('Эта страница только для администратора.')).toBeVisible()
})
