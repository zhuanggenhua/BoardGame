import type { RandomFn } from '../../engine/types';
import {
    findExplorerByPlayerId,
    getAllExplorers,
} from './explorerReadModel';
import {
    createBookPendingEventRollReplacement,
    type BetrayalEventRollReplacementResult,
} from './eventRollReplacementModel';
import type {
    BetrayalCore,
} from './game';
import {
    BETRAYAL_TRAIT_LABEL as TRAIT_LABEL,
    resolveUseEffect,
    type PossessionUseActionEffectProfile,
} from './possessionEffects';

export interface BetrayalPossessionUseCommandPayload {
    cardId?: string;
    targetPlayerId?: string;
    targetRoomId?: string;
    targetRoomIdsByTokenId?: Record<string, string>;
    replacementRollTotal?: number;
}

export interface BetrayalPossessionUsedPayload<TEventRollReplacement = BetrayalEventRollReplacementResult> {
    playerId: string;
    cardId: string;
    effect: PossessionUseActionEffectProfile;
    targetPlayerId?: string;
    targetRoomId?: string;
    targetRoomIdsByTokenId?: Record<string, string>;
    replacementRollTotal?: number;
    eventRollReplacement?: TEventRollReplacement;
    logText: string;
}

export function resolveBetrayalPossessionUsedPayload(
    core: BetrayalCore,
    playerId: string,
    payload: BetrayalPossessionUseCommandPayload,
    options: {
        random?: RandomFn;
        timestamp?: number;
    } = {},
): BetrayalPossessionUsedPayload | null {
    const actor = findExplorerByPlayerId(core, playerId);
    if (!actor) {
        return null;
    }
    const card = actor.inventory.find((item) => item.id === payload.cardId);
    if (!card) {
        return null;
    }
    const effect = resolveUseEffect(card);
    if (!effect) {
        throw new Error(`possession ${card.id} has no active use effect`);
    }
    const targetExplorer = effect.mode === 'healTraits' && effect.target === 'selfOrSameRoomExplorer'
        ? (
            payload.targetPlayerId === actor.playerId
                ? actor
                : getAllExplorers(core).find((explorer) => explorer.playerId === payload.targetPlayerId)
        )
        : actor;
    const eventRollReplacement = effect.mode === 'nextNonCombatTraitReplacement'
        && options.random
        && typeof options.timestamp === 'number'
        ? createBookPendingEventRollReplacement(core, playerId, card.id, options.random, options.timestamp) ?? undefined
        : undefined;
    const actorName = actor.displayName;
    const logText = (() => {
        switch (effect.mode) {
            case 'nextNonCombatTraitReplacement':
                return eventRollReplacement
                    ? `${actorName}使用${card.name}，失去 ${effect.sanityCost} 点神志；本次事件检定改用${TRAIT_LABEL[effect.replacementTrait]}重新投骰并结算`
                    : `${actorName}使用${card.name}，失去 ${effect.sanityCost} 点神志；本回合下一次非战斗检定可用${TRAIT_LABEL[effect.replacementTrait]}替换`;
            case 'nextNonCombatTraitRollTotalReplacement':
                return `${actorName}埋葬${card.name}，下一次属性检定使用 ${payload.replacementRollTotal} 作为投骰结果`;
            case 'extraTurnAfterTurnEnd':
                return `${actorName}埋葬${card.name}，本回合结束后再进行一轮行动`;
            case 'healTraits':
                return `${actorName}埋葬${card.name}，治疗${targetExplorer?.displayName ?? actorName}的${effect.traits.map((trait) => TRAIT_LABEL[trait]).join('和')}`;
            case 'placeExplorer':
                return `${actorName}埋葬${card.name}，放置到${core.rooms.find((room) => room.id === payload.targetRoomId)?.name ?? '目标板块'}`;
            case 'moveOthersInRoom':
                return `${actorName}使用${card.name}，将同板块其他角色移动到${core.rooms.find((room) => room.id === payload.targetRoomId)?.name ?? '相邻板块'}`;
            default: {
                const unsupportedEffect: never = effect;
                return unsupportedEffect;
            }
        }
    })();
    return {
        playerId,
        cardId: card.id,
        effect,
        targetPlayerId: targetExplorer?.playerId,
        targetRoomId: payload.targetRoomId,
        targetRoomIdsByTokenId: payload.targetRoomIdsByTokenId,
        replacementRollTotal: payload.replacementRollTotal,
        eventRollReplacement,
        logText,
    };
}
