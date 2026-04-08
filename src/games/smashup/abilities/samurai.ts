import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { registerInteractionHandler, type InteractionHandler } from '../domain/abilityInteractionHandlers';
import { registerBaseAbility, type BaseAbilityContext } from '../domain/baseAbilities';
import { isMinionProtected, registerTrigger } from '../domain/ongoingEffects';
import type { TriggerContext } from '../domain/ongoingEffects';
import { canStartDuel, startDuel } from '../domain/duel';
import {
    addPowerCounter,
    addTempPower,
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildStandardDrawEvents,
    buildValidatedDestroyEvents,
    createSkipOption,
    findMinionOnBases,
    getMinionPower,
    grantExtraAction,
    grantExtraMinion,
} from '../domain/abilityHelpers';
import type { MinionMetadataUpdatedEvent, SmashUpCore, SmashUpEvent, VpAwardedEvent } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { getBaseDef, getCardDef } from '../data/cards';

type BaseChoice = { baseIndex?: number; baseDefId?: string };
type MinionChoice = { minionUid?: string; baseIndex?: number; defId?: string };
type RoninContinuation = {
    minionUid: string;
    baseIndex: number;
    counterAmount?: number;
    sourceId?: 'samurai_ronin' | 'samurai_ronin_pod';
};
type HonorAncestorsContinuation = { maxShuffle: number };
type CombatContinuation = {
    sourceId: string;
    casterPlayerId: PlayerId;
    outcome: 'vp_to_winner' | 'draw2_to_winner' | 'destroy_loser';
    destroyReason?: string;
    friendlyMinionUid?: string;
};

export function registerSamuraiAbilities(): void {
    registerAbility('samurai_ronin', 'onPlay', samuraiRoninOnPlay);
    registerAbility('samurai_ronin_pod', 'onPlay', samuraiRoninPodOnPlay);
    registerAbility('samurai_yokai_attack', 'onPlay', samuraiYokaiAttackOnPlay);
    registerAbility('samurai_honorable_combat', 'onPlay', samuraiHonorableCombatOnPlay);
    registerAbility('samurai_code_of_bushido', 'onPlay', samuraiCodeOfBushidoOnPlay);
    registerAbility('samurai_honor_the_ancestors', 'onPlay', samuraiHonorTheAncestorsOnPlay);
    registerAbility('samurai_way_of_the_warrior', 'onPlay', samuraiWayOfTheWarriorOnPlay);
    registerAbility('samurai_way_of_the_warrior_pod', 'onPlay', samuraiWayOfTheWarriorOnPlay);
    registerAbility('samurai_heart_of_the_battle', 'special', samuraiHeartOfTheBattleSpecial);

    registerTrigger('samurai_samurai_chan', 'onMinionDestroyed', samuraiChanTrigger, { perInstance: true });
    registerTrigger('samurai_samurai_chan', 'onMinionDiscardedFromBase', samuraiChanTrigger, { perInstance: true });
    registerTrigger('samurai_bushi', 'onMinionDestroyed', samuraiBushiTrigger, { perInstance: true });
    registerTrigger('samurai_bushi', 'onMinionDiscardedFromBase', samuraiBushiTrigger, { perInstance: true });
    registerTrigger('samurai_shogun', 'onMinionDestroyed', samuraiShogunTrigger, { perInstance: true });
    registerTrigger('samurai_shogun', 'onMinionDiscardedFromBase', samuraiShogunTrigger, { perInstance: true });
    registerTrigger('samurai_final_haiku', 'onMinionDestroyed', samuraiFinalHaikuTrigger, { perInstance: true });
    registerTrigger('samurai_final_haiku', 'onMinionDiscardedFromBase', samuraiFinalHaikuTrigger, { perInstance: true });
    registerTrigger('samurai_way_of_the_warrior', 'onMinionDestroyed', samuraiWayOfTheWarriorTrigger, { global: true });
    registerTrigger('samurai_way_of_the_warrior', 'onMinionDiscardedFromBase', samuraiWayOfTheWarriorTrigger, { global: true });
    registerTrigger('samurai_way_of_the_warrior_pod', 'onMinionDestroyed', samuraiWayOfTheWarriorTrigger, { global: true });
    registerTrigger('samurai_way_of_the_warrior_pod', 'onMinionDiscardedFromBase', samuraiWayOfTheWarriorTrigger, { global: true });
    registerTrigger('samurai_honor_the_fallen', 'onMinionDestroyed', samuraiHonorTheFallenTrigger, {
        perInstance: true,
        sourceScope: 'triggerBase',
    });
    registerTrigger('samurai_honor_the_fallen', 'onMinionDiscardedFromBase', samuraiHonorTheFallenTrigger, {
        perInstance: true,
        sourceScope: 'triggerBase',
    });
    registerTrigger('base_sakura_garden', 'onMinionDestroyed', samuraiSakuraGardenTrigger, {
        sourceScope: 'triggerBase',
    });
    registerTrigger('base_sakura_garden', 'onMinionDiscardedFromBase', samuraiSakuraGardenTrigger, {
        sourceScope: 'triggerBase',
    });

    registerBaseAbility('base_shoguns_palace', 'onMinionPlayed', samuraiBaseShogunsPalaceOnMinionPlayed, {
        mandatory: false,
    });
}

export function registerSamuraiInteractionHandlers(): void {
    registerInteractionHandler('samurai_ronin', handleSamuraiRonin);
    registerInteractionHandler('samurai_ronin_pod', handleSamuraiRonin);
    registerInteractionHandler('samurai_yokai_attack', handleSamuraiYokaiAttack);
    registerInteractionHandler('samurai_honorable_combat_base', handleSamuraiCombatBase);
    registerInteractionHandler('samurai_honorable_combat_friendly', handleSamuraiCombatFriendly);
    registerInteractionHandler('samurai_honorable_combat_enemy', handleSamuraiCombatEnemy);
    registerInteractionHandler('samurai_code_of_bushido', handleSamuraiCodeOfBushido);
    registerInteractionHandler('samurai_honor_the_ancestors', handleSamuraiHonorTheAncestors);
    registerInteractionHandler('samurai_heart_of_the_battle_friendly', handleSamuraiCombatFriendly);
    registerInteractionHandler('samurai_heart_of_the_battle_enemy', handleSamuraiCombatEnemy);
    registerInteractionHandler('base_shoguns_palace', handleBaseShogunsPalace);
}

function samuraiRoninOnPlay(ctx: AbilityContext): AbilityResult {
    const source = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!source) return { events: [] };
    const ownMinions = ctx.state.bases[source.baseIndex]?.minions.filter(minion => minion.controller === ctx.playerId) ?? [];
    if (ownMinions.length !== 1) return { events: [] };
    const roninInteraction = createSimpleChoice(
        `samurai_ronin_${ctx.now}`,
        ctx.playerId,
        '浪人：你可以在此随从上放置一个 +1 力量指示物',
        [
            {
                id: 'yes',
                label: '放置一个指示物',
                value: { apply: true },
                displayMode: 'button' as const,
            },
            {
                id: 'no',
                label: '跳过',
                value: { apply: false },
                displayMode: 'button' as const,
            },
        ],
        { sourceId: 'samurai_ronin', targetType: 'button' },
    );
    (roninInteraction.data as any).continuationContext = {
        minionUid: source.minion.uid,
        baseIndex: source.baseIndex,
    } satisfies RoninContinuation;
    return { events: [], matchState: queueInteraction(ctx.matchState, roninInteraction) };
}


function samuraiRoninPodOnPlay(ctx: AbilityContext): AbilityResult {
    const source = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!source) return { events: [] };
    const ownMinions = ctx.state.bases[source.baseIndex]?.minions.filter(minion => minion.controller === ctx.playerId) ?? [];
    if (ownMinions.length !== 1) return { events: [] };
    const roninInteraction = createSimpleChoice(
        `samurai_ronin_pod_${ctx.now}`,
        ctx.playerId,
        '浪人（POD）：若这是你在此基地唯一的随从，你可以在此随从上放置两个 +1 力量指示物',
        [
            {
                id: 'yes',
                label: '放置两个指示物',
                value: { apply: true },
                displayMode: 'button' as const,
            },
            {
                id: 'no',
                label: '跳过',
                value: { apply: false },
                displayMode: 'button' as const,
            },
        ],
        { sourceId: 'samurai_ronin_pod', targetType: 'button' },
    );
    (roninInteraction.data as any).continuationContext = {
        minionUid: source.minion.uid,
        baseIndex: source.baseIndex,
        counterAmount: 2,
        sourceId: 'samurai_ronin_pod',
    } satisfies RoninContinuation;
    return { events: [], matchState: queueInteraction(ctx.matchState, roninInteraction) };
}

function samuraiYokaiAttackOnPlay(ctx: AbilityContext): AbilityResult {
    const ownMinions = collectOwnMinions(ctx.state, ctx.playerId);
    if (ownMinions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const interaction = createSimpleChoice(
        `samurai_yokai_attack_${ctx.now}`,
        ctx.playerId,
        '妖怪来袭！：你可以消灭一个自己的随从，以额外打出一个随从和一个行动',
        [
            createSkipOption('跳过（不消灭随从）') as any,
            ...buildMinionTargetOptions(ownMinions, { state: ctx.state, sourcePlayerId: ctx.playerId, sourceDefId: ctx.defId }) as any[],
        ],
        { sourceId: 'samurai_yokai_attack', targetType: 'minion' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function samuraiHonorableCombatOnPlay(ctx: AbilityContext): AbilityResult {
    if (!canStartDuel(ctx.state) || ctx.duel) return { events: [] };
    const baseOptions = collectHonorableCombatBases(ctx.state, ctx.playerId);
    if (baseOptions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (baseOptions.length === 1) {
        return queueFriendlyCombatPrompt(
            ctx.matchState,
            ctx.state,
            ctx.playerId,
            baseOptions[0].baseIndex,
            ctx.now,
            'samurai_honorable_combat_friendly',
            '荣誉决斗：选择你要决斗的随从',
            { sourceId: 'samurai_honorable_combat', outcome: 'vp_to_winner' },
        );
    }
    const interaction = createSimpleChoice(
        `samurai_honorable_combat_base_${ctx.now}`,
        ctx.playerId,
        '荣誉决斗：选择一个有对手力量高于你的基地',
        buildBaseTargetOptions(baseOptions, ctx.state),
        { sourceId: 'samurai_honorable_combat_base', targetType: 'base' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function samuraiCodeOfBushidoOnPlay(ctx: AbilityContext): AbilityResult {
    const ownMinions = collectOwnMinions(ctx.state, ctx.playerId);
    if (ownMinions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (ownMinions.length === 1) {
        const target = ownMinions[0];
        return {
            events: [
                addPowerCounter(target.uid, target.baseIndex, 1, 'samurai_code_of_bushido', ctx.now),
                addPowerCounter(target.uid, target.baseIndex, 1, 'samurai_code_of_bushido', ctx.now),
                addPowerCounter(target.uid, target.baseIndex, 1, 'samurai_code_of_bushido', ctx.now),
            ],
        };
    }
    return queueCodeOfBushidoPrompt(ctx.matchState, ctx.state, ctx.playerId, 3, ctx.now);
}

function samuraiHonorTheAncestorsOnPlay(ctx: AbilityContext): AbilityResult {
    const ownMinions = collectOwnMinions(ctx.state, ctx.playerId);
    if (ownMinions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const maxShuffle = Math.max(Object.keys(ctx.state.players).length - 1, 0);
    if (ownMinions.length === 1) {
        const target = ownMinions[0];
        return {
            events: buildHonorAncestorsEvents(ctx.state, ctx.playerId, target.uid, target.baseIndex, maxShuffle, ctx.random, ctx.now),
        };
    }
    const interaction = createSimpleChoice(
        `samurai_honor_the_ancestors_${ctx.now}`,
        ctx.playerId,
        '致敬先祖：选择一个你的随从放置 +1 力量指示物',
        buildMinionTargetOptions(ownMinions, { state: ctx.state, sourcePlayerId: ctx.playerId, sourceDefId: ctx.defId }) as any[],
        { sourceId: 'samurai_honor_the_ancestors', targetType: 'minion' },
    );
    (interaction.data as any).continuationContext = { maxShuffle } satisfies HonorAncestorsContinuation;
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function samuraiWayOfTheWarriorOnPlay(ctx: AbilityContext): AbilityResult {
    if (!ctx.targetMinionUid) return { events: [] };
    const base = ctx.state.bases[ctx.baseIndex];
    const target = base?.minions.find(minion => minion.uid === ctx.targetMinionUid);
    if (!target) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    return {
        events: [
            addTempPower(target.uid, ctx.baseIndex, 3, 'samurai_way_of_the_warrior', ctx.now),
            {
                type: SU_EVENTS.MINION_METADATA_UPDATED,
                payload: {
                    minionUid: target.uid,
                    baseIndex: ctx.baseIndex,
                    metadataUpdate: {
                        samuraiWayOfTheWarriorDrawUntilTurnNumber: (ctx.state.turnNumber ?? 0) + 1,
                        samuraiWayOfTheWarriorDrawPlayerId: ctx.playerId,
                    },
                    reason: 'samurai_way_of_the_warrior',
                },
                timestamp: ctx.now,
            } as MinionMetadataUpdatedEvent,
        ],
    };
}

function samuraiHeartOfTheBattleSpecial(ctx: AbilityContext): AbilityResult {
    if (!canStartDuel(ctx.state) || ctx.duel) return { events: [] };
    return queueFriendlyCombatPrompt(
        ctx.matchState,
        ctx.state,
        ctx.playerId,
        ctx.baseIndex,
        ctx.now,
        'samurai_heart_of_the_battle_friendly',
        '战斗之心：选择你要决斗的随从',
        {
            sourceId: 'samurai_heart_of_the_battle',
            outcome: 'destroy_loser',
            destroyReason: 'samurai_heart_of_the_battle',
        },
    );
}

function samuraiChanTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceControllerId || ctx.triggerMinionUid !== ctx.sourceCardUid) return [];
    return buildStandardDrawEvents(ctx.state, ctx.sourceControllerId, 1, ctx.random, ctx.now);
}

function samuraiBushiTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceControllerId || ctx.triggerMinionUid !== ctx.sourceCardUid) return [];
    const power = ctx.triggerMinionPower
        ?? ctx.triggerMinion?.basePower
        ?? 0;
    if (power < 5) return [];
    return [{
        type: SU_EVENTS.VP_AWARDED,
        payload: { playerId: ctx.sourceControllerId, amount: 1, reason: 'samurai_bushi' },
        timestamp: ctx.now,
    } as VpAwardedEvent];
}

function samuraiShogunTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceControllerId || !ctx.sourceCardUid || ctx.sourceBaseIndex === undefined) return [];
    if (!ctx.triggerMinion || ctx.triggerMinionUid === ctx.sourceCardUid) return [];
    if (ctx.triggerMinion.controller !== ctx.sourceControllerId) return [];
    const base = ctx.state.bases[ctx.sourceBaseIndex];
    if (!base?.minions.some(minion => minion.uid === ctx.sourceCardUid)) return [];
    return [addPowerCounter(ctx.sourceCardUid, ctx.sourceBaseIndex, 1, 'samurai_shogun', ctx.now)];
}

function samuraiHonorTheFallenTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceControllerId || ctx.sourceBaseIndex === undefined || ctx.baseIndex !== ctx.sourceBaseIndex) return [];
    if (ctx.triggerMinion?.controller !== ctx.sourceControllerId) return [];
    return buildStandardDrawEvents(ctx.state, ctx.sourceControllerId, 1, ctx.random, ctx.now);
}

function samuraiFinalHaikuTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || !ctx.sourceControllerId) return [];
    const host = findAttachedActionHost(ctx.state, ctx.sourceCardUid, ctx.sourceBaseIndex);
    if (!host || host.uid !== ctx.triggerMinionUid) return [];
    const events: SmashUpEvent[] = [];
    ctx.state.bases.forEach((base, baseIndex) => {
        base.minions.forEach(minion => {
            if (minion.controller !== ctx.sourceControllerId) return;
            if (minion.uid === ctx.triggerMinionUid) return;
            events.push(addTempPower(minion.uid, baseIndex, 2, 'samurai_final_haiku', ctx.now));
        });
    });
    return events;
}

function samuraiWayOfTheWarriorTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const metadata = ctx.triggerMinion?.metadata ?? {};
    const drawUntilTurnNumber = typeof metadata.samuraiWayOfTheWarriorDrawUntilTurnNumber === 'number'
        ? metadata.samuraiWayOfTheWarriorDrawUntilTurnNumber
        : undefined;
    const drawPlayerId = typeof metadata.samuraiWayOfTheWarriorDrawPlayerId === 'string'
        ? metadata.samuraiWayOfTheWarriorDrawPlayerId as PlayerId
        : undefined;
    if (!drawPlayerId || typeof drawUntilTurnNumber !== 'number') return [];

    const currentTurnNumber = ctx.state.turnNumber ?? 0;
    const currentPlayerId = ctx.state.currentPlayerId ?? ctx.state.turnOrder?.[ctx.state.currentPlayerIndex ?? 0];
    const isWindowActive = currentTurnNumber < drawUntilTurnNumber
        || (currentTurnNumber === drawUntilTurnNumber && currentPlayerId !== drawPlayerId);
    if (!isWindowActive) return [];

    if (ctx.timing === 'onMinionDestroyed' && ctx.baseIndex !== undefined) {
        const base = ctx.state.bases[ctx.baseIndex];
        const destroyedAtBaseThisTurnCount = (ctx.state.turnDestroyedMinions ?? [])
            .filter(record => record.baseIndex === ctx.baseIndex)
            .length;
        if (base?.defId === 'base_temple_of_goju_pod') return [];
        if (base?.defId === 'base_tar_pits' && destroyedAtBaseThisTurnCount === 0) return [];
    }

    return buildStandardDrawEvents(ctx.state, drawPlayerId, 2, ctx.random, ctx.now);
}

function samuraiSakuraGardenTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.sourceBaseIndex === undefined || ctx.baseIndex !== ctx.sourceBaseIndex || !ctx.triggerMinion) return [];
    const ownerId = ctx.triggerMinion.owner;
    const alreadyTriggered = (ctx.state.turnDestroyedMinions ?? []).some(record => (
        record.baseIndex === ctx.baseIndex && record.owner === ownerId
    ));
    if (alreadyTriggered) return [];
    return buildStandardDrawEvents(ctx.state, ctx.triggerMinion.controller, 1, ctx.random, ctx.now);
}

function samuraiBaseShogunsPalaceOnMinionPlayed(ctx: BaseAbilityContext): AbilityResult {
    if (!ctx.matchState || ctx.minionUid == null) return { events: [] };
    if (!canStartDuel(ctx.state)) return { events: [] };
    if (getTurnMinionsPlayedAtBase(ctx.state, ctx.baseIndex) !== 1) return { events: [] };
    const enemyOptions = buildEnemyOptions(ctx.state, ctx.baseIndex, ctx.playerId);
    if (enemyOptions.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `base_shoguns_palace_${ctx.now}_${ctx.minionUid}`,
        ctx.playerId,
        '天守阁：此随从可以与这里另一位玩家的一个随从决斗',
        [createSkipOption('跳过（不决斗）'), ...enemyOptions] as any[],
        { sourceId: 'base_shoguns_palace', targetType: 'minion' },
    );
    (interaction.data as any).continuationContext = {
        sourceId: 'base_shoguns_palace',
        casterPlayerId: ctx.playerId,
        outcome: 'draw2_to_winner',
        friendlyMinionUid: ctx.minionUid,
    } satisfies CombatContinuation;
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

const handleSamuraiRonin: InteractionHandler = (state, _playerId, value, data, _random, now) => {
    if (!(value as any)?.apply) return { state, events: [] };
    const ctx = data?.continuationContext as RoninContinuation | undefined;
    if (!ctx) return { state, events: [] };
    const counterAmount = ctx.counterAmount ?? 1;
    const sourceId = ctx.sourceId ?? 'samurai_ronin';
    return {
        state,
        events: [
            addPowerCounter(ctx.minionUid, ctx.baseIndex, counterAmount, sourceId, now),
        ],
    };
};

const handleSamuraiYokaiAttack: InteractionHandler = (state, playerId, value, _data, _random, now) => {
    if ((value as { skip?: boolean } | undefined)?.skip) return { state, events: [] };
    const selected = value as MinionChoice | undefined;
    if (!selected?.minionUid || selected.baseIndex === undefined || !selected.defId) return { state, events: [] };
    const target = state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.minionUid);
    if (!target) return { state, events: [] };
    if (isMinionProtected(state.core, target, selected.baseIndex, playerId, 'destroy')) {
        return { state, events: [] };
    }
    return {
        state,
        events: [
            ...buildValidatedDestroyEvents(state, {
                minionUid: selected.minionUid,
                minionDefId: selected.defId,
                fromBaseIndex: selected.baseIndex,
                destroyerId: playerId,
                reason: 'samurai_yokai_attack',
                now,
            }),
            grantExtraMinion(playerId, 'samurai_yokai_attack', now),
            grantExtraAction(playerId, 'samurai_yokai_attack', now),
        ],
    };
};

const handleSamuraiCombatBase: InteractionHandler = (state, playerId, value, _data, _random, now) => {
    const selected = value as BaseChoice | undefined;
    if (selected?.baseIndex === undefined) return { state, events: [] };
    return queueFriendlyCombatPrompt(
        state,
        state.core,
        playerId,
        selected.baseIndex,
        now,
        'samurai_honorable_combat_friendly',
        '荣誉决斗：选择你要决斗的随从',
        { sourceId: 'samurai_honorable_combat', outcome: 'vp_to_winner' },
    );
};

const handleSamuraiCombatFriendly: InteractionHandler = (state, playerId, value, data, _random, now) => {
    const selected = value as MinionChoice | undefined;
    const ctx = data?.continuationContext as CombatContinuation | undefined;
    if (!ctx || !selected?.minionUid || selected.baseIndex === undefined) return { state, events: [] };
    const respectActionProtection = ctx.sourceId === 'samurai_honorable_combat' || ctx.sourceId === 'samurai_heart_of_the_battle';
    const enemyOptions = buildCombatEnemyOptions(
        state.core,
        ctx.baseIndex,
        playerId,
        ctx.sourceId === 'samurai_honorable_combat',
        respectActionProtection,
    );
    if (enemyOptions.length === 0) return { state, events: [] };
    const nextSourceId = ctx.sourceId === 'samurai_heart_of_the_battle'
        ? 'samurai_heart_of_the_battle_enemy'
        : 'samurai_honorable_combat_enemy';
    const interaction = createSimpleChoice(
        `${nextSourceId}_${now}`,
        playerId,
        '选择对手要决斗的随从',
        enemyOptions,
        { sourceId: nextSourceId, targetType: 'minion' },
    );
    (interaction.data as any).continuationContext = {
        ...ctx,
        friendlyMinionUid: selected.minionUid,
    } satisfies CombatContinuation;
    return { state: queueInteraction(state, interaction), events: [] };
};

const handleSamuraiCombatEnemy: InteractionHandler = (state, _playerId, value, data, random, now) => {
    const selected = value as MinionChoice | undefined;
    const ctx = data?.continuationContext as CombatContinuation | undefined;
    if (!ctx || !ctx.friendlyMinionUid || !selected?.minionUid) return { state, events: [] };
    return {
        state: startDuel(state, {
            sourceId: ctx.sourceId,
            sourcePlayerId: ctx.casterPlayerId,
            challengerMinionUid: ctx.friendlyMinionUid,
            challengedMinionUid: selected.minionUid,
            outcome: ctx.outcome,
            destroyReason: ctx.destroyReason,
        }, now),
        events: [],
    };
};

const handleSamuraiCodeOfBushido: InteractionHandler = (state, playerId, value, data, _random, now) => {
    const selected = value as MinionChoice | undefined;
    const remaining = (data?.continuationContext as { remaining?: number } | undefined)?.remaining ?? 0;
    if (!selected?.minionUid || selected.baseIndex === undefined || remaining <= 0) return { state, events: [] };
    const nextRemaining = remaining - 1;
    const events = [addPowerCounter(selected.minionUid, selected.baseIndex, 1, 'samurai_code_of_bushido', now)];
    if (nextRemaining <= 0) {
        return { state, events };
    }
    const next = queueCodeOfBushidoPrompt(state, state.core, playerId, nextRemaining, now);
    return { state: next.matchState ?? state, events: [...events, ...next.events] };
};

const handleSamuraiHonorTheAncestors: InteractionHandler = (state, playerId, value, data, random, now) => {
    const selected = value as MinionChoice | undefined;
    const maxShuffle = (data?.continuationContext as HonorAncestorsContinuation | undefined)?.maxShuffle ?? 0;
    if (!selected?.minionUid || selected.baseIndex === undefined) return { state, events: [] };
    return {
        state,
        events: buildHonorAncestorsEvents(state.core, playerId, selected.minionUid, selected.baseIndex, maxShuffle, random, now),
    };
};

const handleBaseShogunsPalace: InteractionHandler = (state, _playerId, value, data, random, now) => {
    if ((value as any)?.skip) return { state, events: [] };
    const selected = value as MinionChoice | undefined;
    const ctx = data?.continuationContext as CombatContinuation | undefined;
    if (!ctx || !ctx.friendlyMinionUid || !selected?.minionUid) return { state, events: [] };
    return {
        state: startDuel(state, {
            sourceId: 'base_shoguns_palace',
            sourcePlayerId: ctx.casterPlayerId,
            challengerMinionUid: ctx.friendlyMinionUid,
            challengedMinionUid: selected.minionUid,
            outcome: 'draw2_to_winner',
        }, now),
        events: [],
    };
};

function queueCodeOfBushidoPrompt(
    matchState: MatchState<SmashUpCore>,
    state: SmashUpCore,
    playerId: PlayerId,
    remaining: number,
    now: number,
): AbilityResult {
    const ownMinions = collectOwnMinions(state, playerId);
    if (ownMinions.length === 0 || remaining <= 0) return { events: [], matchState };
    const interaction = createSimpleChoice(
        `samurai_code_of_bushido_${now}_${remaining}`,
        playerId,
        `武士道：选择一个你的随从放置 +1 力量指示物（还需 ${remaining} 次）`,
        buildMinionTargetOptions(ownMinions, { state, sourcePlayerId: playerId }) as any[],
        { sourceId: 'samurai_code_of_bushido', targetType: 'minion' },
    );
    (interaction.data as any).continuationContext = { remaining };
    return { events: [], matchState: queueInteraction(matchState, interaction) };
}

function queueFriendlyCombatPrompt(
    matchState: MatchState<SmashUpCore>,
    state: SmashUpCore,
    playerId: PlayerId,
    baseIndex: number,
    now: number,
    sourceId: string,
    title: string,
    options: Pick<CombatContinuation, 'sourceId' | 'outcome' | 'destroyReason'>,
): AbilityResult {
    const ownMinions = collectOwnMinionsOnBase(state, playerId, baseIndex);
    if (ownMinions.length === 0) {
        return { events: [buildAbilityFeedback(playerId, 'feedback.no_valid_targets', now)], matchState };
    }
    const interaction = createSimpleChoice(
        `${sourceId}_${now}_${baseIndex}`,
        playerId,
        title,
        buildMinionTargetOptions(ownMinions, { state, sourcePlayerId: playerId }) as any[],
        { sourceId, targetType: 'minion' },
    );
    (interaction.data as any).continuationContext = {
        sourceId: options.sourceId,
        baseIndex,
        casterPlayerId: playerId,
        outcome: options.outcome,
        destroyReason: options.destroyReason,
    } satisfies CombatContinuation;
    return { events: [], matchState: queueInteraction(matchState, interaction) };
}

function buildHonorAncestorsEvents(
    state: SmashUpCore,
    playerId: PlayerId,
    minionUid: string,
    baseIndex: number,
    maxShuffle: number,
    random: RandomFn,
    now: number,
): SmashUpEvent[] {
    const events: SmashUpEvent[] = [addPowerCounter(minionUid, baseIndex, 1, 'samurai_honor_the_ancestors', now)];
    if (maxShuffle <= 0) return events;

    const player = state.players[playerId];
    const discardMinions = player?.discard.filter(card => card.type === 'minion') ?? [];
    if (discardMinions.length === 0) return events;

    const selectedCards = discardMinions.slice(0, maxShuffle);
    const shuffledDeck = random.shuffle([...player.deck, ...selectedCards]);
    events.push({
        type: SU_EVENTS.DECK_REORDERED,
        payload: { playerId, deckUids: shuffledDeck.map(card => card.uid) },
        timestamp: now,
    } as SmashUpEvent);
    return events;
}

function collectOwnMinions(
    state: SmashUpCore,
    playerId: PlayerId,
): Array<{ uid: string; defId: string; baseIndex: number; label: string }> {
    const results: Array<{ uid: string; defId: string; baseIndex: number; label: string }> = [];
    state.bases.forEach((base, baseIndex) => {
        base.minions.forEach(minion => {
            if (minion.controller !== playerId) return;
            results.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            });
        });
    });
    return results;
}

function collectOwnMinionsOnBase(
    state: SmashUpCore,
    playerId: PlayerId,
    baseIndex: number,
): Array<{ uid: string; defId: string; baseIndex: number; label: string }> {
    const base = state.bases[baseIndex];
    if (!base) return [];
    return base.minions
        .filter(minion => minion.controller === playerId)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: `${getCardDef(minion.defId)?.name ?? minion.defId}（力量 ${getMinionPower(state, minion, baseIndex)}）`,
        }));
}

function collectHonorableCombatBases(
    state: SmashUpCore,
    playerId: PlayerId,
): Array<{ baseIndex: number; label: string }> {
    return state.bases.flatMap((base, baseIndex) => {
        const ownPower = base.minions
            .filter(minion => minion.controller === playerId)
            .reduce((sum, minion) => sum + getMinionPower(state, minion, baseIndex), 0);
        if (ownPower <= 0) return [];
        const hasValidOpponent = Array.from(new Set(base.minions.map(minion => minion.controller)))
            .some(controller => (
                controller !== playerId
                && base.minions.some(minion => minion.controller === controller)
                && base.minions
                    .filter(minion => minion.controller === controller)
                    .reduce((sum, minion) => sum + getMinionPower(state, minion, baseIndex), 0) > ownPower
            ));
        if (!hasValidOpponent) return [];
        if (buildCombatEnemyOptions(state, baseIndex, playerId, true, true).length === 0) return [];
        return [{
            baseIndex,
            label: getBaseDef(base.defId)?.name ?? base.defId,
        }];
    });
}

function buildEnemyOptions(state: SmashUpCore, baseIndex: number, sourcePlayerId: PlayerId): any[] {
    return buildCombatEnemyOptions(state, baseIndex, sourcePlayerId, false);
}

function buildCombatEnemyOptions(
    state: SmashUpCore,
    baseIndex: number,
    sourcePlayerId: PlayerId,
    requireMorePowerController: boolean,
    respectActionProtection: boolean = false,
): any[] {
    const base = state.bases[baseIndex];
    if (!base) return [];
    const ownPower = base.minions
        .filter(minion => minion.controller === sourcePlayerId)
        .reduce((sum, minion) => sum + getMinionPower(state, minion, baseIndex), 0);
    const validControllers = new Set(
        base.minions
            .filter(minion => minion.controller !== sourcePlayerId)
            .map(minion => minion.controller)
            .filter(controller => !requireMorePowerController || (
                base.minions
                    .filter(minion => minion.controller === controller)
                    .reduce((sum, minion) => sum + getMinionPower(state, minion, baseIndex), 0) > ownPower
            )),
    );
    return buildMinionTargetOptions(
        base.minions
            .filter(minion => minion.controller !== sourcePlayerId && validControllers.has(minion.controller))
            .filter(minion => !respectActionProtection || !isMinionProtected(state, minion, baseIndex, sourcePlayerId, 'action'))
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId}（力量 ${getMinionPower(state, minion, baseIndex)}）`,
            })),
        { state, sourcePlayerId },
    );
}

function getTurnMinionsPlayedAtBase(state: SmashUpCore, baseIndex: number): number {
    return Object.values(state.players).reduce(
        (total, player) => total + (player.minionsPlayedPerBase?.[baseIndex] ?? 0),
        0,
    );
}

function findAttachedActionHost(
    state: SmashUpCore,
    actionUid: string,
    baseIndex?: number,
): MinionOnBase | undefined {
    if (baseIndex !== undefined) {
        const base = state.bases[baseIndex];
        const host = base?.minions.find(minion => minion.attachedActions?.some(action => action.uid === actionUid));
        if (host) return host;
    }

    for (const base of state.bases) {
        const host = base.minions.find(minion => minion.attachedActions?.some(action => action.uid === actionUid));
        if (host) return host;
    }
    return undefined;
}
