/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/** 웹(frontend/src)의 API 클라이언트·게임 상태·도트 그림·회의 창을 그대로 가져다 쓴다 (docs/app.md). */
const web = fileURLToPath(new URL('../frontend/src', import.meta.url))

export default defineConfig({
  // 운영 웹의 /app/ 아래에 같이 배포한다 (decisions.md 309번). 앱은 그 주소를 WebView에 띄운다.
  base: '/app/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@web': web },
    // frontend/src 파일이 부르는 react·zustand도 이 패키지의 한 벌로 묶는다: React가 두 벌이면 훅이 깨진다.
    dedupe: ['react', 'react-dom', 'zustand', 'openapi-fetch', '@capacitor/core'],
  },
  server: {
    fs: { allow: ['..'] },
    // 쿠키가 같은 사이트에서 오가도록 API를 같은 출처로 프록시한다 (frontend와 같다).
    proxy: { '/api': 'http://localhost:8080' },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
