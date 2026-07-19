import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

// Shared E2E helpers: production-honest localStorage seeds (the same keys and
// shapes the persisted stores read) and a console-noise policy.
//
// Environment note: these run against the production preview in headless
// SwiftShader (no GPU). The app is asserted through DOM locators (which poll in
// the browser and tolerate a busy main thread). We deliberately avoid
// page.evaluate() for ASSERTIONS after the office scene is live — under software
// rendering the main thread is briefly saturated by model decode and an
// evaluate() can stall. Seeding evaluate() runs on the light intro screen, which
// is fine.

// Known headless-environment noise (SwiftShader / GLTF texture decode in the
// software renderer). Everything else is a real defect and fails the test.
const ENV_NOISE = /SwiftShader|WebGL|GLTFLoader|VALIDATE_STATUS|context could not be created|context loss|Error creating WebGL|Texture marked for update/i

export function collectAppErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !ENV_NOISE.test(m.text())) errors.push('console: ' + m.text())
  })
  page.on('pageerror', (e) => {
    if (!ENV_NOISE.test(e.message)) errors.push('pageerror: ' + e.message)
  })
  return errors
}

export const PRODUCT_TASK_IDS = [
  'auth-api', 'rooms-api', 'booking-api', 'login-screen', 'rooms-screen', 'booking-form',
  'employees-api', 'guest-passes-api', 'event-log-api', 'notifications-api',
  'employees-screen', 'guest-passes-screen', 'event-log-screen', 'notifications-screen',
]

export interface SeedOptions {
  sprintNumber?: number
  day?: number
  phase?: 'planning' | 'active' | 'review'
  allTasksDone?: boolean
  withIlya?: boolean
  outcome?: unknown
}

// Seeds a mid-campaign free-play save through the real persistence keys, BEFORE
// any app JS runs on the next navigation (race-free — no dependency on the main
// thread being free, unlike a post-load page.evaluate under software rendering).
// Call this, then navigate/reload. The seed re-applies on every navigation, so
// for a ?intro-reset test use a fresh context/page instead of reloading.
export async function seedCampaign(page: Page, opts: SeedOptions = {}): Promise<void> {
  await page.addInitScript(
    ({ opts, taskIds }) => {
      // Seed exactly once: on later navigations the app's own persistence (or a
      // ?intro reset) is what's exercised, not a re-seed. The sentinel is a
      // custom key the app never touches, so it survives ?intro.
      if (localStorage.getItem('__e2e_seeded')) return
      localStorage.clear()
      localStorage.setItem('__e2e_seeded', '1')
      localStorage.setItem('startup-office-progress', JSON.stringify({ playerName: 'Тест', phase: 'free', tasks: [], reprimands: 0 }))
      localStorage.setItem('startup-office-sprint', JSON.stringify({ sprintNumber: opts.sprintNumber ?? 3, day: opts.day ?? 4, phase: opts.phase ?? 'active' }))
      localStorage.setItem('startup-office-team', JSON.stringify({
        hires: [
          { employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 },
          { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 },
          ...(opts.withIlya ? [{ employeeId: 'ilya-vlasov', hiredAtSprint: 2, hiredAtDay: 1 }] : []),
        ],
      }))
      localStorage.setItem('startup-office-security', JSON.stringify({
        securityBreach: { status: 'completed', decision: 'take-responsibility', completedAt: { sprintNumber: 2, day: 3 }, effectsApplied: true },
        postAuditConversation: { status: 'completed', staffingDecision: opts.withIlya ? 'approve-security-hire' : 'decline-security-hire', completedAt: { sprintNumber: 3, day: 1 }, effectsApplied: true },
        hasIntroducedSecuritySpecialist: !!opts.withIlya,
      }))
      if (opts.allTasksDone) {
        localStorage.setItem('startup-office-product', JSON.stringify({
          taskStates: taskIds.map((taskId: string) => ({ taskId, status: 'done', progressDays: 99, completedAt: { sprintNumber: 3, day: 1 } })),
          workdayHistory: [],
        }))
      }
      if (opts.outcome) localStorage.setItem('startup-office-game-outcome', JSON.stringify(opts.outcome))
    },
    { opts, taskIds: PRODUCT_TASK_IDS },
  )
}

export async function openApp(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('canvas', { timeout: 20_000 })
  await page.waitForTimeout(800)
}

export async function reloadApp(page: Page): Promise<void> {
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('canvas', { timeout: 20_000 })
}

// Clicks a button tolerating the brief main-thread saturation from GLTF model
// decode in the software renderer. Reliable in frameloop-paused screens (intro/
// terminal), where the scene is not rendering every frame.
export async function clickWhenReady(page: Page, name: string | RegExp, tries = 40): Promise<void> {
  for (let i = 0; i < tries; i++) {
    try {
      await page.getByRole('button', { name }).click({ timeout: 3000 })
      return
    } catch {
      await page.waitForTimeout(1000)
    }
  }
  throw new Error(`clickWhenReady: never became clickable: ${name}`)
}

// Locator-based (no page.evaluate) guard against broken numeric values leaking
// into the HUD. Scoped to the top-left sprint HUD so it can't match unrelated
// dev tooling; asserts the budget reads as a real ruble figure.
export async function expectHudBudgetValid(page: Page): Promise<void> {
  const budget = page.getByText(/Бюджет:/)
  await expect(budget).toBeVisible()
  await expect(budget).not.toContainText('NaN')
  await expect(budget).not.toContainText('undefined')
  await expect(budget).toHaveText(/Бюджет:\s*[−\-\d]/)
}
