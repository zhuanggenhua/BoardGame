import type { RandomFn } from '../../engine/types';
import {
    applyAttackDamage,
    applyMentalDamage,
    applyPhysicalDamage,
    chainPendingDamageAllocations,
    createPendingDamageAllocation,
    isExplorerDead,
    repeatTraitForDamage,
    rollDeathPrevention,
    setExplorerTraitsToDeathsDoor,
} from './damageResolutionModel';
import { cloneScenarioRuntimeStatus } from './coreStateModel';
import { applyDustEventEffectDeathIfNeeded } from './deathStateReadModel';
import { rollBetrayalDicePips } from './diceRules';
import {
    cloneExplorerSummary,
    findExplorerByPlayerId,
} from './explorerReadModel';
import { rollAllTraitChecks } from './eventRollModel';
import {
    cloneInventoryCard,
    clonePossessionOrderByKind,
    createDrawnCard,
    removePossessionCardFromDeck,
    restorePossessionCardToBottom,
    restorePossessionCardToTop,
} from './possessionDeckModel';
import {
    effectAllowsAdjacentRoomChoice,
    effectAllowsRoomTargetChoice,
    effectHasUnresolvedTraitChoice,
    type UseEffectProfile,
} from './possessionEffects';
import {
    BETRAYAL_EXPLORER_CATALOG,
    type BetrayalRoomFloor,
} from './scenarioConfig';
import {
    applyGeneralDamage,
    applyTraitLoss,
    cloneTraitTracks,
    healExplorerTraitToStart,
    moveExplorerTraitSteps,
} from './traitTrackModel';
import type {
    BetrayalCore,
    BetrayalExplorerSummary,
    BetrayalMonsterSummary,
    BetrayalPendingDamageAllocationState,
    BetrayalPendingEventRollResolutionState,
    BetrayalRecentRollState,
    BetrayalTraitKey,
} from './game';

export type BetrayalEventEffectSnapshot = NonNullable<BetrayalRecentRollState['eventEffectSnapshot']>;

type BetrayalRolledDamageResult = NonNullable<BetrayalRecentRollState['eventRolledDamageResults']>[number];
type BetrayalSourceEventRollState = NonNullable<BetrayalRecentRollState['sourceEventRoll']>;

type RolledDamageAllocationDeferral = {
    sourceTitle: string;
    timestamp: number;
    allocations: BetrayalPendingDamageAllocationState[];
};

type ApplyEventEffectOptions = {
    deferRolledDamageAllocation?: RolledDamageAllocationDeferral;
};

type EventDamageDeathPreview = {
    amount: number;
    kind: 'general' | 'physical' | 'mental';
    traits: BetrayalTraitKey[];
    traitsBeforeDamage: BetrayalExplorerSummary['traits'];
};

function explorerHasTemplate(explorer: BetrayalExplorerSummary): boolean {
    return BETRAYAL_EXPLORER_CATALOG.some((template) => template.explorerId === explorer.explorerId);
}

function healExplorerTraitsToTemplate(
    explorer: BetrayalExplorerSummary,
    traits: BetrayalTraitKey[],
): void {
    if (!explorerHasTemplate(explorer)) {
        return;
    }
    for (const trait of traits) {
        healExplorerTraitToStart(explorer, trait);
    }
}

export function isEventRecentRoll(
    recentRoll: BetrayalRecentRollState | null | undefined,
): recentRoll is BetrayalRecentRollState & { kind: 'eventTraitCheck' | 'eventDiceRoll' } {
    return recentRoll?.kind === 'eventTraitCheck' || recentRoll?.kind === 'eventDiceRoll';
}

export function cloneRolledDamageResult(damage: BetrayalRolledDamageResult): BetrayalRolledDamageResult {
    return {
        ...damage,
        rolls: [...damage.rolls],
    };
}

function formatRolledDamageResultLabel(damageResults: BetrayalRolledDamageResult[]): string {
    const labels = damageResults.map((damage) => {
        const kindLabel = damage.damageKind === 'physical' ? '物理伤害' : '精神伤害';
        return `造成 ${damage.appliedAmount} 点${kindLabel}`;
    });
    return labels.join('；');
}

export function cloneSourceEventRoll(sourceRoll: BetrayalSourceEventRollState): BetrayalSourceEventRollState {
    return {
        ...sourceRoll,
        dice: [...sourceRoll.dice],
    };
}

function resolveRecentRollTotal(recentRoll: BetrayalRecentRollState): number {
    return recentRoll.dice.reduce((sum, pip) => sum + pip, 0) + recentRoll.passiveBonus;
}

export function cloneSourceEventRollFromRecentRoll(
    recentRoll: BetrayalRecentRollState | null | undefined,
): BetrayalSourceEventRollState | undefined {
    if (!isEventRecentRoll(recentRoll)) {
        return undefined;
    }
    return {
        id: recentRoll.id,
        kind: recentRoll.kind,
        playerId: recentRoll.playerId,
        sourceTitle: recentRoll.sourceTitle,
        eventDescription: recentRoll.eventDescription,
        trait: recentRoll.trait,
        rollLabel: recentRoll.rollLabel,
        dice: [...recentRoll.dice],
        passiveBonus: recentRoll.passiveBonus,
        total: resolveRecentRollTotal(recentRoll),
        latestLabel: recentRoll.latestLabel,
    };
}

export function setEventRolledDamageRecentRollFromSnapshot(
    core: BetrayalCore,
    snapshot: BetrayalEventEffectSnapshot | undefined,
    sourceTitle: string,
    timestamp: number,
    sourceEventRoll = cloneSourceEventRollFromRecentRoll(core.recentRoll),
): boolean {
    const damageResults = snapshot?.rolledDamageResults?.map(cloneRolledDamageResult) ?? [];
    const dice = damageResults.flatMap((damage) => damage.rolls);
    if (damageResults.length === 0 || dice.length === 0) {
        return false;
    }
    const playerId = sourceEventRoll?.playerId ?? core.currentExplorer.playerId;
    core.recentRoll = {
        id: `${sourceEventRoll?.id ?? `${playerId}-${sourceTitle}`}-event-rolled-damage-${timestamp}`,
        kind: 'eventRolledDamage',
        playerId,
        sourceTitle,
        eventDescription: sourceEventRoll?.eventDescription,
        rollLabel: '重新投掷的伤害骰',
        dice,
        passiveBonus: 0,
        requiredPlayerIds: [playerId],
        acknowledgedPlayerIds: [],
        latestLabel: formatRolledDamageResultLabel(damageResults),
        eventRolledDamageResults: damageResults,
        sourceEventRoll: sourceEventRoll ? cloneSourceEventRoll(sourceEventRoll) : undefined,
        consumedRabbitFootCardIds: [],
    };
    return true;
}

function createEventEffectSnapshot(core: BetrayalCore): BetrayalEventEffectSnapshot {
    return {
        traitsBeforeEffect: { ...core.currentExplorer.traits },
        traitTracksBeforeEffect: cloneTraitTracks(core.currentExplorer.traitTracks),
        roomIdBeforeEffect: core.currentExplorer.roomId,
        possessionOrderByKindBeforeEffect: clonePossessionOrderByKind(core.possessionOrderByKind),
        currentExplorerInventoryBeforeEffect: core.currentExplorer.inventory.map(cloneInventoryCard),
        deckCountsBeforeEffect: { ...core.deckCounts },
        damageRolls: [],
        rolledDamageResults: [],
        drawnCards: [],
    };
}

function snapshotEventEffect(
    core: BetrayalCore,
    snapshot: BetrayalEventEffectSnapshot | undefined,
): BetrayalEventEffectSnapshot {
    return snapshot ?? createEventEffectSnapshot(core);
}

function revertEventSideEffects(core: BetrayalCore, effect: UseEffectProfile): void {
    if (effect.mode === 'compound') {
        for (const childEffect of [...effect.effects].reverse()) {
            revertEventSideEffects(core, childEffect);
        }
        return;
    }
    if (effect.mode === 'placeObstacleToken') {
        const room = core.rooms.find((item) => item.id === core.currentExplorer.roomId);
        if (room?.markerTokens) {
            room.markerTokens = room.markerTokens.filter((token) => token !== 'obstacle');
        }
    }
}

export function revertEventEffect(
    core: BetrayalCore,
    effect: UseEffectProfile,
    snapshot?: BetrayalEventEffectSnapshot,
): void {
    if (snapshot) {
        core.currentExplorer.traits = { ...snapshot.traitsBeforeEffect };
        core.currentExplorer.traitTracks = cloneTraitTracks(snapshot.traitTracksBeforeEffect);
        core.currentExplorer.roomId = snapshot.roomIdBeforeEffect;
        core.currentExplorer.inventory = snapshot.currentExplorerInventoryBeforeEffect.map(cloneInventoryCard);
        revertEventSideEffects(core, effect);
        for (const drawnCard of snapshot.drawnCards) {
            core.currentExplorer.inventory = core.currentExplorer.inventory.filter((card) => card.id !== drawnCard.id);
        }
        core.possessionOrderByKind = clonePossessionOrderByKind(snapshot.possessionOrderByKindBeforeEffect);
        core.deckCounts = { ...snapshot.deckCountsBeforeEffect };
        return;
    }
    if (effect.mode === 'none') {
        return;
    }
    if (effect.mode === 'compound') {
        for (const childEffect of [...effect.effects].reverse()) {
            revertEventEffect(core, childEffect);
        }
        return;
    }
    if (effect.mode === 'placeObstacleToken') {
        const room = core.rooms.find((item) => item.id === core.currentExplorer.roomId);
        if (room?.markerTokens) {
            room.markerTokens = room.markerTokens.filter((token) => token !== 'obstacle');
        }
        return;
    }
    if (effect.mode === 'move') {
        core.movesRemaining = Math.max(0, core.movesRemaining - effect.amount);
        return;
    }
    if (effect.mode === 'trait') {
        moveExplorerTraitSteps(core.currentExplorer, effect.trait, -effect.amount);
        return;
    }
    if (effect.mode === 'chosenTrait') {
        const appliedTrait = effect.chosenTrait ?? effect.allowedTraits[0];
        if (appliedTrait) {
            moveExplorerTraitSteps(core.currentExplorer, appliedTrait, -effect.amount);
        }
        return;
    }
    if (effect.mode === 'generalDamageChoice') {
        for (const trait of [...(effect.selectedTraits ?? effect.allowedTraits)].reverse()) {
            moveExplorerTraitSteps(core.currentExplorer, trait, 1);
        }
        return;
    }
    if (effect.mode === 'healChosenTrait') {
        return;
    }
    if (effect.mode === 'optionalEventRoll') {
        return;
    }
    if (effect.mode === 'chooseTraitRoll') {
        return;
    }
    if (effect.mode === 'traitRoll') {
        return;
    }
    if (effect.mode === 'optionalItemEffect') {
        return;
    }
    if (effect.mode === 'rolledDamage') {
        return;
    }
    if (effect.mode === 'drawPossession') {
        if (effect.drawnCard) {
            core.currentExplorer.inventory = core.currentExplorer.inventory.filter((card) => card.id !== effect.drawnCard!.id);
            restorePossessionCardToTop(core, effect.kind, effect.drawnCard);
        }
        return;
    }
    if (effect.mode === 'placeExplorerInRoom') {
        return;
    }
    if (effect.mode === 'placeExplorerInFloorStartingRoom') {
        return;
    }
    if (effect.mode === 'placeExplorerInDiscoveredRoomByVisualId') {
        return;
    }
    if (effect.mode === 'placeExplorerInAdjacentRoom') {
        return;
    }
    for (const trait of [...effect.traits].reverse()) {
        moveExplorerTraitSteps(core.currentExplorer, trait, Math.max(0, effect.amount));
    }
}

function resolveDirectTraitLossFromEventEffect(
    effect: UseEffectProfile,
): Omit<EventDamageDeathPreview, 'traitsBeforeDamage'> | null {
    if (effect.mode === 'trait' && effect.amount < 0) {
        return {
            amount: Math.abs(effect.amount),
            kind: 'general',
            traits: repeatTraitForDamage(effect.trait, Math.abs(effect.amount)),
        };
    }
    if (effect.mode === 'chosenTrait' && effect.amount < 0) {
        const trait = effect.chosenTrait ?? effect.allowedTraits[0];
        return trait
            ? {
                amount: Math.abs(effect.amount),
                kind: 'general',
                traits: repeatTraitForDamage(trait, Math.abs(effect.amount)),
            }
            : null;
    }
    if (effect.mode === 'allTraitChecks' && effect.results) {
        const traits = effect.results.flatMap((result) => (
            result.passed ? [] : repeatTraitForDamage(result.trait, effect.failAmount)
        ));
        return traits.length > 0
            ? {
                amount: traits.length,
                kind: 'general',
                traits,
            }
            : null;
    }
    return null;
}

function resolveDamageFromEventEffect(effect: UseEffectProfile): Omit<EventDamageDeathPreview, 'traitsBeforeDamage'> | null {
    if (effect.mode === 'generalDamage') {
        return { amount: effect.amount, kind: 'general', traits: [...effect.traits] };
    }
    if (effect.mode === 'generalDamageChoice' && effect.selectedTraits?.length === effect.amount) {
        return { amount: effect.amount, kind: 'general', traits: [...effect.selectedTraits] };
    }
    if (effect.mode === 'rolledDamage') {
        return {
            amount: (effect.rolls ?? []).reduce((sum, pip) => sum + pip, 0),
            kind: effect.damageKind,
            traits: [],
        };
    }
    if (effect.mode === 'fixedDamage') {
        return {
            amount: effect.amount,
            kind: effect.damageKind,
            traits: [],
        };
    }
    if (effect.mode === 'optionalItemEffect') {
        return resolveDamageFromEventEffect(effect.selectedCardId ? effect.acceptEffect : effect.declineEffect);
    }
    return null;
}

function applyEventDeathPreviewNonDamageEffect(
    explorer: BetrayalExplorerSummary,
    effect: UseEffectProfile,
): void {
    if (effect.mode === 'trait') {
        moveExplorerTraitSteps(explorer, effect.trait, effect.amount, { allowSkull: true });
        return;
    }
    if (effect.mode === 'chosenTrait') {
        const appliedTrait = effect.chosenTrait ?? effect.allowedTraits[0];
        if (appliedTrait) {
            moveExplorerTraitSteps(explorer, appliedTrait, effect.amount, { allowSkull: true });
        }
        return;
    }
    if (effect.mode === 'healChosenTrait') {
        const appliedTrait = effect.chosenTrait ?? effect.allowedTraits[0];
        if (appliedTrait) {
            healExplorerTraitsToTemplate(explorer, [appliedTrait]);
        }
        return;
    }
    if (effect.mode === 'allTraitChecks' && effect.results) {
        const failedTraits = effect.results.filter((result) => !result.passed).map((result) => result.trait);
        for (const trait of failedTraits) {
            applyTraitLoss(explorer, [trait], effect.failAmount, { allowSkull: true });
        }
        return;
    }
    if (effect.mode === 'optionalItemEffect') {
        applyEventDeathPreviewNonDamageEffect(explorer, effect.selectedCardId ? effect.acceptEffect : effect.declineEffect);
    }
}

function resolveEventDamageDeathPreview(
    explorer: BetrayalExplorerSummary,
    effect: UseEffectProfile,
): EventDamageDeathPreview | undefined {
    if (effect.mode === 'compound') {
        for (const childEffect of effect.effects) {
            const childPreview = resolveEventDamageDeathPreview(explorer, childEffect);
            if (childPreview) {
                return childPreview;
            }
        }
        return undefined;
    }
    if (effect.mode === 'allTraitChecks' && effect.results?.every((result) => result.passed)) {
        return resolveEventDamageDeathPreview(explorer, effect.allPassEffect);
    }
    if (effect.mode === 'optionalItemEffect') {
        return resolveEventDamageDeathPreview(explorer, effect.selectedCardId ? effect.acceptEffect : effect.declineEffect);
    }
    const damage = resolveDamageFromEventEffect(effect) ?? resolveDirectTraitLossFromEventEffect(effect);
    if (damage) {
        const traitsBeforeDamage = { ...explorer.traits };
        if (damage.kind === 'general') {
            applyGeneralDamage(explorer, damage.amount, damage.traits, { allowSkull: true });
        } else {
            applyAttackDamage(explorer, damage.amount, damage.kind);
        }
        return isExplorerDead(explorer)
            ? { ...damage, traitsBeforeDamage }
            : undefined;
    }
    applyEventDeathPreviewNonDamageEffect(explorer, effect);
    return undefined;
}

export function resolveEventDamageDeathPrevention(
    core: BetrayalCore,
    effect: UseEffectProfile,
    random: RandomFn,
): BetrayalPendingEventRollResolutionState['deathPrevention'] | undefined {
    if (core.phase !== 'haunt') {
        return undefined;
    }
    const deathPreview = cloneExplorerSummary(core.currentExplorer);
    const damage = resolveEventDamageDeathPreview(deathPreview, effect);
    if (!damage) {
        return undefined;
    }
    const deathPreventionRoll = rollDeathPrevention(random, core.currentExplorer);
    return deathPreventionRoll
        ? {
            ...deathPreventionRoll,
            damageAmount: damage.amount,
            damageKind: damage.kind,
            damageTraits: damage.traits,
            traitsBeforeDamage: { ...damage.traitsBeforeDamage },
        }
        : undefined;
}

export function applyImmediateEventDeathPreventionIfNeeded(
    core: BetrayalCore,
    deathPrevention: BetrayalPendingEventRollResolutionState['deathPrevention'] | undefined,
    timestamp: number,
    scenarioRuntimeBeforeDefeat: BetrayalCore['scenarioRuntime'] | null,
    monstersBeforeDefeat: BetrayalMonsterSummary[],
): void {
    if (deathPrevention?.dice.length) {
        core.recentRoll = {
            id: `${deathPrevention.playerId}-death-prevention-${timestamp}`,
            kind: 'deathPrevention',
            playerId: deathPrevention.playerId,
            sourceTitle: deathPrevention.cardId === 'skull' ? '头骨死亡保护' : '死亡保护',
            dice: [...deathPrevention.dice],
            passiveBonus: 0,
            latestLabel: deathPrevention.prevented ? '阻止死亡' : '正常死亡',
            deathPrevention: {
                cardId: deathPrevention.cardId,
                minTotal: deathPrevention.minTotal,
                damageKind: deathPrevention.damageKind,
                damageAmount: deathPrevention.damageAmount,
                damageTraits: [...deathPrevention.damageTraits],
                traitsBeforeDamage: { ...deathPrevention.traitsBeforeDamage },
                scenarioRuntimeBeforeDefeat: scenarioRuntimeBeforeDefeat
                    ?? cloneScenarioRuntimeStatus(core.scenarioRuntime),
                monstersBeforeDefeat,
            },
            consumedRabbitFootCardIds: [],
        };
    }
    if (deathPrevention?.prevented) {
        const protectedExplorer = findExplorerByPlayerId(core, deathPrevention.playerId);
        if (protectedExplorer) {
            setExplorerTraitsToDeathsDoor(protectedExplorer);
        }
    } else {
        applyDustEventEffectDeathIfNeeded(core);
    }
}

export function applyEventEffect(
    core: BetrayalCore,
    effect: UseEffectProfile,
    random?: RandomFn,
    snapshot?: BetrayalEventEffectSnapshot,
    options?: ApplyEventEffectOptions,
): BetrayalEventEffectSnapshot | undefined {
    if (effect.mode === 'none') {
        return snapshot;
    }
    const nextSnapshot = snapshotEventEffect(core, snapshot);
    if (effect.mode === 'compound') {
        for (const childEffect of effect.effects) {
            applyEventEffect(core, childEffect, random, nextSnapshot, options);
        }
        return nextSnapshot;
    }
    if (effect.mode === 'placeObstacleToken') {
        const room = core.rooms.find((item) => item.id === core.currentExplorer.roomId);
        if (room) {
            room.markerTokens = Array.from(new Set([...(room.markerTokens ?? []), 'obstacle']));
        }
        return nextSnapshot;
    }
    if (effect.mode === 'placeSecretPassageToken') {
        const roomId = effect.targetRoomId ?? core.currentExplorer.roomId;
        const room = core.rooms.find((item) => item.id === roomId);
        if (room) {
            room.markerTokens = Array.from(new Set([...(room.markerTokens ?? []), 'secretPassage']));
        }
        return nextSnapshot;
    }
    if (effect.mode === 'placeBlessingToken') {
        const room = core.rooms.find((item) => item.id === core.currentExplorer.roomId);
        if (room) {
            room.markerTokens = Array.from(new Set([...(room.markerTokens ?? []), 'blessing']));
        }
        return nextSnapshot;
    }
    if (effect.mode === 'move') {
        core.movesRemaining = Math.min(5, Math.max(0, core.movesRemaining + effect.amount));
        return nextSnapshot;
    }
    if (effect.mode === 'trait') {
        moveExplorerTraitSteps(core.currentExplorer, effect.trait, effect.amount, { allowSkull: core.phase === 'haunt' });
        return nextSnapshot;
    }
    if (effect.mode === 'chosenTrait') {
        const appliedTrait = effect.chosenTrait ?? effect.allowedTraits[0];
        if (appliedTrait) {
            moveExplorerTraitSteps(core.currentExplorer, appliedTrait, effect.amount, { allowSkull: core.phase === 'haunt' });
        }
        return nextSnapshot;
    }
    if (effect.mode === 'healChosenTrait') {
        const appliedTrait = effect.chosenTrait ?? effect.allowedTraits[0];
        if (appliedTrait) {
            healExplorerTraitsToTemplate(core.currentExplorer, [appliedTrait]);
        }
        return nextSnapshot;
    }
    if (effect.mode === 'generalDamageChoice') {
        applyGeneralDamage(core.currentExplorer, effect.amount, effect.selectedTraits ?? effect.allowedTraits, { allowSkull: core.phase === 'haunt' });
        return nextSnapshot;
    }
    if (effect.mode === 'fixedDamage') {
        const deferred = options?.deferRolledDamageAllocation;
        const pendingAllocation = deferred
            ? createPendingDamageAllocation({
                id: `event-fixed-damage-${core.currentExplorer.playerId}-${deferred.timestamp}-${deferred.allocations.length}`,
                explorer: core.currentExplorer,
                sourceTitle: deferred.sourceTitle,
                damageKind: effect.damageKind,
                amount: effect.amount,
                allowSkull: core.phase === 'haunt',
            })
            : null;
        if (pendingAllocation) {
            deferred!.allocations.push(pendingAllocation);
        } else if (!deferred) {
            if (effect.damageKind === 'physical') {
                applyPhysicalDamage(core.currentExplorer, effect.amount, { allowSkull: core.phase === 'haunt' });
            } else {
                applyMentalDamage(core.currentExplorer, effect.amount, { allowSkull: core.phase === 'haunt' });
            }
        }
        return nextSnapshot;
    }
    if (effect.mode === 'optionalEventRoll') {
        return nextSnapshot;
    }
    if (effect.mode === 'optionalEffect') {
        return nextSnapshot;
    }
    if (effect.mode === 'optionalHauntRoll') {
        return nextSnapshot;
    }
    if (effect.mode === 'chooseTraitRoll') {
        return nextSnapshot;
    }
    if (effect.mode === 'traitRoll') {
        return nextSnapshot;
    }
    if (effect.mode === 'optionalItemEffect') {
        const selectedCard = effect.selectedCardId
            ? core.currentExplorer.inventory.find((card) => card.id === effect.selectedCardId)
            : null;
        if (selectedCard) {
            core.currentExplorer.inventory = core.currentExplorer.inventory.filter((card) => card.id !== selectedCard.id);
            if (effect.consumeAction === 'bury') {
                restorePossessionCardToBottom(core, selectedCard.kind, selectedCard);
            }
            applyEventEffect(core, effect.acceptEffect, random, nextSnapshot, options);
        } else {
            applyEventEffect(core, effect.declineEffect, random, nextSnapshot, options);
        }
        return nextSnapshot;
    }
    if (effect.mode === 'allTraitChecks') {
        if (!effect.results && !random) {
            throw new Error('allTraitChecks requires random');
        }
        const results = effect.results ?? rollAllTraitChecks(core.currentExplorer, effect.traits, effect.passMin, random!, core);
        const failedTraits = results.filter((result) => !result.passed).map((result) => result.trait);
        for (const trait of failedTraits) {
            applyTraitLoss(core.currentExplorer, [trait], effect.failAmount, { allowSkull: core.phase === 'haunt' });
        }
        if (failedTraits.length === 0 && !effectHasUnresolvedTraitChoice(effect.allPassEffect)) {
            applyEventEffect(core, effect.allPassEffect, random, nextSnapshot, options);
        }
        core.recentAllTraitCheck = {
            sourceTitle: effect.name,
            playerId: core.currentExplorer.playerId,
            results,
        };
        return nextSnapshot;
    }
    if (effect.mode === 'rolledDamage') {
        if (!effect.rolls && !random) {
            throw new Error('rolledDamage requires random');
        }
        const damageRolls = effect.rolls ?? rollBetrayalDicePips(random!, effect.dice);
        nextSnapshot.damageRolls.push(...damageRolls);
        const amount = damageRolls.reduce((sum, pip) => sum + pip, 0);
        const deferred = options?.deferRolledDamageAllocation;
        const pendingAllocation = deferred
            ? createPendingDamageAllocation({
                id: `event-rolled-damage-${core.currentExplorer.playerId}-${deferred.timestamp}-${deferred.allocations.length}`,
                explorer: core.currentExplorer,
                sourceTitle: deferred.sourceTitle,
                damageKind: effect.damageKind,
                amount,
                allowSkull: core.phase === 'haunt',
            })
            : null;
        if (pendingAllocation) {
            deferred!.allocations.push(pendingAllocation);
        }
        const appliedAmount = deferred
            ? pendingAllocation?.amount ?? 0
            : effect.damageKind === 'physical'
                ? applyPhysicalDamage(core.currentExplorer, amount, { allowSkull: core.phase === 'haunt' })
                : applyMentalDamage(core.currentExplorer, amount, { allowSkull: core.phase === 'haunt' });
        nextSnapshot.rolledDamageResults.push({
            damageKind: effect.damageKind,
            rolls: [...damageRolls],
            total: amount,
            appliedAmount,
        });
        return nextSnapshot;
    }
    if (effect.mode === 'drawPossession') {
        const drawnCard = effect.drawnCard
            ? cloneInventoryCard(effect.drawnCard)
            : createDrawnCard(core, effect.kind);
        core.currentExplorer.inventory = [...core.currentExplorer.inventory, drawnCard];
        removePossessionCardFromDeck(core, effect.kind, drawnCard.id);
        nextSnapshot.drawnCards.push(drawnCard);
        return nextSnapshot;
    }
    if (effect.mode === 'placeExplorerInRoom') {
        core.currentExplorer.roomId = effect.roomId;
        return nextSnapshot;
    }
    if (effect.mode === 'placeExplorerInFloorStartingRoom') {
        const targetRoom = core.rooms.find((room) => room.floor === effect.floor && room.startingTile);
        if (targetRoom) {
            core.currentExplorer.roomId = targetRoom.id;
        }
        return nextSnapshot;
    }
    if (effect.mode === 'placeExplorerInNextFloorStartingRoom') {
        const currentRoom = core.rooms.find((room) => room.id === core.currentExplorer.roomId);
        const targetFloor: BetrayalRoomFloor = currentRoom?.floor === 'upper'
            ? 'ground'
            : currentRoom?.floor === 'ground'
                ? 'basement'
                : effect.basementFallbackFloor;
        const targetRoom = core.rooms.find((room) => room.floor === targetFloor && room.startingTile);
        if (targetRoom) {
            core.currentExplorer.roomId = targetRoom.id;
        }
        if (currentRoom?.floor === 'basement' && effect.basementFallbackDamage) {
            const deferred = options?.deferRolledDamageAllocation;
            const pendingAllocation = deferred
                ? createPendingDamageAllocation({
                    id: `event-floor-fallback-damage-${core.currentExplorer.playerId}-${deferred.timestamp}-${deferred.allocations.length}`,
                    explorer: core.currentExplorer,
                    sourceTitle: deferred.sourceTitle,
                    damageKind: effect.basementFallbackDamage.damageKind,
                    amount: effect.basementFallbackDamage.amount,
                    allowSkull: core.phase === 'haunt',
                })
                : null;
            if (pendingAllocation) {
                deferred!.allocations.push(pendingAllocation);
            } else if (!deferred) {
                if (effect.basementFallbackDamage.damageKind === 'physical') {
                    applyPhysicalDamage(core.currentExplorer, effect.basementFallbackDamage.amount, { allowSkull: core.phase === 'haunt' });
                } else {
                    applyMentalDamage(core.currentExplorer, effect.basementFallbackDamage.amount, { allowSkull: core.phase === 'haunt' });
                }
            }
        }
        return nextSnapshot;
    }
    if (effect.mode === 'placeExplorerInDiscoveredRoomByVisualId') {
        const targetRoom = core.rooms.find((room) => (
            room.state === 'discovered' && effect.visualIds.includes(room.visualId)
        ));
        if (targetRoom) {
            core.currentExplorer.roomId = targetRoom.id;
        }
        return nextSnapshot;
    }
    if (effect.mode === 'placeExplorerInDiscoveredRoomByFloor') {
        const targetRoom = effect.targetRoomId
            ? core.rooms.find((room) => room.id === effect.targetRoomId && room.state === 'discovered')
            : null;
        if (targetRoom && effectAllowsRoomTargetChoice(core, effect, targetRoom.id)) {
            core.currentExplorer.roomId = targetRoom.id;
        }
        return nextSnapshot;
    }
    if (effect.mode === 'placeExplorerInAdjacentRoom') {
        const targetRoom = effect.targetRoomId
            ? core.rooms.find((room) => room.id === effect.targetRoomId && room.state === 'discovered')
            : null;
        if (targetRoom && effectAllowsAdjacentRoomChoice(core, targetRoom.id)) {
            core.currentExplorer.roomId = targetRoom.id;
        }
        return nextSnapshot;
    }
    applyGeneralDamage(core.currentExplorer, effect.amount, effect.traits, { allowSkull: core.phase === 'haunt' });
    return nextSnapshot;
}

export function applyEventEffectWithDeferredRolledDamage(
    core: BetrayalCore,
    effect: UseEffectProfile,
    sourceTitle: string,
    timestamp: number,
): {
    eventEffectSnapshot?: BetrayalEventEffectSnapshot;
    pendingRolledDamageAllocation: BetrayalPendingDamageAllocationState | null;
} {
    const rolledDamageAllocations: BetrayalPendingDamageAllocationState[] = [];
    const eventEffectSnapshot = applyEventEffect(core, effect, undefined, undefined, {
        deferRolledDamageAllocation: {
            sourceTitle,
            timestamp,
            allocations: rolledDamageAllocations,
        },
    });
    return {
        eventEffectSnapshot,
        pendingRolledDamageAllocation: chainPendingDamageAllocations(rolledDamageAllocations),
    };
}

export function activatePendingRolledDamageAllocation(
    core: BetrayalCore,
    pendingRolledDamageAllocation: BetrayalPendingDamageAllocationState | null,
): boolean {
    if (!pendingRolledDamageAllocation) {
        return false;
    }
    core.pendingDamageAllocation = pendingRolledDamageAllocation;
    core.activePlayerId = pendingRolledDamageAllocation.playerId;
    return true;
}
