# Feature 18H — синхронизация групповых сцен, живая офисная жизнь и калибровка масштаба

## Назначение

Feature 18H исправляет проблемы, обнаруженные после визуального production pass Feature 18A–18G:

- участники планёрки находятся в разных местах;
- персонаж может уйти до того, как камера закончит переход;
- камера иногда показывает пустой кадр;
- собеседники не выглядят как единая группа;
- эмоции и реакции слушателей недостаточно заметны;
- диалоговое окно закрывает головы;
- масштаб персонажа меняется при переходе в dialogue/cinematic state;
- NPC слишком долго стоят и разговаривают;
- обычная офисная жизнь выглядит однообразно;
- размеры мебели, сидений и интерактивных точек не всегда согласованы с реальными размерами моделей.

Feature 18H не меняет сюжет, choices, игровой баланс, дедлайны, риски и последствия Feature 01–17.

Главная цель:

> Персонажи должны действительно находиться в одной сцене, смотреть друг на друга, реагировать, оставаться в кадре и после разговора естественно возвращаться к разнообразной офисной жизни.

---

# Порядок выполнения

Feature 18H выполняется в четыре волны:

1. **Wave 1 — исправление групповых сцен и камеры**;
2. **Wave 2 — scale, мебель, сидение и interaction anchors**;
3. **Wave 3 — ambient office activities и новые анимации**;
4. **Wave 4 — полная проверка, performance и visual QA**.

Нельзя начинать Wave 3, пока камера продолжает смотреть в пустоту, а персонажи меняют масштаб.

После каждой волны обязательны:

- screenshots или video capture;
- узкие тесты;
- integration/E2E-проверка;
- performance check;
- ручная визуальная приёмка.

---

# 1. Аудит фактической реализации

Перед изменением кода Claude Code должен найти и изучить:

- sprint kickoff и другие групповые диалоги;
- существующий Cinematic Director;
- shot catalog;
- camera transitions;
- NPC planner;
- activity claims;
- meeting points и dialogue positions;
- animation state machine;
- look-at и emotion presets;
- subtitle/dialogue UI;
- transform hierarchy моделей;
- scale, root bone и animation tracks;
- seat anchors;
- workstation anchors;
- кофемашину;
- пинг-понг-стол;
- турник;
- текущую интеграцию Higgsfield;
- approved character rigs и skeletons;
- существующие tests и visual captures.

Перед изменениями вернуть:

```md
## Аудит Feature 18H

| Область | Текущее состояние | Найденная причина | План исправления |
|---|---|---|---|

## Создаваемые файлы

## Изменяемые файлы
```

После анализа сразу начать реализацию.

Не ждать дополнительного подтверждения между аудитом и Wave 1.

---

# 2. Единый жизненный цикл групповой сцены

Создать или доработать узкий lifecycle групповых сцен.

Рекомендуемая последовательность:

```text
scene requested
→ зарезервировать scene ownership
→ остановить конфликтующие ambient activities
→ освободить старые claims
→ зарезервировать meeting slots
→ направить участников к slots
→ дождаться готовности обязательных участников
→ выровнять position/rotation/look-at
→ выбрать валидный shot
→ завершить camera transition
→ начать реплику
→ проиграть эмоции и реакции
→ завершить диалог
→ вернуть gameplay camera
→ освободить meeting slots
→ вернуть NPC planner
```

Сцена не должна начинать первую реплику, пока:

- обязательные участники не достигли позиции;
- участники не повернулись к группе;
- camera target не существует;
- камера не завершила переход;
- subtitle safe area не рассчитана.

Не решать синхронизацию произвольными наборами `setTimeout`.

Использовать явные promises/state transitions или существующий Director API.

---

# 3. Meeting slots

Для каждой групповой сцены определить явные позиции.

Для sprint kickoff минимум:

```text
meeting-slot-player
meeting-slot-sonya
meeting-slot-kirill
meeting-slot-alina
meeting-slot-ilya
```

Каждый slot хранит:

```ts
export type CinematicMeetingSlot = {
  id: string;
  position: [number, number, number];
  facing: [number, number, number];
  required: boolean;
  minSeparationMeters: number;
  preferredShotSide?: "left" | "right" | "center";
};
```

Требования:

- slots не пересекаются;
- персонажи не стоят друг в друге;
- персонажи не перекрывают whiteboard;
- участники не блокируют игрока после сцены;
- slots не находятся внутри мебели;
- камера имеет безопасные линии обзора;
- optional участник Илья используется только при hire record;
- scale персонажа не зависит от slot;
- slot не создаёт новый экземпляр NPC.

Если slot недоступен:

1. использовать заранее определённый fallback slot;
2. затем ближайшую проверенную safe position;
3. optional участника можно исключить из сцены;
4. обязательного участника нельзя молча удалить.

---

# 4. Barrier готовности участников

Добавить функцию или эквивалент:

```ts
awaitParticipantsReady(sceneId, participantIds)
```

Участник считается готовым, когда:

- существует;
- не участвует в другой blocking scene;
- достиг slot с допустимым position tolerance;
- достиг rotation tolerance;
- locomotion завершена;
- animation state переведён в cinematic-ready;
- canonical scale сохранён;
- look-at target назначен.

Разумный timeout допустим только как защита от navigation failure.

При timeout:

- записать диагностическую причину;
- использовать safe fallback;
- не запускать камеру на отсутствующего target;
- не создавать duplicate actor;
- не зависать бесконечно.

---

# 5. Синхронизация камеры и реплик

Каждый cinematic shot должен иметь состояние:

```text
requested
→ validating
→ transitioning
→ settled
→ speaking
→ reaction
→ completed
```

Реплика начинается только в состоянии `settled`.

Переход камеры считается завершённым, когда:

- camera position достигла tolerance;
- camera look-at направлен на актуальный target;
- target существует и находится внутри safe frame;
- прошло короткое контролируемое settle-время;
- dialogue UI готов.

Персонажу запрещено покидать cinematic slot:

- во время своей реплики;
- во время reaction shot на его реплику;
- пока Director не завершил сцену.

После завершения реплики персонаж остаётся на месте до конца групповой сцены, если shot list явно не содержит blocking movement.

Камера не должна пытаться догонять NPC, который уже вернулся в planner.

---

# 6. Camera target validation и fallback

Перед каждым shot проверить:

- target существует;
- target видим;
- target не находится внутри стены;
- target не покинул cinematic ownership;
- face/head anchor валиден;
- projected bounding box попадает в safe frame;
- camera path не пересекает геометрию.

Если target невалиден:

- не показывать пустую позицию;
- переключиться на безопасный group shot;
- использовать последнюю валидную композицию;
- продолжить диалог только после подтверждения fallback shot.

Для каждой групповой сцены обязателен минимум один:

```text
safe-wide-group-shot
```

Он должен показывать всех реально присутствующих участников.

---

# 7. Эмоции и реакция группы

Во время планёрки персонажи должны выглядеть как участники разговора.

## Говорящий

- поворачивает голову и верх корпуса к группе;
- использует emotion preset, заданный репликой;
- применяет подходящий talk gesture;
- не смотрит постоянно в камеру;
- не начинает уходить до конца сцены.

## Слушатели

Используют короткие реакции:

```text
neutral-listening
focused-listening
concerned-listening
nod
small-head-shake
thinking
surprised-reaction
controlled-frustration
relieved-reaction
look-at-whiteboard
look-at-speaker
```

Реакция выбирается по metadata реплики, а не случайно.

Пример:

```ts
export type DialoguePerformanceCue = {
  speakerEmotion: CharacterEmotion;
  speakerGesture?: DialogueGesture;
  listenerReaction?: ListenerReaction;
  focusTarget?: "speaker" | "whiteboard" | "player" | "object";
};
```

Не добавлять raw morph names в dialogue scripts.

---

# 8. Safe area диалогового UI

Диалоговое окно и subtitles не должны закрывать головы.

Для cinematic режима определить:

```text
character-safe-area
subtitle-safe-area
choice-safe-area
```

Перед запуском shot:

- спроецировать head anchors в screen space;
- проверить пересечение с dialogue panel;
- при конфликте изменить framing;
- при необходимости выбрать левую/правую layout variation;
- для короткой реплики использовать компактный subtitle layout;
- не уменьшать персонажа через scale.

Требования:

- головы и глаза не закрываются UI;
- choices не перекрывают участников;
- на 1366×768 сохраняется читаемость;
- на 1920×1080 и 2560×1440 композиция не разваливается;
- safe area учитывает browser viewport и UI scale;
- обычный gameplay HUD скрывается во время blocking scene.

---

# 9. Исправление изменения масштаба персонажей

Изменение размера NPC при переходе в dialogue/cinematic является P1 visual bug.

Провести диагностику:

- scale tracks в animation clips;
- root bone scale;
- nested model wrappers;
- повторное применение character scale;
- scale cinematic actor container;
- clone/portal hierarchy;
- восстановление transform после planner;
- разный unit conversion между gameplay и cinematic.

## Canonical scale

Для каждого персонажа использовать единственный canonical transform:

```ts
export type CharacterCanonicalTransform = {
  characterId: string;
  scale: [number, number, number];
  modelHeightMeters: number;
  rootOffsetMeters: number;
};
```

Правила:

- камера приближается к персонажу, а не увеличивает модель;
- cinematic wrapper всегда имеет scale `[1, 1, 1]`;
- character scale применяется один раз в корневом model component;
- animation clip с неожиданным scale track отклоняется или безопасно нормализуется в asset pipeline;
- после сцены scale не восстанавливается «примерно», а остаётся canonical;
- scale не сериализуется как временное cinematic состояние.

Regression assertion:

```text
scale before scene
=== scale during scene
=== scale after scene
```

с небольшим floating-point tolerance.

---

# 10. Калибровка персонажей, мебели и интерактивных объектов

Провести отдельный scale audit всей мебели, с которой взаимодействуют персонажи.

Обязательные объекты:

- кресло руководителя;
- рабочие кресла;
- стулья переговорной;
- барные стулья;
- диваны;
- рабочие столы;
- стол переговорной;
- кофемашина и кухонная стойка;
- пинг-понг-стол;
- турник;
- whiteboard;
- серверные стойки;
- дверные проёмы.

Создать:

```text
docs/art/18h-character-environment-scale-audit.md
```

Для каждого объекта указать:

- фактические world dimensions;
- относительно какого персонажа проверено;
- interaction pose;
- seat/hand/foot/look anchors;
- найденный clipping;
- исправление;
- результат повторной проверки.

## Базовое правило единиц

Сначала подтвердить фактическое соотношение world units и метров в проекте.

Не менять глобальный масштаб сцены без крайней необходимости.

Ориентиры можно использовать только как стартовую проверку:

- обычное сиденье: примерно 0.43–0.48 м от пола;
- рабочий стол: примерно 0.72–0.76 м;
- кухонная стойка: примерно 0.88–0.95 м;
- пинг-понг-стол: около 0.76 м высотой;
- турник: над головой персонажа с запасом для полного движения.

Финальное решение должно учитывать реальный skeleton и approved proportions игровых моделей.

---

# 11. Interaction anchors и contact points

Для интерактивной мебели использовать явные anchors:

```ts
export type InteractionAnchorSet = {
  approach: Transform;
  root: Transform;
  leftHand?: Transform;
  rightHand?: Transform;
  leftFoot?: Transform;
  rightFoot?: Transform;
  hips?: Transform;
  lookAt?: Transform;
  exit?: Transform;
};
```

Не корректировать посадку изменением общего scale модели.

Использовать:

- seat anchor;
- hip offset;
- foot placement;
- hand targets;
- look target;
- exit position;
- collision-safe approach point.

## Требования к сидению

- таз находится над сиденьем;
- ноги не проходят через стол;
- ступни не висят без причины;
- спина не находится внутри спинки;
- руки не проходят сквозь стол;
- персонаж не проваливается в диван;
- stand-up заканчивается вне мебели;
- камера не входит в голову;
- разные поддерживаемые модели проверены отдельно.

## Требования к активностям

### Кофемашина

- рука достигает кнопки/кружки;
- кружка не висит отдельно от кисти;
- персонаж не стоит внутри стойки;
- подход не блокирует дверь кухни.

### Пинг-понг

- ракетка находится в руке;
- руки не проходят через стол;
- игроки стоят по разные стороны;
- высота стола соответствует модели;
- мяч не проходит через тело;
- игровые slots не блокируют проход.

### Турник

- руки действительно достигают перекладины;
- ступни не находятся внутри пола;
- верх головы не проходит через потолок;
- амплитуда соответствует высоте перекладины;
- exit pose возвращает NPC на navmesh.

---

# 12. Роль Higgsfield в новых анимациях

Claude Code должен изучить реально подключённые Higgsfield tools и использовать их для разнообразия офисной жизни.

Разрешено:

- генерировать motion references;
- генерировать pose sequences;
- генерировать storyboard/keyframes для активности;
- генерировать video reference с approved character identity;
- использовать доступный direct animation export только если он реально поддерживает совместимый skeleton/format;
- создавать варианты движения для последующего retargeting;
- сохранять prompts и параметры.

Нельзя:

- считать MP4 готовым игровым animation clip;
- импортировать animation без проверки skeleton compatibility;
- менять лицо, одежду или пропорции персонажа;
- использовать generated clip с scale tracks;
- импортировать водяные знаки;
- печатать API-key;
- придумывать недоступные Higgsfield команды.

Если Higgsfield не выдаёт совместимый animation format:

1. использовать результат как motion reference;
2. воспроизвести/ретаргетить движение в существующем animation pipeline;
3. проверить root motion, scale и skeleton;
4. зарегистрировать итоговый production clip.

Создать:

```text
docs/art/ambient-office-animation-library.md
docs/art/higgsfield-ambient-motion-prompts.md
```

Для каждого результата хранить:

- activity id;
- tool/model;
- prompt;
- approved character reference;
- source file;
- retarget notes;
- final clip;
- skeleton;
- duration;
- loop/one-shot;
- production status.

---

# 13. Ambient Office Activity Planner

Не создавать полностью отдельную систему жизни офиса.

Расширить существующий NPC planner новым типом:

```text
ambient-office-activity
```

Приоритет остаётся:

```text
blocking story scene
→ mandatory dialogue
→ urgent work/security task
→ normal work activity
→ ambient office activity
→ idle
```

Ambient activity никогда не должна:

- блокировать сюжет;
- отменять рабочую задачу;
- двигать игровой день;
- менять бюджет;
- менять morale, если такой механики нет;
- создавать новый gameplay outcome;
- продолжаться бесконечно.

---

# 14. Набор ambient activities

Обязательный минимум:

## Кофе

```text
walk-to-coffee
→ reserve coffee slot
→ brew
→ take cup
→ drink
→ optional short comment
→ return cup / finish
→ release slot
→ planner
```

## Пинг-понг

Поддержать:

- короткую solo practice-анимацию;
- короткий two-person rally;
- подачу;
- 3–6 обменов;
- короткую реакцию;
- завершение и возврат к planner.

Это не мини-игра и не спортивный симулятор.

## Турник

```text
walk-to-bar
→ reserve slot
→ mount
→ 2–5 pull-ups
→ controlled release
→ short recovery
→ planner
```

## Дополнительные активности

Добавить минимум три из списка:

- взять воду;
- посмотреть в окно;
- проверить телефон;
- полить растение;
- почитать документ;
- коротко посидеть на диване;
- пройти к whiteboard и посмотреть план;
- взять документ с полки;
- коротко поговорить у кофемашины.

---

# 15. Не делать офисную жизнь чрезмерно заскриптованной

Не задавать жёсткий сценарий вида:

```text
день 2, 10:00 — кофе
день 2, 10:30 — теннис
```

Использовать контролируемый выбор на основе:

- доступности NPC;
- текущего приоритета работы;
- свободного activity slot;
- recent activity history;
- cooldown;
- дневного лимита;
- присутствия второго участника;
- distance/path availability;
- deterministic daily seed, если в проекте уже принят такой подход.

Рекомендуемое состояние:

```ts
export type AmbientActivityHistory = {
  characterId: string;
  recentActivityIds: string[];
  completedToday: number;
  lastCompletedWorkdayId?: string;
  cooldowns: Record<string, number>;
};
```

Не создавать сложную симуляцию потребностей, голода, энергии и отношений.

---

# 16. Ограничения частоты и длительности

Офис должен быть живым, но сотрудники должны преимущественно работать.

Базовые ограничения вынести в config:

```ts
export const AMBIENT_OFFICE_BALANCE = {
  maxActivitiesPerNpcPerWorkday: 2,
  maxConcurrentAmbientActivities: 2,
  maxConcurrentSocialActivities: 1,
  activityCooldownBeats: 3,
  repeatedActivityCooldownBeats: 6,
  shortActivityDurationSeconds: [8, 20],
  socialActivityDurationSeconds: [15, 35],
  pingPongMaxRallies: 6,
  pullUpRepetitions: [2, 5],
} as const;
```

Значения можно минимально скорректировать после реального теста.

Не изменять их из React-компонентов.

NPC не должен:

- сразу повторять ту же активность;
- весь день пить кофе;
- постоянно играть в теннис;
- постоянно подтягиваться;
- собираться всей командой в одном месте;
- начинать ambient activity перед обязательной сценой.

---

# 17. Two-person activity coordination

Для пинг-понга и короткого разговора использовать парный reservation flow:

```text
find compatible participants
→ reserve both NPCs atomically
→ reserve activity slots
→ navigate
→ readiness barrier
→ start animation
→ finish
→ release both NPCs and slots
```

Если второй участник не найден:

- использовать solo practice, если предусмотрено;
- либо отказаться от активности;
- не оставлять первого NPC в вечном ожидании.

Пара не должна включать NPC, который:

- нужен в story scene;
- выполняет urgent task;
- участвует в DeepSeek-разговоре;
- уже имеет blocking claim;
- отсутствует из-за hire state.

---

# 18. Завершение ambient activity

Каждая активность должна иметь явный terminal state.

После завершения:

- animation action останавливается;
- props очищаются или возвращаются;
- look-at очищается;
- emotion override очищается;
- activity claim освобождается;
- partner claim освобождается;
- временный мяч/кружка/ракетка не дублируется;
- NPC возвращается в planner;
- canonical scale сохраняется;
- NPC оказывается на navmesh.

Reload:

- running ambient activity можно безопасно нормализовать в `not-started` или `returning`;
- не создавать второй prop;
- не применять игровые effects;
- не оставлять занятые slots.

---

# 19. Анимации ambient activities

Подготовить или улучшить clips:

## Кофе

- press-machine;
- take-cup;
- drink-standing;
- short-cup-hold;
- put-down-cup.

## Пинг-понг

- ready stance;
- forehand;
- backhand;
- serve;
- short step left/right;
- miss/reaction;
- celebrate-small;
- reset stance.

## Турник

- approach-ready;
- reach-and-grab;
- pull-up-loop;
- controlled-drop;
- recover-standing.

## Бытовые

- phone-check;
- window-look;
- document-read-standing;
- sofa-sit-short;
- plant-water;
- whiteboard-glance.

Требования:

- compatible skeleton;
- no scale tracks;
- no root drift beyond designed movement;
- clean crossfade;
- hand/foot contact проверен;
- animation duration согласована с planner;
- props синхронизированы с clip events;
- loops имеют чистые границы;
- performance приемлема.

---

# 20. Props и синхронизация событий анимации

Использовать animation events/markers или существующий эквивалент:

```text
coffee-cup-attach
coffee-cup-detach
paddle-attach
ball-serve
ball-hit
pullup-grab
pullup-release
```

Не создавать props по случайному таймеру, не связанному с animation state.

Требования:

- prop прикрепляется к правильной кости;
- не создаётся второй экземпляр;
- удаляется при cancel/reload/reset;
- не остаётся в руке после activity;
- visual event не влияет на gameplay math.

---

# 21. Performance

Перед Wave 3 зафиксировать baseline:

- FPS в open space;
- FPS в игровой зоне;
- animation mixers;
- active actions;
- scene objects;
- HTML overlays;
- draw calls;
- memory.

После добавления activities повторить измерение.

Не допускать:

- отдельный mixer для каждого prop без необходимости;
- создание Vector3/Quaternion каждый frame;
- глобальный Zustand update для каждой фазы animation frame;
- постоянные occlusion raycasts для далёких NPC;
- работу ambient planner при hidden tab;
- накопление actions/listeners/timers.

Quality presets могут ограничивать:

- число одновременно активных ambient NPC;
- дальность speech bubbles;
- детализацию props;
- частоту planner updates.

---

# 22. Обязательные unit-тесты

## Group scenes

1. meeting slots уникальны;
2. обязательные участники должны быть ready;
3. optional Илья отсутствует без hire;
4. сцена не начинает реплику до camera settled;
5. участник не покидает slot во время реплики;
6. invalid target выбирает safe group shot;
7. scene cleanup освобождает slots;
8. planner восстанавливается.

## Scale

9. canonical scale не меняется при scene ownership;
10. dialogue wrapper имеет unit scale;
11. clip с scale track обнаруживается;
12. reload не меняет scale;
13. разные персонажи сохраняют собственный canonical scale.

## Furniture

14. seat anchor существует для каждого интерактивного сиденья;
15. approach/exit anchors не находятся внутри collision bounds;
16. player-only CEO chair сохраняет ограничение;
17. ping-pong slots находятся на разных сторонах;
18. pull-up hand target выше shoulder target.

## Ambient planner

19. story priority блокирует ambient;
20. work priority блокирует ambient;
21. cooldown предотвращает повтор;
22. дневной лимит работает;
23. concurrent limit работает;
24. pair reservation атомарна;
25. timeout освобождает claims;
26. reload очищает running activity;
27. reset очищает history/props;
28. ambient activity не двигает workday.

---

# 23. Integration-тесты высокой ценности

## GS-01 Планёрка

```text
start sprint
→ reserve meeting slots
→ all actors arrive
→ camera settles
→ dialogue with reactions
→ no actor leaves early
→ camera returns
→ planner resumes
```

## GS-02 Camera fallback

```text
speaker target becomes invalid
→ empty frame prevented
→ safe group shot selected
→ dialogue continues
→ scene completes
```

## GS-03 Scale invariant

```text
planner
→ group dialogue
→ close-up shot
→ ambient activity
→ planner
```

На всех шагах scale одинаков.

## GS-04 Reload scene

```text
reload while gathering
→ no duplicate NPC
→ slots restored or safely restarted
→ scene completes once
```

## AO-01 Coffee

```text
NPC free
→ coffee selected
→ slot reserved
→ cup attached
→ drink
→ cup removed
→ claim released
→ work resumes
```

## AO-02 Ping-pong

```text
two compatible NPCs
→ atomic reservation
→ both arrive
→ 3–6 rallies
→ reaction
→ props cleanup
→ both return to planner
```

## AO-03 Pull-ups

```text
NPC free
→ bar reserved
→ hands reach bar
→ 2–5 repetitions
→ safe release
→ navmesh return
```

## AO-04 Priority interruption

```text
ambient activity pending
→ mandatory story scene appears
→ ambient cancels safely
→ story scene starts
→ props/claims clean
```

## AO-05 Soak

```text
multiple workdays
→ work + coffee + ping-pong + pull-ups
→ no accumulating claims
→ no duplicate props
→ no stuck NPC
→ no scale drift
```

---

# 24. E2E и visual regression

Добавить E2E минимум для:

1. sprint kickoff с полным составом;
2. sprint kickoff без Ильи;
3. камера не показывает пустой кадр;
4. головы не перекрыты dialogue panel;
5. scale до/после сцены визуально одинаков;
6. NPC расходятся только после завершения сцены;
7. кофе;
8. парный пинг-понг;
9. турник;
10. story scene прерывает ambient activity;
11. reload во время групповой сцены;
12. reload во время ambient activity;
13. resolution 1366×768;
14. resolution 1920×1080;
15. resolution 2560×1440.

Visual screenshots делать в устойчивых контрольных состояниях.

Не использовать слишком строгий pixel-perfect threshold для динамических теней и мелких facial motions.

---

# 25. Ручная приёмка

## Сценарий 1. Планёрка

1. Запустить новый спринт.
2. Наблюдать сбор команды.
3. Убедиться, что все стоят рядом и не пересекаются.
4. Убедиться, что первая реплика начинается после прибытия камеры.
5. Проверить взгляд говорящего и реакции слушателей.
6. Проверить, что никто не уходит до конца сцены.
7. Проверить, что камера не показывает пустые места.
8. Проверить, что головы не закрыты UI.
9. Проверить неизменность масштаба.
10. Проверить естественный возврат к работе.

## Сценарий 2. Кофе

1. Дождаться свободного NPC.
2. Проверить естественный выбор активности.
3. Проверить подход, кружку, руки и стойку.
4. Убедиться, что NPC не стоит внутри мебели.
5. Убедиться, что активность короткая.
6. Проверить возврат к работе.

## Сценарий 3. Пинг-понг

1. Дождаться двух свободных NPC.
2. Проверить резервирование двух сторон стола.
3. Проверить ракетки, мяч и контакт рук.
4. Проверить короткий rally и реакции.
5. Убедиться, что игра не продолжается бесконечно.
6. Проверить освобождение игровой зоны.

## Сценарий 4. Турник

1. Дождаться свободного NPC.
2. Проверить высоту перекладины.
3. Проверить контакт рук.
4. Проверить отсутствие clipping головы/потолка.
5. Проверить 2–5 повторений.
6. Проверить безопасное возвращение на пол и navmesh.

## Сценарий 5. Мебель

Проверить каждого постоянного персонажа:

- в рабочем кресле;
- в кресле руководителя для игрока;
- на стуле переговорной;
- на диване;
- у кофемашины;
- у пинг-понг-стола;
- у турника;
- у whiteboard;
- у server rack.

Зафиксировать screenshots проблем и результатов.

## Сценарий 6. Длительная офисная жизнь

Играть/наблюдать минимум 20–30 минут:

- NPC преимущественно работают;
- иногда выполняют короткие бытовые активности;
- не повторяют одно и то же постоянно;
- не стоят бесконечно в разговоре;
- не застревают;
- не увеличиваются;
- props не накапливаются;
- обязательные сцены всегда имеют приоритет.

---

# 26. Документы

Создать или обновить:

```text
docs/art/18h-character-environment-scale-audit.md
docs/art/ambient-office-animation-library.md
docs/art/higgsfield-ambient-motion-prompts.md
docs/qa/18h-group-scene-test-matrix.md
docs/qa/18h-ambient-office-life-report.md
docs/qa/18h-visual-performance-report.md
docs/qa/18h-known-issues.md
```

Для каждой generated animation/reference указать:

- source;
- Higgsfield tool/model;
- prompt;
- approved character reference;
- production clip path;
- compatibility result;
- status.

---

# 27. Что запрещено

Не делать:

- новую сюжетную ветку;
- новые choices;
- новую игровую валюту;
- morale/energy/hunger simulation;
- отдельную систему отношений;
- реальное время как источник workday;
- бесконечные случайные диалоги;
- постоянную игру NPC в теннис;
- телепортацию персонажей в видимой части кадра без fallback-необходимости;
- изменение scale ради крупного плана;
- изменение пропорций approved character models;
- импорт несовместимого animation clip;
- использование MP4 вместо интерактивной 3D-анимации;
- изменение положения whiteboard;
- изменение gameplay balance;
- утечку Higgsfield key;
- `git push`.

---

# 28. Критерии завершения

Feature 18H считается завершённой только если:

- участники планёрки собираются в согласованные позиции;
- первая реплика начинается после готовности участников и камеры;
- камера не показывает пустой кадр;
- персонажи не уходят во время реплики;
- участники смотрят друг на друга;
- слушатели имеют заметные, но не чрезмерные реакции;
- dialogue UI не закрывает головы;
- scale персонажей неизменен;
- кресла, столы и интерактивные объекты согласованы с approved model sizes;
- посадка не имеет заметного clipping;
- кофе, пинг-понг и турник реально работают в planner;
- новые анимации интегрированы в совместимый skeleton;
- Higgsfield assets/references зарегистрированы;
- ambient activities короткие и не чрезмерно заскриптованы;
- работа остаётся главным поведением NPC;
- story scenes имеют приоритет;
- reload/reset не оставляют claims, props и invalid poses;
- soak test не показывает накопительных утечек;
- tests/E2E/build проходят.

---

# 29. Финальный ответ Claude Code

```md
## Итог Feature 18H

## Аудит исходных проблем

## Синхронизация групповых сцен

## Meeting slots и readiness barrier

## Исправление камеры

## Эмоции и реакции

## Safe area диалогового UI

## Исправление scale bug

## Калибровка мебели и персонажей

| Объект | Проблема | Исправление | Результат |
|---|---|---|---|

## Higgsfield и новые анимации

| Activity | Source/tool | Final clip | Skeleton compatibility |
|---|---|---|---|

## Ambient Office Activity Planner

## Кофе

## Пинг-понг

## Турник

## Дополнительные офисные активности

## Производительность до и после

## Результат soak test

## Добавленные тесты

## E2E и visual regression

## Созданные файлы

## Изменённые файлы

## Выполненные команды

## Production build

## Оставшиеся проблемы

## Git status
```

Не объявлять Feature 18H готовой, если камера всё ещё смотрит в пустоту, персонажи меняют масштаб, мебель клиппится или ambient activities оставляют NPC в зависшем состоянии.
