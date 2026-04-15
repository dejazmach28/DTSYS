import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { initializeTheme } from './store/themeStore'
import { useBrandingStore } from './store/brandingStore'

initializeTheme()

// Apply stored favicon on boot
const storedFavicon = useBrandingStore.getState().faviconUrl
if (storedFavicon) {
  const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']") ?? document.createElement('link')
  link.rel = 'icon'
  link.href = storedFavicon
  document.head.appendChild(link)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
