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
  zIndex = UI_Z_INDEX.magnify,
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
  zIndex?: number;
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
      onClick={onClose}
      data-interaction-allow
      data-testid={overlayTestId}
    >
      {/* 外层 wrapper 不裁剪，让关闭按钮可见 */}
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        {isOpen && (
          <button
            type="button"
            data-testid={overlayTestId ? `${overlayTestId}-close` : undefined}
            className={`absolute right-2 top-2 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/65 text-white/80 shadow-lg transition-colors hover:bg-black/85 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${closeButtonClassName}`}
            onClick={onClose}
            aria-label={closeLabel ?? t("close")}
            title={closeLabel ?? t("close")}
          >
            <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
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
