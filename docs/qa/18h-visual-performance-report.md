# 18H — Visual performance report (факт 2026-07-27)

Среда измерения: headless SwiftShader (софтверный рендер) — честные FPS/frame
time НЕ измеримы, тот же принцип, что в `18-visual-performance-report.md`.
Ниже — детерминированные метрики + код-ревью против §21's «не допускать»
список, поскольку 18H добавил реальный per-frame код (ping-pong swing,
phone-check pose), которого не было в 18G.

## Метрики (детерминированные)

| Метрика | Значение |
|---|---|
| Новые GLB-ассеты (5× pullUp.glb) | 210.8 КБ суммарно (36-84 КБ на файл) |
| Bundle (production, gzip) | 2 142.85 КБ / 635.61 КБ gzip (+0.75 КБ/0.31 КБ gzip к 18G — код, не ассеты) |
| Mixers | по-прежнему 1 на персонажа (`useAnimations`) — новый клип (`pullUp`) добавляет запись в существующий mixer, не новый mixer |
| Props без mixer | mug/paddle/phone — статичная geometry+material, `useEffect`-gated attach/dispose, ни один не создаёт `AnimationMixer` |
| Новые per-frame циклы | 2: ping-pong swing (`useCharacterPerformance.ts`), phone-check pose (тот же hook) — оба ветвятся внутри уже существующего `useFrame`, не добавляют новый `useFrame`-регистрацию |
| Новые `setInterval` | 1: `pingPongMatchmaker.ts`, период 5000мс (не per-frame) |

## Код-ревью против §21 «не допускать»

| Правило | Статус | Где проверено |
|---|---|---|
| Vector3/Quaternion аллокация каждый кадр | ✓ чисто | ping-pong swing и phone-check pose — только скалярная тригонометрия (`Math.sin`) и прямая мутация `bone.rotation.x`, без `new Vector3()`/`new Quaternion()` внутри `useFrame` |
| Отдельный mixer на каждый prop | ✓ чисто | mug/paddle/phone — plain `Group`+`Mesh`, ноль `AnimationMixer` |
| Глобальный Zustand `set()` на каждую фазу анимации | ✓ чисто | `useCharacterPerformance.ts` внутри `useFrame` только читает (`.getState()`), не пишет; `pingPongMatchmaker`/`Npcs.tsx` пишут в store только на границах активности (start/end), не покадрово |
| Постоянные occlusion raycasts | н/п | 18H не добавляет raycast-логику |
| Работа ambient planner при hidden tab | не идеально, но не регрессия | `setInterval`(5с) и `setTimeout`-цепочки NPC-planner продолжают тикать в фоновой вкладке (браузер троттлит, не останавливает) — то же поведение, что у ВСЕХ существующих NPC-таймеров с Feature 04/16, 18H не меняет этот класс поведения |
| Накопление actions/listeners/timers | ✓ проверено | все новые `setTimeout`/`setInterval`/`store.subscribe()` имеют парную очистку (`clearTimeout`/`clearInterval`/`unsubscribe()`) — `Npcs.test.ts` и `pingPongMatchmaker.test.ts` используют `vi.useFakeTimers()` и проверяют полный цикл включая освобождение |

## Найденная и исправленная латентность (не строго §21, но по духу того же раздела)

`cinematic.ready` (`cinematicDirector.ts`) — обёртка `flyTo`/`camera-controls.setLookAt()`
— под headless software-рендером сходилась за **~8.25с** вместо номинальных
~1.1с (замерено таймингом в живом E2E-прогоне, не догадка). Добавлен
`READY_TIMEOUT_MS=3500` (`withReadyTimeout`) — та же «reasonable timeout as a
failure guard» логика, что уже была у `GATHER_TIMEOUT_MS`/`ARRIVAL_TIMEOUT_MS`
в этой же фиче, применена к единственному месту, где её раньше не было.
Устраняет как P1-баг в E2E (см. `18h-known-issues.md`), так и теоретический
риск для игроков с низким FPS в реальном браузере.

## Adaptive quality (§21, по живому отзыву «хочу плавную игру», 2026-07-27)

Production скрывает dev-панель качества (`Leva hidden`) — у игрока НЕ БЫЛО
ни одного рычага против низкого FPS, дефолтный tier `high` (AO + DPR 1.5 +
тени) применялся к любой машине. Добавлен `AdaptiveQuality`
(src/scene/adaptiveQuality.ts) внутри Canvas:

- окно 4с усредняет реальный FPS (не разовый кадр), первые 10с после
  (ре)маунта игнорируются (шейдеры/декод);
- < 45 fps → tier вниз на шаг (до low); > 58 fps три окна подряд →
  осторожно вверх (гистерезис), но не выше `high` — cinematic остаётся
  ручным выбором;
- переключение tier ремоунтит Canvas (key=tier), что само перезапускает
  warmup — решения не каскадируют;
- скрытая вкладка не сэмплируется (rAF-троттлинг дал бы ложный «низкий FPS»);
- решение логируется в консоль (`[adaptive-quality] N fps on 'high' ->
  switching to 'medium'`).

Чистая решающая функция `nextAdaptiveTier` покрыта юнит-тестами (вниз/пол/
гистерезис вверх/потолок). Замер «до/после» на целевой машине остаётся за
ручным прогоном (headless не показателен — см. ниже), но механизм гарантирует
сходимость к плавности: каждая ступень строго дешевле предыдущей
(§18E-пресеты), а нижняя (low: DPR 1, без теней/AO/post, без NPC-performance
слоя) — минимальный рендер сцены.

## Невыполненное честно

- FPS/frame-time/GPU-память в headless не показательны (как в 18G) — нужен
  ручной прогон на целевой машине.
- Не проверены `playInsert`/другие `flyTo`-вызовы (кроме `ready`) на тот же
  класс медленной сходимости под низким FPS — `cinematic.ready` был
  единственным ПОДТВЕРЖДЁННЫМ регрессом, остальные вызовы не блокируют
  обязательную реплику так же жёстко (§5 требование конкретно про `ready`),
  поэтому не были в скоупе этого фикса. Задокументировано как открытый риск,
  не как исправленный баг.
- Реальный 20–30-минутный soak (память/накопление за долгую сессию) — не
  проведён, см. `18h-ambient-office-life-report.md`.
