/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // 온라인 전용 게임이다. 화면 자산만 캐시하고 API는 캐시하지 않는다 (architecture.md 1절).
      workbox: { navigateFallbackDenylist: [/^\/api\//] },
      manifest: {
        name: '투자자 시뮬레이터',
        short_name: '투자자',
        lang: 'ko',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f3f4f3',
        theme_color: '#f3f4f3',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
    }),
  ],
  server: {
    // 쿠키가 같은 사이트에서 오가도록 API를 같은 출처로 프록시한다 (decisions.md 12번).
    proxy: { '/api': 'http://localhost:8080' },
  },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
