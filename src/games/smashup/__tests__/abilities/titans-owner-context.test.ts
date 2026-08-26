import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, collectTriggers } from '../../domain/ongoingEffects';
import { maybeResolveReactionQueue } from '../../domain/reactionQueue';
import { defaultTestRandom, runCommand } from '../testRunner';
import {
    getReactionPromptOptionBySourceDefId,
    getSimpleChoicePrompt,
    makeBase,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondCommand,
} from '../helpers';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

describe('Titans queued source-controller runtime context', () => {
    it('mega_troopers_megabot 在对手计分前仍应把 queued beforeScoring 选择权交给泰坦控制者', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [makeMinion('scoring-minion-1', 'robot_microbot_alpha', '0', 3)],
                    ongoingActions: [],
                }),
                makeBase({
                    defId: 'base_b',
                    minions: [makeMinion('ally-1', 'ghosts_spectre', '1', 2)],
                    ongoingActions: [],
                }),
            ],
            titans: [{
                uid: 't-megabot-1',
                defId: 'mega_troopers_megabot',
                ownerId: '1',
                controllerId: '1',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
                basePower: 5,
            }],
        });

        const queued = collectTriggers(core, 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 10, vp: 1 }],
            random: defaultTestRandom,
            now: 5101,
        });

        expect(queued).toBeDefined();
        const megabotTrigger = (queued as any).payload.triggers.find((trigger: any) => trigger.sourceCardUid === 't-megabot-1');
        expect(megabotTrigger).toBeDefined();
        expect(megabotTrigger.ownerPlayerId).toBe('1');

        const queuedState = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers }),
            defaultTestRandom,
            5101,
        );
        expect(queuedState).toBeDefined();
        expect(getSimpleChoicePrompt(queuedState!.state, 'titan_mega_troopers_megabot_move')?.playerId).toBe('1');
    });

    it('sphinx 在对手计分后仍应把 queued afterScoring 选择权交给泰坦控制者', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [makeMinion('scoring-minion-2', 'robot_microbot_alpha', '0', 3)],
                    buriedCards: [{ uid: 'buried-1', defId: 'ghosts_spectre', type: 'minion', owner: '1', controllerId: '1' } as any],
                    ongoingActions: [],
                }),
            ],
            titans: [{
                uid: 't-sphinx-1',
                defId: 'sphinx',
                ownerId: '1',
                controllerId: '1',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                basePower: 5,
            }],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 10, vp: 1 }],
            random: defaultTestRandom,
            now: 5102,
        });

        expect(queued).toBeDefined();
        const trigger = (queued as any).payload.triggers.find((entry: any) => entry.sourceDefId === 'sphinx');
        expect(trigger).toBeDefined();
        expect(trigger.ownerPlayerId).toBe('1');

        const queuedState = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers }),
            defaultTestRandom,
            5102,
        );
        expect(queuedState).toBeDefined();
        expect(getSimpleChoicePrompt(queuedState!.state, 'titan_sphinx_after_scoring')?.playerId).toBe('1');
    });

    it('pirates_the_kraken 在对手计分后仍应把 queued afterScoring 选择权交给泰坦控制者', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('kraken-own-1', 'ghosts_spectre', '1', 2),
                        makeMinion('scoring-minion-3', 'robot_microbot_alpha', '0', 3),
                    ],
                    ongoingActions: [],
                }),
                makeBase({
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                }),
            ],
            titans: [{
                uid: 't-kraken-1',
                defId: 'pirates_the_kraken',
                ownerId: '1',
                controllerId: '1',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                basePower: 5,
            }],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 10, vp: 1 }],
            random: defaultTestRandom,
            now: 5103,
        });

        expect(queued).toBeDefined();
        const trigger = (queued as any).payload.triggers.find((entry: any) => entry.sourceDefId === 'pirates_the_kraken');
        expect(trigger).toBeDefined();
        expect(trigger.ownerPlayerId).toBe('1');

        const queuedState = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers }),
            defaultTestRandom,
            5103,
        );
        expect(queuedState).toBeDefined();
        const reactionPrompt = getSimpleChoicePrompt(queuedState!.state, 'smashup_reaction_choose');
        expect(reactionPrompt.playerId).toBe('1');

        const krakenOption = getReactionPromptOptionBySourceDefId(
            queuedState!.state,
            reactionPrompt,
            'pirates_the_kraken',
        );
        const afterChooseKraken = runCommand(
            queuedState!.state,
            respondCommand(krakenOption.id, '1'),
            defaultTestRandom,
        );
        expect(afterChooseKraken.success, afterChooseKraken.error).toBe(true);

        expect(getSimpleChoicePrompt(afterChooseKraken.finalState, 'titan_pirates_the_kraken_choose_minion')?.playerId).toBe('1');
    });
});
