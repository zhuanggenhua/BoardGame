import { useMemo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { UI_Z_INDEX } from '../../../core';

export const MagnifyOverlay = ({
    isOpen,
    onClose,
    children,
    containerClassName = '',
    overlayClassName = '',
    closeLabel,
    closeButtonClassName = '',
}: {
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
    containerClassName?: string;
    overlayClassName?: string;
    closeLabel?: string;
    closeButtonClassName?: string;
}) => {
    const portalRoot = useMemo(() => {
        if (typeof document === 'undefined') return null;
        return document.getElementById('modal-root') ?? document.body;
    }, []);

    if (!isOpen) return null;

    const overlay = (
        <div
            className={`fixed inset-0 bg-black/30 flex items-center justify-center p-8 backdrop-blur-sm animate-in fade-in duration-200 ${overlayClassName}`}
            style={{ zIndex: UI_Z_INDEX.magnify }}
            onClick={onClose}
            data-interaction-allow
        >
            {/* 外层 wrapper 不裁剪，让关闭按钮可见 */}
            <div
                className="relative"
                onClick={(e) => e.stopPropagation()}
            >
                {closeLabel && (
                    <button
                        className={`absolute -top-12 right-0 whitespace-nowrap text-white/50 hover:text-white text-sm flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full transition-colors z-10 ${closeButtonClassName}`}
                        onClick={onClose}
                    >
                        {closeLabel}
                    </button>
                )}
                <div
                    className={`rounded-[1vw] overflow-hidden group/modal ${containerClassName}`}
                >
                    {children}
                </div>
            </div>
        </div>
    );

    // 使用 portal 渲染到 modal-root，避免被父级 transform/overflow 裁剪
    return portalRoot ? createPortal(overlay, portalRoot) : overlay;
};
