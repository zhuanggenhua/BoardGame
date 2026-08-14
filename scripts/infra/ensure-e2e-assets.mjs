import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const normalize = (value) => String(value || '').trim().replace(/\\/g, '/');

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

    const args = ['scripts/assets/download-from-server.js'];
    for (const gameId of gameIds) args.push('--game', gameId);
    console.log(`🧩 E2E 自动准备素材：${gameIds.join(', ')}`);
    runAssetCommand(args, `E2E 素材准备失败: gameIds=${gameIds.join(',')}`);

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
