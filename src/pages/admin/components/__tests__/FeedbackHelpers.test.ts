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
        appVersion: '0.6.1',
        appCommitSha: 'abc123def456',
        appBuildTime: '2026-06-19T10:00:00.000Z',
        appReleaseChannel: 'production',
        activeElement: {
            tagName: 'button',
            testId: 'confirm-play',
            text: '确认出牌',
        },
        lastUserAction: {
            type: 'click',
            at: '2026-06-07T08:00:00.000Z',
        },
        lastRouteChange: {
            from: '/play/smashup/match/match-1?step=draw',
            to: '/play/smashup/match/match-1?step=confirm',
            trigger: 'pushState' as const,
            at: '2026-06-07T08:00:01.000Z',
        },
        pageFlags: {
            isGamePage: true,
            hasModalOpen: true,
            gameId: 'smashup',
        },
    },
    errorContext: {
        name: 'TypeError',
        message: 'Cannot read properties of undefined',
        jsStack: 'TypeError: Cannot read properties of undefined\n    at CardPanel (CardPanel.tsx:12:3)',
        componentStack: '\n    at CardPanel\n    at MatchRoomWithAudio',
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
        expect(packet).toContain('- activeElement: button[testid=confirm-play] (text=确认出牌)');
        expect(packet).toContain('- lastUserAction: click, at=2026-06-07T08:00:00.000Z');
        expect(packet).toContain('- appVersion: 0.6.1');
        expect(packet).toContain('- appCommitSha: abc123def456');
        expect(packet).toContain('- appBuildTime: 2026-06-19T10:00:00.000Z');
        expect(packet).toContain('- appReleaseChannel: production');
        expect(packet).toContain('### JS 堆栈');
        expect(packet).toContain('### React 组件栈');
    });
});
