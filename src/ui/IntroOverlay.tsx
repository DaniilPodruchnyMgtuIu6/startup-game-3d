import { useState } from 'react'
import { useGameStore } from '../game/gameStore'
import './ui.css'

const STORY_STEPS = [
  {
    title: 'Совет директоров',
    text: 'Совет директоров собрал вас не для поздравлений. Прежний руководитель отдела разработки не справился: сроки сорваны, продукт застрял в бесконечной доработке, команда разбежалась.',
  },
  {
    title: 'Ваша задача',
    text: 'Теперь отдел — ваша ответственность. Наладьте процессы, соберите сильную команду и доведите продукт до релиза. Учитывать придётся всё: разработку, качество, людей и сроки. Результат спросим с вас лично.',
  },
] as const

// The welcome sequence: two story cards from upper management, then the
// player-name step. Visible only in phase 'intro'.
export function IntroOverlay() {
  const phase = useGameStore((s) => s.phase)
  const completeIntro = useGameStore((s) => s.completeIntro)
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [invalid, setInvalid] = useState(false)

  if (phase !== 'intro') return null

  const isNameStep = step === STORY_STEPS.length
  const submitName = () => {
    if (!name.trim()) {
      setInvalid(true)
      return
    }
    completeIntro(name)
  }

  return (
    <div className="overlay-backdrop">
      <div className={invalid ? 'intro-card shake' : 'intro-card'} onAnimationEnd={() => setInvalid(false)}>
        {isNameStep ? (
          <>
            <h2>Как к вам обращаться?</h2>
            <input
              autoFocus
              value={name}
              placeholder="Ваше имя"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitName()}
            />
            <button className="primary" onClick={submitName}>
              Приступить
            </button>
            <p className="hint">Найдите продакт-менеджера — она введёт вас в курс дела.</p>
          </>
        ) : (
          <>
            <div className="intro-header">
              <img className="portrait intro-portrait" src="/portraits/board.svg" alt="Совет директоров" />
              <h2>{STORY_STEPS[step].title}</h2>
            </div>
            <p>{STORY_STEPS[step].text}</p>
            <button className="primary" onClick={() => setStep(step + 1)}>
              Далее
            </button>
          </>
        )}
        <div className="dots">
          {[0, 1, 2].map((i) => (
            <span key={i} className={i === step ? 'dot active' : 'dot'} />
          ))}
        </div>
      </div>
    </div>
  )
}
