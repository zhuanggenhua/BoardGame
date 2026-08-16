import { createHash } from 'node:crypto';
import {
    createReadStream,
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { DEFAULT_ANDROID_ASSETS_BASE_URL } from '../mobile/android-assets-base-url.mjs';

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
const DEFAULT_ASSETS_BASE_URL = DEFAULT_ANDROID_ASSETS_BASE_URL;

const normalizeSlashes = (value) => String(value || '').replace(/\\/g, '/');

const normalizeOfficialKey = (key) => {
    const normalized = normalizeSlashes(key).replace(/^\/+/, '');
    if (!normalized.startsWith('official/')) {
        throw new Error(`服务器发布对象 key 非法: ${key}`);
    }
    return normalized;
};

const toOfficialRelativePath = (key) => normalizeOfficialKey(key).slice('official/'.length);

const joinKeyPath = (root, key) => path.join(root, ...normalizeSlashes(key).split('/'));

const stringifyJsonWithTrailingNewline = (payload) => `${JSON.stringify(payload, null, 2)}\n`;

const hashBufferSha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

const hashJsonPayload = (payload) => createHash('sha256')
    .update(stringifyJsonWithTrailingNewline(payload))
    .digest('hex');

const hashFileSha256 = async (filePath) => {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(filePath)) {
        hash.update(chunk);
    }
    return hash.digest('hex');
};

const walkFiles = (root, relativePath = '', output = []) => {
    const directoryPath = relativePath ? path.join(root, relativePath) : root;
    if (!existsSync(directoryPath)) return output;

    for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
        const childRelativePath = relativePath
            ? path.join(relativePath, entry.name)
            : entry.name;
        if (entry.isDirectory()) {
            walkFiles(root, childRelativePath, output);
        } else if (entry.isFile()) {
            output.push(childRelativePath.replace(/\\/g, '/'));
        }
    }
    return output;
};

const readJsonObject = (filePath, label) => {
    try {
        const payload = JSON.parse(readFileSync(filePath, 'utf8'));
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            throw new Error('not an object');
        }
        return payload;
    } catch (error) {
        throw new Error(`${label} 不是有效 JSON 对象: ${error instanceof Error ? error.message : String(error)}`);
    }
};

const writeTextObject = async (releaseDir, key, text) => {
    const normalizedKey = normalizeOfficialKey(key);
    const fullPath = joinKeyPath(releaseDir, normalizedKey);
    mkdirSync(path.dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, text, { encoding: 'utf8', mode: 0o644 });
    const body = Buffer.from(text);
    return {
        key: normalizedKey,
        size: body.byteLength,
        sha256: hashBufferSha256(body),
    };
};

export const discoverPackageManagedGames = ({ rootDir = process.cwd() } = {}) => {
    const gamesRoot = path.join(rootDir, 'src', 'games');
    const gameIds = new Set();

    if (!existsSync(gamesRoot)) {
        return gameIds;
    }

    for (const entry of readdirSync(gamesRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const manifestPath = path.join(gamesRoot, entry.name, 'manifest.ts');
        if (!existsSync(manifestPath)) continue;

        const content = readFileSync(manifestPath, 'utf8');
        if (!/mode:\s*'package-managed'/.test(content)) continue;

        const idMatch = content.match(/id:\s*'([^']+)'/);
        const gameId = idMatch?.[1]?.trim();
        if (gameId) {
            gameIds.add(gameId);
        }
    }

    return gameIds;
};

export const resolvePackageManagedGameId = (relativePath, packageManagedGames) => {
    const normalized = normalizeSlashes(relativePath);
    const parts = normalized.split('/');

    if (parts[0] === 'atlas-configs' && packageManagedGames.has(parts[1])) {
        return parts[1];
    }

    if (parts[0] === 'i18n' && packageManagedGames.has(parts[2])) {
        return parts[2];
    }

    if (packageManagedGames.has(parts[0])) {
        return parts[0];
    }

    return null;
};

const loadSmashUpPodAtlasRuntimePackagePaths = (() => {
    let cached = null;
    return (rootDir) => {
        if (cached) return cached;

        const englishMapPath = path.join(rootDir, 'src', 'games', 'smashup', 'data', 'englishAtlasMap.json');
        const atlasCatalogPath = path.join(rootDir, 'src', 'games', 'smashup', 'domain', 'atlasCatalog.ts');
        if (!existsSync(englishMapPath) || !existsSync(atlasCatalogPath)) {
            cached = new Set();
            return cached;
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

const isPublishableSmashUpAtlasPath = (relativePath, rootDir) => {
    const normalized = normalizeSlashes(relativePath);
    if (SMASHUP_ENGLISH_ATLAS_RELATIVE_PATH_PATTERN.test(normalized)) {
        return loadSmashUpPodAtlasRuntimePackagePaths(rootDir).has(normalized);
    }
    if (SMASHUP_ZH_CN_ATLAS_RELATIVE_PATH_PATTERN.test(normalized)) {
        return SMASHUP_ZH_CN_ANDROID_PACKAGE_ATLAS_PATHS.has(normalized) || normalized.endsWith('_pod.webp');
    }
    return true;
};

const shouldIncludeInGamePackage = (relativePath, gameId, rootDir) => {
    const normalized = normalizeSlashes(relativePath);
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

    if (gameId === 'smashup' && !isPublishableSmashUpAtlasPath(normalized, rootDir)) {
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

const buildGamePackageEntries = (releaseDir, gameId, rootDir) => {
    const officialRoot = path.join(releaseDir, 'official');
    const entries = walkFiles(officialRoot)
        .filter((relativePath) => shouldIncludeInGamePackage(relativePath, gameId, rootDir))
        .map((relativePath) => ({
            relativePath,
            fullPath: path.join(officialRoot, ...relativePath.split('/')),
        }))
        .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
    if (entries.length === 0) {
        throw new Error(`服务器 release 中没有可进入 Android 游戏包的资源: ${gameId}`);
    }
    return entries;
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

const buildIndexOnlyPackageVersion = (packageVersionBase, gameId, fileIndexChecksum) => (
    `${packageVersionBase}-${gameId}-idx-${fileIndexChecksum.slice(0, 12)}`
);

const resolveFullAssetPack = (gameId, assetPack) => {
    const version = assetPack?.fallbackVersion ?? assetPack?.version;
    const url = assetPack?.fallbackUrl ?? assetPack?.url;
    const checksum = assetPack?.fallbackChecksum ?? assetPack?.checksum;
    const bytes = assetPack?.fallbackBytes ?? assetPack?.bytes;

    if (!version || !url || !checksum) {
        throw new Error(`已有 Android 游戏 manifest 缺少完整 ZIP 兜底信息，无法在服务器自动刷新差异索引: ${gameId}`);
    }

    return {
        version,
        url,
        checksum,
        bytes,
    };
};

const readPackageVersionBase = (rootDir) => {
    const packageJson = readJsonObject(path.join(rootDir, 'package.json'), 'package.json');
    if (typeof packageJson.version !== 'string' || !packageJson.version.trim()) {
        throw new Error('package.json 缺少 version，无法生成 Android 素材包索引版本');
    }
    return packageJson.version.trim();
};

const readExistingGameManifest = (releaseDir, channel, gameId) => {
    const manifestKey = `official/mobile-packages/android/${channel}/games/${gameId}.json`;
    const manifestPath = joinKeyPath(releaseDir, manifestKey);
    if (!existsSync(manifestPath)) {
        throw new Error(`缺少已有 Android 游戏 manifest，不能只刷新差异索引: ${manifestKey}`);
    }
    const manifest = readJsonObject(manifestPath, manifestKey);
    if (!manifest.assetPack?.version) {
        throw new Error(`已有 Android 游戏 manifest 不完整，不能只刷新差异索引: ${manifestKey}`);
    }
    resolveFullAssetPack(gameId, manifest.assetPack);
    return manifest;
};

const normalizeRequestedChannels = (value) => (
    String(value || '')
        .split(',')
        .map((channel) => channel.trim())
        .filter(Boolean)
);

const discoverExistingChannels = (releaseDir, gameIds) => {
    const androidRoot = path.join(releaseDir, 'official', 'mobile-packages', 'android');
    const channels = new Set();
    if (!existsSync(androidRoot)) {
        return channels;
    }

    for (const entry of readdirSync(androidRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        for (const gameId of gameIds) {
            if (existsSync(path.join(androidRoot, entry.name, 'games', `${gameId}.json`))) {
                channels.add(entry.name);
            }
        }
    }
    return channels;
};

const resolveRefreshChannels = ({ releaseDir, gameIds, requestedChannels }) => {
    if (requestedChannels && requestedChannels.length > 0) {
        return requestedChannels;
    }
    const envChannels = normalizeRequestedChannels(process.env.ASSET_PUBLISH_ANDROID_CHANNELS);
    if (envChannels.length > 0) {
        return envChannels;
    }
    const envChannel = process.env.VITE_ANDROID_OTA_CHANNEL?.trim();
    if (envChannel) {
        return [envChannel];
    }
    return [...discoverExistingChannels(releaseDir, gameIds)].sort((left, right) => left.localeCompare(right));
};

const buildGameManifestPayload = ({
    gameId,
    channel,
    packageVersion,
    fileCount,
    fileIndexUrl,
    fileIndexChecksum,
    fallbackAssetPack,
    previousManifest,
    assetsBaseUrl,
}) => ({
    gameId,
    runtimeChannel: channel,
    publishedAt: new Date().toISOString(),
    modulePack: previousManifest.modulePack ?? null,
    assetPack: {
        id: gameId,
        version: packageVersion,
        fileCount,
        fileIndexUrl,
        fileIndexChecksum,
        diffOnly: true,
        fallbackUrl: fallbackAssetPack.url,
        fallbackVersion: fallbackAssetPack.version,
        fallbackChecksum: fallbackAssetPack.checksum,
        fallbackBytes: fallbackAssetPack.bytes,
    },
    sharedAudioPack: previousManifest.sharedAudioPack ?? null,
    assetsBaseUrl,
});

const refreshSingleGameIndexManifest = async ({
    releaseDir,
    rootDir,
    channel,
    gameId,
    packageVersionBase,
    assetsBaseUrl,
}) => {
    const previousManifest = readExistingGameManifest(releaseDir, channel, gameId);
    const fallbackAssetPack = resolveFullAssetPack(gameId, previousManifest.assetPack);
    const includedFiles = buildGamePackageEntries(releaseDir, gameId, rootDir);
    const provisionalVersion = `${packageVersionBase}-${gameId}-idx-pending`;
    const provisionalFileIndexPayload = await buildFileIndexPayload(includedFiles, provisionalVersion);
    const provisionalFileIndexChecksum = hashJsonPayload(provisionalFileIndexPayload);
    const packageVersion = buildIndexOnlyPackageVersion(packageVersionBase, gameId, provisionalFileIndexChecksum);
    const fileIndexPayload = await buildFileIndexPayload(includedFiles, packageVersion);
    const fileIndexChecksum = hashJsonPayload(fileIndexPayload);
    const packagePrefix = `official/mobile-packages/android/${channel}`;
    const fileIndexKey = `${packagePrefix}/file-index/${gameId}/${packageVersion}.json`;
    const versionManifestKey = `${packagePrefix}/manifests/${gameId}/${packageVersion}.json`;
    const latestManifestKey = `${packagePrefix}/games/${gameId}.json`;
    const fileIndexUrl = `${assetsBaseUrl}/mobile-packages/android/${channel}/file-index/${encodeURIComponent(gameId)}/${encodeURIComponent(packageVersion)}.json`;
    const manifest = buildGameManifestPayload({
        gameId,
        channel,
        packageVersion,
        fileCount: includedFiles.length,
        fileIndexUrl,
        fileIndexChecksum,
        fallbackAssetPack,
        previousManifest,
        assetsBaseUrl,
    });
    delete manifest.assetsBaseUrl;

    const fileIndexJson = stringifyJsonWithTrailingNewline(fileIndexPayload);
    const manifestJson = stringifyJsonWithTrailingNewline(manifest);
    return [
        await writeTextObject(releaseDir, fileIndexKey, fileIndexJson),
        await writeTextObject(releaseDir, versionManifestKey, manifestJson),
        await writeTextObject(releaseDir, latestManifestKey, manifestJson),
    ];
};

const isSharedAudioObjectKey = (key) => {
    const relativePath = toOfficialRelativePath(key);
    const normalized = normalizeSlashes(relativePath);
    const parts = normalized.split('/');
    return normalized.startsWith(SHARED_AUDIO_PREFIX)
        && path.extname(normalized).toLowerCase() === '.ogg'
        && parts.includes(COMPRESSED_DIR_NAME)
        && !TEMPORARY_ASSET_NAME_PATTERN.test(normalized);
};

export const resolveAndroidPackageRefreshPlan = ({
    publishedKeys,
    packageManagedGames = discoverPackageManagedGames(),
} = {}) => {
    const gameIds = new Set();
    let hasSharedAudioChanges = false;

    for (const key of publishedKeys ?? []) {
        const relativePath = toOfficialRelativePath(key);
        const gameId = resolvePackageManagedGameId(relativePath, packageManagedGames);
        if (gameId) {
            gameIds.add(gameId);
        }
        if (isSharedAudioObjectKey(key)) {
            hasSharedAudioChanges = true;
        }
    }

    return {
        gameIds: [...gameIds].sort((left, right) => left.localeCompare(right)),
        hasSharedAudioChanges,
    };
};

export const refreshAndroidPackageIndexesForPublishedAssets = async ({
    releaseDir,
    publishedKeys,
    rootDir = process.cwd(),
    requestedChannels,
    assetsBaseUrl = (process.env.VITE_ASSETS_BASE_URL?.trim() || DEFAULT_ASSETS_BASE_URL).replace(/\/+$/, ''),
    packageVersionBase = readPackageVersionBase(rootDir),
} = {}) => {
    if (!releaseDir) {
        throw new Error('缺少服务器 release 目录，无法刷新 Android 素材包索引');
    }

    const packageManagedGames = discoverPackageManagedGames({ rootDir });
    const plan = resolveAndroidPackageRefreshPlan({
        publishedKeys,
        packageManagedGames,
    });

    if (plan.hasSharedAudioChanges) {
        throw new Error('共享音频素材上传尚未接入服务器端自动刷新；请走 Android 素材包共享音频发布流程，不能半自动发布。');
    }

    if (plan.gameIds.length === 0) {
        return {
            gameIds: [],
            channels: [],
            objects: [],
            hasSharedAudioChanges: false,
        };
    }

    const channels = resolveRefreshChannels({
        releaseDir,
        gameIds: plan.gameIds,
        requestedChannels,
    });
    if (channels.length === 0) {
        throw new Error(`没有找到已有 Android 素材包 channel，无法在服务器自动刷新差异索引: ${plan.gameIds.join(', ')}`);
    }

    const objects = [];
    for (const channel of channels) {
        for (const gameId of plan.gameIds) {
            objects.push(...await refreshSingleGameIndexManifest({
                releaseDir,
                rootDir,
                channel,
                gameId,
                packageVersionBase,
                assetsBaseUrl,
            }));
        }
    }

    return {
        ...plan,
        channels,
        objects,
    };
};
