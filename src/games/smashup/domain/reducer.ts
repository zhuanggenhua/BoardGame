/**
 * 大杀四方 (Smash Up) - 命令执行与事件归约
 *
 * execute: 命令 → 事件列表
 * reduce: 事件 → 新状态（确定性）
 */

import type { MatchState, RandomFn } from '../../../engine/types';
import type {
    SmashUpCommand,
    SmashUpCore,
    SmashUpEvent,
    MinionPlayedEvent,
    ActionPlayedEvent,
    CardsDiscardedEvent,
    FactionSelectedEvent,
    AllFactionsSelectedEvent,
    MinionDestroyedEvent,
    MinionMovedEvent,
    MinionReturnedEvent,
    OngoingAttachedEvent,
    TalentUsedEvent,
    CardInstance,
    BaseInPlay,
    PlayerState,
} from './types';
import type { PlayerId } from '../../../engine/types';
import { SU_COMMANDS, SU_EVENTS, STARTING_HAND_SIZE } from './types';
import { getMinionDef, getCardDef, getBaseDefIdsForFactions } from '../data/cards';
import type { ActionCardDef } from './types';
import { buildDeck, drawCards } from './utils';
import { autoMulligan } from '../../../engine/primitives/mulligan';
import { resolveOnPlay, resolveTalent, resolveOnDestroy } from './abilityRegistry';
import type { AbilityContext } from './abilityRegistry';
import { triggerAllBaseAbilities, triggerBaseAbility, triggerExtendedBaseAbility } from './baseAbilities';
import { fireTriggers, isMinionProtected } from './ongoingEffects';
import { reduce } from './reduce';

// ============================================================================
// execute：命令 → 事件
// ============================================================================

export function execute(
    state: MatchState<SmashUpCore>,
    command: SmashUpCommand,
    random: RandomFn
): SmashUpEvent[] {
    const now = typeof command.timestamp === 'number' ? command.timestamp : 0;
    const core = state.core;

    // 系统命令（SYS_ 前缀）由引擎层处理，领域层不生成事件
    if ((command as { type: string }).type.startsWith('SYS_')) {
        return [];
    }

    const { events, updatedState } = executeCommand(state, command, random, now);
    
    // 如果能力修改了 matchState（如 queueInteraction 创建了 Interaction），
    // 通过引用赋值将 sys 更新传递给 pipeline
    if (updatedState) {
        state.sys = updatedState.sys;
    }
    
    // 后处理：onDestroy 触发 → onMove 触发
    const afterDestroy = processDestroyTriggers(events, state, command.playerId, random, now);
    return processMoveTriggers(afterDestroy, state, command.playerId, random, now);
}

/** 内部命令执行（不含后处理） */
function executeCommand(
    state: MatchState<SmashUpCore>,
    command: SmashUpCommand,
    random: RandomFn,
    now: number
): { events: SmashUpEvent[]; updatedState?: MatchState<SmashUpCore> } {
    // 防御性初始化：确保 sys.interaction 存在（测试环境可能未初始化）
    if (!state.sys.interaction) {
        state = { ...state, sys: { ...state.sys, interaction: { queue: [] } } };
    }
    const core = state.core;

    switch (command.type) {
        case SU_COMMANDS.PLAY_MINION: {
            const player = core.players[command.playerId];
            const card = player.hand.find(c => c.uid === command.payload.cardUid)!;
            const minionDef = getMinionDef(card.defId);
            const baseIndex = command.payload.baseIndex;
            const events: SmashUpEvent[] = [];
            let updatedState: MatchState<SmashUpCore> | undefined;

            const playedEvt: MinionPlayedEvent = {
                type: SU_EVENTS.MINION_PLAYED,
                payload: {
                    playerId: command.playerId,
                    cardUid: card.uid,
                    defId: card.defId,
                    baseIndex,
                    power: minionDef?.power ?? 0,
                },
                sourceCommandType: command.type,
                timestamp: now,
            };
            events.push(playedEvt);

            // onPlay 能力触发（通过注册表）
            const executor = resolveOnPlay(card.defId);
            if (executor) {
                const ctx: AbilityContext = {
                    state: core,
                    matchState: state,
                    playerId: command.playerId,
                    cardUid: card.uid,
                    defId: card.defId,
                    baseIndex,
                    random,
                    now,
                };
                const result = executor(ctx);
                events.push(...result.events);
                if (result.matchState) {
                    updatedState = result.matchState;
                }
            }

            // 基地能力触发：onMinionPlayed（如鬼屋：弃一张牌）
            const currentMS = updatedState ?? state;
            const baseAbilityResult = triggerAllBaseAbilities(
                'onMinionPlayed', core, command.playerId, now,
                {
                    baseIndex,
                    minionUid: card.uid,
                    minionDefId: card.defId,
                    minionPower: minionDef?.power ?? 0,
                },
                currentMS,
            );
            events.push(...baseAbilityResult.events);
            if (baseAbilityResult.matchState) {
                updatedState = baseAbilityResult.matchState;
            }

            // ongoing 触发：onMinionPlayed（如火焰陷阱消灭入场随从）
            const coreAfterPlayed = reduce(core, playedEvt);
            const ongoingTriggerEvents = fireTriggers(coreAfterPlayed, 'onMinionPlayed', {
                state: coreAfterPlayed,
                matchState: updatedState ?? state,
                playerId: command.playerId,
                baseIndex,
                triggerMinionUid: card.uid,
                triggerMinionDefId: card.defId,
                random,
                now,
            });
            events.push(...ongoingTriggerEvents);

            return updatedState ? { events, updatedState } : { events };
        }

        case SU_COMMANDS.PLAY_ACTION: {
            const player = core.players[command.playerId];
            const card = player.hand.find(c => c.uid === command.payload.cardUid)!;
            const def = getCardDef(card.defId) as ActionCardDef | undefined;
            const events: SmashUpEvent[] = [];
            let updatedState: MatchState<SmashUpCore> | undefined;

            const event: ActionPlayedEvent = {
                type: SU_EVENTS.ACTION_PLAYED,
                payload: {
                    playerId: command.playerId,
                    cardUid: card.uid,
                    defId: card.defId,
                },
                sourceCommandType: command.type,
                timestamp: now,
            };
            events.push(event);

            if (def?.subtype === 'ongoing') {
                // 持续行动卡：附着到目标
                const targetBase = command.payload.targetBaseIndex ?? 0;
                const attachEvt: OngoingAttachedEvent = {
                    type: SU_EVENTS.ONGOING_ATTACHED,
                    payload: {
                        cardUid: card.uid,
                        defId: card.defId,
                        ownerId: command.playerId,
                        targetType: command.payload.targetMinionUid ? 'minion' : 'base',
                        targetBaseIndex: targetBase,
                        targetMinionUid: command.payload.targetMinionUid,
                    },
                    timestamp: now,
                };
                events.push(attachEvt);
                // ongoing 卡也可以有 onPlay 能力（如 block_the_path 需要选择派系）
                const ongoingExecutor = resolveOnPlay(card.defId);
                if (ongoingExecutor) {
                    const ctx: AbilityContext = {
                        state: core,
                        matchState: state,
                        playerId: command.playerId,
                        cardUid: card.uid,
                        defId: card.defId,
                        baseIndex: targetBase,
                        targetMinionUid: command.payload.targetMinionUid,
                        random,
                        now,
                    };
                    const result = ongoingExecutor(ctx);
                    events.push(...result.events);
                    if (result.matchState) {
                        updatedState = result.matchState;
                    }
                }
            } else {
                // standard / special 行动卡：执行效果
                const executor = resolveOnPlay(card.defId);
                if (executor) {
                    const ctx: AbilityContext = {
                        state: core,
                        matchState: state,
                        playerId: command.playerId,
                        cardUid: card.uid,
                        defId: card.defId,
                        baseIndex: command.payload.targetBaseIndex ?? 0,
                        targetMinionUid: command.payload.targetMinionUid,
                        random,
                        now,
                    };
                    const result = executor(ctx);
                    events.push(...result.events);
                    if (result.matchState) {
                        updatedState = result.matchState;
                    }
                }
            }

            // 基地能力触发：onActionPlayed（如工坊：额外打出一张战术）
            const targetBaseIdx = command.payload.targetBaseIndex;
            if (targetBaseIdx !== undefined) {
                const base = core.bases[targetBaseIdx];
                if (base) {
                    const currentActionMS = updatedState ?? state;
                    const baseCtx = {
                        state: core,
                        matchState: currentActionMS,
                        baseIndex: targetBaseIdx,
                        baseDefId: base.defId,
                        playerId: command.playerId,
                        actionTargetBaseIndex: targetBaseIdx,
                        actionTargetMinionUid: command.payload.targetMinionUid,
                        now,
                    };
                    const bResult = triggerBaseAbility(base.defId, 'onActionPlayed', baseCtx);
                    events.push(...bResult.events);
                    if (bResult.matchState) {
                        updatedState = bResult.matchState;
                    }
                }
            }

            return updatedState ? { events, updatedState } : { events };
        }

        case SU_COMMANDS.DISCARD_TO_LIMIT: {
            const event: CardsDiscardedEvent = {
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: {
                    playerId: command.playerId,
                    cardUids: command.payload.cardUids,
                },
                sourceCommandType: command.type,
                timestamp: now,
            };
            return { events: [event] };
        }

        case SU_COMMANDS.SELECT_FACTION: {
            const { factionId } = command.payload;
            const events: SmashUpEvent[] = [];
            const selectedEvt: FactionSelectedEvent = {
                type: SU_EVENTS.FACTION_SELECTED,
                payload: { playerId: command.playerId, factionId },
                sourceCommandType: command.type,
                timestamp: now,
            };
            events.push(selectedEvt);

            // 检查选秀是否完成
            const selection = core.factionSelection!;
            const newTakenCount = selection.takenFactions.length + 1;
            const totalRequired = core.turnOrder.length * 2;

            if (newTakenCount >= totalRequired) {
                // 预测更新后的选择
                const tempSelections = { ...selection.playerSelections };
                tempSelections[command.playerId] = [
                    ...(tempSelections[command.playerId] || []),
                    factionId,
                ];

                const readiedPlayers: AllFactionsSelectedEvent['payload']['readiedPlayers'] = {};
                let nextUid = core.nextUid;
                const mulliganPlayers: PlayerId[] = [];

                const selectedFactions = Object.values(tempSelections).flatMap((items) => items);
                const basePool = getBaseDefIdsForFactions(selectedFactions);
                const shuffledBasePool = random.shuffle(basePool);
                const baseCount = core.turnOrder.length + 1;
                const activeBases: BaseInPlay[] = shuffledBasePool.slice(0, baseCount).map(defId => ({
                    defId,
                    minions: [],
                    ongoingActions: [],
                }));
                const baseDeck = shuffledBasePool.slice(baseCount);

                for (const pid of core.turnOrder) {
                    const factions = tempSelections[pid];
                    if (factions && factions.length === 2) {
                        const { deck, nextUid: afterDeckUid } = buildDeck(
                            [factions[0], factions[1]],
                            pid,
                            nextUid,
                            random
                        );
                        nextUid = afterDeckUid;

                        const drawResult = drawCards(
                            {
                                ...core.players[pid],
                                deck,
                                hand: [],
                                discard: [],
                            } as PlayerState,
                            STARTING_HAND_SIZE,
                            random
                        );

                        // 重抽检查：若手牌无随从则自动重抽一次（规则：若无随从可重抽一次，必须保留第二次）
                        const mulliganResult = autoMulligan<CardInstance>(
                            drawResult.hand,
                            drawResult.deck,
                            (h) => !h.some(c => c.type === 'minion'),
                            STARTING_HAND_SIZE,
                            random.shuffle,
                        );

                        if (mulliganResult.mulliganCount > 0) {
                            mulliganPlayers.push(pid);
                        }

                        readiedPlayers[pid] = {
                            deck: mulliganResult.deck,
                            hand: mulliganResult.hand,
                        };
                    }
                }

                const allSelectedEvt: AllFactionsSelectedEvent = {
                    type: SU_EVENTS.ALL_FACTIONS_SELECTED,
                    payload: {
                        readiedPlayers,
                        nextUid,
                        bases: activeBases,
                        baseDeck,
                        ...(mulliganPlayers.length > 0 ? { mulliganPlayers } : {}),
                    },
                    timestamp: now,
                };
                events.push(allSelectedEvt);
            }

            return { events };
        }

        case SU_COMMANDS.USE_TALENT: {
            const { minionUid, baseIndex } = command.payload;
            const base = core.bases[baseIndex];
            const minion = base?.minions.find(m => m.uid === minionUid);
            if (!minion) return { events: [] };

            const events: SmashUpEvent[] = [];
            const talentEvt: TalentUsedEvent = {
                type: SU_EVENTS.TALENT_USED,
                payload: {
                    playerId: command.playerId,
                    minionUid,
                    defId: minion.defId,
                    baseIndex,
                },
                sourceCommandType: command.type,
                timestamp: now,
            };
            events.push(talentEvt);

            // 执行天赋能力
            const executor = resolveTalent(minion.defId);
            if (executor) {
                const ctx: AbilityContext = {
                    state: core,
                    matchState: state,
                    playerId: command.playerId,
                    cardUid: minionUid,
                    defId: minion.defId,
                    baseIndex,
                    random,
                    now,
                };
                const result = executor(ctx);
                events.push(...result.events);
                if (result.matchState) {
                    return { events, updatedState: result.matchState };
                }
            }

            return { events };
        }

        case SU_COMMANDS.DISMISS_REVEAL: {
            return { events: [{
                type: SU_EVENTS.REVEAL_DISMISSED,
                payload: {},
                sourceCommandType: command.type,
                timestamp: now,
            }] };
        }

        default:
            // RESPONSE_PASS 由引擎 ResponseWindowSystem.beforeCommand 处理，领域层不生成事件
            return { events: [] };
    }
}

// ============================================================================
// onDestroy 后处理：扫描事件中的 MINION_DESTROYED，触发 onDestroy 能力和基地扩展时机
// ============================================================================

export function filterProtectedDestroyEvents(
    events: SmashUpEvent[],
    core: SmashUpCore,
    sourcePlayerId: PlayerId
): SmashUpEvent[] {
    return events.filter(e => {
        if (e.type !== SU_EVENTS.MINION_DESTROYED) return true;
        const de = e as MinionDestroyedEvent;
        const { minionUid, fromBaseIndex } = de.payload;
        const base = core.bases[fromBaseIndex];
        const minion = base?.minions.find(m => m.uid === minionUid);
        if (!minion) return true; // 找不到随从，不过滤
        // 检查是否受保护
        return !isMinionProtected(core, minion, fromBaseIndex, sourcePlayerId, 'destroy');
    });
}

export function processDestroyTriggers(
    events: SmashUpEvent[],
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    random: RandomFn,
    now: number
): SmashUpEvent[] {
    const core = state.core;
    // 保护检查：过滤掉受保护的随从的消灭事件
    const filteredEvents = filterProtectedDestroyEvents(events, core, playerId);

    const destroyEvents = filteredEvents.filter(e => e.type === SU_EVENTS.MINION_DESTROYED) as MinionDestroyedEvent[];
    if (destroyEvents.length === 0) return filteredEvents;

    const extraEvents: SmashUpEvent[] = [];
    for (const de of destroyEvents) {
        const { minionUid, minionDefId, fromBaseIndex, ownerId } = de.payload;
        const base = core.bases[fromBaseIndex];
        const minion = base?.minions.find(m => m.uid === minionUid);
        const destroyerId = minion?.controller ?? ownerId;
        const localEvents: SmashUpEvent[] = [];

        // 1. 触发随从自身的 onDestroy 能力
        const executor = resolveOnDestroy(minionDefId);
        if (executor) {
            // 查找被消灭随从在基地上的信息（消灭前的状态）
            const ctx: AbilityContext = {
                state: core,
                matchState: state,
                playerId: destroyerId,
                cardUid: minionUid,
                defId: minionDefId,
                baseIndex: fromBaseIndex,
                random,
                now,
            };
            const result = executor(ctx);
            localEvents.push(...result.events);
        }

        // 2. 触发基地扩展时机 onMinionDestroyed
        if (base) {
            const baseCtx = {
                state: core,
                baseIndex: fromBaseIndex,
                baseDefId: base.defId,
                playerId: ownerId,
                minionUid,
                minionDefId,
                controllerId: minion?.controller ?? ownerId,
                destroyerId,
                now,
            };
            const baseResult = triggerExtendedBaseAbility(base.defId, 'onMinionDestroyed', baseCtx);
            localEvents.push(...baseResult.events);
        }

        // 3. 触发 ongoing 拦截器 onMinionDestroyed（如逃生舱回手牌）
        const ongoingDestroyEvents = fireTriggers(core, 'onMinionDestroyed', {
            state: core,
            matchState: state,
            playerId: ownerId,
            baseIndex: fromBaseIndex,
            triggerMinionUid: minionUid,
            triggerMinionDefId: minionDefId,
            random,
            now,
        });
        localEvents.push(...ongoingDestroyEvents);

        extraEvents.push(...filterProtectedDestroyEvents(localEvents, core, destroyerId));
    }

    const returnedMinionUids = new Set(
        extraEvents
            .filter(e => e.type === SU_EVENTS.MINION_RETURNED)
            .map(e => (e as MinionReturnedEvent).payload.minionUid)
    );

    const cleanedEvents = returnedMinionUids.size === 0
        ? filteredEvents
        : filteredEvents.filter(e => {
            if (e.type !== SU_EVENTS.MINION_DESTROYED) return true;
            const { minionUid } = (e as MinionDestroyedEvent).payload;
            return !returnedMinionUids.has(minionUid);
        });

    return [...cleanedEvents, ...extraEvents];
}

// ============================================================================
// onMove 后处理：扫描 MINION_MOVED 事件，触发 onMinionMoved 拦截器
// ============================================================================

/** 过滤受 move 保护的随从的移动事件 */
export function filterProtectedMoveEvents(
    events: SmashUpEvent[],
    core: SmashUpCore,
    sourcePlayerId: PlayerId
): SmashUpEvent[] {
    return events.filter(e => {
        if (e.type !== SU_EVENTS.MINION_MOVED) return true;
        const me = e as MinionMovedEvent;
        const { minionUid, fromBaseIndex } = me.payload;
        const base = core.bases[fromBaseIndex];
        const minion = base?.minions.find(m => m.uid === minionUid);
        if (!minion) return true;
        return !isMinionProtected(core, minion, fromBaseIndex, sourcePlayerId, 'move');
    });
}

/** 后处理：触发 onMinionMoved 拦截器 */
export function processMoveTriggers(
    events: SmashUpEvent[],
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    random: RandomFn,
    now: number
): SmashUpEvent[] {
    const core = state.core;
    // 保护检查：过滤掉受 move 保护的随从的移动事件
    const filteredEvents = filterProtectedMoveEvents(events, core, playerId);

    const moveEvents = filteredEvents.filter(
        e => e.type === SU_EVENTS.MINION_MOVED
    ) as MinionMovedEvent[];
    if (moveEvents.length === 0) return filteredEvents;

    const extraEvents: SmashUpEvent[] = [];
    for (const me of moveEvents) {
        const { minionUid, minionDefId, toBaseIndex } = me.payload;

        // 触发 ongoing 拦截器 onMinionMoved
        const ongoingMoveEvents = fireTriggers(core, 'onMinionMoved', {
            state: core,
            matchState: state,
            playerId,
            baseIndex: toBaseIndex,
            triggerMinionUid: minionUid,
            triggerMinionDefId: minionDefId,
            random,
            now,
        });
        extraEvents.push(...ongoingMoveEvents);

        // 触发基地扩展时机 onMinionMoved（如牧场：首次移动触发额外移动）
        const targetBase = core.bases[toBaseIndex];
        if (targetBase) {
            const baseCtx = {
                state: core,
                matchState: state,
                baseIndex: toBaseIndex,
                baseDefId: targetBase.defId,
                playerId,
                minionUid,
                minionDefId,
                now,
            };
            const baseResult = triggerExtendedBaseAbility(targetBase.defId, 'onMinionMoved', baseCtx);
            extraEvents.push(...baseResult.events);
            if (baseResult.matchState) {
                state.sys = baseResult.matchState.sys;
            }
        }
    }

    return [...filteredEvents, ...extraEvents];
}

// reduce 函数已提取到 ./reduce.ts
export { reduce } from './reduce';
