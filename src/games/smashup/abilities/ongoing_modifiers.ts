/**
 * 大杀四方 - 持续力量修正能力注册
 *
 * 将各派系的 ongoing 力量修正注册到 ongoingModifiers 系统中
 * （在 initAllAbilities() 中调用）
 */

import {
    registerPowerModifiers,
    registerOngoingPowerModifiers,
    registerBasePowerModifiers,
    registerBreakpointModifiers,
    registerTitanPowerModifier,
} from '../domain/ongoingModifiers';
import type { BasePowerModifierContext, OngoingPowerModifierDefinition, PowerModifierContext } from '../domain/ongoingModifiers';
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

const STRUCTURED_ONGOING_POWER_MODIFIERS: readonly OngoingPowerModifierDefinition[] = [
    { defId: 'dino_upgrade', location: 'minion', target: 'self', delta: 2 },
    {
        defId: 'ghost_door_to_the_beyond',
        location: 'base',
        target: 'ownerMinions',
        delta: 2,
        condition: (ctx) => {
            const player = ctx.state.players[ctx.minion.controller];
            return !!player && player.hand.length <= 2;
        },
    },
    { defId: 'ninja_poison', location: 'minion', target: 'self', delta: -4 },
    { defId: 'killer_plant_sleep_spores', location: 'base', target: 'opponentMinions', delta: -1 },
    { defId: 'steampunk_rotary_slug_thrower', location: 'base', target: 'ownerMinions', delta: 2 },
    { defId: 'elder_thing_dunwich_horror', location: 'minion', target: 'self', delta: 5 },
    { defId: 'vampire_dinner_date', location: 'minion', target: 'self', delta: -2 },
    { defId: 'ancient_egyptians_ancient_curse', location: 'minion', target: 'self', delta: -2 },
    { defId: 'mermaids_becalmed_shores', location: 'base', target: 'opponentMinions', delta: -1 },
    { defId: 'mermaids_shipwreck_cove', location: 'base', target: 'ownerMinions', delta: 1 },
    { defId: 'world_champs_bewitched', location: 'minion', target: 'self', delta: 2 },
    { defId: 'fairies_leaf_armor', location: 'minion', target: 'self', delta: 1 },
    { defId: 'princesses_heirloom', location: 'minion', target: 'self', delta: 1 },
    { defId: 'shapeshifters_splice_as_nice', location: 'minion', target: 'self', delta: 2 },
    { defId: 'cyborg_apes_cyberevolution', location: 'minion', target: 'self', delta: 3 },
    { defId: 'werewolf_full_moon', location: 'base', target: 'ownerMinions', delta: 1 },
    { defId: 'dragons_dragon_lands', location: 'base', target: 'ownerMinions', delta: 1 },
    { defId: 'dragons_intimidating_presence', location: 'base', target: 'opponentMinions', delta: -1 },
    { defId: 'superheroes_expanded_power', location: 'minion', target: 'self', delta: 1 },
];

function registerStructuredOngoingPowerModifiers(): void {
    registerOngoingPowerModifiers(STRUCTURED_ONGOING_POWER_MODIFIERS);
}

// ============================================================================
// 恐龙派系
// ============================================================================

function registerDinosaurModifiers(): void {
    registerPowerModifiers([
        {
            sourceDefId: 'dino_armor_stego',
            podStrategy: 'selfManaged',
            modifier: (ctx: PowerModifierContext) => {
                const baseId = ctx.minion.defId.replace(/_pod$/, '');
                if (baseId !== 'dino_armor_stego') return 0;
                const currentPlayer = ctx.state.turnOrder[ctx.state.currentPlayerIndex];
                if (currentPlayer === ctx.minion.controller) return 0;
                const isPod = ctx.minion.defId.endsWith('_pod');
                if (isPod && !ctx.minion.talentUsed) return 0;
                return 2;
            },
        },
        {
            sourceDefId: 'dino_war_raptor',
            podStrategy: 'selfManaged',
            modifier: (ctx: PowerModifierContext) => {
                const baseId = ctx.minion.defId.replace(/_pod$/, '');
                if (baseId !== 'dino_war_raptor') return 0;
                return ctx.base.minions.filter(
                    m => ['dino_war_raptor', 'dino_war_raptor_pod'].includes(m.defId) && m.controller === ctx.minion.controller
                ).length;
            },
        },
    ]);
}

// ============================================================================
// 机器人派系
// ============================================================================

function registerRobotModifiers(): void {
    registerPowerModifiers([
        {
            sourceDefId: 'robot_microbot_alpha',
            podStrategy: 'selfManaged',
            modifier: (ctx: PowerModifierContext) => {
                const baseId = ctx.minion.defId.replace(/_pod$/, '');
                if (baseId !== 'robot_microbot_alpha') return 0;
                let otherMinionCount = 0;
                for (const base of ctx.state.bases) {
                    for (const minion of base.minions) {
                        if (minion.controller === ctx.minion.controller && minion.uid !== ctx.minion.uid) {
                            otherMinionCount++;
                        }
                    }
                }
                return otherMinionCount;
            },
        },
        {
            sourceDefId: 'robot_microbot_fixer',
            podStrategy: 'selfManaged',
            modifier: (ctx: PowerModifierContext) => {
                if (!isMicrobot(ctx.state, ctx.minion)) return 0;
                return countMinionsWithDefId(ctx.state, 'robot_microbot_fixer', ctx.minion.controller);
            },
        },
    ]);
}

// ============================================================================
// 幽灵派系
// ============================================================================

function registerGhostModifiers(): void {
    registerPowerModifiers([
        {
            sourceDefId: 'ghost_haunting',
            podStrategy: 'selfManaged',
            modifier: (ctx: PowerModifierContext) => {
                if (!matchesDefId(ctx.minion, 'ghost_haunting')) return 0;
                const player = ctx.state.players[ctx.minion.controller];
                if (!player) return 0;
                return player.hand.length <= 2 ? 3 : 0;
            },
        },
    ]);
}

// ============================================================================
// 忍者派系
// ============================================================================

function registerNinjaModifiers(): void {
}

// ============================================================================
// 食人花派系
// ============================================================================

function registerKillerPlantModifiers(): void {
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
    registerPowerModifiers([
        {
            sourceDefId: 'steampunk_steam_man',
            podStrategy: 'selfManaged',
            modifier: (ctx: PowerModifierContext) => {
                const baseId = ctx.minion.defId.replace(/_pod$/, '');
                if (baseId !== 'steampunk_steam_man') return 0;
                const hasBaseOngoing = ctx.base.ongoingActions.some(
                    action => ((action.metadata?.sourceControllerId as PlayerId | undefined) ?? action.ownerId) === ctx.minion.controller
                );
                if (hasBaseOngoing) {
                    return 1;
                }
                for (const minion of ctx.base.minions) {
                    if (minion.attachedActions.some(
                        action => ((action.metadata?.sourceControllerId as PlayerId | undefined) ?? action.ownerId) === ctx.minion.controller
                    )) {
                        return 1;
                    }
                }
                return 0;
            },
        },
    ]);

    registerBasePowerModifiers([
        {
            defId: 'steampunk_aggromotive',
            modifier: (ctx) => {
                if (!ctx.ongoing) return 0;
                const ongoingControllerId = (ctx.ongoing.metadata?.sourceControllerId as PlayerId | undefined) ?? ctx.ongoing.ownerId;
                if (ongoingControllerId !== ctx.playerId) return 0;
                return ctx.base.minions.some(minion => minion.controller === ongoingControllerId) ? 5 : 0;
            },
        },
    ]);
}

// ============================================================================
// 黑熊骑兵派系
// ============================================================================

function registerBearCavalryModifiers(): void {
    registerPowerModifiers([
        {
            sourceDefId: 'bear_cavalry_polar_commando',
            podStrategy: 'baseOnly',
            modifier: (ctx: PowerModifierContext) => {
                if (ctx.minion.defId === 'bear_cavalry_polar_commando_pod') return 0;
                if (ctx.minion.defId !== 'bear_cavalry_polar_commando') return 0;
                const myMinionCount = ctx.base.minions.filter(
                    minion => minion.controller === ctx.minion.controller
                ).length;
                return myMinionCount === 1 ? 2 : 0;
            },
        },
    ]);

    registerBreakpointModifiers([
        {
            sourceDefId: 'bear_cavalry_bearing_down_pod',
            modifier: (ctx) => {
                const cards = ctx.base.ongoingActions.filter(action => action.defId === 'bear_cavalry_bearing_down_pod');
                if (cards.length === 0) return 0;

                const playersWithMinions = new Set(ctx.base.minions.map(minion => minion.controller)).size;
                const modifier = playersWithMinions * 2;
                let total = 0;
                for (const card of cards) {
                    const controllerId = getOngoingActionControllerId(card);
                    const movedOpponentHereThisTurn = ctx.state.movedToBasesThisTurn?.[ctx.baseIndex]?.[controllerId] ?? false;
                    total += movedOpponentHereThisTurn ? -modifier : modifier;
                }
                return total;
            },
        },
    ]);
}

// ============================================================================
// 远古之物派系
// ============================================================================

function registerElderThingModifiers(): void {
}

// ============================================================================
// 吸血鬼派系
// ============================================================================

function registerVampireModifiers(): void {
}

function registerAncientEgyptiansModifiers(): void {
    registerPowerModifiers([
        {
            sourceDefId: 'ancient_egyptians_priest_of_anubis',
            podStrategy: 'selfManaged',
            modifier: (ctx: PowerModifierContext) => {
                if (!matchesDefId(ctx.minion, 'ancient_egyptians_priest_of_anubis')) return 0;
                const hasOwnedBuried = (ctx.base.buriedCards ?? []).some(card => card.controllerId === ctx.minion.controller);
                return hasOwnedBuried ? 2 : 0;
            },
        },
    ]);
}

function registerSkeletonsModifiers(): void {
    // Skeletons 的持续能力本轮已按卡图重裁定：
    // - 守墓人：每回合一次，其他牌被埋葬/挖掘后抽牌
    // - 骸骨之王：其他仆从被挖掘后放置 +1 指示物
    // 以上都不是静态力量修正，故不再注册 power modifier。
}

function registerMermaidsModifiers(): void {
    registerPowerModifiers([
        {
            sourceDefId: 'mermaids_temptress',
            podStrategy: 'selfManaged',
            modifier: (ctx: PowerModifierContext) => {
                if (!matchesDefId(ctx.minion, 'mermaids_temptress')) return 0;
                const movedOpponentHereThisTurn = Object.entries(ctx.state.minionsMovedToBaseThisTurn ?? {})
                    .some(([playerId, movedBases]) => playerId !== ctx.minion.controller && (movedBases?.[ctx.baseIndex] ?? 0) > 0);
                return movedOpponentHereThisTurn ? 2 : 0;
            },
        },
    ]);
}

function registerWorldChampsModifiers(): void {
}

function registerFairiesModifiers(): void {
    registerPowerModifiers([
        {
            sourceDefId: 'fairies_daisy_chain',
            podStrategy: 'selfManaged',
            modifier: (ctx: PowerModifierContext) => (
                ctx.minion.attachedActions.reduce((total, action) => {
                    if (action.defId !== 'fairies_daisy_chain' && action.defId !== 'fairies_daisy_chain_pod') {
                        return total;
                    }
                    return total + ((((action.metadata?.sourceControllerId as PlayerId | undefined) ?? action.ownerId) === ctx.minion.controller) ? 2 : -2);
                }, 0)
            ),
        },
        {
            sourceDefId: 'fairies_enchantment',
            podStrategy: 'selfManaged',
            modifier: (ctx: PowerModifierContext) => (
                ctx.base.ongoingActions.reduce((total, action) => {
                    if (action.defId !== 'fairies_enchantment' && action.defId !== 'fairies_enchantment_pod') {
                        return total;
                    }

                    const mode = action.metadata?.fairiesEnchantmentMode;
                    if (mode === 'plus') return total + 1;
                    if (mode === 'minus') return total - 1;
                    return total;
                }, 0)
            ),
        },
    ]);
}

function registerPrincessesModifiers(): void {
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

    registerPowerModifiers([
        {
            sourceDefId: 'shapeshifters_mimic',
            podStrategy: 'selfManaged',
            modifier: (ctx: PowerModifierContext) => {
                if (!matchesDefId(ctx.minion, 'shapeshifters_mimic')) return 0;
                const highestPrintedPower = getHighestPrintedPower(ctx.state);
                return highestPrintedPower - getCardPrintedPower(ctx.minion.defId);
            },
        },
        {
            sourceDefId: 'shapeshifters_copycat_copied_power',
            podStrategy: 'selfManaged',
            modifier: (ctx: PowerModifierContext) => {
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
            },
        },
        {
            sourceDefId: 'shapeshifters_cellular_bonding_copied_power',
            podStrategy: 'selfManaged',
            modifier: (ctx: PowerModifierContext) => {
                const bondingCardUid = ctx.minion.metadata?.cellularBondingCardUid;
                const copiedDefId = ctx.minion.metadata?.cellularBondingCopiedActionDefId;
                if (typeof bondingCardUid !== 'string' || typeof copiedDefId !== 'string') return 0;
                if (!ctx.minion.attachedActions.some(action => action.uid === bondingCardUid)) return 0;
                if (copiedDefId === 'shapeshifters_splice_as_nice') return 2;
                if (copiedDefId === 'cyborg_apes_cyberevolution') return 3;
                if (copiedDefId === 'cyborg_apes_juiced_up') return ctx.minion.attachedActions.length * 2;
                return 0;
            },
        },
        {
            sourceDefId: 'cyborg_apes_furious_george',
            podStrategy: 'selfManaged',
            modifier: (ctx: PowerModifierContext) => {
                if (!matchesDefId(ctx.minion, 'cyborg_apes_furious_george')) return 0;
                return ctx.minion.attachedActions.length;
            },
        },
        {
            sourceDefId: 'cyborg_apes_juiced_up',
            podStrategy: 'selfManaged',
            modifier: (ctx: PowerModifierContext) => (
                ctx.minion.attachedActions.reduce((total, action) => {
                    if (action.defId !== 'cyborg_apes_juiced_up' && action.defId !== 'cyborg_apes_juiced_up_pod') return total;
                    return total + (ctx.minion.attachedActions.length * 2);
                }, 0)
            ),
        },
        {
            sourceDefId: 'base_monkey_lab',
            podStrategy: 'selfManaged',
            modifier: (ctx: PowerModifierContext) => {
                if (ctx.base.defId !== 'base_monkey_lab') return 0;
                if (isBaseAbilitySuppressed(ctx.state, ctx.baseIndex)) return 0;
                return ctx.minion.attachedActions.length;
            },
        },
    ]);
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
    registerBasePowerModifiers([
        ...[
            'kaiju_radioactive_breath',
            'kaiju_oh_no',
            'kaiju_the_folly_of_men',
            'kaiju_stomp',
        ].map((defId) => ({
            defId,
            modifier: (ctx: BasePowerModifierContext) => (
                ctx.ongoing?.ownerId === ctx.playerId
                    ? (defId === 'kaiju_radioactive_breath' ? 3 : 2)
                    : 0
            ),
        })),
        ...[
            'kaiju_tail_smash',
            'kaiju_wade_through_the_buildings',
        ].map((defId) => ({
            defId,
            modifier: (ctx: BasePowerModifierContext) => (
                ctx.ongoing?.ownerId === ctx.playerId ? 4 : 0
            ),
        })),
    ]);

    registerPowerModifiers([
        {
            sourceDefId: 'kaiju_kaijookey',
            podStrategy: 'selfManaged',
            modifier: (ctx: PowerModifierContext) => {
                if (ctx.minion.defId.replace(/_pod$/, '') !== 'kaiju_kaijookey') return 0;
                return countOwnedActionsOnBase(ctx, ctx.minion.controller);
            },
        },
    ]);

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
    registerPowerModifiers([
        {
            sourceDefId: 'base_minionPowerBonus',
            podStrategy: 'selfManaged',
            modifier: (ctx: PowerModifierContext) => {
                if (isBaseAbilitySuppressed(ctx.state, ctx.baseIndex)) {
                    return 0;
                }
                const baseDef = getBaseDef(ctx.base.defId);
                return baseDef?.minionPowerBonus ?? 0;
            },
        },
    ]);
}

// ============================================================================
// 狼人派系
// ============================================================================

function registerWerewolfModifiers(): void {
}

function registerDragonModifiers(): void {
    registerPowerModifiers([
        {
            sourceDefId: 'base_wyrms_desolation',
            podStrategy: 'selfManaged',
            modifier: (ctx: PowerModifierContext) => {
                if (ctx.base.defId !== 'base_wyrms_desolation') return 0;
                if (isBaseAbilitySuppressed(ctx.state, ctx.baseIndex)) return 0;
                return -1;
            },
        },
    ]);
}

function registerSuperheroesModifiers(): void {
}

/** 注册所有持续力量修正 */
export function registerAllOngoingModifiers(): void {
    registerBaseModifiers();
    registerStructuredOngoingPowerModifiers();
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
