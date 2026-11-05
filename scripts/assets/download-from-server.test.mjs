import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
    downloadAssetKeys,
    isSharedRuntimeAssetKey,
    loadRuntimeManifestObjects,
    matchesGameAssetKey,
    mergeRuntimeManifestObjects,
    selectAssetKeys,
} from './download-from-server.mjs';

const objects = new Map([
    ['official/smashup/cards/compressed/card.webp', { size: 4, sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08' }],
    ['official/i18n/zh-CN/smashup/cards/compressed/card.webp', { size: 4, sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08' }],
    ['official/atlas-configs/smashup/cards.json', { size: 4, sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08' }],
    ['official/common/images/noise.svg', { size: 4, sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08' }],
    ['official/common/audio/sfx/ui/compressed/not-in-runtime-registry.ogg', { size: 4, sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08' }],
    ['official/i18n/zh-CN/dicethrone/cards/compressed/card.webp', { size: 4, sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08' }],
]);

test('按 gameId 选择游戏根目录、语言目录、atlas 和共享素材', () => {
    assert.equal(matchesGameAssetKey('official/smashup/cards/compressed/card.webp', 'smashup'), true);
    assert.equal(matchesGameAssetKey('official/i18n/zh-CN/smashup/cards/compressed/card.webp', 'smashup'), true);
    assert.equal(matchesGameAssetKey('official/atlas-configs/smashup/cards.json', 'smashup'), true);
    assert.equal(matchesGameAssetKey('official/common/images/noise.svg', 'smashup'), true);
    assert.equal(isSharedRuntimeAssetKey('official/common/images/noise.svg'), true);
    assert.equal(isSharedRuntimeAssetKey('official/common/audio/sfx/ui/compressed/not-in-runtime-registry.ogg'), false);
    assert.equal(matchesGameAssetKey('official/i18n/zh-CN/dicethrone/cards/compressed/card.webp', 'smashup'), false);
    assert.deepEqual(selectAssetKeys(objects, { gameIds: ['smashup'] }), [
        'official/atlas-configs/smashup/cards.json',
        'official/common/images/noise.svg',
        'official/i18n/zh-CN/smashup/cards/compressed/card.webp',
        'official/smashup/cards/compressed/card.webp',
    ]);
});

test('下载按服务器哈希校验，已有文件自动跳过', async () => {
    const assetsDir = mkdtempSync(path.join(tmpdir(), 'boardgame-download-test-'));
    const fetchImpl = async (url) => {
        assert.match(url, /official\/smashup\/cards\/compressed\/card\.webp$/);
        return new Response(Buffer.from('test'), { status: 200 });
    };
    try {
        const first = await downloadAssetKeys({
            objects,
            keys: ['official/smashup/cards/compressed/card.webp'],
            assetsDir,
            fetchImpl,
        });
        assert.deepEqual(first, { selected: 1, downloaded: 1, skipped: 0 });
        assert.equal(readFileSync(path.join(assetsDir, 'smashup/cards/compressed/card.webp'), 'utf8'), 'test');

        const second = await downloadAssetKeys({
            objects,
            keys: ['official/smashup/cards/compressed/card.webp'],
            assetsDir,
            fetchImpl: async () => { throw new Error('不应重复下载'); },
        });
        assert.deepEqual(second, { selected: 1, downloaded: 0, skipped: 1 });
    } finally {
        rmSync(assetsDir, { recursive: true, force: true });
    }
});

test('运行时 manifest 中缺失的 atlas 仍被纳入下载并按 manifest 哈希校验', async () => {
    const assetsDir = mkdtempSync(path.join(tmpdir(), 'boardgame-manifest-download-test-'));
    const atlasBytes = Buffer.from('official atlas');
    const atlasKey = 'official/i18n/zh-CN/fate-domination/cards/compressed/basic-attack-atlas.webp';
    const manifestPath = path.join(assetsDir, 'i18n/zh-CN/fate-domination/assets-manifest.json');
    const localManifest = {
        manifestVersion: 1,
        scope: 'official',
        id: 'fate-domination',
        basePrefix: 'official/i18n/zh-CN/fate-domination/',
        files: {
            'cards/compressed/basic-attack-atlas': {
                variants: {
                    webp: {
                        sha256: createHash('sha256').update(atlasBytes).digest('hex'),
                        bytes: atlasBytes.length,
                        mime: 'image/webp',
                    },
                },
            },
        },
    };
    mkdirSync(path.dirname(manifestPath), { recursive: true });
    writeFileSync(manifestPath, JSON.stringify(localManifest));

    try {
        const manifestObjects = loadRuntimeManifestObjects({
            assetsDir,
            gameIds: ['fate-domination'],
        });
        const merged = mergeRuntimeManifestObjects(new Map(), manifestObjects);
        const keys = selectAssetKeys(merged.objects, { gameIds: ['fate-domination'] });

        assert.deepEqual(merged.inventoryMissing, [atlasKey]);
        assert.deepEqual(keys, [atlasKey]);

        const result = await downloadAssetKeys({
            objects: merged.objects,
            keys,
            assetsDir,
            fetchImpl: async (url) => {
                assert.match(url, /official\/i18n\/zh-CN\/fate-domination\/cards\/compressed\/basic-attack-atlas\.webp$/);
                return new Response(atlasBytes, { status: 200 });
            },
        });

        assert.deepEqual(result, { selected: 1, downloaded: 1, skipped: 0 });
        assert.deepEqual(readFileSync(path.join(assetsDir, 'i18n/zh-CN/fate-domination/cards/compressed/basic-attack-atlas.webp')), atlasBytes);
    } finally {
        rmSync(assetsDir, { recursive: true, force: true });
    }
});
