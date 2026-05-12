/**
 * Vite 插件：为 public/assets/ 下的静态资源生成 content hash 映射，
 * 并注入语言化图片存在索引。
 *
 * - __ASSET_HASHES__: 构建时为资源 URL 追加 ?v=<hash>
 * - __LOCALIZED_IMAGE_INDEX__: 运行时在发图前就知道某语言是否存在该图
 *
 * assets-manifest.json 也是资源索引来源：
 * - 本地缺失但 manifest 已登记的远端资源，仍应进入语言化图片索引
 * - 构建 hash 优先使用本地实际文件，远端-only 条目使用 manifest sha256
 *
 * 开发模式继续返回空的 __ASSET_HASHES__，避免干扰调试；
 * 但会注入“本地文件 + manifest”的 __LOCALIZED_IMAGE_INDEX__，用于本地/R2候选决策。
 */
import { readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';
import { createHash } from 'crypto';
import type { Plugin } from 'vite';

const LOCALIZED_IMAGE_EXTENSIONS = new Set(['avif', 'webp', 'png', 'jpg', 'jpeg', 'gif', 'svg']);
const MANIFEST_NAME = 'assets-manifest.json';

type AssetManifestVariant = {
    sha256?: string;
};

type AssetManifestFile = {
    variants?: Record<string, AssetManifestVariant>;
};

type AssetManifest = {
    basePrefix?: string;
    files?: Record<string, AssetManifestFile>;
};

type ManifestScanResult = {
    hashes: Record<string, string>;
    localizedImageIndex: Record<string, 1>;
};

function scanAssetHashes(assetsDir: string): Record<string, string> {
    const hashes: Record<string, string> = {};

    function walk(dir: string) {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
                continue;
            }

            const rel = relative(assetsDir, fullPath).replace(/\\/g, '/');
            const content = readFileSync(fullPath);
            const hash = createHash('md5').update(content).digest('hex').slice(0, 8);
            hashes[rel] = hash;
        }
    }

    walk(assetsDir);
    return hashes;
}

function scanLocalizedImageIndex(assetsDir: string): Record<string, 1> {
    const index: Record<string, 1> = {};

    function walk(dir: string) {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
                continue;
            }

            const rel = relative(assetsDir, fullPath).replace(/\\/g, '/');
            if (!rel.startsWith('i18n/')) {
                continue;
            }

            const ext = rel.includes('.') ? rel.slice(rel.lastIndexOf('.') + 1).toLowerCase() : '';
            if (!LOCALIZED_IMAGE_EXTENSIONS.has(ext)) {
                continue;
            }

            index[rel.slice(0, -(ext.length + 1))] = 1;
        }
    }

    walk(assetsDir);
    return index;
}

function toRelativeFromManifest(basePrefix: string | undefined, key: string, ext: string): string | null {
    const normalizedBase = (basePrefix ?? '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (!normalizedBase.startsWith('official/')) {
        return null;
    }

    const assetBase = normalizedBase.slice('official/'.length);
    if (!assetBase) {
        return null;
    }

    const normalizedKey = key.replace(/\\/g, '/').replace(/^\/+/, '');
    const normalizedExt = ext.replace(/^\./, '').toLowerCase();
    if (!normalizedKey || !normalizedExt) {
        return null;
    }

    return `${assetBase}/${normalizedKey}.${normalizedExt}`;
}

function addLocalizedImageIndex(index: Record<string, 1>, rel: string): void {
    if (!rel.startsWith('i18n/')) {
        return;
    }

    const ext = rel.includes('.') ? rel.slice(rel.lastIndexOf('.') + 1).toLowerCase() : '';
    if (!LOCALIZED_IMAGE_EXTENSIONS.has(ext)) {
        return;
    }

    index[rel.slice(0, -(ext.length + 1))] = 1;
}

function scanManifestIndexes(assetsDir: string): ManifestScanResult {
    const result: ManifestScanResult = { hashes: {}, localizedImageIndex: {} };

    function walk(dir: string) {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
                continue;
            }

            if (entry.name !== MANIFEST_NAME) {
                continue;
            }

            let manifest: AssetManifest;
            try {
                manifest = JSON.parse(readFileSync(fullPath, 'utf8')) as AssetManifest;
            } catch {
                // manifest 由独立脚本负责校验；Vite 插件不因单个坏清单阻断 dev server 启动。
                continue;
            }

            const files = manifest.files && typeof manifest.files === 'object' ? manifest.files : {};
            for (const [key, file] of Object.entries(files)) {
                const variants = file.variants && typeof file.variants === 'object' ? file.variants : {};
                for (const [ext, variant] of Object.entries(variants)) {
                    const rel = toRelativeFromManifest(manifest.basePrefix, key, ext);
                    if (!rel) {
                        continue;
                    }

                    if (variant.sha256) {
                        result.hashes[rel] = variant.sha256.slice(0, 8);
                    }
                    addLocalizedImageIndex(result.localizedImageIndex, rel);
                }
            }
        }
    }

    walk(assetsDir);
    return result;
}

export default function assetHashPlugin(): Plugin {
    return {
        name: 'vite-asset-hash',
        config(_, { command }) {
            const assetsDir = join(process.cwd(), 'public', 'assets');
            const manifestIndexes = scanManifestIndexes(assetsDir);
            const localizedImageIndex = {
                ...manifestIndexes.localizedImageIndex,
                ...scanLocalizedImageIndex(assetsDir),
            };

            if (command === 'build') {
                const hashes = {
                    ...manifestIndexes.hashes,
                    ...scanAssetHashes(assetsDir),
                };
                return {
                    define: {
                        __ASSET_HASHES__: JSON.stringify(hashes),
                        __LOCALIZED_IMAGE_INDEX__: JSON.stringify(localizedImageIndex),
                    },
                };
            }

            return {
                define: {
                    __ASSET_HASHES__: JSON.stringify({}),
                    __LOCALIZED_IMAGE_INDEX__: JSON.stringify(localizedImageIndex),
                },
            };
        },
    };
}
