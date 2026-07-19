import { test, expect } from '@playwright/test'
import { openApp, reloadApp, seedCampaign, collectAppErrors, expectHudBudgetValid } from './helpers'

// E2E-02: a mid-campaign save survives reload, and ?intro is a clean, durable
// reset. Asserted through DOM locators only.

test('a mid-campaign save survives reload (sprint / day / team / budget)', async ({ page }) => {
  const errors = collectAppErrors(page)
  await seedCampaign(page, { sprintNumber: 3, day: 4, withIlya: true })
  await openApp(page)
  await expect(page.getByText('Спринт 3')).toBeVisible({ timeout: 30_000 })
  // reload exercises the app's OWN persistence (the one-time seed does not re-apply)
  await reloadApp(page)

  await expect(page.getByText('Спринт 3')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/День 4/)).toBeVisible()
  await expect(page.getByText(/Команда: 4/)).toBeVisible()
  await expectHudBudgetValid(page)

  expect(errors, `unexpected app errors:\n${errors.join('\n')}`).toEqual([])
})

test('?intro wipes the save and replays the intro, durably', async ({ page }) => {
  await seedCampaign(page, { sprintNumber: 4, day: 2 })
  await openApp(page)
  await expect(page.getByText('Спринт 4')).toBeVisible({ timeout: 30_000 })

  // ?intro clears every store key (the sentinel is untouched, so the one-time
  // seed does not come back), then a plain reload stays on the fresh game.
  await page.goto('/?intro', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Совет директоров')).toBeVisible({ timeout: 20_000 })

  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Совет директоров')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('Спринт 4')).toHaveCount(0)
})
