import { isManualSetupSelectionEnabledForSeat } from '../ai/seatControllers';
import type { ManualSetupSeatControllerLike } from '../ai/types';
import { resolveCurrentTurnPlayerId } from '../sessionContext';
import type { MatchState } from '../types';

export type SeatControllerLike = ManualSetupSeatControllerLike;

export type LocalPregameControlContext = {
    state: unknown;
    seatControllers: Record<string, SeatControllerLike>;
    localPlayerId?: string | null;
};

export type LocalPregameControlResolver = (args: LocalPregameControlContext) => string | null;

/**
 * 本地热座运行中的实际操作者解析。
 *
 * 只用于 LocalGameProvider 决定当前页面代哪个座位显示和发命令；在线 transport
 * 仍以已认证的 socket 玩家为唯一命令执行者。
 */
export type LocalRuntimeControlResolver = (args: {
    state: MatchState<unknown>;
    fallbackPlayerId: string | null;
}) => string | null | undefined;

export function resolveFollowCurrentTurnPlayerId(core: unknown): string | null {
    return resolveCurrentTurnPlayerId(core);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function comparePlayerIds(left: string, right: string): number {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
        return leftNumber - rightNumber;
    }
    return left.localeCompare(right);
}

function hasSelectedSetupValue(selectionByPlayerId: Record<string, unknown>, playerId: string): boolean {
    const selectedValue = selectionByPlayerId[playerId];
    return typeof selectedValue === 'string'
        && selectedValue.length > 0
        && selectedValue !== 'unselected';
}

function resolveSetupSelectionRecord(core: Record<string, unknown>): Record<string, unknown> | null {
    if (isPlainRecord(core.selectedFactions)) {
        return core.selectedFactions;
    }
    if (isPlainRecord(core.selectedCharacters)) {
        return core.selectedCharacters;
    }
    return null;
}

export function resolveDefaultLocalPregameControlledPlayerId(args: LocalPregameControlContext): string | null {
    const manualAiSeatIds = Object.entries(args.seatControllers)
        .filter(([, controller]) => isManualSetupSelectionEnabledForSeat(controller))
        .map(([playerId]) => playerId)
        .sort(comparePlayerIds);

    if (manualAiSeatIds.length === 0) {
        return null;
    }

    const state = isPlainRecord(args.state) ? args.state : null;
    const core = isPlainRecord(state?.core) ? state.core : null;
    if (!core || core.hostStarted !== false) {
        return null;
    }

    const selectionByPlayerId = resolveSetupSelectionRecord(core);
    if (!selectionByPlayerId) {
        return null;
    }

    const readyPlayers = isPlainRecord(core.readyPlayers) ? core.readyPlayers : {};
    const hostPlayerId = core.hostPlayerId !== undefined && core.hostPlayerId !== null
        ? String(core.hostPlayerId)
        : null;

    for (const playerId of manualAiSeatIds) {
        if (!hasSelectedSetupValue(selectionByPlayerId, playerId)) {
            return playerId;
        }
    }

    for (const playerId of manualAiSeatIds) {
        if (playerId !== hostPlayerId && readyPlayers[playerId] !== true) {
            return playerId;
        }
    }

    return hostPlayerId ?? args.localPlayerId ?? null;
}

export function resolveLocalPregameControlledPlayerId(args: {
    state: unknown;
    seatControllers: Record<string, SeatControllerLike>;
    localPlayerId?: string | null;
    resolver?: LocalPregameControlResolver;
}): string | null {
    if (args.resolver) {
        return args.resolver({
            state: args.state,
            seatControllers: args.seatControllers,
            localPlayerId: args.localPlayerId,
        }) ?? null;
    }

    return resolveDefaultLocalPregameControlledPlayerId({
        state: args.state,
        seatControllers: args.seatControllers,
        localPlayerId: args.localPlayerId,
    });
}
