#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const host = process.env.BG_DEPLOY_RUNNER_HOST || '127.0.0.1';
const port = Number.parseInt(process.env.BG_DEPLOY_RUNNER_PORT || '18761', 10);
const token = process.env.BG_DEPLOY_RUNNER_TOKEN || '';
const allowUnauthenticated = process.env.BG_DEPLOY_RUNNER_ALLOW_UNAUTHENTICATED === '1';
const outputLimit = 200_000;
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

function createJob(args) {
    const now = new Date().toISOString();
    const job = {
        id: randomUUID(),
        ok: true,
        status: 'queued',
        command: buildDeployCommand(args),
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

    const child = spawn('bash', [deployScriptPath(), ...args], {
        cwd: rootDir,
        env: process.env,
        windowsHide: true,
    });

    const append = (chunk) => {
        job.output += chunk.toString('utf8');
        if (job.output.length > outputLimit) {
            job.output = job.output.slice(job.output.length - outputLimit);
        }
    };

    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.on('error', (error) => {
        job.status = 'failed';
        job.exitCode = 1;
        job.finishedAt = new Date().toISOString();
        job.output += `\n${error.message}`;
        activeJobId = null;
    });
    child.on('exit', (code) => {
        job.exitCode = code ?? 1;
        job.status = job.exitCode === 0 ? 'succeeded' : 'failed';
        job.finishedAt = new Date().toISOString();
        activeJobId = null;
    });
}

function deployScriptPath() {
    return path.join(rootDir, 'scripts/deploy/deploy-image.sh');
}

function deployScriptReady() {
    return existsSync(deployScriptPath());
}

function buildDeployCommand(args) {
    return ['bash', 'scripts/deploy/deploy-image.sh', ...args].join(' ');
}

function sendJson(res, statusCode, body) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
}
