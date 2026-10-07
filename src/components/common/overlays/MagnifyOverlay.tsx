import { useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { UI_Z_INDEX } from "../../../core";

export const MagnifyOverlay = ({
  isOpen,
  onClose,
  children,
  containerClassName = "",
  overlayClassName = "",
  closeLabel,
  closeButtonClassName = "",
  overlayTestId,
  interactive = true,
  closeOnBackdrop = true,
  zIndex = UI_Z_INDEX.magnify,
  renderInPlace = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  containerClassName?: string;
  overlayClassName?: string;
  closeLabel?: string;
  closeButtonClassName?: string;
  overlayTestId?: string;
  interactive?: boolean;
  closeOnBackdrop?: boolean;
  zIndex?: number;
  renderInPlace?: boolean;
}) => {
  const { t } = useTranslation("common");
  const portalRoot = useMemo(() => {
    if (typeof document === "undefined") return null;
    return document.getElementById("modal-root") ?? document.body;
  }, []);

  // 性能优化：始终渲染，只控制可见性（pointer-events 和 opacity）
  // 避免重复挂载/卸载的开销
  // 移除 backdrop-blur 以减少渲染开销
  const overlay = (
    <div
      className={`fixed inset-0 bg-black/30 flex items-center justify-center p-8 transition-opacity duration-75 ${overlayClassName}`}
      style={{
        zIndex,
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen && interactive ? "auto" : "none",
      visibility: isOpen ? "visible" : "hidden",
      }}
      aria-hidden={!isOpen}
      onClick={closeOnBackdrop ? onClose : undefined}
      data-interaction-allow
      data-backdrop-dismiss={closeOnBackdrop ? "enabled" : "disabled"}
      data-testid={overlayTestId}
    >
      <div className="relative inline-flex max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
        <div
          className={`relative rounded-[1vw] overflow-hidden group/modal ${containerClassName}`}
        >
          {children}
          {isOpen && (
            <button
              type="button"
              data-testid={overlayTestId ? `${overlayTestId}-close` : undefined}
              className={`absolute right-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-full border border-white/70 bg-black/55 text-white/90 shadow-lg backdrop-blur-sm transition-colors hover:bg-black/80 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${closeButtonClassName}`}
              onClick={onClose}
              aria-label={closeLabel ?? t("close")}
              title={closeLabel ?? t("close")}
            >
              <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // 游戏画布内的阅读/放大层必须留在当前 transform 树中，才能与 PC 构图同步缩放。
  if (renderInPlace || !portalRoot) {
    return overlay;
  }
  return createPortal(overlay, portalRoot);
};
