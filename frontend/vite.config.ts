/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * ads.txt (decisions.md 271번): 게시자 ID(VITE_ADSENSE_CLIENT)가 있을 때만 배포 도메인 루트에 낸다. adsense.ts의 adsTxt와 같은 줄이다.
 */
function adsTxt(client: string): Plugin {
  return {
    name: 'ads-txt',
    generateBundle() {
      if (!/^ca-pub-\d{10,20}$/.test(client)) {
        return
      }
      this.emitFile({
        type: 'asset',
        fileName: 'ads.txt',
        source: `google.com, ${client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`,
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    adsTxt(loadEnv(mode, process.cwd(), 'VITE_').VITE_ADSENSE_CLIENT ?? ''),
    VitePWA({
      registerType: 'autoUpdate',
      // 온라인 전용 게임이다. 화면 자산만 캐시하고 API는 캐시하지 않는다 (architecture.md 1절).
      // 광고 요청(다른 출처)은 캐시하지 않고, ads.txt는 앱 화면으로 바꿔치지 않는다 (271번).
      // 안드로이드 앱 화면(app/)은 /app/ 아래에 같이 배포된다 (decisions.md 309번): 웹의 서비스 워커가 그 주소를 웹 화면으로 바꿔치지 않는다.
      workbox: { navigateFallbackDenylist: [/^\/api\//, /^\/r\//, /^\/ads\.txt$/, /^\/app\//] },
      manifest: {
        name: '증권사 사장',
        short_name: '증권사 사장',
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
    include: ['src/**/*.test.ts'],
  },
}))
