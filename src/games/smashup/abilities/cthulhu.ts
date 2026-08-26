/**
 * 大杀四方 - 克苏鲁之仆派系能力
 *
 * 主题：疯狂卡操控、弃牌堆回收、额外行动
 */

import { registerAbilityProgram, registerSimpleAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { SU_EVENTS } from '../domain/types';
import { MADNESS_CARD_DEF_ID } from '../domain/types';
import type {
    SmashUpEvent,
    VpAwardedEvent,
    MinionCardDef,
    BaseClearedEvent,
    BaseReplacedEvent,
    SmashUpCore,
} from '../domain/types';
import { getCardDef, getBaseDef } from '../data/cards';
import { matchesDefId } from '../domain/utils';
import {
    drawMadnessCards, grantContextualExtraAction,
    returnMadnessCard, getMinionPower,
    addTempPower, revealAndPickFromDeck,
    buildAbilityFeedback, buildActionMinionTargetOptions, buildPlayerTargetOptions,
    buildValidatedDestroyEvents,
    buildStandardDrawEvents,
    buildStandardDrawEventsFromRuntimeContext,
    findMinionOnBases,
} from '../domain/abilityHelpers';
import { registerTrigger } from '../domain/ongoingEffects';
import type { TriggerContext, TriggerResult } from '../domain/ongoingEffects';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import type { PromptOption } from '../../../engine/systems/InteractionSystem';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { getPlayerLabel } from '../domain/utils';

type CardChoiceValue = { cardUid: string; defId: string };
type MinionCardChoiceValue = CardChoiceValue & { minionDefId: string };
type SkipChoiceValue = { skip: true };
type MadnessActionChoiceValue = { action: 'draw' | 'return' };
type TargetPlayerChoiceValue = { targetPlayerId: string; madnessUid: string };
type CardUidSelection = { cardUid?: string };
type CthulhuPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
};
type CthulhuItBeginsAgainPromptContext = CthulhuPromptContext & { sourceCardUid: string };
type CthulhuMadnessUnleashedPromptContext = CthulhuPromptContext & { sourceCardUid: string };
type CthulhuMadnessUnleashedAfterDiscardContext = CthulhuPromptContext & {
    discardCount: number;
    random: RandomFn;
};
type SpecialMadnessPromptContext = CthulhuPromptContext & { cardUid: string };
type StarSpawnPromptContext = CthulhuPromptContext & { madnessUid: string };
type CthulhuChosenPromptTarget = {
    uid: string;
    defId: string;
    controller: PlayerId;
    baseIndex: number;
};
type CthulhuChosenPromptContext = {
    matchState: MatchState<SmashUpCore>;
    now: number;
    chosen: CthulhuChosenPromptTarget;
    remaining: CthulhuChosenPromptTarget[];
};

function normalizeChoiceArray<T extends Record<string, unknown>>(value: unknown): T[] {
    if (Array.isArray(value)) return value as T[];
    if (value && typeof value === 'object') return [value as T];
    return [];
}

function runtimeResultToTriggerResult(
    result: ReturnType<typeof executeAbilityProgram<unknown, SmashUpCore, SmashUpEvent>>,
    fallbackState: MatchState<SmashUpCore>,
): TriggerResult {
    return {
        events: result.events,
        matchState: result.matchState ?? fallbackState,
    };
}

function buildRecruitByForceOptions(
    core: SmashUpCore,
    playerId: PlayerId,
): PromptOption<MinionCardChoiceValue | SkipChoiceValue>[] {
    const player = core.players[playerId];
    const eligibleMinions = player.discard.filter((card) => {
        if (card.type !== 'minion') return false;
        const def = getCardDef(card.defId);
        return def?.type === 'minion' && (def as MinionCardDef).power <= 3;
    });

    return [
        ...eligibleMinions.map((card, index) => {
            const def = getCardDef(card.defId) as MinionCardDef | undefined;
            return {
                id: `minion-${index}`,
                label: `${def?.name ?? card.defId} (力量 ${def?.power ?? 0})`,
                value: { cardUid: card.uid, defId: card.defId, minionDefId: card.defId },
                _source: 'discard' as const,
                displayMode: 'card' as const,
            };
        }),
        {
            id: 'skip',
            label: '跳过',
            labelKey: 'ui.skip',
            value: { skip: true },
            displayMode: 'button' as const,
        },
    ];
}

function buildItBeginsAgainOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    sourceCardUid?: string,
): PromptOption<CardChoiceValue | SkipChoiceValue>[] {
    const player = core.players[playerId];
    const actionsInDiscard = player.discard.filter(
        card => card.type === 'action' && card.uid !== sourceCardUid,
    );
    return [
        ...actionsInDiscard.map((card, index) => ({
            id: `action-${index}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId },
            _source: 'discard' as const,
            displayMode: 'card' as const,
        })),
        {
            id: 'skip',
            label: '跳过',
            labelKey: 'ui.skip',
            value: { skip: true },
            displayMode: 'button' as const,
        },
    ];
}

function buildCorruptionPromptOptions(core: SmashUpCore, playerId: PlayerId) {
    const candidates: Array<{ uid: string; defId: string; baseIndex: number; label: string }> = [];
    for (let baseIndex = 0; baseIndex < core.bases.length; baseIndex++) {
        const base = core.bases[baseIndex];
        const baseName = getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`;
        for (const minion of base.minions) {
            const minionName = getCardDef(minion.defId)?.name ?? minion.defId;
            candidates.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${minionName} (力量 ${getMinionPower(core, minion, baseIndex)}) @ ${baseName}`,
            });
        }
    }
    return buildActionMinionTargetOptions(candidates, {
        state: core,
        sourcePlayerId: playerId,
        sourceDefId: 'cthulhu_corruption',
        effectType: 'destroy',
    }).map(option => ({
        ...option,
        displayMode: 'card' as const,
    }));
}

function buildMadnessUnleashedOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    sourceCardUid: string,
): PromptOption<CardChoiceValue | SkipChoiceValue>[] {
    const player = core.players[playerId];
    const madnessInHand = player.hand.filter(
        card => card.defId === MADNESS_CARD_DEF_ID && card.uid !== sourceCardUid,
    );
    return [
        ...madnessInHand.map((card, index) => ({
            id: `madness-${index}`,
            label: `疯狂卡 ${index + 1}`,
            value: { cardUid: card.uid, defId: card.defId },
            _source: 'hand' as const,
            displayMode: 'card' as const,
        })),
        {
            id: 'skip',
            label: '跳过',
            labelKey: 'ui.skip',
            value: { skip: true },
            displayMode: 'button' as const,
        },
    ];
}

function buildStarSpawnOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    madnessUid: string,
): PromptOption<TargetPlayerChoiceValue>[] {
    const opponents = core.turnOrder.filter(pid => pid !== playerId);
    return buildPlayerTargetOptions<{ madnessUid: string }>(
        opponents.map((pid, index) => ({
            id: `player-${index}`,
            label: getPlayerLabel(pid),
            targetPlayerId: pid,
            value: { madnessUid },
        })),
        {
            sourcePlayerId: playerId,
            effectIntent: 'debuff',
        },
    );
}

function buildServitorOptions(
    core: SmashUpCore,
    playerId: PlayerId,
): PromptOption<CardChoiceValue>[] {
    const player = core.players[playerId];
    return player.discard
        .filter(card => card.type === 'action')
        .map((card, index) => ({
            id: `action-${index}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId },
            _source: 'discard' as const,
            displayMode: 'card' as const,
        }));
}

function transferCardBetweenHands(
    state: MatchState<SmashUpCore>,
    fromPlayerId: PlayerId,
    toPlayerId: PlayerId,
    cardUid: string,
): MatchState<SmashUpCore> | undefined {
    const fromPlayer = state.core.players[fromPlayerId];
    const toPlayer = state.core.players[toPlayerId];
    if (!fromPlayer || !toPlayer) return undefined;

    const index = fromPlayer.hand.findIndex(card => card.uid === cardUid);
    if (index === -1) return undefined;

    const card = fromPlayer.hand[index];
    return {
        ...state,
        core: {
            ...state.core,
            players: {
                ...state.core.players,
                [fromPlayerId]: {
                    ...fromPlayer,
                    hand: fromPlayer.hand.filter((_, cardIndex) => cardIndex !== index),
                },
                [toPlayerId]: {
                    ...toPlayer,
                    hand: [...toPlayer.hand, card],
                },
            },
        },
    };
}

/** 注册克苏鲁之仆派系所有能力*/
export function registerCthulhuAbilities(): void {
    // 强制招募（行动卡）：弃牌堆力量≤3随从放牌库顶
    registerAbilityProgram('cthulhu_recruit_by_force', 'onPlay', { program: cthulhuRecruitByForceProgram });
    // 再次降临（行动卡）：弃牌堆行动卡洗回牌库
    registerAbilityProgram('cthulhu_it_begins_again', 'onPlay', { program: cthulhuItBeginsAgainProgram });
    // 克苏鲁的馈赠（行动卡）：从牌库顶?张行动卡放入手牌
    registerSimpleAbility('cthulhu_fhtagn', 'onPlay', cthulhuFhtagn);
    // 暗中低语（行动卡）：?张疯狂卡 + 2个额外行动
    registerSimpleAbility('cthulhu_whispers_in_darkness', 'onPlay', cthulhuWhispersInDarkness);
    // 测言已破（行动卡）：?张疯狂卡 + 1VP
    registerSimpleAbility('cthulhu_seal_is_broken', 'onPlay', cthulhuSealIsBroken);
    // 疯狂卡 onPlay：抽2张卡 / 返回疯狂牌堆
    registerMadnessAbilities();
    // 腐化（行动卡）：?张疯狂卡 + 消灭一个随从（MVP：自动选最弱对手随从）
    registerAbilityProgram('cthulhu_corruption', 'onPlay', { program: cthulhuCorruptionProgram });
    // 疯狂释放（行动卡）：弃任意数量疯狂卡，每?= ??+ 额外行动
    registerAbilityProgram('cthulhu_madness_unleashed', 'onPlay', { program: cthulhuMadnessUnleashedProgram });
    // 星之眷族（随从talent）：将手中疯狂卡转给对手
    registerAbilityProgram('cthulhu_star_spawn', 'talent', {
        program: cthulhuStarSpawnProgram,
        validateUse: (ctx) => {
            const player = ctx.state.players[ctx.playerId];
            const madnessInHand = player.hand.filter(c => c.defId === MADNESS_CARD_DEF_ID);
            if (madnessInHand.length === 0) return '手中没有疯狂卡';
            const opponents = ctx.state.turnOrder.filter(pid => pid !== ctx.playerId);
            return opponents.length > 0 ? null : '当前没有可选择的目标';
        },
    });
    // 仆人（随从talent）：消灭自身 + 弃牌堆行动卡放牌库顶
    registerAbilityProgram('cthulhu_servitor', 'talent', { program: cthulhuServitorProgram });

    // === ongoing 效果注册 ===
    // 克苏鲁祭坛：打出随从时额外打出一张战术?
    registerTrigger('cthulhu_altar', 'onMinionPlayed', cthulhuAltarTrigger, {
        sourceScope: 'triggerBase',
        canTrigger: isCthulhuAltarEligibleForMinionPlayed,
        playerContext: 'sourceController',
    });
    // 深化目标：回合结束时条件获VP
    registerTrigger('cthulhu_furthering_the_cause', 'onTurnEnd', cthulhuFurtheringTheCauseTrigger);
    // 天选之人：基地计分前抽疑狂卡?2力量
    registerTrigger('cthulhu_chosen', 'beforeScoring', cthulhuChosenBeforeScoringPerInstance, {
        perInstance: true,
        playerContext: 'sourceController',
        canTrigger: canTriggerCthulhuChosenBeforeScoring,
    });
    // 完成仪式：回合开始时清场并换基地
    registerTrigger('cthulhu_complete_the_ritual', 'onTurnStart', cthulhuCompleteTheRitualTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
    });
}

export function registerMadnessAbilities(): void {
    registerAbilityProgram('special_madness', 'onPlay', { program: specialMadnessProgram });
}

const cthulhuRecruitByForcePromptProgram = createPromptProgram<CthulhuPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'cthulhu_recruit_by_force',
    buildInteraction: (context) => {
        const options = buildRecruitByForceOptions(context.matchState.core, context.playerId);
        const interaction = createAbilityRuntimeSimpleChoice(
            `cthulhu_recruit_by_force_${context.now}`,
            context.playerId,
            '选择要放到牌库顶的随从（任意数量，可跳过）',
            options,
            {
                sourceId: 'cthulhu_recruit_by_force',
                titleKey: 'ui.cthulhu_recruit_by_force_title',
                targetType: 'generic',
                multi: { min: 0, max: Math.max(options.length - 1, 0) },
                autoRefresh: 'discard',
                responseValidationMode: 'live',
            },
        );
        interaction.data.optionsGenerator = state =>
            buildRecruitByForceOptions(state.core as SmashUpCore, context.playerId);
        return interaction;
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        const cardUids = normalizeChoiceArray<CardUidSelection>(value)
            .map(entry => entry.cardUid)
            .filter((entry): entry is string => !!entry);
        if (cardUids.length === 0) return { events: [] };
        const player = state.core.players[playerId];
        const selectedFromDiscard = cardUids
            .map(uid => player.discard.find(card => card.uid === uid))
            .filter((card): card is typeof player.discard[number] => !!card);
        if (selectedFromDiscard.length === 0) return { events: [] };
        return {
            events: [...selectedFromDiscard]
                .reverse()
                .map(card => ({
                    type: SU_EVENTS.CARD_TO_DECK_TOP,
                    payload: {
                        cardUid: card.uid,
                        defId: card.defId,
                        ownerId: card.owner,
                        sourcePlayerId: playerId,
                        reason: 'cthulhu_recruit_by_force',
                    },
                    timestamp,
                })),
        };
    },
});

const cthulhuRecruitByForceProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const options = buildRecruitByForceOptions(ctx.state, ctx.playerId);
    if (options.length <= 1) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
    }
    return {
        events: [],
        context: { matchState: ctx.matchState, playerId: ctx.playerId, now: ctx.now } satisfies CthulhuPromptContext,
        nextProgram: cthulhuRecruitByForcePromptProgram,
    };
});

const cthulhuItBeginsAgainPromptProgram = createPromptProgram<CthulhuItBeginsAgainPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'cthulhu_it_begins_again',
    buildInteraction: (context) => {
        const options = buildItBeginsAgainOptions(
            context.matchState.core,
            context.playerId,
            context.sourceCardUid,
        );
        const interaction = createAbilityRuntimeSimpleChoice(
            `cthulhu_it_begins_again_${context.now}`,
            context.playerId,
            '选择要洗回牌库的战术（任意数量，可跳过）',
            options,
            {
                sourceId: 'cthulhu_it_begins_again',
                titleKey: 'ui.cthulhu_it_begins_again_title',
                targetType: 'generic',
                multi: { min: 0, max: Math.max(options.length - 1, 0) },
                autoRefresh: 'discard',
                responseValidationMode: 'live',
            },
        );
        interaction.data.optionsGenerator = state =>
            buildItBeginsAgainOptions(
                state.core as SmashUpCore,
                context.playerId,
                context.sourceCardUid,
            );
        return interaction;
    },
    onResolve: ({ context, state, playerId, value, random, timestamp }) => {
        const cardUids = normalizeChoiceArray<CardUidSelection>(value)
            .map(entry => entry.cardUid)
            .filter((entry): entry is string => !!entry);
        if (cardUids.length === 0) return { events: [] };
        const player = state.core.players[playerId];
        const selectedSet = new Set(cardUids);
        const actionsFromDiscard = player.discard.filter(
            card => selectedSet.has(card.uid) && card.uid !== context.sourceCardUid,
        );
        if (actionsFromDiscard.length === 0) return { events: [] };
        const actionsByOwner = new Map<PlayerId, typeof actionsFromDiscard>();
        for (const card of actionsFromDiscard) {
            const ownerCards = actionsByOwner.get(card.owner) ?? [];
            ownerCards.push(card);
            actionsByOwner.set(card.owner, ownerCards);
        }
        const shuffled = random.shuffle([...player.deck, ...actionsFromDiscard]);
        return {
            events: actionsByOwner.size <= 1 && actionsByOwner.has(playerId)
                ? [{
                    type: SU_EVENTS.DECK_REORDERED,
                    payload: { playerId, deckUids: shuffled.map(card => card.uid) },
                    timestamp,
                }]
                : Array.from(actionsByOwner.entries()).map(([ownerId, ownerCards]) => ({
                    type: SU_EVENTS.DECK_REORDERED,
                    payload: {
                        playerId: ownerId,
                        sourcePlayerId: playerId,
                        deckUids: random.shuffle([...(state.core.players[ownerId]?.deck ?? []), ...ownerCards])
                            .map(card => card.uid),
                    },
                    timestamp,
                })),
        };
    },
});

const cthulhuItBeginsAgainProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const options = buildItBeginsAgainOptions(ctx.state, ctx.playerId, ctx.cardUid);
    if (options.length <= 1) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
    }
    return {
        events: [],
        context: {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            sourceCardUid: ctx.cardUid,
        } satisfies CthulhuItBeginsAgainPromptContext,
        nextProgram: cthulhuItBeginsAgainPromptProgram,
    };
});

/** 克苏鲁的馈赠 onPlay：从牌库顶搜索直到找到2张行动卡，放入手牌，其余放牌库底 */
function cthulhuFhtagn(ctx: AbilityContext): AbilityResult {
    const { events } = revealAndPickFromDeck({
        state: ctx.state,
        random: ctx.random,
        playerId: ctx.playerId,
        predicate: card => card.type === 'action',
        maxPick: 2,
        revealTo: 'all', // 规则："依次展示卡牌"，公开给所有人看
        reason: 'cthulhu_fhtagn',
        now: ctx.now,
    });
    return { events };
}

/** 暗中低语 onPlay：抽1张疯狂卡 + 获得2个额外行动*/
function cthulhuWhispersInDarkness(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const madnessEvt = drawMadnessCards(ctx.playerId, 1, ctx.state, 'cthulhu_whispers_in_darkness', ctx.now);
    if (madnessEvt) events.push(madnessEvt);
    events.push(grantContextualExtraAction(ctx, 'cthulhu_whispers_in_darkness'));
    events.push(grantContextualExtraAction(ctx, 'cthulhu_whispers_in_darkness'));
    return { events };
}

/** 封印已破 onPlay：抽1张疯狂卡 + 获得1VP */
function cthulhuSealIsBroken(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const madnessEvt = drawMadnessCards(ctx.playerId, 1, ctx.state, 'cthulhu_seal_is_broken', ctx.now);
    if (madnessEvt) events.push(madnessEvt);
    const vpEvt: VpAwardedEvent = {
        type: SU_EVENTS.VP_AWARDED,
        payload: { playerId: ctx.playerId, amount: 1, reason: 'cthulhu_seal_is_broken' },
        timestamp: ctx.now,
    };
    events.push(vpEvt);
    return { events };
}

const cthulhuCorruptionPromptProgram = createPromptProgram<CthulhuPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'cthulhu_corruption',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `cthulhu_corruption_${context.now}`,
        context.playerId,
        '选择要消灭的随从',
        buildCorruptionPromptOptions(context.matchState.core, context.playerId),
        {
            sourceId: 'cthulhu_corruption',
            titleKey: 'ui.cthulhu_corruption_title',
            targetType: 'minion',
            autoRefresh: 'field',
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ state, playerId, value, timestamp }) => {
        const selected = value as { minionUid?: string; baseIndex?: number };
        if (!selected.minionUid || selected.baseIndex === undefined) return { events: [] };
        const isStillValid = buildCorruptionPromptOptions(state.core, playerId).some(
            option => option.value.minionUid === selected.minionUid && option.value.baseIndex === selected.baseIndex,
        );
        if (!isStillValid) return { events: [] };
        const base = state.core.bases[selected.baseIndex];
        const target = base?.minions.find(minion => minion.uid === selected.minionUid);
        if (!target) return { events: [] };
        return {
            events: buildValidatedDestroyEvents(state, {
                minionUid: target.uid,
                minionDefId: target.defId,
                fromBaseIndex: selected.baseIndex,
                destroyerId: playerId,
                reason: 'cthulhu_corruption',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceDefId: 'cthulhu_corruption',
                sourceControllerId: playerId,
                sourceKind: 'action',
            }),
        };
    },
});

const cthulhuCorruptionProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const events: SmashUpEvent[] = [];
    const madnessEvt = drawMadnessCards(ctx.playerId, 1, ctx.state, 'cthulhu_corruption', ctx.now);
    if (madnessEvt) events.push(madnessEvt);

    if (buildCorruptionPromptOptions(ctx.state, ctx.playerId).length === 0) {
        return { events };
    }
    return {
        events,
        context: { matchState: ctx.matchState, playerId: ctx.playerId, now: ctx.now } satisfies CthulhuPromptContext,
        nextProgram: cthulhuCorruptionPromptProgram,
    };
});

/**
 * 疯狂解放 onPlay：弃掉手中任意数量的疯狂卡；每弃 1 张，就可以抽 1 张牌并获得 1 个额外行动额度。
 *
 * 官方 FAQ 明确：
 * 1. 必须先决定并弃掉所有要弃的疯狂卡，再开始抽牌
 * 2. 每次选择结算该收益时，抽牌和额外行动是绑定的一组收益，不应拆成二次确认
 */
const cthulhuMadnessUnleashedAfterDiscardProgram = createEffectProgram<
    CthulhuMadnessUnleashedAfterDiscardContext,
    SmashUpCore,
    SmashUpEvent
>((context) => {
    const events: SmashUpEvent[] = [
        ...buildStandardDrawEvents(
            context.matchState.core,
            context.playerId,
            context.discardCount,
            context.random,
            context.now,
        ),
    ];

    for (let index = 0; index < context.discardCount; index += 1) {
        events.push(grantContextualExtraAction(
            { playerId: context.playerId, now: context.now, matchState: context.matchState },
            'cthulhu_madness_unleashed',
        ));
    }

    return { events };
});

const cthulhuMadnessUnleashedPromptProgram = createPromptProgram<CthulhuMadnessUnleashedPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'cthulhu_madness_unleashed',
    buildInteraction: (context) => {
        const options = buildMadnessUnleashedOptions(
            context.matchState.core,
            context.playerId,
            context.sourceCardUid,
        );
        const interaction = createAbilityRuntimeSimpleChoice(
            `cthulhu_madness_unleashed_${context.now}`,
            context.playerId,
            '选择要弃掉的疯狂卡（任意数量，可跳过）',
            options,
            {
                sourceId: 'cthulhu_madness_unleashed',
                titleKey: 'ui.cthulhu_madness_unleashed_title',
                targetType: 'hand',
                multi: { min: 0, max: Math.max(options.length - 1, 0) },
                autoRefresh: 'hand',
                responseValidationMode: 'live',
            },
        );
        interaction.data.optionsGenerator = state =>
            buildMadnessUnleashedOptions(state.core as SmashUpCore, context.playerId, context.sourceCardUid);
        return interaction;
    },
    onResolve: (args) => {
        const { state, playerId, value, timestamp } = args;
        const madnessUids = normalizeChoiceArray<CardUidSelection>(value)
            .map(entry => entry.cardUid)
            .filter((entry): entry is string => !!entry);
        if (madnessUids.length === 0) return { events: [] };

        const player = state.core.players[playerId];
        if (!player) return { events: [] };

        const discardEvent: SmashUpEvent = {
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: { playerId, cardUids: madnessUids },
            timestamp,
        };
        return {
            events: [discardEvent],
            context: {
                matchState: state,
                playerId,
                now: timestamp,
                discardCount: madnessUids.length,
                random: args.random,
            } satisfies CthulhuMadnessUnleashedAfterDiscardContext,
            nextProgram: cthulhuMadnessUnleashedAfterDiscardProgram,
        };
    },
});

const cthulhuMadnessUnleashedProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const options = buildMadnessUnleashedOptions(ctx.state, ctx.playerId, ctx.cardUid);
    if (options.length <= 1) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.hand_empty', ctx.now)] };
    }
    return {
        events: [],
        context: {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            sourceCardUid: ctx.cardUid,
        } satisfies CthulhuMadnessUnleashedPromptContext,
        nextProgram: cthulhuMadnessUnleashedPromptProgram,
    };
});


// ============================================================================
// 完成仪式 ongoing 触发器?
// ============================================================================

/**
 * 完成仪式 onTurnStart：拥有者回合开始时?
 * 将基地上所有随从和战术放回拥有者牌库底?
 * 然后将基地与基地牌库顶的卡交?
 */
function cthulhuCompleteTheRitualTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        const controllerId = ctx.sourceControllerId ?? ctx.playerId;
        const ritual = base.ongoingActions.find(
            a => matchesDefId(a.defId, 'cthulhu_complete_the_ritual') && a.uid === ctx.sourceCardUid
        );
        if (!ritual) {
            const fallbackRitual = base.ongoingActions.find(
                a => matchesDefId(a.defId, 'cthulhu_complete_the_ritual') && getCthulhuOngoingControllerId(a) === controllerId
            );
            if (!fallbackRitual) continue;
        }
        const resolvedRitual = ritual ?? base.ongoingActions.find(
            a => matchesDefId(a.defId, 'cthulhu_complete_the_ritual') && getCthulhuOngoingControllerId(a) === controllerId
        );
        if (!resolvedRitual) continue;

        // 1. 将所有随从放回拥有者牌库底；普通随从的附着行动也一并放底
        for (const m of base.minions) {
            events.push({
                type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
                payload: {
                    cardUid: m.uid,
                    defId: m.defId,
                    ownerId: m.owner,
                    ...(m.owner !== controllerId ? { sourcePlayerId: controllerId } : {}),
                    reason: 'cthulhu_complete_the_ritual',
                },
                timestamp: ctx.now,
            } as CardToDeckBottomEvent);

            // 随从上的附着行动也放回其拥有者牌库底
            for (const a of m.attachedActions) {
                events.push({
                    type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
                    payload: {
                        cardUid: a.uid,
                        defId: a.defId,
                        ownerId: a.ownerId,
                        ...(a.ownerId !== controllerId ? { sourcePlayerId: controllerId } : {}),
                        reason: 'cthulhu_complete_the_ritual',
                    },
                    timestamp: ctx.now,
                } as CardToDeckBottomEvent);
            }
        }

        // 2. 将所?ongoing 行动卡放回拥有者牌库底（包括仪式本身）
        for (const ongoing of base.ongoingActions) {
            events.push({
                type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
                payload: {
                    cardUid: ongoing.uid,
                    defId: ongoing.defId,
                    ownerId: ongoing.ownerId,
                    ...(ongoing.ownerId !== controllerId ? { sourcePlayerId: controllerId } : {}),
                    reason: 'cthulhu_complete_the_ritual',
                },
                timestamp: ctx.now,
            } as CardToDeckBottomEvent);
        }

        // 3. 移除旧基地（BASE_CLEARED 清除基地上的随从/ongoing 并移除基地）
        events.push({
            type: SU_EVENTS.BASE_CLEARED,
            payload: { baseIndex: i, baseDefId: base.defId },
            timestamp: ctx.now,
        } as BaseClearedEvent);

        // 4. 插入新基地（从基地牌库顶?
        if (ctx.state.baseDeck.length > 0) {
            events.push({
                type: SU_EVENTS.BASE_REPLACED,
                payload: {
                    baseIndex: i,
                    oldBaseDefId: base.defId,
                    newBaseDefId: ctx.state.baseDeck[0],
                },
                timestamp: ctx.now,
            } as BaseReplacedEvent);
        }

        // 只处理第一个找到的仪式（卡片只有?张）
        break;
    }
    return events;
}

function buildChosenPromptOptions(
    core: SmashUpCore,
    chosen: CthulhuChosenPromptTarget,
): PromptOption<{
    activate: boolean;
    uid?: string;
    minionUid?: string;
    defId?: string;
    minionDefId?: string;
    baseIndex?: number;
    controller?: string;
}>[] {
    return [
        {
            id: 'yes',
            label: '是（抽疯狂牌，+2 力量）',
            labelKey: 'ui.cthulhu_chosen_confirm_yes_option',
            value: {
                activate: true,
                uid: chosen.uid,
                minionUid: chosen.uid,
                defId: chosen.defId,
                minionDefId: chosen.defId,
                baseIndex: chosen.baseIndex,
                controller: chosen.controller,
            },
            displayMode: 'button' as const,
            baseDefId: core.bases[chosen.baseIndex]?.defId,
        },
        {
            id: 'no',
            label: '否（不触发）',
            labelKey: 'ui.cthulhu_chosen_confirm_no_option',
            value: { activate: false },
            displayMode: 'button' as const,
            baseDefId: core.bases[chosen.baseIndex]?.defId,
        },
    ];
}

const cthulhuChosenConfirmPromptProgram = createPromptProgram<CthulhuChosenPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'cthulhu_chosen_confirm',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `cthulhu_chosen_confirm_${context.chosen.uid}_${context.now}`,
        context.chosen.controller,
        '天选之人：是否抽一张疯狂牌来获得 +2 力量？',
        buildChosenPromptOptions(context.matchState.core, context.chosen),
        {
            sourceId: 'cthulhu_chosen_confirm',
            titleKey: 'ui.cthulhu_chosen_confirm_title',
            targetType: 'generic',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as {
            activate: boolean;
            uid?: string;
            minionUid?: string;
            defId?: string;
            minionDefId?: string;
            baseIndex?: number;
            controller?: string;
        };
        const events: SmashUpEvent[] = [];
        const minionUid = selected.minionUid ?? selected.uid;
        const minionDefId = selected.minionDefId ?? selected.defId;
        if (selected.activate && minionUid && minionDefId && selected.baseIndex !== undefined && selected.controller) {
            const madnessEvt = drawMadnessCards(selected.controller, 1, state.core, 'cthulhu_chosen', timestamp);
            if (madnessEvt) events.push(madnessEvt);
            events.push(addTempPower(minionUid, selected.baseIndex, 2, 'cthulhu_chosen', timestamp));
        }

        if (context.remaining.length === 0) {
            return { events };
        }

        const [nextChosen, ...rest] = context.remaining;
        return {
            events,
            context: {
                matchState: state,
                now: timestamp,
                chosen: nextChosen,
                remaining: rest,
            } satisfies CthulhuChosenPromptContext,
            nextProgram: cthulhuChosenConfirmPromptProgram,
        };
    },
});

function cthulhuChosenBeforeScoringPerInstance(ctx: TriggerContext): TriggerResult {
    const locatedChosen = ctx.sourceCardUid
        ? ctx.state.bases
            .flatMap((base, baseIndex) => base.minions.map(minion => ({ minion, baseIndex })))
            .find(entry => entry.minion.uid === ctx.sourceCardUid)
        : ctx.state.bases
            .flatMap((base, baseIndex) => base.minions.map(minion => ({ minion, baseIndex })))
            .find(entry => matchesDefId(entry.minion.defId, 'cthulhu_chosen'));

    if (!locatedChosen) return { events: [] };

    const chosen = locatedChosen.minion;
    const chosenBaseIndex = locatedChosen.baseIndex;

    if (!ctx.matchState) return { events: [] };

    return runtimeResultToTriggerResult(executeAbilityProgram(
        cthulhuChosenConfirmPromptProgram,
        {
            matchState: ctx.matchState,
            now: ctx.now,
            chosen: {
                uid: chosen.uid,
                defId: chosen.defId,
                controller: chosen.controller,
                baseIndex: chosenBaseIndex,
            },
            remaining: [],
        } satisfies CthulhuChosenPromptContext,
    ), ctx.matchState);
}

function canTriggerCthulhuChosenBeforeScoring(ctx: TriggerContext): boolean {
    if (!ctx.matchState) return false;
    if (ctx.sourceCardUid) {
        return ctx.state.bases.some(base =>
            base.minions.some(minion =>
                minion.uid === ctx.sourceCardUid
                && matchesDefId(minion.defId, 'cthulhu_chosen'),
            ),
        );
    }
    return ctx.state.bases.some(base =>
        base.minions.some(minion => matchesDefId(minion.defId, 'cthulhu_chosen')),
    );
}

// ============================================================================
// ongoing 效果触发器?
// ============================================================================

function getCthulhuOngoingControllerId(ongoing: { ownerId: PlayerId; metadata?: { sourceControllerId?: PlayerId } }): PlayerId {
    return ongoing.metadata?.sourceControllerId ?? ongoing.ownerId;
}

/** 克苏鲁祭坛触发：打出随从时额外打出一张战术?*/
function isCthulhuAltarEligibleForMinionPlayed(ctx: TriggerContext): boolean {
    const baseIndex = ctx.baseIndex;
    if (baseIndex === undefined) return false;
    const base = ctx.state.bases[baseIndex];
    if (!base) return false;
    const usedUids = ctx.state.turnUsedOngoingUids ?? [];
    return base.ongoingActions.some(ongoing => {
        if (ctx.sourceCardUid && ongoing.uid !== ctx.sourceCardUid) return false;
        if (!matchesDefId(ongoing.defId, 'cthulhu_altar')) return false;
        const controllerId = getCthulhuOngoingControllerId(ongoing);
        if (controllerId !== ctx.playerId) return false;
        return !ongoing.defId.endsWith('_pod') || !usedUids.includes(ongoing.uid);
    });
}

function cthulhuAltarTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    if (!isCthulhuAltarEligibleForMinionPlayed(ctx)) return events;
    const baseIndex = ctx.baseIndex;
    if (baseIndex === undefined) return events;
    const base = ctx.state.bases[baseIndex];
    if (!base) return events;
    // 原版 altar：每次在这里打随从就给 1 次额外行动
    // POD 版：每回合每张 altar 只能触发一次
    const usedUids = ctx.state.turnUsedOngoingUids ?? [];
    const newUsedUids = [...usedUids];

    for (const ongoing of base.ongoingActions) {
        if (ctx.sourceCardUid && ongoing.uid !== ctx.sourceCardUid) continue;
        if (!matchesDefId(ongoing.defId, 'cthulhu_altar')) continue;
        const controllerId = getCthulhuOngoingControllerId(ongoing);
        if (controllerId !== ctx.playerId) continue;

        const isPod = ongoing.defId.endsWith('_pod');
        if (isPod && usedUids.includes(ongoing.uid)) continue;

        events.push(grantContextualExtraAction(ctx, 'cthulhu_altar'));

        if (isPod && !newUsedUids.includes(ongoing.uid)) {
            newUsedUids.push(ongoing.uid);
        }
    }

    if (newUsedUids.length !== usedUids.length) {
        ctx.state.turnUsedOngoingUids = newUsedUids;
    }

    return events;
}

/** 深化目标触发：回合结束时检查本回合是否有对手随从在此基地被消灭，若是则获得 1VP */
function cthulhuFurtheringTheCauseTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    const destroyed = ctx.state.turnDestroyedMinions ?? [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        for (const ongoing of base.ongoingActions) {
            if (ctx.sourceCardUid && ongoing.uid !== ctx.sourceCardUid) continue;
            if (!matchesDefId(ongoing.defId, 'cthulhu_furthering_the_cause')) continue;
            const controllerId = getCthulhuOngoingControllerId(ongoing);
            // 检查本回合是否有对手随从在此基地被消灭
            const hasDestroyedOpponent = destroyed.some(
                d => d.baseIndex === i && (d.controller ?? d.owner) !== controllerId
            );
            if (hasDestroyedOpponent) {
                events.push({
                    type: SU_EVENTS.VP_AWARDED,
                    payload: { playerId: controllerId, amount: 1, reason: 'cthulhu_furthering_the_cause' },
                    timestamp: ctx.now,
                } as VpAwardedEvent);
            }
        }
    }
    return events;
}

const specialMadnessPromptProgram = createPromptProgram<SpecialMadnessPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'special_madness',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `special_madness_${context.now}`,
        context.playerId,
        '疯狂卡：选择一个效果',
        [
            {
                id: 'draw',
                label: '抽两张卡',
                labelKey: 'ui.special_madness_draw_option',
                value: { action: 'draw' },
                displayMode: 'button' as const,
            },
            {
                id: 'return',
                label: '消耗这张疯狂牌',
                labelKey: 'ui.special_madness_return_option',
                value: { action: 'return' },
                displayMode: 'button' as const,
            },
        ],
        {
            sourceId: 'special_madness',
            titleKey: 'ui.special_madness_title',
            targetType: 'button',
            displayCard: { defId: MADNESS_CARD_DEF_ID, cardUid: context.cardUid },
        },
    ),
    onResolve: (args) => {
        const { context, playerId, value, timestamp } = args;
        const { action } = value as MadnessActionChoiceValue;
        if (action === 'return') {
            return {
                events: [returnMadnessCard(playerId, context.cardUid, 'special_madness', timestamp)],
            };
        }
        return {
            events: buildStandardDrawEventsFromRuntimeContext(args, playerId, 2),
        };
    },
});

const specialMadnessProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => ({
    events: [],
    context: {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        cardUid: ctx.cardUid,
    } satisfies SpecialMadnessPromptContext,
    nextProgram: specialMadnessPromptProgram,
}));

const cthulhuStarSpawnPromptProgram = createPromptProgram<StarSpawnPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'cthulhu_star_spawn',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `cthulhu_star_spawn_${context.now}`,
        context.playerId,
        '选择要给予疯狂卡的玩家',
        buildStarSpawnOptions(context.matchState.core, context.playerId, context.madnessUid),
        {
            sourceId: 'cthulhu_star_spawn',
            titleKey: 'ui.cthulhu_star_spawn_title',
            targetType: 'generic',
            autoCancelOption: true,
        },
    ),
    onResolve: ({ context, state, playerId, value }) => {
        const selected = value as { __cancel__?: boolean; targetPlayerId?: string };
        if (selected.__cancel__ || !selected.targetPlayerId) return { events: [] };
        const nextState = transferCardBetweenHands(state, playerId, selected.targetPlayerId, context.madnessUid);
        if (!nextState) return { events: [] };
        return {
            events: [],
            matchState: nextState,
        };
    },
});

const cthulhuStarSpawnProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const madnessCard = ctx.state.players[ctx.playerId].hand.find(card => card.defId === MADNESS_CARD_DEF_ID);
    if (!madnessCard) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.hand_empty', ctx.now)] };
    }
    if (ctx.state.turnOrder.filter(pid => pid !== ctx.playerId).length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    return {
        events: [],
        context: {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            madnessUid: madnessCard.uid,
        } satisfies StarSpawnPromptContext,
        nextProgram: cthulhuStarSpawnPromptProgram,
    };
});

const cthulhuServitorPromptProgram = createPromptProgram<CthulhuPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'cthulhu_servitor',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `cthulhu_servitor_${context.now}`,
            context.playerId,
            '选择放回牌库顶的行动卡',
            buildServitorOptions(context.matchState.core, context.playerId),
            {
                sourceId: 'cthulhu_servitor',
                titleKey: 'ui.cthulhu_servitor_title',
                targetType: 'generic',
                autoRefresh: 'discard',
                responseValidationMode: 'live',
            },
        );
        interaction.data.optionsGenerator = state =>
            buildServitorOptions(state.core as SmashUpCore, context.playerId);
        return interaction;
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        const { cardUid } = value as CardUidSelection;
        if (!cardUid) return { events: [] };
        const player = state.core.players[playerId];
        const actionCard = player?.discard.find(card => card.uid === cardUid && card.type === 'action');
        if (!actionCard) return { events: [] };
        const ownerId = actionCard.owner;
        const ownerDeck = state.core.players[ownerId]?.deck ?? [];
        return {
            events: [{
                type: SU_EVENTS.DECK_REORDERED,
                payload: {
                    playerId: ownerId,
                    deckUids: [actionCard.uid, ...ownerDeck.map(card => card.uid)],
                    ...(ownerId !== playerId ? { sourcePlayerId: playerId } : {}),
                },
                timestamp,
            }],
        };
    },
});

const cthulhuServitorProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const sourceMinion = findMinionOnBases(ctx.state, ctx.cardUid)?.minion;
    const events: SmashUpEvent[] = buildValidatedDestroyEvents(ctx.state, {
        minionUid: ctx.cardUid,
        minionDefId: ctx.defId,
        fromBaseIndex: ctx.baseIndex,
        destroyerId: undefined,
        reason: 'cthulhu_servitor',
        now: ctx.now,
        sourcePlayerId: ctx.playerId,
        sourceCardUid: ctx.cardUid,
        sourceDefId: ctx.defId,
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: ctx.baseIndex,
        sourceKind: 'nonAction',
        targetSnapshot: sourceMinion
            ? {
                ownerId: sourceMinion.owner,
                controllerId: sourceMinion.controller,
                attachedActions: sourceMinion.attachedActions,
                metadata: sourceMinion.metadata,
                playedThisTurn: sourceMinion.playedThisTurn,
            }
            : undefined,
    });
    if (buildServitorOptions(ctx.state, ctx.playerId).length === 0) {
        return { events };
    }
    return {
        events,
        context: { matchState: ctx.matchState, playerId: ctx.playerId, now: ctx.now } satisfies CthulhuPromptContext,
        nextProgram: cthulhuServitorPromptProgram,
    };
});
