import { describe, expect, it } from 'vitest';

import { createInitialSystemState } from '../../pipeline';
import type { Command, EventCommitEvidence, MatchState, RandomFn } from '../../types';
import { createRefereeTraceSystem, getRefereeTraceEntries } from '../RefereeTraceSystem';

const mockRandom: RandomFn = {
    random: () => 0.5,
    d: (max) => Math.ceil(max / 2),
    range: (min, max) => Math.floor((min + max) / 2),
    shuffle: (arr) => [...arr],
};

const command: Command = {
    type: 'ATTACK',
    playerId: 'p1',
    payload: {},
    timestamp: 10,
};

function createEvidence(id: string): EventCommitEvidence {
    return {
        timingPointId: `eventCommit:damage:${id}`,
        gameId: 'test-game',
        position: 'eventCommit',
        factKind: 'damage',
        originalEventType: 'DAMAGE_DEALT',
        originalEventTimestamp: 10,
        commandType: 'ATTACK',
        opportunityIds: [id],
        opportunityTimingPointIds: [`prevent:damage:${id}`],
        appliedOpportunityIds: [id],
    };
}

function createState(): MatchState<unknown> {
    const system = createRefereeTraceSystem({ maxEntries: 2 });
    return {
        core: {},
        sys: createInitialSystemState(['p1', 'p2'], [system]),
    };
}

describe('RefereeTraceSystem', () => {
    it('记录当前事件轮次的 EventCommit 证据，并保留最大条目数', () => {
        const system = createRefereeTraceSystem<unknown>({ maxEntries: 2 });
        const first = system.afterEvents?.({
            state: createState(),
            command,
            events: [{ type: 'DAMAGE_DEALT', payload: {}, timestamp: 10 }],
            eventCommitEvidence: [createEvidence('opp-a'), createEvidence('opp-b')],
            random: mockRandom,
            playerIds: ['p1', 'p2'],
            afterEventsRound: 0,
        });

        expect(getRefereeTraceEntries(first!.state!)).toEqual([
            expect.objectContaining({ id: 1, evidence: expect.objectContaining({ opportunityIds: ['opp-a'] }) }),
            expect.objectContaining({ id: 2, evidence: expect.objectContaining({ opportunityIds: ['opp-b'] }) }),
        ]);

        const second = system.afterEvents?.({
            state: first!.state!,
            command,
            events: [{ type: 'DAMAGE_DEALT', payload: {}, timestamp: 11 }],
            eventCommitEvidence: [createEvidence('opp-c')],
            random: mockRandom,
            playerIds: ['p1', 'p2'],
            afterEventsRound: 1,
        });

        expect(getRefereeTraceEntries(second!.state!).map(entry => entry.id)).toEqual([2, 3]);
        expect(getRefereeTraceEntries(second!.state!).map(entry => entry.evidence.opportunityIds[0]))
            .toEqual(['opp-b', 'opp-c']);
    });

    it('没有提交证据时不创建轨迹条目', () => {
        const system = createRefereeTraceSystem<unknown>();
        const result = system.afterEvents?.({
            state: createState(),
            command,
            events: [{ type: 'DAMAGE_DEALT', payload: {}, timestamp: 10 }],
            eventCommitEvidence: [],
            random: mockRandom,
            playerIds: ['p1', 'p2'],
            afterEventsRound: 0,
        });

        expect(result).toBeUndefined();
    });
});
