/**
 * 大杀四方 (Smash Up) - 领域内核组装
 *
 * 职责：setup 初始化、FlowSystem 钩子、playerView、isGameOver
 */

import type { DomainCore, GameEvent, GameOverResult, PlayerId, RandomFn, MatchState } from '../../../engine/types';
import { processDestroyTriggers, processMoveTriggers, processAffectTriggers } from './reducer';
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
    DRAW_PER_TURN,
    HAND_LIMIT,
    VP_TO_WIN,
    getCurrentPlayerId,
} from './types';
import { getEffectivePower, getTotalEffectivePowerOnBase, getEffectiveBreakpoint, getEffectivePowerBreakdown, getOngoingCardPowerContribution } from './ongoingModifiers';
import { fireTriggers, interceptEvent as ongoingInterceptEvent } from './ongoingEffects';
import { validate } from './commands';
import { execute, reduce } from './reducer';
import { getAllBaseDefIds, getBaseDef } from '../data/cards';
import { drawCards } from './utils';
import { countMadnessCards, madnessVpPenalty, fireMinionPlayedTriggers } from './abilityHelpers';
import { triggerAllBaseAbilities, triggerBaseAbility, triggerExtendedBaseAbility } from './baseAbilities';
import { openMeFirstWindow, buildBaseTargetOptions } from './abilityHelpers';
import type { PhaseExitResult } from '../../../engine/systems/FlowSystem';
import { registerInteractionHandler } from './abilityInteractionHandlers';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';

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
    // 触发 ongoing beforeScoring（如 pirate_king 移动到该基地、cthulhu_chosen +2力量）
    // 先于基地能力执行，确保基地能力能看到 ongoing 效果的结果
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

    // beforeScoring 可能创建了交互（如海盗王移动确认）
    // 必须先 halt 等交互解决、事件 reduce 到 core 后，再继续
    if (ms?.sys?.interaction?.current) {
        return { events, newBaseDeck: baseDeck, matchState: ms };
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
    for (const m of updatedBase.minions) {
        const prev = playerPowers.get(m.controller) ?? 0;
        playerPowers.set(m.controller, prev + getEffectivePower(updatedCore, m, baseIndex));
    }
    // 加上 ongoing 卡力量贡献（如 vampire_summon_wolves 的力量指示物）
    for (const [pid, power] of playerPowers) {
        const bonus = getOngoingCardPowerContribution(updatedBase, pid);
        if (bonus > 0) playerPowers.set(pid, power + bonus);
    }

    const sorted = Array.from(playerPowers.entries())
        .filter(([, p]) => p > 0)
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

    // 触发 afterScoring 基地能力
    const afterCtx = {
        state: core,
        matchState: ms,
        baseIndex,
        baseDefId: base.defId,
        playerId: pid,
        rankings,
        now,
    };
    const afterResult = triggerBaseAbility(base.defId, 'afterScoring', afterCtx);
    events.push(...afterResult.events);
    if (afterResult.matchState) ms = afterResult.matchState;

    // 触发 ongoing afterScoring（如 pirate_first_mate 移动到其他基地）
    const afterScoringEvents = fireTriggers(updatedCore, 'afterScoring', {
        state: updatedCore,
        playerId: pid,
        baseIndex,
        rankings,
        matchState: ms,
        random: rng,
        now,
    });
    events.push(...afterScoringEvents.events);
    if (afterScoringEvents.matchState) ms = afterScoringEvents.matchState;

    // 清除基地：afterScoring 全部完成后，将随从和 ongoing 弃到各自所有者弃牌堆并移除基地
    // 规则顺序：VP 发放 → afterScoring 效果（随从仍在）→ 清除基地 → 替换基地
    const clearEvt: BaseClearedEvent = {
        type: SU_EVENTS.BASE_CLEARED,
        payload: { baseIndex, baseDefId: base.defId },
        timestamp: now,
    };
    events.push(clearEvt);

    // 替换基地
    let newBaseDeck = baseDeck;
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
        events.push(replaceEvt);
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
        events.push(...revealResult.events);
        if (revealResult.matchState) ms = revealResult.matchState;
    }

    return { events, newBaseDeck, matchState: ms };
}

/** 注册多基地计分的交互解决处理函数 */
export function registerMultiBaseScoringInteractionHandler(): void {
    registerInteractionHandler('multi_base_scoring', (state, playerId, value, _iData, random, timestamp) => {
        const { baseIndex } = value as { baseIndex: number };
        const result = scoreOneBase(state.core, baseIndex, state.core.baseDeck, playerId, timestamp, random, state);
        const updatedState = result.matchState ?? state;
        return { state: updatedState, events: result.events };
    });
}

// ============================================================================
// Setup
// ============================================================================

function setup(playerIds: PlayerId[], random: RandomFn): SmashUpCore {
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

    return {
        players,
        turnOrder: [...playerIds],
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

            // 触发 ongoing 效果 onTurnEnd（如 dunwich_horror 回合结束消灭自身）
            const onTurnEndEvents = fireTriggers(core, 'onTurnEnd', {
                state: core,
                playerId: pid,
                random,
                now,
            });
            events.push(...onTurnEndEvents.events);

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

            // 找出所有达到临界点的基地
            const eligibleBases: { baseIndex: number; defId: string; totalPower: number }[] = [];
            for (let i = 0; i < core.bases.length; i++) {
                const base = core.bases[i];
                const baseDef = getBaseDef(base.defId);
                if (!baseDef) continue;
                const totalPower = getTotalEffectivePowerOnBase(core, base, i);
                const bp = getEffectiveBreakpoint(core, i);
                if (totalPower >= bp) {
                    eligibleBases.push({ baseIndex: i, defId: base.defId, totalPower });
                }
            }

            // 无基地达标 → 正常推进
            if (eligibleBases.length === 0) {
                return events;
            }

            // Property 14: 2+ 基地达标 → 通过 InteractionSystem(simple-choice) 让当前玩家选择计分顺序
            // flowHalted 守卫：Interaction 解决后同一 afterEvents 轮次中 FlowSystem 会再次调用 onPhaseExit，
            // 此时 SmashUpEventSystem 尚未处理计分事件（core 未更新），跳过 Interaction 创建，
            // 直接走下方的单基地循环计分逻辑，避免重复创建 Interaction 导致流程卡死
            if (eligibleBases.length >= 2 && !state.sys.interaction.current && !state.sys.flowHalted) {
                const candidates = eligibleBases.map(eb => {
                    const baseDef = getBaseDef(eb.defId);
                    return {
                        baseIndex: eb.baseIndex,
                        label: `${baseDef?.name ?? `基地 ${eb.baseIndex + 1}`} (力量 ${eb.totalPower}/${baseDef?.breakpoint ?? '?'})`,
                    };
                });

                const interaction = createSimpleChoice(
                    `multi_base_scoring_${now}`, pid,
                    '选择先记分的基地', buildBaseTargetOptions(candidates, state) as any[], 'multi_base_scoring',
                );
                const updatedState = queueInteraction(state, interaction);

                // halt=true：不切换阶段，等待交互解决后再继续
                return { events: [], halt: true, updatedState } as PhaseExitResult;
            }

            // 1 个基地达标（或 Prompt 已解决后的后续循环）→ 直接记分
            // Property 15: 循环检查所有达到临界点的基地
            let remainingBaseIndices = core.bases.map((_, index) => index);
            let currentBaseDeck = core.baseDeck;
            let currentMatchState: MatchState<SmashUpCore> = state;

            const maxIterations = remainingBaseIndices.length;
            for (let iter = 0; iter < maxIterations; iter++) {
                let foundIndex: number | null = null;
                for (const baseIndex of remainingBaseIndices) {
                    const base = core.bases[baseIndex];
                    const baseDef = getBaseDef(base.defId);
                    if (!baseDef) continue;
                    const totalPower = getTotalEffectivePowerOnBase(core, base, baseIndex);
                    if (totalPower >= getEffectiveBreakpoint(core, baseIndex)) {
                        foundIndex = baseIndex;
                        break;
                    }
                }
                if (foundIndex === null) break;

                const result = scoreOneBase(core, foundIndex, currentBaseDeck, pid, now, random, currentMatchState);
                events.push(...result.events);
                currentBaseDeck = result.newBaseDeck;
                // 不可变传播 matchState（afterScoring 基地能力可能创建 Interaction）
                if (result.matchState) {
                    currentMatchState = result.matchState;
                }
                // beforeScoring 创建了交互（如海盗王移动确认）→ halt 等交互解决后重新计分
                if (currentMatchState.sys.interaction?.current) {
                    return { events, halt: true, updatedState: currentMatchState } as PhaseExitResult;
                }
                remainingBaseIndices = remainingBaseIndices.filter((index) => index !== foundIndex);
            }

            // 如果基地能力创建了 Interaction（如托尔图加 afterScoring），
            // 需要 halt 等待玩家响应，不能直接推进到下一阶段
            if (currentMatchState.sys.interaction?.current) {
                return { events, halt: true, updatedState: currentMatchState } as PhaseExitResult;
            }

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
            // 先检查是否有基地达到临界点，没有则跳过 Me First! 响应窗口
            // 规则：Me First! 只在有基地需要记分时触发
            let hasEligibleBase = false;
            for (let i = 0; i < core.bases.length; i++) {
                const base = core.bases[i];
                const baseDef = getBaseDef(base.defId);
                if (!baseDef) continue;
                const totalPower = getTotalEffectivePowerOnBase(core, base, i);
                if (totalPower >= getEffectiveBreakpoint(core, i)) {
                    hasEligibleBase = true;
                    break;
                }
            }

            if (hasEligibleBase) {
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

        // scoreBases 自动推进：
        // Me First! 响应窗口打开时不推进（由 ResponseWindowSystem 阻塞命令）
        // 响应窗口关闭后，自动推进到 draw（记分在 onPhaseExit 中执行）
        if (phase === 'scoreBases') {
            // 检查响应窗口是否仍然打开
            const responseWindow = state.sys.responseWindow?.current;
            if (responseWindow) {
                // 响应窗口仍然打开，不自动推进
                return undefined;
            }
            // 响应窗口已关闭，自动推进
            return { autoContinue: true, playerId: pid };
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
// playerView：隐藏其他玩家手牌与牌库
// ============================================================================

function playerView(state: SmashUpCore, playerId: PlayerId): Partial<SmashUpCore> {
    const filtered: Record<PlayerId, PlayerState> = {};
    for (const [pid, player] of Object.entries(state.players)) {
        if (pid === playerId) {
            filtered[pid] = player;
        } else {
            // 隐藏手牌内容和牌库内容，只保留数量
            filtered[pid] = {
                ...player,
                hand: player.hand.map(c => ({ ...c, defId: 'hidden', type: c.type })),
                deck: player.deck.map(c => ({ ...c, defId: 'hidden', type: c.type })),
            };
        }
    }
    return { players: filtered };
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
    const afterDestroy = processDestroyTriggers(events, ms, pid, random, now);
    if (afterDestroy.matchState) ms = afterDestroy.matchState;
    const afterMove = processMoveTriggers(afterDestroy.events, ms, pid, random, now);
    if (afterMove.matchState) ms = afterMove.matchState;
    const afterAffect = processAffectTriggers(afterMove.events, ms, pid, random, now);
    if (afterAffect.matchState) ms = afterAffect.matchState;

    // 检测 MINION_PLAYED 事件，自动追加触发链（onPlay + 基地能力 + ongoing）
    const derivedEvents: SmashUpEvent[] = [];
    for (const event of afterAffect.events) {
        if (event.type === SU_EVENTS.MINION_PLAYED) {
            const payload = event.payload;
            const triggers = fireMinionPlayedTriggers({
                core: state,
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
        }
    }

    // 对 derived events 递归执行 trigger 后处理（onPlay 产生的 MINION_DESTROYED 等需要触发 onDestroy 链）
    let finalDerived = derivedEvents;
    if (derivedEvents.length > 0) {
        const afterDerivedDestroy = processDestroyTriggers(derivedEvents, ms, pid, random, now);
        if (afterDerivedDestroy.matchState) ms = afterDerivedDestroy.matchState;
        const afterDerivedMove = processMoveTriggers(afterDerivedDestroy.events, ms, pid, random, now);
        if (afterDerivedMove.matchState) ms = afterDerivedMove.matchState;
        const afterDerivedAffect = processAffectTriggers(afterDerivedMove.events, ms, pid, random, now);
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
