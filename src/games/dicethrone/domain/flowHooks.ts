/**
 * DiceThrone FlowHooks 实现
 * 从 game.ts 提取
 *
 * 符合 openspec/changes/add-flow-system/design.md Decision 3
 * sys.phase 是阶段的单一权威来源，所有阶段副作用通过 FlowHooks 实现
 */

import type { GameEvent } from '../../../engine/types';
import type { FlowHooks, PhaseExitResult } from '../../../engine';
import type {
    DiceThroneCore,
    TurnPhase,
    DiceThroneEvent,
    CpChangedEvent,
    TurnChangedEvent,
    StatusRemovedEvent,
    AbilityActivatedEvent,
    ExtraAttackTriggeredEvent,
    TokenConsumedEvent,
    ChoiceRequestedEvent,
} from './types';
import { STATUS_IDS, TOKEN_IDS } from './ids';
import { canAdvancePhase, getNextPhase, getNextPlayerId, getPlayerDieFace, getResponderQueue, getRollerId } from './rules';
import { resolveAttack, resolveOffensivePreDefenseEffects, resolvePostDamageEffects } from './attack';
import { resourceSystem } from './resourceSystem';
import { RESOURCE_IDS } from './resources';
import { buildDrawEvents } from './deckEvents';
import { reduce } from './reducer';
import { getGameMode, applyEvents } from './utils';
import type { ResponseWindowOpenedEvent } from './events';
import { createDamageCalculation } from '../../../engine/primitives';
import { getUsableTokensForOffensiveRollEnd } from './tokenResponse';
import { getPlayerAbilityBaseDamage } from './abilityLookup';

/**
 * 检查攻击方是否有晕眩（daze）
 * 晕眩规则：攻击结算后，移除晕眩，对手获得一次额外攻击机会
 * @returns 额外攻击事件数组 + 是否触发了额外攻击
 */
function checkDazeExtraAttack(
    core: DiceThroneCore,
    events: GameEvent[],
    commandType: string,
    timestamp: number
): { dazeEvents: GameEvent[]; triggered: boolean } {
    // 从已生成的事件中找到 ATTACK_RESOLVED，获取攻击方信息
    const attackResolved = events.find(e => e.type === 'ATTACK_RESOLVED') as
        Extract<DiceThroneEvent, { type: 'ATTACK_RESOLVED' }> | undefined;
    if (!attackResolved) return { dazeEvents: [], triggered: false };

    const { attackerId, defenderId } = attackResolved.payload;
    const attacker = core.players[attackerId];
    const dazeStacks = attacker?.statusEffects[STATUS_IDS.DAZE] ?? 0;
    if (dazeStacks <= 0) return { dazeEvents: [], triggered: false };

    const dazeEvents: GameEvent[] = [];

    // 移除晕眩状态
    dazeEvents.push({
        type: 'STATUS_REMOVED',
        payload: { targetId: attackerId, statusId: STATUS_IDS.DAZE, stacks: dazeStacks },
        sourceCommandType: commandType,
        timestamp,
    } as StatusRemovedEvent);

    // 触发额外攻击：对手（defenderId）获得一次进攻机会
    dazeEvents.push({
        type: 'EXTRA_ATTACK_TRIGGERED',
        payload: {
            attackerId: defenderId,
            targetId: attackerId,
            sourceStatusId: STATUS_IDS.DAZE,
        },
        sourceCommandType: commandType,
        timestamp,
    } as ExtraAttackTriggeredEvent);

    return { dazeEvents, triggered: true };
}

/**
 * 攻击结算后检查是否需要开响应窗口（如 card-dizzy：造成 ≥8 伤害后打出）
 * 需要先 applyEvents 得到含 lastResolvedAttackDamage 的状态再检查
 */
function checkAfterAttackResponseWindow(
    core: DiceThroneCore,
    allEvents: GameEvent[],
    commandType: string,
    timestamp: number,
    phase: TurnPhase
): ResponseWindowOpenedEvent | null {
    // 先 apply 所有事件得到最新状态（含 lastResolvedAttackDamage）
    const stateAfterAttack = applyEvents(core, allEvents as DiceThroneEvent[], reduce);

    // 找到攻击方 ID
    const attackResolved = allEvents.find(e => e.type === 'ATTACK_RESOLVED') as
        Extract<DiceThroneEvent, { type: 'ATTACK_RESOLVED' }> | undefined;
    if (!attackResolved) return null;

    const { attackerId, defenderId } = attackResolved.payload;

    // 只允许进攻方响应（card-dizzy："如果你对对手造成至少8伤害"，只有进攻方才能触发）
    // excludeId = defenderId，防止防御方也进入响应队列
    const responderQueue = getResponderQueue(stateAfterAttack, 'afterAttackResolved', attackerId, undefined, defenderId, phase);
    if (responderQueue.length === 0) return null;

    return {
        type: 'RESPONSE_WINDOW_OPENED',
        payload: {
            windowId: `afterAttackResolved-${timestamp}`,
            responderQueue,
            windowType: 'afterAttackResolved',
        },
        sourceCommandType: commandType,
        timestamp,
    } as ResponseWindowOpenedEvent;
}

export const diceThroneFlowHooks: FlowHooks<DiceThroneCore> = {
    initialPhase: 'setup',

    canAdvance: ({ state }) => {
        const phase = state.sys.phase as TurnPhase;
        const ok = canAdvancePhase(state.core, phase);
        return ok ? { ok: true } : { ok: false, error: 'cannot_advance_phase' };
    },

    getCurrentPlayerId: ({ state }) => {
        const phase = state.sys.phase as TurnPhase;
        // 防御阶段由防御方推进，其他阶段由回合拥有者推进
        return phase === 'defensiveRoll'
            ? getRollerId(state.core, phase)
            : state.core.activePlayerId;
    },

    getNextPhase: ({ state }) => getNextPhase(state.core, state.sys.phase as TurnPhase),

    getActivePlayerId: ({ state, from, to, exitEvents }) => {
        // 特殊处理：discard 阶段退出后切换回合，此时需要返回下一位玩家
        // 因为 TURN_CHANGED 事件还未被 reduce
        if (from === 'discard') {
            return getNextPlayerId(state.core);
        }
        // 额外攻击触发：检查 exitEvents 中是否有 EXTRA_ATTACK_TRIGGERED
        // 注意：exitEvents 尚未 reduce 进 core，所以需要直接检查事件
        const extraAttackEvent = exitEvents?.find(e => e.type === 'EXTRA_ATTACK_TRIGGERED') as
            ExtraAttackTriggeredEvent | undefined;
        if (extraAttackEvent) {
            return extraAttackEvent.payload.attackerId;
        }
        // 额外攻击进行中（已 reduce 进 core 的情况，如从 offensiveRoll 进入 main2）
        if (state.core.extraAttackInProgress) {
            // 额外攻击结束（进入 main2）：恢复原回合活跃玩家
            if (to === 'main2') {
                return state.core.extraAttackInProgress.originalActivePlayerId;
            }
            // 额外攻击进行中：活跃玩家是额外攻击方
            return state.core.extraAttackInProgress.attackerId;
        }
        return state.core.activePlayerId;
    },

    onPhaseExit: ({ state, from, to, command, random }): PhaseExitResult | GameEvent[] | void => {
        const core = state.core;
        const events: GameEvent[] = [];
        const timestamp = typeof command.timestamp === 'number' ? command.timestamp : 0;

        // ========== upkeep 阶段退出：检查脑震荡状态 ==========
        if (from === 'upkeep' && to === 'income') {
            const player = core.players[core.activePlayerId];
            // 脑震荡 (concussion) — 跳过收入阶段并移除
            // 注意：必须在 onPhaseExit 中处理，onPhaseEnter 返回 GameEvent[] 无法跳过阶段
            const concussionStacks = player?.statusEffects[STATUS_IDS.CONCUSSION] ?? 0;
            if (concussionStacks > 0) {
                events.push({
                    type: 'STATUS_REMOVED',
                    payload: { targetId: core.activePlayerId, statusId: STATUS_IDS.CONCUSSION, stacks: concussionStacks },
                    sourceCommandType: command.type,
                    timestamp,
                } as DiceThroneEvent);
                return { events, overrideNextPhase: 'main1' };
            }
        }

        // ========== setup 阶段退出：初始化所有玩家角色数据 ==========
        if (from === 'setup') {
            const playerIds = Object.keys(core.players);
            const initEvents: GameEvent[] = [];

            // 教程/本地模式：自动为所有玩家选择默认角色
            const mode = getGameMode();
            const isTutorialMode = mode === 'tutorial';
            const isLocalMode = mode === 'local';

            if (isTutorialMode) {
                // 教学模式：双方默认选择僧侣（用于统一教程流程）
                if (!core.selectedCharacters['0'] || core.selectedCharacters['0'] === 'unselected') {
                    core.selectedCharacters['0'] = 'monk';
                }
                if (!core.selectedCharacters['1'] || core.selectedCharacters['1'] === 'unselected') {
                    core.selectedCharacters['1'] = 'monk';
                }
            }

            if (isLocalMode) {
                for (const pid of playerIds) {
                    const selected = core.selectedCharacters[pid];
                    if (!selected || selected === 'unselected') {
                        core.selectedCharacters[pid] = pid === '0' ? 'monk' : 'barbarian';
                    }
                }
            }

            for (const pid of playerIds) {
                const charId = core.selectedCharacters[pid];
                if (charId && charId !== 'unselected') {
                    initEvents.push({
                        type: 'HERO_INITIALIZED',
                        payload: {
                            playerId: pid,
                            characterId: charId as any,
                        },
                        sourceCommandType: command.type,
                        timestamp,
                    } as any);
                }
            }

            // 同时创建骰子（如果是首位玩家，通常使用他的角色骰子，或者由系统在 EnterRollPhase 时切换）
            // 初始骰子逻辑在进入 RollPhase 时会自动 resetDice
            
            if (initEvents.length > 0) {
                events.push(...initEvents);
            }
        }

        // ========== main1 阶段退出：检查击倒状态 ==========
        if (from === 'main1' && to === 'offensiveRoll') {
            const player = core.players[core.activePlayerId];
            const knockdownStacks = player?.statusEffects[STATUS_IDS.KNOCKDOWN] ?? 0;
            if (knockdownStacks > 0) {
                // 有击倒状态，跳过 offensiveRoll 并移除击倒
                const statusRemovedEvent: StatusRemovedEvent = {
                    type: 'STATUS_REMOVED',
                    payload: {
                        targetId: core.activePlayerId,
                        statusId: STATUS_IDS.KNOCKDOWN,
                        stacks: knockdownStacks,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(statusRemovedEvent);
                return { events, overrideNextPhase: 'main2' };
            }
            // 注意：眩晕 (stun) 不在此处处理。
            // stun 的规则是：进入 offensiveRoll 时移除 stun，但玩家仍需手动推进离开该阶段。
            // 因此 stun 在 onPhaseEnter(to=offensiveRoll) 中处理（只移除状态，不跳过阶段）。
        }

        // ========== offensiveRoll 阶段退出：攻击前处理 ==========
        if (from === 'offensiveRoll') {
            if (core.pendingAttack) {
                // 伤害已通过 Token 响应结算（autoContinue 重入），只执行 postDamage 效果
                if (core.pendingAttack.damageResolved) {
                    const postDamageEvents = resolvePostDamageEffects(core, random, timestamp);
                    events.push(...postDamageEvents);

                    // rollDie 等效果可能产生 BONUS_DICE_REROLL_REQUESTED，需要暂停让 UI 展示
                    const hasBonusDiceRerollOffDR = postDamageEvents.some(e => e.type === 'BONUS_DICE_REROLL_REQUESTED');
                    if (hasBonusDiceRerollOffDR) {
                        return { events, halt: true };
                    }

                    // 检查晕眩（daze）额外攻击（强制效果，优先于响应窗口）
                    const { dazeEvents, triggered } = checkDazeExtraAttack(
                        core, events, command.type, timestamp
                    );
                    if (triggered) {
                        events.push(...dazeEvents);
                        return { events, overrideNextPhase: 'offensiveRoll' };
                    }

                    // 攻击结算后响应窗口（如 card-dizzy：造成 ≥8 伤害后打出）
                    const afterAttackWindowOffDR = checkAfterAttackResponseWindow(core, events, command.type, timestamp, from as TurnPhase);
                    if (afterAttackWindowOffDR) {
                        events.push(afterAttackWindowOffDR);
                        return { events, halt: true };
                    }

                    return { events, overrideNextPhase: 'main2' };
                }

                // 奖励骰已通过 BONUS_DICE_SETTLED 结算（autoContinue 重入），
                // 伤害已由 SKIP_BONUS_DICE_REROLL 的 DAMAGE_DEALT 事件应用，
                // 只需生成 ATTACK_RESOLVED 并推进到 main2
                if (core.pendingAttack.bonusDiceResolved) {
                    const { attackerId, defenderId, sourceAbilityId, defenseAbilityId } = core.pendingAttack;
                    const totalDamage = core.pendingAttack.resolvedDamage ?? 0;
                    events.push({
                        type: 'ATTACK_RESOLVED',
                        payload: { attackerId, defenderId, sourceAbilityId, defenseAbilityId, totalDamage },
                        sourceCommandType: command.type,
                        timestamp,
                    } as AttackResolvedEvent);

                    const { dazeEvents, triggered } = checkDazeExtraAttack(
                        core, events, command.type, timestamp
                    );
                    if (triggered) {
                        events.push(...dazeEvents);
                        return { events, overrideNextPhase: 'offensiveRoll' };
                    }

                    const afterAttackWindowBD = checkAfterAttackResponseWindow(core, events, command.type, timestamp, from as TurnPhase);
                    if (afterAttackWindowBD) {
                        events.push(afterAttackWindowBD);
                        return { events, halt: true };
                    }

                    return { events, overrideNextPhase: 'main2' };
                }

                // ========== 致盲判定：攻击方有致盲时投掷1骰 ==========
                const attacker = core.players[core.pendingAttack.attackerId];
                const blindedStacks = attacker?.statusEffects[STATUS_IDS.BLINDED] ?? 0;
                if (blindedStacks > 0 && random) {
                    const blindedValue = random.d(6);
                    const blindedFace = getPlayerDieFace(core, core.pendingAttack.attackerId, blindedValue) ?? '';
                    events.push({
                        type: 'BONUS_DIE_ROLLED',
                        payload: { value: blindedValue, face: blindedFace, playerId: core.pendingAttack.attackerId, targetPlayerId: core.pendingAttack.attackerId, effectKey: 'bonusDie.effect.blinded' },
                        sourceCommandType: command.type,
                        timestamp,
                    } as any);
                    // 移除致盲状态
                    events.push({
                        type: 'STATUS_REMOVED',
                        payload: { targetId: core.pendingAttack.attackerId, statusId: STATUS_IDS.BLINDED, stacks: blindedStacks },
                        sourceCommandType: command.type,
                        timestamp,
                    } as any);
                    // 1-2：攻击失败，跳过攻击直接进入 main2
                    if (blindedValue <= 2) {
                        return { events, overrideNextPhase: 'main2' };
                    }
                }

                // ========== 潜行判定：防御方有潜行时跳过防御掷骰、免除伤害 ==========
                // 终极技能不可被任何方式回避（规则 §4.4）
                const defender = core.players[core.pendingAttack.defenderId];
                const sneakStacks = defender?.tokens[TOKEN_IDS.SNEAK] ?? 0;
                if (sneakStacks > 0 && !core.pendingAttack.isUltimate) {
                    // 消耗潜行标记
                    events.push({
                        type: 'TOKEN_CONSUMED',
                        payload: {
                            playerId: core.pendingAttack.defenderId,
                            tokenId: TOKEN_IDS.SNEAK,
                            amount: 1,
                            newTotal: sneakStacks - 1,
                        },
                        sourceCommandType: command.type,
                        timestamp,
                    } as TokenConsumedEvent);

                    // 处理 preDefense 效果（攻击方的非伤害效果仍然生效）
                    const preDefenseEventsSneak = resolveOffensivePreDefenseEffects(core, timestamp);
                    events.push(...preDefenseEventsSneak);

                    const hasSneakChoice = preDefenseEventsSneak.some((event) => event.type === 'CHOICE_REQUESTED');
                    if (hasSneakChoice) {
                        return { events, halt: true };
                    }

                    // 攻击仍视为"成功"——postDamage 效果（如 grantToken）仍需执行
                    const coreForPostDamage = preDefenseEventsSneak.length > 0
                        ? applyEvents(core, [...events] as DiceThroneEvent[], reduce)
                        : core;
                    const postDamageEventsSneak = resolvePostDamageEffects(coreForPostDamage, random, timestamp);
                    events.push(...postDamageEventsSneak);

                    return { events, overrideNextPhase: 'main2' };
                }

                // 处理进攻方的 preDefense 效果
                const preDefenseEvents = resolveOffensivePreDefenseEffects(core, timestamp);
                events.push(...preDefenseEvents);

                const hasChoice = preDefenseEvents.some((event) => event.type === 'CHOICE_REQUESTED');
                const hasBonusDiceRerollPreDefense = preDefenseEvents.some((event) => event.type === 'BONUS_DICE_REROLL_REQUESTED');
                if (hasChoice || hasBonusDiceRerollPreDefense) {
                    // 需要用户做选择或处理奖励骰重掷，阻止阶段切换
                    return { events, halt: true };
                }

                const coreAfterPreDefense = preDefenseEvents.length > 0
                    ? applyEvents(core, preDefenseEvents as DiceThroneEvent[], reduce)
                    : core;

                // ========== 攻击掷骰阶段结束时 Token 使用（暴击、精准） ==========
                // 检查攻击方是否有可用的 onOffensiveRollEnd 时机 Token
                const attackerId = core.pendingAttack.attackerId;
                const sourceAbilityId = core.pendingAttack.sourceAbilityId;
                const expectedDamage = sourceAbilityId 
                    ? getPlayerAbilityBaseDamage(coreAfterPreDefense, attackerId, sourceAbilityId) + (core.pendingAttack.bonusDamage ?? 0)
                    : 0;
                const offensiveRollEndTokens = getUsableTokensForOffensiveRollEnd(coreAfterPreDefense, attackerId, expectedDamage);
                
                // 检查是否已经处理过 Token 选择（避免重复询问）
                if (offensiveRollEndTokens.length > 0 && !core.pendingAttack.offensiveRollEndTokenResolved) {
                    // 创建选择事件让玩家选择是否使用 Token
                    const tokenOptions = offensiveRollEndTokens.map(def => ({
                        tokenId: def.id,
                        value: 1,
                        customId: `use-${def.id}`,
                        labelKey: `tokens.${def.id}.name`,
                    }));
                    // 添加跳过选项
                    tokenOptions.push({
                        tokenId: undefined as any,
                        value: 0,
                        customId: 'skip',
                        labelKey: 'tokenResponse.skip',
                    });
                    
                    const choiceEvent: ChoiceRequestedEvent = {
                        type: 'CHOICE_REQUESTED',
                        payload: {
                            playerId: attackerId,
                            sourceAbilityId: sourceAbilityId ?? 'offensive-roll-end-token',
                            titleKey: 'offensiveRollEndToken.title',
                            options: tokenOptions,
                        },
                        sourceCommandType: command.type,
                        timestamp,
                    };
                    events.push(choiceEvent);
                    return { events, halt: true };
                }

                if (core.pendingAttack.isDefendable) {
                    // 攻击可防御，切换到防御阶段
                    return { events, overrideNextPhase: 'defensiveRoll' };
                }

                // 攻击不可防御，直接结算
                const attackEvents = resolveAttack(coreAfterPreDefense, random, { includePreDefense: false }, timestamp);
                events.push(...attackEvents);

                const hasAttackChoice = attackEvents.some((event) => event.type === 'CHOICE_REQUESTED');
                const hasTokenResponse = attackEvents.some((event) => event.type === 'TOKEN_RESPONSE_REQUESTED');
                const hasBonusDiceRerollOff = attackEvents.some((event) => event.type === 'BONUS_DICE_REROLL_REQUESTED');
                if (hasAttackChoice || hasTokenResponse || hasBonusDiceRerollOff) {
                    return { events, halt: true };
                }

                // 检查晕眩（daze）额外攻击（强制效果，优先于响应窗口）
                const { dazeEvents: dazeEventsOff, triggered: dazeTriggeredOff } = checkDazeExtraAttack(
                    core, events, command.type, timestamp
                );
                if (dazeTriggeredOff) {
                    events.push(...dazeEventsOff);
                    return { events, overrideNextPhase: 'offensiveRoll' };
                }

                // 攻击结算后响应窗口（如 card-dizzy：造成 ≥8 伤害后打出）
                const afterAttackWindowOff = checkAfterAttackResponseWindow(core, events, command.type, timestamp, from as TurnPhase);
                if (afterAttackWindowOff) {
                    events.push(afterAttackWindowOff);
                    return { events, halt: true };
                }

                // 无待处理内容，直接进入 main2
                return { events, overrideNextPhase: 'main2' };
            }
            // 无 pendingAttack，直接进入 main2
            return { events, overrideNextPhase: 'main2' };
        }

        // ========== defensiveRoll 阶段退出 ==========
        if (from === 'defensiveRoll') {
            if (core.pendingAttack) {
                // 如果伤害已通过 Token 响应结算，只执行 postDamage 效果
                if (core.pendingAttack.damageResolved) {
                    // 执行 withDamage 剩余效果（跳过 damage）+ postDamage + ATTACK_RESOLVED
                    const postDamageEvents = resolvePostDamageEffects(core, random, timestamp);
                    events.push(...postDamageEvents);

                    // rollDie 等效果可能产生 BONUS_DICE_REROLL_REQUESTED，需要暂停让 UI 展示
                    const hasBonusDiceRerollPost = postDamageEvents.some(e => e.type === 'BONUS_DICE_REROLL_REQUESTED');
                    if (hasBonusDiceRerollPost) {
                        return { events, halt: true };
                    }

                    // 检查晕眩（daze）额外攻击（强制效果，优先于响应窗口）
                    const { dazeEvents: dazeEventsPost, triggered: dazeTriggeredPost } = checkDazeExtraAttack(
                        core, events, command.type, timestamp
                    );
                    if (dazeTriggeredPost) {
                        events.push(...dazeEventsPost);
                        return { events, overrideNextPhase: 'offensiveRoll' };
                    }

                    // 攻击结算后响应窗口（如 card-dizzy：造成 ≥8 伤害后打出）
                    const afterAttackWindow1 = checkAfterAttackResponseWindow(core, events, command.type, timestamp, from as TurnPhase);
                    if (afterAttackWindow1) {
                        events.push(afterAttackWindow1);
                        return { events, halt: true };
                    }

                    return { events, overrideNextPhase: 'main2' };
                }

                // 奖励骰已通过 BONUS_DICE_SETTLED 结算（autoContinue 重入），
                // 伤害已由 SKIP_BONUS_DICE_REROLL 的 DAMAGE_DEALT 事件应用，
                // 只需生成 ATTACK_RESOLVED 并推进到 main2
                if (core.pendingAttack.bonusDiceResolved) {
                    const { attackerId, defenderId, sourceAbilityId, defenseAbilityId } = core.pendingAttack;
                    const totalDamage = core.pendingAttack.resolvedDamage ?? 0;
                    events.push({
                        type: 'ATTACK_RESOLVED',
                        payload: { attackerId, defenderId, sourceAbilityId, defenseAbilityId, totalDamage },
                        sourceCommandType: command.type,
                        timestamp,
                    } as AttackResolvedEvent);

                    const { dazeEvents: dazeEventsPost, triggered: dazeTriggeredPost } = checkDazeExtraAttack(
                        core, events, command.type, timestamp
                    );
                    if (dazeTriggeredPost) {
                        events.push(...dazeEventsPost);
                        return { events, overrideNextPhase: 'offensiveRoll' };
                    }

                    const afterAttackWindowBD = checkAfterAttackResponseWindow(core, events, command.type, timestamp, from as TurnPhase);
                    if (afterAttackWindowBD) {
                        events.push(afterAttackWindowBD);
                        return { events, halt: true };
                    }

                    return { events, overrideNextPhase: 'main2' };
                }
                
                // 直接结算攻击
                const attackEvents = resolveAttack(core, random, undefined, timestamp);
                events.push(...attackEvents);

                const hasAttackChoice = attackEvents.some((event) => event.type === 'CHOICE_REQUESTED');
                const hasTokenResponse = attackEvents.some((event) => event.type === 'TOKEN_RESPONSE_REQUESTED');
                const hasBonusDiceReroll = attackEvents.some((event) => event.type === 'BONUS_DICE_REROLL_REQUESTED');
                if (hasAttackChoice || hasTokenResponse || hasBonusDiceReroll) {
                    return { events, halt: true };
                }

                // 检查晕眩（daze）额外攻击（强制效果，优先于响应窗口）
                const { dazeEvents: dazeEventsDef, triggered: dazeTriggeredDef } = checkDazeExtraAttack(
                    core, events, command.type, timestamp
                );
                if (dazeTriggeredDef) {
                    events.push(...dazeEventsDef);
                    return { events, overrideNextPhase: 'offensiveRoll' };
                }

                // 攻击结算后响应窗口（如 card-dizzy：造成 ≥8 伤害后打出）
                const afterAttackWindow2 = checkAfterAttackResponseWindow(core, events, command.type, timestamp, from as TurnPhase);
                if (afterAttackWindow2) {
                    events.push(afterAttackWindow2);
                    return { events, halt: true };
                }
            }
            // 显式指定下一阶段为 main2（无论是否有 pendingAttack）
            return { events, overrideNextPhase: 'main2' };
        }

        // ========== discard 阶段退出：潜行自动弃除 + 切换回合 ==========
        if (from === 'discard') {
            // 潜行自动弃除：经过一个完整的自己回合后，回合末弃除
            // 判定条件：sneakGainedTurn[playerId] < 当前 turnNumber（不是本回合获得的）
            const activeId = core.activePlayerId;
            const sneakStacks = core.players[activeId]?.tokens[TOKEN_IDS.SNEAK] ?? 0;
            if (sneakStacks > 0 && core.sneakGainedTurn?.[activeId] !== undefined) {
                const gainedTurn = core.sneakGainedTurn[activeId];
                if (gainedTurn < core.turnNumber) {
                    events.push({
                        type: 'TOKEN_CONSUMED',
                        payload: {
                            playerId: activeId,
                            tokenId: TOKEN_IDS.SNEAK,
                            amount: sneakStacks,
                            newTotal: 0,
                        },
                        sourceCommandType: command.type,
                        timestamp,
                    } as DiceThroneEvent);
                }
            }

            const nextPlayerId = getNextPlayerId(core);
            const turnEvent: TurnChangedEvent = {
                type: 'TURN_CHANGED',
                payload: {
                    previousPlayerId: core.activePlayerId,
                    nextPlayerId,
                    turnNumber: core.turnNumber + 1,
                },
                sourceCommandType: command.type,
                timestamp,
            };
            events.push(turnEvent);
        }

        if (events.length > 0) {
            return events;
        }
    },

    onAutoContinueCheck: ({ state, events }): { autoContinue: boolean; playerId: string } | void => {
        const core = state.core;
        const phase = state.sys.phase as TurnPhase;

        // ====== 1. setup 阶段：由特定事件门控（HOST_STARTED / PLAYER_READY） ======
        if (phase === 'setup') {
            const hasSetupGateEvent = events.some(e => e.type === 'HOST_STARTED' || e.type === 'PLAYER_READY');
            if (hasSetupGateEvent && canAdvancePhase(core, phase)) {
                return { autoContinue: true, playerId: core.activePlayerId };
            }
            return undefined;
        }

        // ====== 2. 纯自动阶段（upkeep/income）：进入后立即推进 ======
        // 通过 SYS_PHASE_CHANGED 事件检测刚进入该阶段，确保只在阶段切换时触发一次
        if (phase === 'upkeep' || phase === 'income') {
            const justEnteredPhase = events.some(
                e => e.type === 'SYS_PHASE_CHANGED' && (e as any).payload?.to === phase
            );
            if (justEnteredPhase && canAdvancePhase(core, phase)) {
                return { autoContinue: true, playerId: core.activePlayerId };
            }
            return undefined;
        }

        // ====== 3. 战斗阶段（offensiveRoll/defensiveRoll）：仅在 flowHalted 时自动推进 ======
        // onPhaseExit 因 TOKEN_RESPONSE / CHOICE / BONUS_DICE 而 halt 时，
        // FlowSystem 会设置 sys.flowHalted = true。
        // 当阻塞全部清除后重新尝试 ADVANCE_PHASE。
        // 卡牌效果中的 BONUS_DICE_SETTLED / CHOICE_RESOLVED 等不会设置 flowHalted，
        // 因此不会误触发阶段推进。
        if (phase === 'offensiveRoll' || phase === 'defensiveRoll') {
            if (!state.sys.flowHalted) return undefined;

            // 确认所有阻塞已清除
            const hasActiveInteraction = state.sys.interaction?.current !== undefined;
            const hasActiveResponseWindow = state.sys.responseWindow?.current !== undefined;
            // Token 响应窗口通过 pendingDamage 管理，需要等待玩家 USE_TOKEN 或 SKIP_TOKEN_RESPONSE
            const hasPendingDamage = core.pendingDamage !== null && core.pendingDamage !== undefined;
            
            // 检查是否需要等待 offensiveRollEnd Token 选择的 CHOICE_RESOLVED 被 reduce 进 core。
            //
            // 时序问题：SYS_INTERACTION_RESPOND 命令执行后，afterEvents 多轮迭代中：
            //   round N：DiceThroneEventSystem 产生 CHOICE_RESOLVED，FlowSystem 看到 SYS_INTERACTION_RESOLVED
            //            但 CHOICE_RESOLVED 在 round N 结束时才 reduce 进 core
            //   round N+1：CHOICE_RESOLVED 已 reduce，offensiveRollEndTokenResolved=true
            //
            // 因此：当 SYS_INTERACTION_RESOLVED 在 events 里，且 offensiveRoll 阶段有
            // pendingAttack 但 offensiveRollEndTokenResolved 还是 false 时，
            // 说明 CHOICE_RESOLVED 还没有被 reduce，需要等待下一轮。
            // 例外：dt:token-response 的 resolveInteraction 也产生 SYS_INTERACTION_RESOLVED，
            // 但此时 pendingAttack 为 null（已结算），不会误阻塞。
            const hasSysInteractionResolved = events.some(e => e.type === 'SYS_INTERACTION_RESOLVED');
            // 时序保护：当 SYS_INTERACTION_RESOLVED 在 events 里，且 offensiveRoll 阶段有
            // pendingAttack 时，说明本轮 DiceThroneEventSystem 可能产生了 CHOICE_RESOLVED，
            // 但该事件还没有被 reduce 进 core（reduce 在所有系统 afterEvents 执行完后才发生）。
            // 必须等待下一轮，确保 CHOICE_RESOLVED 的效果（如 isDefendable=false）已生效。
            //
            // 覆盖场景：
            //   - offensiveRollEnd Token 选择（CRIT/ACCURACY）→ offensiveRollEndTokenResolved=true
            //   - preDefense 选择（如莲花掌花费太极使攻击不可防御）→ isDefendable=false
            //
            // 例外：dt:token-response 的 resolveInteraction 也产生 SYS_INTERACTION_RESOLVED，
            // 但此时 pendingAttack 为 null（已结算），不会误阻塞。
            const pendingOffensiveTokenChoice = hasSysInteractionResolved
                && phase === 'offensiveRoll'
                && core.pendingAttack !== null
                && core.pendingAttack !== undefined
                && core.pendingAttack.offensiveRollEndTokenResolved !== true;
            
            if (!hasActiveInteraction && !hasActiveResponseWindow && !hasPendingDamage && !pendingOffensiveTokenChoice) {
                // autoContinue 的 playerId 必须与 getCurrentPlayerId 返回值一致，
                // 否则 FlowSystem.afterEvents 中的 player_mismatch 校验会拒绝推进。
                // defensiveRoll 阶段由防御方（getRollerId）推进，offensiveRoll 由进攻方推进。
                const autoContinuePlayerId = getRollerId(core, phase);
                return { autoContinue: true, playerId: autoContinuePlayerId };
            }
            return undefined;
        }

        // ====== 4. 玩家操作阶段（main1/main2/discard）：永不自动推进 ======
        // 这些阶段中的 BONUS_DICE_SETTLED / CHOICE_RESOLVED 等事件仅是卡牌效果的一部分，
        // 不应触发阶段推进。玩家必须手动点击 ADVANCE_PHASE。
        return undefined;
    },

    onPhaseEnter: ({ state, from, to, command, random }): GameEvent[] | void => {
        const core = state.core;
        const events: GameEvent[] = [];
        const timestamp = typeof command.timestamp === 'number' ? command.timestamp : 0;

        // ========== 进入 upkeep 阶段：结算维持阶段触发的状态效果 ==========
        // 规则 §3.1：结算所有在"维持阶段"触发的状态效果或被动能力
        // 注意：从 discard 进入 upkeep 时，TURN_CHANGED 事件尚未 reduce，
        // core.activePlayerId 仍是上一个玩家。需要通过 from 判断并获取正确的活跃玩家。
        // 从 setup 进入 upkeep 是游戏初始化转换，此时 HERO_INITIALIZED 尚未 reduce，
        // 玩家状态不完整且不可能有状态效果，跳过结算。
        if (to === 'upkeep' && from !== 'setup') {
            // 从 discard 过来意味着换人了，活跃玩家是下一位
            const activeId = from === 'discard'
                ? getNextPlayerId(core)
                : core.activePlayerId;
            const player = core.players[activeId];
            if (player?.statusEffects) {
                // 0. 火焰精通冷却 — 维持阶段移除 1 个火焰精通
                const fmCount = player.tokens?.[TOKEN_IDS.FIRE_MASTERY] ?? 0;
                if (fmCount > 0) {
                    events.push({
                        type: 'TOKEN_CONSUMED',
                        payload: {
                            playerId: activeId,
                            tokenId: TOKEN_IDS.FIRE_MASTERY,
                            amount: 1,
                            newTotal: fmCount - 1,
                        },
                        sourceCommandType: command.type,
                        timestamp,
                    } as DiceThroneEvent);
                }

                // 1. 燃烧 (burn) — 每层造成 1 点伤害，然后移除 1 层
                // 【已迁移到新伤害计算管线】
                const burnStacks = player.statusEffects[STATUS_IDS.BURN] ?? 0;
                if (burnStacks > 0) {
                    const damageCalc = createDamageCalculation({
                        source: { playerId: 'system', abilityId: 'upkeep-burn' },
                        target: { playerId: activeId },
                        baseDamage: burnStacks,
                        state: core,
                        timestamp,
                    });
                    const damageEvents = damageCalc.toEvents();
                    events.push(...damageEvents);
                    // 移除 1 层燃烧
                    events.push({
                        type: 'STATUS_REMOVED',
                        payload: { targetId: activeId, statusId: STATUS_IDS.BURN, stacks: 1 },
                        sourceCommandType: command.type,
                        timestamp,
                    } as DiceThroneEvent);
                }

                // 2. 中毒 (poison) — 每层造成 1 点伤害，持续效果（不自动移除层数）
                // 【已迁移到新伤害计算管线】
                const poisonStacks = player.statusEffects[STATUS_IDS.POISON] ?? 0;
                if (poisonStacks > 0) {
                    const damageCalc = createDamageCalculation({
                        source: { playerId: 'system', abilityId: 'upkeep-poison' },
                        target: { playerId: activeId },
                        baseDamage: poisonStacks,
                        state: core,
                        timestamp,
                    });
                    const damageEvents = damageCalc.toEvents();
                    events.push(...damageEvents);
                    // 持续效果：毒液层数不自动减少，只能通过净化等手段移除
                }
            }
        }

        // ========== 状态修复：检测并修复缺失手牌的玩家 ==========
        // 原因：旧版本的游戏状态可能在 HERO_INITIALIZED 事件添加前保存
        // 症状：玩家已选择角色但 hand/deck 为空
        if (to === 'income' || to === 'main1') {
            const playerIds = Object.keys(core.players);
            for (const pid of playerIds) {
                const player = core.players[pid];
                const charId = core.selectedCharacters[pid];

                // 检测条件：已选角色 + 手牌和牌库都为空
                if (charId && charId !== 'unselected'
                    && player.hand.length === 0
                    && player.deck.length === 0) {
                    // 生成 HERO_INITIALIZED 事件来修复状态
                    events.push({
                        type: 'HERO_INITIALIZED',
                        payload: {
                            playerId: pid,
                            characterId: charId as any,
                        },
                        sourceCommandType: command.type,
                        timestamp,
                    } as any);
                }
            }

            if (events.length > 0) {
                return events;
            }
        }

        // ========== 进入 defensiveRoll 阶段：自动选择唯一防御技能 ==========
        // 规则 §3.6 步骤 2：如果有多个防御技能，必须在掷骰前选择
        // 如果只有 1 个防御技能，自动选择并设置 rollDiceCount
        if (to === 'defensiveRoll' && core.pendingAttack) {
            const defenderId = core.pendingAttack.defenderId;
            const defender = core.players[defenderId];
            if (defender) {
                const defensiveAbilities = defender.abilities.filter(a => a.type === 'defensive');
                if (defensiveAbilities.length === 1) {
                    // 唯一防御技能，自动选择
                    const ability = defensiveAbilities[0];
                    const abilityId = ability.id;
                    const autoAbilityEvent: AbilityActivatedEvent = {
                        type: 'ABILITY_ACTIVATED',
                        payload: {
                            abilityId,
                            playerId: defenderId,
                            isDefense: true,
                        },
                        sourceCommandType: command.type,
                        timestamp,
                    };
                    events.push(autoAbilityEvent);
                }
                // 多个防御技能：等待玩家 SELECT_ABILITY 命令
            }
        }

        // ========== 进入 offensiveRoll 阶段：检查眩晕和缠绕状态 ==========
        if (to === 'offensiveRoll') {
            const player = core.players[core.activePlayerId];

            // 眩晕 (stun) — 进入 offensiveRoll 时移除，但不跳过阶段
            // 规则：有眩晕时玩家进入进攻掷骰阶段但无法掷骰（stun 被移除，玩家仍需手动推进）
            // 注意：不能在 onPhaseExit 中用 overrideNextPhase 跳过，因为测试期望两步推进：
            //   1. main1 → offensiveRoll（stun 移除）
            //   2. offensiveRoll → main2（无 pendingAttack，手动推进）
            const stunStacks = player?.statusEffects[STATUS_IDS.STUN] ?? 0;
            if (stunStacks > 0) {
                events.push({
                    type: 'STATUS_REMOVED',
                    payload: { targetId: core.activePlayerId, statusId: STATUS_IDS.STUN, stacks: stunStacks },
                    sourceCommandType: command.type,
                    timestamp,
                } as StatusRemovedEvent);
            }

            // 缠绕 (entangle) — 减少掷骰次数
            const entangleStacks = player?.statusEffects[STATUS_IDS.ENTANGLE] ?? 0;
            if (entangleStacks > 0) {
                // 缠绕：减少1次掷骰机会（3 -> 2）
                // 注意：onPhaseEnter 读到的 core.rollLimit 是旧阶段的值（如防御阶段的 1），
                // 而 PHASE_CHANGED 事件会在 reducer 中将 rollLimit 重置为 3。
                // 因此这里必须基于重置后的默认值 3 计算，而非读取旧的 core.rollLimit。
                const defaultOffensiveRollLimit = 3;
                const newLimit = defaultOffensiveRollLimit - 1; // 3 -> 2
                const delta = -1;
                events.push({
                    type: 'ROLL_LIMIT_CHANGED',
                    payload: { playerId: core.activePlayerId, delta, newLimit },
                    sourceCommandType: command.type,
                    timestamp,
                } as any);
                // 移除缠绕状态（一次性）
                events.push({
                    type: 'STATUS_REMOVED',
                    payload: { targetId: core.activePlayerId, statusId: STATUS_IDS.ENTANGLE, stacks: entangleStacks },
                    sourceCommandType: command.type,
                    timestamp,
                } as any);
            }
        }

        // ========== 进入 income 阶段：CP 和抽牌 ==========
        if (to === 'income') {
            const player = core.players[core.activePlayerId];
            if (player) {
                const cpDelta = 1;
                const cpResult = resourceSystem.modify(
                    player.resources,
                    RESOURCE_IDS.CP,
                    cpDelta
                );
                const cpEvent: CpChangedEvent = {
                    type: 'CP_CHANGED',
                    payload: {
                        playerId: core.activePlayerId,
                        delta: cpResult.actualDelta,
                        newValue: cpResult.newValue,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(cpEvent);

                // 抽牌（牌库为空则洗弃牌堆）
                events.push(
                    ...buildDrawEvents(core, core.activePlayerId, 1, random, command.type, timestamp)
                );
            }
        }

        if (events.length > 0) {
            return events;
        }
    },
};
