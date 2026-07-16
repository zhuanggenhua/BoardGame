/**
 * 召唤师战争 - 灰烬技能定义
 *
 * 当前文件先承载卡面文案与静态能力 ID。具体执行器尚未接入的能力保留 effects: []，
 * 避免在玩法未验证前把机制伪装为已实现。
 */

import type { AbilityDef } from './abilities';
import { abilityText } from './abilityTextHelper';
import {
  getUnitAt,
  isCellEmpty,
  isInStraightLine,
  isRangedPathClear,
  manhattanDistance,
  normalizeUnitBoosts,
} from './helpers';
import type { CellCoord, UnitCard } from './types';

export const HUIJIN_ABILITIES: AbilityDef[] = [
  {
    id: 'huijin_call_guards',
    name: abilityText('huijin_call_guards', 'name'),
    description: abilityText('huijin_call_guards', 'description'),
    trigger: 'onPhaseEnd',
    effects: [
      { type: 'custom', actionId: 'huijin_call_guards' },
    ],
    validation: {
      customValidator: (ctx) => {
        if (ctx.sourceUnit.card.unitClass !== 'summoner') return { valid: false, error: '只有召唤师可以召集护卫' };
        if (normalizeUnitBoosts(ctx.sourceUnit.boosts) < 1) return { valid: false, error: '没有充能可消耗' };
        const cardId = ctx.payload.cardId as string | undefined;
        const position = ctx.payload.position as CellCoord | undefined;
        if (!cardId || !position) {
          const hasCommonInHand = ctx.core.players[ctx.playerId].hand.some(card =>
            card.cardType === 'unit' && (card as UnitCard).unitClass === 'common'
          );
          const hasAdjacentEmpty = [
            { row: ctx.sourcePosition.row - 1, col: ctx.sourcePosition.col },
            { row: ctx.sourcePosition.row + 1, col: ctx.sourcePosition.col },
            { row: ctx.sourcePosition.row, col: ctx.sourcePosition.col - 1 },
            { row: ctx.sourcePosition.row, col: ctx.sourcePosition.col + 1 },
          ].some(pos => isCellEmpty(ctx.core, pos));
          return hasCommonInHand && hasAdjacentEmpty
            ? { valid: true }
            : { valid: false, error: '没有可召集的护卫或相邻空格' };
        }
        const card = ctx.core.players[ctx.playerId].hand.find(item => item.id === cardId);
        if (!card || card.cardType !== 'unit' || (card as UnitCard).unitClass !== 'common') {
          return { valid: false, error: '必须选择手牌中的士兵单位' };
        }
        if (manhattanDistance(ctx.sourcePosition, position) !== 1 || !isCellEmpty(ctx.core, position)) {
          return { valid: false, error: '必须放置到召唤师相邻空格' };
        }
        return { valid: true };
      },
    },
  },
  {
    id: 'huijin_ember_summon',
    name: abilityText('huijin_ember_summon', 'name'),
    description: abilityText('huijin_ember_summon', 'description'),
    trigger: 'onSummon',
    effects: [],
  },
  {
    id: 'huijin_ignite',
    name: abilityText('huijin_ignite', 'name'),
    description: abilityText('huijin_ignite', 'description'),
    trigger: 'onDamageCalculation',
    effects: [],
  },
  {
    id: 'huijin_guard_master',
    name: abilityText('huijin_guard_master', 'name'),
    description: abilityText('huijin_guard_master', 'description'),
    trigger: 'onSummon',
    effects: [],
  },
  {
    id: 'huijin_flame_breath',
    name: abilityText('huijin_flame_breath', 'name'),
    description: abilityText('huijin_flame_breath', 'description'),
    trigger: 'beforeAttack',
    effects: [],
  },
  {
    id: 'huijin_counterattack',
    name: abilityText('huijin_counterattack', 'name'),
    description: abilityText('huijin_counterattack', 'description'),
    trigger: 'onAdjacentEnemyAttack',
    effects: [],
  },
  {
    id: 'huijin_shelter',
    name: abilityText('huijin_shelter', 'name'),
    description: abilityText('huijin_shelter', 'description'),
    trigger: 'passive',
    effects: [],
  },
  {
    id: 'huijin_ram',
    name: abilityText('huijin_ram', 'name'),
    description: abilityText('huijin_ram', 'description'),
    trigger: 'afterAttack',
    effects: [
      { type: 'custom', actionId: 'huijin_ram' },
    ],
    validation: {
      requiredPhase: 'attack',
      customValidator: (ctx) => {
        const targetPosition = ctx.payload.targetPosition as CellCoord | undefined;
        const newPosition = ctx.payload.newPosition as CellCoord | undefined;
        if (!targetPosition || !newPosition) return { valid: false, error: '必须选择冲撞目标和位置' };
        if (manhattanDistance(ctx.sourcePosition, targetPosition) !== 1) return { valid: false, error: '目标必须相邻' };
        const target = getUnitAt(ctx.core, targetPosition);
        if (!target || target.owner === ctx.playerId) return { valid: false, error: '目标必须是敌方单位' };
        if (target.card.unitClass !== 'common' && target.card.unitClass !== 'champion') {
          return { valid: false, error: '目标必须是士兵或英雄' };
        }
        if (manhattanDistance(targetPosition, newPosition) !== 1 || !isCellEmpty(ctx.core, newPosition)) {
          return { valid: false, error: '推拉位置必须是目标相邻空格' };
        }
        return { valid: true };
      },
    },
  },
  {
    id: 'huijin_born_of_flame',
    name: abilityText('huijin_born_of_flame', 'name'),
    description: abilityText('huijin_born_of_flame', 'description'),
    trigger: 'onSummon',
    effects: [],
  },
  {
    id: 'huijin_wildfire',
    name: abilityText('huijin_wildfire', 'name'),
    description: abilityText('huijin_wildfire', 'description'),
    trigger: 'onPhaseStart',
    effects: [
      { type: 'damage', target: 'adjacentEnemies', value: 1 },
    ],
  },
  {
    id: 'huijin_quick_shot',
    name: abilityText('huijin_quick_shot', 'name'),
    description: abilityText('huijin_quick_shot', 'description'),
    trigger: 'afterMove',
    effects: [
      { type: 'custom', actionId: 'huijin_quick_shot' },
    ],
    validation: {
      requiredPhase: 'move',
      customValidator: (ctx) => {
        const targetPosition = ctx.payload.targetPosition as CellCoord | undefined;
        if (!targetPosition) return { valid: false, error: '必须选择快速射击目标' };
        const target = getUnitAt(ctx.core, targetPosition);
        if (!target || target.instanceId === ctx.sourceUnit.instanceId) return { valid: false, error: '目标必须是其他单位' };
        const distance = manhattanDistance(ctx.sourcePosition, targetPosition);
        if (distance <= 0 || distance > 3) return { valid: false, error: '目标必须在3格以内' };
        if (!isInStraightLine(ctx.sourcePosition, targetPosition)) return { valid: false, error: '目标必须在直线上' };
        if (!isRangedPathClear(ctx.core, ctx.sourcePosition, targetPosition, ctx.playerId)) {
          return { valid: false, error: '目标不在直线视野内' };
        }
        return { valid: true };
      },
    },
  },
];
