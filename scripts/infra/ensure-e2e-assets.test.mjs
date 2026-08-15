import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
    ensureE2EAssets,
    hasCompleteLocalE2EAssetPackage,
    resolveE2EAssetGameIds,
} from './ensure-e2e-assets.mjs';

test('明确 e2e/<gameId> 目标自动识别游戏，公共目录不扩大范围', () => {
    assert.deepEqual(
        resolveE2EAssetGameIds('e2e/smashup/smashup-alien-card-images.e2e.ts'),
        ['smashup'],
    );
    assert.deepEqual(resolveE2EAssetGameIds('e2e/_shared/ugc-preview.e2e.ts'), []);
    assert.deepEqual(resolveE2EAssetGameIds('e2e/lobby.e2e.ts'), []);
});

test('显式 PW_ASSET_GAME_IDS 覆盖文件路径推断', () => {
    assert.deepEqual(
        resolveE2EAssetGameIds('e2e/lobby.e2e.ts', { PW_ASSET_GAME_IDS: 'smashup, dicethrone,smashup' }),
        ['smashup', 'dicethrone'],
    );
});

test('--list 和显式跳过开关不会启动下载子进程', () => {
    let spawnCalled = false;
    const runner = () => {
        spawnCalled = true;
        throw new Error('不应下载');
    };

    const listResult = ensureE2EAssets({
        targetPath: 'e2e/smashup/smashup-flow.e2e.ts',
        env: { PW_E2E_LIST_ONLY: 'true' },
        runner,
    });
    assert.deepEqual(listResult, { gameIds: ['smashup'], skipped: true });

    const skippedResult = ensureE2EAssets({
        targetPath: 'e2e/smashup/smashup-flow.e2e.ts',
        env: { PW_SKIP_ASSET_BOOTSTRAP: 'true' },
        runner,
    });
    assert.deepEqual(skippedResult, { gameIds: ['smashup'], skipped: true });
    assert.equal(spawnCalled, false);
});

test('本地素材包完整时可作为 E2E 素材准备真相源', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'boardgame-e2e-assets-'));
    try {
        const assetsRoot = path.join(root, 'assets');
        const gameRoot = path.join(assetsRoot, 'i18n', 'zh-CN', 'dicethrone');
        const atlasRoot = path.join(assetsRoot, 'atlas-configs', 'dicethrone');
        const body = Buffer.from('local asset package');
        const sha256 = createHash('sha256').update(body).digest('hex');

        mkdirSync(path.join(gameRoot, 'images', 'moon_elf'), { recursive: true });
        mkdirSync(atlasRoot, { recursive: true });
        writeFileSync(path.join(gameRoot, 'images', 'moon_elf', 'player-board.png'), body);
        writeFileSync(path.join(gameRoot, 'assets-manifest.json'), JSON.stringify({
            manifestVersion: 1,
            files: {
                'images/moon_elf/player-board': {
                    variants: {
                        png: {
                            sha256,
                            bytes: body.length,
                            mime: 'image/png',
                        },
                    },
                },
            },
        }));
        writeFileSync(path.join(atlasRoot, 'ability-cards-moon_elf.atlas.json'), '{}');

        assert.equal(hasCompleteLocalE2EAssetPackage('dicethrone', { assetsRoot }), true);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test('本地素材包缺文件时不能跳过服务器同步', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'boardgame-e2e-assets-missing-'));
    try {
        const assetsRoot = path.join(root, 'assets');
        const gameRoot = path.join(assetsRoot, 'i18n', 'zh-CN', 'dicethrone');
        const atlasRoot = path.join(assetsRoot, 'atlas-configs', 'dicethrone');

        mkdirSync(gameRoot, { recursive: true });
        mkdirSync(atlasRoot, { recursive: true });
        writeFileSync(path.join(gameRoot, 'assets-manifest.json'), JSON.stringify({
            files: {
                'images/moon_elf/player-board': {
                    variants: {
                        png: {
                            sha256: 'missing',
                            bytes: 1,
                            mime: 'image/png',
                        },
                    },
                },
            },
        }));
        writeFileSync(path.join(atlasRoot, 'ability-cards-moon_elf.atlas.json'), '{}');

        assert.equal(hasCompleteLocalE2EAssetPackage('dicethrone', { assetsRoot }), false);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
