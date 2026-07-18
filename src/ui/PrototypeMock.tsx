import { useState } from 'react'
import { useProductStore } from '../game/productStore'
import './ui.css'

type Step = 'login' | 'rooms' | 'time' | 'confirmed'

const ROOMS = ['Переговорная «Север»', 'Переговорная «Космос»', 'Переговорная «Библиотека»']
const TIMES = ['10:00', '11:30', '14:00', '16:30']

// A purely visual mock of the OfficeFlow product, unlocked after the first
// prototype milestone. No backend, no real bookings, no time/budget effect -
// just a click-through of the assembled flow (login → rooms → time → confirm).
export function PrototypeMock() {
  const open = useProductStore((s) => s.prototypeOpen)
  const close = useProductStore((s) => s.closePrototype)
  const [step, setStep] = useState<Step>('login')
  const [room, setRoom] = useState<string | null>(null)
  const [time, setTime] = useState<string | null>(null)

  if (!open) return null

  const reset = () => {
    setStep('login')
    setRoom(null)
    setTime(null)
  }
  const done = () => {
    reset()
    close()
  }

  return (
    <div className="overlay-backdrop" onClick={done}>
      <div className="prototype" onClick={(e) => e.stopPropagation()}>
        <button className="finance-close" onClick={done} aria-label="Закрыть">
          ✕
        </button>
        <div className="proto-brand">OfficeFlow</div>

        {step === 'login' ? (
          <div className="proto-screen">
            <h3>Вход сотрудника</h3>
            <input className="proto-input" placeholder="Логин" defaultValue="a.belova" readOnly />
            <input className="proto-input" placeholder="Пароль" type="password" defaultValue="demo" readOnly />
            <button className="primary" onClick={() => setStep('rooms')}>
              Войти
            </button>
          </div>
        ) : null}

        {step === 'rooms' ? (
          <div className="proto-screen">
            <h3>Каталог переговорных</h3>
            <ul className="proto-rooms">
              {ROOMS.map((r) => (
                <li key={r}>
                  <span>{r}</span>
                  <button
                    className="proto-pick"
                    onClick={() => {
                      setRoom(r)
                      setStep('time')
                    }}
                  >
                    Забронировать
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {step === 'time' ? (
          <div className="proto-screen">
            <h3>{room}</h3>
            <p className="proto-sub">Выберите время</p>
            <div className="proto-times">
              {TIMES.map((t) => (
                <button
                  key={t}
                  className={time === t ? 'proto-time proto-time--on' : 'proto-time'}
                  onClick={() => setTime(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <button className="primary" disabled={!time} onClick={() => setStep('confirmed')}>
              Подтвердить бронирование
            </button>
          </div>
        ) : null}

        {step === 'confirmed' ? (
          <div className="proto-screen proto-screen--confirmed">
            <div className="proto-check">✓</div>
            <h3>Бронирование подтверждено</h3>
            <p className="proto-sub">
              {room} · сегодня в {time}
            </p>
            <button className="sprint-secondary" onClick={reset}>
              Забронировать ещё
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
