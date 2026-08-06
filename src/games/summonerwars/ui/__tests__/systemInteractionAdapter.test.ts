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

describe('暗影能力棋盘直选适配', () => {
  it('审判先走单位本体，再把数量留给语义按钮', () => {
    const targetInteraction: SwSimpleChoiceInteraction = {
      id: 'test-shadow-judgment-target',
      type: 'shadow_judgment_select_target',
      meta: { sourceUnitId: 'shadow-source', sourcePosition: { row: 4, col: 3 } },
      options: [{
        id: 'target:enemy-1',
        label: '敌方单位',
        value: { action: 'shadow_judgment_target', targetPosition: { row: 4, col: 4 } },
      }],
    };
    const targetMode = deriveSystemAbilityMode(targetInteraction, null);
    expect(targetMode).toMatchObject({ abilityId: 'shadow_judgment', step: 'selectUnit' });
    expect(getSystemAbilityUiRoute(targetMode)).toBe('board-cell-unit');
    expect(findSystemAbilityUnitOptionByPosition(
      targetInteraction,
      targetMode,
      { row: 4, col: 4 },
    )?.id).toBe('target:enemy-1');

    const amountInteraction: SwSimpleChoiceInteraction = {
      id: 'test-shadow-judgment-amount',
      type: 'shadow_judgment_select_amount',
      meta: {
        sourceUnitId: 'shadow-source',
        sourcePosition: { row: 4, col: 3 },
        targetPosition: { row: 4, col: 4 },
      },
      options: [
        { id: 'amount:1', label: '1点', value: { action: 'shadow_judgment', amount: 1 } },
        { id: 'amount:2', label: '2点', value: { action: 'shadow_judgment', amount: 2 } },
      ],
    };
    const amountMode = deriveSystemAbilityMode(amountInteraction, null);
    expect(amountMode).toMatchObject({ abilityId: 'shadow_judgment', step: 'selectChoice' });
    expect(getSystemAbilityUiRoute(amountMode)).toBe('status-banner-choice');
  });

  it('撕裂帷幕的传送门和落点都走棋盘位置本体', () => {
    const gateInteraction: SwSimpleChoiceInteraction = {
      id: 'test-shadow-veil-gate',
      type: 'shadow_tear_the_veil_select_gate',
      meta: { sourceUnitId: 'shadow-source', sourcePosition: { row: 4, col: 3 }, targetUnitId: 'ally-1' },
      options: [{
        id: 'gate:4,4',
        label: '受伤传送门',
        value: { action: 'shadow_tear_the_veil_target_gate', gatePosition: { row: 4, col: 4 } },
      }],
    };
    const gateMode = deriveSystemAbilityMode(gateInteraction, null);
    expect(gateMode).toMatchObject({ abilityId: 'shadow_tear_the_veil', step: 'selectPosition' });
    expect(getSystemAbilityUiRoute(gateMode)).toBe('board-cell-position');
    expect(listSystemAbilityPositionTargets(gateInteraction, gateMode)).toEqual([{ row: 4, col: 4 }]);
    expect(findSystemAbilityPositionOption(gateInteraction, gateMode, { row: 4, col: 4 })?.id).toBe('gate:4,4');

    const positionInteraction: SwSimpleChoiceInteraction = {
      id: 'test-shadow-veil-position',
      type: 'shadow_tear_the_veil_select_position',
      meta: {
        sourceUnitId: 'shadow-source',
        sourcePosition: { row: 4, col: 3 },
        targetUnitId: 'ally-1',
        gatePosition: { row: 4, col: 4 },
      },
      options: [{
        id: 'pos:3,4',
        label: '(3,4)',
        value: { action: 'shadow_tear_the_veil', newPosition: { row: 3, col: 4 } },
      }],
    };
    const positionMode = deriveSystemAbilityMode(positionInteraction, null);
    expect(positionMode).toMatchObject({ abilityId: 'shadow_tear_the_veil', step: 'selectNewPosition' });
    expect(getSystemAbilityUiRoute(positionMode)).toBe('board-cell-position');
    expect(findSystemAbilityPositionOption(positionInteraction, positionMode, { row: 3, col: 4 })?.id).toBe('pos:3,4');
  });

  it.each([
    ['shadow_forbidden_knowledge_select_target', 'shadow_forbidden_knowledge', 'selectPosition', 'board-cell-position'],
    ['shadow_feint_select_position', 'shadow_feint', 'selectPosition', 'board-cell-position'],
    ['shadow_shadow_summon_select_target', 'shadow_shadow_summon', 'selectPosition', 'board-cell-position'],
    ['shadow_shadow_summon_select_position', 'shadow_shadow_summon', 'selectNewPosition', 'board-cell-position'],
    ['shadow_sudden_assault_select_position', 'shadow_sudden_assault', 'selectPosition', 'board-cell-position'],
  ] as const)('%s 不再路由到状态横幅按钮墙', (type, abilityId, step, route) => {
    const mode = deriveSystemAbilityMode({
      id: `test-${type}`,
      type,
      meta: { sourceUnitId: 'shadow-source', sourcePosition: { row: 4, col: 3 } },
      options: [],
    }, null);
    expect(mode).toMatchObject({ abilityId, step });
    expect(getSystemAbilityUiRoute(mode)).toBe(route);
  });
});
