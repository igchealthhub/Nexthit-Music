import { test, expect } from '@playwright/test'
import { credentialsFor, login } from './utils/auth'
import { attachFailureMonitors, assertNoCriticalClientFailures, assertNoSupabaseFailures } from './utils/quality'

async function clickIfPresent(locator) {
  if (await locator.count()) {
    await locator.first().click()
    return true
  }
  return false
}

test.describe('Profiles, likes, notifications, and admin', () => {
  test('edit profile', async ({ page }) => {
    const monitors = attachFailureMonitors(page)
    const fan = credentialsFor('fan')
    test.skip(!fan.email || !fan.password, 'Set E2E_FAN_EMAIL and E2E_FAN_PASSWORD.')

    await login(page, 'fan')
    await page.goto('/profile')
    await expect(page.getByRole('heading', { name: /your profile/i })).toBeVisible()

    const bio = `E2E Bio ${Date.now()}`
    await page.getByPlaceholder(/tell fans about yourself/i).fill(bio)
    await page.getByRole('button', { name: /save changes/i }).click()
    await expect(page.locator('body')).toContainText(/profile updated/i)

    await assertNoCriticalClientFailures(page, monitors)
    assertNoSupabaseFailures(monitors)
  })

  test('follow artist and like song', async ({ page }) => {
    const monitors = attachFailureMonitors(page)
    const fan = credentialsFor('fan')
    test.skip(!fan.email || !fan.password, 'Set E2E_FAN_EMAIL and E2E_FAN_PASSWORD.')

    await login(page, 'fan')
    await page.goto('/songs')

    const artistLinks = page.locator('a[href^="/artist/"]')
    test.skip(!(await artistLinks.count()), 'No artist links available on songs page.')

    await artistLinks.first().click()
    await expect(page).toHaveURL(/\/artist\//)

    await clickIfPresent(page.getByRole('button', { name: /\+ follow|following/i }))

    await page.goto('/songs')
    const likeButton = page.getByRole('button', { name: /🤍|❤️|like|unlike/i }).first()
    if (await likeButton.count()) {
      await likeButton.click()
    }

    await assertNoCriticalClientFailures(page, monitors)
  })

  test('notifications page loads and actions are clickable', async ({ page }) => {
    const monitors = attachFailureMonitors(page)
    const fan = credentialsFor('fan')
    test.skip(!fan.email || !fan.password, 'Set E2E_FAN_EMAIL and E2E_FAN_PASSWORD.')

    await login(page, 'fan')
    await page.goto('/notifications')
    await expect(page.getByRole('heading', { name: /notifications/i })).toBeVisible()

    await clickIfPresent(page.getByRole('button', { name: /mark all read/i }))
    await clickIfPresent(page.getByRole('button', { name: /mark read/i }))

    await assertNoCriticalClientFailures(page, monitors)
    assertNoSupabaseFailures(monitors)
  })

  test('admin buttons work and no blank pages', async ({ page }) => {
    const monitors = attachFailureMonitors(page)
    const admin = credentialsFor('admin')
    test.skip(!admin.email || !admin.password, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD.')

    await login(page, 'admin')
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: /admin dashboard/i })).toBeVisible()

    await clickIfPresent(page.getByRole('button', { name: /pending/i }))
    await clickIfPresent(page.getByRole('button', { name: /approved/i }))
    await clickIfPresent(page.getByRole('button', { name: /rejected/i }))
    await clickIfPresent(page.getByRole('button', { name: /all songs/i }))
    await clickIfPresent(page.getByRole('button', { name: /videos/i }))
    await clickIfPresent(page.getByRole('button', { name: /users/i }))
    await clickIfPresent(page.getByRole('button', { name: /contests/i }))
    await clickIfPresent(page.getByRole('button', { name: /refresh/i }))

    await clickIfPresent(page.getByRole('button', { name: /approve/i }))
    await clickIfPresent(page.getByRole('button', { name: /reject/i }))
    await clickIfPresent(page.getByRole('button', { name: /create contest/i }))
    await clickIfPresent(page.getByRole('button', { name: /mark winner/i }))

    await assertNoCriticalClientFailures(page, monitors)
    assertNoSupabaseFailures(monitors)
  })
})
