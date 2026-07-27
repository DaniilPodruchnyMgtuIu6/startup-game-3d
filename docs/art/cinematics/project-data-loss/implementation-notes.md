# Implementation notes — «утро без проекта»

`StoryConsequenceController.runConsequenceScene`: ВСЕ обязательные
consequence-сцены теперь идут под `beginConversationCinematic` (speaker-
follow, letterbox, HUD скрыт; released в finally). Для
`project-files-destroyed` дополнительно: playInsert экрана до реплик и
playShot('dolly-out', Соня, 3000) после. Эффекты (registerStoryFailure)
применяются в исходной точке потока — порядок 17C не изменён.
