import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

const container = document.getElementById('root')!
const app = (
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)

// Hydrate only when the prerendered HTML is for this route — nginx serves the
// home page's index.html as the fallback for unknown URLs (404 page).
const pathname = window.location.pathname.replace(/\/+$/, '') || '/'
if (container.dataset.route === pathname) {
  hydrateRoot(container, app)
} else {
  createRoot(container).render(app)
}
