import { useGameStore } from '../game/gameStore'
import { useCinematicStore } from '../game/cinematics/cinematicDirector'
import { useCutsceneStore } from '../cutscenes/cutsceneStore'
import './ui.css'

// Bottom dialogue panel: one line at a time with the speaker's name and
// role. Once a dialogue's last line has been read, a scene may follow up
// with a player choice (activeChoice) - the panel then swaps the single
// advance button for one button per option.
export function DialoguePanel() {
  const dialogue = useGameStore((s) => s.activeDialogue)
  const advance = useGameStore((s) => s.advanceDialogue)
  const choice = useGameStore((s) => s.activeChoice)
  const chooseOption = useGameStore((s) => s.chooseOption)
  // 18H §8: in cinematic/cutscene shots the panel goes compact and hugs the
  // bottom edge so heads and eyes stay clear of the subtitle safe area.
  const cinematic = useCinematicStore((s) => s.active)
  const panelSide = useCinematicStore((s) => s.panelSide)
  const cutscene = useCutsceneStore((s) => s.activeSceneId !== null)
  const compact = cinematic || cutscene ? ' dialogue-panel--cinematic' : ''
  // panelSide is only maintained during a conversation cinematic (director
  // projects the current shot's heads every line); shifts the panel off
  // center only when it would otherwise sit under someone's head.
  const sideClass = cinematic && panelSide !== 'center' ? ` dialogue-panel--${panelSide}` : ''

  if (choice) {
    return (
      <div className={`dialogue-panel dialogue-panel--choice${compact}${sideClass}`}>
        <div className="card-body">
          <div className="dialogue-choices">
            {choice.options.map((option) => (
              <button key={option.id} className="primary dialogue-choice" onClick={() => chooseOption(option.id)}>
                <span className="dialogue-choice-label">{option.label}</span>
                {option.hint ? <span className="dialogue-choice-hint">{option.hint}</span> : null}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!dialogue) return null

  const line = dialogue.lines[dialogue.index]
  const isLast = dialogue.index === dialogue.lines.length - 1

  return (
    <div className={`dialogue-panel${compact}${sideClass}`}>
      {line.portrait ? <img className="card-picture" src={line.portrait} alt={line.speaker} /> : null}
      <div className="card-body">
        <div className="dialogue-speaker">
          {line.speaker}
          {line.speakerRole ? <span className="dialogue-role"> · {line.speakerRole}</span> : null}
        </div>
        <p className="dialogue-text">{line.text}</p>
        <button className="primary" onClick={advance}>
          {isLast ? (dialogue.closingLabel ?? 'Далее') : 'Далее'}
        </button>
      </div>
    </div>
  )
}
