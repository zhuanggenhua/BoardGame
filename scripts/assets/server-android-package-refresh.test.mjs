import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { refreshAndroidPackageIndexesForPublishedAssets } from './server-android-package-refresh.mjs';

const writeFile = (root, relativePath, body) => {
    const fullPath = path.join(root, ...relativePath.split('/'));
    mkdirSync(path.dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, body);
};

const readJson = (root, relativePath) => JSON.parse(
    readFileSync(path.join(root, ...relativePath.split('/')), 'utf8'),
);

const sha256 = (body) => createHash('sha256').update(body).digest('hex');

const createExistingGameManifest = (channel) => ({
    gameId: 'dicethrone',
    runtimeChannel: channel,
    publishedAt: '2026-08-01T00:00:00.000Z',
    modulePack: null,
    assetPack: {
        id: 'dicethrone',
        version: `0.0.0-dicethrone-pkg-full-${channel}`,
        url: `https://assets.example.test/official/mobile-packages/android/${channel}/bundles/dicethrone/full.zip`,
        checksum: `full-checksum-${channel}`,
        bytes: 12345,
        fileCount: 1,
        fileIndexUrl: `https://assets.example.test/official/mobile-packages/android/${channel}/file-index/dicethrone/full.json`,
        fileIndexChecksum: `old-index-${channel}`,
    },
    sharedAudioPack: {
        id: 'common-audio',
        version: `0.0.0-shared-audio-${channel}`,
        url: `https://assets.example.test/official/mobile-packages/android/${channel}/bundles/shared/common-audio/full.zip`,
        checksum: `shared-checksum-${channel}`,
        bytes: 456,
        fileCount: 2,
        fileIndexUrl: `https://assets.example.test/official/mobile-packages/android/${channel}/file-index/shared/common-audio/full.json`,
        fileIndexChecksum: `shared-index-${channel}`,
    },
});

test('服务器素材发布会在同一 release 内刷新已有 channel 的 DiceThrone file-index 和 latest manifest', async () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'boardgame-server-package-refresh-'));
    try {
        const releaseDir = path.join(tempRoot, 'release');
        const diceBody = Buffer.from('dice-v2');
        writeFile(
            releaseDir,
            'official/i18n/zh-CN/dicethrone/images/tianshi/compressed/dice.webp',
            diceBody,
        );
        writeFile(
            releaseDir,
            'official/i18n/zh-CN/dicethrone/images/tianshi/status-icons-atlas.json',
            '{"frames":[]}\n',
        );
        for (const channel of ['stable', 'edge']) {
            writeFile(
                releaseDir,
                `official/mobile-packages/android/${channel}/games/dicethrone.json`,
                `${JSON.stringify(createExistingGameManifest(channel), null, 2)}\n`,
            );
        }

        const result = await refreshAndroidPackageIndexesForPublishedAssets({
            releaseDir,
            publishedKeys: [
                'official/i18n/zh-CN/dicethrone/images/tianshi/compressed/dice.webp',
            ],
            rootDir: process.cwd(),
            assetsBaseUrl: 'https://assets.example.test/official',
            packageVersionBase: '0.0.0-test',
        });

        assert.deepEqual(result.gameIds, ['dicethrone']);
        assert.deepEqual(result.channels, ['edge', 'stable']);
        assert.equal(result.objects.length, 6);

        for (const channel of ['stable', 'edge']) {
            const latestManifest = readJson(
                releaseDir,
                `official/mobile-packages/android/${channel}/games/dicethrone.json`,
            );
            assert.equal(latestManifest.assetPack.diffOnly, true);
            assert.equal(latestManifest.assetPack.url, undefined);
            assert.equal(latestManifest.assetPack.checksum, undefined);
            assert.equal(latestManifest.assetPack.bytes, undefined);
            assert.equal(
                latestManifest.assetPack.fallbackUrl,
                `https://assets.example.test/official/mobile-packages/android/${channel}/bundles/dicethrone/full.zip`,
            );
            assert.equal(latestManifest.assetPack.fallbackVersion, `0.0.0-dicethrone-pkg-full-${channel}`);
            assert.equal(latestManifest.assetPack.fallbackChecksum, `full-checksum-${channel}`);
            assert.equal(latestManifest.sharedAudioPack.version, `0.0.0-shared-audio-${channel}`);

            const fileIndexPath = latestManifest.assetPack.fileIndexUrl
                .replace(`https://assets.example.test/official/`, 'official/');
            assert.ok(existsSync(path.join(releaseDir, ...fileIndexPath.split('/'))));
            const fileIndex = readJson(releaseDir, fileIndexPath);
            const diceEntry = fileIndex.files.find((entry) => (
                entry.path === 'i18n/zh-CN/dicethrone/images/tianshi/compressed/dice.webp'
            ));
            assert.ok(diceEntry);
            assert.equal(diceEntry.hash, sha256(diceBody));
            assert.equal(diceEntry.size, diceBody.byteLength);
            assert.ok(fileIndex.files.some((entry) => (
                entry.path === 'i18n/zh-CN/dicethrone/images/tianshi/status-icons-atlas.json'
            )));
        }
    } finally {
        rmSync(tempRoot, { recursive: true, force: true });
    }
});

test('共享音频上传未接入服务器端自动刷新时必须中断，不能半自动发布', async () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'boardgame-server-package-refresh-'));
    try {
        const releaseDir = path.join(tempRoot, 'release');
        await assert.rejects(
            refreshAndroidPackageIndexesForPublishedAssets({
                releaseDir,
                publishedKeys: ['official/common/audio/sfx/compressed/click.ogg'],
                rootDir: process.cwd(),
                packageVersionBase: '0.0.0-test',
            }),
            /共享音频素材上传尚未接入服务器端自动刷新/,
        );
    } finally {
        rmSync(tempRoot, { recursive: true, force: true });
    }
});
