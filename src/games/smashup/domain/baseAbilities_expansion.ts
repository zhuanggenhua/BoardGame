/**
 * 大杀四方 - 扩展包基地能力（克苏鲁 / AL9000 / Pretty Pretty）
 *
 * 从 baseAbilities.ts 拆分，避免单文件超过 1000 行。
 * 在 registerBaseAbilities() 末尾调用 registerExpansionBaseAbilities()。
 * 在 registerBaseInteractionHandlers() 末尾调用 registerExpansionBaseInteractionHandlers()。
 */

import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import type {
    SmashUpCore,
    SmashUpEvent,
    MinionDestroyedEvent,
    MinionPlayedEvent,
    PendingPostScoringAction,
} from './types';
import { SU_EVENTS, MADNESS_CARD_DEF_ID } from './types';
import { getEffectivePower } from './ongoingModifiers';
import {
    grantContextualExtraAction,
    grantContextualExtraMinion,
    grantExtraAction,
    addTempPower,
    recoverCardsFromDiscard,
    buildValidatedMoveEvents,
    buildValidatedDestroyEvents,
    buildValidatedCardToDeckBottomEvents,
    buildStandardDrawEvents,
    drawMadnessCards,
    findMinionOnBases,
    getAvailableSpiritOfTheForestOrTitan,
    markSpiritOfTheForestOrUsed,
} from './abilityHelpers';
import { buildBuryCardEvents } from './bury';
import { createSimpleChoice, queueInteraction, type PromptOption } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from './abilityInteractionHandlers';
import { registerBaseAbility, registerExtended as registerExtendedBase, type BaseAbilityContext } from './baseAbilities';
import { registerProtection, registerTrigger } from './ongoingEffects';
import type { ProtectionCheckContext } from './ongoingEffects';
import { getCardDef, getMinionDef, getBaseDef } from '../data/cards';
import { getPlayerLabel } from './utils';
import {
    appendPendingPostScoringActions,
    getDeferredReplacementBaseDefId,
    isScoringSessionAwaitingDeferredResolution,
} from './scoringSession';
import {
    queueBranchingChoice,
    type BranchExecutor,
    type BranchingChoiceOption,
    type BranchingChoiceUpgrade,
} from './branchingChoice';
import { executeAbilityProgram } from './abilityRuntime';
import {
    createEffectDslProgram,
    grantExtraActionPrimitive,
    grantExtraMinionPrimitive,
} from './effectDsl';

function getContinuationContext<T>(interactionData: Record<string, unknown> | undefined): T | undefined {
    return interactionData?.continuationContext as T | undefined;
}

function isFirstMinionPlayedByPlayerAtBaseThisTurn(ctx: BaseAbilityContext): boolean {
    const player = ctx.state.players[ctx.playerId];
    return (player?.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0) === 1;
}

function getSpiritOptionalBothUpgradeForBase(
    state: SmashUpCore,
    playerId: string,
    now: number,
): BranchingChoiceUpgrade | undefined {
    const spirit = getAvailableSpiritOfTheForestOrTitan(state, playerId);
    if (!spirit) return undefined;
    return {
        mode: 'optional-both',
        consumeEvents: [markSpiritOfTheForestOrUsed(spirit.uid, state.turnNumber, now)],
    };
}

function createBaseFairyRingBranchOption(
    id: string,
    label: string,
    branchId: string,
    value?: Record<string, unknown>,
    footprint?: import('./types').SmashUpReactionResourceFootprint,
): BranchingChoiceOption {
    return {
        id,
        label,
        branchId,
        ...(value ? { value } : {}),
        displayMode: 'button',
        ...(footprint ? { footprint } : {}),
    };
}

type BaseFairyRingBranchEffectContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    random: RandomFn;
    baseIndex: number;
};

const baseFairyRingExtraMinionPrimitive = grantExtraMinionPrimitive<BaseFairyRingBranchEffectContext>({
    playerId: (context) => context.playerId,
    reason: 'base_fairy_ring',
    now: (context) => context.now,
    matchState: (context) => context.matchState,
    restrictToBase: (context) => context.baseIndex,
});

const baseFairyRingExtraActionPrimitive = grantExtraActionPrimitive<BaseFairyRingBranchEffectContext>({
    playerId: (context) => context.playerId,
    reason: 'base_fairy_ring',
    now: (context) => context.now,
    matchState: (context) => context.matchState,
});

const baseFairyRingExtraMinionProgram = createEffectDslProgram(baseFairyRingExtraMinionPrimitive);
const baseFairyRingExtraActionProgram = createEffectDslProgram(baseFairyRingExtraActionPrimitive);

function createBaseFairyRingBranchEffectContext(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    random: RandomFn,
    timestamp: number,
    baseIndex: number,
): BaseFairyRingBranchEffectContext {
    return { matchState: state, playerId, random, now: timestamp, baseIndex };
}

const runBaseFairyRingBranch: BranchExecutor = ({ state, playerId, selection, planContext, random, timestamp }) => {
    const branchId = selection.branchId;
    if (branchId === 'skip') {
        return { state, events: [] };
    }
    const continuation = planContext as { baseIndex?: number } | undefined;
    if (continuation?.baseIndex === undefined) return { state, events: [] };
    const effectContext = createBaseFairyRingBranchEffectContext(
        state,
        playerId,
        random,
        timestamp,
        continuation.baseIndex,
    );
    if (branchId === 'extra_minion') {
        const result = executeAbilityProgram(baseFairyRingExtraMinionProgram, effectContext);
        return {
            state,
            events: result.events,
        };
    }
    if (branchId === 'extra_action') {
        const result = executeAbilityProgram(baseFairyRingExtraActionProgram, effectContext);
        return {
            state,
            events: result.events,
        };
    }
    return { state, events: [] };
};

// ============================================================================
// 克苏鲁扩展基地能力
// ============================================================================

/** 注册扩展包基地能力*/
export function registerExpansionBaseAbilities(): void {
    // ── 人鱼水池（Mermaid Pool）─────────────────────────────────
    registerBaseAbility('base_mermaid_pool', 'onTurnStart', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base || !ctx.matchState) return { events: [] };
        const hasOwnMinionHere = base.minions.some(minion => minion.controller === ctx.playerId);
        if (!hasOwnMinionHere) return { events: [] };

        const candidates: Array<{ minionUid: string; minionDefId: string; fromBaseIndex: number; label: string }> = [];
        ctx.state.bases.forEach((candidateBase, baseIndex) => {
            if (baseIndex === ctx.baseIndex) return;
            const baseName = getBaseDef(candidateBase.defId)?.name ?? `基地 ${baseIndex + 1}`;
            candidateBase.minions
                .filter(minion => minion.controller !== ctx.playerId)
                .forEach((minion) => {
                    const minionName = getCardDef(minion.defId)?.name ?? minion.defId;
                    candidates.push({
                        minionUid: minion.uid,
                        minionDefId: minion.defId,
                        fromBaseIndex: baseIndex,
                        label: `${minionName} @ ${baseName}`,
                    });
                });
        });
        if (candidates.length === 0) return { events: [] };

        const options: PromptOption<Record<string, unknown>>[] = [
            { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
            ...candidates.map((candidate, index) => ({
                id: `minion-${index}`,
                label: candidate.label,
                value: candidate,
                _source: 'field' as const,
                displayMode: 'card' as const,
            })),
        ];
        const interaction = createSimpleChoice(
            `base_mermaid_pool_${ctx.now}`,
            ctx.playerId,
            '人鱼水池：你可以移动另一位玩家的一个仆从到这里',
            options,
            { sourceId: 'base_mermaid_pool', targetType: 'minion' },
        );
        return {
            events: [],
            matchState: queueInteraction(ctx.matchState, {
                ...interaction,
                data: { ...interaction.data, continuationContext: { targetBaseIndex: ctx.baseIndex } },
            }),
        };
    }, {
    });

    // ── 藏骨堂（Ossuary）──────────────────────────────────────
    registerBaseAbility('base_ossuary', 'onTurnStart', (ctx) => {
        const player = ctx.state.players[ctx.playerId];
        if (!player || !ctx.matchState) return { events: [] };
        const discardMinions = player.discard.filter(card => {
            if (card.type !== 'minion') return false;
            const def = getCardDef(card.defId);
            return !!def && def.type === 'minion' && def.power <= 3;
        });
        if (discardMinions.length === 0) return { events: [] };

        const options: PromptOption<Record<string, unknown>>[] = [
            { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
            ...discardMinions.map((card, index) => ({
                id: `discard-${index}`,
                label: getCardDef(card.defId)?.name ?? card.defId,
                value: { cardUid: card.uid, defId: card.defId },
                _source: 'discard' as const,
                displayMode: 'card' as const,
            })),
        ];
        const interaction = createSimpleChoice(
            `base_ossuary_${ctx.now}`,
            ctx.playerId,
            '藏骨堂：你可以从弃牌堆埋葬一个力量 3 或更少的仆从到这里',
            options,
            { sourceId: 'base_ossuary', targetType: 'discard' },
        );
        return {
            events: [],
            matchState: queueInteraction(ctx.matchState, {
                ...interaction,
                data: { ...interaction.data, continuationContext: { targetBaseIndex: ctx.baseIndex } },
            }),
        };
    }, {
    });

    // ── 竞技场（Arena）───────────────────────────────────────────
    // 第一次在此基地打出随从后，可选：额外打行动 或 抽一张牌
    registerBaseAbility('base_arena', 'onMinionPlayed', (ctx) => {
        const player = ctx.state.players[ctx.playerId];
        if (!player || !ctx.matchState) return { events: [] };
        const playedAtBase = player.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0;
        if (playedAtBase !== 1) return { events: [] };

        const options: PromptOption<Record<string, unknown>>[] = [
            { id: 'extra-action', label: '额外打出行动', value: { choice: 'extra_action' }, displayMode: 'button' as const },
            { id: 'draw-card', label: '抽一张牌', value: { choice: 'draw_card' }, displayMode: 'button' as const },
            { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
        ];
        const interaction = createSimpleChoice(
            `base_arena_${ctx.playerId}_${ctx.now}`,
            ctx.playerId,
            '竞技场：选择额外打行动或抽牌',
            options,
            { sourceId: 'base_arena', targetType: 'button' },
        );
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }, {
    });

    // ── 名人堂（Hall of Fame）───────────────────────────────────
    // 第一次在此基地打出的随从获得回合内 +2 力量
    registerBaseAbility('base_hall_of_fame', 'onMinionPlayed', (ctx) => {
        if (!ctx.minionUid) return { events: [] };
        if (!isFirstMinionPlayedByPlayerAtBaseThisTurn(ctx)) return { events: [] };
        return {
            events: [addTempPower(ctx.minionUid, ctx.baseIndex, 2, 'base_hall_of_fame', ctx.now)],
        };
    }, {
        canTrigger: isFirstMinionPlayedByPlayerAtBaseThisTurn,
    });

    // ── 疯人院（The Asylum）──────────────────────────────────────
    // "在一个玩家打出一个随从到这后，该玩家可以将一张手牌移出游戏（放入盒子），在你的一个随从上放置一个+1力量指示物"
    registerBaseAbility('base_the_asylum', 'onMinionPlayed', (ctx) => {
        const player = ctx.state.players[ctx.playerId];
        if (!player || player.hand.length === 0 || !ctx.matchState) return { events: [] };

        const handOptions = player.hand.map((card, index) => {
            const def = getCardDef(card.defId);
            return {
                id: `card-${index}`,
                label: def?.name ?? card.defId,
                value: { cardUid: card.uid, defId: card.defId },
                _source: 'hand' as const,
                displayMode: 'card' as const,
            };
        });

        const options: PromptOption<Record<string, unknown>>[] = [
            { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
            ...handOptions,
        ];

        const interaction = createSimpleChoice(
            `base_the_asylum_${ctx.now}`, ctx.playerId,
            '疯人院：选择一张手牌放入盒子',
            options,
            { sourceId: 'base_the_asylum', targetType: 'hand' },
        );
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }, {
    });

    // ── 印斯茅斯基地（Innsmouth Base）────────────────────────────
    // "在一个随从被打出到这后，它的拥有者可以将任意玩家弃牌堆中的一张卡放到该卡拥有者的牌库底"
    // 第一步：选择从哪个玩家的弃牌堆选卡
    registerBaseAbility('base_innsmouth_base', 'onMinionPlayed', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        const playedMinion = ctx.minionUid ? base?.minions.find(m => m.uid === ctx.minionUid) : undefined;
        const ownerId = playedMinion?.owner ?? ctx.playerId;

        // Infiltrate：按行动控制者忽略基地能力，不能被 borrowed 牌的真实 owner 串线。
        const playedControllerId = playedMinion?.controller ?? ctx.playerId;
        const ignoredByOwner = base?.ongoingActions?.some(o =>
            ((o.metadata?.sourceControllerId as string | undefined) ?? o.ownerId) === playedControllerId && o.defId === 'ninja_infiltrate',
        ) ?? false;
        if (ignoredByOwner) return { events: [] };

        // 收集有弃牌堆卡牌的玩家
        const playersWithDiscard: string[] = [];
        for (const [pid, player] of Object.entries(ctx.state.players)) {
            if (player.discard.length > 0) {
                playersWithDiscard.push(pid);
            }
        }

        if (playersWithDiscard.length === 0) return { events: [] };

        const options = [
            { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
            ...playersWithDiscard.map((pid, i) => ({
                id: `player-${i}`,
                label: pid === ownerId ? '你自己的弃牌堆' : `${getPlayerLabel(pid)}的弃牌堆`,
                value: { targetPlayerId: pid },
            })),
        ];

        if (!ctx.matchState) return { events: [] };
        const interaction = createSimpleChoice(
            `base_innsmouth_base_choose_player_${ctx.now}`, ownerId,
            '印斯茅斯基地：选择从哪个玩家的弃牌堆选卡', options,
            { sourceId: 'base_innsmouth_base_choose_player', targetType: 'player', autoCancelOption: true },
        );
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }, {
        mandatory: false,
        canTrigger: (ctx) => {
            const base = ctx.state.bases[ctx.baseIndex];
            const playedMinion = ctx.minionUid ? base?.minions.find(m => m.uid === ctx.minionUid) : undefined;
            const playedControllerId = playedMinion?.controller ?? ctx.playerId;
            const ignoredByOwner = base?.ongoingActions?.some(o =>
                ((o.metadata?.sourceControllerId as string | undefined) ?? o.ownerId) === playedControllerId && o.defId === 'ninja_infiltrate',
            ) ?? false;
            return !ignoredByOwner && Object.values(ctx.state.players).some(player => player.discard.length > 0);
        },
    });

    // ── 密斯卡托尼克大学基地（Miskatonic University Base）────────
    // "每回合一次，在你打出一个随从到这里后，你可以抓两张疯狂卡，或者从手牌弃置一张疯狂卡来额外打出一张行动。"
    registerBaseAbility('base_miskatonic_university_base', 'onMinionPlayed', (ctx) => {
        const player = ctx.state.players[ctx.playerId];
        if (!player || !ctx.matchState) return { events: [] };

        const playedAtBase = player.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0;
        if (playedAtBase !== 1) return { events: [] };

        const canDrawMadness = (ctx.state.madnessDeck?.length ?? 0) > 0;
        const canDiscardMadness = player.hand.some(card => card.defId === MADNESS_CARD_DEF_ID);
        if (!canDrawMadness && !canDiscardMadness) return { events: [] };

        const options: PromptOption<Record<string, unknown>>[] = [];
        if (canDrawMadness) {
            options.push({
                id: 'draw',
                label: '抓两张疯狂卡',
                value: { choice: 'draw' },
                displayMode: 'button' as const,
            });
        }
        if (canDiscardMadness) {
            options.push({
                id: 'discard',
                label: '弃一张疯狂卡并额外打出行动',
                value: { choice: 'discard_for_action' },
                displayMode: 'button' as const,
            });
        }
        options.push({
            id: 'skip',
            label: '跳过',
            value: { skip: true },
            displayMode: 'button' as const,
        });

        const interaction = createSimpleChoice(
            `base_miskatonic_university_base_${ctx.playerId}_${ctx.now}`, ctx.playerId,
            '阿卡姆大学：选择要执行的效果',
            options,
            { sourceId: 'base_miskatonic_university_base', targetType: 'button' },
        );
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }, {
    });

    // ── 冷原高地（Plateau of Leng）──────────────────────────────
    // "每回合玩家第一次打出一个随从到这里后，可以额外打出一张与其同名的随从到这里"
    // 实现：直接授予同名随从额度，玩家可以选择何时使用
    registerBaseAbility('base_plateau_of_leng', 'onMinionPlayed', (ctx) => {
        if (!ctx.minionDefId) return { events: [] };
        
        const player = ctx.state.players[ctx.playerId];
        if (!player) return { events: [] };

        // 每回合只有第一次打出随从到此基地才触发
        // reduce 已执行，minionsPlayedPerBase 包含刚打出的随从，首次打出时值为 1
        const playedAtBase = player.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0;
        if (playedAtBase !== 1) return { events: [] };

        // 直接授予1个同名随从额度，限定到此基地
        return {
            events: [
                grantContextualExtraMinion(ctx, 'base_plateau_of_leng', ctx.baseIndex, {
                    sameNameOnly: true,
                    sameNameDefId: ctx.minionDefId,
                }),
            ],
        };
    }, {
    });

    // ============================================================================
    // AL9000 扩展基地能力
    // ============================================================================

    // ── 温室（Greenhouse）──────────────────────────────────────
    // "在这个基地计分后，冠军可以从他的牌库中搜寻一张随从并将它打出到将替换本基地的基地上）?
    registerBaseAbility('base_greenhouse', 'afterScoring', (ctx) => {
        if (!ctx.rankings || ctx.rankings.length === 0) return { events: [] };
        const winnerId = ctx.rankings[0].playerId;
        const winner = ctx.state.players[winnerId];
        if (!winner) return { events: [] };

        // 搜索冠军牌库中的随从?
        const minionsInDeck = winner.deck.filter(c => c.type === 'minion');
        if (minionsInDeck.length === 0) return { events: [] };

        const options: PromptOption<Record<string, unknown>>[] = [
            { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
            ...minionsInDeck.map((c, i) => {
                const def = getMinionDef(c.defId);
                return {
                    id: `minion-${i}`,
                    label: `${def?.name ?? c.defId} (力量${def?.power ?? '?'})`,
                    value: { cardUid: c.uid, defId: c.defId, power: def?.power ?? 0 },
                    _source: 'static' as const,
                    displayMode: 'card' as const,
                };
            }),
        ];

        if (!ctx.matchState) return { events: [] };
        const interaction = createSimpleChoice(
            `base_greenhouse_${ctx.now}`, winnerId,
            '温室：从牌库中选择一个随从打出到新基地', options,
            { sourceId: 'base_greenhouse', targetType: 'generic' },
        );
        return {
            events: [],
            matchState: queueInteraction(ctx.matchState, {
                ...interaction,
                data: { ...interaction.data, continuationContext: { baseIndex: ctx.baseIndex } },
            }),
        };
    }, {
        // 整条 revealed-base 效果必须执行；“可选”应由每位玩家自己的 skip 选项承接，
        // 不能让当前反应玩家一次跳过所有玩家的移动资格。
        mandatory: true,
    });

    // ── 神秘花园（Secret Garden）──────────────────────────────
    // "On your turn" 语义统一在进入 playCards 时发放额度，
    // 避免把 phase 2 持续许可错误建模为 startTurn 事件。
    // 发放逻辑见 domain/index.ts 的 collectPhaseTwoOngoingExtraEvents。

    // ── 发明家沙龙（Inventor's Salon）──────────────────────────
    // "在这个基地计分后，冠军可以从他的弃牌堆中选取一张战术卡将其置入他的手牌堆?
    registerBaseAbility('base_inventors_salon', 'afterScoring', (ctx) => {
        if (!ctx.rankings || ctx.rankings.length === 0) return { events: [] };
        const winnerId = ctx.rankings[0].playerId;
        const winner = ctx.state.players[winnerId];
        if (!winner) return { events: [] };

        // 搜索冠军弃牌堆中的行动卡
        const actionsInDiscard = winner.discard.filter(c => c.type === 'action');
        if (actionsInDiscard.length === 0) return { events: [] };

        const options: PromptOption<Record<string, unknown>>[] = [
            { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
            ...actionsInDiscard.map((c, i) => {
                const def = getCardDef(c.defId);
                return {
                    id: `action-${i}`,
                    label: def?.name ?? c.defId,
                    value: { cardUid: c.uid, defId: c.defId },
                    _source: 'discard' as const,
                    displayMode: 'card' as const,
                };
            }),
        ];

        if (!ctx.matchState) return { events: [] };
        const interaction = createSimpleChoice(
            `base_inventors_salon_${ctx.now}`, winnerId,
            '发明家沙龙：从弃牌堆选择一张行动卡放入手牌', options,
            { sourceId: 'base_inventors_salon', targetType: 'generic' },
        );
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }, {
    });

    // ============================================================================
    // Pretty Pretty 扩展基地能力
    // ============================================================================

    // ── 诡猫巷（Cat Fanciers' Alley）──────────────────────────
    // "你的回合中一次，你可以消灭这里你的一个随从来抽一张卡牌?
    // talent 能力：onTurnStart 生成 Prompt，每回合一次（Prompt 消费即完成）
    registerBaseAbility('base_cat_fanciers_alley', 'onTurnStart', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return { events: [] };

        // 收集当前玩家在此基地的随从
        const myMinions = base.minions.filter(m => m.controller === ctx.playerId);
        if (myMinions.length === 0) return { events: [] };

        const minionOptions = myMinions.map((m, i) => {
            const def = getCardDef(m.defId);
            return {
                id: `minion-${i}`,
                label: `${def?.name ?? m.defId} (力量${getEffectivePower(ctx.state, m, ctx.baseIndex)})`,
                value: { minionUid: m.uid, minionDefId: m.defId, owner: m.owner },
                _source: 'field' as const,
                displayMode: 'card' as const,
            };
        });
        const options: PromptOption<Record<string, unknown>>[] = [
            { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
            ...minionOptions,
        ];

        if (!ctx.matchState) return { events: [] };
        const interaction = createSimpleChoice(
            `base_cat_fanciers_alley_${ctx.now}`, ctx.playerId,
            '诡猫巷：消灭一个己方随从来抽一张卡牌', options,
            { sourceId: 'base_cat_fanciers_alley', targetType: 'minion' },
        );
        return {
            events: [],
            matchState: queueInteraction(ctx.matchState, {
                ...interaction,
                data: { ...interaction.data, continuationContext: { baseIndex: ctx.baseIndex } },
            }),
        };
    }, {
    });

    // ── 魔法林地（Enchanted Glade）──────────────────────────────
    // "在一个玩家打出一张附着行动卡到这里的一个随从上后，该玩家抽一张卡牌?
    registerBaseAbility('base_enchanted_glade', 'onActionPlayed', (ctx) => {
        // 只有附着到随从的行动卡才触发（actionTargetMinionUid 有值）
        const actionTargetType = ctx.actionTargetType ?? (ctx.actionTargetMinionUid ? 'minion' : 'base');
        if (actionTargetType !== 'minion') return { events: [] };

        return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now) };
    }, {
    });

    // ── 仙灵之环（Fairy Circle）────────────────────────────────
    // "在一个玩家首次打出一个随从到这后，该玩家可以额外打出一个随从到这里，或额外打出一张行动卡。"
    // 通过 minionsPlayedPerBase 追踪每回合每基地打出次数，reduce 已执行，首次打出时值为 1
    registerBaseAbility('base_fairy_ring', 'onMinionPlayed', (ctx) => {
        const player = ctx.state.players[ctx.playerId];
        if (!player || !ctx.matchState) return { events: [] };

        // 每回合只有第一次打出随从到此基地才触发
        // reduce 已执行，minionsPlayedPerBase 包含刚打出的随从，首次打出时值为 1
        const playedAtBase = player.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0;
        if (playedAtBase !== 1) return { events: [] };
        const branchContext = createBaseFairyRingBranchEffectContext(
            ctx.matchState,
            ctx.playerId,
            ctx.random,
            ctx.now,
            ctx.baseIndex,
        );

        return {
            events: [],
            matchState: queueBranchingChoice({
                matchState: ctx.matchState,
                playerId: ctx.playerId,
                now: ctx.now,
                sourceId: 'base_fairy_ring',
                title: '精灵之环：选择额外打出一个随从到这里，或额外打出一张行动卡',
                executeBranch: runBaseFairyRingBranch,
                targetType: 'button',
                planContext: { baseIndex: ctx.baseIndex },
                upgrade: getSpiritOptionalBothUpgradeForBase(ctx.state, ctx.playerId, ctx.now),
                options: [
                    createBaseFairyRingBranchOption(
                        'extra-minion',
                        '额外打出一个随从到这里',
                        'extra_minion',
                        undefined,
                        baseFairyRingExtraMinionPrimitive.footprint(branchContext),
                    ),
                    createBaseFairyRingBranchOption(
                        'extra-action',
                        '额外打出一张行动卡',
                        'extra_action',
                        undefined,
                        baseFairyRingExtraActionPrimitive.footprint(branchContext),
                    ),
                    createBaseFairyRingBranchOption('skip', '跳过', 'skip', { skip: true }),
                ],
            }),
        };
    }, {
    });

    // ── 平衡之地（Land of Balance）──────────────────────────────
    // "在一个玩家打出一个随从到这后，该玩家可以将他在其他基地的一个随从移动到这里）?
    registerBaseAbility('base_land_of_balance', 'onMinionPlayed', (ctx) => {
        const balanceBaseIndex = ctx.baseIndex;

        // 收集该玩家在其他基地的随从
        const otherBaseMinions: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
        for (let i = 0; i < ctx.state.bases.length; i++) {
            if (i === balanceBaseIndex) continue;
            const base = ctx.state.bases[i];
            const bDef = getBaseDef(base.defId);
            for (const m of base.minions) {
                if (m.controller !== ctx.playerId) continue;
                const def = getCardDef(m.defId);
                otherBaseMinions.push({
                    uid: m.uid,
                    defId: m.defId,
                    baseIndex: i,
                    label: `${def?.name ?? m.defId} (${bDef?.name ?? '基地'}, 力量${getEffectivePower(ctx.state, m, i)})`,
                });
            }
        }

        // 无其他基地随从?不生成 Prompt
        if (otherBaseMinions.length === 0) return { events: [] };

        const minionOptions = otherBaseMinions.map((m, i) => ({
            id: `minion-${i}`,
            label: m.label,
            value: { minionUid: m.uid, minionDefId: m.defId, fromBaseIndex: m.baseIndex },
            _source: 'field' as const,
            displayMode: 'card' as const,
        }));
        const options: PromptOption<Record<string, unknown>>[] = [
            { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
            ...minionOptions,
        ];

        if (!ctx.matchState) return { events: [] };
        const interaction = createSimpleChoice(
            `base_land_of_balance_${ctx.now}`, ctx.playerId,
            '平衡之地：选择一个己方随从移动到这里', options,
            { sourceId: 'base_land_of_balance', targetType: 'minion' },
        );
        return {
            events: [],
            matchState: queueInteraction(ctx.matchState, {
                ...interaction,
                data: { ...interaction.data, continuationContext: { balanceBaseIndex } },
            }),
        };
    }, {
    });

    // ── 九命之屋（House of Nine Lives）──────────────────────────
    // "当你的一个随从在其他基地被消灭时，你可以将它移动到这里"
    // 通过 registerTrigger(onMinionDestroyed) 注册，创建玩家选择交互
    // processDestroyTriggers 的 pendingSaveMinionUids 机制会暂缓消灭事件
    registerTrigger('base_house_of_nine_lives', 'onMinionDestroyed', (trigCtx) => {
        const { state, triggerMinionUid, triggerMinionDefId } = trigCtx;
        const baseIndex = trigCtx.baseIndex;
        if (trigCtx.reason === '九命之屋：玩家选择不拯救') return [];
        if (!triggerMinionUid || !triggerMinionDefId || baseIndex === undefined) return [];

        // 找到九命之屋的基地索引
        let houseBaseIndex = -1;
        for (let i = 0; i < state.bases.length; i++) {
            if (state.bases[i].defId === 'base_house_of_nine_lives') {
                houseBaseIndex = i;
                break;
            }
        }
        // 九命之屋不在场→不触发
        if (houseBaseIndex === -1) return [];

        // 随从在九命之屋本身被消灭→不触发（只拦截其他基地）
        if (baseIndex === houseBaseIndex) return [];

        // 查找被消灭随从的拥有者
        const minion = state.bases[baseIndex]?.minions.find(m => m.uid === triggerMinionUid);
        const ownerId = minion?.owner ?? trigCtx.playerId;

        // 创建玩家选择交互：移动到九命之屋 or 正常消灭
        if (!trigCtx.matchState) return [];
        const interaction = createSimpleChoice(
            `nine_lives_${triggerMinionUid}_${trigCtx.now}`,
            ownerId,
            '九命之屋：是否将随从移动到九命之屋？',
            [
                {
                    id: 'move',
                    label: '移动到九命之屋',
                    value: { move: true, minionUid: triggerMinionUid, minionDefId: triggerMinionDefId },
                    displayMode: 'button' as const,
                },
                { id: 'skip', label: '不移动（正常消灭）', value: { move: false }, displayMode: 'button' as const },
            ],
            { sourceId: 'base_nine_lives_intercept', targetType: 'minion' },
        );
        const updatedMS = queueInteraction(trigCtx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                continuationContext: {
                    minionUid: triggerMinionUid,
                    minionDefId: triggerMinionDefId,
                    fromBaseIndex: baseIndex,
                    houseBaseIndex,
                    ownerId,
                    destroyerId: trigCtx.destroyerId,
                },
            },
        });
        // 返回空事件 + 更新后的 matchState（processDestroyTriggers 检测到 matchState 变化 → pendingSaveMinionUids）
        return { events: [], matchState: updatedMS };
    }, {
        phase: 'replacement',
    });

    // ── 被动保护类基地──────────────────────────────────────────

    // 美丽城堡（Beautiful Castle）：力量的 的随从免疫消灭、移动和影响
    // 保护检查时动态查找美丽城堡的基地索引，确保只保护该基地上的随从
    const beautifulCastleChecker = (ctx: ProtectionCheckContext): boolean => {
        // 动态查找美丽城堡所在基地索引?
        const castleIndex = ctx.state.bases.findIndex(b => b.defId === 'base_beautiful_castle');
        if (castleIndex === -1) return false;
        // 只保护美丽城堡上的随从
        if (ctx.targetBaseIndex !== castleIndex) return false;
        // 力量的 才受保护
        const power = getEffectivePower(ctx.state, ctx.targetMinion, ctx.targetBaseIndex);
        return power >= 5;
    };
    registerProtection('base_beautiful_castle', 'destroy', beautifulCastleChecker);
    registerProtection('base_beautiful_castle', 'move', beautifulCastleChecker);
    registerProtection('base_beautiful_castle', 'affect', beautifulCastleChecker);

    // 卵室（Egg Chamber）：这里有 +1 力量指示物的随从不能被消灭
    registerProtection('base_egg_chamber', 'destroy', (ctx: ProtectionCheckContext): boolean => {
        const eggIndex = ctx.state.bases.findIndex(b => b.defId === 'base_egg_chamber');
        if (eggIndex === -1) return false;
        if (ctx.targetBaseIndex !== eggIndex) return false;
        const eggBase = ctx.state.bases[eggIndex];
        // Infiltrate：该随从控制者若选择忽略，则其随从不再受保护。
        const ignored = eggBase.ongoingActions?.some(o =>
            ((o.metadata?.sourceControllerId as string | undefined) ?? o.ownerId) === ctx.targetMinion.controller && o.defId === 'ninja_infiltrate',
        ) ?? false;
        if (ignored) return false;
        // 仅“+1 power counters”（力量指示物）提供保护
        return (ctx.targetMinion.powerCounters ?? 0) > 0;
    });

    // 小马乐园（Pony Paradise）：拥有 2+ 随从的玩家，其随从免疫消灭
    // 保护检查时动态查找小马乐园的基地索引，并统计该玩家在此基地的随从数量
    registerProtection('base_pony_paradise', 'destroy', (ctx: ProtectionCheckContext): boolean => {
        // 动态查找小马乐园所在基地索引?
        const ponyIndex = ctx.state.bases.findIndex(b => b.defId === 'base_pony_paradise');
        if (ponyIndex === -1) return false;
        // 只保护小马乐园上的随从
        if (ctx.targetBaseIndex !== ponyIndex) return false;
        // 统计该随从控制者在此基地的随从数量
        const base = ctx.state.bases[ponyIndex];
        const ownerMinionCount = base.minions.filter(m => m.controller === ctx.targetMinion.controller).length;
        return ownerMinionCount >= 2;
    });


    // ============================================================================
    // 绵羊/牧场扩展基地能力
    // ============================================================================

    // ── 绵羊神社（Sheep Shrine）──────────────────────────────
    // "这张基地入场后，每位玩家可以移动一个他们的随从到这。"
    // 通过 onBaseRevealed 扩展时机触发，在 scoreOneBase 中 BASE_REPLACED 后调用
    registerExtendedBase('base_sheep_shrine', 'onBaseRevealed', (ctx) => {
        if (!ctx.matchState) return { events: [] };
        let ms = ctx.matchState;
        const turnOrder = ctx.state.turnOrder;

        for (const pid of turnOrder) {
            // 收集该玩家在其他基地的随从
            const otherMinions: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
            for (let i = 0; i < ctx.state.bases.length; i++) {
                if (i === ctx.baseIndex) continue;
                const base = ctx.state.bases[i];
                const bDef = getBaseDef(base.defId);
                for (const m of base.minions) {
                    if (m.controller !== pid) continue;
                    const def = getCardDef(m.defId);
                    otherMinions.push({
                        uid: m.uid,
                        defId: m.defId,
                        baseIndex: i,
                        label: `${def?.name ?? m.defId} (${bDef?.name ?? '基地'}, 力量${getEffectivePower(ctx.state, m, i)})`,
                    });
                }
            }
            if (otherMinions.length === 0) continue;

            const minionOptions = otherMinions.map((m, i) => ({
                id: `minion-${i}`,
                label: m.label,
                value: { minionUid: m.uid, minionDefId: m.defId, fromBaseIndex: m.baseIndex },
                _source: 'field' as const,
                displayMode: 'card' as const,
            }));
            const options: PromptOption<Record<string, unknown>>[] = [
                { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
                ...minionOptions,
            ];

            const interaction = createSimpleChoice(
                `base_sheep_shrine_${pid}_${ctx.now}`, pid,
                '绵羊神社：选择移动一个己方随从到此基地', options,
                { sourceId: 'base_sheep_shrine', targetType: 'minion' },
            );
            ms = queueInteraction(ms, {
                ...interaction,
                data: { ...interaction.data, continuationContext: { targetBaseIndex: ctx.baseIndex } },
            });
        }

        return { events: [], matchState: ms };
    }, {
        // 整条 revealed-base 效果必须执行；“可选”应由每位玩家自己的 skip 选项承接，
        // 不能让当前反应玩家一次跳过所有玩家的移动资格。
        mandatory: true,
    });

    // ── 牧场（The Pasture）──────────────────────────────────
    // "每回合玩家第一次移动一个随从到这里后，移动另一基地的一个随从到这。"
    // 通过 onMinionMoved 扩展时机触发，在 processMoveTriggers 中调用
    registerExtendedBase('base_the_pasture', 'onMinionMoved', (ctx) => {
        // 检查是否为本回合该玩家首次移动到此基地。
        // 直接调用时仍是移动前现场；queued onMinionMoved 消费时已经 reduce 了本次 MINION_MOVED。
        const moveCount = ctx.state.minionsMovedToBaseThisTurn?.[ctx.playerId]?.[ctx.baseIndex] ?? 0;
        const isQueuedMoveFrame = ctx.sourceEventId?.startsWith('minion-moved:') === true;
        const alreadyMovedBeforeThisFrame = isQueuedMoveFrame ? moveCount > 1 : moveCount > 0;
        if (alreadyMovedBeforeThisFrame) return { events: [] };

        if (!ctx.matchState) return { events: [] };

        // 收集其他基地上的所有随从
        const otherMinions: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
        for (let i = 0; i < ctx.state.bases.length; i++) {
            if (i === ctx.baseIndex) continue;
            const base = ctx.state.bases[i];
            const bDef = getBaseDef(base.defId);
            for (const m of base.minions) {
                // 排除刚移动过来的随从
                if (m.uid === ctx.minionUid) continue;
                const def = getCardDef(m.defId);
                otherMinions.push({
                    uid: m.uid,
                    defId: m.defId,
                    baseIndex: i,
                    label: `${def?.name ?? m.defId} (${bDef?.name ?? '基地'}, 力量${getEffectivePower(ctx.state, m, i)})`,
                });
            }
        }

        if (otherMinions.length === 0) return { events: [] };

        const minionOptions = otherMinions.map((m, i) => ({
            id: `minion-${i}`,
            label: m.label,
            value: { minionUid: m.uid, minionDefId: m.defId, fromBaseIndex: m.baseIndex },
            _source: 'field' as const,
            displayMode: 'card' as const,
        }));

        const interaction = createSimpleChoice(
            `base_the_pasture_${ctx.now}`, ctx.playerId,
            '牧场：选择另一基地的一个随从移动到这里',
            minionOptions,
            { sourceId: 'base_the_pasture', targetType: 'minion' },
        );
        return {
            events: [],
            matchState: queueInteraction(ctx.matchState, {
                ...interaction,
                data: { ...interaction.data, continuationContext: { targetBaseIndex: ctx.baseIndex } },
            }),
        };
    }, {
    });
}

// ============================================================================
// 扩展包基地交互解决处理函数
// ============================================================================

/** 注册扩展包基地能力的交互解决处理函数 */
export function registerExpansionBaseInteractionHandlers(): void {
    registerInteractionHandler('base_mermaid_pool', (state, _playerId, value, iData, _random, timestamp) => {
        const selected = value as {
            skip?: boolean;
            minionUid?: string;
            minionDefId?: string;
            fromBaseIndex?: number;
        };
        if (selected.skip) return { state, events: [] };
        const ctx = getContinuationContext<{ targetBaseIndex: number }>(iData);
        if (!ctx || !selected.minionUid || !selected.minionDefId || selected.fromBaseIndex === undefined) {
            return { state, events: [] };
        }
        return {
            state,
            events: buildValidatedMoveEvents(state, {
                minionUid: selected.minionUid,
                minionDefId: selected.minionDefId,
                fromBaseIndex: selected.fromBaseIndex,
                toBaseIndex: ctx.targetBaseIndex,
                reason: 'base_mermaid_pool',
                now: timestamp,
            }),
        };
    });

    registerInteractionHandler('base_ossuary', (state, playerId, value, iData, random, timestamp) => {
        const selected = value as { skip?: boolean; cardUid?: string; defId?: string };
        if (selected.skip) return { state, events: [] };
        const ctx = getContinuationContext<{ targetBaseIndex: number }>(iData);
        if (!ctx || !selected.cardUid || !selected.defId) return { state, events: [] };
        const trueOwnerId = state.core.players[playerId]?.discard.find(card => card.uid === selected.cardUid)?.owner ?? playerId;
        return {
            state,
            events: buildBuryCardEvents({
                core: state.core,
                matchState: state,
                playerId,
                cardUid: selected.cardUid,
                defId: selected.defId,
                baseIndex: ctx.targetBaseIndex,
                trueOwnerId,
                buriedFrom: 'discard',
                reason: 'base_ossuary',
                random,
                now: timestamp,
            }),
        };
    });

    registerInteractionHandler('base_arena', (state, playerId, value, _iData, random, timestamp) => {
        const selected = value as { skip?: boolean; choice?: 'extra_action' | 'draw_card' };
        if (selected.skip) return { state, events: [] };

        if (selected.choice === 'extra_action') {
            return {
                state,
                events: [grantContextualExtraAction(
                    { playerId, now: timestamp },
                    'base_arena',
                )],
            };
        }

        if (selected.choice === 'draw_card') {
            return {
                state,
                events: buildStandardDrawEvents(state.core, playerId, 1, random, timestamp),
            };
        }

        return { state, events: [] };
    });
    // 疯人院：先选手牌，再选择一个自己的随从放置 +1 力量指示物
    registerInteractionHandler('base_the_asylum', (state, playerId, value, _iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; cardUid?: string; defId?: string };
        if (selected.skip) return { state, events: [] };

        const player = state.core.players[playerId];
        if (!player || !selected.cardUid || !selected.defId) return { state, events: [] };

        const boxedCard = player.hand.find(card => card.uid === selected.cardUid && card.defId === selected.defId);
        if (!boxedCard) return { state, events: [] };

        const minionOptions: PromptOption<Record<string, unknown>>[] = [];
        state.core.bases.forEach((base, baseIndex) => {
            const baseDef = getBaseDef(base.defId);
            base.minions
                .filter(minion => minion.controller === playerId)
                .forEach((minion, index) => {
                    const minionDef = getCardDef(minion.defId);
                    minionOptions.push({
                        id: `minion-${baseIndex}-${index}`,
                        label: `${minionDef?.name ?? minion.defId} (${baseDef?.name ?? '基地'})`,
                        value: { minionUid: minion.uid, baseIndex },
                        _source: 'field' as const,
                        displayMode: 'card' as const,
                    });
                });
        });

        if (minionOptions.length === 0) return { state, events: [] };

        const interaction = createSimpleChoice(
            `base_the_asylum_choose_minion_${timestamp}`, playerId,
            '疯人院：选择你的一个随从放置 +1 力量指示物',
            minionOptions,
            { sourceId: 'base_the_asylum_choose_minion', targetType: 'minion' },
        );

        return {
            state: queueInteraction(state, {
                ...interaction,
                data: {
                    ...interaction.data,
                    continuationContext: {
                        cardUid: boxedCard.uid,
                        defId: boxedCard.defId,
                    },
                },
            }, { urgent: true }),
            events: [],
        };
    });

    registerInteractionHandler('base_the_asylum_choose_minion', (state, playerId, value, iData, _random, timestamp) => {
        const selected = value as { minionUid?: string; baseIndex?: number };
        const ctx = getContinuationContext<{ cardUid: string; defId: string }>(iData);
        if (!ctx || !ctx.cardUid || !ctx.defId || !selected.minionUid || selected.baseIndex === undefined) {
            return { state, events: [] };
        }

        const player = state.core.players[playerId];
        const boxedCard = player?.hand.find(card => card.uid === ctx.cardUid && card.defId === ctx.defId);
        if (!boxedCard) return { state, events: [] };

        const target = findMinionOnBases(state.core, selected.minionUid);
        if (!target || target.baseIndex !== selected.baseIndex || target.minion.controller !== playerId) {
            return { state, events: [] };
        }

        return {
            state,
            events: [
                {
                    type: SU_EVENTS.CARD_BOXED,
                    payload: {
                        playerId,
                        ownerId: boxedCard.owner,
                        cardUid: boxedCard.uid,
                        defId: boxedCard.defId,
                        from: 'hand',
                        reason: 'base_the_asylum',
                    },
                    timestamp,
                } as SmashUpEvent,
                {
                    type: SU_EVENTS.POWER_COUNTER_ADDED,
                    payload: {
                        minionUid: target.minion.uid,
                        baseIndex: target.baseIndex,
                        amount: 1,
                        reason: 'base_the_asylum',
                    },
                    timestamp,
                } as SmashUpEvent,
            ],
        };
    });

    // 印斯茅斯基地第一步：选择玩家后，创建第二步交互（选择卡牌）
    registerInteractionHandler('base_innsmouth_base_choose_player', (state, playerId, value, _iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; targetPlayerId?: string };
        if (selected.skip) return { state, events: [] };

        const targetPlayerId = selected.targetPlayerId!;
        const targetPlayer = state.core.players[targetPlayerId];
        if (!targetPlayer || targetPlayer.discard.length === 0) {
            return { state, events: [] };
        }

        // 创建第二步交互：从该玩家的弃牌堆选择卡牌
        const discardCards = targetPlayer.discard.map((c, i) => {
            const def = getCardDef(c.defId);
            return {
                id: `card-${i}`,
                label: def?.name ?? c.defId,
                value: { cardUid: c.uid, defId: c.defId, ownerId: c.owner, sourcePlayerId: targetPlayerId },
                _source: 'discard' as const,
                displayMode: 'card' as const,
            };
        });

        const options = [
            { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
            ...discardCards,
        ];

        const interaction = createSimpleChoice(
            `base_innsmouth_base_choose_card_${timestamp}`, playerId,
            `印斯茅斯基地：从${targetPlayerId === playerId ? '你的' : getPlayerLabel(targetPlayerId) + '的'}弃牌堆选择一张卡`,
            options,
            { sourceId: 'base_innsmouth_base_choose_card', targetType: 'generic', autoCancelOption: true },
        );

        return { state: queueInteraction(state, interaction), events: [] };
    });

    // 印斯茅斯基地第二步：选择卡牌后，放入牌库底
    registerInteractionHandler('base_innsmouth_base_choose_card', (state, _playerId, value, _iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; cardUid?: string; defId?: string; ownerId?: string; sourcePlayerId?: string };
        if (selected.skip) return { state, events: [] };
        return {
            state,
            events: buildValidatedCardToDeckBottomEvents(state, {
                cardUid: selected.cardUid!,
                defId: selected.defId!,
                ownerId: selected.ownerId!,
                sourcePlayerId: selected.sourcePlayerId,
                reason: '印斯茅斯基地：弃牌堆卡放入牌库底',
                now: timestamp,
                expectedLocation: 'discard',
            }),
        };
    });

    // 密大基地：打出随从后，选择抓疯狂或弃疯狂换额外行动
    registerInteractionHandler('base_miskatonic_university_base', (state, playerId, value, _iData, _random, timestamp) => {
        const selected = value as {
            skip?: boolean;
            choice?: 'draw' | 'discard_for_action';
        };
        if (selected.skip) return { state, events: [] };

        if (selected.choice === 'draw') {
            const drawEvent = drawMadnessCards(playerId, 2, state.core, 'base_miskatonic_university_base', timestamp);
            return { state, events: drawEvent ? [drawEvent] : [] };
        }

        if (selected.choice === 'discard_for_action') {
            const player = state.core.players[playerId];
            const madnessCard = player?.hand.find(card => card.defId === MADNESS_CARD_DEF_ID);
            if (!player || !madnessCard) return { state, events: [] };
            return {
                state,
                events: [
                    {
                        type: SU_EVENTS.CARDS_DISCARDED,
                        payload: { playerId, cardUids: [madnessCard.uid] },
                        timestamp,
                    } as SmashUpEvent,
                    grantExtraAction(playerId, 'base_miskatonic_university_base', timestamp),
                ],
            };
        }

        return { state, events: [] };
    });

    registerInteractionHandler('base_greenhouse', (state, playerId, value, iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; cardUid?: string; defId?: string; power?: number };
        if (selected.skip) return { state, events: [] };
        const ctx = getContinuationContext<{ baseIndex: number }>(iData);
        if (!ctx) return { state, events: [] };
        const player = state.core.players[playerId];
        if (!player || !selected.cardUid || !selected.defId) return { state, events: [] };
        const selectedCard = player.deck.find(card =>
            card.uid === selected.cardUid
            && card.defId === selected.defId
            && card.type === 'minion',
        );
        if (!selectedCard) return { state, events: [] };
        const power = selected.power ?? (getMinionDef(selected.defId!)?.power ?? 0);
        if (isScoringSessionAwaitingDeferredResolution(state)) {
            const replacementBaseDefId = getDeferredReplacementBaseDefId(state, iData);
            if (!replacementBaseDefId) return { state, events: [] };
            const pendingAction: PendingPostScoringAction = {
                kind: 'playMinionOnReplacementBase',
                playerId,
                cardUid: selected.cardUid,
                defId: selected.defId,
                ownerId: selectedCard.owner,
                baseIndex: ctx.baseIndex,
                targetBaseDefId: replacementBaseDefId,
                power,
            };
            return {
                state: appendPendingPostScoringActions(state, [pendingAction]),
                events: [],
            };
        }
        const replacementBaseDefId = state.core.bases[ctx.baseIndex]?.defId;
        if (!replacementBaseDefId) return { state, events: [] };
        const playedEvt: MinionPlayedEvent = {
            type: SU_EVENTS.MINION_PLAYED,
            payload: {
                playerId,
                cardUid: selected.cardUid,
                defId: selected.defId,
                baseIndex: ctx.baseIndex,
                baseDefId: replacementBaseDefId,
                power,
                fromDeck: true,
                ownerId: selectedCard.owner,
                consumesNormalLimit: false,
            },
            timestamp,
        };
        return { state, events: [playedEvt] };
    });

    registerInteractionHandler('base_inventors_salon', (state, playerId, value, _iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; cardUid?: string };
        if (selected.skip) return { state, events: [] };
        const player = state.core.players[playerId];
        if (!player || !selected.cardUid) return { state, events: [] };
        const cardInDiscard = player.discard.some(card =>
            card.uid === selected.cardUid
            && card.type === 'action',
        );
        if (!cardInDiscard) return { state, events: [] };
        return { state, events: [recoverCardsFromDiscard(playerId, [selected.cardUid!], '发明家沙龙：从弃牌堆取回行动卡', timestamp)] };
    });

    registerInteractionHandler('base_cat_fanciers_alley', (state, playerId, value, iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; minionDefId?: string; owner?: string };
        if (selected.skip) return { state, events: [] };
        const ctx = getContinuationContext<{ baseIndex: number }>(iData);
        if (!ctx) return { state, events: [] };
        const events: SmashUpEvent[] = buildValidatedDestroyEvents(state, {
            minionUid: selected.minionUid!,
            minionDefId: selected.minionDefId!,
            fromBaseIndex: ctx.baseIndex,
            reason: '诡猫巷：消灭己方随从',
            now: timestamp,
        });
        if (events.length === 0) return { state, events };
        events.push(...buildStandardDrawEvents(state.core, playerId, 1, _random, timestamp));
        return { state, events };
    });

    registerInteractionHandler('base_land_of_balance', (state, _playerId, value, iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; minionDefId?: string; fromBaseIndex?: number };
        if (selected.skip) return { state, events: [] };
        const ctx = getContinuationContext<{ balanceBaseIndex: number }>(iData);
        if (!ctx) return { state, events: [] };
        return {
            state,
            events: buildValidatedMoveEvents(state, {
                minionUid: selected.minionUid!,
                minionDefId: selected.minionDefId!,
                fromBaseIndex: selected.fromBaseIndex!,
                toBaseIndex: ctx.balanceBaseIndex,
                reason: '平衡之地：移动己方随从到此',
                now: timestamp,
            }),
        };
    });

    // 绵羊神社：移动己方随从到此基地
    registerInteractionHandler('base_sheep_shrine', (state, _playerId, value, iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; minionDefId?: string; fromBaseIndex?: number };
        if (selected.skip) return { state, events: [] };
        const ctx = getContinuationContext<{ targetBaseIndex: number }>(iData);
        if (!ctx) return { state, events: [] };
        return {
            state,
            events: buildValidatedMoveEvents(state, {
                minionUid: selected.minionUid!,
                minionDefId: selected.minionDefId!,
                fromBaseIndex: selected.fromBaseIndex!,
                toBaseIndex: ctx.targetBaseIndex,
                reason: '绵羊神社：移动随从到新基地',
                now: timestamp,
            }),
        };
    });

    // 牧场：移动另一基地的随从到这里
    registerInteractionHandler('base_the_pasture', (state, _playerId, value, iData, _random, timestamp) => {
        const selected = value as { minionUid?: string; minionDefId?: string; fromBaseIndex?: number };
        const ctx = getContinuationContext<{ targetBaseIndex: number }>(iData);
        if (!ctx) return { state, events: [] };
        return {
            state,
            events: buildValidatedMoveEvents(state, {
                minionUid: selected.minionUid!,
                minionDefId: selected.minionDefId!,
                fromBaseIndex: selected.fromBaseIndex!,
                toBaseIndex: ctx.targetBaseIndex,
                reason: '牧场：移动随从到牧场',
                now: timestamp,
            }),
        };
    });

    // 九命之屋：玩家选择是否将随从移动到九命之屋
    registerInteractionHandler('base_nine_lives_intercept', (state, playerId, value, iData, _random, timestamp) => {
        const selected = value as {
            move: boolean;
            minionUid?: string;
            minionDefId?: string;
            fromBaseIndex?: number;
            houseBaseIndex?: number;
            ownerId?: string;
            destroyerId?: string;
        };
        const ctx = getContinuationContext<{
            minionUid?: string;
            minionDefId?: string;
            fromBaseIndex?: number;
            houseBaseIndex?: number;
            ownerId?: string;
            destroyerId?: string;
        }>(iData);
        const minionUid = selected.minionUid ?? ctx?.minionUid;
        const minionDefId = selected.minionDefId ?? ctx?.minionDefId;
        const fromBaseIndex = selected.fromBaseIndex ?? ctx?.fromBaseIndex;
        const houseBaseIndex = selected.houseBaseIndex ?? ctx?.houseBaseIndex;
        const ownerId = selected.ownerId ?? ctx?.ownerId ?? playerId;
        const destroyerId = selected.destroyerId ?? ctx?.destroyerId;

        if (!minionUid || !minionDefId || fromBaseIndex === undefined) return { state, events: [] };

        if (selected.move && houseBaseIndex !== undefined) {
            // 玩家选择移动到九命之屋
            return {
                state,
                events: buildValidatedMoveEvents(state, {
                    minionUid,
                    minionDefId,
                    fromBaseIndex,
                    toBaseIndex: houseBaseIndex,
                    reason: '九命之屋：随从移动到九命之屋而非被消灭',
                    now: timestamp,
                }),
            };
        } else {
            // 玩家选择不移动→恢复消灭事件
            return { state, events: [{
                type: SU_EVENTS.MINION_DESTROYED,
                payload: {
                    minionUid,
                    minionDefId,
                    fromBaseIndex,
                    ownerId,
                    destroyerId,
                    reason: '九命之屋：玩家选择不拯救',
                },
                timestamp,
            } as MinionDestroyedEvent] };
        }
    });
}
