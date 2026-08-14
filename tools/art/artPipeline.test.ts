import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Feature 18A §8: the art pipeline guards. Runs under tools/ (node context),
// so plain fs is available. ROOT is the repo root (vitest cwd).
const ROOT = process.cwd()

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

const SRC_FILES = walk(join(ROOT, 'src')).filter((f) => /\.(ts|tsx|css)$/.test(f))

describe('approved production assets exist (18A §8)', () => {
  it('every asset path referenced from src/ exists under public/', () => {
    const referenced = new Set<string>()
    const re = /['"`](\/(?:dialogue_pictures|posters|documents|textures|character|hdri)\/[^'"`]+?\.(?:jpg|jpeg|png|glb|hdr))['"`]/g
    for (const file of SRC_FILES) {
      const source = readFileSync(file, 'utf8')
      for (const m of source.matchAll(re)) referenced.add(m[1])
    }
    expect(referenced.size).toBeGreaterThan(10) // sanity - the scan really found paths
    const missing = [...referenced].filter((p) => !existsSync(join(ROOT, 'public', p.slice(1))))
    expect(missing, `missing production assets:\n${missing.join('\n')}`).toEqual([])
  })

  it('the register lists only production paths that exist', () => {
    const register = readFileSync(join(ROOT, 'docs/art/generated-asset-register.md'), 'utf8')
    const paths = [...register.matchAll(/public\/[\w\-./]+\.(?:jpg|jpeg|png)/g)].map((m) => m[0])
    expect(paths.length).toBeGreaterThanOrEqual(7)
    const missing = paths.filter((p) => !existsSync(join(ROOT, p)))
    expect(missing, `register points at missing files:\n${missing.join('\n')}`).toEqual([])
  })
})

describe('rejected/generated candidates never reach production code (18A §8)', () => {
  it('src/ contains no imports or references to assets/generated', () => {
    const offenders = SRC_FILES.filter((f) => readFileSync(f, 'utf8').includes('assets/generated'))
    expect(offenders).toEqual([])
  })
})

describe('no Higgsfield secret anywhere (18A §8)', () => {
  const SECRET_PATTERNS = [/HIGGSFIELD[_A-Z]*KEY\s*[=:]\s*['"]?\w{8,}/i, /hf_[A-Za-z0-9]{20,}/, /Bearer\s+[A-Za-z0-9._-]{25,}/]

  it('tracked source, docs and prompt archives contain no key material', () => {
    const scanned = [
      ...SRC_FILES,
      ...walk(join(ROOT, 'docs/art')).filter((f) => f.endsWith('.md')),
      ...walk(join(ROOT, 'assets/source')).filter((f) => f.endsWith('.md')),
      join(ROOT, '.env.example'),
    ]
    const offenders: string[] = []
    for (const file of scanned) {
      const text = readFileSync(file, 'utf8')
      if (SECRET_PATTERNS.some((re) => re.test(text))) offenders.push(file)
    }
    expect(offenders).toEqual([])
  })

  it('the production bundle references no Higgsfield endpoints or keys', () => {
    const dist = join(ROOT, 'dist', 'assets')
    if (!existsSync(dist)) return // build not run in this environment - covered by CI/manual run
    const offenders = walk(dist)
      .filter((f) => f.endsWith('.js'))
      .filter((f) => {
        const text = readFileSync(f, 'utf8')
        return /higgsfield\.ai\/api|hf_[A-Za-z0-9]{20,}/.test(text)
      })
    expect(offenders).toEqual([])
  })
})

describe('generated production assets stay within the size budget (18A §7)', () => {
  it('every generated image is <= 200 KB', () => {
    const generatedDirs = [
      'public/dialogue_pictures/kirill_morozov',
      'public/dialogue_pictures/alina_belova',
      'public/dialogue_pictures/ilya_vlasov',
      'public/posters',
    ]
    const oversized: string[] = []
    for (const dir of generatedDirs) {
      for (const file of walk(join(ROOT, dir))) {
        if (statSync(file).size > 200 * 1024) oversized.push(file)
      }
    }
    const worried = join(ROOT, 'public/dialogue_pictures/prodact_manager/pm_worried.jpg')
    if (statSync(worried).size > 200 * 1024) oversized.push(worried)
    expect(oversized, `oversized generated assets:\n${oversized.join('\n')}`).toEqual([])
  })
})
