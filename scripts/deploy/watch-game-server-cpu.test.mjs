import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import test from 'node:test';

const rootDir = process.cwd();
const watchScript = path.join(rootDir, 'scripts', 'deploy', 'watch-game-server-cpu.sh');
const cpuProfileHelper = path.join(rootDir, 'scripts', 'deploy', 'capture-node-cpu-profile.mjs');
const bashCommand = process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\bash.exe' : 'bash';
const bashPath = (filePath) => process.platform === 'win32' ? filePath.replace(/\\/g, '/') : filePath;

const writeExecutable = (filePath, content) => {
    writeFileSync(filePath, content, { mode: 0o755 });
};

test('持续高 CPU 时必须在重启前保留进程和线程现场', () => {
    if (process.platform === 'win32' && !existsSync('C:\\Program Files\\Git\\bin\\bash.exe')) {
        return;
    }

    const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'boardgame-cpu-watch-'));
    const fakeBin = path.join(fixtureRoot, 'bin');
    const evidenceDir = path.join(fixtureRoot, 'evidence');
    const dockerCommandLog = path.join(fixtureRoot, 'docker-commands.log');
    mkdirSync(fakeBin, { recursive: true });

    writeExecutable(path.join(fakeBin, 'docker'), `#!/usr/bin/env bash
set -eu
printf 'docker %s\\n' "$*" >> "$BG_FAKE_DOCKER_COMMAND_LOG"
case "${'${1:-}'} ${'${2:-}'}" in
  "inspect --format") printf '4242\\n' ;;
  "inspect ") exit 0 ;;
  "stats --no-stream") printf '99.00%% 100MiB / 1GiB 11\\n' ;;
  "ps ") printf 'CONTAINER ID IMAGE COMMAND CREATED STATUS PORTS NAMES\\n' ;;
  "top ") printf 'UID PID PPID C STIME TTY TIME CMD\\nroot 4242 1 99 00:00 ? 00:01 node server.mjs\\n' ;;
  "exec boardgame-game-server") printf '# fake container process snapshot\\nTID=1 CPU=99\\n' ;;
  "restart boardgame-game-server") printf 'boardgame-game-server\\n' ;;
  *) exit 0 ;;
esac
`);
    writeExecutable(path.join(fakeBin, 'curl'), '#!/usr/bin/env bash\nexit 0\n');
    writeExecutable(path.join(fakeBin, 'hostname'), '#!/usr/bin/env bash\nprintf test-host\n');
    writeExecutable(path.join(fakeBin, 'uptime'), '#!/usr/bin/env bash\nprintf uptime\n');
    writeExecutable(path.join(fakeBin, 'free'), '#!/usr/bin/env bash\nprintf free\n');
    writeExecutable(path.join(fakeBin, 'df'), '#!/usr/bin/env bash\nprintf df\n');
    writeExecutable(path.join(fakeBin, 'sleep'), '#!/usr/bin/env bash\nexit 0\n');

    const result = spawnSync(bashCommand, [bashPath(watchScript)], {
        cwd: rootDir,
        encoding: 'utf8',
        env: {
            ...process.env,
            PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ''}`,
            BG_GAME_SERVER_CPU_SAMPLE_COUNT: '1',
            BG_GAME_SERVER_CPU_SAMPLE_INTERVAL_SECONDS: '0',
            BG_GAME_SERVER_CPU_WATCH_RESTART: '1',
            BG_GAME_SERVER_CPU_FEEDBACK: '0',
            BG_GAME_SERVER_CPU_PROFILE_INSPECTOR_PORT: '19229',
            BG_GAME_SERVER_CPU_EVIDENCE_DIR: evidenceDir,
            BG_GAME_SERVER_CPU_HISTORY_LOG: path.join(evidenceDir, 'history.log'),
            BG_GAME_SERVER_CPU_STATE_FILE: path.join(fixtureRoot, 'last-restart'),
            BG_GAME_SERVER_CPU_LOCK_FILE: path.join(fixtureRoot, 'watch.lock'),
            BG_FAKE_DOCKER_COMMAND_LOG: dockerCommandLog,
        },
    });

    try {
        assert.equal(result.status, 0, result.stderr || result.stdout);
        const evidenceFiles = readdirSync(evidenceDir).filter((fileName) => fileName.endsWith('.txt'));
        assert.deepEqual(evidenceFiles.length, 1, `expected one evidence file, got: ${evidenceFiles.join(', ')}`);
        const evidenceFile = path.join(evidenceDir, evidenceFiles[0]);
        const evidence = readFileSync(evidenceFile, 'utf8');
        assert.match(evidence, /# high CPU root-cause evidence/);
        assert.match(evidence, /## host thread snapshot/);
        assert.match(evidence, /## container process snapshot/);
        assert.match(evidence, /cpuProfileStatus=captured/);
        assert.match(evidence, /profileCaptureStartedAt=\d{4}-\d\d-\d\dT/);
        assert.match(evidence, /profileCaptureFinishedAt=\d{4}-\d\d-\d\dT/);
        assert.match(evidence, /cpuProfileFile=.*\.cpuprofile/);
        assert.match(evidence, /profileInspectorPort=9229/);
        assert.match(evidence, /fake container process snapshot/);
        assert.match(evidence, /# decision/);
        const commandLog = readFileSync(dockerCommandLog, 'utf8');
        assert.ok(
            commandLog.indexOf('docker exec boardgame-game-server') < commandLog.indexOf('docker restart boardgame-game-server'),
            commandLog,
        );
        assert.ok(
            commandLog.indexOf('docker cp boardgame-game-server:/tmp/boardgame-cpu-profile-') < commandLog.indexOf('docker restart boardgame-game-server'),
            commandLog,
        );
    } finally {
        rmSync(fixtureRoot, { recursive: true, force: true });
    }
});

test('高 CPU 但未执行重启时不打开临时 Inspector', () => {
    if (process.platform === 'win32' && !existsSync('C:\\Program Files\\Git\\bin\\bash.exe')) {
        return;
    }

    const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'boardgame-cpu-watch-dry-run-'));
    const fakeBin = path.join(fixtureRoot, 'bin');
    const evidenceDir = path.join(fixtureRoot, 'evidence');
    const dockerCommandLog = path.join(fixtureRoot, 'docker-commands.log');
    mkdirSync(fakeBin, { recursive: true });
    writeExecutable(path.join(fakeBin, 'docker'), `#!/usr/bin/env bash
set -eu
printf 'docker %s\\n' "$*" >> "$BG_FAKE_DOCKER_COMMAND_LOG"
case "${'${1:-}'} ${'${2:-}'}" in
  "inspect ") exit 0 ;;
  "stats --no-stream") printf '99.00%% 100MiB / 1GiB 11\\n' ;;
  *) exit 0 ;;
esac
`);
    writeExecutable(path.join(fakeBin, 'uptime'), '#!/usr/bin/env bash\nexit 0\n');
    writeExecutable(path.join(fakeBin, 'free'), '#!/usr/bin/env bash\nexit 0\n');
    writeExecutable(path.join(fakeBin, 'df'), '#!/usr/bin/env bash\nexit 0\n');

    const result = spawnSync(bashCommand, [bashPath(watchScript)], {
        cwd: rootDir,
        encoding: 'utf8',
        env: {
            ...process.env,
            PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ''}`,
            BG_GAME_SERVER_CPU_SAMPLE_COUNT: '1',
            BG_GAME_SERVER_CPU_SAMPLE_INTERVAL_SECONDS: '0',
            BG_GAME_SERVER_CPU_WATCH_RESTART: '0',
            BG_GAME_SERVER_CPU_FEEDBACK: '0',
            BG_GAME_SERVER_CPU_EVIDENCE_DIR: evidenceDir,
            BG_GAME_SERVER_CPU_HISTORY_LOG: path.join(evidenceDir, 'history.log'),
            BG_GAME_SERVER_CPU_STATE_FILE: path.join(fixtureRoot, 'last-restart'),
            BG_GAME_SERVER_CPU_LOCK_FILE: path.join(fixtureRoot, 'watch.lock'),
            BG_FAKE_DOCKER_COMMAND_LOG: dockerCommandLog,
        },
    });

    try {
        assert.equal(result.status, 2, result.stderr || result.stdout);
        const commandLog = readFileSync(dockerCommandLog, 'utf8');
        assert.doesNotMatch(commandLog, /docker cp /);
        assert.doesNotMatch(commandLog, /docker restart /);
    } finally {
        rmSync(fixtureRoot, { recursive: true, force: true });
    }
});

test('Node CPU 采样工具能通过仅本机 Inspector 写出可读 profile', async () => {
    const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'boardgame-cpu-profile-'));
    const inspectorPort = 19000 + Math.floor(Math.random() * 1000);
    const outputFile = path.join(fixtureRoot, 'profile.cpuprofile');
    const target = spawn(process.execPath, [
        `--inspect=127.0.0.1:${inspectorPort}`,
        '-e',
        'setInterval(() => { for (let i = 0; i < 200000; i += 1) Math.sqrt(i); }, 1);',
    ], { stdio: ['ignore', 'ignore', 'pipe'] });

    try {
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Inspector did not start')), 5_000);
            target.stderr.on('data', (chunk) => {
                if (String(chunk).includes('Debugger listening')) {
                    clearTimeout(timeout);
                    resolve();
                }
            });
            target.once('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
            target.once('exit', (code) => {
                clearTimeout(timeout);
                reject(new Error(`Inspector target exited early: ${code}`));
            });
        });

        const result = await new Promise((resolve, reject) => {
            const child = spawn(process.execPath, [cpuProfileHelper,
                '--inspector-port', String(inspectorPort),
                '--duration-ms', '100',
                '--output', outputFile,
            ], { stdio: 'pipe' });
            let stderr = '';
            child.stderr.on('data', (chunk) => { stderr += String(chunk); });
            child.once('error', reject);
            child.once('exit', (code) => resolve({ code, stderr }));
        });

        assert.equal(result.code, 0, result.stderr);
        const profile = JSON.parse(readFileSync(outputFile, 'utf8'));
        assert.ok(Array.isArray(profile.nodes));
        assert.ok(profile.nodes.length > 0);
    } finally {
        target.kill('SIGTERM');
        rmSync(fixtureRoot, { recursive: true, force: true });
    }
});
