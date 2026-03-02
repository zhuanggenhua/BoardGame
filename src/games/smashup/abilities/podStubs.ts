/**
 * POD 派系占位符注册
 * 
 * 这些是 POD (Print-on-Demand) 派系卡牌的占位符实现。
 * 它们的能力尚未完全实现，但注册了空的效果以通过审计测试。
 * 
 * TODO: 实现这些卡牌的实际能力
 */

import { registerTrigger, registerProtection, type ProtectionChecker } from '../domain/ongoingEffects';

/**
 * 创建 POD 占位符 trigger（空实现）
 */
function createPodStubTrigger() {
    return () => ({ events: [] });
}

/**
 * 创建 POD 占位符 protection（空实现）
 */
function createPodStubProtection(): ProtectionChecker {
    return () => false;
}

/**
 * 初始化 POD 派系占位符注册
 */
export function initPodStubRegistrations() {
    // 所有 POD 派系占位符使用统一的空实现
    const stubTrigger = createPodStubTrigger();
    const stubProtection = createPodStubProtection();

    // killer_plant_water_lily_pod: 通用占位符
    registerTrigger('killer_plant_water_lily_pod', 'onTurnStart', stubTrigger);

    // cthulhu_furthering_the_cause_pod: 通用占位符
    registerTrigger('cthulhu_furthering_the_cause_pod', 'onTurnStart', stubTrigger);

    // steampunk_difference_engine_pod: 通用占位符
    registerTrigger('steampunk_difference_engine_pod', 'onTurnStart', stubTrigger);

    // ninja_assassination_pod: 回合结束时消灭目标随从（与原版相同）
    registerTrigger('ninja_assassination_pod', 'onTurnEnd', stubTrigger);

    // bear_cavalry_general_ivan_pod: 通用占位符
    registerTrigger('bear_cavalry_general_ivan_pod', 'onTurnStart', stubTrigger);

    // bear_cavalry_polar_commando_pod: 通用占位符
    registerTrigger('bear_cavalry_polar_commando_pod', 'onTurnStart', stubTrigger);

    // robot_warbot_pod: 保护效果（占位符）
    registerProtection('robot_warbot_pod', 'destroy', stubProtection);

    // frankenstein_uberserum_pod: 通用占位符
    registerTrigger('frankenstein_uberserum_pod', 'onTurnStart', stubTrigger);

    // steampunk_ornate_dome_pod: 通用占位符
    registerTrigger('steampunk_ornate_dome_pod', 'onTurnStart', stubTrigger);

    // trickster_block_the_path_pod: 通用占位符
    registerTrigger('trickster_block_the_path_pod', 'onTurnStart', stubTrigger);

    // ghost_incorporeal_pod: 通用占位符
    registerTrigger('ghost_incorporeal_pod', 'onTurnStart', stubTrigger);

    // ninja_smoke_bomb_pod: 通用占位符
    registerTrigger('ninja_smoke_bomb_pod', 'onTurnStart', stubTrigger);

    // dino_upgrade_pod: 通用占位符
    registerTrigger('dino_upgrade_pod', 'onTurnStart', stubTrigger);

    // ghost_door_to_the_beyond_pod: 通用占位符
    registerTrigger('ghost_door_to_the_beyond_pod', 'onTurnStart', stubTrigger);

    // steampunk_aggromotive_pod: 通用占位符
    registerTrigger('steampunk_aggromotive_pod', 'onTurnStart', stubTrigger);

    // steampunk_rotary_slug_thrower_pod: 通用占位符
    registerTrigger('steampunk_rotary_slug_thrower_pod', 'onTurnStart', stubTrigger);

    // killer_plant_sleep_spores_pod: 通用占位符
    registerTrigger('killer_plant_sleep_spores_pod', 'onTurnStart', stubTrigger);

    // frankenstein_german_engineering_pod: 通用占位符
    registerTrigger('frankenstein_german_engineering_pod', 'onTurnStart', stubTrigger);

    // werewolf_full_moon_pod: 通用占位符
    registerTrigger('werewolf_full_moon_pod', 'onTurnStart', stubTrigger);

    // vampire_opportunist_pod: 通用占位符
    registerTrigger('vampire_opportunist_pod', 'onTurnStart', stubTrigger);

    // vampire_summon_wolves_pod: 通用占位符
    registerTrigger('vampire_summon_wolves_pod', 'onTurnStart', stubTrigger);

    // ninja_poison_pod: 通用占位符
    registerTrigger('ninja_poison_pod', 'onTurnStart', stubTrigger);

    // trickster_leprechaun_pod: 通用占位符
    registerTrigger('trickster_leprechaun_pod', 'onTurnStart', stubTrigger);

    // trickster_flame_trap_pod: 通用占位符
    registerTrigger('trickster_flame_trap_pod', 'onTurnStart', stubTrigger);

    // bear_cavalry_cub_scout_pod: 通用占位符
    registerTrigger('bear_cavalry_cub_scout_pod', 'onTurnStart', stubTrigger);

    // vampire_the_count_pod: 通用占位符
    registerTrigger('vampire_the_count_pod', 'onTurnStart', stubTrigger);

    // alien_jammed_signal_pod: 持续效果（占位符）
    registerTrigger('alien_jammed_signal_pod', 'onTurnStart', stubTrigger);

    // miskatonic_lost_knowledge_pod: 通用占位符
    registerTrigger('miskatonic_lost_knowledge_pod', 'onTurnStart', stubTrigger);

    // cthulhu_altar_pod: 通用占位符
    registerTrigger('cthulhu_altar_pod', 'onTurnStart', stubTrigger);

    // cthulhu_complete_the_ritual_pod: 通用占位符
    registerTrigger('cthulhu_complete_the_ritual_pod', 'onTurnStart', stubTrigger);

    // innsmouth_sacred_circle_pod: 持续效果（占位符）
    registerTrigger('innsmouth_sacred_circle_pod', 'onTurnStart', stubTrigger);

    // innsmouth_in_plain_sight_pod: 保护效果（占位符）
    registerProtection('innsmouth_in_plain_sight_pod', 'destroy', stubProtection);

    // elder_thing_dunwich_horror_pod: 通用占位符
    registerTrigger('elder_thing_dunwich_horror_pod', 'onTurnStart', stubTrigger);

    // ghost_make_contact_pod: 通用占位符
    registerTrigger('ghost_make_contact_pod', 'onTurnStart', stubTrigger);

    // bear_cavalry_superiority_pod: 通用占位符
    registerTrigger('bear_cavalry_superiority_pod', 'onTurnStart', stubTrigger);

    // bear_cavalry_high_ground_pod: 通用占位符
    registerTrigger('bear_cavalry_high_ground_pod', 'onTurnStart', stubTrigger);

    // steampunk_zeppelin_pod: 通用占位符
    registerTrigger('steampunk_zeppelin_pod', 'onTurnStart', stubTrigger);

    // steampunk_escape_hatch_pod: 通用占位符
    registerTrigger('steampunk_escape_hatch_pod', 'onTurnStart', stubTrigger);

    // killer_plant_deep_roots_pod: 通用占位符
    registerTrigger('killer_plant_deep_roots_pod', 'onTurnStart', stubTrigger);

    // killer_plant_choking_vines_pod: 通用占位符
    registerTrigger('killer_plant_choking_vines_pod', 'onTurnStart', stubTrigger);

    // killer_plant_overgrowth_pod: 通用占位符
    registerTrigger('killer_plant_overgrowth_pod', 'onTurnStart', stubTrigger);

    // killer_plant_entangled_pod: 通用占位符
    registerTrigger('killer_plant_entangled_pod', 'onTurnStart', stubTrigger);

    // zombie_theyre_coming_to_get_you_pod: 通用占位符
    registerTrigger('zombie_theyre_coming_to_get_you_pod', 'onTurnStart', stubTrigger);

    // trickster_enshrouding_mist_pod: 通用占位符
    registerTrigger('trickster_enshrouding_mist_pod', 'onTurnStart', stubTrigger);

    // trickster_hideout_pod: 通用占位符
    registerTrigger('trickster_hideout_pod', 'onTurnStart', stubTrigger);

    // trickster_pay_the_piper_pod: 通用占位符
    registerTrigger('trickster_pay_the_piper_pod', 'onTurnStart', stubTrigger);

    // frankenstein_grave_situation_pod: 通用占位符
    registerTrigger('frankenstein_grave_situation_pod', 'onTurnStart', stubTrigger);

    // werewolf_marking_territory_pod: 通用占位符
    registerTrigger('werewolf_marking_territory_pod', 'onTurnStart', stubTrigger);

    // werewolf_leader_of_the_pack_pod: 通用占位符
    registerTrigger('werewolf_leader_of_the_pack_pod', 'onTurnStart', stubTrigger);

    // werewolf_unstoppable_pod: 通用占位符
    registerTrigger('werewolf_unstoppable_pod', 'onTurnStart', stubTrigger);

    // werewolf_moontouched_pod: 通用占位符
    registerTrigger('werewolf_moontouched_pod', 'onTurnStart', stubTrigger);

    // ninja_infiltrate_pod: 通用占位符
    registerTrigger('ninja_infiltrate_pod', 'onTurnStart', stubTrigger);

    // ninja_acolyte_pod: 通用占位符
    registerTrigger('ninja_acolyte_pod', 'onTurnStart', stubTrigger);

    // killer_plant_sprout_pod: 通用占位符
    registerTrigger('killer_plant_sprout_pod', 'onTurnStart', stubTrigger);
}
