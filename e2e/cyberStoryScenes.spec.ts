import { test, expect } from '@playwright/test'
import { openApp } from './helpers'

// Feature 19: the three cyber-story incidents + their dev-only launcher.
//
// The dev launcher (window.__startupGameDev) MUST be absent from the
// production bundle this suite runs against - a fast, critical acceptance
// check, automated here.
//
// A full walk-based E2E test (marker click -> walk -> dialogue -> choice,
// mirroring story-baseline.spec.ts) was attempted for executive-phishing-request
// and is not included: it was consistently slow/flaky in this sandboxed
// headless-SwiftShader environment (multiple runs did not complete inside a
// 180s budget, longer than story-baseline.spec.ts's own proven ceiling for an
// equivalent marker-walk-dialogue flow). The scene's runtime logic is not in
// doubt - it is exercised directly by:
//   - src/game/story/cyberStoryInteraction.test.ts (the exact production
//     runCyberStoryConversation/runCyberStoryConversationVisualOnly functions,
//     full dialogue + choice + resolve + interrupted-run + Ilya-gating paths);
//   - a real Chromium session driven through the dev launcher against a live
//     `npm run dev` server (all three scenes + office-intrusion, full
//     dialogue/choice/resolution, logged in the Feature 19 report).
// See docs/qa/19-cyber-story-test-matrix.md for the full test-to-requirement
// mapping and this limitation's exact rationale.

test('window.__startupGameDev is absent from the production bundle', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('startup-office-progress', JSON.stringify({ playerName: 'Тест', phase: 'free', tasks: [], reprimands: 0 })),
  )
  await openApp(page)
  const hasLauncher = await page.evaluate(() => typeof (window as unknown as { __startupGameDev?: unknown }).__startupGameDev !== 'undefined')
  expect(hasLauncher).toBe(false)
})
