import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { UI_Z_INDEX } from "../../../core";
import "./magnify-overlay.css";

export const MagnifyOverlay = ({
  isOpen,
  onClose,
  children,
  containerClassName = "",
  overlayClassName = "",
  closeLabel,
  closeButtonClassName = "",
  revealCloseAfterPointerMove = true,
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
  revealCloseAfterPointerMove?: boolean;
  overlayTestId?: string;
  interactive?: boolean;
  closeOnBackdrop?: boolean;
  zIndex?: number;
  renderInPlace?: boolean;
}) => {
  const { t } = useTranslation("common");
  const [pointerMoved, setPointerMoved] = useState(false);
  const backdropPressedRef = useRef(false);
  useEffect(() => {
    setPointerMoved(false);
    backdropPressedRef.current = false;
  }, [isOpen]);
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
      onPointerDown={(event) => {
        backdropPressedRef.current = event.target === event.currentTarget;
      }}
      onPointerCancel={() => { backdropPressedRef.current = false; }}
      onClick={(event) => {
        // 长按打开预览时，手指松开可能把点击派发给刚出现的遮罩。
        const shouldDismiss = event.detail === 0 || backdropPressedRef.current;
        backdropPressedRef.current = false;
        if (closeOnBackdrop && shouldDismiss) onClose();
      }}
      data-interaction-allow
      data-backdrop-dismiss={closeOnBackdrop ? "enabled" : "disabled"}
      data-testid={overlayTestId}
    >
      <div className="relative inline-flex max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
        <div
          className={`relative rounded-[1vw] overflow-hidden group/modal ${containerClassName}`}
          data-close-pointer-ready={!revealCloseAfterPointerMove || pointerMoved ? "true" : "false"}
          onPointerMove={(event) => {
            if (revealCloseAfterPointerMove && ((event.movementX || 0) !== 0 || (event.movementY || 0) !== 0)) setPointerMoved(true);
          }}
        >
          {children}
          {isOpen && (
            <button
              type="button"
              data-magnify-interactive={interactive ? "true" : "false"}
              data-testid={overlayTestId ? `${overlayTestId}-close` : undefined}
              className={`magnify-overlay-close absolute right-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-full border border-white/70 bg-black/55 text-white/90 shadow-lg backdrop-blur-sm transition-colors hover:bg-black/80 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${closeButtonClassName}`}
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
