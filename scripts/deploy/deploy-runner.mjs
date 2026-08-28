#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import {
    createReadStream,
    createWriteStream,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    realpathSync,
    renameSync,
    rmSync,
    statSync,
    truncateSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { pipeline } from 'node:stream/promises';

const rootDir = process.cwd();
const host = process.env.BG_DEPLOY_RUNNER_HOST || '127.0.0.1';
const port = Number.parseInt(process.env.BG_DEPLOY_RUNNER_PORT || '18761', 10);
const token = process.env.BG_DEPLOY_RUNNER_TOKEN || '';
const assetPublishToken = process.env.BG_ASSET_PUBLISH_TOKEN || token;
const allowUnauthenticated = process.env.BG_DEPLOY_RUNNER_ALLOW_UNAUTHENTICATED === '1';
const assetPublishAllowUnauthenticated = process.env.BG_ASSET_PUBLISH_ALLOW_UNAUTHENTICATED === '1';
const outputLimit = 200_000;
const deployStepTimeoutMs = readPositiveIntegerEnv('BG_DEPLOY_RUNNER_DEPLOY_STEP_TIMEOUT_SECONDS', 30 * 60) * 1000;
const mobileReleaseStepTimeoutMs = readPositiveIntegerEnv('BG_DEPLOY_RUNNER_MOBILE_STEP_TIMEOUT_SECONDS', 30 * 60) * 1000;
const assetPublishMaxUploadBytes = readPositiveIntegerEnv('BG_ASSET_PUBLISH_MAX_UPLOAD_BYTES', 20 * 1024 * 1024 * 1024);
const assetPublishMaxChunkBytes = readPositiveIntegerEnv('BG_ASSET_PUBLISH_MAX_CHUNK_BYTES', 8 * 1024 * 1024);
const assetPublishMaxSessions = readPositiveIntegerEnv('BG_ASSET_PUBLISH_MAX_SESSIONS', 4);
const assetPublishSessionTtlMs = readPositiveIntegerEnv('BG_ASSET_PUBLISH_SESSION_TTL_SECONDS', 60 * 60) * 1000;
const assetPublishMaxSourceBytes = readPositiveIntegerEnv('BG_ASSET_PUBLISH_MAX_SOURCE_BYTES', 2 * 1024 * 1024 * 1024);
const assetPublishSourceWindowMs = readPositiveIntegerEnv('BG_ASSET_PUBLISH_SOURCE_WINDOW_SECONDS', 24 * 60 * 60) * 1000;
const assetPublishAssetsRoot = process.env.BG_ASSET_PUBLISH_ASSETS_ROOT || '/home/admin/storage/assets';
const assetPublishIndexFile = '.boardgame-asset-index.json';
const assetPublishHost = process.env.BG_ASSET_PUBLISH_HOST || host;
const assetPublishPort = Number.parseInt(process.env.BG_ASSET_PUBLISH_PORT || '', 10);
const assetPublishRequiredFiles = [
    { id: 'apply-server-asset-publish', relativePath: 'scripts/assets/apply-server-asset-publish.mjs' },
    { id: 'publish-primary-assets', relativePath: 'scripts/assets/publish-primary-assets.mjs' },
    { id: 'active-server-assets', relativePath: 'scripts/assets/active-server-assets.mjs' },
    { id: 'asset-publish-ownership', relativePath: 'scripts/assets/asset-publish-ownership.mjs' },
    { id: 'release-retention', relativePath: 'scripts/assets/release-retention.mjs' },
    { id: 'server-android-package-refresh', relativePath: 'scripts/assets/server-android-package-refresh.mjs' },
    { id: 'android-assets-base-url', relativePath: 'scripts/mobile/android-assets-base-url.mjs' },
];
const jobs = new Map();
const assetPublishSessions = new Map();
const assetPublishSourceUsage = new Map();
let assetPublishInventoryCache = null;

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
                assetPublish: assetPublishStatus(),
            });
            return;
        }

        if (req.method === 'GET' && req.url === '/asset-publish') {
            await handleAssetPublishInventoryRequest(req, res);
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

        if (req.method === 'POST' && req.url?.startsWith('/asset-publish/chunks/')) {
            await handleAssetPublishChunkRequest(req, res);
            return;
        }

        if (req.method === 'POST' && req.url?.startsWith('/asset-publish/complete/')) {
            await handleAssetPublishCompleteRequest(req, res);
            return;
        }

        if (req.method === 'POST' && req.url === '/asset-publish') {
            await handleAssetPublishRequest(req, res);
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

if (
    Number.isFinite(assetPublishPort)
    && assetPublishPort > 0
    && (assetPublishPort !== port || assetPublishHost !== host)
) {
    const assetServer = createServer(async (req, res) => {
        try {
            if (req.method === 'GET' && req.url === '/health') {
                sendJson(res, 200, {
                    ok: true,
                    activeJobId,
                    assetPublish: assetPublishStatus(),
                });
                return;
            }
            if (req.method === 'GET' && req.url === '/asset-publish') {
                await handleAssetPublishInventoryRequest(req, res);
                return;
            }
            if (req.method === 'POST' && req.url?.startsWith('/asset-publish/chunks/')) {
                await handleAssetPublishChunkRequest(req, res);
                return;
            }
            if (req.method === 'POST' && req.url?.startsWith('/asset-publish/complete/')) {
                await handleAssetPublishCompleteRequest(req, res);
                return;
            }
            if (req.method === 'POST' && req.url === '/asset-publish') {
                await handleAssetPublishRequest(req, res);
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
    assetServer.listen(assetPublishPort, assetPublishHost, () => {
        console.log(`Asset publish runner listening on http://${assetPublishHost}:${assetPublishPort}`);
    });
}

function normalizeSourceValue(value, fallback = '') {
    const text = Array.isArray(value) ? value[0] : value;
    if (typeof text !== 'string') return fallback;
    return text.trim().slice(0, 256) || fallback;
}

function normalizeIpAddress(value) {
    return normalizeSourceValue(value).replace(/^::ffff:/i, '') || 'unknown';
}

function isLoopbackAddress(value) {
    return value === '127.0.0.1' || value === '::1' || value === '0:0:0:0:0:0:0:1';
}

function resolveAssetPublishSource(req) {
    const socketIp = normalizeIpAddress(req.socket?.remoteAddress);
    const forwardedHeader = normalizeSourceValue(req.headers['x-real-ip'])
        || normalizeSourceValue(req.headers['x-forwarded-for']).split(',')[0];
    const forwardedIp = forwardedHeader ? normalizeIpAddress(forwardedHeader) : '';
    const sourceIp = isLoopbackAddress(socketIp) ? (forwardedIp || socketIp) : socketIp;
    return {
        ip: sourceIp || socketIp,
        id: normalizeSourceValue(req.headers['x-asset-publish-source']),
        requestId: normalizeSourceValue(req.headers['x-request-id']) || randomUUID(),
    };
}

function buildAssetPublishContext(source) {
    return {
        sourceIp: source.ip,
        sourceId: source.id,
        requestId: source.requestId,
        anonymous: assetPublishAllowUnauthenticated,
        preserveExistingAssets: assetPublishAllowUnauthenticated,
    };
}

const hashAssetFile = async (filePath) => {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(filePath)) {
        hash.update(chunk);
    }
    return hash.digest('hex');
};

const walkAssetFiles = (root, relativePath = '', output = []) => {
    const directoryPath = relativePath ? path.join(root, relativePath) : root;
    if (!existsSync(directoryPath)) return output;
    for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
        const childRelativePath = relativePath
            ? path.join(relativePath, entry.name)
            : entry.name;
        if (entry.isDirectory()) {
            walkAssetFiles(root, childRelativePath, output);
        } else if (entry.isFile()) {
            output.push(childRelativePath.replace(/\\/g, '/'));
        }
    }
    return output;
};

async function loadAssetPublishInventory() {
    const currentLink = path.join(assetPublishAssetsRoot, 'current');
    if (!existsSync(currentLink)) {
        throw new Error('服务器当前素材 release 不存在');
    }
    const currentRelease = realpathSync(currentLink);
    const releaseId = path.basename(currentRelease);
    if (assetPublishInventoryCache?.releaseId === releaseId) {
        return assetPublishInventoryCache;
    }

    const indexPath = path.join(currentRelease, assetPublishIndexFile);
    let objects = null;
    if (existsSync(indexPath)) {
        try {
            const index = JSON.parse(readFileSync(indexPath, 'utf8'));
            if (index?.schemaVersion === 1 && index.objects && typeof index.objects === 'object') {
                objects = index.objects;
            }
        } catch {
            objects = null;
        }
    }

    if (!objects) {
        objects = {};
        for (const relativePath of walkAssetFiles(currentRelease, 'official')) {
            const filePath = path.join(currentRelease, relativePath);
            objects[relativePath] = {
                size: statSync(filePath).size,
                sha256: await hashAssetFile(filePath),
            };
        }
        const tempIndexPath = `${indexPath}.tmp-${process.pid}`;
        writeFileSync(tempIndexPath, `${JSON.stringify({
            schemaVersion: 1,
            generatedAt: new Date().toISOString(),
            objects,
        })}\n`, { encoding: 'utf8', mode: 0o644 });
        renameSync(tempIndexPath, indexPath);
    }

    assetPublishInventoryCache = { releaseId, objects };
    return assetPublishInventoryCache;
}

async function handleAssetPublishInventoryRequest(req, res) {
    if (!authorizeAssetPublish(req)) {
        sendJson(res, 401, { ok: false, error: 'Unauthorized' });
        return;
    }
    const publishStatus = assetPublishStatus();
    if (!publishStatus.ready) {
        sendAssetPublishNotReady(res, publishStatus);
        return;
    }
    const inventory = await loadAssetPublishInventory();
    sendJson(res, 200, {
        ok: true,
        releaseId: inventory.releaseId,
        objects: Object.entries(inventory.objects).map(([key, object]) => ({
            key,
            size: object.size,
            sha256: object.sha256,
        })),
    });
}

function parseRequestContentLength(value) {
    const contentLength = Number(normalizeSourceValue(value));
    if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
        if (assetPublishAllowUnauthenticated) {
            throw new Error('Asset upload Content-Length is required for anonymous uploads');
        }
        return 0;
    }
    if (contentLength > assetPublishMaxUploadBytes) {
        throw new Error(`Asset upload too large: ${contentLength} > ${assetPublishMaxUploadBytes}`);
    }
    return contentLength;
}

function reserveAssetPublishSourceQuota(sourceIp, bytes) {
    if (!assetPublishAllowUnauthenticated || !bytes) return;
    const now = Date.now();
    const current = assetPublishSourceUsage.get(sourceIp);
    const usage = current && now - current.windowStartedAt < assetPublishSourceWindowMs
        ? current
        : { windowStartedAt: now, bytes: 0 };
    if (usage.bytes + bytes > assetPublishMaxSourceBytes) {
        throw new Error(
            `Asset upload source quota exceeded: source=${sourceIp} `
            + `windowBytes=${usage.bytes} requested=${bytes} limit=${assetPublishMaxSourceBytes}`,
        );
    }
    usage.bytes += bytes;
    assetPublishSourceUsage.set(sourceIp, usage);
}

async function handleAssetPublishRequest(req, res) {
    if (!authorizeAssetPublish(req)) {
        sendJson(res, 401, { ok: false, error: 'Unauthorized' });
        return;
    }
    const publishStatus = assetPublishStatus();
    if (!publishStatus.ready) {
        sendAssetPublishNotReady(res, publishStatus);
        return;
    }
    if (activeJobId) {
        sendJson(res, 409, { ok: false, error: 'Deploy runner is busy', activeJobId });
        return;
    }

    const source = resolveAssetPublishSource(req);
    const totalBytes = parseRequestContentLength(req.headers['content-length']);
    reserveAssetPublishSourceQuota(source.ip, totalBytes);
    const context = buildAssetPublishContext(source);
    const job = createJob([], 'node scripts/assets/apply-server-asset-publish.mjs', {
        assetPublishSource: source,
    });
    try {
        const result = await runAssetPublish(job, req, context);
        finishJob(job, 0);
        sendJson(res, 200, {
            ok: true,
            mode: 'asset-publish',
            jobId: job.id,
            command: job.command,
            output: result.output,
            parsed: parseScriptOutput(result.output),
        });
    } catch (error) {
        appendJobOutput(job, `\n${error instanceof Error ? error.message : String(error)}\n`);
        finishJob(job, 1);
        sendJson(res, 503, {
            ok: false,
            mode: 'asset-publish',
            jobId: job.id,
            command: job.command,
            output: job.output,
            error: error instanceof Error ? error.message : 'Asset publish failed',
        });
    }
}

async function handleAssetPublishChunkRequest(req, res) {
    if (!authorizeAssetPublish(req)) {
        sendJson(res, 401, { ok: false, error: 'Unauthorized' });
        return;
    }
    const publishStatus = assetPublishStatus();
    if (!publishStatus.ready) {
        sendAssetPublishNotReady(res, publishStatus);
        return;
    }

    let session;
    try {
        const sessionId = readAssetPublishSessionId(req.url, 'chunks');
        const range = parseAssetUploadContentRange(req.headers['content-range']);
        if (range.total > assetPublishMaxUploadBytes) {
            throw new Error(`Asset upload exceeds ${assetPublishMaxUploadBytes} byte limit`);
        }
        if (range.length > assetPublishMaxChunkBytes) {
            throw new Error(`Asset upload chunk exceeds ${assetPublishMaxChunkBytes} byte limit`);
        }

        cleanupExpiredAssetPublishSessions();
        session = assetPublishSessions.get(sessionId) || createAssetPublishSession(
            sessionId,
            range.total,
            resolveAssetPublishSource(req),
        );
        if (session.totalBytes !== range.total) {
            throw new Error('Asset upload total size does not match the existing session');
        }
        const duplicate = session.receivedRanges.find((item) => (
            item.start === range.start && item.end === range.end
        ));
        if (duplicate) {
            req.resume();
            await new Promise((resolve, reject) => {
                req.on('end', resolve);
                req.on('error', reject);
            });
            res.writeHead(204);
            res.end();
            return;
        }
        const overlaps = session.receivedRanges.some((item) => (
            range.start <= item.end && range.end >= item.start
        ));
        if (overlaps) {
            throw new Error(`Asset upload range overlaps an existing range: ${range.start}-${range.end}`);
        }

        session.writing += 1;
        const receivedBytes = await writeRequestBodyAtOffset(req, session.archivePath, range.start, {
            maxBytes: assetPublishMaxChunkBytes,
        });
        if (receivedBytes !== range.length) {
            throw new Error(`Asset upload chunk length mismatch: expected=${range.length} actual=${receivedBytes}`);
        }
        session.receivedBytes += receivedBytes;
        session.receivedRanges.push({ start: range.start, end: range.end });
        session.updatedAt = Date.now();
        res.writeHead(204);
        res.end();
    } catch (error) {
        if (session) {
            removeAssetPublishSession(session.id);
        }
        sendJson(res, 400, {
            ok: false,
            error: error instanceof Error ? error.message : 'Asset upload chunk rejected',
        });
    } finally {
        if (session) {
            session.writing = Math.max(0, session.writing - 1);
        }
    }
}

async function handleAssetPublishCompleteRequest(req, res) {
    if (!authorizeAssetPublish(req)) {
        sendJson(res, 401, { ok: false, error: 'Unauthorized' });
        return;
    }
    const publishStatus = assetPublishStatus();
    if (!publishStatus.ready) {
        sendAssetPublishNotReady(res, publishStatus);
        return;
    }

    const sessionId = readAssetPublishSessionId(req.url, 'complete');
    cleanupExpiredAssetPublishSessions();
    const session = assetPublishSessions.get(sessionId);
    if (!session) {
        sendJson(res, 404, { ok: false, error: 'Asset upload session not found' });
        return;
    }
    if (session.writing || activeJobId) {
        sendJson(res, 409, { ok: false, error: 'Deploy runner is busy', activeJobId });
        return;
    }
    if (session.receivedBytes !== session.totalBytes) {
        sendJson(res, 409, {
            ok: false,
            error: 'Asset upload is incomplete',
            receivedBytes: session.receivedBytes,
            totalBytes: session.totalBytes,
        });
        return;
    }

    const job = createJob([], 'node scripts/assets/apply-server-asset-publish.mjs', {
        assetPublishSource: session.source,
    });
    session.writing = true;
    let heartbeatStarted = false;
    const writeHeartbeat = () => {
        if (res.writableEnded) return;
        if (!res.headersSent) {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream; charset=utf-8',
                'Cache-Control': 'no-store',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
            });
            res.flushHeaders?.();
            heartbeatStarted = true;
        }
        res.write(': asset publish in progress\n\n');
    };
    const heartbeat = setInterval(writeHeartbeat, 10_000);
    heartbeat.unref?.();
    const endStream = (result) => {
        res.end(`event: result\ndata: ${JSON.stringify(result)}\n\n`);
    };
    try {
        const result = await runAssetPublishArchive(
            job,
            session.archivePath,
            session.workRoot,
            buildAssetPublishContext(session.source),
        );
        finishJob(job, 0);
        const responseBody = {
            ok: true,
            mode: 'asset-publish',
            jobId: job.id,
            command: job.command,
            output: result.output,
            parsed: parseScriptOutput(result.output),
        };
        if (heartbeatStarted) {
            endStream(responseBody);
        } else {
            sendJson(res, 200, responseBody);
        }
    } catch (error) {
        appendJobOutput(job, `\n${error instanceof Error ? error.message : String(error)}\n`);
        finishJob(job, 1);
        const responseBody = {
            ok: false,
            mode: 'asset-publish',
            jobId: job.id,
            command: job.command,
            output: job.output,
            error: error instanceof Error ? error.message : 'Asset publish failed',
        };
        if (heartbeatStarted) {
            endStream(responseBody);
        } else {
            sendJson(res, 503, responseBody);
        }
    } finally {
        clearInterval(heartbeat);
        assetPublishInventoryCache = null;
        removeAssetPublishSession(session.id);
    }
}

function authorize(req) {
    if (allowUnauthenticated) return true;
    const provided = readToken(req);
    if (!provided || !token) return false;
    const expectedBuffer = Buffer.from(token);
    const providedBuffer = Buffer.from(provided);
    if (expectedBuffer.length !== providedBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, providedBuffer);
}

function authorizeAssetPublish(req) {
    if (assetPublishAllowUnauthenticated) return true;
    const provided = readToken(req);
    const expected = assetPublishToken || token;
    if (!provided || !expected) return false;
    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(provided);
    if (expectedBuffer.length !== providedBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, providedBuffer);
}

function readToken(req) {
    const assetHeaderToken = req.headers['x-asset-publish-token'];
    if (typeof assetHeaderToken === 'string') return assetHeaderToken;
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
    const tag = typeof body.tag === 'string' ? body.tag.trim() : '';
    if (!tag) {
        return ['update'];
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(tag)) {
        throw new Error('Invalid image tag');
    }
    return ['update', tag];
}

function createJob(args, command = buildDeployCommand(args), metadata = {}) {
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
        ...metadata,
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
    }, deployProcessEnv(), {
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
    }, deployProcessEnv(), {
        label: 'deploy',
        timeoutMs: deployStepTimeoutMs,
    });
}

function deployProcessEnv() {
    return {
        COMPOSE_PROGRESS: process.env.COMPOSE_PROGRESS || 'plain',
        DOCKER_CLI_HINTS: process.env.DOCKER_CLI_HINTS || 'false',
    };
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

async function runAssetPublish(job, req, context) {
    const workRoot = mkdtempSync(path.join(tmpdir(), 'boardgame-asset-runner-'));
    const archivePath = path.join(workRoot, 'upload.tar');
    try {
        await writeRequestBody(req, archivePath, { maxBytes: assetPublishMaxUploadBytes });
        return await runAssetPublishArchive(job, archivePath, workRoot, context);
    } finally {
        rmSync(workRoot, { recursive: true, force: true });
    }
}

async function runAssetPublishArchive(job, archivePath, workRoot, context = {}) {
    const stagingRoot = path.join(workRoot, 'staging');
    mkdirSync(stagingRoot, { recursive: true });
    const entriesResult = await runCapturedCommand('tar', ['-tf', archivePath], {
        label: 'list asset archive',
    });
    assertSafeAssetArchiveEntries(entriesResult.output);
    await runCapturedCommand('tar', [
        '--no-same-owner',
        '--no-same-permissions',
        '-xf',
        archivePath,
        '-C',
        stagingRoot,
    ], {
        label: 'extract asset archive',
    });
    const applyArgs = [
        assetPublishScriptPath(),
        '--staging',
        stagingRoot,
        '--assets-root',
        assetPublishAssetsRoot,
    ];
    if (context.preserveExistingAssets) {
        applyArgs.push('--preserve-existing-assets');
    }
    const applyResult = await runCapturedCommand(process.execPath, applyArgs, {
        label: 'apply asset publish',
        env: {
            ASSET_PUBLISH_SOURCE_IP: context.sourceIp || 'unknown',
            ASSET_PUBLISH_SOURCE_ID: context.sourceId || '',
            ASSET_PUBLISH_REQUEST_ID: context.requestId || '',
            ASSET_PUBLISH_ANONYMOUS: context.anonymous ? '1' : '0',
            ASSET_PUBLISH_PRESERVE_EXISTING: context.preserveExistingAssets ? '1' : '0',
        },
    });
    appendJobOutput(job, applyResult.output);
    return applyResult;
}

async function writeRequestBody(req, targetPath, { maxBytes, append = false } = {}) {
    const contentLength = Number(req.headers['content-length']);
    if (Number.isSafeInteger(contentLength) && contentLength > maxBytes) {
        req.resume();
        throw new Error(`Asset upload too large: ${contentLength} > ${maxBytes}`);
    }
    let receivedBytes = 0;
    req.on('data', (chunk) => {
        receivedBytes += chunk.length;
        if (receivedBytes > maxBytes) {
            req.destroy(new Error(`Asset upload too large: ${receivedBytes} > ${maxBytes}`));
        }
    });
    await pipeline(req, createWriteStream(targetPath, { flags: append ? 'a' : 'w' }));
    return receivedBytes;
}

async function writeRequestBodyAtOffset(req, targetPath, start, { maxBytes } = {}) {
    const contentLength = Number(req.headers['content-length']);
    if (Number.isSafeInteger(contentLength) && contentLength > maxBytes) {
        req.resume();
        throw new Error(`Asset upload too large: ${contentLength} > ${maxBytes}`);
    }
    let receivedBytes = 0;
    req.on('data', (chunk) => {
        receivedBytes += chunk.length;
        if (receivedBytes > maxBytes) {
            req.destroy(new Error(`Asset upload too large: ${receivedBytes} > ${maxBytes}`));
        }
    });
    await pipeline(req, createWriteStream(targetPath, { flags: 'r+', start }));
    return receivedBytes;
}

function readAssetPublishSessionId(rawUrl, action) {
    const pathname = new URL(rawUrl, 'http://deploy-runner').pathname;
    const prefix = `/asset-publish/${action}/`;
    if (!pathname.startsWith(prefix)) {
        throw new Error('Asset upload session URL is invalid');
    }
    const sessionId = pathname.slice(prefix.length);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
        throw new Error('Asset upload session ID is invalid');
    }
    return sessionId;
}

function parseAssetUploadContentRange(value) {
    const raw = Array.isArray(value) ? value[0] : value;
    const match = typeof raw === 'string'
        ? raw.match(/^bytes (\d+)-(\d+)\/(\d+)$/)
        : null;
    if (!match) {
        throw new Error('Asset upload Content-Range is invalid');
    }
    const start = Number(match[1]);
    const end = Number(match[2]);
    const total = Number(match[3]);
    if (
        !Number.isSafeInteger(start)
        || !Number.isSafeInteger(end)
        || !Number.isSafeInteger(total)
        || start < 0
        || end < start
        || total <= 0
        || end >= total
    ) {
        throw new Error('Asset upload Content-Range is out of bounds');
    }
    return { start, end, total, length: end - start + 1 };
}

function createAssetPublishSession(id, totalBytes, source) {
    if (assetPublishSessions.size >= assetPublishMaxSessions) {
        throw new Error('Too many active asset upload sessions');
    }
    reserveAssetPublishSourceQuota(source.ip, totalBytes);
    const workRoot = mkdtempSync(path.join(tmpdir(), 'boardgame-asset-session-'));
    const session = {
        id,
        totalBytes,
        source,
        receivedBytes: 0,
        receivedRanges: [],
        workRoot,
        archivePath: path.join(workRoot, 'upload.tar'),
        writing: 0,
        updatedAt: Date.now(),
    };
    writeFileSync(session.archivePath, Buffer.alloc(0));
    truncateSync(session.archivePath, totalBytes);
    assetPublishSessions.set(id, session);
    return session;
}

function removeAssetPublishSession(id) {
    const session = assetPublishSessions.get(id);
    if (!session) return;
    assetPublishSessions.delete(id);
    rmSync(session.workRoot, { recursive: true, force: true });
}

function cleanupExpiredAssetPublishSessions() {
    const now = Date.now();
    for (const session of assetPublishSessions.values()) {
        if (!session.writing && now - session.updatedAt > assetPublishSessionTtlMs) {
            removeAssetPublishSession(session.id);
        }
    }
}

function assertSafeAssetArchiveEntries(output) {
    for (const entry of output.split(/\r?\n/)) {
        if (!entry) continue;
        const normalized = entry.replace(/^\.\//, '');
        if (
            normalized === ''
            || normalized === '.'
            || normalized === 'official'
            || normalized === 'official/'
            || normalized === '.boardgame-publish-manifest.json'
        ) {
            continue;
        }
        if (
            normalized.startsWith('official/')
            && !normalized.includes('\0')
            && !normalized.includes('\\')
            && !`/${normalized}/`.includes('/../')
            && !`/${normalized}/`.includes('/./')
        ) {
            continue;
        }
        throw new Error(`archive entry rejected: ${entry}`);
    }
}

function runCapturedCommand(command, args, options = {}) {
    const label = options.label || command;
    return new Promise((resolve, reject) => {
        let output = '';
        const child = spawn(command, args, {
            cwd: rootDir,
            env: { ...process.env, ...(options.env || {}) },
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
        child.on('error', (error) => reject(error));
        child.on('exit', (code) => {
            if (code === 0) {
                resolve({ exitCode: 0, output });
                return;
            }
            reject(new Error(`${label} failed: exit=${code ?? 'unknown'}\n${output}`));
        });
    });
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
    return {
        script: mobileReleaseScriptReady(),
        nativeScript: existsSync(path.join(rootDir, 'scripts/mobile/publish-android-native-update.mjs')),
        packageScript: existsSync(path.join(rootDir, 'scripts/mobile/publish-android-game-packages.mjs')),
        dist: existsSync(path.join(rootDir, 'dist/android-build-meta.json')),
        releaseApk: existsSync(path.join(rootDir, 'android/app/build/outputs/apk/release/easyboardgame-release.apk')),
        serverAssetsReady: assetPublishStatus().ready,
    };
}

function assetPublishScriptPath() {
    return path.join(rootDir, 'scripts/assets/apply-server-asset-publish.mjs');
}

function assetPublishStatus() {
    const files = assetPublishRequiredFiles.map((entry) => ({
        ...entry,
        exists: existsSync(path.join(rootDir, entry.relativePath)),
    }));
    const missing = files
        .filter((entry) => !entry.exists)
        .map((entry) => entry.relativePath);

    return {
        script: files.find((entry) => entry.id === 'apply-server-asset-publish')?.exists ?? false,
        ready: missing.length === 0,
        files,
        missing,
        assetsRoot: assetPublishAssetsRoot,
        maxUploadBytes: assetPublishMaxUploadBytes,
    };
}

function sendAssetPublishNotReady(res, publishStatus) {
    const suffix = publishStatus.missing.length > 0
        ? `: ${publishStatus.missing.join(', ')}`
        : '';
    sendJson(res, 503, {
        ok: false,
        error: `Asset publish dependencies missing${suffix}`,
        assetPublish: publishStatus,
    });
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
