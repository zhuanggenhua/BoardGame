import { useEffect, useState } from 'react';

/**
 * 移动端横屏守卫组件
 * 检测设备方向，竖屏时显示旋转提示，横屏时正常渲染内容
 */
export function MobileOrientationGuard({ children }: { children: React.ReactNode }) {
  const [isPortrait, setIsPortrait] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      // 检测是否为移动设备（屏幕宽度 < 1024px）
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      
      // 仅在移动设备上检测横竖屏
      if (mobile) {
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
  }, []);

  // 移动设备且竖屏时显示提示
  if (isMobile && isPortrait) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center z-[9999]">
        <div className="text-center text-white p-8 max-w-sm">
          {/* 旋转图标动画 */}
          <div className="text-7xl mb-6 animate-bounce">
            📱
          </div>
          <h2 className="text-2xl font-bold mb-3">请旋转设备</h2>
          <p className="text-gray-300 text-lg">
            为获得最佳游戏体验，请将设备旋转至横屏模式
          </p>
          {/* 旋转指示箭头 */}
          <div className="mt-8 flex justify-center items-center gap-4 text-4xl opacity-60">
            <span className="transform rotate-90">📱</span>
            <span>→</span>
            <span>📱</span>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
