import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const normalize = (value) => String(value || '').trim().replace(/\\/g, '/');

const normalizeGameId = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(normalized)) return '';
    return normalized;
};

const hashFile = (filePath) => createHash('sha256').update(readFileSync(filePath)).digest('hex');

const isSafeChildPath = (root, child) => {
    const resolvedRoot = path.resolve(root);
    const resolvedChild = path.resolve(child);
    return resolvedChild.startsWith(`${resolvedRoot}${path.sep}`);
};

const gameUsesPublicAtlasConfigs = (gameId) => {
    const gameSourceRoot = path.join(process.cwd(), 'src', 'games', gameId);
    if (!existsSync(gameSourceRoot)) return false;

    const stack = [gameSourceRoot];
    const atlasNeedle = `atlas-configs/${gameId}`;
    const windowsAtlasNeedle = `atlas-configs\\${gameId}`;
    while (stack.length > 0) {
        const current = stack.pop();
        if (!current) continue;
        for (const entry of readdirSync(current, { withFileTypes: true })) {
            const entryPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(entryPath);
                continue;
            }
            if (!/\.(?:[cm]?[jt]sx?|json)$/.test(entry.name)) {
                continue;
            }
            const content = readFileSync(entryPath, 'utf8');
            if (content.includes(atlasNeedle) || content.includes(windowsAtlasNeedle)) {
                return true;
            }
        }
    }
    return false;
};

const hasValidManifestVariantFile = (root, relativeKey, extension, variant) => {
    const filePath = path.join(root, `${relativeKey}.${extension}`);
    if (!isSafeChildPath(root, filePath) || !existsSync(filePath)) return false;

    const expectedBytes = Number(variant?.bytes);
    if (Number.isFinite(expectedBytes) && statSync(filePath).size !== expectedBytes) return false;

    const expectedSha256 = typeof variant?.sha256 === 'string' ? variant.sha256 : '';
    if (expectedSha256 && hashFile(filePath) !== expectedSha256) return false;

    return true;
};

const hasValidCompressedReplacement = (root, files, relativeKey) => {
    const separator = relativeKey.lastIndexOf('/');
    const compressedKey = separator >= 0
        ? `${relativeKey.slice(0, separator)}/compressed/${relativeKey.slice(separator + 1)}`
        : `compressed/${relativeKey}`;
    const compressedVariants = files?.[compressedKey]?.variants;
    if (!compressedVariants || typeof compressedVariants !== 'object') return false;

    return Object.entries(compressedVariants).some(([extension, variant]) => (
        extension === 'webp' && hasValidManifestVariantFile(root, compressedKey, extension, variant)
    ));
};

export const hasCompleteLocalE2EAssetPackage = (
    gameId,
    { assetsRoot = path.join(process.cwd(), 'public', 'assets') } = {},
) => {
    const normalizedGameId = normalizeGameId(gameId);
    if (!normalizedGameId) return false;

    const gameRoot = path.join(assetsRoot, 'i18n', 'zh-CN', normalizedGameId);
    const manifestPath = path.join(gameRoot, 'assets-manifest.json');
    const atlasRoot = path.join(assetsRoot, 'atlas-configs', normalizedGameId);
    if (!existsSync(manifestPath)) return false;
    if (gameUsesPublicAtlasConfigs(normalizedGameId) && !existsSync(atlasRoot)) return false;

    let manifest;
    try {
        manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch {
        return false;
    }

    const files = manifest?.files;
    if (!files || typeof files !== 'object') return false;

    for (const [relativeKey, descriptor] of Object.entries(files)) {
        const variants = descriptor?.variants;
        if (!variants || typeof variants !== 'object') return false;

        for (const [extension, variant] of Object.entries(variants)) {
            if (!hasValidManifestVariantFile(gameRoot, relativeKey, extension, variant)) {
                if (hasValidCompressedReplacement(gameRoot, files, relativeKey)) {
                    continue;
                }
                return false;
            }
        }
    }

    return true;
};

export const resolveE2EAssetGameIds = (targetPath, env = process.env) => {
    const explicit = String(env.PW_ASSET_GAME_IDS || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);
    if (explicit.length > 0) return [...new Set(explicit)];

    const normalizedTarget = normalize(targetPath);
    const match = normalizedTarget.match(/(?:^|\/)e2e\/([^/]+)(?:\/|$)/i);
    if (!match) return [];
    const candidate = match[1];
    if (candidate.startsWith('_') || candidate === 'helpers' || candidate === 'fixtures') return [];
    return existsSync(path.join(process.cwd(), 'src', 'games', candidate)) ? [candidate] : [];
};

export const ensureE2EAssets = ({ targetPath, env = process.env, runner = process.execPath } = {}) => {
    const gameIds = resolveE2EAssetGameIds(targetPath, env);
    if (gameIds.length === 0 || env.PW_E2E_LIST_ONLY === 'true' || env.PW_SKIP_ASSET_BOOTSTRAP === 'true') {
        return { gameIds, skipped: true };
    }

    const runAssetCommand = (args, errorMessage) => {
        const result = spawnSync(runner, args, {
            cwd: process.cwd(),
            env,
            stdio: 'inherit',
            shell: false,
        });
        if (result.error) throw result.error;
        if (result.status !== 0) throw new Error(errorMessage);
    };

    if (gameIds.every((gameId) => hasCompleteLocalE2EAssetPackage(gameId))) {
        console.log(`🧩 E2E 使用本地完整素材包：${gameIds.join(', ')}`);
    } else {
        const args = ['scripts/assets/download-from-server.js'];
        for (const gameId of gameIds) args.push('--game', gameId);
        console.log(`🧩 E2E 本地素材缺失，先从服务器同步到本地：${gameIds.join(', ')}`);
        runAssetCommand(args, `E2E 素材准备失败: gameIds=${gameIds.join(',')}`);
    }

    for (const gameId of gameIds) {
        const gameI18nRoot = path.join(process.cwd(), 'public', 'assets', 'i18n', 'zh-CN', gameId);
        if (!existsSync(gameI18nRoot)) continue;
        runAssetCommand(
            ['scripts/assets/generate_asset_manifests.js', '--root', 'public/assets/i18n/zh-CN', '--id', gameId],
            `E2E 游戏级资源清单生成失败: gameId=${gameId}`,
        );
    }
    runAssetCommand(
        ['scripts/assets/generate_asset_manifests.js', '--root', 'public/assets', '--id', 'i18n'],
        'E2E 根级 i18n 资源清单生成失败',
    );
    runAssetCommand(
        ['scripts/assets/generate_asset_manifests.js', '--root', 'public/assets', '--id', 'atlas-configs'],
        'E2E atlas 资源清单生成失败',
    );
    return { gameIds, skipped: false };
};

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
    const targetPath = process.argv[2] || process.env.PW_TEST_TARGET || '';
    ensureE2EAssets({ targetPath });
}
