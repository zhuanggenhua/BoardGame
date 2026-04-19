/**
 * 阵营配置与卡牌注册表 - 单元测试
 *
 * 覆盖：
 * - resolveFactionId：中文阵营名 → 阵营 ID 解析
 * - FACTION_NAME_TO_ID：映射完整性
 * - cardRegistry：卡牌池去重正确性（修复起始单位 ID 冲突）
 */

import { describe, it, expect } from 'vitest';
import {
    resolveFactionId,
    FACTION_NAME_TO_ID,
    FACTION_CATALOG,
    FACTION_IDS,
    createDeckByFactionId,
} from '../config/factions';
import {
    getCardPoolByFaction,
    buildCardRegistry,
    groupCardsByType,
} from '../config/cardRegistry';

// ============================================================================
// resolveFactionId
// ============================================================================

describe('resolveFactionId', () => {
    it('中文阵营名应解析为对应的阵营 ID', () => {
        expect(resolveFactionId('堕落王国')).toBe('necromancer');
        expect(resolveFactionId('欺心巫族')).toBe('trickster');
        expect(resolveFactionId('先锋军团')).toBe('paladin');
        expect(resolveFactionId('洞穴地精')).toBe('goblin');
        expect(resolveFactionId('极地矮人')).toBe('frost');
        expect(resolveFactionId('炽原精灵')).toBe('barbaric');
    });

    it('英文阵营 ID 应原样返回', () => {
        expect(resolveFactionId('necromancer')).toBe('necromancer');
        expect(resolveFactionId('trickster')).toBe('trickster');
        expect(resolveFactionId('paladin')).toBe('paladin');
        expect(resolveFactionId('goblin')).toBe('goblin');
        expect(resolveFactionId('frost')).toBe('frost');
        expect(resolveFactionId('barbaric')).toBe('barbaric');
    });

    it('未知字符串应原样返回（兜底）', () => {
        expect(resolveFactionId('unknown')).toBe('unknown');
    });
});

// ============================================================================
// FACTION_NAME_TO_ID 映射完整性
// ============================================================================

describe('FACTION_NAME_TO_ID', () => {
    it('应覆盖所有可选阵营', () => {
        const selectableFactions = FACTION_CATALOG.filter(f => f.selectable);
        const mappedIds = new Set(Object.values(FACTION_NAME_TO_ID));

        for (const faction of selectableFactions) {
            expect(mappedIds.has(faction.id)).toBe(true);
        }
    });

    it('映射值应与 FACTION_IDS 常量一致', () => {
        const idValues = new Set(Object.values(FACTION_IDS));
        for (const factionId of Object.values(FACTION_NAME_TO_ID)) {
            expect(idValues.has(factionId)).toBe(true);
        }
    });
});

// ============================================================================
// cardRegistry 卡牌池去重
// ============================================================================

describe('cardRegistry 卡牌池去重', () => {
    it('每个阵营的卡牌池不应有重复 ID', () => {
        const selectableFactions = FACTION_CATALOG.filter(f => f.selectable);

        for (const faction of selectableFactions) {
            const pool = getCardPoolByFaction(faction.id);
            const ids = pool.map(c => c.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
        }
    });

    it('卡牌池不应包含起始单位的 -start- 前缀 ID', () => {
        const selectableFactions = FACTION_CATALOG.filter(f => f.selectable);

        for (const faction of selectableFactions) {
            const pool = getCardPoolByFaction(faction.id);
            const startIds = pool.filter(c => c.id.includes('-start-'));
            expect(startIds.length).toBe(0);
        }
    });

    it('卡牌池不应包含副本后缀 ID（如 -0, -1）', () => {
        const selectableFactions = FACTION_CATALOG.filter(f => f.selectable);

        for (const faction of selectableFactions) {
            const pool = getCardPoolByFaction(faction.id);
            const suffixedIds = pool.filter(c => /-\d+$/.test(c.id));
            expect(suffixedIds.length).toBe(0);
        }
    });

    it('每个阵营的卡牌池应包含召唤师、冠军、普通、事件（建筑可选，gate 已由 autoCards 填充）', () => {
        const selectableFactions = FACTION_CATALOG.filter(f => f.selectable);

        for (const faction of selectableFactions) {
            const pool = getCardPoolByFaction(faction.id);
            const groups = groupCardsByType(pool);

            expect(groups.summoners.length).toBeGreaterThanOrEqual(1);
            expect(groups.champions.length).toBeGreaterThanOrEqual(1);
            expect(groups.commons.length).toBeGreaterThanOrEqual(1);
            expect(groups.events.length).toBeGreaterThanOrEqual(1);
            // 建筑不强制要求：gate 类建筑已由 autoCards 自动填充，不进入卡池
            // 只有拥有非 gate 建筑的阵营（如 frost 的护城墙）才会有 structures
        }
    });

    it('全局注册表中不应有重复 ID', () => {
        const registry = buildCardRegistry();
        // buildCardRegistry 返回 Map，key 就是 ID，天然去重
        // 但验证 pool 聚合后没有跨阵营 ID 冲突
        const allIds = new Set<string>();
        const selectableFactions = FACTION_CATALOG.filter(f => f.selectable);

        for (const faction of selectableFactions) {
            const pool = getCardPoolByFaction(faction.id);
            for (const card of pool) {
                // 同一 ID 不应出现在不同阵营（除非是共享卡）
                // 这里只验证 registry 的 size 与所有 pool 去重后一致
                allIds.add(card.id);
            }
        }

        expect(registry.size).toBe(allIds.size);
    });
});

// ============================================================================
// createDeckByFactionId 与 resolveFactionId 联动
// ============================================================================

describe('createDeckByFactionId 与 resolveFactionId 联动', () => {
    it('通过中文名解析后应返回正确阵营的牌组', () => {
        const necro = createDeckByFactionId(resolveFactionId('堕落王国'));
        expect(necro.summoner.id).toBe('necro-summoner');

        const trick = createDeckByFactionId(resolveFactionId('欺心巫族'));
        expect(trick.summoner.id).toBe('trickster-summoner');

        const paladin = createDeckByFactionId(resolveFactionId('先锋军团'));
        expect(paladin.summoner.id).toBe('paladin-summoner');
    });

    it('不同阵营的起始单位 ID 不应重叠', () => {
        const selectableFactions = FACTION_CATALOG.filter(f => f.selectable);
        const allStartingUnitIds: string[] = [];

        for (const faction of selectableFactions) {
            const deck = createDeckByFactionId(faction.id);
            for (const { unit } of deck.startingUnits) {
                allStartingUnitIds.push(unit.id);
            }
        }

        const unique = new Set(allStartingUnitIds);
        expect(unique.size).toBe(allStartingUnitIds.length);
    });
});
