import { describe, it, expect } from 'vitest'
import {
  buildCampaignSuccessHighlights,
  calculateCampaignSuccessScore,
  canRegisterSuccess,
  evaluateMvpReleaseReadiness,
  getCampaignSuccessTier,
  type CampaignSuccessScoreSnapshot,
  type CampaignSuccessSnapshot,
  type MvpReleaseReadinessSnapshot,
} from './mvpReleaseRules'
import { RISK_DOMAINS, type RiskDomain, type RiskLevel } from './riskCatalog'

function riskAll(level: RiskLevel): Record<RiskDomain, RiskLevel> {
  const out = {} as Record<RiskDomain, RiskLevel>
  for (const d of RISK_DOMAINS) out[d] = level
  return out
}

function readySnapshot(overrides: Partial<MvpReleaseReadinessSnapshot> = {}): MvpReleaseReadinessSnapshot {
  return {
    outcomeStatus: 'playing',
    releaseStatus: 'not-started',
    allProductTasksDone: true,
    campaignDeadlineStatus: 'met',
    sprintNumber: 4,
    balance: 700_000,
    leadershipReviewStatus: 'inactive',
    openFindingsCount: 0,
    followUpAuditStatus: 'not-scheduled',
    accessControlProposalStatus: 'active',
    officeIntrusionStatus: 'dormant',
    serverIncidentStatuses: ['dormant', 'dormant', 'dormant'],
    cutsceneRunning: false,
    serverMinigameOpen: false,
    blockingOverlayOpen: false,
    blockingDialogueOpen: false,
    securitySpecialistHired: true,
    accessControlActive: true,
    totalAuditFines: 0,
    leadershipComplaint: false,
    shutdownRecommendation: false,
    officeIntrusionOccurred: false,
    serverIncidentsOccurred: false,
    hasDetectedElevatedRisk: false,
    ...overrides,
  }
}
const evalR = (o: Partial<MvpReleaseReadinessSnapshot> = {}) => evaluateMvpReleaseReadiness(readySnapshot(o))

describe('readiness — clean & product/outcome/budget', () => {
  it('a clean snapshot is ready with no blockers or warnings', () => {
    const r = evalR()
    expect(r).toEqual({ ready: true, blockingReasons: [], warnings: [] })
  })
  it('incomplete product blocks', () => expect(evalR({ allProductTasksDone: false }).blockingReasons).toContain('product-incomplete'))
  it('failure-pending blocks', () => expect(evalR({ outcomeStatus: 'failure-pending' }).blockingReasons).toContain('game-not-playing'))
  it('failed blocks', () => expect(evalR({ outcomeStatus: 'failed' }).blockingReasons).toContain('game-not-playing'))
  it('balance 0 blocks', () => expect(evalR({ balance: 0 }).blockingReasons).toContain('budget-exhausted'))
  it('negative balance blocks', () => expect(evalR({ balance: -1 }).blockingReasons).toContain('budget-exhausted'))
  it('release running blocks', () => expect(evalR({ releaseStatus: 'running' }).blockingReasons).toContain('release-already-running'))
  it('release released blocks', () => expect(evalR({ releaseStatus: 'released' }).blockingReasons).toContain('release-already-completed'))
})

describe('readiness — deadline', () => {
  it('missed deadline blocks', () => expect(evalR({ campaignDeadlineStatus: 'missed' }).blockingReasons).toContain('deadline-missed'))
  it('active deadline past sprint 6 blocks', () => expect(evalR({ campaignDeadlineStatus: 'active', sprintNumber: 7 }).ready).toBe(false))
  it('active deadline within sprint 6 is allowed', () => expect(evalR({ campaignDeadlineStatus: 'active', sprintNumber: 5 }).ready).toBe(true))
})

describe('readiness — security', () => {
  it('open finding blocks', () => expect(evalR({ openFindingsCount: 1 }).blockingReasons).toContain('security-findings-open'))
  it('audit pending blocks', () => expect(evalR({ followUpAuditStatus: 'pending' }).blockingReasons).toContain('follow-up-audit-pending'))
  it('audit running blocks', () => expect(evalR({ followUpAuditStatus: 'running' }).blockingReasons).toContain('follow-up-audit-pending'))
  it('scheduled audit is a warning, not a blocker', () => {
    const r = evalR({ followUpAuditStatus: 'scheduled' })
    expect(r.ready).toBe(true)
    expect(r.warnings).toContain('future-audit-scheduled')
  })
  it('leadership grace period blocks', () => expect(evalR({ leadershipReviewStatus: 'grace-period' }).blockingReasons).toContain('leadership-review-active'))
  it('leadership recovered is allowed', () => expect(evalR({ leadershipReviewStatus: 'recovered' }).ready).toBe(true))
  it('access-control approved blocks', () => expect(evalR({ accessControlProposalStatus: 'approved', accessControlActive: false }).blockingReasons).toContain('access-control-in-progress'))
  it('access-control in-progress blocks', () => expect(evalR({ accessControlProposalStatus: 'in-progress', accessControlActive: false }).blockingReasons).toContain('access-control-in-progress'))
  it('access-control active allowed', () => expect(evalR({ accessControlProposalStatus: 'active' }).ready).toBe(true))
  it('access-control postponed is only a warning', () => {
    const r = evalR({ accessControlProposalStatus: 'postponed', accessControlActive: false })
    expect(r.ready).toBe(true)
    expect(r.warnings).toContain('access-control-not-active')
  })
})

describe('readiness — incidents', () => {
  it('intrusion armed blocks', () => expect(evalR({ officeIntrusionStatus: 'armed' }).blockingReasons).toContain('office-intrusion-unresolved'))
  it('intrusion pending/running blocks', () => {
    expect(evalR({ officeIntrusionStatus: 'pending' }).ready).toBe(false)
    expect(evalR({ officeIntrusionStatus: 'running' }).ready).toBe(false)
  })
  it('intrusion resolved is allowed with a warning', () => {
    const r = evalR({ officeIntrusionStatus: 'resolved', officeIntrusionOccurred: true })
    expect(r.ready).toBe(true)
    expect(r.warnings).toContain('office-intrusion-occurred')
  })
  it('intrusion prevented is allowed', () => expect(evalR({ officeIntrusionStatus: 'prevented' }).ready).toBe(true))
  it('server armed blocks (threat)', () => expect(evalR({ serverIncidentStatuses: ['armed', 'dormant', 'dormant'] }).blockingReasons).toContain('server-threat-unresolved'))
  it('server recovery-required blocks', () => expect(evalR({ serverIncidentStatuses: ['recovery-required', 'dormant', 'dormant'] }).blockingReasons).toContain('server-incident-unresolved'))
  it('server recovering blocks', () => expect(evalR({ serverIncidentStatuses: ['recovering', 'dormant', 'dormant'] }).blockingReasons).toContain('server-incident-unresolved'))
  it('all resolved/dormant allowed', () => expect(evalR({ serverIncidentStatuses: ['resolved', 'dormant', 'resolved'] }).ready).toBe(true))
  it('occurred incidents warn', () => expect(evalR({ serverIncidentsOccurred: true }).warnings).toContain('server-incidents-occurred'))
})

describe('readiness — cyber story (Feature 19)', () => {
  it('a pending/available cyber-story incident or delayed consequence blocks release', () => {
    expect(evalR({ cyberStoryIncidentPending: true }).blockingReasons).toContain('cyber-story-incident-pending')
    expect(evalR({ cyberStoryIncidentPending: true }).ready).toBe(false)
  })
  it('no pending cyber-story incident is allowed (also the default-safe undefined for pre-19 saves)', () => {
    expect(evalR({ cyberStoryIncidentPending: false }).ready).toBe(true)
    expect(evalR({ cyberStoryIncidentPending: undefined }).ready).toBe(true)
  })
})

describe('readiness — UI + warnings', () => {
  it('cutscene blocks', () => expect(evalR({ cutsceneRunning: true }).blockingReasons).toContain('cutscene-running'))
  it('minigame blocks', () => expect(evalR({ serverMinigameOpen: true }).blockingReasons).toContain('server-minigame-open'))
  it('blocking overlay blocks', () => expect(evalR({ blockingOverlayOpen: true }).blockingReasons).toContain('blocking-overlay-open'))
  it('blocking dialogue blocks', () => expect(evalR({ blockingDialogueOpen: true }).blockingReasons).toContain('blocking-dialogue-open'))
  it('surfaces the non-blocking warnings', () => {
    const r = evalR({ securitySpecialistHired: false, accessControlActive: false, totalAuditFines: 120_000, leadershipComplaint: true, shutdownRecommendation: true, hasDetectedElevatedRisk: true, balance: 200_000 })
    expect(r.ready).toBe(true)
    for (const w of ['security-specialist-not-hired', 'access-control-not-active', 'audit-fines-paid', 'leadership-complaint-exists', 'shutdown-recommendation-recovered', 'detected-security-risks', 'low-remaining-budget'] as const) {
      expect(r.warnings).toContain(w)
    }
  })
})

function scoreSnap(o: Partial<CampaignSuccessScoreSnapshot> = {}): CampaignSuccessScoreSnapshot {
  return {
    failedAuditNumbers: [],
    officeIntrusionOutcome: 'not-triggered',
    occurredServerIncidentCount: 0,
    leadershipComplaint: false,
    shutdownRecommendation: false,
    accessControlActive: true,
    actualRiskLevels: riskAll('controlled'),
    balance: 700_000,
    ...o,
  }
}
const score = (o: Partial<CampaignSuccessScoreSnapshot> = {}) => calculateCampaignSuccessScore(scoreSnap(o)).score

describe('campaign score', () => {
  it('clean run scores 100', () => expect(score()).toBe(100))
  it('first failed audit -5', () => expect(score({ failedAuditNumbers: [1] })).toBe(95))
  it('second failed audit -10', () => expect(score({ failedAuditNumbers: [2] })).toBe(90))
  it('third failed audit -20', () => expect(score({ failedAuditNumbers: [3] })).toBe(80))
  it('contained intrusion -5', () => expect(score({ officeIntrusionOutcome: 'contained-with-specialist' })).toBe(95))
  it('reached work area -12', () => expect(score({ officeIntrusionOutcome: 'reached-work-area' })).toBe(88))
  it('each server incident -6 (max 3)', () => {
    expect(score({ occurredServerIncidentCount: 1 })).toBe(94)
    expect(score({ occurredServerIncidentCount: 3 })).toBe(82)
    expect(score({ occurredServerIncidentCount: 5 })).toBe(82)
  })
  it('complaint -8', () => expect(score({ leadershipComplaint: true })).toBe(92))
  it('shutdown recommendation -15', () => expect(score({ shutdownRecommendation: true })).toBe(85))
  it('inactive access control -5', () => expect(score({ accessControlActive: false })).toBe(95))
  it('high risk -3 per domain', () => expect(score({ actualRiskLevels: { ...riskAll('controlled'), governance: 'high' } })).toBe(97))
  it('critical risk -6 per domain', () => expect(score({ actualRiskLevels: { ...riskAll('controlled'), governance: 'critical' } })).toBe(94))
  it('balance 250-499k -3', () => expect(score({ balance: 400_000 })).toBe(97))
  it('balance 1-249k -7', () => expect(score({ balance: 100_000 })).toBe(93))
  it('score clamps to 0', () => expect(score({ failedAuditNumbers: [1, 2, 3], shutdownRecommendation: true, leadershipComplaint: true, occurredServerIncidentCount: 3, officeIntrusionOutcome: 'reached-work-area', actualRiskLevels: riskAll('critical'), balance: 100_000 })).toBe(0))
})

describe('tier + guard', () => {
  it('maps score to tier at the thresholds', () => {
    expect(getCampaignSuccessTier(85)).toBe('secure-launch')
    expect(getCampaignSuccessTier(84)).toBe('stable-launch')
    expect(getCampaignSuccessTier(60)).toBe('stable-launch')
    expect(getCampaignSuccessTier(59)).toBe('fragile-launch')
    expect(getCampaignSuccessTier(0)).toBe('fragile-launch')
  })
  it('canRegisterSuccess only from playing', () => {
    expect(canRegisterSuccess('playing')).toBe(true)
    for (const s of ['failure-pending', 'failed', 'success-pending', 'succeeded'] as const) expect(canRegisterSuccess(s)).toBe(false)
  })
})

describe('highlights', () => {
  function successSnap(o: Partial<CampaignSuccessSnapshot> = {}): CampaignSuccessSnapshot {
    return {
      releasedAt: { sprintNumber: 4, day: 7 },
      releaseWorkdayIndex: 37,
      resultTier: 'stable-launch',
      campaignScore: 82,
      balance: 640_000,
      completedProductTasks: 14,
      totalProductTasks: 14,
      productProgressPercent: 100,
      completedSprints: 3,
      metDeadlineEarly: false,
      teamEmployeeIds: ['kirill-morozov', 'alina-belova'],
      securitySpecialistHired: false,
      accessControlActive: false,
      auditRecords: 0,
      failedAuditRecords: 0,
      totalAuditFines: 0,
      leadershipComplaint: false,
      shutdownRecommendation: false,
      officeIntrusionOutcome: 'not-triggered',
      occurredServerIncidentIds: [],
      totalServerDowntimeCost: 0,
      totalServerIncidentCost: 0,
      actualRiskLevels: riskAll('controlled'),
      detectedRiskLevels: riskAll('controlled'),
      warningsAtRelease: [],
      ...o,
    }
  }
  it('returns at most three highlights', () => {
    expect(buildCampaignSuccessHighlights(successSnap({ metDeadlineEarly: true, shutdownRecommendation: true, securitySpecialistHired: true, failedAuditRecords: 2, accessControlActive: true })).length).toBeLessThanOrEqual(3)
  })
  it('is deterministic and prioritises early delivery', () => {
    const h = buildCampaignSuccessHighlights(successSnap({ metDeadlineEarly: true }))
    expect(h[0]).toContain('раньше крайнего срока')
    expect(h).toEqual(buildCampaignSuccessHighlights(successSnap({ metDeadlineEarly: true })))
  })
})
