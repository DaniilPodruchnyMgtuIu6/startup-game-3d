# Как вызвать любую сцену игры вручную

Шпаргалка для ручной проверки/доработки сюжетных сцен без прохождения всей
кампании. Два способа, от простого к универсальному:

1. **Консольные dev-хелперы** (`window.__что-то`) — самый быстрый способ,
   но работают **только на `npm run dev`** (dev-сервер Vite). В
   production-сборке (`npm run build` + `npm run preview`, и в самой игре у
   игрока) их нет — `import.meta.env.DEV` там `false`, и весь блок
   `src/App.tsx` с этими функциями просто не выполняется.
2. **Localstorage-снипет + `location.reload()`** — работает везде (dev и
   production), потому что просто подставляет то состояние, которое
   реальные триггеры сцен и так проверяют при каждом кадре.

## Обязательные правила

- **После любой правки `localStorage` нужен `location.reload()`.** Стораджи
  читаются один раз при загрузке модуля — живого перечитывания нет.
- **Никогда не используйте `?intro` для перехода к сцене.** Это полный
  сброс прогресса (стирает буквально всё), а не «показать сцену X». Только
  для честного старта новой игры с нуля.
- Большинству сцен нужна `startup-office-progress.phase === 'free'` (кроме
  интро Сони, которому нужен `'meetPm'`).
- Открыть консоль браузера: F12 → вкладка Console.

## Дев-хелперы (только `npm run dev`)

```js
window.__startCutscene(id)              // запускает ЛЮБУЮ зарегистрированную катсцену напрямую, минуя все условия
window.__startStoryDecision(id)         // одна из 8 сцен решений Level 1 (17B), минуя маркер/подход
window.__queueStoryConsequence(id)      // ставит сцену последствий (17C) в очередь — уже смонтированный контроллер подхватит сам
window.__breakServer(role?)             // 'gateway' | 'auth' | 'database' | 'backup'
window.__repairServer(role)             // ломает (если нужно) и сразу открывает мини-игру ремонта
window.__startPostAuditConversation()   // разговор с Соней про СКУД после аудита → pending
window.__hireSecuritySpecialist()       // нанимает Илью по-настоящему (без денег/времени)
window.__triggerFollowUpAudit()         // повторный аудит → pending (нужен уже инициализированный план замечаний)
window.__triggerOfficeIntrusion()       // угроза проникновения → pending
window.__triggerServerIncident(id?)     // 'gateway-outage' | 'auth-account-incident' | 'database-exposure-review'
window.__triggerGameFailure(reason?)    // см. причины ниже, по умолчанию 'budget-exhausted'
window.__triggerCampaignSuccess()       // фиксирует победу по текущей статистике
window.__getGameOutcome()               // только чтение — текущий статус победы/поражения
window.__getRiskState()                 // только чтение — сигналы риска и уровни по доменам
```

**Важная оговорка про `__startCutscene`**: он вызывает `startScene(id)`
напрямую, БЕЗ проверки условий сцены (аудит, найм и т.д.) — сама сцена всё
равно трогает стораджи безусловно (например, ставит `securityBreach` в
`running`/`completed`), и водит по сцене конкретных NPC, которые должны
быть реально наняты. Для сцен без собственного «одна команда — и готово»
хелпера (МВП-релиз, решения Level 1, последствия) — либо localStorage
ниже, либо (для MVP) реальный клик по кнопке в интерфейсе.

id зарегистрированных катсцен (`src/cutscenes/registry.ts`):
`security-breach`, `security-follow-up-audit`, `office-intrusion`,
`server-gateway-outage`, `server-auth-account-incident`,
`server-database-exposure-review`, `officeflow-mvp-release`.

---

## 1. security-breach («незаблокированный монитор»)

Проще всего: `window.__startCutscene('security-breach')`.

Условия реального триггера (`securityStoryRules.ts`): спринт ≥2, день ≥2,
спринт активен, Кирилл и Алина наняты, первый прототип готов (все 6 задач
`prototype` done), сцена ещё не шла.

```js
localStorage.setItem('startup-office-progress', JSON.stringify({ playerName: 'Тест', phase: 'free', tasks: [], reprimands: 0 }))
localStorage.setItem('startup-office-sprint', JSON.stringify({ sprintNumber: 2, day: 2, phase: 'active' }))
localStorage.setItem('startup-office-team', JSON.stringify({
  hires: [
    { employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 },
    { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 },
  ],
}))
localStorage.setItem('startup-office-product', JSON.stringify({
  taskStates: ['auth-api', 'rooms-api', 'booking-api', 'login-screen', 'rooms-screen', 'booking-form']
    .map((id) => ({ taskId: id, status: 'done', progressDays: 999 })),
  workdayHistory: [],
}))
localStorage.setItem('startup-office-security', JSON.stringify({
  securityBreach: { status: 'not-started', effectsApplied: false },
  postAuditConversation: { status: 'locked', effectsApplied: false },
  hasIntroducedSecuritySpecialist: false,
}))
location.reload()
```
Сцена запустится сама, как только интерфейс свободен — идти никуда не надо.

## 2. security-follow-up-audit (повторный аудит)

Проще всего (если разговор с Соней уже был): `window.__triggerFollowUpAudit()`.

```js
localStorage.setItem('startup-office-progress', JSON.stringify({ playerName: 'Тест', phase: 'free', tasks: [], reprimands: 0 }))
localStorage.setItem('startup-office-security-audit', JSON.stringify({
  initialized: true,
  findings: [],
  followUpAudit: { status: 'pending', pendingAuditNumber: 1, records: [] },
  leadershipComplaint: false,
  shutdownRecommendation: false,
  workdayHistory: [],
}))
location.reload()
```
`pendingAuditNumber` обязателен — без него нормализация тихо откатит
статус на `'scheduled'`.

## 3. Серверные инциденты (gateway / auth / database)

Проще всего: `window.__triggerServerIncident('auth-account-incident')`.

```js
localStorage.setItem('startup-office-progress', JSON.stringify({ playerName: 'Тест', phase: 'free', tasks: [], reprimands: 0 }))
localStorage.setItem('startup-office-server-incidents', JSON.stringify({
  incidents: {
    'auth-account-incident': {
      incidentId: 'auth-account-incident',
      status: 'pending',
      armedAtWorkdayIndex: 1,
      dueWorkdayIndex: 1, // ОБЯЗАТЕЛЬНО — без него статус тихо откатится на 'dormant'
      recoveryProgressDays: 0,
      effectsApplied: false,
    },
  },
  workdayHistory: [],
}))
location.reload()
```
Кирилл должен быть нанят — сцена безусловно ведёт его к стойке. Другие id:
`'gateway-outage'`, `'database-exposure-review'`.

## 4. officeflow-mvp-release (выпуск MVP)

Хелпера нет — только реальная кнопка (`releaseOfficeFlowMvp` не вынесена
на `window`, потому что проверяет боевую готовность: все 14 задач,
бюджет>0, нет открытых замечаний/угроз). `__startCutscene('officeflow-mvp-release')`
проиграет ролик, но применит успех БЕЗУСЛОВНО — годится только для
визуальной проверки самой сцены, не для проверки блокировок.

```js
localStorage.setItem('startup-office-progress', JSON.stringify({ playerName: 'Тест', phase: 'free', tasks: [], reprimands: 0 }))
localStorage.setItem('startup-office-sprint', JSON.stringify({ sprintNumber: 3, day: 1, phase: 'active' }))
localStorage.setItem('startup-office-team', JSON.stringify({
  hires: [
    { employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 },
    { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 },
    { employeeId: 'ilya-vlasov', hiredAtSprint: 1, hiredAtDay: 2 },
  ],
}))
localStorage.setItem('startup-office-product', JSON.stringify({
  taskStates: [
    'auth-api', 'rooms-api', 'booking-api', 'login-screen', 'rooms-screen', 'booking-form',
    'employees-api', 'guest-passes-api', 'event-log-api', 'notifications-api',
    'employees-screen', 'guest-passes-screen', 'event-log-screen', 'notifications-screen',
  ].map((id) => ({ taskId: id, status: 'done', progressDays: 999 })),
  workdayHistory: [],
}))
location.reload()
```
Дальше вручную: подойти к доске в офисе → «Выпустить MVP» → подтвердить.

## 5. Интро Сони (самый первый диалог)

Проще всего: очистить `localStorage` полностью и перезагрузить — это и
есть штатный старт новой игры, интро Сони идёт первым само.

Либо телепорт сразу к шагу «подойти к Соне»:
```js
localStorage.setItem('startup-office-progress', JSON.stringify({ playerName: 'Тест', phase: 'meetPm', tasks: [], reprimands: 0 }))
location.reload()
```
Дальше — кликнуть на маркер «!» над Соней.

## 6. Разговор с Соней про СКУД (после аудита)

Проще всего: `window.__startPostAuditConversation()`.

```js
localStorage.setItem('startup-office-progress', JSON.stringify({ playerName: 'Тест', phase: 'free', tasks: [], reprimands: 0 }))
localStorage.setItem('startup-office-security', JSON.stringify({
  securityBreach: {
    status: 'completed',
    firstStartedAt: { sprintNumber: 2, day: 2 },
    completedAt: { sprintNumber: 2, day: 2 },
    decision: 'take-responsibility', // или 'blame-project-manager' — разные реплики Сони
    effectsApplied: true,
  },
  postAuditConversation: { status: 'pending', effectsApplied: false },
  hasIntroducedSecuritySpecialist: false,
}))
location.reload()
```
Дальше — кликнуть на маркер 💬 над Соней и подойти.

## 7. Разговор с Ильёй (штатный безопасник)

Проще всего: `window.__hireSecuritySpecialist()`, затем кликнуть на самого
Илью в офисе (маркера у него нет, кликается сама фигурка).

```js
localStorage.setItem('startup-office-progress', JSON.stringify({ playerName: 'Тест', phase: 'free', tasks: [], reprimands: 0 }))
localStorage.setItem('startup-office-team', JSON.stringify({
  hires: [
    { employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 },
    { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 },
    { employeeId: 'ilya-vlasov', hiredAtSprint: 1, hiredAtDay: 2 },
  ],
}))
localStorage.setItem('startup-office-security', JSON.stringify({
  securityBreach: { status: 'not-started', effectsApplied: false },
  postAuditConversation: { status: 'locked', effectsApplied: false },
  hasIntroducedSecuritySpecialist: false, // true — сразу проверить повторные/тревожные реплики вместо интро
}))
location.reload()
```

## 8. Планёрка спринта (kickoff)

Хелпера нет — но эта сцена запускается полностью сама, без единого клика,
сразу после `reload()`.

```js
localStorage.setItem('startup-office-progress', JSON.stringify({ playerName: 'Тест', phase: 'free', tasks: [], reprimands: 0 }))
localStorage.setItem('startup-office-team', JSON.stringify({
  hires: [
    { employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 },
    { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 },
  ],
}))
localStorage.setItem('startup-office-sprint', JSON.stringify({ sprintNumber: 2, day: 1, phase: 'active' }))
localStorage.removeItem('startup-office-sprint-kickoff') // это простое число, не JSON — проще удалить
location.reload()
```

## 9. Сюжетные решения Level 1 (17B) — на примере `developer-admin-access`

Хелпер: `window.__startStoryDecision(id)` — сразу проигрывает сцену,
эффекты выбора применяются по-настоящему, ходить никуда не надо.

Полный список из 8 id — `LEVEL1_DECISION_PRIORITY` в
`src/game/story/level1Timeline.ts`:
`security-baseline-path`, `developer-admin-access`, `frontend-test-data`,
`security-first-priority`, `backup-and-restore-strategy`,
`architecture-boundary`, `suspicious-activity-disclosure`,
`release-risk-decision`.

```js
window.__startStoryDecision('developer-admin-access')
```

Через localStorage (маркер «!» появится над ведущим NPC этого решения —
для `developer-admin-access` это Кирилл, надо подойти и кликнуть):
```js
localStorage.setItem('startup-office-progress', JSON.stringify({ playerName: 'Тест', phase: 'free', tasks: [], reprimands: 0 }))
localStorage.setItem('startup-office-team', JSON.stringify({
  hires: [
    { employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 },
    { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 },
  ],
}))
localStorage.setItem('startup-office-story-decisions', JSON.stringify({
  decisions: {
    'developer-admin-access': { decisionId: 'developer-admin-access', status: 'available', availableAt: { sprintNumber: 1, day: 1 }, effectsApplied: false },
  },
  completedCheckpointIds: [],
}))
location.reload()
```
Остальные 7 решений можно не указывать — нормализация сама достраивает их
как `'locked'`.

## 10. Сюжетные последствия Level 1 (17C) — на примере `project-files-destroyed`

Хелпер: `window.__queueStoryConsequence(id)` — сцена запустится сама на
ближайшем свободном кадре, ходить никуда не надо.

Полный список из 13 id — `StoryConsequenceId` в
`src/game/story/level1Checkpoints.ts`: `data-loss-final-warning`,
`project-files-destroyed`, `project-recovered-unverified`,
`project-recovered-verified`, `disclosure-incident-consequence`,
`dismissed-warning-incident`, `architecture-incident-consequence`,
`admin-access-consequence`, `test-data-consequence`,
`baseline-review-overdue`, `baseline-audit-result`,
`internal-review-complete`, `backup-warning-scene`,
`concealed-risk-discovered`.

```js
window.__queueStoryConsequence('project-files-destroyed')
window.__queueStoryConsequence('project-recovered-unverified')
```

Через localStorage:
```js
localStorage.setItem('startup-office-progress', JSON.stringify({ playerName: 'Тест', phase: 'free', tasks: [], reprimands: 0 }))
localStorage.setItem('startup-office-story-consequences', JSON.stringify({
  pendingConsequenceIds: ['project-files-destroyed'],
}))
location.reload()
```

## 11. Экран поражения / победы

Хелперы работают мгновенно, без reload — по текущей живой статистике:
```js
window.__triggerGameFailure('budget-exhausted')             // бюджет исчерпан
window.__triggerGameFailure('leadership-suspension')        // руководство закрыло проект
window.__triggerGameFailure('service-collapse')             // затяжной простой сервера
window.__triggerGameFailure('delivery-deadline-missed')     // сорван дедлайн MVP
window.__triggerGameFailure('unrecoverable-project-data-loss') // сюжетное — только после сцены потери данных
window.__triggerGameFailure('concealed-critical-release-risk') // сюжетное — только после скрытого риска на релизе
window.__triggerCampaignSuccess()                            // победа по текущим показателям
```
Если не срабатывает — исход уже зафиксирован в этом прохождении:
`window.__getGameOutcome()` покажет статус; если не `'playing'`, удалите
`startup-office-game-outcome` из localStorage и перезагрузите страницу
перед повторной попыткой.

---

## Сцена с нарушителем (office-intrusion) — то, с чего всё начиналось

Проще всего: `window.__triggerOfficeIntrusion()` — ставит угрозу в
`pending`, штатный триггер сам подхватывает и запускает сцену.

Через localStorage (тот же снипет, что уже проверен вживую в этой
сессии) — различайте ветку по составу команды:

```js
localStorage.setItem('startup-office-progress', JSON.stringify({ playerName: 'Тест', phase: 'free', tasks: [], reprimands: 0 }))
localStorage.setItem('startup-office-sprint', JSON.stringify({ sprintNumber: 2, day: 2, phase: 'active' }))
localStorage.setItem('startup-office-team', JSON.stringify({
  hires: [
    { employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 },
    { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 },
    // добавить строку про ilya-vlasov ниже — и получите ветку «Илья останавливает у входа»
    // { employeeId: 'ilya-vlasov', hiredAtSprint: 2, hiredAtDay: 1 },
  ],
}))
localStorage.setItem('startup-office-security', JSON.stringify({
  securityBreach: { status: 'completed', decision: 'take-responsibility', completedAt: { sprintNumber: 2, day: 3 }, effectsApplied: true },
  postAuditConversation: { status: 'completed', staffingDecision: 'decline-security-hire', completedAt: { sprintNumber: 3, day: 1 }, effectsApplied: true },
  hasIntroducedSecuritySpecialist: false,
}))
localStorage.setItem('startup-office-access-control-v10', JSON.stringify({
  intrusion: { status: 'pending', armedAtWorkdayIndex: 1, dueWorkdayIndex: 1, effectsApplied: false },
}))
location.reload()
```
Для ветки с Ильёй: раскомментировать его в `hires`, поставить
`staffingDecision: 'approve-security-hire'` и `hasIntroducedSecuritySpecialist: true`.

Сюжет сцены (2026-07-29): курьер вставляет флешку и что-то скачивает,
затем нечаянно роняет монитор, когда собирается уйти — это и привлекает
внимание Сони. Она сначала разбирается с ним напрямую, потом, когда его
выпроваживают, поднимает с игроком вопрос СКУД. Видео и 3D-модель
собраны с одного и того же эталонного портрета (см.
`docs/art/characters/intruder-visitor/generation-prompts.md`), чтобы
персонаж в ролике и в игре не расходился.
