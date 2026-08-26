import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import type { PromptOption } from '../../../engine/systems/InteractionSystem';
import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { registerTrigger } from '../domain/ongoingEffects';
import type { TriggerContext, TriggerResult } from '../domain/ongoingEffects';
import {
    addTempPower,
    applySemanticMinionEffectBatch,
    buildAbilityFeedback,
    buildStandardDrawEvents,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
    changeMinionController,
    getMinionPower,
    grantContextualExtraAction,
    grantContextualExtraMinion,
} from '../domain/abilityHelpers';
import { isMinionTargetAllowed } from '../domain/effectSemantics';
import { buildOngoingDetachedEvent } from '../domain/ongoingDetach';
import type {
    MinionMetadataUpdatedEvent,
    MinionOnBase,
    SmashUpCore,
    SmashUpEvent,
} from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { getBaseDef, getCardDef } from '../data/cards';

const TEMP_CONTROL_CONTROLLER_META = 'mermaidsTemporaryControlOriginalController';
const TEMP_CONTROL_PLAYER_META = 'mermaidsTemporaryControlPlayerId';
const TEMP_CONTROL_TURN_META = 'mermaidsTemporaryControlTurn';

type MinionChoice = {
    minionUid?: string;
    baseIndex?: number;
    defId?: string;
};

type BaseChoice = {
    baseIndex?: number;
    selectedMinions?: MinionChoice[];
    minionUid?: string;
    minionDefId?: string;
    fromBaseIndex?: number;
    sourceCardUid?: string;
    sourceOwnerId?: PlayerId;
};

function minionLabel(minion: MinionOnBase, baseIndex: number, state: SmashUpCore): string {
    const cardName = getCardDef(minion.defId)?.name ?? minion.defId;
    const baseName = getBaseDef(state.bases[baseIndex]?.defId)?.name ?? `基地 ${baseIndex + 1}`;
    return `${cardName} @ ${baseName}`;
}

function collectMinions(
    state: SmashUpCore,
    predicate: (minion: MinionOnBase, baseIndex: number) => boolean,
): Array<{ minion: MinionOnBase; baseIndex: number }> {
    const result: Array<{ minion: MinionOnBase; baseIndex: number }> = [];
    state.bases.forEach((base, baseIndex) => {
        base.minions.forEach((minion) => {
            if (predicate(minion, baseIndex)) result.push({ minion, baseIndex });
        });
    });
    return result;
}

function buildMinionOptions(
    state: SmashUpCore,
    targets: Array<{ minion: MinionOnBase; baseIndex: number }>,
): PromptOption<MinionChoice>[] {
    return targets.map(({ minion, baseIndex }, index) => ({
        id: `minion-${index}`,
        label: minionLabel(minion, baseIndex, state),
        value: { minionUid: minion.uid, baseIndex, defId: minion.defId },
        displayMode: 'card',
    }));
}

function buildBaseOptions(
    state: SmashUpCore,
    predicate: (baseIndex: number) => boolean,
    valueFor: (baseIndex: number) => BaseChoice,
): PromptOption<BaseChoice>[] {
    return state.bases
        .map((base, baseIndex) => ({ base, baseIndex }))
        .filter(({ baseIndex }) => predicate(baseIndex))
        .map(({ base, baseIndex }) => ({
            id: `base-${baseIndex}`,
            label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`,
            value: valueFor(baseIndex),
        }));
}

function queueMinionChoice(
    ctx: AbilityContext,
    sourceId: string,
    title: string,
    targets: Array<{ minion: MinionOnBase; baseIndex: number }>,
    targetType: 'minion' | 'button' = 'minion',
    titleKey?: string,
    titleParams?: Record<string, string | number>,
): AbilityResult {
    if (targets.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const prompt = createSimpleChoice(
        `${sourceId}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        title,
        buildMinionOptions(ctx.matchState.core, targets),
        { sourceId, targetType, autoResolveIfSingle: false, titleKey, titleParams },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, prompt) };
}

function buildMetadataUpdatedEvent(
    minionUid: string,
    baseIndex: number,
    metadataUpdate: Record<string, unknown>,
    reason: string,
    timestamp: number,
): MinionMetadataUpdatedEvent {
    return {
        type: SU_EVENTS.MINION_METADATA_UPDATED,
        payload: { minionUid, baseIndex, metadataUpdate, reason },
        timestamp,
    };
}

function buildTemporaryControlEvents(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    selected: MinionChoice,
    reason: string,
    timestamp: number,
    sourceKind: 'action' | 'nonAction',
): SmashUpEvent[] {
    if (!selected.minionUid || selected.baseIndex === undefined || !selected.defId) return [];
    const minion = state.core.bases[selected.baseIndex]?.minions.find(entry => entry.uid === selected.minionUid);
    if (!minion || minion.controller === playerId) return [];
    return applySemanticMinionEffectBatch(
        state,
        [{ minion, baseIndex: selected.baseIndex }],
        {
            sourcePlayerId: playerId,
            sourceKind,
            effectType: 'control',
            respectActionProtection: sourceKind === 'action',
            mode: 'apply',
            buildEvents: ({ minion, baseIndex }) => [
                changeMinionController(
                    minion.uid,
                    minion.defId,
                    baseIndex,
                    minion.owner,
                    minion.controller,
                    playerId,
                    playerId,
                    reason,
                    timestamp,
                ),
                buildMetadataUpdatedEvent(
                    minion.uid,
                    baseIndex,
                    {
                        [TEMP_CONTROL_CONTROLLER_META]: minion.controller,
                        [TEMP_CONTROL_PLAYER_META]: playerId,
                        [TEMP_CONTROL_TURN_META]: state.core.turnNumber,
                    },
                    reason,
                    timestamp,
                ),
            ],
        },
    ).events;
}

function findAttachedActionOwner(state: SmashUpCore, cardUid: string | undefined): PlayerId | undefined {
    if (!cardUid) return undefined;
    for (const base of state.bases) {
        for (const minion of base.minions) {
            const attached = minion.attachedActions.find(action => action.uid === cardUid);
            if (attached) return attached.ownerId;
        }
    }
    return undefined;
}

function buildHangInThereDetachEvent(
    sourceCardUid: string,
    sourceOwnerId: PlayerId,
    timestamp: number,
): SmashUpEvent {
    return buildOngoingDetachedEvent({
        cardUid: sourceCardUid,
        defId: 'kitty_cats_hang_in_there',
        ownerId: sourceOwnerId,
        reason: 'kitty_cats_hang_in_there',
        sourcePlayerId: sourceOwnerId,
        sourceCardUid,
        sourceDefId: 'kitty_cats_hang_in_there',
        now: timestamp,
    });
}

function buildHangInThereSaveEvents(
    state: MatchState<SmashUpCore>,
    selected: BaseChoice,
    timestamp: number,
): SmashUpEvent[] {
    if (
        selected.baseIndex === undefined
        || selected.fromBaseIndex === undefined
        || !selected.minionUid
        || !selected.minionDefId
        || !selected.sourceCardUid
        || !selected.sourceOwnerId
    ) {
        return [];
    }
    return [
        ...buildValidatedMoveEvents(state, {
            minionUid: selected.minionUid,
            minionDefId: selected.minionDefId,
            fromBaseIndex: selected.fromBaseIndex,
            toBaseIndex: selected.baseIndex,
            sourcePlayerId: selected.sourceOwnerId,
            sourceDefId: 'kitty_cats_hang_in_there',
            sourceControllerId: selected.sourceOwnerId,
            sourceBaseIndex: selected.fromBaseIndex,
            reason: 'kitty_cats_hang_in_there',
            now: timestamp,
        }),
        buildHangInThereDetachEvent(selected.sourceCardUid, selected.sourceOwnerId, timestamp),
    ];
}

function kittyCatsHangInThereOnDestroyed(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    if (ctx.reason === 'kitty_cats_hang_in_there') return [];
    if (
        !ctx.matchState
        || !ctx.sourceCardUid
        || ctx.baseIndex === undefined
        || !ctx.triggerMinionUid
        || !ctx.triggerMinionDefId
    ) {
        return [];
    }
    const sourceOwnerId = ctx.sourceControllerId ?? findAttachedActionOwner(ctx.state, ctx.sourceCardUid);
    if (sourceOwnerId === undefined) return [];
    const triggerMinion = ctx.triggerMinion
        ?? ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.uid === ctx.triggerMinionUid);
    if (!triggerMinion || triggerMinion.controller !== sourceOwnerId) return [];

    const baseChoices = buildBaseOptions(
        ctx.state,
        baseIndex => baseIndex !== ctx.baseIndex,
        baseIndex => ({
            baseIndex,
            minionUid: ctx.triggerMinionUid,
            minionDefId: ctx.triggerMinionDefId,
            fromBaseIndex: ctx.baseIndex,
            sourceCardUid: ctx.sourceCardUid,
            sourceOwnerId,
        }),
    );
    if (baseChoices.length === 0) return [];
    if (!ctx.matchState) return { events: [] };

    const prompt = createSimpleChoice(
        `kitty_cats_hang_in_there_${ctx.triggerMinionUid}_${ctx.now}`,
        sourceOwnerId,
        '坚持住：选择要移动到的其他基地',
        baseChoices,
        {
            sourceId: 'kitty_cats_hang_in_there',
            targetType: 'base',
            autoResolveIfSingle: false,
            titleKey: 'ui.kitty_cats_hang_in_there_title',
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, prompt) };
}

function canTriggerKittyCatsHangInThereOnDestroyed(ctx: TriggerContext): boolean {
    if (ctx.reason === 'kitty_cats_hang_in_there') return false;
    if (
        !ctx.matchState
        || !ctx.sourceCardUid
        || ctx.baseIndex === undefined
        || !ctx.triggerMinionUid
        || !ctx.triggerMinionDefId
    ) {
        return false;
    }
    const sourceOwnerId = ctx.sourceControllerId ?? findAttachedActionOwner(ctx.state, ctx.sourceCardUid);
    if (sourceOwnerId === undefined) return false;
    const triggerMinion = ctx.triggerMinion
        ?? ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.uid === ctx.triggerMinionUid);
    if (!triggerMinion || triggerMinion.controller !== sourceOwnerId) return false;
    return buildBaseOptions(
        ctx.state,
        baseIndex => baseIndex !== ctx.baseIndex,
        baseIndex => ({ baseIndex }),
    ).length > 0;
}

function queueTemporaryControlChoice(
    ctx: AbilityContext,
    sourceId: string,
    maxPower: number,
    baseIndex?: number,
    sourceKind: 'action' | 'nonAction' = 'nonAction',
): AbilityResult {
    const targets = collectMinions(ctx.matchState.core, (minion, index) => (
        minion.controller !== ctx.playerId
        && (baseIndex === undefined || index === baseIndex)
        && getMinionPower(ctx.matchState.core, minion, index) <= maxPower
        && isMinionTargetAllowed(ctx.matchState.core, minion, index, {
            sourcePlayerId: ctx.playerId,
            sourceKind,
            effectType: 'control',
            respectActionProtection: sourceKind === 'action',
            mode: 'preview',
        })
    ));
    return queueMinionChoice(
        ctx,
        sourceId,
        `猫咪：选择一个力量 ${maxPower} 或以下的随从获得控制权直到回合结束`,
        targets,
        'minion',
        'ui.kitty_cats_temporary_control_title',
        { maxPower },
    );
}

function kittyCatsMrGrumpers(ctx: AbilityContext): AbilityResult {
    return queueMinionChoice(
        ctx,
        'kitty_cats_mr_grumpers',
        '坏脾气先生：选择一个随从直到回合结束 -2 力量',
        collectMinions(ctx.matchState.core, () => true),
        'minion',
        'ui.kitty_cats_mr_grumpers_title',
    );
}

function kittyCatsMuffin(ctx: AbilityContext): AbilityResult {
    return queueTemporaryControlChoice(ctx, 'kitty_cats_muffin', 5);
}

function kittyCatsMuffinPod(ctx: AbilityContext): AbilityResult {
    return queueTemporaryControlChoice(ctx, 'kitty_cats_muffin_pod', 3);
}

function kittyCatsQueenFluffy(ctx: AbilityContext): AbilityResult {
    return queueTemporaryControlChoice(ctx, 'kitty_cats_queen_fluffy', 3);
}

function kittyCatsCatsPaw(ctx: AbilityContext): AbilityResult {
    return queueTemporaryControlChoice(ctx, 'kitty_cats_cats_paw', 5, undefined, 'action');
}

function kittyCatsCanHasCheeseburger(ctx: AbilityContext): AbilityResult {
    return queueTemporaryControlChoice(ctx, 'kitty_cats_can_has_cheeseburger', 5, ctx.baseIndex, 'action');
}

function kittyCatsCanHasCheeseburgerPod(ctx: AbilityContext): AbilityResult {
    return queueTemporaryControlChoice(ctx, 'kitty_cats_can_has_cheeseburger_pod', 3, ctx.baseIndex, 'action');
}

function kittyCatsCatFight(ctx: AbilityContext): AbilityResult {
    return queueMinionChoice(
        ctx,
        'kitty_cats_cat_fight',
        '猫咪打架：选择你的一个随从，按其力量抽牌，然后消灭它',
        collectMinions(ctx.matchState.core, minion => minion.controller === ctx.playerId),
        'minion',
        'ui.kitty_cats_cat_fight_title',
    );
}

function kittyCatsNineLives(ctx: AbilityContext): AbilityResult {
    return queueMinionChoice(
        ctx,
        'kitty_cats_nine_lives',
        '九条命：消灭你的一个随从并额外打出一个行动',
        collectMinions(ctx.matchState.core, minion => minion.controller === ctx.playerId),
        'minion',
        'ui.kitty_cats_nine_lives_title',
    );
}

function kittyCatsNineLivesPod(ctx: AbilityContext): AbilityResult {
    return queueMinionChoice(
        ctx,
        'kitty_cats_nine_lives_pod',
        '九条命 POD：消灭你的一个随从并额外打出一个随从',
        collectMinions(ctx.matchState.core, minion => minion.controller === ctx.playerId),
        'minion',
        'ui.kitty_cats_nine_lives_title',
    );
}

function kittyCatsWhiskers(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [grantContextualExtraAction(ctx, 'kitty_cats_whiskers')];
    const targets = collectMinions(ctx.matchState.core, minion => minion.controller === ctx.playerId);
    if (targets.length === 0) return { events };
    const prompt = createSimpleChoice(
        `kitty_cats_whiskers_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '威斯克：消灭你的一个随从并额外打出一个行动',
        buildMinionOptions(ctx.matchState.core, targets),
        {
            sourceId: 'kitty_cats_whiskers',
            targetType: 'minion',
            autoResolveIfSingle: false,
            titleKey: 'ui.kitty_cats_whiskers_title',
        },
    );
    return { events, matchState: queueInteraction(ctx.matchState, prompt) };
}

function kittyCatsWhiskersPod(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [grantContextualExtraAction(ctx, 'kitty_cats_whiskers_pod')];
    const targets = collectMinions(ctx.matchState.core, minion => minion.controller === ctx.playerId);
    if (targets.length === 0) return { events };
    const prompt = createSimpleChoice(
        `kitty_cats_whiskers_pod_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '威斯克 POD：消灭你的一个随从并额外打出一个行动',
        buildMinionOptions(ctx.matchState.core, targets),
        {
            sourceId: 'kitty_cats_whiskers_pod',
            targetType: 'minion',
            autoResolveIfSingle: false,
            titleKey: 'ui.kitty_cats_whiskers_title',
        },
    );
    return { events, matchState: queueInteraction(ctx.matchState, prompt) };
}

function kittyCatsInvisibleBicycle(ctx: AbilityContext): AbilityResult {
    const sourceBaseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const base = ctx.matchState.core.bases[sourceBaseIndex];
    if (!base) return { events: [] };
    const targets = base.minions
        .filter(minion => getMinionPower(ctx.matchState.core, minion, sourceBaseIndex) <= 2)
        .map(minion => ({ minion, baseIndex: sourceBaseIndex }));
    if (targets.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const prompt = createSimpleChoice<MinionChoice>(
        `kitty_cats_invisible_bicycle_minions_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '隐形自行车：选择要移动的力量 2 或以下随从',
        buildMinionOptions(ctx.matchState.core, targets),
        {
            sourceId: 'kitty_cats_invisible_bicycle_minions',
            targetType: 'minion',
            multi: { min: 1, max: targets.length },
            autoResolveIfSingle: false,
            titleKey: 'ui.kitty_cats_invisible_bicycle_minions_title',
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, prompt) };
}

function handleTempPower(
    state: MatchState<SmashUpCore>,
    _playerId: PlayerId,
    value: unknown,
    _data: Record<string, unknown> | undefined,
    _random: RandomFn,
    timestamp: number,
    amount: number,
    reason: string,
) {
    const selected = value as MinionChoice;
    if (!selected.minionUid || selected.baseIndex === undefined) return { state, events: [] };
    return {
        state,
        events: [addTempPower(selected.minionUid, selected.baseIndex, amount, reason, timestamp)],
    };
}

function handleCatFight(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    _data: Record<string, unknown> | undefined,
    random: RandomFn,
    timestamp: number,
) {
    const selected = value as MinionChoice;
    if (!selected.minionUid || selected.baseIndex === undefined || !selected.defId) return { state, events: [] };
    const minion = state.core.bases[selected.baseIndex]?.minions.find(entry => entry.uid === selected.minionUid);
    if (!minion || minion.controller !== playerId) return { state, events: [] };
    const power = getMinionPower(state.core, minion, selected.baseIndex);
    return {
        state,
        events: [
            ...buildStandardDrawEvents(state, playerId, power, random, timestamp),
            ...buildValidatedDestroyEvents(state, {
                minionUid: minion.uid,
                minionDefId: minion.defId,
                fromBaseIndex: selected.baseIndex,
                destroyerId: playerId,
                sourcePlayerId: playerId,
                sourceDefId: 'kitty_cats_cat_fight',
                sourceControllerId: playerId,
                sourceBaseIndex: selected.baseIndex,
                reason: 'kitty_cats_cat_fight',
                now: timestamp,
                sourceKind: 'action',
            }),
        ],
    };
}

function handleDestroyOwnMinion(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    _data: Record<string, unknown> | undefined,
    _random: RandomFn,
    timestamp: number,
    context: {
        sourceDefId: string;
        sourceKind: 'action' | 'nonAction';
        reason: string;
    },
) {
    const selected = value as MinionChoice;
    if (!selected.minionUid || selected.baseIndex === undefined || !selected.defId) return { state, events: [] };
    const minion = state.core.bases[selected.baseIndex]?.minions.find(entry => entry.uid === selected.minionUid);
    if (!minion || minion.controller !== playerId) return { state, events: [] };
    return {
        state,
        events: buildValidatedDestroyEvents(state, {
            minionUid: minion.uid,
            minionDefId: minion.defId,
            fromBaseIndex: selected.baseIndex,
            destroyerId: playerId,
            sourcePlayerId: playerId,
            sourceDefId: context.sourceDefId,
            sourceControllerId: playerId,
            sourceBaseIndex: selected.baseIndex,
            reason: context.reason,
            now: timestamp,
            sourceKind: context.sourceKind,
        }),
    };
}

function handleWhiskersDestroy(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    data: Record<string, unknown> | undefined,
    random: RandomFn,
    timestamp: number,
) {
    return handleDestroyOwnMinion(state, playerId, value, data, random, timestamp, {
        sourceDefId: 'kitty_cats_whiskers',
        sourceKind: 'nonAction',
        reason: 'kitty_cats_whiskers',
    });
}

function handleNineLivesDestroy(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    data: Record<string, unknown> | undefined,
    random: RandomFn,
    timestamp: number,
) {
    const result = handleDestroyOwnMinion(state, playerId, value, data, random, timestamp, {
        sourceDefId: 'kitty_cats_nine_lives',
        sourceKind: 'action',
        reason: 'kitty_cats_nine_lives',
    });
    return {
        state: result.state,
        events: [
            ...result.events,
            grantContextualExtraAction({ playerId, now: timestamp, matchState: state }, 'kitty_cats_nine_lives'),
        ],
    };
}

function handleNineLivesPodDestroy(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    data: Record<string, unknown> | undefined,
    random: RandomFn,
    timestamp: number,
) {
    const result = handleDestroyOwnMinion(state, playerId, value, data, random, timestamp, {
        sourceDefId: 'kitty_cats_nine_lives_pod',
        sourceKind: 'action',
        reason: 'kitty_cats_nine_lives_pod',
    });
    return {
        state: result.state,
        events: [
            ...result.events,
            grantContextualExtraMinion({ playerId, now: timestamp, matchState: state }, 'kitty_cats_nine_lives_pod'),
        ],
    };
}

function handleWhiskersPodDestroy(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    data: Record<string, unknown> | undefined,
    random: RandomFn,
    timestamp: number,
) {
    return handleDestroyOwnMinion(state, playerId, value, data, random, timestamp, {
        sourceDefId: 'kitty_cats_whiskers_pod',
        sourceKind: 'nonAction',
        reason: 'kitty_cats_whiskers_pod',
    });
}

function handleInvisibleBicycleMinions(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    _data: Record<string, unknown> | undefined,
    _random: RandomFn,
    timestamp: number,
) {
    const selectedMinions = Array.isArray(value) ? value as MinionChoice[] : [];
    const fromBaseIndex = selectedMinions[0]?.baseIndex;
    if (fromBaseIndex === undefined) return { state, events: [] };
    const options = buildBaseOptions(
        state.core,
        baseIndex => baseIndex !== fromBaseIndex,
        baseIndex => ({ baseIndex, selectedMinions }),
    );
    if (options.length === 0) return { state, events: [] };
    const prompt = createSimpleChoice(
        `kitty_cats_invisible_bicycle_base_${timestamp}`,
        playerId,
        '隐形自行车：选择目标基地',
        options,
        {
            sourceId: 'kitty_cats_invisible_bicycle_base',
            targetType: 'base',
            autoResolveIfSingle: false,
            titleKey: 'ui.kitty_cats_invisible_bicycle_base_title',
        },
    );
    return { state: queueInteraction(state, prompt, { urgent: true }), events: [] };
}

function handleInvisibleBicycleBase(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    _data: Record<string, unknown> | undefined,
    _random: RandomFn,
    timestamp: number,
) {
    const selected = value as BaseChoice;
    if (selected.baseIndex === undefined || !selected.selectedMinions) return { state, events: [] };
    const events = selected.selectedMinions.flatMap(minion => {
        if (!minion.minionUid || minion.baseIndex === undefined || !minion.defId) return [];
        return buildValidatedMoveEvents(state, {
            minionUid: minion.minionUid,
            minionDefId: minion.defId,
            fromBaseIndex: minion.baseIndex,
            toBaseIndex: selected.baseIndex!,
            sourcePlayerId: playerId,
            sourceDefId: 'kitty_cats_invisible_bicycle',
            sourceControllerId: playerId,
            sourceBaseIndex: minion.baseIndex,
            reason: 'kitty_cats_invisible_bicycle',
            now: timestamp,
        });
    });
    return { state, events };
}

function handleTemporaryControl(sourceId: string) {
    return (
        state: MatchState<SmashUpCore>,
        playerId: PlayerId,
        value: unknown,
        _data: Record<string, unknown> | undefined,
        _random: RandomFn,
        timestamp: number,
    ) => ({
        state,
        events: buildTemporaryControlEvents(
            state,
            playerId,
            value as MinionChoice,
            sourceId,
            timestamp,
            sourceId === 'kitty_cats_cats_paw' || sourceId === 'kitty_cats_can_has_cheeseburger'
                ? 'action'
                : 'nonAction',
        ),
    });
}

function handleHangInThere(
    state: MatchState<SmashUpCore>,
    _playerId: PlayerId,
    value: unknown,
    _data: Record<string, unknown> | undefined,
    _random: RandomFn,
    timestamp: number,
) {
    return { state, events: buildHangInThereSaveEvents(state, value as BaseChoice, timestamp) };
}

export function registerKittyCatsAbilities(): void {
    registerAbility('kitty_cats_mr_grumpers', 'onPlay', kittyCatsMrGrumpers);
    registerAbility('kitty_cats_muffin', 'onPlay', kittyCatsMuffin);
    registerAbility('kitty_cats_muffin_pod', 'onPlay', kittyCatsMuffinPod);
    registerAbility('kitty_cats_whiskers', 'talent', kittyCatsWhiskers);
    registerAbility('kitty_cats_whiskers_pod', 'talent', kittyCatsWhiskersPod);
    registerAbility('kitty_cats_queen_fluffy', 'talent', kittyCatsQueenFluffy);
    registerAbility('kitty_cats_cat_fight', 'onPlay', kittyCatsCatFight);
    registerAbility('kitty_cats_cats_paw', 'onPlay', kittyCatsCatsPaw);
    registerAbility('kitty_cats_invisible_bicycle', 'onPlay', kittyCatsInvisibleBicycle);
    registerAbility('kitty_cats_nine_lives', 'onPlay', kittyCatsNineLives);
    registerAbility('kitty_cats_nine_lives_pod', 'onPlay', kittyCatsNineLivesPod);
    registerAbility('kitty_cats_can_has_cheeseburger', 'special', kittyCatsCanHasCheeseburger);
    registerAbility('kitty_cats_can_has_cheeseburger_pod', 'special', kittyCatsCanHasCheeseburgerPod);
    registerTrigger('kitty_cats_hang_in_there', 'onMinionDestroyed', kittyCatsHangInThereOnDestroyed, {
        phase: 'replacement',
        perInstance: true,
        canTrigger: canTriggerKittyCatsHangInThereOnDestroyed,
    });

    registerInteractionHandler('kitty_cats_mr_grumpers', (state, playerId, value, data, random, timestamp) =>
        handleTempPower(state, playerId, value, data, random, timestamp, -2, 'kitty_cats_mr_grumpers'));
    registerInteractionHandler('kitty_cats_whiskers', handleWhiskersDestroy);
    registerInteractionHandler('kitty_cats_whiskers_pod', handleWhiskersPodDestroy);
    registerInteractionHandler('kitty_cats_muffin', handleTemporaryControl('kitty_cats_muffin'));
    registerInteractionHandler('kitty_cats_muffin_pod', handleTemporaryControl('kitty_cats_muffin_pod'));
    registerInteractionHandler('kitty_cats_queen_fluffy', handleTemporaryControl('kitty_cats_queen_fluffy'));
    registerInteractionHandler('kitty_cats_cats_paw', handleTemporaryControl('kitty_cats_cats_paw'));
    registerInteractionHandler('kitty_cats_can_has_cheeseburger', handleTemporaryControl('kitty_cats_can_has_cheeseburger'));
    registerInteractionHandler('kitty_cats_can_has_cheeseburger_pod', handleTemporaryControl('kitty_cats_can_has_cheeseburger_pod'));
    registerInteractionHandler('kitty_cats_cat_fight', handleCatFight);
    registerInteractionHandler('kitty_cats_nine_lives', handleNineLivesDestroy);
    registerInteractionHandler('kitty_cats_nine_lives_pod', handleNineLivesPodDestroy);
    registerInteractionHandler('kitty_cats_invisible_bicycle_minions', handleInvisibleBicycleMinions);
    registerInteractionHandler('kitty_cats_invisible_bicycle_base', handleInvisibleBicycleBase);
    registerInteractionHandler('kitty_cats_hang_in_there', handleHangInThere);
}
