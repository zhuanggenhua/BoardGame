import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import localeHashPlugin from './plugins/vite-locale-hash'
import { readyCheckPlugin } from './vite-plugins/ready-check'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devPort = Number(env.VITE_DEV_PORT) || 5173
  const gameServerPort = Number(env.GAME_SERVER_PORT) || 18000
  const apiServerPort = Number(env.API_SERVER_PORT) || 18001
  const suppressE2EProxyNoise = env.E2E_PROXY_QUIET === 'true'

  const isIgnorableProxyError = (err: Error & NodeJS.ErrnoException) => {
    if (err.code === 'ECONNABORTED') return true
    if (!suppressE2EProxyNoise) return false
    return err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'EPIPE'
  }

  const logProxyError = (label: string, err: Error & NodeJS.ErrnoException) => {
    if (isIgnorableProxyError(err)) return
    console.error(`[proxy ${label}]`, err.message)
  }

  return {
    plugins: [
      // 屏蔽 public/ 目录 import 警告（@locales alias 内联打包 i18n JSON 的已知副作用）
      {
        name: 'suppress-public-dir-warning',
        enforce: 'pre' as const,
        configResolved(config) {
          const originalWarn = config.logger.warn;
          config.logger.warn = (msg, options) => {
            if (typeof msg === 'string' && msg.includes('Assets in public directory cannot be imported')) return;
            originalWarn(msg, options);
          };
        },
      },
      {
        name: 'suppress-e2e-proxy-noise',
        enforce: 'pre' as const,
        configResolved(config) {
          if (!suppressE2EProxyNoise) return
          const originalError = config.logger.error;
          config.logger.error = (msg, options) => {
            if (typeof msg === 'string' && msg.includes('ws proxy error')) return;
            originalError(msg, options);
          };
        },
      },
      react(),
      localeHashPlugin(),
      readyCheckPlugin(), // 添加就绪检查插件
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // 重型第三方库拆分为独立 chunk，支持并行加载和长期缓存
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-motion': ['framer-motion'],
            'vendor-socket': ['socket.io-client'],
            'vendor-i18n': ['i18next', 'react-i18next', 'i18next-http-backend', 'i18next-browser-languagedetector'],
            'vendor-query': ['@tanstack/react-query'],
            'vendor-howler': ['howler'],
          },
        },
      },
    },
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(__dirname, './src'),
        // 允许 src/ 下的代码 import public/locales/ 中的 JSON（i18n 内联打包）
        // Vite 默认禁止 import public/ 文件，alias 绕过此限制且不产生文件重复
        '@locales': path.resolve(__dirname, './public/locales'),
      },
    },
    optimizeDeps: {
      entries: ['index.html'],
    },
    server: {
      host: '0.0.0.0',
      port: devPort,
      strictPort: true,
      // HMR 配置：使用轮询模式避免 WebSocket 不稳定
      hmr: {
        protocol: 'ws',
        host: 'localhost',
        port: devPort,
        clientPort: devPort,
      },
      // 排除测试产物、临时目录和配置文件，避免 E2E/脚本写盘触发开发页抖动。
      watch: {
        // 使用轮询模式，避免 Windows 原生文件监听器崩溃
        usePolling: true,
        interval: 1000,  // 轮询间隔 1 秒
        ignored: [
          '**/test-results/**',
          '**/playwright-report/**',
          '**/.tmp/**',
          '**/temp/**',
          '**/tmp/**',
          '**/evidence/**',
          '**/logs/**',
          '**/node_modules/**',
          '**/*.test.*',
          '**/*.spec.*',
          '**/e2e/**',
          '**/.tmp-*',
          '**/.env',           // 禁止监听 .env 文件，避免环境变量变化触发重启崩溃
          '**/.env.*',         // 禁止监听 .env.* 文件（.env.local, .env.production 等）
          '**/playwright.config.*',  // 禁止监听 Playwright 配置文件
          '**/vitest.config.*',      // 禁止监听 Vitest 配置文件
          '**/vite.config.*',        // 禁止监听 Vite 配置文件（避免循环重启）
        ],
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
              logProxyError('/socket.io', err)
            })
          },
        },
        '/lobby-socket': {
          target: `http://127.0.0.1:${gameServerPort}`,
          changeOrigin: true,
          ws: true,
          configure: (proxy) => {
            proxy.on('error', (err) => {
              logProxyError('/lobby-socket', err)
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
              logProxyError('/social-socket', err)
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
        // 头像上传资源代理
        '/assets/avatars': {
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
