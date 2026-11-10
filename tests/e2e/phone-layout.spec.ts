import { expect, test } from '@playwright/test'

import { onboard } from './helpers'

/** Every page fits a phone: nothing sticks out past the right edge, so there is no sideways scrolling. */
const PAGES = [
  '/ru',
  '/ru/path',
  '/ru/learn',
  '/ru/learn/start',
  '/ru/learn/ai-basics',
  '/ru/learn/ai-basics/ai-01',
  '/ru/learn/start/start-01',
  '/ru/play',
  '/ru/garage',
  '/ru/library',
  '/ru/profile',
  '/ru/sandbox',
  '/ru/sandbox/draw',
  '/ru/sandbox/video',
  '/ru/ai',
  '/ru/compete',
  '/ru/compete/simulator',
  '/ru/teacher',
  '/ru/class',
  '/ru/parents/consent',
  '/ru/parents',
  '/ru/privacy',
  '/ru/admin/ai',
  '/ru/review',
  '/kk/learn/ai-basics',
]

test('every page fits a phone screen', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'widths are set here')
  test.setTimeout(600_000)
  await onboard(page, 'Телефон', '16+')
  const problems: string[] = []
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 800 })
    for (const path of PAGES) {
      await page.goto(path)
      await page.waitForTimeout(800)
      const wide = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth
        const scrolls = (el: Element) => {
          for (let p = el.parentElement; p; p = p.parentElement) if (getComputedStyle(p).overflowX !== 'visible') return true
          return false
        }
        const items = [...document.querySelectorAll('body *')].filter((el) => {
          const r = el.getBoundingClientRect()
          return r.width > 0 && r.right > vw + 1 && !scrolls(el)
        })
        return {
          scroll: document.documentElement.scrollWidth - vw,
          first: items[0] ? `${items[0].tagName} "${(items[0].textContent ?? '').trim().slice(0, 40)}"` : '',
        }
      })
      if (wide.scroll > 0 || wide.first) problems.push(`${width}px ${path}: ${wide.first || `${wide.scroll}px too wide`}`)
    }
  }
  expect(problems).toEqual([])
})
