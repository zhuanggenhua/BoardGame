import { AnimatePresence } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useModalStack } from '../../contexts/ModalStackContext';
import { UI_Z_INDEX } from '../../core';

// 默认起始层级，需覆盖常规页面元素且低于教程层
const DEFAULT_Z_INDEX = UI_Z_INDEX.modalRoot;

export const ModalStackRoot = () => {
    const { stack, closeTop, closeModal, closeAll } = useModalStack();
    const location = useLocation();

    useEffect(() => {
        return () => {
            closeAll({ skipOnClose: true });
        };
        // 仅在真正离开当前 pathname 时清空弹窗。
        // Home 页的 ?game=xxx 是同一路径下的 URL 驱动详情弹窗，
        // 若跟随 location.key（含 search 变化）一起清空，会把刚根据 search 打开的弹窗立刻关掉。
    }, [closeAll, location.pathname]);

    // 栈顶条目决定交互与退出键行为
    const topEntry = stack[stack.length - 1];

    // 统一渲染到模态根节点，避免被父容器裁切
    const portalRoot = useMemo(() => {
        if (typeof document === 'undefined') return null;
        return document.getElementById('modal-root');
    }, []);

    // 默认按退出键关闭栈顶（可由条目关闭）
    useEffect(() => {
        if (!topEntry) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            if (topEntry.closeOnEsc === false) return;
            event.stopPropagation();
            closeTop();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [closeTop, topEntry]);

    // 控制滚动锁定状态，避免动画还没结束就解锁导致页面跳动
    const [isLocked, setIsLocked] = useState(false);

    useEffect(() => {
        if (stack.length === 0) return;

        let cancelled = false;
        queueMicrotask(() => {
            if (!cancelled) {
                setIsLocked(true);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [stack.length]);

    // 真正的文档操作副作用
    useEffect(() => {
        if (typeof document === 'undefined') return;

        if (!isLocked) {
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
            return;
        };

        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.overflow = 'hidden';
        if (scrollbarWidth > 0) {
            document.body.style.paddingRight = `${scrollbarWidth}px`;
        }

        // 不需要清理函数，因为我们依靠锁定状态转换来恢复
    }, [isLocked]);

    if (!portalRoot) return null;

    return createPortal(
        // 传送门容器必须显式层级，否则处于自动层会被页面正层级覆盖
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: DEFAULT_Z_INDEX }}>
            <AnimatePresence
                onExitComplete={() => {
                    // 只有当栈彻底空了，才解除锁定
                    if (stack.length === 0) {
                        setIsLocked(false);
                    }
                }}
            >
                {stack.map((entry, index) => {
                    const isTop = index === stack.length - 1;
                    const zIndex = entry.zIndex ?? DEFAULT_Z_INDEX + index * 10;
                    const pointerEvents = isTop
                        ? (entry.allowPointerThrough ? 'none' : 'auto')
                        : 'none';
                    return (
                        <div
                            key={entry.id}
                            // 非栈顶禁止交互，只保留视觉层级
                            className="fixed inset-0"
                            style={{ zIndex, pointerEvents }}
                        >
                            <div className={entry.allowPointerThrough ? 'pointer-events-auto' : undefined}>
                                {entry.render({
                                    close: () => closeModal(entry.id),
                                    closeOnBackdrop: entry.closeOnBackdrop ?? true,
                                })}
                            </div>
                        </div>
                    );
                })}
            </AnimatePresence>
        </div>,
        portalRoot
    );
};
