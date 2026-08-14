# Acceptance — mfa-fatigue-attack

| Критерий | Статус |
|---|---|
| Сцена интересна как сюжет, объясняет security через рабочую ситуацию | ✅ (диалог/выборы см. `cyberStoryDialogues.ts::mfaFatigueScene`) |
| 2–3 разумных варианта, нет одной бесплатной очевидно правильной кнопки | ✅ (password-only/investigate/phishing-resistant; investigate стоит деньги+время, phishing-resistant стоит больше денег+время) |
| `change-password-only` явно НЕ отзывает активную сессию | ✅ (`flags.unknownSessionState` остаётся `'active'`, не автоматически очищается) |
| Связь с Feature 19A (сильная phishing-защита ослабляет impact) реализована явным селектором и протестирована | ✅ (`hasStrongPhishingDefense`, `cyberStoryLinkedEffects.ts` + тест) |
| Отложенное последствие может создать ограниченный modifier к supply-chain/серверному инциденту, без нового вредоносного кода | ✅ (`hijackedSessionSupplyChainCostRub` → `getCyberStoryIncidentCostModifierRub`, никакого исполняемого кода) |
| Fallback без Higgsfield работает | ✅ проверено vitest + живой браузер |
| Не физическое проникновение, не дублирует office-intrusion и другие сцены Feature 19 | ✅ |
| Generated video asset | ✅ сгенерирован (nano_banana_2 → kling3_0_turbo) и проверен живым браузером — `public/cutscenes/mfa-fatigue-attack-insert.mp4` |
| Character identity/scale unchanged | ✅ (insert — только реквизит/экран, без персонажей) |

**Итог: approved (video integrated + fallback verified).**
