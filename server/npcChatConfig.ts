// Server-side DeepSeek configuration (Feature 14). The API key exists only here,
// read from the process environment (loaded from the gitignored .env.local by
// the Vite plugin). The model and thinking mode are FIXED server-side — the
// client can never choose them. Pure + unit-testable; never logs the key.

export const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
export const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-flash'

export interface DeepSeekConfig {
  apiKey: string
  baseURL: string
  model: 'deepseek-v4-flash'
  thinking: 'disabled'
}

export type DeepSeekConfigResult = { ok: true; config: DeepSeekConfig } | { ok: false; reason: 'not_configured' }

export function loadDeepSeekConfig(env: Record<string, string | undefined>): DeepSeekConfigResult {
  const apiKey = (env.DEEPSEEK_API_KEY ?? '').trim()
  if (!apiKey) return { ok: false, reason: 'not_configured' }
  const baseURL = (env.DEEPSEEK_BASE_URL ?? '').trim() || DEFAULT_DEEPSEEK_BASE_URL
  // Model + thinking are pinned here regardless of env drift or client input.
  return { ok: true, config: { apiKey, baseURL, model: DEFAULT_DEEPSEEK_MODEL, thinking: 'disabled' } }
}

// Health payload — never exposes the key, its prefix/length, headers or balance.
export function deepSeekHealth(result: DeepSeekConfigResult): { configured: boolean; model: 'deepseek-v4-flash' } {
  return { configured: result.ok, model: DEFAULT_DEEPSEEK_MODEL }
}
