import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { createRespondToPromptCommand, getCurrentInteractionData, getCurrentInteractionSummary } from '../../../engine/testing/interactionTestFacade';
import { TUTORIAL_COMMANDS } from '../../../engine/systems/TutorialSystem';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import type { Command, MatchState, RandomFn } from '../../../engine/types';
import type { SimpleChoiceData } from '../../../engine/systems/InteractionSystem';
import { engineConfig } from '../game';
import { QidahenDomain } from '../domain';
import { QIDAHEN_ANNUAL_TUTORIAL } from '../annualTutorial';
import { buildQidahenTutorialSetupData } from '../tutorialSetup';
import type { QidahenCommand, QidahenCore } from '../domain/types';

const players = ['0', '1', '2'];
const random: RandomFn = { random: () => 0.5, d: sides => sides === 10 ? 10 : 1, range: min => min, shuffle: values => [...values] };
const initial = (): MatchState<QidahenCore> => ({
    core: QidahenDomain.setup(players, random, buildQidahenTutorialSetupData('basic-opening')!.setupData),
    sys: createInitialSystemState(players, engineConfig.systems, 'qidahen-annual-tutorial'),
});

describe('连续年度教程正式管线', () => {
    it('从合法初始化逐个实际输入走完年中、新年和次年训练；结束保留对局且无教程阻塞', () => {
        let state = initial();
        const visited: string[] = [];
        const send = (type: string, payload: unknown = {}, playerId = '0', authoredAi = false) => {
            const command = { type, payload, playerId, timestamp: 100, ...(authoredAi ? { skipValidation: true } : {}) } as QidahenCommand;
            if (authoredAi) expect(QidahenDomain.validate(state, command).valid, `${state.sys.tutorial.step?.id} AI legality`).toBe(true);
            const result = executePipeline({ domain: QidahenDomain, systems: engineConfig.systems }, state, command, random, players);
            expect(result.success, JSON.stringify({ step: state.sys.tutorial.step?.id, type, payload, error: result.error })).toBe(true);
            state = result.state;
        };
        send(TUTORIAL_COMMANDS.START, { manifest: QIDAHEN_ANNUAL_TUTORIAL });
        for (let guard = 0; state.sys.tutorial.active && guard < 130; guard += 1) {
            const step = state.sys.tutorial.step!;
            visited.push(step.id);
            if (step.aiActions?.length) {
                for (const command of step.aiActions) send(command.commandType, command.payload, command.playerId, true);
                send(TUTORIAL_COMMANDS.AI_CONSUMED, { stepId: step.id });
                if (state.sys.tutorial.step?.id !== step.id) continue;
            }
            // 核对讲解赖以成立的真实前因，不能只证明输入能够走通。
            if (process.env.QIDAHEN_CHECKPOINT_EXPORT_DIR && (Boolean(step.content && step.tooltipAnchorTarget) || ['battle-roll', 'occupy', 'abandon-jinzhou', 'training-recruit-target'].includes(step.id))) {
                mkdirSync(process.env.QIDAHEN_CHECKPOINT_EXPORT_DIR, { recursive: true });
                writeFileSync(`${process.env.QIDAHEN_CHECKPOINT_EXPORT_DIR}/${step.id}.json`, JSON.stringify({ version: 1, gameId: 'qidahen', seed: 'tutorial-progress:v1:qidahen:basic-opening:r23', numPlayers: 3, randomCursor: 0, savedAt: 1, state }));
            }
            const liaodong = state.core.regions.find(region => region.id === 'city-region-15-liaodong')!;
            if (step.id === 'reclaim-target') {
                expect([liaodong.population, liaodong.troops]).toEqual([3, 3]);
            }
            if (step.id === 'midyear') {
                expect([liaodong.population, liaodong.troops]).toEqual([4, 3]);
                expect(state.core.factions.ming.handCount).toBe(21);
                expect(state.core.currentPlayer).toBe('0');
            }
            const datong = state.core.regions.find(region => region.id === 'city-region-1')!;
            if (step.id === 'hire-target') expect([datong.population, datong.troops]).toEqual([2, 1]);
            if (step.id === 'upkeep-datong') expect([datong.population, datong.troops]).toEqual([2, 3]);
            if (step.id === 'training-recruit-target') expect([liaodong.population, liaodong.troops]).toEqual([4, 3]);
            if (step.id === 'training-action') expect(state.core.factions.ming.handCount).toBe(2);
            if (step.id === 'new-order' || step.id === 'year-character') {
                expect(state.core.yearCards.map(card => card.id), 'PDF p5先依新纪年选完人物，再公开再下一张').toEqual(['current-year']);
            }
            if (step.id === 'training-move') expect(state.core.yearCards.map(card => card.id)).toEqual(['current-year', 'next-year']);
            if (step.id === 'training-finish') {
                expect(state.core.wheelRecruitTrainProgress?.actionsCompleted).toBe(4);
                expect(state.core.factions.ming.handCount).toBe(1);
                for (const index of [1, 2]) {
                    const piece = state.core.pieces.find(item => item.id === `ming-recruit-regular-infantry-lv2__compat__${index}`);
                    expect(piece?.level, '训练的是先前实际征召并保留下来的步兵').toBe(3);
                    expect(piece?.regionId).toBe('city-region-7');
                }
                expect([liaodong.population, liaodong.troops]).toEqual([4, 4]);
                expect(state.core.chronology.yearStats.ming.builtTroops).toBe(1);
            }
            if (step.infoStep) { send(TUTORIAL_COMMANDS.NEXT, { reason: 'manual' }); continue; }
            const command = step.allowedCommands![0];
            const targets = step.allowedTargets ?? [];
            if (command === INTERACTION_COMMANDS.RESPOND) {
                const prompt = getCurrentInteractionSummary(state);
                const data = getCurrentInteractionData<SimpleChoiceData>(state);
                if (!prompt.playerId || !data) throw new Error(`Missing prompt for tutorial step ${step.id}`);
                const response = createRespondToPromptCommand(state, {
                    playerId: prompt.playerId,
                    ...(data.multi ? { optionIds: targets } : { optionId: targets[0] }),
                });
                send(response.type, response.payload, response.playerId);
            } else {
                let payload: Command['payload'] = {};
                if (command === 'EXECUTE_WHEEL_MOVE') payload = { moveId: 'move-1-free' };
                else if (command === 'SELECT_REGION') payload = { regionId: targets[0] };
                else if (command === 'CONFIRM_PREVIEW_ACTION') payload = step.id === 'recruit-action' ? { actionId: 'recruit' } : { actionId: 'upgrade-armament', sourceHandCardId: targets[0] };
                else if (command === 'SELECT_PAYMENT_CARD' || command === 'PLAY_TACTIC_CARD') payload = { cardId: targets[0] };
                else if (command === 'RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE') payload = { choiceId: targets[0] };
                send(command, payload);
            }
            if (state.sys.tutorial.pendingAnimationAdvance) send(TUTORIAL_COMMANDS.ANIMATION_COMPLETE);
            if (step.id === 'upgrade-card') {
                expect(state.core.confirmedActionId).toBe('upgrade-armament');
                expect(state.core.selectedHandActionCardId).toBe('deck-ming-4');
                expect(state.core.selectedPaymentCardIds).toEqual(['deck-ming-4']);
                expect(state.core.factionActionUsed).toBe(false);
            }
            expect(state.sys.tutorial.step?.id, `${step.id} did not advance`).not.toBe(step.id);
        }
        expect(visited).toEqual(QIDAHEN_ANNUAL_TUTORIAL.steps.map(step => step.id));
        expect(state.sys.tutorial.active).toBe(false);
        expect(state.core.currentYearIndex).toBe(1);
        expect(state.core.chronology.claimedCardIds.ming).toEqual([1301]);
        expect(state.core.pieces.find(piece => piece.id === 'ming-post-sarhu-1619-liaobei-regular-artillery-lv1__compat__1')?.level).toBe(2);
        expect(state.core.regions.find(region => region.id === 'city-region-7')?.controller).toBe('ming');
        expect(state.sys.resolution).toBeUndefined();
        const currentPlayer = state.core.currentPlayer;
        send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' }, currentPlayer);
        expect(getCurrentInteractionSummary(state).id).toBeDefined();
    });
});
