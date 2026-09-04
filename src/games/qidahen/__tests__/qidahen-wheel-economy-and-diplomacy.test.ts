import { describe, expect, it } from 'vitest';import { QidahenDomain } from '../domain';
import { resolveQidahenDiplomacyInteractionChoice } from '../domain/actionWindowChoices';

import { QIDAHEN_COMMANDS } from '../domain/commands';
import { getActionChoicesForFaction } from '../domain/factionActionWindow';
import { syncQidahenRuntimeInteractionState } from '../domain/runtimeInteractions';import type { QidahenCore } from '../domain/types';
import type { MatchState } from '../../../engine/types';
import { createInitialSystemState } from '../../../engine/pipeline';
import { getPromptOptions } from '../../../engine/testing/interactionTestFacade';

import { engineConfig } from '../game';import { random, QidahenDiplomacySelectionSnapshot, apply, getDiplomacySelection, applyPipeline, getPromptSummary, getPromptData, getPromptSourceId, respondToPrompt, factionHandCards, keepOnlyMingHomelandFallback } from './helpers/paymentSelectionHarness';

describe('七大恨轮盘经济与外交雇佣', () => {
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
                        pieceIds: ['ming-songjin-artillery-piece-1'],
                    },
                ],
            };
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        const songjin = next.regions.find((region) => region.id === 'song-jin');
        const artilleryPieceIds = songjin?.specialTroops.find((stack) => stack.troopKind === 'artillery')?.pieceIds ?? [];
        expect(next.actionWheelPosition).toBe('wheel-recruit-train');
        expect(songjin).toMatchObject({
            troops: 3,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({
                    id: 'ming-recruit-regular-artillery-lv2',
                    label: '大明炮兵',
                    faction: 'ming',
                    troopKind: 'artillery',
                    count: 1,
                    level: 2,
                    pieceIds: ['ming-songjin-artillery-piece-1'],
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
        expect(artilleryPieceIds).toEqual(['ming-songjin-artillery-piece-1']);
        expect(next.pieces.find((piece) => piece.id === 'ming-songjin-artillery-piece-1')).toMatchObject({
            sourceStackId: 'ming-recruit-regular-artillery-lv2',
            regionId: 'song-jin',
            location: 'field',
            level: 2,
        });
        expect(next.lastSeasonSummary?.title).toBe('轮盘征兵/训练');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('训练 1 个炮兵至等级 2');
    });

it('轮盘征兵训练不会把正规军加到附庸区，而会回退到本土控制区', () => {
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
        expect(getDiplomacySelection(next)?.sourceRegionId).toBe('song-jin');
        expect(getDiplomacySelection(next)?.choices.map((choice) => choice.id)).toContain('hire-only');

        const targeted = apply(next, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-22' },
        });
        expect(getDiplomacySelection(targeted)?.targetRegionId).toBe('city-region-22');
        expect(getDiplomacySelection(targeted)?.choices.map((choice) => choice.id)).toContain('place-friendly');

        const resolved = apply(targeted, {
            type: QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE,
            playerId: '0',
            payload: { choiceId: 'place-friendly' },
        });

        expect(resolved.turnPhase).toBe('diplomacy-choice');
        expect(resolved.selectedRegionId).toBe('song-jin');
        expect(resolved.explicitRegionId).toBe('city-region-22');
        expect(resolved.diplomacyProgress?.resolvedSteps).toHaveLength(1);
        expect(resolved.diplomacyProgress?.remainingTargetCount).toBe(2);
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

it('外交雇佣选择现在会正式挂到交互提示，并通过提示响应连续收口', () => {
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

        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        }).state;

        let interaction = getPromptSummary(state);
        expect(interaction?.kind).toBe('simple-choice');
        expect(getPromptSourceId(state)).toBe('qidahen:diplomacy');
        expect(getPromptOptions(state).map((option) => option.id)).toContain('hire-only');
        expect(getDiplomacySelection(state.core)?.sourceRegionId).toBe('song-jin');

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-22' },
        }).state;

        interaction = getPromptSummary(state);
        expect(getPromptSourceId(state)).toBe('qidahen:diplomacy');
        expect(getDiplomacySelection(state.core)?.targetRegionId).toBe('city-region-22');
        expect(getPromptOptions(state).map((option) => option.id)).toContain('place-friendly');

        state = respondToPrompt(state, '0', { optionId: 'place-friendly' });

        interaction = getPromptSummary(state);
        expect(getPromptSourceId(state)).toBe('qidahen:diplomacy');
        expect(state.core.diplomacyProgress?.resolvedSteps).toHaveLength(1);
        expect(state.core.diplomacyProgress?.remainingTargetCount).toBe(2);
        expect(state.core.regions.find((region) => region.id === 'city-region-22')).toMatchObject({
            diplomacyMarkerFaction: 'ming',
            diplomacyMarkerSide: 'friendly',
            controlLabel: '大明友好',
        });

        state = respondToPrompt(state, '0', { optionId: 'hire-only' });

        expect(getPromptSummary(state).id).toBeUndefined();
        expect(state.core.diplomacyProgress).toBeNull();
        expect(state.core.turnPhase).toBe('action-window');
        expect(state.core.regions.find((region) => region.id === 'song-jin')).toMatchObject({
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
    });

it('外交雇佣 resolver 现在可以直接吃 interaction 快照，而不是硬依赖 core.diplomacySelection 留在宿主上', () => {
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

        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        }).state;
        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-22' },
        }).state;

        const interactionData = getPromptData(state) as {
            sourceId?: string;
            qidahenDiplomacySelection?: QidahenDiplomacySelectionSnapshot;
        } | undefined;
        expect(interactionData?.sourceId).toBe('qidahen:diplomacy');
        expect(interactionData?.qidahenDiplomacySelection).toMatchObject({
            sourceRegionId: 'song-jin',
            targetRegionId: 'city-region-22',
        });

        const resolved = resolveQidahenDiplomacyInteractionChoice(
            {
                ...state.core,
                diplomacyProgress: null,
            },
            'place-friendly',
            100,
            interactionData?.qidahenDiplomacySelection ?? null,
        );

        expect(resolved.turnPhase).toBe('diplomacy-choice');
        expect(resolved.selectedRegionId).toBe('song-jin');
        expect(resolved.explicitRegionId).toBe('city-region-22');
        expect(resolved.regions.find((region) => region.id === 'city-region-22')).toMatchObject({
            diplomacyMarkerFaction: 'ming',
            diplomacyMarkerSide: 'friendly',
            controlLabel: '大明友好',
        });
        expect(resolved.diplomacyProgress).toMatchObject({
            remainingTargetCount: 2,
        });
    });

it('外交雇佣重新点地图时，现在可以优先吃 REGION_SELECTED 事件里的 interaction carry，而不是硬依赖 core.diplomacySelection', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-hire';
        core.selectedRegionId = 'song-jin';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-22' || region.id === 'city-region-19-liaoxi') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        }).state;
        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-22' },
        }).state;
        state = respondToPrompt(state, '0', { optionId: 'place-friendly' });

        const interactionData = getPromptData(state) as {
            sourceId?: string;
            qidahenDiplomacySelection?: QidahenDiplomacySelectionSnapshot;
        } | undefined;
        expect(interactionData?.sourceId).toBe('qidahen:diplomacy');
        expect(interactionData?.qidahenDiplomacySelection).toMatchObject({
            sourceRegionId: 'song-jin',
            targetRegionId: 'city-region-22',
            remainingTargetCount: 2,
        });

        const rebuilt = applyPipeline({
            ...state,
            core: {
                ...state.core,
                diplomacyProgress: null,
            },
        }, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'liao-xi' },
        }).state;

        expect(rebuilt.core.turnPhase).toBe('diplomacy-choice');
        expect(rebuilt.core.selectedRegionId).toBe('song-jin');
        expect(rebuilt.core.explicitRegionId).toBe('liao-xi');
        expect(getDiplomacySelection(rebuilt.core)).toMatchObject({
            sourceRegionId: 'song-jin',
            displayAnchorRegionId: 'song-jin',
            displayAnchorRegionName: '皮岛',
            targetRegionId: 'city-region-19-liaoxi',
            targetRegionName: '辽西',
            remainingTargetCount: 2,
        });
        expect(rebuilt.core.diplomacyProgress?.resolvedSteps).toHaveLength(1);
    });

it('大汗令箭进入外交雇佣后误点重建 diplomacy-choice 时，不会把可派生外交等待态写回 core.diplomacySelection', () => {
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
            if (region.id === 'city-region-22' || region.id === 'city-region-19-liaoxi') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        }).state;
        state = respondToPrompt(state, '1', { optionId: 'hire-dispatch' });
        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-22' },
        }).state;

        const interactionData = getPromptData(state) as {
            sourceId?: string;
            qidahenDiplomacySelection?: QidahenDiplomacySelectionSnapshot;
        } | undefined;
        expect(interactionData?.sourceId).toBe('qidahen:diplomacy');
        expect(interactionData?.qidahenDiplomacySelection).toMatchObject({
            source: 'khan-edict',
            sourceRegionId: 'city-region-25',
            targetRegionId: 'city-region-22',
            remainingTargetCount: 3,
        });

        const rebuilt = applyPipeline({
            ...state,
            core: {
                ...state.core,
                diplomacyProgress: null,
            },
        }, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'liao-xi' },
        }).state;

        expect(rebuilt.core.turnPhase).toBe('diplomacy-choice');
        expect(rebuilt.core.selectedRegionId).toBe('city-region-25');
        expect(rebuilt.core.explicitRegionId).toBe('liao-xi');
        expect(rebuilt.core.diplomacyProgress).toMatchObject({
            source: 'khan-edict',
            sourceRegionId: 'city-region-25',
            remainingTargetCount: 3,
        });
        expect(getDiplomacySelection(rebuilt.core)).toMatchObject({
            source: 'khan-edict',
            sourceRegionId: 'city-region-25',
            sourceRegionName: '山海关',
            displayAnchorRegionId: 'city-region-25',
            displayAnchorRegionName: '山海关',
            targetRegionId: 'city-region-19-liaoxi',
            targetRegionName: '辽西',
            remainingTargetCount: 3,
        });
        expect(getDiplomacySelection(rebuilt.core)?.resolvedSteps).toHaveLength(0);
    });

it('外交雇佣在清空 host 与 interaction 后，仍可只靠轮盘 phase 与当前选区重建目标选择', () => {
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

        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        }).state;

        state = applyPipeline({
            core: {
                ...state.core,
                diplomacyProgress: null,
            },
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        }, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-22' },
        }).state;

        expect((getPromptData(state) as { sourceId?: string } | undefined)?.sourceId).toBe('qidahen:diplomacy');
        expect(state.core.turnPhase).toBe('diplomacy-choice');
        expect(state.core.selectedRegionId).toBe('song-jin');
        expect(state.core.explicitRegionId).toBe('city-region-22');
        expect(getDiplomacySelection(state.core)).toMatchObject({
            sourceRegionId: 'song-jin',
            targetRegionId: 'city-region-22',
        });
    });

it('外交雇佣 resolver 在 core 残留旧 selection 时，仍优先吃 interaction 快照', () => {
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

        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        }).state;
        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-22' },
        }).state;

        const interactionData = getPromptData(state) as {
            sourceId?: string;
            qidahenDiplomacySelection?: QidahenDiplomacySelectionSnapshot;
        } | undefined;
        const freshSelection = interactionData?.qidahenDiplomacySelection ?? null;
        expect(freshSelection?.targetRegionId).toBe('city-region-22');

        const resolved = resolveQidahenDiplomacyInteractionChoice(
            {
                ...state.core,
                diplomacyProgress: state.core.diplomacyProgress,
            },
            'place-friendly',
            100,
            freshSelection,
        );

        expect(resolved.selectedRegionId).toBe('song-jin');
        expect(resolved.explicitRegionId).toBe('city-region-22');
        expect(resolved.regions.find((region) => region.id === 'city-region-22')).toMatchObject({
            diplomacyMarkerFaction: 'ming',
            diplomacyMarkerSide: 'friendly',
            controlLabel: '大明友好',
        });
        expect(resolved.regions.find((region) => region.id === 'song-jin')?.diplomacyMarkerFaction).not.toBe('ming');
        expect(getDiplomacySelection(resolved)).toMatchObject({
            remainingTargetCount: 2,
            targetRegionId: 'city-region-22',
        });
    });

it('外交雇佣 legacy host 字段单独残留时，不会再被当成正式等待态重开 interaction', () => {
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

        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        }).state;

        const legacySelection = getDiplomacySelection(state.core);
        expect(legacySelection?.sourceRegionId).toBe('song-jin');

        const rebuilt = syncQidahenRuntimeInteractionState({
            core: ({
                ...state.core,
                turnPhase: 'action-window',
                diplomacySelection: legacySelection,
            } as QidahenCore & { diplomacySelection?: QidahenDiplomacySelectionSnapshot }),
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        });

        expect(getPromptSummary(rebuilt).id).toBeUndefined();
    });

it('外交雇佣 runtime interaction 在 core 残留旧 selection 时，仍优先沿当前 interaction data 续建', () => {
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

        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        }).state;
        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-22' },
        }).state;

        const rebuilt = syncQidahenRuntimeInteractionState({
            ...state,
            core: ({
                ...state.core,
                diplomacySelection: getDiplomacySelection(state.core)
                    ? {
                        ...getDiplomacySelection(state.core)!,
                        targetRegionId: 'song-jin',
                        targetRegionName: '皮岛',
                        candidateTargetRegionIds: ['song-jin'],
                    }
                    : null,
            } as QidahenCore & { diplomacySelection?: QidahenDiplomacySelectionSnapshot }),
        });

        const interactionData = getPromptData(rebuilt) as {
            sourceId?: string;
            qidahenDiplomacySelection?: QidahenDiplomacySelectionSnapshot;
        } | undefined;
        expect(interactionData?.sourceId).toBe('qidahen:diplomacy');
        expect(interactionData?.qidahenDiplomacySelection?.sourceRegionId).toBe('song-jin');
        expect(interactionData?.qidahenDiplomacySelection?.targetRegionId).not.toBe('song-jin');
        expect(interactionData?.qidahenDiplomacySelection?.candidateTargetRegionIds).not.toEqual(['song-jin']);
    });

it('轮盘外交雇佣若当前选中区不是合法来源，会把 selectedRegionId 收到回退后的真实来源区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        keepOnlyMingHomelandFallback(core);
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
        expect(getDiplomacySelection(next)?.sourceRegionId).toBe('song-jin');
        expect(getDiplomacySelection(next)?.sourceRegionName).toBe('皮岛');
    });

it('轮盘外交从逻辑区辽东起手后，改点目标区时仍会保留来源规则名', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-hire';
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
                    troops: 2,
                    population: 0,
                    specialTroops: [],
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                    siegeState: null,
                    cityState: null,
                };
            }
            if (region.id === 'city-region-22') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                    siegeState: null,
                    cityState: null,
                };
            }
            return region;
        });

        const choosing = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        expect(choosing.selectedRegionId).toBe('city-region-15-liaodong');
        expect(getDiplomacySelection(choosing)?.sourceRegionId).toBe('city-region-15-liaodong');
        expect(getDiplomacySelection(choosing)?.sourceRegionName).toBe('辽东');

        const targeted = apply(choosing, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-22' },
        });

        expect(targeted.selectedRegionId).toBe('city-region-15-liaodong');
        expect(targeted.explicitRegionId).toBe('city-region-22');
        expect(getDiplomacySelection(targeted)).toMatchObject({
            sourceRegionId: 'city-region-15-liaodong',
            sourceRegionName: '辽东',
            hireRegionName: '辽东',
            targetRegionId: 'city-region-22',
        });
        expect(getDiplomacySelection(targeted)?.targetHint).toContain('东江');
        expect(getDiplomacySelection(targeted)?.choices[0]?.detail).toContain('辽东');

        const resolved = apply(targeted, {
            type: QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE,
            playerId: '0',
            payload: { choiceId: 'place-friendly' },
        });

        expect(resolved.selectedRegionId).toBe('city-region-15-liaodong');
        expect(resolved.explicitRegionId).toBe('city-region-22');
        expect(getDiplomacySelection(resolved)?.sourceRegionName).toBe('辽东');
        expect(getDiplomacySelection(resolved)?.hireRegionName).toBe('辽东');
        expect(getDiplomacySelection(resolved)?.choices[0]?.detail).toContain('辽东');
    });

it('轮盘外交从逻辑区蓟镇起手后，改点目标区时仍会保留来源规则名', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-hire';
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
                    troops: 2,
                    population: 0,
                    specialTroops: [],
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                    siegeState: null,
                    cityState: null,
                };
            }
            if (region.id === 'city-region-22') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                    siegeState: null,
                    cityState: null,
                };
            }
            return region;
        });

        const choosing = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        expect(choosing.selectedRegionId).toBe('city-region-28-jizhen');
        expect(getDiplomacySelection(choosing)?.sourceRegionId).toBe('city-region-28-jizhen');
        expect(getDiplomacySelection(choosing)?.sourceRegionName).toBe('蓟镇');

        const targeted = apply(choosing, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-22' },
        });

        expect(targeted.selectedRegionId).toBe('city-region-28-jizhen');
        expect(targeted.explicitRegionId).toBe('city-region-22');
        expect(getDiplomacySelection(targeted)).toMatchObject({
            sourceRegionId: 'city-region-28-jizhen',
            sourceRegionName: '蓟镇',
            hireRegionName: '蓟镇',
            targetRegionId: 'city-region-22',
        });
        expect(getDiplomacySelection(targeted)?.targetHint).toContain('东江');
        expect(getDiplomacySelection(targeted)?.choices[0]?.detail).toContain('蓟镇');
    });

it('外交目标选择中点到逻辑区辽西时，会保留外交来源焦点并把目标收到真实运行时区域', () => {
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
        expect(getDiplomacySelection(choosing)?.sourceRegionId).toBe('jinzhou');

        const targeted = apply(choosing, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'liao-xi' },
        });

        expect(targeted.turnPhase).toBe('diplomacy-choice');
        expect(targeted.selectedRegionId).toBe('jinzhou');
        expect(targeted.explicitRegionId).toBe('liao-xi');
        expect(getDiplomacySelection(targeted)).toMatchObject({
            sourceRegionId: 'jinzhou',
            displayAnchorRegionId: 'jinzhou',
            targetRegionId: 'city-region-19-liaoxi',
            targetRegionName: '辽西',
        });
        expect(getDiplomacySelection(targeted)?.choices.map((choice) => choice.id)).toContain('place-friendly');
    });

it('外交已处理一步后再点逻辑区辽西时，会保留来源焦点和进度并把目标收到真实运行时区域', () => {
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
            if (region.id === 'city-region-24' || region.id === 'city-region-19-liaoxi') {
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
        expect(step1.selectedRegionId).toBe('jinzhou');
        expect(step1.explicitRegionId).toBe('city-region-24');
        expect(step1.diplomacyProgress?.remainingTargetCount).toBe(2);
        expect(step1.diplomacyProgress).toMatchObject({
            displayAnchorRegionId: 'jinzhou',
            displayAnchorRegionName: '锦州',
        });
        expect(step1.diplomacyProgress?.resolvedSteps).toHaveLength(1);

        const retargeted = apply(step1, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'liao-xi' },
        });

        expect(retargeted.turnPhase).toBe('diplomacy-choice');
        expect(retargeted.selectedRegionId).toBe('jinzhou');
        expect(retargeted.explicitRegionId).toBe('liao-xi');
        expect(getDiplomacySelection(retargeted)).toMatchObject({
            sourceRegionId: 'jinzhou',
            sourceRegionName: '锦州',
            displayAnchorRegionId: 'jinzhou',
            displayAnchorRegionName: '锦州',
            targetRegionId: 'city-region-19-liaoxi',
            targetRegionName: '辽西',
            remainingTargetCount: 2,
        });
        expect(retargeted.diplomacyProgress?.resolvedSteps).toHaveLength(1);
        expect(getDiplomacySelection(retargeted)?.choices.map((choice) => choice.id)).toContain('place-friendly');
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
            if (region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            if (region.id === 'city-region-24') {
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
            payload: { regionId: 'jinzhou' },
        });
        expect(step1Target.turnPhase).toBe('diplomacy-choice');
        expect(step1Target.selectedRegionId).toBe('city-region-25');
        expect(step1Target.explicitRegionId).toBe('jinzhou');
        expect(step1Target.diplomacyProgress).toMatchObject({
            source: 'khan-edict',
            sourceRegionId: 'city-region-25',
            remainingTargetCount: 3,
        });
        expect(getDiplomacySelection(step1Target)?.targetRegionId).toBe('jinzhou');
        const step1 = apply(step1Target, {
            type: QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE,
            playerId: '1',
            payload: { choiceId: 'place-friendly' },
        });
        expect(step1.turnPhase).toBe('diplomacy-choice');
        expect(step1.selectedRegionId).toBe('city-region-25');
        expect(step1.explicitRegionId).toBe('jinzhou');
        expect(getDiplomacySelection(step1)?.targetRegionId).toBe('jinzhou');
        expect(step1.diplomacyProgress?.remainingTargetCount).toBe(2);

        const step2Target = apply(step1, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'jinzhou' },
        });
        expect(step2Target.turnPhase).toBe('diplomacy-choice');
        expect(step2Target.selectedRegionId).toBe('city-region-25');
        expect(step2Target.explicitRegionId).toBe('jinzhou');
        expect(getDiplomacySelection(step2Target)?.targetRegionId).toBe('jinzhou');
        const step2 = apply(step2Target, {
            type: QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE,
            playerId: '1',
            payload: { choiceId: 'flip-vassal' },
        });
        expect(step2.turnPhase).toBe('diplomacy-choice');
        expect(step2.selectedRegionId).toBe('city-region-25');
        expect(step2.explicitRegionId).toBe('jinzhou');
        expect(getDiplomacySelection(step2)?.targetRegionId).toBe('jinzhou');
        expect(step2.diplomacyProgress?.remainingTargetCount).toBe(1);
        expect(step2.regions.find((region) => region.id === 'jinzhou')).toMatchObject({
            controller: 'mongol',
            diplomacyMarkerFaction: 'mongol',
            diplomacyMarkerSide: 'vassal',
            controlLabel: '蒙古附庸',
        });

        const step3Target = apply(step2, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-24' },
        });
        expect(step3Target.turnPhase).toBe('diplomacy-choice');
        expect(step3Target.selectedRegionId).toBe('city-region-25');
        expect(step3Target.explicitRegionId).toBe('city-region-24');
        expect(getDiplomacySelection(step3Target)?.targetRegionId).toBe('city-region-24');
        const finished = apply(step3Target, {
            type: QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE,
            playerId: '1',
            payload: { choiceId: 'remove-marker' },
        });

        expect(finished.turnPhase).toBe('action-window');
        expect(finished.selectedRegionId).toBe('city-region-13');
        expect(finished.diplomacyProgress).toBeNull();
        expect(finished.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            troops: 4,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({
                    id: 'mongol-mercenary-lv2',
                    count: 2,
                }),
            ]),
        });
        expect(finished.regions.find((region) => region.id === 'jinzhou')).toMatchObject({
            controller: 'mongol',
            diplomacyMarkerFaction: 'mongol',
            diplomacyMarkerSide: 'vassal',
            controlLabel: '蒙古附庸',
        });
        expect(finished.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            diplomacyMarkerFaction: null,
            diplomacyMarkerSide: null,
            controlLabel: '中立',
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
            if (region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            if (region.id === 'city-region-24') {
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
                                pieceIds: ['jin-mercenary-piece-1', 'jin-mercenary-piece-2'],
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
            payload: { regionId: 'jinzhou' },
        });
        expect(step1Target.turnPhase).toBe('diplomacy-choice');
        expect(step1Target.selectedRegionId).toBe('city-region-25');
        expect(step1Target.explicitRegionId).toBe('jinzhou');
        expect(step1Target.diplomacyProgress).toMatchObject({
            source: 'khan-edict',
            sourceRegionId: 'city-region-25',
            remainingTargetCount: 3,
        });
        expect(getDiplomacySelection(step1Target)?.targetRegionId).toBe('jinzhou');
        const step1 = apply(step1Target, {
            type: QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE,
            playerId: '1',
            payload: { choiceId: 'place-friendly' },
        });
        expect(step1.turnPhase).toBe('diplomacy-choice');
        expect(step1.selectedRegionId).toBe('city-region-25');
        expect(step1.explicitRegionId).toBe('jinzhou');
        expect(getDiplomacySelection(step1)?.targetRegionId).toBe('jinzhou');
        const step2Target = apply(step1, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'jinzhou' },
        });
        expect(step2Target.turnPhase).toBe('diplomacy-choice');
        expect(step2Target.selectedRegionId).toBe('city-region-25');
        expect(step2Target.explicitRegionId).toBe('jinzhou');
        expect(getDiplomacySelection(step2Target)?.targetRegionId).toBe('jinzhou');
        const step2 = apply(step2Target, {
            type: QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE,
            playerId: '1',
            payload: { choiceId: 'flip-vassal' },
        });
        expect(step2.turnPhase).toBe('diplomacy-choice');
        expect(step2.selectedRegionId).toBe('city-region-25');
        expect(step2.explicitRegionId).toBe('jinzhou');
        expect(getDiplomacySelection(step2)?.targetRegionId).toBe('jinzhou');
        const preservedMercenaryPieceIds = step2.regions.find((region) => region.id === 'city-region-24')
            ?.cityState?.specialTroops.flatMap((stack) => stack.pieceIds ?? []) ?? [];
        expect(preservedMercenaryPieceIds.sort()).toEqual([
            'jin-mercenary-piece-1',
            'jin-mercenary-piece-2',
        ]);
        expect(
            step2.pieces
                .filter((piece) => piece.regionId === 'city-region-24' && piece.location === 'city')
                .map((piece) => piece.id)
                .sort(),
        ).toEqual(preservedMercenaryPieceIds.slice().sort());
        const targeted = apply(step2, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'city-region-24' },
        });
        expect(targeted.turnPhase).toBe('diplomacy-choice');
        expect(targeted.selectedRegionId).toBe('city-region-25');
        expect(targeted.explicitRegionId).toBe('city-region-24');
        expect(getDiplomacySelection(targeted)?.targetRegionId).toBe('city-region-24');
        const finished = apply(targeted, {
            type: QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE,
            playerId: '1',
            payload: { choiceId: 'remove-marker' },
        });

        expect(finished.turnPhase).toBe('action-window');
        expect(finished.selectedRegionId).toBe('city-region-13');
        expect(finished.diplomacyProgress).toBeNull();
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
        expect(finished.regions.find((region) => region.id === 'jinzhou')).toMatchObject({
            controller: 'mongol',
            diplomacyMarkerFaction: 'mongol',
            diplomacyMarkerSide: 'vassal',
            controlLabel: '蒙古附庸',
        });
        expect(finished.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'neutral',
            controlLabel: '中立',
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
        expect(
            finished.pieces.some((piece) => (
                piece.id === 'jin-mercenary-piece-1'
                || piece.id === 'jin-mercenary-piece-2'
            )),
        ).toBe(false);
        expect(finished.factions.mongol.troops).toBe(core.factions.mongol.troops + 2);
        expect(finished.factions.jin.troops).toBe(core.factions.jin.troops - 2);
        expect(finished.lastSeasonSummary?.lines.join(' | ')).toContain('移除 2 个雇佣军');
        expect(finished.actionLog.some((entry) => entry.text.includes('移除 2 个雇佣军'))).toBe(true);
    });
});
