/**
 * 大杀四方 - 印斯茅斯派系能力
 *
 * 主题：同名随从联动、数量优势
 */

import { registerAbilityProgram, registerSimpleAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import { addTempPower, grantContextualExtraMinion, grantExtraMinion, drawMadnessCards, getMinionPower, revealAndPickFromDeck, buildAbilityFeedback, buildValidatedReturnEvents, buildStandardDrawEvents, buildStandardDrawEventsFromRuntimeContext } from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type { SmashUpEvent, DeckReorderedEvent, SmashUpCore } from '../domain/types';
import { registerProtection, registerTrigger } from '../domain/ongoingEffects';
import type { ProtectionCheckContext, TriggerContext, TriggerResult } from '../domain/ongoingEffects';
import { getCardDef } from '../data/cards';
import { matchesDefId, normalizePodDefId, resolveLiveBaseIndex } from '../domain/utils';
import type { MatchState, PlayerId } from '../../../engine/types';

type ReturnToSeaChoiceValue = {
    minionUid: string;
    minionDefId: string;
    owner: string;
    controller: string;
    baseIndex: number;
    baseDefId: string;
};

type ReturnToSeaNameChoiceValue = {
    cardUid: string;
    defId: string;
    baseIndex: number;
    baseDefId: string;
    minionDefId: string;
};

type InnsmouthPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
};

type InnsmouthReturnToSeaNamePromptContext = InnsmouthPromptContext & {
    cardUid: string;
    defId: string;
    baseIndex: number;
    baseDefId: string;
};

type InnsmouthReturnToSeaMinionPromptContext = InnsmouthPromptContext & {
    baseIndex: number;
    baseDefId: string;
    minionDefId: string;
};

function runtimeResultToAbilityResult(
    result: ReturnType<typeof executeAbilityProgram<unknown, SmashUpCore, SmashUpEvent>>,
    fallbackState: MatchState<SmashUpCore>,
): AbilityResult {
    return {
        events: result.events,
        matchState: result.matchState ?? fallbackState,
    };
}

/** 注册印斯茅斯派系所有能力*/
export function registerInnsmouthAbilities(): void {
    // 深潜者（行动卡）：力量≤2的己方随从各+1力量
    registerSimpleAbility('innsmouth_the_deep_ones', 'onPlay', innsmouthTheDeepOnes);
    // 新人（行动卡）：所有玩家将弃牌堆随从洗回牌堆
    registerSimpleAbility('innsmouth_new_acolytes', 'onPlay', innsmouthNewAcolytes);
    // 招募（行动卡）：抽若干张疯狂卡，每张可额外打出 1 个随从
    registerAbilityProgram('innsmouth_recruitment', 'onPlay', { program: innsmouthRecruitmentProgram });
    // 本地人（随从 onPlay）：展示牌库底张，同名卡放手牌，其余放牌库底
    registerSimpleAbility('innsmouth_the_locals', 'onPlay', innsmouthTheLocals);
    // 回归大海（special）：计分后同名随从回手牌
    registerAbilityProgram('innsmouth_return_to_the_sea', 'special', { program: innsmouthReturnToTheSeaProgram });
    registerTrigger('innsmouth_return_to_the_sea', 'afterScoring', innsmouthReturnToTheSeaAfterScoring, {
        perInstance: true,
        sourceScope: 'triggerBase',
        playerContext: 'sourceController',
    });
    // 深潜者的秘密（行动卡）：3+同名随从时抽牌，可选额外抽牌并获得疯狂卡牌
    registerAbilityProgram('innsmouth_mysteries_of_the_deep', 'onPlay', { program: innsmouthMysteriesOfTheDeepProgram });
    // 宗教圆环（ongoing talent）：额外打出同名随从到此基地
    registerSimpleAbility('innsmouth_sacred_circle', 'talent', {
        execute: innsmouthSacredCircle,
        validateUse: (ctx) => {
            let sacredBaseIndex = -1;
            for (let i = 0; i < ctx.state.bases.length; i++) {
                if (ctx.state.bases[i].ongoingActions.some(o => o.uid === ctx.cardUid)) {
                    sacredBaseIndex = i;
                    break;
                }
            }
            if (sacredBaseIndex === -1) return '当前没有可选择的目标';

            const base = ctx.state.bases[sacredBaseIndex];
            const minionDefIds = new Set(base.minions.map(m => m.defId));
            if (minionDefIds.size === 0) return '当前没有可选择的目标';

            const player = ctx.state.players[ctx.playerId];
            const hasMatch = player.hand.some(c => c.type === 'minion' && minionDefIds.has(c.defId));
            return hasMatch ? null : '当前没有可选择的目标';
        },
    });
    // 散播谣言（行动卡）：额外打出至多2个与场中同名的随从
    registerAbilityProgram('innsmouth_spreading_the_word', 'onPlay', { program: innsmouthSpreadingTheWordProgram });

    // === ongoing 效果注册 ===
    // in_plain_sight: 力量的随从不收回受其他玩家影响
    registerProtection('innsmouth_in_plain_sight', 'affect', innsmouthInPlainSightChecker);
    registerProtection('innsmouth_in_plain_sight_pod', 'affect', innsmouthInPlainSightChecker);
}

/** 深潜者 onPlay：每个你的力量 ≤ 2 的随从获得 +1 力量 */
function innsmouthTheDeepOnes(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        for (const m of base.minions) {
            if (m.controller === ctx.playerId && getMinionPower(ctx.state, m, i) <= 2) {
                events.push(addTempPower(m.uid, i, 1, 'innsmouth_the_deep_ones', ctx.now));
            }
        }
    }
    return { events };
}

/** 新人 onPlay：所有玩家将弃牌堆中的所有随从洗回牌堆 */
function innsmouthNewAcolytes(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const workingDecks = new Map<PlayerId, typeof ctx.state.players[PlayerId]['deck']>();
    for (const pid of ctx.state.turnOrder) {
        const player = ctx.state.players[pid];
        const minionsInDiscard = player.discard.filter(c => c.type === 'minion');
        if (minionsInDiscard.length === 0) continue;
        const cardsByOwner = new Map<PlayerId, typeof minionsInDiscard>();
        for (const card of minionsInDiscard) {
            const ownerId = ctx.state.players[card.owner] ? card.owner : pid;
            cardsByOwner.set(ownerId, [...(cardsByOwner.get(ownerId) ?? []), card]);
        }
        for (const [ownerId, ownerCards] of cardsByOwner) {
            const ownerDeck = workingDecks.get(ownerId) ?? ctx.state.players[ownerId]?.deck ?? [];
            const shuffled = ctx.random.shuffle([...ownerDeck, ...ownerCards]);
            workingDecks.set(ownerId, shuffled);
            const evt: DeckReorderedEvent = {
                type: SU_EVENTS.DECK_REORDERED,
                payload: {
                    playerId: ownerId,
                    deckUids: shuffled.map(c => c.uid),
                    ...(ownerId !== pid ? { sourcePlayerId: pid } : {}),
                },
                timestamp: ctx.now,
            };
            events.push(evt);
        }
    }
    return { events };
}

const innsmouthRecruitmentPromptProgram = createPromptProgram<InnsmouthPromptContext & { maxDraw: number }, SmashUpCore, SmashUpEvent>({
    sourceId: 'innsmouth_recruitment',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `innsmouth_recruitment_${context.now}`,
        context.playerId,
        '选择抽取疯狂卡的数量（至多3张，每张获得1个额外随从额度）',
        Array.from({ length: context.maxDraw + 1 }, (_, index) => ({
            id: `draw-${index}`,
            label: index === 0 ? '不抽取' : `抽取 ${index} 张疯狂卡（获得 ${index} 个额外随从额度）`,
            labelKey: index === 0
                ? 'ui.innsmouth_recruitment_skip_draw_option'
                : 'ui.innsmouth_recruitment_draw_option',
            ...(index === 0 ? {} : { labelParams: { count: index } }),
            value: { count: index },
            displayMode: 'button' as const,
        })),
        {
            sourceId: 'innsmouth_recruitment',
            targetType: 'button',
            titleKey: 'ui.innsmouth_recruitment_title',
        },
    ),
    onResolve: ({ state, playerId, value, timestamp }) => {
        const { count } = value as { count?: number };
        if (!count || count <= 0) return { events: [] };
        const events: SmashUpEvent[] = [];
        const madnessEvt = drawMadnessCards(playerId, count, state.core, 'innsmouth_recruitment', timestamp);
        if (madnessEvt) {
            events.push(madnessEvt);
            const actualDrawn = madnessEvt.payload.cardUids.length;
            for (let index = 0; index < actualDrawn; index++) {
                events.push(grantContextualExtraMinion({ playerId, now: timestamp, matchState: state }, 'innsmouth_recruitment'));
            }
        }
        return { events };
    },
});
const innsmouthRecruitmentProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const available = ctx.state.madnessDeck?.length ?? 0;
    if (available === 0) return { events: [] };
    return {
        events: [],
        context: {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            maxDraw: Math.min(3, available),
        },
        nextProgram: innsmouthRecruitmentPromptProgram,
    };
});
// innsmouth_in_plain_sight (ongoing) - 通过 ongoing 效果系统实现（注册在 registerInnsmouthAbilities 中）

// ============================================================================
// ongoing 效果检查器
// ============================================================================

/**
 * in_plain_sight 保护检查：力量的的己方随从不收回受其他玩家影响?
 */
function innsmouthInPlainSightChecker(ctx: ProtectionCheckContext): boolean {
    const base = ctx.state.bases[ctx.targetBaseIndex];
    if (!base) return false;
    const matchingSights = base.ongoingActions.filter(o => matchesDefId(o.defId, 'innsmouth_in_plain_sight'));
    if (matchingSights.length === 0) return false;

    return matchingSights.some((sight) => {
        const sightControllerId = (sight.metadata?.sourceControllerId as PlayerId | undefined)
            ?? (sight.metadata?.sourcePlayerId as PlayerId | undefined)
            ?? sight.ownerId;
        if (ctx.targetMinion.controller !== sightControllerId) return false;
        const isPodVersion = sight.defId.endsWith('_pod');
        const protectedByPower =
            isPodVersion
                ? ctx.targetMinion.basePower <= 2
                : getMinionPower(ctx.state, ctx.targetMinion, ctx.targetBaseIndex) <= 2;
        return protectedByPower && ctx.sourcePlayerId !== sightControllerId;
    });
}

function buildReturnToSeaMinionOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    baseIndex: number,
    baseDefId: string,
    minionDefId: string,
): Array<{
    id: string;
    label: string;
    value: ReturnToSeaChoiceValue;
    _source: 'field';
    displayMode: 'card';
}> {
    const resolvedBaseIndex = resolveLiveBaseIndex(core, baseIndex, baseDefId);
    if (resolvedBaseIndex === undefined) return [];
    const base = core.bases[resolvedBaseIndex];
    if (!base) return [];
    const sameDefMinions = base.minions.filter(
        m => m.controller === playerId && m.defId === minionDefId,
    );

    return sameDefMinions.map((minion, index) => {
        const def = getCardDef(minion.defId);
        const name = def?.name ?? minion.defId;
        return {
            id: `minion-${index}`,
            label: name,
            value: {
                minionUid: minion.uid,
                minionDefId: minion.defId,
                owner: minion.owner,
                controller: minion.controller,
                baseIndex: resolvedBaseIndex,
                baseDefId: base.defId,
            },
            _source: 'field' as const,
            displayMode: 'card' as const,
        };
    });
}

const innsmouthReturnToTheSeaMinionPromptProgram = createPromptProgram<InnsmouthReturnToSeaMinionPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'innsmouth_return_to_the_sea',
    buildInteraction: (context) => {
        const options = buildReturnToSeaMinionOptions(
            context.matchState.core,
            context.playerId,
            context.baseIndex,
            context.baseDefId,
            context.minionDefId,
        );
        return createAbilityRuntimeSimpleChoice(
            `innsmouth_return_to_the_sea_choose_${context.now}`,
            context.playerId,
            '选择要返回的随从',
            options,
            {
                sourceId: 'innsmouth_return_to_the_sea',
                targetType: 'minion',
                multi: { min: 0, max: options.length },
                titleKey: 'ui.innsmouth_return_to_the_sea_title',
            },
        );
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        const selected = Array.isArray(value) ? value as ReturnToSeaChoiceValue[] : [];
        if (selected.length === 0) return { events: [] };
        const events: SmashUpEvent[] = [];
        for (const item of selected) {
            const resolvedBaseIndex = resolveLiveBaseIndex(state.core, item.baseIndex, item.baseDefId);
            if (resolvedBaseIndex === undefined) continue;
            const base = state.core.bases[resolvedBaseIndex];
            const minion = base?.minions.find(m => m.uid === item.minionUid);
            const targetPlayerId = minion?.controller ?? item.controller ?? playerId;
            events.push(...buildValidatedReturnEvents(state, {
                minionUid: item.minionUid,
                minionDefId: item.minionDefId,
                fromBaseIndex: resolvedBaseIndex,
                toPlayerId: targetPlayerId,
                reason: 'innsmouth_return_to_the_sea',
                now: timestamp,
                sourcePlayerId: playerId,
            }));
        }
        return { events };
    },
});

const innsmouthReturnToTheSeaChooseNamePromptProgram = createPromptProgram<InnsmouthReturnToSeaNamePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'innsmouth_return_to_the_sea_choose_name',
    buildInteraction: (context) => {
        const resolvedBaseIndex = resolveLiveBaseIndex(context.matchState.core, context.baseIndex, context.baseDefId);
        const base = resolvedBaseIndex === undefined ? undefined : context.matchState.core.bases[resolvedBaseIndex];
        const grouped = new Map<string, number>();
        for (const minion of base?.minions ?? []) {
            if (minion.controller !== context.playerId) continue;
            grouped.set(minion.defId, (grouped.get(minion.defId) ?? 0) + 1);
        }
        const options = Array.from(grouped.entries()).map(([minionDefId, count], index) => {
            const def = getCardDef(minionDefId);
            const name = def?.name ?? minionDefId;
            return {
                id: `name-${index}`,
                label: `${name} x${count}`,
                value: {
                    cardUid: context.cardUid,
                    defId: context.defId,
                    baseIndex: resolvedBaseIndex ?? context.baseIndex,
                    baseDefId: base?.defId ?? context.baseDefId,
                    minionDefId,
                },
                _source: 'field' as const,
                displayMode: 'card' as const,
            };
        });
        return createAbilityRuntimeSimpleChoice(
            `innsmouth_return_to_the_sea_choose_name_${context.cardUid}_${context.now}`,
            context.playerId,
            '选择要返回手牌的同名随从',
            options,
            {
                sourceId: 'innsmouth_return_to_the_sea_choose_name',
                targetType: 'generic',
                genericIntent: 'definition-choice',
                titleKey: 'ui.innsmouth_return_to_the_sea_choose_name_title',
            },
        );
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        const selected = value as ReturnToSeaNameChoiceValue;
        if (!selected?.minionDefId) return { events: [] };
        const options = buildReturnToSeaMinionOptions(
            state.core,
            playerId,
            selected.baseIndex,
            selected.baseDefId,
            selected.minionDefId,
        );
        if (options.length === 0) return { events: [] };
        return {
            events: [],
            context: {
                matchState: state,
                playerId,
                now: timestamp,
                baseIndex: selected.baseIndex,
                baseDefId: selected.baseDefId,
                minionDefId: selected.minionDefId,
            } satisfies InnsmouthReturnToSeaMinionPromptContext,
            nextProgram: innsmouthReturnToTheSeaMinionPromptProgram,
        };
    },
});

/**
 * 回归大海 special：计分后同名随从回手牌
 * MVP：将自己在被计分基地上的所有同 defId 随从回手牌
 */
const innsmouthReturnToTheSeaProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const baseIndex = ctx.baseIndex;
    const base = ctx.state.bases[baseIndex];
    if (!base) return { events: [] };

    // 找触发随从（自身）
    const myMinions = base.minions.filter(m => m.controller === ctx.playerId);
    if (myMinions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    // 找同基地上自己的同 defId 随从（包含触发随从自身）
    const grouped = new Map<string, typeof myMinions>();
    for (const minion of myMinions) {
        const existing = grouped.get(minion.defId);
        if (existing) {
            existing.push(minion);
        } else {
            grouped.set(minion.defId, [minion]);
        }
    }

    if (grouped.size === 1) {
        const [minionDefId] = grouped.keys();
        const options = buildReturnToSeaMinionOptions(ctx.state, ctx.playerId, baseIndex, base.defId, minionDefId);
        if (options.length === 0) return { events: [] };
        return {
            events: [],
            context: {
                matchState: ctx.matchState,
                playerId: ctx.playerId,
                now: ctx.now,
                baseIndex,
                baseDefId: base.defId,
                minionDefId,
            } satisfies InnsmouthReturnToSeaMinionPromptContext,
            nextProgram: innsmouthReturnToTheSeaMinionPromptProgram,
        };
    }

    return {
        events: [],
        context: {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            cardUid: ctx.cardUid,
            defId: ctx.defId,
            baseIndex,
            baseDefId: base.defId,
        } satisfies InnsmouthReturnToSeaNamePromptContext,
        nextProgram: innsmouthReturnToTheSeaChooseNamePromptProgram,
    };
});
function innsmouthReturnToTheSeaAfterScoring(ctx: TriggerContext): SmashUpEvent[] | TriggerResult {
    const { state, baseIndex, now, sourceCardUid } = ctx;
    if (baseIndex === undefined || !sourceCardUid) return [];

    const armedEntry = (state.pendingAfterScoringSpecials ?? []).find(
        special => matchesDefId(special.sourceDefId, 'innsmouth_return_to_the_sea')
            && special.baseIndex === baseIndex
            && special.cardUid === sourceCardUid,
    );
    if (!armedEntry) return [];

    const consumedEvent = {
        type: SU_EVENTS.SPECIAL_AFTER_SCORING_CONSUMED,
        payload: {
            sourceDefId: armedEntry.sourceDefId,
            playerId: armedEntry.playerId,
            baseIndex: armedEntry.baseIndex,
            cardUid: armedEntry.cardUid,
        },
        timestamp: now,
    } as SmashUpEvent;

    const abilityResult = runtimeResultToAbilityResult(executeAbilityProgram(innsmouthReturnToTheSeaProgram, {
        state,
        matchState: ctx.matchState,
        playerId: armedEntry.playerId,
        cardUid: armedEntry.cardUid ?? sourceCardUid,
        defId: armedEntry.sourceDefId,
        baseIndex: armedEntry.baseIndex,
        random: ctx.random,
        now,
    }), ctx.matchState);

    return {
        events: [consumedEvent, ...abilityResult.events],
        matchState: abilityResult.matchState,
    };
}

/**
 * 本地人 onPlay：展示牌库顶3张，将其中的"本地人"（同 defId）放入手牌，其余放牌库底
 */
function innsmouthTheLocals(ctx: AbilityContext): AbilityResult {
    const { events } = revealAndPickFromDeck({
        state: ctx.state,
        random: ctx.random,
        playerId: ctx.playerId,
        count: 3,
        predicate: card => matchesDefId(card.defId, 'innsmouth_the_locals'),
        maxPick: 3,
        revealTo: 'all', // 展示牌库顶给所有人看
        reason: 'innsmouth_the_locals',
        now: ctx.now,
    });
    
    return { events };
}

const innsmouthMysteriesOfTheDeepPromptProgram = createPromptProgram<InnsmouthPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'innsmouth_mysteries_of_the_deep',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `innsmouth_mysteries_of_the_deep_${context.now}`,
        context.playerId,
        '是否额外抽2张牌+2张疯狂卡？',
        [
            {
                id: 'yes',
                label: '是 - 额外抽2张牌+2张疯狂卡',
                labelKey: 'ui.innsmouth_mysteries_of_the_deep_yes_option',
                value: { accept: true },
                displayMode: 'button' as const,
            },
            {
                id: 'no',
                label: '否 - 不额外抽牌',
                labelKey: 'ui.innsmouth_mysteries_of_the_deep_no_option',
                value: { accept: false },
                displayMode: 'button' as const,
            },
        ],
        {
            sourceId: 'innsmouth_mysteries_of_the_deep',
            targetType: 'button',
            titleKey: 'ui.innsmouth_mysteries_of_the_deep_title',
        },
    ),
    onResolve: (args) => {
        const { state, playerId, value, timestamp } = args;
        const { accept } = value as { accept?: boolean };
        if (!accept) return { events: [] };
        const events: SmashUpEvent[] = [];
        const player = state.core.players[playerId];
        if (player) {
            events.push(...buildStandardDrawEventsFromRuntimeContext(args, playerId, 2));
        }
        const madnessEvt = drawMadnessCards(playerId, 2, state.core, 'innsmouth_mysteries_of_the_deep', timestamp);
        if (madnessEvt) events.push(madnessEvt);
        return { events };
    },
});

/**
 * 深潜者的秘密 onPlay：如果你在一个基地有 3+ 同名随从，抽 3 张牌
 * 之后可选额外抽 2 张牌并获得 1 张疯狂卡牌
 */
const innsmouthMysteriesOfTheDeepProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    // 检查是否有基地上有3+同名己方随从
    let hasTriple = false;
    for (const base of ctx.state.bases) {
        const myMinions = base.minions.filter(m => m.controller === ctx.playerId);
        const nameCount: Record<string, number> = {};
        for (const m of myMinions) {
            const normalizedDefId = normalizePodDefId(m.defId) ?? m.defId;
            nameCount[normalizedDefId] = (nameCount[normalizedDefId] || 0) + 1;
        }
        if (Object.values(nameCount).some(c => c >= 3)) {
            hasTriple = true;
            break;
        }
    }
    if (!hasTriple) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };

    const events: SmashUpEvent[] = buildStandardDrawEvents(ctx.state, ctx.playerId, 3, ctx.random, ctx.now);
    return {
        events,
        context: { matchState: ctx.matchState, playerId: ctx.playerId, now: ctx.now },
        nextProgram: innsmouthMysteriesOfTheDeepPromptProgram,
    };
});
/**
 * 宗教圆环 talent：额外打出一个与此基地上随从同名的随从到这里
 * MVP：检查手牌是否有匹配随从，如有则授予1个额外随从额度?
 */
function innsmouthSacredCircle(ctx: AbilityContext): AbilityResult {
    // 找到 sacred_circle 所在基地
    let sacredBaseIndex = -1;
    for (let i = 0; i < ctx.state.bases.length; i++) {
        if (ctx.state.bases[i].ongoingActions.some(o => o.uid === ctx.cardUid)) {
            sacredBaseIndex = i;
            break;
        }
    }
    if (sacredBaseIndex === -1) return { events: [] };

    const base = ctx.state.bases[sacredBaseIndex];
    const minionDefIds = new Set(base.minions.map(m => m.defId));
    if (minionDefIds.size === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };

    // 检查手牌是否有同名随从
    const player = ctx.state.players[ctx.playerId];
    const hasMatch = player.hand.some(c => c.type === 'minion' && minionDefIds.has(c.defId));
    if (!hasMatch) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };

    return { events: [grantExtraMinion(ctx.playerId, 'innsmouth_sacred_circle', ctx.now, sacredBaseIndex, { sameNameOnly: true })] };
}

const innsmouthSpreadingTheWordPromptProgram = createPromptProgram<InnsmouthPromptContext & { matchingDefIds: string[] }, SmashUpCore, SmashUpEvent>({
    sourceId: 'innsmouth_spreading_the_word',
    buildInteraction: (context) => {
        const player = context.matchState.core.players[context.playerId];
        return createAbilityRuntimeSimpleChoice(
            `innsmouth_spreading_the_word_${context.now}`,
            context.playerId,
            '选择一个随从名（额外打出至多2个同名随从）',
            context.matchingDefIds.map((defId, index) => {
                const def = getCardDef(defId);
                const name = def?.name ?? defId;
                const count = player.hand.filter(card => card.type === 'minion' && card.defId === defId).length;
                return { id: `name-${index}`, label: `${name}（手牌中有 ${count} 张）`, value: { defId } };
            }),
            {
                sourceId: 'innsmouth_spreading_the_word',
                targetType: 'generic',
                titleKey: 'ui.innsmouth_spreading_the_word_title',
            },
        );
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        const { defId } = value as { defId?: string };
        if (!defId) return { events: [] };
        const player = state.core.players[playerId];
        const matchCount = player.hand.filter(card => card.type === 'minion' && card.defId === defId).length;
        const grantCount = Math.min(2, matchCount);
        const events: SmashUpEvent[] = [];
        for (let index = 0; index < grantCount; index++) {
            events.push(grantContextualExtraMinion({ playerId, now: timestamp, matchState: state }, 'innsmouth_spreading_the_word', undefined, { sameNameOnly: true, sameNameDefId: defId }));
        }
        return { events };
    },
});

/**
 * 散播谣言 onPlay：额外打出至多两个与场中一个随从同名的随从。
 * "一个随从" → 玩家先选择场上一个随从名，然后可打出至多2个同名随从
 */
const innsmouthSpreadingTheWordProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    // 收集所有在场随从的 defId（去重）
    const inPlayDefIds = new Set<string>();
    for (const base of ctx.state.bases) {
        for (const m of base.minions) {
            inPlayDefIds.add(m.defId);
        }
    }
    if (inPlayDefIds.size === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };

    // 检查手牌中有哪些 defId 匹配在场随从
    const player = ctx.state.players[ctx.playerId];
    const matchingDefIds = new Set<string>();
    for (const c of player.hand) {
        if (c.type === 'minion' && inPlayDefIds.has(c.defId)) {
            matchingDefIds.add(c.defId);
        }
    }
    if (matchingDefIds.size === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };

    const defIdArray = Array.from(matchingDefIds);
    if (!ctx.matchState) return { events: [] };
    return {
        events: [],
        context: {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            matchingDefIds: defIdArray,
        },
        nextProgram: innsmouthSpreadingTheWordPromptProgram,
    };
});
