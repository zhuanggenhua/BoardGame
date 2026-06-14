import type { ActionLogEntry, Command, GameEvent, MatchState } from '../../engine/types';
import { createBaseSystems, createGameEngine } from '../../engine';
import { registerGameAiRuntime } from '../../engine/ai';
import { FantasyRealmsDomain } from './domain';
import type { FantasyRealmsCommand, FantasyRealmsCore, FantasyRealmsEvent } from './domain';
import { isDuelVariant } from './domain/commands';
import { getFantasyRealmsCardDisplayName } from './foundation';
import { fantasyRealmsAiRuntime } from './ai';

const ACTION_ALLOWLIST = ['SET_FOCUS_CARD', 'DRAW_FROM_DECK', 'TAKE_FROM_DISCARD', 'DISCARD_CARD'] as const;

function findVisibleCard(core: FantasyRealmsCore, cardId: string) {
    return core.discardPile.find((item) => item.id === cardId)
        ?? Object.values(core.players).flatMap((player) => player.hand).find((item) => item.id === cardId);
}

function formatFantasyRealmsActionEntry({
    command,
    state,
}: {
    command: Command;
    state: MatchState<unknown>;
    events: GameEvent[];
}): ActionLogEntry | null {
    const timestamp = typeof command.timestamp === 'number' ? command.timestamp : 0;
    const core = state.core as FantasyRealmsCore;

    if (command.type === 'SET_FOCUS_CARD') {
        const card = findVisibleCard(core, (command.payload as { cardId: string }).cardId);
        return card ? {
            id: `${command.type}-${command.playerId}-${timestamp}`,
            timestamp,
            actorId: command.playerId,
            kind: command.type,
            segments: [{ type: 'text', text: `查看焦点牌：${getFantasyRealmsCardDisplayName(card)}` }],
        } : null;
    }

    if (command.type === 'DRAW_FROM_DECK') {
        const currentPlayer = core.players[command.playerId];
        const drawCount = isDuelVariant(core)
            ? ((currentPlayer?.hand.length ?? 0) >= 7 ? 1 : 2)
            : 1;
        return {
            id: `${command.type}-${command.playerId}-${timestamp}`,
            timestamp,
            actorId: command.playerId,
            kind: command.type,
            segments: [{ type: 'text', text: `从牌库摸 ${drawCount} 张` }],
        };
    }

    if (command.type === 'TAKE_FROM_DISCARD') {
        const card = findVisibleCard(core, (command.payload as { cardId: string }).cardId);
        return {
            id: `${command.type}-${command.playerId}-${timestamp}`,
            timestamp,
            actorId: command.playerId,
            kind: command.type,
            segments: [{ type: 'text', text: `拿取公开弃牌：${getFantasyRealmsCardDisplayName(card) || '未知卡牌'}` }],
        };
    }

    if (command.type === 'DISCARD_CARD') {
        const card = findVisibleCard(core, (command.payload as { cardId: string }).cardId);
        return {
            id: `${command.type}-${command.playerId}-${timestamp}`,
            timestamp,
            actorId: command.playerId,
            kind: command.type,
            segments: [{ type: 'text', text: `弃掉手牌：${getFantasyRealmsCardDisplayName(card) || '未知卡牌'}` }],
        };
    }

    return null;
}

export const engineConfig = createGameEngine<FantasyRealmsCore, FantasyRealmsCommand, FantasyRealmsEvent>({
    domain: FantasyRealmsDomain,
    systems: createBaseSystems<FantasyRealmsCore>({
        actionLog: {
            commandAllowlist: ACTION_ALLOWLIST,
            formatEntry: formatFantasyRealmsActionEntry,
        },
        undo: {
            snapshotCommandAllowlist: ACTION_ALLOWLIST,
        },
    }),
    minPlayers: 2,
    maxPlayers: 6,
    commandTypes: ['SET_FOCUS_CARD', 'DRAW_FROM_DECK', 'TAKE_FROM_DISCARD', 'DISCARD_CARD'],
});

registerGameAiRuntime(fantasyRealmsAiRuntime);

export default engineConfig;
