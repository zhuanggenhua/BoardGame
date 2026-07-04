import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const runPublishPlan = (...assetPaths: string[]) => {
    const result = spawnSync(
        process.execPath,
        [
            path.join(process.cwd(), 'scripts', 'assets', 'upload-to-r2.js'),
            '--android-package-publish-plan',
            ...assetPaths,
        ],
        {
            cwd: process.cwd(),
            encoding: 'utf8',
        },
    );

    return {
        status: result.status,
        output: `${result.stdout}\n${result.stderr}`,
    };
};

const walkFiles = (dirPath: string, entries: string[] = []) => {
    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            walkFiles(fullPath, entries);
            continue;
        }
        entries.push(fullPath);
    }
    return entries;
};

const isDiceThronePackagePath = (relativePath: string) => {
    const normalized = relativePath.replace(/\\/g, '/');
    return normalized.startsWith('dicethrone/')
        || normalized.startsWith('atlas-configs/dicethrone/')
        || /^i18n\/[^/]+\/[^/]+\//.test(normalized) && normalized.includes('/dicethrone/');
};

const sourceAssetExtensions = new Set([
    '.png',
    '.jpg',
    '.jpeg',
    '.mp3',
    '.wav',
    '.psd',
    '.ai',
    '.aseprite',
    '.kra',
    '.xcf',
    '.tmp',
    '.bak',
]);

const temporaryAssetNamePattern = /(^|[/._ -])(?:temp|tmp|bak|backup|old|copy|副本|临时|测试|test)([/._ -]|$)/i;
const smashUpPodAtlasRelativePathPattern = /^i18n\/en\/smashup\/(?:cards|pod-assets)\/compressed\/(tts_atlas_[^/]+)\.webp$/;
const legacyDiceThroneEmoteCompressedPaths = new Set([
    'i18n/zh-CN/dicethrone/emotes/barbarian/compressed/thumbs-up-v1.webp',
    'i18n/zh-CN/dicethrone/emotes/moon-elf/compressed/confused-v1.webp',
]);

const getPackageManagedGameIds = () => {
    const gamesRoot = path.join(process.cwd(), 'src', 'games');
    return readdirSync(gamesRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => {
            const manifestPath = path.join(gamesRoot, entry.name, 'manifest.ts');
            if (!existsSync(manifestPath)) return null;
            const content = readFileSync(manifestPath, 'utf8');
            if (!/mode:\s*'package-managed'/.test(content)) return null;
            return content.match(/id:\s*'([^']+)'/)?.[1] ?? null;
        })
        .filter((gameId): gameId is string => Boolean(gameId))
        .sort((left, right) => left.localeCompare(right));
};

const isGamePackagePath = (relativePath: string, gameId: string) => {
    const normalized = relativePath.replace(/\\/g, '/');
    return normalized.startsWith(`${gameId}/`)
        || normalized.startsWith(`atlas-configs/${gameId}/`)
        || /^i18n\/[^/]+\/[^/]+\//.test(normalized) && normalized.includes(`/${gameId}/`);
};

const fileSha256 = (filePath: string) => createHash('sha256')
    .update(readFileSync(filePath))
    .digest('hex');

const getSmashUpPodAtlasRuntimePackagePaths = (() => {
    let cached: Set<string> | null = null;
    return () => {
        if (cached) return cached;

        const englishMapPath = path.join(process.cwd(), 'src', 'games', 'smashup', 'data', 'englishAtlasMap.json');
        const atlasCatalogPath = path.join(process.cwd(), 'src', 'games', 'smashup', 'domain', 'atlasCatalog.ts');
        const englishMap = JSON.parse(readFileSync(englishMapPath, 'utf8')) as Record<string, { atlasId?: string }>;
        const atlasCatalogSource = readFileSync(atlasCatalogPath, 'utf8');
        const overrides = new Map(
            [...atlasCatalogSource.matchAll(/(tts_atlas_[A-Za-z0-9_]+):\s*'smashup\/cards\/([^']+)'/g)]
                .map((match) => [match[1], `smashup/cards/${match[2]}`]),
        );
        const atlasIds = new Set(
            Object.values(englishMap)
                .map((entry) => entry.atlasId)
                .filter((atlasId): atlasId is string => typeof atlasId === 'string' && atlasId.startsWith('tts_atlas_')),
        );

        cached = new Set(
            [...atlasIds].map((atlasId) => {
                const runtimeBasePath = overrides.get(atlasId) ?? `smashup/pod-assets/${atlasId}`;
                const parts = runtimeBasePath.split('/');
                const fileName = parts.pop();
                return `i18n/en/${parts.join('/')}/compressed/${fileName}.webp`;
            }),
        );
        return cached;
    };
})();

const isPublishableSmashUpPodAtlasPath = (relativePath: string) => {
    const normalized = relativePath.replace(/\\/g, '/');
    if (!smashUpPodAtlasRelativePathPattern.test(normalized)) return true;
    return getSmashUpPodAtlasRuntimePackagePaths().has(normalized);
};

const isCompressedDeliveryPath = (relativePath: string, gameId?: string) => {
    const normalized = relativePath.replace(/\\/g, '/');
    const extension = path.extname(normalized).toLowerCase();
    if (sourceAssetExtensions.has(extension) || temporaryAssetNamePattern.test(normalized)) {
        return false;
    }

    if (extension === '.json' || extension === '.svg') {
        return true;
    }

    if (gameId === 'smashup' && !isPublishableSmashUpPodAtlasPath(normalized)) {
        return false;
    }

    const parts = normalized.split('/');
    if (gameId === 'dicethrone' && legacyDiceThroneEmoteCompressedPaths.has(normalized)) {
        return false;
    }

    if (
        parts.includes('compressed')
        && parts.at(-2) === 'compressed'
        && ['人类面板.webp', '手牌.webp', '提示卡.webp', '提示板.webp', '玩家面板.webp', '面板.webp', '骰子.webp'].includes(parts.at(-1) ?? '')
    ) {
        return false;
    }

    return parts.includes('compressed') && (extension === '.webp' || extension === '.ogg');
};

const isSharedAudioPackagePath = (relativePath: string) => {
    const normalized = relativePath.replace(/\\/g, '/');
    const parts = normalized.split('/');
    return normalized.startsWith('common/audio/')
        && path.extname(normalized).toLowerCase() === '.ogg'
        && parts.includes('compressed')
        && !sourceAssetExtensions.has(path.extname(normalized).toLowerCase())
        && !temporaryAssetNamePattern.test(normalized);
};

describe('upload-to-r2 安卓素材包刷新预演', () => {
    it('DiceThrone 游戏资源上传后应只刷新 DiceThrone 差异索引并复用共享音频包', () => {
        const result = runPublishPlan(
            'official/i18n/zh-CN/dicethrone/images/barbarian/compressed/player-board.webp',
            'official/atlas-configs/dicethrone/ability-cards-common.atlas.json',
        );

        expect(result.status).toBe(0);
        expect(result.output).toContain('游戏资源变更: dicethrone');
        expect(result.output).toContain('共享音频变更: 否');
        expect(result.output).toContain('scripts/mobile/publish-android-game-packages.mjs --game dicethrone --reuse-shared-audio --index-manifest-only');
    });

    it('共享音频上传后应刷新共享音频包和全部游戏 manifest', () => {
        const result = runPublishPlan(
            'official/i18n/zh-CN/dicethrone/images/barbarian/compressed/player-board.webp',
            'official/common/audio/sfx/compressed/click.ogg',
        );

        expect(result.status).toBe(0);
        expect(result.output).toContain('游戏资源变更: dicethrone');
        expect(result.output).toContain('共享音频变更: 是');
        expect(result.output).toContain('scripts/mobile/publish-android-game-packages.mjs');
        expect(result.output).not.toContain('--game dicethrone --reuse-shared-audio --index-manifest-only');
    });
});

describe('Android 游戏包素材内容', () => {
    it('所有移动端游戏包候选资源都不应包含源格式或临时文件', () => {
        const assetsRoot = path.join(process.cwd(), 'public', 'assets');
        const allAssetPaths = walkFiles(assetsRoot)
            .map((fullPath) => path.relative(assetsRoot, fullPath).replace(/\\/g, '/'));

        for (const gameId of getPackageManagedGameIds()) {
            const packageFiles = allAssetPaths
                .filter((relativePath) => isGamePackagePath(relativePath, gameId))
                .filter((relativePath) => isCompressedDeliveryPath(relativePath, gameId));

            const blockedFiles = packageFiles.filter((relativePath) => {
                const extension = path.extname(relativePath).toLowerCase();
                return sourceAssetExtensions.has(extension) || temporaryAssetNamePattern.test(relativePath);
            });

            expect(blockedFiles, `${gameId} Android 游戏包不能包含源格式或临时文件`).toEqual([]);
        }
    });

    it('共享音频包候选资源只应包含压缩后的 OGG 媒体文件', () => {
        const assetsRoot = path.join(process.cwd(), 'public', 'assets');
        const sharedAudioPackageFiles = walkFiles(assetsRoot)
            .map((fullPath) => path.relative(assetsRoot, fullPath).replace(/\\/g, '/'))
            .filter(isSharedAudioPackagePath);

        expect(sharedAudioPackageFiles.length).toBeGreaterThan(0);
        expect(sharedAudioPackageFiles.every((relativePath) => relativePath.startsWith('common/audio/'))).toBe(true);
        expect(sharedAudioPackageFiles.every((relativePath) => relativePath.includes('/compressed/'))).toBe(true);
        expect(sharedAudioPackageFiles.every((relativePath) => path.extname(relativePath).toLowerCase() === '.ogg')).toBe(true);
        expect(sharedAudioPackageFiles).not.toContain('common/audio/registry.json');
        expect(sharedAudioPackageFiles).not.toContain('common/audio/phrase-mappings.zh-CN.json');
    });

    it('所有移动端游戏包候选资源如果存在同哈希重复，必须作为待收口风险可见', () => {
        const assetsRoot = path.join(process.cwd(), 'public', 'assets');
        const allAssetPaths = walkFiles(assetsRoot)
            .map((fullPath) => path.relative(assetsRoot, fullPath).replace(/\\/g, '/'));

        const duplicateSummary = getPackageManagedGameIds()
            .map((gameId) => {
                const packageFiles = allAssetPaths
                    .filter((relativePath) => isGamePackagePath(relativePath, gameId))
                    .filter((relativePath) => isCompressedDeliveryPath(relativePath, gameId));
                const rows = packageFiles
                    .filter((relativePath) => /\.(?:webp|ogg|svg|json)$/i.test(relativePath))
                    .map((relativePath) => ({
                        relativePath,
                        hash: fileSha256(path.join(assetsRoot, relativePath)),
                        size: statSync(path.join(assetsRoot, relativePath)).size,
                    }));
                const duplicateGroups = [...Map.groupBy(rows, (row) => row.hash).values()]
                    .filter((group) => group.length > 1);
                const duplicateBytes = duplicateGroups.reduce((sum, group) => (
                    sum + group[0].size * (group.length - 1)
                ), 0);

                return {
                    gameId,
                    duplicateGroups: duplicateGroups.length,
                    duplicateBytes,
                };
            })
            .filter((entry) => entry.duplicateGroups > 0);

        expect(duplicateSummary.map(({ gameId, duplicateGroups }) => ({ gameId, duplicateGroups }))).toEqual([
            { gameId: 'dicethrone', duplicateGroups: 1 },
            { gameId: 'qidahen', duplicateGroups: 1 },
            { gameId: 'smashup', duplicateGroups: 2 },
            { gameId: 'summonerwars', duplicateGroups: 1 },
        ]);
        expect(duplicateSummary.find((entry) => entry.gameId === 'dicethrone')?.duplicateBytes).toBeLessThan(10_000);
        expect(duplicateSummary.find((entry) => entry.gameId === 'qidahen')?.duplicateBytes).toBeGreaterThan(40_000);
        expect(duplicateSummary.find((entry) => entry.gameId === 'smashup')?.duplicateBytes).toBeLessThan(3_000_000);
        expect(duplicateSummary.find((entry) => entry.gameId === 'summonerwars')?.duplicateBytes).toBeGreaterThan(200_000);
    });

    it('SmashUp 游戏包候选资源应只保留运行时会请求的 POD 图集路径', () => {
        const assetsRoot = path.join(process.cwd(), 'public', 'assets');
        const smashUpPackageFiles = walkFiles(assetsRoot)
            .map((fullPath) => path.relative(assetsRoot, fullPath).replace(/\\/g, '/'))
            .filter((relativePath) => isGamePackagePath(relativePath, 'smashup'))
            .filter((relativePath) => isCompressedDeliveryPath(relativePath, 'smashup'));
        const totalBytes = smashUpPackageFiles.reduce((sum, relativePath) => (
            sum + statSync(path.join(assetsRoot, relativePath)).size
        ), 0);

        expect(smashUpPackageFiles.length).toBe(74);
        expect(totalBytes).toBeLessThan(100 * 1024 * 1024);
        expect(smashUpPackageFiles).toContain('i18n/en/smashup/cards/compressed/tts_atlas_0b888d02fd.webp');
        expect(smashUpPackageFiles).toContain('i18n/en/smashup/pod-assets/compressed/tts_atlas_0157978c57.webp');
        expect(smashUpPackageFiles).not.toContain('i18n/en/smashup/cards/compressed/tts_atlas_0157978c57.webp');
        expect(smashUpPackageFiles).not.toContain('i18n/en/smashup/pod-assets/compressed/tts_atlas_0b888d02fd.webp');
    });

    it('DiceThrone 游戏包候选资源不应包含未压缩图片源文件', () => {
        const assetsRoot = path.join(process.cwd(), 'public', 'assets');
        const diceThronePackageFiles = walkFiles(assetsRoot)
            .map((fullPath) => path.relative(assetsRoot, fullPath).replace(/\\/g, '/'))
            .filter(isDiceThronePackagePath)
            .filter((relativePath) => isCompressedDeliveryPath(relativePath, 'dicethrone'));

        const rawImageFiles = diceThronePackageFiles.filter((relativePath) => /\.(?:png|jpe?g)$/i.test(relativePath));
        const totalBytes = diceThronePackageFiles.reduce((sum, relativePath) => {
            return sum + statSync(path.join(assetsRoot, relativePath)).size;
        }, 0);

        expect(diceThronePackageFiles.length).toBe(115);
        expect(rawImageFiles).toEqual([]);
        expect(totalBytes).toBeLessThan(30 * 1024 * 1024);
        expect(diceThronePackageFiles).not.toContain('i18n/zh-CN/dicethrone/emotes/barbarian/compressed/thumbs-up-v1.webp');
        expect(diceThronePackageFiles).toContain('i18n/zh-CN/dicethrone/emotes/barbarian/compressed/thumbs-up-v2.webp');
        expect(diceThronePackageFiles).not.toContain('i18n/zh-CN/dicethrone/emotes/moon-elf/compressed/confused-v1.webp');
        expect(diceThronePackageFiles).toContain('i18n/zh-CN/dicethrone/emotes/moon-elf/compressed/confused-v2.webp');
        expect(diceThronePackageFiles).not.toContain('i18n/zh-CN/dicethrone/images/cursed/compressed/玩家面板.webp');
        expect(diceThronePackageFiles).toContain('i18n/zh-CN/dicethrone/images/cursed/compressed/player-board.webp');
        expect(diceThronePackageFiles).not.toContain('i18n/zh-CN/dicethrone/images/artificial/compressed/手牌.webp');
        expect(diceThronePackageFiles).toContain('i18n/zh-CN/dicethrone/images/artificial/compressed/ability-cards.webp');
    });

    it('DiceThrone 差异索引 dry-run 应输出瘦身后的文件数量', () => {
        const result = spawnSync(
            process.execPath,
            [
                path.join(process.cwd(), 'scripts', 'mobile', 'publish-android-game-packages.mjs'),
                '--channel',
                'stable',
                '--game',
                'dicethrone',
                '--index-manifest-only',
                '--dry-run',
            ],
            {
                cwd: process.cwd(),
                encoding: 'utf8',
                timeout: 120_000,
            },
        );
        const output = `${result.stdout}\n${result.stderr}`;

        expect(result.status).toBe(0);
        expect(output).toContain('游戏 file-index/manifest 差异刷新预演完成（未上传 ZIP）');
        expect(output).toContain('gameId=dicethrone');
        expect(output).toContain('zipBytes=null');
        expect(output).toContain('fileCount=115');
    });
});
