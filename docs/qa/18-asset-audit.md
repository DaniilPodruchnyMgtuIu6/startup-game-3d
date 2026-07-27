# 18G — Asset audit (2026-07-27)

Полный реестр происхождения: docs/art/generated-asset-register.md (26 позиций
Higgsfield + наследованные эталоны). Выборочная проверка по чек-листу §1:

| Класс | Формат/размер | Color space | Alpha | Компрессия | Дубликаты |
|---|---|---|---|---|---|
| Диалоговые портреты | JPEG ≤200 КБ, 768×1024 | sRGB (тест) | нет | q82-86 | нет |
| Постеры/дашборд | JPEG ≤200 КБ | sRGB (SRGBColorSpace в провайдере) | нет | q84 | один источник, 2 материала |
| PolyHaven текстуры | JPEG тайлы | sRGB (map) / linear (normal/rough) | нет | исходная | нет |
| GLB атласы персонажей | 2048², JPEG q85 (opaque) / PNG (alpha-волосы) | sRGB (GLTFLoader) | только волосы | 18G пережато | по модели |
| Ретаргет-клипы | GLB anim-only 25-580 КБ | — | — | float32 | нет |
| Сториборды/мудборды/листы | docs-only JPEG ≤200 КБ | sRGB | нет | q84 | вне бандла |

Из production-импортов исключено: rejected/preview-генерации (guard-тест
«assets/generated не импортируется»), oversized оригиналы (PNG-атласы
пережаты), watermarked отсутствуют (negative-промпты + приёмка), Mixamo-
оригиналы вынесены в assets/source (вне сборки). Mipmaps: three генерирует
автоматически (POT 2048). Секреты: guard-тест паттернов ключей в src/docs/
prompts + отсутствие в бандле.
