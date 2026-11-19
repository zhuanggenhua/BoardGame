import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createInitialLocalProviderState, createLocalProviderRandom } from '../../../engine/transport/localProviderBootstrap';
import type { GameEngineConfig } from '../../../engine/transport/engineConfig';
import { TUTORIAL_COMMANDS as tutorial } from '../../../engine/systems/TutorialSystem';
import { FLOW_COMMANDS } from '../../../engine/systems/FlowSystem';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import type { MatchState } from '../../../engine/types';
import { isTutorialFreePlay } from '../../../engine/tutorialStepPlan';
import { engineConfig } from '../game';
import MageWarsTutorialCatalog, { MageWarsTutorial, getMageWarsTutorialPlan } from '../tutorial';
import { buildMageWarsTutorialSetupData, MAGE_WARS_TUTORIAL_WOLF as wolf, MAGE_WARS_TUTORIAL_UNICORN as unicorn } from '../tutorialStart';
import { getPromptInteractionId, getPromptOptions, runCommand } from './helpers/domainFlowHarness';
import { MAGE_WARS_COMMANDS as mw, MAGE_WARS_EVENTS, type MageWarsCommand, type MageWarsCore } from '../domain';
import { MAGE_WARS_OBJECT_ABILITY_IDS } from '../domain/ids';

const secondWolf = 'mwobj-0-2819-2';
const wand = 'mwobj-0-3725-1';
const lair = 'mwobj-0-2218-1';
const cast = (spellCardId: number, manaCost: number, target: Record<string, unknown>) => (
    [mw.CAST_SPELL, { spellCardId, manaCost, ...target }] as const
);
const move = (toZoneId: string) => [mw.MOVE_MAGE, { toZoneId }] as const;
const moveObject = (objectId: string, toZoneId: string) => [mw.MOVE_ARENA_OBJECT, { objectId, toZoneId }] as const;
const playerActions: Record<string, readonly [string, Record<string, unknown>]> = {
    'guard-wolf': [mw.GUARD, { objectId: wolf }],
    'heal-wolf': cast(3402, 5, { targetObjectId: wolf }),
    'pursue-unicorn': moveObject(wolf, 'a2'),
    'bite-unicorn': [mw.DECLARE_OBJECT_ATTACK, { attackerObjectId: wolf, attackProfileId: 'attack-0', targetObjectId: unicorn }],
    'summon-second-wolf': cast(2819, 9, { targetZoneId: 'a3' }),
    'rouse-second-wolf': cast(3403, 2, { targetObjectId: secondWolf }),
    'move-new-wolf': moveObject(secondWolf, 'b3'),
    'move-for-wall': move('a2'),
    'place-wall': cast(25700, 5, { targetWallEdgeId: 'b1-b2' }),
    'move-for-push': move('a1'),
    'push-through-wall': cast(3425, 6, { targetPlayerId: '1', pushToZoneId: 'b2' }),
    'set-ward': cast(1901, 2, { targetObjectId: wolf }),
    'equip-armor': cast(3711, 6, { targetPlayerId: '0' }),
    'approach-cleric': move('a2'),
    'cast-fountain': cast(1710, 4, { targetObjectId: 'mwobj-1-2811-1' }),
    'bind-wand': cast(3725, 5, { targetPlayerId: '0', boundSpellCardId: 3408 }),
    'rebind-wand': [mw.USE_ARENA_OBJECT_ABILITY, {
        objectId: wand, abilityId: MAGE_WARS_OBJECT_ABILITY_IDS.MAGE_STAFF_BIND, manaCost: 3, boundSpellCardId: 3402,
    }],
    'place-lair': cast(2218, 15, { targetZoneId: 'a2' }),
    'plan-lair-fox': [mw.PLAN_OBJECT_SPELL, { objectId: lair, spellCardId: 2812 }],
    'deploy-fox': cast(2812, 5, { casterObjectId: lair, targetZoneId: 'a2' }),
    'cast-bound-heal': cast(3402, 5, { targetObjectId: wolf }),
    'grant-wolf-defense': cast(1809, 7, { targetObjectId: wolf }),
    'approach-priestess': move('b2'),
};

function loadMatch() {
    const random = createLocalProviderRandom('mage-wars-single-match-course');
    let state = createInitialLocalProviderState({
        config: engineConfig as GameEngineConfig,
        setupContext: { mode: 'tutorial' },
        setupPlayerIds: ['0', '1'],
        setupData: buildMageWarsTutorialSetupData(),
        initialRandom: random,
        aiSeatIds: [],
        persistedState: null,
    }) as MatchState<MageWarsCore>;
    const submit = (type: string, payload: unknown = {}, playerId = '0') => {
        const context = `${state.core.turnNumber}/${state.sys.phase} ${state.sys.tutorial.step?.id} ${type} by ${playerId}`;
        const result = runCommand(state, { type, playerId, payload } as MageWarsCommand, random);
        expect(result.success, `${context}: ${result.error ?? ''}`).toBe(true);
        state = result.state;
        return result.events;
    };
    submit(tutorial.START, { manifest: MageWarsTutorial });
    return { get state() { return state; }, submit };
}

describe('Mage Wars single-match tutorial', () => {
    it('exposes one localized tutorial with distinct step ids', () => {
        expect(MageWarsTutorialCatalog.defaultTutorialId).toBe('mage-wars-basic');
        expect(Object.keys(MageWarsTutorialCatalog.tutorials)).toEqual(['mage-wars-basic']);
        expect(MageWarsTutorial.playerId).toBe('0');
        const ids = MageWarsTutorial.steps.map(({ id }) => id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const locale of ['zh-CN', 'en']) {
            const resources = JSON.parse(readFileSync(`public/locales/${locale}/game-mage-wars.json`, 'utf8'));
            for (const step of MageWarsTutorial.steps) {
                const content = step.content.split('.').at(-1)!;
                expect(resources.tutorial.singleMatch[content], `${locale} ${step.id}`).toBeTruthy();
            }
        }
    });

    it('waits on the healing effect and restores the fifth-round guard state on previous', () => {
        const match = loadMatch();
        const original = match.state.core;
        match.submit(mw.GUARD, { objectId: wolf });
        const events = match.submit(mw.CAST_SPELL, { spellCardId: 3402, manaCost: 5, targetObjectId: wolf });
        expect(events).toContainEqual(expect.objectContaining({
            type: MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED,
            payload: expect.objectContaining({ healing: 4, actualHealing: 3 }),
        }));
        expect(match.state.sys.tutorial.step?.id).toBe('heal-wolf');
        expect(match.state.sys.tutorial.pendingAnimationAdvance).toBe(true);
        match.submit(tutorial.ANIMATION_COMPLETE);
        expect(match.state.sys.tutorial.step?.id).toBe('healing-result');
        match.submit(tutorial.PREVIOUS);
        match.submit(tutorial.PREVIOUS);
        expect(match.state.sys.tutorial.step?.id).toBe('guard-wolf');
        expect(match.state.core).toEqual(original);
    });

    it.each([
        { guard: 'counterstrike', counter: 'reveal', upkeep: 'pay', defense: 'defend', repeatUpkeep: true },
        { guard: 'pass', counter: 'decline-payment', upkeep: 'destroy', defense: 'pass', repeatUpkeep: false },
    ])('continues one match after $guard / $counter / $upkeep / $defense', ({ guard, counter, upkeep, defense, repeatUpkeep }) => {
        const match = loadMatch();
        const visited = new Set<string>();
        const options: Record<string, string> = {
            'guard-response': guard, 'pay-counter': counter, 'first-upkeep': upkeep,
            'second-upkeep': 'destroy', 'bow-defense': defense,
        };
        for (let i = 0; match.state.sys.tutorial.active && i < 250; i += 1) {
            const { step, pendingAnimationAdvance } = match.state.sys.tutorial;
            if (!step) throw new Error('Expected an active course step');
            visited.add(step.id);
            if (pendingAnimationAdvance) {
                match.submit(tutorial.ANIMATION_COMPLETE);
                continue;
            }
            if (step.aiActions?.length) {
                for (const ai of step.aiActions) match.submit(ai.commandType, ai.payload, ai.playerId);
                if (match.state.sys.tutorial.step?.id === step.id && !match.state.sys.tutorial.pendingAnimationAdvance) {
                    match.submit(tutorial.AI_CONSUMED, { stepId: step.id, batchId: step.aiBatchId });
                }
                continue;
            }
            const selectedOption = options[step.id];
            if (selectedOption) {
                const optionId = selectedOption === 'defend'
                    ? getPromptOptions(match.state).find(({ id }) => id.startsWith('defend-'))?.id
                    : selectedOption;
                expect(getPromptOptions(match.state).some(({ id }) => id === optionId)).toBe(true);
                match.submit(INTERACTION_COMMANDS.RESPOND, { interactionId: getPromptInteractionId(match.state), optionId });
            } else if (playerActions[step.id]) {
                match.submit(...playerActions[step.id]);
            } else if (/^duel-\d+$/.test(step.id)) {
                match.submit(mw.DECLARE_ATTACK, { targetPlayerId: '1' });
            } else if (getMageWarsTutorialPlan(step.id)) {
                match.submit(mw.PLAN_SPELLS, { spellCardIds: getMageWarsTutorialPlan(step.id) });
            } else if (step.allowedCommands?.includes(FLOW_COMMANDS.ADVANCE_PHASE)) {
                match.submit(FLOW_COMMANDS.ADVANCE_PHASE);
            } else if (step.id === 'duel-finished') {
                const beforeClosing = match.state.core;
                match.submit(tutorial.NEXT, { reason: 'manual' });
                expect(match.state.core).toEqual(beforeClosing);
            } else if (step.infoStep) {
                match.submit(tutorial.NEXT, { reason: 'manual' });
            } else {
                throw new Error(`Missing test action for ${step.id}`);
            }
        }
        for (const id of ['guard-wolf', 'bite-unicorn', 'push-through-wall', 'pay-counter', 'first-upkeep', 'deploy-fox', 'bow-defense', 'duel-17']) {
            expect(visited.has(id), id).toBe(true);
        }
        expect(visited.has('second-upkeep')).toBe(repeatUpkeep);
        expect(visited.has('duel-finished')).toBe(true);
        expect(match.state.core.gameResult).toBeUndefined();
        expect(isTutorialFreePlay(match.state.sys.tutorial)).toBe(true);
        match.submit(FLOW_COMMANDS.ADVANCE_PHASE);
        expect(isTutorialFreePlay(match.state.sys.tutorial)).toBe(true);
    });
});
