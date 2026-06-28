import { test, expect } from '@playwright/test'
import { credentialsFor, login } from './utils/auth'
import { attachFailureMonitors, assertNoCriticalClientFailures, assertNoSupabaseFailures } from './utils/quality'

test.describe('Contests', () => {
  test('create and edit contest', async ({ page }) => {
    const monitors = attachFailureMonitors(page)
    const admin = credentialsFor('admin')
    test.skip(!admin.email || !admin.password, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD.')

    await login(page, 'admin')
    await page.goto('/admin')
    await page.getByRole('button', { name: /contests/i }).first().click()
    await expect(page.getByText(/create contest/i)).toBeVisible()

    const contestName = `E2E Contest ${Date.now()}`
    await page.locator('input.input').first().fill(contestName)
    await page.getByRole('button', { name: /^create contest$/i }).click()

    await expect(page.locator('body')).toContainText(contestName)

    const draftButton = page.getByRole('button', { name: /^draft$/i }).first()
    if (await draftButton.count()) await draftButton.click()

    const activeButton = page.getByRole('button', { name: /^active$/i }).first()
    if (await activeButton.count()) await activeButton.click()

    await assertNoCriticalClientFailures(page, monitors)
    assertNoSupabaseFailures(monitors)
  })

  test('artist enter contest', async ({ page }) => {
    const monitors = attachFailureMonitors(page)
    const artist = credentialsFor('artist')
    test.skip(!artist.email || !artist.password, 'Set E2E_ARTIST_EMAIL and E2E_ARTIST_PASSWORD.')

    await login(page, 'artist')
    await page.goto('/contests')

    const contestLinks = page.getByRole('link', { name: /vote & enter|view/i })
    test.skip(!(await contestLinks.count()), 'No contests available for entry test.')

    await contestLinks.first().click()

    const enterButton = page.getByRole('button', { name: /enter contest/i })
    if (await enterButton.count()) {
      await enterButton.click()
      const submitEntry = page.getByRole('button', { name: /submit entry/i })
      if (await submitEntry.count()) {
        const songSelect = page.locator('select.input').first()
        if ((await songSelect.count()) && (await songSelect.locator('option').count()) > 1) {
          await songSelect.selectOption({ index: 1 })
          await submitEntry.click()
        }
      }
    }

    await assertNoCriticalClientFailures(page, monitors)
    assertNoSupabaseFailures(monitors)
  })

  test('fan vote and leaderboard', async ({ page }) => {
    const monitors = attachFailureMonitors(page)
    const fan = credentialsFor('fan')
    test.skip(!fan.email || !fan.password, 'Set E2E_FAN_EMAIL and E2E_FAN_PASSWORD.')

    await login(page, 'fan')
    await page.goto('/contests')
    await expect(page.getByRole('heading', { name: /contests/i })).toBeVisible()

    const contestLinks = page.getByRole('link', { name: /vote & enter|view/i })
    test.skip(!(await contestLinks.count()), 'No contests available for voting test.')

    await contestLinks.first().click()
    await expect(page.getByText(/leaderboard/i)).toBeVisible()

    const voteButton = page.getByRole('button', { name: /vote|voted/i }).first()
    if (await voteButton.count()) {
      await voteButton.click()
    }

    await assertNoCriticalClientFailures(page, monitors)
    assertNoSupabaseFailures(monitors)
  })
})
