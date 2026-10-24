import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/noto-serif-kr/900.css'
import '@fontsource/noto-sans-kr/400.css'
import '@fontsource/noto-sans-kr/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/gowun-dodum/400.css'
import '@fontsource/nanum-pen-script/400.css'
import './index.css'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App.tsx'
import { AdminPage } from './features/admin/AdminPage'

// 서비스워커 등록. autoUpdate 모드라 새 버전이 제어권을 잡으면 페이지를 자동으로 새로고침해,
// 배포 뒤 캐시를 지우거나 손으로 새로고침하지 않아도 새 화면이 나온다. 오래 열어 둔 탭을 위해
// 한 시간마다 갱신도 확인한다.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (registration) setInterval(() => registration.update(), 60 * 60 * 1000)
  },
})

const root = document.getElementById('root')
if (!root) {
  throw new Error('#root 요소가 없다')
}

createRoot(root).render(
  <StrictMode>
    {/* 라우터 없이 주소 하나만 가른다. 관리자 플레이 기록 (decisions.md 46번) */}
    {window.location.pathname === '/admin' ? <AdminPage /> : <App />}
  </StrictMode>,
)
