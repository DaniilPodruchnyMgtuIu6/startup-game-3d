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
| poster-officeflow | Higgsfield MCP / nano_banana_2 | assets/source/prompts/posters-sheet.md | integrated | Higgsfield generation (проект) | public/posters/officeflow.jpg |
| poster-lock-screen | Higgsfield MCP / nano_banana_2 | assets/source/prompts/posters-sheet.md | integrated | Higgsfield generation (проект) | public/posters/lock_screen.jpg |
| screen-officeflow-dashboard | Higgsfield MCP / nano_banana_2 | assets/source/prompts/officeflow-dashboard.md | integrated | Higgsfield generation (проект) | public/textures/officeflow_dashboard.jpg |
| identity-sheets-sonya (turnaround+expressions+poses) | Higgsfield MCP / nano_banana_2 | assets/source/prompts/identity-sheets-18b.md | approved (reference-only) | Higgsfield generation (проект) | — docs/art/characters/sonya-sokolova/ |
| identity-sheets-kirill (turnaround+expressions+poses) | Higgsfield MCP / nano_banana_2 | assets/source/prompts/identity-sheets-18b.md | approved (reference-only) | Higgsfield generation (проект) | — docs/art/characters/kirill-morozov/ |
| identity-sheets-alina (turnaround+expressions+poses) | Higgsfield MCP / nano_banana_2 | assets/source/prompts/identity-sheets-18b.md | approved (reference-only) | Higgsfield generation (проект) | — docs/art/characters/alina-belova/ |
| identity-sheets-ilya (turnaround+expressions+poses) | Higgsfield MCP / nano_banana_2 | assets/source/prompts/identity-sheets-18b.md | approved (reference-only) | Higgsfield generation (проект) | — docs/art/characters/ilya-vlasov/ |
| identity-sheets-founder (turnaround+expressions+poses) | Higgsfield MCP / nano_banana_2 | assets/source/prompts/identity-sheets-18b.md | approved (reference-only) | Higgsfield generation (проект) | — docs/art/characters/player-founder/ |

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
