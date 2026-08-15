import { useEffect, useRef } from 'react';
import { isTextEntryElement, isTextEntryProxyEligible, scrollTextEntryIntoView } from '../../lib/textEntry';

/**
 * 移动端键盘弹出时，尽量保证「当前聚焦的输入框」可见。
 *
 * 目标：
 * - 不做“整页上抬/位移”的强行布局改写（用户反感）
 * - 只在移动端文本输入运行时做最小滚动辅助
 * - 不影响 PC（默认不启用）
 */
export const TextEntryAutoScrollAgent = () => {
    const lastTargetRef = useRef<HTMLElement | null>(null);
    const lastRunAtRef = useRef<number>(0);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return undefined;
        }

        const isCoarsePointer = () => window.matchMedia?.('(pointer: coarse)').matches ?? false;
        const shouldHandleTarget = (target: Element) => {
            if (!isCoarsePointer()) return false;
            if (isTextEntryProxyEligible(target)) {
                return false;
            }
            if (target.closest('[data-text-entry-autoscroll="off"]')) {
                return false;
            }
            return document.documentElement.dataset.keyboardVisible !== 'true';
        };

        const runScroll = (target: HTMLElement, behavior: ScrollBehavior) => {
            const now = Date.now();
            // 避免 focus/resize 多次触发导致抖动
            if (lastTargetRef.current === target && now - lastRunAtRef.current < 120) {
                return;
            }
            lastTargetRef.current = target;
            lastRunAtRef.current = now;
            scrollTextEntryIntoView(target, behavior);
        };

        const scheduleScroll = (target: HTMLElement) => {
            // 先等一帧，给浏览器完成 focus/键盘布局调整
            requestAnimationFrame(() => {
                runScroll(target, 'auto');
            });
            // 部分 WebView 键盘动画期间 visualViewport 变化是分段的，再补一次兜底
            window.setTimeout(() => {
                runScroll(target, 'auto');
            }, 220);
        };

        const handleFocusIn = (event: FocusEvent) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (!isTextEntryElement(target)) return;
            if (!shouldHandleTarget(target)) return;
            scheduleScroll(target);
        };

        const handleVisualViewportResize = () => {
            const active = document.activeElement;
            if (!isTextEntryElement(active)) return;
            if (!shouldHandleTarget(active)) return;
            runScroll(active, 'auto');
        };

        document.addEventListener('focusin', handleFocusIn, true);
        window.visualViewport?.addEventListener('resize', handleVisualViewportResize);

        return () => {
            document.removeEventListener('focusin', handleFocusIn, true);
            window.visualViewport?.removeEventListener('resize', handleVisualViewportResize);
        };
    }, []);

    return null;
};
