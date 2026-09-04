import { describe, expect, it } from 'vitest';import { QidahenDomain } from '../domain';

import { QIDAHEN_COMMANDS } from '../domain/commands';
import { getActionChoicesForFaction } from '../domain/factionActionWindow';
import { createInitialCore } from '../domain/initialCoreSetup';
import { getQidahenScenarioPreset } from '../domain/scenarioPresets';import type { QidahenCore } from '../domain/types';
import { random, stateOf, apply, factionHandCards } from './helpers/paymentSelectionHarness';

describe('七大恨剧本预设与人物冲突', () => {
it('剧本一预设会把固定人物、人物二择一与已开发军备结构化为正式场景目录', () => {
        const preset = getQidahenScenarioPreset('post-sarhu-1619');

        expect(preset.yearIndex).toBe(0);
        expect(preset.factionOrder).toEqual(['ming', 'mongol', 'jin']);
        expect(preset.factions.mongol.fixedCharacterIds).toEqual(['mongol-lindan-hutuktu']);
        expect(preset.factions.jin.characterChoiceGroups).toEqual([
            { count: 1, characterIds: ['jin-eidu', 'jin-fan-wencheng'] },
        ]);
        expect(preset.factions.ming.guaranteedArmamentLevels).toEqual({
            'artillery-tech': 1,
        });
    });

it('剧本二预设会保留人物与军备二择一，而不强行替规则猜最终落点', () => {
        const preset = getQidahenScenarioPreset('shanhaiguan-1622');

        expect(preset.yearIndex).toBe(3);
        expect(preset.factions.ming.handCount).toBe(2);
        expect(preset.factions.ming.fixedCharacterIds).toEqual(['ming-mao-wenlong']);
        expect(preset.factions.ming.characterChoiceGroups).toEqual([
            { count: 1, characterIds: ['ming-wang-huazhen', 'ming-xiong-tingbi'] },
        ]);
        expect(preset.factions.ming.guaranteedArmamentLevels).toEqual({
            'artillery-tech': 1,
        });
        expect(preset.factions.ming.armamentChoiceGroups).toEqual([
            { count: 1, armamentIds: ['cavalry-armor', 'infantry-armor', 'artillery-tech'] },
            { count: 1, armamentIds: ['cavalry-firearm', 'long-barreled-musket'] },
        ]);
        expect(preset.factions.mongol.guaranteedArmamentLevels).toEqual({
            'horse-breeding': 1,
            'cavalry-armor': 1,
        });
        expect(preset.factions.jin.characterChoiceGroups).toEqual([
            { count: 1, characterIds: ['jin-eidu', 'jin-fan-wencheng'] },
            { count: 1, characterIds: ['jin-amin', 'jin-manggultai'] },
        ]);
        expect(preset.factions.jin.guaranteedArmamentLevels).toEqual({
            'manzhou-banners': 1,
            'infantry-armor': 1,
        });
    });

it('丁卯胡乱预设会记录移出人物、后金三旗与大明火炮技术二级', () => {
        const preset = getQidahenScenarioPreset('dingmao-rebellion-1627');

        expect(preset.yearIndex).toBe(8);
        expect(preset.factionOrder).toEqual(['ming', 'jin']);
        expect(preset.factions.jin.characterChoiceGroups).toEqual([
            { count: 1, characterIds: ['jin-huangtaiji', 'jin-amin', 'jin-daisan'] },
            { count: 1, characterIds: ['jin-yanguli', 'jin-fan-wencheng'] },
        ]);
        expect(preset.factions.jin.guaranteedArmamentLevels).toEqual({
            'manzhou-banners': 1,
            'mongol-banners': 1,
            'han-banners': 1,
            'infantry-armor': 2,
        });
        expect(preset.factions.jin.removedCharacterIds).toEqual(['jin-nurhaci', 'jin-eidu']);
        expect(preset.factions.ming.guaranteedArmamentLevels).toEqual({
            'artillery-tech': 2,
        });
        expect(preset.factions.ming.armamentChoiceGroups).toEqual([
            { count: 1, armamentIds: ['cavalry-firearm', 'long-barreled-musket'] },
        ]);
        expect(preset.factions.ming.removedCharacterIds).toEqual(['ming-xiong-tingbi']);
    });

it('按剧本二预设生成的核心状态会消费固定项，但保留二择一人物未决', () => {
        const core = createInitialCore(['0', '1', '2'], 'shanhaiguan-1622', false);

        expect(core.scenarioId).toBe('shanhaiguan-1622');
        expect(core.scenarioLabel).toBe('剧本二：山海关之议（1622）');
        expect(core.currentYearIndex).toBe(3);
        expect(core.currentYear).toBe('天命七年 1622');
        expect(core.factions.ming.handCount).toBe(2);
        expect(core.factions.ming.characters.find((character) => character.id === 'ming-mao-wenlong')?.inPlay).toBe(true);
        expect(core.factions.ming.characters.find((character) => character.id === 'ming-wang-huazhen')?.inPlay).toBe(false);
        expect(core.factions.ming.characters.find((character) => character.id === 'ming-xiong-tingbi')?.inPlay).toBe(false);
        expect(core.factions.ming.armaments.find((armament) => armament.id === 'artillery-tech')?.level).toBe(1);
        expect(core.factions.mongol.armaments.find((armament) => armament.id === 'horse-breeding')?.level).toBe(1);
        expect(core.factions.jin.armaments.find((armament) => armament.id === 'manzhou-banners')?.level).toBe(1);
        expect(core.currentPlayer).toBe('0');
        expect(core.pendingScenarioCharacterChoices).toEqual([
            {
                id: 'shanhaiguan-1622:ming:character:0',
                factionId: 'ming',
                factionName: '大明',
                count: 1,
                characterIds: ['ming-wang-huazhen', 'ming-xiong-tingbi'],
                characterNames: ['王化贞', '熊廷弼'],
            },
            {
                id: 'shanhaiguan-1622:jin:character:0',
                factionId: 'jin',
                factionName: '后金',
                count: 1,
                characterIds: ['jin-eidu', 'jin-fan-wencheng'],
                characterNames: ['额亦都', '范文程'],
            },
            {
                id: 'shanhaiguan-1622:jin:character:1',
                factionId: 'jin',
                factionName: '后金',
                count: 1,
                characterIds: ['jin-amin', 'jin-manggultai'],
                characterNames: ['阿敏', '莽古尔泰'],
            },
        ]);
        expect(core.pendingScenarioArmamentChoices).toEqual([
            {
                id: 'shanhaiguan-1622:ming:armament:0',
                factionId: 'ming',
                factionName: '大明',
                count: 1,
                armamentIds: ['cavalry-armor', 'infantry-armor', 'artillery-tech'],
                armamentNames: ['骑兵铁甲', '步兵铁甲', '火炮技术'],
            },
            {
                id: 'shanhaiguan-1622:ming:armament:1',
                factionId: 'ming',
                factionName: '大明',
                count: 1,
                armamentIds: ['cavalry-firearm', 'long-barreled-musket'],
                armamentNames: ['骑兵火器', '长管火铳'],
            },
        ]);
    });

it('按丁卯胡乱预设生成的核心状态会处理移出人物与后金三旗固定军备，并收口到二人轮转', () => {
        const core = createInitialCore(['0', '1'], 'dingmao-rebellion-1627', false);

        expect(core.scenarioId).toBe('dingmao-rebellion-1627');
        expect(core.scenarioLabel).toBe('二人剧本：丁卯胡乱（1627）');
        expect(core.currentYearIndex).toBe(8);
        expect(core.currentYear).toBe('天聪元年 1627');
        expect(core.playerIds).toEqual(['0', '1']);
        expect(core.currentFactionOrder).toEqual(['ming', 'jin']);
        expect(core.currentPlayer).toBe('0');
        expect(core.factions.ming.handCount).toBe(5);
        expect(core.factions.jin.playerId).toBe('1');
        expect(core.factions.mongol.playerId).toBe('qidahen-neutral-mongol');
        expect(core.factions.ming.characters.find((character) => character.id === 'ming-wei-zhongxian')?.inPlay).toBe(true);
        expect(core.factions.ming.characters.find((character) => character.id === 'ming-sun-chengzong')?.inPlay).toBe(true);
        expect(core.factions.ming.characters.find((character) => character.id === 'ming-xiong-tingbi')).toMatchObject({
            inPlay: false,
            removedFromGame: true,
        });
        expect(core.factions.jin.characters.find((character) => character.id === 'jin-nurhaci')).toMatchObject({
            inPlay: false,
            removedFromGame: true,
        });
        expect(core.factions.jin.armaments.find((armament) => armament.id === 'manzhou-banners')?.level).toBe(1);
        expect(core.factions.jin.armaments.find((armament) => armament.id === 'mongol-banners')?.level).toBe(1);
        expect(core.factions.jin.armaments.find((armament) => armament.id === 'han-banners')?.level).toBe(1);
        expect(core.factions.jin.armaments.find((armament) => armament.id === 'infantry-armor')?.level).toBe(2);
        expect(core.pendingScenarioCharacterChoices).toEqual([
            {
                id: 'dingmao-rebellion-1627:jin:character:0',
                factionId: 'jin',
                factionName: '后金',
                count: 1,
                characterIds: ['jin-huangtaiji', 'jin-amin', 'jin-daisan'],
                characterNames: ['皇太极', '阿敏', '代善'],
            },
            {
                id: 'dingmao-rebellion-1627:jin:character:1',
                factionId: 'jin',
                factionName: '后金',
                count: 1,
                characterIds: ['jin-yanguli', 'jin-fan-wencheng'],
                characterNames: ['扬古利', '范文程'],
            },
        ]);
        expect(core.pendingScenarioArmamentChoices).toEqual([
            {
                id: 'dingmao-rebellion-1627:ming:armament:0',
                factionId: 'ming',
                factionName: '大明',
                count: 1,
                armamentIds: ['cavalry-firearm', 'long-barreled-musket'],
                armamentNames: ['骑兵火器', '长管火铳'],
            },
        ]);
    });

it('剧本二开局会把关键本土与控制区兵力切到山海关之议起始状态，而不再沿用剧本一样板', () => {
        const core = createInitialCore(['0', '1', '2'], 'shanhaiguan-1622', false);

        expect(core.regions.find((region) => region.id === 'city-region-13')).toMatchObject({
            controller: 'jin',
            troops: 2,
            population: 2,
            specialTroops: [
                expect.objectContaining({ faction: 'jin', troopKind: 'infantry', count: 2, level: 3 }),
            ],
        });
        expect(core.regions.find((region) => region.id === 'city-region-15')).toMatchObject({
            controller: 'jin',
            troops: 2,
            population: 3,
            specialTroops: [
                expect.objectContaining({ faction: 'jin', troopKind: 'infantry', count: 2, level: 4 }),
            ],
        });
        expect(core.regions.find((region) => region.id === 'city-region-15-liaodong')).toMatchObject({
            controller: 'jin',
            troops: 2,
            population: 3,
            specialTroops: [
                expect.objectContaining({ faction: 'jin', troopKind: 'infantry', count: 2, level: 4 }),
            ],
        });
        const liaodongPieceIds = core.regions.find((region) => region.id === 'city-region-15')
            ?.specialTroops.flatMap((stack) => stack.pieceIds ?? []) ?? [];
        expect(
            core.pieces
                .filter((piece) => piece.regionId === 'city-region-15' && piece.location === 'field')
                .map((piece) => piece.id)
                .sort(),
        ).toEqual(liaodongPieceIds.slice().sort());
        expect(core.regions.find((region) => region.id === 'city-region-19')).toMatchObject({
            controller: 'mongol',
            troops: 1,
            population: 1,
            specialTroops: [
                expect.objectContaining({ faction: 'mongol', troopKind: 'cavalry', count: 1, level: 2, label: '雇佣骑兵' }),
            ],
        });
        expect(core.regions.find((region) => region.id === 'city-region-19-liaoxi')).toMatchObject({
            controller: 'ming',
            troops: 0,
            population: 0,
            specialTroops: [],
        });
        expect(core.regions.find((region) => region.id === 'city-region-28-jizhen')).toMatchObject({
            controller: 'ming',
            troops: 4,
            population: 4,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({ faction: 'ming', troopKind: 'infantry', count: 3, level: 3 }),
                expect.objectContaining({ faction: 'ming', troopKind: 'artillery', count: 1, level: 2 }),
            ]),
        });
        expect(core.regions.find((region) => region.id === 'city-region-28')).toMatchObject({
            controller: 'ming',
            troops: 0,
            population: 1,
            specialTroops: [],
        });
        expect(core.regions.find((region) => region.id === 'city-region-26')).toMatchObject({
            controller: 'mongol',
            troops: 3,
            population: 4,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({ faction: 'mongol', troopKind: 'cavalry', count: 2, level: 3 }),
                expect.objectContaining({ faction: 'mongol', troopKind: 'cavalry', count: 1, level: 3, label: '雇佣骑兵' }),
            ]),
        });
    });

it('丁卯胡乱开局会把关键前线与中立区切到 1627 起始状态，而不再沿用三人剧本布局', () => {
        const core = createInitialCore(['0', '1'], 'dingmao-rebellion-1627', false);

        expect(core.regions.find((region) => region.id === 'city-region-13')).toMatchObject({
            controller: 'jin',
            troops: 2,
            population: 2,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({ faction: 'jin', troopKind: 'infantry', count: 1, level: 4 }),
                expect.objectContaining({ faction: 'jin', troopKind: 'infantry', count: 1, level: 3 }),
            ]),
        });
        expect(core.regions.find((region) => region.id === 'city-region-15')).toMatchObject({
            controller: 'jin',
            troops: 2,
            population: 2,
            specialTroops: [
                expect.objectContaining({ faction: 'jin', troopKind: 'infantry', count: 2, level: 3 }),
            ],
        });
        expect(core.regions.find((region) => region.id === 'city-region-15-liaodong')).toMatchObject({
            controller: 'jin',
            troops: 2,
            population: 2,
            specialTroops: [
                expect.objectContaining({ faction: 'jin', troopKind: 'infantry', count: 2, level: 3 }),
            ],
        });
        expect(core.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            controller: 'neutral',
            troops: 0,
            population: 0,
            specialTroops: [],
        });
        expect(core.regions.find((region) => region.id === 'city-region-19')).toMatchObject({
            controller: 'jin',
            troops: 1,
            population: 1,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({ faction: 'mongol', troopKind: 'cavalry', count: 1, level: 1 }),
            ]),
        });
        expect(core.regions.find((region) => region.id === 'city-region-19-liaoxi')).toMatchObject({
            controller: 'ming',
            troops: 3,
            population: 4,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({ faction: 'ming', troopKind: 'infantry', count: 2, level: 2, label: '雇佣军' }),
                expect.objectContaining({ faction: 'ming', troopKind: 'artillery', count: 1, level: 2 }),
            ]),
        });
        expect(core.regions.find((region) => region.id === 'city-region-22')).toMatchObject({
            controller: 'ming',
            troops: 3,
            population: 4,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({ faction: 'ming', troopKind: 'infantry', count: 2, level: 2, label: '雇佣军' }),
                expect.objectContaining({ faction: 'ming', troopKind: 'artillery', count: 1, level: 2 }),
            ]),
        });
        expect(core.regions.find((region) => region.id === 'city-region-26')).toMatchObject({
            controller: 'ming',
            troops: 1,
            population: 3,
            specialTroops: [
                expect.objectContaining({ faction: 'mongol', troopKind: 'cavalry', count: 1, level: 2 }),
            ],
        });
    });

it('剧本二全量显式选择后会应用人物与军备并清空对应待决项', () => {
        const core = createInitialCore(['0', '1', '2'], 'shanhaiguan-1622', false, {
            characterChoiceSelections: {
                'shanhaiguan-1622:ming:character:0': ['ming-xiong-tingbi'],
                'shanhaiguan-1622:jin:character:0': ['jin-fan-wencheng'],
                'shanhaiguan-1622:jin:character:1': ['jin-amin'],
            },
            armamentChoiceSelections: {
                'shanhaiguan-1622:ming:armament:0': ['infantry-armor'],
                'shanhaiguan-1622:ming:armament:1': ['cavalry-firearm'],
            },
        });

        expect(core.factions.ming.characters.find((character) => character.id === 'ming-xiong-tingbi')?.inPlay).toBe(true);
        expect(core.factions.ming.characters.find((character) => character.id === 'ming-wang-huazhen')?.inPlay).toBe(false);
        expect(core.factions.jin.characters.find((character) => character.id === 'jin-fan-wencheng')?.inPlay).toBe(true);
        expect(core.factions.jin.characters.find((character) => character.id === 'jin-eidu')?.inPlay).toBe(false);
        expect(core.factions.jin.characters.find((character) => character.id === 'jin-amin')?.inPlay).toBe(true);
        expect(core.factions.jin.characters.find((character) => character.id === 'jin-manggultai')?.inPlay).toBe(false);
        expect(core.factions.ming.armaments.find((armament) => armament.id === 'artillery-tech')?.level).toBe(1);
        expect(core.factions.ming.armaments.find((armament) => armament.id === 'infantry-armor')?.level).toBe(1);
        expect(core.factions.ming.armaments.find((armament) => armament.id === 'cavalry-firearm')?.level).toBe(1);
        expect(core.pendingScenarioCharacterChoices).toEqual([]);
        expect(core.pendingScenarioArmamentChoices).toEqual([]);
    });

it('剧本二部分显式选择后只会收口已给定 group，其余待决项继续保留', () => {
        const core = createInitialCore(['0', '1', '2'], 'shanhaiguan-1622', false, {
            characterChoiceSelections: {
                'shanhaiguan-1622:ming:character:0': ['ming-wang-huazhen'],
            },
            armamentChoiceSelections: {
                'shanhaiguan-1622:ming:armament:0': ['cavalry-armor'],
            },
        });

        expect(core.factions.ming.characters.find((character) => character.id === 'ming-wang-huazhen')?.inPlay).toBe(true);
        expect(core.factions.ming.characters.find((character) => character.id === 'ming-xiong-tingbi')?.inPlay).toBe(false);
        expect(core.factions.ming.armaments.find((armament) => armament.id === 'cavalry-armor')?.level).toBe(1);
        expect(core.pendingScenarioCharacterChoices).toEqual([
            {
                id: 'shanhaiguan-1622:jin:character:0',
                factionId: 'jin',
                factionName: '后金',
                count: 1,
                characterIds: ['jin-eidu', 'jin-fan-wencheng'],
                characterNames: ['额亦都', '范文程'],
            },
            {
                id: 'shanhaiguan-1622:jin:character:1',
                factionId: 'jin',
                factionName: '后金',
                count: 1,
                characterIds: ['jin-amin', 'jin-manggultai'],
                characterNames: ['阿敏', '莽古尔泰'],
            },
        ]);
        expect(core.pendingScenarioArmamentChoices).toEqual([
            {
                id: 'shanhaiguan-1622:ming:armament:1',
                factionId: 'ming',
                factionName: '大明',
                count: 1,
                armamentIds: ['cavalry-firearm', 'long-barreled-musket'],
                armamentNames: ['骑兵火器', '长管火铳'],
            },
        ]);
    });

it('剧本待决项未清空前会阻断轮盘与势力行动，直到正式命令确认完成', () => {
        let core = createInitialCore(['0', '1', '2'], 'shanhaiguan-1622', false);

        expect(QidahenDomain.validate(stateOf(core), {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'raid' },
        })).toEqual({ valid: false, error: 'pendingScenarioChoices' });
        expect(QidahenDomain.validate(stateOf(core), {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        })).toEqual({ valid: false, error: 'pendingScenarioChoices' });

        core = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_SCENARIO_CHARACTER_CHOICE,
            playerId: '0',
            payload: {
                groupId: 'shanhaiguan-1622:ming:character:0',
                characterIds: ['ming-xiong-tingbi'],
            },
        });
        core = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_SCENARIO_CHARACTER_CHOICE,
            playerId: '2',
            payload: {
                groupId: 'shanhaiguan-1622:jin:character:0',
                characterIds: ['jin-fan-wencheng'],
            },
        });
        core = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_SCENARIO_CHARACTER_CHOICE,
            playerId: '2',
            payload: {
                groupId: 'shanhaiguan-1622:jin:character:1',
                characterIds: ['jin-amin'],
            },
        });
        core = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_SCENARIO_ARMAMENT_CHOICE,
            playerId: '0',
            payload: {
                groupId: 'shanhaiguan-1622:ming:armament:0',
                armamentIds: ['infantry-armor'],
            },
        });

        expect(QidahenDomain.validate(stateOf(core), {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'raid' },
        })).toEqual({ valid: false, error: 'pendingScenarioChoices' });

        core = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_SCENARIO_ARMAMENT_CHOICE,
            playerId: '0',
            payload: {
                groupId: 'shanhaiguan-1622:ming:armament:1',
                armamentIds: ['cavalry-firearm'],
            },
        });

        expect(core.pendingScenarioCharacterChoices).toEqual([]);
        expect(core.pendingScenarioArmamentChoices).toEqual([]);
        expect(QidahenDomain.validate(stateOf(core), {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'raid' },
        })).toEqual({ valid: true });
    });

it('剧本待决项正式命令会真实写入人物与军备，而不是只改本地摘要', () => {
        let core = createInitialCore(['0', '1'], 'dingmao-rebellion-1627', false);

        core = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_SCENARIO_CHARACTER_CHOICE,
            playerId: '1',
            payload: {
                groupId: 'dingmao-rebellion-1627:jin:character:0',
                characterIds: ['jin-daisan'],
            },
        });
        core = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_SCENARIO_CHARACTER_CHOICE,
            playerId: '1',
            payload: {
                groupId: 'dingmao-rebellion-1627:jin:character:1',
                characterIds: ['jin-fan-wencheng'],
            },
        });
        core = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_SCENARIO_ARMAMENT_CHOICE,
            playerId: '0',
            payload: {
                groupId: 'dingmao-rebellion-1627:ming:armament:0',
                armamentIds: ['cavalry-firearm'],
            },
        });

        expect(core.factions.jin.characters.find((character) => character.id === 'jin-daisan')).toMatchObject({
            inPlay: true,
            removedFromGame: false,
        });
        expect(core.factions.jin.characters.find((character) => character.id === 'jin-fan-wencheng')).toMatchObject({
            inPlay: true,
            removedFromGame: false,
        });
        expect(core.factions.ming.armaments.find((armament) => armament.id === 'cavalry-firearm')?.level).toBe(1);
        expect(core.pendingScenarioCharacterChoices).toEqual([]);
        expect(core.pendingScenarioArmamentChoices).toEqual([]);
    });

it('丁卯胡乱在清空待决项后只会在大明与后金之间轮转，不再轮到蒙古', () => {
        const core = createInitialCore(['0', '1'], 'dingmao-rebellion-1627', false, {
            characterChoiceSelections: {
                'dingmao-rebellion-1627:jin:character:0': ['jin-daisan'],
                'dingmao-rebellion-1627:jin:character:1': ['jin-fan-wencheng'],
            },
            armamentChoiceSelections: {
                'dingmao-rebellion-1627:ming:armament:0': ['cavalry-firearm'],
            },
        });

        const afterMingAction = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        });
        const afterMingResolve = apply(afterMingAction, {
            type: QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE,
            playerId: '0',
            payload: { choiceId: 'level-2-troops' },
        });
        const afterMingWheel = apply(afterMingResolve, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        expect(afterMingWheel.currentFactionOrder).toEqual(['ming', 'jin']);
        expect(afterMingWheel.currentPlayer).toBe('1');
        expect(getActionChoicesForFaction('jin').map((action) => action.label)).toEqual([
            '突袭作战',
            '联姻诱降',
        ]);

        const afterJinAction = apply(afterMingWheel, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'raid' },
        });
        const afterJinWheel = apply(afterJinAction, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '1',
            payload: { moveId: 'move-1-free' },
        });

        expect(afterJinWheel.currentPlayer).toBe('0');
        expect(afterJinWheel.currentFactionOrder).toEqual(['ming', 'jin']);
        expect(afterJinWheel.turnLabel).toContain('大明');
    });

it('只有未开发军备时不会被 level 0 行误放开升级军备', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const blockedCore: QidahenCore = {
            ...core,
            factions: {
                ...core.factions,
                ming: {
                    ...core.factions.ming,
                    armaments: core.factions.ming.armaments.map((armament) => (
                        armament.id === 'artillery-tech'
                            ? { ...armament, level: 2 }
                            : armament
                    )),
                },
            },
        };

        const validation = QidahenDomain.validate(stateOf(blockedCore), {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'upgrade-armament' },
        });

        expect(validation).toEqual({ valid: false, error: 'unknownAction' });
    });

it('升级军备在已识别军备牌目标时会优先升级对应军备行', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [armamentCard, paymentCard] = factionHandCards(core, 'ming');
        const targetedCore: QidahenCore = {
            ...core,
            selectedActionId: 'upgrade-armament',
            confirmedActionId: 'upgrade-armament',
            selectedPaymentCardIds: [armamentCard.id, paymentCard.id],
            payment: {
                required: 2,
                selected: 2,
                prompt: '需弃 2 / 已选 2',
            },
            handCards: core.handCards.map((card) => {
                if (card.id === armamentCard.id) {
                    return {
                        ...card,
                        cardKind: 'armament' as const,
                        armamentId: 'cavalry-firearm' as const,
                        cardDefId: 'test-ming-cavalry-firearm',
                    };
                }
                if (card.id === paymentCard.id) {
                    return {
                        ...card,
                        cardKind: 'silver' as const,
                        cardDefId: 'test-ming-silver',
                    };
                }
                return card;
            }),
            factions: {
                ...core.factions,
                ming: {
                    ...core.factions.ming,
                    armaments: core.factions.ming.armaments.map((armament) => (
                        armament.id === 'cavalry-firearm'
                            ? { ...armament, level: 1 }
                            : armament
                    )),
                },
            },
        };

        const next = apply(targetedCore, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(next.factions.ming.armaments.find((armament) => armament.id === 'artillery-tech')?.level).toBe(1);
        expect(next.factions.ming.armaments.find((armament) => armament.id === 'cavalry-firearm')?.level).toBe(2);
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('大明将骑兵火器升级到2级');
    });

it('孙元化科技选牌会记录军备目标，并在确认后升级对应军备行', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [armamentCard, paymentCard] = factionHandCards(core, 'ming');
        const selectionCore: QidahenCore = {
            ...core,
            turnPhase: 'sun-yuanhua-tech-choice',
            handCards: core.handCards.map((card) => {
                if (card.id === armamentCard.id) {
                    return {
                        ...card,
                        cardKind: 'armament' as const,
                        armamentId: 'western-bastion' as const,
                        cardDefId: 'test-ming-western-bastion',
                    };
                }
                if (card.id === paymentCard.id) {
                    return {
                        ...card,
                        cardKind: 'silver' as const,
                        cardDefId: 'test-ming-silver',
                    };
                }
                return card;
            }),
            factions: {
                ...core.factions,
                ming: {
                    ...core.factions.ming,
                    armaments: core.factions.ming.armaments.map((armament) => (
                        armament.id === 'western-bastion'
                            ? { ...armament, level: 1 }
                            : armament
                    )),
                },
            },
            sunYuanhuaTechSelection: {
                source: 'sun-yuanhua',
                title: '孙元化弃牌科技',
                summary: '测试',
                requiredCardCount: 2,
                candidateCardIds: [armamentCard.id, paymentCard.id],
                selectedCardIds: [],
                armamentId: null,
            },
        };

        const pickedArmament = apply(selectionCore, {
            type: QIDAHEN_COMMANDS.SELECT_SUN_YUANHUA_TECH_CARD,
            playerId: '0',
            payload: { cardId: armamentCard.id },
        });
        const pickedBoth = apply(pickedArmament, {
            type: QIDAHEN_COMMANDS.SELECT_SUN_YUANHUA_TECH_CARD,
            playerId: '0',
            payload: { cardId: paymentCard.id },
        });

        expect(pickedBoth.sunYuanhuaTechSelection?.armamentId).toBe('western-bastion');

        const resolved = apply(pickedBoth, {
            type: QIDAHEN_COMMANDS.RESOLVE_SUN_YUANHUA_TECH,
            playerId: '0',
            payload: { choiceId: 'confirm' },
        });

        expect(resolved.factions.ming.armaments.find((armament) => armament.id === 'artillery-tech')?.level).toBe(1);
        expect(resolved.factions.ming.armaments.find((armament) => armament.id === 'western-bastion')?.level).toBe(2);
        expect(resolved.lastSeasonSummary?.lines.join(' | ')).toContain('西式棱堡 升至 2 级');
    });

it('皇太极在场时后金第一次手牌行动后仍可再执行一次不同的手牌行动', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.selectedRegionId = 'city-region-19-liaoxi';
        core.actionChoices = getActionChoicesForFaction('jin');
        core.selectedActionId = 'marriage-subjugation';
        core.factions.jin.characters = core.factions.jin.characters.map((character) => ({
            ...character,
            inPlay: character.id === 'jin-huangtaiji' || character.id === 'jin-nurhaci' || character.id === 'jin-eidu',
        }));
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-19-liaoxi') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                };
            }
            if (region.id === 'city-region-19') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                };
            }
            return region;
        });

        const firstAction = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'marriage-subjugation' },
        });
        const afterFirstResolution = apply(firstAction, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: {},
        });

        expect(afterFirstResolution.currentPlayer).toBe('2');
        expect(afterFirstResolution.factionActionUsed).toBe(true);
        expect(afterFirstResolution.bonusFactionActionAvailable).toBe(true);
        expect(afterFirstResolution.bonusFactionActionUsed).toBe(false);
        expect(afterFirstResolution.lastFactionActionId).toBe('marriage-subjugation');
        expect(afterFirstResolution.turnPhase).toBe('action-window');
        expect(afterFirstResolution.selectedRegionId).toBe('city-region-19-liaoxi');
        expect(afterFirstResolution.selectedActionId).not.toBe('marriage-subjugation');

        const sameActionValidation = QidahenDomain.validate(stateOf(afterFirstResolution), {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'marriage-subjugation' },
        });
        const secondActionValidation = QidahenDomain.validate(stateOf(afterFirstResolution), {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'raid' },
        });

        expect(sameActionValidation).toEqual({ valid: false, error: 'sameActionConsecutivelyNotAllowed' });
        expect(secondActionValidation).toEqual({ valid: true });

        const secondAction = apply(afterFirstResolution, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'raid' },
        });

        expect(secondAction.pendingTargetAction).toBeNull();
        expect(secondAction.lastFactionActionId).toBe('raid');
        expect(secondAction.bonusFactionActionUsed).toBe(true);
        expect(secondAction.currentPlayer).toBe('2');
    });

it('皇太极的额外手牌行动完成后，轮盘未用时仍留在本家；轮盘完成后再换人', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.selectedRegionId = 'city-region-19-liaoxi';
        core.actionChoices = getActionChoicesForFaction('jin');
        core.selectedActionId = 'marriage-subjugation';
        core.factions.jin.characters = core.factions.jin.characters.map((character) => ({
            ...character,
            inPlay: character.id === 'jin-huangtaiji' || character.id === 'jin-nurhaci' || character.id === 'jin-eidu',
        }));
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-19-liaoxi') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                };
            }
            if (region.id === 'city-region-19') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                };
            }
            return region;
        });

        const afterFirstAction = apply(apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'marriage-subjugation' },
        }), {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: {},
        });
        const afterSecondAction = apply(afterFirstAction, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'raid' },
        });

        expect(afterSecondAction.currentPlayer).toBe('2');
        expect(afterSecondAction.factionActionUsed).toBe(true);
        expect(afterSecondAction.bonusFactionActionUsed).toBe(true);
        expect(afterSecondAction.wheelActionUsed).toBe(false);

        const next = apply(afterSecondAction, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '2',
            payload: { moveId: 'move-1-free' },
        });

        expect(next.currentPlayer).toBe('0');
        expect(next.factionActionUsed).toBe(false);
        expect(next.bonusFactionActionAvailable).toBe(false);
        expect(next.bonusFactionActionUsed).toBe(false);
        expect(next.lastFactionActionId).toBeNull();
    });

it('皇太极与其他后金贝勒同场时会在新的后金行动窗口前被拣弃并移出游戏', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.actionChoices = getActionChoicesForFaction('jin');
        core.selectedActionId = 'marriage-subjugation';
        core.factions.jin.characters = core.factions.jin.characters.map((character) => ({
            ...character,
            inPlay: character.id === 'jin-huangtaiji' || character.id === 'jin-daisan',
        }));

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '2',
            payload: { regionId: 'city-region-19' },
        });

        const huangtaiji = next.factions.jin.characters.find((character) => character.id === 'jin-huangtaiji');
        const daisan = next.factions.jin.characters.find((character) => character.id === 'jin-daisan');

        expect(next.turnPhase).toBe('action-window');
        expect(next.selectedRegionId).toBe('city-region-19');
        expect(huangtaiji).toMatchObject({
            inPlay: false,
            removedFromGame: true,
            defeatMarkers: 0,
        });
        expect(daisan?.inPlay).toBe(true);
        expect(next.actionLog[0]?.text).toContain('皇太极与其他后金贝勒同场');
    });

it('代善与其他后金贝勒同场时会在新的后金行动窗口前被拣弃并回到后金人物牌堆', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.actionChoices = getActionChoicesForFaction('jin');
        core.selectedActionId = 'marriage-subjugation';
        core.factions.jin.characters = core.factions.jin.characters.map((character) => ({
            ...character,
            inPlay: character.id === 'jin-daisan' || character.id === 'jin-amin',
        }));

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '2',
            payload: { regionId: 'city-region-19' },
        });

        expect(next.turnPhase).toBe('action-window');
        expect(next.selectedRegionId).toBe('city-region-19');
        expect(next.factions.jin.characters.find((character) => character.id === 'jin-daisan')).toMatchObject({
            inPlay: false,
            removedFromGame: false,
            defeatMarkers: 0,
        });
        expect(next.factions.jin.characters.find((character) => character.id === 'jin-amin')).toMatchObject({
            inPlay: true,
        });
        expect(next.actionLog[0]?.text).toContain('代善与其他后金贝勒同场');
    });

it('努尔哈赤在场时会允许后金贝勒共存，不会触发皇太极冲突移除', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.actionChoices = getActionChoicesForFaction('jin');
        core.selectedActionId = 'marriage-subjugation';
        core.factions.jin.characters = core.factions.jin.characters.map((character) => ({
            ...character,
            inPlay: character.id === 'jin-nurhaci' || character.id === 'jin-huangtaiji' || character.id === 'jin-daisan',
        }));

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '2',
            payload: { regionId: 'city-region-19' },
        });

        expect(next.turnPhase).toBe('action-window');
        expect(next.selectedRegionId).toBe('city-region-19');
        expect(next.factions.jin.characters.find((character) => character.id === 'jin-nurhaci')).toMatchObject({ inPlay: true });
        expect(next.factions.jin.characters.find((character) => character.id === 'jin-huangtaiji')).toMatchObject({
            inPlay: true,
            removedFromGame: false,
        });
        expect(next.factions.jin.characters.find((character) => character.id === 'jin-daisan')).toMatchObject({ inPlay: true });
        expect(next.actionLog[0]?.text).not.toContain('皇太极与其他后金贝勒同场');
    });

it('努尔哈赤在场时会允许代善与其他后金贝勒共存，不会触发代善冲突回牌堆', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.actionChoices = getActionChoicesForFaction('jin');
        core.selectedActionId = 'marriage-subjugation';
        core.factions.jin.characters = core.factions.jin.characters.map((character) => ({
            ...character,
            inPlay: character.id === 'jin-nurhaci' || character.id === 'jin-daisan' || character.id === 'jin-amin',
        }));

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '2',
            payload: { regionId: 'city-region-19' },
        });

        expect(next.turnPhase).toBe('action-window');
        expect(next.selectedRegionId).toBe('city-region-19');
        expect(next.factions.jin.characters.find((character) => character.id === 'jin-nurhaci')).toMatchObject({ inPlay: true });
        expect(next.factions.jin.characters.find((character) => character.id === 'jin-daisan')).toMatchObject({
            inPlay: true,
            removedFromGame: false,
        });
        expect(next.factions.jin.characters.find((character) => character.id === 'jin-amin')).toMatchObject({ inPlay: true });
        expect(next.actionLog[0]?.text).not.toContain('代善与其他后金贝勒同场');
    });

it('袁崇焕在场时会让努尔哈赤在新的后金行动窗口前被移出游戏', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.actionChoices = getActionChoicesForFaction('jin');
        core.selectedActionId = 'marriage-subjugation';
        core.factions.ming.characters = core.factions.ming.characters.map((character) => ({
            ...character,
            inPlay: character.id === 'ming-yuan-chonghuan',
        }));
        core.factions.jin.characters = core.factions.jin.characters.map((character) => ({
            ...character,
            inPlay: character.id === 'jin-nurhaci' || character.id === 'jin-huangtaiji',
        }));

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '2',
            payload: { regionId: 'city-region-19' },
        });

        expect(next.turnPhase).toBe('action-window');
        expect(next.selectedRegionId).toBe('city-region-19');
        expect(next.factions.jin.characters.find((character) => character.id === 'jin-nurhaci')).toMatchObject({
            inPlay: false,
            removedFromGame: true,
        });
        expect(next.actionLog[0]?.text).toContain('袁崇焕在场，努尔哈赤被移出游戏');
    });
});
