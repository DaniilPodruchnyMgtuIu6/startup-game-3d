import { test, expect } from '@playwright/test'
import { openApp, seedCampaign, collectAppErrors } from './helpers'

// Feature 16 §1: the living Workday Flow. In production there is no manual
// end-day button — an active sprint day plays a short beat and then advances
// automatically through completeWorkday, surfacing the daily report, with no
// player click.
test('the workday advances automatically, with no manual end-day button', async ({ page }) => {
  const errors = collectAppErrors(page)
  await seedCampaign(page, { sprintNumber: 2, day: 2 })
  await openApp(page)

  await expect(page.getByText('Спринт 2')).toBeVisible({ timeout: 30_000 })
  // the manual button is dev-only — absent from the production build
  await expect(page.getByRole('button', { name: /Завершить рабочий день/ })).toHaveCount(0)

  // no interaction: the day auto-completes and the daily report appears
  await expect(page.getByText(/Итоги дня/)).toBeVisible({ timeout: 25_000 })

  expect(errors, `unexpected app errors:\n${errors.join('\n')}`).toEqual([])
})

// Feature 16 §2: the first day of a sprint opens with a plan-aware kickoff.
test('a sprint starts with a kickoff dialogue at the board', async ({ page }) => {
  await seedCampaign(page, { sprintNumber: 2, day: 1 })
  await openApp(page)
  await expect(page.getByText(/Планёрка спринта 2/)).toBeVisible({ timeout: 30_000 })
})
