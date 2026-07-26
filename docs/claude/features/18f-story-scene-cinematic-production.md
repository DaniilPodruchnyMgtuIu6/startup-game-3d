# Feature 18F — cinematic production сюжетных сцен

## Цель

Поставить все существующие ключевые сцены по единому стандарту Cinematic Director.

Не менять choices и последствия Feature 01–17.

---

# Порядок волн

## Wave 1 — эталон качества

1. первый kickoff;
2. выбор аудит или Илья;
3. security-breach;
4. office-intrusion;
5. «Утро без проекта»;
6. успешный выпуск.

Каждая сцена должна быть полностью принята до Wave 2.

## Wave 2 — ключевые решения

7. admin access;
8. test data;
9. первый приоритет Ильи;
10. backup/restore;
11. architecture boundary;
12. suspicious activity;
13. release risk decision.

## Wave 3 — остальные сцены

- найм Кирилла;
- найм Алины;
- первое появление Ильи;
- mid-sprint;
- pre-review;
- audit result;
- СКУД;
- server incidents;
- leadership warnings;
- остальные победы/поражения.

---

# Пакет каждой сцены

```text
docs/art/cinematics/{scene-id}/
  scene-brief.md
  shot-list.md
  storyboard/
  approved-keyframes/
  higgsfield-prompts.md
  blocking.md
  lighting.md
  implementation-notes.md
  acceptance.md
```

---

# Обязательный стандарт сцены

- establishing;
- понятное blocking;
- camera на уровне персонажей;
- speaker shot;
- listener reaction;
- important insert;
- choices после общего плана;
- animation performance;
- emotion;
- lighting state;
- subtitles;
- camera fallback;
- cleanup;
- performance result.

---

# Особые сцены

## Security-breach

- actors появляются быстро;
- нет ожидания пустого коридора;
- urgent tracking;
- insert unlocked screen;
- реакция команды;
- кабинет руководителя снят eye-level.

## Office intrusion

- понятное приближение угрозы;
- не top-down;
- различие ветки с Ильёй и без;
- outsider не выглядит постоянным NPC;
- suspense без насилия.

## Утро без проекта

- экраны и пустая папка как inserts;
- close-up Кирилла и Алины;
- холодный свет;
- negative space;
- медленный финальный отъезд.

## Success

- команда;
- OfficeFlow screen;
- reactions;
- светлый visual state;
- финальный широкий shot.

---

# Higgsfield

Для каждой сцены:

- storyboard;
- keyframes;
- camera references;
- lighting references;
- pose references;
- approved prompts.

Не использовать сгенерированные лица, отличающиеся от approved identity.

---

# Visual regression

Для ключевых кадров сделать устойчивые screenshots:

- start;
- important line;
- choice moment;
- ending.

Не использовать чрезмерно строгий pixel-perfect threshold для динамических теней.

---

# Тесты каждой сцены

- normal trigger;
- completion;
- reload before;
- reload during;
- skip если разрешён;
- no duplicate effects;
- planner restore;
- camera restore;
- temporary actors cleanup;
- screenshots;
- performance.

---

# Критерий завершения 18F

- все Wave 1 сцены приняты;
- Wave 2 и Wave 3 соответствуют стандарту;
- нет постоянной верхней камеры;
- персонажи реагируют;
- generated references реально использованы;
- игровая логика не изменилась.
