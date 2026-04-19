/**
 * 通用首次发现提示气泡
 *
 * 当用户第一次遇到某个可交互元素时，显示一次性提示气泡。
 * 之后通过 localStorage 记录"已见过"，永不再显示。
 *
 * 用法：
 * ```tsx
 * <DiscoveryTooltip storageKey="buff-icon-click-hint" message="点击可查看卡牌详情">
 *   <MyClickableIcon />
 * </DiscoveryTooltip>
 * ```
 */

import React, { useEffect, useRef, useState } from 'react';
import { useDiscoveryHint } from '../../../../hooks/useDiscoveryHint';

interface DiscoveryTooltipProps {
  /** localStorage key，唯一标识这条提示，已见过则不再显示 */
  storageKey: string;
  /** 提示文字 */
  message: string;
  /** 自动消失延迟（ms），默认 4000 */
  autoHideMs?: number;
  /** 气泡方向，默认 'top' */
  placement?: 'top' | 'bottom' | 'left' | 'right';
  children: React.ReactNode;
}

const STORAGE_PREFIX = 'kiro_discovery_';

export const DiscoveryTooltip: React.FC<DiscoveryTooltipProps> = ({
  storageKey,
  message,
  autoHideMs = 4000,
  placement = 'top',
  children,
}) => {
  const key = STORAGE_PREFIX + storageKey;
  const [seen, markSeen, loading] = useDiscoveryHint(key);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (seen || loading) return;
    const show = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(show);
  }, [seen, loading]);

  useEffect(() => {
    if (!visible) return;
    timerRef.current = setTimeout(() => dismiss(), autoHideMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [visible, autoHideMs]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = () => {
    setVisible(false);
    markSeen();
  };

  const placementClasses: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses: Record<string, string> = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-amber-400/90 border-x-transparent border-b-transparent border-4',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-amber-400/90 border-x-transparent border-t-transparent border-4',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-amber-400/90 border-y-transparent border-r-transparent border-4',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-amber-400/90 border-y-transparent border-l-transparent border-4',
  };

  return (
    <div className="relative pointer-events-none">
      {children}
      {visible && (
        <div
          className={`absolute ${placementClasses[placement]} z-[200] pointer-events-auto`}
          onClick={(e) => { e.stopPropagation(); dismiss(); }}
        >
          {/* 气泡主体 */}
          <div
            className="relative bg-amber-400/90 backdrop-blur-sm text-black text-[0.65vw] font-medium px-[0.6vw] py-[0.3vw] rounded-lg shadow-xl whitespace-nowrap border border-amber-300/60"
            style={{ animation: 'discovery-bob 1.2s ease-in-out infinite' }}
          >
            {message}
            {/* 关闭按钮 */}
            <span className="ml-[0.4vw] opacity-60 hover:opacity-100 cursor-pointer">✕</span>
          </div>
          {/* 箭头 */}
          <div className={`absolute w-0 h-0 ${arrowClasses[placement]}`} />
        </div>
      )}
    </div>
  );
};
