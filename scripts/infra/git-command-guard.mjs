#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BYPASS_ENV = 'BOARDGAME_GIT_GUARD_BYPASS';

function resolveCurrentRepoRoot(cwd = process.cwd()) {
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  if (result.status !== 0) return null;
  return path.resolve(result.stdout.trim());
}

function isInsideBoardGameRepo(cwd = process.cwd()) {
  const repoRoot = resolveCurrentRepoRoot(cwd);
  return repoRoot === REPO_ROOT;
}

function hasAnyFlag(args, flags) {
  return args.some((arg) => flags.includes(arg));
}

function classifyBranchOrWorktree(args) {
  const [command, subcommand, ...rest] = args;

  if (command === 'switch') {
    return {
      blocked: true,
      reason: '切换分支会直接改写当前工作区，项目默认要求先获得当轮明确许可。',
      label: 'git switch',
    };
  }

  if (command === 'checkout') {
    return {
      blocked: true,
      reason: 'checkout 可能用于切分支或覆盖文件，项目默认要求先获得当轮明确许可。',
      label: 'git checkout',
    };
  }

  if (command === 'branch') {
    const branchArgs = args.slice(1);
    const readOnlyFlags = new Set(['-a', '--all', '-r', '--remotes', '--show-current', '-vv', '-v']);
    const listOnly =
      branchArgs.length === 0 ||
      branchArgs.every((arg) => arg.startsWith('-') && readOnlyFlags.has(arg));
    if (!listOnly) {
      return {
        blocked: true,
        reason: '创建、删除或重命名分支属于受控动作，项目默认要求先获得当轮明确许可。',
        label: 'git branch',
      };
    }
  }

  if (command === 'worktree') {
    const mutatingSubcommands = new Set(['add', 'move', 'remove', 'prune', 'lock', 'unlock']);
    if (mutatingSubcommands.has(subcommand)) {
      return {
        blocked: true,
        reason: 'worktree 的创建、移动和删除属于受控动作，项目默认要求先获得当轮明确许可。',
        label: `git worktree ${subcommand}`,
      };
    }
  }

  return null;
}

export function classifyDangerousGitCommand(args) {
  if (!args.length) return null;

  const [command, ...rest] = args;

  if (command === 'stash') {
    return {
      blocked: true,
      reason: 'stash 会隐藏并重排当前脏工作区，项目默认禁止把它当作保护现场手段。',
      label: 'git stash',
    };
  }

  if (command === 'restore') {
    return {
      blocked: true,
      reason: 'restore 会直接覆盖现有改动，项目默认要求先看清具体 diff 并获得明确许可。',
      label: 'git restore',
    };
  }

  if (command === 'clean') {
    return {
      blocked: true,
      reason: 'clean 会删除未跟踪文件，项目默认要求先逐项确认目标与影响。',
      label: 'git clean',
    };
  }

  if (command === 'rebase') {
    return {
      blocked: true,
      reason: 'rebase 会改写历史与工作区状态，项目默认禁止未经明确许可执行。',
      label: 'git rebase',
    };
  }

  if (command === 'pull' && hasAnyFlag(rest, ['--rebase', '-r'])) {
    return {
      blocked: true,
      reason: 'pull --rebase 会隐式进入 rebase 流程，项目默认禁止未经明确许可执行。',
      label: 'git pull --rebase',
    };
  }

  if (command === 'reset') {
    return {
      blocked: true,
      reason: 'reset 会移动 HEAD 或覆盖工作区，项目默认禁止未经明确许可执行。',
      label: 'git reset',
    };
  }

  if (command === 'revert') {
    return {
      blocked: true,
      reason: 'revert 属于历史回退动作，项目默认禁止未经明确许可执行。',
      label: 'git revert',
    };
  }

  const branchOrWorktree = classifyBranchOrWorktree(args);
  if (branchOrWorktree) return branchOrWorktree;

  return null;
}

function printBlockedMessage(block) {
  console.error(`[git-command-guard] 已拦截危险 Git 命令：${block.label}`);
  console.error(`[git-command-guard] 原因：${block.reason}`);
  console.error('[git-command-guard] 如已获得用户当轮明确许可，请在同一命令前显式设置环境变量：');
  console.error(`[git-command-guard]   $env:${BYPASS_ENV}='1'`);
}

function runGit(args) {
  const result = spawnSync('git', args, { stdio: 'inherit' });
  if (typeof result.status === 'number') {
    process.exit(result.status);
  }
  process.exit(1);
}

function handlePreRebaseHook() {
  if (process.env[BYPASS_ENV] === '1') {
    process.exit(0);
  }

  printBlockedMessage({
    label: 'git rebase',
    reason: '本仓库已安装 pre-rebase guard；未获用户当轮明确许可时禁止执行 rebase。',
  });
  process.exit(1);
}

function main() {
  const argv = process.argv.slice(2);

  if (argv[0] === '--hook' && argv[1] === 'pre-rebase') {
    handlePreRebaseHook();
    return;
  }

  if (!isInsideBoardGameRepo()) {
    runGit(argv);
    return;
  }

  if (process.env[BYPASS_ENV] === '1') {
    runGit(argv);
    return;
  }

  const block = classifyDangerousGitCommand(argv);
  if (block?.blocked) {
    printBlockedMessage(block);
    process.exit(1);
  }

  runGit(argv);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === __filename) {
  main();
}
