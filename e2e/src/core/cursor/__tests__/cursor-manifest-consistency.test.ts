/**
 * 光标主题 manifest 配置一致性测试
 *
 * 确保每个游戏的 manifest.cursorTheme 配置与实际注册的主题一致。
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getAllGames } from '../../../config/games.config';
import { GAME_MANIFEST } from '../../../games/manifest';
import { getCursorTheme, getDefaultThemePerGame } from '../themes';

// 触发光标主题注册（测试环境需要手动导入）
beforeAll(async () => {
    await import('../../../games/cursorRegistry');
});

describe('光标主题 manifest 配置一致性', () => {
    it('所有游戏的 manifest.cursorTheme 必须指向已注册的主题', () => {
        const games = getAllGames().filter(g => g.type === 'game'); // 只检查游戏，不检查工具
        const errors: string[] = [];

        for (const game of games) {
            if (!game.cursorTheme) {
                errors.push(`游戏 ${game.id} 未配置 cursorTheme`);
                continue;
            }

            const theme = getCursorTheme(game.cursorTheme);
            if (!theme) {
                errors.push(`游戏 ${game.id} 的 cursorTheme="${game.cursorTheme}" 未注册`);
                continue;
            }

            if (theme.gameId !== game.id) {
                errors.push(
                    `游戏 ${game.id} 的 cursorTheme="${game.cursorTheme}" 指向了其他游戏的主题（gameId=${theme.gameId}）`
                );
            }
        }

        if (errors.length > 0) {
            throw new Error(`光标主题配置错误：\n${errors.join('\n')}`);
        }
    });

    it('getDefaultThemePerGame(manifests) 必须返回 manifest 配置的主题', () => {
        const games = getAllGames().filter(g => g.type === 'game' && g.cursorTheme);
        const manifests = games.map(g => ({ id: g.id, cursorTheme: g.cursorTheme }));
        const defaultThemes = getDefaultThemePerGame(manifests);

        const errors: string[] = [];

        for (const game of games) {
            if (!game.cursorTheme) continue;

            const defaultTheme = defaultThemes.find(t => t.gameId === game.id);
            if (!defaultTheme) {
                errors.push(`游戏 ${game.id} 未返回默认主题`);
                continue;
            }

            if (defaultTheme.id !== game.cursorTheme) {
                errors.push(
                    `游戏 ${game.id} 的默认主题不匹配：manifest="${game.cursorTheme}"，实际="${defaultTheme.id}"`
                );
            }
        }

        if (errors.length > 0) {
            throw new Error(`默认主题不匹配：\n${errors.join('\n')}`);
        }
    });

    it('getDefaultThemePerGame() 不传参数时应回退到注册顺序第一个', () => {
        // 这是兼容性测试，确保旧代码不会崩溃
        const defaultThemes = getDefaultThemePerGame();
        expect(defaultThemes.length).toBeGreaterThan(0);
        
        // 每个游戏只应该有一个默认主题
        const gameIds = defaultThemes.map(t => t.gameId);
        const uniqueGameIds = new Set(gameIds);
        expect(gameIds.length).toBe(uniqueGameIds.size);
    });

    it('所有已启用 manifest 必须显式声明移动适配契约', () => {
        const errors: string[] = [];

        for (const manifest of GAME_MANIFEST.filter((entry) => entry.enabled)) {
            if (!Object.prototype.hasOwnProperty.call(manifest, 'mobileProfile')) {
                errors.push(`游戏 ${manifest.id} 未显式声明 mobileProfile`);
            }
            if (!Object.prototype.hasOwnProperty.call(manifest, 'shellTargets')) {
                errors.push(`游戏 ${manifest.id} 未显式声明 shellTargets`);
            }

            const profile = manifest.mobileProfile;
            if (!profile) continue;

            if (profile !== 'none' && !manifest.preferredOrientation) {
                errors.push(`游戏 ${manifest.id} 的 mobileProfile=${profile} 但未声明 preferredOrientation`);
            }

            if (
                (profile === 'landscape-adapted' || profile === 'portrait-adapted')
                && !manifest.mobileLayoutPreset
            ) {
                errors.push(`游戏 ${manifest.id} 的 mobileProfile=${profile} 但未声明 mobileLayoutPreset`);
            }
        }

        if (errors.length > 0) {
            throw new Error(`移动适配 manifest 配置错误：\n${errors.join('\n')}`);
        }
    });
});
