/**
 * 大杀四方 - 持续力量修正能力注册
 *
 * 将各派系的 ongoing 力量修正注册到 ongoingModifiers 系统中
 * （在 initAllAbilities() 中调用）
 */

import { registerPowerModifier, registerOngoingPowerModifier, registerBasePowerModifier, registerBreakpointModifier, registerTitanPowerModifier } from '../domain/ongoingModifiers';
import type { PowerModifierContext } from '../domain/ongoingModifiers';
import type { MinionOnBase, SmashUpCore } from '../domain/types';
import { getBaseDef, getCardDef } from '../data/cards';
import { isMicrobot } from '../domain/utils';
import type { PlayerId } from '../../../engine/types';
import { registerKillerPlantModifiers as registerKillerPlantAbilitiesModifiers } from './killer_plants';
import { isBaseAbilitySuppressed } from '../domain/ongoingEffects';

export const COPYCAT_EXPLICIT_COPIED_POWER_DEF_IDS = [
    'shapeshifters_mimic',
    'cyborg_apes_furious_george',
] as const;

export const CELLULAR_BONDING_EXPLICIT_COPIED_POWER_DEF_IDS = [
    'shapeshifters_splice_as_nice',
    'cyborg_apes_cyberevolution',
    'cyborg_apes_juiced_up',
] as const;

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

function getOngoingActionControllerId(action: { ownerId: PlayerId; metadata?: Record<string, unknown> }): PlayerId {
    return (typeof action.metadata?.sourceControllerId === 'string'
        ? action.metadata.sourceControllerId
        : action.ownerId) as PlayerId;
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
        // 当前回合不是自己的回合时 +2
        const currentPlayer = ctx.state.turnOrder[ctx.state.currentPlayerIndex];
        if (currentPlayer === ctx.minion.controller) return 0;
        // POD 版需要 talentUsed 标记为 true 才生效
        const isPod = ctx.minion.defId.endsWith('_pod');
        if (isPod && !ctx.minion.talentUsed) return 0;
        return 2;
    }, { handlesPodInternally: true });

    // 战争猛龙：同基地每个己方战争猛龙（含自身）+1 力量
    registerPowerModifier('dino_war_raptor', (ctx: PowerModifierContext) => {
        const baseId = ctx.minion.defId.replace(/_pod$/, '');
        if (baseId !== 'dino_war_raptor') return 0;
        // war_raptor 和 war_raptor_pod 都算入同派系
        const raptorCount = ctx.base.minions.filter(
            m => ['dino_war_raptor', 'dino_war_raptor_pod'].includes(m.defId) && m.controller === ctx.minion.controller
        ).length;
        return raptorCount;
    }, { handlesPodInternally: true });

    // 升级（ongoing 行动卡附着在随从上）：每张 +2 力量
    registerOngoingPowerModifier('dino_upgrade', 'minion', 'self', 2);
}

// ============================================================================
// 机器人派系
// ============================================================================

function registerRobotModifiers(): void {
    // 微型机阿尔法号：每个其他己方随从（视为微型机）+1 力量
    // “你的所有随从均视为微型机”，因此计算场上所有己方其他随从数量
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

    // 微型机修理工 ongoing：己方每个微型机 +1 力量
    // 描述：“你的每个微型机的力量 +1”
    // alpha 在场时所有己方随从视为微型机；alpha 不在场时仅原始微型机受益
    registerPowerModifier('robot_microbot_fixer', (ctx: PowerModifierContext) => {
        // 目标随从必须是微型机才能受益
        if (!isMicrobot(ctx.state, ctx.minion)) return 0;
        // 计算场上与目标随从同控制者的修理工数量（包括 POD 版本）
        return countMinionsWithDefId(ctx.state, 'robot_microbot_fixer', ctx.minion.controller);
    }, { handlesPodInternally: true });
}

// ============================================================================
// 幽灵派系
// ============================================================================

function registerGhostModifiers(): void {
    // 不散阴魂：如果你只有 2 张或更少的手牌，本随从 +3 力量
    registerPowerModifier('ghost_haunting', (ctx: PowerModifierContext) => {
        if (!matchesDefId(ctx.minion, 'ghost_haunting')) return 0;
        const player = ctx.state.players[ctx.minion.controller];
        if (!player) return 0;
        return player.hand.length <= 2 ? 3 : 0;
    }, { handlesPodInternally: true });

    // 通灵之门（ongoing 行动卡附着在基地上）：手牌 2 张或更少时同基地己方随从每张 +2 力量
    registerOngoingPowerModifier('ghost_door_to_the_beyond', 'base', 'ownerMinions', 2, (ctx) => {
        const player = ctx.state.players[ctx.minion.controller];
        return !!player && player.hand.length <= 2;
    });
}

// ============================================================================
// 忍者派系
// ============================================================================

function registerNinjaModifiers(): void {
    // 毒药（ongoing 行动卡附着在随从上）：每张 -4 力量
    registerOngoingPowerModifier('ninja_poison', 'minion', 'self', -4);
}

// ============================================================================
// 食人花派系
// ============================================================================

function registerKillerPlantModifiers(): void {
    // 催眠孢子（ongoing 行动卡打出到基地上）：每张对其他玩家在此基地的随从 -1 力量
    registerOngoingPowerModifier('killer_plant_sleep_spores', 'base', 'opponentMinions', -1);

    // 过度生长（ongoing 行动卡附着在基地上）：
    // 规则：持续：自你的回合开始时，将本基地的爆破点降低到 0 点
    // 实现方式：onTurnStart 触发器产生 BREAKPOINT_MODIFIED 事件（tempBreakpointModifiers，回合结束自动清零）
    // 注册在 killer_plants.ts 的 registerKillerPlantAbilities() 中

    // 注册派系自定义力量修正（Weed Eater POD）
    registerKillerPlantAbilitiesModifiers();
}

// ============================================================================
// 蒸汽朋克派系
// ============================================================================

function registerSteampunkModifiers(): void {
    // 蒸汽人：本基地有至少一个己方战术时 +1 力量（flat +1，非 scaling）
    // 描述：「持续：如果你在本基地至少有一个你的战术附着在它上面，则 +1 力量。」
    registerPowerModifier('steampunk_steam_man', (ctx: PowerModifierContext) => {
        const baseId = ctx.minion.defId.replace(/_pod$/, '');
        if (baseId !== 'steampunk_steam_man') return 0;
        
        // 检查基地上是否有己方行动卡（ongoing 或附着在随从上的）
        const hasBaseOngoing = ctx.base.ongoingActions.some(
            a => ((a.metadata?.sourceControllerId as PlayerId | undefined) ?? a.ownerId) === ctx.minion.controller
        );
        if (hasBaseOngoing) {
            return 1;
        }
        for (const m of ctx.base.minions) {
            if (m.attachedActions.some(
                a => ((a.metadata?.sourceControllerId as PlayerId | undefined) ?? a.ownerId) === ctx.minion.controller
            )) {
                return 1;
            }
        }
        return 0;
    }, { handlesPodInternally: true });

    // 蒸汽机车（ongoing 行动卡附着在基地上）：拥有者在此基地有随从时，每张 +5 总力量
    // 注意：这是 BasePowerModifier，ctx.playerId 是正在计算总力量的玩家
    // ctx.ongoing 是当前正在评估的 ongoing 卡
    registerBasePowerModifier('steampunk_aggromotive', (ctx) => {
        if (!ctx.ongoing) return 0;
        const ongoingControllerId = (ctx.ongoing.metadata?.sourceControllerId as PlayerId | undefined) ?? ctx.ongoing.ownerId;
        // 只有当前 ongoing 卡的控制者才能获得加成
        if (ongoingControllerId !== ctx.playerId) return 0;
        
        // 检查该控制者在此基地是否有随从
        const hasMinion = ctx.base.minions.some(m => m.controller === ongoingControllerId);
        
        return hasMinion ? 5 : 0;
    });

    // 旋转弹头发射器（ongoing 行动卡附着在基地上）：每张给同基地己方随从 +2 力量
    registerOngoingPowerModifier('steampunk_rotary_slug_thrower', 'base', 'ownerMinions', 2);
}

// ============================================================================
// 黑熊骑兵派系
// ============================================================================

function registerBearCavalryModifiers(): void {
    // 极地突击队：基地上唯一己方随从时 +2 力量（不可消灭由 ongoing 保护系统处理）
    registerPowerModifier('bear_cavalry_polar_commando', (ctx: PowerModifierContext) => {
        // POD 版没有该 ongoing 效果（POD 版只有 talent 效果）
        if (ctx.minion.defId === 'bear_cavalry_polar_commando_pod') return 0;
        if (ctx.minion.defId !== 'bear_cavalry_polar_commando') return 0;
        const myMinionCount = ctx.base.minions.filter(
            m => m.controller === ctx.minion.controller
        ).length;
        return myMinionCount === 1 ? 2 : 0;
    });

    // Bearing Down POD（ongoing 行动卡附着在基地上）：动态调整爆破点
    // 规则：每个在此基地有随从的玩家 +2 爆破点；如果本回合你曾把对手随从移动到此基地，则改为每个玩家 -2
    registerBreakpointModifier('bear_cavalry_bearing_down_pod', (ctx) => {
        const cards = ctx.base.ongoingActions.filter(a => a.defId === 'bear_cavalry_bearing_down_pod');
        if (cards.length === 0) return 0;

        const playersWithMinions = new Set(ctx.base.minions.map(m => m.controller)).size;
        const modifier = playersWithMinions * 2;
        let total = 0;
        for (const card of cards) {
            const controllerId = getOngoingActionControllerId(card);
            const movedOpponentHereThisTurn = ctx.state.movedToBasesThisTurn?.[ctx.baseIndex]?.[controllerId] ?? false;
            total += movedOpponentHereThisTurn ? -modifier : modifier;
        }
        return total;
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
// 吸血鬼派系
// ============================================================================

function registerVampireModifiers(): void {
    // Dinner Date POD（ongoing 行动卡附着在随从上）：附着随从 -2 力量
    registerOngoingPowerModifier('vampire_dinner_date', 'minion', 'self', -2);
}

function registerAncientEgyptiansModifiers(): void {
    // 阿努比斯祭司：如果本基地有你的埋葬牌，本随从 +2 力量
    registerPowerModifier('ancient_egyptians_priest_of_anubis', (ctx: PowerModifierContext) => {
        if (!matchesDefId(ctx.minion, 'ancient_egyptians_priest_of_anubis')) return 0;
        const hasOwnedBuried = (ctx.base.buriedCards ?? []).some(card => card.controllerId === ctx.minion.controller);
        if (!hasOwnedBuried) return 0;
        return 2;
    }, { handlesPodInternally: true });

    registerOngoingPowerModifier('ancient_egyptians_ancient_curse', 'minion', 'self', -2);
}

function registerSkeletonsModifiers(): void {
    // Skeletons 的持续能力本轮已按卡图重裁定：
    // - 守墓人：每回合一次，其他牌被埋葬/挖掘后抽牌
    // - 骸骨之王：其他仆从被挖掘后放置 +1 指示物
    // 以上都不是静态力量修正，故不再注册 power modifier。
}

function registerMermaidsModifiers(): void {
    // 安静的海岸：基地上其他玩家的仆从 -1 力量
    registerOngoingPowerModifier('mermaids_becalmed_shores', 'base', 'opponentMinions', -1);

    // 沉船湾：基地上拥有者的仆从 +1 力量
    registerOngoingPowerModifier('mermaids_shipwreck_cove', 'base', 'ownerMinions', 1);

    // 诱惑者：如果本回合有其他玩家仆从移动到这里，则 +2 力量
    registerPowerModifier('mermaids_temptress', (ctx: PowerModifierContext) => {
        if (!matchesDefId(ctx.minion, 'mermaids_temptress')) return 0;
        const movedOpponentHereThisTurn = Object.entries(ctx.state.minionsMovedToBaseThisTurn ?? {})
            .some(([playerId, movedBases]) => playerId !== ctx.minion.controller && (movedBases?.[ctx.baseIndex] ?? 0) > 0);
        return movedOpponentHereThisTurn ? 2 : 0;
    }, { handlesPodInternally: true });
}

function registerWorldChampsModifiers(): void {
    // 蛊惑附体：附着随从 +2 力量
    registerOngoingPowerModifier('world_champs_bewitched', 'minion', 'self', 2);
}

function registerFairiesModifiers(): void {
    // 叶之甲：附着随从 +1 力量
    registerOngoingPowerModifier('fairies_leaf_armor', 'minion', 'self', 1);

    // 雏菊花环：你控制则 +2，否则 -2。需要按每张附着牌的 owner 动态判断。
    registerPowerModifier('fairies_daisy_chain', (ctx: PowerModifierContext) => {
        return ctx.minion.attachedActions.reduce((total, action) => {
            if (action.defId !== 'fairies_daisy_chain' && action.defId !== 'fairies_daisy_chain_pod') {
                return total;
            }
            return total + ((((action.metadata?.sourceControllerId as PlayerId | undefined) ?? action.ownerId) === ctx.minion.controller) ? 2 : -2);
        }, 0);
    }, { handlesPodInternally: true });

    // 结果：根据交互选择为整座基地提供 +1 / -1 / both(净 0)。
    registerPowerModifier('fairies_enchantment', (ctx: PowerModifierContext) => {
        return ctx.base.ongoingActions.reduce((total, action) => {
            if (action.defId !== 'fairies_enchantment' && action.defId !== 'fairies_enchantment_pod') {
                return total;
            }

            const mode = action.metadata?.fairiesEnchantmentMode;
            if (mode === 'plus') return total + 1;
            if (mode === 'minus') return total - 1;
            return total;
        }, 0);
    }, { handlesPodInternally: true });
}

function registerPrincessesModifiers(): void {
    registerOngoingPowerModifier('princesses_heirloom', 'minion', 'self', 1);
}

function registerYuanhouModifiers(): void {
    const getHighestPrintedPower = (state: SmashUpCore): number => {
        let highestPrintedPower = 0;
        for (const base of state.bases) {
            for (const minion of base.minions) {
                highestPrintedPower = Math.max(highestPrintedPower, getCardPrintedPower(minion.defId));
            }
        }
        return highestPrintedPower;
    };

    registerPowerModifier('shapeshifters_mimic', (ctx: PowerModifierContext) => {
        if (!matchesDefId(ctx.minion, 'shapeshifters_mimic')) return 0;
        const highestPrintedPower = getHighestPrintedPower(ctx.state);
        return highestPrintedPower - getCardPrintedPower(ctx.minion.defId);
    }, { handlesPodInternally: true });

    registerPowerModifier('shapeshifters_copycat_copied_power', (ctx: PowerModifierContext) => {
        if (!matchesDefId(ctx.minion, 'shapeshifters_copycat')) return 0;
        if (ctx.minion.metadata?.copiedAbilityUntilTurn !== ctx.state.turnNumber) return 0;
        const copiedDefId = ctx.minion.metadata?.copiedAbilityDefId;
        if (copiedDefId === 'shapeshifters_mimic') {
            return getHighestPrintedPower(ctx.state) - getCardPrintedPower(ctx.minion.defId);
        }
        if (copiedDefId === 'cyborg_apes_furious_george') {
            return ctx.minion.attachedActions.length;
        }
        return 0;
    }, { handlesPodInternally: true });

    registerOngoingPowerModifier('shapeshifters_splice_as_nice', 'minion', 'self', 2);

    registerPowerModifier('shapeshifters_cellular_bonding_copied_power', (ctx: PowerModifierContext) => {
        const bondingCardUid = ctx.minion.metadata?.cellularBondingCardUid;
        const copiedDefId = ctx.minion.metadata?.cellularBondingCopiedActionDefId;
        if (typeof bondingCardUid !== 'string' || typeof copiedDefId !== 'string') return 0;
        if (!ctx.minion.attachedActions.some(action => action.uid === bondingCardUid)) return 0;
        if (copiedDefId === 'shapeshifters_splice_as_nice') return 2;
        if (copiedDefId === 'cyborg_apes_cyberevolution') return 3;
        if (copiedDefId === 'cyborg_apes_juiced_up') return ctx.minion.attachedActions.length * 2;
        return 0;
    }, { handlesPodInternally: true });

    registerPowerModifier('cyborg_apes_furious_george', (ctx: PowerModifierContext) => {
        if (!matchesDefId(ctx.minion, 'cyborg_apes_furious_george')) return 0;
        return ctx.minion.attachedActions.length;
    }, { handlesPodInternally: true });

    registerOngoingPowerModifier('cyborg_apes_cyberevolution', 'minion', 'self', 3);

    registerPowerModifier('cyborg_apes_juiced_up', (ctx: PowerModifierContext) => {
        return ctx.minion.attachedActions.reduce((total, action) => {
            if (action.defId !== 'cyborg_apes_juiced_up' && action.defId !== 'cyborg_apes_juiced_up_pod') return total;
            return total + (ctx.minion.attachedActions.length * 2);
        }, 0);
    }, { handlesPodInternally: true });

    registerPowerModifier('base_monkey_lab', (ctx: PowerModifierContext) => {
        if (ctx.base.defId !== 'base_monkey_lab') return 0;
        if (isBaseAbilitySuppressed(ctx.state, ctx.baseIndex)) return 0;
        return ctx.minion.attachedActions.length;
    }, { handlesPodInternally: true });
}

function getCardPrintedPower(defId: string): number {
    const card = getCardDef(defId);
    return card?.type === 'minion' ? (card.power ?? 0) : 0;
}

function countOwnedActionsOnBase(ctx: PowerModifierContext, ownerId: PlayerId): number {
    let total = ctx.base.ongoingActions.filter(action => action.ownerId === ownerId).length;
    for (const minion of ctx.base.minions) {
        total += minion.attachedActions.filter(action => action.ownerId === ownerId).length;
    }
    return total;
}

function registerKaijuModifiers(): void {
    for (const defId of [
        'kaiju_radioactive_breath',
        'kaiju_oh_no',
        'kaiju_the_folly_of_men',
        'kaiju_stomp',
    ]) {
        registerBasePowerModifier(defId, (ctx) =>
            ctx.ongoing?.ownerId === ctx.playerId
                ? (defId === 'kaiju_radioactive_breath' ? 3 : 2)
                : 0);
    }

    for (const defId of [
        'kaiju_tail_smash',
        'kaiju_wade_through_the_buildings',
    ]) {
        registerBasePowerModifier(defId, (ctx) =>
            ctx.ongoing?.ownerId === ctx.playerId ? 4 : 0);
    }

    registerPowerModifier('kaiju_kaijookey', (ctx: PowerModifierContext) => {
        if (ctx.minion.defId.replace(/_pod$/, '') !== 'kaiju_kaijookey') return 0;
        return countOwnedActionsOnBase(ctx, ctx.minion.controller);
    }, { handlesPodInternally: true });

    registerTitanPowerModifier('kaiju_gorgodzolla', (ctx) => {
        const baseDef = getBaseDef(ctx.base.defId);
        if (baseDef?.id !== 'base_kaiju_island') return 0;
        return 3;
    });
}
// ============================================================================
// 基地持续力量修正
// ============================================================================

function registerBaseModifiers(): void {
    // 通用基地持续力量加成：从 BaseCardDef.minionPowerBonus 数据驱动
    registerPowerModifier('base_minionPowerBonus', (ctx: PowerModifierContext) => {
        if (isBaseAbilitySuppressed(ctx.state, ctx.baseIndex)) {
            return 0;
        }
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

function registerDragonModifiers(): void {
    registerPowerModifier('base_wyrms_desolation', (ctx: PowerModifierContext) => {
        if (ctx.base.defId !== 'base_wyrms_desolation') return 0;
        if (isBaseAbilitySuppressed(ctx.state, ctx.baseIndex)) return 0;
        return -1;
    }, { handlesPodInternally: true });
    registerOngoingPowerModifier('dragons_dragon_lands', 'base', 'ownerMinions', 1);
    registerOngoingPowerModifier('dragons_intimidating_presence', 'base', 'opponentMinions', -1);
}

function registerSuperheroesModifiers(): void {
    registerOngoingPowerModifier('superheroes_expanded_power', 'minion', 'self', 1);
}

/** 注册所有持续力量修正 */
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
    registerVampireModifiers();
    registerAncientEgyptiansModifiers();
    registerSkeletonsModifiers();
    registerMermaidsModifiers();
    registerWorldChampsModifiers();
    registerFairiesModifiers();
    registerPrincessesModifiers();
    registerKaijuModifiers();
    registerWerewolfModifiers();
    registerDragonModifiers();
    registerSuperheroesModifiers();
    registerYuanhouModifiers();
}
