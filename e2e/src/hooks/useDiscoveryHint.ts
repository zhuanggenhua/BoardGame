/**
 * 首次发现提示的已读状态管理
 *
 * - 游客：读写 localStorage
 * - 登录用户：读写服务端 API，localStorage 作为乐观缓存
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getSeenHints, markHintSeen } from '../api/user-settings';

const LS_PREFIX = 'discovery_hint_';

/** 从 localStorage 读取单条提示是否已见 */
const lsGet = (key: string) => !!localStorage.getItem(LS_PREFIX + key);
/** 写入 localStorage */
const lsSet = (key: string) => localStorage.setItem(LS_PREFIX + key, '1');

/**
 * 返回 [seen, markSeen, loading]
 * - seen: 是否已见过
 * - markSeen: 标记为已见
 * - loading: 登录用户正在从服务端加载状态时为 true，加载完成前不应显示提示
 */
export function useDiscoveryHint(hintKey: string): [boolean, () => void, boolean] {
    const { user, token } = useAuth();
    const [seen, setSeen] = useState(() => lsGet(hintKey));
    // 登录用户需要等服务端确认，游客直接用本地状态
    const [loading, setLoading] = useState(() => !lsGet(hintKey) && !!token);

    // 登录用户：从服务端同步已读状态
    useEffect(() => {
        if (!token || !user) {
            setLoading(false);
            return;
        }
        // 本地已标记过则跳过网络请求
        if (lsGet(hintKey)) {
            setLoading(false);
            return;
        }

        let cancelled = false;
        getSeenHints(token).then(keys => {
            if (cancelled) return;
            if (keys.includes(hintKey)) {
                lsSet(hintKey);
                setSeen(true);
            }
            setLoading(false);
        }).catch(() => {
            if (!cancelled) setLoading(false);
        });

        return () => { cancelled = true; };
    }, [token, user, hintKey]);

    const markSeen = useCallback(() => {
        if (seen) return;
        lsSet(hintKey);
        setSeen(true);
        if (token) {
            markHintSeen(token, hintKey).catch(() => { /* 静默失败 */ });
        }
    }, [seen, hintKey, token]);

    return [seen, markSeen, loading];
}
