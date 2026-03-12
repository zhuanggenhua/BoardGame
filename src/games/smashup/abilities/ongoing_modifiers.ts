/**
 * 大杀四方 - 持续力量修正能力注册
 *
 * 将各派系的 ongoing 力量修正注册到 ongoingModifiers 系统。
 * （在 initAllAbilities() 中调用）
 */

import { registerPowerModifier, registerOngoingPowerModifier, registerBasePowerModifier, registerBreakpointModifier } from '../domain/ongoingModifiers';
import type { PowerModifierContext } from '../domain/ongoingModifiers';
import type { MinionOnBase, SmashUpCore } from '../domain/types';
import { getBaseDef } from '../data/cards';
import { isMicrobot } from '../domain/utils';
import type { PlayerId } from '../../../engine/types';

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 检查随从是否匹配指定的 defId（包括 POD 版本）
 */
function matchesDefId(minion: MinionOnBase, baseDefId: string): boolean {
    return minion.defId === baseDefId || minion.defId === baseDefId + '_pod';
}

/**
 * 计算场上匹配指定 defId 的随从数量（包括 POD 版本）
 */
function countMinionsWithDefId(
    state: SmashUpCore,
    baseDefId: string,
    controller?: PlayerId
): number {
    let count = 0;
    for (const base of state.bases) {
        count += base.minions.filter(
            m => matchesDefId(m, baseDefId) && (controller === undefined || m.controller === controller)
        ).length;
    }
    return count;
}

// ============================================================================
// 恐龙派系
// ============================================================================

function registerDinosaurModifiers(): void {
    // 重装剑龙：其他玩家回合时 +2 力量
    // 原版：永久被动 ongoing，不需要使用天赋
    // POD 版：需要先使用天赋（talentUsed=true），然后在别人回合时 +2
    registerPowerModifier('dino_armor_stego', (ctx: PowerModifierContext) => {
        const baseId = ctx.minion.defId.replace(/_pod$/, '');
        if (baseId !== 'dino_armor_stego') return 0;
        // 当前回合不是自己的回合时才 +2
        const currentPlayer = ctx.state.turnOrder[ctx.state.currentPlayerIndex];
        if (currentPlayer === ctx.minion.controller) return 0;
        // POD 版需要 talentUsed 标记为 true 才生效
        const isPod = ctx.minion.defId.endsWith('_pod');
        if (isPod && !ctx.minion.talentUsed) return 0;
        return 2;
    }, { handlesPodInternally: true });

    // 战争猛禄龙：同基地每个己方战争猛禔龙（含自身）+1 力量
    registerPowerModifier('dino_war_raptor', (ctx: PowerModifierContext) => {
        const baseId = ctx.minion.defId.replace(/_pod$/, '');
        if (baseId !== 'dino_war_raptor') return 0;
        // 将 war_raptor 和 war_raptor_pod 都算入同派系
        const raptorCount = ctx.base.minions.filter(
            m => ['dino_war_raptor', 'dino_war_raptor_pod'].includes(m.defId) && m.controller === ctx.minion.controller
        ).length;
        return raptorCount;
    }, { handlesPodInternally: true });

    // 升级（ongoing 行动卡附着在随从上）：每张 +2 力量
    registerOngoingPowerModifier('dino_upgrade', 'minion', 'self', 2);
}

// ============================================================================
// 机器人派系?
// ============================================================================

function registerRobotModifiers(): void {
    // 微型机阿尔法号：每个其他己方随从（视为微型机）+1 力量
    // "你的所有随从均视为微型机" → 计算场上所有己方其他随从数量
    registerPowerModifier('robot_microbot_alpha', (ctx: PowerModifierContext) => {
        const baseId = ctx.minion.defId.replace(/_pod$/, '');
        if (baseId !== 'robot_microbot_alpha') return 0;
        // 计算场上所有己方其他随从数量（所有基地）
        let otherMinionCount = 0;
        for (const base of ctx.state.bases) {
            for (const m of base.minions) {
                if (m.controller === ctx.minion.controller && m.uid !== ctx.minion.uid) {
                    otherMinionCount++;
                }
            }
        }
        return otherMinionCount;
    }, { handlesPodInternally: true });

    // 微型机修理者 ongoing：己方每个微型机 +1 力量
    // 描述："你的每个微型机的力量+1"
    // alpha 在场时所有己方随从视为微型机；alpha 不在场时仅原始微型机受益
    registerPowerModifier('robot_microbot_fixer', (ctx: PowerModifierContext) => {
        // 目标随从必须是微型机才能受益
        if (!isMicrobot(ctx.state, ctx.minion)) return 0;
        // 计算场上与目标随从同控制者的修理者数量（包括 POD 版本）
        return countMinionsWithDefId(ctx.state, 'robot_microbot_fixer', ctx.minion.controller);
    }, { handlesPodInternally: true });
}

// ============================================================================
// 幽灵派系
// ============================================================================

function registerGhostModifiers(): void {
    // 不散阴魂：如果你只有2张或更少的手牌，本随从+3 力量
    registerPowerModifier('ghost_haunting', (ctx: PowerModifierContext) => {
        if (!matchesDefId(ctx.minion, 'ghost_haunting')) return 0;
        const player = ctx.state.players[ctx.minion.controller];
        if (!player) return 0;
        return player.hand.length <= 2 ? 3 : 0;
    }, { handlesPodInternally: true });

    // 通灵之门（ongoing 行动卡附着在基地上）：手牌≤2时同基地己方随从每张 +2 力量
    registerOngoingPowerModifier('ghost_door_to_the_beyond', 'base', 'ownerMinions', 2, (ctx) => {
        const player = ctx.state.players[ctx.minion.controller];
        return !!player && player.hand.length <= 2;
    });
}

// ============================================================================
// 忍者派系?
// ============================================================================

function registerNinjaModifiers(): void {
    // 毒药（ongoing 行动卡附着在随从上）：每张 -4 力量
    registerOngoingPowerModifier('ninja_poison', 'minion', 'self', -4);
}

// ============================================================================
// 食人花派系?
// ============================================================================

function registerKillerPlantModifiers(): void {
    // 催眠孢子（ongoing 行动卡打出到基地上）：每张对其他玩家在此基地的随从 -1 力量
    registerOngoingPowerModifier('killer_plant_sleep_spores', 'base', 'opponentMinions', -1);

    // 过度生长（ongoing 行动卡附着在基地上）：
    // 规则："持续：自你的回合开始时，将本基地的爆破点降低到0点。"
    // 实现方式：onTurnStart 触发器产生 BREAKPOINT_MODIFIED 事件（tempBreakpointModifiers，回合结束自动清零）
    // 注册在 killer_plants.ts 的 registerKillerPlantAbilities() 中
}

// ============================================================================
// 蒸汽朋克派系
// ============================================================================

function registerSteampunkModifiers(): void {
    // 蒸汽人：本基地有至少一个己方战术时 +1 力量（flat +1，非 scaling）
    // 描述：「持续：+1力量如果你本基地有至少一个你的战术附属在它上面。」
    registerPowerModifier('steampunk_steam_man', (ctx: PowerModifierContext) => {
        const baseId = ctx.minion.defId.replace(/_pod$/, '');
        if (baseId !== 'steampunk_steam_man') return 0;
        
        // 检查基地上是否有己方行动卡（ongoing 或附着在随从上的）
        const hasBaseOngoing = ctx.base.ongoingActions.some(
            a => a.ownerId === ctx.minion.controller
        );
        if (hasBaseOngoing) {
            return 1;
        }
        for (const m of ctx.base.minions) {
            if (m.attachedActions.some(a => a.ownerId === ctx.minion.controller)) {
                return 1;
            }
        }
        return 0;
    }, { handlesPodInternally: true });

    // 蒸汽机车（ongoing 行动卡附着在基地上）：拥有者在此基地有随从时，每张 +5 总力量
    // 注意：这是 BasePowerModifier，ctx.playerId 是正在计算总力量的玩家
    // ctx.ongoing 是当前正在评估的 ongoing 卡
    registerBasePowerModifier('steampunk_aggromotive', (ctx) => {
        // 只有当前 ongoing 卡的拥有者才能获得加成
        if (!ctx.ongoing || ctx.ongoing.ownerId !== ctx.playerId) return 0;
        
        // 检查该玩家在此基地是否有随从
        const hasMinion = ctx.base.minions.some(m => m.controller === ctx.playerId);
        
        return hasMinion ? 5 : 0;
    });

    // 旋转弹头发射器（ongoing 行动卡附着在基地上）：每张给同基地己方随从 +2 力量
    registerOngoingPowerModifier('steampunk_rotary_slug_thrower', 'base', 'ownerMinions', 2);
}

// ============================================================================
// 黑熊骑兵派系
// ============================================================================

function registerBearCavalryModifiers(): void {
    // 极地突击队：基地上唯一己方随从时 +2 力量（不可消灭，后者需要 ongoing 保护系统）
    registerPowerModifier('bear_cavalry_polar_commando', (ctx: PowerModifierContext) => {
        // POD 版没有该 ongoing 效果（POD 版只有 talent 效果）
        if (ctx.minion.defId === 'bear_cavalry_polar_commando_pod') return 0;
        if (ctx.minion.defId !== 'bear_cavalry_polar_commando') return 0;
        const myMinionCount = ctx.base.minions.filter(
            m => m.controller === ctx.minion.controller
        ).length;
        return myMinionCount === 1 ? 2 : 0;
    });

    // 你们已经完蛋 POD（ongoing 行动卡附着在基地上）：动态调整爆破点
    // 规则：每个在此基地有随从的玩家 +2 爆破点；如果本回合你曾把对手随从移动到此基地，则改为每个玩家 -2
    registerBreakpointModifier('bear_cavalry_youre_screwed_pod', (ctx) => {
        const card = ctx.base.ongoingActions.find(a => a.defId === 'bear_cavalry_youre_screwed_pod');
        if (!card) return 0;

        const playersWithMinions = new Set(ctx.base.minions.map(m => m.controller)).size;
        const movedOpponentHereThisTurn = ctx.state.movedToBasesThisTurn?.[ctx.baseIndex] ?? false;

        const modifier = playersWithMinions * 2;
        return movedOpponentHereThisTurn ? -modifier : modifier;
    });
}

// ============================================================================
// 远古之物派系
// ============================================================================

function registerElderThingModifiers(): void {
    // 邓威奇恐怖（ongoing 行动卡附着在随从上）：每张 +5 力量
    registerOngoingPowerModifier('elder_thing_dunwich_horror', 'minion', 'self', 5);
}
// ============================================================================
// 基地持续力量修正
// ============================================================================

function registerBaseModifiers(): void {
    // 通用基地持续力量加成：从 BaseCardDef.minionPowerBonus 数据驱动
    registerPowerModifier('base_minionPowerBonus', (ctx: PowerModifierContext) => {
        const baseDef = getBaseDef(ctx.base.defId);
        return baseDef?.minionPowerBonus ?? 0;
    }, { handlesPodInternally: true }); // 标记已处理 POD（通用修正器，不需要 POD 别名）
}

// ============================================================================
// 狼人派系
// ============================================================================

function registerWerewolfModifiers(): void {
    // 满月（ongoing 行动卡打出到基地上）：拥有者在此基地的随从 +1 力量
    registerOngoingPowerModifier('werewolf_full_moon', 'base', 'ownerMinions', 1);
}

/** 注册所有持续力量修正*/
export function registerAllOngoingModifiers(): void {
    registerBaseModifiers();
    registerDinosaurModifiers();
    registerRobotModifiers();
    registerGhostModifiers();
    registerNinjaModifiers();
    registerKillerPlantModifiers();
    registerSteampunkModifiers();
    registerBearCavalryModifiers();
    registerElderThingModifiers();
    registerWerewolfModifiers();
}
