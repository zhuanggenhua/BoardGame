import type { PlayerId } from '../../../engine/types';
import type { ActionPlayedEvent } from './types';
import { SU_EVENTS } from './types';

type BuildActionPlayedEventParams = {
    playerId: PlayerId;
    cardUid: string;
    defId: string;
    ownerId?: PlayerId;
    timestamp: number;
    isExtraAction?: boolean;
    fromBuried?: boolean;
    fromDiscard?: boolean;
    fromStored?: boolean;
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
        timestamp,
        isExtraAction,
        fromBuried,
        fromDiscard,
        fromStored,
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
            ...(isExtraAction ? { isExtraAction: true } : {}),
            ...(fromBuried ? { fromBuried: true } : {}),
            ...(fromDiscard ? { fromDiscard: true } : {}),
            ...(fromStored ? { fromStored: true } : {}),
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
