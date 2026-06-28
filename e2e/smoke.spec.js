import { test, expect } from '@playwright/test'
import { assertNoBlankPage } from './utils/auth'

test.describe('Public smoke checks', () => {
  const publicRoutes = ['/', '/login', '/signup', '/songs', '/contests', '/leaderboard']

  for (const route of publicRoutes) {
    test(`no blank page on ${route}`, async ({ page }) => {
      await page.goto(route)
      await assertNoBlankPage(page)
    })
  }

  test('songs page renders playback controls if songs exist', async ({ page }) => {
    await page.goto('/songs')
    await assertNoBlankPage(page)

    const playButtons = page.locator('button.sp-play-btn')
    if (await playButtons.count()) {
      await playButtons.first().click()
    }

    await expect(page.locator('h1')).toContainText(/songs/i)
  })

  test('invalid contest route redirects gracefully', async ({ page }) => {
    await page.goto('/contests/1')
    await expect(page).toHaveURL(/\/contests$/)
    await expect(page.getByText(/that contest link is invalid/i)).toBeVisible()
    await assertNoBlankPage(page)
  })
})
