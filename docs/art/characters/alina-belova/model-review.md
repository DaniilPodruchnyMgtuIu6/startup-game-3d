# alina_belova — model review (Feature 18B §3/§4/§7)

Данные: `node tools/art/auditCharacterModels.mjs`, 2026-07-26.
Модель: `public/character/alina_belova/` (Mixamo-конверсия, скелет mixamorig).

## Метрики (§7)

| Показатель | Значение |
|---|---|
| Triangles | 54 871 (самая тяжёлая из команды) |
| Materials | 2 — `Ch22_body`, `Ch22_hair` (дубликатов нет) |
| Textures (embedded) | 5, ≈6.9 МБ PNG |
| Bones | 111 |
| Morph targets | 0 |
| Клипы | idle, walk, type, drink, sitIdle, sofaSit, talk (7 файлов, 10.2 МБ; база idle 9.3 МБ) |
| Loading | preload при найме (комбинированная форма массива) |

## Аудит (§3)

- Topology/proportions/scale: ок; хвост — жёсткая геометрия (не физика),
  в движении приемлемо для изометрии.
- Глаза/лицо: общий атлас `Ch22_body`, отдельного материала глаз нет.
- Волосы: `Ch22_hair`, самый заметный материал — выигрывает от sheen 0.45.
- Skinning/skeleton: единый скелет всех клипов (guard-тест
  `tools/art/characterIdentity.test.ts`).
- Sitting pose: sitIdle/sofaSit без заметного clipping кардигана.

## Проблемы → исправления (§4, код `src/character/CharacterModel.tsx`)

1. Нет теней → `castShadow = true`.
2. Bind-pose culling → `frustumCulled = false`.
3. Остаточный metalness → `metalness = 0`, roughness 0.85 (тело) / 0.45
   (волосы) по Art Bible.

## Ограничения

- 0 morph targets — лицевой анимации нет; эмоции через позы/портреты (18C).
- Самые тяжёлые текстуры команды (≈6.9 МБ PNG, база 9.3 МБ) — первый
  кандидат на пережатие в 18G.
- LOD не требуется (общий бюджет сцены — см. sonya-sokolova/model-review.md).
