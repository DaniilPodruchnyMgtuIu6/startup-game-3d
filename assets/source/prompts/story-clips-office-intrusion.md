# story-clips-office-intrusion (два сюжетных видеоклипа)

## v1 (2026-07-28, первая генерация — ЗАМЕНЕНА)

- Jobs: кейфреймы d2a1a479 (stopped, identity-ref: ilya_neutral.jpg) /
  7a8f91c5 (reached); видео 70e72aa3 (stopped) / 58134dcd (reached)
- Живой отзыв игрока: курьер в этих клипах получился полнее/плотнее
  телосложением, чем задумано для 3D-модели, которую собирали следующим
  шагом (`docs/art/characters/intruder-visitor/generation-prompts.md`) —
  видео и модель разошлись бы по силуэту.

## v2 (2026-07-28, пересборка под единый эталон — ТЕКУЩАЯ)

- Tool/model: Higgsfield MCP / nano_banana_2 (кейфреймы) + kling3_0_turbo (image-to-video)
- Cost: 2 кейфрейма ~1.5 cr + 2 видео по 7.5 cr
- Aspect/resolution: 16:9, 720p, 5 с, без звука (в игре проигрывается muted)
- Identity-референс курьера ВО ВСЕХ кейфреймах v2 — один и тот же
  портрет `intruder_neutral` (job cd10a57b, тот же, с которого собрана
  3D-модель), явно с промптом «keep his body proportions and slim build
  EXACTLY as shown, do not make him heavier or bulkier»
- Jobs: кейфреймы 3d060163 (stopped, courier-ref cd10a57b + Ilya-ref
  f4db2c39) / f9a856dd (reached, courier-ref cd10a57b); видео 9529f9c2
  (stopped) / b64d3991 (reached)
- Style: soft Pixar-like 3D, окружение повторяет язык офиса игры
  (стеклянные перегородки с импостами, тёплый деревянный пол, белые столы,
  синяя акцентная стена, вечерний свет)
- Сюжет (канон Feature 10 соблюдён: данные НЕ показаны украденными):
  - stopped: курьер с коробкой входит в проём, безопасник (identity Ильи)
    преграждает путь вытянутой рукой и указывает на выход, курьер пятится;
  - reached: курьер в одиночку у светящегося монитора, дёргает его — монитор
    падает, бумаги разлетаются, курьер замирает и виновато озирается.
- Проверка: оба клипа покадрово сверены (0.2/2.5/4.6 с) — телосложение
  курьера стабильно совпадает с эталонным портретом на всей длительности.
- Post-processing: нет (mp4 как отдан провайдером, ~3.5-4.6 МБ каждый)
- Result:
  - public/cutscenes/office-intrusion-stopped.mp4
  - public/cutscenes/office-intrusion-reached.mp4
- Использование: officeIntrusion.ts играет клип ВМЕСТО прохода-подхода
  (playVideoCutscene), после клипа сцена открывается сразу на разборе
  последствий; при недоступности файла/кодека — полный откат на прежнюю
  3D-постановку (клик = пропуск, watchdog 30 с).
