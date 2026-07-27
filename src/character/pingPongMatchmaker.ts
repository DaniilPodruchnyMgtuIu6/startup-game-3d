// 18H Wave 3 (§17): the ping-pong "find a partner, reserve both atomically,
// hold, release" flow. A paired activity does not fit the per-character
// solo planner (planNextActivity picks ONE target for ONE character) - this
// is a small, separate coordinator, not a parallel planning system: it only
// ever dispatches the same CLICK_PERFORM_ACTIVITY event the solo planner
// already uses, on top of the existing claim registry and characterMachine.
import { useEffect, useRef } from 'react'
import { useCharacterStore, PLAYER_ID } from './characterStore'
import { useGameStore } from '../game/gameStore'
import { useGameOutcomeStore } from '../game/gameOutcomeStore'
import { getInteractions } from '../interaction/interactionRegistry'
import { tryReservePairActivity, releasePairActivity } from '../interaction/pairActivityReservation'
import { AMBIENT_OFFICE_BALANCE } from '../game/balance'

const CHECK_INTERVAL_MS = 5000
const MATCH_CHANCE_PER_CHECK = 0.3
// Navigation-failure guard (one participant gets pulled into a story scene,
// hire change, etc. mid-walk) - not a sync mechanism, same role as
// meetingSlots.ts's GATHER_TIMEOUT_MS.
const ARRIVAL_TIMEOUT_MS = 15000

export function shuffledPairFrom(ids: string[], rng: () => number): [string, string] | null {
  if (ids.length < 2) return null
  const pool = [...ids]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return [pool[0], pool[1]]
}

// 18H §15: NPC brains stay unpredictable via an injected rng (same convention
// as npcBehavior.ts's createRng) - the default is real randomness in play,
// a seq() stub makes the whole flow deterministic in tests.
export function usePingPongMatchmaker(rng: () => number = Math.random): void {
  const activeRef = useRef(false)

  useEffect(() => {
    const interval = setInterval(() => {
      if (activeRef.current) return
      if (useGameStore.getState().phase !== 'free') return
      if (useGameOutcomeStore.getState().status !== 'playing') return
      if (rng() > MATCH_CHANCE_PER_CHECK) return

      const sides = getInteractions('ping-pong')
      if (sides.length < 2) return

      const store = useCharacterStore.getState()
      const eligible = Object.keys(store.characters).filter((id) => {
        if (id === PLAYER_ID) return false
        const entity = store.characters[id]
        return entity.state.kind === 'idle' && !store.sceneOwned.has(id)
      })
      const pair = shuffledPairFrom(eligible, rng)
      if (!pair) return
      const [a, b] = pair
      const [targetA, targetB] = [sides[0].target, sides[1].target]
      if (!tryReservePairActivity(a, b, targetA, targetB)) return

      activeRef.current = true
      store.dispatchTo(a, { type: 'CLICK_PERFORM_ACTIVITY', target: targetA, clip: 'pingPongRally' })
      store.dispatchTo(b, { type: 'CLICK_PERFORM_ACTIVITY', target: targetB, clip: 'pingPongRally' })

      const finish = () => {
        const latest = useCharacterStore.getState()
        if (latest.characters[a]?.state.kind === 'performing') latest.dispatchTo(a, { type: 'PERFORM_END' })
        if (latest.characters[b]?.state.kind === 'performing') latest.dispatchTo(b, { type: 'PERFORM_END' })
        releasePairActivity(a, b)
        activeRef.current = false
      }

      // Hold duration only starts once BOTH have actually arrived - the same
      // reasoning as the group-scene camera-ready barrier (18H §5): a rally
      // that starts counting down while someone is still walking there
      // shortchanges the activity by however long the walk took.
      const arrivalTimeout = setTimeout(() => {
        unsubscribe()
        finish()
      }, ARRIVAL_TIMEOUT_MS)
      const unsubscribe = useCharacterStore.subscribe(() => {
        const s = useCharacterStore.getState()
        const ready = (id: string) => s.characters[id]?.state.kind === 'performing'
        if (!ready(a) || !ready(b)) return
        unsubscribe()
        clearTimeout(arrivalTimeout)
        const [minS, maxS] = AMBIENT_OFFICE_BALANCE.socialActivityDurationSeconds
        setTimeout(finish, (minS + rng() * (maxS - minS)) * 1000)
      })
    }, CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])
}
