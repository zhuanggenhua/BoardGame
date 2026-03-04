/**
 * POD 数据一致性审计脚本
 * 
 * 检查所有 POD 版本卡牌与基础版的数据定义是否一致
 * 
 * 检查项：
 * 1. power（力量值）
 * 2. abilityTags（能力标签）
 * 3. specialLimitGroup（special 限制组）
 * 4. beforeScoringPlayable（计分前可打出）
 * 5. ongoingTarget（ongoing 目标类型）
 * 6. subtype（行动卡子类型）
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// 读取所有派系数据文件
const factionFiles = [
    'aliens', 'bear_cavalry', 'cthulhu', 'dinosaurs', 'elder_things',
    'frankenstein', 'ghosts', 'giant-ants', 'innsmouth', 'killer_plants',
    'miskatonic', 'ninjas', 'pirates', 'robots', 'steampunks',
    'tricksters', 'vampires', 'werewolves', 'wizards', 'zombies'
];

// 需要检查一致性的字段
const MINION_FIELDS = ['power', 'abilityTags', 'specialLimitGroup', 'beforeScoringPlayable'];
const ACTION_FIELDS = ['abilityTags', 'ongoingTarget', 'subtype', 'beforeScoringPlayable'];

// 解析 TypeScript 文件中的卡牌定义（简单正则匹配）
function parseCardDefs(content, arrayName) {
    const cards = [];
    const arrayMatch = content.match(new RegExp(`export const ${arrayName}[^=]*=\\s*\\[([\\s\\S]*?)\\];`, 'm'));
    if (!arrayMatch) return cards;

    const arrayContent = arrayMatch[1];
    const cardMatches = arrayContent.matchAll(/\{[\s\S]*?\}/g);

    for (const match of cardMatches) {
        const cardStr = match[0];
        const idMatch = cardStr.match(/id:\s*['"]([^'"]+)['"]/);
        if (!idMatch) continue;

        const card = { id: idMatch[1] };

        // 提取各个字段
        const powerMatch = cardStr.match(/power:\s*(\d+)/);
        if (powerMatch) card.power = parseInt(powerMatch[1]);

        const abilityTagsMatch = cardStr.match(/abilityTags:\s*\[([^\]]+)\]/);
        if (abilityTagsMatch) {
            card.abilityTags = abilityTagsMatch[1]
                .split(',')
                .map(s => s.trim().replace(/['"]/g, ''))
                .filter(Boolean);
        }

        const specialLimitGroupMatch = cardStr.match(/specialLimitGroup:\s*['"]([^'"]+)['"]/);
        if (specialLimitGroupMatch) card.specialLimitGroup = specialLimitGroupMatch[1];

        const beforeScoringPlayableMatch = cardStr.match(/beforeScoringPlayable:\s*(true|false)/);
        if (beforeScoringPlayableMatch) card.beforeScoringPlayable = beforeScoringPlayableMatch[1] === 'true';

        const ongoingTargetMatch = cardStr.match(/ongoingTarget:\s*['"]([^'"]+)['"]/);
        if (ongoingTargetMatch) card.ongoingTarget = ongoingTargetMatch[1];

        const subtypeMatch = cardStr.match(/subtype:\s*['"]([^'"]+)['"]/);
        if (subtypeMatch) card.subtype = subtypeMatch[1];

        const typeMatch = cardStr.match(/type:\s*['"]([^'"]+)['"]/);
        if (typeMatch) card.type = typeMatch[1];

        cards.push(card);
    }

    return cards;
}

// 比较两个值是否相等（数组需要深度比较）
function isEqual(a, b) {
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        return a.every((v, i) => v === b[i]);
    }
    return a === b;
}

// 主函数
function auditPodConsistency() {
    console.log('🔍 开始 POD 数据一致性审计...\n');

    const issues = [];
    let totalChecked = 0;

    for (const faction of factionFiles) {
        const basePath = join(projectRoot, `src/games/smashup/data/factions/${faction}.ts`);
        const podPath = join(projectRoot, `src/games/smashup/data/factions/${faction}_pod.ts`);

        let baseContent, podContent;
        try {
            baseContent = readFileSync(basePath, 'utf-8');
            podContent = readFileSync(podPath, 'utf-8');
        } catch (err) {
            continue; // 文件不存在，跳过
        }

        // 解析随从
        const baseMinions = parseCardDefs(baseContent, `${faction.toUpperCase().replace(/-/g, '_')}_MINIONS`);
        const podMinions = parseCardDefs(podContent, `${faction.toUpperCase().replace(/-/g, '_')}_POD_MINIONS`);

        // 解析行动卡
        const baseActions = parseCardDefs(baseContent, `${faction.toUpperCase().replace(/-/g, '_')}_ACTIONS`);
        const podActions = parseCardDefs(podContent, `${faction.toUpperCase().replace(/-/g, '_')}_POD_ACTIONS`);

        // 检查随从
        for (const podMinion of podMinions) {
            if (!podMinion.id.endsWith('_pod')) continue;
            const baseId = podMinion.id.replace(/_pod$/, '');
            const baseMinion = baseMinions.find(m => m.id === baseId);
            if (!baseMinion) continue;

            totalChecked++;

            for (const field of MINION_FIELDS) {
                const baseValue = baseMinion[field];
                const podValue = podMinion[field];

                // 跳过两者都未定义的情况
                if (baseValue === undefined && podValue === undefined) continue;

                if (!isEqual(baseValue, podValue)) {
                    issues.push({
                        faction,
                        cardId: podMinion.id,
                        field,
                        baseValue,
                        podValue,
                        type: 'minion'
                    });
                }
            }
        }

        // 检查行动卡
        for (const podAction of podActions) {
            if (!podAction.id.endsWith('_pod')) continue;
            const baseId = podAction.id.replace(/_pod$/, '');
            const baseAction = baseActions.find(a => a.id === baseId);
            if (!baseAction) continue;

            totalChecked++;

            for (const field of ACTION_FIELDS) {
                const baseValue = baseAction[field];
                const podValue = podAction[field];

                // 跳过两者都未定义的情况
                if (baseValue === undefined && podValue === undefined) continue;

                if (!isEqual(baseValue, podValue)) {
                    issues.push({
                        faction,
                        cardId: podAction.id,
                        field,
                        baseValue,
                        podValue,
                        type: 'action'
                    });
                }
            }
        }
    }

    // 输出结果
    console.log(`✅ 检查完成：共检查 ${totalChecked} 张 POD 卡牌\n`);

    if (issues.length === 0) {
        console.log('🎉 所有 POD 卡牌数据与基础版一致！');
        return;
    }

    console.log(`❌ 发现 ${issues.length} 个不一致问题：\n`);

    // 按派系分组输出
    const issuesByFaction = {};
    for (const issue of issues) {
        if (!issuesByFaction[issue.faction]) {
            issuesByFaction[issue.faction] = [];
        }
        issuesByFaction[issue.faction].push(issue);
    }

    for (const [faction, factionIssues] of Object.entries(issuesByFaction)) {
        console.log(`\n📦 ${faction} (${factionIssues.length} 个问题):`);
        for (const issue of factionIssues) {
            console.log(`  ❌ ${issue.cardId} (${issue.type})`);
            console.log(`     字段: ${issue.field}`);
            console.log(`     基础版: ${JSON.stringify(issue.baseValue)}`);
            console.log(`     POD 版: ${JSON.stringify(issue.podValue)}`);
        }
    }

    console.log('\n\n📋 汇总统计：');
    const fieldStats = {};
    for (const issue of issues) {
        fieldStats[issue.field] = (fieldStats[issue.field] || 0) + 1;
    }
    for (const [field, count] of Object.entries(fieldStats)) {
        console.log(`  ${field}: ${count} 个不一致`);
    }

    process.exit(1);
}

auditPodConsistency();
