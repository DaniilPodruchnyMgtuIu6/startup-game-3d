import { test, expect } from '@playwright/test'
import { openApp, collectAppErrors } from './helpers'

// Regression for the white-screen crash at the meet-the-PM → free-play
// transition. A conditional hook (`phase==='free' && useSprintStore(...)`) in
// the relocated whiteboard changed the hook order across this exact transition
// and crashed React/R3F. This drives the real flow: seed the meetPm phase, walk
// to the PM, click through her intro, close it with "За работу", and require
// free play to come up with no uncaught error.
test('completing the PM conversation reaches free play without crashing', async ({ page }) => {
  const errors = collectAppErrors(page)
  await page.addInitScript(() =>
    localStorage.setItem('startup-office-progress', JSON.stringify({ playerName: 'Тест', phase: 'meetPm', tasks: [], reprimands: 0 })),
  )
  await openApp(page)

  // Walk to the PM: her marker triggers the walk, and the intro dialogue opens
  // on arrival. Re-nudge the click until the dialogue appears (the walk takes a
  // few seconds under software rendering; a single click can land before the
  // scene is ready to path).
  // the PM meeting is a mandatory story beat — its marker is the amber "!" story
  // marker (Feature 16 §5), distinct from the free-chat bubble.
  const marker = page.locator('.npc-marker--story').first()
  await marker.waitFor({ state: 'visible', timeout: 30_000 })
  const dialogue = page.locator('.dialogue-panel')
  for (let i = 0; i < 20; i++) {
    if (await dialogue.isVisible().catch(() => false)) break
    await marker.click({ force: true }).catch(() => {})
    await page.waitForTimeout(2000)
  }
  await expect(dialogue).toBeVisible({ timeout: 30_000 })

  // advance through the intro lines and close with "За работу"
  for (let i = 0; i < 20; i++) {
    const done = page.getByRole('button', { name: 'За работу' })
    if (await done.isVisible().catch(() => false)) {
      await done.click({ force: true })
      break
    }
    await page.locator('.dialogue-panel button').last().click({ force: true }).catch(() => {})
    await page.waitForTimeout(400)
  }

  // free play is up (sprint HUD), the canvas is alive, and nothing crashed
  await expect(page.getByText('Спринт 1')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('canvas')).toBeVisible()
  expect(errors, `unexpected app errors:\n${errors.join('\n')}`).toEqual([])
})
