# Higgsfield prompts — shadow-it-log-upload

Pre-choice insert и delayed-consequence insert **оба сгенерированы и интегрированы** — см. `implementation-notes.md` и `assets/source/prompts/story-clips-cyber-incidents-19.md` / `story-clips-cyber-incidents-19b-consequences.md`.

## Storyboard-кадры (generate_image, nano_banana_2)

1. `Developer screen showing a large log-archive file icon and a personal cloud-storage upload window, stylised flat file-manager UI matching the game's OfficeFlow art direction, no readable personal data, cool blue-grey palette`
2. `Close-up of a scrolling log viewer on screen, blurred/abstracted lines suggesting emails and session identifiers without showing any real readable text, a public share-link box appearing below`
3. `Medium close-up of a stylised 3D backend-developer character (identity-locked to approved Kirill model), a cursor hovering near a "Copy link" button on screen, neutral-to-concerned expression, matches existing game art direction`

## Video insert — pre-choice (generate_video, image-to-video from the keyframes above)

`4-8 second insert: a large log archive icon (shot 1), cut to the scrolling abstracted log viewer with a personal-cloud upload window (shot 2), a public share link appears, cursor hovers over "Copy link" (shot 3) but never clicks, resolves to a neutral held frame, no dialogue, no on-screen choice UI, no real personal data or secrets visible anywhere`

## Video insert — delayed consequence (only if upload-raw-logs-to-personal-cloud was chosen)

`4-6 second insert: a dim office at night, a single monitor showing a link-access notification timestamp, cut to a morning office establishing shot, a second unfamiliar download entry in an access log (abstracted, no real data), resolves to a held frame before the 3D team dialogue takes over`

## Production path

`docs/art/cinematics/shadow-it-log-upload/storyboard/` и `approved-keyframes/`. Pre-choice: `public/cutscenes/shadow-it-log-upload-insert.mp4` (`INSERT_CLIP['shadow-it-log-upload']`). Delayed consequence: `public/cutscenes/shadow-it-log-upload-consequence-insert.mp4` (`CONSEQUENCE_INSERT_CLIP['shadow-it-external-download']` в `cyberStoryInteraction.ts`).
