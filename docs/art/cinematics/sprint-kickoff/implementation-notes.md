# Implementation notes — sprint kickoff

`WorkdayFlowController` вызывает
`beginConversationCinematic({ autoEndOnDialogueClose: true })` сразу после
`startDialogue(kickoff)`. Спикер каждой реплики резолвится по имени через
реальный каст (`characterIdForSpeaker`); шоты — `cinematicShots` +
`makeShotSafe` (камера в комнате субъекта). HUD скрывает `useCinematicStore`,
letterbox — `CinematicBars`.
