import path from 'path'
import { test, expect } from '@playwright/test'
import { credentialsFor, login, logoutIfNeeded } from './utils/auth'
import { attachFailureMonitors, assertNoCriticalClientFailures } from './utils/quality'

const uploadAudioPath = process.env.E2E_UPLOAD_AUDIO_PATH ? path.resolve(process.env.E2E_UPLOAD_AUDIO_PATH) : null

test.describe('Admin pending approval notifications', () => {
  test('artist upload creates admin notification and appears in pending approvals', async ({ page }) => {
    const monitors = attachFailureMonitors(page)
    const artist = credentialsFor('artist')
    const admin = credentialsFor('admin')

    test.skip(!artist.email || !artist.password, 'Set E2E_ARTIST_EMAIL and E2E_ARTIST_PASSWORD.')
    test.skip(!admin.email || !admin.password, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD.')
    test.skip(!uploadAudioPath, 'Set E2E_UPLOAD_AUDIO_PATH to a valid audio file.')

    const songTitle = `E2E Pending Notification ${Date.now()}`

    await login(page, 'artist')
    await page.goto('/upload/song')
    await expect(page.getByRole('heading', { name: /upload song/i })).toBeVisible()

    await page.getByPlaceholder('My Amazing Track').fill(songTitle)
    await page.locator('#audio-input').setInputFiles(uploadAudioPath)
    await page.getByRole('button', { name: /submit for review/i }).click()
    await expect(page.locator('body')).toContainText(/song submitted for review/i)

    await logoutIfNeeded(page)
    await login(page, 'admin')

    await page.goto('/notifications')
    await expect(page.getByRole('heading', { name: /notifications/i })).toBeVisible()

    const notificationRow = page.locator('div').filter({ hasText: `New song pending approval: ${songTitle}` }).first()
    await expect(notificationRow).toBeVisible({ timeout: 20_000 })

    const markReadButton = notificationRow.getByRole('button', { name: /mark read/i })
    if (await markReadButton.count()) {
      await markReadButton.click()
      await expect(markReadButton).toHaveCount(0)
    }

    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: /admin dashboard/i })).toBeVisible()
    await page.getByRole('button', { name: /pending/i }).first().click()
    await expect(page.locator('body')).toContainText(songTitle)

    await assertNoCriticalClientFailures(page, monitors)
  })
})
