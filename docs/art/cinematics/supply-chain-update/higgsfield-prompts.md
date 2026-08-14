# Higgsfield prompts — supply-chain-update

Pre-choice insert и delayed-consequence insert **оба сгенерированы и интегрированы** — см. `implementation-notes.md` и `assets/source/prompts/story-clips-cyber-incidents-19.md` / `story-clips-cyber-incidents-19b-consequences.md`.

## Storyboard-кадры (generate_image, nano_banana_2)

1. `Dark developer monitor at night, a package-manager update notification pop-up, terminal window with a short changelog visible (no readable real command output), stylised flat dev-tool UI matching the game's OfficeFlow art direction, cool blue palette`
2. `Close-up of a changelog panel on screen showing "maintainer changed" and "new permissions requested" labels in Russian, minimalist corporate dev-tool UI, no real package names`
3. `Medium close-up of a stylised 3D backend-developer character (identity-locked to approved Kirill model, docs/art/characters/kirill-morozov/), focused concerned expression, looking at a laptop screen late in the office, matches existing game art direction`

## Video insert — pre-choice (generate_video, image-to-video from the keyframes above)

`5-9 second insert: dark monitor (shot 1), notification pop-up appears, cut to the changelog/permissions close-up (shot 2), terminal install lines scroll briefly, a barely-noticeable unknown network connection indicator blinks once, cut to Kirill's concerned reaction (shot 3), resolves back to a neutral held frame, no dialogue, no on-screen choice UI`

## Video insert — delayed consequence (only if install-update-immediately was chosen)

`4-6 second insert: the same developer monitor now showing an active outbound connection indicator the developer did not initiate, a terminal window scrolling unfamiliar log lines (no real command output), Kirill's reaction cutting in, resolves to a held frame before the 3D dialogue takes over`

## Production path

`docs/art/cinematics/supply-chain-update/storyboard/` и `approved-keyframes/`. Pre-choice: `public/cutscenes/supply-chain-update-insert.mp4` (`INSERT_CLIP['supply-chain-update']`). Delayed consequence: `public/cutscenes/supply-chain-update-consequence-insert.mp4` (`CONSEQUENCE_INSERT_CLIP['supply-chain-unknown-connection']` в `cyberStoryInteraction.ts`).
