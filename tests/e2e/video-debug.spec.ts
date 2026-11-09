import { expect, test } from '@playwright/test'

test('a short video becomes stills, and the mentor answers with a question before a hint', async ({ page, browser }, info) => {
  let sent: { frames: { t: number; data: string }[]; program: string; expected: string } | null = null
  await page.route('**/api/video-debug', async (route) => {
    sent = route.request().postDataJSON()
    await route.fulfill({
      json: {
        ok: true,
        observed: 'Робот повернул примерно на 70 градусов.',
        question: 'Что влияет на угол поворота?',
        hint: 'Посмотри на настройки колёс.',
        remaining: 2,
      },
    })
  })
  await page.addInitScript(() => {
    const result = {
      format: 'blocks',
      title: 'Поворот',
      description: '',
      python: 'await turn(90, speed)',
      program: { title: 'Поворот', description: '', steps: [{ op: 'wait', seconds: 1 }] },
      warnings: [],
    }
    localStorage.setItem('roboeasy.history.v1', JSON.stringify([{ id: 'one', createdAt: Date.now(), prompt: 'поверни', result }]))
  })
  await page.goto('/ru/sandbox/video')
  await expect(page.getByRole('heading', { name: 'Видео-отладка' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Спросить наставника' })).toBeDisabled()

  // A real video: Playwright records a page, which gives an ordinary WebM file.
  const recording = await browser.newContext({ recordVideo: { dir: info.outputPath('video'), size: { width: 320, height: 240 } } })
  const scene = await recording.newPage()
  await scene.setContent('<body style="margin:0;background:teal"><div style="width:100px;height:100px;background:gold;animation:m 1s infinite alternate"></div><style>@keyframes m{to{transform:translateX(200px)}}</style></body>')
  await scene.waitForTimeout(2000)
  const video = scene.video()!
  await recording.close()
  const file = await video.path()
  await page.getByTestId('video-input').setInputFiles(file)
  await expect(page.getByText(/Видео подготовлено: кадров/)).toBeVisible({ timeout: 30_000 })

  await page.getByLabel('Что должен был сделать робот').fill('Повернуть на 90 градусов')
  await page.getByRole('button', { name: 'Спросить наставника' }).click()

  const card = page.getByTestId('video-answer')
  await expect(card).toContainText('Что влияет на угол поворота?')
  // The hint stays hidden until the learner asks for it.
  await expect(card).not.toContainText('Посмотри на настройки колёс.')
  await card.getByRole('button', { name: 'Показать подсказку' }).click()
  await expect(card).toContainText('Посмотри на настройки колёс.')

  const body = sent as unknown as { frames: { t: number; data: string }[]; program: string }
  expect(body.frames.length).toBeGreaterThan(0)
  expect(body.frames[0].data.startsWith('/9j/')).toBe(true)
  expect(body.program).toContain('runloop.sleep_ms(1000)')
})
