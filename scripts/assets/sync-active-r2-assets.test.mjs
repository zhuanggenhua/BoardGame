import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createActiveFingerprint,
    extractAssetReferences,
    isActiveRootKey,
    resolveActiveAssetSet,
} from './sync-active-r2-assets.mjs';

const metadata = (size, modTime = '2026-07-10T00:00:00Z', hash = '') => ({
    size,
    modTime,
    hash,
});

test('识别各平台当前发布清单根节点', () => {
    assert.equal(isActiveRootKey('official/app-updates/android/stable/latest.json'), true);
    assert.equal(isActiveRootKey('official/native-app-updates/android/stable/latest.json'), true);
    assert.equal(isActiveRootKey('official/mobile-packages/android/stable/games/dicethrone.json'), true);
    assert.equal(isActiveRootKey('official/betrayal/assets-manifest.json'), true);
    assert.equal(isActiveRootKey('official/i18n/assets-manifest.json'), true);
    assert.equal(isActiveRootKey('official/mobile-packages/android/stable/manifests/dicethrone/v1.json'), false);
    assert.equal(isActiveRootKey('official/app-updates/android/stable/manifests/v1.json'), false);
});

test('递归提取公开资源 URL 和对象 key', () => {
    const references = extractAssetReferences({
        bundleUrl: 'https://assets.easyboardgame.top/official/app-updates/android/stable/bundles/v1.zip',
        nested: {
            fileIndex: 'official/mobile-packages/android/stable/file-index/game/v1.json',
        },
    });
    assert.deepEqual(references, [
        'official/app-updates/android/stable/bundles/v1.zip',
        'official/mobile-packages/android/stable/file-index/game/v1.json',
    ]);
});

test('文件索引中的相对路径会展开为服务器对象 key', () => {
    const references = extractAssetReferences({
        version: '1.0.0',
        files: [
            {
                path: 'assets/i18n/zh-CN/dicethrone/cards/card.webp',
                hash: 'abc',
                size: 123,
            },
        ],
    });

    assert.deepEqual(references, [
        'official/assets/i18n/zh-CN/dicethrone/cards/card.webp',
    ]);
});

test('分层素材清单会展开 basePrefix 下的所有变体对象', () => {
    const references = extractAssetReferences({
        manifestVersion: 1,
        scope: 'official',
        id: 'betrayal',
        basePrefix: 'official/betrayal/',
        files: {
            'cards/back-event': {
                variants: {
                    png: { sha256: 'a', bytes: 100, mime: 'image/png' },
                    webp: { sha256: 'b', bytes: 50, mime: 'image/webp' },
                },
            },
        },
    });

    assert.deepEqual(references.sort(), [
        'official/betrayal/cards/back-event.png',
        'official/betrayal/cards/back-event.webp',
    ]);
});

test('清单中的越级和绝对路径不会进入服务器活动集合', () => {
    const references = extractAssetReferences({
        version: '1.0.0',
        files: [
            { path: '../secret.txt', hash: 'a', size: 1 },
            { path: '/etc/passwd', hash: 'b', size: 1 },
            { path: 'assets/ok.webp', hash: 'c', size: 1 },
        ],
    });

    assert.deepEqual(references, ['official/assets/ok.webp']);
});

test('从当前清单递归得到服务器活动对象集合', async () => {
    const objects = new Map([
        ['official/mobile-packages/android/stable/games/dicethrone.json', metadata(100)],
        ['official/mobile-packages/android/stable/manifests/dicethrone/v1.json', metadata(200)],
        ['official/mobile-packages/android/stable/file-index/dicethrone/v1.json', metadata(300)],
        ['official/mobile-packages/android/stable/bundles/dicethrone/v1.zip', metadata(400)],
        ['official/mobile-packages/android/stable/bundles/dicethrone/old.zip', metadata(500)],
    ]);
    const json = {
        'official/mobile-packages/android/stable/games/dicethrone.json': {
            manifestUrl: 'https://assets.easyboardgame.top/official/mobile-packages/android/stable/manifests/dicethrone/v1.json',
        },
        'official/mobile-packages/android/stable/manifests/dicethrone/v1.json': {
            fileIndexUrl: 'https://assets.easyboardgame.top/official/mobile-packages/android/stable/file-index/dicethrone/v1.json',
            url: 'https://assets.easyboardgame.top/official/mobile-packages/android/stable/bundles/dicethrone/v1.zip',
        },
        'official/mobile-packages/android/stable/file-index/dicethrone/v1.json': {
            files: [],
        },
    };

    const result = await resolveActiveAssetSet({
        objects,
        readJson: async (key) => json[key],
    });

    assert.deepEqual([...result.active].sort(), [
        'official/mobile-packages/android/stable/bundles/dicethrone/v1.zip',
        'official/mobile-packages/android/stable/file-index/dicethrone/v1.json',
        'official/mobile-packages/android/stable/games/dicethrone.json',
        'official/mobile-packages/android/stable/manifests/dicethrone/v1.json',
    ]);
    assert.equal(result.unresolved.size, 0);
});

test('活动集合递归包含文件索引和普通素材清单中的真实对象', async () => {
    const objects = new Map([
        ['official/mobile-packages/android/stable/games/dicethrone.json', metadata(100)],
        ['official/mobile-packages/android/stable/file-index/dicethrone/v1.json', metadata(200)],
        ['official/assets/i18n/zh-CN/dicethrone/card.webp', metadata(300)],
        ['official/betrayal/assets-manifest.json', metadata(400)],
        ['official/betrayal/cards/back-event.webp', metadata(500)],
    ]);
    const json = {
        'official/mobile-packages/android/stable/games/dicethrone.json': {
            fileIndexUrl: 'https://assets.easyboardgame.top/official/mobile-packages/android/stable/file-index/dicethrone/v1.json',
        },
        'official/mobile-packages/android/stable/file-index/dicethrone/v1.json': {
            files: [
                {
                    path: 'assets/i18n/zh-CN/dicethrone/card.webp',
                    hash: 'abc',
                    size: 300,
                },
            ],
        },
        'official/betrayal/assets-manifest.json': {
            manifestVersion: 1,
            scope: 'official',
            id: 'betrayal',
            basePrefix: 'official/betrayal/',
            files: {
                'cards/back-event': {
                    variants: {
                        webp: { sha256: 'def', bytes: 500, mime: 'image/webp' },
                    },
                },
            },
        },
    };

    const result = await resolveActiveAssetSet({
        objects,
        readJson: async (key) => json[key],
    });

    assert.deepEqual([...result.active].sort(), [
        'official/assets/i18n/zh-CN/dicethrone/card.webp',
        'official/betrayal/assets-manifest.json',
        'official/betrayal/cards/back-event.webp',
        'official/mobile-packages/android/stable/file-index/dicethrone/v1.json',
        'official/mobile-packages/android/stable/games/dicethrone.json',
    ]);
    assert.equal(result.unresolved.size, 0);
});

test('对象版本变化会改变活动集合指纹', () => {
    const active = new Set(['official/app-updates/android/stable/latest.json']);
    const first = new Map([
        ['official/app-updates/android/stable/latest.json', metadata(100, '2026-07-10T00:00:00Z')],
    ]);
    const second = new Map([
        ['official/app-updates/android/stable/latest.json', metadata(100, '2026-07-10T00:01:00Z')],
    ]);

    assert.notEqual(
        createActiveFingerprint(active, first),
        createActiveFingerprint(active, second),
    );
});
