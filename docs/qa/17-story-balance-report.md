# Feature 17 — отчёт о балансе сюжетной кампании Level 1

Дата: 2026-07-26. Симулятор: `tools/balance/campaignSimulator.ts` + сценарии
`tools/balance/storyScenarios.test.ts` (детерминированные, через реальные
store/handlers/checkpoints; деньги читаются только из ledger).

Все суммы, effort и impacts — из `src/game/balance/` (`storyBalance`,
`timelineBalance.LEVEL1_TIMELINE_BALANCE`). Числа Features 01–16 не менялись.

## Результаты обязательных путей

| Сценарий | Путь | Итог | Score | Бюджет на финише | Зарплаты | Релиз |
|---|---|---|---|---|---|---|
| SEC-01 Осторожный | audit → JIT → synthetic → full drill → separated → report → known risk | **win** | 76 (stable) | 478 000 ₽ | 782 000 ₽ | спринт 5, день 7 |
| SEC-02 Штатный безопасник | hire Ilya → controlled → masked → logging → full drill → review → quiet (успешно) → known risk | **win** | 72 (stable) | 64 000 ₽ | 1 196 000 ₽ | спринт 5, день 7 |
| SEC-03 Быстрый рискованный | audit → permanent admin → production data → configure only → shared → quiet → known risk | **win** | 71 (stable) | 702 000 ₽ | 748 000 ₽ | спринт 5, день 5 |
| SEC-04 Катастрофа | hire path без найма → production data → postpone → shared → dismiss | **loss: `unrecoverable-project-data-loss`** (S4D6, после final warning S4D3) | — | — | — | — |
| SEC-05 Позднее спасение | как SEC-04, но drill принят на final warning | **playing** (спасён): `project-recovered-verified`, drill 60 000 ₽ | — | — | — | — |
| SEC-06 Непроверенная копия | как SEC-04, но configure-only | **playing**: `project-recovered-unverified`, 300 000 ₽ + 3 дня Кирилла, ровно одна транзакция | — | — | — | — |

Все шесть сценариев зелёные и воспроизводимы (`npx vitest run tools/balance/storyScenarios.test.ts`).

## Выводы

- Оба «правильных» пути (SEC-01/02) выигрывают; путь с Ильёй дороже по
  зарплате на ~414 000 ₽ и финиширует с меньшим бюджетом — цена постоянного
  контроля, как и задумано.
- Катастрофа достижима только через цепочку предупреждений: backup warning →
  final warning (S4D3, с обратным отсчётом) → развязка S4D6. Без показанного
  предупреждения terminal-ветка невозможна (тест §17.13).
- Позднее исправление реально спасает (SEC-05), configured-копия даёт
  recoverable-ветку вместо мгновенного поражения (SEC-06).

## Наблюдение для будущего тюнинга (без изменения чисел сейчас)

SEC-03 выигрывает с минимальным score (71 против 76), но финансово он
ВЫГОДНЕЕ осторожного пути (+224 000 ₽ бюджета): рискованные выборы экономят
прямые расходы, а их цена проявляется в score и в подорожавших инцидентах
(+50 000 ₽ AUTH, +40 000 ₽/+1 день shared-инциденты), которые в чистом
прогоне не случаются. Если потребуется сделать «дешёвый риск» ощутимее в
деньгах даже без инцидентов, кандидаты на тюнинг: `productionReleaseScorePenalty`,
riskPenalty высокого уровня в score, вероятностные-детерминированные пороги
серверных угроз. Изменения — только отдельной итерацией с повторным прогоном
всех сценариев (правило Feature 15).
