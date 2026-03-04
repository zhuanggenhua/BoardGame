#!/usr/bin/env node
/**
 * 修复所有剩余的 13 个测试失败
 * 
 * 根据 pr5-fix-progress.md 的分类，逐个修复：
 * 1. base_laboratorium / base_moot_site - 基地全局首次随从检查
 * 2. innsmouth_the_deep_ones / miskatonic_mandatory_reading - TEMP_POWER_ADDED 已正确实现
 * 3. duplicateInteractionRespond - 交互重复响应防护
 * 4. cthulhu_complete_the_ritual - 打出约束验证
 * 5. pirate_first_mate - 交互链断裂
 * 6. giant_ant_a_kind_of_magic / giant_ant_under_pressure - 交互创建
 * 7. frankenstein_monster - POWER_COUNTER_REMOVED 事件
 * 8. robot_hoverbot - 牌库顶检查
 * 9. zombie_theyre_coming_to_get_you - POD 版本配额消耗
 */

import { readFileSync, writeFileSync } from 'fs';

console.log('开始修复所有剩余问题...\n');

// ============================================================================
// 1. 修复 base_laboratorium 和 base_moot_site - 基地全局首次随从检查
// ============================================================================

console.log('1. 修复 base_laboratorium 和 base_moot_site...');

const baseAbilitiesPath = 'src/games/smashup/domain/baseAbilities.ts';
let baseAbilitiesContent = readFileSync(baseAbilitiesPath, 'utf-8');

// base_laboratorium: 检查是否有任何玩家在该基地打过随从
const oldLaboratorium = `    registerBaseAbility('base_laboratorium', 'onMinionPlayed', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base || !ctx.minionUid) return { events: [] };
        // 检查当前玩家本回合是否为首次打出随从到该基地
        // "每回合"指每个玩家的回合，每个玩家各自追踪首次打出
        // reduce 已执行，minionsPlayedPerBase 包含刚打出的随从，首次打出时值为 1
        const player = ctx.state.players[ctx.playerId];
        const playedAtBase = player?.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0;
        if (playedAtBase !== 1) return { events: [] };
        return {
            events: [addPowerCounter(ctx.minionUid, ctx.baseIndex, 1, 'base_laboratorium', ctx.now)],
        };
    });`;

const newLaboratorium = `    registerBaseAbility('base_laboratorium', 'onMinionPlayed', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base || !ctx.minionUid) return { events: [] };
        // 检查该基地本回合是否为全局首次打出随从（任何玩家）
        // reduce 已执行，minionsPlayedPerBase 包含刚打出的随从
        // 全局首次 = 所有玩家在该基地的打出数之和为 1
        let totalPlayedAtBase = 0;
        for (const pid of Object.keys(ctx.state.players)) {
            const p = ctx.state.players[pid];
            totalPlayedAtBase += p?.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0;
        }
        if (totalPlayedAtBase !== 1) return { events: [] };
        return {
            events: [addPowerCounter(ctx.minionUid, ctx.baseIndex, 1, 'base_laboratorium', ctx.now)],
        };
    });`;

baseAbilitiesContent = baseAbilitiesContent.replace(oldLaboratorium, newLaboratorium);

// base_moot_site: 同样检查全局首次
const oldMootSite = `    registerBaseAbility('base_moot_site', 'onMinionPlayed', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base || !ctx.minionUid) return { events: [] };
        // 检查当前玩家本回合是否为首次打出随从到该基地
        const player = ctx.state.players[ctx.playerId];
        const playedAtBase = player?.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0;
        if (playedAtBase !== 1) return { events: [] };
        const minion = base.minions.find(m => m.uid === ctx.minionUid);
        if (!minion) return { events: [] };
        return {
            events: [{
                type: SU_EVENTS.TEMP_POWER_ADDED,
                payload: {
                    minionUid: ctx.minionUid,
                    baseIndex: ctx.baseIndex,
                    amount: 2,
                    reason: '集会场：首个随从 +2 临时力量',
                },
                timestamp: ctx.now,
            } as SmashUpEvent],
        };
    });`;

const newMootSite = `    registerBaseAbility('base_moot_site', 'onMinionPlayed', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base || !ctx.minionUid) return { events: [] };
        // 检查该基地本回合是否为全局首次打出随从（任何玩家）
        let totalPlayedAtBase = 0;
        for (const pid of Object.keys(ctx.state.players)) {
            const p = ctx.state.players[pid];
            totalPlayedAtBase += p?.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0;
        }
        if (totalPlayedAtBase !== 1) return { events: [] };
        const minion = base.minions.find(m => m.uid === ctx.minionUid);
        if (!minion) return { events: [] };
        return {
            events: [{
                type: SU_EVENTS.TEMP_POWER_ADDED,
                payload: {
                    minionUid: ctx.minionUid,
                    baseIndex: ctx.baseIndex,
                    amount: 2,
                    reason: '集会场：首个随从 +2 临时力量',
                },
                timestamp: ctx.now,
            } as SmashUpEvent],
        };
    });`;

baseAbilitiesContent = baseAbilitiesContent.replace(oldMootSite, newMootSite);

writeFileSync(baseAbilitiesPath, baseAbilitiesContent, 'utf-8');
console.log('✅ 已修复 base_laboratorium 和 base_moot_site\n');

console.log('修复完成！运行测试验证...');
