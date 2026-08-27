import React, { useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ToastContext } from './toastContextValue';
import { generateUUID } from '../lib/uuid';

export type ToastTone = 'success' | 'info' | 'warning' | 'error';
export type ToastActionVariant = 'primary' | 'secondary';

export type ToastContent =
    | { kind: 'text'; text: string }
    | { kind: 'i18n'; ns?: string; key: string; params?: Record<string, string | number> }
    | { kind: 'reward-points'; text: string; points: number };

export interface ToastAction {
    id?: string;
    label: ToastContent;
    variant?: ToastActionVariant;
    dismissOnClick?: boolean;
    onClick?: () => void;
}

export interface ToastActionInput extends Omit<ToastAction, 'label'> {
    label: string | ToastContent;
}

export interface Toast {
    id: string;
    tone: ToastTone;
    title?: ToastContent;
    message: ToastContent;
    createdAt: number;
    ttlMs?: number;
    dedupeKey?: string;
    actions?: ToastAction[];
}

type ToastInput = Omit<Toast, 'id' | 'createdAt' | 'actions'> & {
    actions?: ToastActionInput[];
};

type ToastOptions = Partial<Omit<ToastInput, 'tone' | 'message' | 'title'>>;

export interface ToastContextType {
    toasts: Toast[];
    show: (toast: ToastInput) => string;
    success: (message: string | ToastContent, title?: string | ToastContent, options?: ToastOptions) => string;
    info: (message: string | ToastContent, title?: string | ToastContent, options?: ToastOptions) => string;
    warning: (message: string | ToastContent, title?: string | ToastContent, options?: ToastOptions) => string;
    error: (message: string | ToastContent, title?: string | ToastContent, options?: ToastOptions) => string;
    dismiss: (id: string) => void;
    clear: () => void;
}

const DEFAULT_TTL: Record<ToastTone, number> = {
    success: 3000,
    info: 4000,
    warning: 5000,
    error: 8000,
};

const normalizeContent = (content: string | ToastContent): ToastContent => {
    if (typeof content === 'string') {
        return { kind: 'text', text: content };
    }
    return content;
};

const normalizeAction = (action: ToastActionInput): ToastAction => ({
    ...action,
    label: normalizeContent(action.label),
});

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastsRef = useRef<Toast[]>([]);

    // 保持 ref 与状态同步，便于 timeout 使用
    useEffect(() => {
        toastsRef.current = toasts;
    }, [toasts]);

    const dismiss = useCallback((id: string) => {
        toastsRef.current = toastsRef.current.filter((t) => t.id !== id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const show = useCallback((toastInput: ToastInput) => {
        const { dedupeKey, tone, actions } = toastInput;

        // 去重检查（验证 dedupeKey 非空）
        if (dedupeKey && dedupeKey.trim()) {
            const existing = toastsRef.current.find((t) => t.dedupeKey === dedupeKey);
            if (existing) {
                // 如果已存在，可更新其时间戳以延长展示，或在过近时忽略
                // 目前直接忽略以避免刷屏
                return existing.id;
            }
        }

        const id = generateUUID();
        const createdAt = Date.now();
        const ttlMs = toastInput.ttlMs ?? DEFAULT_TTL[tone];

        const newToast: Toast = {
            ...toastInput,
            actions: actions?.map(normalizeAction),
            id,
            createdAt,
            ttlMs,
        };

        // 立即同步 ref，避免同一事件循环内重复 show 时 dedupe 失效。
        toastsRef.current = [...toastsRef.current, newToast];
        setToasts((prev) => [...prev, newToast]);

        if (ttlMs !== Infinity) {
            setTimeout(() => {
                dismiss(id);
            }, ttlMs);
        }

        return id;
    }, [dismiss]);

    const success = useCallback((message: string | ToastContent, title?: string | ToastContent, options?: ToastOptions) =>
        show({ tone: 'success', message: normalizeContent(message), title: title ? normalizeContent(title) : undefined, ...options }), [show]);

    const info = useCallback((message: string | ToastContent, title?: string | ToastContent, options?: ToastOptions) =>
        show({ tone: 'info', message: normalizeContent(message), title: title ? normalizeContent(title) : undefined, ...options }), [show]);

    const warning = useCallback((message: string | ToastContent, title?: string | ToastContent, options?: ToastOptions) =>
        show({ tone: 'warning', message: normalizeContent(message), title: title ? normalizeContent(title) : undefined, ...options }), [show]);

    const error = useCallback((message: string | ToastContent, title?: string | ToastContent, options?: ToastOptions) =>
        show({ tone: 'error', message: normalizeContent(message), title: title ? normalizeContent(title) : undefined, ...options }), [show]);

    const clear = useCallback(() => {
        toastsRef.current = [];
        setToasts([]);
    }, []);

    // useMemo 包裹 Provider value，避免 toasts 变化时所有只调用 show/dismiss 的消费者也重渲染
    const value = useMemo(() => ({
        toasts, show, success, info, warning, error, dismiss, clear,
    }), [toasts, show, success, info, warning, error, dismiss, clear]);

    return (
        <ToastContext.Provider value={value}>
            {children}
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
