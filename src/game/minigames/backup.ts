// Backup / ransomware-recovery mini-game (server mini-games expansion). The
// backup server is hit and the player must pick the right restore point:
// recent enough (least data lost), verified, off the primary machine, and not
// itself infected. Teaches the 3-2-1 rule, offline/offsite copies, verifying
// backups and minimising the recovery point. Pure data + evaluation; the
// interactive part lives in backup.tsx.

export type BackupLocation = 'same-server' | 'offline' | 'offsite-cloud'

export interface RestorePoint {
  id: string
  when: string // human label, e.g. 'вчера 03:00'
  location: BackupLocation
  ageDays: number // 0 = freshest; higher = older → more data lost
  verified: boolean
  infected: boolean
}

export interface BackupScenario {
  brief: string
  points: RestorePoint[]
}

export type BackupFailReason = 'infected' | 'on-server' | 'unverified' | 'stale'

export interface BackupResult {
  passed: boolean
  reason?: BackupFailReason
}

export const LOCATION_LABEL: Record<BackupLocation, string> = {
  'same-server': 'тот же сервер',
  offline: 'офлайн-хранилище',
  'offsite-cloud': 'облако (офсайт)',
}

// A restore point is safe to use when it is clean, verified and lives off the
// primary machine (an on-server copy is usually encrypted along with the data).
function isSafe(p: RestorePoint): boolean {
  return !p.infected && p.verified && p.location !== 'same-server'
}

// The best restore point: safe AND the freshest such (smallest ageDays → least
// data lost). Scenarios are authored so the freshest safe point is unique.
export function bestRestorePointId(scenario: BackupScenario): string | null {
  const safe = scenario.points.filter(isSafe)
  if (safe.length === 0) return null
  return safe.reduce((best, p) => (p.ageDays < best.ageDays ? p : best)).id
}

export function evaluateBackup(chosenId: string, scenario: BackupScenario): BackupResult {
  const chosen = scenario.points.find((p) => p.id === chosenId)
  if (!chosen) return { passed: false, reason: 'unverified' }
  if (chosen.infected) return { passed: false, reason: 'infected' }
  if (chosen.location === 'same-server') return { passed: false, reason: 'on-server' }
  if (!chosen.verified) return { passed: false, reason: 'unverified' }
  const best = bestRestorePointId(scenario)
  if (best && best !== chosen.id) return { passed: false, reason: 'stale' }
  return { passed: true }
}

const SCENARIOS: BackupScenario[] = [
  {
    brief: 'Backup-сервер зашифрован шифровальщиком. Выбери точку восстановления, чтобы вернуть данные с минимальными потерями.',
    points: [
      { id: 's1-today', when: 'сегодня 03:00', location: 'same-server', ageDays: 0, verified: true, infected: true },
      { id: 's1-yesterday', when: 'вчера 03:00', location: 'offline', ageDays: 1, verified: true, infected: false },
      { id: 's1-5d', when: '5 дней назад', location: 'offsite-cloud', ageDays: 5, verified: false, infected: false },
      { id: 's1-30d', when: '30 дней назад', location: 'offsite-cloud', ageDays: 30, verified: true, infected: false },
    ],
  },
  {
    brief: 'База повреждена после сбоя. Нужна свежая проверенная копия вне основного сервера.',
    points: [
      { id: 's2-onserver', when: 'сегодня 02:00', location: 'same-server', ageDays: 0, verified: true, infected: false },
      { id: 's2-unverified', when: 'сегодня 04:00', location: 'offline', ageDays: 0, verified: false, infected: false },
      { id: 's2-yesterday', when: 'вчера 04:00', location: 'offsite-cloud', ageDays: 1, verified: true, infected: false },
      { id: 's2-week', when: '7 дней назад', location: 'offline', ageDays: 7, verified: true, infected: false },
    ],
  },
  {
    brief: 'Шифровальщик расползся по сети. Восстанови сервис из копии, до которой атака не добралась.',
    points: [
      { id: 's3-today', when: 'сегодня 01:00', location: 'same-server', ageDays: 0, verified: true, infected: true },
      { id: 's3-cloud', when: 'вчера 01:00', location: 'offsite-cloud', ageDays: 1, verified: true, infected: true },
      { id: 's3-offline', when: '2 дня назад', location: 'offline', ageDays: 2, verified: true, infected: false },
      { id: 's3-old', when: '10 дней назад', location: 'offsite-cloud', ageDays: 10, verified: true, infected: false },
    ],
  },
]

export function pickBackupScenario(rng: () => number): BackupScenario {
  return SCENARIOS[Math.floor(rng() * SCENARIOS.length) % SCENARIOS.length]
}

export function backupTakeaways(_scenario: BackupScenario, won: boolean): string[] {
  if (won) {
    return [
      'Правило 3-2-1: 3 копии данных, на 2 разных носителях, 1 — вне офиса (офсайт).',
      'Держи хотя бы одну офлайн/несинхронизируемую копию — шифровальщик не доберётся до того, что отключено от сети.',
      'Проверяй бэкапы заранее и бери самую свежую рабочую копию, чтобы потерять меньше данных.',
    ]
  }
  return [
    'Копия на том же сервере или заражённая почти всегда зашифрована вместе с данными — она бесполезна.',
    'Даже облачная копия может быть заражена, если туда синхронизировался шифровальщик; спасает офлайн-копия.',
    'Свежая, но непроверенная копия — риск: восстановление может не пройти. Проверяй бэкапы заранее.',
  ]
}
