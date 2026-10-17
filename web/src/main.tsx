import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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
