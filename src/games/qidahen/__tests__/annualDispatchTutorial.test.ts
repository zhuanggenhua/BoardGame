import { describe, expect, it } from 'vitest';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { clearCurrentInteraction, createRespondToPromptCommand, getCurrentInteractionData, getCurrentInteractionSummary, getPromptOptions, injectRawBlockingInteraction } from '../../../engine/testing/interactionTestFacade';
import type { MatchState, RandomFn, TutorialStepSnapshot } from '../../../engine/types';
import { INTERACTION_COMMANDS, type SimpleChoiceData } from '../../../engine/systems/InteractionSystem';
import { createAnnualBattleTutorialSteps, resolveAnnualDispatchTutorialStep, validateAnnualDispatchTutorialStep } from '../annualDispatchTutorial';
import { createInitialCore } from '../domain/initialCoreSetup';
import { QIDAHEN_TURN_RESOLUTION_FRAME, type QidahenTurnResolutionData } from '../domain/turnResolutionTypes';
import { getQidahenDispatchSourcePieces } from '../domain/wheelDispatchDraft';
import type { QidahenCore, QidahenPendingTargetAction, QidahenPostBattleSelection } from '../domain/types';
import { engineConfig } from '../game';
import { QidahenDomain } from '../domain';
import { buildQidahenTutorialSetupData } from '../tutorialSetup';
import { QIDAHEN_BATTLE_ROLLED, type QidahenBattleRolledEvent } from '../domain/battleVisualEvent';

function fixture() {
    const players = ['0', '1', '2'];
    const core = createInitialCore(players, 'post-sarhu-1619', true);
    const data = { step: 'dispatch-source', factionId: 'ming', completedSubactions: [], diplomacyRegionIds: [],
        positionId: 'wheel-dispatch', paymentCardIds: [] } as unknown as QidahenTurnResolutionData;
    const sys = createInitialSystemState(players, engineConfig.systems, 'dispatch-tutorial');
    sys.resolution = { activeFrameId: 'turn', frames: [{ id: 'turn', kind: QIDAHEN_TURN_RESOLUTION_FRAME,
        ordering: 'explicit', status: 'running', metadata: { qidahenTurn: data } }] };
    return { state: { core, sys } as MatchState<QidahenCore>, data };
}

function battle(state: MatchState<QidahenCore>, battleStep: QidahenPendingTargetAction['battleStep'], retreatFactionId?: 'ming' | 'mongol') {
    const pending = { actionId: 'wheel-dispatch', attackerFactionId: 'ming', defenderFactionId: 'mongol',
        targetRegionId: 'city-region-7', targetRuntimeRegionId: 'city-region-7', targetRegionName: '叶赫部',
        sourceRegionId: 'city-region-15', sourceRegionName: '辽北', battleMode: 'field', battleStep, retreatFactionId,
    } as QidahenPendingTargetAction;
    state.core.turnPhase = 'resolve-pending';
    state.core.pendingTargetAction = pending;
    const playerId = battleStep === 'defender-declaration' ? '1' : battleStep === 'retreat' && retreatFactionId === 'mongol' ? '1' : '0';
    const options = battleStep === 'defender-declaration' ? ['defender-fight'] : battleStep === 'retreat' ? ['rear-guard', 'rout'] : ['fight'];
    injectRawBlockingInteraction(state, { id: 'battle-prompt', kind: 'simple-choice', playerId,
        data: { sourceId: 'qidahen:pending-target', options: options.map(id => ({ id })) } });
}

const mapStep = (id: string): TutorialStepSnapshot => ({ id, content: 'old', allowedTargets: ['fixed'],
    advanceOnEvents: [{ type: 'TURN_RESOLUTION_APPLIED', match: { fromStep: id } }] });

describe('年度教程按正式调度和战斗状态分支', () => {
    it('来源、兵牌、目标基于当前候选，允许合法选择及目标页返回重选', () => {
        const { state, data } = fixture();
        const source = resolveAnnualDispatchTutorialStep(state, mapStep('dispatch-source'));
        expect(source.allowedTargets).toBeUndefined();
        expect(source.highlightTarget).toMatch(/^qidahen-map-region-focus-/);
        data.step = 'dispatch-troops'; data.sourceRegionId = 'city-region-15';
        const troops = resolveAnnualDispatchTutorialStep(state, mapStep('dispatch-troops'));
        expect(troops.allowedTargets).toBeUndefined();
        expect(troops.highlightTarget).toBe('qidahen-map-region-focus-city-region-15');
        const back = resolveAnnualDispatchTutorialStep(state, mapStep('dispatch-target'));
        expect(back.content).toContain('dispatch-troops-dynamic');
        expect(back.advanceOnEvents).toBeUndefined();
        expect(validateAnnualDispatchTutorialStep(state, mapStep('dispatch-target'))).toBe(true);
        data.step = 'dispatch-target';
        data.selectedPieceIds = [getQidahenDispatchSourcePieces(state.core, 'ming', 'city-region-15')[0].id];
        const target = resolveAnnualDispatchTutorialStep(state, mapStep('dispatch-target'));
        expect(target.allowedTargets).toBeUndefined();
        expect(target.advanceOnEvents).toBeUndefined();
        expect(target.highlightTarget).toMatch(/^qidahen-map-region-focus-/);
        data.step = 'menu';
        expect(validateAnnualDispatchTutorialStep(state, mapStep('dispatch-target'))).toBe(false);
    });

    it('友方调度或全灭后无战斗状态时跳过战斗与战后步骤', () => {
        const { state } = fixture();
        for (const step of createAnnualBattleTutorialSteps([])) expect(validateAnnualDispatchTutorialStep(state, step), step.id).toBe(false);
    });

    it('对手应战与撤退只响应当前对手真实候选，玩家撤退交给玩家', () => {
        const { state } = fixture();
        const steps = createAnnualBattleTutorialSteps([]);
        const defender = steps.find(step => step.id === 'defender-response')!;
        const opponent = steps.find(step => step.id === 'opponent-retreat')!;
        const player = steps.find(step => step.id === 'player-retreat')!;
        battle(state, 'defender-declaration');
        expect(validateAnnualDispatchTutorialStep(state, defender)).toBe(true);
        expect(resolveAnnualDispatchTutorialStep(state, defender).aiActions?.[0]).toMatchObject({ playerId: '1', payload: { interactionId: 'battle-prompt', optionId: 'defender-fight' } });
        battle(state, 'retreat', 'mongol');
        expect(validateAnnualDispatchTutorialStep(state, opponent)).toBe(true);
        expect(validateAnnualDispatchTutorialStep(state, player)).toBe(false);
        expect(resolveAnnualDispatchTutorialStep(state, opponent).aiActions?.[0]).toMatchObject({ playerId: '1', payload: { optionId: 'rear-guard' } });
        battle(state, 'retreat', 'ming');
        expect(validateAnnualDispatchTutorialStep(state, opponent)).toBe(false);
        expect(validateAnnualDispatchTutorialStep(state, player)).toBe(true);
        expect(resolveAnnualDispatchTutorialStep(state, player).allowedTargets).toBeUndefined();
    });

    it('战术可选且战斗开始后等待动画；战后允许真实占领和撤回选项', () => {
        const { state } = fixture();
        const steps = createAnnualBattleTutorialSteps([]);
        const roll = steps.find(step => step.id === 'battle-roll')!;
        battle(state, 'tactics'); state.core.handCards = [];
        expect(validateAnnualDispatchTutorialStep(state, roll)).toBe(true);
        const resolved = resolveAnnualDispatchTutorialStep(state, roll);
        expect(resolved.allowedCommands).toContain('PLAY_TACTIC_CARD');
        expect(resolved.allowedCommands).toContain(INTERACTION_COMMANDS.RESPOND);
        expect(resolved.waitForAnimation).toBe(true);
        expect(resolved.content).toContain('battle-roll-no-tactic');
        const followup = steps.find(step => step.id === 'battle-roll-followup')!;
        expect(validateAnnualDispatchTutorialStep(state, followup)).toBe(true);
        expect(resolveAnnualDispatchTutorialStep(state, followup).waitForAnimation).toBe(true);
        const post = steps.find(step => step.id === 'occupy')!;
        state.core.turnPhase = 'post-battle-decision'; state.core.pendingTargetAction = null;
        state.core.postBattleSelection = { actionId: 'wheel-dispatch', attackerFactionId: 'ming',
            choices: [{ id: 'occupy', mode: 'occupy' }, { id: 'withdraw', mode: 'withdraw' }] } as QidahenPostBattleSelection;
        clearCurrentInteraction(state);
        expect(validateAnnualDispatchTutorialStep(state, post)).toBe(true);
        expect(resolveAnnualDispatchTutorialStep(state, post).allowedTargets).toBeUndefined();
        expect(post.advanceOnEvents).toBeUndefined();
        // 模式切换、返回以及继续选择都不改变正式战后选择；教程必须保留当前节点。
        for (const choices of [
            [{ id: 'occupy', mode: 'occupy' }],
            [{ id: 'withdraw', mode: 'withdraw' }],
            [{ id: 'plunder', mode: 'occupy' }, { id: 'withdraw', mode: 'withdraw' }],
        ]) {
            state.core.postBattleSelection!.choices = choices as QidahenPostBattleSelection['choices'];
            expect(validateAnnualDispatchTutorialStep(state, post)).toBe(true);
        }
        state.core.postBattleSelection = null; state.core.turnPhase = 'action-window';
        expect(validateAnnualDispatchTutorialStep(state, post)).toBe(false);
    });
});

it.each(['friendly', 'enemy', 'destroyed', 'no-dice', 'legacy-destroyed', 'legacy-no-dice', 'win'] as const)('真实管线从目标页返回重选部队，再处理 %s 目标', mode => {
    const players = ['0', '1', '2'];
    let diceCalls = 0;
    const random: RandomFn = { random: () => 0, d: sides => { diceCalls++; return mode.includes('destroyed') ? sides : 1; }, range: min => min, shuffle: cards => [...cards] };
    let state: MatchState<QidahenCore> = { core: QidahenDomain.setup(players, random, buildQidahenTutorialSetupData('basic-opening')!.setupData),
        sys: createInitialSystemState(players, engineConfig.systems, 'annual-dispatch-pipeline') };
    let lastEvents: Array<{ type: string; payload?: unknown }> = [];
    const send = (type: string, payload: object, playerId = state.core.currentPlayer, skipValidation = false) => {
        const result = executePipeline({ domain: QidahenDomain, systems: engineConfig.systems }, state,
            { type, playerId, payload, timestamp: 100, skipValidation } as never, random, players);
        expect(result.success, `${type}: ${JSON.stringify(result.error)}`).toBe(true);
        lastEvents = result.events;
        state = result.state;
    };
    const choose = (choice: string | string[]) => {
        const summary = getCurrentInteractionSummary(state);
        const data = getCurrentInteractionData<SimpleChoiceData>(state)!;
        const ids = Array.isArray(choice) ? choice : [choice];
        const command = createRespondToPromptCommand(state, { playerId: summary.playerId!,
            ...(data.multi ? { optionIds: ids } : { optionId: ids[0] }) });
        send(command.type, command.payload as object, command.playerId);
    };
    const emptyTurn = () => { send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' }); choose('finish-slot'); choose('skip-hand'); };
    emptyTurn(); emptyTurn();
    send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' });
    choose('military-farm'); choose('city-region-15'); choose('reclaim'); choose(['city-region-15-liaodong']);
    choose('hand-action:recruit');
    const card = state.core.handCards.find(item => item.faction === 'ming' && item.cardKind === 'silver')!;
    send('SELECT_PAYMENT_CARD', { cardId: card.id }); send('EXECUTE_SELECTED_ACTION', {});
    send('SELECT_REGION', { regionId: 'city-region-15' }); choose('level-2-troops'); choose('finish-slot');
    emptyTurn(); emptyTurn();
    if (state.core.handLimitDiscardSelection) {
        const limit = state.core.handLimitDiscardSelection;
        choose(limit.candidateCardIds.slice(0, limit.requiredDiscardCount));
    }
    send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' }); choose('dispatch');
    choose(getPromptOptions(state)[0].id); choose('city-region-15');
    const pieces = getQidahenDispatchSourcePieces(state.core, 'ming', 'city-region-15');
    const chosenPieces = mode === 'win'
        ? ['cavalry', 'infantry', 'artillery'].map(kind => pieces.find(piece => piece.troopKind === kind)!)
        : [mode.includes('no-dice') ? pieces.find(piece => piece.troopKind === 'artillery')! : pieces[0]];
    choose(chosenPieces.map(piece => piece.id));
    const target: TutorialStepSnapshot = { id: 'dispatch-target', content: 'target', requireAction: true, allowedCommands: [INTERACTION_COMMANDS.RESPOND] };
    const manifest = { id: 'dispatch-pipeline-test', steps: [target, ...createAnnualBattleTutorialSteps([]), { id: 'done', content: 'done', infoStep: true }],
        stepValidator: (match: MatchState<unknown>, step: TutorialStepSnapshot) => validateAnnualDispatchTutorialStep(match as MatchState<QidahenCore>, step) ?? true,
        resolveStep: (match: MatchState<unknown>, step: TutorialStepSnapshot) => resolveAnnualDispatchTutorialStep(match as MatchState<QidahenCore>, step) };
    send('SYS_TUTORIAL_START', { manifest }, '0');
    choose('back');
    expect(state.sys.tutorial.step?.id).toBe('dispatch-target');
    expect(state.sys.tutorial.step?.content).toContain('dispatch-troops-dynamic');
    choose(chosenPieces.map(piece => piece.id));
    expect(state.sys.tutorial.step?.content).toContain('dispatch-target-dynamic');
    const targetId = mode === 'friendly' ? 'city-region-15-liaodong' : 'city-region-7';
    expect(getPromptOptions(state).map(option => option.id)).toContain(targetId);
    choose(targetId);
    if (mode === 'friendly') {
        expect(state.core.pendingTargetAction).toBeNull();
        expect(state.core.postBattleSelection).toBeNull();
        expect(state.sys.tutorial.step?.id).toBe('done');
    } else {
        expect(state.core.pendingTargetAction?.battleStep).toBe('defender-declaration');
        expect(state.sys.tutorial.step?.id).toBe('defender-response');
        const ai = state.sys.tutorial.step!.aiActions![0];
        send(ai.commandType, ai.payload as object, ai.playerId, true);
        send('SYS_TUTORIAL_AI_CONSUMED', { stepId: 'defender-response' }, '0');
        send('SYS_TUTORIAL_NEXT', {}, '0');
        expect(state.sys.tutorial.step?.id).toBe('battle-roll');
        const beforeDice = diceCalls;
        if (mode.startsWith('legacy-')) send('RESOLVE_PENDING_ACTION', {}, '0');
        else choose('fight');
        const rollEvents = lastEvents.filter(event => event.type === QIDAHEN_BATTLE_ROLLED) as QidahenBattleRolledEvent[];
        expect(rollEvents).toHaveLength(1);
        expect(rollEvents[0].payload.report.targetRuntimeRegionId).toBe(targetId);
        expect(rollEvents[0].payload.report.battlefield?.pieces.map(piece => piece.id)).toEqual(expect.arrayContaining(chosenPieces.map(piece => piece.id)));
        expect(rollEvents[0].payload.report.battlefield?.mapTokens.map(token => token.pieceId)).toEqual(expect.arrayContaining(chosenPieces.map(piece => piece.id)));
        expect(JSON.stringify(rollEvents[0].payload.report)).not.toContain('handCards');
        if (mode.includes('no-dice')) expect(rollEvents[0].payload.report.rolls.stages).toHaveLength(0);
        else expect(rollEvents[0].payload.report.rolls.stages.length).toBeGreaterThan(0);
        const actualRollCount = rollEvents[0].payload.report.rolls.stages.reduce((sum, stage) => sum + stage.attackerRolls.length + stage.defenderRolls.length, 0);
        expect(diceCalls - beforeDice).toBe(actualRollCount);
        const retained = state.core.pendingTargetAction?.resolvedBattleRolls ?? state.core.postBattleSelection?.battleRolls;
        if (retained) {
            expect(rollEvents[0].payload.report.rolls).toEqual(retained);
            expect(state.core.pendingTargetAction?.battleReport ?? state.core.postBattleSelection?.battleReport).toEqual(rollEvents[0].payload.report);
        }
        expect(state.sys.eventStream.entries.some(entry => entry.event.type === QIDAHEN_BATTLE_ROLLED)).toBe(true);
        expect(state.sys.tutorial.pendingAnimationAdvance).toBe(true);
        if (mode === 'destroyed') {
            const current = getCurrentInteractionSummary(state);
            const options = getPromptOptions(state);
            expect(options.map(option => option.id)).toContain('finish-slot');
            const premature = createRespondToPromptCommand(state, { playerId: current.playerId!, optionId: 'finish-slot' });
            const rejected = executePipeline({ domain: QidahenDomain, systems: engineConfig.systems }, state,
                premature as never, random, players);
            expect(rejected.success).toBe(false);
            expect(rejected.state.core.lastSeasonSummary?.battleReport).toEqual(rollEvents[0].payload.report);
        }
        // 此处只验证教程状态机的动画完成事件，真实动画另由浏览器录制验收。
        send('SYS_TUTORIAL_ANIMATION_COMPLETE', {}, '0');
        const pending = state.core.pendingTargetAction;
        if (mode.includes('destroyed') || mode.includes('no-dice')) {
            expect(pending).toBeNull();
            expect(state.core.postBattleSelection).toBeNull();
            expect(state.core.lastSeasonSummary?.battleReport).toEqual(rollEvents[0].payload.report);
            expect(state.sys.tutorial.step?.id).toBe('done');
            if (mode === 'destroyed') {
                send('SYS_TUTORIAL_CLOSE', {}, '0');
                choose('finish-slot');
                choose('skip-hand');
                expect(state.core.lastSeasonSummary?.battleReport).toEqual(rollEvents[0].payload.report);
                send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' });
                expect(state.core.lastSeasonSummary?.battleReport).toBeUndefined();
            }
            return;
        }
        if (mode === 'win') {
            expect(pending?.battleStep).toBe('retreat'); expect(pending?.retreatFactionId).toBe('mongol');
            expect(state.sys.tutorial.step?.id).toBe('opponent-retreat');
            const action = state.sys.tutorial.step!.aiActions![0];
            send(action.commandType, action.payload as object, action.playerId, true);
            send('SYS_TUTORIAL_AI_CONSUMED', { stepId: 'opponent-retreat' }, '0');
            send('SYS_TUTORIAL_NEXT', {}, '0');
            expect(state.sys.tutorial.step?.id).toBe('occupy');
            const withdraw = state.core.postBattleSelection!.choices.find(choice => choice.mode === 'withdraw');
            expect(withdraw).toBeDefined();
            const before = state.core.regions.find(region => region.id === targetId)!.controller;
            choose(withdraw!.id);
            expect(state.core.regions.find(region => region.id === targetId)!.controller).toBe(before);
            expect(state.sys.tutorial.step?.id).toBe('done');
            return;
        }
        expect(pending?.battleStep).toBe('retreat'); expect(pending?.retreatFactionId).toBe('ming');
        if (pending?.battleStep === 'retreat') {
            expect(state.sys.tutorial.step?.id).toBe(pending.retreatFactionId === 'ming' ? 'player-retreat' : 'opponent-retreat');
            if (pending.retreatFactionId === 'ming') {
                const ownerBefore = state.core.regions.find(region => region.id === targetId)!.controller;
                choose('rear-guard');
                expect(state.core.regions.find(region => region.id === targetId)!.controller).toBe(ownerBefore);
                expect(state.sys.tutorial.step?.id).toBe('done');
            }
        } else if (state.core.postBattleSelection) expect(state.sys.tutorial.step?.id).toBe('occupy');
        else expect(state.sys.tutorial.step?.id).toBe('done');
    }
});
