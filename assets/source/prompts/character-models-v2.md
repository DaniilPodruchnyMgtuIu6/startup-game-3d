# Identity-точные 3D-модели (замена Mixamo-заглушек)

Пайплайн: front/side/back вырезаются из turnaround-листов 18B →
`multi_image_to_3d` (Meshy через Higgsfield, 38 кр.: текстуры+PBR, риг a-pose,
рост в метрах, idle-анимация id 0, 45k полигонов) →
`tools/art/importHiggsfieldModel.mjs`: результат становится `idle.glb`, все
остальные клипы регенерируются ретаргетом старой библиотеки на новый скелет
(`retargetMeshyClip.mjs`). Старые Mixamo-наборы — в
`assets/source/models-mixamo-backup/` (в сборку не попадают).

| Персонаж | Job id | Статус |
|---|---|---|
| Соня (female_pm) | 4c44004a-55cf-4e1f-b813-4bc42c956410 | integrated 2026-07-27 |
| Алина (alina_belova) | 884704c8-ba55-444a-97b9-6daa0668da7a | integrated 2026-07-27 |
| Кирилл (kirill_morozov) | 6c16983d-0a50-4367-973a-8f58a53386d7 | integrated 2026-07-27 |
| Илья (cybersecurity) | db63d60f-4555-4fcd-b27a-e6e98abfcadb | integrated 2026-07-27; texture-дефект левого предплечья — регенерация job 1191ad44-c949-47c3-ac2b-cc7424680051 |

QA: покадровые рендеры idle/walk/talk/sitIdle во вьюере + кадры в игре
(kickoff-кинематика). Ограничение нового рига: 24 кости, без пальцев и morph
targets — кисти в close-up плоские; guard-тесты валидируют клипы автоматически.
