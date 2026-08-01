import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addTempPower,
    buildValidatedDestroyEvents,
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
import type { MinionOnBase, SmashUpCore, SmashUpEvent } from '../domain/types';
import { getEffectivePower } from '../domain/ongoingModifiers';

const BAG_OF_CALTROPS = 'munchkin_treasure_bag_of_caltrops';
const TEMPORAL_DISPLACEMENT_JETPACK = 'munchkin_treasure_temporal_displacement_jetpack';

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

function findTriggeredMinion(ctx: TriggerContext): MinionOnBase | undefined {
    if (!ctx.triggerMinionUid || ctx.baseIndex === undefined) return undefined;
    return ctx.state.bases[ctx.baseIndex]?.minions.find((minion) => minion.uid === ctx.triggerMinionUid)
        ?? ctx.triggerMinion;
}

function bagOfCaltropsCanTrigger(ctx: TriggerContext): boolean {
    const targetMinion = findTriggeredMinion(ctx);
    if (!targetMinion || ctx.baseIndex === undefined) return false;
    if (!findBagOfCaltropsSource(ctx)) return false;
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

export function registerMunchkinAbilities(): void {
    registerAbility('munchkin_treasure_halfling_hireling', 'onPlay', halflingHirelingOnPlay);
    registerAbility('munchkin_treasure_potion_of_idiotic_bravery', 'onPlay', potionOfIdioticBraveryOnPlay);
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
