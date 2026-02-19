import { readFile } from 'fs/promises';
import { join, resolve, sep } from 'path';
import { createUgcGame } from '../games/ugc-wrapper/game';
import { getUgcPackageModel } from './models/UgcPackage';
import logger from '../../server/logger';

export const parseNumberArray = (value: unknown): number[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const parsed = value
        .map((item) => (typeof item === 'number' ? item : Number(item)))
        .filter((item) => Number.isFinite(item) && item > 0);
    return parsed.length > 0 ? parsed : undefined;
};

export const resolveUgcEntryPath = (
    manifest: Record<string, unknown> | null | undefined,
    ownerId: string,
    packageId: string
): string | null => {
    if (manifest && typeof manifest === 'object') {
        const entryPoints = (manifest as Record<string, unknown>).entryPoints;
        if (entryPoints && typeof entryPoints === 'object') {
            const rules = (entryPoints as Record<string, unknown>).rules;
            if (typeof rules === 'string' && rules.trim()) {
                return rules.trim();
            }
        }
        const files = (manifest as Record<string, unknown>).files;
        if (Array.isArray(files) && files.includes('domain.js')) {
            return `ugc/${ownerId}/${packageId}/domain.js`;
        }
    }
    return `ugc/${ownerId}/${packageId}/domain.js`;
};

export const resolveUgcFilePath = (entryPath: string): string | null => {
    const storageBase = resolve(process.env.UGC_LOCAL_PATH || join(process.cwd(), 'uploads'));
    const publicBase = (process.env.UGC_PUBLIC_URL_BASE || '/assets').replace(/\/+$/, '');
    let relative = entryPath.split('?')[0]?.split('#')[0] ?? '';
    if (!relative) return null;
    if (relative.startsWith('http://') || relative.startsWith('https://')) {
        const idx = relative.indexOf('/ugc/');
        if (idx === -1) return null;
        relative = relative.slice(idx + 1);
    }
    if (publicBase && relative.startsWith(publicBase)) {
        relative = relative.slice(publicBase.length);
    }
    const ugcIndex = relative.indexOf('ugc/');
    if (ugcIndex >= 0) {
        relative = relative.slice(ugcIndex);
    }
    relative = relative.replace(/^[/\\]+/, '');
    const fullPath = resolve(storageBase, relative);
    if (fullPath === storageBase) return null;
    if (!fullPath.startsWith(storageBase + sep)) return null;
    return fullPath;
};

export const loadUgcDomainCode = async (entryPath: string, packageId: string): Promise<string | null> => {
    const filePath = resolveUgcFilePath(entryPath);
    if (!filePath) {
        logger.warn(`[UGC] 入口路径无效: packageId=${packageId} path=${entryPath}`);
        return null;
    }
    try {
        return await readFile(filePath, 'utf-8');
    } catch (error) {
        logger.warn(`[UGC] 读取规则失败: packageId=${packageId} path=${entryPath}`, error);
        return null;
    }
};

export const resolvePlayerRange = (manifest: Record<string, unknown> | null | undefined) => {
    const metadata = manifest && typeof manifest === 'object'
        ? (manifest as Record<string, unknown>).metadata
        : undefined;
    const metadataRecord = metadata && typeof metadata === 'object'
        ? (metadata as Record<string, unknown>)
        : undefined;
    const playerOptions = metadataRecord ? parseNumberArray(metadataRecord.playerOptions) : undefined;
    if (!playerOptions || playerOptions.length === 0) {
        return { minPlayers: undefined, maxPlayers: undefined };
    }
    return {
        minPlayers: Math.min(...playerOptions),
        maxPlayers: Math.max(...playerOptions),
    };
};

const normalizeGameId = (name?: string) => (name || '').toLowerCase();

import type { GameEngineConfig } from '../engine/transport/server';

export const buildUgcServerGames = async (options?: {
    existingGameIds?: Set<string>;
}): Promise<{ engineConfigs: GameEngineConfig[]; gameIds: string[] }> => {
    const engineConfigs: GameEngineConfig[] = [];
    const gameIds: string[] = [];
    const manifestGameIds = options?.existingGameIds ?? new Set<string>();

    const UgcPackage = getUgcPackageModel();
    const publishedPackages = await UgcPackage.find({ status: 'published' })
        .sort({ publishedAt: -1 })
        .lean();

    for (const pkg of publishedPackages) {
        const packageId = typeof pkg.packageId === 'string' ? pkg.packageId.trim() : '';
        const ownerId = typeof pkg.ownerId === 'string' ? pkg.ownerId.trim() : '';
        if (!packageId || !ownerId) {
            logger.warn('[UGC] 已发布包数据缺失，跳过');
            continue;
        }
        const gameId = normalizeGameId(packageId);
        if (!gameId) continue;
        if (manifestGameIds.has(gameId)) {
            logger.warn(`[UGC] 游戏 ID 重复，跳过: ${packageId}`);
            continue;
        }
        const manifest = (pkg.manifest && typeof pkg.manifest === 'object')
            ? (pkg.manifest as Record<string, unknown>)
            : null;
        const entryPath = resolveUgcEntryPath(manifest, ownerId, packageId);
        if (!entryPath) {
            logger.warn(`[UGC] 缺少规则入口，跳过: packageId=${packageId}`);
            continue;
        }
        const domainCode = await loadUgcDomainCode(entryPath, packageId);
        if (!domainCode) continue;
        const { minPlayers, maxPlayers } = resolvePlayerRange(manifest);
        const commandTypes = Array.isArray(manifest?.commandTypes)
            ? manifest.commandTypes
                .filter((item): item is string => typeof item === 'string')
                .map((item) => item.trim())
                .filter((item) => item.length > 0)
            : undefined;
        logger.info(`[UGC] 注册包: packageId=${packageId}, gameId=${gameId}, commandTypes=${JSON.stringify(commandTypes)}`);
        try {
            const ugcResult = await createUgcGame({
                packageId: gameId,
                domainCode,
                minPlayers,
                maxPlayers,
                commandTypes,
            });
            logger.info(`[UGC] 成功创建游戏: gameId=${gameId}`);
            engineConfigs.push(ugcResult.engineConfig);
            manifestGameIds.add(gameId);
            gameIds.push(gameId);
        } catch (error) {
            logger.warn(`[UGC] 创建规则失败: packageId=${packageId}`, error);
        }
    }

    return { engineConfigs, gameIds };
};
