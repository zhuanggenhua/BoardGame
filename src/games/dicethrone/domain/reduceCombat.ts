/**
 * DiceThrone 战斗相关事件处理器
 * 从 reducer.ts 提取
 */

import type { DiceThroneCore, DiceThroneEvent } from './types';
import { TOKEN_IDS } from './ids';
import { resourceSystem } from './resourceSystem';
import { RESOURCE_IDS } from './resources';
import { STATUS_IDS } from './ids';
import { getFaceCounts, getActiveDice, getTeamId, isTeamMode } from './rules';
import { isTreantTreeSpiritToken } from './passiveAbility';
import { getPendingAttackSettlementStage, updatePendingAttackSettlementStage } from './utils';

type EventHandler<E extends DiceThroneEvent> = (
    state: DiceThroneCore,
    event: E
) => DiceThroneCore;

const buildPlayersWithSyncedHp = (
    state: DiceThroneCore,
    targetId: string,
    newHp: number
): DiceThroneCore['players'] => {
    const target = state.players[targetId];
    if (!target) return state.players;

    if (!isTeamMode(state)) {
        return {
            ...state.players,
            [targetId]: {
                ...target,
                resources: { ...target.resources, [RESOURCE_IDS.HP]: newHp },
            },
        };
    }

    const teamId = getTeamId(state, targetId);
    if (!teamId) return state.players;

    const nextPlayers = { ...state.players };
    Object.entries(state.players).forEach(([playerId, player]) => {
        if (getTeamId(state, playerId) !== teamId) return;
        nextPlayers[playerId] = {
            ...player,
            resources: { ...player.resources, [RESOURCE_IDS.HP]: newHp },
        };
    });
    return nextPlayers;
};

const buildNextTeamHealth = (
    state: DiceThroneCore,
    targetId: string,
    newHp: number
): DiceThroneCore['teamHealth'] => {
    if (!isTeamMode(state)) return state.teamHealth;
    const teamId = getTeamId(state, targetId);
    if (!teamId) return state.teamHealth;
    const resolveTeamHealth = (id: 'A' | 'B') => {
        if (state.teamHealth?.[id] !== undefined) {
            return state.teamHealth[id]!;
        }
        for (const [playerId, player] of Object.entries(state.players)) {
            if (getTeamId(state, playerId) === id) {
                return player.resources[RESOURCE_IDS.HP] ?? 0;
            }
        }
        return undefined;
    };
    const baseA = resolveTeamHealth('A');
    const baseB = resolveTeamHealth('B');
    return {
        A: teamId === 'A' ? newHp : (baseA ?? newHp),
        B: teamId === 'B' ? newHp : (baseB ?? newHp),
    };
};

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
 * 处理防御方效果结算事件
 */
export const handleAttackDefenseResolved: EventHandler<Extract<DiceThroneEvent, { type: 'ATTACK_DEFENSE_RESOLVED' }>> = (
    state,
    event
) => {
    const { attackerId, defenderId, defenseAbilityId } = event.payload;
    if (!state.pendingAttack) return state;

    const pa = state.pendingAttack;
    const matches = pa.attackerId === attackerId
        && pa.defenderId === defenderId
        && (!defenseAbilityId || pa.defenseAbilityId === defenseAbilityId);

    return matches
        ? { ...state, pendingAttack: { ...pa, defenseResolved: true } }
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
    const { targetId, amount, actualDamage, sourceAbilityId, bypassShields, damageScope } = event.payload;
    const target = state.players[targetId];

    if (!target) {
        return state;
    }

    const currentAttackAttackerId = state.pendingAttack?.attackerId;
    const sourcePlayerId = event.payload.sourcePlayerId ?? currentAttackAttackerId;
    const sourcePlayer = sourcePlayerId ? state.players[sourcePlayerId] : undefined;
    const parleyStacks = sourcePlayer?.statusEffects?.[STATUS_IDS.PARLEY] ?? 0;
    const isAttackScopedDamage = damageScope !== 'direct';
    const isCurrentAttackDamage = isAttackScopedDamage
        && Boolean(currentAttackAttackerId)
        && sourcePlayerId === currentAttackAttackerId
        && targetId === state.pendingAttack?.defenderId;

    if (isCurrentAttackDamage && parleyStacks > 0) {
        return {
            ...state,
            pendingAttack: state.pendingAttack
                ? updatePendingAttackSettlementStage(state.pendingAttack, 'postDamagePending')
                : state.pendingAttack,
            lastEffectSourceByPlayerId: sourceAbilityId
                ? { ...(state.lastEffectSourceByPlayerId || {}), [targetId]: sourceAbilityId }
                : state.lastEffectSourceByPlayerId,
        };
    }

    // 使用 amount（原始伤害）而不是 actualDamage 来计算护盾消耗
    // 这样可以避免低血量时护盾被错误地跳过
    const damageForShields = amount ?? actualDamage;
    let remainingDamage = damageForShields;
    let newDamageShields = target.damageShields;
    const shieldsConsumed: Array<{ sourceId: string; value?: number; reductionPercent?: number; absorbed: number }> = [];

    // 终极技能（Ultimate）伤害不可被护盾抵消（规则FAQ：Not This Time 不能防御 Ultimate）
    const isUltimateDamage = state.pendingAttack?.isUltimate ?? false;

    // 消耗护盾抵消伤害（忽略 preventStatus 护盾）
    // bypassShields: HP 重置类效果（如神圣祝福）跳过护盾消耗
    // isUltimateDamage: 终极技能伤害跳过护盾
    // 优先级：百分比护盾 > 固定值护盾（百分比护盾先消耗）
    if (!bypassShields && !isUltimateDamage && target.damageShields && target.damageShields.length > 0 && remainingDamage > 0) {
        const updatedShields: typeof target.damageShields = [];
        
        // 分离护盾类型
        const percentShields = target.damageShields.filter(s => !s.preventStatus && s.reductionPercent !== undefined);
        const fixedShields = target.damageShields.filter(s => !s.preventStatus && s.reductionPercent === undefined);
        const statusShields = target.damageShields.filter(s => s.preventStatus);
        
        // 先消耗百分比护盾
        for (const shield of percentShields) {
            if (remainingDamage > 0) {
                const reductionAmount = Math.ceil(remainingDamage * (shield.reductionPercent! / 100));
                remainingDamage -= reductionAmount;
                shieldsConsumed.push({
                    sourceId: shield.sourceId,
                    reductionPercent: shield.reductionPercent,
                    absorbed: reductionAmount,
                });
                // 百分比护盾消耗后不保留（一次性使用）
            }
        }
        
        // 再消耗固定值护盾
        for (const shield of fixedShields) {
            if (remainingDamage > 0) {
                const preventedAmount = Math.min(shield.value, remainingDamage);
                remainingDamage -= preventedAmount;
                
                shieldsConsumed.push({
                    sourceId: shield.sourceId,
                    value: shield.value,
                    absorbed: preventedAmount,
                });
                
                // 如果护盾还有剩余值，保留护盾
                const remainingShieldValue = shield.value - preventedAmount;
                if (remainingShieldValue > 0) {
                    updatedShields.push({ ...shield, value: remainingShieldValue });
                }
            } else {
                // 没有剩余伤害了，后续护盾全部保留
                updatedShields.push(shield);
            }
        }
        
        // preventStatus 护盾始终保留
        updatedShields.push(...statusShields);
        
        newDamageShields = updatedShields;
    }
    
    // 回填护盾消耗信息到事件 payload
    if (shieldsConsumed.length > 0) {
        event.payload.shieldsConsumed = shieldsConsumed;
    }

    const hpBefore = target.resources[RESOURCE_IDS.HP] ?? 0;
    let newResources = target.resources;
    if (remainingDamage > 0) {
        const result = resourceSystem.modify(target.resources, RESOURCE_IDS.HP, -remainingDamage);
        newResources = result.pool;
    }

    const hpAfter = newResources[RESOURCE_IDS.HP] ?? 0;
    const netHpLoss = Math.max(0, hpBefore - hpAfter);

    let pendingAttack = state.pendingAttack;
    // 统一累计“本次攻击对防御方造成的净掉血”，作为 lastResolvedAttackDamage 的单一来源。
    if (pendingAttack && isCurrentAttackDamage) {
        const nextStage = pendingAttack.postDamageFollowUpResolved === true
            ? 'readyToResolve'
            : 'postDamagePending';
        pendingAttack = updatePendingAttackSettlementStage({
            ...pendingAttack,
            resolvedDamage: (pendingAttack.resolvedDamage ?? 0) + netHpLoss,
        }, nextStage)!;
    }

    const syncedPlayers = buildPlayersWithSyncedHp(state, targetId, hpAfter);
    const nextTarget = syncedPlayers[targetId];

    return {
        ...state,
        players: {
            ...syncedPlayers,
            [targetId]: { ...nextTarget, damageShields: newDamageShields, resources: newResources },
        },
        teamHealth: buildNextTeamHealth(state, targetId, hpAfter),
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

    const syncedPlayers = buildPlayersWithSyncedHp(state, targetId, newResources[RESOURCE_IDS.HP] ?? 0);

    return {
        ...state,
        players: syncedPlayers,
        teamHealth: buildNextTeamHealth(state, targetId, newResources[RESOURCE_IDS.HP] ?? 0),
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
    const activeAttackDice = getActiveDice(state);
    const attackFaceCounts = getFaceCounts(activeAttackDice);
    const attackDiceValues = activeAttackDice
        .map((die) => die.value)
        .filter((value): value is number => Number.isInteger(value) && value >= 1 && value <= 6);
    const attacker = state.players[attackerId];
    const queuedAttackModifierBonusDamage = attacker?.pendingBonusDamage ?? 0;
    const players = attacker?.pendingBonusDamage !== undefined
        ? {
            ...state.players,
            [attackerId]: {
                ...attacker,
                pendingBonusDamage: undefined,
            },
        }
        : state.players;

    return {
        ...state,
        players,
        pendingAttack: {
            attackerId,
            defenderId,
            settlementStage: defenderId === undefined ? 'targeting' : 'preDamage',
            isDefendable,
            sourceAbilityId,
            isUltimate,
            damageResolved: false,
            resolvedDamage: 0,
            attackDiceFaceCounts: attackFaceCounts,
            attackDiceValues,
            bonusDamage: queuedAttackModifierBonusDamage,
            attackModifierBonusDamage: queuedAttackModifierBonusDamage,
        },
        lastResolvedAttackDamage: undefined,
        offensiveRollAttackMadeThisTurn: {
            ...(state.offensiveRollAttackMadeThisTurn ?? {}),
            [attackerId]: true,
        },
    };
};

/**
 * 处理攻击修正伤害添加事件
 * 用于攻击修正卡（如红热、月精灵的 volley/watch-out 等）在攻击前增加伤害
 * 
 * 时序处理：
 * - 如果 pendingAttack 存在：直接累加到 pendingAttack.bonusDamage
 * - 如果 pendingAttack 不存在：累加到玩家的 pendingBonusDamage（待处理），等 ATTACK_INITIATED 时转移
 */
export const handleBonusDamageAdded: EventHandler<Extract<DiceThroneEvent, { type: 'BONUS_DAMAGE_ADDED' }>> = (
    state,
    event
) => {
    const { playerId, amount, sourceCardId } = event.payload;
    if (amount === 0) return state;

    if (state.pendingAttack && state.pendingAttack.attackerId === playerId) {
        const pendingDamage = state.pendingDamage?.sourcePlayerId === playerId
            && state.pendingDamage.responseType === 'beforeDamageDealt'
            ? {
                ...state.pendingDamage,
                currentDamage: state.pendingDamage.currentDamage + amount,
                modifiers: [
                    ...(state.pendingDamage.modifiers ?? []),
                    {
                        type: 'token' as const,
                        value: amount,
                        sourceId: sourceCardId,
                        sourceName: sourceCardId,
                    },
                ],
            }
            : state.pendingDamage;

        return {
            ...state,
            pendingAttack: {
                ...state.pendingAttack,
                bonusDamage: (state.pendingAttack.bonusDamage ?? 0) + amount,
                attackModifierBonusDamage: sourceCardId
                    ? (state.pendingAttack.attackModifierBonusDamage ?? 0) + amount
                    : state.pendingAttack.attackModifierBonusDamage,
            },
            pendingDamage,
        };
    }
    
    const player = state.players[playerId];
    if (!player) return state;
    
    return {
        ...state,
        players: {
            ...state.players,
            [playerId]: {
                ...player,
                pendingBonusDamage: (player.pendingBonusDamage ?? 0) + amount,
            },
        },
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
    const defender = defenderId ? state.players[defenderId] : undefined;
    let players = state.players;

    // 攻击结算后清理所有护盾（包括 preventStatus 和普通护盾）
    // 规则：护盾只在单次攻击中生效，攻击结束后全部清理
    if (defenderId && defender?.damageShields?.length) {
        players = {
            ...state.players,
            [defenderId]: { ...defender, damageShields: [] },
        };
    }

    // 同时结算收尾：将防御方 HP 钳制回上限
    const currentDefender = defenderId ? players[defenderId] : undefined;
    if (currentDefender) {
        const result = resourceSystem.setValue(
            currentDefender.resources,
            RESOURCE_IDS.HP,
            currentDefender.resources[RESOURCE_IDS.HP] ?? 0
        );
        if (result.capped) {
            const cappedHp = result.pool[RESOURCE_IDS.HP] ?? 0;
            const syncedPlayers = buildPlayersWithSyncedHp({ ...state, players }, defenderId, cappedHp);
            players = {
                ...syncedPlayers,
                [defenderId]: { ...syncedPlayers[defenderId], resources: result.pool },
            };
        }
    }

    const nextAttackResolvedSequence = (state.attackResolvedSequence ?? 0) + 1;

    return {
        ...state,
        activatingAbilityId: sourceAbilityId || defenseAbilityId,
        players,
        teamHealth: currentDefender
            ? buildNextTeamHealth(state, defenderId!, players[defenderId!]?.resources[RESOURCE_IDS.HP] ?? 0)
            : state.teamHealth,
        pendingAttack: null,
        lastResolvedAttackDamage: state.pendingAttack?.resolvedDamage ?? event.payload.totalDamage,
        attackResolvedSequence: nextAttackResolvedSequence,
    };
};

/**
 * 处理精准 Token 使攻击不可防御事件
 */
export const handleAttackMadeUndefendable = (
    state: DiceThroneCore
): DiceThroneCore => {
    if (!state.pendingAttack) return state;
    const currentStage = getPendingAttackSettlementStage(state.pendingAttack);
    const nextStage = currentStage === 'postDamagePending' || currentStage === 'readyToResolve'
        ? currentStage
        : 'preDamage';
    return {
        ...state,
        pendingAttack: updatePendingAttackSettlementStage(
            { ...state.pendingAttack, isDefendable: false },
            nextStage,
        ),
    };
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
            phaseEntered: false,
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
    const { targetId, value, sourceId, preventStatus, reductionPercent } = event.payload;
    const target = state.players[targetId];
    if (!target) return state;

    const shield = reductionPercent !== undefined
        ? { value: 0, sourceId, preventStatus, reductionPercent }
        : { value, sourceId, preventStatus };

    return {
        ...state,
        players: {
            ...state.players,
            [targetId]: {
                ...target,
                damageShields: [...(target.damageShields || []), shield],
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
) => {
    const pendingAttack = state.pendingAttack;
    if (!pendingAttack) {
        return { ...state, pendingAttack: null, rollConfirmed: false };
    }

    const attackModifierBonusDamage = pendingAttack.attackModifierBonusDamage ?? 0;
    if (attackModifierBonusDamage <= 0) {
        return { ...state, pendingAttack: null, rollConfirmed: false };
    }

    const attackerId = pendingAttack.attackerId;
    const attacker = state.players[attackerId];
    if (!attacker) {
        return { ...state, pendingAttack: null, rollConfirmed: false };
    }

    return {
        ...state,
        pendingAttack: null,
        rollConfirmed: false,
        players: {
            ...state.players,
            [attackerId]: {
                ...attacker,
                pendingBonusDamage: (attacker.pendingBonusDamage ?? 0) + attackModifierBonusDamage,
            },
        },
    };
};

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
    const { playerId, tokenId, amount, effectType, damageModifier, evasionRoll, deferredDamageEvents } = event.payload;

    // 消耗 Token
    let players = state.players;
    const player = state.players[playerId];
    if (player) {
        const currentAmount = player.tokens[tokenId] ?? 0;
        const isArtificerBot = tokenId === TOKEN_IDS.NANOBOT || tokenId === TOKEN_IDS.SHOCK_BOT || tokenId === TOKEN_IDS.HEAL_BOT;
        const nextArtificerBotState = isArtificerBot
            ? {
                ...player.artificerBotState,
                [tokenId]: {
                    ...(player.artificerBotState?.[tokenId] ?? { built: false, upgraded: false, activationsUsedThisTurn: 0 }),
                    built: true,
                    activationsUsedThisTurn: (player.artificerBotState?.[tokenId]?.activationsUsedThisTurn ?? 0) + amount,
                },
            }
            : player.artificerBotState;
        players = {
            ...state.players,
            [playerId]: {
                ...player,
                tokens: {
                    ...player.tokens,
                    [tokenId]: isArtificerBot ? currentAmount : Math.max(0, currentAmount - amount),
                },
                artificerBotState: nextArtificerBotState,
            },
        };
    }

    const treantSpiritSpentThisTurn = isTreantTreeSpiritToken(tokenId)
        ? {
            ...(state.treantSpiritSpentThisTurn ?? {}),
            [playerId]: {
                ...(state.treantSpiritSpentThisTurn?.[playerId] ?? {}),
                [tokenId]: true,
            },
        }
        : state.treantSpiritSpentThisTurn;

    // 更新 pendingDamage / pendingAttack
    // beforeDamageDealt 的 token 加伤既要进入当前响应窗的 pendingDamage，
    // 也要同步回 pendingAttack.bonusDamage，避免后续攻击总伤害查询仍读到旧值。
    let pendingDamage = state.pendingDamage;
    let pendingAttack = state.pendingAttack;
    if (state.pendingDamage) {
        // 获取 Token 名称用于显示
        const tokenDef = state.tokenDefinitions?.find(t => t.id === tokenId);
        const tokenName = tokenDef?.name || tokenId;
        const tokenUsageTotals = {
            ...(state.pendingDamage.tokenUsageTotals ?? {}),
            [tokenId]: (state.pendingDamage.tokenUsageTotals?.[tokenId] ?? 0) + amount,
        };
        
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
                tokenUsageTotals,
                deferredDamageEvents: deferredDamageEvents ?? state.pendingDamage.deferredDamageEvents,
            };
            if (
                state.pendingDamage.responseType === 'beforeDamageDealt'
                && pendingAttack
                && pendingAttack.attackerId === playerId
            ) {
                pendingAttack = {
                    ...pendingAttack,
                    bonusDamage: (pendingAttack.bonusDamage ?? 0) + damageModifier,
                };
            }
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
                tokenUsageTotals,
                deferredDamageEvents: deferredDamageEvents ?? state.pendingDamage.deferredDamageEvents,
            };
        } else if (effectType === 'evasionAttempt') {
            if (evasionRoll?.success) {
                pendingDamage = {
                    ...state.pendingDamage,
                    currentDamage: 0,
                    isFullyEvaded: true,
                    lastEvasionRoll: evasionRoll,
                    tokenUsageTotals,
                    deferredDamageEvents: deferredDamageEvents ?? state.pendingDamage.deferredDamageEvents,
                };
            } else if (evasionRoll) {
                // 闪避失败：显式设置 isFullyEvaded: false
                pendingDamage = {
                    ...state.pendingDamage,
                    isFullyEvaded: false,
                    lastEvasionRoll: evasionRoll,
                    tokenUsageTotals,
                    deferredDamageEvents: deferredDamageEvents ?? state.pendingDamage.deferredDamageEvents,
                };
            }
        } else {
            pendingDamage = {
                ...state.pendingDamage,
                tokenUsageTotals,
                deferredDamageEvents: deferredDamageEvents ?? state.pendingDamage.deferredDamageEvents,
            };
        }
    }

    return { ...state, players, pendingDamage, pendingAttack, treantSpiritSpentThisTurn };
};

/**
 * 处理 Token 响应窗口关闭事件
 */
export const handleTokenResponseClosed: EventHandler<Extract<DiceThroneEvent, { type: 'TOKEN_RESPONSE_CLOSED' }>> = (
    state
) => {
    const pendingAttack = state.pendingAttack
        ? updatePendingAttackSettlementStage(
            { ...state.pendingAttack, damageResolved: true },
            'postDamagePending',
        )
        : state.pendingAttack;

    return { ...state, pendingDamage: undefined, pendingAttack };
};
