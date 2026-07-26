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

const sonya = (text: string): DialogueLine => ({ speaker: femalePm.persona!.name, speakerRole: femalePm.persona!.role, portrait: femalePm.portrait, text })
const sonyaWorried = (text: string): DialogueLine => ({
  speaker: femalePm.persona!.name,
  speakerRole: femalePm.persona!.role,
  portrait: femalePm.portraitWorried ?? femalePm.portrait,
  text,
})
const kirill = (text: string): DialogueLine => ({ speaker: kirillMorozov.persona!.name, speakerRole: kirillMorozov.persona!.role, portrait: kirillMorozov.portrait, text })
const alina = (text: string): DialogueLine => ({ speaker: alinaBelova.persona!.name, speakerRole: alinaBelova.persona!.role, portrait: alinaBelova.portrait, text })
const ilya = (text: string): DialogueLine => ({ speaker: ilyaVlasov.persona!.name, speakerRole: ilyaVlasov.persona!.role, portrait: ilyaVlasov.portrait, text })

// --- 1. security-baseline-path ----------------------------------------------

function baselineScene(): StorySceneScript {
  return {
    lines: [
      sonya('Команду разработки мы собрали. Но перед стартом нужно проверить весь офис: компьютеры, доступы, серверы и рабочие файлы.'),
      kirill('Сейчас всё работает. Но часть настроек мы делали быстро, и я не могу обещать, что нигде не осталось лишнего доступа.'),
      alina('Мне тоже нужно понимать, какие данные можно использовать в макетах и тестах.'),
      sonya('Проверку всё равно придётся провести. Есть два пути.'),
      sonya('Заказать формальный аудит сейчас — мы быстро получим список проблем, но заплатим и отвлечёмся на исправления.'),
      sonya('Или сначала нанять специалиста по безопасности. Он останется в команде, но его зарплата станет постоянным расходом.'),
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
        ? [sonya('Тогда не затягиваем с вакансией. Само решение нанять специалиста ещё не означает, что система проверена.')]
        : [sonya('Хорошо. Получим факты до того, как начнём наращивать скорость.')],
  }
}

// --- 2. developer-admin-access ----------------------------------------------

function adminAccessScene(ctx: StorySceneContext): StorySceneScript {
  return {
    lines: [
      kirill('Чтобы не ждать подтверждения на каждую настройку, мне нужен постоянный административный доступ.'),
      sonya('Это ускорит работу. Но один постоянный доступ ко всему выглядит рискованно.'),
      kirill('Согласен. Альтернатива — выдавать права под конкретную задачу. Тогда часть времени уйдёт на запросы и проверку.'),
      ...(ctx.ilyaHired ? [ilya('Если я уже в команде, можно настроить контролируемое повышение прав. Но это тоже отдельная работа.')] : []),
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
      if (choiceId === 'use-just-in-time-access') return [kirill('Это медленнее, но область доступа будет понятной. Заложу время в текущую задачу.')]
      if (choiceId === 'configure-controlled-access') return [ilya('Настрою выдачу прав так, чтобы постоянного административного доступа не осталось.')]
      return [kirill('Понял. Зафиксирую доступ и буду использовать только для проекта.')]
    },
  }
}

// --- 3. frontend-test-data ---------------------------------------------------

function testDataScene(ctx: StorySceneContext): StorySceneScript {
  return {
    lines: [
      alina('Мне нужны реальные примеры сотрудников, комнат и пропусков. На пустых макетах ошибки не видно.'),
      kirill('Можно выгрузить копию текущих данных. Это самый быстрый вариант.'),
      alina('Только там будут имена, почта и история бронирований.'),
      sonya('Нам нужно решить, что важнее сейчас: скорость или безопасная тестовая среда.'),
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
      if (choiceId === 'create-synthetic-data') return [alina('Потеряем день, зато сможем свободно проверять ошибки и крайние случаи.')]
      if (choiceId === 'mask-data-with-security') return [ilya('Подготовлю правила маскирования. В тестовой среде не должно остаться прямых идентификаторов.')]
      return [alina('Хорошо. Тогда после проверки нужно будет отдельно удалить копию.')]
    },
  }
}

// --- 4. security-first-priority ----------------------------------------------

function firstPriorityScene(): StorySceneScript {
  return {
    lines: [
      ilya('Я посмотрел офис и текущие настройки. Закрыть всё одновременно не получится.'),
      sonya('Что требует внимания в первую очередь?'),
      ilya('Рабочие компьютеры почти не контролируются. Центральных журналов недостаточно. И сотрудники пока не знают, как сообщать о подозрительных письмах и посетителях.'),
      ilya('Выберите первый приоритет. Остальное не исчезнет, но этот риск мы начнём снижать сразу.'),
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
        return [ilya('Соберу события в одном месте. Тогда мы хотя бы увидим проблему до того, как она превратится в полноценный инцидент.')]
      if (choiceId === 'prioritize-security-training')
        return [ilya('Хорошо. Начнём с людей. Большинство проблем сначала выглядит как обычная просьба или письмо.')]
      return [ilya('Начну с рабочих станций. Если одна из них будет скомпрометирована, ущерб не должен распространиться дальше.')]
    },
  }
}

// --- 5. backup-and-restore-strategy ------------------------------------------

function backupScene(ctx: StorySceneContext): StorySceneScript {
  return {
    lines: [
      kirill('Резервные копии формально есть. Но мы ни разу не восстанавливали из них проект целиком.'),
      sonyaWorried('То есть копия есть, а вернуть работу после сбоя мы не проверяли?'),
      kirill('Именно. Полная проверка займёт время. Можно ограничиться настройкой расписания или отложить до более спокойного спринта.'),
      ctx.ilyaHired
        ? ilya('Непроверенная копия — это надежда, а не план восстановления.')
        : sonya('Пока восстановление не проверено, наша готовность к сбою — только предположение.'),
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
        return [kirill('Настрою расписание. Но в отчёте честно отмечу: полное восстановление мы не проверяли.')]
      if (choiceId === 'postpone-backup-work')
        return [sonyaWorried('Записываю как осознанный риск. К этому вопросу придётся вернуться до следующего контрольного этапа.')]
      return [kirill('Тогда остановлю свою задачу и подниму отдельную копию проекта с нуля.')]
    },
  }
}

// --- 6. architecture-boundary ------------------------------------------------

function architectureScene(ctx: StorySceneContext): StorySceneScript {
  return {
    lines: [
      kirill('Сейчас авторизация, бронирования и служебные операции используют общую базу и общий технический доступ.'),
      alina('Для интерфейса это удобно: меньше разных ошибок и ожидания.'),
      ctx.ilyaHired
        ? ilya('Но одна неверная настройка даст доступ сразу к нескольким частям системы.')
        : kirill('Но одна неверная настройка даст доступ сразу к нескольким частям системы — это честный минус текущей схемы.'),
      sonya('Если разделить границы сейчас, мы потеряем время до релиза.'),
      kirill('Если оставить как есть, мы быстрее закончим MVP, но переделка потом станет дороже.'),
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
        return [kirill('Разведу доступы по границам. Пару дней потеряем, зато ошибка останется в своей зоне.')]
      if (choiceId === 'request-architecture-review')
        return [sonya('Закажу внешнее техническое review. Получим независимый план без постоянного найма.')]
      return [kirill('Оставляем общую схему. Скорость сохраняем, но фиксирую это как осознанный компромисс.')]
    },
  }
}

// --- 7. suspicious-activity-disclosure ---------------------------------------

function disclosureScene(ctx: StorySceneContext): StorySceneScript {
  return {
    lines: [
      ctx.ilyaHired
        ? ilya('В журналах есть активность, которую я не могу объяснить обычной работой команды.')
        : kirill('В журналах есть активность, которую я не могу объяснить нашей обычной работой.'),
      kirill('Подтверждённого инцидента пока нет. Это может быть старая служебная сессия.'),
      sonyaWorried('Если сообщить руководству сейчас, они потребуют официальную проверку и остановку части работ.'),
      sonyaWorried('Если разбираться тихо, мы сохраним темп, но ответственность будет полностью на нас.'),
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
            ? ilya('Мне нужен один день. Если увижу подтверждение инцидента, сообщаем сразу, без второго обсуждения.')
            : kirill('Мне нужен один день. Если увижу подтверждение инцидента, сообщаем сразу, без второго обсуждения.'),
        ]
      if (choiceId === 'dismiss-as-false-positive')
        return [kirill('Хорошо. Я закрою старые сессии, но оставлю копию журналов на случай повторения.')]
      return [sonya('Я отправлю руководству короткое сообщение без предположений. Только факты и план проверки.')]
    },
  }
}

// --- 8. release-risk-decision ------------------------------------------------

function releaseScene(ctx: StorySceneContext): StorySceneScript {
  return {
    lines: [
      sonya('MVP готов. Но перед отправкой отчёта нужно решить, как мы зафиксируем оставшиеся риски.'),
      kirill('Технически выпуск возможен сегодня.'),
      alina('Пользовательские сценарии работают. Но часть защитных решений мы отложили ради срока.'),
      ctx.ilyaHired
        ? ilya('Можно выпустить с документированными ограничениями. Можно взять ещё время на укрепление. И можно попытаться не поднимать вопрос, но это не уберёт сам риск.')
        : sonya('По нашим наблюдениям, варианта три: выпустить с документированными ограничениями, взять время на укрепление или не поднимать вопрос — но риск от этого не исчезнет.'),
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
        return [sonya('Беру два дня на укрепление. Расходы продолжатся, но в отчёт пойдёт система, за которую не страшно.')]
      if (choiceId === 'hide-open-risk')
        return [sonyaWorried('Понимаю. Отчёт уйдёт без этого пункта. Надеюсь, нам не придётся объяснять это позже.')]
      return [sonya('Готовлю честный перечень ограничений. Руководство увидит и продукт, и его цену.')]
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
