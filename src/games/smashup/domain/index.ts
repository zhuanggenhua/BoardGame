/**
 * 大杀四方 (Smash Up) - 领域内核组装
 *
 * 职责：setup 初始化、FlowSystem 钩子、playerView、isGameOver
 */

import type { DomainCore, GameEvent, GameOverResult, PlayerId, RandomFn } from '../../../engine/types';
import type { FlowHooks } from '../../../engine/systems/FlowSystem';
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
    BaseReplacedEvent,
    DeckReshuffledEvent,
} from './types';
import {
    PHASE_ORDER,
    SU_EVENTS,
    DRAW_PER_TURN,
    HAND_LIMIT,
    VP_TO_WIN,
    getCurrentPlayerId,
} from './types';
import { getEffectivePower, getTotalEffectivePowerOnBase } from './ongoingModifiers';
import { validate } from './commands';
import { execute, reduce } from './reducer';
import { getAllBaseDefIds, getBaseDef } from '../data/cards';
import { drawCards } from './utils';
import { countMadnessCards, madnessVpPenalty } from './abilityHelpers';
import { triggerAllBaseAbilities, triggerBaseAbility } from './baseAbilities';
import { openMeFirstWindow, setPromptContinuation, buildBaseTargetOptions } from './abilityHelpers';
import type { PhaseExitResult } from '../../../engine/systems/FlowSystem';
import { registerPromptContinuation } from './promptContinuation';

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
    now: number
): { events: SmashUpEvent[]; newBaseDeck: string[] } {
    const events: SmashUpEvent[] = [];
    const base = core.bases[baseIndex];
    const baseDef = getBaseDef(base.defId)!;

    // 触发 beforeScoring 基地能力
    const beforeCtx = {
        state: core,
        baseIndex,
        baseDefId: base.defId,
        playerId: pid,
        now,
    };
    events.push(...triggerBaseAbility(base.defId, 'beforeScoring', beforeCtx));

    // 计算排名（使用有效力量，含持续修正）
    const playerPowers = new Map<PlayerId, number>();
    for (const m of base.minions) {
        const prev = playerPowers.get(m.controller) ?? 0;
        playerPowers.set(m.controller, prev + getEffectivePower(core, m, baseIndex));
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

    const scoreEvt: BaseScoredEvent = {
        type: SU_EVENTS.BASE_SCORED,
        payload: { baseIndex, baseDefId: base.defId, rankings },
        timestamp: now,
    };
    events.push(scoreEvt);

    // 触发 afterScoring 基地能力
    const afterCtx = {
        state: core,
        baseIndex,
        baseDefId: base.defId,
        playerId: pid,
        rankings,
        now,
    };
    events.push(...triggerBaseAbility(base.defId, 'afterScoring', afterCtx));

    // 替换基地
    let newBaseDeck = baseDeck;
    if (newBaseDeck.length > 0) {
        const replaceEvt: BaseReplacedEvent = {
            type: SU_EVENTS.BASE_REPLACED,
            payload: {
                baseIndex,
                oldBaseDefId: base.defId,
                newBaseDefId: newBaseDeck[0],
            },
            timestamp: now,
        };
        events.push(replaceEvt);
        newBaseDeck = newBaseDeck.slice(1);
    }

    return { events, newBaseDeck };
}

/** 注册多基地计分的 Prompt 继续函数 */
export function registerMultiBaseScoringContinuation(): void {
    registerPromptContinuation('multi_base_scoring', (ctx) => {
        const { baseIndex } = ctx.selectedValue as { baseIndex: number };
        const { events } = scoreOneBase(ctx.state, baseIndex, ctx.state.baseDeck, ctx.playerId, ctx.now);
        return events;
    });
}

// ============================================================================
// Setup
// ============================================================================

function setup(playerIds: PlayerId[], random: RandomFn): SmashUpCore {
    let nextUid = 1;

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
            factions: [] as any,
        };
        playerSelections[pid] = [];
    }

    // 翻开 玩家数+1 张基地
    const allBaseIds = random.shuffle(getAllBaseDefIds());
    const baseCount = playerIds.length + 1;
    const activeBases: BaseInPlay[] = allBaseIds.slice(0, baseCount).map(defId => ({
        defId,
        minions: [],
        ongoingActions: [],
    }));
    const baseDeck = allBaseIds.slice(baseCount);

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

    onPhaseExit({ state, from }): GameEvent[] | PhaseExitResult {
        const core = state.core;
        const pid = getCurrentPlayerId(core);
        const now = Date.now();

        if (from === 'endTurn') {
            // 切换到下一个玩家
            const nextIndex = (core.currentPlayerIndex + 1) % core.turnOrder.length;
            const evt: TurnEndedEvent = {
                type: SU_EVENTS.TURN_ENDED,
                payload: { playerId: pid, nextPlayerIndex: nextIndex },
                timestamp: now,
            };
            return [evt];
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
                if (totalPower >= baseDef.breakpoint) {
                    eligibleBases.push({ baseIndex: i, defId: base.defId, totalPower });
                }
            }

            // 无基地达标 → 正常推进
            if (eligibleBases.length === 0) {
                return events;
            }

            // Property 14: 2+ 基地达标 → 通过 PromptSystem 让当前玩家选择计分顺序
            if (eligibleBases.length >= 2 && !core.pendingPromptContinuation) {
                const candidates = eligibleBases.map(eb => {
                    const baseDef = getBaseDef(eb.defId);
                    return {
                        baseIndex: eb.baseIndex,
                        label: `${baseDef?.name ?? `基地 ${eb.baseIndex + 1}`} (力量 ${eb.totalPower}/${baseDef?.breakpoint ?? '?'})`,
                    };
                });

                const promptEvents: GameEvent[] = [
                    setPromptContinuation(
                        {
                            abilityId: 'multi_base_scoring',
                            playerId: pid,
                            data: {
                                promptConfig: {
                                    title: '选择先记分的基地',
                                    options: buildBaseTargetOptions(candidates),
                                },
                            },
                        },
                        now
                    ),
                ];

                // halt=true：不切换阶段，等待 Prompt 解决后再继续
                return { events: promptEvents, halt: true } as PhaseExitResult;
            }

            // 1 个基地达标（或 Prompt 已解决后的后续循环）→ 直接记分
            // Property 15: 循环检查所有达到临界点的基地
            let remainingBaseIndices = core.bases.map((_, index) => index);
            let currentBaseDeck = core.baseDeck;

            const maxIterations = remainingBaseIndices.length;
            for (let iter = 0; iter < maxIterations; iter++) {
                let foundIndex: number | null = null;
                for (const baseIndex of remainingBaseIndices) {
                    const base = core.bases[baseIndex];
                    const baseDef = getBaseDef(base.defId);
                    if (!baseDef) continue;
                    const totalPower = getTotalEffectivePowerOnBase(core, base, baseIndex);
                    if (totalPower >= baseDef.breakpoint) {
                        foundIndex = baseIndex;
                        break;
                    }
                }
                if (foundIndex === null) break;

                const result = scoreOneBase(core, foundIndex, currentBaseDeck, pid, now);
                events.push(...result.events);
                currentBaseDeck = result.newBaseDeck;
                remainingBaseIndices = remainingBaseIndices.filter((index) => index !== foundIndex);
            }

            return events;
        }

        return [];
    },

    onPhaseEnter({ state, from, to, random }): GameEvent[] {
        const core = state.core;
        const pid = getCurrentPlayerId(core);
        const now = Date.now();
        const events: GameEvent[] = [];

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

            // 触发基地 onTurnStart 能力（如更衣室：有随从则抽牌）
            const baseEvents = triggerAllBaseAbilities('onTurnStart', core, nextPlayerId, now);
            events.push(...baseEvents);
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
                if (totalPower >= baseDef.breakpoint) {
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
            // Property 14: 有待处理的 Prompt 时不自动推进（等待玩家选择计分顺序）
            if (state.sys.prompt.current || core.pendingPromptContinuation) {
                return undefined;
            }
            // 响应窗口已关闭且无 Prompt，自动推进
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
    // 平局：继续游戏（规则：平局继续直到打破）
    return undefined;
}

function getScores(state: SmashUpCore): Record<PlayerId, number> {
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
// 领域内核导出
// ============================================================================

export const SmashUpDomain: DomainCore<SmashUpCore, SmashUpCommand, SmashUpEvent> = {
    gameId: 'smashup',
    setup,
    validate,
    execute,
    reduce,
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
