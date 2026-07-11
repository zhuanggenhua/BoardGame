import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
    createReadStream,
    createWriteStream,
    mkdirSync,
    mkdtempSync,
    rmSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

export const SERVER_PUBLISH_MANIFEST_FILE = '.boardgame-publish-manifest.json';
const DEFAULT_SSH_TARGET = 'admin@8.148.71.102';

const waitForProcess = (child, label) => new Promise((resolve, reject) => {
    let stderr = '';
    let stdout = '';

    child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
    });
    child.stdout?.on('data', (chunk) => {
        stdout += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
        if (code === 0) {
            resolve({ stdout, stderr });
            return;
        }
        reject(new Error(`${label} 失败，exit=${code}: ${stderr.trim() || stdout.trim()}`));
    });
});

const normalizeAssetKey = (key) => {
    const normalized = String(key || '').replace(/\\/g, '/').replace(/^\/+/, '');
    const segments = normalized.split('/');
    if (
        !normalized.startsWith('official/')
        || segments.some((segment) => !segment || segment === '.' || segment === '..')
        || normalized.includes('\0')
        || normalized.includes('\n')
        || normalized.includes('\r')
    ) {
        throw new Error(`服务器发布对象 key 非法: ${key}`);
    }
    return normalized;
};

const hashFile = async (filePath) => {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(filePath)) {
        hash.update(chunk);
    }
    return hash.digest('hex');
};

const materializeBody = async (body, targetPath) => {
    const resolvedBody = typeof body === 'function' ? body() : body;
    mkdirSync(path.dirname(targetPath), { recursive: true });

    if (typeof resolvedBody === 'string' || Buffer.isBuffer(resolvedBody) || ArrayBuffer.isView(resolvedBody)) {
        writeFileSync(targetPath, resolvedBody);
        return;
    }
    if (resolvedBody && typeof resolvedBody.pipe === 'function') {
        await pipeline(resolvedBody, createWriteStream(targetPath));
        return;
    }
    throw new Error(`服务器发布对象不支持当前 body 类型: ${typeof resolvedBody}`);
};

export const stagePrimaryAssetUploads = async (uploads) => {
    if (!Array.isArray(uploads) || uploads.length === 0) {
        throw new Error('服务器发布批次不能为空');
    }

    const stagingRoot = mkdtempSync(path.join(tmpdir(), 'boardgame-asset-publish-'));
    const objects = [];
    const seenKeys = new Set();

    try {
        for (const upload of uploads) {
            const key = normalizeAssetKey(upload.key);
            if (seenKeys.has(key)) {
                throw new Error(`服务器发布批次包含重复 key: ${key}`);
            }
            seenKeys.add(key);

            const targetPath = path.join(stagingRoot, ...key.split('/'));
            await materializeBody(upload.body, targetPath);
            const stats = statSync(targetPath);
            if (typeof upload.size === 'number' && upload.size !== stats.size) {
                throw new Error(`服务器发布对象大小不一致: ${key} expected=${upload.size} actual=${stats.size}`);
            }
            objects.push({
                key,
                size: stats.size,
                sha256: await hashFile(targetPath),
                contentType: upload.contentType || 'application/octet-stream',
                cacheControl: upload.cacheControl || '',
            });
        }

        writeFileSync(
            path.join(stagingRoot, SERVER_PUBLISH_MANIFEST_FILE),
            `${JSON.stringify({
                schemaVersion: 1,
                createdAt: new Date().toISOString(),
                objects,
            }, null, 2)}\n`,
        );
        return { stagingRoot, objects };
    } catch (error) {
        rmSync(stagingRoot, { recursive: true, force: true });
        throw error;
    }
};

export const publishStagedAssetsToServer = async ({ stagingRoot }) => {
    const sshTarget = process.env.ASSET_SERVER_SSH_TARGET?.trim() || DEFAULT_SSH_TARGET;
    const sshArgs = [
        '-o', 'BatchMode=yes',
        '-o', 'ConnectTimeout=20',
        '-o', 'ServerAliveInterval=20',
        '-o', 'ServerAliveCountMax=3',
        '-o', 'StrictHostKeyChecking=yes',
    ];
    const privateKeyPath = process.env.ASSET_SERVER_SSH_KEY_PATH?.trim();
    const knownHostsPath = process.env.ASSET_SERVER_SSH_KNOWN_HOSTS_PATH?.trim();
    if (privateKeyPath) {
        sshArgs.push('-o', 'IdentitiesOnly=yes', '-i', privateKeyPath);
    }
    if (knownHostsPath) {
        sshArgs.push('-o', `UserKnownHostsFile=${knownHostsPath}`);
    }
    sshArgs.push(sshTarget, 'boardgame-asset-publish');

    const tarProcess = spawn('tar', ['-C', stagingRoot, '-cf', '-', '.'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
    });
    const sshProcess = spawn('ssh', sshArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
    });
    sshProcess.stdin.on('error', () => {
        // SSH 退出码会提供完整错误；忽略管道提前关闭产生的重复错误。
    });
    tarProcess.stdout.pipe(sshProcess.stdin);

    const [tarResult, sshResult] = await Promise.all([
        waitForProcess(tarProcess, '创建服务器发布归档'),
        waitForProcess(sshProcess, '服务器主源发布'),
    ]);
    if (tarResult.stderr.trim()) {
        console.warn(`[server-primary] tar: ${tarResult.stderr.trim()}`);
    }
    if (sshResult.stdout.trim()) {
        console.log(sshResult.stdout.trim());
    }
    if (sshResult.stderr.trim()) {
        console.warn(`[server-primary] ssh: ${sshResult.stderr.trim()}`);
    }
};

export const publishPrimaryAssetBatch = async (uploads, options = {}) => {
    const staged = await stagePrimaryAssetUploads(uploads);
    const publishServer = options.publishServer || publishStagedAssetsToServer;

    try {
        await publishServer(staged);
        console.log(`serverPrimaryPublish=completed objects=${staged.objects.length}`);
        return {
            serverPublished: true,
            objectCount: staged.objects.length,
        };
    } finally {
        rmSync(staged.stagingRoot, { recursive: true, force: true });
    }
};
