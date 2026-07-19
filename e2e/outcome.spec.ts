import { test, expect } from '@playwright/test'
import { openApp, reloadApp, seedCampaign, collectAppErrors, clickWhenReady } from './helpers'

// E2E-03/04: terminal outcome screens are snapshot-driven — they render, they
// survive reload (no recompute to "playing"), and the reset returns to the
// intro. The restart click uses clickWhenReady to tolerate the brief main-thread
// saturation from model decode under software rendering.

test('a failure snapshot shows the game-over screen, survives reload, and restarts', async ({ page }) => {
  const errors = collectAppErrors(page)
  await seedCampaign(page, {
    outcome: { status: 'failed', failure: { reason: 'budget-exhausted', failedAt: { sprintNumber: 3, day: 4 }, balance: -12000, completedSprints: 2, completedProductTasks: 5, totalProductTasks: 14, productProgressPercent: 20 } },
  })
  await openApp(page)

  await expect(page.getByText('Проект остановлен')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Проект закрыт: бюджет исчерпан')).toBeVisible()

  // snapshot-driven: reload keeps the SAME screen (no recompute)
  await reloadApp(page)
  await expect(page.getByText('Проект закрыт: бюджет исчерпан')).toBeVisible({ timeout: 30_000 })

  await clickWhenReady(page, 'Начать заново')
  await expect(page.getByText('Совет директоров')).toBeVisible({ timeout: 20_000 })

  expect(errors, `unexpected app errors:\n${errors.join('\n')}`).toEqual([])
})

test('a success snapshot shows the campaign-success screen and survives reload', async ({ page }) => {
  await seedCampaign(page, {
    allTasksDone: true,
    outcome: {
      status: 'succeeded',
      success: {
        releasedAt: { sprintNumber: 5, day: 5 }, releaseWorkdayIndex: 45, resultTier: 'stable-launch', campaignScore: 86,
        balance: 476000, completedProductTasks: 14, totalProductTasks: 14, productProgressPercent: 100, completedSprints: 4,
        metDeadlineEarly: true, teamEmployeeIds: ['kirill-morozov', 'alina-belova'], securitySpecialistHired: false,
        accessControlActive: false, auditRecords: 1, failedAuditRecords: 0, totalAuditFines: 0, leadershipComplaint: false,
        shutdownRecommendation: false, officeIntrusionOutcome: 'not-triggered', occurredServerIncidentIds: [],
        totalServerDowntimeCost: 0, totalServerIncidentCost: 0, actualRiskLevels: {}, detectedRiskLevels: {}, warningsAtRelease: [],
      },
    },
  })
  await openApp(page)

  await expect(page.getByText('OfficeFlow MVP выпущен')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('86/100')).toBeVisible()

  await reloadApp(page)
  await expect(page.getByText('OfficeFlow MVP выпущен')).toBeVisible({ timeout: 30_000 })
})
