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

export function buildSprintKickoffDialogue(ctx: SprintKickoffContext): DialogueLine[] {
  const asPm = { speaker: ctx.pm.name, speakerRole: ctx.pm.role, portrait: ctx.pm.portrait }
  const lines: DialogueLine[] = [
    { ...asPm, text: `Планёрка спринта ${ctx.sprintNumber}. Разобрали доску — вот на чём фокус.` },
  ]

  for (const dev of ctx.developers) {
    const asDev = { speaker: dev.name, speakerRole: dev.role, portrait: dev.portrait }
    lines.push({
      ...asDev,
      text: dev.firstTask
        ? `Беру «${dev.firstTask}». Загрузка на спринт — ${dev.load}/10 рабочих дней.`
        : 'На этот спринт мне задач не досталось — подхвачу, если что-то освободится.',
    })
  }

  if (ctx.overloaded) {
    lines.push({ ...asPm, text: 'План плотный: часть задач может не уложиться в 10 дней. Держим приоритеты.' })
  }

  if (ctx.specialist) {
    const asIlya = { speaker: ctx.specialist.name, speakerRole: ctx.specialist.role, portrait: ctx.specialist.portrait }
    lines.push({
      ...asIlya,
      text:
        ctx.specialist.openFindings > 0
          ? `Держу безопасность в фокусе. Открытых замечаний — ${ctx.specialist.openFindings}, не откладываем их.`
          : 'Держу безопасность в фокусе — по замечаниям пока чисто.',
    })
  }

  lines.push({ ...asPm, text: 'Погнали.' })
  return lines
}
