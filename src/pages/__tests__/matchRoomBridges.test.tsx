/* @vitest-environment happy-dom */
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchState, TutorialState } from '../../engine/types';
import { TutorialDispatchBridge } from '../matchRoomBridges';

let gameClientState: MatchState<unknown>;

const dispatch = vi.fn();
const bindDispatch = vi.fn(() => 1);
const unbindDispatch = vi.fn();
const syncTutorialState = vi.fn();

vi.mock('../../engine/transport/react', () => ({
    useGameClient: () => ({
        dispatch,
        state: gameClientState,
    }),
}));

vi.mock('../../contexts/TutorialContext', () => ({
    useTutorial: () => ({
        bindDispatch,
        unbindDispatch,
        syncTutorialState,
    }),
}));

vi.mock('../../contexts/GameModeContext', () => ({
    useGameMode: () => ({ mode: 'tutorial' }),
}));

const buildState = (tutorial: TutorialState): MatchState<unknown> => ({
    core: {},
    sys: {
        tutorial,
    } as MatchState<unknown>['sys'],
});

describe('TutorialDispatchBridge', () => {
    beforeEach(() => {
        dispatch.mockClear();
        bindDispatch.mockClear();
        unbindDispatch.mockClear();
        syncTutorialState.mockClear();
        gameClientState = buildState({
            active: false,
            manifestId: null,
            stepIndex: 0,
            steps: [],
            step: null,
        });
    });

    it('同一步 AI 动作被消费后也会同步教程上下文，避免首个可见步骤卡住', async () => {
        const setupStepWithAi = {
            id: 'setup-runtime',
            content: 'setup',
            aiActions: [{ commandType: 'SYS_CHEAT_MERGE_STATE', payload: {} }],
        };
        const setupStepAfterAi = {
            ...setupStepWithAi,
            aiActions: undefined,
        };

        gameClientState = buildState({
            active: true,
            manifestId: 'basic-setup-and-turn',
            stepIndex: 0,
            steps: [setupStepWithAi],
            step: setupStepWithAi,
            aiActions: setupStepWithAi.aiActions,
        });

        const view = render(
            <TutorialDispatchBridge>
                <div />
            </TutorialDispatchBridge>,
        );

        await waitFor(() => expect(syncTutorialState).toHaveBeenCalledTimes(1));

        gameClientState = buildState({
            active: true,
            manifestId: 'basic-setup-and-turn',
            stepIndex: 0,
            steps: [setupStepAfterAi],
            step: setupStepAfterAi,
            aiActions: undefined,
        });

        view.rerender(
            <TutorialDispatchBridge>
                <div />
            </TutorialDispatchBridge>,
        );

        await waitFor(() => expect(syncTutorialState).toHaveBeenCalledTimes(2));
        expect(syncTutorialState).toHaveBeenLastCalledWith(
            expect.objectContaining({
                step: expect.objectContaining({
                    id: 'setup-runtime',
                    aiActions: undefined,
                }),
                aiActions: undefined,
            }),
        );
    });
});
