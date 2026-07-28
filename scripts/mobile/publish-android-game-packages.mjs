import { config } from 'dotenv';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Zip, ZipDeflate } from 'fflate';
import { publishPrimaryAssetBatch } from '../assets/publish-primary-assets.mjs';
import { waitForServerAssets } from './wait-for-server-assets.mjs';

const rootDir = process.cwd();

for (const file of ['.env', '.env.android', '.env.android.local', '.env.example']) {
    const fullPath = path.join(rootDir, file);
    if (!existsSync(fullPath)) continue;
    config({ path: fullPath, override: false, quiet: true });
}

const packageJson = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const args = process.argv.slice(2);
const SHARED_AUDIO_PACK_GAME_ID = 'common-audio';
const SHARED_AUDIO_PREFIX = 'common/audio/';
const COMPRESSED_DIR_NAME = 'compressed';
const COMPRESSED_EXTENSIONS = new Set(['.webp', '.ogg']);
const DIRECT_ASSET_EXTENSIONS = new Set(['.json', '.svg']);
const SOURCE_ASSET_EXTENSIONS = new Set([
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
const TEMPORARY_ASSET_NAME_PATTERN = /(^|[/._ -])(?:temp|tmp|bak|backup|old|copy|副本|临时|测试|test)([/._ -]|$)/i;
const LEGACY_DICETHRONE_COMPRESSED_ALIASES = new Set([
    '人类面板.webp',
    '手牌.webp',
    '提示卡.webp',
    '提示板.webp',
    '玩家面板.webp',
    '面板.webp',
    '骰子.webp',
]);
const LEGACY_DICETHRONE_EMOTE_COMPRESSED_PATHS = new Set([
    'i18n/zh-CN/dicethrone/emotes/barbarian/compressed/thumbs-up-v1.webp',
    'i18n/zh-CN/dicethrone/emotes/moon-elf/compressed/confused-v1.webp',
]);
const LEGACY_SMASHUP_ATLAS_CONFIG_PATHS = new Set([
    'atlas-configs/smashup/2833984701.json',
]);
const SMASHUP_ENGLISH_ATLAS_RELATIVE_PATH_PATTERN = /^i18n\/en\/smashup\/(?:base|cards|pod-assets|taitan)\/compressed\/[^/]+\.webp$/;
const SMASHUP_ZH_CN_ATLAS_RELATIVE_PATH_PATTERN = /^i18n\/zh-CN\/smashup\/(?:base|cards|taitan)(?:\/[^/]+)?\/compressed\/[^/]+\.webp$/;
const SMASHUP_ZH_CN_ANDROID_PACKAGE_ATLAS_PATHS = new Set([
    'i18n/zh-CN/smashup/cards/compressed/longzu.webp',
]);
const STABLE_ZIP_DATE = new Date('2024-01-01T00:00:00.000Z');
const tempZipRoot = path.join(tmpdir(), 'boardgame-mobile-packages');
const runId = `${process.pid}-${Date.now()}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pendingUploads = [];
const temporaryUploadFiles = new Set();
const cleanupTemporaryUploadFiles = () => {
    for (const filePath of temporaryUploadFiles) {
        try {
            unlinkSync(filePath);
        } catch {}
    }
    temporaryUploadFiles.clear();
};
process.once('exit', cleanupTemporaryUploadFiles);
const readArgValue = (name, fallback = '') => {
    const prefix = `--${name}=`;
    const direct = args.find((arg) => arg.startsWith(prefix));
    if (direct) {
        return direct.slice(prefix.length);
    }
    const index = args.findIndex((arg) => arg === `--${name}`);
    if (index >= 0 && args[index + 1]) {
        return args[index + 1];
    }
    return fallback;
};
const hasFlag = (name) => args.includes(`--${name}`);

const channel = readArgValue('channel', process.env.VITE_ANDROID_OTA_CHANNEL?.trim() || 'stable');
const explicitGameId = readArgValue('game', '');
const explicitVersion = readArgValue('version', '');
const dryRun = hasFlag('dry-run');
const manifestOnly = hasFlag('manifest-only');
const indexManifestOnly = hasFlag('index-manifest-only');
const reuseSharedAudio = hasFlag('reuse-shared-audio');
const buildTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
const assetsRoot = path.join(rootDir, 'public', 'assets');
const assetsBaseUrl = (process.env.VITE_ASSETS_BASE_URL?.trim() || 'https://assets.easyboardgame.top/official').replace(/\/+$/, '');
const packagePrefix = `official/mobile-packages/android/${channel}`;
const validChannelPattern = /^[a-z0-9][a-z0-9._-]*$/i;

if (!validChannelPattern.test(channel)) {
    throw new Error(`非法 channel: ${channel}`);
}

if (!existsSync(assetsRoot)) {
    throw new Error('public/assets 不存在，无法生成游戏包。');
}

const walkFiles = (dirPath, entries = []) => {
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

const hashFileSha256 = (fullPath) => {
    const hash = createHash('sha256');
    const input = createReadStream(fullPath);
    return new Promise((resolve, reject) => {
        input.on('error', reject);
        input.on('data', (chunk) => {
            hash.update(chunk);
        });
        input.on('end', () => {
            resolve(hash.digest('hex'));
        });
    });
};

const buildFileIndexPayload = async (includedFiles, packageVersion) => {
    const files = [];
    let totalSize = 0;
    for (const entry of includedFiles) {
        const size = statSync(entry.fullPath).size;
        const hash = await hashFileSha256(entry.fullPath);
        files.push({
            path: entry.relativePath,
            hash,
            size,
        });
        totalSize += size;
    }
    return {
        version: '1.0.0',
        assetPackVersion: packageVersion,
        files,
        totalSize,
    };
};

const stringifyJsonWithTrailingNewline = (payload) => `${JSON.stringify(payload, null, 2)}\n`;

const hashJsonPayload = (payload) => createHash('sha256')
    .update(stringifyJsonWithTrailingNewline(payload))
    .digest('hex');

const discoverPackageManagedGames = () => {
    const gamesRoot = path.join(rootDir, 'src', 'games');
    const results = [];

    for (const entry of readdirSync(gamesRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const manifestPath = path.join(gamesRoot, entry.name, 'manifest.ts');
        if (!existsSync(manifestPath)) continue;

        const content = readFileSync(manifestPath, 'utf8');
        if (!/mode:\s*'package-managed'/.test(content)) continue;

        const idMatch = content.match(/id:\s*'([^']+)'/);
        const gameId = idMatch?.[1]?.trim();
        if (!gameId) continue;
        results.push(gameId);
    }

    return Array.from(new Set(results)).sort((left, right) => left.localeCompare(right));
};

const loadSmashUpPodAtlasRuntimePackagePaths = (() => {
    let cached = null;
    return () => {
        if (cached) return cached;

        const englishMapPath = path.join(rootDir, 'src', 'games', 'smashup', 'data', 'englishAtlasMap.json');
        const atlasCatalogPath = path.join(rootDir, 'src', 'games', 'smashup', 'domain', 'atlasCatalog.ts');
        if (!existsSync(englishMapPath) || !existsSync(atlasCatalogPath)) {
            throw new Error('缺少大杀四方 POD 图集路径合同文件，无法生成 Android 游戏包。');
        }

        const englishMap = JSON.parse(readFileSync(englishMapPath, 'utf8'));
        const atlasCatalogSource = readFileSync(atlasCatalogPath, 'utf8');
        const overrides = new Map(
            [...atlasCatalogSource.matchAll(/(tts_atlas_[A-Za-z0-9_]+):\s*'smashup\/cards\/([^']+)'/g)]
                .map((match) => [match[1], `smashup/cards/${match[2]}`]),
        );
        const atlasIds = new Set(
            Object.values(englishMap)
                .map((entry) => entry?.atlasId)
                .filter((atlasId) => typeof atlasId === 'string' && atlasId.startsWith('tts_atlas_')),
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

const isPublishableSmashUpAtlasPath = (relativePath) => {
    const normalized = relativePath.replace(/\\/g, '/');
    if (SMASHUP_ENGLISH_ATLAS_RELATIVE_PATH_PATTERN.test(normalized)) {
        return loadSmashUpPodAtlasRuntimePackagePaths().has(normalized);
    }
    if (SMASHUP_ZH_CN_ATLAS_RELATIVE_PATH_PATTERN.test(normalized)) {
        return SMASHUP_ZH_CN_ANDROID_PACKAGE_ATLAS_PATHS.has(normalized) || normalized.endsWith('_pod.webp');
    }
    return true;
};

const shouldIncludeInGamePackage = (relativePath, gameId) => {
    const normalized = relativePath.replace(/\\/g, '/');
    if (gameId === 'smashup'
        && !(normalized.startsWith(`atlas-configs/${gameId}/`)
            || /^i18n\/[^/]+\/[^/]+\//.test(normalized) && normalized.includes(`/${gameId}/`))) {
        return false;
    }
    if (!(normalized.startsWith(`${gameId}/`)
        || normalized.startsWith(`atlas-configs/${gameId}/`)
        || /^i18n\/[^/]+\/[^/]+\//.test(normalized) && normalized.includes(`/${gameId}/`))) {
        return false;
    }

    const extension = path.extname(normalized).toLowerCase();
    if (SOURCE_ASSET_EXTENSIONS.has(extension) || TEMPORARY_ASSET_NAME_PATTERN.test(normalized)) {
        return false;
    }

    if (gameId === 'smashup' && LEGACY_SMASHUP_ATLAS_CONFIG_PATHS.has(normalized)) {
        return false;
    }

    if (DIRECT_ASSET_EXTENSIONS.has(extension)) {
        return true;
    }

    if (gameId === 'smashup' && !isPublishableSmashUpAtlasPath(normalized)) {
        return false;
    }

    const parts = normalized.split('/');
    if (gameId === 'dicethrone' && LEGACY_DICETHRONE_EMOTE_COMPRESSED_PATHS.has(normalized)) {
        return false;
    }

    if (
        gameId === 'dicethrone'
        && parts.includes(COMPRESSED_DIR_NAME)
        && parts.length >= 2
        && parts[parts.length - 2] === COMPRESSED_DIR_NAME
        && LEGACY_DICETHRONE_COMPRESSED_ALIASES.has(parts[parts.length - 1])
    ) {
        return false;
    }

    return parts.includes(COMPRESSED_DIR_NAME) && COMPRESSED_EXTENSIONS.has(extension);
};

const isSourceOrTemporaryAssetPath = (relativePath) => {
    const normalized = relativePath.replace(/\\/g, '/');
    const extension = path.extname(normalized).toLowerCase();
    return SOURCE_ASSET_EXTENSIONS.has(extension) || TEMPORARY_ASSET_NAME_PATTERN.test(normalized);
};

const isCompressedRuntimeMediaPath = (relativePath) => {
    const normalized = relativePath.replace(/\\/g, '/');
    const extension = path.extname(normalized).toLowerCase();
    const parts = normalized.split('/');
    return COMPRESSED_EXTENSIONS.has(extension) && parts.includes(COMPRESSED_DIR_NAME);
};

const assertGamePackageEntriesArePublishable = (includedFiles, gameId) => {
    const blockedFiles = includedFiles
        .map((entry) => entry.relativePath)
        .filter((relativePath) => {
            const extension = path.extname(relativePath).toLowerCase();
            if (isSourceOrTemporaryAssetPath(relativePath)) return true;
            if (COMPRESSED_EXTENSIONS.has(extension) && !isCompressedRuntimeMediaPath(relativePath)) return true;
            return false;
        });

    if (blockedFiles.length > 0) {
        throw new Error([
            `${gameId} Android 游戏包候选资源包含非压缩交付物或临时/源素材，已中断发布。`,
            ...blockedFiles.slice(0, 20).map((relativePath) => `- ${relativePath}`),
            blockedFiles.length > 20 ? `... 还有 ${blockedFiles.length - 20} 个` : '',
        ].filter(Boolean).join('\n'));
    }
};

const buildGamePackageEntries = (gameId) => {
    const allFiles = walkFiles(assetsRoot);
    const includedFiles = allFiles
        .map((fullPath) => ({
            fullPath,
            relativePath: path.relative(assetsRoot, fullPath).replace(/\\/g, '/'),
        }))
        .filter((entry) => shouldIncludeInGamePackage(entry.relativePath, gameId))
        .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
    assertGamePackageEntriesArePublishable(includedFiles, gameId);
    return { includedFiles };
};

const shouldIncludeInSharedAudioPackage = (relativePath) => {
    const normalized = relativePath.replace(/\\/g, '/');
    if (!normalized.startsWith(SHARED_AUDIO_PREFIX)) {
        return false;
    }

    const extension = path.extname(normalized).toLowerCase();
    const parts = normalized.split('/');
    return extension === '.ogg'
        && parts.includes(COMPRESSED_DIR_NAME)
        && !SOURCE_ASSET_EXTENSIONS.has(extension)
        && !TEMPORARY_ASSET_NAME_PATTERN.test(normalized);
};

const assertSharedAudioPackageEntriesArePublishable = (includedFiles) => {
    const blockedFiles = includedFiles
        .map((entry) => entry.relativePath)
        .filter((relativePath) => {
            const normalized = relativePath.replace(/\\/g, '/');
            return !normalized.startsWith(SHARED_AUDIO_PREFIX)
                || path.extname(normalized).toLowerCase() !== '.ogg'
                || !isCompressedRuntimeMediaPath(normalized)
                || isSourceOrTemporaryAssetPath(normalized)
                || normalized.endsWith('/registry.json')
                || normalized.endsWith('/phrase-mappings.zh-CN.json');
        });

    if (blockedFiles.length > 0) {
        throw new Error([
            'Android 共享音频包候选资源包含非压缩 OGG 或构建/开发配置，已中断发布。',
            ...blockedFiles.slice(0, 20).map((relativePath) => `- ${relativePath}`),
            blockedFiles.length > 20 ? `... 还有 ${blockedFiles.length - 20} 个` : '',
        ].filter(Boolean).join('\n'));
    }
};

const buildSharedAudioPackageEntries = () => {
    const allFiles = walkFiles(assetsRoot);
    const includedFiles = allFiles
        .map((fullPath) => ({
            fullPath,
            relativePath: path.relative(assetsRoot, fullPath).replace(/\\/g, '/'),
        }))
        .filter((entry) => shouldIncludeInSharedAudioPackage(entry.relativePath))
        .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
    assertSharedAudioPackageEntriesArePublishable(includedFiles);
    return { includedFiles };
};

const fetchRemoteJson = async (url) => {
    const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}ts=${Date.now()}`, {
        headers: {
            Accept: 'application/json',
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
        },
    });
    if (!response.ok) {
        throw new Error(`拉取远端 JSON 失败: ${response.status} ${url}`);
    }
    return await response.json();
};

const resolveUploadSize = (key, body, contentLength) => {
    if (typeof contentLength === 'number') {
        return contentLength;
    }
    if (typeof body === 'string') {
        return Buffer.byteLength(body);
    }
    if (Buffer.isBuffer(body) || ArrayBuffer.isView(body)) {
        return body.byteLength;
    }
    throw new Error(`上传对象缺少可计算的大小: ${key}`);
};

const uploadObject = async (key, body, contentType, cacheControl, options = {}) => {
    pendingUploads.push({
        key,
        body,
        contentType,
        cacheControl,
        contentLength: options.contentLength,
        size: resolveUploadSize(key, body, options.contentLength),
    });
};

const flushPendingUploads = async () => {
    if (pendingUploads.length === 0) {
        return;
    }
    await publishPrimaryAssetBatch(pendingUploads);
};

const resolveAssetObjectContentType = (relativePath) => {
    const extension = path.extname(relativePath).toLowerCase();
    switch (extension) {
        case '.json':
            return 'application/json';
        case '.svg':
            return 'image/svg+xml';
        case '.webp':
            return 'image/webp';
        case '.ogg':
            return 'audio/ogg';
        default:
            return 'application/octet-stream';
    }
};

const uploadIndexedAssetObjects = async (includedFiles) => {
    for (const entry of includedFiles) {
        const objectKey = `official/${entry.relativePath}`;
        await uploadObject(
            objectKey,
            () => createReadStream(entry.fullPath),
            resolveAssetObjectContentType(entry.relativePath),
            'public, max-age=31536000, immutable',
            { contentLength: statSync(entry.fullPath).size },
        );
    }
};

const createAndroidCompatibleZipFile = async (includedFiles, zipFilePath) => {
    mkdirSync(path.dirname(zipFilePath), { recursive: true });
    try {
        unlinkSync(zipFilePath);
    } catch {}

    return await new Promise((resolve, reject) => {
        const output = createWriteStream(zipFilePath);
        const hash = createHash('sha256');
        let zipEnded = false;
        let totalBytes = 0;
        let settled = false;

        const finishWithError = (error) => {
            if (settled) return;
            settled = true;
            try {
                output.destroy();
            } catch {}
            reject(error);
        };

        output.on('error', finishWithError);
        output.on('finish', () => {
            if (settled) return;
            settled = true;
            resolve({
                zipFilePath,
                bytes: totalBytes,
                checksum: hash.digest('hex'),
            });
        });

        const zip = new Zip((error, chunk, final) => {
            if (error) {
                finishWithError(error);
                return;
            }

            const buffer = Buffer.from(chunk);
            hash.update(buffer);
            totalBytes += buffer.length;
            output.write(buffer);
            if (final && !zipEnded) {
                zipEnded = true;
                output.end();
            }
        });

        (async () => {
            try {
                for (const entry of includedFiles) {
                    await new Promise((entryResolve, entryReject) => {
                        // Android java.util.zip.ZipInputStream 不接受
                        // “STORED + data descriptor” 这种 fflate ZipPassThrough 流式格式，
                        // 否则只会读到第一个 entry 并抛出：
                        // "only DEFLATED entries can have EXT descriptor"。
                        // 这里改用 DEFLATE level 0，保持体积基本不变，同时让原生解压稳定兼容。
                        const zipEntry = new ZipDeflate(entry.relativePath, { level: 0 });
                        zipEntry.mtime = STABLE_ZIP_DATE;
                        zip.add(zipEntry);

                        const input = createReadStream(entry.fullPath);
                        input.on('error', entryReject);
                        input.on('data', (chunk) => {
                            zipEntry.push(new Uint8Array(chunk), false);
                        });
                        input.on('end', () => {
                            zipEntry.push(new Uint8Array(0), true);
                            entryResolve();
                        });
                    });
                }
                zip.end();
            } catch (error) {
                finishWithError(error);
            }
        })().catch(finishWithError);
    });
};

const buildSharedAudioPackageVersion = (checksum) => (
    explicitVersion
        ? `${explicitVersion}-shared-audio`
        : `${packageJson.version}-shared-audio-${checksum.slice(0, 12)}`
);

const buildSharedAudioManifestPayload = ({
    packageVersion,
    checksum,
    bytes,
    fileCount,
    fileIndexUrl,
    fileIndexChecksum,
}) => ({
    gameId: SHARED_AUDIO_PACK_GAME_ID,
    runtimeChannel: channel,
    publishedAt: new Date().toISOString(),
    modulePack: null,
    assetPack: {
        id: SHARED_AUDIO_PACK_GAME_ID,
        version: packageVersion,
        url: `${assetsBaseUrl}/mobile-packages/android/${channel}/bundles/shared/${encodeURIComponent(SHARED_AUDIO_PACK_GAME_ID)}/${encodeURIComponent(packageVersion)}.zip`,
        checksum,
        bytes,
        fileCount,
        fileIndexUrl,
        fileIndexChecksum,
    },
});

const buildGameManifestPayload = ({
    gameId,
    packageVersion,
    checksum,
    bytes,
    fileCount,
    fileIndexUrl,
    fileIndexChecksum,
    sharedAudioPackResult,
    modulePack = null,
}) => ({
    gameId,
    runtimeChannel: channel,
    publishedAt: new Date().toISOString(),
    modulePack,
    assetPack: {
        id: gameId,
        version: packageVersion,
        url: `${assetsBaseUrl}/mobile-packages/android/${channel}/bundles/${encodeURIComponent(gameId)}/${encodeURIComponent(packageVersion)}.zip`,
        checksum,
        bytes,
        fileCount,
        fileIndexUrl,
        fileIndexChecksum,
    },
    sharedAudioPack: sharedAudioPackResult
        ? {
            id: sharedAudioPackResult.gameId,
            version: sharedAudioPackResult.packageVersion,
            url: sharedAudioPackResult.bundleUrl,
            checksum: sharedAudioPackResult.checksum,
            bytes: sharedAudioPackResult.zipBytes,
            fileCount: sharedAudioPackResult.fileCount,
            fileIndexUrl: sharedAudioPackResult.fileIndexUrl,
            fileIndexChecksum: sharedAudioPackResult.fileIndexChecksum,
        }
        : null,
});

const formatErrorMessage = (error) => (
    error instanceof Error ? error.message : String(error)
);

const buildDryRunSharedAudioPackResult = () => {
    const { includedFiles } = buildSharedAudioPackageEntries();
    return {
        gameId: SHARED_AUDIO_PACK_GAME_ID,
        packageVersion: `${packageJson.version}-${SHARED_AUDIO_PACK_GAME_ID}-dry-run`,
        zipBytes: null,
        fileCount: includedFiles.length,
        checksum: 'dry-run-shared-audio-checksum',
        fileIndexUrl: `${assetsBaseUrl}/mobile-packages/android/${channel}/file-index/shared/${encodeURIComponent(SHARED_AUDIO_PACK_GAME_ID)}/dry-run.json`,
        fileIndexChecksum: 'dry-run-shared-audio-file-index',
        bundleKey: `${packagePrefix}/bundles/shared/${SHARED_AUDIO_PACK_GAME_ID}/dry-run.zip`,
        latestManifestKey: `${packagePrefix}/shared/${SHARED_AUDIO_PACK_GAME_ID}.json`,
        bundleUrl: `${assetsBaseUrl}/mobile-packages/android/${channel}/bundles/shared/${encodeURIComponent(SHARED_AUDIO_PACK_GAME_ID)}/dry-run.zip`,
    };
};

const buildDryRunGameManifest = (gameId) => ({
    gameId,
    runtimeChannel: channel,
    publishedAt: new Date().toISOString(),
    modulePack: null,
    assetPack: {
        id: gameId,
        version: `${packageJson.version}-${gameId}-dry-run-full`,
        url: `${assetsBaseUrl}/mobile-packages/android/${channel}/bundles/${encodeURIComponent(gameId)}/dry-run-full.zip`,
        checksum: 'dry-run-full-asset-pack-checksum',
        bytes: null,
        fileCount: 0,
    },
});

const loadRemoteSharedAudioPackResult = async () => {
    let manifest;
    try {
        manifest = await fetchRemoteJson(`${assetsBaseUrl}/mobile-packages/android/${channel}/shared/${SHARED_AUDIO_PACK_GAME_ID}.json`);
    } catch (error) {
        if (!dryRun) throw error;
        console.warn(`dry-run: 远端 shared audio manifest 不可用，使用本地预演占位：${formatErrorMessage(error)}`);
        return buildDryRunSharedAudioPackResult();
    }
    const assetPack = manifest?.assetPack;
    if (!assetPack?.version || !assetPack?.url || !assetPack?.checksum) {
        if (dryRun) {
            console.warn('dry-run: 远端 shared audio manifest 不完整，使用本地预演占位。');
            return buildDryRunSharedAudioPackResult();
        }
        throw new Error('远端 shared audio manifest 不完整，无法执行 manifest-only');
    }
    return {
        gameId: SHARED_AUDIO_PACK_GAME_ID,
        packageVersion: assetPack.version,
        zipBytes: assetPack.bytes,
        fileCount: assetPack.fileCount,
        checksum: assetPack.checksum,
        fileIndexUrl: assetPack.fileIndexUrl,
        fileIndexChecksum: assetPack.fileIndexChecksum,
        bundleKey: `${packagePrefix}/bundles/shared/${SHARED_AUDIO_PACK_GAME_ID}/${assetPack.version}.zip`,
        latestManifestKey: `${packagePrefix}/shared/${SHARED_AUDIO_PACK_GAME_ID}.json`,
        bundleUrl: assetPack.url,
    };
};

const resolveRemoteFullAssetPack = (gameId, assetPack) => {
    const version = assetPack?.fallbackVersion ?? assetPack?.version;
    const url = assetPack?.fallbackUrl ?? assetPack?.url;
    const checksum = assetPack?.fallbackChecksum ?? assetPack?.checksum;
    const bytes = assetPack?.fallbackBytes ?? assetPack?.bytes;

    if (!version || !url || !checksum) {
        throw new Error(`远端游戏 manifest 缺少完整 ZIP 兜底信息，无法执行 manifest/index-only: ${gameId}`);
    }

    return {
        version,
        url,
        checksum,
        bytes,
    };
};

const loadRemoteGameManifest = async (gameId) => {
    let manifest;
    try {
        manifest = await fetchRemoteJson(`${assetsBaseUrl}/mobile-packages/android/${channel}/games/${gameId}.json`);
    } catch (error) {
        if (!dryRun) throw error;
        console.warn(`dry-run: 远端游戏 manifest 不可用，使用本地预演占位：${gameId}：${formatErrorMessage(error)}`);
        return buildDryRunGameManifest(gameId);
    }
    if (!manifest?.assetPack?.version) {
        if (dryRun) {
            console.warn(`dry-run: 远端游戏 manifest 不完整，使用本地预演占位：${gameId}`);
            return buildDryRunGameManifest(gameId);
        }
        throw new Error(`远端游戏 manifest 不完整，无法执行 manifest-only: ${gameId}`);
    }
    resolveRemoteFullAssetPack(gameId, manifest.assetPack);
    return manifest;
};

const buildIndexOnlyPackageVersion = (gameId, fileIndexChecksum) => (
    explicitVersion
        ? explicitVersion
        : `${packageJson.version}-${gameId}-idx-${fileIndexChecksum.slice(0, 12)}`
);

const publishSharedAudioPackage = async () => {
    const { includedFiles } = buildSharedAudioPackageEntries();
    if (includedFiles.length === 0) {
        return null;
    }

    const tempZipPath = path.join(tempZipRoot, `${runId}-shared-${SHARED_AUDIO_PACK_GAME_ID}.zip`);
    const zipResult = await createAndroidCompatibleZipFile(includedFiles, tempZipPath);
    temporaryUploadFiles.add(zipResult.zipFilePath);
    const checksum = zipResult.checksum;
    const packageVersion = buildSharedAudioPackageVersion(checksum);
    const fileIndexPayload = await buildFileIndexPayload(includedFiles, packageVersion);
    const fileIndexJson = stringifyJsonWithTrailingNewline(fileIndexPayload);
    const fileIndexChecksum = hashJsonPayload(fileIndexPayload);
    const bundleKey = `${packagePrefix}/bundles/shared/${SHARED_AUDIO_PACK_GAME_ID}/${packageVersion}.zip`;
    const fileIndexKey = `${packagePrefix}/file-index/shared/${SHARED_AUDIO_PACK_GAME_ID}/${packageVersion}.json`;
    const versionManifestKey = `${packagePrefix}/manifests/shared/${SHARED_AUDIO_PACK_GAME_ID}/${packageVersion}.json`;
    const latestManifestKey = `${packagePrefix}/shared/${SHARED_AUDIO_PACK_GAME_ID}.json`;
    const bundleUrl = `${assetsBaseUrl}/mobile-packages/android/${channel}/bundles/shared/${encodeURIComponent(SHARED_AUDIO_PACK_GAME_ID)}/${encodeURIComponent(packageVersion)}.zip`;
    const fileIndexUrl = `${assetsBaseUrl}/mobile-packages/android/${channel}/file-index/shared/${encodeURIComponent(SHARED_AUDIO_PACK_GAME_ID)}/${encodeURIComponent(packageVersion)}.json`;
    const manifest = buildSharedAudioManifestPayload({
        packageVersion,
        checksum,
        bytes: zipResult.bytes,
        fileCount: includedFiles.length,
        fileIndexUrl,
        fileIndexChecksum,
    });

    if (!dryRun) {
        await uploadObject(
            bundleKey,
            () => createReadStream(zipResult.zipFilePath),
            'application/zip',
            'public, max-age=31536000, immutable',
            { contentLength: zipResult.bytes },
        );
        await uploadObject(fileIndexKey, fileIndexJson, 'application/json', 'public, max-age=31536000, immutable');
        await uploadObject(versionManifestKey, stringifyJsonWithTrailingNewline(manifest), 'application/json', 'public, max-age=60, must-revalidate');
        await uploadObject(latestManifestKey, stringifyJsonWithTrailingNewline(manifest), 'application/json', 'public, max-age=60, must-revalidate');
    }

    return {
        gameId: SHARED_AUDIO_PACK_GAME_ID,
        packageVersion,
        zipBytes: zipResult.bytes,
        fileCount: includedFiles.length,
        checksum,
        bundleKey,
        fileIndexKey,
        fileIndexUrl,
        fileIndexChecksum,
        latestManifestKey,
        bundleUrl,
        publishedInCurrentRun: true,
    };
};

const publishSingleGamePackage = async (gameId, sharedAudioPackResult) => {
    const packageVersion = explicitVersion || `${packageJson.version}-${gameId}-pkg-${buildTimestamp}`;
    const { includedFiles } = buildGamePackageEntries(gameId);
    const tempZipPath = path.join(tempZipRoot, `${runId}-${gameId}.zip`);
    const zipResult = await createAndroidCompatibleZipFile(includedFiles, tempZipPath);
    temporaryUploadFiles.add(zipResult.zipFilePath);
    const checksum = zipResult.checksum;
    const fileIndexPayload = await buildFileIndexPayload(includedFiles, packageVersion);
    const fileIndexJson = stringifyJsonWithTrailingNewline(fileIndexPayload);
    const fileIndexChecksum = hashJsonPayload(fileIndexPayload);
    const bundleKey = `${packagePrefix}/bundles/${gameId}/${packageVersion}.zip`;
    const fileIndexKey = `${packagePrefix}/file-index/${gameId}/${packageVersion}.json`;
    const versionManifestKey = `${packagePrefix}/manifests/${gameId}/${packageVersion}.json`;
    const latestManifestKey = `${packagePrefix}/games/${gameId}.json`;
    const bundleUrl = `${assetsBaseUrl}/mobile-packages/android/${channel}/bundles/${encodeURIComponent(gameId)}/${encodeURIComponent(packageVersion)}.zip`;
    const fileIndexUrl = `${assetsBaseUrl}/mobile-packages/android/${channel}/file-index/${encodeURIComponent(gameId)}/${encodeURIComponent(packageVersion)}.json`;
    const manifest = buildGameManifestPayload({
        gameId,
        packageVersion,
        checksum,
        bytes: zipResult.bytes,
        fileCount: includedFiles.length,
        fileIndexUrl,
        fileIndexChecksum,
        sharedAudioPackResult,
        modulePack: null,
    });

    if (!dryRun) {
        await uploadObject(
            bundleKey,
            () => createReadStream(zipResult.zipFilePath),
            'application/zip',
            'public, max-age=31536000, immutable',
            { contentLength: zipResult.bytes },
        );
        await uploadObject(fileIndexKey, fileIndexJson, 'application/json', 'public, max-age=31536000, immutable');
        await uploadObject(versionManifestKey, stringifyJsonWithTrailingNewline(manifest), 'application/json', 'public, max-age=60, must-revalidate');
        await uploadObject(latestManifestKey, stringifyJsonWithTrailingNewline(manifest), 'application/json', 'public, max-age=60, must-revalidate');
    }

    return {
        gameId,
        packageVersion,
        zipBytes: zipResult.bytes,
        fileCount: includedFiles.length,
        checksum,
        bundleKey,
        fileIndexKey,
        fileIndexUrl,
        fileIndexChecksum,
        fileIndexBytes: Buffer.byteLength(fileIndexJson),
        latestManifestKey,
        bundleUrl,
    };
};

const publishSingleGameIndexManifest = async (gameId, sharedAudioPackResult) => {
    const remoteManifest = await loadRemoteGameManifest(gameId);
    const { includedFiles } = buildGamePackageEntries(gameId);
    const provisionalVersion = explicitVersion || `${packageJson.version}-${gameId}-idx-pending`;
    const provisionalFileIndexPayload = await buildFileIndexPayload(includedFiles, provisionalVersion);
    const fileIndexChecksum = hashJsonPayload(provisionalFileIndexPayload);
    const packageVersion = buildIndexOnlyPackageVersion(gameId, fileIndexChecksum);
    const fileIndexPayload = await buildFileIndexPayload(includedFiles, packageVersion);
    const fileIndexJson = stringifyJsonWithTrailingNewline(fileIndexPayload);
    const finalFileIndexChecksum = hashJsonPayload(fileIndexPayload);
    const assetPack = remoteManifest.assetPack;
    const fallbackAssetPack = resolveRemoteFullAssetPack(gameId, assetPack);
    const fileIndexKey = `${packagePrefix}/file-index/${gameId}/${packageVersion}.json`;
    const versionManifestKey = `${packagePrefix}/manifests/${gameId}/${packageVersion}.json`;
    const latestManifestKey = `${packagePrefix}/games/${gameId}.json`;
    const fileIndexUrl = `${assetsBaseUrl}/mobile-packages/android/${channel}/file-index/${encodeURIComponent(gameId)}/${encodeURIComponent(packageVersion)}.json`;
    const manifest = buildGameManifestPayload({
        gameId,
        packageVersion,
        checksum: null,
        bytes: null,
        fileCount: includedFiles.length,
        fileIndexUrl,
        fileIndexChecksum: finalFileIndexChecksum,
        sharedAudioPackResult,
        modulePack: remoteManifest.modulePack ?? null,
    });

    delete manifest.assetPack.url;
    delete manifest.assetPack.checksum;
    delete manifest.assetPack.bytes;
    manifest.assetPack.fallbackUrl = fallbackAssetPack.url;
    manifest.assetPack.fallbackVersion = fallbackAssetPack.version;
    manifest.assetPack.fallbackChecksum = fallbackAssetPack.checksum;
    manifest.assetPack.fallbackBytes = fallbackAssetPack.bytes;
    manifest.assetPack.diffOnly = true;

    if (!dryRun) {
        await uploadIndexedAssetObjects(includedFiles);
        await uploadObject(fileIndexKey, fileIndexJson, 'application/json', 'public, max-age=31536000, immutable');
        await uploadObject(versionManifestKey, stringifyJsonWithTrailingNewline(manifest), 'application/json', 'public, max-age=60, must-revalidate');
        await uploadObject(latestManifestKey, stringifyJsonWithTrailingNewline(manifest), 'application/json', 'public, max-age=60, must-revalidate');
    }

    return {
        gameId,
        packageVersion,
        zipBytes: null,
        fileCount: includedFiles.length,
        checksum: null,
        bundleKey: null,
        fileIndexKey,
        fileIndexUrl,
        fileIndexChecksum: finalFileIndexChecksum,
        fileIndexBytes: Buffer.byteLength(fileIndexJson),
        latestManifestKey,
        bundleUrl: null,
        fallbackVersion: fallbackAssetPack.version,
        fallbackBundleUrl: fallbackAssetPack.url,
        uploadedAssetObjectCount: dryRun ? 0 : includedFiles.length,
        indexManifestOnly: true,
    };
};

const publishGameManifestOnly = async (gameId, sharedAudioPackResult) => {
    const remoteManifest = await loadRemoteGameManifest(gameId);
    const assetPack = remoteManifest.assetPack;
    const fallbackAssetPack = resolveRemoteFullAssetPack(gameId, assetPack);
    const manifest = buildGameManifestPayload({
        gameId,
        packageVersion: assetPack.version,
        checksum: assetPack.checksum ?? null,
        bytes: assetPack.bytes ?? null,
        fileCount: assetPack.fileCount,
        fileIndexUrl: assetPack.fileIndexUrl,
        fileIndexChecksum: assetPack.fileIndexChecksum,
        sharedAudioPackResult,
        modulePack: remoteManifest.modulePack ?? null,
    });
    if (assetPack.diffOnly) {
        delete manifest.assetPack.url;
        delete manifest.assetPack.checksum;
        delete manifest.assetPack.bytes;
        manifest.assetPack.diffOnly = true;
        manifest.assetPack.fallbackUrl = fallbackAssetPack.url;
        manifest.assetPack.fallbackVersion = fallbackAssetPack.version;
        manifest.assetPack.fallbackChecksum = fallbackAssetPack.checksum;
        manifest.assetPack.fallbackBytes = fallbackAssetPack.bytes;
    }
    const versionManifestKey = `${packagePrefix}/manifests/${gameId}/${assetPack.version}.json`;
    const latestManifestKey = `${packagePrefix}/games/${gameId}.json`;
    const latestManifestUrl = `${assetsBaseUrl}/mobile-packages/android/${channel}/games/${encodeURIComponent(gameId)}.json`;
    const manifestJson = stringifyJsonWithTrailingNewline(manifest);
    const manifestChecksum = hashJsonPayload(manifest);

    if (!dryRun) {
        await uploadObject(versionManifestKey, manifestJson, 'application/json', 'public, max-age=60, must-revalidate');
        await uploadObject(latestManifestKey, manifestJson, 'application/json', 'public, max-age=60, must-revalidate');
    }

    return {
        gameId,
        packageVersion: assetPack.version,
        zipBytes: assetPack.bytes ?? null,
        fileCount: assetPack.fileCount,
        checksum: assetPack.checksum ?? null,
        bundleKey: assetPack.url ? `${packagePrefix}/bundles/${gameId}/${assetPack.version}.zip` : null,
        latestManifestKey,
        bundleUrl: assetPack.url ?? null,
        latestManifestUrl,
        manifestBytes: Buffer.byteLength(manifestJson),
        manifestChecksum,
        manifestOnly: true,
    };
};

const targetGames = explicitGameId
    ? [explicitGameId]
    : discoverPackageManagedGames();
const serverVerificationTargets = [];

if (targetGames.length === 0) {
    throw new Error('没有发现 package-managed 游戏，无法发布游戏包。');
}

const sharedAudioPackResult = (manifestOnly || indexManifestOnly || reuseSharedAudio)
    ? await loadRemoteSharedAudioPackResult()
    : await publishSharedAudioPackage();

if (sharedAudioPackResult) {
    if (sharedAudioPackResult.publishedInCurrentRun && sharedAudioPackResult.bundleUrl) {
        serverVerificationTargets.push({
            url: sharedAudioPackResult.bundleUrl,
            expectedSize: sharedAudioPackResult.zipBytes,
        });
    }
    if (manifestOnly || indexManifestOnly || reuseSharedAudio) {
        console.log('公共音频包已复用远端 latest manifest');
    } else {
        console.log(dryRun ? '公共音频包预演完成（未上传）' : '公共音频包上传计划已准备');
    }
    console.log(`gameId=${sharedAudioPackResult.gameId}`);
    console.log(`channel=${channel}`);
    console.log(`packageVersion=${sharedAudioPackResult.packageVersion}`);
    console.log(`zipBytes=${sharedAudioPackResult.zipBytes}`);
    console.log(`fileCount=${sharedAudioPackResult.fileCount}`);
    console.log(`bundleKey=${sharedAudioPackResult.bundleKey}`);
    if (sharedAudioPackResult.fileIndexKey) {
        console.log(`fileIndexKey=${sharedAudioPackResult.fileIndexKey}`);
    }
    console.log(`latestManifestKey=${sharedAudioPackResult.latestManifestKey}`);
    console.log(`bundleUrl=${sharedAudioPackResult.bundleUrl}`);
    console.log(`checksum=${sharedAudioPackResult.checksum}`);
    if (sharedAudioPackResult.fileIndexChecksum) {
        console.log(`fileIndexChecksum=${sharedAudioPackResult.fileIndexChecksum}`);
    }
    console.log('---');
}

for (const gameId of targetGames) {
    const result = manifestOnly
        ? await publishGameManifestOnly(gameId, sharedAudioPackResult)
        : indexManifestOnly
            ? await publishSingleGameIndexManifest(gameId, sharedAudioPackResult)
        : await publishSingleGamePackage(gameId, sharedAudioPackResult);
    if (manifestOnly) {
        serverVerificationTargets.push({
            url: result.latestManifestUrl,
            expectedSize: result.manifestBytes,
            expectedSha256: result.manifestChecksum,
        });
    } else if (indexManifestOnly) {
        serverVerificationTargets.push({
            url: result.fileIndexUrl,
            expectedSize: result.fileIndexBytes,
            expectedSha256: result.fileIndexChecksum,
        });
    } else if (result.bundleUrl) {
        serverVerificationTargets.push({
            url: result.bundleUrl,
            expectedSize: result.zipBytes,
        });
    }
    if (manifestOnly) {
        console.log(dryRun ? '游戏 manifest 预演完成（未上传）' : '游戏 manifest 上传计划已准备');
    } else if (indexManifestOnly) {
        console.log(dryRun ? '游戏 file-index/manifest 差异刷新预演完成（未上传 ZIP）' : '游戏 file-index/manifest 上传计划已准备（不上传 ZIP）');
    } else {
        console.log(dryRun ? '游戏包预演完成（未上传）' : '游戏包上传计划已准备');
    }
    console.log(`gameId=${result.gameId}`);
    console.log(`channel=${channel}`);
    console.log(`packageVersion=${result.packageVersion}`);
    console.log(`zipBytes=${result.zipBytes}`);
    console.log(`fileCount=${result.fileCount}`);
    if (result.bundleKey) {
        console.log(`bundleKey=${result.bundleKey}`);
    }
        if (result.fileIndexKey) {
            console.log(`fileIndexKey=${result.fileIndexKey}`);
        }
        console.log(`latestManifestKey=${result.latestManifestKey}`);
    if (result.bundleUrl) {
        console.log(`bundleUrl=${result.bundleUrl}`);
    }
        console.log(`checksum=${result.checksum}`);
        if (result.fileIndexChecksum) {
            console.log(`fileIndexChecksum=${result.fileIndexChecksum}`);
        }
        if (result.fallbackVersion) {
            console.log(`fullZipVersion=${result.fallbackVersion}`);
        }
        if (result.fallbackBundleUrl) {
            console.log(`fullBundleUrl=${result.fallbackBundleUrl}`);
        }
        if (typeof result.uploadedAssetObjectCount === 'number') {
            console.log(`uploadedAssetObjectCount=${result.uploadedAssetObjectCount}`);
        }
        console.log('---');
    }

if (!dryRun) {
    await flushPendingUploads();
    console.log(`服务器主源整批发布完成：${pendingUploads.length} 个对象`);
    await waitForServerAssets(serverVerificationTargets);
}
cleanupTemporaryUploadFiles();

if (explicitGameId && existsSync(path.join(assetsRoot, 'i18n', 'zh-CN', explicitGameId))) {
    const stats = statSync(path.join(assetsRoot, 'i18n', 'zh-CN', explicitGameId));
    console.log(`gameRootMtime=${stats.mtime.toISOString()}`);
}

process.exit(0);
