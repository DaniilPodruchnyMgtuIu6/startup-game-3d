# kirill_morozov — model review (Feature 18B §3/§4/§7)

Данные: `node tools/art/auditCharacterModels.mjs`, 2026-07-26.
Модель: `public/character/kirill_morozov/` (Mixamo-конверсия, скелет mixamorig).

## Метрики (§7)

| Показатель | Значение |
|---|---|
| Triangles | 50 256 |
| Materials | 2 — `Ch31_body`, `Ch31_hair` (дубликатов нет) |
| Textures (embedded) | 4, ≈4.9 МБ PNG |
| Bones | 128 |
| Morph targets | 0 |
| Клипы | idle, walk, type, drink, sitIdle, sofaSit, talk (7 файлов, 8.0 МБ; база idle 7.2 МБ) |
| Loading | preload при найме (комбинированная форма массива — не срывает Suspense) |

## Аудит (§3)

- Topology/proportions/scale: ок; walkLift 0.015 уже откалиброван (F03) —
  подошвы не тонут в полу.
- Глаза/лицо: общий атлас `Ch31_body`, отдельного материала глаз нет.
- Очки: часть геометрии тела, при medium-close читаются.
- Skinning/skeleton: единый скелет всех клипов (guard-тест
  `tools/art/characterIdentity.test.ts`).
- Sitting pose: sitIdle/sofaSit без заметного clipping худи.

## Проблемы → исправления (§4, код `src/character/CharacterModel.tsx`)

1. Нет теней → `castShadow = true`.
2. Bind-pose culling (сидячие позы пропадали у края экрана) →
   `frustumCulled = false`.
3. Остаточный metalness → `metalness = 0`, roughness 0.85 (тело) / 0.45
   (волосы) по Art Bible.

## Ограничения

- 0 morph targets — лицевой анимации нет; эмоции через позы/портреты (18C).
- Embedded PNG-текстуры ≈4.9 МБ — кандидат на пережатие в 18G.
- LOD не требуется (см. sonya-sokolova/model-review.md — общий бюджет сцены).
