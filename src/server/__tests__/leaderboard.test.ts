import { describe, expect, it } from 'vitest';
import { buildLeaderboardEntries, isLeaderboardHumanPlayer } from '../leaderboard';

describe('leaderboard', () => {
    it('只统计真人玩家，忽略显式标记的 AI 座位', () => {
        const entries = buildLeaderboardEntries([
            {
                players: [
                    { id: 'guest:host-1', ownerKey: 'guest:host-1', name: '房主' },
                    { id: 'AI-1', name: 'AI-1', isAi: true },
                ],
                winnerID: 'AI-1',
            },
            {
                players: [
                    { id: 'guest:host-1', ownerKey: 'guest:host-1', name: '房主' },
                    { id: 'guest:guest-2', ownerKey: 'guest:guest-2', name: '访客' },
                ],
                winnerID: 'guest:host-1',
            },
        ]);

        expect(entries).toEqual([
            { name: '房主', wins: 1, matches: 2 },
            { name: '访客', wins: 0, matches: 1 },
        ]);
    });

    it('兼容旧归档数据，过滤没有 ownerKey 的 AI 名称', () => {
        const entries = buildLeaderboardEntries([
            {
                players: [
                    { id: '0', name: 'Alice' },
                    { id: '1', name: 'AI 2 号位' },
                ],
                winnerID: '0',
            },
            {
                players: [
                    { id: 'Alice', name: 'Alice' },
                    { id: 'AI-1', name: 'AI-1' },
                ],
                winnerID: 'AI-1',
            },
        ]);

        expect(entries).toEqual([
            { name: 'Alice', wins: 1, matches: 2 },
        ]);
    });

    it('有人类 ownerKey 时不因名字像 AI 被误过滤', () => {
        expect(isLeaderboardHumanPlayer({
            id: 'guest:user-1',
            ownerKey: 'guest:user-1',
            name: 'AI玩家',
        })).toBe(true);
    });
});
