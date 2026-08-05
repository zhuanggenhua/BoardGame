import { registerAbility, type AbilityContext, type AbilityResult } from '../domain/abilityRegistry';
import {
    addTempPower,
    buildAbilityFeedback,
    buildActionMinionTargetOptions,
    buildStandardDrawEvents,
    buildValidatedDestroyEvents,
    createSkipOption,
    grantExtraAction,
    grantExtraMinion,
} from '../domain/abilityHelpers';
import { registerBaseAbility, type BaseAbilityContext, type BaseAbilityResult } from '../domain/baseAbilities';
import { getEffectivePower } from '../domain/ongoingModifiers';
import { getCardDef } from '../data/cards';
import { SU_EVENTS, type CardInstance, type SmashUpCore, type SmashUpEvent } from '../domain/types';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';

const BLASTER_MASTER = 'munchkin_mages_blaster_master';
const BLASTER_MASTER_DISCARD_SOURCE_ID = 'munchkin_mages_blaster_master_discard';
const BLASTER_MASTER_TARGET_SOURCE_ID = 'munchkin_mages_blaster_master_target';
const HAPPY_ZAPPER = 'munchkin_mages_happy_zapper';
const HAPPY_ZAPPER_DISCARD_SOURCE_ID = 'munchkin_mages_happy_zapper_discard';
const SCROLL_SHUFFLER = 'munchkin_mages_scroll_shuffler';
const SCROLL_SHUFFLER_DISCARD_SOURCE_ID = 'munchkin_mages_scroll_shuffler_discard';
const SPEED_READING = 'munchkin_mages_speed_reading';
const SPEED_READING_DISCARD_SOURCE_ID = 'munchkin_mages_speed_reading_discard';
const ZZZZZAP = 'munchkin_mages_zzzzzap';
const ZZZZZAP_DISCARD_SOURCE_ID = 'munchkin_mages_zzzzzap_discard';
const ZZZZZAP_TARGET_SOURCE_ID = 'munchkin_mages_zzzzzap_target';
const WAND_WHIZ = 'munchkin_mages_wand_whiz';
const WAND_WHIZ_DISCARD_SOURCE_ID = 'munchkin_mages_wand_whiz_discard';
const WAND_WHIZ_MODE_SOURCE_ID = 'munchkin_mages_wand_whiz_mode';
const CHARM = 'munchkin_mages_charm';
const CHARM_TARGET_SOURCE_ID = 'munchkin_mages_charm_target';
const EMBIGGEN = 'munchkin_mages_embiggen';
const EMBIGGEN_TARGET_SOURCE_ID = 'munchkin_mages_embiggen_target';
const EMBIGGEN_DISCARD_SOURCE_ID = 'munchkin_mages_embiggen_discard';
const MASS_SUMMONING = 'munchkin_mages_mass_summoning';
const PORTAL_TO_BEYOND = 'munchkin_mages_portal_to_beyond';
const PORTAL_TO_BEYOND_DISCARD_SOURCE_ID = 'munchkin_mages_portal_to_beyond_discard';
const RECOVER_ARCANE_WISDOM = 'munchkin_mages_recover_arcane_wisdom';
const SOME_ENCHANTED_EVENING = 'munchkin_mages_some_enchanted_evening';
const SOME_ENCHANTED_EVENING_DISCARD_SOURCE_ID = 'munchkin_mages_some_enchanted_evening_discard';
const BASE_DIMENSION_DOORS = 'base_dimension_doors';
const BASE_DIMENSION_DOORS_SOURCE_ID = 'base_dimension_doors_discard';
const BASE_MAGES_TOWER = 'base_mages_tower';
const BASE_MAGES_TOWER_SOURCE_ID = 'base_mages_tower_draw';

type HandCardChoice = { cardUid?: string; defId?: string };

type MinionChoice = {
    minionUid?: string;
    baseIndex?: number;
    defId?: string;
};

type CostInteractionData = {
    sourceCardUid?: string;
    sourcePlayerId?: string;
    sourceBaseIndex?: number;
    sourceDefId?: string;
};

type MonsterChoice = {
    monsterUid?: string;
    baseIndex?: number;
    defId?: string;
};

type ExtraPlayModeChoice = { mode?: 'minion' | 'action' };

type TargetedDiscardData = CostInteractionData & {
    costCardUid?: string;
    targetMinionUid?: string;
    targetBaseIndex?: number;
};

function buildHandCardOptions(state: SmashUpCore, playerId: string) {
    return (state.players[playerId]?.hand ?? []).map(card => ({
        id: `munchkin-mages-hand-${card.uid}`,
        label: getCardDef(card.defId)?.name ?? card.defId,
        value: { cardUid: card.uid, defId: card.defId } satisfies HandCardChoice,
        _source: 'hand' as const,
        displayMode: 'card' as const,
    }));
}

function buildAllMinionOptions(state: SmashUpCore) {
    return state.bases.flatMap((base, baseIndex) => base.minions.map(minion => ({
        id: `munchkin-mages-minion-${minion.uid}`,
        label: getCardDef(minion.defId)?.name ?? minion.defId,
        value: {
            minionUid: minion.uid,
            minionDefId: minion.defId,
            defId: minion.defId,
            baseIndex,
        } satisfies MinionChoice,
        _source: 'field' as const,
        displayMode: 'card' as const,
    })));
}

function buildMonsterOptions(state: SmashUpCore) {
    return state.bases.flatMap((base, baseIndex) => (base.monsters ?? [])
        .filter(monster => monster.controllerId === undefined)
        .map(monster => ({
            id: `munchkin-mages-monster-${monster.uid}`,
            label: getCardDef(monster.defId)?.name ?? monster.defId,
            value: { monsterUid: monster.uid, defId: monster.defId, baseIndex } satisfies MonsterChoice,
            _source: 'field' as const,
            displayMode: 'card' as const,
        })));
}

function buildMonsterPlayEvents(
    state: SmashUpCore,
    playerId: string,
    baseIndices: number[],
    reason: string,
    timestamp: number,
): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    let deckOffset = 0;
    let nextUid = state.nextUid;
    for (const baseIndex of baseIndices) {
        const monsterDefId = state.monsterDeck?.[deckOffset];
        if (!monsterDefId || !state.bases[baseIndex]) continue;
        events.push({
            type: SU_EVENTS.MUNCHKIN_MONSTER_PLAYED,
            payload: {
                playerId,
                baseIndex,
                monsterDefId,
                monsterUid: `munchkin_monster_${nextUid}`,
                reason,
            },
            timestamp,
        });
        deckOffset += 1;
        nextUid += 1;
    }
    return events;
}

function getSelectedHandCard(
    state: SmashUpCore,
    playerId: string,
    value: unknown,
): CardInstance | undefined {
    const choice = (Array.isArray(value) ? value[0] : value) as HandCardChoice | undefined;
    if (!choice?.cardUid) return undefined;
    return state.players[playerId]?.hand.find(card =>
        card.uid === choice.cardUid && (choice.defId === undefined || card.defId === choice.defId),
    );
}

function buildMinionOptions(state: SmashUpCore, maxPower: number, sourcePlayerId: string, sourceDefId: string) {
    const candidates = state.bases.flatMap((base, baseIndex) => base.minions
        .filter(minion => getEffectivePower(state, minion, baseIndex) <= maxPower)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: getCardDef(minion.defId)?.name ?? minion.defId,
        })));
    return buildActionMinionTargetOptions(candidates, {
        state,
        sourcePlayerId,
        sourceDefId,
        effectType: 'destroy',
    });
}

function buildDiscardCostInteraction(
    ctx: AbilityContext,
    sourceId: string,
    titleKey: string,
    sourceDefId: string,
    includeSourceBaseIndex = false,
) {
    const options = buildHandCardOptions(ctx.state, ctx.playerId);
    if (options.length === 0) return undefined;

    const interaction = createSimpleChoice<HandCardChoice>(
        `${sourceId}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '法师：选择一张手牌作为弃牌成本',
        options,
        {
            sourceId,
            targetType: 'hand',
            titleKey,
            responseValidationMode: 'live',
            autoRefresh: 'hand',
            multi: { min: 1, max: 1 },
            autoResolveIfSingle: false,
            displayCard: { defId: ctx.defId, cardUid: ctx.cardUid },
        },
    );
    interaction.data.optionsGenerator = (latestState) =>
        buildHandCardOptions(latestState.core as SmashUpCore, ctx.playerId);

    return queueInteraction(ctx.matchState, {
        ...interaction,
        data: {
            ...interaction.data,
            sourceCardUid: ctx.cardUid,
            sourcePlayerId: ctx.playerId,
            sourceDefId,
            ...(includeSourceBaseIndex && ctx.baseIndex !== undefined
                ? { sourceBaseIndex: ctx.baseIndex }
                : {}),
        } satisfies CostInteractionData,
    });
}

function blasterMasterTalent(ctx: AbilityContext): AbilityResult {
    const targets = buildMinionOptions(ctx.state, 2, ctx.playerId, BLASTER_MASTER);
    const matchState = buildDiscardCostInteraction(
        ctx,
        BLASTER_MASTER_DISCARD_SOURCE_ID,
        'ui.munchkin_mages_blaster_master_discard_title',
        BLASTER_MASTER,
        true,
    );
    if (!matchState || targets.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    }
    return { events: [], matchState };
}

function happyZapperTalent(ctx: AbilityContext): AbilityResult {
    const source = ctx.state.bases[ctx.baseIndex]?.minions.find(minion =>
        minion.uid === ctx.cardUid
        && minion.defId === HAPPY_ZAPPER
        && minion.controller === ctx.playerId,
    );
    if (!source) return { events: [] };

    const matchState = buildDiscardCostInteraction(
        ctx,
        HAPPY_ZAPPER_DISCARD_SOURCE_ID,
        'ui.munchkin_mages_happy_zapper_discard_title',
        HAPPY_ZAPPER,
        true,
    );
    return matchState
        ? { events: [], matchState }
        : { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
}

function scrollShufflerOnPlay(ctx: AbilityContext): AbilityResult {
    const matchState = buildDiscardCostInteraction(
        ctx,
        SCROLL_SHUFFLER_DISCARD_SOURCE_ID,
        'ui.munchkin_mages_scroll_shuffler_discard_title',
        SCROLL_SHUFFLER,
        true,
    );
    return matchState ? { events: [], matchState } : { events: [] };
}

function speedReadingOnPlay(ctx: AbilityContext): AbilityResult {
    const matchState = buildDiscardCostInteraction(
        ctx,
        SPEED_READING_DISCARD_SOURCE_ID,
        'ui.munchkin_mages_speed_reading_discard_title',
        SPEED_READING,
    );
    return matchState ? { events: [], matchState } : { events: [] };
}

function zzzzzapOnPlay(ctx: AbilityContext): AbilityResult {
    const targets = buildMinionOptions(ctx.state, 3, ctx.playerId, ZZZZZAP);
    const matchState = buildDiscardCostInteraction(
        ctx,
        ZZZZZAP_DISCARD_SOURCE_ID,
        'ui.munchkin_mages_zzzzzap_discard_title',
        ZZZZZAP,
    );
    if (!matchState || targets.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    }
    return { events: [], matchState };
}

function wandWhizOnPlay(ctx: AbilityContext): AbilityResult {
    const matchState = buildDiscardCostInteraction(
        ctx,
        WAND_WHIZ_DISCARD_SOURCE_ID,
        'ui.munchkin_mages_wand_whiz_discard_title',
        WAND_WHIZ,
        true,
    );
    return matchState ? { events: [], matchState } : { events: [] };
}

function charmOnPlay(ctx: AbilityContext): AbilityResult {
    const options = buildMonsterOptions(ctx.state);
    if (options.length === 0) return { events: [] };
    const interaction = createSimpleChoice<MonsterChoice>(
        `${CHARM_TARGET_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '魅力：选择一个未被控制的怪物',
        options,
        {
            sourceId: CHARM_TARGET_SOURCE_ID,
            targetType: 'generic',
            titleKey: 'ui.munchkin_mages_charm_target_title',
            responseValidationMode: 'live',
            autoResolveIfSingle: false,
        },
    );
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                sourceCardUid: ctx.cardUid,
                sourcePlayerId: ctx.playerId,
                sourceDefId: CHARM,
            },
        }),
    };
}

function embiggenOnPlay(ctx: AbilityContext): AbilityResult {
    const options = buildAllMinionOptions(ctx.state);
    if (options.length === 0) return { events: [] };
    const interaction = createSimpleChoice<MinionChoice>(
        `${EMBIGGEN_TARGET_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '大上一倍：选择一个仆从',
        options,
        {
            sourceId: EMBIGGEN_TARGET_SOURCE_ID,
            targetType: 'minion',
            titleKey: 'ui.munchkin_mages_embiggen_target_title',
            responseValidationMode: 'live',
            autoResolveIfSingle: false,
        },
    );
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                sourceCardUid: ctx.cardUid,
                sourcePlayerId: ctx.playerId,
                sourceDefId: EMBIGGEN,
            },
        }),
    };
}

function massSummoningOnPlay(ctx: AbilityContext): AbilityResult {
    return {
        events: buildMonsterPlayEvents(
            ctx.state,
            ctx.playerId,
            ctx.state.bases.map((_base, baseIndex) => baseIndex),
            MASS_SUMMONING,
            ctx.now,
        ),
    };
}

function portalToBeyondTalent(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.baseIndex;
    if (baseIndex === undefined || !ctx.state.monsterDeck?.length) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    }
    const matchState = buildDiscardCostInteraction(
        ctx,
        PORTAL_TO_BEYOND_DISCARD_SOURCE_ID,
        'ui.munchkin_mages_portal_to_beyond_discard_title',
        PORTAL_TO_BEYOND,
        true,
    );
    return matchState
        ? { events: [], matchState }
        : { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
}

function recoverArcaneWisdomOnPlay(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const sourceStillInHand = player?.hand.some(card => card.uid === ctx.cardUid && card.defId === RECOVER_ARCANE_WISDOM) ?? false;
    const handAfterSourceLeaves = Math.max(0, (player?.hand.length ?? 0) - (sourceStillInHand ? 1 : 0));
    const drawCount = Math.max(0, 5 - handAfterSourceLeaves);
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, drawCount, ctx.random, ctx.now) };
}

function someEnchantedEveningOnPlay(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player || player.hand.length === 0) return { events: [] };
    const interaction = createSimpleChoice<HandCardChoice>(
        `${SOME_ENCHANTED_EVENING_DISCARD_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '神奇的夜晚：选择任意数量的手牌弃掉',
        buildHandCardOptions(ctx.state, ctx.playerId),
        {
            sourceId: SOME_ENCHANTED_EVENING_DISCARD_SOURCE_ID,
            targetType: 'hand',
            titleKey: 'ui.munchkin_mages_some_enchanted_evening_discard_title',
            responseValidationMode: 'live',
            autoRefresh: 'hand',
            autoResolveIfSingle: false,
            multi: { min: 0, max: player.hand.length },
        },
    );
    interaction.data.optionsGenerator = latestState =>
        buildHandCardOptions(latestState.core as SmashUpCore, ctx.playerId);
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                sourceCardUid: ctx.cardUid,
                sourcePlayerId: ctx.playerId,
                sourceDefId: SOME_ENCHANTED_EVENING,
            },
        }),
    };
}

function getSelectedHandCards(state: SmashUpCore, playerId: string, value: unknown): CardInstance[] {
    const choices = (Array.isArray(value) ? value : [value]) as HandCardChoice[];
    const selectedUids = new Set(choices.map(choice => choice?.cardUid).filter((uid): uid is string => Boolean(uid)));
    return (state.players[playerId]?.hand ?? []).filter(card => selectedUids.has(card.uid));
}

function isSourceCardValid(state: SmashUpCore, data: CostInteractionData, playerId: string): boolean {
    if (data.sourcePlayerId !== playerId || !data.sourceCardUid || !data.sourceDefId) return false;
    if (data.sourceBaseIndex !== undefined) {
        const base = state.bases[data.sourceBaseIndex];
        return base?.minions.some(minion =>
            minion.uid === data.sourceCardUid
            && minion.defId === data.sourceDefId
            && minion.controller === playerId,
        )
            || base?.ongoingActions.some(action =>
                action.uid === data.sourceCardUid
                && action.defId === data.sourceDefId
                && action.ownerId === playerId,
            )
            || false;
    }
    return state.players[playerId]?.discard.some(card =>
        card.uid === data.sourceCardUid && card.defId === data.sourceDefId,
    ) ?? false;
}

function resolveDiscardCost(
    state: SmashUpCore,
    playerId: string,
    value: unknown,
    data: CostInteractionData | undefined,
    drawCount: number,
    sourceDefId: string,
    timestamp: number,
    random: AbilityContext['random'],
): SmashUpEvent[] {
    if (!data || !isSourceCardValid(state, data, playerId)) return [];
    const cost = getSelectedHandCard(state, playerId, value);
    if (!cost) return [];
    return [
        {
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: { playerId, cardUids: [cost.uid] },
            timestamp,
        },
        ...buildStandardDrawEvents(state, playerId, drawCount, random, timestamp),
    ];
}

export function registerMunchkinMagesAbilities(): void {
    registerAbility(BLASTER_MASTER, 'talent', blasterMasterTalent);
    registerAbility(HAPPY_ZAPPER, 'talent', happyZapperTalent);
    registerAbility(HAPPY_ZAPPER, 'special', happyZapperTalent);
    registerAbility(WAND_WHIZ, 'onPlay', wandWhizOnPlay);
    registerAbility(SCROLL_SHUFFLER, 'onPlay', scrollShufflerOnPlay);
    registerAbility(CHARM, 'onPlay', charmOnPlay);
    registerAbility(EMBIGGEN, 'onPlay', embiggenOnPlay);
    registerAbility(MASS_SUMMONING, 'onPlay', massSummoningOnPlay);
    registerAbility(PORTAL_TO_BEYOND, 'talent', portalToBeyondTalent);
    registerAbility(RECOVER_ARCANE_WISDOM, 'onPlay', recoverArcaneWisdomOnPlay);
    registerAbility(SOME_ENCHANTED_EVENING, 'onPlay', someEnchantedEveningOnPlay);
    registerAbility(SPEED_READING, 'onPlay', speedReadingOnPlay);
    registerAbility(ZZZZZAP, 'onPlay', zzzzzapOnPlay);
}

function dimensionDoorsOnMinionPlayed(ctx: BaseAbilityContext): BaseAbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!ctx.matchState || !player || player.hand.length === 0) return { events: [] };
    const interaction = createSimpleChoice<HandCardChoice & { skip?: boolean }>(
        `${BASE_DIMENSION_DOORS_SOURCE_ID}_${ctx.baseIndex}_${ctx.now}`,
        ctx.playerId,
        '次元之门：弃一张牌来额外打出一个随从',
        [
            createSkipOption('不额外打出', 'ui.munchkin_mages_base_dimension_doors_skip'),
            ...buildHandCardOptions(ctx.state, ctx.playerId),
        ],
        {
            sourceId: BASE_DIMENSION_DOORS_SOURCE_ID,
            targetType: 'hand',
            titleKey: 'ui.munchkin_mages_base_dimension_doors_title',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
            autoRefresh: 'hand',
        },
    );
    interaction.data.optionsGenerator = latestState => [
        createSkipOption('不额外打出', 'ui.munchkin_mages_base_dimension_doors_skip'),
        ...buildHandCardOptions(latestState.core as SmashUpCore, ctx.playerId),
    ];
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                sourceBaseIndex: ctx.baseIndex,
                sourcePlayerId: ctx.playerId,
            },
        }),
    };
}

function magesTowerOnMinionPlayed(ctx: BaseAbilityContext): BaseAbilityResult {
    if (!ctx.matchState) return { events: [] };
    const interaction = createSimpleChoice<{ draw?: boolean }>(
        `${BASE_MAGES_TOWER_SOURCE_ID}_${ctx.baseIndex}_${ctx.now}`,
        ctx.playerId,
        '法师之塔：是否抽一张牌',
        [
            { id: 'draw', label: '抽一张牌', labelKey: 'ui.munchkin_mages_base_mages_tower_draw_option', value: { draw: true }, displayMode: 'button' },
            createSkipOption('不抽牌', 'ui.munchkin_mages_base_mages_tower_skip'),
        ],
        {
            sourceId: BASE_MAGES_TOWER_SOURCE_ID,
            targetType: 'button',
            titleKey: 'ui.munchkin_mages_base_mages_tower_title',
            autoResolveIfSingle: false,
        },
    );
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                sourceBaseIndex: ctx.baseIndex,
                sourcePlayerId: ctx.playerId,
            },
        }),
    };
}

export function registerMunchkinMagesBaseAbilities(): void {
    registerBaseAbility(BASE_DIMENSION_DOORS, 'onMinionPlayed', dimensionDoorsOnMinionPlayed, {
        canTrigger: ctx => Boolean(ctx.minionUid)
            && (ctx.state.players[ctx.playerId]?.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0) === 1,
    });
    registerBaseAbility(BASE_MAGES_TOWER, 'onMinionPlayed', magesTowerOnMinionPlayed, {
        canTrigger: ctx => Boolean(ctx.minionUid),
    });
}

export function registerMunchkinMagesInteractionHandlers(): void {
    registerInteractionHandler(BLASTER_MASTER_DISCARD_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as CostInteractionData | undefined;
        const cost = getSelectedHandCard(state.core, playerId, value);
        if (!data || !isSourceCardValid(state.core, data, playerId) || !cost) return { state, events: [] };

        const options = buildMinionOptions(state.core, 2, playerId, BLASTER_MASTER);
        if (options.length === 0) return { state, events: [] };
        const interaction = createSimpleChoice<MinionChoice>(
            `${BLASTER_MASTER_TARGET_SOURCE_ID}_${data.sourceCardUid}_${timestamp}`,
            playerId,
            '爆破大师：选择力量2或更少的仆从',
            options,
            {
                sourceId: BLASTER_MASTER_TARGET_SOURCE_ID,
                targetType: 'minion',
                titleKey: 'ui.munchkin_mages_blaster_master_target_title',
                responseValidationMode: 'live',
                autoRefresh: 'field',
                displayCard: { defId: BLASTER_MASTER, cardUid: data.sourceCardUid },
            },
        );
        interaction.data.optionsGenerator = latestState =>
            buildMinionOptions(latestState.core as SmashUpCore, 2, playerId, BLASTER_MASTER);
        return {
            state: queueInteraction(state, {
                ...interaction,
                data: {
                    ...interaction.data,
                    sourceCardUid: data.sourceCardUid,
                    sourcePlayerId: data.sourcePlayerId,
                    ...(data.sourceBaseIndex !== undefined ? { sourceBaseIndex: data.sourceBaseIndex } : {}),
                    sourceDefId: data.sourceDefId,
                    costCardUid: cost.uid,
                },
            }),
            events: [],
        };
    });

    registerInteractionHandler(BLASTER_MASTER_TARGET_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as CostInteractionData & { costCardUid?: string };
        if (!data.costCardUid || !isSourceCardValid(state.core, data, playerId)) return { state, events: [] };
        const cost = state.core.players[playerId]?.hand.find(card => card.uid === data.costCardUid);
        const choice = value as MinionChoice | undefined;
        const target = choice?.baseIndex === undefined || !choice.minionUid
            ? undefined
            : state.core.bases[choice.baseIndex]?.minions.find(minion => minion.uid === choice.minionUid);
        if (!cost || !target || getEffectivePower(state.core, target, choice?.baseIndex ?? 0) > 2) {
            return { state, events: [] };
        }
        return {
            state,
            events: [
                { type: SU_EVENTS.CARDS_DISCARDED, payload: { playerId, cardUids: [cost.uid] }, timestamp },
                ...buildValidatedDestroyEvents(state.core, {
                    minionUid: target.uid,
                    minionDefId: target.defId,
                    fromBaseIndex: choice?.baseIndex ?? 0,
                    destroyerId: playerId,
                    reason: BLASTER_MASTER,
                    now: timestamp,
                    sourcePlayerId: playerId,
                    sourceCardUid: data.sourceCardUid,
                    sourceDefId: BLASTER_MASTER,
                    sourceControllerId: playerId,
                }),
            ],
        };
    });

    registerInteractionHandler(HAPPY_ZAPPER_DISCARD_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as CostInteractionData | undefined;
        const cost = getSelectedHandCard(state.core, playerId, value);
        if (!data || !isSourceCardValid(state.core, data, playerId) || !cost) return { state, events: [] };
        const source = data.sourceBaseIndex === undefined
            ? undefined
            : state.core.bases[data.sourceBaseIndex]?.minions.find(minion => minion.uid === data.sourceCardUid);
        if (!source) return { state, events: [] };
        return {
            state,
            events: [
                { type: SU_EVENTS.CARDS_DISCARDED, payload: { playerId, cardUids: [cost.uid] }, timestamp },
                addTempPower(source.uid, data.sourceBaseIndex, 2, HAPPY_ZAPPER, timestamp, {
                    sourcePlayerId: playerId,
                    sourceCardUid: data.sourceCardUid,
                    sourceDefId: HAPPY_ZAPPER,
                    sourceControllerId: playerId,
                    sourceBaseIndex: data.sourceBaseIndex,
                }),
            ],
        };
    });

    const registerDrawCostHandler = (sourceId: string, sourceDefId: string, drawCount: number) => {
        registerInteractionHandler(sourceId, (state, playerId, value, interactionData, random, timestamp) => ({
            state,
            events: resolveDiscardCost(
                state.core,
                playerId,
                value,
                interactionData as CostInteractionData | undefined,
                drawCount,
                sourceDefId,
                timestamp,
                random,
            ),
        }));
    };
    registerDrawCostHandler(SCROLL_SHUFFLER_DISCARD_SOURCE_ID, SCROLL_SHUFFLER, 1);
    registerDrawCostHandler(SPEED_READING_DISCARD_SOURCE_ID, SPEED_READING, 3);

    registerInteractionHandler(ZZZZZAP_DISCARD_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as CostInteractionData | undefined;
        const cost = getSelectedHandCard(state.core, playerId, value);
        if (!data || !isSourceCardValid(state.core, data, playerId) || !cost) return { state, events: [] };
        const options = buildMinionOptions(state.core, 3, playerId, ZZZZZAP);
        if (options.length === 0) return { state, events: [] };
        const interaction = createSimpleChoice<MinionChoice>(
            `${ZZZZZAP_TARGET_SOURCE_ID}_${data.sourceCardUid}_${timestamp}`,
            playerId,
            '快速攻击！：选择力量3或更少的仆从',
            options,
            {
                sourceId: ZZZZZAP_TARGET_SOURCE_ID,
                targetType: 'minion',
                titleKey: 'ui.munchkin_mages_zzzzzap_target_title',
                responseValidationMode: 'live',
                autoRefresh: 'field',
                displayCard: { defId: ZZZZZAP, cardUid: data.sourceCardUid },
            },
        );
        interaction.data.optionsGenerator = latestState =>
            buildMinionOptions(latestState.core as SmashUpCore, 3, playerId, ZZZZZAP);
        return {
            state: queueInteraction(state, {
                ...interaction,
                data: {
                    ...interaction.data,
                    sourceCardUid: data.sourceCardUid,
                    sourcePlayerId: data.sourcePlayerId,
                    ...(data.sourceBaseIndex !== undefined ? { sourceBaseIndex: data.sourceBaseIndex } : {}),
                    sourceDefId: data.sourceDefId,
                    costCardUid: cost.uid,
                },
            }),
            events: [],
        };
    });

    registerInteractionHandler(ZZZZZAP_TARGET_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as CostInteractionData & { costCardUid?: string };
        if (!data.costCardUid || !isSourceCardValid(state.core, data, playerId)) return { state, events: [] };
        const cost = state.core.players[playerId]?.hand.find(card => card.uid === data.costCardUid);
        const choice = value as MinionChoice | undefined;
        const target = choice?.baseIndex === undefined || !choice.minionUid
            ? undefined
            : state.core.bases[choice.baseIndex]?.minions.find(minion => minion.uid === choice.minionUid);
        if (!cost || !target || getEffectivePower(state.core, target, choice?.baseIndex ?? 0) > 3) {
            return { state, events: [] };
        }
        return {
            state,
            events: [
                { type: SU_EVENTS.CARDS_DISCARDED, payload: { playerId, cardUids: [cost.uid] }, timestamp },
                ...buildValidatedDestroyEvents(state.core, {
                    minionUid: target.uid,
                    minionDefId: target.defId,
                    fromBaseIndex: choice?.baseIndex ?? 0,
                    destroyerId: playerId,
                    reason: ZZZZZAP,
                    now: timestamp,
                    sourcePlayerId: playerId,
                    sourceCardUid: data.sourceCardUid,
                    sourceDefId: ZZZZZAP,
                    sourceControllerId: playerId,
                }),
            ],
        };
    });

    registerInteractionHandler(WAND_WHIZ_DISCARD_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as CostInteractionData | undefined;
        const cost = getSelectedHandCard(state.core, playerId, value);
        if (!data || !isSourceCardValid(state.core, data, playerId) || !cost) return { state, events: [] };
        const interaction = createSimpleChoice<ExtraPlayModeChoice>(
            `${WAND_WHIZ_MODE_SOURCE_ID}_${data.sourceCardUid}_${timestamp}`,
            playerId,
            '魔杖天才：选择额外出牌类型',
            [
                { id: 'minion', label: '额外随从', labelKey: 'ui.munchkin_mages_wand_whiz_minion_option', value: { mode: 'minion' }, displayMode: 'button' },
                { id: 'action', label: '额外行动', labelKey: 'ui.munchkin_mages_wand_whiz_action_option', value: { mode: 'action' }, displayMode: 'button' },
            ],
            {
                sourceId: WAND_WHIZ_MODE_SOURCE_ID,
                targetType: 'button',
                titleKey: 'ui.munchkin_mages_wand_whiz_mode_title',
                autoResolveIfSingle: false,
            },
        );
        return {
            state: queueInteraction(state, {
                ...interaction,
                data: {
                    ...interaction.data,
                    sourceCardUid: data.sourceCardUid,
                    sourcePlayerId: data.sourcePlayerId,
                    ...(data.sourceBaseIndex !== undefined ? { sourceBaseIndex: data.sourceBaseIndex } : {}),
                    sourceDefId: data.sourceDefId,
                    costCardUid: cost.uid,
                },
            }),
            events: [],
        };
    });

    registerInteractionHandler(WAND_WHIZ_MODE_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as CostInteractionData & { costCardUid?: string };
        const mode = (value as ExtraPlayModeChoice | undefined)?.mode;
        const cost = data.costCardUid
            ? state.core.players[playerId]?.hand.find(card => card.uid === data.costCardUid)
            : undefined;
        if (!cost || !mode || !isSourceCardValid(state.core, data, playerId)) return { state, events: [] };
        return {
            state,
            events: [
                { type: SU_EVENTS.CARDS_DISCARDED, payload: { playerId, cardUids: [cost.uid] }, timestamp },
                mode === 'minion'
                    ? grantExtraMinion(playerId, WAND_WHIZ, timestamp, undefined, { playTiming: 'banked' })
                    : grantExtraAction(playerId, WAND_WHIZ, timestamp, { playTiming: 'banked' }),
            ],
        };
    });

    registerInteractionHandler(CHARM_TARGET_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as CostInteractionData | undefined;
        const choice = value as MonsterChoice | undefined;
        if (!data || !isSourceCardValid(state.core, data, playerId) || choice?.baseIndex === undefined || !choice.monsterUid) {
            return { state, events: [] };
        }
        const monster = state.core.bases[choice.baseIndex]?.monsters?.find(candidate => candidate.uid === choice.monsterUid);
        if (!monster || monster.controllerId !== undefined) return { state, events: [] };
        return {
            state,
            events: [{
                type: SU_EVENTS.MUNCHKIN_MONSTER_CONTROL_CHANGED,
                payload: {
                    playerId,
                    baseIndex: choice.baseIndex,
                    monsterUid: monster.uid,
                    toControllerId: playerId,
                    temporaryUntilTurnEnd: true,
                    reason: CHARM,
                },
                timestamp,
            }],
        };
    });

    registerInteractionHandler(EMBIGGEN_TARGET_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as CostInteractionData | undefined;
        const choice = value as MinionChoice | undefined;
        if (!data || !isSourceCardValid(state.core, data, playerId) || choice?.baseIndex === undefined || !choice.minionUid) {
            return { state, events: [] };
        }
        const target = state.core.bases[choice.baseIndex]?.minions.find(minion => minion.uid === choice.minionUid);
        const handOptions = buildHandCardOptions(state.core, playerId);
        if (!target || handOptions.length === 0) return { state, events: [] };
        const interaction = createSimpleChoice<HandCardChoice>(
            `${EMBIGGEN_DISCARD_SOURCE_ID}_${data.sourceCardUid}_${timestamp}`,
            playerId,
            '大上一倍：选择任意数量的手牌弃掉',
            handOptions,
            {
                sourceId: EMBIGGEN_DISCARD_SOURCE_ID,
                targetType: 'hand',
                titleKey: 'ui.munchkin_mages_embiggen_discard_title',
                responseValidationMode: 'live',
                autoRefresh: 'hand',
                autoResolveIfSingle: false,
                multi: { min: 0, max: handOptions.length },
            },
        );
        interaction.data.optionsGenerator = latestState =>
            buildHandCardOptions(latestState.core as SmashUpCore, playerId);
        return {
            state: queueInteraction(state, {
                ...interaction,
                data: {
                    ...interaction.data,
                    sourceCardUid: data.sourceCardUid,
                    sourcePlayerId: data.sourcePlayerId,
                    sourceDefId: data.sourceDefId,
                    costTargetMinionUid: target.uid,
                    costTargetBaseIndex: choice.baseIndex,
                },
            }),
            events: [],
        };
    });

    registerInteractionHandler(EMBIGGEN_DISCARD_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as CostInteractionData & {
            costTargetMinionUid?: string;
            costTargetBaseIndex?: number;
        };
        if (!isSourceCardValid(state.core, data, playerId)
            || !data.costTargetMinionUid
            || data.costTargetBaseIndex === undefined) {
            return { state, events: [] };
        }
        const target = state.core.bases[data.costTargetBaseIndex]?.minions.find(minion => minion.uid === data.costTargetMinionUid);
        const selected = getSelectedHandCards(state.core, playerId, value);
        if (!target) return { state, events: [] };
        const events: SmashUpEvent[] = [];
        if (selected.length > 0) {
            events.push({ type: SU_EVENTS.CARDS_DISCARDED, payload: { playerId, cardUids: selected.map(card => card.uid) }, timestamp });
            events.push(addTempPower(target.uid, data.costTargetBaseIndex, selected.length, EMBIGGEN, timestamp, {
                sourcePlayerId: playerId,
                sourceCardUid: data.sourceCardUid,
                sourceDefId: EMBIGGEN,
                sourceControllerId: playerId,
                sourceBaseIndex: data.costTargetBaseIndex,
            }));
        }
        return { state, events };
    });

    registerInteractionHandler(SOME_ENCHANTED_EVENING_DISCARD_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as CostInteractionData | undefined;
        if (!data || !isSourceCardValid(state.core, data, playerId)) return { state, events: [] };
        const selected = getSelectedHandCards(state.core, playerId, value);
        if (selected.length === 0) return { state, events: [] };
        const events: SmashUpEvent[] = [
            { type: SU_EVENTS.CARDS_DISCARDED, payload: { playerId, cardUids: selected.map(card => card.uid) }, timestamp },
        ];
        for (const _card of selected) {
            events.push(grantExtraMinion(playerId, SOME_ENCHANTED_EVENING, timestamp, undefined, {
                powerMax: 3,
                playTiming: 'immediate',
            }));
        }
        return { state, events };
    });

    registerInteractionHandler(PORTAL_TO_BEYOND_DISCARD_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as CostInteractionData | undefined;
        const cost = getSelectedHandCard(state.core, playerId, value);
        if (!data || !isSourceCardValid(state.core, data, playerId) || !cost || data.sourceBaseIndex === undefined) {
            return { state, events: [] };
        }
        return {
            state,
            events: [
                { type: SU_EVENTS.CARDS_DISCARDED, payload: { playerId, cardUids: [cost.uid] }, timestamp },
                ...buildMonsterPlayEvents(state.core, playerId, [data.sourceBaseIndex], PORTAL_TO_BEYOND, timestamp),
            ],
        };
    });

    registerInteractionHandler(BASE_DIMENSION_DOORS_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as { sourceBaseIndex?: number; sourcePlayerId?: string } | undefined;
        if (!data || data.sourcePlayerId !== playerId || data.sourceBaseIndex === undefined) return { state, events: [] };
        if (state.core.bases[data.sourceBaseIndex]?.defId !== BASE_DIMENSION_DOORS) return { state, events: [] };
        const choice = value as HandCardChoice & { skip?: boolean } | undefined;
        if (choice?.skip) return { state, events: [] };
        const cost = getSelectedHandCard(state.core, playerId, value);
        if (!cost) return { state, events: [] };
        return {
            state,
            events: [
                { type: SU_EVENTS.CARDS_DISCARDED, payload: { playerId, cardUids: [cost.uid] }, timestamp },
                grantExtraMinion(playerId, BASE_DIMENSION_DOORS, timestamp, data.sourceBaseIndex, { playTiming: 'banked' }),
            ],
        };
    });

    registerInteractionHandler(BASE_MAGES_TOWER_SOURCE_ID, (state, playerId, value, interactionData, random, timestamp) => {
        const data = interactionData as { sourceBaseIndex?: number; sourcePlayerId?: string } | undefined;
        const choice = value as { draw?: boolean } | undefined;
        if (!data || data.sourcePlayerId !== playerId || data.sourceBaseIndex === undefined || !choice?.draw) {
            return { state, events: [] };
        }
        if (state.core.bases[data.sourceBaseIndex]?.defId !== BASE_MAGES_TOWER) return { state, events: [] };
        return { state, events: buildStandardDrawEvents(state.core, playerId, 1, random, timestamp) };
    });
}
