/**
 * VortexShaderEffect — WebGL Shader 版旋涡充能特效
 *
 * 与 VortexEffect 拥有相同的 Props 接口，可直接替换。
 * 内部使用 ShaderCanvas + vortex.frag 实现逐像素的流体旋涡渲染，
 * 视觉质量远超 Canvas 2D 粒子方案。
 *
 * 降级策略：若浏览器不支持 WebGL，ShaderCanvas 会自动触发 onComplete，
 * 调用方可搭配 Canvas 2D 版本做回退。
 *
 * @example
 * ```tsx
 * <div className="relative" style={{ minHeight: 120 }}>
 *   <VortexShaderEffect active intensity="normal" />
 * </div>
 * ```
 */

import React from 'react';
import { ShaderCanvas } from '../../../engine/fx/shader/ShaderCanvas';
import { VORTEX_FRAG } from '../../../engine/fx/shader/shaders/vortex.frag';
import { registerShader } from '../../../engine/fx/shader/ShaderPrecompile';
import type { VortexIntensity, VortexColorTheme, VortexColorSet } from './VortexEffect';

// 模块加载时自动注册 shader 到预编译队列
registerShader(VORTEX_FRAG);

// ============================================================================
// Props
// ============================================================================

export interface VortexShaderEffectProps {
  active: boolean;
  intensity?: VortexIntensity;
  color?: VortexColorTheme;
  customColors?: VortexColorSet;
  /** 旋涡缩放系数，默认 1.0（>1 放大，<1 缩小） */
  size?: number;
  onComplete?: () => void;
  className?: string;
}

// ============================================================================
// 颜色预设（归一化到 0-1 供 GLSL 使用）
// ============================================================================

type RGB = [number, number, number];

/** 归一化 5 色阶预设 */
type NormalizedColorSet = {
  dark: RGB;
  main: RGB;
  sub: RGB;
  bright: RGB;
  glow: RGB;
};

/** 便捷 0-255 → 0-1 */
const n = (r: number, g: number, b: number): RGB => [r / 255, g / 255, b / 255];

const COLOR_PRESETS: Record<'blue' | 'purple' | 'green', NormalizedColorSet> = {
  blue: {
    dark:   n(6, 10, 36),          // 深邃太空底色
    main:   n(40, 80, 180),         // 深蓝旋臂
    sub:    n(80, 140, 255),        // 亮蓝
    bright: n(160, 200, 255),       // 高光偏白蓝
    glow:   n(220, 235, 255),       // 核心辉光
  },
  purple: {
    dark:   n(12, 4, 30),           // 暗紫深空
    main:   n(80, 30, 160),         // 紫旋臂
    sub:    n(140, 70, 230),        // 亮紫
    bright: n(200, 150, 255),       // 薰衣草
    glow:   n(240, 210, 255),       // 核心辉光
  },
  green: {
    dark:   n(4, 16, 12),           // 暗绿深空
    main:   n(20, 100, 60),         // 深翠旋臂
    sub:    n(50, 200, 120),        // 亮翠
    bright: n(150, 255, 200),       // 高光薄荷
    glow:   n(220, 255, 240),       // 核心辉光
  },
};

function resolveNormColors(
  color: VortexColorTheme,
  custom?: VortexColorSet,
): NormalizedColorSet {
  if (color === 'custom' && custom) {
    return {
      dark: [0.02, 0.01, 0.06],
      main: [custom.main[0] / 255, custom.main[1] / 255, custom.main[2] / 255],
      sub: [custom.sub[0] / 255, custom.sub[1] / 255, custom.sub[2] / 255],
      bright: [custom.bright[0] / 255, custom.bright[1] / 255, custom.bright[2] / 255],
      glow: [0.9, 0.92, 1.0],
    };
  }
  return COLOR_PRESETS[color === 'custom' ? 'blue' : color];
}

// ============================================================================
// 组件
// ============================================================================

export const VortexShaderEffect: React.FC<VortexShaderEffectProps> = ({
  active,
  intensity = 'normal',
  color = 'blue',
  customColors,
  size = 2,
  onComplete,
  className = '',
}) => {
  if (!active) return null;

  const isStrong = intensity === 'strong';
  const c = resolveNormColors(color, customColors);
  const dur = isStrong ? 1.4 : 1.0;

  return (
    <ShaderCanvas
      fragmentShader={VORTEX_FRAG}
      uniforms={{
        uDuration: dur,
        uDarkColor: c.dark,
        uBaseColor: c.main,
        uAccentColor: c.sub,
        uBrightColor: c.bright,
        uGlowColor: c.glow,
        uSpiralTightness: 5.0,
        uRotationSpeed: 1.6,
        uIntensity: isStrong ? 1.35 : 0.95,
        uScale: size,
      }}
      duration={dur}
      onComplete={onComplete}
      className={`absolute inset-0 ${className}`}
    />
  );
};
