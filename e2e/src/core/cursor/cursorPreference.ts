/**
 * 光标偏好持久化（仅登录用户，通过数据库 API）
 */

import type { CursorPreference } from './types';
import { AUTH_API_URL } from '../../config/server';

const DEFAULT_PREFERENCE: CursorPreference = {
    cursorTheme: 'default',
    overrideScope: 'home',
    highContrast: false,
    gameVariants: {},
};

/** 从数据库获取光标偏好 */
export async function fetchCursorPreference(token: string): Promise<CursorPreference> {
    try {
        const res = await fetch(`${AUTH_API_URL}/user-settings/cursor`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return { ...DEFAULT_PREFERENCE };
        const data = await res.json() as { empty?: boolean; settings?: Partial<CursorPreference> };
        if (data.empty || !data.settings) return { ...DEFAULT_PREFERENCE };
        return {
            cursorTheme: data.settings.cursorTheme || 'default',
            overrideScope: data.settings.overrideScope === 'all' ? 'all' : 'home',
            highContrast: data.settings.highContrast === true,
            gameVariants: (data.settings.gameVariants && typeof data.settings.gameVariants === 'object')
                ? data.settings.gameVariants as Record<string, string>
                : {},
        };
    } catch {
        return { ...DEFAULT_PREFERENCE };
    }
}

/** 保存光标偏好到数据库 */
export async function saveCursorPreference(token: string, pref: CursorPreference): Promise<void> {
    await fetch(`${AUTH_API_URL}/user-settings/cursor`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(pref),
    });
}

export { DEFAULT_PREFERENCE as DEFAULT_CURSOR_PREFERENCE };
