import type { ChoiceOption, DialogueLine } from '../gameStore'
import { femalePm } from '../../character/characters/femalePm'
import { kirillMorozov } from '../../character/characters/kirillMorozov'
import { alinaBelova } from '../../character/characters/alinaBelova'
import { ilyaVlasov } from '../../character/characters/ilyaVlasov'
import type { CyberStoryIncidentId } from './cyberStoryTypes'

// Static dialogue scripts of the three Feature 19 cyber incidents. Text only -
// triggers live in cyberStoryRules, effects in cyberStoryHandlers. Ilya's
// lines and his exclusive third choice (phishing) appear only when he is
// really hired. Choice hints are qualitative trade-offs, never raw numbers.

export interface CyberStorySceneContext {
  ilyaHired: boolean
  // Whether security-first-priority was resolved with the training choice -
  // the team already knows to double-check urgent, no-call requests. Does not
  // remove the risky choice (agency is preserved); it changes the flavour
  // lines and the handler suppresses the risk signal on that path.
  securityTrainingCompleted: boolean
  // Whether security-first-priority was resolved with the central-logging
  // choice - the shadow-it scene's secure-sharing option is then available
  // even without Ilya (§ доступность варианта C).
  centralLoggingChosen: boolean
  // Feature 19B explicit links (cyberStoryLinkedEffects.ts) - dialogue
  // flavour only here; the mechanical effect (if any) is applied in the
  // handler from the same underlying facts.
  hasStrongPhishingDefense: boolean
  hasSecureLogMasking: boolean
}

export interface CyberStorySceneScript {
  lines: DialogueLine[]
  choices: ChoiceOption[]
  reaction: (choiceId: string) => DialogueLine[]
}

type Cue = DialogueLine['cue']
const sonya = (text: string, cue?: Cue): DialogueLine => ({ speaker: femalePm.persona!.name, speakerRole: femalePm.persona!.role, portrait: femalePm.portrait, text, cue })
const sonyaWorried = (text: string, cue?: Cue): DialogueLine => ({
  speaker: femalePm.persona!.name,
  speakerRole: femalePm.persona!.role,
  portrait: femalePm.portraitWorried ?? femalePm.portrait,
  text,
  cue,
})
const kirill = (text: string, cue?: Cue): DialogueLine => ({ speaker: kirillMorozov.persona!.name, speakerRole: kirillMorozov.persona!.role, portrait: kirillMorozov.portrait, text, cue })
const alina = (text: string, cue?: Cue): DialogueLine => ({ speaker: alinaBelova.persona!.name, speakerRole: alinaBelova.persona!.role, portrait: alinaBelova.portrait, text, cue })
const ilya = (text: string, cue?: Cue): DialogueLine => ({ speaker: ilyaVlasov.persona!.name, speakerRole: ilyaVlasov.persona!.role, portrait: ilyaVlasov.portrait, text, cue })

// --- 1. executive-phishing-request -------------------------------------------

function phishingScene(ctx: CyberStorySceneContext): CyberStorySceneScript {
  return {
    lines: [
      sonyaWorried('Мне пришёл срочный запрос от генерального директора. Он просит бюджет проекта и список сотрудников в течение десяти минут.', {
        speakerEmotion: 'concerned',
        listenerReaction: 'concerned-listening',
      }),
      sonyaWorried('В письме отдельно написано не звонить — он якобы на встрече с партнёрами и просит открыть ссылку на «закрытый документ».', {
        speakerEmotion: 'concerned',
        listenerReaction: 'surprised-reaction',
      }),
      kirill('Домен почти совпадает с нашим. Но одна буква другая, и ссылка ведёт на новую страницу входа.', { speakerEmotion: 'focused', listenerReaction: 'focused-listening' }),
      ctx.securityTrainingCompleted
        ? alina('Нас как раз недавно учили проверять такие запросы. Но искушение просто ответить и не терять время всё равно есть.', {
            speakerEmotion: 'focused',
            listenerReaction: 'thinking',
          })
        : alina('Если это настоящий запрос, игнорировать его тоже выглядит плохо.', { speakerEmotion: 'concerned', listenerReaction: 'thinking' }),
      ...(ctx.ilyaHired
        ? [
            ilya('Здесь давят на срочность и запрещают проверить запрос. Это не доказательство атаки, но очень характерная комбинация.', {
              speakerEmotion: 'concerned',
              listenerReaction: 'concerned-listening',
            }),
          ]
        : []),
      sonya('Решение нужно принять сейчас. Что делаем?', { speakerEmotion: 'focused', listenerReaction: 'look-at-speaker' }),
    ],
    choices: [
      { id: 'send-requested-data', label: 'Отправить сведения сразу', hint: 'Не задерживает работу и не требует ресурсов сейчас. Запрос не будет подтверждён независимым каналом.' },
      { id: 'verify-through-known-channel', label: 'Проверить через известный канал', hint: 'Требует времени Сони. Подтверждает или разоблачает запрос независимо от письма.' },
      ...(ctx.ilyaHired
        ? [
            {
              id: 'escalate-phishing-to-security',
              label: 'Передать Илье и заблокировать кампанию',
              hint: 'Блокирует домен и разбирает письмо с командой. Потребует времени специалиста и расходов на защиту почты.',
            },
          ]
        : []),
    ],
    reaction: (choiceId) => {
      if (choiceId === 'verify-through-known-channel') {
        return [sonya('Позвоню напрямую по номеру из справочника, а не по контакту из письма.', { speakerEmotion: 'confident', listenerReaction: 'nod' })]
      }
      if (choiceId === 'escalate-phishing-to-security') {
        return [ilya('Заблокирую домен и разберу письмо с командой, чтобы похожая попытка не сработала снова.', { speakerEmotion: 'confident', listenerReaction: 'nod' })]
      }
      return [kirill('Отправляю данные. Подтверждения по независимому каналу не будет.', { speakerEmotion: 'concerned', listenerReaction: 'thinking' })]
    },
  }
}

// --- 2. supply-chain-update ----------------------------------------------------

function supplyChainScene(ctx: CyberStorySceneContext): CyberStorySceneScript {
  return {
    lines: [
      kirill('Вышло обновление библиотеки авторизации. Оно исправляет сбой, который иногда выбрасывает пользователя из сессии.', {
        speakerEmotion: 'focused',
        listenerReaction: 'focused-listening',
      }),
      alina('На демонстрации этот сбой будет очень заметен. Если вход развалится, остальной интерфейс никто не увидит.', {
        speakerEmotion: 'concerned',
        listenerReaction: 'concerned-listening',
      }),
      kirill('Но версия опубликована недавно, а у пакета недавно сменился владелец. Changelog короткий.', { speakerEmotion: 'concerned', listenerReaction: 'thinking' }),
      ...(ctx.ilyaHired
        ? [ilya('И новая версия запрашивает больше разрешений, чем предыдущая. Это не обязательно атака, но проверить стоит.', { speakerEmotion: 'focused', listenerReaction: 'focused-listening' })]
        : []),
      sonya('До демонстрации мало времени. Мы либо принимаем риск обновления, либо риск заметного сбоя перед руководством.', {
        speakerEmotion: 'focused',
        listenerReaction: 'look-at-speaker',
      }),
    ],
    choices: [
      { id: 'install-update-immediately', label: 'Обновить немедленно', hint: 'Устраняет заметную ошибку без задержки. Код новой версии не будет полноценно проверен.' },
      { id: 'keep-current-version', label: 'Оставить текущую версию', hint: 'Не добавляет непроверенный сторонний код. Известная ошибка авторизации останется к демонстрации.' },
      {
        id: 'review-and-pin-dependency',
        label: 'Проверить код и зафиксировать зависимость',
        hint: 'Проверяет происхождение изменений и фиксирует точную версию. Потребует времени backend-разработчика и расходов на проверку.',
      },
    ],
    reaction: (choiceId) => {
      if (choiceId === 'keep-current-version') {
        return [sonya('Фиксирую как технический долг — обновимся уже после демонстрации.', { speakerEmotion: 'neutral', listenerReaction: 'thinking' })]
      }
      if (choiceId === 'review-and-pin-dependency') {
        return [kirill('Проверю происхождение изменений и зафиксирую точную версию в lockfile.', { speakerEmotion: 'focused', listenerReaction: 'nod' })]
      }
      return [kirill('Ставлю обновление сейчас. Полноценного review кода не будет.', { speakerEmotion: 'concerned', listenerReaction: 'thinking' })]
    },
  }
}

// --- 3. shadow-it-log-upload -----------------------------------------------

function shadowItScene(ctx: CyberStorySceneContext): CyberStorySceneScript {
  const secureSharingAvailable = ctx.ilyaHired || ctx.centralLoggingChosen
  return {
    lines: [
      alina('Пользователь второй раз прислал ту же ошибку. Без реальных логов я не вижу, где ломается форма.', { speakerEmotion: 'concerned', listenerReaction: 'concerned-listening' }),
      kirill('Архив слишком большой для рабочего чата. Я могу загрузить его в своё облако и удалить через час.', { speakerEmotion: 'neutral', listenerReaction: 'thinking' }),
      alina('Внутри есть имена, почта и история запросов. Но без этого мы потеряем ещё один день.', { speakerEmotion: 'concerned', listenerReaction: 'concerned-listening' }),
      sonya('Личная ссылка быстро решит проблему. Но после загрузки мы уже не контролируем копии.', { speakerEmotion: 'concerned', listenerReaction: 'thinking' }),
      ...(ctx.ilyaHired
        ? [ilya('Сначала нужно убрать персональные данные и токены. Удаление ссылки потом не удаляет уже скачанные копии.', { speakerEmotion: 'focused', listenerReaction: 'focused-listening' })]
        : []),
    ],
    choices: [
      {
        id: 'upload-raw-logs-to-personal-cloud',
        label: 'Загрузить необработанные логи',
        hint: 'Позволяет быстро воспроизвести ошибку. Логи покинут контролируемую рабочую среду без очистки.',
      },
      { id: 'sanitize-logs-manually', label: 'Очистить логи вручную', hint: 'Снижает объём чувствительных данных. Потребует времени команды и не гарантирует идеальную очистку.' },
      ...(secureSharingAvailable
        ? [
            {
              id: 'configure-secure-log-sharing',
              label: 'Настроить защищённую передачу и маскирование',
              hint: 'Создаёт повторяемый безопасный процесс для следующих расследований. Потребует расходов и времени технических сотрудников.',
            },
          ]
        : []),
    ],
    reaction: (choiceId) => {
      if (choiceId === 'sanitize-logs-manually') {
        return [kirill('Уберу имена, почту и токены вручную перед тем, как передавать архив дальше.', { speakerEmotion: 'focused', listenerReaction: 'nod' })]
      }
      if (choiceId === 'configure-secure-log-sharing') {
        return [kirill('Настрою повторяемый канал передачи с автоматическим маскированием — пригодится и в следующий раз.', { speakerEmotion: 'confident', listenerReaction: 'nod' })]
      }
      return [alina('Загружаю архив в личное облако. Уберём его через час.', { speakerEmotion: 'concerned', listenerReaction: 'thinking' })]
    },
  }
}

// --- 4. secret-committed-to-repository ---------------------------------------

function secretScene(ctx: CyberStorySceneContext): CyberStorySceneScript {
  return {
    lines: [
      kirill('Интеграция снова работает. Я временно добавил ключ в конфиг, а потом удалил его новым коммитом.', {
        speakerEmotion: 'confident',
        listenerReaction: 'focused-listening',
      }),
      sonya('Сейчас ключа в файле уже нет?', { speakerEmotion: 'neutral', listenerReaction: 'look-at-speaker' }),
      kirill('В актуальной версии — нет. Репозиторий закрытый, доступ есть только у команды и сборки.', { speakerEmotion: 'neutral', listenerReaction: 'thinking' }),
      alina('Но старые версии файла всё ещё можно открыть через историю.', { speakerEmotion: 'concerned', listenerReaction: 'concerned-listening' }),
      ...(ctx.ilyaHired
        ? [
            ilya('Даже если переписать историю, ключ уже нужно считать раскрытым. Его могли сохранить сборка, кэш, fork или локальная копия.', {
              speakerEmotion: 'concerned',
              listenerReaction: 'concerned-listening',
            }),
          ]
        : []),
      kirill('Если менять ключ и переподключать всё сейчас, интеграция остановится перед демонстрацией.', { speakerEmotion: 'concerned', listenerReaction: 'thinking' }),
      sonya('Тогда выбираем: быстро убрать следы или считать ключ скомпрометированным.', { speakerEmotion: 'focused', listenerReaction: 'look-at-speaker' }),
    ],
    choices: [
      { id: 'remove-secret-in-new-commit', label: 'Удалить ключ новым коммитом', hint: 'Нет задержки, интеграция продолжает работать. Ключ всё ещё доступен через историю репозитория.' },
      {
        id: 'rewrite-repository-history',
        label: 'Переписать историю репозитория',
        hint: 'Кирилл и Алина теряют по рабочему дню. Ключ пропадает из доступной истории, но мог остаться в fork/кэше/локальной копии.',
      },
      {
        id: 'rotate-and-secure-secret',
        label: 'Отозвать ключ и настроить secrets management',
        hint: 'Требует денег и времени на переподключение. Старый ключ действительно отзывается, добавляется secret scanning.',
      },
    ],
    reaction: (choiceId) => {
      if (choiceId === 'rewrite-repository-history') {
        return [kirill('Перепишу историю и попрошу всех пересинхронизировать ветки.', { speakerEmotion: 'focused', listenerReaction: 'nod' })]
      }
      if (choiceId === 'rotate-and-secure-secret') {
        return [kirill('Отзываю ключ и переношу секрет в защищённое хранилище. Интеграция побудет недоступной, пока не переподключу.', { speakerEmotion: 'confident', listenerReaction: 'nod' })]
      }
      return [kirill('Ключа в актуальном файле больше нет. Едем дальше.', { speakerEmotion: 'confident', listenerReaction: 'nod' })]
    },
  }
}

// --- 5. mfa-fatigue-attack -----------------------------------------------------

function mfaFatigueScene(ctx: CyberStorySceneContext): CyberStorySceneScript {
  return {
    lines: [
      kirill('Телефон всю ночь просил подтвердить вход. Я несколько раз нажал «Отклонить».', { speakerEmotion: 'concerned', listenerReaction: 'concerned-listening' }),
      sonya('Несколько раз — это сколько?', { speakerEmotion: 'neutral', listenerReaction: 'look-at-speaker' }),
      kirill('Не знаю. Уведомления шли одно за другим. Кажется, один раз я мог нажать не туда.', { speakerEmotion: 'concerned', listenerReaction: 'thinking' }),
      alina('Но ты сейчас нормально вошёл в систему?', { speakerEmotion: 'concerned', listenerReaction: 'concerned-listening' }),
      ctx.hasStrongPhishingDefense
        ? kirill('Да. Хорошо, что после истории с фишингом мы уже понимаем, как это выглядит.', { speakerEmotion: 'focused', listenerReaction: 'thinking' })
        : kirill('Да. Я уже сменил пароль в голове раз пять, но пока ничего не трогал.', { speakerEmotion: 'neutral', listenerReaction: 'thinking' }),
      ...(ctx.ilyaHired
        ? [ilya('Если кто-то получил активную сессию, одной смены пароля может быть недостаточно.', { speakerEmotion: 'concerned', listenerReaction: 'concerned-listening' })]
        : []),
      sonya('На аккаунте уже видна новая сессия с неизвестного устройства. Решаем сейчас.', { speakerEmotion: 'focused', listenerReaction: 'look-at-speaker' }),
    ],
    choices: [
      { id: 'change-password-only', label: 'Только сменить пароль', hint: 'Минимальная потеря времени. Активная неизвестная сессия не отзывается.' },
      {
        id: 'revoke-sessions-and-investigate',
        label: 'Завершить все сессии и расследовать',
        hint: 'Кирилл занят день, часть команды временно выходит из систем. Область доступа определяется точно.',
      },
      {
        id: 'enable-phishing-resistant-auth',
        label: 'Внедрить устойчивую аутентификацию',
        hint: 'Требует денег и нескольких дней настройки. Текущая сессия отзывается, push fatigue перестаёт работать тем же способом.',
      },
    ],
    reaction: (choiceId) => {
      if (choiceId === 'revoke-sessions-and-investigate') {
        return [kirill('Отзываю все сессии и проверяю, что успело измениться.', { speakerEmotion: 'focused', listenerReaction: 'nod' })]
      }
      if (choiceId === 'enable-phishing-resistant-auth') {
        return [kirill('Настраиваю вход через ключи вместо push-уведомлений. Займёт несколько дней.', { speakerEmotion: 'confident', listenerReaction: 'nod' })]
      }
      return [kirill('Меняю пароль. Про ту сессию пока ничего не делаю.', { speakerEmotion: 'concerned', listenerReaction: 'thinking' })]
    },
  }
}

// --- 6. external-ai-data-disclosure ------------------------------------------

function externalAiScene(ctx: CyberStorySceneContext): CyberStorySceneScript {
  return {
    lines: [
      alina('Я нашла ошибку. Отправила компонент ИИ-помощнику, и он сразу показал проблему со state.', { speakerEmotion: 'confident', listenerReaction: 'focused-listening' }),
      kirill('Отлично. Мы бы ещё полдня это разбирали.', { speakerEmotion: 'confident', listenerReaction: 'nod' }),
      ...(ctx.ilyaHired ? [ilya('Это личный аккаунт или корпоративный?', { speakerEmotion: 'neutral', listenerReaction: 'look-at-speaker' })] : []),
      ctx.hasSecureLogMasking
        ? alina('Личный — в рабочем инструменте лимит маленький. Отправила компонент и часть логов, но чувствительные поля у нас теперь маскируются автоматически.', {
            speakerEmotion: 'focused',
            listenerReaction: 'thinking',
          })
        : alina('Личный. В рабочем инструменте слишком маленький лимит. Я отправила только нужный компонент и часть логов.', { speakerEmotion: 'concerned', listenerReaction: 'thinking' }),
      ...(ctx.ilyaHired
        ? [ilya('В этих логах есть session ids, а в компоненте — внутренние адреса.', { speakerEmotion: 'concerned', listenerReaction: 'concerned-listening' })]
        : []),
      ...(ctx.securityTrainingCompleted
        ? [sonya('Мы это уже разбирали на обучении — вопрос не в принципе, а в конкретном инструменте и правилах.', { speakerEmotion: 'focused', listenerReaction: 'thinking' })]
        : []),
      sonya('Ошибка исправлена, но теперь нужен общий порядок. Полностью запрещаем такие инструменты или делаем безопасный способ?', {
        speakerEmotion: 'focused',
        listenerReaction: 'look-at-speaker',
      }),
    ],
    choices: [
      {
        id: 'allow-unrestricted-ai-tools',
        label: 'Разрешить без ограничений',
        hint: 'Следующие задачи получают небольшое ускорение. Sensitive-data и governance риск растут.',
      },
      {
        id: 'ban-external-ai-tools',
        label: 'Полностью запретить',
        hint: 'Неконтролируемая передача прекращается. Следующие задачи требуют больше времени, команда теряет удобный инструмент.',
      },
      {
        id: 'configure-controlled-ai-gateway',
        label: 'Настроить контролируемый AI gateway',
        hint: 'Требует денег и времени на настройку. Секреты и персональные данные маскируются, доступны только утверждённые модели.',
      },
    ],
    reaction: (choiceId) => {
      if (choiceId === 'ban-external-ai-tools') {
        return [sonya('Отправляю команде запрет. Ищем рабочую альтернативу, чтобы это не ушло в тень.', { speakerEmotion: 'focused', listenerReaction: 'nod' })]
      }
      if (choiceId === 'configure-controlled-ai-gateway') {
        return [kirill('Настрою gateway с масштабированием доступа и маскированием — удобство останется, но под контролем.', { speakerEmotion: 'confident', listenerReaction: 'nod' })]
      }
      return [alina('Продолжаю пользоваться инструментом как раньше — он правда экономит время.', { speakerEmotion: 'confident', listenerReaction: 'nod' })]
    },
  }
}

export function buildCyberStorySceneScript(id: CyberStoryIncidentId, ctx: CyberStorySceneContext): CyberStorySceneScript {
  switch (id) {
    case 'executive-phishing-request':
      return phishingScene(ctx)
    case 'supply-chain-update':
      return supplyChainScene(ctx)
    case 'shadow-it-log-upload':
      return shadowItScene(ctx)
    case 'secret-committed-to-repository':
      return secretScene(ctx)
    case 'mfa-fatigue-attack':
      return mfaFatigueScene(ctx)
    case 'external-ai-data-disclosure':
      return externalAiScene(ctx)
  }
}
