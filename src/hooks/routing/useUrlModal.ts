import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useModalStack, type ModalEntry } from '../../contexts/ModalStackContext';

type ModalRenderFn = ModalEntry['render'];

interface UseUrlModalOptions {
    /** URL 参数名，例如 'game' 对应 ?game=xxx */
    paramKey: string;
    /** 根据参数值生成弹窗配置，返回 null 表示该值无效不打开弹窗 */
    getModalConfig: (paramValue: string) => {
        render: ModalRenderFn;
        closeOnBackdrop?: boolean;
        closeOnEsc?: boolean;
        lockScroll?: boolean;
        zIndex?: number;
    } | null;
}

/**
 * URL 驱动弹窗 Hook
 *
 * 自动处理：
 * 1. URL 参数存在 → 打开弹窗
 * 2. 用户关闭弹窗 → 清理 URL 参数
 * 3. 路由切换 → 弹窗由 ModalStackRoot 自动清理，不触发 URL 清理
 * 4. 刷新后重建 → 检测栈状态，确保弹窗正确打开
 */
export function useUrlModal({ paramKey, getModalConfig }: UseUrlModalOptions) {
    const [searchParams, setSearchParams] = useSearchParams();
    const { openModal, closeModal, stack } = useModalStack();

    // 当前管理的弹窗 ID 与对应的参数值
    const modalIdRef = useRef<string | null>(null);
    const boundValueRef = useRef<string | null>(null);
    // 标记是否正在进行路由导航（用于区分关闭原因）
    const isNavigatingRef = useRef(false);

    const paramValue = searchParams.get(paramKey);

    // 检查弹窗是否真正存在于栈中
    const isModalInStack = modalIdRef.current
        ? stack.some((entry) => entry.id === modalIdRef.current)
        : false;

    // 用户主动关闭弹窗时清理 URL
    const handleUserClose = useCallback(() => {
        // 路由导航触发的关闭不清理 URL（由路由自然处理）
        if (isNavigatingRef.current) {
            modalIdRef.current = null;
            boundValueRef.current = null;
            return;
        }

        modalIdRef.current = null;
        boundValueRef.current = null;

        // 只清理当前 key，保留其他参数
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete(paramKey);
            return next;
        }, { replace: true });
    }, [paramKey, setSearchParams]);

    // 同步 URL ↔ Modal
    useEffect(() => {
        // 无参数值：关闭已存在的弹窗
        if (!paramValue) {
            if (modalIdRef.current) {
                closeModal(modalIdRef.current);
                modalIdRef.current = null;
                boundValueRef.current = null;
            }
            return;
        }

        // 参数值变化或弹窗不在栈中：需要（重新）打开
        const needsOpen =
            boundValueRef.current !== paramValue ||
            !modalIdRef.current ||
            !isModalInStack;

        if (!needsOpen) return;

        // 先关闭旧弹窗
        if (modalIdRef.current) {
            closeModal(modalIdRef.current);
            modalIdRef.current = null;
        }

        const config = getModalConfig(paramValue);
        if (!config) {
            // 无效参数值，清理 URL
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete(paramKey);
                return next;
            }, { replace: true });
            boundValueRef.current = null;
            return;
        }

        boundValueRef.current = paramValue;
        modalIdRef.current = openModal({
            closeOnBackdrop: config.closeOnBackdrop ?? true,
            closeOnEsc: config.closeOnEsc ?? true,
            lockScroll: config.lockScroll ?? true,
            zIndex: config.zIndex,
            onClose: handleUserClose,
            render: config.render,
        });
    }, [
        closeModal,
        getModalConfig,
        handleUserClose,
        isModalInStack,
        openModal,
        paramKey,
        paramValue,
        setSearchParams,
    ]);

    // 提供给调用方的导航辅助函数（稳定引用，可安全用于 render 闭包）
    const navigateAwayRef = useRef(() => {
        isNavigatingRef.current = true;
        queueMicrotask(() => {
            isNavigatingRef.current = false;
        });
    });

    return {
        /** 当前参数值 */
        paramValue,
        /** 弹窗是否打开 */
        isOpen: !!paramValue && isModalInStack,
        /** 调用此函数后立即 navigate，可避免 onClose 清理 URL（稳定引用） */
        navigateAwayRef,
    };
}
