import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import localeHashPlugin from './plugins/vite-locale-hash'
import { readyCheckPlugin } from './vite-plugins/ready-check'

const readCliFlag = (flagName: string): string | undefined => {
  const prefix = `--${flagName}=`
  for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i]
    if (arg === `--${flagName}`) {
      const next = process.argv[i + 1]
      return next && !next.startsWith('-') ? next : undefined
    }

    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length)
    }
  }

  return undefined
}

const createAndroidBuildMetaPlugin = (mode: string, backendUrl: string) => ({
  name: 'android-build-meta',
  apply: 'build' as const,
  generateBundle() {
    if (mode !== 'android') return

    this.emitFile({
      type: 'asset',
      fileName: 'android-build-meta.json',
      source: JSON.stringify(
        {
          mode,
          backendUrl,
          builtAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    })
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const cliPort = Number(readCliFlag('port'))
  const cliHost = readCliFlag('host')
  const devPort = Number.isFinite(cliPort) && cliPort > 0
    ? cliPort
    : Number(env.VITE_DEV_PORT) || 5173
  const serverHost = cliHost || '0.0.0.0'
  const hmrHost = cliHost && cliHost !== '0.0.0.0' ? cliHost : 'localhost'
  const gameServerPort = Number(env.GAME_SERVER_PORT) || 18000
  const apiServerPort = Number(env.API_SERVER_PORT) || 18001
  const suppressE2EProxyNoise = env.E2E_PROXY_QUIET === 'true'
  const backendUrl = env.VITE_BACKEND_URL || ''

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
      {
        name: 'suppress-public-dir-warning',
        enforce: 'pre' as const,
        configResolved(config) {
          const originalWarn = config.logger.warn
          config.logger.warn = (msg, options) => {
            if (typeof msg === 'string' && msg.includes('Assets in public directory cannot be imported')) {
              return
            }
            originalWarn(msg, options)
          }
        },
      },
      {
        name: 'suppress-e2e-proxy-noise',
        enforce: 'pre' as const,
        configResolved(config) {
          if (!suppressE2EProxyNoise) return
          const originalError = config.logger.error
          config.logger.error = (msg, options) => {
            if (typeof msg === 'string' && msg.includes('ws proxy error')) return
            originalError(msg, options)
          }
        },
      },
      react(),
      localeHashPlugin(),
      readyCheckPlugin(),
      createAndroidBuildMetaPlugin(mode, backendUrl),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
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
        '@locales': path.resolve(__dirname, './public/locales'),
      },
    },
    optimizeDeps: {
      entries: ['index.html'],
    },
    server: {
      host: serverHost,
      port: devPort,
      strictPort: true,
      hmr: {
        protocol: 'ws',
        host: hmrHost,
        port: devPort,
        clientPort: devPort,
      },
      watch: {
        usePolling: true,
        interval: 1000,
        ignored: [
          '**/test-results/**',
          '**/playwright-report/**',
          '**/.tmp/**',
          '**/temp/**',
          '**/tmp/**',
          '**/evidence/**',
          '**/logs/**',
          '**/android/app/**',
          '**/android/build/**',
          '**/node_modules/**',
          '**/*.test.*',
          '**/*.spec.*',
          '**/e2e/**',
          '**/.tmp-*',
          '**/.env',
          '**/.env.*',
          '**/playwright.config.*',
          '**/vitest.config.*',
          '**/vite.config.*',
        ],
      },
      proxy: {
        '/games': {
          target: `http://127.0.0.1:${gameServerPort}`,
          changeOrigin: true,
        },
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
        '/game-changelogs': {
          target: `http://127.0.0.1:${apiServerPort}`,
          changeOrigin: true,
        },
        '/admin': {
          target: `http://127.0.0.1:${apiServerPort}`,
          changeOrigin: true,
          bypass: (req) => {
            if (req.headers.accept?.includes('text/html')) {
              return req.url
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
        '/assets/ugc': {
          target: `http://127.0.0.1:${apiServerPort}`,
          changeOrigin: true,
        },
        '/assets/avatars': {
          target: `http://127.0.0.1:${apiServerPort}`,
          changeOrigin: true,
        },
        '/layout': {
          target: `http://127.0.0.1:${apiServerPort}`,
          changeOrigin: true,
        },
      },
    },
  }
})
