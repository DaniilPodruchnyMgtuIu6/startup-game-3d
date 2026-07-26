# Identity sheets — Feature 18B (указатель)

15 референс-листов (turnaround / expressions / poses × 5 героев) сгенерированы
Higgsfield MCP (`nano_banana_2`, исполнено как `nano_banana_flash`, 16:9 1k)
2026-07-26 с identity-референсами из production-портретов.

Полные промпты, job id, media id и вердикты приёмки — по персонажам:

- `docs/art/characters/sonya-sokolova/generation-prompts.md`
- `docs/art/characters/kirill-morozov/generation-prompts.md`
- `docs/art/characters/alina-belova/generation-prompts.md`
- `docs/art/characters/ilya-vlasov/generation-prompts.md`
- `docs/art/characters/player-founder/generation-prompts.md`

Листы — reference-only: лежат в `docs/art/characters/<id>/{turnaround,
expressions,poses}/`, в `public/` не копируются и production-кодом не
импортируются (guard: `tools/art/artPipeline.test.ts`,
`tools/art/characterIdentity.test.ts`).
