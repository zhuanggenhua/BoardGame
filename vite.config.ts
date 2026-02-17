import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devPort = Number(env.VITE_DEV_PORT) || 5173
  const gameServerPort = Number(env.GAME_SERVER_PORT) || 18000
  const apiServerPort = Number(env.API_SERVER_PORT) || 18001

  return {
    plugins: [react()],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      entries: ['index.html'],
    },
    server: {
      host: '0.0.0.0',
      port: devPort,
      strictPort: true,
      // 排除测试产物目录，避免 Playwright 写入截图/报告时触发 HMR full-reload
      watch: {
        ignored: ['**/test-results/**', '**/playwright-report/**', '**/.tmp/**', '**/evidence/**'],
      },
      proxy: {
        '/games': {
          target: `http://127.0.0.1:${gameServerPort}`,
          changeOrigin: true,
        },
        // socket.io 传输层（/game namespace 用于游戏状态同步）
        '/socket.io': {
          target: `http://127.0.0.1:${gameServerPort}`,
          changeOrigin: true,
          ws: true,
          configure: (proxy) => {
            proxy.on('error', (err) => {
              if ((err as NodeJS.ErrnoException).code === 'ECONNABORTED') return
              console.error('[proxy /socket.io]', err.message)
            })
          },
        },
        '/lobby-socket': {
          target: `http://127.0.0.1:${gameServerPort}`,
          changeOrigin: true,
          ws: true,
          configure: (proxy) => {
            proxy.on('error', (err) => {
              if ((err as NodeJS.ErrnoException).code === 'ECONNABORTED') return
              console.error('[proxy /lobby-socket]', err.message)
            })
          },
        },
        '/auth': {
          target: `http://127.0.0.1:${apiServerPort}`,
          changeOrigin: true,
        },
        '/admin': {
          target: `http://127.0.0.1:${apiServerPort}`,
          changeOrigin: true,
          bypass: (req) => {
            if (req.headers.accept?.includes('text/html')) {
              return req.url;
            }
          },
        },
        '/feedback': {
          target: `http://127.0.0.1:${apiServerPort}`,
          changeOrigin: true,
        },
        '/sponsors': {
          target: `http://127.0.0.1:${apiServerPort}`,
          changeOrigin: true,
        },
        '/notifications': {
          target: `http://127.0.0.1:${apiServerPort}`,
          changeOrigin: true,
        },
        '/social-socket': {
          target: `http://127.0.0.1:${apiServerPort}`,
          changeOrigin: true,
          ws: true,
          configure: (proxy) => {
            proxy.on('error', (err) => {
              if ((err as NodeJS.ErrnoException).code === 'ECONNABORTED') return
              console.error('[proxy /social-socket]', err.message)
            })
          },
        },
        '/ugc': {
          target: `http://127.0.0.1:${apiServerPort}`,
          changeOrigin: true,
        },
        // UGC 上传资源代理（后端 uploads/ 目录）
        // 注意：public/assets/ 下的静态文件（音频/图片等）由 Vite 直接 serve
        // 仅代理 UGC 动态上传的资源（uploads/ugc/...）
        '/assets/ugc': {
          target: `http://127.0.0.1:${apiServerPort}`,
          changeOrigin: true,
        },
        '/layout': {
          target: `http://127.0.0.1:${apiServerPort}`,
          changeOrigin: true,
        },

      },
    }
  }
})
