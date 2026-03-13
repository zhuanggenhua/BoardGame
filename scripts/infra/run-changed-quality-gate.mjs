import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = process.cwd();
const mode = process.argv[2] || 'local';
const STABLE_VITEST_ARGS = ['--config', 'vitest.config.core.ts', '--pool', 'threads', '--no-file-parallelism', '--maxWorkers', '1'];
const KNOWN_GAME_IDS = new Set(['smashup', 'dicethrone', 'summonerwars', 'tictactoe', 'cardia']);

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

function resolveBaseRef() {
  const envBase = process.env.QUALITY_GATE_BASE?.trim();
  if (envBase) return envBase;

  const upstream = runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], { allowFailure: true });
  if (upstream) return upstream;

  const candidates = ['origin/main', 'origin/master', 'main', 'master', 'HEAD~1'];
  for (const candidate of candidates) {
    const exists = runGit(['rev-parse', '--verify', candidate], { allowFailure: true });
    if (exists) return candidate;
  }

  throw new Error('[changed-quality-gate] 无法解析对比基线');
}

function resolveChangedFiles() {
  const baseRef = resolveBaseRef();
  const mergeBase = runGit(['merge-base', 'HEAD', baseRef], { allowFailure: true }) || baseRef;
  const output = runGit(['diff', '--name-only', '--diff-filter=ACMR', `${baseRef}...HEAD`], { allowFailure: true });
  const files = output
    .split(/\r?\n/)
    .map(normalizeFile)
    .filter(Boolean);

  return { baseRef, mergeBase, files };
}

function hasAny(files, predicate) {
  return files.some(predicate);
}

function isSourceCodeFile(file) {
  return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file);
}

function isTsFamilyFile(file) {
  return /\.(ts|tsx|mts|cts)$/.test(file);
}

function isLintTarget(file) {
  return isSourceCodeFile(file)
    && !file.startsWith('temp/')
    && !file.startsWith('dist/')
    && !file.startsWith('test-results/');
}

function isDocOnly(file) {
  return file.endsWith('.md') || file.startsWith('evidence/');
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

function affectsCoreTests(file) {
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

function collectGameIds(files) {
  const ids = new Set();
  for (const file of files) {
    const match = file.match(/^src\/games\/([^/]+)\//);
    if (match && KNOWN_GAME_IDS.has(match[1])) {
      ids.add(match[1]);
    }
  }
  return [...ids];
}

function collectCommands(files) {
  const commands = [];
  const lintFiles = files.filter(isLintTarget);

  if (hasAny(files, affectsTypecheck)) {
    commands.push({
      label: 'Typecheck',
      reason: '存在 TypeScript / 配置改动',
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

  if (hasAny(files, affectsBuild)) {
    commands.push({
      label: 'Build',
      reason: '存在前端 / 产物输入改动',
      command: 'npm',
      args: ['run', 'build'],
    });
  }

  if (hasAny(files, affectsI18n)) {
    commands.push({
      label: 'i18n',
      reason: '存在 i18n 相关输入改动',
      command: 'npm',
      args: ['run', 'i18n:check'],
    });
  }

  if (hasAny(files, file => file.startsWith('apps/api/'))) {
    commands.push({
      label: 'API tests',
      reason: 'apps/api 有改动',
      command: 'npm',
      args: ['run', 'test:api'],
    });
  }

  if (hasAny(files, file => file.startsWith('src/server/') || file.startsWith('src/api/'))) {
    commands.push({
      label: 'Server tests',
      reason: '服务端目录有改动',
      command: 'npm',
      args: ['run', 'test:server'],
    });
  }

  if (hasAny(files, file => file.startsWith('src/ugc/'))) {
    commands.push({
      label: 'UGC tests',
      reason: 'UGC 目录有改动',
      command: 'npm',
      args: ['run', 'test:ugc'],
    });
  }

  if (hasAny(files, affectsCoreTests)) {
    commands.push({
      label: 'Core tests',
      reason: '共享框架/引擎改动可能影响多模块',
      command: 'npm',
      args: ['run', 'test:core'],
    });
    commands.push({
      label: 'Games core tests',
      reason: '共享框架/引擎改动可能影响多游戏',
      command: 'npx',
      args: ['vitest', 'run', 'src/games', ...STABLE_VITEST_ARGS],
    });
  } else {
    for (const gameId of collectGameIds(files)) {
      commands.push({
        label: `${gameId} tests`,
        reason: `${gameId} 目录有改动`,
        command: 'npx',
        args: ['vitest', 'run', `src/games/${gameId}`, ...STABLE_VITEST_ARGS],
      });
    }
  }

  return dedupeCommands(commands);
}

function dedupeCommands(commands) {
  const seen = new Set();
  return commands.filter((command) => {
    const key = `${command.command} ${command.args.join(' ')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function runCommand({ label, reason, command, args }) {
  const quoteArg = (value) => {
    if (!/[\s"]/u.test(value)) return value;
    return `"${value.replace(/"/g, '\\"')}"`;
  };
  console.log(`\n[changed-quality-gate] ${label}`);
  console.log(`[changed-quality-gate] 原因: ${reason}`);
  const commandLine = [command, ...args].map(quoteArg).join(' ');
  console.log(`[changed-quality-gate] 命令: ${commandLine}`);
  const result = process.platform === 'win32'
    ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', commandLine], {
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
  if (result.error) {
    console.error(`[changed-quality-gate] 命令启动失败: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const { baseRef, mergeBase, files } = resolveChangedFiles();
console.log(`[changed-quality-gate] 模式: ${mode}`);
console.log(`[changed-quality-gate] 基线: ${baseRef}`);
console.log(`[changed-quality-gate] merge-base: ${mergeBase}`);

if (files.length === 0) {
  console.log('[changed-quality-gate] 没有检测到已提交改动，跳过校验。');
  process.exit(0);
}

console.log('[changed-quality-gate] 改动文件:');
for (const file of files) {
  console.log(`- ${file}`);
}

const commands = collectCommands(files);
if (commands.length === 0) {
  console.log('[changed-quality-gate] 当前改动仅涉及文档/证据，无需运行代码校验。');
  process.exit(0);
}

for (const command of commands) {
  runCommand(command);
}

console.log('\n[changed-quality-gate] 全部增量校验完成。');
