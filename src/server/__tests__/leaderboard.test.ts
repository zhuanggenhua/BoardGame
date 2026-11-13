import { describe, expect, it } from 'vitest';
import { buildLeaderboardEntries, isLeaderboardHumanPlayer } from '../leaderboard';

describe('leaderboard', () => {
    it('游客对局仍是对手，但游客身份不会出现在排行榜', () => {
        const entries = buildLeaderboardEntries([{ players: [
            { id: 'user:1', ownerKey: 'user:1', name: '玩家' },
            { id: 'guest:6433', ownerKey: 'guest:6433', name: '游客6433' },
        ], winnerID: 'user:1' }]);
        expect(entries.map(entry => entry.name)).toEqual(['玩家']);
        expect(entries[0].matches).toBe(1);
    });

    it('旧游客名称不入榜，明确的账号身份不因昵称受影响', () => {
        const entries = buildLeaderboardEntries([{ players: [
            { id: '0', name: '游客6433' },
            { id: 'user:1', ownerKey: 'user:1', name: '游客1234' },
        ], winnerID: 'user:1' }]);
        expect(entries.map(entry => entry.name)).toEqual(['游客1234']);
    });

    it('碰撞的游客编号不会跨对局累积积分影响账号', () => {
        const account = { id: 'user:1', ownerKey: 'user:1', name: '玩家' };
        const guest = { id: 'guest:6433', ownerKey: 'guest:6433', name: '游客6433' };
        const once = buildLeaderboardEntries([{ players: [account, guest], winnerID: 'user:1', endedAt: 2 }]);
        const afterGuestHistory = buildLeaderboardEntries([
            { players: [guest, { id: 'AI-1', name: 'AI-1', isAi: true }], winnerID: 'guest:6433', endedAt: 1 },
            { players: [account, guest], winnerID: 'user:1', endedAt: 2 },
        ]);
        expect(afterGuestHistory).toEqual(once);
    });

    it('AI 对战给真人低权重等级分，但 AI 座位不进入排行榜', () => {
        const entries = buildLeaderboardEntries([
            {
                players: [
                    { id: 'user:host-1', ownerKey: 'user:host-1', name: '房主' },
                    { id: 'AI-1', name: 'AI-1', isAi: true },
                ],
                winnerID: 'user:host-1',
                endedAt: 1,
            },
        ]);

        expect(entries).toEqual([
            {
                name: '房主',
                rating: 10,
                wins: 1,
                losses: 0,
                draws: 0,
                matches: 1,
                winRate: 1,
                provisional: true,
                tier: 'apprentice',
            },
        ]);
    });

    it('输给 AI 会记录真人负场和最低等级分，但仍不显示 AI', () => {
        const entries = buildLeaderboardEntries([
            {
                players: [
                    { id: 'user:host-1', ownerKey: 'user:host-1', name: '房主' },
                    { id: 'AI-1', name: 'AI-1', isAi: true },
                ],
                winnerID: 'AI-1',
                endedAt: 1,
            },
        ]);

        expect(entries).toEqual([
            expect.objectContaining({
                name: '房主',
                rating: 1,
                wins: 0,
                losses: 1,
                draws: 0,
                matches: 1,
                winRate: 0,
                provisional: true,
                tier: 'apprentice',
            }),
        ]);
    });

    it('真人对战仍使用完整等级分权重', () => {
        const entries = buildLeaderboardEntries([
            {
                players: [
                    { id: 'user:host-1', ownerKey: 'user:host-1', name: '房主' },
                    { id: 'user:player-2', ownerKey: 'user:player-2', name: '访客' },
                ],
                winnerID: 'user:host-1',
                endedAt: 1,
            },
        ]);

        expect(entries).toEqual([
            expect.objectContaining({ name: '房主', rating: 30, wins: 1, losses: 0, matches: 1 }),
            expect.objectContaining({ name: '访客', rating: 1, wins: 0, losses: 1, matches: 1 }),
        ]);
    });

    it('兼容旧归档数据，把没有 ownerKey 的 AI 名称当成隐藏 AI 对手', () => {
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
                losses: 1,
                draws: 0,
                matches: 2,
                winRate: 0.5,
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
