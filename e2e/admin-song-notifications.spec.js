import path from 'path'
import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { credentialsFor, login, logoutIfNeeded } from './utils/auth'
import { attachFailureMonitors, assertNoCriticalClientFailures } from './utils/quality'

const uploadAudioPath = process.env.E2E_UPLOAD_AUDIO_PATH ? path.resolve(process.env.E2E_UPLOAD_AUDIO_PATH) : null
const rpcSupabaseUrl = process.env.E2E_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const rpcSupabaseAnonKey = process.env.E2E_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

async function triggerPendingSongNotificationViaRpc(artistEmail, artistPassword, songTitle) {
  if (!rpcSupabaseUrl || !rpcSupabaseAnonKey) {
    throw new Error('Missing Supabase URL/key for RPC fallback. Set E2E_SUPABASE_URL and E2E_SUPABASE_ANON_KEY.')
  }

  const supabase = createClient(rpcSupabaseUrl, rpcSupabaseAnonKey)

  const signIn = await supabase.auth.signInWithPassword({
    email: artistEmail,
    password: artistPassword,
  })

  if (signIn.error) {
    throw new Error(`RPC fallback artist sign-in failed: ${signIn.error.message}`)
  }

  const songId = crypto.randomUUID()
  const rpcResult = await supabase.rpc('notify_admins_song_pending', {
    p_song_id: songId,
    p_song_title: songTitle,
  })

  await supabase.auth.signOut()

  if (rpcResult.error) {
    throw new Error(`RPC fallback failed: ${rpcResult.error.message}`)
  }

  return rpcResult.data
}

test.describe('Admin pending approval notifications', () => {
  test('artist upload creates admin notification and appears in pending approvals', async ({ page }) => {
    const monitors = attachFailureMonitors(page)
    const artist = credentialsFor('artist')
    const admin = credentialsFor('admin')

    test.skip(!artist.email || !artist.password, 'Set E2E_ARTIST_EMAIL and E2E_ARTIST_PASSWORD.')
    test.skip(!admin.email || !admin.password, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD.')
    test.skip(!uploadAudioPath, 'Set E2E_UPLOAD_AUDIO_PATH to a valid audio file.')

    const songTitle = `E2E Pending Notification ${Date.now()}`

    await login(page, 'artist')
    await page.goto('/upload/song')
    await expect(page.getByRole('heading', { name: /upload song/i })).toBeVisible()

    await page.getByPlaceholder('My Amazing Track').fill(songTitle)
    await page.locator('#audio-input').setInputFiles(uploadAudioPath)
    await page.getByRole('button', { name: /submit for review/i }).click()
    await expect(page.locator('body')).toContainText(/song submitted for review/i)

    await logoutIfNeeded(page)
    await login(page, 'admin')

    await page.goto('/notifications')
    await expect(page.getByRole('heading', { name: /notifications/i })).toBeVisible()

    const notificationRow = page.locator('div').filter({ hasText: `New song pending approval: ${songTitle}` }).first()
    await expect(notificationRow).toBeVisible({ timeout: 20_000 })

    const markReadButton = notificationRow.getByRole('button', { name: /mark read/i })
    if (await markReadButton.count()) {
      await markReadButton.click()
      await expect(markReadButton).toHaveCount(0)
    }

    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: /admin dashboard/i })).toBeVisible()
    await page.getByRole('button', { name: /pending/i }).first().click()
    await expect(page.locator('body')).toContainText(songTitle)

    await assertNoCriticalClientFailures(page, monitors)
  })

  test('fallback mode validates notification RPC without file upload', async ({ page }) => {
    const monitors = attachFailureMonitors(page)
    const artist = credentialsFor('artist')
    const admin = credentialsFor('admin')

    test.skip(!artist.email || !artist.password, 'Set E2E_ARTIST_EMAIL and E2E_ARTIST_PASSWORD.')
    test.skip(!admin.email || !admin.password, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD.')

    const songTitle = `E2E RPC Pending Notification ${Date.now()}`
    const fallbackData = await triggerPendingSongNotificationViaRpc(artist.email, artist.password, songTitle)

    expect(fallbackData).toBeTruthy()
    expect(fallbackData.status).toBe('ok')
    expect(Number(fallbackData.inserted || 0)).toBeGreaterThan(0)

    await login(page, 'admin')
    await page.goto('/notifications')
    await expect(page.getByRole('heading', { name: /notifications/i })).toBeVisible()

    const notificationRow = page.locator('div').filter({ hasText: `New song pending approval: ${songTitle}` }).first()
    await expect(notificationRow).toBeVisible({ timeout: 20_000 })

    const markReadButton = notificationRow.getByRole('button', { name: /mark read/i })
    if (await markReadButton.count()) {
      await markReadButton.click()
      await expect(markReadButton).toHaveCount(0)
    }

    await assertNoCriticalClientFailures(page, monitors)
  })
})
