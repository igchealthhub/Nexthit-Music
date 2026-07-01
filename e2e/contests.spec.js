import { test, expect } from '@playwright/test'
import { credentialsFor, login } from './utils/auth'
import { attachFailureMonitors, assertNoCriticalClientFailures, assertNoSupabaseFailures } from './utils/quality'

test.describe('Contests', () => {
  test('admin manages contests and public visibility', async ({ page }) => {
    const monitors = attachFailureMonitors(page)
    const admin = credentialsFor('admin')
    test.skip(!admin.email || !admin.password, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD.')

    await login(page, 'admin')
    await page.goto('/admin/contests')
    await expect(page.getByRole('heading', { name: /contest manager/i })).toBeVisible()

    const draftTitle = `E2E Draft Contest ${Date.now()}`
    const activeTitle = `E2E Active Contest ${Date.now()}`
    const updatedPrize = `Updated Prize ${Date.now()}`

    // Create draft contest
    await page.getByLabel(/title/i).fill(draftTitle)
    await page.getByLabel(/description/i).fill('Draft contest for visibility testing')
    await page.getByLabel(/prize/i).fill('Draft prize')
    await page.getByLabel(/entry fee/i).fill('0')
    await page.getByLabel(/status/i).selectOption('draft')
    await page.getByRole('button', { name: /create contest/i }).click()
    await expect(page.getByText(draftTitle)).toBeVisible()

    // Create active contest
    await page.getByLabel(/title/i).fill(activeTitle)
    await page.getByLabel(/description/i).fill('Active contest for public visibility testing')
    await page.getByLabel(/prize/i).fill('Active prize')
    await page.getByLabel(/entry fee/i).fill('5')
    await page.getByLabel(/status/i).selectOption('active')
    await page.getByRole('button', { name: /create contest/i }).click()
    await expect(page.getByText(activeTitle)).toBeVisible()

    // Edit existing active contest
    const activeCard = page.locator('.card').filter({ hasText: activeTitle }).last()
    await activeCard.getByRole('button', { name: /edit/i }).click()
    await page.getByLabel(/prize/i).fill(updatedPrize)
    await page.getByRole('button', { name: /update contest/i }).click()
    await expect(page.getByText(updatedPrize)).toBeVisible()

    await assertNoCriticalClientFailures(page, monitors)
    assertNoSupabaseFailures(monitors)

    await page.goto('/contests')
    await expect(page.getByText(activeTitle)).toBeVisible()
    await expect(page.getByText(draftTitle)).toHaveCount(0)
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
