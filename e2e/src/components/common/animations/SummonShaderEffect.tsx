/**
 * SummonShaderEffect — WebGL Shader 版召唤光柱特效
 *
 * 与 SummonEffect 拥有相同的 Props 接口，可直接替换。
 * 内部使用 ShaderCanvas + summon.frag 实现逐像素渲染，
 * 包含全屏暗角遮罩（dimming overlay）。
 *
 * 降级策略：若浏览器不支持 WebGL，ShaderCanvas 会自动触发 onComplete，
 * 调用方可搭配 Canvas 2D 版本做回退。
 *
 * @example
 * ```tsx
 * <div className="relative" style={{ minHeight: 320 }}>
 *   <SummonShaderEffect active intensity="strong" color="gold" dimStrength={0.6} />
 * </div>
 * ```
 */

import React from 'react';
import { ShaderCanvas } from '../../../engine/fx/shader/ShaderCanvas';
import { SUMMON_FRAG } from '../../../engine/fx/shader/shaders/summon.frag';
import { registerShader } from '../../../engine/fx/shader/ShaderPrecompile';
import type { SummonIntensity, SummonColorTheme, SummonColorSet } from './SummonEffect';

// 模块加载时自动注册 shader 到预编译队列
registerShader(SUMMON_FRAG);

// ============================================================================
// Props
// ============================================================================

export interface SummonShaderEffectProps {
  active: boolean;
  intensity?: SummonIntensity;
  color?: SummonColorTheme;
  customColors?: SummonColorSet;
  /** 光柱原点 Y 位置（0~1，相对于容器高度从顶部算起，默认 0.78） */
  originY?: number;
  /** 暗角遮罩强度（0=无遮罩 1=最暗，默认 0.55） */
  dimStrength?: number;
  onComplete?: () => void;
  className?: string;
}

// ============================================================================
// 颜色预设（归一化到 0-1 供 GLSL 使用）
// ============================================================================

type RGB = [number, number, number];

interface NormalizedColors {
  base: RGB;
  sub: RGB;
  bright: RGB;
  glow: RGB;
}

/** 便捷 0-255 → 0-1 */
const n = (r: number, g: number, b: number): RGB => [r / 255, g / 255, b / 255];

const COLOR_PRESETS: Record<'blue' | 'gold', NormalizedColors> = {
  blue: {
    base:   n(59, 130, 246),      // blue-500
    sub:    n(120, 180, 255),     // 饱和蓝
    bright: n(160, 210, 255),     // 亮蓝（保留蓝色饱和度）
    glow:   n(200, 230, 255),     // 辉光蓝（不推向纯白）
  },
  gold: {
    base:   n(245, 158, 11),      // amber-500
    sub:    n(251, 191, 36),      // amber-400
    bright: n(255, 235, 190),     // warm white
    glow:   n(255, 250, 235),     // almost white
  },
};

function resolveColors(
  color: SummonColorTheme,
  custom?: SummonColorSet,
): NormalizedColors {
  if (color === 'custom' && custom) {
    return {
      base:   [custom.main[0] / 255, custom.main[1] / 255, custom.main[2] / 255],
      sub:    [custom.sub[0] / 255, custom.sub[1] / 255, custom.sub[2] / 255],
      bright: [custom.bright[0] / 255, custom.bright[1] / 255, custom.bright[2] / 255],
      glow:   [0.95, 0.96, 1.0],
    };
  }
  return COLOR_PRESETS[color === 'custom' ? 'blue' : color];
}

// ============================================================================
// 组件
// ============================================================================

export const SummonShaderEffect: React.FC<SummonShaderEffectProps> = ({
  active,
  intensity = 'normal',
  color = 'blue',
  customColors,
  originY = 0.78,
  dimStrength = 0.55,
  onComplete,
  className = '',
}) => {
  if (!active) return null;

  const isStrong = intensity === 'strong';
  const c = resolveColors(color, customColors);
  const dur = isStrong ? 1.4 : 1.1;

  // originY：SummonEffect 使用 "从顶部算起" 约定（0.78 = 靠近底部）
  // shader vUv：y=0 底部，y=1 顶部 → 需要翻转
  const shaderOriginY = 1.0 - originY;

  return (
    <ShaderCanvas
      fragmentShader={SUMMON_FRAG}
      uniforms={{
        uDuration: dur,
        uBaseColor: c.base,
        uSubColor: c.sub,
        uBrightColor: c.bright,
        uGlowColor: c.glow,
        uOriginY: shaderOriginY,
        uIntensity: isStrong ? 1.3 : 1.0,
        uDimStrength: dimStrength,
        uPillarWidth: isStrong ? 0.04 : 0.03,
      }}
      duration={dur}
      onComplete={onComplete}
      maxDpr={1}
      className={`absolute inset-0 ${className}`}
    />
  );
};
