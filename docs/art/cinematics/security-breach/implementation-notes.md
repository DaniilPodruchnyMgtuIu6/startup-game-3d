# Implementation notes — security breach

Внутри cutscene-скрипта используются строительные блоки директора:
`playInsert` (монитор), `playShot('two-shot'|'medium-close'|'over-the-shoulder'|
'reaction'|'close-up')` и `attachPerLineShots` для пер-репличного перекрытия.
Игрок встаёт навстречу аудиторам (`PLAYER_STAND_MARK`) — стоячая конфронтация
и валидный facepalm; guard1 играет `angryTalk` через `director.perform`.
