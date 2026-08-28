import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';

const rootDir = process.cwd();
const token = 'asset-upload-test-token';

const reservePort = async () => new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
        const { port } = server.address();
        server.close((error) => error ? reject(error) : resolve(port));
    });
});

const waitForReady = async (baseUrl, child) => {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) {
            throw new Error(`deploy runner exited early: ${child.exitCode}`);
        }
        try {
            const response = await fetch(`${baseUrl}/health`);
            if (response.ok) return;
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('deploy runner did not become ready');
};

const stopRunner = async (child) => {
    if (child.exitCode !== null) return;
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
};

test('健康检查会把素材发布依赖缺失报告为未就绪', async () => {
    const port = await reservePort();
    const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'boardgame-asset-health-'));
    mkdirSync(path.join(fixtureRoot, 'scripts', 'deploy'), { recursive: true });
    mkdirSync(path.join(fixtureRoot, 'scripts', 'assets'), { recursive: true });
    copyFileSync(
        path.join(rootDir, 'scripts', 'deploy', 'deploy-runner.mjs'),
        path.join(fixtureRoot, 'scripts', 'deploy', 'deploy-runner.mjs'),
    );
    writeFileSync(path.join(fixtureRoot, 'scripts', 'deploy', 'deploy-image.sh'), '#!/usr/bin/env bash\n');
    writeFileSync(path.join(fixtureRoot, 'scripts', 'assets', 'apply-server-asset-publish.mjs'), 'console.log("stub");\n');

    const baseUrl = `http://127.0.0.1:${port}`;
    const child = spawn(process.execPath, ['scripts/deploy/deploy-runner.mjs'], {
        cwd: fixtureRoot,
        env: {
            ...process.env,
            BG_DEPLOY_RUNNER_HOST: '127.0.0.1',
            BG_DEPLOY_RUNNER_PORT: String(port),
            BG_DEPLOY_RUNNER_TOKEN: 'deploy-runner-test-token',
            BG_ASSET_PUBLISH_TOKEN: token,
            BG_ASSET_PUBLISH_PORT: '',
        },
        stdio: 'ignore',
    });

    try {
        await waitForReady(baseUrl, child);
        const healthResponse = await fetch(`${baseUrl}/health`);
        assert.equal(healthResponse.status, 200);
        const health = await healthResponse.json();
        assert.equal(health.assetPublish.script, true);
        assert.equal(health.assetPublish.ready, false);
        assert.equal(health.release.serverAssetsReady, false);
        assert.match(
            health.assetPublish.missing.join('\n'),
            /scripts\/assets\/server-android-package-refresh\.mjs/,
        );
        assert.match(
            health.assetPublish.missing.join('\n'),
            /scripts\/mobile\/android-assets-base-url\.mjs/,
        );

        const inventory = await fetch(`${baseUrl}/asset-publish`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(inventory.status, 503);
        const inventoryResult = await inventory.json();
        assert.match(inventoryResult.error, /Asset publish dependencies missing/);
    } finally {
        await stopRunner(child);
        rmSync(fixtureRoot, { recursive: true, force: true });
    }
});

test('分块上传要求专用令牌，并在完成时交给归档校验', async () => {
    const port = await reservePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const child = spawn(process.execPath, ['scripts/deploy/deploy-runner.mjs'], {
        cwd: rootDir,
        env: {
            ...process.env,
            BG_DEPLOY_RUNNER_HOST: '127.0.0.1',
            BG_DEPLOY_RUNNER_PORT: String(port),
            BG_DEPLOY_RUNNER_TOKEN: 'deploy-runner-test-token',
            BG_ASSET_PUBLISH_TOKEN: token,
            BG_ASSET_PUBLISH_PORT: '',
        },
        stdio: 'ignore',
    });

    try {
        await waitForReady(baseUrl, child);
        const uploadId = randomUUID();
        const body = Buffer.from('not a tar archive');
        const chunkUrl = `${baseUrl}/asset-publish/chunks/${uploadId}`;
        const headers = {
            'Content-Range': `bytes 0-${body.length - 1}/${body.length}`,
            'Content-Type': 'application/octet-stream',
        };

        const unauthorized = await fetch(chunkUrl, {
            method: 'POST',
            headers,
            body,
        });
        assert.equal(unauthorized.status, 401);

        const chunk = await fetch(chunkUrl, {
            method: 'POST',
            headers: {
                ...headers,
                Authorization: `Bearer ${token}`,
            },
            body,
        });
        assert.equal(chunk.status, 204);

        const complete = await fetch(`${baseUrl}/asset-publish/complete/${uploadId}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(complete.status, 503);
        const result = await complete.json();
        assert.match(result.error, /list asset archive failed/);
    } finally {
        await stopRunner(child);
    }
});

test('匿名素材入口只放开素材路由并按来源额度限制', async () => {
    const port = await reservePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const child = spawn(process.execPath, ['scripts/deploy/deploy-runner.mjs'], {
        cwd: rootDir,
        env: {
            ...process.env,
            BG_DEPLOY_RUNNER_HOST: '127.0.0.1',
            BG_DEPLOY_RUNNER_PORT: String(port),
            BG_DEPLOY_RUNNER_TOKEN: 'deploy-runner-test-token',
            BG_ASSET_PUBLISH_TOKEN: 'asset-upload-test-token',
            BG_ASSET_PUBLISH_ALLOW_UNAUTHENTICATED: '1',
            BG_ASSET_PUBLISH_MAX_SOURCE_BYTES: '4',
            BG_ASSET_PUBLISH_PORT: '',
        },
        stdio: 'ignore',
    });

    try {
        await waitForReady(baseUrl, child);
        const firstUploadId = randomUUID();
        const firstBody = Buffer.from('abc');
        const firstHeaders = {
            'Content-Range': `bytes 0-${firstBody.length - 1}/${firstBody.length}`,
            'Content-Type': 'application/octet-stream',
        };

        const firstChunk = await fetch(`${baseUrl}/asset-publish/chunks/${firstUploadId}`, {
            method: 'POST',
            headers: firstHeaders,
            body: firstBody,
        });
        assert.equal(firstChunk.status, 204);
        const firstComplete = await fetch(`${baseUrl}/asset-publish/complete/${firstUploadId}`, {
            method: 'POST',
        });
        assert.equal(firstComplete.status, 503);

        const secondUploadId = randomUUID();
        const body = Buffer.from('12');
        const headers = {
            'Content-Range': `bytes 0-${body.length - 1}/${body.length}`,
            'Content-Type': 'application/octet-stream',
        };

        const chunk = await fetch(`${baseUrl}/asset-publish/chunks/${secondUploadId}`, {
            method: 'POST',
            headers,
            body,
        });
        assert.equal(chunk.status, 400);
        const quotaResult = await chunk.json();
        assert.match(quotaResult.error, /source quota exceeded/);

        const deployPreview = await fetch(`${baseUrl}/deploy/update/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
        });
        assert.equal(deployPreview.status, 401);
    } finally {
        await stopRunner(child);
    }
});

test('匿名素材入口可读取当前对象清单用于自动增量上传', async () => {
    const port = await reservePort();
    const assetsRoot = mkdtempSync(path.join(tmpdir(), 'boardgame-asset-inventory-'));
    const currentRoot = path.join(assetsRoot, 'current', 'official', 'common');
    mkdirSync(currentRoot, { recursive: true });
    writeFileSync(path.join(currentRoot, 'test.webp'), 'same');
    const baseUrl = `http://127.0.0.1:${port}`;
    const child = spawn(process.execPath, ['scripts/deploy/deploy-runner.mjs'], {
        cwd: rootDir,
        env: {
            ...process.env,
            BG_DEPLOY_RUNNER_HOST: '127.0.0.1',
            BG_DEPLOY_RUNNER_PORT: String(port),
            BG_DEPLOY_RUNNER_TOKEN: 'deploy-runner-test-token',
            BG_ASSET_PUBLISH_ALLOW_UNAUTHENTICATED: '1',
            BG_ASSET_PUBLISH_ASSETS_ROOT: assetsRoot,
            BG_ASSET_PUBLISH_PORT: '',
        },
        stdio: 'ignore',
    });

    try {
        await waitForReady(baseUrl, child);
        const response = await fetch(`${baseUrl}/asset-publish`);
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.equal(result.ok, true);
        assert.deepEqual(result.objects.map(({ key, size }) => ({ key, size })), [
            { key: 'official/common/test.webp', size: 4 },
        ]);
        assert.match(result.objects[0].sha256, /^[a-f0-9]{64}$/);
    } finally {
        await stopRunner(child);
        rmSync(assetsRoot, { recursive: true, force: true });
    }
});
