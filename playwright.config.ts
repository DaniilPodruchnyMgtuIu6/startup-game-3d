import { defineConfig } from '@playwright/test'

// Browser E2E against the PRODUCTION build (vite build + preview): the
// /api/npc-chat proxy is served by the same preview server (see
// server/npcChatVitePlugin). State is seeded through the real localStorage
// persistence only — no dev hooks exist in the production bundle.
// `video: 'on'` keeps requestAnimationFrame alive in headless SwiftShader so
// walking/cutscenes progress.
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5301',
    viewport: { width: 1280, height: 800 },
    video: 'on',
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
    },
  },
  webServer: {
    command: 'vite build && vite preview --port 5301 --host 127.0.0.1',
    url: 'http://127.0.0.1:5301',
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
