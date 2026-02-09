/**
 * DiceThrone 游戏定义（新引擎架构）
 * 
 * 使用领域内核 + 引擎适配器
 */

import type { ActionLogEntry, Command, GameEvent, MatchState, PlayerId } from '../../engine/types';
import {
    createGameAdapter,
    createActionLogSystem,
    createCheatSystem,
    createEventStreamSystem,
    createFlowSystem,
    createLogSystem,
    createPromptSystem,
    createRematchSystem,
    createResponseWindowSystem,
    createTutorialSystem,
    createUndoSystem,
    CHEAT_COMMANDS,
    UNDO_COMMANDS,
    type CheatResourceModifier,
    type FlowHooks,
    type PhaseExitResult,
} from '../../engine';
import { DiceThroneDomain } from './domain';
import { DICETHRONE_COMMANDS, STATUS_IDS } from './domain/ids';
import type { AbilityCard, DiceThroneCore, TurnPhase, DiceThroneEvent, CpChangedEvent, TurnChangedEvent, StatusRemovedEvent, AbilityActivatedEvent, ExtraAttackTriggeredEvent } from './domain/types';
import { createDiceThroneEventSystem } from './domain/systems';
import { canAdvancePhase, getNextPhase, getNextPlayerId } from './domain/rules';
import { resolveAttack, resolveOffensivePreDefenseEffects, resolvePostDamageEffects } from './domain/attack';
import { resourceSystem } from './domain/resourceSystem';
import { RESOURCE_IDS } from './domain/resources';
import { buildDrawEvents } from './domain/deckEvents';
import { reduce } from './domain/reducer';

import { getDieFace } from './domain/rules';
import { diceSystem } from '../../systems/DiceSystem';

// DiceThrone 作弊系统配置
const diceThroneCheatModifier: CheatResourceModifier<DiceThroneCore> = {
    getResource: (core, playerId, resourceId) => {
        return core.players[playerId]?.resources[resourceId];
    },
    setResource: (core, playerId, resourceId, value) => {
        const player = core.players[playerId];
        if (!player) return core;
        return {
            ...core,
            players: {
                ...core.players,
                [playerId]: {
                    ...player,
                    resources: {
                        ...player.resources,
                        [resourceId]: value,
                    },
                },
            },
        };
    },
    setStatus: (core, playerId, statusId, amount) => {
        const player = core.players[playerId];
        if (!player) return core;
        return {
            ...core,
            players: {
                ...core.players,
                [playerId]: {
                    ...player,
                    statusEffects: {
                        ...player.statusEffects,
                        [statusId]: amount,
                    },
                },
            },
        };
    },
    setPhase: (core, phase) => {
        return {
            ...core,
            turnPhase: phase as TurnPhase,
        };
    },
    setDice: (core, values) => {
        const newDice = core.dice.map((die, i) => {
            const value = values[i] ?? die.value;
            const faceDef = diceSystem.getFaceByValue(die.definitionId, value);
            const symbols = faceDef?.symbols ?? [];
            const fallbackFace = getDieFace(value);
            const primarySymbol = (symbols[0] ?? fallbackFace) as typeof fallbackFace;
            return {
                ...die,
                value,
                symbol: primarySymbol,
                symbols: symbols.length > 0 ? symbols : [primarySymbol],
            };
        });
        return {
            ...core,
            dice: newDice,
            rollCount: core.rollCount || 1, // 确保至少有一次 roll
            rollConfirmed: false, // 允许用户重新确认
        };
    },
    setToken: (core, playerId, tokenId, amount) => {
        const player = core.players[playerId];
        if (!player) return core;
        return {
            ...core,
            players: {
                ...core.players,
                [playerId]: {
                    ...player,
                    tokens: {
                        ...player.tokens,
                        [tokenId]: amount,
                    },
                },
            },
        };
    },
    dealCardByIndex: (core, playerId, deckIndex) => {
        const player = core.players[playerId];
        if (!player || deckIndex < 0 || deckIndex >= player.deck.length) return core;

        // 从牌库指定位置取出卡牌
        const newDeck = [...player.deck];
        const [card] = newDeck.splice(deckIndex, 1);

        return {
            ...core,
            players: {
                ...core.players,
                [playerId]: {
                    ...player,
                    deck: newDeck,
                    hand: [...player.hand, card],
                },
            },
        };
    },
    dealCardByAtlasIndex: (core, playerId, atlasIndex) => {
        const player = core.players[playerId];
        if (!player) return core;

        // 在牌库中查找具有指定 atlasIndex 的卡牌
        const deckIndex = player.deck.findIndex(
            (card) => card.previewRef?.type === 'atlas' && card.previewRef.index === atlasIndex
        );
        if (deckIndex === -1) return core;

        const newDeck = [...player.deck];
        const [card] = newDeck.splice(deckIndex, 1);

        return {
            ...core,
            players: {
                ...core.players,
                [playerId]: {
                    ...player,
                    deck: newDeck,
                    hand: [...player.hand, card],
                },
            },
        };
    },
};

// 辅助函数：应用事件到 core 状态
const applyEvents = (core: DiceThroneCore, events: DiceThroneEvent[]): DiceThroneCore => {
    return events.reduce((current, event) => reduce(current, event), core);
};

const now = () => Date.now();
type GameModeHost = { __BG_GAME_MODE__?: string };
const getGameMode = () => (
    typeof globalThis !== 'undefined'
        ? (globalThis as GameModeHost).__BG_GAME_MODE__
        : undefined
);

/**
 * 检查攻击方是否有晕眩（daze），如果有则生成额外攻击事件
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

// DiceThrone FlowHooks 实现（符合 openspec/changes/add-flow-system/design.md Decision 3）
// sys.phase 是阶段的单一权威来源，所有阶段副作用通过 FlowHooks 实现
const diceThroneFlowHooks: FlowHooks<DiceThroneCore> = {
    initialPhase: 'setup',

    canAdvance: ({ state }) => {
        const ok = canAdvancePhase(state.core);
        return ok ? { ok: true } : { ok: false, error: 'cannot_advance_phase' };
    },

    getNextPhase: ({ state }) => getNextPhase(state.core),

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
        const timestamp = now();

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
        }

        // ========== offensiveRoll 阶段退出：攻击前处理 ==========
        if (from === 'offensiveRoll') {
            if (core.pendingAttack) {
                // ========== 致盲判定：攻击方有致盲时投掷1骰 ==========
                const attacker = core.players[core.pendingAttack.attackerId];
                const blindedStacks = attacker?.statusEffects[STATUS_IDS.BLINDED] ?? 0;
                if (blindedStacks > 0 && random) {
                    const blindedValue = random.d(6);
                    const blindedFace = getDieFace(blindedValue);
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

                // 处理进攻方的 preDefense 效果
                const preDefenseEvents = resolveOffensivePreDefenseEffects(core);
                events.push(...preDefenseEvents);

                const hasChoice = preDefenseEvents.some((event) => event.type === 'CHOICE_REQUESTED');
                if (hasChoice) {
                    // 需要用户做选择，阻止阶段切换
                    return { events, halt: true };
                }

                const coreAfterPreDefense = preDefenseEvents.length > 0
                    ? applyEvents(core, preDefenseEvents as DiceThroneEvent[])
                    : core;

                if (core.pendingAttack.isDefendable) {
                    // 攻击可防御，切换到防御阶段
                    return { events, overrideNextPhase: 'defensiveRoll' };
                }

                // 攻击不可防御，直接结算
                const attackEvents = resolveAttack(coreAfterPreDefense, random, { includePreDefense: false });
                events.push(...attackEvents);

                const hasAttackChoice = attackEvents.some((event) => event.type === 'CHOICE_REQUESTED');
                const hasTokenResponse = attackEvents.some((event) => event.type === 'TOKEN_RESPONSE_REQUESTED');
                const hasBonusDiceRerollOff = attackEvents.some((event) => event.type === 'BONUS_DICE_REROLL_REQUESTED');
                if (hasAttackChoice || hasTokenResponse || hasBonusDiceRerollOff) {
                    return { events, halt: true };
                }

                // 检查晕眩（daze）额外攻击
                const { dazeEvents: dazeEventsOff, triggered: dazeTriggeredOff } = checkDazeExtraAttack(
                    core, events, command.type, timestamp
                );
                if (dazeTriggeredOff) {
                    events.push(...dazeEventsOff);
                    return { events, overrideNextPhase: 'offensiveRoll' };
                }

                // 无待处理内容，直接进入 main2
                return { events, overrideNextPhase: 'main2' };
            }
            // 无 pendingAttack，直接进入 main2
            return { events, overrideNextPhase: 'main2' };
        }

        // ========== defensiveRoll 阶段退出 ==========
        // 设计原则：不做"最后机会"响应窗口，玩家想打牌应在防御阶段主动打出
        if (from === 'defensiveRoll') {
            if (core.pendingAttack) {
                // 如果伤害已通过 Token 响应结算，只执行 postDamage 效果
                if (core.pendingAttack.damageResolved) {
                    // 执行 postDamage 效果（如击倒）并生成 ATTACK_RESOLVED 事件
                    const postDamageEvents = resolvePostDamageEffects(core, random);
                    events.push(...postDamageEvents);

                    // 检查晕眩（daze）额外攻击
                    const { dazeEvents: dazeEventsPost, triggered: dazeTriggeredPost } = checkDazeExtraAttack(
                        core, events, command.type, timestamp
                    );
                    if (dazeTriggeredPost) {
                        events.push(...dazeEventsPost);
                        return { events, overrideNextPhase: 'offensiveRoll' };
                    }

                    return { events, overrideNextPhase: 'main2' };
                }
                
                // 直接结算攻击
                const attackEvents = resolveAttack(core, random);
                events.push(...attackEvents);

                const hasAttackChoice = attackEvents.some((event) => event.type === 'CHOICE_REQUESTED');
                const hasTokenResponse = attackEvents.some((event) => event.type === 'TOKEN_RESPONSE_REQUESTED');
                const hasBonusDiceReroll = attackEvents.some((event) => event.type === 'BONUS_DICE_REROLL_REQUESTED');
                if (hasAttackChoice || hasTokenResponse || hasBonusDiceReroll) {
                    return { events, halt: true };
                }

                // 检查晕眩（daze）额外攻击
                const { dazeEvents: dazeEventsDef, triggered: dazeTriggeredDef } = checkDazeExtraAttack(
                    core, events, command.type, timestamp
                );
                if (dazeTriggeredDef) {
                    events.push(...dazeEventsDef);
                    return { events, overrideNextPhase: 'offensiveRoll' };
                }
            }
            // 显式指定下一阶段为 main2（无论是否有 pendingAttack）
            return { events, overrideNextPhase: 'main2' };
        }

        // ========== discard 阶段退出：切换回合 ==========
        if (from === 'discard') {
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

        // setup 阶段：房主开始或玩家准备后，若满足条件则自动推进
        if (core.turnPhase === 'setup') {
            const hasSetupGateEvent = events.some(e => e.type === 'HOST_STARTED' || e.type === 'PLAYER_READY');
            if (hasSetupGateEvent && canAdvancePhase(core)) {
                return { autoContinue: true, playerId: core.activePlayerId };
            }
        }

        // 检查是否有需要自动继续的事件
        const hasTokenResponseClosed = events.some(e => e.type === 'TOKEN_RESPONSE_CLOSED');
        const hasChoiceResolved = events.some(e => e.type === 'CHOICE_RESOLVED');
        const hasBonusDiceSettled = events.some(e => e.type === 'BONUS_DICE_SETTLED');

        // 如果有这些事件，且没有其他阻塞条件，则自动继续
        if (hasTokenResponseClosed || hasChoiceResolved || hasBonusDiceSettled) {
            // 检查是否有阻塞条件
            const hasActivePrompt = state.sys.prompt?.current !== undefined;
            const hasActiveResponseWindow = state.sys.responseWindow?.current !== undefined;
            const hasPendingInteraction = core.pendingInteraction !== undefined;
            const hasPendingDamage = core.pendingDamage !== undefined;
            const hasPendingBonusDice = core.pendingBonusDiceSettlement !== undefined;

            // 只有在没有其他阻塞条件时才自动继续
            if (!hasActivePrompt && !hasActiveResponseWindow && !hasPendingInteraction && !hasPendingDamage && !hasPendingBonusDice) {
                return {
                    autoContinue: true,
                    playerId: core.activePlayerId,
                };
            }
        }

        return undefined;
    },

    onPhaseEnter: ({ state, from, to, command, random }): GameEvent[] | void => {
        const core = state.core;
        const events: GameEvent[] = [];
        const timestamp = now();

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
                // 1. 燃烧 (burn) — 每层造成 1 点伤害，然后移除 1 层
                const burnStacks = player.statusEffects[STATUS_IDS.BURN] ?? 0;
                if (burnStacks > 0) {
                    const burnDamage = burnStacks; // 每层 1 点
                    const currentHp = player.resources[RESOURCE_IDS.HP] ?? 0;
                    const actualDamage = Math.min(burnDamage, currentHp);
                    events.push({
                        type: 'DAMAGE_DEALT',
                        payload: {
                            targetId: activeId,
                            amount: burnDamage,
                            actualDamage,
                            sourceAbilityId: 'upkeep-burn',
                            type: 'undefendable',
                        },
                        sourceCommandType: command.type,
                        timestamp,
                    } as DiceThroneEvent);
                    // 移除 1 层燃烧
                    events.push({
                        type: 'STATUS_REMOVED',
                        payload: { targetId: activeId, statusId: STATUS_IDS.BURN, stacks: 1 },
                        sourceCommandType: command.type,
                        timestamp,
                    } as DiceThroneEvent);
                }

                // 2. 中毒 (poison) — 每层造成 1 点伤害，然后移除 1 层
                const poisonStacks = player.statusEffects[STATUS_IDS.POISON] ?? 0;
                if (poisonStacks > 0) {
                    const poisonDamage = poisonStacks; // 每层 1 点
                    const currentHp = player.resources[RESOURCE_IDS.HP] ?? 0;
                    // 需要考虑 burn 已经造成的伤害
                    const hpAfterBurn = currentHp - (burnStacks > 0 ? Math.min(burnStacks, currentHp) : 0);
                    const actualDamage = Math.min(poisonDamage, Math.max(0, hpAfterBurn));
                    events.push({
                        type: 'DAMAGE_DEALT',
                        payload: {
                            targetId: activeId,
                            amount: poisonDamage,
                            actualDamage,
                            sourceAbilityId: 'upkeep-poison',
                            type: 'undefendable',
                        },
                        sourceCommandType: command.type,
                        timestamp,
                    } as DiceThroneEvent);
                    // 移除 1 层中毒
                    events.push({
                        type: 'STATUS_REMOVED',
                        payload: { targetId: activeId, statusId: STATUS_IDS.POISON, stacks: 1 },
                        sourceCommandType: command.type,
                        timestamp,
                    } as DiceThroneEvent);
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

            // 眩晕 (stun) — 跳过进攻掷骰阶段并移除
            const stunStacks = player?.statusEffects[STATUS_IDS.STUN] ?? 0;
            if (stunStacks > 0) {
                events.push({
                    type: 'STATUS_REMOVED',
                    payload: { targetId: core.activePlayerId, statusId: STATUS_IDS.STUN, stacks: stunStacks },
                    sourceCommandType: command.type,
                    timestamp,
                } as DiceThroneEvent);
                // 返回事件但不阻止阶段推进（FlowSystem 会继续到下一阶段）
                return events;
            }

            // 缠绕 (entangle) — 减少掷骰次数
            const entangleStacks = player?.statusEffects[STATUS_IDS.ENTANGLE] ?? 0;
            if (entangleStacks > 0) {
                // 缠绕：减少1次掷骰机会（3 -> 2）
                const currentLimit = core.rollLimit ?? 3;
                const newLimit = Math.max(0, currentLimit - 1);
                const delta = newLimit - currentLimit;
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

        // ========== 进入 income 阶段：脑震荡检查 + CP 和抽牌 ==========
        if (to === 'income') {
            const player = core.players[core.activePlayerId];
            if (player) {
                // 脑震荡 (concussion) — 跳过收入阶段并移除
                const concussionStacks = player.statusEffects[STATUS_IDS.CONCUSSION] ?? 0;
                if (concussionStacks > 0) {
                    events.push({
                        type: 'STATUS_REMOVED',
                        payload: { targetId: core.activePlayerId, statusId: STATUS_IDS.CONCUSSION, stacks: concussionStacks },
                        sourceCommandType: command.type,
                        timestamp,
                    } as DiceThroneEvent);
                    // 跳过收入（不获得 CP 和抽牌）
                    return events;
                }

                // CP +1（使用 ResourceSystem 处理上限）
                const cpResult = resourceSystem.modify(
                    player.resources,
                    RESOURCE_IDS.CP,
                    1
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

// 导出 FlowHooks 供测试使用
export { diceThroneFlowHooks };

// ============================================================================
// ActionLog 共享白名单 + 格式化
// ============================================================================

const ACTION_ALLOWLIST = [
    'PLAY_CARD',
    'PLAY_UPGRADE_CARD',
    // 注意：阶段推进属于明确的规则行为，允许撤回 + 记录。
    'ADVANCE_PHASE',
] as const;

function formatDiceThroneActionEntry({
    command,
    state,
    events,
}: {
    command: Command;
    state: MatchState<unknown>;
    events: GameEvent[];
}): ActionLogEntry | null {
    const core = (state as MatchState<DiceThroneCore>).core;
    const timestamp = command.timestamp ?? Date.now();

    if (command.type === 'PLAY_CARD' || command.type === 'PLAY_UPGRADE_CARD') {
        const cardId = (command.payload as { cardId: string }).cardId;
        const card = findDiceThroneCard(core, cardId, command.playerId);
        if (!card || !card.previewRef) return null;

        const actionText = command.type === 'PLAY_UPGRADE_CARD' ? '打出升级卡 ' : '打出卡牌 ';

        return {
            id: `${command.type}-${command.playerId}-${timestamp}`,
            timestamp,
            actorId: command.playerId,
            kind: command.type,
            segments: [
                { type: 'text', text: actionText },
                {
                    type: 'card',
                    cardId: card.id,
                    previewText: card.name,
                },
            ],
        };
    }

    if (command.type === 'ADVANCE_PHASE') {
        const phaseChanged = [...events]
            .reverse()
            .find(event => event.type === 'SYS_PHASE_CHANGED') as
            | { payload?: { to?: string } }
            | undefined;
        const nextPhase = phaseChanged?.payload?.to ?? getNextPhase(core);
        const phaseLabel = nextPhase ? `推进阶段：${nextPhase}` : '推进阶段';
        return {
            id: `${command.type}-${command.playerId}-${timestamp}`,
            timestamp,
            actorId: command.playerId,
            kind: command.type,
            segments: [{ type: 'text', text: phaseLabel }],
        };
    }

    return null;
}

function findDiceThroneCard(
    core: DiceThroneCore,
    cardId: string,
    playerId?: PlayerId
): AbilityCard | undefined {
    if (playerId && core.players[playerId]) {
        const player = core.players[playerId];
        return (
            player.hand.find(card => card.id === cardId)
            ?? player.deck.find(card => card.id === cardId)
            ?? player.discard.find(card => card.id === cardId)
        );
    }

    for (const player of Object.values(core.players)) {
        const found = player.hand.find(card => card.id === cardId)
            ?? player.deck.find(card => card.id === cardId)
            ?? player.discard.find(card => card.id === cardId);
        if (found) return found;
    }

    return undefined;
}

// 创建系统集合（默认系统 + FlowSystem + DiceThrone 专用系统 + 作弊系统）
// FlowSystem 配置由 FlowHooks 提供，符合设计规范
// 注意：撤销快照保留 1 个 + 极度缩减日志（maxEntries: 20）以避免 MongoDB 16MB 限制
const systems = [
    createFlowSystem<DiceThroneCore>({ hooks: diceThroneFlowHooks }),
    createEventStreamSystem(),
    createLogSystem({ maxEntries: 20 }),  // 极度减少，不考虑回放
    createActionLogSystem({
        commandAllowlist: ACTION_ALLOWLIST,
        formatEntry: formatDiceThroneActionEntry,
    }),
    createUndoSystem({
        maxSnapshots: 10,
        // 只对白名单命令做撤回快照，避免 UI/系统行为导致“一进局就可撤回”。
        snapshotCommandAllowlist: ACTION_ALLOWLIST,
    }),
    createPromptSystem(),
    createRematchSystem(),
    createResponseWindowSystem(),
    createTutorialSystem(),
    createDiceThroneEventSystem(),
    createCheatSystem<DiceThroneCore>(diceThroneCheatModifier),
];

// 导出系统配置供测试使用
export { systems as diceThroneSystemsForTest };

// 所有业务命令类型（必须显式列出才能生成可枚举 moves）
const COMMAND_TYPES = [
    // 骰子操作
    'ROLL_DICE',
    'TOGGLE_DIE_LOCK',
    'CONFIRM_ROLL',
    // 技能选择
    'SELECT_ABILITY',
    // 卡牌操作
    'DRAW_CARD',
    'DISCARD_CARD',
    'SELL_CARD',
    'UNDO_SELL_CARD',
    'REORDER_CARD_TO_END',
    'PLAY_CARD',
    'PLAY_UPGRADE_CARD',
    // 选择与阶段
    'RESOLVE_CHOICE',
    'ADVANCE_PHASE',
    // 响应窗口
    'RESPONSE_PASS',
    // 卡牌交互（骰子修改、状态移除/转移）
    'MODIFY_DIE',
    'REROLL_DIE',
    'REMOVE_STATUS',
    'TRANSFER_STATUS',
    'CONFIRM_INTERACTION',
    'CANCEL_INTERACTION',
    // 选角相关
    'SELECT_CHARACTER',
    'HOST_START_GAME',
    'PLAYER_READY',
    // Token 响应系统
    'USE_TOKEN',
    'SKIP_TOKEN_RESPONSE',
    'USE_PURIFY',
    // 击倒移除
    DICETHRONE_COMMANDS.PAY_TO_REMOVE_KNOCKDOWN,
    // 奖励骰重掷
    'REROLL_BONUS_DIE',
    'SKIP_BONUS_DICE_REROLL',
    // 撤回系统命令
    UNDO_COMMANDS.REQUEST_UNDO,
    UNDO_COMMANDS.APPROVE_UNDO,
    UNDO_COMMANDS.REJECT_UNDO,
    UNDO_COMMANDS.CANCEL_UNDO,
    // 作弊系统命令（仅开发模式）
    CHEAT_COMMANDS.SET_RESOURCE,
    CHEAT_COMMANDS.ADD_RESOURCE,
    CHEAT_COMMANDS.SET_PHASE,
    CHEAT_COMMANDS.SET_DICE,
    CHEAT_COMMANDS.SET_TOKEN,
    CHEAT_COMMANDS.SET_STATUS,
    CHEAT_COMMANDS.DEAL_CARD_BY_INDEX,
    CHEAT_COMMANDS.DEAL_CARD_BY_ATLAS_INDEX,
    CHEAT_COMMANDS.SET_STATE,
    CHEAT_COMMANDS.MERGE_STATE,
];

// 使用适配器创建 Boardgame.io Game
export const DiceThroneGame = createGameAdapter({
    domain: DiceThroneDomain,
    systems,
    minPlayers: 2,
    maxPlayers: 2, // 固定 2 人游戏
    commandTypes: COMMAND_TYPES,
});

export default DiceThroneGame;

// 注册卡牌预览获取函数
import { registerCardPreviewGetter } from '../../components/game/cardPreviewRegistry';
import { getDiceThroneCardPreviewRef } from './ui/cardPreviewHelper';
registerCardPreviewGetter('dicethrone', getDiceThroneCardPreviewRef);

// 导出类型（兼容）
export type { DiceThroneCore } from './domain';
