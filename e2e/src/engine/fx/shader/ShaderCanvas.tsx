/**
 * ShaderCanvas — WebGL Shader 特效渲染组件
 *
 * 职责：
 * - 管理 WebGL context + fullscreen quad 几何
 * - 驱动 RAF 渲染循环，每帧更新 uniform 并绘制
 * - 自动处理 DPI 缩放、resize、context lost
 * - 动画结束后自动触发 onComplete
 *
 * 内置 uniform（无需手动传入）：
 * - uTime       (float)  — 累计时间（秒）
 * - uResolution (vec2)   — canvas CSS 尺寸（像素）
 * - uProgress   (float)  — 动画进度 [0, 1]
 *
 * @example
 * ```tsx
 * <ShaderCanvas
 *   fragmentShader={VORTEX_FRAG}
 *   uniforms={{ uBaseColor: [0.4, 0.6, 1.0] }}
 *   duration={1.0}
 *   onComplete={() => console.log('done')}
 *   className="absolute inset-0"
 * />
 * ```
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { createProgram, setUniforms } from './ShaderMaterial';
import { COMMON_VERT } from './shaders/common.vert';
import type { ShaderCanvasProps, UniformValue } from './types';

// ============================================================================
// Fullscreen Quad 顶点数据
// ============================================================================

// TRIANGLE_STRIP 顺序：左下、右下、左上、右上
const QUAD_VERTICES = new Float32Array([
  -1, -1,
   1, -1,
  -1,  1,
   1,  1,
]);

// ============================================================================
// 组件
// ============================================================================

export const ShaderCanvas: React.FC<ShaderCanvasProps> = ({
  fragmentShader,
  uniforms,
  duration,
  onComplete,
  maxDpr,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // 稳定化外部 uniforms 引用（避免每帧重建对象）
  const uniformsRef = useRef(uniforms);
  uniformsRef.current = uniforms;

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 获取父容器尺寸
    const parent = canvas.parentElement;
    const cw = parent?.offsetWidth ?? canvas.offsetWidth;
    const ch = parent?.offsetHeight ?? canvas.offsetHeight;

    // DPI 缩放（默认 1.5x 上限，特效天然模糊，超过几乎无视觉收益）
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr ?? 1.5);
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;

    // 创建 WebGL context
    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) {
      console.warn('[ShaderCanvas] WebGL not available');
      onCompleteRef.current?.();
      return;
    }

    // 编译 program
    const program = createProgram(gl, COMMON_VERT, fragmentShader);
    if (!program) {
      onCompleteRef.current?.();
      return;
    }

    gl.useProgram(program);

    // 设置顶点属性
    const positionLoc = gl.getAttribLocation(program, 'aPosition');
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // 启用 alpha 混合（additive 效果在 shader 中控制）
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // 渲染循环
    // 跳过前几帧不计时：WebGL 延迟编译导致第一次 drawArrays 可能卡数百毫秒，
    // 如果从第一帧开始计时，编译卡顿会被算入动画进度导致"跳帧"
    let startTime = 0;
    let warmupFrames = 2;

    const loop = (now: number) => {
      // 预热阶段：执行绘制但不推进动画进度，等 GPU 编译完成
      if (warmupFrames > 0) {
        warmupFrames--;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        const warmupUniforms: Record<string, UniformValue> = {
          uTime: 0,
          uResolution: [cw, ch],
          uProgress: 0,
        };
        setUniforms(gl, program, warmupUniforms);
        setUniforms(gl, program, uniformsRef.current);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      if (!startTime) startTime = now;
      const elapsed = (now - startTime) / 1000;
      const progress = Math.min(1, elapsed / duration);

      // 更新 viewport
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      // 设置内置 uniform
      const builtinUniforms: Record<string, UniformValue> = {
        uTime: elapsed,
        uResolution: [cw, ch],
        uProgress: progress,
      };
      setUniforms(gl, program, builtinUniforms);

      // 设置用户自定义 uniform
      setUniforms(gl, program, uniformsRef.current);

      // 绘制 fullscreen quad
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // 动画结束判断
      if (progress >= 1) {
        // 清理资源
        gl.deleteBuffer(positionBuffer);
        gl.deleteProgram(program);
        onCompleteRef.current?.();
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    // 返回清理函数
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (positionBuffer) gl.deleteBuffer(positionBuffer);
      if (program) gl.deleteProgram(program);
    };
  }, [fragmentShader, duration, maxDpr]);

  useEffect(() => {
    const cleanup = render();
    return () => {
      cancelAnimationFrame(rafRef.current);
      cleanup?.();
    };
  }, [render]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none ${className}`}
    />
  );
};
