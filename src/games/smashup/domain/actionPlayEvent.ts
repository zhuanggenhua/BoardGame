import type { PlayerId } from '../../../engine/types';
import type { ActionPlayedEvent } from './types';
import { SU_EVENTS } from './types';

type BuildActionPlayedEventParams = {
    playerId: PlayerId;
    cardUid: string;
    defId: string;
    ownerId?: PlayerId;
    fromHandOfPlayerId?: PlayerId;
    timestamp: number;
    isExtraAction?: boolean;
    fromBuried?: boolean;
    fromDiscard?: boolean;
    fromStored?: boolean;
    discardPlaySourceId?: string;
    consumesNormalLimit?: boolean;
    destinationOverride?: 'hand';
    targetBaseIndex?: number;
    targetMinionUid?: string;
    sourceCommandType?: string;
};

export function buildActionPlayedEvent(params: BuildActionPlayedEventParams): ActionPlayedEvent {
    const {
        playerId,
        cardUid,
        defId,
        ownerId,
        fromHandOfPlayerId,
        timestamp,
        isExtraAction,
        fromBuried,
        fromDiscard,
        fromStored,
        discardPlaySourceId,
        consumesNormalLimit,
        destinationOverride,
        targetBaseIndex,
        targetMinionUid,
        sourceCommandType,
    } = params;

    return {
        type: SU_EVENTS.ACTION_PLAYED,
        payload: {
            playerId,
            cardUid,
            defId,
            ...(ownerId !== undefined ? { ownerId } : {}),
            ...(fromHandOfPlayerId !== undefined ? { fromHandOfPlayerId } : {}),
            ...(isExtraAction ? { isExtraAction: true } : {}),
            ...(fromBuried ? { fromBuried: true } : {}),
            ...(fromDiscard ? { fromDiscard: true } : {}),
            ...(fromStored ? { fromStored: true } : {}),
            ...(discardPlaySourceId ? { discardPlaySourceId } : {}),
            ...(consumesNormalLimit === false ? { consumesNormalLimit: false } : {}),
            ...(destinationOverride ? { destinationOverride } : {}),
            ...(targetBaseIndex !== undefined
                ? {
                    targetBaseIndex,
                    targetType: targetMinionUid ? 'minion' : 'base',
                }
                : {}),
            ...(targetMinionUid ? { targetMinionUid } : {}),
        },
        ...(sourceCommandType ? { sourceCommandType } : {}),
        timestamp,
    };
}
