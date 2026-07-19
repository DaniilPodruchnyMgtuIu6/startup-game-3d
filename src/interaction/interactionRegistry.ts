import type { TriggerTarget } from './triggerPayload'

// Live registry of everything a character can interact with, populated by
// InteractionTrigger on mount (same pattern as the obstacle registry). NPC
// brains sample activities from here, so new interactive furniture becomes
// NPC-visible automatically. Claims prevent two characters from targeting
// the same seat/machine at once.

// 'exec-seat' is the manager's chair — the player can click it, but NPC brains
// never sample it (Feature 16 §7: the CEO chair is player-only). NPCs pool only
// 'workstation' | 'coffee' | 'seat' | 'sofa' (see Npcs.tsx).
export type InteractionKind = 'workstation' | 'coffee' | 'seat' | 'sofa' | 'server' | 'exec-seat'

export interface RegisteredInteraction {
  kind: InteractionKind
  target: TriggerTarget
}

const registry: RegisteredInteraction[] = []
const claims = new Map<string, string>() // targetKey -> ownerId

export function targetKey(target: TriggerTarget): string {
  return `${target.point[0].toFixed(2)}|${target.point[2].toFixed(2)}`
}

export function registerInteraction(kind: InteractionKind, target: TriggerTarget): () => void {
  const entry: RegisteredInteraction = { kind, target }
  registry.push(entry)
  return () => {
    const index = registry.indexOf(entry)
    if (index !== -1) registry.splice(index, 1)
  }
}

export function getInteractions(kind: InteractionKind): readonly RegisteredInteraction[] {
  return registry.filter((entry) => entry.kind === kind)
}

export function isTargetFree(target: TriggerTarget, forOwnerId: string): boolean {
  const owner = claims.get(targetKey(target))
  return owner === undefined || owner === forOwnerId
}

// Claiming a new target releases the owner's previous claims - a character
// only ever occupies one spot at a time.
export function claimTarget(ownerId: string, target: TriggerTarget): void {
  releaseClaims(ownerId)
  claims.set(targetKey(target), ownerId)
}

export function releaseClaims(ownerId: string): void {
  for (const [key, owner] of claims) {
    if (owner === ownerId) claims.delete(key)
  }
}
