import type { PlayerId } from '../../../engine/types';
import type { AffectType } from './ongoingEffects';
import type {
    AttachedActionOnMinion,
    BaseAbilitySuppressedEvent,
    BaseInPlay,
    CardSuppressedEvent,
    CardToDeckBottomEvent,
    CardToDeckTopEvent,
    MinionControlChangedEvent,
    MinionDestroyedEvent,
    MinionMovedEvent,
    MinionOnBase,
    MinionReturnedEvent,
    OngoingActionOnBase,
    OngoingAttachedEvent,
    OngoingDetachedEvent,
    PermanentPowerAddedEvent,
    PowerCounterAddedEvent,
    PowerCounterRemovedEvent,
    SmashUpCore,
    SmashUpEvent,
    TempPowerAddedEvent,
    TitanInPlay,
} from './types';
import { SU_EVENTS } from './types';

export type AffectTargetKind = 'minion' | 'base' | 'ongoing' | 'attached_action' | 'titan';

export interface AffectRecord {
    targetKind: AffectTargetKind;
    targetUid: string;
    baseIndex?: number;
    affectType: AffectType;
    reason?: string;
    countsForOnMinionAffected: boolean;
    sourcePlayerId?: PlayerId;
    sourceCardUid?: string;
    sourceDefId?: string;
    sourceControllerId?: PlayerId;
    sourceBaseIndex?: number;
    triggerMinion?: MinionOnBase;
    triggerMinionUid?: string;
    triggerMinionDefId?: string;
}

interface CardSourceMeta {
    sourcePlayerId?: PlayerId;
    sourceCardUid?: string;
    sourceDefId?: string;
    sourceControllerId?: PlayerId;
    sourceBaseIndex?: number;
}

type CardInPlayLookup =
    | { targetKind: 'minion'; baseIndex: number; minion: MinionOnBase }
    | { targetKind: 'ongoing'; baseIndex: number; ongoing: OngoingActionOnBase }
    | { targetKind: 'attached_action'; baseIndex: number; hostMinion: MinionOnBase; action: AttachedActionOnMinion }
    | { targetKind: 'titan'; titan: TitanInPlay };

function findCardInPlayByUid(
    core: SmashUpCore,
    cardUid: string,
    preferredBaseIndex?: number,
): CardInPlayLookup | undefined {
    const baseOrder = typeof preferredBaseIndex === 'number'
        ? [preferredBaseIndex, ...core.bases.map((_, index) => index).filter(index => index !== preferredBaseIndex)]
        : core.bases.map((_, index) => index);

    for (const baseIndex of baseOrder) {
        const base = core.bases[baseIndex];
        const minion = base.minions.find(candidate => candidate.uid === cardUid);
        if (minion) return { targetKind: 'minion', baseIndex, minion };

        const ongoing = base.ongoingActions.find(candidate => candidate.uid === cardUid);
        if (ongoing) return { targetKind: 'ongoing', baseIndex, ongoing };

        for (const hostMinion of base.minions) {
            const action = hostMinion.attachedActions.find(candidate => candidate.uid === cardUid);
            if (action) {
                return { targetKind: 'attached_action', baseIndex, hostMinion, action };
            }
        }
    }

    const titan = (core.titans ?? []).find(candidate => candidate.uid === cardUid);
    if (titan) return { targetKind: 'titan', titan };

    return undefined;
}

function normalizeReasonToSourceDefId(reason?: string): string | undefined {
    if (!reason) return undefined;
    const stripped = reason
        .replace(/_(self_destruct|destroy|discard|expired|return|returned|shuffle|shuffled|detach|detached)$/u, '')
        .replace(/_pod$/u, '_pod');
    return stripped || reason;
}

function resolveSourceMeta(
    payload: Record<string, unknown>,
    fallbackSourcePlayerId?: PlayerId,
    defaultSourceDefId?: string,
): CardSourceMeta {
    return {
        sourcePlayerId: (payload.sourcePlayerId as PlayerId | undefined) ?? fallbackSourcePlayerId,
        sourceCardUid: payload.sourceCardUid as string | undefined,
        sourceDefId: (payload.sourceDefId as string | undefined)
            ?? defaultSourceDefId
            ?? normalizeReasonToSourceDefId(payload.reason as string | undefined),
        sourceControllerId: payload.sourceControllerId as PlayerId | undefined,
        sourceBaseIndex: payload.sourceBaseIndex as number | undefined,
    };
}

function buildMinionAffectRecord(
    minion: MinionOnBase,
    baseIndex: number,
    affectType: AffectType,
    reason: string | undefined,
    source: CardSourceMeta,
): AffectRecord {
    return {
        targetKind: 'minion',
        targetUid: minion.uid,
        baseIndex,
        affectType,
        reason,
        countsForOnMinionAffected: true,
        sourcePlayerId: source.sourcePlayerId,
        sourceCardUid: source.sourceCardUid,
        sourceDefId: source.sourceDefId,
        sourceControllerId: source.sourceControllerId,
        sourceBaseIndex: source.sourceBaseIndex,
        triggerMinion: minion,
        triggerMinionUid: minion.uid,
        triggerMinionDefId: minion.defId,
    };
}

function buildInPlayCardAffectRecord(
    lookup: Extract<CardInPlayLookup, { targetKind: 'ongoing' | 'attached_action' }>,
    affectType: AffectType,
    reason: string | undefined,
    source: CardSourceMeta,
): AffectRecord {
    return {
        targetKind: lookup.targetKind,
        targetUid: lookup.targetKind === 'ongoing' ? lookup.ongoing.uid : lookup.action.uid,
        baseIndex: lookup.baseIndex,
        affectType,
        reason,
        countsForOnMinionAffected: false,
        sourcePlayerId: source.sourcePlayerId,
        sourceCardUid: source.sourceCardUid,
        sourceDefId: source.sourceDefId,
        sourceControllerId: source.sourceControllerId,
        sourceBaseIndex: source.sourceBaseIndex,
    };
}

export function buildAffectRecords(
    core: SmashUpCore,
    event: SmashUpEvent,
    fallbackSourcePlayerId?: PlayerId,
): AffectRecord[] {
    switch (event.type) {
        case SU_EVENTS.MINION_DESTROYED: {
            const payload = (event as MinionDestroyedEvent).payload;
            const minion = core.bases[payload.fromBaseIndex]?.minions.find(candidate => candidate.uid === payload.minionUid);
            if (!minion) return [];
            return [buildMinionAffectRecord(
                minion,
                payload.fromBaseIndex,
                'destroy',
                payload.reason,
                resolveSourceMeta(payload as unknown as Record<string, unknown>, payload.destroyerId ?? fallbackSourcePlayerId),
            )];
        }
        case SU_EVENTS.MINION_MOVED: {
            const payload = (event as MinionMovedEvent).payload;
            const minion = core.bases[payload.fromBaseIndex]?.minions.find(candidate => candidate.uid === payload.minionUid);
            if (!minion) return [];
            return [buildMinionAffectRecord(
                minion,
                payload.fromBaseIndex,
                'move',
                payload.reason,
                resolveSourceMeta(payload as unknown as Record<string, unknown>, fallbackSourcePlayerId),
            )];
        }
        case SU_EVENTS.MINION_RETURNED: {
            const payload = (event as MinionReturnedEvent).payload;
            const minion = core.bases[payload.fromBaseIndex]?.minions.find(candidate => candidate.uid === payload.minionUid);
            if (!minion) return [];
            return [buildMinionAffectRecord(
                minion,
                payload.fromBaseIndex,
                'return',
                payload.reason,
                resolveSourceMeta(payload as unknown as Record<string, unknown>, payload.sourcePlayerId ?? fallbackSourcePlayerId),
            )];
        }
        case SU_EVENTS.CARD_TO_DECK_TOP:
        case SU_EVENTS.CARD_TO_DECK_BOTTOM: {
            const payload = (event as CardToDeckTopEvent | CardToDeckBottomEvent).payload;
            const lookup = findCardInPlayByUid(core, payload.cardUid);
            if (!lookup) return [];
            const source = resolveSourceMeta(payload as unknown as Record<string, unknown>, fallbackSourcePlayerId);
            if (lookup.targetKind === 'minion') {
                return [buildMinionAffectRecord(
                    lookup.minion,
                    lookup.baseIndex,
                    'shuffle_into_deck',
                    payload.reason,
                    source,
                )];
            }
            if (lookup.targetKind === 'ongoing' || lookup.targetKind === 'attached_action') {
                return [buildInPlayCardAffectRecord(lookup, 'shuffle_into_deck', payload.reason, source)];
            }
            return [];
        }
        case SU_EVENTS.ONGOING_ATTACHED: {
            const payload = (event as OngoingAttachedEvent).payload;
            if (payload.targetType !== 'minion' || !payload.targetMinionUid) return [];
            const minion = core.bases[payload.targetBaseIndex]?.minions.find(candidate => candidate.uid === payload.targetMinionUid);
            if (!minion) return [];
            return [buildMinionAffectRecord(
                minion,
                payload.targetBaseIndex,
                'attach_action',
                undefined,
                {
                    sourcePlayerId: payload.ownerId,
                    sourceCardUid: payload.cardUid,
                    sourceDefId: payload.defId,
                    sourceControllerId: payload.ownerId,
                    sourceBaseIndex: payload.targetBaseIndex,
                },
            )];
        }
        case SU_EVENTS.ONGOING_DETACHED: {
            const payload = (event as OngoingDetachedEvent).payload;
            const lookup = findCardInPlayByUid(core, payload.cardUid);
            if (!lookup || (lookup.targetKind !== 'ongoing' && lookup.targetKind !== 'attached_action')) return [];
            return [buildInPlayCardAffectRecord(
                lookup,
                'destroy',
                payload.reason,
                resolveSourceMeta(payload as unknown as Record<string, unknown>, fallbackSourcePlayerId, payload.defId),
            )];
        }
        case SU_EVENTS.MINION_CONTROL_CHANGED: {
            const payload = (event as MinionControlChangedEvent).payload;
            const minion = core.bases[payload.baseIndex]?.minions.find(candidate => candidate.uid === payload.minionUid);
            if (!minion) return [];
            return [buildMinionAffectRecord(
                minion,
                payload.baseIndex,
                'control_change',
                payload.reason,
                resolveSourceMeta(payload as unknown as Record<string, unknown>, payload.sourcePlayerId, payload.reason),
            )];
        }
        case SU_EVENTS.POWER_COUNTER_ADDED: {
            const payload = (event as PowerCounterAddedEvent).payload;
            if (payload.amount === 0) return [];
            const minion = core.bases[payload.baseIndex]?.minions.find(candidate => candidate.uid === payload.minionUid);
            if (!minion) return [];
            return [buildMinionAffectRecord(
                minion,
                payload.baseIndex,
                'power_change',
                payload.reason,
                resolveSourceMeta(payload as unknown as Record<string, unknown>, fallbackSourcePlayerId),
            )];
        }
        case SU_EVENTS.POWER_COUNTER_REMOVED: {
            const payload = (event as PowerCounterRemovedEvent).payload;
            if (payload.amount === 0) return [];
            const minion = core.bases[payload.baseIndex]?.minions.find(candidate => candidate.uid === payload.minionUid);
            if (!minion) return [];
            return [buildMinionAffectRecord(
                minion,
                payload.baseIndex,
                'power_change',
                payload.reason,
                resolveSourceMeta(payload as unknown as Record<string, unknown>, fallbackSourcePlayerId),
            )];
        }
        case SU_EVENTS.TEMP_POWER_ADDED: {
            const payload = (event as TempPowerAddedEvent).payload;
            if (payload.amount === 0) return [];
            const minion = core.bases[payload.baseIndex]?.minions.find(candidate => candidate.uid === payload.minionUid);
            if (!minion) return [];
            return [buildMinionAffectRecord(
                minion,
                payload.baseIndex,
                'power_change',
                payload.reason,
                resolveSourceMeta(payload as unknown as Record<string, unknown>, fallbackSourcePlayerId),
            )];
        }
        case SU_EVENTS.PERMANENT_POWER_ADDED: {
            const payload = (event as PermanentPowerAddedEvent).payload;
            if (payload.amount === 0) return [];
            const minion = core.bases[payload.baseIndex]?.minions.find(candidate => candidate.uid === payload.minionUid);
            if (!minion) return [];
            return [buildMinionAffectRecord(
                minion,
                payload.baseIndex,
                'power_change',
                payload.reason,
                resolveSourceMeta(payload as unknown as Record<string, unknown>, fallbackSourcePlayerId),
            )];
        }
        case SU_EVENTS.CARD_SUPPRESSED: {
            const payload = (event as CardSuppressedEvent).payload;
            const source = resolveSourceMeta(payload as unknown as Record<string, unknown>, payload.suppressorPlayerId);
            if (payload.cardType === 'minion') {
                const minion = core.bases[payload.baseIndex]?.minions.find(candidate => candidate.uid === payload.cardUid);
                if (!minion) return [];
                return [buildMinionAffectRecord(
                    minion,
                    payload.baseIndex,
                    'cancel_ability',
                    payload.reason,
                    source,
                )];
            }
            if (payload.cardType === 'ongoing' || payload.cardType === 'attached') {
                const lookup = findCardInPlayByUid(core, payload.cardUid, payload.baseIndex);
                if (!lookup || (lookup.targetKind !== 'ongoing' && lookup.targetKind !== 'attached_action')) return [];
                return [buildInPlayCardAffectRecord(lookup, 'cancel_ability', payload.reason, source)];
            }
            if (payload.cardType === 'titan') {
                const titan = (core.titans ?? []).find(candidate => candidate.uid === payload.cardUid);
                if (!titan) return [];
                return [{
                    targetKind: 'titan',
                    targetUid: titan.uid,
                    affectType: 'cancel_ability',
                    reason: payload.reason,
                    countsForOnMinionAffected: false,
                    sourcePlayerId: source.sourcePlayerId,
                    sourceCardUid: source.sourceCardUid,
                    sourceDefId: source.sourceDefId,
                    sourceControllerId: source.sourceControllerId,
                    sourceBaseIndex: source.sourceBaseIndex,
                }];
            }
            return [];
        }
        case SU_EVENTS.BASE_ABILITY_SUPPRESSED: {
            const payload = (event as BaseAbilitySuppressedEvent).payload;
            const base = core.bases[payload.baseIndex];
            if (!base) return [];
            const source = resolveSourceMeta(payload as unknown as Record<string, unknown>, payload.suppressorPlayerId);
            return [{
                targetKind: 'base',
                targetUid: base.defId,
                baseIndex: payload.baseIndex,
                affectType: 'cancel_ability',
                reason: payload.reason,
                countsForOnMinionAffected: false,
                sourcePlayerId: source.sourcePlayerId,
                sourceCardUid: source.sourceCardUid,
                sourceDefId: source.sourceDefId,
                sourceControllerId: source.sourceControllerId,
                sourceBaseIndex: source.sourceBaseIndex,
            }];
        }
        default:
            return [];
    }
}
