# Офис: свет, состояния и storytelling (Feature 18E)

Мудборды-эталоны: `docs/art/references/environment/` (8 листов Higgsfield —
зоны + alert/success/failure). Планировка и позиция whiteboard не менялись.

## Состояния света (§6)

`src/scene/lighting/lightingStates.ts` — чистая функция игрового состояния
(реальное время НЕ используется): приоритет
`failure > success > server-incident > security-alert > audit > morning
(день 1) > evening (день 10) > normal-workday`. Источники: gameOutcome,
стойки серверов (broken/repairing), угроза проникновения (armed/pending/
running), блокирующий повторный аудит, игровой день спринта.

`SceneLights` демпфирует intensity/цвета к пресету (~0.5 с) — без скачков.
Гарантии пресетов (закреплены тестом): ambient ≥ 0.2, key ∈ [0.9, 2] —
лица читаемы, пересвета и чёрных теней нет. Cinematic-свет не задерживается:
состояние пересчитывается из сторов каждый кадр рендера.

## Environmental storytelling (§5, детерминированно и персистентно)

| Факт кампании | Признак в офисе | Источник |
|---|---|---|
| Пройден security-training (breach completed) | памятка «Уходишь? Заблокируй экран!» на стене | securityStoryStore |
| Открыт корректирующий план | стопка бумаг + красная папка на столе Сони; свет «audit» | securityAuditStore |
| СКУД внедрена | считыватель у входа | accessControlStore (была с F10) |
| Серверный инцидент | красные LED стойки + свет «server-incident» | serverIncidentsStore (LED с F11) |
| Провал кампании | все экраны офиса гаснут, холодный сумеречный свет | gameOutcomeStore |
| Победа | все мониторы показывают dashboard, золотистый свет | gameOutcomeStore |

## Quality tiers (§7)

`src/scene/qualityStore.ts` (persisted `startup-office-quality`, дефолт high):

| Tier | dpr max | Shadows | AO | Bloom/Vignette |
|---|---|---|---|---|
| low | 1.0 | — | — | — |
| medium | 1.25 | ✓ | — | ✓ |
| high | 1.5 | ✓ | ✓ | ✓ |
| cinematic | 2.0 | ✓ | ✓ | ✓ |

Gameplay не размывается ни на одном тире (DOF/grain не включены — резерв
cinematic-сцен 18F). Переключатель — dev-панель (Render → quality);
игровой UI настройки — кандидат 18G.

## Environment audit (§1, 2026-07-27)

Вход/open space/кабинет/серверная/whiteboard/проходы — layout не менялся;
navmesh и клиренсы камер не тронуты (правки только материалы/свет/пропсы вне
проходов). Материальная система уже разделяет стены/пол(2)/стекло/металл(2)/
пластик/дерево/кожу/ткань/экраны(3)/LED (§3) на Poly Haven текстурах + sRGB.
