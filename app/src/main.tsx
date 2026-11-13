import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/noto-serif-kr/900.css'
import '@fontsource/noto-sans-kr/400.css'
import '@fontsource/noto-sans-kr/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/gowun-dodum/400.css'
import '@fontsource/nanum-pen-script/400.css'
import '@fontsource/jua/400.css'
import './index.css'
import './app/toy-city/toy-city.css'
import { App as NativeApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { App } from './app/App'
import { useAppUi } from './app/ui'

// 안드로이드 뒤로 가기: 시트가 열려 있으면 닫고, 다른 탭이면 사무실로, 사무실이면 앱을 뒤로 보낸다 (decisions.md 309번).
if (Capacitor.isNativePlatform()) {
  void NativeApp.addListener('appStateChange', ({ isActive }) => {
    window.dispatchEvent(new CustomEvent('idle-app-active', { detail: isActive }))
  })
  void NativeApp.addListener('backButton', () => {
    if (!useAppUi.getState().back()) {
      void NativeApp.minimizeApp()
    }
  })
}

const root = document.getElementById('root')
if (!root) {
  throw new Error('#root 요소가 없다')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
