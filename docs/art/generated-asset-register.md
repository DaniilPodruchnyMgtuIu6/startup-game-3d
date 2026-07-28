# Реестр сгенерированных ассетов

Статусы: draft / review / approved / rejected / integrated / deprecated.
Production-код ссылается только на approved/integrated. Секретов здесь нет и
быть не может (guard-тест `tools/art/artPipeline.test.ts`).

| Asset ID | Tool/model | Prompt file | Status | License/source | Production path |
|---|---|---|---|---|---|
| portrait-kirill-neutral | Higgsfield MCP / nano_banana_2 | assets/source/prompts/portrait-kirill-neutral.md | integrated | Higgsfield generation (проект) | public/dialogue_pictures/kirill_morozov/kirill_neutral.jpg |
| portrait-alina-neutral | Higgsfield MCP / nano_banana_2 | assets/source/prompts/portrait-alina-neutral.md | integrated | Higgsfield generation (проект) | public/dialogue_pictures/alina_belova/alina_neutral.jpg |
| portrait-ilya-neutral | Higgsfield MCP / nano_banana_2 | assets/source/prompts/portrait-ilya-neutral.md | integrated | Higgsfield generation (проект) | public/dialogue_pictures/ilya_vlasov/ilya_neutral.jpg |
| portrait-sonya-worried | Higgsfield MCP / nano_banana_2 | assets/source/prompts/portrait-sonya-worried.md | integrated | Higgsfield generation (проект) | public/dialogue_pictures/prodact_manager/pm_worried.jpg |
| portrait-kirill-worried | Higgsfield MCP / nano_banana_2 | assets/source/prompts/portraits-worried-team.md | integrated | Higgsfield generation (проект) | public/dialogue_pictures/kirill_morozov/kirill_worried.jpg |
| portrait-alina-worried | Higgsfield MCP / nano_banana_2 | assets/source/prompts/portraits-worried-team.md | integrated | Higgsfield generation (проект) | public/dialogue_pictures/alina_belova/alina_worried.jpg |
| portrait-ilya-worried | Higgsfield MCP / nano_banana_2 | assets/source/prompts/portraits-worried-team.md | integrated | Higgsfield generation (проект) | public/dialogue_pictures/ilya_vlasov/ilya_worried.jpg |
| story-clip-intrusion-stopped | Higgsfield MCP / nano_banana_2 + kling3_0_turbo | assets/source/prompts/story-clips-office-intrusion.md | integrated | Higgsfield generation (проект) | public/cutscenes/office-intrusion-stopped.mp4 |
| story-clip-intrusion-reached | Higgsfield MCP / nano_banana_2 + kling3_0_turbo | assets/source/prompts/story-clips-office-intrusion.md | integrated | Higgsfield generation (проект) | public/cutscenes/office-intrusion-reached.mp4 |
| poster-officeflow | Higgsfield MCP / nano_banana_2 | assets/source/prompts/posters-sheet.md | integrated | Higgsfield generation (проект) | public/posters/officeflow.jpg |
| poster-lock-screen | Higgsfield MCP / nano_banana_2 | assets/source/prompts/posters-sheet.md | integrated | Higgsfield generation (проект) | public/posters/lock_screen.jpg |
| screen-officeflow-dashboard | Higgsfield MCP / nano_banana_2 | assets/source/prompts/officeflow-dashboard.md | integrated | Higgsfield generation (проект) | public/textures/officeflow_dashboard.jpg |
| identity-sheets-sonya (turnaround+expressions+poses) | Higgsfield MCP / nano_banana_2 | assets/source/prompts/identity-sheets-18b.md | approved (reference-only) | Higgsfield generation (проект) | — docs/art/characters/sonya-sokolova/ |
| identity-sheets-kirill (turnaround+expressions+poses) | Higgsfield MCP / nano_banana_2 | assets/source/prompts/identity-sheets-18b.md | approved (reference-only) | Higgsfield generation (проект) | — docs/art/characters/kirill-morozov/ |
| identity-sheets-alina (turnaround+expressions+poses) | Higgsfield MCP / nano_banana_2 | assets/source/prompts/identity-sheets-18b.md | approved (reference-only) | Higgsfield generation (проект) | — docs/art/characters/alina-belova/ |
| identity-sheets-ilya (turnaround+expressions+poses) | Higgsfield MCP / nano_banana_2 | assets/source/prompts/identity-sheets-18b.md | approved (reference-only) | Higgsfield generation (проект) | — docs/art/characters/ilya-vlasov/ |
| identity-sheets-founder (turnaround+expressions+poses) | Higgsfield MCP / nano_banana_2 | assets/source/prompts/identity-sheets-18b.md | approved (reference-only) | Higgsfield generation (проект) | — docs/art/characters/player-founder/ |
| gesture-clip-agree (×5 ригов) | Higgsfield MCP / 3d_rigging (Meshy, action 25) + retargetMeshyClip | assets/source/prompts/gesture-clips-18c.md | integrated | Higgsfield generation (проект) | public/character/*/agree.glb |
| gesture-clip-celebrate (×5 ригов) | Higgsfield MCP / 3d_rigging (Meshy, action 298) + retargetMeshyClip | assets/source/prompts/gesture-clips-18c.md | integrated | Higgsfield generation (проект) | public/character/*/celebrate.glb |
| gesture-clip-explain (×5 ригов) | Higgsfield MCP / 3d_rigging (Meshy, action 313) + retargetMeshyClip | assets/source/prompts/gesture-clips-18c.md | integrated | Higgsfield generation (проект) | public/character/*/explain.glb |
| gesture-clip-angryTalk (риги охраны) | Higgsfield MCP / 3d_rigging (Meshy, action 311) + retargetMeshyClip | assets/source/prompts/gesture-clips-18c.md | integrated | Higgsfield generation (проект) | public/character/security_*/angryTalk.glb |
| gesture-clip-facepalm (игрок+Соня) | Higgsfield MCP / 3d_rigging (Meshy, action 391) + retargetMeshyClip | assets/source/prompts/gesture-clips-18c.md | integrated | Higgsfield generation (проект) | public/character/business_man/facepalm.glb |
| storyboard-sprint-kickoff | Higgsfield MCP / nano_banana_2 | docs/art/cinematics/sprint-kickoff/higgsfield-prompts.md | approved (reference-only) | Higgsfield generation (проект) | — docs/art/cinematics/sprint-kickoff/ |
| storyboard-audit-or-ilya-choice | Higgsfield MCP / nano_banana_2 | docs/art/cinematics/audit-or-ilya-choice/higgsfield-prompts.md | approved (reference-only) | Higgsfield generation (проект) | — docs/art/cinematics/audit-or-ilya-choice/ |
| storyboard-security-breach | Higgsfield MCP / nano_banana_2 | docs/art/cinematics/security-breach/higgsfield-prompts.md | approved (reference-only) | Higgsfield generation (проект) | — docs/art/cinematics/security-breach/ |
| model-sonya-v2 (+12 ретаргет-клипов) | Higgsfield MCP / multi_image_to_3d (Meshy) + importHiggsfieldModel | assets/source/prompts/character-models-v2.md | integrated | Higgsfield generation (проект) | public/character/female_pm/ |
| model-alina-v2 (+11 ретаргет-клипов) | Higgsfield MCP / multi_image_to_3d (Meshy) + importHiggsfieldModel | assets/source/prompts/character-models-v2.md | integrated | Higgsfield generation (проект) | public/character/alina_belova/ |
| moodboards-environment ×8 (зоны + alert/success/failure) | Higgsfield MCP / nano_banana_2 | docs/art/references/environment/ | approved (reference-only) | Higgsfield generation (проект) | — docs/art/references/environment/ |
| storyboard-office-intrusion | Higgsfield MCP / nano_banana_2 | docs/art/cinematics/office-intrusion/higgsfield-prompts.md | approved (reference-only) | Higgsfield generation (проект) | — docs/art/cinematics/office-intrusion/ |
| storyboard-project-data-loss | Higgsfield MCP / nano_banana_2 | docs/art/cinematics/project-data-loss/higgsfield-prompts.md | approved (reference-only) | Higgsfield generation (проект) | — docs/art/cinematics/project-data-loss/ |
| storyboard-mvp-release | Higgsfield MCP / nano_banana_2 | docs/art/cinematics/mvp-release/higgsfield-prompts.md | approved (reference-only) | Higgsfield generation (проект) | — docs/art/cinematics/mvp-release/ |
| storyboards-wave2 ×4 листа (7 сцен решений) | Higgsfield MCP / nano_banana_2 | docs/art/cinematics/<decision>/higgsfield-prompts.md | approved (reference-only) | Higgsfield generation (проект) | — docs/art/cinematics/{developer-admin-access,frontend-test-data,security-first-priority,backup-and-restore-strategy,architecture-boundary,suspicious-activity-disclosure,release-risk-decision}/ |
| ambient-clip-pullUp (×5 ригов, job 664fdf80-0890-4c5c-b4ad-6b76ead705ea) | Higgsfield MCP / 3d_rigging (Meshy, action 485 Jump_and_Hang_on_Bar) + retargetMeshyClip + liftClipToHandHeight | docs/art/higgsfield-ambient-motion-prompts.md | integrated | Higgsfield generation (проект) | public/character/{business_man,female_pm,kirill_morozov,alina_belova,cybersecurity}/pullUp.glb |
| kickoff-safe-wide-composition-ref (job 94dfcfb5-c079-40d3-ba39-4cb636d77d29) | Higgsfield MCP / nano_banana_2 (nano_banana_flash) | docs/art/cinematics/sprint-kickoff/higgsfield-prompts.md | reference-only (не игровой ассет) | Higgsfield generation (проект) | docs/art/cinematics/sprint-kickoff/live-captures-18h/reference-safe-wide-composition.png |
| poster-officeflow-2k (job 87948649-01c8-41d1-9e77-8784bc35cfc7) | Higgsfield MCP / upscale_image (bytedance, 2k) от исходника 768x1024 | — (upscale, промпта нет) | integrated | Higgsfield generation (проект) | public/posters/officeflow.jpg (1536x2048) |
| poster-lock-screen-2k (job ec7046fc-8ecc-43ff-afea-49c35fd6b5b2) | Higgsfield MCP / upscale_image (bytedance, 2k) от исходника 768x1024 | — (upscale, промпта нет) | integrated | Higgsfield generation (проект) | public/posters/lock_screen.jpg (1536x2048) |
| texture-oak-desk (job 3fb4842d-3ca9-49bb-ba6b-9e60b5be74a5) | Higgsfield MCP / nano_banana_pro (исп. nano_banana_2) | prompt в params job («seamless oak wood grain pattern…») | integrated | Higgsfield generation (проект) | public/textures/oak-desk/diffuse.jpg (1024², все столешницы) |
| texture-chair-weave (job 17e0c89d-7734-47af-bc88-d63d75dfd0ca) | Higgsfield MCP / nano_banana_2 (flash) | prompt в params job («office chair mesh fabric weave…») | integrated | Higgsfield generation (проект) | public/textures/chair-weave/diffuse.jpg (512², тонируется цветом кресла) |
| texture-wall-plaster (job 5b296497-204c-4e0f-9e8b-5122cdbbfbdd) | Higgsfield MCP / nano_banana_2 (flash) | prompt в params job («subtle white interior wall plaster…») | integrated | Higgsfield generation (проект) | public/textures/wall-plaster/diffuse.jpg (512², tiled 3x1.5, тонируется цветом стены) |

Наследованные до-реестровые генерации (эталоны стиля, приняты ранее):
`public/dialogue_pictures/prodact_manager/pm.jpeg`, `boss/*.jpeg`,
`businessman/*`, `security/*` — статус integrated, промпты не сохранились
(до внедрения workflow); внешность зафиксирована Art Bible как эталон.

## Стандарт промпта (обязательные поля)

Каждый новый промпт обязан указывать: approved-стиль (ссылкой на Art Bible),
конкретного персонажа/локацию, действие, эмоцию, camera shot, focal feeling,
lighting, палитру, важные props, consistency constraints (референс +
запрет менять внешность), negative constraints (без watermark, без текста вне
диегетики, без фотореализма). Общие промпты вида «make it cinematic»
запрещены. Шаблон: `assets/source/prompts/_template.md`.
