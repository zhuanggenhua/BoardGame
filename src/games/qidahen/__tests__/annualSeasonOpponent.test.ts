import { describe, expect, it } from 'vitest';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { createRespondToPromptCommand, getCurrentInteractionData, getCurrentInteractionSummary, getPromptOptions } from '../../../engine/testing/interactionTestFacade';
import type { MatchState, RandomFn, TutorialManifest } from '../../../engine/types';
import type { SimpleChoiceData } from '../../../engine/systems/InteractionSystem';
import { createAnnualSeasonTutorialSteps, resolveAnnualSeasonTutorialStep, validateAnnualSeasonTutorialStep } from '../annualSeasonTutorial';
import { QidahenDomain } from '../domain';
import { createInitialCore } from '../domain/initialCoreSetup';
import { getQidahenTurnResolutionFrame } from '../domain/turnResolutionOpportunities';
import type { QidahenCommand, QidahenCore } from '../domain/types';
import { engineConfig } from '../game';

const players = ['0', '1', '2'];
const random: RandomFn = { random: () => 0.5, d: sides => sides === 10 ? 10 : 1, range: min => min, shuffle: cards => [...cards] };

describe('年度教程对手耗损交互', () => {
    it('合法产生的多选耗损分次支付后，旧自动动作回执不会清除新槽', () => {
        let state: MatchState<QidahenCore> = {
            core: createInitialCore(players, 'post-sarhu-1619', true),
            sys: createInitialSystemState(players, engineConfig.systems, 'qidahen-season-opponent'),
        };
        const send = (type: string, payload: unknown = {}, playerId = state.core.currentPlayer) => {
            const result = executePipeline({ domain: QidahenDomain, systems: engineConfig.systems }, state,
                { type, payload, playerId, timestamp: 100 } as QidahenCommand, random, players);
            expect(result.success, JSON.stringify({ type, payload, error: result.error })).toBe(true);
            state = result.state;
        };
        const choose = (ids: string | string[]) => {
            const prompt = getCurrentInteractionSummary(state);
            const data = getCurrentInteractionData<SimpleChoiceData>(state);
            expect(prompt.playerId).toBeDefined();
            expect(data).toBeDefined();
            const selected = Array.isArray(ids) ? ids : [ids];
            const command = createRespondToPromptCommand(state, {
                playerId: prompt.playerId!, ...(data!.multi ? { optionIds: selected } : { optionId: selected[0] }),
            });
            send(command.type, command.payload, command.playerId);
        };
        let recruited = false;
        let reached = false;
        for (let guard = 0; guard < 200 && !reached; guard++) {
            const frame = getQidahenTurnResolutionFrame(state);
            if (!frame) {
                if (state.core.handLimitDiscardSelection) {
                    choose(state.core.handLimitDiscardSelection.candidateCardIds.slice(0, state.core.handLimitDiscardSelection.requiredDiscardCount));
                } else send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' });
                continue;
            }
            const data = frame.metadata.qidahenTurn;
            if (data.step === 'menu' && state.core.currentPlayer === '2' && !recruited
                && getPromptOptions(state).some(option => option.id === 'recruit-train')) {
                recruited = true;
                choose('recruit-train');
                const payment = state.core.handCards.find(card => card.faction === 'jin');
                expect(payment).toBeDefined();
                send('SELECT_PAYMENT_CARD', { cardId: payment!.id });
                send('CONFIRM_WHEEL_RECRUIT_TRAIN_PAYMENT');
                send('RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE', { choiceId: 'action:recruit' });
                send('RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE', { choiceId: 'recruit:city-region-13' });
                send('RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE', { choiceId: 'finish' });
                continue;
            }
            if (data.step === 'upkeep' && data.upkeepTasks[data.upkeepIndex]?.factionId === 'jin') {
                expect(recruited).toBe(true);
                expect(data.upkeepTasks[data.upkeepIndex].required).toBe(2);
                const slots = createAnnualSeasonTutorialSteps([]);
                const manifest: TutorialManifest = {
                    id: 'annual-opponent-upkeep-test', numPlayers: 3,
                    steps: [...slots, { id: 'done', content: 'done', infoStep: true }],
                    stepValidator: (current, step) => validateAnnualSeasonTutorialStep(current as MatchState<QidahenCore>, step) ?? true,
                    resolveStep: (current, step) => resolveAnnualSeasonTutorialStep(current as MatchState<QidahenCore>, step),
                };
                send('SYS_TUTORIAL_START', { manifest }, '0');
                // 此用例从合法的对手耗损局面接入，跳过不属于当前主体的首槽。
                if (state.sys.tutorial.step?.id === 'season-upkeep-player-1') {
                    send('SYS_TUTORIAL_NEXT', { reason: 'auto' }, '0');
                }
                const first = state.sys.tutorial.step!;
                expect(first.id).toBe('season-upkeep-opponent-1');
                expect(getCurrentInteractionData<SimpleChoiceData>(state)?.multi).toEqual({ min: 1, max: 2 });
                const action = first.aiActions![0];
                expect(action.playerId).toBe('2');
                const payload = action.payload as { interactionId: string; optionIds: string[] };
                expect(payload.optionIds).toHaveLength(2);
                // 对手合法分次支付一项，模拟第一次自动动作回执晚到。
                send(action.commandType, { ...payload, optionIds: payload.optionIds.slice(0, 1) }, '2');
                send('SYS_TUTORIAL_AI_CONSUMED', { stepId: first.id }, '0');
                const next = state.sys.tutorial.step!;
                expect(next.id).toBe('season-upkeep-opponent-2');
                expect(next.aiActions![0].playerId).toBe('2');
                const nextActions = JSON.stringify(next.aiActions);
                send('SYS_TUTORIAL_AI_CONSUMED', { stepId: first.id }, '0');
                expect(state.sys.tutorial.step?.id).toBe(next.id);
                expect(JSON.stringify(state.sys.tutorial.step?.aiActions)).toBe(nextActions);
                const remaining = next.aiActions![0];
                send(remaining.commandType, remaining.payload, remaining.playerId);
                expect(getQidahenTurnResolutionFrame(state)?.metadata.qidahenTurn.upkeepIndex).toBeGreaterThan(data.upkeepIndex);
                reached = true;
                continue;
            }
            if (data.step === 'menu') choose('finish-slot');
            else if (data.step === 'finish-hand') choose('skip-hand');
            else if (data.step === 'income-bonus') choose('decline-bonus');
            else if (data.step === 'maintenance') choose('abandon');
            else if (data.step === 'upkeep') choose(getPromptOptions(state)[0].id);
            else throw new Error(`Unexpected season step ${data.step}`);
        }
        expect(reached).toBe(true);
    });
});
