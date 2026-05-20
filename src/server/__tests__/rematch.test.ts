import { describe, expect, it } from 'vitest';
import type { MatchMetadata } from '../../engine/transport/storage';
import { applyRematchVoteToggle, resolveRematchPlayerGroups } from '../rematch';

const buildMetadata = (overrides?: Partial<MatchMetadata>): MatchMetadata => ({
    gameName: 'smashup',
    players: {
        0: { name: '房主', credentials: 'cred-0' },
        1: { name: 'AI 1', credentials: 'cred-1' },
        2: { name: 'AI 2', credentials: 'cred-2' },
        3: { name: 'AI 3', credentials: 'cred-3' },
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    setupData: {
        seatControllers: {
            0: { type: 'human' },
            1: { type: 'local-ai' },
            2: { type: 'local-ai' },
            3: { type: 'local-ai' },
        },
    },
    ...overrides,
});

describe('resolveRematchPlayerGroups', () => {
    it('会把 1 真人 3 AI 的四人局区分为 1 个真人席位和 3 个 AI 席位', () => {
        expect(resolveRematchPlayerGroups(buildMetadata())).toEqual({
            requiredPlayerIds: ['0', '1', '2', '3'],
            humanPlayerIds: ['0'],
            aiPlayerIds: ['1', '2', '3'],
        });
    });

    it('会在多人混合局里保留所有真人席位，避免 AI 票替代真人票', () => {
        expect(resolveRematchPlayerGroups(buildMetadata({
            players: {
                0: { name: '玩家 0', credentials: 'cred-0' },
                1: { name: '玩家 1', credentials: 'cred-1' },
                2: { name: 'AI 2', credentials: 'cred-2' },
                3: { name: 'AI 3', credentials: 'cred-3' },
            },
            setupData: {
                seatControllers: {
                    0: { type: 'human' },
                    1: { type: 'human' },
                    2: { type: 'local-ai' },
                    3: { type: 'local-ai' },
                },
            },
        }))).toEqual({
            requiredPlayerIds: ['0', '1', '2', '3'],
            humanPlayerIds: ['0', '1'],
            aiPlayerIds: ['2', '3'],
        });
    });
});

describe('applyRematchVoteToggle', () => {
    it('四人 3 AI 局中，真人点击再来一局后才会连带触发 AI 自动同意并 ready', () => {
        const groups = resolveRematchPlayerGroups(buildMetadata());
        const nextState = applyRematchVoteToggle(
            { votes: {}, ready: false, revision: 0 },
            {
                playerId: '0',
                autoAcceptedPlayerIds: ['1', '2', '3'],
                playerGroups: groups,
            },
        );

        expect(nextState.votes).toEqual({
            0: true,
            1: true,
            2: true,
            3: true,
        });
        expect(nextState.ready).toBe(true);
    });

    it('两真人两 AI 局中，单个真人投票不会因为 AI 自动同意而越过另一位真人', () => {
        const groups = resolveRematchPlayerGroups(buildMetadata({
            players: {
                0: { name: '玩家 0', credentials: 'cred-0' },
                1: { name: '玩家 1', credentials: 'cred-1' },
                2: { name: 'AI 2', credentials: 'cred-2' },
                3: { name: 'AI 3', credentials: 'cred-3' },
            },
            setupData: {
                seatControllers: {
                    0: { type: 'human' },
                    1: { type: 'human' },
                    2: { type: 'local-ai' },
                    3: { type: 'local-ai' },
                },
            },
        }));
        const nextState = applyRematchVoteToggle(
            { votes: {}, ready: false, revision: 0 },
            {
                playerId: '0',
                autoAcceptedPlayerIds: ['2', '3'],
                playerGroups: groups,
            },
        );

        expect(nextState.votes).toEqual({
            0: true,
            2: true,
            3: true,
        });
        expect(nextState.ready).toBe(false);
    });

    it('当最后一张真人票取消时，会同步撤掉 AI 自动同意票', () => {
        const groups = resolveRematchPlayerGroups(buildMetadata());
        const nextState = applyRematchVoteToggle(
            {
                votes: {
                    0: true,
                    1: true,
                    2: true,
                    3: true,
                },
                ready: true,
                revision: 3,
            },
            {
                playerId: '0',
                autoAcceptedPlayerIds: ['1', '2', '3'],
                playerGroups: groups,
            },
        );

        expect(nextState.votes).toEqual({
            0: false,
            1: false,
            2: false,
            3: false,
        });
        expect(nextState.ready).toBe(false);
    });
});
