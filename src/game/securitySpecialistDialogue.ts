import { ilyaVlasov } from '../character/characters/ilyaVlasov'
import type { DialogueLine } from './gameStore'

// Static conversation lines for the hired security specialist (Feature 07).
// Text only - no DeepSeek, no onboarding objective; the talk never blocks the
// day. Which set plays depends on hasIntroducedSecuritySpecialist in the story
// store (first meeting vs. every meeting after).

const asIlya = (text: string): DialogueLine => ({
  speaker: ilyaVlasov.persona!.name,
  speakerRole: ilyaVlasov.persona!.role,
  portrait: ilyaVlasov.portrait,
  text,
})

// Shown once, the first time the player talks to Ilya.
export const SECURITY_SPECIALIST_INTRO_LINES: DialogueLine[] = [
  asIlya('Я посмотрю, как у вас устроены доступы, серверы и внутренние процессы.'),
  asIlya('Сразу предупрежу: моя задача не запретить команде работать. Моя задача — показать, где быстрое решение создаёт дорогой риск.'),
  asIlya('Когда найду критичную проблему, окончательное решение всё равно останется за вами.'),
]

// Shown on every later conversation.
export const SECURITY_SPECIALIST_REPEAT_LINES: DialogueLine[] = [
  asIlya('Пока собираю картину по инфраструктуре. После следующей проверки смогу дать конкретные рекомендации.'),
]

// Shown instead of the repeat line while there is an unacknowledged high/critical
// risk observation (Feature 09).
export const SECURITY_SPECIALIST_RISK_ALERT_LINES: DialogueLine[] = [
  asIlya('Я обнаружил риск, который стоит посмотреть на доске безопасности. Проблема пока не стала инцидентом, но откладывать её опасно.'),
]

export const SECURITY_SPECIALIST_CLOSING_LABEL = 'Понятно.'
