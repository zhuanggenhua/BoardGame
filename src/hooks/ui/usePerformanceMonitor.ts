/**
 * usePerformanceMonitor — 开发环境 FPS + 内存监控
 *
 * 仅在开发模式下运行，生产环境完全不执行。
 * - FPS 监控：检测连续掉帧时输出警告
 * - 内存监控：每 30 秒采样 JS heap，连续增长超阈值时警告可能存在内存泄漏
 *
 * 用法：在游戏 Board 或特效密集的页面顶层调用一次即可。
 * ```tsx
 * usePerformanceMonitor(); // 开发时自动监控，生产环境空操作
 * ```
 */

import { useEffect, useRef } from 'react';

/** 采样窗口大小（帧数） */
const SAMPLE_SIZE = 60;
/** 警告阈值（FPS） */
const WARN_FPS = 50;
/** 严重阈值（FPS） */
const CRITICAL_FPS = 30;
/** 两次警告之间的最小间隔（ms），避免刷屏 */
const WARN_COOLDOWN = 3000;

/** 内存采样间隔（ms） */
const MEM_SAMPLE_INTERVAL = 30_000;
/** 连续增长多少次才报警（30s × 3 = 90s 持续增长） */
const MEM_CONSECUTIVE_THRESHOLD = 3;
/** 单次增长超过此值才计入（MB），过滤 GC 波动 */
const MEM_GROWTH_MIN_MB = 2;

const isDev = import.meta.env.DEV;

// Chrome 专属 performance.memory 类型
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

function getMemory(): PerformanceMemory | null {
  const perf = performance as Performance & { memory?: PerformanceMemory };
  return perf.memory ?? null;
}

function formatMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

/**
 * 开发环境 FPS + 内存监控。
 * 生产环境下为空操作，零开销。
 */
export function usePerformanceMonitor() {
  const rafRef = useRef(0);
  const memTimerRef = useRef(0);

  // FPS 监控
  useEffect(() => {
    if (!isDev) return;

    const frameTimes: number[] = [];
    let lastTime = 0;
    let lastWarnTime = 0;

    const tick = (now: number) => {
      if (lastTime > 0) {
        frameTimes.push(now - lastTime);

        if (frameTimes.length >= SAMPLE_SIZE) {
          const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
          const fps = 1000 / avg;
          const p95 = [...frameTimes].sort((a, b) => a - b)[Math.floor(frameTimes.length * 0.95)];

          if (fps < WARN_FPS && now - lastWarnTime > WARN_COOLDOWN) {
            const msg = `[性能监控] 平均 ${fps.toFixed(1)} FPS | P95 帧时 ${p95.toFixed(1)}ms`;
            if (fps < CRITICAL_FPS) {
              console.error(`🔴 ${msg} — 严重掉帧，检查动画/渲染逻辑`);
            } else {
              console.warn(`🟡 ${msg} — 低于 60fps，可能存在性能瓶颈`);
            }
            lastWarnTime = now;
          }

          frameTimes.length = 0;
        }
      }
      lastTime = now;
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // 内存泄漏检测（Chrome 专属 performance.memory）
  useEffect(() => {
    if (!isDev) return;

    const mem = getMemory();
    if (!mem) {
      // 非 Chrome 或未启用 --enable-precise-memory-info，静默跳过
      return;
    }

    let prevHeap = mem.usedJSHeapSize;
    let consecutiveGrowth = 0;

    const sample = () => {
      const current = getMemory();
      if (!current) return;

      const heapNow = current.usedJSHeapSize;
      const deltaMB = (heapNow - prevHeap) / 1024 / 1024;

      if (deltaMB > MEM_GROWTH_MIN_MB) {
        consecutiveGrowth++;
        if (consecutiveGrowth >= MEM_CONSECUTIVE_THRESHOLD) {
          console.warn(
            `🟠 [内存监控] JS Heap 连续 ${consecutiveGrowth} 次增长 ` +
            `| 当前 ${formatMB(heapNow)}MB / 上限 ${formatMB(current.jsHeapSizeLimit)}MB ` +
            `| 本次增量 +${deltaMB.toFixed(1)}MB — 可能存在内存泄漏，建议打开 DevTools Memory 面板排查`
          );
        }
      } else {
        // 未增长或 GC 回收了，重置计数
        consecutiveGrowth = 0;
      }

      prevHeap = heapNow;
    };

    memTimerRef.current = window.setInterval(sample, MEM_SAMPLE_INTERVAL);
    return () => window.clearInterval(memTimerRef.current);
  }, []);
}
