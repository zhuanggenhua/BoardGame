import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, collectTriggers } from '../../domain/ongoingEffects';
import { validate } from '../../domain/commands';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import { maybeResolveReactionQueue } from '../../domain/reactionQueue';
import { defaultTestRandom, runCommand } from '../testRunner';
import {
    getReactionPrompt,
    getReactionPromptOptionBySourceDefId,
    getPromptOption,
    getSimpleChoicePrompt,
    makeBase,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPrompt,
} from '../helpers';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

describe('World Champs queued source-controller runtime context', () => {
    it('borrowed world_champs_high_speed_chase 应按控制者而不是真实 owner 转移行动并移动随从且+3', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('ally-0', 'robot_microbot_alpha', '0', 3),
                        makeMinion('enemy-1', 'robot_microbot_beta', '1', 2),
                    ],
                    ongoingActions: [{
                        uid: 'chase-borrowed',
                        defId: 'world_champs_high_speed_chase',
                        ownerId: '1',
                        talentUsed: false,
                        metadata: { sourceControllerId: '0' },
                    } as any],
                }),
                makeBase({
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                }),
            ],
        });

        const used = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { ongoingCardUid: 'chase-borrowed', baseIndex: 0 },
            } as any,
            defaultTestRandom,
        );
        expect(used.success).toBe(true);

        const chooseMinionPrompt = getSimpleChoicePrompt(used.finalState, 'world_champs_high_speed_chase_minion');
        const chooseMinion = respondToPrompt(
            used.finalState,
            getPromptOption(chooseMinionPrompt, option => option?.value?.minionUid === 'ally-0', 'High Speed Chase minion option').id,
            '0',
            defaultTestRandom,
        );
        expect(chooseMinion.success).toBe(true);

        const chooseBasePrompt = getSimpleChoicePrompt(chooseMinion.finalState, 'world_champs_high_speed_chase_base');
        const chooseBase = respondToPrompt(
            chooseMinion.finalState,
            getPromptOption(chooseBasePrompt, option => option?.value?.baseIndex === 1, 'High Speed Chase target base').id,
            '0',
            defaultTestRandom,
        );
        expect(chooseBase.success).toBe(true);

        expect(chooseBase.events.some(event =>
            event.type === SU_EVENTS.ONGOING_DETACHED
            && (event as any).payload?.cardUid === 'chase-borrowed',
        )).toBe(true);
        expect(chooseBase.events.some(event =>
            event.type === SU_EVENTS.ONGOING_ATTACHED
            && (event as any).payload?.cardUid === 'chase-borrowed'
            && (event as any).payload?.ownerId === '1'
            && (event as any).payload?.sourcePlayerId === '0'
            && (event as any).payload?.targetBaseIndex === 1,
        )).toBe(true);
        expect(chooseBase.events.some(event =>
            event.type === SU_EVENTS.MINION_MOVED
            && (event as any).payload?.minionUid === 'ally-0'
            && (event as any).payload?.toBaseIndex === 1,
        )).toBe(true);
        expect(chooseBase.events.some(event =>
            event.type === SU_EVENTS.TEMP_POWER_ADDED
            && (event as any).payload?.minionUid === 'ally-0'
            && (event as any).payload?.amount === 3
            && (event as any).payload?.reason === 'world_champs_high_speed_chase',
        )).toBe(true);

        const movedOngoing = chooseBase.finalState.core.bases[1].ongoingActions.find(action => action.uid === 'chase-borrowed');
        expect(movedOngoing).toEqual(expect.objectContaining({
            uid: 'chase-borrowed',
            defId: 'world_champs_high_speed_chase',
            ownerId: '1',
            talentUsed: true,
        }));
        expect((movedOngoing as any)?.metadata?.sourceControllerId).toBe('0');
        expect(chooseBase.finalState.core.bases[1].minions.some(minion => minion.uid === 'ally-0')).toBe(true);

        const reused = validate(chooseBase.finalState, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'chase-borrowed', baseIndex: 1 },
        } as any);
        expect(reused.valid).toBe(false);
        expect((reused as any).error).toBe('本回合天赋已使用');
    });

    it('world_champs_mummy 在对手计分时仍应把 queued afterScoring 选择权交给随从控制者', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [makeMinion('wc-mummy-1', 'world_champs_mummy', '1', 4)],
                    ongoingActions: [],
                }),
                makeBase({
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                }),
            ],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 10, vp: 1 }],
            random: defaultTestRandom,
            now: 4201,
        });

        expect(queued).toBeDefined();
        const mummyTrigger = (queued as any).payload.triggers.find((trigger: any) => trigger.sourceCardUid === 'wc-mummy-1');
        expect(mummyTrigger).toBeDefined();
        expect(mummyTrigger.ownerPlayerId).toBe('1');

        const queuedState = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers }),
            defaultTestRandom,
            4201,
        );
        expect(queuedState).toBeDefined();
        expect(getReactionPrompt(queuedState!.state)?.playerId).toBe('1');
    });

    it('world_champs_mummy_pod 在对手计分时仍应把 queued afterScoring 选择权交给随从控制者', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [makeMinion('wc-mummy-pod-1', 'world_champs_mummy_pod', '1', 4)],
                    ongoingActions: [],
                }),
                makeBase({
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                }),
            ],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 10, vp: 1 }],
            random: defaultTestRandom,
            now: 4203,
        });

        expect(queued).toBeDefined();
        const mummyTrigger = (queued as any).payload.triggers.find((trigger: any) => trigger.sourceCardUid === 'wc-mummy-pod-1');
        expect(mummyTrigger).toBeDefined();
        expect(mummyTrigger.ownerPlayerId).toBe('1');
    });

    it('world_champs_sheriff 在对手计分前仍应把 queued beforeScoring 选择权交给随从控制者', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('wc-sheriff-1', 'world_champs_sheriff', '1', 4),
                        makeMinion('enemy-1', 'robot_microbot_alpha', '0', 2),
                    ],
                    ongoingActions: [],
                }),
                makeBase({
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                }),
            ],
        });

        const queued = collectTriggers(core, 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 10, vp: 1 }],
            random: defaultTestRandom,
            now: 4202,
        });

        expect(queued).toBeDefined();
        const sheriffTrigger = (queued as any).payload.triggers.find((trigger: any) => trigger.sourceCardUid === 'wc-sheriff-1');
        expect(sheriffTrigger).toBeDefined();
        expect(sheriffTrigger.ownerPlayerId).toBe('1');

        const queuedState = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers }),
            defaultTestRandom,
            4202,
        );
        expect(queuedState).toBeDefined();
        const reactionPrompt = getReactionPrompt(queuedState!.state);
        expect(reactionPrompt?.playerId).toBe('1');
        const sheriffReactionOption = getReactionPromptOptionBySourceDefId(queuedState!.state, reactionPrompt, 'world_champs_sheriff');
        const openedSheriffPrompt = respondToPrompt(queuedState!.state, sheriffReactionOption.id, '1', defaultTestRandom);
        expect(openedSheriffPrompt.success).toBe(true);
        const sheriffPrompt = getSimpleChoicePrompt(openedSheriffPrompt.finalState, 'world_champs_sheriff_before_scoring');
        const duelTargetOption = getPromptOption(
            sheriffPrompt,
            option => option?.value?.targetMinionUid === 'enemy-1',
            'World Champs Sheriff source-target duel option',
        );
        expect(duelTargetOption.value).toEqual(expect.objectContaining({
            fieldInteractionType: 'source-target',
            fieldSourceType: 'minion',
            fieldTargetType: 'minion',
            sourceUid: 'wc-sheriff-1',
            minionUid: 'wc-sheriff-1',
            targetUid: 'enemy-1',
            targetMinionUid: 'enemy-1',
            sourceBaseIndex: 0,
            fromBaseIndex: 0,
            baseIndex: 0,
            defId: 'world_champs_sheriff',
        }));
    });

    it('world_champs_sheriff_pod 在对手计分前仍应把 queued beforeScoring 选择权交给随从控制者', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('wc-sheriff-pod-1', 'world_champs_sheriff_pod', '1', 4),
                        makeMinion('enemy-pod-1', 'robot_microbot_alpha', '0', 2),
                    ],
                    ongoingActions: [],
                }),
                makeBase({
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                }),
            ],
        });

        const queued = collectTriggers(core, 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 10, vp: 1 }],
            random: defaultTestRandom,
            now: 4204,
        });

        expect(queued).toBeDefined();
        const sheriffTrigger = (queued as any).payload.triggers.find((trigger: any) => trigger.sourceCardUid === 'wc-sheriff-pod-1');
        expect(sheriffTrigger).toBeDefined();
        expect(sheriffTrigger.ownerPlayerId).toBe('1');

        const queuedState = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers }),
            defaultTestRandom,
            4204,
        );
        expect(queuedState).toBeDefined();
        const reactionPrompt = getReactionPrompt(queuedState!.state);
        expect(reactionPrompt?.playerId).toBe('1');
        const sheriffReactionOption = getReactionPromptOptionBySourceDefId(queuedState!.state, reactionPrompt, 'world_champs_sheriff_pod');
        const openedSheriffPrompt = respondToPrompt(queuedState!.state, sheriffReactionOption.id, '1', defaultTestRandom);
        expect(openedSheriffPrompt.success).toBe(true);
        const sheriffPrompt = getSimpleChoicePrompt(openedSheriffPrompt.finalState, 'world_champs_sheriff_before_scoring');
        const duelTargetOption = getPromptOption(
            sheriffPrompt,
            option => option?.value?.targetMinionUid === 'enemy-pod-1',
            'World Champs Sheriff POD source-target duel option',
        );
        expect(duelTargetOption.value).toEqual(expect.objectContaining({
            fieldInteractionType: 'source-target',
            fieldSourceType: 'minion',
            fieldTargetType: 'minion',
            sourceUid: 'wc-sheriff-pod-1',
            minionUid: 'wc-sheriff-pod-1',
            targetUid: 'enemy-pod-1',
            targetMinionUid: 'enemy-pod-1',
            defId: 'world_champs_sheriff_pod',
        }));
    });
});
