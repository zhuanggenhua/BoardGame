/**
 * 召唤师战争 - useGameEvents 辅助函数测试
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import type { EventStreamEntry, GameEvent } from '../../../engine/types';
import { computeEventStreamDelta, shouldConsumeChargeEvent, type AbilityModeState } from '../ui/useGameEvents';
import {
  ACTIVATED_ABILITY_IDS,
  deriveInteractionCardsByOptionIds,
  deriveAfterAttackAbilityMode,
  deriveMindCaptureMode,
  deriveRapidFireMode,
  deriveSoulTransferMode,
  deriveSystemAbilityMode,
  findSystemAbilityPositionOption,
  deriveTelekinesisTargetMode,
  deriveWithdrawMode,
  findActivatedAbilityDirectionOptionByPosition,
  findActivatedAbilityTargetOptionByCardId,
  findActivatedAbilityTargetOptionByPosition,
  findIceRamPushOption,
  findSystemHandCardOptionByCardId,
  findStructureShiftDirectionOption,
  getSystemCardSelectorAbilityId,
  getSystemCardSelectorTitleKey,
  getSystemAbilityUiRoute,
  isSwSimpleChoiceType,
  findSystemAbilityUnitOptionByPosition,
  listSystemAbilityPositionTargets,
  listActivatedAbilityTargetCardIds,
  resolveBeforeAttackCancellation,
  resolveBeforeAttackCardConfirmation,
  SYSTEM_CARD_SELECTOR_ABILITY_IDS,
  type SwSimpleChoiceInteraction,
} from '../ui/systemInteractionAdapter';
import { getAbilityModeBannerFallbackText } from '../ui/statusBannerText';

function makeEntry(id: number): EventStreamEntry {
  const event: GameEvent = { type: 'TEST_EVENT', payload: {}, timestamp: id };
  return { id, event };
}

describe('computeEventStreamDelta', () => {
  it('事件流为空时，重置 lastSeenEventId', () => {
    const result = computeEventStreamDelta([], 3);
    expect(result).toEqual({
      newEntries: [],
      nextLastSeenId: -1,
      shouldReset: true,
    });
  });

  it('事件流为空且未消费过，保持不重置', () => {
    const result = computeEventStreamDelta([], -1);
    expect(result).toEqual({
      newEntries: [],
      nextLastSeenId: -1,
      shouldReset: false,
    });
  });

  it('事件流回滚时，返回全量并触发重置', () => {
    const entries = [makeEntry(2), makeEntry(3)];
    const result = computeEventStreamDelta(entries, 10);
    expect(result).toEqual({
      newEntries: entries,
      nextLastSeenId: 3,
      shouldReset: true,
    });
  });

  it('事件流正常递增时，只返回新增部分', () => {
    const entries = [makeEntry(1), makeEntry(2), makeEntry(3)];
    const result = computeEventStreamDelta(entries, 2);
    expect(result).toEqual({
      newEntries: [entries[2]],
      nextLastSeenId: 3,
      shouldReset: false,
    });
  });

  it('首次消费时返回全量，并更新 lastSeenEventId', () => {
    const entries = [makeEntry(5), makeEntry(6)];
    const result = computeEventStreamDelta(entries, -1);
    expect(result).toEqual({
      newEntries: entries,
      nextLastSeenId: 6,
      shouldReset: false,
    });
  });
});

describe('shouldConsumeChargeEvent', () => {
  it('同一充能事件 id 只消费一次', () => {
    const consumed = new Set<number>();

    expect(shouldConsumeChargeEvent(consumed, 7)).toBe(true);
    expect(shouldConsumeChargeEvent(consumed, 7)).toBe(false);
    expect(shouldConsumeChargeEvent(consumed, 8)).toBe(true);
    expect([...consumed]).toEqual([7, 8]);
  });

  it('[blood_rage/L4] 事件流回放时同一充能事件不会重复消费', () => {
    const consumed = new Set<number>();
    const entries = [makeEntry(7), makeEntry(8)];

    const firstPass = entries.filter(entry => shouldConsumeChargeEvent(consumed, entry.id));
    expect(firstPass.map(entry => entry.id)).toEqual([7, 8]);

    const rollbackDelta = computeEventStreamDelta(entries, 10);
    expect(rollbackDelta.shouldReset).toBe(true);
    const replayPass = rollbackDelta.newEntries.filter(entry => shouldConsumeChargeEvent(consumed, entry.id));

    expect(replayPass).toEqual([]);
    expect([...consumed]).toEqual([7, 8]);
  });
});

describe('systemInteractionAdapter', () => {
  // 注意：interactionChainAudit.test.ts 默认会被 vitest exclude 的 *audit*.test 规则排除，
  // 所以 system ability -> UI 路由矩阵必须在这个真实会执行的门禁文件里重复声明。
  type SystemAbilityUiRoute =
    | 'status-banner-choice'
    | 'board-cell-unit'
    | 'board-cell-position'
    | 'hand-card-select'
    | 'card-selector';

  const SYSTEM_ABILITY_UI_ROUTE_MATRIX: Array<{
    label: string;
    route: SystemAbilityUiRoute;
    step: string;
    context?: 'beforeAttack';
  }> = [
    { label: 'illusion/selectUnit', route: 'board-cell-unit', step: 'selectUnit' },
    { label: 'blood_rune/selectUnit', route: 'status-banner-choice', step: 'selectUnit' },
    { label: 'spirit_bond/selectUnit', route: 'board-cell-unit', step: 'selectUnit' },
    { label: 'ancestral_bond/selectUnit', route: 'board-cell-unit', step: 'selectUnit' },
    { label: 'structure_shift/selectUnit', route: 'board-cell-position', step: 'selectUnit' },
    { label: 'structure_shift/selectNewPosition', route: 'board-cell-position', step: 'selectNewPosition' },
    { label: 'frost_axe/selectUnit', route: 'board-cell-unit', step: 'selectUnit' },
    { label: 'vanish/selectUnit', route: 'board-cell-unit', step: 'selectUnit' },
    { label: 'telekinesis_instead/selectUnit', route: 'board-cell-unit', step: 'selectUnit' },
    { label: 'high_telekinesis_instead/selectUnit', route: 'board-cell-unit', step: 'selectUnit' },
    { label: 'revive_undead/selectCard', route: 'card-selector', step: 'selectCard' },
    { label: 'revive_undead/selectPosition', route: 'board-cell-position', step: 'selectPosition' },
    { label: 'fortress_power/selectCard', route: 'card-selector', step: 'selectCard' },
    { label: 'huijin_call_guards/selectUnit', route: 'board-cell-unit', step: 'selectUnit' },
    { label: 'huijin_call_guards/selectPosition', route: 'board-cell-position', step: 'selectPosition' },
    { label: 'mogu_fanatical_fungus/selectPosition', route: 'board-cell-position', step: 'selectPosition' },
    { label: 'ice_ram/selectUnit', route: 'board-cell-position', step: 'selectUnit' },
    { label: 'ice_ram/selectPushDirection', route: 'board-cell-position', step: 'selectPushDirection' },
    { label: 'huijin_ram/selectUnit', route: 'board-cell-unit', step: 'selectUnit' },
    { label: 'huijin_ram/selectPushDirection', route: 'board-cell-position', step: 'selectPushDirection' },
    { label: 'huijin_quick_shot/selectUnit', route: 'board-cell-unit', step: 'selectUnit' },
    { label: 'yongheng_draw/selectChoice', route: 'status-banner-choice', step: 'selectChoice' },
    { label: 'yongheng_continuance/selectChoice', route: 'status-banner-choice', step: 'selectChoice' },
    { label: 'yongheng_mental_invasion/selectUnit', route: 'board-cell-unit', step: 'selectUnit' },
    { label: 'yongheng_collision/selectUnit', route: 'board-cell-unit', step: 'selectUnit' },
    { label: 'yongheng_collision/selectPushDirection', route: 'board-cell-position', step: 'selectPushDirection' },
    { label: 'yongheng_warning/selectCards', route: 'hand-card-select', step: 'selectCards' },
    { label: 'yongheng_warning/selectPosition', route: 'board-cell-position', step: 'selectPosition' },
    { label: 'yongheng_application/selectCards', route: 'hand-card-select', step: 'selectCards' },
    { label: 'yongheng_application/selectUnit', route: 'board-cell-unit', step: 'selectUnit' },
    { label: 'yongheng_arouse_fear/selectCards', route: 'hand-card-select', step: 'selectCards' },
    { label: 'yongheng_punish/selectCards', route: 'hand-card-select', step: 'selectCards' },
    { label: 'life_drain/selectUnit', route: 'board-cell-unit', step: 'selectUnit', context: 'beforeAttack' },
    { label: 'holy_arrow/selectCards', route: 'hand-card-select', step: 'selectCards', context: 'beforeAttack' },
    { label: 'healing/selectCards', route: 'hand-card-select', step: 'selectCards', context: 'beforeAttack' },
  ];

  const getRouteLabels = (route: SystemAbilityUiRoute) => (
    SYSTEM_ABILITY_UI_ROUTE_MATRIX
      .filter((entry) => entry.route === route)
      .map((entry) => entry.label)
  );

  it('activated_ability_target 适配白名单与系统交互保持一致', () => {
    expect(ACTIVATED_ABILITY_IDS).toEqual([
      'revive_undead',
      'fortress_power',
      'telekinesis_instead',
      'high_telekinesis_instead',
      'vanish',
      'mogu_blood_infusion',
    ]);
  });

  it('为 revive_undead 的 selectCard 交互派生系统 abilityMode', () => {
    const swInteraction: SwSimpleChoiceInteraction = {
      id: 'sw-revive-1',
      type: 'activated_ability_target',
      meta: {
        type: 'activated_ability_target',
        abilityId: 'revive_undead',
        sourceUnitId: 'summoner-1',
        sourcePosition: { row: 7, col: 2 },
        step: 'selectCard',
      },
      options: [
        {
          id: 'card-a',
          label: 'Undead A',
          value: { action: 'activated_ability_target', abilityId: 'revive_undead', targetCardId: 'card-a' },
        },
      ],
    };

    expect(deriveSystemAbilityMode(swInteraction, null)).toEqual({
      abilityId: 'revive_undead',
      step: 'selectCard',
      sourceUnitId: 'summoner-1',
    });
  });

  it('为 revive_undead 的 selectPosition 交互保留 targetCardId', () => {
    const swInteraction: SwSimpleChoiceInteraction = {
      id: 'sw-revive-2',
      type: 'activated_ability_target',
      meta: {
        type: 'activated_ability_target',
        abilityId: 'revive_undead',
        sourceUnitId: 'summoner-1',
        sourcePosition: { row: 7, col: 2 },
        step: 'selectPosition',
        targetCardId: 'card-a',
      },
      options: [
        {
          id: 'pos:6,2',
          label: '(6,2)',
          value: {
            action: 'activated_ability_target',
            abilityId: 'revive_undead',
            targetCardId: 'card-a',
            targetPosition: { row: 6, col: 2 },
          },
        },
      ],
    };

    expect(deriveSystemAbilityMode(swInteraction, null)).toEqual({
      abilityId: 'revive_undead',
      step: 'selectPosition',
      sourceUnitId: 'summoner-1',
      selectedCardId: 'card-a',
    });
  });

  it('为 fortress_power 的 selectCard 交互派生系统 abilityMode', () => {
    const swInteraction: SwSimpleChoiceInteraction = {
      id: 'sw-fortress-1',
      type: 'activated_ability_target',
      meta: {
        type: 'activated_ability_target',
        abilityId: 'fortress_power',
        sourceUnitId: 'paladin-1',
        sourcePosition: { row: 7, col: 2 },
        step: 'selectCard',
      },
      options: [
        {
          id: 'fort-card',
          label: 'Fortress',
          value: { action: 'activated_ability_target', abilityId: 'fortress_power', targetCardId: 'fort-card' },
        },
      ],
    };

    expect(deriveSystemAbilityMode(swInteraction, null)).toEqual({
      abilityId: 'fortress_power',
      step: 'selectCard',
      sourceUnitId: 'paladin-1',
    });
  });

  it('为 on_phase_start_illusion 交互派生系统 abilityMode', () => {
    const swInteraction: SwSimpleChoiceInteraction = {
      id: 'sw-illusion-1',
      type: 'on_phase_start_illusion',
      meta: {
        type: 'on_phase_start_illusion',
        sourceUnitId: 'illusionist-1',
        sourcePosition: { row: 4, col: 2 },
      },
      options: [
        {
          id: 'pos:4,3',
          label: 'Target',
          value: { action: 'on_phase_start_illusion', targetPosition: { row: 4, col: 3 } },
        },
      ],
    };

    expect(deriveSystemAbilityMode(swInteraction, null)).toEqual({
      abilityId: 'illusion',
      step: 'selectUnit',
      sourceUnitId: 'illusionist-1',
    });
  });

  it('为 on_phase_start_blood_rune 交互派生系统 abilityMode', () => {
    const swInteraction: SwSimpleChoiceInteraction = {
      id: 'sw-blood-rune-1',
      type: 'on_phase_start_blood_rune',
      meta: {
        type: 'on_phase_start_blood_rune',
        sourceUnitId: 'brav-1',
        sourcePosition: { row: 3, col: 2 },
      },
      options: [
        {
          id: 'damage',
          label: '自伤',
          value: { action: 'on_phase_start_blood_rune', choice: 'damage' },
        },
      ],
    };

    expect(deriveSystemAbilityMode(swInteraction, null)).toEqual({
      abilityId: 'blood_rune',
      step: 'selectUnit',
      sourceUnitId: 'brav-1',
    });
  });

  it('为 before_attack_holy_arrow 交互派生系统选牌 abilityMode', () => {
    const swInteraction: SwSimpleChoiceInteraction = {
      id: 'sw-holy-arrow-1',
      type: 'before_attack_holy_arrow',
      meta: {
        type: 'before_attack_holy_arrow',
        sourceUnitId: 'archer-1',
        targetPosition: { row: 4, col: 3 },
      },
      options: [
        {
          id: 'card-unit-a',
          label: 'Discard Unit A',
          value: { action: 'before_attack_holy_arrow', cardId: 'card-unit-a' },
        },
        {
          id: 'card-unit-b',
          label: 'Discard Unit B',
          value: { action: 'before_attack_holy_arrow', cardId: 'card-unit-b' },
        },
      ],
    };

    expect(
      deriveSystemAbilityMode(swInteraction, {
        interactionId: 'sw-holy-arrow-1',
        selectedCardIds: ['card-unit-a', 'other-card'],
      }),
    ).toEqual({
      abilityId: 'holy_arrow',
      step: 'selectCards',
      sourceUnitId: 'archer-1',
      context: 'beforeAttack',
      selectedCardIds: ['card-unit-a'],
      selectableCardIds: ['card-unit-a', 'card-unit-b'],
      pendingAttackTarget: { row: 4, col: 3 },
    });
  });

  it('为 before_attack_healing 交互派生系统选牌 abilityMode', () => {
    const swInteraction: SwSimpleChoiceInteraction = {
      id: 'sw-healing-1',
      type: 'before_attack_healing',
      meta: {
        type: 'before_attack_healing',
        sourceUnitId: 'priest-1',
        targetPosition: { row: 2, col: 1 },
      },
      options: [
        {
          id: 'card-heal-a',
          label: 'Heal A',
          value: { action: 'before_attack_healing', cardId: 'card-heal-a' },
        },
      ],
    };

    expect(
      deriveSystemAbilityMode(swInteraction, {
        interactionId: 'sw-healing-1',
        selectedCardIds: ['card-heal-a'],
      }),
    ).toEqual({
      abilityId: 'healing',
      step: 'selectCards',
      sourceUnitId: 'priest-1',
      context: 'beforeAttack',
      selectedCardIds: ['card-heal-a'],
      selectableCardIds: ['card-heal-a'],
      pendingAttackTarget: { row: 2, col: 1 },
    });
  });

  it('为现役 selectUnit 系统交互派生对应 abilityMode', () => {
    const cases: Array<{
      interaction: SwSimpleChoiceInteraction;
      expected: Record<string, unknown>;
    }> = [
      {
        interaction: {
          id: 'sw-spirit-bond-1',
          type: 'after_move_spirit_bond',
          meta: {
            type: 'after_move_spirit_bond',
            sourceUnitId: 'shaman-1',
            sourcePosition: { row: 5, col: 2 },
          },
          options: [],
        },
        expected: {
          abilityId: 'spirit_bond',
          step: 'selectUnit',
          sourceUnitId: 'shaman-1',
        },
      },
      {
        interaction: {
          id: 'sw-ancestral-bond-1',
          type: 'after_move_ancestral_bond',
          meta: {
            type: 'after_move_ancestral_bond',
            sourceUnitId: 'elder-1',
            sourcePosition: { row: 4, col: 2 },
          },
          options: [],
        },
        expected: {
          abilityId: 'ancestral_bond',
          step: 'selectUnit',
          sourceUnitId: 'elder-1',
        },
      },
      {
        interaction: {
          id: 'sw-frost-axe-1',
          type: 'after_move_frost_axe',
          meta: {
            type: 'after_move_frost_axe',
            sourceUnitId: 'smith-1',
            sourcePosition: { row: 3, col: 3 },
          },
          options: [],
        },
        expected: {
          abilityId: 'frost_axe',
          step: 'selectUnit',
          sourceUnitId: 'smith-1',
        },
      },
      {
        interaction: {
          id: 'sw-vanish-1',
          type: 'activated_ability_target',
          meta: {
            type: 'activated_ability_target',
            abilityId: 'vanish',
            sourceUnitId: 'sneeks-1',
            sourcePosition: { row: 7, col: 2 },
            step: 'selectUnit',
          },
          options: [],
        },
        expected: {
          abilityId: 'vanish',
          step: 'selectUnit',
          sourceUnitId: 'sneeks-1',
        },
      },
      {
        interaction: {
          id: 'sw-tele-1',
          type: 'activated_ability_target',
          meta: {
            type: 'activated_ability_target',
            abilityId: 'telekinesis_instead',
            sourceUnitId: 'kala-1',
            sourcePosition: { row: 4, col: 2 },
            step: 'selectUnit',
          },
          options: [],
        },
        expected: {
          abilityId: 'telekinesis_instead',
          step: 'selectUnit',
          sourceUnitId: 'kala-1',
        },
      },
      {
        interaction: {
          id: 'sw-tele-2',
          type: 'activated_ability_target',
          meta: {
            type: 'activated_ability_target',
            abilityId: 'high_telekinesis_instead',
            sourceUnitId: 'kala-2',
            sourcePosition: { row: 4, col: 2 },
            step: 'selectUnit',
          },
          options: [],
        },
        expected: {
          abilityId: 'high_telekinesis_instead',
          step: 'selectUnit',
          sourceUnitId: 'kala-2',
        },
      },
      {
        interaction: {
          id: 'sw-structure-shift-1',
          type: 'after_move_structure_shift_target',
          meta: {
            type: 'after_move_structure_shift_target',
            sourceUnitId: 'builder-1',
            sourcePosition: { row: 5, col: 2 },
          },
          options: [],
        },
        expected: {
          abilityId: 'structure_shift',
          step: 'selectUnit',
          sourceUnitId: 'builder-1',
        },
      },
      {
        interaction: {
          id: 'sw-life-drain-1',
          type: 'before_attack_life_drain',
          meta: {
            type: 'before_attack_life_drain',
            sourceUnitId: 'drainer-1',
            sourcePosition: { row: 6, col: 1 },
            targetPosition: { row: 6, col: 2 },
          },
          options: [],
        },
        expected: {
          abilityId: 'life_drain',
          step: 'selectUnit',
          sourceUnitId: 'drainer-1',
          context: 'beforeAttack',
          pendingAttackTarget: { row: 6, col: 2 },
        },
      },
      {
        interaction: {
          id: 'sw-ice-ram-1',
          type: 'ice_ram_target',
          meta: {
            type: 'ice_ram_target',
            structurePosition: { row: 2, col: 2 },
          },
          options: [],
        },
        expected: {
          abilityId: 'ice_ram',
          step: 'selectUnit',
          sourceUnitId: 'ice_ram',
          structurePosition: { row: 2, col: 2 },
        },
      },
      {
        interaction: {
          id: 'sw-huijin-ram-target-1',
          type: 'after_attack_huijin_ram_target',
          meta: {
            type: 'after_attack_huijin_ram_target',
            sourceUnitId: 'royal-guard-1',
            sourcePosition: { row: 4, col: 2 },
          },
          options: [],
        },
        expected: {
          abilityId: 'huijin_ram',
          step: 'selectUnit',
          sourceUnitId: 'royal-guard-1',
        },
      },
      {
        interaction: {
          id: 'sw-huijin-quick-shot-1',
          type: 'after_move_huijin_quick_shot',
          meta: {
            type: 'after_move_huijin_quick_shot',
            sourceUnitId: 'ash-archer-1',
            sourcePosition: { row: 4, col: 3 },
          },
          options: [],
        },
        expected: {
          abilityId: 'huijin_quick_shot',
          step: 'selectUnit',
          sourceUnitId: 'ash-archer-1',
        },
      },
      {
        interaction: {
          id: 'sw-huijin-call-guards-target-1',
          type: 'huijin_call_guards_select_target',
          meta: {
            type: 'huijin_call_guards_select_target',
            sourceUnitId: 'huijin-summoner-1',
            sourcePosition: { row: 0, col: 3 },
          },
          options: [],
        },
        expected: {
          abilityId: 'huijin_call_guards',
          step: 'selectUnit',
          sourceUnitId: 'huijin-summoner-1',
        },
      },
    ];

    for (const { interaction, expected } of cases) {
      expect(deriveSystemAbilityMode(interaction, null)).toEqual(expected);
    }

    expect(deriveSystemAbilityMode({
      id: 'sw-structure-shift-2',
      type: 'after_move_structure_shift_direction',
      meta: {
        type: 'after_move_structure_shift_direction',
        sourceUnitId: 'builder-1',
        sourcePosition: { row: 5, col: 2 },
        targetPosition: { row: 5, col: 3 },
      },
      options: [],
    }, null)).toEqual({
      abilityId: 'structure_shift',
      step: 'selectNewPosition',
      sourceUnitId: 'builder-1',
      targetPosition: { row: 5, col: 3 },
    });

    expect(deriveSystemAbilityMode({
      id: 'sw-mogu-fungus-1',
      type: 'after_move_mogu_fanatical_fungus',
      meta: {
        type: 'after_move_mogu_fanatical_fungus',
        sourceUnitId: 'mogu-fungus-target-1',
        sourcePosition: { row: 4, col: 3 },
        targetPosition: { row: 4, col: 3 },
      },
      options: [
        {
          id: 'stay',
          label: '不推拉',
          labelKey: 'actions.moguFanaticalFungusStay',
          value: {
            action: 'after_move_mogu_fanatical_fungus_target',
            targetPosition: { row: 4, col: 3 },
          },
        },
        {
          id: 'pos:4,4',
          label: '(4,4)',
          value: {
            action: 'after_move_mogu_fanatical_fungus_target',
            targetPosition: { row: 4, col: 3 },
            newPosition: { row: 4, col: 4 },
          },
        },
        {
          id: 'skip',
          label: '跳过',
          labelKey: 'actions.skip',
          value: { skip: true },
        },
      ],
    }, null)).toEqual({
      abilityId: 'mogu_fanatical_fungus',
      step: 'selectPosition',
      sourceUnitId: 'mogu-fungus-target-1',
      targetPosition: { row: 4, col: 3 },
      systemChoiceOptions: [
        { id: 'stay', label: '不推拉', labelKey: 'actions.moguFanaticalFungusStay' },
        { id: 'pos:4,4', label: '(4,4)', labelKey: undefined },
        { id: 'skip', label: '跳过', labelKey: 'actions.skip' },
      ],
    });

    expect(deriveSystemAbilityMode({
      id: 'sw-ice-ram-2',
      type: 'ice_ram_push',
      meta: {
        type: 'ice_ram_push',
        structurePosition: { row: 2, col: 2 },
        targetPosition: { row: 2, col: 3 },
      },
      options: [],
    }, null)).toEqual({
      abilityId: 'ice_ram',
      step: 'selectPushDirection',
      sourceUnitId: 'ice_ram',
      structurePosition: { row: 2, col: 2 },
      targetPosition: { row: 2, col: 3 },
    });

    expect(deriveSystemAbilityMode({
      id: 'sw-huijin-call-guards-position-1',
      type: 'huijin_call_guards_select_position',
      meta: {
        type: 'huijin_call_guards_select_position',
        sourceUnitId: 'huijin-summoner-1',
        sourcePosition: { row: 0, col: 3 },
        targetPosition: { row: 3, col: 3 },
      },
      options: [],
    }, null)).toEqual({
      abilityId: 'huijin_call_guards',
      step: 'selectPosition',
      sourceUnitId: 'huijin-summoner-1',
      targetPosition: { row: 3, col: 3 },
    });

    expect(deriveSystemAbilityMode({
      id: 'sw-huijin-ram-position-1',
      type: 'after_attack_huijin_ram_position',
      meta: {
        type: 'after_attack_huijin_ram_position',
        sourceUnitId: 'royal-guard-1',
        sourcePosition: { row: 4, col: 2 },
        targetPosition: { row: 4, col: 3 },
      },
      options: [],
    }, null)).toEqual({
      abilityId: 'huijin_ram',
      step: 'selectPushDirection',
      sourceUnitId: 'royal-guard-1',
      targetPosition: { row: 4, col: 3 },
    });
  });

  it('infection / feed_beast 不再派生 abilityMode，而是走各自系统专用态', () => {
    expect(deriveSystemAbilityMode({
      id: 'sw-infection-1',
      type: 'infection',
      meta: {
        type: 'infection',
        sourceUnitId: 'plague-1',
        targetPosition: { row: 5, col: 3 },
      },
      options: [],
    }, null)).toBeNull();

    expect(deriveSystemAbilityMode({
      id: 'sw-feed-beast-1',
      type: 'feed_beast',
      meta: {
        type: 'feed_beast',
        sourceUnitId: 'beast-1',
      },
      options: [],
    }, null)).toBeNull();
  });

  it('感染卡牌选择与简单提示态通过 adapter helper 收敛', () => {
    const infectionInteraction: SwSimpleChoiceInteraction = {
      id: 'sw-infection-cards',
      type: 'infection',
      meta: {
        type: 'infection',
        sourceUnitId: 'plague-1',
      },
      options: [
        { id: 'plague-zombie-a', label: 'A', value: { action: 'infection' } },
        { id: 'skip', label: 'skip', value: { skip: true } },
      ],
    };
    const discard = [
      { id: 'plague-zombie-a', name: 'Plague Zombie A' },
      { id: 'plague-zombie-b', name: 'Plague Zombie B' },
    ];
    expect(deriveInteractionCardsByOptionIds(infectionInteraction, 'infection', discard)).toEqual([
      { id: 'plague-zombie-a', name: 'Plague Zombie A' },
    ]);
    expect(deriveInteractionCardsByOptionIds(infectionInteraction, 'feed_beast', discard)).toBeNull();
    expect(isSwSimpleChoiceType({ ...infectionInteraction, type: 'grab_follow' }, 'grab_follow')).toBe(true);
    expect(isSwSimpleChoiceType({ ...infectionInteraction, type: 'feed_beast' }, 'grab_follow')).toBe(false);
  });

  it('攻击后与系统专用交互模式解析统一收敛到 adapter', () => {
    expect(deriveAfterAttackAbilityMode({
      id: 'sw-after-attack-1',
      type: 'after_attack_mind_transmission',
      meta: {
        type: 'after_attack_mind_transmission',
        abilityId: 'mind_transmission',
        sourceUnitId: 'mind-witch-1',
        sourcePosition: { row: 4, col: 2 },
      },
      options: [],
    })).toEqual({
      abilityId: 'mind_transmission',
      sourceUnitId: 'mind-witch-1',
      sourcePosition: { row: 4, col: 2 },
    });

    expect(deriveSoulTransferMode({
      id: 'sw-soul-transfer-1',
      type: 'soul_transfer',
      meta: {
        type: 'soul_transfer',
        sourceUnitId: 'archer-1',
        sourcePosition: { row: 5, col: 2 },
        victimPosition: { row: 5, col: 3 },
      },
      options: [],
    })).toEqual({
      sourceUnitId: 'archer-1',
      sourcePosition: { row: 5, col: 2 },
      victimPosition: { row: 5, col: 3 },
    });

    expect(deriveMindCaptureMode({
      id: 'sw-mind-capture-1',
      type: 'mind_capture',
      meta: {
        type: 'mind_capture',
        sourceUnitId: 'tekel-1',
        sourcePosition: { row: 3, col: 2 },
        targetPosition: { row: 3, col: 3 },
        targetUnitId: 'victim-1',
        hits: 2,
      },
      options: [],
    })).toEqual({
      sourceUnitId: 'tekel-1',
      sourcePosition: { row: 3, col: 2 },
      targetPosition: { row: 3, col: 3 },
      targetUnitId: 'victim-1',
      hits: 2,
    });

    expect(deriveRapidFireMode({
      id: 'sw-rapid-fire-1',
      type: 'after_attack_rapid_fire',
      meta: {
        type: 'after_attack_rapid_fire',
        sourceUnitId: 'archer-2',
        sourcePosition: { row: 2, col: 1 },
      },
      options: [],
    })).toEqual({
      sourceUnitId: 'archer-2',
      sourcePosition: { row: 2, col: 1 },
    });

    expect(deriveWithdrawMode({
      id: 'sw-withdraw-1',
      type: 'after_attack_withdraw_position',
      meta: {
        type: 'after_attack_withdraw_position',
        sourceUnitId: 'warrior-1',
        costType: 'magic',
      },
      options: [],
    })).toEqual({
      sourceUnitId: 'warrior-1',
      step: 'selectPosition',
      costType: 'magic',
    });

    expect(deriveTelekinesisTargetMode({
      id: 'sw-tele-direction-1',
      type: 'activated_ability_target',
      meta: {
        type: 'activated_ability_target',
        abilityId: 'telekinesis_instead',
        sourceUnitId: 'sly-1',
        sourcePosition: { row: 4, col: 2 },
        targetPosition: { row: 4, col: 3 },
        step: 'selectDirection',
      },
      options: [
        {
          id: 'pos:4,4',
          label: '(4,4)',
          value: { action: 'after_attack_telekinesis_direction', moveRow: 0, moveCol: 1 },
        },
      ],
    })).toEqual({
      abilityId: 'telekinesis_instead',
      sourceUnitId: 'sly-1',
      sourcePosition: { row: 4, col: 2 },
      targetPosition: { row: 4, col: 3 },
      destinations: [
        {
          position: { row: 4, col: 4 },
          moveRow: 0,
          moveCol: 1,
        },
      ],
    });
  });

  it('能按卡牌和位置匹配 activated_ability_target 选项', () => {
    const swInteraction: SwSimpleChoiceInteraction = {
      id: 'sw-activated-1',
      type: 'activated_ability_target',
      meta: {
        type: 'activated_ability_target',
        abilityId: 'fortress_power',
        sourceUnitId: 'paladin-1',
        sourcePosition: { row: 7, col: 2 },
        step: 'selectCard',
      },
      options: [
        {
          id: 'fort-card',
          label: 'Fortress',
          value: { action: 'activated_ability_target', abilityId: 'fortress_power', targetCardId: 'fort-card' },
        },
      ],
    };

    expect(
      findActivatedAbilityTargetOptionByCardId(swInteraction, 'fortress_power', 'fort-card', 'selectCard')?.id,
    ).toBe('fort-card');
    expect(listActivatedAbilityTargetCardIds(swInteraction, 'fortress_power', 'selectCard')).toEqual(['fort-card']);

    const vanishInteraction: SwSimpleChoiceInteraction = {
      id: 'sw-activated-2',
      type: 'activated_ability_target',
      meta: {
        type: 'activated_ability_target',
        abilityId: 'vanish',
        sourceUnitId: 'sneeks-1',
        sourcePosition: { row: 7, col: 2 },
        step: 'selectUnit',
      },
      options: [
        {
          id: 'pos:6,2',
          label: 'Target',
          value: {
            action: 'activated_ability_target',
            abilityId: 'vanish',
            targetPosition: { row: 6, col: 2 },
          },
        },
      ],
    };

    expect(
      findActivatedAbilityTargetOptionByPosition(vanishInteraction, 'vanish', { row: 6, col: 2 }, 'selectUnit')?.id,
    ).toBe('pos:6,2');

    const telekinesisTargetInteraction: SwSimpleChoiceInteraction = {
      id: 'sw-activated-2b',
      type: 'activated_ability_target',
      meta: {
        type: 'activated_ability_target',
        abilityId: 'telekinesis_instead',
        sourceUnitId: 'unit-1',
        sourcePosition: { row: 2, col: 1 },
        step: 'selectUnit',
      },
      options: [
        {
          id: 'pos:2,3',
          label: '(2,3)',
          value: {
            action: 'after_attack_telekinesis_target',
            targetPosition: { row: 2, col: 3 },
          },
        },
      ],
    };

    expect(
      findActivatedAbilityTargetOptionByPosition(
        telekinesisTargetInteraction,
        'telekinesis_instead',
        { row: 2, col: 3 },
        'selectUnit',
      )?.id,
    ).toBe('pos:2,3');

    const telekinesisDirectionInteraction: SwSimpleChoiceInteraction = {
      id: 'sw-activated-3',
      type: 'activated_ability_target',
      meta: {
        type: 'activated_ability_target',
        abilityId: 'telekinesis_instead',
        sourceUnitId: 'unit-1',
        sourcePosition: { row: 7, col: 2 },
        step: 'selectDirection',
        targetPosition: { row: 5, col: 2 },
      },
      options: [
        {
          id: 'pos:6,2',
          label: 'Push',
          value: {
            action: 'after_attack_telekinesis_direction',
            targetPosition: { row: 5, col: 2 },
            moveRow: 1,
            moveCol: 0,
          },
        },
      ],
    };

    expect(
      findActivatedAbilityDirectionOptionByPosition(
        telekinesisDirectionInteraction,
        'telekinesis_instead',
        { row: 6, col: 2 },
      )?.id,
    ).toBe('pos:6,2');
  });

  it('能匹配 structure_shift 与 ice_ram 第二步位置选项', () => {
    const structureShiftInteraction: SwSimpleChoiceInteraction = {
      id: 'sw-structure-shift-direction',
      type: 'after_move_structure_shift_direction',
      meta: {
        type: 'after_move_structure_shift_direction',
        sourceUnitId: 'builder-1',
        targetPosition: { row: 5, col: 3 },
      },
      options: [
        {
          id: 'shift-up',
          label: 'up',
          value: {
            action: 'after_move_structure_shift_direction',
            targetPosition: { row: 5, col: 3 },
            newPosition: { row: 4, col: 3 },
          },
        },
      ],
    };
    expect(findStructureShiftDirectionOption(
      structureShiftInteraction,
      { row: 5, col: 3 },
      { row: 4, col: 3 },
    )?.id).toBe('shift-up');
    expect(findStructureShiftDirectionOption(
      structureShiftInteraction,
      { row: 5, col: 3 },
      { row: 6, col: 3 },
    )).toBeNull();

    const iceRamInteraction: SwSimpleChoiceInteraction = {
      id: 'sw-ice-ram-push',
      type: 'ice_ram_push',
      meta: {
        type: 'ice_ram_push',
        sourceUnitId: 'ice-ram',
        targetPosition: { row: 2, col: 3 },
      },
      options: [
        {
          id: 'push-right',
          label: 'push-right',
          value: {
            action: 'ice_ram_push',
            pushNewPosition: { row: 2, col: 4 },
          },
        },
      ],
    };
    expect(findIceRamPushOption(iceRamInteraction, { row: 2, col: 4 })?.id).toBe('push-right');
    expect(findIceRamPushOption(iceRamInteraction, { row: 2, col: 5 })).toBeNull();
  });

  it('board-cell-position 系统交互通过共享 helper 统一高亮与点击消费', () => {
    const structureShiftInteraction: SwSimpleChoiceInteraction = {
      id: 'sw-structure-shift-direction-2',
      type: 'after_move_structure_shift_direction',
      meta: {
        type: 'after_move_structure_shift_direction',
        sourceUnitId: 'builder-1',
        sourcePosition: { row: 5, col: 2 },
        targetPosition: { row: 5, col: 3 },
      },
      options: [
        {
          id: 'shift-up',
          label: 'up',
          value: {
            action: 'after_move_structure_shift_direction',
            targetPosition: { row: 5, col: 3 },
            newPosition: { row: 4, col: 3 },
          },
        },
      ],
    };
    const structureShiftMode = deriveSystemAbilityMode(structureShiftInteraction, null);
    expect(listSystemAbilityPositionTargets(structureShiftInteraction, structureShiftMode)).toEqual([{ row: 4, col: 3 }]);
    expect(findSystemAbilityPositionOption(
      structureShiftInteraction,
      structureShiftMode,
      { row: 4, col: 3 },
    )?.id).toBe('shift-up');

    const iceRamInteraction: SwSimpleChoiceInteraction = {
      id: 'sw-ice-ram-push-2',
      type: 'ice_ram_push',
      meta: {
        type: 'ice_ram_push',
        sourceUnitId: 'interaction-source',
        structurePosition: { row: 2, col: 2 },
        targetPosition: { row: 2, col: 3 },
      },
      options: [
        {
          id: 'push-right',
          label: 'push-right',
          value: {
            action: 'ice_ram_push',
            pushNewPosition: { row: 2, col: 4 },
          },
        },
      ],
    };
    const iceRamMode = deriveSystemAbilityMode(iceRamInteraction, null);
    expect(listSystemAbilityPositionTargets(iceRamInteraction, iceRamMode)).toEqual([{ row: 2, col: 4 }]);
    expect(findSystemAbilityPositionOption(
      iceRamInteraction,
      iceRamMode,
      { row: 2, col: 4 },
    )?.id).toBe('push-right');

    const reviveUndeadInteraction: SwSimpleChoiceInteraction = {
      id: 'sw-revive-position-1',
      type: 'activated_ability_target',
      meta: {
        type: 'activated_ability_target',
        abilityId: 'revive_undead',
        sourceUnitId: 'summoner-1',
        sourcePosition: { row: 7, col: 2 },
        step: 'selectPosition',
        targetCardId: 'discard-undead-1',
      },
      options: [
        {
          id: 'pos:6,2',
          label: '(6,2)',
          value: {
            action: 'activated_ability_target',
            abilityId: 'revive_undead',
            targetCardId: 'discard-undead-1',
            targetPosition: { row: 6, col: 2 },
          },
        },
      ],
    };
    const reviveUndeadMode = deriveSystemAbilityMode(reviveUndeadInteraction, null);
    expect(listSystemAbilityPositionTargets(reviveUndeadInteraction, reviveUndeadMode)).toEqual([{ row: 6, col: 2 }]);
    expect(findSystemAbilityPositionOption(
      reviveUndeadInteraction,
      reviveUndeadMode,
      { row: 6, col: 2 },
    )?.id).toBe('pos:6,2');

    const huijinCallGuardsInteraction: SwSimpleChoiceInteraction = {
      id: 'sw-huijin-call-guards-position-2',
      type: 'huijin_call_guards_select_position',
      meta: {
        type: 'huijin_call_guards_select_position',
        sourceUnitId: 'huijin-summoner-1',
        sourcePosition: { row: 0, col: 3 },
        targetPosition: { row: 3, col: 3 },
      },
      options: [
        {
          id: 'pos:1,3',
          label: '(1,3)',
          value: {
            action: 'huijin_call_guards_position',
            targetPosition: { row: 3, col: 3 },
            position: { row: 1, col: 3 },
          },
        },
      ],
    };
    const huijinCallGuardsMode = deriveSystemAbilityMode(huijinCallGuardsInteraction, null);
    expect(listSystemAbilityPositionTargets(huijinCallGuardsInteraction, huijinCallGuardsMode)).toEqual([{ row: 1, col: 3 }]);
    expect(findSystemAbilityPositionOption(
      huijinCallGuardsInteraction,
      huijinCallGuardsMode,
      { row: 1, col: 3 },
    )?.id).toBe('pos:1,3');

    const huijinRamInteraction: SwSimpleChoiceInteraction = {
      id: 'sw-huijin-ram-position-2',
      type: 'after_attack_huijin_ram_position',
      meta: {
        type: 'after_attack_huijin_ram_position',
        sourceUnitId: 'royal-guard-1',
        sourcePosition: { row: 4, col: 2 },
        targetPosition: { row: 4, col: 3 },
      },
      options: [
        {
          id: 'pos:4,4',
          label: '(4,4)',
          value: {
            action: 'after_attack_huijin_ram_position',
            targetPosition: { row: 4, col: 3 },
            newPosition: { row: 4, col: 4 },
          },
        },
      ],
    };
    const huijinRamMode = deriveSystemAbilityMode(huijinRamInteraction, null);
    expect(listSystemAbilityPositionTargets(huijinRamInteraction, huijinRamMode)).toEqual([{ row: 4, col: 4 }]);
    expect(findSystemAbilityPositionOption(
      huijinRamInteraction,
      huijinRamMode,
      { row: 4, col: 4 },
    )?.id).toBe('pos:4,4');
  });

  it('findSystemAbilityUnitOptionByPosition 能命中现役 selectUnit 系统交互', () => {
    const cases = [
      {
        label: 'ice_ram',
        interaction: {
          id: 'sw-ice-ram-target',
          type: 'ice_ram_target',
          meta: { type: 'ice_ram_target', sourceUnitId: 'ice-ram' },
          options: [
            {
              id: 'pos:3,4',
              label: '(3,4)',
              value: { action: 'ice_ram_target', targetPosition: { row: 3, col: 4 } },
            },
          ],
        } satisfies SwSimpleChoiceInteraction,
        abilityMode: { abilityId: 'ice_ram', step: 'selectUnit', sourceUnitId: 'ice_ram' },
        position: { row: 3, col: 4 },
        expectedOptionId: 'pos:3,4',
      },
      {
        label: 'structure_shift',
        interaction: {
          id: 'sw-structure-shift-target',
          type: 'after_move_structure_shift_target',
          meta: { type: 'after_move_structure_shift_target', sourceUnitId: 'builder-1' },
          options: [
            {
              id: 'pos:1,2',
              label: '(1,2)',
              value: { action: 'after_move_structure_shift_target', targetPosition: { row: 1, col: 2 } },
            },
          ],
        } satisfies SwSimpleChoiceInteraction,
        abilityMode: { abilityId: 'structure_shift', step: 'selectUnit', sourceUnitId: 'builder-1' },
        position: { row: 1, col: 2 },
        expectedOptionId: 'pos:1,2',
      },
      {
        label: 'life_drain',
        interaction: {
          id: 'sw-life-drain-target',
          type: 'before_attack_life_drain',
          meta: {
            type: 'before_attack_life_drain',
            sourceUnitId: 'drainer-1',
            targetPosition: { row: 6, col: 3 },
          },
          options: [
            {
              id: 'unit:ally-1',
              label: 'Ally',
              value: {
                action: 'before_attack_life_drain',
                targetUnitId: 'ally-1',
                targetPosition: { row: 6, col: 2 },
              },
            },
          ],
        } satisfies SwSimpleChoiceInteraction,
        abilityMode: {
          abilityId: 'life_drain',
          step: 'selectUnit',
          sourceUnitId: 'drainer-1',
          context: 'beforeAttack',
          pendingAttackTarget: { row: 6, col: 3 },
        },
        position: { row: 6, col: 2 },
        targetUnitId: 'ally-1',
        expectedOptionId: 'unit:ally-1',
      },
      {
        label: 'illusion',
        interaction: {
          id: 'sw-illusion-target',
          type: 'on_phase_start_illusion',
          meta: { type: 'on_phase_start_illusion', sourceUnitId: 'illusionist-1' },
          options: [
            {
              id: 'pos:4,3',
              label: '(4,3)',
              value: { action: 'on_phase_start_illusion', targetPosition: { row: 4, col: 3 } },
            },
          ],
        } satisfies SwSimpleChoiceInteraction,
        abilityMode: { abilityId: 'illusion', step: 'selectUnit', sourceUnitId: 'illusionist-1' },
        position: { row: 4, col: 3 },
        expectedOptionId: 'pos:4,3',
      },
      {
        label: 'ancestral_bond',
        interaction: {
          id: 'sw-ancestral-target',
          type: 'after_move_ancestral_bond',
          meta: { type: 'after_move_ancestral_bond', sourceUnitId: 'elder-1' },
          options: [
            {
              id: 'pos:5,1',
              label: '(5,1)',
              value: { action: 'after_move_ancestral_bond', targetPosition: { row: 5, col: 1 } },
            },
          ],
        } satisfies SwSimpleChoiceInteraction,
        abilityMode: { abilityId: 'ancestral_bond', step: 'selectUnit', sourceUnitId: 'elder-1' },
        position: { row: 5, col: 1 },
        expectedOptionId: 'pos:5,1',
      },
      {
        label: 'spirit_bond',
        interaction: {
          id: 'sw-spirit-target',
          type: 'after_move_spirit_bond',
          meta: { type: 'after_move_spirit_bond', sourceUnitId: 'shaman-1' },
          options: [
            {
              id: 'pos:2,5',
              label: '(2,5)',
              value: { action: 'after_move_spirit_bond', choice: 'transfer', targetPosition: { row: 2, col: 5 } },
            },
          ],
        } satisfies SwSimpleChoiceInteraction,
        abilityMode: { abilityId: 'spirit_bond', step: 'selectUnit', sourceUnitId: 'shaman-1' },
        position: { row: 2, col: 5 },
        expectedOptionId: 'pos:2,5',
      },
      {
        label: 'frost_axe',
        interaction: {
          id: 'sw-frost-axe-target',
          type: 'after_move_frost_axe',
          meta: { type: 'after_move_frost_axe', sourceUnitId: 'smith-1' },
          options: [
            {
              id: 'pos:3,1',
              label: '(3,1)',
              value: { action: 'after_move_frost_axe', choice: 'attach', targetPosition: { row: 3, col: 1 } },
            },
          ],
        } satisfies SwSimpleChoiceInteraction,
        abilityMode: { abilityId: 'frost_axe', step: 'selectUnit', sourceUnitId: 'smith-1' },
        position: { row: 3, col: 1 },
        expectedOptionId: 'pos:3,1',
      },
      {
        label: 'vanish',
        interaction: {
          id: 'sw-vanish-target',
          type: 'activated_ability_target',
          meta: {
            type: 'activated_ability_target',
            abilityId: 'vanish',
            sourceUnitId: 'sneeks-1',
            step: 'selectUnit',
          },
          options: [
            {
              id: 'pos:6,2',
              label: '(6,2)',
              value: { action: 'activated_ability_target', abilityId: 'vanish', targetPosition: { row: 6, col: 2 } },
            },
          ],
        } satisfies SwSimpleChoiceInteraction,
        abilityMode: { abilityId: 'vanish', step: 'selectUnit', sourceUnitId: 'sneeks-1' },
        position: { row: 6, col: 2 },
        expectedOptionId: 'pos:6,2',
      },
      {
        label: 'telekinesis_instead',
        interaction: {
          id: 'sw-tele-target',
          type: 'activated_ability_target',
          meta: {
            type: 'activated_ability_target',
            abilityId: 'telekinesis_instead',
            sourceUnitId: 'kala-1',
            step: 'selectUnit',
          },
          options: [
            {
              id: 'pos:2,3',
              label: '(2,3)',
              value: { action: 'after_attack_telekinesis_target', targetPosition: { row: 2, col: 3 } },
            },
          ],
        } satisfies SwSimpleChoiceInteraction,
        abilityMode: { abilityId: 'telekinesis_instead', step: 'selectUnit', sourceUnitId: 'kala-1' },
        position: { row: 2, col: 3 },
        expectedOptionId: 'pos:2,3',
      },
      {
        label: 'high_telekinesis_instead',
        interaction: {
          id: 'sw-high-tele-target',
          type: 'activated_ability_target',
          meta: {
            type: 'activated_ability_target',
            abilityId: 'high_telekinesis_instead',
            sourceUnitId: 'kala-2',
            step: 'selectUnit',
          },
          options: [
            {
              id: 'pos:1,4',
              label: '(1,4)',
              value: { action: 'after_attack_telekinesis_target', targetPosition: { row: 1, col: 4 } },
            },
          ],
        } satisfies SwSimpleChoiceInteraction,
        abilityMode: { abilityId: 'high_telekinesis_instead', step: 'selectUnit', sourceUnitId: 'kala-2' },
        position: { row: 1, col: 4 },
        expectedOptionId: 'pos:1,4',
      },
      {
        label: 'huijin_ram',
        interaction: {
          id: 'sw-huijin-ram-target',
          type: 'after_attack_huijin_ram_target',
          meta: { type: 'after_attack_huijin_ram_target', sourceUnitId: 'royal-guard-1' },
          options: [
            {
              id: 'pos:4,3',
              label: '(4,3)',
              value: { action: 'after_attack_huijin_ram_target', targetPosition: { row: 4, col: 3 } },
            },
          ],
        } satisfies SwSimpleChoiceInteraction,
        abilityMode: { abilityId: 'huijin_ram', step: 'selectUnit', sourceUnitId: 'royal-guard-1' },
        position: { row: 4, col: 3 },
        expectedOptionId: 'pos:4,3',
      },
      {
        label: 'huijin_quick_shot',
        interaction: {
          id: 'sw-huijin-quick-shot-target',
          type: 'after_move_huijin_quick_shot',
          meta: { type: 'after_move_huijin_quick_shot', sourceUnitId: 'ash-archer-1' },
          options: [
            {
              id: 'pos:4,5',
              label: '(4,5)',
              value: { action: 'after_move_huijin_quick_shot', targetPosition: { row: 4, col: 5 } },
            },
          ],
        } satisfies SwSimpleChoiceInteraction,
        abilityMode: { abilityId: 'huijin_quick_shot', step: 'selectUnit', sourceUnitId: 'ash-archer-1' },
        position: { row: 4, col: 5 },
        expectedOptionId: 'pos:4,5',
      },
    ];

    for (const testCase of cases) {
      expect(
        findSystemAbilityUnitOptionByPosition(
          testCase.interaction,
          testCase.abilityMode,
          testCase.position,
          testCase.targetUnitId,
        )?.id,
        testCase.label,
      ).toBe(testCase.expectedOptionId);
    }
  });

  it('findSystemAbilityUnitOptionByPosition 在 step 或 interaction type 不匹配时返回 null', () => {
    const interaction: SwSimpleChoiceInteraction = {
      id: 'sw-mismatch-1',
      type: 'after_move_frost_axe',
      meta: { type: 'after_move_frost_axe', sourceUnitId: 'smith-1' },
      options: [
        {
          id: 'pos:3,1',
          label: '(3,1)',
          value: { action: 'after_move_frost_axe', choice: 'attach', targetPosition: { row: 3, col: 1 } },
        },
      ],
    };

    expect(
      findSystemAbilityUnitOptionByPosition(
        interaction,
        { abilityId: 'frost_axe', step: 'selectPosition', sourceUnitId: 'smith-1' },
        { row: 3, col: 1 },
      ),
    ).toBeNull();

    expect(
      findSystemAbilityUnitOptionByPosition(
        interaction,
        { abilityId: 'illusion', step: 'selectUnit', sourceUnitId: 'illusionist-1' },
        { row: 3, col: 1 },
      ),
    ).toBeNull();
  });

  it('beforeAttack 选牌确认 helper 只消费现役 holy_arrow / healing 路由', () => {
    const holyArrowInteraction: SwSimpleChoiceInteraction = {
      id: 'sw-holy-arrow-confirm',
      type: 'before_attack_holy_arrow',
      meta: {
        type: 'before_attack_holy_arrow',
        sourceUnitId: 'jacob-1',
        targetPosition: { row: 5, col: 2 },
      },
      options: [
        {
          id: 'discard-1',
          label: 'Discard 1',
          value: { action: 'before_attack_holy_arrow', cardId: 'card-1' },
        },
        {
          id: 'discard-2',
          label: 'Discard 2',
          value: { action: 'before_attack_holy_arrow', cardId: 'card-2' },
        },
      ],
    };
    const holyArrowMode: AbilityModeState = {
      abilityId: 'holy_arrow',
      step: 'selectCards',
      sourceUnitId: 'jacob-1',
      context: 'beforeAttack',
      selectedCardIds: ['card-1', 'card-2'],
    };

    expect(
      resolveBeforeAttackCardConfirmation(holyArrowInteraction, holyArrowMode, ['card-1', 'card-2']),
    ).toEqual({
      command: 'respondMany',
      optionIds: ['discard-1', 'discard-2'],
    });

    const healingInteraction: SwSimpleChoiceInteraction = {
      id: 'sw-healing-confirm',
      type: 'before_attack_healing',
      meta: {
        type: 'before_attack_healing',
        sourceUnitId: 'sera-1',
        targetPosition: { row: 4, col: 3 },
      },
      options: [
        {
          id: 'skip',
          label: 'Skip',
          value: { skip: true },
        },
        {
          id: 'discard-heal',
          label: 'Discard Heal',
          value: { action: 'before_attack_healing', cardId: 'heal-card' },
        },
      ],
    };
    const healingMode: AbilityModeState = {
      abilityId: 'healing',
      step: 'selectCards',
      sourceUnitId: 'sera-1',
      context: 'beforeAttack',
      selectedCardIds: [],
    };

    expect(
      resolveBeforeAttackCardConfirmation(healingInteraction, healingMode, []),
    ).toEqual({
      command: 'respond',
      optionId: 'skip',
    });

    expect(
      resolveBeforeAttackCardConfirmation(healingInteraction, healingMode, ['heal-card']),
    ).toEqual({
      command: 'respond',
      optionId: 'discard-heal',
    });

    expect(
      resolveBeforeAttackCardConfirmation(healingInteraction, holyArrowMode, ['card-1']),
    ).toBeNull();
  });

  it('beforeAttack 取消 helper 只消费现役 skip/cancel 语义', () => {
    expect(resolveBeforeAttackCancellation({
      id: 'sw-life-drain-skip',
      type: 'before_attack_life_drain',
      meta: {
        type: 'before_attack_life_drain',
        sourceUnitId: 'ret-talus-1',
        targetPosition: { row: 5, col: 3 },
      },
      options: [
        {
          id: 'skip',
          label: 'Skip',
          value: { skip: true },
        },
      ],
    })).toEqual({
      command: 'respond',
      optionId: 'skip',
    });

    expect(resolveBeforeAttackCancellation({
      id: 'sw-healing-cancel',
      type: 'before_attack_healing',
      meta: {
        type: 'before_attack_healing',
        sourceUnitId: 'sera-1',
        targetPosition: { row: 4, col: 3 },
      },
      options: [],
    })).toEqual({
      command: 'cancel',
    });

    expect(resolveBeforeAttackCancellation({
      id: 'sw-structure-shift',
      type: 'after_move_structure_shift_target',
      meta: { type: 'after_move_structure_shift_target', sourceUnitId: 'builder-1' },
      options: [],
    })).toBeNull();
  });

  it('getSystemAbilityUiRoute 只为当前已登记的系统交互返回 UI 路由', () => {
    expect(getSystemAbilityUiRoute({
      abilityId: 'life_drain',
      step: 'selectUnit',
      sourceUnitId: 'ret-talus-1',
      context: 'beforeAttack',
    })).toBe('board-cell-unit');

    expect(getSystemAbilityUiRoute({
      abilityId: 'holy_arrow',
      step: 'selectCards',
      sourceUnitId: 'jacob-1',
      context: 'beforeAttack',
    })).toBe('hand-card-select');

    expect(getSystemAbilityUiRoute({
      abilityId: 'fortress_power',
      step: 'selectCard',
      sourceUnitId: 'savior-1',
    })).toBe('card-selector');

    expect(getSystemAbilityUiRoute({
      abilityId: 'revive_undead',
      step: 'selectPosition',
      sourceUnitId: 'sneeks-1',
    })).toBe('board-cell-position');

    expect(getSystemAbilityUiRoute({
      abilityId: 'blood_rune',
      step: 'selectUnit',
      sourceUnitId: 'blood-mage-1',
    })).toBe('status-banner-choice');

    expect(getSystemAbilityUiRoute({
      abilityId: 'future_ability',
      step: 'selectCards',
      sourceUnitId: 'future-1',
      context: 'beforeAttack',
    })).toBeNull();

    expect(getSystemAbilityUiRoute({
      abilityId: 'future_ability',
      step: 'selectCard',
      sourceUnitId: 'future-1',
    })).toBeNull();

    expect(getSystemCardSelectorAbilityId({
      abilityId: 'revive_undead',
      step: 'selectCard',
      sourceUnitId: 'sneeks-1',
    })).toBe('revive_undead');

    expect(getSystemCardSelectorAbilityId({
      abilityId: 'telekinesis_instead',
      step: 'selectUnit',
      sourceUnitId: 'sly-1',
    })).toBeNull();

    expect(getSystemCardSelectorTitleKey('fortress_power')).toBe('cardSelector.fortressPower');
  });

  it('召集护卫第一步走棋盘单位选择，不进入系统卡牌选择器', () => {
    const huijinInteraction: SwSimpleChoiceInteraction = {
      id: 'sw-huijin-call-guards-target-2',
      type: 'huijin_call_guards_select_target',
      meta: {
        type: 'huijin_call_guards_select_target',
        sourceUnitId: 'huijin-summoner-1',
        sourcePosition: { row: 0, col: 3 },
      },
      options: [
        {
          id: 'unit:huijin-ash-archer-1',
          label: '灰烬弓箭手',
          value: { action: 'huijin_call_guards_target', targetPosition: { row: 3, col: 3 } },
        },
      ],
    };
    const mode = deriveSystemAbilityMode(huijinInteraction, null);

    expect(getSystemAbilityUiRoute(mode)).toBe('board-cell-unit');
    expect(findSystemAbilityUnitOptionByPosition(
      huijinInteraction,
      mode,
      { row: 3, col: 3 },
    )?.id).toBe('unit:huijin-ash-archer-1');
  });

  it('永恒议会系统交互适配到棋盘、手牌和状态横幅', () => {
    const collisionInteraction: SwSimpleChoiceInteraction = {
      id: 'sw-yongheng-collision-target-1',
      type: 'yongheng_collision_target',
      meta: {
        type: 'yongheng_collision_target',
        sourceUnitId: 'yongheng-knight-1',
        sourcePosition: { row: 4, col: 4 },
      },
      options: [
        {
          id: 'pos:4,5',
          label: '(4,5)',
          value: { action: 'yongheng_collision_target', targetPosition: { row: 4, col: 5 } },
        },
        { id: 'skip', label: '跳过', value: { skip: true } },
      ],
    };
    const collisionMode = deriveSystemAbilityMode(collisionInteraction, null);
    expect(getSystemAbilityUiRoute(collisionMode)).toBe('board-cell-unit');
    expect(findSystemAbilityUnitOptionByPosition(
      collisionInteraction,
      collisionMode,
      { row: 4, col: 5 },
    )?.id).toBe('pos:4,5');

    const warningInteraction: SwSimpleChoiceInteraction = {
      id: 'sw-yongheng-warning-card-1',
      type: 'yongheng_warning_card',
      meta: {
        type: 'yongheng_warning_card',
        sourceUnitId: 'yongheng-advisor-1',
        sourcePosition: { row: 5, col: 2 },
        targetPosition: { row: 7, col: 3 },
      },
      options: [
        {
          id: 'card:yongheng-warning-card-1',
          label: '警告手牌',
          value: {
            action: 'yongheng_warning_card',
            targetCardId: 'yongheng-warning-card-1',
          },
        },
        { id: 'skip', label: '跳过', value: { skip: true } },
      ],
    };
    const warningMode = deriveSystemAbilityMode(warningInteraction, null);
    expect(getSystemAbilityUiRoute(warningMode)).toBe('hand-card-select');
    expect(warningMode).toMatchObject({
      abilityId: 'yongheng_warning',
      step: 'selectCards',
      selectableCardIds: ['yongheng-warning-card-1'],
    });
    expect(findSystemHandCardOptionByCardId(
      warningInteraction,
      warningMode,
      'yongheng-warning-card-1',
    )?.id).toBe('card:yongheng-warning-card-1');

    const continuanceInteraction: SwSimpleChoiceInteraction = {
      id: 'sw-yongheng-continuance-1',
      type: 'yongheng_continuance',
      meta: {
        type: 'yongheng_continuance',
        sourceUnitId: 'yongheng-summoner-1',
        sourcePosition: { row: 7, col: 3 },
        targetCardId: 'yongheng-search',
      },
      options: [
        { id: 'confirm', label: '确认', labelKey: 'actions.confirm', value: { action: 'yongheng_continuance_retain', targetOwner: '0', targetCardId: 'yongheng-search' } },
        { id: 'skip', label: '跳过', labelKey: 'actions.skip', value: { skip: true } },
      ],
    };
    const continuanceMode = deriveSystemAbilityMode(continuanceInteraction, null);
    expect(getSystemAbilityUiRoute(continuanceMode)).toBe('status-banner-choice');
    expect(continuanceMode).toMatchObject({
      abilityId: 'yongheng_continuance',
      step: 'selectChoice',
      systemChoiceOptions: [
        { id: 'confirm', label: '确认', labelKey: 'actions.confirm' },
        { id: 'skip', label: '跳过', labelKey: 'actions.skip' },
      ],
    });
  });

  it('现役 abilityMode 顶部横幅文案回退到已存在的文案源', () => {
    const t = (key: string, options?: Record<string, unknown> | string): string => {
      if (key === 'cardSelector.fortressPower') {
        return 'Fortress Power: Select a fortress unit from the discard pile';
      }
      if (key === 'statusBanners.abilityNames.telekinesis_instead') {
        return 'Telekinesis Instead of Attack';
      }
      if (key === 'statusBanners.abilityNames.high_telekinesis_instead') {
        return 'High Telekinesis Instead of Attack';
      }
      if (key === 'statusBanners.afterAttack.message' && options && typeof options === 'object') {
        return `${String(options.ability)}: Select a target`;
      }
      if (key === 'interaction.sw.yonghengWarningCard') {
        return 'Warning: choose a hand card';
      }
      if (key === 'interaction.sw.yonghengCollisionPosition') {
        return 'Collision: choose a push destination';
      }
      return typeof options === 'string' ? options : key;
    };
    const makeAbilityMode = (
      abilityId: string,
      step: AbilityModeState['step'],
    ): AbilityModeState => ({
      abilityId,
      step,
      sourceUnitId: 'source-1',
    });

    expect(getAbilityModeBannerFallbackText(
      t,
      makeAbilityMode('fortress_power', 'selectCard'),
    )).toBe('Fortress Power: Select a fortress unit from the discard pile');

    expect(getAbilityModeBannerFallbackText(
      t,
      makeAbilityMode('telekinesis_instead', 'selectUnit'),
    )).toBe('Telekinesis Instead of Attack: Select a target');

    expect(getAbilityModeBannerFallbackText(
      t,
      makeAbilityMode('high_telekinesis_instead', 'selectUnit'),
    )).toBe('High Telekinesis Instead of Attack: Select a target');

    expect(getAbilityModeBannerFallbackText(
      t,
      makeAbilityMode('yongheng_warning', 'selectCards'),
    )).toBe('Warning: choose a hand card');

    expect(getAbilityModeBannerFallbackText(
      t,
      makeAbilityMode('yongheng_collision', 'selectPushDirection'),
    )).toBe('Collision: choose a push destination');
  });

  it('当前 system ability 派生分支已全部登记到 UI 路由矩阵', () => {
    expect(SYSTEM_ABILITY_UI_ROUTE_MATRIX.map((entry) => entry.label)).toEqual([
      'illusion/selectUnit',
      'blood_rune/selectUnit',
      'spirit_bond/selectUnit',
      'ancestral_bond/selectUnit',
      'structure_shift/selectUnit',
      'structure_shift/selectNewPosition',
      'frost_axe/selectUnit',
      'vanish/selectUnit',
      'telekinesis_instead/selectUnit',
      'high_telekinesis_instead/selectUnit',
      'revive_undead/selectCard',
      'revive_undead/selectPosition',
      'fortress_power/selectCard',
      'huijin_call_guards/selectUnit',
      'huijin_call_guards/selectPosition',
      'mogu_fanatical_fungus/selectPosition',
      'ice_ram/selectUnit',
      'ice_ram/selectPushDirection',
      'huijin_ram/selectUnit',
      'huijin_ram/selectPushDirection',
      'huijin_quick_shot/selectUnit',
      'yongheng_draw/selectChoice',
      'yongheng_continuance/selectChoice',
      'yongheng_mental_invasion/selectUnit',
      'yongheng_collision/selectUnit',
      'yongheng_collision/selectPushDirection',
      'yongheng_warning/selectCards',
      'yongheng_warning/selectPosition',
      'yongheng_application/selectCards',
      'yongheng_application/selectUnit',
      'yongheng_arouse_fear/selectCards',
      'yongheng_punish/selectCards',
      'life_drain/selectUnit',
      'holy_arrow/selectCards',
      'healing/selectCards',
    ]);
  });

  it('当前护栏只应覆盖未来分支，不应吞掉现役 beforeAttack 路由', () => {
    const beforeAttackUnitRoutes = SYSTEM_ABILITY_UI_ROUTE_MATRIX
      .filter((entry) => entry.context === 'beforeAttack' && entry.step === 'selectUnit')
      .map((entry) => entry.label);
    const beforeAttackCardRoutes = SYSTEM_ABILITY_UI_ROUTE_MATRIX
      .filter((entry) => entry.context === 'beforeAttack' && entry.step === 'selectCards')
      .map((entry) => entry.label);

    expect(beforeAttackUnitRoutes).toEqual(['life_drain/selectUnit']);
    expect(beforeAttackCardRoutes).toEqual(['holy_arrow/selectCards', 'healing/selectCards']);
  });

  it('棋盘点击、手牌选择和状态横幅职责边界保持清晰', () => {
    expect(getRouteLabels('board-cell-unit')).toEqual([
      'illusion/selectUnit',
      'spirit_bond/selectUnit',
      'ancestral_bond/selectUnit',
      'frost_axe/selectUnit',
      'vanish/selectUnit',
      'telekinesis_instead/selectUnit',
      'high_telekinesis_instead/selectUnit',
      'huijin_call_guards/selectUnit',
      'huijin_ram/selectUnit',
      'huijin_quick_shot/selectUnit',
      'yongheng_mental_invasion/selectUnit',
      'yongheng_collision/selectUnit',
      'yongheng_application/selectUnit',
      'life_drain/selectUnit',
    ]);
    expect(getRouteLabels('board-cell-position')).toEqual([
      'structure_shift/selectUnit',
      'structure_shift/selectNewPosition',
      'revive_undead/selectPosition',
      'huijin_call_guards/selectPosition',
      'mogu_fanatical_fungus/selectPosition',
      'ice_ram/selectUnit',
      'ice_ram/selectPushDirection',
      'huijin_ram/selectPushDirection',
      'yongheng_collision/selectPushDirection',
      'yongheng_warning/selectPosition',
    ]);
    expect(getRouteLabels('hand-card-select')).toEqual([
      'yongheng_warning/selectCards',
      'yongheng_application/selectCards',
      'yongheng_arouse_fear/selectCards',
      'yongheng_punish/selectCards',
      'holy_arrow/selectCards',
      'healing/selectCards',
    ]);
    expect(getRouteLabels('card-selector')).toEqual([
      'revive_undead/selectCard',
      'fortress_power/selectCard',
    ]);
    expect(getRouteLabels('status-banner-choice')).toEqual([
      'blood_rune/selectUnit',
      'yongheng_draw/selectChoice',
      'yongheng_continuance/selectChoice',
    ]);
  });

  it('Board 卡牌选择器能力集合必须与路由矩阵保持一致', () => {
    expect(SYSTEM_CARD_SELECTOR_ABILITY_IDS).toEqual(['revive_undead', 'fortress_power']);
    expect(
      getRouteLabels('card-selector').map((label) => label.split('/')[0]),
    ).toEqual([...SYSTEM_CARD_SELECTOR_ABILITY_IDS]);
  });

  it('关键 UI 文案入口不再依赖 fallback/defaultValue 掩盖缺 key', () => {
    const uiSources = [
      '../ui/StatusBanners.tsx',
      '../ui/statusBannerText.ts',
      '../ui/HandArea.tsx',
      '../ui/CustomDeckCard.tsx',
      '../ui/deckbuilder/MyDeckPanel.tsx',
    ].map((relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf-8'));

    for (const source of uiSources) {
      expect(source).not.toMatch(/defaultValue\s*:/);
      expect(source).not.toMatch(/t\(\s*['"`][^'"`]+['"`]\s*,\s*['"`]/);
    }
  });

  it('攻击骰子结果不应被后续技能交互自动关闭', () => {
    const boardSource = readFileSync(resolve(__dirname, '../Board.tsx'), 'utf-8');

    expect(boardSource).toContain('<DiceResultOverlay');
    expect(boardSource).toContain('<CardSelectorOverlay');
    expect(boardSource).not.toContain('board_auto_close_dice_for_interaction');
    expect(boardSource).not.toMatch(/if\s*\(\s*!diceResult\s*\|\|\s*!swInteraction\s*\)\s*return[\s\S]{0,300}handleCloseDiceResult\s*\(\s*\)/);
  });

  it('近战攻击动画应与骰子浮层关闭分离，骰子揭示完成即可启动位移动画', () => {
    const boardSource = readFileSync(resolve(__dirname, '../Board.tsx'), 'utf-8');
    const diceOverlaySource = readFileSync(resolve(__dirname, '../ui/DiceResultOverlay.tsx'), 'utf-8');

    expect(boardSource).toContain('const DICE_RESULT_OVERLAY_DURATION_MS = 3000;');
    expect(boardSource).toContain("startPendingAttackVisual('dice-reveal-complete')");
    expect(boardSource).toContain("startPendingAttackVisual('dice-close')");
    expect(boardSource).toContain('startedAttackAnimEventIdRef.current === pending.attackEventId');
    expect(boardSource).toContain('duration={DICE_RESULT_OVERLAY_DURATION_MS}');
    expect(boardSource).not.toContain('duration={3000}');
    expect(boardSource).not.toContain('OPPONENT_MELEE_DICE_RESULT_DURATION_MS');
    expect(diceOverlaySource).toContain('onRevealComplete?: () => void;');
    expect(diceOverlaySource).toContain('dice_overlay_reveal_complete');
  });
});
