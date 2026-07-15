export interface LogLine {
  id: string
  time: string
  ip: string
  user: string
  event: string
  suspicious: boolean // part of the attack evidence
}
export interface LogsScenario {
  id: string
  brief: string
  lines: LogLine[]
  attackerIp: string
  candidateIps: string[] // options in the ban selector
}
export interface LogsResult {
  flaggedCorrect: boolean
  bannedCorrect: boolean
  passed: boolean
  missed: LogLine[] // evidence the player failed to flag
  falsePositives: number
}

// Win = all evidence lines flagged, no innocent lines flagged, correct IP banned.
export function evaluateLogs(flaggedIds: Set<string>, bannedIp: string, s: LogsScenario): LogsResult {
  const evidence = s.lines.filter((l) => l.suspicious)
  const missed = evidence.filter((l) => !flaggedIds.has(l.id))
  let falsePositives = 0
  for (const id of flaggedIds) {
    const line = s.lines.find((l) => l.id === id)
    if (line && !line.suspicious) falsePositives++
  }
  const flaggedCorrect = missed.length === 0 && falsePositives === 0
  const bannedCorrect = bannedIp === s.attackerIp
  return { flaggedCorrect, bannedCorrect, passed: flaggedCorrect && bannedCorrect, missed, falsePositives }
}

export const LOGS_SCENARIOS: LogsScenario[] = [
  {
    id: 'brute-force',
    brief: 'Кто-то ломился в аккаунт всю ночь. Отметь улики атаки и забань нужный IP.',
    attackerIp: '185.203.44.10',
    candidateIps: ['10.0.0.5', '185.203.44.10', '10.0.0.9', '52.14.7.201'],
    lines: [
      { id: '1', time: '02:58', ip: '10.0.0.5', user: 'anna', event: 'login OK', suspicious: false },
      { id: '2', time: '03:11', ip: '185.203.44.10', user: 'admin', event: 'FAILED password', suspicious: true },
      { id: '3', time: '03:11', ip: '185.203.44.10', user: 'admin', event: 'FAILED password', suspicious: true },
      { id: '4', time: '03:12', ip: '185.203.44.10', user: 'admin', event: 'FAILED password ×180', suspicious: true },
      { id: '5', time: '03:14', ip: '52.14.7.201', user: 'deploy', event: 'login OK', suspicious: false },
      { id: '6', time: '03:15', ip: '185.203.44.10', user: 'admin', event: 'login OK', suspicious: true },
      { id: '7', time: '03:16', ip: '185.203.44.10', user: 'admin', event: 'sudo: added user "svc-x"', suspicious: true },
      { id: '8', time: '08:02', ip: '10.0.0.9', user: 'boris', event: 'login OK', suspicious: false },
    ],
  },
  {
    id: 'stolen-session',
    brief: 'Легитимный пользователь вдруг оказался в двух местах сразу. Найди подмену и забань чужой IP.',
    attackerIp: '91.240.16.7',
    candidateIps: ['203.0.113.8', '91.240.16.7', '10.0.0.12', '198.51.100.4'],
    lines: [
      { id: '1', time: '14:00', ip: '10.0.0.12', user: 'maria', event: 'login OK (office)', suspicious: false },
      { id: '2', time: '14:03', ip: '10.0.0.12', user: 'maria', event: 'open dashboard', suspicious: false },
      { id: '3', time: '14:05', ip: '91.240.16.7', user: 'maria', event: 'login OK (session reused)', suspicious: true },
      { id: '4', time: '14:06', ip: '91.240.16.7', user: 'maria', event: 'export all customers', suspicious: true },
      { id: '5', time: '14:07', ip: '91.240.16.7', user: 'maria', event: 'change recovery email', suspicious: true },
      { id: '6', time: '14:10', ip: '10.0.0.12', user: 'maria', event: 'open reports', suspicious: false },
      { id: '7', time: '18:20', ip: '198.51.100.4', user: 'ci-bot', event: 'login OK', suspicious: false },
    ],
  },
  {
    id: 'insider',
    brief: 'Веб-сервису вдруг понадобились права рута. Отметь подозрительные действия и забань источник.',
    attackerIp: '10.0.0.30',
    candidateIps: ['10.0.0.30', '10.0.0.5', '172.16.0.9', '203.0.113.77'],
    lines: [
      { id: '1', time: '11:00', ip: '10.0.0.5', user: 'anna', event: 'login OK', suspicious: false },
      { id: '2', time: '11:20', ip: '10.0.0.30', user: 'www-data', event: 'sudo: cat /etc/shadow', suspicious: true },
      { id: '3', time: '11:21', ip: '10.0.0.30', user: 'www-data', event: 'sudo: add key to authorized_keys', suspicious: true },
      { id: '4', time: '11:22', ip: '172.16.0.9', user: 'backup', event: 'nightly backup OK', suspicious: false },
      { id: '5', time: '11:25', ip: '10.0.0.30', user: 'www-data', event: 'download db dump', suspicious: true },
      { id: '6', time: '12:00', ip: '10.0.0.5', user: 'anna', event: 'open email', suspicious: false },
    ],
  },
]

export function pickLogsScenario(rng: () => number): LogsScenario {
  return LOGS_SCENARIOS[Math.floor(rng() * LOGS_SCENARIOS.length)]
}

export function logsTakeaways(_s: LogsScenario, won: boolean): string[] {
  return [
    won
      ? 'Ты нашёл цепочку: всплеск отказов → успешный вход → действия под чужим именем.'
      : 'Ищи цепочку: много FAILED подряд, затем внезапный login OK — это и есть взлом.',
    'Успешный вход сразу после сотен неудачных с того же IP — классический признак брутфорса.',
    'Действия с повышением прав (sudo, экспорт данных, смена почты) после входа — подтверждение компрометации.',
  ]
}
