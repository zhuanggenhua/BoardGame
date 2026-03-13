import { spawn } from 'child_process';
export function spawnNodeScript(scriptPath, env, args = []) {
  return spawn(process.execPath, [scriptPath, ...args], {
    stdio: 'inherit',
    env,
  });
}

export function spawnBundleRunner({ label, entry, outfile, tsconfig, env, watch = true }) {
  const runnerArgs = [
    '--label', label,
    '--entry', entry,
    '--outfile', outfile,
    '--tsconfig', tsconfig,
  ];
  if (!watch) {
    runnerArgs.push('--once', 'true');
  }

  return spawnNodeScript('scripts/infra/dev-bundle-runner.mjs', env, [
    ...runnerArgs,
  ]);
}

export function spawnTsxEntry({ entry, tsconfig, env }) {
  return spawn(process.execPath, [
    'node_modules/tsx/dist/cli.mjs',
    '--tsconfig',
    tsconfig,
    entry,
  ], {
    stdio: 'inherit',
    env,
  });
}

export function spawnNpxCommand(args, env) {
  return spawn(process.execPath, ['node_modules/npm/bin/npm-cli.js', 'exec', '--yes', '--', ...args], {
    stdio: 'inherit',
    env,
  });
}

export function registerExitGuard(child, label, onFailure) {
  child.on('exit', code => {
    if (code !== 0 && code !== null) {
      console.error(`${label}异常退出 (code ${code})`);
      onFailure();
    }
  });
}
