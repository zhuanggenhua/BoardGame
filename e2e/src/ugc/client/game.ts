/**
 * UGC 客户端 Game 构建器
 *
 * 加载 rules 入口并创建引擎配置。
 */

import type {
    Command,
    DomainCore,
    GameEvent,
    GameOverResult,
    MatchState,
    ValidationResult,
} from '../../engine/types';
import { createBaseSystems } from '../../engine';
import { createGameEngine } from '../../engine/adapter';
import type { GameEngineConfig } from '../../engine/transport/server';
import { RuntimeDomainExecutor, type RuntimeDomainCore } from '../runtime/domainExecutor';
import type { UGCGameState } from '../sdk/types';
import { loadUgcRuntimeConfig, type UgcRuntimeConfig } from './loader';

export interface UgcClientGameResult {
    engineConfig: GameEngineConfig;
    config: UgcRuntimeConfig;
    rulesCode: string;
}


export interface UgcDraftGameOptions {
    packageId?: string;
    rulesCode: string;
    minPlayers?: number;
    maxPlayers?: number;
    commandTypes?: string[];
}

const DEFAULT_MIN_PLAYERS = 2;
const DEFAULT_MAX_PLAYERS = 2;
const DEFAULT_DRAFT_PACKAGE_ID = 'ugc-builder-preview';

type RuntimeCommandLike = Command<string, Record<string, unknown>>;
type RuntimeEventLike = GameEvent<string, Record<string, unknown>>;

const normalizePayload = (payload: unknown): Record<string, unknown> => {
    if (payload && typeof payload === 'object') {
        return payload as Record<string, unknown>;
    }
    return {};
};

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

const buildDomainCore = (packageId: string, domain: RuntimeDomainCore): DomainCore<UGCGameState, RuntimeCommandLike, RuntimeEventLike> => {
    return {
        gameId: packageId,
        setup: (playerIds, random) => domain.setup(normalizeRuntimePlayerIds(playerIds), random),
        validate: (state, command) => {
            const runtimeCommand = {
                type: command.type,
                playerId: normalizeRuntimePlayerId(command.playerId),
                payload: normalizePayload(command.payload),
                timestamp: command.timestamp,
            };
            return domain.validate((state as MatchState<UGCGameState>).core, runtimeCommand) as ValidationResult;
        },
        execute: (state, command, random) => {
            const runtimeCommand = {
                type: command.type,
                playerId: normalizeRuntimePlayerId(command.playerId),
                payload: normalizePayload(command.payload),
                timestamp: command.timestamp,
            };
            return domain.execute((state as MatchState<UGCGameState>).core, runtimeCommand, random) as RuntimeEventLike[];
        },
        reduce: (state, event) => {
            const runtimeEvent = {
                type: event.type,
                payload: normalizePayload(event.payload),
                timestamp: event.timestamp,
                sourceCommandType: event.sourceCommandType,
                sfxKey: (event as { sfxKey?: string }).sfxKey,
            };
            return domain.reduce(state, runtimeEvent) as UGCGameState;
        },
        playerView: domain.playerView
            ? (state, playerId) => domain.playerView!(state, normalizeRuntimePlayerId(playerId)) as Partial<UGCGameState>
            : undefined,
        isGameOver: domain.isGameOver
            ? (state) => domain.isGameOver!(state) as GameOverResult
            : undefined,
    };
};

const fetchText = async (url: string): Promise<string> => {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`[UGC] 规则请求失败: ${res.status} ${res.statusText}`);
    }
    return res.text();
};

interface CreateGameFromRulesOptions {
    packageId: string;
    rulesCode: string;
    minPlayers?: number;
    maxPlayers?: number;
    commandTypes?: string[];
}

interface CreateGameFromRulesResult {
    engineConfig: GameEngineConfig;
}

const createGameFromRules = async (options: CreateGameFromRulesOptions): Promise<CreateGameFromRulesResult> => {
    const { packageId, rulesCode, minPlayers, maxPlayers, commandTypes } = options;
    if (!rulesCode.trim()) {
        throw new Error(`[UGC] 规则代码为空: ${packageId}`);
    }

    const executor = new RuntimeDomainExecutor({ allowConsole: true });
    const loadResult = await executor.loadCode(rulesCode);
    if (!loadResult.success) {
        const reason = loadResult.error ?? '未知错误';
        throw new Error(`[UGC] 规则加载失败: ${reason}`);
    }

    const domainCore = executor.getDomainCore();
    if (!domainCore) {
        throw new Error('[UGC] 规则加载失败: domain 不存在');
    }

    const domain = buildDomainCore(packageId, domainCore);
    const systems = createBaseSystems<UGCGameState>();

    const adapterConfig = {
        domain,
        systems,
        minPlayers: minPlayers ?? DEFAULT_MIN_PLAYERS,
        maxPlayers: maxPlayers ?? DEFAULT_MAX_PLAYERS,
        commandTypes,
        disableUndo: true,
    };

    const engineConfig = createGameEngine(adapterConfig);

    return { engineConfig };
};

export const createUgcClientGame = async (packageId: string): Promise<UgcClientGameResult> => {
    const config = await loadUgcRuntimeConfig(packageId);
    if (!config.rulesUrl) {
        throw new Error(`[UGC] 缺少 rules 入口: ${packageId}`);
    }

    const rulesCode = await fetchText(config.rulesUrl);
    const { engineConfig } = await createGameFromRules({
        packageId,
        rulesCode,
        minPlayers: config.minPlayers ?? DEFAULT_MIN_PLAYERS,
        maxPlayers: config.maxPlayers ?? DEFAULT_MAX_PLAYERS,
        commandTypes: config.commandTypes,
    });

    return { engineConfig, config, rulesCode };
};

export interface UgcDraftGameResult {
    engineConfig: GameEngineConfig;
}

export const createUgcDraftGame = async (options: UgcDraftGameOptions): Promise<UgcDraftGameResult> => {
    const packageId = options.packageId?.trim() || DEFAULT_DRAFT_PACKAGE_ID;
    return createGameFromRules({
        packageId,
        rulesCode: options.rulesCode,
        minPlayers: options.minPlayers ?? DEFAULT_MIN_PLAYERS,
        maxPlayers: options.maxPlayers ?? DEFAULT_MAX_PLAYERS,
        commandTypes: options.commandTypes,
    });
};
