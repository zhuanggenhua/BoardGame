/**
 * 圣骑士 (Paladin) 专属 Custom Action 处理器
 */

import { getActiveDice, getFaceCounts, getTokenStackLimit } from '../rules';
import { RESOURCE_IDS } from '../resources';
import { TOKEN_IDS, PALADIN_DICE_FACE_IDS as FACES } from '../ids';
import type {
    DiceThroneEvent,
    TokenGrantedEvent,
    PreventDamageEvent,
} from '../types';
import { CP_MAX } from '../types';
import { registerCustomActionHandler, type CustomActionContext } from '../effects';
import { createDamageCalculation } from '../../../../engine/primitives/damageCalculation';
import { createSelectPlayerInteraction } from '../interactions';

// ============================================================================
// 圣骑士技能处理器
// ============================================================================

/**
 * 神圣防御 (Holy Defense) 逻辑
 */
/**
 * 神圣防御：基于防御投掷的骰面结果计算效果
 * - 剑面→反伤，盔面→防1，心面→防2，祈祷面→1CP
 * - III级额外：2盔+1祈祷→守护
 * 注意：不是额外投骰子，而是读取防御阶段已投的骰子结果
 */
function handleHolyDefenseRoll({ targetId, attackerId: _attackerId, sourceAbilityId, state, timestamp, ctx }: CustomActionContext, _diceCount: number, isLevel3: boolean): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];
    // 防御上下文：ctx.attackerId = 防御者自身，ctx.defenderId = 原攻击者
    const originalAttackerId = ctx.defenderId;

    // 读取防御投掷的骰面计数（防御阶段结束时 state.dice 就是防御方的骰子）
    const faceCounts = getFaceCounts(getActiveDice(state));

    const swordCount = faceCounts[FACES.SWORD] ?? 0;
    const helmCount = faceCounts[FACES.HELM] ?? 0;
    const heartCount = faceCounts[FACES.HEART] ?? 0;
    const prayCount = faceCounts[FACES.PRAY] ?? 0;

    // 1. 造成伤害 (Sword) → 反伤给原攻击者 【已迁移到新伤害计算管线】
    if (swordCount > 0 && originalAttackerId) {
        const damageCalc = createDamageCalculation({
            source: { playerId: targetId, abilityId: sourceAbilityId },
            target: { playerId: originalAttackerId },
            baseDamage: swordCount,
            state,
            timestamp: timestamp + 50,
        });
        events.push(...damageCalc.toEvents());
    }

    // 2. 防止伤害 (Helm + 2*Heart) → 授予临时护盾（攻击结算后清理）
    const preventAmount = (helmCount * 1) + (heartCount * 2);
    if (preventAmount > 0) {
        events.push({
            type: 'DAMAGE_SHIELD_GRANTED',
            payload: { targetId, value: preventAmount, sourceId: sourceAbilityId, preventStatus: false },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 60
        } as DiceThroneEvent);
    }

    // 3. 获得 CP (Pray)
    if (prayCount > 0) {
        const cpAmount = prayCount * 1;
        const currentCp = state.players[targetId]?.resources[RESOURCE_IDS.CP] ?? 0;
        const newCp = Math.min(currentCp + cpAmount, CP_MAX);
        events.push({
            type: 'CP_CHANGED',
            payload: { playerId: targetId, delta: cpAmount, newValue: newCp },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 70,
        });
    }

    // 4. III级特效：2盔+1祈祷→守护
    if (isLevel3 && helmCount >= 2 && prayCount >= 1) {
        const current = state.players[targetId]?.tokens[TOKEN_IDS.PROTECT] ?? 0;
        const limit = getTokenStackLimit(state, targetId, TOKEN_IDS.PROTECT);
        if (current < limit) {
            events.push({
                type: 'TOKEN_GRANTED',
                payload: { targetId, tokenId: TOKEN_IDS.PROTECT, amount: 1, newTotal: current + 1, sourceAbilityId },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: timestamp + 80,
            } as TokenGrantedEvent);
        }
    }

    return events;
}

function handleHolyDefenseRollBase(ctx: CustomActionContext): DiceThroneEvent[] {
    return handleHolyDefenseRoll(ctx, 3, false);
}

function handleHolyDefenseRoll2(ctx: CustomActionContext): DiceThroneEvent[] {
    return handleHolyDefenseRoll(ctx, 4, false);
}

function handleHolyDefenseRoll3(ctx: CustomActionContext): DiceThroneEvent[] {
    return handleHolyDefenseRoll(ctx, 4, true);
} // Corrected: Leve3 passes true

/**
 * 教会税升级 (Upgrade Tithes)
 * 升级被动能力：抽牌费用降为 2CP，触发祈祷面时额外获得 1CP
 */
function handleUpgradeTithes({ targetId, timestamp }: CustomActionContext): DiceThroneEvent[] {
    return [{
        type: 'PASSIVE_ABILITY_UPGRADED',
        payload: {
            playerId: targetId,
            passiveId: 'tithes',
            newLevel: 2,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as DiceThroneEvent];
}

/**
 * 神圣祝福 (Blessing of Divinity) — 免疫致死伤害
 * 当受到致死伤害时，移除此标记，免除伤害并回复 5 HP（最终 HP = 1 + 5 = 6）
 *
 * 规则语义：
 * 1. 只在伤害会致死（damageAmount >= currentHp）时触发
 * 2. 免除全部伤害（PREVENT_DAMAGE）
 * 3. 将 HP 扣至 1（通过 DAMAGE_DEALT 扣除 currentHp - 1）
 * 4. 回复 5 HP（HEAL_APPLIED）→ 最终 HP = 6
 */
function handleBlessingPrevent({ targetId, state, timestamp, action }: CustomActionContext): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];
    const player = state.players[targetId];
    if (!player) return events;

    const blessingCount = player.tokens[TOKEN_IDS.BLESSING_OF_DIVINITY] ?? 0;
    if (blessingCount <= 0) return events;

    // 致死判定：只有伤害 >= 当前 HP 时才触发
    const currentHp = player.resources[RESOURCE_IDS.HP] ?? 0;
    const params = action.params as { damageAmount?: number } | undefined;
    const damageAmount = params?.damageAmount ?? 0;
    if (damageAmount < currentHp) return events;

    // 消耗 1 层神圣祝福
    events.push({
        type: 'TOKEN_CONSUMED',
        payload: {
            playerId: targetId,
            tokenId: TOKEN_IDS.BLESSING_OF_DIVINITY,
            amount: 1,
            newTotal: blessingCount - 1,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as DiceThroneEvent);

    // 免除全部伤害
    events.push({
        type: 'PREVENT_DAMAGE',
        payload: {
            targetId,
            amount: 9999,
            sourceAbilityId: 'paladin-blessing-prevent',
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: timestamp + 1,
    } as PreventDamageEvent);

    // 回复 5 HP（从当前 HP 回复，因为伤害已被免除）
    // 规则："将 HP 设为 1" → 最终 HP = 1
    // 实现：先扣到 1（通过 DAMAGE_DEALT + bypassShields），不回复额外 HP
    // bypassShields: 此扣血是 HP 重置，不应被护盾吸收
    // 【已迁移到新伤害计算管线】
    const hpToRemove = currentHp - 1;
    if (hpToRemove > 0) {
        const damageCalc = createDamageCalculation({
            source: { playerId: targetId, abilityId: 'paladin-blessing-prevent' },
            target: { playerId: targetId },
            baseDamage: hpToRemove,
            state,
            timestamp: timestamp + 2,
            autoCollectShields: false, // bypassShields: 不收集护盾修正
        });
        const damageEvents = damageCalc.toEvents();
        // 手动添加 bypassShields 标记（引擎层暂不支持）
        if (damageEvents[0]?.type === 'DAMAGE_DEALT') {
            (damageEvents[0].payload as any).bypassShields = true;
        }
        events.push(...damageEvents);
    }

    return events;
}

/**
 * 复仇 II 主技能 — 选择任意玩家授予 1 层弹反
 */
function handleVengeanceSelectPlayer({ targetId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    return [createSelectPlayerInteraction({
        playerId: targetId,
        sourceAbilityId,
        count: 1,
        targetPlayerIds: Object.keys(state.players),
        titleKey: 'interaction.selectPlayerForRetribution',
        onResolve: ([selectedPlayerId]) => {
            const currentTokens = state.players[selectedPlayerId]?.tokens[TOKEN_IDS.RETRIBUTION] ?? 0;
            return [{
                type: 'TOKEN_GRANTED',
                payload: {
                    targetId: selectedPlayerId,
                    tokenId: TOKEN_IDS.RETRIBUTION,
                    amount: 1,
                    newTotal: currentTokens + 1,
                    sourceAbilityId,
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp,
            } as TokenGrantedEvent];
        },
    })];
}

/**
 * 祝圣! (Consecrate) — 选择1名玩家获得守护、弹反、暴击和精准
 */
function handleConsecrate({ targetId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    return [createSelectPlayerInteraction({
        playerId: targetId,
        sourceAbilityId,
        count: 1,
        targetPlayerIds: Object.keys(state.players),
        titleKey: 'interaction.selectPlayerForConsecrate',
        onResolve: ([selectedPlayerId]) => {
            const player = state.players[selectedPlayerId];
            if (!player) return [];
            
            const tokens = [
                { tokenId: TOKEN_IDS.PROTECT, amount: 1 },
                { tokenId: TOKEN_IDS.RETRIBUTION, amount: 1 },
                { tokenId: TOKEN_IDS.CRIT, amount: 1 },
                { tokenId: TOKEN_IDS.ACCURACY, amount: 1 },
            ];
            
            return tokens.map((token, index) => {
                const currentTokens = player.tokens[token.tokenId] ?? 0;
                return {
                    type: 'TOKEN_GRANTED',
                    payload: {
                        targetId: selectedPlayerId,
                        tokenId: token.tokenId,
                        amount: token.amount,
                        newTotal: currentTokens + token.amount,
                        sourceAbilityId,
                    },
                    sourceCommandType: 'ABILITY_EFFECT',
                    timestamp: timestamp + index,
                } as TokenGrantedEvent;
            });
        },
    })];
}

// 注册
export function registerPaladinCustomActions(): void {
    registerCustomActionHandler('paladin-holy-defense', handleHolyDefenseRollBase, { categories: ['dice', 'damage', 'defense'] });
    registerCustomActionHandler('paladin-holy-defense-2', handleHolyDefenseRoll2, { categories: ['dice', 'damage', 'defense'] });
    registerCustomActionHandler('paladin-holy-defense-3', handleHolyDefenseRoll3, { categories: ['dice', 'damage', 'defense'] });
    registerCustomActionHandler('paladin-upgrade-tithes', handleUpgradeTithes, { categories: ['resource'] });

    registerCustomActionHandler('paladin-blessing-prevent', handleBlessingPrevent, { categories: ['token', 'defense'] });
    registerCustomActionHandler('paladin-vengeance-select-player', handleVengeanceSelectPlayer, {
        categories: ['token'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('paladin-consecrate', handleConsecrate, {
        categories: ['token'],
        requiresInteraction: true,
    });
}
