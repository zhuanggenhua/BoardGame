import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'path'
import { fileURLToPath } from 'url'
import ts from 'typescript'
import localeHashPlugin from './plugins/vite-locale-hash.ts'
import assetHashPlugin from './plugins/vite-asset-hash.ts'
import publicFileHashPlugin from './plugins/vite-public-file-hash.ts'
import { readyCheckPlugin } from './vite-plugins/ready-check.ts'

const configDir = path.dirname(fileURLToPath(import.meta.url))
const LEGACY_GAMEPLAY_BUILD_TARGETS = ['chrome88', 'edge88', 'firefox78', 'safari14']
const VIRTUAL_RUNTIME_CHUNK_PATTERNS = ['commonjsHelpers.js']
const MANUAL_CHUNK_PATTERNS: Array<[string, string[]]> = [
  ['vendor-react', ['/node_modules/react/', '/node_modules/react-dom/', '/node_modules/react-router-dom/', '/node_modules/scheduler/']],
  ['vendor-motion', ['/node_modules/framer-motion/']],
  ['vendor-socket', ['/node_modules/socket.io-client/', '/node_modules/socket.io-msgpack-parser/', '/node_modules/@msgpack/msgpack/']],
  ['vendor-i18n', ['/node_modules/i18next/', '/node_modules/react-i18next/', '/node_modules/i18next-http-backend/', '/node_modules/i18next-browser-languagedetector/']],
  ['vendor-query', ['/node_modules/@tanstack/react-query/']],
  ['vendor-howler', ['/node_modules/howler/']],
]
const ANDROID_BUILD_PRUNE_PATHS = [
  'assets/atlas-configs/smashup/2833984701.json',
  'assets/common/audio/registry.json',
  'assets/common/audio/phrase-mappings.zh-CN.json',
]

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

const debugAndroidAppIdSegments = new Set(['debug', 'dev', 'test', 'qa'])

const isNonReleaseAndroidAppId = (appId: string) => (
  appId
    .split('.')
    .some((segment) => debugAndroidAppIdSegments.has(segment.trim().toLowerCase()))
)

const createAndroidBuildMetaPlugin = (mode: string, backendUrl: string) => ({
  name: 'android-build-meta',
  apply: 'build' as const,
  generateBundle() {
    if (mode !== 'android') return

    const appId = process.env.VITE_CAPACITOR_APP_ID?.trim() || process.env.CAPACITOR_APP_ID?.trim() || ''
    const appName = process.env.CAPACITOR_APP_NAME?.trim() || ''

    this.emitFile({
      type: 'asset',
      fileName: 'android-build-meta.json',
      source: JSON.stringify(
        {
          mode,
          backendUrl,
          builtAt: new Date().toISOString(),
          appId,
          appName,
          shellType: appId && !isNonReleaseAndroidAppId(appId) ? 'release' : 'non-release',
        },
        null,
        2,
      ),
    })
  },
})

const createInlineTypeScriptFallbackPlugin = (enabled: boolean) => ({
  name: 'inline-typescript-fallback',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    if (!enabled) return null

    const [cleanId] = id.split('?')
    if (!cleanId || cleanId.includes('/node_modules/')) return null
    if (!cleanId.endsWith('.ts') && !cleanId.endsWith('.tsx')) return null

    const transpiled = ts.transpileModule(code, {
      fileName: cleanId,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        jsx: cleanId.endsWith('.tsx') ? ts.JsxEmit.ReactJSX : undefined,
        sourceMap: true,
        inlineSources: true,
        allowImportingTsExtensions: true,
        importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
        preserveValueImports: false,
        verbatimModuleSyntax: false,
      },
    })

    return {
      code: transpiled.outputText,
      map: transpiled.sourceMapText ? JSON.parse(transpiled.sourceMapText) : null,
    }
  },
})

const createAndroidDistPrunePlugin = (mode: string) => ({
  name: 'android-dist-prune',
  apply: 'build' as const,
  closeBundle() {
    if (mode !== 'android') return

    const distDir = path.resolve(configDir, 'dist')
    for (const relativePath of ANDROID_BUILD_PRUNE_PATHS) {
      const targetPath = path.join(distDir, relativePath)
      if (!fs.existsSync(targetPath)) continue
      fs.rmSync(targetPath, { force: true })
    }
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const forceInlineVite = env.BG_VITE_FORCE_INLINE === '1'
    || process.env.BG_VITE_FORCE_INLINE === '1'
  const disableViteWatch = process.env.PW_SERVER_WATCH === 'false'
    || process.env.VITE_DISABLE_WATCH === 'true'
    || env.VITE_DISABLE_WATCH === 'true'
  const cliPort = Number(readCliFlag('port'))
  const cliHost = readCliFlag('host')
  const devPort = Number.isFinite(cliPort) && cliPort > 0
    ? cliPort
    : Number(env.VITE_DEV_PORT) || 4173
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
      ...(forceInlineVite ? [] : [react()]),
      createInlineTypeScriptFallbackPlugin(forceInlineVite),
      localeHashPlugin(),
      assetHashPlugin(),
      publicFileHashPlugin(),
      readyCheckPlugin(),
      createAndroidBuildMetaPlugin(mode, backendUrl),
      createAndroidDistPrunePlugin(mode),
    ],
    esbuild: forceInlineVite ? false : undefined,
    build: {
      // Vite 默认会为产物计算 gzip/brotli 体积，在 Windows + 大 bundle 场景下可能触发 zlib “insufficient memory”。
      // 这只影响日志展示，不影响产物本身；为稳定本地/门禁构建，这里禁用压缩体积报告。
      reportCompressedSize: false,
      // 生产构建向下兼容到 Chrome 88+ 这档现代浏览器，确保旧一点的 WebView 也能正常进入并游玩。
      target: LEGACY_GAMEPLAY_BUILD_TARGETS,
      cssTarget: LEGACY_GAMEPLAY_BUILD_TARGETS,
      rollupOptions: {
        output: {
          manualChunks(id) {
            // 把 CommonJS helper 单独抽离，避免某个大 vendor chunk 承载它后反向拖进首页入口。
            if (VIRTUAL_RUNTIME_CHUNK_PATTERNS.some(pattern => id.includes(pattern))) {
              return 'vendor-runtime'
            }

            if (!id.includes('/node_modules/')) return undefined

            for (const [chunkName, patterns] of MANUAL_CHUNK_PATTERNS) {
              if (patterns.some(pattern => id.includes(pattern))) {
                return chunkName
              }
            }

            return undefined
          },
        },
      },
    },
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(configDir, './src'),
        '@locales': path.resolve(configDir, './public/locales'),
      },
    },
    optimizeDeps: {
      ...(forceInlineVite
        ? {
            // In constrained environments, disable dep optimization to avoid esbuild spawn EPERM.
            noDiscovery: true,
            include: [],
            entries: undefined,
          }
        : {
            entries: ['index.html'],
          }),
    },
    server: {
      host: serverHost,
      port: devPort,
      strictPort: true,
      hmr: disableViteWatch
        ? false
        : {
            protocol: 'ws',
            host: hmrHost,
            port: devPort,
            clientPort: devPort,
          },
      // 单次 E2E 不依赖热更新；禁用监听可避免并发改工作区时触发 Vite 重启。
      watch: disableViteWatch
        ? {
            ignored: ['**/*'],
          }
        : {
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
        '/devtools/ai-repo-workbench': {
          target: `http://127.0.0.1:${apiServerPort}`,
          changeOrigin: true,
        },
      },
    },
  }
})
