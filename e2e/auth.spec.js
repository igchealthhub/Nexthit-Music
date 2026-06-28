import { test, expect } from '@playwright/test'
import { credentialsFor, assertNoBlankPage, logoutIfNeeded } from './utils/auth'

test.describe('Auth flows', () => {
  test('signup page validates and submits', async ({ page }) => {
    const signupEmail = process.env.E2E_SIGNUP_EMAIL
    const signupPassword = process.env.E2E_SIGNUP_PASSWORD || 'nexthit123'
    const displayName = process.env.E2E_SIGNUP_NAME || 'E2E User'

    test.skip(!signupEmail, 'Set E2E_SIGNUP_EMAIL to run signup submission test.')

    await page.goto('/signup')
    await assertNoBlankPage(page)

    await page.getByLabel('Display name').fill(displayName)
    await page.getByLabel('Email').fill(signupEmail)
    await page.getByLabel('Password').fill(signupPassword)
    await page.getByText(/artist/i).first().click()
    await page.getByRole('button', { name: /create account/i }).click()

    await expect(page.getByText(/check your email/i)).toBeVisible()
  })

  test('login flow works for fan account', async ({ page }) => {
    const fan = credentialsFor('fan')
    test.skip(!fan.email || !fan.password, 'Set E2E_FAN_EMAIL and E2E_FAN_PASSWORD to run login test.')

    await logoutIfNeeded(page)
    await page.goto('/login')
    await page.getByLabel('Email').fill(fan.email)
    await page.getByLabel('Password').fill(fan.password)
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByText(/debug profile/i)).toBeVisible()
    await assertNoBlankPage(page)
  })
})
