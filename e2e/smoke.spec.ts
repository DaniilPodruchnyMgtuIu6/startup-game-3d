import { test, expect } from '@playwright/test'
import { openApp, seedCampaign, collectAppErrors, expectHudBudgetValid } from './helpers'

// E2E-01: the PRODUCTION bundle boots. Two boots that matter: the light intro
// screen, and the full 3D office from a mid-campaign save — both must come up
// with no application console error and no broken values in the UI.
// (The intro click-through is covered deterministically by the IntroOverlay
// unit test; driving it here is unreliable under GPU-less software rendering.)

test('fresh load boots into the intro with no app errors', async ({ page }) => {
  const errors = collectAppErrors(page)
  await page.addInitScript(() => localStorage.clear())
  await openApp(page)

  await expect(page.getByText('Совет директоров')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Далее' })).toBeVisible()
  // the leva dev render panel must not ship to players (production build)
  await expect(page.getByText('aoIntensity')).toHaveCount(0)

  expect(errors, `unexpected app errors:\n${errors.join('\n')}`).toEqual([])
})

test('the 3D office boots from a mid-campaign save with the correct HUD', async ({ page }) => {
  const errors = collectAppErrors(page)
  await seedCampaign(page, { sprintNumber: 3, day: 4, withIlya: true })
  await openApp(page)

  await expect(page.getByText('Спринт 3')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/Команда: 4/)).toBeVisible()
  await expectHudBudgetValid(page)

  expect(errors, `unexpected app errors:\n${errors.join('\n')}`).toEqual([])
})
