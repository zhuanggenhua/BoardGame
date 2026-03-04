/**
 * 大杀四方 (Smash Up) - 领域内核组装
 *
 * 职责：setup 初始化、FlowSystem 钩子、playerView、isGameOver
 */

import type { DomainCore, GameEvent, GameOverResult, PlayerId, RandomFn, MatchState } from '../../../engine/types';
import { processDestroyMoveCycle, processAffectTriggers, filterProtectedReturnEvents, filterProtectedDeckBottomEvents } from './reducer';
import type { FlowHooks, PhaseEnterResult } from '../../../engine/systems/FlowSystem';
import type {
    SmashUpCommand,
    SmashUpCore,
    SmashUpEvent,
    GamePhase,
    PlayerState,
    BaseInPlay,
    TurnStartedEvent,
    TurnEndedEvent,
    CardsDrawnEvent,
    BaseScoredEvent,
    BaseClearedEvent,
    BaseReplacedEvent,
    DeckReshuffledEvent,
    MinionPlayedEvent,
    MinionPowerBreakdown,
} from './types';
import {
    PHASE_ORDER,
    SU_EVENTS,
    SU_EVENT_TYPES,
    DRAW_PER_TURN,
    HAND_LIMIT,
    VP_TO_WIN,
    getCurrentPlayerId,
} from './types';
import { getEffectivePower, getTotalEffectivePowerOnBase, getEffectiveBreakpoint, getEffectivePowerBreakdown, getOngoingCardPowerContribution, getScoringEligibleBaseIndices } from './ongoingModifiers';
import { fireTriggers, interceptEvent as ongoingInterceptEvent } from './ongoingEffects';
import { validate } from './commands';
import { execute, reduce } from './reducer';
import { getAllBaseDefIds, getBaseDef, getCardDef } from '../data/cards';
import { drawCards } from './utils';
import { countMadnessCards, madnessVpPenalty, fireMinionPlayedTriggers } from './abilityHelpers';
import { triggerAllBaseAbilities, triggerBaseAbility, triggerExtendedBaseAbility } from './baseAbilities';
import { openMeFirstWindow, openAfterScoringWindow, buildBaseTargetOptions, isSpecialLimitBlocked } from './abilityHelpers';
import type { PhaseExitResult } from '../../../engine/systems/FlowSystem';
import { registerInteractionHandler } from './abilityInteractionHandlers';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { resolveSpecial } from './abilityRegistry';
import type { AbilityContext } from './abilityRegistry';
import type { SpecialAfterScoringConsumedEvent } from './types';

// ============================================================================
// 基地记分辅助函数（供 FlowHooks 和 Prompt 继续函数共用）
// ============================================================================

/**
 * 对指定基地执行记分逻辑，返回所有相关事件
 * 
 * 包含：beforeScoring 基地能力 → 排名计算 → BASE_SCORED → afterScoring 基地能力 → BASE_REPLACED
 */
function scoreOneBase(
    core: SmashUpCore,
    baseIndex: number,
    baseDeck: string[],
    pid: PlayerId,
    now: number,
    random?: RandomFn,
    matchState?: MatchState<SmashUpCore>,
): { events: SmashUpEvent[]; newBaseDeck: string[]; matchState?: MatchState<SmashUpCore> } {
    // 默认 random（确定性回退，计分中大多数 trigger 不需要随机）
    const rng: RandomFn = random ?? {
        random: () => 0.5,
        d: () => 1,
        range: (min: number) => min,
        shuffle: <T>(arr: T[]) => [...arr],
    };
    const events: SmashUpEvent[] = [];
    let ms = matchState;
    const base = core.bases[baseIndex];
    const baseDef = getBaseDef(base.defId)!;
    
    // 【修复】newBaseDeck 必须在函数顶部声明，避免 TDZ 错误
    // 问题：之前在两个不同的作用域中声明了 newBaseDeck（line 454 和 line 476）
    // 当函数在 afterScoring 窗口打开后提前返回，再次调用时会访问未初始化的外层 newBaseDeck
    let newBaseDeck = baseDeck;
    // 触发 ongoing beforeScoring（如 pirate_king 移动到该基地、cthulhu_chosen +2力量）
    // 先于基地能力执行，确保基地能力能看到 ongoing 效果的结果
    
    // 检查是否已经触发过 beforeScoring（防止交互解决后重复触发）
    const alreadyTriggeredBeforeScoring = core.beforeScoringTriggeredBases?.includes(baseIndex) ?? false;
    
    if (!alreadyTriggeredBeforeScoring) {
        const beforeScoringEvents = fireTriggers(core, 'beforeScoring', {
            state: core,
            matchState: ms,
            playerId: pid,
            baseIndex,
            random: rng,
            now,
        });
        events.push(...beforeScoringEvents.events);
        if (beforeScoringEvents.matchState) ms = beforeScoringEvents.matchState;
        
        // 发射事件标记此基地已触发过 beforeScoring
        const markEvent = {
            type: SU_EVENT_TYPES.BEFORE_SCORING_TRIGGERED,
            payload: { baseIndex },
            timestamp: now,
        };
        events.push(markEvent as unknown as SmashUpEvent);
        
        // ✅ 关键修复：立即将标记事件 reduce 到本地 core 副本
        // 
        // 问题：事件驱动架构中，事件的发射（emit）和归约（reduce）是分离的：
        // 1. scoreOneBase 发射事件后立即返回
        // 2. 这些事件要等到整个 onPhaseExit 返回后，才会被 pipeline 逐个 reduce
        // 3. 但 FlowSystem 在交互解决后会重新进入 onPhaseExit，此时使用的 core 还没有包含第一次发射的标记事件
        // 
        // 解决方案：发射标记事件后立即 reduce 到本地 core 副本，确保后续调用 scoreOneBase 时能看到"已触发"标记
        // 
        // 示例场景（海盗王移动 bug）：
        // - 第一次调用：检查 beforeScoringTriggeredBases → undefined → 触发 beforeScoring → 创建海盗王交互 → halt
        // - 用户点击"移动到该基地" → 交互解决
        // - 第二次调用：如果没有立即 reduce，beforeScoringTriggeredBases 仍是 undefined → 又创建相同 ID 的交互 → UI 卡住
        core = reduce(core, markEvent as unknown as SmashUpEvent);

        // beforeScoring 可能创建了交互（如海盗王移动确认）
        // 必须先 halt 等交互解决、事件 reduce 到 core 后，再继续
        if (ms?.sys?.interaction?.current) {
            return { events, newBaseDeck: baseDeck, matchState: ms };
        }
    }

    // 将 ongoing beforeScoring 产生的事件（如 TEMP_POWER_ADDED、MINION_MOVED）reduce 到 core，
    // 确保后续基地能力和排名计算使用最新状态
    let updatedCore = core;
    for (const evt of events) {
        updatedCore = reduce(updatedCore, evt as SmashUpEvent);
    }

    // 触发 beforeScoring 基地能力（用 reduce 后的 core，包含 ongoing 效果）
    const beforeCtx = {
        state: updatedCore,
        matchState: ms,
        baseIndex,
        baseDefId: base.defId,
        playerId: pid,
        now,
    };
    const beforeResult = triggerBaseAbility(base.defId, 'beforeScoring', beforeCtx);
    events.push(...beforeResult.events);
    if (beforeResult.matchState) ms = beforeResult.matchState;

    // 基地能力也可能产生事件（如 VP_AWARDED），继续 reduce
    for (const evt of beforeResult.events) {
        updatedCore = reduce(updatedCore, evt as SmashUpEvent);
    }

    // 计算排名（使用 reduce 后的 core，包含 beforeScoring 的临时力量修正 + ongoing 卡力量贡献）
    const updatedBase = updatedCore.bases[baseIndex];
    const playerPowers = new Map<PlayerId, number>();
    const playerHasMinions = new Map<PlayerId, boolean>();
    for (const m of updatedBase.minions) {
        const prev = playerPowers.get(m.controller) ?? 0;
        playerPowers.set(m.controller, prev + getEffectivePower(updatedCore, m, baseIndex));
        playerHasMinions.set(m.controller, true);
    }
    // 加上 ongoing 卡力量贡献（如 vampire_summon_wolves 的力量指示物）
    // 必须遍历所有玩家，因为可能有玩家无随从但有 ongoing 卡力量贡献
    for (const pid of Object.keys(updatedCore.players)) {
        const bonus = getOngoingCardPowerContribution(updatedBase, pid);
        if (bonus > 0) {
            const prev = playerPowers.get(pid) ?? 0;
            playerPowers.set(pid, prev + bonus);
        }
    }

    // 规则：须有至少 1 个随从或至少 1 点力量才有资格参与计分
    // 修复 Bug：战力为0但有随从的玩家应该参与计分
    const sorted = Array.from(playerPowers.entries())
        .filter(([pid, p]) => p > 0 || playerHasMinions.get(pid))
        .sort((a, b) => b[1] - a[1]);

    // Property 16: 平局玩家获得该名次最高 VP
    const rankings: { playerId: string; power: number; vp: number }[] = [];
    let rankSlot = 0;
    for (let i = 0; i < sorted.length; i++) {
        const [playerId, power] = sorted[i];
        if (i > 0 && power < sorted[i - 1][1]) {
            rankSlot = i;
        }
        rankings.push({
            playerId,
            power,
            vp: rankSlot < 3 ? baseDef.vpAwards[rankSlot] : 0,
        });
    }

    // 收集每位玩家的随从力量 breakdown（用于 ActionLog 展示）
    const minionBreakdowns: Record<PlayerId, MinionPowerBreakdown[]> = {};
    for (const m of updatedBase.minions) {
        const bd = getEffectivePowerBreakdown(updatedCore, m, baseIndex);
        if (!minionBreakdowns[m.controller]) minionBreakdowns[m.controller] = [];
        minionBreakdowns[m.controller].push({
            defId: m.defId,
            basePower: bd.basePower,
            finalPower: bd.finalPower,
            modifiers: [
                ...(bd.permanentModifier !== 0 ? [{ sourceDefId: m.defId, sourceName: 'actionLog.powerModifier.permanent', value: bd.permanentModifier }] : []),
                ...(bd.tempModifier !== 0 ? [{ sourceDefId: m.defId, sourceName: 'actionLog.powerModifier.temp', value: bd.tempModifier }] : []),
                ...bd.ongoingDetails.map(d => ({ sourceDefId: d.sourceDefId, sourceName: d.sourceName, value: d.value })),
            ],
        });
    }

    const scoreEvt: BaseScoredEvent = {
        type: SU_EVENTS.BASE_SCORED,
        payload: { baseIndex, baseDefId: base.defId, rankings, minionBreakdowns },
        timestamp: now,
    };
    events.push(scoreEvt);

    // 触发 onMinionDiscardedFromBase（基地结算弃置，非消灭）
    // 在 BASE_SCORED 后、afterScoring 前触发，此时随从仍在 core 中（reducer 尚未执行）
    for (const m of base.minions) {
        const discardResult = fireTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            matchState: ms,
            playerId: m.controller,
            baseIndex,
            triggerMinionUid: m.uid,
            triggerMinionDefId: m.defId,
            random: rng,
            now,
        });
        events.push(...discardResult.events);
        if (discardResult.matchState) ms = discardResult.matchState;
    }

    // 记录 afterScoring 前的交互状态，用于判断 afterScoring 是否新增了交互
    const interactionBeforeAfterScoring = ms?.sys?.interaction?.current?.id ?? null;
    const queueLenBeforeAfterScoring = ms?.sys?.interaction?.queue?.length ?? 0;

    // 检查是否已经触发过 afterScoring（防止交互解决后重复触发）
    const alreadyTriggeredAfterScoring = updatedCore.afterScoringTriggeredBases?.includes(baseIndex) ?? false;

    let afterResult: BaseAbilityResult = { events: [] };
    if (!alreadyTriggeredAfterScoring) {
        // 先触发 ARMED 的 afterScoring special 技能
        const armedSpecials = (updatedCore.pendingAfterScoringSpecials ?? []).filter(
            s => s.baseIndex === baseIndex
        );
        
        for (const armed of armedSpecials) {
            const executor = resolveSpecial(armed.sourceDefId);
            if (executor) {
                const ctx: AbilityContext = {
                    state: updatedCore,
                    matchState: ms,
                    playerId: armed.playerId,
                    cardUid: armed.cardUid,
                    defId: armed.sourceDefId,
                    baseIndex,
                    random: rng,
                    now,
                };
                const result = executor(ctx);
                events.push(...result.events);
                if (result.matchState) ms = result.matchState;
                
                // 将 special 技能产生的事件 reduce 到 core
                for (const evt of result.events) {
                    updatedCore = reduce(updatedCore, evt as SmashUpEvent);
                }
            } else {
                // 卡牌没有实现：生成 ABILITY_FEEDBACK 事件
                const feedbackEvt: AbilityFeedbackEvent = {
                    type: SU_EVENT_TYPES.ABILITY_FEEDBACK,
                    payload: {
                        playerId: armed.playerId,
                        sourceDefId: armed.sourceDefId,
                        message: 'actionLog.ability_not_implemented',
                    },
                    timestamp: now,
                };
                events.push(feedbackEvt);
            }
            
            // 标记为已消费
            const consumedEvt: SpecialAfterScoringConsumedEvent = {
                type: SU_EVENT_TYPES.SPECIAL_AFTER_SCORING_CONSUMED,
                payload: {
                    sourceDefId: armed.sourceDefId,
                    playerId: armed.playerId,
                    baseIndex,
                },
                timestamp: now,
            };
            events.push(consumedEvt);
            updatedCore = reduce(updatedCore, consumedEvt);
        }
        
        // 触发 afterScoring 基地能力（使用 reduce 后的 core，包含 beforeScoring 效果 + ARMED special 效果）
        const afterCtx = {
            state: updatedCore,
            matchState: ms,
            baseIndex,
            baseDefId: base.defId,
            playerId: pid,
            rankings,
            now,
        };
        afterResult = triggerBaseAbility(base.defId, 'afterScoring', afterCtx);
        events.push(...afterResult.events);
        if (afterResult.matchState) ms = afterResult.matchState;

        // 发射事件标记此基地已触发过 afterScoring
        const markEvent = {
            type: SU_EVENT_TYPES.AFTER_SCORING_TRIGGERED,
            payload: { baseIndex },
            timestamp: now,
        };
        events.push(markEvent as unknown as SmashUpEvent);

        // 立即 reduce 到本地 core 副本，确保后续调用 scoreOneBase 时能看到"已触发"标记
        updatedCore = reduce(updatedCore, markEvent as unknown as SmashUpEvent);
    }

    // 将 afterScoring 基地能力产生的事件 reduce 到 core，
    // 确保 ongoing afterScoring 触发器使用最新状态。
    // 修复时序问题：寺庙 afterScoring 把随从放牌库底后，
    // 大副 afterScoring 不应再看到该随从在场上。
    let afterScoringCore = updatedCore;
    for (const evt of afterResult.events) {
        afterScoringCore = reduce(afterScoringCore, evt as SmashUpEvent);
    }

    // 触发 ongoing afterScoring（如 pirate_first_mate 移动到其他基地）
    // 使用 reduce 后的 core，包含基地能力的效果（如随从已被放入牌库底）
    
    const afterScoringEvents = fireTriggers(afterScoringCore, 'afterScoring', {
        state: afterScoringCore,
        playerId: pid,
        baseIndex,
        rankings,
        matchState: ms,
        random: rng,
        now,
    });
    events.push(...afterScoringEvents.events);
    if (afterScoringEvents.matchState) ms = afterScoringEvents.matchState;

    // 判断 afterScoring 是否新增了交互
    const interactionAfter = ms?.sys?.interaction?.current?.id ?? null;
    const queueLenAfter = ms?.sys?.interaction?.queue?.length ?? 0;
    const afterScoringCreatedInteraction =
        (interactionAfter !== null && interactionAfter !== interactionBeforeAfterScoring) ||
        (queueLenAfter > queueLenBeforeAfterScoring);

    // 【新增】检查是否需要打开 afterScoring 响应窗口
    // 注意：afterScoring 响应窗口在 BASE_SCORED 之后、BASE_CLEARED 之前打开
    // 这样玩家打出的 afterScoring 卡牌可以影响该基地的力量，并可能导致重新计分
    // 
    // ⚠️ 【关键修复】无论基地能力是否创建了交互，都要检查是否有 afterScoring 卡牌
    // 原因：基地能力创建交互（如海盗湾移动随从）和响应窗口（让玩家打出 afterScoring 卡牌）
    // 是两个独立的机制，应该同时存在
    // 检查是否有玩家手牌中有 afterScoring 卡牌
    const playersWithAfterScoringCards: PlayerId[] = [];
    for (const [playerId, player] of Object.entries(afterScoringCore.players)) {
        const hasAfterScoringCard = player.hand.some(c => {
            if (c.type !== 'action') return false;
            const def = getCardDef(c.defId) as ActionCardDef | undefined;
            return def?.subtype === 'special' && def.specialTiming === 'afterScoring';
        });
        if (hasAfterScoringCard) {
            playersWithAfterScoringCards.push(playerId);
        }
    }

    // 如果有玩家有 afterScoring 卡牌，打开 afterScoring 响应窗口
    if (playersWithAfterScoringCards.length > 0) {
        // 【重新计分规则】记录初始力量（用于响应窗口关闭后对比）
        // 规则：afterScoring 卡牌可以影响该基地的力量，如果力量变化则需要重新计分
        const initialPowers = new Map<PlayerId, number>();
        const currentBase = afterScoringCore.bases[baseIndex];
        for (const m of currentBase.minions) {
            const prev = initialPowers.get(m.controller) ?? 0;
            initialPowers.set(m.controller, prev + getEffectivePower(afterScoringCore, m, baseIndex));
        }
        // 加上 ongoing 卡力量贡献
        for (const playerId of Object.keys(afterScoringCore.players)) {
            const bonus = getOngoingCardPowerContribution(currentBase, playerId);
            if (bonus > 0) {
                const prev = initialPowers.get(playerId) ?? 0;
                initialPowers.set(playerId, prev + bonus);
            }
        }
        
        // 将初始力量存储到 matchState.sys（用于响应窗口关闭后对比）
        // 注意：不能存到响应窗口的 continuationContext 中，因为响应窗口不是交互
        if (ms) {
            ms = {
                ...ms,
                sys: {
                    ...ms.sys,
                    afterScoringInitialPowers: {
                        baseIndex,
                        powers: Object.fromEntries(initialPowers.entries()),
                    } as any,
                },
            };
        }
        
        // 打开 afterScoring 响应窗口（在 BASE_CLEARED 之前）
        const afterScoringWindowEvt = openAfterScoringWindow('scoreBases', pid, afterScoringCore.turnOrder, now);
        events.push(afterScoringWindowEvt);
        
        // 延迟发出 postScoringEvents（等响应窗口关闭后再发）
        // 将 postScoringEvents 存到响应窗口的 continuationContext 中
        // 注意：响应窗口关闭后，需要检查基地力量是否变化，如果变化则重新计分
        // 这个逻辑需要在 onPhaseExit 中处理
        
        // 【修复】不需要在这里修改 newBaseDeck，因为还没有发出 BASE_REPLACED 事件
        // BASE_REPLACED 事件会在响应窗口关闭后、postScoringEvents 中发出
        
        return { events, newBaseDeck, matchState: ms };
    }

    // 构建清除+替换事件
    const postScoringEvents: SmashUpEvent[] = [];
    const clearEvt: BaseClearedEvent = {
        type: SU_EVENTS.BASE_CLEARED,
        payload: { baseIndex, baseDefId: base.defId },
        timestamp: now,
    };
    postScoringEvents.push(clearEvt);

    // 替换基地
    if (newBaseDeck.length > 0) {
        const newBaseDefId = newBaseDeck[0];
        const replaceEvt: BaseReplacedEvent = {
            type: SU_EVENTS.BASE_REPLACED,
            payload: {
                baseIndex,
                oldBaseDefId: base.defId,
                newBaseDefId,
            },
            timestamp: now,
        };
        postScoringEvents.push(replaceEvt);
        newBaseDeck = newBaseDeck.slice(1);

        // 触发新基地的 onBaseRevealed 扩展时机（如绵羊神社：每位玩家可移动一个随从到此）
        const revealCtx = {
            state: core,
            matchState: ms,
            baseIndex,
            baseDefId: newBaseDefId,
            playerId: pid,
            now,
        };
        const revealResult = triggerExtendedBaseAbility(newBaseDefId, 'onBaseRevealed', revealCtx);
        postScoringEvents.push(...revealResult.events);
        if (revealResult.matchState) ms = revealResult.matchState;
    }

    // 关键：仅当 afterScoring 新增了交互时（如刚柔流寺庙平局选择、忍者道场消灭随从等），
    // 才延迟发出 BASE_CLEARED/BASE_REPLACED，确保 targetType: 'minion' 的场上点选交互能看到随从。
    // 不影响 beforeScoring/onBaseRevealed 等其他来源的交互。
    console.log('🔥 [scoreBase] 检查是否延迟 postScoringEvents:', {
        afterScoringCreatedInteraction,
        interactionBefore: interactionBeforeAfterScoring,
        interactionAfter,
        queueLenBefore: queueLenBeforeAfterScoring,
        queueLenAfter,
    });
    
    if (afterScoringCreatedInteraction) {
        // 把 postScoringEvents 序列化存到交互的 continuationContext 中
        // 【修复】如果有多个 afterScoring 交互（如母舰 + 侦察兵），必须存到第一个交互中
        // 这样第一个交互解决时会传递给下一个，最后一个解决时才会补发 BASE_CLEARED
        const firstInteraction = ms!.sys.interaction!.current ?? ms!.sys.interaction!.queue[0];
        if (firstInteraction?.data) {
            const data = firstInteraction.data as Record<string, unknown>;
            const ctx = (data.continuationContext ?? {}) as Record<string, unknown>;
            ctx._deferredPostScoringEvents = postScoringEvents.map(e => ({
                type: e.type,
                payload: (e as GameEvent).payload,
                timestamp: (e as GameEvent).timestamp,
            }));
            data.continuationContext = ctx;
        }
        return { events, newBaseDeck, matchState: ms };
    }

    // 无 afterScoring 交互：正常发出清除+替换事件
    events.push(...postScoringEvents);
    return { events, newBaseDeck, matchState: ms };
}

/** 注册多基地计分的交互解决处理函数 */
export function registerMultiBaseScoringInteractionHandler(): void {
    registerInteractionHandler('multi_base_scoring', (state, playerId, value, _iData, random, timestamp) => {
        const { baseIndex } = value as { baseIndex: number };
        const events: SmashUpEvent[] = [];
        let currentState = state;
        let currentBaseDeck = state.core.baseDeck;

        // ✅ 修复：清除当前交互（已经被解决了），避免 scoreOneBase 提前返回
        // 注意：这里不能直接修改 state，必须创建新对象（不可变更新）
        currentState = {
            ...currentState,
            sys: {
                ...currentState.sys,
                interaction: {
                    ...currentState.sys.interaction,
                    current: undefined,
                },
            },
        };

        // 【修复】提取延迟的 BASE_CLEARED/BASE_REPLACED 事件（但不立即补发）
        const deferredEvents = (_iData?.continuationContext as any)?._deferredPostScoringEvents as 
            { type: string; payload: unknown; timestamp: number }[] | undefined;
        // 1. 计分玩家选择的基地
        const result = scoreOneBase(currentState.core, baseIndex, currentBaseDeck, playerId, timestamp, random, currentState);
        events.push(...result.events);
        currentBaseDeck = result.newBaseDeck;
        if (result.matchState) currentState = result.matchState;

        // 【关键修复】立即将基地标记为"已计分"，避免 onPhaseExit 重复计分
        // 这是多基地计分重复计分 bug 的根本原因：
        // 当 afterScoring 创建交互时，BASE_CLEARED 事件被延迟发出
        // 如果不标记为"已计分"，onPhaseExit 在交互解决后重新进入时会再次计分同一个基地
        if (!currentState.sys.scoredBaseIndices) {
            currentState = {
                ...currentState,
                sys: { ...currentState.sys, scoredBaseIndices: [] },
            };
        }
        if (!currentState.sys.scoredBaseIndices.includes(baseIndex)) {
            currentState = {
                ...currentState,
                sys: {
                    ...currentState.sys,
                    scoredBaseIndices: [...currentState.sys.scoredBaseIndices, baseIndex],
                },
            };
        }

        // 2. 将已产生的事件 reduce 到本地 core 副本，获取最新状态
        let updatedCore = currentState.core;
        for (const evt of events) {
            updatedCore = reduce(updatedCore, evt as SmashUpEvent);
        }

        // 3. 检查剩余 eligible 基地（基于 sys.scoredBaseIndices，而不是 getScoringEligibleBaseIndices）
        // 这样可以避免延迟事件未补发时，已计分的基地被重复计入
        const allEligibleIndices = getScoringEligibleBaseIndices(updatedCore);
        const remainingIndices = allEligibleIndices.filter(i => !currentState.sys.scoredBaseIndices?.includes(i));

        // 如果 beforeScoring/afterScoring 创建了交互 → 先处理交互，剩余基地后续再计分
        if (currentState.sys.interaction?.current) {
            // 【修复】如果还有剩余基地需要计分，创建新的 multi_base_scoring 交互并加入队列
            // 这样 afterScoring 交互解决后，队列中的 multi_base_scoring 会自动弹出，继续计分流程
            if (remainingIndices.length >= 1) {
                const candidates = remainingIndices.map(i => {
                    const base = updatedCore.bases[i];
                    if (!base) return null;
                    const baseDef = getBaseDef(base.defId);
                    const totalPower = getTotalEffectivePowerOnBase(updatedCore, base, i);
                    return {
                        baseIndex: i,
                        label: `${baseDef?.name ?? `基地 ${i + 1}`} (力量 ${totalPower}/${baseDef?.breakpoint ?? '?'})`,
                    };
                }).filter(Boolean) as { baseIndex: number; label: string }[];

                if (candidates.length >= 1) {
                    const interaction = createSimpleChoice(
                        `multi_base_scoring_${timestamp}_remaining`, playerId,
                        remainingIndices.length === 1 ? '计分最后一个基地' : '选择先记分的基地',
                        buildBaseTargetOptions(candidates, updatedCore) as any[],
                        { sourceId: 'multi_base_scoring', targetType: 'base' },
                    );
                    currentState = queueInteraction(currentState, interaction);
                    
                    // 【关键修复】将剩余基地标记为"计分中"，避免 onPhaseExit 重复计分
                    // 这是多基地计分重复计分 bug 的根本原因：
                    // 当创建 multi_base_scoring 交互后，onPhaseExit 重新进入时会发现剩余基地还没有被标记为"已计分"
                    // 导致 onPhaseExit 直接计分，然后 multi_base_scoring 交互解决时又计分一次
                    for (const idx of remainingIndices) {
                        if (!currentState.sys.scoredBaseIndices!.includes(idx)) {
                            currentState = {
                                ...currentState,
                                sys: {
                                    ...currentState.sys,
                                    scoredBaseIndices: [...currentState.sys.scoredBaseIndices!, idx],
                                },
                            };
                        }
                    }
                }
            }
            return { state: currentState, events };
        }

        // 4. 没有 afterScoring 交互，继续处理剩余基地
        if (remainingIndices.length >= 2) {
            // 2+ 剩余 → 创建新的多基地选择交互
            const candidates = remainingIndices.map(i => {
                const base = updatedCore.bases[i];
                if (!base) return null;
                const baseDef = getBaseDef(base.defId);
                const totalPower = getTotalEffectivePowerOnBase(updatedCore, base, i);
                return {
                    baseIndex: i,
                    label: `${baseDef?.name ?? `基地 ${i + 1}`} (力量 ${totalPower}/${baseDef?.breakpoint ?? '?'})`,
                };
            }).filter(Boolean) as { baseIndex: number; label: string }[];

            if (candidates.length >= 2) {
                const interaction = createSimpleChoice(
                    `multi_base_scoring_${timestamp}`, playerId,
                    '选择先记分的基地', buildBaseTargetOptions(candidates, updatedCore) as any[],
                    { sourceId: 'multi_base_scoring', targetType: 'base' },
                );
                currentState = queueInteraction(currentState, interaction);
                return { state: currentState, events };
            }
        }

        // 1 个或 0 个剩余 → 逐个直接计分
        for (const idx of remainingIndices) {
            const base = updatedCore.bases[idx];
            if (!base) continue;
            const r = scoreOneBase(updatedCore, idx, currentBaseDeck, playerId, timestamp, random, currentState);
            events.push(...r.events);
            currentBaseDeck = r.newBaseDeck;
            if (r.matchState) currentState = r.matchState;
            // 基地能力创建了交互 → halt，剩余基地后续处理
            if (currentState.sys.interaction?.current) {
                return { state: currentState, events };
            }
            // 更新本地 core 副本
            for (const evt of r.events) {
                updatedCore = reduce(updatedCore, evt as SmashUpEvent);
            }
        }

        // 【关键修复】所有基地计分完成后，补发延迟事件
        // 只有当 remainingIndices 为空时（所有基地都计分完了），才补发延迟事件
        // 这样可以避免在中间步骤重复补发
        if (deferredEvents && deferredEvents.length > 0) {
            console.log('[multi_base_scoring] 所有基地计分完成，补发延迟事件:', deferredEvents.length);
            events.push(...deferredEvents as SmashUpEvent[]);
        }

        return { state: currentState, events };
    });
}

// ============================================================================
// Setup
// ============================================================================

function setup(playerIds: PlayerId[], random: RandomFn, setupData?: Record<string, unknown>): SmashUpCore {
    const nextUid = 1;

    const players: Record<PlayerId, PlayerState> = {};
    const playerSelections: Record<PlayerId, string[]> = {};
    for (const pid of playerIds) {
        players[pid] = {
            id: pid,
            vp: 0,
            hand: [],
            deck: [],
            discard: [],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
            factions: ['', ''],  // 占位，待 ALL_FACTIONS_SELECTED 事件填充
        };
        playerSelections[pid] = [];
    }

    // 翻开 玩家数+1 张基地（设置期间翻到 replaceOnSetup 的基地时替换并重洗）
    let shuffledBaseIds = random.shuffle(getAllBaseDefIds());
    const baseCount = playerIds.length + 1;
    const activeBases: BaseInPlay[] = [];

    while (activeBases.length < baseCount && shuffledBaseIds.length > 0) {
        const defId = shuffledBaseIds.shift()!;
        const def = getBaseDef(defId);
        if (def?.replaceOnSetup) {
            // 放回牌库并重洗
            shuffledBaseIds.push(defId);
            shuffledBaseIds = random.shuffle(shuffledBaseIds);
            continue;
        }
        activeBases.push({ defId, minions: [], ongoingActions: [] });
    }
    const baseDeck = shuffledBaseIds;

    // 重赛先手轮换：双人用 firstPlayerId 轮换，多人用 turnOrder 随机
    let initialTurnOrder = [...playerIds];
    if (Array.isArray(setupData?.turnOrder) && setupData.turnOrder.length === playerIds.length
        && setupData.turnOrder.every((id: unknown) => typeof id === 'string' && playerIds.includes(id as PlayerId))) {
        // 多人：使用服务端随机打乱的顺序
        initialTurnOrder = setupData.turnOrder as PlayerId[];
    } else if (typeof setupData?.firstPlayerId === 'string' && playerIds.includes(setupData.firstPlayerId)) {
        // 双人：先手玩家排第一
        const first = setupData.firstPlayerId;
        initialTurnOrder = [first, ...playerIds.filter(id => id !== first)];
    }

    return {
        players,
        turnOrder: initialTurnOrder,
        currentPlayerIndex: 0,
        bases: activeBases,
        baseDeck,
        turnNumber: 1,
        nextUid,
        gameResult: undefined,
        factionSelection: {
            takenFactions: [],
            playerSelections,
            completedPlayers: [],
        }
    };
}

// ============================================================================
// FlowSystem 钩子
// ============================================================================

export const smashUpFlowHooks: FlowHooks<SmashUpCore> = {
    initialPhase: 'factionSelect',

    getNextPhase({ from }): string {
        const idx = PHASE_ORDER.indexOf(from as GamePhase);
        if (idx === -1 || idx >= PHASE_ORDER.length - 1) {
            // endTurn 后回到 startTurn（跳过 factionSelect，它只在游戏开始时使用一次）
            return 'startTurn';
        }
        return PHASE_ORDER[idx + 1];
    },

    getActivePlayerId({ state }): PlayerId {
        return getCurrentPlayerId(state.core);
    },

    onPhaseExit({ state, from, command, random }): GameEvent[] | PhaseExitResult {
        const core = state.core;
        const pid = getCurrentPlayerId(core);
        const now = typeof command.timestamp === 'number' ? command.timestamp : 0;

        if (from === 'endTurn') {
            const events: SmashUpEvent[] = [];

            // 触发 ongoing 效果 onTurnEnd（如 dunwich_horror 回合结束消灭自身、ninja_assassination 消灭目标）
            const onTurnEndEvents = fireTriggers(core, 'onTurnEnd', {
                state: core,
                playerId: pid,
                random,
                now,
            });

            // 关键修复：onTurnEnd 触发器产生的 MINION_DESTROYED 事件必须经过保护过滤
            // （如伊万将军保护己方随从不被对手消灭），以及 onDestroy 触发链处理
            if (onTurnEndEvents.events.length > 0) {
                const ms = onTurnEndEvents.matchState ?? state;
                const afterDestroyMove = processDestroyMoveCycle(onTurnEndEvents.events, ms, pid, random, now);
                events.push(...afterDestroyMove.events);
            }

            // 切换到下一个玩家
            const nextIndex = (core.currentPlayerIndex + 1) % core.turnOrder.length;
            const evt: TurnEndedEvent = {
                type: SU_EVENTS.TURN_ENDED,
                payload: { playerId: pid, nextPlayerIndex: nextIndex },
                timestamp: now,
            };
            events.push(evt);
            return events;
        }

        if (from === 'scoreBases') {
            // Me First! 响应完成后，执行实际基地记分
            const events: GameEvent[] = [];

            // 【重新计分规则】检查是否刚关闭了 afterScoring 响应窗口
            // 如果力量变化，需要重新计分该基地（即使没有达到临界值）
            if (state.sys.afterScoringInitialPowers) {
                const { baseIndex: scoredBaseIndex, powers: initialPowers } = state.sys.afterScoringInitialPowers as any;
                
                console.log('[onPhaseExit] 检查 afterScoring 后力量变化:', {
                    baseIndex: scoredBaseIndex,
                    initialPowers,
                });
                
                // 计算当前力量
                const currentPowers = new Map<PlayerId, number>();
                const currentBase = core.bases[scoredBaseIndex];
                if (currentBase) {
                    for (const m of currentBase.minions) {
                        const prev = currentPowers.get(m.controller) ?? 0;
                        currentPowers.set(m.controller, prev + getEffectivePower(core, m, scoredBaseIndex));
                    }
                    // 加上 ongoing 卡力量贡献
                    for (const playerId of Object.keys(core.players)) {
                        const bonus = getOngoingCardPowerContribution(currentBase, playerId);
                        if (bonus > 0) {
                            const prev = currentPowers.get(playerId) ?? 0;
                            currentPowers.set(playerId, prev + bonus);
                        }
                    }
                }
                
                // 检查是否有力量变化
                let powerChanged = false;
                for (const [playerId, initialPower] of Object.entries(initialPowers)) {
                    const currentPower = currentPowers.get(playerId) ?? 0;
                    if (currentPower !== initialPower) {
                        powerChanged = true;
                        console.log('[onPhaseExit] 力量变化:', {
                            playerId,
                            initialPower,
                            currentPower,
                            delta: currentPower - initialPower,
                        });
                        break;
                    }
                }
                
                // 如果力量变化，重新计分该基地
                if (powerChanged && currentBase) {
                    console.log('[onPhaseExit] 力量变化，重新计分基地:', scoredBaseIndex);
                    
                    // 重新计算排名
                    const playerPowers = new Map<PlayerId, number>();
                    const playerHasMinions = new Map<PlayerId, boolean>();
                    for (const m of currentBase.minions) {
                        const prev = playerPowers.get(m.controller) ?? 0;
                        playerPowers.set(m.controller, prev + getEffectivePower(core, m, scoredBaseIndex));
                        playerHasMinions.set(m.controller, true);
                    }
                    // 加上 ongoing 卡力量贡献
                    for (const playerId of Object.keys(core.players)) {
                        const bonus = getOngoingCardPowerContribution(currentBase, playerId);
                        if (bonus > 0) {
                            const prev = playerPowers.get(playerId) ?? 0;
                            playerPowers.set(playerId, prev + bonus);
                        }
                    }
                    
                    // 规则：须有至少 1 个随从或至少 1 点力量才有资格参与计分
                    const sorted = Array.from(playerPowers.entries())
                        .filter(([pid, p]) => p > 0 || playerHasMinions.get(pid))
                        .sort((a, b) => b[1] - a[1]);
                    
                    // Property 16: 平局玩家获得该名次最高 VP
                    const rankings: { playerId: string; power: number; vp: number }[] = [];
                    let rankSlot = 0;
                    const baseDef = getBaseDef(currentBase.defId)!;
                    for (let i = 0; i < sorted.length; i++) {
                        const [playerId, power] = sorted[i];
                        if (i > 0 && power < sorted[i - 1][1]) {
                            rankSlot = i;
                        }
                        rankings.push({
                            playerId,
                            power,
                            vp: rankSlot < 3 ? baseDef.vpAwards[rankSlot] : 0,
                        });
                    }
                    
                    // 收集每位玩家的随从力量 breakdown（用于 ActionLog 展示）
                    const minionBreakdowns: Record<PlayerId, MinionPowerBreakdown[]> = {};
                    for (const m of currentBase.minions) {
                        const bd = getEffectivePowerBreakdown(core, m, scoredBaseIndex);
                        if (!minionBreakdowns[m.controller]) minionBreakdowns[m.controller] = [];
                        minionBreakdowns[m.controller].push({
                            defId: m.defId,
                            basePower: bd.basePower,
                            finalPower: bd.finalPower,
                            modifiers: [
                                ...(bd.permanentModifier !== 0 ? [{ sourceDefId: m.defId, sourceName: 'actionLog.powerModifier.permanent', value: bd.permanentModifier }] : []),
                                ...(bd.tempModifier !== 0 ? [{ sourceDefId: m.defId, sourceName: 'actionLog.powerModifier.temp', value: bd.tempModifier }] : []),
                                ...bd.ongoingDetails.map(d => ({ sourceDefId: d.sourceDefId, sourceName: d.sourceName, value: d.value })),
                            ],
                        });
                    }
                    
                    // 发出新的 BASE_SCORED 事件（重新计分结果）
                    const scoreEvt: BaseScoredEvent = {
                        type: SU_EVENTS.BASE_SCORED,
                        payload: { baseIndex: scoredBaseIndex, baseDefId: currentBase.defId, rankings, minionBreakdowns },
                        timestamp: now,
                    };
                    events.push(scoreEvt);
                    
                    console.log('[onPhaseExit] 重新计分完成:', {
                        baseIndex: scoredBaseIndex,
                        rankings,
                    });
                }
                
                // ⚠️ 关键修复：无论力量是否变化，都需要发出 BASE_CLEARED 和 BASE_REPLACED 事件
                // 原因：afterScoring 响应窗口打开时，这些事件被延迟发出
                // 响应窗口关闭后，必须补发这些事件，否则基地不会被清除和替换
                if (currentBase) {
                    // 发出 BASE_CLEARED 事件
                    const clearEvt: BaseClearedEvent = {
                        type: SU_EVENTS.BASE_CLEARED,
                        payload: { baseIndex: scoredBaseIndex, baseDefId: currentBase.defId },
                        timestamp: now,
                    };
                    events.push(clearEvt);
                    
                    // 替换基地
                    if (core.baseDeck.length > 0) {
                        const newBaseDefId = core.baseDeck[0];
                        const replaceEvt: BaseReplacedEvent = {
                            type: SU_EVENTS.BASE_REPLACED,
                            payload: {
                                baseIndex: scoredBaseIndex,
                                oldBaseDefId: currentBase.defId,
                                newBaseDefId,
                            },
                            timestamp: now,
                        };
                        events.push(replaceEvt);
                        
                        // 触发新基地的 onBaseRevealed 扩展时机（如绵羊神社：每位玩家可移动一个随从到此）
                        const revealCtx = {
                            state: core,
                            matchState: state,
                            baseIndex: scoredBaseIndex,
                            baseDefId: newBaseDefId,
                            playerId: pid,
                            now,
                        };
                        const revealResult = triggerExtendedBaseAbility(newBaseDefId, 'onBaseRevealed', revealCtx);
                        events.push(...revealResult.events);
                        if (revealResult.matchState) state = revealResult.matchState;
                    }
                    
                    console.log('[onPhaseExit] 补发 BASE_CLEARED 和 BASE_REPLACED 事件');
                }
                
                // 标记该基地已记分，防止后续正常计分循环重复计分
                if (!state.sys.scoredBaseIndices) {
                    state = {
                        ...state,
                        sys: { ...state.sys, scoredBaseIndices: [scoredBaseIndex] },
                    };
                } else if (!state.sys.scoredBaseIndices.includes(scoredBaseIndex)) {
                    state = {
                        ...state,
                        sys: {
                            ...state.sys,
                            scoredBaseIndices: [...state.sys.scoredBaseIndices, scoredBaseIndex],
                        },
                    };
                }
                
                // 清理状态（不可变更新）
                state = {
                    ...state,
                    sys: {
                        ...state.sys,
                        afterScoringInitialPowers: undefined,
                    },
                };
            }

            // 使用统一查询函数（优先锁定列表，回退实时计算）
            // Wiki Phase 3 Step 4：一旦基地在进入计分阶段时达到 breakpoint，必定计分
            const lockedIndices = getScoringEligibleBaseIndices(core);
            // 构建 eligible 基地信息（用于多基地选择 UI）
            const eligibleBases: { baseIndex: number; defId: string; totalPower: number }[] = [];
            for (const i of lockedIndices) {
                const base = core.bases[i];
                if (!base) continue;
                const totalPower = getTotalEffectivePowerOnBase(core, base, i);
                eligibleBases.push({ baseIndex: i, defId: base.defId, totalPower });
            }

            // 无基地达标 → 正常推进
            if (eligibleBases.length === 0) {
                return events;
            }

            // 【关键守卫】flowHalted=true 表示上一轮 onPhaseExit 返回了 halt，
            // 此时 FlowSystem(priority=25) 在 SmashUpEventSystem(priority=50) 之前执行，
            // core 尚未被交互处理器的计分事件更新，eligible 列表是过时的。
            // 必须 halt 等待 SmashUpEventSystem 处理完交互解决事件、core 更新后，
            // 下一轮 afterEvents 再重新进入 onPhaseExit 使用最新 core。
            // 
            // 修复：只有标志存在且交互仍在进行时才 halt，交互完成后自动清除标志
            if (state.sys.flowHalted) {
                if (state.sys.interaction.current) {
                    return { events: [], halt: true } as PhaseExitResult;
                }
                // 交互已解决，清除 flowHalted 标志（不可变更新）
                state = {
                    ...state,
                    sys: { ...state.sys, flowHalted: false },
                };
            }

            // 【关键修复】使用 sys 状态跟踪已记分的基地，防止 halt 后重复记分
            // 初始化或获取已记分基地列表（不可变更新）
            if (!state.sys.scoredBaseIndices) {
                state = {
                    ...state,
                    sys: { ...state.sys, scoredBaseIndices: [] },
                };
            }
            // 过滤掉已记分的基地
            const remainingIndices = lockedIndices.filter(i => !state.sys.scoredBaseIndices!.includes(i));
            console.log('[onPhaseExit] scoreBases 基地过滤:', {
                lockedIndices,
                scoredBaseIndices: state.sys.scoredBaseIndices,
                scoredBaseIndicesRef: state.sys.scoredBaseIndices ? `[${state.sys.scoredBaseIndices.join(',')}]` : 'null',
                remainingIndices,
                flowHalted: state.sys.flowHalted,
                hasInteraction: !!state.sys.interaction.current,
            });

            // 所有基地都已记分 → 清理状态并正常推进（不可变更新）
            if (remainingIndices.length === 0) {
                // 创建新 state 清理 scoredBaseIndices
                const cleanedState: MatchState<SmashUpCore> = {
                    ...state,
                    sys: { ...state.sys, scoredBaseIndices: [] },
                };
                // 返回清理后的 state（通过 updatedState 传播）
                return { events, updatedState: cleanedState } as PhaseExitResult;
            }

            // Property 14: 2+ 基地达标 → 通过 InteractionSystem(simple-choice) 让当前玩家选择计分顺序
            if (remainingIndices.length >= 2 && !state.sys.interaction.current) {
                const candidates = remainingIndices.map(i => {
                    const base = core.bases[i];
                    const totalPower = getTotalEffectivePowerOnBase(core, base, i);
                    const baseDef = getBaseDef(base.defId);
                    return {
                        baseIndex: i,
                        label: `${baseDef?.name ?? `基地 ${i + 1}`} (力量 ${totalPower}/${baseDef?.breakpoint ?? '?'})`,
                    };
                });

                const interaction = createSimpleChoice(
                    `multi_base_scoring_${now}`, pid,
                    '选择先记分的基地', buildBaseTargetOptions(candidates, core) as any[],
                    { sourceId: 'multi_base_scoring', targetType: 'base' },
                );
                const updatedState = queueInteraction(state, interaction);

                // halt=true：不切换阶段，等待交互解决后再继续
                return { events: [], halt: true, updatedState } as PhaseExitResult;
            }

            // 1 个基地达标 → 检查当前交互或队列中是否已有 multi_base_scoring 交互
            // 如果有，说明之前已经创建了交互，不应该重复计分
            // 使用 remainingIndices（已过滤已记分基地），按顺序逐个计分
            const currentIsMultiBaseScoring = 
                (state.sys.interaction.current?.data as any)?.sourceId === 'multi_base_scoring';
            const hasMultiBaseScoringInQueue = state.sys.interaction.queue.some(
                (i: any) => (i.data as any)?.sourceId === 'multi_base_scoring'
            );
            
            if (currentIsMultiBaseScoring || hasMultiBaseScoringInQueue) {
                // 当前交互或队列中已有 multi_base_scoring 交互，不重复计分
                // halt=true：等待交互解决
                return { events: [], halt: true } as PhaseExitResult;
            }
            
            let currentBaseDeck = core.baseDeck;
            let currentMatchState: MatchState<SmashUpCore> = state;
            let currentCore = core;  // ✅ 修复：维护一个本地 core 副本，每次计分后更新

            const maxIterations = remainingIndices.length;
            for (let iter = 0; iter < maxIterations; iter++) {
                if (iter >= remainingIndices.length) break;
                const foundIndex = remainingIndices[iter];

                console.log('[onPhaseExit] 记分基地:', {
                    iter,
                    foundIndex,
                    baseDefId: currentCore.bases[foundIndex]?.defId,
                    currentBaseDeck: currentBaseDeck.slice(0, 3),  // 只显示前3个
                });

                const result = scoreOneBase(currentCore, foundIndex, currentBaseDeck, pid, now, random, currentMatchState);
                
                // ⚠️ 【关键修复】立即检查是否打开了响应窗口，如果打开了就立即 halt
                // 问题：之前的代码先 push 所有事件，再检查响应窗口，导致多个基地同时计分时，
                // 第一个基地打开响应窗口后，循环继续计分第二个基地，第二个基地的 BASE_CLEARED 被发送
                // 修复：在 push 事件之前先检查响应窗口，如果打开了就立即 halt，不 push 事件，不继续循环
                const hasResponseWindowOpened = result.events.some(
                    (evt: SmashUpEvent) => evt.type === 'RESPONSE_WINDOW_OPENED'
                );
                if (hasResponseWindowOpened) {
                    console.log('[onPhaseExit] afterScoring 响应窗口打开（检测到 RESPONSE_WINDOW_OPENED 事件），立即 halt');
                    // ⚠️ 关键：不 push 事件到 events 数组，因为响应窗口打开后，
                    // 这些事件会在响应窗口关闭后重新生成（重新计分）
                    // 如果 push 了，会导致事件重复（第一次 halt 时 push，第二次重新计分时又 push）
                    // 
                    // 正确流程：
                    // 1. scoreOneBase 打开 afterScoring 响应窗口 → 立即 halt（不 push 事件）
                    // 2. 响应窗口关闭 → onPhaseExit 重新进入 → 重新计分该基地
                    // 3. 重新计分时生成新的事件（包括 BASE_SCORED、BASE_CLEARED、BASE_REPLACED）
                    return { events, halt: true, updatedState: result.matchState ?? currentMatchState } as PhaseExitResult;
                }
                
                // 没有打开响应窗口，正常 push 事件
                events.push(...result.events);
                currentBaseDeck = result.newBaseDeck;
                // 不可变传播 matchState（afterScoring 基地能力可能创建 Interaction）
                if (result.matchState) {
                    currentMatchState = result.matchState;
                }

                // ✅ 修复：将本次计分的事件 reduce 到 currentCore，确保下次计分使用最新状态
                for (const evt of result.events) {
                    currentCore = reduce(currentCore, evt as SmashUpEvent);
                }

                // beforeScoring 创建了交互（如海盗王移动确认）→ halt 等交互解决后重新计分
                if (currentMatchState.sys.interaction?.current) {
                    return { events, halt: true, updatedState: currentMatchState } as PhaseExitResult;
                }

                // 标记该基地已记分（不可变更新）
                // ⚠️ 只有在 scoreOneBase 成功完成（没有打开响应窗口）后，才标记为"已记分"
                if (!currentMatchState.sys.scoredBaseIndices) {
                    currentMatchState = {
                        ...currentMatchState,
                        sys: { ...currentMatchState.sys, scoredBaseIndices: [] },
                    };
                }
                // 【关键】不可变更新：创建新数组而不是直接 push
                currentMatchState = {
                    ...currentMatchState,
                    sys: {
                        ...currentMatchState.sys,
                        scoredBaseIndices: [...(currentMatchState.sys.scoredBaseIndices || []), foundIndex],
                    },
                };
                console.log('[onPhaseExit] 基地已记分，更新 scoredBaseIndices:', {
                    foundIndex,
                    scoredBaseIndices: currentMatchState.sys.scoredBaseIndices,
                    scoredBaseIndicesRef: `[${currentMatchState.sys.scoredBaseIndices.join(',')}]`,
                });
            }

            // 如果基地能力创建了 Interaction（如托尔图加 afterScoring），
            // 需要 halt 等待玩家响应，不能直接推进到下一阶段
            if (currentMatchState.sys.interaction?.current) {
                return { events, halt: true, updatedState: currentMatchState } as PhaseExitResult;
            }

            // 所有基地记分完成，清理状态（不可变更新）
            currentMatchState = {
                ...currentMatchState,
                sys: { ...currentMatchState.sys, scoredBaseIndices: [] },
            };

            // 清空 beforeScoring 和 afterScoring 触发标记（计分阶段结束）
            events.push({
                type: SU_EVENT_TYPES.BEFORE_SCORING_CLEARED,
                payload: {},
                timestamp: now,
            } as unknown as SmashUpEvent);
            events.push({
                type: SU_EVENT_TYPES.AFTER_SCORING_CLEARED,
                payload: {},
                timestamp: now,
            } as unknown as SmashUpEvent);

            // 返回更新后的 matchState（包含清理后的 scoredBaseIndices）
            return { events, updatedState: currentMatchState } as PhaseExitResult;

            return events;
        }

        return [];
    },

    onPhaseEnter({ state, from, to, random, command }): GameEvent[] | PhaseEnterResult {
        const core = state.core;
        const pid = getCurrentPlayerId(core);
        const now = typeof command.timestamp === 'number' ? command.timestamp : 0;
        const events: GameEvent[] = [];
        // 追踪 sys 变更（基地能力/ongoing 可能创建 Interaction）
        let currentMatchState: MatchState<SmashUpCore> = state;
        let hasSysUpdate = false;

        if (to === 'startTurn') {
            let nextPlayerId = pid;
            let nextTurnNumber = core.turnNumber;
            if (from === 'endTurn') {
                const nextIndex = (core.currentPlayerIndex + 1) % core.turnOrder.length;
                nextPlayerId = core.turnOrder[nextIndex];
                if (nextIndex === 0) {
                    nextTurnNumber = core.turnNumber + 1;
                }
            }
            const turnStarted: TurnStartedEvent = {
                type: SU_EVENTS.TURN_STARTED,
                payload: {
                    playerId: nextPlayerId,
                    turnNumber: nextTurnNumber,
                },
                timestamp: now,
            };
            events.push(turnStarted);

            // 触发基地 onTurnStart 能力（如拉莱耶：消灭随从获1VP、蘑菇王国：移动对手随从）
            const baseResult = triggerAllBaseAbilities('onTurnStart', core, nextPlayerId, now, undefined, currentMatchState);
            events.push(...baseResult.events);
            // 不可变传播 matchState（onTurnStart 基地能力可能创建 Interaction）
            if (baseResult.matchState) {
                currentMatchState = baseResult.matchState;
                hasSysUpdate = true;
            }

            // 触发 ongoing 效果 onTurnStart
            const onTurnStartEvents = fireTriggers(core, 'onTurnStart', {
                state: core,
                matchState: currentMatchState,
                playerId: nextPlayerId,
                random,
                now,
            });
            events.push(...onTurnStartEvents.events);
            if (onTurnStartEvents.matchState) {
                currentMatchState = onTurnStartEvents.matchState;
                hasSysUpdate = true;
            }

            // 有 sys 变更时返回 PhaseEnterResult，否则返回纯事件数组
            if (hasSysUpdate) {
                return { events, updatedState: currentMatchState } as PhaseEnterResult;
            }
            return events;
        }

        if (to === 'scoreBases') {
            // 清理上一轮的触发标记（防止异常退出导致标记残留）
            events.push({
                type: SU_EVENT_TYPES.BEFORE_SCORING_CLEARED,
                payload: {},
                timestamp: now,
            } as GameEvent);
            events.push({
                type: SU_EVENT_TYPES.AFTER_SCORING_CLEARED,
                payload: {},
                timestamp: now,
            } as GameEvent);

            // 检查是否有基地达到临界点，没有则跳过 Me First! 响应窗口
            const eligibleIndices = getScoringEligibleBaseIndices(core);

            if (eligibleIndices.length > 0) {
                // 锁定 eligible 基地列表到 core 状态
                // 规则：一旦基地在进入计分阶段时达到 breakpoint，即使 Me First! 响应窗口中
                // 力量被降低到 breakpoint 以下，该基地仍然必定计分（Wiki Phase 3 Step 4）
                events.push({
                    type: SU_EVENTS.SCORING_ELIGIBLE_BASES_LOCKED,
                    payload: { baseIndices: eligibleIndices },
                    timestamp: now,
                } as GameEvent);
                // 打开 Me First! 响应窗口，等待所有玩家响应
                // 实际记分在 onPhaseExit('scoreBases') 中执行
                const meFirstEvt = openMeFirstWindow('scoreBases', pid, core.turnOrder, now);
                events.push(meFirstEvt);
            }
            // 无基地达标时不打开窗口，onAutoContinueCheck 会自动推进到 draw
            return events;
        }

        if (to === 'draw') {
            const player = core.players[pid];
            if (player) {
                const { drawnUids, reshuffledDeckUids } = drawCards(player, DRAW_PER_TURN, random);
                if (drawnUids.length > 0) {
                    if (reshuffledDeckUids && reshuffledDeckUids.length > 0) {
                        const reshuffleEvt: DeckReshuffledEvent = {
                            type: SU_EVENTS.DECK_RESHUFFLED,
                            payload: { playerId: pid, deckUids: reshuffledDeckUids },
                            timestamp: now,
                        };
                        events.push(reshuffleEvt);
                    }
                    const drawEvt: CardsDrawnEvent = {
                        type: SU_EVENTS.CARDS_DRAWN,
                        payload: { playerId: pid, count: drawnUids.length, cardUids: drawnUids },
                        timestamp: now,
                    };
                    events.push(drawEvt);
                }
            }
        }

        return events;
    },

    onAutoContinueCheck({ state }): { autoContinue: boolean; playerId: PlayerId } | void {
        const core = state.core;
        const pid = getCurrentPlayerId(core);
        const phase = state.sys.phase as GamePhase;

        // 通用守卫：任何阶段有待处理的 Interaction 时都不自动推进
        // （基地能力如拉莱耶 onTurnStart、托尔图加 afterScoring 等可能在任意阶段创建 Interaction）
        if (state.sys.interaction?.current) {
            return undefined;
        }

        // factionSelect 自动推进 check
        if (phase === 'factionSelect') {
            // 如果所有人都选完了（reducer把selection置空了），则自动进入下一阶段
            if (!core.factionSelection) {
                return { autoContinue: true, playerId: pid };
            }
        }

        // startTurn 自动推进到 playCards
        if (phase === 'startTurn') {
            return { autoContinue: true, playerId: pid };
        }

        // scoreBases 阶段：条件性自动推进
        // 
        // 【修复逻辑】
        // 1. 如果 flowHalted=true 且交互已解决 → 自动推进（清理 halt 状态）
        // 2. 如果没有 eligible 基地 → 自动推进（无需计分）
        // 3. 如果有 eligible 基地且响应窗口已关闭 → 自动推进（触发计分）
        // 4. 其他情况（响应窗口仍打开）→ 不自动推进（等待响应）
        // 
        // 这样可以避免无限循环，同时在响应窗口关闭后自动推进触发计分。
        if (phase === 'scoreBases') {
            console.log('[onAutoContinueCheck] scoreBases 阶段检查:', {
                flowHalted: state.sys.flowHalted,
                hasInteraction: !!state.sys.interaction.current,
                interactionId: state.sys.interaction.current?.id,
                hasResponseWindow: !!state.sys.responseWindow?.current,
            });
            
            // 情况1：flowHalted=true 且交互已解决且响应窗口已关闭 → 自动推进
            if (state.sys.flowHalted && !state.sys.interaction.current && !state.sys.responseWindow?.current) {
                // 【修复】如果存在 afterScoringInitialPowers，说明需要重新计分
                // 返回 autoContinue: true，触发 ADVANCE_PHASE，这会再次调用 onPhaseExit
                // onPhaseExit 开头的重新计分逻辑会执行，然后推进到 draw 阶段
                if ((state.sys as any).afterScoringInitialPowers) {
                    console.log('[onAutoContinueCheck] scoreBases: 检测到 afterScoringInitialPowers，自动推进触发重新计分');
                    return { autoContinue: true, playerId: pid };
                }
                
                console.log('[onAutoContinueCheck] scoreBases: flowHalted=true 且交互已解决且响应窗口已关闭，自动推进');
                return { autoContinue: true, playerId: pid };
            }
            
            // 情况2：没有 eligible 基地 → 自动推进
            const eligibleIndices = getScoringEligibleBaseIndices(core);
            console.log('[onAutoContinueCheck] scoreBases: eligibleIndices =', eligibleIndices);
            if (eligibleIndices.length === 0) {
                console.log('[onAutoContinueCheck] scoreBases: 无 eligible 基地，自动推进');
                return { autoContinue: true, playerId: pid };
            }
            
            // 情况3：有 eligible 基地且响应窗口已关闭 → 自动推进（触发计分）
            if (!state.sys.responseWindow?.current) {
                console.log('[onAutoContinueCheck] scoreBases: 响应窗口已关闭，自动推进触发计分');
                return { autoContinue: true, playerId: pid };
            }
            
            // 情况4：响应窗口仍打开 → 不自动推进（等待响应）
            console.log('[onAutoContinueCheck] scoreBases: 响应窗口仍打开，等待响应');
            return undefined;
        }

        // draw 阶段：手牌不超限则自动推进到 endTurn
        if (phase === 'draw') {
            const player = core.players[pid];
            if (player && player.hand.length <= HAND_LIMIT) {
                return { autoContinue: true, playerId: pid };
            }
        }

        // endTurn 自动推进到 startTurn（切换玩家后）
        if (phase === 'endTurn') {
            return { autoContinue: true, playerId: pid };
        }
    },
};

// ============================================================================
// playerView：不再隐藏手牌/牌库，直接发送完整数据（不需要防作弊）
// ============================================================================

function playerView(_state: SmashUpCore, _playerId: PlayerId): Partial<SmashUpCore> {
    return {};
}


// ============================================================================
// isGameOver
// ============================================================================

function isGameOver(state: SmashUpCore): GameOverResult | undefined {
    if (state.gameResult) return state.gameResult;

    // 回合结束时检查：有玩家 >= 15 VP（原始 VP，惩罚在最终分数中体现）
    const winners = state.turnOrder.filter(pid => state.players[pid]?.vp >= VP_TO_WIN);
    if (winners.length === 0) return undefined;

    // 计算含疯狂卡惩罚的最终分数
    const scores = getScores(state);

    if (winners.length === 1) {
        return { winner: winners[0], scores };
    }
    // 多人达标：最终分数最高者胜
    const sorted = winners.sort((a, b) => scores[b] - scores[a]);
    if (scores[sorted[0]] > scores[sorted[1]]) {
        return { winner: sorted[0], scores };
    }
    // 平局：疯狂卡较少者胜（克苏鲁扩展规则）
    if (state.madnessDeck !== undefined) {
        const madnessA = countMadnessCards(state.players[sorted[0]]);
        const madnessB = countMadnessCards(state.players[sorted[1]]);
        if (madnessA !== madnessB) {
            return { winner: madnessA < madnessB ? sorted[0] : sorted[1], scores };
        }
    }
    // 仍然平局：继续游戏
    return undefined;
}

export function getScores(state: SmashUpCore): Record<PlayerId, number> {
    const scores: Record<PlayerId, number> = {};
    for (const pid of state.turnOrder) {
        const player = state.players[pid];
        if (!player) continue;
        let vp = player.vp;
        // P19: 疯狂卡 VP 惩罚（每 2 张扣 1 VP）
        if (state.madnessDeck !== undefined) {
            vp -= madnessVpPenalty(countMadnessCards(player));
        }
        scores[pid] = vp;
    }
    return scores;
}

// ============================================================================
// 事件拦截：替代效果（Replacement Effects）
// ============================================================================

/** 将领域层拦截器注册表委托给引擎 interceptEvent 钩子 */
function domainInterceptEvent(
    state: SmashUpCore,
    event: SmashUpEvent
): SmashUpEvent | SmashUpEvent[] | null {
    const result = ongoingInterceptEvent(state, event);
    if (result !== undefined) return result;
    return event; // 无拦截器匹配，返回原事件
}

// ============================================================================
// 系统事件后处理：Prompt bridge 等系统产生的领域事件需要触发 ongoing trigger
// ============================================================================

function postProcessSystemEvents(
    state: SmashUpCore,
    events: SmashUpEvent[],
    random: RandomFn,
    matchState?: MatchState<SmashUpCore>
): { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> } {
    // 提取时间戳（取第一个事件的 timestamp）
    const now = events.length > 0 && typeof events[0].timestamp === 'number' ? events[0].timestamp : 0;
    // 当前玩家作为 trigger 的 sourcePlayerId
    const pid = getCurrentPlayerId(state);
    // 使用 pipeline 传入的 matchState（包含真实 sys），或构造最小包装
    let ms = matchState ?? { core: state, sys: { interaction: { current: undefined, queue: [] } } } as unknown as MatchState<SmashUpCore>;

    // 依次执行保护过滤 + trigger 后处理（链式传递 matchState）
    // destroy ↔ move 循环直到稳定（move 触发器可能产生新的 MINION_DESTROYED）
    const afterDestroyMove = processDestroyMoveCycle(events, ms, pid, random, now);
    if (afterDestroyMove.matchState) ms = afterDestroyMove.matchState;
    // 返回手牌/放牌库底保护过滤（与 execute() 后处理对齐）
    const afterReturn = filterProtectedReturnEvents(afterDestroyMove.events, ms.core, pid);
    const afterDeckBottom = filterProtectedDeckBottomEvents(afterReturn, ms.core, pid);
    const afterAffect = processAffectTriggers(afterDeckBottom, ms, pid, random, now);
    if (afterAffect.matchState) ms = afterAffect.matchState;

    // 检测 MINION_PLAYED 事件，自动追加触发链（onPlay + 基地能力 + ongoing）
    // 关键：必须先把 MINION_PLAYED 之前的事件 reduce 到 core 中，
    // 否则 onPlay 天赋读取的牌库/手牌等状态是旧的（如维纳斯捕食者从牌库搜索打出行尸，
    // 行尸 onPlay 读取 deck[0] 时 CARDS_DRAWN 还没 reduce，牌库未更新）。
    //
    // 修复策略：在遇到 MINION_PLAYED 时，先把它之前的非 MINION_PLAYED 事件
    // reduce 到临时 core 中，让 fireMinionPlayedTriggers 拿到最新的牌库/手牌状态。
    // 不 reduce MINION_PLAYED 本身，因为在 execute 路径（步骤 4.5）中 state 已经
    // 包含了所有事件的 reduce 结果，再 reduce 会导致 minionsPlayed 等字段重复计算。
    //
    // 去重逻辑（D45 维度）：postProcessSystemEvents 在 pipeline 中被调用两次（步骤 4.5 和步骤 5），
    // 必须防止同一个 MINION_PLAYED 事件被重复处理。去重策略：
    // 1. 优先检查 sourceCommandType：来自命令的事件（有 sourceCommandType）只在步骤 4.5 处理
    // 2. 对于派生事件（无 sourceCommandType），通过 cardUid+baseIndex 去重，避免重复处理
    // 3. 使用 matchState.sys._processedMinionPlayed 集合记录已处理的事件（格式：`${cardUid}@${baseIndex}`）
    const derivedEvents: SmashUpEvent[] = [];
    // 收集 MINION_PLAYED 之前的非 MINION_PLAYED 事件，用于临时 reduce
    const prePlayEvents: SmashUpEvent[] = [];
    
    // 初始化已处理事件集合（如果不存在）
    // 使用 any 类型断言绕过 SystemState 类型限制（这是游戏特定的临时状态）
    // 【D45 修复】统一处理 MINION_PLAYED 和 ACTION_PLAYED 的去重
    const sysAny = ms.sys as any;
    if (!sysAny._processedPlayedEvents || !(sysAny._processedPlayedEvents instanceof Set)) {
        sysAny._processedPlayedEvents = new Set<string>();
    }
    const processedSet = sysAny._processedPlayedEvents as Set<string>;
    
    // 【修复】清理返回手牌的随从的去重标记
    // 当随从返回手牌后再次打出时，应该重新触发 onPlay 能力
    for (const event of afterAffect.events) {
        if (event.type === SU_EVENTS.MINION_RETURNED) {
            const returnedEvt = event as { type: string; payload: { minionUid: string; fromBaseIndex: number } };
            const eventKey = `MINION:${returnedEvt.payload.minionUid}@${returnedEvt.payload.fromBaseIndex}`;
            processedSet.delete(eventKey);
        }
    }
    
    for (const event of afterAffect.events) {
        if (event.type === SU_EVENTS.MINION_PLAYED) {
            const playedEvt = event as MinionPlayedEvent;
            
            // 去重检查：构造事件唯一标识（MINION: + cardUid + baseIndex）
            const eventKey = `MINION:${playedEvt.payload.cardUid}@${playedEvt.payload.baseIndex}`;
            
            // 如果已处理过，跳过（防止步骤 4.5 和步骤 5 重复处理）
            if (processedSet.has(eventKey)) {
                prePlayEvents.push(event);
                continue;
            }
            
            // 标记为已处理
            processedSet.add(eventKey);
            
            // 将之前积累的事件 reduce 到临时 core
            // 确保 onPlay 触发时看到的是最新状态（随从已在场上，牌库/手牌已更新）
            let tempCore = state;
            for (const preEvt of prePlayEvents) {
                tempCore = reduce(tempCore, preEvt);
            }
            // 【重要】对于从牌库打出的随从（fromDeck: true），必须 reduce 当前 MINION_PLAYED 事件
            // 确保 onPlay 触发器看到更新后的牌库状态（当前卡已被移除）
            // 例如：robot_hoverbot 从牌库打出时，onPlay 触发器需要看到新的牌库顶
            // 对于从手牌打出的随从，state 已经包含了所有事件的 reduce 结果，不需要再 reduce
            const payload = event.payload;
            if (payload.fromDeck) {
                tempCore = reduce(tempCore, event);
            }
            
            const triggers = fireMinionPlayedTriggers({
                core: tempCore,
                matchState: ms,
                playerId: payload.playerId,
                cardUid: payload.cardUid,
                defId: payload.defId,
                baseIndex: payload.baseIndex,
                power: payload.power,
                random,
                now: event.timestamp,
                playedEvt: event as MinionPlayedEvent,
            });
            derivedEvents.push(...triggers.events);
            if (triggers.matchState) ms = triggers.matchState;
        } else if (event.type === SU_EVENTS.ACTION_PLAYED) {
            // 【D45 修复】ACTION_PLAYED 事件也需要去重，防止行动卡 onPlay 能力被触发两次
            // 典型场景：传送门创建交互，交互解决后 pipeline 重新进入 postProcessSystemEvents
            const playedEvt = event as { type: string; payload: { playerId: string; cardUid: string; defId: string }; timestamp: number };
            
            // 去重检查：构造事件唯一标识（ACTION: + cardUid + playerId）
            const eventKey = `ACTION:${playedEvt.payload.cardUid}@${playedEvt.payload.playerId}`;
            
            // 如果已处理过，跳过（防止步骤 4.5 和步骤 5 重复处理）
            if (processedSet.has(eventKey)) {
                prePlayEvents.push(event);
                continue;
            }
            
            // 标记为已处理
            processedSet.add(eventKey);
            
            // ACTION_PLAYED 的 onPlay 触发已在 execute() 中处理，这里只需要标记去重
            // 不需要额外触发逻辑（与 MINION_PLAYED 不同）
            prePlayEvents.push(event);
        } else {
            prePlayEvents.push(event);
        }
    }

    // 对 derived events 递归执行 trigger 后处理（onPlay 产生的 MINION_DESTROYED 等需要触发 onDestroy 链）
    let finalDerived = derivedEvents;
    if (derivedEvents.length > 0) {
        const afterDerivedDestroyMove = processDestroyMoveCycle(derivedEvents, ms, pid, random, now);
        if (afterDerivedDestroyMove.matchState) ms = afterDerivedDestroyMove.matchState;
        // 返回手牌/放牌库底保护过滤（与 execute() 后处理对齐）
        const afterDerivedReturn = filterProtectedReturnEvents(afterDerivedDestroyMove.events, ms.core, pid);
        const afterDerivedDeckBottom = filterProtectedDeckBottomEvents(afterDerivedReturn, ms.core, pid);
        const afterDerivedAffect = processAffectTriggers(afterDerivedDeckBottom, ms, pid, random, now);
        if (afterDerivedAffect.matchState) ms = afterDerivedAffect.matchState;
        finalDerived = afterDerivedAffect.events;
    }

    return { events: [...afterAffect.events, ...finalDerived], matchState: ms };
}

// ============================================================================
// 领域内核导出
// ============================================================================

export const SmashUpDomain: DomainCore<SmashUpCore, SmashUpCommand, SmashUpEvent> = {
    gameId: 'smashup',
    setup,
    validate,
    execute,
    reduce,
    interceptEvent: domainInterceptEvent,
    postProcessSystemEvents,
    playerView,
    isGameOver,
};

export type { SmashUpCommand, SmashUpCore, SmashUpEvent } from './types';
export { SU_COMMANDS, SU_EVENTS } from './types';
export { registerAbility, resolveAbility, resolveOnPlay, resolveTalent, resolveSpecial, resolveOnDestroy, clearRegistry } from './abilityRegistry';
export type { AbilityContext, AbilityResult, AbilityExecutor } from './abilityRegistry';
export {
    registerBaseAbility,
    triggerBaseAbility,
    triggerAllBaseAbilities,
    hasBaseAbility,
    clearBaseAbilityRegistry,
    registerBaseAbilities,
    triggerExtendedBaseAbility,
} from './baseAbilities';
export type { BaseTriggerTiming, BaseAbilityContext, BaseAbilityResult, BaseAbilityExecutor } from './baseAbilities';
export {
    registerPowerModifier,
    clearPowerModifierRegistry,
    getOngoingPowerModifier,
    getEffectivePower,
    getPlayerEffectivePowerOnBase,
    getTotalEffectivePowerOnBase,
} from './ongoingModifiers';
export type { PowerModifierFn, PowerModifierContext } from './ongoingModifiers';

// Export postProcessSystemEvents for tests
export { postProcessSystemEvents };
