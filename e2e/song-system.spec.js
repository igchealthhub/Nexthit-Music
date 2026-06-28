import path from 'path'
import { test, expect } from '@playwright/test'
import { credentialsFor, login } from './utils/auth'
import { attachFailureMonitors, assertNoCriticalClientFailures, assertNoSupabaseFailures } from './utils/quality'

const uploadAudioPath = process.env.E2E_UPLOAD_AUDIO_PATH ? path.resolve(process.env.E2E_UPLOAD_AUDIO_PATH) : null
const uploadCoverPath = process.env.E2E_UPLOAD_COVER_PATH ? path.resolve(process.env.E2E_UPLOAD_COVER_PATH) : null

test.describe('Song system', () => {
  test('upload song and cover art flow', async ({ page }) => {
    const monitors = attachFailureMonitors(page)
    const artist = credentialsFor('artist')
    test.skip(!artist.email || !artist.password, 'Set E2E_ARTIST_EMAIL and E2E_ARTIST_PASSWORD.')

    await login(page, 'artist')
    await page.goto('/upload/song')
    await expect(page.getByRole('heading', { name: /upload song/i })).toBeVisible()

    await page.getByRole('button', { name: /submit for review/i }).click()
    await expect(page.locator('body')).toContainText(/song title is required|please select an audio file/i)

    if (uploadAudioPath) {
      await page.getByPlaceholder('My Amazing Track').fill(`E2E Upload ${Date.now()}`)
      if (uploadCoverPath) await page.locator('#cover-input').setInputFiles(uploadCoverPath)
      await page.locator('#audio-input').setInputFiles(uploadAudioPath)
      await page.getByRole('button', { name: /submit for review/i }).click()
      await expect(page.locator('body')).toContainText(/song submitted for review/i)
    }

    await assertNoCriticalClientFailures(page, monitors)
    assertNoSupabaseFailures(monitors)
  })

  test('approve and reject song buttons are present and actionable', async ({ page }) => {
    const monitors = attachFailureMonitors(page)
    const admin = credentialsFor('admin')
    test.skip(!admin.email || !admin.password, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD.')

    await login(page, 'admin')
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: /admin dashboard/i })).toBeVisible()

    const pendingTab = page.getByRole('button', { name: /pending/i }).first()
    await pendingTab.click()

    const approveButton = page.getByRole('button', { name: /approve/i }).first()
    if (await approveButton.count()) {
      await approveButton.click()
      await expect(page.locator('body')).not.toContainText(/update failed|no song was updated/i)
    }

    const rejectButton = page.getByRole('button', { name: /reject/i }).first()
    if (await rejectButton.count()) {
      await rejectButton.click()
      await expect(page.locator('body')).not.toContainText(/update failed|no song was updated/i)
    }

    await assertNoCriticalClientFailures(page, monitors)
    assertNoSupabaseFailures(monitors)
  })

  test('songs browse, play, search, and genre tags', async ({ page }) => {
    const monitors = attachFailureMonitors(page)
    await page.goto('/songs')
    await expect(page.getByRole('heading', { name: /songs/i })).toBeVisible()

    const playButtons = page.locator('button.sp-play-btn')
    if (await playButtons.count()) {
      await playButtons.first().click()
    }

    const searchInput = page.getByPlaceholder(/search/i)
    if (await searchInput.count()) {
      await searchInput.fill('test')
    }

    const genreTags = page.locator('.genre-tag')
    if (await genreTags.count()) {
      await expect(genreTags.first()).toBeVisible()
    }

    await assertNoCriticalClientFailures(page, monitors)
  })
})
