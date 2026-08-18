import { describe, expect, it } from 'vitest';
import { executePipeline } from '../../../engine/pipeline';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import { resolveForceAdvancePhaseAfterRecovery } from '../../../engine/transport/onlineAiRecovery';
import type { MatchState } from '../../../engine/types';
import {
    injectRawBlockingInteraction,
    injectSimpleChoiceBlockingInteraction,
} from '../../../engine/testing/interactionTestFacade';

import { DiceThroneDomain } from '../domain';
import { buildDiceThroneAiLegalActions } from '../ai';
import { engineConfig } from '../game';
import { canAdvancePhase, checkPlayCard } from '../domain/rules';
import { RESOURCE_IDS } from '../domain/resources';
import type { DiceThroneCommand, DiceThroneCore } from '../domain/types';
import { cmd, createHeroMatchup, createQueuedRandom, createRunner, createSetupWithHand, fixedRandom, getCardById, testSystems } from './test-utils';

describe('DiceThrone AI 主阶段候选门禁', () => {
    const dispatch = (
        state: MatchState<DiceThroneCore>,
        type: string,
        payload: Record<string, unknown> = {},
        random = fixedRandom,
    ): MatchState<DiceThroneCore> => {
        const result = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            { type, playerId: '0', payload, timestamp: 0 } as DiceThroneCommand,
            random,
            ['0', '1'],
        );
        expect(result.success).toBe(true);
        return result.state as MatchState<DiceThroneCore>;
    };

    it('非当前回合玩家不应生成主阶段出牌或卖牌候选', () => {
        const state = createSetupWithHand(
            ['card-palm-strike', 'card-thrust-punch-2'],
            { playerId: '1', cp: 5 },
        )(['0', '1'], fixedRandom);

        state.core.activePlayerId = '0';
        state.sys.phase = 'main1';

        const actions = buildDiceThroneAiLegalActions({
            playerId: '1',
            state,
        });

        expect(actions.some((action) => action.kind === 'play-card')).toBe(false);
        expect(actions.some((action) => action.kind === 'play-upgrade-card')).toBe(false);
        expect(actions.some((action) => action.kind === 'sell-card')).toBe(false);
        expect(actions.some((action) => action.kind === 'advance-phase')).toBe(false);
    });

    it('当前有其他玩家交互时不应生成主阶段候选', () => {
        const state = createSetupWithHand(
            ['card-palm-strike', 'card-thrust-punch-2'],
            { playerId: '0', cp: 5 },
        )(['0', '1'], fixedRandom);

        state.core.activePlayerId = '0';
        state.sys.phase = 'main1';
        injectSimpleChoiceBlockingInteraction(state, {
            id: 'dt-other-player-choice',
            playerId: '1',
            sourceId: 'other-player-choice',
        });

        const actions = buildDiceThroneAiLegalActions({
            playerId: '0',
            state,
        });

        expect(actions).toEqual([]);
    });

    it('奖励骰结算遇到响应窗口时，应先响应窗口，不得提前生成奖励骰确认', () => {
        const state = createSetupWithHand([], {
            playerId: '1',
            cp: 5,
            mutate: (core) => {
                core.activePlayerId = '1';
                core.pendingBonusDiceSettlement = {
                    id: 'bonus-with-response-window',
                    sourceAbilityId: 'card-one-throw-fortune',
                    attackerId: '1',
                    targetId: '1',
                    dice: [{ index: 0, value: 3, face: 'katana' }],
                    rerollCostTokenId: '',
                    rerollCostAmount: 0,
                    rerollCount: 0,
                    maxRerollCount: 0,
                    readyToSettle: false,
                    displayOnly: true,
                };
            },
        })(['0', '1'], fixedRandom);
        state.sys.phase = 'main1';
        state.sys.responseWindow = {
            current: {
                id: 'bonus-response-window',
                windowType: 'afterRollConfirmed',
                responderQueue: ['1'],
                currentResponderIndex: 0,
                passedPlayers: [],
            },
        };

        const actions = buildDiceThroneAiLegalActions({
            playerId: '1',
            state,
        });

        expect(actions.some((action) => action.kind === 'response-pass')).toBe(true);
        expect(actions.some((action) => action.kind === 'skip-bonus-dice-reroll')).toBe(false);
    });

    it('未知阻塞交互属于 AI 时应紧急取消而不是继续走主阶段', () => {
        const state = createSetupWithHand(
            ['card-palm-strike', 'card-thrust-punch-2'],
            { playerId: '0', cp: 5 },
        )(['0', '1'], fixedRandom);

        state.core.activePlayerId = '0';
        state.sys.phase = 'main1';
        injectRawBlockingInteraction(state, {
            id: 'dt-future-choice',
            playerId: '0',
            kind: 'dt:future-choice',
            sourceId: 'future-choice',
        });

        const actions = buildDiceThroneAiLegalActions({
            playerId: '0',
            state,
        });

        expect(actions).toHaveLength(1);
        expect(actions[0]).toMatchObject({
            kind: 'interaction-cancel',
            commands: [{
                type: INTERACTION_COMMANDS.CANCEL,
                payload: {
                    interactionId: 'dt-future-choice',
                    reason: 'unsupported-interaction-kind',
                },
            }],
        });
    });

    it('展示型奖励骰只剩 1 颗时，AI 应确认收口而不是反复打出“俺也一样”', () => {
        const state = createSetupWithHand(['card-me-too'], {
            playerId: '1',
            cp: 4,
            mutate: (core) => {
                core.activePlayerId = '1';
                core.rollCount = 0;
                core.rollConfirmed = false;
                core.pendingBonusDiceSettlement = {
                    id: 'card-one-throw-fortune-display-test',
                    sourceAbilityId: 'card-one-throw-fortune',
                    attackerId: '1',
                    targetId: '1',
                    dice: [{
                        index: 0,
                        value: 6,
                        face: 'meteor',
                        effectKey: 'bonusDie.effect.gainCp',
                        effectParams: { cp: 3, value: 6 },
                    }],
                    rerollCostTokenId: '',
                    rerollCostAmount: 0,
                    rerollCount: 0,
                    maxRerollCount: 0,
                    readyToSettle: false,
                    displayOnly: true,
                    showTotal: false,
                    customResolutionId: 'one-throw-fortune-cp',
                    allowDiceModification: true,
                };
            },
        })(['0', '1'], fixedRandom);
        state.sys.phase = 'main1';

        expect(checkPlayCard(state.core, '1', getCardById('card-me-too'), 'main1')).toEqual({
            ok: false,
            reason: 'wrongPhaseForRoll',
        });

        const actions = buildDiceThroneAiLegalActions({
            playerId: '1',
            state,
        });

        expect(actions.some((action) =>
            action.kind === 'play-card'
            && action.commands.some((command) =>
                command.type === 'PLAY_CARD'
                && (command.payload as { cardId?: string }).cardId === 'card-me-too',
            ),
        )).toBe(false);
        expect(actions).toContainEqual(expect.objectContaining({
            kind: 'confirm-roll',
            commands: [{ type: 'CONFIRM_ROLL', payload: {} }],
            metadata: expect.objectContaining({
                rollConfirmScope: 'bonus-roll',
            }),
        }));

        const result = createRunner(fixedRandom, false).run({
            name: '一掷千金展示型奖励骰 AI 确认收口',
            setup: () => state,
            commands: [cmd('CONFIRM_ROLL', '1')],
        });

        expect(result.finalState.core.pendingBonusDiceSettlement).toBeUndefined();
        expect(result.finalState.core.players['1'].resources[RESOURCE_IDS.CP]).toBe(7);
    });

    it('主阶段 2 不应因上一轮残留骰子继续打出骰子修改牌', () => {
        const state = createSetupWithHand(['card-play-six', 'card-flick'], {
            playerId: '1',
            cp: 4,
        })(['0', '1'], fixedRandom);
        state.core.activePlayerId = '1';
        state.sys.phase = 'main2';
        state.core.rollCount = 1;
        state.core.rollConfirmed = true;
        state.core.dice = [{ id: 0, value: 4, symbol: 'saber', symbols: ['saber'], isKept: false } as any];

        expect(checkPlayCard(state.core, '1', getCardById('card-play-six'), 'main2')).toEqual({
            ok: false,
            reason: 'wrongPhaseForRoll',
        });
        expect(checkPlayCard(state.core, '1', getCardById('card-flick'), 'main2')).toEqual({
            ok: false,
            reason: 'wrongPhaseForRoll',
        });

        const actions = buildDiceThroneAiLegalActions({
            playerId: '1',
            state,
        });
        const playedCardIds = actions
            .flatMap(action => action.commands)
            .filter(command => command.type === 'PLAY_CARD')
            .map(command => (command.payload as { cardId?: string }).cardId);

        expect(playedCardIds).not.toContain('card-play-six');
        expect(playedCardIds).not.toContain('card-flick');
    });

    it('线上反馈：进攻技能已选中且无阻塞窗口时，进攻方应能继续推进结算', () => {
        const state = createHeroMatchup('tianshi', 'shadow_thief')(['0', '1'], fixedRandom);
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '1';
        state.core.rollCount = 1;
        state.core.rollLimit = 3;
        state.core.rollDiceCount = 5;
        state.core.rollConfirmed = true;
        state.core.pendingAttack = {
            attackerId: '1',
            defenderId: '0',
            sourceAbilityId: 'shadow-fang',
            settlementStage: 'preDamage',
            isDefendable: true,
        };
        state.core.currentRollContext = {
            id: 'roll:offensive:1:1',
            kind: 'offensive',
            ownerPlayerId: '1',
            phase: 'offensiveRoll',
            dice: state.core.dice.slice(0, 5),
            status: 'settling',
            policy: {
                modifiableBy: 'owner',
                rerollableBy: 'owner',
                allowPassiveReroll: true,
                allowDiceCardTargeting: true,
                ultimateLocked: false,
                blocksPhaseFlow: true,
            },
            settlement: { mode: 'selectAttack' },
            display: { surface: 'diceTray', replayOnly: false },
        };

        expect(canAdvancePhase(state.core, 'offensiveRoll')).toBe(true);
        expect(DiceThroneDomain.validate(state, {
            type: 'ADVANCE_PHASE',
            playerId: '1',
            payload: {},
            timestamp: 0,
        } as never)).toEqual({ valid: true });

        const actions = buildDiceThroneAiLegalActions({ playerId: '1', state });
        expect(actions).toContainEqual(expect.objectContaining({
            kind: 'advance-phase',
            commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
        }));
    });

    it('线上反馈：AI 是伤害响应者时必须生成可执行的跳过响应动作', () => {
        const state = createHeroMatchup('zhanshujia', 'shadow_thief')(['0', '1'], fixedRandom);
        state.sys.phase = 'offensiveRoll';
        state.sys.flowHalted = true;
        state.core.activePlayerId = '0';
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'drum-movement-2-indirect',
            settlementStage: 'preDamage',
            isDefendable: false,
            preDefenseResolved: true,
        };
        state.core.pendingDamage = {
            id: 'online-ai-before-damage-received',
            sourcePlayerId: '0',
            targetPlayerId: '1',
            originalDamage: 2,
            currentDamage: 2,
            responseType: 'beforeDamageReceived',
            responderId: '1',
            sourceAbilityId: 'drum-movement-2-indirect',
            damageScope: 'attack',
        };

        const actions = buildDiceThroneAiLegalActions({ playerId: '1', state });

        expect(actions).toContainEqual(expect.objectContaining({
            kind: 'skip-token-response',
            commands: [{ type: 'SKIP_TOKEN_RESPONSE', payload: {} }],
        }));
        expect(DiceThroneDomain.validate(state, {
            type: 'SKIP_TOKEN_RESPONSE',
            playerId: '1',
            payload: {},
            timestamp: 0,
        } as never)).toEqual({ valid: true });
    });

    it('线上反馈：已不属于当前骰盘的展示型奖励骰残留不应永久阻塞防御阶段推进', () => {
        const state = createHeroMatchup('tianshi', 'shadow_thief')(['0', '1'], fixedRandom);
        state.sys.phase = 'defensiveRoll';
        state.sys.flowHalted = true;
        state.core.activePlayerId = '0';
        state.core.rollCount = 1;
        state.core.rollLimit = 1;
        state.core.rollDiceCount = 1;
        state.core.rollConfirmed = true;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'archangel-resolve',
            defenseAbilityId: 'fearless-riposte',
            settlementStage: 'postDamagePending',
            isDefendable: true,
            preDefenseResolved: true,
        };
        state.core.currentRollContext = {
            id: 'bonus:flight-display-current',
            kind: 'bonus',
            ownerPlayerId: '0',
            targetPlayerId: '1',
            sourceAbilityId: 'flight',
            dice: [{
                id: 0,
                definitionId: 'tianshi-dice',
                value: 2,
                symbol: 'blade',
                symbols: ['blade'],
                isKept: false,
                ownerId: '0',
                displayOnly: true,
            }],
            status: 'settled',
            policy: {
                modifiableBy: 'none',
                rerollableBy: 'none',
                allowPassiveReroll: false,
                allowDiceCardTargeting: false,
                ultimateLocked: false,
                blocksPhaseFlow: false,
            },
            settlement: { mode: 'damage', metadata: { pendingBonusDiceSettlementId: 'flight-display-current' } },
            display: { surface: 'diceTray', replayOnly: true },
        };
        state.core.pendingBonusDiceSettlement = {
            id: 'flight-display-stale',
            sourceAbilityId: 'flight',
            attackerId: '0',
            targetId: '1',
            dice: [
                { index: 0, value: 1, face: 'blade' },
                { index: 1, value: 4, face: 'wing' },
            ],
            rerollCostTokenId: '',
            rerollCostAmount: 0,
            rerollCount: 0,
            maxRerollCount: 0,
            readyToSettle: false,
            displayOnly: true,
            continuation: { kind: 'complete' },
            allowDiceModification: true,
        };

        expect(canAdvancePhase(state.core, 'defensiveRoll')).toBe(true);
        expect(DiceThroneDomain.validate(state, {
            type: 'ADVANCE_PHASE',
            playerId: '1',
            payload: {},
            timestamp: 0,
        } as never)).toEqual({ valid: true });

        const actions = buildDiceThroneAiLegalActions({ playerId: '1', state });
        expect(actions).toContainEqual(expect.objectContaining({
            kind: 'advance-phase',
            commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
        }));
    });

    it('主阶段临时骰确认后，watchdog 不得把攻击掷骰阶段裸推进掉', () => {
        let state = createSetupWithHand(['card-enlightenment'], { cp: 0 })(['0', '1'], fixedRandom);
        state.sys.phase = 'main1';
        state.core.activePlayerId = '0';

        state = dispatch(state, 'PLAY_CARD', { cardId: 'card-enlightenment' }, createQueuedRandom([1]));
        expect(state.core.pendingBonusDiceSettlement).toBeDefined();
        expect(state.sys.phase).toBe('main1');

        const bonusConfirmAction = buildDiceThroneAiLegalActions({ playerId: '0', state })
            .find((action) => action.kind === 'confirm-roll');
        expect(bonusConfirmAction).toEqual(expect.objectContaining({
            commands: [{ type: 'CONFIRM_ROLL', payload: {} }],
            metadata: expect.objectContaining({
                rollConfirmScope: 'bonus-roll',
            }),
        }));

        state = dispatch(state, 'CONFIRM_ROLL');
        expect(state.core.pendingBonusDiceSettlement).toBeUndefined();
        expect(state.sys.phase).toBe('main1');

        const seatControllers = {
            '0': { type: 'local-ai', policyId: 'baseline' },
            '1': { type: 'human' },
        } as const;
        const mainPhaseAdvance = resolveForceAdvancePhaseAfterRecovery({
            authoritativeState: state,
            seatControllers,
            playerId: '0',
            engineConfig,
            gameId: 'dicethrone',
        });
        expect(mainPhaseAdvance?.action.commands).toEqual([{ type: 'ADVANCE_PHASE', payload: {} }]);

        state = dispatch(state, 'ADVANCE_PHASE');
        expect(state.sys.phase).toBe('offensiveRoll');

        const offensiveRollForcedAdvance = resolveForceAdvancePhaseAfterRecovery({
            authoritativeState: state,
            seatControllers,
            playerId: '0',
            engineConfig,
            gameId: 'dicethrone',
        });
        expect(offensiveRollForcedAdvance).toBeNull();

        const actions = buildDiceThroneAiLegalActions({ playerId: '0', state });
        expect(actions).toContainEqual(expect.objectContaining({
            kind: 'roll-dice',
            commands: [{ type: 'ROLL_DICE', payload: {} }],
        }));

        state = dispatch(state, 'ROLL_DICE', {}, createQueuedRandom([1, 2, 3, 4, 5]));
        const mainRollConfirmAction = buildDiceThroneAiLegalActions({ playerId: '0', state })
            .find((action) => action.kind === 'confirm-roll');
        expect(mainRollConfirmAction).toEqual(expect.objectContaining({
            commands: [{ type: 'CONFIRM_ROLL', payload: {} }],
            metadata: expect.objectContaining({
                rollConfirmScope: 'main-roll',
                rollConfirmPhase: 'offensiveRoll',
            }),
        }));
    });
});
