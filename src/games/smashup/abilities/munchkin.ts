import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addTempPower,
    buildValidatedDestroyEvents,
    buildActionMinionTargetOptions,
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildValidatedMoveEvents,
    buildValidatedReturnEvents,
    grantExtraMinion,
    recoverCardsFromDiscard,
} from '../domain/abilityHelpers';
import { buildValidatedOngoingDetachEvents } from '../domain/ongoingDetach';
import {
    registerCardAbilitySuppression,
    registerProtection,
    registerTrigger,
} from '../domain/ongoingEffects';
import type { ProtectionCheckContext, TriggerContext } from '../domain/ongoingEffects';
import { SU_EVENTS, type MinionOnBase, type SmashUpCore, type SmashUpEvent } from '../domain/types';
import { getEffectivePower } from '../domain/ongoingModifiers';
import { getBaseDef, getCardDef } from '../data/cards';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';

const BAG_OF_CALTROPS = 'munchkin_treasure_bag_of_caltrops';
const CROSSBOW = 'munchkin_treasure_crossbow';
const CROSSBOW_CHOOSE_FACTION_SOURCE_ID = 'munchkin_treasure_crossbow_choose_faction';
const MAGIC_MISSILE = 'munchkin_treasure_magic_missile';
const MAGIC_MISSILE_DESTROY_SOURCE_ID = 'munchkin_treasure_magic_missile_destroy';
const ROCKET_BOOTS = 'munchkin_treasure_rocket_boots';
const ROCKET_BOOTS_MOVE_SOURCE_ID = 'munchkin_treasure_rocket_boots_move';
const TEMPORAL_DISPLACEMENT_JETPACK = 'munchkin_treasure_temporal_displacement_jetpack';
const TREASURE_FINDER = 'munchkin_treasure_treasure_finder';
const WISHING_RING = 'munchkin_treasure_wishing_ring';

type AttachedTreasureHost = {
    host: MinionOnBase;
    action: MinionOnBase['attachedActions'][number];
};
type MagicMissileMinionChoice = {
    minionUid?: string;
    baseIndex?: number;
    defId?: string;
    minionDefId?: string;
};
type MagicMissileInteractionData = {
    fromBaseIndex?: unknown;
    sourceCardUid?: unknown;
};
type CrossbowFactionChoice = {
    factionId?: string;
};
type CrossbowInteractionData = {
    targetBaseIndex?: unknown;
    sourceCardUid?: unknown;
};
type RocketBootsBaseChoice = { baseIndex?: number };
type RocketBootsInteractionData = {
    minionUid?: unknown;
    minionDefId?: unknown;
    fromBaseIndex?: unknown;
    sourceCardUid?: unknown;
};

function halflingHirelingOnPlay(ctx: AbilityContext): AbilityResult {
    return {
        events: [grantExtraMinion(ctx.playerId, ctx.defId, ctx.now)],
    };
}

function potionOfIdioticBraveryOnPlay(ctx: AbilityContext): AbilityResult {
    if (!ctx.targetMinionUid || ctx.targetBaseIndex === undefined) {
        return { events: [] };
    }

    return {
        events: [
            addTempPower(ctx.targetMinionUid, ctx.targetBaseIndex, 3, ctx.defId, ctx.now, {
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.targetBaseIndex,
            }),
        ],
    };
}

function munchkinTreasureToDeckBottom(
    cardUid: string,
    defId: string,
    ownerId: string,
    now: number,
    sourcePlayerId: string,
    reason: string,
    sourceBaseIndex?: number,
): SmashUpEvent {
    return {
        type: SU_EVENTS.MUNCHKIN_TREASURE_TO_DECK_BOTTOM,
        payload: {
            cardUid,
            defId,
            ownerId,
            reason,
            sourcePlayerId,
            sourceCardUid: cardUid,
            sourceDefId: defId,
            sourceControllerId: sourcePlayerId,
            ...(sourceBaseIndex !== undefined ? { sourceBaseIndex } : {}),
        },
        timestamp: now,
    };
}

function wishingRingOnPlay(ctx: AbilityContext): AbilityResult {
    return {
        events: [
            {
                type: SU_EVENTS.VP_AWARDED,
                payload: {
                    playerId: ctx.playerId,
                    amount: 1,
                    reason: WISHING_RING,
                },
                timestamp: ctx.now,
            },
            munchkinTreasureToDeckBottom(
                ctx.cardUid,
                WISHING_RING,
                ctx.playerId,
                ctx.now,
                ctx.playerId,
                WISHING_RING,
                ctx.targetBaseIndex ?? ctx.baseIndex,
            ),
        ],
    };
}

function drawMunchkinTreasures(ctx: AbilityContext, count: number, reason: string): SmashUpEvent {
    return {
        type: SU_EVENTS.MUNCHKIN_TREASURES_DRAWN,
        payload: {
            playerId: ctx.playerId,
            count,
            reason,
            sourcePlayerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: ctx.targetBaseIndex ?? ctx.baseIndex,
        },
        timestamp: ctx.now,
    };
}

function treasureFinderOnPlay(ctx: AbilityContext): AbilityResult {
    const treasureDeck = ctx.state.treasureDeck ?? [];
    const drawCount = Math.min(2, treasureDeck.length);
    const remainingDeck = treasureDeck.slice(drawCount);
    const shuffledDeck = ctx.random.shuffle([
        ...remainingDeck,
        TREASURE_FINDER,
        ...(ctx.state.treasureDiscard ?? []),
    ]);

    return {
        events: [
            drawMunchkinTreasures(ctx, 2, TREASURE_FINDER),
            {
                type: SU_EVENTS.MUNCHKIN_TREASURE_DECK_SHUFFLED,
                payload: {
                    deckDefIds: shuffledDeck,
                    cardUid: ctx.cardUid,
                    defId: TREASURE_FINDER,
                    ownerId: ctx.playerId,
                    reason: TREASURE_FINDER,
                    sourcePlayerId: ctx.playerId,
                    sourceCardUid: ctx.cardUid,
                    sourceDefId: TREASURE_FINDER,
                    sourceControllerId: ctx.playerId,
                    sourceBaseIndex: ctx.targetBaseIndex ?? ctx.baseIndex,
                },
                timestamp: ctx.now,
            },
        ],
    };
}

function getSelectedFactionIds(state: SmashUpCore): string[] {
    const factionIds = new Set<string>();
    for (const player of Object.values(state.players)) {
        for (const factionId of player.factions ?? []) {
            if (factionId) factionIds.add(factionId);
        }
    }
    return Array.from(factionIds);
}

function buildCrossbowEvents(
    state: SmashUpCore,
    baseIndex: number,
    factionId: string,
    source: {
        playerId: string;
        cardUid?: string;
        now: number;
    },
): SmashUpEvent[] {
    const base = state.bases[baseIndex];
    if (!base) return [];

    return base.minions
        .filter((minion) => getCardDef(minion.defId)?.faction === factionId)
        .map((minion) => addTempPower(minion.uid, baseIndex, 2, CROSSBOW, source.now, {
            sourcePlayerId: source.playerId,
            sourceCardUid: source.cardUid,
            sourceDefId: CROSSBOW,
            sourceControllerId: source.playerId,
            sourceBaseIndex: baseIndex,
        }));
}

function crossbowOnPlay(ctx: AbilityContext): AbilityResult {
    if (ctx.targetBaseIndex === undefined || !ctx.state.bases[ctx.targetBaseIndex]) {
        return { events: [] };
    }

    const options = getSelectedFactionIds(ctx.state).map((factionId, index) => ({
        id: `faction-${index}`,
        label: factionId,
        labelKey: `factions.${factionId}.name`,
        value: { factionId },
        displayMode: 'button' as const,
    }));
    if (options.length === 0) return { events: [] };

    const interaction = createSimpleChoice(
        `${CROSSBOW_CHOOSE_FACTION_SOURCE_ID}_${ctx.now}`,
        ctx.playerId,
        '十字弓：选择派系',
        options,
        {
            sourceId: 'munchkin_treasure_crossbow_choose_faction',
            targetType: 'button',
            titleKey: 'ui.munchkin_crossbow_choose_faction_title',
            responseValidationMode: 'live',
            displayCard: { defId: CROSSBOW, cardUid: ctx.cardUid },
        },
    );

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                targetBaseIndex: ctx.targetBaseIndex,
                sourceCardUid: ctx.cardUid,
            },
        }),
    };
}

function potionOfCowardiceSuppression(
    state: SmashUpCore,
    turnScopedSuppressedCardUids: ReadonlySet<string>,
): string[] {
    const suppressedMinionUids = new Set<string>();
    for (const base of state.bases) {
        for (const minion of base.minions) {
            const hasActiveCowardicePotion = minion.attachedActions.some((action) => (
                action.defId === 'munchkin_treasure_potion_of_cowardice'
                && !turnScopedSuppressedCardUids.has(action.uid)
            ));
            if (hasActiveCowardicePotion) {
                suppressedMinionUids.add(minion.uid);
            }
        }
    }
    return Array.from(suppressedMinionUids);
}

function bucklerOfSwashingProtection(ctx: ProtectionCheckContext): boolean {
    const base = ctx.state.bases[ctx.targetBaseIndex];
    const targetMinion = base?.minions.find((minion) => minion.uid === ctx.targetMinion.uid);
    if (!targetMinion) return false;
    return targetMinion.attachedActions.some((action) =>
        action.defId === 'munchkin_treasure_buckler_of_swashing'
    );
}

function hasTemporalJetpackAttached(minion: MinionOnBase | undefined, sourceCardUid: string | undefined): boolean {
    if (!minion || !sourceCardUid) return false;
    return minion.attachedActions.some((action) =>
        action.uid === sourceCardUid
        && action.defId === TEMPORAL_DISPLACEMENT_JETPACK
    );
}

function findTemporalJetpackHost(ctx: TriggerContext): MinionOnBase | undefined {
    if (ctx.triggerMinion && hasTemporalJetpackAttached(ctx.triggerMinion, ctx.sourceCardUid)) {
        return ctx.triggerMinion;
    }
    if (ctx.baseIndex === undefined || !ctx.sourceCardUid) return undefined;
    return ctx.state.bases[ctx.baseIndex]?.minions.find((minion) =>
        hasTemporalJetpackAttached(minion, ctx.sourceCardUid)
    );
}

function temporalDisplacementJetpackCanTrigger(ctx: TriggerContext): boolean {
    if (!ctx.triggerMinionUid) return false;
    return findTemporalJetpackHost(ctx)?.uid === ctx.triggerMinionUid;
}

function temporalDisplacementJetpackTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!temporalDisplacementJetpackCanTrigger(ctx) || !ctx.triggerMinionUid) return [];
    const ownerId = ctx.triggerMinion?.owner
        ?? Object.values(ctx.state.players).find((player) =>
            player.discard.some((card) => card.uid === ctx.triggerMinionUid)
        )?.id;
    if (!ownerId) return [];

    const owner = ctx.state.players[ownerId];
    if (owner?.discard.some((card) => card.uid === ctx.triggerMinionUid)) {
        return [recoverCardsFromDiscard(ownerId, [ctx.triggerMinionUid], TEMPORAL_DISPLACEMENT_JETPACK, ctx.now)];
    }

    const host = findTemporalJetpackHost(ctx);
    const baseIndex = ctx.baseIndex;
    if (!host || baseIndex === undefined) return [];
    return buildValidatedReturnEvents(ctx.state, {
        minionUid: ctx.triggerMinionUid,
        minionDefId: host.defId,
        fromBaseIndex: baseIndex,
        toPlayerId: ownerId,
        reason: TEMPORAL_DISPLACEMENT_JETPACK,
        now: ctx.now,
        sourcePlayerId: ctx.sourceControllerId ?? ctx.playerId,
        sourceCardUid: ctx.sourceCardUid,
        sourceDefId: TEMPORAL_DISPLACEMENT_JETPACK,
        sourceControllerId: ctx.sourceControllerId,
        sourceBaseIndex: ctx.sourceBaseIndex ?? baseIndex,
        sourceKind: 'action',
    });
}

function findBagOfCaltropsSource(ctx: TriggerContext) {
    if (ctx.baseIndex === undefined || !ctx.sourceCardUid) return undefined;
    return ctx.state.bases[ctx.baseIndex]?.ongoingActions.find((action) =>
        action.uid === ctx.sourceCardUid
        && action.defId === BAG_OF_CALTROPS
    );
}

function getBagOfCaltropsController(ctx: TriggerContext): string | undefined {
    const source = findBagOfCaltropsSource(ctx);
    const metadata = source?.metadata as { sourceControllerId?: string; sourcePlayerId?: string } | undefined;
    return ctx.sourceControllerId ?? metadata?.sourceControllerId ?? metadata?.sourcePlayerId ?? source?.ownerId;
}

function findTriggeredMinion(ctx: TriggerContext): MinionOnBase | undefined {
    if (!ctx.triggerMinionUid || ctx.baseIndex === undefined) return undefined;
    return ctx.state.bases[ctx.baseIndex]?.minions.find((minion) => minion.uid === ctx.triggerMinionUid)
        ?? ctx.triggerMinion;
}

function bagOfCaltropsCanTrigger(ctx: TriggerContext): boolean {
    const targetMinion = findTriggeredMinion(ctx);
    if (!targetMinion || ctx.baseIndex === undefined) return false;
    if (!findBagOfCaltropsSource(ctx)) return false;
    const sourceControllerId = getBagOfCaltropsController(ctx);
    if (!sourceControllerId || targetMinion.controller === sourceControllerId) return false;
    return getEffectivePower(ctx.state, targetMinion, ctx.baseIndex) <= 3;
}

function bagOfCaltropsTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const source = findBagOfCaltropsSource(ctx);
    const targetMinion = findTriggeredMinion(ctx);
    if (!source || !targetMinion || ctx.baseIndex === undefined) return [];
    const sourcePlayerId = ctx.sourceControllerId ?? ctx.playerId;
    return [
        ...buildValidatedOngoingDetachEvents(ctx.state, {
            cardUid: source.uid,
            defId: source.defId,
            ownerId: source.ownerId,
            expectedLocation: 'base',
            reason: BAG_OF_CALTROPS,
            now: ctx.now,
            sourcePlayerId,
            sourceCardUid: source.uid,
            sourceDefId: BAG_OF_CALTROPS,
            sourceControllerId: ctx.sourceControllerId,
            sourceBaseIndex: ctx.sourceBaseIndex ?? ctx.baseIndex,
        }),
        ...buildValidatedDestroyEvents(ctx.state, {
            minionUid: targetMinion.uid,
            minionDefId: targetMinion.defId,
            fromBaseIndex: ctx.baseIndex,
            destroyerId: sourcePlayerId,
            reason: BAG_OF_CALTROPS,
            now: ctx.now,
            sourcePlayerId,
            sourceCardUid: source.uid,
            sourceDefId: BAG_OF_CALTROPS,
            sourceControllerId: ctx.sourceControllerId,
            sourceBaseIndex: ctx.sourceBaseIndex ?? ctx.baseIndex,
            sourceKind: 'action',
        }),
    ];
}

function findAttachedTreasureHost(
    state: SmashUpCore,
    baseIndex: number,
    sourceCardUid: string | undefined,
    defId: string,
): AttachedTreasureHost | undefined {
    if (!sourceCardUid) return undefined;
    for (const minion of state.bases[baseIndex]?.minions ?? []) {
        const action = minion.attachedActions.find((candidate) =>
            candidate.uid === sourceCardUid
            && candidate.defId === defId
        );
        if (action) return { host: minion, action };
    }
    return undefined;
}

function findRocketBootsHost(
    state: SmashUpCore,
    baseIndex: number,
    sourceCardUid: string | undefined,
): MinionOnBase | undefined {
    return findAttachedTreasureHost(state, baseIndex, sourceCardUid, ROCKET_BOOTS)?.host;
}

function magicMissileTargetCandidates(state: SmashUpCore, baseIndex: number) {
    return (state.bases[baseIndex]?.minions ?? [])
        .filter(minion => getEffectivePower(state, minion, baseIndex) <= 3)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: getCardDef(minion.defId)?.name ?? minion.defId,
        }));
}

function magicMissileTargetOptions(state: SmashUpCore, baseIndex: number, sourcePlayerId: string) {
    return buildActionMinionTargetOptions(
        magicMissileTargetCandidates(state, baseIndex),
        {
            state,
            sourcePlayerId,
            sourceDefId: MAGIC_MISSILE,
            effectType: 'destroy',
        },
    );
}

function magicMissileValidateUse(ctx: AbilityContext): string | null {
    const source = findAttachedTreasureHost(ctx.state, ctx.baseIndex, ctx.cardUid, MAGIC_MISSILE);
    if (!source) return '当前没有可选择的目标';
    return magicMissileTargetOptions(ctx.state, ctx.baseIndex, ctx.playerId).length > 0
        ? null
        : '当前没有可选择的目标';
}

function magicMissileTalent(ctx: AbilityContext): AbilityResult {
    const source = findAttachedTreasureHost(ctx.state, ctx.baseIndex, ctx.cardUid, MAGIC_MISSILE);
    const options = magicMissileTargetOptions(ctx.state, ctx.baseIndex, ctx.playerId);
    if (!source || options.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    }

    const interaction = createSimpleChoice<MagicMissileMinionChoice>(
        `${MAGIC_MISSILE_DESTROY_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '魔法导弹：选择力量3或更少的仆从',
        options,
        {
            sourceId: 'munchkin_treasure_magic_missile_destroy',
            targetType: 'minion',
            titleKey: 'ui.munchkin_magic_missile_destroy_title',
            responseValidationMode: 'live',
            autoRefresh: 'field',
            displayCard: { defId: MAGIC_MISSILE, cardUid: ctx.cardUid },
        },
    );

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                fromBaseIndex: ctx.baseIndex,
                sourceCardUid: ctx.cardUid,
            },
        }),
    };
}

function rocketBootsDestinationCandidates(state: SmashUpCore, fromBaseIndex: number) {
    return state.bases
        .map((base, baseIndex) => ({
            baseIndex,
            label: getBaseDef(base.defId)?.name ?? base.defId,
        }))
        .filter(candidate => candidate.baseIndex !== fromBaseIndex);
}

function rocketBootsValidateUse(ctx: AbilityContext): string | null {
    const host = findRocketBootsHost(ctx.state, ctx.baseIndex, ctx.cardUid);
    if (!host) return '当前没有可选择的目标';
    return rocketBootsDestinationCandidates(ctx.state, ctx.baseIndex).length > 0
        ? null
        : '当前没有可选择的目标';
}

function rocketBootsTalent(ctx: AbilityContext): AbilityResult {
    const host = findRocketBootsHost(ctx.state, ctx.baseIndex, ctx.cardUid);
    const candidates = rocketBootsDestinationCandidates(ctx.state, ctx.baseIndex);
    if (!host || candidates.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    }

    const interaction = createSimpleChoice<RocketBootsBaseChoice>(
        `${ROCKET_BOOTS_MOVE_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '火箭靴：选择目标基地',
        buildBaseTargetOptions(candidates, ctx.state),
        {
            sourceId: 'munchkin_treasure_rocket_boots_move',
            targetType: 'base',
            titleKey: 'ui.munchkin_rocket_boots_move_title',
            responseValidationMode: 'live',
            displayCard: { defId: ROCKET_BOOTS, cardUid: ctx.cardUid },
        },
    );

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                minionUid: host.uid,
                minionDefId: host.defId,
                fromBaseIndex: ctx.baseIndex,
                sourceCardUid: ctx.cardUid,
            },
        }),
    };
}

export function registerMunchkinAbilities(): void {
    registerAbility('munchkin_treasure_halfling_hireling', 'onPlay', halflingHirelingOnPlay);
    registerAbility(CROSSBOW, 'onPlay', crossbowOnPlay);
    registerAbility('munchkin_treasure_potion_of_idiotic_bravery', 'onPlay', potionOfIdioticBraveryOnPlay);
    registerAbility(TREASURE_FINDER, 'onPlay', treasureFinderOnPlay);
    registerAbility(WISHING_RING, 'onPlay', wishingRingOnPlay);
    registerAbility(MAGIC_MISSILE, 'talent', {
        execute: magicMissileTalent,
        validateUse: magicMissileValidateUse,
    });
    registerAbility(ROCKET_BOOTS, 'talent', {
        execute: rocketBootsTalent,
        validateUse: rocketBootsValidateUse,
    });
    registerCardAbilitySuppression('munchkin_treasure_potion_of_cowardice', potionOfCowardiceSuppression);
    registerProtection('munchkin_treasure_buckler_of_swashing', 'destroy', bucklerOfSwashingProtection);
    registerTrigger(BAG_OF_CALTROPS, 'onMinionPlayed', bagOfCaltropsTrigger, {
        canTrigger: bagOfCaltropsCanTrigger,
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger(TEMPORAL_DISPLACEMENT_JETPACK, 'onMinionDiscardedFromBase', temporalDisplacementJetpackTrigger, {
        canTrigger: temporalDisplacementJetpackCanTrigger,
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
}

export function registerMunchkinInteractionHandlers(): void {
    registerInteractionHandler(CROSSBOW_CHOOSE_FACTION_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const choice = value as CrossbowFactionChoice | undefined;
        const data = interactionData as CrossbowInteractionData | undefined;
        const targetBaseIndex = typeof data?.targetBaseIndex === 'number' ? data.targetBaseIndex : undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        const factionId = typeof choice?.factionId === 'string' ? choice.factionId : undefined;
        if (targetBaseIndex === undefined || !factionId) return { state, events: [] };

        const selectedFactions = new Set(getSelectedFactionIds(state.core));
        if (!selectedFactions.has(factionId)) return { state, events: [] };

        const player = state.core.players[playerId];
        if (sourceCardUid && !player?.discard.some((card) => card.uid === sourceCardUid && card.defId === CROSSBOW)) {
            return { state, events: [] };
        }

        return {
            state,
            events: buildCrossbowEvents(state.core, targetBaseIndex, factionId, {
                playerId,
                cardUid: sourceCardUid,
                now: timestamp,
            }),
        };
    });

    registerInteractionHandler('munchkin_treasure_magic_missile_destroy', (state, playerId, value, interactionData, _random, timestamp) => {
        const choice = value as MagicMissileMinionChoice | undefined;
        const data = interactionData as MagicMissileInteractionData | undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        const fromBaseIndex = typeof data?.fromBaseIndex === 'number' ? data.fromBaseIndex : undefined;
        const targetMinionUid = typeof choice?.minionUid === 'string' ? choice.minionUid : undefined;
        if (!sourceCardUid || fromBaseIndex === undefined || !targetMinionUid || choice?.baseIndex !== fromBaseIndex) {
            return { state, events: [] };
        }

        const source = findAttachedTreasureHost(state.core, fromBaseIndex, sourceCardUid, MAGIC_MISSILE);
        if (!source || source.action.ownerId !== playerId) return { state, events: [] };

        const target = state.core.bases[fromBaseIndex]?.minions.find(minion => minion.uid === targetMinionUid);
        if (!target || getEffectivePower(state.core, target, fromBaseIndex) > 3) return { state, events: [] };

        return {
            state,
            events: [
                munchkinTreasureToDeckBottom(
                    source.action.uid,
                    MAGIC_MISSILE,
                    source.action.ownerId,
                    timestamp,
                    playerId,
                    MAGIC_MISSILE,
                    fromBaseIndex,
                ),
                ...buildValidatedDestroyEvents(state.core, {
                    minionUid: target.uid,
                    minionDefId: target.defId,
                    fromBaseIndex,
                    destroyerId: playerId,
                    reason: MAGIC_MISSILE,
                    now: timestamp,
                    sourcePlayerId: playerId,
                    sourceCardUid: source.action.uid,
                    sourceDefId: MAGIC_MISSILE,
                    sourceControllerId: playerId,
                    sourceBaseIndex: fromBaseIndex,
                    sourceKind: 'action',
                }),
            ],
        };
    });

    registerInteractionHandler('munchkin_treasure_rocket_boots_move', (state, playerId, value, interactionData, _random, timestamp) => {
        const choice = value as RocketBootsBaseChoice | undefined;
        const data = interactionData as RocketBootsInteractionData | undefined;
        const minionUid = typeof data?.minionUid === 'string' ? data.minionUid : undefined;
        const minionDefId = typeof data?.minionDefId === 'string' ? data.minionDefId : undefined;
        const sourceCardUid = typeof data?.sourceCardUid === 'string' ? data.sourceCardUid : undefined;
        const fromBaseIndex = typeof data?.fromBaseIndex === 'number' ? data.fromBaseIndex : undefined;
        if (
            !minionUid
            || !minionDefId
            || !sourceCardUid
            || fromBaseIndex === undefined
            || choice?.baseIndex === undefined
            || choice.baseIndex === fromBaseIndex
        ) {
            return { state, events: [] };
        }

        const liveHost = findRocketBootsHost(state.core, fromBaseIndex, sourceCardUid);
        if (!liveHost || liveHost.uid !== minionUid) return { state, events: [] };

        return {
            state,
            events: buildValidatedMoveEvents(state.core, {
                minionUid: liveHost.uid,
                minionDefId: liveHost.defId,
                fromBaseIndex,
                toBaseIndex: choice.baseIndex,
                reason: ROCKET_BOOTS,
                now: timestamp,
                sourcePlayerId: playerId,
                sourceCardUid,
                sourceDefId: ROCKET_BOOTS,
                sourceControllerId: playerId,
                sourceBaseIndex: fromBaseIndex,
                sourceKind: 'action',
            }),
        };
    });
}
