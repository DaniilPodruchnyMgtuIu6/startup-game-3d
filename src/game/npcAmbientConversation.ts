// Feature 16 §8: short observable conversations between two colleagues. They do
// not need the player, do not block control, and never move game time. Content
// is deterministic (a static pool selected by real sprint state) with an always-
// present fallback; DeepSeek is only an optional variation layer (not used here).
//
// This module is PURE (no React, no stores): the pool + the selector. The 3D
// staging (walk a colleague over, speech bubbles, brain pausing) lives in
// NpcAmbientConversationController; the runtime state lives in npcAmbientStore.

import type { NpcId } from './npcChatTypes'
import type { CharacterEmotion } from '../character/performance/characterEmotion'

export interface NpcAmbientLine {
  speaker: NpcId
  text: string
  // 18H §7 (второй проход): эмоция говорящего на время реплики — тревожные
  // сюжетные биты играют телом иначе, чем бытовая болтовня. Применяет и
  // чистит NpcAmbientConversationController; на игровую математику не влияет.
  emotion?: CharacterEmotion
}

export interface NpcAmbientConversation {
  id: string
  // `mover` walks over to `host` (who stays put) before they talk — no teleport.
  mover: NpcId
  host: NpcId
  lines: NpcAmbientLine[]
  // Shown briefly in the HUD so a player who is across the office still learns a
  // conversation happened (§8: "если игрок далеко ... Команда обсудила ...").
  hudSummary: string
}

// The player-visible facts the selector reads. Everything here is derivable from
// state the player can already see — no hidden/actual risk leaks in (§14 rule).
export interface NpcAmbientContext {
  ilyaHired: boolean
  overloadedDev: boolean // a developer is planned > 10 days this sprint
  detectedHighRisk: boolean // some domain's DETECTED risk is high/critical
  serverRecoveryActive: boolean // a server incident is in recovery
  // СКУД (access control) has been offered but not installed (available/postponed).
  accessControlDecisionPending: boolean
  // an office-intrusion threat is armed — the HUD countdown is running.
  intrusionArmed: boolean
  readiness: number // OfficeFlow readiness %, 0..100
  day: number
  sprintNumber: number
  // Story conversations that have already fired once (persisted) — so a one-off
  // like "Sonya warns about the risk" does not repeat every day it stays true.
  playedIds: string[]
}

const present = (id: NpcId, ctx: NpcAmbientContext) => id !== 'ilya-vlasov' || ctx.ilyaHired

interface PoolEntry {
  conversation: NpcAmbientConversation
  when: (ctx: NpcAmbientContext) => boolean
  // Story beats fire once per campaign (deduped via playedIds); generic banter
  // repeats and rotates by day so ordinary days still vary.
  once: boolean
  priority: number // lower = more important; only compared among story beats
}

// --- Story beats: fire once, when a real situation arises (§8 examples) --------

const STORY: PoolEntry[] = [
  {
    // Foreshadows the office intrusion once the threat is armed (§10): the entrance
    // is exposed and the countdown is running — colleagues push to install СКУД.
    conversation: {
      id: 'intrusion-imminent',
      mover: 'sonya-sokolova',
      host: 'kirill-morozov',
      hudSummary: 'Соня и Кирилл торопят с установкой СКУД, пока вход открыт.',
      lines: [
        { speaker: 'sonya-sokolova', text: 'Если в ближайшие дни не поставим СКУД, к нам может войти кто угодно.', emotion: 'concerned' },
        { speaker: 'kirill-morozov', text: 'Вход и правда открыт для любого. Давай не тянуть с этим.', emotion: 'concerned' },
      ],
    },
    when: (c) => c.intrusionArmed,
    once: true,
    priority: 10,
  },
  {
    // Foreshadows the intrusion earlier — СКУД has been offered but not installed:
    // colleagues recall a similar break-in caused by an open entrance.
    conversation: {
      id: 'access-control-warning',
      mover: 'alina-belova',
      host: 'kirill-morozov',
      hudSummary: 'Алина и Кирилл вспомнили кражу у соседей из-за открытого входа.',
      lines: [
        { speaker: 'alina-belova', text: 'Слышал, к соседям на этаже зашёл кто-то под видом курьера и вынес ноутбук прямо со стола?', emotion: 'surprised' },
        { speaker: 'kirill-morozov', text: 'Ага. И на входе у них — никакого контроля доступа. У нас, между прочим, тоже.', emotion: 'concerned' },
      ],
    },
    when: (c) => c.accessControlDecisionPending && !c.intrusionArmed,
    once: true,
    priority: 20,
  },
  {
    // §8: Кирилл и Илья — при server recovery
    conversation: {
      id: 'kirill-ilya-recovery',
      mover: 'ilya-vlasov',
      host: 'kirill-morozov',
      hudSummary: 'Илья и Кирилл согласовали восстановление сервера.',
      lines: [
        { speaker: 'ilya-vlasov', text: 'Я собрал журналы до сбоя.', emotion: 'focused' },
        { speaker: 'kirill-morozov', text: 'Хорошо. Тогда я не буду повторно искать точку отказа.', emotion: 'relieved' },
      ],
    },
    when: (c) => c.serverRecoveryActive,
    once: true,
    priority: 30,
  },
  {
    // §8: Соня и Илья — при detected high risk
    conversation: {
      id: 'sonya-ilya-risk',
      mover: 'sonya-sokolova',
      host: 'ilya-vlasov',
      hudSummary: 'Соня и Илья обсудили нарастающий риск безопасности.',
      lines: [
        { speaker: 'sonya-sokolova', text: 'Насколько срочно нужно переключать команду?', emotion: 'concerned' },
        { speaker: 'ilya-vlasov', text: 'Инцидента ещё нет. Но откладывать исправление дальше уже опасно.', emotion: 'concerned' },
      ],
    },
    when: (c) => c.detectedHighRisk,
    once: true,
    priority: 40,
  },
  {
    // §8: Соня и Кирилл — при перегрузке
    conversation: {
      id: 'sonya-kirill-overload',
      mover: 'sonya-sokolova',
      host: 'kirill-morozov',
      hudSummary: 'Соня предупредила Кирилла о перегрузке спринта.',
      lines: [
        { speaker: 'sonya-sokolova', text: 'У тебя снова больше десяти дней работы.', emotion: 'concerned' },
        { speaker: 'kirill-morozov', text: 'Да. Если не отвлекусь на инфраструктуру, основную часть успею, но запас почти нулевой.', emotion: 'focused' },
      ],
    },
    when: (c) => c.overloadedDev,
    once: true,
    priority: 50,
  },
]

// --- Generic banter: always available, rotates by day so days differ ----------

const GENERIC: PoolEntry[] = [
  {
    // §8: Кирилл и Алина — общий feature-контракт
    conversation: {
      id: 'kirill-alina-contract',
      mover: 'alina-belova',
      host: 'kirill-morozov',
      hudSummary: 'Кирилл и Алина сверили контракт API формы бронирования.',
      lines: [
        { speaker: 'alina-belova', text: 'Мне нужен точный формат ответа для формы бронирования.', emotion: 'focused' },
        { speaker: 'kirill-morozov', text: 'После обеда зафиксирую контракт. Не начинай обработку ошибок по старому варианту.', emotion: 'confident' },
      ],
    },
    when: () => true,
    once: false,
    priority: 50,
  },
  {
    conversation: {
      id: 'kirill-alina-early',
      mover: 'alina-belova',
      host: 'kirill-morozov',
      hudSummary: 'Команда обсудила первые экраны OfficeFlow.',
      lines: [
        { speaker: 'alina-belova', text: 'Экран входа почти собран — жду только реальный ответ авторизации.', emotion: 'confident' },
        { speaker: 'kirill-morozov', text: 'Поднимаю заглушку сегодня, потом заменим на настоящий эндпоинт.', emotion: 'confident' },
      ],
    },
    when: (c) => c.readiness < 40,
    once: false,
    priority: 50,
  },
  {
    conversation: {
      id: 'kirill-alina-late',
      mover: 'alina-belova',
      host: 'kirill-morozov',
      hudSummary: 'Команда сверила готовность перед ревью.',
      lines: [
        { speaker: 'kirill-morozov', text: 'Основные эндпоинты закрыты. Осталось причесать каталог переговорных.', emotion: 'confident' },
        { speaker: 'alina-belova', text: 'Тогда добью валидацию формы — и можно показывать.', emotion: 'relieved' },
      ],
    },
    when: (c) => c.readiness >= 70,
    once: false,
    priority: 50,
  },
  {
    conversation: {
      id: 'sonya-kirill-checkin',
      mover: 'sonya-sokolova',
      host: 'kirill-morozov',
      hudSummary: 'Соня сверила статус задач с Кириллом.',
      lines: [
        { speaker: 'sonya-sokolova', text: 'Что по плану на сегодня?', emotion: 'neutral' },
        { speaker: 'kirill-morozov', text: 'Иду по доске сверху вниз. Ничего не блокирует, движемся.', emotion: 'confident' },
      ],
    },
    when: () => true,
    once: false,
    priority: 50,
  },
]

// Deterministically choose at most one conversation for the current day.
// Priority: an un-fired story beat that matches the real situation, else a
// generic banter rotated by the day so ordinary days keep changing. Returns null
// only when no participants are available (e.g. before anyone is hired).
export function pickNpcAmbientConversation(ctx: NpcAmbientContext): NpcAmbientConversation | null {
  const runnable = (e: PoolEntry) => e.conversation.mover !== e.conversation.host && present(e.conversation.mover, ctx) && present(e.conversation.host, ctx) && e.when(ctx)

  const story = STORY.filter((e) => runnable(e) && !ctx.playedIds.includes(e.conversation.id)).sort((a, b) => a.priority - b.priority)
  if (story.length > 0) return story[0].conversation

  const generic = GENERIC.filter(runnable)
  if (generic.length === 0) return null
  // Stable per-day rotation; two different days pick different banter.
  const idx = ((ctx.sprintNumber * 7 + ctx.day) % generic.length + generic.length) % generic.length
  return generic[idx].conversation
}

// Whether a conversation should be remembered as "already fired" (story beats).
export function isOnceConversation(id: string): boolean {
  return STORY.some((e) => e.conversation.id === id && e.once)
}

// The most recent line spoken by a participant up to (and including) lineIndex —
// used to render that colleague's speech bubble. Null before they have spoken.
export function visibleLineFor(conversation: NpcAmbientConversation, lineIndex: number, npcId: NpcId): string | null {
  let text: string | null = null
  for (let i = 0; i <= lineIndex && i < conversation.lines.length; i++) {
    if (conversation.lines[i].speaker === npcId) text = conversation.lines[i].text
  }
  return text
}
