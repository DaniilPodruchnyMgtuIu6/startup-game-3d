import type { ChoiceOption, DialogueLine } from '../gameStore'
import { femalePm } from '../../character/characters/femalePm'

// Static dialogue of the demo baseline scene (Feature 17A): Sonya explains that
// the office check has to happen either way, and the player picks HOW. The
// lines follow the Feature 17 overview script. Effects are NOT applied here in
// 17A - the choice is only recorded (see storyDecisionHandlers).

const asSonya = (text: string): DialogueLine => ({
  speaker: femalePm.persona!.name,
  speakerRole: femalePm.persona!.role,
  portrait: femalePm.portrait,
  text,
})

export function baselineIntroLines(): DialogueLine[] {
  return [
    asSonya('Команду разработки мы собрали. Но перед тем как разгонять работу, нужно проверить офис, компьютеры, доступы и то, как мы храним проект.'),
    asSonya('Эту проверку всё равно придётся провести. Вопрос только в том, как именно.'),
    asSonya('Мы можем заказать формальный аудит сейчас. Это быстрее даст список проблем, но потребует денег и отвлечёт команду на исправления.'),
    asSonya('Или сначала нанять специалиста по безопасности. Он останется с нами и будет следить за системой дальше, но зарплата начнёт списываться каждый день.'),
  ]
}

export const BASELINE_CHOICES: ChoiceOption[] = [
  { id: 'order-external-audit', label: 'Заказать аудит' },
  { id: 'hire-security-specialist-first', label: 'Сначала нанять безопасника' },
]

export function baselineReactionLines(choiceId: string): DialogueLine[] {
  if (choiceId === 'hire-security-specialist-first') {
    return [asSonya('Хорошо. Тогда сначала займёмся человеком, который останется отвечать за безопасность. Вернёмся к этому после проверки.')]
  }
  return [asSonya('Принято. Закажу формальный аудит — список проблем получим быстро, а дальше решим, кто будет их закрывать.')]
}
