# story-clips-office-intrusion (два сюжетных видеоклипа)

- Tool/model: Higgsfield MCP / nano_banana_2 (кейфреймы) + kling3_0_turbo (image-to-video)
- Date, session: 2026-07-28, итерация 18H+ (сюжетные «мультики»)
- Cost: 2 кейфрейма ~1.5 cr + 2 видео по 7.5 cr
- Aspect/resolution: 16:9, 720p, 5 с, без звука (в игре проигрывается muted)
- Jobs: кейфреймы d2a1a479 (stopped, identity-ref: ilya_neutral.jpg) /
  7a8f91c5 (reached); видео 70e72aa3 (stopped) / 58134dcd (reached)
- Style: soft Pixar-like 3D, окружение повторяет язык офиса игры
  (стеклянные перегородки с импостами, тёплый деревянный пол, белые столы,
  синяя акцентная стена, вечерний свет)
- Сюжет (канон Feature 10 соблюдён: данные НЕ показаны украденными):
  - stopped: курьер с коробкой входит в проём, безопасник (identity Ильи)
    преграждает путь вытянутой рукой и указывает на выход, курьер пятится;
  - reached: курьер в одиночку у светящегося монитора, дёргает его — монитор
    падает, бумаги разлетаются, курьер замирает и виновато озирается.
- Post-processing: нет (mp4 как отдан провайдером, ~4 МБ каждый)
- Result:
  - public/cutscenes/office-intrusion-stopped.mp4
  - public/cutscenes/office-intrusion-reached.mp4
- Использование: officeIntrusion.ts играет клип ВМЕСТО прохода-подхода
  (playVideoCutscene), после клипа сцена открывается сразу на разборе
  последствий; при недоступности файла/кодека — полный откат на прежнюю
  3D-постановку (клик = пропуск, watchdog 30 с).
