import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
    createActiveFingerprint,
    extractAssetReferences,
    isActiveRootKey,
    isPublishableActiveObjectKey,
    resolveActiveAssetSet,
} from './active-server-assets.mjs';

const metadata = (size, modTime = '2026-07-10T00:00:00Z', hash = '') => ({
    size,
    modTime,
    hash,
});

const walkManifestFiles = (root, output = []) => {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
        const fullPath = path.join(root, entry.name);
        if (entry.isDirectory()) {
            walkManifestFiles(fullPath, output);
            continue;
        }
        if (entry.name === 'assets-manifest.json') {
            output.push(fullPath);
        }
    }
    return output;
};

test('识别各平台当前发布清单根节点', () => {
    assert.equal(isActiveRootKey('official/app-updates/android/stable/latest.json'), true);
    assert.equal(isActiveRootKey('official/native-app-updates/android/stable/latest.json'), true);
    assert.equal(isActiveRootKey('official/mobile-packages/android/stable/games/dicethrone.json'), true);
    assert.equal(isActiveRootKey('official/betrayal/assets-manifest.json'), true);
    assert.equal(isActiveRootKey('official/i18n/assets-manifest.json'), true);
    assert.equal(isActiveRootKey('official/mobile-packages/android/stable/manifests/dicethrone/v1.json'), false);
    assert.equal(isActiveRootKey('official/app-updates/android/stable/manifests/v1.json'), false);
});

test('本地素材清单 basePrefix 必须匹配清单所在目录', () => {
    const assetsRoot = path.resolve('public/assets');
    const manifestFiles = walkManifestFiles(assetsRoot);

    assert.ok(manifestFiles.length > 0);
    for (const manifestPath of manifestFiles) {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        const relativeDir = path.relative(assetsRoot, path.dirname(manifestPath)).replace(/\\/g, '/');
        assert.equal(
            manifest.basePrefix,
            `official/${relativeDir}/`,
            path.relative(process.cwd(), manifestPath),
        );
    }
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
                path: 'assets/i18n/zh-CN/dicethrone/cards/compressed/card.webp',
                hash: 'abc',
                size: 123,
            },
        ],
    });

    assert.deepEqual(references, [
        'official/assets/i18n/zh-CN/dicethrone/cards/compressed/card.webp',
    ]);
});

test('分层素材清单会展开 basePrefix 下的所有变体对象', () => {
    const references = extractAssetReferences({
        manifestVersion: 1,
        scope: 'official',
        id: 'betrayal',
        basePrefix: 'official/betrayal/',
        files: {
            'cards/compressed/back-event': {
                variants: {
                    png: { sha256: 'a', bytes: 100, mime: 'image/png' },
                    webp: { sha256: 'b', bytes: 50, mime: 'image/webp' },
                },
            },
        },
    });

    assert.deepEqual(references.sort(), [
        'official/betrayal/cards/compressed/back-event.webp',
    ]);
});

test('服务器活动集合不会把源 PNG/JPG 变体纳入正式 current', () => {
    const references = extractAssetReferences({
        manifestVersion: 1,
        scope: 'official',
        id: 'smashup',
        basePrefix: 'official/smashup/',
        files: {
            'cards/yuanhou': {
                variants: {
                    png: { sha256: 'source-png', bytes: 44480512, mime: 'image/png' },
                },
            },
            'cards/compressed/yuanhou': {
                variants: {
                    webp: { sha256: 'runtime-webp', bytes: 1200000, mime: 'image/webp' },
                },
            },
            'cards/source-photo': {
                variants: {
                    jpg: { sha256: 'source-jpg', bytes: 30000000, mime: 'image/jpeg' },
                },
            },
        },
    });

    assert.deepEqual(references, [
        'official/smashup/cards/compressed/yuanhou.webp',
    ]);
});

test('活动对象只允许压缩媒体和直接运行时对象', () => {
    assert.equal(isPublishableActiveObjectKey('official/game/cards/raw.png'), false);
    assert.equal(isPublishableActiveObjectKey('official/game/cards/raw.jpg'), false);
    assert.equal(isPublishableActiveObjectKey('official/game/cards/raw.jpeg'), false);
    assert.equal(isPublishableActiveObjectKey('official/game/audio/raw.wav'), false);
    assert.equal(isPublishableActiveObjectKey('official/game/audio/raw.mp3'), false);
    assert.equal(isPublishableActiveObjectKey('official/game/cards/card.webp'), false);
    assert.equal(isPublishableActiveObjectKey('official/game/cards/compressed/card.webp'), true);
    assert.equal(isPublishableActiveObjectKey('official/common/audio/compressed/click.ogg'), true);
    assert.equal(isPublishableActiveObjectKey('official/common/images/noise.svg'), true);
    assert.equal(isPublishableActiveObjectKey('official/app-updates/android/stable/bundles/v1.zip'), true);
    assert.equal(isPublishableActiveObjectKey('official/native-app-updates/android/stable/packages/v1.apk'), true);
});

test('清单中的越级和绝对路径不会进入服务器活动集合', () => {
    const references = extractAssetReferences({
        version: '1.0.0',
        files: [
            { path: '../secret.txt', hash: 'a', size: 1 },
            { path: '/etc/passwd', hash: 'b', size: 1 },
            { path: 'assets/compressed/ok.webp', hash: 'c', size: 1 },
        ],
    });

    assert.deepEqual(references, ['official/assets/compressed/ok.webp']);
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
        ['official/assets/i18n/zh-CN/dicethrone/compressed/card.webp', metadata(300)],
        ['official/betrayal/assets-manifest.json', metadata(400)],
        ['official/betrayal/cards/compressed/back-event.webp', metadata(500)],
    ]);
    const json = {
        'official/mobile-packages/android/stable/games/dicethrone.json': {
            fileIndexUrl: 'https://assets.easyboardgame.top/official/mobile-packages/android/stable/file-index/dicethrone/v1.json',
        },
        'official/mobile-packages/android/stable/file-index/dicethrone/v1.json': {
            files: [
                {
                    path: 'assets/i18n/zh-CN/dicethrone/compressed/card.webp',
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
                'cards/compressed/back-event': {
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
        'official/assets/i18n/zh-CN/dicethrone/compressed/card.webp',
        'official/betrayal/assets-manifest.json',
        'official/betrayal/cards/compressed/back-event.webp',
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
