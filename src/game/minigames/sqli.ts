export interface SqliScenario {
  id: string
  brief: string
  table: string
  column: string
  // tokens the player assembles in the ATTACK phase to inject
  attackTokens: string[]
  // rows that "leak" when the injection succeeds
  leakedRows: string[]
}

// A heuristic "is this input an auth-bypass injection?" — true when the input
// breaks out of the quoted string and adds an always-true clause or comment.
export function isInjection(input: string): boolean {
  const s = input.replace(/\s+/g, '').toLowerCase()
  return (
    s.includes("'or'1'='1") ||
    s.includes('or1=1') ||
    s.includes("'or1=1") ||
    (s.includes("'") && s.includes('--')) ||
    (s.includes("'or'") && s.endsWith('--'))
  )
}

// Vulnerable path: the input is concatenated straight into the query, so an
// injection rewrites its logic and bypasses auth.
export function buildConcatQuery(s: SqliScenario, input: string): string {
  return `SELECT * FROM ${s.table} WHERE ${s.column} = '${input}'`
}
export function concatBypasses(_s: SqliScenario, input: string): boolean {
  return isInjection(input)
}

// Safe path: the input is bound as a parameter, so it is ALWAYS treated as a
// literal value — the same injection string now matches nothing.
export function buildParamQuery(s: SqliScenario): string {
  return `SELECT * FROM ${s.table} WHERE ${s.column} = ?`
}
export function paramBypasses(): boolean {
  return false
}

export const SQLI_SCENARIOS: SqliScenario[] = [
  {
    id: 'login',
    brief: 'Форма входа в твой продукт. Сначала сам взломай её, потом почини.',
    table: 'users',
    column: 'login',
    attackTokens: ["'", ' OR ', "'1'='1", ' --', 'admin', 'password'],
    leakedRows: ['1  admin   ceo@startup.io', '2  anna   anna@startup.io', '3  boris  boris@startup.io'],
  },
  {
    id: 'search',
    brief: 'Поиск по каталогу товаров. Найди дыру инъекцией, затем закрой её.',
    table: 'products',
    column: 'name',
    attackTokens: ["'", ' OR ', "'1'='1", ' --', 'phone', 'laptop'],
    leakedRows: ['sku-1  Ноутбук   1290$', 'sku-2  Телефон   690$', 'ADMIN  внутренний прайс  секрет'],
  },
]

export function pickSqliScenario(rng: () => number): SqliScenario {
  return SQLI_SCENARIOS[Math.floor(rng() * SQLI_SCENARIOS.length)]
}

export function sqliTakeaways(_s: SqliScenario, won: boolean): string[] {
  return [
    won
      ? 'Ты увидел дыру и закрыл её: ввод больше не влияет на структуру запроса.'
      : 'Пока запрос собирается склейкой строк, ввод может переписать его логику.',
    "Инъекция ' OR '1'='1' -- делает условие всегда истинным и пропускает без пароля.",
    'Параметризованный запрос (WHERE login = ?) передаёт ввод как данные, а не как код — атака превращается в обычный текст.',
  ]
}
