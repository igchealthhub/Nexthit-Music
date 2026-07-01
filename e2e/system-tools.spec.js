import { test, expect } from '@playwright/test'
import { credentialsFor, login } from './utils/auth'
import { attachFailureMonitors, assertNoCriticalClientFailures } from './utils/quality'

test.describe('Admin System Tools', () => {
  test('clean test data runs and returns a success payload', async ({ page }) => {
    const monitors = attachFailureMonitors(page)
    const admin = credentialsFor('admin')
    test.skip(!admin.email || !admin.password, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD.')

    await login(page, 'admin')
    await page.goto('/admin/system-tools')

    await expect(page.getByRole('heading', { name: /admin system tools/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /clean test data/i })).toBeVisible()

    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: /clean test data/i }).click()

    const resultBlock = page.locator('pre').first()
    await expect(resultBlock).toBeVisible({ timeout: 20_000 })

    const raw = await resultBlock.innerText()
    const parsed = JSON.parse(raw)

    expect(parsed).toBeTruthy()
    expect(parsed.status).toBe('ok')
    expect(typeof parsed.users_deleted).toBe('number')

    await assertNoCriticalClientFailures(page, monitors)
  })
})
