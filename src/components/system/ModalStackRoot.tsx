import { AnimatePresence } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useModalStack } from '../../contexts/ModalStackContext';

// 默认起始层级，需覆盖常规页面元素且低于教程/调试层
const DEFAULT_Z_INDEX = 2000;

export const ModalStackRoot = () => {
    const { stack, closeTop, closeModal, closeAll } = useModalStack();
    const location = useLocation();

    useEffect(() => {
        return () => {
            closeAll({ skipOnClose: true });
        };
    }, [closeAll, location.key]);

    // 栈顶条目决定交互与 ESC 行为
    const topEntry = stack[stack.length - 1];

    // 统一渲染到 #modal-root，避免被父容器裁切
    const portalRoot = useMemo(() => {
        if (typeof document === 'undefined') return null;
        return document.getElementById('modal-root');
    }, []);

    // 默认 ESC 关闭栈顶（可由条目关闭）
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
        if (stack.length > 0) {
            setIsLocked(true);
        }
    }, [stack.length]);

    // 真正的 DOM 操作副作用
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

        // 不需要 cleanup，因为我们依靠 isLocked 状态转换来清理
    }, [isLocked]);

    if (!portalRoot) return null;

    return createPortal(
        // Portal 容器必须显式层级，否则处于 auto 层会被页面正 z-index 覆盖
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
                    return (
                        <div
                            key={entry.id}
                            // 非栈顶禁止交互，只保留视觉层级
                            className="fixed inset-0"
                            style={{ zIndex, pointerEvents: isTop ? 'auto' : 'none' }}
                        >
                            {entry.render({
                                close: () => closeModal(entry.id),
                                closeOnBackdrop: entry.closeOnBackdrop ?? true,
                            })}
                        </div>
                    );
                })}
            </AnimatePresence>
        </div>,
        portalRoot
    );
};
