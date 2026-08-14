# Higgsfield prompts — secret-committed-to-repository

Insert **сгенерирован и интегрирован** — см. `implementation-notes.md` и `assets/source/prompts/story-clips-cyber-incidents-19b.md`. Финальный клип — прёп-only (без персонажей), см. production path ниже.

## Storyboard-кадры (generate_image, nano_banana_2, референс на identity-sheets Кирилла из 18B)

1. `Close-up of a code diff on a laptop screen, one removed line highlighted in red strikethrough, generic placeholder API key string (clearly fake, not a real credential format), stylised flat developer UI matching the game's existing OfficeFlow interface art, cool blue-grey palette, no real domain/service names`
2. `Terminal window showing a git log output, a commit message reading "remove temporary key" in Russian, minimalist monospace UI, no real repository URLs`
3. `Medium close-up of a stylised 3D office developer character (identity-locked to approved Kirill model, docs/art/characters/kirill-morozov/), sitting at a desk, focused concerned expression, looking at a laptop screen, soft daylight office lighting, matches existing game art direction`

## Video insert (generate_video, image-to-video from the approved keyframes above, kling3_0_turbo-class model)

`4-8 second insert: camera pushes in on the diff from shot 1, cuts to the terminal/git-log close-up (shot 2), cuts to Kirill's concerned reaction (shot 3) as he scrolls the log, ambient office sound only, no dialogue, no on-screen choice UI, resolves back to a neutral held frame for the game to cut away from`

## Production path

`public/cutscenes/secret-committed-to-repository-insert.mp4` — подключён через `INSERT_CLIP['secret-committed-to-repository']` в `cyberStoryInteraction.ts`, проверен живым браузером.
