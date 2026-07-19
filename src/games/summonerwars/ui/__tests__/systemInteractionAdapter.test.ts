import { describe, expect, it } from 'vitest';
import {
  deriveSystemAbilityMode,
  findSystemAbilityPositionOption,
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
