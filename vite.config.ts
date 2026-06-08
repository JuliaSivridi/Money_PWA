import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/Money_PWA/',
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
        background_color: '#e07e38',
        display: 'standalone',
        start_url: '/Money_PWA/',
        scope: '/Money_PWA/',
        icons: [
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
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
