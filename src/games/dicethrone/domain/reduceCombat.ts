/**
 * DiceThrone 战斗相关事件处理器
 * 从 reducer.ts 提取
 */

import type { DiceThroneCore, DiceThroneEvent } from './types';
import { resourceSystem } from './resourceSystem';
import { RESOURCE_IDS } from './resources';
import { TOKEN_IDS } from './ids';
import { getFaceCounts, getActiveDice } from './rules';

type EventHandler<E extends DiceThroneEvent> = (
    state: DiceThroneCore,
    event: E
) => DiceThroneCore;

/**
 * 处理伤害减免事件
 * - 若存在 pendingDamage：直接降低当前伤害
 * - 若不存在 pendingDamage：转为一次性护盾，供后续 DAMAGE_DEALT 消耗
 */
export const handlePreventDamage: EventHandler<Extract<DiceThroneEvent, { type: 'PREVENT_DAMAGE' }>> = (
    state,
    event
) => {
    const { targetId, amount, sourceAbilityId, applyImmediately } = event.payload;
    if (amount <= 0) return state;

    let pendingDamage = state.pendingDamage;
    let players = state.players;

    if (state.pendingDamage && state.pendingDamage.targetPlayerId === targetId) {
        const nextDamage = Math.max(0, state.pendingDamage.currentDamage - amount);
        pendingDamage = {
            ...state.pendingDamage,
            currentDamage: nextDamage,
            isFullyEvaded: nextDamage <= 0 ? true : state.pendingDamage.isFullyEvaded,
        };
    } else if (!applyImmediately) {
        const target = state.players[targetId];
        if (target) {
            players = {
                ...state.players,
                [targetId]: {
                    ...target,
                    damageShields: [...(target.damageShields || []), { value: amount, sourceId: sourceAbilityId, preventStatus: false }],
                },
            };
        }
    }

    return {
        ...state,
        pendingDamage,
        players,
        lastEffectSourceByPlayerId: sourceAbilityId
            ? { ...(state.lastEffectSourceByPlayerId || {}), [targetId]: sourceAbilityId }
            : state.lastEffectSourceByPlayerId,
    };
};

/**
 * 处理进攻方前置防御结算事件
 */
export const handleAttackPreDefenseResolved: EventHandler<Extract<DiceThroneEvent, { type: 'ATTACK_PRE_DEFENSE_RESOLVED' }>> = (
    state,
    event
) => {
    const { attackerId, defenderId, sourceAbilityId } = event.payload;
    if (!state.pendingAttack) return state;

    const pa = state.pendingAttack;
    const matches = pa.attackerId === attackerId
        && pa.defenderId === defenderId
        && (!sourceAbilityId || pa.sourceAbilityId === sourceAbilityId);

    return matches
        ? { ...state, pendingAttack: { ...pa, preDefenseResolved: true } }
        : state;
};

/**
 * 处理伤害事件
 * 注意：伤害先经过护盾抵消，剩余伤害再扣血
 */
export const handleDamageDealt: EventHandler<Extract<DiceThroneEvent, { type: 'DAMAGE_DEALT' }>> = (
    state,
    event
) => {
    const { targetId, actualDamage, sourceAbilityId, bypassShields } = event.payload;
    const target = state.players[targetId];

    if (!target) {
        return state;
    }

    let remainingDamage = actualDamage;
    let newDamageShields = target.damageShields;

    // 消耗护盾抵消伤害（忽略 preventStatus 护盾）
    // bypassShields: HP 重置类效果（如神圣祝福）跳过护盾消耗
    if (!bypassShields && target.damageShields && target.damageShields.length > 0 && remainingDamage > 0) {
        const statusShields = target.damageShields.filter(shield => shield.preventStatus);
        const damageShields = target.damageShields.filter(shield => !shield.preventStatus);
        if (damageShields.length > 0) {
            const shield = damageShields[0];
            const preventedAmount = Math.min(shield.value, remainingDamage);
            remainingDamage -= preventedAmount;
            newDamageShields = statusShields;
        }
    }

    const hpBefore = target.resources[RESOURCE_IDS.HP] ?? 0;
    let newResources = target.resources;
    if (remainingDamage > 0) {
        const result = resourceSystem.modify(target.resources, RESOURCE_IDS.HP, -remainingDamage);
        newResources = result.pool;
    }

    let newTokens = target.tokens;
    let hpAfter = newResources[RESOURCE_IDS.HP] ?? 0;

    // 神圣祝福致死保护（reducer 层兜底）
    // 规则：HP 降到 0 以下时，消耗 1 层神圣祝福，HP 设为 1
    // 在 reducer 层统一处理，确保所有伤害路径（直接攻击、Token 响应窗口结算、弹反等）都能触发
    const blessingCount = target.tokens?.[TOKEN_IDS.BLESSING_OF_DIVINITY] ?? 0;
    if (hpAfter <= 0 && blessingCount > 0) {
        newTokens = { ...target.tokens, [TOKEN_IDS.BLESSING_OF_DIVINITY]: blessingCount - 1 };
        // HP 从当前值（<=0）回到 1
        const hpResetResult = resourceSystem.modify(newResources, RESOURCE_IDS.HP, 1 - hpAfter);
        newResources = hpResetResult.pool;
        hpAfter = 1;
    }

    const netHpLoss = Math.max(0, hpBefore - hpAfter);

    let pendingAttack = state.pendingAttack;
    // 统一累计"本次攻击对防御方造成的净掉血"，作为 lastResolvedAttackDamage 的单一来源。
    if (pendingAttack && targetId === pendingAttack.defenderId) {
        pendingAttack = {
            ...pendingAttack,
            resolvedDamage: (pendingAttack.resolvedDamage ?? 0) + netHpLoss,
        };
    }

    return {
        ...state,
        players: {
            ...state.players,
            [targetId]: { ...target, damageShields: newDamageShields, resources: newResources, tokens: newTokens },
        },
        pendingAttack,
        lastEffectSourceByPlayerId: sourceAbilityId
            ? { ...(state.lastEffectSourceByPlayerId || {}), [targetId]: sourceAbilityId }
            : state.lastEffectSourceByPlayerId,
    };
};

/**
 * 处理治疗事件
 *
 * 规则 §3.6 Step 6 同时结算：攻击结算期间（pendingAttack 存在），
 * 防御方的治疗不受 HP 上限限制（允许临时超上限），
 * 等 ATTACK_RESOLVED 时再钳制回上限。
 * 这样治疗和伤害的事件保持原始数值，动画正常播放。
 */
export const handleHealApplied: EventHandler<Extract<DiceThroneEvent, { type: 'HEAL_APPLIED' }>> = (
    state,
    event
) => {
    const { targetId, amount, sourceAbilityId } = event.payload;
    const target = state.players[targetId];
    if (!target) return state;

    // 攻击结算期间，防御方治疗跳过 HP 上限（同时结算）
    const isDefenderDuringAttack = state.pendingAttack && targetId === state.pendingAttack.defenderId;
    let newResources;
    if (isDefenderDuringAttack) {
        // 不传 bounds，HP 可临时超上限
        const currentHp = target.resources[RESOURCE_IDS.HP] ?? 0;
        newResources = { ...target.resources, [RESOURCE_IDS.HP]: currentHp + amount };
    } else {
        const result = resourceSystem.modify(target.resources, RESOURCE_IDS.HP, amount);
        newResources = result.pool;
    }

    return {
        ...state,
        players: {
            ...state.players,
            [targetId]: { ...target, resources: newResources },
        },
        lastEffectSourceByPlayerId: sourceAbilityId
            ? { ...(state.lastEffectSourceByPlayerId || {}), [targetId]: sourceAbilityId }
            : state.lastEffectSourceByPlayerId,
    };
};

/**
 * 处理攻击发起事件
 */
export const handleAttackInitiated: EventHandler<Extract<DiceThroneEvent, { type: 'ATTACK_INITIATED' }>> = (
    state,
    event
) => {
    const { attackerId, defenderId, sourceAbilityId, isDefendable, isUltimate } = event.payload;
    const attackFaceCounts = getFaceCounts(getActiveDice(state));

    return {
        ...state,
        pendingAttack: {
            attackerId,
            defenderId,
            isDefendable,
            sourceAbilityId,
            isUltimate,
            damageResolved: false,
            resolvedDamage: 0,
            attackDiceFaceCounts: attackFaceCounts,
        },
        lastResolvedAttackDamage: undefined,
    };
};

/**
 * 处理攻击结算事件
 *
 * 规则 §3.6 Step 6 同时结算收尾：
 * 攻击结算完成后，将防御方 HP 钳制回上限（消除临时超上限）。
 */
export const handleAttackResolved: EventHandler<Extract<DiceThroneEvent, { type: 'ATTACK_RESOLVED' }>> = (
    state,
    event
) => {
    const { sourceAbilityId, defenseAbilityId, defenderId } = event.payload;
    const defender = state.players[defenderId];
    let players = state.players;

    // 攻击结算后清理所有护盾（包括 preventStatus 和普通护盾）
    // 规则：护盾只在单次攻击中生效，攻击结束后全部清理
    if (defender?.damageShields?.length) {
        players = {
            ...state.players,
            [defenderId]: { ...defender, damageShields: [] },
        };
    }

    // 同时结算收尾：将防御方 HP 钳制回上限
    const currentDefender = players[defenderId];
    if (currentDefender) {
        const result = resourceSystem.setValue(
            currentDefender.resources,
            RESOURCE_IDS.HP,
            currentDefender.resources[RESOURCE_IDS.HP] ?? 0
        );
        if (result.capped) {
            players = {
                ...players,
                [defenderId]: { ...currentDefender, resources: result.pool },
            };
        }
    }

    return {
        ...state,
        activatingAbilityId: sourceAbilityId || defenseAbilityId,
        players,
        pendingAttack: null,
        lastResolvedAttackDamage: state.pendingAttack?.resolvedDamage ?? event.payload.totalDamage,
    };
};

/**
 * 处理精准 Token 使攻击不可防御事件
 */
export const handleAttackMadeUndefendable = (
    state: DiceThroneCore
): DiceThroneCore => {
    if (!state.pendingAttack) return state;
    return { ...state, pendingAttack: { ...state.pendingAttack, isDefendable: false } };
};

/**
 * 处理额外攻击触发事件（晕眩 daze）
 */
export const handleExtraAttackTriggered: EventHandler<Extract<DiceThroneEvent, { type: 'EXTRA_ATTACK_TRIGGERED' }>> = (
    state,
    event
): DiceThroneCore => {
    const { attackerId } = event.payload;
    return {
        ...state,
        extraAttackInProgress: {
            attackerId,
            originalActivePlayerId: state.activePlayerId,
        },
    };
};

/**
 * 处理护盾授予事件
 */
export const handleDamageShieldGranted: EventHandler<Extract<DiceThroneEvent, { type: 'DAMAGE_SHIELD_GRANTED' }>> = (
    state,
    event
) => {
    const { targetId, value, sourceId, preventStatus } = event.payload;
    const target = state.players[targetId];
    if (!target) return state;

    return {
        ...state,
        players: {
            ...state.players,
            [targetId]: {
                ...target,
                damageShields: [...(target.damageShields || []), { value, sourceId, preventStatus }],
            },
        },
    };
};

/**
 * 处理伤害被护盾阻挡事件（纯 UI/日志用途，不修改状态）
 */
export const handleDamagePrevented: EventHandler<Extract<DiceThroneEvent, { type: 'DAMAGE_PREVENTED' }>> = (
    state
) => state;

/**
 * 技能重选事件（骰面被修改后触发）
 */
export const handleAbilityReselectionRequired: EventHandler<Extract<DiceThroneEvent, { type: 'ABILITY_RESELECTION_REQUIRED' }>> = (
    state
) => ({ ...state, pendingAttack: null, rollConfirmed: false });

// ============================================================================
// Token 响应窗口事件处理
// ============================================================================

/**
 * 处理 Token 响应窗口打开事件
 */
export const handleTokenResponseRequested: EventHandler<Extract<DiceThroneEvent, { type: 'TOKEN_RESPONSE_REQUESTED' }>> = (
    state,
    event
) => {
    return { ...state, pendingDamage: event.payload.pendingDamage };
};

/**
 * 处理 Token 使用事件
 */
export const handleTokenUsed: EventHandler<Extract<DiceThroneEvent, { type: 'TOKEN_USED' }>> = (
    state,
    event
) => {
    const { playerId, tokenId, amount, effectType, damageModifier, evasionRoll } = event.payload;

    // 消耗 Token
    let players = state.players;
    const player = state.players[playerId];
    if (player) {
        const currentAmount = player.tokens[tokenId] ?? 0;
        players = {
            ...state.players,
            [playerId]: { ...player, tokens: { ...player.tokens, [tokenId]: Math.max(0, currentAmount - amount) } },
        };
    }

    // 更新 pendingDamage
    let pendingDamage = state.pendingDamage;
    if (state.pendingDamage) {
        // 获取 Token 名称用于显示
        const tokenDef = state.tokenDefinitions?.find(t => t.id === tokenId);
        const tokenName = tokenDef?.name || tokenId;
        
        if (effectType === 'damageBoost' && damageModifier) {
            const modifiers = [...(state.pendingDamage.modifiers || [])];
            modifiers.push({
                type: 'token',
                value: damageModifier,
                sourceId: tokenId,
                sourceName: tokenName,
            });
            pendingDamage = { 
                ...state.pendingDamage, 
                currentDamage: state.pendingDamage.currentDamage + damageModifier,
                modifiers,
            };
        } else if (effectType === 'damageReduction' && damageModifier) {
            const modifiers = [...(state.pendingDamage.modifiers || [])];
            modifiers.push({
                type: 'token',
                value: damageModifier,
                sourceId: tokenId,
                sourceName: tokenName,
            });
            pendingDamage = { 
                ...state.pendingDamage, 
                currentDamage: Math.max(0, state.pendingDamage.currentDamage + damageModifier),
                modifiers,
            };
        } else if (effectType === 'evasionAttempt') {
            if (evasionRoll?.success) {
                pendingDamage = { ...state.pendingDamage, currentDamage: 0, isFullyEvaded: true, lastEvasionRoll: evasionRoll };
            } else if (evasionRoll) {
                // 闪避失败：显式设置 isFullyEvaded: false
                pendingDamage = { ...state.pendingDamage, isFullyEvaded: false, lastEvasionRoll: evasionRoll };
            }
        }
    }

    return { ...state, players, pendingDamage };
};

/**
 * 处理 Token 响应窗口关闭事件
 */
export const handleTokenResponseClosed: EventHandler<Extract<DiceThroneEvent, { type: 'TOKEN_RESPONSE_CLOSED' }>> = (
    state,
    event
) => {
    const pendingAttack = state.pendingAttack
        ? { ...state.pendingAttack, damageResolved: true }
        : state.pendingAttack;

    return { ...state, pendingDamage: undefined, pendingAttack };
};
