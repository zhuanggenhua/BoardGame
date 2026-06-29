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
import { QIDAHEN_COMMANDS } from '../domain/commands';
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

    it('进攻与野战教程在结算野战后会依次进入战果、战败标记与战后收口步骤', () => {
        const manifest = QIDAHEN_TUTORIALS.tutorials['attack-and-battle']?.manifest;
        expect(manifest).toBeTruthy();

        let state = buildStateForTutorial('attack-and-battle');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.START,
            playerId: '0',
            payload: { manifest },
        });
        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        state = dispatch(state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: {
                interactionId: 'qidahen-dispatch-targeting-ming-city-region-16',
                optionId: 'city-region-14',
                choiceId: 'city-region-14',
            },
        });
        expect(state.sys.tutorial.step?.id).toBe('battle-open');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('battle-damage');

        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {
                retreatLossMode: 'rear-guard',
                attackerCasualtyPriority: 'lowest-level',
                defenderCasualtyPriority: 'highest-level',
                committedTroops: 5,
            },
        });
        expect(state.sys.tutorial.step?.id).toBe('battle-result');
        expect((state.core as any).postBattleSelection).toBeTruthy();
        expect((state.core as any).factions.jin.defeatMarkers).toBe(1);

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('retreat-and-defeat');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('battle-finish');
    });

    it('战败撤退教程在选择溃退后会看到残部清空与战败标记', () => {
        const manifest = QIDAHEN_TUTORIALS.tutorials['retreat-and-rout']?.manifest;
        expect(manifest).toBeTruthy();

        let state = buildStateForTutorial('retreat-and-rout');

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
        expect(state.sys.tutorial.step?.id).toBe('choose-rout');
        expect((state.core as any).pendingTargetAction?.battleMode).toBe('field');

        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {
                retreatLossMode: 'rout',
            },
        });
        expect(state.sys.tutorial.step?.id).toBe('rout-result');
        expect((state.core as any).postBattleSelection).toBeNull();
        expect((state.core as any).factions.ming.defeatMarkers).toBe(1);
        expect((state.core as any).regions.find((region: any) => region.id === 'city-region-16')?.troops).toBe(0);

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('finish');
    });

    it('轮盘代价教程在走 3 格后会让两家对手各抽 2，并进入进攻调度', () => {
        const manifest = QIDAHEN_TUTORIALS.tutorials['wheel-shared-cost']?.manifest;
        expect(manifest).toBeTruthy();

        let state = buildStateForTutorial('wheel-shared-cost');

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
        expect(state.sys.tutorial.step?.id).toBe('choose-move');
        expect((state.core as any).actionWheelPosition).toBe('wheel-military-farm');
        expect((state.core as any).factions.mongol.handCount).toBe(6);
        expect((state.core as any).factions.jin.handCount).toBe(10);

        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: {
                moveId: 'move-3-all-opponents',
            },
        });
        expect(state.sys.tutorial.step?.id).toBe('draw-result');
        expect((state.core as any).turnPhase).toBe('dispatch-targeting');
        expect((state.core as any).actionWheelPosition).toBe('wheel-hire');
        expect((state.core as any).factions.mongol.handCount).toBe(8);
        expect((state.core as any).factions.jin.handCount).toBe(12);

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('dispatch-ready');
        expect((state.core as any).selectedRegionId).toBe('city-region-24');
    });

    it('外交雇佣教程在友好标记后选择仅雇佣会推进到 finish', () => {
        const manifest = QIDAHEN_TUTORIALS.tutorials['diplomacy-and-hire']?.manifest;
        expect(manifest).toBeTruthy();

        let state = buildStateForTutorial('diplomacy-and-hire');

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
        expect(state.sys.tutorial.step?.id).toBe('wheel-entry');

        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: {
                moveId: 'move-1-free',
            },
        });
        expect(state.sys.tutorial.step?.id).toBe('choose-target');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('friendly-mark');

        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: {
                regionId: 'city-region-24',
            },
        });
        expect((state.core as any).selectedRegionId).toBe('city-region-24');

        state = dispatch(state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: {
                interactionId: state.sys.interaction?.current?.id,
                optionId: 'place-friendly',
            },
        });
        expect(state.sys.tutorial.step?.id).toBe('tribute-mark');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('remove-mark');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('hire-only');
        expect((state.core as any).diplomacyProgress?.resolvedSteps).toHaveLength(1);

        state = dispatch(state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: {
                interactionId: state.sys.interaction?.current?.id,
                optionId: 'hire-only',
                choiceId: 'hire-only',
            },
        });

        expect((state.core as any).lastSeasonSummary?.title).toBe('轮盘外交/雇佣');
        expect(state.sys.tutorial.step?.id).toBe('finish');
    });

    it('攻城教程会从城战待结算入口开始，并在结算后推进到围城选择', () => {
        const manifest = QIDAHEN_TUTORIALS.tutorials['siege-and-occupation']?.manifest;
        expect(manifest).toBeTruthy();

        let state = buildStateForTutorial('siege-and-occupation');

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
        expect(state.sys.tutorial.step?.id).toBe('defend-city');
        expect((state.core as any).pendingTargetAction?.battleMode).toBe('city');
        expect((state.core as any).pendingTargetAction?.title).toContain('城战待结算');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('city-battle');

        state = dispatch(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {
                attackerCasualtyPriority: 'highest-level',
                defenderCasualtyPriority: 'highest-level',
                committedTroops: 4,
            },
        });
        expect((state.core as any).pendingTargetAction).toBeNull();
        expect((state.core as any).postBattleSelection?.battleMode).toBe('city');
        expect(state.sys.tutorial.step?.id).toBe('city-result');

        state = dispatch(state, {
            type: TUTORIAL_COMMANDS.NEXT,
            playerId: '0',
            payload: { reason: 'manual' },
        });
        expect(state.sys.tutorial.step?.id).toBe('besiege-choice');
    });
});
