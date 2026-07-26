# cybersecurity — model review (Feature 18B §3/§4/§7)

Данные: `node tools/art/auditCharacterModels.mjs`, 2026-07-26.
Модель: `public/character/cybersecurity/` (Mixamo-конверсия, скелет mixamorig).
Персонаж появляется только после фактического найма Ильи (Feature 07).

## Метрики (§7)

| Показатель | Значение |
|---|---|
| Triangles | 42 812 |
| Materials | 2 — `Ch01_body`, `Ch01_hair` (дубликатов нет) |
| Textures (embedded) | 5, ≈7.0 МБ PNG |
| Bones | 104 |
| Morph targets | 0 |
| Клипы | idle, walk, type, drink, sitIdle, sofaSit, talk (7 файлов, 9.3 МБ; база idle 8.7 МБ) |
| Loading | preload при найме (комбинированная форма массива) |

## Аудит (§3)

- Topology/proportions/scale: ок; самый лёгкий по треугольникам из четвёрки.
- Глаза/лицо: общий атлас `Ch01_body`, отдельного материала глаз нет.
- Борода: часть текстуры лица (не геометрия) — на medium-close читается.
- Skinning/skeleton: единый скелет всех клипов (guard-тест
  `tools/art/characterIdentity.test.ts`).
- Sitting pose: sitIdle/sofaSit без заметного clipping.

## Проблемы → исправления (§4, код `src/character/CharacterModel.tsx`)

1. Нет теней → `castShadow = true`.
2. Bind-pose culling → `frustumCulled = false`.
3. Остаточный metalness → `metalness = 0`, roughness 0.85 (тело) / 0.45
   (волосы) по Art Bible.

## Ограничения

- 0 morph targets — лицевой анимации нет; эмоции через позы/портреты (18C).
- Embedded PNG-текстуры ≈7.0 МБ — кандидат на пережатие в 18G.
- LOD не требуется (общий бюджет сцены — см. sonya-sokolova/model-review.md).
