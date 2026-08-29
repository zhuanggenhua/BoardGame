import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const runPublishPlan = (...assetPaths: string[]) => {
    const result = spawnSync(
        process.execPath,
        [
            path.join(process.cwd(), 'scripts', 'assets', 'upload-to-server.js'),
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

const runUploadCheck = (...args: string[]) => {
    const result = spawnSync(
        process.execPath,
        [
            path.join(process.cwd(), 'scripts', 'assets', 'upload-to-server.js'),
            '--check',
            ...args,
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

const createNpmUploadLifecycleEnv = () => {
    const env = { ...process.env };
    for (const key of Object.keys(env)) {
        if (key.toLowerCase() === 'npm_lifecycle_event') {
            delete env[key];
        }
    }
    env.npm_lifecycle_event = 'assets:upload';
    return env;
};

const createNpmMobilePackagesLifecycleEnv = (configs: Record<string, string>) => {
    const env = { ...process.env };
    for (const key of Object.keys(env)) {
        const normalizedKey = key.toLowerCase();
        if (
            normalizedKey === 'npm_lifecycle_event'
            || normalizedKey === 'npm_config_channel'
            || normalizedKey === 'npm_config_game'
            || normalizedKey === 'npm_config_dry_run'
            || normalizedKey === 'npm_config_index_manifest_only'
            || normalizedKey === 'npm_config_reuse_shared_audio'
        ) {
            delete env[key];
        }
    }
    env.npm_lifecycle_event = 'mobile:android:packages:publish';
    for (const [key, value] of Object.entries(configs)) {
        env[`npm_config_${key}`] = value;
    }
    return env;
};

const runUploadFromNpmLifecycle = (...args: string[]) => {
    const result = spawnSync(
        process.execPath,
        [
            path.join(process.cwd(), 'scripts', 'assets', 'upload-to-server.js'),
            ...args,
        ],
        {
            cwd: process.cwd(),
            encoding: 'utf8',
            env: createNpmUploadLifecycleEnv(),
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
const smashUpEnglishAtlasRelativePathPattern = /^i18n\/en\/smashup\/(?:base|cards|pod-assets|taitan)\/compressed\/[^/]+\.webp$/;
const smashUpZhCnAtlasRelativePathPattern = /^i18n\/zh-CN\/smashup\/(?:base|cards|taitan)(?:\/[^/]+)?\/compressed\/[^/]+\.webp$/;
const smashUpZhCnAndroidPackageAtlasPaths = new Set([
    'i18n/zh-CN/smashup/cards/compressed/longzu.webp',
]);
const legacyDiceThroneEmoteCompressedPaths = new Set([
    'i18n/zh-CN/dicethrone/emotes/barbarian/compressed/thumbs-up-v1.webp',
    'i18n/zh-CN/dicethrone/emotes/moon-elf/compressed/confused-v1.webp',
]);
const nonRuntimeDiceThroneCompressedPaths = new Set([
    'i18n/zh-CN/dicethrone/images/tianshi/compressed/cards.webp',
]);
const diceThronePublicCropPathPattern = /(?:^|\/)dicethrone\/images\/[^/]+\/crops\//;
const legacySmashUpAtlasConfigPaths = new Set([
    'atlas-configs/smashup/2833984701.json',
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
    if (
        gameId === 'smashup'
        && !(normalized.startsWith(`atlas-configs/${gameId}/`)
            || /^i18n\/[^/]+\/[^/]+\//.test(normalized) && normalized.includes(`/${gameId}/`))
    ) {
        return false;
    }
    return normalized.startsWith(`${gameId}/`)
        || normalized.startsWith(`atlas-configs/${gameId}/`)
        || /^i18n\/[^/]+\/[^/]+\//.test(normalized) && normalized.includes(`/${gameId}/`);
};

const fileSha256 = (filePath: string) => createHash('sha256')
    .update(readFileSync(filePath))
    .digest('hex');

type AssetMetadata = {
    hash: string;
    size: number;
};

const getAssetCatalog = (() => {
    let cached: {
        assetsRoot: string;
        allAssetPaths: string[];
        physicalAssetPaths: string[];
        getMetadata: (relativePath: string) => AssetMetadata;
    } | null = null;

    return () => {
        if (cached) return cached;

        const assetsRoot = path.join(process.cwd(), 'public', 'assets');
        const physicalAssetPaths = walkFiles(assetsRoot)
            .map((fullPath) => path.relative(assetsRoot, fullPath).replace(/\\/g, '/'));
        const manifestMetadata = new Map<string, AssetMetadata>();

        for (const entry of readdirSync(assetsRoot, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;

            const manifestPath = path.join(assetsRoot, entry.name, 'assets-manifest.json');
            if (!existsSync(manifestPath)) continue;

            const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
                files?: Record<string, {
                    variants?: Record<string, {
                        sha256?: string;
                        bytes?: number;
                    }>;
                }>;
            };

            for (const [assetPath, assetEntry] of Object.entries(manifest.files ?? {})) {
                for (const [extension, variant] of Object.entries(assetEntry.variants ?? {})) {
                    if (typeof variant.sha256 !== 'string' || typeof variant.bytes !== 'number') continue;

                    manifestMetadata.set(
                        path.posix.join(entry.name, `${assetPath}.${extension}`),
                        {
                            hash: variant.sha256,
                            size: variant.bytes,
                        },
                    );
                }
            }
        }

        cached = {
            assetsRoot,
            physicalAssetPaths,
            allAssetPaths: [...new Set([
                ...physicalAssetPaths,
                ...manifestMetadata.keys(),
            ])].sort((left, right) => left.localeCompare(right)),
            getMetadata: (relativePath) => manifestMetadata.get(relativePath) ?? {
                hash: fileSha256(path.join(assetsRoot, relativePath)),
                size: statSync(path.join(assetsRoot, relativePath)).size,
            },
        };
        return cached;
    };
})();

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

const isPublishableSmashUpAtlasPath = (relativePath: string) => {
    const normalized = relativePath.replace(/\\/g, '/');
    if (smashUpEnglishAtlasRelativePathPattern.test(normalized)) {
        return getSmashUpPodAtlasRuntimePackagePaths().has(normalized);
    }
    if (smashUpZhCnAtlasRelativePathPattern.test(normalized)) {
        return smashUpZhCnAndroidPackageAtlasPaths.has(normalized) || normalized.endsWith('_pod.webp');
    }
    return true;
};

const isCompressedDeliveryPath = (relativePath: string, gameId?: string) => {
    const normalized = relativePath.replace(/\\/g, '/');
    const extension = path.extname(normalized).toLowerCase();
    if (sourceAssetExtensions.has(extension) || temporaryAssetNamePattern.test(normalized)) {
        return false;
    }

    if (gameId === 'smashup' && legacySmashUpAtlasConfigPaths.has(normalized)) {
        return false;
    }

    if (
        gameId === 'dicethrone'
        && (nonRuntimeDiceThroneCompressedPaths.has(normalized) || diceThronePublicCropPathPattern.test(normalized))
    ) {
        return false;
    }

    if (extension === '.json' || extension === '.svg') {
        return true;
    }

    if (gameId === 'smashup' && !isPublishableSmashUpAtlasPath(normalized)) {
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

const toSharedAudioPackagePath = (src: string) => {
    const normalized = src.replace(/\\/g, '/').replace(/^\/+/, '');
    const lastSlash = normalized.lastIndexOf('/');
    const dir = lastSlash >= 0 ? normalized.slice(0, lastSlash) : '';
    const filename = lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
    return `common/audio/${dir ? `${dir}/` : ''}compressed/${filename}`;
};

const collectPackageManagedBgmKeys = () => {
    const gamesRoot = path.join(process.cwd(), 'src', 'games');
    const rows: Array<{ gameId: string; key: string }> = [];

    for (const entry of readdirSync(gamesRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const manifestPath = path.join(gamesRoot, entry.name, 'manifest.ts');
        const audioConfigPath = path.join(gamesRoot, entry.name, 'audio.config.ts');
        if (!existsSync(manifestPath) || !existsSync(audioConfigPath)) continue;

        const manifest = readFileSync(manifestPath, 'utf8');
        if (!/mode:\s*'package-managed'/.test(manifest)) continue;

        const audioConfig = readFileSync(audioConfigPath, 'utf8');
        const keys = [...new Set(
            [...audioConfig.matchAll(/['"`](bgm\.[^'"`]+)['"`]/g)]
                .map((match) => match[1]),
        )].sort((left, right) => left.localeCompare(right));

        for (const key of keys) {
            rows.push({ gameId: entry.name, key });
        }
    }

    return rows.sort((left, right) => (
        left.gameId.localeCompare(right.gameId) || left.key.localeCompare(right.key)
    ));
};

describe('upload-to-server 安卓素材包刷新预演', () => {
    it('DiceThrone 游戏资源上传后应只刷新 DiceThrone 差异索引并复用共享音频包', () => {
        const result = runPublishPlan(
            'official/i18n/zh-CN/dicethrone/images/barbarian/compressed/player-board.webp',
            'official/atlas-configs/dicethrone/ability-cards-common.atlas.json',
        );

        expect(result.status).toBe(0);
        expect(result.output).toContain('游戏资源变更: dicethrone');
        expect(result.output).toContain('共享音频变更: 否');
        expect(result.output).toContain('服务器自动刷新: 发布入口会在服务器 release 内刷新已有 channel 的 file-index/manifest/games latest');
        expect(result.output).not.toContain('scripts/mobile/publish-android-game-packages.mjs');
    });

    it('共享音频上传后应刷新共享音频包和全部游戏 manifest', () => {
        const result = runPublishPlan(
            'official/i18n/zh-CN/dicethrone/images/barbarian/compressed/player-board.webp',
            'official/common/audio/sfx/compressed/click.ogg',
        );

        expect(result.status).toBe(0);
        expect(result.output).toContain('游戏资源变更: dicethrone');
        expect(result.output).toContain('共享音频变更: 是');
        expect(result.output).toContain('服务器自动刷新: 共享音频暂未接入自动刷新，正式发布会中断并要求走共享音频发布流程');
        expect(result.output).not.toContain('scripts/mobile/publish-android-game-packages.mjs');
    });
});

describe('upload-to-server 路径过滤', () => {
    it('文件名前缀不带扩展名时仍应命中同名压缩运行时资源', () => {
        const result = runUploadCheck(
            '--asset-prefix',
            'i18n/zh-CN/smashup/cards/compressed/marvel_villains',
        );

        expect(result.status).toBe(0);
        expect(result.output).toContain('待发布: official/i18n/zh-CN/smashup/cards/compressed/marvel_villains.webp');
        expect(result.output).toContain('检查完成：待发布 1 个对象');
    });

    it('裸路径参数应作为路径过滤处理，避免 npm 参数转发异常时变成全量发布', () => {
        const result = runUploadCheck(
            'i18n/zh-CN/smashup/cards/compressed/marvel_villains',
        );

        expect(result.status).toBe(0);
        expect(result.output).toContain('路径过滤：i18n/zh-CN/smashup/cards/compressed/marvel_villains');
        expect(result.output).toContain('待发布: official/i18n/zh-CN/smashup/cards/compressed/marvel_villains.webp');
        expect(result.output).toContain('检查完成：待发布 1 个对象');
    });

    it('带路径过滤但没有可发布对象时应失败，避免误以为已经上传', () => {
        const result = runUploadCheck(
            '--asset-prefix',
            'i18n/zh-CN/smashup/cards/compressed/not-a-real-card-atlas',
        );

        expect(result.status).not.toBe(0);
        expect(result.output).toContain('路径过滤没有匹配到可发布对象');
    });

    it('裸路径参数没有可发布对象时应失败，避免回退成全量发布', () => {
        const result = runUploadCheck(
            'i18n/zh-CN/smashup/cards/compressed/not-a-real-card-atlas',
        );

        expect(result.status).not.toBe(0);
        expect(result.output).toContain('路径过滤没有匹配到可发布对象');
    });

    it('npm 参数转发异常时应拒绝执行，避免检查命令误变成真实发布', () => {
        const result = runUploadFromNpmLifecycle(
            'i18n/zh-CN/smashup/cards/compressed/marvel_villains',
        );

        expect(result.status).not.toBe(0);
        expect(result.output).toContain('检测到 npm 未把 --asset-prefix/--check 正确传给上传脚本');
    });

    it('包管理游戏的运行时 JSON 应随素材上传，避免服务器刷新 file-index 时漏清单', () => {
        const result = runUploadCheck(
            '--asset-prefix',
            'i18n/zh-CN/dicethrone/images/tianshi/status-icons-atlas',
        );

        expect(result.status).toBe(0);
        expect(result.output).toContain('待发布: official/i18n/zh-CN/dicethrone/images/tianshi/status-icons-atlas.json');
        expect(result.output).toContain('检查完成：待发布 1 个对象');
    });
});

describe('Android 游戏包素材内容', () => {
    it('所有移动端游戏包候选资源都不应包含源格式或临时文件', () => {
        const { allAssetPaths } = getAssetCatalog();

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
        const { allAssetPaths } = getAssetCatalog();
        const sharedAudioPackageFiles = allAssetPaths
            .filter(isSharedAudioPackagePath);

        expect(sharedAudioPackageFiles.length).toBeGreaterThan(0);
        expect(sharedAudioPackageFiles.every((relativePath) => relativePath.startsWith('common/audio/'))).toBe(true);
        expect(sharedAudioPackageFiles.every((relativePath) => relativePath.includes('/compressed/'))).toBe(true);
        expect(sharedAudioPackageFiles.every((relativePath) => path.extname(relativePath).toLowerCase() === '.ogg')).toBe(true);
        expect(sharedAudioPackageFiles).not.toContain('common/audio/registry.json');
        expect(sharedAudioPackageFiles).not.toContain('common/audio/phrase-mappings.zh-CN.json');
    });

    it('所有包管理游戏配置的 BGM 都必须进入共享音频包候选资源', () => {
        const { allAssetPaths } = getAssetCatalog();
        const sharedAudioPackageFiles = new Set(allAssetPaths.filter(isSharedAudioPackagePath));
        const registry = JSON.parse(readFileSync(
            path.join(process.cwd(), 'src', 'assets', 'audio', 'registry-slim.json'),
            'utf8',
        )) as { entries?: Array<{ key: string; src?: string; type?: string }> };
        const registryByKey = new Map((registry.entries ?? []).map((entry) => [entry.key, entry]));

        const missing = collectPackageManagedBgmKeys()
            .map(({ gameId, key }) => {
                const entry = registryByKey.get(key);
                const packagePath = entry?.src ? toSharedAudioPackagePath(entry.src) : null;
                return {
                    gameId,
                    key,
                    packagePath,
                    ok: entry?.type === 'bgm' && packagePath !== null && sharedAudioPackageFiles.has(packagePath),
                };
            })
            .filter((row) => !row.ok);

        expect(missing).toEqual([]);
    });

    it('所有移动端游戏包候选资源如果存在同哈希重复，必须作为待收口风险可见', () => {
        const { allAssetPaths, getMetadata } = getAssetCatalog();

        const duplicateSummary = getPackageManagedGameIds()
            .map((gameId) => {
                const packageFiles = allAssetPaths
                    .filter((relativePath) => isGamePackagePath(relativePath, gameId))
                    .filter((relativePath) => isCompressedDeliveryPath(relativePath, gameId));
                const rows = packageFiles
                    .filter((relativePath) => /\.(?:webp|ogg|svg|json)$/i.test(relativePath))
                    .map((relativePath) => {
                        const metadata = getMetadata(relativePath);
                        return {
                            relativePath,
                            hash: metadata.hash,
                            size: metadata.size,
                        };
                    });
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

        expect(duplicateSummary.map(({ gameId }) => gameId)).toEqual([
            'dicethrone',
            'mage-wars',
            'qidahen',
            'smashup',
            'summonerwars',
        ]);
        for (const entry of duplicateSummary) {
            expect(entry.duplicateGroups).toBeGreaterThan(0);
            expect(entry.duplicateBytes).toBeGreaterThan(0);
        }
    });

    it('SmashUp 游戏包候选资源应只保留运行时会请求的 POD 图集路径', () => {
        const { allAssetPaths, physicalAssetPaths, getMetadata } = getAssetCatalog();
        const smashUpPackageFiles = allAssetPaths
            .filter((relativePath) => isGamePackagePath(relativePath, 'smashup'))
            .filter((relativePath) => isCompressedDeliveryPath(relativePath, 'smashup'));
        const physicalPackageFiles = physicalAssetPaths
            .filter((relativePath) => isGamePackagePath(relativePath, 'smashup'))
            .filter((relativePath) => isCompressedDeliveryPath(relativePath, 'smashup'));
        const totalBytes = physicalPackageFiles.reduce((sum, relativePath) => (
            sum + getMetadata(relativePath).size
        ), 0);

        expect(totalBytes).toBeLessThan(100 * 1024 * 1024);
        expect(smashUpPackageFiles).toContain('i18n/zh-CN/smashup/base/compressed/pretty_pretty_pod.webp');
        expect(smashUpPackageFiles).toContain('i18n/zh-CN/smashup/cards/compressed/longzu.webp');
        expect(smashUpPackageFiles).toContain('i18n/zh-CN/smashup/cards/compressed/all_stars_pod.webp');
        expect(smashUpPackageFiles).toContain('i18n/zh-CN/smashup/cards/compressed/fairies_pod.webp');
        expect(smashUpPackageFiles).toContain('i18n/zh-CN/smashup/cards/compressed/kitty_cats_pod.webp');
        expect(smashUpPackageFiles).toContain('i18n/zh-CN/smashup/cards/compressed/mermaids_pod.webp');
        expect(smashUpPackageFiles).toContain('i18n/zh-CN/smashup/cards/compressed/mythic_greeks_pod.webp');
        expect(smashUpPackageFiles).toContain('i18n/zh-CN/smashup/cards/compressed/mythic_horses_pod.webp');
        expect(smashUpPackageFiles).toContain('i18n/zh-CN/smashup/cards/compressed/princesses_pod.webp');
        expect(smashUpPackageFiles).toContain('i18n/zh-CN/smashup/cards/compressed/sharks_pod.webp');
        expect(smashUpPackageFiles).toContain('i18n/zh-CN/smashup/cards/compressed/tornados_pod.webp');
        expect(smashUpPackageFiles).toContain('i18n/en/smashup/cards/compressed/tts_atlas_0b888d02fd.webp');
        expect(smashUpPackageFiles).toContain('i18n/en/smashup/pod-assets/compressed/tts_atlas_0157978c57.webp');
        expect(smashUpPackageFiles).not.toContain('i18n/zh-CN/smashup/cards/compressed/disney.webp');
        expect(smashUpPackageFiles).not.toContain('i18n/zh-CN/smashup/taitan/compressed/taitan1.webp');
        expect(smashUpPackageFiles).not.toContain('i18n/en/smashup/cards/compressed/tts_atlas_0157978c57.webp');
        expect(smashUpPackageFiles).not.toContain('i18n/en/smashup/pod-assets/compressed/tts_atlas_0b888d02fd.webp');
        expect(smashUpPackageFiles).not.toContain('i18n/en/smashup/cards/compressed/anansi_tales_pod.webp');
        expect(smashUpPackageFiles).not.toContain('i18n/en/smashup/taitan/compressed/taitan1.webp');
        expect(smashUpPackageFiles).not.toContain('smashup/cards/compressed/marvel_wave_one.webp');
        expect(smashUpPackageFiles).not.toContain('smashup/cards/compressed/cease_and_desist.webp');
        expect(smashUpPackageFiles).not.toContain('smashup/base/compressed/cease_and_desist.webp');
        expect(smashUpPackageFiles).toContain('atlas-configs/smashup/pod-atlas-config.json');
        expect(smashUpPackageFiles).not.toContain('atlas-configs/smashup/2833984701.json');
    });

    it('DiceThrone 游戏包候选资源不应包含未压缩图片源文件', () => {
        const { allAssetPaths, getMetadata } = getAssetCatalog();
        const diceThronePackageFiles = allAssetPaths
            .filter(isDiceThronePackagePath)
            .filter((relativePath) => isCompressedDeliveryPath(relativePath, 'dicethrone'));

        const rawImageFiles = diceThronePackageFiles.filter((relativePath) => /\.(?:png|jpe?g)$/i.test(relativePath));
        const publicCropFiles = diceThronePackageFiles.filter((relativePath) => diceThronePublicCropPathPattern.test(relativePath));
        const totalBytes = diceThronePackageFiles.reduce((sum, relativePath) => {
            return sum + getMetadata(relativePath).size;
        }, 0);

        expect(rawImageFiles).toEqual([]);
        expect(publicCropFiles).toEqual([]);
        expect(totalBytes).toBeLessThan(50 * 1024 * 1024);
        expect(diceThronePackageFiles).not.toContain('i18n/zh-CN/dicethrone/emotes/barbarian/compressed/thumbs-up-v1.webp');
        expect(diceThronePackageFiles).toContain('i18n/zh-CN/dicethrone/emotes/barbarian/compressed/thumbs-up-v2.webp');
        expect(diceThronePackageFiles).not.toContain('i18n/zh-CN/dicethrone/emotes/moon-elf/compressed/confused-v1.webp');
        expect(diceThronePackageFiles).toContain('i18n/zh-CN/dicethrone/emotes/moon-elf/compressed/confused-v2.webp');
        expect(diceThronePackageFiles).not.toContain('i18n/zh-CN/dicethrone/images/tianshi/compressed/cards.webp');
        expect(diceThronePackageFiles).toContain('i18n/zh-CN/dicethrone/images/tianshi/compressed/ability-cards.webp');
        expect(diceThronePackageFiles).not.toContain('i18n/zh-CN/dicethrone/images/cursed/compressed/玩家面板.webp');
        expect(diceThronePackageFiles).toContain('i18n/zh-CN/dicethrone/images/cursed/compressed/player-board.webp');
        expect(diceThronePackageFiles).not.toContain('i18n/zh-CN/dicethrone/images/artificial/compressed/手牌.webp');
        expect(diceThronePackageFiles).toContain('i18n/zh-CN/dicethrone/images/artificial/compressed/ability-cards.webp');
    });

    it('DiceThrone 状态图集 JSON 和压缩 WebP 必须成对进入 Android 游戏包候选资源', () => {
        const { allAssetPaths } = getAssetCatalog();
        const diceThronePackageFiles = new Set(
            allAssetPaths
                .filter(isDiceThronePackagePath)
                .filter((relativePath) => isCompressedDeliveryPath(relativePath, 'dicethrone')),
        );
        const statusAtlasJsonPaths = [...diceThronePackageFiles]
            .filter((relativePath) => /^i18n\/zh-CN\/dicethrone\/images\/[^/]+\/status-icons-atlas\.json$/u.test(relativePath));

        expect(statusAtlasJsonPaths.length).toBeGreaterThan(0);

        for (const jsonPath of statusAtlasJsonPaths) {
            const atlasImagePath = jsonPath.replace('/status-icons-atlas.json', '/compressed/status-icons-atlas.webp');
            expect(diceThronePackageFiles.has(atlasImagePath), `${jsonPath} 缺少对应压缩图集`).toBe(true);
        }
    });

    it('DiceThrone 差异索引 dry-run 应输出瘦身后的文件数量', () => {
        const { physicalAssetPaths } = getAssetCatalog();
        const expectedFileCount = physicalAssetPaths
            .filter(isDiceThronePackagePath)
            .filter((relativePath) => isCompressedDeliveryPath(relativePath, 'dicethrone'))
            .length;
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
        expect(output).toContain(`fileCount=${expectedFileCount}`);
    });

    it('npm 参数转发成裸值时仍应保留 DiceThrone dry-run 范围', () => {
        const result = spawnSync(
            process.execPath,
            [
                path.join(process.cwd(), 'scripts', 'mobile', 'publish-android-game-packages.mjs'),
                'stable',
                'dicethrone',
            ],
            {
                cwd: process.cwd(),
                encoding: 'utf8',
                env: createNpmMobilePackagesLifecycleEnv({
                    dry_run: 'true',
                    index_manifest_only: 'true',
                    reuse_shared_audio: 'true',
                }),
                timeout: 120_000,
            },
        );
        const output = `${result.stdout}\n${result.stderr}`;

        expect(result.status).toBe(0);
        expect(output).toContain('游戏 file-index/manifest 差异刷新预演完成（未上传 ZIP）');
        expect(output).toContain('gameId=dicethrone');
        expect(output).not.toContain('gameId=cardia');
        expect(output).not.toContain('游戏包上传计划已准备');
        expect(output).not.toContain('服务器主源整批发布完成');
    });
});
