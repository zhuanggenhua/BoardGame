import type { PlayerId } from '../../../engine/types';
import { registerSimpleAbility, resolveAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addPermanentPower,
    addPowerCounter,
    addTempPower,
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildPlayerTargetOptions,
    buildStandardDrawEvents,
    buildStandardDrawEventsFromRuntimeContext,
    buildSemanticOngoingAttachEvents,
    buildValidatedCardToDeckBottomEvents,
    buildValidatedMoveEvents,
    buildValidatedReturnEvents,
    createSkipOption,
    getMinionPower,
    grantContextualExtraAction,
    grantContextualExtraMinion,
    inspectDeck,
    modifyBreakpoint,
    recoverCardsFromDiscard,
    revealHand,
    revealDeckTop,
} from '../domain/abilityHelpers';
import {
    createAbilityRuntimeSimpleChoice,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import { buildActionPlayedEvent } from '../domain/actionPlayEvent';
import {
    registerActiveBaseAbility,
    registerBaseAbility,
    type BaseAbilityContext,
    type BaseAbilityResult,
} from '../domain/baseAbilities';
import { getActionControllerId } from '../domain/ongoingModifiers';
import { registerProtection, registerTrigger, type ProtectionCheckContext, type TriggerContext } from '../domain/ongoingEffects';
import { buildValidatedOngoingDetachEvents, findLiveOngoingCardLocation } from '../domain/ongoingDetach';
import { getBaseDef, getCardDef } from '../data/cards';
import type {
    ActionCardDef,
    BaseAbilityUsedEvent,
    BaseMetadataUpdatedEvent,
    CardInstance,
    CardToDeckBottomEvent,
    CardsDrawnEvent,
    DeckReorderedEvent,
    MinionPlayedEvent,
    MinionMetadataUpdatedEvent,
    MinionSwappedEvent,
    MinionOnBase,
    SmashUpSwapZone,
    SmashUpCore,
    SmashUpEvent,
    TalentUsedEvent,
} from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import {
    SHAYU_TRIGGER_CONTRACT,
    baseLabel,
    collectBaseTargets,
    collectMinionTargets,
    minionLabel,
    runtimeToAbilityResult,
    runtimeToTriggerResult,
    type BaseChoice,
    type ButtonChoice,
    type CardChoice,
    type MinionChoice,
    type MinionTarget,
    type PromptContext,
} from './shayu_common';

type PowerMode = 'counter' | 'temp' | 'permanent';

type PowerPromptContext = PromptContext & {
    sourceId: string;
    title: string;
    targets: MinionTarget[];
    amount: number;
    mode: PowerMode;
    optional?: boolean;
    maxSelections?: number;
    uniqueBase?: boolean;
};

type MovePromptContext = PromptContext & {
    sourceId: string;
    title: string;
    candidates: MinionTarget[];
    optional?: boolean;
    fixedDestinationBaseIndex?: number;
    anchorBaseIndex?: number;
    sourcePlayerId: PlayerId;
    sourceDefId: string;
    sourceKind: 'action' | 'nonAction';
    sourceControllerId?: PlayerId;
    sourceBaseIndex?: number;
};

type MoveDestinationContext = PromptContext & {
    sourceId: string;
    minionUid: string;
    minionDefId: string;
    fromBaseIndex: number;
    destinationBases: Array<{ baseIndex: number; label: string }>;
    sourcePlayerId: PlayerId;
    sourceDefId: string;
    sourceKind: 'action' | 'nonAction';
    sourceControllerId?: PlayerId;
    sourceBaseIndex?: number;
};

type MinionEffectPromptContext = PromptContext & {
    sourceId: string;
    title: string;
    candidates: MinionTarget[];
    kind: 'return-to-hand' | 'deck-bottom' | 'grant-extra-action';
    sourceDefId: string;
    sourceKind: 'action' | 'nonAction';
    optional?: boolean;
};

type AttachedActionTransferChoice = {
    cardUid: string;
    defId: string;
    ownerId: PlayerId;
    label: string;
    sourceBaseIndex: number;
    sourceMinionUid: string;
    sourceMinionDefId: string;
};

type ActionTransferSourceContext = PromptContext & {
    sourceId: string;
    title: string;
    actions: AttachedActionTransferChoice[];
    sourceDefId: string;
    sourceKind: 'action' | 'nonAction';
    destinationMode: 'other-own-minion' | 'between-anchor-and-other';
    anchorMinionUid?: string;
    anchorBaseIndex?: number;
    addCounterOnDestination?: boolean;
    followupTalentFeedbackSource?: string;
    optional?: boolean;
    repeatUntilSkip?: boolean;
};

type ActionTransferDestinationContext = PromptContext & {
    sourceId: string;
    title: string;
    action: AttachedActionTransferChoice;
    destinations: MinionTarget[];
    sourceDefId: string;
    sourceKind: 'action' | 'nonAction';
    addCounterOnDestination?: boolean;
    followupTalentFeedbackSource?: string;
    repeatUntilSkip?: boolean;
    remainingActions?: AttachedActionTransferChoice[];
    repeatSourceId?: string;
    repeatSourceTitle?: string;
    repeatDestinationMode?: ActionTransferSourceContext['destinationMode'];
};

type TalentFollowupChoice = {
    kind: 'minion' | 'ongoing';
    cardUid: string;
    defId: string;
    baseIndex: number;
    label: string;
    hostMinionUid?: string;
};

type TalentFollowupContext = PromptContext & {
    sourceId: string;
    title: string;
    talents: TalentFollowupChoice[];
};

type CardPromptContext = PromptContext & {
    sourceId: string;
    title: string;
    cards: Array<{ cardUid: string; defId: string; ownerId: PlayerId; label: string; zone?: 'hand' | 'deck' | 'discard' | 'attached' }>;
    kind: 'discard-to-deck' | 'draw-from-deck' | 'hand-to-bottom' | 'return-action-to-hand';
    optional?: boolean;
};

type BasePromptContext = PromptContext & {
    sourceId: string;
    title: string;
    bases: Array<{ baseIndex: number; label: string }>;
    kind: 'go-gerald' | 'pearl-world-down' | 'armor-breakpoint';
    sourceCardUid?: string;
};

type SlimePoolTargetContext = PromptContext & {
    sourceId: string;
    cardUid: string;
    defId: string;
    ownerId: PlayerId;
    baseIndex: number;
    baseDefId: string;
    targets: MinionTarget[];
};

type CopyTalentPromptContext = PromptContext & {
    sourceId: string;
    sourceMinionUid: string;
    sourceMinionDefId: string;
    sourceBaseIndex: number;
    candidates: MinionTarget[];
};

type FusionActionCopyPromptContext = PromptContext & {
    sourceId: string;
    title: string;
    sourceCardUid: string;
    candidates: MinionTarget[];
    targetBaseIndex?: number;
};

type DiscardPlayOnMinionActionChoice = {
    cardUid: string;
    defId: string;
    ownerId: PlayerId;
    label: string;
};

type DiscardPlayOnMinionActionContext = PromptContext & {
    sourceId: string;
    title: string;
    actions: DiscardPlayOnMinionActionChoice[];
};

type DiscardPlayOnMinionTargetContext = PromptContext & {
    sourceId: string;
    action: DiscardPlayOnMinionActionChoice;
    targets: MinionTarget[];
};

type MinionSwapCandidateChoice = {
    cardUid: string;
    defId: string;
    ownerId: PlayerId;
    zone: SmashUpSwapZone;
    label: string;
};

type MinionSwapMode = 'printed-four-different' | 'equal-or-less-different' | 'power-five-plus';

type MinionSwapSourceContext = PromptContext & {
    sourceId: string;
    title: string;
    sources: MinionTarget[];
    mode: MinionSwapMode;
    zones: SmashUpSwapZone[];
    addCounterToIncoming?: boolean;
    grantExtraActionSourceId?: string;
};

type MinionSwapCandidateContext = PromptContext & {
    sourceId: string;
    title: string;
    source: MinionTarget;
    candidates: MinionSwapCandidateChoice[];
    addCounterToIncoming?: boolean;
    grantExtraActionSourceId?: string;
};

type ButtonPromptContext = PromptContext & {
    sourceId: string;
    title: string;
    kind:
        | 'kandinsky-talent'
        | 'gecko-power-talent'
        | 'masters-teachings-temp'
        | 'ruby-apply'
        | 'can-do-minion'
        | 'base-extra-action'
        | 'base-counter-minion'
        | 'topaz-trigger'
        | 'pearl-talent'
        | 'alls-right-talent'
        | 'viscount-trigger'
        | 'magic-weapon-talent'
        | 'powerful-sword-talent';
    sourceMinionUid?: string;
    sourceMinionDefId?: string;
    sourceCardUid?: string;
    sourceBaseIndex?: number;
    targetMinionUid?: string;
    targetMinionDefId?: string;
    targetBaseIndex?: number;
    baseDefId?: string;
};

type CrystalFirstContext = PromptContext & {
    candidates: MinionTarget[];
    sourceMinionUid: string;
    sourceBaseIndex: number;
};

type CrystalSecondContext = PromptContext & {
    targetBaseIndex: number;
    candidates: MinionTarget[];
};

type BikeFirstContext = PromptContext & {
    sourceId: string;
    ownTargets: MinionTarget[];
    fixedDestinationBaseIndex?: number;
};

type BikeSecondContext = PromptContext & {
    sourceId: string;
    first: MinionTarget;
    otherTargets: MinionTarget[];
    fixedDestinationBaseIndex?: number;
};

type BikeDestinationContext = PromptContext & {
    sourceId: string;
    first: MinionTarget;
    second: MinionTarget;
    destinationBases: Array<{ baseIndex: number; label: string }>;
};

type TrulyOutstandingFirstContext = PromptContext & {
    candidates: MinionTarget[];
};

type TrulyOutstandingSecondContext = PromptContext & {
    selectedCount: number;
    candidates: MinionTarget[];
};

type JamPlayerChoice = {
    playerId: PlayerId;
    label: string;
};

type JamPlayerContext = PromptContext & {
    sourceBaseIndex: number;
    players: JamPlayerChoice[];
};

type JamMinionContext = PromptContext & {
    sourceBaseIndex: number;
    selectedPlayerId: PlayerId;
    selectedIsOtherPlayer: boolean;
    minions: Array<{ cardUid: string; defId: string; ownerId: PlayerId; power: number; label: string }>;
};

type JamRewardContext = PromptContext & {
    sourceBaseIndex: number;
    counterTargets: MinionTarget[];
};

function sourceMeta(ctx: AbilityContext, sourceDefId = ctx.defId) {
    return {
        sourcePlayerId: ctx.playerId,
        sourceCardUid: ctx.cardUid,
        sourceDefId,
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: ctx.baseIndex,
    };
}

function baseAbilityUsed(playerId: PlayerId, baseIndex: number, baseDefId: string, now: number): BaseAbilityUsedEvent {
    return {
        type: SU_EVENTS.BASE_ABILITY_USED,
        payload: { playerId, baseIndex, baseDefId },
        timestamp: now,
    };
}

function baseMetadata(
    baseIndex: number,
    metadataUpdate: Record<string, unknown>,
    reason: string,
    now: number,
): BaseMetadataUpdatedEvent {
    return {
        type: SU_EVENTS.BASE_METADATA_UPDATED,
        payload: { baseIndex, metadataUpdate, reason },
        timestamp: now,
    };
}

function minionMetadata(
    minionUid: string,
    baseIndex: number,
    metadataUpdate: Record<string, unknown>,
    reason: string,
    now: number,
): MinionMetadataUpdatedEvent {
    return {
        type: SU_EVENTS.MINION_METADATA_UPDATED,
        payload: { minionUid, baseIndex, metadataUpdate, reason },
        timestamp: now,
    };
}

function isFirstActionPlayedThisTurn(ctx: AbilityContext): boolean {
    return (ctx.state.players[ctx.playerId]?.actionsPlayed ?? 0) <= 1;
}

function hasPlayedAtLeastTwoActions(ctx: AbilityContext): boolean {
    return (ctx.state.players[ctx.playerId]?.actionsPlayed ?? 0) >= 2;
}

function cardLabel(defId: string): string {
    return getCardDef(defId)?.name ?? defId;
}

function getPrintedPower(defId: string): number {
    const def = getCardDef(defId);
    if (!def) return 0;
    if (def.type === 'minion') return def.power ?? 0;
    if (def.type === 'fusion') return def.minionPower ?? 0;
    return 0;
}

function isMinionLikeCard(defId: string): boolean {
    const def = getCardDef(defId);
    return def?.type === 'minion' || def?.type === 'fusion';
}

function sameCardName(leftDefId: string, rightDefId: string): boolean {
    const left = getCardDef(leftDefId);
    const right = getCardDef(rightDefId);
    return (left?.name ?? leftDefId) === (right?.name ?? rightDefId);
}

function hasSwordAttached(minion: MinionOnBase): boolean {
    return minion.attachedActions.some((action) => {
        const def = getCardDef(action.defId);
        const name = `${def?.name ?? ''} ${def?.nameEn ?? ''} ${action.defId}`.toLowerCase();
        return name.includes('sword') || name.includes('剑');
    });
}

function zoneLabel(zone: SmashUpSwapZone): string {
    if (zone === 'hand') return '手牌';
    if (zone === 'deck') return '牌库';
    return '弃牌堆';
}

function minionSwapEvent(
    playerId: PlayerId,
    source: MinionTarget,
    candidate: MinionSwapCandidateChoice,
    reason: string,
    now: number,
    state: SmashUpCore,
): MinionSwappedEvent {
    const liveSource = state.bases[source.baseIndex]?.minions.find(minion => minion.uid === source.uid);
    return {
        type: SU_EVENTS.MINION_SWAPPED,
        payload: {
            playerId,
            sourceMinionUid: source.uid,
            sourceMinionDefId: source.defId,
            sourceOwnerId: liveSource?.owner ?? playerId,
            sourceBaseIndex: source.baseIndex,
            candidateCardUid: candidate.cardUid,
            candidateDefId: candidate.defId,
            candidateOwnerId: candidate.ownerId,
            candidateZone: candidate.zone,
            reason,
        },
        timestamp: now,
    };
}

function nextPlayerTurnStartExpiration(state: SmashUpCore, playerId: PlayerId): number {
    const turnOrder = state.turnOrder ?? [];
    const currentIndex = Number.isInteger(state.currentPlayerIndex)
        ? state.currentPlayerIndex
        : turnOrder.indexOf((state as { currentPlayer?: PlayerId }).currentPlayer ?? '');
    const playerIndex = turnOrder.indexOf(playerId);
    if (turnOrder.length === 0 || currentIndex < 0 || playerIndex < 0) return state.turnNumber + 1;
    return state.turnNumber + (playerIndex > currentIndex ? 0 : 1);
}

function isStandardAction(defId: string): boolean {
    const def = getCardDef(defId);
    if (!def) return false;
    if (def.type === 'action') return def.subtype === 'standard';
    if (def.type === 'fusion') return def.actionSubtype === 'standard';
    return false;
}

function isPlayOnMinionAction(defId: string): boolean {
    const def = getCardDef(defId) as ActionCardDef | undefined;
    if (!def) return false;
    if (def.type === 'action') return def.ongoingTarget === 'minion' || def.playNeedsMinion === true;
    if ((def as any).type === 'fusion') {
        return (def as any).actionOngoingTarget === 'minion' || (def as any).actionPlayNeedsMinion === true;
    }
    return false;
}

function playOnMinionActionTargets(state: SmashUpCore, playerId: PlayerId, defId: string): MinionTarget[] {
    const def = getCardDef(defId);
    const targetController = def?.type === 'action'
        ? def.playTargetMinionController
        : def?.type === 'fusion'
            ? def.actionPlayTargetMinionController
            : undefined;
    return collectMinionTargets(state, (minion) => {
        if (targetController === 'self') return minion.controller === playerId;
        if (targetController === 'opponent') return minion.controller !== playerId;
        return true;
    });
}

function collectPlayOnMinionActionsFromAllDiscards(state: SmashUpCore): DiscardPlayOnMinionActionChoice[] {
    return Object.values(state.players).flatMap(player =>
        player.discard
            .filter(card => isPlayOnMinionAction(card.defId))
            .map(card => ({
                cardUid: card.uid,
                defId: card.defId,
                ownerId: card.owner,
                label: `${cardLabel(card.defId)}（${player.id} 弃牌堆）`,
            })));
}

function hasCopyableMinionTalent(defId: string): boolean {
    if (defId === 'rulers_cosmos_guy_man') return false;
    return hasMinionTalent(defId);
}

function hasMinionTalent(defId: string): boolean {
    const def = getCardDef(defId);
    const hasTalent = def?.type === 'minion'
        ? def.abilityTags?.includes('talent') === true
        : def?.type === 'fusion'
            ? def.minionAbilityTags?.includes('talent') === true
            : false;
    return hasTalent && !!resolveAbility(defId, 'talent');
}

function hasActionTalent(defId: string): boolean {
    const def = getCardDef(defId);
    const hasTalentExecutor = !!resolveAbility(defId, 'talent');
    return hasTalentExecutor && (def?.type === 'action' || def?.type === 'fusion');
}

function findSourceMinion(ctx: AbilityContext): { minion: MinionOnBase; baseIndex: number } | undefined {
    for (let baseIndex = 0; baseIndex < ctx.state.bases.length; baseIndex += 1) {
        const minion = ctx.state.bases[baseIndex].minions.find(candidate => candidate.uid === ctx.cardUid);
        if (minion) return { minion, baseIndex };
    }
    return undefined;
}

function findAttachedHost(
    state: SmashUpCore,
    cardUid: string,
): { host: MinionOnBase; baseIndex: number; action: MinionOnBase['attachedActions'][number] } | undefined {
    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex += 1) {
        for (const host of state.bases[baseIndex].minions) {
            const action = host.attachedActions.find(candidate => candidate.uid === cardUid);
            if (action) return { host, baseIndex, action };
        }
    }
    return undefined;
}

function attachedActionTransferChoice(
    state: SmashUpCore,
    action: MinionOnBase['attachedActions'][number],
    host: MinionOnBase,
    baseIndex: number,
): AttachedActionTransferChoice {
    return {
        cardUid: action.uid,
        defId: action.defId,
        ownerId: action.ownerId,
        label: `${cardLabel(action.defId)} @ ${minionLabel(state, host, baseIndex)}`,
        sourceBaseIndex: baseIndex,
        sourceMinionUid: host.uid,
        sourceMinionDefId: host.defId,
    };
}

function ownMinionAttachedActions(
    state: SmashUpCore,
    playerId: PlayerId,
    options: { excludeCardUid?: string; ownActionsOnly?: boolean } = {},
): AttachedActionTransferChoice[] {
    return state.bases.flatMap((base, baseIndex) =>
        base.minions
            .filter(minion => minion.controller === playerId)
            .flatMap(minion => minion.attachedActions
                .filter(action => action.uid !== options.excludeCardUid)
                .filter(action => !options.ownActionsOnly || getActionControllerId(action) === playerId)
                .map(action => attachedActionTransferChoice(state, action, minion, baseIndex))));
}

function ownMinionTargets(state: SmashUpCore, playerId: PlayerId): MinionTarget[] {
    return collectMinionTargets(state, minion => minion.controller === playerId);
}

function talentUsedEvent(
    playerId: PlayerId,
    choice: TalentFollowupChoice,
    now: number,
): TalentUsedEvent {
    return {
        type: SU_EVENTS.TALENT_USED,
        payload: {
            playerId,
            defId: choice.defId,
            baseIndex: choice.baseIndex,
            ...(choice.kind === 'minion'
                ? { minionUid: choice.cardUid }
                : { ongoingCardUid: choice.cardUid }),
        },
        timestamp: now,
    };
}

function collectTalentFollowupChoices(
    state: SmashUpCore,
    playerId: PlayerId,
    target: MinionTarget,
    incomingAction?: AttachedActionTransferChoice,
): TalentFollowupChoice[] {
    const host = state.bases[target.baseIndex]?.minions.find(minion => minion.uid === target.uid);
    if (!host) return [];
    const choices: TalentFollowupChoice[] = [];
    if (host.controller === playerId && !host.talentUsed && hasMinionTalent(host.defId)) {
        choices.push({
            kind: 'minion',
            cardUid: host.uid,
            defId: host.defId,
            baseIndex: target.baseIndex,
            label: `${cardLabel(host.defId)}（随从天赋）`,
        });
    }

    const attached = [...host.attachedActions];
    if (incomingAction) {
        const liveIncoming = state.bases[incomingAction.sourceBaseIndex]?.minions
            .find(minion => minion.uid === incomingAction.sourceMinionUid)
            ?.attachedActions
            .find(action => action.uid === incomingAction.cardUid);
        attached.push({
            uid: incomingAction.cardUid,
            defId: incomingAction.defId,
            ownerId: incomingAction.ownerId,
            talentUsed: liveIncoming?.talentUsed,
            metadata: liveIncoming?.metadata,
        });
    }

    const seen = new Set<string>();
    for (const action of attached) {
        if (seen.has(action.uid)) continue;
        seen.add(action.uid);
        if (getActionControllerId(action) !== playerId || action.talentUsed || !hasActionTalent(action.defId)) continue;
        choices.push({
            kind: 'ongoing',
            cardUid: action.uid,
            defId: action.defId,
            baseIndex: target.baseIndex,
            hostMinionUid: host.uid,
            label: `${cardLabel(action.defId)}（附着战术天赋）`,
        });
    }
    return choices;
}

function collectMinionSwapCandidates(
    state: SmashUpCore,
    playerId: PlayerId,
    source: MinionTarget,
    mode: MinionSwapMode,
    zones: SmashUpSwapZone[],
): MinionSwapCandidateChoice[] {
    const player = state.players[playerId];
    if (!player) return [];
    const liveSource = state.bases[source.baseIndex]?.minions.find(minion => minion.uid === source.uid);
    const sourcePower = liveSource
        ? getMinionPower(state, liveSource, source.baseIndex)
        : getPrintedPower(source.defId);
    const include = (card: CardInstance): boolean => {
        if (!isMinionLikeCard(card.defId)) return false;
        if (card.uid === source.uid || sameCardName(card.defId, source.defId)) return false;
        const printedPower = getPrintedPower(card.defId);
        if (mode === 'printed-four-different') return printedPower > 0;
        if (mode === 'equal-or-less-different') return printedPower <= sourcePower;
        return printedPower >= 5;
    };
    const zoneCards: Array<{ zone: SmashUpSwapZone; cards: CardInstance[] }> = [
        { zone: 'hand', cards: player.hand },
        { zone: 'deck', cards: player.deck },
        { zone: 'discard', cards: player.discard },
    ];
    return zoneCards
        .filter(entry => zones.includes(entry.zone))
        .flatMap(entry => entry.cards
            .filter(include)
            .map(card => ({
                cardUid: card.uid,
                defId: card.defId,
                ownerId: card.owner,
                zone: entry.zone,
                label: `${cardLabel(card.defId)}（${zoneLabel(entry.zone)}）`,
            })));
}

function allMinionTargets(state: SmashUpCore): MinionTarget[] {
    return collectMinionTargets(state, () => true);
}

function minionsAtBase(state: SmashUpCore, baseIndex: number): MinionTarget[] {
    return collectMinionTargets(state, (_minion, index) => index === baseIndex);
}

function cardsDrawn(playerId: PlayerId, cardUids: string[], now: number): CardsDrawnEvent {
    return {
        type: SU_EVENTS.CARDS_DRAWN,
        payload: { playerId, count: cardUids.length, cardUids },
        timestamp: now,
    };
}

function deckReordered(playerId: PlayerId, deckUids: string[], now: number, sourcePlayerId?: PlayerId): DeckReorderedEvent {
    return {
        type: SU_EVENTS.DECK_REORDERED,
        payload: {
            playerId,
            deckUids,
            ...(sourcePlayerId && sourcePlayerId !== playerId ? { sourcePlayerId } : {}),
        },
        timestamp: now,
    };
}

function shuffleDiscardCardsIntoDeck(
    ctx: { state: SmashUpCore; random: AbilityContext['random']; now: number },
    playerId: PlayerId,
    cards: CardInstance[],
): SmashUpEvent[] {
    const player = ctx.state.players[playerId];
    if (!player || cards.length === 0) return [];
    const selected = new Set(cards.map(card => card.uid));
    const shuffled = ctx.random.shuffle([...cards]).map(card => card.uid);
    return [deckReordered(playerId, [...shuffled, ...player.deck.map(card => card.uid)], ctx.now)];
}

function applyPowerEvent(
    state: SmashUpCore,
    target: { uid: string; baseIndex: number },
    amount: number,
    mode: PowerMode,
    reason: string,
    now: number,
): SmashUpEvent {
    if (mode === 'counter') return addPowerCounter(target.uid, target.baseIndex, amount, reason, now);
    if (mode === 'permanent') {
        return addPermanentPower(target.uid, target.baseIndex, amount, reason, now, {
            expiresOnTurnNumber: state.turnNumber + 1,
        });
    }
    return addTempPower(target.uid, target.baseIndex, amount, reason, now);
}

function moveEvents(
    state: SmashUpCore | { core: SmashUpCore },
    target: { uid: string; defId: string; baseIndex: number },
    toBaseIndex: number,
    reason: string,
    now: number,
    source: {
        sourcePlayerId: PlayerId;
        sourceDefId: string;
        sourceKind: 'action' | 'nonAction';
        sourceControllerId?: PlayerId;
        sourceBaseIndex?: number;
    },
): SmashUpEvent[] {
    return buildValidatedMoveEvents(state, {
        minionUid: target.uid,
        minionDefId: target.defId,
        fromBaseIndex: target.baseIndex,
        toBaseIndex,
        reason,
        now,
        sourcePlayerId: source.sourcePlayerId,
        sourceDefId: source.sourceDefId,
        sourceKind: source.sourceKind,
        sourceControllerId: source.sourceControllerId,
        sourceBaseIndex: source.sourceBaseIndex,
    });
}

function targetFromChoice(choice: MinionChoice): MinionTarget | undefined {
    if (!choice.minionUid || choice.baseIndex === undefined || !choice.defId) return undefined;
    return {
        uid: choice.minionUid,
        defId: choice.defId,
        baseIndex: choice.baseIndex,
        label: '',
    };
}

const powerPromptProgram = createPromptProgram<PowerPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'half_the_battle_power_prompt',
    interactionSourceIds: [
        'geckos_hokusai',
        'geckos_hokusai_talent',
        'geckos_masters_teachings',
        'geckos_lasagna_party',
        'gi_gerald_mowat_minion',
        'gi_gerald_mowat_action',
        'gi_gerald_rosie_minion',
        'gi_gerald_rosie_action',
        'pearl_images_pearl_temp',
        'pearl_images_truly_outstanding_own',
        'base_sewer_hideout',
    ],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.title,
        [
            ...(context.optional ? [createSkipOption()] : []),
            ...buildMinionTargetOptions(context.targets, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceKind: 'nonAction',
                effectType: 'buff',
            }),
        ],
        {
            sourceId: context.sourceId,
            targetType: 'minion',
            autoResolveIfSingle: false,
            ...(context.maxSelections !== undefined ? { multi: { min: 0, max: context.maxSelections } } : {}),
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choices = Array.isArray(value)
            ? value as MinionChoice[]
            : [value as MinionChoice];
        const events: SmashUpEvent[] = [];
        const usedBases = new Set<number>();
        for (const choice of choices) {
            if (choice.skip) continue;
            const target = targetFromChoice(choice);
            if (!target) continue;
            if (context.uniqueBase) {
                if (usedBases.has(target.baseIndex)) continue;
                usedBases.add(target.baseIndex);
            }
            events.push(applyPowerEvent(state.core, target, context.amount, context.mode, context.sourceId, timestamp));
        }
        return { events };
    },
});

function runPowerPrompt(
    ctx: AbilityContext,
    sourceId: string,
    title: string,
    targets: MinionTarget[],
    amount: number,
    mode: PowerMode,
    options: { optional?: boolean; maxSelections?: number; uniqueBase?: boolean } = {},
): AbilityResult {
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return runtimeToAbilityResult(executeAbilityProgram(powerPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId,
        title,
        targets,
        amount,
        mode,
        ...options,
    }));
}

const moveDestinationPromptProgram = createPromptProgram<MoveDestinationContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'half_the_battle_move_destination',
    interactionSourceIds: [
        'geckos_gecko_blimp_dest',
        'geckos_gecko_power_dest',
        'gi_gerald_ski_lift_action_dest',
        'pearl_images_now_you_know_bike_safety_dest',
    ],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        '选择移动目标基地',
        buildBaseTargetOptions(context.destinationBases, context.matchState.core),
        { sourceId: context.sourceId, targetType: 'base', titleKey: 'ui.half_the_battle_move_destination_title' },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as BaseChoice;
        if (choice.baseIndex === undefined) return { events: [] };
        return {
            events: moveEvents(
                state,
                { uid: context.minionUid, defId: context.minionDefId, baseIndex: context.fromBaseIndex },
                choice.baseIndex,
                context.sourceId,
                timestamp,
                {
                    sourcePlayerId: context.sourcePlayerId,
                    sourceDefId: context.sourceDefId,
                    sourceKind: context.sourceKind,
                    sourceControllerId: context.sourceControllerId,
                    sourceBaseIndex: context.sourceBaseIndex,
                },
            ),
        };
    },
});

const movePromptProgram = createPromptProgram<MovePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'half_the_battle_move_prompt',
    interactionSourceIds: [
        'geckos_gecko_blimp',
        'geckos_gecko_power_move',
        'geckos_now_you_know_bullying',
        'gi_gerald_ski_lift_minion',
        'gi_gerald_ski_lift_action',
        'base_uss_undertaking',
        'rulers_cosmos_fearless_friend',
    ],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.title,
        [
            ...(context.optional ? [createSkipOption()] : []),
            ...buildMinionTargetOptions(context.candidates, {
                state: context.matchState.core,
                sourcePlayerId: context.sourcePlayerId,
                sourceDefId: context.sourceDefId,
                sourceKind: context.sourceKind,
                effectType: 'move',
            }),
        ],
        {
            sourceId: context.sourceId,
            targetType: 'minion',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const choice = value as MinionChoice;
        if (choice.skip) return { events: [] };
        const target = targetFromChoice(choice);
        if (!target) return { events: [] };
        if (context.fixedDestinationBaseIndex !== undefined) {
            return {
                events: moveEvents(state, target, context.fixedDestinationBaseIndex, context.sourceId, timestamp, {
                    sourcePlayerId: context.sourcePlayerId,
                    sourceDefId: context.sourceDefId,
                    sourceKind: context.sourceKind,
                    sourceControllerId: context.sourceControllerId,
                    sourceBaseIndex: context.sourceBaseIndex,
                }),
            };
        }
        if (context.anchorBaseIndex !== undefined && target.baseIndex !== context.anchorBaseIndex) {
            return {
                events: moveEvents(state, target, context.anchorBaseIndex, context.sourceId, timestamp, {
                    sourcePlayerId: context.sourcePlayerId,
                    sourceDefId: context.sourceDefId,
                    sourceKind: context.sourceKind,
                    sourceControllerId: context.sourceControllerId,
                    sourceBaseIndex: context.sourceBaseIndex,
                }),
            };
        }
        const destinationBases = collectBaseTargets(state.core, baseIndex => baseIndex !== target.baseIndex);
        if (destinationBases.length === 0) return { events: [] };
        return executeAbilityProgram(moveDestinationPromptProgram, {
            matchState: state,
            playerId,
            now: timestamp,
            sourceId: `${context.sourceId}_dest`,
            minionUid: target.uid,
            minionDefId: target.defId,
            fromBaseIndex: target.baseIndex,
            destinationBases,
            sourcePlayerId: context.sourcePlayerId,
            sourceDefId: context.sourceDefId,
            sourceKind: context.sourceKind,
            sourceControllerId: context.sourceControllerId,
            sourceBaseIndex: context.sourceBaseIndex,
        });
    },
});

function runMovePrompt(
    ctx: AbilityContext,
    sourceId: string,
    title: string,
    candidates: MinionTarget[],
    options: Partial<Omit<MovePromptContext, keyof PromptContext | 'sourceId' | 'title' | 'candidates'>> = {},
): AbilityResult {
    if (candidates.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return runtimeToAbilityResult(executeAbilityProgram(movePromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId,
        title,
        candidates,
        sourcePlayerId: options.sourcePlayerId ?? ctx.playerId,
        sourceDefId: options.sourceDefId ?? ctx.defId,
        sourceKind: options.sourceKind ?? 'action',
        sourceControllerId: options.sourceControllerId ?? ctx.playerId,
        sourceBaseIndex: options.sourceBaseIndex ?? ctx.baseIndex,
        ...(options.optional ? { optional: true } : {}),
        ...(options.fixedDestinationBaseIndex !== undefined ? { fixedDestinationBaseIndex: options.fixedDestinationBaseIndex } : {}),
        ...(options.anchorBaseIndex !== undefined ? { anchorBaseIndex: options.anchorBaseIndex } : {}),
    }));
}

const minionEffectPromptProgram = createPromptProgram<MinionEffectPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'half_the_battle_minion_effect_prompt',
    interactionSourceIds: [
        'geckos_now_you_know_bullying_special',
        'gi_gerald_obstruction_action',
        'gi_gerald_shellback_minion',
        'rulers_cosmos_andko',
    ],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.title,
        [
            ...(context.optional ? [createSkipOption()] : []),
            ...buildMinionTargetOptions(context.candidates, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: context.sourceDefId,
                sourceKind: context.sourceKind,
                effectType: context.kind === 'deck-bottom' ? 'affect' : undefined,
            }),
        ],
        { sourceId: context.sourceId, targetType: 'minion', autoResolveIfSingle: false },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as MinionChoice;
        if (choice.skip) return { events: [] };
        const target = targetFromChoice(choice);
        if (!target) return { events: [] };
        if (context.kind === 'return-to-hand') {
            return {
                events: buildValidatedReturnEvents(state.core, {
                    minionUid: target.uid,
                    minionDefId: target.defId,
                    fromBaseIndex: target.baseIndex,
                    sourcePlayerId: context.playerId,
                    sourceDefId: context.sourceDefId,
                    sourceKind: context.sourceKind,
                    reason: context.sourceId,
                    now: timestamp,
                }),
            };
        }
        if (context.kind === 'deck-bottom') {
            const ownerId = state.core.bases[target.baseIndex]?.minions.find(minion => minion.uid === target.uid)?.owner ?? context.playerId;
            return {
                events: buildValidatedCardToDeckBottomEvents(state.core, {
                    cardUid: target.uid,
                    defId: target.defId,
                    ownerId,
                    sourcePlayerId: context.playerId,
                    sourceDefId: context.sourceDefId,
                    sourceKind: context.sourceKind,
                    expectedLocation: 'bases',
                    reason: context.sourceId,
                    now: timestamp,
                }),
            };
        }
        return {
            events: [grantContextualExtraAction({ playerId: context.playerId, now: timestamp, matchState: state.sys }, context.sourceId, {
                restrictToMinionUid: target.uid,
            })],
        };
    },
});

function runMinionEffectPrompt(
    ctx: AbilityContext,
    sourceId: string,
    title: string,
    candidates: MinionTarget[],
    kind: MinionEffectPromptContext['kind'],
    options: { sourceDefId?: string; sourceKind?: 'action' | 'nonAction'; optional?: boolean } = {},
): AbilityResult {
    if (candidates.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return runtimeToAbilityResult(executeAbilityProgram(minionEffectPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId,
        title,
        candidates,
        kind,
        sourceDefId: options.sourceDefId ?? ctx.defId,
        sourceKind: options.sourceKind ?? 'action',
        ...(options.optional ? { optional: true } : {}),
    }));
}

const actionTransferDestinationPromptProgram = createPromptProgram<ActionTransferDestinationContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'half_the_battle_action_transfer_destination',
    interactionSourceIds: [
        'rulers_cosmos_powerful_sword_transfer_destination',
        'rulers_cosmos_toxic_waste_transfer_destination',
        'rulers_cosmos_mystic_transference_destination',
        'rulers_cosmos_dolts_halfwits_fools_morons_transfer_destination',
    ],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.title,
        buildMinionTargetOptions(context.destinations, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceDefId: context.sourceDefId,
            sourceKind: context.sourceKind,
            effectType: 'affect',
        }),
        { sourceId: context.sourceId, targetType: 'minion', autoResolveIfSingle: false },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const destination = targetFromChoice(value as MinionChoice);
        if (!destination) return { events: [] };
        const attachEvents = buildSemanticOngoingAttachEvents(state.core, {
            cardUid: context.action.cardUid,
            defId: context.action.defId,
            ownerId: context.action.ownerId,
            sourcePlayerId: context.playerId,
            sourceKind: context.sourceKind,
            targetBaseIndex: destination.baseIndex,
            targetMinionUid: destination.uid,
            now: timestamp,
        });
        const events: SmashUpEvent[] = [...attachEvents];
        if (context.addCounterOnDestination && attachEvents.some(event => event.type === SU_EVENTS.ONGOING_ATTACHED)) {
            events.push(addPowerCounter(destination.uid, destination.baseIndex, 1, context.sourceId, timestamp));
        }
        if (context.followupTalentFeedbackSource) {
            const followupTalents = attachEvents.some(event => event.type === SU_EVENTS.ONGOING_ATTACHED)
                ? collectTalentFollowupChoices(state.core, context.playerId, destination, context.action)
                : [];
            if (followupTalents.length > 0) {
                return {
                    events,
                    context: {
                        matchState: state,
                        playerId: context.playerId,
                        now: timestamp,
                        sourceId: context.followupTalentFeedbackSource,
                        title: '有毒废弃物：你可以使用接收随从上的一个天赋',
                        talents: followupTalents,
                    } satisfies TalentFollowupContext,
                    nextProgram: talentFollowupPromptProgram,
                };
            }
        }
        const remainingActions = context.repeatUntilSkip ? (context.remainingActions ?? []) : [];
        if (remainingActions.length === 0) return { events };
        return {
            events,
            context: {
                matchState: state,
                playerId: context.playerId,
                now: timestamp,
                sourceId: context.repeatSourceId ?? 'rulers_cosmos_dolts_halfwits_fools_morons_transfer_source',
                title: context.repeatSourceTitle ?? '傻瓜们！：可以继续选择要转移的战术',
                actions: remainingActions,
                sourceDefId: context.sourceDefId,
                sourceKind: context.sourceKind,
                destinationMode: context.repeatDestinationMode ?? 'other-own-minion',
                optional: true,
                repeatUntilSkip: true,
                ...(context.addCounterOnDestination ? { addCounterOnDestination: true } : {}),
            } satisfies ActionTransferSourceContext,
            nextProgram: actionTransferSourcePromptProgram,
        };
    },
});

const talentFollowupPromptProgram = createPromptProgram<TalentFollowupContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'half_the_battle_talent_followup',
    interactionSourceIds: ['rulers_cosmos_toxic_waste_special_talent_followup'],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.title,
        [
            createSkipOption(),
            ...context.talents.map((talent, index) => ({
                id: `talent-${index}`,
                label: talent.label,
                value: talent,
                displayMode: 'button' as const,
            })),
        ],
        { sourceId: context.sourceId, targetType: 'generic', autoResolveIfSingle: false },
    ),
    onResolve: ({ context, state, value, random, timestamp }) => {
        const choice = value as TalentFollowupChoice & { skip?: boolean };
        if (choice.skip || !choice.cardUid) return { events: [] };
        const executor = resolveAbility(choice.defId, 'talent');
        if (!executor) return { events: [] };

        if (choice.kind === 'minion') {
            const minion = state.core.bases[choice.baseIndex]?.minions.find(candidate =>
                candidate.uid === choice.cardUid
                && candidate.defId === choice.defId
                && candidate.controller === context.playerId);
            if (!minion || minion.talentUsed || !hasMinionTalent(minion.defId)) return { events: [] };
            const resolved = executor({
                state: state.core,
                matchState: state,
                playerId: context.playerId,
                cardUid: minion.uid,
                defId: minion.defId,
                baseIndex: choice.baseIndex,
                random,
                now: timestamp,
            });
            return {
                events: [talentUsedEvent(context.playerId, choice, timestamp), ...resolved.events],
                matchState: resolved.matchState ?? state,
            };
        }

        const host = state.core.bases[choice.baseIndex]?.minions.find(minion =>
            minion.uid === choice.hostMinionUid
            && minion.attachedActions.some(action => action.uid === choice.cardUid));
        const action = host?.attachedActions.find(candidate =>
            candidate.uid === choice.cardUid
            && candidate.defId === choice.defId);
        if (!action || action.talentUsed || getActionControllerId(action) !== context.playerId || !hasActionTalent(action.defId)) {
            return { events: [] };
        }
        const resolved = executor({
            state: state.core,
            matchState: state,
            playerId: context.playerId,
            cardUid: action.uid,
            defId: action.defId,
            baseIndex: choice.baseIndex,
            random,
            now: timestamp,
        });
        return {
            events: [talentUsedEvent(context.playerId, choice, timestamp), ...resolved.events],
            matchState: resolved.matchState ?? state,
        };
    },
});

const actionTransferSourcePromptProgram = createPromptProgram<ActionTransferSourceContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'half_the_battle_action_transfer_source',
    interactionSourceIds: [
        'rulers_cosmos_powerful_sword_transfer_source',
        'rulers_cosmos_toxic_waste_transfer_source',
        'rulers_cosmos_mystic_transference_source',
        'rulers_cosmos_dolts_halfwits_fools_morons_transfer_source',
    ],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.title,
        [
            ...(context.optional ? [createSkipOption()] : []),
            ...context.actions.map((action, index) => ({
                id: `action-${index}`,
                label: action.label,
                value: action,
                displayMode: 'card' as const,
            })),
        ],
        { sourceId: context.sourceId, targetType: 'generic', autoResolveIfSingle: false },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const action = value as AttachedActionTransferChoice;
        if ((value as { skip?: boolean } | undefined)?.skip) return { events: [] };
        if (!action?.cardUid) return { events: [] };
        const destinations = (() => {
            if (context.destinationMode === 'between-anchor-and-other' && context.anchorMinionUid && context.anchorBaseIndex !== undefined) {
                if (action.sourceMinionUid === context.anchorMinionUid) {
                    return collectMinionTargets(state.core, minion =>
                        minion.controller === context.playerId
                        && minion.uid !== context.anchorMinionUid);
                }
                const anchor = state.core.bases[context.anchorBaseIndex]?.minions.find(minion => minion.uid === context.anchorMinionUid);
                return anchor
                    ? [{ uid: anchor.uid, defId: anchor.defId, baseIndex: context.anchorBaseIndex, label: minionLabel(state.core, anchor, context.anchorBaseIndex) }]
                    : [];
            }
            return collectMinionTargets(state.core, minion =>
                minion.controller === context.playerId
                && minion.uid !== action.sourceMinionUid);
        })();
        if (destinations.length === 0) return { events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', timestamp)] };
        return {
            events: [],
            context: {
                matchState: state,
                playerId: context.playerId,
                now: timestamp,
                sourceId: `${context.sourceId.replace(/_source$/, '')}_destination`,
                title: '选择战术转移到哪个随从',
                action,
                destinations,
                sourceDefId: context.sourceDefId,
                sourceKind: context.sourceKind,
                ...(context.addCounterOnDestination ? { addCounterOnDestination: true } : {}),
                ...(context.followupTalentFeedbackSource ? { followupTalentFeedbackSource: context.followupTalentFeedbackSource } : {}),
                ...(context.repeatUntilSkip ? {
                    repeatUntilSkip: true,
                    remainingActions: context.actions.filter(candidate => candidate.cardUid !== action.cardUid),
                    repeatSourceId: context.sourceId,
                    repeatSourceTitle: context.title,
                    repeatDestinationMode: context.destinationMode,
                } : {}),
            } satisfies ActionTransferDestinationContext,
            nextProgram: actionTransferDestinationPromptProgram,
        };
    },
});

function runActionTransferPrompt(
    ctx: AbilityContext,
    context: Omit<ActionTransferSourceContext, keyof PromptContext>,
): AbilityResult {
    if (context.actions.length === 0 && context.optional) return { events: [] };
    if (context.actions.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return runtimeToAbilityResult(executeAbilityProgram(actionTransferSourcePromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        ...context,
    }));
}

const cardPromptProgram = createPromptProgram<CardPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'half_the_battle_card_prompt',
    interactionSourceIds: [
        'geckos_van_gogh',
        'geckos_breaking_news_pick',
        'gi_gerald_sawbones_minion',
        'gi_gerald_sawbones_action',
        'base_gi_geralds_base_bottom',
        'rulers_cosmos_myaaah',
    ],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.title,
        [
            ...(context.optional ? [createSkipOption()] : []),
            ...context.cards.map((card, index) => ({
                id: `card-${index}`,
                label: card.label,
                value: card,
                displayMode: 'card' as const,
            })),
        ],
        {
            sourceId: context.sourceId,
            targetType: 'generic',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ context, state, value, random, timestamp }) => {
        const choice = value as CardChoice & { zone?: string };
        if (choice.skip || !choice.cardUid || !choice.defId || !choice.ownerId) return { events: [] };
        if (context.kind === 'draw-from-deck') {
            return { events: [cardsDrawn(context.playerId, [choice.cardUid], timestamp)] };
        }
        if (context.kind === 'hand-to-bottom') {
            return {
                events: [{
                    type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
                    payload: {
                        cardUid: choice.cardUid,
                        defId: choice.defId,
                        ownerId: choice.ownerId,
                        reason: context.sourceId,
                        sourcePlayerId: context.playerId,
                    },
                    timestamp,
                } as CardToDeckBottomEvent],
            };
        }
        if (context.kind === 'return-action-to-hand') {
            const location = findLiveOngoingCardLocation(state.core, choice.cardUid);
            if (location) {
                return {
                    events: [
                        ...buildValidatedOngoingDetachEvents(state.core, {
                            cardUid: choice.cardUid,
                            reason: context.sourceId,
                            destination: 'hand',
                            sourcePlayerId: context.playerId,
                            sourceDefId: context.sourceId,
                            now: timestamp,
                        }),
                        grantContextualExtraAction({ playerId: context.playerId, now: timestamp, matchState: state.sys }, context.sourceId, {
                            restrictToCardUid: choice.cardUid,
                        }),
                    ],
                };
            }
            return {
                events: [
                    recoverCardsFromDiscard(context.playerId, [choice.cardUid], context.sourceId, timestamp),
                    grantContextualExtraAction({ playerId: context.playerId, now: timestamp, matchState: state.sys }, context.sourceId, {
                        restrictToCardUid: choice.cardUid,
                    }),
                ],
            };
        }
        const owner = state.core.players[choice.ownerId];
        const card = owner?.discard.find(candidate => candidate.uid === choice.cardUid);
        if (!owner || !card) return { events: [] };
        return {
            events: shuffleDiscardCardsIntoDeck(
                { state: state.core, random, now: timestamp },
                choice.ownerId,
                [card],
            ),
        };
    },
});

function runCardPrompt(ctx: AbilityContext, context: Omit<CardPromptContext, keyof PromptContext>): AbilityResult {
    if (context.cards.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return runtimeToAbilityResult(executeAbilityProgram(cardPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        ...context,
    }));
}

const discardPlayOnMinionTargetPromptProgram = createPromptProgram<DiscardPlayOnMinionTargetContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'half_the_battle_discard_play_on_minion_target',
    interactionSourceIds: ['rulers_cosmos_gal_woman_target'],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        `希瑞：选择随从，将${cardLabel(context.action.defId)}打在其上`,
        buildMinionTargetOptions(context.targets, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceDefId: context.action.defId,
            sourceKind: 'action',
            effectType: 'affect',
        }),
        { sourceId: context.sourceId, targetType: 'minion', autoResolveIfSingle: false },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const target = targetFromChoice(value as MinionChoice);
        if (!target) return { events: [] };
        const actionPlayed = buildActionPlayedEvent({
            playerId: context.playerId,
            cardUid: context.action.cardUid,
            defId: context.action.defId,
            ownerId: context.action.ownerId,
            isExtraAction: true,
            fromDiscard: true,
            discardPlaySourceId: 'rulers_cosmos_gal_woman',
            targetBaseIndex: target.baseIndex,
            targetMinionUid: target.uid,
            timestamp,
        });
        return {
            events: [
                actionPlayed,
                ...buildSemanticOngoingAttachEvents(state.core, {
                    cardUid: context.action.cardUid,
                    defId: context.action.defId,
                    ownerId: context.action.ownerId,
                    sourcePlayerId: context.playerId,
                    sourceKind: 'action',
                    targetBaseIndex: target.baseIndex,
                    targetMinionUid: target.uid,
                    metadata: {
                        halfTheBattleGalWomanTemporary: true,
                        halfTheBattleGalWomanControllerId: context.playerId,
                        sourceControllerId: context.playerId,
                    },
                    now: timestamp,
                }),
            ],
        };
    },
});

const discardPlayOnMinionActionPromptProgram = createPromptProgram<DiscardPlayOnMinionActionContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'half_the_battle_discard_play_on_minion_action',
    interactionSourceIds: ['rulers_cosmos_gal_woman'],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.title,
        [
            createSkipOption(),
            ...context.actions.map((action, index) => ({
                id: `discard-action-${index}`,
                label: action.label,
                value: action,
                displayMode: 'card' as const,
            })),
        ],
        { sourceId: context.sourceId, targetType: 'generic', autoResolveIfSingle: false },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const action = value as DiscardPlayOnMinionActionChoice & { skip?: boolean };
        if (action.skip || !action.cardUid) return { events: [] };
        const targets = playOnMinionActionTargets(state.core, context.playerId, action.defId);
        if (targets.length === 0) return { events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', timestamp)] };
        return {
            events: [],
            context: {
                matchState: state,
                playerId: context.playerId,
                now: timestamp,
                sourceId: 'rulers_cosmos_gal_woman_target',
                action,
                targets,
            } satisfies DiscardPlayOnMinionTargetContext,
            nextProgram: discardPlayOnMinionTargetPromptProgram,
        };
    },
});

function runDiscardPlayOnMinionActionPrompt(
    ctx: AbilityContext,
    sourceId: string,
    title: string,
    actions: DiscardPlayOnMinionActionChoice[],
): AbilityResult {
    if (actions.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return runtimeToAbilityResult(executeAbilityProgram(discardPlayOnMinionActionPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId,
        title,
        actions,
    }));
}

const minionSwapCandidatePromptProgram = createPromptProgram<MinionSwapCandidateContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'half_the_battle_minion_swap_candidate',
    interactionSourceIds: [
        'geckos_june_swap_candidate',
        'geckos_gecko_rap_swap_candidate',
        'rulers_cosmos_young_noble_swap_candidate',
    ],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.title,
        [
            createSkipOption(),
            ...context.candidates.map((card, index) => ({
                id: `swap-card-${index}`,
                label: card.label,
                value: card,
                displayMode: 'card' as const,
            })),
        ],
        { sourceId: context.sourceId, targetType: 'generic', autoResolveIfSingle: false },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as MinionSwapCandidateChoice & { skip?: boolean };
        if (choice.skip || !choice.cardUid) return { events: [] };
        const events: SmashUpEvent[] = [
            minionSwapEvent(context.playerId, context.source, choice, context.sourceId, timestamp, state.core),
        ];
        if (context.addCounterToIncoming) {
            events.push(addPowerCounter(choice.cardUid, context.source.baseIndex, 1, context.sourceId, timestamp));
        }
        if (context.grantExtraActionSourceId) {
            events.push(grantContextualExtraAction({ playerId: context.playerId, now: timestamp, matchState: state.sys }, context.grantExtraActionSourceId));
        }
        return { events };
    },
});

const minionSwapSourcePromptProgram = createPromptProgram<MinionSwapSourceContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'half_the_battle_minion_swap_source',
    interactionSourceIds: [
        'geckos_june_swap_source',
        'geckos_gecko_rap_swap_source',
        'rulers_cosmos_young_noble_swap_source',
    ],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.title,
        [
            createSkipOption(),
            ...buildMinionTargetOptions(context.sources, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceKind: 'nonAction',
                effectType: 'affect',
            }),
        ],
        { sourceId: context.sourceId, targetType: 'minion', autoResolveIfSingle: false },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const source = targetFromChoice(value as MinionChoice);
        if (!source || (value as { skip?: boolean } | undefined)?.skip) return { events: [] };
        const candidates = collectMinionSwapCandidates(state.core, context.playerId, source, context.mode, context.zones);
        if (candidates.length === 0) return { events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', timestamp)] };
        return {
            events: [],
            context: {
                matchState: state,
                playerId: context.playerId,
                now: timestamp,
                sourceId: context.sourceId.replace(/_source$/, '_candidate'),
                title: '选择要交换入场的随从',
                source,
                candidates,
                ...(context.addCounterToIncoming ? { addCounterToIncoming: true } : {}),
                ...(context.grantExtraActionSourceId ? { grantExtraActionSourceId: context.grantExtraActionSourceId } : {}),
            } satisfies MinionSwapCandidateContext,
            nextProgram: minionSwapCandidatePromptProgram,
        };
    },
});

function runMinionSwapPrompt(
    ctx: AbilityContext,
    context: Omit<MinionSwapSourceContext, keyof PromptContext>,
): AbilityResult {
    if (context.sources.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    if (context.sources.length === 1) {
        const candidates = collectMinionSwapCandidates(ctx.state, ctx.playerId, context.sources[0], context.mode, context.zones);
        if (candidates.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
        if (ctx.matchState) {
            return runtimeToAbilityResult(executeAbilityProgram(minionSwapSourcePromptProgram, {
                matchState: ctx.matchState,
                playerId: ctx.playerId,
                now: ctx.now,
                ...context,
            }));
        }
        return runtimeToAbilityResult(executeAbilityProgram(minionSwapCandidatePromptProgram, {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            sourceId: context.sourceId.replace(/_source$/, '_candidate'),
            title: '选择要交换入场的随从',
            source: context.sources[0],
            candidates,
            ...(context.addCounterToIncoming ? { addCounterToIncoming: true } : {}),
            ...(context.grantExtraActionSourceId ? { grantExtraActionSourceId: context.grantExtraActionSourceId } : {}),
        }));
    }
    return runtimeToAbilityResult(executeAbilityProgram(minionSwapSourcePromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        ...context,
    }));
}

const basePromptProgram = createPromptProgram<BasePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'half_the_battle_base_prompt',
    interactionSourceIds: ['gi_gerald_go_gerald', 'pearl_images_were_up_youre_down', 'rulers_cosmos_armor_of_battle'],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.title,
        buildBaseTargetOptions(context.bases, context.matchState.core),
        { sourceId: context.sourceId, targetType: 'base' },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as BaseChoice;
        if (choice.baseIndex === undefined) return { events: [] };
        if (context.kind === 'go-gerald') {
            const events = state.core.bases[choice.baseIndex]?.minions
                .filter(minion => minion.controller === context.playerId && minion.playedThisTurn)
                .map(minion => addTempPower(minion.uid, choice.baseIndex!, 2, 'gi_gerald_go_gerald', timestamp)) ?? [];
            return { events };
        }
        if (context.kind === 'armor-breakpoint') {
            const ownWithActions = state.core.bases[choice.baseIndex]?.minions
                .filter(minion => minion.controller === context.playerId && minion.attachedActions.length > 0).length ?? 0;
            return { events: ownWithActions > 0 ? [modifyBreakpoint(choice.baseIndex, ownWithActions * 2, context.sourceId, timestamp)] : [] };
        }
        if (context.kind === 'pearl-world-down') {
            return {
                events: [baseMetadata(choice.baseIndex, {
                    halfTheBattleWereUpYoureDown: {
                        sourcePlayerId: context.playerId,
                        expiresOnTurnNumber: nextPlayerTurnStartExpiration(state.core, context.playerId),
                        expiresOnPlayerId: context.playerId,
                    },
                }, context.sourceId, timestamp)],
            };
        }
        return { events: [] };
    },
});

const slimePoolTargetPromptProgram = createPromptProgram<SlimePoolTargetContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'base_slime_pool',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `base_slime_pool_${context.now}`,
        context.playerId,
        `粘液池：选择一个随从，将${cardLabel(context.defId)}打在其上`,
        buildMinionTargetOptions(context.targets, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceDefId: context.defId,
            sourceKind: 'action',
            effectType: 'affect',
        }),
        { sourceId: context.sourceId, targetType: 'minion', autoResolveIfSingle: false },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const target = targetFromChoice(value as MinionChoice);
        if (!target) return { events: [] };
        const actionPlayed = buildActionPlayedEvent({
            playerId: context.playerId,
            cardUid: context.cardUid,
            defId: context.defId,
            ownerId: context.ownerId,
            targetBaseIndex: target.baseIndex,
            targetMinionUid: target.uid,
            timestamp,
        });
        return {
            events: [
                actionPlayed,
                ...buildSemanticOngoingAttachEvents(state.core, {
                    cardUid: context.cardUid,
                    defId: context.defId,
                    ownerId: context.ownerId,
                    sourcePlayerId: context.playerId,
                    sourceKind: 'action',
                    targetBaseIndex: target.baseIndex,
                    targetMinionUid: target.uid,
                    now: timestamp,
                }),
            ],
        };
    },
});

const copyTalentPromptProgram = createPromptProgram<CopyTalentPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'rulers_cosmos_guy_man_copy_talent',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `rulers_cosmos_guy_man_copy_talent_${context.now}`,
        context.playerId,
        '希曼：选择要复制天赋的另一个己方随从',
        buildMinionTargetOptions(context.candidates, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceDefId: 'rulers_cosmos_guy_man',
            sourceKind: 'nonAction',
        }),
        { sourceId: context.sourceId, targetType: 'minion', autoResolveIfSingle: false, titleKey: 'ui.rulers_cosmos_guy_man_copy_talent_title' },
    ),
    onResolve: ({ context, state, value, random, timestamp }) => {
        const target = targetFromChoice(value as MinionChoice);
        if (!target || !hasCopyableMinionTalent(target.defId)) return { events: [] };
        const liveTarget = state.core.bases[target.baseIndex]?.minions.find(minion =>
            minion.uid === target.uid
            && minion.defId === target.defId
            && minion.controller === context.playerId);
        const source = state.core.bases[context.sourceBaseIndex]?.minions.find(minion =>
            minion.uid === context.sourceMinionUid
            && minion.defId === context.sourceMinionDefId
            && minion.controller === context.playerId);
        const executor = resolveAbility(target.defId, 'talent');
        if (!liveTarget || !source || !executor) return { events: [] };
        const copied = executor({
            state: state.core,
            matchState: state,
            playerId: context.playerId,
            cardUid: source.uid,
            defId: target.defId,
            baseIndex: context.sourceBaseIndex,
            random,
            now: timestamp,
        });
        return {
            events: copied.events,
            matchState: copied.matchState ?? state,
        };
    },
});

const fusionActionCopyPromptProgram = createPromptProgram<FusionActionCopyPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'half_the_battle_fusion_action_copy',
    interactionSourceIds: [
        'gi_gerald_shellback_copy_action',
        'gi_gerald_home_safety_special_copy',
    ],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.title,
        buildMinionTargetOptions(context.candidates, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceKind: 'action',
            effectType: 'affect',
        }),
        { sourceId: context.sourceId, targetType: 'minion', autoResolveIfSingle: false },
    ),
    onResolve: ({ context, state, value, random, timestamp }) => {
        const target = targetFromChoice(value as MinionChoice);
        if (!target || getCardDef(target.defId)?.type !== 'fusion') return { events: [] };
        const liveTarget = state.core.bases[target.baseIndex]?.minions.find(minion =>
            minion.uid === target.uid
            && minion.defId === target.defId
            && minion.controller === context.playerId);
        const executor = resolveAbility(target.defId, 'onPlay');
        if (!liveTarget || !executor) return { events: [] };
        const copied = executor({
            state: state.core,
            matchState: state,
            playerId: context.playerId,
            cardUid: context.sourceCardUid,
            defId: target.defId,
            baseIndex: target.baseIndex,
            ...(context.targetBaseIndex !== undefined ? { targetBaseIndex: context.targetBaseIndex } : {}),
            random,
            now: timestamp,
        });
        return {
            events: copied.events,
            matchState: copied.matchState ?? state,
        };
    },
});

function runFusionActionCopyPrompt(
    ctx: AbilityContext,
    sourceId: string,
    title: string,
    candidates: MinionTarget[],
): AbilityResult {
    if (candidates.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return runtimeToAbilityResult(executeAbilityProgram(fusionActionCopyPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId,
        title,
        sourceCardUid: ctx.cardUid,
        candidates,
        ...(ctx.targetBaseIndex !== undefined ? { targetBaseIndex: ctx.targetBaseIndex } : {}),
    }));
}

function runBasePrompt(ctx: AbilityContext, context: Omit<BasePromptContext, keyof PromptContext>): AbilityResult {
    if (context.bases.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return runtimeToAbilityResult(executeAbilityProgram(basePromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        ...context,
    }));
}

const buttonPromptProgram = createPromptProgram<ButtonPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'half_the_battle_button_prompt',
    interactionSourceIds: [
        'geckos_kandinsky_talent',
        'geckos_gecko_power',
        'geckos_masters_teachings_temp',
        'pearl_images_ruby',
        'gi_gerald_can_do_minion',
        'base_technoball',
        'base_concert_venue',
        'base_power_castle',
        'pearl_images_topaz',
        'pearl_images_pearl',
        'pearl_images_alls_right_with_the_world',
        'gi_gerald_viscount',
        'rulers_cosmos_magic_weapon',
        'rulers_cosmos_powerful_sword',
    ],
    buildInteraction: (context) => {
        const options = (() => {
            switch (context.kind) {
                case 'kandinsky-talent':
                    return [
                        createSkipOption(),
                        { id: 'temp', label: '本随从 +2 到回合结束', labelKey: 'ui.geckos_kandinsky_temp_option', value: { choice: 'temp' }, displayMode: 'button' as const },
                        { id: 'move', label: '移动另一个己方随从到这里', labelKey: 'ui.geckos_kandinsky_move_option', value: { choice: 'move' }, displayMode: 'button' as const },
                    ];
                case 'gecko-power-talent':
                    return [
                        createSkipOption(),
                        { id: 'move', label: '移动此随从', labelKey: 'ui.geckos_gecko_power_move_option', value: { choice: 'move' }, displayMode: 'button' as const },
                        { id: 'counter', label: '放置 +1 标记', labelKey: 'ui.geckos_gecko_power_counter_option', value: { choice: 'counter' }, displayMode: 'button' as const },
                        { id: 'temp', label: '本随从 +2 到回合结束', labelKey: 'ui.geckos_gecko_power_temp_option', value: { choice: 'temp' }, displayMode: 'button' as const },
                    ];
                case 'can-do-minion':
                    return [
                        createSkipOption(),
                        { id: 'minion', label: '额外打出战力≤2随从', labelKey: 'ui.gi_gerald_can_do_minion_option', value: { choice: 'minion' }, displayMode: 'button' as const },
                        { id: 'action', label: '额外打出一张战术', labelKey: 'ui.gi_gerald_can_do_action_option', value: { choice: 'action' }, displayMode: 'button' as const },
                    ];
                case 'topaz-trigger':
                case 'viscount-trigger':
                    return [
                        createSkipOption(),
                        { id: 'counter', label: '放置 +1 标记', labelKey: 'ui.half_the_battle_counter_option', value: { choice: 'counter' }, displayMode: 'button' as const },
                        { id: 'temp', label: '直到回合结束 +2 战力', labelKey: 'ui.half_the_battle_temp_power_option', value: { choice: 'temp' }, displayMode: 'button' as const },
                        { id: 'move', label: '移动到触发基地', labelKey: 'ui.half_the_battle_move_to_trigger_base_option', value: { choice: 'move' }, displayMode: 'button' as const },
                    ];
                case 'pearl-talent':
                    return [
                        createSkipOption(),
                        { id: 'draw', label: '抓牌库顶战力≤2随从', labelKey: 'ui.pearl_images_pearl_draw_option', value: { choice: 'draw' }, displayMode: 'button' as const },
                        { id: 'temp', label: '这里一个随从 +1', labelKey: 'ui.pearl_images_pearl_temp_option', value: { choice: 'temp' }, displayMode: 'button' as const },
                    ];
                case 'alls-right-talent':
                    return [
                        createSkipOption(),
                        { id: 'all', label: '这里所有随从 +1', labelKey: 'ui.pearl_images_alls_right_all_option', value: { choice: 'all' }, displayMode: 'button' as const },
                        { id: 'per-player', label: '按玩家选择 +2', labelKey: 'ui.pearl_images_alls_right_per_player_option', value: { choice: 'per-player' }, displayMode: 'button' as const },
                    ];
                case 'magic-weapon-talent':
                    return [
                        createSkipOption(),
                        { id: 'power', label: '按在场玩家数加战力', labelKey: 'ui.rulers_cosmos_magic_weapon_power_option', value: { choice: 'power' }, displayMode: 'button' as const },
                        { id: 'draw', label: '若仅一张战术则抓牌', labelKey: 'ui.rulers_cosmos_magic_weapon_draw_option', value: { choice: 'draw' }, displayMode: 'button' as const },
                    ];
                case 'powerful-sword-talent':
                    return [
                        createSkipOption(),
                        { id: 'protect', label: '直到下回合开始不受其他玩家卡牌影响', labelKey: 'ui.rulers_cosmos_powerful_sword_protect_option', value: { choice: 'protect' }, displayMode: 'button' as const },
                        { id: 'transfer', label: '转移此随从上的另一张战术', labelKey: 'ui.rulers_cosmos_powerful_sword_transfer_option', value: { choice: 'transfer' }, displayMode: 'button' as const },
                    ];
                default:
                    return [
                        createSkipOption(),
                        { id: 'apply', label: '执行效果', labelKey: 'ui.half_the_battle_apply_option', value: { choice: 'apply' }, displayMode: 'button' as const },
                    ];
            }
        })();
        return createAbilityRuntimeSimpleChoice(
            `${context.sourceId}_${context.now}`,
            context.playerId,
            context.title,
            options,
            { sourceId: context.sourceId, targetType: 'button', autoResolveIfSingle: false },
        );
    },
    onResolve: (args) => {
        const { context, state, value, timestamp } = args;
        const choice = value as ButtonChoice;
        if (choice.skip || !choice.choice) return { events: [] };
        const sourceTarget = context.sourceMinionUid && context.sourceBaseIndex !== undefined
            ? { uid: context.sourceMinionUid, defId: context.sourceMinionDefId ?? '', baseIndex: context.sourceBaseIndex }
            : undefined;
        if (context.kind === 'kandinsky-talent' && sourceTarget) {
            if (choice.choice === 'temp') return { events: [addTempPower(sourceTarget.uid, sourceTarget.baseIndex, 2, context.sourceId, timestamp)] };
            const candidates = collectMinionTargets(state.core, (minion, baseIndex) =>
                minion.controller === context.playerId
                && minion.uid !== sourceTarget.uid
                && baseIndex !== sourceTarget.baseIndex);
            if (candidates.length === 0) return { events: [] };
            return executeAbilityProgram(movePromptProgram, {
                matchState: state,
                playerId: context.playerId,
                now: timestamp,
                sourceId: context.sourceId,
                title: '康定斯基：选择要移动到这里的另一个己方随从',
                candidates,
                fixedDestinationBaseIndex: sourceTarget.baseIndex,
                sourcePlayerId: context.playerId,
                sourceDefId: 'geckos_kandinsky',
                sourceKind: 'nonAction',
                sourceControllerId: context.playerId,
                sourceBaseIndex: sourceTarget.baseIndex,
                optional: true,
            });
        }
        if (context.kind === 'gecko-power-talent' && sourceTarget) {
            if (choice.choice === 'counter') return { events: [addPowerCounter(sourceTarget.uid, sourceTarget.baseIndex, 1, context.sourceId, timestamp)] };
            if (choice.choice === 'temp') return { events: [addTempPower(sourceTarget.uid, sourceTarget.baseIndex, 2, context.sourceId, timestamp)] };
            return executeAbilityProgram(movePromptProgram, {
                matchState: state,
                playerId: context.playerId,
                now: timestamp,
                sourceId: `${context.sourceId}_move`,
                title: '壁虎力量：选择移动此随从到哪个基地',
                candidates: [sourceTarget],
                sourcePlayerId: context.playerId,
                sourceDefId: 'geckos_gecko_power',
                sourceKind: 'action',
                sourceControllerId: context.playerId,
                sourceBaseIndex: sourceTarget.baseIndex,
            });
        }
        if (context.kind === 'masters-teachings-temp' && sourceTarget && choice.choice === 'apply') {
            return { events: [addTempPower(sourceTarget.uid, sourceTarget.baseIndex, 2, context.sourceId, timestamp)] };
        }
        if (context.kind === 'ruby-apply' && context.sourceBaseIndex !== undefined && choice.choice === 'apply') {
            return {
                events: (state.core.bases[context.sourceBaseIndex]?.minions ?? [])
                    .map(minion => addTempPower(minion.uid, context.sourceBaseIndex!, 1, context.sourceId, timestamp)),
            };
        }
        if (context.kind === 'can-do-minion') {
            if (choice.choice === 'minion') {
                return { events: [grantContextualExtraMinion({ playerId: context.playerId, now: timestamp, matchState: state.sys }, context.sourceId, context.sourceBaseIndex, { powerMax: 2 })] };
            }
            return { events: [grantContextualExtraAction({ playerId: context.playerId, now: timestamp, matchState: state.sys }, context.sourceId)] };
        }
        if (context.kind === 'base-extra-action' && context.sourceBaseIndex !== undefined && context.baseDefId) {
            return {
                events: [
                    baseAbilityUsed(context.playerId, context.sourceBaseIndex, context.baseDefId, timestamp),
                    grantContextualExtraAction({ playerId: context.playerId, now: timestamp, matchState: state.sys }, context.sourceId),
                ],
            };
        }
        if (context.kind === 'base-counter-minion' && context.targetMinionUid && context.targetBaseIndex !== undefined && context.baseDefId) {
            return {
                events: [
                    baseAbilityUsed(context.playerId, context.targetBaseIndex, context.baseDefId, timestamp),
                    addPowerCounter(context.targetMinionUid, context.targetBaseIndex, 1, context.sourceId, timestamp),
                ],
            };
        }
        if (context.kind === 'topaz-trigger' && sourceTarget) {
            const events: SmashUpEvent[] = [];
            if (choice.choice === 'counter') {
                events.push(addPowerCounter(sourceTarget.uid, sourceTarget.baseIndex, 1, context.sourceId, timestamp));
            } else if (choice.choice === 'move' && context.targetBaseIndex !== undefined) {
                events.push(...moveEvents(state, sourceTarget, context.targetBaseIndex, context.sourceId, timestamp, {
                    sourcePlayerId: context.playerId,
                    sourceDefId: 'pearl_images_topaz',
                    sourceKind: 'nonAction',
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: sourceTarget.baseIndex,
                }));
            } else if (choice.choice === 'temp') {
                events.push(addTempPower(sourceTarget.uid, sourceTarget.baseIndex, 2, context.sourceId, timestamp));
            }
            events.push(minionMetadata(sourceTarget.uid, sourceTarget.baseIndex, { halfTheBattleTopazUsedTurn: state.core.turnNumber }, context.sourceId, timestamp));
            return { events };
        }
        if (context.kind === 'pearl-talent') {
            if (choice.choice === 'draw') {
                const top = state.core.players[context.playerId]?.deck[0];
                if (top && getPrintedPower(top.defId) <= 2 && (getCardDef(top.defId)?.type === 'minion' || getCardDef(top.defId)?.type === 'fusion')) {
                    return { events: [cardsDrawn(context.playerId, [top.uid], timestamp)] };
                }
                return { events: [] };
            }
            const targets = minionsAtBase(state.core, context.sourceBaseIndex ?? 0);
            if (targets.length === 0) return { events: [] };
            return executeAbilityProgram(powerPromptProgram, {
                matchState: state,
                playerId: context.playerId,
                now: timestamp,
                sourceId: 'pearl_images_pearl_temp',
                title: '珍珠：选择这里一个随从 +1 到回合结束',
                targets,
                amount: 1,
                mode: 'temp',
            });
        }
        if (context.kind === 'alls-right-talent' && context.sourceBaseIndex !== undefined) {
            const minions = state.core.bases[context.sourceBaseIndex]?.minions ?? [];
            if (choice.choice === 'all') {
                return {
                    events: minions.map(minion => addTempPower(minion.uid, context.sourceBaseIndex!, 1, context.sourceId, timestamp)),
                };
            }
            const byPlayer = new Map<PlayerId, MinionOnBase>();
            for (const minion of minions) {
                if (!byPlayer.has(minion.controller)) byPlayer.set(minion.controller, minion);
            }
            return {
                events: [...byPlayer.values()].map(minion => addTempPower(minion.uid, context.sourceBaseIndex!, 2, context.sourceId, timestamp)),
            };
        }
        if (context.kind === 'viscount-trigger' && sourceTarget) {
            const events = choice.choice === 'counter'
                ? [addPowerCounter(sourceTarget.uid, sourceTarget.baseIndex, 1, context.sourceId, timestamp)]
                : [addTempPower(sourceTarget.uid, sourceTarget.baseIndex, 2, context.sourceId, timestamp)];
            events.push(minionMetadata(sourceTarget.uid, sourceTarget.baseIndex, { halfTheBattleViscountUsedTurn: state.core.turnNumber }, context.sourceId, timestamp));
            return { events };
        }
        if (context.kind === 'magic-weapon-talent' && sourceTarget) {
            if (choice.choice === 'draw') {
                const host = state.core.bases[sourceTarget.baseIndex]?.minions.find(minion => minion.uid === sourceTarget.uid);
                if ((host?.attachedActions.length ?? 0) === 1) {
                    return { events: buildStandardDrawEventsFromRuntimeContext(args, context.playerId, 1) };
                }
                return { events: [] };
            }
            const playerCount = new Set(state.core.bases[sourceTarget.baseIndex]?.minions.map(minion => minion.controller)).size;
            return {
                events: playerCount > 0
                    ? [addPermanentPower(sourceTarget.uid, sourceTarget.baseIndex, playerCount, context.sourceId, timestamp, { expiresOnTurnNumber: state.core.turnNumber + 1 })]
                    : [],
            };
        }
        if (context.kind === 'powerful-sword-talent' && sourceTarget) {
            if (choice.choice === 'protect') {
                return {
                    events: [minionMetadata(sourceTarget.uid, sourceTarget.baseIndex, {
                        tempProtectAffectUntilTurnNumber: state.core.turnNumber + 1,
                        tempProtectSourcePlayerId: context.playerId,
                    }, 'rulers_cosmos_powerful_sword', timestamp)],
                };
            }
            const host = state.core.bases[sourceTarget.baseIndex]?.minions.find(minion => minion.uid === sourceTarget.uid);
            const actions = (host?.attachedActions ?? [])
                .filter(action => action.uid !== context.sourceCardUid)
                .map(action => attachedActionTransferChoice(state.core, action, host!, sourceTarget.baseIndex));
            if (actions.length === 0) return { events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', timestamp)] };
            return executeAbilityProgram(actionTransferSourcePromptProgram, {
                matchState: state,
                playerId: context.playerId,
                now: timestamp,
                sourceId: 'rulers_cosmos_powerful_sword_transfer_source',
                title: '魔法之剑：选择要转移的另一张战术',
                actions,
                sourceDefId: 'rulers_cosmos_powerful_sword',
                sourceKind: 'action',
                destinationMode: 'other-own-minion',
            });
        }
        return { events: [] };
    },
});

function runButtonPrompt(ctx: AbilityContext, context: Omit<ButtonPromptContext, keyof PromptContext>): AbilityResult {
    return runtimeToAbilityResult(executeAbilityProgram(buttonPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        ...context,
    }));
}

function geckosHokusai(ctx: AbilityContext): AbilityResult {
    return runPowerPrompt(ctx, 'geckos_hokusai', '北斋：你可以在你的一个随从上放置 +1 标记', ownMinionTargets(ctx.state, ctx.playerId), 1, 'counter', { optional: true });
}

function geckosHokusaiTalent(ctx: AbilityContext): AbilityResult {
    if (!hasPlayedAtLeastTwoActions(ctx)) return { events: [] };
    return runPowerPrompt(
        ctx,
        'geckos_hokusai_talent',
        '北斋：每个基地可各选择一个随从放置 +1 标记',
        allMinionTargets(ctx.state),
        1,
        'counter',
        { maxSelections: ctx.state.bases.length, uniqueBase: true },
    );
}

function geckosKandinsky(ctx: AbilityContext): AbilityResult {
    return { events: [addTempPower(ctx.cardUid, ctx.baseIndex, 1, 'geckos_kandinsky', ctx.now, sourceMeta(ctx))] };
}

function geckosKandinskyTalent(ctx: AbilityContext): AbilityResult {
    if (!hasPlayedAtLeastTwoActions(ctx)) return { events: [] };
    return runButtonPrompt(ctx, {
        sourceId: 'geckos_kandinsky_talent',
        title: '康定斯基：选择天赋效果',
        kind: 'kandinsky-talent',
        sourceMinionUid: ctx.cardUid,
        sourceMinionDefId: ctx.defId,
        sourceBaseIndex: ctx.baseIndex,
    });
}

function geckosMonet(ctx: AbilityContext): AbilityResult {
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now) };
}

function geckosVanGogh(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const cards = player.discard
        .filter(card => card.uid !== ctx.cardUid && isStandardAction(card.defId))
        .map(card => ({ cardUid: card.uid, defId: card.defId, ownerId: card.owner, label: cardLabel(card.defId), zone: 'discard' as const }));
    return runCardPrompt(ctx, {
        sourceId: 'geckos_van_gogh',
        title: '梵高：你可以选择一张弃牌堆标准战术洗入牌库',
        cards,
        kind: 'discard-to-deck',
        optional: true,
    });
}

function geckosJune(ctx: AbilityContext): AbilityResult {
    const sources = collectMinionTargets(ctx.state, minion =>
        minion.controller === ctx.playerId && getPrintedPower(minion.defId) === 4);
    if (sources.length > 0) {
        return runMinionSwapPrompt(ctx, {
            sourceId: 'geckos_june_swap_source',
            title: '爱普莉尔·奥尼尔：选择印刷战力 4 的随从交换',
            sources,
            mode: 'printed-four-different',
            zones: ['hand', 'deck'],
        });
    }
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now) };
}

function geckosBreakingNews(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const topCards = player.deck.slice(0, 4);
    const events: SmashUpEvent[] = [
        inspectDeck(ctx.playerId, ctx.playerId, Math.min(4, player.deck.length), 'geckos_breaking_news', ctx.now),
        revealDeckTop(ctx.playerId, ctx.playerId, topCards.map(card => ({ uid: card.uid, defId: card.defId })), topCards.length, 'geckos_breaking_news', ctx.now, ctx.playerId),
    ];
    const extra = isFirstActionPlayedThisTurn(ctx)
        ? [grantContextualExtraAction(ctx, 'geckos_breaking_news')]
        : [];
    if (topCards.length === 0) return { events: extra };
    if (topCards.length === 1) return { events: [...events, cardsDrawn(ctx.playerId, [topCards[0].uid], ctx.now), ...extra] };
    const prompt = executeAbilityProgram(cardPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'geckos_breaking_news_pick',
        title: '爆炸新闻：选择抓取的牌',
        cards: topCards.map(card => ({ cardUid: card.uid, defId: card.defId, ownerId: card.owner, label: cardLabel(card.defId), zone: 'deck' as const })),
        kind: 'draw-from-deck',
    });
    return runtimeToAbilityResult({
        events: [...events, ...extra],
        matchState: prompt.matchState,
    });
}

function geckosFlipKick(ctx: AbilityContext): AbilityResult {
    const count = isFirstActionPlayedThisTurn(ctx) ? 1 : 3;
    const events = buildStandardDrawEvents(ctx.state, ctx.playerId, count, ctx.random, ctx.now);
    if (isFirstActionPlayedThisTurn(ctx)) events.push(grantContextualExtraAction(ctx, 'geckos_flip_kick'));
    return { events };
}

function geckosGeckoBlimp(ctx: AbilityContext): AbilityResult {
    const first = isFirstActionPlayedThisTurn(ctx);
    const candidates = first
        ? collectMinionTargets(ctx.state, minion => minion.controller === ctx.playerId)
        : allMinionTargets(ctx.state);
    const result = runMovePrompt(ctx, 'geckos_gecko_blimp', first ? '壁虎飞艇：移动你的一个随从' : '壁虎飞艇：移动任意一个随从', candidates, {
        optional: false,
        sourceDefId: ctx.defId,
        sourceKind: 'action',
    });
    if (!first) return result;
    return {
        events: [grantContextualExtraAction(ctx, 'geckos_gecko_blimp'), ...result.events],
        ...(result.matchState ? { matchState: result.matchState } : {}),
    };
}

function geckosGeckoPowerTalent(ctx: AbilityContext): AbilityResult {
    const host = findAttachedHost(ctx.state, ctx.cardUid);
    if (!host || (ctx.state.players[ctx.playerId]?.actionsPlayed ?? 0) < 2) return { events: [] };
    return runButtonPrompt(ctx, {
        sourceId: 'geckos_gecko_power',
        title: '壁虎力量：选择天赋效果',
        kind: 'gecko-power-talent',
        sourceMinionUid: host.host.uid,
        sourceMinionDefId: host.host.defId,
        sourceBaseIndex: host.baseIndex,
    });
}

function geckosGeckoRap(ctx: AbilityContext): AbilityResult {
    const first = isFirstActionPlayedThisTurn(ctx);
    const sources = ownMinionTargets(ctx.state, ctx.playerId);
    if (sources.length === 0) {
        return { events: first ? [grantContextualExtraAction(ctx, 'geckos_gecko_rap')] : [] };
    }
    return runMinionSwapPrompt(ctx, {
        sourceId: 'geckos_gecko_rap_swap_source',
        title: '壁虎说唱：选择要交换的己方随从',
        sources,
        mode: 'equal-or-less-different',
        zones: ['hand', 'deck', 'discard'],
        ...(first ? { grantExtraActionSourceId: 'geckos_gecko_rap' } : { addCounterToIncoming: true }),
    });
}

function geckosLasagnaParty(ctx: AbilityContext): AbilityResult {
    const events = [grantContextualExtraMinion(ctx, 'geckos_lasagna_party', ctx.targetBaseIndex, { powerMax: 2 })];
    if (isFirstActionPlayedThisTurn(ctx)) {
        events.push(grantContextualExtraAction(ctx, 'geckos_lasagna_party'));
        return { events };
    }
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const targets = minionsAtBase(ctx.state, baseIndex);
    const prompt = runPowerPrompt(ctx, 'geckos_lasagna_party', '千层饼派对：选择该基地一个随从放置 2 枚 +1 标记', targets, 2, 'counter', { optional: true });
    return {
        events: [...events, ...prompt.events],
        ...(prompt.matchState ? { matchState: prompt.matchState } : {}),
    };
}

function geckosNowYouKnowBullying(ctx: AbilityContext): AbilityResult {
    if (ctx.targetBaseIndex !== undefined) {
        const targets = collectMinionTargets(ctx.state, (minion, baseIndex) => minion.controller === ctx.playerId && baseIndex === ctx.targetBaseIndex);
        return runMinionEffectPrompt(ctx, 'geckos_now_you_know_bullying_special', '现在你知道：校园暴力：选择计分基地你的一个随从返回手牌', targets, 'return-to-hand', {
            sourceKind: 'action',
        });
    }
    return runMovePrompt(ctx, 'geckos_now_you_know_bullying', '现在你知道：校园暴力：移动你的一个随从', ownMinionTargets(ctx.state, ctx.playerId), {
        sourceKind: 'action',
    });
}

const mastersPromptProgram = createPromptProgram<PowerPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'geckos_masters_teachings',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `geckos_masters_teachings_${context.now}`,
        context.playerId,
        context.title,
        buildMinionTargetOptions(context.targets, { state: context.matchState.core, sourcePlayerId: context.playerId, sourceKind: 'action', effectType: 'buff' }),
        { sourceId: 'geckos_masters_teachings', targetType: 'minion' },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as MinionChoice;
        const target = targetFromChoice(choice);
        if (!target) return { events: [] };
        const events: SmashUpEvent[] = [addPowerCounter(target.uid, target.baseIndex, 2, 'geckos_masters_teachings', timestamp)];
        if ((state.core.players[context.playerId]?.actionsPlayed ?? 0) <= 1) {
            events.push(grantContextualExtraAction({ playerId: context.playerId, now: timestamp, matchState: state.sys }, 'geckos_masters_teachings'));
            return { events };
        }
        return {
            events,
            context: {
                matchState: state,
                playerId: context.playerId,
                now: timestamp,
                sourceId: 'geckos_masters_teachings_temp',
                title: '大师的教学：是否使该随从直到回合结束 +2？',
                kind: 'masters-teachings-temp',
                sourceMinionUid: target.uid,
                sourceMinionDefId: target.defId,
                sourceBaseIndex: target.baseIndex,
            } satisfies ButtonPromptContext,
            nextProgram: buttonPromptProgram,
        };
    },
});

function geckosMastersTeachings(ctx: AbilityContext): AbilityResult {
    const targets = ownMinionTargets(ctx.state, ctx.playerId);
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return runtimeToAbilityResult(executeAbilityProgram(mastersPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'geckos_masters_teachings',
        title: '大师的教学：选择你的一个随从放置 2 枚 +1 标记',
        targets,
        amount: 2,
        mode: 'counter',
    }));
}

function geckosKcSmith(ctx: AbilityContext): AbilityResult {
    return { events: [grantContextualExtraAction(ctx, 'geckos_kc_smith')] };
}

function giGeraldIsMinionFace(ctx: AbilityContext): boolean {
    return !!findSourceMinion(ctx);
}

function giGeraldGoGerald(ctx: AbilityContext): AbilityResult {
    return runBasePrompt(ctx, {
        sourceId: 'gi_gerald_go_gerald',
        title: '出发，杰拉尔德！：选择一个基地',
        bases: collectBaseTargets(ctx.state),
        kind: 'go-gerald',
    });
}

function giGeraldMowat(ctx: AbilityContext): AbilityResult {
    if (giGeraldIsMinionFace(ctx)) {
        const targets = collectMinionTargets(ctx.state, minion => minion.uid !== ctx.cardUid);
        return runPowerPrompt(ctx, 'gi_gerald_mowat_minion', '卡车式火炮：你可以选择另一个随从 +1 到回合结束', targets, 1, 'temp', { optional: true });
    }
    return runPowerPrompt(ctx, 'gi_gerald_mowat_action', '卡车式火炮：选择一个随从 +3 到回合结束', allMinionTargets(ctx.state), 3, 'temp');
}

function giGeraldObstruction(ctx: AbilityContext): AbilityResult {
    if (giGeraldIsMinionFace(ctx)) {
        return {
            events: (ctx.state.bases[ctx.baseIndex]?.minions ?? [])
                .filter(minion => minion.controller === ctx.playerId)
                .map(minion => addTempPower(minion.uid, ctx.baseIndex, 1, 'gi_gerald_obstruction', ctx.now)),
        };
    }
    const targets = collectMinionTargets(ctx.state, (minion, baseIndex) => getMinionPower(ctx.state, minion, baseIndex) <= 3);
    return runMinionEffectPrompt(ctx, 'gi_gerald_obstruction_action', '路霸：选择战力≤3的随从置于拥有者牌库底', targets, 'deck-bottom', {
        sourceKind: 'action',
    });
}

function giGeraldSawbones(ctx: AbilityContext): AbilityResult {
    const wantType = giGeraldIsMinionFace(ctx) ? 'action' : 'minion';
    const cards = ctx.state.players[ctx.playerId].discard
        .filter(card => card.type === wantType || (wantType === 'minion' && getCardDef(card.defId)?.type === 'fusion'))
        .map(card => ({ cardUid: card.uid, defId: card.defId, ownerId: card.owner, label: cardLabel(card.defId), zone: 'discard' as const }));
    return runCardPrompt(ctx, {
        sourceId: wantType === 'action' ? 'gi_gerald_sawbones_minion' : 'gi_gerald_sawbones_action',
        title: wantType === 'action' ? '外科医生：选择弃牌堆一张战术洗入牌库' : '外科医生：选择弃牌堆一个随从洗入牌库',
        cards,
        kind: 'discard-to-deck',
    });
}

function giGeraldSkiLift(ctx: AbilityContext): AbilityResult {
    if (giGeraldIsMinionFace(ctx)) {
        const targets = collectMinionTargets(ctx.state, (minion, baseIndex) =>
            minion.controller === ctx.playerId && minion.uid !== ctx.cardUid && baseIndex !== ctx.baseIndex);
        return runMovePrompt(ctx, 'gi_gerald_ski_lift_minion', '滑雪缆车：你可以将你的一个随从从其他基地移动到这里', targets, {
            fixedDestinationBaseIndex: ctx.baseIndex,
            optional: true,
            sourceKind: 'nonAction',
        });
    }
    return runMovePrompt(ctx, 'gi_gerald_ski_lift_action', '滑雪缆车：移动一个随从', allMinionTargets(ctx.state), {
        sourceKind: 'action',
    });
}

function giGeraldCanDo(ctx: AbilityContext): AbilityResult {
    if (giGeraldIsMinionFace(ctx)) {
        return runButtonPrompt(ctx, {
            sourceId: 'gi_gerald_can_do_minion',
            title: '偏激者：选择额外出牌',
            kind: 'can-do-minion',
            sourceBaseIndex: ctx.baseIndex,
        });
    }
    return {
        events: [
            grantContextualExtraMinion(ctx, 'gi_gerald_can_do', undefined, { powerMax: 2 }),
            grantContextualExtraAction(ctx, 'gi_gerald_can_do'),
        ],
    };
}

function giGeraldMabelLean(ctx: AbilityContext): AbilityResult {
    if (giGeraldIsMinionFace(ctx)) {
        const ownHere = ctx.state.bases[ctx.baseIndex]?.minions.filter(minion => minion.controller === ctx.playerId) ?? [];
        if (ownHere.length !== 1 || ownHere[0].uid !== ctx.cardUid) return { events: [] };
        return runPowerPrompt(ctx, 'gi_gerald_mabel_lean', '封面女郎：你可以在其上放置 +1 标记', [{ uid: ctx.cardUid, defId: ctx.defId, baseIndex: ctx.baseIndex, label: cardLabel(ctx.defId) }], 1, 'counter', { optional: true });
    }
    return { events: [grantContextualExtraMinion(ctx, 'gi_gerald_mabel_lean', undefined, { powerMax: 2 })] };
}

function giGeraldShellback(ctx: AbilityContext): AbilityResult {
    if (giGeraldIsMinionFace(ctx)) {
        const targets = collectMinionTargets(ctx.state, minion =>
            minion.controller === ctx.playerId
            && minion.uid !== ctx.cardUid
            && minion.defId !== 'gi_gerald_shellback'
            && getCardDef(minion.defId)?.type === 'fusion');
        return runMinionEffectPrompt(ctx, 'gi_gerald_shellback_minion', '老水手：选择另一个非老水手融合牌返回手牌', targets, 'return-to-hand', {
            sourceKind: 'nonAction',
        });
    }
    const targets = collectMinionTargets(ctx.state, minion =>
        minion.controller === ctx.playerId
        && minion.defId !== 'gi_gerald_shellback'
        && getCardDef(minion.defId)?.type === 'fusion'
        && !!resolveAbility(minion.defId, 'onPlay'));
    return runFusionActionCopyPrompt(ctx, 'gi_gerald_shellback_copy_action', '老水手：选择你的一个融合牌，复制其战术能力', targets);
}

function giGeraldDiceNinja(ctx: AbilityContext): AbilityResult {
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, giGeraldIsMinionFace(ctx) ? 1 : 2, ctx.random, ctx.now) };
}

function giGeraldRosie(ctx: AbilityContext): AbilityResult {
    if (giGeraldIsMinionFace(ctx)) {
        const targets = collectMinionTargets(ctx.state, (minion, baseIndex) =>
            baseIndex === ctx.baseIndex && minion.uid !== ctx.cardUid);
        return runPowerPrompt(ctx, 'gi_gerald_rosie_minion', '罗西：你可以在这里另一个随从上放置 +1 标记', targets, 1, 'counter', { optional: true });
    }
    const targets = ownMinionTargets(ctx.state, ctx.playerId);
    return runPowerPrompt(ctx, 'gi_gerald_rosie_action', '罗西：选择至多两个你的随从各放置 +1 标记', targets, 1, 'counter', { maxSelections: 2 });
}

function giGeraldNowYouKnowHomeSafety(ctx: AbilityContext): AbilityResult {
    if (ctx.targetBaseIndex !== undefined) {
        const targets = collectMinionTargets(ctx.state, (minion, baseIndex) =>
            baseIndex === ctx.targetBaseIndex
            && minion.controller === ctx.playerId
            && minion.defId !== 'gi_gerald_shellback'
            && getCardDef(minion.defId)?.type === 'fusion'
            && !!resolveAbility(minion.defId, 'onPlay'));
        return runFusionActionCopyPrompt(ctx, 'gi_gerald_home_safety_special_copy', '现在你知道：家庭安全：选择计分基地你的融合牌复制其战术能力', targets);
    }
    return { events: [grantContextualExtraMinion(ctx, 'gi_gerald_now_you_know_home_safety', undefined, { powerMax: 2 })] };
}

function rulersFrogga(ctx: AbilityContext): AbilityResult {
    const card = ctx.state.players[ctx.playerId].deck.find(candidate => isPlayOnMinionAction(candidate.defId));
    if (!card) return { events: [] };
    return { events: [inspectDeck(ctx.playerId, ctx.playerId, ctx.state.players[ctx.playerId].deck.indexOf(card) + 1, 'rulers_cosmos_frogga', ctx.now), cardsDrawn(ctx.playerId, [card.uid], ctx.now)] };
}

function rulersAndkoTalent(ctx: AbilityContext): AbilityResult {
    const targets = collectMinionTargets(ctx.state, minion => minion.attachedActions.length === 0);
    return runMinionEffectPrompt(ctx, 'rulers_cosmos_andko', '奥克：选择没有战术的随从，可额外在其上打出一张战术', targets, 'grant-extra-action', {
        sourceKind: 'nonAction',
    });
}

function rulersManWithArmsTalent(ctx: AbilityContext): AbilityResult {
    const source = findSourceMinion(ctx);
    if (!source || source.minion.attachedActions.length === 0) return { events: [] };
    return { events: [addPermanentPower(source.minion.uid, source.baseIndex, 2, 'rulers_cosmos_man_with_arms', ctx.now, { expiresOnTurnNumber: ctx.state.turnNumber + 1 })] };
}

function rulersMyaaah(ctx: AbilityContext): AbilityResult {
    const attached = ctx.state.bases.flatMap((base, baseIndex) =>
        base.minions
            .filter(minion => minion.controller === ctx.playerId)
            .flatMap(minion => minion.attachedActions
                .filter(action => isPlayOnMinionAction(action.defId))
                .map(action => ({
                    cardUid: action.uid,
                    defId: action.defId,
                    ownerId: action.ownerId,
                    label: `${cardLabel(action.defId)} @ ${minionLabel(ctx.state, minion, baseIndex)}`,
                    zone: 'attached' as const,
                }))));
    const fromDiscard = ctx.state.players[ctx.playerId].discard
        .filter(card => isPlayOnMinionAction(card.defId))
        .map(card => ({ cardUid: card.uid, defId: card.defId, ownerId: card.owner, label: cardLabel(card.defId), zone: 'discard' as const }));
    return runCardPrompt(ctx, {
        sourceId: 'rulers_cosmos_myaaah',
        title: '玛雅!：选择一张打在随从上的战术返回手牌并额外打出',
        cards: [...attached, ...fromDiscard],
        kind: 'return-action-to-hand',
    });
}

function rulersToxicWaste(ctx: AbilityContext): AbilityResult {
    if (ctx.targetBaseIndex !== undefined) {
        return runActionTransferPrompt(ctx, {
            sourceId: 'rulers_cosmos_toxic_waste_transfer_source',
            title: '现在你知道：有毒废弃物：选择要转移的战术',
            actions: ownMinionAttachedActions(ctx.state, ctx.playerId),
            sourceDefId: 'rulers_cosmos_now_you_know_toxic_waste',
            sourceKind: 'action',
            destinationMode: 'other-own-minion',
            followupTalentFeedbackSource: 'rulers_cosmos_toxic_waste_special_talent_followup',
        });
    }
    const card = ctx.state.players[ctx.playerId].deck.find(candidate => isPlayOnMinionAction(candidate.defId));
    return card ? { events: [cardsDrawn(ctx.playerId, [card.uid], ctx.now)] } : { events: [] };
}

function rulersMysticTransferenceTalent(ctx: AbilityContext): AbilityResult {
    const host = findAttachedHost(ctx.state, ctx.cardUid);
    if (!host) return { events: [] };
    const actions = ownMinionAttachedActions(ctx.state, ctx.playerId, { ownActionsOnly: true });
    return runActionTransferPrompt(ctx, {
        sourceId: 'rulers_cosmos_mystic_transference_source',
        title: '神秘转移：选择要在此随从与另一个己方随从之间转移的战术',
        actions,
        sourceDefId: 'rulers_cosmos_mystic_transference',
        sourceKind: 'action',
        destinationMode: 'between-anchor-and-other',
        anchorMinionUid: host.host.uid,
        anchorBaseIndex: host.baseIndex,
    });
}

function rulersFearlessFriendTalent(ctx: AbilityContext): AbilityResult {
    const host = findAttachedHost(ctx.state, ctx.cardUid);
    if (!host) return { events: [] };
    return runMovePrompt(ctx, 'rulers_cosmos_fearless_friend', '无畏的伙伴：移动此随从', [{ uid: host.host.uid, defId: host.host.defId, baseIndex: host.baseIndex, label: minionLabel(ctx.state, host.host, host.baseIndex) }], {
        sourceKind: 'action',
        sourceDefId: 'rulers_cosmos_fearless_friend',
        sourceBaseIndex: host.baseIndex,
    });
}

function rulersMagicWeaponTalent(ctx: AbilityContext): AbilityResult {
    const host = findAttachedHost(ctx.state, ctx.cardUid);
    if (!host) return { events: [] };
    return runButtonPrompt(ctx, {
        sourceId: 'rulers_cosmos_magic_weapon',
        title: '魔法武器：选择天赋效果',
        kind: 'magic-weapon-talent',
        sourceMinionUid: host.host.uid,
        sourceMinionDefId: host.host.defId,
        sourceBaseIndex: host.baseIndex,
    });
}

function rulersSwordThatsPowerfulTalent(ctx: AbilityContext): AbilityResult {
    const host = findAttachedHost(ctx.state, ctx.cardUid);
    if (!host) return { events: [] };
    return { events: [addPowerCounter(host.host.uid, host.baseIndex, 1, 'rulers_cosmos_sword_thats_powerful', ctx.now)] };
}

function rulersArmorOfBattleTalent(ctx: AbilityContext): AbilityResult {
    const host = findAttachedHost(ctx.state, ctx.cardUid);
    if (!host) return { events: [] };
    return runBasePrompt(ctx, {
        sourceId: 'rulers_cosmos_armor_of_battle',
        title: '战斗盔甲：提高此基地爆破点',
        bases: [{ baseIndex: host.baseIndex, label: baseLabel(ctx.state, host.baseIndex) }],
        kind: 'armor-breakpoint',
    });
}

function rulersPowerfulSwordTalent(ctx: AbilityContext): AbilityResult {
    const host = findAttachedHost(ctx.state, ctx.cardUid);
    if (!host) return { events: [] };
    return runButtonPrompt(ctx, {
        sourceId: 'rulers_cosmos_powerful_sword',
        title: '魔法之剑：选择天赋效果',
        kind: 'powerful-sword-talent',
        sourceCardUid: ctx.cardUid,
        sourceMinionUid: host.host.uid,
        sourceMinionDefId: host.host.defId,
        sourceBaseIndex: host.baseIndex,
    });
}

function rulersGuyManTalent(ctx: AbilityContext): AbilityResult {
    const source = findSourceMinion(ctx);
    if (!source) return { events: [] };
    const candidates = collectMinionTargets(ctx.state, minion =>
        minion.controller === ctx.playerId
        && minion.uid !== source.minion.uid
        && hasCopyableMinionTalent(minion.defId));
    if (candidates.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return runtimeToAbilityResult(executeAbilityProgram(copyTalentPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'rulers_cosmos_guy_man_copy_talent',
        sourceMinionUid: source.minion.uid,
        sourceMinionDefId: source.minion.defId,
        sourceBaseIndex: source.baseIndex,
        candidates,
    }));
}

function rulersGalWomanTalent(ctx: AbilityContext): AbilityResult {
    const actions = collectPlayOnMinionActionsFromAllDiscards(ctx.state);
    return runDiscardPlayOnMinionActionPrompt(ctx, 'rulers_cosmos_gal_woman', '希瑞：选择任意玩家弃牌堆中打在随从上的战术', actions);
}

function rulersYoungNobleTalent(ctx: AbilityContext): AbilityResult {
    const source = findSourceMinion(ctx);
    if (!source || !hasSwordAttached(source.minion)) return { events: [] };
    return runMinionSwapPrompt(ctx, {
        sourceId: 'rulers_cosmos_young_noble_swap_source',
        title: '年轻的贵族：选择自身，与战力 5 或以上随从交换',
        sources: [{
            uid: source.minion.uid,
            defId: source.minion.defId,
            baseIndex: source.baseIndex,
            label: minionLabel(ctx.state, source.minion, source.baseIndex),
        }],
        mode: 'power-five-plus',
        zones: ['hand', 'deck', 'discard'],
    });
}

function pearlRuby(ctx: AbilityContext): AbilityResult {
    return runButtonPrompt(ctx, {
        sourceId: 'pearl_images_ruby',
        title: '红宝石：是否使这里所有随从 +1 到回合结束？',
        kind: 'ruby-apply',
        sourceBaseIndex: ctx.baseIndex,
    });
}

function pearlLoveUnitesUs(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (const playerId of ctx.state.turnOrder) {
        const player = ctx.state.players[playerId];
        if (!player) continue;
        const cards = player.discard.filter(card => {
            const def = getCardDef(card.defId);
            return (def?.type === 'minion' || def?.type === 'fusion') && getPrintedPower(card.defId) <= 2;
        });
        events.push(...shuffleDiscardCardsIntoDeck(ctx, playerId, cards));
    }
    return { events };
}

function pearlPearlTalent(ctx: AbilityContext): AbilityResult {
    return runButtonPrompt(ctx, {
        sourceId: 'pearl_images_pearl',
        title: '珍珠：选择天赋效果',
        kind: 'pearl-talent',
        sourceBaseIndex: ctx.baseIndex,
    });
}

const crystalFirstPromptProgram = createPromptProgram<CrystalFirstContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'pearl_images_crystal',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `pearl_images_crystal_${context.now}`,
        context.playerId,
        '水晶：选择另一位玩家的一个随从放置 +1 标记',
        buildMinionTargetOptions(context.candidates, { state: context.matchState.core, sourcePlayerId: context.playerId, sourceKind: 'nonAction', effectType: 'buff' }),
        { sourceId: 'pearl_images_crystal', targetType: 'minion', titleKey: 'ui.pearl_images_crystal_other_counter_title' },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const target = targetFromChoice(value as MinionChoice);
        if (!target) return { events: [] };
        const ownTargets = collectMinionTargets(state.core, (minion, baseIndex) => minion.controller === context.playerId && baseIndex === target.baseIndex);
        return {
            events: [addPowerCounter(target.uid, target.baseIndex, 1, 'pearl_images_crystal', timestamp)],
            context: {
                matchState: state,
                playerId: context.playerId,
                now: timestamp,
                targetBaseIndex: target.baseIndex,
                candidates: ownTargets,
            } satisfies CrystalSecondContext,
            nextProgram: crystalSecondPromptProgram,
        };
    },
});

const crystalSecondPromptProgram = createPromptProgram<CrystalSecondContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'pearl_images_crystal_own',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `pearl_images_crystal_own_${context.now}`,
        context.playerId,
        '水晶：选择同基地你的一个随从放置 +1 标记',
        buildMinionTargetOptions(context.candidates, { state: context.matchState.core, sourcePlayerId: context.playerId, sourceKind: 'nonAction', effectType: 'buff' }),
        { sourceId: 'pearl_images_crystal_own', targetType: 'minion', titleKey: 'ui.pearl_images_crystal_own_counter_title' },
    ),
    onResolve: ({ value, timestamp }) => {
        const target = targetFromChoice(value as MinionChoice);
        return target ? { events: [addPowerCounter(target.uid, target.baseIndex, 1, 'pearl_images_crystal', timestamp)] } : { events: [] };
    },
});

function pearlCrystalTalent(ctx: AbilityContext): AbilityResult {
    const candidates = collectMinionTargets(ctx.state, minion => minion.controller !== ctx.playerId);
    if (candidates.length === 0) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(crystalFirstPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        candidates,
        sourceMinionUid: ctx.cardUid,
        sourceBaseIndex: ctx.baseIndex,
    }));
}

function pearlDressingRoom(ctx: AbilityContext): AbilityResult {
    const players = ctx.state.turnOrder.filter(playerId => ctx.state.players[playerId]);
    const drawEvents = players.flatMap(playerId => buildStandardDrawEvents(ctx.state, playerId, 1, ctx.random, ctx.now));
    const selfBonus = buildStandardDrawEvents(ctx.state, ctx.playerId, players.length, ctx.random, ctx.now);
    return { events: [...drawEvents, ...selfBonus] };
}

function pearlAllsRightTalent(ctx: AbilityContext): AbilityResult {
    const location = findLiveOngoingCardLocation(ctx.state, ctx.cardUid);
    const baseIndex = location?.baseIndex ?? ctx.baseIndex;
    return runButtonPrompt(ctx, {
        sourceId: 'pearl_images_alls_right_with_the_world',
        title: '世界一切安好：选择天赋效果',
        kind: 'alls-right-talent',
        sourceBaseIndex: baseIndex,
    });
}

function jamMinionChoices(state: SmashUpCore, playerId: PlayerId): JamMinionContext['minions'] {
    const player = state.players[playerId];
    if (!player) return [];
    return player.hand
        .filter(card => isMinionLikeCard(card.defId))
        .map(card => ({ card, power: getPrintedPower(card.defId) }))
        .filter(({ power }) => power <= 2)
        .map(({ card, power }) => ({
            cardUid: card.uid,
            defId: card.defId,
            ownerId: card.owner,
            power,
            label: `${cardLabel(card.defId)}（战力 ${power}）`,
        }));
}

function jamRevealNoEligibleMinions(
    state: SmashUpCore,
    targetPlayerId: PlayerId,
    viewerPlayerId: PlayerId,
    now: number,
): SmashUpEvent[] {
    const player = state.players[targetPlayerId];
    if (!player || jamMinionChoices(state, targetPlayerId).length > 0) return [];
    return [
        revealHand(
            targetPlayerId,
            viewerPlayerId,
            player.hand.map(card => ({ uid: card.uid, defId: card.defId })),
            'pearl_images_jam_all_night_long',
            now,
            viewerPlayerId,
        ),
    ];
}

const jamRewardPromptProgram = createPromptProgram<JamRewardContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'pearl_images_jam_all_night_long_reward',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `pearl_images_jam_all_night_long_reward_${context.now}`,
        context.playerId,
        '玩乐一整夜：你可以抓一张牌，或在这里一个随从上放置 +1 标记',
        [
            createSkipOption(),
            { id: 'draw', label: '抓一张牌', labelKey: 'ui.pearl_images_jam_all_night_long_draw_option', value: { choice: 'draw' }, displayMode: 'button' as const },
            ...buildMinionTargetOptions(context.counterTargets, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceKind: 'action',
                effectType: 'buff',
            }).map((option, index) => ({
                ...option,
                id: `counter-${index}`,
                label: `放置 +1：${option.label}`,
            })),
        ],
        { sourceId: 'pearl_images_jam_all_night_long_reward', targetType: 'generic', autoResolveIfSingle: false, titleKey: 'ui.pearl_images_jam_all_night_long_reward_title' },
    ),
    onResolve: (args) => {
        const { context, value, timestamp } = args;
        const choice = value as (ButtonChoice & MinionChoice & { skip?: boolean });
        if (choice.skip) return { events: [] };
        if (choice.choice === 'draw') {
            return { events: buildStandardDrawEventsFromRuntimeContext(args, context.playerId, 1) };
        }
        const target = targetFromChoice(choice);
        return target ? { events: [addPowerCounter(target.uid, target.baseIndex, 1, 'pearl_images_jam_all_night_long', timestamp)] } : { events: [] };
    },
});

const jamMinionPromptProgram = createPromptProgram<JamMinionContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'pearl_images_jam_all_night_long_minion',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `pearl_images_jam_all_night_long_minion_${context.selectedPlayerId}_${context.now}`,
        context.selectedPlayerId,
        '玩乐一整夜：打出一个战力≤2的额外随从到这里',
        context.minions.map((minion, index) => ({
            id: `minion-${index}`,
            label: minion.label,
            value: minion,
            displayMode: 'card' as const,
        })),
        { sourceId: 'pearl_images_jam_all_night_long_minion', targetType: 'hand', autoResolveIfSingle: false, titleKey: 'ui.pearl_images_jam_all_night_long_minion_title' },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as JamMinionContext['minions'][number] | undefined;
        if (!choice?.cardUid) return { events: [] };
        const card = state.core.players[context.selectedPlayerId]?.hand.find(candidate =>
            candidate.uid === choice.cardUid
            && candidate.defId === choice.defId
            && isMinionLikeCard(candidate.defId)
            && getPrintedPower(candidate.defId) <= 2);
        if (!card) return { events: [] };
        const base = state.core.bases[context.sourceBaseIndex];
        if (!base) return { events: [] };
        const playedEvent: MinionPlayedEvent = {
            type: SU_EVENTS.MINION_PLAYED,
            payload: {
                playerId: context.selectedPlayerId,
                cardUid: card.uid,
                defId: card.defId,
                ownerId: card.owner,
                baseIndex: context.sourceBaseIndex,
                baseDefId: base.defId,
                power: getPrintedPower(card.defId),
                consumesNormalLimit: false,
            },
            timestamp,
        };
        const events: SmashUpEvent[] = [playedEvent];
        if (!context.selectedIsOtherPlayer) return { events };
        const counterTargets = [
            ...minionsAtBase(state.core, context.sourceBaseIndex),
            {
                uid: card.uid,
                defId: card.defId,
                baseIndex: context.sourceBaseIndex,
                label: `${cardLabel(card.defId)} @ ${baseLabel(state.core, context.sourceBaseIndex)}`,
            },
        ];
        return {
            events,
            context: {
                matchState: state,
                playerId: context.playerId,
                now: timestamp,
                sourceBaseIndex: context.sourceBaseIndex,
                counterTargets,
            } satisfies JamRewardContext,
            nextProgram: jamRewardPromptProgram,
        };
    },
});

const jamPlayerPromptProgram = createPromptProgram<JamPlayerContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'pearl_images_jam_all_night_long',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `pearl_images_jam_all_night_long_${context.now}`,
        context.playerId,
        '玩乐一整夜：选择一名玩家',
        context.players.map((player, index) => ({
            id: `player-${index}`,
            label: player.label,
            value: player,
            displayMode: 'button' as const,
        })),
        { sourceId: 'pearl_images_jam_all_night_long', targetType: 'player', autoResolveIfSingle: false, titleKey: 'ui.pearl_images_jam_all_night_long_player_title' },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as JamPlayerChoice | undefined;
        if (!choice?.playerId || !state.core.players[choice.playerId]) return { events: [] };
        const minions = jamMinionChoices(state.core, choice.playerId);
        if (minions.length === 0) {
            return { events: jamRevealNoEligibleMinions(state.core, choice.playerId, context.playerId, timestamp) };
        }
        return {
            events: [],
            context: {
                matchState: state,
                playerId: context.playerId,
                now: timestamp,
                sourceBaseIndex: context.sourceBaseIndex,
                selectedPlayerId: choice.playerId,
                selectedIsOtherPlayer: choice.playerId !== context.playerId,
                minions,
            } satisfies JamMinionContext,
            nextProgram: jamMinionPromptProgram,
        };
    },
});

function pearlJamAllNightTalent(ctx: AbilityContext): AbilityResult {
    const location = findLiveOngoingCardLocation(ctx.state, ctx.cardUid);
    const sourceBaseIndex = location?.baseIndex ?? ctx.baseIndex;
    const players = ctx.state.turnOrder
        .filter(playerId => ctx.state.players[playerId])
        .map(playerId => ({
            playerId,
            label: playerId === ctx.playerId ? `你（玩家 ${playerId}）` : `玩家 ${playerId}`,
        }));
    if (players.length === 0) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(jamPlayerPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceBaseIndex,
        players,
    }));
}

const bikeFirstPromptProgram = createPromptProgram<BikeFirstContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'pearl_images_now_you_know_bike_safety',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        '现在你知道：自行车安全：选择你的一个随从',
        buildMinionTargetOptions(context.ownTargets, { state: context.matchState.core, sourcePlayerId: context.playerId, sourceKind: 'action', effectType: 'move' }),
        { sourceId: context.sourceId, targetType: 'minion', titleKey: 'ui.pearl_images_now_you_know_bike_safety_first_title' },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const first = targetFromChoice(value as MinionChoice);
        if (!first) return { events: [] };
        const otherTargets = collectMinionTargets(state.core, (minion, baseIndex) => baseIndex === first.baseIndex && minion.controller !== context.playerId);
        if (otherTargets.length === 0) return { events: [] };
        return {
            events: [],
            context: {
                matchState: state,
                playerId: context.playerId,
                now: timestamp,
                sourceId: context.sourceId,
                first,
                otherTargets,
                ...(context.fixedDestinationBaseIndex !== undefined ? { fixedDestinationBaseIndex: context.fixedDestinationBaseIndex } : {}),
            } satisfies BikeSecondContext,
            nextProgram: bikeSecondPromptProgram,
        };
    },
});

const bikeSecondPromptProgram = createPromptProgram<BikeSecondContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'pearl_images_now_you_know_bike_safety_second',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_second_${context.now}`,
        context.playerId,
        '现在你知道：自行车安全：选择同基地另一位玩家的随从',
        buildMinionTargetOptions(context.otherTargets, { state: context.matchState.core, sourcePlayerId: context.playerId, sourceKind: 'action', effectType: 'move' }),
        { sourceId: 'pearl_images_now_you_know_bike_safety_second', targetType: 'minion', titleKey: 'ui.pearl_images_now_you_know_bike_safety_second_title' },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const second = targetFromChoice(value as MinionChoice);
        if (!second) return { events: [] };
        if (context.fixedDestinationBaseIndex !== undefined) {
            return {
                events: [
                    ...moveEvents(state, context.first, context.fixedDestinationBaseIndex, context.sourceId, timestamp, {
                        sourcePlayerId: context.playerId,
                        sourceDefId: 'pearl_images_now_you_know_bike_safety',
                        sourceKind: 'action',
                    }),
                    ...moveEvents(state, second, context.fixedDestinationBaseIndex, context.sourceId, timestamp, {
                        sourcePlayerId: context.playerId,
                        sourceDefId: 'pearl_images_now_you_know_bike_safety',
                        sourceKind: 'action',
                    }),
                ],
            };
        }
        const destinationBases = collectBaseTargets(state.core, baseIndex => baseIndex !== context.first.baseIndex);
        return {
            events: [],
            context: {
                matchState: state,
                playerId: context.playerId,
                now: timestamp,
                sourceId: context.sourceId,
                first: context.first,
                second,
                destinationBases,
            } satisfies BikeDestinationContext,
            nextProgram: bikeDestinationPromptProgram,
        };
    },
});

const bikeDestinationPromptProgram = createPromptProgram<BikeDestinationContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'pearl_images_now_you_know_bike_safety_dest',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_dest_${context.now}`,
        context.playerId,
        '现在你知道：自行车安全：选择目标基地',
        buildBaseTargetOptions(context.destinationBases, context.matchState.core),
        { sourceId: 'pearl_images_now_you_know_bike_safety_dest', targetType: 'base', titleKey: 'ui.pearl_images_now_you_know_bike_safety_destination_title' },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as BaseChoice;
        if (choice.baseIndex === undefined) return { events: [] };
        return {
            events: [
                ...moveEvents(state, context.first, choice.baseIndex, context.sourceId, timestamp, {
                    sourcePlayerId: context.playerId,
                    sourceDefId: 'pearl_images_now_you_know_bike_safety',
                    sourceKind: 'action',
                }),
                ...moveEvents(state, context.second, choice.baseIndex, context.sourceId, timestamp, {
                    sourcePlayerId: context.playerId,
                    sourceDefId: 'pearl_images_now_you_know_bike_safety',
                    sourceKind: 'action',
                }),
            ],
        };
    },
});

function pearlBikeSafety(ctx: AbilityContext): AbilityResult {
    const fixedDestinationBaseIndex = ctx.targetBaseIndex;
    const ownTargets = ownMinionTargets(ctx.state, ctx.playerId);
    if (ownTargets.length === 0) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(bikeFirstPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'pearl_images_now_you_know_bike_safety',
        ownTargets,
        ...(fixedDestinationBaseIndex !== undefined ? { fixedDestinationBaseIndex } : {}),
    }));
}

const trulyOutstandingFirstPromptProgram = createPromptProgram<TrulyOutstandingFirstContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'pearl_images_truly_outstanding',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `pearl_images_truly_outstanding_${context.now}`,
        context.playerId,
        '杰出表彰：选择任意数量的其他玩家随从放置 +1 标记',
        buildMinionTargetOptions(context.candidates, { state: context.matchState.core, sourcePlayerId: context.playerId, sourceKind: 'action', effectType: 'buff' }),
        { sourceId: 'pearl_images_truly_outstanding', targetType: 'minion', multi: { min: 0, max: context.candidates.length }, autoResolveIfSingle: false, titleKey: 'ui.pearl_images_truly_outstanding_first_title' },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choices = (Array.isArray(value) ? value : []) as MinionChoice[];
        const targets = choices.map(targetFromChoice).filter((target): target is MinionTarget => !!target);
        const events = targets.map(target => addPowerCounter(target.uid, target.baseIndex, 1, 'pearl_images_truly_outstanding', timestamp));
        const ownTargets = ownMinionTargets(state.core, context.playerId);
        if (targets.length === 0 || ownTargets.length === 0) return { events };
        return {
            events,
            context: {
                matchState: state,
                playerId: context.playerId,
                now: timestamp,
                selectedCount: targets.length,
                candidates: ownTargets,
            } satisfies TrulyOutstandingSecondContext,
            nextProgram: trulyOutstandingSecondPromptProgram,
        };
    },
});

const trulyOutstandingSecondPromptProgram = createPromptProgram<TrulyOutstandingSecondContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'pearl_images_truly_outstanding_own',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `pearl_images_truly_outstanding_own_${context.now}`,
        context.playerId,
        '杰出表彰：选择你的随从放置对应数量 +1 标记',
        buildMinionTargetOptions(context.candidates, { state: context.matchState.core, sourcePlayerId: context.playerId, sourceKind: 'action', effectType: 'buff' }),
        { sourceId: 'pearl_images_truly_outstanding_own', targetType: 'minion', multi: { min: 0, max: Math.min(context.selectedCount, context.candidates.length) }, autoResolveIfSingle: false, titleKey: 'ui.pearl_images_truly_outstanding_second_title' },
    ),
    onResolve: ({ value, timestamp }) => {
        const choices = (Array.isArray(value) ? value : []) as MinionChoice[];
        return {
            events: choices
                .map(targetFromChoice)
                .filter((target): target is MinionTarget => !!target)
                .map(target => addPowerCounter(target.uid, target.baseIndex, 1, 'pearl_images_truly_outstanding', timestamp)),
        };
    },
});

function pearlTrulyOutstanding(ctx: AbilityContext): AbilityResult {
    const candidates = collectMinionTargets(ctx.state, minion => minion.controller !== ctx.playerId);
    if (candidates.length === 0) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(trulyOutstandingFirstPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        candidates,
    }));
}

function pearlWereUpYoureDown(ctx: AbilityContext): AbilityResult {
    if (ctx.targetBaseIndex !== undefined) {
        const base = ctx.state.bases[ctx.targetBaseIndex];
        if (!base) return { events: [] };
        const ownCount = base.minions.filter(minion => minion.controller === ctx.playerId).length;
        const otherCounts = Object.keys(ctx.state.players)
            .filter(playerId => playerId !== ctx.playerId)
            .map(playerId => base.minions.filter(minion => minion.controller === playerId).length);
        if (ownCount === 0 || otherCounts.some(count => count >= ownCount)) return { events: [] };
        return {
            events: [baseMetadata(ctx.targetBaseIndex, {
                halfTheBattleWereUpYoureDown: {
                    sourcePlayerId: ctx.playerId,
                    expiresOnTurnNumber: nextPlayerTurnStartExpiration(ctx.state, ctx.playerId),
                    expiresOnPlayerId: ctx.playerId,
                },
            }, 'pearl_images_were_up_youre_down', ctx.now)],
        };
    }
    return runBasePrompt(ctx, {
        sourceId: 'pearl_images_were_up_youre_down',
        title: '我们上，你们下：选择一个基地',
        bases: collectBaseTargets(ctx.state),
        kind: 'pearl-world-down',
    });
}

function topazTrigger(ctx: TriggerContext) {
    if (!ctx.matchState || !ctx.sourceCardUid || ctx.sourceBaseIndex === undefined) return { events: [] };
    if (ctx.triggerMinion?.controller === ctx.sourceControllerId) return { events: [] };
    const source = ctx.state.bases[ctx.sourceBaseIndex]?.minions.find(minion => minion.uid === ctx.sourceCardUid);
    if (!source) return { events: [] };
    if (Number(source.metadata?.halfTheBattleTopazUsedTurn ?? -1) === ctx.state.turnNumber) return { events: [] };
    const canMove = ctx.baseIndex !== undefined
        && ctx.baseIndex !== ctx.sourceBaseIndex
        && ctx.state.bases[ctx.baseIndex]?.minions.some(minion => minion.controller === ctx.sourceControllerId);
    return runtimeToTriggerResult(executeAbilityProgram(buttonPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.sourceControllerId ?? ctx.playerId,
        now: ctx.now,
        sourceId: 'pearl_images_topaz',
        title: '黄玉：选择触发效果',
        kind: 'topaz-trigger',
        sourceMinionUid: source.uid,
        sourceMinionDefId: source.defId,
        sourceBaseIndex: ctx.sourceBaseIndex,
        ...(canMove && ctx.baseIndex !== undefined ? { targetBaseIndex: ctx.baseIndex } : {}),
    }), ctx.matchState);
}

function canTriggerTopaz(ctx: TriggerContext): boolean {
    if (!ctx.matchState || !ctx.sourceCardUid || ctx.sourceBaseIndex === undefined) return false;
    if (ctx.triggerMinion?.controller === ctx.sourceControllerId) return false;
    const source = ctx.state.bases[ctx.sourceBaseIndex]?.minions.find(minion => minion.uid === ctx.sourceCardUid);
    return !!source && Number(source.metadata?.halfTheBattleTopazUsedTurn ?? -1) !== ctx.state.turnNumber;
}

function shesGotThePowerTrigger(ctx: TriggerContext) {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || ctx.triggerMinion?.controller === ctx.sourceControllerId) return [];
    const host = findAttachedHost(ctx.state, ctx.sourceCardUid);
    if (!host) return [];
    if (Number(host.host.metadata?.halfTheBattleShesGotThePowerUsedTurn ?? -1) === ctx.state.turnNumber) return [];
    return [
        addTempPower(host.host.uid, host.baseIndex, 3, 'pearl_images_shes_got_the_power', ctx.now),
        minionMetadata(host.host.uid, host.baseIndex, { halfTheBattleShesGotThePowerUsedTurn: ctx.state.turnNumber }, 'pearl_images_shes_got_the_power', ctx.now),
    ];
}

function viscountTrigger(ctx: TriggerContext) {
    if (!ctx.matchState || !ctx.sourceCardUid || ctx.sourceBaseIndex === undefined) return { events: [] };
    if (ctx.triggerCardDefId === undefined || getCardDef(ctx.triggerCardDefId)?.type !== 'fusion') return { events: [] };
    const source = ctx.state.bases[ctx.sourceBaseIndex]?.minions.find(minion => minion.uid === ctx.sourceCardUid);
    if (!source || Number(source.metadata?.halfTheBattleViscountUsedTurn ?? -1) === ctx.state.turnNumber) return { events: [] };
    return runtimeToTriggerResult(executeAbilityProgram(buttonPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.sourceControllerId ?? ctx.playerId,
        now: ctx.now,
        sourceId: 'gi_gerald_viscount',
        title: '子爵：选择触发效果',
        kind: 'viscount-trigger',
        sourceMinionUid: source.uid,
        sourceMinionDefId: source.defId,
        sourceBaseIndex: ctx.sourceBaseIndex,
    }), ctx.matchState);
}

function canTriggerViscount(ctx: TriggerContext): boolean {
    if (!ctx.matchState || !ctx.sourceCardUid || ctx.sourceBaseIndex === undefined) return false;
    if (ctx.triggerCardDefId === undefined || getCardDef(ctx.triggerCardDefId)?.type !== 'fusion') return false;
    const source = ctx.state.bases[ctx.sourceBaseIndex]?.minions.find(minion => minion.uid === ctx.sourceCardUid);
    return !!source && Number(source.metadata?.halfTheBattleViscountUsedTurn ?? -1) !== ctx.state.turnNumber;
}

function powerCastle(ctx: BaseAbilityContext): BaseAbilityResult {
    if (!ctx.matchState || ctx.actionTargetType !== 'minion' || !ctx.actionTargetMinionUid) return { events: [] };
    if ((ctx.state.usedBaseAbilitiesThisTurn ?? []).some(entry => entry.playerId === ctx.playerId && entry.baseDefId === ctx.baseDefId && entry.baseIndex === ctx.baseIndex)) {
        return { events: [] };
    }
    return runtimeToAbilityResult(executeAbilityProgram(buttonPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'base_power_castle',
        title: '力量城堡：是否在该随从上放置 +1 标记？',
        kind: 'base-counter-minion',
        targetMinionUid: ctx.actionTargetMinionUid,
        targetBaseIndex: ctx.baseIndex,
        baseDefId: ctx.baseDefId,
    }));
}

function firstMinionHereThisTurn(ctx: BaseAbilityContext): boolean {
    return Object.values(ctx.state.players).reduce((total, player) => (
        total + (player.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0)
    ), 0) <= 1;
}

function technoball(ctx: BaseAbilityContext): BaseAbilityResult {
    if (!ctx.matchState || !ctx.minionUid || !firstMinionHereThisTurn(ctx)) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(buttonPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'base_technoball',
        title: '科技球：是否额外打出一张战术？',
        kind: 'base-extra-action',
        sourceBaseIndex: ctx.baseIndex,
        baseDefId: ctx.baseDefId,
    }));
}

function concertVenue(ctx: BaseAbilityContext): BaseAbilityResult {
    if (!ctx.matchState || !ctx.minionUid || !firstMinionHereThisTurn(ctx)) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(buttonPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'base_concert_venue',
        title: '音乐会场地：是否在该随从上放置 +1 标记？',
        kind: 'base-counter-minion',
        targetMinionUid: ctx.minionUid,
        targetBaseIndex: ctx.baseIndex,
        baseDefId: ctx.baseDefId,
    }));
}

function recordingStudio(ctx: BaseAbilityContext): BaseAbilityResult {
    return {
        events: (ctx.state.bases[ctx.baseIndex]?.minions ?? [])
            .map(minion => addTempPower(minion.uid, ctx.baseIndex, 1, 'base_recording_studio', ctx.now)),
    };
}

function sewerHideout(ctx: BaseAbilityContext): BaseAbilityResult {
    if (!ctx.matchState) return { events: [] };
    if ((ctx.state.players[ctx.playerId]?.actionsPlayed ?? 0) !== 2) return { events: [] };
    const targets = minionsAtBase(ctx.state, ctx.baseIndex);
    if (targets.length === 0) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(powerPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'base_sewer_hideout',
        title: '下水道隐蔽处：你可以选择这里一个随从放置 +1 标记',
        targets,
        amount: 1,
        mode: 'counter',
        optional: true,
    }));
}

function giGeraldsBase(ctx: BaseAbilityContext): BaseAbilityResult {
    if (!ctx.matchState || !ctx.minionUid) return { events: [] };
    if ((ctx.state.usedBaseAbilitiesThisTurn ?? []).some(entry => entry.playerId === ctx.playerId && entry.baseDefId === ctx.baseDefId && entry.baseIndex === ctx.baseIndex)) {
        return { events: [] };
    }
    const drawEvents = buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random ?? { shuffle: cards => cards } as AbilityContext['random'], ctx.now);
    const nextHand = [...ctx.state.players[ctx.playerId].hand];
    const cards = nextHand.map(card => ({ cardUid: card.uid, defId: card.defId, ownerId: card.owner, label: cardLabel(card.defId), zone: 'hand' as const }));
    const prompt = executeAbilityProgram(cardPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'base_gi_geralds_base_bottom',
        title: '杰拉尔德基地：选择一张手牌置于牌库底',
        cards,
        kind: 'hand-to-bottom',
        optional: true,
    });
    return runtimeToAbilityResult({
        events: [baseAbilityUsed(ctx.playerId, ctx.baseIndex, ctx.baseDefId, ctx.now), ...drawEvents],
        matchState: prompt.matchState,
    });
}

function ussBanner(ctx: BaseAbilityContext): BaseAbilityResult {
    return {
        events: [grantContextualExtraMinion({ playerId: ctx.playerId, now: ctx.now, matchState: ctx.matchState?.sys }, 'base_uss_banner', ctx.baseIndex, { powerMax: 2 })],
    };
}

function slimePool(ctx: BaseAbilityContext): BaseAbilityResult {
    if (!ctx.matchState) return { events: [] };
    const topAction = ctx.state.players[ctx.playerId]?.deck.find(card => isPlayOnMinionAction(card.defId));
    if (!topAction) return { events: [] };
    const targets = minionsAtBase(ctx.state, ctx.baseIndex);
    if (targets.length === 0) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(slimePoolTargetPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'base_slime_pool',
        cardUid: topAction.uid,
        defId: topAction.defId,
        ownerId: topAction.owner,
        baseIndex: ctx.baseIndex,
        baseDefId: ctx.baseDefId,
        targets,
    }));
}

function canUseSlimePool(ctx: BaseAbilityContext): boolean {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return false;
    if ((player.actionsPlayed ?? 0) >= (player.actionLimit ?? 1)) return false;
    if ((ctx.state.bases[ctx.baseIndex]?.minions.length ?? 0) === 0) return false;
    return player.deck.some(card => isPlayOnMinionAction(card.defId));
}

function rulersDoltsHalfwitsFoolsMorons(ctx: AbilityContext): AbilityResult {
    return runActionTransferPrompt(ctx, {
        sourceId: 'rulers_cosmos_dolts_halfwits_fools_morons_transfer_source',
        title: '傻瓜们！：选择要转移的战术，或跳过结束',
        actions: ownMinionAttachedActions(ctx.state, ctx.playerId),
        sourceDefId: 'rulers_cosmos_dolts_halfwits_fools_morons',
        sourceKind: 'action',
        destinationMode: 'other-own-minion',
        addCounterOnDestination: true,
        optional: true,
        repeatUntilSkip: true,
    });
}

function powerSwordProtection(ctx: ProtectionCheckContext): boolean {
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    const untilTurn = ctx.targetMinion.metadata?.tempProtectAffectUntilTurnNumber as number | undefined;
    return typeof untilTurn === 'number' && untilTurn >= ctx.state.turnNumber;
}

export function registerHalfTheBattleAbilities(): void {
    registerSimpleAbility('geckos_hokusai', 'onPlay', geckosHokusai);
    registerSimpleAbility('geckos_hokusai', 'talent', geckosHokusaiTalent);
    registerSimpleAbility('geckos_kandinsky', 'onPlay', geckosKandinsky);
    registerSimpleAbility('geckos_kandinsky', 'talent', geckosKandinskyTalent);
    registerSimpleAbility('geckos_monet', 'onPlay', geckosMonet);
    registerSimpleAbility('geckos_van_gogh', 'onPlay', geckosVanGogh);
    registerSimpleAbility('geckos_june', 'onPlay', geckosJune);
    registerSimpleAbility('geckos_breaking_news', 'onPlay', geckosBreakingNews);
    registerSimpleAbility('geckos_flip_kick', 'onPlay', geckosFlipKick);
    registerSimpleAbility('geckos_gecko_blimp', 'onPlay', geckosGeckoBlimp);
    registerSimpleAbility('geckos_gecko_power', 'talent', geckosGeckoPowerTalent);
    registerSimpleAbility('geckos_gecko_rap', 'onPlay', geckosGeckoRap);
    registerSimpleAbility('geckos_lasagna_party', 'onPlay', geckosLasagnaParty);
    registerSimpleAbility('geckos_now_you_know_bullying', 'onPlay', geckosNowYouKnowBullying);
    registerSimpleAbility('geckos_now_you_know_bullying', 'special', geckosNowYouKnowBullying);
    registerSimpleAbility('geckos_masters_teachings', 'onPlay', geckosMastersTeachings);
    registerSimpleAbility('geckos_kc_smith', 'onPlay', geckosKcSmith);

    registerSimpleAbility('gi_gerald_go_gerald', 'onPlay', giGeraldGoGerald);
    registerSimpleAbility('gi_gerald_now_you_know_home_safety', 'onPlay', giGeraldNowYouKnowHomeSafety);
    registerSimpleAbility('gi_gerald_now_you_know_home_safety', 'special', giGeraldNowYouKnowHomeSafety);
    registerSimpleAbility('gi_gerald_mowat', 'onPlay', giGeraldMowat);
    registerSimpleAbility('gi_gerald_obstruction', 'onPlay', giGeraldObstruction);
    registerSimpleAbility('gi_gerald_sawbones', 'onPlay', giGeraldSawbones);
    registerSimpleAbility('gi_gerald_ski_lift', 'onPlay', giGeraldSkiLift);
    registerSimpleAbility('gi_gerald_can_do', 'onPlay', giGeraldCanDo);
    registerSimpleAbility('gi_gerald_mabel_lean', 'onPlay', giGeraldMabelLean);
    registerSimpleAbility('gi_gerald_shellback', 'onPlay', giGeraldShellback);
    registerSimpleAbility('gi_gerald_dice_ninja', 'onPlay', giGeraldDiceNinja);
    registerSimpleAbility('gi_gerald_rosie', 'onPlay', giGeraldRosie);
    registerTrigger('gi_gerald_viscount', 'onActionPlayed', viscountTrigger, { perInstance: true, playerContext: 'sourceController', canTrigger: canTriggerViscount, effectContract: SHAYU_TRIGGER_CONTRACT });

    registerSimpleAbility('rulers_cosmos_frogga', 'onPlay', rulersFrogga);
    registerSimpleAbility('rulers_cosmos_andko', 'talent', rulersAndkoTalent);
    registerSimpleAbility('rulers_cosmos_man_with_arms', 'talent', rulersManWithArmsTalent);
    registerSimpleAbility('rulers_cosmos_myaaah', 'onPlay', rulersMyaaah);
    registerSimpleAbility('rulers_cosmos_now_you_know_toxic_waste', 'onPlay', rulersToxicWaste);
    registerSimpleAbility('rulers_cosmos_now_you_know_toxic_waste', 'special', rulersToxicWaste);
    registerSimpleAbility('rulers_cosmos_fearless_friend', 'talent', rulersFearlessFriendTalent);
    registerSimpleAbility('rulers_cosmos_magic_weapon', 'talent', rulersMagicWeaponTalent);
    registerSimpleAbility('rulers_cosmos_sword_thats_powerful', 'talent', rulersSwordThatsPowerfulTalent);
    registerSimpleAbility('rulers_cosmos_armor_of_battle', 'talent', rulersArmorOfBattleTalent);
    registerSimpleAbility('rulers_cosmos_powerful_sword', 'talent', rulersPowerfulSwordTalent);
    registerSimpleAbility('rulers_cosmos_gal_woman', 'talent', rulersGalWomanTalent);
    registerSimpleAbility('rulers_cosmos_guy_man', 'talent', rulersGuyManTalent);
    registerSimpleAbility('rulers_cosmos_young_noble', 'talent', rulersYoungNobleTalent);
    registerSimpleAbility('rulers_cosmos_dolts_halfwits_fools_morons', 'onPlay', rulersDoltsHalfwitsFoolsMorons);
    registerSimpleAbility('rulers_cosmos_mystic_transference', 'talent', rulersMysticTransferenceTalent);
    registerProtection('rulers_cosmos_powerful_sword', 'affect', powerSwordProtection);

    registerSimpleAbility('pearl_images_ruby', 'onPlay', pearlRuby);
    registerSimpleAbility('pearl_images_love_unites_us', 'onPlay', pearlLoveUnitesUs);
    registerSimpleAbility('pearl_images_pearl', 'talent', pearlPearlTalent);
    registerSimpleAbility('pearl_images_crystal', 'talent', pearlCrystalTalent);
    registerSimpleAbility('pearl_images_dressing_room', 'onPlay', pearlDressingRoom);
    registerSimpleAbility('pearl_images_alls_right_with_the_world', 'talent', pearlAllsRightTalent);
    registerSimpleAbility('pearl_images_jam_all_night_long', 'talent', pearlJamAllNightTalent);
    registerSimpleAbility('pearl_images_now_you_know_bike_safety', 'onPlay', pearlBikeSafety);
    registerSimpleAbility('pearl_images_now_you_know_bike_safety', 'special', pearlBikeSafety);
    registerSimpleAbility('pearl_images_truly_outstanding', 'onPlay', pearlTrulyOutstanding);
    registerSimpleAbility('pearl_images_were_up_youre_down', 'onPlay', pearlWereUpYoureDown);
    registerSimpleAbility('pearl_images_were_up_youre_down', 'special', pearlWereUpYoureDown);
    registerTrigger('pearl_images_topaz', 'onMinionAffected', topazTrigger, { perInstance: true, playerContext: 'sourceController', canTrigger: canTriggerTopaz, effectContract: SHAYU_TRIGGER_CONTRACT });
    registerTrigger('pearl_images_shes_got_the_power', 'onMinionAffected', shesGotThePowerTrigger, { perInstance: true, playerContext: 'sourceHostController', effectContract: SHAYU_TRIGGER_CONTRACT });

    registerBaseAbility('base_sewer_hideout', 'onActionPlayed', sewerHideout, { effectContract: SHAYU_TRIGGER_CONTRACT });
    registerBaseAbility('base_technoball', 'onMinionPlayed', technoball, { effectContract: SHAYU_TRIGGER_CONTRACT });
    registerBaseAbility('base_concert_venue', 'onMinionPlayed', concertVenue, { effectContract: SHAYU_TRIGGER_CONTRACT });
    registerBaseAbility('base_recording_studio', 'onTurnStart', recordingStudio, { effectContract: SHAYU_TRIGGER_CONTRACT });
    registerBaseAbility('base_gi_geralds_base', 'onMinionPlayed', giGeraldsBase, { effectContract: SHAYU_TRIGGER_CONTRACT });
    registerActiveBaseAbility('base_uss_banner', ussBanner, { oncePerTurn: true });
    registerBaseAbility('base_power_castle', 'onActionPlayed', powerCastle, { effectContract: SHAYU_TRIGGER_CONTRACT });
    registerActiveBaseAbility('base_slime_pool', slimePool, { oncePerTurn: true, canUse: canUseSlimePool });
}
