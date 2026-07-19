# Feature 15 — Release Readiness Report

## Проверенная версия
- Ветка: `master`, стабилизационная итерация Feature 15 (базовый HEAD до F15: `2921358`).
- Дата проверки: 2026-07-19.

## Среда запуска
- OS: Windows 10 (10.0.19045).
- Node: v22.20.0; Vite 8.1.4; Vitest 4.1.10; TypeScript 5.7.
- Браузерные smoke-проверки предыдущих фич: headless Chromium (SwiftShader, `--use-angle=swiftshader`).
- Reference-сборка для метрик: production (`vite build` + `vite preview`).

## Выполненные команды
- `npm run verify` — `tsc --noEmit && vitest run && vite build` (единый воспроизводимый flow, ненулевой код при любой ошибке, без платных запросов, без реального DeepSeek-ключа).
- `npm run typecheck`, `npm test`, `npm run build`.
- Security: `git check-ignore -v .env.local`, `git status --short --ignored`, локальный grep секрета по `src/server/public/dist/tracked` (вывод только PASS/FAIL).
- Health smoke: `GET /api/npc-chat/health` (без платного вызова модели).

## Тесты
- Unit + integration: **769 тестов в 113 файлах — все зелёные** (в т.ч. новые F15: campaign simulator + BAL, ledger reconciliation, persist migration, event priority, secret guards).
- E2E (браузер): headless smoke-скрипты использовались при приёмке F11–F14 (старт, save/reload, победа/поражение, NPC-подход, fallback), но **не интегрированы в `verify`** — Playwright не добавлен в devDependencies (см. Known Issues). Обязательные E2E-сценарии оформлены протоколами в `15-manual-test-matrix.md`.
- Покрытие по statements/branches/functions/lines как отдельный отчёт не собиралось (искусственный порог не вводился); все критические pure-rules доменов покрыты ветвями через существующие 113 файлов тестов.

## Build / lint / typecheck
- `tsc --noEmit`: **проходит**.
- `vite build`: **проходит** (client bundle ≈ 1.996 MB — рост от F15 < 1%: клиентского кода почти не добавлено; симулятор/тесты/`tools` в bundle не попадают).
- Lint: в проекте нет ESLint (нет зависимости/конфига). Статический гейт — TypeScript typecheck. Остающиеся suppressions: 8 оправданных `// eslint-disable-next-line react-hooks/exhaustive-deps` в one-time-effect контроллерах подхода к NPC; иных `@ts-ignore`/`@ts-nocheck`/`any`-обходов нет.

## Migration tests
- `src/game/persistMigration.test.ts` + существующие per-store тесты: hydration без исключений; `running → not-started`/`pending` нормализация; `?intro` → initial; идемпотентность нормализаторов; отсутствие дублей. **Проходят.**
- Числовых версий схем нет; миграция — идемпотентные `normalizeX`/`loadX` + стартовые `reconcileX`.

## Soak / performance
- Статический baseline: client bundle ≈ 1.996 MB; production build ≈ 1.2 s; `npm run verify` тесты ≈ 31 s.
- 30-минутный NPC soak и heap-профилирование — **ручной протокол** в `15-manual-test-matrix.md`, в этом автоматическом прогоне не выполнялись.

## Security / secret checks
- `DEEPSEEK_API_KEY настроен локально и игнорируется Git.`
- PASS: секрет отсутствует в `src`, `server`, `public`, `dist`, tracked-файлах; `.env.local` игнорируется; клиент не ссылается на ключ/`VITE_DEEPSEEK` и не вызывает `api.deepseek.com`; `server/secretGuards.test.ts` зелёный; health не раскрывает метаданные ключа.

## Стабилизационный прогон (перенос whiteboard + автономная охота на баги)
- **Whiteboard перенесён** из дальнего угла переговорной (север. стена, лицом от камеры) на open-space сторону фронтальной стены серверной (`scene/whiteboardSpot.ts`: x=−6+0.15, z=3.7, лицом к камере/+x) — на главном маршруте (спавн игрока [2,0,6], ряд NPC-столов рядом). Стена уже была общей белой `paint`-стеной — материал переиспользован, навигационная сетка не менялась, доска не регистрирует препятствие. Добавлено поведение подхода: клик издалека ведёт игрока к доске, панель открывается только на дистанции взаимодействия (`MEET_DISTANCE`), с проверкой `inputLocked` (раньше панель открывалась мгновенно из любой точки). Марки финальной сцены MVP обновлены на новую позицию; подсказки UI («у входа в серверную») обновлены; PlanningMarker переехал с доской. Тесты: `whiteboardSpot.test.ts` (геометрия/двери/walkable/дистанция), `OpenSpace.test.tsx` (ровно одна доска в точке), `MeetingRoom.test.tsx` (без доски). Живой headless-тест: рейкаст-клик по canvas в доску → подход → панель открылась со всеми вкладками (PASS).
- Проверены все `running`-нормализаторы опасных reload-точек (breach → not-started; post-audit/audit/intrusion/server-incident → pending) — soft-lock при reload исключён, P1 не найден.
- P2-текст: предупреждение depleted в подтверждении «Завершить день» теперь сообщает последствие («Проект будет закрыт…»), а не только факт исчерпания (требование F12 §6 «последствия видны до подтверждения»).
- После правок: `verify` зелёный — **773 теста в 114 файлах** + typecheck + build.

## Балансовый цикл (утверждён пользователем)
- Один блок §29 (effort): `effortDays` всех 14 задач ×~1.9 → `TOTAL_EFFORT_DAYS` 45 → 87 (backend 44 / frontend 43). Полный повторный прогон BAL: релиз S5D5/S6D1, бюджеты 476k / 650k / 300k — все полосы §11 выполнены; ассерты закреплены на полосах. 8 затронутых тестов обновлены на новые константы (без ослабления). Симулятор дополнен корректирующим планом (KI-01/02/03 закрыты). `verify` после изменений: 773/773 + build.

## Глубокий цикл 2 (поиск → воспроизведение → фикс → тест)

### BUG-01 — Free-chat разваливался в момент открытия (P2, исправлен)
- **Симптом:** при открытии свободного разговора NPC мгновенно возвращался к планировщику (уходил во время разговора), talk-анимация гасла, игрок мог ходить при открытой панели.
- **Причина:** `NpcChatTargetGate` демонтировал talk-target при `eligible=false`, а открытие чата само делает NPC «не eligible» (`inputLocked=true`) → unmount-cleanup срабатывал посреди разговора (снимал lock, возвращал planner, слал TALK_END).
- **Фикс:** гейт слит с target — компонент живёт, пока NPC существует и фаза `free`; по eligibility скрываются только визуальные элементы (маркер/хитбокс); прибытие перепроверяет eligibility и при обязательном событии отменяет открытие с возвратом NPC планировщику (вторая грань бага — вечная пауза planner при прерванном подходе).
- **Regression-тест:** `src/game/FreeNpcChatController.test.tsx` (3 интеграционных через ReactThreeTestRenderer + реальный клик по хитбоксу). **Воспроизведение доказано:** на старом коде 2/3 теста падают, с фиксом — зелёные.

### BUG-02 — Ошибка кат-сцены замораживала NPC и оставляла ghost-актёров (P2, исправлен)
- **Симптом:** если сцена бросала исключение до своих `despawnActor`/`talk(false)`, временные актёры (нарушитель/охранники/аудиторы) оставались ghost-записями в characterStore, а NPC со включённым `TALK_START` застревал в `talking` навсегда (мозг NPC планирует только из settled-состояний).
- **Причина:** `endScene` чистит только визуальную карту актёров; в `finally` Runner'а не было восстановления персонажей.
- **Фикс:** `src/cutscenes/sceneRecovery.ts` — `recoverSceneCharacters(ownedNpcIds)` в `finally` CutsceneRunner: удаляет character-записи эфемерных актёров и закрывает незакрытый TALK_START у игрока/owned-NPC. Идемпотентно; успешные сцены не затрагивает.
- **Regression-тест:** `src/cutscenes/sceneRecovery.test.ts` (3 store-уровневых).

Аудит без находок: `.only/.skip`-тестов нет; formatRubles уже использует математический минус (покрыт тестом); идемпотентность всех side-effect операций подтверждена существующими наборами; двойной клик «Завершить день» безопасен (confirmingEndDay сбрасывается первым вызовом).

**Стабильность:** два последовательных полных `verify` — идентичный результат **779/779 (116 файлов) + build**, flaky нет.

## Глубокий цикл 3 (браузерный E2E + производительность + полировка)

### E2E-набор добавлен (KI-04 закрыт)
- Установлен `@playwright/test`; `playwright.config.ts` собирает production-бандл и поднимает preview (тот же `/api/npc-chat` proxy). Скрипт `npm run test:e2e`. Vitest исключает `e2e/`; артефакты (`test-results/`, `playwright-report/`) в `.gitignore`.
- 6 спецификаций (`e2e/`): boot интро без ошибок; boot 3D-офиса из mid-campaign save с корректным HUD; сохранение переживает reload; `?intro` — durable reset; game-over snapshot виден/переживает reload/рестарт возвращает в интро; success snapshot виден/переживает reload. **Два последовательных прогона — 6/6 зелёных, без flaky.**
- Проверки только через DOM-локаторы (устойчиво к загруженному main-thread в software-рендере). Сид — через `addInitScript` с sentinel (одноразовый, race-free; reload проверяет реальную персистентность; `?intro` не пере-сидируется).

### PERF-01 — R3F не гасил рендер под полноэкранными не-геймплейными экранами (P2, исправлен)
- **Симптом:** интро / «уволены» / game-over / success держат офис в непрерывной симуляции + постобработке за непрозрачным/блюр-фоном; экраны могут висеть неограниченно → впустую жгут CPU/GPU. В software-рендере это заодно насыщало main-thread так, что DOM-экраны не наблюдались (блокировало E2E).
- **Фикс:** `src/game/sceneActivity.ts::isSceneIdle(phase, outcomeStatus)` → `<Canvas frameloop={sceneIdle ? 'demand' : 'always'}>`. Геймплей (free/cutscene/minigame/pending) рендерит непрерывно. Визуально без изменений (скриншот интро подтверждён). Unit-тест `sceneActivity.test.ts`; E2E терминальных экранов доказывает наблюдаемость.

### BUG-03 — Leva dev-панель попадала в production (P2, исправлен)
- **Симптом:** игроки видели панель разработчика «Render» (слайдеры exposure/aoIntensity/bloomIntensity) в правом верхнем углу; её DOM был источником ложного «undefined» при первичной E2E-проверке.
- **Причина:** `useControls('Render', …)` из `leva` рендерит панель и в production-сборке.
- **Фикс:** `<Leva hidden={!import.meta.env.DEV} />` — панель скрыта в production, значения остаются на дефолтах (внешний вид не меняется). E2E-ассерт `getByText('aoIntensity')` → count 0 в production. Скриншот до/после подтверждает.

## Исправленные дефекты
- **P0/P1 в игре — не найдено.**
- Исправлен 1 дефект тестовой оснастки (не игры): campaign simulator оставлял `cutsceneStore.activeSceneId` между прогонами (нет `CutsceneRunner` вне React) → ложный блокер `cutscene-running`. Исправлено сбросом cutscene-store в harness.
- Задокументированы P2-наблюдения по балансу (см. `15-balance-report.md` и `15-known-issues.md`) — без изменения constants (по §12/§29).

## Итоговый verdict
**READY WITH KNOWN ISSUES.**

Ядро кампании технически стабильно и логически согласовано: единый `verify` зелёный (typecheck + 769 тестов + build), победа достижима с Ильёй и без, победа после одной серьёзной ошибки доказана, все четыре поражения достижимы, ledger сходится, event-priority и мьютекс win/loss протестированы, миграции/reset проверены, секрет DeepSeek не утекает, fallback работает. Открытые пункты — интерактивные проверки (полная браузерная E2E-матрица на 3 разрешениях, 30-мин soak, live DeepSeek smoke, ручные RUN-01–10) и P2-наблюдения по балансу — перечислены как принятые known issues; P0/P1 отсутствуют.
