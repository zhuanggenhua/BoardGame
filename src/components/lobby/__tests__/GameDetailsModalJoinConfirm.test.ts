import { describe, expect, it } from 'vitest';
import { resolveActiveMatchExitPayload, shouldPromptExitActiveMatch } from '../GameDetailsModal';

const buildStored = (override: Partial<{ matchID: string; playerID: string; credentials: string; gameName: string }> = {}) => ({
    matchID: 'match-1',
    playerID: '1',
    credentials: 'creds',
    gameName: 'tictactoe',
    ...override,
});

describe('GameDetailsModal join confirm helpers', () => {
    it('shouldPromptExitActiveMatch 有活跃对局且目标不同则返回 true', () => {
        expect(shouldPromptExitActiveMatch('match-1', 'match-2')).toBe(true);
    });

    it('shouldPromptExitActiveMatch 相同房间不提示', () => {
        expect(shouldPromptExitActiveMatch('match-1', 'match-1')).toBe(false);
    });

    it('resolveActiveMatchExitPayload 缺少凭证则返回 null', () => {
        const stored = buildStored({ credentials: '' });
        const result = resolveActiveMatchExitPayload('match-1', stored, null, 'dicethrone');
        expect(result).toBeNull();
    });

    it('resolveActiveMatchExitPayload 正常返回退出参数', () => {
        const stored = buildStored({ gameName: 'SmashUp', playerID: '0' });
        const result = resolveActiveMatchExitPayload('match-1', stored, null, 'dicethrone');
        expect(result).toEqual({
            gameName: 'smashup',
            playerID: '0',
            credentials: 'creds',
        });
    });

    it('resolveActiveMatchExitPayload 回退到 ownerActive 与 fallbackGameName', () => {
        const stored = buildStored({ gameName: '' });
        const result = resolveActiveMatchExitPayload(
            'match-1',
            stored,
            { matchID: 'match-1', gameName: 'SummonerWars' },
            'dicethrone'
        );
        expect(result?.gameName).toBe('summonerwars');
    });
});
