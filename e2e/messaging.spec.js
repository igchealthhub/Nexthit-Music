import { test, expect } from '@playwright/test'
import { credentialsFor, login } from './utils/auth'
import { attachFailureMonitors, assertNoCriticalClientFailures, assertNoSupabaseFailures } from './utils/quality'

test.describe('Messaging flow', () => {
  test('fan can message artist and receive reply', async ({ browser }) => {
    const fan = credentialsFor('fan')
    const artist = credentialsFor('artist')
    test.skip(!fan.email || !fan.password, 'Set E2E_FAN_EMAIL and E2E_FAN_PASSWORD to run messaging test.')
    test.skip(!artist.email || !artist.password, 'Set E2E_ARTIST_EMAIL and E2E_ARTIST_PASSWORD to run messaging test.')

    const fanContext = await browser.newContext()
    const artistContext = await browser.newContext()

    const fanPage = await fanContext.newPage()
    const artistPage = await artistContext.newPage()

    const fanMonitors = attachFailureMonitors(fanPage)
    const artistMonitors = attachFailureMonitors(artistPage)

    const token = `e2e-msg-${Date.now()}`
    const fanToArtist = `Fan to artist ${token}`
    const artistReply = `Artist reply ${token}`

    try {
      await login(fanPage, 'fan')
      await expect(fanPage).toHaveURL(/\/dashboard/)

      await fanPage.goto('/songs')
      const messageArtistButton = fanPage.getByRole('link', { name: /message artist/i }).first()
      const hasSongMessageEntry = await messageArtistButton.count().then(count => count > 0)
      test.skip(!hasSongMessageEntry, 'No visible Message Artist entry on Songs page. Ensure at least one approved song exists.')

      await messageArtistButton.click()
      await expect(fanPage).toHaveURL(/\/messages/)
      await expect(fanPage.getByRole('heading', { name: /messages/i })).toBeVisible()

      await fanPage.getByPlaceholder('Type a message…').fill(fanToArtist)
      await fanPage.getByRole('button', { name: /^send$/i }).click()
      await expect(fanPage.getByText(fanToArtist)).toBeVisible()

      await login(artistPage, 'artist')
      await expect(artistPage).toHaveURL(/\/dashboard/)
      await artistPage.goto('/messages')
      await expect(artistPage.getByRole('heading', { name: /messages/i })).toBeVisible()

      await expect(artistPage.getByText(fanToArtist)).toBeVisible({ timeout: 20_000 })
      await artistPage.getByPlaceholder('Type a message…').fill(artistReply)
      await artistPage.getByRole('button', { name: /^send$/i }).click()
      await expect(artistPage.getByText(artistReply)).toBeVisible()

      const fanReplyLocator = fanPage.getByText(artistReply)
      try {
        await expect(fanReplyLocator).toBeVisible({ timeout: 10_000 })
      } catch {
        await fanPage.reload()
        await expect(fanPage.getByRole('heading', { name: /messages/i })).toBeVisible()
        await expect(fanReplyLocator).toBeVisible({ timeout: 10_000 })
      }

      await fanPage.reload()
      await expect(fanPage.getByText(fanToArtist)).toBeVisible()
      await expect(fanPage.getByText(artistReply)).toBeVisible()

      await assertNoCriticalClientFailures(fanPage, fanMonitors)
      await assertNoCriticalClientFailures(artistPage, artistMonitors)
      assertNoSupabaseFailures(fanMonitors)
      assertNoSupabaseFailures(artistMonitors)
    } finally {
      await fanContext.close()
      await artistContext.close()
    }
  })
})
