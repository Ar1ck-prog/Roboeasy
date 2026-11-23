import { expect, test } from '@playwright/test'

import { APK } from '../../lib/i18n/app-download'

test('the landing offers the Android app and a desktop install', async ({ page, request }) => {
  await page.goto('/ru')
  await page.getByRole('link', { name: 'Скачать приложение' }).click()
  await expect(page.getByRole('heading', { name: 'RoboEasy на телефоне и компьютере' })).toBeInViewport()

  // The APK is really there and is an Android package (a zip with a manifest inside).
  const link = page.getByTestId('apk-download')
  await expect(link).toHaveAttribute('href', APK.href)
  const apk = await request.get(APK.href)
  expect(apk.status()).toBe(200)
  const bytes = await apk.body()
  expect(bytes.subarray(0, 2).toString()).toBe('PK')
  expect(bytes.includes(Buffer.from('AndroidManifest.xml'))).toBe(true)
  expect(Math.abs(bytes.length / 1024 / 1024 - APK.sizeMb)).toBeLessThan(0.15)

  // Without the browser's install prompt the button says where to install from.
  await page.getByRole('button', { name: 'Установить на компьютер' }).click()
  await expect(page.locator('#app').getByRole('status')).toContainText('Chrome или Edge')
})

test('the app and the site are linked for Android (full screen, no address bar)', async ({ request }) => {
  const res = await request.get('/.well-known/assetlinks.json')
  expect(res.status()).toBe(200)
  const links = await res.json()
  expect(links[0].target).toMatchObject({ namespace: 'android_app', package_name: 'kz.roboeasy.app' })
  expect(links[0].target.sha256_cert_fingerprints[0]).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/)
})
