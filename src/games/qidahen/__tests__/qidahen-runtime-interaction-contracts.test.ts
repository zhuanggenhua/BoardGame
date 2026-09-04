import { describe, expect, it } from 'vitest';import { getQidahenDriveTigerConsentSelectionForCore, getQidahenFortificationMaintenanceSelectionForCore, QidahenDomain } from '../domain';

import { resolveQidahenInternalDispatchInteractionChoice, resolveQidahenWheelDispatchInteractionChoice } from '../domain/actionWindowDispatch';import { resolveQidahenDriveTigerConsentInteractionChoice, resolveQidahenKhanEdictInteractionChoice, resolveQidahenMaShiTradeInteractionChoice, resolveQidahenRecruitInteractionChoice } from '../domain/actionWindowChoices';

import { syncQidahenCurrentCoreSelections } from '../domain/coreDerivedState';
import { QIDAHEN_COMMANDS } from '../domain/commands';import { getQidahenCurrentWheelDispatchSelectionForCore } from '../domain/dispatchSelectionBuilders';

import { getActionChoicesForFaction } from '../domain/factionActionWindow';
import { resolveQidahenFortificationMaintenanceInteractionChoice } from '../domain/fortificationMaintenance';
import { resolveQidahenPostBattleInteractionChoice } from '../domain/pendingBattleFlow';
import { syncQidahenRuntimeInteractionState } from '../domain/runtimeInteractions';import type { QidahenCore, QidahenDriveTigerConsentSelection, QidahenInternalDispatchSelection } from '../domain/types';
import type { MatchState } from '../../../engine/types';
import { createInitialSystemState } from '../../../engine/pipeline';
import { getPromptOptions } from '../../../engine/testing/interactionTestFacade';

import { engineConfig } from '../game';import { random, apply, getDriveTigerConsentSelection, getRecruitSelection, getMaShiTradeSelection, getKhanEdictSelection, getDiplomacySelection, getInternalDispatchSelection, getWheelDispatchSelection, applyPipeline, getPromptSummary, getPromptData, getPromptSourceId, respondToPrompt, expectNoPrompt, factionHandCards, clearRuntimeBattleFixture, setRegionCavalry } from './helpers/paymentSelectionHarness';

describe('七大恨运行时交互合同', () => {
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
        expect(next.selectedRegionId).toBe('city-region-14');
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
        expect(resolved.selectedRegionId).toBe('city-region-14');
        expect(resolved.handLimitDiscardSelection).toBeNull();
        expect(resolved.factions.mongol.handCount).toBe(10);
        expect(resolved.factions.mongol.discardPileCount).toBe(3);
        expect(factionHandCards(resolved, 'mongol')).toHaveLength(10);
        expect(factionHandCards(resolved, 'mongol').some((card) => card.id === firstCard || card.id === secondCard)).toBe(false);
        expect(resolved.actionLog.map((log) => log.text).join(' | ')).toContain('已按手牌上限弃掉 2 张牌');
    });

it('超限弃牌现在会正式挂到交互提示，并通过提示响应收口', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const mongolCards = factionHandCards(core, 'mongol');
        const extraMongolCards = Array.from({ length: 6 }, (_, index) => ({
            ...mongolCards[index % mongolCards.length],
            id: `mongol-over-limit-runtime-${index + 1}`,
            label: `蒙古超限运行时手牌 ${index + 1}`,
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
        let state: MatchState<QidahenCore> = {
            core: overloadedCore,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        }).state;
        const recruitInteraction = getPromptSummary(state);
        expect(recruitInteraction.kind).toBe('simple-choice');
        expect(recruitInteraction.sourceId).toBe('qidahen:recruit');
        state = respondToPrompt(state, '0', { optionId: 'level-2-troops' });
        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        }).state;

        const interaction = getPromptSummary(state);
        expect(interaction.kind).toBe('simple-choice');
        expect(interaction.sourceId).toBe('qidahen:hand-limit-discard');
        const optionIds = getPromptOptions(state).slice(0, 2).map((option) => option.id);
        expect(optionIds).toHaveLength(2);

        state = respondToPrompt(state, '1', { optionIds });

        expectNoPrompt(state);
        expect(state.core.handLimitDiscardSelection).toBeNull();
        expect(state.core.factions.mongol.handCount).toBe(10);
        expect(factionHandCards(state.core, 'mongol').some((card) => optionIds.includes(card.id))).toBe(false);
    });

it('征召军队选择现在会正式挂到交互提示，并通过提示响应收口', () => {
        let state: MatchState<QidahenCore> = {
            core: QidahenDomain.setup(['0', '1', '2'], random),
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'song-jin' },
        }).state;
        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        }).state;

        const interaction = getPromptSummary(state);
        expect(interaction.kind).toBe('simple-choice');
        expect(interaction.sourceId).toBe('qidahen:recruit');
        expect(getPromptOptions(state).map((option) => option.id)).toEqual([
            'level-2-troops',
            'level-4-chuanbing',
            'level-1-artillery',
        ]);
        expect(getRecruitSelection(state.core)).toMatchObject({
            targetRegionId: 'song-jin',
        });

        state = respondToPrompt(state, '0', { optionId: 'level-2-troops' });

        expectNoPrompt(state);
        expect(state.core.recruitSelection).toBeNull();
        expect(state.core.selectedRegionId).toBe('song-jin');
        expect(state.core.turnPhase).toBe('action-window');
        expect(state.core.regions.find((region) => region.id === 'song-jin')).toMatchObject({
            troops: 8,
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
        expect(state.core.pieces.filter((piece) => piece.regionId === 'song-jin' && piece.location === 'field')).toHaveLength(8);
    });

it('征召军队选择挂到 sys.interaction 后，仍可继续点地图切换建军目标区', () => {
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
                    cityState: null,
                    siegeState: null,
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
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'song-jin' },
        }).state;
        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        }).state;

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'ning-yuan' },
        }).state;

        expect(getPromptSourceId(state)).toBe('qidahen:recruit');
        expect(state.core.selectedRegionId).toBe('song-jin');
        expect(state.core.explicitRegionId).toBe('ning-yuan');
        expect(getRecruitSelection(state.core)).toMatchObject({
            targetRegionId: 'city-region-24',
            targetRegionName: '宁远',
        });
    });

it('征召军队 resolver 现在可以直接吃 interaction 快照，而不是硬依赖 core.recruitSelection 留在宿主上', () => {
        let state: MatchState<QidahenCore> = {
            core: QidahenDomain.setup(['0', '1', '2'], random),
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'song-jin' },
        }).state;
        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        }).state;

        const interactionData = getPromptData(state) as {
            sourceId?: string;
            qidahenRecruitSelection?: QidahenCore['recruitSelection'];
        } | undefined;
        expect(interactionData?.sourceId).toBe('qidahen:recruit');
        expect(interactionData?.qidahenRecruitSelection).toMatchObject({
            targetRegionId: 'song-jin',
        });

        const resolved = resolveQidahenRecruitInteractionChoice(
            {
                ...state.core,
                recruitSelection: null,
            },
            'level-2-troops',
            100,
            interactionData?.qidahenRecruitSelection ?? null,
        );

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.selectedRegionId).toBe('song-jin');
        expect(resolved.explicitRegionId).toBeNull();
        expect(resolved.regionFocusState).toMatchObject({
            defaultFocusRegionId: 'song-jin',
            lockedSourceRegionId: null,
            currentTargetRegionId: null,
            displayAnchorRegionId: 'song-jin',
        });
        expect(resolved.regions.find((region) => region.id === 'song-jin')).toMatchObject({
            troops: 8,
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
    });

it('征召军队 runtime interaction 在 core.recruitSelection 为空时，仍会按当前等待态重建', () => {
        let state: MatchState<QidahenCore> = {
            core: QidahenDomain.setup(['0', '1', '2'], random),
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'song-jin' },
        }).state;
        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        }).state;

        const rebuilt = syncQidahenRuntimeInteractionState({
            ...state,
            core: {
                ...state.core,
                recruitSelection: null,
            },
        });
        const interactionData = getPromptData(rebuilt) as {
            sourceId?: string;
            qidahenRecruitSelection?: QidahenCore['recruitSelection'];
        } | undefined;

        expect(interactionData?.sourceId).toBe('qidahen:recruit');
        expect(interactionData?.qidahenRecruitSelection?.targetRegionId).toBe('song-jin');
        expect(interactionData?.qidahenRecruitSelection?.choices.map((choice) => choice.id)).toEqual([
            'level-2-troops',
            'level-4-chuanbing',
            'level-1-artillery',
        ]);
    });

it('征召军队 legacy host 字段单独残留时，不会再被当成正式等待态重开 interaction', () => {
        let state: MatchState<QidahenCore> = {
            core: QidahenDomain.setup(['0', '1', '2'], random),
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'song-jin' },
        }).state;
        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        }).state;

        const legacySelection = getRecruitSelection(state.core);
        expect(legacySelection?.targetRegionId).toBe('song-jin');

        const rebuilt = syncQidahenRuntimeInteractionState({
            core: {
                ...state.core,
                turnPhase: 'action-window',
                selectedActionId: null,
                recruitSelection: legacySelection,
            },
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        });

        expect(getRecruitSelection(rebuilt.core)).toBeNull();
        expect(getPromptSummary(rebuilt).id).toBeUndefined();
    });

it('轮盘调度目标选择现在会正式挂到交互提示，并通过提示响应收口', () => {
        const core = setRegionCavalry(clearRuntimeBattleFixture(QidahenDomain.setup(['0', '1', '2'], random)), 'city-region-24', 'ming', 2);
        core.selectedRegionId = 'city-region-24';
        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        }).state;

        const interaction = getPromptSummary(state);
        expect(interaction?.kind).toBe('simple-choice');
        expect(getPromptSourceId(state)).toBe('qidahen:dispatch-targeting');
        expect(getPromptOptions(state).map((option) => option.id)).toContain('city-region-20');
        expect(getWheelDispatchSelection(state.core)).toMatchObject({
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
        });

        state = respondToPrompt(state, '0', { optionId: 'city-region-20' });

        expect((getPromptData(state) as { sourceId?: string } | undefined)?.sourceId).toBe('qidahen:pending-target');
        expect(state.core.wheelDispatchProgress).toBeNull();
        expect(state.core.turnPhase).toBe('resolve-pending');
        expect(state.core.selectedRegionId).toBe('city-region-20');
        expect(state.core.pendingTargetAction).toMatchObject({
            actionId: 'wheel-dispatch',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRuntimeRegionId: 'city-region-20',
            targetRegionName: '土默特部',
        });
    });

it('轮盘调度目标选择挂到 sys.interaction 后，仍可继续点地图锁定目标区', () => {
        const core = setRegionCavalry(clearRuntimeBattleFixture(QidahenDomain.setup(['0', '1', '2'], random)), 'city-region-24', 'ming', 2);
        core.selectedRegionId = 'city-region-24';
        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        }).state;

        expect(getPromptSourceId(state)).toBe('qidahen:dispatch-targeting');

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        }).state;

        expect((getPromptData(state) as { sourceId?: string } | undefined)?.sourceId).toBe('qidahen:pending-target');
        expect(state.core.turnPhase).toBe('resolve-pending');
        expect(state.core.selectedRegionId).toBe('city-region-20');
        expect(state.core.wheelDispatchProgress).toBeNull();
        expect(state.core.pendingTargetAction).toMatchObject({
            actionId: 'wheel-dispatch',
            sourceRegionId: 'city-region-24',
            targetRuntimeRegionId: 'city-region-20',
        });
    });

it('轮盘调度 resolver 现在可以直接吃 interaction 快照，而不是硬依赖 core.wheelDispatchProgress 留在宿主上', () => {
        const core = setRegionCavalry(
            clearRuntimeBattleFixture(QidahenDomain.setup(['0', '1', '2'], random)),
            'city-region-24',
            'ming',
            2,
        );
        core.selectedRegionId = 'city-region-24';
        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        }).state;

        const interactionData = getPromptData(state) as {
            sourceId?: string;
            qidahenWheelDispatchSelection?: QidahenCore['wheelDispatchProgress'];
        } | undefined;
        expect(interactionData?.sourceId).toBe('qidahen:dispatch-targeting');
        expect(interactionData?.qidahenWheelDispatchSelection).toMatchObject({
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
        });

        const resolved = resolveQidahenWheelDispatchInteractionChoice(
            {
                ...state.core,
                wheelDispatchProgress: null,
            },
            'city-region-20',
            100,
            interactionData?.qidahenWheelDispatchSelection ?? null,
        );

        expect(resolved.turnPhase).toBe('resolve-pending');
        expect(resolved.selectedRegionId).toBe('city-region-20');
        expect(resolved.pendingTargetAction).toMatchObject({
            actionId: 'wheel-dispatch',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRuntimeRegionId: 'city-region-20',
            targetRegionName: '土默特部',
        });
    });

it('轮盘调度 resolver 在 core 残留旧 selection 时，仍优先吃 interaction 快照', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'city-region-24', 'ming', 2);
        core.selectedRegionId = 'city-region-24';
        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        }).state;

        const interactionData = getPromptData(state) as {
            sourceId?: string;
            qidahenWheelDispatchSelection?: QidahenCore['wheelDispatchProgress'];
        } | undefined;
        const freshSelection = interactionData?.qidahenWheelDispatchSelection ?? null;
        expect(freshSelection?.sourceRegionId).toBe('city-region-24');

        const resolved = resolveQidahenWheelDispatchInteractionChoice(
            {
                ...state.core,
                wheelDispatchProgress: freshSelection ? {
                    ...freshSelection,
                    sourceRegionId: 'song-jin',
                    sourceRegionName: '皮岛',
                    candidates: [],
                } : null,
            },
            'city-region-20',
            100,
            freshSelection,
        );

        expect(resolved.turnPhase).toBe('resolve-pending');
        expect(resolved.selectedRegionId).toBe('city-region-20');
        expect(resolved.pendingTargetAction).toMatchObject({
            actionId: 'wheel-dispatch',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRuntimeRegionId: 'city-region-20',
        });
    });

it('轮盘调度 runtime interaction 在 core.wheelDispatchProgress 为空时，仍可沿当前 interaction data 续建', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'city-region-24', 'ming', 2);
        core.selectedRegionId = 'city-region-24';
        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        }).state;

        const rebuilt = syncQidahenRuntimeInteractionState({
            ...state,
            core: {
                ...state.core,
                wheelDispatchProgress: null,
            },
        });

        const interactionData = getPromptData(rebuilt) as {
            sourceId?: string;
            qidahenWheelDispatchSelection?: QidahenCore['wheelDispatchProgress'];
        } | undefined;

        expect(interactionData?.sourceId).toBe('qidahen:dispatch-targeting');
        expect(interactionData?.qidahenWheelDispatchSelection).toMatchObject({
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
        });
        expect(interactionData?.qidahenWheelDispatchSelection?.candidates.some((candidate) => candidate.targetRuntimeRegionId === 'city-region-20')).toBe(true);
    });

it('current core selection 同步不会把可派生的轮盘调度等待态重新写回 core.wheelDispatchProgress', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'city-region-24', 'ming', 2);
        core.selectedRegionId = 'city-region-24';
        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        }).state;

        expect(state.core.turnPhase).toBe('dispatch-targeting');
        expect(state.core.wheelDispatchProgress).toBeNull();
        expect(getQidahenCurrentWheelDispatchSelectionForCore(state.core)).toMatchObject({
            sourceActionId: 'wheel-dispatch',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
        });

        const synced = syncQidahenCurrentCoreSelections(state.core);

        expect(synced.turnPhase).toBe('dispatch-targeting');
        expect(synced.wheelDispatchProgress).toBeNull();
        expect(getQidahenCurrentWheelDispatchSelectionForCore(synced)).toMatchObject({
            sourceActionId: 'wheel-dispatch',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
        });
    });

it('轮盘调度重新点地图时，现在可以优先吃 REGION_SELECTED 事件里的 interaction carry，而不是硬依赖 core.wheelDispatchProgress', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'city-region-24', 'ming', 2);
        core.selectedRegionId = 'city-region-24';
        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        }).state;

        const rebuilt = applyPipeline({
            ...state,
            core: {
                ...state.core,
                wheelDispatchProgress: null,
            },
        }, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        }).state;

        expect(rebuilt.core.turnPhase).toBe('resolve-pending');
        expect(rebuilt.core.selectedRegionId).toBe('city-region-20');
        expect(rebuilt.core.pendingTargetAction).toMatchObject({
            actionId: 'wheel-dispatch',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRuntimeRegionId: 'city-region-20',
            targetRegionName: '土默特部',
        });
    });

it('轮盘调度误点后重建 dispatch-targeting 时，不会因为 interaction carry 又把可派生等待态写回 core.wheelDispatchProgress', () => {
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
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                    cityState: null,
                    siegeState: null,
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
        expect(targeting.wheelDispatchProgress).toBeNull();
        expect(getWheelDispatchSelection(targeting)).toMatchObject({
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
        });

        const rebound = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-14' },
        });

        expect(rebound.turnPhase).toBe('dispatch-targeting');
        expect(rebound.selectedRegionId).toBe('city-region-24');
        expect(rebound.explicitRegionId).toBe('city-region-14');
        expect(rebound.wheelDispatchProgress).toBeNull();
        expect(getWheelDispatchSelection(rebound)).toMatchObject({
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            displayAnchorRegionId: 'city-region-24',
            displayAnchorRegionName: '宁远',
        });
    });

it('轮盘调度 runtime interaction 在 core 残留旧 selection 时，仍优先沿当前 interaction data 续建', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'city-region-24', 'ming', 2);
        core.selectedRegionId = 'city-region-24';
        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        }).state;

        const rebuilt = syncQidahenRuntimeInteractionState({
            ...state,
            core: {
                ...state.core,
                wheelDispatchProgress: getWheelDispatchSelection(state.core)
                    ? {
                        ...getWheelDispatchSelection(state.core)!,
                        sourceRegionId: 'song-jin',
                        sourceRegionName: '皮岛',
                        candidates: [],
                    }
                    : null,
            },
        });

        const interactionData = getPromptData(rebuilt) as {
            sourceId?: string;
            qidahenWheelDispatchSelection?: QidahenCore['wheelDispatchProgress'];
        } | undefined;
        expect(interactionData?.sourceId).toBe('qidahen:dispatch-targeting');
        expect(interactionData?.qidahenWheelDispatchSelection).toMatchObject({
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
        });
        expect(interactionData?.qidahenWheelDispatchSelection?.candidates.some((candidate) => candidate.targetRuntimeRegionId === 'city-region-20')).toBe(true);
    });

it('轮盘调度在清空 host 与 interaction 后，仍可只靠轮盘 phase 与当前选区重建并锁定目标区', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'city-region-24', 'ming', 2);
        core.selectedRegionId = 'city-region-24';
        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        }).state;

        state = applyPipeline({
            core: {
                ...state.core,
                wheelDispatchProgress: null,
            },
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        }, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        }).state;

        expect((getPromptData(state) as { sourceId?: string } | undefined)?.sourceId).toBe('qidahen:pending-target');
        expect(state.core.turnPhase).toBe('resolve-pending');
        expect(state.core.selectedRegionId).toBe('city-region-20');
        expect(state.core.pendingTargetAction).toMatchObject({
            actionId: 'wheel-dispatch',
            sourceRegionId: 'city-region-24',
            targetRuntimeRegionId: 'city-region-20',
        });
    });

it('轮盘调度 legacy host 字段单独残留时，不会再被当成正式等待态重开 interaction', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'city-region-24', 'ming', 2);
        core.selectedRegionId = 'city-region-24';
        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        }).state;

        const legacySelection = getWheelDispatchSelection(state.core);
        expect(legacySelection?.sourceRegionId).toBe('city-region-24');

        const rebuilt = syncQidahenRuntimeInteractionState({
            core: {
                ...state.core,
                turnPhase: 'action-window',
                wheelDispatchProgress: legacySelection,
            },
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        });

        expect(getPromptSummary(rebuilt).id).toBeUndefined();
    });

it('战后处理选择现在会正式挂到交互提示，并通过提示响应收口', () => {
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

        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        }).state;
        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        }).state;
        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        }).state;

        const interaction = getPromptSummary(state);
        expect(interaction?.kind).toBe('simple-choice');
        expect(getPromptSourceId(state)).toBe('qidahen:post-battle');
        expect(getPromptOptions(state).map((option) => option.id)).toContain('occupy');
        expect(state.core.turnPhase).toBe('post-battle-decision');
        expect(state.core.postBattleSelection).toMatchObject({
            targetRuntimeRegionId: 'city-region-20',
            committedTroops: 2,
        });

        state = respondToPrompt(state, '0', { optionId: 'occupy' });

        expect(getPromptSummary(state).id).toBeUndefined();
        expect(state.core.postBattleSelection).toBeNull();
        expect(state.core.turnPhase).toBe('action-window');
        expect(state.core.selectedRegionId).toBe('city-region-20');
        expect(state.core.regions.find((region) => region.id === 'city-region-20')).toMatchObject({
            controller: 'ming',
            controlLabel: '大明附庸',
            diplomacyMarkerFaction: 'ming',
            diplomacyMarkerSide: 'vassal',
            troops: 2,
        });
    });

it('战后处理 resolver 现在可以直接吃 interaction 快照，而不是硬依赖 core.postBattleSelection 留在宿主上', () => {
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

        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        }).state;
        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        }).state;
        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        }).state;

        const interactionData = getPromptData(state) as {
            sourceId?: string;
            qidahenPostBattleSelection?: QidahenCore['postBattleSelection'];
        } | undefined;
        expect(interactionData?.sourceId).toBe('qidahen:post-battle');
        expect(interactionData?.qidahenPostBattleSelection).toMatchObject({
            targetRuntimeRegionId: 'city-region-20',
            committedTroops: 2,
        });

        const resolved = resolveQidahenPostBattleInteractionChoice(
            {
                ...state.core,
                postBattleSelection: null,
            },
            'occupy',
            100,
            interactionData?.qidahenPostBattleSelection ?? null,
        );

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.selectedRegionId).toBe('city-region-20');
        expect(resolved.regions.find((region) => region.id === 'city-region-20')).toMatchObject({
            controller: 'ming',
            controlLabel: '大明附庸',
            diplomacyMarkerFaction: 'ming',
            diplomacyMarkerSide: 'vassal',
            troops: 2,
        });
    });

it('战后处理 legacy host 字段单独残留时，不会再被当成正式等待态重开 interaction', () => {
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

        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        }).state;
        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        }).state;
        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        }).state;

        const legacySelection = state.core.postBattleSelection;
        expect(legacySelection?.targetRuntimeRegionId).toBe('city-region-20');

        const rebuilt = syncQidahenRuntimeInteractionState({
            core: {
                ...state.core,
                turnPhase: 'action-window',
                postBattleSelection: legacySelection,
            },
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        });

        expect(getPromptSummary(rebuilt).id).toBeUndefined();
    });

it('战后处理 resolver 在 core 残留旧 selection 时，仍优先吃 interaction 快照', () => {
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

        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        }).state;
        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        }).state;
        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        }).state;

        const interactionData = getPromptData(state) as {
            sourceId?: string;
            qidahenPostBattleSelection?: QidahenCore['postBattleSelection'];
        } | undefined;
        const freshSelection = interactionData?.qidahenPostBattleSelection ?? null;
        expect(freshSelection?.targetRuntimeRegionId).toBe('city-region-20');

        const resolved = resolveQidahenPostBattleInteractionChoice(
            {
                ...state.core,
                postBattleSelection: freshSelection ? {
                    ...freshSelection,
                    targetRuntimeRegionId: 'song-jin',
                    targetRegionName: '皮岛',
                } : null,
            },
            'occupy',
            100,
            freshSelection,
        );

        expect(resolved.selectedRegionId).toBe('city-region-20');
        expect(resolved.regions.find((region) => region.id === 'city-region-20')).toMatchObject({
            controller: 'ming',
            controlLabel: '大明附庸',
            diplomacyMarkerFaction: 'ming',
            diplomacyMarkerSide: 'vassal',
            troops: 2,
        });
    });

it('战后处理 runtime interaction 在 core 残留旧 selection 时，仍优先沿当前 interaction data 续建', () => {
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

        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        }).state;
        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        }).state;
        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        }).state;

        const rebuilt = syncQidahenRuntimeInteractionState({
            ...state,
            core: {
                ...state.core,
                postBattleSelection: state.core.postBattleSelection
                    ? {
                        ...state.core.postBattleSelection,
                        targetRuntimeRegionId: 'song-jin',
                        targetRegionName: '皮岛',
                    }
                    : null,
            },
        });

        const interactionData = getPromptData(rebuilt) as {
            sourceId?: string;
            qidahenPostBattleSelection?: QidahenCore['postBattleSelection'];
        } | undefined;
        expect(interactionData?.sourceId).toBe('qidahen:post-battle');
        expect(interactionData?.qidahenPostBattleSelection).toMatchObject({
            targetRuntimeRegionId: 'city-region-20',
            targetRegionName: '土默特部',
        });
    });

it('待结算选择现在会正式挂到交互提示，并通过提示响应把合并值收口进战后选择', () => {
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

        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        }).state;
        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        }).state;

        const interaction = getPromptSummary(state);
        expect(interaction?.kind).toBe('simple-choice');
        expect(getPromptSourceId(state)).toBe('qidahen:pending-target');
        expect(getPromptOptions(state).map((option) => option.id)).toContain('rear-guard');
        expect(state.core.turnPhase).toBe('resolve-pending');
        expect(state.core.pendingTargetAction).toMatchObject({
            actionId: 'wheel-dispatch',
            sourceRegionId: 'city-region-24',
            targetRuntimeRegionId: 'city-region-20',
            committedTroops: 2,
        });

        state = respondToPrompt(state, '0', {
            optionId: 'rear-guard',
            mergedValue: {
                committedTroops: 1,
                attackerCasualtyPriority: 'lowest-level',
                defenderCasualtyPriority: 'highest-level',
            },
        });

        expect((getPromptData(state) as { sourceId?: string } | undefined)?.sourceId).toBe('qidahen:post-battle');
        expect(state.core.turnPhase).toBe('post-battle-decision');
        expect(state.core.pendingTargetAction).toBeNull();
        expect(state.core.postBattleSelection).toMatchObject({
            targetRuntimeRegionId: 'city-region-20',
            committedTroops: 1,
        });
    });

it('待结算选择挂到 sys.interaction 后，仍可继续通过 RESOLVE_PENDING_ACTION 走真实结算链', () => {
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

        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        }).state;
        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        }).state;

        const interaction = getPromptSummary(state);
        expect(interaction?.kind).toBe('simple-choice');
        expect(getPromptSourceId(state)).toBe('qidahen:pending-target');
        expect((getPromptData(state) as { allowedCommands?: string[] }).allowedCommands).toContain(QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION);

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {
                committedTroops: 1,
                attackerCasualtyPriority: 'lowest-level',
                defenderCasualtyPriority: 'highest-level',
            },
        }).state;

        expect((getPromptData(state) as { sourceId?: string } | undefined)?.sourceId).toBe('qidahen:post-battle');
        expect(state.core.turnPhase).toBe('post-battle-decision');
        expect(state.core.pendingTargetAction).toBeNull();
        expect(state.core.postBattleSelection).toMatchObject({
            targetRuntimeRegionId: 'city-region-20',
            committedTroops: 1,
        });
    });

it('待结算旧命令在 core 残留旧 pending 时，仍优先吃 interaction 快照', () => {
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

        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        }).state;
        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        }).state;

        const interactionData = getPromptData(state) as {
            sourceId?: string;
            qidahenPendingTargetAction?: QidahenCore['pendingTargetAction'];
        } | undefined;
        expect(interactionData?.sourceId).toBe('qidahen:pending-target');
        expect(interactionData?.qidahenPendingTargetAction).toMatchObject({
            targetRuntimeRegionId: 'city-region-20',
            targetRegionName: '土默特部',
        });

        state = applyPipeline({
            ...state,
            core: {
                ...state.core,
                pendingTargetAction: state.core.pendingTargetAction
                    ? {
                        ...state.core.pendingTargetAction,
                        targetRuntimeRegionId: 'song-jin',
                        targetRegionName: '皮岛',
                    }
                    : null,
            },
        }, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {
                committedTroops: 1,
                attackerCasualtyPriority: 'lowest-level',
                defenderCasualtyPriority: 'highest-level',
            },
        }).state;

        expect((getPromptData(state) as { sourceId?: string } | undefined)?.sourceId).toBe('qidahen:post-battle');
        expect(state.core.turnPhase).toBe('post-battle-decision');
        expect(state.core.pendingTargetAction).toBeNull();
        expect(state.core.postBattleSelection).toMatchObject({
            targetRuntimeRegionId: 'city-region-20',
            targetRegionName: '土默特部',
            committedTroops: 1,
        });
    });

it('待结算 legacy host 字段单独残留时，不会再被当成正式等待态重开 interaction', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'city-region-24', 'ming', 2);
        core.selectedRegionId = 'city-region-24';
        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        }).state;
        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        }).state;

        const legacyPendingTargetAction = state.core.pendingTargetAction;
        expect(legacyPendingTargetAction?.targetRuntimeRegionId).toBe('city-region-20');

        const rebuilt = syncQidahenRuntimeInteractionState({
            core: {
                ...state.core,
                turnPhase: 'action-window',
                pendingTargetAction: legacyPendingTargetAction,
            },
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        });

        expect(getPromptSummary(rebuilt).id).toBeUndefined();
    });

it('待结算 runtime interaction 在 core 残留旧 selection 时，仍优先沿当前 interaction data 续建', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'city-region-24', 'ming', 2);
        core.selectedRegionId = 'city-region-24';
        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        }).state;
        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        }).state;

        const rebuilt = syncQidahenRuntimeInteractionState({
            ...state,
            core: {
                ...state.core,
                pendingTargetAction: state.core.pendingTargetAction
                    ? {
                        ...state.core.pendingTargetAction,
                        targetRuntimeRegionId: 'song-jin',
                        targetRegionName: '皮岛',
                    }
                    : null,
            },
        });

        const interactionData = getPromptData(rebuilt) as {
            sourceId?: string;
            qidahenPendingTargetAction?: QidahenCore['pendingTargetAction'];
        } | undefined;
        expect(interactionData?.sourceId).toBe('qidahen:pending-target');
        expect(interactionData?.qidahenPendingTargetAction).toMatchObject({
            sourceRegionId: 'city-region-24',
            targetRuntimeRegionId: 'city-region-20',
            targetRegionName: '土默特部',
        });
    });

it('马市贸易选择现在会正式挂到交互提示，并通过提示响应收口', () => {
        let state: MatchState<QidahenCore> = {
            core: {
                ...QidahenDomain.setup(['0', '1', '2'], random),
                currentPlayer: '1',
                selectedRegionId: 'song-jin',
                selectedActionId: 'ma-shi-trade',
                actionChoices: getActionChoicesForFaction('mongol'),
            },
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'ma-shi-trade' },
        }).state;

        expect(getPromptSourceId(state)).toBe('qidahen:ma-shi-trade');
        expect(getPromptOptions(state).map((option) => option.id)).toEqual(['1', '2', '3']);

        state = respondToPrompt(state, '1', { optionId: '3' });

        expect(getPromptSummary(state).id).toBeUndefined();
        expect(state.core.maShiTradeSelection).toBeNull();
        expect(state.core.turnPhase).toBe('action-window');
        expect(state.core.regions.find((region) => region.id === 'song-jin')).toMatchObject({ troops: 5 });
        expect(state.core.factions.mongol.handCount).toBe(11);
    });

it('马市贸易 resolver 现在可以直接吃 interaction 快照，而不是硬依赖 core.maShiTradeSelection 留在宿主上', () => {
        let state: MatchState<QidahenCore> = {
            core: {
                ...QidahenDomain.setup(['0', '1', '2'], random),
                currentPlayer: '1',
                selectedRegionId: 'song-jin',
                selectedActionId: 'ma-shi-trade',
                actionChoices: getActionChoicesForFaction('mongol'),
            },
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'ma-shi-trade' },
        }).state;

        const interactionData = getPromptData(state) as {
            sourceId?: string;
            qidahenMaShiTradeSelection?: QidahenCore['maShiTradeSelection'];
        } | undefined;
        expect(interactionData?.sourceId).toBe('qidahen:ma-shi-trade');

        const resolved = resolveQidahenMaShiTradeInteractionChoice(
            {
                ...state.core,
                maShiTradeSelection: null,
            },
            3,
            100,
            interactionData?.qidahenMaShiTradeSelection ?? null,
        );

        expect(resolved.maShiTradeSelection).toBeNull();
        expect(resolved.selectedRegionId).toBe('song-jin');
        expect(resolved.explicitRegionId).toBeNull();
        expect(resolved.regionFocusState).toMatchObject({
            defaultFocusRegionId: 'song-jin',
            lockedSourceRegionId: null,
            currentTargetRegionId: null,
            displayAnchorRegionId: 'song-jin',
        });
        expect(resolved.regions.find((region) => region.id === 'song-jin')).toMatchObject({ troops: 5 });
        expect(resolved.factions.mongol.handCount).toBe(11);
    });

it('马市贸易 runtime interaction 在 core.maShiTradeSelection 为空时，仍会按当前等待态重建', () => {
        let state: MatchState<QidahenCore> = {
            core: {
                ...QidahenDomain.setup(['0', '1', '2'], random),
                currentPlayer: '1',
                selectedRegionId: 'song-jin',
                selectedActionId: 'ma-shi-trade',
                actionChoices: getActionChoicesForFaction('mongol'),
            },
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'ma-shi-trade' },
        }).state;

        const rebuilt = syncQidahenRuntimeInteractionState({
            ...state,
            core: {
                ...state.core,
                maShiTradeSelection: null,
            },
        });
        const interactionData = getPromptData(rebuilt) as {
            sourceId?: string;
            qidahenMaShiTradeSelection?: QidahenCore['maShiTradeSelection'];
        } | undefined;

        expect(interactionData?.sourceId).toBe('qidahen:ma-shi-trade');
        expect(interactionData?.qidahenMaShiTradeSelection?.targetRegionId).toBe('song-jin');
        expect(interactionData?.qidahenMaShiTradeSelection?.choices.map((choice) => choice.troopCount)).toEqual([1, 2, 3]);
    });

it('马市贸易 legacy host 字段单独残留时，不会再被当成正式等待态重开 interaction', () => {
        let state: MatchState<QidahenCore> = {
            core: {
                ...QidahenDomain.setup(['0', '1', '2'], random),
                currentPlayer: '1',
                selectedRegionId: 'song-jin',
                selectedActionId: 'ma-shi-trade',
                actionChoices: getActionChoicesForFaction('mongol'),
            },
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'ma-shi-trade' },
        }).state;

        const legacySelection = getMaShiTradeSelection(state.core);
        expect(legacySelection?.targetRegionId).toBe('song-jin');

        const rebuilt = syncQidahenRuntimeInteractionState({
            core: {
                ...state.core,
                turnPhase: 'action-window',
                selectedActionId: null,
                maShiTradeSelection: legacySelection,
            },
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        });

        expect(getMaShiTradeSelection(rebuilt.core)).toBeNull();
        expect(getPromptSummary(rebuilt).id).toBeUndefined();
    });

it('大汗令箭选择现在会正式挂到交互提示，并通过提示响应进入外交雇佣链', () => {
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
                return { ...region, controller: 'mongol', controlLabel: '蒙古', troops: 2 };
            }
            if (region.id === 'city-region-24') {
                return { ...region, controller: 'ming', controlLabel: '大明', troops: 1 };
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

        expect(getPromptSourceId(state)).toBe('qidahen:khan-edict');

        state = respondToPrompt(state, '1', { optionId: 'hire-dispatch' });

        expect((getPromptData(state) as { sourceId?: string } | undefined)?.sourceId).toBe('qidahen:diplomacy');
        expect(state.core.khanEdictSelection).toBeNull();
        expect(state.core.diplomacyProgress).toBeNull();
        expect(getDiplomacySelection(state.core)?.source).toBe('khan-edict');
    });

it('大汗令箭 resolver 现在可以直接吃 interaction 快照，而不是硬依赖 core.khanEdictSelection 留在宿主上', () => {
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
                return { ...region, controller: 'mongol', controlLabel: '蒙古', troops: 2 };
            }
            if (region.id === 'city-region-24') {
                return { ...region, controller: 'ming', controlLabel: '大明', troops: 1 };
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

        const interactionData = getPromptData(state) as {
            sourceId?: string;
            qidahenKhanEdictSelection?: QidahenCore['khanEdictSelection'];
        } | undefined;
        expect(interactionData?.sourceId).toBe('qidahen:khan-edict');

        const resolved = resolveQidahenKhanEdictInteractionChoice(
            {
                ...state.core,
                khanEdictSelection: null,
            },
            'hire-dispatch',
            100,
            interactionData?.qidahenKhanEdictSelection ?? null,
        );

        expect(resolved.khanEdictSelection).toBeNull();
        expect(resolved.diplomacyProgress).toBeNull();
        expect(getDiplomacySelection(resolved)?.source).toBe('khan-edict');
        expect(resolved.turnPhase).toBe('diplomacy-choice');
        expect(resolved.regionFocusState.lockedSourceRegionId).toBe('city-region-25');
        expect(resolved.regionFocusState.displayAnchorRegionId).toBe('city-region-25');
    });

it('大汗令箭进入外交雇佣后，current core selection 同步不会把可派生外交等待态重新写回 core.diplomacySelection', () => {
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
                return { ...region, controller: 'mongol', controlLabel: '蒙古', troops: 2 };
            }
            if (region.id === 'city-region-24') {
                return { ...region, controller: 'ming', controlLabel: '大明', troops: 1 };
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

        expect(state.core.turnPhase).toBe('diplomacy-choice');
        expect(state.core.diplomacyProgress).toBeNull();
        expect(getDiplomacySelection(state.core)).toMatchObject({
            source: 'khan-edict',
            sourceRegionId: 'city-region-25',
            sourceRegionName: '山海关',
        });

        const synced = syncQidahenCurrentCoreSelections(state.core);

        expect(synced.turnPhase).toBe('diplomacy-choice');
        expect(synced.diplomacyProgress).toBeNull();
        expect(getDiplomacySelection(synced)).toMatchObject({
            source: 'khan-edict',
            sourceRegionId: 'city-region-25',
            sourceRegionName: '山海关',
        });
    });

it('大汗令箭 runtime interaction 在 core.khanEdictSelection 为空时，仍会按当前等待态重建', () => {
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
                return { ...region, controller: 'mongol', controlLabel: '蒙古', troops: 2 };
            }
            if (region.id === 'city-region-24') {
                return { ...region, controller: 'ming', controlLabel: '大明', troops: 1 };
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

        const rebuilt = syncQidahenRuntimeInteractionState({
            ...state,
            core: {
                ...state.core,
                khanEdictSelection: null,
            },
        });
        const interactionData = getPromptData(rebuilt) as {
            sourceId?: string;
            qidahenKhanEdictSelection?: QidahenCore['khanEdictSelection'];
        } | undefined;

        expect(interactionData?.sourceId).toBe('qidahen:khan-edict');
        expect(interactionData?.qidahenKhanEdictSelection?.sourceRegionId).toBe('city-region-25');
        expect(interactionData?.qidahenKhanEdictSelection?.choices.map((choice) => choice.id)).toEqual(['recruit-train', 'hire-dispatch']);
    });

it('大汗令箭 legacy host 字段单独残留时，不会再被当成正式等待态重开 interaction', () => {
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
                return { ...region, controller: 'mongol', controlLabel: '蒙古', troops: 2 };
            }
            if (region.id === 'city-region-24') {
                return { ...region, controller: 'ming', controlLabel: '大明', troops: 1 };
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

        const legacySelection = getKhanEdictSelection(state.core);
        expect(legacySelection?.sourceRegionId).toBe('city-region-25');

        const rebuilt = syncQidahenRuntimeInteractionState({
            core: {
                ...state.core,
                turnPhase: 'action-window',
                selectedActionId: null,
                khanEdictSelection: legacySelection,
            },
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        });

        expect(getKhanEdictSelection(rebuilt.core)).toBeNull();
        expect(getPromptSummary(rebuilt).id).toBeUndefined();
    });

it('驱虎吞狼同意选择现在会正式挂到交互提示，并通过提示响应进入指挥调度', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'jinzhou', 'jin', 2, 2);
        core.selectedRegionId = 'jinzhou';
        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'drive-tiger' },
        }).state;

        expect(getPromptSourceId(state)).toBe('qidahen:drive-tiger-consent');

        state = respondToPrompt(state, '2', { optionId: 'accept' });

        expect((getPromptData(state) as { sourceId?: string } | undefined)?.sourceId).toBe('qidahen:dispatch-targeting');
        expect(getQidahenDriveTigerConsentSelectionForCore(state.core)).toBeNull();
        expect(state.core.wheelDispatchProgress).toBeNull();
        expect(getWheelDispatchSelection(state.core)?.attackerFactionId).toBe('jin');
    });

it('驱虎吞狼同意等待现在可以只靠当前 core 重建，而不是硬依赖 core.wheelDispatchProgress 留在宿主上', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'jinzhou', 'jin', 2, 2);
        core.selectedRegionId = 'jinzhou';
        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'drive-tiger' },
        }).state;

        expect(state.core.turnPhase).toBe('drive-tiger-consent');
        expect(state.core.wheelDispatchProgress).toBeNull();
        expect(getWheelDispatchSelection(state.core)).toBeNull();
        expect(getQidahenDriveTigerConsentSelectionForCore(state.core)?.dispatchSelection).toMatchObject({
            attackerFactionId: 'jin',
            sourceRegionId: 'jinzhou',
            sourceActionId: 'drive-tiger',
        });
        expect(getQidahenDriveTigerConsentSelectionForCore(state.core)).toMatchObject({
            commanderFactionId: 'ming',
            targetFactionId: 'jin',
            targetFactionName: '后金',
        });

        const rebuilt = syncQidahenRuntimeInteractionState({
            core: state.core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        });
        const interactionData = getPromptData(rebuilt) as {
            sourceId?: string;
            qidahenDriveTigerConsentSelection?: QidahenDriveTigerConsentSelection;
        } | undefined;

        expect(interactionData?.sourceId).toBe('qidahen:drive-tiger-consent');
        expect(interactionData?.qidahenDriveTigerConsentSelection).toMatchObject({
            commanderFactionId: 'ming',
            targetFactionId: 'jin',
            targetFactionName: '后金',
            dispatchSelection: {
                attackerFactionId: 'jin',
                sourceRegionId: 'jinzhou',
                sourceActionId: 'drive-tiger',
            },
        });
    });

it('驱虎吞狼同意 resolver 现在可以直接吃 interaction 快照，而不是硬依赖 core.driveTigerConsentSelection 留在宿主上', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'jinzhou', 'jin', 2, 2);
        core.selectedRegionId = 'jinzhou';
        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'drive-tiger' },
        }).state;

        const interactionData = getPromptData(state) as {
            sourceId?: string;
            qidahenDriveTigerConsentSelection?: QidahenDriveTigerConsentSelection;
        } | undefined;
        expect(interactionData?.sourceId).toBe('qidahen:drive-tiger-consent');

        const resolved = resolveQidahenDriveTigerConsentInteractionChoice(
            state.core,
            'accept',
            100,
            interactionData?.qidahenDriveTigerConsentSelection ?? null,
        );

        expect(getQidahenDriveTigerConsentSelectionForCore(resolved)).toBeNull();
        expect(resolved.wheelDispatchProgress).toBeNull();
        expect(getWheelDispatchSelection(resolved)?.attackerFactionId).toBe('jin');
        expect(resolved.turnPhase).toBe('dispatch-targeting');
        expect(resolved.explicitRegionId).toBeNull();
        expect(resolved.regionFocusState).toMatchObject({
            defaultFocusRegionId: 'jinzhou',
            lockedSourceRegionId: 'jinzhou',
            currentTargetRegionId: null,
            displayAnchorRegionId: 'jinzhou',
        });
    });

it('驱虎吞狼同意后进入 dispatch-targeting 时，current core selection 同步不会把可派生调度态重新写回 core.wheelDispatchProgress', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'jinzhou', 'jin', 2, 2);
        core.selectedRegionId = 'jinzhou';
        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'drive-tiger' },
        }).state;

        const interactionData = getPromptData(state) as {
            qidahenDriveTigerConsentSelection?: QidahenDriveTigerConsentSelection;
        } | undefined;

        const targeting = resolveQidahenDriveTigerConsentInteractionChoice(
            state.core,
            'accept',
            100,
            interactionData?.qidahenDriveTigerConsentSelection ?? null,
        );

        expect(targeting.turnPhase).toBe('dispatch-targeting');
        expect(targeting.wheelDispatchProgress).toBeNull();
        expect(getWheelDispatchSelection(targeting)?.sourceActionId).toBe('drive-tiger');

        const synced = syncQidahenCurrentCoreSelections(targeting);

        expect(synced.turnPhase).toBe('dispatch-targeting');
        expect(synced.wheelDispatchProgress).toBeNull();
        expect(getWheelDispatchSelection(synced)?.sourceActionId).toBe('drive-tiger');
        expect(getWheelDispatchSelection(synced)?.sourceRegionId).toBe('jinzhou');
    });

it('驱虎吞狼同意后误点重建 dispatch-targeting 时，不会把可派生调度态写回 core.wheelDispatchProgress', () => {
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
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                    cityState: null,
                    siegeState: null,
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
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                    cityState: null,
                    siegeState: null,
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
        const targeting = apply(consenting, {
            type: QIDAHEN_COMMANDS.RESOLVE_DRIVE_TIGER_CONSENT,
            playerId: '2',
            payload: { choiceId: 'accept' },
        });

        expect(targeting.turnPhase).toBe('dispatch-targeting');
        expect(targeting.wheelDispatchProgress).toBeNull();
        expect(getWheelDispatchSelection(targeting)).toMatchObject({
            sourceActionId: 'drive-tiger',
            sourceRegionId: 'jinzhou',
            sourceRegionName: '锦州',
        });

        const rebound = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-14' },
        });

        expect(rebound.turnPhase).toBe('dispatch-targeting');
        expect(rebound.selectedRegionId).toBe('jinzhou');
        expect(rebound.explicitRegionId).toBe('city-region-14');
        expect(rebound.wheelDispatchProgress).toBeNull();
        expect(getWheelDispatchSelection(rebound)).toMatchObject({
            sourceActionId: 'drive-tiger',
            sourceRegionId: 'jinzhou',
            sourceRegionName: '锦州',
        });
    });

it('驱虎吞狼同意 runtime interaction 在 core 宿主清空后，仍会按当前 interaction data 重建', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'jinzhou', 'jin', 2, 2);
        core.selectedRegionId = 'jinzhou';
        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'drive-tiger' },
        }).state;

        const rebuilt = syncQidahenRuntimeInteractionState({
            ...state,
            core: {
                ...state.core,
                wheelDispatchProgress: null,
            },
        });

        const interactionData = getPromptData(rebuilt) as {
            sourceId?: string;
            qidahenDriveTigerConsentSelection?: QidahenDriveTigerConsentSelection;
        } | undefined;

        expect(interactionData?.sourceId).toBe('qidahen:drive-tiger-consent');
        expect(interactionData?.qidahenDriveTigerConsentSelection?.targetFactionId).toBe('jin');
        expect(interactionData?.qidahenDriveTigerConsentSelection?.dispatchSelection.sourceRegionId).toBe('jinzhou');
    });

it('驱虎吞狼同意 legacy host 字段单独残留时，不会再被当成正式等待态重开 interaction', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'jinzhou', 'jin', 2, 2);
        core.selectedRegionId = 'jinzhou';
        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'drive-tiger' },
        }).state;

        const legacySelection = getDriveTigerConsentSelection(state.core);
        expect(legacySelection?.targetFactionId).toBe('jin');

        const legacyCore: QidahenCore & {
            driveTigerConsentSelection?: QidahenDriveTigerConsentSelection | null;
        } = {
            ...state.core,
            turnPhase: 'action-window',
            selectedActionId: null,
            driveTigerConsentSelection: legacySelection,
            wheelDispatchProgress: null,
        };

        const rebuilt = syncQidahenRuntimeInteractionState({
            core: legacyCore,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        });

        expect(getQidahenDriveTigerConsentSelectionForCore(rebuilt.core)).toBeNull();
        expect(getPromptSummary(rebuilt).id).toBeUndefined();
    });

it('新年防线维护现在会正式挂到交互提示，并通过提示响应收口损耗优先级', () => {
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
                return { ...region, controller: 'ming', controlLabel: '大明' };
            }
            if (region.id === 'city-region-18' || region.id === 'city-region-29') {
                return { ...region, controller: 'neutral', controlLabel: '中立' };
            }
            if (region.id === 'song-jin') {
                return { ...region, troops: 3, population: 1 };
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

        expect(getPromptSourceId(state)).toBe('qidahen:fortification-maintenance');

        state = respondToPrompt(state, '0', {
            optionId: 'auto-pay',
            mergedValue: { attritionPriority: 'highest-level' },
        });

        expect(getPromptSummary(state).id).toBeUndefined();
        expect(state.core.currentYearIndex).toBe(1);
        expect(state.core.lastSeasonSummary?.title).toBe('新年结算');
    });

it('新年防线维护 resolver 现在可以直接吃 interaction 快照，而不是硬依赖 core.fortificationMaintenanceSelection 留在宿主上', () => {
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
                return { ...region, controller: 'ming', controlLabel: '大明' };
            }
            if (region.id === 'city-region-18' || region.id === 'city-region-29') {
                return { ...region, controller: 'neutral', controlLabel: '中立' };
            }
            if (region.id === 'song-jin') {
                return { ...region, troops: 3, population: 1 };
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

        const interactionData = getPromptData(state) as {
            sourceId?: string;
            qidahenFortificationMaintenanceSelection?: ReturnType<typeof getQidahenFortificationMaintenanceSelectionForCore>;
        } | undefined;
        expect(interactionData?.sourceId).toBe('qidahen:fortification-maintenance');
        expect(interactionData?.qidahenFortificationMaintenanceSelection?.title).toBe('新年防线维护');

        const resolved = resolveQidahenFortificationMaintenanceInteractionChoice(
            state.core,
            'auto-pay',
            100,
            'highest-level',
            interactionData?.qidahenFortificationMaintenanceSelection ?? null,
        );

        expect(resolved.currentYearIndex).toBe(1);
        expect(resolved.lastSeasonSummary?.title).toBe('新年结算');
    });

it('新年防线维护在 action-window 空壳态下不会误重开 interaction', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                handCount: 6,
            },
        };
        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        }).state;

        const rebuilt = syncQidahenRuntimeInteractionState({
            core: {
                ...state.core,
                turnPhase: 'action-window',
                selectedActionId: null,
            },
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        });

        expect(getQidahenFortificationMaintenanceSelectionForCore(rebuilt.core)).toBeNull();
        expect(getPromptSummary(rebuilt).id).toBeUndefined();
    });

it('王化贞内部调度现在会正式挂到交互提示，并通过提示响应收口', () => {
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
        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        }).state;

        expect(getPromptSourceId(state)).toBe('qidahen:internal-dispatch');
        const optionId = getPromptOptions(state).find((option) => option.id.includes('city-region-24'))?.id;
        expect(optionId).toBeTruthy();

        state = respondToPrompt(state, '0', { optionId });

        expect(getPromptSummary(state).id).toBeUndefined();
        expect('internalDispatchSelection' in state.core).toBe(false);
        expect(state.core.regions.find((region) => region.id === 'city-region-24')).toMatchObject({ troops: 3 });
    });

it('内部调度 resolver 现在可以直接吃 interaction 快照，而不是硬依赖 core.internalDispatchSelection 留在宿主上', () => {
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
        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        }).state;

        const interactionData = getPromptData(state) as {
            sourceId?: string;
            options?: Array<{ id: string }>;
            qidahenInternalDispatchSelection?: QidahenInternalDispatchSelection;
        } | undefined;
        const optionId = interactionData?.options?.find((option) => option.id.includes('city-region-24'))?.id;
        expect(interactionData?.sourceId).toBe('qidahen:internal-dispatch');
        expect(optionId).toBeTruthy();

        const resolved = resolveQidahenInternalDispatchInteractionChoice(
            state.core,
            optionId!,
            100,
            interactionData?.qidahenInternalDispatchSelection ?? null,
        );

        expect('internalDispatchSelection' in resolved).toBe(false);
        expect(resolved.explicitRegionId).toBeNull();
        expect(resolved.regionFocusState).toMatchObject({
            defaultFocusRegionId: 'city-region-24',
            lockedSourceRegionId: null,
            currentTargetRegionId: null,
            displayAnchorRegionId: 'city-region-24',
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({ troops: 3 });
    });

it('内部调度 runtime interaction 在 core.internalDispatchSelection 为空时，仍会按当前 interaction data 重建', () => {
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
        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        }).state;

        const rebuilt = syncQidahenRuntimeInteractionState({
            ...state,
            core: state.core,
        });

        const interactionData = getPromptData(rebuilt) as {
            sourceId?: string;
            options?: Array<{ id: string }>;
            qidahenInternalDispatchSelection?: QidahenInternalDispatchSelection;
        } | undefined;

        expect(interactionData?.sourceId).toBe('qidahen:internal-dispatch');
        expect(interactionData?.qidahenInternalDispatchSelection?.sourceRegionId).toBe('city-region-25');
        expect(interactionData?.options?.some((option) => option.id.includes('city-region-24'))).toBe(true);
    });

it('内部调度 legacy host 字段单独残留时，不会再被当成正式等待态重开 interaction', () => {
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
        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        }).state;

        const rebuilt = syncQidahenRuntimeInteractionState({
            ...state,
            core: {
                ...state.core,
                turnPhase: 'action-window',
                internalDispatchSelection: getInternalDispatchSelection(state.core),
            } as QidahenCore & { internalDispatchSelection: QidahenInternalDispatchSelection | null },
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        });

        expect(getPromptSummary(rebuilt).id).toBeUndefined();
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
            if (region.id === 'jinzhou') {
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
        expect(next.selectedRegionId).toBe('jinzhou');
        expect(next.actionChoices.map((choice) => choice.id)).toEqual([
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
});
