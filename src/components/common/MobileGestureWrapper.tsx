import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useMobileGestures } from '../../hooks/ui/useMobileGestures';

interface MobileGestureWrapperProps {
  children: ReactNode;
}

/**
 * 移动端手势控制包装组件
 * 仅在游戏页面且移动设备上启用双指缩放和拖拽平移
 */
export function MobileGestureWrapper({ children }: MobileGestureWrapperProps) {
  const location = useLocation();
  const isGamePage = location.pathname.startsWith('/play/');
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
  
  const { gesture, reset, transform } = useMobileGestures({
    minScale: 0.5,
    maxScale: 2,
    enabled: isGamePage && isMobile,
  });

  // 非游戏页面或 PC 端，直接渲染子组件
  if (!isGamePage || !isMobile) {
    return <>{children}</>;
  }

  const showResetButton = gesture.scale !== 1 || gesture.translateX !== 0 || gesture.translateY !== 0;

  return (
    <>
      <div
        style={{
          transform,
          transformOrigin: 'center center',
          transition: 'none',
          width: '100%',
          height: '100%',
        }}
      >
        {children}
      </div>
      
      {/* 重置按钮 */}
      {showResetButton && (
        <button
          onClick={reset}
          className="fixed bottom-4 right-4 z-[10000] bg-parchment-brown/95 text-parchment-cream px-4 py-2 rounded-lg shadow-lg border-2 border-parchment-gold/30 backdrop-blur-sm hover:bg-parchment-brown transition-colors font-serif text-sm flex items-center gap-2"
          aria-label="重置视图"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
          重置视图
        </button>
      )}
      
      {/* 手势提示（首次显示） */}
      {isMobile && isGamePage && (
        <div className="fixed bottom-4 left-4 z-[10000] bg-parchment-brown/95 text-parchment-cream px-3 py-2 rounded-lg shadow-lg border-2 border-parchment-gold/30 backdrop-blur-sm font-serif text-xs max-w-[200px]">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <div>
              <div>双指缩放</div>
              <div>单指拖拽</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
