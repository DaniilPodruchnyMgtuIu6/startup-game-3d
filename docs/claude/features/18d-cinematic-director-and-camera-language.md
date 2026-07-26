# Feature 18D — Cinematic Director и язык камеры

## Цель

Создать единый управляемый слой постановки существующих сюжетных сцен.

Главное изменение: эмоциональные сцены снимаются на уровне персонажей, а не постоянной верхней камерой.

---

# 1. Структура

Рекомендуемо:

```text
src/game/cinematics/
  cinematicDirector.ts
  cinematicCamera.ts
  cinematicShotCatalog.ts
  cinematicBlocking.ts
  cinematicTransitions.ts
  cinematicSelectors.ts
```

Это не универсальный video editor.

---

# 2. Shot types

```ts
type CinematicShotType =
  | 'establishing'
  | 'wide'
  | 'medium'
  | 'medium-close'
  | 'close-up'
  | 'over-the-shoulder'
  | 'two-shot'
  | 'three-shot'
  | 'insert'
  | 'reaction'
  | 'tracking'
  | 'dolly-in'
  | 'dolly-out';
```

Каждая сцена имеет явный shot list.

---

# 3. Запрет постоянной top-down камеры

Важные реплики не снимаются обычной gameplay-камерой сверху.

Top-down допустим только как короткий establishing shot.

Основной язык:

- eye-level;
- over-the-shoulder;
- medium;
- close-up;
- reaction;
- insert;
- group shot.

---

# 4. Правила постановки

## Два персонажа

1. establishing two-shot;
2. OTS первого;
3. reverse OTS;
4. close-up важной реплики;
5. reaction;
6. общий план перед choice.

## Группа

- establishing wide;
- medium group;
- single speaker;
- reactions;
- insert обсуждаемого объекта;
- final group shot.

## Тревога

- более короткие планы;
- мягкий push-in;
- холоднее свет;
- важный insert;
- без чрезмерной тряски.

## Победа

- широкий team shot;
- светлый key;
- screen/whiteboard insert;
- медленный финальный отъезд.

## Поражение

- negative space;
- close-ups;
- холодный свет;
- медленный dolly-out.

---

# 5. Camera safety

Для каждого shot:

- target;
- position;
- FOV/focal feeling;
- look-at;
- safe distance;
- near clipping;
- collision check;
- fallback shot.

Камера не должна:

- проходить через стены;
- входить в голову;
- находиться внутри мебели;
- показывать пустой коридор;
- обрезать глаза/подбородок;
- резко прыгать.

---

# 6. Gameplay transition

```text
gameplay
→ lock input
→ finish short animation
→ hide nonessential HUD
→ cinematic blocking
→ camera blend
→ scene
→ camera blend back
→ restore planner
→ restore input
```

Skip разрешён только там, где безопасен и не дублирует effects.

---

# 7. Storyboard

Для первых трёх эталонных сцен подготовить Higgsfield storyboard/keyframes:

- sprint kickoff;
- audit-or-Ilya choice;
- security-breach.

Создать для каждой:

```text
docs/art/cinematics/{scene-id}/
  scene-brief.md
  shot-list.md
  storyboard/
  approved-keyframes/
  higgsfield-prompts.md
  implementation-notes.md
  acceptance.md
```

---

# 8. UI cinematic mode

Во время сцены:

- скрыть лишний HUD;
- оставить subtitles и speaker name;
- choices показать в правильный момент;
- не закрывать лица;
- блокировать случайные clicks;
- сохранить safe area.

---

# 9. Тесты

- только одна active cinematic;
- shot target существует;
- fallback существует;
- no NaN camera;
- collision fallback;
- reload;
- skip;
- cleanup;
- camera restore;
- planner restore;
- no duplicate effects;
- visual screenshots эталонных сцен.

---

# Критерий завершения 18D

- существует Cinematic Director;
- три эталонные сцены используют новый язык камеры;
- нет постоянной top-down подачи;
- переходы плавные;
- камера безопасна;
- сцены не ломают gameplay.
