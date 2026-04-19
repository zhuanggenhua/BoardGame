/**
 * 光标设置变体选择逻辑测试
 *
 * 验证变体选择弹窗的默认选中逻辑是否正确。
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getCursorTheme, getThemesByGameId, getDefaultThemePerGame } from '../../../core/cursor/themes';
import { getAllGames } from '../../../config/games.config';

// 触发光标主题注册
beforeAll(async () => {
    await import('../../../games/cursorRegistry');
});

describe('光标设置变体选择逻辑', () => {
    it('每个游戏的所有变体都应该可以通过 getCursorTheme 获取', () => {
        const games = getAllGames().filter(g => g.type === 'game' && g.cursorTheme);
        const errors: string[] = [];

        for (const game of games) {
            const variants = getThemesByGameId(game.id);
            if (variants.length === 0) {
                errors.push(`游戏 ${game.id} 没有注册任何光标主题`);
                continue;
            }

            for (const variant of variants) {
                const theme = getCursorTheme(variant.id);
                if (!theme) {
                    errors.push(`游戏 ${game.id} 的变体 ${variant.id} 无法通过 getCursorTheme 获取`);
                }
            }
        }

        if (errors.length > 0) {
            throw new Error(`变体获取错误：\n${errors.join('\n')}`);
        }
    });

    it('变体选择弹窗的回退逻辑应该优先使用 manifest 配置', () => {
        const games = getAllGames().filter(g => g.type === 'game' && g.cursorTheme);
        const manifests = games.map(g => ({ id: g.id, cursorTheme: g.cursorTheme }));
        const defaultThemes = getDefaultThemePerGame(manifests);

        const errors: string[] = [];

        for (const game of games) {
            if (!game.cursorTheme) continue;

            // 模拟变体选择弹窗的回退逻辑
            const gameVariants: Record<string, string> = {}; // 假设用户没有记住任何变体
            const fallbackThemeId = gameVariants[game.id] ?? defaultThemes.find(t => t.gameId === game.id)?.id ?? getThemesByGameId(game.id)[0]?.id ?? '';

            if (fallbackThemeId !== game.cursorTheme) {
                errors.push(
                    `游戏 ${game.id} 的变体选择弹窗回退逻辑错误：期望="${game.cursorTheme}"，实际="${fallbackThemeId}"`
                );
            }
        }

        if (errors.length > 0) {
            throw new Error(`变体选择回退逻辑错误：\n${errors.join('\n')}`);
        }
    });

    it('注册顺序调整后，manifest 配置的主题应该仍然可以正确获取', () => {
        // 这个测试确保即使注册顺序改变，manifest 配置的主题仍然有效
        const testCases = [
            { gameId: 'smashup', expectedThemeId: 'smashup-popart' },
            { gameId: 'dicethrone', expectedThemeId: 'dicethrone-critical' },
            { gameId: 'summonerwars', expectedThemeId: 'summonerwars-ethereal' },
            { gameId: 'tictactoe', expectedThemeId: 'tictactoe-neon' },
        ];

        const errors: string[] = [];

        for (const { gameId, expectedThemeId } of testCases) {
            const theme = getCursorTheme(expectedThemeId);
            if (!theme) {
                errors.push(`游戏 ${gameId} 的主题 ${expectedThemeId} 未注册`);
                continue;
            }

            if (theme.gameId !== gameId) {
                errors.push(`主题 ${expectedThemeId} 的 gameId 不匹配：期望="${gameId}"，实际="${theme.gameId}"`);
            }
        }

        if (errors.length > 0) {
            throw new Error(`主题注册错误：\n${errors.join('\n')}`);
        }
    });
});
