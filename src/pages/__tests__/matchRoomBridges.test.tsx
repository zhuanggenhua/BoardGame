/* @vitest-environment happy-dom */
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchState, TutorialManifest, TutorialState } from '../../engine/types';
import { TUTORIAL_COMMANDS } from '../../engine/systems/TutorialSystem';
import { TutorialDispatchBridge } from '../matchRoomBridges';
import type { TutorialSessionScope } from '../../contexts/TutorialContext';

let gameClientState: MatchState<unknown>;
let contextTutorialState: TutorialState;
let contextBoardMounted = false;

const dispatch = vi.fn();
let gameClientDispatch = dispatch;
const bindDispatch = vi.fn(() => 1);
const unbindDispatch = vi.fn();
const syncTutorialState = vi.fn();

vi.mock('../../engine/transport/react', () => ({
    useGameClient: () => ({
        dispatch: gameClientDispatch,
        state: gameClientState,
    }),
}));

vi.mock('../../contexts/TutorialContext', () => ({
    useTutorial: () => ({
        bindDispatch,
        unbindDispatch,
        syncTutorialState,
        tutorial: contextTutorialState,
        isBoardMounted: contextBoardMounted,
    }),
}));

vi.mock('../../contexts/GameModeContext', () => ({
    useGameMode: () => ({ mode: 'tutorial' }),
}));

const buildState = (tutorial: TutorialState, core: Record<string, unknown> = {}): MatchState<unknown> => ({
    core,
    sys: {
        tutorial,
    } as MatchState<unknown>['sys'],
});

describe('TutorialDispatchBridge', () => {
    beforeEach(() => {
        dispatch.mockClear();
        gameClientDispatch = dispatch;
        bindDispatch.mockClear();
        unbindDispatch.mockClear();
        syncTutorialState.mockClear();
        contextBoardMounted = false;
        gameClientState = buildState({
            active: false,
            manifestId: null,
            stepIndex: 0,
            steps: [],
            step: null,
        });
        contextTutorialState = {
            active: false,
            manifestId: null,
            stepIndex: 0,
            steps: [],
            step: null,
        };
    });

    it('会把当前教程会话范围传给提前绑定和状态同步', async () => {
        const sessionScope: TutorialSessionScope = {
            key: 'tutorial-session:v1:dicethrone:basic-setup-and-turn:basic-setup-and-turn:r2',
            gameId: 'dicethrone',
            tutorialId: 'basic-setup-and-turn',
            manifestId: 'basic-setup-and-turn',
            manifestRevision: 2,
        };
        const manifest: TutorialManifest = {
            id: 'basic-setup-and-turn',
            revision: 2,
            steps: [
                { id: 'setup-runtime', content: 'setup' },
            ],
        };
        gameClientState = buildState({
            active: true,
            manifestId: manifest.id,
            manifestRevision: manifest.revision,
            stepIndex: 0,
            steps: manifest.steps,
            step: manifest.steps[0],
        });

        render(
            <TutorialDispatchBridge tutorialManifest={manifest} sessionScope={sessionScope}>
                <div />
            </TutorialDispatchBridge>,
        );

        await waitFor(() => expect(bindDispatch).toHaveBeenCalledWith(
            expect.any(Function),
            sessionScope,
        ));
        await waitFor(() => expect(syncTutorialState).toHaveBeenCalledWith(
            expect.objectContaining({
                active: true,
                manifestId: manifest.id,
            }),
            undefined,
            sessionScope,
        ));
    });

    it('同一步无表现事件的领域换席仍通知棋盘同步，同一快照重渲染不重复通知', async () => {
        const step = { id: 'play-61', content: '', aiActions: [{ commandType: 'ADVANCE_PHASE', playerId: '1', waitForBoardSyncAfter: true }] };
        gameClientState = buildState({ active: true, manifestId: 'fate-domination-foundation', stepIndex: 61, steps: [step], step, aiActions: step.aiActions }, { round: 3, phase: 'preparation', currentPlayerId: '1' });
        const view = render(<TutorialDispatchBridge><div /></TutorialDispatchBridge>);
        await waitFor(() => expect(syncTutorialState).toHaveBeenCalledTimes(1));

        // 正式换席只更新领域局面，教程尚待 AI_CONSUMED，表现事件游标也没有变化。
        gameClientState = { ...gameClientState, core: { round: 3, phase: 'preparation', currentPlayerId: '0' } };
        view.rerender(<TutorialDispatchBridge><div /></TutorialDispatchBridge>);
        await waitFor(() => expect(syncTutorialState).toHaveBeenCalledTimes(2));
        view.rerender(<TutorialDispatchBridge><div /></TutorialDispatchBridge>);
        expect(syncTutorialState).toHaveBeenCalledTimes(2);
    });

    it('真实棋盘已挂载时房间层不覆盖棋盘的教学显示投影', async () => {
        const step = { id: 'post-battle', content: '事件卡原文' };
        gameClientState = buildState({ active: true, manifestId: 'fate-domination-foundation', stepIndex: 1, steps: [step], step });
        contextTutorialState = { ...gameClientState.sys.tutorial, step: { ...step, hideOverlay: true } };
        contextBoardMounted = true;
        const view = render(<TutorialDispatchBridge><div /></TutorialDispatchBridge>);
        await waitFor(() => expect(bindDispatch).toHaveBeenCalled());
        expect(syncTutorialState).not.toHaveBeenCalled();
        gameClientState = { ...gameClientState, core: { resolved: true } };
        view.rerender(<TutorialDispatchBridge><div /></TutorialDispatchBridge>);
        expect(syncTutorialState).not.toHaveBeenCalled();
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

    it('恢复教程进度时会把当前清单重新绑定回教程系统', async () => {
        const manifest: TutorialManifest = {
            id: 'basic-setup-and-turn',
            revision: 2,
            steps: [
                { id: 'use-rabbit-foot', content: 'use-rabbit-foot', allowedCommands: ['USE_RABBIT_FOOT'] },
                { id: 'rabbit-foot-result', content: 'rabbit-foot-result', allowedCommands: ['FINALIZE_EVENT_ROLL'] },
            ],
            stepValidator: () => true,
        };
        gameClientState = buildState({
            active: true,
            manifestId: manifest.id,
            manifestRevision: manifest.revision,
            stepIndex: 0,
            steps: manifest.steps,
            step: manifest.steps[0],
        });

        render(
            <TutorialDispatchBridge tutorialManifest={manifest}>
                <div />
            </TutorialDispatchBridge>,
        );

        await waitFor(() => expect(dispatch).toHaveBeenCalledWith(
            TUTORIAL_COMMANDS.BIND_MANIFEST,
            { manifest },
        ));
    });

    it('状态刚被 START 推进后重新绑定清单时使用当前 dispatch，不落到旧 Provider 状态', async () => {
        const oldDispatch = vi.fn();
        const nextDispatch = vi.fn();
        const manifest: TutorialManifest = {
            id: 'mage-wars-basic',
            revision: 2,
            steps: [
                { id: 'intro', content: 'intro' },
            ],
            stepValidator: () => true,
        };
        gameClientDispatch = oldDispatch;

        const view = render(
            <TutorialDispatchBridge tutorialManifest={manifest}>
                <div />
            </TutorialDispatchBridge>,
        );

        gameClientDispatch = nextDispatch;
        gameClientState = buildState({
            active: true,
            manifestId: manifest.id,
            manifestRevision: manifest.revision,
            stepIndex: 0,
            steps: manifest.steps,
            step: manifest.steps[0],
        });

        view.rerender(
            <TutorialDispatchBridge tutorialManifest={manifest}>
                <div />
            </TutorialDispatchBridge>,
        );

        await waitFor(() => expect(nextDispatch).toHaveBeenCalledWith(
            TUTORIAL_COMMANDS.BIND_MANIFEST,
            { manifest },
        ));
        expect(oldDispatch).not.toHaveBeenCalledWith(
            TUTORIAL_COMMANDS.BIND_MANIFEST,
            { manifest },
        );
    });

    it('本地 Provider 重挂载导致 sys.tutorial 丢失时，会用当前 dispatch 重新启动同一教程', async () => {
        const manifest: TutorialManifest = {
            id: 'basic-setup-and-turn',
            revision: 2,
            steps: [
                { id: 'setup-runtime', content: 'setup' },
                { id: 'objective-and-turn', content: 'objective' },
            ],
        };
        contextTutorialState = {
            active: true,
            manifestId: manifest.id,
            manifestRevision: manifest.revision,
            stepIndex: 0,
            steps: manifest.steps,
            step: manifest.steps[0],
        };
        gameClientState = buildState({
            active: false,
            manifestId: null,
            stepIndex: 0,
            steps: [],
            step: null,
        });

        render(
            <TutorialDispatchBridge tutorialManifest={manifest}>
                <div />
            </TutorialDispatchBridge>,
        );

        await waitFor(() => expect(dispatch).toHaveBeenCalledWith(
            TUTORIAL_COMMANDS.START,
            { manifest },
        ));
    });

    it('重新启动同一教程时不会把空白 Provider 状态同步回上下文导致教程失活', async () => {
        const manifest: TutorialManifest = {
            id: 'basic-setup-and-turn',
            revision: 2,
            steps: [
                { id: 'setup-runtime', content: 'setup' },
                { id: 'objective-and-turn', content: 'objective' },
            ],
        };
        contextTutorialState = {
            active: true,
            manifestId: manifest.id,
            manifestRevision: manifest.revision,
            stepIndex: 0,
            steps: manifest.steps,
            step: manifest.steps[0],
        };
        gameClientState = buildState({
            active: false,
            manifestId: null,
            stepIndex: 0,
            steps: [],
            step: null,
        });

        render(
            <TutorialDispatchBridge tutorialManifest={manifest}>
                <div />
            </TutorialDispatchBridge>,
        );

        await waitFor(() => expect(dispatch).toHaveBeenCalledWith(
            TUTORIAL_COMMANDS.START,
            { manifest },
        ));
        expect(syncTutorialState).not.toHaveBeenCalledWith(
            expect.objectContaining({
                active: false,
                manifestId: null,
            }),
        );
    });

    it('棋盘在最后一步关闭教程时，会同步关闭态而不是重新启动同一教程', async () => {
        const manifest: TutorialManifest = {
            id: 'mage-wars-basic',
            revision: 5,
            steps: [
                { id: 'intro', content: 'intro' },
                { id: 'finish', content: 'finish' },
            ],
        };
        contextTutorialState = {
            active: true,
            manifestId: manifest.id,
            manifestRevision: manifest.revision,
            stepIndex: 1,
            steps: [],
            step: manifest.steps[1],
        } as TutorialState & { totalSteps: number };
        gameClientState = buildState({
            active: true,
            manifestId: manifest.id,
            manifestRevision: manifest.revision,
            stepIndex: 1,
            steps: [],
            step: manifest.steps[1],
            totalSteps: manifest.steps.length,
        } as TutorialState & { totalSteps: number });

        const view = render(
            <TutorialDispatchBridge tutorialManifest={manifest}>
                <div />
            </TutorialDispatchBridge>,
        );

        await waitFor(() => expect(syncTutorialState).toHaveBeenCalledWith(
            expect.objectContaining({
                active: true,
                manifestId: manifest.id,
                stepIndex: 1,
                totalSteps: manifest.steps.length,
            }),
        ));

        dispatch.mockClear();
        syncTutorialState.mockClear();
        contextBoardMounted = true;
        gameClientState = buildState({
            active: false,
            manifestId: null,
            stepIndex: 0,
            steps: [],
            step: null,
        });

        view.rerender(
            <TutorialDispatchBridge tutorialManifest={manifest}>
                <div />
            </TutorialDispatchBridge>,
        );

        await waitFor(() => expect(syncTutorialState).toHaveBeenCalledWith(
            expect.objectContaining({
                active: false,
                manifestId: null,
            }),
        ));
        expect(dispatch).not.toHaveBeenCalledWith(
            TUTORIAL_COMMANDS.START,
            { manifest },
        );
    });

    it('刚 START 到第 0 步且清单没有校验器时，不重复绑定清单覆盖教程状态', () => {
        const manifest: TutorialManifest = {
            id: 'mage-wars-basic',
            revision: 2,
            steps: [
                { id: 'intro', content: 'intro' },
                { id: 'plan', content: 'plan' },
            ],
        };
        gameClientState = buildState({
            active: true,
            manifestId: manifest.id,
            manifestRevision: manifest.revision,
            stepIndex: 0,
            steps: manifest.steps,
            step: manifest.steps[0],
        });

        render(
            <TutorialDispatchBridge tutorialManifest={manifest}>
                <div />
            </TutorialDispatchBridge>,
        );

        expect(dispatch).not.toHaveBeenCalledWith(
            TUTORIAL_COMMANDS.BIND_MANIFEST,
            { manifest },
        );
    });

    it('同一步核心局面已让步骤过期时会重新绑定清单，避免旧白名单继续拦确认', async () => {
        const manifest: TutorialManifest = {
            id: 'basic-setup-and-turn',
            revision: 2,
            steps: [
                { id: 'use-rabbit-foot', content: 'use-rabbit-foot', allowedCommands: ['USE_RABBIT_FOOT'] },
                { id: 'rabbit-foot-result', content: 'rabbit-foot-result', allowedCommands: ['FINALIZE_EVENT_ROLL'] },
            ],
            stepValidator: (state, step) => {
                if (step.id !== 'use-rabbit-foot') return true;
                return !(state.core as { usedRabbit?: boolean }).usedRabbit;
            },
        };
        const staleTutorial = {
            active: true,
            manifestId: manifest.id,
            manifestRevision: manifest.revision,
            stepIndex: 0,
            steps: manifest.steps,
            step: manifest.steps[0],
        };
        gameClientState = buildState(staleTutorial, { usedRabbit: false });

        const view = render(
            <TutorialDispatchBridge tutorialManifest={manifest}>
                <div />
            </TutorialDispatchBridge>,
        );

        await waitFor(() => expect(dispatch).toHaveBeenCalledWith(
            TUTORIAL_COMMANDS.BIND_MANIFEST,
            { manifest },
        ));

        dispatch.mockClear();
        gameClientState = buildState(staleTutorial, { usedRabbit: true });
        view.rerender(
            <TutorialDispatchBridge tutorialManifest={manifest}>
                <div />
            </TutorialDispatchBridge>,
        );

        await waitFor(() => expect(dispatch).toHaveBeenCalledWith(
            TUTORIAL_COMMANDS.BIND_MANIFEST,
            { manifest },
        ));
    });

    it('恢复到旧版本教程状态时会重启当前清单，避免按钮和命令许可错位', async () => {
        const manifest: TutorialManifest = {
            id: 'basic-setup-and-turn',
            revision: 2,
            steps: [
                { id: 'objective-and-turn', content: 'objective' },
                { id: 'rabbit-foot-result', content: 'rabbit-foot-result', allowedCommands: ['FINALIZE_EVENT_ROLL'] },
            ],
            stepValidator: () => true,
        };
        gameClientState = buildState({
            active: true,
            manifestId: manifest.id,
            manifestRevision: 1,
            stepIndex: 1,
            steps: [
                { id: 'use-rabbit-foot', content: 'old', allowedCommands: ['USE_RABBIT_FOOT'] },
                { id: 'rabbit-foot-result', content: 'old-result', allowedCommands: ['USE_RABBIT_FOOT'] },
            ],
            step: { id: 'rabbit-foot-result', content: 'old-result', allowedCommands: ['USE_RABBIT_FOOT'] },
        });

        render(
            <TutorialDispatchBridge tutorialManifest={manifest}>
                <div />
            </TutorialDispatchBridge>,
        );

        await waitFor(() => expect(dispatch).toHaveBeenCalledWith(
            TUTORIAL_COMMANDS.START,
            { manifest },
        ));
        expect(dispatch).not.toHaveBeenCalledWith(
            TUTORIAL_COMMANDS.BIND_MANIFEST,
            { manifest },
        );
    });
});
