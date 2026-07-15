import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { asSimpleChoice, type InteractionDescriptor, type PromptOption, type SimpleChoiceData } from '../../../engine/systems/InteractionSystem';
import { collectAbilityProgramFootprints } from './abilityRuntime';
import { executeTriggerProgramExecutor, requireTriggerProgramExecutor } from './triggerExecutors';
import type { TitanAwareTriggerTiming } from './ongoingEffects';
import type {
    SmashUpCore,
    SmashUpEvent,
    SmashUpReactionResourceFootprint,
    SmashUpReactionResourceRef,
    TriggerInstance,
} from './types';
import { SU_EVENTS } from './types';

type MutableFootprint = {
    reads: Map<string, SmashUpReactionResourceRef>;
    writes: Map<string, SmashUpReactionResourceRef>;
    opensInteraction?: boolean;
    fallbackReason?: string;
};

export interface ReactionFootprintFallbackAuditEntry {
    triggerId: string;
    sourceDefId: string;
    timing: TriggerInstance['timing'];
    reason: string;
}

const reactionFootprintFallbackAudit: ReactionFootprintFallbackAuditEntry[] = [];

export function clearReactionFootprintFallbackAudit(): void {
    reactionFootprintFallbackAudit.length = 0;
}

export function getReactionFootprintFallbackAudit(): ReactionFootprintFallbackAuditEntry[] {
    return [...reactionFootprintFallbackAudit];
}

export function recordReactionFootprintFallback(trigger: TriggerInstance, reason: string): void {
    reactionFootprintFallbackAudit.push({
        triggerId: trigger.id,
        sourceDefId: trigger.sourceDefId,
        timing: trigger.timing,
        reason,
    });
}

export function reactionResourceKey(ref: SmashUpReactionResourceRef): string {
    switch (ref.kind) {
        case 'minion':
        case 'cardInstance':
        case 'sourceInstance':
        case 'titan':
            return `${ref.kind}:${ref.uid}`;
        case 'global':
            return `${ref.kind}:${ref.key}`;
        case 'base':
            return `base:${ref.index}`;
        case 'playerHand':
        case 'playerDeck':
        case 'playerDiscard':
        case 'playerRemoved':
        case 'playerPlayLimit':
        case 'playerVp':
        case 'playerControl':
            return `${ref.kind}:${ref.playerId}`;
        case 'turnFlag':
            return `turnFlag:${ref.playerId ?? 'global'}:${ref.key}`;
        case 'baseDeck':
        case 'madnessDeck':
            return ref.kind;
        case 'scoring':
        case 'targetAvailability':
            return `${ref.kind}:${ref.baseIndex ?? 'global'}`;
        default: {
            const exhaustive: never = ref;
            return JSON.stringify(exhaustive);
        }
    }
}

function createFootprint(): MutableFootprint {
    return { reads: new Map(), writes: new Map() };
}

function add(map: Map<string, SmashUpReactionResourceRef>, ref: SmashUpReactionResourceRef | undefined): void {
    if (!ref) return;
    map.set(reactionResourceKey(ref), ref);
}

function playerId(value: unknown): PlayerId | undefined {
    return typeof value === 'string' ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function addPlayerZoneWrites(fp: MutableFootprint, player: PlayerId | undefined, zones: Array<'hand' | 'deck' | 'discard' | 'removed' | 'playLimit' | 'vp' | 'control'>): void {
    if (!player) return;
    for (const zone of zones) {
        switch (zone) {
            case 'hand':
                add(fp.writes, { kind: 'playerHand', playerId: player });
                break;
            case 'deck':
                add(fp.writes, { kind: 'playerDeck', playerId: player });
                break;
            case 'discard':
                add(fp.writes, { kind: 'playerDiscard', playerId: player });
                break;
            case 'removed':
                add(fp.writes, { kind: 'playerRemoved', playerId: player });
                break;
            case 'playLimit':
                add(fp.writes, { kind: 'playerPlayLimit', playerId: player });
                break;
            case 'vp':
                add(fp.writes, { kind: 'playerVp', playerId: player });
                break;
            case 'control':
                add(fp.writes, { kind: 'playerControl', playerId: player });
                break;
        }
    }
}

function addScoringWrite(fp: MutableFootprint, baseIndex: number | undefined): void {
    add(fp.writes, { kind: 'scoring', baseIndex });
    if (typeof baseIndex === 'number') add(fp.writes, { kind: 'base', index: baseIndex });
}

function addSourceContextReads(fp: MutableFootprint, trigger: TriggerInstance): void {
    if (trigger.sourceCardUid) {
        add(fp.reads, { kind: 'sourceInstance', uid: trigger.sourceCardUid });
        add(fp.reads, { kind: 'cardInstance', uid: trigger.sourceCardUid });
    }
    if (trigger.sourceControllerId) {
        add(fp.reads, { kind: 'playerControl', playerId: trigger.sourceControllerId });
    }
}

function addGenericResourcesFromValue(
    fp: MutableFootprint,
    value: unknown,
    mode: 'read' | 'write',
    seen = new WeakSet<object>(),
): void {
    if (!value || typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);
    const target = mode === 'write' ? fp.writes : fp.reads;
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
        if (typeof raw === 'string') {
            if (/minionUid$/i.test(key)) add(target, { kind: 'minion', uid: raw });
            if (/titanUid$/i.test(key)) add(target, { kind: 'titan', uid: raw });
            if (/cardUid$/i.test(key) || key === 'uid') add(target, { kind: 'cardInstance', uid: raw });
            if (/actionUid$/i.test(key)) add(target, { kind: 'cardInstance', uid: raw });
            if (/madnessUid$/i.test(key)) add(target, { kind: 'cardInstance', uid: raw });
            if (mode === 'read' && /playerId$/i.test(key)) {
                add(target, { kind: 'playerControl', playerId: raw });
            }
        } else if (typeof raw === 'number' && Number.isFinite(raw)) {
            if (/baseIndex$/i.test(key) || key === 'baseIndex') add(target, { kind: 'base', index: raw });
        } else if (Array.isArray(raw)) {
            if (/(cardUids|topUids|bottomUids|deckUids|newDeckUids|removedActionUids|pickedToHandUids|playedHandUids|extraDeckUidsForShuffle|inspectedUids)$/i.test(key)) {
                for (const item of raw) {
                    if (typeof item === 'string') add(target, { kind: 'cardInstance', uid: item });
                }
            } else if (/(movedUids|selectedMinionUids|destroyedUids)$/i.test(key)) {
                for (const item of raw) {
                    if (typeof item === 'string') add(target, { kind: 'minion', uid: item });
                }
            } else if (/candidateUids$/i.test(key)) {
                for (const item of raw) {
                    if (!item || typeof item !== 'object') continue;
                    const uid = (item as Record<string, unknown>).uid;
                    if (typeof uid === 'string') add(target, { kind: 'minion', uid });
                }
                continue;
            }
            for (const item of raw) addGenericResourcesFromValue(fp, item, mode, seen);
        } else if (raw && typeof raw === 'object') {
            addGenericResourcesFromValue(fp, raw, mode, seen);
        }
    }
}

export function deriveFootprintFromEvent(event: SmashUpEvent): SmashUpReactionResourceFootprint {
    const fp = createFootprint();
    const payload = (event as { payload?: Record<string, unknown> }).payload ?? {};

    switch (event.type) {
        case SU_EVENTS.TRIGGER_CONSUMED:
        case SU_EVENTS.TRIGGER_QUEUED:
        case SU_EVENTS.ABILITY_FEEDBACK:
        case SU_EVENTS.ABILITY_TRIGGERED:
        case SU_EVENTS.REVEAL_HAND:
        case SU_EVENTS.REVEAL_DECK_TOP:
        case SU_EVENTS.DECK_INSPECTED:
            break;
        case SU_EVENTS.FACTION_SELECTED:
        case SU_EVENTS.FACTION_DESELECTED:
            addGenericResourcesFromValue(fp, payload, 'write');
            add(fp.writes, { kind: 'global', key: 'factionSelection' });
            break;
        case SU_EVENTS.SEAT_SWAPPED:
            addGenericResourcesFromValue(fp, payload, 'write');
            add(fp.writes, { kind: 'global', key: 'seatAssignments' });
            break;
        case SU_EVENTS.ALL_FACTIONS_SELECTED:
            addGenericResourcesFromValue(fp, payload, 'write');
            add(fp.writes, { kind: 'global', key: 'setup' });
            add(fp.writes, { kind: 'baseDeck' });
            for (const pid of Object.keys((payload.readiedPlayers ?? {}) as Record<string, unknown>)) {
                addPlayerZoneWrites(fp, pid, ['hand', 'deck']);
            }
            break;
        case SU_EVENTS.STARTING_HAND_MULLIGAN_USED:
            addGenericResourcesFromValue(fp, payload, 'write');
            add(fp.writes, { kind: 'turnFlag', key: 'startingHandMulliganUsed', playerId: playerId(payload.playerId) });
            break;
        case SU_EVENTS.MINION_PLAYED:
            addGenericResourcesFromValue(fp, payload, 'write');
            addPlayerZoneWrites(fp, playerId(payload.playerId), ['hand', 'deck', 'discard', 'playLimit']);
            add(fp.writes, { kind: 'base', index: numberValue(payload.baseIndex) ?? -1 });
            break;
        case SU_EVENTS.ACTION_PLAYED:
            addGenericResourcesFromValue(fp, payload, 'write');
            addPlayerZoneWrites(fp, playerId(payload.playerId), ['hand', 'playLimit']);
            if (payload.fromDiscard) {
                addPlayerZoneWrites(fp, playerId(payload.playerId), ['discard']);
                const owner = playerId(payload.ownerId);
                if (owner && owner !== playerId(payload.playerId)) {
                    addPlayerZoneWrites(fp, owner, ['discard']);
                }
            }
            break;
        case SU_EVENTS.TITAN_PLAYED:
            addGenericResourcesFromValue(fp, payload, 'write');
            add(fp.writes, { kind: 'base', index: numberValue(payload.baseIndex) ?? -1 });
            addPlayerZoneWrites(fp, playerId(payload.controllerId), ['playLimit']);
            break;
        case SU_EVENTS.TITAN_MOVED:
            addGenericResourcesFromValue(fp, payload, 'write');
            add(fp.writes, { kind: 'base', index: numberValue(payload.fromBaseIndex) ?? -1 });
            add(fp.writes, { kind: 'base', index: numberValue(payload.toBaseIndex) ?? -1 });
            add(fp.writes, { kind: 'targetAvailability' });
            break;
        case SU_EVENTS.TITAN_REMOVED_FROM_PLAY:
            addGenericResourcesFromValue(fp, payload, 'write');
            add(fp.writes, { kind: 'base', index: numberValue(payload.fromBaseIndex) ?? -1 });
            addPlayerZoneWrites(fp, playerId(payload.ownerId), ['discard']);
            break;
        case SU_EVENTS.TITAN_POWER_COUNTER_ADDED:
        case SU_EVENTS.TITAN_POWER_COUNTER_REMOVED:
        case SU_EVENTS.TITAN_ONGOING_SUPPRESSED:
        case SU_EVENTS.TITAN_METADATA_UPDATED:
            addGenericResourcesFromValue(fp, payload, 'write');
            break;
        case SU_EVENTS.MINION_MOVED:
            addGenericResourcesFromValue(fp, payload, 'write');
            add(fp.writes, { kind: 'base', index: numberValue(payload.fromBaseIndex) ?? -1 });
            add(fp.writes, { kind: 'base', index: numberValue(payload.toBaseIndex) ?? -1 });
            add(fp.writes, { kind: 'targetAvailability' });
            break;
        case SU_EVENTS.MINION_DESTROYED:
            addGenericResourcesFromValue(fp, payload, 'write');
            add(fp.writes, { kind: 'base', index: numberValue(payload.fromBaseIndex) ?? -1 });
            addPlayerZoneWrites(fp, playerId(payload.ownerId), ['discard']);
            break;
        case SU_EVENTS.MINION_RETURNED:
            addGenericResourcesFromValue(fp, payload, 'write');
            add(fp.writes, { kind: 'base', index: numberValue(payload.fromBaseIndex) ?? -1 });
            addPlayerZoneWrites(fp, playerId(payload.toPlayerId), ['hand']);
            break;
        case SU_EVENTS.MINION_CONTROL_CHANGED:
            addGenericResourcesFromValue(fp, payload, 'write');
            add(fp.writes, { kind: 'base', index: numberValue(payload.baseIndex) ?? -1 });
            addPlayerZoneWrites(fp, playerId(payload.fromControllerId), ['control']);
            addPlayerZoneWrites(fp, playerId(payload.toControllerId), ['control']);
            break;
        case SU_EVENTS.POWER_COUNTER_ADDED:
        case SU_EVENTS.POWER_COUNTER_REMOVED:
        case SU_EVENTS.TEMP_POWER_ADDED:
        case SU_EVENTS.PERMANENT_POWER_ADDED:
        case SU_EVENTS.MINION_METADATA_UPDATED:
            addGenericResourcesFromValue(fp, payload, 'write');
            add(fp.writes, { kind: 'base', index: numberValue(payload.baseIndex) ?? -1 });
            break;
        case SU_EVENTS.CARD_BURIED:
            addGenericResourcesFromValue(fp, payload, 'write');
            add(fp.writes, { kind: 'base', index: numberValue(payload.baseIndex) ?? -1 });
            addPlayerZoneWrites(fp, playerId(payload.playerId), ['hand', 'deck', 'discard']);
            break;
        case SU_EVENTS.BURIED_CARD_UNCOVERED:
            addGenericResourcesFromValue(fp, payload, 'write');
            add(fp.writes, { kind: 'base', index: numberValue(payload.baseIndex) ?? -1 });
            addPlayerZoneWrites(fp, playerId(payload.playerId), ['playLimit', 'discard']);
            break;
        case SU_EVENTS.BURIED_CARD_RETURNED_TO_HAND:
            addGenericResourcesFromValue(fp, payload, 'write');
            add(fp.writes, { kind: 'base', index: numberValue(payload.baseIndex) ?? -1 });
            addPlayerZoneWrites(fp, playerId(payload.playerId), ['hand']);
            break;
        case SU_EVENTS.BURIED_CARDS_DISCARDED_WITH_BASE:
            addGenericResourcesFromValue(fp, payload, 'write');
            add(fp.writes, { kind: 'base', index: numberValue(payload.baseIndex) ?? -1 });
            break;
        case SU_EVENTS.ONGOING_ATTACHED:
            addGenericResourcesFromValue(fp, payload, 'write');
            add(fp.writes, { kind: 'base', index: numberValue(payload.targetBaseIndex) ?? -1 });
            if (playerId(payload.sourcePlayerId) && playerId(payload.sourcePlayerId) !== playerId(payload.ownerId)) {
                addPlayerZoneWrites(fp, playerId(payload.sourcePlayerId), ['hand', 'deck', 'discard']);
            }
            addPlayerZoneWrites(fp, playerId(payload.ownerId), ['hand', 'deck', 'discard']);
            break;
        case SU_EVENTS.ONGOING_DETACHED:
            addGenericResourcesFromValue(fp, payload, 'write');
            addPlayerZoneWrites(fp, playerId(payload.ownerId), ['discard']);
            break;
        case SU_EVENTS.CARDS_DRAWN:
        case SU_EVENTS.CARD_RECOVERED_FROM_DISCARD:
            addGenericResourcesFromValue(fp, payload, 'write');
            addPlayerZoneWrites(fp, playerId(payload.playerId), ['hand', 'deck', 'discard']);
            break;
        case SU_EVENTS.CARDS_DISCARDED:
        case SU_EVENTS.CARDS_MILLED:
            addGenericResourcesFromValue(fp, payload, 'write');
            addPlayerZoneWrites(fp, playerId(payload.playerId), ['hand', 'deck', 'discard']);
            break;
        case SU_EVENTS.CARD_BOXED:
        case SU_EVENTS.CARD_REMOVED_FROM_GAME:
            addGenericResourcesFromValue(fp, payload, 'write');
            addPlayerZoneWrites(fp, playerId(payload.playerId), ['hand', 'deck', 'discard', 'removed']);
            if (payload.ownerId && payload.ownerId !== payload.playerId) {
                addPlayerZoneWrites(fp, playerId(payload.ownerId), ['removed']);
            }
            break;
        case SU_EVENTS.CARD_REMOVED_FROM_DECK:
            addGenericResourcesFromValue(fp, payload, 'write');
            addPlayerZoneWrites(fp, playerId(payload.playerId), ['deck', 'removed']);
            break;
        case SU_EVENTS.CARD_TO_DECK_TOP:
        case SU_EVENTS.CARD_TO_DECK_BOTTOM:
            addGenericResourcesFromValue(fp, payload, 'write');
            {
                const sourceZonePlayerId = playerId(payload.sourcePlayerId) ?? playerId(payload.sourceControllerId);
                if (sourceZonePlayerId && sourceZonePlayerId !== playerId(payload.ownerId)) {
                    addPlayerZoneWrites(fp, sourceZonePlayerId, ['hand', 'deck', 'discard']);
                }
            }
            addPlayerZoneWrites(fp, playerId(payload.ownerId), ['deck', 'discard']);
            break;
        case SU_EVENTS.CARD_TRANSFERRED:
            addGenericResourcesFromValue(fp, payload, 'write');
            addPlayerZoneWrites(fp, playerId(payload.fromPlayerId), ['hand', 'deck', 'discard']);
            addPlayerZoneWrites(fp, playerId(payload.toPlayerId), ['hand', 'deck', 'discard']);
            break;
        case SU_EVENTS.DECK_RESHUFFLED:
        case SU_EVENTS.DECK_REORDERED:
        case SU_EVENTS.HAND_SHUFFLED_INTO_DECK:
            addGenericResourcesFromValue(fp, payload, 'write');
            addPlayerZoneWrites(fp, playerId(payload.playerId), ['hand', 'deck', 'discard']);
            break;
        case SU_EVENTS.STAKEOUT_POD_BLOCK_ADDED:
            addGenericResourcesFromValue(fp, payload, 'write');
            add(fp.writes, { kind: 'base', index: numberValue(payload.baseIndex) ?? -1 });
            add(fp.writes, { kind: 'turnFlag', key: 'stakeoutPodBlock', playerId: playerId(payload.ownerId) });
            break;
        case SU_EVENTS.VP_AWARDED:
            addGenericResourcesFromValue(fp, payload, 'write');
            addPlayerZoneWrites(fp, playerId(payload.playerId), ['vp']);
            break;
        case SU_EVENTS.BASE_REPLACED:
        case SU_EVENTS.BASE_CLEARED:
        case SU_EVENTS.BASE_SCORED:
        case SU_EVENTS.BREAKPOINT_MODIFIED:
            addGenericResourcesFromValue(fp, payload, 'write');
            add(fp.writes, { kind: 'base', index: numberValue(payload.baseIndex) ?? -1 });
            add(fp.writes, { kind: 'scoring', baseIndex: numberValue(payload.baseIndex) });
            break;
        case SU_EVENTS.BASE_DECK_REORDERED:
        case SU_EVENTS.BASE_DECK_SHUFFLED:
            addGenericResourcesFromValue(fp, payload, 'write');
            add(fp.writes, { kind: 'baseDeck' });
            break;
        case SU_EVENTS.MADNESS_DRAWN:
        case SU_EVENTS.MADNESS_RETURNED:
            addGenericResourcesFromValue(fp, payload, 'write');
            add(fp.writes, { kind: 'madnessDeck' });
            addPlayerZoneWrites(fp, playerId(payload.playerId), ['hand']);
            break;
        case SU_EVENTS.LIMIT_MODIFIED:
        case SU_EVENTS.SPECIAL_LIMIT_USED:
        case SU_EVENTS.TALENT_USED:
        case SU_EVENTS.DISCARD_ABILITY_USED:
            addGenericResourcesFromValue(fp, payload, 'write');
            addPlayerZoneWrites(fp, playerId(payload.playerId), ['playLimit']);
            break;
        case SU_EVENTS.BASE_ABILITY_USED:
            addGenericResourcesFromValue(fp, payload, 'write');
            add(fp.writes, { kind: 'base', index: numberValue(payload.baseIndex) ?? -1 });
            add(fp.writes, { kind: 'turnFlag', key: 'baseAbilityUsed', playerId: playerId(payload.playerId) });
            break;
        case SU_EVENTS.BASE_ABILITY_SUPPRESSED:
            addGenericResourcesFromValue(fp, payload, 'write');
            add(fp.writes, { kind: 'base', index: numberValue(payload.baseIndex) ?? -1 });
            add(fp.writes, { kind: 'turnFlag', key: 'baseAbilitySuppressed', playerId: playerId(payload.suppressorPlayerId) });
            break;
        case SU_EVENTS.CARD_SUPPRESSED:
            addGenericResourcesFromValue(fp, payload, 'write');
            add(fp.writes, { kind: 'base', index: numberValue(payload.baseIndex) ?? -1 });
            add(fp.writes, { kind: 'turnFlag', key: 'cardSuppressed', playerId: playerId(payload.suppressorPlayerId) });
            break;
        case SU_EVENTS.ONGOING_CARD_COUNTER_CHANGED:
            addGenericResourcesFromValue(fp, payload, 'write');
            add(fp.writes, { kind: 'base', index: numberValue(payload.baseIndex) ?? -1 });
            break;
        case SU_EVENTS.MINION_PLAY_EFFECT_QUEUED:
        case SU_EVENTS.MINION_PLAY_EFFECT_CONSUMED:
            addGenericResourcesFromValue(fp, payload, 'write');
            addPlayerZoneWrites(fp, playerId(payload.playerId), ['playLimit']);
            break;
        case SU_EVENTS.SPECIAL_AFTER_SCORING_ARMED:
        case SU_EVENTS.SPECIAL_AFTER_SCORING_CONSUMED:
            addGenericResourcesFromValue(fp, payload, 'write');
            addScoringWrite(fp, numberValue(payload.baseIndex));
            add(fp.writes, { kind: 'turnFlag', key: event.type, playerId: playerId(payload.playerId) });
            break;
        case SU_EVENTS.SCORING_ELIGIBLE_BASES_LOCKED:
        case SU_EVENTS.BEFORE_SCORING_TRIGGERED:
        case SU_EVENTS.BEFORE_SCORING_CLEARED:
        case SU_EVENTS.WHEN_SCORING_TRIGGERED:
        case SU_EVENTS.WHEN_SCORING_CLEARED:
        case SU_EVENTS.AFTER_SCORING_TRIGGERED:
        case SU_EVENTS.AFTER_SCORING_CLEARED:
            addGenericResourcesFromValue(fp, payload, 'write');
            addScoringWrite(fp, numberValue(payload.baseIndex));
            break;
        case SU_EVENTS.TURN_STARTED:
        case SU_EVENTS.TURN_ENDED:
            addGenericResourcesFromValue(fp, payload, 'write');
            add(fp.writes, { kind: 'turnFlag', key: event.type, playerId: playerId(payload.playerId) });
            break;
    }
    return finalizeFootprint(fp);
}

function extractNewInteractions(
    beforeState: MatchState<SmashUpCore> | undefined,
    afterState: MatchState<SmashUpCore> | undefined,
): InteractionDescriptor[] {
    if (!afterState?.sys.interaction) return [];
    const beforeIds = new Set<string>();
    if (beforeState?.sys.interaction?.current) beforeIds.add(beforeState.sys.interaction.current.id);
    for (const item of beforeState?.sys.interaction?.queue ?? []) beforeIds.add(item.id);

    const all: InteractionDescriptor[] = [];
    if (afterState.sys.interaction.current) all.push(afterState.sys.interaction.current);
    all.push(...(afterState.sys.interaction.queue ?? []));
    return all.filter(interaction => !beforeIds.has(interaction.id));
}

function deriveFootprintFromOption(option: PromptOption, fp: MutableFootprint): void {
    if (option.disabled) return;
    if (option.id === 'skip' || option.id === 'pass' || option.value === null || option.value === undefined) return;
    if (typeof option.value === 'object' && 'skip' in (option.value as Record<string, unknown>)) return;
    const explicitFootprint = (option as PromptOption & { _resourceFootprint?: unknown })._resourceFootprint;
    if (isReactionResourceFootprint(explicitFootprint)) {
        mergeFootprint(fp, explicitFootprint);
        return;
    }
    addGenericResourcesFromValue(fp, option.value, 'write');
    if (option.value && typeof option.value === 'object') {
        const optionValue = option.value as Record<string, unknown>;
        addStructuredPlayerWritesFromValue(fp, optionValue);
        if (typeof optionValue.baseDefId === 'string' && numberValue(optionValue.baseIndex) == null) {
            add(fp.writes, { kind: 'baseDeck' });
        }
    }
}

function addTheBrideChoiceResources(fp: MutableFootprint, value: unknown): void {
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    if (typeof record.targetUid === 'string') {
        add(fp.writes, { kind: 'minion', uid: record.targetUid });
    }
    if (Array.isArray(record.selectedTargetUids)) {
        for (const item of record.selectedTargetUids) {
            if (typeof item === 'string') add(fp.writes, { kind: 'minion', uid: item });
        }
    }
    if (typeof record.titanUid === 'string') {
        add(fp.writes, { kind: 'cardInstance', uid: record.titanUid });
    }
}

function addStructuredPlayerWritesFromValue(fp: MutableFootprint, value: unknown): void {
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    const structuredPlayerId = playerId(record.playerId);
    if (structuredPlayerId) add(fp.writes, { kind: 'playerControl', playerId: structuredPlayerId });
    const structuredTargetPlayerId = playerId(record.targetPlayerId);
    if (structuredTargetPlayerId) add(fp.writes, { kind: 'playerControl', playerId: structuredTargetPlayerId });
    const structuredPid = playerId(record.pid);
    if (structuredPid) add(fp.writes, { kind: 'playerControl', playerId: structuredPid });
}

export function deriveFootprintFromInteraction(interaction: InteractionDescriptor): SmashUpReactionResourceFootprint | undefined {
    const data = asSimpleChoice(interaction);
    if (!data) return undefined;
    const fp = createFootprint();
    fp.opensInteraction = true;
    for (const option of data.options ?? []) {
        deriveFootprintFromOption(option, fp);
    }
    const continuationContext = (data as SimpleChoiceData & { continuationContext?: unknown }).continuationContext;
    addGenericResourcesFromValue(fp, continuationContext, 'write');
    addStructuredPlayerWritesFromValue(fp, continuationContext);
    const runtimePromptContinuationContext = ((data as SimpleChoiceData & {
        runtimePrompt?: {
            continuation?: { context?: unknown };
        };
    }).runtimePrompt?.continuation?.context);
    addGenericResourcesFromValue(
        fp,
        runtimePromptContinuationContext,
        'write',
    );
    addStructuredPlayerWritesFromValue(fp, runtimePromptContinuationContext);
    addGenericResourcesFromValue(fp, {
        inspectedUids: (data as SimpleChoiceData & { inspectedUids?: unknown }).inspectedUids,
        inspectedCards: (data as SimpleChoiceData & { inspectedCards?: unknown }).inspectedCards,
    }, 'write');
    addGenericResourcesFromValue(fp, data.displayCard, 'read');
    if (data.sourceId === 'titan_frankenstein_the_bride_start_choose_target') {
        for (const option of data.options ?? []) {
            if (option.disabled || option.id === 'skip' || option.id === 'pass') continue;
            addTheBrideChoiceResources(fp, option.value);
        }
        addTheBrideChoiceResources(fp, continuationContext);
        addTheBrideChoiceResources(fp, runtimePromptContinuationContext);
    }
    if (fp.writes.size === 0 && (data.options ?? []).some(option => !option.disabled && option.id !== 'skip' && option.id !== 'pass')) {
        fp.fallbackReason = `interaction:${data.sourceId ?? interaction.id}:unstructured-options`;
    }
    return finalizeFootprint(fp);
}

function finalizeFootprint(fp: MutableFootprint): SmashUpReactionResourceFootprint {
    const sanitize = (refs: SmashUpReactionResourceRef[]) => refs.filter(ref =>
        !(ref.kind === 'base' && ref.index < 0),
    );
    return {
        reads: sanitize([...fp.reads.values()]),
        writes: sanitize([...fp.writes.values()]),
        opensInteraction: fp.opensInteraction,
        fallbackReason: fp.fallbackReason,
    };
}

function mergeFootprint(target: MutableFootprint, source: SmashUpReactionResourceFootprint | undefined): void {
    if (!source) return;
    for (const ref of source.reads) add(target.reads, ref);
    for (const ref of source.writes) add(target.writes, ref);
    target.opensInteraction = target.opensInteraction || source.opensInteraction;
    target.fallbackReason ??= source.fallbackReason;
}

function isReactionResourceRef(value: unknown): value is SmashUpReactionResourceRef {
    if (!value || typeof value !== 'object') return false;
    const kind = (value as { kind?: unknown }).kind;
    return typeof kind === 'string';
}

function isReactionResourceFootprint(value: unknown): value is SmashUpReactionResourceFootprint {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as { reads?: unknown; writes?: unknown };
    return Array.isArray(candidate.reads)
        && Array.isArray(candidate.writes)
        && candidate.reads.every(isReactionResourceRef)
        && candidate.writes.every(isReactionResourceRef);
}

function makeProbeRandom(random: RandomFn): RandomFn {
    return {
        ...random,
        shuffle: <T>(items: T[]) => [...items],
        random: () => 0,
        d: () => 1,
        range: (max: number) => max,
    } as RandomFn;
}

function buildTriggerProbeContext(
    state: MatchState<SmashUpCore>,
    trigger: TriggerInstance,
    random: RandomFn,
    now: number,
) {
    return {
        state: state.core,
        matchState: state,
        timing: trigger.timing as TitanAwareTriggerTiming,
        frameId: trigger.frameId,
        sourceEventId: trigger.sourceEventId,
        sourceCardUid: trigger.sourceCardUid,
        sourceBaseIndex: trigger.sourceBaseIndex,
        sourceControllerId: trigger.sourceControllerId,
        sourceOwnerPlayerId: trigger.sourceOwnerPlayerId,
        triggerBaseControllersAtTrigger: trigger.triggerBaseControllersAtTrigger,
        playerId: trigger.ownerPlayerId,
        baseIndex: trigger.baseIndex,
        moveFromBaseIndex: trigger.moveFromBaseIndex,
        moveToBaseIndex: trigger.moveToBaseIndex,
        rankings: trigger.rankings,
        triggerMinionUid: trigger.triggerMinionUid,
        triggerMinionDefId: trigger.triggerMinionDefId,
        triggerMinionPower: trigger.triggerMinionPower,
        destroyerId: trigger.destroyerId,
        triggerCardUid: trigger.triggerCardUid,
        triggerCardDefId: trigger.triggerCardDefId,
        triggerCardOwnerId: trigger.triggerCardOwnerId,
        triggerCardKind: trigger.triggerCardKind,
        transferredCardUid: trigger.transferredCardUid,
        transferredCardDefId: trigger.transferredCardDefId,
        transferredCardOwnerId: trigger.transferredCardOwnerId,
        transferredFromPlayerId: trigger.transferredFromPlayerId,
        transferredToPlayerId: trigger.transferredToPlayerId,
        discardedCards: trigger.discardedCards,
        discardedFromZone: trigger.discardedFromZone,
        triggerMinion: trigger.lkiMinion
            ? {
                uid: trigger.lkiMinion.uid,
                defId: trigger.lkiMinion.defId,
                owner: trigger.lkiMinion.owner,
                controller: trigger.lkiMinion.controller,
                basePower: trigger.lkiMinion.basePower,
                powerCounters: trigger.lkiMinion.powerCounters,
                powerModifier: trigger.lkiMinion.powerModifier,
                tempPowerModifier: trigger.lkiMinion.tempPowerModifier,
                talentUsed: false,
                attachedActions: [],
                metadata: trigger.lkiMinion.metadata ? { ...trigger.lkiMinion.metadata } : undefined,
            }
            : undefined,
        reason: trigger.reason,
        affectType: trigger.affectType,
        counterChangeKind: trigger.counterChangeKind,
        counterDelta: trigger.counterDelta,
        affectEvent: trigger.affectEvent,
        actionTargetBaseIndex: trigger.actionTargetBaseIndex,
        actionTargetType: trigger.actionTargetType,
        actionTargetMinionUid: trigger.actionTargetMinionUid,
        buriedCardUid: trigger.buriedCardUid,
        buriedCardDefId: trigger.buriedCardDefId,
        buriedCardControllerId: trigger.buriedCardControllerId,
        buriedFrom: trigger.buriedFrom,
        inspectionCards: trigger.inspectionCards,
        inspectionZone: trigger.inspectionZone,
        inspectionTargetPlayerIds: trigger.inspectionTargetPlayerIds,
        inspectionCausePlayerId: trigger.inspectionCausePlayerId,
        random: makeProbeRandom(random),
        now,
    };
}

export function deriveFootprintFromTriggerProbe(
    state: MatchState<SmashUpCore>,
    trigger: TriggerInstance,
    random: RandomFn,
    now: number,
): SmashUpReactionResourceFootprint {
    const fp = createFootprint();
    addSourceContextReads(fp, trigger);

    try {
        const beforeState = state;
        const probeContext = buildTriggerProbeContext(state, trigger, random, now) as never;
        try {
            const executor = requireTriggerProgramExecutor(trigger.timing, trigger.sourceDefId);
            const dslFootprints = collectAbilityProgramFootprints(
                executor.program,
                probeContext,
            ).filter(isReactionResourceFootprint);
            if (dslFootprints.length > 0) {
                for (const footprint of dslFootprints) {
                    mergeFootprint(fp, footprint);
                }
                return finalizeFootprint(fp);
            }
        } catch {
            // 非 DSL 能力或 footprint derivation 失败时继续走既有 probe 路径。
        }

        const result = executeTriggerProgramExecutor(
            trigger.timing,
            trigger.sourceDefId,
            probeContext,
        );
        const events = Array.isArray(result) ? result : result.events;
        for (const event of events) {
            mergeFootprint(fp, deriveFootprintFromEvent(event));
        }
        if (!Array.isArray(result)) {
            for (const interaction of extractNewInteractions(beforeState, result.matchState)) {
                mergeFootprint(fp, deriveFootprintFromInteraction(interaction));
            }
        }
    } catch (error) {
        fp.fallbackReason = error instanceof Error ? error.message : 'trigger-probe-failed';
    }

    return finalizeFootprint(fp);
}

export function resourceFootprintsConflict(
    left: SmashUpReactionResourceFootprint,
    right: SmashUpReactionResourceFootprint,
): boolean {
    if (
        (left.fallbackReason && left.reads.length === 0 && left.writes.length === 0)
        || (right.fallbackReason && right.reads.length === 0 && right.writes.length === 0)
    ) {
        return true;
    }
    const leftWrites = new Set(left.writes.map(reactionResourceKey));
    const rightWrites = new Set(right.writes.map(reactionResourceKey));
    const leftReads = new Set(left.reads.map(reactionResourceKey));
    const rightReads = new Set(right.reads.map(reactionResourceKey));
    return [...leftWrites].some(key => rightWrites.has(key) || rightReads.has(key))
        || [...rightWrites].some(key => leftReads.has(key));
}

export function explicitFallbackFootprintFromTrigger(trigger: TriggerInstance): SmashUpReactionResourceFootprint | undefined {
    if (trigger.fallbackFootprint) {
        return trigger.fallbackFootprint;
    }
    return undefined;
}
