# Feature 19 — три сюжетных киберинцидента и dev-launcher сцен

## Как использовать этот файл

Передай Claude Code:

- `CLAUDE.md`;
- `AGENTS.md`;
- `docs/claude/00-fixed-game-rules.md`;
- `docs/claude/00-implementation-workflow.md`;
- актуальные документы из `docs/qa/` и `docs/art/`;
- этот файл как единственную текущую feature-итерацию.

Feature 01–18H считаются реализованными и принятыми.

Feature 19 добавляет три новых сюжетных киберинцидента по разным аспектам безопасности и отдельный dev-only способ запускать их вручную для проверки.

Эта итерация не добавляет новые физические проникновения и не дублирует существующую сцену `office-intrusion`.

---

# Главная цель

Разговоры с коллегами и принятие решений остаются основной механикой игры.

Новые сцены должны:

- быть интересными как сюжет;
- объяснять безопасность через реальные рабочие ситуации;
- давать несколько разумных вариантов;
- не иметь одной бесплатной очевидно правильной кнопки;
- давать немедленную выгоду или цену;
- создавать отложенные последствия;
- менять будущие реплики и инциденты;
- использовать существующие story, risk, economy, Workday Flow и cinematic systems;
- содержать короткие сюжетные видеовставки через фактически подключённый Higgsfield;
- не заменять интерактивный выбор заранее отрендеренным видео.

Добавить три сцены:

1. `executive-phishing-request` — фишинг и социальная инженерия;
2. `supply-chain-update` — компрометация зависимости;
3. `shadow-it-log-upload` — секреты в логах и личное облако.

---

# Общие правила новых сцен

Каждая сцена должна иметь:

- стабильный scene id;
- детерминированный trigger;
- story objective;
- отдельный сюжетный marker;
- фиксированный статический диалог;
- 2–3 варианта решения;
- qualitative consequences без raw risk score;
- typed handler;
- idempotent operation id;
- сохранение;
- migration;
- reset;
- immediate reaction;
- минимум одно отложенное последствие;
- cinematic shot list;
- безопасный fallback без Higgsfield;
- unit, integration и E2E-тесты.

DeepSeek не генерирует:

- обязательные реплики;
- варианты выбора;
- условия trigger;
- последствия;
- суммы;
- risk impacts.

DeepSeek может использоваться только после завершения сцены для необязательного разговора с участником.

---

# Интеграция с текущими системами

Использовать существующие:

- Story Decision Core Feature 17;
- Workday Flow Feature 16;
- risk domains Feature 09;
- economy ledger Feature 02;
- server/auth/database consequences Feature 11;
- Cinematic Director Feature 18D;
- character animation system Feature 18C;
- scene production rules Feature 18F;
- group scene synchronization Feature 18H.

Не создавать вторую параллельную систему диалогов, событий, денег или рисков.

## Приоритет событий

Сохранить общий порядок:

```text
daily report
→ follow-up audit
→ office intrusion
→ server incidents
→ Feature 17 consequences
→ Feature 19 story incident
→ sprint review
→ outcome
→ следующий Workday Flow
```

Если текущий coordinator уже использует другой принятый порядок для story decisions, адаптировать Feature 19 к нему без появления двух blocking scenes одновременно.

---

# Новые story ids и choices

Рекомендуемые ids:

```ts
export type CyberStoryIncidentId =
  | "executive-phishing-request"
  | "supply-chain-update"
  | "shadow-it-log-upload";

export type CyberStoryChoiceId =
  | "send-requested-data"
  | "verify-through-known-channel"
  | "escalate-phishing-to-security"
  | "install-update-immediately"
  | "keep-current-version"
  | "review-and-pin-dependency"
  | "upload-raw-logs-to-personal-cloud"
  | "sanitize-logs-manually"
  | "configure-secure-log-sharing";
```

Можно адаптировать названия к существующему стилю проекта, но scene ids должны оставаться стабильными и использоваться в `scenes.md`.

---

# Balance config

Все суммы, сроки, effort и modifiers добавить в существующие файлы `src/game/balance/`.

Не хранить числа в React-компонентах и dialogue catalog.

Рекомендуемый раздел:

```ts
export const CYBER_STORY_BALANCE = {
  executivePhishing: {
    verificationEffortDays: 1,
    securityEscalationCostRub: 40_000,
    securityEscalationEffortDays: 1,
    futureAuthIncidentExtraCostRub: 70_000,
  },
  supplyChainUpdate: {
    immediateUpdateDelayDays: 0,
    keepVersionProductPenalty: 1,
    reviewCostRub: 60_000,
    reviewEffortDays: 2,
    compromisedUpdateFutureCostRub: 120_000,
  },
  shadowItLogs: {
    manualSanitizationEffortDays: 1,
    secureSharingCostRub: 80_000,
    secureSharingKirillEffortDays: 1,
    secureSharingIlyaEffortDays: 1,
    futureContainmentCostRub: 150_000,
  },
} as const;
```

Перед изменением значений Claude должен проверить существующий balance simulator и не разрушить достижимость побед и поражений.

---

# Сцена 1 — «Срочное письмо от генерального директора»

## Scene id

```text
executive-phishing-request
```

## Аспект безопасности

- phishing;
- social engineering;
- impersonation;
- проверка срочных запросов другим каналом;
- целевой сбор информации о компании.

## Trigger

Сцена доступна, когда:

- Соня присутствует;
- Кирилл и Алина наняты;
- первый спринт уже начат;
- `executive-phishing-request` ещё не resolved;
- нет другого blocking story/event;
- текущий день не является первым kickoff;
- игрок ранее ещё не завершил полноценное security training, которое должно полностью предотвращать сцену.

Если security training выполнен, сцена всё равно может произойти как короткая положительная проверка, но не должна создавать риск при правильном автоматическом распознавании. Не пропускать весь сюжет молча.

## Завязка

Соне приходит письмо от человека, выдающего себя за генерального директора.

Письмо требует:

- срочно отправить бюджет проекта;
- список сотрудников и ролей;
- не звонить, потому что отправитель якобы находится на встрече;
- открыть ссылку на «закрытый документ».

Адрес отправителя отличается от настоящего одним символом.

## Основной диалог

Использовать живой диалог примерно такого содержания, адаптировав формулировки к текущему стилю персонажей:

```text
Соня:
Мне пришёл срочный запрос от генерального директора.
Он просит бюджет и список команды в течение десяти минут.

Соня:
В письме отдельно написано не звонить —
он якобы на встрече с партнёрами.

Кирилл:
Домен почти совпадает с нашим.
Но одна буква другая, и ссылка ведёт на новую страницу входа.

Алина:
Если это настоящий запрос,
игнорировать его тоже выглядит плохо.

Илья, если нанят:
Здесь давят на срочность и запрещают проверить запрос.
Это не доказательство атаки, но очень характерная комбинация.

Соня:
Решение нужно принять сейчас.
Что делаем?
```

## Choices

### Вариант A — отправить информацию сразу

Choice id:

```text
send-requested-data
```

Подсказка игроку:

```text
Не задерживает работу и не требует дополнительных ресурсов.
Но запрос не будет подтверждён независимым каналом.
```

Immediate effects:

- нет текущего расхода;
- нет текущей задержки;
- создать однократный risk signal для `governance`;
- создать однократный risk signal для `identity-access`;
- сохранить `phishingInformationExposed = true`;
- daily report объясняет, что сведения были отправлены без проверки.

Delayed consequences:

- через 2–4 завершённых workdays Кирилл получает персонализированное письмо;
- если риск identity-access высокий, будущий AUTH incident получает extra cost из balance;
- если централизованные журналы не настроены, обнаружение происходит позже;
- будущий диалог Ильи упоминает, что атакующий уже знал структуру команды.

Сцена не должна немедленно гарантировать взлом. Это усилитель будущего риска.

### Вариант B — проверить запрос известным каналом

Choice id:

```text
verify-through-known-channel
```

Подсказка:

```text
Требует времени Сони, но подтверждает запрос независимо от письма.
```

Immediate effects:

- Соня занята на 1 workday или эквивалент текущей effort-модели;
- запрос разоблачён;
- governance mitigation;
- identity-access mitigation;
- сохранить `phishingVerifiedAndRejected = true`;
- короткая реакция команды.

Delayed consequences:

- следующая социальная инженерия имеет более слабый эффект;
- в будущем dialogue Соня сама напоминает о проверке через известный канал.

### Вариант C — передать Илье и заблокировать кампанию

Choice id:

```text
escalate-phishing-to-security
```

Доступен только при реальном hire record Ильи.

Подсказка:

```text
Позволяет заблокировать домен и разобрать письмо с командой.
Потребует времени специалиста и расходов на защиту почты.
```

Immediate effects:

- расход из balance;
- Илья занят 1 workday;
- домен и URL добавлены в security state;
- governance mitigation;
- identity-access mitigation сильнее варианта B;
- создать follow-up task короткого phishing briefing.

Delayed consequences:

- персонализированное письмо Кириллу либо не возникает, либо автоматически блокируется;
- future AUTH modifier отсутствует;
- команда получает изменённые ambient реплики.

## Higgsfield-вставка

Подготовить короткую вставку 4–8 секунд:

1. крупный план уведомления почты;
2. адрес отправителя, где одна буква выглядит подозрительно;
3. строка `Срочно`;
4. Соня смотрит на экран и сомневается;
5. курсор останавливается над ссылкой;
6. возврат в интерактивную 3D-сцену до выбора.

Требования:

- не показывать реальные домены, пароли и API-ключи;
- не показывать выбор внутри видео;
- персонаж должен соответствовать approved identity;
- одежда и офис должны совпадать с игрой;
- при отсутствии generated video использовать внутриигровой insert shot экрана и реакцию Сони.

---

# Сцена 2 — «Обновление перед демонстрацией»

## Scene id

```text
supply-chain-update
```

## Аспект безопасности

- software supply chain;
- зависимости;
- смена владельца пакета;
- дополнительные разрешения;
- lockfile и pinning;
- риск обновления перед релизом.

## Trigger

Сцена доступна, когда:

- Кирилл нанят;
- завершено минимум 3 product tasks;
- впереди review, demo или важная контрольная точка в пределах 1–2 workdays;
- существует активная auth-related product task либо AUTH feature уже реализована;
- решение ещё не принято;
- нет blocking incident.

## Завязка

За день до демонстрации выходит новая версия библиотеки авторизации.

Она обещает исправить заметный UX-баг, но:

- опубликована недавно;
- владелец пакета сменился;
- changelog слишком короткий;
- пакет запрашивает дополнительные разрешения;
- команда не успевает одновременно полноценно проверить пакет и сохранить текущий темп.

## Основной диалог

```text
Кирилл:
Вышло обновление библиотеки авторизации.
Оно исправляет сбой, который иногда выбрасывает пользователя.

Алина:
На демонстрации этот сбой будет очень заметен.
Если вход развалится, остальной интерфейс никто не увидит.

Кирилл:
Но версия опубликована недавно,
а у пакета сменился владелец.

Илья, если нанят:
И новая версия запрашивает больше разрешений,
чем предыдущая.
Это не обязательно атака, но проверить нужно.

Соня:
До демонстрации мало времени.
Мы либо принимаем риск обновления,
либо риск сбоя перед руководством.
```

## Choices

### Вариант A — обновить немедленно

Choice id:

```text
install-update-immediately
```

Подсказка:

```text
Устраняет заметную ошибку без задержки.
Код новой версии не будет полноценно проверен.
```

Immediate effects:

- auth UX problem считается исправленной;
- нет product delay;
- создать `supplyChainUpdateInstalled = true`;
- создать скрытый risk signal для `service-continuity`;
- создать скрытый risk signal для `sensitive-data`;
- demo quality не получает penalty.

Delayed consequences:

- через 1–3 workdays появляется неизвестное внешнее соединение;
- если central logging есть, Илья обнаруживает его раньше;
- если central logging нет, инцидент обнаруживается после дополнительного ущерба;
- возможно раскрытие тестового token, но не реального API-key проекта;
- будущий server/AUTH incident получает дополнительную стоимость из balance;
- daily report и последующий dialogue связывают проблему с решением обновиться без проверки.

### Вариант B — оставить текущую версию

Choice id:

```text
keep-current-version
```

Подсказка:

```text
Не добавляет непроверенный сторонний код.
Но известная ошибка авторизации останется к демонстрации.
```

Immediate effects:

- supply-chain risk не увеличивается;
- demo quality или release score получает небольшой penalty;
- Соня фиксирует технический долг;
- создать task обновления после демонстрации.

Delayed consequences:

- на demo может сработать управляемая нефатальная проблема авторизации;
- игрок получает неудобную, но не катастрофическую сцену;
- если задача обновления позднее закрыта через review, penalty снимается частично.

### Вариант C — проверить код и зафиксировать зависимость

Choice id:

```text
review-and-pin-dependency
```

Подсказка:

```text
Проверяет происхождение изменений и фиксирует точную версию.
Потребует времени backend-разработчика и расходов на проверку.
```

Immediate effects:

- расход из balance;
- Кирилл занят на 2 workdays либо по текущей work-модели;
- продуктовый progress Кирилла на это время остановлен;
- lockfile/dependency policy state обновлён;
- вредоносное изменение обнаружено;
- создать mitigation для `service-continuity` и `sensitive-data`.

Delayed consequences:

- неизвестное соединение не возникает;
- следующие dependency choices становятся дешевле или быстрее;
- будущий dialogue Кирилла упоминает правило проверки новых владельцев пакетов.

## Higgsfield-вставка

Короткая вставка 5–9 секунд:

1. тёмный монитор разработчика перед демонстрацией;
2. notification о новой версии;
3. changelog и смена владельца;
4. дополнительные разрешения;
5. строки terminal install;
6. едва заметный неизвестный network request;
7. возврат в игру до выбора либо, для рискованного последствия, отдельная поздняя вставка.

Разделить:

- pre-choice вставку без подтверждения атаки;
- delayed consequence вставку только если выбран немедленный update.

Не показывать реальные команды эксплуатации, реальные токены или секреты.

---

# Сцена 3 — «Логи в личном облаке»

## Scene id

```text
shadow-it-log-upload
```

## Аспект безопасности

- Shadow IT;
- личные облачные сервисы;
- секреты и персональные данные в логах;
- неконтролируемые ссылки;
- безопасное журналирование и маскирование.

## Trigger

Сцена доступна, когда:

- Кирилл и Алина наняты;
- существует frontend bug или support-style проблема;
- есть рабочие логи;
- решение `frontend-test-data` уже принято либо соответствующий контекст существует;
- `shadow-it-log-upload` ещё не resolved;
- нет blocking incident.

## Завязка

Алина не может воспроизвести ошибку пользователя.

Кирилл выгрузил большой архив логов, но:

- файл не помещается в рабочий чат;
- официального защищённого канала пока нет;
- в логах есть имена, email, session ids, internal URLs;
- возможно присутствует фрагмент тестового token;
- личное облако позволит решить проблему быстро.

## Основной диалог

```text
Алина:
Пользователь второй раз прислал ту же ошибку.
Без реальных логов я не вижу, где ломается форма.

Кирилл:
Архив слишком большой для рабочего чата.
Я могу загрузить его в своё облако и удалить через час.

Алина:
Внутри есть имена, почта и история запросов.
Но без этого мы потеряем ещё один день.

Соня:
Личная ссылка быстро решит проблему.
Но после загрузки мы уже не контролируем копии.

Илья, если нанят:
Сначала нужно убрать персональные данные и токены.
Удаление ссылки потом не удаляет все скачанные копии.
```

## Choices

### Вариант A — загрузить необработанные логи

Choice id:

```text
upload-raw-logs-to-personal-cloud
```

Подсказка:

```text
Позволяет быстро воспроизвести ошибку.
Логи покинут контролируемую рабочую среду без очистки.
```

Immediate effects:

- frontend bug получает быстрый progress или закрывается;
- нет текущей задержки;
- создать risk signal для `sensitive-data`;
- создать risk signal для `governance`;
- сохранить `rawLogsExternallyShared = true`.

Delayed consequences:

- через 2–4 workdays появляется ночное скачивание либо повторная пересылка ссылки;
- требуется отзыв тестовых session/token values;
- будущий audit находит Shadow IT;
- возможна complaint;
- containment cost из balance;
- если ранее выбраны реальные production data, последствия усиливаются;
- если central logging отсутствует, список затронутых данных неполон.

### Вариант B — очистить логи вручную

Choice id:

```text
sanitize-logs-manually
```

Подсказка:

```text
Снижает объём чувствительных данных.
Потребует времени команды и не гарантирует идеальную очистку.
```

Immediate effects:

- Кирилл или Алина заняты на 1 workday;
- bug investigation задерживается;
- sensitive-data mitigation;
- сохранить `logsManuallySanitized = true`;
- небольшой остаточный риск остаётся.

Delayed consequences:

- serious leak не возникает;
- audit может оставить medium finding о ручном процессе;
- позднее secure-sharing task стоит дешевле.

### Вариант C — настроить защищённую передачу и автоматическое маскирование

Choice id:

```text
configure-secure-log-sharing
```

Доступность:

- если Илья нанят;
- либо если ранее выбран приоритет central logging и текущая архитектура допускает этот путь.

Подсказка:

```text
Создаёт повторяемый безопасный процесс для следующих расследований.
Потребует расходов и времени технических сотрудников.
```

Immediate effects:

- расход из balance;
- Кирилл занят 1 workday;
- Илья занят 1 workday, если участвует;
- создать secure log channel state;
- маскирование email, session ids и token-like values;
- sensitive-data mitigation;
- governance mitigation.

Delayed consequences:

- следующие support/debug incidents расследуются быстрее;
- Shadow IT finding не создаётся;
- future containment cost снижается;
- dialogue Алины упоминает, что безопасный процесс одновременно ускорил работу.

## Higgsfield-вставка

Pre-choice вставка 4–8 секунд:

1. большой архив логов;
2. окно личного облака;
3. в строках мелькают email и session ids;
4. появляется публичная ссылка;
5. курсор зависает над `Скопировать ссылку`;
6. возврат к выбору.

Delayed consequence для рискованного выбора:

1. ссылка открывается ночью;
2. появляется второе неизвестное скачивание;
3. утреннее уведомление;
4. переход к 3D-диалогу команды.

Не показывать реальные персональные данные и реальные секреты.

---

# Сюжетные видеовставки через Higgsfield

## Общие требования

Claude должен сначала изучить фактически подключённые Higgsfield tools.

Использовать Higgsfield можно для:

- storyboard;
- approved keyframes;
- cinematic inserts;
- reaction references;
- screen close-ups;
- transitions;
- delayed consequence clips.

Generated video не должно:

- содержать выбор игрока;
- применять игровую математику;
- заменять обязательный 3D-диалог;
- менять лицо или одежду персонажа;
- показывать физическое проникновение для этих трёх сцен;
- показывать реальные ключи, токены или личные данные;
- содержать несогласованную музыку, если звук управляется игрой.

## Production paths

Для каждой сцены создать:

```text
docs/art/cinematics/{scene-id}/
  scene-brief.md
  shot-list.md
  higgsfield-prompts.md
  storyboard/
  approved-keyframes/
  implementation-notes.md
  acceptance.md
```

Production asset должен пройти текущий asset approval workflow Feature 18A.

У каждой сцены должен быть fallback:

- внутриигровой screen insert;
- крупный план персонажа;
- существующие animation clips;
- subtitle и camera sequence.

Отсутствие Higgsfield API, quota или generated asset не должно блокировать прохождение игры.

---

# Отложенные последствия

Добавить consequence hooks, а не применять все последствия в момент выбора.

Рекомендуемые consequence ids:

```text
phishing-targeted-followup
supply-chain-unknown-connection
shadow-it-external-download
```

Каждый hook:

- создаётся один раз;
- имеет due workday index;
- сохраняется;
- не запускается одновременно с более приоритетной сценой;
- после reload `running` нормализуется в `pending`;
- применяет effects один раз;
- меняет будущий dialogue;
- может быть предотвращён или смягчён правильным состоянием.

Не каждая risky choice должна гарантировать game over.

Это управляемые усилители существующих рисков и инцидентов.

---

# Обязательный файл `scenes.md`

Claude Code должен создать в корне проекта:

```text
scenes.md
```

Это dev-документ для ручного запуска сцен.

## Что должно быть внутри

Для каждой сцены:

1. scene id;
2. краткое описание;
3. необходимые участники;
4. prerequisites;
5. команда подготовки состояния;
6. команда запуска;
7. команда запуска конкретного choice, если поддерживается;
8. команда delayed consequence;
9. команда сброса сцены;
10. ожидаемый результат;
11. что проверить вручную;
12. известные ограничения.

Обязательные сцены в `scenes.md`:

```text
executive-phishing-request
supply-chain-update
shadow-it-log-upload
office-intrusion
```

## Dev-only launcher

Сначала найти существующий convention проекта:

- dev console API;
- debug panel;
- fixture runner;
- URL scenario parameters;
- Playwright helpers;
- npm scripts.

Если стабильного launcher нет, создать dev-only API, например:

```ts
window.__startupGameDev.scenes.list();
window.__startupGameDev.scenes.prepare("executive-phishing-request");
window.__startupGameDev.scenes.play("executive-phishing-request");
window.__startupGameDev.scenes.resolve(
  "executive-phishing-request",
  "verify-through-known-channel",
);
window.__startupGameDev.scenes.playConsequence("phishing-targeted-followup");
window.__startupGameDev.scenes.reset("executive-phishing-request");
```

Это только рекомендуемый интерфейс.

Claude должен использовать стиль актуального проекта и записать в `scenes.md` **реально работающие точные команды**, а не псевдокод.

## Требования launcher

Launcher должен:

- существовать только в development/test build;
- отсутствовать в production bundle;
- не обходить production handlers для применения effects;
- использовать настоящие stores/use-cases;
- не создавать duplicate effects;
- подготавливать минимально необходимое состояние;
- уметь запускать визуальную сцену без прохождения всей кампании;
- отдельно позволять запускать сцену без effects, если нужен только visual QA;
- явно маркировать режим `visual-only`;
- поддерживать reset;
- не содержать секретов;
- не выполнять сетевые вызовы Higgsfield при каждом запуске готовой сцены.

## Пример структуры `scenes.md`

```md
# Scene launcher

## Общая подготовка

## executive-phishing-request

### Полный игровой запуск

```js
// точная рабочая команда
```

### Только визуальная проверка

```js
// точная рабочая команда
```

### Запуск consequence

```js
// точная рабочая команда
```

### Reset

```js
// точная рабочая команда
```

### Проверить

- ...

## supply-chain-update

...

## shadow-it-log-upload

...

## office-intrusion

...
```

Нельзя оставлять в `scenes.md` команды, которые не были реально выполнены и проверены Claude.

---

# Scene synchronization и camera

Все четыре документируемые сцены должны соблюдать Feature 18H:

- обязательные участники резервируют scene slots;
- персонажи приходят до начала диалога;
- камера завершает transition до реплики;
- actor не уходит во время shot;
- слушатели смотрят на говорящего;
- UI не закрывает головы;
- character scale не меняется;
- fallback group shot существует;
- после сцены claims освобождаются;
- planner восстанавливается.

Для scene inserts:

- сначала короткий video insert;
- затем camera blend в 3D;
- затем диалог и выбор;
- после выбора reaction shot;
- затем возврат в gameplay.

---

# UI и educational framing

Игроку не показывать термины как сухую лекцию.

До выбора показывать только полезный компромисс:

```text
Быстрее, но запрос не будет подтверждён.
```

```text
Снижает риск стороннего кода, но оставляет известную ошибку.
```

```text
Защищает данные, но задерживает исправление пользовательской проблемы.
```

После consequence daily report должен объяснять причинность:

```text
Неизвестный адрес использовал сведения о структуре команды,
которые ранее были отправлены без проверки.
```

```text
Новое соединение появилось после обновления зависимости,
которую команда установила перед демонстрацией без review.
```

```text
Архив логов был повторно скачан из личного облака.
Рабочая система не могла отозвать внешнюю копию.
```

Не использовать морализаторский тон.

---

# Migration и reset

Для старых сохранений:

- создать records трёх сцен;
- не воспроизводить их задним числом, если соответствующая точка кампании уже явно пройдена;
- не применять effects;
- не угадывать выбор;
- сделать сцену available только в текущей или будущей допустимой точке;
- сохранить существующие Feature 17 decisions;
- сохранить `office-intrusion` state.

Reset должен очищать:

- records;
- choices;
- consequence hooks;
- modifiers;
- scene prepared state;
- dev launcher prepared fixtures;
- временных actors;
- cinematic insert state.

---

# Тесты

## Общие story tests

1. три scene ids уникальны;
2. scene catalog содержит все choices;
3. одновременно активна только одна blocking scene;
4. Workday Flow блокируется;
5. DeepSeek скрыт;
6. повторный resolve идемпотентен;
7. reload во время dialogue;
8. reload после choice до effect completion;
9. resolved scene не повторяется;
10. reset очищает state.

## Executive phishing

11. trigger появляется в допустимой точке;
12. отправка создаёт future hook;
13. verification не создаёт future AUTH modifier;
14. Ilya choice недоступен без hire record;
15. Ilya choice предотвращает targeted follow-up;
16. security training меняет вариант сцены.

## Supply chain

17. trigger связан с реальной demo/review точкой;
18. immediate update не задерживает product progress;
19. immediate update создаёт delayed unknown connection;
20. keep version создаёт controlled demo penalty;
21. review занимает Кирилла;
22. review не создаёт unknown connection;
23. dependency effects применяются один раз.

## Shadow IT

24. trigger требует существующего debugging context;
25. raw upload создаёт sensitive/governance signals;
26. manual sanitize занимает сотрудника;
27. secure sharing availability зависит от состояния;
28. secure sharing ускоряет будущие investigations;
29. production-data choice усиливает raw upload consequence;
30. external download применяется один раз.

## Cinematic tests

31. insert отсутствует — работает fallback;
32. insert загружен — 3D choice не пропускается;
33. camera не смотрит в пустоту;
34. scale actor неизменен;
35. UI не закрывает character safe area;
36. claims очищаются;
37. planner восстанавливается.

## Launcher tests

38. launcher существует только в development/test;
39. launcher отсутствует в production bundle;
40. `list` содержит четыре сцены;
41. prepare создаёт минимальное состояние;
42. play запускает правильную сцену;
43. visual-only не применяет effects;
44. production-mode play использует настоящий handler;
45. repeated play не дублирует effects;
46. reset очищает fixture;
47. команды из `scenes.md` проверены автоматически либо вручную;
48. office-intrusion запускается через документированную команду.

---

# E2E-сценарии

## CYBER-01 — безопасный путь

```text
phishing verify
→ dependency review
→ secure log sharing
→ consequence hooks отсутствуют
→ нормальный выпуск
```

## CYBER-02 — рискованный, но восстанавливаемый

```text
send phishing data
→ keep dependency version
→ manual log sanitization
→ targeted follow-up
→ реакция команды
→ игра остаётся проходимой
```

## CYBER-03 — накопленный риск

```text
send phishing data
→ immediate dependency update
→ raw logs upload
→ три delayed consequences
→ существующие AUTH/DATABASE/governance механики усиливаются
```

Этот путь не обязан мгновенно завершать игру, но должен заметно ухудшать:

- бюджет;
- сроки;
- risk state;
- release score;
- будущие dialogue.

## CYBER-04 — dev launcher

Последовательно выполнить команды из `scenes.md` для:

1. `executive-phishing-request`;
2. `supply-chain-update`;
3. `shadow-it-log-upload`;
4. `office-intrusion`.

Проверить visual-only и full-effects режимы.

---

# Ручная приёмка

Для каждой новой сцены:

1. trigger возникает в понятный момент;
2. objective приводит к правильному NPC;
3. marker отличается от DeepSeek;
4. video insert короткий и соответствует стилю;
5. персонажи занимают согласованные позиции;
6. камера показывает говорящего;
7. слушатели реагируют;
8. dialogue UI не закрывает лица;
9. choices понятны без raw numbers;
10. immediate reaction соответствует выбору;
11. день не завершается до resolve;
12. после сцены planner восстанавливается;
13. consequence происходит позже;
14. daily report объясняет связь;
15. reload не дублирует effects.

Для `scenes.md`:

1. открыть development build;
2. выполнить каждую команду буквально из документа;
3. проверить, что сцена запускается;
4. проверить visual-only;
5. проверить full-effects;
6. проверить reset;
7. убедиться, что production build не содержит launcher.

---

# Что нельзя делать

Не добавлять:

- новые сцены физического проникновения;
- ещё одного intruder;
- случайный шанс выбора consequence;
- генерацию choices через DeepSeek;
- реальный вредоносный код;
- реальные фишинговые домены;
- реальные токены или персональные данные;
- универсальный event engine;
- новую систему денег;
- новую систему рисков;
- постоянных новых NPC;
- обязательную зависимость прохождения от Higgsfield;
- launcher в production;
- dev-команды, обходящие идемпотентность;
- псевдокоманды в `scenes.md`, которые не были проверены.

Не менять:

- положение whiteboard;
- существующую сцену `office-intrusion`, кроме минимальной интеграции с launcher и исправления воспроизводимого бага;
- balance Feature 01–18 без отчёта и тестов;
- текущие условия победы и поражения.

---

# Обязательные документы

Создать:

```text
scenes.md
docs/qa/19-cyber-story-test-matrix.md
docs/qa/19-cyber-story-balance-report.md
docs/art/cinematics/executive-phishing-request/
docs/art/cinematics/supply-chain-update/
docs/art/cinematics/shadow-it-log-upload/
```

Обновить:

- animation library при добавлении clips;
- asset register при добавлении Higgsfield assets;
- visual known issues;
- campaign simulator;
- persist migration documentation.

---

# Критерии готовности

Feature 19 считается завершённой только если:

- реализованы три разные по смыслу security-сцены;
- сцены не связаны с физическим проникновением;
- каждая имеет минимум один выгодный сейчас risky choice;
- каждая имеет дорогой или медленный безопасный choice;
- последствия возникают позже;
- последствия связываются с выбором в dialogue и daily report;
- Higgsfield inserts соответствуют утверждённому стилю;
- fallback работает без Higgsfield;
- Workday Flow и event priority не сломаны;
- reload и reset безопасны;
- balance constants вынесены;
- `scenes.md` создан;
- команды из `scenes.md` реально запускают 3 новые сцены и `office-intrusion`;
- visual-only режим не применяет effects;
- full-effects режим идемпотентен;
- launcher отсутствует в production;
- tests/E2E проходят;
- production build проходит.

---

# Формат ответа Claude Code

```md
## Итог Feature 19

## Проверка существующей архитектуры

## Реализованные сцены

### executive-phishing-request
- trigger
- dialogue
- choices
- immediate effects
- delayed consequences
- Higgsfield insert
- fallback
- tests

### supply-chain-update
...

### shadow-it-log-upload
...

## Интеграция с Story Decision Core

## Интеграция с Workday Flow и coordinator

## Balance changes

## Higgsfield assets

| Scene | Asset | Tool/model | Production path | Fallback |
|---|---|---|---|---|

## Созданный scenes.md

### Проверенные команды

## Dev launcher

## Migration и reset

## Unit tests

## Integration tests

## E2E

## Visual QA

## Выполненные команды

## Первый полный прогон

## Второй полный прогон

## Production build

## Созданные файлы

## Изменённые файлы

## Оставшиеся ограничения

## Git status
```

Не переходить к следующей Feature.
