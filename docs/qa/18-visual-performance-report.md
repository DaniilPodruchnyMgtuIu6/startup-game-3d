# 18G — Visual performance report (2026-07-27)

Среда измерения: headless SwiftShader (софтверный рендер) — честные FPS/frame
time НЕ измеримы (§3: «не выдумывать цифры»); ниже — детерминированные
метрики + оптимизации с фактическим до/после.

## Метрики (детерминированные)

| Метрика | Значение |
|---|---|
| Треугольники базовых моделей (8 персонажей, сумма) | 357 351 |
| GLB-файлов клипов | 74, суммарно 29.2 МБ |
| Персонажный payload до 18G / после | ≈50 МБ → **29.3 МБ** (−41%) |
| Крупнейшие пережатия (PNG→JPEG q85 атласы без alpha) | intruder 9.8→4.5 МБ; business_man 7.3→4.4; security_1 5.3→2.1; security_2 5.7→1.5; v2-модели ~6→2.5 МБ |
| Bundle (production, gzip) | 2 112 КБ / 626 КБ gzip (без изменений с 18D; code-splitting — вне визуального скоупа) |
| Shadow map | один каскад 1024², один casting light |
| Mixers | 1 на персонажа (useAnimations), утечка исключена sceneRecovery-тестами |
| Временные актёры | despawn в сценах + recovery-тест на ghost-записи |

## Оптимизации 18G

1. `tools/art/optimizeGlbTextures.mjs` — непрозрачные атласы PNG→JPEG q85,
   alpha-текстуры пере-сжаты PNG; все 8 базовых моделей.
2. Quality preset low теперь отключает per-frame NPC performance-слой
   (дыхание/gaze/кивки) — единственная пер-кадровая CPU-логика персонажей.
3. Ранее в 18B/18C: castShadow только нужным мешам, frustumCulled-фикс,
   один активный clip на mixer с crossfade.

## Невыполненное честно

- FPS/frame-time/soak 20-30 мин — требует реального GPU-стенда; рекомендую
  ручной прогон на целевой машине (чек-лист в 18-cinematic-test-matrix.md).
- GPU/JS память в headless не показательны.
