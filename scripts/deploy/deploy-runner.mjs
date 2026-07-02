#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const host = process.env.BG_DEPLOY_RUNNER_HOST || '127.0.0.1';
const port = Number.parseInt(process.env.BG_DEPLOY_RUNNER_PORT || '18761', 10);
const token = process.env.BG_DEPLOY_RUNNER_TOKEN || '';
const allowUnauthenticated = process.env.BG_DEPLOY_RUNNER_ALLOW_UNAUTHENTICATED === '1';
const outputLimit = 200_000;
const deployStepTimeoutMs = readPositiveIntegerEnv('BG_DEPLOY_RUNNER_DEPLOY_STEP_TIMEOUT_SECONDS', 20 * 60) * 1000;
const mobileReleaseStepTimeoutMs = readPositiveIntegerEnv('BG_DEPLOY_RUNNER_MOBILE_STEP_TIMEOUT_SECONDS', 30 * 60) * 1000;
const jobs = new Map();

let activeJobId = null;

if (!token && !allowUnauthenticated) {
    console.error('BG_DEPLOY_RUNNER_TOKEN is required. Set BG_DEPLOY_RUNNER_ALLOW_UNAUTHENTICATED=1 only for local smoke tests.');
    process.exit(1);
}

const server = createServer(async (req, res) => {
    try {
        if (req.method === 'GET' && req.url === '/health') {
            sendJson(res, 200, {
                ok: true,
                activeJobId,
                scriptReady: deployScriptReady(),
                release: mobileReleaseStatus(),
            });
            return;
        }

        if (req.method === 'GET' && req.url?.startsWith('/jobs/')) {
            if (!authorize(req)) {
                sendJson(res, 401, { ok: false, error: 'Unauthorized' });
                return;
            }
            const jobId = decodeURIComponent(req.url.slice('/jobs/'.length));
            const job = jobs.get(jobId);
            if (!job) {
                sendJson(res, 404, { ok: false, error: 'Job not found' });
                return;
            }
            sendJson(res, 200, job);
            return;
        }

        if (req.method === 'POST' && req.url === '/deploy/rollback/preview') {
            if (!authorize(req)) {
                sendJson(res, 401, { ok: false, error: 'Unauthorized' });
                return;
            }
            const body = await readJson(req);
            const args = buildRollbackArgs(body);
            sendJson(res, 200, {
                ok: true,
                mode: 'preview',
                command: buildDeployCommand(args),
                output: 'Deploy runner preview only. No command was executed.',
            });
            return;
        }

        if (req.method === 'POST' && req.url === '/deploy/update/preview') {
            if (!authorize(req)) {
                sendJson(res, 401, { ok: false, error: 'Unauthorized' });
                return;
            }
            const body = await readJson(req);
            const args = buildUpdateArgs(body);
            sendJson(res, 200, {
                ok: true,
                mode: 'preview',
                command: buildDeployCommand(args),
                output: 'Deploy runner preview only. No command was executed.',
            });
            return;
        }

        if (req.method === 'POST' && req.url === '/deploy/update/execute') {
            if (!authorize(req)) {
                sendJson(res, 401, { ok: false, error: 'Unauthorized' });
                return;
            }
            if (!deployScriptReady()) {
                sendJson(res, 503, { ok: false, error: 'Deploy script not found' });
                return;
            }
            if (activeJobId) {
                sendJson(res, 409, { ok: false, error: 'Deploy runner is busy', activeJobId });
                return;
            }

            const body = await readJson(req);
            if (body.confirmText !== '确认部署') {
                sendJson(res, 400, { ok: false, error: 'Confirmation text mismatch' });
                return;
            }

            const args = buildUpdateArgs(body);
            const job = createJob(args);
            runDeployJob(job, args);
            sendJson(res, 202, {
                ok: true,
                mode: 'execute',
                jobId: job.id,
                command: job.command,
                output: 'Deploy update job accepted by independent runner.',
            });
            return;
        }

        if (req.method === 'POST' && req.url === '/deploy/update-and-ota/execute') {
            if (!authorize(req)) {
                sendJson(res, 401, { ok: false, error: 'Unauthorized' });
                return;
            }
            if (!deployScriptReady()) {
                sendJson(res, 503, { ok: false, error: 'Deploy script not found' });
                return;
            }
            if (!mobileReleaseScriptReady()) {
                sendJson(res, 503, { ok: false, error: 'Mobile release script not found' });
                return;
            }
            if (activeJobId) {
                sendJson(res, 409, { ok: false, error: 'Deploy runner is busy', activeJobId });
                return;
            }

            const body = await readJson(req);
            if (body.confirmText !== '确认部署') {
                sendJson(res, 400, { ok: false, error: 'Confirmation text mismatch' });
                return;
            }

            const deployArgs = buildUpdateArgs(body);
            const otaArgs = validateMobileReleaseArgs({ args: body.otaArgs });
            if (otaArgs[0] !== 'ota') {
                sendJson(res, 400, { ok: false, error: 'Only Android OTA release can be chained after deploy update' });
                return;
            }
            const job = createJob(
                deployArgs,
                `${buildDeployCommand(deployArgs)} && ${buildMobileReleaseCommand(otaArgs)}`,
            );
            runDeployAndMobileReleaseJob(job, deployArgs, otaArgs);
            sendJson(res, 202, {
                ok: true,
                mode: 'execute',
                jobId: job.id,
                command: job.command,
                output: 'Deploy update + Android OTA job accepted by independent runner.',
            });
            return;
        }

        if (req.method === 'POST' && req.url === '/mobile-release/android/run') {
            if (!authorize(req)) {
                sendJson(res, 401, { ok: false, error: 'Unauthorized' });
                return;
            }
            if (!mobileReleaseScriptReady()) {
                sendJson(res, 503, { ok: false, error: 'Mobile release script not found' });
                return;
            }
            if (activeJobId) {
                sendJson(res, 409, { ok: false, error: 'Deploy runner is busy', activeJobId });
                return;
            }

            const body = await readJson(req);
            const args = validateMobileReleaseArgs(body);
            const result = await runMobileRelease(args);
            sendJson(res, result.exitCode === 0 ? 200 : 503, {
                ok: result.exitCode === 0,
                mode: args.includes('--dry-run') ? 'dry-run' : 'publish',
                command: ['node', 'scripts/mobile/release-android.mjs', ...args].join(' '),
                output: result.output,
                parsed: parseScriptOutput(result.output),
                exitCode: result.exitCode,
                ...(result.exitCode === 0 ? {} : { error: 'Mobile release failed' }),
            });
            return;
        }

        if (req.method === 'POST' && req.url === '/deploy/rollback/execute') {
            if (!authorize(req)) {
                sendJson(res, 401, { ok: false, error: 'Unauthorized' });
                return;
            }
            if (!deployScriptReady()) {
                sendJson(res, 503, { ok: false, error: 'Deploy script not found' });
                return;
            }
            if (activeJobId) {
                sendJson(res, 409, { ok: false, error: 'Deploy runner is busy', activeJobId });
                return;
            }

            const body = await readJson(req);
            if (body.confirmText !== '确认回滚') {
                sendJson(res, 400, { ok: false, error: 'Confirmation text mismatch' });
                return;
            }

            const args = buildRollbackArgs(body);
            const job = createJob(args);
            runDeployJob(job, args);
            sendJson(res, 202, {
                ok: true,
                mode: 'execute',
                jobId: job.id,
                command: job.command,
                output: 'Deploy rollback job accepted by independent runner.',
            });
            return;
        }

        sendJson(res, 404, { ok: false, error: 'Not found' });
    } catch (error) {
        sendJson(res, 400, {
            ok: false,
            error: error instanceof Error ? error.message : 'Bad request',
        });
    }
});

server.listen(port, host, () => {
    console.log(`Deploy runner listening on http://${host}:${port}`);
});

function authorize(req) {
    if (allowUnauthenticated) return true;
    const provided = readToken(req);
    if (!provided || !token) return false;
    const expectedBuffer = Buffer.from(token);
    const providedBuffer = Buffer.from(provided);
    if (expectedBuffer.length !== providedBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, providedBuffer);
}

function readToken(req) {
    const headerToken = req.headers['x-deploy-runner-token'];
    if (typeof headerToken === 'string') return headerToken;
    const auth = req.headers.authorization;
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
        return auth.slice('Bearer '.length);
    }
    return '';
}

function readJson(req) {
    return new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', (chunk) => {
            raw += chunk.toString('utf8');
            if (raw.length > 16_384) {
                reject(new Error('Request body too large'));
                req.destroy();
            }
        });
        req.on('end', () => {
            if (!raw.trim()) {
                resolve({});
                return;
            }
            try {
                resolve(JSON.parse(raw));
            } catch {
                reject(new Error('Invalid JSON body'));
            }
        });
        req.on('error', reject);
    });
}

function buildRollbackArgs(body) {
    if (!body || typeof body !== 'object') {
        throw new Error('Request body is required');
    }
    if (body.action === 'rollback') {
        const tag = typeof body.tag === 'string' ? body.tag.trim() : '';
        if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(tag)) {
            throw new Error('Valid image tag is required for rollback');
        }
        return ['rollback', tag];
    }
    if (body.action === 'rollback-last') {
        return ['rollback-last'];
    }
    throw new Error('Unsupported rollback action');
}

function buildUpdateArgs(body) {
    if (!body || typeof body !== 'object') {
        throw new Error('Request body is required');
    }
    const mode = typeof body.deployMode === 'string' && body.deployMode.trim()
        ? body.deployMode.trim()
        : 'remote';
    if (!['remote', 'local'].includes(mode)) {
        throw new Error('Invalid deploy mode');
    }
    const deployCommand = mode === 'local' ? 'update-local' : 'update';
    const tag = typeof body.tag === 'string' ? body.tag.trim() : '';
    if (!tag) {
        return [deployCommand];
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(tag)) {
        throw new Error('Invalid image tag');
    }
    return [deployCommand, tag];
}

function createJob(args, command = buildDeployCommand(args)) {
    const now = new Date().toISOString();
    const job = {
        id: randomUUID(),
        ok: true,
        status: 'queued',
        command,
        createdAt: now,
        startedAt: null,
        finishedAt: null,
        exitCode: null,
        output: '',
    };
    jobs.set(job.id, job);
    activeJobId = job.id;
    return job;
}

function runDeployJob(job, args) {
    job.status = 'running';
    job.startedAt = new Date().toISOString();
    runJobProcess(job, 'bash', [deployScriptPath(), ...args], (deployCode) => {
        finishJob(job, deployCode);
    }, {}, {
        label: 'deploy',
        timeoutMs: deployStepTimeoutMs,
    });
}

function runDeployAndMobileReleaseJob(job, deployArgs, mobileArgs) {
    job.status = 'running';
    job.startedAt = new Date().toISOString();
    runJobProcess(job, 'bash', [deployScriptPath(), ...deployArgs], (deployCode) => {
        if (deployCode !== 0) {
            finishJob(job, deployCode);
            return;
        }
        appendJobOutput(job, '\n[deploy-runner] production deploy succeeded; starting Android OTA.\n');
        runJobProcess(job, process.execPath, [mobileReleaseScriptPath(), ...mobileArgs], (otaCode) => {
            finishJob(job, otaCode);
        }, {
            NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=4096',
        }, {
            label: 'Android OTA',
            timeoutMs: mobileReleaseStepTimeoutMs,
        });
    }, {}, {
        label: 'deploy',
        timeoutMs: deployStepTimeoutMs,
    });
}

function runJobProcess(job, command, args, onExit, extraEnv = {}, options = {}) {
    const label = options.label || command;
    const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 0;
    let settled = false;
    let timedOut = false;
    let timeoutId = null;
    let forceKillId = null;
    const child = spawn(command, args, {
        cwd: rootDir,
        env: {
            ...process.env,
            ...extraEnv,
        },
        windowsHide: true,
        detached: process.platform !== 'win32',
    });

    if (timeoutMs > 0) {
        timeoutId = setTimeout(() => {
            timedOut = true;
            appendJobOutput(job, `\n[deploy-runner] ${label} timed out after ${Math.round(timeoutMs / 1000)}s; terminating process tree.\n`);
            terminateProcessTree(child, 'SIGTERM');
            forceKillId = setTimeout(() => {
                terminateProcessTree(child, 'SIGKILL');
            }, 5_000);
        }, timeoutMs);
    }

    child.stdout.on('data', (chunk) => appendJobOutput(job, chunk));
    child.stderr.on('data', (chunk) => appendJobOutput(job, chunk));
    child.on('error', (error) => {
        if (settled) return;
        settled = true;
        clearProcessTimers(timeoutId, forceKillId);
        appendJobOutput(job, `\n${error.message}`);
        onExit(1);
    });
    child.on('exit', (code) => {
        if (settled) return;
        settled = true;
        clearProcessTimers(timeoutId, forceKillId);
        onExit(timedOut ? 124 : (code ?? 1));
    });
}

function clearProcessTimers(timeoutId, forceKillId) {
    if (timeoutId) clearTimeout(timeoutId);
    if (forceKillId) clearTimeout(forceKillId);
}

function terminateProcessTree(child, signal) {
    if (!child.pid) return;
    try {
        if (process.platform === 'win32') {
            child.kill(signal);
            return;
        }
        process.kill(-child.pid, signal);
    } catch {
        try {
            child.kill(signal);
        } catch {
            // Process already exited.
        }
    }
}

function appendJobOutput(job, chunk) {
    job.output += chunk.toString('utf8');
    if (job.output.length > outputLimit) {
        job.output = job.output.slice(job.output.length - outputLimit);
    }
}

function finishJob(job, exitCode) {
    job.exitCode = exitCode ?? 1;
    job.status = job.exitCode === 0 ? 'succeeded' : 'failed';
    job.finishedAt = new Date().toISOString();
    activeJobId = null;
}

function deployScriptPath() {
    return path.join(rootDir, 'scripts/deploy/deploy-image.sh');
}

function deployScriptReady() {
    return existsSync(deployScriptPath());
}

function mobileReleaseScriptPath() {
    return path.join(rootDir, 'scripts/mobile/release-android.mjs');
}

function mobileReleaseScriptReady() {
    return existsSync(mobileReleaseScriptPath());
}

function mobileReleaseStatus() {
    const releaseEnv = readReleaseEnv();
    return {
        script: mobileReleaseScriptReady(),
        nativeScript: existsSync(path.join(rootDir, 'scripts/mobile/publish-android-native-update.mjs')),
        packageScript: existsSync(path.join(rootDir, 'scripts/mobile/publish-android-game-packages.mjs')),
        dist: existsSync(path.join(rootDir, 'dist/android-build-meta.json')),
        releaseApk: existsSync(path.join(rootDir, 'android/app/build/outputs/apk/release/easyboardgame-release.apk')),
        r2Configured: ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME']
            .every((key) => Boolean(releaseEnv[key])),
    };
}

function readReleaseEnv() {
    const env = { ...process.env };
    for (const file of ['.env', '.env.android', '.env.android.local', '.env.example']) {
        const fullPath = path.join(rootDir, file);
        if (!existsSync(fullPath)) continue;
        for (const line of readFileSync(fullPath, 'utf8').split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
            if (!match || env[match[1]]) continue;
            env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
        }
    }
    return env;
}

function validateMobileReleaseArgs(body) {
    if (!body || typeof body !== 'object' || !Array.isArray(body.args)) {
        throw new Error('Mobile release args are required');
    }
    const args = body.args.map((value) => {
        if (typeof value !== 'string' || value.includes('\0') || value.length > 500) {
            throw new Error('Invalid mobile release arg');
        }
        return value;
    });
    const command = args[0];
    if (!['ota', 'native', 'packages'].includes(command)) {
        throw new Error('Unsupported mobile release command');
    }
    return args;
}

function buildMobileReleaseCommand(args) {
    return ['node', 'scripts/mobile/release-android.mjs', ...args].join(' ');
}

function runMobileRelease(args) {
    return new Promise((resolve) => {
        const jobId = randomUUID();
        activeJobId = jobId;
        let output = '';
        const child = spawn(process.execPath, [mobileReleaseScriptPath(), ...args], {
            cwd: rootDir,
            env: {
                ...process.env,
                NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=4096',
            },
            windowsHide: true,
        });
        const append = (chunk) => {
            output += chunk.toString('utf8');
            if (output.length > outputLimit) {
                output = output.slice(output.length - outputLimit);
            }
        };
        child.stdout.on('data', append);
        child.stderr.on('data', append);
        child.on('error', (error) => {
            output += `\n${error.message}`;
            activeJobId = null;
            resolve({ exitCode: 1, output });
        });
        child.on('exit', (code) => {
            activeJobId = null;
            resolve({ exitCode: code ?? 1, output });
        });
    });
}

function parseScriptOutput(output) {
    const parsed = {};
    for (const line of output.split(/\r?\n/)) {
        const match = /^([A-Za-z][A-Za-z0-9]*)=(.*)$/.exec(line.trim());
        if (match) {
            parsed[match[1]] = match[2];
        }
    }
    return parsed;
}

function buildDeployCommand(args) {
    return ['bash', 'scripts/deploy/deploy-image.sh', ...args].join(' ');
}

function readPositiveIntegerEnv(name, fallback) {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
}

function sendJson(res, statusCode, body) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
}
