/**
 * 引擎命令错误的 i18n 翻译工具
 *
 * 查找顺序：game-<gameId> 的 error.<key> → game 的 error.<key> → 原始字符串
 * 引擎级错误码（player_mismatch 等）统一定义在 game.json，
 * 游戏级错误码定义在各自的 game-<gameId>.json，可覆盖引擎级。
 */
import type { i18n as I18nInstance } from 'i18next';

export const UI_HINT_ONLY_ERRORS = new Set(['请先完成当前选择']);

export function resolveCommandError(i18n: I18nInstance, error: string, gameId?: string): string {
    const key = `error.${error}`;

    // 1. 优先查游戏专属 namespace
    if (gameId) {
        const gameNs = `game-${gameId}`;
        if (i18n.exists(key, { ns: gameNs })) {
            return i18n.t(key, { ns: gameNs });
        }
    }

    // 2. fallback 到通用 game namespace（引擎级错误码）
    if (i18n.exists(key, { ns: 'game' })) {
        return i18n.t(key, { ns: 'game' });
    }

    // 3. 都没有，返回原始字符串
    return error;
}

export function isUiHintOnlyError(error: string, i18n?: I18nInstance, gameId?: string): boolean {
    if (UI_HINT_ONLY_ERRORS.has(error)) return true;
    if (!i18n) return false;
    return UI_HINT_ONLY_ERRORS.has(resolveCommandError(i18n, error, gameId));
}
