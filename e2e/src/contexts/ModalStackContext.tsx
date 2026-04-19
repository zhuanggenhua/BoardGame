import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

// 渲染函数由调用方提供，close 与遮罩策略由栈统一注入
type ModalRender = (api: { close: () => void; closeOnBackdrop: boolean }) => ReactNode;

export interface ModalEntry {
    id: string;
    render: ModalRender;
    // 默认行为：不配置则启用 ESC / 遮罩关闭 / 滚动锁
    closeOnEsc?: boolean;
    closeOnBackdrop?: boolean;
    lockScroll?: boolean;
    zIndex?: number;
    /** 允许指针事件穿透到背景（用于教程等不应拦截交互的弹层） */
    allowPointerThrough?: boolean;
    // 由栈触发的关闭回调（例如 ESC/编程关闭）
    onClose?: () => void;
}

interface ModalStackContextValue {
    stack: ModalEntry[];
    openModal: (entry: Omit<ModalEntry, 'id'> & { id?: string }) => string;
    closeModal: (id: string) => void;
    closeTop: () => void;
    replaceTop: (entry: Omit<ModalEntry, 'id'> & { id?: string }) => string;
    closeAll: (options?: { skipOnClose?: boolean }) => void;
    /**
     * 基于「命名空间前缀」关闭弹窗。
     *
     * 用途：路由切换时清理某个模块遗留的弹窗（例如大厅 HUD 打开的好友聊天），
     * 避免「进入大厅自动销毁旧房间」时，全局弹窗残留在新页面。
     *
     * 规则：以 `${namespace}_` 作为前缀匹配。namespace 必须是稳定短串（如 `hud`/`game`）。
     */
    closeByNamespace: (namespace: string, options?: { skipOnClose?: boolean }) => void;
}

const ModalStackContext = createContext<ModalStackContextValue | null>(null);

// 保证每次打开都有稳定唯一的栈条目 ID
const createId = () => `modal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const ModalStackProvider = ({ children }: { children: ReactNode }) => {
    const [stack, setStack] = useState<ModalEntry[]>([]);
    const stackRef = useRef<ModalEntry[]>([]);
    const pendingOnCloseRef = useRef<Array<() => void>>([]);

    // 日志已移除：ModalStack 操作过于频繁，不再需要调试
    const logModalAction = useCallback(
        (_action: string, _entry?: Partial<ModalEntry> & { id?: string }, _nextSize?: number) => {
            // 日志已禁用
        },
        []
    );

    const enqueueOnClose = useCallback((callbacks: Array<(() => void) | undefined>) => {
        callbacks.forEach((cb) => {
            if (cb) pendingOnCloseRef.current.push(cb);
        });
    }, []);

    useEffect(() => {
        stackRef.current = stack;
        if (!pendingOnCloseRef.current.length) return;
        const tasks = pendingOnCloseRef.current;
        pendingOnCloseRef.current = [];
        tasks.forEach((task) => task());
    }, [stack]);

    // 追加栈顶（默认行为由 ModalStackRoot 统一处理）
    const openModal = useCallback((entry: Omit<ModalEntry, 'id'> & { id?: string }) => {
        const id = entry.id ?? createId();
        logModalAction('open', { ...entry, id }, stackRef.current.length + 1);
        setStack((prev) => [...prev, { ...entry, id }]);
        return id;
    }, [logModalAction]);

    // 精确关闭某个栈条目
    const closeModal = useCallback((id: string) => {
        const target = stackRef.current.find((item) => item.id === id);
        logModalAction('close', { ...target, id }, Math.max(0, stackRef.current.length - 1));
        enqueueOnClose([target?.onClose]);
        setStack((prev) => prev.filter((item) => item.id !== id));
    }, [enqueueOnClose, logModalAction]);

    // 关闭栈顶
    const closeTop = useCallback(() => {
        const target = stackRef.current[stackRef.current.length - 1];
        logModalAction('closeTop', target, Math.max(0, stackRef.current.length - 1));
        enqueueOnClose([target?.onClose]);
        setStack((prev) => prev.slice(0, -1));
    }, [enqueueOnClose, logModalAction]);

    // 替换栈顶，用于从一个弹窗跳转到另一个弹窗
    const replaceTop = useCallback((entry: Omit<ModalEntry, 'id'> & { id?: string }) => {
        const id = entry.id ?? createId();
        const target = stackRef.current[stackRef.current.length - 1];
        logModalAction('replaceTop', { ...entry, id }, stackRef.current.length);
        enqueueOnClose([target?.onClose]);
        setStack((prev) => [...prev.slice(0, -1), { ...entry, id }]);
        return id;
    }, [enqueueOnClose, logModalAction]);

    // 关闭所有弹窗（默认触发各自 onClose，可按需跳过）
    const closeAll = useCallback((options?: { skipOnClose?: boolean }) => {
        const targets = stackRef.current;
        logModalAction('closeAll', undefined, 0);
        if (!options?.skipOnClose) {
            enqueueOnClose(targets.map((item) => item.onClose));
        }
        setStack([]);
    }, [enqueueOnClose, logModalAction]);

    const closeByNamespace = useCallback((namespace: string, options?: { skipOnClose?: boolean }) => {
        const prefix = `${namespace}_`;
        const targets = stackRef.current.filter((item) => item.id.startsWith(prefix));
        if (targets.length === 0) return;
        logModalAction('closeByNamespace', { id: prefix }, stackRef.current.length - targets.length);
        if (!options?.skipOnClose) {
            enqueueOnClose(targets.map((item) => item.onClose));
        }
        setStack((prev) => prev.filter((item) => !item.id.startsWith(prefix)));
    }, [enqueueOnClose, logModalAction]);

    const value = useMemo(
        () => ({ stack, openModal, closeModal, closeTop, replaceTop, closeAll, closeByNamespace }),
        [stack, openModal, closeModal, closeTop, replaceTop, closeAll, closeByNamespace]
    );

    return <ModalStackContext.Provider value={value}>{children}</ModalStackContext.Provider>;
};

export const useModalStack = () => {
    const context = useContext(ModalStackContext);
    if (!context) {
        throw new Error('useModalStack 必须在 ModalStackProvider 内使用');
    }
    return context;
};
