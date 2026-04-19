import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ESLint } from 'eslint';
import { acquireGlobalHeavyBudget } from './global-heavy-budget.mjs';
import { acquireTaskGuard } from './heavy-task-guard.mjs';
import { runAssetPipelineGuard } from './asset-pipeline-guard.mjs';
import { runDicethroneDiceAtlasGuard } from './dicethrone-dice-atlas-guard.mjs';
import { runAtlasContractGuard } from './atlas-contract-guard.mjs';

const repoRoot = process.cwd();
const modeInput = (process.argv[2] || process.env.QUALITY_GATE_MODE || 'local').trim().toLowerCase();
const mode = modeInput === 'prepush'
  ? 'pre-push'
  : (modeInput === 'precommit' ? 'pre-commit' : modeInput);
const isPrePushMode = mode === 'pre-push';
const isPreCommitMode = mode === 'pre-commit';
const targetHeadRef = (process.env.QUALITY_GATE_HEAD || 'HEAD').trim() || 'HEAD';
const CACHE_SCHEMA_VERSION = 2;

// pre-push changed test runs touch a large cross-section of suites and can emit
// huge log payloads. `threads` has been unstable on Windows here because worker
// result serialization can fail with DataCloneError / OOM before assertions do.
// `forks` is slower but materially more reliable for the local gate.
// 允许通过 QUALITY_GATE_VITEST_POOL / VITEST_POOL 覆盖默认 pool（仅支持 forks / threads）。
const vitestPoolOverrideRaw = (process.env.QUALITY_GATE_VITEST_POOL || process.env.VITEST_POOL || '').trim().toLowerCase();
const vitestPoolOverride = vitestPoolOverrideRaw === 'threads' || vitestPoolOverrideRaw === 'forks'
  ? vitestPoolOverrideRaw
  : '';
const vitestPool = vitestPoolOverride || 'forks';
const GAME_VITEST_ARGS = ['--config', 'vitest.config.core.ts', '--pool', vitestPool, '--no-file-parallelism', '--maxWorkers', '1'];
const FAST_VITEST_ARGS = ['--pool', vitestPool, '--no-file-parallelism', '--maxWorkers', '1'];
const KNOWN_GAME_IDS = new Set(['smashup', 'dicethrone', 'summonerwars', 'tictactoe', 'cardia']);
const PRE_PUSH_CORE_TARGET_GROUPS = [
  {
    label: 'Core tests (engine)',
    reason: '核心源码改动，回归 core/engine/shared/hooks/lib 完整测试集',
    targets: ['src/core', 'src/engine', 'src/shared', 'src/hooks', 'src/lib'],
  },
  {
    label: 'Core tests (ui)',
    reason: '核心源码改动，回归 components/pages 完整测试集',
    targets: ['src/components', 'src/pages'],
  },
];
const ESLINT_WARNING_DELTA_IGNORE_PATTERNS = [
  /^e2e\//,
  /(^|\/)__tests__\//,
];
const VITEST_SAFE_ENTRY = ['scripts/infra/vitest-cli-safe.mjs'];
const VITEST_SHARDED_TARGETS = new Map([
  [
    'src/components/lobby/__tests__/GameDetailsModalJoinConfirm.test.ts',
    [
      {
        label: '基础 helper',
        reason: '按 describe 分片执行以规避 Windows 下的大文件 Vitest OOM',
        testNamePattern: 'GameDetailsModal join confirm helpers|AI seat controller helpers|AiSupportPills',
      },
      {
        label: '下载卡片',
        reason: '按 describe 分片执行以规避 Windows 下的大文件 Vitest OOM',
        testNamePattern: 'GameDetailsMobilePackageCard',
      },
      {
        label: '详情与入房-基础',
        reason: '按 describe 分片执行以规避 Windows 下的大文件 Vitest OOM',
        testNamePattern: 'GameDetailsModal create room ai entry.*(创建房间弹窗内直接配置 AI，不再显示独立对战 AI 入口|加入房间时直接让服务端分配席位，不再先 getMatch 猜空位|未保存过 AI 偏好时，创建房间弹窗默认传入空偏好)',
      },
      {
        label: '详情与入房-下载入口',
        reason: '按 describe 分片执行以规避 Windows 下的大文件 Vitest OOM',
        testNamePattern: 'GameDetailsModal create room ai entry.*(package-managed 游戏默认只渲染悬浮下载按钮|点击悬浮下载按钮后展开卡片，并可再次收起|打开详情后会预取远端素材包大小，并显示在下载卡片上|网页版不渲染 package-managed 下载入口|相同 package 状态快照在重挂载后只记录一次日志)',
      },
      {
        label: '详情与入房-安装恢复',
        reason: '按 describe 分片执行以规避 Windows 下的大文件 Vitest OOM',
        testNamePattern: 'GameDetailsModal create room ai entry.*(未下载 package-managed 游戏时，创建房间仍走普通网页流程|模拟安装成功后关闭确认弹窗，不回退到确认下载|确认下载进行中时重复点击只触发一次 re-resolve|冷启动读到陈旧 queued 持久化状态时，回退为可重试失败态|冷启动读到原生 downloading 但任务已不存在时，回退为可重试失败态|原生安装器创建卡住时，3 秒内失败而不是无限停留 queued|下载完成后，package-managed 游戏允许创建房间)',
      },
      {
        label: '详情与入房-状态展示',
        reason: '按 describe 分片执行以规避 Windows 下的大文件 Vitest OOM',
        testNamePattern: 'GameDetailsModal create room ai entry.*(已下载 package-managed 游戏时，不再展开安装卡片，只在标题右侧显示绿色版本号|已安装状态缺少版本号时，回退显示下载入口而不是已完成角标|已安装状态为 mock-installed 时，回退显示下载入口而不是误判为已安装|已安装状态为 mock-installed 时，会自动把本地状态归一化回未安装|已安装状态缺少版本号时，创建房间仍走普通网页流程|已安装状态缺少版本号时，点击下载安装仍保持确认弹窗并按未安装态处理|失败状态默认收起为重试按钮，不自动展开下载详情|标记必须更新时，默认渲染悬浮提示按钮，展开后显示更新卡片|未下载 package-managed 游戏时，教程入口直接进入网页流程|标记必须更新时，创建房间仍走普通网页流程)',
      },
      {
        label: '详情与入房-大厅行为',
        reason: '按 describe 分片执行以规避 Windows 下的大文件 Vitest OOM',
        testNamePattern: 'GameDetailsModal create room ai entry.*(观战前发现房间 404 时不再跳进对局页，并提示房间已销毁|builtin 游戏不渲染移动端包管理入口|创建房间时显示进入对局 loading|socket 瞬时错误恢复后不再立刻弹服务不可用提示)',
      },
      {
        label: '本地会话与房间列表',
        reason: '按 describe 分片执行以规避 Windows 下的大文件 Vitest OOM',
        testNamePattern: 'localSession helpers|RoomList lobby loading state',
      },
    ],
  ],
]);

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });
const TEXT_LIKE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.md', '.css', '.scss', '.html',
  '.yml', '.yaml', '.xml', '.gradle', '.properties',
  '.java', '.kt', '.ps1', '.bat', '.txt',
]);
const CACHE_DIR = path.join(repoRoot, 'temp', 'quality-gate-cache');
const PRE_PUSH_CACHE_FILE = path.join(CACHE_DIR, 'pre-push.json');
const COMMAND_CACHE_FILE = path.join(CACHE_DIR, 'command-results.json');
const QUALITY_GATE_TYPECHECK_BUILD_INFO = path.join('temp', 'quality-gate-cache', 'typecheck.tsbuildinfo');
const STABLE_VITEST_NODE_OPTIONS = '--max-old-space-size=8192';
const STABLE_ESLINT_NODE_OPTIONS = '--max-old-space-size=4096';
const ESLINT_CHUNK_LIMIT = 2;
const CORE_VITEST_TARGETS = ['src/core', 'src/components', 'src/hooks', 'src/lib', 'src/shared', 'src/engine', 'src/pages'];

function runGit(args, options = {}) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    }).trim();
  } catch (error) {
    if (options.allowFailure) return '';
    throw error;
  }
}

function readGitFile(ref, file) {
  return runGit(['show', `${ref}:${file}`], { allowFailure: true });
}

function getMergeCommitParents(commit) {
  const parents = runGit(['show', '-s', '--format=%P', commit], { allowFailure: true })
    .split(/\s+/)
    .filter(Boolean);
  return parents.length === 2 ? parents : null;
}

function getIntersectingChangedFiles(parentA, parentB, commit) {
  const changedA = new Set(
    runGit(['diff', '--name-only', parentA, commit], { allowFailure: true })
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const changedB = new Set(
    runGit(['diff', '--name-only', parentB, commit], { allowFailure: true })
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean),
  );
  return [...changedA].filter((file) => changedB.has(file)).sort();
}

function getMergeCommitsInRange(baseRef, headRef) {
  if (!baseRef || !headRef) return [];
  const range = `${baseRef}..${headRef}`;
  const output = runGit(['rev-list', '--merges', range], { allowFailure: true });
  if (!output) return [];
  return output.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
}

function hasMergeConflictEvidence(commit) {
  const changedFiles = runGit(['show', '--pretty=format:', '--name-only', '--no-renames', commit], { allowFailure: true })
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  return changedFiles.some((file) => file.startsWith('evidence/merge-conflict-') && file.endsWith('.md'));
}

function runMergeAuditStrict(commit) {
  const result = spawnSync(process.execPath, ['scripts/verify/merge-conflict-audit.mjs', commit, '--fail-on-single-side'], {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) {
    console.error(`[changed-quality-gate] merge:audit 启动失败: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runMergeConflictGuards({ baseRef, headRef }) {
  if (isPreCommitMode) return;
  const mergeCommits = getMergeCommitsInRange(baseRef, headRef);
  if (mergeCommits.length === 0) return;

  console.log('\n[changed-quality-gate] Merge conflict guard');
  console.log(`[changed-quality-gate] merge commits: ${mergeCommits.length}`);

  for (const commit of mergeCommits) {
    console.log(`[changed-quality-gate] 审计 merge commit: ${commit}`);
    runMergeAuditStrict(commit);

    const parents = getMergeCommitParents(commit);
    if (!parents) continue;
    const intersecting = getIntersectingChangedFiles(parents[0], parents[1], commit);
    if (intersecting.length === 0) {
      console.log('[changed-quality-gate] 未检测到双方同时改动文件，跳过冲突汇报强制。');
      continue;
    }

    if (!hasMergeConflictEvidence(commit)) {
      console.error(`[changed-quality-gate] merge commit ${commit} 缺少 evidence/merge-conflict-*.md 冲突汇报。`);
      console.error('[changed-quality-gate] 请补充冲突汇报文档并重新提交。');
      process.exit(1);
    }
  }
}

function normalizeFile(file) {
  return file.replace(/\\/g, '/').replace(/^\.?\//, '');
}

function hasAny(files, predicate) {
  return files.some(predicate);
}

function dedupeValues(values) {
  return [...new Set(values)];
}

function chunkValues(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function fileExistsInWorkspace(file) {
  return existsSync(path.resolve(repoRoot, file));
}

function splitFilesForCommand(baseArgs, files, maxCommandLength = 7000) {
  if (files.length === 0) return [];

  const chunks = [];
  let currentChunk = [];
  let currentLength = commandToLine('npx', [...baseArgs]).length;

  for (const file of files) {
    const nextLength = currentLength + 1 + quoteArg(file).length;
    if (currentChunk.length > 0 && nextLength > maxCommandLength) {
      chunks.push(currentChunk);
      currentChunk = [file];
      currentLength = commandToLine('npx', [...baseArgs, file]).length;
      continue;
    }
    currentChunk.push(file);
    currentLength = nextLength;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function isSourceCodeFile(file) {
  return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file);
}

function isTsFamilyFile(file) {
  return /\.(ts|tsx|mts|cts)$/.test(file);
}

function isTestFile(file) {
  return /(^|\/)__tests__\//.test(file) || /\.(test|spec)\.[^/]+$/.test(file);
}

function isRunnableVitestTestFile(file) {
  if (!isTestFile(file)) return false;
  return !/(\.property\.test\.|audit.*\.test\.|Audit.*\.test\.|debug.*\.test\.|Debug.*\.test\.)/.test(file);
}

function ensurePassWithNoTests(vitestArgs) {
  return vitestArgs.includes('--passWithNoTests')
    ? vitestArgs
    : [...vitestArgs, '--passWithNoTests'];
}

function resolveRunnableVitestWorkspaceTarget(file) {
  const normalized = normalizeFile(file);
  const candidates = normalized.startsWith('e2e/src/')
    ? [normalized.slice('e2e/'.length), normalized]
    : [normalized];

  for (const candidate of candidates) {
    if (candidate.startsWith('e2e/src/')) continue;
    if (!isRunnableVitestTestFile(candidate)) continue;
    if (fileExistsInWorkspace(candidate)) return candidate;
  }

  return null;
}

function collectRunnableVitestWorkspaceTargets(files) {
  return dedupeValues(
    files
      .map((file) => resolveRunnableVitestWorkspaceTarget(file))
      .filter(Boolean),
  );
}

function isDocOnly(file) {
  return file.endsWith('.md') || file.startsWith('evidence/');
}

function isLintTarget(file) {
  return isSourceCodeFile(file)
    && !file.startsWith('temp/')
    && !file.startsWith('dist/')
    && !file.startsWith('test-results/');
}

function isLintWarningDeltaIgnored(file) {
  return ESLINT_WARNING_DELTA_IGNORE_PATTERNS.some((pattern) => pattern.test(file));
}

function isEncodingTarget(file) {
  return TEXT_LIKE_EXTENSIONS.has(path.extname(file).toLowerCase())
    || file === 'AGENTS.md'
    || file === 'package.json'
    || file.startsWith('.github/');
}

function hasUtf8Bom(buffer) {
  return buffer.length >= 3
    && buffer[0] === UTF8_BOM[0]
    && buffer[1] === UTF8_BOM[1]
    && buffer[2] === UTF8_BOM[2];
}

function runEncodingGuard(files) {
  const targets = files.filter(isEncodingTarget);
  if (targets.length === 0) return;

  const failures = [];
  for (const file of targets) {
    const absolutePath = path.resolve(repoRoot, file);
    if (!existsSync(absolutePath)) continue;
    const buffer = readFileSync(absolutePath);

    if (hasUtf8Bom(buffer)) {
      failures.push(`${file}: contains UTF-8 BOM`);
      continue;
    }
    try {
      UTF8_DECODER.decode(buffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${file}: invalid UTF-8 (${message})`);
    }
  }

  console.log('\n[changed-quality-gate] Encoding');
  console.log(`[changed-quality-gate] checked files: ${targets.length}`);
  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`[changed-quality-gate] ${failure}`);
    }
    process.exit(1);
  }
}

function resolveRemoteSameBranchBase() {
  const currentBranch = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], { allowFailure: true });
  if (!currentBranch || currentBranch === 'HEAD') return '';

  // 优先使用已存在的远端跟踪分支（无需额外网络请求）
  const trackingRef = `refs/remotes/origin/${currentBranch}`;
  const tracked = runGit(['rev-parse', '--verify', trackingRef], { allowFailure: true });
  if (tracked) return trackingRef;

  // 兼容 remote.fetch 仅拉 main 的仓库：直接查询远端同名分支提交
  const remoteHead = runGit(['ls-remote', '--heads', 'origin', currentBranch], { allowFailure: true });
  if (!remoteHead) return '';

  const firstLine = remoteHead.split(/\r?\n/).find(Boolean) || '';
  const [sha] = firstLine.trim().split(/\s+/);
  return sha || '';
}

function resolveBaseRef() {
  const envBase = process.env.QUALITY_GATE_BASE?.trim();
  if (envBase) return envBase;

  const upstream = runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], { allowFailure: true });
  if (upstream) return upstream;

  const sameBranchRemote = resolveRemoteSameBranchBase();
  if (sameBranchRemote) return sameBranchRemote;

  for (const candidate of ['origin/main', 'origin/master', 'main', 'master', 'HEAD~1']) {
    const exists = runGit(['rev-parse', '--verify', candidate], { allowFailure: true });
    if (exists) return candidate;
  }

  throw new Error('[changed-quality-gate] 无法解析对比基线');
}

function resolveTargetHeadRef() {
  const resolved = runGit(['rev-parse', '--verify', targetHeadRef], { allowFailure: true });
  if (resolved) return resolved;
  throw new Error(`[changed-quality-gate] 无法解析目标提交: ${targetHeadRef}`);
}

function resolveChangeContext() {
  if (isPreCommitMode) {
    const headSha = runGit(['rev-parse', '--verify', 'HEAD'], { allowFailure: true }) || 'HEAD';
    const output = runGit(['diff', '--name-status', '--find-renames', '--diff-filter=ACMR', '--cached'], { allowFailure: true });
    const { files, baselinePathByFile } = parseDiffNameStatus(output);
    return {
      baseRef: 'HEAD',
      mergeBase: 'HEAD',
      headSha,
      targetHeadRef: headSha,
      aheadCount: 0,
      effectiveBaseRef: 'HEAD',
      effectiveScopeLabel: 'INDEX',
      files,
      baselinePathByFile,
    };
  }

  const resolvedTargetHead = resolveTargetHeadRef();
  const baseRef = resolveBaseRef();
  const mergeBase = runGit(['merge-base', resolvedTargetHead, baseRef], { allowFailure: true }) || baseRef;
  const headSha = resolvedTargetHead;
  const aheadCountRaw = runGit(['rev-list', '--count', `${baseRef}..${resolvedTargetHead}`], { allowFailure: true });
  const aheadCount = Number.parseInt(aheadCountRaw, 10);
  const previousHead = isPrePushMode && Number.isFinite(aheadCount) && aheadCount > 1
    ? runGit(['rev-parse', `${resolvedTargetHead}^`], { allowFailure: true })
    : '';
  const effectiveBaseRef = previousHead || baseRef;
  const effectiveScopeLabel = `${effectiveBaseRef}...${resolvedTargetHead}`;
  const output = runGit(['diff', '--name-status', '--find-renames', '--diff-filter=ACMR', effectiveScopeLabel], { allowFailure: true });
  const { files, baselinePathByFile } = parseDiffNameStatus(output);

  return {
    baseRef,
    mergeBase,
    headSha,
    targetHeadRef: resolvedTargetHead,
    aheadCount: Number.isFinite(aheadCount) ? aheadCount : 0,
    effectiveBaseRef,
    effectiveScopeLabel,
    files,
    baselinePathByFile,
  };
}

function parseDiffNameStatus(output) {
  const files = [];
  const baselinePathByFile = {};

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const parts = line.split('\t');
    const status = parts[0] ?? '';
    if ((status.startsWith('R') || status.startsWith('C')) && parts.length >= 3) {
      const previousPath = normalizeFile(parts[1]);
      const nextPath = normalizeFile(parts[2]);
      if (!nextPath) continue;
      files.push(nextPath);
      if (previousPath) {
        baselinePathByFile[nextPath] = previousPath;
      }
      continue;
    }

    const nextPath = normalizeFile(parts[1] ?? '');
    if (!nextPath) continue;
    files.push(nextPath);
    if (!status.startsWith('A')) {
      baselinePathByFile[nextPath] = nextPath;
    }
  }

  return {
    files: dedupeValues(files),
    baselinePathByFile,
  };
}

function resolvePrePushLintContext() {
  if (!isPrePushMode) {
    return {
      files: [],
      baselinePathByFile: {},
      scopeLabel: '',
    };
  }
  return {
    files,
    baselinePathByFile,
    scopeLabel: effectiveScopeLabel,
  };
}

function buildPackageJsonTypecheckFingerprint(content) {
  if (!content) return '__missing__';
  try {
    const parsed = JSON.parse(content);
    const relevant = {
      type: parsed.type,
      packageManager: parsed.packageManager,
      engines: parsed.engines,
      dependencies: parsed.dependencies,
      devDependencies: parsed.devDependencies,
      peerDependencies: parsed.peerDependencies,
      optionalDependencies: parsed.optionalDependencies,
      overrides: parsed.overrides,
      resolutions: parsed.resolutions,
    };
    return JSON.stringify(relevant);
  } catch {
    return '__parse_error__';
  }
}

function packageJsonAffectsTypecheck(baseRef, headSha) {
  const baseFingerprint = buildPackageJsonTypecheckFingerprint(readGitFile(baseRef, 'package.json'));
  const headFingerprint = buildPackageJsonTypecheckFingerprint(readGitFile(headSha, 'package.json'));
  return baseFingerprint !== headFingerprint;
}

function createTypecheckPredicate(baseRef, headSha) {
  const packageJsonRelevant = packageJsonAffectsTypecheck(baseRef, headSha);
  return (file) => {
    if (file === 'package.json') return packageJsonRelevant;
    if (file.startsWith('tsconfig') || file === 'vite.config.ts' || file === 'eslint.config.js') return true;
    return isTsFamilyFile(file) && !isDocOnly(file);
  };
}

function affectsBuild(file) {
  if (file === 'index.html' || file === 'package.json' || file === 'vite.config.ts' || file === 'postcss.config.js' || file === 'tailwind.config.js') return true;
  return file.startsWith('src/')
    || file.startsWith('public/')
    || file.startsWith('apps/')
    || file === 'server.ts'
    || file.startsWith('scripts/game/')
    || file.startsWith('scripts/audio/');
}

function affectsDiceThroneStyleContract(file) {
  return file === 'src/index.css'
    || file === 'vite.config.ts'
    || file === 'postcss.config.js'
    || file === 'postcss-tailwind-legacy-structure.js'
    || file === 'postcss-tailwind-legacy-colors.js'
    || file === 'postcss-tailwind-legacy-translate.js'
    || file === 'package.json'
    || file === 'playwright.config.ts'
    || file.startsWith('src/games/dicethrone/ui/')
    || file === 'src/components/game/framework/presets.tsx'
    || file === 'scripts/games/dicethrone/verify/dicethrone-style-contract.mjs'
    || file === 'e2e/dicethrone/dicethrone-simple-start.e2e.ts';
}

function affectsI18n(file) {
  return file.startsWith('src/')
    || file.startsWith('apps/api/')
    || file.startsWith('public/locales/')
    || file === 'scripts/verify/i18n-check.ts';
}

function affectsCoreArea(file) {
  return file.startsWith('src/core/')
    || file.startsWith('src/engine/')
    || file.startsWith('src/shared/')
    || file.startsWith('src/hooks/')
    || file.startsWith('src/components/game/')
    || file.startsWith('src/pages/')
    || file.startsWith('src/lib/')
    || file.startsWith('src/server/')
    || file.startsWith('src/api/')
    || file.startsWith('vite-plugins/')
    || file === 'vitest.config.core.ts'
    || file === 'vitest.config.ts';
}

function isGameFile(file) {
  return file.startsWith('src/games/') || file.startsWith('e2e/src/games/');
}

function isGameSourceFile(file) {
  return isGameFile(file) && !isTestFile(file);
}

function isCoreSourceFile(file) {
  return affectsCoreArea(file) && !isTestFile(file);
}

function affectsPrePushGlobalVitest(file) {
  if (isTestFile(file)) return false;
  if (file.startsWith('src/lib/i18n/')) return false;
  return file.startsWith('src/core/')
    || file.startsWith('src/engine/')
    || file.startsWith('src/shared/')
    || file.startsWith('src/hooks/')
    || file.startsWith('src/components/game/')
    || file.startsWith('src/lib/')
    || file === 'vitest.config.core.ts'
    || file === 'vitest.config.ts';
}

function isNonGameTestFile(file) {
  return isTestFile(file) && !isGameFile(file);
}

function collectGameIds(files, { sourceOnly = false } = {}) {
  const ids = new Set();
  for (const file of files) {
    if (sourceOnly && !isGameSourceFile(file)) continue;
    const match = file.match(/^(?:src|e2e\/src)\/games\/([^/]+)\//);
    if (match && KNOWN_GAME_IDS.has(match[1])) ids.add(match[1]);
  }
  return [...ids];
}

function hasChangesForTargetGroup(files, targets) {
  return hasAny(files, (file) => targets.some((target) => file.startsWith(`${target}/`) || file === target));
}

function collectTrackedTestCoverage(targets) {
  const output = runGit(['ls-files', '--', ...targets], { allowFailure: true });
  const testFiles = output
    .split(/\r?\n/)
    .map(normalizeFile)
    .filter((file) => isTestFile(file));

  const coveredScopes = new Set(testFiles);
  for (const file of testFiles) {
    let current = path.posix.dirname(file);
    while (current && current !== '.' && current !== path.posix.dirname(current)) {
      coveredScopes.add(current);
      current = path.posix.dirname(current);
    }
  }

  return { testFiles, coveredScopes };
}

function resolveScopedVitestTarget(file, targets, coverage) {
  if (isTestFile(file)) return file;

  let current = path.posix.dirname(file);
  while (current && current !== '.' && current !== path.posix.dirname(current)) {
    if (coverage.coveredScopes.has(current)) return current;
    current = path.posix.dirname(current);
  }

  return targets.find((target) => coverage.coveredScopes.has(target) && (file.startsWith(`${target}/`) || file === target)) || null;
}

function expandVitestTargetsToTestFiles(targets, coverage) {
  return dedupeValues(targets.flatMap((target) => {
    if (isTestFile(target)) return isRunnableVitestTestFile(target) ? [target] : [];
    return coverage.testFiles.filter((file) => isRunnableVitestTestFile(file) && (file === target || file.startsWith(`${target}/`)));
  }));
}

function collectScopedVitestTargets(files, targets) {
  const coverage = collectTrackedTestCoverage(targets);
  const scopedTargets = dedupeValues(
    files
      .filter((file) => targets.some((target) => file.startsWith(`${target}/`) || file === target))
      .map((file) => resolveScopedVitestTarget(file, targets, coverage))
      .filter(Boolean),
  );
  return expandVitestTargetsToTestFiles(scopedTargets, coverage).filter(fileExistsInWorkspace);
}

function createVitestCommands({ label, reason, target, vitestArgs }) {
  const shards = VITEST_SHARDED_TARGETS.get(target);
  // Vitest 会在 “No test files found” 时以 exit code 1 退出。
  // 我们的增量门禁会按目录拆分执行（例如 src/shared），而该目录可能没有独立测试文件；
  // 这不应阻塞提交/门禁，因此统一开启 passWithNoTests。
  const safeVitestArgs = ensurePassWithNoTests(vitestArgs);
  if (!shards || shards.length === 0) {
    return [{
      label,
      reason,
      command: process.execPath,
      args: [...VITEST_SAFE_ENTRY, 'run', target, ...safeVitestArgs],
    }];
  }

  return shards.map((shard, index) => ({
    label: `${label} - ${shard.label} (${index + 1}/${shards.length})`,
    reason: `${reason}；${shard.reason}（限定到 ${target} / ${shard.label}）`,
    command: process.execPath,
    args: [...VITEST_SAFE_ENTRY, 'run', target, ...safeVitestArgs, '-t', shard.testNamePattern],
  }));
}

function collectCommands(files, baseRef, affectsTypecheck) {
  const commands = [];
  const lintCandidateFiles = isPrePushMode
    ? prePushLintFiles.filter(isLintTarget)
    : files.filter(isLintTarget);
  const lintWarningDeltaFiles = isPrePushMode
    ? lintCandidateFiles.filter((file) => !isLintWarningDeltaIgnored(file))
    : lintCandidateFiles;
  const lintFiles = lintCandidateFiles.filter(fileExistsInWorkspace);
  const coreSourceChanged = hasAny(
    files,
    isPrePushMode ? affectsPrePushGlobalVitest : isCoreSourceFile,
  );
  const coreTestFiles = collectRunnableVitestWorkspaceTargets(
    files.filter((file) => isNonGameTestFile(file)),
  );
  const gameSourceIds = collectGameIds(files, { sourceOnly: true });
  const gameTestFiles = collectRunnableVitestWorkspaceTargets(
    files.filter((file) => isGameFile(file) && isTestFile(file)),
  );

  if (hasAny(files, affectsTypecheck)) {
    commands.push({
      label: 'Typecheck',
      reason: '存在 TypeScript 或配置改动',
      command: 'npx',
      args: ['tsc', '--noEmit', '--incremental', '--tsBuildInfoFile', QUALITY_GATE_TYPECHECK_BUILD_INFO],
    });
  }

  if (isPrePushMode && lintWarningDeltaFiles.length > 0) {
    commands.push({
      label: 'ESLint warning delta',
      reason: 'pre-push 模式下仅阻止新增 warning，同时继续阻止当前 errors（忽略 e2e 与 __tests__ 的 warning 计数）',
      command: 'internal:eslint-warning-delta',
      args: lintWarningDeltaFiles,
    });
  } else if (isPrePushMode && lintCandidateFiles.length > 0 && lintWarningDeltaFiles.length === 0) {
    console.log('[changed-quality-gate] pre-push lint warning 计数：所有 lint 目标均被忽略（e2e 或 __tests__），跳过 warning delta。');
  } else if (lintFiles.length > 0) {
    const eslintBaseArgs = ['eslint', '--max-warnings', '999'];
    // Windows 下 eslint 一次性 lint 过多文件时容易 OOM（尤其是同时包含 src + e2e 的大批次）。
    // 这里在“命令行长度切分”的基础上，再按固定数量切分，降低单次 eslint 负载。
    const lintChunks = splitFilesForCommand(eslintBaseArgs, lintFiles, 6000)
      .flatMap((chunk) => chunkValues(chunk, ESLINT_CHUNK_LIMIT));
    lintChunks.forEach((chunk, index) => {
      commands.push({
        label: lintChunks.length === 1 ? 'ESLint' : `ESLint (${index + 1}/${lintChunks.length})`,
        reason: lintChunks.length === 1
          ? '存在可 lint 的源码改动'
          : '存在可 lint 的源码改动，按批次切分以避免 Windows 命令行过长',
        command: 'npx',
        args: [...eslintBaseArgs, ...chunk],
      });
    });
  }

  if (hasAny(files, affectsBuild) && !isPrePushMode) {
    const buildArgs = ['run', 'build'];
    // 本地 pre-commit 门禁只需要确保能成功构建并捕获编译/打包错误，
    // 不需要强制跑 esbuild minify（它在 Windows + 大 bundle 时更容易触发内存峰值导致 gate 失败）。
    // CI 会兜底 full build（含 minify），因此这里默认在 pre-commit 下关闭 minify 来提高稳定性。
    if (isPreCommitMode) {
      buildArgs.push('--', '--minify', 'false');
    }
    commands.push({
      label: 'Build',
      reason: 'local 模式下存在前端/构建输入改动',
      command: 'npm',
      args: buildArgs,
    });
    if (hasAny(files, affectsDiceThroneStyleContract)) {
      commands.push({
        label: 'DiceThrone style contract',
        reason: '涉及 DiceThrone HUD / Tailwind 兼容链改动，需验证构建产物关键样式合同',
        command: 'npm',
        args: ['run', 'verify:dicethrone:style-contract'],
      });
    }
  } else if (hasAny(files, affectsBuild) && isPrePushMode) {
    console.log('[changed-quality-gate] pre-push 模式：跳过 build，交给 CI 全量构建兜底。');
  }

  if (hasAny(files, affectsI18n)) {
    commands.push({
      label: 'i18n',
      reason: '存在 i18n 相关改动',
      command: 'npm',
      args: ['run', 'i18n:check'],
    });
  }

  if (hasAny(files, (file) => file.startsWith('apps/api/'))) {
    commands.push({
      label: 'API tests',
      reason: 'apps/api 有改动',
      command: 'npm',
      args: ['run', 'test:api'],
    });
  }

  if (hasAny(files, (file) => file.startsWith('src/server/') || file.startsWith('src/api/'))) {
    if (isPrePushMode) {
      const serverTargets = ['src/server', 'src/api'];
      serverTargets.forEach((target, index) => {
        commands.push({
          label: serverTargets.length === 1 ? 'Server tests' : `Server tests (${index + 1}/${serverTargets.length})`,
          reason: '服务端目录有改动，pre-push 拆分执行以降低 Vitest OOM 风险',
          command: process.execPath,
          args: [...VITEST_SAFE_ENTRY, 'run', target, '--configLoader', 'native', ...FAST_VITEST_ARGS],
        });
      });
    } else {
      commands.push({
        label: 'Server tests',
        reason: '服务端目录有改动',
        command: 'npm',
        args: ['run', 'test:server'],
      });
    }
  }

  if (hasAny(files, (file) => file.startsWith('src/ugc/'))) {
    commands.push({
      label: 'UGC tests',
      reason: 'UGC 目录有改动',
      command: 'npm',
      args: ['run', 'test:ugc'],
    });
  }

  if (isPrePushMode) {
    if (coreSourceChanged) {
      PRE_PUSH_CORE_TARGET_GROUPS
        .filter((group) => hasChangesForTargetGroup(files, group.targets))
        .forEach((group) => {
          const scopedTargets = collectScopedVitestTargets(files, group.targets);
          scopedTargets.forEach((target, index) => {
            const label = scopedTargets.length === 1 ? group.label : `${group.label} (${index + 1}/${scopedTargets.length})`;
            const reason = `${group.reason}（限定到 ${target}）`;
            commands.push(...createVitestCommands({
              label,
              reason,
              target,
              vitestArgs: FAST_VITEST_ARGS,
            }));
          });
        });

      const targetGameIds = gameSourceIds.length > 0
        ? gameSourceIds
        : [...KNOWN_GAME_IDS];

      targetGameIds.forEach((gameId) => {
        commands.push({
          label: `${gameId} tests`,
          reason: gameSourceIds.length > 0
            ? `${gameId} 源码改动，单独跑该游戏完整测试集`
            : '核心源码改动，需要逐游戏回归完整测试集',
          command: process.execPath,
          args: [...VITEST_SAFE_ENTRY, 'run', `src/games/${gameId}`, ...GAME_VITEST_ARGS],
        });
      });
    } else {
      if (coreTestFiles.length > 0) {
        commands.push({
          label: 'Changed core test files',
          reason: '仅改动核心测试文件，按文件精确运行',
          command: process.execPath,
          args: [...VITEST_SAFE_ENTRY, 'run', ...coreTestFiles, ...ensurePassWithNoTests(FAST_VITEST_ARGS)],
        });
      }
      if (gameSourceIds.length > 0) {
        if (isLatestCommitScopeMode) {
          console.log('[changed-quality-gate] pre-push 最新提交范围模式：游戏源码改动不再默认回归整游戏全量测试，避免历史红灯阻塞当前增量；请依赖本轮显式改动测试或 CI 全量回归。');
        } else {
          gameSourceIds.forEach((gameId) => {
            commands.push({
              label: `${gameId} tests`,
              reason: `${gameId} 源码改动，跑该游戏完整测试集`,
              command: process.execPath,
              args: [...VITEST_SAFE_ENTRY, 'run', `src/games/${gameId}`, ...GAME_VITEST_ARGS],
            });
          });
        }
      } else if (gameTestFiles.length > 0) {
        commands.push({
          label: 'Changed game test files',
          reason: '仅改动游戏测试文件，按文件精确运行',
          command: process.execPath,
          args: [...VITEST_SAFE_ENTRY, 'run', ...gameTestFiles, ...ensurePassWithNoTests(GAME_VITEST_ARGS)],
        });
      }
    }
  } else {
    if (hasAny(files, affectsCoreArea)) {
      const coreCoverage = collectTrackedTestCoverage(CORE_VITEST_TARGETS);
      const coreTargetsWithTests = CORE_VITEST_TARGETS.filter((target) => coreCoverage.coveredScopes.has(target));
      coreTargetsWithTests.forEach((target, index) => {
        const label = coreTargetsWithTests.length === 1 ? 'Core tests' : `Core tests (${index + 1}/${coreTargetsWithTests.length})`;
        commands.push(...createVitestCommands({
          label,
          reason: '核心框架/引擎区域改动，拆分执行以降低 Windows OOM 风险',
          target,
          vitestArgs: FAST_VITEST_ARGS,
        }));
      });
      commands.push({
        label: 'Games core tests',
        reason: '核心框架改动可能影响所有游戏',
        command: process.execPath,
        args: [...VITEST_SAFE_ENTRY, 'run', 'src/games', ...GAME_VITEST_ARGS],
      });
    } else {
      for (const gameId of collectGameIds(files)) {
        commands.push({
          label: `${gameId} tests`,
          reason: `${gameId} 目录有改动`,
          command: process.execPath,
          args: [...VITEST_SAFE_ENTRY, 'run', `src/games/${gameId}`, ...GAME_VITEST_ARGS],
        });
      }
    }
  }

  return dedupeCommands(commands);
}

function dedupeCommands(commands) {
  const seen = new Set();
  return commands.filter((item) => {
    const key = `${item.command} ${item.args.join(' ')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function createCommandCacheKey(context, command) {
  return createHash('sha256').update(JSON.stringify({
    schemaVersion: CACHE_SCHEMA_VERSION,
    mode,
    baseRef: context.baseRef,
    mergeBase: context.mergeBase,
    headSha: context.headSha,
    files: context.files,
    command: command.command,
    args: command.args,
  })).digest('hex');
}

function readCommandCache() {
  if (!existsSync(COMMAND_CACHE_FILE)) {
    return { version: CACHE_SCHEMA_VERSION, entries: {} };
  }
  try {
    const content = readFileSync(COMMAND_CACHE_FILE, 'utf8');
    const parsed = JSON.parse(content);
    if (parsed?.version !== CACHE_SCHEMA_VERSION || typeof parsed?.entries !== 'object' || parsed.entries === null) {
      return { version: CACHE_SCHEMA_VERSION, entries: {} };
    }
    return parsed;
  } catch {
    return { version: CACHE_SCHEMA_VERSION, entries: {} };
  }
}

function writeCommandCache(cache) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(COMMAND_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

function trimCommandCache(cache, maxEntries = 200) {
  const entries = Object.entries(cache.entries ?? {});
  if (entries.length <= maxEntries) return cache;

  entries.sort(([, left], [, right]) => {
    const leftAt = typeof left?.completedAt === 'string' ? Date.parse(left.completedAt) : 0;
    const rightAt = typeof right?.completedAt === 'string' ? Date.parse(right.completedAt) : 0;
    return rightAt - leftAt;
  });

  return {
    version: CACHE_SCHEMA_VERSION,
    entries: Object.fromEntries(entries.slice(0, maxEntries)),
  };
}

function quoteArg(value) {
  if (!/[\s"]/u.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

function commandToLine(command, args) {
  return [command, ...args].map(quoteArg).join(' ');
}

function mergeNodeOptions(extraOption, existingValue = process.env.NODE_OPTIONS) {
  const trimmedExtra = extraOption?.trim();
  const trimmedExisting = existingValue?.trim();
  if (!trimmedExtra) return trimmedExisting;
  if (!trimmedExisting) return trimmedExtra;
  return trimmedExisting.includes(trimmedExtra)
    ? trimmedExisting
    : `${trimmedExisting} ${trimmedExtra}`;
}

function createVitestEnv() {
  return {
    ...process.env,
    NODE_OPTIONS: mergeNodeOptions(STABLE_VITEST_NODE_OPTIONS),
  };
}

function createEslintEnv() {
  return {
    ...process.env,
    NODE_OPTIONS: mergeNodeOptions(STABLE_ESLINT_NODE_OPTIONS),
  };
}

function shouldUseStableVitestEnv(command, args) {
  if (command.includes('vitest-cli-safe') || args.includes('scripts/infra/vitest-cli-safe.mjs')) {
    return true;
  }

  return command.trim().toLowerCase() === 'npm'
    && args[0] === 'run'
    && typeof args[1] === 'string'
    && args[1].startsWith('test');
}

function shouldUseStableEslintEnv(command, args) {
  return command.trim().toLowerCase() === 'npx'
    && args[0] === 'eslint';
}

function shouldDirectSpawnOnWindows(command) {
  if (process.platform !== 'win32') return true;
  const normalized = command.trim().toLowerCase();
  return path.isAbsolute(command)
    || normalized.endsWith('.exe')
    || normalized.endsWith('.com');
}

function summarizeEslintResults(results) {
  return results.reduce((summary, result) => {
    summary.warningCount += result.warningCount ?? 0;
    summary.errorCount += result.errorCount ?? 0;
    summary.fatalErrorCount += result.fatalErrorCount ?? 0;
    return summary;
  }, {
    warningCount: 0,
    errorCount: 0,
    fatalErrorCount: 0,
  });
}

async function summarizeCurrentLint(filesToCheck) {
  const summary = {
    warningCount: 0,
    errorCount: 0,
    fatalErrorCount: 0,
  };
  const chunks = chunkValues(filesToCheck, 40);

  for (const chunk of chunks) {
    const eslint = new ESLint({
      cwd: repoRoot,
    });
    const results = await eslint.lintFiles(chunk);
    const chunkSummary = summarizeEslintResults(results);
    summary.warningCount += chunkSummary.warningCount;
    summary.errorCount += chunkSummary.errorCount;
    summary.fatalErrorCount += chunkSummary.fatalErrorCount;
    if (chunkSummary.errorCount > 0 || chunkSummary.fatalErrorCount > 0) {
      const formatter = await eslint.loadFormatter('stylish');
      const output = formatter.format(results).trim();
      if (output) {
        console.error(output);
      }
      process.exit(1);
    }
  }

  return summary;
}

async function summarizeBaselineLint(filesToCheck, baselineFileMap) {
  const summary = {
    warningCount: 0,
    errorCount: 0,
    fatalErrorCount: 0,
  };
  const eslint = new ESLint({
    cwd: repoRoot,
  });
  const queue = filesToCheck
    .map((file) => ({
      file,
      baselineFile: baselineFileMap[file] ?? '',
    }))
    .filter((item) => item.baselineFile);

  const concurrency = 12;
  for (let index = 0; index < queue.length; index += concurrency) {
    const slice = queue.slice(index, index + concurrency);
    const batchResults = await Promise.all(slice.map(async ({ baselineFile }) => {
      const baselineText = readGitFile(mergeBase, baselineFile);
      if (baselineText === '') {
        return [];
      }
      return eslint.lintText(baselineText, {
        filePath: path.resolve(repoRoot, baselineFile),
      });
    }));
    const batchSummary = summarizeEslintResults(batchResults.flat());
    summary.warningCount += batchSummary.warningCount;
    summary.errorCount += batchSummary.errorCount;
    summary.fatalErrorCount += batchSummary.fatalErrorCount;
  }

  return summary;
}

async function runEslintWarningDeltaCommand({ label, reason, args }) {
  console.log(`\n[changed-quality-gate] ${label}`);
  console.log(`[changed-quality-gate] 原因: ${reason}`);
  console.log(`[changed-quality-gate] lint 文件数: ${args.length}`);
  console.log(`[changed-quality-gate] lint 对比范围: ${prePushLintScopeLabel}`);

  const startAt = Date.now();
  const currentFiles = args.filter(fileExistsInWorkspace);
  const currentSummary = currentFiles.length > 0
    ? await summarizeCurrentLint(currentFiles)
    : { warningCount: 0, errorCount: 0, fatalErrorCount: 0 };
  const baselineSummary = await summarizeBaselineLint(args, prePushLintBaselinePathByFile);

  console.log(`[changed-quality-gate] ESLint warning baseline: ${baselineSummary.warningCount}`);
  console.log(`[changed-quality-gate] ESLint warning current: ${currentSummary.warningCount}`);

  if (currentSummary.warningCount > baselineSummary.warningCount) {
    const eslint = new ESLint({
      cwd: repoRoot,
    });
    const formatter = await eslint.loadFormatter('stylish');
    const currentResults = await eslint.lintFiles(currentFiles);
    const output = formatter.format(currentResults).trim();
    if (output) {
      console.error(output);
    }
    console.error(
      `[changed-quality-gate] 新增 ESLint warning：${currentSummary.warningCount - baselineSummary.warningCount} `
      + `(baseline=${baselineSummary.warningCount}, current=${currentSummary.warningCount})`,
    );
    process.exit(1);
  }

  console.log(
    `[changed-quality-gate] ESLint warning 未新增（baseline=${baselineSummary.warningCount}, current=${currentSummary.warningCount}）。`,
  );
  return Date.now() - startAt;
}

async function runCommand({ label, reason, command, args }) {
  if (command === 'internal:eslint-warning-delta') {
    return runEslintWarningDeltaCommand({ label, reason, args });
  }

  console.log(`\n[changed-quality-gate] ${label}`);
  console.log(`[changed-quality-gate] 原因: ${reason}`);
  console.log(`[changed-quality-gate] 命令: ${commandToLine(command, args)}`);

  const startAt = Date.now();
  const env = shouldUseStableVitestEnv(command, args)
    ? createVitestEnv()
    : (shouldUseStableEslintEnv(command, args) ? createEslintEnv() : process.env);
  const result = shouldDirectSpawnOnWindows(command)
    ? spawnSync(command, args, {
        cwd: repoRoot,
        stdio: 'inherit',
        shell: false,
        env,
      })
    : spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', commandToLine(command, args)], {
        cwd: repoRoot,
        stdio: 'inherit',
        shell: false,
        env,
      });
  const durationMs = Date.now() - startAt;

  if (result.error) {
    console.error(`[changed-quality-gate] 命令启动失败: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return durationMs;
}

function createCacheKey(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function readPrePushCache() {
  if (!existsSync(PRE_PUSH_CACHE_FILE)) return null;
  try {
    const content = readFileSync(PRE_PUSH_CACHE_FILE, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function writePrePushCache(cache) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(PRE_PUSH_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

function shouldUsePrePushCache() {
  return isPrePushMode && process.env.QUALITY_GATE_NO_CACHE !== '1';
}

const {
  baseRef,
  mergeBase,
  headSha,
  targetHeadRef: resolvedTargetHead,
  aheadCount,
  effectiveBaseRef,
  effectiveScopeLabel,
  files,
  baselinePathByFile,
} = resolveChangeContext();
const {
  files: prePushLintFiles,
  baselinePathByFile: prePushLintBaselinePathByFile,
  scopeLabel: prePushLintScopeLabel,
} = resolvePrePushLintContext();
const isLatestCommitScopeMode = isPrePushMode && effectiveBaseRef !== baseRef;
const affectsTypecheck = createTypecheckPredicate(effectiveBaseRef, headSha);
console.log(`[changed-quality-gate] 模式: ${mode}`);
console.log(`[changed-quality-gate] 基线: ${baseRef}`);
console.log(`[changed-quality-gate] merge-base: ${mergeBase}`);
console.log(`[changed-quality-gate] 目标提交: ${resolvedTargetHead}`);
console.log(`[changed-quality-gate] head: ${headSha}`);
if (isPrePushMode && aheadCount > 1 && effectiveBaseRef !== baseRef) {
  console.log(`[changed-quality-gate] pre-push 检测到当前分支领先 ${aheadCount} 个提交，当前仅校验最新提交范围: ${effectiveScopeLabel}`);
} else {
  console.log(`[changed-quality-gate] 当前校验范围: ${effectiveScopeLabel}`);
}

runMergeConflictGuards({
  baseRef: effectiveBaseRef,
  headRef: resolvedTargetHead,
});

if (files.length === 0) {
  console.log('[changed-quality-gate] 未检测到已提交改动，跳过。');
  process.exit(0);
}

console.log('[changed-quality-gate] 改动文件:');
for (const file of files) {
  console.log(`- ${file}`);
}

const taskGuard = acquireTaskGuard({
  name: 'quality-gate',
  conflicts: ['e2e-run'],
  command: process.argv.join(' '),
  metadata: {
    mode,
    baseRef,
    fileCount: files.length,
  },
});

try {
  const globalBudgetHandle = await acquireGlobalHeavyBudget({
    group: 'quality-gate',
    command: process.argv.join(' '),
    metadata: {
      mode,
      baseRef,
      fileCount: files.length,
    },
  });

  try {
  mkdirSync(CACHE_DIR, { recursive: true });
  runEncodingGuard(files);
  runAssetPipelineGuard(files);
  runAtlasContractGuard(files, { repoRoot });
  runDicethroneDiceAtlasGuard(files, { repoRoot, mode });

  const commands = collectCommands(files, baseRef, affectsTypecheck);
  if (commands.length === 0) {
    console.log('[changed-quality-gate] 当前改动仅涉及文档/证据，跳过代码校验。');
    process.exit(0);
  }

  const cachePayload = {
    schemaVersion: CACHE_SCHEMA_VERSION,
    mode,
    baseRef,
    mergeBase,
    headSha,
    files,
    commands: commands.map((item) => ({ command: item.command, args: item.args })),
  };
  const cacheKey = createCacheKey(cachePayload);

  if (shouldUsePrePushCache()) {
    const cache = readPrePushCache();
    if (cache?.key === cacheKey) {
      console.log('[changed-quality-gate] 命中 pre-push 缓存，本次跳过重复校验。');
      process.exit(0);
    }
  }

  const startedAt = Date.now();
  const durations = [];
  const commandCache = shouldUsePrePushCache()
    ? readCommandCache()
    : { version: CACHE_SCHEMA_VERSION, entries: {} };
  for (const command of commands) {
    const commandCacheKey = createCommandCacheKey({ baseRef, mergeBase, headSha, files }, command);
    const cachedResult = shouldUsePrePushCache()
      ? commandCache.entries?.[commandCacheKey]
      : null;

    if (cachedResult?.status === 'passed') {
      console.log(`\n[changed-quality-gate] ${command.label}`);
      console.log('[changed-quality-gate] 命中步骤缓存，跳过重复校验。');
      durations.push({
        label: `${command.label} (cached)`,
        durationMs: cachedResult.durationMs ?? 0,
      });
      continue;
    }

    const durationMs = await runCommand(command);
    durations.push({ label: command.label, durationMs });
    if (shouldUsePrePushCache()) {
      commandCache.entries[commandCacheKey] = {
        status: 'passed',
        label: command.label,
        durationMs,
        completedAt: new Date().toISOString(),
        headSha,
        baseRef,
        mergeBase,
      };
      writeCommandCache(trimCommandCache(commandCache));
    }
  }

  const totalMs = Date.now() - startedAt;
  console.log('\n[changed-quality-gate] 执行耗时:');
  for (const item of durations) {
    console.log(`- ${item.label}: ${(item.durationMs / 1000).toFixed(1)}s`);
  }
  console.log(`[changed-quality-gate] 总耗时: ${(totalMs / 1000).toFixed(1)}s`);
  console.log('[changed-quality-gate] 全部增量校验完成。');

  if (shouldUsePrePushCache()) {
    writePrePushCache({
      key: cacheKey,
      mode,
      baseRef,
      mergeBase,
      headSha,
      generatedAt: new Date().toISOString(),
    });
  }
  } finally {
    globalBudgetHandle.release();
  }
} finally {
  taskGuard.release();
}
