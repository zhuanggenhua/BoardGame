import { createHash } from 'node:crypto';
import {
    createWriteStream,
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    renameSync,
    rmSync,
    statSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { isPublishableActiveObjectKey } from './active-server-assets.mjs';

const DEFAULT_INVENTORY_URL = 'https://assets-upload.easyboardgame.top/asset-publish';
const DEFAULT_ASSETS_BASE_URL = 'https://assets.easyboardgame.top';
const DEFAULT_CONCURRENCY = 4;
const MAX_INVENTORY_BYTES = 16 * 1024 * 1024;

const COMMON_RUNTIME_AUDIO_REGISTRY = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../src/assets/audio/registry-slim.json',
);

const loadCommonRuntimeAudioKeys = () => {
    const registry = JSON.parse(readFileSync(COMMON_RUNTIME_AUDIO_REGISTRY, 'utf8'));
    if (!Array.isArray(registry?.entries)) {
        throw new Error(`公共运行时音频注册表无效: ${COMMON_RUNTIME_AUDIO_REGISTRY}`);
    }

    return new Set(registry.entries
        .map((entry) => String(entry?.src || '').replace(/\\/g, '/'))
        .filter((source) => source.endsWith('.ogg'))
        .map((source) => {
            const separator = source.lastIndexOf('/');
            if (separator < 0) return '';
            return `official/common/audio/${source.slice(0, separator)}/compressed/${source.slice(separator + 1)}`;
        })
        .filter(Boolean));
};

const COMMON_RUNTIME_AUDIO_KEYS = loadCommonRuntimeAudioKeys();

const normalizeGameId = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(normalized)) {
        throw new Error(`gameId 非法: ${value}`);
    }
    return normalized;
};

export const matchesGameAssetKey = (key, gameId) => {
    const normalizedKey = String(key || '').replace(/\\/g, '/');
    const normalizedGameId = normalizeGameId(gameId);
    return normalizedKey.startsWith(`official/${normalizedGameId}/`)
        || normalizedKey.startsWith(`official/atlas-configs/${normalizedGameId}/`)
        || normalizedKey.startsWith(`official/common/`)
        || new RegExp(`^official/i18n/[^/]+/${normalizedGameId}/`).test(normalizedKey);
};

export const isSharedRuntimeAssetKey = (key) => {
    const normalizedKey = String(key || '').replace(/\\/g, '/');
    if (!normalizedKey.startsWith('official/common/')) return false;
    if (!normalizedKey.startsWith('official/common/audio/')) return true;
    return COMMON_RUNTIME_AUDIO_KEYS.has(normalizedKey);
};

const isSafeManifestAssetPath = (value) => typeof value === 'string'
    && value.length > 0
    && value.trim() === value
    && !value.startsWith('/')
    && !value.includes('\\')
    && !/^[A-Za-z]:/.test(value)
    && !/^[a-z][a-z0-9+.-]*:/i.test(value)
    && value.split('/').every((segment) => segment && segment !== '.' && segment !== '..');

const getRuntimeAssetManifestPaths = ({ assetsDir, gameIds, all }) => {
    const normalizedGameIds = new Set(gameIds.map(normalizeGameId));
    const paths = new Set();
    const addGameManifest = (gameRoot) => {
        const manifestPath = path.join(gameRoot, 'assets-manifest.json');
        if (existsSync(manifestPath)) paths.add(path.resolve(manifestPath));
    };

    if (all) {
        for (const entry of readdirSync(assetsDir, { withFileTypes: true })) {
            if (entry.isDirectory() && entry.name !== 'i18n' && entry.name !== 'atlas-configs') {
                addGameManifest(path.join(assetsDir, entry.name));
            }
        }
    } else {
        for (const gameId of normalizedGameIds) addGameManifest(path.join(assetsDir, gameId));
    }

    const i18nRoot = path.join(assetsDir, 'i18n');
    if (existsSync(i18nRoot)) {
        for (const locale of readdirSync(i18nRoot, { withFileTypes: true })) {
            if (!locale.isDirectory()) continue;
            const localeRoot = path.join(i18nRoot, locale.name);
            for (const game of readdirSync(localeRoot, { withFileTypes: true })) {
                if (!game.isDirectory() || (!all && !normalizedGameIds.has(game.name))) continue;
                addGameManifest(path.join(localeRoot, game.name));
            }
        }
    }

    return [...paths].sort((left, right) => left.localeCompare(right));
};

export const loadRuntimeManifestObjects = ({
    assetsDir = path.join(process.cwd(), 'public', 'assets'),
    gameIds = [],
    all = false,
} = {}) => {
    if (!all && gameIds.length === 0) {
        throw new Error('加载运行时素材 manifest 必须指定 --game <gameId>，或明确使用 --all');
    }

    const runtimeObjects = new Map();
    for (const manifestPath of getRuntimeAssetManifestPaths({ assetsDir, gameIds, all })) {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        if (manifest?.manifestVersion !== 1
            || manifest.scope !== 'official'
            || !manifest.files
            || Array.isArray(manifest.files)
            || typeof manifest.files !== 'object') {
            throw new Error('运行时素材 manifest 无效: ' + manifestPath);
        }

        const relativeDirectory = path.relative(assetsDir, path.dirname(manifestPath)).replace(/\\/g, '/');
        const expectedBasePrefix = 'official/' + relativeDirectory + '/';
        if (manifest.basePrefix !== expectedBasePrefix) {
            throw new Error('运行时素材 manifest basePrefix 不匹配: ' + manifestPath);
        }
        if (!all && ![...gameIds].map(normalizeGameId).some((gameId) => matchesGameAssetKey(expectedBasePrefix, gameId))) {
            throw new Error('运行时素材 manifest 不属于指定 gameId: ' + manifestPath);
        }

        for (const [logicalPath, definition] of Object.entries(manifest.files)) {
            if (!isSafeManifestAssetPath(logicalPath)
                || !definition?.variants
                || Array.isArray(definition.variants)
                || typeof definition.variants !== 'object') {
                continue;
            }
            for (const [rawExtension, variant] of Object.entries(definition.variants)) {
                const extension = rawExtension.replace(/^\./, '');
                if (!/^[a-z0-9]+$/i.test(extension)) continue;
                const key = expectedBasePrefix + logicalPath + '.' + extension;
                if (!isPublishableActiveObjectKey(key)) continue;
                if (!Number.isSafeInteger(variant?.bytes)
                    || variant.bytes < 0
                    || !/^[a-f0-9]{64}$/i.test(String(variant?.sha256 || ''))) {
                    throw new Error('运行时素材 manifest 缺少有效 size/hash: ' + key);
                }
                const metadata = { size: variant.bytes, sha256: variant.sha256.toLowerCase() };
                const existing = runtimeObjects.get(key);
                if (existing && (existing.size !== metadata.size || existing.sha256 !== metadata.sha256)) {
                    throw new Error('多个运行时 manifest 对象元数据冲突: ' + key);
                }
                runtimeObjects.set(key, metadata);
            }
        }
    }
    return runtimeObjects;
};

export const mergeRuntimeManifestObjects = (inventoryObjects, runtimeManifestObjects) => {
    if (!(inventoryObjects instanceof Map) || !(runtimeManifestObjects instanceof Map)) {
        throw new Error('服务器清单和运行时 manifest 对象必须是 Map');
    }

    const objects = new Map(inventoryObjects);
    const inventoryMissing = [];
    for (const [key, manifestMetadata] of runtimeManifestObjects) {
        const inventoryMetadata = inventoryObjects.get(key);
        if (!inventoryMetadata) {
            objects.set(key, manifestMetadata);
            inventoryMissing.push(key);
            continue;
        }
        if (inventoryMetadata.size !== manifestMetadata.size
            || String(inventoryMetadata.sha256 || '').toLowerCase() !== manifestMetadata.sha256) {
            throw new Error('服务器素材清单与运行时 manifest 元数据不一致: ' + key);
        }
    }
    return { objects, inventoryMissing: inventoryMissing.sort((left, right) => left.localeCompare(right)) };
};

export const selectAssetKeys = (objects, { gameIds = [], all = false } = {}) => {
    if (!(objects instanceof Map)) {
        throw new Error('服务器素材清单必须是 Map');
    }
    const normalizedGameIds = gameIds.map(normalizeGameId);
    if (!all && normalizedGameIds.length === 0) {
        throw new Error('请指定 --game <gameId>，或明确使用 --all');
    }

    return [...objects.keys()]
        .filter(isPublishableActiveObjectKey)
        .filter((key) => all || normalizedGameIds.some((gameId) => (
            matchesGameAssetKey(key, gameId)
            && (!key.startsWith('official/common/') || isSharedRuntimeAssetKey(key))
        )))
        .sort((left, right) => left.localeCompare(right));
};

const readResponseBytes = async (response, maxBytes) => {
    const contentLength = Number(response.headers.get('content-length') || '0');
    if (contentLength > maxBytes) {
        throw new Error(`响应超过限制: ${contentLength} > ${maxBytes}`);
    }
    const chunks = [];
    let total = 0;
    for await (const chunk of response.body) {
        total += chunk.length;
        if (total > maxBytes) {
            throw new Error(`响应超过限制: ${total} > ${maxBytes}`);
        }
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
};

export const fetchAssetInventory = async ({ inventoryUrl = process.env.ASSET_SERVER_ASSET_INDEX_URL || DEFAULT_INVENTORY_URL } = {}) => {
    const response = await fetch(inventoryUrl, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
        throw new Error(`读取服务器素材清单失败: HTTP ${response.status}`);
    }
    const body = JSON.parse((await readResponseBytes(response, MAX_INVENTORY_BYTES)).toString('utf8'));
    if (!body?.ok || !Array.isArray(body.objects)) {
        throw new Error('服务器素材清单响应无效');
    }
    return new Map(body.objects.map((object) => [object.key, {
        size: object.size,
        sha256: object.sha256,
    }]));
};

const hashBuffer = (buffer) => createHash('sha256').update(buffer).digest('hex');

const shouldSkipExisting = (filePath, object) => {
    if (!existsSync(filePath)) return false;
    const stats = statSync(filePath);
    if (stats.size !== object.size) return false;
    return hashBuffer(readFileSync(filePath)) === object.sha256;
};

export const downloadAssetKeys = async ({
    objects,
    keys,
    assetsDir = path.join(process.cwd(), 'public', 'assets'),
    assetsBaseUrl = process.env.ASSET_SERVER_ASSETS_BASE_URL || DEFAULT_ASSETS_BASE_URL,
    concurrency = Number.parseInt(process.env.ASSET_DOWNLOAD_CONCURRENCY || String(DEFAULT_CONCURRENCY), 10),
    dryRun = false,
    fetchImpl = fetch,
} = {}) => {
    const safeConcurrency = Number.isSafeInteger(concurrency) && concurrency > 0 ? concurrency : DEFAULT_CONCURRENCY;
    const selectedKeys = [...keys];
    let downloaded = 0;
    let skipped = 0;
    let nextIndex = 0;
    const worker = async () => {
        while (nextIndex < selectedKeys.length) {
            const key = selectedKeys[nextIndex];
            nextIndex += 1;
            const object = objects.get(key);
            if (!object) throw new Error(`服务器素材清单缺少对象: ${key}`);
            const relativePath = key.slice('official/'.length);
            const filePath = path.resolve(assetsDir, relativePath);
            if (!filePath.startsWith(`${path.resolve(assetsDir)}${path.sep}`)) {
                throw new Error(`素材路径越界: ${key}`);
            }
            if (shouldSkipExisting(filePath, object)) {
                skipped += 1;
                continue;
            }
            if (dryRun) {
                downloaded += 1;
                continue;
            }
            const response = await fetchImpl(`${assetsBaseUrl.replace(/\/$/, '')}/${key}`, {
                headers: { Accept: '*/*' },
            });
            if (!response.ok) {
                throw new Error(`下载素材失败: ${key} HTTP ${response.status}`);
            }
            const body = await readResponseBytes(response, Math.max(object.size, 1));
            if (body.length !== object.size || hashBuffer(body) !== object.sha256) {
                throw new Error(`素材校验失败: ${key}`);
            }
            mkdirSync(path.dirname(filePath), { recursive: true });
            const tempPath = `${filePath}.download-${process.pid}`;
            await pipeline(Readable.from([body]), createWriteStream(tempPath));
            renameSync(tempPath, filePath);
            downloaded += 1;
        }
    };
    await Promise.all(Array.from({ length: Math.min(safeConcurrency, selectedKeys.length) }, () => worker()));
    return { selected: selectedKeys.length, downloaded, skipped };
};

export const runDownloadCli = async (argv = process.argv.slice(2)) => {
    const gameIds = [];
    let all = false;
    let dryRun = false;
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--game' && argv[index + 1]) {
            gameIds.push(argv[++index]);
        } else if (arg.startsWith('--game=')) {
            gameIds.push(arg.slice('--game='.length));
        } else if (arg === '--all') {
            all = true;
        } else if (arg === '--dry-run') {
            dryRun = true;
        } else if (arg === '--help' || arg === '-h') {
            console.log('用法: npm run assets:download -- --game <gameId> [--game <gameId> ...] [--dry-run]');
            console.log('全量运行时素材下载必须显式使用: npm run assets:download -- --all');
            return 0;
        } else if (!arg.startsWith('-')) {
            gameIds.push(arg);
        } else {
            throw new Error(`未知参数: ${arg}`);
        }
    }
    const inventoryObjects = await fetchAssetInventory();
    const assetsDir = path.join(process.cwd(), 'public', 'assets');
    const runtimeManifestObjects = loadRuntimeManifestObjects({ assetsDir, gameIds, all });
    const merged = mergeRuntimeManifestObjects(inventoryObjects, runtimeManifestObjects);
    const keys = selectAssetKeys(merged.objects, { gameIds, all });
    const result = await downloadAssetKeys({ objects: merged.objects, keys, assetsDir, dryRun });
    const supplemental = merged.inventoryMissing.length
        ? '（远端清单漏列 ' + merged.inventoryMissing.length + ' 项）'
        : '';
    console.log((dryRun ? '素材下载计划：' : '素材下载完成：') + '选择 ' + result.selected
        + (dryRun ? '，计划下载 ' : '，下载 ') + result.downloaded
        + '，本地 hash 一致跳过 ' + result.skipped
        + '，运行 manifest 补充 ' + merged.inventoryMissing.length + supplemental);
    return 0;
};

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
    runDownloadCli().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
