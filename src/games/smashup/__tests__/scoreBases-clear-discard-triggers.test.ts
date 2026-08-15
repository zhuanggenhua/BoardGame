import { beforeEach, describe, expect, it } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { createInitialSystemState } from '../../../engine/pipeline';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { SmashUpDomain, smashUpSystemsForTest } from '../game';
import { registerTrigger } from '../domain/ongoingEffects';
import { SU_EVENTS, type SmashUpCommand, type SmashUpCore, type SmashUpEvent } from '../domain/types';
import {
    expectNoPrompt,
    getPromptOption,
    getSimpleChoicePrompt,
    makeBase,
    makeMinion,
} from './helpers';

const PLAYER_IDS: PlayerId[] = ['0', '1'];

function queuedDiscardTriggers(events: readonly { type: string; payload: unknown }[]) {
    return events
        .filter((event): event is SmashUpEvent & { payload: { triggers?: Array<Record<string, unknown>> } } =>
            event.type === SU_EVENTS.TRIGGER_QUEUED
        )
        .flatMap(event => event.payload.triggers ?? [])
        .filter(trigger => trigger.timing === 'onMinionDiscardedFromBase');
}

function feedbackEvents(events: readonly { type: string; payload: unknown }[], message = 'test.first_mate_was_discarded_from_base') {
    return events.filter(event =>
        event.type === SU_EVENTS.ABILITY_FEEDBACK
        && (event as any).payload?.message === message
    );
}

function createRunner(options: { includeFirstMate?: boolean } = {}): GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent> {
    const includeFirstMate = options.includeFirstMate ?? true;
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems: smashUpSystemsForTest,
        playerIds: PLAYER_IDS,
        setup: (ids: PlayerId[], random: RandomFn): MatchState<SmashUpCore> => {
            const core = SmashUpDomain.setup(ids, random);
            const sys = createInitialSystemState(ids, smashUpSystemsForTest, undefined);
            core.factionSelection = undefined;
            core.currentPlayerIndex = 0;
            core.turnOrder = [...PLAYER_IDS];
            sys.phase = 'playCards';
            const minions = [
                ...(includeFirstMate ? [makeMinion('mate-1', 'pirate_first_mate', '0', 2)] : []),
                makeMinion('scorer-1', 'robot_warbot', '0', 30),
            ];
            core.bases = [
                makeBase('base_the_homeworld', minions),
                makeBase('base_the_jungle', []),
            ];
            core.baseDeck = ['base_central_brain'];
            core.players['0'].hand = [];
            core.players['1'].hand = [];
            return { core, sys };
        },
    });
}

function registerFirstMateDiscardWatcher() {
    registerTrigger('pirate_first_mate', 'onMinionDiscardedFromBase', (ctx) => ([{
        type: SU_EVENTS.ABILITY_FEEDBACK,
        payload: {
            playerId: ctx.playerId,
            sourceDefId: 'test_first_mate_discard_watcher',
            message: 'test.first_mate_was_discarded_from_base',
        },
        timestamp: ctx.now,
    } as SmashUpEvent]), {
        mandatory: true,
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
}

function registerWarbotDiscardWatcher() {
    registerTrigger('robot_warbot', 'onMinionDiscardedFromBase', (ctx) => ([{
        type: SU_EVENTS.ABILITY_FEEDBACK,
        payload: {
            playerId: ctx.playerId,
            sourceDefId: 'test_warbot_discard_watcher',
            message: 'test.warbot_was_discarded_from_base',
        },
        timestamp: ctx.now,
    } as SmashUpEvent]), {
        mandatory: true,
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
}

function resolveCurrentOption(
    runner: GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>,
    optionId: string,
    playerId = '0',
) {
    const result = runner.resolveInteraction(playerId, { optionId });
    expect(result.success, result.error).toBe(true);
    return result;
}

function advanceScoreBasesFinalizeIfNeeded(
    runner: GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>,
) {
    const state = runner.getState();
    if (state.sys.phase !== 'scoreBases' || state.sys.interaction?.current) {
        return { events: [] as SmashUpEvent[] };
    }
    const playerId = state.core.turnOrder[state.core.currentPlayerIndex]!;
    const result = runner.dispatch('ADVANCE_PHASE', { playerId });
    expect(result.success, result.error).toBe(true);
    return result;
}

describe('scoreBases 清场弃牌触发时序', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
        registerFirstMateDiscardWatcher();
    });

    it('BASE_SCORED 后不应预测 First Mate 会被清场弃掉', () => {
        const runner = createRunner();

        const advance = runner.dispatch('ADVANCE_PHASE', { playerId: '0', timestamp: 1 });

        expect(advance.success, advance.error).toBe(true);
        expect(advance.events.some(event => event.type === SU_EVENTS.BASE_SCORED)).toBe(true);
        expect(advance.events.some(event => event.type === SU_EVENTS.BASE_CLEARED)).toBe(false);
        expect(queuedDiscardTriggers(advance.events)
            .filter(trigger => trigger.triggerMinionUid === 'mate-1')).toHaveLength(0);
        expect(feedbackEvents(advance.events)).toHaveLength(0);
    });

    it('First Mate 在 After Scoring 移走后，不应收到原基地清场弃牌触发', () => {
        const runner = createRunner();
        const allEvents: Array<{ type: string; payload: unknown }> = [];

        const advance = runner.dispatch('ADVANCE_PHASE', { playerId: '0', timestamp: 1 });
        expect(advance.success, advance.error).toBe(true);
        allEvents.push(...advance.events);

        const firstMatePrompt = getSimpleChoicePrompt(runner.getState(), 'pirate_first_mate_choose_base');
        const moveMateOption = getPromptOption(
            firstMatePrompt,
            (option: any) => option.value?.baseIndex === 1,
            'first mate destination option',
        );
        allEvents.push(...resolveCurrentOption(runner, moveMateOption.id).events);
        allEvents.push(...advanceScoreBasesFinalizeIfNeeded(runner).events);

        const state = runner.getState();
        expectNoPrompt(state);
        expect(state.core.bases[0].minions.map(minion => minion.uid)).not.toContain('mate-1');
        expect(state.core.bases[1].minions.map(minion => minion.uid)).toContain('mate-1');
        expect(state.core.players['0'].discard.map(card => card.uid)).not.toContain('mate-1');
        expect(queuedDiscardTriggers(allEvents)
            .filter(trigger => trigger.triggerMinionUid === 'mate-1')).toHaveLength(0);
        expect(feedbackEvents(allEvents)).toHaveLength(0);
    });

    it('实际被 BASE_CLEARED 清场弃掉的随从，应在清场事实之后产生弃牌触发', () => {
        registerWarbotDiscardWatcher();
        const runner = createRunner({ includeFirstMate: false });
        const allEvents: Array<{ type: string; payload: unknown }> = [];

        const advance = runner.dispatch('ADVANCE_PHASE', { playerId: '0', timestamp: 1 });
        allEvents.push(...advance.events);
        if (!advance.events.some(event => event.type === SU_EVENTS.BASE_CLEARED)) {
            allEvents.push(...advanceScoreBasesFinalizeIfNeeded(runner).events);
        }

        expect(advance.success, advance.error).toBe(true);
        const baseClearedIndex = allEvents.findIndex(event => event.type === SU_EVENTS.BASE_CLEARED);
        expect(baseClearedIndex).toBeGreaterThanOrEqual(0);
        const warbotDiscardTriggerIndex = allEvents.findIndex(event =>
            event.type === SU_EVENTS.TRIGGER_QUEUED
            && queuedDiscardTriggers([event])
                .some(trigger => trigger.triggerMinionUid === 'scorer-1')
        );
        expect(warbotDiscardTriggerIndex).toBeGreaterThan(baseClearedIndex);
        expect(feedbackEvents(allEvents, 'test.warbot_was_discarded_from_base')).toHaveLength(1);
    });
});
