import { expect, test } from '@playwright/test'

import { onboard } from './helpers'

/** The header fits on one line: no item overlaps another and nothing goes past the edge. */
test('the header fits on laptop and desktop widths', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'widths are set here')
  await onboard(page, 'Шапка', '16+')
  for (const width of [1200, 1280, 1366, 1440, 1920]) {
    await page.setViewportSize({ width, height: 600 })
    await page.goto('/ru/learn/ai-basics')
    const gaps = await page.evaluate(() => {
      const nav = document.querySelector('.main-nav')!.getBoundingClientRect()
      const actions = document.querySelector('.header-actions')!.getBoundingClientRect()
      const last = [...document.querySelectorAll('.main-nav > *')].pop()!.getBoundingClientRect()
      return { navToActions: actions.left - last.right, actionsRight: innerWidth - actions.right, navLeft: nav.left }
    })
    expect(gaps.navToActions, `${width}px`).toBeGreaterThanOrEqual(8)
    expect(gaps.actionsRight, `${width}px`).toBeGreaterThanOrEqual(0)
    await expect(page.getByRole('banner').getByRole('link', { name: 'Профиль' })).toBeVisible()
  }
})

test('rarer sections are under "More", and the current one shows there', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the header nav is for wide screens')
  await onboard(page, 'Ещёшка', '16+')
  await page.goto('/ru/path')
  const banner = page.getByRole('banner')
  await banner.getByRole('button', { name: 'Ещё' }).click()
  await banner.getByRole('link', { name: 'Песочница' }).click()
  await expect(page).toHaveURL(/\/ru\/sandbox$/)
  await expect(banner.getByRole('button', { name: 'Песочница' })).toHaveAttribute('data-active', 'true')
  await banner.getByRole('button', { name: 'Песочница' }).click()
  await page.keyboard.press('Escape')
  await expect(banner.getByRole('link', { name: 'Справочник' })).toHaveCount(0)
})
