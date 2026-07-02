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
import { syncQidahenRuntimeInteractionState } from '../domain/runtimeInteractions';

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
