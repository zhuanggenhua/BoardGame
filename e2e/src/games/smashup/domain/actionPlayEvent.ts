import type { PlayerId } from '../../../engine/types';
import type { ActionPlayedEvent } from './types';
import { SU_EVENTS } from './types';

type BuildActionPlayedEventParams = {
    playerId: PlayerId;
    cardUid: string;
    defId: string;
    timestamp: number;
    isExtraAction?: boolean;
    fromBuried?: boolean;
    targetBaseIndex?: number;
    targetMinionUid?: string;
    sourceCommandType?: string;
};

export function buildActionPlayedEvent(params: BuildActionPlayedEventParams): ActionPlayedEvent {
    const {
        playerId,
        cardUid,
        defId,
        timestamp,
        isExtraAction,
        fromBuried,
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
            ...(isExtraAction ? { isExtraAction: true } : {}),
            ...(fromBuried ? { fromBuried: true } : {}),
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
