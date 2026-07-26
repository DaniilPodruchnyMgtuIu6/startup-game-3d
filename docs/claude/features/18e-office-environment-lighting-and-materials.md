# Feature 18E — офис, материалы, свет и атмосфера

## Цель

Сделать офис цельной современной игровой локацией, сохранив принятую планировку и позицию whiteboard.

---

# 1. Environment audit

Проверить:

- вход;
- open space;
- рабочие места;
- кабинет руководителя;
- whiteboard;
- серверную;
- двери;
- проходы;
- meeting points;
- navmesh;
- cinematic camera clearances.

Не менять layout без реальной проблемы.

---

# 2. Moodboards через Higgsfield

Подготовить approved references для:

- общего офиса;
- open space;
- кабинета руководителя;
- серверной;
- whiteboard zone;
- security alert state;
- success state;
- failure state.

References должны соответствовать Art Bible.

---

# 3. Материалы

Разделить материалы:

- стены;
- пол;
- потолок;
- стекло;
- металл;
- дерево;
- пластик;
- ткань;
- мониторы;
- серверные стойки.

Настроить:

- base color;
- roughness;
- metalness;
- normal;
- AO;
- texture scale;
- color space.

Не использовать один пластик для всего.

---

# 4. Наполнение

Добавить умеренно:

- клавиатуры;
- мыши;
- документы;
- кружки;
- растения;
- лампы;
- кабели;
- элементы хранения;
- OfficeFlow branding;
- security posters;
- desk props.

Не блокировать navmesh и камеру.

---

# 5. Environmental storytelling

Состояние офиса отражает кампанию:

- нанятый сотрудник получает рабочее место;
- audit добавляет документы;
- СКУД показывает reader;
- server incident меняет rack lighting;
- security training добавляет памятку;
- release меняет экраны;
- failure меняет light/screens.

Effects должны быть детерминированными и сохраняться.

---

# 6. Lighting states

```text
normal-workday
morning
evening
security-alert
server-incident
audit
success
failure
```

Требования:

- лица читаемы;
- переходы плавные;
- нет пересвета;
- нет полностью чёрных теней;
- локальные lights ограничены;
- cinematic state не остаётся после сцены.

---

# 7. Post-processing

После профилирования допустимы:

- tone mapping;
- subtle color grading;
- умеренный bloom;
- SSAO;
- cinematic vignette;
- контролируемый DOF;
- лёгкий grain.

Gameplay не должен быть размытым.

Создать quality tiers:

- low;
- medium;
- high;
- cinematic.

---

# 8. Оптимизация окружения

Проверить:

- shared geometry/material;
- instancing;
- texture compression;
- shadow casters;
- shadow maps;
- lights;
- draw calls;
- culling;
- duplicated props;
- loading.

---

# 9. Тесты и ручная приёмка

- navmesh не сломан;
- NPC проходят;
- whiteboard доступен;
- camera не клиппится;
- state transitions работают;
- reload сохраняет environment state;
- low preset корректен;
- screenshots основных зон;
- performance до/после.

---

# Критерий завершения 18E

- офис выглядит цельно;
- материалы различаются;
- важные зоны читаются;
- состояния событий заметны;
- навигация не сломана;
- performance приемлема.
