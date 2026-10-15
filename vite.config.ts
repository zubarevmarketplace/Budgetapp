import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// GitHub Pages serves the site under /<repo>/ — override with BASE_PATH for other hosts.
const base = process.env.BASE_PATH ?? '/Budgetapp/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      disable: process.env.VITE_DEMO === '1',
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Копилка — мой бюджет',
        short_name: 'Копилка',
        description: 'Личный бюджет: лимит на ништяки, цели и вклады. Данные только на вашем телефоне.',
        lang: 'ru',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f6f5f2',
        theme_color: '#f6f5f2',
        shortcuts: [{ name: 'Записать трату', short_name: 'Трата', url: `${base}?add=1`, icons: [{ src: 'pwa-192.png', sizes: '192x192' }] }],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
})
