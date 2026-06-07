import { describe, expect, it } from 'vitest';
import { buildFeedbackAiDiagnosticPacket as buildComponentPacket } from '../FeedbackHelpers';
import { buildFeedbackAiDiagnosticPacket as buildSharedPacket } from '../../feedback-shared';

const t = ((key: string) => key) as any;

const feedbackItem = {
    _id: 'feedback-1',
    content: '埋骨堂这里有问题',
    type: 'bug' as const,
    severity: 'high' as const,
    status: 'open' as const,
    gameName: 'smashup',
    createdAt: '2026-05-31T12:00:00.000Z',
    stateSnapshot: JSON.stringify({
        core: {
            selectedFactions: {
                '0': 'steampunks_pod',
                '1': 'ghosts',
            },
            factionSelection: {
                takenFactions: ['steampunks_pod', 'ghosts', 'aliens', 'robots'],
                playerSelections: {
                    '0': ['steampunks_pod', 'ghosts'],
                    '1': ['aliens', 'robots'],
                },
            },
        },
        sys: {
            phase: 'main',
            turnNumber: 3,
        },
    }, null, 2),
    clientContext: {
        gameId: 'smashup',
        matchId: 'match-1',
        playerId: '0',
    },
};

describe('buildFeedbackAiDiagnosticPacket', () => {
    it.each([
        ['component helper', buildComponentPacket],
        ['shared helper', buildSharedPacket],
    ])('%s 应显式包含派系摘要', (_label, buildPacket) => {
        const packet = buildPacket(feedbackItem, t);

        expect(packet).toContain('- 派系摘要:');
        expect(packet).toContain('0=steampunks_pod');
        expect(packet).toContain('1=ghosts');
        expect(packet).toContain('已占用 steampunks_pod, ghosts, aliens, robots');
    });
});
