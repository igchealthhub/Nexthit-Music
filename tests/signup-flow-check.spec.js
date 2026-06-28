import { test, expect } from '@playwright/test'

function uniqueEmail(prefix) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 10000)}@nexthit.test`
}

async function submitAndAssertVisibleOutcome(page) {
  await page.getByRole('button', { name: /create account/i }).click()

  const success = page.getByText(/check your email/i)
  const error = page.locator('.alert.alert-error')

  await expect
    .poll(async () => {
      const successVisible = await success.isVisible().catch(() => false)
      const errorVisible = await error.isVisible().catch(() => false)
      if (successVisible) return 'success'
      if (errorVisible) return 'error'
      return 'pending'
    }, { timeout: 15000 })
    .not.toBe('pending')
}

test.describe('Signup flow checks', () => {
  test('fan signup submits and resolves with visible result', async ({ page }) => {
    await page.goto('/signup')
    await page.getByPlaceholder('Your name').fill('Fan QA')
    await page.getByPlaceholder('you@example.com').fill(uniqueEmail('fan'))
    await page.getByPlaceholder('Min. 6 characters').fill('nexthit123')
    await page.getByRole('checkbox', { name: /terms of service and privacy policy/i }).check()

    await submitAndAssertVisibleOutcome(page)
  })

  test('artist signup submits and resolves with visible result', async ({ page }) => {
    await page.goto('/signup')
    await page.getByPlaceholder('Your name').fill('Artist QA')
    await page.getByPlaceholder('you@example.com').fill(uniqueEmail('artist'))
    await page.getByPlaceholder('Min. 6 characters').fill('nexthit123')
    await page.getByText(/artist/i).first().click()

    await page.getByRole('checkbox', { name: /terms of service and privacy policy/i }).check()
    await page.getByRole('checkbox', { name: /artist agreement/i }).check()

    await submitAndAssertVisibleOutcome(page)
  })
})
