# Демо-команды: запуск сюжетных сцен через консоль браузера

Готовые блоки для копипаста в консоль браузера (F12 → Console), чтобы
мгновенно показать любую из сцен, добавленных начиная с проникновения в
офис (Feature 10) и далее — все шесть сюжетных киберинцидентов Feature 19
(A+B).

**Работает и в `npm run dev`, и в готовой production-сборке** (localStorage +
`location.reload()` — те же ключи, что реально читает игра при загрузке;
никакой dev-only консоли не требуется). Это то, что нужно для демонстрации
на развёрнутом сервере.

## Как пользоваться

1. Открыть игру в браузере, открыть консоль (F12 → Console).
2. Скопировать **целиком** один блок ниже, вставить в консоль, нажать Enter.
3. Страница перезагрузится сама (`location.reload()` в конце блока).
4. Для сцен 2–7 — на карте появится маркер «!» над нужным коллегой (обычно
   через 5–10 секунд после перезагрузки, пока догружаются 3D-модели), кликнуть
   по нему. Для сцены 1 (office-intrusion) — сцена запускается сама, кликать
   не нужно.
5. Чтобы показать следующую сцену — просто вставить следующий блок, он сам
   очищает предыдущее состояние (`localStorage.clear()` в начале).
6. Чтобы вернуть обычный сохранённый прогресс — `location.search = '?intro'`
   (полный сброс) либо просто закрыть вкладку без сохранения демо-состояния.

Каждый блок сидирует одну и ту же базу (оба разработчика и Илья наняты,
свободная фаза, спринт 2 день 2, аудит и разговор о найме уже пройдены).

**Важно:** раз Илья нанят, над ним тоже появится небольшой маркер «!»
(«Поговорите с Ильёй» — его собственный, отдельный, уже неактуальный для
демо вопрос про первый приоритет защиты). Это ожидаемо и безвредно — просто
не кликайте по нему, кликайте по маркеру над нужным для конкретной сцены
коллегой (имя указано в заголовке раздела). Убрать этот маркер надёжно не
получилось без риска сломать спавн остальных маркеров (проверено вживую), поэтому
он оставлен как безобидный побочный эффект найма Ильи, а не баг демо-команд.

---

## 1. office-intrusion (проникновение в офис)

Сцена запускается автоматически через пару секунд после перезагрузки —
кликать никуда не нужно.

```js
localStorage.clear()
localStorage.setItem('startup-office-progress', JSON.stringify({ playerName: 'Демо', phase: 'free', tasks: [], reprimands: 0 }))
localStorage.setItem('startup-office-sprint', JSON.stringify({ sprintNumber: 2, day: 2, phase: 'active' }))
localStorage.setItem('startup-office-team', JSON.stringify({
  hires: [
    { employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 },
    { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 },
    { employeeId: 'ilya-vlasov', hiredAtSprint: 1, hiredAtDay: 2 },
  ],
}))
localStorage.setItem('startup-office-security', JSON.stringify({
  securityBreach: { status: 'completed', decision: 'take-responsibility', completedAt: { sprintNumber: 2, day: 1 }, effectsApplied: true },
  postAuditConversation: { status: 'completed', staffingDecision: 'approve-security-hire', completedAt: { sprintNumber: 2, day: 1 }, effectsApplied: true },
  hasIntroducedSecuritySpecialist: true,
}))
localStorage.setItem('startup-office-access-control-v10', JSON.stringify({
  intrusion: { status: 'pending', armedAtWorkdayIndex: 1, dueWorkdayIndex: 1, effectsApplied: false },
}))
location.reload()
```

С Ильёй в команде (как выше) нарушителя останавливают до рабочей зоны. Чтобы
показать вторую ветку (нарушитель доходит до рабочей зоны) — убрать строку
про `ilya-vlasov` из `hires` и заменить `staffingDecision` на
`'decline-security-hire'`, `hasIntroducedSecuritySpecialist` на `false`.

---

## 2. executive-phishing-request (фишинг от имени руководства)

Ведёт Соня. После reload кликнуть на маркер «!» над ней.

```js
localStorage.clear()
localStorage.setItem('startup-office-progress', JSON.stringify({ playerName: 'Демо', phase: 'free', tasks: [], reprimands: 0 }))
localStorage.setItem('startup-office-sprint', JSON.stringify({ sprintNumber: 2, day: 2, phase: 'active' }))
localStorage.setItem('startup-office-team', JSON.stringify({
  hires: [
    { employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 },
    { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 },
    { employeeId: 'ilya-vlasov', hiredAtSprint: 1, hiredAtDay: 2 },
  ],
}))
localStorage.setItem('startup-office-security', JSON.stringify({
  securityBreach: { status: 'completed', decision: 'take-responsibility', completedAt: { sprintNumber: 2, day: 1 }, effectsApplied: true },
  postAuditConversation: { status: 'completed', staffingDecision: 'approve-security-hire', completedAt: { sprintNumber: 2, day: 1 }, effectsApplied: true },
  hasIntroducedSecuritySpecialist: true,
}))
localStorage.setItem('startup-office-cyber-story', JSON.stringify({
  incidents: {
    'executive-phishing-request': { incidentId: 'executive-phishing-request', status: 'available', availableAt: { sprintNumber: 2, day: 2 }, effectsApplied: false },
    'supply-chain-update': { incidentId: 'supply-chain-update', status: 'resolved', selectedChoiceId: 'review-and-pin-dependency', effectsApplied: true },
    'shadow-it-log-upload': { incidentId: 'shadow-it-log-upload', status: 'resolved', selectedChoiceId: 'configure-secure-log-sharing', effectsApplied: true },
    'secret-committed-to-repository': { incidentId: 'secret-committed-to-repository', status: 'resolved', selectedChoiceId: 'rotate-and-secure-secret', effectsApplied: true },
    'mfa-fatigue-attack': { incidentId: 'mfa-fatigue-attack', status: 'resolved', selectedChoiceId: 'enable-phishing-resistant-auth', effectsApplied: true },
    'external-ai-data-disclosure': { incidentId: 'external-ai-data-disclosure', status: 'resolved', selectedChoiceId: 'configure-controlled-ai-gateway', effectsApplied: true },
  },
}))
location.reload()
```

Выборы: `send-requested-data` / `verify-through-known-channel` / `escalate-phishing-to-security` (только с Ильёй).

---

## 3. supply-chain-update (обновление перед демонстрацией)

Ведёт Кирилл. После reload кликнуть на маркер «!» над ним.

```js
localStorage.clear()
localStorage.setItem('startup-office-progress', JSON.stringify({ playerName: 'Демо', phase: 'free', tasks: [], reprimands: 0 }))
localStorage.setItem('startup-office-sprint', JSON.stringify({ sprintNumber: 2, day: 2, phase: 'active' }))
localStorage.setItem('startup-office-team', JSON.stringify({
  hires: [
    { employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 },
    { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 },
    { employeeId: 'ilya-vlasov', hiredAtSprint: 1, hiredAtDay: 2 },
  ],
}))
localStorage.setItem('startup-office-security', JSON.stringify({
  securityBreach: { status: 'completed', decision: 'take-responsibility', completedAt: { sprintNumber: 2, day: 1 }, effectsApplied: true },
  postAuditConversation: { status: 'completed', staffingDecision: 'approve-security-hire', completedAt: { sprintNumber: 2, day: 1 }, effectsApplied: true },
  hasIntroducedSecuritySpecialist: true,
}))
localStorage.setItem('startup-office-cyber-story', JSON.stringify({
  incidents: {
    'executive-phishing-request': { incidentId: 'executive-phishing-request', status: 'resolved', selectedChoiceId: 'verify-through-known-channel', effectsApplied: true },
    'supply-chain-update': { incidentId: 'supply-chain-update', status: 'available', availableAt: { sprintNumber: 2, day: 2 }, effectsApplied: false },
    'shadow-it-log-upload': { incidentId: 'shadow-it-log-upload', status: 'resolved', selectedChoiceId: 'configure-secure-log-sharing', effectsApplied: true },
    'secret-committed-to-repository': { incidentId: 'secret-committed-to-repository', status: 'resolved', selectedChoiceId: 'rotate-and-secure-secret', effectsApplied: true },
    'mfa-fatigue-attack': { incidentId: 'mfa-fatigue-attack', status: 'resolved', selectedChoiceId: 'enable-phishing-resistant-auth', effectsApplied: true },
    'external-ai-data-disclosure': { incidentId: 'external-ai-data-disclosure', status: 'resolved', selectedChoiceId: 'configure-controlled-ai-gateway', effectsApplied: true },
  },
}))
location.reload()
```

Выборы: `install-update-immediately` / `keep-current-version` / `review-and-pin-dependency`.

---

## 4. shadow-it-log-upload (логи в личном облаке)

Ведёт Кирилл. После reload кликнуть на маркер «!» над ним.

```js
localStorage.clear()
localStorage.setItem('startup-office-progress', JSON.stringify({ playerName: 'Демо', phase: 'free', tasks: [], reprimands: 0 }))
localStorage.setItem('startup-office-sprint', JSON.stringify({ sprintNumber: 2, day: 2, phase: 'active' }))
localStorage.setItem('startup-office-team', JSON.stringify({
  hires: [
    { employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 },
    { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 },
    { employeeId: 'ilya-vlasov', hiredAtSprint: 1, hiredAtDay: 2 },
  ],
}))
localStorage.setItem('startup-office-security', JSON.stringify({
  securityBreach: { status: 'completed', decision: 'take-responsibility', completedAt: { sprintNumber: 2, day: 1 }, effectsApplied: true },
  postAuditConversation: { status: 'completed', staffingDecision: 'approve-security-hire', completedAt: { sprintNumber: 2, day: 1 }, effectsApplied: true },
  hasIntroducedSecuritySpecialist: true,
}))
localStorage.setItem('startup-office-cyber-story', JSON.stringify({
  incidents: {
    'executive-phishing-request': { incidentId: 'executive-phishing-request', status: 'resolved', selectedChoiceId: 'verify-through-known-channel', effectsApplied: true },
    'supply-chain-update': { incidentId: 'supply-chain-update', status: 'resolved', selectedChoiceId: 'review-and-pin-dependency', effectsApplied: true },
    'shadow-it-log-upload': { incidentId: 'shadow-it-log-upload', status: 'available', availableAt: { sprintNumber: 2, day: 2 }, effectsApplied: false },
    'secret-committed-to-repository': { incidentId: 'secret-committed-to-repository', status: 'resolved', selectedChoiceId: 'rotate-and-secure-secret', effectsApplied: true },
    'mfa-fatigue-attack': { incidentId: 'mfa-fatigue-attack', status: 'resolved', selectedChoiceId: 'enable-phishing-resistant-auth', effectsApplied: true },
    'external-ai-data-disclosure': { incidentId: 'external-ai-data-disclosure', status: 'resolved', selectedChoiceId: 'configure-controlled-ai-gateway', effectsApplied: true },
  },
}))
location.reload()
```

Выборы: `upload-raw-logs-to-personal-cloud` / `sanitize-logs-manually` / `configure-secure-log-sharing` (доступен с Ильёй, как в этом снипете).

---

## 5. secret-committed-to-repository (ключ уже в истории)

Ведёт Кирилл. После reload кликнуть на маркер «!» над ним.

```js
localStorage.clear()
localStorage.setItem('startup-office-progress', JSON.stringify({ playerName: 'Демо', phase: 'free', tasks: [], reprimands: 0 }))
localStorage.setItem('startup-office-sprint', JSON.stringify({ sprintNumber: 2, day: 2, phase: 'active' }))
localStorage.setItem('startup-office-team', JSON.stringify({
  hires: [
    { employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 },
    { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 },
    { employeeId: 'ilya-vlasov', hiredAtSprint: 1, hiredAtDay: 2 },
  ],
}))
localStorage.setItem('startup-office-security', JSON.stringify({
  securityBreach: { status: 'completed', decision: 'take-responsibility', completedAt: { sprintNumber: 2, day: 1 }, effectsApplied: true },
  postAuditConversation: { status: 'completed', staffingDecision: 'approve-security-hire', completedAt: { sprintNumber: 2, day: 1 }, effectsApplied: true },
  hasIntroducedSecuritySpecialist: true,
}))
localStorage.setItem('startup-office-cyber-story', JSON.stringify({
  incidents: {
    'executive-phishing-request': { incidentId: 'executive-phishing-request', status: 'resolved', selectedChoiceId: 'verify-through-known-channel', effectsApplied: true },
    'supply-chain-update': { incidentId: 'supply-chain-update', status: 'resolved', selectedChoiceId: 'review-and-pin-dependency', effectsApplied: true },
    'shadow-it-log-upload': { incidentId: 'shadow-it-log-upload', status: 'resolved', selectedChoiceId: 'configure-secure-log-sharing', effectsApplied: true },
    'secret-committed-to-repository': { incidentId: 'secret-committed-to-repository', status: 'available', availableAt: { sprintNumber: 2, day: 2 }, effectsApplied: false },
    'mfa-fatigue-attack': { incidentId: 'mfa-fatigue-attack', status: 'resolved', selectedChoiceId: 'enable-phishing-resistant-auth', effectsApplied: true },
    'external-ai-data-disclosure': { incidentId: 'external-ai-data-disclosure', status: 'resolved', selectedChoiceId: 'configure-controlled-ai-gateway', effectsApplied: true },
  },
}))
location.reload()
```

Выборы: `remove-secret-in-new-commit` / `rewrite-repository-history` / `rotate-and-secure-secret`.

---

## 6. mfa-fatigue-attack (подтверждение среди ночи)

Ведёт Кирилл. После reload кликнуть на маркер «!» над ним.

```js
localStorage.clear()
localStorage.setItem('startup-office-progress', JSON.stringify({ playerName: 'Демо', phase: 'free', tasks: [], reprimands: 0 }))
localStorage.setItem('startup-office-sprint', JSON.stringify({ sprintNumber: 2, day: 2, phase: 'active' }))
localStorage.setItem('startup-office-team', JSON.stringify({
  hires: [
    { employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 },
    { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 },
    { employeeId: 'ilya-vlasov', hiredAtSprint: 1, hiredAtDay: 2 },
  ],
}))
localStorage.setItem('startup-office-security', JSON.stringify({
  securityBreach: { status: 'completed', decision: 'take-responsibility', completedAt: { sprintNumber: 2, day: 1 }, effectsApplied: true },
  postAuditConversation: { status: 'completed', staffingDecision: 'approve-security-hire', completedAt: { sprintNumber: 2, day: 1 }, effectsApplied: true },
  hasIntroducedSecuritySpecialist: true,
}))
localStorage.setItem('startup-office-cyber-story', JSON.stringify({
  incidents: {
    'executive-phishing-request': { incidentId: 'executive-phishing-request', status: 'resolved', selectedChoiceId: 'verify-through-known-channel', effectsApplied: true },
    'supply-chain-update': { incidentId: 'supply-chain-update', status: 'resolved', selectedChoiceId: 'review-and-pin-dependency', effectsApplied: true },
    'shadow-it-log-upload': { incidentId: 'shadow-it-log-upload', status: 'resolved', selectedChoiceId: 'configure-secure-log-sharing', effectsApplied: true },
    'secret-committed-to-repository': { incidentId: 'secret-committed-to-repository', status: 'resolved', selectedChoiceId: 'rotate-and-secure-secret', effectsApplied: true },
    'mfa-fatigue-attack': { incidentId: 'mfa-fatigue-attack', status: 'available', availableAt: { sprintNumber: 2, day: 2 }, effectsApplied: false },
    'external-ai-data-disclosure': { incidentId: 'external-ai-data-disclosure', status: 'resolved', selectedChoiceId: 'configure-controlled-ai-gateway', effectsApplied: true },
  },
}))
location.reload()
```

Выборы: `change-password-only` / `revoke-sessions-and-investigate` / `enable-phishing-resistant-auth`.

---

## 7. external-ai-data-disclosure (ИИ уже нашёл ошибку)

Ведёт Алина. После reload кликнуть на маркер «!» над ней.

```js
localStorage.clear()
localStorage.setItem('startup-office-progress', JSON.stringify({ playerName: 'Демо', phase: 'free', tasks: [], reprimands: 0 }))
localStorage.setItem('startup-office-sprint', JSON.stringify({ sprintNumber: 2, day: 2, phase: 'active' }))
localStorage.setItem('startup-office-team', JSON.stringify({
  hires: [
    { employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 },
    { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 },
    { employeeId: 'ilya-vlasov', hiredAtSprint: 1, hiredAtDay: 2 },
  ],
}))
localStorage.setItem('startup-office-security', JSON.stringify({
  securityBreach: { status: 'completed', decision: 'take-responsibility', completedAt: { sprintNumber: 2, day: 1 }, effectsApplied: true },
  postAuditConversation: { status: 'completed', staffingDecision: 'approve-security-hire', completedAt: { sprintNumber: 2, day: 1 }, effectsApplied: true },
  hasIntroducedSecuritySpecialist: true,
}))
localStorage.setItem('startup-office-cyber-story', JSON.stringify({
  incidents: {
    'executive-phishing-request': { incidentId: 'executive-phishing-request', status: 'resolved', selectedChoiceId: 'verify-through-known-channel', effectsApplied: true },
    'supply-chain-update': { incidentId: 'supply-chain-update', status: 'resolved', selectedChoiceId: 'review-and-pin-dependency', effectsApplied: true },
    'shadow-it-log-upload': { incidentId: 'shadow-it-log-upload', status: 'resolved', selectedChoiceId: 'configure-secure-log-sharing', effectsApplied: true },
    'secret-committed-to-repository': { incidentId: 'secret-committed-to-repository', status: 'resolved', selectedChoiceId: 'rotate-and-secure-secret', effectsApplied: true },
    'mfa-fatigue-attack': { incidentId: 'mfa-fatigue-attack', status: 'resolved', selectedChoiceId: 'enable-phishing-resistant-auth', effectsApplied: true },
    'external-ai-data-disclosure': { incidentId: 'external-ai-data-disclosure', status: 'available', availableAt: { sprintNumber: 2, day: 2 }, effectsApplied: false },
  },
}))
location.reload()
```

Выборы: `allow-unrestricted-ai-tools` / `ban-external-ai-tools` / `configure-controlled-ai-gateway`.

---

## Почему это надёжно

- Каждый блок сам вызывает `localStorage.clear()`, поэтому не накапливает
  состояние между демонстрациями — можно вставлять блоки один за другим без
  дополнительного сброса.
- Остальные пять киберинцидентов в каждом блоке сидируются уже `resolved` —
  это не подделка прохождения «под капотом», а тот же приём, которым реальный
  сейв защищён от повторного показа уже пройденной сцены (`normalizeRecord`
  никогда не переприменяет эффекты `resolved`-записи, только статус).
- Аудит и разговор о найме безопасника уже отмечены пройденными — иначе они
  сами претендовали бы на маркер поверх демонстрируемой сцены.
- Сюжетные решения Level 1 (Feature 17) не сидируются вовсе — при спринте ≥2
  без прогресса по задачам продукта ни одно из них не открывается **кроме**
  `security-first-priority`, которое триггерится только фактом найма и
  представления Ильи (`ilyaHired && ilyaIntroduced`) — отсюда и безобидный
  маркер над ним, см. «Важно» выше. Остальные семь решений Level 1
  действительно остаются заблокированы (проверено их триггер-условиями в
  `storyDecisionRules.ts`).
- Проверено живым браузером (production preview, `vite build` + `vite
  preview`): полный цикл reload → маркер над нужным коллегой появляется
  (обычно за 5–10 секунд) → клик открывает диалог сцены с правильным текстом.
