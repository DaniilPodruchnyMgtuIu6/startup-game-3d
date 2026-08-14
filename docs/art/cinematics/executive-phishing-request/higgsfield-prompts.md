# Higgsfield prompts — executive-phishing-request

Готовы к запуску через уже подключённые Higgsfield MCP tools (`generate_image` для storyboard/keyframes, `generate_video` для итогового insert). **Не выполнено в рамках этой итерации** — см. `implementation-notes.md` и «Оставшиеся ограничения» в финальном отчёте Feature 19. Игра полностью проходима без этих ассетов (fallback уже реализован и проверен).

## Storyboard-кадры (generate_image, nano_banana_2, референс на identity-sheets Сони из 18B)

1. `Close-up of a laptop screen showing a corporate email inbox, one unread message highlighted, subject line in Russian "Срочно: бюджет и список команды", stylised flat office UI matching the game's existing OfficeFlow interface art, cool blue-grey palette, no readable sensitive text, no real domain names`
2. `Extreme close-up of an email sender address on a screen, one character in the domain subtly wrong (visually distinct font weight), red underline highlight, minimalist corporate UI style, no real brand names`
3. `Medium close-up of a stylised 3D office manager character (identity-locked to approved Sonya model, docs/art/characters/sonya-sokolova/), sitting at a desk, concerned focused expression, looking at a laptop screen, soft daylight office lighting, matches existing game art direction`

## Video insert (generate_video, image-to-video from the approved keyframes above, kling3_0_turbo-class model)

`4-8 second insert: camera pushes in on the laptop screen from shot 1, cuts to the sender-address close-up (shot 2) with the suspicious character subtly emphasized, cuts to Sonya's concerned reaction (shot 3) as her cursor hovers near a link on screen (cursor visible, link never clicked), ambient office sound only, no dialogue, no on-screen choice UI, resolves back to a neutral held frame for the game to cut away from`

## Production path

`docs/art/cinematics/executive-phishing-request/storyboard/` и `approved-keyframes/` — заполняются после первого прогона `generate_image`/`generate_video` и approval per Feature 18A workflow. Итоговый файл (после approval) кладётся в `public/cutscenes/executive-phishing-request-insert.mp4` — код уже готов его подхватить (`INSERT_CLIP['executive-phishing-request']` в `cyberStoryInteraction.ts`), без изменений кода.
