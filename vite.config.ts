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
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
})
