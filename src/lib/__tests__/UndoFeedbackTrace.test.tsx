import { useCallback, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UndoProvider, useUndo } from '../../contexts/UndoContext';
import { GameClientContext } from '../../engine/transport/reactContext';
import { getCurrentGameFeedbackDiagnosticContext, recordGameFeedbackCommand, setCurrentGameFeedbackContext } from '../feedback/gameFeedbackContext';

const before = {
    sys: {
        phase: 'offensiveRoll',
        stateId: 41,
        revision: 41,
        decisionEpoch: 7,
        interaction: { current: { id: 'choice-1', kind: 'choice' } },
        responseWindow: { current: undefined },
        actionLog: { entries: [] },
        eventStream: { entries: [] },
        undo: { snapshots: [] },
    },
    core: { marker: 'before' },
} as any;

const after = {
    ...before,
    sys: {
        ...before.sys,
        phase: 'defensiveRoll',
        stateId: 42,
        revision: 42,
        decisionEpoch: 8,
        interaction: { current: undefined },
    },
    core: { marker: 'after' },
};

const DispatchButton = () => {
    const undo = useUndo();
    return <button onClick={() => undo?.dispatch('RESOLVE_INTERACTION', { interactionId: 'choice-1', optionId: 'hidden-card-option-canary' })}>resolve</button>;
};

const gameClientValue = {
    state: null,
    dispatch: vi.fn(),
    playerId: '0',
    matchPlayers: [],
    isConnected: true,
    isMultiplayer: false,
    feedbackMetadata: { scopeId: 'match-test' },
};

describe('UndoProvider feedback context', () => {
    it('跟踪当前对局状态；普通命令摘要由共享 dispatch 入口记录', async () => {
        setCurrentGameFeedbackContext(null);
        const dispatch = vi.fn((_type: string, _payload?: unknown) => undefined);
        function Harness() {
            const [state, setState] = useState(before);
            const dispatchAndAdvance = useCallback((type: string, payload?: unknown) => {
                dispatch(type, payload);
                setState(after);
            }, []);
            return (
                <GameClientContext.Provider value={gameClientValue}>
                    <UndoProvider value={{ G: state, dispatch: dispatchAndAdvance, playerID: '0', isGameOver: false }}>
                        <DispatchButton />
                    </UndoProvider>
                </GameClientContext.Provider>
            );
        }

        render(<Harness />);
        await waitFor(() => expect(getCurrentGameFeedbackDiagnosticContext().state).toBe(before));
        fireEvent.click(screen.getByRole('button', { name: 'resolve' }));

        await waitFor(() => expect(getCurrentGameFeedbackDiagnosticContext().state).toBe(after));
        const context = getCurrentGameFeedbackDiagnosticContext();
        expect(context.lastCommand).toBeUndefined();
        expect(context.stateId).toBe(42);
        expect(context.stateRevision).toBe(42);
        expect(context.state.sys.decisionEpoch).toBe(8);
        expect(dispatch).toHaveBeenCalledWith('RESOLVE_INTERACTION', { interactionId: 'choice-1', optionId: 'hidden-card-option-canary' });
    });

    it('切换对局 scope 时清除前一局命令轨迹和快照', () => {
        setCurrentGameFeedbackContext({ state: before, scopeId: 'match-a' });
        recordGameFeedbackCommand({
            commandType: 'RESOLVE_INTERACTION',
            payload: { cardId: 'hidden-card-from-match-a' },
            playerId: '0',
        });
        setCurrentGameFeedbackContext({ state: after, scopeId: 'match-a' });
        expect(getCurrentGameFeedbackDiagnosticContext().lastCommand?.commandType).toBe('RESOLVE_INTERACTION');

        setCurrentGameFeedbackContext({ state: { ...after, core: { marker: 'match-b' } }, scopeId: 'match-b' });
        const context = getCurrentGameFeedbackDiagnosticContext();
        expect(context.lastCommand).toBeUndefined();
        expect(context.commandTraceTail).toBeUndefined();
        expect(context.before).toBeUndefined();
        expect(JSON.stringify(context)).not.toContain('hidden-card-from-match-a');
    });

    it('缺少对局范围时，不从上一份无范围上下文继承命令轨迹', () => {
        setCurrentGameFeedbackContext({ state: before });
        recordGameFeedbackCommand({ commandType: 'RESOLVE_INTERACTION', payload: { optionId: 'private-option' } });
        setCurrentGameFeedbackContext({ state: { ...after, core: { marker: 'new-unscoped-state' } } });

        const context = getCurrentGameFeedbackDiagnosticContext();
        expect(context.lastCommand).toBeUndefined();
        expect(context.commandTraceTail).toBeUndefined();
        expect(JSON.stringify(context)).not.toContain('private-option');
    });
});
