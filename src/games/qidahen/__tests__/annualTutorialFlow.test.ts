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
import { getQidahenRecruitTrainMapInput } from '../ui/recruitTrainMapInput';
import { getQidahenTurnResolutionFrame } from '../domain/turnResolutionOpportunities';
import { getQidahenWheelRecruitTrainChoices } from '../domain/wheelRecruitTrain';

const players = ['0', '1', '2'];
const random: RandomFn = { random: () => 0.5, d: sides => sides === 10 ? 10 : 1, range: min => min, shuffle: values => [...values] };
const initial = (): MatchState<QidahenCore> => ({
    core: QidahenDomain.setup(players, random, buildQidahenTutorialSetupData('basic-opening')!.setupData),
    sys: createInitialSystemState(players, engineConfig.systems, 'qidahen-annual-tutorial'),
});

describe('连续年度教程正式管线', () => {
    const recruitRegions = ['city-region-1', 'city-region-15', 'jinzhou', 'city-region-22', 'song-jin', 'city-region-24', 'city-region-25', 'city-region-27', 'city-region-28-jizhen', 'city-region-28', 'city-region-30', 'city-region-31', 'city-region-32', 'city-region-33', 'city-region-15-liaodong', 'city-region-19-liaoxi', 'xuan-fu'];
    const cases: Array<[string, string, string?]> = recruitRegions.flatMap(region => ['level-2-troops', 'level-4-chuanbing'].map(choice => [region, choice]));
    cases.push(['city-region-15', 'level-2-troops', 'remove-farm']);
    cases.push(['city-region-15-liaodong', 'level-2-troops', 'zero-hand']);
    cases.push(['city-region-15', 'level-2-troops', 'early-finish']);
    cases.push(['city-region-15', 'level-2-troops', 'recruit-first']);
    cases.push(['city-region-15', 'level-2-troops', 'other-train']);
    cases.push(['city-region-15', 'level-2-troops', 'extra-training']);
    it.each(cases)('真实教程管线 %s / %s / %s 完成年中、新年与次年训练', (recruitRegion, recruitChoice, variation) => {
        let state = initial();
        const visited: string[] = [];
        let liaodongBeforeTraining = 0;
        let handBeforeTraining = 0;
        let practiceInitial: QidahenCore | undefined;
        let usedAlternative = false;
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
            if (process.env.QIDAHEN_CHECKPOINT_EXPORT_DIR && (Boolean(step.content && step.tooltipAnchorTarget) || ['battle-roll', 'dispatch-source', 'farm-target', 'occupy', 'maintain-shanhai', 'abandon-jinzhou', 'abandon-inner-wall', 'abandon-outer-wall', 'training-recruit-target', 'training-finish', 'year-character', 'claim-year'].includes(step.id))) {
                mkdirSync(process.env.QIDAHEN_CHECKPOINT_EXPORT_DIR, { recursive: true });
                writeFileSync(`${process.env.QIDAHEN_CHECKPOINT_EXPORT_DIR}/${step.id}.json`, JSON.stringify({ version: 1, gameId: 'qidahen', seed: `tutorial-progress:v1:qidahen:basic-opening:r${QIDAHEN_ANNUAL_TUTORIAL.revision}`, numPlayers: 3, randomCursor: 0, savedAt: 1, state }));
            }
            const liaodong = state.core.regions.find(region => region.id === 'city-region-15-liaodong')!;
            if (step.id === 'reclaim-target') {
                expect([liaodong.population, liaodong.troops]).toEqual([3, 3]);
            }
            if (step.id === 'midyear') {
                expect(liaodong.population).toBe(4);
                expect(state.core.factions.ming.handCount).toBeGreaterThanOrEqual(15);
                expect(state.core.currentPlayer).toBe('0');
            }
            const datong = state.core.regions.find(region => region.id === 'city-region-1')!;
            if (step.id === 'hire-target') expect([datong.population, datong.troops]).toEqual([2, 1 + (recruitRegion === 'city-region-1' ? recruitChoice === 'level-2-troops' ? 6 : 2 : 0)]);
            if (step.id === 'training-practice' && state.core.wheelRecruitTrainProgress?.phase === 'choose-recruit-target') {
                expect(liaodong.population).toBe(4);
                liaodongBeforeTraining = liaodong.troops;
                const input = getQidahenRecruitTrainMapInput(state.core);
                expect(input.regionIds.length).toBeGreaterThan(1);
                for (const regionId of input.regionIds) {
                    const choice = input.choiceFor(regionId)!;
                    const before = state.core.regions.find(region => region.id === regionId)!.troops;
                    const command = { type: 'RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE', payload: { choiceId: choice.id }, playerId: '0', timestamp: 100 } as QidahenCommand;
                    const branch = executePipeline({ domain: QidahenDomain, systems: engineConfig.systems }, state, command, random, players);
                    expect(branch.success, `${regionId} legal recruit`).toBe(true);
                    expect(branch.state.core.regions.find(region => region.id === regionId)!.troops, `${regionId} real recruit outcome`).toBe(before + 1);
                    expect(branch.state.sys.tutorial.step?.id, `${regionId} continues the tutorial`).toBe('training-practice');
                    expect(branch.state.core.wheelRecruitTrainProgress?.phase).toBe('choose-action');
                }
            }
            if (step.id === 'training-action') { handBeforeTraining = state.core.factions.ming.handCount; expect(handBeforeTraining).toBeGreaterThanOrEqual(1); }
            if (step.id === 'new-order' || step.id === 'year-character') {
                expect(state.core.yearCards.map(card => card.id), 'PDF p5先依新纪年选完人物，再公开再下一张').toEqual(['current-year']);
            }
            if (step.id === 'training-move') expect(state.core.yearCards.map(card => card.id)).toEqual(['current-year', 'next-year']);
            if (step.id === 'training-slot-finish') {
                expect(state.core.wheelRecruitTrainProgress).toBeNull();
                expect(state.core.factions.ming.handCount).toBe(handBeforeTraining - (variation === 'extra-training' ? 2 : 1));
                if (variation === 'early-finish') {
                    expect(state.core.pieces).toEqual(practiceInitial!.pieces);
                    expect(state.core.chronology.yearStats.ming.builtTroops).toBe(practiceInitial!.chronology.yearStats.ming.builtTroops);
                } else if (variation !== 'recruit-first' && variation !== 'other-train') {
                const farm = state.core.pieces.find(item => item.sourceStackId.startsWith('ming-farm-') && item.regionId === 'city-region-7');
                if (variation === 'remove-farm') expect(farm).toBeUndefined();
                else {
                    expect(farm?.level, '训练的是之前军屯并实际参战的步兵').toBe(3);
                    expect(state.core.pieces.find(item => item.id === 'ming-post-sarhu-1619-liaobei-cavalry-cavalry-lv1__compat__1')?.level).toBe(2);
                }
                expect([liaodong.population, liaodong.troops]).toEqual([4, liaodongBeforeTraining + 1]);
                expect(state.core.chronology.yearStats.ming.builtTroops).toBe(1);
                }
            }
            if (step.infoStep) { send(TUTORIAL_COMMANDS.NEXT, { reason: 'manual' }); continue; }
            const command = step.allowedCommands![0];
            let targets = step.allowedTargets ?? [];
            if (step.id === 'dispatch-source') targets = ['city-region-15'];
            if (step.id === 'dispatch-troops') {
                const farm = state.core.pieces.find(piece => piece.sourceStackId.startsWith('ming-farm-') && piece.regionId === 'city-region-15')!;
                targets = [farm.id, 'ming-post-sarhu-1619-liaobei-cavalry-cavalry-lv1__compat__1', 'ming-post-sarhu-1619-liaobei-regular-artillery-lv1__compat__1'];
            }
            if (step.id === 'dispatch-target') targets = ['city-region-7'];
            if (step.id === 'battle-roll' || step.id === 'battle-roll-followup') {
                if (state.core.handCards.some(card => card.id === 'hand-2')) send('PLAY_TACTIC_CARD', { cardId: 'hand-2' });
                targets = ['fight'];
            }
            if (step.id === 'occupy') targets = ['occupy'];
            if (step.id === 'player-retreat' || step.id === 'player-retreat-followup') targets = ['rear-guard'];
            if (step.id === 'training-practice' && !practiceInitial) practiceInitial = structuredClone(state.core);
            if (step.id === 'training-practice' && variation === 'early-finish' && state.core.wheelRecruitTrainProgress?.phase === 'choose-action') targets = ['finish'];
            if (step.id === 'training-practice' && variation === 'recruit-first' && state.core.wheelRecruitTrainProgress?.phase === 'choose-action'
                && state.core.wheelRecruitTrainProgress.actionsCompleted === 0) { targets = ['action:recruit']; usedAlternative = true; }
            if (step.id === 'training-practice' && variation === 'extra-training' && state.core.wheelRecruitTrainProgress?.phase === 'choose-action'
                && state.core.wheelRecruitTrainProgress.actionsCompleted === 4 && !usedAlternative) { targets = ['extra-training']; usedAlternative = true; }
            if (step.id === 'training-practice' && state.core.wheelRecruitTrainProgress?.phase === 'payment'
                && command === 'SELECT_PAYMENT_CARD') targets = [state.core.handCards.find(card => card.faction === 'ming')!.id];
            if (step.id === 'training-practice' && variation === 'other-train' && state.core.wheelRecruitTrainProgress?.phase === 'choose-training-target' && !usedAlternative) {
                const other = getQidahenWheelRecruitTrainChoices(state.core).find(choice => choice.kind === 'training-target' && choice.id !== targets[0] && choice.pieceId);
                expect(other).toBeDefined(); targets = [other!.id]; usedAlternative = true;
            }
            if (step.id === 'recruit-source') targets = [recruitRegion];
            if (step.id === 'recruit-troops') targets = [recruitChoice];
            const beforeInput = state.core;
            if (command === INTERACTION_COMMANDS.RESPOND) {
                const prompt = getCurrentInteractionSummary(state);
                const data = getCurrentInteractionData<SimpleChoiceData>(state);
                if (!prompt.playerId || !data) throw new Error(`Missing prompt for tutorial step ${step.id}`);
                if (step.id.startsWith('season-upkeep-player-')) {
                    const frame = getQidahenTurnResolutionFrame(state)!.metadata.qidahenTurn;
                    const regionId = frame.upkeepTasks[frame.upkeepIndex].regionId;
                    const special: Record<string, string> = {
                        'city-region-1': 'ming-post-sarhu-1619-datong-regular-infantry-lv1__compat__1',
                        'city-region-18': 'ming-post-sarhu-1619-pyongyang-mercenary-infantry-lv2__compat__1',
                        'city-region-29': 'ming-post-sarhu-1619-hanseong-mercenary-infantry-lv2__compat__1',
                    };
                    const valid = data.options.filter(option => !option.disabled).map(option => option.id);
                    const preferred = special[regionId];
                    const farm = variation === 'remove-farm' && regionId === 'city-region-7'
                        ? state.core.pieces.find(piece => piece.sourceStackId.startsWith('ming-farm-') && piece.regionId === regionId)?.id : undefined;
                    const cards = valid.filter(id => state.core.handCards.some(card => card.id === id));
                    const pieces = valid.filter(id => !cards.includes(id) && id !== 'ming-post-sarhu-1619-liaobei-regular-artillery-lv1__compat__1');
                    targets = farm && valid.includes(farm) ? [farm] : preferred && valid.includes(preferred) ? [preferred]
                        : cards.length && (variation === 'zero-hand' || state.core.factions.ming.handCount > 3) ? [cards[0]] : [pieces[0]];
                } else if (step.id === 'season-chronology-payment') targets = [data.options.find(option => !option.disabled)!.id];
                const response = createRespondToPromptCommand(state, {
                    playerId: prompt.playerId,
                    ...(data.multi ? { optionIds: targets } : { optionId: targets[0] }),
                });
                send(response.type, response.payload, response.playerId);
            } else {
                let payload: Command['payload'] = {};
                if (command === 'EXECUTE_WHEEL_MOVE') payload = { moveId: targets[0] ?? 'move-1-free' };
                else if (command === 'SELECT_REGION') payload = { regionId: targets[0] };
                else if (command === 'CONFIRM_PREVIEW_ACTION') payload = step.id === 'recruit-action' ? { actionId: 'recruit' } : { actionId: 'upgrade-armament', sourceHandCardId: targets[0] };
                else if (command === 'SELECT_PAYMENT_CARD' || command === 'PLAY_TACTIC_CARD') payload = { cardId: targets[0] };
                else if (command === 'RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE') payload = { choiceId: targets[0] };
                send(command, payload);
            }
            if (step.id === 'training-practice' && command === 'RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE') {
                const choice = getQidahenWheelRecruitTrainChoices(beforeInput).find(item => item.id === targets[0]);
                expect(choice, `formal training/recruit choice ${targets[0]}`).toBeDefined();
                if (choice?.kind === 'training-target' && choice.pieceId) {
                    expect(state.core.pieces.find(piece => piece.id === choice.pieceId)?.level).toBe(choice.targetLevel);
                } else if (choice?.kind === 'recruit-target' && choice.regionId) {
                    expect(state.core.regions.find(region => region.id === choice.regionId)!.troops)
                        .toBe(beforeInput.regions.find(region => region.id === choice.regionId)!.troops + 1);
                } else if (choice?.id === 'action:recruit') expect(state.core.wheelRecruitTrainProgress?.phase).toBe('choose-recruit-target');
                else if (choice?.id === 'action:train') expect(state.core.wheelRecruitTrainProgress?.phase).toBe('choose-training-target');
                else if (choice?.id === 'finish') expect(state.core.wheelRecruitTrainProgress).toBeNull();
            }
            if (state.sys.tutorial.pendingAnimationAdvance) send(TUTORIAL_COMMANDS.ANIMATION_COMPLETE);
            if (step.id === 'upgrade-card') {
                expect(state.core.confirmedActionId).toBe('upgrade-armament');
                expect(state.core.selectedHandActionCardId).toBe('deck-ming-4');
                expect(state.core.selectedPaymentCardIds).toEqual(['deck-ming-4']);
                expect(state.core.factionActionUsed).toBe(false);
            }
            if (step.id === 'occupy') {
                expect(state.core.regions.find(region => region.id === 'city-region-7')).toMatchObject({
                    controller: 'ming', diplomacyMarkerFaction: 'ming', diplomacyMarkerSide: 'vassal', controlLabel: '大明附庸',
                });
            }
            if (!step.id.startsWith('season-upkeep-player-') && step.id !== 'season-chronology-payment' && step.id !== 'training-practice')
                expect(state.sys.tutorial.step?.id, `${step.id} did not advance`).not.toBe(step.id);
        }
        expect(visited).toEqual(expect.arrayContaining(['season-upkeep-player-1', 'season-chronology-payment', 'training-practice', 'finish']));
        expect(state.sys.tutorial.active).toBe(false);
        expect(state.core.currentYearIndex).toBe(1);
        if (variation === 'recruit-first' || variation === 'other-train' || variation === 'extra-training') expect(usedAlternative).toBe(true);
        expect(state.core.chronology.claimedCardIds.ming).toEqual([1301]);
        if (variation !== 'recruit-first' && variation !== 'other-train')
            expect(state.core.pieces.find(piece => piece.id === 'ming-post-sarhu-1619-liaobei-regular-artillery-lv1__compat__1')?.level).toBe(variation === 'early-finish' ? 1 : 2);
        expect(state.core.regions.find(region => region.id === 'city-region-7')?.controller).toBe('ming');
        expect(state.sys.resolution).toBeUndefined();
        const currentPlayer = state.core.currentPlayer;
        send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' }, currentPlayer);
        expect(getCurrentInteractionSummary(state).id).toBeDefined();
    });
});
