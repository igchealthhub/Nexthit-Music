import path from 'path'
import { test, expect } from '@playwright/test'
import { login, credentialsFor, assertNoBlankPage } from './utils/auth'

const uploadAudioPath = process.env.E2E_UPLOAD_AUDIO_PATH
  ? path.resolve(process.env.E2E_UPLOAD_AUDIO_PATH)
  : null

test.describe('Artist and fan contest flows', () => {
  test('artist can open upload song page and submit validations', async ({ page }) => {
    const artist = credentialsFor('artist')
    test.skip(!artist.email || !artist.password, 'Set E2E_ARTIST_EMAIL and E2E_ARTIST_PASSWORD to run artist upload test.')

    await login(page, 'artist')
    await page.goto('/upload/song')
    await expect(page.getByRole('heading', { name: /upload song/i })).toBeVisible()

    await page.getByRole('button', { name: /submit for review/i }).click()
    await expect(page.getByText(/song title is required|please select an audio file/i)).toBeVisible()

    if (uploadAudioPath) {
      await page.getByPlaceholder('My Amazing Track').fill(`E2E Upload ${Date.now()}`)
      await page.locator('#audio-input').setInputFiles(uploadAudioPath)
      await page.getByRole('button', { name: /submit for review/i }).click()
      await expect(page.getByText(/song submitted for review/i)).toBeVisible({ timeout: 30_000 })
    }

    await assertNoBlankPage(page)
  })

  test('admin can open admin dashboard and contests manager', async ({ page }) => {
    const admin = credentialsFor('admin')
    test.skip(!admin.email || !admin.password, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run admin flow test.')

    await login(page, 'admin')
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: /admin dashboard/i })).toBeVisible()

    const contestsTab = page.getByRole('button', { name: /contests/i }).first()
    await contestsTab.click()
    await expect(page.getByText(/create contest/i)).toBeVisible()

    await page.locator('input.input').first().fill(`E2E Contest ${Date.now()}`)
    await page.getByRole('button', { name: /^create contest$/i }).click()

    await expect(page.locator('body')).not.toContainText('Could not create contest')
    await assertNoBlankPage(page)
  })

  test('fan can open contests page and vote UI is accessible', async ({ page }) => {
    const fan = credentialsFor('fan')
    test.skip(!fan.email || !fan.password, 'Set E2E_FAN_EMAIL and E2E_FAN_PASSWORD to run fan voting flow test.')

    await login(page, 'fan')
    await page.goto('/contests')
    await expect(page.getByRole('heading', { name: /contests/i })).toBeVisible()

    const contestLinks = page.getByRole('link', { name: /vote & enter|view/i })
    if (await contestLinks.count()) {
      await contestLinks.first().click()
      await expect(page).toHaveURL(/\/contests\/[0-9a-f-]+/i)

      const voteButtons = page.getByRole('button', { name: /vote|voted/i })
      if (await voteButtons.count()) {
        await voteButtons.first().click()
      }
    }

    await assertNoBlankPage(page)
  })

  test('profile page loads for logged in user', async ({ page }) => {
    const fan = credentialsFor('fan')
    test.skip(!fan.email || !fan.password, 'Set E2E_FAN_EMAIL and E2E_FAN_PASSWORD to run profile test.')

    await login(page, 'fan')
    await page.goto('/profile')
    await expect(page.getByRole('heading', { name: /your profile/i })).toBeVisible()
    await assertNoBlankPage(page)
  })
})
