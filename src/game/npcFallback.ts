import type { NpcId } from './npcChatTypes'

// Static fallback replies shown when the provider is unconfigured/unavailable
// (§22). The game stays fully playable without the API — these never claim to be
// a real DeepSeek answer (the store marks them local).

const FALLBACK: Record<NpcId, string> = {
  'sonya-sokolova':
    'Сейчас не получается продолжить свободный разговор. Давайте вернёмся к текущим задачам — они всё равно доступны на доске.',
  'kirill-morozov':
    'Связь сейчас не работает. По текущей задаче лучше посмотреть прогресс на доске OfficeFlow.',
  'alina-belova':
    'Похоже, чат временно недоступен. Интерфейс игры продолжает работать — попробуем поговорить позже.',
  'ilya-vlasov':
    'Свободный разговор сейчас недоступен. Обнаруженные риски и назначения остаются на доске безопасности.',
}

export function getNpcFallbackReply(npcId: NpcId): string {
  return FALLBACK[npcId]
}
