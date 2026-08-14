# Higgsfield prompts — external-ai-data-disclosure

Insert **сгенерирован и интегрирован** — см. `implementation-notes.md` и `assets/source/prompts/story-clips-cyber-incidents-19b.md`. Финальный клип — прёп-only (без персонажей, без реального AI-бренда): обобщённый чат-интерфейс + замазанный лог (см. production path ниже).

## Storyboard-кадры (generate_image, nano_banana_2, референс на identity-sheets Алины из 18B)

1. `Close-up of a laptop screen showing a generic AI chat assistant interface (no real brand name, no real logo — invented minimalist chat UI), a code snippet pasted into the input field, stylised flat developer UI matching the game's existing OfficeFlow interface art, cool blue-grey palette`
2. `Close-up of a log file snippet on a second screen, several fields pixelated/redacted (session id, internal URL), minimalist monospace UI, no real domain names`
3. `Medium close-up of a stylised 3D office developer character (identity-locked to approved Alina model, docs/art/characters/alina-belova/), pleased but slightly uncertain expression, looking at a laptop screen, soft daylight office lighting, matches existing game art direction`

## Video insert (generate_video, image-to-video from the approved keyframes above, kling3_0_turbo-class model)

`4-8 second insert: camera pushes in on the generic AI chat interface from shot 1 with the code snippet visible, cuts to the redacted log snippet (shot 2), cuts to Alina's pleased-but-uncertain reaction (shot 3), ambient office sound only, no dialogue, no on-screen choice UI, no real AI service branding anywhere in frame, resolves back to a neutral held frame for the game to cut away from`

## Production path

`public/cutscenes/external-ai-data-disclosure-insert.mp4` — подключён через `INSERT_CLIP['external-ai-data-disclosure']` в `cyberStoryInteraction.ts`, проверен живым браузером.
