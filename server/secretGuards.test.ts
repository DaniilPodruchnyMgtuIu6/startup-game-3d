import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Feature 15 §5/§6: static guards proving the browser never calls DeepSeek
// directly and no client code references the key. These run in `npm test` and
// never need a real key or a network call.

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

const root = process.cwd()
const srcFiles = walk(join(root, 'src'))
const read = (p: string) => readFileSync(p, 'utf8')

describe('DeepSeek secret + direct-call guards', () => {
  it('no client (src) file calls api.deepseek.com directly', () => {
    expect(srcFiles.filter((p) => /api\.deepseek\.com/.test(read(p)))).toEqual([])
  })
  it('no client file uses VITE_DEEPSEEK or reads process.env.DEEPSEEK', () => {
    expect(srcFiles.filter((p) => /VITE_DEEPSEEK|process\.env\.DEEPSEEK/.test(read(p)))).toEqual([])
  })
  it('the client talks only to its own /api/npc-chat', () => {
    const client = read(join(root, 'src/game/npcChatClient.ts'))
    expect(client).toMatch(/\/api\/npc-chat/)
    // may mention DeepSeek in a comment, but must never target its host
    expect(client).not.toMatch(/deepseek\.com|api\.deepseek/i)
  })
  it('no test file makes a real fetch to DeepSeek', () => {
    const testFiles = [...srcFiles, ...walk(join(root, 'server'))].filter((p) => /\.test\.tsx?$/.test(p))
    expect(testFiles.filter((p) => /fetch\([^)]*deepseek/i.test(read(p)))).toEqual([])
  })
  it('.env.example ships an empty key placeholder', () => {
    const example = read(join(root, '.env.example'))
    expect(example).toMatch(/^DEEPSEEK_API_KEY=\s*$/m)
  })
})
