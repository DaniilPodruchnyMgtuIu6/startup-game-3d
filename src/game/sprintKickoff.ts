import type { DialogueLine } from './gameStore'

// Feature 16 §2: the sprint kickoff. On the first day of an active sprint the
// team gathers at the board and speaks a SHORT deterministic dialogue built from
// the REAL sprint plan (first tasks, load, overload) plus Ilya's security focus
// when he is actually hired. Pure + static fallback — no DeepSeek.

export interface KickoffDeveloper {
  name: string
  role: string
  portrait?: string
  firstTask?: string
  load: number // planned days for this sprint
}

export interface KickoffSpecialist {
  name: string
  role: string
  portrait?: string
  openFindings: number
}

export interface SprintKickoffContext {
  sprintNumber: number
  pm: { name: string; role: string; portrait?: string }
  developers: KickoffDeveloper[]
  overloaded: boolean
  specialist?: KickoffSpecialist // present only when Ilya is really hired
}

// Deterministic per-sprint variety (18H, «не делать офисную жизнь чрезмерно
// заскриптованной»): the kickoff plays every sprint, so the opener/closer
// rotate by sprint number - same sprint always speaks the same words
// (reload-safe), consecutive sprints don't sound like a recording.
const OPENER_TAILS = [
  'Разобрали доску — вот на чём фокус.',
  'План на доске, пройдёмся по главному.',
  'Коротко по приоритетам — начнём с главного.',
]
const CLOSERS = ['Погнали.', 'За работу. Вопросы — сразу ко мне.', 'Начинаем. Встретимся на статусе.']

export function buildSprintKickoffDialogue(ctx: SprintKickoffContext): DialogueLine[] {
  const asPm = { speaker: ctx.pm.name, speakerRole: ctx.pm.role, portrait: ctx.pm.portrait }
  const lines: DialogueLine[] = [
    {
      ...asPm,
      text: `Планёрка спринта ${ctx.sprintNumber}. ${OPENER_TAILS[ctx.sprintNumber % OPENER_TAILS.length]}`,
      // 18H §7: the plan she is presenting is ON the board - the team's
      // attention belongs there, not on her face, for this one opening line.
      cue: { speakerEmotion: 'confident', listenerReaction: 'focused-listening', focusTarget: 'whiteboard' },
    },
  ]

  for (const dev of ctx.developers) {
    const asDev = { speaker: dev.name, speakerRole: dev.role, portrait: dev.portrait }
    lines.push({
      ...asDev,
      text: dev.firstTask
        ? `Беру «${dev.firstTask}». Загрузка на спринт — ${dev.load}/10 рабочих дней.`
        : 'На этот спринт мне задач не досталось — подхвачу, если что-то освободится.',
      // A dev with a real task states it plainly; a dev with nothing to do
      // says so a little awkwardly - the room's reaction differs to match.
      cue: dev.firstTask
        ? { speakerEmotion: 'confident', listenerReaction: 'focused-listening' }
        : { speakerEmotion: 'neutral', listenerReaction: 'thinking' },
    })
  }

  if (ctx.overloaded) {
    lines.push({
      ...asPm,
      text: 'План плотный: часть задач может не уложиться в 10 дней. Держим приоритеты.',
      cue: { speakerEmotion: 'concerned', listenerReaction: 'concerned-listening' },
    })
  }

  if (ctx.specialist) {
    const asIlya = { speaker: ctx.specialist.name, speakerRole: ctx.specialist.role, portrait: ctx.specialist.portrait }
    const hasFindings = ctx.specialist.openFindings > 0
    lines.push({
      ...asIlya,
      text: hasFindings
        ? `Держу безопасность в фокусе. Открытых замечаний — ${ctx.specialist.openFindings}, не откладываем их.`
        : 'Держу безопасность в фокусе — по замечаниям пока чисто.',
      cue: hasFindings
        ? { speakerEmotion: 'focused', listenerReaction: 'concerned-listening' }
        : { speakerEmotion: 'relieved', listenerReaction: 'relieved-reaction' },
    })
  }

  lines.push({
    ...asPm,
    text: CLOSERS[ctx.sprintNumber % CLOSERS.length],
    cue: { speakerEmotion: 'confident', listenerReaction: 'nod' },
  })
  return lines
}
