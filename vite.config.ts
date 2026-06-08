import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/Money-PWA/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Money',
        short_name: 'Money',
        description: 'Personal finance tracker with Google Sheets sync',
        theme_color: '#e07e38',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/Money-PWA/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/sheets\.googleapis\.com\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'sheets-api', networkTimeoutSeconds: 10 },
          },
          {
            urlPattern: /^https:\/\/api\.frankfurter\.app\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'exchange-rates', networkTimeoutSeconds: 10 },
          },
          {
            urlPattern: /^https:\/\/accounts\.google\.com\/gsi\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
