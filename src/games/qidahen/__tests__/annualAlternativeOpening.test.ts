import { describe, expect, it } from 'vitest';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { createRespondToPromptCommand, getCurrentInteractionData, getCurrentInteractionSummary } from '../../../engine/testing/interactionTestFacade';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import { TUTORIAL_COMMANDS } from '../../../engine/systems/TutorialSystem';
import type { SimpleChoiceData } from '../../../engine/systems/InteractionSystem';
import type { Command, MatchState, RandomFn } from '../../../engine/types';
import { QIDAHEN_ANNUAL_TUTORIAL } from '../annualTutorial';
import { QidahenDomain } from '../domain';
import { getQidahenTurnResolutionFrame } from '../domain/turnResolutionOpportunities';
import { getQidahenWheelRecruitTrainChoices } from '../domain/wheelRecruitTrain';
import type { QidahenCommand, QidahenCore } from '../domain/types';
import { engineConfig } from '../game';
import { buildQidahenTutorialSetupData } from '../tutorialSetup';

const players = ['0', '1', '2'];
// 初始化牌序固定；教程启动后 executePipeline 使用 manifest 本身的 randomPolicy。
const random: RandomFn = { random: () => 0.5, d: sides => sides === 10 ? 10 : 1, range: min => min, shuffle: cards => [...cards] };

describe('年度教程开局的合法替代路线', () => {
    it.each([
        { name: '大同军屯、零处开垦、征召', farm: true, reclaim: false, recruit: true },
        { name: '跳过军屯、大同开垦、征召', farm: false, reclaim: true, recruit: true },
        { name: '大同军屯和开垦、跳过手牌', farm: true, reclaim: true, recruit: false },
    ])('$name 后按真实战果继续到次年训练', scenario => {
        let state: MatchState<QidahenCore> = {
            core: QidahenDomain.setup(players, random, buildQidahenTutorialSetupData('basic-opening')!.setupData),
            sys: createInitialSystemState(players, engineConfig.systems, 'annual-alternative-opening-test'),
        };
        const visited = new Set<string>();
        let farmDone = !scenario.farm, reclaimDone = false, handStage = scenario.recruit ? 0 : 4;
        let diplomacyDone = false, hireDone = false, trainingCount = 0;
        let battleChecked = false, farmChecked = !scenario.farm, reclaimChecked = false, handChecked = false;
        const send = (type: string, payload: unknown = {}, playerId = '0', authoredAi = false) => {
            const command = { type, payload, playerId, timestamp: 100, ...(authoredAi ? { skipValidation: true } : {}) } as QidahenCommand;
            if (authoredAi) expect(QidahenDomain.validate(state, command).valid, `${state.sys.tutorial.step?.id} AI`).toBe(true);
            const result = executePipeline({ domain: QidahenDomain, systems: engineConfig.systems }, state, command, random, players);
            expect(result.success, JSON.stringify({ step: state.sys.tutorial.step?.id, type, payload, error: result.error })).toBe(true);
            state = result.state;
        };
        send(TUTORIAL_COMMANDS.START, { manifest: QIDAHEN_ANNUAL_TUTORIAL });
        expect(state.sys.tutorial.randomPolicy).toMatchObject({ mode: 'sequence', values: [1, 1, 1, 10] });
        for (let guard = 0; state.sys.tutorial.active && guard < 130; guard++) {
            const step = state.sys.tutorial.step!;
            visited.add(step.id);
            if (step.aiActions?.length) {
                for (const action of step.aiActions) send(action.commandType, action.payload, action.playerId, true);
                send(TUTORIAL_COMMANDS.AI_CONSUMED, { stepId: step.id, ...(step.aiBatchId ? { batchId: step.aiBatchId } : {}) });
                if (state.sys.tutorial.step?.id !== step.id) continue;
            }
            if (step.id === 'midyear' && !scenario.farm) {
                expect(state.core.pieces.some(piece => piece.sourceStackId.startsWith('ming-farm-'))).toBe(false);
            }
            if (step.id === 'battle-finish') {
                expect(state.core.regions.find(region => region.id === 'city-region-7')?.controller).toBe('mongol');
                battleChecked = true;
            }
            if (step.infoStep) { send(TUTORIAL_COMMANDS.NEXT, { reason: 'manual' }); continue; }
            let command = step.allowedCommands?.[0];
            let targets = step.allowedTargets ?? [];
            if (step.id === 'opening-farm-cycle') {
                const frame = getQidahenTurnResolutionFrame(state)!.metadata.qidahenTurn;
                if (frame.step === 'menu') { command = INTERACTION_COMMANDS.RESPOND; targets = [!farmDone ? 'military-farm' : !reclaimDone ? 'reclaim' : handStage === 0 ? 'hand-action:recruit' : 'finish-slot']; }
                else if (frame.step === 'farm-target') { command = INTERACTION_COMMANDS.RESPOND; targets = ['city-region-1']; farmDone = true; }
                else if (frame.step === 'reclaim-targets') { command = INTERACTION_COMMANDS.RESPOND; targets = scenario.reclaim ? ['city-region-1'] : []; reclaimDone = true; }
                else if (frame.step === 'finish-hand') { command = INTERACTION_COMMANDS.RESPOND; targets = [handStage === 0 ? 'hand-action:recruit' : 'skip-hand']; }
                else if (frame.step === 'await-hand') {
                    [command, targets] = [
                        ['SELECT_PAYMENT_CARD', ['hand-3']], ['EXECUTE_SELECTED_ACTION', []],
                        ['SELECT_REGION', ['city-region-15']], [INTERACTION_COMMANDS.RESPOND, ['level-2-troops']],
                    ][handStage++] as [string, string[]];
                } else throw new Error(`Unexpected opening phase ${frame.step}`);
            }
            if (!command) throw new Error(`Missing command: ${step.id}`);
            if (step.id === 'dispatch-source') targets = ['city-region-15'];
            if (step.id === 'dispatch-troops') targets = [
                'ming-post-sarhu-1619-liaobei-cavalry-cavalry-lv1__compat__1',
                'ming-post-sarhu-1619-liaobei-cavalry-cavalry-lv1__compat__2',
                'ming-post-sarhu-1619-liaobei-regular-artillery-lv1__compat__1',
            ];
            if (step.id === 'dispatch-target') targets = ['city-region-7'];
            if (step.id === 'battle-roll' || step.id === 'battle-roll-followup') {
                if (state.core.handCards.some(card => card.id === 'hand-2')) send('PLAY_TACTIC_CARD', { cardId: 'hand-2' });
                targets = ['fight'];
            }
            if (step.id === 'occupy') targets = ['occupy'];
            if (step.id === 'player-retreat' || step.id === 'player-retreat-followup') targets = ['rear-guard'];
            if (step.id === 'training-practice' && state.core.wheelRecruitTrainProgress?.phase === 'payment' && command === 'SELECT_PAYMENT_CARD')
                targets = [state.core.handCards.find(card => card.faction === 'ming')!.id];
            const before = state.core;
            const frameBefore = getQidahenTurnResolutionFrame(state)?.metadata.qidahenTurn.step;
            if (command === INTERACTION_COMMANDS.RESPOND) {
                const prompt = getCurrentInteractionSummary(state);
                const data = getCurrentInteractionData<SimpleChoiceData>(state);
                if (!prompt.playerId || !data) throw new Error(`Missing prompt: ${step.id}`);
                if (step.id === 'diplomacy-cycle') {
                    if (frameBefore === 'menu') targets = [!diplomacyDone ? 'diplomacy' : !hireDone ? 'hire' : 'finish-slot'];
                    else if (frameBefore === 'diplomacy-targets') { targets = [diplomacyDone ? 'finish-diplomacy' : 'city-region-2']; diplomacyDone = true; }
                    else if (frameBefore === 'hire-payment') targets = [data.options.find(option => !option.disabled)!.id];
                    else if (frameBefore === 'hire-target') { targets = ['city-region-1']; hireDone = true; }
                    else if (frameBefore === 'finish-hand') targets = ['skip-hand'];
                    else throw new Error(`Unexpected diplomacy phase: ${frameBefore}`);
                } else if (step.id.startsWith('season-upkeep-player-')) {
                    const frame = getQidahenTurnResolutionFrame(state)!.metadata.qidahenTurn;
                    const preferred: Record<string, string> = {
                        'city-region-1': 'ming-post-sarhu-1619-datong-regular-infantry-lv1__compat__1',
                    };
                    const valid = data.options.filter(option => !option.disabled).map(option => option.id);
                    const cards = valid.filter(id => state.core.handCards.some(card => card.id === id));
                    const pieces = valid.filter(id => !cards.includes(id) && id !== 'ming-post-sarhu-1619-liaobei-regular-artillery-lv1__compat__1' && id !== 'ming-post-sarhu-1619-liaobei-cavalry-cavalry-lv1__compat__1' && !id.startsWith('ming-farm-'));
                    const wanted = preferred[frame.upkeepTasks[frame.upkeepIndex].regionId];
                    targets = frame.upkeepTasks[frame.upkeepIndex].reason === 'korea' ? [cards[0]]
                        : wanted && valid.includes(wanted) ? [wanted] : cards.length && (!pieces.length) ? [cards[0]] : [pieces[0]];
                    expect(targets[0], '合法耗损候选').toBeDefined();
                } else if (step.id === 'season-chronology-payment') targets = [data.options.find(option => !option.disabled)!.id];
                const response = createRespondToPromptCommand(state, { playerId: prompt.playerId, ...(data.multi ? { optionIds: targets } : { optionId: targets[0] }) });
                send(response.type, response.payload, response.playerId);
            } else {
                let payload: Command['payload'] = {};
                if (command === 'EXECUTE_WHEEL_MOVE') payload = { moveId: targets[0] ?? 'move-1-free' };
                else if (command === 'SELECT_REGION') payload = { regionId: targets[0] };
                else if (command === 'CONFIRM_PREVIEW_ACTION') payload = { actionId: 'upgrade-armament', sourceHandCardId: targets[0] };
                else if (command === 'SELECT_PAYMENT_CARD' || command === 'PLAY_TACTIC_CARD') payload = { cardId: targets[0] };
                else if (command === 'RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE') payload = { choiceId: targets[0] };
                send(command, payload);
            }
            if (step.id === 'opening-farm-cycle' && frameBefore === 'farm-target') {
                expect(state.core.regions.find(region => region.id === 'city-region-1')!.troops).toBe(before.regions.find(region => region.id === 'city-region-1')!.troops + 1);
                farmChecked = true;
            }
            if (step.id === 'opening-farm-cycle' && frameBefore === 'reclaim-targets') {
                expect(state.core.regions.find(region => region.id === 'city-region-1')!.population).toBe(before.regions.find(region => region.id === 'city-region-1')!.population + Number(scenario.reclaim));
                reclaimChecked = true;
            }
            if (step.id === 'opening-farm-cycle' && frameBefore === 'await-hand' && targets[0] === 'level-2-troops') {
                expect(state.core.regions.find(region => region.id === 'city-region-15')!.troops).toBe(before.regions.find(region => region.id === 'city-region-15')!.troops + 6);
                handChecked = true;
            }
            if (step.id === 'opening-farm-cycle' && frameBefore === 'finish-hand' && targets[0] === 'skip-hand') handChecked = true;
            if (step.id === 'training-practice' && command === 'RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE') {
                const choice = getQidahenWheelRecruitTrainChoices(before).find(item => item.id === targets[0]);
                expect(choice).toBeDefined();
                if (choice?.kind === 'training-target' && choice.pieceId) {
                    expect(state.core.pieces.find(piece => piece.id === choice.pieceId)?.level).toBe(choice.targetLevel);
                    trainingCount++;
                }
            }
            if (state.sys.tutorial.pendingAnimationAdvance) send(TUTORIAL_COMMANDS.ANIMATION_COMPLETE);
        }
        expect(farmChecked && reclaimChecked && handChecked && battleChecked).toBe(true);
        expect([...visited]).toEqual(expect.arrayContaining(['midyear', 'battle-roll', 'new-year', 'claim-year', 'training-practice', 'finish']));
        expect(trainingCount).toBeGreaterThan(0);
        expect(state.sys.tutorial.active).toBe(false);
        expect(state.core.currentYearIndex).toBe(1);
        expect(state.core.regions.find(region => region.id === 'city-region-7')?.controller).toBe('mongol');
        expect(state.sys.resolution).toBeUndefined();
        send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' }, state.core.currentPlayer);
        expect(getCurrentInteractionSummary(state).id).toBeDefined();
    });
});

