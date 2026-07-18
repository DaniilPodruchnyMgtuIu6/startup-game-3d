import type { Plugin, Connect } from 'vite'
import { loadEnv } from 'vite'
import { loadDeepSeekConfig, type DeepSeekConfigResult } from './npcChatConfig'
import { createDeepSeekProvider } from './npcChatProvider'
import { createRateLimiter, createConcurrencyGuard, NPC_CHAT_RATE } from './npcChatRateLimiter'
import { handleNpcChat, handleHealth } from './npcChatHandler'

// Serves POST /api/npc-chat and GET /api/npc-chat/health from inside Vite — in
// dev (configureServer) and in `vite preview` production runtime
// (configurePreviewServer). The DeepSeek key is read from the process env
// (loaded from .env.local via loadEnv) and never reaches the client bundle.
export function npcChatPlugin(): Plugin {
  const provider = createDeepSeekProvider()
  const rateLimiter = createRateLimiter(NPC_CHAT_RATE)
  const concurrency = createConcurrencyGuard()
  let configResult: DeepSeekConfigResult = { ok: false, reason: 'not_configured' }

  const register = (middlewares: Connect.Server) => {
    middlewares.use((req, res, next) => {
      const url = (req.url || '').split('?')[0]
      if (url !== '/api/npc-chat' && url !== '/api/npc-chat/health') return next()
      if (url === '/api/npc-chat/health' && req.method === 'GET') return handleHealth(res, configResult)
      if (url === '/api/npc-chat' && req.method === 'POST') {
        void handleNpcChat(req, res, {
          configResult,
          provider,
          rateLimiter,
          concurrency,
          now: () => Date.now(),
          log: (entry) => console.info('[npc-chat]', JSON.stringify(entry)),
        })
        return
      }
      next()
    })
  }

  return {
    name: 'npc-chat',
    configResolved(resolved) {
      // prefix '' loads ALL env vars (incl. DEEPSEEK_API_KEY) from .env.local.
      const env = loadEnv(resolved.mode, resolved.root, '')
      configResult = loadDeepSeekConfig(env)
      if (!configResult.ok) console.info('DeepSeek API key is not configured')
    },
    configureServer(server) {
      register(server.middlewares)
    },
    configurePreviewServer(server) {
      register(server.middlewares)
    },
  }
}
