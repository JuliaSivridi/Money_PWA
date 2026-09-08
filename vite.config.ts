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
            // Sheets data must always be fresh — never serve stale rows as truth
            urlPattern: /^https:\/\/sheets\.googleapis\.com\//,
            handler: 'NetworkOnly',
          },
          {
            // Exchange rates are updated daily; CacheFirst is fine.
            // Offline fallback comes from localStorage (exchangeRateStore persist).
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/@fawazahmed0\/currency-api/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'exchange-rates',
              expiration: { maxAgeSeconds: 86400 },
            },
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
