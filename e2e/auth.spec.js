import { test, expect } from '@playwright/test'
import { credentialsFor, logoutIfNeeded } from './utils/auth'
import { attachFailureMonitors, assertNoCriticalClientFailures } from './utils/quality'

test.describe('Authentication', () => {
  test('signup', async ({ page }) => {
    const monitors = attachFailureMonitors(page)
    const signupEmail = process.env.E2E_SIGNUP_EMAIL
    const signupPassword = process.env.E2E_SIGNUP_PASSWORD || 'nexthit123'
    const displayName = process.env.E2E_SIGNUP_NAME || 'E2E User'

    test.skip(!signupEmail, 'Set E2E_SIGNUP_EMAIL to run signup submission test.')

    await page.goto('/signup')
    await page.getByPlaceholder('Your name').fill(displayName)
    await page.getByPlaceholder('you@example.com').fill(signupEmail)
    await page.getByPlaceholder('Min. 6 characters').fill(signupPassword)
    await page.getByText(/artist/i).first().click()
    await page.getByRole('button', { name: /create account/i }).click()
    await expect(page.getByText(/check your email/i)).toBeVisible()

    await assertNoCriticalClientFailures(page, monitors)
  })

  test('login and logout', async ({ page }) => {
    const monitors = attachFailureMonitors(page)
    const fan = credentialsFor('fan')
    test.skip(!fan.email || !fan.password, 'Set E2E_FAN_EMAIL and E2E_FAN_PASSWORD to run login/logout test.')

    await logoutIfNeeded(page)
    await page.goto('/login')
    await page.getByPlaceholder('you@example.com').fill(fan.email)
    await page.getByPlaceholder('••••••••').fill(fan.password)
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByText(/debug profile/i)).toBeVisible()

    await page.getByRole('button', { name: /log out/i }).click()
    await expect(page.getByRole('link', { name: /log in/i })).toBeVisible()

    await assertNoCriticalClientFailures(page, monitors)
  })

  test('forgot password', async ({ page }) => {
    const monitors = attachFailureMonitors(page)
    const resetEmail = process.env.E2E_RESET_EMAIL || process.env.E2E_FAN_EMAIL
    test.skip(!resetEmail, 'Set E2E_RESET_EMAIL (or E2E_FAN_EMAIL) to run forgot password test.')

    await page.goto('/forgot-password')
    await page.getByPlaceholder('you@example.com').fill(resetEmail)
    await page.getByRole('button', { name: /send reset link/i }).click()

    await expect(page.locator('body')).toContainText(/check your email|error/i)
    await assertNoCriticalClientFailures(page, monitors)
  })
})
