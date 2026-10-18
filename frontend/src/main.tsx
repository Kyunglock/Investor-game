import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/noto-serif-kr/900.css'
import '@fontsource/noto-sans-kr/400.css'
import '@fontsource/noto-sans-kr/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/600.css'
import './index.css'
import { App } from './App.tsx'

const root = document.getElementById('root')
if (!root) {
  throw new Error('#root 요소가 없다')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
