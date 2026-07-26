import { femalePm } from '../character/characters/femalePm'
import type { DialogueLine, ChoiceOption } from './gameStore'
import type { PostAuditDialogueBranch, SecurityStaffingDecision } from './securityStoryRules'

// Static conversation script for the post-audit talk with Sonya (Feature 06).
// Only the text lives here; the state lifecycle stays in securityStoryStore and
// the sequencing in PostAuditConversationController. Sonya's opening tone
// follows the earlier security-breach choice (see getPostAuditDialogueBranch).

const asSonya = (text: string): DialogueLine => ({
  speaker: femalePm.persona!.name,
  speakerRole: femalePm.persona!.role,
  portrait: femalePm.portraitWorried ?? femalePm.portrait,
  text,
})

// Branch A - the player took responsibility in the breach scene.
const CONSTRUCTIVE: DialogueLine[] = [
  asSonya('Спасибо, что не стали сваливать всё на одного человека. Проблема не в одном незаблокированном компьютере.'),
  asSonya('У нас уже есть разработчики, рабочий прототип, серверы и учётные записи. Но за безопасность системно никто не отвечает.'),
  asSonya(
    'Я считаю, нам нужен отдельный специалист по информационной безопасности. Он будет разбирать замечания аудита, проводить обучение и проверять новые решения до релиза.',
  ),
]

// Branch B - the player blamed Sonya in the breach scene.
const CONFLICT: DialogueLine[] = [
  asSonya('После аудита вы решили сделать виноватой меня. Но проблема не исчезнет от того, кому выдадут выговор.'),
  asSonya('У нас есть разработчики, рабочий прототип, серверы и учётные записи. При этом за безопасность системно никто не отвечает.'),
  asSonya(
    'Если мы продолжим искать крайнего после каждого нарушения, следующая проверка закончится намного хуже. Нам нужен отдельный специалист по информационной безопасности.',
  ),
]

// Fallback for an old or corrupt save without a recorded breach decision.
const NEUTRAL: DialogueLine[] = [
  asSonya(
    'Аудит показал, что безопасность у нас держится на случайных решениях. Теперь у нас есть команда, прототип и данные, поэтому так продолжаться не может.',
  ),
]

export function postAuditIntroLines(branch: PostAuditDialogueBranch): DialogueLine[] {
  if (branch === 'constructive') return CONSTRUCTIVE
  if (branch === 'conflict') return CONFLICT
  return NEUTRAL
}

// Exactly two staffing decisions - no external consultant / contractor option.
export const POST_AUDIT_CHOICES: ChoiceOption[] = [
  { id: 'approve-security-hire', label: 'Открываем вакансию. Нанимаем безопасника.' },
  { id: 'decline-security-hire', label: 'Нет. Пока справимся своими силами.' },
]

export function postAuditFinalLines(decision: SecurityStaffingDecision): DialogueLine[] {
  if (decision === 'approve-security-hire') {
    return [
      asSonya(
        'Хорошо. Я подготовлю требования к вакансии. Но учтите: безопасник будет просить время разработчиков на исправления, а его зарплата увеличит наши постоянные расходы.',
      ),
    ]
  }
  return [
    asSonya(
      'Тогда замечания аудита останутся на нашей ответственности. Если мы не успеем их закрыть, следующая проверка уже не ограничится предупреждением.',
    ),
  ]
}
