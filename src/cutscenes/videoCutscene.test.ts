import { describe, it, expect, beforeEach } from 'vitest'
import { playVideoCutscene, finishVideoCutscene, useVideoCutsceneStore } from './videoCutscene'

// The story-clip contract the intrusion scene relies on: played=true continues
// with the shortened aftermath staging, played=false falls back to the full
// in-engine walk-in - and a failed/missing asset can never hang the scene.

describe('playVideoCutscene', () => {
  beforeEach(() => {
    useVideoCutsceneStore.setState({ src: null })
  })

  it('resolves true when the overlay reports the clip finished', async () => {
    const pending = playVideoCutscene('/cutscenes/x.mp4')
    expect(useVideoCutsceneStore.getState().src).toBe('/cutscenes/x.mp4')
    finishVideoCutscene(true)
    await expect(pending).resolves.toBe(true)
    expect(useVideoCutsceneStore.getState().src).toBeNull()
  })

  it('resolves false when the overlay reports a load error (fallback path)', async () => {
    const pending = playVideoCutscene('/cutscenes/missing.mp4')
    finishVideoCutscene(false)
    await expect(pending).resolves.toBe(false)
  })

  it('a second request while a clip is up immediately falls back (false)', async () => {
    const first = playVideoCutscene('/cutscenes/a.mp4')
    await expect(playVideoCutscene('/cutscenes/b.mp4')).resolves.toBe(false)
    expect(useVideoCutsceneStore.getState().src).toBe('/cutscenes/a.mp4')
    finishVideoCutscene(true)
    await expect(first).resolves.toBe(true)
  })
})
