import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useNpcAmbientStore } from './npcAmbientStore'
import { useCharacterStore } from '../character/characterStore'
import { nearestWalkable } from '../character/grid'
import { releaseClaims } from '../interaction/interactionRegistry'
import { NPC_CHARACTER_ID } from './npcChatTypes'
import { approachPoint, isWithinMeetDistance, facingBetween } from './meetingGeometry'

// Feature 16 §8: stages the NPC↔NPC conversation the Workday Flow started. It
// reuses the free-chat approach pattern (pause both brains via sceneOwned, walk
// one colleague up to the other — no teleport — face each other, then reveal the
// lines as speech bubbles) but between two NPCs and with no player involvement.
// When it ends it clears the active conversation; the Workday Flow then advances
// the day. Renders nothing (the bubbles live on the characters; the HUD note is
// in WorkdayFlowController).

const LINE_MS = 2400 // how long each spoken line lingers before the next
const END_LINGER_MS = 1200 // pause after the final line before wrapping up
const GATHER_TIMEOUT_S = 7 // fall back to talking in place if the walk gets stuck

function pausePlanner(id: string) {
  const s = useCharacterStore.getState()
  const next = new Set(s.sceneOwned)
  next.add(id)
  s.setSceneOwned(next)
}
function resumePlanner(id: string) {
  const s = useCharacterStore.getState()
  const next = new Set(s.sceneOwned)
  next.delete(id)
  s.setSceneOwned(next)
}

export function NpcAmbientConversationController() {
  const active = useNpcAmbientStore((s) => s.active)
  const convId = active?.conversation.id ?? null

  const phaseRef = useRef<'idle' | 'gather' | 'talk'>('idle')
  const moverRef = useRef<string | null>(null)
  const hostRef = useRef<string | null>(null)
  const gatherElapsed = useRef(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  // Hand both colleagues back to their autonomous brain and drop the talk pose.
  const release = () => {
    const store = useCharacterStore.getState()
    for (const id of [moverRef.current, hostRef.current]) {
      if (!id) continue
      store.dispatchTo(id, { type: 'TALK_END' })
      resumePlanner(id)
    }
    moverRef.current = null
    hostRef.current = null
    phaseRef.current = 'idle'
  }

  const finish = () => {
    clearTimers()
    release()
    useNpcAmbientStore.getState().end() // clears `active` → Workday Flow advances the day
  }

  const startTalk = () => {
    if (phaseRef.current !== 'gather') return
    const store = useCharacterStore.getState()
    const mover = moverRef.current
    const host = hostRef.current
    const current = useNpcAmbientStore.getState().active
    if (!mover || !host || !current) {
      finish()
      return
    }
    phaseRef.current = 'talk'
    const mp = store.characters[mover]?.position
    const hp = store.characters[host]?.position
    store.dispatchTo(mover, { type: 'TALK_START' })
    store.dispatchTo(host, { type: 'TALK_START' })
    if (mp && hp) {
      store.setTransform(mover, mp, facingBetween(mp, hp))
      store.setTransform(host, hp, facingBetween(hp, mp))
    }
    const lineCount = current.conversation.lines.length
    useNpcAmbientStore.getState().setLineIndex(0)
    const scheduleFrom = (i: number) => {
      if (i >= lineCount - 1) {
        timers.current.push(setTimeout(finish, END_LINGER_MS))
        return
      }
      timers.current.push(
        setTimeout(() => {
          useNpcAmbientStore.getState().setLineIndex(i + 1)
          scheduleFrom(i + 1)
        }, LINE_MS),
      )
    }
    scheduleFrom(0)
  }

  // Start staging whenever a NEW conversation appears; tear down on change/unmount.
  useEffect(() => {
    if (!active) {
      phaseRef.current = 'idle'
      return
    }
    if (phaseRef.current !== 'idle') return
    const store = useCharacterStore.getState()
    const mover = NPC_CHARACTER_ID[active.conversation.mover]
    const host = NPC_CHARACTER_ID[active.conversation.host]
    const hostEntity = store.characters[host]
    const moverEntity = store.characters[mover]
    if (!hostEntity || !moverEntity) {
      // a participant is not in the office (should not happen — selector gates on
      // presence) — abort cleanly so the day still advances
      finish()
      return
    }
    moverRef.current = mover
    hostRef.current = host
    phaseRef.current = 'gather'
    gatherElapsed.current = 0
    pausePlanner(mover)
    pausePlanner(host)
    releaseClaims(mover)
    releaseClaims(host)
    // walk the mover up to a spot in front of the host (no teleport)
    store.dispatchTo(mover, { type: 'CLICK_FLOOR', point: nearestWalkable(approachPoint(hostEntity.position, hostEntity.rotationY)) })
    // Guaranteed timeout via a real timer (not the useFrame delta), so the day is
    // never stuck waiting for an arrival that a stalled render loop can't report.
    timers.current.push(
      setTimeout(() => {
        if (phaseRef.current === 'gather') startTalk()
      }, GATHER_TIMEOUT_S * 1000),
    )
    return () => {
      clearTimers()
      if (phaseRef.current !== 'idle') release()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId])

  // Detect the mover's arrival (or give up and talk in place after a timeout).
  useFrame((_, delta) => {
    if (phaseRef.current !== 'gather') return
    gatherElapsed.current += delta
    const store = useCharacterStore.getState()
    const mover = moverRef.current
    const host = hostRef.current
    if (!mover || !host) return
    const mp = store.characters[mover]?.position
    const hp = store.characters[host]?.position
    if (!mp || !hp) return
    if (isWithinMeetDistance(mp, hp) || gatherElapsed.current > GATHER_TIMEOUT_S) startTalk()
  })

  return null
}
