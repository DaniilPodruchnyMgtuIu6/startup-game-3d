# Implementation notes — backup-and-restore-strategy
Один вызов в `runStoryDecisionConversation`: beginConversationCinematic
(pairA=PLAYER, pairB=лид) + DECISION_INSERT-карта сигнатурных вставок.
Эффекты/выборы 17B не тронуты (resolveDecision вызывается в исходной точке).
