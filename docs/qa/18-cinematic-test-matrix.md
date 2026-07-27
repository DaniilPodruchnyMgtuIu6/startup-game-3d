# 18G — Cinematic test matrix (факт 2026-07-27)

| Сцена | Триггер | Прогон | Камера eye-level | Recovery | Кадры |
|---|---|---|---|---|---|
| sprint-kickoff | live (day1) | e2e workday + capture | ✓ | auto-end + brains resume | 3 |
| audit-or-Ilya | live | e2e story-baseline (1.4м, end-to-end) | ✓ | finally + resumePlanner | — |
| security-breach | live (авто-триггер) | capture полный до facepalm | ✓ | scene recovery тест | 7 |
| office-intrusion | dev-триггер | capture: tracking → OTS → финал | ✓ | markIntrusionFailed на ошибке | 4 |
| «утро без проекта» | consequence | юниты 17C (эффекты) | ✓ (insert+dolly-out) | finally | сид длинный — ручной чек-лист |
| mvp-release | dev-триггер | capture до экрана победы | ✓ | rewind on error | 3 |
| 7 сцен решений (Wave 2) | live | e2e baseline под камерой + 1024 юнитов | ✓ | finally | — |
| follow-up audit / server×3 / Илья-интро (Wave 3) | live | юниты (логика не менялась) | ✓ | стандартные пути | — |

Reload during scene: consequence/decision — replay текста без повторных
эффектов (идемпотентность 17B/17C, юниты); cutscene — recovery-тесты.
Duplicate effects: markEffectAppliedOnce/…Once — юниты. Skip: не предусмотрен
дизайном (диалоги кликаются быстро) — соответствует «skip если разрешён».

## Ручной чек-лист на целевой машине (для владельца)

1. FPS в open space с 4 NPC ≥ 50; в сценах ≥ 40 (1080p).
2. «Утро без проекта»: сид потери данных → insert → отъезд → тёмный офис.
3. Смена quality low↔high на лету (dev-панель) без артефактов.
4. 20-минутный soak: память стабильна, разговоры NPC продолжают идти.
