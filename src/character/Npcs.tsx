import { useEffect, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { CharacterModel } from './CharacterModel'
import { NPC_CHARACTERS, type CharacterDefinition } from './characters'
import { useCharacterStore } from './characterStore'
import { nearestWalkable } from './grid'
import { planNextActivity, wanderPoint, createRng, type ActivityPlan, type ActivityPlanner } from './npcBehavior'
import { getInteractions, isTargetFree, claimTarget, releaseClaims, targetKey } from '../interaction/interactionRegistry'
import { useGameStore } from '../game/gameStore'

// States in which an NPC is "settled" and its brain may schedule the next
// activity after the current plan's stay duration.
const SETTLED_STATES = new Set(['idle', 'working', 'sittingIdle', 'sofaSitting', 'drinkingCoffee'])

function freeTargets(kind: Parameters<typeof getInteractions>[0], ownerId: string) {
  return getInteractions(kind)
    .map((entry) => entry.target)
    .filter((target) => isTargetFree(target, ownerId))
}

// The default brain is the seeded random office-life planner; a character
// definition may override npc.planActivity (e.g. a DeepSeek agent fed with
// the character's persona) - planners may be async.
function useNpcBrain(id: string, planActivity: ActivityPlanner = planNextActivity) {
  const stateKind = useCharacterStore((s) => s.characters[id]?.state.kind)
  const gamePhase = useGameStore((s) => s.phase)
  const planRef = useRef<ActivityPlan | null>(null)
  const rngRef = useRef<(() => number) | null>(null)
  if (!rngRef.current) {
    let seed = 0
    for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) | 0
    rngRef.current = createRng(seed ^ (Date.now() & 0xffff))
  }

  useEffect(() => {
    // story gating: NPCs live their office life only once the game reaches
    // free play (after the player has met the PM)
    if (gamePhase !== 'free') return
    if (!stateKind || !SETTLED_STATES.has(stateKind)) return
    const rng = rngRef.current!
    // first decision after spawn comes quickly; afterwards stay durations rule
    const delay = planRef.current ? planRef.current.stayMs : 1500 + rng() * 2500
    let cancelled = false

    const timer = setTimeout(() => {
      void (async () => {
        const plan = await planActivity(rng, {
          workstations: freeTargets('workstation', id),
          coffeeMachines: freeTargets('coffee', id),
          sofas: freeTargets('sofa', id),
          seats: freeTargets('seat', id),
          previousKind: planRef.current?.kind,
          previousTargetKey: planRef.current?.target ? targetKey(planRef.current.target) : undefined,
        })
        if (cancelled) return
        planRef.current = plan
        const store = useCharacterStore.getState()
        releaseClaims(id)
        if (!plan.target) {
          store.dispatchTo(id, { type: 'CLICK_FLOOR', point: nearestWalkable(wanderPoint(rng)) })
          return
        }
        claimTarget(id, plan.target)
        const eventType =
          plan.kind === 'work'
            ? ('CLICK_WORKSTATION' as const)
            : plan.kind === 'coffee'
              ? ('CLICK_COFFEE_MACHINE' as const)
              : plan.kind === 'sofa'
                ? ('CLICK_SOFA' as const)
                : ('CLICK_SEAT' as const)
        store.dispatchTo(id, { type: eventType, target: plan.target })
      })()
    }, delay)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [stateKind, id, planActivity, gamePhase])
}

function Npc({ definition }: { definition: CharacterDefinition }) {
  const npc = definition.npc!
  useEffect(() => {
    const store = useCharacterStore.getState()
    store.spawnCharacter(definition.id, npc.spawn, npc.spawnRotationY ?? 0)
    return () => {
      store.removeCharacter(definition.id)
      releaseClaims(definition.id)
    }
  }, [definition, npc])

  useNpcBrain(definition.id, npc.planActivity)
  return <CharacterModel characterId={definition.id} config={definition.model} />
}

// All autonomous office dwellers from the character roster.
export function Npcs() {
  return (
    <>
      {NPC_CHARACTERS.map((definition) => (
        <Npc key={definition.id} definition={definition} />
      ))}
    </>
  )
}

for (const definition of NPC_CHARACTERS) {
  for (const url of Object.values(definition.model.clips)) {
    useGLTF.preload(url)
  }
}
