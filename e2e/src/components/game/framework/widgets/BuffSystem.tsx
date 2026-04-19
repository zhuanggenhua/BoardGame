/**
 * 通用 Buff 系统 - 跨游戏复用
 * 
 * 设计原则：
 * 1. 游戏无关 - 不依赖任何特定游戏的类型或逻辑
 * 2. 配置驱动 - 通过配置注册 buff，不需要修改框架代码
 * 3. 可扩展 - 支持自定义图标、检测器、渲染器
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { DiscoveryTooltip } from './DiscoveryTooltip';

// ============================================================================
// 核心类型定义
// ============================================================================

/**
 * Buff 实例 - 检测到的 buff 数据
 */
export interface BuffInstance<TData = any> {
  /** Buff 类型标识符 */
  type: string;
  /** 数量（可选，如多个相同 buff） */
  count?: number;
  /** 额外数据（游戏特定） */
  data?: TData;
  /** 来源卡牌精灵图配置（有值时图标可点击打开大图） */
  spriteConfig?: { atlasId: string; frameIndex: number };
}

/**
 * Buff 视觉配置
 */
export interface BuffVisualConfig {
  /** 显示标签（直接文本或 i18n fallback） */
  label: string;
  /** i18n key（优先于 label） */
  labelKey?: string;
  /** i18n namespace（配合 labelKey 使用） */
  labelNs?: string;
  /** 图标组件 */
  icon: React.ComponentType<{ className?: string }>;
  /** 图标颜色（Tailwind 类名） */
  iconColor: string;
  /** 背景颜色（Tailwind 类名） */
  bgColor: string;
  /** 光效颜色（RGBA 字符串） */
  glowColor: string;
}

/**
 * Buff 检测器 - 游戏实现
 */
export type BuffDetector<TGameState = any, TEntity = any> = (
  entity: TEntity,
  gameState: TGameState
) => BuffInstance | null;

/**
 * Buff 配置注册项
 */
export interface BuffRegistration<TGameState = any, TEntity = any> {
  /** Buff 类型标识符 */
  type: string;
  /** 视觉配置 */
  visual: BuffVisualConfig;
  /** 检测器函数 */
  detector: BuffDetector<TGameState, TEntity>;
}

// ============================================================================
// Buff 注册表
// ============================================================================

/**
 * Buff 注册表 - 每个游戏维护自己的注册表
 */
export class BuffRegistry<TGameState = any, TEntity = any> {
  private registrations = new Map<string, BuffRegistration<TGameState, TEntity>>();

  /**
   * 注册一个 buff
   */
  register(registration: BuffRegistration<TGameState, TEntity>): void {
    this.registrations.set(registration.type, registration);
  }

  /**
   * 批量注册 buffs
   */
  registerAll(registrations: BuffRegistration<TGameState, TEntity>[]): void {
    registrations.forEach(reg => this.register(reg));
  }

  /**
   * 检测实体的所有 buffs
   */
  detectBuffs(entity: TEntity, gameState: TGameState): BuffInstance[] {
    const buffs: BuffInstance[] = [];
    
    for (const registration of this.registrations.values()) {
      const buff = registration.detector(entity, gameState);
      if (buff) {
        buffs.push(buff);
      }
    }
    
    return buffs;
  }

  /**
   * 获取 buff 的视觉配置
   */
  getVisualConfig(type: string): BuffVisualConfig | undefined {
    return this.registrations.get(type)?.visual;
  }

  /**
   * 获取所有注册的 buff 类型
   */
  getAllTypes(): string[] {
    return Array.from(this.registrations.keys());
  }
}

// ============================================================================
// Buff 图标徽章组件（通用）
// ============================================================================

interface BuffIconBadgeProps {
  buff: BuffInstance;
  visualConfig: BuffVisualConfig;
  onClick?: (buff: BuffInstance) => void;
}

/** 解析 buff label：优先使用 i18n key，fallback 到 label 文本 */
function useBuffLabel(visualConfig: BuffVisualConfig): string {
  const { t } = useTranslation(visualConfig.labelNs);
  if (visualConfig.labelKey && visualConfig.labelNs) {
    return t(visualConfig.labelKey, visualConfig.label);
  }
  return visualConfig.label;
}

export const BuffIconBadge: React.FC<BuffIconBadgeProps> = ({ buff, visualConfig, onClick }) => {
  const Icon = visualConfig.icon;
  const resolvedLabel = useBuffLabel(visualConfig);
  // 只有来源卡牌有精灵图配置时才可点击
  const clickable = !!onClick && !!buff.spriteConfig;

  const badge = (
    <div
      className={`relative w-[1.4vw] h-[1.4vw] rounded-full ${visualConfig.bgColor} flex items-center justify-center shadow-lg border-2 border-white/40 ${clickable ? 'cursor-pointer pointer-events-auto hover:brightness-125 transition-[filter]' : ''}`}
      title={resolvedLabel}
      onClick={clickable ? (e) => { e.stopPropagation(); onClick(buff); } : undefined}
    >
      <Icon className={`w-[0.9vw] h-[0.9vw] ${visualConfig.iconColor}`} />
      {buff.count !== undefined && buff.count > 1 && (
        <div className="absolute -top-[0.3vw] -right-[0.3vw] w-[0.8vw] h-[0.8vw] rounded-full bg-white text-black text-[0.5vw] font-bold flex items-center justify-center border border-gray-300">
          {buff.count}
        </div>
      )}
    </div>
  );

  if (!clickable) return badge;

  return (
    <DiscoveryTooltip
      storageKey="buff-icon-click-hint"
      message="点击可查看卡牌详情"
      placement="top"
    >
      {badge}
    </DiscoveryTooltip>
  );
};

// ============================================================================
// Buff 图标区域组件（通用）
// ============================================================================

interface BuffIconsProps<TGameState = any, TEntity = any> {
  entity: TEntity;
  gameState: TGameState;
  registry: BuffRegistry<TGameState, TEntity>;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  className?: string;
  /** 点击 buff 图标的回调，传入则图标可点击 */
  onBuffClick?: (buff: BuffInstance) => void;
}

export function BuffIcons<TGameState = any, TEntity = any>({
  entity,
  gameState,
  registry,
  position,
  className = '',
  onBuffClick,
}: BuffIconsProps<TGameState, TEntity>) {
  const buffs = registry.detectBuffs(entity, gameState);

  if (buffs.length === 0) {
    return null;
  }

  const positionClasses = {
    'top-left': 'top-[3%] left-[3%]',
    'top-right': 'top-[3%] right-[3%]',
    'bottom-left': 'bottom-[3%] left-[3%]',
    'bottom-right': 'bottom-[3%] right-[3%]',
  };

  // 有可点击图标时开启 pointer-events，否则保持 none 避免遮挡地图交互
  const hasClickable = !!onBuffClick && buffs.some(b => !!b.spriteConfig);

  return (
    <div
      className={`absolute ${positionClasses[position]} flex gap-[3%] z-[15] ${hasClickable ? 'pointer-events-auto' : 'pointer-events-none'} ${className}`}
    >
      {buffs.map((buff, index) => {
        const visualConfig = registry.getVisualConfig(buff.type);
        if (!visualConfig) return null;
        
        return (
          <BuffIconBadge
            key={`${buff.type}-${index}`}
            buff={buff}
            visualConfig={visualConfig}
            onClick={onBuffClick}
          />
        );
      })}
    </div>
  );
}

// ============================================================================
// Buff 光效工具函数（通用）
// ============================================================================

/**
 * 生成 buff 光效样式
 */
export function generateBuffGlowStyles<TGameState = any, TEntity = any>(
  entity: TEntity,
  gameState: TGameState,
  registry: BuffRegistry<TGameState, TEntity>
): string {
  const buffs = registry.detectBuffs(entity, gameState);
  
  if (buffs.length === 0) return '';
  
  const glows = buffs
    .map(buff => {
      const config = registry.getVisualConfig(buff.type);
      return config ? `shadow-[0_0_8px_2px_${config.glowColor}]` : '';
    })
    .filter(Boolean);
  
  // 多个 buff 时添加脉动动画
  if (glows.length > 1) {
    return glows.join(' ') + ' animate-pulse-slow';
  }
  
  return glows[0] || '';
}

// ============================================================================
// Buff 详情面板组件（通用）
// ============================================================================

interface BuffDetailsPanelProps<TGameState = any, TEntity = any> {
  entity: TEntity;
  gameState: TGameState;
  registry: BuffRegistry<TGameState, TEntity>;
  title?: string;
  className?: string;
  /** 自定义渲染函数（可选） */
  renderBuffDetail?: (buff: BuffInstance, visualConfig: BuffVisualConfig) => React.ReactNode;
}

/** 默认 buff 详情行（支持 i18n label） */
const DefaultBuffDetailRow: React.FC<{ visualConfig: BuffVisualConfig }> = ({ visualConfig }) => {
  const resolvedLabel = useBuffLabel(visualConfig);
  const Icon = visualConfig.icon;
  return (
    <div className="flex items-center gap-2">
      <Icon className={`w-[1vw] h-[1vw] ${visualConfig.iconColor.replace('100', '400')} flex-shrink-0`} />
      <span className="text-gray-200">{resolvedLabel}</span>
    </div>
  );
};

export function BuffDetailsPanel<TGameState = any, TEntity = any>({
  entity,
  gameState,
  registry,
  title,
  className = '',
  renderBuffDetail,
}: BuffDetailsPanelProps<TGameState, TEntity>) {
  const buffs = registry.detectBuffs(entity, gameState);

  if (buffs.length === 0) {
    return null;
  }

  return (
    <div className={`bg-black/95 text-white text-[0.7vw] rounded-lg px-3 py-2 shadow-2xl border border-white/30 min-w-[14vw] backdrop-blur-sm ${className}`}>
      {title && (
        <div className="font-bold mb-2 text-amber-400 text-[0.75vw] border-b border-amber-400/30 pb-1">
          {title}
        </div>
      )}
      <div className="space-y-1.5">
        {buffs.map((buff, index) => {
          const visualConfig = registry.getVisualConfig(buff.type);
          if (!visualConfig) return null;

          if (renderBuffDetail) {
            return <div key={index}>{renderBuffDetail(buff, visualConfig)}</div>;
          }

          return <DefaultBuffDetailRow key={index} visualConfig={visualConfig} />;
        })}
      </div>
    </div>
  );
}
