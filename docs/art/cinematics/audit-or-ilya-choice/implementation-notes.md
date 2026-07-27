# Implementation notes — audit-or-Ilya choice

`runPostAuditConversation` оборачивает весь разговор в
`beginConversationCinematic({ pairA: PLAYER_ID, pairB: SONYA })` и завершает
его в `finally` (`cinematic.end()`), поэтому камера и HUD восстанавливаются
даже при ошибке. OTS-стороны чередуются на каждой реплике; выбор игрока
происходит на удержанном кадре пары.
