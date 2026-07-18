// Fixed catalog of the six risk domains and the risk-level scale (Feature 09).
// Pure static data + pure functions - no state, no randomness. The player never
// sees the numeric score; production UI shows only the worded level and summary.

export type RiskDomain =
  | 'office-access'
  | 'identity-access'
  | 'sensitive-data'
  | 'service-continuity'
  | 'governance'
  | 'delivery-pressure'

export const RISK_DOMAINS: RiskDomain[] = [
  'office-access',
  'identity-access',
  'sensitive-data',
  'service-continuity',
  'governance',
  'delivery-pressure',
]

export const RISK_DOMAIN_TITLE: Record<RiskDomain, string> = {
  'office-access': 'Физический доступ и дисциплина рабочих мест',
  'identity-access': 'Учётные записи и права доступа',
  'sensitive-data': 'Чувствительные данные и журналирование',
  'service-continuity': 'Устойчивость инфраструктуры',
  governance: 'Исполнение требований безопасности',
  'delivery-pressure': 'Давление сроков и качество изменений',
}

export type RiskLevel = 'controlled' | 'low' | 'elevated' | 'high' | 'critical'

// score <= 0 -> controlled; 1-2 low; 3-4 elevated; 5-6 high; >= 7 critical.
export function getRiskLevel(score: number): RiskLevel {
  if (score <= 0) return 'controlled'
  if (score <= 2) return 'low'
  if (score <= 4) return 'elevated'
  if (score <= 6) return 'high'
  return 'critical'
}

export const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  controlled: 'Под контролем',
  low: 'Наблюдение',
  elevated: 'Требует внимания',
  high: 'Высокий риск',
  critical: 'Критический риск',
}

// A domain summary depends only on a coarse band of the level: controlled,
// low/elevated ("some signs"), and high/critical ("could lead to ...").
type SummaryBand = 'controlled' | 'lowElevated' | 'highCritical'

function bandOf(level: RiskLevel): SummaryBand {
  if (level === 'controlled') return 'controlled'
  if (level === 'low' || level === 'elevated') return 'lowElevated'
  return 'highCritical'
}

const DOMAIN_SUMMARY: Record<RiskDomain, Record<SummaryBand, string>> = {
  'office-access': {
    controlled: 'Процессы доступа и поведения сотрудников находятся под контролем.',
    lowElevated: 'Есть признаки слабой дисциплины доступа и блокировки рабочих мест.',
    highCritical: 'Недостатки контроля доступа могут позволить постороннему получить доступ к офису или рабочей станции.',
  },
  'identity-access': {
    controlled: 'Критичные проблемы учётных записей не обнаружены.',
    lowElevated: 'В правах и служебных учётных записях есть признаки избыточного доступа.',
    highCritical: 'Компрометация одной учётной записи может дать доступ к важным функциям OfficeFlow.',
  },
  'sensitive-data': {
    controlled: 'Признаки раскрытия чувствительных данных не обнаружены.',
    lowElevated: 'Технические журналы и запросы требуют дополнительной проверки.',
    highCritical: 'Пароли, токены или пользовательские данные могут попасть в журналы или быть извлечены через уязвимый запрос.',
  },
  'service-continuity': {
    controlled: 'Критичные риски устойчивости инфраструктуры не обнаружены.',
    lowElevated: 'Работа инфраструктуры зависит от ручных исправлений.',
    highCritical: 'Следующий сбой может привести к заметному простою OfficeFlow.',
  },
  governance: {
    controlled: 'Требования безопасности выполняются последовательно.',
    lowElevated: 'Ответственность за безопасность распределена неясно.',
    highCritical: 'Повторное игнорирование требований может привести к остановке проекта решением руководства.',
  },
  'delivery-pressure': {
    controlled: 'Планирование оставляет время на проверку изменений.',
    lowElevated: 'Команда регулярно берёт больше работы, чем может завершить.',
    highCritical: 'Постоянная перегрузка повышает вероятность дефектов и срыва релиза.',
  },
}

export function getRiskDomainSummary(domain: RiskDomain, level: RiskLevel): string {
  return DOMAIN_SUMMARY[domain][bandOf(level)]
}

// Shown when a domain that was previously problematic falls back to controlled.
export const RISK_MITIGATED_CONTROLLED_SUMMARY = 'Последние исправления снизили обнаруженный риск.'
