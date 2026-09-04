import { describe, expect, it } from 'vitest';import { getQidahenDriveTigerConsentSelectionForCore, QidahenDomain } from '../domain';

import { QIDAHEN_COMMANDS } from '../domain/commands';
import { getActionChoicesForFaction } from '../domain/factionActionWindow';import type { QidahenCore } from '../domain/types';
import type { MatchState } from '../../../engine/types';
import { createInitialSystemState } from '../../../engine/pipeline';

import { engineConfig } from '../game';import { random, apply, getDriveTigerConsentSelection, getRecruitSelection, getGrantPardonSelection, getMaShiTradeSelection, payGrantPardonAndChooseTarget, getWheelDispatchSelection, applyPipeline, getPromptData, factionHandCards, keepOnlyMingHomelandFallback, setRegionCavalry } from './helpers/paymentSelectionHarness';

describe('七大恨势力行动结算', () => {
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
        expect(next.selectedRegionId).toBe('song-jin');
        expect(getRecruitSelection(next)?.targetRegionId).toBe('song-jin');
        expect(getRecruitSelection(next)?.choices.map((choice) => choice.id)).toEqual(['level-2-troops', 'level-4-chuanbing', 'level-1-artillery']);
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

        expect(getRecruitSelection(selecting)?.choices.map((choice) => choice.id)).toEqual(['level-2-troops', 'level-4-chuanbing']);
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
        expect(next.pieces.filter((piece) => piece.regionId === 'song-jin' && piece.location === 'field')).toHaveLength(8);
        expect(next.pieces.filter((piece) => piece.regionId === 'song-jin' && piece.location === 'field' && piece.sourceStackId === 'ming-recruit-regular-infantry-lv2')).toHaveLength(6);
        expect(next.pieces.filter((piece) => piece.regionId === 'song-jin' && piece.location === 'field' && piece.sourceStackId === 'ming-recruit-regular-infantry-lv2').every((piece) => (
            piece.faction === 'ming'
            && piece.troopKind === 'infantry'
            && piece.level === 2
        ))).toBe(true);
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
        expect(getRecruitSelection(selecting)?.choices.find((choice) => choice.id === 'level-1-artillery')).toMatchObject({
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
        keepOnlyMingHomelandFallback(core);
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

        expect(getRecruitSelection(selecting)?.targetRegionId).toBe('song-jin');

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

        expect(getRecruitSelection(selecting)?.targetRegionId).toBe('city-region-24');

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

it('征召军队以逻辑区宁远作为当前选区时，会保留当前焦点并把建军目标收到真实运行时区域', () => {
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

        expect(selecting.selectedRegionId).toBe('ning-yuan');
        expect(selecting.turnPhase).toBe('recruit-choice');
        expect(getRecruitSelection(selecting)).toMatchObject({
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

it('征召军队进入选择面板后点逻辑区宁远时，会保留已锁焦点并把建军目标重建到真实运行时区域', () => {
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
        expect(getRecruitSelection(selecting)?.targetRegionId).toBe('song-jin');

        const retargeted = apply(selecting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'ning-yuan' },
        });

        expect(retargeted.selectedRegionId).toBe('song-jin');
        expect(retargeted.explicitRegionId).toBe('ning-yuan');
        expect(retargeted.turnPhase).toBe('recruit-choice');
        expect(getRecruitSelection(retargeted)).toMatchObject({
            targetRegionId: 'city-region-24',
            targetRegionName: '宁远',
            displayAnchorRegionId: 'ning-yuan',
            displayAnchorRegionName: '宁远',
        });
    });

it('征召军队以逻辑区辽东作为当前选区时，会保留当前焦点并把建军目标收到真实运行时区域', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'liao-dong';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-15-liaodong') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    population: 1,
                    specialTroops: [
                        {
                            id: 'ming-liaodong-infantry-lv1',
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
            if (region.controller === 'ming' && region.id !== 'city-region-15-liaodong') {
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

        expect(selecting.selectedRegionId).toBe('liao-dong');
        expect(selecting.turnPhase).toBe('recruit-choice');
        expect(getRecruitSelection(selecting)).toMatchObject({
            targetRegionId: 'city-region-15-liaodong',
            targetRegionName: '辽东',
        });

        const resolved = apply(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE,
            playerId: '0',
            payload: { choiceId: 'level-2-troops' },
        });

        expect(resolved.selectedRegionId).toBe('city-region-15-liaodong');
        expect(resolved.regions.find((region) => region.id === 'city-region-15-liaodong')).toMatchObject({
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
        expect(resolved.lastSeasonSummary?.lines.join(' | ')).toContain('辽东');
    });

it('征召军队进入选择面板后点逻辑区辽东时，会保留已锁焦点与规则名并把建军目标重建到真实运行时区域', () => {
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
            if (region.id === 'city-region-15-liaodong') {
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
        expect(getRecruitSelection(selecting)?.targetRegionId).toBe('song-jin');

        const retargeted = apply(selecting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'liao-dong' },
        });

        expect(retargeted.selectedRegionId).toBe('song-jin');
        expect(retargeted.explicitRegionId).toBe('liao-dong');
        expect(retargeted.turnPhase).toBe('recruit-choice');
        expect(getRecruitSelection(retargeted)).toMatchObject({
            targetRegionId: 'city-region-15-liaodong',
            targetRegionName: '辽东',
            displayAnchorRegionId: 'liao-dong',
            displayAnchorRegionName: '辽东',
        });
    });

it('征召军队进入选择面板后就算 core.recruitSelection 被清空，点逻辑区辽东仍会按当前等待态重建', () => {
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
            if (region.id === 'city-region-15-liaodong') {
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

        const retargeted = apply({
            ...selecting,
            recruitSelection: null,
        }, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'liao-dong' },
        });

        expect(retargeted.selectedRegionId).toBe('song-jin');
        expect(retargeted.explicitRegionId).toBe('liao-dong');
        expect(retargeted.turnPhase).toBe('recruit-choice');
        expect(getRecruitSelection(retargeted)).toMatchObject({
            targetRegionId: 'city-region-15-liaodong',
            targetRegionName: '辽东',
        });
    });

it('征召军队以逻辑区蓟镇作为当前选区时，会保留当前焦点并把建军目标收到真实运行时区域', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'ji-zhen';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-28-jizhen') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    population: 1,
                    specialTroops: [
                        {
                            id: 'ming-jizhen-infantry-lv1',
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
            if (region.controller === 'ming' && region.id !== 'city-region-28-jizhen') {
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

        expect(selecting.selectedRegionId).toBe('ji-zhen');
        expect(selecting.turnPhase).toBe('recruit-choice');
        expect(getRecruitSelection(selecting)).toMatchObject({
            targetRegionId: 'city-region-28-jizhen',
            targetRegionName: '蓟镇',
        });

        const resolved = apply(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE,
            playerId: '0',
            payload: { choiceId: 'level-2-troops' },
        });

        expect(resolved.selectedRegionId).toBe('city-region-28-jizhen');
        expect(resolved.regions.find((region) => region.id === 'city-region-28-jizhen')).toMatchObject({
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
        expect(resolved.lastSeasonSummary?.lines.join(' | ')).toContain('蓟镇');
    });

it('征召军队进入选择面板后点逻辑区蓟镇时，会保留已锁焦点与规则名并把建军目标重建到真实运行时区域', () => {
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
            if (region.id === 'city-region-28-jizhen') {
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
        expect(getRecruitSelection(selecting)?.targetRegionId).toBe('song-jin');

        const retargeted = apply(selecting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'ji-zhen' },
        });

        expect(retargeted.selectedRegionId).toBe('song-jin');
        expect(retargeted.explicitRegionId).toBe('ji-zhen');
        expect(retargeted.turnPhase).toBe('recruit-choice');
        expect(getRecruitSelection(retargeted)).toMatchObject({
            targetRegionId: 'city-region-28-jizhen',
            targetRegionName: '蓟镇',
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

        expect(getRecruitSelection(selecting)?.targetRegionId).toBe('city-region-25');

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
        const previewed = apply(selectedRegion, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'grant-pardon' },
        });
        expect(previewed.turnPhase).toBe('action-window');
        expect(previewed.payment.required).toBe(3);
        expect(getGrantPardonSelection(previewed)).toBeNull();
        const next = payGrantPardonAndChooseTarget(previewed, 'jinzhou->city-region-25');

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
        expect(next.grantPardonSelection).toBeNull();
        expect(next.lastSeasonSummary?.title).toBe('赐印招安');
    });

it('赐印招安可对非围城 cityState 敌城生效，并只从城内守军扣 1', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'jinzhou';
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

        const previewed = apply(core, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'grant-pardon' },
        });
        expect(previewed.turnPhase).toBe('action-window');
        expect(previewed.payment.required).toBe(3);
        expect(getGrantPardonSelection(previewed)).toBeNull();
        const next = payGrantPardonAndChooseTarget(previewed, 'jinzhou->city-region-25');

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

        const previewed = apply(core, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'grant-pardon' },
        });
        expect(previewed.turnPhase).toBe('action-window');
        expect(previewed.payment.required).toBe(3);
        expect(getGrantPardonSelection(previewed)).toBeNull();
        const next = payGrantPardonAndChooseTarget(previewed, 'city-region-24->city-region-25');

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

it('赐印招安会按玩家选择的接收区结算，不再自动猜目标', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'jinzhou';
        const jinzhouAdjacentIds = new Set([
            'city-region-14',
            'city-region-15',
            'city-region-15-liaodong',
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

        const previewed = apply(core, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'grant-pardon' },
        });
        expect(previewed.turnPhase).toBe('action-window');
        expect(previewed.payment.required).toBe(3);
        expect(getGrantPardonSelection(previewed)).toBeNull();
        const paid = apply(apply(apply(previewed, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-1' },
        }), {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-2' },
        }), {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-3' },
        });
        const choosingTarget = apply(paid, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '0',
            payload: {},
        });
        const choiceIds = getGrantPardonSelection(choosingTarget)?.choices.map((choice) => choice.id) ?? [];
        expect(choiceIds).toEqual(expect.arrayContaining([
            'jinzhou->city-region-24',
            'jinzhou->city-region-25',
        ]));
        const next = apply(choosingTarget, {
            type: QIDAHEN_COMMANDS.RESOLVE_GRANT_PARDON_CHOICE,
            playerId: '0',
            payload: { choiceId: 'jinzhou->city-region-24' },
        });

        expect(next.selectedRegionId).toBe('city-region-24');
        expect(next.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'ming',
            troops: 3,
            cityState: null,
        });
        expect(next.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'ming',
            troops: 0,
            population: 0,
            cityState: {
                troops: 4,
                population: 2,
                specialTroops: [],
            },
        });
    });

it('赐印招安把部队转入己方被围城市时，会并入 cityState 而不是落到城市顶层', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'jinzhou';
        const jinzhouAdjacentIds = new Set([
            'city-region-14',
            'city-region-15',
            'city-region-15-liaodong',
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

        const previewed = apply(core, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'grant-pardon' },
        });
        expect(previewed.turnPhase).toBe('action-window');
        expect(previewed.payment.required).toBe(3);
        expect(getGrantPardonSelection(previewed)).toBeNull();
        const next = payGrantPardonAndChooseTarget(previewed, 'jinzhou->city-region-25');

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

it('赐印招安可由玩家显式选择被围城市作为接收区并并入城内守军', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'jinzhou';
        const jinzhouAdjacentIds = new Set([
            'city-region-14',
            'city-region-15',
            'city-region-15-liaodong',
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

        const previewed = apply(core, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'grant-pardon' },
        });
        expect(previewed.turnPhase).toBe('action-window');
        expect(previewed.payment.required).toBe(3);
        expect(getGrantPardonSelection(previewed)).toBeNull();
        const paid = apply(apply(apply(previewed, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-1' },
        }), {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-2' },
        }), {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-3' },
        });
        const choosingTarget = apply(paid, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '0',
            payload: {},
        });
        const choiceIds = getGrantPardonSelection(choosingTarget)?.choices.map((choice) => choice.id) ?? [];
        expect(choiceIds).toEqual(expect.arrayContaining([
            'jinzhou->city-region-24',
            'jinzhou->city-region-25',
        ]));
        const next = apply(choosingTarget, {
            type: QIDAHEN_COMMANDS.RESOLVE_GRANT_PARDON_CHOICE,
            playerId: '0',
            payload: { choiceId: 'jinzhou->city-region-25' },
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
        expect(next.selectedRegionId).toBe('jinzhou');
        expect(next.pendingTargetAction).toBeNull();
        expect(next.wheelDispatchProgress).toBeNull();
        expect(getWheelDispatchSelection(next)).toBeNull();
        expect(getDriveTigerConsentSelection(next)?.dispatchSelection).toMatchObject({
            attackerFactionId: 'jin',
            sourceRegionId: 'jinzhou',
            sourceActionId: 'drive-tiger',
        });
        expect(getDriveTigerConsentSelection(next)).toMatchObject({
            commanderFactionId: 'ming',
            targetFactionId: 'jin',
            targetFactionName: '后金',
        });
        expect(next.selectedRegionId).toBe('jinzhou');
        expect(getDriveTigerConsentSelection(next)?.dispatchSelection).toMatchObject({
            attackerFactionId: 'jin',
            sourceRegionId: 'jinzhou',
        });
        expect((getDriveTigerConsentSelection(next)?.dispatchSelection.candidates.length ?? 0)).toBeGreaterThan(0);
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
            playerId: '2',
            payload: { choiceId: 'accept' },
        });

        expect(targeting.factions.jin.handCount).toBe(16);
        expect(targeting.turnPhase).toBe('dispatch-targeting');
        expect(targeting.selectedRegionId).toBe('jinzhou');
        expect(getQidahenDriveTigerConsentSelectionForCore(targeting)).toBeNull();
        expect(getWheelDispatchSelection(targeting)).toMatchObject({
            attackerFactionId: 'jin',
            sourceRegionId: 'jinzhou',
        });
        expect(targeting.actionLog[0]?.text).toContain('同意接受');
        expect(targeting.actionLog[0]?.text).toContain('进入指挥调度目标选择');
        expect(targeting.lastSeasonSummary?.lines.join(' ')).toContain('进入调度目标选择');
        expect(targeting.lastSeasonSummary?.lines.join(' ')).not.toContain('出发');
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
        expect(next.selectedRegionId).toBe('city-region-25');
        expect(getWheelDispatchSelection(next)).toBeNull();
        expect(getDriveTigerConsentSelection(next)?.dispatchSelection).toMatchObject({
            attackerFactionId: 'jin',
            sourceRegionId: 'city-region-20',
            sourceActionId: 'drive-tiger',
        });
        expect(getDriveTigerConsentSelection(next)).toMatchObject({
            commanderFactionId: 'ming',
            targetFactionId: 'jin',
            targetFactionName: '后金',
        });
        expect(getDriveTigerConsentSelection(next)?.dispatchSelection).toMatchObject({
            attackerFactionId: 'jin',
            sourceRegionId: 'city-region-20',
            sourceRegionName: '山海关围城军',
        });
        expect(getDriveTigerConsentSelection(next)?.dispatchSelection.candidates.find((candidate) => candidate.targetRuntimeRegionId === 'city-region-25')).toMatchObject({
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
        expect(next.selectedRegionId).toBe('city-region-14');
        expect(getWheelDispatchSelection(next)).toBeNull();
        expect(getDriveTigerConsentSelection(next)?.dispatchSelection).toMatchObject({
            attackerFactionId: 'jin',
            sourceRegionId: 'jinzhou',
            sourceActionId: 'drive-tiger',
        });
        expect(getDriveTigerConsentSelection(next)).toMatchObject({
            commanderFactionId: 'ming',
            targetFactionId: 'jin',
            targetFactionName: '后金',
        });
        expect(getDriveTigerConsentSelection(next)?.dispatchSelection).toMatchObject({
            attackerFactionId: 'jin',
            sourceRegionId: 'jinzhou',
            sourceRegionName: '锦州',
        });
        expect(getDriveTigerConsentSelection(next)?.dispatchSelection.candidates.length).toBeGreaterThan(0);
    });

it('驱虎吞狼等待同意时点逻辑区辽西，会保留正式来源区并把显式焦点记到辽西', () => {
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
        expect(consenting.selectedRegionId).toBe('city-region-14');
        expect(getWheelDispatchSelection(consenting)).toBeNull();
        expect(getDriveTigerConsentSelection(consenting)?.dispatchSelection.sourceRegionId).toBe('jinzhou');

        const reselected = apply(consenting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'liao-xi' },
        });

        expect(reselected.turnPhase).toBe('drive-tiger-consent');
        expect(reselected.selectedRegionId).toBe('jinzhou');
        expect(reselected.explicitRegionId).toBe('liao-xi');
        expect(getDriveTigerConsentSelection(reselected)?.dispatchSelection.sourceRegionId).toBe('jinzhou');
        expect(getDriveTigerConsentSelection(reselected)?.dispatchSelection).toMatchObject({
            sourceRegionId: 'jinzhou',
            sourceRegionName: '锦州',
            displayAnchorRegionId: 'jinzhou',
            displayAnchorRegionName: '锦州',
        });
    });

it('驱虎吞狼同意等待时重新点地图，优先吃 interaction dispatch 快照并保留显式焦点', () => {
        let state: MatchState<QidahenCore> = {
            core: setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'jinzhou', 'jin', 2, 2),
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'jinzhou' },
        }).state;
        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'drive-tiger' },
        }).state;

        const interactionData = getPromptData(state) as {
            sourceId?: string;
            qidahenDriveTigerConsentSelection?: { dispatchSelection?: QidahenCore['wheelDispatchProgress'] | null };
        } | undefined;
        expect(interactionData?.sourceId).toBe('qidahen:drive-tiger-consent');
        expect(interactionData?.qidahenDriveTigerConsentSelection?.dispatchSelection).toMatchObject({
            sourceRegionId: 'jinzhou',
            sourceRegionName: '锦州',
            sourceActionId: 'drive-tiger',
        });

        const reselected = applyPipeline({
            ...state,
            core: {
                ...state.core,
                wheelDispatchProgress: null,
            },
        }, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'liao-xi' },
        }).state;

        expect(reselected.core.turnPhase).toBe('drive-tiger-consent');
        expect(reselected.core.selectedRegionId).toBe('jinzhou');
        expect(reselected.core.explicitRegionId).toBe('liao-xi');
        expect(getPromptData(reselected)).toMatchObject({
            sourceId: 'qidahen:drive-tiger-consent',
            qidahenDriveTigerConsentSelection: {
                dispatchSelection: {
                    sourceRegionId: 'jinzhou',
                    sourceRegionName: '锦州',
                    displayAnchorRegionId: 'jinzhou',
                    displayAnchorRegionName: '锦州',
                    sourceActionId: 'drive-tiger',
                },
            },
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
            playerId: '2',
            payload: { choiceId: 'decline' },
        });

        expect(declined.turnPhase).toBe('action-window');
        expect(declined.selectedRegionId).toBe('jinzhou');
        expect(declined.factions.jin.handCount).toBe(10);
        expect(getQidahenDriveTigerConsentSelectionForCore(declined)).toBeNull();
        expect(declined.wheelDispatchProgress).toBeNull();
        expect(declined.lastSeasonSummary).toMatchObject({
            title: '驱虎吞狼',
        });
        expect(declined.lastSeasonSummary?.lines.join(' ')).toContain('拒绝');
        expect(declined.actionLog[0]?.text).toContain('拒绝接受');
    });

it('驱虎吞狼在同意后由大明锁定目标并保留出兵方为后金', () => {
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
            playerId: '2',
            payload: { choiceId: 'accept' },
        });

        expect(targeting.selectedRegionId).toBe('jinzhou');
        const firstCandidateId = getWheelDispatchSelection(targeting)?.candidates[0]?.targetRuntimeRegionId;
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
            playerId: '2',
            payload: { choiceId: 'accept' },
        });

        const strongCandidate = getWheelDispatchSelection(targeting)?.candidates.find((candidate) => candidate.committedTroops === 10);
        expect(strongCandidate).toBeTruthy();

        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: strongCandidate!.targetRuntimeRegionId },
        });

        expect(getQidahenDriveTigerConsentSelectionForCore(targeting)).toBeNull();
        expect(getWheelDispatchSelection(targeting)?.candidates.some((candidate) => candidate.committedTroops === 10)).toBe(true);
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
        expect(getMaShiTradeSelection(next)?.targetRegionId).toBe('song-jin');
        expect(getMaShiTradeSelection(next)?.choices.map((choice) => choice.troopCount)).toEqual([1, 2, 3]);
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
        keepOnlyMingHomelandFallback(core);
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

        expect(getMaShiTradeSelection(selecting)?.targetRegionId).toBe('song-jin');
    });

it('马市贸易以逻辑区宁远作为当前选区时，会保留当前焦点并把建兵目标收到真实运行时区域', () => {
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

        expect(selecting.selectedRegionId).toBe('ning-yuan');
        expect(selecting.turnPhase).toBe('ma-shi-trade-choice');
        expect(getMaShiTradeSelection(selecting)).toMatchObject({
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

it('马市贸易进入数量选择后点逻辑区宁远时，会保留已锁焦点并把建兵目标重建到真实运行时区域', () => {
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
        expect(getMaShiTradeSelection(selecting)?.targetRegionId).toBe('song-jin');

        const retargeted = apply(selecting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'ning-yuan' },
        });

        expect(retargeted.selectedRegionId).toBe('song-jin');
        expect(retargeted.explicitRegionId).toBe('ning-yuan');
        expect(retargeted.turnPhase).toBe('ma-shi-trade-choice');
        expect(getMaShiTradeSelection(retargeted)).toMatchObject({
            targetRegionId: 'city-region-24',
            targetRegionName: '宁远',
        });
    });

it('马市贸易进入数量选择后就算 core.maShiTradeSelection 被清空，点逻辑区宁远仍会按当前等待态重建', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '1';
        core.selectedRegionId = 'song-jin';
        core.selectedActionId = 'ma-shi-trade';
        core.actionChoices = getActionChoicesForFaction('mongol');
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'song-jin' || region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: region.id === 'song-jin' ? 2 : 3,
                    population: region.id === 'song-jin' ? 0 : 1,
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

        const retargeted = apply({
            ...selecting,
            maShiTradeSelection: null,
        }, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'ning-yuan' },
        });

        expect(retargeted.selectedRegionId).toBe('song-jin');
        expect(retargeted.explicitRegionId).toBe('ning-yuan');
        expect(retargeted.turnPhase).toBe('ma-shi-trade-choice');
        expect(getMaShiTradeSelection(retargeted)).toMatchObject({
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

it('突袭作战自动回退目标时会保留当前焦点，并按围城军兵力优先选择友方被围城市进行解围', () => {
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

        expect(pending.selectedRegionId).toBe('city-region-24');
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

it('突袭作战以逻辑区蓟镇为当前选区时，会保留当前焦点和规则名，并把待结算目标收敛到真实运行时区域', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.selectedRegionId = 'ji-zhen';
        core.actionChoices = getActionChoicesForFaction('jin');
        core.selectedActionId = 'raid';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-28-jizhen') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    population: 2,
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                    population: 0,
                };
            }
            if (region.controller === 'jin' && region.id !== 'city-region-25') {
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

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'raid' },
        });

        expect(pending.selectedRegionId).toBe('ji-zhen');
        expect(pending.pendingTargetAction).toMatchObject({
            actionId: 'raid',
            sourceRegionId: 'city-region-25',
            sourceRegionName: '山海关',
            targetRegionId: 'ji-zhen',
            targetRegionName: '蓟镇',
            targetRuntimeRegionId: 'city-region-28-jizhen',
        });
        expect(pending.pendingTargetAction?.resolutionHint).toContain('山海关 → 蓟镇');
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
        core.selectedRegionId = 'ji-zhen';
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
        core.selectedRegionId = 'city-region-19-liaoxi';
        core.actionChoices = getActionChoicesForFaction('jin');
        core.selectedActionId = 'marriage-subjugation';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion || region.id !== 'city-region-19-liaoxi') {
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
});
