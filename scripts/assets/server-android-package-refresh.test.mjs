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
import { unzipSync } from 'fflate';
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
            /没有可进入 Android 共享音频包的资源/,
        );
    } finally {
        rmSync(tempRoot, { recursive: true, force: true });
    }
});

const createSharedAudioGameManifest = (channel, gameId) => ({
    ...createExistingGameManifest(channel),
    gameId,
    assetPack: {
        ...createExistingGameManifest(channel).assetPack,
        id: gameId,
        version: `0.0.0-${gameId}-full-${channel}`,
    },
});

const seedSharedAudioChannel = (releaseDir, channel, gameIds) => {
    writeFile(
        releaseDir,
        `official/mobile-packages/android/${channel}/shared/common-audio.json`,
        `${JSON.stringify({
            gameId: 'common-audio',
            runtimeChannel: channel,
            assetPack: {
                id: 'common-audio',
                version: `old-shared-${channel}`,
                url: `https://assets.example.test/official/mobile-packages/android/${channel}/bundles/shared/common-audio/old.zip`,
                checksum: `old-${channel}`,
                bytes: 456,
                fileCount: 1,
            },
        }, null, 2)}\n`,
    );
    for (const gameId of gameIds) {
        writeFile(
            releaseDir,
            `official/mobile-packages/android/${channel}/games/${gameId}.json`,
            `${JSON.stringify(createSharedAudioGameManifest(channel, gameId), null, 2)}\n`,
        );
    }
};

test('共享音频刷新从merged release生成完整ZIP和索引，并同步多个channel的游戏manifest', async () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'boardgame-server-shared-audio-refresh-'));
    try {
        const releaseDir = path.join(tempRoot, 'release');
        const oldPath = 'common/audio/sfx/legacy/compressed/retained.ogg';
        writeFile(releaseDir, `official/${oldPath}`, Buffer.from('old audio retained'));
        const changedPaths = [
            'common/audio/sfx/kenney/compressed/footstep_carpet_000.ogg',
            'common/audio/sfx/kenney/compressed/footstep_carpet_001.ogg',
            'common/audio/sfx/kenney/compressed/footstep_concrete_000.ogg',
            'common/audio/sfx/kenney/compressed/footstep_concrete_001.ogg',
            'common/audio/sfx/kenney/compressed/footstep_wood_000.ogg',
            'common/audio/sfx/kenney/compressed/footstep_wood_001.ogg',
        ];
        const bodies = new Map([[oldPath, Buffer.from('old audio retained')]]);
        for (const [index, relativePath] of changedPaths.entries()) {
            const body = Buffer.from(`footstep-${index}`);
            bodies.set(relativePath, body);
            writeFile(releaseDir, `official/${relativePath}`, body);
        }
        for (const channel of ['stable', 'edge']) {
            seedSharedAudioChannel(releaseDir, channel, ['dicethrone', 'smashup']);
        }

        const result = await refreshAndroidPackageIndexesForPublishedAssets({
            releaseDir,
            publishedKeys: changedPaths.map((relativePath) => `official/${relativePath}`),
            rootDir: process.cwd(),
            assetsBaseUrl: 'https://assets.example.test/official',
            packageVersionBase: '0.0.0-test',
        });

        assert.equal(result.hasSharedAudioChanges, true);
        assert.deepEqual(result.channels, ['edge', 'stable']);
        const sharedBundle = result.objects.find((object) => object.key.endsWith('.zip'));
        assert.ok(sharedBundle);
        for (const channel of ['stable', 'edge']) {
            const sharedManifest = readJson(
                releaseDir,
                `official/mobile-packages/android/${channel}/shared/common-audio.json`,
            );
            assert.equal(sharedManifest.assetPack.fileCount, 7);
            assert.equal(sharedManifest.assetPack.version, `0.0.0-test-shared-audio-${sharedManifest.assetPack.checksum.slice(0, 12)}`);
            const fileIndexPath = sharedManifest.assetPack.fileIndexUrl
                .replace('https://assets.example.test/official/', 'official/');
            const fileIndex = readJson(releaseDir, fileIndexPath);
            assert.equal(fileIndex.files.length, 7);
            assert.deepEqual(fileIndex.files.map((entry) => entry.path), [oldPath, ...changedPaths].sort());
            for (const entry of fileIndex.files) {
                assert.equal(entry.hash, sha256(bodies.get(entry.path)));
                assert.equal(entry.size, bodies.get(entry.path).byteLength);
            }

            const bundlePath = sharedManifest.assetPack.url
                .replace('https://assets.example.test/official/', 'official/');
            const bundleEntries = unzipSync(readFileSync(path.join(releaseDir, ...bundlePath.split('/'))));
            assert.deepEqual(Object.keys(bundleEntries).sort(), [oldPath, ...changedPaths].sort());
            for (const [relativePath, body] of bodies) {
                assert.deepEqual(Buffer.from(bundleEntries[relativePath]), body);
            }

            for (const gameId of ['dicethrone', 'smashup']) {
                const latestGameManifest = readJson(
                    releaseDir,
                    `official/mobile-packages/android/${channel}/games/${gameId}.json`,
                );
                assert.equal(latestGameManifest.assetPack.version, `0.0.0-${gameId}-full-${channel}`);
                assert.deepEqual(latestGameManifest.sharedAudioPack, {
                    ...sharedManifest.assetPack,
                });
                const versionedGameManifest = readJson(
                    releaseDir,
                    `official/mobile-packages/android/${channel}/manifests/${gameId}/${encodeURIComponent(latestGameManifest.assetPack.version)}.json`,
                );
                assert.deepEqual(versionedGameManifest.sharedAudioPack, latestGameManifest.sharedAudioPack);
            }
        }
    } finally {
        rmSync(tempRoot, { recursive: true, force: true });
    }
});

test('共享音频同路径更新时索引与完整ZIP使用merged release中的新hash', async () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'boardgame-server-shared-audio-update-'));
    try {
        const releaseDir = path.join(tempRoot, 'release');
        const relativePath = 'common/audio/sfx/kenney/compressed/footstep_carpet_000.ogg';
        writeFile(releaseDir, `official/${relativePath}`, Buffer.from('updated audio bytes'));
        seedSharedAudioChannel(releaseDir, 'stable', ['dicethrone']);

        const result = await refreshAndroidPackageIndexesForPublishedAssets({
            releaseDir,
            publishedKeys: [`official/${relativePath}`],
            rootDir: process.cwd(),
            assetsBaseUrl: 'https://assets.example.test/official',
            packageVersionBase: '0.0.0-test',
        });
        const manifest = readJson(releaseDir, 'official/mobile-packages/android/stable/shared/common-audio.json');
        const fileIndexPath = manifest.assetPack.fileIndexUrl
            .replace('https://assets.example.test/official/', 'official/');
        const fileIndex = readJson(releaseDir, fileIndexPath);
        assert.deepEqual(fileIndex.files, [{
            path: relativePath,
            hash: sha256(Buffer.from('updated audio bytes')),
            size: Buffer.byteLength('updated audio bytes'),
        }]);
        const bundleObject = result.objects.find((object) => object.key.endsWith('.zip'));
        const bundleEntries = unzipSync(readFileSync(path.join(releaseDir, ...bundleObject.key.split('/'))));
        assert.deepEqual(Buffer.from(bundleEntries[relativePath]), Buffer.from('updated audio bytes'));
    } finally {
        rmSync(tempRoot, { recursive: true, force: true });
    }
});

test('无共享音频变更时刷新保持空操作', async () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'boardgame-server-no-audio-change-'));
    try {
        const result = await refreshAndroidPackageIndexesForPublishedAssets({
            releaseDir: path.join(tempRoot, 'release'),
            publishedKeys: [],
            rootDir: process.cwd(),
            packageVersionBase: '0.0.0-test',
        });
        assert.deepEqual(result, {
            gameIds: [],
            channels: [],
            objects: [],
            hasSharedAudioChanges: false,
        });
    } finally {
        rmSync(tempRoot, { recursive: true, force: true });
    }
});
