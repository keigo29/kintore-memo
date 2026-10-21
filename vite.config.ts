import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages は https://ユーザー名.github.io/リポジトリ名/ で公開されるので、
// 公開するときは BASE_PATH=/リポジトリ名/ を渡す（GitHub Actions が自動で渡す）。
// ふだんの開発（npm run dev）は '/' のまま。
const base = process.env.BASE_PATH ?? '/'

// 設定画面の「このアプリについて」に出す版と、作った日
const APP_VERSION = process.env.npm_package_version ?? '0.0.0'
const BUILT_AT = new Date().toISOString().slice(0, 10)

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __BUILT_AT__: JSON.stringify(BUILT_AT),
  },
  plugins: [
    react(),
    // PWA：ホーム画面に入れられて、電波がなくても開ける
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '筋トレメモ',
        short_name: '筋トレメモ',
        description: '筋トレの記録と成長の振り返り',
        lang: 'ja',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#f3f4f5',
        theme_color: '#f3f4f5',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // 日本語フォントは文字ごとに100個以上のファイルに分かれていて大きいので、最初にまとめて保存しない。
        // 画面で使った分だけ、そのつど保存する（一度表示した文字は電波がなくても出る）
        globIgnores: ['**/zen-kaku-gothic-new-[0-9]*'],
        runtimeCaching: [
          {
            urlPattern: /zen-kaku-gothic-new-\d+-.*\.woff2$/,
            handler: 'CacheFirst',
            options: { cacheName: 'jp-font', expiration: { maxEntries: 400 } },
          },
        ],
      },
    }),
  ],
  server: { host: true },
})
