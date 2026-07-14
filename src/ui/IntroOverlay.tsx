import { useState } from 'react'
import { useGameStore } from '../game/gameStore'
import { BOSS_PICTURE, VERY_ANGRY_BOSS_PICTURE } from '../game/dialogues'
import { businessMan } from '../character/characters/businessMan'
import './ui.css'

const STORY_STEPS = [
  {
    title: 'Совет директоров',
    text: 'Так, садитесь. Поздравлять вас не с чем. Прежний руководитель отдела провалил всё, что можно: сроки сорваны, продукт застрял в вечной доработке, команда разбежалась. А отдуваться перед акционерами приходится мне!',
  },
  {
    title: 'Ваша задача',
    text: 'Теперь отдел — ваша головная боль. Наладьте процессы, соберите команду и доведите продукт до релиза. И запомните: не справимся — нам всем конец. Отдел закроют, а нас с вами вышвырнут на улицу. Ну что, берётесь?',
  },
] as const

// The opening sequence: the annoyed chairman lays out the situation, the
// player accepts (name step) or refuses (fired - game over with restart).
export function IntroOverlay() {
  const phase = useGameStore((s) => s.phase)
  const completeIntro = useGameStore((s) => s.completeIntro)
  const refuseJob = useGameStore((s) => s.refuseJob)
  const restartGame = useGameStore((s) => s.restartGame)
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [invalid, setInvalid] = useState(false)

  if (phase === 'fired') {
    return (
      <div className="overlay-backdrop">
        <div className="intro-card">
          <img className="card-picture" src={VERY_ANGRY_BOSS_PICTURE} alt="Разъярённый председатель" />
          <div className="card-body">
            <h2>Вы уволены!</h2>
            <p>
              ЧТО?! Тогда какого чёрта вы вообще сюда пришли?! Вон из моего кабинета! Охрана, проводите!
            </p>
            <p className="hint">Игра окончена. Отдел закрыли, продукт так и не вышел.</p>
            <button className="primary" onClick={() => { setStep(0); setName(''); restartGame() }}>
              Начать заново
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase !== 'intro') return null

  const submitName = () => {
    if (!name.trim()) {
      setInvalid(true)
      return
    }
    completeIntro(name)
  }

  const isChoiceStep = step === STORY_STEPS.length
  const isNameStep = step === STORY_STEPS.length + 1

  return (
    <div className="overlay-backdrop">
      <div className={invalid ? 'intro-card shake' : 'intro-card'} onAnimationEnd={() => setInvalid(false)}>
        <img
          className="card-picture"
          src={isChoiceStep || isNameStep ? businessMan.portrait : BOSS_PICTURE}
          alt={isChoiceStep || isNameStep ? 'Вы' : 'Председатель совета директоров'}
        />
        <div className="card-body">
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
          ) : isChoiceStep ? (
            <>
              <h2>Ваш ответ</h2>
              <p>Отдел в руинах, сроки горят, а спрос будет с вас. Берётесь за дело?</p>
              <div className="choice-row">
                <button className="primary" onClick={() => setStep(step + 1)}>
                  Берусь за дело
                </button>
                <button className="ghost" onClick={refuseJob}>
                  Отказаться
                </button>
              </div>
            </>
          ) : (
            <>
              <h2>{STORY_STEPS[step].title}</h2>
              <p>{STORY_STEPS[step].text}</p>
              <button className="primary" onClick={() => setStep(step + 1)}>
                Далее
              </button>
            </>
          )}
          <div className="dots">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={i === step ? 'dot active' : 'dot'} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
