import type { Command, MatchState, RandomFn } from '../../../engine/types';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import { MAGE_WARS_COMMANDS } from '../domain';
import { MAGE_WARS_EVENTS } from '../domain/events';
import { resolveMageWarsObjectAttackEvents } from '../domain/execute';
import { reduceEvent } from '../domain/reducer';
import type { MageWarsCore } from '../domain/types';
import {
    getSimpleChoicePrompt,
    getPromptOptions,
    makeArenaObject,
    PLAYER_ZERO_START_ZONE,
    runCommand,
    setupState,
    validateCommand,
    withArenaObject,
    withPlayerInZone,
} from './helpers/domainFlowHarness';

const fearHelmetRandom: RandomFn = {
    random: () => 0.5,
    d: (sides) => (sides === 12 ? 9 : 3),
    range: (min: number) => min,
    shuffle: <T,>(array: T[]) => [...array],
};

const lowFearHelmetRandom: RandomFn = {
    ...fearHelmetRandom,
    d: (sides) => (sides === 12 ? 8 : 3),
};

function makeFearHelmet(id = 'fear-helmet-1'): ReturnType<typeof makeArenaObject> {
    return makeArenaObject(id, '1', PLAYER_ZERO_START_ZONE, {
        kind: 'equipment',
        sourceSpellCardId: 3720,
        sourceObjectId: 'spell-card-3720',
        name: '恐惧头盔',
        life: 1,
        armor: 0,
        actionReady: false,
        guarding: false,
        anchoredToPlayerId: '1',
        rulesText: '每当本法师成为一次近战攻击的目标时，掷出9+则取消攻击。',
        createdAtSequence: 1,
    });
}

function makeFearHelmetState(
    attackerOverrides: Partial<ReturnType<typeof makeArenaObject>> = {},
): MatchState<MageWarsCore> {
    const base = setupState('creatureAction');
    const withTargetMage = withPlayerInZone(base.core, '1', PLAYER_ZERO_START_ZONE);
    const attacker = makeArenaObject('fear-attacker-0', '0', PLAYER_ZERO_START_ZONE, {
        attackOrTraitLine: '利爪：快速近战 2 骰',
        createdAtSequence: 2,
        ...attackerOverrides,
    });
    return {
        core: withArenaObject(withArenaObject(withTargetMage, attacker), makeFearHelmet()),
        sys: base.sys,
    };
}

function makeMageFearHelmetState(): MatchState<MageWarsCore> {
    const base = setupState('creatureAction');
    const core = withPlayerInZone(
        withPlayerInZone(base.core, '0', PLAYER_ZERO_START_ZONE),
        '1',
        PLAYER_ZERO_START_ZONE,
    );
    return {
        core: withArenaObject(core, makeFearHelmet()),
        sys: base.sys,
    };
}

describe('mage-wars Fear Helmet', () => {
    it('cancels a melee attack, records the attacker for the round, and allows retargeting', () => {
        const state = makeFearHelmetState();
        const alternateTarget = makeArenaObject('alternate-target-1', '1', PLAYER_ZERO_START_ZONE, {
            life: 20,
            armor: 0,
            createdAtSequence: 3,
        });
        const prepared: MatchState<MageWarsCore> = {
            core: withArenaObject(state.core, alternateTarget),
            sys: state.sys,
        };

        const attacked = runCommand(prepared, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: 'fear-attacker-0',
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        }, fearHelmetRandom);

        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: MAGE_WARS_EVENTS.FEAR_HELMET_TRIGGERED }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.FEAR_HELMET_AVAILABLE,
                payload: expect.objectContaining({
                    attackerObjectId: 'fear-attacker-0',
                    targetPlayerId: '1',
                    effectDieResult: 9,
                }),
            }),
        ]));
        expect(attacked.state.core.objects['fear-helmet-1'].fearHelmetAttackerObjectIdsThisRound)
            .toEqual(['fear-attacker-0']);
        const interaction = getSimpleChoicePrompt(attacked.state, 'mw.fear-helmet.choice');
        expect(interaction).toBeDefined();
        const options = getPromptOptions(attacked.state);
        const retarget = options.find((option) => (
            (option.value as { action?: string } | undefined)?.action === 'retarget'
            && (option.value as { targetObjectId?: string } | undefined)?.targetObjectId === alternateTarget.id
        ));
        expect(retarget).toBeDefined();

        const continued = runCommand(attacked.state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: {
                interactionId: interaction!.id,
                optionId: retarget!.id,
            },
        } as Command, fearHelmetRandom);

        expect(continued.success).toBe(true);
        expect(continued.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ATTACK_MISSED,
                payload: expect.objectContaining({
                    targetPlayerId: '1',
                    effectDieResult: 9,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
                payload: expect.objectContaining({
                    targetObjectId: alternateTarget.id,
                }),
            }),
        ]));
        expect(continued.state.core.objects[alternateTarget.id].damage).toBeGreaterThan(0);
        const reusableAttackerState: MatchState<MageWarsCore> = {
            ...continued.state,
            core: {
                ...continued.state.core,
                objects: {
                    ...continued.state.core.objects,
                    ['fear-attacker-0']: {
                        ...continued.state.core.objects['fear-attacker-0'],
                        actionReady: true,
                    },
                },
            },
        };
        expect(validateCommand(reusableAttackerState, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: 'fear-attacker-0',
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        })).toBe('fearHelmetBlocksAttacker');
    });

    it('continues normally below 9 and ignores nonliving, mental-immune, and counterstrike attacks', () => {
        const lowRoll = runCommand(makeFearHelmetState(), {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: 'fear-attacker-0',
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        }, lowFearHelmetRandom);
        expect(lowRoll.success).toBe(true);
        expect(lowRoll.events.some((event) => event.type === MAGE_WARS_EVENTS.FEAR_HELMET_AVAILABLE)).toBe(false);
        expect(lowRoll.events.some((event) => event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED)).toBe(true);

        const immuneAttacker = makeArenaObject('immune-attacker-0', '0', PLAYER_ZERO_START_ZONE, {
            attackOrTraitLine: '利爪：快速近战 2 骰；非活体',
        });
        const immuneBase = setupState('creatureAction');
        const immuneState: MatchState<MageWarsCore> = {
            core: withArenaObject(
                withArenaObject(
                    withPlayerInZone(immuneBase.core, '1', PLAYER_ZERO_START_ZONE),
                    immuneAttacker,
                ),
                makeFearHelmet(),
            ),
            sys: immuneBase.sys,
        };
        const immuneAttack = runCommand(immuneState, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: immuneAttacker.id,
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        }, fearHelmetRandom);
        expect(immuneAttack.events.some((event) => event.type === MAGE_WARS_EVENTS.FEAR_HELMET_AVAILABLE)).toBe(false);

        const counterstrikeEvents = resolveMageWarsObjectAttackEvents({
            state: makeFearHelmetState(),
            sourceCommandType: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            timestamp: 0,
            random: fearHelmetRandom,
            attackerObjectId: 'fear-attacker-0',
            attackProfileId: 'attack-0',
            targetPlayerId: '1',
            actionCost: 'none',
            allowDefenseOpportunity: false,
            isCounterstrike: true,
        });
        expect(counterstrikeEvents.some((event) => event.type === MAGE_WARS_EVENTS.FEAR_HELMET_AVAILABLE)).toBe(false);
    });

    it('also intercepts the mage basic melee attack and allows the mage to guard instead', () => {
        const attacked = runCommand(makeMageFearHelmetState(), {
            type: MAGE_WARS_COMMANDS.DECLARE_ATTACK,
            playerId: '0',
            payload: { targetPlayerId: '1' },
        }, fearHelmetRandom);

        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ATTACK_DECLARED,
                payload: expect.objectContaining({
                    attackerId: '0',
                    defenderId: '1',
                    effectDieResult: 9,
                    baseDamage: 0,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.FEAR_HELMET_AVAILABLE,
                payload: expect.objectContaining({
                    attackerId: '0',
                    targetPlayerId: '1',
                    attackProfileId: 'mage-basic-melee',
                }),
            }),
        ]));

        const interaction = getSimpleChoicePrompt(attacked.state, 'mw.fear-helmet.choice');
        const guardOption = getPromptOptions(attacked.state).find((option) => (
            (option.value as { action?: string } | undefined)?.action === 'guard'
        ));
        expect(interaction).toBeDefined();
        expect(guardOption).toBeDefined();

        const guarded = runCommand(attacked.state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { interactionId: interaction!.id, optionId: guardOption!.id },
        } as Command, fearHelmetRandom);

        expect(guarded.success).toBe(true);
        expect(guarded.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ATTACK_MISSED,
                payload: expect.objectContaining({
                    attackerId: '0',
                    targetPlayerId: '1',
                    effectDieResult: 9,
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.GUARD_GAINED,
                payload: { playerId: '0' },
            }),
        ]));
        expect(guarded.state.core.players['0']).toMatchObject({
            actionReady: false,
            guarding: true,
        });
        expect(guarded.state.core.players['1'].damage).toBe(0);
    });

    it('keeps fear helmet timing at the first strike of a multi-strike attack action', () => {
        const attacked = runCommand(makeFearHelmetState({
            attackOrTraitLine: '三重噬咬：完整行动近战 2 骰，三连击',
        }), {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: 'fear-attacker-0',
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        }, fearHelmetRandom);

        expect(attacked.success).toBe(true);
        expect(attacked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.FEAR_HELMET_AVAILABLE,
                payload: expect.objectContaining({
                    strikeIndex: 0,
                    strikeCount: 3,
                }),
            }),
        ]));
    });

    it('allows guarding only on the first attack and clears the restriction after the round advances', () => {
        const state = makeFearHelmetState();
        const attacked = runCommand(state, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: 'fear-attacker-0',
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        }, fearHelmetRandom);
        const interaction = getSimpleChoicePrompt(attacked.state, 'mw.fear-helmet.choice');
        const guardOption = getPromptOptions(attacked.state).find((option) => (
            (option.value as { action?: string } | undefined)?.action === 'guard'
        ));
        expect(guardOption).toBeDefined();

        const guarded = runCommand(attacked.state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { interactionId: interaction!.id, optionId: guardOption!.id },
        } as Command, fearHelmetRandom);
        expect(guarded.state.core.objects['fear-attacker-0'].guarding).toBe(true);

        const advancedCore = reduceEvent(guarded.state.core, {
            type: MAGE_WARS_EVENTS.TURN_ADVANCED,
            payload: { fromPlayerId: '0', toPlayerId: '1', turnNumber: guarded.state.core.turnNumber + 1 },
            sourceCommandType: 'test',
            timestamp: 1,
        });
        expect(advancedCore.turnNumber).toBeGreaterThan(state.core.turnNumber);
        const nextRoundState: MatchState<MageWarsCore> = {
            ...guarded.state,
            core: {
                ...advancedCore,
                currentPlayerId: '0',
                objects: {
                    ...advancedCore.objects,
                    ['fear-attacker-0']: {
                        ...advancedCore.objects['fear-attacker-0'],
                        actionReady: true,
                    },
                },
            },
        };
        expect(validateCommand(nextRoundState, {
            type: MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK,
            playerId: '0',
            payload: {
                attackerObjectId: 'fear-attacker-0',
                attackProfileId: 'attack-0',
                targetPlayerId: '1',
            },
        })).toBeUndefined();
    });
});
