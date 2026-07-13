import { describe, expect, it } from 'vitest';
import type { RandomFn } from '../../../engine/types';
import { QidahenDomain } from '../domain';
import { QIDAHEN_ATLAS05_TTS_DECK_SEQUENCE_BY_FACTION } from '../domain/handCardState';
import { QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITIES } from '../domain/ordinaryHandCardIdentities';
import { engineConfig } from '../game';
import manifest from '../manifest';
import {
    applyQidahenPregameChoiceDefaults,
    buildQidahenPublicRoomSummary,
    DEFAULT_QIDAHEN_SCENARIO_ID,
    getQidahenAllowedPlayerCounts,
    getQidahenPlayableFactions,
    getQidahenScenarioIdsForPlayerCount,
    QIDAHEN_MAX_PLAYERS,
    QIDAHEN_IN_MATCH_SCENARIO_VOTE_FIELD,
    QIDAHEN_MIN_PLAYERS,
    QIDAHEN_PLAYER_OPTIONS,
    readQidahenScenarioChoiceSelections,
    readQidahenScenarioId,
    shouldUseQidahenInMatchScenarioVote,
    shouldResolveQidahenScenarioChoiceGroups,
} from '../roomSetup';

const testRandom: RandomFn = {
    random: () => 0.5,
    d: () => 4,
    range: (min) => min,
    shuffle: <T>(array: T[]) => [...array],
};

const getRuntimeRegion = (
    core: ReturnType<typeof QidahenDomain.setup>,
    name: string,
) => {
    const region = core.regions.find((candidate) => candidate.name === name && !candidate.isLogicalRegion);
    if (!region) {
        throw new Error(`缺少运行时区域：${name}`);
    }
    return region;
};

const expectRuntimeRegion = (
    core: ReturnType<typeof QidahenDomain.setup>,
    name: string,
    controller: string,
    troops: number,
    population: number,
) => {
    const region = getRuntimeRegion(core, name);
    expect(region).toMatchObject({ controller, troops, population });
    expect(region.specialTroops.reduce((sum, stack) => sum + stack.count, 0)).toBe(troops);
    const pieceIds = core.pieces
        .filter((piece) => piece.regionId === region.id && piece.location === 'field')
        .map((piece) => piece.id);
    const stackPieceIds = region.specialTroops.flatMap((stack) => stack.pieceIds ?? []);
    expect(stackPieceIds).toEqual(pieceIds);
    expect(new Set(pieceIds).size).toBe(pieceIds.length);
    return region;
};

describe('七大恨房间 setup 解析', () => {
    it('优先读取 setupSelections 中的剧本选择', () => {
        expect(readQidahenScenarioId({
            setupSelections: {
                scenario: 'shanhaiguan-1622',
            },
        })).toBe('shanhaiguan-1622');
    });

    it('兼容顶层 scenario 字段并回退默认剧本', () => {
        expect(readQidahenScenarioId({
            scenario: 'dingmao-rebellion-1627',
        })).toBe('dingmao-rebellion-1627');
        expect(readQidahenScenarioId({
            scenario: 'unknown-scenario',
        })).toBe(DEFAULT_QIDAHEN_SCENARIO_ID);
    });

    it('只有默认剧本会沿用旧的首项自动解析，显式切到其他剧本时保留待决项', () => {
        expect(shouldResolveQidahenScenarioChoiceGroups({
            scenario: 'post-sarhu-1619',
        })).toBe(true);
        expect(shouldResolveQidahenScenarioChoiceGroups({
            setupSelections: {
                scenario: 'shanhaiguan-1622',
            },
        })).toBe(false);
    });

    it('会按剧本返回允许人数与真实参战势力', () => {
        expect(getQidahenAllowedPlayerCounts('post-sarhu-1619')).toEqual([3]);
        expect(getQidahenAllowedPlayerCounts('dingmao-rebellion-1627')).toEqual([2]);
        expect(getQidahenScenarioIdsForPlayerCount(3)).toEqual(['post-sarhu-1619', 'shanhaiguan-1622']);
        expect(getQidahenScenarioIdsForPlayerCount(2)).toEqual(['dingmao-rebellion-1627']);
        expect(getQidahenPlayableFactions('shanhaiguan-1622')).toEqual(['ming', 'mongol', 'jin']);
        expect(getQidahenPlayableFactions('dingmao-rebellion-1627')).toEqual(['ming', 'jin']);
    });

    it('显式局内剧本选择标记会让房间进入 match 后再决定剧本', () => {
        expect(shouldUseQidahenInMatchScenarioVote({
            setupSelections: {
                [QIDAHEN_IN_MATCH_SCENARIO_VOTE_FIELD]: 'enabled',
            },
        })).toBe(true);
    });

    it('全局房间人数入口与 engine admission 会和剧本人数组合同步', () => {
        expect(QIDAHEN_PLAYER_OPTIONS).toEqual([2, 3]);
        expect(QIDAHEN_MIN_PLAYERS).toBe(2);
        expect(QIDAHEN_MAX_PLAYERS).toBe(3);
        expect(manifest.playerOptions).toEqual([2, 3]);
        expect(engineConfig.minPlayers).toBe(2);
        expect(engineConfig.maxPlayers).toBe(3);
        for (const scenarioId of ['post-sarhu-1619', 'shanhaiguan-1622', 'dingmao-rebellion-1627'] as const) {
            expect(getQidahenAllowedPlayerCounts(scenarioId).every((count) => QIDAHEN_PLAYER_OPTIONS.includes(count))).toBe(true);
        }
    });

    it('公开房间摘要只带出当前剧本，不泄露无关私有字段', () => {
        expect(buildQidahenPublicRoomSummary({
            roomName: '不应泄露',
            password: '1234',
            ownerKey: 'guest:owner',
            setupSelections: {
                scenario: 'shanhaiguan-1622',
            },
        })).toEqual({
            scenarioId: 'shanhaiguan-1622',
        });
        expect(buildQidahenPublicRoomSummary({
            setupSelections: {
                [QIDAHEN_IN_MATCH_SCENARIO_VOTE_FIELD]: 'enabled',
            },
        })).toEqual({});
    });

    it('切到非默认剧本时会补齐该剧本预选默认值，并清理其他剧本残留字段', () => {
        expect(applyQidahenPregameChoiceDefaults({
            scenario: 'shanhaiguan-1622',
            roomName: '保留原值',
            'shanhaiguan-1622:ming:character:0': 'invalid-character-id',
            'dingmao-rebellion-1627:jin:character:0': 'jin-huangtaiji',
        })).toEqual({
            scenario: 'shanhaiguan-1622',
            roomName: '保留原值',
            'shanhaiguan-1622:ming:character:0': 'ming-wang-huazhen',
            'shanhaiguan-1622:jin:character:0': 'jin-eidu',
            'shanhaiguan-1622:jin:character:1': 'jin-amin',
            'shanhaiguan-1622:ming:armament:0': 'cavalry-armor',
            'shanhaiguan-1622:ming:armament:1': 'cavalry-firearm',
        });
    });

    it('会从 setupData 解析七大恨房间预选的人物与军备选择', () => {
        expect(readQidahenScenarioChoiceSelections({
            scenario: 'shanhaiguan-1622',
            'shanhaiguan-1622:ming:character:0': 'ming-xiong-tingbi',
            'shanhaiguan-1622:jin:character:0': 'jin-fan-wencheng',
            'shanhaiguan-1622:jin:character:1': 'jin-manggultai',
            'shanhaiguan-1622:ming:armament:0': 'infantry-armor',
            'shanhaiguan-1622:ming:armament:1': 'long-barreled-musket',
        })).toEqual({
            characterChoiceSelections: {
                'shanhaiguan-1622:ming:character:0': ['ming-xiong-tingbi'],
                'shanhaiguan-1622:jin:character:0': ['jin-fan-wencheng'],
                'shanhaiguan-1622:jin:character:1': ['jin-manggultai'],
            },
            armamentChoiceSelections: {
                'shanhaiguan-1622:ming:armament:0': ['infantry-armor'],
                'shanhaiguan-1622:ming:armament:1': ['long-barreled-musket'],
            },
        });
    });

    it('domain.setup 会按 setupData 中的剧本初始化核心状态，并把非默认剧本的待决项留给 runtime 处理', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], testRandom, {
            setupSelections: {
                scenario: 'shanhaiguan-1622',
            },
        });

        expect(core.scenarioId).toBe('shanhaiguan-1622');
        expect(core.scenarioLabel).toBe('剧本二：山海关之议（1622）');
        expect(core.currentYearIndex).toBe(3);
        expect(core.currentYear).toBe('天命七年 1622');
        expect(core.pendingScenarioCharacterChoices).toHaveLength(3);
        expect(core.pendingScenarioArmamentChoices).toHaveLength(2);
        expect(core.factions.ming.characters.find((character) => character.id === 'ming-wang-huazhen')?.inPlay).toBe(false);
        expect(core.factions.jin.characters.find((character) => character.id === 'jin-eidu')?.inPlay).toBe(false);
        expect(core.factions.jin.characters.find((character) => character.id === 'jin-amin')?.inPlay).toBe(false);
        expect(core.factions.ming.armaments.find((armament) => armament.id === 'artillery-tech')?.level).toBe(1);
        expect(core.factions.ming.armaments.find((armament) => armament.id === 'cavalry-armor')?.level).toBe(0);
        expect(core.factions.ming.armaments.find((armament) => armament.id === 'cavalry-firearm')?.level).toBe(0);
        const datongRuntimeRegion = core.regions.find((region) => region.id === 'city-region-1');
        const datongStack = datongRuntimeRegion?.specialTroops.find((stack) => stack.id === 'ming-shanhaiguan-1622-datong-regular-infantry-lv2');
        const datongPieceIds = core.pieces
            .filter((piece) => piece.regionId === 'city-region-1' && piece.location === 'field')
            .map((piece) => piece.id);
        expect(datongStack?.pieceIds).toEqual(datongPieceIds);
        expect(new Set(datongPieceIds).size).toBe(datongPieceIds.length);
        expect(core.pieces.length).toBeGreaterThan(0);
        expect(core.pieces.filter((piece) => piece.regionId === 'city-region-1' && piece.location === 'field')).toHaveLength(2);
        expect(core.pieces.some((piece) => piece.sourceStackId.includes('shanhaiguan-1622-datong'))).toBe(true);
    });

    it('domain.setup 会按剧本一规则书起始设置补齐 1619 运行时区域', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], testRandom, {
            scenario: 'post-sarhu-1619',
        });

        const expectRegion = (name: string, controller: string, troops: number, population: number) => (
            expectRuntimeRegion(core, name, controller, troops, population)
        );

        expectRegion('辉发部', 'jin', 1, 1);
        expectRegion('哈达部', 'jin', 1, 1);
        expectRegion('叶赫部', 'mongol', 1, 2);
        expectRegion('扎鲁特部', 'mongol', 1, 1);
        expectRegion('克什克腾部', 'mongol', 1, 1);
        expectRegion('巴林部', 'mongol', 1, 1);
        expectRegion('内喀尔喀部', 'mongol', 1, 1);
        expectRegion('奈曼部', 'mongol', 1, 1);
        expectRegion('敖汉部', 'mongol', 1, 1);

        const liaobei = expectRegion('辽北', 'ming', 3, 3);
        expect(liaobei.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({ troopKind: 'cavalry', count: 2, level: 1 }),
            expect.objectContaining({ troopKind: 'artillery', count: 1, level: 1 }),
        ]));
        const liaodong = expectRegion('辽东', 'ming', 3, 3);
        expect(liaodong.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({ troopKind: 'artillery', count: 1, level: 1 }),
            expect.objectContaining({ troopKind: 'infantry', count: 2, level: 1 }),
        ]));

        expectRegion('顺天', 'ming', 3, 5);
        expectRegion('蓟镇', 'ming', 1, 2);
        for (const name of ['辽西', '东江', '宣府', '大同', '延绥', '登莱', '山西', '保定', '山东']) {
            expectRegion(name, 'ming', 1, 2);
        }

        for (const name of ['咸兴', '平壤', '汉城']) {
            expectRegion(name, 'ming', 1, 0);
        }
        expectRegion('乌喇部', 'neutral', 0, 2);
        expectRegion('喀喇沁部', 'neutral', 0, 2);
        expectRegion('科尔沁部', 'neutral', 0, 2);
        expectRegion('外喀尔喀部', 'neutral', 0, 2);
        expectRegion('土默特部', 'neutral', 0, 3);
        expectRegion('鄂尔多斯部', 'neutral', 0, 3);
    });

    it('domain.setup 会按剧本二规则书起始设置补齐 1622 运行时区域', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], testRandom, {
            scenario: 'shanhaiguan-1622',
        });
        const expectRegion = (name: string, controller: string, troops: number, population: number) => (
            expectRuntimeRegion(core, name, controller, troops, population)
        );

        expectRegion('建州', 'jin', 2, 2).specialTroops.forEach((stack) => {
            expect(stack).toMatchObject({ faction: 'jin', count: 2, level: 3 });
        });
        expectRegion('长白', 'jin', 2, 2);
        const liaobei = expectRegion('辽北', 'jin', 2, 3);
        expect(liaobei.specialTroops).toEqual([
            expect.objectContaining({ faction: 'jin', troopKind: 'infantry', count: 2, level: 4 }),
        ]);
        const liaodong = expectRegion('辽东', 'jin', 2, 3);
        expect(liaodong.specialTroops).toEqual([
            expect.objectContaining({ faction: 'jin', troopKind: 'infantry', count: 2, level: 4 }),
        ]);
        for (const name of ['叶赫部', '乌喇部']) {
            expectRegion(name, 'jin', 2, 2);
        }
        for (const name of ['辉发部', '哈达部']) {
            expectRegion(name, 'jin', 1, 1);
        }

        expectRegion('察哈尔', 'mongol', 3, 3).specialTroops.forEach((stack) => {
            expect(stack).toMatchObject({ faction: 'mongol', troopKind: 'cavalry', count: 3, level: 3 });
        });
        expectRegion('外喀尔喀部', 'mongol', 0, 3);
        expectRegion('喀喇沁部', 'mongol', 3, 2);
        expectRegion('鄂尔多斯部', 'mongol', 3, 4);
        for (const name of ['扎鲁特部', '克什克腾部']) {
            expectRegion(name, 'mongol', 1, 2);
        }
        for (const name of ['巴林部', '内喀尔喀部', '奈曼部', '敖汉部']) {
            expectRegion(name, 'mongol', 1, 1);
        }

        expectRegion('蓟镇', 'ming', 4, 4);
        expectRegion('顺天', 'ming', 0, 1);
        for (const name of ['东江', '宣府', '大同', '登莱', '延绥']) {
            expectRegion(name, 'ming', 2, 2);
        }
        for (const name of ['山西', '保定', '山东']) {
            expectRegion(name, 'ming', 0, 4);
        }
        expectRegion('辽西', 'ming', 0, 0);
        for (const name of ['咸兴', '平壤', '汉城']) {
            expectRegion(name, 'ming', 1, 0);
        }
        expectRegion('科尔沁部', 'neutral', 0, 2);
        expectRegion('土默特部', 'neutral', 0, 3);
    });

    it('domain.setup 会按丁卯胡乱规则书起始设置补齐 1627 运行时区域', () => {
        const core = QidahenDomain.setup(['0', '1'], testRandom, {
            scenario: 'dingmao-rebellion-1627',
        });
        const expectRegion = (name: string, controller: string, troops: number, population: number) => (
            expectRuntimeRegion(core, name, controller, troops, population)
        );

        const jianzhou = expectRegion('建州', 'jin', 2, 2);
        expect(jianzhou.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({ faction: 'jin', troopKind: 'infantry', count: 1, level: 4 }),
            expect.objectContaining({ faction: 'jin', count: 1, level: 3 }),
        ]));
        expectRegion('长白', 'jin', 1, 2);
        for (const name of ['叶赫部', '乌喇部']) {
            expectRegion(name, 'jin', 1, 1);
        }
        for (const name of ['辉发部', '哈达部']) {
            expectRegion(name, 'jin', 1, 1);
        }
        expectRegion('辽东', 'jin', 2, 2);
        expectRegion('辽北', 'jin', 2, 2);
        expectRegion('科尔沁部', 'jin', 2, 1);
        expectRegion('咸兴', 'jin', 1, 0);
        for (const name of ['敖汉部', '奈曼部', '内喀尔喀部']) {
            const region = expectRegion(name, 'jin', 1, 1);
            expect(region.specialTroops).toEqual([
                expect.objectContaining({ faction: 'mongol', troopKind: 'cavalry', count: 1, level: 1 }),
            ]);
        }

        expectRegion('顺天', 'ming', 0, 1);
        for (const name of ['蓟镇', '山东']) {
            const region = expectRegion(name, 'ming', 3, name === '山东' ? 5 : 4);
            expect(region.specialTroops).toEqual(expect.arrayContaining([
                expect.objectContaining({ faction: 'ming', count: 2, level: 3 }),
                expect.objectContaining({ faction: 'ming', troopKind: 'artillery', count: 1, level: 2 }),
            ]));
        }
        for (const name of ['宣府', '大同', '登莱', '延绥']) {
            expectRegion(name, 'ming', 1, 2);
        }
        for (const name of ['山西', '保定']) {
            expectRegion(name, 'ming', 0, 4);
        }
        for (const name of ['东江', '辽西']) {
            const region = expectRegion(name, 'ming', 3, 4);
            expect(region.specialTroops).toEqual(expect.arrayContaining([
                expect.objectContaining({ faction: 'ming', troopClass: 'auxiliary', count: 2, level: 2 }),
                expect.objectContaining({ faction: 'ming', troopKind: 'artillery', count: 1, level: 2 }),
            ]));
        }
        for (const name of ['平壤', '汉城']) {
            expectRegion(name, 'ming', 1, 0);
        }
        expectRegion('喀喇沁部', 'ming', 1, 1);
        expectRegion('鄂尔多斯部', 'ming', 1, 3);

        for (const name of ['扎鲁特部', '巴林部', '克什克腾部']) {
            expectRegion(name, 'neutral', 0, 1);
        }
        expectRegion('察哈尔', 'neutral', 0, 0);
        expectRegion('外喀尔喀部', 'neutral', 0, 0);
        expectRegion('土默特部', 'neutral', 0, 2);
    });

    it('domain.setup 会按剧本一规则书和 TTS 牌组顺序初始化人物、军备与手牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], testRandom, {
            scenario: 'post-sarhu-1619',
        });

        expect(core.pendingScenarioCharacterChoices).toHaveLength(0);
        expect(core.pendingScenarioArmamentChoices).toHaveLength(0);
        expect(core.factions.ming.handCount).toBe(3);
        expect(core.factions.mongol.handCount).toBe(6);
        expect(core.factions.jin.handCount).toBe(10);
        expect(core.factions.mongol.characters.filter((character) => character.inPlay).map((character) => character.name)).toEqual([
            '林丹·乎图克图',
        ]);
        expect(core.factions.jin.characters.filter((character) => character.inPlay).map((character) => character.name)).toEqual([
            '努尔哈赤',
            '额亦都',
        ]);
        expect(core.factions.jin.characters.find((character) => character.id === 'jin-fan-wencheng')?.inPlay).toBe(false);
        expect(core.factions.ming.armaments.find((armament) => armament.id === 'artillery-tech')?.level).toBe(1);
        expect(core.factions.mongol.armaments.find((armament) => armament.id === 'cavalry-armor')?.level).toBe(1);
        expect(core.factions.jin.armaments.find((armament) => armament.id === 'infantry-armor')?.level).toBe(1);

        const factionHandCards = (factionId: 'ming' | 'mongol' | 'jin') => (
            core.handCards.filter((card) => card.faction === factionId)
        );
        expect(factionHandCards('ming').filter((card) => card.status === 'payable')).toHaveLength(3);
        expect(factionHandCards('ming')).toHaveLength(4);
        expect(factionHandCards('mongol')).toHaveLength(6);
        expect(factionHandCards('jin')).toHaveLength(10);
        expect(factionHandCards('ming').map((card) => card.previewRef)).toEqual(
            QIDAHEN_ATLAS05_TTS_DECK_SEQUENCE_BY_FACTION.ming.slice(0, 4).map((index) => ({
                type: 'atlas',
                atlasId: 'qidahen:atlas05-ordinary-hand-preview',
                index,
            })),
        );
        expect(factionHandCards('mongol').map((card) => card.previewRef)).toEqual(
            QIDAHEN_ATLAS05_TTS_DECK_SEQUENCE_BY_FACTION.mongol.slice(0, 6).map((index) => ({
                type: 'atlas',
                atlasId: 'qidahen:atlas05-ordinary-hand-preview',
                index,
            })),
        );
        expect(factionHandCards('jin').map((card) => card.previewRef)).toEqual(
            QIDAHEN_ATLAS05_TTS_DECK_SEQUENCE_BY_FACTION.jin.slice(0, 10).map((index) => ({
                type: 'atlas',
                atlasId: 'qidahen:atlas05-ordinary-hand-preview',
                index,
            })),
        );
    });

    it('TTS 普通手牌牌堆顺序只引用已确认的 atlas05 普通手牌身份', () => {
        const confirmedAtlasIndices = new Set(
            QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITIES.map((identity) => identity.atlasIndex),
        );
        const fullTtsSequence = [
            ...QIDAHEN_ATLAS05_TTS_DECK_SEQUENCE_BY_FACTION.ming,
            ...QIDAHEN_ATLAS05_TTS_DECK_SEQUENCE_BY_FACTION.mongol,
            ...QIDAHEN_ATLAS05_TTS_DECK_SEQUENCE_BY_FACTION.jin,
        ];

        expect(QIDAHEN_ATLAS05_TTS_DECK_SEQUENCE_BY_FACTION.ming).toHaveLength(42);
        expect(QIDAHEN_ATLAS05_TTS_DECK_SEQUENCE_BY_FACTION.mongol).toHaveLength(22);
        expect(QIDAHEN_ATLAS05_TTS_DECK_SEQUENCE_BY_FACTION.jin).toHaveLength(20);
        expect(fullTtsSequence).toHaveLength(84);
        expect([...new Set(fullTtsSequence)].sort((left, right) => left - right)).toEqual(
            [...confirmedAtlasIndices].sort((left, right) => left - right),
        );
        for (const atlasIndex of fullTtsSequence) {
            expect(confirmedAtlasIndices.has(atlasIndex)).toBe(true);
        }
        expect(confirmedAtlasIndices).not.toContain(47);
    });

    it('TTS 其它牌堆只能作为资源和顺序参考，不回流成普通手牌规则来源', () => {
        const ttsAuxiliaryDeckSummaries = [
            { deckKey: 13, label: '后金/相关辅助牌堆', count: 14, uniqueIndices: [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50] },
            { deckKey: 15, label: '朝鲜特殊牌堆', count: 5, uniqueIndices: [0, 3, 5, 7, 8] },
            { deckKey: 17, label: '纪年牌堆', count: 24, uniqueIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 20, 30, 40, 50, 60] },
            { deckKey: 2, label: '剧本/参考牌堆', count: 9, uniqueIndices: [0, 1, 2, 3, 4, 5, 6, 7, 20] },
        ];
        const ordinaryDeckKeys = new Set([16]);

        for (const summary of ttsAuxiliaryDeckSummaries) {
            expect(ordinaryDeckKeys.has(summary.deckKey)).toBe(false);
            expect(summary.count).toBeGreaterThan(0);
            expect(summary.uniqueIndices).toEqual([...new Set(summary.uniqueIndices)].sort((left, right) => left - right));
            expect(summary.uniqueIndices.every((index) => index >= 0 && index < 70)).toBe(true);
        }
        expect(ttsAuxiliaryDeckSummaries.map((summary) => summary.deckKey)).toEqual([13, 15, 17, 2]);
    });

    it('domain.setup 在房间里已给全量预选时会直接应用到开局核心，并清空待决项', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], testRandom, {
            scenario: 'shanhaiguan-1622',
            'shanhaiguan-1622:ming:character:0': 'ming-xiong-tingbi',
            'shanhaiguan-1622:jin:character:0': 'jin-fan-wencheng',
            'shanhaiguan-1622:jin:character:1': 'jin-manggultai',
            'shanhaiguan-1622:ming:armament:0': 'infantry-armor',
            'shanhaiguan-1622:ming:armament:1': 'long-barreled-musket',
        });

        expect(core.pendingScenarioCharacterChoices).toHaveLength(0);
        expect(core.pendingScenarioArmamentChoices).toHaveLength(0);
        expect(core.factions.ming.characters.find((character) => character.id === 'ming-xiong-tingbi')?.inPlay).toBe(true);
        expect(core.factions.ming.characters.find((character) => character.id === 'ming-wang-huazhen')?.inPlay).toBe(false);
        expect(core.factions.jin.characters.find((character) => character.id === 'jin-fan-wencheng')?.inPlay).toBe(true);
        expect(core.factions.jin.characters.find((character) => character.id === 'jin-eidu')?.inPlay).toBe(false);
        expect(core.factions.jin.characters.find((character) => character.id === 'jin-manggultai')?.inPlay).toBe(true);
        expect(core.factions.jin.characters.find((character) => character.id === 'jin-amin')?.inPlay).toBe(false);
        expect(core.factions.ming.armaments.find((armament) => armament.id === 'artillery-tech')?.level).toBe(1);
        expect(core.factions.ming.armaments.find((armament) => armament.id === 'infantry-armor')?.level).toBe(1);
        expect(core.factions.ming.armaments.find((armament) => armament.id === 'cavalry-armor')?.level).toBe(0);
        expect(core.factions.ming.armaments.find((armament) => armament.id === 'long-barreled-musket')?.level).toBe(1);
        expect(core.factions.ming.armaments.find((armament) => armament.id === 'cavalry-firearm')?.level).toBe(0);
    });

    it('domain.setup 在丁卯胡乱下会收口到二人座位，并把蒙古留在中立占位', () => {
        const core = QidahenDomain.setup(['0', '1'], testRandom, {
            scenario: 'dingmao-rebellion-1627',
        });

        expect(core.playerIds).toEqual(['0', '1']);
        expect(core.currentFactionOrder).toEqual(['ming', 'jin']);
        expect(core.currentPlayer).toBe('0');
        expect(core.factions.ming.playerId).toBe('0');
        expect(core.factions.jin.playerId).toBe('1');
        expect(core.factions.mongol.playerId).toBe('qidahen-neutral-mongol');
        expect(core.pendingScenarioCharacterChoices).toHaveLength(2);
        expect(core.pendingScenarioArmamentChoices).toHaveLength(1);
        expect(core.factions.ming.handCount).toBe(5);
        expect(core.factions.mongol.handCount).toBe(0);
        expect(core.factions.jin.handCount).toBe(6);
        const mingInPlayCharacterNames = core.factions.ming.characters
            .filter((character) => character.inPlay)
            .map((character) => character.name);
        expect(mingInPlayCharacterNames).toHaveLength(3);
        expect(mingInPlayCharacterNames).toEqual(expect.arrayContaining([
            '毛文龙',
            '孙承宗',
            '魏忠贤',
        ]));
        expect(core.factions.ming.characters.find((character) => character.id === 'ming-xiong-tingbi')?.removedFromGame).toBe(true);
        expect(core.factions.jin.characters.find((character) => character.id === 'jin-nurhaci')?.removedFromGame).toBe(true);
        expect(core.factions.jin.characters.find((character) => character.id === 'jin-eidu')?.removedFromGame).toBe(true);
        expect(core.factions.ming.armaments.find((armament) => armament.id === 'artillery-tech')?.level).toBe(2);
        expect(core.factions.ming.armaments.find((armament) => armament.id === 'cavalry-firearm')?.level).toBe(0);
        expect(core.factions.ming.armaments.find((armament) => armament.id === 'long-barreled-musket')?.level).toBe(0);
        expect(core.factions.jin.armaments.find((armament) => armament.id === 'manzhou-banners')?.level).toBe(1);
        expect(core.factions.jin.armaments.find((armament) => armament.id === 'mongol-banners')?.level).toBe(1);
        expect(core.factions.jin.armaments.find((armament) => armament.id === 'han-banners')?.level).toBe(1);
        expect(core.factions.jin.armaments.find((armament) => armament.id === 'infantry-armor')?.level).toBe(2);
    });

    it('domain.setup 在联机局内剧本选择模式下会先停在剧本介绍与房主选择态', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], testRandom, {
            setupSelections: {
                [QIDAHEN_IN_MATCH_SCENARIO_VOTE_FIELD]: 'enabled',
            },
        });

        expect(core.scenarioVote?.options.map((option) => option.scenarioId)).toEqual(['post-sarhu-1619', 'shanhaiguan-1622']);
        expect(core.scenarioVote?.votes).toEqual({
            '0': null,
            '1': null,
            '2': null,
        });
        expect(core.pendingScenarioCharacterChoices).toEqual([]);
        expect(core.pendingScenarioArmamentChoices).toEqual([]);
    });
});
