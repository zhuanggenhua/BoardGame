/**
 * UGC 游戏通用适配器（服务端）
 *
 * 加载 UGC domain.js 并转换为引擎 DomainCore。
 */

import type { Game } from 'boardgame.io';
import type {
    Command,
    DomainCore,
    GameEvent,
    GameOverResult,
    MatchState,
    ValidationResult,
} from '../../engine/types';
import { createDefaultSystems, createGameAdapter } from '../../engine';
import { createSandboxExecutor } from '../../ugc/server/sandbox';
import type { UGCDomainCore } from '../../ugc/server/sandbox';

export interface UgcGameOptions {
    packageId: string;
    domainCode: string;
    minPlayers?: number;
    maxPlayers?: number;
}

const DEFAULT_MIN_PLAYERS = 2;
const DEFAULT_MAX_PLAYERS = 2;

const buildDomainCore = (packageId: string, domain: UGCDomainCore): DomainCore<unknown, Command, GameEvent> => {
    return {
        gameId: packageId,
        setup: (playerIds, random) => domain.setup(playerIds, random),
        validate: (state, command) =>
            domain.validate((state as MatchState<unknown>).core, command) as ValidationResult,
        execute: (state, command, random) =>
            domain.execute((state as MatchState<unknown>).core, command, random) as GameEvent[],
        reduce: (state, event) => domain.reduce(state, event),
        playerView: domain.playerView
            ? (state, playerId) => domain.playerView!(state, playerId) as Partial<unknown>
            : undefined,
        isGameOver: domain.isGameOver
            ? (state) => domain.isGameOver!(state) as GameOverResult
            : undefined,
    };
};

export const createUgcGame = async (options: UgcGameOptions): Promise<Game> => {
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
    const systems = createDefaultSystems();

    return createGameAdapter({
        domain,
        systems,
        minPlayers: options.minPlayers ?? DEFAULT_MIN_PLAYERS,
        maxPlayers: options.maxPlayers ?? DEFAULT_MAX_PLAYERS,
    });
};
