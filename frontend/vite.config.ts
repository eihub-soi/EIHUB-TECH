import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['logo.png', 'pwa-icons/*.png'],
      manifest: {
        name: 'EI HUB Innoventry',
        short_name: 'Innoventry',
        description: 'Enterprise Laboratory Component Inventory & Management Platform',
        theme_color: '#6366F1',
        background_color: '#0B132B',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-icons/manifest-icon-72.maskable.png',
            sizes: '72x72',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/pwa-icons/manifest-icon-96.maskable.png',
            sizes: '96x96',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/pwa-icons/manifest-icon-128.maskable.png',
            sizes: '128x128',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/pwa-icons/manifest-icon-144.maskable.png',
            sizes: '144x144',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/pwa-icons/manifest-icon-152.maskable.png',
            sizes: '152x152',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/pwa-icons/manifest-icon-192.maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/pwa-icons/manifest-icon-384.maskable.png',
            sizes: '384x384',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/pwa-icons/manifest-icon-512.maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5000000,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,ttf}'],
        navigateFallback: '/index.html',
        navigateFallbackAllowlist: [/^(?!\/api)/],
        importScripts: ['/sw-env.js'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkOnly'
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html'
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('purify')) {
              return 'vendor-pdf';
            }
            if (id.includes('xlsx') || id.includes('papaparse')) {
              return 'vendor-excel';
            }
            if (id.includes('recharts') || id.includes('d3')) {
              return 'vendor-charts';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-lucide';
            }
            return 'vendor-core';
          }
        }
      }
    }
  },
  server: {
    port: 3000,
    strictPort: true,
    open: false,
    hmr: {
      host: 'localhost',
      port: 3000,
      clientPort: 3000,
      protocol: 'ws',
    },
    proxy: {
      '/api-brevo': {
        target: 'https://api.brevo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-brevo/, ''),
        headers: {
          'Origin': 'https://api.brevo.com'
        }
      },
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      }
    }
  },
  preview: {
    port: 3000,
    proxy: {
      '/api-brevo': {
        target: 'https://api.brevo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-brevo/, ''),
        headers: {
          'Origin': 'https://api.brevo.com'
        }
      },
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      }
    }
  },
});
