/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { npcChatPlugin } from './server/npcChatVitePlugin'

export default defineConfig({
  // The NPC-chat proxy serves /api/npc-chat in both `vite` (dev) and
  // `vite preview` (production runtime), reading the DeepSeek key from the
  // gitignored .env.local — it never enters the client bundle.
  plugins: [react(), npcChatPlugin()],
  test: {
    environment: 'jsdom',
    globals: false,
    // server/*.test.ts exercise the proxy logic with a mock provider (no key).
    // e2e/ holds Playwright specs, run by `npm run test:e2e`, not vitest.
    // .claude/ carries assistant tooling with its own node:test suites.
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', '**/.claude/**'],
  },
})
