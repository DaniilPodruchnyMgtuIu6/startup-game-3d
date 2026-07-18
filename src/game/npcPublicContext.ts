import { useSprintStore } from './sprintStore'
import { useEconomyStore } from './economyStore'
import { useProductStore } from './productStore'
import { useTeamStore } from './teamStore'
import { useGameStore } from './gameStore'
import { useGameOutcomeStore } from './gameOutcomeStore'
import { useRiskStore } from './riskStore'
import { useSecurityAuditStore } from './securityAuditStore'
import { useAccessControlStore } from './accessControlStore'
import { useServerIncidentStore } from './serverIncidentStore'
import { useSecurityStoryStore } from './securityStoryStore'
import { calculateBalance } from './economyRules'
import { productReadiness, completedProductTaskCount, hasFirstPrototype } from './productRules'
import { getHiredEmployeeIds } from './teamRules'
import { getDetectedRiskLevel } from './riskRules'
import { RISK_DOMAINS, RISK_DOMAIN_TITLE, RISK_LEVEL_LABEL } from './riskCatalog'
import { getProductTask } from './productTaskCatalog'
import { getSecurityFinding } from './securityFindingCatalog'
import { getServerIncident } from './serverIncidentCatalog'
import { getEmployeeActiveSecurityWork } from './serverIncidentRules'
import type { BudgetBand, CampaignStatus, NpcId, PublicNpcGameContext, PublicNpcEvent, PublicRiskObservation } from './npcChatTypes'

// Builds ONLY player-visible context for the NPC chat. Never includes the actual
// hidden risk score, undetected signals, hidden due dates, internal event ids,
// the finance journal, or raw store/localStorage state (Feature 14 §7/§8). The
// gather step reads the live stores; buildPublicNpcGameContext is pure over the
// snapshot so it is unit-testable with fabricated snapshots.

export function budgetBand(balance: number): BudgetBand {
  if (balance <= 150_000) return 'critical'
  if (balance <= 400_000) return 'low'
  if (balance <= 1_000_000) return 'stable'
  return 'comfortable'
}

export interface GameSnapshot {
  campaignStatus: CampaignStatus
  sprint: { number: number; day: number; phase: 'planning' | 'active' | 'review' }
  balance: number
  product: { progressPercent: number; completedTaskCount: number; firstPrototypeReady: boolean }
  hiredEmployeeIds: string[]
  visibleObjectives: string[]
  detectedRiskObservations: PublicRiskObservation[]
  recentVisibleEvents: PublicNpcEvent[]
  assignmentByNpc: Partial<Record<NpcId, string>>
  sonyaBlamed: boolean
}

function campaignStatusFrom(status: string): CampaignStatus {
  if (status === 'succeeded') return 'won'
  if (status === 'failed') return 'lost'
  return 'playing'
}

interface SecurityWork {
  kind: 'finding' | 'access-control' | 'server-recovery'
  id: string
}

function securityWorkLabel(work: SecurityWork | undefined): string | undefined {
  if (!work) return undefined
  if (work.kind === 'finding') return `исправление замечания: ${getSecurityFinding(work.id)?.title ?? 'аудит'}`
  if (work.kind === 'server-recovery') return `восстановление сервиса: ${getServerIncident(work.id)?.title ?? 'инцидент'}`
  return 'внедрение СКУД'
}

function developerTaskLabel(taskStates: { taskId: string; status: string }[], kind: 'backend' | 'frontend'): string | undefined {
  const match = (id: string) => (kind === 'backend' ? id.includes('-api') : id.includes('-screen') || id.includes('-form'))
  const active =
    taskStates.find((s) => s.status === 'in-progress' && match(s.taskId)) ??
    taskStates.find((s) => s.status === 'planned' && match(s.taskId))
  if (!active) return undefined
  return `работает над задачей: ${getProductTask(active.taskId)?.title ?? active.taskId}`
}

export function gatherGameSnapshot(): GameSnapshot {
  const sprint = useSprintStore.getState()
  const balance = calculateBalance(useEconomyStore.getState().transactions)
  const taskStates = useProductStore.getState().taskStates
  const signals = useRiskStore.getState().signals
  const audit = useSecurityAuditStore.getState()
  const access = useAccessControlStore.getState()
  const incidents = Object.values(useServerIncidentStore.getState().incidents)
  const work = (empId: string): SecurityWork | undefined =>
    getEmployeeActiveSecurityWork(empId, audit.findings, access.accessControl, incidents) as SecurityWork | undefined

  const detectedRiskObservations: PublicRiskObservation[] = []
  for (const domain of RISK_DOMAINS) {
    const level = getDetectedRiskLevel(signals, domain)
    if (level !== 'controlled') {
      detectedRiskObservations.push({ domainLabel: RISK_DOMAIN_TITLE[domain], levelLabel: RISK_LEVEL_LABEL[level] })
    }
  }

  const recentVisibleEvents: PublicNpcEvent[] = []
  for (const inc of incidents) {
    if (inc.status === 'resolved') recentVisibleEvents.push({ label: `восстановлен сервис: ${getServerIncident(inc.incidentId)?.title ?? inc.incidentId}` })
  }
  const lastAudit = audit.followUpAudit.records[audit.followUpAudit.records.length - 1]
  if (lastAudit) recentVisibleEvents.push({ label: `повторный аудит: ${lastAudit.result === 'passed' ? 'пройден' : 'провален'}` })
  if (access.intrusion.status === 'resolved') recentVisibleEvents.push({ label: 'было проникновение в офис' })
  else if (access.intrusion.status === 'prevented') recentVisibleEvents.push({ label: 'проникновение предотвращено СКУД' })
  if (access.accessControl.proposalStatus === 'active') recentVisibleEvents.push({ label: 'СКУД внедрена' })

  return {
    campaignStatus: campaignStatusFrom(useGameOutcomeStore.getState().status),
    sprint: { number: sprint.sprintNumber, day: sprint.day, phase: sprint.phase },
    balance,
    product: {
      progressPercent: productReadiness(taskStates),
      completedTaskCount: completedProductTaskCount(taskStates),
      firstPrototypeReady: hasFirstPrototype(taskStates),
    },
    hiredEmployeeIds: getHiredEmployeeIds(useTeamStore.getState().hires),
    visibleObjectives: useGameStore.getState().tasks.filter((t) => !t.done).map((t) => t.text),
    detectedRiskObservations,
    recentVisibleEvents: recentVisibleEvents.slice(-4),
    sonyaBlamed: useSecurityStoryStore.getState().securityBreach.decision === 'blame-project-manager',
    assignmentByNpc: {
      'sonya-sokolova': securityWorkLabel(work('sonya-sokolova')) ?? 'координация команды и сроков',
      'kirill-morozov': securityWorkLabel(work('kirill-morozov')) ?? developerTaskLabel(taskStates, 'backend') ?? 'работа по плану спринта',
      'alina-belova': developerTaskLabel(taskStates, 'frontend') ?? 'работа по плану спринта',
      'ilya-vlasov': securityWorkLabel(work('ilya-vlasov')) ?? 'обход офиса и серверной, наблюдение за рисками',
    },
  }
}

// Pure: assemble the per-NPC visible context. Sonya (the PM) additionally sees
// the exact balance since the HUD already shows it to the player.
export function buildPublicNpcGameContext(snapshot: GameSnapshot, npcId: NpcId): PublicNpcGameContext {
  return {
    campaignStatus: snapshot.campaignStatus,
    sprint: { number: snapshot.sprint.number, day: snapshot.sprint.day, phase: snapshot.sprint.phase },
    budgetBand: budgetBand(snapshot.balance),
    ...(npcId === 'sonya-sokolova' ? { exactBalance: snapshot.balance } : {}),
    product: {
      progressPercent: snapshot.product.progressPercent,
      completedTaskCount: snapshot.product.completedTaskCount,
      totalTaskCount: 14,
      firstPrototypeReady: snapshot.product.firstPrototypeReady,
    },
    team: { hiredEmployeeIds: [...snapshot.hiredEmployeeIds] },
    currentNpc: { id: npcId, currentVisibleAssignment: snapshot.assignmentByNpc[npcId] },
    visibleObjectives: [...snapshot.visibleObjectives],
    detectedRiskObservations: snapshot.detectedRiskObservations.map((o) => ({ ...o })),
    recentVisibleEvents: snapshot.recentVisibleEvents.map((e) => ({ ...e })),
    ...(npcId === 'sonya-sokolova' && snapshot.sonyaBlamed ? { sonyaBlamed: true } : {}),
  }
}
