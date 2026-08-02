import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from 'react';
import { AUTH_API_URL, IS_DEV_API_DISABLED } from '../config/server';
import i18n from '../lib/i18n';
import { normalizeDeveloperGameIds } from '../lib/developerGameAccess';
import { getLocalStorage, readLocalStorageItem, removeLocalStorageItem, writeLocalStorageItem } from '../lib/browserStorage';

export type UserRole = 'user' | 'developer' | 'admin';
const BACKOFFICE_ROLES: ReadonlySet<UserRole> = new Set(['developer', 'admin']);

export const isBackofficeRole = (role: UserRole | undefined | null): role is Extract<UserRole, 'developer' | 'admin'> => {
    return role !== undefined && role !== null && BACKOFFICE_ROLES.has(role);
};

interface User {
    id: string;
    username: string;
    email?: string;
    emailVerified?: boolean;
    lastOnline?: string;
    avatar?: string;
    role: UserRole;
    developerGameIds?: string[];
    banned: boolean;
    feedbackPoints: number;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    // account: 邮箱
    login: (email: string, password: string) => Promise<void>;
    register: (username: string, email: string, code: string, password: string) => Promise<void>;
    sendRegisterCode: (email: string) => Promise<void>;
    sendResetCode: (email: string) => Promise<void>;
    resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
    logout: () => void;
    /** 直接更新 token state（供 useTokenRefresh 刷新后同步 React 状态） */
    setTokenDirect: (token: string) => void;
    sendEmailCode: (email: string) => Promise<void>;
    verifyEmail: (email: string, code: string) => Promise<void>;
    changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
    updateUsername: (username: string) => Promise<User>;
    updateAvatar: (avatar: string) => Promise<User>;
    uploadAvatar: (file: File, cropData?: { x: number; y: number; width: number; height: number }) => Promise<User>;
    addFeedbackPoints: (delta: number) => void;
    isLoading: boolean;
}

// 创建一个默认的 noop 实现，避免在 Provider 外部使用时崩溃
const defaultAuthContext: AuthContextType = {
    user: null,
    token: null,
    login: async () => { throw new Error('AuthProvider 未初始化'); },
    register: async () => { throw new Error('AuthProvider 未初始化'); },
    sendRegisterCode: async () => { throw new Error('AuthProvider 未初始化'); },
    sendResetCode: async () => { throw new Error('AuthProvider 未初始化'); },
    resetPassword: async () => { throw new Error('AuthProvider 未初始化'); },
    logout: () => { throw new Error('AuthProvider 未初始化'); },
    setTokenDirect: () => { throw new Error('AuthProvider 未初始化'); },
    sendEmailCode: async () => { throw new Error('AuthProvider 未初始化'); },
    verifyEmail: async () => { throw new Error('AuthProvider 未初始化'); },
    changePassword: async () => { throw new Error('AuthProvider 未初始化'); },
    updateUsername: async () => { throw new Error('AuthProvider 未初始化'); },
    updateAvatar: async () => { throw new Error('AuthProvider 未初始化'); },
    uploadAvatar: async () => { throw new Error('AuthProvider 未初始化'); },
    addFeedbackPoints: () => { throw new Error('AuthProvider 未初始化'); },
    isLoading: true,
};

const AuthContext = createContext<AuthContextType>(defaultAuthContext);

const parseErrorMessage = async (response: Response, fallback: string) => {
    let text = '';
    try {
        text = await response.text();
    } catch {
        return fallback;
    }

    if (!text) {
        return fallback;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
        return fallback;
    }

    try {
        const data = JSON.parse(text) as { error?: string; message?: string };
        return data.error || data.message || fallback;
    } catch {
        return fallback;
    }
};

const normalizeUserRole = (value: unknown): UserRole => {
    if (value === 'admin' || value === 'developer' || value === 'user') {
        return value;
    }
    return 'user';
};

const normalizeAuthUser = (value: unknown): User | null => {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const raw = value as Partial<User>;
    if (typeof raw.id !== 'string' || typeof raw.username !== 'string') {
        return null;
    }

    const role = normalizeUserRole(raw.role);
    const developerGameIds = role === 'developer'
        ? normalizeDeveloperGameIds(raw.developerGameIds)
        : undefined;

    return {
        id: raw.id,
        username: raw.username,
        email: typeof raw.email === 'string' ? raw.email : undefined,
        emailVerified: typeof raw.emailVerified === 'boolean' ? raw.emailVerified : undefined,
        lastOnline: typeof raw.lastOnline === 'string' ? raw.lastOnline : undefined,
        avatar: typeof raw.avatar === 'string' ? raw.avatar : undefined,
        role,
        developerGameIds,
        banned: typeof raw.banned === 'boolean' ? raw.banned : false,
        feedbackPoints: typeof raw.feedbackPoints === 'number' && Number.isFinite(raw.feedbackPoints)
            ? raw.feedbackPoints
            : 0,
    };
};

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const syncedTokenRef = useRef<string | null>(null);
    const currentTokenRef = useRef<string | null>(null);
    currentTokenRef.current = token;

    const clearLocalAuth = useCallback(() => {
        removeLocalStorageItem('auth_token');
        removeLocalStorageItem('auth_user');
    }, []);

    const syncCurrentUser = useCallback(async (tokenToSync: string) => {
        if (IS_DEV_API_DISABLED) {
            return;
        }

        try {
            const response = await fetch(`${AUTH_API_URL}/me`, {
                method: 'GET',
                headers: {
                    'Accept-Language': i18n.language,
                    'Authorization': `Bearer ${tokenToSync}`,
                },
            });

            if (currentTokenRef.current !== tokenToSync) {
                return;
            }

            if (response.status === 401 || response.status === 403 || response.status === 404) {
                setToken(null);
                setUser(null);
                clearLocalAuth();
                return;
            }

            if (!response.ok) {
                return;
            }

            const data = await response.json().catch(() => null) as null | { user?: unknown };
            const normalized = normalizeAuthUser(data?.user);
            if (!normalized) {
                return;
            }

            if (currentTokenRef.current !== tokenToSync) {
                return;
            }

            setUser(normalized);
            writeLocalStorageItem('auth_user', JSON.stringify(normalized));
        } catch {
            // 网络异常时保留本地会话，避免误登出
        }
    }, [clearLocalAuth]);

    // 从 localStorage 加载 token
    useEffect(() => {
        const savedToken = readLocalStorageItem('auth_token');
        const savedUser = readLocalStorageItem('auth_user');

        if (savedToken) {
            setToken(savedToken);
        }

        if (savedUser) {
            try {
                const parsedUser = normalizeAuthUser(JSON.parse(savedUser));
                if (parsedUser) {
                    setUser(parsedUser);
                } else {
                    removeLocalStorageItem('auth_user');
                }
            } catch {
                removeLocalStorageItem('auth_user');
            }
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        if (isLoading) {
            return;
        }

        if (!token) {
            syncedTokenRef.current = null;
            return;
        }

        if (syncedTokenRef.current === token) {
            return;
        }

        syncedTokenRef.current = token;
        void syncCurrentUser(token);
    }, [isLoading, token, syncCurrentUser]);

    // 联动监控服务：标识用户信息（Sentry 异步加载，不阻塞首屏）
    useEffect(() => {
        if (!import.meta.env.PROD) {
            return;
        }
        void import('@sentry/react').then((Sentry) => {
            if (typeof Sentry.setUser !== 'function') {
                return;
            }
            if (user) {
                Sentry.setUser({
                    id: user.id,
                    username: user.username,
                    email: user.email,
                });
            } else {
                Sentry.setUser(null);
            }
        }).catch(() => {
            // 监控 SDK 异步加载失败不能影响用户进入页面。
        });
    }, [user]);

    const login = useCallback(async (email: string, password: string) => {
        const response = await fetch(`${AUTH_API_URL}/login`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', 'Accept-Language': i18n.language },
            body: JSON.stringify({ account: email, password }),
        });

        const payload = await response.json().catch(() => null) as null | {
            success: boolean;
            message?: string;
            code?: string;
            data?: { token?: string; user?: User; suggestRegister?: boolean };
        };

        if (!response.ok || !payload) {
            throw new Error('登录失败');
        }

        if (!payload.success) {
            const error = new Error(payload.message || '登录失败') as Error & { code?: string; suggestRegister?: boolean };
            error.code = payload.code;
            error.suggestRegister = payload.data?.suggestRegister;
            throw error;
        }

        const token = payload.data?.token ?? '';
        const user = payload.data?.user ?? null;
        if (!token || !user) {
            throw new Error('登录响应异常');
        }

        const normalizedUser = normalizeAuthUser(user);
        if (!normalizedUser) {
            throw new Error('登录响应异常');
        }

        setToken(token);
        setUser(normalizedUser);

        writeLocalStorageItem('auth_token', token);
        writeLocalStorageItem('auth_user', JSON.stringify(normalizedUser));
    }, []);

    const sendRegisterCode = useCallback(async (email: string) => {
        const response = await fetch(`${AUTH_API_URL}/send-register-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept-Language': i18n.language },
            body: JSON.stringify({ email }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null) as null | { error?: string; suggestLogin?: boolean };
            const error = new Error(errorData?.error || '发送验证码失败') as Error & { suggestLogin?: boolean };
            error.suggestLogin = errorData?.suggestLogin;
            throw error;
        }
    }, []);

    const sendResetCode = useCallback(async (email: string) => {
        const response = await fetch(`${AUTH_API_URL}/send-reset-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept-Language': i18n.language },
            body: JSON.stringify({ email }),
        });

        if (!response.ok) {
            const message = await parseErrorMessage(response, '发送验证码失败');
            throw new Error(message);
        }
    }, []);

    const register = useCallback(async (username: string, email: string, code: string, password: string) => {
        const response = await fetch(`${AUTH_API_URL}/register`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', 'Accept-Language': i18n.language },
            body: JSON.stringify({ username, email, code, password }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null) as null | { error?: string; suggestLogin?: boolean };
            const error = new Error(errorData?.error || '注册失败') as Error & { suggestLogin?: boolean };
            error.suggestLogin = errorData?.suggestLogin;
            throw error;
        }

        const data = await response.json();
        const normalizedUser = normalizeAuthUser(data.user);
        if (!normalizedUser) {
            throw new Error('注册响应异常');
        }

        setToken(data.token);
        setUser(normalizedUser);

        writeLocalStorageItem('auth_token', data.token);
        writeLocalStorageItem('auth_user', JSON.stringify(normalizedUser));
    }, []);

    const resetPassword = useCallback(async (email: string, code: string, newPassword: string) => {
        const response = await fetch(`${AUTH_API_URL}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept-Language': i18n.language },
            body: JSON.stringify({ email, code, newPassword }),
        });

        if (!response.ok) {
            const message = await parseErrorMessage(response, '重置密码失败');
            throw new Error(message);
        }
    }, []);

    const logout = useCallback(() => {
        if (token) {
            fetch(`${AUTH_API_URL}/logout`, {
                method: 'POST',
                headers: {
                    'Accept-Language': i18n.language,
                    'Authorization': `Bearer ${token}`,
                },
            }).catch(() => {
                // 忽略失败，继续本地退出
            });
        }

        syncedTokenRef.current = null;
        currentTokenRef.current = null;
        setToken(null);
        setUser(null);
        clearLocalAuth();
    }, [token, clearLocalAuth]);

    // 直接更新 token state（供 useTokenRefresh 刷新后同步 React 状态）
    const setTokenDirect = useCallback((newToken: string) => {
        setToken(newToken);
    }, []);

    const sendEmailCode = useCallback(async (email: string) => {
        if (!token) throw new Error('请先登录');

        const response = await fetch(`${AUTH_API_URL}/send-email-code`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept-Language': i18n.language,
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ email }),
        });

        if (!response.ok) {
            const message = await parseErrorMessage(response, '发送验证码失败');
            throw new Error(message);
        }
    }, [token]);

    const verifyEmail = useCallback(async (email: string, code: string) => {
        if (!token) throw new Error('请先登录');

        const response = await fetch(`${AUTH_API_URL}/verify-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept-Language': i18n.language,
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ email, code }),
        });

        if (!response.ok) {
            const message = await parseErrorMessage(response, '验证失败');
            throw new Error(message);
        }

        const data = await response.json();
        const updatedUser = normalizeAuthUser(data.user);
        if (!updatedUser) {
            throw new Error('用户信息更新失败');
        }
        setUser(updatedUser);
        writeLocalStorageItem('auth_user', JSON.stringify(updatedUser));
    }, [token]);

    const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
        if (!token) throw new Error('请先登录');

        const response = await fetch(`${AUTH_API_URL}/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept-Language': i18n.language,
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ currentPassword, newPassword }),
        });

        if (!response.ok) {
            const message = await parseErrorMessage(response, '修改密码失败');
            throw new Error(message);
        }
    }, [token]);

    const updateUsername = useCallback(async (username: string) => {
        if (!token) throw new Error('请先登录');
        const trimmed = username.trim();
        if (!trimmed || trimmed.length < 2 || trimmed.length > 20) {
            throw new Error('昵称长度应在 2-20 个字符之间');
        }

        const response = await fetch(`${AUTH_API_URL}/update-username`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept-Language': i18n.language,
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ username: trimmed }),
        });

        if (!response.ok) {
            const message = await parseErrorMessage(response, '昵称修改失败');
            throw new Error(message);
        }

        const data = await response.json();
        const updatedUser = { ...user, ...data.user } as User;
        setUser(updatedUser);
        writeLocalStorageItem('auth_user', JSON.stringify(updatedUser));

        // 用户名变更后服务端签发了新 JWT，同步更新本地 token
        if (data.token) {
            setToken(data.token);
            writeLocalStorageItem('auth_token', data.token);
        }

        // 同步更新所有已存储的 match credentials 中的 playerName，
        // 避免 validateStoredMatchSeat 因 name_mismatch 清除凭据
        const storage = getLocalStorage();
        const newUsername = updatedUser.username;
        for (let i = 0; storage && i < storage.length; i++) {
            const key = storage.key(i);
            if (!key || !key.startsWith('match_creds_')) continue;
            try {
                const raw = storage.getItem(key);
                if (!raw) continue;
                const creds = JSON.parse(raw);
                if (creds?.playerName && creds.playerName !== newUsername) {
                    creds.playerName = newUsername;
                    storage.setItem(key, JSON.stringify(creds));
                }
            } catch {
                // 忽略解析失败
            }
        }

        return updatedUser;
    }, [token, user]);

    const updateAvatar = useCallback(async (avatar: string) => {
        if (!token) throw new Error('请先登录');
        const normalizedAvatar = avatar.trim();
        if (!normalizedAvatar) throw new Error('请输入头像地址');

        const response = await fetch(`${AUTH_API_URL}/update-avatar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept-Language': i18n.language,
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ avatar: normalizedAvatar }),
        });

        if (!response.ok) {
            const message = await parseErrorMessage(response, '头像更新失败');
            throw new Error(message);
        }

        const data = await response.json();
        const updatedUser = { ...user, ...data.user } as User;
        setUser(updatedUser);
        writeLocalStorageItem('auth_user', JSON.stringify(updatedUser));
        return updatedUser;
    }, [token, user]);

    const uploadAvatar = useCallback(async (file: File, cropData?: { x: number; y: number; width: number; height: number }) => {
        if (!token) throw new Error('请先登录');

        const formData = new FormData();
        formData.append('file', file);
        if (cropData) {
            formData.append('cropX', String(cropData.x));
            formData.append('cropY', String(cropData.y));
            formData.append('cropWidth', String(cropData.width));
            formData.append('cropHeight', String(cropData.height));
        }

        const response = await fetch(`${AUTH_API_URL}/upload-avatar`, {
            method: 'POST',
            headers: {
                'Accept-Language': i18n.language,
                'Authorization': `Bearer ${token}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const message = await parseErrorMessage(response, '头像上传失败');
            throw new Error(message);
        }

        const data = await response.json();
        const updatedUser = { ...user, ...data.user } as User;
        setUser(updatedUser);
        writeLocalStorageItem('auth_user', JSON.stringify(updatedUser));
        return updatedUser;
    }, [token, user]);

    const addFeedbackPoints = useCallback((delta: number) => {
        if (!Number.isFinite(delta) || delta === 0) {
            return;
        }
        setUser((currentUser) => {
            if (!currentUser) {
                return currentUser;
            }
            const nextUser = {
                ...currentUser,
                feedbackPoints: Math.max(0, (currentUser.feedbackPoints ?? 0) + Math.trunc(delta)),
            };
            writeLocalStorageItem('auth_user', JSON.stringify(nextUser));
            return nextUser;
        });
    }, []);

    const contextValue = useMemo(() => ({
        user,
        token,
        login,
        register,
        sendRegisterCode,
        sendResetCode,
        resetPassword,
        logout,
        setTokenDirect,
        sendEmailCode,
        verifyEmail,
        changePassword,
        updateUsername,
        updateAvatar,
        uploadAvatar,
        addFeedbackPoints,
        isLoading,
    }), [
        user,
        token,
        login,
        register,
        sendRegisterCode,
        sendResetCode,
        resetPassword,
        logout,
        setTokenDirect,
        sendEmailCode,
        verifyEmail,
        changePassword,
        updateUsername,
        updateAvatar,
        uploadAvatar,
        addFeedbackPoints,
        isLoading,
    ]);

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    // Context 现在总是有值（要么是 Provider 提供的，要么是默认值）
    return context;
}
