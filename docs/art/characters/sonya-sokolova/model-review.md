# female_pm — model review (Feature 18B §3/§4/§7)

Данные: `node tools/art/auditCharacterModels.mjs`, 2026-07-26.
Модель: `public/character/female_pm/` (Mixamo-конверсия, скелет mixamorig).

## Метрики (§7)

| Показатель | Значение |
|---|---|
| Triangles | 50 757 |
| Materials | 2 — `Ch41_body`, `Ch41_hair` (дубликатов нет) |
| Textures (embedded) | 4, ≈3.6 МБ PNG |
| Bones | 131 |
| Morph targets | 0 |
| Клипы | idle, walk, type, drink, sitIdle, sofaSit, talk (7 файлов, 6.9 МБ; база idle 6.0 МБ) |
| Loading | все клипы preload при старте (`useGLTF.preload`), отдельно не профилировалось |

## Аудит (§3)

- Topology/proportions/scale: ок, medium-close выдерживает; рук и локтей без
  заметных артефактов скиннинга в игровых клипах.
- Глаза/лицо: запечены в общий атлас `Ch41_body` — отдельного материала
  глаз нет, отдельная настройка roughness глаз невозможна.
- Волосы: карточная причёска, материал `Ch41_hair`.
- Skinning/skeleton: единый скелет для всех клипов (guard-тест
  `tools/art/characterIdentity.test.ts` сверяет кости каждого клипа с базой).
- Sitting pose: sitIdle/sofaSit без сквозного clipping в игровой камере.

## Проблемы → исправления (§4, код `src/character/CharacterModel.tsx`)

1. Меши не отбрасывали тени (персонаж «парил») → `castShadow = true`.
2. Culling по bind-pose-границам: сидячие позы пропадали у края экрана →
   `frustumCulled = false` (персонажей ≤9, стоимость нулевая).
3. Остаточный metalness атласных материалов давал серый «восковой» тон под
   HDRI → `metalness = 0`, `roughness = 0.85` (тело/одежда, матово по Art
   Bible) и `0.45` (волосы, мягкий блеск).

## Ограничения

- 0 morph targets — лицевой анимации нет и добавить её без замены модели
  нельзя; эмоции передаются позами/портретами. Учитывать в 18C.
- Тяжёлые embedded PNG-текстуры (3.6 МБ) — кандидат на пережатие в 18G
  (визуальная оптимизация), в 18B бинарная хирургия GLB не проводится.
- LOD/distant mode не требуется: максимум ~9 персонажей × ≤56k tris в кадре
  изометрии — в бюджете сцены.
