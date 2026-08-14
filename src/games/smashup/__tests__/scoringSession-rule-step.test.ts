import { describe, expect, it } from 'vitest';
import type { MatchState } from '../../../engine/types';
import {
    getResolutionFrameById,
    setResolutionFrameBlock,
    clearResolutionFrameBlock,
} from '../../../engine/systems/resolutionStack';
import type { SmashUpCore } from '../domain/types';
import {
    SMASHUP_SCORE_BASES_FRAME_ID,
    createPostScoringRevealDelayBlocker,
    createScoringBaseRef,
    createScoringPostReduceBlocker,
    appendScoringFrameDeferredPayload,
    createScoringSession,
    getScoringSession,
    isScoringSessionAwaitingDeferredResolution,
    isScoringSessionWaitingForPostScoringRevealDelay,
    isScoringSessionWaitingForPostReduce,
    setScoringSession,
    withScoringSessionProgress,
} from '../domain/scoringSession';

function makeState(): MatchState<SmashUpCore> {
    const core = {
        players: {},
        turnOrder: [],
        currentPlayerIndex: 0,
        bases: [{
            instanceId: 'base-instance-1',
            defId: 'base_the_jungle',
            minions: [],
            ongoingActions: [],
        }],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 1,
    } as unknown as SmashUpCore;

    return {
        core,
        sys: {
            phase: 'scoreBases',
            interaction: {
                current: undefined,
                queue: [],
            },
            responseWindow: {
                current: undefined,
            },
        },
    } as MatchState<SmashUpCore>;
}

describe('Smash Up scoring session semantic rule step', () => {
    it('stores the board-game rule step in frame.step', () => {
        const initial = makeState();
        const baseRef = createScoringBaseRef(initial.core, 0)!;
        const state = setScoringSession(
            initial,
            withScoringSessionProgress(
                {
                    ...createScoringSession(initial.core, [0]),
                    currentBaseRef: baseRef,
                },
                'after-scoring',
            ),
        );

        const read = getScoringSession(state)!;
        const frame = getResolutionFrameById(state, SMASHUP_SCORE_BASES_FRAME_ID)!;

        expect(read.ruleStep).toBe('after-scoring');
        expect(read.currentStep).toBe('resolving-base');
        expect(frame.step).toBe('after-scoring');
        expect(frame.step).not.toBe('resolving-base');
    });

    it('generic interaction blocking does not replace the semantic after-scoring step', () => {
        const initial = makeState();
        const baseRef = createScoringBaseRef(initial.core, 0)!;
        let state = setScoringSession(
            initial,
            withScoringSessionProgress(
                {
                    ...createScoringSession(initial.core, [0]),
                    currentBaseRef: baseRef,
                },
                'after-scoring',
            ),
        );

        state = setResolutionFrameBlock(
            state,
            SMASHUP_SCORE_BASES_FRAME_ID,
            {
                type: 'interaction',
                id: 'interaction-1',
                reason: 'test',
            },
        );

        let read = getScoringSession(state)!;
        expect(read.ruleStep).toBe('after-scoring');
        expect(read.blocker).toMatchObject({
            type: 'interaction',
            id: 'interaction-1',
        });
        expect(read.currentStep).toBe('awaiting-interactions');
        expect(getResolutionFrameById(state, SMASHUP_SCORE_BASES_FRAME_ID)?.step).toBe('after-scoring');

        state = clearResolutionFrameBlock(
            state,
            SMASHUP_SCORE_BASES_FRAME_ID,
            'interaction',
        );

        read = getScoringSession(state)!;
        expect(read.ruleStep).toBe('after-scoring');
        expect(read.blocker).toBeUndefined();
        expect(read.currentStep).toBe('resolving-base');
        expect(getResolutionFrameById(state, SMASHUP_SCORE_BASES_FRAME_ID)?.step).toBe('after-scoring');
    });

    it('keeps Smash Up reveal-delay and post-reduce waits separate from semantic progression', () => {
        const initial = makeState();
        const baseRef = createScoringBaseRef(initial.core, 0)!;

        let state = setScoringSession(
            initial,
            withScoringSessionProgress(
                {
                    ...createScoringSession(initial.core, [0]),
                    currentBaseRef: baseRef,
                },
                'finalize-base',
                createPostScoringRevealDelayBlocker(),
            ),
        );

        let read = getScoringSession(state)!;
        let frame = getResolutionFrameById(state, SMASHUP_SCORE_BASES_FRAME_ID)!;
        expect(read).toMatchObject({
            ruleStep: 'finalize-base',
            currentStep: 'awaiting-post-scoring-delay',
            blocker: {
                type: 'external',
            },
        });
        expect(frame.step).toBe('finalize-base');
        // Internal timing waits are intentionally not generic phase-gate blockers.
        expect(frame.status).toBe('running');
        expect(frame.blockedBy).toBeUndefined();

        state = setScoringSession(
            state,
            withScoringSessionProgress(
                read,
                'complete-base',
                createScoringPostReduceBlocker(),
            ),
        );

        read = getScoringSession(state)!;
        frame = getResolutionFrameById(state, SMASHUP_SCORE_BASES_FRAME_ID)!;
        expect(read).toMatchObject({
            ruleStep: 'complete-base',
            currentStep: 'awaiting-post-reduce',
            blocker: {
                type: 'post-reduce',
            },
        });
        expect(frame.step).toBe('complete-base');
        expect(frame.status).toBe('running');
        expect(frame.blockedBy).toBeUndefined();
    });

    it('keeps deferred finalization ownership after a child blocker clears', () => {
        const initial = makeState();
        const baseRef = createScoringBaseRef(initial.core, 0)!;
        let state = setScoringSession(
            initial,
            withScoringSessionProgress(
                {
                    ...createScoringSession(initial.core, [0]),
                    currentBaseRef: baseRef,
                },
                'after-scoring',
            ),
        );
        state = appendScoringFrameDeferredPayload(state, {
            deferredEvents: [{
                type: 'su:base_cleared',
                payload: {
                    baseIndex: 0,
                    baseDefId: 'base_the_jungle',
                    baseInstanceId: 'base-instance-1',
                },
                timestamp: 1000,
            }],
        });

        state = setResolutionFrameBlock(
            state,
            SMASHUP_SCORE_BASES_FRAME_ID,
            {
                type: 'interaction',
                id: 'interaction-1',
                reason: 'test',
            },
        );
        expect(getScoringSession(state)?.ruleStep).toBe('after-scoring');
        expect(isScoringSessionAwaitingDeferredResolution(state)).toBe(true);

        state = clearResolutionFrameBlock(
            state,
            SMASHUP_SCORE_BASES_FRAME_ID,
            'interaction',
        );

        const resumed = getScoringSession(state)!;
        expect(resumed.ruleStep).toBe('after-scoring');
        expect(resumed.blocker).toBeUndefined();
        // The player choice is gone, but the scoring transaction still owns
        // its deferred cleanup until finalization consumes it.
        expect(isScoringSessionAwaitingDeferredResolution(state)).toBe(true);

        state = setScoringSession(
            state,
            withScoringSessionProgress(
                resumed,
                'finalize-base',
                createPostScoringRevealDelayBlocker(),
            ),
        );
        expect(isScoringSessionAwaitingDeferredResolution(state)).toBe(true);

        state = setScoringSession(
            state,
            withScoringSessionProgress(
                getScoringSession(state)!,
                'complete-base',
                createScoringPostReduceBlocker(),
            ),
        );
        expect(isScoringSessionAwaitingDeferredResolution(state)).toBe(false);
    });

    it('uses semantic step + blocker pairs for internal wait decisions', () => {
        const initial = makeState();
        const baseRef = createScoringBaseRef(initial.core, 0)!;
        const baseSession = {
            ...createScoringSession(initial.core, [0]),
            currentBaseRef: baseRef,
        };

        const revealDelay = withScoringSessionProgress(
            baseSession,
            'finalize-base',
            createPostScoringRevealDelayBlocker(),
        );
        expect(isScoringSessionWaitingForPostScoringRevealDelay(revealDelay)).toBe(true);
        expect(isScoringSessionWaitingForPostReduce(revealDelay)).toBe(false);

        const wrongRevealStep = {
            ...revealDelay,
            ruleStep: 'after-scoring' as const,
        };
        expect(isScoringSessionWaitingForPostScoringRevealDelay(wrongRevealStep)).toBe(false);

        const postReduce = withScoringSessionProgress(
            baseSession,
            'complete-base',
            createScoringPostReduceBlocker(),
        );
        expect(isScoringSessionWaitingForPostReduce(postReduce)).toBe(true);
        expect(isScoringSessionWaitingForPostScoringRevealDelay(postReduce)).toBe(false);

        const wrongPostReduceStep = {
            ...postReduce,
            ruleStep: 'finalize-base' as const,
        };
        expect(isScoringSessionWaitingForPostReduce(wrongPostReduceStep)).toBe(false);
    });

    it('normalizes legacy currentStep input without storing a technical step in frame.step', () => {
        const initial = makeState();
        const baseRef = createScoringBaseRef(initial.core, 0)!;
        const legacyCallerSession = {
            ...createScoringSession(initial.core, [0]),
            currentBaseRef: baseRef,
            currentStep: 'awaiting-interactions' as const,
        };

        const state = setScoringSession(initial, legacyCallerSession);
        const read = getScoringSession(state)!;
        const frame = getResolutionFrameById(state, SMASHUP_SCORE_BASES_FRAME_ID)!;

        expect(read.ruleStep).toBe('after-scoring');
        expect(read.blocker?.type).toBe('interaction');
        expect(read.currentStep).toBe('awaiting-interactions');
        expect(frame.step).toBe('after-scoring');
        expect(frame.blockedBy).toBeUndefined();
    });
});
