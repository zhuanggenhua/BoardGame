import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    realpathSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { SERVER_PUBLISH_MANIFEST_FILE } from './publish-primary-assets.mjs';

const writeFile = (root, relativePath, body) => {
    const fullPath = path.join(root, ...relativePath.split('/'));
    mkdirSync(path.dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, body);
    return fullPath;
};

const sha256 = (body) => createHash('sha256').update(body).digest('hex');

test('共享音频刷新失败时保留current及旧文件字节，并清理未激活release', () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'boardgame-asset-publish-atomic-audio-'));
    try {
        const assetsRoot = path.join(tempRoot, 'assets');
        const stagingRoot = path.join(tempRoot, 'staging');
        const releasesRoot = path.join(assetsRoot, 'releases');
        const oldReleaseId = '20260101000000000';
        const oldReleaseDir = path.join(releasesRoot, oldReleaseId);
        mkdirSync(oldReleaseDir, { recursive: true });

        const oldAudioPath = 'official/common/audio/sfx/legacy/compressed/keep.ogg';
        const oldAudioBody = Buffer.from('original server audio');
        const oldSharedManifestPath = 'official/mobile-packages/android/stable/shared/common-audio.json';
        const oldSharedManifestBody = Buffer.from('{"old":"shared manifest"}\n');
        const malformedGameManifestPath = 'official/mobile-packages/android/stable/games/dicethrone.json';
        const malformedGameManifestBody = Buffer.from('{ definitely not valid json\n');
        const oldFiles = new Map([
            [oldAudioPath, oldAudioBody],
            [oldSharedManifestPath, oldSharedManifestBody],
            [malformedGameManifestPath, malformedGameManifestBody],
        ]);
        for (const [relativePath, body] of oldFiles) writeFile(oldReleaseDir, relativePath, body);
        const currentLink = path.join(assetsRoot, 'current');
        symlinkSync(oldReleaseDir, currentLink, 'dir');
        const oldCurrentTarget = realpathSync(currentLink);

        const stagedPaths = [
            'common/audio/sfx/kenney/compressed/footstep_carpet_000.ogg',
            'common/audio/sfx/kenney/compressed/footstep_carpet_001.ogg',
            'common/audio/sfx/kenney/compressed/footstep_concrete_000.ogg',
            'common/audio/sfx/kenney/compressed/footstep_concrete_001.ogg',
            'common/audio/sfx/kenney/compressed/footstep_wood_000.ogg',
            'common/audio/sfx/kenney/compressed/footstep_wood_001.ogg',
        ];
        const objects = [];
        for (const [index, relativePath] of stagedPaths.entries()) {
            const key = `official/${relativePath}`;
            const body = Buffer.from(`new staged audio ${index}`);
            writeFile(stagingRoot, key, body);
            objects.push({ key, size: body.length, sha256: sha256(body) });
        }
        writeFile(
            stagingRoot,
            SERVER_PUBLISH_MANIFEST_FILE,
            `${JSON.stringify({ schemaVersion: 1, objects }, null, 2)}\n`,
        );

        const result = spawnSync(process.execPath, [
            path.join(process.cwd(), 'scripts/assets/apply-server-asset-publish.mjs'),
            '--staging', stagingRoot,
            '--assets-root', assetsRoot,
            '--preserve-existing-assets',
        ], {
            cwd: process.cwd(),
            encoding: 'utf8',
            timeout: 60_000,
        });

        assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
        assert.equal(realpathSync(currentLink), oldCurrentTarget);
        for (const [relativePath, body] of oldFiles) {
            assert.deepEqual(readFileSync(path.join(oldReleaseDir, ...relativePath.split('/'))), body);
        }
        assert.deepEqual(
            readdirSync(releasesRoot).filter((entry) => entry !== oldReleaseId),
            [],
        );
        assert.equal(readdirSync(assetsRoot).some((entry) => entry.startsWith('.current-')), false);
    } finally {
        rmSync(tempRoot, { recursive: true, force: true });
    }
});

test('成功发布返回成功，并从显式项目根刷新发布索引', () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'boardgame-asset-publish-success-'));
    try {
        const assetsRoot = path.join(tempRoot, 'assets');
        const stagingRoot = path.join(tempRoot, 'staging');
        mkdirSync(assetsRoot, { recursive: true });
        const relativeKey = 'official/app-updates/android/stable/6.0.0-ota-test/index.html';
        const body = Buffer.from('<html>ota</html>');
        writeFile(stagingRoot, relativeKey, body);
        writeFile(
            stagingRoot,
            SERVER_PUBLISH_MANIFEST_FILE,
            `${JSON.stringify({
                schemaVersion: 1,
                objects: [{ key: relativeKey, size: body.length, sha256: sha256(body) }],
            })}\n`,
        );

        const scriptPath = path.join(process.cwd(), 'scripts/assets/apply-server-asset-publish.mjs');
        const result = spawnSync(process.execPath, [
            scriptPath,
            '--staging', stagingRoot,
            '--assets-root', assetsRoot,
        ], {
            cwd: tempRoot,
            encoding: 'utf8',
            timeout: 60_000,
            env: {
                ...process.env,
                BG_ASSET_PUBLISH_PROJECT_ROOT: process.cwd(),
            },
        });

        assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
        assert.match(result.stdout, /serverPrimaryIndexObjects=1/);
        const currentRelease = realpathSync(path.join(assetsRoot, 'current'));
        assert.deepEqual(readFileSync(path.join(currentRelease, ...relativeKey.split('/'))), body);
    } finally {
        rmSync(tempRoot, { recursive: true, force: true });
    }
});
