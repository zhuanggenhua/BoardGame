import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import type { MatchState } from '../../../engine/types';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import {
    createRespondToPromptCommand,
    getCurrentInteractionSummary,
    getPromptOption,
} from '../../../engine/testing/interactionTestFacade';
import {
    getQidahenDiplomacySelectionForCore,
    getQidahenDriveTigerConsentSelectionForCore,
    QidahenDomain,
} from '../domain';
import { QIDAHEN_COMMANDS } from '../domain/commands';
import { getActionChoicesForFaction } from '../domain/factionActionWindow';
import { getQidahenCurrentWheelDispatchSelectionForCore } from '../domain/dispatchSelectionBuilders';
import type { QidahenCore, QidahenEvent } from '../domain/types';
import { engineConfig } from '../game';
import {
    QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITIES,
    QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID,
} from '../domain/ordinaryHandCardIdentities';
import {
    clearQidahenRuntimeInteractionCurrent,
    syncQidahenRuntimeInteractionState,
} from '../domain/runtimeInteractions';

const commandsSource = readFileSync(resolve(__dirname, '..', 'domain', 'commands.ts'), 'utf-8');

const testRandom = {
    random: () => 0.5,
    d: () => 4,
    range: (min: number) => min,
    shuffle: <T>(array: T[]) => [...array],
};

function applyPipeline(
    state: MatchState<QidahenCore>,
    command: { type: string; playerId: string; payload: Record<string, unknown> },
    playerIds: string[] = ['0', '1', '2'],
) {
    return executePipeline(
        { domain: engineConfig.domain, systems: engineConfig.systems as any },
        state,
        command as any,
        testRandom,
        playerIds,
    );
}

function executeAndReduceCore(
    state: MatchState<QidahenCore>,
    command: { type: string; playerId: string; payload: Record<string, unknown> },
) {
    return QidahenDomain.execute(state, command as any, testRandom).reduce(
        (next, event) => QidahenDomain.reduce(next, event as QidahenEvent),
        state.core,
    );
}

describe('Qidahen Commands 交互宿主门禁', () => {
    it('非当前座位不能执行当前势力的一级动作、轮盘和普通地图选择', () => {
        const state: MatchState<QidahenCore> = {
            core: QidahenDomain.setup(['0', '1', '2'], () => 0.5),
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '1',
            payload: { regionId: 'jinzhou' },
        })).toEqual({ valid: false, error: 'notCurrentPlayer' });
        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'recruit' },
        })).toEqual({ valid: false, error: 'notCurrentPlayer' });
        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '1',
            payload: { moveId: 'move-1-free' },
        })).toEqual({ valid: false, error: 'notCurrentPlayer' });
    });

    it('commands validate 不再对已迁移等待态双读 core 历史宿主', () => {
        const forbiddenFallbacks = [
            'state.core.handLimitDiscardSelection',
            'state.core.pendingTargetAction',
            'state.core.postBattleSelection',
            'state.core.khanEdictSelection',
            'state.core.diplomacySelection',
            'state.core.diplomacyProgress',
            'state.core.maShiTradeSelection',
            'state.core.driveTigerConsentSelection',
            'state.core.recruitSelection',
            'state.core.fortificationMaintenanceSelection',
            'state.core.internalDispatchSelection',
        ];

        for (const fallback of forbiddenFallbacks) {
            expect(commandsSource).not.toContain(fallback);
        }

        expect(commandsSource).not.toContain("from './runtimeInteractions'");
        expect(commandsSource).toContain('const currentInteraction = state.sys.interaction?.current;');
        expect(commandsSource).toContain('getQidahenHandLimitDiscardSelectionForCore(state.core, currentInteraction)');
        expect(commandsSource).toContain('getQidahenInternalDispatchSelectionForCore(state.core, currentInteraction)');
        expect(commandsSource).toContain('getQidahenPendingTargetActionForCore(state.core, currentInteraction)');
        expect(commandsSource).toContain('getQidahenPostBattleSelectionForCore(state.core, currentInteraction)');
        expect(commandsSource).toContain('getQidahenKhanEdictSelectionForCore(state.core, currentInteraction)');
        expect(commandsSource).toContain('getQidahenDiplomacySelectionForCore(state.core, currentInteraction)');
        expect(commandsSource).toContain('getQidahenMaShiTradeSelectionForCore(state.core, currentInteraction)');
        expect(commandsSource).toContain('getQidahenDriveTigerConsentSelectionForCore(state.core, currentInteraction)');
        expect(commandsSource).toContain('getQidahenRecruitSelectionForCore(state.core, currentInteraction)');
        expect(commandsSource).toContain('getQidahenFortificationMaintenanceSelectionForCore(state.core, currentInteraction)');
    });

    it('征召军队命令校验现在可以只依赖 interaction current，而不是 core.recruitSelection', () => {
        let state: MatchState<QidahenCore> = {
            core: QidahenDomain.setup(['0', '1', '2'], () => 0.5),
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

        const validation = QidahenDomain.validate({
            ...state,
            core: {
                ...state.core,
                recruitSelection: null,
            },
        }, {
            type: QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE,
            playerId: '0',
            payload: { choiceId: 'level-2-troops' },
        });

        expect(validation).toEqual({ valid: true });

        const reduced = executeAndReduceCore({
            ...state,
            core: {
                ...state.core,
                recruitSelection: null,
            },
        }, {
            type: QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE,
            playerId: '0',
            payload: { choiceId: 'level-2-troops' },
        });

        expect(reduced.recruitSelection).toBeNull();
        expect(reduced.turnPhase).toBe('action-window');
        expect(reduced.regions.find((region) => region.id === 'song-jin')?.troops).toBeGreaterThan(4);
    });

    it('马市贸易命令校验现在可以只依赖 interaction current，而不是 core.maShiTradeSelection', () => {
        let state: MatchState<QidahenCore> = {
            core: {
                ...QidahenDomain.setup(['0', '1', '2'], () => 0.5),
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

        const validation = QidahenDomain.validate({
            ...state,
            core: {
                ...state.core,
                maShiTradeSelection: null,
            },
        }, {
            type: QIDAHEN_COMMANDS.RESOLVE_MA_SHI_TRADE_CHOICE,
            playerId: '1',
            payload: { troopCount: 3 },
        });

        expect(validation).toEqual({ valid: true });

        const reduced = executeAndReduceCore({
            ...state,
            core: {
                ...state.core,
                maShiTradeSelection: null,
            },
        }, {
            type: QIDAHEN_COMMANDS.RESOLVE_MA_SHI_TRADE_CHOICE,
            playerId: '1',
            payload: { troopCount: 3 },
        });

        expect(reduced.maShiTradeSelection).toBeNull();
        expect(reduced.turnPhase).toBe('action-window');
        expect(reduced.regions.find((region) => region.id === 'song-jin')).toMatchObject({ troops: 5 });
        expect(reduced.factions.mongol.handCount).toBe(11);
    });

    it('大汗令箭命令校验现在可以只依赖 interaction current，而不是 core.khanEdictSelection', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], () => 0.5);
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

        const validation = QidahenDomain.validate({
            ...state,
            core: {
                ...state.core,
                khanEdictSelection: null,
            },
        }, {
            type: QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE,
            playerId: '1',
            payload: { choiceId: 'hire-dispatch' },
        });

        expect(validation).toEqual({ valid: true });

        const reduced = executeAndReduceCore({
            ...state,
            core: {
                ...state.core,
                khanEdictSelection: null,
            },
        }, {
            type: QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE,
            playerId: '1',
            payload: { choiceId: 'hire-dispatch' },
        });

        expect(reduced.khanEdictSelection).toBeNull();
        expect(reduced.turnPhase).toBe('diplomacy-choice');
        expect(reduced.diplomacyProgress).toBeNull();
        expect(getQidahenDiplomacySelectionForCore(reduced)?.source).toBe('khan-edict');
    });

    it('驱虎吞狼同意命令校验现在可以只依赖 interaction current，而不是 core.driveTigerConsentSelection', () => {
        let state: MatchState<QidahenCore> = {
            core: QidahenDomain.setup(['0', '1', '2'], () => 0.5),
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };
        state.core.selectedRegionId = 'jinzhou';
        state.core.regions = state.core.regions.map((region) => {
            if (region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
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
            return region;
        });

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'drive-tiger' },
        }).state;

        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_DRIVE_TIGER_CONSENT,
            playerId: '0',
            payload: { choiceId: 'accept' },
        })).toEqual({ valid: false, error: 'notCurrentPlayer' });

        const validation = QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_DRIVE_TIGER_CONSENT,
            playerId: '2',
            payload: { choiceId: 'accept' },
        });

        expect(validation).toEqual({ valid: true });

        const reduced = executeAndReduceCore(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_DRIVE_TIGER_CONSENT,
            playerId: '2',
            payload: { choiceId: 'accept' },
        });

        expect(getQidahenDriveTigerConsentSelectionForCore(reduced)).toBeNull();
        expect(reduced.turnPhase).toBe('dispatch-targeting');
        expect(reduced.wheelDispatchProgress).toBeNull();
        const dispatchSelection = getQidahenCurrentWheelDispatchSelectionForCore(reduced);
        const firstTargetId = dispatchSelection?.candidates[0]?.targetRuntimeRegionId;
        expect(dispatchSelection?.attackerFactionId).toBe('jin');
        expect(firstTargetId).toBeTruthy();

        const targetingState = syncQidahenRuntimeInteractionState({
            ...state,
            core: reduced,
        });
        expect(getCurrentInteractionSummary(targetingState).playerId).toBe('0');
        expect(QidahenDomain.validate(targetingState, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '2',
            payload: { regionId: firstTargetId! },
        })).toEqual({ valid: false, error: 'notCurrentPlayer' });
        expect(QidahenDomain.validate(targetingState, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: firstTargetId! },
        })).toEqual({ valid: true });
    });

    it('待结算与战后命令校验现在可以只依赖 interaction current，而不是 core 历史字段', () => {
        let state: MatchState<QidahenCore> = {
            core: QidahenDomain.setup(['0', '1', '2'], () => 0.5),
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };
        state.core.selectedRegionId = 'city-region-24';
        state.core.regions = state.core.regions.map((region) => {
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    specialTroops: [
                        {
                            id: 'ming-city-region-24-cavalry-lv1',
                            label: '大明骑兵',
                            faction: 'ming',
                            troopKind: 'cavalry',
                            count: 2,
                            level: 1,
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

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        }).state;
        state = applyPipeline(state, createRespondToPromptCommand(state, {
            playerId: '0',
            optionId: 'city-region-20',
        })).state;

        expect(QidahenDomain.validate({
            ...state,
            core: {
                ...state.core,
                pendingTargetAction: null,
            },
        }, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '1',
            payload: {},
        })).toEqual({ valid: false, error: 'notCurrentPlayer' });

        const pendingValidation = QidahenDomain.validate({
            ...state,
            core: {
                ...state.core,
                pendingTargetAction: null,
            },
        }, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });
        expect(pendingValidation).toEqual({ valid: true });

        state = applyPipeline(state, createRespondToPromptCommand(state, {
            playerId: '0',
            optionId: 'rear-guard',
        })).state;

        expect(QidahenDomain.validate({
            ...state,
            core: {
                ...state.core,
                postBattleSelection: null,
            },
        }, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '1',
            payload: { choiceId: 'occupy' },
        })).toEqual({ valid: false, error: 'notCurrentPlayer' });

        const postBattleValidation = QidahenDomain.validate({
            ...state,
            core: {
                ...state.core,
                postBattleSelection: null,
            },
        }, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy' },
        });
        expect(postBattleValidation).toEqual({ valid: true });

        const postBattleState = executeAndReduceCore({
            ...state,
            core: {
                ...state.core,
                pendingTargetAction: null,
            },
        }, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(postBattleState.turnPhase).toBe('post-battle-decision');
        expect(postBattleState.pendingTargetAction).toBeNull();
        expect(postBattleState.postBattleSelection).not.toBeNull();

        const postBattleMatchState = syncQidahenRuntimeInteractionState({
            ...state,
            core: postBattleState,
        });
        const settled = executeAndReduceCore({
            ...postBattleMatchState,
            core: {
                ...postBattleMatchState.core,
                postBattleSelection: null,
            },
        }, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy' },
        });

        expect(settled.postBattleSelection).toBeNull();
        expect(settled.turnPhase).toBe('action-window');
    });

    it('战术牌命令只能在待结算战斗中由攻方打出自己的战术牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], () => 0.5);
        const tacticCardId = 'ming-tactic-test-card';
        const fieldOnlyTacticCardId = 'ming-field-only-tactic-test-card';
        const defenderOnlyTacticCardId = 'ming-defender-only-tactic-test-card';
        const mingJirinaiInfantryCardId = 'ming-jirinai-infantry-test-card';
        const jinBayaraCardId = 'jin-bayara-test-card';
        const jinJirinaiInfantryCardId = 'jin-jirinai-infantry-test-card';
        const jinSteadfastDefenseCardId = 'jin-steadfast-defense-test-card';
        const jinChevalDeFriseCardId = 'jin-cheval-de-frise-test-card';
        const jinTacticCardId = 'jin-tactic-test-card';
        const mingEventCardId = 'ming-event-test-card';
        const mingCards = core.handCards.filter((card) => card.faction === 'ming');
        const jinCard = core.handCards.find((card) => card.faction === 'jin');
        expect(mingCards.length).toBeGreaterThanOrEqual(2);
        expect(jinCard).toBeTruthy();

        core.turnPhase = 'resolve-pending';
        core.pendingTargetAction = {
            actionId: 'wheel-dispatch',
            battleMode: 'field',
            targetKind: 'region',
            title: '调度进攻待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '克什克腾部',
            targetRegionId: 'city-region-14',
            targetRegionName: '察哈尔',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试 · 战术牌',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 2,
            committedTroops: 2,
            movementProfileId: 'dispatch-cavalry',
            attackPressure: 2,
            attackBoundaryType: 'plain',
            resolutionHint: '克什克腾部 → 察哈尔 · 平原 3',
            defenderPayCost: null,
        };
        core.handCards = [
            {
                ...mingCards[0]!,
                id: tacticCardId,
                label: '大明战术牌',
                status: 'payable',
                cardKind: 'tactic',
                armamentId: null,
                cardDefId: 'test-ming-tactic',
                rulesSummary: '不能在攻城、守城时使用；战斗中我方步兵骰子等级 +1。',
            },
            {
                ...mingCards[1]!,
                id: fieldOnlyTacticCardId,
                label: '大明野战限定战术牌',
                status: 'payable',
                cardKind: 'tactic',
                armamentId: null,
                cardDefId: 'test-ming-field-only-tactic',
                rulesSummary: '只能于野战时使用；战斗中我方骑兵骰子等级 +1。',
            },
            {
                ...mingCards[2]!,
                id: defenderOnlyTacticCardId,
                label: '大明守城限定战术牌',
                status: 'payable',
                cardKind: 'tactic',
                armamentId: null,
                cardDefId: 'test-ming-defender-only-tactic',
                rulesSummary: '只能于守城时使用；对手本次攻城掷骰结果除以 2。',
            },
            {
                ...jinCard!,
                id: jinBayaraCardId,
                label: '后金巴雅喇',
                status: 'payable',
                cardKind: 'tactic',
                armamentId: null,
                cardDefId: 'qidahen-atlas05-1602-bayara',
                rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
                    'qidahen-atlas05-1602-bayara'
                ],
            },
            {
                ...jinCard!,
                id: jinJirinaiInfantryCardId,
                label: '后金机里耐步兵',
                status: 'payable',
                cardKind: 'tactic',
                armamentId: null,
                cardDefId: 'qidahen-atlas05-1640-jirinai-infantry',
                rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
                    'qidahen-atlas05-1640-jirinai-infantry'
                ],
            },
            {
                ...jinCard!,
                id: jinSteadfastDefenseCardId,
                label: '后金坚守不屈',
                status: 'payable',
                cardKind: 'tactic',
                armamentId: null,
                cardDefId: 'qidahen-atlas05-1635-steadfast-defense',
                rulesSummary: '只能于守城时使用；对手本次攻城掷骰结果除以 2。',
            },
            {
                ...jinCard!,
                id: jinChevalDeFriseCardId,
                label: '后金拒马',
                status: 'payable',
                cardKind: 'tactic',
                armamentId: null,
                cardDefId: 'qidahen-atlas05-1636-cheval-de-frise',
                rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
                    'qidahen-atlas05-1636-cheval-de-frise'
                ],
            },
            {
                ...jinCard!,
                id: jinTacticCardId,
                label: '后金战术牌',
                status: 'payable',
                cardKind: 'tactic',
                armamentId: null,
                cardDefId: 'test-jin-tactic',
            },
            {
                ...mingCards[3]!,
                id: mingJirinaiInfantryCardId,
                label: '大明机里耐步兵',
                status: 'payable',
                cardKind: 'tactic',
                armamentId: null,
                cardDefId: 'qidahen-atlas05-1640-jirinai-infantry',
                rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
                    'qidahen-atlas05-1640-jirinai-infantry'
                ],
            },
            {
                ...mingCards[3]!,
                id: mingEventCardId,
                label: '大明事件牌',
                status: 'payable',
                cardKind: 'event',
                armamentId: null,
                cardDefId: 'test-ming-event',
            },
        ];

        const state = syncQidahenRuntimeInteractionState({
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        });
        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '1',
            payload: { cardId: tacticCardId },
        })).toEqual({ valid: false, error: 'notCurrentPlayer' });
        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: jinTacticCardId },
        })).toEqual({ valid: false, error: 'unknownPaymentCard' });
        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: mingEventCardId },
        })).toEqual({ valid: false, error: 'unknownPaymentCard' });
        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: tacticCardId },
        })).toEqual({ valid: true });
        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: fieldOnlyTacticCardId },
        })).toEqual({ valid: true });
        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: defenderOnlyTacticCardId },
        })).toEqual({ valid: false, error: 'unknownPaymentCard' });
        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '2',
            payload: { cardId: jinBayaraCardId },
        })).toEqual({ valid: true });
        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '2',
            payload: { cardId: jinJirinaiInfantryCardId },
        })).toEqual({ valid: false, error: 'unknownPaymentCard' });
        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '2',
            payload: { cardId: jinChevalDeFriseCardId },
        })).toEqual({ valid: true });
        const mingDefenderFieldState = syncQidahenRuntimeInteractionState(clearQidahenRuntimeInteractionCurrent({
            ...state,
            core: {
                ...state.core,
                pendingTargetAction: {
                    ...state.core.pendingTargetAction!,
                    attackerFactionId: 'jin',
                    sourceRegionId: 'city-region-14',
                    sourceRegionName: '察哈尔',
                    targetRegionId: 'city-region-16',
                    targetRegionName: '克什克腾部',
                    targetRuntimeRegionId: 'city-region-16',
                    defenderFactionId: 'ming',
                    defenderLabel: '大明',
                },
            },
        }));
        expect(QidahenDomain.validate(mingDefenderFieldState, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: mingJirinaiInfantryCardId },
        })).toEqual({ valid: true });
        expect(QidahenDomain.validate(mingDefenderFieldState, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '2',
            payload: { cardId: jinJirinaiInfantryCardId },
        })).toEqual({ valid: true });
        const mongolDefenderFieldState = syncQidahenRuntimeInteractionState(clearQidahenRuntimeInteractionCurrent({
            ...state,
            core: {
                ...state.core,
                pendingTargetAction: {
                    ...state.core.pendingTargetAction!,
                    attackerFactionId: 'jin',
                    sourceRegionId: 'city-region-14',
                    sourceRegionName: '察哈尔',
                    targetRegionId: 'city-region-16',
                    targetRegionName: '克什克腾部',
                    targetRuntimeRegionId: 'city-region-16',
                    defenderFactionId: 'mongol',
                    defenderLabel: '蒙古',
                },
            },
        }));
        expect(QidahenDomain.validate(mongolDefenderFieldState, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '2',
            payload: { cardId: jinJirinaiInfantryCardId },
        })).toEqual({ valid: false, error: 'unknownPaymentCard' });
        const blockedJirinaiAttackResult = applyPipeline(mongolDefenderFieldState, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '2',
            payload: { cardId: jinJirinaiInfantryCardId },
        });
        expect(blockedJirinaiAttackResult.success).toBe(false);
        expect(blockedJirinaiAttackResult.state.core.handCards.some(
            (card) => card.id === jinJirinaiInfantryCardId,
        )).toBe(true);
        expect(blockedJirinaiAttackResult.state.core.discardPileCount).toBe(core.discardPileCount);
        const cityBattleState = syncQidahenRuntimeInteractionState(clearQidahenRuntimeInteractionCurrent({
            ...state,
            core: {
                ...state.core,
                pendingTargetAction: {
                    ...state.core.pendingTargetAction!,
                    battleMode: 'city',
                },
            },
        }));
        expect(QidahenDomain.validate(cityBattleState, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: tacticCardId },
        })).toEqual({ valid: false, error: 'unknownPaymentCard' });
        expect(QidahenDomain.validate(cityBattleState, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: fieldOnlyTacticCardId },
        })).toEqual({ valid: false, error: 'unknownPaymentCard' });
        expect(QidahenDomain.validate(cityBattleState, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: defenderOnlyTacticCardId },
        })).toEqual({ valid: false, error: 'unknownPaymentCard' });
        expect(QidahenDomain.validate(cityBattleState, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '2',
            payload: { cardId: jinSteadfastDefenseCardId },
        })).toEqual({ valid: true });
        expect(QidahenDomain.validate(cityBattleState, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '2',
            payload: { cardId: jinBayaraCardId },
        })).toEqual({ valid: true });
        expect(QidahenDomain.validate(cityBattleState, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '2',
            payload: { cardId: jinJirinaiInfantryCardId },
        })).toEqual({ valid: false, error: 'unknownPaymentCard' });
        expect(QidahenDomain.validate(cityBattleState, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '2',
            payload: { cardId: jinChevalDeFriseCardId },
        })).toEqual({ valid: false, error: 'unknownPaymentCard' });
        expect(QidahenDomain.validate(cityBattleState, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '2',
            payload: { cardId: jinTacticCardId },
        })).toEqual({ valid: false, error: 'unknownPaymentCard' });
        const defenderTacticResult = applyPipeline(cityBattleState, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '2',
            payload: { cardId: jinSteadfastDefenseCardId },
        });
        expect(defenderTacticResult.success).toBe(true);
        expect(defenderTacticResult.state.core.handCards.some((card) => card.id === jinSteadfastDefenseCardId)).toBe(false);
        expect(defenderTacticResult.state.core.discardPileCount).toBe(core.discardPileCount + 1);
        expect(defenderTacticResult.state.core.lastSeasonSummary?.lines.join(' ')).toContain('坚守不屈：本次城战中攻城方掷骰结果减半');
        expect(defenderTacticResult.state.core.pendingTargetAction?.tacticModifiers).toEqual(expect.arrayContaining([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1635-steadfast-defense',
                side: 'attacker',
                rollValueDivisor: 2,
            }),
        ]));
        const bayaraDefenseResult = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '2',
            payload: { cardId: jinBayaraCardId },
        });
        expect(bayaraDefenseResult.success).toBe(true);
        expect(bayaraDefenseResult.state.core.handCards.some((card) => card.id === jinBayaraCardId)).toBe(false);
        expect(bayaraDefenseResult.state.core.discardPileCount).toBe(core.discardPileCount + 1);
        expect(bayaraDefenseResult.state.core.lastSeasonSummary?.lines.join(' ')).toContain('巴雅喇：本次防守中己方步兵防御等级 +1');
        expect(bayaraDefenseResult.state.core.pendingTargetAction?.restriction).toContain('巴雅喇：防守方步兵防御等级 +1');
        expect(bayaraDefenseResult.state.core.pendingTargetAction?.resolutionHint).toContain('巴雅喇防守步兵+1');
        expect(bayaraDefenseResult.state.core.pendingTargetAction?.tacticModifiers).toEqual(expect.arrayContaining([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1602-bayara',
                label: '后金巴雅喇',
                side: 'defender',
                troopKind: 'infantry',
                levelBonus: 1,
            }),
        ]));
        const jirinaiDefenseResult = applyPipeline(mingDefenderFieldState, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: mingJirinaiInfantryCardId },
        });
        expect(jirinaiDefenseResult.success).toBe(true);
        expect(jirinaiDefenseResult.state.core.handCards.some((card) => card.id === mingJirinaiInfantryCardId)).toBe(false);
        expect(jirinaiDefenseResult.state.core.discardPileCount).toBe(core.discardPileCount + 1);
        expect(jirinaiDefenseResult.state.core.lastSeasonSummary?.lines.join(' ')).toContain('机里耐步兵：本次野战中防守明军步兵先结算');
        expect(jirinaiDefenseResult.state.core.pendingTargetAction?.restriction).toContain('机里耐步兵：防守明军步兵先结算');
        expect(jirinaiDefenseResult.state.core.pendingTargetAction?.resolutionHint).toContain('机里耐步兵防守明军先结算');
        expect(jirinaiDefenseResult.state.core.pendingTargetAction?.tacticModifiers).toEqual(expect.arrayContaining([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1640-jirinai-infantry',
                label: '大明机里耐步兵',
                side: 'defender',
                troopKind: 'infantry',
                levelBonus: 0,
                priorityRoll: true,
            }),
        ]));
        const chevalDeFriseResult = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '2',
            payload: { cardId: jinChevalDeFriseCardId },
        });
        expect(chevalDeFriseResult.success).toBe(true);
        expect(chevalDeFriseResult.state.core.handCards.some((card) => card.id === jinChevalDeFriseCardId)).toBe(false);
        expect(chevalDeFriseResult.state.core.discardPileCount).toBe(core.discardPileCount + 1);
        expect(chevalDeFriseResult.state.core.lastSeasonSummary?.lines.join(' ')).toContain('拒马：本次野战中取消先于本牌发动的对手箭如雨下');
        expect(chevalDeFriseResult.state.core.pendingTargetAction?.restriction).toContain('拒马：取消对手先结算/跨阶段修正');
        expect(chevalDeFriseResult.state.core.pendingTargetAction?.resolutionHint).toContain('拒马取消对手先结算/跨阶段');
        expect(chevalDeFriseResult.state.core.pendingTargetAction?.tacticModifiers).toEqual(expect.arrayContaining([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1636-cheval-de-frise',
                label: '后金拒马',
                side: 'defender',
                troopKind: 'infantry',
                playedAt: expect.any(Number),
                cancelEnemyTacticSourceCardDefIds: ['qidahen-atlas05-1615-arrows-like-rain'],
                cancelEnemyPrioritySourceCardDefIds: [
                    'qidahen-atlas05-1646-linked-muskets',
                ],
            }),
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1636-cheval-de-frise',
                label: '后金拒马',
                side: 'defender',
                troopKind: 'cavalry',
                playedAt: expect.any(Number),
                cancelEnemyTacticSourceCardDefIds: ['qidahen-atlas05-1615-arrows-like-rain'],
                cancelEnemyPrioritySourceCardDefIds: ['qidahen-atlas05-1639-cavalry-firearm'],
                cancelEnemyRollAsPhaseSourceCardDefIds: ['qidahen-atlas05-1639-cavalry-firearm'],
            }),
        ]));
        expect(QidahenDomain.validate({
            ...state,
            core: {
                ...state.core,
                pendingTargetAction: null,
            },
        }, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: tacticCardId },
        })).toEqual({ valid: true });

        const result = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: tacticCardId },
        });

        expect(result.success).toBe(true);
        expect(result.state.core.handCards.some((card) => card.id === tacticCardId)).toBe(false);
        expect(result.state.core.discardPileCount).toBe(core.discardPileCount + 1);
        expect(result.state.core.lastSeasonSummary?.title).toBe('战术牌');
        expect(result.state.core.lastSeasonSummary?.lines.join(' ')).toContain('打出战术牌');
        expect(result.state.core.lastSeasonSummary?.lines.join(' ')).toContain('战斗中我方步兵骰子等级 +1');
        expect(result.state.core.actionLog.at(-1)?.text).toContain('战斗中我方步兵骰子等级 +1');
    });

    it.each([
        ['策反/内应', 'qidahen-atlas05-1604-instigate-defection-insider'],
        ['策反', 'qidahen-atlas05-1611-instigate-defection'],
    ] as const)('%s在守方没有参战炮兵时不能打出且不消耗手牌', (label, cardDefId) => {
        const core = QidahenDomain.setup(['0', '1', '2'], () => 0.5);
        const mingCard = core.handCards.find((card) => card.faction === 'ming');
        expect(mingCard).toBeTruthy();
        const cardId = `test-${cardDefId}`;
        core.turnPhase = 'resolve-pending';
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            battleMode: 'field',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '克什克腾部',
            targetRegionId: 'city-region-14',
            targetRegionName: '察哈尔',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: `测试 · ${label}`,
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 2,
            committedTroops: 2,
            movementProfileId: 'dispatch-infantry',
            attackPressure: 2,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.handCards = [{
            ...mingCard!,
            id: cardId,
            label,
            status: 'payable',
            cardKind: 'tactic',
            armamentId: null,
            cardDefId,
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[cardDefId],
        }];
        core.regions = core.regions.map((region) => (
            !region.isLogicalRegion && region.id === 'city-region-14'
                ? {
                    ...region,
                    troops: 1,
                    specialTroops: [{
                        id: 'jin-infantry-only',
                        label: '后金步兵',
                        faction: 'jin',
                        troopKind: 'infantry',
                        count: 1,
                        level: 2,
                    }],
                }
                : region
        ));
        const state = syncQidahenRuntimeInteractionState({
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        });
        const discardPileCount = state.core.discardPileCount;

        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId },
        })).toEqual({ valid: false, error: 'unknownPaymentCard' });

        const result = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId },
        });
        expect(result.success).toBe(false);
        expect(result.state.core.handCards.some((card) => card.id === cardId)).toBe(true);
        expect(result.state.core.discardPileCount).toBe(discardPileCount);
    });

    it('箭如雨下在攻方没有参战步兵时不能打出且不消耗手牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], () => 0.5);
        const mingCard = core.handCards.find((card) => card.faction === 'ming');
        expect(mingCard).toBeTruthy();
        const cardId = 'test-arrows-like-rain-without-infantry';
        core.turnPhase = 'resolve-pending';
        core.pendingTargetAction = {
            actionId: 'wheel-dispatch',
            title: '调骑进攻待结算',
            attackerFactionId: 'ming',
            battleMode: 'field',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '克什克腾部',
            targetRegionId: 'city-region-14',
            targetRegionName: '察哈尔',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试 · 箭如雨下',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 2,
            committedTroops: 2,
            movementProfileId: 'dispatch-cavalry',
            attackPressure: 2,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.handCards = [{
            ...mingCard!,
            id: cardId,
            label: '箭如雨下',
            status: 'payable',
            cardKind: 'tactic',
            armamentId: null,
            cardDefId: 'qidahen-atlas05-1615-arrows-like-rain',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
                'qidahen-atlas05-1615-arrows-like-rain'
            ],
        }];
        core.regions = core.regions.map((region) => (
            !region.isLogicalRegion && region.id === 'city-region-16'
                ? {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    specialTroops: [{
                        id: 'ming-cavalry-only',
                        label: '大明骑兵',
                        faction: 'ming',
                        troopKind: 'cavalry',
                        count: 2,
                        level: 2,
                    }],
                }
                : region
        ));
        const state = syncQidahenRuntimeInteractionState({
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        });
        const discardPileCount = state.core.discardPileCount;

        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId },
        })).toEqual({ valid: false, error: 'unknownPaymentCard' });

        const result = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId },
        });
        expect(result.success).toBe(false);
        expect(result.state.core.handCards.some((card) => card.id === cardId)).toBe(true);
        expect(result.state.core.discardPileCount).toBe(discardPileCount);
    });

    it('atlas05 战术牌时机门禁会按当前攻方战术窗口拦截城战禁用和守城专用牌', () => {
        const tacticIdentities = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITIES
            .filter((identity) => identity.cardKind === 'tactic');
        expect(tacticIdentities).toHaveLength(19);
        const baseCore = QidahenDomain.setup(['0', '1', '2'], () => 0.5);
        const baseMingCard = baseCore.handCards.find((card) => card.faction === 'ming');
        expect(baseMingCard).toBeTruthy();
        const tacticCards = tacticIdentities.map((identity) => ({
            ...baseMingCard!,
            id: `atlas05-tactic-${identity.atlasIndex}`,
            label: identity.displayName,
            status: 'payable' as const,
            cardKind: 'tactic' as const,
            armamentId: null,
            cardDefId: identity.cardDefId,
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[identity.cardDefId],
        }));
        const buildBattleState = (battleMode: 'field' | 'city'): MatchState<QidahenCore> => {
            const core = {
                ...QidahenDomain.setup(['0', '1', '2'], () => 0.5),
                turnPhase: 'resolve-pending' as const,
                handCards: tacticCards,
                pendingTargetAction: {
                    actionId: 'wheel-dispatch' as const,
                    battleMode,
                    targetKind: 'region' as const,
                    title: '调度进攻待结算',
                    attackerFactionId: 'ming' as const,
                    sourceRegionId: 'city-region-16',
                    sourceRegionName: '克什克腾部',
                    targetRegionId: 'city-region-14',
                    targetRegionName: '察哈尔',
                    targetRuntimeRegionId: 'city-region-14',
                    defenderFactionId: 'jin' as const,
                    defenderLabel: '后金',
                    restriction: '测试 · atlas05 战术牌',
                    battleWidth: 3,
                    boundaryUnitCap: null,
                    sourceAvailableTroops: 2,
                    committedTroops: 2,
                    movementProfileId: 'dispatch-cavalry',
                    attackPressure: 2,
                    attackBoundaryType: 'plain',
                    resolutionHint: '克什克腾部 → 察哈尔 · 平原 3',
                    defenderPayCost: null,
                },
            };
            return syncQidahenRuntimeInteractionState({
                core,
                sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
            });
        };
        const validateTactic = (state: MatchState<QidahenCore>, cardDefId: string) => {
            const card = tacticCards.find((candidate) => candidate.cardDefId === cardDefId);
            expect(card).toBeTruthy();
            return QidahenDomain.validate(state, {
                type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
                playerId: '0',
                payload: { cardId: card!.id },
            });
        };
        const isCityBlockedSummary = (rulesSummary: string): boolean => (
            rulesSummary.includes('不能在攻城、守城时使用')
            || rulesSummary.includes('只能于野战时使用')
            || rulesSummary.includes('野战时才能使用')
            || rulesSummary.includes('野战步兵阶段使用')
            || rulesSummary.includes('野战骑兵阶段')
        );
        const defenderOnlyIdentities = tacticIdentities.filter((identity) => (
            QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[identity.cardDefId].includes('只能于守城时使用')
        ));
        expect(defenderOnlyIdentities.map((identity) => identity.displayName)).toEqual(['坚守不屈']);
        const triggerOnlyIdentities = tacticIdentities.filter((identity) => {
            const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[identity.cardDefId];
            return rulesSummary.includes('敌人增援时')
                || rulesSummary.includes('取消对手宣告的骑兵劫掠')
                || rulesSummary.includes('扎营过程中');
        });
        expect(triggerOnlyIdentities.map((identity) => identity.displayName)).toEqual(['打草惊蛇', '偷袭与伏击', '诈败诱敌']);
        const raidGrainIdentity = triggerOnlyIdentities.find((identity) => identity.displayName === '打草惊蛇');
        expect(raidGrainIdentity).toBeTruthy();
        const blockedTriggerOnlyIdentities = triggerOnlyIdentities.filter((identity) => identity !== raidGrainIdentity);
        const stateDependentBattleChainIdentities = tacticIdentities.filter((identity) => {
            const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[identity.cardDefId];
            return rulesSummary.includes('附兵部队视为步兵部队')
                || rulesSummary.includes('我方骑兵在步兵攻击阶段可撤离')
                || rulesSummary.includes('再移动最多 2 个没有参战的部队进入战斗')
                || rulesSummary.includes('敌方次级部队参战时使用')
                || rulesSummary.includes('提前在炮兵阶段');
        });
        expect(stateDependentBattleChainIdentities.map((identity) => identity.cardDefId)).toEqual([
            'qidahen-atlas05-1620-mounted-infantry',
            'qidahen-atlas05-1628-infantry-cavalry-combined',
            'qidahen-atlas05-1629-instigate-defection-alt',
            'qidahen-atlas05-1632-pincer-advance',
            'qidahen-atlas05-1650-wuzhen-chaoha-special',
        ]);
        const mountedInfantryIdentity = stateDependentBattleChainIdentities.find((
            identity,
        ) => identity.cardDefId === 'qidahen-atlas05-1620-mounted-infantry');
        expect(mountedInfantryIdentity?.displayName).toBe('骑马步兵');
        const blockedStateDependentBattleChainIdentities = stateDependentBattleChainIdentities.filter((
            identity,
        ) => identity.cardDefId !== 'qidahen-atlas05-1620-mounted-infantry');
        const phaseOnlyIdentities = tacticIdentities.filter((identity) => {
            const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[identity.cardDefId];
            return rulesSummary.includes('野战步兵阶段使用')
                || rulesSummary.includes('野战骑兵阶段使用')
                || rulesSummary.includes('提前在炮兵阶段');
        });
        expect(phaseOnlyIdentities.map((identity) => identity.displayName)).toEqual(['箭如雨下', '乌真超哈']);
        const unimplementedPhaseOnlyIdentities = phaseOnlyIdentities.filter((identity) => {
            const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[identity.cardDefId];
            return rulesSummary.includes('野战骑兵阶段使用');
        });
        expect(unimplementedPhaseOnlyIdentities.map((identity) => identity.displayName)).toEqual([]);
        const cityBlockedIdentities = tacticIdentities.filter((identity) => {
            const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[identity.cardDefId];
            return isCityBlockedSummary(rulesSummary)
                || rulesSummary.includes('只能于守城时使用')
                || rulesSummary.includes('敌人增援时')
                || rulesSummary.includes('取消对手宣告的骑兵劫掠')
                || rulesSummary.includes('扎营过程中')
                || rulesSummary.includes('附兵部队视为步兵部队')
                || rulesSummary.includes('再移动最多 2 个没有参战的部队进入战斗')
                || rulesSummary.includes('敌方次级部队参战时使用')
                || rulesSummary.includes('野战步兵阶段使用')
                || rulesSummary.includes('野战骑兵阶段使用')
                || rulesSummary.includes('提前在炮兵阶段');
        });
        expect(cityBlockedIdentities.map((identity) => identity.displayName)).toEqual(expect.arrayContaining([
            '箭如雨下',
            '打草惊蛇',
            '偷袭与伏击',
            '策反',
            '骑兵冲锋',
            '步骑联合',
            '分进合击',
            '坚守不屈',
            '拒马',
            '链炮阵',
            '鸟真超哈',
            '诈败诱敌',
        ]));
        const fieldState = buildBattleState('field');
        const cityState = buildBattleState('city');
        for (const identity of defenderOnlyIdentities) {
            expect(validateTactic(fieldState, identity.cardDefId)).toEqual({ valid: false, error: 'unknownPaymentCard' });
            expect(validateTactic(cityState, identity.cardDefId)).toEqual({ valid: false, error: 'unknownPaymentCard' });
        }
        for (const identity of blockedTriggerOnlyIdentities) {
            expect(validateTactic(fieldState, identity.cardDefId)).toEqual({ valid: false, error: 'unknownPaymentCard' });
            expect(validateTactic(cityState, identity.cardDefId)).toEqual({ valid: false, error: 'unknownPaymentCard' });
        }
        expect(validateTactic(fieldState, mountedInfantryIdentity!.cardDefId)).toEqual({ valid: true });
        expect(validateTactic(cityState, mountedInfantryIdentity!.cardDefId)).toEqual({ valid: true });
        for (const identity of blockedStateDependentBattleChainIdentities) {
            expect(validateTactic(fieldState, identity.cardDefId)).toEqual({ valid: false, error: 'unknownPaymentCard' });
            expect(validateTactic(cityState, identity.cardDefId)).toEqual({ valid: false, error: 'unknownPaymentCard' });
        }
        for (const identity of unimplementedPhaseOnlyIdentities) {
            expect(validateTactic(fieldState, identity.cardDefId)).toEqual({ valid: false, error: 'unknownPaymentCard' });
            expect(validateTactic(cityState, identity.cardDefId)).toEqual({ valid: false, error: 'unknownPaymentCard' });
        }
        for (const identity of cityBlockedIdentities.filter((identity) => (
            !defenderOnlyIdentities.includes(identity)
            && !triggerOnlyIdentities.includes(identity)
            && !stateDependentBattleChainIdentities.includes(identity)
            && !unimplementedPhaseOnlyIdentities.includes(identity)
        ))) {
            expect({
                card: `${identity.displayName}（${identity.cardDefId}）`,
                validation: validateTactic(fieldState, identity.cardDefId),
            }).toEqual({
                card: `${identity.displayName}（${identity.cardDefId}）`,
                validation: { valid: true },
            });
            expect(validateTactic(cityState, identity.cardDefId)).toEqual({ valid: false, error: 'unknownPaymentCard' });
        }

        const arrowsCard = tacticCards.find((card) => card.cardDefId === 'qidahen-atlas05-1615-arrows-like-rain');
        expect(arrowsCard).toBeTruthy();
        const arrowsResult = applyPipeline(fieldState, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: arrowsCard!.id },
        });

        expect(arrowsResult.success).toBe(true);
        expect(arrowsResult.state.core.handCards.some((card) => card.id === arrowsCard!.id)).toBe(false);
        expect(arrowsResult.state.core.pendingTargetAction?.tacticModifiers).toEqual(expect.arrayContaining([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1615-arrows-like-rain',
                label: '箭如雨下',
                side: 'attacker',
                troopKind: 'infantry',
                playedAt: expect.any(Number),
                priorityRoll: true,
                cancelEnemyTacticSourceCardDefIds: ['qidahen-atlas05-1636-cheval-de-frise'],
            }),
        ]));
        expect(arrowsResult.state.core.pendingTargetAction?.restriction).toContain('箭如雨下：攻方步兵先结算');
        expect(arrowsResult.state.core.lastSeasonSummary?.lines.join(' ')).toContain('箭如雨下：本次野战中攻方步兵先结算');

        const raidGrainState = buildBattleState('field');
        raidGrainState.core.regions = raidGrainState.core.regions.map((region) => {
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
                    specialTroops: [],
                };
            }
            return region;
        });
        if (raidGrainState.core.pendingTargetAction) {
            raidGrainState.core.pendingTargetAction = {
                ...raidGrainState.core.pendingTargetAction,
                committedTroops: 3,
                sourceAvailableTroops: 3,
                attackPressure: 3,
                movementProfileId: 'dispatch-cavalry',
            };
        }
        const raidGrainCard = tacticCards.find((card) => card.cardDefId === 'qidahen-atlas05-1612-raid-grain');
        expect(raidGrainCard).toBeTruthy();
        const blockedRaidGrainState = buildBattleState('field');
        if (blockedRaidGrainState.core.pendingTargetAction) {
            blockedRaidGrainState.core.pendingTargetAction = {
                ...blockedRaidGrainState.core.pendingTargetAction,
                movementProfileId: 'dispatch-infantry',
            };
        }
        expect(validateTactic(
            syncQidahenRuntimeInteractionState(clearQidahenRuntimeInteractionCurrent(blockedRaidGrainState)),
            raidGrainCard!.cardDefId!,
        )).toEqual({ valid: false, error: 'unknownPaymentCard' });
        const blockedRaidGrainResult = applyPipeline(
            syncQidahenRuntimeInteractionState(clearQidahenRuntimeInteractionCurrent(blockedRaidGrainState)),
            {
                type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
                playerId: '0',
                payload: { cardId: raidGrainCard!.id },
            },
        );
        expect(blockedRaidGrainResult.success).toBe(false);
        expect(blockedRaidGrainResult.state.core.handCards.some((card) => card.id === raidGrainCard!.id)).toBe(true);
        const raidGrainResult = applyPipeline(raidGrainState, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: raidGrainCard!.id },
        });

        expect(raidGrainResult.success).toBe(true);
        expect(raidGrainResult.state.core.handCards.some((card) => card.id === raidGrainCard!.id)).toBe(false);
        expect(raidGrainResult.state.core.pendingTargetAction?.tacticModifiers).toEqual(expect.arrayContaining([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1612-raid-grain',
                label: '打草惊蛇',
                side: 'attacker',
                troopKind: 'cavalry',
                cavalryPlunderCounterDamageDisabled: true,
            }),
        ]));
        expect(raidGrainResult.state.core.pendingTargetAction?.restriction).toContain('打草惊蛇：骑兵劫掠不受反击伤害');
        expect(raidGrainResult.state.core.lastSeasonSummary?.lines.join(' ')).toContain('打草惊蛇：本次骑兵劫掠中劫掠部队不受守方反击伤害。');
    });

    it('偷袭与伏击不能从普通攻方战术窗口被当作已打出战术消耗', () => {
        const baseCore = QidahenDomain.setup(['0', '1', '2'], () => 0.5);
        const baseMingCard = baseCore.handCards.find((card) => card.faction === 'ming');
        expect(baseMingCard).toBeTruthy();
        const raidAndAmbushCard = {
            ...baseMingCard!,
            id: 'atlas05-tactic-raid-and-ambush',
            label: '偷袭与伏击',
            status: 'payable' as const,
            cardKind: 'tactic' as const,
            armamentId: null,
            cardDefId: 'qidahen-atlas05-1622-raid-and-ambush',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
                'qidahen-atlas05-1622-raid-and-ambush'
            ],
        };
        const state = syncQidahenRuntimeInteractionState({
            core: {
                ...baseCore,
                turnPhase: 'resolve-pending' as const,
                handCards: [raidAndAmbushCard],
                pendingTargetAction: {
                    actionId: 'wheel-dispatch' as const,
                    battleMode: 'field' as const,
                    targetKind: 'region' as const,
                    title: '调度进攻待结算',
                    attackerFactionId: 'ming' as const,
                    sourceRegionId: 'city-region-16',
                    sourceRegionName: '克什克腾部',
                    targetRegionId: 'city-region-14',
                    targetRegionName: '察哈尔',
                    targetRuntimeRegionId: 'city-region-14',
                    defenderFactionId: 'jin' as const,
                    defenderLabel: '后金',
                    restriction: '测试 · 偷袭与伏击敌人增援触发窗口未开放',
                    battleWidth: 3,
                    boundaryUnitCap: null,
                    sourceAvailableTroops: 2,
                    committedTroops: 2,
                    movementProfileId: 'dispatch-infantry',
                    attackPressure: 2,
                    attackBoundaryType: 'plain',
                    resolutionHint: '克什克腾部 → 察哈尔 · 平原 3',
                    defenderPayCost: null,
                },
            },
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        });

        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: raidAndAmbushCard.id },
        })).toEqual({ valid: false, error: 'unknownPaymentCard' });

        const result = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: raidAndAmbushCard.id },
        });

        expect(result.success).toBe(false);
        expect(result.state.core.handCards.some((card) => card.id === raidAndAmbushCard.id)).toBe(true);
        expect(result.state.core.discardPileCount).toBe(baseCore.discardPileCount);
        expect(result.state.core.pendingTargetAction?.tacticModifiers ?? []).not.toEqual(expect.arrayContaining([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1622-raid-and-ambush',
            }),
        ]));
    });

    it('诈败诱敌不能从普通攻方战术窗口被当作已打出战术消耗', () => {
        const baseCore = QidahenDomain.setup(['0', '1', '2'], () => 0.5);
        const baseMingCard = baseCore.handCards.find((card) => card.faction === 'ming');
        expect(baseMingCard).toBeTruthy();
        const feignedRetreatCard = {
            ...baseMingCard!,
            id: 'atlas05-tactic-feigned-retreat-lure-enemy',
            label: '诈败诱敌',
            status: 'payable' as const,
            cardKind: 'tactic' as const,
            armamentId: null,
            cardDefId: 'qidahen-atlas05-1660-feigned-retreat-lure-enemy',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
                'qidahen-atlas05-1660-feigned-retreat-lure-enemy'
            ],
        };
        const state = syncQidahenRuntimeInteractionState({
            core: {
                ...baseCore,
                turnPhase: 'resolve-pending' as const,
                handCards: [feignedRetreatCard],
                pendingTargetAction: {
                    actionId: 'wheel-dispatch' as const,
                    battleMode: 'field' as const,
                    targetKind: 'region' as const,
                    title: '调度进攻待结算',
                    attackerFactionId: 'ming' as const,
                    sourceRegionId: 'city-region-16',
                    sourceRegionName: '克什克腾部',
                    targetRegionId: 'city-region-14',
                    targetRegionName: '察哈尔',
                    targetRuntimeRegionId: 'city-region-14',
                    defenderFactionId: 'jin' as const,
                    defenderLabel: '后金',
                    restriction: '测试 · 诈败诱敌触发窗口未开放',
                    battleWidth: 3,
                    boundaryUnitCap: null,
                    sourceAvailableTroops: 2,
                    committedTroops: 2,
                    movementProfileId: 'dispatch-cavalry',
                    attackPressure: 2,
                    attackBoundaryType: 'plain',
                    resolutionHint: '克什克腾部 → 察哈尔 · 平原 3',
                    defenderPayCost: null,
                },
            },
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        });

        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: feignedRetreatCard.id },
        })).toEqual({ valid: false, error: 'unknownPaymentCard' });

        const result = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: feignedRetreatCard.id },
        });

        expect(result.success).toBe(false);
        expect(result.state.core.handCards.some((card) => card.id === feignedRetreatCard.id)).toBe(true);
        expect(result.state.core.discardPileCount).toBe(baseCore.discardPileCount);
        expect(result.state.core.pendingTargetAction?.tacticModifiers ?? []).not.toEqual(expect.arrayContaining([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1660-feigned-retreat-lure-enemy',
            }),
        ]));
    });

    it('次级部队版策反不能从普通攻方战术窗口被当作已打出战术消耗', () => {
        const baseCore = QidahenDomain.setup(['0', '1', '2'], () => 0.5);
        const baseMingCard = baseCore.handCards.find((card) => card.faction === 'ming');
        expect(baseMingCard).toBeTruthy();
        const instigateDefectionAltCard = {
            ...baseMingCard!,
            id: 'atlas05-tactic-instigate-defection-alt',
            label: '策反',
            status: 'payable' as const,
            cardKind: 'tactic' as const,
            armamentId: null,
            cardDefId: 'qidahen-atlas05-1629-instigate-defection-alt',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
                'qidahen-atlas05-1629-instigate-defection-alt'
            ],
        };
        const state = syncQidahenRuntimeInteractionState({
            core: {
                ...baseCore,
                turnPhase: 'resolve-pending' as const,
                handCards: [instigateDefectionAltCard],
                pendingTargetAction: {
                    actionId: 'wheel-dispatch' as const,
                    battleMode: 'field' as const,
                    targetKind: 'region' as const,
                    title: '调度进攻待结算',
                    attackerFactionId: 'ming' as const,
                    sourceRegionId: 'city-region-16',
                    sourceRegionName: '克什克腾部',
                    targetRegionId: 'city-region-14',
                    targetRegionName: '察哈尔',
                    targetRuntimeRegionId: 'city-region-14',
                    defenderFactionId: 'jin' as const,
                    defenderLabel: '后金',
                    restriction: '测试 · 次级部队版策反触发窗口未开放',
                    battleWidth: 3,
                    boundaryUnitCap: null,
                    sourceAvailableTroops: 2,
                    committedTroops: 2,
                    movementProfileId: 'dispatch-infantry',
                    attackPressure: 2,
                    attackBoundaryType: 'plain',
                    resolutionHint: '克什克腾部 → 察哈尔 · 平原 3',
                    defenderPayCost: null,
                },
            },
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        });

        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: instigateDefectionAltCard.id },
        })).toEqual({ valid: false, error: 'unknownPaymentCard' });

        const result = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: instigateDefectionAltCard.id },
        });

        expect(result.success).toBe(false);
        expect(result.state.core.handCards.some((card) => card.id === instigateDefectionAltCard.id)).toBe(true);
        expect(result.state.core.discardPileCount).toBe(baseCore.discardPileCount);
        expect(result.state.core.pendingTargetAction?.tacticModifiers ?? []).not.toEqual(expect.arrayContaining([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1629-instigate-defection-alt',
            }),
        ]));
    });

    it('新年维护命令校验现在可以只依赖 interaction current，而不是 core.fortificationMaintenanceSelection', () => {
        let state: MatchState<QidahenCore> = {
            core: QidahenDomain.setup(['0', '1', '2'], () => 0.5),
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };
        state.core.actionWheelPosition = 'wheel-midyear';
        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        }).state;
        const validation = QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        expect(validation).toEqual({ valid: true });

        const reduced = executeAndReduceCore(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        expect(reduced.currentYearIndex).toBeGreaterThan(state.core.currentYearIndex);
        expect(reduced.turnPhase).not.toBe('season-resolution');
    });

    it('新年防线维护即使由非大明轮盘触发，也只能由大明座位处理', () => {
        let state: MatchState<QidahenCore> = {
            core: {
                ...QidahenDomain.setup(['0', '1', '2'], () => 0.5),
                actionWheelPosition: 'wheel-midyear',
                playerIds: ['2', '1', '0'],
                currentPlayer: '2',
            },
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '2',
            payload: { moveId: 'move-1-free' },
        }).state;

        expect(getCurrentInteractionSummary(state).playerId).toBe('0');
        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '2',
            payload: { choiceId: 'skip-all' },
        })).toEqual({ valid: false, error: 'notCurrentPlayer' });
        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        })).toEqual({ valid: true });
    });

    it('王化贞内部调度命令校验现在可以只依赖 interaction current，而不是 core.internalDispatchSelection', () => {
        let state: MatchState<QidahenCore> = {
            core: QidahenDomain.setup(['0', '1', '2'], () => 0.5),
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        };
        state.core.currentPlayer = '0';
        state.core.selectedRegionId = 'city-region-25';
        state.core.factions = {
            ...state.core.factions,
            ming: {
                ...state.core.factions.ming,
                characters: state.core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-wang-huazhen',
                })),
            },
        };
        state.core.regions = state.core.regions.map((region) => {
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
                        {
                            id: 'ming-shanhaiguan-artillery-lv2',
                            label: '大明炮兵',
                            faction: 'ming',
                            troopKind: 'artillery',
                            count: 1,
                            level: 2,
                        },
                        {
                            id: 'ming-shanhaiguan-infantry-lv1',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 2,
                            level: 1,
                        },
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

        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        }).state;

        const choiceId = getPromptOption(
            state,
            (option) => option.id.includes('city-region-24'),
            '王化贞内部调度目标',
        ).id;
        expect(choiceId).toBeTruthy();

        const validation = QidahenDomain.validate({
            ...state,
            core: state.core,
        }, {
            type: QIDAHEN_COMMANDS.RESOLVE_INTERNAL_DISPATCH,
            playerId: '0',
            payload: { choiceId: choiceId! },
        });

        expect(validation).toEqual({ valid: true });

        const reduced = executeAndReduceCore({
            ...state,
            core: state.core,
        }, {
            type: QIDAHEN_COMMANDS.RESOLVE_INTERNAL_DISPATCH,
            playerId: '0',
            payload: { choiceId: choiceId! },
        });

        expect('internalDispatchSelection' in reduced).toBe(false);
        expect(reduced.turnPhase).toBe('action-window');
        expect(reduced.regions.find((region) => region.id === 'city-region-24')).toMatchObject({ troops: 3 });
    });
});
