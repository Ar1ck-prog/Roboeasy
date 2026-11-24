import { devices, expect, test, type Page } from '@playwright/test'

import { programToPython } from '../../lib/dsl/compile-python'
import { DEFAULT_ROBOT, type Program } from '../../lib/dsl/types'
import { getPythonWorkflowText } from '../../lib/i18n/python-workflow'

const frame = (page: Page) => page.frameLocator('iframe[src^="/fll-sim/index.html"]')
const open = (page: Page) => page.getByRole('button', { name: 'Открыть в FLL', exact: true })
const manual = 'def run_example():\n    for i in range(2):\n        print("RoboEasy", i)\n\nrun_example()\n'
const edited = 'Проедь прямо 20 см, затем остановись'
const program: Program = { title: 'Проверка', description: '', steps: [{ op: 'wait', seconds: 0.1 }] }
const generated = 'def main():\n    print("Generated Python")\n\nmain()\n'
const partsKey = 'fll.bioglow.programs'

test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } })
test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'Includes a separate phone context'))

function editorCode(page: Page) {
  return frame(page).locator('.cm-line').evaluateAll((lines) => lines.map((line) => line.textContent).join('\n'))
}

function storedPrograms(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]') as { name: string; code: string; importId?: string }[], partsKey)
}

async function expectImport(page: Page) {
  await expect(page.getByText(/Код Python открыт в новой программе FLL/)).toBeVisible({ timeout: 45_000 })
}

async function fakeGenerator(page: Page) {
  const requests: { prompt: string; format: string }[] = []
  await page.route('**/api/generate', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { configured: true } })
    const request = route.request().postDataJSON() as typeof requests[number]
    requests.push(request)
    const shared = { ok: true, title: program.title, description: '', warnings: [] }
    return route.fulfill({
      json: request.format === 'blocks'
        ? { ...shared, format: 'blocks', program, python: '# stale copy' }
        : { ...shared, format: 'python', code: generated },
    })
  })
  return requests
}

test('manual Python reaches the real editor intact, starts manually, and keeps drafts through reload', async ({ page }) => {
  await page.addInitScript(() => {
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'roboeasy:fll-python-import-result' && sessionStorage.getItem('hold-fll-reply')) event.stopImmediatePropagation()
    })
  })
  await page.route(/\/fll-sim\/index\.html(?:\?|$)/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 900))
    await route.continue()
  })
  await page.goto('/ru/sandbox')
  await page.evaluate((key) => {
    localStorage.setItem(key, JSON.stringify([{ name: 'Мой черновик', code: 'print("Draft")\n' }]))
    sessionStorage.setItem('hold-fll-reply', 'yes')
  }, partsKey)
  await page.getByRole('button', { name: 'Написать Python вручную' }).click()
  const input = page.getByRole('textbox', { name: 'Код Python', exact: true })
  await expect(open(page)).toBeDisabled()
  await input.fill('   \n  ')
  await expect(open(page)).toBeDisabled()
  await input.fill(manual)
  await open(page).click()
  await expect(page).toHaveURL(/\/ru\/compete\/simulator\?pythonImport=[\da-f-]+$/)
  await expect.poll(() => page.evaluate(() => crossOriginIsolated)).toBe(true)
  await expect.poll(() => editorCode(page), { timeout: 45_000 }).toBe(manual)
  await expect(frame(page).locator('#console')).not.toContainText('RoboEasy 0')
  await expect.poll(() => storedPrograms(page)).toHaveLength(2)
  await page.evaluate(() => sessionStorage.removeItem('hold-fll-reply'))
  await page.reload()
  await expectImport(page)
  await expect(page).toHaveURL(/\/ru\/compete\/simulator$/)
  await expect.poll(() => editorCode(page)).toBe(manual)
  await frame(page).locator('#btnRun').click()
  await expect(frame(page).locator('#console')).toContainText('RoboEasy 1', { timeout: 45_000 })

  await page.reload()
  await expect.poll(() => editorCode(page)).toBe(manual)
  await expect.poll(() => storedPrograms(page)).toEqual([
    { name: 'Мой черновик', code: 'print("Draft")\n' },
    { name: 'Ручной Python', code: manual, importId: expect.any(String) },
  ])
  await frame(page).locator('#programSelect').selectOption({ label: 'Мой черновик' })
  await expect.poll(() => editorCode(page)).toBe('print("Draft")\n')
})

test('generated blocks are compiled again and the Python result transfers verbatim', async ({ page }) => {
  const requests = await fakeGenerator(page)
  for (const format of ['blocks', 'python'] as const) {
    await page.goto('/ru/sandbox')
    await page.getByRole('button', { name: format === 'blocks' ? /^Блоки/ : /^Python/ }).click()
    await page.getByLabel('Задача для робота').fill(edited)
    await page.getByRole('button', { name: 'Создать программу', exact: true }).click()
    await open(page).click()
    await expectImport(page)
    const expected = format === 'blocks' ? programToPython(program, DEFAULT_ROBOT) : generated
    await expect.poll(async () => (await storedPrograms(page)).at(-1)?.code).toBe(expected)
  }
  expect(requests).toEqual([{ prompt: edited, format: 'blocks', lang: 'ru', robot: DEFAULT_ROBOT }, { prompt: edited, format: 'python', lang: 'ru', robot: DEFAULT_ROBOT }])
  await expect.poll(() => storedPrograms(page)).toHaveLength(3)
})

test('dictation from both entry points stays editable and permission denial leaves keyboard input available', async ({ page }) => {
  const requests = await fakeGenerator(page)
  await page.addInitScript(() => {
    class Speech {
      start() {
        if (sessionStorage.getItem('speech-test') === 'hold') return
        window.setTimeout(() => {
          const mode = sessionStorage.getItem('speech-test')
          if (mode === 'denied') this.onerror?.({ error: 'not-allowed' })
          else if (mode === 'error') this.onerror?.({ error: 'network' })
          else this.onresult?.({ results: [[{ transcript: mode === 'empty' ? ' ' : 'Едь прямо' }]] })
          this.onend?.()
        }, 450)
      }
      onresult?: (event: { results: { transcript: string }[][] }) => void
      onerror?: (event: { error: string }) => void
      onend?: () => void
      stop() { this.onend?.() }
      abort() { sessionStorage.setItem('speech-aborted', 'yes') }
    }
    Object.defineProperty(window, 'SpeechRecognition', { value: Speech, configurable: true })
  })
  await page.goto('/ru/voice')
  await page.getByText('Сгенерировать программу', { exact: true }).click()
  await page.getByRole('button', { name: 'Продиктовать задание' }).click()
  await expect(page.getByText('Слушаю…', { exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Перенести задание в генератор' })).toHaveValue('Едь прямо')
  await page.getByRole('button', { name: 'Перенести задание в генератор' }).click()
  const prompt = page.getByLabel('Задача для робота')
  await expect(prompt).toHaveValue('Едь прямо')

  const dictate = page.getByRole('button', { name: 'Продиктовать задание' })
  for (const [mode, error] of [
    ['denied', 'Доступ к микрофону отклонён.'],
    ['empty', 'Не удалось распознать речь.'],
    ['error', 'Ошибка распознавания речи.'],
  ] as const) {
    await page.evaluate((value) => sessionStorage.setItem('speech-test', value), mode)
    await dictate.click()
    await expect(page.getByText(error, { exact: false })).toBeVisible()
    await expect(prompt).toBeEditable()
  }
  await page.evaluate(() => sessionStorage.removeItem('speech-test'))
  await prompt.fill('')
  await dictate.click()
  await expect(prompt).toHaveValue('Едь прямо')
  expect(requests).toHaveLength(0)
  await prompt.fill(edited)
  await page.getByRole('button', { name: /^Python/ }).click()
  await page.getByRole('button', { name: 'Создать программу', exact: true }).click()
  await expect(open(page)).toBeEnabled()
  await page.evaluate(() => sessionStorage.setItem('speech-test', 'hold'))
  await dictate.click()
  await open(page).click()
  await expectImport(page)
  await expect.poll(() => editorCode(page)).toBe(generated)
  expect(requests[0].prompt).toBe(edited)
  expect(await page.evaluate(() => sessionStorage.getItem('speech-aborted'))).toBe('yes')
})

test('an invalid transfer displays a localized error and leaves existing programs available', async ({ page }) => {
  await page.goto('/en/compete/simulator?pythonImport=missing')
  await expect(page.getByRole('alert').filter({ hasText: getPythonWorkflowText('en').importError })).toBeVisible()
  await expect(frame(page).locator('#programSelect')).toBeVisible()
})

test('an unsupported microphone leaves the assignment editable', async ({ page }) => {
  await page.addInitScript(() => {
    for (const name of ['SpeechRecognition', 'webkitSpeechRecognition']) {
      Object.defineProperty(window, name, { value: undefined, configurable: true })
    }
  })
  await page.goto('/ru/sandbox')
  await page.getByRole('button', { name: 'Продиктовать задание' }).click()
  await expect(page.getByText(/В этом браузере диктовка недоступна/)).toBeVisible()
  await expect(page.getByLabel('Задача для робота')).toBeEditable()
})

test('manual entry is usable by touch on a phone in RU, KK and EN and FLL follows both themes', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ ...devices['Pixel 7'], baseURL, colorScheme: 'dark' })
  try {
    const page = await context.newPage()
    for (const lang of ['ru', 'kk', 'en'] as const) {
      const t = getPythonWorkflowText(lang)
      await page.goto(`/${lang}/sandbox`)
      await page.getByRole('button', { name: t.manual }).tap()
      await page.getByRole('textbox', { name: t.manualLabel, exact: true }).fill(manual)
      await expect(page.getByRole('button', { name: t.open, exact: true })).toBeInViewport()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(393)
    }
    const t = getPythonWorkflowText('en')
    await page.getByRole('button', { name: t.open, exact: true }).tap()
    await expect(page.getByText(t.imported)).toBeVisible({ timeout: 45_000 })
    await expect(frame(page).locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.emulateMedia({ colorScheme: 'light' })
    await expect(frame(page).locator('html')).toHaveAttribute('data-theme', 'light')
  } finally {
    await context.close()
  }
})
