import { test, expect } from '@playwright/test'
import { openApp, collectAppErrors } from './helpers'

// Feature 17A: the mandatory baseline decision scene. From a fresh free-play
// save: hire both developers -> Sonya wears the amber "!" story marker -> walk
// up -> scripted dialogue -> the audit/hire fork -> reaction line -> the marker
// clears and the first sprint is no longer story-blocked.
test('the baseline decision scene runs end-to-end after both hires', async ({ page }) => {
  // The hire clicks + the walk to Sonya under software rendering take well over
  // the default budget - this spec drives the longest UI path in the suite.
  test.setTimeout(180_000)
  const errors = collectAppErrors(page)
  await page.addInitScript(() =>
    localStorage.setItem('startup-office-progress', JSON.stringify({ playerName: 'Тест', phase: 'free', tasks: [], reprimands: 0 })),
  )
  await openApp(page)

  await page.getByRole('button', { name: 'Перейти в офис' }).click({ timeout: 30_000 })

  // hire Kirill and Alina through the team panel
  await page.getByRole('button', { name: /Команда/ }).click()
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Нанять', exact: true }).first().click()
    await page.locator('button.primary', { hasText: 'Нанять' }).last().click()
    await page.waitForTimeout(600)
  }
  await page.getByRole('button', { name: 'Закрыть' }).click()

  // the mandatory story marker appears over Sonya; re-nudge the click until the
  // dialogue opens (the walk takes a few seconds under software rendering)
  const marker = page.locator('.npc-marker--story').first()
  await marker.waitFor({ state: 'visible', timeout: 30_000 })
  const dialogue = page.locator('.dialogue-panel')
  for (let i = 0; i < 20; i++) {
    if (await dialogue.isVisible().catch(() => false)) break
    await marker.click({ force: true }).catch(() => {})
    await page.waitForTimeout(2000)
  }
  await expect(dialogue).toBeVisible({ timeout: 30_000 })

  // advance Sonya's lines until the fork, order the external audit
  for (let i = 0; i < 20; i++) {
    const choice = page.getByRole('button', { name: 'Заказать аудит' })
    if (await choice.isVisible().catch(() => false)) {
      await choice.click({ force: true })
      break
    }
    await page.locator('.dialogue-panel button').last().click({ force: true }).catch(() => {})
    await page.waitForTimeout(400)
  }
  // close the reaction line; the resolved decision removes the marker for good
  await page.locator('.dialogue-panel button').last().click({ force: true }).catch(() => {})
  await expect(page.locator('.npc-marker--story')).toHaveCount(0, { timeout: 15_000 })

  expect(errors, `unexpected app errors:\n${errors.join('\n')}`).toEqual([])
})
