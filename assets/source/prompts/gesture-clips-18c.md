# Gesture-клипы 18C — происхождение (Higgsfield 3d_rigging)

Наша модель `public/character/business_man/idle.glb` загружена в Higgsfield
(media `b6e95b69-4f8d-4d04-83fe-184c0f2e37ef`) и прогнана через `3d_rigging`
(движок Meshy, авто-риг + анимационный пресет, 8 кредитов за экшен):

| Экшен (id каталога) | Job id | Итоговые клипы |
|---|---|---|
| Agree_Gesture (25) | 162304f7-bc97-4d40-b25a-a1af938a3085 | `<char>/agree.glb` ×5 |
| Cheer_with_Both_Hands_Up (298) | 083e2520-7ffc-456a-a19b-a424d159916f | `<char>/celebrate.glb` ×5 |
| Talk_with_Hands_Open (313) | 88c31f35-c770-4256-9c1d-7249f6e48fde | `<char>/explain.glb` ×5 |
| Stand_Talking_Angry (311) — 18D | b56ebe10-36e8-4f8c-8880-44f0693545f1 | `security_1/2/angryTalk.glb` |
| Head_Hold_in_Pain (391) — 18D | cf267a55-e164-45b5-98bb-5b8cc9734649 | `business_man,female_pm/facepalm.glb` |

Meshy-скелет (24 кости, см, свои bind-позы) НЕ импортируется в игру —
анимация переносится на родные mixamorig-риги инструментом
`tools/art/retargetMeshyClip.mjs` (world-space дельты вращений с коррекцией
rest-поз). Качество подтверждено покадровыми рендерами (по 2–4 кадра на жест)
до интеграции. Guard: `tools/art/characterIdentity.test.ts`.
