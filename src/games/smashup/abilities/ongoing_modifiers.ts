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
    registerCustomPowerModifiers,
    registerCustomBasePowerModifiers,
    registerCustomBreakpointModifiers,
    registerTitanPowerModifier,
    getActionControllerId,
} from '../domain/ongoingModifiers';
import type { BasePowerModifierContext, OngoingPowerModifierDefinition, PowerModifierContext } from '../domain/ongoingModifiers';
import type { SmashUpCore } from '../domain/types';
import { getBaseDef, getCardDef } from '../data/cards';
import { isMicrobot } from '../domain/utils';
import { registerKillerPlantModifiers as registerKillerPlantAbilitiesModifiers } from './killer_plants';
import { isBaseAbilitySuppressed, isCardSuppressed } from '../domain/ongoingEffects';

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
    { defId: 'shapeshifters_splice_as_nice', location: 'minion', target: 'self', delta: 2 },
    { defId: 'cyborg_apes_cyberevolution', location: 'minion', target: 'self', delta: 3 },
    { defId: 'werewolf_full_moon', location: 'base', target: 'ownerMinions', delta: 1 },
    { defId: 'dragons_dragon_lands', location: 'base', target: 'ownerMinions', delta: 1 },
    { defId: 'dragons_intimidating_presence', location: 'base', target: 'opponentMinions', delta: -1 },
    { defId: 'superheroes_expanded_power', location: 'minion', target: 'self', delta: 1 },
    { defId: 'vigilantes_tough_it_out', location: 'minion', target: 'self', delta: 2 },
    { defId: 'mounties_haich_q', location: 'base', target: 'ownerMinions', delta: 1 },
];

function registerStructuredOngoingPowerModifiers(): void {
    registerOngoingPowerModifiers(STRUCTURED_ONGOING_POWER_MODIFIERS);
}

// ============================================================================
// 恐龙派系
// ============================================================================

function registerDinosaurModifiers(): void {
    registerCustomPowerModifiers([
        {
            sourceDefId: 'dino_armor_stego',
            compute: (ctx, helpers) => {
                if (!helpers.matchesRuntimeDefId(ctx.minion.defId, 'dino_armor_stego')) return 0;
                const currentPlayer = ctx.state.turnOrder[ctx.state.currentPlayerIndex];
                if (currentPlayer === ctx.minion.controller) return 0;
                const isPod = ctx.minion.defId.endsWith('_pod');
                if (isPod && !ctx.minion.talentUsed) return 0;
                return 2;
            },
        },
        {
            sourceDefId: 'dino_war_raptor',
            compute: (ctx, helpers) => {
                if (!helpers.matchesRuntimeDefId(ctx.minion.defId, 'dino_war_raptor')) return 0;
                return helpers.countMinionsOnBaseMatchingRuntimeDefId(ctx, 'dino_war_raptor', {
                    controllerId: ctx.minion.controller,
                });
            },
        },
    ]);
}

// ============================================================================
// 机器人派系
// ============================================================================

function registerRobotModifiers(): void {
    registerCustomPowerModifiers([
        {
            sourceDefId: 'robot_microbot_alpha',
            compute: (ctx, helpers) => {
                if (!helpers.matchesRuntimeDefId(ctx.minion.defId, 'robot_microbot_alpha')) return 0;
                return helpers.countMinionsInPlayControlledBy(ctx, ctx.minion.controller, {
                    excludeSelf: true,
                });
            },
        },
        {
            sourceDefId: 'robot_microbot_fixer',
            compute: (ctx, helpers) => {
                if (!isMicrobot(ctx.state, ctx.minion)) return 0;
                return helpers.countMinionsInPlayMatchingRuntimeDefId(ctx, 'robot_microbot_fixer', {
                    controllerId: ctx.minion.controller,
                });
            },
        },
    ]);
}

// ============================================================================
// 幽灵派系
// ============================================================================

function registerGhostModifiers(): void {
    registerCustomPowerModifiers([
        {
            sourceDefId: 'ghost_haunting',
            compute: (ctx, helpers) => {
                if (!helpers.matchesRuntimeDefId(ctx.minion.defId, 'ghost_haunting')) return 0;
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
    registerCustomPowerModifiers([
        {
            sourceDefId: 'steampunk_steam_man',
            compute: (ctx, helpers) => {
                if (!helpers.matchesRuntimeDefId(ctx.minion.defId, 'steampunk_steam_man')) return 0;
                return helpers.countActionsOnBaseControlledBy(ctx, ctx.minion.controller) > 0 ? 1 : 0;
            },
        },
    ]);

    registerCustomBasePowerModifiers([
        {
            defId: 'steampunk_aggromotive',
            compute: (ctx, helpers) => {
                if (!ctx.ongoing) return 0;
                const ongoingControllerId = helpers.getActionControllerId(ctx.ongoing);
                if (ongoingControllerId !== ctx.playerId) return 0;
                return helpers.hasMinionOnBaseControlledBy(ctx.base, ongoingControllerId) ? 5 : 0;
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
                    const controllerId = getActionControllerId(card);
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
    registerCustomPowerModifiers([
        {
            sourceDefId: 'ancient_egyptians_priest_of_anubis',
            compute: (ctx, helpers) => {
                if (!helpers.matchesRuntimeDefId(ctx.minion.defId, 'ancient_egyptians_priest_of_anubis')) return 0;
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
    registerCustomPowerModifiers([
        {
            sourceDefId: 'mermaids_temptress',
            compute: (ctx, helpers) => {
                if (!helpers.matchesRuntimeDefId(ctx.minion.defId, 'mermaids_temptress')) return 0;
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
    registerCustomPowerModifiers([
        {
            sourceDefId: 'fairies_leaf_armor',
            variantPolicy: 'baseOnly',
            compute: (ctx) => (
                ctx.minion.attachedActions.filter(action => action.defId === 'fairies_leaf_armor').length
            ),
        },
        {
            sourceDefId: 'fairies_daisy_chain',
            variantPolicy: 'baseOnly',
            compute: (ctx, helpers) => (
                helpers.sumMinionAttachmentsMatchingRuntimeDefId(
                    ctx,
                    'fairies_daisy_chain',
                    (action) => (helpers.getActionControllerId(action) === ctx.minion.controller ? 2 : -2),
                )
            ),
        },
        {
            sourceDefId: 'fairies_enchantment',
            variantPolicy: 'baseOnly',
            compute: (ctx, helpers) => (
                helpers.sumBaseOngoingsMatchingRuntimeDefId(ctx, 'fairies_enchantment', (action) => {
                    const mode = action.metadata?.fairiesEnchantmentMode;
                    if (mode === 'plus') return 1;
                    if (mode === 'minus') return -1;
                    return 0;
                })
            ),
        },
    ]);
}

function registerPrincessesModifiers(): void {
    registerCustomPowerModifiers([
        {
            sourceDefId: 'princesses_heirloom',
            runtimeIdentity: 'actionFamily',
            compute: (ctx, helpers) => {
                const heirloomCount = helpers.countMinionAttachmentsMatchingRuntimeDefId(ctx, 'princesses_heirloom');
                return heirloomCount === 0 ? 0 : heirloomCount * heirloomCount;
            },
        },
    ]);
}

function countControlledCharacterModifiers(state: SmashUpCore, playerId: string, baseIndex?: number): number {
    let count = 0;
    for (let index = 0; index < state.bases.length; index += 1) {
        if (baseIndex !== undefined && index !== baseIndex) continue;
        for (const minion of state.bases[index].minions) {
            for (const action of minion.attachedActions) {
                const def = getCardDef(action.defId);
                if (def?.type !== 'action' || def.subtype !== 'ongoing' || def.ongoingTarget !== 'minion') continue;
                if (isCardSuppressed(state, action.uid)) continue;
                if (getActionControllerId(action) === playerId) count += 1;
            }
        }
    }
    return count;
}

function registerDisneyModifiers(): void {
    registerCustomPowerModifiers([
        {
            sourceDefId: 'nightmare_before_christmas_the_mayor_of_halloween_town',
            compute: (ctx, helpers) => {
                const hasMayor = helpers.countMinionsOnBaseMatchingRuntimeDefId(
                    ctx,
                    'nightmare_before_christmas_the_mayor_of_halloween_town',
                    { controllerId: ctx.minion.controller },
                ) > 0;
                if (!hasMayor) return 0;
                return countControlledCharacterModifiers(ctx.state, ctx.minion.controller, ctx.baseIndex) > 0 ? 1 : 0;
            },
        },
        {
            sourceDefId: 'nightmare_before_christmas_zero',
            compute: (ctx, helpers) => {
                if (!helpers.matchesRuntimeDefId(ctx.minion.defId, 'nightmare_before_christmas_zero')) return 0;
                return countControlledCharacterModifiers(ctx.state, ctx.minion.controller, ctx.baseIndex) > 0 ? 3 : 0;
            },
        },
        {
            sourceDefId: 'nightmare_before_christmas_monster_garland',
            runtimeIdentity: 'actionFamily',
            compute: (ctx, helpers) => helpers.sumMinionAttachmentsMatchingRuntimeDefId(
                ctx,
                'nightmare_before_christmas_monster_garland',
                action => (getActionControllerId(action) === ctx.minion.controller ? 3 : -2),
            ),
        },
        {
            sourceDefId: 'nightmare_before_christmas_sandy_claws_costume',
            runtimeIdentity: 'actionFamily',
            compute: (ctx, helpers) => helpers.sumMinionAttachmentsMatchingRuntimeDefId(
                ctx,
                'nightmare_before_christmas_sandy_claws_costume',
                action => countControlledCharacterModifiers(ctx.state, getActionControllerId(action)),
            ),
        },
        {
            sourceDefId: 'nightmare_before_christmas_oogie_boogie',
            runtimeIdentity: 'actionFamily',
            compute: (ctx, helpers) => helpers.sumMinionAttachmentsMatchingRuntimeDefId(
                ctx,
                'nightmare_before_christmas_oogie_boogie',
                () => -(ctx.minion.basePower + (ctx.minion.powerCounters ?? 0) + ctx.minion.powerModifier + (ctx.minion.tempPowerModifier ?? 0)),
            ),
        },
        {
            sourceDefId: 'wreck_it_ralph_king_candy',
            runtimeIdentity: 'actionFamily',
            compute: (ctx) => (
                ctx.minion.metadata?.kingCandyCounterSuppressedBy
                    ? -(ctx.minion.powerCounters ?? 0)
                    : 0
            ),
        },
    ]);

    registerCustomBreakpointModifiers([
        {
            sourceDefId: 'beauty_and_the_beast_gaston',
            runtimeIdentity: 'actionFamily',
            compute: (ctx, helpers) => helpers.countBaseOngoingsMatchingRuntimeDefId(ctx, 'beauty_and_the_beast_gaston') * 5,
        },
        {
            sourceDefId: 'wreck_it_ralph_i_m_gonna_wreck_it',
            runtimeIdentity: 'actionFamily',
            compute: (ctx, helpers) => helpers.countBaseOngoingsMatchingRuntimeDefId(ctx, 'wreck_it_ralph_i_m_gonna_wreck_it') * -3,
        },
    ]);
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

    registerCustomPowerModifiers([
        {
            sourceDefId: 'shapeshifters_mimic',
            compute: (ctx, helpers) => {
                if (!helpers.matchesRuntimeDefId(ctx.minion.defId, 'shapeshifters_mimic')) return 0;
                const highestPrintedPower = getHighestPrintedPower(ctx.state);
                return highestPrintedPower - getCardPrintedPower(ctx.minion.defId);
            },
        },
        {
            sourceDefId: 'cyborg_apes_furious_george',
            compute: (ctx, helpers) => {
                if (!helpers.matchesRuntimeDefId(ctx.minion.defId, 'cyborg_apes_furious_george')) return 0;
                return helpers.getMinionAttachmentCount(ctx);
            },
        },
        {
            sourceDefId: 'shapeshifters_copycat_copied_power',
            variantPolicy: 'baseOnly',
            compute: (ctx, helpers) => {
                if (!helpers.matchesRuntimeDefId(ctx.minion.defId, 'shapeshifters_copycat')) return 0;
                if (ctx.minion.metadata?.copiedAbilityUntilTurn !== ctx.state.turnNumber) return 0;
                const copiedDefId = ctx.minion.metadata?.copiedAbilityDefId;
                if (helpers.matchesRuntimeDefId(copiedDefId, 'shapeshifters_mimic')) {
                    return getHighestPrintedPower(ctx.state) - getCardPrintedPower(ctx.minion.defId);
                }
                if (helpers.matchesRuntimeDefId(copiedDefId, 'cyborg_apes_furious_george')) {
                    return ctx.minion.attachedActions.length;
                }
                return 0;
            },
        },
        {
            sourceDefId: 'shapeshifters_cellular_bonding_copied_power',
            variantPolicy: 'baseOnly',
            compute: (ctx, helpers) => {
                const bondingCardUid = ctx.minion.metadata?.cellularBondingCardUid;
                const copiedDefId = ctx.minion.metadata?.cellularBondingCopiedActionDefId;
                if (typeof bondingCardUid !== 'string' || typeof copiedDefId !== 'string') return 0;
                if (!ctx.minion.attachedActions.some(action => action.uid === bondingCardUid)) return 0;
                if (helpers.matchesRuntimeDefId(copiedDefId, 'shapeshifters_splice_as_nice')) return 2;
                if (helpers.matchesRuntimeDefId(copiedDefId, 'cyborg_apes_cyberevolution')) return 3;
                if (helpers.matchesRuntimeDefId(copiedDefId, 'cyborg_apes_juiced_up')) return ctx.minion.attachedActions.length * 2;
                return 0;
            },
        },
        {
            sourceDefId: 'cyborg_apes_juiced_up',
            runtimeIdentity: 'actionFamily',
            compute: (ctx, helpers) => (
                helpers.countMinionAttachmentsMatchingRuntimeDefId(ctx, 'cyborg_apes_juiced_up')
                * helpers.getMinionAttachmentCount(ctx)
                * 2
            ),
        },
        {
            sourceDefId: 'base_monkey_lab',
            variantPolicy: 'baseOnly',
            compute: (ctx, helpers) => {
                if (ctx.base.defId !== 'base_monkey_lab') return 0;
                if (isBaseAbilitySuppressed(ctx.state, ctx.baseIndex)) return 0;
                return helpers.getMinionAttachmentCount(ctx);
            },
        },
    ]);
}

function getCardPrintedPower(defId: string): number {
    const card = getCardDef(defId);
    return card?.type === 'minion' ? (card.power ?? 0) : 0;
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

    registerCustomPowerModifiers([
        {
            sourceDefId: 'kaiju_kaijookey',
            compute: (ctx, helpers) => {
                if (!helpers.matchesRuntimeDefId(ctx.minion.defId, 'kaiju_kaijookey')) return 0;
                return helpers.countActionsOnBaseControlledBy(ctx, ctx.minion.controller, {
                    controllerLens: 'owner',
                });
            },
        },
    ]);

    registerTitanPowerModifier('kaiju_gorgodzolla', (ctx) => {
        const baseDef = getBaseDef(ctx.base.defId);
        if (baseDef?.id !== 'base_kaiju_island') return 0;
        return 3;
    });
}

function registerKittyCatsModifiers(): void {
    registerCustomPowerModifiers([
        {
            sourceDefId: 'kitty_cats_grumpiness',
            runtimeIdentity: 'actionFamily',
            compute: (ctx, helpers) => (
                helpers.countMinionAttachmentsMatchingRuntimeDefId(ctx, 'kitty_cats_grumpiness', {
                    semanticRole: 'target',
                    targetEffectType: 'affect',
                }) * -2
            ),
        },
        {
            sourceDefId: 'kitty_cats_hissy_fit',
            runtimeIdentity: 'actionFamily',
            compute: (ctx, helpers) => (
                helpers.countBaseOngoingsMatchingRuntimeDefId(ctx, 'kitty_cats_hissy_fit', {
                    relationToTargetController: 'different',
                    semanticRole: 'target',
                    targetEffectType: 'affect',
                }) * -1
            ),
        },
    ]);
}

function registerMythicHorsesModifiers(): void {
    registerCustomPowerModifiers([
        {
            sourceDefId: 'mythic_horses_starlyte',
            variantPolicy: 'baseOnly',
            compute: (ctx, helpers) => {
                if (!helpers.matchesRuntimeDefId(ctx.minion.defId, 'mythic_horses_starlyte')) return 0;
                return helpers.countMinionsOnBaseControlledBy(ctx, ctx.minion.controller, {
                    excludeSelf: true,
                });
            },
        },
        {
            sourceDefId: 'mythic_horses_starlyte_pod',
            variantPolicy: 'override',
            compute: (ctx) => {
                if (ctx.minion.defId !== 'mythic_horses_starlyte_pod') return 0;
                return ctx.base.minions.filter(minion => (
                    minion.uid !== ctx.minion.uid
                    && minion.controller === ctx.minion.controller
                )).length;
            },
        },
        {
            sourceDefId: 'mythic_horses_pinkie',
            compute: (ctx, helpers) => {
                if (!helpers.matchesRuntimeDefId(ctx.minion.defId, 'mythic_horses_pinkie')) return 0;
                return helpers.countMinionsOnBaseControlledBy(ctx, ctx.minion.controller, {
                    excludeSelf: true,
                }) > 0 ? 1 : 0;
            },
        },
        {
            sourceDefId: 'mythic_horses_encouragement_power',
            variantPolicy: 'baseOnly',
            compute: (ctx) => (
                ctx.minion.attachedActions.reduce((total, action) => {
                    if (action.defId !== 'mythic_horses_encouragement_power') return total;
                    const otherOwnerMinionCount = ctx.base.minions.filter(minion => (
                        minion.uid !== ctx.minion.uid
                        && minion.controller === action.ownerId
                    )).length;
                    return total + otherOwnerMinionCount;
                }, 0)
            ),
        },
        {
            sourceDefId: 'mythic_horses_encouragement_power_pod',
            variantPolicy: 'override',
            compute: (ctx) => (
                ctx.minion.attachedActions.reduce((total, action) => {
                    if (action.defId !== 'mythic_horses_encouragement_power_pod') return total;
                    const hasOtherOwnerMinion = ctx.base.minions.some(minion => (
                        minion.uid !== ctx.minion.uid
                        && minion.controller === action.ownerId
                    ));
                    return hasOtherOwnerMinion ? total + 1 : total;
                }, 0)
            ),
        },
    ]);
}
// ============================================================================
// 基地持续力量修正
// ============================================================================

function registerBaseModifiers(): void {
    registerCustomPowerModifiers([
        {
            sourceDefId: 'base_minionPowerBonus',
            runtimeIdentity: 'synthetic',
            compute: (ctx) => {
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
    registerCustomPowerModifiers([
        {
            sourceDefId: 'base_wyrms_desolation',
            runtimeIdentity: 'synthetic',
            compute: (ctx) => {
                if (ctx.base.defId !== 'base_wyrms_desolation') return 0;
                if (isBaseAbilitySuppressed(ctx.state, ctx.baseIndex)) return 0;
                return -1;
            },
        },
    ]);
}

function registerSuperheroesModifiers(): void {
}

function registerAvengersModifiers(): void {
    registerCustomPowerModifiers([
        {
            sourceDefId: 'avengers_caps_shield',
            runtimeIdentity: 'actionFamily',
            compute: (ctx, helpers) => {
                let bonus = 0;
                for (const host of ctx.base.minions) {
                    if (!helpers.matchesRuntimeDefId(host.defId, 'avengers_captain_america')) continue;
                    for (const action of host.attachedActions) {
                        if (!helpers.matchesRuntimeDefId(action.defId, 'avengers_caps_shield')) continue;
                        if (getActionControllerId(action) !== ctx.minion.controller) continue;
                        bonus += 1;
                    }
                }
                return bonus;
            },
        },
        {
            sourceDefId: 'avengers_mjolnir',
            runtimeIdentity: 'actionFamily',
            compute: (ctx, helpers) => (
                helpers.sumMinionAttachmentsMatchingRuntimeDefId(
                    ctx,
                    'avengers_mjolnir',
                    () => helpers.matchesRuntimeDefId(ctx.minion.defId, 'avengers_thor') ? 2 : -2,
                )
            ),
        },
    ]);
}

function registerMarvelWaveOneModifiers(): void {
    registerCustomPowerModifiers([
        {
            sourceDefId: 'shield_agent',
            compute: (ctx, helpers) => {
                if (!helpers.matchesRuntimeDefId(ctx.minion.defId, 'shield_agent')) return 0;
                return helpers.countMinionsOnBaseControlledBy(ctx, ctx.minion.controller, {
                    excludeSelf: true,
                }) > 0 ? 1 : 0;
            },
        },
        {
            sourceDefId: 'spider_verse_bond',
            runtimeIdentity: 'actionFamily',
            compute: (ctx, helpers) => (
                helpers.sumMinionAttachmentsMatchingRuntimeDefId(
                    ctx,
                    'spider_verse_bond',
                    (action) => helpers.countMinionsOnBaseControlledBy(ctx, getActionControllerId(action), {
                        excludeSelf: true,
                    }),
                )
            ),
        },
        {
            sourceDefId: 'spider_verse_webbed_up',
            runtimeIdentity: 'actionFamily',
            compute: (ctx, helpers) => (
                helpers.countMinionAttachmentsMatchingRuntimeDefId(ctx, 'spider_verse_webbed_up') * -2
            ),
        },
    ]);
}

function registerZhongguoModifiers(): void {
    registerCustomPowerModifiers([
        {
            sourceDefId: 'truckers_rubber_chicken',
            compute: (ctx, helpers) => {
                if (!helpers.matchesRuntimeDefId(ctx.minion.defId, 'truckers_rubber_chicken')) return 0;
                return helpers.countActionsOnBaseControlledBy(ctx, ctx.minion.controller);
            },
        },
    ]);

    registerCustomBasePowerModifiers([
        {
            defId: 'truckers_convoy',
            compute: (ctx, helpers) => {
                if (!ctx.ongoing) return 0;
                const controllerId = helpers.getActionControllerId(ctx.ongoing);
                if (controllerId !== ctx.playerId) return 0;
                return ctx.base.ongoingActions
                    .filter(action => helpers.getActionControllerId(action) === controllerId)
                    .length;
            },
        },
    ]);
}

function registerInternationalIncidentModifiers(): void {
    registerCustomPowerModifiers([
        {
            sourceDefId: 'mounties_mountie_major',
            compute: (ctx, helpers) => {
                if (!helpers.matchesRuntimeDefId(ctx.minion.defId, 'mounties_mountie_major')) return 0;
                const countsByOtherPlayer = new Map<string, number>();
                for (const minion of ctx.base.minions) {
                    if (minion.controller === ctx.minion.controller) continue;
                    countsByOtherPlayer.set(minion.controller, (countsByOtherPlayer.get(minion.controller) ?? 0) + 1);
                }
                return Math.max(0, ...countsByOtherPlayer.values());
            },
        },
        {
            sourceDefId: 'luchadors_powerful_set_up',
            runtimeIdentity: 'actionFamily',
            compute: (ctx, helpers) => {
                let total = 0;
                for (const minion of ctx.base.minions) {
                    for (const action of minion.attachedActions) {
                        if (!helpers.matchesRuntimeDefId(action.defId, 'luchadors_powerful_set_up')) continue;
                        if (isCardSuppressed(ctx.state, action.uid)) continue;
                        if (getActionControllerId(action) === ctx.minion.controller) total += 1;
                    }
                }
                return total;
            },
        },
        {
            sourceDefId: 'luchadors_flor_loca',
            compute: (ctx, helpers) => {
                if (!helpers.matchesRuntimeDefId(ctx.minion.defId, 'luchadors_flor_loca')) return 0;
                const hasOwnActionOnOtherPlayerMinion = ctx.base.minions.some(minion => (
                    minion.controller !== ctx.minion.controller
                    && minion.attachedActions.some(action => (
                        !isCardSuppressed(ctx.state, action.uid)
                        && getActionControllerId(action) === ctx.minion.controller
                    ))
                ));
                return hasOwnActionOnOtherPlayerMinion ? 2 : 0;
            },
        },
    ]);
}

function registerWhatWereWeThinkingModifiers(): void {
    registerCustomPowerModifiers([
        {
            sourceDefId: 'rock_stars_hot_venue',
            runtimeIdentity: 'actionFamily',
            compute: (ctx, helpers) => (
                helpers.countBaseOngoingsMatchingRuntimeDefId(ctx, 'rock_stars_hot_venue', {
                    relationToTargetController: 'same',
                })
            ),
        },
        {
            sourceDefId: 'teddy_bears_lovey_bear',
            compute: (ctx, helpers) => {
                if (!helpers.matchesRuntimeDefId(ctx.minion.defId, 'teddy_bears_lovey_bear')) return 0;
                const highestOpponentPrintedPower = Math.max(
                    0,
                    ...ctx.base.minions
                        .filter(minion => minion.controller !== ctx.minion.controller)
                        .map(minion => getCardPrintedPower(minion.defId)),
                );
                return Math.max(0, highestOpponentPrintedPower - getCardPrintedPower(ctx.minion.defId));
            },
        },
    ]);

    registerCustomBreakpointModifiers([
        {
            sourceDefId: 'rock_stars_turn_up_to_11',
            runtimeIdentity: 'actionFamily',
            compute: (ctx, helpers) => (
                ctx.originalBreakpoint < 21
                && helpers.countBaseOngoingsMatchingRuntimeDefId(ctx, 'rock_stars_turn_up_to_11') > 0
                    ? 21 - ctx.originalBreakpoint
                    : 0
            ),
        },
    ]);
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
    registerDisneyModifiers();
    registerKaijuModifiers();
    registerKittyCatsModifiers();
    registerMythicHorsesModifiers();
    registerWerewolfModifiers();
    registerDragonModifiers();
    registerSuperheroesModifiers();
    registerAvengersModifiers();
    registerMarvelWaveOneModifiers();
    registerYuanhouModifiers();
    registerZhongguoModifiers();
    registerInternationalIncidentModifiers();
    registerWhatWereWeThinkingModifiers();
}
