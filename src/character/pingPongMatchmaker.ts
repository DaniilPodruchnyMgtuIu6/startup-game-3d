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
import { getInteractions, isTargetFree, claimTarget, releaseClaims, targetKey } from '../interaction/interactionRegistry'
import { tryReservePairActivity, releasePairActivity } from '../interaction/pairActivityReservation'
import { usePingPongRallyStore } from './pingPongRallyStore'
import { usePerformanceStore } from './performance/performanceStore'
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
    // Shared rally lifecycle (§17): arrival barrier -> ball + hold duration ->
    // idempotent cleanup. Both participants are already claimed and walking
    // when this is called. The live-watch ends the rally the moment EITHER
    // participant leaves the table early (the player walks away, an NPC gets
    // pulled into a story scene) - no ball bouncing over an empty side.
    const runRally = (a: string, b: string) => {
      activeRef.current = true
      let finished = false
      let unsubscribeLive: (() => void) | null = null
      const finish = () => {
        if (finished) return
        finished = true
        unsubscribeLive?.()
        const latest = useCharacterStore.getState()
        if (latest.characters[a]?.state.kind === 'performing') latest.dispatchTo(a, { type: 'PERFORM_END' })
        if (latest.characters[b]?.state.kind === 'performing') latest.dispatchTo(b, { type: 'PERFORM_END' })
        releasePairActivity(a, b)
        usePerformanceStore.getState().clearGaze(a, b)
        usePingPongRallyStore.getState().end()
        activeRef.current = false
      }

      // Hold duration only starts once BOTH have actually arrived - the same
      // reasoning as the group-scene camera-ready barrier (18H §5): a rally
      // that starts counting down while someone is still walking there
      // shortchanges the activity by however long the walk took.
      const arrivalTimeout = setTimeout(() => {
        unsubscribeArrival()
        finish()
      }, ARRIVAL_TIMEOUT_MS)
      const performing = (id: string) => useCharacterStore.getState().characters[id]?.state.kind === 'performing'
      const unsubscribeArrival = useCharacterStore.subscribe(() => {
        if (finished) return
        if (!performing(a) || !performing(b)) return
        unsubscribeArrival()
        clearTimeout(arrivalTimeout)
        // heads track the opponent for the whole exchange (§7 gaze layer) -
        // "смотрят на игру", not off into the office
        usePerformanceStore.getState().setGazePair(a, b)
        usePingPongRallyStore.getState().begin(a, b)
        const [minS, maxS] = AMBIENT_OFFICE_BALANCE.socialActivityDurationSeconds
        const durationTimer = setTimeout(finish, (minS + rng() * (maxS - minS)) * 1000)
        unsubscribeLive = useCharacterStore.subscribe(() => {
          if (finished) return
          if (performing(a) && performing(b)) return
          clearTimeout(durationTimer)
          finish()
        })
      })
    }

    // The PLAYER's way in: clicking a table side (clickPingPong) claims the
    // side and walks up in rally stance. Recruit an opponent to the far side
    // IMMEDIATELY (while the player is still walking - both arrive roughly
    // together, §17 barrier handles the rest). Unlike ambient NPC-NPC
    // matches, a player invitation PULLS A COLLEAGUE OFF THEIR DESK: during
    // free play everyone is usually seated working ('working'/'sittingIdle'),
    // and an idle-only filter meant nobody EVER came - the player stood at
    // the table swaying alone (the «никто не подходит» live report). Story
    // scenes and urgent states still refuse (sceneOwned + settled-state
    // filter). If truly nobody is available the player practices solo.
    const RECRUITABLE = new Set(['idle', 'working', 'sittingIdle', 'sofaSitting'])
    const playerRallyWalkTarget = () => {
      const state = useCharacterStore.getState().characters[PLAYER_ID]?.state
      if (state?.kind === 'walking' && state.onArrive.kind === 'perform' && state.onArrive.clip === 'pingPongRally') {
        return state.onArrive.target
      }
      return null
    }
    const unsubscribePlayerWatch = useCharacterStore.subscribe(() => {
      if (activeRef.current) return
      if (useGameStore.getState().phase !== 'free') return
      if (useGameOutcomeStore.getState().status !== 'playing') return
      const playerTarget = playerRallyWalkTarget()
      if (!playerTarget) return
      const sides = getInteractions('ping-pong')
      const farSide = sides.find((side) => targetKey(side.target) !== targetKey(playerTarget))
      if (!farSide) return
      const store = useCharacterStore.getState()
      const npc = Object.keys(store.characters).find(
        (id) =>
          id !== PLAYER_ID &&
          RECRUITABLE.has(store.characters[id].state.kind) &&
          !store.sceneOwned.has(id) &&
          isTargetFree(farSide.target, id),
      )
      if (!npc) return
      releaseClaims(npc) // leaving a claimed desk/sofa to come play
      claimTarget(npc, farSide.target)
      store.dispatchTo(npc, { type: 'CLICK_PERFORM_ACTIVITY', target: farSide.target, clip: 'pingPongRally' })
      runRally(PLAYER_ID, npc)
    })

    // NPC-NPC matches: the original slow ambient pairing, unchanged in spirit.
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

      store.dispatchTo(a, { type: 'CLICK_PERFORM_ACTIVITY', target: targetA, clip: 'pingPongRally' })
      store.dispatchTo(b, { type: 'CLICK_PERFORM_ACTIVITY', target: targetB, clip: 'pingPongRally' })
      runRally(a, b)
    }, CHECK_INTERVAL_MS)

    return () => {
      clearInterval(interval)
      unsubscribePlayerWatch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
