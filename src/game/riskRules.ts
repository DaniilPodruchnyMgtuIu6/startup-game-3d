import {
  RISK_DOMAINS,
  RISK_DOMAIN_TITLE,
  RISK_MITIGATED_CONTROLLED_SUMMARY,
  getRiskDomainSummary,
  getRiskLevel,
  type RiskDomain,
  type RiskLevel,
} from './riskCatalog'

// Pure, deterministic rules for the hidden-risk system (Feature 09). No Zustand,
// no randomness, no real time. A risk signal is an immutable fact created by a
// concrete decision/result; the actual risk is the running sum of a domain's
// signals (clamped at 0), and the detected risk is the same restricted to
// signals whose detection delay has elapsed. The player never sees the score.

export type RiskSignalSource =
  | 'staffing-decision'
  | 'security-hire'
  | 'security-finding'
  | 'security-audit'
  | 'server-minigame'
  | 'sprint-plan'
  | 'access-control-decision'
  | 'access-control-implementation'
  | 'access-control-incident'
  | 'server-incident'

export interface RiskMoment {
  sprintNumber: number
  day: number
}

export interface RiskSignal {
  id: string
  domain: RiskDomain
  impact: number
  source: RiskSignalSource
  sourceRef: string
  createdAt: RiskMoment
  createdAtWorkdayIndex: number
  detectionDelayOverride?: number
  detectedAtWorkdayIndex?: number
  acknowledgedAtWorkdayIndex?: number
}

// --- Detection delay --------------------------------------------------------

export const DEFAULT_RISK_DETECTION_DELAY_DAYS = 3
export const SECURITY_SPECIALIST_DETECTION_DELAY_DAYS = 1

export function effectiveDetectionDelay(signal: RiskSignal, hasSecuritySpecialist: boolean): number {
  if (signal.detectionDelayOverride !== undefined) return Math.max(0, signal.detectionDelayOverride)
  return hasSecuritySpecialist ? SECURITY_SPECIALIST_DETECTION_DELAY_DAYS : DEFAULT_RISK_DETECTION_DELAY_DAYS
}

// A signal becomes detectable once currentWorkdayIndex has reached its creation
// index plus its effective delay.
export function isSignalDue(signal: RiskSignal, currentWorkdayIndex: number, hasSecuritySpecialist: boolean): boolean {
  return currentWorkdayIndex >= signal.createdAtWorkdayIndex + effectiveDetectionDelay(signal, hasSecuritySpecialist)
}

// --- Scores & levels --------------------------------------------------------

function sumImpacts(signals: RiskSignal[]): number {
  return Math.max(0, signals.reduce((acc, s) => acc + s.impact, 0))
}

export function getActualRiskScore(signals: RiskSignal[], domain: RiskDomain): number {
  return sumImpacts(signals.filter((s) => s.domain === domain))
}

export function getDetectedRiskScore(signals: RiskSignal[], domain: RiskDomain): number {
  return sumImpacts(signals.filter((s) => s.domain === domain && s.detectedAtWorkdayIndex !== undefined))
}

export function getActualRiskLevel(signals: RiskSignal[], domain: RiskDomain): RiskLevel {
  return getRiskLevel(getActualRiskScore(signals, domain))
}

export function getDetectedRiskLevel(signals: RiskSignal[], domain: RiskDomain): RiskLevel {
  return getRiskLevel(getDetectedRiskScore(signals, domain))
}

// --- Signal partitions ------------------------------------------------------

export function getActivePositiveRiskSignals(signals: RiskSignal[], domain: RiskDomain): RiskSignal[] {
  return signals.filter((s) => s.domain === domain && s.impact > 0)
}

export function getActiveMitigationSignals(signals: RiskSignal[], domain: RiskDomain): RiskSignal[] {
  return signals.filter((s) => s.domain === domain && s.impact < 0)
}

// --- Future-feature selectors (Feature 10-12) -------------------------------

const LEVEL_ORDER: RiskLevel[] = ['controlled', 'low', 'elevated', 'high', 'critical']
function levelRank(level: RiskLevel): number {
  return LEVEL_ORDER.indexOf(level)
}

export function hasActualRiskAtLeast(signals: RiskSignal[], domain: RiskDomain, minimumLevel: RiskLevel): boolean {
  return levelRank(getActualRiskLevel(signals, domain)) >= levelRank(minimumLevel)
}

function orderedByHistory(signals: RiskSignal[]): RiskSignal[] {
  return [...signals].sort((a, b) => a.createdAtWorkdayIndex - b.createdAtWorkdayIndex || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

// The first workday index at which the running sum (in history order) reached
// the given level. Later mitigation does not change this historical moment.
export function getRiskLevelReachedAt(signals: RiskSignal[], domain: RiskDomain, minimumLevel: RiskLevel): number | null {
  const target = levelRank(minimumLevel)
  let cumulative = 0
  for (const s of orderedByHistory(signals.filter((sig) => sig.domain === domain))) {
    cumulative += s.impact
    if (levelRank(getRiskLevel(Math.max(0, cumulative))) >= target) return s.createdAtWorkdayIndex
  }
  return null
}

// --- Sprint overload impact -------------------------------------------------

export function getSprintOverloadRiskImpact(plannedLoadDays: number): number {
  if (plannedLoadDays <= 10) return 0
  if (plannedLoadDays <= 13) return 1
  if (plannedLoadDays <= 16) return 2
  return 3
}

// --- Factor labels (shown only with the specialist) -------------------------

const OVERLOAD_NAME: Record<string, string> = { 'kirill-morozov': 'Кирилла', 'alina-belova': 'Алины' }
const SERVER_LABEL: Record<string, string> = { gateway: 'GATEWAY', auth: 'AUTH', database: 'DATABASE' }

export function getRiskSignalFactorLabel(signal: RiskSignal): string {
  if (signal.sourceRef === 'decline-security-hire') return 'За безопасность не назначен отдельный ответственный.'
  if (signal.source === 'security-hire' && signal.sourceRef === 'ilya-vlasov') return 'Назначен отдельный специалист по безопасности.'

  if (signal.source === 'security-finding') {
    switch (signal.sourceRef) {
      case 'workstation-locking-training':
        return 'Проведено обучение блокировке рабочих станций.'
      case 'account-access-review':
        return 'Проверка учётных записей и прав доступа завершена.'
      case 'incident-response-procedure':
        return 'Описан порядок обработки инцидентов.'
      case 'sensitive-data-logging-review':
        return 'Проверка журналирования чувствительных данных завершена.'
    }
  }

  const audit = /^audit:(\d+):(passed|failed)$/.exec(signal.sourceRef)
  if (audit) {
    if (audit[2] === 'passed') return `Повторный аудит №${audit[1]} пройден.`
    const suffix = audit[1] === '1' ? '' : audit[1] === '2' ? ' второй раз' : ' третий раз'
    return `Требования повторного аудита не выполнены${suffix}.`
  }

  const serverFail = /^server:(gateway|auth|database):failure:\d+$/.exec(signal.sourceRef)
  if (serverFail) return `При настройке ${SERVER_LABEL[serverFail[1]]} была допущена ошибка.`
  const serverStab = /^server:(gateway|auth|database):stabilized$/.exec(signal.sourceRef)
  if (serverStab) return `Конфигурация ${SERVER_LABEL[serverStab[1]]} успешно исправлена.`

  if (signal.source === 'sprint-plan') {
    if (signal.sourceRef.endsWith(':balanced')) return 'Спринт спланирован в пределах вместимости команды.'
    const overload = /^sprint:\d+:([a-z-]+):load-\d+$/.exec(signal.sourceRef)
    if (overload) return `План ${OVERLOAD_NAME[overload[1]] ?? 'сотрудника'} превысил вместимость спринта.`
  }

  if (signal.source === 'server-incident') {
    if (signal.sourceRef.endsWith(':recovered')) return 'Серверный инцидент устранён, сервис восстановлен.'
    if (signal.sourceRef === 'gateway-outage') return 'Произошёл отказ внешнего шлюза OfficeFlow.'
    if (signal.sourceRef === 'auth-account-incident') return 'Произошёл инцидент с учётными записями.'
    if (signal.sourceRef === 'database-exposure-review') return 'Зафиксированы подозрительные запросы к базе данных.'
  }

  if (signal.sourceRef === 'postpone-access-control') return 'Решение о внедрении СКУД отложено.'
  if (signal.sourceRef === 'access-control-active') return 'Внедрена система контроля доступа.'
  if (signal.sourceRef === 'office-intrusion:contained-early') return 'Постороннего остановили до рабочей зоны.'
  if (signal.sourceRef === 'office-intrusion:workstation-reached') return 'Посторонний дошёл до рабочей зоны.'
  if (signal.sourceRef === 'office-intrusion:possible-data-exposure') return 'Не исключён доступ постороннего к данным.'

  return 'Обнаружен фактор риска.'
}

// --- Observations (derived from detected signals) ---------------------------

export interface RiskObservation {
  domain: RiskDomain
  level: RiskLevel
  title: string
  summary: string
  detectedSignalIds: string[]
  unacknowledgedSignalIds: string[]
  factorLabels: string[]
}

// One observation per domain that has any DETECTED signal (positive or
// mitigation) - a domain the player has never seen a signal in stays hidden.
// factorLabels are only populated when revealDetailedFactors (the specialist).
export function buildRiskObservations(signals: RiskSignal[], options: { revealDetailedFactors: boolean }): RiskObservation[] {
  const observations: RiskObservation[] = []
  for (const domain of RISK_DOMAINS) {
    const detected = orderedByHistory(signals.filter((s) => s.domain === domain && s.detectedAtWorkdayIndex !== undefined))
    if (detected.length === 0) continue
    const level = getDetectedRiskLevel(signals, domain)
    const summary = level === 'controlled' ? RISK_MITIGATED_CONTROLLED_SUMMARY : getRiskDomainSummary(domain, level)
    const factorLabels = options.revealDetailedFactors ? [...new Set(detected.map(getRiskSignalFactorLabel))] : []
    observations.push({
      domain,
      level,
      title: RISK_DOMAIN_TITLE[domain],
      summary,
      detectedSignalIds: detected.map((s) => s.id),
      unacknowledgedSignalIds: detected.filter((s) => s.acknowledgedAtWorkdayIndex === undefined).map((s) => s.id),
      factorLabels,
    })
  }
  return observations
}

export function getUnacknowledgedDetectedCount(signals: RiskSignal[]): number {
  return signals.filter((s) => s.detectedAtWorkdayIndex !== undefined && s.acknowledgedAtWorkdayIndex === undefined).length
}

// --- Persistence normalisation ---------------------------------------------

const SOURCES: RiskSignalSource[] = [
  'staffing-decision',
  'security-hire',
  'security-finding',
  'security-audit',
  'server-minigame',
  'sprint-plan',
  'access-control-decision',
  'access-control-implementation',
  'access-control-incident',
  'server-incident',
]

function validMoment(raw: unknown): RiskMoment | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const { sprintNumber, day } = raw as Record<string, unknown>
  if (typeof sprintNumber !== 'number' || !Number.isInteger(sprintNumber) || sprintNumber < 1) return undefined
  if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > 10) return undefined
  return { sprintNumber, day }
}

function validIndex(raw: unknown): number | undefined {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 1 ? raw : undefined
}

// Coerce a loaded/corrupt blob into safe RiskSignal[]: drop unknown
// domains/sources, drop non-integer/zero/NaN impacts, dedupe by id, and keep the
// detection/acknowledgement invariants (detected >= created, ack requires
// detected and ack >= detected). See spec §24.
export function normalizeRiskSignals(raw: unknown): RiskSignal[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: RiskSignal[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const r = entry as Record<string, unknown>
    if (typeof r.id !== 'string' || seen.has(r.id)) continue
    if (!RISK_DOMAINS.includes(r.domain as RiskDomain)) continue
    if (!SOURCES.includes(r.source as RiskSignalSource)) continue
    if (typeof r.impact !== 'number' || !Number.isInteger(r.impact) || r.impact === 0) continue
    if (typeof r.sourceRef !== 'string') continue
    const createdAt = validMoment(r.createdAt)
    const createdAtWorkdayIndex = validIndex(r.createdAtWorkdayIndex)
    if (!createdAt || createdAtWorkdayIndex === undefined) continue

    const signal: RiskSignal = {
      id: r.id,
      domain: r.domain as RiskDomain,
      impact: r.impact,
      source: r.source as RiskSignalSource,
      sourceRef: r.sourceRef,
      createdAt,
      createdAtWorkdayIndex,
    }
    if (typeof r.detectionDelayOverride === 'number' && Number.isInteger(r.detectionDelayOverride) && r.detectionDelayOverride >= 0) {
      signal.detectionDelayOverride = r.detectionDelayOverride
    }
    const detectedAt = validIndex(r.detectedAtWorkdayIndex)
    if (detectedAt !== undefined && detectedAt >= createdAtWorkdayIndex) {
      signal.detectedAtWorkdayIndex = detectedAt
      const ackAt = validIndex(r.acknowledgedAtWorkdayIndex)
      if (ackAt !== undefined && ackAt >= detectedAt) signal.acknowledgedAtWorkdayIndex = ackAt
    }
    seen.add(signal.id)
    out.push(signal)
  }
  return out
}
