# portraits-worried-team (kirill / alina / ilya)

- Tool/model: Higgsfield MCP / nano_banana_2 (nano_banana_pro alias)
- Date, session: 2026-07-28, итерация 18H (второй emotion-pass)
- Cost: 3 × ~1.5 credits
- Aspect/resolution: 3:4, 1k (896×1200 raw)
- Reference media: kirill_neutral.jpg / alina_neutral.jpg / ilya_neutral.jpg
  (IDENTITY reference, role image — то же лицо, тот же кадр)
- Jobs: a4c7d293 (Кирилл), 2ad6e299 (Алина), e218b978 (Илья)
- Style: Soft Pixar-like 3D — идентичен нейтральным портретам
- Prompt (одинаковый для всех трёх): Same person from the reference image,
  same stylized 3D game-art portrait style, same framing, same camera angle,
  same lighting, same plain background, same clothing and hairstyle. Change
  ONLY the facial expression to worried and concerned: furrowed brows drawn
  together, tense eyes, slightly downturned closed mouth. The identity, face
  shape, skin tone, colors and rendering style must stay exactly identical
  to the reference.
- Post-processing: sharp → resize 880w → JPEG q82 (mozjpeg), 77-89 КБ
- Result:
  - public/dialogue_pictures/kirill_morozov/kirill_worried.jpg
  - public/dialogue_pictures/alina_belova/alina_worried.jpg
  - public/dialogue_pictures/ilya_vlasov/ilya_worried.jpg
- Использование: `portraitWorried` в конфигах персонажей; consequence-сцены
  выбирают портрет по `cue.speakerEmotion` (негативные эмоции → worried), risk-alert
  Ильи — worried всегда.
