/**
 * UGC 游戏通用适配器（服务端）
 *
 * 加载 UGC domain.js 并转换为引擎 DomainCore。
 */

import type {
    Command,
    DomainCore,
    GameEvent,
    GameOverResult,
    MatchState,
    ValidationResult,
} from '../../engine/types';
import { createBaseSystems, createGameEngine } from '../../engine';
import { createSandboxExecutor } from '../../ugc/server/sandbox';
import type { UGCDomainCore } from '../../ugc/server/sandbox';

export interface UgcGameOptions {
    packageId: string;
    domainCode: string;
    minPlayers?: number;
    maxPlayers?: number;
    commandTypes?: string[];
}

const DEFAULT_MIN_PLAYERS = 2;
const DEFAULT_MAX_PLAYERS = 2;

const normalizeRuntimePlayerId = (playerId: unknown): string => {
    if (playerId === null || playerId === undefined) return '';
    const raw = String(playerId);
    if (!raw) return '';
    if (raw.startsWith('player-')) return raw;
    if (/^\d+$/.test(raw)) {
        const value = Number(raw);
        if (Number.isFinite(value)) {
            return `player-${value + 1}`;
        }
    }
    return raw;
};

const normalizeRuntimePlayerIds = (playerIds: Array<string | number>) => (
    playerIds.map((id) => normalizeRuntimePlayerId(id)).filter(Boolean)
);

const buildDomainCore = (packageId: string, domain: UGCDomainCore): DomainCore<unknown, Command, GameEvent> => {
    return {
        gameId: packageId,
        setup: (playerIds, random) => domain.setup(normalizeRuntimePlayerIds(playerIds), random),
        validate: (state, command) =>
            domain.validate(
                (state as MatchState<unknown>).core,
                { ...command, playerId: normalizeRuntimePlayerId(command.playerId) }
            ) as ValidationResult,
        execute: (state, command, random) =>
            domain.execute(
                (state as MatchState<unknown>).core,
                { ...command, playerId: normalizeRuntimePlayerId(command.playerId) },
                random
            ) as GameEvent[],
        reduce: (state, event) => domain.reduce(state, event),
        playerView: domain.playerView
            ? (state, playerId) => domain.playerView!(state, normalizeRuntimePlayerId(playerId)) as Partial<unknown>
            : undefined,
        isGameOver: domain.isGameOver
            ? (state) => domain.isGameOver!(state) as GameOverResult
            : undefined,
    };
};

export interface UgcGameResult {
    engineConfig: import('../../engine/transport/server').GameEngineConfig;
}

export const createUgcGame = async (options: UgcGameOptions): Promise<UgcGameResult> => {
    const executor = createSandboxExecutor();
    const loadResult = await executor.loadCode(options.domainCode);
    if (!loadResult.success) {
        const reason = loadResult.error ?? '未知错误';
        throw new Error(`[UGC] 规则加载失败: ${reason}`);
    }

    const domainCore = executor.getDomainCore();
    if (!domainCore) {
        throw new Error('[UGC] 规则加载失败: domain 不存在');
    }

    const domain = buildDomainCore(options.packageId, domainCore);
    const systems = createBaseSystems();

    const adapterConfig = {
        domain,
        systems,
        minPlayers: options.minPlayers ?? DEFAULT_MIN_PLAYERS,
        maxPlayers: options.maxPlayers ?? DEFAULT_MAX_PLAYERS,
        commandTypes: options.commandTypes,
        disableUndo: true,
    };

    return {
        engineConfig: createGameEngine(adapterConfig),
    };
};
