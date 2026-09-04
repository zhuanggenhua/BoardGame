import { describe, expect, it } from 'vitest';import { QidahenDomain } from '../domain';

import { QIDAHEN_COMMANDS } from '../domain/commands';
import { getActionChoicesForFaction } from '../domain/factionActionWindow';import { random, apply, getKhanEdictSelection, getDiplomacySelection } from './helpers/paymentSelectionHarness';

describe('七大恨大汗令箭效果', () => {
it('大汗令箭在蒙古已有控制区时会先进入令箭效果选择并保留当前焦点', () => {
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
        expect(getKhanEdictSelection(next)?.sourceRegionId).toBe('city-region-25');
        expect(getKhanEdictSelection(next)?.choices).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'recruit-train', label: '征兵训练' }),
            expect.objectContaining({ id: 'hire-dispatch', label: '外交雇佣' }),
        ]));
        expect(next.actionLog[0]?.text).toContain('进入令箭效果选择');
    });

it('大汗令箭当前选中敌区时会保留焦点，令箭效果面板回退到实际蒙古来源区', () => {
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
        expect(next.selectedRegionId).toBe('city-region-24');
        expect(getKhanEdictSelection(next)?.sourceRegionId).toBe('city-region-25');
        expect(getKhanEdictSelection(next)?.sourceRegionName).toBe('山海关');
        expect(getKhanEdictSelection(next)?.recruitTargetRegionId).toBe('city-region-25');
        expect(getKhanEdictSelection(next)?.hireTargetRegionId).toBe('city-region-25');

        const rebound = apply(next, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-24' },
        });

        expect(rebound.turnPhase).toBe('khan-edict-choice');
        expect(rebound.selectedRegionId).toBe('city-region-24');
        expect(getKhanEdictSelection(rebound)?.sourceRegionId).toBe('city-region-25');
        expect(getKhanEdictSelection(rebound)?.sourceRegionName).toBe('山海关');
        expect(getKhanEdictSelection(rebound)).toMatchObject({
            displayAnchorRegionId: 'city-region-25',
            displayAnchorRegionName: '山海关',
            recruitTargetRegionId: 'city-region-25',
            recruitTargetRegionName: '山海关',
            hireTargetRegionId: 'city-region-25',
            hireTargetRegionName: '山海关',
        });
    });

it('大汗令箭进入选择面板后就算 core.khanEdictSelection 被清空，切区仍会按当前等待态回退到合法蒙古来源区', () => {
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
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        });

        const rebound = apply({
            ...next,
            khanEdictSelection: null,
        }, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-24' },
        });
        const rebuiltSelection = getKhanEdictSelection(rebound);
        const rebuiltSourceRegion = rebound.regions.find((region) => region.id === rebuiltSelection?.sourceRegionId);

        expect(rebound.turnPhase).toBe('khan-edict-choice');
        expect(rebound.selectedRegionId).toBe('city-region-25');
        expect(rebound.explicitRegionId).toBe('city-region-24');
        expect(rebuiltSelection?.sourceRegionId).not.toBe('city-region-24');
        expect(rebuiltSourceRegion?.controller).toBe('mongol');
        expect(rebuiltSelection?.sourceRegionName).toBeTruthy();
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

        expect(getKhanEdictSelection(selected)?.recruitTargetRegionId).toBe('city-region-14');

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
        expect(selected.selectedRegionId).toBe('city-region-22');
        expect(getKhanEdictSelection(selected)?.sourceRegionId).toBe('song-jin');
        expect(getKhanEdictSelection(selected)?.sourceRegionName).toBe('皮岛');
        expect(getKhanEdictSelection(selected)?.hireTargetRegionId).toBe('song-jin');
        expect(getKhanEdictSelection(selected)?.hireTargetRegionName).toBe('皮岛');
        expect(getKhanEdictSelection(selected)?.choices.map((choice) => choice.id)).toContain('hire-dispatch');
    });

it('大汗令箭以逻辑区辽西为当前选区时，会保留当前焦点并把效果选择收到真实运行时区域', () => {
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
            if (region.id === 'city-region-19-liaoxi') {
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
        expect(selected.selectedRegionId).toBe('liao-xi');
        expect(getKhanEdictSelection(selected)).toMatchObject({
            sourceRegionId: 'city-region-19-liaoxi',
            sourceRegionName: '辽西',
            recruitTargetRegionId: 'city-region-19-liaoxi',
            recruitTargetRegionName: '辽西',
            hireTargetRegionId: 'city-region-19-liaoxi',
            hireTargetRegionName: '辽西',
        });

        const resolved = apply(selected, {
            type: QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE,
            playerId: '1',
            payload: { choiceId: 'recruit-train' },
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.selectedRegionId).toBe('city-region-19-liaoxi');
        expect(resolved.regions.find((region) => region.id === 'city-region-19-liaoxi')).toMatchObject({
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
            if (region.id === 'city-region-19-liaoxi') {
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
        expect(selected.selectedRegionId).toBe('city-region-22');
        expect(getKhanEdictSelection(selected)?.sourceRegionId).toBe('jinzhou');
        expect(getKhanEdictSelection(selected)?.hireTargetRegionId).toBe('jinzhou');

        const choosingDiplomacy = apply(selected, {
            type: QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE,
            playerId: '1',
            payload: { choiceId: 'hire-dispatch' },
        });

        expect(choosingDiplomacy.turnPhase).toBe('diplomacy-choice');
        expect(choosingDiplomacy.selectedRegionId).toBe('city-region-22');
        expect(choosingDiplomacy.diplomacyProgress).toBeNull();
        expect(getDiplomacySelection(choosingDiplomacy)?.sourceRegionId).toBe('jinzhou');
        expect(getDiplomacySelection(choosingDiplomacy)?.sourceRegionName).toBe('锦州');

        const targeted = apply(choosingDiplomacy, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'liao-xi' },
        });

        expect(targeted.turnPhase).toBe('diplomacy-choice');
        expect(targeted.selectedRegionId).toBe('city-region-22');
        expect(targeted.explicitRegionId).toBe('liao-xi');
        expect(targeted.diplomacyProgress).toMatchObject({
            source: 'khan-edict',
            sourceRegionId: 'jinzhou',
            remainingTargetCount: 3,
        });
        expect(getDiplomacySelection(targeted)).toMatchObject({
            sourceRegionId: 'jinzhou',
            targetRegionId: 'city-region-19-liaoxi',
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
            if (region.id === 'jinzhou') {
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
        expect(choosingDiplomacy.diplomacyProgress).toBeNull();
        expect(getDiplomacySelection(choosingDiplomacy)?.sourceRegionId).toBe('city-region-25');
        expect(choosingDiplomacy.turnPhase).toBe('diplomacy-choice');
        expect(choosingDiplomacy.actionLog.some((entry) => entry.text.includes('进入外交目标选择'))).toBe(true);

        const targeted = apply(choosingDiplomacy, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'jinzhou' },
        });
        expect(targeted.diplomacyProgress).toMatchObject({
            source: 'khan-edict',
            sourceRegionId: 'city-region-25',
            displayAnchorRegionId: 'city-region-25',
            displayAnchorRegionName: '山海关',
            remainingTargetCount: 3,
        });
        expect(getDiplomacySelection(targeted)?.targetRegionId).toBe('jinzhou');
        expect(getDiplomacySelection(targeted)?.choices).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'hire-only' }),
            expect.objectContaining({ id: 'place-friendly' }),
        ]));

        const resolved = apply(targeted, {
            type: QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE,
            playerId: '1',
            payload: { choiceId: 'place-friendly' },
        });

        expect(resolved.turnPhase).toBe('diplomacy-choice');
        expect(resolved.selectedRegionId).toBe('city-region-25');
        expect(resolved.explicitRegionId).toBe('jinzhou');
        expect(resolved.diplomacyProgress?.resolvedSteps).toHaveLength(1);
        expect(resolved.diplomacyProgress?.remainingTargetCount).toBe(2);
        expect(resolved.regions.find((region) => region.id === 'jinzhou')).toMatchObject({
            diplomacyMarkerFaction: 'mongol',
            diplomacyMarkerSide: 'friendly',
            controlLabel: '蒙古友好',
        });
        expect(resolved.mapTokens.find((token) => token.id === 'diplomacy-marker-jinzhou')).toMatchObject({
            faction: 'mongol',
            imageSrc: 'qidahen/markers/mongol-control-diplomacy-marker-b',
        });

        const finished = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE,
            playerId: '1',
            payload: { choiceId: 'hire-only' },
        });

        expect(finished.diplomacyProgress).toBeNull();
        expect(finished.currentPlayer).toBe('2');
        expect(finished.turnPhase).toBe('action-window');
        expect(finished.selectedRegionId).toBe('city-region-13');
        expect(finished.wheelDispatchProgress).toBeNull();
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
        const finished = apply(targeted, {
            type: QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE,
            playerId: '1',
            payload: { choiceId: 'hire-only' },
        });

        expect(finished.diplomacyProgress).toBeNull();
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
            payload: { regionId: 'jinzhou' },
        });

        expect(targeted.diplomacyProgress).toMatchObject({
            sourceRegionId: 'city-region-25',
            remainingTargetCount: 3,
        });
        expect(getDiplomacySelection(targeted)?.targetRegionId).toBe('jinzhou');
        expect(getDiplomacySelection(targeted)?.targetHint).toContain('存在正规军');
        expect(getDiplomacySelection(targeted)?.choices.map((choice) => choice.id)).toEqual(['hire-only']);
    });
});
