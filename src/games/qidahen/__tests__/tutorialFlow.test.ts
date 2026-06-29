import { describe, expect, it } from 'vitest';
import {
    createActionLogSystem,
    createEventStreamSystem,
    createInitialSystemState,
    createInteractionSystem,
    createRematchSystem,
    createSimpleChoiceSystem,
    createTutorialSystem,
    executePipeline,
    TUTORIAL_COMMANDS,
} from '../../../engine';
import type { Command, MatchState, RandomFn } from '../../../engine/types';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import QIDAHEN_TUTORIALS from '../tutorial';
import { buildQidahenTutorialSetupData } from '../tutorialSetup';
import { QidahenDomain } from '../domain';
import { createQidahenInteractionSystem } from '../domain/interactionSystem';

const random: RandomFn = {
    random: () => 0.5,
    d: (max) => Math.ceil(max / 2),
    range: (min, max) => Math.floor((min + max) / 2),
    shuffle: <T,>(arr: T[]) => [...arr],
};

const systems = [
    createActionLogSystem(),
    createInteractionSystem(),
    createTutorialSystem(),
    createEventStreamSystem(),
    createSimpleChoiceSystem(),
    createQidahenInteractionSystem(),
    createRematchSystem(),
] as const;

const playerIds = ['0', '1', '2'];

const buildStateForTutorial = (tutorialId: string): MatchState<unknown> => {
    const setup = buildQidahenTutorialSetupData(tutorialId);
    if (!setup) {
        throw new Error(`missing tutorial setup for ${tutorialId}`);
    }
    const core = QidahenDomain.setup(playerIds, random, setup.setupData);
    const sys = createInitialSystemState(playerIds, [...systems], 'qidahen-tutorial-flow-test');
    const initialState = { sys, core };
    return QidahenDomain.normalizeRuntimeState
        ? QidahenDomain.normalizeRuntimeState(initialState)
        : initialState;
};

const dispatch = (state: MatchState<unknown>, command: Command): MatchState<unknown> => {
    const result = executePipeline(
        {
            domain: QidahenDomain,
            systems: [...systems],
        },
        state as MatchState<any>,
        command as any,
        random,
        playerIds,
    );
    expect(result.success).toBe(true);
    return result.state;
};

describe('qidahen tutorial flow', () => {
    it('进攻与野战教程在真实点选进攻目标后会推进到 battle-open', () => {
        const manifest = QIDAHEN_TUTORIALS.tutorials['attack-and-battle']?.manifest;
        expect(manifest).toBeTruthy();

        let state = buildStateForTutorial('attack-and-battle');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.START,
            playerId: '0',
            payload: { manifest },
        });
        expect(state.sys.tutorial.step?.id).toBe('overview');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('move-entry');
        expect((state.core as any).turnPhase).toBe('dispatch-targeting');
        expect((state.core as any).pendingTargetAction).toBeNull();

        state = dispatch(state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: {
                interactionId: 'qidahen-dispatch-targeting-ming-city-region-16',
                optionId: 'city-region-14',
                choiceId: 'city-region-14',
            },
        });

        expect((state.core as any).turnPhase).toBe('resolve-pending');
        expect((state.core as any).pendingTargetAction?.targetRegionId).toBe('city-region-14');
        expect(state.sys.tutorial.step?.id).toBe('battle-open');
    });
});
