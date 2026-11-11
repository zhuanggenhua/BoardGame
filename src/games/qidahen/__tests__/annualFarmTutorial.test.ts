import { describe, expect, it } from 'vitest';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { createRespondToPromptCommand, getCurrentInteractionData, getCurrentInteractionSummary, getPromptOptions } from '../../../engine/testing/interactionTestFacade';
import type { MatchState, RandomFn, TutorialStepSnapshot } from '../../../engine/types';
import type { SimpleChoiceData } from '../../../engine/systems/InteractionSystem';
import { createAnnualFarmTutorialStep, getAnnualFarmPhase, resolveAnnualFarmTutorialStep, validateAnnualFarmTutorialStep } from '../annualFarmTutorial';
import { QidahenDomain } from '../domain';
import type { QidahenCore } from '../domain/types';
import { engineConfig } from '../game';
import { buildQidahenTutorialSetupData } from '../tutorialSetup';
import { getQidahenEffectiveTotalPopulation } from '../domain/populationRules';

const players = ['0', '1', '2'];
const random: RandomFn = { random: () => 0, d: () => 1, range: min => min, shuffle: cards => [...cards] };

function opening() {
    let state: MatchState<QidahenCore> = { core: QidahenDomain.setup(players, random, buildQidahenTutorialSetupData('basic-opening')!.setupData),
        sys: createInitialSystemState(players, engineConfig.systems, 'annual-farm-pipeline') };
    const send = (type: string, payload: object, playerId = state.core.currentPlayer) => {
        const result = executePipeline({ domain: QidahenDomain, systems: engineConfig.systems }, state,
            { type, payload, playerId, timestamp: 100 } as never, random, players);
        expect(result.success, `${type}: ${JSON.stringify(result.error)}`).toBe(true);
        state = result.state;
    };
    const choose = (choice: string | string[]) => {
        const current = getCurrentInteractionSummary(state);
        const data = getCurrentInteractionData<SimpleChoiceData>(state)!;
        const ids = Array.isArray(choice) ? choice : [choice];
        const command = createRespondToPromptCommand(state, { playerId: current.playerId!,
            ...(data.multi ? { optionIds: ids } : { optionId: ids[0] }) });
        send(command.type, command.payload as object, command.playerId);
    };
    const emptyTurn = () => { send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' }); choose('finish-slot'); choose('skip-hand'); };
    emptyTurn(); emptyTurn();
    send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' });
    const step = createAnnualFarmTutorialStep([]);
    const manifest = { id: 'annual-farm-test', steps: [step, { id: 'done', content: 'done', infoStep: true }],
        stepValidator: (match: MatchState<unknown>, item: TutorialStepSnapshot) => validateAnnualFarmTutorialStep(match as MatchState<QidahenCore>, item) ?? true,
        resolveStep: (match: MatchState<unknown>, item: TutorialStepSnapshot) => resolveAnnualFarmTutorialStep(match as MatchState<QidahenCore>, item) };
    send('SYS_TUTORIAL_START', { manifest }, '0');
    return { get state() { return state; }, send, choose, options: () => getPromptOptions(state).filter(item => !item.disabled).map(item => item.id) };
}

describe('首回合开垦军屯遵循正式局面', () => {
    it('军屯每个真实候选可执行，推荐目标不限制其余地区', () => {
        const probe = opening(); probe.choose('military-farm');
        const legal = probe.options();
        expect(legal.length).toBeGreaterThan(1);
        for (const target of legal) {
            const run = opening(); run.choose('military-farm');
            const step = run.state.sys.tutorial.step!;
            expect(step.allowedTargets).toBeUndefined();
            expect(getAnnualFarmPhase(run.state)).toBe('farm-target');
            const before = run.state.core.regions.find(region => region.id === target)!;
            const beforeHand = run.state.core.factions.ming.handCount;
            run.choose(target);
            const after = run.state.core.regions.find(region => region.id === target)!;
            expect(after.troops + (after.cityState?.troops ?? 0)).toBe(before.troops + (before.cityState?.troops ?? 0) + 1);
            expect(run.state.core.factions.ming.handCount).toBe(beforeHand + 2);
            expect(getAnnualFarmPhase(run.state)).toBe('menu');
            expect(run.state.sys.tutorial.step?.id).toBe('opening-farm-cycle');
            expect(run.state.sys.tutorial.step?.content).toContain('farm-menu-after-farm');
        }
    });

    it.each([0, 1, 2, 3, 4, 5])('开垦选 %i 个合法地区按实际选项结算', count => {
        const run = opening(); run.choose('reclaim');
        const candidates = run.options();
        expect(candidates.length).toBeGreaterThanOrEqual(5);
        expect(run.state.sys.tutorial.step?.allowedTargets).toBeUndefined();
        const selected = candidates.slice(0, count);
        const before = new Map(run.state.core.regions.map(region => [region.id, region.population]));
        run.choose(selected);
        for (const id of candidates) expect(run.state.core.regions.find(region => region.id === id)!.population).toBe(before.get(id)! + (selected.includes(id) ? 1 : 0));
        expect(getAnnualFarmPhase(run.state)).toBe('menu');
        expect(run.state.sys.tutorial.step?.content).toContain('farm-menu-after-reclaim');
    });

    it('允许先结束轮盘、再按真实手牌窗口继续', () => {
        const run = opening();
        expect(run.state.sys.tutorial.step?.allowedTargets).toBeUndefined();
        run.choose('finish-slot');
        expect(getAnnualFarmPhase(run.state)).toBe('finish-hand');
        expect(run.state.sys.tutorial.step?.content).toContain('farm-hand-menu-dynamic');
        run.choose('skip-hand');
        expect(getAnnualFarmPhase(run.state)).toBeNull();
        expect(run.state.sys.tutorial.step?.id).toBe('done');
    });

    it('选择手牌行动时保留真实 await-hand，不显示军屯结果或限制该行动', () => {
        const run = opening(); run.choose('hand-action:recruit');
        expect(getAnnualFarmPhase(run.state)).toBe('await-hand');
        expect(run.state.sys.tutorial.step?.hideOverlay).toBe(true);
        expect(run.state.sys.tutorial.step?.allowedCommands).toBeUndefined();
        expect(run.state.sys.tutorial.step?.id).toBe('opening-farm-cycle');
        const card = run.state.core.handCards.find(item => item.faction === 'ming' && item.cardKind === 'silver')!;
        run.send('SELECT_PAYMENT_CARD', { cardId: card.id });
        run.send('EXECUTE_SELECTED_ACTION', {});
        expect(getAnnualFarmPhase(run.state)).toBe('await-hand');
        expect(run.state.core.recruitSelection).not.toBeNull();
        run.send('SELECT_REGION', { regionId: 'city-region-15' });
        run.choose('level-2-troops');
        expect(getAnnualFarmPhase(run.state)).toBe('menu');
        expect(run.state.sys.tutorial.step?.content).toContain('farm-menu-initial');
        expect(run.options()).toContain('military-farm');
    });

    it('开垦跨越人口与驻军门槛时，后续年中税赋跟随真实区域变化', () => {
        const probe = opening(); probe.choose('reclaim');
        const target = probe.options().find(id => {
            const region = probe.state.core.regions.find(item => item.id === id)!;
            return getQidahenEffectiveTotalPopulation(region) === region.troops + (region.cityState?.troops ?? 0);
        });
        expect(target).toBeDefined();
        const runToMidyear = (selected: string[]) => {
            const run = opening(); run.choose('reclaim'); run.choose(selected);
            run.choose('finish-slot'); run.choose('skip-hand'); run.send('SYS_TUTORIAL_CLOSE', {}, '0');
            for (let turn = 0; turn < 2; turn++) {
                run.send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' });
                run.choose('finish-slot'); run.choose('skip-hand');
            }
            return run.state.core.factions.ming.landTax;
        };
        expect(runToMidyear([target!])).toBe(runToMidyear([]) + 1);
    });
});
