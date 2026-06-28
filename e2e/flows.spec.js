import { test } from '@playwright/test'

test.describe('Legacy flow file', () => {
  test('migrated to dedicated suites', async () => {
    test.skip(true, 'Flow coverage now lives in auth.spec.js, song-system.spec.js, contests.spec.js, and profile-admin.spec.js')
  })
})
