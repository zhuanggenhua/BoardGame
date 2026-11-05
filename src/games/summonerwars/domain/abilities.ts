
import type { AbilityDef } from './abilityTypes';
import { abilityText } from './abilityTextHelper';
import type { CellCoord } from './types';
import { isUndeadCard, isPlagueZombieCard } from './ids';
import { isCellEmpty, getPlayerUnits } from './helpers';
import { abilityRegistry } from './abilityRegistry';
import { TRICKSTER_ABILITIES } from './abilities-trickster';
import { GOBLIN_ABILITIES } from './abilities-goblin';
import { PALADIN_ABILITIES } from './abilities-paladin';
import { FROST_ABILITIES } from './abilities-frost';
import { BARBARIC_ABILITIES } from './abilities-barbaric';
import { MOGU_ABILITIES } from './abilities-mogu';
import { HUIJIN_ABILITIES } from './abilities-huijin';
import { SHOUREN_ABILITIES } from './abilities-shouren';
import { YONGHENG_ABILITIES } from './abilities-yongheng';
import { SHADOW_ABILITIES } from './abilities-shadow';
import { ZHONGCAI_ABILITIES } from './abilities-zhongcai';

export { type AbilityTrigger, type TargetRef, type AbilityEffect, type Expression, type AbilityCondition, type AbilityUIContext, type AbilityActivationStep, type AbilityActivationContext, type AbilityDef, type ValidationContext, type ValidationResult } from './abilityTypes';
export { abilityRegistry } from './abilityRegistry';

// ============================================================================
// 亡灵法师阵营技能定义
// ============================================================================

/**
 * 亡灵法师阵营技能
 */
export const NECROMANCER_ABILITIES: AbilityDef[] = [
  // 召唤师 - 复活死灵
  {
    id: 'revive_undead',
    name: abilityText('revive_undead', 'name'),
    description: abilityText('revive_undead', 'description'),
    sfxKey: 'magic.dark.29.dark_resurrection',
    trigger: 'activated',
    condition: {
      type: 'and',
      conditions: [
        { type: 'hasCardInDiscard', cardType: 'undead' },
      ],
    },
    effects: [
      { type: 'damage', target: 'self', value: 2 },
      { type: 'summonFromDiscard', cardType: 'undead', position: 'self' },
    ],
    cost: { selfDamage: 2 },
    usesPerTurn: 1,
    requiresTargetSelection: true,
    targetSelection: {
      type: 'card',
      filter: { type: 'isUnitType', target: 'self', unitType: 'undead' },
    },
    interactionChain: {
      steps: [
        { step: 'selectCard', inputType: 'card', producesField: 'targetCardId' },
        { step: 'selectPosition', inputType: 'position', producesField: 'targetPosition' },
      ],
      payloadContract: {
        required: ['targetCardId', 'targetPosition'],
      },
    },
    validation: {
      requiredPhase: 'summon',
      customValidator: (ctx) => {
        const targetCardId = ctx.payload.targetCardId as string | undefined;
        const targetPosition = ctx.payload.targetPosition as import('./types').CellCoord | undefined;
        
        if (!targetCardId) return { valid: false, error: '必须选择弃牌堆中的卡牌' };
        if (!targetPosition) return { valid: false, error: '必须选择放置位置' };
        
        const player = ctx.core.players[ctx.playerId];
        const card = player.discard.find(c => c.id === targetCardId);
        if (!card || card.cardType !== 'unit') {
          return { valid: false, error: '弃牌堆中没有该单位卡' };
        }
        
        if (!isUndeadCard(card)) return { valid: false, error: '只能复活亡灵单位' };
        
        // 检查是否相邻
        const isAdjacent = Math.abs(ctx.sourcePosition.row - targetPosition.row) + Math.abs(ctx.sourcePosition.col - targetPosition.col) === 1;
        if (!isAdjacent) {
          return { valid: false, error: '必须放置到召唤师相邻的位置' };
        }
        
        // 检查位置是否为空
        const targetCellEmpty = isCellEmpty(ctx.core, targetPosition);
        if (!targetCellEmpty) {
          return { valid: false, error: '放置位置必须为空' };
        }
        
        return { valid: true };
      },
    },
    ui: {
      requiresButton: true,
      buttonPhase: 'summon',
      buttonLabel: 'abilityButtons.reviveUndead',
      buttonVariant: 'primary',
      activationStep: 'selectCard',
      quickCheck: ({ core, playerId }) =>
        core.players[playerId]?.discard.some(c => c.cardType === 'unit' && isUndeadCard(c)) ?? false,
    },
  },

  // 伊路特-巴尔 - 火祀召唤（召唤时触发：消灭一个友方单位，占据其位置）
  // trigger: 'onSummon' — 在 SUMMON_UNIT 命令的 validate/execute 中处理，不显示主动按钮
  {
    id: 'fire_sacrifice_summon',
    name: abilityText('fire_sacrifice_summon', 'name'),
    description: abilityText('fire_sacrifice_summon', 'description'),
    sfxKey: 'fantasy.elemental_sword_fireattack_01',
    trigger: 'onSummon',
    effects: [],
    ui: { requiresButton: false },
  },

  // 德拉戈斯 - 吸取生命
  {
    id: 'life_drain',
    name: abilityText('life_drain', 'name'),
    description: abilityText('life_drain', 'description'),
    sfxKey: 'fantasy.dark_sword_steallife',
    trigger: 'beforeAttack',
    condition: { type: 'always' },
    effects: [
      { type: 'destroyUnit', target: { unitId: 'selectedAlly' } },
      // 效果由 execute.ts 直接处理：special 标记也算近战命中
    ],
    requiresTargetSelection: true,
    targetSelection: {
      type: 'unit',
      filter: {
        type: 'and',
        conditions: [
          { type: 'isOwner', target: 'self', owner: 'self' },
          { type: 'isInRange', target: 'self', range: 2 },
        ],
      },
      count: 1,
    },
    validation: {
      requiredPhase: 'attack',
      customValidator: (ctx) => {
        const targetUnitId = ctx.payload.targetUnitId as string | undefined;
        // 允许跳过（不选择友方单位）
        if (!targetUnitId) {
          return { valid: true }; // ✅ 允许取消
        }
        
        // 查找目标单位
        let targetUnit: import('./types').BoardUnit | undefined;
        let targetPos: import('./types').CellCoord | undefined;
        for (let row = 0; row < ctx.core.board.length; row++) {
          for (let col = 0; col < (ctx.core.board[0]?.length ?? 0); col++) {
            const unit = ctx.core.board[row]?.[col]?.unit;
            if (unit && (unit.instanceId === targetUnitId || unit.cardId === targetUnitId)) {
              targetUnit = unit;
              targetPos = { row, col };
              break;
            }
          }
          if (targetUnit) break;
        }
        
        if (!targetUnit || !targetPos || targetUnit.owner !== ctx.playerId) {
          return { valid: false, error: '必须选择一个友方单位' };
        }
        
        // 计算曼哈顿距离
        const dist = Math.abs(ctx.sourcePosition.row - targetPos.row) + Math.abs(ctx.sourcePosition.col - targetPos.col);
        if (dist > 2) {
          return { valid: false, error: '目标必须在2格以内' };
        }
        
        return { valid: true };
      },
    },
    ui: {
      requiresButton: false, // ❌ 移除青色波纹按钮（被动触发）
      buttonPhase: 'attack',
      buttonLabel: 'abilityButtons.lifeDrain',
      buttonVariant: 'secondary',
      activationStep: 'selectUnit',
      activationContext: 'beforeAttack',
      activationType: 'passiveTrigger', // ✅ 标记为被动触发
      quickCheck: ({ core, unit, playerId }) => {
        const pos = core.selectedUnit;
        if (!pos) return false;
        return getPlayerUnits(core, playerId).some(u => {
          if (u.instanceId === unit.instanceId) return false;
          const dist = Math.abs(u.position.row - pos.row) + Math.abs(u.position.col - pos.col);
          return dist <= 2;
        });
      },
    },
  },

  // 古尔-达斯 - 暴怒
  {
    id: 'rage',
    name: abilityText('rage', 'name'),
    description: abilityText('rage', 'description'),
    sfxKey: 'magic.dark.32.dark_spell_01',
    trigger: 'onDamageCalculation',
    effects: [
      { 
        type: 'modifyStrength', 
        target: 'self', 
        value: { type: 'attribute', target: 'self', attr: 'damage' },
      },
    ],
  },

  // 亡灵战士 - 血腥狂怒
  {
    id: 'blood_rage',
    name: abilityText('blood_rage', 'name'),
    description: abilityText('blood_rage', 'description'),
    sfxKey: 'fantasy.dark_sword_attack_withblood_01',
    trigger: 'onUnitDestroyed',
    condition: { type: 'always' }, // 任意单位被消灭
    effects: [
      { type: 'addCharge', target: 'self', value: 1 },
    ],
  },

  // 亡灵战士 - 力量强化（被动）
  {
    id: 'power_boost',
    name: abilityText('power_boost', 'name'),
    description: abilityText('power_boost', 'description'),
    sfxKey: 'magic.dark.32.dark_spell_02',
    trigger: 'onDamageCalculation',
    effects: [
      {
        type: 'modifyStrength',
        target: 'self',
        value: {
          type: 'attribute',
          target: 'self',
          attr: 'charge',
        },
        maxBonus: 5, // 规则：至多为+5
      },
    ],
  },

  // 亡灵战士 - 回合结束充能衰减
  {
    id: 'blood_rage_decay',
    name: abilityText('blood_rage_decay', 'name'),
    description: abilityText('blood_rage_decay', 'description'),
    sfxKey: 'fantasy.dark_sword_attack_withblood_02',
    trigger: 'onTurnEnd',
    condition: { type: 'hasCharge', target: 'self', minStacks: 1 },
    effects: [
      { type: 'removeCharge', target: 'self', value: 2 },
    ],
  },

  // 地狱火教徒 - 献祭
  {
    id: 'sacrifice',
    name: abilityText('sacrifice', 'name'),
    description: abilityText('sacrifice', 'description'),
    sfxKey: 'fantasy.elemental_sword_fireattack_02',
    trigger: 'onDeath',
    effects: [
      { type: 'damage', target: 'adjacentEnemies', value: 1 },
    ],
  },

  // 亡灵疫病体 - 无魂
  {
    id: 'soulless',
    name: abilityText('soulless', 'name'),
    description: abilityText('soulless', 'description'),
    sfxKey: 'magic.dark.32.dark_spell_03',
    trigger: 'onKill',
    effects: [
      { type: 'preventMagicGain', target: 'owner' },
    ],
  },

  // 亡灵疫病体 - 感染
  {
    id: 'infection',
    name: abilityText('infection', 'name'),
    description: abilityText('infection', 'description'),
    sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_blight_curse_001',
    trigger: 'onKill',
    condition: { type: 'hasCardInDiscard', cardType: 'carrier' },
    effects: [
      { type: 'summonFromDiscard', cardType: 'carrier', position: 'victim' },
    ],
    requiresTargetSelection: true,
    targetSelection: {
      type: 'card',
      filter: { type: 'isUnitType', target: 'self', unitType: 'carrier' },
    },
    interactionChain: {
      steps: [
        { step: 'selectPosition', inputType: 'position', producesField: 'targetPosition' },
        { step: 'selectCard', inputType: 'card', producesField: 'targetCardId' },
      ],
      payloadContract: {
        required: ['targetCardId', 'targetPosition'],
      },
    },
    validation: {
      customValidator: (ctx) => {
        const targetCardId = ctx.payload.targetCardId as string | undefined;
        const targetPosition = ctx.payload.targetPosition as import('./types').CellCoord | undefined;
        
        if (!targetCardId || !targetPosition) {
          return { valid: false, error: '必须选择弃牌堆中的疫病体和放置位置' };
        }
        
        const player = ctx.core.players[ctx.playerId];
        const card = player.discard.find(c => c.id === targetCardId);
        if (!card || card.cardType !== 'unit') {
          return { valid: false, error: '弃牌堆中没有该单位卡' };
        }
        
        if (!isPlagueZombieCard(card)) {
          return { valid: false, error: '只能召唤疫病体' };
        }
        
        if (!isCellEmpty(ctx.core, targetPosition)) {
          return { valid: false, error: '放置位置必须为空' };
        }
        
        return { valid: true };
      },
    },
  },

  // 亡灵弓箭手 - 灵魂转移
  {
    id: 'soul_transfer',
    name: abilityText('soul_transfer', 'name'),
    description: abilityText('soul_transfer', 'description'),
    sfxKey: 'magic.general.spells_variations_vol_2.unholy_echo.magevil_unholy_echo_01_krst_none',
    trigger: 'onUnitDestroyed',
    condition: { type: 'isInRange', target: 'victim', range: 3 },
    effects: [
      // 改为请求事件，由 UI 确认后执行
      { type: 'custom', actionId: 'soul_transfer_request' },
    ],
    requiresTargetSelection: false, // 可选触发，UI 确认
    validation: {
      customValidator: (ctx) => {
        const targetPosition = ctx.payload.targetPosition as import('./types').CellCoord | undefined;
        if (!targetPosition) {
          return { valid: false, error: '必须指定目标位置' };
        }
        
        if (!isCellEmpty(ctx.core, targetPosition)) {
          return { valid: false, error: '目标位置必须为空' };
        }
        
        return { valid: true };
      },
    },
  },

  // ============================================================================
  // 主动技能（需要玩家手动激活）
  // ============================================================================

  // 注意：fire_sacrifice_summon 已改为 onSummon 触发，在 SUMMON_UNIT 命令中处理
  // 卡牌配置中保留 'fire_sacrifice_summon' ID，但 trigger 为 'onSummon'，不显示按钮
];

// 注册所有技能
abilityRegistry.registerAll(NECROMANCER_ABILITIES);

// 注册欺心巫族技能
abilityRegistry.registerAll(TRICKSTER_ABILITIES);

// 注册洞穴地精技能
abilityRegistry.registerAll(GOBLIN_ABILITIES);

// 注册先锋军团技能
abilityRegistry.registerAll(PALADIN_ABILITIES);

// 注册极地矮人技能
abilityRegistry.registerAll(FROST_ABILITIES);

// 注册炽原精灵技能
abilityRegistry.registerAll(BARBARIC_ABILITIES);

// 注册莫古技能
abilityRegistry.registerAll(MOGU_ABILITIES);

// 注册灰烬技能
abilityRegistry.registerAll(HUIJIN_ABILITIES);

// 注册冰苔兽人技能
abilityRegistry.registerAll(SHOUREN_ABILITIES);

// 注册永恒议会技能
abilityRegistry.registerAll(YONGHENG_ABILITIES);

// 注册暗影精灵技能
abilityRegistry.registerAll(SHADOW_ABILITIES);

// 注册仲裁派系技能
abilityRegistry.registerAll(ZHONGCAI_ABILITIES);
