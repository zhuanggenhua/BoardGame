/**
 * 大杀四方 - 食人花派系能力
 *
 * 主题：额外出随从、搜索牌库、力量修正
 */

import { registerAbilityProgram, registerSimpleAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    grantContextualExtraMinion, grantExtraMinion, buildValidatedDestroyEvents,
    buildMinionTargetOptions, buildAbilityFeedback,
    buildStandardDrawEvents,
    addTempPower,
} from '../domain/abilityHelpers';
import { getMinionTargetBlockInfo } from '../domain/effectSemantics';
import { buildOngoingDetachedEvent } from '../domain/ongoingDetach';
import { SU_EVENTS } from '../domain/types';
import type {
    SmashUpEvent, CardsDrawnEvent, SmashUpCore,
    DeckReorderedEvent, MinionCardDef,
    MinionPlayedEvent, BreakpointModifiedEvent, MinionMetadataUpdatedEvent, CardInstance,
} from '../domain/types';
import { registerPowerModifier } from '../domain/ongoingModifiers';
import { registerProtection, registerTrigger } from '../domain/ongoingEffects';
import type { ProtectionCheckContext, TriggerContext, TriggerResult } from '../domain/ongoingEffects';
import { getCardDef, getMinionDef, getBaseDef } from '../data/cards';
import type { InteractionDescriptor, PromptOption } from '../../../engine/systems/InteractionSystem';
import type { MatchState, PlayerId } from '../../../engine/types';
import {
    createAbilityRuntimeSimpleChoice,
    createBranchProgram,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';

type DeckSearchOptionValue = { cardUid: string; defId: string } | { skip: true };

type KillerPlantPromptContext = {
    core: SmashUpCore;
    matchState?: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
};

type KillerPlantDeckSearchCandidate = {
    cardUid: string;
    defId: string;
    power: number;
    label: string;
};

type KillerPlantDeckSearchContext = KillerPlantPromptContext & {
    baseIndex: number;
    deck: CardInstance[];
    eligible: KillerPlantDeckSearchCandidate[];
};

type KillerPlantBuddingCandidate = {
    uid: string;
    defId: string;
    baseIndex: number;
    label: string;
};

type KillerPlantBuddingContext = KillerPlantPromptContext & {
    candidates: KillerPlantBuddingCandidate[];
};

type KillerPlantBuddingChoice = {
    minionUid?: string;
    baseIndex?: number;
    __cancel__?: true;
};

const getSproutSharedDecks = (ctx: TriggerContext): Map<string, CardInstance[]> => {
    const holder = ctx.triggerSharedState ?? {};
    if (!ctx.triggerSharedState) {
        ctx.triggerSharedState = holder;
    }
    const existing = (holder as { killerPlantSproutDecks?: Map<string, CardInstance[]> }).killerPlantSproutDecks;
    if (existing) return existing;
    const deckMap = new Map<string, CardInstance[]>();
    (holder as { killerPlantSproutDecks?: Map<string, CardInstance[]> }).killerPlantSproutDecks = deckMap;
    return deckMap;
};

const isSkipSelection = (value: unknown): value is { skip: true } => (
    typeof value === 'object' && value !== null && 'skip' in value
);

const isCancelSelection = (value: unknown): value is { __cancel__: true } => (
    typeof value === 'object' && value !== null && '__cancel__' in value
);

const getDeckSearchSelection = (value: unknown): { cardUid: string; defId: string } | null => {
    if (typeof value !== 'object' || value === null) {
        return null;
    }
    const record = value as { cardUid?: unknown; defId?: unknown };
    if (typeof record.cardUid !== 'string' || typeof record.defId !== 'string') {
        return null;
    }
    return { cardUid: record.cardUid, defId: record.defId };
};

function attachOptionsGenerator<T>(
    interaction: InteractionDescriptor<T>,
    optionsGenerator: (state: MatchState<SmashUpCore>) => unknown[],
): InteractionDescriptor<T> {
    return {
        ...interaction,
        data: {
            ...(interaction.data ?? {}),
            optionsGenerator,
        },
    };
}

function buildKillerPlantDeckSearchCandidates(
    deck: CardInstance[],
    maxPower: number,
): KillerPlantDeckSearchCandidate[] {
    return deck
        .filter((card) => {
            if (card.type !== 'minion') return false;
            const def = getMinionDef(card.defId);
            return def !== undefined && def.power <= maxPower;
        })
        .map((card) => {
            const def = getMinionDef(card.defId);
            return {
                cardUid: card.uid,
                defId: card.defId,
                power: def?.power ?? 0,
                label: `${def?.name ?? card.defId} (力量 ${def?.power ?? '?'})`,
            };
        });
}

function buildKillerPlantDeckSearchOptions(
    eligible: KillerPlantDeckSearchCandidate[],
    options?: { includeSkip?: boolean; skipLabel?: string },
): PromptOption<DeckSearchOptionValue>[] {
    const cardOptions: PromptOption<DeckSearchOptionValue>[] = eligible.map((card, index) => ({
        id: `card-${index}`,
        label: card.label,
        value: { cardUid: card.cardUid, defId: card.defId },
        displayMode: 'card' as const,
    }));
    if (!options?.includeSkip) {
        return cardOptions;
    }
    return [
        ...cardOptions,
        {
            id: 'skip',
            label: options.skipLabel ?? '跳过',
            labelKey: 'ui.skip',
            value: { skip: true },
            displayMode: 'button' as const,
        },
    ];
}

function buildKillerPlantDeckSearchResolutionEvents(params: {
    core: SmashUpCore;
    deck: CardInstance[];
    playerId: PlayerId;
    selection: { cardUid: string; defId: string };
    baseIndex: number;
    abilitySourceId: 'killer_plant_sprout' | 'killer_plant_venus_man_trap';
    timestamp: number;
}): SmashUpEvent[] {
    const { core, deck, playerId, selection, baseIndex, abilitySourceId, timestamp } = params;
    const inDeck = deck.some((card) => card.uid === selection.cardUid);
    if (!inDeck) {
        return [
            buildDeckReshuffle({ deck }, playerId, [], timestamp),
            buildAbilityFeedback(playerId, 'feedback.deck_search_no_match', timestamp),
        ];
    }

    const def = getMinionDef(selection.defId);
    const power = def?.power ?? 0;
    return [
        {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId, count: 1, cardUids: [selection.cardUid] },
            timestamp,
        } as CardsDrawnEvent,
        grantExtraMinion(playerId, abilitySourceId, timestamp),
        {
            type: SU_EVENTS.MINION_PLAYED,
            payload: {
                playerId,
                cardUid: selection.cardUid,
                defId: selection.defId,
                baseIndex,
                baseDefId: core.bases[baseIndex]?.defId,
                power,
            },
            timestamp,
        } as MinionPlayedEvent,
        buildDeckReshuffle({ deck }, playerId, [selection.cardUid], timestamp),
    ];
}

function buildKillerPlantBuddingCandidates(core: SmashUpCore): KillerPlantBuddingCandidate[] {
    const candidates: KillerPlantBuddingCandidate[] = [];
    for (let i = 0; i < core.bases.length; i += 1) {
        for (const minion of core.bases[i].minions) {
            const def = getCardDef(minion.defId) as MinionCardDef | undefined;
            const baseDef = getBaseDef(core.bases[i].defId);
            candidates.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: i,
                label: `${def?.name ?? minion.defId} @ ${baseDef?.name ?? `基地 ${i + 1}`}`,
            });
        }
    }
    return candidates;
}

/** 急速生长?onPlay：额外打出一个随从*/
function killerPlantInstaGrow(ctx: AbilityContext): AbilityResult {
    return { events: [grantContextualExtraMinion(ctx, 'killer_plant_insta_grow')] };
}

/** 野生食人花 onPlay：打出回合 -2 力量（回合结束自动清零） */
function killerPlantWeedEater(ctx: AbilityContext): AbilityResult {
    // 使用临时力量修正（tempPowerModifier），回合结束时 TURN_STARTED 自动清零
    return {
        events: [addTempPower(
            ctx.cardUid,
            ctx.baseIndex,
            -2,
            'killer_plant_weed_eater',
            ctx.now,
        ) as SmashUpEvent],
    };
}

/** Weed Eater POD onPlay：POD 版是持续能力，打出时没有原版的 -2 力量结算。 */
function killerPlantWeedEaterPod(_ctx: AbilityContext): AbilityResult {
    return { events: [] };
}

// killer_plant_sleep_spores (ongoing) ?已通过 ongoingModifiers 系统实现力量修正?1力量的
// killer_plant_overgrowth (ongoing) ?已通过 ongoingModifiers 系统实现临界点修正
// killer_plant_entangled (ongoing) ?已通过 ongoingEffects 保护 + 触发系统实现

// ============================================================================
// ongoing 效果检查器
// ============================================================================

/**
 * deep_roots 保护检查：此基地上）?deep_roots 且目标随从属?deep_roots 拥有者时?
 * 不收回可被其他玩家移动或返回手牌
 */
function killerPlantDeepRootsChecker(ctx: ProtectionCheckContext): boolean {
    const base = ctx.state.bases[ctx.targetBaseIndex];
    if (!base) return false;
    return base.ongoingActions.some(action => {
        if (!action.defId.startsWith('killer_plant_deep_roots')) return false;
        const controllerId = (action.metadata?.sourceControllerId as PlayerId | undefined) ?? action.ownerId;
        // 只保护 deep_roots 控制者的随从，且只拦截对手的效果
        return controllerId === ctx.targetMinion.controller
            && ctx.sourcePlayerId !== ctx.targetMinion.controller;
    });
}

/**
 * water_lily 触发：回合开始时控制者抽1?
 */
function killerPlantWaterLilyTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.triggerMinionUid) {
        for (const base of ctx.state.bases) {
            const triggeredWaterLily = base.minions.find(minion =>
                minion.uid === ctx.triggerMinionUid && minion.defId.startsWith('killer_plant_water_lily'),
            );
            if (!triggeredWaterLily) continue;
            if (triggeredWaterLily.controller !== ctx.playerId) return [];

            return buildStandardDrawEvents(ctx.state, triggeredWaterLily.controller, 1, ctx.random, ctx.now);
        }
        return [];
    }

    // 规则：每回合只能使用一次浇花睡莲的能力（多张在场也只触发一次）
    for (const base of ctx.state.bases) {
        for (const m of base.minions) {
            if (!m.defId.startsWith('killer_plant_water_lily')) continue;
            if (m.controller !== ctx.playerId) continue;
            const events = buildStandardDrawEvents(ctx.state, m.controller, 1, ctx.random, ctx.now);
            if (events.length > 0) return events;
        }
    }
    return [];
}



/**
 * sprout 触发：控制者回合开始时消灭自身 + 搜索牌库力量≤3随从打出到此基地
 * 正确流程：消灭自身 + CARDS_DRAWN + grantExtraMinion + MINION_PLAYED(到sprout所在基地) + 洗牌
 * 多候选时创建交互让玩家选择
 */
export function killerPlantSproutTrigger(ctx: TriggerContext): TriggerResult {
    const events: SmashUpEvent[] = [];
    let matchState = ctx.matchState;
    const simulatedDecks = getSproutSharedDecks(ctx);
    const triggerUid = ctx.triggerMinionUid ?? ctx.sourceCardUid;
    if (triggerUid) {
        const baseIndices = ctx.sourceBaseIndex !== undefined
            ? [ctx.sourceBaseIndex]
            : ctx.state.bases.map((_base, index) => index);
        for (const i of baseIndices) {
            const targetSprout = ctx.state.bases[i].minions.find(minion =>
                minion.uid === triggerUid && minion.defId.startsWith('killer_plant_sprout'),
            );
            if (!targetSprout || targetSprout.controller !== ctx.playerId) continue;

            const sproutBaseIndex = i;
            events.push(...buildValidatedDestroyEvents(ctx.state, {
                minionUid: targetSprout.uid,
                minionDefId: targetSprout.defId,
                fromBaseIndex: sproutBaseIndex,
                destroyerId: targetSprout.controller,
                reason: 'killer_plant_sprout',
                now: ctx.now,
                sourcePlayerId: targetSprout.controller,
                sourceCardUid: targetSprout.uid,
                sourceDefId: targetSprout.defId,
                sourceControllerId: targetSprout.controller,
                sourceBaseIndex: sproutBaseIndex,
                sourceKind: 'nonAction',
            }));
            const player = ctx.state.players[targetSprout.controller];
            if (!player) return { events, matchState };
            const deck = simulatedDecks.get(targetSprout.controller) ?? [...player.deck];
            simulatedDecks.set(targetSprout.controller, deck);
            const eligible = buildKillerPlantDeckSearchCandidates(deck, 3);
            const result = executeAbilityProgram(killerPlantSproutProgram, {
                core: ctx.state,
                matchState,
                playerId: targetSprout.controller,
                now: ctx.now,
                baseIndex: sproutBaseIndex,
                deck,
                eligible,
            });
            if (result.events.some((event) => event.type === SU_EVENTS.MINION_PLAYED)) {
                simulatedDecks.set(targetSprout.controller, deck.filter((card) => card.uid !== eligible[0].cardUid));
            }
            events.push(...result.events);
            matchState = result.matchState;
            return { events, matchState };
        }
        return { events, matchState };
    }

    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        for (const m of base.minions) {
            if (!m.defId.startsWith('killer_plant_sprout')) continue;
            if (m.controller !== ctx.playerId) continue;
            // 记住 sprout 所在基地索引（消灭前）
            const sproutBaseIndex = i;
            // 消灭自身
            events.push(...buildValidatedDestroyEvents(ctx.state, {
                minionUid: m.uid,
                minionDefId: m.defId,
                fromBaseIndex: i,
                destroyerId: m.controller,
                reason: 'killer_plant_sprout',
                now: ctx.now,
                sourcePlayerId: m.controller,
                sourceCardUid: m.uid,
                sourceDefId: m.defId,
                sourceControllerId: m.controller,
                sourceBaseIndex: i,
                sourceKind: 'nonAction',
            }));
            // 搜索牌库中力量≤3的随从
            const player = ctx.state.players[m.controller];
            if (!player) continue;
            const deck = simulatedDecks.get(m.controller) ?? [...player.deck];
            simulatedDecks.set(m.controller, deck);
            const eligible = buildKillerPlantDeckSearchCandidates(deck, 3);
            const result = executeAbilityProgram(killerPlantSproutProgram, {
                core: ctx.state,
                matchState,
                playerId: m.controller,
                now: ctx.now,
                baseIndex: sproutBaseIndex,
                deck,
                eligible,
            });
            if (result.events.some((event) => event.type === SU_EVENTS.MINION_PLAYED)) {
                simulatedDecks.set(m.controller, deck.filter((card) => card.uid !== eligible[0].cardUid));
            }
            events.push(...result.events);
            matchState = result.matchState;
        }
    }
    return { events, matchState };
}

function canTriggerKillerPlantSprout(ctx: TriggerContext): boolean {
    const triggerUid = ctx.triggerMinionUid ?? ctx.sourceCardUid;
    if (!triggerUid) return false;
    const baseIndices = ctx.sourceBaseIndex !== undefined
        ? [ctx.sourceBaseIndex]
        : ctx.state.bases.map((_base, index) => index);
    return baseIndices.some(baseIndex =>
        ctx.state.bases[baseIndex]?.minions.some(minion =>
            minion.uid === triggerUid
            && minion.controller === ctx.playerId
            && minion.defId.startsWith('killer_plant_sprout'),
        ) ?? false,
    );
}


/**
 * choking_vines 触发：回合开始时消灭附着了?choking_vines 的随从
 */
function killerPlantChokingVinesTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.sourceCardUid) {
        for (let i = 0; i < ctx.state.bases.length; i++) {
            const base = ctx.state.bases[i];
            for (const m of base.minions) {
                const attached = m.attachedActions.find(a =>
                    a.uid === ctx.sourceCardUid && a.defId.startsWith('killer_plant_choking_vines'));
                if (!attached) continue;
                const attachedControllerId = (attached.metadata?.sourceControllerId as PlayerId | undefined) ?? attached.ownerId;
                if (attachedControllerId !== ctx.playerId) return [];
                return buildValidatedDestroyEvents(ctx.state, {
                    minionUid: m.uid,
                    minionDefId: m.defId,
                    fromBaseIndex: i,
                    destroyerId: attachedControllerId,
                    reason: 'killer_plant_choking_vines',
                    now: ctx.now,
                    sourcePlayerId: attachedControllerId,
                    sourceCardUid: attached.uid,
                    sourceDefId: attached.defId,
                    sourceControllerId: attachedControllerId,
                    sourceBaseIndex: i,
                });
            }
        }
        return [];
    }

    const events: SmashUpEvent[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        for (const m of base.minions) {
            const attached = m.attachedActions.find(a => a.defId.startsWith('killer_plant_choking_vines'));
            if (!attached) continue;
            const attachedControllerId = (attached.metadata?.sourceControllerId as PlayerId | undefined) ?? attached.ownerId;
            if (attachedControllerId !== ctx.playerId) continue;
            // 消灭附着的随从
            events.push(...buildValidatedDestroyEvents(ctx.state, {
                minionUid: m.uid,
                minionDefId: m.defId,
                fromBaseIndex: i,
                destroyerId: attachedControllerId,
                reason: 'killer_plant_choking_vines',
                now: ctx.now,
                sourcePlayerId: attachedControllerId,
                sourceCardUid: attached.uid,
                sourceDefId: attached.defId,
                sourceControllerId: attachedControllerId,
                sourceBaseIndex: i,
            }));
        }
    }
    return events;
}

// ============================================================================
// 新增能力实现
// ============================================================================

/**
 * 绽放 onPlay：额外打出至多三个同名随从
 */
function killerPlantBlossom(ctx: AbilityContext): AbilityResult {
    return {
        events: [
            grantContextualExtraMinion(ctx, 'killer_plant_blossom', undefined, { sameNameOnly: true }),
            grantContextualExtraMinion(ctx, 'killer_plant_blossom', undefined, { sameNameOnly: true }),
            grantContextualExtraMinion(ctx, 'killer_plant_blossom', undefined, { sameNameOnly: true }),
        ],
    };
}

function createKillerPlantVenusManTrapContext(ctx: AbilityContext): KillerPlantDeckSearchContext {
    const player = ctx.state.players[ctx.playerId];
    const deck = player?.deck ?? [];
    return {
        core: ctx.state,
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        baseIndex: ctx.baseIndex,
        deck,
        eligible: buildKillerPlantDeckSearchCandidates(deck, 2),
    };
}

function createKillerPlantBuddingContext(ctx: AbilityContext): KillerPlantBuddingContext {
    return {
        core: ctx.state,
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        candidates: buildKillerPlantBuddingCandidates(ctx.state),
    };
}

const killerPlantVenusManTrapPromptProgram = createPromptProgram<
    KillerPlantDeckSearchContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'killer_plant_venus_man_trap_search',
    buildInteraction: (context) => {
        if (!context.matchState) {
            throw new Error('killer_plant_venus_man_trap_search 缺少 matchState');
        }
        return attachOptionsGenerator(
            createAbilityRuntimeSimpleChoice(
                `killer_plant_venus_man_trap_search_${context.now}`,
                context.playerId,
                '维纳斯捕食者：从牌库中选择一个力量 2 或更低的随从打出',
                buildKillerPlantDeckSearchOptions(context.eligible),
                {
                    sourceId: 'killer_plant_venus_man_trap_search',
                    targetType: 'generic',
                    autoRefresh: 'deck',
                    responseValidationMode: 'live',
                    autoResolveIfSingle: false,
                    titleKey: 'ui.killer_plant_venus_man_trap_search_title',
                },
            ),
            (state) => buildKillerPlantDeckSearchOptions(
                buildKillerPlantDeckSearchCandidates(state.core.players[context.playerId]?.deck ?? [], 2),
            ),
        );
    },
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const selection = getDeckSearchSelection(value);
        if (!selection) return { events: [] };
        return {
            events: buildKillerPlantDeckSearchResolutionEvents({
                core: state.core,
                deck: state.core.players[playerId]?.deck ?? [],
                playerId,
                selection,
                baseIndex: context.baseIndex,
                abilitySourceId: 'killer_plant_venus_man_trap',
                timestamp,
            }),
        };
    },
});

const killerPlantVenusManTrapProgram = createBranchProgram<
    KillerPlantDeckSearchContext,
    SmashUpCore,
    SmashUpEvent
>({
    when: (context) => context.eligible.length === 0,
    then: createEffectProgram((context) => ({
        events: [
            buildDeckReshuffle({ deck: context.deck }, context.playerId, [], context.now),
            buildAbilityFeedback(context.playerId, 'feedback.deck_search_no_match', context.now),
        ],
    })),
    else: createBranchProgram({
        when: (context) => !context.matchState,
        then: createEffectProgram(() => ({ events: [] })),
        else: killerPlantVenusManTrapPromptProgram,
    }),
});

const killerPlantSproutPromptProgram = createPromptProgram<
    KillerPlantDeckSearchContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'killer_plant_sprout_search',
    buildInteraction: (context) => {
        if (!context.matchState) {
            throw new Error('killer_plant_sprout_search 缺少 matchState');
        }
        return attachOptionsGenerator(
            createAbilityRuntimeSimpleChoice(
                `killer_plant_sprout_search_${context.baseIndex}_${context.now}`,
                context.playerId,
                '嫩芽：从牌库中选择一个力量 3 或更低的随从打出（可跳过）',
                buildKillerPlantDeckSearchOptions(context.eligible, { includeSkip: true }),
                {
                    sourceId: 'killer_plant_sprout_search',
                    targetType: 'generic',
                    autoRefresh: 'deck',
                    responseValidationMode: 'live',
                    autoResolveIfSingle: false,
                    titleKey: 'ui.killer_plant_sprout_search_title',
                },
            ),
            (state) => buildKillerPlantDeckSearchOptions(
                buildKillerPlantDeckSearchCandidates(state.core.players[context.playerId]?.deck ?? [], 3),
                { includeSkip: true },
            ),
        );
    },
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        if (isSkipSelection(value)) {
            return {
                events: [
                    buildDeckReshuffle({ deck: state.core.players[playerId]?.deck ?? [] }, playerId, [], timestamp),
                    buildAbilityFeedback(playerId, 'feedback.deck_search_skipped', timestamp),
                ],
            };
        }
        const selection = getDeckSearchSelection(value);
        if (!selection) return { events: [] };
        return {
            events: buildKillerPlantDeckSearchResolutionEvents({
                core: state.core,
                deck: state.core.players[playerId]?.deck ?? [],
                playerId,
                selection,
                baseIndex: context.baseIndex,
                abilitySourceId: 'killer_plant_sprout',
                timestamp,
            }),
        };
    },
});

const killerPlantSproutProgram = createBranchProgram<
    KillerPlantDeckSearchContext,
    SmashUpCore,
    SmashUpEvent
>({
    when: (context) => context.eligible.length === 0,
    then: createEffectProgram((context) => ({
        events: [
            buildDeckReshuffle({ deck: context.deck }, context.playerId, [], context.now),
            buildAbilityFeedback(context.playerId, 'feedback.deck_search_no_match', context.now),
        ],
    })),
    else: createBranchProgram({
        when: (context) => !context.matchState,
        then: createEffectProgram(() => ({ events: [] })),
        else: killerPlantSproutPromptProgram,
    }),
});

const killerPlantBuddingPromptProgram = createPromptProgram<
    KillerPlantBuddingContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'killer_plant_budding_choose',
    buildInteraction: (context) => {
        if (!context.matchState) {
            throw new Error('killer_plant_budding_choose 缺少 matchState');
        }
        return attachOptionsGenerator(
            createAbilityRuntimeSimpleChoice(
                `killer_plant_budding_choose_${context.now}`,
                context.playerId,
                '出芽生殖：选择一个场上的随从',
                buildMinionTargetOptions(context.candidates, {
                    state: context.matchState.core,
                    sourcePlayerId: context.playerId,
                    effectType: 'destroy',
                }),
                {
                    sourceId: 'killer_plant_budding_choose',
                    targetType: 'minion',
                    titleKey: 'ui.killer_plant_budding_choose_title',
                    autoCancelOption: true,
                    autoRefresh: 'field',
                    responseValidationMode: 'live',
                },
            ),
            (state) => buildMinionTargetOptions(
                buildKillerPlantBuddingCandidates(state.core),
                { state: state.core, sourcePlayerId: context.playerId, effectType: 'destroy' },
            ),
        );
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        if (isCancelSelection(value)) {
            return { events: [] };
        }
        const choice = value as KillerPlantBuddingChoice | undefined;
        if (!choice?.minionUid) {
            return { events: [] };
        }

        let chosenDefId: string | null = null;
        for (const base of state.core.bases) {
            const found = base.minions.find((minion) => minion.uid === choice.minionUid);
            if (found) {
                chosenDefId = found.defId;
                break;
            }
        }
        if (!chosenDefId) {
            return { events: [] };
        }

        const deck = state.core.players[playerId]?.deck ?? [];
        const sameNameCard = deck.find((card) => card.defId === chosenDefId);
        if (!sameNameCard) {
            return {
                events: [
                    buildDeckReshuffle({ deck }, playerId, [], timestamp),
                    buildAbilityFeedback(playerId, 'feedback.deck_search_no_match', timestamp),
                ],
            };
        }
        return {
            events: [
                {
                    type: SU_EVENTS.CARDS_DRAWN,
                    payload: { playerId, count: 1, cardUids: [sameNameCard.uid] },
                    timestamp,
                } as CardsDrawnEvent,
                buildDeckReshuffle({ deck }, playerId, [sameNameCard.uid], timestamp),
            ],
        };
    },
});

const killerPlantBuddingProgram = createBranchProgram<
    KillerPlantBuddingContext,
    SmashUpCore,
    SmashUpEvent
>({
    when: (context) => context.candidates.length === 0,
    then: createEffectProgram(() => ({ events: [] })),
    else: killerPlantBuddingPromptProgram,
});

/** 注册食人花派系所有能力*/
export function registerKillerPlantAbilities(): void {
    // 急速生长（行动卡）：额外打出一个随从
    registerSimpleAbility('killer_plant_insta_grow', 'onPlay', killerPlantInstaGrow);
    // 野生食人花（随从）：打出回合-2力量
    registerSimpleAbility('killer_plant_weed_eater', 'onPlay', killerPlantWeedEater);
    // 金星捕蝇草（talent）：搜索牌库打出力量的随从
    registerAbilityProgram('killer_plant_venus_man_trap', 'talent', {
        program: killerPlantVenusManTrapProgram,
        createContext: createKillerPlantVenusManTrapContext,
        validateUse: (ctx) => {
            const player = ctx.state.players[ctx.playerId];
            const hasEligible = player.deck.some(card => {
                if (card.type !== 'minion') return false;
                const def = getMinionDef(card.defId);
                return def !== undefined && def.power <= 2;
            });
            return hasEligible ? null : '牌库中没有力量 2 或更低的随从';
        },
    });
    // 发芽（行动卡）：搜索牌库打出同名随从
    registerAbilityProgram('killer_plant_budding', 'onPlay', {
        program: killerPlantBuddingProgram,
        createContext: createKillerPlantBuddingContext,
    });
    // 绽放（行动卡）：额外打出3个随从
    registerSimpleAbility('killer_plant_blossom', 'onPlay', killerPlantBlossom);
    registerSimpleAbility('killer_plant_weed_eater_pod', 'onPlay', killerPlantWeedEaterPod);

    // === POD 专有逻辑 ===
    // 野生食人花 POD: 力量修正逻辑在 ongoingModifiers 中实现
    // 不需要 onPlay 效果，但需要注册它的 ID 以确保别名系统正确处理（如果需要覆盖）

    // === ongoing 效果注册 ===
    // deep_roots: 保护随从不收回被移动
    registerProtection('killer_plant_deep_roots', 'move', killerPlantDeepRootsChecker);
    // water_lily: 回合开始时控制者抽1?
    registerTrigger('killer_plant_water_lily', 'onTurnStart', killerPlantWaterLilyTrigger, {
        playerContext: 'sourceController',
    });
    registerTrigger('killer_plant_water_lily_pod', 'onTurnStart', killerPlantWaterLilyTrigger, {
        playerContext: 'sourceController',
    });
    // sprout: 回合开始时消灭自身 + 搜索打出随从
    registerTrigger('killer_plant_sprout', 'onTurnStart', killerPlantSproutTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        canTrigger: canTriggerKillerPlantSprout,
    });
    registerTrigger('killer_plant_sprout_pod', 'onTurnStart', killerPlantSproutTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        canTrigger: canTriggerKillerPlantSprout,
    });
    // choking_vines: 回合开始时消灭此基地上力量最低的随从
    registerTrigger('killer_plant_choking_vines', 'onTurnStart', killerPlantChokingVinesTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    // overgrowth: 回合开始时将本基地临界点降低到0（通过 tempBreakpointModifiers，回合结束自动清零）
    registerTrigger('killer_plant_overgrowth', 'onTurnStart', killerPlantOvergrowthTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    // entangled: 有己方随从的基地上的随从不收回可被移动?
    registerProtection('killer_plant_entangled', 'move', killerPlantEntangledChecker);
    // entangled: 控制者回合开始时消灭本卡
    registerTrigger('killer_plant_entangled', 'onTurnStart', killerPlantEntangledDestroyTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('killer_plant_entangled_pod', 'onTurnStart', killerPlantEntangledDestroyTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
    });

    // weed_eater_pod: 控制者回合开始后获得 +2 力量（通过 metadata 标记 + PowerModifier）
    registerTrigger('killer_plant_weed_eater_pod', 'onTurnStart', killerPlantWeedEaterPodTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
    });
}

/**
 * Weed Eater POD 触发：控制者回合开始时，若尚未激活则写入 metadata 标记。
 * 
 * 这里使用 `MINION_METADATA_UPDATED` 事件驱动 reducer 更新状态，避免直接突变 state。
 */
function killerPlantWeedEaterPodTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    const triggerUid = ctx.triggerMinionUid ?? ctx.sourceCardUid;
    if (triggerUid) {
        for (let baseIndex = 0; baseIndex < ctx.state.bases.length; baseIndex++) {
            const targetWeedEater = ctx.state.bases[baseIndex].minions.find(minion =>
                minion.uid === triggerUid && minion.defId === 'killer_plant_weed_eater_pod',
            );
            if (!targetWeedEater) continue;
            if (targetWeedEater.controller !== ctx.playerId) return [];
            if (targetWeedEater.metadata?.weedEaterEmpowered) return [];
            return [{
                type: SU_EVENTS.MINION_METADATA_UPDATED,
                payload: {
                    minionUid: targetWeedEater.uid,
                    baseIndex,
                    metadataUpdate: { weedEaterEmpowered: true },
                    reason: 'killer_plant_weed_eater_pod',
                },
                timestamp: ctx.now,
            } as MinionMetadataUpdatedEvent];
        }
        return [];
    }

    for (let baseIndex = 0; baseIndex < ctx.state.bases.length; baseIndex++) {
        const base = ctx.state.bases[baseIndex];
        for (const m of base.minions) {
            if (m.defId !== 'killer_plant_weed_eater_pod') continue;
            if (m.controller !== ctx.playerId) continue;
            if (m.metadata?.weedEaterEmpowered) continue;
            events.push({
                type: SU_EVENTS.MINION_METADATA_UPDATED,
                payload: {
                    minionUid: m.uid,
                    baseIndex,
                    metadataUpdate: { weedEaterEmpowered: true },
                    reason: 'killer_plant_weed_eater_pod',
                },
                timestamp: ctx.now,
            } as MinionMetadataUpdatedEvent);
        }
    }
    return events;
}

/** 注册食人花派系的持续力量修正 */
export function registerKillerPlantModifiers(): void {
    // Weed Eater POD：当其 metadata 标记被激活后，获得 +2 力量
    registerPowerModifier('killer_plant_weed_eater_pod', (ctx) => {
        return ctx.minion.metadata?.weedEaterEmpowered ? 2 : 0;
    });
}


// ============================================================================
// 藤蔓缠绕 ongoing 效果
// ============================================================================

// ============================================================================
// 牌库洗牌辅助
// ============================================================================

/** 构建牌库洗牌事件（排除已抽出的卡牌） */
function buildDeckReshuffle(
    player: { deck: { uid: string }[] },
    playerId: string,
    drawnUids: string[],
    now: number,
): DeckReorderedEvent {
    const drawnSet = new Set(drawnUids);
    const remaining = player.deck.filter(c => !drawnSet.has(c.uid)).map(c => c.uid);
    return {
        type: SU_EVENTS.DECK_REORDERED,
        payload: { playerId, deckUids: remaining },
        timestamp: now,
    };
}

/**
 * 过度生长触发：控制者回合开始时，将本基地临界点降低到0
 * 通过 BREAKPOINT_MODIFIED 事件写入 tempBreakpointModifiers（回合结束自动清零）
 */
export function killerPlantOvergrowthTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.sourceCardUid) {
        const candidateBases = ctx.sourceBaseIndex !== undefined
            ? [{ base: ctx.state.bases[ctx.sourceBaseIndex], baseIndex: ctx.sourceBaseIndex }]
            : ctx.state.bases.map((base, baseIndex) => ({ base, baseIndex }));
        for (const candidate of candidateBases) {
            const ongoing = candidate.base?.ongoingActions.find((action) =>
                action.uid === ctx.sourceCardUid && action.defId.startsWith('killer_plant_overgrowth'));
            if (!ongoing) continue;
            const ongoingControllerId = (ongoing.metadata?.sourceControllerId as PlayerId | undefined) ?? ongoing.ownerId;
            if (ongoingControllerId !== ctx.playerId) return [];
            const baseDef = candidate.base ? getBaseDef(candidate.base.defId) : undefined;
            if (!baseDef) return [];
            return [{
                type: SU_EVENTS.BREAKPOINT_MODIFIED,
                payload: {
                    baseIndex: candidate.baseIndex,
                    baseDefId: candidate.base.defId,
                    delta: -baseDef.breakpoint,
                    reason: 'killer_plant_overgrowth',
                },
                timestamp: ctx.now,
            } as BreakpointModifiedEvent];
        }
        return [];
    }

    const events: SmashUpEvent[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        // 统计属于当前回合玩家的过度生长张数（多张叠加）
        const count = base.ongoingActions.filter(
            a => a.defId.startsWith('killer_plant_overgrowth')
                && (((a.metadata?.sourceControllerId as PlayerId | undefined) ?? a.ownerId) === ctx.playerId)
        ).length;
        if (count === 0) continue;
        const baseDef = getBaseDef(base.defId);
        if (!baseDef) continue;
        // 每张降低一个完整临界点，总计降低 count * breakpoint
        const delta = -baseDef.breakpoint * count;
        events.push({
            type: SU_EVENTS.BREAKPOINT_MODIFIED,
            payload: { baseIndex: i, baseDefId: ctx.state.bases[i].defId, delta, reason: 'killer_plant_overgrowth' },
            timestamp: ctx.now,
        } as BreakpointModifiedEvent);
    }
    return events;
}

/** 藤蔓缠绕保护检查：有己方随从的基地上的所有随从不收回可被移动 */
function killerPlantEntangledChecker(ctx: ProtectionCheckContext): boolean {
    const base = ctx.state.bases[ctx.targetBaseIndex];
    if (!base) return false;

    return base.ongoingActions.some(action => {
        if (!action.defId.startsWith('killer_plant_entangled')) return false;

        const controllerId = (action.metadata?.sourceControllerId as PlayerId | undefined) ?? action.ownerId;
        const controllerHasMinion = base.minions.some(minion => minion.controller === controllerId);
        if (!controllerHasMinion) return false;

        // 一目了然：力量≤2的己方随从不受其他玩家卡牌影响。
        // borrowed ongoing 仍应按当前控制者判断“是否来自其他玩家”。
        return !getMinionTargetBlockInfo(ctx.state, ctx.targetMinion, ctx.targetBaseIndex, {
            sourcePlayerId: controllerId,
            sourceKind: 'nonAction',
            effectType: 'affect',
            mode: 'preview',
        }).blocked;
    });
}

/** 藤蔓缠绕触发：控制者回合开始时消灭本卡 */
function killerPlantEntangledDestroyTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        const entangled = ctx.sourceCardUid
            ? base.ongoingActions.find(a => a.uid === ctx.sourceCardUid && a.defId.startsWith('killer_plant_entangled'))
            : base.ongoingActions.find(a => a.defId.startsWith('killer_plant_entangled'));
        if (!entangled) continue;
        const controllerId = (entangled.metadata?.sourceControllerId as PlayerId | undefined) ?? entangled.ownerId;
        if (controllerId !== ctx.playerId) continue;
        events.push(buildOngoingDetachedEvent({
            cardUid: entangled.uid,
            defId: entangled.defId,
            ownerId: entangled.ownerId,
            reason: 'killer_plant_entangled_self_destruct',
            now: ctx.now,
        }));
    }
    return events;
}


