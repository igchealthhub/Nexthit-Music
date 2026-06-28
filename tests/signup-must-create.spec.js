import { test, expect } from '@playwright/test'

function uniqueEmail(prefix) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 10000)}@nexthit.test`
}

test.describe('Signup must create users', () => {
  test('fan signup creates an auth user', async ({ page }) => {
    await page.goto('/signup')

    await page.getByPlaceholder('Your name').fill('Fan Create')
    await page.getByPlaceholder('you@example.com').fill(uniqueEmail('fan.create'))
    await page.getByPlaceholder('Min. 6 characters').fill('nexthit123')
    await page.getByRole('checkbox', { name: /terms of service and privacy policy/i }).check()

    await page.getByRole('button', { name: /create account/i }).click()

    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 20000 })
  })

  test('artist signup creates an auth user', async ({ page }) => {
    await page.goto('/signup')

    await page.getByPlaceholder('Your name').fill('Artist Create')
    await page.getByPlaceholder('you@example.com').fill(uniqueEmail('artist.create'))
    await page.getByPlaceholder('Min. 6 characters').fill('nexthit123')
    await page.locator('.role-option').nth(1).click()

    await page.getByRole('checkbox', { name: /terms of service and privacy policy/i }).check()
    await page.getByRole('checkbox', { name: /artist agreement/i }).check()

    await page.getByRole('button', { name: /create account/i }).click()

    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 20000 })
  })
})
