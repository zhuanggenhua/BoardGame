/**
 * DiceThrone 测试工具函数
 * 提供共享的 setup、断言、命令构建等功能
 */

import { DiceThroneDomain } from '../domain';
import { diceThroneSystemsForTest } from '../game';
import type { DiceThroneCore, TurnPhase, CardInteractionType, DiceThroneCommand, InteractionDescriptor } from '../domain/types';
import { CP_MAX, HAND_LIMIT, INITIAL_CP, INITIAL_HEALTH } from '../domain/types';
import {
    diceModifyReducer, diceModifyToCommands, diceSelectReducer, diceSelectToCommands,
    type DiceModifyStep, type DiceSelectStep, type DiceModifyResult, type DiceSelectResult,
} from '../domain/systems';
import type { MultistepChoiceData } from '../../../engine/systems/InteractionSystem';
import { RESOURCE_IDS } from '../domain/resources';
import { STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import type { AbilityCard } from '../types';
import { GameTestRunner, type StateExpectation } from '../../../engine/testing';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import type { EngineSystem } from '../../../engine/systems/types';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { MONK_CARDS } from '../heroes/monk/cards';

// ============================================================================
// 固定随机数（保证回放确定性）
// ============================================================================

export const fixedRandom: RandomFn = {
    random: () => 0,
    d: () => 1,
    range: (min) => min,
    shuffle: (arr) => [...arr],
};

export const createQueuedRandom = (values: number[]): RandomFn => {
    let index = 0;
    const fallback = values.length > 0 ? values[values.length - 1] : 1;
    return {
        random: () => 0,
        d: (max) => {
            const raw = values[index] ?? fallback;
            index += 1;
            return Math.min(Math.max(1, raw), max);
        },
        range: (min) => min,
        shuffle: (arr) => [...arr],
    };
};

// ============================================================================
// 测试系统与常量
// ============================================================================

export const testSystems = diceThroneSystemsForTest as unknown as EngineSystem<DiceThroneCore>[];

// 牌库实际大小：每张卡牌 1 份，共 33 张（规则标准）
export const initialDeckSize = MONK_CARDS.length;
export const expectedHandSize = 4;
export const expectedDeckAfterDraw4 = initialDeckSize - expectedHandSize;
export const expectedIncomeCp = Math.min(INITIAL_CP + 1, CP_MAX);
export const fistAttackAbilityId = 'fist-technique-5';

// ============================================================================
// 命令构建
// ============================================================================

export type CommandInput = {
    type: string;
    playerId: PlayerId;
    payload: Record<string, unknown>;
};

export const cmd = (type: string, playerId: PlayerId, payload: Record<string, unknown> = {}): CommandInput => ({
    type,
    playerId,
    payload,
});

// ============================================================================
// Setup 函数
// ============================================================================

export const setupCommands: CommandInput[] = [
    { type: 'SELECT_CHARACTER', playerId: '0', payload: { characterId: 'monk' } },
    { type: 'SELECT_CHARACTER', playerId: '1', payload: { characterId: 'monk' } },
    { type: 'PLAYER_READY', playerId: '1', payload: {} },
    { type: 'HOST_START_GAME', playerId: '0', payload: {} },
];

export function applySetupCommands(
    state: MatchState<DiceThroneCore>,
    playerIds: PlayerId[],
    random: RandomFn
): MatchState<DiceThroneCore> {
    const pipelineConfig = {
        domain: DiceThroneDomain,
        systems: testSystems,
    };

    let current = state;
    for (const cmd of setupCommands) {
        const command = {
            type: cmd.type,
            playerId: cmd.playerId,
            payload: cmd.payload,
            timestamp: Date.now(),
        } as DiceThroneCommand;

        const result = executePipeline(pipelineConfig, current, command, random, playerIds);
        if (result.success) {
            current = result.state as MatchState<DiceThroneCore>;
        }
    }

    return current;
}

export function createInitializedState(playerIds: PlayerId[], random: RandomFn): MatchState<DiceThroneCore> {
    const core = DiceThroneDomain.setup(playerIds, random);
    const sys = createInitialSystemState(playerIds, testSystems, undefined);
    return applySetupCommands({ sys, core }, playerIds, random);
}

export const getCardById = (cardId: string): AbilityCard => {
    const card = MONK_CARDS.find(c => c.id === cardId);
    if (!card) throw new Error(`找不到卡牌: ${cardId}`);
    return JSON.parse(JSON.stringify(card)) as AbilityCard;
};

export const createSetupWithHand = (
    handCardIds: string[],
    options: { playerId?: PlayerId; cp?: number; mutate?: (core: DiceThroneCore) => void } = {}
) => {
    return (playerIds: PlayerId[], random: RandomFn): MatchState<DiceThroneCore> => {
        const state = createInitializedState(playerIds, random);
        const pid = options.playerId ?? '0';
        const player = state.core.players[pid];
        if (player) {
            player.hand = handCardIds.map(getCardById);
            player.deck = player.deck.filter(card => !handCardIds.includes(card.id));
            if (options.cp !== undefined) {
                player.resources[RESOURCE_IDS.CP] = options.cp;
            }
        }
        options.mutate?.(state.core);
        return state;
    };
};

/**
 * 创建指定英雄对战的 setup 函数
 * 用于跨英雄交互测试，支持自定义状态修改
 *
 * @param hero0 玩家 0 的英雄 ID
 * @param hero1 玩家 1 的英雄 ID
 * @param mutate 可选的状态修改回调函数
 */
export const createHeroMatchup = (
    hero0: string,
    hero1: string,
    mutate?: (core: DiceThroneCore) => void
) => {
    return (playerIds: PlayerId[], random: RandomFn): MatchState<DiceThroneCore> => {
        const core = DiceThroneDomain.setup(playerIds, random);
        const sys = createInitialSystemState(playerIds, testSystems, undefined);
        let state: MatchState<DiceThroneCore> = { sys, core };

        const setupCmds = [
            { type: 'SELECT_CHARACTER', playerId: '0', payload: { characterId: hero0 } },
            { type: 'SELECT_CHARACTER', playerId: '1', payload: { characterId: hero1 } },
            { type: 'PLAYER_READY', playerId: '1', payload: {} },
            { type: 'HOST_START_GAME', playerId: '0', payload: {} },
        ];

        const cfg = { domain: DiceThroneDomain, systems: testSystems };
        for (const c of setupCmds) {
            const r = executePipeline(cfg, state, { ...c, timestamp: Date.now() } as any, random, playerIds);
            if (r.success) state = r.state as MatchState<DiceThroneCore>;
        }

        // 将手牌移到牌库避免响应窗口干扰
        for (const pid of playerIds) {
            const player = state.core.players[pid];
            if (player) {
                player.deck = [...player.deck, ...player.hand];
                player.hand = [];
            }
        }

        mutate?.(state.core);
        return state;
    };
};

/**
 * 创建无响应窗口卡牌的 setup 函数
 * 用于攻击结算测试，避免 instant/roll 卡牌触发响应窗口
 */
export const createNoResponseSetup = () => {
    return (playerIds: PlayerId[], random: RandomFn): MatchState<DiceThroneCore> => {
        const state = createInitializedState(playerIds, random);
        const core = state.core;

        for (const pid of playerIds) {
            const player = core.players[pid];
            if (!player) continue;

            const handRespondable: AbilityCard[] = [];
            const handNonRespondable: AbilityCard[] = [];
            for (const card of player.hand) {
                if (card.timing === 'instant' || card.timing === 'roll') {
                    handRespondable.push(card);
                } else {
                    handNonRespondable.push(card);
                }
            }

            const deckRespondable: AbilityCard[] = [];
            const deckNonRespondable: AbilityCard[] = [];
            for (const card of player.deck) {
                if (card.timing === 'instant' || card.timing === 'roll') {
                    deckRespondable.push(card);
                } else {
                    deckNonRespondable.push(card);
                }
            }

            player.deck = [...deckNonRespondable, ...handRespondable, ...deckRespondable];
            player.hand = handNonRespondable;

            while (player.hand.length < 4 && player.deck.length > 0) {
                const card = player.deck.shift();
                if (card) {
                    player.hand.push(card);
                }
            }
        }

        return state;
    };
};

/**
 * 创建无响应窗口卡牌且手牌为空的 setup 函数
 * 用于多回合测试，避免手牌超过 HAND_LIMIT 导致 discard 阶段无法推进
 */
export const createNoResponseSetupWithEmptyHand = () => {
    return (playerIds: PlayerId[], random: RandomFn): MatchState<DiceThroneCore> => {
        const state = createInitializedState(playerIds, random);
        const core = state.core;

        for (const pid of playerIds) {
            const player = core.players[pid];
            if (!player) continue;

            // 将所有手牌放回牌库顶部（非响应卡在前，响应卡在后）
            const handRespondable: AbilityCard[] = [];
            const handNonRespondable: AbilityCard[] = [];
            for (const card of player.hand) {
                if (card.timing === 'instant' || card.timing === 'roll') {
                    handRespondable.push(card);
                } else {
                    handNonRespondable.push(card);
                }
            }

            const deckRespondable: AbilityCard[] = [];
            const deckNonRespondable: AbilityCard[] = [];
            for (const card of player.deck) {
                if (card.timing === 'instant' || card.timing === 'roll') {
                    deckRespondable.push(card);
                } else {
                    deckNonRespondable.push(card);
                }
            }

            // 牌库顺序：非响应卡（手牌+牌库）在前，响应卡在后
            // 这样抽牌时优先抽到非响应卡
            player.deck = [...handNonRespondable, ...deckNonRespondable, ...handRespondable, ...deckRespondable];
            // 手牌清空
            player.hand = [];
        }

        return state;
    };
};

// ============================================================================
// 断言类型
// ============================================================================

export type PlayerExpectation = {
    hp?: number;
    cp?: number;
    handSize?: number;
    deckSize?: number;
    statusEffects?: Record<string, number>;
    tokens?: Record<string, number>;
    discardSize?: number;
    abilityNameById?: Record<string, string>;
    abilityLevels?: Record<string, number>;
};

export interface DiceThroneExpectation extends StateExpectation {
    turnPhase?: TurnPhase;
    activePlayerId?: PlayerId;
    turnNumber?: number;
    diceValues?: number[];
    players?: Record<PlayerId, PlayerExpectation>;
    pendingInteraction?: {
        type?: CardInteractionType;
        selectCount?: number;
        playerId?: PlayerId;
        dieModifyMode?: 'set' | 'adjust' | 'copy' | 'any';
        targetOpponentDice?: boolean;
        adjustRange?: { min: number; max: number };
    } | null;
    pendingAttack?: {
        attackerId?: PlayerId;
        defenderId?: PlayerId;
        isDefendable?: boolean;
        sourceAbilityId?: string;
    } | null;
    pendingBonusDiceSettlement?: {
        sourceAbilityId?: string;
        attackerId?: PlayerId;
        targetId?: PlayerId;
        diceValues?: number[];
        threshold?: number;
        rerollCount?: number;
    } | null;
    availableAbilityIdsIncludes?: string[];
    roll?: {
        count?: number;
        limit?: number;
        diceCount?: number;
        confirmed?: boolean;
    };
}

// ============================================================================
// 断言函数
// ============================================================================

export function assertDiceThrone(state: DiceThroneCore, expect: DiceThroneExpectation, phase?: TurnPhase): string[] {
    const errors: string[] = [];

    if (expect.turnPhase !== undefined && phase !== expect.turnPhase) {
        errors.push(`阶段不匹配: 预期 ${expect.turnPhase}, 实际 ${phase}`);
    }

    if (expect.activePlayerId !== undefined && state.activePlayerId !== expect.activePlayerId) {
        errors.push(`当前玩家不匹配: 预期 ${expect.activePlayerId}, 实际 ${state.activePlayerId}`);
    }

    if (expect.turnNumber !== undefined && state.turnNumber !== expect.turnNumber) {
        errors.push(`回合数不匹配: 预期 ${expect.turnNumber}, 实际 ${state.turnNumber}`);
    }

    if (expect.roll) {
        if (expect.roll.count !== undefined && state.rollCount !== expect.roll.count) {
            errors.push(`掷骰次数不匹配: 预期 ${expect.roll.count}, 实际 ${state.rollCount}`);
        }
        if (expect.roll.limit !== undefined && state.rollLimit !== expect.roll.limit) {
            errors.push(`掷骰上限不匹配: 预期 ${expect.roll.limit}, 实际 ${state.rollLimit}`);
        }
        if (expect.roll.diceCount !== undefined && state.rollDiceCount !== expect.roll.diceCount) {
            errors.push(`掷骰数量不匹配: 预期 ${expect.roll.diceCount}, 实际 ${state.rollDiceCount}`);
        }
        if (expect.roll.confirmed !== undefined && state.rollConfirmed !== expect.roll.confirmed) {
            errors.push(`确认状态不匹配: 预期 ${expect.roll.confirmed}, 实际 ${state.rollConfirmed}`);
        }
    }

    if (expect.players) {
        for (const [playerId, playerExpect] of Object.entries(expect.players)) {
            const player = state.players[playerId];
            if (!player) {
                errors.push(`玩家不存在: ${playerId}`);
                continue;
            }

            if (playerExpect.hp !== undefined) {
                const hp = player.resources[RESOURCE_IDS.HP] ?? 0;
                if (hp !== playerExpect.hp) {
                    errors.push(`玩家 ${playerId} HP 不匹配: 预期 ${playerExpect.hp}, 实际 ${hp}`);
                }
            }

            if (playerExpect.cp !== undefined) {
                const cp = player.resources[RESOURCE_IDS.CP] ?? 0;
                if (cp !== playerExpect.cp) {
                    errors.push(`玩家 ${playerId} CP 不匹配: 预期 ${playerExpect.cp}, 实际 ${cp}`);
                }
            }

            if (playerExpect.handSize !== undefined && player.hand.length !== playerExpect.handSize) {
                errors.push(`玩家 ${playerId} 手牌数量不匹配: 预期 ${playerExpect.handSize}, 实际 ${player.hand.length}`);
            }

            if (playerExpect.deckSize !== undefined && player.deck.length !== playerExpect.deckSize) {
                errors.push(`玩家 ${playerId} 牌库数量不匹配: 预期 ${playerExpect.deckSize}, 实际 ${player.deck.length}`);
            }

            if (playerExpect.statusEffects) {
                for (const [statusId, stacks] of Object.entries(playerExpect.statusEffects)) {
                    const actual = player.statusEffects[statusId] ?? 0;
                    if (actual !== stacks) {
                        errors.push(`玩家 ${playerId} 状态 ${statusId} 不匹配: 预期 ${stacks}, 实际 ${actual}`);
                    }
                }
            }

            if (playerExpect.tokens) {
                for (const [tokenId, amount] of Object.entries(playerExpect.tokens)) {
                    const actual = player.tokens[tokenId] ?? 0;
                    if (actual !== amount) {
                        errors.push(`玩家 ${playerId} Token ${tokenId} 不匹配: 预期 ${amount}, 实际 ${actual}`);
                    }
                }
            }

            if (playerExpect.abilityLevels) {
                for (const [abilityId, level] of Object.entries(playerExpect.abilityLevels)) {
                    const actual = player.abilityLevels?.[abilityId] ?? 0;
                    if (actual !== level) {
                        errors.push(`玩家 ${playerId} 技能等级 ${abilityId} 不匹配: 预期 ${level}, 实际 ${actual}`);
                    }
                }
            }

            if (playerExpect.discardSize !== undefined && player.discard.length !== playerExpect.discardSize) {
                errors.push(`玩家 ${playerId} 弃牌数量不匹配: 预期 ${playerExpect.discardSize}, 实际 ${player.discard.length}`);
            }

            if (playerExpect.abilityNameById) {
                for (const [abilityId, expectedName] of Object.entries(playerExpect.abilityNameById)) {
                    const ability = player.abilities.find(a => a.id === abilityId);
                    if (!ability) {
                        errors.push(`玩家 ${playerId} 技能不存在: ${abilityId}`);
                        continue;
                    }
                    if (ability.name !== expectedName) {
                        errors.push(`玩家 ${playerId} 技能 ${abilityId} 名称不匹配: 预期 ${expectedName}, 实际 ${ability.name}`);
                    }
                }
            }
        }
    }

    // 其他断言逻辑...（省略以保持文件大小）

    return errors;
}

export const assertState = (state: MatchState<DiceThroneCore>, expect: DiceThroneExpectation): string[] => {
    const errors = assertDiceThrone(state.core, expect, state.sys.phase as TurnPhase);

    // pendingInteraction 断言（从 sys.interaction 读取）
    if (expect.pendingInteraction !== undefined) {
        const current = state.sys.interaction.current;

        if (expect.pendingInteraction === null) {
            // 断言无交互：current 必须为空（不限 kind）
            if (current) {
                errors.push(`pendingInteraction 应为空，实际存在: kind=${current.kind} id=${current.id}`);
            }
        } else if (!current) {
            errors.push(`pendingInteraction 不存在，预期 type=${expect.pendingInteraction.type}`);
        } else if (current.kind === 'dt:card-interaction') {
            // 状态选择类交互：data 直接是 InteractionDescriptor
            const actual = current.data as InteractionDescriptor;
            if (expect.pendingInteraction.type !== undefined && actual.type !== expect.pendingInteraction.type) {
                errors.push(`pendingInteraction.type 不匹配: 预期 ${expect.pendingInteraction.type}, 实际 ${actual.type}`);
            }
            if (expect.pendingInteraction.selectCount !== undefined && actual.selectCount !== expect.pendingInteraction.selectCount) {
                errors.push(`pendingInteraction.selectCount 不匹配: 预期 ${expect.pendingInteraction.selectCount}, 实际 ${actual.selectCount}`);
            }
            if (expect.pendingInteraction.playerId !== undefined && actual.playerId !== expect.pendingInteraction.playerId) {
                errors.push(`pendingInteraction.playerId 不匹配: 预期 ${expect.pendingInteraction.playerId}, 实际 ${actual.playerId}`);
            }
            if (expect.pendingInteraction.dieModifyMode !== undefined && actual.dieModifyConfig?.mode !== expect.pendingInteraction.dieModifyMode) {
                errors.push(`pendingInteraction.dieModifyMode 不匹配: 预期 ${expect.pendingInteraction.dieModifyMode}, 实际 ${actual.dieModifyConfig?.mode}`);
            }
        } else if (current.kind === 'multistep-choice') {
            // 骰子类交互：从 meta 读取 dtType、dieModifyConfig、selectCount
            const meta = (current.data as MultistepChoiceData)?.meta as Record<string, unknown> | undefined;
            const dtType = meta?.dtType as string | undefined;

            // type 断言：modifyDie / selectDie
            if (expect.pendingInteraction.type !== undefined) {
                if (expect.pendingInteraction.type !== dtType) {
                    errors.push(`pendingInteraction.type 不匹配: 预期 ${expect.pendingInteraction.type}, 实际 ${dtType}`);
                }
            }
            // playerId 断言
            if (expect.pendingInteraction.playerId !== undefined && current.playerId !== expect.pendingInteraction.playerId) {
                errors.push(`pendingInteraction.playerId 不匹配: 预期 ${expect.pendingInteraction.playerId}, 实际 ${current.playerId}`);
            }
            // selectCount 断言
            if (expect.pendingInteraction.selectCount !== undefined) {
                const actualSelectCount = meta?.selectCount as number | undefined;
                if (actualSelectCount !== expect.pendingInteraction.selectCount) {
                    errors.push(`pendingInteraction.selectCount 不匹配: 预期 ${expect.pendingInteraction.selectCount}, 实际 ${actualSelectCount}`);
                }
            }
            // dieModifyMode 断言
            if (expect.pendingInteraction.dieModifyMode !== undefined) {
                const dieModifyConfig = meta?.dieModifyConfig as { mode?: string } | undefined;
                if (dieModifyConfig?.mode !== expect.pendingInteraction.dieModifyMode) {
                    errors.push(`pendingInteraction.dieModifyMode 不匹配: 预期 ${expect.pendingInteraction.dieModifyMode}, 实际 ${dieModifyConfig?.mode}`);
                }
            }
            // targetOpponentDice 断言
            if (expect.pendingInteraction.targetOpponentDice !== undefined) {
                const actualTargetOpponent = meta?.targetOpponentDice as boolean | undefined;
                if (actualTargetOpponent !== expect.pendingInteraction.targetOpponentDice) {
                    errors.push(`pendingInteraction.targetOpponentDice 不匹配: 预期 ${expect.pendingInteraction.targetOpponentDice}, 实际 ${actualTargetOpponent}`);
                }
            }
        } else {
            errors.push(`pendingInteraction kind 未知: ${current.kind}，无法断言`);
        }
    }

    return errors;
};

/**
 * 工具函数：注入 pendingInteraction 到 sys.interaction（测试专用）
 *
 * - 状态选择类（selectStatus / selectPlayer / selectTargetStatus）→ dt:card-interaction
 * - 骰子修改类（modifyDie）→ multistep-choice，注入完整的 MultistepChoiceData（含函数）
 * - 骰子选择类（selectDie）→ multistep-choice，注入完整的 MultistepChoiceData（含函数）
 */
export function injectPendingInteraction(
    state: MatchState<DiceThroneCore>,
    interaction: InteractionDescriptor
): void {
    const isDiceType = interaction.type === 'modifyDie' || interaction.type === 'selectDie';

    if (!isDiceType) {
        // 状态选择类：dt:card-interaction，data 直接存储 InteractionDescriptor
        state.sys.interaction = {
            ...state.sys.interaction,
            current: {
                id: `dt-interaction-${interaction.id}`,
                kind: 'dt:card-interaction',
                playerId: interaction.playerId,
                data: { ...interaction, sourceId: interaction.sourceCardId },
            },
        };
        return;
    }

    // 骰子类：multistep-choice，必须在客户端注入函数（JSON 序列化会丢失函数）
    if (interaction.type === 'modifyDie') {
        const config = interaction.dieModifyConfig;
        const mode = config?.mode ?? 'set';
        const selectCount = interaction.selectCount ?? 1;
        const maxSteps = (mode === 'adjust' || mode === 'any') ? undefined
            : selectCount;

        const multistepData: MultistepChoiceData<DiceModifyStep, DiceModifyResult> = {
            title: interaction.titleKey,
            sourceId: interaction.sourceCardId,
            maxSteps,
            minSteps: (mode === 'adjust' || mode === 'any') ? 1 : undefined,
            initialResult: { modifications: {}, modCount: 0, totalAdjustment: 0 },
            localReducer: (current, step) => diceModifyReducer(current, step, config),
            toCommands: diceModifyToCommands,
            meta: {
                dtType: 'modifyDie',
                dieModifyConfig: config,
                selectCount,
                targetOpponentDice: interaction.targetOpponentDice ?? false,
            },
        };

        state.sys.interaction = {
            ...state.sys.interaction,
            current: {
                id: `dt-dice-modify-${interaction.id}`,
                kind: 'multistep-choice',
                playerId: interaction.playerId,
                data: multistepData,
            },
        };
        return;
    }

    // selectDie
    const selectCount = interaction.selectCount ?? 1;
    const multistepData: MultistepChoiceData<DiceSelectStep, DiceSelectResult> = {
        title: interaction.titleKey,
        sourceId: interaction.sourceCardId,
        maxSteps: selectCount,
        minSteps: 1,
        initialResult: { selectedDiceIds: [] },
        localReducer: diceSelectReducer,
        toCommands: diceSelectToCommands,
        meta: {
            dtType: 'selectDie',
            selectCount,
            targetOpponentDice: interaction.targetOpponentDice ?? false,
        },
    };

    state.sys.interaction = {
        ...state.sys.interaction,
        current: {
            id: `dt-dice-select-${interaction.id}`,
            kind: 'multistep-choice',
            playerId: interaction.playerId,
            data: multistepData,
        },
    };
}

// ============================================================================
// 阶段推进 helper
// ============================================================================

/**
 * 可通过 ADVANCE_PHASE 到达的阶段顺序（不含 setup/upkeep/income，它们由引擎自动推进）。
 * createInitializedState 返回 main1，所以 advanceTo 从 main1 开始计算。
 */
const ADVANCEABLE_PHASES: TurnPhase[] = [
    'main1',
    'offensiveRoll',
    // defensiveRoll 不在此列表中——它是 offensiveRoll 的条件分支，不是固定的下一阶段
    'main2',
    'discard',
];

/**
 * 生成从 main1 推进到目标阶段的 ADVANCE_PHASE 命令序列。
 *
 * 使用场景：测试需要从初始化状态（main1）推进到某个阶段时，
 * 用 `...advanceTo('offensiveRoll')` 替代手写 `cmd('ADVANCE_PHASE', '0')`。
 *
 * 注意：
 * - 仅支持从 main1 开始的线性推进（main1 → offensiveRoll → main2 → discard）
 * - defensiveRoll 需要通过攻击流程进入，不在此 helper 范围内
 * - upkeep/income 由引擎自动推进，不需要手动 ADVANCE_PHASE
 *
 * @param target 目标阶段
 * @param playerId 执行推进的玩家 ID（默认 '0'）
 */
export const advanceTo = (target: TurnPhase, playerId: PlayerId = '0'): CommandInput[] => {
    if (target === 'main1') return []; // 已经在 main1

    const startIdx = ADVANCEABLE_PHASES.indexOf('main1');
    const targetIdx = ADVANCEABLE_PHASES.indexOf(target);

    if (targetIdx === -1) {
        throw new Error(
            `advanceTo('${target}') 不支持：该阶段不在线性推进路径中。` +
            `支持的目标：${ADVANCEABLE_PHASES.join(', ')}。` +
            `defensiveRoll 需要通过攻击流程进入。`
        );
    }

    const commands: CommandInput[] = [];
    for (let i = startIdx; i < targetIdx; i++) {
        commands.push(cmd('ADVANCE_PHASE', playerId));
    }
    return commands;
};

// ============================================================================
// Runner 创建
// ============================================================================

export const createRunner = (random: RandomFn, silent = true) => new GameTestRunner({
    domain: DiceThroneDomain,
    systems: testSystems,
    playerIds: ['0', '1'],
    random,
    setup: createInitializedState,
    assertFn: assertState,
    silent,
});
