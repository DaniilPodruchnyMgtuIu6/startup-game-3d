import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, extname } from 'node:path'

// Feature 18H §9: "изменение размера NPC при переходе в dialogue/cinematic"
// was a real P1 bug, root-caused to SCALE animation tracks left in Meshy clip
// exports (guarded separately by tools/art/characterIdentity.test.ts). The
// OTHER half of the fix is structural: no component under src/character may
// ever write to a character's own .scale at all, at any point in its
// lifecycle - gameplay, dialogue, or cinematic all share the exact same
// CharacterModel instance with no cinematic wrapper/clone/portal, so there is
// nothing to "restore" after a scene; canonical scale is invariant by
// construction, not by convention. This test makes that a live regression
// guard instead of a claim in docs/art/18h-character-environment-scale-audit.md.
//
// The only legitimate .scale writes in this tree compensate a HELD PROP
// (coffee mug / ping-pong paddle / phone) for the hand bone's own import
// scale so the prop stays real-world sized - they never touch the character
// itself. Those are the sole allowed identifiers below.
const ALLOWED_SCALE_TARGETS = new Set(['mug', 'paddle', 'phone'])

const ROOT = join(process.cwd(), 'src/character')

function sourceFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...sourceFiles(full))
    } else if (['.ts', '.tsx'].includes(extname(entry.name)) && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.test.tsx')) {
      files.push(full)
    }
  }
  return files
}

describe('character scale invariant (18H §9)', () => {
  it('no file under src/character writes to a character root .scale - only held-prop compensation is allowed', () => {
    const offenders: string[] = []
    for (const file of sourceFiles(ROOT)) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/\b([A-Za-z_$][\w$]*)\.scale\b/g)) {
        const target = match[1]
        if (!ALLOWED_SCALE_TARGETS.has(target)) offenders.push(`${file}: ${target}.scale`)
      }
    }
    expect(offenders, 'a character-root .scale write reintroduces the "model grows mid-scene" P1 bug').toEqual([])
  })

  it('no JSX under src/character puts a scale prop on <CharacterModel>, its <group>, or its <primitive>', () => {
    const offenders: string[] = []
    for (const file of sourceFiles(ROOT)) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/<(CharacterModel|group|primitive)\b[^>]*\bscale\s*=/g)) {
        offenders.push(`${file}: <${match[1]} ... scale=...>`)
      }
    }
    expect(offenders, 'a scale prop here bypasses canonical scale for the character root').toEqual([])
  })
})
