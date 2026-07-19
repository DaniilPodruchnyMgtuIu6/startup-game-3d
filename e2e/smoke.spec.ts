import { test, expect } from '@playwright/test'
import { openApp, seedCampaign, collectAppErrors, clickWhenReady, expectHudBudgetValid } from './helpers'

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

// Regression for the frameloop bug: accepting the job LIVE (intro → name →
// meetPm office) must transition into the running office scene without leaving a
// blank/dead canvas. Seeding free-play directly does NOT cover this — the bug
// was specifically the intro→gameplay transition. We assert the transition lands
// in the meet-the-PM phase (intro dismissed, canvas alive, no app error).
// Note: headless SwiftShader can't capture 3D canvas pixels (see docs/qa KI-06),
// so this proves the transition doesn't crash; the visible render is checked on
// a real GPU. (clickWhenReady tolerates the model-decode window.)
test('accepting the job transitions from the intro into the office scene', async ({ page }) => {
  const errors = collectAppErrors(page)
  await page.addInitScript(() => localStorage.clear())
  await openApp(page)
  await expect(page.getByText('Совет директоров')).toBeVisible({ timeout: 20_000 })

  await clickWhenReady(page, 'Далее', 90)
  await clickWhenReady(page, 'Далее', 90)
  await clickWhenReady(page, 'Берусь за дело', 90)
  await page.getByPlaceholder('Ваше имя').fill('Тестовый директор', { timeout: 20_000 })
  await clickWhenReady(page, 'Приступить', 90)

  // the intro is dismissed and the office scene is up (meet-the-PM phase)
  await expect(page.getByText('Совет директоров')).toHaveCount(0, { timeout: 30_000 })
  await expect(page.locator('canvas')).toBeVisible()
  // the intro/fired overlays are gone — we are in a live gameplay phase
  await expect(page.getByText('Вы уволены!')).toHaveCount(0)
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
