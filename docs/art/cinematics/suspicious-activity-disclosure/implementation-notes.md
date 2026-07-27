# Implementation notes — suspicious-activity-disclosure
Один вызов в `runStoryDecisionConversation`: beginConversationCinematic
(pairA=PLAYER, pairB=лид) + DECISION_INSERT-карта сигнатурных вставок.
Эффекты/выборы 17B не тронуты (resolveDecision вызывается в исходной точке).
