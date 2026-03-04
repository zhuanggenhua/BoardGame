import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * 移动端横屏建议组件
 * 仅在游戏页面（/play/）检测设备方向，竖屏时显示顶部横幅建议
 * 主页和其他页面支持竖屏自适应
 */
export function MobileOrientationGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [isPortrait, setIsPortrait] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // 判断是否为游戏页面（需要建议横屏）
  const isGamePage = location.pathname.startsWith('/play/');

  useEffect(() => {
    const checkOrientation = () => {
      // 检测是否为移动设备（屏幕宽度 < 1024px）
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      
      // 仅在移动设备且游戏页面上检测横竖屏
      if (mobile && isGamePage) {
        const portrait = window.innerHeight > window.innerWidth;
        setIsPortrait(portrait);
        // 如果切换到横屏，重置关闭状态（下次竖屏时再显示）
        if (!portrait) {
          setIsDismissed(false);
        }
      } else {
        setIsPortrait(false);
      }
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, [isGamePage]);

  // 移动设备且竖屏且未关闭时显示建议
  const shouldShowBanner = isMobile && isPortrait && !isDismissed;

  return (
    <>
      {shouldShowBanner && (
        <div className="fixed top-0 left-0 right-0 bg-parchment-brown/95 backdrop-blur-sm text-parchment-cream py-3 px-4 z-[9999] shadow-lg border-b-2 border-parchment-gold/30">
          <div className="flex items-center justify-between gap-3 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 text-sm font-serif">
              {/* 竖屏手机图标 */}
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="7" y="2" width="10" height="20" rx="2" />
                <line x1="12" y1="18" x2="12" y2="18" strokeLinecap="round" />
              </svg>
              <span>建议旋转至横屏以获得更佳体验</span>
              {/* 横屏手机图标 */}
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="10" rx="2" />
                <line x1="18" y1="12" x2="18" y2="12" strokeLinecap="round" />
              </svg>
            </div>
            {/* 关闭按钮 */}
            <button
              onClick={() => setIsDismissed(true)}
              className="flex-shrink-0 p-1 hover:bg-parchment-gold/20 rounded transition-colors"
              aria-label="关闭提示"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
