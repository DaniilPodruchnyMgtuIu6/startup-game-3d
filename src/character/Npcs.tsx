import { useEffect, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { CharacterModel } from './CharacterModel'
import { NPC_CHARACTERS, DEVELOPER_CHARACTERS, SPECIALIST_CHARACTERS, getCharacterById, type CharacterDefinition } from './characters'
import { useTeamStore } from '../game/teamStore'
import { getHiredEmployeeIds } from '../game/teamRules'
import { getEmployee, TEAM_CATALOG, PROJECT_MANAGER } from '../game/teamCatalog'
import { developerPlanActivity } from '../game/developerPlanner'
import { securitySpecialistPlanActivity } from '../game/securitySpecialistPlanner'
import { useCharacterStore } from './characterStore'
import { nearestWalkable } from './grid'
import type { Target } from './characterMachine'
import { planNextActivity, wanderPoint, createRng, type ActivityPlan, type ActivityPlanner } from './npcBehavior'
import { getInteractions, isTargetFree, claimTarget, releaseClaims, targetKey } from '../interaction/interactionRegistry'
import { useGameStore } from '../game/gameStore'
import { useGameOutcomeStore } from '../game/gameOutcomeStore'
import { usePingPongMatchmaker } from './pingPongMatchmaker'
import { WINDOW_LOOK_TARGET, WHITEBOARD_GLANCE_TARGET } from './ambientLookSpots'
import {
  createAmbientHistory,
  recordActivityStart,
  isOnCooldown,
  wasJustDone,
  dailyLimitReached,
  type AmbientActivityHistory,
} from './ambientActivityHistory'
import { AMBIENT_OFFICE_BALANCE } from '../game/balance'
import { useSprintStore } from '../game/sprintStore'

// States in which an NPC is "settled" and its brain may schedule the next
// activity after the current plan's stay duration.
const SETTLED_STATES = new Set(['idle', 'working', 'sittingIdle', 'sofaSitting', 'drinkingCoffee'])

// Feature 18C: one full pass of the look-around clip (security_1/look.glb and
// its retargets are all 4.75s - guarded by tools/art/characterIdentity.test).
// A security round now ends with the specialist actually LOOKING at the spot
// he patrolled to, then his brain resumes normal scheduling.
const LOOK_CLIP_MS = 4750

// 18H Wave 3: activity kinds that walk (CLICK_PERFORM_ACTIVITY) then hold in
// 'performing' for plan.stayMs before ending themselves.
const PERFORM_HOLD_KINDS = new Set(['pull-up-bar', 'window-look', 'whiteboard-glance', 'phone-check'])

// 18H §15/§16: an ambient pick that is on cooldown, was just done, or would
// exceed the daily cap falls back to wander instead - core work/coffee/
// meeting/sofa picks pass through untouched (never gated). Exported for its
// own focused unit test (Npcs.test.ts) - everything else here needs a
// mounted component to exercise.
export function ambientGate(plan: ActivityPlan, history: AmbientActivityHistory, beat: number): ActivityPlan {
  if (!PERFORM_HOLD_KINDS.has(plan.kind)) return plan
  const blocked =
    isOnCooldown(history, plan.kind, beat) ||
    wasJustDone(history, plan.kind) ||
    dailyLimitReached(history, AMBIENT_OFFICE_BALANCE.maxActivitiesPerNpcPerWorkday)
  return blocked ? { kind: 'wander', stayMs: plan.stayMs } : plan
}

function freeTargets(kind: Parameters<typeof getInteractions>[0], ownerId: string) {
  return getInteractions(kind)
    .map((entry) => entry.target)
    .filter((target) => isTargetFree(target, ownerId))
}

// The full set of interaction pools an NPC brain may sample from. Exported so
// the §22.16 regression test can pin the CEO-chair rule at the policy source:
// 'exec-seat' (and 'server', 'ping-pong' - matchmade separately) must NEVER
// appear here, whatever furniture is registered.
export function npcActivityPools(ownerId: string) {
  return {
    workstations: freeTargets('workstation', ownerId),
    coffeeMachines: freeTargets('coffee', ownerId),
    sofas: freeTargets('sofa', ownerId),
    seats: freeTargets('seat', ownerId),
    pullUpBars: freeTargets('pull-up-bar', ownerId),
  }
}

// The default brain is the seeded random office-life planner; a character
// definition may override npc.planActivity (e.g. a DeepSeek agent fed with
// the character's persona) - planners may be async. Exported for its own
// integration test (Npcs.test.ts) - the walk-then-perform ambient cycle
// needs a real mounted hook, unlike ambientGate's pure-function slice.
export function useNpcBrain(id: string, planActivity: ActivityPlanner = planNextActivity) {
  const stateKind = useCharacterStore((s) => s.characters[id]?.state.kind)
  const gamePhase = useGameStore((s) => s.phase)
  const sceneOwned = useCharacterStore((s) => s.sceneOwned.has(id))
  // Feature 12: a registered defeat freezes autonomous office life too.
  const outcomeActive = useGameOutcomeStore((s) => s.status !== 'playing')
  const planRef = useRef<ActivityPlan | null>(null)
  // 18C: whether the current security-round plan has already played its
  // arrival look-around (reset whenever a new plan is chosen).
  const lookPlayedRef = useRef(true)
  // 18H §15/§16: per-NPC ambient-activity cooldown/daily-limit bookkeeping.
  // "beat" here is one decision cycle for this character, not a wall-clock
  // unit - see ambientActivityHistory.ts.
  const historyRef = useRef<AmbientActivityHistory>(createAmbientHistory(id))
  const beatRef = useRef(0)
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
    if (gamePhase !== 'free' || sceneOwned || outcomeActive) return
    // 18C: an in-progress look-around ends by itself after one clip pass; the
    // brain waits (looking is not a settled state) and resumes on LOOK_END.
    if (stateKind === 'looking') {
      const timer = setTimeout(
        () => useCharacterStore.getState().dispatchTo(id, { type: 'LOOK_END' }),
        LOOK_CLIP_MS,
      )
      return () => clearTimeout(timer)
    }
    // 18H Wave 3: 'performing' is not a settled state either - a walk-then-
    // perform ambient activity holds for its planned stay, then ends itself
    // and hands back to the settled-state branch below to re-plan. Every
    // CLICK_PERFORM_ACTIVITY-driven ambient kind shares this one timer.
    if (stateKind === 'performing' && planRef.current && PERFORM_HOLD_KINDS.has(planRef.current.kind)) {
      const timer = setTimeout(
        () => useCharacterStore.getState().dispatchTo(id, { type: 'PERFORM_END' }),
        planRef.current.stayMs,
      )
      return () => clearTimeout(timer)
    }
    if (!stateKind || !SETTLED_STATES.has(stateKind)) return
    // 18C: arriving at a patrol point (idle again with a security-round plan)
    // plays the look-around once before the next activity is scheduled.
    if (stateKind === 'idle' && planRef.current?.kind === 'security-round' && !lookPlayedRef.current) {
      lookPlayedRef.current = true
      useCharacterStore.getState().dispatchTo(id, { type: 'LOOK_START' })
      return
    }
    const rng = rngRef.current!
    // first decision after spawn comes quickly; afterwards stay durations rule
    const delay = planRef.current ? planRef.current.stayMs : 1500 + rng() * 2500
    let cancelled = false

    const timer = setTimeout(() => {
      void (async () => {
        const rawPlan = await planActivity(rng, {
          ...npcActivityPools(id),
          previousKind: planRef.current?.kind,
          previousTargetKey: planRef.current?.target ? targetKey(planRef.current.target) : undefined,
        })
        if (cancelled) return
        // 18H §15/§16: cooldown + daily-limit gate for ambient activities
        // only - core office life (work/coffee/meeting/sofa) is unaffected.
        // A gated pick falls back to wander (needs no target) rather than
        // 'work' (would need a resolved workstation this branch lacks).
        const plan = ambientGate(rawPlan, historyRef.current, beatRef.current)
        if (plan === rawPlan && PERFORM_HOLD_KINDS.has(plan.kind)) {
          const sprint = useSprintStore.getState()
          historyRef.current = recordActivityStart(
            historyRef.current,
            plan.kind,
            beatRef.current,
            AMBIENT_OFFICE_BALANCE.activityCooldownBeats,
            `${sprint.sprintNumber}-${sprint.day}`,
          )
        }
        beatRef.current += 1
        planRef.current = plan
        lookPlayedRef.current = plan.kind !== 'security-round'
        const store = useCharacterStore.getState()
        releaseClaims(id)
        // A security round walks to a patrol point and idles there - a floor
        // move, not a seat, so it claims nothing and touches no server state.
        if (plan.kind === 'security-round' && plan.target) {
          store.dispatchTo(id, { type: 'CLICK_FLOOR', point: nearestWalkable(plan.target.point) })
          return
        }
        // 18H Wave 3 (§14): fixed-spot glances - public spots, no claim, same
        // reasoning as security-round's patrol point.
        if (plan.kind === 'window-look' || plan.kind === 'whiteboard-glance') {
          const target = plan.kind === 'window-look' ? WINDOW_LOOK_TARGET : WHITEBOARD_GLANCE_TARGET
          store.dispatchTo(id, { type: 'CLICK_PERFORM_ACTIVITY', target, clip: 'look' })
          return
        }
        if (plan.kind === 'phone-check') {
          const target: Target = { point: nearestWalkable(wanderPoint(rng)), facing: 0 }
          store.dispatchTo(id, { type: 'CLICK_PERFORM_ACTIVITY', target, clip: 'checkPhone' })
          return
        }
        if (!plan.target) {
          store.dispatchTo(id, { type: 'CLICK_FLOOR', point: nearestWalkable(wanderPoint(rng)) })
          return
        }
        claimTarget(id, plan.target)
        // 18H Wave 3: pull-up-bar walks-then-performs a named gesture clip
        // rather than sitting - a distinct event, not another ternary arm.
        if (plan.kind === 'pull-up-bar') {
          store.dispatchTo(id, { type: 'CLICK_PERFORM_ACTIVITY', target: plan.target, clip: 'pullUp' })
          return
        }
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
  }, [stateKind, id, planActivity, gamePhase, sceneOwned, outcomeActive])
}

// Name + role for the tag over an NPC's head (the PM plus any hired employee).
function labelForCharacter(characterId: string): { name: string; role: string } | undefined {
  if (characterId === PROJECT_MANAGER.characterId) return { name: PROJECT_MANAGER.name, role: PROJECT_MANAGER.roleLabel }
  const employee = TEAM_CATALOG.find((e) => e.characterId === characterId)
  return employee ? { name: employee.name, role: employee.roleLabel } : undefined
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
  return <CharacterModel characterId={definition.id} config={definition.model} label={labelForCharacter(definition.id)} />
}

// All autonomous office dwellers: the always-on roster (the PM) plus any
// developers the player has hired. Each hired developer is spawned exactly once
// via <Npc>; unhiring/reset removes their record, unmounts the <Npc>, and the
// character despawns. They share the same navigation, state machine, claims and
// planner as every other body.
export function Npcs() {
  const hires = useTeamStore((s) => s.hires)
  const hiredNpcs = getHiredEmployeeIds(hires)
    .map((employeeId) => {
      const employee = getEmployee(employeeId)
      const definition = employee ? getCharacterById(employee.characterId) : undefined
      if (!employee || !definition) return null
      // the security specialist patrols; developers favour their sprint work
      const planActivity =
        employee.role === 'security-specialist'
          ? securitySpecialistPlanActivity(employeeId)
          : developerPlanActivity(employeeId)
      return { definition, planActivity }
    })
    .filter((d): d is { definition: CharacterDefinition; planActivity: ActivityPlanner } => d !== null)

  // 18H Wave 3: one matchmaker for the whole office, not one per NPC - a
  // rally is a fact about a PAIR, not something each character's own brain
  // can decide alone.
  usePingPongMatchmaker()

  return (
    <>
      {NPC_CHARACTERS.map((definition) => (
        <Npc key={definition.id} definition={definition} />
      ))}
      {hiredNpcs.map(({ definition, planActivity }) => (
        <Npc key={definition.id} definition={definition} planActivity={planActivity} />
      ))}
    </>
  )
}

for (const definition of NPC_CHARACTERS) {
  for (const url of Object.values(definition.model.clips)) {
    useGLTF.preload(url)
  }
}

// Preload hired-employee models in the COMBINED-array form CharacterModel
// actually looks up (useGLTF([...urls])). This warms the exact cache entry the
// character uses, so hiring mid-game does not suspend the shared <Suspense>
// boundary and wipe every character's position (same reason the guard models
// are preloaded this way for the security-breach cutscene).
for (const definition of [...DEVELOPER_CHARACTERS, ...SPECIALIST_CHARACTERS]) {
  useGLTF.preload(Object.values(definition.model.clips))
}
