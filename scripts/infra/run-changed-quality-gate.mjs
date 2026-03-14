import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const modeInput = (process.argv[2] || process.env.QUALITY_GATE_MODE || 'local').trim().toLowerCase();
const mode = modeInput === 'prepush' ? 'pre-push' : modeInput;
const isPrePushMode = mode === 'pre-push';

const GAME_VITEST_ARGS = ['--config', 'vitest.config.core.ts', '--pool', 'threads', '--no-file-parallelism', '--maxWorkers', '1'];
const FAST_VITEST_ARGS = ['--pool', 'threads', '--no-file-parallelism', '--maxWorkers', '1'];
const KNOWN_GAME_IDS = new Set(['smashup', 'dicethrone', 'summonerwars', 'tictactoe', 'cardia']);
const CORE_TEST_TARGETS = ['src/core', 'src/components', 'src/hooks', 'src/lib', 'src/shared', 'src/engine', 'src/pages'];

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

function normalizeFile(file) {
  return file.replace(/\\/g, '/').replace(/^\.?\//, '');
}

function hasAny(files, predicate) {
  return files.some(predicate);
}

function dedupeValues(values) {
  return [...new Set(values)];
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

function isDocOnly(file) {
  return file.endsWith('.md') || file.startsWith('evidence/');
}

function isLintTarget(file) {
  return isSourceCodeFile(file)
    && !file.startsWith('temp/')
    && !file.startsWith('dist/')
    && !file.startsWith('test-results/');
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

function resolveChangeContext() {
  const baseRef = resolveBaseRef();
  const mergeBase = runGit(['merge-base', 'HEAD', baseRef], { allowFailure: true }) || baseRef;
  const headSha = runGit(['rev-parse', 'HEAD']);
  const output = runGit(['diff', '--name-only', '--diff-filter=ACMR', `${baseRef}...HEAD`], { allowFailure: true });
  const files = output.split(/\r?\n/).map(normalizeFile).filter(Boolean);
  return { baseRef, mergeBase, headSha, files };
}

function affectsTypecheck(file) {
  if (file === 'package.json' || file.startsWith('tsconfig') || file === 'vite.config.ts' || file === 'eslint.config.js') return true;
  return isTsFamilyFile(file) && !isDocOnly(file);
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

function isGameSourceFile(file) {
  return isGameFile(file) && !isTestFile(file);
}

function isCoreSourceFile(file) {
  return affectsCoreArea(file) && !isTestFile(file);
}

function affectsPrePushGlobalVitest(file) {
  if (isTestFile(file)) return false;
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
    const match = file.match(/^src\/games\/([^/]+)\//);
    if (match && KNOWN_GAME_IDS.has(match[1])) ids.add(match[1]);
  }
  return [...ids];
}

function buildVitestChangedArgs(baseRef, targets, options = {}) {
  const { gameOnly = false } = options;
  const stableArgs = gameOnly ? GAME_VITEST_ARGS : FAST_VITEST_ARGS;
  const args = ['vitest', 'run', '--changed', baseRef, ...stableArgs];
  if (targets.length > 0) {
    args.push('--', ...targets);
  }
  return args;
}

function collectCommands(files, baseRef) {
  const commands = [];
  const lintFiles = files.filter(isLintTarget);
  const coreSourceChanged = hasAny(
    files,
    isPrePushMode ? affectsPrePushGlobalVitest : isCoreSourceFile,
  );
  const coreTestFiles = files.filter(isNonGameTestFile);
  const gameSourceIds = collectGameIds(files, { sourceOnly: true });
  const gameTestFiles = files.filter((file) => isGameFile(file) && isTestFile(file));

  if (hasAny(files, affectsTypecheck)) {
    commands.push({
      label: 'Typecheck',
      reason: '存在 TypeScript 或配置改动',
      command: 'npm',
      args: ['run', 'typecheck'],
    });
  }

  if (lintFiles.length > 0) {
    commands.push({
      label: 'ESLint',
      reason: '存在可 lint 的源码改动',
      command: 'npx',
      args: ['eslint', '--max-warnings', '999', ...lintFiles],
    });
  }

  if (hasAny(files, affectsBuild) && !isPrePushMode) {
    commands.push({
      label: 'Build',
      reason: 'local 模式下存在前端/构建输入改动',
      command: 'npm',
      args: ['run', 'build'],
    });
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
    commands.push({
      label: 'Server tests',
      reason: '服务端目录有改动',
      command: 'npm',
      args: ['run', 'test:server'],
    });
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
      commands.push({
        label: 'Core+Games changed tests',
        reason: '核心源码改动，先跑核心 changed 测试集',
        command: 'npx',
        args: buildVitestChangedArgs(baseRef, CORE_TEST_TARGETS),
      });
      commands.push({
        label: 'Games changed tests',
        reason: '核心源码改动，同时跑游戏 changed 测试集',
        command: 'npx',
        args: buildVitestChangedArgs(baseRef, ['src/games'], { gameOnly: true }),
      });
    } else {
      if (coreTestFiles.length > 0) {
        commands.push({
          label: 'Changed core test files',
          reason: '仅改动核心测试文件，按文件精确运行',
          command: 'npx',
          args: ['vitest', 'run', ...dedupeValues(coreTestFiles), ...FAST_VITEST_ARGS],
        });
      }
      if (gameSourceIds.length > 0) {
        for (const gameId of gameSourceIds) {
          commands.push({
            label: `${gameId} changed tests`,
            reason: `${gameId} 源码改动，运行 changed 测试集`,
            command: 'npx',
            args: buildVitestChangedArgs(baseRef, [`src/games/${gameId}`], { gameOnly: true }),
          });
        }
      } else if (gameTestFiles.length > 0) {
        commands.push({
          label: 'Changed game test files',
          reason: '仅改动游戏测试文件，按文件精确运行',
          command: 'npx',
          args: ['vitest', 'run', ...dedupeValues(gameTestFiles), ...GAME_VITEST_ARGS],
        });
      }
    }
  } else {
    if (hasAny(files, affectsCoreArea)) {
      commands.push({
        label: 'Core tests',
        reason: '核心框架/引擎区域改动',
        command: 'npm',
        args: ['run', 'test:core'],
      });
      commands.push({
        label: 'Games core tests',
        reason: '核心框架改动可能影响所有游戏',
        command: 'npx',
        args: ['vitest', 'run', 'src/games', ...GAME_VITEST_ARGS],
      });
    } else {
      for (const gameId of collectGameIds(files)) {
        commands.push({
          label: `${gameId} tests`,
          reason: `${gameId} 目录有改动`,
          command: 'npx',
          args: ['vitest', 'run', `src/games/${gameId}`, ...GAME_VITEST_ARGS],
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

function quoteArg(value) {
  if (!/[\s"]/u.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

function commandToLine(command, args) {
  return [command, ...args].map(quoteArg).join(' ');
}

function runCommand({ label, reason, command, args }) {
  console.log(`\n[changed-quality-gate] ${label}`);
  console.log(`[changed-quality-gate] 原因: ${reason}`);
  console.log(`[changed-quality-gate] 命令: ${commandToLine(command, args)}`);

  const startAt = Date.now();
  const result = process.platform === 'win32'
    ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', commandToLine(command, args)], {
        cwd: repoRoot,
        stdio: 'inherit',
        shell: false,
        env: process.env,
      })
    : spawnSync(command, args, {
        cwd: repoRoot,
        stdio: 'inherit',
        shell: false,
        env: process.env,
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

const { baseRef, mergeBase, headSha, files } = resolveChangeContext();
console.log(`[changed-quality-gate] 模式: ${mode}`);
console.log(`[changed-quality-gate] 基线: ${baseRef}`);
console.log(`[changed-quality-gate] merge-base: ${mergeBase}`);
console.log(`[changed-quality-gate] head: ${headSha}`);

if (files.length === 0) {
  console.log('[changed-quality-gate] 未检测到已提交改动，跳过。');
  process.exit(0);
}

console.log('[changed-quality-gate] 改动文件:');
for (const file of files) {
  console.log(`- ${file}`);
}

runEncodingGuard(files);

const commands = collectCommands(files, baseRef);
if (commands.length === 0) {
  console.log('[changed-quality-gate] 当前改动仅涉及文档/证据，跳过代码校验。');
  process.exit(0);
}

const cachePayload = {
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
for (const command of commands) {
  const durationMs = runCommand(command);
  durations.push({ label: command.label, durationMs });
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
