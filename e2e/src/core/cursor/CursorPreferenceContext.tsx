/**
 * 光标偏好全局 Context（仅登录用户）
 *
 * 初始化时使用默认值（无闪烁），登录后异步从数据库同步。
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { CursorPreference } from './types';
import {
    fetchCursorPreference,
    saveCursorPreference,
    DEFAULT_CURSOR_PREFERENCE,
} from './cursorPreference';
import { useAuth } from '../../contexts/AuthContext';

interface CursorPreferenceContextValue {
    preference: CursorPreference;
    updatePreference: (pref: CursorPreference) => Promise<void>;
}

const CursorPreferenceContext = createContext<CursorPreferenceContextValue>({
    preference: DEFAULT_CURSOR_PREFERENCE,
    updatePreference: async () => {},
});

export function CursorPreferenceProvider({ children }: { children: ReactNode }) {
    const { user, token } = useAuth();
    const [preference, setPreference] = useState<CursorPreference>(DEFAULT_CURSOR_PREFERENCE);

    // 登录用户：异步从数据库同步
    useEffect(() => {
        if (!user || !token) {
            setPreference(DEFAULT_CURSOR_PREFERENCE);
            return;
        }
        let cancelled = false;
        fetchCursorPreference(token).then((pref) => {
            if (cancelled) return;
            setPreference(pref);
        });
        return () => { cancelled = true; };
    }, [user, token]);

    const updatePreference = useCallback(async (pref: CursorPreference) => {
        setPreference(pref);
        if (user && token) {
            await saveCursorPreference(token, pref);
        }
    }, [user, token]);

    const value = useMemo(() => ({ preference, updatePreference }), [preference, updatePreference]);

    return (
        <CursorPreferenceContext.Provider value={value}>
            {children}
        </CursorPreferenceContext.Provider>
    );
}

export function useCursorPreference() {
    return useContext(CursorPreferenceContext);
}
