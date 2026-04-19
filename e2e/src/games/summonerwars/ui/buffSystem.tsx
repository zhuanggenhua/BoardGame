/**
 * 召唤师战争 - Buff 系统配置
 * 
 * 使用通用 BuffSystem 框架，注册游戏特定的 buff
 */

import type { BoardUnit, EventCard, SummonerWarsCore } from '../domain/types';
import { BuffRegistry, type BuffDetector, type BuffRegistration } from '../../../components/game/framework/widgets/BuffSystem';
import { getUnitAbilities } from '../domain/helpers';
import { getEventSpriteConfig, getUnitCardSpriteConfig } from './spriteHelpers';
import { getBaseCardId, CARD_IDS } from '../domain/ids';
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
  core?: SummonerWarsCore;
}

// ============================================================================
// Buff 检测器（游戏特定逻辑）
// ============================================================================

const detectHealing: BuffDetector<GameState, BoardUnit> = (unit) => {
  // 治疗模式来自单位自身技能，无来源卡牌
  return unit.healingMode ? { type: 'healing' } : null;
};

const detectExtraAbilities: BuffDetector<GameState, BoardUnit> = (unit, gameState) => {
  // 通用额外技能检测：比较当前有效技能与卡牌原始技能的差集
  // 覆盖所有来源：力量颂歌 tempAbilities、幻化 tempAbilities、交缠颂歌共享、未来新机制
  if (!gameState.core) {
    if (unit.tempAbilities && unit.tempAbilities.length > 0) {
      return { type: 'extraAbilities', count: unit.tempAbilities.length, data: unit.tempAbilities };
    }
    return null;
  }
  const effective = getUnitAbilities(unit, gameState.core);
  const cardAbilities = unit.card.abilities ?? [];
  const extra = effective.filter(a => !cardAbilities.includes(a));
  if (extra.length === 0) return null;

  // 尝试找到来源事件卡（力量颂歌/交缠颂歌等，targetUnitId 指向本单位）
  let spriteConfig: { atlasId: string; frameIndex: number } | undefined;
  for (const ev of gameState.activeEvents) {
    if (ev.targetUnitId === unit.instanceId) {
      spriteConfig = getEventSpriteConfig(ev);
      break;
    }
  }
  // 也检查对手的 activeEvents
  if (!spriteConfig && gameState.core) {
    for (const pid of ['0', '1'] as const) {
      const player = gameState.core.players[pid];
      if (!player) continue;
      for (const ev of player.activeEvents) {
        if (ev.targetUnitId === unit.instanceId || ev.entanglementTargets?.includes(unit.instanceId)) {
          spriteConfig = getEventSpriteConfig(ev);
          break;
        }
      }
      if (spriteConfig) break;
    }
  }

  return { type: 'extraAbilities', count: extra.length, data: extra, spriteConfig };
};

const detectAttachedUnit: BuffDetector<GameState, BoardUnit> = (unit) => {
  if (unit.attachedUnits && unit.attachedUnits.length > 0) {
    // 来源是附加的单位卡
    const spriteConfig = getUnitCardSpriteConfig(unit.attachedUnits[0].card);
    return { type: 'attachedUnit', count: unit.attachedUnits.length, data: unit.attachedUnits, spriteConfig };
  }
  return null;
};

const detectHypnoticLure: BuffDetector<GameState, BoardUnit> = (unit, gameState) => {
  // 催眠引诱在施法者的 activeEvents 中，需要遍历所有玩家
  const allActiveEvents = gameState.core
    ? (['0', '1'] as const).flatMap(pid => gameState.core!.players[pid]?.activeEvents ?? [])
    : gameState.activeEvents;
  const sourceEvent = allActiveEvents.find(ev => {
    return getBaseCardId(ev.id) === CARD_IDS.TRICKSTER_HYPNOTIC_LURE && ev.targetUnitId === unit.instanceId;
  });
  if (!sourceEvent) return null;
  return { type: 'hypnoticLure', spriteConfig: getEventSpriteConfig(sourceEvent) };
};

const detectHellfireBlade: BuffDetector<GameState, BoardUnit> = (unit) => {
  // 来源是附加在单位上的狱火铸剑事件卡
  const hellfireCard = unit.attachedCards?.find(c => getBaseCardId(c.id) === CARD_IDS.NECRO_HELLFIRE_BLADE);
  if (!hellfireCard) return null;
  return { type: 'hellfireBlade', spriteConfig: getEventSpriteConfig(hellfireCard) };
};

const detectChantWeaving: BuffDetector<GameState, BoardUnit> = (unit, gameState) => {
  // 编织颂歌在施法者的 activeEvents 中，需要遍历所有玩家
  const allActiveEvents = gameState.core
    ? (['0', '1'] as const).flatMap(pid => gameState.core!.players[pid]?.activeEvents ?? [])
    : gameState.activeEvents;
  const sourceEvent = allActiveEvents.find(ev => {
    return getBaseCardId(ev.id) === CARD_IDS.BARBARIC_CHANT_OF_WEAVING && ev.targetUnitId === unit.instanceId;
  });
  if (!sourceEvent) return null;
  return { type: 'chantWeaving', spriteConfig: getEventSpriteConfig(sourceEvent) };
};

// ============================================================================
// Buff 注册配置
// ============================================================================

const SW_NS = 'game-summonerwars';

const BUFF_REGISTRATIONS: BuffRegistration<GameState, BoardUnit>[] = [
  {
    type: 'healing',
    visual: {
      label: '治疗模式',
      labelKey: 'buffs.healing',
      labelNs: SW_NS,
      icon: HealingIcon,
      iconColor: 'text-green-100',
      bgColor: 'bg-green-500',
      glowColor: 'rgba(34,197,94,0.4)',
    },
    detector: detectHealing,
  },
  {
    type: 'extraAbilities',
    visual: {
      label: '额外技能',
      labelKey: 'buffs.extraAbilities',
      labelNs: SW_NS,
      icon: SparkleIcon,
      iconColor: 'text-purple-100',
      bgColor: 'bg-purple-500',
      glowColor: 'rgba(168,85,247,0.4)',
    },
    detector: detectExtraAbilities,
  },
  {
    type: 'attachedUnit',
    visual: {
      label: '附加单位',
      labelKey: 'buffs.attachedUnit',
      labelNs: SW_NS,
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
      labelKey: 'buffs.hypnoticLure',
      labelNs: SW_NS,
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
      label: '狱火铸剑 (+2 攻击)',
      labelKey: 'buffs.hellfireBlade',
      labelNs: SW_NS,
      icon: FlameIcon,
      iconColor: 'text-orange-100',
      bgColor: 'bg-orange-500',
      glowColor: 'rgba(249,115,22,0.4)',
    },
    detector: detectHellfireBlade,
  },
  {
    type: 'chantWeaving',
    visual: {
      label: '编织颂歌（临时召唤点）',
      labelKey: 'buffs.chantWeaving',
      labelNs: SW_NS,
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

export function detectBuffs(unit: BoardUnit, activeEvents: EventCard[], core?: SummonerWarsCore) {
  return summonerWarsBuffRegistry.detectBuffs(unit, { activeEvents, core });
}

export function getBuffGlowStyles(unit: BoardUnit, activeEvents: EventCard[], core?: SummonerWarsCore): string {
  const buffs = detectBuffs(unit, activeEvents, core);
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
