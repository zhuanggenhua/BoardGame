/**
 * ShaderPrecompile — Shader 预编译缓存
 *
 * 在游戏 Board 挂载时提前编译 shader 并执行一次 drawArrays，
 * 触发 GPU 驱动缓存编译结果。后续同源码的 shader 编译几乎零开销。
 *
 * 原理：GPU 驱动按 shader 源码哈希缓存编译产物，
 * 即使不同 WebGL context，只要源码相同就命中缓存。
 *
 * @example
 * ```ts
 * // Board 挂载时
 * useEffect(() => {
 *   precompileShaders([SUMMON_FRAG, VORTEX_FRAG]);
 * }, []);
 * ```
 */

import { createProgram } from './ShaderMaterial';
import { COMMON_VERT } from './shaders/common.vert';

/** 已预编译的 shader 源码集合（避免重复编译） */
const precompiledSet = new Set<string>();

/** 包装组件模块加载时自注册的 shader 队列 */
const pendingShaders = new Set<string>();

/**
 * 注册 shader 源码到预编译队列。
 * 由 Shader 包装组件（如 SummonShaderEffect）在模块顶层调用，
 * 确保 import 时自动进入队列，无需手动在 fxSetup 中声明。
 */
export function registerShader(fragmentShader: string): void {
  if (!precompiledSet.has(fragmentShader)) {
    pendingShaders.add(fragmentShader);
  }
}

/**
 * Flush 所有待预编译的 shader（包括自注册 + 外部传入）。
 * 由 useFxBus 挂载时调用，合并注册表声明的和模块自注册的。
 */
export function flushRegisteredShaders(extraShaders?: string[]): void {
  const all: string[] = [];
  for (const src of pendingShaders) {
    if (!precompiledSet.has(src)) all.push(src);
  }
  if (extraShaders) {
    for (const src of extraShaders) {
      if (!precompiledSet.has(src) && !pendingShaders.has(src)) all.push(src);
    }
  }
  pendingShaders.clear();
  if (all.length > 0) precompileShaders(all);
}

/** 全屏四边形顶点（与 ShaderCanvas 一致） */
const QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

/**
 * 预编译一组 fragment shader。
 * 使用隐藏的 1x1 offscreen canvas 编译 + drawArrays 触发 GPU 缓存。
 * 异步执行，不阻塞主线程（通过 requestIdleCallback / setTimeout 降级）。
 */
export function precompileShaders(fragmentShaders: string[]): void {
  const pending = fragmentShaders.filter((src) => !precompiledSet.has(src));
  if (pending.length === 0) return;

  const schedule = typeof requestIdleCallback === 'function'
    ? requestIdleCallback
    : (cb: () => void) => setTimeout(cb, 1);

  schedule(() => {
    // 创建 1x1 离屏 canvas
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;

    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) return;

    for (const fragSrc of pending) {
      const program = createProgram(gl, COMMON_VERT, fragSrc);
      if (!program) continue;

      gl.useProgram(program);

      // 设置顶点属性
      const posLoc = gl.getAttribLocation(program, 'aPosition');
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      // 执行一次 drawArrays 触发 GPU 延迟编译
      gl.viewport(0, 0, 1, 1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // 清理
      gl.deleteBuffer(buf);
      gl.deleteProgram(program);

      precompiledSet.add(fragSrc);
    }

    // 释放 WebGL context
    const ext = gl.getExtension('WEBGL_lose_context');
    ext?.loseContext();
  });
}
