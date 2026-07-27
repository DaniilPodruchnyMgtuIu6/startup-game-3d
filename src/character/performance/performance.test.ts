import { describe, it, expect, beforeEach } from 'vitest'
import { EMOTION_POSES, EMOTION_LIMITS, type CharacterEmotion } from './characterEmotion'
import { usePerformanceStore } from './performanceStore'
import { gazeAnglesToward, wrapAngle, GAZE_LIMITS } from './gaze'

const ALL_EMOTIONS: CharacterEmotion[] = [
  'neutral',
  'focused',
  'concerned',
  'confident',
  'surprised',
  'angry-controlled',
  'relieved',
  'sad',
]

describe('emotion presets (18C §5)', () => {
  it('defines a pose for every CharacterEmotion', () => {
    for (const emotion of ALL_EMOTIONS) {
      expect(EMOTION_POSES[emotion], emotion).toBeDefined()
    }
    expect(Object.keys(EMOTION_POSES).sort()).toEqual([...ALL_EMOTIONS].sort())
  })

  it('neutral is exactly zero and every preset stays inside the hard limits', () => {
    expect(EMOTION_POSES.neutral).toEqual({ headPitch: 0, spinePitch: 0, chestPitch: 0 })
    for (const emotion of ALL_EMOTIONS) {
      const pose = EMOTION_POSES[emotion]
      expect(Math.abs(pose.headPitch), `${emotion} headPitch`).toBeLessThanOrEqual(EMOTION_LIMITS.headPitch)
      expect(Math.abs(pose.spinePitch), `${emotion} spinePitch`).toBeLessThanOrEqual(EMOTION_LIMITS.spinePitch)
      expect(Math.abs(pose.chestPitch), `${emotion} chestPitch`).toBeLessThanOrEqual(EMOTION_LIMITS.chestPitch)
    }
  })
})

describe('performance store (18C §5-§7)', () => {
  beforeEach(() => usePerformanceStore.getState().clearAllPerformance())

  it('sets and clears an emotion per character', () => {
    usePerformanceStore.getState().setEmotion('npc-a', 'concerned')
    expect(usePerformanceStore.getState().emotions['npc-a']).toBe('concerned')
    usePerformanceStore.getState().clearEmotion('npc-a')
    expect(usePerformanceStore.getState().emotions['npc-a']).toBeUndefined()
  })

  it('a gaze pair is symmetric and clears per participant', () => {
    usePerformanceStore.getState().setGazePair('player', 'npc-b')
    expect(usePerformanceStore.getState().gazeTargets).toEqual({ player: 'npc-b', 'npc-b': 'player' })
    usePerformanceStore.getState().clearGaze('player', 'npc-b')
    expect(usePerformanceStore.getState().gazeTargets).toEqual({})
  })

  it('clearing an unknown character is a no-op', () => {
    usePerformanceStore.getState().setGazePair('a', 'b')
    usePerformanceStore.getState().clearGaze('ghost')
    usePerformanceStore.getState().clearEmotion('ghost')
    expect(usePerformanceStore.getState().gazeTargets).toEqual({ a: 'b', b: 'a' })
  })

  it('clearAllPerformance wipes emotions and gaze together (§7 scene recovery)', () => {
    usePerformanceStore.getState().setEmotion('npc-a', 'sad')
    usePerformanceStore.getState().setGazePair('npc-a', 'npc-b')
    usePerformanceStore.getState().clearAllPerformance()
    expect(usePerformanceStore.getState().emotions).toEqual({})
    expect(usePerformanceStore.getState().gazeTargets).toEqual({})
  })

  it('a gaze point replaces any character gaze target and clears with the same call (18H §7)', () => {
    usePerformanceStore.getState().setGaze('npc-a', 'npc-b')
    usePerformanceStore.getState().setGazePoint('npc-a', [1, 2, 3])
    expect(usePerformanceStore.getState().gazeTargets['npc-a']).toBeUndefined()
    expect(usePerformanceStore.getState().gazePoints['npc-a']).toEqual([1, 2, 3])
    usePerformanceStore.getState().clearGaze('npc-a')
    expect(usePerformanceStore.getState().gazePoints['npc-a']).toBeUndefined()
  })

  it('sets and clears a listener reaction per character (18H §7)', () => {
    usePerformanceStore.getState().setListenerReaction('npc-a', 'concerned-listening')
    expect(usePerformanceStore.getState().listenerReactions['npc-a']).toBe('concerned-listening')
    usePerformanceStore.getState().clearListenerReaction('npc-a')
    expect(usePerformanceStore.getState().listenerReactions['npc-a']).toBeUndefined()
  })

  it('clearAllPerformance also wipes gaze points and listener reactions', () => {
    usePerformanceStore.getState().setGazePoint('npc-a', [1, 2, 3])
    usePerformanceStore.getState().setListenerReaction('npc-a', 'nod')
    usePerformanceStore.getState().clearAllPerformance()
    expect(usePerformanceStore.getState().gazePoints).toEqual({})
    expect(usePerformanceStore.getState().listenerReactions).toEqual({})
  })
})

describe('gaze math (18C §6)', () => {
  it('wrapAngle normalizes into [-π, π]', () => {
    expect(wrapAngle(0)).toBe(0)
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI)
    expect(wrapAngle(-3 * Math.PI)).toBeCloseTo(-Math.PI, 5)
  })

  it('a partner straight ahead needs no head turn', () => {
    // body yaw 0 faces +z in this project (atan2(dx, dz))
    const g = gazeAnglesToward([0, 0, 0], 0, 1.55, [0, 0, 2], 1.55)
    expect(g.active).toBe(true)
    expect(g.yaw).toBeCloseTo(0)
    expect(g.pitch).toBeCloseTo(0)
  })

  it('yaw and pitch are clamped to the head limits', () => {
    const side = gazeAnglesToward([0, 0, 0], 0, 1.55, [5, 0, 0.5], 1.55)
    expect(side.active).toBe(true)
    expect(Math.abs(side.yaw)).toBeLessThanOrEqual(GAZE_LIMITS.yaw)
    const above = gazeAnglesToward([0, 0, 0], 0, 1.15, [0, 3, 0.6], 1.55)
    expect(Math.abs(above.pitch)).toBeLessThanOrEqual(GAZE_LIMITS.pitch)
  })

  it('a partner far behind deactivates the gaze instead of breaking the neck', () => {
    const behind = gazeAnglesToward([0, 0, 0], 0, 1.55, [0, 0, -2], 1.55)
    expect(behind.active).toBe(false)
    expect(behind.yaw).toBe(0)
  })

  it('a seated speaker looks up at a standing partner (negative pitch = up)', () => {
    const g = gazeAnglesToward([0, 0, 0], 0, 1.15, [0, 0, 1.2], 1.55)
    expect(g.active).toBe(true)
    expect(g.pitch).toBeLessThan(0)
  })
})
