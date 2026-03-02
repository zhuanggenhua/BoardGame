#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/games/smashup/domain/baseAbilities.ts';
const content = readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

// 找到 base_laboratorium 的起始行
let labStart = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("registerBaseAbility('base_laboratorium', 'onMinionPlayed'")) {
        labStart = i;
        break;
    }
}

if (labStart === -1) {
    console.error('未找到 base_laboratorium');
    process.exit(1);
}

// 找到结束行（下一个 registerBaseAbility 或 describe）
let labEnd = labStart + 1;
while (labEnd < lines.length && !lines[labEnd].includes('});')) {
    labEnd++;
}
labEnd++; // 包含 });

console.log(`找到 base_laboratorium: 行 ${labStart + 1} - ${labEnd + 1}`);

// 替换 base_laboratorium
const newLabCode = `    registerBaseAbility('base_laboratorium', 'onMinionPlayed', (ctx) => {
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

const newLines = [
    ...lines.slice(0, labStart),
    ...newLabCode.split('\n'),
    ...lines.slice(labEnd),
];

// 找到 base_moot_site
let mootStart = -1;
for (let i = 0; i < newLines.length; i++) {
    if (newLines[i].includes("registerBaseAbility('base_moot_site', 'onMinionPlayed'")) {
        mootStart = i;
        break;
    }
}

if (mootStart === -1) {
    console.error('未找到 base_moot_site');
    process.exit(1);
}

let mootEnd = mootStart + 1;
while (mootEnd < newLines.length && !newLines[mootEnd].includes('    });')) {
    mootEnd++;
}
mootEnd++; // 包含 });

console.log(`找到 base_moot_site: 行 ${mootStart + 1} - ${mootEnd + 1}`);

// 替换 base_moot_site
const newMootCode = `    registerBaseAbility('base_moot_site', 'onMinionPlayed', (ctx) => {
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

const finalLines = [
    ...newLines.slice(0, mootStart),
    ...newMootCode.split('\n'),
    ...newLines.slice(mootEnd),
];

writeFileSync(filePath, finalLines.join('\n'), 'utf-8');
console.log('✅ 修复完成');
