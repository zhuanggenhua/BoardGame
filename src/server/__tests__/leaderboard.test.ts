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
                endedAt: 1,
            },
            {
                players: [
                    { id: 'guest:host-1', ownerKey: 'guest:host-1', name: '房主' },
                    { id: 'guest:guest-2', ownerKey: 'guest:guest-2', name: '访客' },
                ],
                winnerID: 'guest:host-1',
                endedAt: 2,
            },
        ]);

        expect(entries).toEqual([
            {
                name: '房主',
                rating: 30,
                wins: 1,
                losses: 0,
                draws: 0,
                matches: 1,
                winRate: 1,
                provisional: true,
                tier: 'apprentice',
            },
            {
                name: '访客',
                rating: 1,
                wins: 0,
                losses: 1,
                draws: 0,
                matches: 1,
                winRate: 0,
                provisional: true,
                tier: 'apprentice',
            },
        ]);
    });

    it('兼容旧归档数据，过滤没有 ownerKey 的 AI 名称', () => {
        const entries = buildLeaderboardEntries([
            {
                players: [
                    { id: '0', name: 'Alice' },
                    { id: '1', name: 'Bob' },
                ],
                winnerID: '0',
                endedAt: 1,
            },
            {
                players: [
                    { id: 'Alice', name: 'Alice' },
                    { id: 'AI-1', name: 'AI-1' },
                ],
                winnerID: 'AI-1',
                endedAt: 2,
            },
        ]);

        expect(entries).toEqual([
            {
                name: 'Alice',
                rating: 30,
                wins: 1,
                losses: 0,
                draws: 0,
                matches: 1,
                winRate: 1,
                provisional: true,
                tier: 'apprentice',
            },
            {
                name: 'Bob',
                rating: 1,
                wins: 0,
                losses: 1,
                draws: 0,
                matches: 1,
                winRate: 0,
                provisional: true,
                tier: 'apprentice',
            },
        ]);
    });

    it('有人类 ownerKey 时不因名字像 AI 被误过滤', () => {
        expect(isLeaderboardHumanPlayer({
            id: 'guest:user-1',
            ownerKey: 'guest:user-1',
            name: 'AI玩家',
        })).toBe(true);
    });

    it('多人局按赢家击败所有其他真人来计算 ELO，其他玩家并列落败', () => {
        const entries = buildLeaderboardEntries([
            {
                players: [
                    { id: 'a', name: 'A' },
                    { id: 'b', name: 'B' },
                    { id: 'c', name: 'C' },
                ],
                winnerID: 'a',
            },
        ]);

        expect(entries).toEqual([
            expect.objectContaining({ name: 'A', rating: 45, wins: 1, losses: 0, matches: 1 }),
            expect.objectContaining({ name: 'B', rating: 1, wins: 0, losses: 1, matches: 1 }),
            expect.objectContaining({ name: 'C', rating: 1, wins: 0, losses: 1, matches: 1 }),
        ]);
    });

    it('主排序使用 ELO，不再让纯胜场数决定名次', () => {
        const records = [];
        for (let index = 0; index < 10; index += 1) {
            records.push({
                players: [
                    { id: 'grinder', name: 'Grinder' },
                    { id: `filler-${index}`, name: `Filler ${index}` },
                ],
                winnerID: 'grinder',
                endedAt: index,
            });
        }
        for (let index = 0; index < 12; index += 1) {
            records.push({
                players: [
                    { id: 'grinder', name: 'Grinder' },
                    { id: 'punisher', name: 'Punisher' },
                ],
                winnerID: 'punisher',
                endedAt: 20 + index,
            });
        }
        for (let index = 0; index < 4; index += 1) {
            records.push({
                players: [
                    { id: 'challenger', name: 'Challenger' },
                    { id: `challenger-filler-${index}`, name: `Challenger Filler ${index}` },
                ],
                winnerID: 'challenger',
                endedAt: 100 + index,
            });
        }

        const entries = buildLeaderboardEntries(records);
        const challengerIndex = entries.findIndex((entry) => entry.name === 'Challenger');
        const grinderIndex = entries.findIndex((entry) => entry.name === 'Grinder');
        const challenger = entries[challengerIndex];
        const grinder = entries[grinderIndex];

        expect(challengerIndex).toBeGreaterThanOrEqual(0);
        expect(grinderIndex).toBeGreaterThanOrEqual(0);
        expect(challengerIndex).toBeLessThan(grinderIndex);
        expect(challenger.wins).toBeLessThan(grinder.wins);
        expect(challenger.rating).toBeGreaterThan(grinder.rating);
    });
});
