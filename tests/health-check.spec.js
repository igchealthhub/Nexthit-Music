import { test, expect } from '@playwright/test'

const ROUTES = [
  '/',
  '/login',
  '/signup',
  '/songs',
  '/videos',
  '/contests',
  '/leaderboard',
  '/dashboard',
  '/artist-dashboard',
  '/admin',
  '/profile',
]

function createMonitors(page) {
  const consoleErrors = []
  const pageErrors = []
  const failedRequests = []

  function isIgnorableResourceIssue(text) {
    return /status of (401|403)/.test(text) || /\b(401|403)\b/.test(text)
  }

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text()
      if (isIgnorableResourceIssue(text)) return
      consoleErrors.push(text)
    }
  })

  page.on('pageerror', error => {
    pageErrors.push(error.message)
  })

  page.on('requestfailed', request => {
    const failure = request.failure()?.errorText || 'Request failed'
    if (failure.includes('ERR_ABORTED')) return
    failedRequests.push(`${request.method()} ${request.url()} :: ${failure}`)
  })

  page.on('response', response => {
    if (response.status() >= 400 && response.status() !== 401 && response.status() !== 403) {
      failedRequests.push(`${response.status()} ${response.request().method()} ${response.url()}`)
    }
  })

  return { consoleErrors, pageErrors, failedRequests }
}

async function assertNoCriticalIssues(page, monitors) {
  await expect(page.locator('nav.navbar')).toBeVisible()
  await expect(page.locator('.navbar-brand')).toBeVisible()
  await expect(page.locator('.brand-name')).toContainText('NextHit')
  await expect(page.locator('main.app-main')).toBeVisible()

  const title = await page.title()
  expect(title.trim().length).toBeGreaterThan(0)

  const heading = page.locator('h1, h2, [role="heading"]').first()
  await expect(heading).toBeVisible()

  const bodyText = await page.locator('body').innerText()
  expect(bodyText.trim().length).toBeGreaterThan(0)
  expect(bodyText).not.toContain('Cannot read properties of null')
  expect(bodyText).not.toContain('TypeError:')

  expect(monitors.pageErrors, `Uncaught JS errors:\n${monitors.pageErrors.join('\n')}`).toEqual([])
  expect(monitors.consoleErrors, `Console errors:\n${monitors.consoleErrors.join('\n')}`).toEqual([])
  expect(monitors.failedRequests, `Failed network requests:\n${monitors.failedRequests.join('\n')}`).toEqual([])
}

test.describe('Daily health check', () => {
  test('critical pages load without blank screens or runtime failures', async ({ page }) => {
    const monitors = createMonitors(page)

    for (const route of ROUTES) {
      await test.step(`load ${route}`, async () => {
        await page.goto(route, { waitUntil: 'domcontentloaded' })
        await page.waitForLoadState('networkidle')

        await assertNoCriticalIssues(page, monitors)
      })
    }
  })

  test('basic user flows stay healthy', async ({ page }) => {
    const monitors = createMonitors(page)

    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1')).toContainText('Welcome back')

    await page.goto('/signup', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1')).toContainText('Create account')

    await page.goto('/songs', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1')).toContainText('Songs')

    const noApprovedSongsHeading = page.getByRole('heading', { name: /No approved songs yet/i })
    const playButtons = page.locator('.sp-play-btn')

    await expect
      .poll(async () => {
        const noApprovedVisible = await noApprovedSongsHeading.first().isVisible().catch(() => false)
        const playButtonCount = await playButtons.count()
        return noApprovedVisible || playButtonCount > 0
      }, { timeout: 15_000 })
      .toBe(true)

    const noApprovedVisible = await noApprovedSongsHeading.first().isVisible().catch(() => false)

    if (noApprovedVisible) {
      await expect(noApprovedSongsHeading).toBeVisible()
    } else {
      const playButtonCount = await playButtons.count()
      expect(playButtonCount).toBeGreaterThan(0)
    }

    await page.goto('/contests', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1')).toContainText(/Contest/i)

    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)
    await expect(page.locator('body')).not.toContainText('Cannot read properties')
    await expect(page.locator('.loading-screen .spinner')).toHaveCount(0)

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)
    await expect(page.locator('.loading-screen .spinner')).toHaveCount(0)

    await assertNoCriticalIssues(page, monitors)
  })
})
