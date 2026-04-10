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
    FactionDeselectedEvent,
    AllFactionsSelectedEvent,
    MinionDestroyedEvent,
    RevealHandEvent,
    MinionMovedEvent,
    MinionControlChangedEvent,
    MinionReturnedEvent,
    CardRecoveredFromDiscardEvent,
    DeckInspectedEvent,
    OngoingAttachedEvent,
    OngoingDetachedEvent,
    RevealDeckTopEvent,
    TalentUsedEvent,
    CardInstance,
    BaseInPlay,
    PlayerState,
    PowerCounterAddedEvent,
    PowerCounterRemovedEvent,
    TempPowerAddedEvent,
    PermanentPowerAddedEvent,
    CardToDeckBottomEvent,
    SpecialAfterScoringArmedEvent,
} from './types';
import type { PlayerId } from '../../../engine/types';
import { SU_COMMANDS, SU_EVENTS, STARTING_HAND_SIZE } from './types';
import { triggerActiveBaseAbility } from './baseAbilities';
import { getMinionDef, getMinionLikePower, getCardDef, getBaseDefIdsForFactions, getFusionDef } from '../data/cards';
import type { ActionCardDef, FusionCardDef } from './types';
import { buildDeck, drawCards, getMinionTalentActivationError, isCardMinionLike } from './utils';
import { autoMulligan } from '../../../engine/primitives/mulligan';
import { maybeQueueStartingHandMulliganPrompt } from './mulliganHandlers';
import { resolveOnPlay, resolveOngoingActivation, resolveSpecial, resolveTalent, resolveOnDestroy } from './abilityRegistry';
import type { AbilityContext } from './abilityRegistry';
import { triggerBaseAbility, triggerExtendedBaseAbility } from './baseAbilities';
import { fireTriggers, collectTriggers, hasPlayerTurnRestriction, isMinionProtected, getConsumableProtectionSource } from './ongoingEffects';
import { maybeResolveReactionQueue } from './reactionQueue';
import { canPlayFromDiscard } from './discardPlayability';
import { reduce } from './reduce';
import { getEffectivePower } from './ongoingModifiers';
import { buildAffectRecords, type AffectRecord } from './affect';

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
    const afterProtectedAffect = filterProtectedAffectEvents(afterDestroyMove.events, state.core, command.playerId);
    const afterReturnTriggers = processReturnToHandTriggers(afterProtectedAffect, state, command.playerId, random, now);
    if (afterReturnTriggers.matchState) {
        state.sys = afterReturnTriggers.matchState.sys;
    }
    // 放入牌库底保护过滤（bear_cavalry_superiority / ghost_incorporeal 等）
    const afterAffect = processAffectTriggers(afterReturnTriggers.events, state, command.playerId, random, now);
    if (afterAffect.matchState) {
        state.sys = afterAffect.matchState.sys;
    }
    const afterDeckInspection = processDeckInspectionTriggers(afterAffect.events, state, command.playerId, random, now);
    if (afterDeckInspection.matchState) {
        state.sys = afterDeckInspection.matchState.sys;
    }
    
    return afterDeckInspection.events;
}

/** 内部命令执行（不含后处理） */
function executeCommand(
    state: MatchState<SmashUpCore>,
    command: SmashUpCommand,
    random: RandomFn,
    now: number
): { events: SmashUpEvent[]; updatedState?: MatchState<SmashUpCore> } {
    // 防御性初始化：处理测试环境可能传递裸 core 的情况
    // 如果 state 没有 core 字段，说明传递的是裸 core，需要包装
    if (!(state as any).core) {
        state = { core: state as any, sys: { interaction: { queue: [] } } as any };
    }
    // 确保 sys 和 sys.interaction 存在
    if (!state.sys) {
        state = { ...state, sys: { interaction: { queue: [] } } as any };
    } else if (!state.sys.interaction) {
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
            const basePower = getMinionLikePower(card.defId) ?? 0;

            const playedEvt: MinionPlayedEvent = {
                type: SU_EVENTS.MINION_PLAYED,
                payload: {
                    playerId: command.playerId,
                    cardUid: card.uid,
                    defId: card.defId,
                    baseIndex,
                    baseDefId: core.bases[baseIndex].defId,
                    power: basePower,
                    fromDiscard: fromDiscard || undefined,
                    ...(fromDiscard ? (() => {
                        const info = canPlayFromDiscard(core, command.playerId, card.uid, baseIndex);
                        return info ? { discardPlaySourceId: info.sourceId, consumesNormalLimit: info.consumesNormalLimit } : {};
                    })() : {}),
                    // meFirst 响应窗口中打出 beforeScoringPlayable 随从不消耗正常额度
                    ...(state.sys.responseWindow?.current?.windowType === 'meFirst' && (() => {
                        if (minionDef?.beforeScoringPlayable) return true;
                        const fusionDef = getFusionDef(card.defId);
                        return fusionDef?.minionBeforeScoringPlayable === true;
                    })()
                        ? { consumesNormalLimit: false }
                        : {}),
                },
                sourceCommandType: command.type,
                timestamp: now,
            };
            events.push(playedEvt);

            // meFirst 响应窗口中打出 beforeScoringPlayable 随从时，记录 specialLimitGroup 使用
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
            const def = getCardDef(card.defId) as ActionCardDef | FusionCardDef | undefined;
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

            const subtype = (def as any)?.type === 'fusion'
                ? (def as FusionCardDef).actionSubtype
                : (def as ActionCardDef | undefined)?.subtype;

            if (subtype === 'ongoing') {
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
                // ongoing 卡的 onPlay 能力（如 block_the_path 阻挡路径）
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
                        handSizeAfterPlay: player.hand.length - 1,
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
                const isSpecial = subtype === 'special';
                
                if (isSpecial) {
                    // Special 技能：根据 specialTiming 决定执行时机
                    const specialTiming = (def as any)?.type === 'fusion'
                        ? ((def as FusionCardDef).actionSpecialTiming ?? 'beforeScoring')
                        : ((def as ActionCardDef | undefined)?.specialTiming ?? 'beforeScoring'); // 默认 beforeScoring
                    
                    if (specialTiming === 'beforeScoring') {
                        // beforeScoring：立即执行（当前行为）
                        const executor = resolveSpecial(card.defId) ?? resolveOnPlay(card.defId);
                        if (executor) {
                            const ctx: AbilityContext = {
                                state: core,
                                matchState: state,
                                playerId: command.playerId,
                                cardUid: card.uid,
                                defId: card.defId,
                                baseIndex: command.payload.targetBaseIndex,
                                targetMinionUid: command.payload.targetMinionUid,
                                handSizeAfterPlay: player.hand.length - 1,
                                random,
                                now,
                            };
                            const result = executor(ctx);
                            events.push(...result.events);
                            if (result.matchState) {
                                updatedState = result.matchState;
                            }
                        }
                    } else if (specialTiming === 'afterScoring') {
                        // afterScoring：检查是否在响应窗口中
                        const responseWindow = state.sys.responseWindow?.current;
                        const isInAfterScoringWindow = responseWindow?.windowType === 'afterScoring';
                        
                        if (isInAfterScoringWindow) {
                            // 在 afterScoring 响应窗口中：立即执行
                            const executor = resolveSpecial(card.defId) ?? resolveOnPlay(card.defId);
                            if (executor) {
                                const ctx: AbilityContext = {
                                    state: core,
                                    matchState: state,
                                    playerId: command.playerId,
                                    cardUid: card.uid,
                                    defId: card.defId,
                                    baseIndex: command.payload.targetBaseIndex,
                                    targetMinionUid: command.payload.targetMinionUid,
                                    handSizeAfterPlay: player.hand.length - 1,
                                    random,
                                    now,
                                };
                                const result = executor(ctx);
                                events.push(...result.events);
                                if (result.matchState) {
                                    updatedState = result.matchState;
                                }
                            }
                        } else {
                            // 不在响应窗口中：生成 ARMED 事件，延迟到基地计分后执行
                            const armedEvt: SpecialAfterScoringArmedEvent = {
                                type: SU_EVENTS.SPECIAL_AFTER_SCORING_ARMED,
                                payload: {
                                    sourceDefId: card.defId,
                                    playerId: command.playerId,
                                    baseIndex: command.payload.targetBaseIndex,
                                    cardUid: card.uid,
                                },
                                timestamp: now,
                            };
                            events.push(armedEvt);
                        }
                    }
                } else {
                    // Standard 行动卡：执行 onPlay 效果
                    const executor = resolveOnPlay(card.defId);
                    if (executor) {
                        const ctx: AbilityContext = {
                            state: core,
                            matchState: state,
                            playerId: command.playerId,
                            cardUid: card.uid,
                            defId: card.defId,
                            baseIndex: command.payload.targetBaseIndex,
                            targetMinionUid: command.payload.targetMinionUid,
                            handSizeAfterPlay: player.hand.length - 1,
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
            }

            // 基地能力触发：onActionPlayed（如工坊：额外打出一张战术）
            const targetBaseIdx = command.payload.targetBaseIndex;
            const actionTargetType = command.payload.targetMinionUid ? 'minion' : 'base';
            const currentActionMS = updatedState ?? state;
            if (targetBaseIdx !== undefined) {
                const base = core.bases[targetBaseIdx];
                if (base) {
                    const baseCtx = {
                        state: core,
                        matchState: currentActionMS,
                        random,
                        baseIndex: targetBaseIdx,
                        baseDefId: base.defId,
                        playerId: command.playerId,
                        actionTargetBaseIndex: targetBaseIdx,
                        actionTargetType,
                        actionTargetMinionUid: command.payload.targetMinionUid,
                        now,
                    };
                    const bResult = triggerBaseAbility(base.defId, 'onActionPlayed', baseCtx);
                    events.push(...bResult.events);
                    if (bResult.matchState) {
                        updatedState = bResult.matchState;
                    }
                }

                const queuedOngoing = collectTriggers(core, 'onActionPlayed', {
                    state: core,
                    matchState: currentActionMS,
                    playerId: command.playerId,
                    baseIndex: targetBaseIdx,
                    actionTargetBaseIndex: targetBaseIdx,
                    actionTargetType,
                    actionTargetMinionUid: command.payload.targetMinionUid,
                    random,
                    now,
                });
                if (queuedOngoing) {
                    events.push(queuedOngoing);
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

                        readiedPlayers[pid] = {
                            deck: drawResult.deck,
                            hand: drawResult.hand,
                        };
                        // 起手无随从 → 标记为可选择重抽一次（may）
                        // 融合卡规则：未打出时同时算随从与战术，因此 fusion 也算“有随从”
                        if (!drawResult.hand.some(isCardMinionLike)) {
                            mulliganPlayers.push(pid);
                        }
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

                // 规则：起手无随从“可”重抽一次 → 排队交互（不会影响核心事件链）
                // 注意：这一步只改变 sys.interaction，不直接改 core；重抽由交互 handler 生成事件完成。
                let updated = state;
                for (const pid of mulliganPlayers) {
                    updated = maybeQueueStartingHandMulliganPrompt(updated, pid, now);
                }
                return { events, updatedState: updated };
            }

            return { events };
        }

        case SU_COMMANDS.DESELECT_FACTION: {
            const { factionId } = command.payload;
            const deselectedEvt: FactionDeselectedEvent = {
                type: SU_EVENTS.FACTION_DESELECTED,
                payload: { playerId: command.playerId, factionId },
                sourceCommandType: command.type,
                timestamp: now,
            };
            return { events: [deselectedEvt] };
        }

        case SU_COMMANDS.USE_BASE_ABILITY: {
            const { baseIndex } = command.payload;
            const base = core.bases[baseIndex];
            if (!base) return { events: [] };
            const result = triggerActiveBaseAbility(base.defId, {
                state: core,
                matchState: state,
                baseIndex,
                baseDefId: base.defId,
                playerId: command.playerId,
                now,
            });
            return {
                events: result.events,
                ...(result.matchState ? { updatedState: result.matchState } : {}),
            };
        }

        case SU_COMMANDS.USE_TALENT: {
            const { minionUid, ongoingCardUid, titanUid, baseIndex } = command.payload;
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
            if (titanUid) {
                const titan = (core.titans ?? []).find(candidate => candidate.uid === titanUid);
                if (!titan) return { events: [] };

                const talentEvt: TalentUsedEvent = {
                    type: SU_EVENTS.TALENT_USED,
                    payload: {
                        playerId: command.playerId,
                        titanUid,
                        defId: titan.defId,
                        baseIndex,
                    },
                    sourceCommandType: command.type,
                    timestamp: now,
                };
                events.push(talentEvt);

                const executor = resolveTalent(titan.defId);
                if (executor) {
                    const ctx: AbilityContext = {
                        state: core,
                        matchState: state,
                        playerId: command.playerId,
                        cardUid: titanUid,
                        defId: titan.defId,
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

            const minion = base?.minions.find(m => m.uid === minionUid);
            if (!minion) return { events: [] };
            if (getMinionTalentActivationError(core, minion, baseIndex)) {
                return { events: [] };
            }

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
            const { minionUid: spUid, titanUid, baseIndex: spIdx } = command.payload;
            const spBase = core.bases[spIdx];
            if (titanUid) {
                const titan = (core.titans ?? []).find(candidate => candidate.uid === titanUid);
                if (!titan) return { events: [] };

                const executor = resolveSpecial(titan.defId);
                if (!executor) return { events: [] };

                const ctx: AbilityContext = {
                    state: core,
                    matchState: state,
                    playerId: command.playerId,
                    cardUid: titanUid,
                    defId: titan.defId,
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

        case SU_COMMANDS.ACTIVATE_TITAN_ONGOING: {
            const { titanUid, baseIndex } = command.payload;
            const titan = (core.titans ?? []).find(candidate => candidate.uid === titanUid);
            if (!titan) return { events: [] };

            const executor = resolveOngoingActivation(titan.defId);
            if (!executor) return { events: [] };

            const ctx: AbilityContext = {
                state: core,
                matchState: state,
                playerId: command.playerId,
                cardUid: titanUid,
                defId: titan.defId,
                baseIndex,
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
        const rawSource = de.payload.destroyerId ?? sourcePlayerId;
        // 基地能力不属于任何玩家（Wiki/FAQ：base isn't any player's card）
        // 对于 reason='base_*' 的事件，把 source 视为“目标自己”，从而不会触发
        // “只有对手才会被拦截”的保护（如 deep_roots / elder_thing 等）。
        const effectiveSource = de.payload.reason?.startsWith('base_') ? minion.controller : rawSource;
        const sourceKind = (de.payload as { sourceKind?: 'action' | 'nonAction' }).sourceKind;
        // 检查 destroy 保护和 action 保护
        if (isMinionProtected(core, minion, fromBaseIndex, effectiveSource, 'destroy')) continue;
        // 检查 'action' 和 'affect' 两种广义保护类型（tooth_and_claw 注册为 'affect'）
        const actionProtected = sourceKind === 'nonAction'
            ? false
            : isMinionProtected(core, minion, fromBaseIndex, effectiveSource, 'action');
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

function isActionAffectRecord(record: AffectRecord): boolean {
    if (!record.sourceDefId) return false;
    const def = getCardDef(record.sourceDefId);
    return def?.type === 'action' || def?.type === 'fusion';
}

function buildProtectionSelfDestructEvent(
    source: { uid: string; defId: string; ownerId: PlayerId },
    timestamp?: number,
): OngoingDetachedEvent {
    return {
        type: SU_EVENTS.ONGOING_DETACHED,
        payload: {
            cardUid: source.uid,
            defId: source.defId,
            ownerId: source.ownerId,
            reason: `${source.defId}_self_destruct`,
        },
        timestamp,
    };
}

function buildBlockedAttachedActionDiscardEvent(
    record: AffectRecord,
    event: SmashUpEvent,
): OngoingDetachedEvent | undefined {
    if (event.type !== SU_EVENTS.ONGOING_ATTACHED || !record.sourceCardUid || !record.sourceDefId || !record.sourcePlayerId) {
        return undefined;
    }
    return {
        type: SU_EVENTS.ONGOING_DETACHED,
        payload: {
            cardUid: record.sourceCardUid,
            defId: record.sourceDefId,
            ownerId: record.sourcePlayerId,
            reason: `${record.sourceDefId}_blocked_attach`,
            sourcePlayerId: record.sourcePlayerId,
            sourceCardUid: record.sourceCardUid,
            sourceDefId: record.sourceDefId,
            sourceControllerId: record.sourceControllerId,
            sourceBaseIndex: record.sourceBaseIndex,
        },
        timestamp: event.timestamp,
    };
}

function resolveBlockedProtectionType(
    core: SmashUpCore,
    record: AffectRecord,
    targetMinion: import('./types').MinionOnBase,
): 'move' | 'affect' | 'action' | undefined {
    if (record.baseIndex === undefined) return undefined;

    const effectiveSourcePlayerId = record.reason?.startsWith('base_')
        ? undefined
        : record.sourcePlayerId;
    if (!effectiveSourcePlayerId) return undefined;

    const orderedChecks: Array<'move' | 'affect' | 'action'> = [];
    if (record.affectType === 'return' || record.affectType === 'shuffle_into_deck') {
        orderedChecks.push('move');
    }
    orderedChecks.push('affect');
    if (isActionAffectRecord(record)) {
        orderedChecks.push('action');
    }

    for (const protectionType of orderedChecks) {
        if (isMinionProtected(core, targetMinion, record.baseIndex, effectiveSourcePlayerId, protectionType)) {
            return protectionType;
        }
    }

    return undefined;
}

export function filterProtectedAffectEvents(
    events: SmashUpEvent[],
    core: SmashUpCore,
    fallbackSourcePlayerId: PlayerId,
): SmashUpEvent[] {
    const result: SmashUpEvent[] = [];

    for (const event of events) {
        if (event.type === SU_EVENTS.MINION_DESTROYED || event.type === SU_EVENTS.MINION_MOVED) {
            result.push(event);
            continue;
        }

        const affectRecords = buildAffectRecords(core, event, fallbackSourcePlayerId)
            .filter(record => record.targetKind === 'minion' && record.countsForOnMinionAffected);

        if (affectRecords.length === 0) {
            result.push(event);
            continue;
        }

        let blocked = false;
        const extraEvents: SmashUpEvent[] = [];

        for (const record of affectRecords) {
            if (record.baseIndex === undefined || !record.triggerMinion) continue;

            const blockedProtectionType = resolveBlockedProtectionType(core, record, record.triggerMinion);
            if (!blockedProtectionType) continue;

            const effectiveSourcePlayerId = record.reason?.startsWith('base_')
                ? undefined
                : record.sourcePlayerId;

            if (effectiveSourcePlayerId) {
                const protectionSource = getConsumableProtectionSource(
                    core,
                    record.triggerMinion,
                    record.baseIndex,
                    effectiveSourcePlayerId,
                    blockedProtectionType,
                );
                if (protectionSource) {
                    extraEvents.push(buildProtectionSelfDestructEvent(protectionSource, event.timestamp));
                }
            }

            const blockedAttachCleanup = buildBlockedAttachedActionDiscardEvent(record, event);
            if (blockedAttachCleanup) {
                extraEvents.push(blockedAttachCleanup);
            }

            blocked = true;
            break;
        }

        if (blocked) {
            result.push(...extraEvents);
            continue;
        }

        result.push(event);
    }

    return result;
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
            // 跳过重复的消灭事件
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
    // FAQ batching: some base triggers apply once per destruction ability
    const baseDestroyBatchSeen = new Set<string>();

    for (const de of destroyEvents) {
        const { minionUid, minionDefId, fromBaseIndex, ownerId: eventOwnerId, destroyerId: eventDestroyerId, reason } = de.payload;
        const base = core.bases[fromBaseIndex];
        const minion = base?.minions.find(m => m.uid === minionUid);
        // ✅ 优先从 state 读取 owner（兜底修复：即使事件中的 ownerId 错了也能修复）
        const ownerId = minion?.owner ?? eventOwnerId;
        // destroyerId 缺失时，回退到当前事件链的操作者，而不是被消灭随从的控制者。
        // 否则像“荣誉之地”这类奖励消灭者的基地，会错误把 VP 判给受害者。
        const destroyerId = eventDestroyerId ?? playerId;

        // === Phase 1: 先检查防止消灭触发器（基地能力 + ongoing） ===
        // 在触发 onDestroy 之前，先确认消灭是否会被防止
        const currentMS_save = ms ?? state;
        const interactionCountBefore =
            (currentMS_save.sys.interaction.current ? 1 : 0) + currentMS_save.sys.interaction.queue.length;

        const saveEvents: SmashUpEvent[] = [];

        // 2. 触发基地扩展时机 onMinionDestroyed（如 nine_lives 防止消灭）
        if (base) {
            // Field of Honor / Crypt FAQ: if one card destroys many minions at once,
            // the base's reward should only happen once per destruction ability.
            if (base.defId === 'base_the_field_of_honor' || base.defId === 'base_crypt') {
                const batchKey = `${base.defId}::${fromBaseIndex}::${destroyerId}::${reason ?? ''}`;
                if (baseDestroyBatchSeen.has(batchKey)) {
                    // skip triggering this base ability again for this batch
                } else {
                    baseDestroyBatchSeen.add(batchKey);
                    const baseCtx = {
                        state: core,
                        matchState: ms ?? state,
                        random,
                        baseIndex: fromBaseIndex,
                        baseDefId: base.defId,
                        playerId: ownerId,
                        minionUid,
                        minionDefId,
                        controllerId: minion?.controller ?? ownerId,
                        destroyerId,
                        now,
                        reason,
                    };
                    const baseResult = triggerExtendedBaseAbility(base.defId, 'onMinionDestroyed', baseCtx);
                    saveEvents.push(...baseResult.events);
                    if (baseResult.matchState) ms = baseResult.matchState;
                }
            } else {
            const baseCtx = {
                state: core,
                matchState: ms ?? state,
                random,
                baseIndex: fromBaseIndex,
                baseDefId: base.defId,
                playerId: ownerId,
                minionUid,
                minionDefId,
                controllerId: minion?.controller ?? ownerId,
                destroyerId,
                now,
                reason,
            };
                const baseResult = triggerExtendedBaseAbility(base.defId, 'onMinionDestroyed', baseCtx);
                saveEvents.push(...baseResult.events);
                if (baseResult.matchState) ms = baseResult.matchState;
            }
        }

        // 3. 触发 ongoing 拦截器 onMinionDestroyed（replacement：如雄蜂防止消灭、逃生舱回手牌）
        const ongoingDestroyEvents = fireTriggers(core, 'onMinionDestroyed', {
            state: core,
            matchState: ms ?? state,
            playerId: ownerId,
            baseIndex: fromBaseIndex,
            triggerMinionUid: minionUid,
            triggerMinionDefId: minionDefId,
            triggerMinionPower: minion ? getEffectivePower(core, minion, fromBaseIndex) : undefined,
            triggerMinion: minion,
            destroyerId,
            reason: de.payload.reason,
            random,
            now,
        }, { phase: 'replacement' });
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
        const hasDeckRedirect = saveEvents.some(e =>
            (e.type === SU_EVENTS.CARD_TO_DECK_BOTTOM || e.type === SU_EVENTS.CARD_TO_DECK_TOP) &&
            (e as any).payload?.cardUid === minionUid
        );
        const hasSaveEvent = hasReturn || hasMoveAway || hasDeckRedirect;
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
        // 当 hasSaveEvent 时，消灭被替代/改写（回手牌 / 移动走 / 放回牌库顶/底），
        // 同样需要抑制其他触发器的副作用事件，但保留替代效果事件本身。
        const localEvents: SmashUpEvent[] = isPendingSave
            ? []
            : hasSaveEvent
                ? saveEvents.filter(e =>
                    e.type === SU_EVENTS.MINION_RETURNED ||
                    (e.type === SU_EVENTS.MINION_MOVED && (e as MinionMovedEvent).payload.minionUid === minionUid) ||
                    ((e.type === SU_EVENTS.CARD_TO_DECK_BOTTOM || e.type === SU_EVENTS.CARD_TO_DECK_TOP) && (e as any).payload?.cardUid === minionUid)
                )
                : [...saveEvents];
        if (!isPendingSave && !hasSaveEvent) {
            // reaction-phase triggers for onMinionDestroyed are queued and resolved later (Wiki simultaneous ordering)
            const queuedDestroyReactions = collectTriggers(core, 'onMinionDestroyed', {
                state: core,
                matchState: ms ?? state,
                playerId: ownerId,
                baseIndex: fromBaseIndex,
                triggerMinionUid: minionUid,
                triggerMinionDefId: minionDefId,
                triggerMinionPower: minion ? getEffectivePower(core, minion, fromBaseIndex) : undefined,
                triggerMinion: minion,
                destroyerId,
                reason: de.payload.reason,
                random,
                now,
            });
            if (queuedDestroyReactions) {
                localEvents.push(queuedDestroyReactions);
            }
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

    // 需要抑制的随从 uid：已被 replacement 改写去向（回手/移动走/放回牌库）+ 待交互拯救
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
        if (e.type === SU_EVENTS.CARD_TO_DECK_BOTTOM || e.type === SU_EVENTS.CARD_TO_DECK_TOP) {
            const uid = (e as any).payload?.cardUid as string | undefined;
            if (uid) suppressedMinionUids.add(uid);
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

    const combined = [...cleanedEvents, ...extraEvents];

    // Attempt to auto-resolve reaction queue when possible (single trigger, no ordering prompt).
    // The queued trigger may depend on other events from the same batch already having been
    // reduced into core (for example ONGOING_ATTACHED before an onMinionAffected reaction).
    let coreForQueue = (ms ?? state).core;
    for (const e of combined) {
        coreForQueue = reduce(coreForQueue, e);
    }
    const baseMS = ms ?? state;
    const msForQueue = coreForQueue === baseMS.core ? baseMS : { ...baseMS, core: coreForQueue };
    const rq = maybeResolveReactionQueue(msForQueue, random, now);
    if (rq) {
        return { events: [...combined, ...rq.events], matchState: rq.state };
    }

    return { events: combined, matchState: ms };
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
        const effectiveSource = me.payload.reason?.startsWith('base_') ? minion.controller : sourcePlayerId;
        if (hasPlayerTurnRestriction(core, effectiveSource, 'move_minion')) {
            continue;
        }
        if (isMinionProtected(core, minion, fromBaseIndex, effectiveSource, 'move')) continue;
        // 检查 'action' 和 'affect' 两种广义保护类型（与 filterProtectedDestroyEvents 对齐）
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
    return filterProtectedAffectEvents(events, core, sourcePlayerId);
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
    return filterProtectedAffectEvents(events, core, sourcePlayerId);
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
        const { minionUid, minionDefId, fromBaseIndex, toBaseIndex } = me.payload;

        // 触发“移入该基地”的 ongoing onMinionMoved。
        const queued = collectTriggers(core, 'onMinionMoved', {
            state: core,
            matchState: ms ?? state,
            playerId,
            baseIndex: toBaseIndex,
            moveFromBaseIndex: fromBaseIndex,
            moveToBaseIndex: toBaseIndex,
            triggerMinionUid: minionUid,
            triggerMinionDefId: minionDefId,
            random,
            now,
        });
        if (queued) extraEvents.push(queued);

        // 触发“有随从从该基地移走”的 ongoing onMinionMoved（如硕大圆石）。
        if (fromBaseIndex !== toBaseIndex) {
            const queuedFromBase = collectTriggers(core, 'onMinionMoved', {
                state: core,
                matchState: ms ?? state,
                playerId,
                baseIndex: fromBaseIndex,
                moveFromBaseIndex: fromBaseIndex,
                moveToBaseIndex: toBaseIndex,
                triggerMinionUid: minionUid,
                triggerMinionDefId: minionDefId,
                random,
                now,
            });
            if (queuedFromBase) extraEvents.push(queuedFromBase);
        }

        // 触发基地扩展时机 onMinionMoved（如牧场：首次移动触发额外移动）
        const targetBase = core.bases[toBaseIndex];
        if (targetBase) {
            const baseCtx = {
                state: core,
                matchState: ms ?? state,
                random,
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

/** 后处理：触发 onCardReturnedToHand 拦截器 */
export function processReturnToHandTriggers(
    events: SmashUpEvent[],
    state: MatchState<SmashUpCore>,
    _playerId: PlayerId,
    random: RandomFn,
    now: number,
): PostProcessResult {
    const core = state.core;
    const extraEvents: SmashUpEvent[] = [];
    let ms: MatchState<SmashUpCore> | undefined;

    for (const event of events) {
        if (event.type === SU_EVENTS.MINION_RETURNED) {
            const payload = (event as MinionReturnedEvent).payload;
            const queued = collectTriggers(core, 'onCardReturnedToHand', {
                state: core,
                matchState: ms ?? state,
                playerId: payload.toPlayerId,
                reason: payload.reason,
                random,
                now,
            });
            if (queued) extraEvents.push(queued);
            continue;
        }

        if (event.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD) {
            const payload = (event as CardRecoveredFromDiscardEvent).payload;
            if ((payload.cardUids?.length ?? 0) === 0) continue;
            const queued = collectTriggers(core, 'onCardReturnedToHand', {
                state: core,
                matchState: ms ?? state,
                playerId: payload.playerId,
                reason: payload.reason,
                random,
                now,
            });
            if (queued) extraEvents.push(queued);
            continue;
        }

        if (event.type === SU_EVENTS.BURIED_CARD_RETURNED_TO_HAND) {
            const payload = event.payload as { playerId: PlayerId; source: string };
            const queued = collectTriggers(core, 'onCardReturnedToHand', {
                state: core,
                matchState: ms ?? state,
                playerId: payload.playerId,
                reason: payload.source,
                random,
                now,
            });
            if (queued) extraEvents.push(queued);
        }
    }

    return extraEvents.length > 0
        ? { events: [...events, ...extraEvents], matchState: ms }
        : { events };
}

/** 后处理：触发 onDeckInspected 拦截器 */
export function processDeckInspectionTriggers(
    events: SmashUpEvent[],
    state: MatchState<SmashUpCore>,
    _playerId: PlayerId,
    random: RandomFn,
    now: number,
): PostProcessResult {
    const core = state.core;
    const extraEvents: SmashUpEvent[] = [];
    let ms: MatchState<SmashUpCore> | undefined;
    const seenInspectionKeys = new Set<string>();

    for (const event of events) {
        let inspectorPlayerId: PlayerId | undefined;
        let reason: string | undefined;
        let inspectionCards: Array<{ uid: string; defId: string }> | undefined;
        let inspectionZone: 'deck' | 'hand' | undefined;
        let inspectionTargetPlayerIds: PlayerId[] | undefined;
        let inspectionCausePlayerId: PlayerId | undefined;

        if (event.type === SU_EVENTS.DECK_INSPECTED) {
            const payload = (event as DeckInspectedEvent).payload;
            inspectorPlayerId = payload.inspectorPlayerId;
            reason = payload.reason;
            inspectionTargetPlayerIds = Array.isArray(payload.targetPlayerId)
                ? payload.targetPlayerId as PlayerId[]
                : [payload.targetPlayerId as PlayerId];
            inspectionCausePlayerId = payload.inspectorPlayerId;
        } else if (event.type === SU_EVENTS.REVEAL_HAND) {
            const payload = (event as RevealHandEvent).payload;
            inspectorPlayerId = payload.viewerPlayerId as PlayerId;
            reason = payload.reason;
            inspectionCards = payload.cards;
            inspectionZone = 'hand';
            inspectionTargetPlayerIds = Array.isArray(payload.targetPlayerId)
                ? payload.targetPlayerId as PlayerId[]
                : [payload.targetPlayerId as PlayerId];
            inspectionCausePlayerId = payload.sourcePlayerId as PlayerId | undefined ?? payload.viewerPlayerId as PlayerId;
        } else if (event.type === SU_EVENTS.REVEAL_DECK_TOP) {
            const payload = (event as RevealDeckTopEvent).payload;
            inspectorPlayerId = payload.sourcePlayerId ?? (payload.viewerPlayerId === 'all' ? undefined : payload.viewerPlayerId);
            reason = payload.reason;
            inspectionCards = payload.cards;
            inspectionZone = 'deck';
            inspectionTargetPlayerIds = Array.isArray(payload.targetPlayerId)
                ? payload.targetPlayerId as PlayerId[]
                : [payload.targetPlayerId as PlayerId];
            inspectionCausePlayerId = payload.sourcePlayerId as PlayerId | undefined
                ?? (payload.viewerPlayerId === 'all' ? undefined : payload.viewerPlayerId as PlayerId);
        }

        if (!inspectorPlayerId || !reason) continue;
        const dedupeKey = `${inspectorPlayerId}:${reason}:${event.timestamp ?? now}`;
        if (seenInspectionKeys.has(dedupeKey)) continue;
        seenInspectionKeys.add(dedupeKey);

        const queued = collectTriggers(core, 'onDeckInspected', {
            state: core,
            matchState: ms ?? state,
            playerId: inspectorPlayerId,
            reason,
            inspectionCards,
            inspectionZone,
            inspectionTargetPlayerIds,
            inspectionCausePlayerId,
            random,
            now,
        });
        if (queued) extraEvents.push(queued);
    }

    return extraEvents.length > 0
        ? { events: [...events, ...extraEvents], matchState: ms }
        : { events };
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

    for (const event of events) {
        const affectRecords = buildAffectRecords(core, event, playerId);
        for (const record of affectRecords) {
            if (!record.countsForOnMinionAffected || !record.triggerMinion || record.baseIndex === undefined) continue;

            const queued = collectTriggers(core, 'onMinionAffected', {
                state: core,
                matchState: ms ?? state,
                playerId: record.sourcePlayerId ?? playerId,
                baseIndex: record.baseIndex,
                sourceCardUid: record.sourceCardUid,
                sourceBaseIndex: record.sourceBaseIndex,
                sourceControllerId: record.sourceControllerId,
                triggerMinionUid: record.triggerMinionUid,
                triggerMinionDefId: record.triggerMinionDefId,
                triggerMinion: record.triggerMinion,
                affectType: record.affectType,
                reason: record.reason,
                random,
                now,
            });
            if (queued) extraEvents.push(queued);
        }
    }

    if (extraEvents.length === 0) return { events };
    return { events: [...events, ...extraEvents], matchState: ms };
}

// reduce 函数已提取到 ./reduce.ts
export { reduce } from './reduce';
