# Higgsfield workflow — аудит интеграции и процесс генерации

Дата аудита: 2026-07-26 (ветка `visual-polish`).

## 1. Фактически доступная интеграция

| Канал | Статус | Примечание |
|---|---|---|
| **MCP-сервер `higgsfield`** | ✅ подключён (OAuth через `/mcp`) | единственный рабочий канал |
| CLI `higgsfield` | ❌ не установлен | не выдумывать команды |
| Прямой API-ключ | ❌ отсутствует и не нужен | авторизация — OAuth сессии MCP |
| Project skills | ✅ `higgsfield-generate`, `higgsfield-game-generation` и др. | маршрутизация на MCP-инструменты |

Ключевые MCP-инструменты (проверены в работе): `generate_image`,
`generate_video`, `generate_3d` (+ `animation_actions`, 678 пресетов),
`upscale_image`, `upscale_video`, `remove_background`, `outpaint_image`,
`reframe`, `motion_control`, `models_explore` (каталог/цены через
`get_cost: true` — бесплатно), `media_upload`/`media_import_url`/`media_confirm`,
`balance`, `show_generations`.

### Модели и фактические цены (замерены preflight-ом)

| Задача | Модель | Цена | Доступность на free-плане |
|---|---|---|---|
| Персонажи/референсы (identity consistency) | `nano_banana_2` (роль медиа: `image`) | 1.5 кр | ✅ работает |
| Быстрая графика/текст | `gpt_image_2` | 0.5–1 кр | ❌ требует Basic+ |
| Лёгкие изображения | `nano_banana_2_lite` | 1 кр | ❌ требует Basic+ |
| Видео 5с | `seedance_2_0` | 22.5 кр | не проверялась |
| 3D-предмет (текстуры+PBR) | `image_to_3d` / `meshy_v6_text_to_3d` | 30 / 25 кр | не проверялась |
| 3D-персонаж (риг+1 анимация) | `image_to_3d` full | 38 кр | не проверялась |
| Доп. анимация на риг | `3d_rigging` | 8 кр | не проверялась |

**Текущий баланс: 1 кредит (free-план).** Новые генерации требуют пополнения
(триал 100 кр / PLUS 1000 кр/мес — ссылки в чате сессии).

## 2. Секреты

- Локального ключа Higgsfield **не существует**: MCP авторизуется OAuth-сессией
  клиента, в репозиторий/бандл ничего не попадает.
- `.env.example` содержит только DeepSeek-переменные (Feature 14), guard-тесты:
  `server/secretGuards.test.ts` + `tools/art/artPipeline.test.ts`.
- Правило: никакие ключи не печатаются в логи, документы и промпт-файлы.

## 3. Где хранятся ассеты

| Слой | Путь | Правило |
|---|---|---|
| Промпты и параметры (source of truth) | `assets/source/prompts/*.md` | 1 файл = 1 генерация/серия; формат ниже |
| Кандидаты генераций (draft/review/rejected) | `assets/generated/` | НЕ импортируется production-кодом (тест) |
| Принятые production-ассеты | `public/dialogue_pictures/`, `public/posters/`, `public/textures/`, `public/character/` | только статус `approved`→`integrated` в реестре |

Историческая адаптация (§2 фичи): production-ассеты предыдущей итерации уже
живут в `public/…` — пути сохранены, чтобы не ломать код и сейвы; новые
кандидаты проходят через `assets/generated/`.

## 4. Как повторить генерацию

1. Взять промпт-файл из `assets/source/prompts/` (модель, параметры, роль
   референса, media id/файл референса).
2. Референс загрузить через `media_upload` → PUT → `media_confirm` (или
   `media_import_url`).
3. `generate_image` с теми же `model/prompt/aspect_ratio/resolution/medias`.
4. Результат скачать в `assets/generated/<area>/<asset-id>/`, добавить строку
   в реестр со статусом `draft`.
5. Пост-обработка: crop/resize/сжатие через `sharp` (devDependency), JPEG
   quality 82–86; целевые размеры — как у существующих ассетов (портрет
   768×1024, постер 768×1024, экран 1376×768).

Генерации недетерминированны (seed не гарантирует идентичность между
версиями моделей) — «повторить» значит воспроизвести процесс и критерии
приёмки, а не байт-в-байт результат. Поэтому принятые файлы коммитятся.

## 5. Формат промпт-файла

```md
# <asset-id>
- Tool/model: …
- Date, session: …
- Cost: … credits
- Aspect/resolution: …
- Reference media: <файл или media id + как загружен>
- Prompt: <полный текст>
- Post-processing: <crop/resize/quality>
- Result: <итоговые production-пути или rejected>
```

## 6. Style exploration (итог)

Полноценные генеративные style boards отложены до пополнения кредитов
(п. «Ограничения» ниже). Выбор стиля зафиксирован по шести УЖЕ принятым
ассетам прошлой итерации — сравнение направлений и решение записаны в
`asset-approval-process.md` (§Style decision), итоговый стиль — в
`visual-art-bible.md`: основной «Soft Pixar-like 3D», fallback «Flat vector
OfficeFlow» для плоской графики.

## 7. Ограничения

- Free-план блокирует `gpt_image_2`/`nano_banana_2_lite`; рабочая модель —
  `nano_banana_2` (1.5 кр/изображение).
- Изображение >50 МБ нельзя импортировать по URL; результаты отдаются CDN-URL.
- 3D-генерации (Meshy/Tripo) выдают GLB; риг только гуманоидный; в проект
  встраиваются через существующий конвейер `scripts/convert-character.mjs`
  (отдельные части Feature 18).
