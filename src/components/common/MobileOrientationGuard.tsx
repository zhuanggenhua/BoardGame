import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * 移动端横屏守卫组件
 * 仅在游戏页面（/play/）检测设备方向，竖屏时显示旋转提示
 * 主页和其他页面支持竖屏自适应
 */
export function MobileOrientationGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [isPortrait, setIsPortrait] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 判断是否为游戏页面（需要强制横屏）
  const isGamePage = location.pathname.startsWith('/play/');

  useEffect(() => {
    const checkOrientation = () => {
      // 检测是否为移动设备（屏幕宽度 < 1024px）
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      
      // 仅在移动设备且游戏页面上检测横竖屏
      if (mobile && isGamePage) {
        setIsPortrait(window.innerHeight > window.innerWidth);
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

  // 移动设备且竖屏时显示建议（不阻止访问）
  return (
    <>
      {isMobile && isPortrait && (
        <div className="fixed top-0 left-0 right-0 bg-parchment-brown/95 backdrop-blur-sm text-parchment-cream py-3 px-4 z-[9999] shadow-lg border-b-2 border-parchment-gold/30">
          <div className="flex items-center justify-center gap-3 text-sm">
            <span className="text-xl">📱</span>
            <span className="font-serif">建议旋转至横屏以获得更佳体验</span>
            <span className="text-xl transform rotate-90">📱</span>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
