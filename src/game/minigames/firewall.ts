export interface PortDef {
  port: number
  label: string
}
export interface RequestCard {
  id: string
  label: string
  port: number
  legit: boolean // true = legitimate traffic that must be allowed
}
export interface FirewallScenario {
  id: string
  brief: string
  ports: PortDef[]
  neededOpen: number[] // ports the player SHOULD leave open
  requests: RequestCard[]
  uptimeThreshold: number // 0..1 fraction of legit traffic that must pass
}
export interface FirewallResult {
  breach: number // attacks that hit an open port
  legitBlocked: number
  uptime: number // 0..1
  passed: boolean
}

// Score the player's open/closed config against the scenario's traffic.
export function evaluateFirewall(openPorts: Set<number>, s: FirewallScenario): FirewallResult {
  let breach = 0
  let legitTotal = 0
  let legitBlocked = 0
  for (const r of s.requests) {
    if (r.legit) {
      legitTotal++
      if (!openPorts.has(r.port)) legitBlocked++
    } else if (openPorts.has(r.port)) {
      breach++
    }
  }
  const uptime = legitTotal === 0 ? 1 : 1 - legitBlocked / legitTotal
  return { breach, legitBlocked, uptime, passed: breach === 0 && uptime >= s.uptimeThreshold }
}

export const FIREWALL_SCENARIOS: FirewallScenario[] = [
  {
    id: 'web-tier',
    brief: 'Публичный веб-сервер. Пропусти клиентов, но закрой всё лишнее — база данных смотреть в интернет не должна.',
    ports: [
      { port: 22, label: '22 · SSH' },
      { port: 80, label: '80 · HTTP' },
      { port: 443, label: '443 · HTTPS' },
      { port: 3306, label: '3306 · MySQL' },
      { port: 21, label: '21 · FTP' },
    ],
    neededOpen: [443, 80],
    requests: [
      { id: 'a', label: 'Клиент открывает сайт (HTTPS)', port: 443, legit: true },
      { id: 'b', label: 'Старый клиент по HTTP', port: 80, legit: true },
      { id: 'c', label: 'Бот подбирает пароль MySQL снаружи', port: 3306, legit: false },
      { id: 'd', label: 'Скан уязвимого FTP', port: 21, legit: false },
      { id: 'e', label: 'Перебор SSH с чужого IP', port: 22, legit: false },
    ],
    uptimeThreshold: 1,
  },
  {
    id: 'admin-tier',
    brief: 'Внутренний сервис. Админам нужен SSH, приложению — HTTPS. FTP давно пора выключить.',
    ports: [
      { port: 22, label: '22 · SSH' },
      { port: 443, label: '443 · HTTPS' },
      { port: 3306, label: '3306 · MySQL' },
      { port: 21, label: '21 · FTP' },
      { port: 8080, label: '8080 · debug' },
    ],
    neededOpen: [22, 443],
    requests: [
      { id: 'a', label: 'Админ подключается по SSH (доверенный IP)', port: 22, legit: true },
      { id: 'b', label: 'Приложение ходит по HTTPS', port: 443, legit: true },
      { id: 'c', label: 'Кто-то дергает debug-порт 8080', port: 8080, legit: false },
      { id: 'd', label: 'Скан FTP', port: 21, legit: false },
      { id: 'e', label: 'Прямой коннект к MySQL снаружи', port: 3306, legit: false },
    ],
    uptimeThreshold: 1,
  },
  {
    id: 'api-tier',
    brief: 'API-шлюз. Наружу — только HTTPS. Всё остальное — потенциальная дверь для атаки.',
    ports: [
      { port: 22, label: '22 · SSH' },
      { port: 443, label: '443 · HTTPS' },
      { port: 25, label: '25 · SMTP' },
      { port: 3306, label: '3306 · MySQL' },
      { port: 6379, label: '6379 · Redis' },
    ],
    neededOpen: [443],
    requests: [
      { id: 'a', label: 'Мобильное приложение (HTTPS)', port: 443, legit: true },
      { id: 'b', label: 'Партнёрский сервис (HTTPS)', port: 443, legit: true },
      { id: 'c', label: 'Открытый Redis без пароля', port: 6379, legit: false },
      { id: 'd', label: 'Спам-рассылка через SMTP', port: 25, legit: false },
      { id: 'e', label: 'Прямой коннект к MySQL', port: 3306, legit: false },
    ],
    uptimeThreshold: 1,
  },
]

export function pickFirewallScenario(rng: () => number): FirewallScenario {
  return FIREWALL_SCENARIOS[Math.floor(rng() * FIREWALL_SCENARIOS.length)]
}

export function firewallTakeaways(s: FirewallScenario, won: boolean): string[] {
  const needed = s.neededOpen.join(', ')
  return [
    won
      ? `Верно: открыты только нужные порты (${needed}), остальное закрыто.`
      : `Правило «default deny»: закрой всё, открой только необходимое (${needed}).`,
    'Базы данных (MySQL 3306, Redis 6379) никогда не смотрят в интернет напрямую.',
    'Устаревшие протоколы вроде FTP (21) — лёгкая мишень, их отключают.',
  ]
}
