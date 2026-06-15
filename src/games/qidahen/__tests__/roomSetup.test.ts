import { describe, expect, it } from 'vitest';
import type { RandomFn } from '../../../engine/types';
import { QidahenDomain } from '../domain';
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

    it('显式局内剧本投票标记会让房间进入 match 后再决定剧本', () => {
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
    });

    it('domain.setup 在联机局内剧本投票模式下会先停在剧本介绍与投票态', () => {
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
