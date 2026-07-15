import { useState } from 'react'
import type { MinigameModule } from './registry'
import {
  type SqliScenario,
  buildConcatQuery,
  concatBypasses,
  buildParamQuery,
  pickSqliScenario,
  sqliTakeaways,
} from './sqli'

type Phase = 'attack' | 'attack-done' | 'fix'

function SqliGame({
  scenario,
  onWin,
  onLose,
}: {
  scenario: SqliScenario
  onWin: () => void
  onLose: () => void
}) {
  const [phase, setPhase] = useState<Phase>('attack')
  const [input, setInput] = useState('')
  const [parameterized, setParameterized] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  const appendToken = (t: string) => setInput((prev) => prev + t)
  const clear = () => setInput('')

  const runAttack = () => {
    if (concatBypasses(scenario, input)) {
      setPhase('attack-done')
      setHint(null)
    } else {
      setHint('Пароль не подошёл. Подсказка: закрой кавычку и добавь всегда-истинное условие.')
      onLose()
    }
  }

  const runFix = () => {
    if (!parameterized) {
      setHint('Пока запрос собирается склейкой, атака снова пройдёт. Вынеси ввод в параметр (?).')
      onLose()
      return
    }
    // parameterized: the same attack string is now literal → rejected
    onWin()
  }

  const currentQuery = parameterized ? buildParamQuery(scenario) : buildConcatQuery(scenario, input || '…')

  return (
    <div>
      {phase === 'attack' ? (
        <>
          <p className="mg-hint">Фаза 1 — атака. Собери строку в поле логина, чтобы войти без пароля.</p>
          <div className="mg-query">{buildConcatQuery(scenario, input || '…')}</div>
          <div className="mg-row">
            {scenario.attackTokens.map((t, i) => (
              <button key={i} className="mg-toggle" onClick={() => appendToken(t)}>
                {t.trim() === '' ? '␣' : t}
              </button>
            ))}
            <button className="mg-toggle" onClick={clear}>
              очистить
            </button>
          </div>
          <p className="mg-hint">
            Ввод: <code>{input || '(пусто)'}</code>
          </p>
          {hint ? <p className="mg-hint">{hint}</p> : null}
          <div className="minigame-actions">
            <button className="primary" onClick={runAttack}>
              Войти
            </button>
          </div>
        </>
      ) : phase === 'attack-done' ? (
        <>
          <p className="mg-hint">Инъекция сработала — запрос пропустил тебя и утекла таблица:</p>
          <div className="mg-query">{buildConcatQuery(scenario, input)}</div>
          <ul className="minigame-takeaways">
            {scenario.leakedRows.map((r, i) => (
              <li key={i}>
                <code>{r}</code>
              </li>
            ))}
          </ul>
          <div className="minigame-actions">
            <button
              className="primary"
              onClick={() => {
                setPhase('fix')
                setHint(null)
              }}
            >
              Теперь починить →
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mg-hint">Фаза 2 — починка. Вынеси пользовательский ввод из тела запроса в параметр.</p>
          <div className="mg-query">{currentQuery}</div>
          <div className="mg-row">
            <button
              className={parameterized ? 'mg-toggle mg-toggle--on' : 'mg-toggle'}
              onClick={() => setParameterized((v) => !v)}
            >
              {parameterized ? 'ввод → параметр (?)' : 'склейка строк'}
            </button>
          </div>
          <p className="mg-hint">
            Повторная атака той же строкой <code>{input}</code>:{' '}
            {parameterized ? 'воспринята как обычный текст — вход отклонён.' : 'снова пройдёт.'}
          </p>
          {hint ? <p className="mg-hint">{hint}</p> : null}
          <div className="minigame-actions">
            <button className="primary" onClick={runFix}>
              Проверить защиту
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export const sqliModule: MinigameModule<SqliScenario> = {
  title: 'SQL-инъекция · База данных',
  pickScenario: pickSqliScenario,
  brief: (s) => s.brief,
  takeaways: sqliTakeaways,
  Component: SqliGame,
}
