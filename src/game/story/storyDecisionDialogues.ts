import type { ChoiceOption, DialogueLine } from '../gameStore'
import { femalePm } from '../../character/characters/femalePm'
import { kirillMorozov } from '../../character/characters/kirillMorozov'
import { alinaBelova } from '../../character/characters/alinaBelova'
import { ilyaVlasov } from '../../character/characters/ilyaVlasov'
import type { Level1StoryDecisionId } from './level1Timeline'

// Static dialogue scripts of the eight Level 1 decision scenes (Feature 17B).
// Text only - triggers live in storyDecisionRules, effects in the handlers.
// Ilya's lines and the Ilya-only third choices appear ONLY when he is really
// hired. Choice hints are qualitative trade-offs, never raw numbers.

export interface StorySceneContext {
  ilyaHired: boolean
}

export interface StorySceneScript {
  lines: DialogueLine[]
  choices: ChoiceOption[]
  reaction: (choiceId: string) => DialogueLine[]
}

// 18H §7 (второй проход, «обогащай эмоции»): каждая строка может нести
// DialoguePerformanceCue - эмоция говорящего + реакция слушателя, подобранные
// по СМЫСЛУ реплики (никогда случайно). В парных сценах реакция достаётся
// собеседнику-игроку/партнёру через applyCue в conversation cinematic.
type Cue = DialogueLine['cue']
const sonya = (text: string, cue?: Cue): DialogueLine => ({ speaker: femalePm.persona!.name, speakerRole: femalePm.persona!.role, portrait: femalePm.portrait, text, cue })
const sonyaWorried = (text: string, cue?: Cue): DialogueLine => ({
  speaker: femalePm.persona!.name,
  speakerRole: femalePm.persona!.role,
  portrait: femalePm.portraitWorried ?? femalePm.portrait,
  text,
  cue: cue ?? { speakerEmotion: 'concerned', listenerReaction: 'concerned-listening' },
})
const kirill = (text: string, cue?: Cue): DialogueLine => ({ speaker: kirillMorozov.persona!.name, speakerRole: kirillMorozov.persona!.role, portrait: kirillMorozov.portrait, text, cue })
const alina = (text: string, cue?: Cue): DialogueLine => ({ speaker: alinaBelova.persona!.name, speakerRole: alinaBelova.persona!.role, portrait: alinaBelova.portrait, text, cue })
const ilya = (text: string, cue?: Cue): DialogueLine => ({ speaker: ilyaVlasov.persona!.name, speakerRole: ilyaVlasov.persona!.role, portrait: ilyaVlasov.portrait, text, cue })

// --- 1. security-baseline-path ----------------------------------------------

function baselineScene(): StorySceneScript {
  return {
    lines: [
      sonya('Команду разработки мы собрали. Но перед стартом нужно проверить весь офис: компьютеры, доступы, серверы и рабочие файлы.', { speakerEmotion: 'focused', listenerReaction: 'focused-listening' }),
      kirill('Сейчас всё работает. Но часть настроек мы делали быстро, и я не могу обещать, что нигде не осталось лишнего доступа.', { speakerEmotion: 'concerned', listenerReaction: 'concerned-listening' }),
      alina('Мне тоже нужно понимать, какие данные можно использовать в макетах и тестах.', { speakerEmotion: 'focused', listenerReaction: 'thinking' }),
      sonya('Проверку всё равно придётся провести. Есть два пути.', { speakerEmotion: 'focused', listenerReaction: 'look-at-speaker' }),
      sonya('Заказать формальный аудит сейчас — мы быстро получим список проблем, но заплатим и отвлечёмся на исправления.', { speakerEmotion: 'neutral', listenerReaction: 'thinking' }),
      sonya('Или сначала нанять специалиста по безопасности. Он останется в команде, но его зарплата станет постоянным расходом.', { speakerEmotion: 'neutral', listenerReaction: 'thinking' }),
    ],
    choices: [
      { id: 'commission-security-audit', label: 'Заказать аудит', hint: 'Быстрый независимый список проблем. Потребует заметных расходов.' },
      {
        id: 'hire-security-specialist-first',
        label: 'Сначала нанять безопасника',
        hint: 'Постоянный контроль и дополнительные варианты решений. Увеличит ежедневные расходы.',
      },
    ],
    reaction: (choiceId) =>
      choiceId === 'hire-security-specialist-first'
        ? [sonya('Тогда не затягиваем с вакансией. Само решение нанять специалиста ещё не означает, что система проверена.', { speakerEmotion: 'confident', listenerReaction: 'nod' })]
        : [sonya('Хорошо. Получим факты до того, как начнём наращивать скорость.', { speakerEmotion: 'confident', listenerReaction: 'nod' })],
  }
}

// --- 2. developer-admin-access ----------------------------------------------

function adminAccessScene(ctx: StorySceneContext): StorySceneScript {
  return {
    lines: [
      kirill('Чтобы не ждать подтверждения на каждую настройку, мне нужен постоянный административный доступ.', { speakerEmotion: 'confident', listenerReaction: 'focused-listening' }),
      sonya('Это ускорит работу. Но один постоянный доступ ко всему выглядит рискованно.', { speakerEmotion: 'concerned', listenerReaction: 'thinking' }),
      kirill('Согласен. Альтернатива — выдавать права под конкретную задачу. Тогда часть времени уйдёт на запросы и проверку.', { speakerEmotion: 'neutral', listenerReaction: 'focused-listening' }),
      ...(ctx.ilyaHired ? [ilya('Если я уже в команде, можно настроить контролируемое повышение прав. Но это тоже отдельная работа.', { speakerEmotion: 'focused', listenerReaction: 'focused-listening' })] : []),
    ],
    choices: [
      {
        id: 'grant-permanent-admin',
        label: 'Постоянный admin',
        hint: 'Не задерживает разработку. Расширяет возможный ущерб при компрометации доступа.',
      },
      {
        id: 'use-just-in-time-access',
        label: 'Временный доступ по задаче',
        hint: 'Снижает риск лишних прав. Кирилл потеряет один рабочий день.',
      },
      ...(ctx.ilyaHired
        ? [
            {
              id: 'configure-controlled-access',
              label: 'Контролируемое повышение прав',
              hint: 'Сохраняет скорость разработки. Потребует денег и рабочего дня Ильи.',
            },
          ]
        : []),
    ],
    reaction: (choiceId) => {
      if (choiceId === 'use-just-in-time-access') return [kirill('Это медленнее, но область доступа будет понятной. Заложу время в текущую задачу.', { speakerEmotion: 'focused', listenerReaction: 'nod' })]
      if (choiceId === 'configure-controlled-access') return [ilya('Настрою выдачу прав так, чтобы постоянного административного доступа не осталось.', { speakerEmotion: 'confident', listenerReaction: 'nod' })]
      return [kirill('Понял. Зафиксирую доступ и буду использовать только для проекта.', { speakerEmotion: 'neutral', listenerReaction: 'nod' })]
    },
  }
}

// --- 3. frontend-test-data ---------------------------------------------------

function testDataScene(ctx: StorySceneContext): StorySceneScript {
  return {
    lines: [
      alina('Мне нужны реальные примеры сотрудников, комнат и пропусков. На пустых макетах ошибки не видно.', { speakerEmotion: 'focused', listenerReaction: 'focused-listening' }),
      kirill('Можно выгрузить копию текущих данных. Это самый быстрый вариант.', { speakerEmotion: 'neutral', listenerReaction: 'thinking' }),
      alina('Только там будут имена, почта и история бронирований.', { speakerEmotion: 'concerned', listenerReaction: 'concerned-listening' }),
      sonya('Нам нужно решить, что важнее сейчас: скорость или безопасная тестовая среда.', { speakerEmotion: 'focused', listenerReaction: 'look-at-speaker' }),
    ],
    choices: [
      {
        id: 'copy-production-data',
        label: 'Скопировать реальные данные',
        hint: 'Не задерживает интерфейс. Реальные данные окажутся в тестовой среде.',
      },
      {
        id: 'create-synthetic-data',
        label: 'Создать синтетические данные',
        hint: 'Безопасная тестовая среда. Алина потеряет один рабочий день.',
      },
      ...(ctx.ilyaHired
        ? [
            {
              id: 'mask-data-with-security',
              label: 'Сделать маскированную копию',
              hint: 'Сохраняет реалистичные данные без прямых идентификаторов. Потребует денег и времени Ильи.',
            },
          ]
        : []),
    ],
    reaction: (choiceId) => {
      if (choiceId === 'create-synthetic-data') return [alina('Потеряем день, зато сможем свободно проверять ошибки и крайние случаи.', { speakerEmotion: 'relieved', listenerReaction: 'nod' })]
      if (choiceId === 'mask-data-with-security') return [ilya('Подготовлю правила маскирования. В тестовой среде не должно остаться прямых идентификаторов.', { speakerEmotion: 'confident', listenerReaction: 'nod' })]
      return [alina('Хорошо. Тогда после проверки нужно будет отдельно удалить копию.', { speakerEmotion: 'concerned', listenerReaction: 'thinking' })]
    },
  }
}

// --- 4. security-first-priority ----------------------------------------------

function firstPriorityScene(): StorySceneScript {
  return {
    lines: [
      ilya('Я посмотрел офис и текущие настройки. Закрыть всё одновременно не получится.', { speakerEmotion: 'focused', listenerReaction: 'focused-listening' }),
      sonya('Что требует внимания в первую очередь?', { speakerEmotion: 'neutral', listenerReaction: 'look-at-speaker' }),
      ilya('Рабочие компьютеры почти не контролируются. Центральных журналов недостаточно. И сотрудники пока не знают, как сообщать о подозрительных письмах и посетителях.', { speakerEmotion: 'concerned', listenerReaction: 'concerned-listening' }),
      ilya('Выберите первый приоритет. Остальное не исчезнет, но этот риск мы начнём снижать сразу.', { speakerEmotion: 'focused', listenerReaction: 'thinking' }),
    ],
    choices: [
      {
        id: 'prioritize-endpoint-protection',
        label: 'Защита рабочих компьютеров',
        hint: 'Снижает риск вредоносных действий на рабочих компьютерах. Самый дорогой вариант.',
      },
      {
        id: 'prioritize-central-logging',
        label: 'Централизованные журналы',
        hint: 'Позволяет раньше замечать подозрительную активность. Потребует двух рабочих дней Ильи.',
      },
      {
        id: 'prioritize-security-training',
        label: 'Обучение сотрудников',
        hint: 'Самый доступный вариант. Снижает риск ошибок сотрудников и посетителей.',
      },
    ],
    reaction: (choiceId) => {
      if (choiceId === 'prioritize-central-logging')
        return [ilya('Соберу события в одном месте. Тогда мы хотя бы увидим проблему до того, как она превратится в полноценный инцидент.', { speakerEmotion: 'confident', listenerReaction: 'nod' })]
      if (choiceId === 'prioritize-security-training')
        return [ilya('Хорошо. Начнём с людей. Большинство проблем сначала выглядит как обычная просьба или письмо.', { speakerEmotion: 'confident', listenerReaction: 'nod' })]
      return [ilya('Начну с рабочих станций. Если одна из них будет скомпрометирована, ущерб не должен распространиться дальше.', { speakerEmotion: 'confident', listenerReaction: 'nod' })]
    },
  }
}

// --- 5. backup-and-restore-strategy ------------------------------------------

function backupScene(ctx: StorySceneContext): StorySceneScript {
  return {
    lines: [
      kirill('Резервные копии формально есть. Но мы ни разу не восстанавливали из них проект целиком.', { speakerEmotion: 'concerned', listenerReaction: 'focused-listening' }),
      sonyaWorried('То есть копия есть, а вернуть работу после сбоя мы не проверяли?', { speakerEmotion: 'surprised', listenerReaction: 'surprised-reaction' }),
      kirill('Именно. Полная проверка займёт время. Можно ограничиться настройкой расписания или отложить до более спокойного спринта.', { speakerEmotion: 'neutral', listenerReaction: 'thinking' }),
      ctx.ilyaHired
        ? ilya('Непроверенная копия — это надежда, а не план восстановления.', { speakerEmotion: 'concerned', listenerReaction: 'concerned-listening' })
        : sonya('Пока восстановление не проверено, наша готовность к сбою — только предположение.', { speakerEmotion: 'concerned', listenerReaction: 'concerned-listening' }),
    ],
    choices: [
      {
        id: 'run-full-restore-drill',
        label: 'Провести полное восстановление',
        hint: 'Подтверждает, что проект можно вернуть после сбоя. Кирилл потеряет два рабочих дня.',
      },
      {
        id: 'configure-backups-only',
        label: 'Настроить копии без проверки',
        hint: 'Лучше, чем отсутствие копий. Но возможность полного восстановления останется неизвестной.',
      },
      {
        id: 'postpone-backup-work',
        label: 'Отложить',
        hint: 'Не тратит бюджет и время сейчас. Оставляет проект без подтверждённого восстановления.',
      },
    ],
    reaction: (choiceId) => {
      if (choiceId === 'configure-backups-only')
        return [kirill('Настрою расписание. Но в отчёте честно отмечу: полное восстановление мы не проверяли.', { speakerEmotion: 'neutral', listenerReaction: 'thinking' })]
      if (choiceId === 'postpone-backup-work')
        return [sonyaWorried('Записываю как осознанный риск. К этому вопросу придётся вернуться до следующего контрольного этапа.', { speakerEmotion: 'concerned', listenerReaction: 'controlled-frustration' })]
      return [kirill('Тогда остановлю свою задачу и подниму отдельную копию проекта с нуля.', { speakerEmotion: 'confident', listenerReaction: 'nod' })]
    },
  }
}

// --- 6. architecture-boundary ------------------------------------------------

function architectureScene(ctx: StorySceneContext): StorySceneScript {
  return {
    lines: [
      kirill('Сейчас авторизация, бронирования и служебные операции используют общую базу и общий технический доступ.', { speakerEmotion: 'focused', listenerReaction: 'focused-listening' }),
      alina('Для интерфейса это удобно: меньше разных ошибок и ожидания.', { speakerEmotion: 'neutral', listenerReaction: 'neutral-listening' }),
      ctx.ilyaHired
        ? ilya('Но одна неверная настройка даст доступ сразу к нескольким частям системы.', { speakerEmotion: 'concerned', listenerReaction: 'concerned-listening' })
        : kirill('Но одна неверная настройка даст доступ сразу к нескольким частям системы — это честный минус текущей схемы.', { speakerEmotion: 'concerned', listenerReaction: 'concerned-listening' }),
      sonya('Если разделить границы сейчас, мы потеряем время до релиза.', { speakerEmotion: 'concerned', listenerReaction: 'thinking' }),
      kirill('Если оставить как есть, мы быстрее закончим MVP, но переделка потом станет дороже.', { speakerEmotion: 'focused', listenerReaction: 'thinking' }),
    ],
    choices: [
      {
        id: 'keep-shared-architecture',
        label: 'Оставить общую схему',
        hint: 'Ускоряет backend-разработку. Одна ошибка может затронуть несколько частей системы.',
      },
      {
        id: 'separate-security-boundaries',
        label: 'Разделить доступы',
        hint: 'Локализует будущие ошибки. Добавляет два рабочих дня backend-разработки.',
      },
      {
        id: 'request-architecture-review',
        label: 'Заказать архитектурное review',
        hint: 'Компромисс между сроком и безопасностью. Потребует денег и одного рабочего дня.',
      },
    ],
    reaction: (choiceId) => {
      if (choiceId === 'separate-security-boundaries')
        return [kirill('Разведу доступы по границам. Пару дней потеряем, зато ошибка останется в своей зоне.', { speakerEmotion: 'confident', listenerReaction: 'nod' })]
      if (choiceId === 'request-architecture-review')
        return [sonya('Закажу внешнее техническое review. Получим независимый план без постоянного найма.', { speakerEmotion: 'focused', listenerReaction: 'nod' })]
      return [kirill('Оставляем общую схему. Скорость сохраняем, но фиксирую это как осознанный компромисс.', { speakerEmotion: 'neutral', listenerReaction: 'thinking' })]
    },
  }
}

// --- 7. suspicious-activity-disclosure ---------------------------------------

function disclosureScene(ctx: StorySceneContext): StorySceneScript {
  return {
    lines: [
      ctx.ilyaHired
        ? ilya('В журналах есть активность, которую я не могу объяснить обычной работой команды.', { speakerEmotion: 'concerned', listenerReaction: 'surprised-reaction' })
        : kirill('В журналах есть активность, которую я не могу объяснить нашей обычной работой.', { speakerEmotion: 'concerned', listenerReaction: 'surprised-reaction' }),
      kirill('Подтверждённого инцидента пока нет. Это может быть старая служебная сессия.', { speakerEmotion: 'neutral', listenerReaction: 'thinking' }),
      sonyaWorried('Если сообщить руководству сейчас, они потребуют официальную проверку и остановку части работ.'),
      sonyaWorried('Если разбираться тихо, мы сохраним темп, но ответственность будет полностью на нас.', { speakerEmotion: 'concerned', listenerReaction: 'thinking' }),
    ],
    choices: [
      {
        id: 'report-activity-immediately',
        label: 'Сообщить сразу',
        hint: 'Снижает риск претензий руководства. Потребует официальной проверки и расходов.',
      },
      {
        id: 'investigate-quietly',
        label: 'Расследовать внутри команды',
        hint: 'Сохраняет темп и бюджет. Если инцидент произойдёт раньше окончания проверки, руководство узнает о задержке.',
      },
      {
        id: 'dismiss-as-false-positive',
        label: 'Считать ложным срабатыванием',
        hint: 'Не задерживает работу. Серьёзно увеличивает последствия, если предупреждение было реальным.',
      },
    ],
    reaction: (choiceId) => {
      if (choiceId === 'investigate-quietly')
        return [
          ctx.ilyaHired
            ? ilya('Мне нужен один день. Если увижу подтверждение инцидента, сообщаем сразу, без второго обсуждения.', { speakerEmotion: 'focused', listenerReaction: 'nod' })
            : kirill('Мне нужен один день. Если увижу подтверждение инцидента, сообщаем сразу, без второго обсуждения.', { speakerEmotion: 'focused', listenerReaction: 'nod' }),
        ]
      if (choiceId === 'dismiss-as-false-positive')
        return [kirill('Хорошо. Я закрою старые сессии, но оставлю копию журналов на случай повторения.', { speakerEmotion: 'neutral', listenerReaction: 'small-head-shake' })]
      return [sonya('Я отправлю руководству короткое сообщение без предположений. Только факты и план проверки.', { speakerEmotion: 'confident', listenerReaction: 'nod' })]
    },
  }
}

// --- 8. release-risk-decision ------------------------------------------------

function releaseScene(ctx: StorySceneContext): StorySceneScript {
  return {
    lines: [
      sonya('MVP готов. Но перед отправкой отчёта нужно решить, как мы зафиксируем оставшиеся риски.', { speakerEmotion: 'focused', listenerReaction: 'focused-listening' }),
      kirill('Технически выпуск возможен сегодня.', { speakerEmotion: 'confident', listenerReaction: 'nod' }),
      alina('Пользовательские сценарии работают. Но часть защитных решений мы отложили ради срока.', { speakerEmotion: 'concerned', listenerReaction: 'thinking' }),
      ctx.ilyaHired
        ? ilya('Можно выпустить с документированными ограничениями. Можно взять ещё время на укрепление. И можно попытаться не поднимать вопрос, но это не уберёт сам риск.', { speakerEmotion: 'focused', listenerReaction: 'concerned-listening' })
        : sonya('По нашим наблюдениям, варианта три: выпустить с документированными ограничениями, взять время на укрепление или не поднимать вопрос — но риск от этого не исчезнет.', { speakerEmotion: 'focused', listenerReaction: 'concerned-listening' }),
    ],
    choices: [
      {
        id: 'release-with-known-risk',
        label: 'Выпустить с известным риском',
        hint: 'Выпуск сегодня с честным перечнем ограничений. Снизит итоговую оценку.',
      },
      {
        id: 'delay-for-hardening',
        label: 'Отложить ради укрепления',
        hint: 'Снижает оставшиеся риски. Потребует двух рабочих дней и ежедневных расходов.',
      },
      {
        id: 'hide-open-risk',
        label: 'Скрыть открытый риск',
        hint: 'Позволяет отправить отчёт без задержки. Если проблема обнаружится, доверие руководства будет потеряно.',
      },
    ],
    reaction: (choiceId) => {
      if (choiceId === 'delay-for-hardening')
        return [sonya('Беру два дня на укрепление. Расходы продолжатся, но в отчёт пойдёт система, за которую не страшно.', { speakerEmotion: 'confident', listenerReaction: 'nod' })]
      if (choiceId === 'hide-open-risk')
        return [sonyaWorried('Понимаю. Отчёт уйдёт без этого пункта. Надеюсь, нам не придётся объяснять это позже.', { speakerEmotion: 'sad', listenerReaction: 'controlled-frustration' })]
      return [sonya('Готовлю честный перечень ограничений. Руководство увидит и продукт, и его цену.', { speakerEmotion: 'confident', listenerReaction: 'nod' })]
    },
  }
}

export function buildStorySceneScript(id: Level1StoryDecisionId, ctx: StorySceneContext): StorySceneScript {
  switch (id) {
    case 'security-baseline-path':
      return baselineScene()
    case 'developer-admin-access':
      return adminAccessScene(ctx)
    case 'frontend-test-data':
      return testDataScene(ctx)
    case 'security-first-priority':
      return firstPriorityScene()
    case 'backup-and-restore-strategy':
      return backupScene(ctx)
    case 'architecture-boundary':
      return architectureScene(ctx)
    case 'suspicious-activity-disclosure':
      return disclosureScene(ctx)
    case 'release-risk-decision':
      return releaseScene(ctx)
  }
}
