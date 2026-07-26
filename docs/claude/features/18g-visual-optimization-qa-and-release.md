# Feature 18G — визуальная оптимизация, QA и release gate

## Цель

Проверить весь визуальный production pass, оптимизировать generated assets и не допустить, чтобы красота сделала игру нестабильной или медленной.

---

# 1. Asset audit

Для каждого production asset проверить:

- source;
- license;
- format;
- dimensions;
- compression;
- alpha;
- color space;
- mipmaps;
- memory;
- loading;
- duplicate usage;
- production path.

Удалить из production imports:

- rejected;
- previews;
- watermarked;
- duplicated;
- oversized originals.

---

# 2. Performance baseline и after

Измерить:

- FPS;
- frame time;
- draw calls;
- triangles;
- geometries;
- textures;
- GPU memory если доступна;
- JS memory;
- animation mixers;
- React commits;
- loading time;
- bundle size.

Сценарии:

- open space;
- несколько NPC;
- whiteboard;
- server room;
- Wave 1 cinematic;
- office intrusion;
- success/failure scene;
- 20–30 minute soak.

---

# 3. Целевой budget

На 1920×1080 typical desktop:

- median gameplay FPS ≥ 50;
- насыщенная cinematic ≥ 40;
- нет регулярных spikes > 100 ms;
- память не растёт постоянно;
- mixers не накапливаются;
- temporary actors не накапливаются;
- generated textures не загружаются повторно.

Если среда не позволяет честное измерение, не выдумывать цифры.

---

# 4. Quality presets

Проверить:

- low;
- medium;
- high;
- cinematic.

Каждый preset должен явно управлять:

- DPR;
- shadows;
- post-processing;
- texture quality;
- NPC update rate;
- overlays;
- DOF/bloom;
- cinematic extras.

---

# 5. Полная visual QA matrix

Создать:

```text
docs/qa/18-visual-performance-report.md
docs/qa/18-cinematic-test-matrix.md
docs/qa/18-visual-known-issues.md
docs/qa/18-asset-audit.md
```

Проверить:

- character consistency;
- animation transitions;
- camera clipping;
- subtitles;
- lighting states;
- office materials;
- responsive UI;
- quality presets;
- reload;
- reset;
- all outcomes;
- DeepSeek overlays;
- workday flow;
- visual regressions.

---

# 6. Два полных прогона

Выполнить существующие аналоги:

```bash
npm test
npm run test:e2e
npm run lint
npm run typecheck
npm run build
```

Два последовательных прогона должны быть успешны.

Также:

```bash
git diff --check
git status --short
```

Не выполнять `git push`.

---

# 7. Release gate

Статус `PRODUCTION READY` возможен только если:

- нет P0/P1 visual bugs;
- персонажи стабильны;
- Wave 1 сцены приняты;
- camera не клиппится;
- planner восстанавливается;
- нет утечек actors/mixers/listeners;
- performance budget соблюдён;
- generated assets имеют реестр и происхождение;
- secrets отсутствуют;
- build проходит.

---

# Финальный отчёт

```md
## Итоговый визуальный статус

PRODUCTION READY / NEEDS POLISH / NOT READY

## Персонажи
## Анимации
## Cinematic Director
## Сюжетные сцены
## Офис и материалы
## Свет и post-processing
## Higgsfield assets
## Метрики до
## Метрики после
## Quality presets
## Visual regression
## Первый полный прогон
## Второй полный прогон
## Production build
## Оставшиеся проблемы
## Git status
```
