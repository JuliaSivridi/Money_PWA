import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Remove splash screen after React's first paint
requestAnimationFrame(() => requestAnimationFrame(() => {
  document.getElementById('splash')?.remove()
}))
