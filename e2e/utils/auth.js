import { expect } from '@playwright/test'

export function credentialsFor(role) {
  const normalized = String(role).toUpperCase()
  const email = process.env[`E2E_${normalized}_EMAIL`]
  const password = process.env[`E2E_${normalized}_PASSWORD`]
  return { email, password }
}

export async function login(page, role) {
  const { email, password } = credentialsFor(role)
  if (!email || !password) {
    throw new Error(`Missing credentials for ${role}. Set E2E_${String(role).toUpperCase()}_EMAIL and E2E_${String(role).toUpperCase()}_PASSWORD`)
  }

  await page.goto('/login')
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
}

export async function logoutIfNeeded(page) {
  await page.goto('/')
  const logout = page.getByRole('button', { name: /log out/i })
  if (await logout.count()) {
    await logout.click()
    await expect(page.getByRole('link', { name: /log in/i })).toBeVisible()
  }
}

export async function assertNoBlankPage(page) {
  await expect(page.locator('main.app-main')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('Cannot read properties of null')
  await expect(page.locator('body')).not.toContainText('TypeError:')
}
