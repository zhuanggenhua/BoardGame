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
import { summonerWarsCheatModifier } from '../game';
import type { Card, PlayerId, SummonerWarsCore } from '../domain/types';
import { getBaseCardId } from '../domain/ids';

const createEmptyBoard = () => Array.from({ length: 6 }, () => Array.from({ length: 8 }, () => ({})));

const createPlayerState = (id: PlayerId) => ({
    id,
    magic: 0,
    hand: [] as Card[],
    deck: [] as Card[],
    discard: [] as Card[],
    activeEvents: [],
    summonerId: `summoner-${id}`,
    moveCount: 0,
    attackCount: 0,
    hasAttackedEnemy: false,
});

const createCheatTestCore = (): SummonerWarsCore => ({
    board: createEmptyBoard(),
    players: {
        '0': createPlayerState('0'),
        '1': createPlayerState('1'),
    },
    phase: 'summon',
    currentPlayer: '0',
    startingPlayerId: '0',
    turnNumber: 1,
    selectedFactions: {
        '0': 'necromancer',
        '1': 'trickster',
    },
    readyPlayers: {
        '0': true,
        '1': true,
    },
    hostPlayerId: '0',
    hostStarted: true,
    abilityUsageCount: {},
});

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
        expect(resolveFactionId('莫古')).toBe('mogu');
        expect(resolveFactionId('灰烬')).toBe('huijin');
    });

    it('英文阵营 ID 应原样返回', () => {
        expect(resolveFactionId('necromancer')).toBe('necromancer');
        expect(resolveFactionId('trickster')).toBe('trickster');
        expect(resolveFactionId('paladin')).toBe('paladin');
        expect(resolveFactionId('goblin')).toBe('goblin');
        expect(resolveFactionId('frost')).toBe('frost');
        expect(resolveFactionId('barbaric')).toBe('barbaric');
        expect(resolveFactionId('mogu')).toBe('mogu');
        expect(resolveFactionId('huijin')).toBe('huijin');
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
// 卡面数值录入
// ============================================================================

describe('召唤师战争卡面数值录入', () => {
    it('洞穴地精召唤师思尼克斯的攻击力应录入为卡面右下角的 3 点战力', () => {
        const deck = createDeckByFactionId('goblin');

        expect(deck.summoner.name).toBe('思尼克斯');
        expect(deck.summoner.strength).toBe(3);
    });

    it('莫古应作为实施中新派系接入基础牌组与新格式图集', () => {
        const catalogEntry = FACTION_CATALOG.find(faction => faction.id === 'mogu');
        expect(catalogEntry?.statusTag).toBe('under_construction');

        const deck = createDeckByFactionId('mogu');
        expect(deck.summoner.name).toBe('库鞭克');
        expect(deck.summoner.spriteAtlas).toBe('hero');

        const cardsAtlasCard = deck.deck.find(card => card.spriteAtlas === 'cards' && card.spriteIndex === 10);
        expect(cardsAtlasCard?.name).toBe('菌袍疫病体');
    });

    it('灰烬应作为实施中新派系接入基础牌组与独立召唤师图集', () => {
        const catalogEntry = FACTION_CATALOG.find(faction => faction.id === 'huijin');
        expect(catalogEntry?.statusTag).toBe('under_construction');
        expect(catalogEntry?.heroImagePath).toBe('summonerwars/hero/huijin/hero');

        const deck = createDeckByFactionId('huijin');
        expect(deck.summoner.name).toBe('玛达莉雅女王');
        expect(deck.summoner.spriteAtlas).toBe('hero');
        expect(deck.startingUnits.map(({ unit }) => unit.name)).toEqual(['灰烬弓箭手', '皇家守卫']);

        const phoenixSoul = deck.deck.find(card => card.spriteAtlas === 'cards' && card.spriteIndex === 10);
        expect(phoenixSoul?.name).toBe('凤凰之魂');
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

describe('summonerWarsCheatModifier 调试发牌', () => {
    it('剩余牌库为空时仍可按稳定 cardId 直接补牌到手牌，并生成唯一实例 ID', () => {
        const elutBar = getCardPoolByFaction('necromancer').find((card) => card.id === 'necro-elut-bar');
        expect(elutBar).toBeTruthy();

        const core = createCheatTestCore();
        core.players['0'].hand = [
            { ...elutBar!, id: 'necro-elut-bar-0-1' },
        ];
        core.players['0'].discard = [
            { ...elutBar!, id: 'necro-elut-bar-0-0' },
        ];

        const result = summonerWarsCheatModifier.addCardToHandByCardId?.(core, '0', 'necro-elut-bar');
        expect(result).toBeTruthy();

        const updatedHand = result!.players['0'].hand;
        expect(updatedHand).toHaveLength(2);
        expect(updatedHand[1].id).toBe('necro-elut-bar-0-2');
        expect(getBaseCardId(updatedHand[1].id)).toBe('necro-elut-bar');
        expect(result!.players['0'].deck).toHaveLength(0);
    });

    it('atlas 索引冲突时，deck-only atlas helper 不会误把错误卡牌发到手牌', () => {
        const necromancerDeck = createDeckByFactionId('necromancer').deck;
        const funeralPyre = necromancerDeck.find((card) => getBaseCardId(card.id) === 'necro-funeral-pyre');
        const portal = necromancerDeck.find((card) => getBaseCardId(card.id) === 'necro-portal');
        expect(funeralPyre).toBeTruthy();
        expect(portal).toBeTruthy();
        expect(funeralPyre?.spriteIndex).toBe(portal?.spriteIndex);

        const core = createCheatTestCore();
        core.players['0'].deck = [
            { ...funeralPyre!, id: 'necro-funeral-pyre-0' },
            { ...portal!, id: 'necro-portal-0' },
        ];

        const result = summonerWarsCheatModifier.dealCardByAtlasIndex?.(core, '0', funeralPyre!.spriteIndex!);
        expect(result).toBe(core);
        expect(core.players['0'].hand).toHaveLength(0);
        expect(core.players['0'].deck).toHaveLength(2);
    });
});
