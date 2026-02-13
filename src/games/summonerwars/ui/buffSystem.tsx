/**
 * 召唤师战争 - Buff 系统配置
 * 
 * 使用通用 BuffSystem 框架，注册游戏特定的 buff
 */

import type { BoardUnit, EventCard } from '../domain/types';
import { BuffRegistry, type BuffDetector, type BuffRegistration } from '../../../components/game/framework/widgets/BuffSystem';
import {
  HealingIcon,
  SparkleIcon,
  SwordIcon,
  TargetIcon,
  FlameIcon,
} from './BuffIconComponents';

// ============================================================================
// 游戏状态类型
// ============================================================================

interface GameState {
  activeEvents: EventCard[];
}

// ============================================================================
// Buff 检测器（游戏特定逻辑）
// ============================================================================

const detectHealing: BuffDetector<GameState, BoardUnit> = (unit) => {
  return unit.healingMode ? { type: 'healing' } : null;
};

const detectTempAbility: BuffDetector<GameState, BoardUnit> = (unit) => {
  if (unit.tempAbilities && unit.tempAbilities.length > 0) {
    return { type: 'tempAbility', count: unit.tempAbilities.length, data: unit.tempAbilities };
  }
  return null;
};

const detectAttachedUnit: BuffDetector<GameState, BoardUnit> = (unit) => {
  if (unit.attachedUnits && unit.attachedUnits.length > 0) {
    return { type: 'attachedUnit', count: unit.attachedUnits.length, data: unit.attachedUnits };
  }
  return null;
};

const detectHypnoticLure: BuffDetector<GameState, BoardUnit> = (unit, gameState) => {
  const isTarget = gameState.activeEvents.some(ev => {
    const baseId = ev.id.replace(/-\d+-\d+$/, '').replace(/-\d+$/, '');
    return baseId === 'trickster-hypnotic-lure' && ev.targetUnitId === unit.cardId;
  });
  return isTarget ? { type: 'hypnoticLure' } : null;
};

const detectHellfireBlade: BuffDetector<GameState, BoardUnit> = (unit) => {
  const hasIt = unit.attachedCards?.some(c => {
    const baseId = c.id.replace(/-\d+-\d+$/, '').replace(/-\d+$/, '');
    return baseId === 'necro-hellfire-blade';
  });
  return hasIt ? { type: 'hellfireBlade' } : null;
};

const detectChantEntanglement: BuffDetector<GameState, BoardUnit> = (unit, gameState) => {
  const isTarget = gameState.activeEvents.some(ev => {
    const baseId = ev.id.replace(/-\d+-\d+$/, '').replace(/-\d+$/, '');
    if (baseId !== 'barbaric-chant-of-entanglement') return false;
    // reduce 中存储的字段是 entanglementTargets: [string, string]
    const targets = (ev as any).entanglementTargets as [string, string] | undefined;
    return targets ? targets.includes(unit.cardId) : false;
  });
  return isTarget ? { type: 'chantEntanglement' } : null;
};

const detectChantWeaving: BuffDetector<GameState, BoardUnit> = (unit, gameState) => {
  const isTarget = gameState.activeEvents.some(ev => {
    const baseId = ev.id.replace(/-\d+-\d+$/, '').replace(/-\d+$/, '');
    if (baseId !== 'barbaric-chant-of-weaving') return false;
    const payload = ev as any;
    return payload.targetUnitId === unit.cardId;
  });
  return isTarget ? { type: 'chantWeaving' } : null;
};

// ============================================================================
// Buff 注册配置
// ============================================================================

const BUFF_REGISTRATIONS: BuffRegistration<GameState, BoardUnit>[] = [
  {
    type: 'healing',
    visual: {
      label: '治疗模式',
      icon: HealingIcon,
      iconColor: 'text-green-100',
      bgColor: 'bg-green-500',
      glowColor: 'rgba(34,197,94,0.4)',
    },
    detector: detectHealing,
  },
  {
    type: 'tempAbility',
    visual: {
      label: '临时技能',
      icon: SparkleIcon,
      iconColor: 'text-purple-100',
      bgColor: 'bg-purple-500',
      glowColor: 'rgba(168,85,247,0.4)',
    },
    detector: detectTempAbility,
  },
  {
    type: 'attachedUnit',
    visual: {
      label: '附加单位',
      icon: SwordIcon,
      iconColor: 'text-blue-100',
      bgColor: 'bg-blue-500',
      glowColor: 'rgba(59,130,246,0.4)',
    },
    detector: detectAttachedUnit,
  },
  {
    type: 'hypnoticLure',
    visual: {
      label: '催眠引诱（召唤师攻击+1）',
      icon: TargetIcon,
      iconColor: 'text-pink-100',
      bgColor: 'bg-pink-500',
      glowColor: 'rgba(236,72,153,0.4)',
    },
    detector: detectHypnoticLure,
  },
  {
    type: 'hellfireBlade',
    visual: {
      label: '狱火铸剑 (+2⚔️)',
      icon: FlameIcon,
      iconColor: 'text-orange-100',
      bgColor: 'bg-orange-500',
      glowColor: 'rgba(249,115,22,0.4)',
    },
    detector: detectHellfireBlade,
  },
  {
    type: 'chantEntanglement',
    visual: {
      label: '交缠颂歌（互相获得对方技能）',
      icon: SparkleIcon,
      iconColor: 'text-emerald-100',
      bgColor: 'bg-emerald-500',
      glowColor: 'rgba(16,185,129,0.4)',
    },
    detector: detectChantEntanglement,
  },
  {
    type: 'chantWeaving',
    visual: {
      label: '编织颂歌（临时召唤点）',
      icon: TargetIcon,
      iconColor: 'text-amber-100',
      bgColor: 'bg-amber-500',
      glowColor: 'rgba(251,191,36,0.4)',
    },
    detector: detectChantWeaving,
  },
];

// ============================================================================
// 导出游戏专用的 Buff 注册表
// ============================================================================

export const summonerWarsBuffRegistry = new BuffRegistry<GameState, BoardUnit>();
summonerWarsBuffRegistry.registerAll(BUFF_REGISTRATIONS);

// ============================================================================
// 便捷函数（兼容旧 API）
// ============================================================================

export function detectBuffs(unit: BoardUnit, activeEvents: EventCard[]) {
  return summonerWarsBuffRegistry.detectBuffs(unit, { activeEvents });
}

export function getBuffGlowStyles(unit: BoardUnit, activeEvents: EventCard[]): string {
  const buffs = detectBuffs(unit, activeEvents);
  if (buffs.length === 0) return '';
  
  const glows = buffs
    .map(buff => {
      const config = summonerWarsBuffRegistry.getVisualConfig(buff.type);
      return config ? `shadow-[0_0_8px_2px_${config.glowColor}]` : '';
    })
    .filter(Boolean);
  
  if (glows.length > 1) {
    return glows.join(' ') + ' animate-pulse-slow';
  }
  
  return glows[0] || '';
}
