import { expect } from '@playwright/test'

const ALLOWED_CONSOLE_PATTERNS = [
  /Auth session loaded null/i,
  /Auth session changed INITIAL_SESSION null/i,
]

export function attachFailureMonitors(page) {
  const consoleErrors = []
  const networkFailures = []

  page.on('console', message => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (ALLOWED_CONSOLE_PATTERNS.some(re => re.test(text))) return
    consoleErrors.push(text)
  })

  page.on('response', response => {
    const status = response.status()
    if (status < 400) return

    const url = response.url()
    const isSupabase = /supabase\.co|supabase\.in/.test(url)
    const isAuthNoise = /\/rest\/v1\/(notifications|messages)/.test(url) && status === 401
    if (isSupabase && isAuthNoise) return

    networkFailures.push(`${status} ${url}`)
  })

  return {
    consoleErrors,
    networkFailures,
  }
}

export async function assertNoCriticalClientFailures(page, monitors) {
  await expect(page.locator('main.app-main')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('Cannot read properties of null')
  await expect(page.locator('body')).not.toContainText('TypeError:')

  expect(
    monitors.consoleErrors,
    `Unexpected console errors:\n${monitors.consoleErrors.join('\n')}`,
  ).toEqual([])
}

export function assertNoSupabaseFailures(monitors) {
  const supabaseFailures = monitors.networkFailures.filter(failure => /supabase\.co|supabase\.in/.test(failure))
  expect(
    supabaseFailures,
    `Unexpected Supabase failures:\n${supabaseFailures.join('\n')}`,
  ).toEqual([])
}
