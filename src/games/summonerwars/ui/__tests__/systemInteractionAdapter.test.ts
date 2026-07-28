import { describe, expect, it } from 'vitest';
import {
  deriveSystemAbilityMode,
  findSystemAbilityPositionOption,
  findSystemAbilityUnitOptionByPosition,
  getSystemAbilityUiRoute,
  listSystemAbilityPositionTargets,
  type SwSimpleChoiceInteraction,
} from '../systemInteractionAdapter';

const CASES = [
  ['after_summon_shouren_bloody_rush', 'shouren_bloody_rush', 'after_summon_shouren_bloody_rush'],
  ['after_attack_shouren_berserk', 'shouren_berserk', 'after_attack_shouren_berserk'],
  ['after_attack_shouren_brute_impact', 'shouren_brute_impact', 'after_attack_shouren_brute_impact'],
  ['after_attack_shouren_primal_fury', 'shouren_primal_fury', 'after_attack_shouren_primal_fury'],
] as const;

describe('冰苔兽人系统位置交互适配', () => {
  it.each(CASES)('%s 可派生棋盘位置模式并消费原始 option', (type, abilityId, action) => {
    const interaction: SwSimpleChoiceInteraction = {
      id: `test-${type}`,
      type,
      meta: { sourceUnitId: 'shouren-source', sourcePosition: { row: 4, col: 3 } },
      options: [
        {
          id: 'pos:4,2',
          label: '(4,2)',
          value: { action, newPosition: { row: 4, col: 2 } },
        },
        { id: 'skip', label: '跳过', value: { skip: true } },
      ],
    };

    const mode = deriveSystemAbilityMode(interaction, null);
    expect(mode).toEqual(expect.objectContaining({
      abilityId,
      step: 'selectPosition',
      sourceUnitId: 'shouren-source',
    }));
    expect(getSystemAbilityUiRoute(mode)).toBe('board-cell-position');
    expect(listSystemAbilityPositionTargets(interaction, mode)).toEqual([{ row: 4, col: 2 }]);
    expect(findSystemAbilityPositionOption(interaction, mode, { row: 4, col: 2 })?.id).toBe('pos:4,2');
  });
});

describe('莫古腐坏系统目标交互适配', () => {
  it('腐坏目标选择可派生棋盘单位模式并按位置消费原始 option', () => {
    const interaction: SwSimpleChoiceInteraction = {
      id: 'test-mogu-decay',
      type: 'mogu_decay_select_target',
      meta: { sourceUnitId: 'ma-shuo-da', sourcePosition: { row: 4, col: 3 } },
      options: [
        {
          id: 'unit:ally-1',
          label: '相邻友方单位',
          value: { action: 'mogu_decay_target', targetPosition: { row: 4, col: 4 } },
        },
        { id: 'skip', label: '跳过', value: { skip: true } },
      ],
    };

    const mode = deriveSystemAbilityMode(interaction, null);
    expect(mode).toEqual(expect.objectContaining({
      abilityId: 'mogu_decay',
      step: 'selectUnit',
      sourceUnitId: 'ma-shuo-da',
    }));
    expect(getSystemAbilityUiRoute(mode)).toBe('board-cell-unit');
    expect(findSystemAbilityUnitOptionByPosition(interaction, mode, { row: 4, col: 4 })?.id).toBe('unit:ally-1');
    expect(findSystemAbilityUnitOptionByPosition(interaction, mode, { row: 3, col: 4 })).toBeNull();
  });
});
