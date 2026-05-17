/**
 * 大杀四方 - 幽灵派系能力
 *
 * 主题：手牌少时获得增益、弃牌操作?
 */

import { registerAbilityProgram, registerSimpleAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { grantContextualExtraMinion, grantContextualExtraAction, destroyMinion, getMinionPower, buildMinionTargetOptions, buildBaseTargetOptions, recoverCardsFromDiscard, buildAbilityFeedback, buildStandardDrawEvents } from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type { VpAwardedEvent, SmashUpEvent, MinionPlayedEvent, OngoingDetachedEvent, CardsDiscardedEvent, MinionControlChangedEvent, SmashUpCore, CardInstance } from '../domain/types';
import type { MinionCardDef } from '../domain/types';
import { registerProtection } from '../domain/ongoingEffects';
import type { ProtectionCheckContext } from '../domain/ongoingEffects';
import { registerDiscardPlayProvider } from '../domain/discardPlayability';
import { getCardDef, getBaseDef } from '../data/cards';
import type { InteractionDescriptor, PromptOption } from '../../../engine/systems/InteractionSystem';
import type { MatchState, PlayerId } from '../../../engine/types';
import {
    createAbilityRuntimeSimpleChoice,
    createBranchProgram,
    createEffectProgram,
    createPromptProgram,
} from '../domain/abilityRuntime';
import { validateDiscardMinionPlaySemantics } from '../domain/playLegality';

/** 注册幽灵派系所有能力*/
export function registerGhostAbilities(): void {
    // 幽灵 onPlay：弃一张手牌
    registerAbilityProgram('ghost_ghost', 'onPlay', {
        program: ghostGhostProgram,
        createContext: createGhostGhostContext,
    });
    // 招魂（行动卡）：手牌堆?时抽牌??
    registerSimpleAbility('ghost_seance', 'onPlay', ghostSeance);
    // 阴暗交易（行动卡）：手牌堆?时获得?VP
    registerSimpleAbility('ghost_shady_deal', 'onPlay', ghostShadyDeal);
    // 悄然而至（行动卡）：额外打出一个随从和一个行动
    registerSimpleAbility('ghost_ghostly_arrival', 'onPlay', ghostGhostlyArrival);
    // 灵魂（随从onPlay）：弃等量力量的牌消灭一个随从
    registerAbilityProgram('ghost_spirit', 'onPlay', {
        program: ghostSpiritProgram,
        createContext: createGhostSpiritContext,
    });

    // === ongoing 效果注册 ===
    // ghost_incorporeal: 打出到随从上，持续：该随从不受其他玩家卡牌影响?
    registerProtection('ghost_incorporeal', 'affect', ghostIncorporealChecker);
    registerProtection('ghost_incorporeal_pod', 'affect', ghostIncorporealChecker);
    // ghost_haunting: 持续：手牌≤2时，本随从不受其他玩家卡牌影响?
    registerProtection('ghost_haunting', 'affect', ghostHauntingChecker);

    // ghost_make_contact: ongoing 卡，附着到对手随从上改变控制权
    registerSimpleAbility('ghost_make_contact', 'onPlay', ghostMakeContact);
    // 亡者崛起：弃牌→从弃牌堆打出力?弃牌数的额外随从
    registerAbilityProgram('ghost_the_dead_rise', 'onPlay', {
        program: ghostTheDeadRiseProgram,
        createContext: createGhostTheDeadRiseContext,
    });
    // 越过边界：选一个卡名，取回弃牌堆中所有同名随从
    registerAbilityProgram('ghost_across_the_divide', 'onPlay', {
        program: ghostAcrossTheDivideProgram,
        createContext: createGhostAcrossTheDivideContext,
    });

    // === POD 版专属能力注册 ===
    // ghost_make_contact_pod：打出时若有手牌则自毁，否则控制随从
    registerSimpleAbility('ghost_make_contact_pod', 'onPlay', ghostMakeContactPod);

    // === 弃牌堆出牌能力注册 ===
    // 幽灵之主：手牌≤2时可从弃牌堆打出（替代正常随从打出，消耗随从额度）
    registerDiscardPlayProvider({
        id: 'ghost_spectre',
        getPlayableCards(core, playerId) {
            const player = core.players[playerId];
            if (!player) return [];
            // 手牌≤2 时才激活
            if (player.hand.length > 2) return [];
            // 需要有随从额度才能打出（"任何你可以打出一个随从的时候"）
            if (player.minionsPlayed >= player.minionLimit) return [];
            const cards = player.discard.filter(c => c.defId === 'ghost_spectre' || c.defId === 'ghost_spectre_pod');
            if (cards.length === 0) return [];
            return cards.map(card => ({
                card,
                allowedBaseIndices: 'all' as const,
                consumesNormalLimit: true, // 消耗正常随从额度
                sourceId: 'ghost_spectre',
                defId: card.defId,
                power: (getCardDef(card.defId) as MinionCardDef | undefined)?.power ?? 0,
                name: (getCardDef(card.defId) as MinionCardDef | undefined)?.name ?? card.defId,
            }));
        },
    });
}

type GhostPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
};

type GhostGhostContext = GhostPromptContext & {
    playedCardUid: string;
};

type GhostSpiritCandidate = {
    uid: string;
    defId: string;
    baseIndex: number;
    label: string;
};

type GhostSpiritContext = GhostPromptContext & {
    playedCardUid: string;
    candidates: GhostSpiritCandidate[];
};

type GhostSpiritDiscardContext = GhostPromptContext & {
    minionUid: string;
    baseIndex: number;
    requiredCount: number;
};

type GhostSpiritConfirmContext = GhostPromptContext & {
    minionUid: string;
    baseIndex: number;
};

type GhostTheDeadRiseContext = GhostPromptContext & {
    playedCardUid: string;
    maxDiscard: number;
};

type GhostDeadRiseCandidate = {
    cardUid: string;
    defId: string;
    power: number;
    label: string;
};

type GhostTheDeadRisePlayContext = GhostPromptContext & {
    discardCount: number;
    eligible: GhostDeadRiseCandidate[];
};

type GhostTheDeadRiseBaseContext = GhostPromptContext & {
    cardUid: string;
    defId: string;
    power: number;
};

type GhostAcrossTheDivideGroup = {
    defId: string;
    uids: string[];
    name: string;
};

type GhostAcrossTheDivideContext = GhostPromptContext & {
    groups: GhostAcrossTheDivideGroup[];
};

type GhostCardChoiceValue = { cardUid: string; defId: string };
type GhostSkipValue = { skip: true };
type GhostBaseChoiceValue = { baseIndex: number; baseDefId?: string };
type GhostSpiritChoiceValue = { minionUid?: string; baseIndex?: number; defId?: string; __cancel__?: true };
type GhostConfirmChoiceValue = { confirm?: boolean };
type GhostAcrossChoiceValue = { defId?: string; __cancel__?: true };
type GhostDeadRisePlayChoiceValue = { cardUid?: string; defId?: string; power?: number; baseIndex?: number; skip?: true };

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

function isSkipSelection(value: unknown): value is GhostSkipValue {
    return typeof value === 'object' && value !== null && 'skip' in value;
}

function isCancelSelection(value: unknown): value is { __cancel__: true } {
    return typeof value === 'object' && value !== null && '__cancel__' in value;
}

function getSingleCardSelection(value: unknown): GhostCardChoiceValue | null {
    if (typeof value !== 'object' || value === null) return null;
    const record = value as { cardUid?: unknown; defId?: unknown };
    if (typeof record.cardUid !== 'string' || typeof record.defId !== 'string') return null;
    return { cardUid: record.cardUid, defId: record.defId };
}

function getSelectedCardUids(value: unknown): string[] {
    const selected = Array.isArray(value) ? value : value ? [value] : [];
    return selected
        .map((item) => (typeof item === 'object' && item !== null ? (item as { cardUid?: unknown }).cardUid : undefined))
        .filter((cardUid): cardUid is string => typeof cardUid === 'string');
}

function buildGhostHandOptions(
    hand: CardInstance[],
    excludedUid?: string,
    options?: { includeSkip?: boolean; skipLabel?: string },
): PromptOption<GhostCardChoiceValue | GhostSkipValue>[] {
    const cards = hand.filter((card) => card.uid !== excludedUid);
    const cardOptions: PromptOption<GhostCardChoiceValue | GhostSkipValue>[] = cards.map((card, index) => {
        const def = getCardDef(card.defId);
        return {
            id: `card-${index}`,
            label: def?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId },
            displayMode: 'card' as const,
        };
    });
    if (!options?.includeSkip) {
        return cardOptions;
    }
    return [
        ...cardOptions,
        {
            id: 'skip',
            label: options.skipLabel ?? '跳过',
            value: { skip: true },
            displayMode: 'button' as const,
        },
    ];
}

function buildGhostGhostOptionsFromState(
    core: SmashUpCore,
    playerId: PlayerId,
    playedCardUid: string,
): PromptOption<GhostCardChoiceValue | GhostSkipValue>[] {
    const player = core.players[playerId];
    if (!player) return [{ id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const }];
    return buildGhostHandOptions(player.hand, playedCardUid, { includeSkip: true });
}

function buildGhostSpiritCandidates(
    core: SmashUpCore,
    playerId: PlayerId,
    playedCardUid: string,
): GhostSpiritCandidate[] {
    const player = core.players[playerId];
    if (!player) return [];
    const discardableCount = player.hand.filter((card) => card.uid !== playedCardUid).length;
    if (discardableCount <= 0) return [];

    const targets: GhostSpiritCandidate[] = [];
    for (let i = 0; i < core.bases.length; i += 1) {
        for (const minion of core.bases[i].minions) {
            const power = getMinionPower(core, minion, i);
            if (power > discardableCount) continue;
            const def = getCardDef(minion.defId) as MinionCardDef | undefined;
            const baseDef = getBaseDef(core.bases[i].defId);
            targets.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: i,
                label: `${def?.name ?? minion.defId} (力量 ${power}, 需要弃 ${power} 张牌) @ ${baseDef?.name ?? `基地 ${i + 1}`}`,
            });
        }
    }
    return targets;
}

function buildGhostSpiritTargetOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    playedCardUid: string,
) {
    return buildMinionTargetOptions(
        buildGhostSpiritCandidates(core, playerId, playedCardUid),
        { state: core, sourcePlayerId: playerId, effectType: 'destroy' },
    );
}

function buildGhostSpiritDiscardOptions(
    core: SmashUpCore,
    playerId: PlayerId,
): PromptOption<GhostCardChoiceValue | GhostSkipValue>[] {
    const player = core.players[playerId];
    if (!player) return [{ id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const }];
    return buildGhostHandOptions(player.hand, undefined, { includeSkip: true });
}

function buildGhostDeadRiseCandidatesFromCards(
    cards: CardInstance[],
    discardCount: number,
): GhostDeadRiseCandidate[] {
    return cards
        .filter((card) => {
            if (card.type !== 'minion') return false;
            const def = getCardDef(card.defId) as MinionCardDef | undefined;
            return def !== undefined && def.power < discardCount;
        })
        .map((card) => {
            const def = getCardDef(card.defId) as MinionCardDef | undefined;
            const power = def?.power ?? 0;
            return {
                cardUid: card.uid,
                defId: card.defId,
                power,
                label: `${def?.name ?? card.defId} (力量 ${power})`,
            };
        });
}

function buildGhostDeadRisePlayOptions(
    eligible: GhostDeadRiseCandidate[],
): PromptOption<GhostDeadRisePlayChoiceValue>[] {
    return [
        ...eligible.map((card, index) => ({
            id: `card-${index}`,
            label: card.label,
            value: { cardUid: card.cardUid, defId: card.defId, power: card.power },
            displayMode: 'card' as const,
        })),
        {
            id: 'skip',
            label: '跳过',
            value: { skip: true },
            displayMode: 'button' as const,
        },
    ];
}

function buildGhostAcrossTheDivideGroups(cards: CardInstance[]): GhostAcrossTheDivideGroup[] {
    const groups = new Map<string, GhostAcrossTheDivideGroup>();
    for (const card of cards) {
        if (card.type !== 'minion') continue;
        const existing = groups.get(card.defId);
        if (existing) {
            existing.uids.push(card.uid);
            continue;
        }
        const def = getCardDef(card.defId);
        groups.set(card.defId, {
            defId: card.defId,
            uids: [card.uid],
            name: def?.name ?? card.defId,
        });
    }
    return Array.from(groups.values());
}

function buildGhostAcrossTheDivideOptions(
    groups: GhostAcrossTheDivideGroup[],
): PromptOption<GhostAcrossChoiceValue>[] {
    return groups.map((group, index) => ({
        id: `group-${index}`,
        label: `${group.name} (×${group.uids.length})`,
        value: { defId: group.defId },
    }));
}

function createGhostGhostContext(ctx: AbilityContext): GhostGhostContext {
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        playedCardUid: ctx.cardUid,
    };
}

function createGhostSpiritContext(ctx: AbilityContext): GhostSpiritContext {
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        playedCardUid: ctx.cardUid,
        candidates: buildGhostSpiritCandidates(ctx.state, ctx.playerId, ctx.cardUid),
    };
}

function createGhostTheDeadRiseContext(ctx: AbilityContext): GhostTheDeadRiseContext {
    const player = ctx.state.players[ctx.playerId];
    const discardable = player?.hand.filter((card) => card.uid !== ctx.cardUid) ?? [];
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        playedCardUid: ctx.cardUid,
        maxDiscard: discardable.length,
    };
}

function createGhostAcrossTheDivideContext(ctx: AbilityContext): GhostAcrossTheDivideContext {
    const player = ctx.state.players[ctx.playerId];
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        groups: buildGhostAcrossTheDivideGroups(player?.discard ?? []),
    };
}

const ghostGhostPromptProgram = createPromptProgram<GhostGhostContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'ghost_ghost',
    buildInteraction: (context) => attachOptionsGenerator(
        createAbilityRuntimeSimpleChoice(
            `ghost_ghost_${context.now}`,
            context.playerId,
            '选择要弃掉的手牌（可跳过）',
            buildGhostGhostOptionsFromState(context.matchState.core, context.playerId, context.playedCardUid),
            {
                sourceId: 'ghost_ghost',
                targetType: 'hand',
                autoRefresh: 'hand',
                responseValidationMode: 'live',
            },
        ),
        (state) => buildGhostGhostOptionsFromState(state.core, context.playerId, context.playedCardUid),
    ),
    onResolve: ({ playerId, value, timestamp }) => {
        if (isSkipSelection(value)) return { events: [] };
        const selection = getSingleCardSelection(value);
        if (!selection) return { events: [] };
        return {
            events: [{
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId, cardUids: [selection.cardUid] },
                timestamp,
            } as CardsDiscardedEvent],
        };
    },
});

const ghostGhostProgram = createBranchProgram<GhostGhostContext, SmashUpCore, SmashUpEvent>({
    when: (context) => buildGhostGhostOptionsFromState(
        context.matchState.core,
        context.playerId,
        context.playedCardUid,
    ).filter((option) => !isSkipSelection(option.value)).length === 0,
    then: createEffectProgram((context) => ({
        events: [buildAbilityFeedback(context.playerId, 'feedback.hand_empty', context.now)],
    })),
    else: ghostGhostPromptProgram,
});

/** 招魂 onPlay：手牌≤2时抽牌??*/
function ghostSeance(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const handAfterPlay = ctx.handSizeAfterPlay ?? (player.hand.length - 1);
    if (handAfterPlay > 2) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };
    const drawCount = Math.max(0, 5 - handAfterPlay);
    if (drawCount === 0) return { events: [] };
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, drawCount, ctx.random, ctx.now) };
}

/** 阴暗交易 onPlay：手牌≤2时获得?VP */
function ghostShadyDeal(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const handAfterPlay = ctx.handSizeAfterPlay ?? (player.hand.length - 1);
    if (handAfterPlay > 2) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };
    const evt: VpAwardedEvent = {
        type: SU_EVENTS.VP_AWARDED,
        payload: { playerId: ctx.playerId, amount: 1, reason: 'ghost_shady_deal' },
        timestamp: ctx.now,
    };
    return { events: [evt] };
}

/** 悄然而至 onPlay：额外打出一个随从和一个行动*/
function ghostGhostlyArrival(ctx: AbilityContext): AbilityResult {
    return {
        events: [
            grantContextualExtraMinion(ctx, 'ghost_ghostly_arrival'),
            grantContextualExtraAction(ctx, 'ghost_ghostly_arrival'),
        ],
    };
}

// ghost_haunting (ongoing) - 已通过 ongoingModifiers 系统实现力量修正?3 力量部分）?
//   不受影响部分通过 ghost_incorporeal protection 实现（注册在 registerGhostAbilities 中）
// ghost_door_to_the_beyond (ongoing) - 已通过 ongoingModifiers 系统实现力量修正（手牌≤2时同基地己方随从+2?

/**
 * ghost_incorporeal 保护检查：ghost_haunting 附着的随从不受其他玩家卡牌影响?
 * 
 * 规则：附着了?ghost_haunting 的随从不受其他玩家卡牌影响?
 * 实现：检查目标随从是否附着了?ghost_haunting，且攻击者不是随从控制者?
 */
function ghostIncorporealChecker(ctx: ProtectionCheckContext): boolean {
    // 检查目标随从是否附着了?ghost_incorporeal
    const hasIncorporeal = ctx.targetMinion.attachedActions.some(
        a => a.defId === 'ghost_incorporeal' || a.defId === 'ghost_incorporeal_pod'
    );
    if (!hasIncorporeal) return false;
    // 只保护不受其他玩家影响?
    return ctx.sourcePlayerId !== ctx.targetMinion.controller;
}

/**
 * ghost_haunting 保护检查：手牌堆?时，不散阴魂本随从不受其他玩家卡牌影响?
 */
function ghostHauntingChecker(ctx: ProtectionCheckContext): boolean {
    if (ctx.targetMinion.defId !== 'ghost_haunting') return false;
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    const player = ctx.state.players[ctx.targetMinion.controller];
    if (!player) return false;
    return player.hand.length <= 2;
}

/**
 * ghost_make_contact onPlay：控制对手一个随从
 * 前置条件：你只能在本卡是你的唯一手牌时打出它
 *
 * 注意：附着成功时显式发出 MINION_CONTROL_CHANGED，
 * reducer 只消费该事件更新控制者，不再在 ONGOING_ATTACHED 中偷偷改控制权。
 * 打出时 UI 层已通过 ongoing-minion 模式让玩家选择了目标随从（targetMinionUid），
 * 无需再弹交互——只需验证前置条件即可。
 */
function ghostMakeContact(ctx: AbilityContext): AbilityResult {
    // 前置条件：本卡必须是唯一手牌（打出后手牌为空）
    const player = ctx.state.players[ctx.playerId];
    const otherHandCards = player.hand.filter(c => c.uid !== ctx.cardUid);
    if (otherHandCards.length > 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };

    return { events: buildMakeContactControlChangeEvents(ctx) };
}

const ghostSpiritConfirmPromptProgram = createPromptProgram<GhostSpiritConfirmContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'ghost_spirit_confirm',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `ghost_spirit_confirm_${context.now}`,
        context.playerId,
        '是否消灭该随从？（力量 0，无需弃牌）',
        [
            { id: 'yes', label: '消灭', value: { confirm: true }, displayMode: 'button' as const },
            { id: 'no', label: '跳过', value: { confirm: false }, displayMode: 'button' as const },
        ],
        {
            sourceId: 'ghost_spirit_confirm',
            targetType: 'button',
        },
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const choice = value as GhostConfirmChoiceValue | undefined;
        if (!choice?.confirm) return { events: [] };
        const base = state.core.bases[context.baseIndex];
        const target = base?.minions.find((minion) => minion.uid === context.minionUid);
        if (!target) return { events: [] };
        return {
            events: [destroyMinion(target.uid, target.defId, context.baseIndex, target.owner, playerId, 'ghost_spirit', timestamp)],
        };
    },
});

const ghostSpiritDiscardPromptProgram = createPromptProgram<GhostSpiritDiscardContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'ghost_spirit_discard',
    buildInteraction: (context) => attachOptionsGenerator(
        createAbilityRuntimeSimpleChoice(
            `ghost_spirit_discard_${context.now}`,
            context.playerId,
            `选择 ${context.requiredCount} 张手牌弃置来消灭该随从（可跳过）`,
            buildGhostSpiritDiscardOptions(context.matchState.core, context.playerId),
            {
                sourceId: 'ghost_spirit_discard',
                targetType: 'hand',
                multi: { min: context.requiredCount, max: context.requiredCount },
                autoRefresh: 'hand',
                responseValidationMode: 'live',
            },
        ),
        (state) => buildGhostSpiritDiscardOptions(state.core, context.playerId),
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        if (isSkipSelection(value)) return { events: [] };
        const cardUids = getSelectedCardUids(value);
        if (cardUids.length !== context.requiredCount) return { events: [] };
        const base = state.core.bases[context.baseIndex];
        const target = base?.minions.find((minion) => minion.uid === context.minionUid);
        if (!target) return { events: [] };
        return {
            events: [
                {
                    type: SU_EVENTS.CARDS_DISCARDED,
                    payload: { playerId, cardUids },
                    timestamp,
                } as CardsDiscardedEvent,
                destroyMinion(target.uid, target.defId, context.baseIndex, target.owner, playerId, 'ghost_spirit', timestamp),
            ],
        };
    },
});

const ghostSpiritPromptProgram = createPromptProgram<GhostSpiritContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'ghost_spirit',
    buildInteraction: (context) => attachOptionsGenerator(
        createAbilityRuntimeSimpleChoice(
            `ghost_spirit_${context.now}`,
            context.playerId,
            '选择要消灭的随从（需弃等量力量的手牌）',
            buildGhostSpiritTargetOptions(context.matchState.core, context.playerId, context.playedCardUid),
            {
                sourceId: 'ghost_spirit',
                targetType: 'minion',
                autoCancelOption: true,
                responseValidationMode: 'live',
            },
        ),
        (state) => buildGhostSpiritTargetOptions(state.core, context.playerId, context.playedCardUid),
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        if (isCancelSelection(value)) return { events: [] };
        const choice = value as GhostSpiritChoiceValue | undefined;
        if (!choice?.minionUid || choice.baseIndex === undefined) return { events: [] };

        const currentCandidates = buildGhostSpiritCandidates(state.core, playerId, context.playedCardUid);
        const candidate = currentCandidates.find((item) => item.uid === choice.minionUid && item.baseIndex === choice.baseIndex);
        if (!candidate) return { events: [] };

        const base = state.core.bases[candidate.baseIndex];
        const target = base?.minions.find((minion) => minion.uid === candidate.uid);
        if (!target) return { events: [] };

        const power = getMinionPower(state.core, target, candidate.baseIndex);
        if (power === 0) {
            return {
                events: [],
                context: {
                    matchState: state,
                    playerId,
                    now: timestamp,
                    minionUid: candidate.uid,
                    baseIndex: candidate.baseIndex,
                },
                nextProgram: ghostSpiritConfirmPromptProgram,
            };
        }

        return {
            events: [],
            context: {
                matchState: state,
                playerId,
                now: timestamp,
                minionUid: candidate.uid,
                baseIndex: candidate.baseIndex,
                requiredCount: power,
            },
            nextProgram: ghostSpiritDiscardPromptProgram,
        };
    },
});

const ghostSpiritProgram = createBranchProgram<GhostSpiritContext, SmashUpCore, SmashUpEvent>({
    when: (context) => {
        const player = context.matchState.core.players[context.playerId];
        return !player || player.hand.filter((card) => card.uid !== context.playedCardUid).length === 0;
    },
    then: createEffectProgram((context) => ({
        events: [buildAbilityFeedback(context.playerId, 'feedback.hand_empty', context.now)],
    })),
    else: createBranchProgram({
        when: (context) => context.candidates.length === 0,
        then: createEffectProgram((context) => ({
            events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', context.now)],
        })),
        else: ghostSpiritPromptProgram,
    }),
});

const ghostTheDeadRiseBasePromptProgram = createPromptProgram<GhostTheDeadRiseBaseContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'ghost_the_dead_rise_base',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `ghost_the_dead_rise_base_${context.now}`,
        context.playerId,
        '亡者崛起：选择打出随从的基地',
        buildBaseTargetOptions(
            context.matchState.core.bases.map((base, index) => ({
                baseIndex: index,
                label: getBaseDef(base.defId)?.name ?? `基地 ${index + 1}`,
            })),
            context.matchState.core,
        ),
        {
            sourceId: 'ghost_the_dead_rise_base',
            targetType: 'base',
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const choice = value as GhostBaseChoiceValue | undefined;
        if (choice?.baseIndex === undefined) return { events: [] };
        if (!validateDiscardMinionPlaySemantics(state.core, playerId, {
            cardUid: context.cardUid,
            baseIndex: choice.baseIndex,
            consumesNormalLimit: false,
        }).valid) {
            return { events: [] };
        }
        return {
            events: [{
                type: SU_EVENTS.MINION_PLAYED,
                payload: {
                    playerId,
                    cardUid: context.cardUid,
                    defId: context.defId,
                    baseIndex: choice.baseIndex,
                    baseDefId: state.core.bases[choice.baseIndex]?.defId,
                    power: context.power,
                    fromDiscard: true,
                    consumesNormalLimit: false,
                    allowImplicitSource: true,
                },
                timestamp,
            } as MinionPlayedEvent],
        };
    },
});

const ghostTheDeadRisePlayPromptProgram = createPromptProgram<GhostTheDeadRisePlayContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'ghost_the_dead_rise_play',
    buildInteraction: (context) => {
        const interaction = attachOptionsGenerator(
            createAbilityRuntimeSimpleChoice(
                `ghost_the_dead_rise_play_${context.now}`,
                context.playerId,
                `选择力量<${context.discardCount}的随从从弃牌堆打出，然后点击目标基地（可跳过）`,
                buildGhostDeadRisePlayOptions(context.eligible),
                {
                    sourceId: 'ghost_the_dead_rise_play',
                    targetType: 'discard_minion',
                    autoRefresh: 'discard',
                    responseValidationMode: 'live',
                },
            ),
            (state) => buildGhostDeadRisePlayOptions(
                buildGhostDeadRiseCandidatesFromCards(
                    state.core.players[context.playerId]?.discard ?? [],
                    context.discardCount,
                ),
            ),
        );
        return {
            ...interaction,
            data: {
                ...(interaction.data ?? {}),
                allowedBaseIndices: context.matchState.core.bases.map((_base, index) => index),
            },
        };
    },
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        if (isSkipSelection(value)) return { events: [] };
        const choice = value as GhostDeadRisePlayChoiceValue | undefined;
        if (!choice?.cardUid || !choice.defId) return { events: [] };

        const eligible = buildGhostDeadRiseCandidatesFromCards(
            state.core.players[playerId]?.discard ?? [],
            context.discardCount,
        );
        const selected = eligible.find((card) => card.cardUid === choice.cardUid);
        if (!selected) return { events: [] };

        const playFromDiscard = (baseIndex: number) => {
            if (!validateDiscardMinionPlaySemantics(state.core, playerId, {
                cardUid: selected.cardUid,
                baseIndex,
                consumesNormalLimit: false,
            }).valid) {
                return { events: [] };
            }
            return {
                events: [{
                    type: SU_EVENTS.MINION_PLAYED,
                    payload: {
                        playerId,
                        cardUid: selected.cardUid,
                        defId: selected.defId,
                        baseIndex,
                        baseDefId: state.core.bases[baseIndex]?.defId,
                        power: selected.power,
                        fromDiscard: true,
                        allowImplicitSource: true,
                        consumesNormalLimit: false,
                    },
                    timestamp,
                } as MinionPlayedEvent],
            };
        };

        if (typeof choice.baseIndex === 'number') {
            return playFromDiscard(choice.baseIndex);
        }
        if (state.core.bases.length === 1) {
            return playFromDiscard(0);
        }
        return {
            events: [],
            context: {
                matchState: state,
                playerId,
                now: timestamp,
                cardUid: selected.cardUid,
                defId: selected.defId,
                power: selected.power,
            },
            nextProgram: ghostTheDeadRiseBasePromptProgram,
        };
    },
});

const ghostTheDeadRiseDiscardPromptProgram = createPromptProgram<GhostTheDeadRiseContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'ghost_the_dead_rise_discard',
    buildInteraction: (context) => attachOptionsGenerator(
        createAbilityRuntimeSimpleChoice(
            `ghost_the_dead_rise_discard_${context.now}`,
            context.playerId,
            '亡者崛起：选择要弃掉的手牌',
            buildGhostHandOptions(context.matchState.core.players[context.playerId]?.hand ?? [], context.playedCardUid, { includeSkip: true }),
            {
                sourceId: 'ghost_the_dead_rise_discard',
                targetType: 'hand',
                multi: { min: 0, max: context.maxDiscard },
                autoRefresh: 'hand',
                responseValidationMode: 'live',
            },
        ),
        (state) => buildGhostHandOptions(state.core.players[context.playerId]?.hand ?? [], context.playedCardUid, { includeSkip: true }),
    ),
    onResolve: ({ context: _context, state, playerId, value, timestamp }) => {
        if (isSkipSelection(value)) return { events: [] };
        const discardUids = getSelectedCardUids(value);
        if (discardUids.length === 0) return { events: [] };

        const discardEvent: CardsDiscardedEvent = {
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: { playerId, cardUids: discardUids },
            timestamp,
        };
        const player = state.core.players[playerId];
        const justDiscarded = player.hand.filter((card) => discardUids.includes(card.uid));
        const eligible = buildGhostDeadRiseCandidatesFromCards(
            [...player.discard, ...justDiscarded],
            discardUids.length,
        );
        if (eligible.length === 0) {
            return { events: [discardEvent] };
        }

        return {
            events: [discardEvent],
            context: {
                matchState: state,
                playerId,
                now: timestamp,
                discardCount: discardUids.length,
                eligible,
            },
            nextProgram: ghostTheDeadRisePlayPromptProgram,
        };
    },
});

const ghostTheDeadRiseProgram = createBranchProgram<GhostTheDeadRiseContext, SmashUpCore, SmashUpEvent>({
    when: (context) => context.maxDiscard === 0,
    then: createEffectProgram((context) => ({
        events: [buildAbilityFeedback(context.playerId, 'feedback.hand_empty', context.now)],
    })),
    else: ghostTheDeadRiseDiscardPromptProgram,
});

const ghostAcrossTheDividePromptProgram = createPromptProgram<GhostAcrossTheDivideContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'ghost_across_the_divide',
    buildInteraction: (context) => attachOptionsGenerator(
        createAbilityRuntimeSimpleChoice(
            `ghost_across_the_divide_${context.now}`,
            context.playerId,
            '越过边界：选择一个卡名（取回所有同名随从）',
            buildGhostAcrossTheDivideOptions(context.groups),
            {
                sourceId: 'ghost_across_the_divide',
                targetType: 'generic',
                autoCancelOption: true,
                autoRefresh: 'discard',
                responseValidationMode: 'live',
            },
        ),
        (state) => buildGhostAcrossTheDivideOptions(
            buildGhostAcrossTheDivideGroups(state.core.players[context.playerId]?.discard ?? []),
        ),
    ),
    onResolve: ({ state, playerId, value, timestamp }) => {
        if (isCancelSelection(value)) return { events: [] };
        const choice = value as GhostAcrossChoiceValue | undefined;
        if (!choice?.defId) return { events: [] };
        const sameNameMinions = (state.core.players[playerId]?.discard ?? [])
            .filter((card) => card.type === 'minion' && card.defId === choice.defId);
        if (sameNameMinions.length === 0) return { events: [] };
        return {
            events: [recoverCardsFromDiscard(
                playerId,
                sameNameMinions.map((card) => card.uid),
                'ghost_across_the_divide',
                timestamp,
            )],
        };
    },
});

const ghostAcrossTheDivideProgram = createBranchProgram<GhostAcrossTheDivideContext, SmashUpCore, SmashUpEvent>({
    when: (context) => context.groups.length === 0,
    then: createEffectProgram((context) => ({
        events: [buildAbilityFeedback(context.playerId, 'feedback.discard_empty', context.now)],
    })),
    else: ghostAcrossTheDividePromptProgram,
});

// ============================================================================
// POD 版幽灵能力函数
// ============================================================================

/**
 * ghost_make_contact_pod onPlay：
 * 打出到随从时检查手牌——
 *   - 有手牌 → 立即自毁（产生 ONGOING_DETACHED，控制权不转移）
 *   - 无手牌 → 显式发出控制权变更事件
 */
function ghostMakeContactPod(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const handAfterPlay = ctx.handSizeAfterPlay ?? player.hand.filter(c => c.uid !== ctx.cardUid).length;
    // 行动卡打出后仍有手牌则自毁
    if (handAfterPlay > 0) {
        const detachEvt: OngoingDetachedEvent = {
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: {
                cardUid: ctx.cardUid,
                defId: ctx.defId,
                ownerId: ctx.playerId,
                reason: 'ghost_make_contact_pod_has_hand',
            },
            timestamp: ctx.now,
        };
        return { events: [detachEvt] };
    }
    return { events: buildMakeContactControlChangeEvents(ctx) };
}

function buildMakeContactControlChangeEvents(ctx: AbilityContext): SmashUpEvent[] {
    if (ctx.baseIndex === undefined || !ctx.targetMinionUid) return [];
    const base = ctx.state.bases[ctx.baseIndex];
    const targetMinion = base?.minions.find(minion => minion.uid === ctx.targetMinionUid);
    if (!targetMinion || targetMinion.controller === ctx.playerId) return [];

    const controlChangedEvent: MinionControlChangedEvent = {
        type: SU_EVENTS.MINION_CONTROL_CHANGED,
        payload: {
            minionUid: targetMinion.uid,
            minionDefId: targetMinion.defId,
            baseIndex: ctx.baseIndex,
            ownerId: targetMinion.owner,
            fromControllerId: targetMinion.controller,
            toControllerId: ctx.playerId,
            sourcePlayerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: ctx.baseIndex,
            reason: ctx.defId,
        },
        timestamp: ctx.now,
    };

    return [controlChangedEvent];
}




