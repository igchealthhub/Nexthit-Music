import path from 'path'
import { test, expect } from '@playwright/test'
import { attachFailureMonitors, assertNoCriticalClientFailures, assertNoSupabaseFailures } from './utils/quality'

const uploadAudioPath = process.env.E2E_UPLOAD_AUDIO_PATH ? path.resolve(process.env.E2E_UPLOAD_AUDIO_PATH) : null

test.describe('Artist onboarding', () => {
  test('artist signup creates artist profile and allows song upload', async ({ page }) => {
    const monitors = attachFailureMonitors(page)
    test.skip(!uploadAudioPath, 'Set E2E_UPLOAD_AUDIO_PATH to run upload verification.')

    const unique = Date.now()
    const email = `artist.e2e.${unique}@nexthit.test`
    const password = 'nexthit123'
    const title = `Artist Onboarding Upload ${unique}`

    await page.goto('/signup')
    await page.getByPlaceholder('Your name').fill(`Artist ${unique}`)
    await page.getByPlaceholder('you@example.com').fill(email)
    await page.getByPlaceholder('Min. 6 characters').fill(password)
    await page.getByText(/artist/i).first().click()

    const terms = page.getByRole('checkbox', { name: /terms of service and privacy policy/i })
    if (await terms.count()) {
      await terms.check()
    }

    const artistAgreement = page.getByRole('checkbox', { name: /artist agreement/i })
    if (await artistAgreement.count()) {
      await artistAgreement.check()
    }

    await page.getByRole('button', { name: /create account/i }).click()

    const checkEmailMessage = page.getByText(/check your email/i)
    if (await checkEmailMessage.count()) {
      // If email confirmation is required, complete login manually with this user to continue this test.
      test.skip(true, 'Signup requires email confirmation before login.')
    }

    await page.goto('/upload/song')
    await expect(page.getByRole('heading', { name: /upload song/i })).toBeVisible()

    const createArtistProfileButton = page.getByRole('button', { name: /create artist profile/i })
    if (await createArtistProfileButton.count()) {
      await createArtistProfileButton.click()
      await page.waitForLoadState('networkidle')
      await page.goto('/upload/song')
    }

    await expect(page.locator('body')).not.toContainText(/no artist profile exists for this account/i)

    await page.getByPlaceholder('My Amazing Track').fill(title)
    await page.locator('#audio-input').setInputFiles(uploadAudioPath)
    await page.getByRole('button', { name: /submit for review/i }).click()

    await expect(page.locator('body')).toContainText(/song uploaded successfully and is waiting for admin approval/i)
    await assertNoCriticalClientFailures(page, monitors)
    assertNoSupabaseFailures(monitors)
  })
})
