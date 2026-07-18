import { useEffect, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { CharacterModel } from './CharacterModel'
import { NPC_CHARACTERS, DEVELOPER_CHARACTERS, getCharacterById, type CharacterDefinition } from './characters'
import { useTeamStore } from '../game/teamStore'
import { getHiredEmployeeIds } from '../game/teamRules'
import { getEmployee } from '../game/teamCatalog'
import { developerPlanActivity } from '../game/developerPlanner'
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
  const sceneOwned = useCharacterStore((s) => s.sceneOwned.has(id))
  const planRef = useRef<ActivityPlan | null>(null)
  const rngRef = useRef<(() => number) | null>(null)
  if (!rngRef.current) {
    let seed = 0
    for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) | 0
    rngRef.current = createRng(seed ^ (Date.now() & 0xffff))
  }

  useEffect(() => {
    // story gating: NPCs live their office life only once the game reaches
    // free play (after the player has met the PM), and pause entirely while
    // a cutscene has taken direct control of this character
    if (gamePhase !== 'free' || sceneOwned) return
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
  }, [stateKind, id, planActivity, gamePhase, sceneOwned])
}

function Npc({ definition, planActivity }: { definition: CharacterDefinition; planActivity?: ActivityPlanner }) {
  const npc = definition.npc!
  useEffect(() => {
    const store = useCharacterStore.getState()
    store.spawnCharacter(definition.id, npc.spawn, npc.spawnRotationY ?? 0)
    return () => {
      store.removeCharacter(definition.id)
      releaseClaims(definition.id)
    }
  }, [definition, npc])

  useNpcBrain(definition.id, planActivity ?? npc.planActivity)
  return <CharacterModel characterId={definition.id} config={definition.model} />
}

// All autonomous office dwellers: the always-on roster (the PM) plus any
// developers the player has hired. Each hired developer is spawned exactly once
// via <Npc>; unhiring/reset removes their record, unmounts the <Npc>, and the
// character despawns. They share the same navigation, state machine, claims and
// planner as every other body.
export function Npcs() {
  const hires = useTeamStore((s) => s.hires)
  const hiredDevelopers = getHiredEmployeeIds(hires)
    .map((employeeId) => {
      const employee = getEmployee(employeeId)
      const definition = employee ? getCharacterById(employee.characterId) : undefined
      return employee && definition ? { employeeId, definition } : null
    })
    .filter((d): d is { employeeId: string; definition: CharacterDefinition } => d !== null)

  return (
    <>
      {NPC_CHARACTERS.map((definition) => (
        <Npc key={definition.id} definition={definition} />
      ))}
      {hiredDevelopers.map(({ employeeId, definition }) => (
        <Npc key={definition.id} definition={definition} planActivity={developerPlanActivity(employeeId)} />
      ))}
    </>
  )
}

for (const definition of NPC_CHARACTERS) {
  for (const url of Object.values(definition.model.clips)) {
    useGLTF.preload(url)
  }
}

// Preload hired-developer models in the COMBINED-array form CharacterModel
// actually looks up (useGLTF([...urls])). This warms the exact cache entry the
// character uses, so hiring mid-game does not suspend the shared <Suspense>
// boundary and wipe every character's position (same reason the guard models
// are preloaded this way for the security-breach cutscene).
for (const definition of DEVELOPER_CHARACTERS) {
  useGLTF.preload(Object.values(definition.model.clips))
}
