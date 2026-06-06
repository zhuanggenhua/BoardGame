import { describe, expect, it } from 'vitest';
import { getActionChoicesForFaction, getQidahenEffectiveVpByFaction, QidahenDomain } from '../domain';
import { QIDAHEN_COMMANDS } from '../domain/commands';
import { QIDAHEN_FORTIFICATION_CONFIG_BY_ID } from '../domain/regionConfig';
import { QIDAHEN_MAP_HEIGHT, QIDAHEN_MAP_REGION_SHAPES, QIDAHEN_MAP_WIDTH } from '../ui/mapRegions';
import type { QidahenCommand, QidahenCore, QidahenEvent, QidahenFactionId } from '../domain/types';
import type { MatchState, RandomFn } from '../../../engine/types';

const random = () => 0.5;
const testRandom: RandomFn = {
    random: () => 0.5,
    d: () => 4,
    range: (min) => min,
    shuffle: <T>(array: T[]) => [...array],
};

const diceSequence = (...rolls: number[]): RandomFn => {
    let cursor = 0;
    return {
        random: () => 0.5,
        d: () => rolls[cursor++] ?? 4,
        range: (min) => min,
        shuffle: <T>(array: T[]) => [...array],
    };
};

const dieSidesRandom: RandomFn = {
    random: () => 0.5,
    d: (sides) => sides,
    range: (min) => min,
    shuffle: <T>(array: T[]) => [...array],
};

const lindanInfluenceRegionIds = new Set([
    'city-region-1',
    'city-region-2',
    'city-region-3',
    'city-region-6',
    'city-region-8',
    'city-region-10',
    'city-region-14',
    'city-region-16',
    'city-region-17',
    'city-region-19',
    'city-region-20',
    'city-region-26',
]);

function stateOf(core: QidahenCore): MatchState<QidahenCore> {
    return { core, sys: {} as MatchState<QidahenCore>['sys'] };
}

function apply(core: QidahenCore, command: QidahenCommand, randomFn: RandomFn = testRandom): QidahenCore {
    const validation = QidahenDomain.validate(stateOf(core), command);
    expect(validation.valid).toBe(true);
    return QidahenDomain.execute(stateOf(core), command, randomFn).reduce(
        (next, event) => QidahenDomain.reduce(next, event as QidahenEvent),
        core,
    );
}

function setFactionCharactersInPlay(
    core: QidahenCore,
    factionId: QidahenFactionId,
    characterIds: string[],
): QidahenCore {
    core.factions = {
        ...core.factions,
        [factionId]: {
            ...core.factions[factionId],
            characters: core.factions[factionId].characters.map((character) => ({
                ...character,
                inPlay: characterIds.includes(character.id),
            })),
        },
    };
    return core;
}

function factionHandCards(core: QidahenCore, factionId: QidahenFactionId) {
    return core.handCards.filter((card) => card.faction === factionId);
}

function setRegionCavalry(
    core: QidahenCore,
    regionId: string,
    faction: 'ming' | 'mongol' | 'jin',
    count: number,
    level = 1,
): QidahenCore {
    const factionLabel = faction === 'ming' ? '大明' : faction === 'mongol' ? '蒙古' : '后金';
    core.regions = core.regions.map((region) => (
        region.id === regionId
            ? {
                ...region,
                controller: faction,
                controlLabel: factionLabel,
                troops: count,
                specialTroops: [
                    {
                        id: `${faction}-${regionId}-cavalry-lv${level}`,
                        label: `${factionLabel}骑兵`,
                        faction,
                        troopKind: 'cavalry',
                        count,
                        level,
                    },
                ],
            }
            : region
    ));
    return core;
}

describe('七大恨支付手牌选择', () => {
    it('地图区域定义与领域区域保持同源', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const coreRegionsById = new Map(core.regions.map((region) => [region.id, region]));

        for (const shape of QIDAHEN_MAP_REGION_SHAPES) {
            expect(coreRegionsById.has(shape.id), `${shape.id} 缺少领域区域`).toBe(true);
            expect(coreRegionsById.get(shape.id)?.name).toBe(shape.name);
            expect(shape.polygon.length).toBeGreaterThanOrEqual(3);
            for (const [x, y] of shape.polygon) {
                expect(x).toBeGreaterThanOrEqual(0);
                expect(x).toBeLessThanOrEqual(QIDAHEN_MAP_WIDTH);
                expect(y).toBeGreaterThanOrEqual(0);
                expect(y).toBeLessThanOrEqual(QIDAHEN_MAP_HEIGHT);
            }
        }

        expect(core.regions.length).toBeGreaterThan(QIDAHEN_MAP_REGION_SHAPES.length);
        expect(core.regions.find((region) => region.id === 'jinzhou')?.adjacentRegionIds.length).toBeGreaterThan(0);
    });

    it('按当前阵营保留规则来源中的具体势力行动目录', () => {
        expect(getActionChoicesForFaction('ming').map((action) => action.label)).toEqual([
            '升级军备',
            '突袭作战',
            '征召军队',
            '赐印招安',
            '驱虎吞狼',
        ]);
        expect(getActionChoicesForFaction('mongol').map((action) => action.label)).toEqual([
            '升级军备',
            '突袭作战',
            '马市贸易',
            '大汗令箭',
        ]);
        expect(getActionChoicesForFaction('jin').map((action) => action.label)).toEqual([
            '升级军备',
            '突袭作战',
            '联姻诱降',
        ]);
    });

    it('剧本一开局人物在场状态遵循规则设置', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);

        expect(core.factions.ming.characters.filter((character) => character.inPlay).map((character) => character.name)).toEqual([]);
        expect(core.factions.mongol.characters.filter((character) => character.inPlay).map((character) => character.name)).toEqual([
            '林丹·乎图克图',
        ]);
        expect(core.factions.jin.characters.filter((character) => character.inPlay).map((character) => character.name)).toEqual([
            '努尔哈赤',
            '额亦都',
        ]);
        expect(core.factions.jin.characters.find((character) => character.id === 'jin-fan-wencheng')?.inPlay).toBe(false);
    });

    it('剧本一开局手牌数量遵循规则设置', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);

        expect(core.factions.ming.handCount).toBe(3);
        expect(core.factions.mongol.handCount).toBe(6);
        expect(core.factions.jin.handCount).toBe(10);
        expect(factionHandCards(core, 'ming').filter((card) => card.status === 'payable')).toHaveLength(3);
        expect(factionHandCards(core, 'mongol')).toHaveLength(6);
        expect(factionHandCards(core, 'jin')).toHaveLength(10);
    });

    it('剧本一开局已开发军备遵循规则设置', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);

        expect(core.factions.ming.armaments).toEqual([
            { id: 'artillery-tech', name: '火炮技术', level: 1 },
        ]);
        expect(core.factions.mongol.armaments).toEqual([
            { id: 'cavalry-armor', name: '骑兵铁甲', level: 1 },
        ]);
        expect(core.factions.jin.armaments).toEqual([
            { id: 'infantry-armor', name: '步兵铁甲', level: 1 },
        ]);
    });

    it('会为关键借位区和高置信图区同时生成逻辑规则区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const regionsById = new Map(core.regions.map((region) => [region.id, region]));

        expect(regionsById.get('liao-xi')).toMatchObject({
            id: 'liao-xi',
            name: '辽西',
            isLogicalRegion: true,
            primaryRuntimeRegionId: 'city-region-19',
            runtimeRegionIds: ['city-region-19'],
        });
        expect(regionsById.get('ning-yuan')).toMatchObject({
            id: 'ning-yuan',
            name: '宁远',
            isLogicalRegion: true,
            primaryRuntimeRegionId: 'city-region-24',
            runtimeRegionIds: ['city-region-24'],
        });
        expect(regionsById.get('ji-zhen')).toMatchObject({
            id: 'ji-zhen',
            name: '蓟镇',
            isLogicalRegion: true,
            primaryRuntimeRegionId: 'city-region-28',
            runtimeRegionIds: ['city-region-28'],
        });
        expect(regionsById.get('liao-bei')).toMatchObject({
            id: 'liao-bei',
            name: '辽北',
            isLogicalRegion: true,
            primaryRuntimeRegionId: 'city-region-15',
            runtimeRegionIds: ['city-region-15'],
        });
        expect(regionsById.get('liao-dong')).toMatchObject({
            id: 'liao-dong',
            name: '辽东',
            isLogicalRegion: true,
            primaryRuntimeRegionId: 'city-region-15',
            runtimeRegionIds: ['city-region-15'],
        });
        expect(regionsById.get('xuan-fu')).toMatchObject({
            id: 'xuan-fu',
            name: '宣府',
            isLogicalRegion: true,
            primaryRuntimeRegionId: 'city-region-24',
            runtimeRegionIds: ['city-region-24'],
        });
        expect(regionsById.get('shun-tian')).toMatchObject({
            id: 'shun-tian',
            name: '顺天',
            isLogicalRegion: true,
            primaryRuntimeRegionId: 'city-region-28',
            runtimeRegionIds: ['city-region-28'],
        });
        expect(regionsById.get('xuan-fu')?.troops).toBe(regionsById.get('city-region-24')?.troops);
        expect(regionsById.get('shun-tian')?.controller).toBe(regionsById.get('city-region-28')?.controller);
        expect(regionsById.get('liao-dong')?.population).toBe(regionsById.get('city-region-15')?.population);
        expect(QIDAHEN_FORTIFICATION_CONFIG_BY_ID.get('shanhaiguan')?.dependencyRegionId).toBe('ji-zhen');
        expect(QIDAHEN_FORTIFICATION_CONFIG_BY_ID.get('ningyuan')?.dependencyRegionId).toBe('liao-xi');
        expect(QIDAHEN_FORTIFICATION_CONFIG_BY_ID.get('jinzhou')?.dependencyRegionId).toBe('liao-xi');
    });

    it('升级军备需要按军备牌加弃牌支付 2 张手牌', () => {
        const selected = apply(QidahenDomain.setup(['0', '1', '2'], random), {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'upgrade-armament' },
        });

        expect(selected.selectedActionId).toBe('upgrade-armament');
        expect(selected.payment).toMatchObject({
            required: 2,
            selected: 0,
            prompt: '需弃 2 / 已选 0',
        });
    });

    it('升级军备会消耗 2 张手牌并提升当前势力已开发军备', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'upgrade-armament' },
        });

        expect(next.factions.ming.armaments).toEqual([
            { id: 'artillery-tech', name: '火炮技术', level: 2 },
        ]);
        expect(next.factions.ming.handCount).toBe(1);
        expect(next.factions.ming.discardPileCount).toBe(9);
        expect(factionHandCards(next, 'ming').filter((card) => card.status === 'payable')).toHaveLength(1);
        expect(next.lastSeasonSummary?.title).toBe('升级军备');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('大明将火炮技术升级到2级');
        expect(next.actionLog[0]?.text).toContain('大明 执行 升级军备，弃 2 张牌');
    });

    it('升级军备到低保真上限后会被校验拦截，避免白白弃牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const maxedCore: QidahenCore = {
            ...core,
            factions: {
                ...core.factions,
                ming: {
                    ...core.factions.ming,
                    armaments: core.factions.ming.armaments.map((armament) => ({
                        ...armament,
                        level: 2,
                    })),
                },
            },
        };
        const selectedCore: QidahenCore = {
            ...maxedCore,
            selectedActionId: 'upgrade-armament',
            selectedPaymentCardIds: factionHandCards(maxedCore, 'ming').slice(0, 2).map((card) => card.id),
            payment: {
                required: 2,
                selected: 2,
                prompt: '需弃 2 / 已选 2',
            },
        };

        const directValidation = QidahenDomain.validate(stateOf(maxedCore), {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'upgrade-armament' },
        });
        const selectedValidation = QidahenDomain.validate(stateOf(selectedCore), {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '0',
        });

        expect(directValidation).toEqual({ valid: false, error: 'noUpgradableArmament' });
        expect(selectedValidation).toEqual({ valid: false, error: 'noUpgradableArmament' });
        expect(maxedCore.factions.ming.handCount).toBe(3);
        expect(factionHandCards(maxedCore, 'ming').filter((card) => card.status === 'payable')).toHaveLength(3);
        expect(maxedCore.factions.ming.armaments).toEqual([
            { id: 'artillery-tech', name: '火炮技术', level: 2 },
        ]);
    });

    it('皇太极在场时后金第一次手牌行动后仍可再执行一次不同的手牌行动', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.selectedRegionId = 'city-region-19';
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
            if (region.id === 'city-region-19') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                };
            }
            if (region.id === 'city-region-17') {
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
        expect(afterFirstResolution.selectedRegionId).toBe('city-region-19');
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

        expect(secondAction.pendingTargetAction).not.toBeNull();
        expect(secondAction.lastFactionActionId).toBe('raid');
        expect(secondAction.bonusFactionActionUsed).toBe(true);
        expect(secondAction.currentPlayer).toBe('2');
    });

    it('皇太极的额外手牌行动完成后，轮盘未用时仍留在本家；轮盘完成后再换人', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.selectedRegionId = 'city-region-19';
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
            if (region.id === 'city-region-19') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                };
            }
            if (region.id === 'city-region-17') {
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
        const afterSecondAction = apply(apply(afterFirstAction, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'raid' },
        }), {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: {},
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

    it('点击手牌会写入支付选择并更新支付提示', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-4' },
        });

        expect(next.selectedPaymentCardIds).toEqual(['hand-4']);
        expect(next.payment).toMatchObject({
            required: 3,
            selected: 1,
            prompt: '需弃 3 / 已选 1',
        });
    });

    it('切换行动会清空已选支付牌并按新花费重算', () => {
        const selected = apply(QidahenDomain.setup(['0', '1', '2'], random), {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-4' },
        });

        const next = apply(selected, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        });

        expect(next.selectedActionId).toBe('recruit');
        expect(next.selectedPaymentCardIds).toEqual([]);
        expect(next.payment).toMatchObject({
            required: 1,
            selected: 0,
            prompt: '需弃 1 / 已选 0',
        });
    });

    it('达到当前花费上限后不会继续增加支付牌', () => {
        const recruit = apply(QidahenDomain.setup(['0', '1', '2'], random), {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        });
        const first = apply(recruit, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-1' },
        });
        const second = apply(first, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-2' },
        });

        expect(second.selectedPaymentCardIds).toEqual(['hand-1']);
        expect(second.payment.prompt).toBe('需弃 1 / 已选 1');
    });

    it('实体手牌按势力隔离，轮到蒙古时不会消费大明剩牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        expect(factionHandCards(core, 'ming')).toHaveLength(4);
        expect(factionHandCards(core, 'mongol')).toHaveLength(6);
        expect(factionHandCards(core, 'jin')).toHaveLength(10);

        const next = apply({
            ...core,
            currentPlayer: '1',
            selectedActionId: 'ma-shi-trade',
            actionChoices: getActionChoicesForFaction('mongol'),
            selectedPaymentCardIds: [],
            payment: {
                required: 1,
                selected: 0,
                prompt: '需弃 1 / 已选 0',
            },
        }, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'ma-shi-trade' },
        });

        expect(factionHandCards(next, 'ming')).toHaveLength(4);
        expect(factionHandCards(next, 'mongol')).toHaveLength(5);
        expect(next.factions.mongol.handCount).toBe(5);
    });

    it('确认执行征召军队后会先进入建军方式选择', () => {
        const selectedRegion = apply(QidahenDomain.setup(['0', '1', '2'], random), {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'song-jin' },
        });
        const recruit = apply(selectedRegion, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        });
        const selected = apply(recruit, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-1' },
        });
        const next = apply(selected, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(next.selectedPaymentCardIds).toEqual([]);
        expect(next.payment).toMatchObject({
            required: 1,
            selected: 0,
            prompt: '需弃 1 / 已选 0',
        });
        expect(next.discardPileCount).toBe(8);
        expect(next.factions.ming.handCount).toBe(2);
        expect(next.factions.ming.troops).toBe(18);
        expect(next.regions.find((region) => region.id === 'song-jin')?.troops).toBe(2);
        expect(factionHandCards(next, 'ming')).toHaveLength(3);
        expect(next.turnPhase).toBe('recruit-choice');
        expect(next.recruitSelection?.targetRegionId).toBe('song-jin');
        expect(next.recruitSelection?.choices.map((choice) => choice.id)).toEqual(['level-2-troops', 'level-4-chuanbing', 'level-1-artillery']);
        expect(next.actionLog[0]?.text).toContain('进入征召军队建军选择');
    });

    it('没有火炮技术时征召军队不会出现炮兵选项', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'song-jin';
        core.factions.ming.armaments = [];

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        });

        expect(selecting.recruitSelection?.choices.map((choice) => choice.id)).toEqual(['level-2-troops', 'level-4-chuanbing']);
    });

    it('征召军队选择等级 2 部队后会给目标区增加 6 兵', () => {
        const core = apply(QidahenDomain.setup(['0', '1', '2'], random), {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'song-jin' },
        });
        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        });
        const next = apply(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE,
            playerId: '0',
            payload: { choiceId: 'level-2-troops' },
        });

        expect(next.selectedActionId).toBe('recruit');
        expect(next.selectedPaymentCardIds).toEqual([]);
        expect(next.discardPileCount).toBe(8);
        expect(next.turnPhase).toBe('action-window');
        expect(next.selectedRegionId).toBe('song-jin');
        expect(next.recruitSelection).toBeNull();
        expect(next.factions.ming.handCount).toBe(2);
        expect(next.factions.ming.troops).toBe(24);
        expect(next.regions.find((region) => region.id === 'song-jin')?.troops).toBe(8);
        expect(next.regions.find((region) => region.id === 'song-jin')?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'ming-recruit-regular-infantry-lv2',
                label: '大明步兵',
                faction: 'ming',
                troopKind: 'infantry',
                count: 6,
                level: 2,
            }),
        ]));
        expect(factionHandCards(next, 'ming')).toHaveLength(3);
        expect(next.lastSeasonSummary?.title).toBe('征召军队');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('建立 6 个等级 2 部队');
        expect(next.actionLog[0]?.text).toContain('建立 6 个等级 2 部队');
    });

    it('征召军队选择川兵后会记录特殊部队并保留总兵力 +2', () => {
        const core = apply(QidahenDomain.setup(['0', '1', '2'], random), {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'song-jin' },
        });
        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        });
        const next = apply(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE,
            playerId: '0',
            payload: { choiceId: 'level-4-chuanbing' },
        });

        expect(next.turnPhase).toBe('action-window');
        expect(next.selectedRegionId).toBe('song-jin');
        expect(next.recruitSelection).toBeNull();
        expect(next.factions.ming.handCount).toBe(2);
        expect(next.factions.ming.troops).toBe(20);
        expect(next.regions.find((region) => region.id === 'song-jin')).toMatchObject({
            troops: 4,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({
                    id: 'ming-chuanbing-lv4',
                    label: '川兵',
                    faction: 'ming',
                    count: 2,
                    level: 4,
                }),
            ]),
        });
        expect(next.lastSeasonSummary?.title).toBe('征召军队');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('建立 2 个等级 4 川兵部队');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('川兵 x2（4级）');
        expect(next.actionLog[0]?.text).toContain('川兵 x2（4级）');
    });

    it('火炮技术允许征召军队建立等级 1 炮兵', () => {
        const core = apply(QidahenDomain.setup(['0', '1', '2'], random), {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'song-jin' },
        });
        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        });
        expect(selecting.recruitSelection?.choices.find((choice) => choice.id === 'level-1-artillery')).toMatchObject({
            label: '建立 1 个等级 1 炮兵',
        });

        const next = apply(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE,
            playerId: '0',
            payload: { choiceId: 'level-1-artillery' },
        });

        expect(next.turnPhase).toBe('action-window');
        expect(next.selectedRegionId).toBe('song-jin');
        expect(next.recruitSelection).toBeNull();
        expect(next.factions.ming.handCount).toBe(2);
        expect(next.factions.ming.troops).toBe(19);
        expect(next.regions.find((region) => region.id === 'song-jin')).toMatchObject({
            troops: 3,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({
                    id: 'ming-recruit-regular-artillery-lv1',
                    label: '大明炮兵',
                    faction: 'ming',
                    troopKind: 'artillery',
                    count: 1,
                    level: 1,
                }),
            ]),
        });
        expect(next.lastSeasonSummary?.title).toBe('征召军队');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('建立 1 个等级 1 炮兵');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('火炮技术允许建立炮兵');
        expect(next.actionLog[0]?.text).toContain('炮兵 x1（1级）');
    });

    it('征召军队不会把正规军建在附庸区，而会回退到本土控制区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-22';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-22') {
                return {
                    ...region,
                    controller: 'ming',
                    diplomacyMarkerFaction: 'ming',
                    diplomacyMarkerSide: 'vassal',
                    controlLabel: '大明附庸',
                    troops: 1,
                };
            }
            if (region.id === 'xian-xing') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        });

        expect(selecting.recruitSelection?.targetRegionId).toBe('song-jin');

        const resolved = apply(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE,
            playerId: '0',
            payload: { choiceId: 'level-2-troops' },
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-22')).toMatchObject({
            controlLabel: '大明附庸',
            troops: 1,
        });
        expect(resolved.regions.find((region) => region.id === 'song-jin')?.troops).toBe(8);
    });

    it('征召军队不会把围城区当正规军建军目标，而会回退到非围城己方控制区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'song-jin';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'song-jin') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    siegeState: {
                        attackerFactionId: 'jin',
                        attackerTroops: 2,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-25',
                    },
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 5,
                    siegeState: null,
                };
            }
            if (region.controller === 'ming') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    siegeState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        });

        expect(selecting.recruitSelection?.targetRegionId).toBe('city-region-24');

        const resolved = apply(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE,
            playerId: '0',
            payload: { choiceId: 'level-2-troops' },
        });

        expect(resolved.regions.find((region) => region.id === 'song-jin')).toMatchObject({
            troops: 2,
            siegeState: expect.objectContaining({
                attackerFactionId: 'jin',
            }),
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-24')?.troops).toBe(11);
    });

    it('征召军队以逻辑区宁远作为当前选区时，会把目标与 selectedRegionId 收到真实运行时区域', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'ning-yuan';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    population: 1,
                    specialTroops: [
                        {
                            id: 'ming-ningyuan-infantry-lv1',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 3,
                            level: 1,
                        },
                    ],
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                    siegeState: null,
                    cityState: null,
                };
            }
            if (region.controller === 'ming' && region.id !== 'city-region-24') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    siegeState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        });

        expect(selecting.selectedRegionId).toBe('city-region-24');
        expect(selecting.turnPhase).toBe('recruit-choice');
        expect(selecting.recruitSelection).toMatchObject({
            targetRegionId: 'city-region-24',
            targetRegionName: '宁远',
        });

        const resolved = apply(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE,
            playerId: '0',
            payload: { choiceId: 'level-2-troops' },
        });

        expect(resolved.selectedRegionId).toBe('city-region-24');
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 9,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({
                    id: 'ming-recruit-regular-infantry-lv2',
                    label: '大明步兵',
                    faction: 'ming',
                    troopKind: 'infantry',
                    count: 6,
                    level: 2,
                }),
            ]),
        });
        expect(resolved.lastSeasonSummary?.lines.join(' | ')).toContain('宁远');
    });

    it('征召军队进入选择面板后点逻辑区宁远时，会把目标与 selectedRegionId 重建到真实运行时区域', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'song-jin';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'song-jin') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    siegeState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    population: 1,
                    specialTroops: [],
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                    siegeState: null,
                    cityState: null,
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        });

        expect(selecting.selectedRegionId).toBe('song-jin');
        expect(selecting.recruitSelection?.targetRegionId).toBe('song-jin');

        const retargeted = apply(selecting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'ning-yuan' },
        });

        expect(retargeted.selectedRegionId).toBe('city-region-24');
        expect(retargeted.turnPhase).toBe('recruit-choice');
        expect(retargeted.recruitSelection).toMatchObject({
            targetRegionId: 'city-region-24',
            targetRegionName: '宁远',
        });
    });

    it('征召军队在非围城 cityState 城市建军时会先并回守军，再建立新部队', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [
                            { id: 'ming-shanhaiguan-infantry-lv2', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 2 },
                        ],
                    },
                };
            }
            if (region.controller === 'ming') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                    siegeState: null,
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });
        const selected = apply(selecting, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        });
        const resolved = apply(selected, {
            type: QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE,
            playerId: '0',
            payload: { choiceId: 'level-2-troops' },
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            troops: 8,
            population: 2,
            cityState: null,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({ id: 'ming-shanhaiguan-infantry-lv2', label: '大明步兵', faction: 'ming', count: 2, level: 2 }),
                expect.objectContaining({ id: 'ming-recruit-regular-infantry-lv2', label: '大明步兵', faction: 'ming', count: 6, level: 2 }),
            ]),
        });
        expect(resolved.factions.ming.troops).toBe(core.factions.ming.troops + 6);
    });

    it('征召军队自动回退目标时会按 cityState 合并后的兵力优先选择区域', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-22';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-22') {
                return {
                    ...region,
                    controller: 'ming',
                    diplomacyMarkerFaction: 'ming',
                    diplomacyMarkerSide: 'vassal',
                    controlLabel: '大明附庸',
                    troops: 1,
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    population: 1,
                    cityState: null,
                    siegeState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 4,
                        population: 2,
                        specialTroops: [],
                    },
                    siegeState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            if (region.controller === 'ming') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    siegeState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        });

        expect(selecting.recruitSelection?.targetRegionId).toBe('city-region-25');

        const resolved = apply(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE,
            playerId: '0',
            payload: { choiceId: 'level-2-troops' },
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 3,
            population: 1,
            cityState: null,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            troops: 10,
            population: 2,
            cityState: null,
        });
    });

    it('赐印招安执行后会把 1 个相邻敌军转入大明控制区域', () => {
        const selectedRegion = apply(QidahenDomain.setup(['0', '1', '2'], random), {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'jinzhou' },
        });
        const first = apply(selectedRegion, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-1' },
        });
        const second = apply(first, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-2' },
        });
        const third = apply(second, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-3' },
        });
        const next = apply(third, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '0',
            payload: {},
        });

        const sourceRegion = next.regions.find((region) => region.id === 'jinzhou');
        const destinationRegion = next.regions.find((region) => region.id === 'city-region-25');
        const targetControlToken = next.mapTokens.find((token) => token.id === 'jinzhou-control');
        expect(sourceRegion?.controller).toBe('jin');
        expect(sourceRegion?.controlLabel).toBe('后金');
        expect(sourceRegion?.troops).toBe(1);
        expect(destinationRegion?.controller).toBe('ming');
        expect(destinationRegion?.controlLabel).toBe('大明');
        expect(destinationRegion?.troops).toBe(3);
        expect(targetControlToken?.faction).toBe('jin');
        expect(targetControlToken?.imageSrc).toBe('qidahen/markers/jin-control-diplomacy-marker-a');
        expect(next.discardPileCount).toBe(10);
        expect(next.factions.ming.handCount).toBe(0);
        expect(next.factions.ming.troops).toBe(19);
        expect(next.factions.jin.troops).toBe(16);
        expect(next.selectedRegionId).toBe('city-region-25');
        expect(next.lastSeasonSummary?.title).toBe('赐印招安');
    });

    it('赐印招安可对非围城 cityState 敌城生效，并只从城内守军扣 1', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'jinzhou';
        core.selectedActionId = 'grant-pardon';
        core.selectedPaymentCardIds = ['hand-1', 'hand-2', 'hand-3'];
        core.payment = {
            required: 3,
            selected: 3,
            prompt: '需弃 3 / 已选 3',
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [
                            { id: 'jin-jinzhou-infantry-lv2', label: '后金步兵', faction: 'jin', troopKind: 'infantry', count: 2, level: 2 },
                        ],
                    },
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                };
            }
            return region;
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(next.regions.find((region) => region.id === 'jinzhou')).toMatchObject({
            controller: 'jin',
            controlLabel: '后金',
            troops: 0,
            cityState: {
                troops: 1,
                population: 2,
                specialTroops: [
                    { id: 'jin-jinzhou-infantry-lv2', label: '后金步兵', faction: 'jin', troopKind: 'infantry', count: 1, level: 2 },
                ],
            },
        });
        expect(next.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'ming',
            controlLabel: '大明',
            troops: 3,
        });
        expect(next.factions.ming.troops).toBe(core.factions.ming.troops + 1);
        expect(next.factions.jin.troops).toBe(core.factions.jin.troops - 1);
        expect(next.selectedRegionId).toBe('city-region-25');
        expect(next.lastSeasonSummary?.title).toBe('赐印招安');
    });

    it('赐印招安以逻辑区宁远作为当前选区时，会按真实敌区结算并把焦点收回真实接收区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'ning-yuan';
        core.selectedActionId = 'grant-pardon';
        core.selectedPaymentCardIds = ['hand-1', 'hand-2', 'hand-3'];
        core.payment = {
            required: 3,
            selected: 3,
            prompt: '需弃 3 / 已选 3',
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(next.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'jin',
            controlLabel: '后金',
            troops: 1,
        });
        expect(next.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'ming',
            controlLabel: '大明',
            troops: 3,
        });
        expect(next.selectedRegionId).toBe('city-region-25');
        expect(next.lastSeasonSummary?.title).toBe('赐印招安');
    });

    it('赐印招安自动接收区会按 cityState 合并后的兵力优先选择大明区域', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'jinzhou';
        core.selectedActionId = 'grant-pardon';
        core.selectedPaymentCardIds = ['hand-1', 'hand-2', 'hand-3'];
        core.payment = {
            required: 3,
            selected: 3,
            prompt: '需弃 3 / 已选 3',
        };
        const jinzhouAdjacentIds = new Set([
            'city-region-14',
            'city-region-15',
            'city-region-16',
            'city-region-19',
            'city-region-22',
            'city-region-24',
            'city-region-25',
        ]);
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 1,
                    cityState: null,
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    population: 1,
                    cityState: null,
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 4,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            if (jinzhouAdjacentIds.has(region.id)) {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(next.selectedRegionId).toBe('city-region-25');
        expect(next.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'ming',
            troops: 2,
            cityState: null,
        });
        expect(next.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'ming',
            troops: 5,
            population: 2,
            cityState: null,
        });
    });

    it('赐印招安把部队转入己方被围城市时，会并入 cityState 而不是落到城市顶层', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'jinzhou';
        core.selectedActionId = 'grant-pardon';
        core.selectedPaymentCardIds = ['hand-1', 'hand-2', 'hand-3'];
        core.payment = {
            required: 3,
            selected: 3,
            prompt: '需弃 3 / 已选 3',
        };
        const jinzhouAdjacentIds = new Set([
            'city-region-14',
            'city-region-15',
            'city-region-16',
            'city-region-19',
            'city-region-22',
            'city-region-24',
            'city-region-25',
        ]);
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 1,
                    cityState: null,
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'jin',
                        attackerTroops: 2,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-28',
                    },
                    cityState: {
                        troops: 4,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            if (jinzhouAdjacentIds.has(region.id)) {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    siegeState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(next.selectedRegionId).toBe('city-region-25');
        expect(next.regions.find((region) => region.id === 'jinzhou')).toMatchObject({
            controller: 'jin',
            troops: 0,
            cityState: null,
        });
        expect(next.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'ming',
            troops: 0,
            population: 0,
            siegeState: expect.objectContaining({
                attackerFactionId: 'jin',
                attackerTroops: 2,
            }),
            cityState: {
                troops: 5,
                population: 2,
                specialTroops: [],
            },
        });
        expect(next.factions.ming.troops).toBe(core.factions.ming.troops + 1);
        expect(next.factions.jin.troops).toBe(core.factions.jin.troops - 1);
        expect(next.lastSeasonSummary?.title).toBe('赐印招安');
    });

    it('赐印招安自动接收区会按被围城市的 cityState 守军优先选择大明区域', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'jinzhou';
        core.selectedActionId = 'grant-pardon';
        core.selectedPaymentCardIds = ['hand-1', 'hand-2', 'hand-3'];
        core.payment = {
            required: 3,
            selected: 3,
            prompt: '需弃 3 / 已选 3',
        };
        const jinzhouAdjacentIds = new Set([
            'city-region-14',
            'city-region-15',
            'city-region-16',
            'city-region-19',
            'city-region-22',
            'city-region-24',
            'city-region-25',
        ]);
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 1,
                    cityState: null,
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    population: 1,
                    cityState: null,
                    siegeState: null,
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'jin',
                        attackerTroops: 2,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-28',
                    },
                    cityState: {
                        troops: 4,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            if (jinzhouAdjacentIds.has(region.id)) {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    siegeState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(next.selectedRegionId).toBe('city-region-25');
        expect(next.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'ming',
            troops: 2,
            cityState: null,
            siegeState: null,
        });
        expect(next.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'ming',
            troops: 0,
            siegeState: expect.objectContaining({
                attackerFactionId: 'jin',
                attackerTroops: 2,
            }),
            cityState: {
                troops: 5,
                population: 2,
                specialTroops: [],
            },
        });
    });

    it('驱虎吞狼执行后会先进入目标是否同意的选择状态', () => {
        const selectedRegion = apply(setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'jinzhou', 'jin', 2, 2), {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'jinzhou' },
        });
        const action = apply(selectedRegion, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'drive-tiger' },
        });
        const first = apply(action, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-1' },
        });
        const second = apply(first, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-2' },
        });
        const third = apply(second, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-3' },
        });
        const next = apply(third, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(next.factions.jin.handCount).toBe(10);
        expect(next.discardPileCount).toBe(10);
        expect(next.factions.ming.handCount).toBe(0);
        expect(next.turnPhase).toBe('drive-tiger-consent');
        expect(next.pendingTargetAction).toBeNull();
        expect(next.wheelDispatchSelection).toBeNull();
        expect(next.driveTigerConsentSelection).toMatchObject({
            commanderFactionId: 'ming',
            targetFactionId: 'jin',
            targetFactionName: '后金',
        });
        expect(next.selectedRegionId).toBe('jinzhou');
        expect(next.driveTigerConsentSelection?.dispatchSelection).toMatchObject({
            attackerFactionId: 'jin',
            sourceRegionId: 'jinzhou',
        });
        expect((next.driveTigerConsentSelection?.dispatchSelection.candidates.length ?? 0)).toBeGreaterThan(0);
        expect(next.actionLog[0]?.text).toContain('等待 后金 决定是否同意');
    });

    it('驱虎吞狼在目标同意后会让目标抽 6 张牌并进入指挥调度目标选择', () => {
        const selectedRegion = apply(setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'jinzhou', 'jin', 2, 2), {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'jinzhou' },
        });
        const consenting = apply(selectedRegion, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'drive-tiger' },
        });
        const targeting = apply(consenting, {
            type: QIDAHEN_COMMANDS.RESOLVE_DRIVE_TIGER_CONSENT,
            playerId: '0',
            payload: { choiceId: 'accept' },
        });

        expect(targeting.factions.jin.handCount).toBe(16);
        expect(targeting.turnPhase).toBe('dispatch-targeting');
        expect(targeting.driveTigerConsentSelection).toBeNull();
        expect(targeting.wheelDispatchSelection).toMatchObject({
            attackerFactionId: 'jin',
            sourceRegionId: 'jinzhou',
        });
        expect(targeting.actionLog[0]?.text).toContain('同意接受');
        expect(targeting.actionLog[0]?.text).toContain('进入指挥调度目标选择');
    });

    it('驱虎吞狼选中被围城城市时会按 siegeState 围城军识别被指挥方', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-25';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 2,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'jin',
                        attackerTroops: 4,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-20',
                    },
                    cityState: {
                        troops: 0,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            if (region.controller === 'jin') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    siegeState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'drive-tiger' },
        });

        expect(next.turnPhase).toBe('drive-tiger-consent');
        expect(next.selectedRegionId).toBe('city-region-20');
        expect(next.driveTigerConsentSelection).toMatchObject({
            commanderFactionId: 'ming',
            targetFactionId: 'jin',
            targetFactionName: '后金',
        });
        expect(next.driveTigerConsentSelection?.dispatchSelection).toMatchObject({
            attackerFactionId: 'jin',
            sourceRegionId: 'city-region-20',
            sourceRegionName: '山海关围城军',
        });
        expect(next.driveTigerConsentSelection?.dispatchSelection.candidates.find((candidate) => candidate.targetRuntimeRegionId === 'city-region-25')).toMatchObject({
            targetRuntimeRegionId: 'city-region-25',
            attackerPositionRegionId: 'city-region-25',
            sourceAvailableTroops: 4,
            committedTroops: 4,
        });
    });

    it('驱虎吞狼当前选中区只有步兵时，会回退到同势力的合法骑兵来源区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-14';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'jin-city-region-14-infantry-lv2',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 2,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'jin-jinzhou-cavalry-lv2',
                            label: '后金骑兵',
                            faction: 'jin',
                            troopKind: 'cavalry',
                            count: 2,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.controller === 'jin') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    siegeState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'drive-tiger' },
        });

        expect(next.turnPhase).toBe('drive-tiger-consent');
        expect(next.selectedRegionId).toBe('jinzhou');
        expect(next.driveTigerConsentSelection).toMatchObject({
            commanderFactionId: 'ming',
            targetFactionId: 'jin',
            targetFactionName: '后金',
        });
        expect(next.driveTigerConsentSelection?.dispatchSelection).toMatchObject({
            attackerFactionId: 'jin',
            sourceRegionId: 'jinzhou',
            sourceRegionName: '锦州',
        });
        expect(next.driveTigerConsentSelection?.dispatchSelection.candidates.length).toBeGreaterThan(0);
    });

    it('驱虎吞狼等待同意时点逻辑区辽西，不会把 selectedRegionId 漂离真实来源区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-14';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'jin-city-region-14-infantry-lv2',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 2,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'jin-jinzhou-cavalry-lv2',
                            label: '后金骑兵',
                            faction: 'jin',
                            troopKind: 'cavalry',
                            count: 2,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.controller === 'jin') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    siegeState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const consenting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'drive-tiger' },
        });

        expect(consenting.turnPhase).toBe('drive-tiger-consent');
        expect(consenting.selectedRegionId).toBe('jinzhou');
        expect(consenting.driveTigerConsentSelection?.dispatchSelection.sourceRegionId).toBe('jinzhou');

        const reselected = apply(consenting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'liao-xi' },
        });

        expect(reselected.turnPhase).toBe('drive-tiger-consent');
        expect(reselected.selectedRegionId).toBe('jinzhou');
        expect(reselected.driveTigerConsentSelection?.dispatchSelection).toMatchObject({
            sourceRegionId: 'jinzhou',
            sourceRegionName: '锦州',
        });
    });

    it('驱虎吞狼在目标拒绝后会结束且不生效', () => {
        const selectedRegion = apply(setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'jinzhou', 'jin', 2, 2), {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'jinzhou' },
        });
        const consenting = apply(selectedRegion, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'drive-tiger' },
        });
        const declined = apply(consenting, {
            type: QIDAHEN_COMMANDS.RESOLVE_DRIVE_TIGER_CONSENT,
            playerId: '0',
            payload: { choiceId: 'decline' },
        });

        expect(declined.turnPhase).toBe('action-window');
        expect(declined.selectedRegionId).toBe('jinzhou');
        expect(declined.factions.jin.handCount).toBe(10);
        expect(declined.driveTigerConsentSelection).toBeNull();
        expect(declined.wheelDispatchSelection).toBeNull();
        expect(declined.lastSeasonSummary).toMatchObject({
            title: '驱虎吞狼',
        });
        expect(declined.lastSeasonSummary?.lines.join(' ')).toContain('拒绝');
        expect(declined.actionLog[0]?.text).toContain('拒绝接受');
    });

    it('驱虎吞狼在同意后锁定目标会进入待结算并保留指挥方为后金', () => {
        const selectedRegion = apply(setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'jinzhou', 'jin', 2, 2), {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'jinzhou' },
        });
        const consenting = apply(selectedRegion, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'drive-tiger' },
        });
        const targeting = apply(consenting, {
            type: QIDAHEN_COMMANDS.RESOLVE_DRIVE_TIGER_CONSENT,
            playerId: '0',
            payload: { choiceId: 'accept' },
        });

        expect(targeting.selectedRegionId).toBe('jinzhou');
        const firstCandidateId = targeting.wheelDispatchSelection?.candidates[0]?.targetRuntimeRegionId;
        expect(firstCandidateId).toBeTruthy();

        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: firstCandidateId! },
        });

        expect(pending.turnPhase).toBe('resolve-pending');
        expect(pending.selectedRegionId).toBe(firstCandidateId);
        expect(pending.pendingTargetAction).toMatchObject({
            actionId: 'drive-tiger',
            title: '驱虎吞狼待结算',
            attackerFactionId: 'jin',
            sourceRegionId: 'jinzhou',
        });
        expect(pending.actionLog[0]?.text).toContain('为 后金 锁定调度目标');
    });

    it('杨镐在场时驱虎吞狼会按大明指挥把调度进攻投入上限提高到 10', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'jinzhou', 'jin', 10, 2);
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-yang-gao',
                })),
            },
        };

        const selectedRegion = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'jinzhou' },
        });
        const consenting = apply(selectedRegion, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'drive-tiger' },
        });
        const targeting = apply(consenting, {
            type: QIDAHEN_COMMANDS.RESOLVE_DRIVE_TIGER_CONSENT,
            playerId: '0',
            payload: { choiceId: 'accept' },
        });

        const strongCandidate = targeting.wheelDispatchSelection?.candidates.find((candidate) => candidate.committedTroops === 10);
        expect(strongCandidate).toBeTruthy();

        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: strongCandidate!.targetRuntimeRegionId },
        });

        expect(targeting.driveTigerConsentSelection).toBeNull();
        expect(targeting.wheelDispatchSelection?.candidates.some((candidate) => candidate.committedTroops === 10)).toBe(true);
        expect(pending.pendingTargetAction).toMatchObject({
            actionId: 'drive-tiger',
            attackerFactionId: 'jin',
            sourceRegionId: 'jinzhou',
            sourceAvailableTroops: 10,
            committedTroops: 10,
        });
    });

    it('马市贸易执行后会先进入建立 1-3 部队的选择状态', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.selectedRegionId = 'song-jin';
        core.selectedActionId = 'ma-shi-trade';
        core.actionChoices = getActionChoicesForFaction('mongol');

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'ma-shi-trade' },
        });

        expect(next.selectedRegionId).toBe('song-jin');
        expect(next.turnPhase).toBe('ma-shi-trade-choice');
        expect(next.maShiTradeSelection?.targetRegionId).toBe('song-jin');
        expect(next.maShiTradeSelection?.choices.map((choice) => choice.troopCount)).toEqual([1, 2, 3]);
        expect(next.regions.find((region) => region.id === 'song-jin')?.troops).toBe(2);
        expect(next.factions.mongol.handCount).toBe(5);
        expect(next.drawPileCount).toBe(20);
        expect(factionHandCards(next, 'mongol')).toHaveLength(5);
        expect(next.actionLog[0]?.text).toContain('进入马市贸易建兵数量选择');
    });

    it('马市贸易在选择建立 3 个部队后会给大明加兵，并让蒙古抽 6 张手牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.selectedRegionId = 'song-jin';
        core.selectedActionId = 'ma-shi-trade';
        core.actionChoices = getActionChoicesForFaction('mongol');

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'ma-shi-trade' },
        });
        const next = apply(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_MA_SHI_TRADE_CHOICE,
            playerId: '1',
            payload: { troopCount: 3 },
        });

        expect(next.selectedRegionId).toBe('song-jin');
        expect(next.turnPhase).toBe('action-window');
        expect(next.maShiTradeSelection).toBeNull();
        expect(next.regions.find((region) => region.id === 'song-jin')).toMatchObject({
            controller: 'ming',
            troops: 5,
        });
        expect(next.regions.find((region) => region.id === 'song-jin')?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'ming-ma-shi-trade-regular-infantry-lv2',
                label: '大明步兵',
                faction: 'ming',
                troopKind: 'infantry',
                count: 3,
                level: 2,
            }),
        ]));
        expect(next.factions.ming.troops).toBe(21);
        expect(next.factions.mongol.handCount).toBe(11);
        expect(next.drawPileCount).toBe(20);
        expect(next.factions.ming.drawPileCount).toBe(20);
        expect(next.factions.mongol.drawPileCount).toBe(14);
        expect(factionHandCards(next, 'mongol')).toHaveLength(11);
        expect(next.lastSeasonSummary?.title).toBe('马市贸易');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('建立 3 个部队');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('获得 6 张手牌');
        expect(next.actionLog.some((entry) => entry.text.includes('完成马市贸易'))).toBe(true);
    });

    it('马市贸易不会把正规军建在大明附庸区，而会回退到大明本土控制区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.selectedRegionId = 'city-region-22';
        core.selectedActionId = 'ma-shi-trade';
        core.actionChoices = getActionChoicesForFaction('mongol');
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-22') {
                return {
                    ...region,
                    controller: 'ming',
                    diplomacyMarkerFaction: 'ming',
                    diplomacyMarkerSide: 'vassal',
                    controlLabel: '大明附庸',
                    troops: 1,
                };
            }
            if (region.id === 'xian-xing') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'ma-shi-trade' },
        });

        expect(selecting.maShiTradeSelection?.targetRegionId).toBe('song-jin');
    });

    it('马市贸易以逻辑区宁远作为当前选区时，会把目标与 selectedRegionId 收到真实运行时区域', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.selectedRegionId = 'ning-yuan';
        core.selectedActionId = 'ma-shi-trade';
        core.actionChoices = getActionChoicesForFaction('mongol');
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    population: 1,
                    specialTroops: [
                        {
                            id: 'ming-ningyuan-infantry-lv1',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 3,
                            level: 1,
                        },
                    ],
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                    siegeState: null,
                    cityState: null,
                };
            }
            if (region.controller === 'ming' && region.id !== 'city-region-24') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    siegeState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'ma-shi-trade' },
        });

        expect(selecting.selectedRegionId).toBe('city-region-24');
        expect(selecting.turnPhase).toBe('ma-shi-trade-choice');
        expect(selecting.maShiTradeSelection).toMatchObject({
            targetRegionId: 'city-region-24',
            targetRegionName: '宁远',
        });

        const resolved = apply(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_MA_SHI_TRADE_CHOICE,
            playerId: '1',
            payload: { troopCount: 3 },
        });

        expect(resolved.selectedRegionId).toBe('city-region-24');
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 6,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({
                    id: 'ming-ma-shi-trade-regular-infantry-lv2',
                    label: '大明步兵',
                    faction: 'ming',
                    troopKind: 'infantry',
                    count: 3,
                    level: 2,
                }),
            ]),
        });
        expect(resolved.factions.ming.troops).toBe(core.factions.ming.troops + 3);
        expect(resolved.factions.mongol.handCount).toBe(core.factions.mongol.handCount + 5);
        expect(resolved.lastSeasonSummary?.lines.join(' | ')).toContain('宁远');
    });

    it('马市贸易进入数量选择后点逻辑区宁远时，会把目标与 selectedRegionId 重建到真实运行时区域', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.selectedRegionId = 'song-jin';
        core.selectedActionId = 'ma-shi-trade';
        core.actionChoices = getActionChoicesForFaction('mongol');
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'song-jin') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    siegeState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    population: 1,
                    specialTroops: [],
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                    siegeState: null,
                    cityState: null,
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'ma-shi-trade' },
        });

        expect(selecting.selectedRegionId).toBe('song-jin');
        expect(selecting.maShiTradeSelection?.targetRegionId).toBe('song-jin');

        const retargeted = apply(selecting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'ning-yuan' },
        });

        expect(retargeted.selectedRegionId).toBe('city-region-24');
        expect(retargeted.turnPhase).toBe('ma-shi-trade-choice');
        expect(retargeted.maShiTradeSelection).toMatchObject({
            targetRegionId: 'city-region-24',
            targetRegionName: '宁远',
        });
    });

    it('马市贸易在非围城 cityState 城市建兵时会先并回守军，再建立新部队', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.selectedRegionId = 'city-region-25';
        core.selectedActionId = 'ma-shi-trade';
        core.actionChoices = getActionChoicesForFaction('mongol');
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [
                            { id: 'ming-shanhaiguan-infantry-lv2', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 2 },
                        ],
                    },
                };
            }
            if (region.controller === 'ming' && region.id !== 'city-region-25') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    siegeState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'ma-shi-trade' },
        });
        const resolved = apply(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_MA_SHI_TRADE_CHOICE,
            playerId: '1',
            payload: { troopCount: 3 },
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            troops: 5,
            population: 2,
            cityState: null,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({ id: 'ming-shanhaiguan-infantry-lv2', count: 2, level: 2 }),
                expect.objectContaining({ id: 'ming-ma-shi-trade-regular-infantry-lv2', count: 3, level: 2 }),
            ]),
        });
        expect(resolved.factions.ming.troops).toBe(core.factions.ming.troops + 3);
        expect(resolved.factions.mongol.handCount).toBe(core.factions.mongol.handCount + 5);
    });

    it('突袭作战执行后会进入进攻待结算状态并记录目标区域', () => {
        const selectedRegion = apply(QidahenDomain.setup(['0', '1', '2'], random), {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'jinzhou' },
        });
        const action = apply(selectedRegion, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'raid' },
        });
        const first = apply(action, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-1' },
        });
        const next = apply(first, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(next.pendingTargetAction).toMatchObject({
            actionId: 'raid',
            title: '突袭待结算',
            targetRegionId: 'jinzhou',
            targetRegionName: '锦州',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '仅进攻行动',
        });
        expect(next.discardPileCount).toBe(8);
        expect(next.factions.ming.handCount).toBe(2);
        expect(next.actionLog[0]?.text).toContain('进入 突袭待结算');
    });

    it('突袭作战不能把己方友好区当成进攻目标', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-22';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'song-jin') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                };
            }
            if (region.id === 'city-region-22') {
                return {
                    ...region,
                    controller: 'neutral',
                    diplomacyMarkerFaction: 'ming',
                    diplomacyMarkerSide: 'friendly',
                    controlLabel: '大明友好',
                    troops: 0,
                };
            }
            return region;
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'raid' },
        });

        expect(next.pendingTargetAction).toBeNull();
        expect(next.turnPhase).toBe('action-window');
    });

    it('突袭作战可直接以友方被围城市为目标进入解围待结算，并在胜利后清空 siegeState', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-25';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'jin',
                        attackerTroops: 2,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'jinzhou',
                    },
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'raid' },
        });

        expect(pending.pendingTargetAction).toMatchObject({
            actionId: 'raid',
            battleMode: 'field',
            targetKind: 'siege-attacker',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRuntimeRegionId: 'city-region-25',
            defenderFactionId: 'jin',
            defenderLabel: '后金围城军',
        });
        expect(pending.pendingTargetAction?.resolutionHint).toContain('解围');

        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.selectedRegionId).toBe('city-region-25');
        expect(resolved.postBattleSelection).toMatchObject({
            targetKind: 'siege-attacker',
            targetRuntimeRegionId: 'city-region-25',
            originalController: 'ming',
            originalControlLabel: '大明',
        });

        const occupied = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy' },
        });

        expect(occupied.selectedRegionId).toBe('city-region-25');
        expect(occupied.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'ming',
            siegeState: null,
            troops: 1,
            population: 0,
            cityState: {
                troops: 2,
                population: 2,
                specialTroops: [],
            },
        });
    });

    it('突袭作战自动回退目标时会按围城军兵力优先选择友方被围城市进行解围', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    population: 0,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'jin',
                        attackerTroops: 4,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'jinzhou',
                    },
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 1,
                    population: 0,
                    specialTroops: [],
                    siegeState: null,
                    cityState: null,
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'raid' },
        });

        expect(pending.selectedRegionId).toBe('city-region-25');
        expect(pending.pendingTargetAction).toMatchObject({
            actionId: 'raid',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRuntimeRegionId: 'city-region-25',
            targetKind: 'siege-attacker',
            defenderFactionId: 'jin',
            defenderLabel: '后金围城军',
        });
        expect(pending.pendingTargetAction?.resolutionHint).toContain('宁远 → 山海关');
        expect(pending.pendingTargetAction?.resolutionHint).toContain('解围');
        expect(pending.actionLog[0]?.text).toContain('宁远 → 山海关');
    });

    it('联姻诱降执行后会进入目标结算状态并记录邻近区域', () => {
        const selectedRegion = apply(QidahenDomain.setup(['0', '1', '2'], random), {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'jinzhou' },
        });
        const action = apply(selectedRegion, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'marriage-subjugation' },
        });
        const first = apply(action, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-1' },
        });
        const second = apply(first, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-2' },
        });
        const next = apply(second, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(next.pendingTargetAction).toMatchObject({
            actionId: 'marriage-subjugation',
            title: '联姻待结算',
            targetRegionId: 'jinzhou',
            targetRegionName: '锦州',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '邻近控制区域',
        });
        expect(next.discardPileCount).toBe(9);
        expect(next.factions.ming.handCount).toBe(1);
        expect(next.actionLog[0]?.text).toContain('进入 联姻待结算');
    });

    it('联姻诱降不能指定首都区域，且不会消耗手牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.selectedRegionId = 'city-region-29';
        core.actionChoices = getActionChoicesForFaction('jin');
        core.selectedActionId = 'marriage-subjugation';

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'marriage-subjugation' },
        });

        expect(next.pendingTargetAction).toBeNull();
        expect(next.discardPileCount).toBe(core.discardPileCount);
        expect(next.factions.jin.handCount).toBe(core.factions.jin.handCount);
        expect(next.factionActionUsed).toBe(false);
        expect(next.lastSeasonSummary?.title).toBe('联姻诱降');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('首都');
        expect(next.actionLog[0]?.text).toContain('不能指定首都');
    });

    it('联姻诱降不能指定朝鲜区域，且不会消耗手牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.selectedRegionId = 'xian-xing';
        core.actionChoices = getActionChoicesForFaction('jin');
        core.selectedActionId = 'marriage-subjugation';

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'marriage-subjugation' },
        });

        expect(next.pendingTargetAction).toBeNull();
        expect(next.discardPileCount).toBe(core.discardPileCount);
        expect(next.factions.jin.handCount).toBe(core.factions.jin.handCount);
        expect(next.factionActionUsed).toBe(false);
        expect(next.lastSeasonSummary?.title).toBe('联姻诱降');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('朝鲜/长城以南');
        expect(next.actionLog[0]?.text).toContain('朝鲜/长城以南');
    });

    it('联姻诱降不能指定长城以南区域，且不会消耗手牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.selectedRegionId = 'city-region-28';
        core.actionChoices = getActionChoicesForFaction('jin');
        core.selectedActionId = 'marriage-subjugation';

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'marriage-subjugation' },
        });

        expect(next.pendingTargetAction).toBeNull();
        expect(next.discardPileCount).toBe(core.discardPileCount);
        expect(next.factions.jin.handCount).toBe(core.factions.jin.handCount);
        expect(next.factionActionUsed).toBe(false);
        expect(next.lastSeasonSummary?.title).toBe('联姻诱降');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('长城以南');
        expect(next.actionLog[0]?.text).toContain('长城以南');
    });

    it('联姻诱降不能指定围城区域，且不会消耗手牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.selectedRegionId = 'city-region-19';
        core.actionChoices = getActionChoicesForFaction('jin');
        core.selectedActionId = 'marriage-subjugation';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion || region.id !== 'city-region-19') {
                return region;
            }
            return {
                ...region,
                controller: 'ming',
                controlLabel: '大明',
                siegeState: {
                    attackerFactionId: 'jin',
                    attackerTroops: 2,
                    attackerSpecialTroops: [],
                    sourceRegionId: 'city-region-25',
                },
            };
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'marriage-subjugation' },
        });

        expect(next.pendingTargetAction).toBeNull();
        expect(next.discardPileCount).toBe(core.discardPileCount);
        expect(next.factions.jin.handCount).toBe(core.factions.jin.handCount);
        expect(next.factionActionUsed).toBe(false);
        expect(next.lastSeasonSummary?.title).toBe('联姻诱降');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('围城');
        expect(next.actionLog[0]?.text).toContain('围城');
    });

    it('轮盘和势力行动都完成后会推进到下一位势力玩家', () => {
        const recruiting = apply(QidahenDomain.setup(['0', '1', '2'], random), {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        });
        const recruited = apply(recruiting, {
            type: QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE,
            playerId: '0',
            payload: { choiceId: 'level-2-troops' },
        });

        expect(recruited.currentPlayer).toBe('0');
        expect(recruited.factionActionUsed).toBe(true);
        expect(recruited.wheelActionUsed).toBe(false);

        const next = apply(recruited, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        expect(next.currentPlayer).toBe('1');
        expect(next.roundNumber).toBe(1);
        expect(next.turnPhase).toBe('action-window');
        expect(next.selectedRegionId).toBe('city-region-14');
        expect(next.factionActionUsed).toBe(false);
        expect(next.wheelActionUsed).toBe(false);
        expect(next.actionChoices.map((action) => action.label)).toEqual([
            '升级军备',
            '突袭作战',
            '马市贸易',
            '大汗令箭',
        ]);
        expect(next.turnLabel).toContain('蒙古');
    });

    it('进入势力行动窗口时会要求玩家选择超限弃牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const mongolCards = factionHandCards(core, 'mongol');
        const extraMongolCards = Array.from({ length: 6 }, (_, index) => ({
            ...mongolCards[index % mongolCards.length],
            id: `mongol-over-limit-${index + 1}`,
            label: `蒙古超限手牌 ${index + 1}`,
            status: 'payable' as const,
        }));
        const overloadedCore: QidahenCore = {
            ...core,
            factions: {
                ...core.factions,
                mongol: {
                    ...core.factions.mongol,
                    handCount: 12,
                    discardPileCount: 1,
                },
            },
            handCards: [...core.handCards, ...extraMongolCards],
        };

        expect(factionHandCards(overloadedCore, 'mongol')).toHaveLength(12);

        const recruiting = apply(overloadedCore, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        });
        const recruited = apply(recruiting, {
            type: QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE,
            playerId: '0',
            payload: { choiceId: 'level-2-troops' },
        });
        const next = apply(recruited, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        expect(next.currentPlayer).toBe('1');
        expect(next.turnPhase).toBe('hand-limit-discard');
        expect(next.handLimitDiscardSelection).toMatchObject({
            factionId: 'mongol',
            handLimit: 10,
            handCount: 12,
            requiredDiscardCount: 2,
            selectedCardIds: [],
        });
        expect(factionHandCards(next, 'mongol')).toHaveLength(12);
        expect(next.actionLog.map((log) => log.text).join(' | ')).toContain('手牌超过上限 10，需要选择弃掉 2 张牌');

        const [firstCard, secondCard] = next.handLimitDiscardSelection?.candidateCardIds ?? [];
        expect(firstCard).toBeTruthy();
        expect(secondCard).toBeTruthy();
        const selectedOne = apply(next, {
            type: QIDAHEN_COMMANDS.SELECT_HAND_LIMIT_DISCARD_CARD,
            playerId: '1',
            payload: { cardId: firstCard },
        });
        expect(selectedOne.handLimitDiscardSelection?.selectedCardIds).toEqual([firstCard]);
        const selectedTwo = apply(selectedOne, {
            type: QIDAHEN_COMMANDS.SELECT_HAND_LIMIT_DISCARD_CARD,
            playerId: '1',
            payload: { cardId: secondCard },
        });
        expect(selectedTwo.handLimitDiscardSelection?.selectedCardIds).toEqual([firstCard, secondCard]);
        const resolved = apply(selectedTwo, {
            type: QIDAHEN_COMMANDS.RESOLVE_HAND_LIMIT_DISCARD,
            playerId: '1',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.handLimitDiscardSelection).toBeNull();
        expect(resolved.factions.mongol.handCount).toBe(10);
        expect(resolved.factions.mongol.discardPileCount).toBe(3);
        expect(factionHandCards(resolved, 'mongol')).toHaveLength(10);
        expect(factionHandCards(resolved, 'mongol').some((card) => card.id === firstCard || card.id === secondCard)).toBe(false);
        expect(resolved.actionLog.map((log) => log.text).join(' | ')).toContain('已按手牌上限弃掉 2 张牌');
    });

    it('超限弃牌等待选择时点逻辑区辽西，不会把 selectedRegionId 漂离当前焦点', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const extraMongolCards = Array.from({ length: 4 }, (_, index) => ({
            id: `mongol-overflow-card-${index + 1}`,
            faction: 'mongol' as const,
            status: 'available' as const,
        }));
        const overloadedCore: QidahenCore = {
            ...core,
            factions: {
                ...core.factions,
                mongol: {
                    ...core.factions.mongol,
                    handCount: 12,
                    discardPileCount: 1,
                },
            },
            handCards: [...core.handCards, ...extraMongolCards],
        };

        const recruiting = apply(overloadedCore, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        });
        const recruited = apply(recruiting, {
            type: QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE,
            playerId: '0',
            payload: { choiceId: 'level-2-troops' },
        });
        const pending = apply(recruited, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        expect(pending.turnPhase).toBe('hand-limit-discard');
        const anchoredRegionId = pending.selectedRegionId;

        const reselected = apply(pending, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'liao-xi' },
        });

        expect(reselected.turnPhase).toBe('hand-limit-discard');
        expect(reselected.selectedRegionId).toBe(anchoredRegionId);
        expect(reselected.handLimitDiscardSelection).toMatchObject({
            factionId: 'mongol',
            requiredDiscardCount: 2,
        });
    });

    it('进入下一势力行动窗口时若该势力仍有 siegeState 围城军，会优先选中被围城城市', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [],
                    },
                    siegeState: {
                        attackerFactionId: 'mongol',
                        attackerTroops: 3,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-14',
                    },
                };
            }
            if (region.controller === 'mongol') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    siegeState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const recruiting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        });
        const recruited = apply(recruiting, {
            type: QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE,
            playerId: '0',
            payload: { choiceId: 'level-2-troops' },
        });
        const next = apply(recruited, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        expect(next.currentPlayer).toBe('1');
        expect(next.turnPhase).toBe('action-window');
        expect(next.selectedRegionId).toBe('city-region-24');
        expect(next.actionChoices.map((choice) => choice.id)).toEqual([
            'upgrade-armament',
            'raid',
            'ma-shi-trade',
            'khan-edict',
        ]);
    });

    it('进入下一势力行动窗口时不会默认选中己方被围城市，而会优先落到可操作的非围城控制区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 4,
                        population: 2,
                        specialTroops: [],
                    },
                    siegeState: {
                        attackerFactionId: 'jin',
                        attackerTroops: 2,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-20',
                    },
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 2,
                    population: 1,
                    specialTroops: [],
                    cityState: null,
                    siegeState: null,
                };
            }
            if (region.controller === 'mongol' && region.id !== 'city-region-24' && region.id !== 'city-region-14') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    siegeState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const recruiting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        });
        const recruited = apply(recruiting, {
            type: QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE,
            playerId: '0',
            payload: { choiceId: 'level-2-troops' },
        });
        const next = apply(recruited, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        expect(next.currentPlayer).toBe('1');
        expect(next.turnPhase).toBe('action-window');
        expect(next.selectedRegionId).toBe('city-region-14');
        expect(next.actionChoices.map((choice) => choice.id)).toEqual([
            'upgrade-armament',
            'raid',
            'ma-shi-trade',
            'khan-edict',
        ]);
    });

    it('进入下一势力行动窗口时不会默认选中己方附庸区，而会优先落到可建军的本土控制区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.factionActionUsed = true;
        core.selectedActionId = 'marriage-subjugation';
        core.actionChoices = getActionChoicesForFaction('jin');
        core.payment = {
            required: 1,
            selected: 0,
            prompt: '需弃 1 / 已选 0',
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-22') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明附庸',
                    diplomacyMarkerFaction: 'ming',
                    diplomacyMarkerSide: 'vassal',
                    troops: 4,
                    population: 0,
                    specialTroops: [],
                };
            }
            if (region.id === 'song-jin') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                    troops: 2,
                    population: 0,
                    specialTroops: [],
                };
            }
            if (region.controller === 'ming' && region.id !== 'city-region-22' && region.id !== 'song-jin') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    siegeState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '2',
            payload: { moveId: 'move-1-free' },
        });

        expect(next.currentPlayer).toBe('0');
        expect(next.turnPhase).toBe('action-window');
        expect(next.selectedRegionId).toBe('song-jin');
        expect(next.selectedActionId).toBe('grant-pardon');
        expect(next.actionChoices.map((choice) => choice.id)).toEqual([
            'upgrade-armament',
            'raid',
            'recruit',
            'grant-pardon',
            'drive-tiger',
        ]);
    });

    it('进入下一势力行动窗口时若该势力只剩被围城市，会按 cityState 守军优先选中较强控制区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.factions = {
            ...core.factions,
            mongol: {
                ...core.factions.mongol,
                characters: core.factions.mongol.characters.map((character) => ({
                    ...character,
                    inPlay: false,
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 4,
                        population: 2,
                        specialTroops: [],
                    },
                    siegeState: {
                        attackerFactionId: 'jin',
                        attackerTroops: 2,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-20',
                    },
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 1,
                        population: 1,
                        specialTroops: [],
                    },
                    siegeState: {
                        attackerFactionId: 'jin',
                        attackerTroops: 1,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-20',
                    },
                };
            }
            if (region.controller === 'mongol' && region.id !== 'city-region-24' && region.id !== 'city-region-25') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    siegeState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const recruiting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        });
        const recruited = apply(recruiting, {
            type: QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE,
            playerId: '0',
            payload: { choiceId: 'level-2-troops' },
        });
        const next = apply(recruited, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        expect(next.currentPlayer).toBe('1');
        expect(next.turnPhase).toBe('action-window');
        expect(next.selectedRegionId).toBe('city-region-24');
    });

    it('突袭待结算会阻塞轮转，直到完成当前结算后才能继续本回合', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'city-region-24', 'ming', 2);
        core.selectedRegionId = 'city-region-24';

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'raid' },
        });

        expect(pending.pendingTargetAction).not.toBeNull();
        expect(pending.turnPhase).toBe('resolve-pending');
        expect(pending.currentPlayer).toBe('0');

        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.pendingTargetAction).toBeNull();
        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.selectedRegionId).toBe('city-region-24');
        expect(resolved.currentPlayer).toBe('0');
        expect(resolved.factionActionUsed).toBe(true);

        const next = apply(resolved, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        expect(next.currentPlayer).toBe('1');
        expect(next.turnLabel).toContain('蒙古');
    });

    it('轮盘走到进攻调度时会先进入目标选择，再按 travelCost 生成待结算', () => {
        const sourceSelected = apply(setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'city-region-24', 'ming', 2), {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-24' },
        });

        const targeting = apply(sourceSelected, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        expect(targeting.turnPhase).toBe('dispatch-targeting');
        expect(targeting.pendingTargetAction).toBeNull();
        expect(targeting.factions.mongol.handCount).toBe(8);
        expect(targeting.factions.mongol.drawPileCount).toBe(18);
        expect(factionHandCards(targeting, 'mongol')).toHaveLength(8);
        expect(targeting.factions.jin.handCount).toBe(12);
        expect(targeting.factions.jin.drawPileCount).toBe(18);
        expect(factionHandCards(targeting, 'jin')).toHaveLength(12);
        expect(targeting.wheelDispatchSelection).toMatchObject({
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            restriction: '轮盘进攻/调度 · 调骑 4',
        });
        expect(targeting.wheelDispatchSelection?.candidates.find((candidate) => candidate.targetRuntimeRegionId === 'city-region-20')).toMatchObject({
            targetRuntimeRegionId: 'city-region-20',
            targetRegionName: '土默特部',
            sourceAvailableTroops: 2,
            committedTroops: 2,
            attackPressure: 2,
            boundaryUnitCap: null,
        });

        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        });

        expect(pending.turnPhase).toBe('resolve-pending');
        expect(pending.selectedRegionId).toBe('city-region-20');
        expect(pending.wheelDispatchSelection).toBeNull();
        expect(pending.pendingTargetAction).toMatchObject({
            actionId: 'wheel-dispatch',
            title: '调度进攻待结算',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRuntimeRegionId: 'city-region-20',
            targetRegionName: '土默特部',
            restriction: '轮盘进攻/调度 · 调骑 4',
            sourceAvailableTroops: 2,
            committedTroops: 2,
            attackPressure: 2,
            boundaryUnitCap: null,
        });
        expect(pending.pendingTargetAction?.resolutionHint).toContain('耗2');
        expect(pending.pendingTargetAction?.resolutionHint).toContain('宁远');
        expect(pending.pendingTargetAction?.resolutionHint).toContain('土默特部');
        expect(pending.pendingTargetAction?.resolutionHint).toContain('投2/压2');
        expect(pending.currentPlayer).toBe('0');
        expect(pending.wheelActionUsed).toBe(true);
        expect(pending.actionLog[0]?.text).toContain('锁定调度目标');
    });

    it('调度进攻待结算时点逻辑区辽西，不会把 selectedRegionId 漂离真实待结算目标区', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'city-region-24', 'ming', 2);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });
        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        });

        expect(pending.turnPhase).toBe('resolve-pending');
        expect(pending.selectedRegionId).toBe('city-region-20');
        expect(pending.pendingTargetAction?.targetRuntimeRegionId).toBe('city-region-20');

        const reselected = apply(pending, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'liao-xi' },
        });

        expect(reselected.turnPhase).toBe('resolve-pending');
        expect(reselected.selectedRegionId).toBe('city-region-20');
        expect(reselected.pendingTargetAction).toMatchObject({
            targetRuntimeRegionId: 'city-region-20',
            targetRegionName: '土默特部',
        });

        const resolved = apply(reselected, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-20');
        expect(resolved.postBattleSelection?.targetRuntimeRegionId).toBe('city-region-20');
    });

    it('轮盘调骑目标选择中点到只有步兵的己方区域时，会回退到更优的合法骑兵来源区', () => {
        const core = setRegionCavalry(setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'city-region-24', 'ming', 1), 'jinzhou', 'ming', 3);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    specialTroops: [
                        {
                            id: 'ming-city-region-14-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 2,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.controller === 'ming' && region.id !== 'city-region-24' && region.id !== 'jinzhou' && region.id !== 'city-region-14') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    siegeState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        expect(targeting.turnPhase).toBe('dispatch-targeting');
        expect(targeting.wheelDispatchSelection).toMatchObject({
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
        });

        const rebound = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-14' },
        });

        expect(rebound.turnPhase).toBe('dispatch-targeting');
        expect(rebound.selectedRegionId).toBe('jinzhou');
        expect(rebound.wheelDispatchSelection).toMatchObject({
            sourceRegionId: 'jinzhou',
            sourceRegionName: '锦州',
        });
        expect(rebound.wheelDispatchSelection?.candidates.length).toBeGreaterThan(0);
    });

    it('轮盘调骑目标选择中点到逻辑区辽西时，会把 selectedRegionId 收到真实运行时目标区', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'jinzhou', 'ming', 2);
        core.selectedRegionId = 'jinzhou';

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        expect(targeting.turnPhase).toBe('dispatch-targeting');
        expect(targeting.selectedRegionId).toBe('jinzhou');
        expect(targeting.wheelDispatchSelection?.candidates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                targetRegionId: 'city-region-19',
                targetRuntimeRegionId: 'city-region-19',
                targetRegionName: '辽西',
            }),
        ]));

        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'liao-xi' },
        });

        expect(pending.turnPhase).toBe('resolve-pending');
        expect(pending.selectedRegionId).toBe('city-region-19');
        expect(pending.wheelDispatchSelection).toBeNull();
        expect(pending.pendingTargetAction).toMatchObject({
            actionId: 'wheel-dispatch',
            sourceRegionId: 'jinzhou',
            sourceRegionName: '锦州',
            targetRegionId: 'city-region-19',
            targetRegionName: '辽西',
            targetRuntimeRegionId: 'city-region-19',
        });
        expect(pending.actionLog[0]?.text).toContain('辽西');
    });

    it('轮盘调骑开始时若当前选中区没有合法骑兵来源，会同步把 selectedRegionId 收到回退后的真实来源区', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'jinzhou', 'ming', 3);
        core.selectedRegionId = 'city-region-14';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    specialTroops: [
                        {
                            id: 'ming-city-region-14-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 2,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.controller === 'ming' && region.id !== 'jinzhou' && region.id !== 'city-region-14') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    siegeState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        expect(targeting.turnPhase).toBe('dispatch-targeting');
        expect(targeting.selectedRegionId).toBe('jinzhou');
        expect(targeting.wheelDispatchSelection).toMatchObject({
            sourceRegionId: 'jinzhou',
            sourceRegionName: '锦州',
        });
        expect(targeting.wheelDispatchSelection?.candidates.length).toBeGreaterThan(0);
    });

    it('调骑 4 在结构化兵种区域只会投入骑兵，不会拿步兵冒充骑兵', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-16';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    specialTroops: [
                        {
                            id: 'ming-cavalry-lv2',
                            label: '大明骑兵',
                            faction: 'ming',
                            troopKind: 'cavalry',
                            count: 1,
                            level: 2,
                        },
                        {
                            id: 'ming-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 2,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 1,
                    population: 0,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        const candidate = targeting.wheelDispatchSelection?.candidates.find((item) => item.targetRuntimeRegionId === 'city-region-14');
        expect(targeting.turnPhase).toBe('dispatch-targeting');
        expect(targeting.wheelDispatchSelection?.restriction).toBe('轮盘进攻/调度 · 调骑 4');
        expect(candidate).toMatchObject({
            sourceAvailableTroops: 1,
            committedTroops: 1,
            attackPressure: 1,
        });
        expect(candidate?.resolutionHint).toContain('投1/压1');
    });

    it('调骑 4 占领空区时会转移骑兵栈，而不是转移高等级步兵栈', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-16';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    specialTroops: [
                        {
                            id: 'ming-infantry-lv4',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 2,
                            level: 4,
                        },
                        {
                            id: 'ming-cavalry-lv2',
                            label: '大明骑兵',
                            faction: 'ming',
                            troopKind: 'cavalry',
                            count: 1,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });
        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-14' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });
        const occupied = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy' },
        });

        expect(occupied.regions.find((region) => region.id === 'city-region-16')).toMatchObject({
            troops: 2,
            specialTroops: [
                {
                    id: 'ming-infantry-lv4',
                    label: '大明步兵',
                    faction: 'ming',
                    troopKind: 'infantry',
                    count: 2,
                    level: 4,
                },
            ],
        });
        expect(occupied.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            controller: 'ming',
            troops: 1,
            specialTroops: [
                {
                    id: 'ming-cavalry-lv2',
                    label: '大明骑兵',
                    faction: 'ming',
                    troopKind: 'cavalry',
                    count: 1,
                    level: 2,
                },
            ],
        });
    });

    it('调步 2 占领空区时不会把骑兵栈当作步兵转移', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-recruit-train';
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    specialTroops: [
                        {
                            id: 'ming-cavalry-lv4',
                            label: '大明骑兵',
                            faction: 'ming',
                            troopKind: 'cavalry',
                            count: 1,
                            level: 4,
                        },
                        {
                            id: 'ming-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 2,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const candidate = targeting.wheelDispatchSelection?.candidates.find((item) => item.targetRuntimeRegionId === 'city-region-20');
        expect(targeting.wheelDispatchSelection?.restriction).toBe('轮盘进攻/调度 · 调步 2');
        expect(candidate).toMatchObject({
            sourceAvailableTroops: 2,
            committedTroops: 2,
            attackPressure: 2,
        });

        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });
        const occupied = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy' },
        });

        expect(occupied.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 1,
            specialTroops: [
                {
                    id: 'ming-cavalry-lv4',
                    label: '大明骑兵',
                    faction: 'ming',
                    troopKind: 'cavalry',
                    count: 1,
                    level: 4,
                },
            ],
        });
        expect(occupied.regions.find((region) => region.id === 'city-region-20')).toMatchObject({
            controller: 'ming',
            troops: 2,
            specialTroops: [
                {
                    id: 'ming-infantry-lv2',
                    label: '大明步兵',
                    faction: 'ming',
                    troopKind: 'infantry',
                    count: 2,
                    level: 2,
                },
            ],
        });
    });

    it('结构化区域没有骑兵时不会进入调骑 4 目标选择', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-16';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    specialTroops: [
                        {
                            id: 'ming-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 3,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 1,
                    population: 0,
                };
            }
            return region;
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        expect(next.turnPhase).toBe('action-window');
        expect(next.wheelDispatchSelection).toBeNull();
        expect(next.pendingTargetAction).toBeNull();
    });

    it('调度目标选择不会把己方友好区列为可攻击目标', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-recruit-train';
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                };
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'neutral',
                    diplomacyMarkerFaction: 'ming',
                    diplomacyMarkerSide: 'friendly',
                    controlLabel: '大明友好',
                    troops: 0,
                };
            }
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        expect(targeting.turnPhase).toBe('dispatch-targeting');
        expect(targeting.wheelDispatchSelection?.candidates.some((candidate) => candidate.targetRuntimeRegionId === 'city-region-16')).toBe(false);
        expect((targeting.wheelDispatchSelection?.candidates.length ?? 0)).toBeGreaterThan(0);
        expect(targeting.wheelDispatchSelection?.candidates.some((candidate) => candidate.targetRuntimeRegionId === 'city-region-20')).toBe(true);
    });

    it('调度进攻打入中立区时会按人口生成中立守军并在未突破时保留中立控制', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'city-region-24', 'ming', 1);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 3,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        expect(targeting.wheelDispatchSelection?.candidates.some((candidate) => candidate.targetRuntimeRegionId === 'city-region-20')).toBe(true);

        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        });

        expect(pending.pendingTargetAction?.targetRuntimeRegionId).toBe('city-region-20');

        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-20')).toMatchObject({
            controller: 'neutral',
            controlLabel: '中立',
            troops: 2,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-20')?.note).toContain('中立守军');
        expect(resolved.pendingTargetAction).toBeNull();
    });

    it('进攻压力会受实际可投入兵力截断，而不是只看边界宽度', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'city-region-24', 'ming', 1);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    troops: 1,
                };
            }
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 3,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        });

        expect(pending.pendingTargetAction).toMatchObject({
            sourceAvailableTroops: 1,
            committedTroops: 1,
            attackPressure: 1,
            boundaryUnitCap: null,
        });

        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-20')).toMatchObject({
            controller: 'neutral',
            controlLabel: '中立',
            troops: 2,
        });
        expect(resolved.actionLog[0]?.text).toContain('投入 1 部队');
    });

    it('调度进攻攻下空区后会进入战后处理，并在占领后把已投入部队从源区移入目标区', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'city-region-24', 'ming', 2);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        });

        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-20');
        expect(resolved.postBattleSelection).toMatchObject({
            targetRuntimeRegionId: 'city-region-20',
            committedTroops: 2,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 2,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-20')).toMatchObject({
            controller: 'neutral',
            controlLabel: '中立',
            troops: 0,
        });

        const occupied = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy' },
        });

        expect(occupied.selectedRegionId).toBe('city-region-20');
        expect(occupied.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 0,
        });
        expect(occupied.regions.find((region) => region.id === 'city-region-20')).toMatchObject({
            controller: 'ming',
            controlLabel: '大明附庸',
            diplomacyMarkerFaction: 'ming',
            diplomacyMarkerSide: 'vassal',
            troops: 2,
        });
        expect(occupied.regions.find((region) => region.id === 'city-region-20')?.note).toContain('进驻 2 个幸存部队');
        expect(occupied.mapTokens.find((token) => token.id === 'diplomacy-marker-city-region-20')).toMatchObject({
            faction: 'ming',
            imageSrc: 'qidahen/markers/ming-control-diplomacy-marker-a',
        });
    });

    it('战后处理等待选择时点逻辑区辽西，不会把 selectedRegionId 漂离真实战场目标区', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'city-region-24', 'ming', 2);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });
        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-20');
        expect(resolved.postBattleSelection?.targetRuntimeRegionId).toBe('city-region-20');

        const reselected = apply(resolved, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'liao-xi' },
        });

        expect(reselected.turnPhase).toBe('post-battle-decision');
        expect(reselected.selectedRegionId).toBe('city-region-20');
        expect(reselected.postBattleSelection).toMatchObject({
            targetRuntimeRegionId: 'city-region-20',
            targetRegionName: '土默特部',
        });
    });

    it('战后处理可按人口数量选择劫掠并按低保真抽牌结算', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-24';
        core.actionWheelPosition = 'wheel-recruit-train';
        core.regions = core.regions.map((region) => {
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 6,
                    population: 0,
                };
            }
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 3,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.postBattleSelection?.choices.find((choice) => choice.id === 'occupy-plunder-3')).toMatchObject({
            mode: 'occupy',
            plunderPopulation: 3,
        });

        const occupied = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy-plunder-3' },
        });

        expect(occupied.regions.find((region) => region.id === 'city-region-20')).toMatchObject({
            controller: 'ming',
            controlLabel: '大明附庸',
            population: 0,
            troops: 3,
        });
        expect(occupied.factions.ming.handCount).toBe(core.factions.ming.handCount + 3);
        expect(occupied.drawPileCount).toBe(core.drawPileCount - 6);
        expect(occupied.discardPileCount).toBe(core.discardPileCount + 3);
        expect(occupied.handCards.length).toBe(core.handCards.length + 3);
        expect(occupied.regions.find((region) => region.id === 'city-region-20')?.note).toContain('劫掠移除 3 人口');
        expect(occupied.actionLog[0]?.text).toContain('劫掠');
        expect(occupied.lastSeasonSummary?.lines.some((line) => line.includes('劫掠移除 3 人口'))).toBe(true);
    });

    it('战后处理可选择抽被占领者牌堆进行劫掠', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-24';
        core.actionWheelPosition = 'wheel-recruit-train';
        core.regions = core.regions.map((region) => {
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 6,
                    population: 0,
                };
            }
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 1,
                    population: 2,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.postBattleSelection?.choices.find((choice) => choice.id === 'occupy-plunder-defender-2')).toMatchObject({
            mode: 'occupy',
            plunderPopulation: 2,
            plunderSource: 'defender',
        });

        const occupied = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy-plunder-defender-2' },
        });

        expect(occupied.regions.find((region) => region.id === 'city-region-20')).toMatchObject({
            controller: 'ming',
            controlLabel: '大明',
            population: 0,
            troops: 5,
        });
        expect(occupied.factions.ming.handCount).toBe(core.factions.ming.handCount + 2);
        expect(occupied.drawPileCount).toBe(core.drawPileCount);
        expect(occupied.factions.ming.drawPileCount).toBe(core.factions.ming.drawPileCount);
        expect(occupied.factions.jin.drawPileCount).toBe(core.factions.jin.drawPileCount - 2);
        expect(occupied.discardPileCount).toBe(core.discardPileCount);
        expect(occupied.factions.ming.discardPileCount).toBe(core.factions.ming.discardPileCount);
        expect(occupied.factions.jin.discardPileCount).toBe(core.factions.jin.discardPileCount);
        expect(occupied.handCards.length).toBe(core.handCards.length + 2);
        expect(occupied.actionLog[0]?.text).toContain('抽后金牌堆获得 2 张手牌');
    });

    it('朝鲜区域即使有异常人口数据也不会生成劫掠选项', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-diplomacy';
        core.selectedRegionId = 'city-region-5';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-5') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 6,
                    population: 0,
                };
            }
            if (region.id === 'xian-xing') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 1,
                    population: 3,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'xian-xing' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.postBattleSelection?.targetRuntimeRegionId).toBe('xian-xing');
        expect(resolved.postBattleSelection?.choices.map((choice) => choice.id)).toEqual(expect.arrayContaining([
            'occupy',
            'withdraw:city-region-5',
        ]));
        expect(resolved.postBattleSelection?.choices.some((choice) => choice.plunderPopulation > 0)).toBe(false);

        const occupied = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy' },
        });

        expect(occupied.factions.ming.handCount).toBe(core.factions.ming.handCount + 1);
        expect(occupied.koreaDeckCount).toBe(core.koreaDeckCount - 1);
        expect(occupied.actionLog[0]?.text).toContain('抽朝鲜牌 1 张');
    });

    it('阿敏在场时后金攻陷朝鲜区域会额外多抽 1 张朝鲜牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.actionWheelPosition = 'wheel-diplomacy';
        core.selectedRegionId = 'city-region-5';
        core.factions = {
            ...core.factions,
            jin: {
                ...core.factions.jin,
                characters: core.factions.jin.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'jin-amin',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-5') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 6,
                    population: 0,
                };
            }
            if (region.id === 'xian-xing') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 0,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '2',
            payload: { moveId: 'move-1-free' },
        });
        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '2',
            payload: { regionId: 'xian-xing' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: {},
        });
        const occupied = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '2',
            payload: { choiceId: 'occupy' },
        });

        expect(occupied.factions.jin.handCount).toBe(core.factions.jin.handCount + 2);
        expect(occupied.koreaDeckCount).toBe(core.koreaDeckCount - 2);
        expect(occupied.actionLog[0]?.text).toContain('抽朝鲜牌 2 张');
    });

    it('战后可选择放弃占领并退回相邻友方区域', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'city-region-24', 'ming', 2);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });
        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        const withdrawn = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'withdraw:city-region-24' },
        });

        expect(withdrawn.selectedRegionId).toBe('city-region-24');
        expect(withdrawn.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 2,
        });
        expect(withdrawn.regions.find((region) => region.id === 'city-region-20')).toMatchObject({
            controller: 'neutral',
            controlLabel: '中立',
            troops: 0,
        });
        expect(withdrawn.actionLog[0]?.text).toContain('放弃占领');
    });

    it('战后放弃占领并退回己方围城城市时，会直接并入 siegeState 而不是落到城市顶层', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.postBattleSelection = {
            actionId: 'raid',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRegionId: 'city-region-20',
            targetRegionName: '土默特部',
            targetRuntimeRegionId: 'city-region-20',
            committedTroops: 3,
            survivingTroops: 2,
            attackerLosses: 1,
            movementProfileId: null,
            attackerCasualtyPriority: 'highest-level',
            originalController: 'neutral',
            originalControlLabel: '中立',
            title: '战后处理',
            summary: '测试',
            choices: [
                {
                    id: 'withdraw:city-region-25',
                    mode: 'withdraw',
                    regionId: 'city-region-25',
                    plunderPopulation: 0,
                    plunderSource: null,
                    label: '回退山海关',
                    detail: '测试',
                },
            ],
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [
                        { id: 'ming-ningyuan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 3, level: 1 },
                        { id: 'ming-ningyuan-cavalry-lv2', label: '大明骑兵', faction: 'ming', troopKind: 'cavalry', count: 1, level: 2 },
                    ],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'ming',
                        attackerTroops: 2,
                        attackerSpecialTroops: [
                            { id: 'ming-shanhaiguan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 1 },
                        ],
                        sourceRegionId: 'city-region-24',
                    },
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const withdrawn = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'withdraw:city-region-25' },
        });

        expect(withdrawn.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 1,
        });
        expect(withdrawn.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            troops: 0,
            population: 0,
            siegeState: {
                attackerFactionId: 'ming',
                attackerTroops: 4,
                attackerSpecialTroops: [
                    expect.objectContaining({ id: 'ming-shanhaiguan-infantry-lv1', count: 2 }),
                    expect.objectContaining({ id: 'ming-ningyuan-infantry-lv1', count: 2 }),
                ],
            },
            cityState: {
                troops: 2,
                population: 2,
                specialTroops: [],
            },
        });
        expect(withdrawn.actionLog[0]?.text).toContain('撤回 山海关');
    });

    it('战后处理会把相邻友好区也列为可回退目标', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-recruit-train';
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                };
            }
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                };
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'neutral',
                    diplomacyMarkerFaction: 'ming',
                    diplomacyMarkerSide: 'friendly',
                    controlLabel: '大明友好',
                    troops: 0,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.postBattleSelection?.choices.some((choice) => choice.id === 'withdraw:city-region-16')).toBe(true);

        const withdrawn = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'withdraw:city-region-16' },
        });

        expect(withdrawn.selectedRegionId).toBe('city-region-16');
        expect(withdrawn.regions.find((region) => region.id === 'city-region-16')).toMatchObject({
            controlLabel: '大明友好',
            troops: 4,
        });
        expect(withdrawn.regions.find((region) => region.id === 'city-region-20')).toMatchObject({
            controller: 'neutral',
            controlLabel: '中立',
            troops: 0,
        });
    });

    it('战斗胜负会按剩余部队数判定，攻方即使未杀光守军也可突破进入战后处理', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-recruit-train';
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 6,
                };
            }
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 4,
                    population: 0,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-20');
        expect(resolved.postBattleSelection).toMatchObject({
            targetRuntimeRegionId: 'city-region-20',
            survivingTroops: 3,
            attackerLosses: 3,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-20')).toMatchObject({
            controller: 'neutral',
            controlLabel: '中立',
            troops: 0,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-20')?.note).toContain('兵力劣势');
        expect(resolved.actionLog[0]?.text).toContain('以 3 比 1 压倒守军');
    });

    it('战斗双方剩余兵力相同时守方获胜，攻方必须撤退', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-recruit-train';
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 4,
                    specialTroops: [],
                    population: 0,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.selectedRegionId).toBe('city-region-24');
        expect(resolved.postBattleSelection).toBeNull();
        expect(resolved.regions.find((region) => region.id === 'city-region-20')).toMatchObject({
            controller: 'neutral',
            controlLabel: '中立',
            troops: 1,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'ming',
            controlLabel: '大明',
            troops: 0,
        });
        expect(resolved.factions.ming.defeatMarkers).toBe(1);
        expect(resolved.actionLog[0]?.text).toContain('守军减员 3，攻方损失 3');
        expect(resolved.actionLog[0]?.text).toContain('撤退断后损失 1');
        expect(resolved.actionLog[0]?.text).not.toContain('战斗掷骰');
    });

    it('结构化川兵会按兵种阶段掷骰结算战斗损伤，而不是只按总兵力处理', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        setFactionCharactersInPlay(core, 'jin', []);
        core.selectedRegionId = 'city-region-14';
        core.selectedActionId = 'raid';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 6,
                    specialTroops: [
                        {
                            id: 'ming-chuanbing-lv4',
                            label: '川兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 2,
                            level: 4,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 5,
                    population: 0,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-17') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'raid' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-14');
        expect(resolved.postBattleSelection).toMatchObject({
            targetRuntimeRegionId: 'city-region-14',
            survivingTroops: 2,
            attackerLosses: 4,
        });
        expect(resolved.actionLog[0]?.text).toContain('战斗掷骰（野战）');
        expect(resolved.actionLog[0]?.text).toContain('攻方造成 4 损伤，守方造成 4 损伤');
        expect(resolved.regions.find((region) => region.id === 'city-region-14')?.note).toContain('撤退断后损失 1');
    });

    it('结构化攻方可选择低级部队优先承伤以保留精锐木块', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 3,
            committedTroops: 3,
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    specialTroops: [
                        {
                            id: 'ming-elite-infantry-lv4',
                            label: '大明精锐步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 1,
                            level: 4,
                        },
                        {
                            id: 'ming-militia-lv1',
                            label: '大明低级步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 2,
                            level: 1,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 1,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'jin-infantry-lv3',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 1,
                            level: 3,
                        },
                    ],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: { attackerCasualtyPriority: 'lowest-level' },
        });
        const occupied = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy' },
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-14');
        expect(resolved.postBattleSelection).toMatchObject({
            attackerLosses: 1,
            attackerCasualtyPriority: 'lowest-level',
            survivingTroops: 2,
        });
        expect(occupied.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            controller: 'ming',
            troops: 2,
            specialTroops: expect.arrayContaining([
                {
                    id: 'ming-elite-infantry-lv4',
                    label: '大明精锐步兵',
                    faction: 'ming',
                    troopKind: 'infantry',
                    count: 1,
                    level: 4,
                },
                {
                    id: 'ming-militia-lv1',
                    label: '大明低级步兵',
                    faction: 'ming',
                    troopKind: 'infantry',
                    count: 1,
                    level: 1,
                },
            ]),
        });
        expect(occupied.regions.find((region) => region.id === 'city-region-16')).toMatchObject({
            troops: 0,
            specialTroops: [],
        });
    });

    it('结构化守方可选择低级部队优先承伤以保留守方精锐木块', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        setFactionCharactersInPlay(core, 'jin', []);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 2,
            committedTroops: 2,
            attackPressure: 2,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    specialTroops: [
                        {
                            id: 'ming-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 2,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 4,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'jin-elite-infantry-lv4',
                            label: '后金精锐步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 1,
                            level: 4,
                        },
                        {
                            id: 'jin-militia-lv1',
                            label: '后金低级步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 2,
                            level: 1,
                        },
                    ],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: { defenderCasualtyPriority: 'lowest-level' },
        });

        const targetRegion = resolved.regions.find((region) => region.id === 'city-region-14');
        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.selectedRegionId).toBe('city-region-16');
        expect(targetRegion).toMatchObject({
            controller: 'jin',
            troops: 2,
            specialTroops: [
                {
                    id: 'jin-elite-infantry-lv4',
                    label: '后金精锐步兵',
                    faction: 'jin',
                    troopKind: 'infantry',
                    count: 1,
                    level: 4,
                },
            ],
        });
        expect(targetRegion?.specialTroops.some((stack) => stack.id === 'jin-militia-lv1')).toBe(false);
        expect(resolved.actionLog[0]?.text).toContain('守军减员 2');
    });

    it('后金步兵铁甲会增强结构化步兵掷骰并进入战斗损伤', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        setFactionCharactersInPlay(core, 'jin', []);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 4,
            boundaryUnitCap: null,
            sourceAvailableTroops: 4,
            committedTroops: 4,
            attackPressure: 4,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [
                        {
                            id: 'ming-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 4,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'jin-infantry-lv2',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 2,
                            level: 2,
                        },
                    ],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.postBattleSelection).toMatchObject({
            attackerLosses: 3,
            survivingTroops: 1,
        });
        expect(resolved.actionLog[0]?.text).toContain('守4->5/4->5=10');
        expect(resolved.actionLog[0]?.text).toContain('守方造成 3 损伤');
    });

    it('努尔哈赤在场时会让后金结构化步兵战斗掷骰等级 +1，最高到 4', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 4,
            boundaryUnitCap: null,
            sourceAvailableTroops: 4,
            committedTroops: 4,
            attackPressure: 4,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.factions = {
            ...core.factions,
            jin: {
                ...core.factions.jin,
                characters: core.factions.jin.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'jin-nurhaci',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [
                        {
                            id: 'ming-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 4,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'jin-infantry-lv3',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 1,
                            level: 3,
                        },
                        {
                            id: 'jin-infantry-lv4',
                            label: '后金精锐步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 1,
                            level: 4,
                        },
                    ],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.actionLog[0]?.text).toContain('守4->5/4->5=10');
        expect(resolved.actionLog[0]?.text).toContain('守方造成 3 损伤');
    });

    it('额亦都在场时会让后金指定同兵种先掷骰，从而先压低对手同兵种回击', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        setFactionCharactersInPlay(core, 'jin', []);
        core.factions.jin.armaments = [];
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 5,
            boundaryUnitCap: null,
            sourceAvailableTroops: 5,
            committedTroops: 5,
            attackPressure: 5,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 5,
                    specialTroops: [
                        {
                            id: 'ming-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 5,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 3,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'jin-infantry-lv2',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 3,
                            level: 2,
                        },
                    ],
                };
            }
            return region;
        });

        const baseline = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        setFactionCharactersInPlay(core, 'jin', ['jin-eidu']);

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(baseline.postBattleSelection).toMatchObject({
            survivingTroops: 1,
            attackerLosses: 4,
        });
        expect(baseline.actionLog[0]?.text).toContain('步兵 攻4/4/4/4/4=20/守4/4/4=12');
        expect(resolved.postBattleSelection).toBeNull();
        expect(resolved.actionLog[0]?.text).toContain('步兵(额亦都指定步兵先掷) 攻4=4/守4/4/4=12');
        expect(resolved.actionLog[0]?.text).toContain('守方造成 4 损伤');
        expect(resolved.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            controller: 'jin',
            troops: 2,
            specialTroops: [
                {
                    id: 'jin-infantry-lv2',
                    label: '后金步兵',
                    faction: 'jin',
                    troopKind: 'infantry',
                    count: 2,
                    level: 2,
                },
            ],
        });
    });

    it('蒙古骑兵铁甲会增强结构化骑兵野战掷骰并进入战斗损伤', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '察哈尔',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'mongol',
            defenderLabel: '蒙古',
            restriction: '测试',
            battleWidth: 4,
            boundaryUnitCap: null,
            sourceAvailableTroops: 4,
            committedTroops: 4,
            attackPressure: 4,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [
                        {
                            id: 'ming-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 4,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 2,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'mongol-cavalry-lv2',
                            label: '蒙古骑兵',
                            faction: 'mongol',
                            troopKind: 'cavalry',
                            count: 2,
                            level: 2,
                        },
                    ],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.postBattleSelection).toMatchObject({
            attackerLosses: 3,
            survivingTroops: 1,
        });
        expect(resolved.actionLog[0]?.text).toContain('骑兵 攻-=0/守4->5/4->5=10');
        expect(resolved.actionLog[0]?.text).toContain('守方造成 3 损伤');
    });

    it('齐赛诺延在场时会让蒙古进攻骑兵按高一级掷骰，最高 4 级', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'mongol',
            sourceRegionId: 'city-region-14',
            sourceRegionName: '察哈尔',
            targetRegionId: 'city-region-13',
            targetRegionName: '建州',
            targetRuntimeRegionId: 'city-region-13',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 2,
            boundaryUnitCap: null,
            sourceAvailableTroops: 2,
            committedTroops: 2,
            attackPressure: 2,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.factions = {
            ...core.factions,
            mongol: {
                ...core.factions.mongol,
                armaments: core.factions.mongol.armaments.map((armament) => (
                    armament.id === 'cavalry-armor'
                        ? { ...armament, level: 0 }
                        : armament
                )),
                characters: core.factions.mongol.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'mongol-qisai-noyan',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 2,
                    specialTroops: [
                        {
                            id: 'mongol-cavalry-lv2',
                            label: '蒙古骑兵',
                            faction: 'mongol',
                            troopKind: 'cavalry',
                            count: 2,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-13') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'jin-infantry-lv1',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 2,
                            level: 1,
                        },
                    ],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '1',
            payload: {},
        }, dieSidesRandom);

        expect(resolved.actionLog[0]?.text).toContain('骑兵 攻10/10=20/守-=0');
        expect(resolved.actionLog[0]?.text).toContain('步兵 攻-=0/守8->9/8->9=18');
        expect(resolved.actionLog[0]?.text).toContain('攻方造成 6 损伤');
    });

    it('孙元化单独在场时不会让大明炮兵战斗掷骰点数加 2', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '察哈尔',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'mongol',
            defenderLabel: '蒙古',
            restriction: '测试',
            battleWidth: 2,
            boundaryUnitCap: null,
            sourceAvailableTroops: 2,
            committedTroops: 2,
            attackPressure: 2,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-sun-yuanhua',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    specialTroops: [
                        {
                            id: 'ming-artillery-lv1',
                            label: '大明炮兵',
                            faction: 'ming',
                            troopKind: 'artillery',
                            count: 1,
                            level: 1,
                        },
                        {
                            id: 'ming-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 1,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 1,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'mongol-infantry-lv1',
                            label: '蒙古步兵',
                            faction: 'mongol',
                            troopKind: 'infantry',
                            count: 1,
                            level: 1,
                        },
                    ],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.actionLog.map((entry) => entry.text).join(' | ')).not.toContain('炮兵 攻4->6=6/守-=0');
    });

    it('孙元化与袁崇焕同时在场时会让大明炮兵战斗掷骰点数加 2', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '察哈尔',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'mongol',
            defenderLabel: '蒙古',
            restriction: '测试',
            battleWidth: 2,
            boundaryUnitCap: null,
            sourceAvailableTroops: 2,
            committedTroops: 2,
            attackPressure: 2,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-sun-yuanhua' || character.id === 'ming-yuan-chonghuan',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    specialTroops: [
                        {
                            id: 'ming-artillery-lv1',
                            label: '大明炮兵',
                            faction: 'ming',
                            troopKind: 'artillery',
                            count: 1,
                            level: 1,
                        },
                        {
                            id: 'ming-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 1,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 1,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'mongol-infantry-lv1',
                            label: '蒙古步兵',
                            faction: 'mongol',
                            troopKind: 'infantry',
                            count: 1,
                            level: 1,
                        },
                    ],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.actionLog.map((entry) => entry.text).join(' | ')).toContain('炮兵 攻4->6=6/守-=0');
        expect(resolved.actionLog.map((entry) => entry.text).join(' | ')).toContain('攻方造成 3 损伤');
    });

    it('待结算进攻可选择少投入部队并按选择数量进入战后处理', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 4,
            committedTroops: 4,
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试：可少投入',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: { committedTroops: 2 },
        });
        const occupied = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy' },
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-14');
        expect(resolved.postBattleSelection).toMatchObject({
            committedTroops: 2,
            survivingTroops: 2,
            attackerLosses: 0,
        });
        expect(resolved.actionLog[0]?.text).toContain('投入 2 部队');
        expect(occupied.regions.find((region) => region.id === 'city-region-16')).toMatchObject({
            troops: 2,
        });
        expect(occupied.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            controller: 'ming',
            troops: 2,
        });
    });

    it('结构化川兵攻下空区后会随幸存部队进驻目标区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-14';
        core.selectedActionId = 'raid';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [
                        {
                            id: 'ming-chuanbing-lv4',
                            label: '川兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 2,
                            level: 4,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'raid' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });
        const occupied = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy' },
        });

        expect(occupied.regions.find((region) => region.id === 'city-region-16')).toMatchObject({
            controller: 'ming',
            troops: 0,
            specialTroops: [],
        });
        expect(occupied.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            controller: 'ming',
            troops: 4,
            specialTroops: [
                {
                    id: 'ming-chuanbing-lv4',
                    label: '川兵',
                    faction: 'ming',
                    troopKind: 'infantry',
                    count: 2,
                    level: 4,
                },
            ],
        });
    });

    it('杨镐在场时大明突袭可指挥最多 10 个部队', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-14';
        core.selectedActionId = 'raid';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-yang-gao',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 10,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 3,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'raid' },
        });

        expect(pending.pendingTargetAction).toMatchObject({
            actionId: 'raid',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-16',
            sourceAvailableTroops: 10,
            committedTroops: 10,
        });
        expect(pending.pendingTargetAction?.resolutionHint).toContain('投10/压');
    });

    it('结构化守军野战败退时会把幸存特殊部队撤到相邻友方区域', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        setFactionCharactersInPlay(core, 'jin', []);
        core.selectedRegionId = 'city-region-14';
        core.selectedActionId = 'raid';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 6,
                    specialTroops: [
                        {
                            id: 'ming-elite-infantry-lv4',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 1,
                            level: 4,
                        },
                        {
                            id: 'ming-chuanbing-lv4',
                            label: '川兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 2,
                            level: 4,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 7,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'jin-infantry-lv1',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 7,
                            level: 1,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-17') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-19' || region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'raid' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        }, diceSequence(4, 4, 4, 1, 1, 1));

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-14');
        expect(resolved.postBattleSelection).toMatchObject({
            targetRuntimeRegionId: 'city-region-14',
            survivingTroops: 4,
            attackerLosses: 2,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            troops: 0,
            specialTroops: [],
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-17')).toMatchObject({
            troops: 4,
            specialTroops: [
                {
                    id: 'jin-infantry-lv1',
                    label: '后金步兵',
                    faction: 'jin',
                    troopKind: 'infantry',
                    count: 2,
                    level: 1,
                },
            ],
        });
        expect(resolved.actionLog[0]?.text).toContain('战斗掷骰（野战）');
        expect(resolved.actionLog[0]?.text).toContain('守军断后损失 1 后撤至 奈曼部');
    });

    it('守军败退后若只剩炮兵没有步骑掩护，炮兵不会撤到友方区域', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        setFactionCharactersInPlay(core, 'jin', []);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 1,
            boundaryUnitCap: null,
            sourceAvailableTroops: 5,
            committedTroops: 5,
            attackPressure: 1,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 5,
                    specialTroops: [
                        {
                            id: 'ming-infantry-lv3',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 1,
                            level: 3,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 3,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'jin-infantry-lv2',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 2,
                            level: 2,
                        },
                        {
                            id: 'jin-artillery-lv1',
                            label: '后金炮兵',
                            faction: 'jin',
                            troopKind: 'artillery',
                            count: 1,
                            level: 1,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-17') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-19' || region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-14');
        expect(resolved.regions.find((region) => region.id === 'city-region-17')).toMatchObject({
            troops: 0,
            specialTroops: [],
        });
        expect(resolved.actionLog[0]?.text).toContain('守军断后损失 1 后无残部可撤');
    });

    it('战斗损伤不会由炮兵承受，炮兵也不计入胜负兵力，步骑全灭后炮兵一并移除', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        setFactionCharactersInPlay(core, 'jin', []);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 1,
            boundaryUnitCap: null,
            sourceAvailableTroops: 1,
            committedTroops: 1,
            attackPressure: 1,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    specialTroops: [
                        {
                            id: 'ming-infantry-lv1',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 1,
                            level: 1,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'jin-infantry-lv1',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 1,
                            level: 1,
                        },
                        {
                            id: 'jin-artillery-lv4',
                            label: '后金炮兵',
                            faction: 'jin',
                            troopKind: 'artillery',
                            count: 1,
                            level: 4,
                        },
                    ],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.selectedRegionId).toBe('city-region-16');
        expect(resolved.postBattleSelection).toBeNull();
        expect(resolved.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            controller: 'jin',
            troops: 0,
            specialTroops: [],
        });
        expect(resolved.actionLog[0]?.text).toContain('守军减员 1');
        expect(resolved.actionLog[0]?.text).not.toContain('等待战后处理');
    });

    it('攻方只剩炮兵时不会因为炮兵幸存而赢得战斗', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 1,
            boundaryUnitCap: null,
            sourceAvailableTroops: 2,
            committedTroops: 2,
            attackPressure: 1,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    specialTroops: [
                        {
                            id: 'ming-artillery-lv4',
                            label: '大明炮兵',
                            faction: 'ming',
                            troopKind: 'artillery',
                            count: 1,
                            level: 4,
                        },
                        {
                            id: 'ming-infantry-lv1',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 1,
                            level: 1,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 1,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'jin-infantry-lv1',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 1,
                            level: 1,
                        },
                    ],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.selectedRegionId).toBe('city-region-16');
        expect(resolved.postBattleSelection).toBeNull();
        expect(resolved.regions.find((region) => region.id === 'city-region-16')).toMatchObject({
            troops: 0,
            specialTroops: [],
        });
        expect(resolved.actionLog[0]?.text).toContain('守军减员 1，攻方损失 1，撤退断后损失 1');
        expect(resolved.actionLog[0]?.text).not.toContain('等待战后处理');
    });

    it('野战守军战败但未死光时会自动断后并把残部撤到相邻友方区域', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-14';
        core.selectedActionId = 'raid';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 6,
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 5,
                    population: 0,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-17') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                };
            }
            if (region.id === 'city-region-19' || region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'raid' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-14');
        expect(resolved.postBattleSelection).toMatchObject({
            targetRuntimeRegionId: 'city-region-14',
            survivingTroops: 3,
            attackerLosses: 3,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            controller: 'jin',
            troops: 0,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-17')?.troops).toBe(3);
        expect(resolved.factions.jin.defeatMarkers).toBe(1);
        expect(resolved.factions.jin.characters.find((character) => character.id === 'jin-nurhaci')?.defeatMarkers).toBe(1);
        expect(resolved.factions.jin.characters.find((character) => character.id === 'jin-eidu')?.defeatMarkers).toBe(0);
        expect(resolved.factions.ming.defeatMarkers).toBe(0);
        expect(resolved.regions.find((region) => region.id === 'city-region-14')?.note).toContain('撤退断后损失 1');
        expect(resolved.regions.find((region) => region.id === 'city-region-14')?.note).toContain('撤退至 奈曼部');
        expect(resolved.actionLog[0]?.text).toContain('守军断后损失 1 后撤至 奈曼部');
        expect(resolved.actionLog[0]?.text).toContain('后金 获得 1 个战败标记');
    });

    it('野战守军自动撤退选区时会按 cityState 合并后的兵力优先选择友方城市', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-14';
        core.selectedActionId = 'raid';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 6,
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 5,
                    population: 0,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-17') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                    population: 0,
                    cityState: null,
                };
            }
            if (region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 4,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            if (region.id === 'city-region-19') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'raid' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-14');
        expect(resolved.regions.find((region) => region.id === 'city-region-17')).toMatchObject({
            troops: 2,
            cityState: null,
        });
        expect(resolved.regions.find((region) => region.id === 'jinzhou')).toMatchObject({
            controller: 'jin',
            troops: 5,
            population: 2,
            cityState: null,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-14')?.note).toContain('撤退至 锦州');
        expect(resolved.actionLog[0]?.text).toContain('守军断后损失 1 后撤至 锦州');
    });

    it('守军败退撤入非围城 cityState 城市时会先并回守军，再接收撤退残部', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'jin',
            sourceRegionId: 'city-region-28',
            sourceRegionName: '顺天',
            targetRegionId: 'city-region-25',
            targetRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-25',
            defenderFactionId: 'ming',
            defenderLabel: '大明',
            restriction: '测试',
            battleMode: 'field',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 6,
            committedTroops: 6,
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-28') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 6,
                    population: 0,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 5,
                    population: 0,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [
                            {
                                id: 'ming-ningyuan-infantry-lv2',
                                label: '大明步兵',
                                faction: 'ming',
                                troopKind: 'infantry',
                                count: 2,
                                level: 2,
                            },
                        ],
                    },
                };
            }
            if (region.id === 'city-region-22' || region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-25');
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'ming',
            troops: 3,
            population: 2,
            cityState: null,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({ id: 'ming-ningyuan-infantry-lv2', count: 2, level: 2 }),
            ]),
        });
        expect(resolved.factions.ming.defeatMarkers).toBe(1);
        expect(resolved.actionLog[0]?.text).toContain('守军断后损失 1 后撤至 宁远');
    });

    it('守军败退撤入己方被围城市时会并入 cityState，而不是落到城市顶层', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'jin',
            sourceRegionId: 'city-region-28',
            sourceRegionName: '顺天',
            targetRegionId: 'city-region-25',
            targetRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-25',
            defenderFactionId: 'ming',
            defenderLabel: '大明',
            restriction: '测试',
            battleMode: 'field',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 6,
            committedTroops: 6,
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-28') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 6,
                    population: 0,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 5,
                    population: 0,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'jin',
                        attackerTroops: 2,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-28',
                    },
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [
                            {
                                id: 'ming-ningyuan-infantry-lv2',
                                label: '大明步兵',
                                faction: 'ming',
                                troopKind: 'infantry',
                                count: 2,
                                level: 2,
                            },
                        ],
                    },
                };
            }
            if (region.id === 'city-region-22' || region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-25');
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'ming',
            troops: 0,
            population: 0,
            siegeState: expect.objectContaining({
                attackerFactionId: 'jin',
                attackerTroops: 2,
            }),
            cityState: {
                troops: 3,
                population: 2,
                specialTroops: expect.arrayContaining([
                    expect.objectContaining({ id: 'ming-ningyuan-infantry-lv2', count: 2, level: 2 }),
                ]),
            },
        });
        expect(resolved.factions.ming.defeatMarkers).toBe(1);
        expect(resolved.actionLog[0]?.text).toContain('守军断后损失 1 后撤至 宁远');
    });

    it('守军自动败退选区时会按被围城市的 cityState 守军优先选择友方区域', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'jin',
            sourceRegionId: 'city-region-28',
            sourceRegionName: '顺天',
            targetRegionId: 'city-region-25',
            targetRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-25',
            defenderFactionId: 'ming',
            defenderLabel: '大明',
            restriction: '测试',
            battleMode: 'field',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 6,
            committedTroops: 6,
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-28') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 6,
                    population: 0,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 5,
                    population: 0,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'jin',
                        attackerTroops: 2,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-28',
                    },
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [
                            {
                                id: 'ming-ningyuan-infantry-lv2',
                                label: '大明步兵',
                                faction: 'ming',
                                troopKind: 'infantry',
                                count: 2,
                                level: 2,
                            },
                        ],
                    },
                };
            }
            if (region.id === 'city-region-22') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    siegeState: null,
                };
            }
            if (region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-25');
        expect(resolved.regions.find((region) => region.id === 'city-region-22')).toMatchObject({
            controller: 'ming',
            troops: 1,
            cityState: null,
            siegeState: null,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'ming',
            troops: 0,
            siegeState: expect.objectContaining({
                attackerFactionId: 'jin',
                attackerTroops: 2,
            }),
            cityState: {
                troops: 3,
                population: 2,
                specialTroops: expect.arrayContaining([
                    expect.objectContaining({ id: 'ming-ningyuan-infantry-lv2', count: 2, level: 2 }),
                ]),
            },
        });
        expect(resolved.factions.ming.defeatMarkers).toBe(1);
        expect(resolved.actionLog[0]?.text).toContain('守军断后损失 1 后撤至 宁远');
    });

    it('代善在场时后金守军战败撤退不执行部队损失惩罚', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-14';
        core.selectedActionId = 'raid';
        core.factions = {
            ...core.factions,
            jin: {
                ...core.factions.jin,
                characters: core.factions.jin.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'jin-daisan',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 6,
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 5,
                    population: 0,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-17') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                };
            }
            if (region.id === 'city-region-19' || region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'raid' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-17')?.troops).toBe(4);
        expect(resolved.regions.find((region) => region.id === 'city-region-14')?.note).toContain('撤退不执行部队损失惩罚');
        expect(resolved.actionLog[0]?.text).toContain('守军不执行部队损失惩罚 后撤至 奈曼部');
    });

    it('野战守军战败撤退时可选择溃败让残部全灭', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-14';
        core.selectedActionId = 'raid';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 6,
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 5,
                    population: 0,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-17') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                };
            }
            if (region.id === 'city-region-19' || region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'raid' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: { retreatLossMode: 'rout' },
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-14');
        expect(resolved.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            controller: 'jin',
            troops: 0,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-17')?.troops).toBe(2);
        expect(resolved.factions.jin.defeatMarkers).toBe(1);
        expect(resolved.regions.find((region) => region.id === 'city-region-14')?.note).toContain('撤退溃败损失 2');
        expect(resolved.regions.find((region) => region.id === 'city-region-14')?.note).toContain('无残部可撤');
        expect(resolved.actionLog[0]?.text).toContain('守军溃败损失 2 后无残部可撤');
        expect(resolved.actionLog[0]?.text).toContain('后金 获得 1 个战败标记');
    });

    it('结构化守军溃败时会降级幸存步兵，而不是把高等级残部全灭', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        setFactionCharactersInPlay(core, 'jin', []);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 6,
            committedTroops: 6,
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 6,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 4,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'jin-infantry-lv2',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 4,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-17') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-19' || region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: { retreatLossMode: 'rout' },
        }, diceSequence(2, 2, 2, 1, 1, 1));

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-14');
        expect(resolved.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            controller: 'jin',
            troops: 0,
            specialTroops: [],
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-17')).toMatchObject({
            controller: 'jin',
            troops: 4,
            specialTroops: [
                {
                    id: 'jin-infantry-lv2-rout-lv1',
                    label: '后金步兵',
                    faction: 'jin',
                    troopKind: 'infantry',
                    count: 2,
                    level: 1,
                },
            ],
        });
        expect(resolved.actionLog[0]?.text).toContain('守军溃败损伤 2 后撤至 奈曼部');
    });

    it('战斗后步骑全灭时不会留下孤立炮兵', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        setFactionCharactersInPlay(core, 'jin', []);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 1,
            committedTroops: 1,
            attackPressure: 1,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    specialTroops: [
                        {
                            id: 'ming-infantry-lv1',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 1,
                            level: 1,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'jin-artillery-lv1',
                            label: '后金炮兵',
                            faction: 'jin',
                            troopKind: 'artillery',
                            count: 1,
                            level: 1,
                        },
                        {
                            id: 'jin-infantry-lv1',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 1,
                            level: 1,
                        },
                    ],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        }, diceSequence(6, 6, 1));

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.selectedRegionId).toBe('city-region-16');
        expect(resolved.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            controller: 'jin',
            troops: 0,
            specialTroops: [],
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-16')).toMatchObject({
            controller: 'ming',
            troops: 0,
            specialTroops: [],
        });
        expect(resolved.actionLog[0]?.text).toContain('攻方损失 1');
        expect(resolved.actionLog[0]?.text).toContain('战斗掷骰');
    });

    it('结构化守方骑兵可在野战避战并撤到相邻友方区且不视为战败', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 4,
            committedTroops: 4,
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'jin-cavalry-lv2',
                            label: '后金骑兵',
                            faction: 'jin',
                            troopKind: 'cavalry',
                            count: 2,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-17') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 1,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-19' || region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: { defenderCavalryEvasion: true },
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-14');
        expect(resolved.postBattleSelection).toMatchObject({
            targetRuntimeRegionId: 'city-region-14',
            survivingTroops: 4,
            attackerLosses: 0,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            controller: 'jin',
            troops: 0,
            specialTroops: [],
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-17')).toMatchObject({
            controller: 'jin',
            troops: 3,
            specialTroops: [
                {
                    id: 'jin-cavalry-lv2',
                    label: '后金骑兵',
                    faction: 'jin',
                    troopKind: 'cavalry',
                    count: 2,
                    level: 2,
                },
            ],
        });
        expect(resolved.factions.jin.defeatMarkers).toBe(0);
        expect(resolved.actionLog[0]?.text).toContain('守方骑兵避战 2 撤至 奈曼部');
        expect(resolved.actionLog[0]?.text).not.toContain('后金 获得 1 个战败标记');
    });

    it('守方骑兵避战撤入非围城 cityState 城市时会先并回守军，再接收避战骑兵', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'jin',
            sourceRegionId: 'city-region-28',
            sourceRegionName: '顺天',
            targetRegionId: 'city-region-27',
            targetRegionName: '保定',
            targetRuntimeRegionId: 'city-region-27',
            defenderFactionId: 'ming',
            defenderLabel: '大明',
            restriction: '测试',
            battleMode: 'field',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 4,
            committedTroops: 4,
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-28') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 4,
                    population: 0,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-27') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'ming-cavalry-lv2',
                            label: '大明骑兵',
                            faction: 'ming',
                            troopKind: 'cavalry',
                            count: 2,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [
                            {
                                id: 'ming-ningyuan-infantry-lv2',
                                label: '大明步兵',
                                faction: 'ming',
                                troopKind: 'infantry',
                                count: 2,
                                level: 2,
                            },
                        ],
                    },
                };
            }
            if (
                region.id === 'city-region-20'
                || region.id === 'city-region-22'
                || region.id === 'city-region-30'
                || region.id === 'city-region-33'
            ) {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: { defenderCavalryEvasion: true, defenderCavalryEvasionRegionId: 'city-region-24' },
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'ming',
            troops: 4,
            population: 2,
            cityState: null,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({ id: 'ming-ningyuan-infantry-lv2', count: 2, level: 2 }),
                expect.objectContaining({ id: 'ming-cavalry-lv2', count: 2, level: 2 }),
            ]),
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-27')).toMatchObject({
            controller: 'ming',
            troops: 0,
            population: 0,
            specialTroops: [],
        });
        expect(resolved.factions.ming.defeatMarkers).toBe(0);
        expect(resolved.actionLog[0]?.text).toContain('守方骑兵避战 2 撤至 宁远');
    });

    it('守方骑兵避战撤入己方被围城市时会并入 cityState，而不是落到城市顶层', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'jin',
            sourceRegionId: 'city-region-28',
            sourceRegionName: '顺天',
            targetRegionId: 'city-region-27',
            targetRegionName: '保定',
            targetRuntimeRegionId: 'city-region-27',
            defenderFactionId: 'ming',
            defenderLabel: '大明',
            restriction: '测试',
            battleMode: 'field',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 4,
            committedTroops: 4,
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-28') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 4,
                    population: 0,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-27') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'ming-cavalry-lv2',
                            label: '大明骑兵',
                            faction: 'ming',
                            troopKind: 'cavalry',
                            count: 2,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'jin',
                        attackerTroops: 2,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-28',
                    },
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [
                            {
                                id: 'ming-ningyuan-infantry-lv2',
                                label: '大明步兵',
                                faction: 'ming',
                                troopKind: 'infantry',
                                count: 2,
                                level: 2,
                            },
                        ],
                    },
                };
            }
            if (
                region.id === 'city-region-20'
                || region.id === 'city-region-22'
                || region.id === 'city-region-30'
                || region.id === 'city-region-33'
            ) {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: { defenderCavalryEvasion: true, defenderCavalryEvasionRegionId: 'city-region-24' },
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'ming',
            troops: 0,
            population: 0,
            siegeState: expect.objectContaining({
                attackerFactionId: 'jin',
                attackerTroops: 2,
            }),
            cityState: {
                troops: 4,
                population: 2,
                specialTroops: expect.arrayContaining([
                    expect.objectContaining({ id: 'ming-ningyuan-infantry-lv2', count: 2, level: 2 }),
                    expect.objectContaining({ id: 'ming-cavalry-lv2', count: 2, level: 2 }),
                ]),
            },
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-27')).toMatchObject({
            controller: 'ming',
            troops: 0,
            population: 0,
            specialTroops: [],
        });
        expect(resolved.factions.ming.defeatMarkers).toBe(0);
        expect(resolved.actionLog[0]?.text).toContain('守方骑兵避战 2 撤至 宁远');
    });

    it('结构化守方骑兵避战可指定相邻友方撤退目标', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 4,
            committedTroops: 4,
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'jin-cavalry-lv2',
                            label: '后金骑兵',
                            faction: 'jin',
                            troopKind: 'cavalry',
                            count: 2,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-17') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 5,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-19') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 1,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: { defenderCavalryEvasion: true, defenderCavalryEvasionRegionId: 'city-region-19' },
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-17')).toMatchObject({
            controller: 'jin',
            troops: 5,
            specialTroops: [],
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-19')).toMatchObject({
            controller: 'jin',
            troops: 3,
            specialTroops: [
                {
                    id: 'jin-cavalry-lv2',
                    label: '后金骑兵',
                    faction: 'jin',
                    troopKind: 'cavalry',
                    count: 2,
                    level: 2,
                },
            ],
        });
        expect(resolved.actionLog[0]?.text).toContain('守方骑兵避战 2 撤至 辽西');
    });

    it('结构化攻方骑兵可宣告劫掠并按存活骑兵移除人口后撤', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'wheel-dispatch',
            title: '调骑 4 待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 3,
            committedTroops: 3,
            movementProfileId: 'dispatch-cavalry',
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    specialTroops: [
                        {
                            id: 'ming-cavalry-lv2',
                            label: '大明骑兵',
                            faction: 'ming',
                            troopKind: 'cavalry',
                            count: 3,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 1,
                    population: 3,
                    specialTroops: [
                        {
                            id: 'jin-cavalry-lv2',
                            label: '后金骑兵',
                            faction: 'jin',
                            troopKind: 'cavalry',
                            count: 1,
                            level: 2,
                        },
                    ],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: { attackerCavalryPlunder: true },
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.postBattleSelection).toBeNull();
        expect(resolved.selectedRegionId).toBe('city-region-16');
        expect(resolved.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            controller: 'jin',
            troops: 1,
            population: 1,
            specialTroops: [
                {
                    id: 'jin-cavalry-lv2',
                    label: '后金骑兵',
                    faction: 'jin',
                    troopKind: 'cavalry',
                    count: 1,
                    level: 2,
                },
            ],
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-16')).toMatchObject({
            controller: 'ming',
            troops: 2,
            specialTroops: [
                {
                    id: 'ming-cavalry-lv2',
                    label: '大明骑兵',
                    faction: 'ming',
                    troopKind: 'cavalry',
                    count: 2,
                    level: 2,
                },
            ],
        });
        expect(resolved.factions.ming.handCount).toBe(core.factions.ming.handCount + 2);
        expect(resolved.factions.ming.discardPileCount).toBe(core.factions.ming.discardPileCount + 2);
        expect(resolved.factions.ming.drawPileCount).toBe(core.factions.ming.drawPileCount - 4);
        expect(resolved.factions.jin.defeatMarkers).toBe(0);
        expect(resolved.actionLog[0]?.text).toContain('骑兵劫掠');
        expect(resolved.actionLog[0]?.text).toContain('损失 1');
        expect(resolved.actionLog[0]?.text).toContain('劫掠 2 人口');
    });

    it('结构化攻方骑兵劫掠可选择抽守方普通牌堆', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'wheel-dispatch',
            title: '调骑 4 待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 3,
            committedTroops: 3,
            movementProfileId: 'dispatch-cavalry',
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    specialTroops: [
                        {
                            id: 'ming-cavalry-lv2',
                            label: '大明骑兵',
                            faction: 'ming',
                            troopKind: 'cavalry',
                            count: 3,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 1,
                    population: 3,
                    specialTroops: [
                        {
                            id: 'jin-cavalry-lv2',
                            label: '后金骑兵',
                            faction: 'jin',
                            troopKind: 'cavalry',
                            count: 1,
                            level: 2,
                        },
                    ],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: { attackerCavalryPlunder: true, attackerCavalryPlunderSource: 'defender' },
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.postBattleSelection).toBeNull();
        expect(resolved.selectedRegionId).toBe('city-region-16');
        expect(resolved.regions.find((region) => region.id === 'city-region-14')?.population).toBe(1);
        expect(resolved.regions.find((region) => region.id === 'city-region-16')).toMatchObject({
            troops: 2,
            specialTroops: [
                {
                    id: 'ming-cavalry-lv2',
                    label: '大明骑兵',
                    faction: 'ming',
                    troopKind: 'cavalry',
                    count: 2,
                    level: 2,
                },
            ],
        });
        expect(resolved.factions.ming.handCount).toBe(core.factions.ming.handCount + 2);
        expect(resolved.factions.ming.discardPileCount).toBe(core.factions.ming.discardPileCount);
        expect(resolved.factions.jin.drawPileCount).toBe(core.factions.jin.drawPileCount - 2);
        expect(factionHandCards(resolved, 'ming')).toHaveLength(factionHandCards(core, 'ming').length + 2);
        expect(resolved.actionLog[0]?.text).toContain('抽后金牌堆获得 2 张手牌');
        expect(resolved.actionLog[0]?.text).not.toContain('弃牌堆 +');
    });

    it('野战攻方未突破但仍有残部时会自动断后再撤回源区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-14';
        core.selectedActionId = 'raid';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 5,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'raid' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.postBattleSelection).toBeNull();
        expect(resolved.selectedRegionId).toBe('city-region-16');
        expect(resolved.regions.find((region) => region.id === 'city-region-16')).toMatchObject({
            controller: 'ming',
            troops: 0,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            controller: 'jin',
            troops: 2,
        });
        expect(resolved.factions.ming.defeatMarkers).toBe(1);
        expect(resolved.factions.jin.defeatMarkers).toBe(0);
        expect(resolved.regions.find((region) => region.id === 'city-region-16')?.note).toContain('其中撤退断后 1');
        expect(resolved.regions.find((region) => region.id === 'city-region-14')?.note).toContain('撤退断后损失 1');
        expect(resolved.actionLog[0]?.text).toContain('攻方损失 3，撤退断后损失 1');
        expect(resolved.actionLog[0]?.text).toContain('大明 获得 1 个战败标记');
    });

    it('代善在场时后金攻方未突破撤回源区不执行部队损失惩罚', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.selectedRegionId = 'city-region-14';
        core.selectedActionId = 'raid';
        core.factions = {
            ...core.factions,
            jin: {
                ...core.factions.jin,
                characters: core.factions.jin.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'jin-daisan',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 4,
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 5,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'raid' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: {},
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-16')).toMatchObject({
            controller: 'jin',
            troops: 1,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-16')?.note).not.toContain('其中撤退断后 1');
        expect(resolved.actionLog[0]?.text).toContain('攻方损失 3，撤退不执行部队损失惩罚');
    });

    it('野战攻方未突破撤退时可选择溃败让残部全灭', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-14';
        core.selectedActionId = 'raid';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 5,
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 5,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'raid' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: { retreatLossMode: 'rout' },
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.selectedRegionId).toBe('city-region-16');
        expect(resolved.postBattleSelection).toBeNull();
        expect(resolved.regions.find((region) => region.id === 'city-region-16')).toMatchObject({
            controller: 'ming',
            troops: 0,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            controller: 'jin',
            troops: 2,
        });
        expect(resolved.factions.ming.defeatMarkers).toBe(1);
        expect(resolved.regions.find((region) => region.id === 'city-region-16')?.note).toContain('其中撤退溃败 2');
        expect(resolved.regions.find((region) => region.id === 'city-region-14')?.note).toContain('撤退溃败损失 2');
        expect(resolved.actionLog[0]?.text).toContain('攻方损失 3，撤退溃败损失 2');
        expect(resolved.actionLog[0]?.text).toContain('大明 获得 1 个战败标记');
    });

    it('结构化攻方未突破溃败时会降级幸存步兵，而不是把高等级残部全灭', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        setFactionCharactersInPlay(core, 'jin', []);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 5,
            committedTroops: 5,
            attackPressure: 1,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 5,
                    specialTroops: [
                        {
                            id: 'ming-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 5,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 5,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: { retreatLossMode: 'rout' },
        }, diceSequence(4, 2, 2, 2));

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.selectedRegionId).toBe('city-region-16');
        expect(resolved.postBattleSelection).toBeNull();
        expect(resolved.regions.find((region) => region.id === 'city-region-16')).toMatchObject({
            controller: 'ming',
            troops: 3,
            specialTroops: [
                {
                    id: 'ming-infantry-lv2-rout-lv1',
                    label: '大明步兵',
                    faction: 'ming',
                    troopKind: 'infantry',
                    count: 3,
                    level: 1,
                },
            ],
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            controller: 'jin',
            troops: 4,
        });
        expect(resolved.factions.ming.defeatMarkers).toBe(1);
        expect(resolved.regions.find((region) => region.id === 'city-region-16')?.note).toContain('撤退溃败损伤 3');
        expect(resolved.actionLog[0]?.text).toContain('攻方损失 2，撤退溃败损伤 3');
        expect(resolved.actionLog[0]?.text).toContain('大明 获得 1 个战败标记');
    });

    it('城市守军可选择守城避战，把最多 2 部队与 2 人口收入城中并直接进入城战待结算', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRegionId: 'city-region-25',
            targetRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-25',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 4,
            committedTroops: 4,
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                    population: 4,
                    specialTroops: [],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: { defenderHoldCity: true },
        });

        expect(resolved.turnPhase).toBe('resolve-pending');
        expect(resolved.selectedRegionId).toBe('city-region-25');
        expect(resolved.postBattleSelection).toBeNull();
        expect(resolved.pendingTargetAction).toMatchObject({
            title: '山海关 城战待结算',
            battleMode: 'city',
            targetRuntimeRegionId: 'city-region-25',
            committedTroops: 4,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            troops: 0,
            population: 2,
            cityState: {
                troops: 2,
                population: 2,
                specialTroops: [],
            },
        });
        expect(resolved.factions.jin.defeatMarkers).toBe(0);
        expect(resolved.actionLog[0]?.text).toContain('守方守城避战收入城中 2 部队与 2 人口');
        expect(resolved.actionLog[0]?.text).toContain('直接进入城战');
    });

    it('城市守军守城避战后若仍有城外部队，攻方打赢野战会继续进入城战待结算', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRegionId: 'city-region-25',
            targetRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-25',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 5,
            committedTroops: 5,
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 5,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 4,
                    population: 4,
                    specialTroops: [],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: { defenderHoldCity: true },
        });

        expect(resolved.turnPhase).toBe('resolve-pending');
        expect(resolved.selectedRegionId).toBe('city-region-25');
        expect(resolved.postBattleSelection).toBeNull();
        expect(resolved.pendingTargetAction).toMatchObject({
            title: '山海关 城战待结算',
            battleMode: 'city',
            targetRuntimeRegionId: 'city-region-25',
            committedTroops: 3,
            sourceAvailableTroops: 3,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            troops: 0,
            population: 2,
            cityState: {
                troops: 2,
                population: 2,
                specialTroops: [],
            },
        });
        expect(resolved.factions.jin.defeatMarkers).toBe(0);
        expect(resolved.actionLog[0]?.text).toContain('守方守城避战收入城中 2 部队与 2 人口');
        expect(resolved.actionLog[0]?.text).toContain('继续攻城');
    });

    it('城市守军守城避战时会把收入城中的特殊部队写入 cityState', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRegionId: 'city-region-25',
            targetRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-25',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 5,
            committedTroops: 5,
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 5,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 3,
                    population: 4,
                    specialTroops: [
                        {
                            id: 'jin-shanghai-cavalry-lv3',
                            label: '后金骑兵',
                            faction: 'jin',
                            troopKind: 'cavalry',
                            count: 1,
                            level: 3,
                        },
                        {
                            id: 'jin-shanghai-infantry-lv2',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 1,
                            level: 2,
                        },
                    ],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: { defenderHoldCity: true },
        });

        expect(resolved.pendingTargetAction).toMatchObject({
            battleMode: 'city',
            targetRuntimeRegionId: 'city-region-25',
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            troops: 0,
            population: 2,
            specialTroops: [],
            cityState: {
                troops: 2,
                population: 2,
                specialTroops: [
                    {
                        id: 'jin-shanghai-cavalry-lv3',
                        label: '后金骑兵',
                        faction: 'jin',
                        troopKind: 'cavalry',
                        count: 1,
                        level: 3,
                    },
                    {
                        id: 'jin-shanghai-infantry-lv2',
                        label: '后金步兵',
                        faction: 'jin',
                        troopKind: 'infantry',
                        count: 1,
                        level: 2,
                    },
                ],
            },
        });
    });

    it('城战守军被突破后不会自动撤退或获得野战战败标记', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-25';
        core.selectedActionId = 'raid';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 6,
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 4,
                    population: 0,
                };
            }
            if (region.id === 'city-region-28') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'raid' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            troops: 0,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-28')?.troops).toBe(2);
        expect(resolved.factions.jin.defeatMarkers).toBe(0);
        expect(resolved.factions.ming.defeatMarkers).toBe(0);
        expect(resolved.regions.find((region) => region.id === 'city-region-25')?.note).toContain('等待决定是否占领');
        expect(resolved.actionLog[0]?.text).toContain('等待战后处理');
        expect(resolved.actionLog[0]?.text).not.toContain('撤至');
        expect(resolved.actionLog[0]?.text).not.toContain('战败标记');
    });

    it('城市守军可选择出城野战，战败后会退回城市并继续进入城战待结算', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRegionId: 'city-region-25',
            targetRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-25',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 5,
            committedTroops: 5,
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 5,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 4,
                    population: 2,
                    specialTroops: [],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: { defenderSortieBattle: true },
        });

        expect(resolved.turnPhase).toBe('resolve-pending');
        expect(resolved.selectedRegionId).toBe('city-region-25');
        expect(resolved.postBattleSelection).toBeNull();
        expect(resolved.pendingTargetAction).toMatchObject({
            title: '山海关 城战待结算',
            battleMode: 'city',
            committedTroops: 2,
            sourceAvailableTroops: 2,
            targetRuntimeRegionId: 'city-region-25',
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            troops: 0,
            population: 0,
            cityState: {
                troops: 1,
                population: 2,
                specialTroops: [],
            },
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-25')?.note).toContain('继续攻城');
        expect(resolved.factions.jin.defeatMarkers).toBe(1);
        expect(resolved.actionLog[0]?.text).toContain('守军出城野战');
        expect(resolved.actionLog[0]?.text).toContain('继续攻城');
    });

    it('城战待结算会原生读取 cityState，而不是依赖顶层 troops 镜像', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            battleMode: 'city',
            title: '山海关 城战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRegionId: 'city-region-25',
            targetRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-25',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 4,
            committedTroops: 4,
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 2,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-25');
        expect(resolved.pendingTargetAction).toBeNull();
        expect(resolved.postBattleSelection?.battleMode).toBe('city');
        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            troops: 0,
            population: 2,
            cityState: {
                troops: 0,
                population: 2,
                specialTroops: [],
            },
        });
        expect(resolved.actionLog[0]?.text).toContain('等待战后处理');
    });

    it('城战突破后占领可把城内外剩余人口合并到占领后的区域人口', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            battleMode: 'city',
            title: '山海关 城战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRegionId: 'city-region-25',
            targetRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-25',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 4,
            committedTroops: 4,
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 2,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.postBattleSelection?.choices.some((choice) => choice.id === 'occupy-plunder-4')).toBe(true);

        const occupied = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy' },
        });

        expect(occupied.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'ming',
            troops: 2,
            population: 4,
            cityState: null,
        });
    });

    it('城战突破后可选择围城并保留守方控制权', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-25';
        core.selectedActionId = 'raid';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 6,
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 4,
                    population: 2,
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'raid' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.postBattleSelection?.choices.some((choice) => choice.id === 'besiege')).toBe(true);
        expect(resolved.postBattleSelection?.choices.some((choice) => choice.id === 'besiege-plunder-1')).toBe(false);

        const besieged = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'besiege' },
        });

        expect(besieged.postBattleSelection).toBeNull();
        expect(besieged.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            population: 0,
            troops: 0,
            siegeState: expect.objectContaining({
                attackerFactionId: 'ming',
                sourceRegionId: 'city-region-24',
            }),
            cityState: {
                troops: 0,
                population: 2,
                specialTroops: [],
            },
        });
        expect(besieged.regions.find((region) => region.id === 'city-region-25')?.note).toContain('围城');
        expect(besieged.actionLog[0]?.text).toContain('战后围城');
        expect(besieged.selectedRegionId).toBe('city-region-25');
    });

    it('出城野战后若战后选择围城，会保留退回城市的守军 cityState', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.postBattleSelection = {
            actionId: 'raid',
            battleMode: 'city',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRegionId: 'city-region-25',
            targetRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-25',
            committedTroops: 4,
            survivingTroops: 3,
            attackerLosses: 1,
            movementProfileId: null,
            attackerCasualtyPriority: 'highest-level',
            originalController: 'jin',
            originalControlLabel: '后金',
            title: '战后处理',
            summary: '测试',
            choices: [
                {
                    id: 'besiege',
                    mode: 'besiege',
                    regionId: 'city-region-25',
                    plunderPopulation: 0,
                    plunderSource: null,
                    label: '围城该区',
                    detail: '测试',
                },
            ],
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 1,
                        population: 2,
                        specialTroops: [
                            {
                                id: 'jin-city-infantry-lv2',
                                label: '后金步兵',
                                faction: 'jin',
                                troopKind: 'infantry',
                                count: 1,
                                level: 2,
                            },
                        ],
                    },
                };
            }
            return region;
        });

        const besieged = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'besiege' },
        });

        expect(besieged.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            troops: 0,
            population: 0,
            siegeState: expect.objectContaining({
                attackerFactionId: 'ming',
                attackerTroops: 3,
            }),
            cityState: {
                troops: 1,
                population: 2,
                specialTroops: [
                    expect.objectContaining({
                        id: 'jin-city-infantry-lv2',
                        count: 1,
                    }),
                ],
            },
        });
        expect(besieged.selectedRegionId).toBe('city-region-25');
    });

    it('城战突破后放弃占领会把剩余人口回写进 cityState', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            battleMode: 'city',
            title: '山海关 城战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRegionId: 'city-region-25',
            targetRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-25',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 4,
            committedTroops: 4,
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 2,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        const withdrawn = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'withdraw:city-region-24' },
        });

        expect(withdrawn.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            troops: 0,
            population: 0,
            cityState: {
                troops: 0,
                population: 4,
                specialTroops: [],
            },
        });
        expect(withdrawn.actionLog[0]?.text).toContain('放弃占领');
        expect(withdrawn.selectedRegionId).toBe('city-region-24');
        expect(withdrawn.selectedRegionId).toBe('city-region-24');
    });

    it('出城野战后若战后放弃占领，会保留退回城市的守军 cityState', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.postBattleSelection = {
            actionId: 'raid',
            battleMode: 'city',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRegionId: 'city-region-25',
            targetRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-25',
            committedTroops: 4,
            survivingTroops: 3,
            attackerLosses: 1,
            movementProfileId: null,
            attackerCasualtyPriority: 'highest-level',
            originalController: 'jin',
            originalControlLabel: '后金',
            title: '战后处理',
            summary: '测试',
            choices: [
                {
                    id: 'withdraw:city-region-24',
                    mode: 'withdraw',
                    regionId: 'city-region-24',
                    plunderPopulation: 0,
                    plunderSource: null,
                    label: '回退宁远',
                    detail: '测试',
                },
            ],
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 1,
                        population: 2,
                        specialTroops: [
                            {
                                id: 'jin-city-cavalry-lv2',
                                label: '后金骑兵',
                                faction: 'jin',
                                troopKind: 'cavalry',
                                count: 1,
                                level: 2,
                            },
                        ],
                    },
                };
            }
            return region;
        });

        const withdrawn = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'withdraw:city-region-24' },
        });

        expect(withdrawn.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            troops: 0,
            population: 0,
            siegeState: null,
            cityState: {
                troops: 1,
                population: 2,
                specialTroops: [
                    expect.objectContaining({
                        id: 'jin-city-cavalry-lv2',
                        count: 1,
                    }),
                ],
            },
        });
        expect(withdrawn.actionLog[0]?.text).toContain('放弃占领');
        expect(withdrawn.selectedRegionId).toBe('city-region-24');
    });

    it('战后撤回接兵时若友方目标城市守军仍在 cityState，会先并回再接收撤回部队', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.postBattleSelection = {
            actionId: 'raid',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-20',
            sourceRegionName: '土默特部',
            targetRegionId: 'city-region-25',
            targetRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-25',
            committedTroops: 4,
            survivingTroops: 2,
            attackerLosses: 2,
            movementProfileId: null,
            attackerCasualtyPriority: 'highest-level',
            originalController: 'jin',
            originalControlLabel: '后金',
            title: '战后处理',
            summary: '测试',
            choices: [
                {
                    id: 'withdraw:city-region-24',
                    mode: 'withdraw',
                    regionId: 'city-region-24',
                    plunderPopulation: 0,
                    plunderSource: null,
                    label: '回退宁远',
                    detail: '测试',
                },
            ],
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [
                            { id: 'ming-ningyuan-infantry-lv2', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 2 },
                        ],
                    },
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 1,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            return region;
        });

        const withdrawn = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'withdraw:city-region-24' },
        });

        expect(withdrawn.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 4,
            population: 2,
            cityState: null,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({ id: 'ming-ningyuan-infantry-lv2', count: 2, level: 2 }),
            ]),
        });
        expect(withdrawn.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            troops: 0,
            population: 0,
            cityState: {
                troops: 1,
                population: 2,
                specialTroops: [],
            },
        });
        expect(withdrawn.actionLog[0]?.text).toContain('放弃占领');
    });

    it('非围城 cityState 守军在下一轮仍可从城市发起突袭，并在出兵后清空 cityState', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-24';
        core.selectedActionId = 'raid';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [
                            {
                                id: 'ming-city-infantry-lv2',
                                label: '大明步兵',
                                faction: 'ming',
                                troopKind: 'infantry',
                                count: 2,
                                level: 2,
                            },
                        ],
                    },
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'raid' },
        });

        expect(pending.pendingTargetAction).toMatchObject({
            actionId: 'raid',
            sourceRegionId: 'city-region-25',
            sourceRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-24',
            sourceAvailableTroops: 2,
            committedTroops: 2,
            attackPressure: 2,
        });

        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        const occupied = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy' },
        });

        expect(occupied.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'ming',
            troops: 0,
            population: 2,
            specialTroops: [],
            cityState: null,
        });
        expect(occupied.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'ming',
            troops: 2,
            specialTroops: [
                expect.objectContaining({
                    id: 'ming-city-infantry-lv2',
                    count: 2,
                }),
            ],
        });
    });

    it('非围城 cityState 守军会被轮盘调度进攻识别为可用来源区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [
                            {
                                id: 'ming-city-cavalry-lv2',
                                label: '大明骑兵',
                                faction: 'ming',
                                troopKind: 'cavalry',
                                count: 2,
                                level: 2,
                            },
                        ],
                    },
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        expect(targeting.turnPhase).toBe('dispatch-targeting');
        expect(targeting.wheelDispatchSelection).toMatchObject({
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            restriction: '轮盘进攻/调度 · 调骑 4',
        });
        expect(targeting.wheelDispatchSelection?.candidates.find((candidate) => candidate.targetRuntimeRegionId === 'city-region-20')).toMatchObject({
            targetRuntimeRegionId: 'city-region-20',
            sourceAvailableTroops: 2,
            committedTroops: 2,
            attackPressure: 2,
        });
    });

    it('围城时只可劫掠城外人口，城内保留 2 人口', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-25';
        core.selectedActionId = 'raid';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 6,
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 4,
                    population: 4,
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'raid' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.postBattleSelection?.choices.some((choice) => choice.id === 'besiege-plunder-1')).toBe(false);
        expect(resolved.postBattleSelection?.choices.some((choice) => choice.id === 'besiege-plunder-2')).toBe(false);
        expect(resolved.postBattleSelection?.choices.some((choice) => choice.id === 'besiege-plunder-3')).toBe(false);

        const injected = {
            ...resolved,
            postBattleSelection: {
                ...resolved.postBattleSelection!,
                choices: [
                    ...resolved.postBattleSelection!.choices,
                    {
                        ...resolved.postBattleSelection!.choices.find((choice) => choice.id === 'besiege')!,
                        id: 'besiege-plunder-overflow',
                        plunderPopulation: 4,
                        plunderSource: 'attacker' as const,
                        label: '测试：围城超额劫掠',
                        detail: '测试注入：尝试绕过 UI 劫掠全部人口。',
                    },
                ],
            },
        };

        const besieged = apply(injected, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'besiege-plunder-overflow' },
        });

        expect(besieged.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            population: 0,
            troops: 0,
            cityState: {
                troops: 0,
                population: 4,
                specialTroops: [],
            },
            siegeState: expect.objectContaining({
                attackerFactionId: 'ming',
                attackerTroops: 2,
            }),
        });
        expect(besieged.regions.find((region) => region.id === 'city-region-25')?.note).not.toContain('城外人口被劫掠');
    });

    it('围城攻方在下一轮可直接从围城状态继续城战并占领城市', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-25';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'ming',
                        attackerTroops: 4,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-24',
                    },
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        expect(targeting.turnPhase).toBe('dispatch-targeting');
        expect(targeting.selectedRegionId).toBe('city-region-24');
        expect(targeting.wheelDispatchSelection).toMatchObject({
            sourceRegionId: 'city-region-24',
            sourceRegionName: '山海关围城军',
        });
        expect(targeting.wheelDispatchSelection?.candidates.find((candidate) => candidate.targetRuntimeRegionId === 'city-region-25')).toMatchObject({
            targetRuntimeRegionId: 'city-region-25',
            attackerPositionRegionId: 'city-region-25',
            sourceAvailableTroops: 4,
            committedTroops: 4,
            attackPressure: 3,
        });

        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });

        expect(pending.pendingTargetAction).toMatchObject({
            actionId: 'wheel-dispatch',
            battleMode: 'city',
            sourceRegionId: 'city-region-24',
            attackerPositionRegionId: 'city-region-25',
            targetRuntimeRegionId: 'city-region-25',
        });
        expect(pending.pendingTargetAction?.resolutionHint).toContain('围城续攻');
        expect(pending.selectedRegionId).toBe('city-region-25');

        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.postBattleSelection).toMatchObject({
            battleMode: 'city',
            sourceRegionId: 'city-region-24',
            attackerPositionRegionId: 'city-region-25',
            targetRuntimeRegionId: 'city-region-25',
        });
        expect(resolved.selectedRegionId).toBe('city-region-25');

        const occupied = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy' },
        });

        expect(occupied.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'ming',
            troops: 1,
        });
        expect(occupied.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'ming',
            troops: 2,
            population: 2,
            siegeState: null,
            cityState: null,
            specialTroops: [],
        });
        expect(occupied.selectedRegionId).toBe('city-region-25');
    });

    it('当前未选中被围城城市时，轮盘调度仍会优先续攻己方 siegeState 围城军', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    siegeState: null,
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'ming',
                        attackerTroops: 4,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-20',
                    },
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            if (region.controller === 'ming') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    siegeState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        expect(targeting.turnPhase).toBe('dispatch-targeting');
        expect(targeting.wheelDispatchSelection).toMatchObject({
            sourceRegionId: 'city-region-20',
            sourceRegionName: '山海关围城军',
        });
        expect(targeting.wheelDispatchSelection?.candidates.find((candidate) => candidate.targetRuntimeRegionId === 'city-region-25')).toMatchObject({
            targetRuntimeRegionId: 'city-region-25',
            attackerPositionRegionId: 'city-region-25',
            sourceAvailableTroops: 4,
            committedTroops: 4,
            attackPressure: 3,
        });
    });

    it('围城增援后下一轮继续城战会读取更新后的 siegeState 兵力，并显示围城军来源', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 2,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'ming',
                        attackerTroops: 2,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-20',
                    },
                    cityState: {
                        troops: 0,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            return region;
        });

        const reinforceTargeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });
        const reinforcePending = apply(reinforceTargeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });
        const reinforced = apply(reinforcePending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        reinforced.selectedRegionId = 'city-region-25';
        reinforced.turnPhase = 'action-window';
        reinforced.wheelActionUsed = false;
        reinforced.actionWheelPosition = 'wheel-military-farm';
        reinforced.pendingTargetAction = null;
        reinforced.postBattleSelection = null;

        const continueTargeting = apply(reinforced, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        expect(continueTargeting.wheelDispatchSelection).toMatchObject({
            sourceRegionId: 'city-region-20',
            sourceRegionName: '山海关围城军',
        });
        expect(continueTargeting.wheelDispatchSelection?.candidates.find((candidate) => candidate.targetRuntimeRegionId === 'city-region-25')).toMatchObject({
            targetRuntimeRegionId: 'city-region-25',
            attackerPositionRegionId: 'city-region-25',
            sourceAvailableTroops: 6,
            committedTroops: 6,
        });
    });

    it('围城攻方在下一轮继续城战后可撤回原始友方来源区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-25';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'ming',
                        attackerTroops: 4,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-24',
                    },
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });
        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.postBattleSelection?.choices.some((choice) => choice.id === 'withdraw:city-region-24')).toBe(true);

        const withdrawn = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'withdraw:city-region-24' },
        });

        expect(withdrawn.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'ming',
            troops: 3,
            specialTroops: [],
        });
        expect(withdrawn.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            troops: 0,
            population: 0,
            siegeState: null,
            cityState: {
                troops: 0,
                population: 2,
                specialTroops: [],
            },
        });
        expect(withdrawn.selectedRegionId).toBe('city-region-24');
    });

    it('友方被围城市会作为调度进攻的解围目标，并在胜利后清空 siegeState', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 2,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'jin',
                        attackerTroops: 2,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-20',
                    },
                    cityState: {
                        troops: 0,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        expect(targeting.selectedRegionId).toBe('city-region-24');
        expect(targeting.wheelDispatchSelection?.candidates.find((candidate) => candidate.targetRuntimeRegionId === 'city-region-25')).toMatchObject({
            targetRuntimeRegionId: 'city-region-25',
            battleMode: 'field',
            targetKind: 'siege-attacker',
            defenderFactionId: 'jin',
            defenderLabel: '后金围城军',
        });

        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });

        expect(pending.pendingTargetAction).toMatchObject({
            actionId: 'wheel-dispatch',
            battleMode: 'field',
            targetKind: 'siege-attacker',
            defenderFactionId: 'jin',
            targetRuntimeRegionId: 'city-region-25',
        });
        expect(pending.pendingTargetAction?.resolutionHint).toContain('解围');
        expect(pending.selectedRegionId).toBe('city-region-25');

        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.postBattleSelection).toMatchObject({
            battleMode: 'field',
            targetKind: 'siege-attacker',
        });
        expect(resolved.postBattleSelection?.choices).toEqual([
            expect.objectContaining({
                id: 'occupy',
                label: '解除围城并进驻',
            }),
        ]);
        expect(resolved.selectedRegionId).toBe('city-region-25');

        const relieved = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy' },
        });

        expect(relieved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'ming',
            troops: 0,
        });
        expect(relieved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'ming',
            troops: 2,
            population: 2,
            siegeState: null,
            cityState: {
                troops: 0,
                population: 2,
                specialTroops: [],
            },
        });
        expect(relieved.selectedRegionId).toBe('city-region-25');
    });

    it('轮盘调度候选排序在同路费时会按围城军兵力优先列出友方被围城市', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-22') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 1,
                    population: 0,
                    specialTroops: [],
                    siegeState: null,
                    cityState: null,
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 2,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'jin',
                        attackerTroops: 4,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-20',
                    },
                    cityState: {
                        troops: 0,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        expect(targeting.wheelDispatchSelection?.candidates[0]).toMatchObject({
            targetRuntimeRegionId: 'city-region-25',
            targetKind: 'siege-attacker',
            defenderFactionId: 'jin',
            priorityTroops: 4,
        });
        expect(targeting.wheelDispatchSelection?.candidates.some((candidate) => candidate.targetRuntimeRegionId === 'city-region-20')).toBe(true);
    });

    it('我方部队可调度进入己方围城区域并直接并入 siegeState，不进入战斗', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 2,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'ming',
                        attackerTroops: 2,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-20',
                    },
                    cityState: {
                        troops: 0,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });
        const reinforceCandidate = targeting.wheelDispatchSelection?.candidates.find((candidate) => candidate.targetRuntimeRegionId === 'city-region-25');

        expect(reinforceCandidate).toMatchObject({
            targetRuntimeRegionId: 'city-region-25',
            battleMode: 'field',
            targetKind: 'siege-reinforce',
            defenderLabel: '大明围城军',
        });
        expect(reinforceCandidate?.resolutionHint).toContain('增援围城');

        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });

        expect(pending.pendingTargetAction).toMatchObject({
            actionId: 'wheel-dispatch',
            battleMode: 'field',
            targetKind: 'siege-reinforce',
            targetRuntimeRegionId: 'city-region-25',
            committedTroops: reinforceCandidate?.committedTroops,
        });

        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.selectedRegionId).toBe('city-region-25');
        expect(resolved.pendingTargetAction).toBeNull();
        expect(resolved.postBattleSelection).toBeNull();
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'ming',
            troops: 4 - (reinforceCandidate?.committedTroops ?? 0),
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            siegeState: expect.objectContaining({
                attackerFactionId: 'ming',
                attackerTroops: 2 + (reinforceCandidate?.committedTroops ?? 0),
            }),
        });
        expect(resolved.actionLog[0]?.text).toContain('不进入战斗');
    });

    it('非围城 cityState 守军增援己方围城区域时会先并回来源区，再正确扣除守军与结构化部队', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 4,
                        population: 2,
                        specialTroops: [
                            {
                                id: 'ming-cavalry-lv2',
                                label: '大明骑兵',
                                faction: 'ming',
                                troopKind: 'cavalry',
                                count: 4,
                                level: 2,
                            },
                        ],
                    },
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 2,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'ming',
                        attackerTroops: 2,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-20',
                    },
                    cityState: {
                        troops: 0,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });
        const reinforceCandidate = targeting.wheelDispatchSelection?.candidates.find((candidate) => candidate.targetRuntimeRegionId === 'city-region-25');

        expect(reinforceCandidate).toMatchObject({
            targetRuntimeRegionId: 'city-region-25',
            targetKind: 'siege-reinforce',
            sourceAvailableTroops: 4,
        });

        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'ming',
            troops: 4 - (reinforceCandidate?.committedTroops ?? 0),
            cityState: null,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-24')?.specialTroops).toEqual([]);
        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            siegeState: expect.objectContaining({
                attackerFactionId: 'ming',
                attackerTroops: 2 + (reinforceCandidate?.committedTroops ?? 0),
                attackerSpecialTroops: [
                    expect.objectContaining({
                        id: 'ming-cavalry-lv2',
                        label: '大明骑兵',
                        faction: 'ming',
                        troopKind: 'cavalry',
                        count: reinforceCandidate?.committedTroops ?? 0,
                        level: 2,
                    }),
                ],
            }),
        });
    });

    it('解围失败时会保留 siegeState 并给援军方战败标记', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 2,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'jin',
                        attackerTroops: 4,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-20',
                    },
                    cityState: {
                        troops: 0,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });
        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.selectedRegionId).toBe('city-region-24');
        expect(resolved.postBattleSelection).toBeNull();
        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'ming',
            siegeState: expect.objectContaining({
                attackerFactionId: 'jin',
                attackerTroops: 2,
            }),
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 0,
        });
        expect(resolved.factions.ming.defeatMarkers).toBe(1);
        expect(resolved.actionLog[0]?.text).toContain('解围失败');
    });

    it('调度进攻打入有守军区域时会互损但未突破，不进入战后处理', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'city-region-24', 'ming', 2);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                    population: 0,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        });

        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.selectedRegionId).toBe('city-region-24');
        expect(resolved.postBattleSelection).toBeNull();
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 0,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-20')).toMatchObject({
            controller: 'jin',
            controlLabel: '后金',
            troops: 0,
        });
        expect(resolved.actionLog[0]?.text).toContain('攻方损失 2');
    });

    it('后金联姻诱降会按守军手牌支付结算并保留山海关控制权', () => {
        const mingDone = apply(apply(apply(QidahenDomain.setup(['0', '1', '2'], random), {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        }), {
            type: QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE,
            playerId: '0',
            payload: { choiceId: 'level-2-troops' },
        }), {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const mongolActionDone = apply(apply(mingDone, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        }), {
            type: QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE,
            playerId: '1',
            payload: { choiceId: 'recruit-train' },
        });
        const mongolDone = apply(mongolActionDone, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '1',
            payload: { moveId: 'move-1-free' },
        });
        const readyForPayment: QidahenCore = {
            ...mongolDone,
            factions: {
                ...mongolDone.factions,
                ming: {
                    ...mongolDone.factions.ming,
                    handCount: 4,
                },
            },
        };
        const selected = apply(readyForPayment, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '2',
            payload: { regionId: 'city-region-25' },
        });
        const pending = apply(selected, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'marriage-subjugation' },
        });

        expect(pending.currentPlayer).toBe('2');
        expect(pending.pendingTargetAction?.defenderPayCost).toBe(4);

        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: {},
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-25')?.controller).toBe('ming');
        expect(resolved.factions.ming.handCount).toBe(0);
        expect(resolved.pendingTargetAction).toBeNull();
        expect(resolved.currentPlayer).toBe('2');
        expect(resolved.lastSeasonSummary?.title).toBe('联姻诱降');
        expect(resolved.lastSeasonSummary?.lines.join(' | ')).toContain('守住 山海关');
        expect(resolved.actionLog[0]?.text).toContain('守住 山海关');
    });

    it('联姻诱降指定辽西时会按规则少算 2 个部队的支付代价', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.selectedRegionId = 'city-region-19';
        core.actionChoices = getActionChoicesForFaction('jin');
        core.selectedActionId = 'marriage-subjugation';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-19') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                };
            }
            if (region.id === 'city-region-17') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'marriage-subjugation' },
        });

        expect(pending.pendingTargetAction?.targetRegionId).toBe('city-region-19');
        expect(pending.pendingTargetAction?.targetRegionName).toBe('辽西');
        expect(pending.pendingTargetAction?.defenderPayCost).toBe(4);
    });

    it('联姻诱降指定辽西时若山海关已破败则不再享受 2 部队减免', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.selectedRegionId = 'city-region-19';
        core.actionChoices = getActionChoicesForFaction('jin');
        core.selectedActionId = 'marriage-subjugation';
        core.fortifications = core.fortifications.map((fortification) => (
            fortification.id === 'shanhaiguan'
                ? { ...fortification, ruined: true }
                : fortification
        ));
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-19') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                };
            }
            if (region.id === 'city-region-17') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'marriage-subjugation' },
        });

        expect(pending.pendingTargetAction?.targetRegionId).toBe('city-region-19');
        expect(pending.pendingTargetAction?.defenderPayCost).toBe(8);
    });

    it('联姻诱降经逻辑区辽西选中时仍会映射到同一运行时区域并享受减免', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.selectedRegionId = 'liao-xi';
        core.actionChoices = getActionChoicesForFaction('jin');
        core.selectedActionId = 'marriage-subjugation';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-19') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                };
            }
            if (region.id === 'city-region-17') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'marriage-subjugation' },
        });

        expect(pending.selectedRegionId).toBe('city-region-19');
        expect(pending.pendingTargetAction).toMatchObject({
            targetRegionId: 'liao-xi',
            targetRegionName: '辽西',
            targetRuntimeRegionId: 'city-region-19',
            defenderPayCost: 4,
        });
    });

    it('联姻诱降失败时会消灭原守军并只留下 1 个转阵营部队', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.selectedRegionId = 'city-region-25';
        core.actionChoices = getActionChoicesForFaction('jin');
        core.selectedActionId = 'marriage-subjugation';
        core.factions.ming.handCount = 0;

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'marriage-subjugation' },
        });

        expect(pending.pendingTargetAction?.defenderPayCost).toBe(4);

        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: {},
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            controlLabel: '后金',
            troops: 1,
        });
        expect(resolved.factions.ming.handCount).toBe(0);
        expect(resolved.factions.ming.troops).toBe(core.factions.ming.troops - 2);
        expect(resolved.factions.jin.troops).toBe(core.factions.jin.troops + 1);
        expect(resolved.pendingTargetAction).toBeNull();
        expect(resolved.lastSeasonSummary?.title).toBe('联姻诱降');
        expect(resolved.lastSeasonSummary?.lines.join(' | ')).toContain('守军未能支付代价');
        expect(resolved.lastSeasonSummary?.lines.join(' | ')).toContain('仅余 1 个部队转为 后金');
        expect(resolved.actionLog[0]?.text).toContain('守军未能支付代价');
        expect(resolved.actionLog[0]?.text).toContain('1 个部队转为其麾下');
    });

    it('联姻诱降面对仅 cityState 守军的敌城时也会按城内守军计算支付并转控', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.selectedRegionId = 'city-region-25';
        core.actionChoices = getActionChoicesForFaction('jin');
        core.selectedActionId = 'marriage-subjugation';
        core.factions.ming.handCount = 0;
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'marriage-subjugation' },
        });

        expect(pending.pendingTargetAction?.defenderPayCost).toBe(4);

        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: {},
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            controlLabel: '后金',
            troops: 1,
            population: 2,
            cityState: null,
            specialTroops: [],
        });
        expect(resolved.factions.ming.handCount).toBe(0);
        expect(resolved.factions.ming.troops).toBe(core.factions.ming.troops - 2);
        expect(resolved.factions.jin.troops).toBe(core.factions.jin.troops + 1);
        expect(resolved.lastSeasonSummary?.lines.join(' | ')).toContain('守军未能支付代价');
        expect(resolved.actionLog[0]?.text).toContain('1 个部队转为其麾下');
    });

    it('联姻诱降面对仅 cityState 守军且守方支付代价时会保留 cityState，不会直接物化到顶层', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.selectedRegionId = 'city-region-25';
        core.actionChoices = getActionChoicesForFaction('jin');
        core.selectedActionId = 'marriage-subjugation';
        core.factions.ming.handCount = 4;
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [
                            {
                                id: 'ming-infantry-lv2',
                                label: '大明步兵',
                                faction: 'ming',
                                troopKind: 'infantry',
                                count: 2,
                                level: 2,
                            },
                        ],
                    },
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'marriage-subjugation' },
        });

        expect(pending.pendingTargetAction?.defenderPayCost).toBe(4);

        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: {},
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'ming',
            controlLabel: '大明',
            troops: 0,
            population: 0,
            specialTroops: [],
            cityState: {
                troops: 2,
                population: 2,
                specialTroops: [
                    {
                        id: 'ming-infantry-lv2',
                        label: '大明步兵',
                        faction: 'ming',
                        troopKind: 'infantry',
                        count: 2,
                        level: 2,
                    },
                ],
            },
        });
        expect(resolved.factions.ming.handCount).toBe(0);
        expect(resolved.factions.ming.troops).toBe(core.factions.ming.troops);
        expect(resolved.pendingTargetAction).toBeNull();
        expect(resolved.lastSeasonSummary?.lines.join(' | ')).toContain('支付 4 张手牌');
        expect(resolved.actionLog[0]?.text).toContain('支付 4 张手牌');
    });

    it('联姻诱降失败转控 cityState 结构化守军时不会残留原守军木块', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.selectedRegionId = 'city-region-25';
        core.actionChoices = getActionChoicesForFaction('jin');
        core.selectedActionId = 'marriage-subjugation';
        core.factions.ming.handCount = 0;
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [
                            {
                                id: 'ming-infantry-lv2',
                                label: '大明步兵',
                                faction: 'ming',
                                troopKind: 'infantry',
                                count: 2,
                                level: 2,
                            },
                        ],
                    },
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'marriage-subjugation' },
        });

        expect(pending.pendingTargetAction?.defenderPayCost).toBe(4);

        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: {},
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            controlLabel: '后金',
            troops: 1,
            cityState: null,
            specialTroops: [],
        });
        expect(resolved.actionLog[0]?.text).toContain('守军未能支付代价');
        expect(resolved.actionLog[0]?.text).toContain('1 个部队转为其麾下');
    });

    it('大汗令箭在蒙古已有控制区时会先进入令箭效果选择', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.selectedRegionId = 'city-region-25';
        core.actionChoices = getActionChoicesForFaction('mongol');
        core.selectedActionId = 'khan-edict';
        core.payment = {
            required: 1,
            selected: 0,
            prompt: '需弃 1 / 已选 0',
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 2,
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                };
            }
            return region;
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        });

        expect(next.turnPhase).toBe('khan-edict-choice');
        expect(next.selectedRegionId).toBe('city-region-25');
        expect(next.factionActionUsed).toBe(true);
        expect(next.pendingTargetAction).toBeNull();
        expect(next.khanEdictSelection?.sourceRegionId).toBe('city-region-25');
        expect(next.khanEdictSelection?.choices).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'recruit-train', label: '征兵训练' }),
            expect.objectContaining({ id: 'hire-dispatch', label: '外交雇佣' }),
        ]));
        expect(next.actionLog[0]?.text).toContain('进入令箭效果选择');
    });

    it('大汗令箭当前选中敌区时，令箭效果面板会回退到实际蒙古来源区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.selectedRegionId = 'city-region-24';
        core.actionChoices = getActionChoicesForFaction('mongol');
        core.selectedActionId = 'khan-edict';
        core.payment = {
            required: 1,
            selected: 0,
            prompt: '需弃 1 / 已选 0',
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 2,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return {
                ...region,
                controller: 'neutral',
                controlLabel: '中立',
                troops: 0,
                diplomacyMarkerFaction: null,
                diplomacyMarkerSide: null,
                cityState: null,
                siegeState: null,
                specialTroops: [],
            };
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        });

        expect(next.turnPhase).toBe('khan-edict-choice');
        expect(next.selectedRegionId).toBe('city-region-25');
        expect(next.khanEdictSelection?.sourceRegionId).toBe('city-region-25');
        expect(next.khanEdictSelection?.sourceRegionName).toBe('山海关');
        expect(next.khanEdictSelection?.recruitTargetRegionId).toBe('city-region-25');
        expect(next.khanEdictSelection?.hireTargetRegionId).toBe('city-region-25');

        const rebound = apply(next, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-24' },
        });

        expect(rebound.turnPhase).toBe('khan-edict-choice');
        expect(rebound.selectedRegionId).toBe('city-region-25');
        expect(rebound.khanEdictSelection?.sourceRegionId).toBe('city-region-25');
        expect(rebound.khanEdictSelection?.sourceRegionName).toBe('山海关');
    });

    it('大汗令箭选择征兵训练后会给当前蒙古控制区增加 2 部队', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.wheelActionUsed = true;
        core.selectedRegionId = 'city-region-25';
        core.actionChoices = getActionChoicesForFaction('mongol');
        core.selectedActionId = 'khan-edict';
        core.payment = {
            required: 1,
            selected: 0,
            prompt: '需弃 1 / 已选 0',
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 2,
                };
            }
            return region;
        });

        const selected = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        });
        const resolved = apply(selected, {
            type: QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE,
            playerId: '1',
            payload: { choiceId: 'recruit-train' },
        });

        expect(resolved.khanEdictSelection).toBeNull();
        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.selectedRegionId).toBe('city-region-13');
        const recruitRegion = resolved.regions.find((region) => region.id === 'city-region-25');
        expect(recruitRegion?.troops).toBe(4);
        expect(recruitRegion?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'mongol-khan-edict-recruit-train-regular-cavalry-lv2',
                label: '蒙古骑兵',
                faction: 'mongol',
                troopKind: 'cavalry',
                count: 2,
                level: 2,
            }),
        ]));
        expect(resolved.factions.mongol.troops).toBe(core.factions.mongol.troops + 2);
        expect(resolved.lastSeasonSummary?.title).toBe('大汗令箭');
        expect(resolved.lastSeasonSummary?.lines[0]).toContain('征兵训练');
        expect(resolved.lastSeasonSummary?.lines[0]).toContain('蒙古骑兵');
    });

    it('大汗令箭在非围城 cityState 城市执行征兵训练时会先并回守军，再建立新骑兵', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.wheelActionUsed = true;
        core.selectedRegionId = 'city-region-25';
        core.actionChoices = getActionChoicesForFaction('mongol');
        core.selectedActionId = 'khan-edict';
        core.payment = {
            required: 1,
            selected: 0,
            prompt: '需弃 1 / 已选 0',
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [
                            { id: 'mongol-shanhaiguan-cavalry-lv2', label: '蒙古骑兵', faction: 'mongol', troopKind: 'cavalry', count: 2, level: 2 },
                        ],
                    },
                };
            }
            return region;
        });

        const selected = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        });
        const resolved = apply(selected, {
            type: QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE,
            playerId: '1',
            payload: { choiceId: 'recruit-train' },
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            troops: 4,
            population: 2,
            cityState: null,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({ id: 'mongol-shanhaiguan-cavalry-lv2', count: 2, level: 2 }),
                expect.objectContaining({ id: 'mongol-khan-edict-recruit-train-regular-cavalry-lv2', count: 2, level: 2 }),
            ]),
        });
        expect(resolved.factions.mongol.troops).toBe(core.factions.mongol.troops + 2);
    });

    it('大汗令箭的征兵训练不会把正规军建在蒙古附庸区，而会回退到蒙古本土控制区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.wheelActionUsed = true;
        core.selectedRegionId = 'city-region-24';
        core.actionChoices = getActionChoicesForFaction('mongol');
        core.selectedActionId = 'khan-edict';
        core.payment = {
            required: 1,
            selected: 0,
            prompt: '需弃 1 / 已选 0',
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'mongol',
                    diplomacyMarkerFaction: 'mongol',
                    diplomacyMarkerSide: 'vassal',
                    controlLabel: '蒙古附庸',
                    troops: 1,
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 2,
                };
            }
            return region;
        });

        const selected = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        });

        expect(selected.khanEdictSelection?.recruitTargetRegionId).toBe('city-region-14');

        const resolved = apply(selected, {
            type: QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE,
            playerId: '1',
            payload: { choiceId: 'recruit-train' },
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controlLabel: '蒙古附庸',
            troops: 1,
        });
        const fallbackRegion = resolved.regions.find((region) => region.id === 'city-region-14');
        expect(fallbackRegion?.troops).toBe(5);
        expect(fallbackRegion?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'mongol-khan-edict-recruit-train-regular-cavalry-lv2',
                label: '蒙古骑兵',
                faction: 'mongol',
                troopKind: 'cavalry',
                count: 2,
                level: 2,
            }),
        ]));
    });

    it('大汗令箭当前选中附庸区时，令箭效果面板会回退到实际蒙古来源区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.wheelActionUsed = true;
        core.selectedRegionId = 'city-region-22';
        core.actionChoices = getActionChoicesForFaction('mongol');
        core.selectedActionId = 'khan-edict';
        core.payment = {
            required: 1,
            selected: 0,
            prompt: '需弃 1 / 已选 0',
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-22') {
                return {
                    ...region,
                    controller: 'mongol',
                    diplomacyMarkerFaction: 'mongol',
                    diplomacyMarkerSide: 'vassal',
                    controlLabel: '蒙古附庸',
                    troops: 1,
                };
            }
            if (region.id === 'song-jin') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 2,
                    population: 0,
                    specialTroops: [],
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            if (region.controller === 'mongol') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const selected = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        });

        expect(selected.turnPhase).toBe('khan-edict-choice');
        expect(selected.selectedRegionId).toBe('song-jin');
        expect(selected.khanEdictSelection?.sourceRegionId).toBe('song-jin');
        expect(selected.khanEdictSelection?.sourceRegionName).toBe('皮岛');
        expect(selected.khanEdictSelection?.hireTargetRegionId).toBe('song-jin');
        expect(selected.khanEdictSelection?.hireTargetRegionName).toBe('皮岛');
        expect(selected.khanEdictSelection?.choices.map((choice) => choice.id)).toContain('hire-dispatch');
    });

    it('大汗令箭以逻辑区辽西为当前选区时，会把效果选择与征兵训练都收敛到真实运行时区域', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.selectedRegionId = 'liao-xi';
        core.actionChoices = getActionChoicesForFaction('mongol');
        core.selectedActionId = 'khan-edict';
        core.payment = {
            required: 1,
            selected: 0,
            prompt: '需弃 1 / 已选 0',
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-19') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 2,
                    population: 0,
                    specialTroops: [],
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                    cityState: null,
                    siegeState: null,
                };
            }
            if (region.controller === 'mongol') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                    cityState: null,
                    siegeState: null,
                };
            }
            return region;
        });

        const selected = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        });

        expect(selected.turnPhase).toBe('khan-edict-choice');
        expect(selected.selectedRegionId).toBe('city-region-19');
        expect(selected.khanEdictSelection).toMatchObject({
            sourceRegionId: 'city-region-19',
            sourceRegionName: '辽西',
            recruitTargetRegionId: 'city-region-19',
            recruitTargetRegionName: '辽西',
            hireTargetRegionId: 'city-region-19',
            hireTargetRegionName: '辽西',
        });

        const resolved = apply(selected, {
            type: QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE,
            playerId: '1',
            payload: { choiceId: 'recruit-train' },
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.selectedRegionId).toBe('city-region-19');
        expect(resolved.regions.find((region) => region.id === 'city-region-19')).toMatchObject({
            troops: 4,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({
                    id: 'mongol-khan-edict-recruit-train-regular-cavalry-lv2',
                    label: '蒙古骑兵',
                    faction: 'mongol',
                    troopKind: 'cavalry',
                    count: 2,
                    level: 2,
                }),
            ]),
        });
    });

    it('大汗令箭从附庸区回退到真实蒙古来源区后，进入外交雇佣并点逻辑区辽西时会同步 selectedRegionId', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.wheelActionUsed = true;
        core.selectedRegionId = 'city-region-22';
        core.actionChoices = getActionChoicesForFaction('mongol');
        core.selectedActionId = 'khan-edict';
        core.payment = {
            required: 1,
            selected: 0,
            prompt: '需弃 1 / 已选 0',
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-22') {
                return {
                    ...region,
                    controller: 'mongol',
                    diplomacyMarkerFaction: 'mongol',
                    diplomacyMarkerSide: 'vassal',
                    controlLabel: '蒙古附庸',
                    troops: 1,
                };
            }
            if (region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 2,
                    population: 0,
                    specialTroops: [],
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            if (region.id === 'city-region-19') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            if (region.controller === 'mongol') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const selected = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        });

        expect(selected.turnPhase).toBe('khan-edict-choice');
        expect(selected.selectedRegionId).toBe('jinzhou');
        expect(selected.khanEdictSelection?.sourceRegionId).toBe('jinzhou');
        expect(selected.khanEdictSelection?.hireTargetRegionId).toBe('jinzhou');

        const choosingDiplomacy = apply(selected, {
            type: QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE,
            playerId: '1',
            payload: { choiceId: 'hire-dispatch' },
        });

        expect(choosingDiplomacy.turnPhase).toBe('diplomacy-choice');
        expect(choosingDiplomacy.selectedRegionId).toBe('jinzhou');
        expect(choosingDiplomacy.diplomacySelection?.sourceRegionId).toBe('jinzhou');
        expect(choosingDiplomacy.diplomacySelection?.sourceRegionName).toBe('锦州');

        const targeted = apply(choosingDiplomacy, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'liao-xi' },
        });

        expect(targeted.turnPhase).toBe('diplomacy-choice');
        expect(targeted.selectedRegionId).toBe('city-region-19');
        expect(targeted.diplomacySelection).toMatchObject({
            sourceRegionId: 'jinzhou',
            targetRegionId: 'city-region-19',
            targetRegionName: '辽西',
        });
    });

    it('大汗令箭选择外交雇佣后会进入外交目标选择，并可同时放友好标记与建立雇佣军', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.wheelActionUsed = true;
        core.selectedRegionId = 'city-region-25';
        core.actionChoices = getActionChoicesForFaction('mongol');
        core.selectedActionId = 'khan-edict';
        core.payment = {
            required: 1,
            selected: 0,
            prompt: '需弃 1 / 已选 0',
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 2,
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                };
            }
            return region;
        });

        const selected = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        });
        const choosingDiplomacy = apply(selected, {
            type: QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE,
            playerId: '1',
            payload: { choiceId: 'hire-dispatch' },
        });
        expect(choosingDiplomacy.khanEdictSelection).toBeNull();
        expect(choosingDiplomacy.selectedRegionId).toBe('city-region-25');
        expect(choosingDiplomacy.diplomacySelection?.sourceRegionId).toBe('city-region-25');
        expect(choosingDiplomacy.turnPhase).toBe('diplomacy-choice');
        expect(choosingDiplomacy.actionLog.some((entry) => entry.text.includes('等待选择外交目标'))).toBe(true);

        const targeted = apply(choosingDiplomacy, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-24' },
        });
        expect(targeted.diplomacySelection?.targetRegionId).toBe('city-region-24');
        expect(targeted.diplomacySelection?.choices).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'hire-only' }),
            expect.objectContaining({ id: 'place-friendly' }),
        ]));

        const resolved = apply(targeted, {
            type: QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE,
            playerId: '1',
            payload: { choiceId: 'place-friendly' },
        });

        expect(resolved.turnPhase).toBe('diplomacy-choice');
        expect(resolved.selectedRegionId).toBe('city-region-24');
        expect(resolved.diplomacySelection?.resolvedSteps).toHaveLength(1);
        expect(resolved.diplomacySelection?.remainingTargetCount).toBe(2);
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            diplomacyMarkerFaction: 'mongol',
            diplomacyMarkerSide: 'friendly',
            controlLabel: '蒙古友好',
        });
        expect(resolved.mapTokens.find((token) => token.id === 'diplomacy-marker-city-region-24')).toMatchObject({
            faction: 'mongol',
            imageSrc: 'qidahen/markers/mongol-control-diplomacy-marker-b',
        });

        const finished = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE,
            playerId: '1',
            payload: { choiceId: 'hire-only' },
        });

        expect(finished.diplomacySelection).toBeNull();
        expect(finished.currentPlayer).toBe('2');
        expect(finished.turnPhase).toBe('action-window');
        expect(finished.selectedRegionId).toBe('city-region-13');
        expect(finished.wheelDispatchSelection).toBeNull();
        expect(finished.regions.find((region) => region.id === 'city-region-25')?.troops).toBe(4);
        expect(finished.regions.find((region) => region.id === 'city-region-25')?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'mongol-mercenary-lv2',
                label: '雇佣军',
                faction: 'mongol',
                count: 2,
                level: 2,
            }),
        ]));
        expect(finished.factions.mongol.troops).toBe(core.factions.mongol.troops + 2);
        expect(finished.lastSeasonSummary?.title).toBe('大汗令箭');
        expect(finished.lastSeasonSummary?.lines[0]).toContain('建立 2 个等级 2 雇佣军');
        expect(finished.lastSeasonSummary?.lines[1]).toContain('外交 1：');
        expect(finished.lastSeasonSummary?.lines[1]).toContain('蒙古友好');
        expect(finished.actionLog.some((entry) => entry.text.includes('完成大汗令箭'))).toBe(true);
    });

    it('大汗令箭外交雇佣在未轮转时收尾，会把 selectedRegionId 收回实际建立雇佣军的来源区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.wheelActionUsed = false;
        core.selectedRegionId = 'city-region-25';
        core.actionChoices = getActionChoicesForFaction('mongol');
        core.selectedActionId = 'khan-edict';
        core.payment = {
            required: 1,
            selected: 0,
            prompt: '需弃 1 / 已选 0',
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 2,
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                };
            }
            return region;
        });

        const selected = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        });
        const choosingDiplomacy = apply(selected, {
            type: QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE,
            playerId: '1',
            payload: { choiceId: 'hire-dispatch' },
        });
        const targeted = apply(choosingDiplomacy, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-24' },
        });
        const resolved = apply(targeted, {
            type: QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE,
            playerId: '1',
            payload: { choiceId: 'place-friendly' },
        });
        const finished = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE,
            playerId: '1',
            payload: { choiceId: 'hire-only' },
        });

        expect(finished.diplomacySelection).toBeNull();
        expect(finished.currentPlayer).toBe('1');
        expect(finished.turnPhase).toBe('action-window');
        expect(finished.selectedRegionId).toBe('city-region-25');
        expect(finished.regions.find((region) => region.id === 'city-region-25')?.troops).toBe(4);
    });

    it('大汗令箭在非围城 cityState 城市执行雇佣时会先并回守军，再建立雇佣军', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.wheelActionUsed = true;
        core.selectedRegionId = 'city-region-25';
        core.actionChoices = getActionChoicesForFaction('mongol');
        core.selectedActionId = 'khan-edict';
        core.payment = {
            required: 1,
            selected: 0,
            prompt: '需弃 1 / 已选 0',
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [
                            { id: 'mongol-shanhaiguan-cavalry-lv2', label: '蒙古骑兵', faction: 'mongol', troopKind: 'cavalry', count: 2, level: 2 },
                        ],
                    },
                };
            }
            return region;
        });

        const selected = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        });
        const choosingDiplomacy = apply(selected, {
            type: QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE,
            playerId: '1',
            payload: { choiceId: 'hire-dispatch' },
        });
        const finished = apply(choosingDiplomacy, {
            type: QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE,
            playerId: '1',
            payload: { choiceId: 'hire-only' },
        });

        expect(finished.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            troops: 4,
            population: 2,
            cityState: null,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({ id: 'mongol-shanhaiguan-cavalry-lv2', label: '蒙古骑兵', faction: 'mongol', count: 2, level: 2 }),
                expect.objectContaining({ id: 'mongol-mercenary-lv2', label: '雇佣军', faction: 'mongol', count: 2, level: 2 }),
            ]),
        });
        expect(finished.factions.mongol.troops).toBe(core.factions.mongol.troops + 2);
        expect(finished.lastSeasonSummary?.title).toBe('大汗令箭');
        expect(finished.lastSeasonSummary?.lines[0]).toContain('建立 2 个等级 2 雇佣军');
    });

    it('外交目标若只有 cityState 城内正规军，也会被判定为存在正规军而不能执行外交', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.wheelActionUsed = true;
        core.selectedRegionId = 'city-region-25';
        core.actionChoices = getActionChoicesForFaction('mongol');
        core.selectedActionId = 'khan-edict';
        core.payment = {
            required: 1,
            selected: 0,
            prompt: '需弃 1 / 已选 0',
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 2,
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 1,
                        population: 2,
                        specialTroops: [
                            { id: 'neutral-ningyuan-infantry-lv2', label: '中立步兵', faction: 'neutral', troopKind: 'infantry', count: 1, level: 2 },
                        ],
                    },
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        });
        const chooseDiplomacy = apply(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE,
            playerId: '1',
            payload: { choiceId: 'hire-dispatch' },
        });
        const targeted = apply(chooseDiplomacy, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-24' },
        });

        expect(targeted.diplomacySelection?.targetRegionId).toBe('city-region-24');
        expect(targeted.diplomacySelection?.targetHint).toContain('存在正规军');
        expect(targeted.diplomacySelection?.choices.map((choice) => choice.id)).toEqual(['hire-only']);
    });

    it('轮盘进入年中时会结算土地税赋并留下摘要', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-hire';
        core.regions = core.regions.map((region) => {
            if (region.id === 'song-jin') {
                return {
                    ...region,
                    troops: 1,
                    population: 4,
                };
            }
            return region;
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-2-one-opponent' },
        });

        expect(next.actionWheelPosition).toBe('wheel-midyear');
        expect(next.turnPhase).toBe('action-window');
        expect(next.selectedRegionId).toBe('song-jin');
        expect(next.currentYear).toBe('天命四年 1619');
        expect(next.factions.ming.handCount).toBe(11);
        expect(next.factions.ming.drawPileCount).toBe(15);
        expect(next.factions.mongol.handCount).toBe(8);
        expect(next.factions.mongol.drawPileCount).toBe(18);
        expect(factionHandCards(next, 'mongol')).toHaveLength(8);
        expect(next.lastSeasonSummary?.title).toBe('年中结算');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('大明 因土地税赋获得 3 张手牌');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('大明因江南漕运获得 5 张手牌');
        expect(next.actionLog[0]?.text).toContain('轮盘停在年中');
    });

    it('围城区域在年中不会提供土地税赋', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-hire';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 4,
                    siegeState: {
                        attackerFactionId: 'jin',
                        attackerTroops: 2,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-28',
                    },
                };
            }
            return {
                ...region,
                population: region.troops,
            };
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-2-one-opponent' },
        });

        expect(next.factions.ming.handCount).toBe(8);
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('大明 本次年中未从土地税赋获得手牌');
    });

    it('非围城城市保留在 cityState 的城内人口与守军也会参与年中土地税赋判断', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-hire';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    cityState: {
                        troops: 1,
                        population: 2,
                        specialTroops: [],
                    },
                    siegeState: null,
                };
            }
            return {
                ...region,
                population: region.troops,
            };
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-2-one-opponent' },
        });

        expect(next.factions.ming.handCount).toBe(9);
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('大明 因土地税赋获得 1 张手牌');
    });

    it('轮盘进入年中时会处理并移除已有战败标记', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-hire';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                defeatMarkers: 2,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-mao-wenlong' || character.id === 'ming-wang-huazhen',
                })),
            },
            mongol: {
                ...core.factions.mongol,
                defeatMarkers: 1,
            },
            jin: {
                ...core.factions.jin,
                defeatMarkers: 1,
            },
        };

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-2-one-opponent' },
        });

        expect(next.actionWheelPosition).toBe('wheel-midyear');
        expect(next.turnPhase).toBe('internal-dispatch-choice');
        expect(next.selectedRegionId).toBe('city-region-25');
        expect(next.internalDispatchSelection?.sourceRegionId).toBe('city-region-25');
        expect(next.factions.ming.defeatMarkers).toBe(0);
        expect(next.factions.mongol.defeatMarkers).toBe(0);
        expect(next.factions.jin.defeatMarkers).toBe(0);
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('年中战败标记与人物判定');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('大明处理 2 个战败标记，掷骰 4/6');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('毛文龙(1) 掷 4');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('王化贞(2) 掷 6');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('蒙古处理 1 个战败标记，掷骰 1');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('林丹·乎图克图(1) 掷 1 离场');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('后金处理 1 个战败标记，掷骰 4');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('努尔哈赤(1) 掷 4');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('标记已移除');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('人物牌额外判定仍以低保真摘要保留');
        expect(next.factions.ming.characters.every((character) => character.defeatMarkers === 0)).toBe(true);
        expect(next.factions.mongol.characters.find((character) => character.id === 'mongol-lindan-hutuktu')?.inPlay).toBe(false);
        expect(next.factions.mongol.characters.every((character) => character.defeatMarkers === 0)).toBe(true);
        expect(next.factions.jin.characters.every((character) => character.defeatMarkers === 0)).toBe(true);
    });

    it('林丹·乎图克图在场时会让其他人物的年中人物判定点数 -1，但不影响自己', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-hire';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                defeatMarkers: 1,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-mao-wenlong',
                })),
            },
            mongol: {
                ...core.factions.mongol,
                defeatMarkers: 1,
                characters: core.factions.mongol.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'mongol-lindan-hutuktu',
                })),
            },
        };

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-2-one-opponent' },
        });

        expect(next.turnPhase).toBe('action-window');
        expect(next.selectedRegionId).toBe('song-jin');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('毛文龙(1) 掷 4→3');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('林丹·乎图克图(1) 掷 1 离场');
    });

    it('代善在场时会让后金人物免受林丹·乎图克图的年中人物判定减值影响', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-hire';
        core.factions = {
            ...core.factions,
            mongol: {
                ...core.factions.mongol,
                defeatMarkers: 1,
                characters: core.factions.mongol.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'mongol-lindan-hutuktu',
                })),
            },
            jin: {
                ...core.factions.jin,
                defeatMarkers: 1,
                characters: core.factions.jin.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'jin-daisan' || character.id === 'jin-eidu',
                })),
            },
        };

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-2-one-opponent' },
        });

        expect(next.turnPhase).toBe('action-window');
        expect(next.selectedRegionId).toBe('song-jin');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('额亦都(2) 掷 4');
        expect(next.lastSeasonSummary?.lines.join(' | ')).not.toContain('额亦都(2) 掷 4→3');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('林丹·乎图克图(1) 掷 1 离场');
    });

    it('范文程在场时会在年中按后金控制的汉人区域数量额外抽牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-hire';
        core.factions = {
            ...core.factions,
            jin: {
                ...core.factions.jin,
                handCount: 0,
                drawPileCount: 10,
                characters: core.factions.jin.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'jin-fan-wencheng',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.id === 'city-region-27' || region.id === 'city-region-32') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                };
            }
            if (region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'neutral',
                    diplomacyMarkerFaction: 'jin',
                    diplomacyMarkerSide: 'friendly',
                    controlLabel: '后金友好',
                };
            }
            return region;
        });

        const baseline = apply({
            ...core,
            factions: {
                ...core.factions,
                jin: {
                    ...core.factions.jin,
                    characters: core.factions.jin.characters.map((character) => ({
                        ...character,
                        inPlay: false,
                    })),
                },
            },
        }, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-2-one-opponent' },
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-2-one-opponent' },
        });

        expect(next.actionWheelPosition).toBe('wheel-midyear');
        expect(next.turnPhase).toBe('action-window');
        expect(next.selectedRegionId).toBe('song-jin');
        expect(next.factions.jin.handCount - baseline.factions.jin.handCount).toBe(4);
        expect(next.factions.jin.drawPileCount).toBe(6);
        expect(baseline.factions.jin.drawPileCount).toBe(10);
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('后金因范文程控制 2 个汉人区域，额外抽 4 张手牌');
        expect(next.lastSeasonSummary?.lines.join(' | ')).not.toContain('控制 3 个汉人区域');
    });

    it('轮盘进入新年时会结算朝鲜朝贡、防线维护与兵力耗损', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 6,
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.id === 'xian-xing') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                };
            }
            if (region.id === 'city-region-18' || region.id === 'city-region-29') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                };
            }
            if (region.id === 'song-jin') {
                return {
                    ...region,
                    troops: 3,
                    population: 1,
                };
            }
            return region;
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        expect(next.actionWheelPosition).toBe('wheel-new-year');
        expect(next.currentYearIndex).toBe(0);
        expect(next.fortificationMaintenanceSelection?.title).toBe('新年防线维护');
        expect(next.selectedRegionId).toBe('song-jin');
        expect(next.lastSeasonSummary?.title).toBe('新年结算');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('等待大明选择防线维护方式');

        const settled = apply(next, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'auto-pay' },
        });

        expect(settled.currentYearIndex).toBe(1);
        expect(settled.currentYear).toBe('天命五年 1620');
        expect(settled.fortificationMaintenanceSelection).toBeNull();
        expect(settled.currentPlayer).toBe('0');
        expect(settled.turnPhase).toBe('gao-di-dispatch-choice');
        expect(settled.selectedRegionId).toBe('city-region-22');
        expect(settled.gaoDiDispatchSelection?.sourceRegionId).toBe('city-region-22');
        expect(settled.lastSeasonSummary?.title).toBe('新年结算');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明 因朝鲜朝贡获得 1 张朝鲜牌');
        expect(settled.koreaDeckCount).toBe(core.koreaDeckCount - 1);
        expect(settled.fortifications.find((fortification) => fortification.id === 'shanhaiguan')?.ruined).toBe(false);
        expect(settled.fortifications.find((fortification) => fortification.id === 'inner-wall')?.ruined).toBe(false);
        expect(settled.fortifications.find((fortification) => fortification.id === 'outer-wall')?.ruined).toBe(true);
        expect(settled.regions.find((region) => region.id === 'jinzhou')?.boundaryTypeByRegionId['city-region-25']).toBe('plain');
        expect(settled.regions.find((region) => region.id === 'song-jin')?.troops).toBe(3);
        expect(settled.factions.ming.handCount).toBe(0);
        expect(settled.actionLog.some((entry) => entry.text.includes('已执行新年结算'))).toBe(true);
    });

    it('新年防线维护等待选择时点逻辑区辽西，不会把 selectedRegionId 漂离当前焦点', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 6,
            },
        };

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        expect(pending.fortificationMaintenanceSelection?.title).toBe('新年防线维护');
        const anchoredRegionId = pending.selectedRegionId;

        const reselected = apply(pending, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'liao-xi' },
        });

        expect(reselected.turnPhase).toBe('season-resolution');
        expect(reselected.selectedRegionId).toBe(anchoredRegionId);
        expect(reselected.fortificationMaintenanceSelection?.title).toBe('新年防线维护');
    });

    it('阿敏在场时后金控制的朝鲜区域会在新年朝贡时每区额外多抽 1 张朝鲜牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 6,
            },
            jin: {
                ...core.factions.jin,
                handCount: 0,
                characters: core.factions.jin.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'jin-amin',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.id === 'xian-xing') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                };
            }
            if (region.id === 'city-region-18' || region.id === 'city-region-29') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                };
            }
            if (region.id === 'song-jin') {
                return {
                    ...region,
                    troops: 3,
                    population: 1,
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        expect(settled.koreaDeckCount).toBe(core.koreaDeckCount - 2);
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('后金 因朝鲜朝贡获得 2 张朝鲜牌');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).not.toContain('大明 因朝鲜朝贡获得');
    });

    it('新年会对围城区域的攻方执行围城耗损', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                vp: 2,
                handCount: 12,
            },
            jin: {
                ...core.factions.jin,
                handCount: 1,
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 4,
                    siegeState: {
                        attackerFactionId: 'jin',
                        attackerTroops: 2,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-28',
                    },
                };
            }
            return {
                ...region,
                population: region.troops,
            };
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        expect(settled.regions.find((region) => region.id === 'city-region-25')?.siegeState).toMatchObject({
            attackerFactionId: 'jin',
            attackerTroops: 1,
        });
        expect(settled.factions.jin.handCount).toBe(0);
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('后金 在 山海关 触发围城耗损');
    });

    it('新年围城耗损会同步扣减 siegeState.attackerSpecialTroops', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                vp: 2,
                handCount: 12,
            },
            jin: {
                ...core.factions.jin,
                handCount: 1,
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 4,
                    siegeState: {
                        attackerFactionId: 'jin',
                        attackerTroops: 2,
                        attackerSpecialTroops: [
                            {
                                id: 'jin-siege-cavalry-lv2',
                                label: '后金骑兵',
                                faction: 'jin',
                                troopKind: 'cavalry',
                                count: 1,
                                level: 2,
                            },
                            {
                                id: 'jin-siege-infantry-lv1',
                                label: '后金步兵',
                                faction: 'jin',
                                troopKind: 'infantry',
                                count: 1,
                                level: 1,
                            },
                        ],
                        sourceRegionId: 'city-region-28',
                    },
                };
            }
            return {
                ...region,
                population: region.troops,
            };
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'auto-pay' },
        });

        expect(settled.regions.find((region) => region.id === 'city-region-25')?.siegeState).toMatchObject({
            attackerFactionId: 'jin',
            attackerTroops: 1,
            attackerSpecialTroops: [
                {
                    id: 'jin-siege-cavalry-lv2',
                    label: '后金骑兵',
                    faction: 'jin',
                    troopKind: 'cavalry',
                    count: 1,
                    level: 2,
                },
            ],
        });
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('移除：后金步兵 x1');
    });

    it('新年会对围城城市的城内守军按 cityState 人口执行耗损', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 8,
            },
            jin: {
                ...core.factions.jin,
                handCount: 0,
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'ming',
                        attackerTroops: 1,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-24',
                    },
                    cityState: {
                        troops: 3,
                        population: 2,
                        specialTroops: [
                            {
                                id: 'jin-city-infantry-lv1',
                                label: '后金步兵',
                                faction: 'jin',
                                troopKind: 'infantry',
                                count: 3,
                                level: 1,
                            },
                        ],
                    },
                };
            }
            return {
                ...region,
                population: region.troops,
            };
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        expect(settled.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            siegeState: expect.objectContaining({
                attackerFactionId: 'ming',
                attackerTroops: 1,
            }),
            cityState: {
                troops: 2,
                population: 2,
                specialTroops: [
                    {
                        id: 'jin-city-infantry-lv1',
                        label: '后金步兵',
                        faction: 'jin',
                        troopKind: 'infantry',
                        count: 2,
                        level: 1,
                    },
                ],
            },
        });
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('后金 在 山海关 触发守城耗损');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('移除：后金步兵 x1');
    });

    it('新年会对非围城城市保留在 cityState 的城内守军执行耗损', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            jin: {
                ...core.factions.jin,
                handCount: 0,
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    siegeState: null,
                    cityState: {
                        troops: 3,
                        population: 2,
                        specialTroops: [
                            {
                                id: 'jin-city-infantry-lv1',
                                label: '后金步兵',
                                faction: 'jin',
                                troopKind: 'infantry',
                                count: 3,
                                level: 1,
                            },
                        ],
                    },
                };
            }
            return {
                ...region,
                population: region.troops,
            };
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        expect(settled.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            siegeState: null,
            cityState: {
                troops: 2,
                population: 2,
                specialTroops: [
                    {
                        id: 'jin-city-infantry-lv1',
                        label: '后金步兵',
                        faction: 'jin',
                        troopKind: 'infantry',
                        count: 2,
                        level: 1,
                    },
                ],
            },
        });
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('后金 在 山海关 触发守城耗损');
    });

    it('王化贞在场时新年围城耗损会先免费支持 1 部队', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 0,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-wang-huazhen',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'xian-xing' || region.id === 'city-region-18' || region.id === 'city-region-29') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                };
            }
            if (region.id === 'city-region-19') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 4,
                    siegeState: {
                        attackerFactionId: 'ming',
                        attackerTroops: 2,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'song-jin',
                    },
                };
            }
            return {
                ...region,
                population: region.troops,
            };
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        expect(settled.regions.find((region) => region.id === 'city-region-19')?.siegeState).toMatchObject({
            attackerFactionId: 'ming',
            attackerTroops: 1,
        });
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明 因王化贞在 辽西 免费支持 1 部队');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明 在 辽西 触发围城耗损，无法补足 1 点补给，围城部队减员 1');
    });

    it('新年防线维护可选择放弃全部防线', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 12,
            },
        };

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        expect(pending.fortificationMaintenanceSelection?.choices.map((choice) => choice.id)).toEqual(['auto-pay', 'skip-all']);
        expect(pending.selectedRegionId).toBe('song-jin');

        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        expect(settled.currentYearIndex).toBe(1);
        expect(settled.fortificationMaintenanceSelection).toBeNull();
        expect(settled.currentPlayer).toBe('0');
        expect(settled.turnPhase).toBe('gao-di-dispatch-choice');
        expect(settled.selectedRegionId).toBe('city-region-25');
        expect(settled.gaoDiDispatchSelection?.sourceRegionId).toBe('city-region-25');
        expect(settled.fortifications.every((fortification) => fortification.ruined)).toBe(true);
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明放弃维护 内长城，改为破败');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明放弃维护 锦州，改为破败');
    });

    it('新年防线维护会按逻辑区依赖判断蓟镇与辽西失守', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 12,
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.id === 'city-region-19' || region.id === 'city-region-28') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'auto-pay' },
        });

        expect(pending.selectedRegionId).toBe('song-jin');
        expect(settled.fortifications.find((fortification) => fortification.id === 'shanhaiguan')?.ruined).toBe(true);
        expect(settled.fortifications.find((fortification) => fortification.id === 'ningyuan')?.ruined).toBe(true);
        expect(settled.fortifications.find((fortification) => fortification.id === 'jinzhou')?.ruined).toBe(true);
        expect(settled.currentPlayer).toBe('0');
        expect(settled.turnPhase).toBe('gao-di-dispatch-choice');
        expect(settled.selectedRegionId).toBe('city-region-25');
        expect(settled.gaoDiDispatchSelection?.sourceRegionId).toBe('city-region-25');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明失去 蓟镇，山海关 本轮无法修缮，改为破败');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明失去 辽西，宁远 本轮无法修缮，改为破败');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明失去 辽西，锦州 本轮无法修缮，改为破败');
    });

    it('新年会按有效威望与当年顺位结算本年纪年卡归属并支付半数手牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.playerIds = ['2', '1', '0'];
        core.currentPlayer = '2';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                playerId: '0',
                vp: 1,
                handCount: 4,
            },
            mongol: {
                ...core.factions.mongol,
                playerId: '1',
                vp: 1,
                handCount: 3,
            },
            jin: {
                ...core.factions.jin,
                playerId: '2',
                vp: 1,
                handCount: 5,
            },
        };

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '2',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'auto-pay' },
        });

        expect(settled.factions.ming.vp).toBe(2);
        expect(settled.factions.mongol.vp).toBe(1);
        expect(settled.factions.jin.vp).toBe(1);
        expect(settled.factions.ming.handCount).toBeLessThanOrEqual(2);
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明 以');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('获得本年纪年卡，威望 +1');
    });

    it('首次新年结算后会按新纪年顺位重置到本年先手势力', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.currentYearIndex = 1;
        core.currentYear = '天命五年 1620';
        core.currentFactionOrder = ['ming', 'mongol', 'jin'];
        core.currentPlayer = '0';
        core.factionActionUsed = true;
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 12,
            },
            mongol: {
                ...core.factions.mongol,
                handCount: 8,
            },
            jin: {
                ...core.factions.jin,
                handCount: 8,
            },
        };

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        expect(pending.selectedRegionId).toBe('song-jin');
        expect(settled.currentYearIndex).toBe(2);
        expect(settled.currentYear).toBe('天命六年 1621');
        expect(settled.currentFactionOrder).toEqual(['mongol', 'jin', 'ming']);
        expect(settled.currentPlayer).toBe('1');
        expect(settled.roundNumber).toBe(2);
        expect(settled.turnPhase).toBe('action-window');
        expect(settled.factionActionUsed).toBe(false);
        expect(settled.wheelActionUsed).toBe(false);
        expect(settled.turnLabel).toContain('蒙古');
        expect(settled.selectedRegionId).toBe('city-region-14');
        expect(settled.actionChoices.map((action) => action.label)).toEqual([
            '升级军备',
            '突袭作战',
            '马市贸易',
            '大汗令箭',
        ]);
        expect(settled.factions.ming.characters.filter((character) => character.inPlay).map((character) => character.name)).toEqual([]);
        expect(settled.factions.mongol.characters.filter((character) => character.inPlay).map((character) => character.name)).toEqual([
            '林丹·乎图克图',
            '绰克图台吉',
        ]);
        expect(settled.factions.jin.characters.filter((character) => character.inPlay).map((character) => character.name)).toEqual([
            '努尔哈赤',
            '额亦都',
            '代善',
        ]);
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明 本年人物：无新增出场');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('蒙古 本年人物：台吉中择一；当前启用 绰克图台吉');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('后金 本年人物：任意人物牌；当前启用 代善');
    });

    it('纪年卡代表人物候选会跳过已在场人物并启用下一位', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.currentYearIndex = 1;
        core.currentYear = '天命五年 1620';
        core.currentFactionOrder = ['ming', 'mongol', 'jin'];
        core.currentPlayer = '0';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 12,
            },
            mongol: {
                ...core.factions.mongol,
                handCount: 8,
            },
            jin: {
                ...core.factions.jin,
                handCount: 8,
                characters: core.factions.jin.characters.map((character) => (
                    character.id === 'jin-daisan'
                        ? { ...character, inPlay: true }
                        : character
                )),
            },
        };

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        expect(pending.selectedRegionId).toBe('song-jin');
        expect(settled.currentPlayer).toBe('0');
        expect(settled.turnPhase).toBe('action-window');
        expect(settled.selectedRegionId).toBe('song-jin');
        expect(settled.factions.jin.characters.filter((character) => character.inPlay).map((character) => character.name)).toEqual([
            '努尔哈赤',
            '额亦都',
            '代善',
            '阿敏',
        ]);
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('后金 本年人物：任意人物牌；当前启用 阿敏');
    });

    it('新年兵力耗损会同步扣除结构化部队栈', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 0,
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.id === 'xian-xing' || region.id === 'city-region-18' || region.id === 'city-region-29') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                };
            }
            if (region.id !== 'song-jin') {
                return region;
            }
            return {
                ...region,
                controller: 'ming',
                controlLabel: '大明',
                troops: 4,
                population: 1,
                specialTroops: [
                    { id: 'ming-songjin-infantry-lv4', label: '大明精锐步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 4 },
                    { id: 'ming-songjin-infantry-lv1', label: '大明低级步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 1 },
                ],
            };
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        expect(pending.actionWheelPosition).toBe('wheel-new-year');
        expect(pending.fortificationMaintenanceSelection?.title).toBe('新年防线维护');
        expect(pending.selectedRegionId).toBe('song-jin');

        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        const songjin = settled.regions.find((region) => region.id === 'song-jin');
        expect(settled.turnPhase).toBe('gao-di-dispatch-choice');
        expect(settled.selectedRegionId).toBe('city-region-22');
        expect(settled.gaoDiDispatchSelection?.sourceRegionId).toBe('city-region-22');
        expect(songjin?.troops).toBe(1);
        expect(songjin?.specialTroops).toEqual([
            { id: 'ming-songjin-infantry-lv4', label: '大明精锐步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 4 },
        ]);
        expect(songjin?.note).toContain('兵力耗损损失 3 部队');
        expect(songjin?.note).toContain('低级先损');
        expect(songjin?.note).toContain('移除：大明低级步兵 x2、大明精锐步兵 x1');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明 在 皮岛 触发兵力耗损，无法补足 3 点补给，部队减员 3（低级先损）（移除：大明低级步兵 x2、大明精锐步兵 x1）');
    });

    it('王化贞在场时新年兵力耗损会先为每个区域免费支持 1 部队', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 0,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-wang-huazhen',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.id === 'xian-xing' || region.id === 'city-region-18' || region.id === 'city-region-29') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                };
            }
            if (region.id !== 'song-jin') {
                return region;
            }
            return {
                ...region,
                controller: 'ming',
                controlLabel: '大明',
                troops: 4,
                population: 1,
                specialTroops: [
                    { id: 'ming-songjin-infantry-lv4', label: '大明精锐步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 4 },
                    { id: 'ming-songjin-infantry-lv1', label: '大明低级步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 1 },
                ],
            };
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        const songjin = settled.regions.find((region) => region.id === 'song-jin');
        expect(pending.selectedRegionId).toBe('song-jin');
        expect(settled.turnPhase).toBe('gao-di-dispatch-choice');
        expect(settled.selectedRegionId).toBe('city-region-25');
        expect(settled.gaoDiDispatchSelection?.sourceRegionId).toBe('city-region-25');
        expect(songjin?.troops).toBe(2);
        expect(songjin?.specialTroops).toEqual([
            { id: 'ming-songjin-infantry-lv4', label: '大明精锐步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 4 },
        ]);
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明 因王化贞在 皮岛 免费支持 1 部队');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明 在 皮岛 触发兵力耗损，无法补足 2 点补给，部队减员 2（低级先损）（移除：大明低级步兵 x2）');
    });

    it('新年兵力耗损可选择高级先损并保留低级部队', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 0,
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.id === 'xian-xing' || region.id === 'city-region-18' || region.id === 'city-region-29') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                };
            }
            if (region.id !== 'song-jin') {
                return region;
            }
            return {
                ...region,
                controller: 'ming',
                controlLabel: '大明',
                troops: 4,
                population: 1,
                specialTroops: [
                    { id: 'ming-songjin-infantry-lv4', label: '大明精锐步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 4 },
                    { id: 'ming-songjin-infantry-lv1', label: '大明低级步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 1 },
                ],
            };
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all', attritionPriority: 'highest-level' },
        });

        const songjin = settled.regions.find((region) => region.id === 'song-jin');
        expect(pending.selectedRegionId).toBe('song-jin');
        expect(settled.turnPhase).toBe('gao-di-dispatch-choice');
        expect(settled.selectedRegionId).toBe('city-region-22');
        expect(settled.gaoDiDispatchSelection?.sourceRegionId).toBe('city-region-22');
        expect(songjin?.troops).toBe(1);
        expect(songjin?.specialTroops).toEqual([
            { id: 'ming-songjin-infantry-lv2', label: '大明低级步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 2 },
        ]);
        expect(songjin?.note).toContain('高级先损');
        expect(songjin?.note).toContain('移除：大明精锐步兵 x2、大明低级步兵 x1');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明 在 皮岛 触发兵力耗损，无法补足 3 点补给，部队减员 3（高级先损）（移除：大明精锐步兵 x2、大明低级步兵 x1）');
    });

    it('新年会对朝鲜区域执行仅手牌支付的耗损', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 0,
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.id !== 'city-region-29') {
                return region;
            }
            return {
                ...region,
                controller: 'ming',
                controlLabel: '大明',
                troops: 2,
                population: 6,
                specialTroops: [
                    { id: 'ming-hanseong-mercenary-lv2', label: '朝鲜雇佣军', faction: 'ming', troopKind: 'infantry', count: 2, level: 2 },
                ],
            };
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        const hanseong = settled.regions.find((region) => region.id === 'city-region-29');
        expect(pending.selectedRegionId).toBe('song-jin');
        expect(settled.turnPhase).toBe('gao-di-dispatch-choice');
        expect(settled.selectedRegionId).toBe('city-region-29');
        expect(settled.gaoDiDispatchSelection?.sourceRegionId).toBe('city-region-29');
        expect(hanseong?.troops).toBe(0);
        expect(hanseong?.specialTroops).toEqual([]);
        expect(hanseong?.note).toContain('朝鲜耗损');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明 在 汉城 触发朝鲜耗损，无法补足 2 点补给，部队减员 2');
    });

    it('毛文龙在场时大明位于朝鲜的部队不会触发新年朝鲜耗损', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 0,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-mao-wenlong',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.id !== 'city-region-29') {
                return region;
            }
            return {
                ...region,
                controller: 'ming',
                controlLabel: '大明',
                troops: 2,
                population: 6,
                specialTroops: [
                    { id: 'ming-hanseong-mercenary-lv2', label: '朝鲜雇佣军', faction: 'ming', troopKind: 'infantry', count: 2, level: 2 },
                ],
            };
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        const hanseong = settled.regions.find((region) => region.id === 'city-region-29');
        expect(pending.selectedRegionId).toBe('song-jin');
        expect(settled.turnPhase).toBe('gao-di-dispatch-choice');
        expect(settled.selectedRegionId).toBe('city-region-29');
        expect(settled.gaoDiDispatchSelection?.sourceRegionId).toBe('city-region-29');
        expect(hanseong?.troops).toBe(2);
        expect(hanseong?.specialTroops).toEqual([
            { id: 'ming-hanseong-mercenary-lv3', label: '朝鲜雇佣军', faction: 'ming', troopKind: 'infantry', count: 2, level: 3 },
        ]);
        expect(hanseong?.note).not.toContain('朝鲜耗损');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).not.toContain('大明 在 汉城 触发朝鲜耗损');
    });

    it('新年会对友好标记中立区执行中立耗损，不吃当地人口补给', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 0,
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.id !== 'city-region-27') {
                return region;
            }
            return {
                ...region,
                controller: 'neutral',
                diplomacyMarkerFaction: 'ming',
                diplomacyMarkerSide: 'friendly',
                controlLabel: '大明友好',
                troops: 2,
                population: 5,
                specialTroops: [
                    { id: 'ming-shuntian-regular-infantry-lv2', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 2 },
                ],
            };
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        const baoding = settled.regions.find((region) => region.id === 'city-region-27');
        expect(pending.selectedRegionId).toBe('song-jin');
        expect(settled.turnPhase).toBe('gao-di-dispatch-choice');
        expect(settled.selectedRegionId).toBe('city-region-25');
        expect(settled.gaoDiDispatchSelection?.sourceRegionId).toBe('city-region-25');
        expect(baoding?.troops).toBe(0);
        expect(baoding?.specialTroops).toEqual([]);
        expect(baoding?.note).toContain('中立耗损');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明 在 保定 触发中立耗损，无法补足 2 点补给，部队减员 2');
    });

    it('新年大漠耗损只禁止大明正规军吃补给，雇佣军仍可使用当地人口', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 0,
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.id !== 'city-region-20') {
                return region;
            }
            return {
                ...region,
                controller: 'ming',
                controlLabel: '大明',
                troops: 3,
                population: 1,
                specialTroops: [
                    { id: 'ming-tumote-regular-infantry-lv2', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 2 },
                    { id: 'ming-tumote-mercenary-cavalry-lv2', label: '大明雇佣骑兵', faction: 'ming', troopKind: 'cavalry', count: 1, level: 2 },
                ],
            };
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        const tumote = settled.regions.find((region) => region.id === 'city-region-20');
        expect(pending.selectedRegionId).toBe('song-jin');
        expect(settled.turnPhase).toBe('gao-di-dispatch-choice');
        expect(settled.selectedRegionId).toBe('city-region-22');
        expect(settled.gaoDiDispatchSelection?.sourceRegionId).toBe('city-region-22');
        expect(tumote?.troops).toBe(1);
        expect(tumote?.specialTroops).toEqual([
            { id: 'ming-tumote-mercenary-cavalry-lv2', label: '大明雇佣骑兵', faction: 'ming', troopKind: 'cavalry', count: 1, level: 2 },
        ]);
        expect(tumote?.note).toContain('大漠耗损');
        expect(settled.lastSeasonSummary?.lines.join(' | ')).toContain('大明 在 土默特部 触发大漠耗损，无法补足 2 点补给，部队减员 2');
    });

    it('轮盘进入开垦时会给己方区域增加人口并保留摘要', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-new-year';
        core.selectedRegionId = 'song-jin';

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        expect(next.actionWheelPosition).toBe('wheel-reclaim');
        expect(next.regions.find((region) => region.id === 'song-jin')?.population).toBe(3);
        expect(next.lastSeasonSummary?.title).toBe('轮盘开垦');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('皮岛');
    });

    it('轮盘进入军屯时会给己方区域加兵并摸牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-reclaim';
        core.selectedRegionId = 'song-jin';

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        expect(next.actionWheelPosition).toBe('wheel-military-farm');
        expect(next.regions.find((region) => region.id === 'song-jin')?.troops).toBe(3);
        expect(next.factions.ming.handCount).toBe(5);
        expect(factionHandCards(next, 'ming')).toHaveLength(6);
        expect(next.drawPileCount).toBe(18);
        expect(next.lastSeasonSummary?.title).toBe('轮盘军屯');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('获得 2 张手牌');
    });

    it('轮盘进入征兵训练时会给己方区域增加 2 部队', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'song-jin';

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        expect(next.actionWheelPosition).toBe('wheel-recruit-train');
        expect(next.regions.find((region) => region.id === 'song-jin')?.troops).toBe(4);
        expect(next.regions.find((region) => region.id === 'song-jin')?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'ming-wheel-wheel-recruit-train-regular-infantry-lv2',
                label: '大明步兵',
                faction: 'ming',
                troopKind: 'infantry',
                count: 2,
                level: 2,
            }),
        ]));
        expect(next.factions.ming.troops).toBe(20);
        expect(next.lastSeasonSummary?.title).toBe('轮盘征兵/训练');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('部队 +2');
    });

    it('轮盘征兵训练以逻辑区宁远为当前选区时，会按真实运行时区域结算并同步 selectedRegionId', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'ning-yuan';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'ming-ningyuan-infantry-lv1',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 2,
                            level: 1,
                        },
                    ],
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                    siegeState: null,
                    cityState: null,
                };
            }
            return region;
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        expect(next.actionWheelPosition).toBe('wheel-recruit-train');
        expect(next.selectedRegionId).toBe('city-region-24');
        expect(next.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 4,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({
                    id: 'ming-wheel-wheel-recruit-train-regular-infantry-lv2',
                    label: '大明步兵',
                    faction: 'ming',
                    troopKind: 'infantry',
                    count: 2,
                    level: 2,
                }),
            ]),
        });
        expect(next.lastSeasonSummary?.title).toBe('轮盘征兵/训练');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('宁远');
    });

    it('轮盘征兵训练在非围城 cityState 城市触发时会先并回守军，再建立新部队', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-25';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [
                            { id: 'ming-shanhaiguan-infantry-lv2', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 2 },
                        ],
                    },
                };
            }
            return region;
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        expect(next.actionWheelPosition).toBe('wheel-recruit-train');
        expect(next.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            troops: 4,
            population: 2,
            cityState: null,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({ id: 'ming-shanhaiguan-infantry-lv2', count: 2, level: 2 }),
                expect.objectContaining({ id: 'ming-wheel-wheel-recruit-train-regular-infantry-lv2', count: 2, level: 2 }),
            ]),
        });
        expect(next.factions.ming.troops).toBe(core.factions.ming.troops + 2);
    });

    it('轮盘征兵训练会按火炮技术等级训练已有炮兵', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'song-jin';
        core.factions.ming.armaments = [{ id: 'artillery-tech', name: '火炮技术', level: 2 }];
        core.regions = core.regions.map((region) => {
            if (region.id !== 'song-jin') {
                return region;
            }
            return {
                ...region,
                troops: 1,
                specialTroops: [
                    {
                        id: 'ming-recruit-regular-artillery-lv1',
                        label: '大明炮兵',
                        faction: 'ming',
                        troopKind: 'artillery',
                        count: 1,
                        level: 1,
                    },
                ],
            };
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        expect(next.actionWheelPosition).toBe('wheel-recruit-train');
        expect(next.regions.find((region) => region.id === 'song-jin')).toMatchObject({
            troops: 3,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({
                    id: 'ming-recruit-regular-artillery-lv2',
                    label: '大明炮兵',
                    faction: 'ming',
                    troopKind: 'artillery',
                    count: 1,
                    level: 2,
                }),
                expect.objectContaining({
                    id: 'ming-wheel-wheel-recruit-train-regular-infantry-lv2',
                    label: '大明步兵',
                    faction: 'ming',
                    troopKind: 'infantry',
                    count: 2,
                    level: 2,
                }),
            ]),
        });
        expect(next.lastSeasonSummary?.title).toBe('轮盘征兵/训练');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('训练 1 个炮兵至等级 2');
    });

    it('轮盘征兵训练不会把正规军加到附庸区，而会回退到本土控制区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-22';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-22') {
                return {
                    ...region,
                    controller: 'ming',
                    diplomacyMarkerFaction: 'ming',
                    diplomacyMarkerSide: 'vassal',
                    controlLabel: '大明附庸',
                    troops: 1,
                };
            }
            if (region.id === 'xian-xing') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                };
            }
            return region;
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        expect(next.regions.find((region) => region.id === 'city-region-22')).toMatchObject({
            controlLabel: '大明附庸',
            troops: 1,
        });
        expect(next.regions.find((region) => region.id === 'song-jin')?.troops).toBe(4);
    });

    it('轮盘进入外交雇佣时会先进入外交目标选择，并可同时放友好标记与建立雇佣军', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-hire';
        core.selectedRegionId = 'song-jin';
        core.regions = core.regions.map((region) => {
            if (region.id !== 'city-region-22') {
                return region;
            }
            return {
                ...region,
                controller: 'neutral',
                controlLabel: '中立',
                troops: 0,
                diplomacyMarkerFaction: null,
                diplomacyMarkerSide: null,
            };
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        expect(next.actionWheelPosition).toBe('wheel-attack');
        expect(next.turnPhase).toBe('diplomacy-choice');
        expect(next.selectedRegionId).toBe('song-jin');
        expect(next.diplomacySelection?.sourceRegionId).toBe('song-jin');
        expect(next.diplomacySelection?.choices.map((choice) => choice.id)).toContain('hire-only');

        const targeted = apply(next, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-22' },
        });
        expect(targeted.diplomacySelection?.targetRegionId).toBe('city-region-22');
        expect(targeted.diplomacySelection?.choices.map((choice) => choice.id)).toContain('place-friendly');

        const resolved = apply(targeted, {
            type: QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE,
            playerId: '0',
            payload: { choiceId: 'place-friendly' },
        });

        expect(resolved.turnPhase).toBe('diplomacy-choice');
        expect(resolved.selectedRegionId).toBe('city-region-22');
        expect(resolved.diplomacySelection?.resolvedSteps).toHaveLength(1);
        expect(resolved.diplomacySelection?.remainingTargetCount).toBe(2);
        expect(resolved.regions.find((region) => region.id === 'city-region-22')).toMatchObject({
            diplomacyMarkerFaction: 'ming',
            diplomacyMarkerSide: 'friendly',
            controlLabel: '大明友好',
        });

        const finished = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE,
            playerId: '0',
            payload: { choiceId: 'hire-only' },
        });

        expect(finished.regions.find((region) => region.id === 'song-jin')).toMatchObject({
            troops: 4,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({
                    id: 'ming-mercenary-lv2',
                    label: '雇佣军',
                    faction: 'ming',
                    count: 2,
                    level: 2,
                }),
            ]),
        });
        expect(finished.factions.ming.troops).toBe(20);
        expect(finished.lastSeasonSummary?.title).toBe('轮盘外交/雇佣');
        expect(finished.lastSeasonSummary?.lines[0]).toContain('皮岛');
        expect(finished.lastSeasonSummary?.lines[0]).toContain('建立 2 个等级 2 雇佣军');
        expect(finished.lastSeasonSummary?.lines[1]).toContain('外交 1：');
        expect(finished.lastSeasonSummary?.lines[1]).toContain('大明友好');
        expect(finished.lastSeasonSummary?.lines.join(' | ')).not.toContain('外交标记后续补齐');
        expect(finished.lastSeasonSummary?.lines.join(' | ')).not.toContain('当前最小正式实现');
        expect(finished.actionLog[0]?.text).toContain('轮盘外交/雇佣');
    });

    it('轮盘外交雇佣若当前选中区不是合法来源，会把 selectedRegionId 收到回退后的真实来源区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-hire';
        core.selectedRegionId = 'city-region-22';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-22') {
                return {
                    ...region,
                    controller: 'ming',
                    diplomacyMarkerFaction: 'ming',
                    diplomacyMarkerSide: 'vassal',
                    controlLabel: '大明附庸',
                    troops: 1,
                };
            }
            if (region.id === 'song-jin') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    population: 0,
                    specialTroops: [],
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        expect(next.turnPhase).toBe('diplomacy-choice');
        expect(next.selectedRegionId).toBe('song-jin');
        expect(next.diplomacySelection?.sourceRegionId).toBe('song-jin');
        expect(next.diplomacySelection?.sourceRegionName).toBe('皮岛');
    });

    it('外交目标选择中点到逻辑区辽西时，会把 selectedRegionId 收到真实运行时目标区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-hire';
        core.selectedRegionId = 'jinzhou';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    population: 0,
                    specialTroops: [],
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            if (region.id === 'city-region-19') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            if (region.controller === 'ming' && region.id !== 'jinzhou') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    siegeState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const choosing = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        expect(choosing.turnPhase).toBe('diplomacy-choice');
        expect(choosing.selectedRegionId).toBe('jinzhou');
        expect(choosing.diplomacySelection?.sourceRegionId).toBe('jinzhou');

        const targeted = apply(choosing, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'liao-xi' },
        });

        expect(targeted.turnPhase).toBe('diplomacy-choice');
        expect(targeted.selectedRegionId).toBe('city-region-19');
        expect(targeted.diplomacySelection).toMatchObject({
            targetRegionId: 'city-region-19',
            targetRegionName: '辽西',
        });
        expect(targeted.diplomacySelection?.choices.map((choice) => choice.id)).toContain('place-friendly');
    });

    it('外交已处理一步后再点逻辑区辽西时，会保留进度并把 selectedRegionId 重建到真实运行时目标区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-hire';
        core.selectedRegionId = 'jinzhou';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    population: 0,
                    specialTroops: [],
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            if (region.id === 'city-region-24' || region.id === 'city-region-19') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                    cityState: null,
                    siegeState: null,
                };
            }
            if (region.controller === 'ming' && region.id !== 'jinzhou') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    siegeState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const choosing = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        const step1Target = apply(choosing, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-24' },
        });
        const step1 = apply(step1Target, {
            type: QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE,
            playerId: '0',
            payload: { choiceId: 'place-friendly' },
        });

        expect(step1.turnPhase).toBe('diplomacy-choice');
        expect(step1.selectedRegionId).toBe('city-region-24');
        expect(step1.diplomacySelection?.remainingTargetCount).toBe(2);
        expect(step1.diplomacySelection?.resolvedSteps).toHaveLength(1);

        const retargeted = apply(step1, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'liao-xi' },
        });

        expect(retargeted.turnPhase).toBe('diplomacy-choice');
        expect(retargeted.selectedRegionId).toBe('city-region-19');
        expect(retargeted.diplomacySelection).toMatchObject({
            sourceRegionId: 'jinzhou',
            sourceRegionName: '锦州',
            targetRegionId: 'city-region-19',
            targetRegionName: '辽西',
            remainingTargetCount: 2,
        });
        expect(retargeted.diplomacySelection?.resolvedSteps).toHaveLength(1);
        expect(retargeted.diplomacySelection?.choices.map((choice) => choice.id)).toContain('place-friendly');
    });

    it('同一次外交雇佣最多可连续处理 3 个相邻区域后自动结算雇佣', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.wheelActionUsed = true;
        core.selectedRegionId = 'city-region-25';
        core.actionChoices = getActionChoicesForFaction('mongol');
        core.selectedActionId = 'khan-edict';
        core.payment = {
            required: 1,
            selected: 0,
            prompt: '需弃 1 / 已选 0',
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 2,
                };
            }
            if (region.id === 'city-region-24' || region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            if (region.id === 'city-region-28') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    diplomacyMarkerFaction: 'jin',
                    diplomacyMarkerSide: 'friendly',
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        });
        const step0 = apply(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE,
            playerId: '1',
            payload: { choiceId: 'hire-dispatch' },
        });
        expect(step0.turnPhase).toBe('diplomacy-choice');
        expect(step0.selectedRegionId).toBe('city-region-25');
        const step1Target = apply(step0, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-24' },
        });
        expect(step1Target.turnPhase).toBe('diplomacy-choice');
        expect(step1Target.selectedRegionId).toBe('city-region-24');
        expect(step1Target.diplomacySelection?.targetRegionId).toBe('city-region-24');
        const step1 = apply(step1Target, {
            type: QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE,
            playerId: '1',
            payload: { choiceId: 'place-friendly' },
        });
        expect(step1.turnPhase).toBe('diplomacy-choice');
        expect(step1.selectedRegionId).toBe('city-region-24');
        expect(step1.diplomacySelection?.targetRegionId).toBe('city-region-24');
        expect(step1.diplomacySelection?.remainingTargetCount).toBe(2);

        const step2Target = apply(step1, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-24' },
        });
        expect(step2Target.turnPhase).toBe('diplomacy-choice');
        expect(step2Target.selectedRegionId).toBe('city-region-24');
        expect(step2Target.diplomacySelection?.targetRegionId).toBe('city-region-24');
        const step2 = apply(step2Target, {
            type: QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE,
            playerId: '1',
            payload: { choiceId: 'flip-vassal' },
        });
        expect(step2.turnPhase).toBe('diplomacy-choice');
        expect(step2.selectedRegionId).toBe('city-region-24');
        expect(step2.diplomacySelection?.targetRegionId).toBe('city-region-24');
        expect(step2.diplomacySelection?.remainingTargetCount).toBe(1);
        expect(step2.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'mongol',
            diplomacyMarkerFaction: 'mongol',
            diplomacyMarkerSide: 'vassal',
            controlLabel: '蒙古附庸',
        });

        const step3Target = apply(step2, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-28' },
        });
        expect(step3Target.turnPhase).toBe('diplomacy-choice');
        expect(step3Target.selectedRegionId).toBe('city-region-28');
        expect(step3Target.diplomacySelection?.targetRegionId).toBe('city-region-28');
        const finished = apply(step3Target, {
            type: QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE,
            playerId: '1',
            payload: { choiceId: 'remove-marker' },
        });

        expect(finished.turnPhase).toBe('action-window');
        expect(finished.selectedRegionId).toBe('city-region-13');
        expect(finished.diplomacySelection).toBeNull();
        expect(finished.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            troops: 4,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({
                    id: 'mongol-mercenary-lv2',
                    count: 2,
                }),
            ]),
        });
        expect(finished.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'mongol',
            diplomacyMarkerFaction: 'mongol',
            diplomacyMarkerSide: 'vassal',
            controlLabel: '蒙古附庸',
        });
        expect(finished.regions.find((region) => region.id === 'city-region-28')).toMatchObject({
            diplomacyMarkerFaction: null,
            diplomacyMarkerSide: null,
            controlLabel: '大明',
        });
        expect(finished.lastSeasonSummary?.lines).toEqual(expect.arrayContaining([
            expect.stringContaining('建立 2 个等级 2 雇佣军'),
            expect.stringContaining('外交 1：'),
            expect.stringContaining('外交 2：'),
            expect.stringContaining('外交 3：'),
        ]));
    });

    it('移除友好标记时若雇佣军已进入 cityState，也会同步移除 cityState 雇佣军并扣减势力兵力', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.wheelActionUsed = true;
        core.selectedRegionId = 'city-region-25';
        core.actionChoices = getActionChoicesForFaction('mongol');
        core.selectedActionId = 'khan-edict';
        core.payment = {
            required: 1,
            selected: 0,
            prompt: '需弃 1 / 已选 0',
        };
        core.factions.jin.troops += 2;
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 2,
                };
            }
            if (region.id === 'city-region-24' || region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            if (region.id === 'city-region-28') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '后金友好',
                    troops: 0,
                    specialTroops: [],
                    diplomacyMarkerFaction: 'jin',
                    diplomacyMarkerSide: 'friendly',
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [
                            {
                                id: 'jin-mercenary-lv2',
                                label: '雇佣军',
                                faction: 'jin',
                                troopKind: 'infantry',
                                count: 2,
                                level: 2,
                            },
                        ],
                    },
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        });
        const choosingDiplomacy = apply(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE,
            playerId: '1',
            payload: { choiceId: 'hire-dispatch' },
        });
        expect(choosingDiplomacy.turnPhase).toBe('diplomacy-choice');
        expect(choosingDiplomacy.selectedRegionId).toBe('city-region-25');
        const step1Target = apply(choosingDiplomacy, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-24' },
        });
        expect(step1Target.turnPhase).toBe('diplomacy-choice');
        expect(step1Target.selectedRegionId).toBe('city-region-24');
        expect(step1Target.diplomacySelection?.targetRegionId).toBe('city-region-24');
        const step1 = apply(step1Target, {
            type: QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE,
            playerId: '1',
            payload: { choiceId: 'place-friendly' },
        });
        expect(step1.turnPhase).toBe('diplomacy-choice');
        expect(step1.selectedRegionId).toBe('city-region-24');
        expect(step1.diplomacySelection?.targetRegionId).toBe('city-region-24');
        const step2Target = apply(step1, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-24' },
        });
        expect(step2Target.turnPhase).toBe('diplomacy-choice');
        expect(step2Target.selectedRegionId).toBe('city-region-24');
        expect(step2Target.diplomacySelection?.targetRegionId).toBe('city-region-24');
        const step2 = apply(step2Target, {
            type: QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE,
            playerId: '1',
            payload: { choiceId: 'flip-vassal' },
        });
        expect(step2.turnPhase).toBe('diplomacy-choice');
        expect(step2.selectedRegionId).toBe('city-region-24');
        expect(step2.diplomacySelection?.targetRegionId).toBe('city-region-24');
        const targeted = apply(step2, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-28' },
        });
        expect(targeted.turnPhase).toBe('diplomacy-choice');
        expect(targeted.selectedRegionId).toBe('city-region-28');
        expect(targeted.diplomacySelection?.targetRegionId).toBe('city-region-28');
        const finished = apply(targeted, {
            type: QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE,
            playerId: '1',
            payload: { choiceId: 'remove-marker' },
        });

        expect(finished.turnPhase).toBe('action-window');
        expect(finished.selectedRegionId).toBe('city-region-13');
        expect(finished.diplomacySelection).toBeNull();
        expect(finished.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            troops: 4,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({
                    id: 'mongol-mercenary-lv2',
                    label: '雇佣军',
                    faction: 'mongol',
                    count: 2,
                    level: 2,
                }),
            ]),
        });
        expect(finished.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'mongol',
            diplomacyMarkerFaction: 'mongol',
            diplomacyMarkerSide: 'vassal',
            controlLabel: '蒙古附庸',
        });
        expect(finished.regions.find((region) => region.id === 'city-region-28')).toMatchObject({
            controller: 'ming',
            controlLabel: '大明',
            troops: 0,
            specialTroops: [],
            diplomacyMarkerFaction: null,
            diplomacyMarkerSide: null,
            cityState: {
                troops: 0,
                population: 2,
                specialTroops: [],
            },
        });
        expect(finished.factions.mongol.troops).toBe(core.factions.mongol.troops + 2);
        expect(finished.factions.jin.troops).toBe(core.factions.jin.troops - 2);
        expect(finished.lastSeasonSummary?.lines.join(' | ')).toContain('移除 2 个雇佣军');
        expect(finished.actionLog.some((entry) => entry.text.includes('移除 2 个雇佣军'))).toBe(true);
    });

    it('齐赛诺延在场时会把奈曼部视为蒙古无标记本土，不能再对其执行外交', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.wheelActionUsed = true;
        core.selectedRegionId = 'city-region-1';
        core.actionChoices = getActionChoicesForFaction('mongol');
        core.selectedActionId = 'khan-edict';
        core.payment = {
            required: 1,
            selected: 0,
            prompt: '需弃 1 / 已选 0',
        };
        core.factions = {
            ...core.factions,
            mongol: {
                ...core.factions.mongol,
                characters: core.factions.mongol.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'mongol-qisai-noyan',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-14' || region.id === 'city-region-17') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: region.id === 'city-region-14' ? 2 : 0,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        });
        expect(selecting.turnPhase).toBe('khan-edict-choice');
        expect(selecting.selectedRegionId).toBe('city-region-14');
        const chooseDiplomacy = apply(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE,
            playerId: '1',
            payload: { choiceId: 'hire-dispatch' },
        });
        expect(chooseDiplomacy.turnPhase).toBe('diplomacy-choice');
        expect(chooseDiplomacy.selectedRegionId).toBe('city-region-14');
        const targeted = apply(chooseDiplomacy, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-17' },
        });

        expect(targeted.turnPhase).toBe('diplomacy-choice');
        expect(targeted.selectedRegionId).toBe('city-region-17');
        expect(targeted.diplomacySelection?.targetRegionId).toBe('city-region-17');
        expect(targeted.diplomacySelection?.targetHint).toContain('本土区域');
        expect(targeted.diplomacySelection?.choices.map((choice) => choice.id)).toEqual(['hire-only']);
    });

    it('齐赛诺延在场时移除奈曼部控制标记后会回归蒙古本土', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.wheelActionUsed = true;
        core.selectedRegionId = 'city-region-1';
        core.actionChoices = getActionChoicesForFaction('mongol');
        core.selectedActionId = 'khan-edict';
        core.payment = {
            required: 1,
            selected: 0,
            prompt: '需弃 1 / 已选 0',
        };
        core.factions = {
            ...core.factions,
            mongol: {
                ...core.factions.mongol,
                characters: core.factions.mongol.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'mongol-qisai-noyan',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 2,
                };
            }
            if (region.id === 'city-region-17') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金友好',
                    troops: 0,
                    diplomacyMarkerFaction: 'jin',
                    diplomacyMarkerSide: 'friendly',
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        });
        expect(selecting.turnPhase).toBe('khan-edict-choice');
        expect(selecting.selectedRegionId).toBe('city-region-14');
        const chooseDiplomacy = apply(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE,
            playerId: '1',
            payload: { choiceId: 'hire-dispatch' },
        });
        expect(chooseDiplomacy.turnPhase).toBe('diplomacy-choice');
        expect(chooseDiplomacy.selectedRegionId).toBe('city-region-14');
        const targeted = apply(chooseDiplomacy, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-17' },
        });

        expect(targeted.turnPhase).toBe('diplomacy-choice');
        expect(targeted.selectedRegionId).toBe('city-region-17');
        expect(targeted.diplomacySelection?.choices.map((choice) => choice.id)).toContain('remove-marker');

        const resolved = apply(targeted, {
            type: QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE,
            playerId: '1',
            payload: { choiceId: 'remove-marker' },
        });

        expect(resolved.turnPhase).toBe('diplomacy-choice');
        expect(resolved.selectedRegionId).toBe('city-region-17');
        expect(resolved.diplomacySelection?.targetRegionId).toBe('city-region-17');
        expect(resolved.regions.find((region) => region.id === 'city-region-17')).toMatchObject({
            controller: 'mongol',
            diplomacyMarkerFaction: null,
            diplomacyMarkerSide: null,
            controlLabel: '蒙古',
        });
        expect(resolved.diplomacySelection?.resolvedSteps.at(-1)?.summary).toContain('回归 蒙古本土');
    });

    it('衮楚克图吉在场时会把敖汉部视为蒙古无标记本土，不能再对其执行外交', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.wheelActionUsed = true;
        core.selectedRegionId = 'city-region-17';
        core.actionChoices = getActionChoicesForFaction('mongol');
        core.selectedActionId = 'khan-edict';
        core.payment = {
            required: 1,
            selected: 0,
            prompt: '需弃 1 / 已选 0',
        };
        core.factions = {
            ...core.factions,
            mongol: {
                ...core.factions.mongol,
                characters: core.factions.mongol.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'mongol-gunchu-ketuji',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-17' || region.id === 'city-region-19') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: region.id === 'city-region-17' ? 2 : 0,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        });
        expect(selecting.turnPhase).toBe('khan-edict-choice');
        expect(selecting.selectedRegionId).toBe('city-region-17');
        const chooseDiplomacy = apply(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE,
            playerId: '1',
            payload: { choiceId: 'hire-dispatch' },
        });
        expect(chooseDiplomacy.turnPhase).toBe('diplomacy-choice');
        expect(chooseDiplomacy.selectedRegionId).toBe('city-region-17');
        const targeted = apply(chooseDiplomacy, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-19' },
        });

        expect(targeted.turnPhase).toBe('diplomacy-choice');
        expect(targeted.selectedRegionId).toBe('city-region-19');
        expect(targeted.diplomacySelection?.targetRegionId).toBe('city-region-19');
        expect(targeted.diplomacySelection?.targetHint).toContain('本土区域');
        expect(targeted.diplomacySelection?.choices.map((choice) => choice.id)).toEqual(['hire-only']);
    });

    it('衮楚克图吉在场时，战后劫掠自己牌堆会每人口额外多摸 1 张手牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.factions = {
            ...core.factions,
            mongol: {
                ...core.factions.mongol,
                characters: core.factions.mongol.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'mongol-gunchu-ketuji',
                })),
            },
        };
        core.postBattleSelection = {
            actionId: 'raid',
            attackerFactionId: 'mongol',
            sourceRegionId: 'city-region-17',
            sourceRegionName: '奈曼部',
            targetRegionId: 'city-region-19',
            targetRegionName: '敖汉部',
            targetRuntimeRegionId: 'city-region-19',
            committedTroops: 3,
            survivingTroops: 2,
            attackerLosses: 1,
            movementProfileId: null,
            attackerCasualtyPriority: 'highest-level',
            originalController: 'jin',
            originalControlLabel: '后金',
            title: '战后处理',
            summary: '测试',
            choices: [
                {
                    id: 'occupy-plunder-2',
                    mode: 'occupy',
                    regionId: 'city-region-19',
                    plunderPopulation: 2,
                    plunderSource: 'attacker',
                    label: '测试',
                    detail: '测试',
                },
            ],
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-17') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 3,
                    specialTroops: [
                        {
                            id: 'mongol-cavalry-lv2',
                            label: '蒙古骑兵',
                            faction: 'mongol',
                            troopKind: 'cavalry',
                            count: 3,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-19') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 2,
                    specialTroops: [],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '1',
            payload: { choiceId: 'occupy-plunder-2' },
        });

        expect(resolved.factions.mongol.handCount).toBe(core.factions.mongol.handCount + 4);
        expect(resolved.factions.mongol.discardPileCount).toBe(core.factions.mongol.discardPileCount);
        expect(resolved.factions.mongol.drawPileCount).toBe(core.factions.mongol.drawPileCount - 4);
        expect(resolved.actionLog[0]?.text).toContain('获得 4 张手牌');
    });

    it('衮楚克图吉在场时，骑兵劫掠自己牌堆会每人口额外多摸 1 张手牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'wheel-dispatch',
            title: '调骑 4 待结算',
            attackerFactionId: 'mongol',
            sourceRegionId: 'city-region-17',
            sourceRegionName: '奈曼部',
            targetRegionId: 'city-region-19',
            targetRegionName: '敖汉部',
            targetRuntimeRegionId: 'city-region-19',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 3,
            committedTroops: 3,
            movementProfileId: 'dispatch-cavalry',
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.factions = {
            ...core.factions,
            mongol: {
                ...core.factions.mongol,
                characters: core.factions.mongol.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'mongol-gunchu-ketuji',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-17') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 3,
                    specialTroops: [
                        {
                            id: 'mongol-cavalry-lv2',
                            label: '蒙古骑兵',
                            faction: 'mongol',
                            troopKind: 'cavalry',
                            count: 3,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-19') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 1,
                    population: 3,
                    specialTroops: [
                        {
                            id: 'jin-cavalry-lv2',
                            label: '后金骑兵',
                            faction: 'jin',
                            troopKind: 'cavalry',
                            count: 1,
                            level: 2,
                        },
                    ],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '1',
            payload: { attackerCavalryPlunder: true },
        });

        expect(resolved.factions.mongol.handCount).toBe(core.factions.mongol.handCount + 4);
        expect(resolved.factions.mongol.discardPileCount).toBe(core.factions.mongol.discardPileCount);
        expect(resolved.factions.mongol.drawPileCount).toBe(core.factions.mongol.drawPileCount - 4);
        expect(resolved.actionLog[0]?.text).toContain('获得 4 张手牌');
    });

    it('绰克图台吉在场时会把外喀尔喀部视为蒙古无标记本土，不能再对其执行外交', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.wheelActionUsed = true;
        core.selectedRegionId = 'city-region-1';
        core.actionChoices = getActionChoicesForFaction('mongol');
        core.selectedActionId = 'khan-edict';
        core.payment = {
            required: 1,
            selected: 0,
            prompt: '需弃 1 / 已选 0',
        };
        core.factions = {
            ...core.factions,
            mongol: {
                ...core.factions.mongol,
                characters: core.factions.mongol.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'mongol-choghtu-taiji',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-1' || region.id === 'city-region-2') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: region.id === 'city-region-1' ? 2 : 0,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        });
        expect(selecting.turnPhase).toBe('khan-edict-choice');
        expect(selecting.selectedRegionId).toBe('city-region-1');
        const chooseDiplomacy = apply(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE,
            playerId: '1',
            payload: { choiceId: 'hire-dispatch' },
        });
        expect(chooseDiplomacy.turnPhase).toBe('diplomacy-choice');
        expect(chooseDiplomacy.selectedRegionId).toBe('city-region-1');
        const targeted = apply(chooseDiplomacy, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-2' },
        });

        expect(targeted.turnPhase).toBe('diplomacy-choice');
        expect(targeted.selectedRegionId).toBe('city-region-2');
        expect(targeted.diplomacySelection?.targetRegionId).toBe('city-region-2');
        expect(targeted.diplomacySelection?.targetHint).toContain('本土区域');
        expect(targeted.diplomacySelection?.choices.map((choice) => choice.id)).toEqual(['hire-only']);
    });

    it('林丹·乎图克图在场时会把巴林部视为蒙古无标记本土，不能再对其执行外交', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.wheelActionUsed = true;
        core.selectedRegionId = 'city-region-1';
        core.actionChoices = getActionChoicesForFaction('mongol');
        core.selectedActionId = 'khan-edict';
        core.payment = {
            required: 1,
            selected: 0,
            prompt: '需弃 1 / 已选 0',
        };
        core.factions = {
            ...core.factions,
            mongol: {
                ...core.factions.mongol,
                characters: core.factions.mongol.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'mongol-lindan-hutuktu',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-1' || region.id === 'city-region-8') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: region.id === 'city-region-1' ? 2 : 0,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            if (lindanInfluenceRegionIds.has(region.id) && region.id !== 'city-region-8' && region.id !== 'city-region-14') {
                return {
                    ...region,
                    troops: Math.max(1, region.troops),
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        });
        expect(selecting.turnPhase).toBe('khan-edict-choice');
        expect(selecting.selectedRegionId).toBe('city-region-1');
        const chooseDiplomacy = apply(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE,
            playerId: '1',
            payload: { choiceId: 'hire-dispatch' },
        });
        expect(chooseDiplomacy.turnPhase).toBe('diplomacy-choice');
        expect(chooseDiplomacy.selectedRegionId).toBe('city-region-1');
        const targeted = apply(chooseDiplomacy, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-8' },
        });

        expect(targeted.turnPhase).toBe('diplomacy-choice');
        expect(targeted.selectedRegionId).toBe('city-region-8');
        expect(targeted.diplomacySelection?.targetRegionId).toBe('city-region-8');
        expect(targeted.diplomacySelection?.targetHint).toContain('本土区域');
        expect(targeted.diplomacySelection?.choices.map((choice) => choice.id)).toEqual(['hire-only']);
    });

    it('林丹·乎图克图在场时会在新的蒙古行动窗口前向蒙古区域放置 1 步影响力，且同一窗口不重复触发', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.selectedRegionId = 'city-region-14';
        core.factions = {
            ...core.factions,
            mongol: {
                ...core.factions.mongol,
                characters: core.factions.mongol.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'mongol-lindan-hutuktu',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 3,
                };
            }
            if (region.id === 'city-region-8') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    specialTroops: [],
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            if (lindanInfluenceRegionIds.has(region.id) && region.id !== 'city-region-8' && region.id !== 'city-region-14') {
                return {
                    ...region,
                    troops: Math.max(1, region.troops),
                };
            }
            return region;
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-14' },
        });
        expect(firstWindow.turnPhase).toBe('action-window');
        expect(firstWindow.selectedRegionId).toBe('city-region-8');
        expect(firstWindow.regions.find((region) => region.id === 'city-region-8')).toMatchObject({
            diplomacyMarkerFaction: 'mongol',
            diplomacyMarkerSide: 'friendly',
            controlLabel: '蒙古友好',
        });
        expect(firstWindow.mapTokens.find((token) => token.id === 'diplomacy-marker-city-region-8')).toMatchObject({
            faction: 'mongol',
            imageSrc: 'qidahen/markers/mongol-control-diplomacy-marker-b',
        });

        const sameWindow = apply(firstWindow, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-25' },
        });
        expect(sameWindow.turnPhase).toBe('action-window');
        expect(sameWindow.selectedRegionId).toBe('city-region-25');
        expect(sameWindow.regions.find((region) => region.id === 'city-region-8')).toMatchObject({
            diplomacyMarkerFaction: 'mongol',
            diplomacyMarkerSide: 'friendly',
            controlLabel: '蒙古友好',
        });

        const secondWindow = apply({
            ...sameWindow,
            wheelActionUsed: true,
            factionActionUsed: false,
        }, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-14' },
        });
        expect(secondWindow.turnPhase).toBe('action-window');
        expect(secondWindow.selectedRegionId).toBe('city-region-8');
        expect(secondWindow.regions.find((region) => region.id === 'city-region-8')).toMatchObject({
            controller: 'mongol',
            diplomacyMarkerFaction: 'mongol',
            diplomacyMarkerSide: 'vassal',
            controlLabel: '蒙古附庸',
        });
        expect(secondWindow.actionLog[0]?.text).toContain('林丹·乎图克图');
    });

    it('林丹·乎图克图当前选中逻辑区辽西时，会优先向对应的真实运行时区域放置影响力', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.selectedRegionId = 'liao-xi';
        core.factions = {
            ...core.factions,
            mongol: {
                ...core.factions.mongol,
                characters: core.factions.mongol.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'mongol-lindan-hutuktu',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 3,
                    specialTroops: [],
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            if (region.id === 'city-region-19') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                    cityState: null,
                    siegeState: null,
                };
            }
            return region;
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-14' },
        });

        expect(firstWindow.regions.find((region) => region.id === 'city-region-19')).toMatchObject({
            diplomacyMarkerFaction: 'mongol',
            diplomacyMarkerSide: 'friendly',
            controlLabel: '蒙古友好',
        });
        expect(firstWindow.selectedRegionId).toBe('city-region-19');
        expect(firstWindow.actionLog[0]?.text).toContain('辽西');
    });

    it('毛文龙在场时会在新的大明行动窗口前免费训练东江部队，且同一窗口不重复触发', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-22';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                armaments: [{ id: 'artillery-tech', name: '火炮技术', level: 2 }],
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-mao-wenlong',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion || region.id !== 'city-region-22') {
                return region;
            }
            return {
                ...region,
                controller: 'ming',
                controlLabel: '大明',
                troops: 3,
                specialTroops: [
                    { id: 'ming-dongjiang-infantry-lv2', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 2 },
                    { id: 'ming-dongjiang-cavalry-lv3', label: '大明骑兵', faction: 'ming', troopKind: 'cavalry', count: 1, level: 3 },
                    { id: 'ming-dongjiang-artillery-lv1', label: '大明炮兵', faction: 'ming', troopKind: 'artillery', count: 1, level: 1 },
                ],
            };
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-22' },
        });
        expect(firstWindow.turnPhase).toBe('action-window');
        expect(firstWindow.selectedRegionId).toBe('city-region-22');
        expect(firstWindow.regions.find((region) => region.id === 'city-region-22')).toMatchObject({
            specialTroops: expect.arrayContaining([
                expect.objectContaining({ id: 'ming-dongjiang-infantry-lv3', troopKind: 'infantry', count: 1, level: 3 }),
                expect.objectContaining({ id: 'ming-dongjiang-cavalry-lv4', troopKind: 'cavalry', count: 1, level: 4 }),
                expect.objectContaining({ id: 'ming-dongjiang-artillery-lv2', troopKind: 'artillery', count: 1, level: 2 }),
            ]),
        });
        expect(firstWindow.actionLog[0]?.text).toContain('毛文龙在东江免费训练 3 个部队');

        const sameWindow = apply(firstWindow, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'song-jin' },
        });
        expect(sameWindow.turnPhase).toBe('action-window');
        expect(sameWindow.selectedRegionId).toBe('song-jin');
        expect(sameWindow.regions.find((region) => region.id === 'city-region-22')?.specialTroops).toEqual(
            firstWindow.regions.find((region) => region.id === 'city-region-22')?.specialTroops,
        );
    });

    it('毛文龙免费训练会先并回东江的非围城 cityState 特殊部队再训练', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-22';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                armaments: [{ id: 'artillery-tech', name: '火炮技术', level: 2 }],
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-mao-wenlong',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion || region.id !== 'city-region-22') {
                return region;
            }
            return {
                ...region,
                controller: 'ming',
                controlLabel: '大明',
                troops: 0,
                population: 0,
                specialTroops: [],
                cityState: {
                    troops: 2,
                    population: 2,
                    specialTroops: [
                        { id: 'ming-dongjiang-infantry-lv2', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 2 },
                        { id: 'ming-dongjiang-artillery-lv1', label: '大明炮兵', faction: 'ming', troopKind: 'artillery', count: 1, level: 1 },
                    ],
                },
            };
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-22' },
        });

        expect(firstWindow.regions.find((region) => region.id === 'city-region-22')).toMatchObject({
            troops: 2,
            population: 2,
            cityState: null,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({ id: 'ming-dongjiang-infantry-lv3', troopKind: 'infantry', count: 1, level: 3 }),
                expect.objectContaining({ id: 'ming-dongjiang-artillery-lv2', troopKind: 'artillery', count: 1, level: 2 }),
            ]),
        });
        expect(firstWindow.actionLog[0]?.text).toContain('毛文龙在东江免费训练 2 个部队');
    });

    it('毛文龙在新行动窗口触发免费训练时，会把 selectedRegionId 保持在真实训练区东江', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-22';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                armaments: [{ id: 'artillery-tech', name: '火炮技术', level: 2 }],
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-mao-wenlong',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-22') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    specialTroops: [
                        { id: 'ming-dongjiang-infantry-lv2', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 2 },
                        { id: 'ming-dongjiang-cavalry-lv3', label: '大明骑兵', faction: 'ming', troopKind: 'cavalry', count: 1, level: 3 },
                        { id: 'ming-dongjiang-artillery-lv1', label: '大明炮兵', faction: 'ming', troopKind: 'artillery', count: 1, level: 1 },
                    ],
                };
            }
            if (region.id === 'song-jin') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'song-jin' },
        });

        expect(firstWindow.selectedRegionId).toBe('city-region-22');
        expect(firstWindow.actionLog[0]?.text).toContain('毛文龙在东江免费训练 3 个部队');
    });

    it('孙元化与袁崇焕同时在场时会先进入弃 2 牌打科技选择', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-25';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-sun-yuanhua' || character.id === 'ming-yuan-chonghuan',
                })),
            },
        };

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'song-jin' },
        });

        expect(firstWindow.turnPhase).toBe('sun-yuanhua-tech-choice');
        expect(firstWindow.sunYuanhuaTechSelection).toMatchObject({
            source: 'sun-yuanhua',
            requiredCardCount: 2,
        });
        expect(firstWindow.sunYuanhuaTechSelection?.candidateCardIds.length ?? 0).toBeGreaterThanOrEqual(2);
        expect(firstWindow.actionLog[0]?.text).toContain('孙元化可在行动前弃 2 张手牌');
    });

    it('孙元化确认弃 2 牌后会升级科技并扣掉手牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-25';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-sun-yuanhua' || character.id === 'ming-yuan-chonghuan',
                })),
            },
        };

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'song-jin' },
        });
        const selectedCardIds = factionHandCards(selecting, 'ming').slice(0, 2).map((card) => card.id);
        expect(selectedCardIds).toHaveLength(2);

        const selectedTwice = selectedCardIds.reduce((state, cardId) => apply(state, {
            type: QIDAHEN_COMMANDS.SELECT_SUN_YUANHUA_TECH_CARD,
            playerId: '0',
            payload: { cardId },
        }), selecting);

        const resolved = apply(selectedTwice, {
            type: QIDAHEN_COMMANDS.RESOLVE_SUN_YUANHUA_TECH,
            playerId: '0',
            payload: { choiceId: 'confirm' },
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.sunYuanhuaTechSelection).toBeNull();
        expect(resolved.factions.ming.handCount).toBe(core.factions.ming.handCount - 2);
        expect(resolved.factions.ming.discardPileCount).toBe(core.factions.ming.discardPileCount + 2);
        expect(resolved.discardPileCount).toBe(core.discardPileCount + 2);
        expect(resolved.factions.ming.armaments.find((armament) => armament.id === 'artillery-tech')?.level).toBe(2);
        expect(resolved.selectedRegionId).toBe('city-region-25');
        expect(resolved.lastSeasonSummary?.title).toBe('孙元化弃牌科技');
        expect(resolved.lastSeasonSummary?.lines.join(' | ')).toContain('火炮技术 升至 2 级');
        expect(resolved.actionLog[0]?.text).toContain('孙元化弃 2 张手牌');
    });

    it('孙元化跳过后同窗口仍会继续触发高第和王化贞', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-25';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-yuan-chonghuan' || character.id === 'ming-sun-yuanhua' || character.id === 'ming-gao-di' || character.id === 'ming-wang-huazhen',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    population: 2,
                    specialTroops: [
                        { id: 'ming-shanhaiguan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 3, level: 1 },
                    ],
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 1,
                    specialTroops: [
                        { id: 'ming-ningyuan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 1 },
                    ],
                };
            }
            return region;
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });
        expect(firstWindow.turnPhase).toBe('sun-yuanhua-tech-choice');

        const afterSunSkip = apply(firstWindow, {
            type: QIDAHEN_COMMANDS.RESOLVE_SUN_YUANHUA_TECH,
            playerId: '0',
            payload: { choiceId: 'skip' },
        });
        expect(afterSunSkip.turnPhase).toBe('gao-di-dispatch-choice');
        expect(afterSunSkip.selectedRegionId).toBe('city-region-25');
        expect(afterSunSkip.gaoDiDispatchSelection).toMatchObject({
            source: 'gao-di',
            sourceRegionId: 'city-region-25',
        });
        expect(afterSunSkip.actionLog[0]?.text).toContain('高第可在行动前弃 1 张手牌');

        const afterGaoSkip = apply(afterSunSkip, {
            type: QIDAHEN_COMMANDS.RESOLVE_GAO_DI_DISPATCH,
            playerId: '0',
            payload: { choiceId: 'skip' },
        });
        expect(afterGaoSkip.turnPhase).toBe('internal-dispatch-choice');
        expect(afterGaoSkip.internalDispatchSelection).toMatchObject({
            source: 'wang-huazhen',
            sourceRegionId: 'city-region-25',
        });
    });

    it('孙元化弃牌科技等待确认时点逻辑区宁远，不会把后续人物窗口来源漂离真实当前区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-25';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-yuan-chonghuan' || character.id === 'ming-sun-yuanhua' || character.id === 'ming-gao-di' || character.id === 'ming-wang-huazhen',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    population: 2,
                    specialTroops: [
                        { id: 'ming-shanhaiguan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 3, level: 1 },
                    ],
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 1,
                    specialTroops: [
                        { id: 'ming-ningyuan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 1 },
                    ],
                };
            }
            return region;
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });

        expect(firstWindow.turnPhase).toBe('sun-yuanhua-tech-choice');
        expect(firstWindow.selectedRegionId).toBe('city-region-25');

        const reselected = apply(firstWindow, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'ning-yuan' },
        });

        expect(reselected.turnPhase).toBe('sun-yuanhua-tech-choice');
        expect(reselected.selectedRegionId).toBe('city-region-25');

        const afterSunSkip = apply(reselected, {
            type: QIDAHEN_COMMANDS.RESOLVE_SUN_YUANHUA_TECH,
            playerId: '0',
            payload: { choiceId: 'skip' },
        });

        expect(afterSunSkip.turnPhase).toBe('gao-di-dispatch-choice');
        expect(afterSunSkip.selectedRegionId).toBe('city-region-25');
        expect(afterSunSkip.gaoDiDispatchSelection).toMatchObject({
            source: 'gao-di',
            sourceRegionId: 'city-region-25',
        });

        const afterGaoSkip = apply(afterSunSkip, {
            type: QIDAHEN_COMMANDS.RESOLVE_GAO_DI_DISPATCH,
            playerId: '0',
            payload: { choiceId: 'skip' },
        });

        expect(afterGaoSkip.turnPhase).toBe('internal-dispatch-choice');
        expect(afterGaoSkip.selectedRegionId).toBe('city-region-25');
        expect(afterGaoSkip.internalDispatchSelection).toMatchObject({
            source: 'wang-huazhen',
            sourceRegionId: 'city-region-25',
        });
    });

    it('孙元化弃牌科技等待确认时点逻辑区宁远，确认后仍会保住真实焦点并继续进入高第窗口', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-25';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-yuan-chonghuan' || character.id === 'ming-sun-yuanhua' || character.id === 'ming-gao-di' || character.id === 'ming-wang-huazhen',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    population: 2,
                    specialTroops: [
                        { id: 'ming-shanhaiguan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 3, level: 1 },
                    ],
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 1,
                    specialTroops: [
                        { id: 'ming-ningyuan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 1 },
                    ],
                };
            }
            return region;
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });
        const reselected = apply(firstWindow, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'ning-yuan' },
        });
        const selectedCardIds = factionHandCards(reselected, 'ming').slice(0, 2).map((card) => card.id);
        expect(selectedCardIds).toHaveLength(2);

        const selectedTwice = selectedCardIds.reduce((state, cardId) => apply(state, {
            type: QIDAHEN_COMMANDS.SELECT_SUN_YUANHUA_TECH_CARD,
            playerId: '0',
            payload: { cardId },
        }), reselected);

        const resolved = apply(selectedTwice, {
            type: QIDAHEN_COMMANDS.RESOLVE_SUN_YUANHUA_TECH,
            playerId: '0',
            payload: { choiceId: 'confirm' },
        });

        expect(resolved.turnPhase).toBe('gao-di-dispatch-choice');
        expect(resolved.selectedRegionId).toBe('city-region-25');
        expect(resolved.factions.ming.armaments.find((armament) => armament.id === 'artillery-tech')?.level).toBe(2);
        expect(resolved.gaoDiDispatchSelection).toMatchObject({
            source: 'gao-di',
            sourceRegionId: 'city-region-25',
        });
        expect(resolved.actionLog[0]?.text).toContain('高第可在行动前弃 1 张手牌');
    });

    it('高第在场时会先进入弃牌调度选择，跳过后同窗口仍会继续触发王化贞免费调度', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-25';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-gao-di' || character.id === 'ming-wang-huazhen',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    population: 2,
                    specialTroops: [
                        { id: 'ming-shanhaiguan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 3, level: 1 },
                    ],
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 1,
                    specialTroops: [
                        { id: 'ming-ningyuan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 1 },
                    ],
                };
            }
            return region;
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });

        expect(firstWindow.turnPhase).toBe('gao-di-dispatch-choice');
        expect(firstWindow.selectedRegionId).toBe('city-region-25');
        expect(firstWindow.gaoDiDispatchSelection).toMatchObject({
            source: 'gao-di',
            sourceRegionId: 'city-region-25',
            sourceRegionName: '山海关',
        });
        expect(firstWindow.gaoDiDispatchSelection?.candidateCardIds.length ?? 0).toBeGreaterThanOrEqual(3);
        expect(firstWindow.actionLog[0]?.text).toContain('高第可在行动前弃 1 张手牌');

        const skipped = apply(firstWindow, {
            type: QIDAHEN_COMMANDS.RESOLVE_GAO_DI_DISPATCH,
            playerId: '0',
            payload: { choiceId: 'skip' },
        });

        expect(skipped.turnPhase).toBe('internal-dispatch-choice');
        expect(skipped.gaoDiDispatchSelection).toBeNull();
        expect(skipped.internalDispatchSelection).toMatchObject({
            source: 'wang-huazhen',
            sourceRegionId: 'city-region-25',
        });
        expect(skipped.actionLog[0]?.text).toContain('王化贞可在行动前免费调度 2 个部队');
    });

    it('高第与王化贞从逻辑区宁远进入人物窗口时，会把 selectedRegionId 收到真实运行时来源区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'ning-yuan';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-gao-di' || character.id === 'ming-wang-huazhen',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    population: 2,
                    specialTroops: [
                        { id: 'ming-ningyuan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 3, level: 1 },
                    ],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 1,
                    specialTroops: [
                        { id: 'ming-shanhaiguan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 1 },
                    ],
                };
            }
            return region;
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'ning-yuan' },
        });

        expect(firstWindow.turnPhase).toBe('gao-di-dispatch-choice');
        expect(firstWindow.selectedRegionId).toBe('city-region-24');
        expect(firstWindow.gaoDiDispatchSelection).toMatchObject({
            source: 'gao-di',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
        });

        const skipped = apply(firstWindow, {
            type: QIDAHEN_COMMANDS.RESOLVE_GAO_DI_DISPATCH,
            playerId: '0',
            payload: { choiceId: 'skip' },
        });

        expect(skipped.turnPhase).toBe('internal-dispatch-choice');
        expect(skipped.selectedRegionId).toBe('city-region-24');
        expect(skipped.internalDispatchSelection).toMatchObject({
            source: 'wang-huazhen',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
        });
    });

    it('高第与王化贞人物窗口内点逻辑区宁远时，会把 selectedRegionId 与来源区重建到真实运行时区域', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-25';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-gao-di' || character.id === 'ming-wang-huazhen',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    population: 2,
                    specialTroops: [
                        { id: 'ming-ningyuan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 3, level: 1 },
                    ],
                    cityState: null,
                    siegeState: null,
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 1,
                    specialTroops: [
                        { id: 'ming-shanhaiguan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 1 },
                    ],
                    cityState: null,
                    siegeState: null,
                };
            }
            return region;
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });

        expect(firstWindow.turnPhase).toBe('gao-di-dispatch-choice');
        expect(firstWindow.selectedRegionId).toBe('city-region-25');
        expect(firstWindow.gaoDiDispatchSelection).toMatchObject({
            sourceRegionId: 'city-region-25',
            sourceRegionName: '山海关',
        });

        const retargetedGaoDi = apply(firstWindow, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'ning-yuan' },
        });

        expect(retargetedGaoDi.turnPhase).toBe('gao-di-dispatch-choice');
        expect(retargetedGaoDi.selectedRegionId).toBe('city-region-24');
        expect(retargetedGaoDi.gaoDiDispatchSelection).toMatchObject({
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
        });

        const skipped = apply(firstWindow, {
            type: QIDAHEN_COMMANDS.RESOLVE_GAO_DI_DISPATCH,
            playerId: '0',
            payload: { choiceId: 'skip' },
        });

        expect(skipped.turnPhase).toBe('internal-dispatch-choice');
        expect(skipped.selectedRegionId).toBe('city-region-25');
        expect(skipped.internalDispatchSelection).toMatchObject({
            sourceRegionId: 'city-region-25',
            sourceRegionName: '山海关',
        });

        const retargetedWang = apply(skipped, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'ning-yuan' },
        });

        expect(retargetedWang.turnPhase).toBe('internal-dispatch-choice');
        expect(retargetedWang.selectedRegionId).toBe('city-region-24');
        expect(retargetedWang.internalDispatchSelection).toMatchObject({
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
        });
    });

    it('高第弃 1 张手牌后可以按所选数量调度部队到相邻友方区域', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-25';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-gao-di',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    population: 2,
                    specialTroops: [
                        { id: 'ming-shanhaiguan-infantry-lv2', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 4, level: 2 },
                    ],
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 1,
                    specialTroops: [
                        { id: 'ming-ningyuan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 1 },
                    ],
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });
        const selectedCardId = factionHandCards(selecting, 'ming')[0]?.id;
        expect(selectedCardId).toBeTruthy();

        const selectedCard = apply(selecting, {
            type: QIDAHEN_COMMANDS.SELECT_GAO_DI_DISPATCH_CARD,
            playerId: '0',
            payload: { cardId: selectedCardId! },
        });
        const choiceId = selectedCard.gaoDiDispatchSelection?.candidates.find((candidate) => (
            candidate.targetRegionId === 'city-region-24'
            && candidate.mode === 'troops'
            && candidate.committedTroops === 3
        ))?.id;
        expect(choiceId).toBeTruthy();

        const resolved = apply(selectedCard, {
            type: QIDAHEN_COMMANDS.RESOLVE_GAO_DI_DISPATCH,
            playerId: '0',
            payload: { choiceId: choiceId! },
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.gaoDiDispatchSelection).toBeNull();
        expect(resolved.selectedRegionId).toBe('city-region-24');
        expect(resolved.factions.ming.handCount).toBe(core.factions.ming.handCount - 1);
        expect(resolved.factions.ming.discardPileCount).toBe(core.factions.ming.discardPileCount + 1);
        expect(resolved.discardPileCount).toBe(core.discardPileCount + 1);
        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            troops: 1,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 4,
        });
        expect(resolved.lastSeasonSummary?.title).toBe('高第弃牌调度');
        expect(resolved.lastSeasonSummary?.lines.join(' | ')).toContain('调度 3 个部队');
        expect(resolved.actionLog[0]?.text).toContain('弃 1 张手牌');
    });

    it('高第弃 1 张手牌后可以按所选数量调度人口到相邻友方区域', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'song-jin';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-gao-di',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    population: 6,
                    specialTroops: [
                        { id: 'ming-shanhaiguan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 1 },
                    ],
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 1,
                    specialTroops: [
                        { id: 'ming-ningyuan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 1 },
                    ],
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });
        const selectedCardId = factionHandCards(selecting, 'ming')[1]?.id ?? factionHandCards(selecting, 'ming')[0]?.id;
        expect(selectedCardId).toBeTruthy();

        const selectedCard = apply(selecting, {
            type: QIDAHEN_COMMANDS.SELECT_GAO_DI_DISPATCH_CARD,
            playerId: '0',
            payload: { cardId: selectedCardId! },
        });
        const choiceId = selectedCard.gaoDiDispatchSelection?.candidates.find((candidate) => (
            candidate.targetRegionId === 'city-region-24'
            && candidate.mode === 'population'
            && candidate.committedPopulation === 5
        ))?.id;
        expect(choiceId).toBeTruthy();

        const resolved = apply(selectedCard, {
            type: QIDAHEN_COMMANDS.RESOLVE_GAO_DI_DISPATCH,
            playerId: '0',
            payload: { choiceId: choiceId! },
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.selectedRegionId).toBe('city-region-24');
        expect(resolved.factions.ming.handCount).toBe(core.factions.ming.handCount - 1);
        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            population: 1,
            troops: 2,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            population: 6,
            troops: 1,
        });
        expect(resolved.lastSeasonSummary?.lines.join(' | ')).toContain('调度 5 个人口');
        expect(resolved.actionLog[0]?.text).toContain('调度');
        expect(resolved.actionLog[0]?.text).toContain('5 个人口');
    });

    it('高第弃牌调度会把非围城 cityState 城市识别为可用来源区，并正确搬出守军', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-25';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-gao-di',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [
                            { id: 'ming-shanhaiguan-infantry-lv2', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 2 },
                        ],
                    },
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 1,
                    specialTroops: [],
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });

        expect(selecting.gaoDiDispatchSelection).toMatchObject({
            sourceRegionId: 'city-region-25',
            sourceRegionName: '山海关',
            maxTroops: 2,
            maxPopulation: 2,
        });

        const selectedCardId = factionHandCards(selecting, 'ming')[0]?.id;
        expect(selectedCardId).toBeTruthy();

        const selectedCard = apply(selecting, {
            type: QIDAHEN_COMMANDS.SELECT_GAO_DI_DISPATCH_CARD,
            playerId: '0',
            payload: { cardId: selectedCardId! },
        });
        const choiceId = selectedCard.gaoDiDispatchSelection?.candidates.find((candidate) => (
            candidate.targetRegionId === 'city-region-24'
            && candidate.mode === 'troops'
            && candidate.committedTroops === 2
        ))?.id;
        expect(choiceId).toBeTruthy();

        const resolved = apply(selectedCard, {
            type: QIDAHEN_COMMANDS.RESOLVE_GAO_DI_DISPATCH,
            playerId: '0',
            payload: { choiceId: choiceId! },
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            troops: 0,
            population: 2,
            specialTroops: [],
            cityState: null,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 3,
            specialTroops: [
                expect.objectContaining({ id: 'ming-shanhaiguan-infantry-lv2', count: 2 }),
            ],
        });
    });

    it('高第弃牌调度可把部队增援到己方围城区域，并直接并入 siegeState', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-24';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-gao-di',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    population: 2,
                    specialTroops: [
                        { id: 'ming-ningyuan-cavalry-lv1', label: '大明骑兵', faction: 'ming', troopKind: 'cavalry', count: 1, level: 1 },
                        { id: 'ming-ningyuan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 1 },
                    ],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'ming',
                        attackerTroops: 2,
                        attackerSpecialTroops: [
                            { id: 'ming-shanhaiguan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 1 },
                        ],
                        sourceRegionId: 'city-region-24',
                    },
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-24' },
        });
        const selectedCardId = factionHandCards(selecting, 'ming')[0]?.id;
        expect(selectedCardId).toBeTruthy();

        const selectedCard = apply(selecting, {
            type: QIDAHEN_COMMANDS.SELECT_GAO_DI_DISPATCH_CARD,
            playerId: '0',
            payload: { cardId: selectedCardId! },
        });

        expect(selectedCard.gaoDiDispatchSelection?.candidates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                targetRegionId: 'city-region-25',
                mode: 'troops',
                committedTroops: 2,
            }),
        ]));
        expect(selectedCard.gaoDiDispatchSelection?.candidates.find((candidate) => (
            candidate.targetRegionId === 'city-region-25'
            && candidate.mode === 'population'
        ))).toBeUndefined();

        const choiceId = selectedCard.gaoDiDispatchSelection?.candidates.find((candidate) => (
            candidate.targetRegionId === 'city-region-25'
            && candidate.mode === 'troops'
            && candidate.committedTroops === 2
        ))?.id;
        expect(choiceId).toBeTruthy();

        const resolved = apply(selectedCard, {
            type: QIDAHEN_COMMANDS.RESOLVE_GAO_DI_DISPATCH,
            playerId: '0',
            payload: { choiceId: choiceId! },
        });

        expect(resolved.selectedRegionId).toBe('city-region-25');
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 1,
            population: 2,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            troops: 0,
            population: 0,
            siegeState: {
                attackerFactionId: 'ming',
                attackerTroops: 4,
                attackerSpecialTroops: [
                    expect.objectContaining({ id: 'ming-shanhaiguan-infantry-lv1', count: 2 }),
                    expect.objectContaining({ id: 'ming-ningyuan-cavalry-lv1', count: 1 }),
                    expect.objectContaining({ id: 'ming-ningyuan-infantry-lv1', count: 1 }),
                ],
            },
            cityState: {
                troops: 2,
                population: 2,
                specialTroops: [],
            },
        });
        expect(resolved.lastSeasonSummary?.lines.join(' | ')).toContain('增援围城部队 2 个部队');
        expect(resolved.actionLog[0]?.text).toContain('增援围城部队 2 个部队');
    });

    it('王化贞在场时会在新的大明行动窗口前进入免费内部调度选择，且同一窗口不重复触发', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'song-jin';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-wang-huazhen',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    specialTroops: [
                        { id: 'ming-shanhaiguan-artillery-lv2', label: '大明炮兵', faction: 'ming', troopKind: 'artillery', count: 1, level: 2 },
                        { id: 'ming-shanhaiguan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 1 },
                    ],
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                };
            }
            return region;
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });

        expect(firstWindow.turnPhase).toBe('internal-dispatch-choice');
        expect(firstWindow.selectedRegionId).toBe('city-region-25');
        expect(firstWindow.internalDispatchSelection).toMatchObject({
            source: 'wang-huazhen',
            sourceRegionId: 'city-region-25',
            sourceRegionName: '山海关',
            maxTroops: 2,
        });
        expect(firstWindow.internalDispatchSelection?.candidates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                targetRegionId: 'city-region-24',
                targetRegionName: '宁远',
                committedTroops: 2,
            }),
        ]));
        expect(firstWindow.actionLog[0]?.text).toContain('王化贞可在行动前免费调度 2 个部队');

        const sameWindow = apply(firstWindow, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-24' },
        });

        expect(sameWindow.turnPhase).toBe('internal-dispatch-choice');
        expect(sameWindow.selectedRegionId).toBe('city-region-24');
        expect(sameWindow.internalDispatchSelection?.sourceRegionId).toBe('city-region-24');
        expect(sameWindow.actionLog[0]?.text).toBe(firstWindow.actionLog[0]?.text);
    });

    it('王化贞内部调度会真实把 2 个部队从源区搬到友方目标区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-25';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-wang-huazhen',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    specialTroops: [
                        { id: 'ming-shanhaiguan-artillery-lv2', label: '大明炮兵', faction: 'ming', troopKind: 'artillery', count: 1, level: 2 },
                        { id: 'ming-shanhaiguan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 1 },
                    ],
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    specialTroops: [],
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });
        const choiceId = selecting.internalDispatchSelection?.candidates.find((candidate) => candidate.targetRegionId === 'city-region-24')?.id;
        expect(choiceId).toBeTruthy();

        const resolved = apply(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_INTERNAL_DISPATCH,
            playerId: '0',
            payload: { choiceId: choiceId! },
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.internalDispatchSelection).toBeNull();
        expect(resolved.selectedRegionId).toBe('city-region-24');
        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            troops: 1,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-25')?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'ming-shanhaiguan-infantry-lv1', label: '大明步兵', count: 1, level: 1 }),
        ]));
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 3,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-24')?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'ming-shanhaiguan-artillery-lv2', label: '大明炮兵', count: 1, level: 2 }),
            expect.objectContaining({ id: 'ming-shanhaiguan-infantry-lv1', label: '大明步兵', count: 1, level: 1 }),
        ]));
        expect(resolved.lastSeasonSummary?.title).toBe('王化贞免费调度');
        expect(resolved.lastSeasonSummary?.lines.join(' | ')).toContain('大明因王化贞免费调度，自 山海关 向 宁远 调动 2 个部队');
        expect(resolved.actionLog[0]?.text).toContain('王化贞令 山海关 向 宁远 免费调度 2 个部队');
    });

    it('王化贞内部调度会把非围城 cityState 城市识别为可用来源区，并正确搬出守军', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-25';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-wang-huazhen',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [
                            { id: 'ming-shanhaiguan-artillery-lv2', label: '大明炮兵', faction: 'ming', troopKind: 'artillery', count: 1, level: 2 },
                            { id: 'ming-shanhaiguan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 1 },
                        ],
                    },
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    specialTroops: [],
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });

        expect(selecting.internalDispatchSelection).toMatchObject({
            sourceRegionId: 'city-region-25',
            sourceRegionName: '山海关',
            maxTroops: 2,
        });
        const choiceId = selecting.internalDispatchSelection?.candidates.find((candidate) => candidate.targetRegionId === 'city-region-24')?.id;
        expect(choiceId).toBeTruthy();

        const resolved = apply(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_INTERNAL_DISPATCH,
            playerId: '0',
            payload: { choiceId: choiceId! },
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            troops: 0,
            population: 2,
            specialTroops: [],
            cityState: null,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 3,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-24')?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'ming-shanhaiguan-artillery-lv2', count: 1 }),
            expect.objectContaining({ id: 'ming-shanhaiguan-infantry-lv1', count: 1 }),
        ]));
    });

    it('王化贞内部调度可把部队增援到己方围城区域，并直接并入 siegeState', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-24';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-wang-huazhen',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    specialTroops: [
                        { id: 'ming-ningyuan-artillery-lv2', label: '大明炮兵', faction: 'ming', troopKind: 'artillery', count: 1, level: 2 },
                        { id: 'ming-ningyuan-infantry-lv1', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 1 },
                    ],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'ming',
                        attackerTroops: 3,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-24',
                    },
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            return region;
        });

        const selecting = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-24' },
        });

        expect(selecting.internalDispatchSelection?.candidates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                targetRegionId: 'city-region-25',
                committedTroops: 2,
            }),
        ]));
        const choiceId = selecting.internalDispatchSelection?.candidates.find((candidate) => candidate.targetRegionId === 'city-region-25')?.id;
        expect(choiceId).toBeTruthy();

        const resolved = apply(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_INTERNAL_DISPATCH,
            playerId: '0',
            payload: { choiceId: choiceId! },
        });

        expect(resolved.selectedRegionId).toBe('city-region-25');
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 0,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            troops: 0,
            population: 0,
            siegeState: {
                attackerFactionId: 'ming',
                attackerTroops: 5,
                attackerSpecialTroops: [
                    expect.objectContaining({ id: 'ming-ningyuan-artillery-lv2', count: 1 }),
                    expect.objectContaining({ id: 'ming-ningyuan-infantry-lv1', count: 1 }),
                ],
            },
            cityState: {
                troops: 2,
                population: 2,
                specialTroops: [],
            },
        });
        expect(resolved.lastSeasonSummary?.lines.join(' | ')).toContain('增援围城 2 个部队');
        expect(resolved.actionLog[0]?.text).toContain('免费增援围城 2 个部队');
    });

    it('熊廷弼在场时会在新的大明行动窗口前免费训练最多4个部队，且同一窗口不重复触发', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'song-jin';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                armaments: [{ id: 'artillery-tech', name: '火炮技术', level: 2 }],
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-xiong-tingbi',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'song-jin') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-22') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    specialTroops: [
                        { id: 'ming-dongjiang-artillery-lv1', label: '大明炮兵', faction: 'ming', troopKind: 'artillery', count: 1, level: 1 },
                        { id: 'ming-dongjiang-cavalry-lv2', label: '大明骑兵', faction: 'ming', troopKind: 'cavalry', count: 1, level: 2 },
                    ],
                };
            }
            return region;
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'song-jin' },
        });

        expect(firstWindow.turnPhase).toBe('action-window');
        expect(firstWindow.selectedRegionId).toBe('song-jin');
        expect(firstWindow.regions.find((region) => region.id === 'song-jin')?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'ming-song-jin-xiong-tingbi-regular-infantry-lv3',
                label: '大明步兵',
                faction: 'ming',
                troopKind: 'infantry',
                count: 3,
                level: 3,
            }),
        ]));
        expect(firstWindow.regions.find((region) => region.id === 'city-region-22')?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'ming-dongjiang-artillery-lv2',
                label: '大明炮兵',
                faction: 'ming',
                troopKind: 'artillery',
                count: 1,
                level: 2,
            }),
            expect.objectContaining({
                id: 'ming-dongjiang-cavalry-lv2',
                label: '大明骑兵',
                faction: 'ming',
                troopKind: 'cavalry',
                count: 1,
                level: 2,
            }),
        ]));
        expect(firstWindow.actionLog[0]?.text).toContain('熊廷弼在行动前免费训练 4 个部队');
        expect(firstWindow.actionLog[0]?.text).toContain('皮岛：大明步兵 x3 升至 3 级');
        expect(firstWindow.actionLog[0]?.text).toContain('东江：大明炮兵 x1 升至 2 级');

        const sameWindow = apply(firstWindow, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-22' },
        });

        expect(sameWindow.turnPhase).toBe('action-window');
        expect(sameWindow.selectedRegionId).toBe('city-region-22');
        expect(sameWindow.regions.find((region) => region.id === 'song-jin')?.specialTroops).toEqual(
            firstWindow.regions.find((region) => region.id === 'song-jin')?.specialTroops,
        );
        expect(sameWindow.regions.find((region) => region.id === 'city-region-22')?.specialTroops).toEqual(
            firstWindow.regions.find((region) => region.id === 'city-region-22')?.specialTroops,
        );
    });

    it('熊廷弼当前选中逻辑区宁远时，会优先训练对应的真实运行时区域', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'ning-yuan';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                armaments: [{ id: 'artillery-tech', name: '火炮技术', level: 2 }],
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-xiong-tingbi',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    population: 0,
                    specialTroops: [],
                };
            }
            if (region.id === 'song-jin') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'song-jin' },
        });

        expect(firstWindow.regions.find((region) => region.id === 'city-region-24')?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'ming-city-region-24-xiong-tingbi-regular-infantry-lv3',
                label: '大明步兵',
                faction: 'ming',
                troopKind: 'infantry',
                count: 4,
                level: 3,
            }),
        ]));
        expect(firstWindow.regions.find((region) => region.id === 'song-jin')).toMatchObject({
            troops: 1,
            specialTroops: [],
        });
        expect(firstWindow.selectedRegionId).toBe('city-region-24');
        expect(firstWindow.actionLog[0]?.text).toContain('宁远：大明步兵 x4 升至 3 级');
    });

    it('熊廷弼免费训练会先并回非围城 cityState 守军，再按总兵优先训练该城市', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'jinzhou';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                armaments: [{ id: 'artillery-tech', name: '火炮技术', level: 2 }],
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-xiong-tingbi',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'song-jin') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 3,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            if (region.controller === 'ming') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                    siegeState: null,
                };
            }
            return region;
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'jinzhou' },
        });

        expect(firstWindow.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            troops: 3,
            population: 2,
            cityState: null,
            specialTroops: [
                expect.objectContaining({
                    id: 'ming-city-region-25-xiong-tingbi-regular-infantry-lv3',
                    label: '大明步兵',
                    faction: 'ming',
                    troopKind: 'infantry',
                    count: 3,
                    level: 3,
                }),
            ],
        });
        expect(firstWindow.regions.find((region) => region.id === 'song-jin')).toMatchObject({
            troops: 1,
            cityState: null,
            specialTroops: [
                expect.objectContaining({
                    id: 'ming-song-jin-xiong-tingbi-regular-infantry-lv3',
                    label: '大明步兵',
                    faction: 'ming',
                    troopKind: 'infantry',
                    count: 1,
                    level: 3,
                }),
            ],
        });
        expect(firstWindow.actionLog[0]?.text).toContain('熊廷弼在行动前免费训练 4 个部队');
        expect(firstWindow.actionLog[0]?.text).toContain('山海关：大明步兵 x3 升至 3 级');
        expect(firstWindow.actionLog[0]?.text).toContain('皮岛：大明步兵 x1 升至 3 级');
    });

    it('熊廷弼免费训练会识别只在 cityState 中保留的大明结构化部队', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'jinzhou';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                armaments: [{ id: 'artillery-tech', name: '火炮技术', level: 2 }],
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-xiong-tingbi',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'song-jin') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [
                            {
                                id: 'ming-song-jin-infantry-lv2',
                                label: '大明步兵',
                                faction: 'ming',
                                troopKind: 'infantry',
                                count: 1,
                                level: 2,
                            },
                            {
                                id: 'ming-song-jin-artillery-lv1',
                                label: '大明炮兵',
                                faction: 'ming',
                                troopKind: 'artillery',
                                count: 1,
                                level: 1,
                            },
                        ],
                    },
                };
            }
            if (region.controller === 'ming') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                    siegeState: null,
                };
            }
            return region;
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'jinzhou' },
        });

        expect(firstWindow.regions.find((region) => region.id === 'song-jin')).toMatchObject({
            controller: 'neutral',
            troops: 2,
            population: 2,
            cityState: null,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({
                    id: 'ming-song-jin-infantry-lv3',
                    troopKind: 'infantry',
                    count: 1,
                    level: 3,
                }),
                expect.objectContaining({
                    id: 'ming-song-jin-artillery-lv2',
                    troopKind: 'artillery',
                    count: 1,
                    level: 2,
                }),
            ]),
        });
        expect(firstWindow.actionLog[0]?.text).toContain('熊廷弼在行动前免费训练 2 个部队');
        expect(firstWindow.actionLog[0]?.text).toContain('皮岛：大明步兵 x1 升至 3 级');
        expect(firstWindow.actionLog[0]?.text).toContain('大明炮兵 x1 升至 2 级');
    });

    it('毛文龙与袁崇焕同场时会在新的大明行动窗口前离场', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedRegionId = 'city-region-22';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-mao-wenlong' || character.id === 'ming-yuan-chonghuan',
                })),
            },
        };

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-22' },
        });

        expect(next.turnPhase).toBe('action-window');
        expect(next.selectedRegionId).toBe('city-region-22');
        expect(next.factions.ming.characters.find((character) => character.id === 'ming-mao-wenlong')?.inPlay).toBe(false);
        expect(next.factions.ming.characters.find((character) => character.id === 'ming-yuan-chonghuan')?.inPlay).toBe(true);
        expect(next.actionLog[0]?.text).toContain('毛文龙与袁崇焕同场');
    });

    it('绰克图台吉在场时会在每个新的蒙古行动窗口前于外喀尔喀部免费建立 2 个骑兵，且同一窗口不重复触发', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.selectedRegionId = 'city-region-2';
        core.factions = {
            ...core.factions,
            mongol: {
                ...core.factions.mongol,
                characters: core.factions.mongol.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'mongol-choghtu-taiji',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion || region.id !== 'city-region-2') {
                return region;
            }
            return {
                ...region,
                controller: 'mongol',
                controlLabel: '蒙古',
                troops: 0,
                diplomacyMarkerFaction: null,
                diplomacyMarkerSide: null,
                specialTroops: [],
            };
        });

        const firstWindow = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-2' },
        });
        expect(firstWindow.turnPhase).toBe('action-window');
        expect(firstWindow.selectedRegionId).toBe('city-region-2');
        expect(firstWindow.regions.find((region) => region.id === 'city-region-2')).toMatchObject({
            troops: 2,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({
                    id: 'mongol-choghtu-taiji-cavalry-lv2',
                    troopKind: 'cavalry',
                    count: 2,
                    level: 2,
                }),
            ]),
        });
        expect(firstWindow.factions.mongol.troops).toBe(core.factions.mongol.troops + 2);

        const sameWindow = apply(firstWindow, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-14' },
        });
        expect(sameWindow.turnPhase).toBe('action-window');
        expect(sameWindow.selectedRegionId).toBe('city-region-14');
        expect(sameWindow.regions.find((region) => region.id === 'city-region-2')?.troops).toBe(2);
        expect(sameWindow.factions.mongol.troops).toBe(firstWindow.factions.mongol.troops);

        const nextWindowSource = {
            ...sameWindow,
            wheelActionUsed: true,
            factionActionUsed: false,
        };
        const secondWindow = apply(nextWindowSource, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-2' },
        });
        expect(secondWindow.turnPhase).toBe('action-window');
        expect(secondWindow.selectedRegionId).toBe('city-region-2');
        expect(secondWindow.regions.find((region) => region.id === 'city-region-2')).toMatchObject({
            troops: 4,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({
                    id: 'mongol-choghtu-taiji-cavalry-lv2',
                    count: 4,
                }),
            ]),
        });
        expect(secondWindow.factions.mongol.troops).toBe(firstWindow.factions.mongol.troops + 2);
        expect(secondWindow.actionLog[0]?.text).toContain('漠北援军');
    });

    it('运行时区域会为朝鲜与海路保留独立移动代价', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);

        expect(core.regions.find((region) => region.id === 'city-region-18')?.travelCostByRegionId['city-region-29']).toBe(3);
        expect(core.regions.find((region) => region.id === 'city-region-18')?.travelCostByRegionId['xian-xing']).toBe(3);
        expect(core.regions.find((region) => region.id === 'song-jin')?.travelCostByRegionId['city-region-22']).toBe(2);
        expect(core.regions.find((region) => region.id === 'song-jin')?.movementCostByRegionId['city-region-22']).toBe(2);
        expect(core.regions.find((region) => region.id === 'song-jin')?.boundaryTypeByRegionId['city-region-22']).toBe('coast');
    });

    it('当前样板开局会把朝鲜三地初始化为大明控制，汉城额外威望默认未解锁', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);

        expect(core.regions.find((region) => region.id === 'xian-xing')?.controller).toBe('ming');
        expect(core.regions.find((region) => region.id === 'city-region-18')?.controller).toBe('ming');
        expect(core.regions.find((region) => region.id === 'city-region-29')?.controller).toBe('ming');
        expect(core.regions.find((region) => region.id === 'xian-xing')?.population).toBe(0);
        expect(core.regions.find((region) => region.id === 'city-region-18')?.population).toBe(0);
        expect(core.regions.find((region) => region.id === 'city-region-29')?.population).toBe(0);
        expect(core.hanseongPrestigeUnlocked).toBe(false);
        expect(getQidahenEffectiveVpByFaction(core, 'ming')).toBe(core.factions.ming.vp);
    });

    it('失去汉城后会按逻辑区口径自动解锁额外威望', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedActionId = 'recruit';
        core.selectedRegionId = 'city-region-22';
        core.actionChoices = getActionChoicesForFaction('ming');
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-29') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                };
            }
            return region;
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        });

        expect(next.hanseongPrestigeUnlocked).toBe(true);
    });

    it('当前样板开局会把关键前线普通部队初始化为结构化兵种', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);

        expect(core.regions.find((region) => region.id === 'song-jin')?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'ming-pidao-infantry-lv1', label: '大明步兵', faction: 'ming', count: 2, level: 1 }),
        ]));
        expect(core.regions.find((region) => region.id === 'city-region-25')?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'ming-shanhaiguan-infantry-lv1', label: '大明步兵', faction: 'ming', count: 2, level: 1 }),
        ]));
        expect(core.regions.find((region) => region.id === 'city-region-22')?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'ming-dongjiang-infantry-lv1', label: '大明步兵', faction: 'ming', count: 1, level: 1 }),
        ]));
        expect(core.regions.find((region) => region.id === 'city-region-28')?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'ming-jizhen-infantry-lv1', label: '大明步兵', faction: 'ming', count: 1, level: 1 }),
        ]));
        expect(core.regions.find((region) => region.id === 'jinzhou')?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'jin-jinzhou-infantry-lv2', label: '后金步兵', faction: 'jin', count: 2, level: 2 }),
        ]));
        expect(core.regions.find((region) => region.id === 'city-region-13')).toMatchObject({
            name: '建州',
            controller: 'jin',
            troops: 3,
            population: 2,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({ id: 'jin-jianzhou-infantry-lv4', label: '后金精锐步兵', faction: 'jin', troopKind: 'infantry', count: 2, level: 4 }),
                expect.objectContaining({ id: 'jin-jianzhou-infantry-lv2', label: '后金步兵', faction: 'jin', troopKind: 'infantry', count: 1, level: 2 }),
            ]),
        });
        expect(core.regions.find((region) => region.id === 'city-region-11')).toMatchObject({
            name: '长白',
            controller: 'jin',
            troops: 2,
            population: 2,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({ id: 'jin-changbai-infantry-lv2', label: '后金步兵', faction: 'jin', troopKind: 'infantry', count: 2, level: 2 }),
            ]),
        });
        expect(core.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            name: '察哈尔',
            controller: 'mongol',
            troops: 3,
            population: 3,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({ id: 'mongol-chahar-cavalry-lv3', label: '蒙古骑兵', faction: 'mongol', troopKind: 'cavalry', count: 3, level: 3 }),
            ]),
        });
        expect(core.mapTokens).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'jianzhou-control', type: 'control', faction: 'jin' }),
            expect.objectContaining({ id: 'jianzhou-army', type: 'army', faction: 'jin', value: 3 }),
            expect.objectContaining({ id: 'changbai-control', type: 'control', faction: 'jin' }),
            expect.objectContaining({ id: 'changbai-army', type: 'army', faction: 'jin', value: 2 }),
            expect.objectContaining({ id: 'chahar-control', type: 'control', faction: 'mongol' }),
            expect.objectContaining({ id: 'chahar-army', type: 'army', faction: 'mongol', value: 3 }),
        ]));
        expect(core.regions.find((region) => region.id === 'xian-xing')?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({ label: '朝鲜雇佣军', faction: 'ming', count: 1, level: 2 }),
        ]));
    });

    it('非大明势力不会把船锚海路当作普通相邻进攻线', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.selectedActionId = 'raid';
        core.selectedRegionId = 'song-jin';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'song-jin') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                };
            }
            if (region.id === 'city-region-22') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 3,
                };
            }
            if (region.id === 'city-region-15' || region.id === 'city-region-19') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                };
            }
            return region;
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'raid' },
        });

        expect(next.pendingTargetAction).toBeNull();
    });

    it('汉城额外威望在解锁后会给当前控制者 +1，并可触发威望胜利', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedActionId = 'recruit';
        core.selectedRegionId = 'city-region-29';
        core.actionChoices = getActionChoicesForFaction('ming');
        core.hanseongPrestigeUnlocked = true;
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                vp: 2,
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-29') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                };
            }
            return region;
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        });

        expect(next.hanseongPrestigeUnlocked).toBe(true);
        expect(getQidahenEffectiveVpByFaction(next, 'ming')).toBe(3);
        expect(next.victoryStatus).toMatchObject({
            winnerFactionId: 'ming',
            condition: 'prestige',
        });
        expect(next.victoryStatus?.detail).toContain('含汉城');
        expect(QidahenDomain.isGameOver?.(next)).toEqual({ winner: '0' });
    });

    it('攻下已配置首都时会立刻标记军事胜利', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.selectedActionId = 'raid';
        core.selectedRegionId = 'city-region-29';
        core.actionChoices = getActionChoicesForFaction('jin');
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-29') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                };
            }
            return region;
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'raid' },
        });

        expect(next.victoryStatus).toMatchObject({
            winnerFactionId: 'jin',
            condition: 'military',
        });
        expect(next.victoryStatus?.detail).toContain('汉城');
        expect(next.victoryStatus?.detail).toContain('首都');
        expect(QidahenDomain.isGameOver?.(next)).toEqual({ winner: '2' });
    });

    it('新年阶段控制 16 个非朝鲜区域时会标记霸权胜利', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion || region.id === 'xian-xing' || region.id === 'city-region-18' || region.id === 'city-region-29') {
                return region;
            }
            return {
                ...region,
                controller: 'jin',
                controlLabel: '后金',
            };
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        expect(next.victoryStatus).toMatchObject({
            winnerFactionId: 'jin',
            condition: 'hegemony',
        });
        expect(next.victoryStatus?.detail).toContain('控制');
        expect(QidahenDomain.isGameOver?.(next)).toEqual({ winner: '2' });
    });
});
