# Higgsfield prompts — mfa-fatigue-attack

Insert **сгенерирован и интегрирован** — см. `implementation-notes.md` и `assets/source/prompts/story-clips-cyber-incidents-19b.md`. Финальный клип — прёп-only (без персонажей): телефон с push-уведомлениями + панель активных сессий, без Кирилла в кадре (см. production path ниже).

## Storyboard-кадры (generate_image, nano_banana_2, референс на identity-sheets Кирилла из 18B)

1. `Close-up of a smartphone screen at night showing a stack of push-notification prompts reading "Подтвердить вход?" in Russian, generic authenticator-app style UI (not a real branded app), dim bedroom/night lighting, stylised flat mobile UI matching the game's art direction`
2. `Close-up of a thumb hovering hesitantly over a decline button on a phone notification, motion-blur suggesting repeated taps, minimalist UI, no real app branding`
3. `Laptop screen showing a generic account-security panel with a list of active sessions, one row highlighted in red labeled "неизвестное устройство", stylised flat corporate UI matching the game's existing OfficeFlow interface art, no real device/OS names`
4. `Medium close-up of a stylised 3D office developer character (identity-locked to approved Kirill model, docs/art/characters/kirill-morozov/), tired concerned expression, looking at a laptop screen, soft morning office lighting, matches existing game art direction`

## Video insert (generate_video, image-to-video from the approved keyframes above, kling3_0_turbo-class model)

`4-8 second insert: camera holds on the phone notification stack from shot 1, quick cut to the hesitant thumb (shot 2), cut to the active-sessions panel with the unknown-device row highlighted (shot 3), cuts to Kirill's tired concerned reaction (shot 4), ambient office sound only, no dialogue, no on-screen choice UI, no depiction of an actual bypass technique, resolves back to a neutral held frame for the game to cut away from`

## Production path

`public/cutscenes/mfa-fatigue-attack-insert.mp4` — подключён через `INSERT_CLIP['mfa-fatigue-attack']` в `cyberStoryInteraction.ts`, проверен живым браузером.
