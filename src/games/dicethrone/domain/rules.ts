/**
 * DiceThrone 共享规则
 * 供 UI 与 domain 层共用的纯函数
 */

import type { PlayerId } from '../../../engine/types';
import type { DtResponseWindowType } from './core-types';
import type { AbilityContext } from './combat';
import { combatAbilityManager } from './combatAbility';
import type { RollDieConditionalEffect, RollDieDefaultEffect } from './effects';
import { getCustomActionMeta, isCustomActionCategory } from './effects';
import { logger } from '../../../lib/logger';
import type {
    DiceThroneCore,
    Die,
    DieFace,
    TurnPhase,
    AbilityCard,
    SelectableCharacterId,
} from './types';
import { HAND_LIMIT, PHASE_ORDER } from './types';
import { RESOURCE_IDS } from './resources';
import { DICE_FACE_IDS, BARBARIAN_DICE_FACE_IDS, STATUS_IDS, TOKEN_IDS, TREANT_DICE_FACE_IDS, NINJA_DICE_FACE_IDS } from './ids';
import { getDieFaceByValue } from './diceRegistry';
import { CHARACTER_DATA_MAP } from './characters';
import { playerAbilityHasDamage, playerAbilityNeedsSingleOpponentTarget } from './abilityLookup';
import { getCurrentRollDice, getCurrentRollOwnerId, isCurrentBonusRollSettlement, resolveCurrentRollContext } from './rollContext';
import { canRerollBonusDiceSettlement } from './bonusDiceSettlement';
import { hasUsableDiceRerollPassiveAction } from './passiveAbility';
import {
    areTeammates,
    getSeatingOrder,
    getTeamId,
    isTeamMode,
} from './rollContextPolicy';

import { getGameMode } from './utils';

// ============================================================================
// 骰子规则
// ============================================================================

/**
 * 根据骰子定义 ID 和点数获取骰面类型
 * @param definitionId 骰子定义 ID（如 'monk-dice', 'barbarian-dice'）
 * @param value 骰子点数 (1-6)
 * @returns 骰面 ID 或 null
 */
export const getDieFaceByDefinition = (definitionId: string, value: number): DieFace | null => {
    const faceDef = getDieFaceByValue(definitionId, value);
    if (!faceDef) return null;
    return faceDef.symbols[0] as DieFace;
};

/**
 * 根据角色 ID 和骰子点数获取骰面类型
 * @param characterId 角色 ID（如 'monk', 'barbarian'）
 * @param value 骰子点数 (1-6)
 * @returns 骰面 ID 或 null
 */
export const getHeroDieFace = (characterId: SelectableCharacterId, value: number): DieFace | null => {
    const charData = CHARACTER_DATA_MAP[characterId];
    if (!charData) return null;
    return getDieFaceByDefinition(charData.diceDefinitionId, value);
};

/**
 * 根据游戏状态、玩家 ID 和骰子点数获取骰面类型（便捷包装）
 * @param state 游戏核心状态
 * @param playerId 玩家 ID
 * @param value 骰子点数 (1-6)
 * @returns 骰面 ID 或 null
 */
export const getPlayerDieFace = (state: DiceThroneCore, playerId: PlayerId, value: number): DieFace | null => {
    const player = state.players[playerId];
    if (!player || !player.characterId || player.characterId === 'unselected') return null;
    return getHeroDieFace(player.characterId, value);
};

export const getPlayerDiceDefinitionId = (state: DiceThroneCore, playerId: PlayerId): string | null => {
    const characterId = state.players[playerId]?.characterId;
    if (!characterId || characterId === 'unselected') return null;
    return CHARACTER_DATA_MAP[characterId]?.diceDefinitionId ?? null;
};

/**
 * 统计活跃骰子的各骰面数量
 * 使用骰子的 symbol 字段（已通过 diceSystem 解析）
 */
export const getFaceCounts = (dice: Die[]): Record<DieFace, number> => {
    return dice.reduce(
        (acc, die) => {
            // 使用已解析的 symbol
            const face = die.symbol as DieFace;
            if (face) {
                acc[face] = (acc[face] ?? 0) + 1;
            }
            return acc;
        },
        { 
            [DICE_FACE_IDS.FIST]: 0, 
            [DICE_FACE_IDS.PALM]: 0, 
            [DICE_FACE_IDS.TAIJI]: 0, 
            [DICE_FACE_IDS.LOTUS]: 0,
            [BARBARIAN_DICE_FACE_IDS.SWORD]: 0,
            [BARBARIAN_DICE_FACE_IDS.HEART]: 0,
            [BARBARIAN_DICE_FACE_IDS.STRENGTH]: 0,
            [TREANT_DICE_FACE_IDS.BRANCH]: 0,
            [TREANT_DICE_FACE_IDS.LEAF]: 0,
            [TREANT_DICE_FACE_IDS.SPIRIT]: 0,
            [NINJA_DICE_FACE_IDS.KATANA]: 0,
            [NINJA_DICE_FACE_IDS.SHURIKEN]: 0,
            [NINJA_DICE_FACE_IDS.MASK]: 0,
        } as Record<DieFace, number>
    );
};

/**
 * 获取活跃骰子（根据 rollDiceCount）
 */
export const getActiveDice = (state: DiceThroneCore, phase?: TurnPhase): Die[] => {
    return getCurrentRollDice(state, phase);
};

export const ATTACK_SNAPSHOT_DIE_ID_OFFSET = 100;

export const isAttackSnapshotDieId = (dieId: number): boolean => (
    Number.isInteger(dieId) && dieId >= ATTACK_SNAPSHOT_DIE_ID_OFFSET
);

export const getAttackSnapshotDieIndex = (dieId: number): number => (
    dieId - ATTACK_SNAPSHOT_DIE_ID_OFFSET
);

export const getAttackSnapshotDieIds = (state: DiceThroneCore): number[] => {
    const values = state.pendingAttack?.attackDiceValues;
    if (!Array.isArray(values)) return [];
    return values.map((_, index) => ATTACK_SNAPSHOT_DIE_ID_OFFSET + index);
};

/**
 * 兼容旧/脏快照中的奖励骰 shape。
 * 线上历史反馈里 `pendingBonusDiceSettlement.dice` 可能不是数组，
 * 服务器命令管线必须先归一化，避免直接 `.map/.find/.reduce` 崩溃。
 */
export const getPendingBonusSettlementDice = (
    settlement: DiceThroneCore['pendingBonusDiceSettlement'] | null | undefined,
): Array<NonNullable<DiceThroneCore['pendingBonusDiceSettlement']>['dice'][number]> => {
    const rawDice = settlement?.dice;
    return Array.isArray(rawDice) ? rawDice : [];
};

/** 未结算的奖励骰仍占用当前骰区，父流程和阶段推进不能绕过它。 */
export const hasPendingBonusDiceSettlement = (
    settlement: DiceThroneCore['pendingBonusDiceSettlement'] | null | undefined,
): boolean => Boolean(
    settlement
    && getPendingBonusSettlementDice(settlement).length > 0,
);

/**
 * 奖励骰始终需要右侧骰盘的普通确认收口。
 * 这里仅判断骰主是否还能先执行奖励骰自身声明的内置重投；
 * 通用改骰牌的响应资格由 afterRollConfirmed 窗口决定，不能反推为骰主免费重投。
 */
export const canOwnerRerollPendingBonusDiceSettlement = (
    state: DiceThroneCore,
    settlement: DiceThroneCore['pendingBonusDiceSettlement'] | null | undefined = state.pendingBonusDiceSettlement,
): boolean => Boolean(
    settlement
    && isCurrentBonusRollSettlement(state, settlement)
    && canRerollBonusDiceSettlement(settlement, state.players[settlement.attackerId]?.tokens),
);

export const shouldOpenAfterRollConfirmedForBonusSettlement = (
    settlement: DiceThroneCore['pendingBonusDiceSettlement'] | null | undefined,
): boolean => (
    getPendingBonusSettlementDice(settlement).length > 0
);

/**
 * 计算给定骰子点数数组里的最大重复次数（用于 N-of-a-kind 的“相同数字”判定）
 */
export const getMaxDuplicateValueCountFromValues = (values: number[]): number => {
    const counts = new Map<number, number>();
    for (const value of values) {
        if (!Number.isInteger(value) || value < 1 || value > 6) continue;
        counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return counts.size > 0 ? Math.max(...counts.values()) : 0;
};

/**
 * 计算当前骰子里的最大同数字重复次数
 */
export const getMaxDuplicateValueCount = (dice: Die[]): number => {
    return getMaxDuplicateValueCountFromValues(dice.map((die) => die.value));
};

/**
 * 获取当前攻击的骰子点数快照。
 *
 * 进攻骰会在防御阶段被防御方骰子覆盖；withDamage/postDamage 等跨阶段消费攻击结果的逻辑
 * 必须优先读取 pendingAttack 快照，只在攻击尚未创建快照的早期窗口回退到当前活跃骰。
 */
export const getAttackDiceValues = (state: DiceThroneCore): number[] => (
    state.pendingAttack?.attackDiceValues ?? getActiveDice(state).map((die) => die.value)
);

/**
 * 获取当前攻击的骰面计数快照。
 *
 * 供跨阶段效果读取攻击方骰面，避免防御阶段误读防御方当前骰。
 */
export const getAttackDiceFaceCounts = (state: DiceThroneCore): Record<DieFace, number> => (
    (state.pendingAttack?.attackDiceFaceCounts as Record<DieFace, number> | undefined)
    ?? getFaceCounts(getActiveDice(state))
);

export const getAttackMaxDuplicateValueCount = (state: DiceThroneCore): number => (
    getMaxDuplicateValueCountFromValues(getAttackDiceValues(state))
);

/**
 * 获取玩家某个 Token 的堆叠上限（支持技能永久提高上限，如花开见佛）
 * - player.tokenStackLimits 优先
 * - 回退到 tokenDefinitions.stackLimit
 * - stackLimit=0 表示无限
 */
export const getTokenStackLimit = (state: DiceThroneCore, playerId: PlayerId, tokenId: string): number => {
    const player = state.players[playerId];

    if (tokenId === STATUS_IDS.CURSED_COIN) {
        return player?.characterId === 'cursed_pirate' ? 5 : 3;
    }

    const override = player?.tokenStackLimits?.[tokenId];
    if (typeof override === 'number') {
        return override === 0 ? Infinity : override;
    }

    const def = (state.tokenDefinitions ?? []).find(t => t.id === tokenId);
    const base = def?.stackLimit;
    if (base === 0) return Infinity;
    return base ?? 99;
};

// ============================================================================
// 团队模式规则（2v2）
// ============================================================================

export {
    areTeammates,
    buildTeamIdByPlayerIdFromSeatingOrder,
    getSeatingOrder,
    getTeamId,
    getTeamIdByPlayerIdMap,
    isTeamMode,
    isPlayerAllowedByRollContextPolicy,
} from './rollContextPolicy';

export const getTeammateId = (state: DiceThroneCore, playerId: PlayerId): PlayerId | undefined => {
    if (!isTeamMode(state)) return undefined;
    const teamId = getTeamId(state, playerId);
    if (!teamId) return undefined;
    const playerIds = getSeatingOrder(state);
    return playerIds.find((pid) => pid !== playerId && getTeamId(state, pid) === teamId);
};

export const getOpponents = (state: DiceThroneCore, playerId: PlayerId): PlayerId[] => {
    const playerIds = getSeatingOrder(state);
    if (!state.players[playerId]) return [];
    if (!isTeamMode(state)) {
        return playerIds.filter((pid) => pid !== playerId);
    }

    const teamId = getTeamId(state, playerId);
    if (!teamId) return [];
    return playerIds.filter((pid) => pid !== playerId && getTeamId(state, pid) !== teamId);
};

export const getDefaultOpponentId = (state: DiceThroneCore, playerId: PlayerId): PlayerId | undefined => {
    if (!state.players[playerId]) return undefined;
    if (!isTeamMode(state)) {
        return (Object.keys(state.players) as PlayerId[]).find((pid) => pid !== playerId);
    }

    return getLeftOpponentId(state, playerId)
        ?? getRightOpponentId(state, playerId)
        ?? getOpponents(state, playerId)[0];
};

/**
 * 获取当前战斗上下文里的实际对手。
 * 用于 2v2 下在响应窗口/打牌阶段跟随当前 pendingAttack，而不是重新按默认对手推断。
 */
export const getCombatOpponentId = (
    state: DiceThroneCore,
    playerId: PlayerId
): PlayerId | undefined => {
    const pendingAttack = state.pendingAttack;
    if (!pendingAttack) return undefined;
    if (pendingAttack.attackerId === playerId) {
        return pendingAttack.defenderId;
    }
    if (pendingAttack.defenderId === playerId) {
        return pendingAttack.attackerId;
    }
    return undefined;
};

/**
 * 获取当前战斗中“已确定或可直接推导”的对手。
 * - 常规阶段：直接跟随 pendingAttack 中已落地的 attacker/defender
 * - 4 人 targetingRoll：若当前攻击方尚未写回 defenderId，但目标骰 1-4 已自动决定方向，
 *   则允许在本阶段把该自动目标视为已确定对手，供攻击修正卡等即时效果使用。
 */
export const getSelectedCombatOpponentId = (
    state: DiceThroneCore,
    playerId: PlayerId,
    phase?: TurnPhase
): PlayerId | undefined => {
    const pendingAttack = state.pendingAttack;
    if (!pendingAttack) return undefined;

    if (pendingAttack.attackerId === playerId) {
        if (pendingAttack.defenderId !== undefined) {
            return pendingAttack.defenderId;
        }

        const effectivePhase = phase ?? state.turnPhase;
        if (effectivePhase === 'targetingRoll') {
            const targetingValue = getActiveDice(state, effectivePhase)[0]?.value;
            if (typeof targetingValue === 'number') {
                return getTargetingRollAutoDefenderId(state, playerId, targetingValue);
            }
        }

        return undefined;
    }

    if (pendingAttack.defenderId === playerId) {
        return pendingAttack.attackerId;
    }

    return undefined;
};

/**
 * 获取当前命令/效果应使用的对手。
 * 优先跟随当前战斗上下文，其次才回退到默认对手。
 */
export const getContextualOpponentId = (
    state: DiceThroneCore,
    playerId: PlayerId
): PlayerId | undefined => {
    return getCombatOpponentId(state, playerId) ?? getDefaultOpponentId(state, playerId);
};

const findOpponentByDirection = (
    state: DiceThroneCore,
    playerId: PlayerId,
    direction: 1 | -1
): PlayerId | undefined => {
    const seatingOrder = getSeatingOrder(state);
    const seatIndex = seatingOrder.indexOf(playerId);
    if (seatIndex === -1) return getOpponents(state, playerId)[0];

    for (let step = 1; step < seatingOrder.length; step++) {
        const nextIndex = (seatIndex + direction * step + seatingOrder.length) % seatingOrder.length;
        const candidate = seatingOrder[nextIndex];
        if (candidate && !areTeammates(state, playerId, candidate)) {
            return candidate;
        }
    }
    return undefined;
};

export const getLeftOpponentId = (state: DiceThroneCore, playerId: PlayerId): PlayerId | undefined => {
    return findOpponentByDirection(state, playerId, -1);
};

export const getRightOpponentId = (state: DiceThroneCore, playerId: PlayerId): PlayerId | undefined => {
    return findOpponentByDirection(state, playerId, 1);
};

export const getTargetingRollAutoDefenderId = (
    state: DiceThroneCore,
    attackerId: PlayerId,
    rollValue: number
): PlayerId | undefined => {
    if (rollValue === 1 || rollValue === 2) {
        return getLeftOpponentId(state, attackerId);
    }
    if (rollValue === 3 || rollValue === 4) {
        return getRightOpponentId(state, attackerId);
    }
    return undefined;
};

export const getTargetingRollChoiceOwnerId = (
    state: DiceThroneCore,
    attackerId: PlayerId,
    rollValue: number
): PlayerId | undefined => {
    if (rollValue === 5) {
        return getDefaultOpponentId(state, attackerId);
    }
    if (rollValue === 6) {
        return attackerId;
    }
    return undefined;
};

export const getTargetingRollChoiceOptions = (
    state: DiceThroneCore,
    attackerId: PlayerId
): Array<{
    customId: string;
    value: number;
    labelKey: string;
    labelParams?: Record<string, string | number>;
    disabled?: boolean;
}> => {
    return getOpponents(state, attackerId)
        .map((pid) => ({
            customId: `select-target:${pid}`,
            value: 1,
            labelKey: 'interaction.targetingRollPlayerOption',
            labelParams: { playerNumber: Number(pid) + 1 },
        }));
};

// ============================================================================
// 玩家顺序规则
// ============================================================================

const rotateOrderToStart = (order: PlayerId[], startPlayerId: PlayerId): PlayerId[] => {
    const startIndex = order.indexOf(startPlayerId);
    if (startIndex <= 0) return order;
    return [...order.slice(startIndex), ...order.slice(0, startIndex)];
};

const buildTeamTurnOrder = (state: DiceThroneCore): PlayerId[] => {
    const seatingOrder = getSeatingOrder(state);
    if (!isTeamMode(state)) {
        return seatingOrder;
    }

    const startingPlayerId = state.players[state.startingPlayerId]
        ? state.startingPlayerId
        : seatingOrder[0];
    if (!startingPlayerId) {
        return seatingOrder;
    }

    const startingTeamId = getTeamId(state, startingPlayerId);
    if (!startingTeamId) {
        return seatingOrder;
    }

    // 2v2 的队伍归属本身就是按座位奇偶位推导出来的；
    // 只要把环桌座位顺序旋转到起始玩家，就天然是 A/B/A/B 交替。
    return rotateOrderToStart(seatingOrder, startingPlayerId);
};

/**
 * 获取玩家顺序列表
 */
export const getPlayerOrder = (state: DiceThroneCore): PlayerId[] => {
    return buildTeamTurnOrder(state);
};

/**
 * 获取下一位玩家 ID
 */
export const getNextPlayerId = (state: DiceThroneCore): PlayerId => {
    const order = getPlayerOrder(state);
    const currentIndex = order.indexOf(state.activePlayerId);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % order.length;
    return order[nextIndex];
};

/**
 * 获取当前掷骰玩家 ID
 */
export const getRollerId = (state: DiceThroneCore, phase?: TurnPhase): PlayerId => {
    const currentContext = state.currentRollContext;
    const isSettledReplay = currentContext?.status === 'settled'
        && currentContext.display.replayOnly === true;
    if (
        currentContext
        && !isSettledReplay
        && (
            currentContext.phase === undefined
            || phase === undefined
            || currentContext.phase === phase
            || currentContext.kind === 'bonus'
            || currentContext.kind === 'effect'
            || currentContext.kind === 'evasion'
            || currentContext.kind === 'compare'
        )
    ) {
        return getCurrentRollOwnerId(state, phase);
    }
    if (
        state.pendingBonusDiceSettlement
        && isCurrentBonusRollSettlement(state)
        && getPendingBonusSettlementDice(state.pendingBonusDiceSettlement).length > 0
    ) {
        return state.pendingBonusDiceSettlement.attackerId;
    }
    if (phase === 'defensiveRoll') {
        return state.pendingAttack?.defenderId ?? state.activePlayerId;
    }
    if (phase === 'offensiveRoll' || phase === 'targetingRoll') {
        return state.activePlayerId;
    }
    // 未显式传入 phase 时，基于防御技能是否已选中推断掷骰者
    if (state.pendingAttack?.defenseAbilityId) {
        return state.pendingAttack.defenderId ?? state.activePlayerId;
    }
    return state.activePlayerId;
};

// ============================================================================
// 阶段规则
// ============================================================================

/**
 * 选角阶段是否已满足房主开始对局的前置条件。
 *
 * 房主无需准备；其余所有席位必须先选角并准备完成。
 * 该判断同时被领域校验、AI 调度和选角 UI 消费，避免它们各自
 * 生成或放行不可能成功的开始命令。
 */
export const isSetupReadyToStart = (args: {
    playerIds: readonly PlayerId[];
    hostPlayerId: PlayerId;
    selectedCharacters: Record<PlayerId, CharacterId>;
    readyPlayers: Record<PlayerId, boolean>;
}): boolean => args.playerIds.every((playerId) => {
    const characterId = args.selectedCharacters[playerId];
    const hasSelectedCharacter = typeof characterId === 'string' && characterId !== 'unselected';
    return hasSelectedCharacter && (playerId === args.hostPlayerId || args.readyPlayers[playerId] === true);
});

/**
 * 检查是否可以推进阶段
 */
export const canAdvancePhase = (state: DiceThroneCore, phase: TurnPhase): boolean => {
    // 任何未结算奖励骰都必须先由响应窗口或自身结算规则收口。
    if (hasPendingBonusDiceSettlement(state.pendingBonusDiceSettlement)) {
        return false;
    }

    // 选角阶段门禁
    if (phase === 'setup') {
        const playerIds = Object.keys(state.players);
        
        // 教程模式：只检查玩家 0 是否选好角色
        const mode = getGameMode();
        const isTutorialMode = mode === 'tutorial';
        const isLocalMode = mode === 'local';
        
        if (isTutorialMode) {
            const player0Selected = state.selectedCharacters['0'] && state.selectedCharacters['0'] !== 'unselected';
            return player0Selected && state.hostStarted;
        }

        // 本地模式：仅要求房主开始即可推进，选角将由本地自动补全
        if (isLocalMode) {
            return state.hostStarted;
        }
        
        // 正常模式：所有玩家选角且非房主准备完成后，才可由房主开始。
        return isSetupReadyToStart({
            playerIds,
            hostPlayerId: state.hostPlayerId,
            selectedCharacters: state.selectedCharacters,
            readyPlayers: state.readyPlayers,
        }) && state.hostStarted;
    }

    // 防御阶段：默认需“先选技能 → 掷骰 → 确认”后才能推进。
    // 注意：pendingAttack 为 null 表示攻击已结算（ATTACK_RESOLVED），此时允许推进
    if (phase === 'defensiveRoll') {
        if (state.pendingAttack) {
            if (!state.pendingAttack.defenseAbilityId) {
                return false;
            }
            if (state.rollCount === 0) {
                return false;
            }
            if (!state.rollConfirmed) {
                return false;
            }
        }
    }

    // 弃牌阶段手牌超限时不可推进
    if (phase === 'discard') {
        const player = state.players[state.activePlayerId];
        if (player && player.hand.length > HAND_LIMIT) {
            return false;
        }
    }

    if (phase === 'targetingRoll') {
        return state.rollCount > 0 && state.rollConfirmed;
    }
    
    return true;
};

/**
 * 获取下一阶段
 */
export const getNextPhase = (state: DiceThroneCore, phase: TurnPhase): TurnPhase => {
    const currentIndex = PHASE_ORDER.indexOf(phase);
    let nextPhase = PHASE_ORDER[(currentIndex + 1) % PHASE_ORDER.length];
    
    // 第一回合先手玩家跳过 income
    if (
        phase === 'upkeep' &&
        state.turnNumber === 1 &&
        state.activePlayerId === state.startingPlayerId
    ) {
        nextPhase = 'main1';
    }
    
    // 进攻阶段结束后的分支
    if (phase === 'offensiveRoll') {
        const sourceAbilityId = state.pendingAttack?.sourceAbilityId;
        const needsTargetingRoll = Boolean(
            isTeamMode(state)
            && state.pendingAttack
            && sourceAbilityId
            && state.pendingAttack.defenderId === undefined
            && (
                playerAbilityHasDamage(state, state.pendingAttack.attackerId, sourceAbilityId)
                || playerAbilityNeedsSingleOpponentTarget(state, state.pendingAttack.attackerId, sourceAbilityId)
            )
        );
        if (needsTargetingRoll) {
            nextPhase = 'targetingRoll';
            return nextPhase;
        }
        if (state.pendingAttack && state.pendingAttack.isDefendable) {
            nextPhase = 'defensiveRoll';
        } else {
            nextPhase = 'main2';
        }
    }

    if (phase === 'targetingRoll') {
        if (state.pendingAttack && state.pendingAttack.isDefendable) {
            nextPhase = 'defensiveRoll';
        } else {
            nextPhase = 'main2';
        }
    }
    
    // 弃牌阶段结束后切换玩家
    if (phase === 'discard') {
        nextPhase = 'upkeep';
    }
    
    return nextPhase;
};

// ============================================================================
// 技能规则
// ============================================================================

/**
 * 获取玩家拥有的所有防御技能 ID 列表（不检查骰面）
 * 用于防御阶段掷骰前的技能选择（规则 §3.6 步骤 2）
 */
export const getDefensiveAbilityIds = (
    state: DiceThroneCore,
    playerId: PlayerId
): string[] => {
    const player = state.players[playerId];
    if (!player) return [];

    const ids: string[] = [];
    for (const def of player.abilities) {
        if (def.type !== 'defensive') continue;
        if (def.variants?.length) {
            for (const variant of def.variants) {
                ids.push(variant.id);
            }
        } else {
            ids.push(def.id);
        }
    }
    return ids;
};

/**
 * 获取当前可用的技能 ID 列表
 */
export const getAvailableAbilityIds = (
    state: DiceThroneCore,
    playerId: PlayerId,
    phase: TurnPhase
): string[] => {
    const player = state.players[playerId];
    if (!player) return [];
    
    const dice = getActiveDice(state, phase);
    const diceValues = dice.map(d => d.value);
    const faceCounts = getFaceCounts(dice);

    const context: AbilityContext = {
        currentPhase: phase,
        diceValues,
        faceCounts,
        resources: { cp: player.resources[RESOURCE_IDS.CP] ?? 0 },
        statusEffects: player.statusEffects,
    };



    // 根据阶段过滤技能类型
    const expectedTypes = phase === 'defensiveRoll'
        ? ['defensive']
        : phase === 'offensiveRoll'
            ? ['offensive', 'utility']
            : undefined;

    // 注意：必须基于玩家当前 abilities（升级卡会替换此处定义）进行判定
    const available: string[] = [];

    for (const def of player.abilities) {
        if (expectedTypes && !expectedTypes.includes(def.type)) continue;

        if (def.variants?.length) {
            // 收集满足条件的变体，按 priority 降序排列后加入
            // 确保 UI 层 find() 取第一个匹配时自动选中最高优先级变体
            const matched: { id: string; priority: number }[] = [];
            for (const variant of def.variants) {
                const result = combatAbilityManager.instance.checkTrigger(variant.trigger, context);
                if (result) {
                    matched.push({ id: variant.id, priority: variant.priority ?? 0 });
                }
            }
            matched.sort((a, b) => b.priority - a.priority);
            for (const m of matched) {
                available.push(m.id);
            }
            continue;
        }

        if (def.trigger) {
            const result = combatAbilityManager.instance.checkTrigger(def.trigger, context);
            if (result) {
                available.push(def.id);
            }
        }
    }

    return available;
};


// ============================================================================
// 卡牌规则
// ============================================================================

/** 卡牌打出检查结果 */
export type CardPlayCheckResult = 
    | { ok: true }
    | { ok: false; reason: CardPlayFailReason };

/** 卡牌打出失败原因（用于国际化 key，必须与 i18n 保持一致） */
export type CardPlayFailReason =
    | 'playerNotFound'
    | 'upgradeCardCannotPlay'      // 升级卡缺少目标技能
    | 'upgradeCardSkipLevel'       // 旧错误码保留兼容；当前规则允许直接 I→III
    | 'upgradeCardMaxLevel'        // 技能已达到最高级
    | 'wrongPhaseForUpgrade'       // 升级卡只能在主要阶段
    | 'wrongPhaseForMain'          // 主要阶段卡只能在主要阶段
    | 'wrongPhaseForRoll'          // 投掷阶段卡只能在投掷阶段
    | 'notEnoughCp'                // CP 不足
    | 'unknownCardTiming'          // 未知卡牌时机
    | 'wrongPhaseForCard'          // 卡牌需要特定阶段（进攻/防御）
    | 'attackModifierRequiresSelectedAttack' // 攻击修正牌需要先选定攻击技能
    | 'attackModifierRequiresSelectedDefender' // 4 人模式下该攻击修正牌需要先选定具体受击者
    | 'requireLoaded'             // 需要消耗装填指示物
    | 'requireOwnTurn'             // 卡牌需要在自己回合打出
    | 'requireOpponentTurn'        // 卡牌需要在对手回合打出
    | 'requireIsRoller'            // 卡牌需要是当前投掷方
    | 'requireIsNotRoller'         // 卡牌需要不是当前投掷方（响应对手骰面）
    | 'requireHasRolled'           // 卡牌需要已经投掷过
    | 'requireDiceExists'          // 卡牌需要有骰子结果
    | 'requireMinDiceCount'        // 卡牌需要最少骰子数量
    | 'requireOpponentDiceExists'  // 卡牌需要对手有骰子结果
    | 'requireRollConfirmed'       // 卡牌需要骰面已确认（响应对手确认后）
    | 'requireNotRollConfirmed'    // 骰面已确认，不能再打出该卡
    | 'requireMinDamageDealt'      // 本回合未造成足够伤害
    | 'noStatusOnBoard'            // 场上没有任何状态效果或 token
    | 'rollContextLocked'          // 当前骰区不允许改骰牌
    | 'requirePendingDamage';      // 需要处于待结算伤害响应窗口

const getAttackModifierPlayFailureReason = (
    state: DiceThroneCore,
    playerId: PlayerId,
    card: AbilityCard,
    _phase?: TurnPhase
): CardPlayFailReason | null => {
    if (!card.isAttackModifier) return null;
    const pendingAttack = state.pendingAttack;
    if (!pendingAttack?.sourceAbilityId) {
        return 'attackModifierRequiresSelectedAttack';
    }
    if (pendingAttack.attackerId !== playerId) {
        return 'wrongPhaseForCard';
    }
    return null;
};

/**
 * 开放的当前骰区可以代替主骰的“已投掷 / 已确认”前提。
 * 普通攻击、防御与目标骰仍必须遵守自身的确认时机；已结算只读回看不能越权放行。
 */
const hasCurrentDiceTargetForCard = (
    state: DiceThroneCore,
    card: AbilityCard,
    phase: TurnPhase,
): boolean => {
    if (
        (card.timing !== 'roll' && card.timing !== 'instant')
        || !hasAnyDiceEffect(card)
    ) {
        return false;
    }

    const currentRollContext = resolveCurrentRollContext(state, phase);
    return Boolean(
        currentRollContext
        && currentRollContext.policy.allowDiceCardTargeting === true
        && currentRollContext.display.replayOnly !== true
        && currentRollContext.dice.length > 0,
    );
};

const isDiceRollPhase = (phase: TurnPhase): boolean => (
    phase === 'offensiveRoll'
    || phase === 'targetingRoll'
    || phase === 'defensiveRoll'
);

const getDiceResultCountForCardPlay = (state: DiceThroneCore, phase: TurnPhase): number => {
    return getActiveDice(state, phase).length;
};

const matchesPendingDamagePlayCondition = (
    state: DiceThroneCore,
    playerId: PlayerId,
    pendingDamageCondition: NonNullable<NonNullable<AbilityCard['playCondition']>['pendingDamage']>,
    phase?: TurnPhase,
): boolean => {
    const pendingDamage = state.pendingDamage;
    if (!pendingDamage) {
        // 规则 §7.2：若攻击会进入防御阶段，防御方的减伤牌可在防御能力启动前或后打出。
        // 这时尚未生成 pendingDamage，因此允许 beforeDamageReceived 类卡牌在 defensiveRoll 先落成一次性护盾。
        // 对于不可防御攻击，当前项目口径同样允许这类“受击即刻防伤牌”在防御阶段直接落地护盾，
        // 不把“不可防御”误解释为“连受击即时牌都不能打”。
        if (
            phase === 'defensiveRoll'
            && pendingDamageCondition.responseType === 'beforeDamageReceived'
            && state.pendingAttack?.defenderId === playerId
        ) {
            return pendingDamageCondition.role !== 'source';
        }
        return false;
    }

    if (
        pendingDamageCondition.responseType
        && pendingDamage.responseType !== pendingDamageCondition.responseType
    ) {
        return false;
    }

    switch (pendingDamageCondition.role) {
        case 'source':
            return pendingDamage.sourcePlayerId === playerId;
        case 'target':
            return pendingDamage.targetPlayerId === playerId;
        case 'responder':
            return pendingDamage.responderId === playerId;
        default:
            return true;
    }
};

/**
 * 从升级卡效果中提取目标技能 ID
 */
export const getUpgradeTargetAbilityId = (card: AbilityCard): string | null => {
    if (card.type !== 'upgrade' || !card.effects) return null;
    const replaceAction = card.effects.find(e => e.action?.type === 'replaceAbility')?.action;
    if (replaceAction?.type === 'replaceAbility' && replaceAction.targetAbilityId) {
        return replaceAction.targetAbilityId;
    }
    return null;
};

const checkUpgradeCardPlay = (
    state: DiceThroneCore,
    playerId: PlayerId,
    card: AbilityCard,
    phase: TurnPhase
): CardPlayCheckResult => {
    const player = state.players[playerId];
    if (!player) return { ok: false, reason: 'playerNotFound' };
    const playerCp = player.resources[RESOURCE_IDS.CP] ?? 0;

    if (phase !== 'main1' && phase !== 'main2') {
        return { ok: false, reason: 'wrongPhaseForUpgrade' };
    }

    const targetAbilityId = getUpgradeTargetAbilityId(card);
    if (!targetAbilityId) {
        logger.warn('[checkPlayCard] 升级卡无法提取目标技能ID', { cardId: card.id });
        return { ok: false, reason: 'upgradeCardCannotPlay' };
    }

    const currentLevel = player.abilityLevels[targetAbilityId] ?? 1;
    const replaceAction = card.effects?.find(e => e.action?.type === 'replaceAbility')?.action;
    const desiredLevel = (replaceAction?.type === 'replaceAbility' ? replaceAction.newAbilityLevel : undefined) ?? (currentLevel + 1);

    logger.debug('[checkPlayCard] 升级卡验证', {
        cardId: card.id,
        targetAbilityId,
        currentLevel,
        desiredLevel,
        playerCp,
        cardCpCost: card.cpCost,
    });

    if (currentLevel >= 3) {
        logger.warn('[checkPlayCard] 技能已达最高等级', { targetAbilityId, currentLevel });
        return { ok: false, reason: 'upgradeCardMaxLevel' };
    }

    const previousUpgradeCost = player.upgradeCardByAbilityId?.[targetAbilityId]?.cpCost;
    let actualCost = card.cpCost;
    if (previousUpgradeCost !== undefined && currentLevel > 1) {
        actualCost = Math.max(0, card.cpCost - previousUpgradeCost);
    }

    logger.debug('[checkPlayCard] CP检查', { actualCost, playerCp, previousUpgradeCost });

    if (actualCost > 0 && playerCp < actualCost) {
        logger.warn('[checkPlayCard] CP不足', { actualCost, playerCp });
        return { ok: false, reason: 'notEnoughCp' };
    }

    return { ok: true };
};

const checkStandardCardPlay = (
    state: DiceThroneCore,
    playerId: PlayerId,
    card: AbilityCard,
    phase: TurnPhase,
    responseWindowType?: DtResponseWindowType,
): CardPlayCheckResult => {
    const player = state.players[playerId];
    if (!player) return { ok: false, reason: 'playerNotFound' };
    const playerCp = player.resources[RESOURCE_IDS.CP] ?? 0;

    if (card.timing === 'main') {
        if (phase !== 'main1' && phase !== 'main2') {
            return { ok: false, reason: 'wrongPhaseForMain' };
        }
    } else if (card.timing === 'roll') {
        const isAfterAttackRollResponse =
            responseWindowType === 'afterAttackResolved'
            && card.playCondition?.requireMinDamageDealt !== undefined;
        const isAfterRollConfirmedResponse = responseWindowType === 'afterRollConfirmed';
        if (
            !isAfterAttackRollResponse
            && !isAfterRollConfirmedResponse
            && phase !== 'offensiveRoll'
            && phase !== 'targetingRoll'
            && phase !== 'defensiveRoll'
        ) {
            return { ok: false, reason: 'wrongPhaseForRoll' };
        }
    } else if (card.timing !== 'instant') {
        return { ok: false, reason: 'unknownCardTiming' };
    }

    if (
        !responseWindowType
        && (
            (card.timing === 'roll' && hasAnyDiceEffect(card))
            || (card.timing === 'instant' && hasExistingDiceToolEffect(card))
        )
        && !isDiceRollPhase(phase)
        && !hasCurrentDiceTargetForCard(state, card, phase)
    ) {
        return { ok: false, reason: 'wrongPhaseForRoll' };
    }

    const currentRollContext = resolveCurrentRollContext(state, phase);
    if (
        hasExistingDiceToolEffect(card)
        && currentRollContext
        && currentRollContext.policy.allowDiceCardTargeting !== true
    ) {
        return { ok: false, reason: 'rollContextLocked' };
    }

    if (card.cpCost > 0 && playerCp < card.cpCost) {
        return { ok: false, reason: 'notEnoughCp' };
    }

    if (card.timing === 'roll' && hasAnyDiceEffect(card)) {
        const diceEffectTarget = getDiceEffectTarget(card);
        if (diceEffectTarget === 'self' && playerId !== getRollerId(state, phase)) {
            return { ok: false, reason: 'requireIsRoller' };
        }
    }

    if (
        !responseWindowType
        && phase === 'offensiveRoll'
        && card.isAttackModifier === true
        && playerId !== getRollerId(state, phase)
        && !state.pendingAttack?.sourceAbilityId
    ) {
        return { ok: false, reason: 'attackModifierRequiresSelectedAttack' };
    }

    const attackModifierFailureReason = getAttackModifierPlayFailureReason(state, playerId, card, phase);
    if (attackModifierFailureReason) {
        return { ok: false, reason: attackModifierFailureReason };
    }

    if (
        !responseWindowType
        && phase === 'offensiveRoll'
        && card.id === 'card-flick'
        && playerId !== getRollerId(state, phase)
        && !state.pendingAttack?.sourceAbilityId
    ) {
        return { ok: false, reason: 'attackModifierRequiresSelectedAttack' };
    }

    if (card.playCondition) {
        const cond = card.playCondition;

        if (cond.phase && phase !== cond.phase) {
            return { ok: false, reason: 'wrongPhaseForCard' };
        }

        if (cond.requireOwnTurn && playerId !== state.activePlayerId) {
            return { ok: false, reason: 'requireOwnTurn' };
        }

        if (cond.requireOpponentTurn && playerId === state.activePlayerId) {
            return { ok: false, reason: 'requireOpponentTurn' };
        }

        if (cond.requireIsRoller && playerId !== getRollerId(state, phase)) {
            return { ok: false, reason: 'requireIsRoller' };
        }

        if (cond.requireIsNotRoller && playerId === getRollerId(state, phase)) {
            return { ok: false, reason: 'requireIsNotRoller' };
        }

        if (cond.requireHasRolled && state.rollCount === 0) {
            if (!hasCurrentDiceTargetForCard(state, card, phase)) {
                return { ok: false, reason: 'requireHasRolled' };
            }
        }

        const diceResultCount = getDiceResultCountForCardPlay(state, phase);

        if (cond.requireDiceExists && diceResultCount === 0) {
            if (!hasCurrentDiceTargetForCard(state, card, phase)) {
                return { ok: false, reason: 'requireDiceExists' };
            }
        }

        if (cond.requireMinDiceCount) {
            if (diceResultCount < cond.requireMinDiceCount) {
                return { ok: false, reason: 'requireMinDiceCount' };
            }
        }

        if (cond.requireOpponentDiceExists && diceResultCount === 0) {
            if (!hasCurrentDiceTargetForCard(state, card, phase)) {
                return { ok: false, reason: 'requireOpponentDiceExists' };
            }
        }

        if (cond.requireRollConfirmed && !state.rollConfirmed) {
            if (!hasCurrentDiceTargetForCard(state, card, phase)) {
                return { ok: false, reason: 'requireRollConfirmed' };
            }
        }

        if (cond.requireNotRollConfirmed && state.rollConfirmed) {
            return { ok: false, reason: 'requireNotRollConfirmed' };
        }

        if (cond.requireMinDamageDealt !== undefined) {
            const dealt = state.lastResolvedAttackDamage ?? 0;
            if (dealt < cond.requireMinDamageDealt) {
                return { ok: false, reason: 'requireMinDamageDealt' };
            }
        }

        if (cond.requireLoaded) {
            const loaded = state.players[playerId]?.tokens?.[TOKEN_IDS.LOADED] ?? 0;
            if (loaded < 1) {
                return { ok: false, reason: 'requireLoaded' };
            }
        }

        if (cond.requireAnyStatusOnBoard) {
            const allPlayerIds = Object.keys(state.players);
            const hasAny = allPlayerIds.some(pid => {
                const p = state.players[pid];
                if (!p) return false;
                const hasEffects = Object.values(p.statusEffects ?? {}).some(v => v > 0);
                const hasTokens = Object.values(p.tokens ?? {}).some(v => v > 0);
                return hasEffects || hasTokens;
            });
            if (!hasAny) {
                return { ok: false, reason: 'noStatusOnBoard' };
            }
        }

        if (cond.pendingDamage && !matchesPendingDamagePlayCondition(state, playerId, cond.pendingDamage, phase)) {
            return { ok: false, reason: 'requirePendingDamage' };
        }
    }

    return { ok: true };
};

const isResponseUpgradeCard = (card: AbilityCard): boolean => (
    card.type === 'upgrade'
    && getUpgradeTargetAbilityId(card) === null
    && !!card.playCondition?.pendingDamage
);

const checkResponseWindowCardPlay = (
    state: DiceThroneCore,
    playerId: PlayerId,
    card: AbilityCard,
    windowType: DtResponseWindowType,
    phase: TurnPhase
): CardPlayCheckResult => {
    const failResponseWindow = (): CardPlayCheckResult => ({ ok: false, reason: 'wrongPhaseForCard' });
    const cond = card.playCondition;

    if (card.type === 'upgrade' && !isResponseUpgradeCard(card)) {
        return failResponseWindow();
    }

    switch (windowType) {
        case 'afterRollConfirmed': {
            if (card.timing !== 'instant' && card.timing !== 'roll') {
                return failResponseWindow();
            }
            // “确认骰后”只承接直接改写当前骰区的牌。单纯产生一颗新骰子
            // （例如治疗、资源或奖励骰效果）同样带有 dice 分类，却不是改骰响应。
            if (!hasExistingDiceToolEffect(card)) {
                return failResponseWindow();
            }
            const currentRollContext = resolveCurrentRollContext(state, phase);
            const isOwnOpenBonusRoll = playerId === getRollerId(state, phase)
                && currentRollContext?.kind === 'bonus'
                && currentRollContext.policy.allowDiceCardTargeting === true
                && currentRollContext.display.replayOnly !== true;
            if (isOwnOpenBonusRoll) {
                return { ok: true };
            }
            const diceEffectTarget = getDiceEffectTarget(card);
            if (diceEffectTarget !== 'opponent' && diceEffectTarget !== 'any') {
                return failResponseWindow();
            }
            if (
                phase === 'offensiveRoll'
                && card.id === 'card-flick'
                && !state.pendingAttack?.sourceAbilityId
            ) {
                return failResponseWindow();
            }
            if (playerId === getRollerId(state, phase)) {
                return failResponseWindow();
            }
            return { ok: true };
        }
        case 'afterCardPlayed':
            if (card.timing !== 'instant') {
                return failResponseWindow();
            }
            if (!hasAfterCardPlayedResponseEffect(card)) {
                return failResponseWindow();
            }
            return { ok: true };
        case 'afterAttackResolved':
            if (cond?.pendingDamage) {
                if (card.timing !== 'instant' && card.timing !== 'roll') {
                    return failResponseWindow();
                }
                if (!hasAnyActionEffect(card)) {
                    return failResponseWindow();
                }
                return { ok: true };
            }
            if (card.timing !== 'roll' || !cond?.requireMinDamageDealt) {
                return failResponseWindow();
            }
            return { ok: true };
        case 'thenBreakpoint':
            if (card.timing !== 'instant' && card.timing !== 'roll') {
                return failResponseWindow();
            }
            if (!hasAnyActionEffect(card)) {
                return failResponseWindow();
            }
            return { ok: true };
        default:
            return failResponseWindow();
    }
};

function resolveBonusDiceCardPlayResponseWindowType(
    state: DiceThroneCore,
    playerId: PlayerId,
    card: AbilityCard,
    phase: TurnPhase,
): DtResponseWindowType | undefined {
    const currentRollContext = resolveCurrentRollContext(state, phase);
    if (
        currentRollContext?.kind !== 'bonus'
        || currentRollContext.status === 'settled'
        || currentRollContext.display.replayOnly === true
        || currentRollContext.dice.length === 0
        || !state.pendingBonusDiceSettlement
        || !isCurrentBonusRollSettlement(state, state.pendingBonusDiceSettlement)
    ) {
        return undefined;
    }

    if (
        (card.timing !== 'roll' && card.timing !== 'instant')
        || !hasExistingDiceToolEffect(card)
    ) {
        return undefined;
    }

    const diceEffectTarget = getDiceEffectTarget(card);
    if (!isDiceRollPhase(phase) && card.timing === 'roll' && diceEffectTarget === 'self') {
        return undefined;
    }

    if (playerId === currentRollContext.ownerPlayerId) {
        return 'afterRollConfirmed';
    }

    return diceEffectTarget === 'opponent' || diceEffectTarget === 'any'
        ? 'afterRollConfirmed'
        : undefined;
}

/**
 * 检查是否可以打出卡牌（返回详细原因）
 */
export const checkPlayCard = (
    state: DiceThroneCore,
    playerId: PlayerId,
    card: AbilityCard,
    phase: TurnPhase,
    responseWindowType?: DtResponseWindowType,
): CardPlayCheckResult => {
    const effectiveResponseWindowType = responseWindowType
        ?? resolveBonusDiceCardPlayResponseWindowType(state, playerId, card, phase);

    if (card.type === 'upgrade' && !isResponseUpgradeCard(card)) {
        if (effectiveResponseWindowType) {
            return checkResponseWindowCardPlay(state, playerId, card, effectiveResponseWindowType, phase);
        }
        return checkUpgradeCardPlay(state, playerId, card, phase);
    }

    const baseCheck = checkStandardCardPlay(state, playerId, card, phase, effectiveResponseWindowType);
    if (!baseCheck.ok || !effectiveResponseWindowType) {
        return baseCheck;
    }

    return checkResponseWindowCardPlay(state, playerId, card, effectiveResponseWindowType, phase);
};

/** 升级卡打出失败原因 */
export type UpgradeCardPlayFailReason =
    | 'playerNotFound'
    | 'notUpgradeCard'
    | 'wrongPhaseForUpgrade'
    | 'upgradeCardCannotPlay'     // 升级卡缺少 replaceAbility 效果
    | 'upgradeCardTargetMismatch' // 目标技能不匹配
    | 'upgradeCardMaxLevel'
    | 'upgradeCardSkipLevel'      // 旧错误码保留兼容；当前规则不再主动返回
    | 'notEnoughCp';

/** 升级卡打出检查结果 */
export type UpgradeCardPlayCheckResult =
    | { ok: true }
    | { ok: false; reason: UpgradeCardPlayFailReason };

/**
 * 检查是否可以打出升级卡（返回详细原因）
 */
export const checkPlayUpgradeCard = (
    state: DiceThroneCore,
    playerId: PlayerId,
    card: AbilityCard,
    targetAbilityId: string,
    phase: TurnPhase
): UpgradeCardPlayCheckResult => {
    const player = state.players[playerId];
    if (!player) return { ok: false, reason: 'playerNotFound' };
    
    // 必须是升级卡
    if (card.type !== 'upgrade') return { ok: false, reason: 'notUpgradeCard' };
    
    // 仅 Main Phase 可用
    if (phase !== 'main1' && phase !== 'main2') {
        return { ok: false, reason: 'wrongPhaseForUpgrade' };
    }

    // 升级卡必须带 replaceAbility 效果
    const replaceAction = card.effects?.find(e => e.action?.type === 'replaceAbility')?.action;
    if (!replaceAction || replaceAction.type !== 'replaceAbility') {
        return { ok: false, reason: 'upgradeCardCannotPlay' };
    }
    
    // 目标技能必须与拖拽目标一致
    if (!replaceAction.targetAbilityId || replaceAction.targetAbilityId !== targetAbilityId) {
        return { ok: false, reason: 'upgradeCardTargetMismatch' };
    }

    // 检查技能等级（当前规则允许直接从 I 升到 III；若之前已有升级，只支付 CP 差价）
    const currentLevel = player.abilityLevels[targetAbilityId] ?? 1;
    const desiredLevel = replaceAction.newAbilityLevel ?? Math.min(3, currentLevel + 1);
    if (currentLevel >= 3) {
        return { ok: false, reason: 'upgradeCardMaxLevel' };
    }
    if (desiredLevel <= currentLevel) {
        return { ok: false, reason: 'upgradeCardMaxLevel' };
    }

    // 计算实际 CP 消耗
    const previousUpgradeCost = player.upgradeCardByAbilityId?.[targetAbilityId]?.cpCost;
    let actualCost = card.cpCost;
    if (previousUpgradeCost !== undefined && currentLevel > 1) {
        actualCost = Math.max(0, card.cpCost - previousUpgradeCost);
    }
    
    const playerCp = player.resources[RESOURCE_IDS.CP] ?? 0;
    if (actualCost > 0 && playerCp < actualCost) {
        return { ok: false, reason: 'notEnoughCp' };
    }
    
    return { ok: true };
};

/**
 * 检查是否可以售卖卡牌
 */
export const canSellCard = (
    state: DiceThroneCore,
    playerId: PlayerId
): boolean => {
    // 仅当前玩家可售卖
    return playerId === state.activePlayerId;
};

/**
 * 检查是否可以撤回售卖
 */
export const canUndoSell = (
    state: DiceThroneCore,
    playerId: PlayerId
): boolean => {
    if (playerId !== state.activePlayerId) return false;
    const lastSoldCardId = state.lastSoldCardId;
    if (!lastSoldCardId) return false;
    const player = state.players[playerId];
    if (!player) return false;
    return player.discard.some(card => card.id === lastSoldCardId);
};

// ============================================================================
// 响应窗口检测
// ============================================================================

/**
 * 检查卡牌效果是否对对手生效
 * 用于决定打出卡牌后是否需要触发响应窗口
 */
const rollBranchTargetsOpponent = (
    branch?: RollDieConditionalEffect | RollDieDefaultEffect
): boolean => {
    if (!branch) return false;
    return branch.grantStatus?.target === 'opponent'
        || branch.grantToken?.target === 'opponent'
        || (branch.grantTokens?.some((grant) => grant.target === 'opponent') ?? false);
};

export const hasOpponentTargetEffect = (card: AbilityCard): boolean => {
    if (!card.effects || card.effects.length === 0) return false;
    
    return card.effects.some(effect => {
        if (!effect.action) return false;
        const action = effect.action;
        if (
            action.type === 'custom'
            && action.customActionId
            && isCustomActionCategory(action.customActionId, 'dice')
        ) {
            return false;
        }
        if (action.target === 'opponent') {
            return true;
        }
        if (action.target === 'select') {
            return true;
        }
        if (action.type === 'custom' && action.customActionId === 'transfer-status') {
            // transfer-status 虽然声明 target=self，但交互可跨玩家转移状态，属于可被响应的对局级影响。
            return true;
        }
        if (action.type === 'rollDie') {
            return (action.conditionalEffects?.some(rollBranchTargetsOpponent) ?? false)
                || rollBranchTargetsOpponent(action.defaultEffect);
        }
        return false;
    });
};

const rollBranchNeedsSelectedDefender = (
    branch?: RollDieConditionalEffect | RollDieDefaultEffect
): boolean => {
    if (!branch) return false;
    return branch.grantStatus?.target === 'opponent'
        || branch.grantToken?.target === 'opponent'
        || (branch.grantTokens?.some((grant) => grant.target === 'opponent') ?? false);
};

const actionNeedsSelectedDefender = (
    action: NonNullable<AbilityCard['effects']>[number]['action']
): boolean => {
    if (!action) return false;

    if (action.type === 'rollDie') {
        return (action.conditionalEffects?.some(rollBranchNeedsSelectedDefender) ?? false)
            || rollBranchNeedsSelectedDefender(action.defaultEffect);
    }

    if (action.target === 'opponent') {
        return true;
    }

    if (action.type === 'custom' && action.customActionId) {
        return getCustomActionMeta(action.customActionId)?.requiresSelectedDefender ?? false;
    }

    return false;
};

export const cardNeedsSelectedDefender = (card: AbilityCard): boolean => {
    if (!card.effects?.length) return false;
    return card.effects.some((effect) => effect.action ? actionNeedsSelectedDefender(effect.action) : false);
};

/**
 * 检查卡牌在当前响应窗口类型下是否可用
 * 基于 windowType 和卡牌的 playCondition 精确检测
 */
export const isCardPlayableInResponseWindow = (
    state: DiceThroneCore,
    playerId: PlayerId,
    card: AbilityCard,
    windowType: DtResponseWindowType,
    phase: TurnPhase
): boolean => {
    return checkPlayCard(state, playerId, card, phase, windowType).ok;
};

export const getPlayableCardsInResponseWindow = (
    state: DiceThroneCore,
    playerId: PlayerId,
    windowType: DtResponseWindowType,
    phase: TurnPhase
): AbilityCard[] => {
    const player = state.players[playerId];
    if (!player) return [];

    return player.hand.filter((card) => checkPlayCard(state, playerId, card, phase, windowType).ok);
};

/**
 * 检查卡牌是否有骰子相关效果
 * 
 * 通过元数据查询判断，不依赖命名约定
 * - 通用 action 类型：rollDie / modifyDie / rerollDie / grantExtraRoll / addRollCount / setDieValue
 * - custom action：通过 isCustomActionCategory(actionId, 'dice') 查询元数据
 */
const hasAnyDiceEffect = (card: AbilityCard): boolean => {
    if (!card.effects || card.effects.length === 0) return false;
    
    return card.effects.some(effect => {
        if (!effect.action) return false;
        const action = effect.action;
        
        // 通用骰子 action 类型（已实现 + 预留）
        // 注：预留类型待实现后添加 - rollDie, modifyDie, rerollDie, grantExtraRoll, addRollCount, setDieValue
        // 当前仅通过 custom action 实现骰子相关效果
        
        // custom action：通过元数据查询分类
        if (action.type === 'custom' && action.customActionId) {
            return isCustomActionCategory(action.customActionId, 'dice');
        }
        
        return false;
    });
};

const EXISTING_DICE_TOOL_CUSTOM_ACTION_IDS = new Set([
    'modify-die-to-6',
    'modify-die-copy',
    'modify-die-any-1',
    'modify-die-any-2',
    'modify-die-adjust-1',
    'reroll-opponent-die-1',
    'reroll-die-2',
    'reroll-die-5',
]);

/**
 * 是否直接修改或重掷当前已经存在的骰子。
 *
 * 这是“确认骰后”响应窗口的唯一资格；投出一颗新的奖励骰不属于改骰。
 */
export const hasExistingDiceToolEffect = (card: AbilityCard): boolean => {
    if (!card.effects || card.effects.length === 0) return false;

    return card.effects.some(effect => {
        const action = effect.action;
        return action?.type === 'custom'
            && !!action.customActionId
            && EXISTING_DICE_TOOL_CUSTOM_ACTION_IDS.has(action.customActionId);
    });
};

/**
 * 检查卡牌是否有任何可执行的效果 action
 * 用于 thenBreakpoint 窗口过滤无实际响应效果的卡牌
 */
const hasAnyActionEffect = (card: AbilityCard): boolean => {
    if (!card.effects || card.effects.length === 0) return false;
    return card.effects.some(effect => !!effect.action);
};

const hasAfterCardPlayedResponseEffect = (card: AbilityCard): boolean => {
    if (!card.effects || card.effects.length === 0) return false;

    return card.effects.some(effect => {
        const action = effect.action;
        if (!action || action.type !== 'custom' || !action.customActionId) {
            return false;
        }
        if (isCustomActionCategory(action.customActionId, 'dice')) {
            return false;
        }
        if (isCustomActionCategory(action.customActionId, 'resource')) {
            return action.target === 'self';
        }
        return false;
    });
};

/**
 * 获取卡牌骰子效果的目标
 * 返回 'self' / 'opponent' / 'any' / 'unknown'
 * 
 * 用于 afterRollConfirmed 响应窗口中检查卡牌是否可用：
 * - 'self' 的卡牌：只有骰子主人（rollerId）能用
 * - 'opponent' 的卡牌：只有对手能用
 * - 'any'/'select' 的卡牌：可以选择任意玩家的骰子
 */
const getDiceEffectTarget = (card: AbilityCard): 'self' | 'opponent' | 'any' | 'unknown' => {
    if (!card.effects || card.effects.length === 0) return 'unknown';
    
    // 查找第一个骰子相关效果的 target
    for (const effect of card.effects) {
        if (!effect.action) continue;
        const action = effect.action;
        
        // 检查是否是骰子效果
        if (action.type === 'custom' && action.customActionId) {
            if (isCustomActionCategory(action.customActionId, 'dice')) {
                // 返回效果目标
                if (action.target === 'self') return 'self';
                if (action.target === 'opponent') return 'opponent';
                if (action.target === 'select') return 'any';
            }
        }
    }
    
    return 'unknown';
};

/**
 * 检测玩家是否有可响应的内容（卡牌或消耗性状态效果）
 * 用于决定是否将玩家加入响应队列
 * 
 * @param state 游戏状态
 * @param playerId 要检测的玩家 ID
 * @param windowType 窗口类型
 * @param _sourceId 来源卡牌/技能 ID（预留）
 */
export const hasRespondableContent = (
    state: DiceThroneCore,
    playerId: PlayerId,
    windowType: DtResponseWindowType,
    _sourceId: string | undefined,
    phase: TurnPhase
): boolean => {
    const player = state.players[playerId];
    if (!player) return false;

    if (getPlayableCardsInResponseWindow(state, playerId, windowType, phase).length > 0) {
        return true;
    }

    // 检查是否有可消耗的状态效果（passiveTrigger.timing='manual'）
    for (const tokenDef of (state.tokenDefinitions ?? [])) {
        if (tokenDef.passiveTrigger?.timing !== 'manual') continue;
        const stacks = player.statusEffects[tokenDef.id] ?? 0;
        if (stacks > 0) {
            return true;
        }
    }

    // 奖励骰已投出后，只有实际能重投当前骰区的被动能力才算介入手段。
    // 抽牌、建造等“任意时刻”动作不能凭 timing 字样插入奖励骰介入窗口；
    // 无响应时仍回到右侧骰盘普通确认，而不是自动结算。
    if (hasUsableDiceRerollPassiveAction(state, playerId, phase)) {
        return true;
    }

    return false;
};

/**
 * 获取响应窗口的有效响应者队列
 * 只包含有可响应内容的玩家
 * 
 * @param state 游戏状态
 * @param windowType 窗口类型
 * @param triggerId 触发响应的玩家 ID（这个玩家在队列中排在最前）
 * @param sourceId 来源卡牌/技能 ID
 * @param excludeId 要排除的玩家 ID（通常是当前行动玩家，因为可以主动出牌）
 */
export const getResponderQueue = (
    state: DiceThroneCore,
    windowType: DtResponseWindowType,
    triggerId: PlayerId,
    sourceId: string | undefined,
    excludeId: PlayerId | undefined,
    phase: TurnPhase
): PlayerId[] => {
    const allPlayers = getPlayerOrder(state);
    const queue: PlayerId[] = [];
    const shouldExcludeSameTeam = isTeamMode(state);
    const isBlockedByTeamRule = (playerId: PlayerId): boolean => (
        shouldExcludeSameTeam
        && playerId !== triggerId
        && areTeammates(state, playerId, triggerId)
    );
    
    // 触发者优先（如果有可响应内容且未被排除）
    if (triggerId !== excludeId && hasRespondableContent(state, triggerId, windowType, sourceId, phase)) {
        queue.push(triggerId);
    }
    
    // 其他玩家（排除 excludeId）
    for (const pid of allPlayers) {
        if (pid === triggerId) continue;
        if (pid === excludeId) continue;
        if (isBlockedByTeamRule(pid)) continue;
        if (hasRespondableContent(state, pid, windowType, sourceId, phase)) {
            queue.push(pid);
        }
    }
    
    return queue;
};

// ============================================================================
// 权限检查
// ============================================================================

/**
 * 检查玩家是否有权执行操作
 */
export const isMoveAllowed = (
    playerId: PlayerId | null | undefined,
    expectedId: PlayerId | undefined
): boolean => {
    if (playerId === null || playerId === undefined) return true;
    return expectedId !== undefined && playerId === expectedId;
};
