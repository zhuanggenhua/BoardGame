/**
 * 大杀四方 (Smash Up) - 命令执行与事件归约
 *
 * execute: 命令 → 事件列表
 * reduce: 事件 → 新状态（确定性）
 * 
 * ## execute 层职责约束（Critical）
 * 
 * execute 函数的唯一职责：命令 → 基础事件。
 * 
 * ✅ 允许：
 * - 生成基础事件（MINION_PLAYED / ACTION_PLAYED / CARDS_DRAWN 等）
 * - 读取当前状态进行条件判断
 * - 调用纯函数辅助（getCardDef / findUnit 等）
 * 
 * ❌ 禁止：
 * - 调用触发链函数（fireMinionPlayedTriggers / triggerOnPlay 等）
 * - 调用 reduce 模拟状态推演
 * - 直接修改 state.sys
 * - 创建交互（应在能力执行器中通过 queueInteraction 创建）
 * 
 * 所有触发链（onPlay / onMinionPlayed / ongoing triggers）必须在
 * postProcessSystemEvents 中统一处理，避免重复触发。
 * 
 * 详见：docs/ai-rules/engine-systems.md「领域层职责边界」节
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
    OngoingDetachedEvent,
    TalentUsedEvent,
    CardInstance,
    BaseInPlay,
    PlayerState,
    PowerCounterAddedEvent,
    PowerCounterRemovedEvent,
    TempPowerAddedEvent,
    CardToDeckBottomEvent,
} from './types';
import type { PlayerId } from '../../../engine/types';
import { SU_COMMANDS, SU_EVENTS, STARTING_HAND_SIZE } from './types';
import { getMinionDef, getCardDef, getBaseDefIdsForFactions } from '../data/cards';
import type { ActionCardDef } from './types';
import { buildDeck, drawCards } from './utils';
import { autoMulligan } from '../../../engine/primitives/mulligan';
import { resolveOnPlay, resolveSpecial, resolveTalent, resolveOnDestroy } from './abilityRegistry';
import type { AbilityContext } from './abilityRegistry';
import { triggerBaseAbility, triggerExtendedBaseAbility } from './baseAbilities';
import { fireTriggers, isMinionProtected, getConsumableProtectionSource } from './ongoingEffects';
import { canPlayFromDiscard } from './discardPlayability';

// ============================================================================
// execute：命令 → 事件
// ============================================================================

export function execute(
    state: MatchState<SmashUpCore>,
    command: SmashUpCommand,
    random: RandomFn
): SmashUpEvent[] {
    const now = typeof command.timestamp === 'number' ? command.timestamp : 0;
    const _core = state.core;

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
    
    // 后处理：onDestroy 触发 → onMove 触发（循环直到稳定）→ onAffected 触发
    const afterDestroyMove = processDestroyMoveCycle(events, state, command.playerId, random, now);
    
    if (afterDestroyMove.matchState) {
        state.sys = afterDestroyMove.matchState.sys;
    }
    // 返回手牌保护过滤（deep_roots / entangled / ghost_incorporeal 等）
    const afterReturn = filterProtectedReturnEvents(afterDestroyMove.events, state.core, command.playerId);
    // 放入牌库底保护过滤（bear_cavalry_superiority / ghost_incorporeal 等）
    const afterDeckBottom = filterProtectedDeckBottomEvents(afterReturn, state.core, command.playerId);
    const afterAffect = processAffectTriggers(afterDeckBottom, state, command.playerId, random, now);
    if (afterAffect.matchState) {
        state.sys = afterAffect.matchState.sys;
    }
    
    return afterAffect.events;
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
            const fromDiscard = command.payload.fromDiscard;
            const card = fromDiscard
                ? player.discard.find(c => c.uid === command.payload.cardUid)!
                : player.hand.find(c => c.uid === command.payload.cardUid)!;
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
                    baseDefId: core.bases[baseIndex].defId,
                    power: minionDef?.power ?? 0,
                    fromDiscard: fromDiscard || undefined,
                    ...(fromDiscard ? (() => {
                        const info = canPlayFromDiscard(core, command.playerId, card.uid, baseIndex);
                        return info ? { discardPlaySourceId: info.sourceId, consumesNormalLimit: info.consumesNormalLimit } : {};
                    })() : {}),
                    // Me First! 窗口中打出 beforeScoringPlayable 随从不消耗正常额度
                    ...(state.sys.responseWindow?.current?.windowType === 'meFirst' && minionDef?.beforeScoringPlayable
                        ? { consumesNormalLimit: false }
                        : {}),
                },
                sourceCommandType: command.type,
                timestamp: now,
            };
            events.push(playedEvt);

            // Me First! 窗口中打出 beforeScoringPlayable 随从时，记录 specialLimitGroup 使用
            if (state.sys.responseWindow?.current?.windowType === 'meFirst' && minionDef?.beforeScoringPlayable) {
                const limitGroup = minionDef.specialLimitGroup;
                if (limitGroup) {
                    events.push({
                        type: SU_EVENTS.SPECIAL_LIMIT_USED,
                        payload: {
                            playerId: command.playerId,
                            baseIndex,
                            limitGroup,
                            abilityDefId: card.defId,
                        },
                        timestamp: now,
                    } as SmashUpEvent);
                }
            }

            // 触发链由 postProcessSystemEvents 统一处理，避免重复触发
            // （postProcessSystemEvents 会检测所有 MINION_PLAYED 事件并调用 fireMinionPlayedTriggers）

            return { events };
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
                const isSpecial = def?.subtype === 'special';
                const executor = isSpecial ? resolveSpecial(card.defId) : resolveOnPlay(card.defId);
                // special 卡不走 onPlay，走 resolveSpecial；如果没有 special 注册则回退到 onPlay
                const finalExecutor = executor ?? (isSpecial ? resolveOnPlay(card.defId) : undefined);
                if (finalExecutor) {
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
                    const result = finalExecutor(ctx);
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
            const { minionUid, ongoingCardUid, baseIndex } = command.payload;
            const base = core.bases[baseIndex];
            const events: SmashUpEvent[] = [];

            // ongoing 行动卡天赋（基地上或随从附着）
            if (ongoingCardUid) {
                let ongoing = base?.ongoingActions.find(o => o.uid === ongoingCardUid);
                if (!ongoing) {
                    for (const m of (base?.minions ?? [])) {
                        const aa = m.attachedActions.find(a => a.uid === ongoingCardUid);
                        if (aa) { ongoing = aa; break; }
                    }
                }
                if (!ongoing) return { events: [] };

                const talentEvt: TalentUsedEvent = {
                    type: SU_EVENTS.TALENT_USED,
                    payload: {
                        playerId: command.playerId,
                        ongoingCardUid,
                        defId: ongoing.defId,
                        baseIndex,
                    },
                    sourceCommandType: command.type,
                    timestamp: now,
                };
                events.push(talentEvt);

                // 执行天赋能力
                const executor = resolveTalent(ongoing.defId);
                if (executor) {
                    const ctx: AbilityContext = {
                        state: core,
                        matchState: state,
                        playerId: command.playerId,
                        cardUid: ongoingCardUid,
                        defId: ongoing.defId,
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

            // 随从天赋
            const minion = base?.minions.find(m => m.uid === minionUid);
            if (!minion) return { events: [] };

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
                    cardUid: minionUid!,
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

        case SU_COMMANDS.ACTIVATE_SPECIAL: {
            const { minionUid: spUid, baseIndex: spIdx } = command.payload;
            const spBase = core.bases[spIdx];
            const spMinion = spBase?.minions.find(m => m.uid === spUid);
            if (!spMinion) return { events: [] };

            const executor = resolveSpecial(spMinion.defId);
            if (!executor) return { events: [] };

            const ctx: AbilityContext = {
                state: core,
                matchState: state,
                playerId: command.playerId,
                cardUid: spUid,
                defId: spMinion.defId,
                baseIndex: spIdx,
                random,
                now,
            };
            const result = executor(ctx);
            if (result.matchState) {
                return { events: result.events, updatedState: result.matchState };
            }
            return { events: result.events };
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
    const result: SmashUpEvent[] = [];
    for (const e of events) {
        if (e.type !== SU_EVENTS.MINION_DESTROYED) {
            result.push(e);
            continue;
        }
        const de = e as MinionDestroyedEvent;
        const { minionUid, fromBaseIndex } = de.payload;
        const base = core.bases[fromBaseIndex];
        const minion = base?.minions.find(m => m.uid === minionUid);
        if (!minion) { result.push(e); continue; }
        // 优先使用事件中的 destroyerId（如暗杀卡的 ownerId），回退到传入的 sourcePlayerId
        const effectiveSource = de.payload.destroyerId ?? sourcePlayerId;
        // 检查 destroy 保护和 action 保护
        if (isMinionProtected(core, minion, fromBaseIndex, effectiveSource, 'destroy')) continue;
        // 检查 'action' 和 'affect' 两种广义保护类型（tooth_and_claw 注册为 'affect'）
        const actionProtected = isMinionProtected(core, minion, fromBaseIndex, effectiveSource, 'action');
        const affectProtected = isMinionProtected(core, minion, fromBaseIndex, effectiveSource, 'affect');
        if (actionProtected || affectProtected) {
            // 消耗型保护：发射自毁事件
            const protType = actionProtected ? 'action' : 'affect';
            const source = getConsumableProtectionSource(core, minion, fromBaseIndex, effectiveSource, protType);
            if (source) {
                result.push({
                    type: SU_EVENTS.ONGOING_DETACHED,
                    payload: { cardUid: source.uid, defId: source.defId, ownerId: source.ownerId, reason: `${source.defId}_self_destruct` },
                    timestamp: e.timestamp,
                } as OngoingDetachedEvent);
            }
            continue;
        }
        result.push(e);
    }
    return result;
}

/** 后处理结果：事件 + 可选的 matchState（触发器可能创建了交互） */
export interface PostProcessResult {
    events: SmashUpEvent[];
    matchState?: MatchState<SmashUpCore>;
}

export function processDestroyTriggers(
    events: SmashUpEvent[],
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    random: RandomFn,
    now: number
): PostProcessResult {
    const core = state.core;
    // 保护检查：过滤掉受保护的随从的消灭事件
    const filteredEvents = filterProtectedDestroyEvents(events, core, playerId);

    // ✅ 去重：同一个 minionUid 只处理一次（防止重复触发 onDestroy）
    const destroyEventsRaw = filteredEvents.filter(e => e.type === SU_EVENTS.MINION_DESTROYED) as MinionDestroyedEvent[];
    const seenUids = new Set<string>();
    const destroyEvents = destroyEventsRaw.filter(e => {
        const uid = e.payload.minionUid;
        if (seenUids.has(uid)) {
            console.log('[processDestroyTriggers] Skipping duplicate destroy event for:', uid);
            return false;
        }
        seenUids.add(uid);
        return true;
    });
    if (destroyEvents.length === 0) return { events: filteredEvents };

    const extraEvents: SmashUpEvent[] = [];
    let ms: MatchState<SmashUpCore> | undefined;
    // 待拯救随从：trigger 创建了交互（玩家选择是否拯救）但未产生 MINION_RETURNED，
    // 需要暂缓 MINION_DESTROYED，等交互解决后再决定消灭或拯救
    const pendingSaveMinionUids = new Set<string>();

    for (const de of destroyEvents) {
        const { minionUid, minionDefId, fromBaseIndex, ownerId: eventOwnerId, destroyerId: eventDestroyerId } = de.payload;
        const base = core.bases[fromBaseIndex];
        const minion = base?.minions.find(m => m.uid === minionUid);
        // ✅ 优先从 state 读取 owner（兜底修复：即使事件中的 ownerId 错了也能修复）
        const ownerId = minion?.owner ?? eventOwnerId;
        const destroyerId = eventDestroyerId ?? minion?.controller ?? ownerId;

        // === Phase 1: 先检查防止消灭触发器（基地能力 + ongoing） ===
        // 在触发 onDestroy 之前，先确认消灭是否会被防止
        const currentMS_save = ms ?? state;
        const interactionCountBefore =
            (currentMS_save.sys.interaction.current ? 1 : 0) + currentMS_save.sys.interaction.queue.length;

        const saveEvents: SmashUpEvent[] = [];

        // 2. 触发基地扩展时机 onMinionDestroyed（如 nine_lives 防止消灭）
        if (base) {
            const baseCtx = {
                state: core,
                matchState: ms ?? state,
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
            saveEvents.push(...baseResult.events);
            if (baseResult.matchState) ms = baseResult.matchState;
        }

        // 3. 触发 ongoing 拦截器 onMinionDestroyed（如雄蜂防止消灭、逃生舱回手牌）
        const ongoingDestroyEvents = fireTriggers(core, 'onMinionDestroyed', {
            state: core,
            matchState: ms ?? state,
            playerId: ownerId,
            baseIndex: fromBaseIndex,
            triggerMinionUid: minionUid,
            triggerMinionDefId: minionDefId,
            reason: de.payload.reason,
            random,
            now,
        });
        saveEvents.push(...ongoingDestroyEvents.events);
        if (ongoingDestroyEvents.matchState) ms = ongoingDestroyEvents.matchState;

        // 检测"待拯救"模式：baseTrigger/ongoing 创建了新交互但未产生 MINION_RETURNED/MINION_MOVED
        // 典型场景：九命之屋创建玩家选择交互，暂缓消灭等待玩家决定
        // 海盗单基地时直接返回 MINION_MOVED 事件，也视为拯救
        const hasReturn = saveEvents.some(e => e.type === SU_EVENTS.MINION_RETURNED);
        const hasMoveAway = saveEvents.some(e =>
            e.type === SU_EVENTS.MINION_MOVED &&
            (e as MinionMovedEvent).payload.minionUid === minionUid
        );
        const hasSaveEvent = hasReturn || hasMoveAway;
        let isPendingSave = false;
        if (!hasSaveEvent && ms) {
            const interactionCountAfter =
                (ms.sys.interaction.current ? 1 : 0) + ms.sys.interaction.queue.length;
            if (interactionCountAfter > interactionCountBefore) {
                // 检查新交互是否为"防止消灭"类交互（白名单）
                // 排除：地窖等"给其他随从加指示物"的交互
                const PREVENT_DESTROY_SOURCE_IDS = [
                    'base_nine_lives_intercept',        // 九命之屋
                    'giant_ant_drone_prevent_destroy',   // 雄蜂防止消灭
                    'pirate_buccaneer_move',             // 海盗：被消灭时移动到其他基地
                ];
                const newInteraction = ms.sys.interaction.current ?? ms.sys.interaction.queue[ms.sys.interaction.queue.length - 1];
                const sourceId = (newInteraction?.data as any)?.sourceId as string | undefined;
                const isPreventDestroy = sourceId ? PREVENT_DESTROY_SOURCE_IDS.includes(sourceId) : false;
                if (isPreventDestroy) {
                    isPendingSave = true;
                    pendingSaveMinionUids.add(minionUid);
                }
            }
        }

        // === Phase 2: 只有确认消灭（无防止/无返回/无移走）时才触发 onDestroy ===
        // 当 isPendingSave 时，Phase 1 的 saveEvents 中包含了所有 onMinionDestroyed 触发器的事件
        // （包括吸血鬼伯爵/投机主义等加指示物事件），这些必须被抑制——
        // 因为消灭尚未确认，等交互解决后再决定是否触发。
        // 只保留 matchState 变更（交互创建），丢弃所有副作用事件。
        //
        // 当 hasSaveEvent 时，随从被拯救（回手牌或移动到其他基地），消灭未发生，
        // 同样需要抑制其他触发器的副作用事件，但保留 MINION_RETURNED/MINION_MOVED 事件本身。
        const localEvents: SmashUpEvent[] = isPendingSave
            ? []
            : hasSaveEvent
                ? saveEvents.filter(e =>
                    e.type === SU_EVENTS.MINION_RETURNED ||
                    (e.type === SU_EVENTS.MINION_MOVED && (e as MinionMovedEvent).payload.minionUid === minionUid)
                )
                : [...saveEvents];
        if (!isPendingSave && !hasSaveEvent) {
            // 1. 触发随从自身的 onDestroy 能力
            const executor = resolveOnDestroy(minionDefId);
            if (executor) {
                const ctx: AbilityContext = {
                    state: core,
                    matchState: ms ?? state,
                    playerId: ownerId,  // ✅ onDestroy 能力属于随从拥有者，不是消灭者
                    cardUid: minionUid,
                    defId: minionDefId,
                    baseIndex: fromBaseIndex,
                    random,
                    now,
                };
                const result = executor(ctx);
                localEvents.push(...result.events);
                if (result.matchState) ms = result.matchState;
            }
        }

        const filteredLocal = filterProtectedDestroyEvents(localEvents, core, destroyerId);
        extraEvents.push(...filteredLocal);
    }

    // 需要抑制的随从 uid：已被 MINION_RETURNED/MINION_MOVED 拯救 + 待交互拯救
    const suppressedMinionUids = new Set(
        extraEvents
            .filter(e => e.type === SU_EVENTS.MINION_RETURNED)
            .map(e => (e as MinionReturnedEvent).payload.minionUid)
    );
    // 被 MINION_MOVED 移走的随从也视为拯救（如海盗单基地自动移动）
    for (const e of extraEvents) {
        if (e.type === SU_EVENTS.MINION_MOVED) {
            suppressedMinionUids.add((e as MinionMovedEvent).payload.minionUid);
        }
    }
    for (const uid of pendingSaveMinionUids) {
        suppressedMinionUids.add(uid);
    }

    const cleanedEvents = suppressedMinionUids.size === 0
        ? filteredEvents
        : filteredEvents.filter(e => {
            if (e.type !== SU_EVENTS.MINION_DESTROYED) return true;
            const { minionUid } = (e as MinionDestroyedEvent).payload;
            return !suppressedMinionUids.has(minionUid);
        });

    return { events: [...cleanedEvents, ...extraEvents], matchState: ms };
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
    const result: SmashUpEvent[] = [];
    for (const e of events) {
        if (e.type !== SU_EVENTS.MINION_MOVED) {
            result.push(e);
            continue;
        }
        const me = e as MinionMovedEvent;
        const { minionUid, fromBaseIndex } = me.payload;
        const base = core.bases[fromBaseIndex];
        const minion = base?.minions.find(m => m.uid === minionUid);
        if (!minion) { result.push(e); continue; }
        if (isMinionProtected(core, minion, fromBaseIndex, sourcePlayerId, 'move')) continue;
        // 检查 'action' 和 'affect' 两种广义保护类型（与 filterProtectedDestroyEvents 对齐）
        const actionProtected = isMinionProtected(core, minion, fromBaseIndex, sourcePlayerId, 'action');
        const affectProtected = isMinionProtected(core, minion, fromBaseIndex, sourcePlayerId, 'affect');
        if (actionProtected || affectProtected) {
            // 消耗型保护：发射自毁事件
            const protType = actionProtected ? 'action' : 'affect';
            const source = getConsumableProtectionSource(core, minion, fromBaseIndex, sourcePlayerId, protType);
            if (source) {
                result.push({
                    type: SU_EVENTS.ONGOING_DETACHED,
                    payload: { cardUid: source.uid, defId: source.defId, ownerId: source.ownerId, reason: `${source.defId}_self_destruct` },
                    timestamp: e.timestamp,
                } as OngoingDetachedEvent);
            }
            continue;
        }
        result.push(e);
    }
    return result;
}

// ============================================================================
// onReturn 保护过滤：扫描 MINION_RETURNED 事件，过滤受保护的随从
// ============================================================================

/**
 * 过滤受保护的随从的返回手牌事件
 *
 * 与 filterProtectedMoveEvents 对齐：
 * - 'move' 保护同时阻止移动和返回手牌（deep_roots / entangled）
 * - 'action' / 'affect' 广义保护也阻止返回手牌（ghost_incorporeal / elder_thing）
 *
 * 注意：tooth_and_claw 通过 interceptor 拦截 MINION_RETURNED（引擎管线层），
 * 此函数处理的是 registerProtection 注册的保护（领域层后处理）。
 */
export function filterProtectedReturnEvents(
    events: SmashUpEvent[],
    core: SmashUpCore,
    sourcePlayerId: PlayerId
): SmashUpEvent[] {
    const result: SmashUpEvent[] = [];
    for (const e of events) {
        if (e.type !== SU_EVENTS.MINION_RETURNED) {
            result.push(e);
            continue;
        }
        const re = e as MinionReturnedEvent;
        const { minionUid, fromBaseIndex } = re.payload;
        const base = core.bases[fromBaseIndex];
        const minion = base?.minions.find(m => m.uid === minionUid);
        if (!minion) { result.push(e); continue; }
        // 'move' 保护同时阻止移动和返回手牌
        if (isMinionProtected(core, minion, fromBaseIndex, sourcePlayerId, 'move')) continue;
        // 检查 'action' 和 'affect' 两种广义保护类型（与 filterProtectedDestroyEvents / filterProtectedMoveEvents 对齐）
        const actionProtected = isMinionProtected(core, minion, fromBaseIndex, sourcePlayerId, 'action');
        const affectProtected = isMinionProtected(core, minion, fromBaseIndex, sourcePlayerId, 'affect');
        if (actionProtected || affectProtected) {
            // 消耗型保护：发射自毁事件
            const protType = actionProtected ? 'action' : 'affect';
            const source = getConsumableProtectionSource(core, minion, fromBaseIndex, sourcePlayerId, protType);
            if (source) {
                result.push({
                    type: SU_EVENTS.ONGOING_DETACHED,
                    payload: { cardUid: source.uid, defId: source.defId, ownerId: source.ownerId, reason: `${source.defId}_self_destruct` },
                    timestamp: e.timestamp,
                } as OngoingDetachedEvent);
            }
            continue;
        }
        result.push(e);
    }
    return result;
}

// ============================================================================
// onDeckBottom 保护过滤：扫描 CARD_TO_DECK_BOTTOM 事件，过滤受保护的随从
// ============================================================================

/**
 * 过滤受保护的随从的放入牌库底事件
 *
 * CARD_TO_DECK_BOTTOM 没有 fromBaseIndex，需要遍历基地查找随从。
 * 保护检查逻辑与 filterProtectedReturnEvents 对齐：
 * - 'move' 保护阻止（bear_cavalry_superiority 描述含"返回牌库"）
 * - 'action' / 'affect' 广义保护也阻止（ghost_incorporeal / elder_thing 等）
 *
 * 注意：tooth_and_claw 通过 interceptor 拦截 CARD_TO_DECK_BOTTOM（引擎管线层），
 * 此函数处理的是 registerProtection 注册的保护（领域层后处理）。
 * 注意：只过滤场上随从的放牌库底事件，不过滤手牌/弃牌堆的卡牌操作。
 */
export function filterProtectedDeckBottomEvents(
    events: SmashUpEvent[],
    core: SmashUpCore,
    sourcePlayerId: PlayerId
): SmashUpEvent[] {
    const result: SmashUpEvent[] = [];
    for (const e of events) {
        if (e.type !== SU_EVENTS.CARD_TO_DECK_BOTTOM) {
            result.push(e);
            continue;
        }
        const dbe = e as CardToDeckBottomEvent;
        const { cardUid, ownerId } = dbe.payload;
        // 在所有基地中查找该随从（CARD_TO_DECK_BOTTOM 没有 fromBaseIndex）
        let fromBaseIndex: number | undefined;
        let minion: import('./types').MinionOnBase | undefined;
        for (let i = 0; i < core.bases.length; i++) {
            const found = core.bases[i].minions.find(m => m.uid === cardUid);
            if (found) {
                fromBaseIndex = i;
                minion = found;
                break;
            }
        }
        // 不在基地上的卡牌（手牌/弃牌堆）不做保护检查
        if (fromBaseIndex === undefined || !minion) { result.push(e); continue; }
        // 自身效果不拦截（如远古之物自己选择放牌库底）
        if (ownerId === sourcePlayerId) { result.push(e); continue; }
        // 'move' 保护阻止放牌库底
        if (isMinionProtected(core, minion, fromBaseIndex, sourcePlayerId, 'move')) continue;
        // 检查 'action' 和 'affect' 两种广义保护类型
        const actionProtected = isMinionProtected(core, minion, fromBaseIndex, sourcePlayerId, 'action');
        const affectProtected = isMinionProtected(core, minion, fromBaseIndex, sourcePlayerId, 'affect');
        if (actionProtected || affectProtected) {
            const protType = actionProtected ? 'action' : 'affect';
            const source = getConsumableProtectionSource(core, minion, fromBaseIndex, sourcePlayerId, protType);
            if (source) {
                result.push({
                    type: SU_EVENTS.ONGOING_DETACHED,
                    payload: { cardUid: source.uid, defId: source.defId, ownerId: source.ownerId, reason: `${source.defId}_self_destruct` },
                    timestamp: e.timestamp,
                } as OngoingDetachedEvent);
            }
            continue;
        }
        result.push(e);
    }
    return result;
}

/** 后处理：触发 onMinionMoved 拦截器 */
export function processMoveTriggers(
    events: SmashUpEvent[],
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    random: RandomFn,
    now: number
): PostProcessResult {
    const core = state.core;
    // 保护检查：过滤掉受 move 保护的随从的移动事件
    const filteredEvents = filterProtectedMoveEvents(events, core, playerId);

    const moveEvents = filteredEvents.filter(
        e => e.type === SU_EVENTS.MINION_MOVED
    ) as MinionMovedEvent[];
    if (moveEvents.length === 0) return { events: filteredEvents };

    const extraEvents: SmashUpEvent[] = [];
    let ms: MatchState<SmashUpCore> | undefined;
    for (const me of moveEvents) {
        const { minionUid, minionDefId, toBaseIndex } = me.payload;

        // 触发 ongoing 拦截器 onMinionMoved
        const ongoingMoveEvents = fireTriggers(core, 'onMinionMoved', {
            state: core,
            matchState: ms ?? state,
            playerId,
            baseIndex: toBaseIndex,
            triggerMinionUid: minionUid,
            triggerMinionDefId: minionDefId,
            random,
            now,
        });
        extraEvents.push(...ongoingMoveEvents.events);
        if (ongoingMoveEvents.matchState) {
            ms = ongoingMoveEvents.matchState;
        }

        // 触发基地扩展时机 onMinionMoved（如牧场：首次移动触发额外移动）
        const targetBase = core.bases[toBaseIndex];
        if (targetBase) {
            const baseCtx = {
                state: core,
                matchState: ms ?? state,
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
                ms = baseResult.matchState;
            }
        }
    }

    return { events: [...filteredEvents, ...extraEvents], matchState: ms };
}

// ============================================================================
// destroy→move 循环：move 触发器可能产生新的 MINION_DESTROYED（如制高点/幼熊斥候），
// 需要回馈给 processDestroyTriggers 处理（如海盗被消灭时移动到其他基地）。
// 循环直到 move 不再产生新的 MINION_DESTROYED 事件为止。
// ============================================================================

/**
 * 循环执行 destroy→move 直到稳定（move 不再产生新的 MINION_DESTROYED）
 *
 * 典型场景：黑熊骑兵移动海盗到制高点基地 → 制高点消灭海盗 → 海盗 onDestroyed 触发移动
 */
export function processDestroyMoveCycle(
    events: SmashUpEvent[],
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    random: RandomFn,
    now: number
): PostProcessResult {
    let currentEvents = events;
    let ms: MatchState<SmashUpCore> | undefined;
    
    // 跟踪已处理的 MINION_DESTROYED 事件（防止重复处理）
    const processedDestroyUids = new Set<string>();

    // 第一轮：正常的 destroy → move
    // 记录第一轮处理的所有 MINION_DESTROYED 事件
    for (const e of currentEvents) {
        if (e.type === SU_EVENTS.MINION_DESTROYED) {
            const uid = (e as MinionDestroyedEvent).payload.minionUid;
            processedDestroyUids.add(uid);
        }
    }
    
    const afterDestroy = processDestroyTriggers(currentEvents, ms ?? state, playerId, random, now);
    if (afterDestroy.matchState) ms = afterDestroy.matchState;
    const afterMove = processMoveTriggers(afterDestroy.events, ms ?? state, playerId, random, now);
    if (afterMove.matchState) ms = afterMove.matchState;
    currentEvents = afterMove.events;

    // 检查 move 是否产生了新的 MINION_DESTROYED 事件（不在已处理集合中的）
    let newDestroyEvents = currentEvents.filter(
        e => e.type === SU_EVENTS.MINION_DESTROYED && !processedDestroyUids.has((e as MinionDestroyedEvent).payload.minionUid)
    ) as SmashUpEvent[];

    // 循环处理新产生的 MINION_DESTROYED（最多 5 轮防止无限循环）
    let iteration = 0;
    while (newDestroyEvents.length > 0 && iteration < 5) {
        iteration++;
        
        // 将新事件加入已处理集合
        for (const e of newDestroyEvents) {
            const uid = (e as MinionDestroyedEvent).payload.minionUid;
            processedDestroyUids.add(uid);
        }
        
        // 只对新的 MINION_DESTROYED 事件运行 destroy 触发器
        const extraDestroy = processDestroyTriggers(newDestroyEvents, ms ?? state, playerId, random, now);
        if (extraDestroy.matchState) ms = extraDestroy.matchState;

        // 替换原事件中的新 MINION_DESTROYED 为处理后的结果
        // （processDestroyTriggers 可能过滤掉被拯救的随从、添加 MINION_RETURNED/MINION_MOVED 等）
        const newDestroyUids = new Set(newDestroyEvents.map(e => (e as MinionDestroyedEvent).payload.minionUid));
        const eventsWithoutNewDestroy = currentEvents.filter(
            e => !(e.type === SU_EVENTS.MINION_DESTROYED && newDestroyUids.has((e as MinionDestroyedEvent).payload.minionUid))
        );
        currentEvents = [...eventsWithoutNewDestroy, ...extraDestroy.events];

        // 对 extraDestroy 产生的 MINION_MOVED 事件运行 move 触发器
        const extraMoveEvents = extraDestroy.events.filter(e => e.type === SU_EVENTS.MINION_MOVED);
        if (extraMoveEvents.length > 0) {
            const extraMove = processMoveTriggers(extraDestroy.events, ms ?? state, playerId, random, now);
            if (extraMove.matchState) ms = extraMove.matchState;
            // 替换 extraDestroy.events 部分为 extraMove 结果
            const eventsWithoutExtra = currentEvents.filter(
                e => !extraDestroy.events.includes(e)
            );
            currentEvents = [...eventsWithoutExtra, ...extraMove.events];

            // 检查是否又产生了新的 MINION_DESTROYED（不在已处理集合中的）
            newDestroyEvents = extraMove.events.filter(
                e => e.type === SU_EVENTS.MINION_DESTROYED && !processedDestroyUids.has((e as MinionDestroyedEvent).payload.minionUid)
            );
        } else {
            break;
        }
    }
    
    return { events: currentEvents, matchState: ms };
}

// ============================================================================
// onAffected 后处理：扫描"影响"类事件，触发 onMinionAffected
// 影响 = 消灭 | 移动 | 负力量修改 | 附着对手行动卡
// ============================================================================

/** 后处理：触发 onMinionAffected（聚合时机） */
export function processAffectTriggers(
    events: SmashUpEvent[],
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    random: RandomFn,
    now: number
): PostProcessResult {
    const core = state.core;
    const extraEvents: SmashUpEvent[] = [];
    let ms: MatchState<SmashUpCore> | undefined;

    for (const evt of events) {
        let minionUid: string | undefined;
        let minionDefId: string | undefined;
        let baseIndex: number | undefined;
        let affectType: import('./ongoingEffects').AffectType | undefined;
        let sourcePlayerId: PlayerId = playerId;

        switch (evt.type) {
            case SU_EVENTS.MINION_DESTROYED: {
                const de = evt as MinionDestroyedEvent;
                minionUid = de.payload.minionUid;
                minionDefId = de.payload.minionDefId;
                baseIndex = de.payload.fromBaseIndex;
                affectType = 'destroy';
                break;
            }
            case SU_EVENTS.MINION_MOVED: {
                const me = evt as MinionMovedEvent;
                minionUid = me.payload.minionUid;
                minionDefId = me.payload.minionDefId;
                baseIndex = me.payload.fromBaseIndex;
                affectType = 'move';
                break;
            }
            case SU_EVENTS.POWER_COUNTER_ADDED: {
                const pe = evt as PowerCounterAddedEvent;
                // 只有负力量修改算"影响"
                if (pe.payload.amount < 0) {
                    minionUid = pe.payload.minionUid;
                    baseIndex = pe.payload.baseIndex;
                    affectType = 'power_change';
                    // 从基地上查找随从 defId
                    const base = core.bases[baseIndex];
                    const minion = base?.minions.find(m => m.uid === minionUid);
                    minionDefId = minion?.defId;
                }
                break;
            }
            case SU_EVENTS.POWER_COUNTER_REMOVED: {
                const pe = evt as PowerCounterRemovedEvent;
                // 移除正力量计数器也算负影响
                if (pe.payload.amount > 0) {
                    minionUid = pe.payload.minionUid;
                    baseIndex = pe.payload.baseIndex;
                    affectType = 'power_change';
                    const base = core.bases[baseIndex];
                    const minion = base?.minions.find(m => m.uid === minionUid);
                    minionDefId = minion?.defId;
                }
                break;
            }
            case SU_EVENTS.TEMP_POWER_ADDED: {
                const te = evt as TempPowerAddedEvent;
                if (te.payload.amount < 0) {
                    minionUid = te.payload.minionUid;
                    baseIndex = te.payload.baseIndex;
                    affectType = 'power_change';
                    const base = core.bases[baseIndex];
                    const minion = base?.minions.find(m => m.uid === minionUid);
                    minionDefId = minion?.defId;
                }
                break;
            }
            case SU_EVENTS.ONGOING_ATTACHED: {
                const oe = evt as OngoingAttachedEvent;
                // 只有附着到随从上才算"影响"
                if (oe.payload.targetType === 'minion' && oe.payload.targetMinionUid) {
                    minionUid = oe.payload.targetMinionUid;
                    baseIndex = oe.payload.targetBaseIndex;
                    affectType = 'attach_action';
                    sourcePlayerId = oe.payload.ownerId;
                    const base = core.bases[baseIndex];
                    const minion = base?.minions.find(m => m.uid === minionUid);
                    minionDefId = minion?.defId;
                }
                break;
            }
        }

        if (!minionUid || !minionDefId || baseIndex === undefined || !affectType) continue;

        // 查找被影响随从，确认来源是对手
        const base = core.bases[baseIndex];
        const minion = base?.minions.find(m => m.uid === minionUid);
        if (!minion) continue;

        const result = fireTriggers(core, 'onMinionAffected', {
            state: core,
            matchState: ms ?? state,
            playerId: sourcePlayerId,
            baseIndex,
            triggerMinionUid: minionUid,
            triggerMinionDefId: minionDefId,
            triggerMinion: minion,
            affectType,
            random,
            now,
        });
        extraEvents.push(...result.events);
        if (result.matchState) ms = result.matchState;
    }

    if (extraEvents.length === 0) return { events };
    return { events: [...events, ...extraEvents], matchState: ms };
}

// reduce 函数已提取到 ./reduce.ts
export { reduce } from './reduce';
