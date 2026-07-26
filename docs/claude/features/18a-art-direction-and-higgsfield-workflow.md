# Feature 18A — Art Direction и Higgsfield workflow

## Цель

Зафиксировать единый художественный стиль и безопасный воспроизводимый процесс работы с Higgsfield до изменения персонажей и сцен.

Эта часть не должна массово заменять модели, анимации или камеры.

---

# 1. Аудит интеграции

Claude Code должен найти фактически доступные:

- Higgsfield CLI;
- MCP tools;
- API или project skills;
- image generation;
- video generation;
- character/reference consistency;
- keyframes/storyboard;
- motion control;
- upscale;
- background removal;
- форматы экспорта;
- ограничения по размеру и стоимости.

Проверить:

- где хранится секрет;
- что секрет не попадает в Git и клиент;
- куда сохраняются generated assets;
- какие форматы реально поддерживает проект;
- как повторить генерацию;
- как сохраняются prompts и параметры.

Не печатать секрет.

---

# 2. Структура art pipeline

Создать:

```text
docs/art/
  visual-art-bible.md
  higgsfield-workflow.md
  asset-approval-process.md
  generated-asset-register.md
  references/
  characters/
  office/
  cinematics/

assets/source/
assets/generated/
public/production/
```

Если структура проекта отличается, адаптировать пути, сохранив разделение:

- source/references;
- generated candidates;
- approved production assets.

Rejected previews не должны импортироваться production-кодом.

---

# 3. Visual Art Bible

`docs/art/visual-art-bible.md` должна фиксировать:

- степень стилизации;
- пропорции тела и головы;
- форму глаз и лица;
- материалы кожи и волос;
- правила одежды;
- палитру персонажей;
- палитру офиса;
- материал стен, пола, стекла, дерева и металла;
- правила освещения;
- cinematic contrast;
- правила subtitles;
- правила UI внутри 3D;
- допустимый post-processing;
- запрещённые визуальные решения.

Не менять стиль на основании одной удачной генерации.

---

# 4. Style exploration

Через доступные Higgsfield tools подготовить ограниченное число style boards:

- 3 варианта общего визуального направления;
- 3 варианта офиса;
- 2 варианта cinematic lighting;
- 2 варианта персонажной стилизации.

Все варианты должны сохранять существующее направление игры.

Для каждого:

- prompt;
- model/tool;
- parameters;
- reference assets;
- плюсы;
- минусы;
- performance implications;
- причина принятия или отклонения.

Выбрать один основной стиль и один fallback.

---

# 5. Prompt standard

Создать шаблон prompt, содержащий:

- approved style;
- конкретного персонажа или локацию;
- действие;
- эмоцию;
- camera shot;
- focal feeling;
- lighting;
- palette;
- важные props;
- consistency constraints;
- negative constraints.

Запрещены общие prompts вида `make it cinematic`.

---

# 6. Реестр ассетов

`generated-asset-register.md` должен содержать:

| Asset ID | Tool/model | Prompt file | Status | License/source | Production path |
|---|---|---|---|---|---|

Статусы:

- draft;
- review;
- approved;
- rejected;
- integrated;
- deprecated.

---

# 7. Quality gates

Generated asset нельзя использовать в production, пока не проверены:

- visual consistency;
- resolution;
- alpha;
- color space;
- compression;
- texture size;
- происхождение;
- отсутствие watermark;
- отсутствие identity drift;
- реальная необходимость.

---

# 8. Тесты и проверки

- production bundle не импортирует `rejected`;
- paths approved assets существуют;
- секрет отсутствует в tracked files и bundle;
- generated register не содержит секрет;
- build проходит;
- размер bundle до и после зафиксирован.

---

# Критерий завершения 18A

Не переходить к 18B, пока:

- изучена реальная интеграция;
- создана Art Bible;
- выбран единый стиль;
- создан workflow prompts и approval;
- структура ассетов готова;
- секрет безопасен;
- production build проходит.
