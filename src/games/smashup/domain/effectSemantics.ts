import type { PlayerId } from '../../../engine/types';
import { getCardDef } from '../data/cards';
import type { AffectRecord } from './affect';
import {
    getConsumableProtectionSource,
    isMinionProtected,
    isMinionProtectedNonConsumable,
    type AffectType,
    type ProtectionType,
} from './ongoingEffects';
import type {
    AbilityFeedbackEvent,
    MinionOnBase,
    OngoingAttachedEvent,
    OngoingDetachedEvent,
    SmashUpCore,
    SmashUpEvent,
} from './types';
import { SU_EVENTS } from './types';
import { matchesDefId } from './utils';

export type SemanticSourceKind = 'action' | 'nonAction';
export type SemanticControllerLens = 'owner' | 'sourceController';
export type SemanticTargetRole = 'target' | 'material' | 'reference';
export type SemanticPreviewMode = 'preview' | 'apply' | 'continuous';
export type MinionSemanticEffectType = ProtectionType | 'return' | 'control' | 'buff';

export interface SemanticRuntimeAction {
    uid?: string;
    defId: string;
    ownerId: PlayerId;
    metadata?: Record<string, unknown>;
}

export interface SemanticRuntimeActionMatchOptions {
    controllerLens?: SemanticControllerLens;
    relationToTargetController?: 'any' | 'same' | 'different';
    semanticRole?: SemanticTargetRole;
    targetEffectType?: MinionSemanticEffectType;
    targetMode?: SemanticPreviewMode;
    respectActionProtection?: boolean;
}

export interface MinionTargetSemanticOptions {
    sourcePlayerId: PlayerId;
    actionProtectionSourcePlayerId?: PlayerId;
    sourceDefId?: string;
    sourceKind?: SemanticSourceKind;
    effectType?: MinionSemanticEffectType;
    respectActionProtection?: boolean;
    mode?: SemanticPreviewMode;
}

export interface MinionTargetBlockInfo {
    blocked: boolean;
    protectionType?: ProtectionType;
    protectionSourcePlayerId?: PlayerId;
    consumableSource?: { uid: string; defId: string; ownerId: string; controllerId: PlayerId };
}

export interface SemanticMinionTargetCandidate<TMinion extends MinionOnBase = MinionOnBase> {
    minion: TMinion;
    baseIndex: number;
}

export interface SemanticMinionTargetPartition<TMinion extends MinionOnBase = MinionOnBase> {
    allowed: Array<SemanticMinionTargetCandidate<TMinion>>;
    blocked: Array<SemanticMinionTargetCandidate<TMinion> & { blockInfo: MinionTargetBlockInfo }>;
}

export function mapAffectTypeToMinionSemanticEffectType(affectType: AffectType): MinionSemanticEffectType {
    switch (affectType) {
        case 'destroy':
            return 'destroy';
        case 'move':
            return 'move';
        case 'return':
        case 'shuffle_into_deck':
            return 'return';
        case 'control_change':
            return 'control';
        default:
            return 'affect';
    }
}

function normalizeEffectType(effectType?: MinionSemanticEffectType): MinionSemanticEffectType | undefined {
    if (effectType === 'buff') return 'affect';
    return effectType;
}

function getPrimaryProtectionType(effectType?: MinionSemanticEffectType): ProtectionType | undefined {
    const normalized = normalizeEffectType(effectType);
    if (normalized === 'destroy') return 'destroy';
    if (normalized === 'move' || normalized === 'return') return 'move';
    return undefined;
}

function usesBroadAffectProtection(effectType?: MinionSemanticEffectType): boolean {
    return normalizeEffectType(effectType) !== undefined;
}

function shouldRespectActionProtection(
    sourceKind: SemanticSourceKind,
    respectActionProtection?: boolean,
): boolean {
    return respectActionProtection || sourceKind === 'action';
}

export function matchesSemanticRuntimeDefId(defId: unknown, baseDefId: string): boolean {
    return defId === baseDefId || defId === `${baseDefId}_pod`;
}

export function getSemanticActionControllerId(
    action: SemanticRuntimeAction,
    lens: SemanticControllerLens = 'sourceController',
): PlayerId {
    if (lens === 'owner') {
        return action.ownerId;
    }
    return (typeof action.metadata?.sourceControllerId === 'string'
        ? action.metadata.sourceControllerId
        : action.ownerId) as PlayerId;
}

export function inferSemanticSourceKind(
    sourceKind?: SemanticSourceKind,
    sourceDefId?: string,
): SemanticSourceKind {
    if (sourceKind === 'action' || sourceKind === 'nonAction') {
        return sourceKind;
    }
    return sourceDefId && getCardDef(sourceDefId)?.type === 'action'
        ? 'action'
        : 'nonAction';
}

export function getMinionTargetBlockInfo(
    state: SmashUpCore,
    minion: MinionOnBase,
    baseIndex: number,
    options: MinionTargetSemanticOptions,
): MinionTargetBlockInfo {
    const sourceKind = inferSemanticSourceKind(options.sourceKind, options.sourceDefId);
    const effectType = normalizeEffectType(options.effectType);
    const actionProtectionSourcePlayerId = options.actionProtectionSourcePlayerId ?? options.sourcePlayerId;

    if (
        shouldRespectActionProtection(sourceKind, options.respectActionProtection)
        && isMinionProtected(state, minion, baseIndex, actionProtectionSourcePlayerId, 'action', {
            sourceKind: 'action',
        })
    ) {
        return {
            blocked: true,
            protectionType: 'action',
            protectionSourcePlayerId: actionProtectionSourcePlayerId,
            consumableSource: getConsumableProtectionSource(state, minion, baseIndex, actionProtectionSourcePlayerId, 'action'),
        };
    }

    const primaryProtectionType = getPrimaryProtectionType(effectType);
    if (primaryProtectionType && isMinionProtected(state, minion, baseIndex, options.sourcePlayerId, primaryProtectionType, {
        sourceKind,
    })) {
        return {
            blocked: true,
            protectionType: primaryProtectionType,
            protectionSourcePlayerId: options.sourcePlayerId,
            consumableSource: getConsumableProtectionSource(state, minion, baseIndex, options.sourcePlayerId, primaryProtectionType),
        };
    }

    if (usesBroadAffectProtection(effectType)) {
        const broadAffectBlocked = (
            options.mode === 'preview' && primaryProtectionType
                ? isMinionProtectedNonConsumable(state, minion, baseIndex, options.sourcePlayerId, 'affect', {
                    sourceKind,
                })
                : isMinionProtected(state, minion, baseIndex, options.sourcePlayerId, 'affect', {
                    sourceKind,
                })
        );
        if (broadAffectBlocked) {
            return {
                blocked: true,
                protectionType: 'affect',
                protectionSourcePlayerId: options.sourcePlayerId,
                consumableSource: options.mode === 'preview' && primaryProtectionType
                    ? undefined
                    : getConsumableProtectionSource(state, minion, baseIndex, options.sourcePlayerId, 'affect'),
            };
        }
    }

    return { blocked: false };
}

export function isMinionTargetAllowed(
    state: SmashUpCore,
    minion: MinionOnBase,
    baseIndex: number,
    options: MinionTargetSemanticOptions,
): boolean {
    return !getMinionTargetBlockInfo(state, minion, baseIndex, options).blocked;
}

export function partitionMinionTargetsBySemantics<TMinion extends MinionOnBase>(
    state: SmashUpCore,
    candidates: readonly SemanticMinionTargetCandidate<TMinion>[],
    options: MinionTargetSemanticOptions,
): SemanticMinionTargetPartition<TMinion> {
    const allowed: Array<SemanticMinionTargetCandidate<TMinion>> = [];
    const blocked: Array<SemanticMinionTargetCandidate<TMinion> & { blockInfo: MinionTargetBlockInfo }> = [];

    for (const candidate of candidates) {
        const blockInfo = getMinionTargetBlockInfo(state, candidate.minion, candidate.baseIndex, options);
        if (blockInfo.blocked) {
            blocked.push({ ...candidate, blockInfo });
            continue;
        }
        allowed.push(candidate);
    }

    return { allowed, blocked };
}

export function buildProtectionSelfDestructEvent(
    source: { uid: string; defId: string; ownerId: PlayerId; controllerId: PlayerId },
    sourceBaseIndex: number | undefined,
    timestamp?: number,
): OngoingDetachedEvent {
    return {
        type: SU_EVENTS.ONGOING_DETACHED,
        payload: {
            cardUid: source.uid,
            defId: source.defId,
            ownerId: source.ownerId,
            reason: `${source.defId}_self_destruct`,
            sourcePlayerId: source.controllerId,
            sourceCardUid: source.uid,
            sourceDefId: source.defId,
            sourceControllerId: source.controllerId,
            sourceBaseIndex,
        },
        timestamp,
    };
}

function isActionAffectRecord(record: AffectRecord): boolean {
    if (!record.sourceDefId) return false;
    const def = getCardDef(record.sourceDefId);
    return def?.type === 'action' || def?.type === 'fusion';
}

function getPreferredBaseIndexes(core: SmashUpCore, ...indexes: Array<number | undefined>): number[] {
    const ordered: number[] = [];
    for (const index of [...indexes, ...core.bases.map((_, baseIndex) => baseIndex)]) {
        if (typeof index !== 'number') continue;
        if (index < 0 || index >= core.bases.length) continue;
        if (!ordered.includes(index)) ordered.push(index);
    }
    return ordered;
}

function inferInPlayActionSourcePlayerId(core: SmashUpCore, record: AffectRecord): PlayerId | undefined {
    if (!isActionAffectRecord(record)) return undefined;

    const preferredBaseIndexes = getPreferredBaseIndexes(core, record.sourceBaseIndex, record.baseIndex);

    if (record.sourceCardUid) {
        for (const baseIndex of preferredBaseIndexes) {
            const base = core.bases[baseIndex];
            const ongoing = base.ongoingActions.find(action => action.uid === record.sourceCardUid);
            if (ongoing) return ongoing.ownerId;
            for (const minion of base.minions) {
                const attached = minion.attachedActions.find(action => action.uid === record.sourceCardUid);
                if (attached) return attached.ownerId;
            }
        }
    }

    if (!record.sourceDefId) return undefined;
    const owners = new Set<PlayerId>();
    for (const baseIndex of preferredBaseIndexes) {
        const base = core.bases[baseIndex];
        for (const action of base.ongoingActions) {
            if (action.defId === record.sourceDefId) owners.add(action.ownerId);
        }
        for (const minion of base.minions) {
            for (const action of minion.attachedActions) {
                if (action.defId === record.sourceDefId) owners.add(action.ownerId);
            }
        }
        if (owners.size === 1) return [...owners][0];
        if (owners.size > 1) return undefined;
    }
    return undefined;
}

function resolveProtectionSourcePlayerId(core: SmashUpCore, record: AffectRecord): PlayerId | undefined {
    if (record.reason?.startsWith('base_')) return undefined;
    if (record.affectType === 'attach_action' && record.sourcePlayerId) {
        return record.sourcePlayerId;
    }
    return inferInPlayActionSourcePlayerId(core, record) ?? record.sourcePlayerId;
}

function buildProtectedTargetFeedback(playerId: PlayerId, timestamp: number): AbilityFeedbackEvent {
    return {
        type: SU_EVENTS.ABILITY_FEEDBACK,
        payload: { playerId, messageKey: 'feedback.target_protected', tone: 'warning' },
        timestamp,
    };
}

function buildBlockedAttachedActionDiscardEvent(
    record: AffectRecord,
    event: SmashUpEvent,
): OngoingDetachedEvent | undefined {
    if (event.type !== SU_EVENTS.ONGOING_ATTACHED || !record.sourceCardUid || !record.sourceDefId || !record.sourcePlayerId) {
        return undefined;
    }
    const ownerId = (event as OngoingAttachedEvent).payload.ownerId;
    return {
        type: SU_EVENTS.ONGOING_DETACHED,
        payload: {
            cardUid: record.sourceCardUid,
            defId: record.sourceDefId,
            ownerId,
            reason: `${record.sourceDefId}_blocked_attach`,
            sourcePlayerId: record.sourcePlayerId,
            sourceCardUid: record.sourceCardUid,
            sourceDefId: record.sourceDefId,
            sourceControllerId: record.sourceControllerId,
            sourceBaseIndex: record.sourceBaseIndex,
        },
        timestamp: event.timestamp,
    };
}

function isAttachedActionProtectedByHost(
    core: SmashUpCore,
    record: AffectRecord,
    fallbackSourcePlayerId: PlayerId,
): boolean {
    if (record.targetKind !== 'attached_action') return false;
    const sourcePlayerId = record.reason?.startsWith('base_')
        ? undefined
        : record.sourcePlayerId ?? fallbackSourcePlayerId;
    if (!sourcePlayerId) return false;

    for (const [baseIndex, base] of core.bases.entries()) {
        const host = base.minions.find(minion =>
            minion.attachedActions.some(action => action.uid === record.targetUid),
        );
        if (!host) continue;
        const targetAction = host.attachedActions.find(action => action.uid === record.targetUid);
        const copiedShieldingSource = targetAction
            && targetAction.defId === 'shapeshifters_cellular_bonding'
            && host.metadata?.cellularBondingCardUid === targetAction.uid
            && typeof host.metadata?.cellularBondingCopiedActionDefId === 'string'
            && matchesDefId(host.metadata.cellularBondingCopiedActionDefId, 'cyborg_apes_shielding');
        if (!targetAction || matchesDefId(targetAction.defId, 'cyborg_apes_shielding')) return false;
        if (copiedShieldingSource) {
            return host.attachedActions.some(action =>
                action.uid !== targetAction.uid && matchesDefId(action.defId, 'cyborg_apes_shielding'),
            );
        }
        return getMinionTargetBlockInfo(core, host, baseIndex, {
            sourcePlayerId,
            actionProtectionSourcePlayerId: sourcePlayerId,
            sourceKind: isActionAffectRecord(record) ? 'action' : 'nonAction',
            effectType: 'affect',
            mode: 'apply',
        }).blocked;
    }

    return false;
}

export function resolveSemanticAffectProtectionBlock(
    core: SmashUpCore,
    record: AffectRecord,
    event: SmashUpEvent,
    fallbackSourcePlayerId: PlayerId,
): {
    blocked: boolean;
    extraEvents: SmashUpEvent[];
} {
    if (isAttachedActionProtectedByHost(core, record, fallbackSourcePlayerId)) {
        return { blocked: true, extraEvents: [] };
    }
    if (record.baseIndex === undefined || !record.triggerMinion) {
        return { blocked: false, extraEvents: [] };
    }

    const targetMinion = record.protectionTargetMinion ?? record.triggerMinion;
    const effectiveSourcePlayerId = resolveProtectionSourcePlayerId(core, record);
    if (!effectiveSourcePlayerId) {
        return { blocked: false, extraEvents: [] };
    }

    const blockInfo = getMinionTargetBlockInfo(core, targetMinion, record.baseIndex, {
        sourcePlayerId: effectiveSourcePlayerId,
        actionProtectionSourcePlayerId: effectiveSourcePlayerId,
        sourceKind: isActionAffectRecord(record) ? 'action' : 'nonAction',
        effectType: mapAffectTypeToMinionSemanticEffectType(record.affectType),
        mode: 'apply',
    });
    if (!blockInfo.blocked) {
        return { blocked: false, extraEvents: [] };
    }

    const extraEvents: SmashUpEvent[] = [];
    const blockedAttachCleanup = buildBlockedAttachedActionDiscardEvent(record, event);
    if (blockedAttachCleanup) {
        extraEvents.push(buildProtectedTargetFeedback(effectiveSourcePlayerId, event.timestamp ?? Date.now()));
    }
    if (blockInfo.consumableSource) {
        extraEvents.push(buildProtectionSelfDestructEvent(
            {
                ...blockInfo.consumableSource,
                controllerId: blockInfo.consumableSource.controllerId,
            },
            record.baseIndex,
            event.timestamp,
        ));
    }
    if (blockedAttachCleanup) {
        extraEvents.push(blockedAttachCleanup);
    }

    return { blocked: true, extraEvents };
}

export function filterSemanticMatchedRuntimeActions(
    ctx: { state: SmashUpCore; minion: MinionOnBase; baseIndex: number },
    actions: readonly SemanticRuntimeAction[],
    baseDefId: string,
    options?: SemanticRuntimeActionMatchOptions,
): SemanticRuntimeAction[] {
    return actions.filter((action) => {
        if (!matchesSemanticRuntimeDefId(action.defId, baseDefId)) {
            return false;
        }

        const relation = options?.relationToTargetController ?? 'any';
        if (relation !== 'any') {
            const controllerId = getSemanticActionControllerId(action, options?.controllerLens);
            if (relation === 'same' && controllerId !== ctx.minion.controller) {
                return false;
            }
            if (relation === 'different' && controllerId === ctx.minion.controller) {
                return false;
            }
        }

        if ((options?.semanticRole ?? 'material') !== 'target') {
            return true;
        }

        const sourcePlayerId = getSemanticActionControllerId(action, options?.controllerLens);
        return isMinionTargetAllowed(ctx.state, ctx.minion, ctx.baseIndex, {
            sourcePlayerId,
            actionProtectionSourcePlayerId: sourcePlayerId,
            sourceKind: 'action',
            effectType: options?.targetEffectType ?? 'affect',
            respectActionProtection: options?.respectActionProtection ?? true,
            mode: options?.targetMode ?? 'continuous',
        });
    });
}
