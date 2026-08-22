import { defineConfig, loadEnv } from 'vite'
import type { ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'path'
import { fileURLToPath } from 'url'
import ts from 'typescript'
import localeHashPlugin from './plugins/vite-locale-hash.ts'
import assetHashPlugin from './plugins/vite-asset-hash.ts'
import publicFileHashPlugin from './plugins/vite-public-file-hash.ts'
import {
  normalizeQidahenRegionMaskAuthoritativeWorkspaceMeta,
  readQidahenRegionMaskAuthoritativeWorkspaceMetaCompat,
} from './src/games/qidahen/regionAuthoritativeGuideFormats.ts'
import { assertNoPublicBackendSplit, resolveAndroidBackendUrl } from './scripts/mobile/public-backend-url.js'
import type {
  QidahenRegionMaskLoadPayload,
  QidahenRegionMaskSavePayload,
  QidahenRegionMaskSaveResult,
} from './src/games/qidahen/regionMaskWorkspaceBridge.ts'
import { normalizeQidahenRegionMaskSaveScope } from './src/games/qidahen/regionMaskWorkspaceBridge.ts'
import { readyCheckPlugin } from './vite-plugins/ready-check.ts'

const configDir = path.dirname(fileURLToPath(import.meta.url))
const packageJson = JSON.parse(fs.readFileSync(path.resolve(configDir, 'package.json'), 'utf-8')) as {
  version?: string
}
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
const STABLE_OPTIMIZE_DEPS = [
  'react',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'react-dom',
  'react-dom/client',
  'react-i18next',
  'react-easy-crop',
  'lucide-react',
  'framer-motion',
  'fast-json-patch',
  'cookie',
  'set-cookie-parser',
  'debug',
  'howler',
  'normalize-wheel',
  'socket.io-msgpack-parser',
] as const
const QIDAHEN_REGION_MASK_SAVE_ROUTE = '/devtools/qidahen-region-mask/save'
const QIDAHEN_REGION_MASK_LOAD_ROUTE = '/devtools/qidahen-region-mask/load'
const CONFIG_REVIEW_SPA_ROUTES = [
  '/games/summonerwars/config',
  '/games/dicethrone/config',
  '/games/betrayal/config',
] as const
const QIDAHEN_REGION_MASK_DEFAULT_OUTPUT_DIR = path.resolve(configDir, 'src/games/qidahen/data')
const QIDAHEN_REGION_MASK_WORKSPACE_ROOT = path.resolve(configDir, 'temp/devtools/qidahen-region-mask-workspaces')
const QIDAHEN_REGION_MASK_OUTPUT_FILES = {
  mask: 'region-mask.png',
  regions: 'region-mask-regions.json',
  graph: 'region-graph.json',
} as const
const QIDAHEN_REGION_MASK_INTERNAL_FILES = {
  boundaryMask: 'region-boundary-mask.png',
  barrierAdd: 'region-boundary-add.png',
  barrierRemove: 'region-boundary-remove.png',
  boundarySourceReference: 'region-boundary-source-reference.png',
  authoritativeMask: 'region-authoritative-guides.png',
  authoritativeWorkspaceMeta: 'region-authoritative-guides.workspace.json',
} as const
const QIDAHEN_REGION_MASK_FORMAL_AUTHORITATIVE_GUIDE_FILE = 'region-authoritative-guides.json'
const API_DISABLED_PREFIXES = [
  '/admin-api',
  '/auth',
  '/feedback',
  '/sponsors',
  '/notifications',
  '/game-changelogs',
  '/ugc',
  '/assets/ugc',
  '/assets/avatars',
  '/layout',
  '/devtools/ai-repo-workbench',
]
const isTruthyFlag = (value: string | undefined) => /^(1|true|yes|on)$/i.test(value?.trim() || '')
const isConfigReviewSpaRoute = (pathname: string) => CONFIG_REVIEW_SPA_ROUTES.some(
  (route) => pathname === route || pathname.startsWith(`${route}/`),
)

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

const readBuildMetaValue = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

const resolveGitCommitSha = (): string | undefined => {
  const envValue = readBuildMetaValue(process.env.APP_COMMIT_SHA)
    || readBuildMetaValue(process.env.VITE_APP_COMMIT_SHA)
    || readBuildMetaValue(process.env.GIT_COMMIT_SHA)
    || readBuildMetaValue(process.env.COMMIT_SHA)
    || readBuildMetaValue(process.env.GITHUB_SHA)
  if (envValue) {
    return envValue.slice(0, 12)
  }

  try {
    const commitSha = execSync('git rev-parse --short=12 HEAD', {
      cwd: configDir,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString('utf-8').trim()
    return commitSha || undefined
  } catch {
    return undefined
  }
}

const debugAndroidAppIdSegments = new Set(['debug', 'dev', 'test', 'qa'])
const sanitizeViteCacheSegment = (value: string) => (
  value
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'default'
)

const resolveViteCacheDir = (devPort: number) => {
  const explicitCacheDir = process.env.VITE_CACHE_DIR?.trim()
    || process.env.BG_VITE_CACHE_DIR?.trim()
  if (explicitCacheDir) {
    return explicitCacheDir
  }

  const cacheKey = process.env.BG_VITE_CACHE_KEY?.trim()
    || `port-${devPort}`
  return path.resolve(configDir, 'node_modules/.vite', sanitizeViteCacheSegment(cacheKey))
}

const isNonReleaseAndroidAppId = (appId: string) => (
  appId
    .split('.')
    .some((segment) => debugAndroidAppIdSegments.has(segment.trim().toLowerCase()))
)

const createAndroidBuildMetaPlugin = (
  mode: string,
  backendUrl: string,
  homeV2DraftEnabled: boolean,
  env: Record<string, string>,
) => ({
  name: 'android-build-meta',
  apply: 'build' as const,
  generateBundle() {
    if (mode !== 'android') return

    const appId = process.env.VITE_CAPACITOR_APP_ID?.trim() || process.env.CAPACITOR_APP_ID?.trim() || ''
    const appName = process.env.CAPACITOR_APP_NAME?.trim() || ''
    const forceBuiltinBundle = /^(1|true|yes|on)$/i.test(
      process.env.VITE_ANDROID_FORCE_BUILTIN_BUNDLE?.trim()
        || process.env.ANDROID_FORCE_BUILTIN_BUNDLE?.trim()
        || '',
    )
    const otaEnabled = /^(1|true|yes|on)$/i.test(env.VITE_ANDROID_OTA_ENABLED?.trim() || '')
    const otaManifestUrl = env.VITE_ANDROID_OTA_MANIFEST_URL?.trim() || ''
    const otaChannel = env.VITE_ANDROID_OTA_CHANNEL?.trim() || 'stable'
    // Android shell root already treats Home V2 as the default homepage.
    // Keep the packaged build metadata aligned with the web/router contract.
    const homeV2EnabledForAndroidBuild = mode === 'android' || homeV2DraftEnabled

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
          forceBuiltinBundle,
          homeV2DraftEnabled: homeV2EnabledForAndroidBuild,
          otaEnabled,
          otaManifestUrl,
          otaChannel,
        },
        null,
        2,
      ),
    })
  },
})

const createIosBuildMetaPlugin = (mode: string, backendUrl: string, env: Record<string, string>) => ({
  name: 'ios-build-meta',
  apply: 'build' as const,
  generateBundle() {
    if (mode !== 'ios') return

    const appId = env.VITE_CAPACITOR_APP_ID?.trim()
      || env.CAPACITOR_APP_ID?.trim()
      || process.env.VITE_CAPACITOR_APP_ID?.trim()
      || process.env.CAPACITOR_APP_ID?.trim()
      || ''
    const appName = env.CAPACITOR_APP_NAME?.trim()
      || process.env.CAPACITOR_APP_NAME?.trim()
      || ''

    this.emitFile({
      type: 'asset',
      fileName: 'ios-build-meta.json',
      source: JSON.stringify(
        {
          mode,
          backendUrl,
          builtAt: new Date().toISOString(),
          appId,
          appName,
          shellType: appId === 'top.easyboardgame.app' ? 'release' : 'non-release',
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

const readRequestBody = (req: NodeJS.ReadableStream, maxBytes = 20 * 1024 * 1024) => new Promise<string>((resolve, reject) => {
  const chunks: Buffer[] = []
  let size = 0

  req.on('data', (chunk: Buffer | string) => {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.byteLength
    if (size > maxBytes) {
      reject(new Error('请求体过大'))
      return
    }
    chunks.push(buffer)
  })
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
  req.on('error', reject)
})

const parsePngDataUrl = (value: unknown): Buffer => {
  if (typeof value !== 'string') {
    throw new Error('缺少 maskPngDataUrl')
  }
  const match = /^data:image\/png;base64,(.+)$/u.exec(value)
  if (!match) {
    throw new Error('maskPngDataUrl 必须是 PNG data URL')
  }
  return Buffer.from(match[1], 'base64')
}

const toPngDataUrl = (buffer: Buffer) => `data:image/png;base64,${buffer.toString('base64')}`

const sanitizeQidahenWorkspaceKey = (value: string) => (
  value
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
)

const toDisplayRelativePath = (targetPath: string) => {
  const relative = path.relative(configDir, targetPath)
  if (!relative || relative.startsWith('..')) {
    return targetPath.replace(/\\/g, '/')
  }
  return relative.replace(/\\/g, '/')
}

const resolveQidahenRegionMaskOutputConfig = (requestUrl?: string) => {
  const envOverride = process.env.QIDAHEN_REGION_MASK_OUTPUT_DIR?.trim()
  if (envOverride) {
    const outputDir = path.resolve(configDir, envOverride)
    return {
      outputDir,
      outputDirRelative: toDisplayRelativePath(outputDir),
      workspaceKey: null,
    }
  }

  const parsedUrl = requestUrl ? new URL(requestUrl, 'http://127.0.0.1') : null
  const workspaceKey = sanitizeQidahenWorkspaceKey(parsedUrl?.searchParams.get('workspace') ?? '')
  if (workspaceKey) {
    const outputDir = path.join(QIDAHEN_REGION_MASK_WORKSPACE_ROOT, workspaceKey)
    return {
      outputDir,
      outputDirRelative: toDisplayRelativePath(outputDir),
      workspaceKey,
    }
  }

  return {
    outputDir: QIDAHEN_REGION_MASK_DEFAULT_OUTPUT_DIR,
    outputDirRelative: 'src/games/qidahen/data',
    workspaceKey: null,
  }
}

const createQidahenRegionMaskDevtoolsPlugin = () => ({
  name: 'qidahen-region-mask-devtools-save',
  apply: 'serve' as const,
  configureServer(server: { middlewares: { use: (route: string, handler: (req: NodeJS.ReadableStream & { method?: string; url?: string }, res: NodeJS.WritableStream & { statusCode?: number; setHeader?: (name: string, value: string) => void }, next: () => void) => void) => void } }) {
    const send = (res: NodeJS.WritableStream & { statusCode?: number; setHeader?: (name: string, value: string) => void }, statusCode: number, payload: string | object) => {
      res.statusCode = statusCode
      res.setHeader?.('Content-Type', typeof payload === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8')
      res.write(typeof payload === 'string' ? payload : JSON.stringify(payload))
      res.end()
    }

    server.middlewares.use(QIDAHEN_REGION_MASK_LOAD_ROUTE, (req, res) => {
      if (req.method !== 'GET') {
        send(res, 405, '只允许 GET 读取区域数据')
        return
      }

      try {
        const outputConfig = resolveQidahenRegionMaskOutputConfig(req.url)
        const maskPath = path.join(outputConfig.outputDir, QIDAHEN_REGION_MASK_OUTPUT_FILES.mask)
        const regionsPath = path.join(outputConfig.outputDir, QIDAHEN_REGION_MASK_OUTPUT_FILES.regions)
        const graphPath = path.join(outputConfig.outputDir, QIDAHEN_REGION_MASK_OUTPUT_FILES.graph)
        const boundaryMaskPath = path.join(outputConfig.outputDir, QIDAHEN_REGION_MASK_INTERNAL_FILES.boundaryMask)
        const barrierAddPath = path.join(outputConfig.outputDir, QIDAHEN_REGION_MASK_INTERNAL_FILES.barrierAdd)
        const barrierRemovePath = path.join(outputConfig.outputDir, QIDAHEN_REGION_MASK_INTERNAL_FILES.barrierRemove)
        const boundarySourceReferencePath = path.join(outputConfig.outputDir, QIDAHEN_REGION_MASK_INTERNAL_FILES.boundarySourceReference)
        const authoritativeMaskPath = path.join(outputConfig.outputDir, QIDAHEN_REGION_MASK_INTERNAL_FILES.authoritativeMask)
        const authoritativeWorkspaceMetaPath = path.join(outputConfig.outputDir, QIDAHEN_REGION_MASK_INTERNAL_FILES.authoritativeWorkspaceMeta)
        const authoritativeLegacyMetaPath = path.join(outputConfig.outputDir, QIDAHEN_REGION_MASK_FORMAL_AUTHORITATIVE_GUIDE_FILE)

        if (!fs.existsSync(maskPath) || !fs.existsSync(regionsPath) || !fs.existsSync(graphPath)) {
          send(res, 404, '尚未保存区域数据')
          return
        }

        const authoritativeGuideMeta = fs.existsSync(authoritativeWorkspaceMetaPath)
          ? normalizeQidahenRegionMaskAuthoritativeWorkspaceMeta(JSON.parse(fs.readFileSync(authoritativeWorkspaceMetaPath, 'utf8')))
          : fs.existsSync(authoritativeLegacyMetaPath)
            ? readQidahenRegionMaskAuthoritativeWorkspaceMetaCompat(JSON.parse(fs.readFileSync(authoritativeLegacyMetaPath, 'utf8')))
            : null

        const loadPayload: QidahenRegionMaskLoadPayload = {
          ok: true,
          outputDir: outputConfig.outputDirRelative,
          maskPngDataUrl: toPngDataUrl(fs.readFileSync(maskPath)),
          boundaryMaskPngDataUrl: fs.existsSync(boundaryMaskPath) ? toPngDataUrl(fs.readFileSync(boundaryMaskPath)) : null,
          barrierHints: {
            addPngDataUrl: fs.existsSync(barrierAddPath) ? toPngDataUrl(fs.readFileSync(barrierAddPath)) : null,
            removePngDataUrl: fs.existsSync(barrierRemovePath) ? toPngDataUrl(fs.readFileSync(barrierRemovePath)) : null,
          },
          boundarySourceReferencePngDataUrl: fs.existsSync(boundarySourceReferencePath) ? toPngDataUrl(fs.readFileSync(boundarySourceReferencePath)) : null,
          authoritativeGuides: authoritativeGuideMeta
            ? {
                maskPngDataUrl: fs.existsSync(authoritativeMaskPath) ? toPngDataUrl(fs.readFileSync(authoritativeMaskPath)) : null,
                ...authoritativeGuideMeta,
              }
            : null,
          regions: JSON.parse(fs.readFileSync(regionsPath, 'utf8')),
          graph: JSON.parse(fs.readFileSync(graphPath, 'utf8')),
        }
        send(res, 200, loadPayload)
      } catch (error: unknown) {
        send(res, 500, error instanceof Error ? error.message : '读取失败')
      }
    })

    server.middlewares.use(QIDAHEN_REGION_MASK_SAVE_ROUTE, (req, res) => {
      if (req.method !== 'POST') {
        send(res, 405, '只允许 POST 保存区域数据')
        return
      }

      void readRequestBody(req)
        .then((body) => {
          const outputConfig = resolveQidahenRegionMaskOutputConfig(req.url)
          const payload = JSON.parse(body) as QidahenRegionMaskSavePayload
          const saveScope = normalizeQidahenRegionMaskSaveScope(payload.saveScope)

          if ((saveScope === 'all' || saveScope === 'regions' || saveScope === 'boundary') && payload.regions == null) {
            throw new Error('缺少 regions')
          }
          if ((saveScope === 'all' || saveScope === 'graph' || saveScope === 'boundary') && payload.graph == null) {
            throw new Error('缺少 graph')
          }
          if (saveScope === 'boundary' && payload.boundaryMaskPngDataUrl == null) {
            throw new Error('缺少 boundaryMaskPngDataUrl')
          }
          if (saveScope === 'authoritative-guides' && payload.authoritativeGuides?.maskPngDataUrl == null) {
            throw new Error('缺少 authoritativeGuides.maskPngDataUrl')
          }
          if (saveScope === 'all' && (payload.regions == null || payload.graph == null)) {
            throw new Error('缺少 regions 或 graph')
          }

          fs.mkdirSync(outputConfig.outputDir, { recursive: true })
          if (saveScope === 'all' || saveScope === 'regions' || saveScope === 'boundary') {
            fs.writeFileSync(
              path.join(outputConfig.outputDir, QIDAHEN_REGION_MASK_OUTPUT_FILES.mask),
              parsePngDataUrl(payload.maskPngDataUrl),
            )
            fs.writeFileSync(
              path.join(outputConfig.outputDir, QIDAHEN_REGION_MASK_OUTPUT_FILES.regions),
              `${JSON.stringify(payload.regions, null, 2)}\n`,
              'utf8',
            )
          }
          if (saveScope === 'all' || saveScope === 'graph' || saveScope === 'boundary') {
            fs.writeFileSync(
              path.join(outputConfig.outputDir, QIDAHEN_REGION_MASK_OUTPUT_FILES.graph),
              `${JSON.stringify(payload.graph, null, 2)}\n`,
              'utf8',
            )
          }
          if (saveScope === 'all' || saveScope === 'boundary') {
            fs.writeFileSync(
              path.join(outputConfig.outputDir, QIDAHEN_REGION_MASK_INTERNAL_FILES.boundaryMask),
              parsePngDataUrl(payload.boundaryMaskPngDataUrl),
            )
            fs.writeFileSync(
              path.join(outputConfig.outputDir, QIDAHEN_REGION_MASK_INTERNAL_FILES.barrierAdd),
              parsePngDataUrl(payload.barrierHints?.addPngDataUrl),
            )
            fs.writeFileSync(
              path.join(outputConfig.outputDir, QIDAHEN_REGION_MASK_INTERNAL_FILES.barrierRemove),
              parsePngDataUrl(payload.barrierHints?.removePngDataUrl),
            )
            const boundarySourceReferenceOutputPath = path.join(outputConfig.outputDir, QIDAHEN_REGION_MASK_INTERNAL_FILES.boundarySourceReference)
            if (typeof payload.boundarySourceReferencePngDataUrl === 'string' && payload.boundarySourceReferencePngDataUrl.length > 0) {
              fs.writeFileSync(
                boundarySourceReferenceOutputPath,
                parsePngDataUrl(payload.boundarySourceReferencePngDataUrl),
              )
            } else if (fs.existsSync(boundarySourceReferenceOutputPath)) {
              fs.rmSync(boundarySourceReferenceOutputPath, { force: true })
            }
          }
          if (saveScope === 'all' || saveScope === 'regions' || saveScope === 'authoritative-guides') {
            fs.writeFileSync(
              path.join(outputConfig.outputDir, QIDAHEN_REGION_MASK_INTERNAL_FILES.authoritativeMask),
              parsePngDataUrl(payload.authoritativeGuides?.maskPngDataUrl),
            )
            fs.writeFileSync(
              path.join(outputConfig.outputDir, QIDAHEN_REGION_MASK_INTERNAL_FILES.authoritativeWorkspaceMeta),
              `${JSON.stringify(normalizeQidahenRegionMaskAuthoritativeWorkspaceMeta({
                regionIds: payload.authoritativeGuides?.regionIds,
                runtimeGuideCandidates: payload.authoritativeGuides?.runtimeGuideCandidates,
              }), null, 2)}\n`,
              'utf8',
            )
          }

          const saveResult: QidahenRegionMaskSaveResult = {
            ok: true,
            outputDir: outputConfig.outputDirRelative,
            files: [
              ...(saveScope === 'all' || saveScope === 'regions' ? [QIDAHEN_REGION_MASK_OUTPUT_FILES.mask, QIDAHEN_REGION_MASK_OUTPUT_FILES.regions] : []),
              ...(saveScope === 'all' || saveScope === 'graph' ? [QIDAHEN_REGION_MASK_OUTPUT_FILES.graph] : []),
            ],
            internalFiles: saveScope === 'all'
              ? Object.values(QIDAHEN_REGION_MASK_INTERNAL_FILES)
              : saveScope === 'boundary'
                ? [
                    QIDAHEN_REGION_MASK_OUTPUT_FILES.mask,
                    QIDAHEN_REGION_MASK_OUTPUT_FILES.regions,
                    QIDAHEN_REGION_MASK_OUTPUT_FILES.graph,
                    QIDAHEN_REGION_MASK_INTERNAL_FILES.boundaryMask,
                    QIDAHEN_REGION_MASK_INTERNAL_FILES.barrierAdd,
                    QIDAHEN_REGION_MASK_INTERNAL_FILES.barrierRemove,
                    QIDAHEN_REGION_MASK_INTERNAL_FILES.boundarySourceReference,
                  ]
                : saveScope === 'regions' || saveScope === 'authoritative-guides'
                  ? [QIDAHEN_REGION_MASK_INTERNAL_FILES.authoritativeMask, QIDAHEN_REGION_MASK_INTERNAL_FILES.authoritativeWorkspaceMeta]
                  : [],
          }
          send(res, 200, saveResult)
        })
        .catch((error: unknown) => {
          send(res, 400, error instanceof Error ? error.message : '保存失败')
        })
    })
  },
})

const createDevApiDisabledPlugin = (enabled: boolean) => ({
  name: 'dev-api-disabled-guard',
  enforce: 'pre' as const,
  configureServer(server: ViteDevServer) {
    if (!enabled) return

    server.middlewares.use((req, res, next) => {
      const rawUrl = req.url || '/'
      const pathname = rawUrl.split('?')[0] || '/'
      const accept = Array.isArray(req.headers.accept)
        ? req.headers.accept.join(',')
        : (req.headers.accept || '')
      const isSpaNavigation = req.method === 'GET' && accept.includes('text/html')
      const isApiOnlyPath = API_DISABLED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))

      if (!isApiOnlyPath || isSpaNavigation) {
        next()
        return
      }

      res.statusCode = 503
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({
        error: 'dev_api_disabled',
        message: 'API server is disabled in dev:lite mode.',
        path: pathname,
      }))
    })
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const publicBackendEnv = { ...env, ...process.env }
  const appVersion = readBuildMetaValue(env.VITE_APP_VERSION)
    || readBuildMetaValue(process.env.VITE_APP_VERSION)
    || readBuildMetaValue(process.env.APP_VERSION)
    || readBuildMetaValue(packageJson.version)
    || '0.0.0'
  const appCommitSha = readBuildMetaValue(env.VITE_APP_COMMIT_SHA)
    || resolveGitCommitSha()
    || ''
  const appBuildTime = readBuildMetaValue(env.VITE_APP_BUILD_TIME)
    || readBuildMetaValue(process.env.VITE_APP_BUILD_TIME)
    || readBuildMetaValue(process.env.APP_BUILD_TIME)
    || new Date().toISOString()
  const appReleaseChannel = readBuildMetaValue(env.VITE_APP_RELEASE_CHANNEL)
    || readBuildMetaValue(process.env.VITE_APP_RELEASE_CHANNEL)
    || readBuildMetaValue(process.env.APP_RELEASE_CHANNEL)
    || mode
  // `BG_VITE_FORCE_INLINE` 只控制包装器是否在当前进程内启动 Vite，
  // 不应再顺带切到“禁 react/esbuild + TS fallback”的配置分支；
  // 否则会让 howler 之类 CJS 依赖直接裸露到浏览器端。
  const forceInlineVite = env.BG_VITE_FORCE_CONFIG_INLINE === '1'
    || process.env.BG_VITE_FORCE_CONFIG_INLINE === '1'
  const disableViteWatch = process.env.PW_SERVER_WATCH === 'false'
    || process.env.VITE_DISABLE_WATCH === 'true'
    || env.VITE_DISABLE_WATCH === 'true'
    || process.env.BG_DEV_DISABLE_HOT_RELOAD === '1'
    || env.BG_DEV_DISABLE_HOT_RELOAD === '1'
    || process.env.BG_DEV_DISABLE_HMR === '1'
    || env.BG_DEV_DISABLE_HMR === '1'
    || /^(off|false|0)$/i.test(
      process.env.BG_DEV_HOT_RELOAD?.trim()
        || env.BG_DEV_HOT_RELOAD?.trim()
        || '',
    )
  const disableViteHmr = disableViteWatch
  const cliPort = Number(readCliFlag('port'))
  const cliHost = readCliFlag('host')
  const devPort = Number.isFinite(cliPort) && cliPort > 0
    ? cliPort
    : Number(env.VITE_DEV_PORT) || 4273
  const serverHost = cliHost || '0.0.0.0'
  const hmrHost = cliHost && cliHost !== '0.0.0.0' ? cliHost : 'localhost'
  const gameServerPort = Number(env.GAME_SERVER_PORT) || 18000
  const apiServerPort = Number(env.API_SERVER_PORT) || 18001
  const suppressE2EProxyNoise = env.E2E_PROXY_QUIET === 'true'
  const useStableE2EOptimizeDeps = forceInlineVite || suppressE2EProxyNoise
  const useStableOptimizeDeps = mode === 'development' || useStableE2EOptimizeDeps
  const devApiDisabled = isTruthyFlag(env.VITE_DEV_SKIP_API || process.env.VITE_DEV_SKIP_API)
  const backendUrl = mode === 'android'
    ? resolveAndroidBackendUrl(publicBackendEnv)
    : (publicBackendEnv.VITE_BACKEND_URL || '')
  if (mode === 'android') {
    env.VITE_BACKEND_URL = backendUrl
    process.env.VITE_BACKEND_URL = backendUrl
  }
  const shouldEnforcePublicBackendSingleSource = mode === 'android'
    || mode === 'production'
    || env.BG_ENFORCE_PUBLIC_BACKEND_SINGLE_SOURCE === '1'
    || process.env.BG_ENFORCE_PUBLIC_BACKEND_SINGLE_SOURCE === '1'
  if (shouldEnforcePublicBackendSingleSource) {
    assertNoPublicBackendSplit(publicBackendEnv, backendUrl)
  }
  const viteCacheDir = resolveViteCacheDir(devPort)

  const isIgnorableProxyError = (err: Error & NodeJS.ErrnoException) => {
    if (err.code === 'ECONNABORTED') return true
    if (!suppressE2EProxyNoise) return false
    return err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'EPIPE'
  }

  const isIgnorableViteProxyLog = (msg: string) => {
    const isWsProxyLog = msg.includes('ws proxy error') || msg.includes('ws proxy socket error')
    if (!isWsProxyLog) return false
    if (msg.includes('ECONNABORTED')) return true
    if (!suppressE2EProxyNoise) return false
    return msg.includes('ECONNREFUSED') || msg.includes('ECONNRESET') || msg.includes('EPIPE')
  }

  const logProxyError = (label: string, err: Error & NodeJS.ErrnoException) => {
    if (isIgnorableProxyError(err)) return
    console.error(`[proxy ${label}]`, err.message)
  }

  return {
    cacheDir: viteCacheDir,
    define: {
      'globalThis.__APP_VERSION__': JSON.stringify(appVersion),
      'globalThis.__APP_COMMIT_SHA__': JSON.stringify(appCommitSha),
      'globalThis.__APP_BUILD_TIME__': JSON.stringify(appBuildTime),
      'globalThis.__APP_RELEASE_CHANNEL__': JSON.stringify(appReleaseChannel),
    },
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
        name: 'suppress-ignorable-proxy-noise',
        enforce: 'pre' as const,
        configResolved(config) {
          const originalError = config.logger.error
          config.logger.error = (msg, options) => {
            if (typeof msg === 'string' && isIgnorableViteProxyLog(msg)) return
            originalError(msg, options)
          }
        },
      },
      createDevApiDisabledPlugin(devApiDisabled),
      ...(forceInlineVite ? [] : [react()]),
      createInlineTypeScriptFallbackPlugin(forceInlineVite),
      localeHashPlugin(),
      assetHashPlugin(),
      publicFileHashPlugin(),
      readyCheckPlugin(),
      createQidahenRegionMaskDevtoolsPlugin(),
      createAndroidBuildMetaPlugin(mode, backendUrl, env.VITE_HOME_V2_DRAFT === '1', env),
      createIosBuildMetaPlugin(mode, backendUrl, env),
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
      alias: [
        // Current local install of three-stdlib 2.36.1 is missing many ESM .js leaf files,
        // while the CommonJS entry remains完整. Pin dev resolution to index.cjs so Vite
        // prebundle does not crash on missing ./loaders/*.js during isolated E2E startup.
        { find: 'three-stdlib', replacement: path.resolve(configDir, '../node_modules/three-stdlib/index.cjs') },
        { find: '@', replacement: path.resolve(configDir, './src') },
        { find: '@locales', replacement: path.resolve(configDir, './public/locales') },
        { find: 'void-elements', replacement: path.resolve(configDir, './src/vendor/void-elements.ts') },
      ],
    },
    optimizeDeps: {
      ...(useStableOptimizeDeps
        ? {
            // 入口模块图过宽时，自动发现会在空缓存首次访问中扫描整个 src。
            // 开发与 E2E 共用同一份关键 CJS 依赖清单，避免两种运行模式各自漂移。
            noDiscovery: true,
            include: STABLE_OPTIMIZE_DEPS,
            // 依赖已完全显式列出，无需等静态导入爬取结束才返回首批优化结果。
            holdUntilCrawlEnd: false,
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
      hmr: disableViteHmr
        ? false
        : {
            protocol: 'ws',
            host: hmrHost,
            port: devPort,
            clientPort: devPort,
          },
      // 稳定测试模式不依赖热更新；禁用监听可避免 AI/脚本并发改工作区时触发刷新。
      watch: disableViteWatch
        ? null
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
              '**/.worktrees/**',
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
          bypass: (req) => {
            const pathname = (req.url || '/').split('?')[0] || '/'
            if ((req.method === 'GET' || req.method === 'HEAD')
              && isConfigReviewSpaRoute(pathname)) {
              return '/index.html'
            }
          },
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
        '/admin-api': {
          target: `http://127.0.0.1:${apiServerPort}`,
          changeOrigin: true,
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
