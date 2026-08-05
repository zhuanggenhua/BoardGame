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
const skipLintInQualityGate = process.env.QUALITY_GATE_SKIP_LINT === '1';
const isDryRun = process.env.QUALITY_GATE_DRY_RUN === '1';
const targetHeadRef = (process.env.QUALITY_GATE_HEAD || 'HEAD').trim() || 'HEAD';
const CACHE_SCHEMA_VERSION = 2;
const ZERO_SHA_PATTERN = /^0{40}$/;
const prePushInput = isPrePushMode ? readPrePushInput() : '';
const prePushRefs = parsePrePushRefs(prePushInput);
const auditedMergeConflictCommits = new Set();

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
const PRE_PUSH_GAME_SMOKE_TARGETS = {
  smashup: ['src/games/smashup/__tests__/smashup.smoke.test.ts'],
  dicethrone: ['src/games/dicethrone/__tests__/flow.test.ts'],
  summonerwars: ['src/games/summonerwars/__tests__/flow.test.ts'],
  tictactoe: ['src/games/tictactoe/__tests__/flow.test.ts'],
  cardia: ['src/games/cardia/__tests__/smoke.test.ts'],
};
const DICETHRONE_SYNC_BLOCKER_PATTERNS = [
  /^src\/engine\/transport\//,
  /^src\/games\/dicethrone\/domain\//,
  /^src\/games\/dicethrone\/game\.ts$/,
];
const DICETHRONE_SYNC_BLOCKER_TESTS = [
  {
    label: 'BLOCKER: DiceThrone sync transport contract',
    reason: '王权同步/旧状态兼容链路改动，强制回归 state:sync、playerView 与 legacy state 包装合同',
    target: 'src/engine/transport/__tests__/server.test.ts',
    testNamePattern: 'dicethrone sync',
    vitestArgs: FAST_VITEST_ARGS,
  },
  {
    label: 'BLOCKER: DiceThrone legacy runtime-state contract',
    reason: '王权同步/旧状态兼容链路改动，强制回归 authoritative 旧状态与 pendingBonusDiceSettlement 归一化合同',
    target: 'src/games/dicethrone/__tests__/flow.test.ts',
    testNamePattern: '旧 pendingBonusDiceSettlement 脏 dice shape',
    vitestArgs: GAME_VITEST_ARGS,
  },
];
const GAME_ENTRY_BLOCKER_PATTERNS = [
  /^src\/App\.tsx$/,
  /^src\/pages\/MatchRoom.*\.tsx$/,
  /^src\/pages\/matchRoom.*\.(ts|tsx)$/,
  /^src\/pages\/useMatchRoom.*\.(ts|tsx)$/,
  /^src\/pages\/useOnlineAiSeat.*\.(ts|tsx)$/,
  /^src\/pages\/onlineAi.*\.(ts|tsx)$/,
  /^src\/lib\/prefetchPlayRoute\.ts$/,
  /^src\/lib\/staleChunkReloadGuard\.ts$/,
  /^src\/components\/system\/GlobalErrorBoundary\.tsx$/,
  /^src\/hooks\/useGameImplementationReady\.ts$/,
  /^src\/games\/registry\.ts$/,
  /^src\/engine\/transport\/client\.ts$/,
];
const GAME_ENTRY_BLOCKER_TESTS = [
  {
    label: 'BLOCKER: Play route stale chunk recovery',
    reason: '进房入口链路改动，强制回归 lazy route / stale chunk 自动恢复，不允许卡死在错误边界',
    target: 'src/components/system/__tests__/GlobalErrorBoundary.test.tsx',
    testNamePattern: 'stale chunk 渲染错误会触发自动刷新',
    vitestArgs: FAST_VITEST_ARGS,
  },
  {
    label: 'BLOCKER: Game runtime stale chunk recovery',
    reason: '进房入口链路改动，强制回归游戏 runtime 动态导入 stale chunk 自动恢复',
    target: 'src/pages/__tests__/Maintenance.test.tsx',
    testNamePattern: '游戏 runtime 动态导入命中 stale chunk 时会触发一次页面刷新',
    vitestArgs: FAST_VITEST_ARGS,
  },
  {
    label: 'BLOCKER: MatchRoom blocking-state contract',
    reason: '进房入口链路改动，强制回归 MatchRoom 阻塞态优先级，防止实现加载失败被伪装成 loading',
    target: 'src/pages/__tests__/matchRoomBlockingState.test.ts',
    testNamePattern: 'implementation 加载失败时，应返回明确错误态',
    vitestArgs: FAST_VITEST_ARGS,
  },
];
const PLAY_ROUTE_ENTRY_GUARD_PATTERNS = new Set([
  'src/App.tsx',
  'src/lib/prefetchPlayRoute.ts',
  'src/games/manifest.client.tsx',
  'src/games/manifest.client.generated.tsx',
  'src/pages/MatchRoom.tsx',
  'src/pages/MatchRoomWithAudio.tsx',
  'src/pages/LocalMatchRoom.tsx',
  'src/pages/LocalMatchRoomWithAudio.tsx',
  'src/pages/TestMatchRoom.tsx',
  'src/pages/TestMatchRoomWithAudio.tsx',
  'src/pages/TutorialMatchRoom.tsx',
  'src/pages/TutorialMatchRoomWithAudio.tsx',
]);
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
const TEST_STRUCTURE_FILES_LIST = path.join(CACHE_DIR, 'test-structure-files.txt');
const STABLE_VITEST_NODE_OPTIONS = '--max-old-space-size=8192';
const STABLE_ESLINT_NODE_OPTIONS = '--max-old-space-size=8192';
const ESLINT_CHUNK_LIMIT = 2;
const ESLINT_WARNING_DELTA_CHUNK_SIZE = 2;
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

function writeListFile(filename, values) {
  mkdirSync(path.dirname(filename), { recursive: true });
  writeFileSync(filename, `${values.join('\n')}\n`, 'utf8');
  return filename;
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

function getIntersectingChangedFiles(parentA, parentB, baseRef = '') {
  const mergeBase = baseRef || runGit(['merge-base', parentA, parentB], { allowFailure: true });
  if (!mergeBase) return [];
  const changedA = new Set(
    runGit(['diff', '--name-only', '--no-renames', mergeBase, parentA], { allowFailure: true })
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const changedB = new Set(
    runGit(['diff', '--name-only', '--no-renames', mergeBase, parentB], { allowFailure: true })
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

function getConflictFilesFromCommitMessage(commit) {
  const body = runGit(['show', '-s', '--format=%B', commit], { allowFailure: true });
  if (!body) return [];

  const files = new Set();
  const lines = body.split(/\r?\n/);
  let inConflictsSection = false;

  for (const line of lines) {
    const legacyMatch = line.match(/^#\s+(.+)$/);
    if (legacyMatch) {
      const value = legacyMatch[1].trim();
      if (value && !value.includes(':')) {
        files.add(value);
      }
      continue;
    }

    if (/^Conflicts:\s*$/i.test(line.trim())) {
      inConflictsSection = true;
      continue;
    }

    if (!inConflictsSection) {
      continue;
    }

    if (/^\s+\S+/.test(line)) {
      files.add(line.trim());
      continue;
    }

    if (line.trim() === '') {
      continue;
    }

    inConflictsSection = false;
  }

  return [...files];
}

function hasMergeConflictEvidenceInCommit(commit) {
  const changedFiles = runGit(['show', '-m', '--pretty=format:', '--name-only', '--no-renames', commit], { allowFailure: true })
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  return changedFiles.some((file) => file.startsWith('evidence/merge-conflict-') && file.endsWith('.md'));
}

function hasMergeConflictEvidenceInDescendants(commit, headRef) {
  if (!headRef || headRef === commit) return false;
  const changedFiles = runGit(['diff', '--name-only', '--no-renames', `${commit}..${headRef}`], { allowFailure: true })
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  return changedFiles.some((file) => file.startsWith('evidence/merge-conflict-') && file.endsWith('.md'));
}

function hasMergeConflictEvidence(commit, headRef) {
  return hasMergeConflictEvidenceInCommit(commit) || hasMergeConflictEvidenceInDescendants(commit, headRef);
}

function runMergeAuditStrict(commit) {
  const result = spawnSync(process.execPath, ['scripts/verify/merge-conflict-audit.mjs', commit, '--fail-on-single-side'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });
  if (result.error) {
    console.error(`[changed-quality-gate] merge:audit 启动失败: ${result.error.message}`);
    process.exit(1);
  }
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.status ?? 1;
}

function runMergeConflictGuards({ baseRef, headRef, scopeLabel = '' }) {
  if (isPreCommitMode) return;
  const mergeCommits = getMergeCommitsInRange(baseRef, headRef)
    .filter((commit) => !auditedMergeConflictCommits.has(commit));
  if (mergeCommits.length === 0) return;

  console.log('\n[changed-quality-gate] Merge conflict guard');
  if (scopeLabel) {
    console.log(`[changed-quality-gate] 审计范围: ${scopeLabel}`);
  }
  console.log(`[changed-quality-gate] merge commits: ${mergeCommits.length}`);

  for (const commit of mergeCommits) {
    auditedMergeConflictCommits.add(commit);
    const parents = getMergeCommitParents(commit);
    const overlapFiles = parents ? getIntersectingChangedFiles(parents[0], parents[1]) : [];
    const conflictFiles = getConflictFilesFromCommitMessage(commit);
    if (conflictFiles.length === 0 && overlapFiles.length === 0) {
      console.log(`[changed-quality-gate] merge commit ${commit} 未识别到双侧重叠改动，按 clean merge 跳过冲突留档门禁。`);
      continue;
    }

    console.log(`[changed-quality-gate] 审计 merge commit: ${commit}`);
    if (conflictFiles.length > 0) {
      console.log(`[changed-quality-gate] 记录的真实冲突文件数: ${conflictFiles.length}`);
    } else {
      console.log(`[changed-quality-gate] merge commit ${commit} 未记录真实冲突文件，退化为双侧重叠改动审计。`);
      console.log(`[changed-quality-gate] 双侧重叠改动文件数: ${overlapFiles.length}`);
    }
    const mergeAuditStatus = runMergeAuditStrict(commit);
    const hasEvidence = hasMergeConflictEvidence(commit, headRef);
    if (mergeAuditStatus !== 0 && !hasEvidence) {
      process.exit(mergeAuditStatus);
    }

    if (!hasEvidence) {
      console.error(`[changed-quality-gate] merge commit ${commit} 缺少 evidence/merge-conflict-*.md 冲突汇报。`);
      console.error('[changed-quality-gate] 请在 merge commit 内，或紧跟其后的补记提交中补充冲突汇报文档并重新提交。');
      process.exit(1);
    }

    if (mergeAuditStatus !== 0) {
      console.log(`[changed-quality-gate] merge commit ${commit} 存在单边结果，但已检测到冲突汇报文档，继续执行后续门禁。`);
    }
  }
}

function readPrePushInput() {
  if (typeof process.env.QUALITY_GATE_PRE_PUSH_STDIN === 'string') {
    return process.env.QUALITY_GATE_PRE_PUSH_STDIN;
  }
  if (process.stdin.isTTY) return '';
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function parsePrePushRefs(input) {
  if (!input) return [];
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [localRef, localSha, remoteRef, remoteSha] = line.split(/\s+/);
      if (!localRef || !localSha || !remoteRef || !remoteSha) return null;
      return { localRef, localSha, remoteRef, remoteSha };
    })
    .filter(Boolean);
}

function isZeroSha(value) {
  return ZERO_SHA_PATTERN.test(value);
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
  if (!isRunnableVitestTestFile(normalized)) return null;
  return fileExistsInWorkspace(normalized) ? normalized : null;
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

function resolveCommitSha(ref) {
  if (!ref) return '';
  return runGit(['rev-parse', '--verify', `${ref}^{commit}`], { allowFailure: true });
}

function resolvePrePushRefContexts(defaultBaseRef) {
  if (!isPrePushMode || prePushRefs.length === 0) return [];

  const contexts = [];
  for (const pushedRef of prePushRefs) {
    if (isZeroSha(pushedRef.localSha)) {
      continue;
    }

    const localSha = resolveCommitSha(pushedRef.localSha);
    if (!localSha) {
      console.warn(`[changed-quality-gate] 无法解析本次 push 的本地提交 ${pushedRef.localSha}（${pushedRef.localRef}），跳过该 ref 的 merge 审计。`);
      continue;
    }

    let rangeBaseRef = '';
    let rangeSource = '';
    if (!isZeroSha(pushedRef.remoteSha)) {
      const remoteSha = resolveCommitSha(pushedRef.remoteSha);
      if (remoteSha) {
        rangeBaseRef = remoteSha;
        rangeSource = 'remote';
      } else {
        console.warn(`[changed-quality-gate] 无法解析本次 push 的远端旧提交 ${pushedRef.remoteSha}（${pushedRef.remoteRef}），改用基线 merge-base。`);
      }
    }

    if (!rangeBaseRef && defaultBaseRef) {
      const mergeBase = runGit(['merge-base', localSha, defaultBaseRef], { allowFailure: true });
      rangeBaseRef = mergeBase || defaultBaseRef;
      rangeSource = mergeBase ? 'merge-base' : 'base';
    }

    if (!rangeBaseRef) {
      console.warn(`[changed-quality-gate] 无法为本次 push ref ${pushedRef.remoteRef} 解析审计范围，跳过该 ref 的 merge 审计。`);
      continue;
    }

    contexts.push({
      ...pushedRef,
      localSha,
      rangeBaseRef,
      rangeSource,
      scopeLabel: `${rangeBaseRef}..${localSha}`,
    });
  }

  return contexts;
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
  return file.startsWith('src/games/');
}

function isGameVitestTest(file) {
  return file.startsWith('src/games/') && isTestFile(file);
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

function affectsPlayRouteEntry(file) {
  return PLAY_ROUTE_ENTRY_GUARD_PATTERNS.has(normalizeFile(file));
}

function affectsSharedGameEntrySmoke(file) {
  return affectsPlayRouteEntry(file) || affectsGameEntryBlocker(file);
}

function affectsSmashUpRuntimeRandomSeam(file) {
  const normalized = normalizeFile(file);
  return normalized === 'src/games/smashup/domain/abilityHelpers.ts'
    || normalized === 'src/games/smashup/domain/abilityRuntime.ts'
    || normalized === 'src/games/smashup/__tests__/runtimePromptRandomAudit.test.ts'
    || normalized.startsWith('src/games/smashup/abilities/');
}

function affectsDiceThroneSyncBlocker(file) {
  const normalized = normalizeFile(file);
  return DICETHRONE_SYNC_BLOCKER_PATTERNS.some((pattern) => pattern.test(normalized));
}

function affectsGameEntryBlocker(file) {
  const normalized = normalizeFile(file);
  return GAME_ENTRY_BLOCKER_PATTERNS.some((pattern) => pattern.test(normalized));
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

function collectTestsForDirectoryTarget(target, coverage) {
  const normalizedTarget = normalizeFile(target);
  const directTestDir = `${normalizedTarget}/__tests__/`;

  const directTests = coverage.testFiles.filter((file) => {
    const normalizedFile = normalizeFile(file);
    if (!isRunnableVitestTestFile(normalizedFile)) return false;
    if (normalizedFile.startsWith(directTestDir)) return true;
    return path.posix.dirname(normalizedFile) === normalizedTarget;
  });

  if (directTests.length > 0) {
    return directTests;
  }

  return coverage.testFiles.filter((file) => isRunnableVitestTestFile(file) && (file === normalizedTarget || file.startsWith(`${normalizedTarget}/`)));
}

function expandVitestTargetsToTestFiles(targets, coverage) {
  return dedupeValues(targets.flatMap((target) => {
    if (isTestFile(target)) return isRunnableVitestTestFile(target) ? [target] : [];
    return collectTestsForDirectoryTarget(target, coverage);
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

function toWorkspaceScopeFile(file) {
  return normalizeFile(file);
}

function createScopedGameTestCommands(files, vitestArgs) {
  const workspaceScopeFiles = dedupeValues(files.map((file) => toWorkspaceScopeFile(file)));
  const gameIds = collectGameIds(workspaceScopeFiles);
  const commands = [];

  for (const gameId of gameIds) {
    const gameTarget = `src/games/${gameId}`;
    const scopedTargets = collectScopedVitestTargets(workspaceScopeFiles, [gameTarget]);
    if (scopedTargets.length === 0) {
      commands.push({
        label: `${gameId} tests`,
        reason: `${gameId} 目录有改动，但未解析到更细测试范围，回退到该游戏测试集`,
        command: process.execPath,
        args: [...VITEST_SAFE_ENTRY, 'run', gameTarget, ...vitestArgs],
      });
      continue;
    }

    scopedTargets.forEach((target, index) => {
      const label = scopedTargets.length === 1 ? `${gameId} tests` : `${gameId} tests (${index + 1}/${scopedTargets.length})`;
      commands.push(...createVitestCommands({
        label,
        reason: `${gameId} 目录有改动，按最近受影响测试范围增量执行`,
        target,
        vitestArgs,
      }));
    });
  }

  return commands;
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
  const workspaceScopeFiles = dedupeValues(files.map((file) => toWorkspaceScopeFile(file)));
  const lintCandidateFiles = isPrePushMode
    ? prePushLintFiles.filter(isLintTarget)
    : files.filter(isLintTarget);
  const lintWarningDeltaFiles = isPrePushMode
    ? lintCandidateFiles.filter((file) => !isLintWarningDeltaIgnored(file))
    : lintCandidateFiles;
  const lintFiles = lintCandidateFiles.filter(fileExistsInWorkspace);
  const coreSourceChanged = hasAny(
    workspaceScopeFiles,
    isPrePushMode ? affectsPrePushGlobalVitest : isCoreSourceFile,
  );
  const coreTestFiles = collectRunnableVitestWorkspaceTargets(
    workspaceScopeFiles.filter((file) => isNonGameTestFile(file)),
  );
  const touchedGameIds = collectGameIds(workspaceScopeFiles);
  const gameSourceIds = collectGameIds(workspaceScopeFiles, { sourceOnly: true });
  const gameTestFiles = collectRunnableVitestWorkspaceTargets(
    workspaceScopeFiles.filter((file) => isGameFile(file) && isTestFile(file)),
  );

  if (hasAny(files, isGameVitestTest)) {
    commands.push({
      label: 'Test structure guard',
      reason: '存在游戏测试改动，检查测试文件命名与巨型泛名文件净新增',
      command: process.execPath,
      args: [
        'scripts/infra/testing-structure-guard.mjs',
        '--base',
        baseRef,
        '--files-from',
        writeListFile(TEST_STRUCTURE_FILES_LIST, files),
      ],
    });
  }

  if (hasAny(files, affectsTypecheck)) {
    commands.push({
      label: 'Typecheck',
      reason: '存在 TypeScript 或配置改动',
      command: 'npx',
      args: ['tsc', '--noEmit', '--incremental', '--tsBuildInfoFile', QUALITY_GATE_TYPECHECK_BUILD_INFO],
    });
  }

  if (skipLintInQualityGate && !isPrePushMode && lintFiles.length > 0) {
    console.log('[changed-quality-gate] QUALITY_GATE_SKIP_LINT=1：pre-commit 的 ESLint 已由 lint-staged 执行，这里跳过重复 lint。');
  } else if (isPrePushMode && lintWarningDeltaFiles.length > 0) {
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

  if (hasAny(files, affectsBuild) && isPrePushMode) {
    const buildArgs = ['run', 'build'];
    // 本地 pre-push 门禁需要确保能成功构建并捕获编译/打包错误，
    // 不需要强制跑 esbuild minify（它在 Windows + 大 bundle 时更容易触发内存峰值导致 gate 失败）。
    // CI 会兜底 full build（含 minify），因此这里默认在 pre-push 下关闭 minify 来提高稳定性。
    if (isPrePushMode) {
      buildArgs.push('--', '--minify', 'false', '--configLoader', 'native');
    }
    commands.push({
      label: 'Build',
      reason: 'pre-push 模式下存在前端/构建输入改动',
      command: 'npm',
      args: buildArgs,
    });
  } else if (hasAny(files, affectsBuild) && isPreCommitMode) {
    console.log('[changed-quality-gate] pre-commit 模式：跳过 build，改由 pre-push 增量构建门禁兜底。');
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

  if (isPrePushMode && hasAny(workspaceScopeFiles, affectsSharedGameEntrySmoke)) {
    commands.push({
      label: 'Play route smoke (online)',
      reason: '共享进房链路改动，真实浏览器进房兜底动态 import / 路由白屏 / 房间阻塞态错误',
      command: process.execPath,
      args: [
        'scripts/infra/run-e2e-single.mjs',
        'ci',
        'e2e/dicethrone/dicethrone-simple-start.e2e.ts',
        'Online match: Can start a game successfully',
      ],
    });
  }

  if (isPrePushMode && hasAny(workspaceScopeFiles, affectsDiceThroneSyncBlocker)) {
    DICETHRONE_SYNC_BLOCKER_TESTS.forEach((blocker) => {
      commands.push({
        label: blocker.label,
        reason: blocker.reason,
        command: process.execPath,
        args: [
          ...VITEST_SAFE_ENTRY,
          'run',
          blocker.target,
          '--configLoader',
          'native',
          ...ensurePassWithNoTests(blocker.vitestArgs),
          '-t',
          blocker.testNamePattern,
        ],
      });
    });
  }

  if (isPrePushMode && hasAny(workspaceScopeFiles, affectsGameEntryBlocker)) {
    GAME_ENTRY_BLOCKER_TESTS.forEach((blocker) => {
      commands.push({
        label: blocker.label,
        reason: blocker.reason,
        command: process.execPath,
        args: [
          ...VITEST_SAFE_ENTRY,
          'run',
          blocker.target,
          '--configLoader',
          'native',
          ...ensurePassWithNoTests(blocker.vitestArgs),
          '-t',
          blocker.testNamePattern,
        ],
      });
    });
  }

  if (hasAny(workspaceScopeFiles, affectsSmashUpRuntimeRandomSeam)) {
    commands.push({
      label: 'SmashUp runtime random audit',
      reason: 'SmashUp runtime prompt / draw seam 改动，执行定向审计防止 random 依赖再次泄漏到 onResolve',
      command: process.execPath,
      args: [
        ...VITEST_SAFE_ENTRY,
        'run',
        'src/games/smashup/__tests__/runtimePromptRandomAudit.test.ts',
        '--config',
        'vitest.config.audit.ts',
        '--configLoader',
        'native',
      ],
    });
    commands.push({
      label: 'SmashUp ability event shape contract',
      reason: 'SmashUp 能力/helper 改动，检查单事件 helper 不得直接用于数组展开',
      command: process.execPath,
      args: [
        ...VITEST_SAFE_ENTRY,
        'run',
        'src/games/smashup/__tests__/abilityEventShapeContract.test.ts',
        '--config',
        'vitest.config.core.ts',
        '--configLoader',
        'native',
      ],
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

      if (gameSourceIds.length > 0) {
        gameSourceIds.forEach((gameId) => {
          commands.push({
            label: `${gameId} tests`,
            reason: `${gameId} 源码改动，单独跑该游戏完整测试集`,
            command: process.execPath,
            args: [...VITEST_SAFE_ENTRY, 'run', `src/games/${gameId}`, ...GAME_VITEST_ARGS],
          });
        });
      } else if (gameTestFiles.length > 0) {
        commands.push({
          label: 'Changed game test files',
          reason: '核心源码改动且仅改到游戏测试文件，优先按测试文件精确运行',
          command: process.execPath,
          args: [...VITEST_SAFE_ENTRY, 'run', ...gameTestFiles, ...ensurePassWithNoTests(GAME_VITEST_ARGS)],
        });
      } else {
        const fallbackGameIds = touchedGameIds.length > 0 ? touchedGameIds : [...KNOWN_GAME_IDS];
        fallbackGameIds.forEach((gameId) => {
          const smokeTargets = PRE_PUSH_GAME_SMOKE_TARGETS[gameId] ?? [];
          if (smokeTargets.length > 0) {
            commands.push({
              label: `${gameId} smoke`,
              reason: '核心源码改动，使用每个游戏的代表性 smoke/flow 测试做跨游戏兜底',
              command: process.execPath,
              args: [...VITEST_SAFE_ENTRY, 'run', ...smokeTargets, ...ensurePassWithNoTests(GAME_VITEST_ARGS)],
            });
            return;
          }

          commands.push({
            label: `${gameId} tests`,
            reason: '核心源码改动，缺少代表性 smoke/flow 测试，回退到该游戏完整测试集',
            command: process.execPath,
            args: [...VITEST_SAFE_ENTRY, 'run', `src/games/${gameId}`, ...GAME_VITEST_ARGS],
          });
        });
      }
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
    if (hasAny(workspaceScopeFiles, affectsCoreArea)) {
      const scopedCoreTargets = collectScopedVitestTargets(workspaceScopeFiles, CORE_VITEST_TARGETS);
      scopedCoreTargets.forEach((target, index) => {
        const label = scopedCoreTargets.length === 1 ? 'Core tests' : `Core tests (${index + 1}/${scopedCoreTargets.length})`;
        commands.push(...createVitestCommands({
          label,
          reason: '核心框架/引擎区域改动，按最近受影响测试范围增量执行',
          target,
          vitestArgs: FAST_VITEST_ARGS,
        }));
      });

      commands.push(...createScopedGameTestCommands(workspaceScopeFiles, GAME_VITEST_ARGS));
    } else {
      commands.push(...createScopedGameTestCommands(workspaceScopeFiles, GAME_VITEST_ARGS));
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

function isVitestCliSafeCommand(command, args) {
  return command.includes('vitest-cli-safe') || args.includes('scripts/infra/vitest-cli-safe.mjs');
}

function cleanupWindowsVitestResidue() {
  if (process.platform !== 'win32') return;

  const repoRootForPowerShell = repoRoot.replace(/'/g, "''");
  const powerShellScript = [
    `$repo = [System.IO.Path]::GetFullPath('${repoRootForPowerShell}')`,
    `$targets = Get-CimInstance Win32_Process | Where-Object {`,
    `  ($_.Name -eq 'node.exe' -and ($_.CommandLine -match 'scripts[/\\\\]infra[/\\\\]vitest-cli-safe\\.mjs' -or $_.CommandLine -match 'node_modules[/\\\\]vitest[/\\\\]dist[/\\\\]workers[/\\\\]forks\\.js')) -or`,
    `  ($_.Name -eq 'esbuild.exe' -and $_.ExecutablePath -like ($repo + '*'))`,
    `}`,
    `$ids = @($targets | Select-Object -ExpandProperty ProcessId -Unique)`,
    `if ($ids.Count -gt 0) { Stop-Process -Id $ids -Force -ErrorAction SilentlyContinue }`,
    `Write-Output $ids.Count`,
  ].join('; ');

  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', powerShellScript], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  if (result.error) {
    console.warn(`[changed-quality-gate] 清理残留 vitest/esbuild 进程失败: ${result.error.message}`);
    return;
  }

  const cleanedCount = Number.parseInt((result.stdout ?? '').trim(), 10);
  if (Number.isFinite(cleanedCount) && cleanedCount > 0) {
    console.log(`[changed-quality-gate] 已清理 ${cleanedCount} 个残留 vitest/esbuild 进程。`);
  }
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
  const chunks = chunkValues(filesToCheck, ESLINT_WARNING_DELTA_CHUNK_SIZE);

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

  const concurrency = 4;
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
    const resultChunks = chunkValues(currentFiles, ESLINT_WARNING_DELTA_CHUNK_SIZE);
    for (const chunk of resultChunks) {
      const currentResults = await eslint.lintFiles(chunk);
      const output = formatter.format(currentResults).trim();
      if (output) {
        console.error(output);
      }
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
  const shouldCleanupVitestResidue = isVitestCliSafeCommand(command, args);
  if (shouldCleanupVitestResidue) {
    cleanupWindowsVitestResidue();
  }

  const env = shouldUseStableVitestEnv(command, args)
    ? createVitestEnv()
    : (shouldUseStableEslintEnv(command, args) ? createEslintEnv() : process.env);
  const runSpawn = () => (
    shouldDirectSpawnOnWindows(command)
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
        })
  );

  let result = runSpawn();
  if (shouldCleanupVitestResidue && result.status !== 0) {
    cleanupWindowsVitestResidue();
    console.warn('[changed-quality-gate] Vitest 命令失败，执行一次清理后重试。');
    result = runSpawn();
  }
  const durationMs = Date.now() - startAt;

  if (shouldCleanupVitestResidue) {
    cleanupWindowsVitestResidue();
  }

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
const prePushRefContexts = resolvePrePushRefContexts(baseRef);
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
if (isPrePushMode && prePushRefs.length > 0) {
  console.log('[changed-quality-gate] 本次 push refs:');
  if (prePushRefContexts.length === 0) {
    console.log('[changed-quality-gate] - 未发现需要审计的非删除 ref');
  } else {
    for (const context of prePushRefContexts) {
      console.log(`[changed-quality-gate] - ${context.remoteRef}: ${context.scopeLabel} (${context.rangeSource})`);
    }
  }
}

for (const context of prePushRefContexts) {
  runMergeConflictGuards({
    baseRef: context.rangeBaseRef,
    headRef: context.localSha,
    scopeLabel: `push ${context.remoteRef}: ${context.scopeLabel}`,
  });
}

runMergeConflictGuards({
  baseRef: effectiveBaseRef,
  headRef: resolvedTargetHead,
  scopeLabel: effectiveScopeLabel,
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

  if (isDryRun) {
    console.log('\n[changed-quality-gate] DRY RUN：以下命令会被执行');
    commands.forEach((command, index) => {
      console.log(`${index + 1}. ${command.label}`);
      console.log(`   reason: ${command.reason}`);
      console.log(`   command: ${commandToLine(command.command, command.args)}`);
    });
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
