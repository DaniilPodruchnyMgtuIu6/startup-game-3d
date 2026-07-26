# Feature 18B — идентичность персонажей и art pass 3D-моделей

## Цель

Сделать Соню, Кирилла, Алину, Илью и игрока красивыми, узнаваемыми и визуально согласованными.

Не переходить к полноценной cinematic-постановке до стабилизации внешности.

---

# 1. Identity package

Для каждого постоянного персонажа создать:

```text
docs/art/characters/{character-id}/
  identity.md
  generation-prompts.md
  approved-references/
  rejected-references/
  expressions/
  poses/
  turnaround/
  model-review.md
```

`identity.md` фиксирует:

- возрастной диапазон;
- лицо;
- волосы;
- телосложение;
- одежду;
- обувь;
- аксессуары;
- осанку;
- жесты;
- характер;
- запрещённые изменения.

---

# 2. Consistent references через Higgsfield

Для каждого подготовить:

- front;
- side;
- three-quarter;
- back;
- neutral;
- joy;
- concerned;
- controlled anger;
- surprise;
- thoughtful;
- confident;
- seated;
- standing dialogue;
- working pose.

Использовать один approved identity reference во всех последующих генерациях.

Нельзя менять:

- лицо;
- возраст;
- причёску;
- цвет волос;
- телосложение;
- основную одежду;
- пропорции.

---

# 3. Аудит текущих 3D-моделей

Для каждой модели проверить:

- topology;
- face quality;
- глаза;
- волосы;
- руки;
- proportions;
- materials;
- UV;
- skinning;
- skeleton;
- shoulder/elbow/knee deformation;
- seated pose;
- close-up quality;
- texture resolution;
- scale;
- animation compatibility.

Создать `model-review.md` с проблемами и исправлениями.

---

# 4. Реальное улучшение моделей

Исправить средствами, доступными в проекте:

- материалы кожи;
- roughness глаз;
- волосы;
- clipping одежды;
- scale;
- bone weights;
- face normals;
- texture compression;
- expression support;
- seat anchors.

Если Higgsfield не экспортирует корректный rigged GLB/GLTF, использовать его только как reference.

Не импортировать fake rig или модель без совместимого skeleton.

---

# 5. Визуальная дифференциация

Персонажи должны различаться силуэтом и палитрой:

- Соня — управленческая собранность;
- Кирилл — практичный backend-разработчик;
- Алина — современная frontend-дизайнерская выразительность;
- Илья — спокойный специалист по безопасности;
- игрок — нейтральный руководитель, не копирующий CEO NPC, которого нет.

Не использовать карикатурные профессиональные стереотипы.

---

# 6. Имя и должность

Проверить подписи над NPC:

- читабельность;
- соответствие имени;
- корректная должность;
- отсутствие internal ids;
- скрытие на дистанции;
- отсутствие перекрытия лица и cinematic camera.

---

# 7. Performance

Для каждой модели зафиксировать:

- triangles;
- materials;
- texture memory;
- skeleton bones;
- morph targets;
- loading time.

Подготовить LOD или упрощённый distant mode, если требуется.

---

# 8. Тесты

- нужная модель загружается для правильного character id;
- skeleton совместим с clips;
- отсутствуют duplicate materials;
- NPC не получает модель другого героя;
- reload не меняет внешний вид;
- player variants корректно садятся в кресло;
- production asset paths существуют;
- build проходит.

---

# Критерий завершения 18B

- у каждого героя есть approved identity;
- нет identity drift;
- модели выдерживают medium-close shot;
- материалы выглядят согласованно;
- rig не сломан;
- performance budget не ухудшен критически;
- пользователь принял внешний вид.
