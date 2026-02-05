/**
 * 召唤师战争游戏定义（新引擎架构）
 * 
 * 使用领域内核 + 引擎适配器 + FlowSystem
 */

import type { ActionLogEntry, Command, GameEvent, MatchState } from '../../engine/types';
import {
    createActionLogSystem,
    createCheatSystem,
    createFlowSystem,
    createGameAdapter,
    createLogSystem,
    createPromptSystem,
    createRematchSystem,
    createResponseWindowSystem,
    createTutorialSystem,
    createUndoSystem,
    CHEAT_COMMANDS,
    FLOW_COMMANDS,
    UNDO_COMMANDS,
    type CheatResourceModifier,
} from '../../engine';
import { SummonerWarsDomain, SW_COMMANDS, SW_EVENTS } from './domain';
import type { GamePhase, PlayerId, SummonerWarsCore } from './domain/types';
import { summonerWarsFlowHooks } from './domain/flowHooks';

// ============================================================================
// ActionLog 共享白名单 + 格式化
// ============================================================================

const ACTION_ALLOWLIST = [
    SW_COMMANDS.SUMMON_UNIT,
    SW_COMMANDS.MOVE_UNIT,
    SW_COMMANDS.BUILD_STRUCTURE,
    SW_COMMANDS.DECLARE_ATTACK,
    SW_COMMANDS.DISCARD_FOR_MAGIC,
    SW_COMMANDS.END_PHASE,
    SW_COMMANDS.PLAY_EVENT,
] as const;

function formatSummonerWarsActionEntry({
    command,
    state: _state,
    events,
}: {
    command: Command;
    state: MatchState<unknown>;
    events: GameEvent[];
}): ActionLogEntry | null {
    const timestamp = command.timestamp ?? Date.now();
    const actorId = command.playerId;
    const formatCell = (cell?: { row: number; col: number }) => {
        if (!cell) return '未知';
        return `${cell.row + 1},${cell.col + 1}`;
    };

    switch (command.type) {
        case SW_COMMANDS.MOVE_UNIT: {
            const payload = command.payload as { from?: { row: number; col: number }; to?: { row: number; col: number } };
            const fromLabel = formatCell(payload.from);
            const toLabel = formatCell(payload.to);
            return {
                id: `${command.type}-${command.playerId}-${timestamp}`,
                timestamp,
                actorId,
                kind: command.type,
                segments: [{ type: 'text', text: `移动：${fromLabel} → ${toLabel}` }],
            };
        }
        case SW_COMMANDS.DECLARE_ATTACK: {
            const attackEvent = [...events].reverse().find((event) => event.type === SW_EVENTS.UNIT_ATTACKED) as
                | { payload?: { hits?: number; target?: { row: number; col: number } } }
                | undefined;
            const hits = attackEvent?.payload?.hits;
            const targetLabel = formatCell(attackEvent?.payload?.target);
            const detail = hits === undefined ? '发动攻击' : `命中 ${hits}`;
            return {
                id: `${command.type}-${command.playerId}-${timestamp}`,
                timestamp,
                actorId,
                kind: command.type,
                segments: [{ type: 'text', text: `攻击 ${targetLabel} ${detail}` }],
            };
        }
        case SW_COMMANDS.END_PHASE: {
            const phaseEvent = [...events].reverse().find((event) => event.type === SW_EVENTS.PHASE_CHANGED) as
                | { payload?: { to?: string } }
                | undefined;
            const phaseLabel = phaseEvent?.payload?.to ? `阶段切换：${phaseEvent.payload.to}` : '结束阶段';
            return {
                id: `${command.type}-${command.playerId}-${timestamp}`,
                timestamp,
                actorId,
                kind: command.type,
                segments: [{ type: 'text', text: phaseLabel }],
            };
        }
        default:
            return null;
    }
}

// Summoner Wars 作弊系统配置
const normalizePlayerId = (playerId: string): PlayerId | null => {
    if (playerId === '0' || playerId === '1') return playerId;
    return null;
};

const summonerWarsCheatModifier: CheatResourceModifier<SummonerWarsCore> = {
    getResource: (core, playerId, resourceId) => {
        if (resourceId !== 'magic') return undefined;
        const normalizedId = normalizePlayerId(playerId);
        if (!normalizedId) return undefined;
        return core.players[normalizedId]?.magic;
    },
    setResource: (core, playerId, resourceId, value) => {
        if (resourceId !== 'magic') return core;
        const normalizedId = normalizePlayerId(playerId);
        if (!normalizedId) return core;
        const player = core.players[normalizedId];
        if (!player) return core;
        return {
            ...core,
            players: {
                ...core.players,
                [normalizedId]: {
                    ...player,
                    magic: value,
                },
            },
        };
    },
    setPhase: (core, phase) => ({
        ...core,
        phase: phase as GamePhase,
    }),
    dealCardByIndex: (core, playerId, deckIndex) => {
        const normalizedId = normalizePlayerId(playerId);
        if (!normalizedId) return core;
        const player = core.players[normalizedId];
        if (!player || deckIndex < 0 || deckIndex >= player.deck.length) return core;
        const newDeck = [...player.deck];
        const [card] = newDeck.splice(deckIndex, 1);
        return {
            ...core,
            players: {
                ...core.players,
                [normalizedId]: {
                    ...player,
                    deck: newDeck,
                    hand: [...player.hand, card],
                },
            },
        };
    },
};

// 创建系统集合（包含 FlowSystem）
const systems = [
    createFlowSystem<SummonerWarsCore>({ hooks: summonerWarsFlowHooks }),
    createLogSystem(),
    createActionLogSystem({
        commandAllowlist: ACTION_ALLOWLIST,
        formatEntry: formatSummonerWarsActionEntry,
    }),
    createUndoSystem({
        snapshotCommandAllowlist: ACTION_ALLOWLIST,
    }),
    createPromptSystem(),
    createRematchSystem(),
    createResponseWindowSystem(),
    createTutorialSystem(),
    createCheatSystem<SummonerWarsCore>(summonerWarsCheatModifier),
];

// 使用适配器创建 Boardgame.io Game
export const SummonerWars = createGameAdapter({
    domain: SummonerWarsDomain,
    systems,
    minPlayers: 2,
    maxPlayers: 2,
    commandTypes: [
        SW_COMMANDS.SUMMON_UNIT,
        SW_COMMANDS.SELECT_UNIT,
        SW_COMMANDS.MOVE_UNIT,
        SW_COMMANDS.BUILD_STRUCTURE,
        SW_COMMANDS.DECLARE_ATTACK,
        SW_COMMANDS.CONFIRM_ATTACK,
        SW_COMMANDS.DISCARD_FOR_MAGIC,
        SW_COMMANDS.END_PHASE,
        SW_COMMANDS.PLAY_EVENT,
        FLOW_COMMANDS.ADVANCE_PHASE,
        UNDO_COMMANDS.REQUEST_UNDO,
        UNDO_COMMANDS.APPROVE_UNDO,
        UNDO_COMMANDS.REJECT_UNDO,
        UNDO_COMMANDS.CANCEL_UNDO,
        CHEAT_COMMANDS.SET_RESOURCE,
        CHEAT_COMMANDS.ADD_RESOURCE,
        CHEAT_COMMANDS.SET_PHASE,
        CHEAT_COMMANDS.DEAL_CARD_BY_INDEX,
        CHEAT_COMMANDS.DEAL_CARD_BY_ATLAS_INDEX,
        CHEAT_COMMANDS.SET_STATE,
    ],
});

export default SummonerWars;

// 导出类型
export type { SummonerWarsCore as SummonerWarsState } from './domain';
