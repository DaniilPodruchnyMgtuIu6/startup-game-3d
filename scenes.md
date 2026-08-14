# Scene launcher

Dev-only способ запускать сюжетные сцены вручную для проверки, без прохождения всей кампании.

Launcher (`window.__startupGameDev.scenes`) существует **только** в dev-сборке (`import.meta.env.DEV`, т.е. `npm run dev`) — регистрируется в `src/App.tsx`. В production-бандле (`npm run build` + `vite preview`) `window.__startupGameDev` отсутствует; это подтверждено `e2e/cyberStoryScenes.spec.ts`.

Все команды ниже реально выполнены и проверены в живом браузере (Playwright + Chromium/SwiftShader) против `npm run dev` перед тем, как попасть в этот файл.

## Общая подготовка

1. Запустить dev-сервер:

   ```bash
   npm run dev
   ```

2. Открыть `http://127.0.0.1:5173/` (или порт, который выведет vite) в браузере, открыть DevTools → Console.

3. Засеять сохранение с наймом Кирилла и Алины (оба разработчика обязательны для всех трёх сцен) и завершённым онбордингом — вставить **до** захода на страницу (Application → Local Storage) либо выполнить в консоли и перезагрузить страницу:

   ```js
   localStorage.setItem('startup-office-progress', JSON.stringify({ playerName: 'Тест', phase: 'free', tasks: [], reprimands: 0 }))
   localStorage.setItem('startup-office-sprint', JSON.stringify({ sprintNumber: 1, day: 2, phase: 'active' }))
   localStorage.setItem('startup-office-team', JSON.stringify({
     hires: [
       { employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 },
       { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 },
     ],
   }))
   localStorage.setItem('startup-office-security', JSON.stringify({
     securityBreach: { status: 'completed', decision: 'take-responsibility', completedAt: { sprintNumber: 1, day: 1 }, effectsApplied: true },
     postAuditConversation: { status: 'completed', staffingDecision: 'decline-security-hire', completedAt: { sprintNumber: 1, day: 1 }, effectsApplied: true },
     hasIntroducedSecuritySpecialist: false,
   }))
   location.reload()
   ```

4. Проверить, что launcher загружен:

   ```js
   window.__startupGameDev.scenes.list()
   // [{id:'executive-phishing-request', status:'available'}, {id:'supply-chain-update', status:'locked'},
   //  {id:'shadow-it-log-upload', status:'locked'}, {id:'secret-committed-to-repository', status:'locked'},
   //  {id:'mfa-fatigue-attack', status:'locked'}, {id:'external-ai-data-disclosure', status:'locked'},
   //  {id:'office-intrusion', status:'dormant'}]
   ```

   Вывод реально проверен живым браузером (см. `docs/qa/19b-additional-cyber-story-test-matrix.md`).

5. Полный сброс прогресса в любой момент (в т.ч. между сценами):

   ```js
   location.search = '?intro'
   ```

---

## executive-phishing-request

**Участники:** Соня Соколова (ведёт), Кирилл Морозов, Алина Белова, Илья Власов (если нанят).

**Prerequisites:** оба разработчика наняты, спринт активен, день > 1 (не kickoff).

### Только визуальная проверка (visual-only, effects не применяются)

```js
window.__startupGameDev.scenes.play('executive-phishing-request', { visualOnly: true })
```

### Полный игровой запуск

```js
window.__startupGameDev.scenes.prepare('executive-phishing-request')
window.__startupGameDev.scenes.play('executive-phishing-request')
```

### Запуск конкретного choice (без 3D-сцены, быстрый путь)

```js
window.__startupGameDev.scenes.resolve('executive-phishing-request', 'send-requested-data')
// либо: 'verify-through-known-channel' | 'escalate-phishing-to-security' (Илья должен быть нанят)
```

### Запуск delayed consequence

```js
window.__startupGameDev.scenes.playConsequence('phishing-targeted-followup')
```

### Reset

```js
window.__startupGameDev.scenes.reset('executive-phishing-request')
```

### Проверить

- диалог открывается крупным планом на Соне/Кирилле/Алине, курсор не залипает;
- при `send-requested-data` — риск governance/identity-access растёт, последствие `phishing-targeted-followup` планируется через 3 рабочих дня;
- при `verify-through-known-channel` — Соня занята 1 день, риск снижается;
- при `escalate-phishing-to-security` (только с Ильёй) — списывается 40 000 ₽, Илья занят 1 день;
- после resolve маркер "!" над Соней исчезает, `window.__getCyberStoryState().incidents['executive-phishing-request'].status === 'resolved'`;
- `visual-only` не меняет баланс/риски (`window.__getRiskState()` / баланс в HUD не двигаются).

---

## supply-chain-update

**Участники:** Кирилл Морозов (ведёт), Алина Белова, Соня Соколова, Илья Власов (если нанят).

**Prerequisites:** Кирилл нанят, ≥3 завершённые задачи продукта, до ревью 1-2 рабочих дня (день `SPRINT_DAYS-2`/`SPRINT_DAYS-1` активного спринта), задача `auth-api` в работе или завершена.

### Только визуальная проверка

```js
window.__startupGameDev.scenes.play('supply-chain-update', { visualOnly: true })
```

### Полный игровой запуск

```js
window.__startupGameDev.scenes.prepare('supply-chain-update')
window.__startupGameDev.scenes.play('supply-chain-update')
```

### Запуск конкретного choice

```js
window.__startupGameDev.scenes.resolve('supply-chain-update', 'install-update-immediately')
// либо: 'keep-current-version' | 'review-and-pin-dependency'
```

### Запуск delayed consequence

```js
window.__startupGameDev.scenes.playConsequence('supply-chain-unknown-connection')
```

### Reset

```js
window.__startupGameDev.scenes.reset('supply-chain-update')
```

### Проверить

- при `install-update-immediately` — риск service-continuity/sensitive-data растёт, последствие `supply-chain-unknown-connection` планируется через 2 дня, будущий инцидент GATEWAY/DATABASE дорожает на 120 000 ₽ (`__getCyberStoryState().flags.supplyChainUpdateInstalled === true`);
- при `keep-current-version` — небольшой штраф delivery-pressure, последствий нет;
- при `review-and-pin-dependency` — списывается 60 000 ₽, Кирилл занят 2 дня, риск снижается;
- `prepare()` вызывает реальный `unlockIncident` (то же самое, что делает триггер игры).

---

## shadow-it-log-upload

**Участники:** Кирилл Морозов (ведёт), Алина Белова, Соня Соколова, Илья Власов (если нанят).

**Prerequisites:** оба разработчика наняты, решение `frontend-test-data` (Feature 17A) уже принято, первый прототип готов.

Для проверки без прохождения Feature 17A можно выполнить предпосылку сцены через существующий Feature 17A dev-hook (реальный use-case, не обход):

```js
window.__startStoryDecision('frontend-test-data') // затем выбрать вариант в открывшемся диалоге
```

### Только визуальная проверка

```js
window.__startupGameDev.scenes.play('shadow-it-log-upload', { visualOnly: true })
```

### Полный игровой запуск

```js
window.__startupGameDev.scenes.prepare('shadow-it-log-upload')
window.__startupGameDev.scenes.play('shadow-it-log-upload')
```

### Запуск конкретного choice

```js
window.__startupGameDev.scenes.resolve('shadow-it-log-upload', 'upload-raw-logs-to-personal-cloud')
// либо: 'sanitize-logs-manually' | 'configure-secure-log-sharing' (нужен Илья либо central-logging)
```

### Запуск delayed consequence

```js
window.__startupGameDev.scenes.playConsequence('shadow-it-external-download')
```

### Reset

```js
window.__startupGameDev.scenes.reset('shadow-it-log-upload')
```

### Проверить

- при `upload-raw-logs-to-personal-cloud` — риск sensitive-data/governance растёт, последствие `shadow-it-external-download` планируется через 3 дня;
- при `sanitize-logs-manually` — назначенный сотрудник занят 1 день;
- при `configure-secure-log-sharing` — списывается 80 000 ₽, Кирилл (+Илья, если нанят) заняты;
- после `shadow-it-external-download` — списывается 150 000 ₽ (containment), риск sensitive-data/governance растёт ещё раз.

---

## secret-committed-to-repository

**Участники:** Кирилл Морозов (ведёт), Соня Соколова, Алина Белова, Илья Власов (если нанят).

**Prerequisites:** Кирилл нанят, есть реальный завершённый backend-taск (не только факт найма), сцена не срабатывает в тот же относительный рабочий день, что другая крупная cyber-story сцена.

### Только визуальная проверка (visual-only, effects не применяются)

```js
window.__startupGameDev.scenes.play('secret-committed-to-repository', { visualOnly: true })
```

### Полный игровой запуск

```js
window.__startupGameDev.scenes.prepare('secret-committed-to-repository')
window.__startupGameDev.scenes.play('secret-committed-to-repository')
```

### Запуск конкретного choice (без 3D-сцены, быстрый путь)

```js
window.__startupGameDev.scenes.resolve('secret-committed-to-repository', 'remove-secret-in-new-commit')
// либо: 'rewrite-repository-history' | 'rotate-and-secure-secret'
```

### Запуск delayed consequence

```js
// только ОДНО из двух — зависит от того, какой choice был сделан:
window.__startupGameDev.scenes.playConsequence('external-credential-usage')     // после remove-secret-in-new-commit
window.__startupGameDev.scenes.playConsequence('credential-found-in-ci-cache')  // после rewrite-repository-history
// rotate-and-secure-secret не планирует последствие — ключ реально отозван
```

### Reset

```js
window.__startupGameDev.scenes.reset('secret-committed-to-repository')
```

### Проверить

- диалог явно различает три состояния — `flags.credentialExposureState` становится `'history-retained'` (remove), `'reduced'` (rewrite) или `'rotated'` (rotate), никогда просто `true`/`false`;
- при `remove-secret-in-new-commit` — риск identity-access/governance растёт, последствие `external-credential-usage` планируется через 3 дня, дальнейшая AUTH-инцидент-стоимость дорожает, пока ключ не ротирован (`getCyberStoryIncidentCostModifierRub('auth-account-incident')`);
- при `rewrite-repository-history` — Кирилл и Алина заняты по 1 дню, последствие `credential-found-in-ci-cache` планируется через 5 дней (позже, но не отменено — ключ мог остаться в fork/кэше);
- при `rotate-and-secure-secret` — списывается 90 000 ₽, Кирилл занят день на переподключение, без Ильи ещё один день на самостоятельную настройку secret scanning (**одно** назначение с суммарными днями, не два отдельных), с Ильёй — Илья настраивает secrets management отдельно; последствие не планируется;
- central logging (Feature 17A, `prioritize-central-logging`) сокращает срок до последствия на 1 рабочий день (`applyCentralLoggingDetectionSpeedup`);
- после resolve маркер "!" над Кириллом исчезает, `window.__getCyberStoryState().incidents['secret-committed-to-repository'].status === 'resolved'`.

---

## mfa-fatigue-attack

**Участники:** Кирилл Морозов (ведёт), Соня Соколова, Алина Белова, Илья Власов (если нанят).

**Prerequisites:** Кирилл нанят, первый прототип готов (реальная рабочая система входа), день не kickoff (день > 1), `executive-phishing-request` уже разрешена ИЛИ спринт ≥ 2, сцена не срабатывает в тот же относительный рабочий день, что другая крупная cyber-story сцена.

### Только визуальная проверка

```js
window.__startupGameDev.scenes.play('mfa-fatigue-attack', { visualOnly: true })
```

### Полный игровой запуск

```js
window.__startupGameDev.scenes.prepare('mfa-fatigue-attack')
window.__startupGameDev.scenes.play('mfa-fatigue-attack')
```

### Запуск конкретного choice

```js
window.__startupGameDev.scenes.resolve('mfa-fatigue-attack', 'change-password-only')
// либо: 'revoke-sessions-and-investigate' | 'enable-phishing-resistant-auth'
```

### Запуск delayed consequence

```js
window.__startupGameDev.scenes.playConsequence('hijacked-session-activity') // только после change-password-only
```

### Reset

```js
window.__startupGameDev.scenes.reset('mfa-fatigue-attack')
```

### Проверить

- при `change-password-only` — Кирилл занят 1 день, **неизвестная активная сессия НЕ отзывается** (`flags.unknownSessionState === 'active'`), последствие `hijacked-session-activity` планируется через 3 дня;
- если до этого была пройдена `executive-phishing-request` с `escalate-phishing-to-security` — identity-access impact от `change-password-only` вдвое меньше (сильная защита ослабляет последствие, но не отменяет его);
- при `revoke-sessions-and-investigate` — списывается 50 000 ₽, без Ильи расследуют Кирилл+Соня, с Ильёй — Кирилл+Илья; `flags.unknownSessionState === 'revoked'`, последствия нет;
- при `enable-phishing-resistant-auth` — списывается 140 000 ₽, без Ильи Кирилл тратит на день больше (**одно** назначение с суммарными днями), сессия отзывается;
- после завершённого `hijacked-session-activity` будущий GATEWAY/DATABASE инцидент дорожает на ограниченную сумму (`getCyberStoryIncidentCostModifierRub`);
- после resolve маркер "!" над Кириллом исчезает, `window.__getCyberStoryState().incidents['mfa-fatigue-attack'].status === 'resolved'`.

---

## external-ai-data-disclosure

**Участники:** Алина Белова (ведёт), Кирилл Морозов, Соня Соколова, Илья Власов (если нанят).

**Prerequisites:** Алина нанята, есть реальный завершённый frontend-таск, спринт ≤ 5, сцена не срабатывает в тот же относительный рабочий день, что другая крупная cyber-story сцена.

### Только визуальная проверка

```js
window.__startupGameDev.scenes.play('external-ai-data-disclosure', { visualOnly: true })
```

### Полный игровой запуск

```js
window.__startupGameDev.scenes.prepare('external-ai-data-disclosure')
window.__startupGameDev.scenes.play('external-ai-data-disclosure')
```

### Запуск конкретного choice

```js
window.__startupGameDev.scenes.resolve('external-ai-data-disclosure', 'allow-unrestricted-ai-tools')
// либо: 'ban-external-ai-tools' | 'configure-controlled-ai-gateway'
```

### Запуск delayed consequence

```js
// только ОДНО из двух — зависит от того, какой choice был сделан:
window.__startupGameDev.scenes.playConsequence('unrestricted-ai-recurrence') // после allow-unrestricted-ai-tools
window.__startupGameDev.scenes.playConsequence('shadow-ai-personal-use')     // после ban-external-ai-tools
// configure-controlled-ai-gateway не планирует последствие
```

### Reset

```js
window.__startupGameDev.scenes.reset('external-ai-data-disclosure')
```

### Проверить

- при `allow-unrestricted-ai-tools` — Алина получает ограниченное одноразовое ускорение прогресса (`applyStoryEffortReduction`, не бесконечный бафф), sensitive-data/governance риск растёт, последствие `unrestricted-ai-recurrence` планируется через 3 дня;
- если `shadow-it-log-upload` уже была решена через `configure-secure-log-sharing` — sensitive-data impact ниже (маскирование логов уже настроено);
- диалог `unrestricted-ai-recurrence` НЕ утверждает, что модель точно обучилась на данных команды — только что это неизвестно ("не можем точно сказать" / "не знаем точно");
- при `ban-external-ai-tools` — Алина занята 1 день на адаптацию, sensitive-data риск снижается, последствие `shadow-ai-personal-use` планируется через 5 дней и **не создаёт** ни расхода, ни риск-сигнала (это наблюдение, не вторая кара поверх более безопасного выбора);
- при `configure-controlled-ai-gateway` — списывается 120 000 ₽, без Ильи Кирилл тратит на день больше (**одно** назначение), с Ильёй — Илья настраивает маскирование и allowlist моделей; последствия нет;
- сцена нигде не называет реальный бренд AI-сервиса (ChatGPT/OpenAI/Claude/Anthropic/Gemini/Copilot/DeepSeek и т.п.) — только «ИИ-помощник»;
- после resolve маркер "!" над Алиной исчезает, `window.__getCyberStoryState().incidents['external-ai-data-disclosure'].status === 'resolved'`.

---

## office-intrusion

Существующая сцена (Feature 10). Launcher **не изменяет** её игровую логику — использует те же реальные stores (`useAccessControlStore`, `useCutsceneStore`), что и обычный триггер.

### Prerequisites

Отсутствуют — launcher переводит `intrusion.status` напрямую в `pending`.

### Полный игровой запуск

```js
window.__startupGameDev.scenes.prepare('office-intrusion') // intrusion.status -> 'pending'
window.__startupGameDev.scenes.play('office-intrusion')    // startScene('office-intrusion') - тот же CutsceneRunner
```

### Только визуальная проверка

У office-intrusion нет отдельного visual-only режима (сцена уже безопасна для повторного проигрывания — эффекты применяются один раз через `resolveIntrusion`, идемпотентно). Для чистого визуального QA использовать `reset` после `prepare`+`play`.

### Reset

```js
window.__startupGameDev.scenes.reset('office-intrusion') // resetAccessControl() -> intrusion.status = 'dormant'
```

### Проверить

- временные актёры появляются почти сразу, охранник/Илья достигают кабинета за 4-6 секунд;
- с Ильёй — нарушителя останавливают до рабочей зоны (60 000 ₽);
- без Ильи — нарушитель доходит до рабочей зоны (140 000 ₽, доп. риск sensitive-data);
- после сцены `intrusion.status === 'resolved'`.

---

## Известные ограничения

- `configure-secure-log-sharing` в `shadow-it-log-upload` недоступен в диалоге без Ильи или ранее выбранного `prioritize-central-logging` (Feature 17A) — это ожидаемое поведение, не баг launcher'а.
- `resolve()` пропускает 3D-прогулку и камеру целиком (быстрый путь для тестов); для проверки cinematic/camera используйте `play()`.
- Video-вставки для всех шести cyber-story сцен (`executive-phishing-request`, `supply-chain-update`, `shadow-it-log-upload`, `secret-committed-to-repository`, `mfa-fatigue-attack`, `external-ai-data-disclosure`) сгенерированы через Higgsfield и подключены — `play()` показывает реальный клип для каждой.
- Delayed-consequence вставки сгенерированы для `supply-chain-unknown-connection` и `shadow-it-external-download` (`playConsequence`/`playConsequenceNow`). Остальные последствия остаются dialogue-only (как и было в Feature 19A) — не блокирует прохождение.
- При недоступности файла/кодека любой вставки игра всё равно полностью проходима через in-engine fallback (`playInsert`).
- `secret-committed-to-repository`/`mfa-fatigue-attack`/`external-ai-data-disclosure` не срабатывают в тот же относительный рабочий день, что любая другая крупная cyber-story сцена (§ Event priority) — `prepare()` вызывает реальный `unlockIncident`, который в игре сработал бы только при соблюдении этого правила; через launcher `prepare()` обходит только сам триггер-предикат, не эту защиту от одновременного показа двух сцен (реализовано в `evaluateCyberStoryUnlocks.ts`, launcher её не проверяет и не должен — это правило только для автоматического открытия).
