import { createContext, useContext, useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { AUTH_API_URL } from '../config/server';
import i18n from '../lib/i18n';

interface User {
    id: string;
    username: string;
    email?: string;
    emailVerified?: boolean;
    lastOnline?: string;
    avatar?: string;
    role: 'user' | 'admin';
    banned: boolean;
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
    sendEmailCode: (email: string) => Promise<void>;
    verifyEmail: (email: string, code: string) => Promise<void>;
    changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
    updateAvatar: (avatar: string) => Promise<User>;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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


export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // 从 localStorage 加载 token
    useEffect(() => {
        const savedToken = localStorage.getItem('auth_token');
        const savedUser = localStorage.getItem('auth_user');

        if (savedToken && savedUser) {
            try {
                const parsedUser = JSON.parse(savedUser) as User;
                setToken(savedToken);
                setUser(parsedUser);
            } catch (error) {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('auth_user');
            }
        }
        setIsLoading(false);
    }, []);

    // 联动监控服务：标识用户信息
    useEffect(() => {
        if (user) {
            // 在 Sentry 中设置用户信息
            Sentry.setUser({
                id: user.id,
                username: user.username,
                email: user.email,
            });
        } else {
            // 登出时清理
            Sentry.setUser(null);
        }
    }, [user]);

    const login = useCallback(async (email: string, password: string) => {
        const response = await fetch(`${AUTH_API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept-Language': i18n.language },
            body: JSON.stringify({ account: email, password }),
        });

        const payload = await response.json().catch(() => null) as null | {
            success: boolean;
            message?: string;
            data?: { token?: string; user?: User };
        };

        if (!response.ok || !payload) {
            throw new Error('登录失败');
        }

        if (!payload.success) {
            throw new Error(payload.message || '登录失败');
        }

        const token = payload.data?.token ?? '';
        const user = payload.data?.user ?? null;
        if (!token || !user) {
            throw new Error('登录响应异常');
        }

        setToken(token);
        setUser(user);

        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_user', JSON.stringify(user));
    }, []);

    const sendRegisterCode = useCallback(async (email: string) => {
        const response = await fetch(`${AUTH_API_URL}/send-register-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept-Language': i18n.language },
            body: JSON.stringify({ email }),
        });

        if (!response.ok) {
            const message = await parseErrorMessage(response, '发送验证码失败');
            throw new Error(message);
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
            headers: { 'Content-Type': 'application/json', 'Accept-Language': i18n.language },
            body: JSON.stringify({ username, email, code, password }),
        });

        if (!response.ok) {
            const message = await parseErrorMessage(response, '注册失败');
            throw new Error(message);
        }

        const data = await response.json();
        setToken(data.token);
        setUser(data.user);

        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('auth_user', JSON.stringify(data.user));
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

        setToken(null);
        setUser(null);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
    }, [token]);

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
        const updatedUser = data.user;
        setUser(updatedUser);
        localStorage.setItem('auth_user', JSON.stringify(updatedUser));
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
        localStorage.setItem('auth_user', JSON.stringify(updatedUser));
        return updatedUser;
    }, [token, user]);

    const contextValue = useMemo(() => ({
        user,
        token,
        login,
        register,
        sendRegisterCode,
        sendResetCode,
        resetPassword,
        logout,
        sendEmailCode,
        verifyEmail,
        changePassword,
        updateAvatar,
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
        sendEmailCode,
        verifyEmail,
        changePassword,
        updateAvatar,
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
    if (!context) {
        throw new Error('useAuth 必须在 AuthProvider 内使用');
    }
    return context;
}
