import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// Feature 18B §8: identity guards for the character models. Runs under tools/
// (node context). Parses each GLB's JSON chunk directly - no three.js needed.
const ROOT = process.cwd()
const DEF_DIR = join(ROOT, 'src/character/characters')

const CLIP_NAMES = ['idle', 'walk', 'sit', 'type', 'drink', 'sitIdle', 'sofaSit', 'talk', 'look', 'agree', 'celebrate', 'explain']

interface GltfJson {
  nodes?: { name?: string }[]
  materials?: { name?: string }[]
  images?: unknown[]
  accessors?: { max?: number[] }[]
  animations?: { name?: string; channels?: { target?: { node?: number } }[]; samplers?: { input: number }[] }[]
}

function clipDurationSec(gltf: GltfJson): number {
  let max = 0
  for (const anim of gltf.animations ?? []) {
    for (const sampler of anim.samplers ?? []) {
      const end = gltf.accessors?.[sampler.input]?.max?.[0] ?? 0
      if (end > max) max = end
    }
  }
  return max
}

function parseGlbJson(file: string): GltfJson {
  const buf = readFileSync(file)
  expect(buf.readUInt32LE(0), `${file}: GLB magic`).toBe(0x46546c67)
  const jsonLength = buf.readUInt32LE(12)
  return JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'))
}

// Every character definition module with the clip map it declares.
function loadDefinitions(): { module: string; clips: Record<string, string> }[] {
  return readdirSync(DEF_DIR)
    .filter((f) => f.endsWith('.ts') && f !== 'definition.ts' && f !== 'index.ts')
    .map((module) => {
      const source = readFileSync(join(DEF_DIR, module), 'utf8')
      const clips: Record<string, string> = {}
      for (const m of source.matchAll(/(\w+): '(\/character\/[^']+\.glb)'/g)) clips[m[1]] = m[2]
      return { module, clips }
    })
}

const DEFINITIONS = loadDefinitions()

describe('character model identity (18B §8)', () => {
  it('found every definition module with clips', () => {
    expect(DEFINITIONS.map((d) => d.module).sort()).toEqual([
      'alinaBelova.ts',
      'businessMan.ts',
      'femalePm.ts',
      'ilyaVlasov.ts',
      'intruder.ts',
      'kirillMorozov.ts',
      'security1.ts',
      'security2.ts',
    ])
    for (const { module, clips } of DEFINITIONS) {
      expect(Object.keys(clips).length, `${module}: clip map found`).toBeGreaterThanOrEqual(2)
      expect(clips.idle, `${module}: idle base clip`).toBeDefined()
    }
  })

  it('every referenced clip file exists and clip keys are valid ClipNames', () => {
    for (const { module, clips } of DEFINITIONS) {
      for (const [name, url] of Object.entries(clips)) {
        expect(CLIP_NAMES, `${module}: unknown clip key ${name}`).toContain(name)
        expect(existsSync(join(ROOT, 'public', url.slice(1))), `${module}: missing ${url}`).toBe(true)
      }
    }
  })

  it('no character shares another character base mesh (unique idle model per definition)', () => {
    const idles = DEFINITIONS.map((d) => d.clips.idle)
    expect(new Set(idles).size).toBe(idles.length)
  })

  it('each clip GLB carries exactly the animation its key promises', () => {
    for (const { module, clips } of DEFINITIONS) {
      for (const [name, url] of Object.entries(clips)) {
        const gltf = parseGlbJson(join(ROOT, 'public', url.slice(1)))
        const animations = gltf.animations ?? []
        expect(animations.length, `${module}: ${url} animation count`).toBe(1)
        expect(animations[0].name, `${module}: ${url} animation name`).toBe(name)
      }
    }
  })

  it('every clip animates bones that exist in the base skeleton (skeleton compatibility)', () => {
    for (const { module, clips } of DEFINITIONS) {
      const base = parseGlbJson(join(ROOT, 'public', clips.idle.slice(1)))
      const baseBones = new Set((base.nodes ?? []).map((n) => n.name).filter(Boolean))
      for (const [name, url] of Object.entries(clips)) {
        if (name === 'idle') continue
        const gltf = parseGlbJson(join(ROOT, 'public', url.slice(1)))
        const nodes = gltf.nodes ?? []
        const targets = new Set<string>()
        for (const channel of gltf.animations?.[0]?.channels ?? []) {
          const node = channel.target?.node
          if (node !== undefined && nodes[node]?.name) targets.add(nodes[node].name!)
        }
        const missing = [...targets].filter((bone) => !baseBones.has(bone))
        expect(missing, `${module}: ${url} animates bones missing from ${clips.idle}`).toEqual([])
      }
    }
  })

  it('no clip is a 0-second static pose placeholder (18C §1)', () => {
    for (const { module, clips } of DEFINITIONS) {
      for (const [name, url] of Object.entries(clips)) {
        const duration = clipDurationSec(parseGlbJson(join(ROOT, 'public', url.slice(1))))
        expect(duration, `${module}: ${url} duration ${duration}s`).toBeGreaterThan(0.5)
      }
    }
  })

  it('brain-driven look clips match the LOOK_CLIP_MS the NPC brain waits for (18C)', () => {
    const npcsSource = readFileSync(join(ROOT, 'src/character/Npcs.tsx'), 'utf8')
    const constant = Number(npcsSource.match(/LOOK_CLIP_MS = (\d+)/)?.[1])
    expect(constant).toBeGreaterThan(0)
    // Guards' look is director-controlled (explicit look(false)); the auto
    // LOOK_END only ever fires for characters with an office-life brain.
    const BRAIN_MODULES = new Set(['femalePm.ts', 'kirillMorozov.ts', 'alinaBelova.ts', 'ilyaVlasov.ts', 'businessMan.ts'])
    for (const { module, clips } of DEFINITIONS) {
      if (!clips.look || !BRAIN_MODULES.has(module)) continue
      const duration = clipDurationSec(parseGlbJson(join(ROOT, 'public', clips.look.slice(1))))
      expect(Math.abs(duration * 1000 - constant), `${module}: look ${duration}s vs LOOK_CLIP_MS ${constant}`).toBeLessThan(150)
    }
  })

  it('base models have no duplicate materials and carry embedded textures', () => {
    for (const { module, clips } of DEFINITIONS) {
      const gltf = parseGlbJson(join(ROOT, 'public', clips.idle.slice(1)))
      const names = (gltf.materials ?? []).map((m) => m.name ?? '?')
      expect(new Set(names).size, `${module}: duplicate materials [${names.join(', ')}]`).toBe(names.length)
      expect((gltf.images ?? []).length, `${module}: no embedded textures`).toBeGreaterThan(0)
    }
  })
})

describe('identity packages exist for every permanent character (18B §1)', () => {
  const CHARACTER_DOCS = ['sonya-sokolova', 'kirill-morozov', 'alina-belova', 'ilya-vlasov', 'player-founder']

  it.each(CHARACTER_DOCS)('%s has identity.md, generation-prompts.md, model-review.md and the three sheets', (id) => {
    const dir = join(ROOT, 'docs/art/characters', id)
    for (const doc of ['identity.md', 'generation-prompts.md', 'model-review.md']) {
      expect(existsSync(join(dir, doc)), `${id}/${doc}`).toBe(true)
    }
    for (const kind of ['turnaround', 'expressions', 'poses']) {
      const sheets = readdirSync(join(dir, kind)).filter((f) => f.endsWith('.jpg'))
      expect(sheets.length, `${id}/${kind} sheet`).toBeGreaterThanOrEqual(1)
    }
  })
})
