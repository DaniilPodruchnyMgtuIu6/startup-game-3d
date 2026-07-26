# Feature 18C — анимации, эмоции и character performance

## Цель

Сделать персонажей живыми: естественная ходьба, работа, разговор, взгляд, эмоции и реакции.

Higgsfield используется как motion/pose reference, если доступно. Итоговые игровые анимации должны работать на реальном skeleton проекта.

---

# 1. Animation audit

Создать `docs/art/animation-library.md`.

Для каждого clip зафиксировать:

- имя;
- назначение;
- skeleton;
- duration;
- looping;
- root motion;
- качество;
- используемые сцены;
- статус.

Удалять или заменять placeholder clips только после проверки всех usages.

---

# 2. Обязательная библиотека

## Locomotion

- idle;
- walk;
- fast walk;
- turn left/right;
- stop;
- sit down;
- seated idle;
- stand up.

## Office

- typing;
- mouse;
- reading screen;
- reading document;
- notes;
- whiteboard;
- server rack;
- phone;
- seated talk;
- standing talk.

## Dialogue

- neutral talk;
- explaining;
- disagreeing calmly;
- open-hand gesture;
- pointing;
- concerned;
- confident;
- thinking;
- listening;
- nod;
- head shake;
- reaction.

## Story

- enter room;
- gather;
- urgent walk;
- stop near player;
- inspect computer;
- bad news reaction;
- missing files reaction;
- security inspection;
- celebration;
- release moment.

---

# 3. Animation state machine

Создать или улучшить централизованную систему:

```text
blocking story scene
→ mandatory dialogue
→ interaction animation
→ office activity
→ locomotion
→ idle
```

Не запускать конфликтующие clips через независимые React effects.

Состояния должны быть serializable настолько, насколько нужно для безопасного reload.

---

# 4. Blending и transitions

Проверить:

- crossfade;
- foot sliding;
- root drift;
- резкий snap;
- зависание последнего кадра;
- возвращение в idle;
- sit/stand;
- turn before walk;
- смену story → planner.

Не решать проблемы произвольными timeout.

---

# 5. Лица и эмоции

Централизовать:

```ts
type CharacterEmotion =
  | 'neutral'
  | 'focused'
  | 'concerned'
  | 'confident'
  | 'surprised'
  | 'angry-controlled'
  | 'relieved'
  | 'sad';
```

Emotion preset должен управлять доступными morph targets или bone poses.

Не разбрасывать raw morph names по UI.

---

# 6. Взгляд и реакции

Добавить:

- blink;
- look-at;
- head turn limits;
- eye focus;
- breathing;
- micro body movement;
- listener reactions;
- pause before important reply.

Говорящий смотрит на собеседника, слушающий реагирует.

Не допускать jitter, взгляда через стены и постоянного взгляда в камеру.

---

# 7. NPC planner integration

Сюжетная сцена:

- временно получает animation ownership;
- освобождает прежний activity claim;
- после сцены возвращает NPC planner;
- очищает look-at;
- очищает emotion override;
- не оставляет mixer actions.

---

# 8. Тесты

- animation priority;
- один active incompatible clip;
- crossfade completion;
- story pause/resume planner;
- reload не оставляет invalid pose;
- look-at cleanup;
- emotion cleanup;
- sit/stand;
- no duplicate mixers;
- no unbounded actions;
- E2E ключевых разговоров.

---

# Критерий завершения 18C

- ходьба и остановка естественны;
- нет заметного foot sliding;
- сидение корректно;
- диалоги имеют жесты и реакции;
- эмоции соответствуют тексту;
- planner восстанавливается;
- performance стабильна.
