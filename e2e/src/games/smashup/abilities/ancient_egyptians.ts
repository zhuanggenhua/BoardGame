import type { MatchState, PlayerId } from '../../../engine/types';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { registerInteractionHandler, type InteractionHandler } from '../domain/abilityInteractionHandlers';
import { registerActiveBaseAbility, registerBaseAbility } from '../domain/baseAbilities';
import {
    addTempPower,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildStandardDrawEvents,
    buildValidatedDestroyEvents,
    createSkipOption,
    findMinionOnBases,
    getMinionPower,
    removePowerCounter,
} from '../domain/abilityHelpers';
import { buildBuryCardEvents, uncoverBuriedCard } from '../domain/bury';
import { SU_EVENTS } from '../domain/types';
import type { BaseAbilityUsedEvent, SmashUpCore, SmashUpEvent, BuriedCardOnBase } from '../domain/types';
import { registerTrigger } from '../domain/ongoingEffects';
import { getBaseDef, getCardDef } from '../data/cards';

type BuriedChoice = { cardUid: string; baseIndex: number; defId?: string; baseDefId?: string };
type HandCardChoice = { cardUid: string; defId: string };
const DEFAULT_RANDOM: any = {
    random: () => 0.5,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

export function registerAncientEgyptiansAbilities(): void {
    registerAbility('ancient_egyptians_pyramid_engineer', 'onPlay', ancientEgyptiansPyramidEngineerOnPlay);
    registerAbility('ancient_egyptians_pyramid_engineer', 'talent', ancientEgyptiansPyramidEngineerTalent);
    registerAbility('ancient_egyptians_lost_knowledge', 'onPlay', ancientEgyptiansLostKnowledge);
    registerAbility('ancient_egyptians_lost_knowledge', 'special', ancientEgyptiansLostKnowledge);
    registerAbility('ancient_egyptians_you_can_take_it_with_you', 'onPlay', ancientEgyptiansBurySelfOnPlay);
    registerAbility('ancient_egyptians_you_can_take_it_with_you', 'onUncover', ancientEgyptiansYouCanTakeItWithYouOnUncover);
    registerAbility('ancient_egyptians_tomb_trap', 'onPlay', ancientEgyptiansBurySelfOnPlay);
    registerAbility('ancient_egyptians_tomb_trap', 'onUncover', ancientEgyptiansTombTrapOnUncover);
    registerAbility('ancient_egyptians_plague_of_locusts', 'onPlay', ancientEgyptiansPlagueOfLocusts);
    registerAbility('ancient_egyptians_plague_of_locusts', 'special', ancientEgyptiansPlagueOfLocusts);
    registerAbility('ancient_egyptians_mummy_strength', 'onPlay', ancientEgyptiansMummyStrength);
    registerAbility('ancient_egyptians_ancient_curse', 'onPlay', ancientEgyptiansAncientCurse);
    registerAbility('ancient_egyptians_blessing_of_anubis', 'onPlay', ancientEgyptiansBurySelfOnPlay);
    registerAbility('ancient_egyptians_blessing_of_anubis', 'onUncover', ancientEgyptiansBlessingOfAnubisOnUncover);
    registerAbility('ancient_egyptians_seal_the_tomb', 'onPlay', ancientEgyptiansSealTheTomb);

    registerTrigger('ancient_egyptians_mummy', 'afterScoring', ancientEgyptiansMummyAfterScoring, {
        optional: true,
        perInstance: true,
        sourceScope: 'triggerBase',
    });
    registerTrigger('ancient_egyptians_pharaoh', 'beforeScoring', ancientEgyptiansPharaohBeforeScoring, {
        optional: true,
        perInstance: true,
        sourceScope: 'triggerBase',
    });
    registerTrigger('ancient_egyptians_pharaoh', 'onBuriedCardUncovered', ancientEgyptiansPharaohOnUncover, {
        perInstance: true,
    });
    registerTrigger('base_star_portal', 'onCardBuried', ancientEgyptiansStarPortalOnBuried, {
        perInstance: true,
        sourceScope: 'triggerBase',
    });

    registerActiveBaseAbility('base_pyramids', ancientEgyptiansPyramidsDuringTurn, {
        oncePerTurn: true,
        canUse: (ctx) => {
            const player = ctx.state.players[ctx.playerId];
            return !!player && player.hand.length > 0;
        },
    });
    registerBaseAbility('base_star_portal', 'onActionPlayed', ancientEgyptiansStarPortalOnActionPlayed, { mandatory: true });
}

export function registerAncientEgyptiansInteractionHandlers(): void {
    registerInteractionHandler('ancient_egyptians_pyramid_engineer_uncover', handlePyramidEngineerUncover);
    registerInteractionHandler('ancient_egyptians_pyramid_engineer_talent', handlePyramidEngineerTalent);
    registerInteractionHandler('ancient_egyptians_lost_knowledge_mode', handleLostKnowledgeMode);
    registerInteractionHandler('ancient_egyptians_lost_knowledge_bury', handleLostKnowledgeBury);
    registerInteractionHandler('ancient_egyptians_lost_knowledge_bury_base', handleLostKnowledgeBuryBase);
    registerInteractionHandler('ancient_egyptians_lost_knowledge_uncover', handleLostKnowledgeUncover);
    registerInteractionHandler('ancient_egyptians_plague_of_locusts', handlePlagueOfLocusts);
    registerInteractionHandler('ancient_egyptians_tomb_trap', handleTombTrap);
    registerInteractionHandler('ancient_egyptians_ancient_curse_confirm', handleAncientCurseConfirm);
    registerInteractionHandler('ancient_egyptians_mummy_strength_mode', handleMummyStrengthMode);
    registerInteractionHandler('ancient_egyptians_mummy_strength_target', handleMummyStrengthTarget);
    registerInteractionHandler('ancient_egyptians_seal_the_tomb_mode', handleSealTheTombMode);
    registerInteractionHandler('ancient_egyptians_seal_the_tomb_bury', handleSealTheTombBury);
    registerInteractionHandler('ancient_egyptians_seal_the_tomb_uncover', handleSealTheTombUncover);
    registerInteractionHandler('ancient_egyptians_mummy_after_scoring', handleMummyAfterScoring);
    registerInteractionHandler('ancient_egyptians_pharaoh_before_scoring', handlePharaohBeforeScoring);
    registerInteractionHandler('base_pyramids', handleBasePyramids);
}

function ancientEgyptiansPyramidEngineerOnPlay(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base || (base.buriedCards?.length ?? 0) === 0) return { events: [] };
    const options = buildBuriedCardOptions(ctx.state, ctx.playerId, base.buriedCards ?? [], true);
    if (options.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `ancient_egyptians_pyramid_engineer_${ctx.now}`,
        ctx.playerId,
        '金字塔工程师：你可以翻开这里你的一张埋葬牌',
        [createSkipOption(), ...options] as any[],
        { sourceId: 'ancient_egyptians_pyramid_engineer_uncover', targetType: 'generic' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function ancientEgyptiansPyramidEngineerTalent(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player || player.hand.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `ancient_egyptians_pyramid_engineer_talent_${ctx.now}`,
        ctx.playerId,
        '金字塔工程师：选择一张手牌埋葬在这里',
        buildHandCardOptions(player.hand),
        { sourceId: 'ancient_egyptians_pyramid_engineer_talent', targetType: 'hand' },
    );
    (interaction.data as any).continuationContext = { baseIndex: ctx.baseIndex };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function ancientEgyptiansLostKnowledge(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const buriableHand = player.hand.filter(card => card.uid !== ctx.cardUid);
    const canBury = buriableHand.length > 0;
    const canUncover = getBuriedCardChoices(ctx.state, ctx.playerId).length > 0;
    if (!canBury && !canUncover) return { events: [] };

    const options = [];
    if (canBury) {
        options.push({ id: 'bury', label: '埋葬一张手牌', value: { mode: 'bury' }, displayMode: 'button' as const });
    }
    if (canUncover) {
        options.push({ id: 'uncover', label: '翻开一张你的埋葬牌', value: { mode: 'uncover' }, displayMode: 'button' as const });
    }
    if (options.length > 1) {
        const interaction = createSimpleChoice(
            `ancient_egyptians_lost_knowledge_mode_${ctx.now}`,
            ctx.playerId,
            '失落知识：选择要执行的效果',
            options,
            { sourceId: 'ancient_egyptians_lost_knowledge_mode', targetType: 'button' },
        );
        (interaction.data as any).continuationContext = { cardUid: ctx.cardUid };
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }

    return options[0]?.value?.mode === 'bury'
        ? queueLostKnowledgeBury(ctx.matchState, ctx.playerId, ctx.cardUid, ctx.now)
        : queueLostKnowledgeUncover(ctx.matchState, ctx.state, ctx.playerId, ctx.now);
}

function ancientEgyptiansBurySelfOnPlay(ctx: AbilityContext): AbilityResult {
    return {
        events: buildBuryCardEvents({
            core: ctx.state,
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            cardUid: ctx.cardUid,
            defId: ctx.defId,
            baseIndex: ctx.baseIndex,
            trueOwnerId: ctx.playerId,
            buriedFrom: 'play',
            reason: ctx.defId,
            random: ctx.random,
            now: ctx.now,
        }),
    };
}

function ancientEgyptiansYouCanTakeItWithYouOnUncover(ctx: AbilityContext): AbilityResult {
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 3, ctx.random, ctx.now) };
}

function ancientEgyptiansTombTrapOnUncover(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const candidates = base.minions
        .filter((minion) => getMinionPower(ctx.state, minion, ctx.baseIndex) <= 4)
        .map((minion) => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex: ctx.baseIndex,
            label: `${getCardDef(minion.defId)?.name ?? minion.defId}`,
        }));
    const options = [
        ...buildMinionTargetOptions(candidates, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'destroy' }),
        createSkipOption(),
    ];
    const interaction = createSimpleChoice(
        `ancient_egyptians_tomb_trap_${ctx.now}`,
        ctx.playerId,
        '墓穴陷阱：你可以消灭这里一个力量4或以下的随从',
        options as any[],
        { sourceId: 'ancient_egyptians_tomb_trap', targetType: 'minion' },
    );
    (interaction.data as any).continuationContext = { baseIndex: ctx.baseIndex };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function ancientEgyptiansPlagueOfLocusts(ctx: AbilityContext): AbilityResult {
    const baseOptions = buildBaseTargetOptions(
        ctx.state.bases.map((base, baseIndex) => ({
            baseIndex,
            label: getBaseDef(base.defId)?.name ?? base.defId,
        })),
        ctx.state,
    );
    const interaction = createSimpleChoice(
        `ancient_egyptians_plague_of_locusts_${ctx.now}`,
        ctx.playerId,
        '蝗灾：选择一个基地',
        baseOptions,
        { sourceId: 'ancient_egyptians_plague_of_locusts', targetType: 'base' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function ancientEgyptiansMummyStrength(ctx: AbilityContext): AbilityResult {
    const targets = getOwnMinions(ctx.state, ctx.playerId);
    if (targets.length === 0) return { events: [] };
    return queueMummyStrengthTarget(ctx.matchState, ctx.playerId, ctx.now, targets);
}

function ancientEgyptiansAncientCurse(ctx: AbilityContext): AbilityResult {
    if (!ctx.targetMinionUid) return { events: [] };
    const base = ctx.state.bases[ctx.baseIndex];
    const target = base?.minions.find(minion => minion.uid === ctx.targetMinionUid);
    if (!target) return { events: [] };
    const counters = target.powerCounters ?? 0;
    if (counters <= 0) return { events: [] };
    if (!ctx.matchState) {
        return { events: [removePowerCounter(target.uid, ctx.baseIndex, 1, 'ancient_egyptians_ancient_curse', ctx.now)] };
    }
    const interaction = createSimpleChoice(
        `ancient_egyptians_ancient_curse_confirm_${ctx.now}_${target.uid}`,
        ctx.playerId,
        '远古诅咒：是否移除该随从上的 1 个 +1 力量指示物？',
        [
            {
                id: 'apply',
                label: '移除 1 个 +1 力量指示物',
                value: { apply: true, targetMinionUid: target.uid, baseIndex: ctx.baseIndex, baseDefId: base?.defId },
                displayMode: 'button' as const,
            },
            createSkipOption('跳过（不移除）'),
        ],
        { sourceId: 'ancient_egyptians_ancient_curse_confirm', targetType: 'minion' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function ancientEgyptiansBlessingOfAnubisOnUncover(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    return {
        events: base.minions
            .filter(minion => minion.controller === ctx.playerId)
            .map(minion => addTempPower(minion.uid, ctx.baseIndex, 2, 'ancient_egyptians_blessing_of_anubis', ctx.now)),
    };
}

function ancientEgyptiansSealTheTomb(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const buriedChoices = getBuriedCardChoices(ctx.state, ctx.playerId, ctx.baseIndex);
    const buriableHand = player?.hand.filter(card => card.uid !== ctx.cardUid) ?? [];
    const options = [];
    if (buriableHand.length > 0) {
        options.push({ id: 'bury', label: '埋葬至多两张手牌', value: { mode: 'bury' }, displayMode: 'button' as const });
    }
    if (buriedChoices.length > 0) {
        options.push({ id: 'uncover', label: '翻开同一基地至多两张你的埋葬牌', value: { mode: 'uncover' }, displayMode: 'button' as const });
    }
    if (options.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `ancient_egyptians_seal_the_tomb_mode_${ctx.now}`,
        ctx.playerId,
        '封印墓穴：选择要执行的效果',
        options,
        { sourceId: 'ancient_egyptians_seal_the_tomb_mode', targetType: 'button' },
    );
    (interaction.data as any).continuationContext = { baseIndex: ctx.baseIndex, cardUid: ctx.cardUid };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function ancientEgyptiansMummyAfterScoring(ctx: any): AbilityResult {
    const sourceCardUid = ctx.sourceCardUid as string | undefined;
    const sourceControllerId = ctx.sourceControllerId as PlayerId | undefined;
    const sourceBaseIndex = ctx.sourceBaseIndex as number | undefined;
    if (!ctx.matchState || !sourceCardUid || sourceControllerId === undefined || sourceBaseIndex === undefined) {
        return { events: [] };
    }
    const baseOptions = buildBaseTargetOptions(
        ctx.state.bases
            .map((base: any, baseIndex: number) => ({ baseIndex, label: getBaseDef(base.defId)?.name ?? base.defId }))
            .filter((entry: any) => entry.baseIndex !== sourceBaseIndex),
        ctx.state,
    );
    if (baseOptions.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `ancient_egyptians_mummy_after_scoring_${ctx.now}_${sourceCardUid}`,
        sourceControllerId,
        '木乃伊：你可以将此随从埋葬到另一个基地，而不是进入弃牌堆',
        [createSkipOption(), ...baseOptions] as any[],
        { sourceId: 'ancient_egyptians_mummy_after_scoring', targetType: 'base' },
    );
    (interaction.data as any).continuationContext = { cardUid: sourceCardUid };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function ancientEgyptiansPharaohOnUncover(ctx: any): SmashUpEvent[] {
    const pharaohController = ctx.sourceControllerId as PlayerId | undefined;
    if (!pharaohController) return [];
    return buildStandardDrawEvents(ctx.state, pharaohController, 1, ctx.random, ctx.now);
}

function ancientEgyptiansPharaohBeforeScoring(ctx: any): AbilityResult {
    if (!ctx.matchState || ctx.baseIndex === undefined || !ctx.sourceControllerId) return { events: [] };
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base || (base.buriedCards?.length ?? 0) === 0) return { events: [] };
    const options = buildBuriedCardOptions(ctx.state, ctx.sourceControllerId, base.buriedCards ?? [], true);
    if (options.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `ancient_egyptians_pharaoh_before_scoring_${ctx.now}_${ctx.sourceCardUid ?? 'pharaoh'}`,
        ctx.sourceControllerId,
        '法老：你可以在计分前翻开这里你的一张埋葬牌',
        [createSkipOption(), ...options] as any[],
        { sourceId: 'ancient_egyptians_pharaoh_before_scoring', targetType: 'generic' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function ancientEgyptiansStarPortalOnBuried(ctx: any): SmashUpEvent[] {
    if (!ctx.buriedCardControllerId) return [];
    return buildStandardDrawEvents(ctx.state, ctx.buriedCardControllerId, 1, ctx.random, ctx.now);
}

function ancientEgyptiansPyramidsDuringTurn(ctx: any): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!ctx.matchState || !player || player.hand.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `base_pyramids_${ctx.now}`,
        ctx.playerId,
        '金字塔：你可以将一张手牌埋葬在这里',
        [createSkipOption(), ...buildHandCardOptions(player.hand)] as any[],
        { sourceId: 'base_pyramids', targetType: 'hand' },
    );
    (interaction.data as any).continuationContext = { baseIndex: ctx.baseIndex };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function ancientEgyptiansStarPortalOnActionPlayed(ctx: any): AbilityResult {
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, DEFAULT_RANDOM, ctx.now) };
}

function queueLostKnowledgeBury(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    playedCardUid: string,
    now: number,
): AbilityResult {
    const player = matchState.core.players[playerId];
    const buriableHand = player?.hand.filter(card => card.uid !== playedCardUid) ?? [];
    if (!player || buriableHand.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `ancient_egyptians_lost_knowledge_bury_${now}`,
        playerId,
        '失落知识：选择一张手牌埋葬',
        buildHandCardOptions(buriableHand),
        { sourceId: 'ancient_egyptians_lost_knowledge_bury', targetType: 'hand' },
    );
    return { events: [], matchState: queueInteraction(matchState, interaction) };
}

function queueLostKnowledgeUncover(
    matchState: MatchState<SmashUpCore>,
    state: SmashUpCore,
    playerId: PlayerId,
    now: number,
): AbilityResult {
    const choices = getBuriedCardChoices(state, playerId);
    if (choices.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `ancient_egyptians_lost_knowledge_uncover_${now}`,
        playerId,
        '失落知识：选择一张你的埋葬牌翻开',
        buildBuriedCardChoiceOptions(state, playerId, choices),
        { sourceId: 'ancient_egyptians_lost_knowledge_uncover', targetType: 'generic' },
    );
    return { events: [], matchState: queueInteraction(matchState, interaction) };
}

function queueMummyStrengthTarget(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    now: number,
    targets: Array<{ uid: string; defId: string; baseIndex: number; label: string }>,
): AbilityResult {
    const interaction = createSimpleChoice(
        `ancient_egyptians_mummy_strength_target_${now}`,
        playerId,
        '木乃伊之力：选择一个你的随从',
        buildMinionTargetOptions(targets, { state: matchState.core, sourcePlayerId: playerId }) as any[],
        { sourceId: 'ancient_egyptians_mummy_strength_target', targetType: 'minion' },
    );
    return { events: [], matchState: queueInteraction(matchState, interaction) };
}

const handlePyramidEngineerUncover: InteractionHandler = (state, playerId, value, _data, random, now) => {
    const selected = value as BuriedChoice | { skip?: true };
    if ((selected as any)?.skip) return { state, events: [] };
    return uncoverBuriedCard({
        matchState: state,
        playerId,
        cardUid: (selected as BuriedChoice).cardUid,
        baseIndex: (selected as BuriedChoice).baseIndex,
        random,
        now,
        reason: 'ancient_egyptians_pyramid_engineer',
    });
};

const handlePyramidEngineerTalent: InteractionHandler = (state, playerId, value, data, random, now) => {
    const baseIndex = (data?.continuationContext as any)?.baseIndex as number | undefined;
    const selected = value as HandCardChoice | undefined;
    if (baseIndex === undefined || !selected?.cardUid) return { state, events: [] };
    return {
        state,
        events: buildBuryCardEvents({
            core: state.core,
            matchState: state,
            playerId,
            cardUid: selected.cardUid,
            defId: selected.defId,
            baseIndex,
            trueOwnerId: playerId,
            buriedFrom: 'hand',
            reason: 'ancient_egyptians_pyramid_engineer',
            random,
            now,
        }),
    };
};

const handleLostKnowledgeMode: InteractionHandler = (state, playerId, value, data, _random, now) => {
    const mode = (value as any)?.mode as 'bury' | 'uncover' | undefined;
    const playedCardUid = (data?.continuationContext as any)?.cardUid as string | undefined;
    if (!mode) return { state, events: [] };
    const result = mode === 'bury'
        ? queueLostKnowledgeBury(state, playerId, playedCardUid ?? '', now)
        : queueLostKnowledgeUncover(state, state.core, playerId, now);
    return { state: result.matchState ?? state, events: result.events };
};

const handleLostKnowledgeBury: InteractionHandler = (state, playerId, value, data, random, now) => {
    const selected = value as HandCardChoice | undefined;
    if (!selected?.cardUid) return { state, events: [] };
    const options = buildBaseTargetOptions(
        state.core.bases.map((base, baseIndex) => ({
            baseIndex,
            label: getBaseDef(base.defId)?.name ?? base.defId,
        })),
        state.core,
    );
    if (options.length === 0) return { state, events: [] };
    const interaction = createSimpleChoice(
        `ancient_egyptians_lost_knowledge_bury_base_${now}`,
        playerId,
        '失落知识：选择要埋葬到的基地',
        options,
        { sourceId: 'ancient_egyptians_lost_knowledge_bury_base', targetType: 'base' },
    );
    (interaction.data as any).continuationContext = {
        cardUid: selected.cardUid,
        defId: selected.defId,
    };
    return { state: queueInteraction(state, interaction), events: [] };
};

const handleLostKnowledgeBuryBase: InteractionHandler = (state, playerId, value, data, random, now) => {
    const baseIndex = (value as any)?.baseIndex as number | undefined;
    const selected = (data?.continuationContext as any) as HandCardChoice | undefined;
    if (baseIndex === undefined || !selected?.cardUid) return { state, events: [] };
    return {
        state,
        events: buildBuryCardEvents({
            core: state.core,
            matchState: state,
            playerId,
            cardUid: selected.cardUid,
            defId: selected.defId,
            baseIndex,
            trueOwnerId: playerId,
            buriedFrom: 'hand',
            reason: 'ancient_egyptians_lost_knowledge',
            random,
            now,
        }),
    };
};

const handleLostKnowledgeUncover: InteractionHandler = (state, playerId, value, _data, random, now) => {
    const selected = value as BuriedChoice | undefined;
    if (!selected?.cardUid) return { state, events: [] };
    return uncoverBuriedCard({
        matchState: state,
        playerId,
        cardUid: selected.cardUid,
        baseIndex: selected.baseIndex,
        random,
        now,
        reason: 'ancient_egyptians_lost_knowledge',
    });
};

const handlePlagueOfLocusts: InteractionHandler = (state, playerId, value, _data, _random, now) => {
    const baseIndex = (value as any)?.baseIndex as number | undefined;
    const base = baseIndex === undefined ? undefined : state.core.bases[baseIndex];
    if (!base) return { state, events: [] };
    return {
        state,
        events: base.minions
            .filter(minion => minion.controller !== playerId)
            .map(minion => addTempPower(minion.uid, baseIndex, -1, 'ancient_egyptians_plague_of_locusts', now)),
    };
};

const handleTombTrap: InteractionHandler = (state, playerId, value, data, _random, now) => {
    const selected = value as { minionUid?: string; defId?: string; baseIndex?: number; skip?: boolean } | undefined;
    if (!selected || selected.skip || selected.baseIndex === undefined || !selected.minionUid || !selected.defId) {
        return { state, events: [] };
    }
    return {
        state,
        events: buildValidatedDestroyEvents(state.core, {
            minionUid: selected.minionUid,
            minionDefId: selected.defId,
            fromBaseIndex: selected.baseIndex,
            destroyerId: playerId,
            reason: 'ancient_egyptians_tomb_trap',
            now,
        }),
    };
};

const handleAncientCurseConfirm: InteractionHandler = (state, _playerId, value, _data, _random, now) => {
    const selected = value as { apply?: boolean; targetMinionUid?: string; baseIndex?: number; skip?: boolean } | undefined;
    if (!selected || selected.skip || !selected.apply || !selected.targetMinionUid || selected.baseIndex === undefined) {
        return { state, events: [] };
    }
    const target = state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.targetMinionUid);
    if (!target || target.powerCounters <= 0) return { state, events: [] };
    return {
        state,
        events: [removePowerCounter(target.uid, selected.baseIndex, 1, 'ancient_egyptians_ancient_curse', now)],
    };
};

const handleMummyStrengthMode: InteractionHandler = (state) => ({ state, events: [] });

const handleMummyStrengthTarget: InteractionHandler = (state, _playerId, value, _data, _random, now) => {
    const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
    if (!selected?.minionUid || selected.baseIndex === undefined) return { state, events: [] };
    const base = state.core.bases[selected.baseIndex];
    const amount = (base?.buriedCards?.length ?? 0) > 0 ? 4 : 2;
    return {
        state,
        events: [addTempPower(selected.minionUid, selected.baseIndex, amount, 'ancient_egyptians_mummy_strength', now)],
    };
};

const handleSealTheTombMode: InteractionHandler = (state, playerId, value, data, _random, now) => {
    const mode = (value as any)?.mode as 'bury' | 'uncover' | undefined;
    const baseIndex = (data?.continuationContext as any)?.baseIndex as number | undefined;
    if (!mode || baseIndex === undefined) return { state, events: [] };
    if (mode === 'bury') {
        const player = state.core.players[playerId];
        const buriableHand = player?.hand.filter(card => card.uid !== (data?.continuationContext as any)?.cardUid) ?? [];
        const interaction = createSimpleChoice(
            `ancient_egyptians_seal_the_tomb_bury_${now}`,
            playerId,
            '封印墓穴：选择至多两张手牌埋葬到这里',
            buildHandCardOptions(buriableHand),
            { sourceId: 'ancient_egyptians_seal_the_tomb_bury', targetType: 'hand', multi: { min: 0, max: Math.min(2, buriableHand.length) } },
        );
        (interaction.data as any).continuationContext = { baseIndex };
        return { state: queueInteraction(state, interaction), events: [] };
    }

    const choices = getBuriedCardChoices(state.core, playerId, baseIndex);
    if (choices.length === 0) return { state, events: [] };
    const interaction = createSimpleChoice(
        `ancient_egyptians_seal_the_tomb_uncover_${now}`,
        playerId,
        '封印墓穴：翻开同一基地至多两张你的埋葬牌',
        buildBuriedCardChoiceOptions(state.core, playerId, choices),
        { sourceId: 'ancient_egyptians_seal_the_tomb_uncover', targetType: 'generic', multi: { min: 0, max: Math.min(2, choices.length) } },
    );
    return { state: queueInteraction(state, interaction), events: [] };
};

const handleSealTheTombBury: InteractionHandler = (state, playerId, value, data, random, now) => {
    const baseIndex = (data?.continuationContext as any)?.baseIndex as number | undefined;
    const selected = (Array.isArray(value) ? value : []) as HandCardChoice[];
    if (baseIndex === undefined || selected.length === 0) return { state, events: [] };
    return {
        state,
        events: selected.flatMap((card) => buildBuryCardEvents({
            core: state.core,
            matchState: state,
            playerId,
            cardUid: card.cardUid,
            defId: card.defId,
            baseIndex,
            trueOwnerId: playerId,
            buriedFrom: 'hand',
            reason: 'ancient_egyptians_seal_the_tomb',
            random,
            now,
        })),
    };
};

const handleSealTheTombUncover: InteractionHandler = (state, playerId, value, _data, random, now) => {
    const selected = (Array.isArray(value) ? value : []) as BuriedChoice[];
    let currentState = state;
    const events: SmashUpEvent[] = [];
    for (const buried of selected) {
        const result = uncoverBuriedCard({
            matchState: currentState,
            playerId,
            cardUid: buried.cardUid,
            baseIndex: buried.baseIndex,
            random,
            now,
            reason: 'ancient_egyptians_seal_the_tomb',
        });
        currentState = result.state;
        events.push(...result.events);
    }
    return { state: currentState, events };
};

const handleMummyAfterScoring: InteractionHandler = (state, playerId, value, data, random, now) => {
    const selectedBaseIndex = (value as any)?.baseIndex as number | undefined;
    const cardUid = (data?.continuationContext as any)?.cardUid as string | undefined;
    if (selectedBaseIndex === undefined || !cardUid) return { state, events: [] };
    return {
        state,
        events: buildBuryCardEvents({
            core: state.core,
            matchState: state,
            playerId,
            cardUid,
            defId: 'ancient_egyptians_mummy',
            baseIndex: selectedBaseIndex,
            trueOwnerId: playerId,
            buriedFrom: 'play',
            reason: 'ancient_egyptians_mummy',
            random,
            now,
        }),
    };
};

const handlePharaohBeforeScoring: InteractionHandler = (state, playerId, value, _data, random, now) => {
    const selected = value as BuriedChoice | { skip?: true } | undefined;
    if (!selected || (selected as any)?.skip || !(selected as BuriedChoice).cardUid) {
        return { state, events: [] };
    }
    return uncoverBuriedCard({
        matchState: state,
        playerId,
        cardUid: (selected as BuriedChoice).cardUid,
        baseIndex: (selected as BuriedChoice).baseIndex,
        random,
        now,
        reason: 'ancient_egyptians_pharaoh',
    });
};

const handleBasePyramids: InteractionHandler = (state, playerId, value, data, random, now) => {
    if ((value as any)?.skip) return { state, events: [] };
    const baseIndex = (data?.continuationContext as any)?.baseIndex as number | undefined;
    const selected = value as HandCardChoice | undefined;
    if (baseIndex === undefined || !selected?.cardUid) return { state, events: [] };
    const baseDefId = state.core.bases[baseIndex]?.defId ?? 'base_pyramids';
    const usedEvent: BaseAbilityUsedEvent = {
        type: SU_EVENTS.BASE_ABILITY_USED,
        payload: { playerId, baseIndex, baseDefId },
        timestamp: now,
    };
    return {
        state,
        events: [
            usedEvent,
            ...buildBuryCardEvents({
                core: state.core,
                matchState: state,
                playerId,
                cardUid: selected.cardUid,
                defId: selected.defId,
                baseIndex,
                trueOwnerId: playerId,
                buriedFrom: 'hand',
                reason: 'base_pyramids',
                random,
                now,
            }),
        ],
    };
};

function buildHandCardOptions(hand: Array<{ uid: string; defId: string }>): any[] {
    return hand.map((card, index) => ({
        id: `hand-${index}`,
        label: getCardDef(card.defId)?.name ?? card.defId,
        value: { cardUid: card.uid, defId: card.defId },
        _source: 'hand' as const,
        displayMode: 'card' as const,
    }));
}

function buildBuriedCardOptions(
    state: SmashUpCore,
    viewerPlayerId: PlayerId,
    buriedCards: BuriedCardOnBase[],
    onlyOwned: boolean,
): any[] {
    const filtered = onlyOwned ? buriedCards.filter(card => card.controllerId === viewerPlayerId) : buriedCards;
    return filtered.map((buried, index) => {
        const baseIndex = state.bases.findIndex(base => (base.buriedCards ?? []).some(card => card.uid === buried.uid));
        const baseDefId = baseIndex >= 0 ? state.bases[baseIndex]?.defId : undefined;
        return {
            id: `buried-${buried.uid}`,
        label: buried.controllerId === viewerPlayerId
            ? (getCardDef(buried.defId)?.name ?? buried.defId)
            : `埋葬牌 ${index + 1}`,
        value: { cardUid: buried.uid, defId: buried.defId, baseIndex, baseDefId },
        displayMode: 'card' as const,
        };
    });
}

function getBuriedCardChoices(
    state: SmashUpCore,
    playerId: PlayerId,
    restrictedBaseIndex?: number,
): BuriedChoice[] {
    const choices: BuriedChoice[] = [];
    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex++) {
        if (restrictedBaseIndex !== undefined && baseIndex !== restrictedBaseIndex) continue;
        for (const buried of state.bases[baseIndex].buriedCards ?? []) {
            if (buried.controllerId !== playerId) continue;
            choices.push({ cardUid: buried.uid, baseIndex, defId: buried.defId, baseDefId: state.bases[baseIndex].defId });
        }
    }
    return choices;
}

function buildBuriedCardChoiceOptions(
    state: SmashUpCore,
    playerId: PlayerId,
    choices: BuriedChoice[],
): any[] {
    return choices.map((choice) => {
        const buried = (state.bases[choice.baseIndex].buriedCards ?? []).find(card => card.uid === choice.cardUid);
        const baseName = getBaseDef(state.bases[choice.baseIndex].defId)?.name ?? state.bases[choice.baseIndex].defId;
        return {
            id: `buried-${choice.cardUid}`,
            label: `${getCardDef(buried?.defId ?? '')?.name ?? buried?.defId ?? '埋葬牌'} @ ${baseName}`,
            value: { ...choice, defId: choice.defId ?? buried?.defId, baseDefId: choice.baseDefId ?? state.bases[choice.baseIndex].defId },
            displayMode: 'card' as const,
        };
    });
}

function getOwnMinions(state: SmashUpCore, playerId: PlayerId): Array<{ uid: string; defId: string; baseIndex: number; label: string }> {
    const minions: Array<{ uid: string; defId: string; baseIndex: number; label: string }> = [];
    state.bases.forEach((base, baseIndex) => {
        base.minions.forEach((minion) => {
            if (minion.controller !== playerId) return;
            minions.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            });
        });
    });
    return minions;
}

function getOwnMinionsWithBuriedBase(
    state: SmashUpCore,
    playerId: PlayerId,
): Array<{ uid: string; defId: string; baseIndex: number; label: string }> {
    return getOwnMinions(state, playerId).filter(({ baseIndex }) => {
        const base = state.bases[baseIndex];
        return (base.buriedCards?.length ?? 0) > 0;
    });
}
