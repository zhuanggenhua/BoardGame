/**
 * 召唤师战争 - Buff 状态图标组件
 * 
 * 显示单位的附加状态（治疗模式、临时技能、附加单位卡等）
 * 使用通用 BuffSystem 框架
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardUnit, EventCard, PlayerId, SummonerWarsCore } from '../domain/types';
import { summonerWarsBuffRegistry } from './buffSystem';
import { BuffIcons as GenericBuffIcons, BuffDetailsPanel as GenericBuffDetailsPanel, generateBuffGlowStyles, type BuffInstance } from '../../../components/game/framework/widgets/BuffSystem';

// 从独立文件导入图标组件，避免循环依赖
export { HealingIcon, SparkleIcon, SwordIcon, TargetIcon, FlameIcon } from './BuffIconComponents';

// ============================================================================
// Buff 图标区域组件（使用通用框架）
// ============================================================================

interface BuffIconsProps {
  unit: BoardUnit;
  isMyUnit: boolean;
  activeEvents: EventCard[];
  myPlayerId: PlayerId;
  core?: SummonerWarsCore;
  /** 点击 buff 图标的回调 */
  onBuffClick?: (buff: BuffInstance) => void;
}

export const BuffIcons: React.FC<BuffIconsProps> = ({
  unit,
  isMyUnit,
  activeEvents,
  core,
  onBuffClick,
}) => {
  return (
    <GenericBuffIcons
      entity={unit}
      gameState={{ activeEvents, core }}
      registry={summonerWarsBuffRegistry}
      position={isMyUnit ? 'bottom-left' : 'top-right'}
      onBuffClick={onBuffClick}
    />
  );
};

// ============================================================================
// Buff 光效样式（使用通用框架）
// ============================================================================

/**
 * 获取 buff 光效样式
 * 
 * 注意：此光效独立于现有的高亮系统（可移动、可攻击等），
 * 使用不同的 shadow 层级避免冲突
 */
export function getBuffGlowStyle(unit: BoardUnit, activeEvents: EventCard[], core?: SummonerWarsCore): string {
  return generateBuffGlowStyles(unit, { activeEvents, core }, summonerWarsBuffRegistry);
}

// ============================================================================
// Buff 详细信息面板（使用通用框架）
// ============================================================================

interface BuffDetailsPanelProps {
  unit: BoardUnit;
  activeEvents: EventCard[];
  getAbilityName: (abilityId: string) => string;
  core?: SummonerWarsCore;
}

export const BuffDetailsPanel: React.FC<BuffDetailsPanelProps> = ({
  unit,
  activeEvents,
  getAbilityName,
  core,
}) => {
  const { t } = useTranslation('game-summonerwars');
  return (
    <GenericBuffDetailsPanel
      entity={unit}
      gameState={{ activeEvents, core }}
      registry={summonerWarsBuffRegistry}
      title={t('buffs.panelTitle')}
      renderBuffDetail={(buff, visualConfig) => {
        const Icon = visualConfig.icon;
        const baseLabel = visualConfig.labelKey ? t(visualConfig.labelKey, visualConfig.label) : visualConfig.label;
        let label = baseLabel;
        
        // 额外技能：显示具体技能名称
        if (buff.type === 'extraAbilities' && buff.data) {
          const abilityNames = (buff.data as string[]).map(getAbilityName).join('、');
          label = `${baseLabel}：${abilityNames}`;
        }
        
        // 附加单位：显示具体单位名称
        if (buff.type === 'attachedUnit' && buff.data) {
          const unitNames = (buff.data as any[]).map(u => u.card.name).join('、');
          label = `${baseLabel}：${unitNames}`;
        }
        
        return (
          <div className="flex items-center gap-2">
            <Icon className={`w-[1vw] h-[1vw] ${visualConfig.iconColor.replace('100', '400')} flex-shrink-0`} />
            <span className="text-gray-200">{label}</span>
          </div>
        );
      }}
    />
  );
};
