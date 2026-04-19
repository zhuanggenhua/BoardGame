/**
 * Shader FX 系统 — 类型定义
 *
 * 仅包含 WebGL shader 管线专用的类型。
 * 通用 FX 类型见 ../types.ts。
 */

// ============================================================================
// Uniform
// ============================================================================

/**
 * Uniform 值类型 — 自动映射到 gl.uniform* 调用
 *
 * number            → uniform1f
 * [x, y]            → uniform2f
 * [r, g, b]         → uniform3f
 * [r, g, b, a]      → uniform4f
 */
export type UniformValue =
  | number
  | [number, number]
  | [number, number, number]
  | [number, number, number, number];

// ============================================================================
// ShaderCanvas Props
// ============================================================================

/** ShaderCanvas 组件 Props */
export interface ShaderCanvasProps {
  /** Fragment shader GLSL 源码（不含 vertex shader） */
  fragmentShader: string;

  /**
   * 自定义 uniform 值（每帧自动同步到 GPU）
   *
   * 以下 uniform 由 ShaderCanvas 自动注入，无需手动传入：
   * - uTime       (float)  — 累计时间（秒）
   * - uResolution (vec2)   — canvas CSS 尺寸（像素）
   * - uProgress   (float)  — 动画进度 [0, 1]
   */
  uniforms: Record<string, UniformValue>;

  /** 动画总时长（秒），到时自动触发 onComplete */
  duration: number;

  /** 动画完成回调 */
  onComplete?: () => void;

  /**
   * DPR 上限（可选）
   *
   * 高 DPR 屏幕上全屏 shader 开销很大，对于本身模糊的特效（光柱/辉光）
   * 可传 1 降低渲染分辨率，大幅减少 GPU 负载而视觉几乎无差异。
   * 默认 1.5（特效天然模糊，超过 1.5x 几乎无视觉收益）。
   */
  maxDpr?: number;

  /** 额外 className */
  className?: string;
}
