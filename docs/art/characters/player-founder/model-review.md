# business_man — model review (Feature 18B §3/§4/§7)

Данные: `node tools/art/auditCharacterModels.mjs`, 2026-07-26.
Модель: `public/character/business_man/` (Mixamo-конверсия, скелет mixamorig).
Это модель ИГРОКА (руководителя отдела); CEO 3D-модели не имеет и не получит.

## Метрики (§7)

| Показатель | Значение |
|---|---|
| Triangles | 54 933 |
| Materials | 2 — `Ch33_body`, `Ch33_hair` (дубликатов нет) |
| Textures (embedded) | 4, ≈4.9 МБ PNG |
| Bones | 144 (самый богатый скелет — есть пальцы) |
| Morph targets | 0 |
| Клипы | idle, walk, sit, type, drink, sitIdle, sofaSit, talk (8 файлов, 8.1 МБ; база idle 7.1 МБ) |
| Loading | preload при старте (`useGLTF.preload`) |

## Аудит (§3)

- Topology/proportions/scale: ок; единственный герой с отдельным клипом
  `sit` — посадка в player-only кресло руководителя (F16 seat anchor) без
  заметного clipping.
- Глаза/лицо: общий атлас `Ch33_body`, отдельного материала глаз нет.
- Руки: 144 кости включают пальцы — кружка кофе (`heldProps`) ложится в
  ладонь корректно.
- Skinning/skeleton: единый скелет всех клипов (guard-тест
  `tools/art/characterIdentity.test.ts`).

## Проблемы → исправления (§4, код `src/character/CharacterModel.tsx`)

1. Нет теней → `castShadow = true`.
2. Bind-pose culling → `frustumCulled = false`.
3. Остаточный metalness → `metalness = 0`, roughness 0.85 (тело) / 0.45
   (волосы) по Art Bible.

## Ограничения

- 0 morph targets — лицевой анимации нет; эмоции через позы/портреты (18C).
- Embedded PNG-текстуры ≈4.9 МБ — кандидат на пережатие в 18G.
- LOD не требуется (общий бюджет сцены — см. sonya-sokolova/model-review.md).
