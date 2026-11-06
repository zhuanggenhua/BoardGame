import { afterEach, describe, expect, it } from 'vitest';
import {
    getCurrentGameFeedbackDiagnosticContext,
    recordGameFeedbackCommand,
    setCurrentGameFeedbackContext,
} from '../feedback/gameFeedbackContext';

describe('GameFeedbackContext', () => {
    afterEach(() => setCurrentGameFeedbackContext(null));

    it('诊断现场当前态和 stateId/revision/randomCursor 必须来自同一版本', () => {
        const before = { sys: { phase: 'offensiveRoll', revision: 1 } } as any;
        const commandResult = { sys: { phase: 'defensiveRoll', revision: 2 } } as any;
        const current = { sys: { phase: 'main2', revision: 3 } } as any;

        setCurrentGameFeedbackContext({
            state: before,
            scopeId: 'match-1',
            stateId: 10,
            stateRevision: 1,
            randomCursor: 6,
        });
        recordGameFeedbackCommand({ commandType: 'ROLL_DICE', payload: { faces: [1, 2] }, stateId: 10, randomCursor: 6 });
        setCurrentGameFeedbackContext({
            state: commandResult,
            scopeId: 'match-1',
            stateId: 11,
            stateRevision: 2,
            randomCursor: 7,
        });
        setCurrentGameFeedbackContext({
            state: current,
            scopeId: 'match-1',
            stateId: 12,
            stateRevision: 3,
            randomCursor: 8,
        });

        const diagnostic = getCurrentGameFeedbackDiagnosticContext();
        expect(diagnostic.state).toBe(current);
        expect(diagnostic.state?.sys.phase).toBe('main2');
        expect(diagnostic.stateId).toBe(12);
        expect(diagnostic.stateRevision).toBe(3);
        expect(diagnostic.randomCursor).toBe(8);
        expect(diagnostic.before).toBe(before);
        expect(diagnostic.after).toBe(commandResult);
        expect(diagnostic.lastCommand).toMatchObject({ stateId: 10, afterStateId: 11, afterRandomCursor: 7 });
    });
});
