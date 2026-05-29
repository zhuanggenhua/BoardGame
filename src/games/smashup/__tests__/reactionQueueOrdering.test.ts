import { describe, it, expect, beforeEach } from 'vitest';
import type { SmashUpCore, SmashUpEvent, TriggerInstance } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { makeMatchState, makeMinion, makeState, makeBase } from './helpers';
import { clearOngoingEffectRegistry, registerTrigger, collectTriggers, registerPodOngoingAliases } from '../domain/ongoingEffects';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { getInteractionHandler, clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { registerReactionQueueInteractionHandlers } from '../domain/reactionQueueHandlers';
import { resolveSmashUpReactionChoice } from '../domain/reactionSession';
import { areReactionOrderingTriggersConflicting } from '../domain/reactionOrdering';
import { processAffectTriggers, processDeckInspectionTriggers, processDestroyTriggers, processMoveTriggers, processReturnToHandTriggers } from '../domain/reducer';
import { createAbilityRuntimeExecutor, createAbilityRuntimeSimpleChoice, createEffectProgram } from '../domain/abilityRuntime';
import { registerTriggerProgramExecutor } from '../domain/triggerExecutors';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import {
  clearReactionFootprintFallbackAudit,
  deriveFootprintFromEvent,
  deriveFootprintFromInteraction,
  deriveFootprintFromTriggerProbe,
  getReactionFootprintFallbackAudit,
  reactionResourceKey,
} from '../domain/reactionResources';
import '../domain/index';

// Minimal factories reused from other tests
function baseCore(overrides?: Partial<SmashUpCore>): SmashUpCore {
  return makeState({
    turnOrder: ['0', '1'],
    currentPlayerIndex: 0,
    bases: [makeBase('test_base_1'), makeBase('test_base_2')],
    ...overrides,
  });
}

beforeEach(() => {
  clearOngoingEffectRegistry();
  clearInteractionHandlers();
  clearReactionFootprintFallbackAudit();
  registerReactionQueueInteractionHandlers();
});

describe('Smash Up reaction resource footprint inference', () => {
  it('事件 footprint 按真实状态事件推导资源，信息事件不写资源', () => {
    const moved = deriveFootprintFromEvent({
      type: SU_EVENTS.MINION_MOVED,
      payload: {
        minionUid: 'moved-1',
        minionDefId: 'robot_zapbot',
        fromBaseIndex: 0,
        toBaseIndex: 1,
        reason: 'test',
      },
      timestamp: 1,
    } as SmashUpEvent);

    const movedWrites = new Set(moved.writes.map(reactionResourceKey));
    expect(movedWrites).toContain('minion:moved-1');
    expect(movedWrites).toContain('base:0');
    expect(movedWrites).toContain('base:1');
    expect(movedWrites).toContain('targetAvailability:global');
    expect(moved.fallbackReason).toBeUndefined();

    const feedback = deriveFootprintFromEvent({
      type: SU_EVENTS.ABILITY_FEEDBACK,
      payload: { playerId: '0', messageKey: 'only_ui', tone: 'info' },
      timestamp: 1,
    } as SmashUpEvent);
    expect(feedback.reads).toHaveLength(0);
    expect(feedback.writes).toHaveLength(0);
    expect(feedback.fallbackReason).toBeUndefined();
  });

  it('DECK_REORDERED 事件应从 deckUids 映射到多张 cardInstance footprint，而不是只记玩家牌区', () => {
    const reordered = deriveFootprintFromEvent({
      type: SU_EVENTS.DECK_REORDERED,
      payload: {
        playerId: '0',
        deckUids: ['deck-a', 'deck-b'],
        reason: 'test_deck_reordered',
      },
      timestamp: 1,
    } as SmashUpEvent);

    const writes = reordered.writes.map(reactionResourceKey);
    expect(writes).toEqual(expect.arrayContaining([
      'playerHand:0',
      'playerDeck:0',
      'playerDiscard:0',
      'cardInstance:deck-a',
      'cardInstance:deck-b',
    ]));
    expect(reordered.fallbackReason).toBeUndefined();
  });

  it('HAND_SHUFFLED_INTO_DECK 事件应从 newDeckUids 映射到多张 cardInstance footprint，而不是只记玩家牌区', () => {
    const shuffled = deriveFootprintFromEvent({
      type: SU_EVENTS.HAND_SHUFFLED_INTO_DECK,
      payload: {
        playerId: '0',
        newDeckUids: ['hand-a', 'deck-a', 'hand-b'],
        reason: 'test_hand_shuffled_into_deck',
      },
      timestamp: 1,
    } as SmashUpEvent);

    const writes = shuffled.writes.map(reactionResourceKey);
    expect(writes).toEqual(expect.arrayContaining([
      'playerHand:0',
      'playerDeck:0',
      'playerDiscard:0',
      'cardInstance:hand-a',
      'cardInstance:deck-a',
      'cardInstance:hand-b',
    ]));
    expect(shuffled.fallbackReason).toBeUndefined();
  });

  it('ONGOING_DETACHED 事件应显式暴露真实 owner discard 写入，而不是只记 cardInstance', () => {
    const detached = deriveFootprintFromEvent({
      type: SU_EVENTS.ONGOING_DETACHED,
      payload: {
        cardUid: 'borrowed-overrun-a',
        defId: 'zombie_overrun',
        ownerId: '1',
        reason: 'zombie_overrun_self_destruct',
      },
      timestamp: 1,
    } as SmashUpEvent);

    const writes = detached.writes.map(reactionResourceKey);
    expect(writes).toEqual(expect.arrayContaining([
      'cardInstance:borrowed-overrun-a',
      'playerDiscard:1',
    ]));
    expect(detached.fallbackReason).toBeUndefined();
  });

  it('borrowed ONGOING_ATTACHED 事件应显式暴露 sourcePlayerId 与 ownerId 的牌区写入', () => {
    const attached = deriveFootprintFromEvent({
      type: SU_EVENTS.ONGOING_ATTACHED,
      payload: {
        cardUid: 'borrowed-attach-a',
        defId: 'test_borrowed_attach',
        ownerId: '1',
        sourcePlayerId: '0',
        targetType: 'base',
        targetBaseIndex: 0,
      },
      timestamp: 1,
    } as SmashUpEvent);

    const writes = attached.writes.map(reactionResourceKey);
    expect(writes).toEqual(expect.arrayContaining([
      'cardInstance:borrowed-attach-a',
      'base:0',
      'playerHand:0',
      'playerDeck:0',
      'playerDiscard:0',
      'playerHand:1',
      'playerDeck:1',
      'playerDiscard:1',
    ]));
    expect(attached.fallbackReason).toBeUndefined();
  });

  it.each([
    SU_EVENTS.CARD_TO_DECK_TOP,
    SU_EVENTS.CARD_TO_DECK_BOTTOM,
  ])('%s 在 borrowed/sourcePlayer 场景下应同时暴露 sourcePlayerId 与 ownerId 的牌区写入', (eventType) => {
    const moved = deriveFootprintFromEvent({
      type: eventType,
      payload: {
        cardUid: 'borrowed-card-a',
        defId: 'test_borrowed_card_to_deck',
        ownerId: '1',
        sourcePlayerId: '0',
        reason: 'borrowed_card_to_deck',
      },
      timestamp: 1,
    } as SmashUpEvent);

    const writes = moved.writes.map(reactionResourceKey);
    expect(writes).toEqual(expect.arrayContaining([
      'cardInstance:borrowed-card-a',
      'playerHand:0',
      'playerDeck:0',
      'playerDiscard:0',
      'playerDeck:1',
      'playerDiscard:1',
    ]));
    expect(moved.fallbackReason).toBeUndefined();
  });

  it('borrowed ACTION_PLAYED 在 fromDiscard 场景下应同时暴露 source discard 与 owner discard 写入', () => {
    const played = deriveFootprintFromEvent({
      type: SU_EVENTS.ACTION_PLAYED,
      payload: {
        playerId: '0',
        cardUid: 'borrowed-action-a',
        defId: 'test_borrowed_action_played',
        ownerId: '1',
        fromDiscard: true,
      },
      timestamp: 1,
    } as SmashUpEvent);

    const writes = played.writes.map(reactionResourceKey);
    expect(writes).toEqual(expect.arrayContaining([
      'cardInstance:borrowed-action-a',
      'playerDiscard:0',
      'playerDiscard:1',
      'playerPlayLimit:0',
    ]));
    expect(played.fallbackReason).toBeUndefined();
  });

  it('所有 Smash Up 事件类型都有 footprint 推导分支，未知结构不靠 legacy contract 补洞', () => {
    const broadPayload = {
      playerId: '0',
      ownerId: '0',
      controllerId: '0',
      toPlayerId: '0',
      fromPlayerId: '0',
      toPlayerId2: '1',
      suppressorPlayerId: '0',
      targetPlayerId: '1',
      requesterId: '0',
      targetPlayerId2: '1',
      cardUid: 'card-1',
      sourceCardUid: 'source-1',
      minionUid: 'minion-1',
      triggerMinionUid: 'minion-1',
      titanUid: 'titan-1',
      uid: 'card-1',
      defId: 'test_def',
      minionDefId: 'test_minion',
      baseIndex: 0,
      fromBaseIndex: 0,
      toBaseIndex: 1,
      targetBaseIndex: 0,
      sourceBaseIndex: 0,
      targetMinionUid: 'minion-1',
      reason: 'footprint_coverage',
      readiedPlayers: {
        '0': { deck: [], hand: [] },
        '1': { deck: [], hand: [] },
      },
    };

    for (const type of Object.values(SU_EVENTS)) {
      const footprint = deriveFootprintFromEvent({
        type,
        payload: broadPayload,
        timestamp: 1,
      } as unknown as SmashUpEvent);
      expect(footprint.fallbackReason, `event ${type}`).toBeUndefined();
      expect(Array.isArray(footprint.reads), `event ${type}`).toBe(true);
      expect(Array.isArray(footprint.writes), `event ${type}`).toBe(true);
    }
  });

  it('交互 footprint 从结构化 option 和 continuationContext 推导候选目标资源', () => {
    const interaction = createSimpleChoice(
      'footprint_interaction',
      '0',
      '选择目标',
      [
        { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
        {
          id: 'target-minion',
          label: '目标随从',
          value: { minionUid: 'target-1', baseIndex: 2, playerId: '1' },
          displayMode: 'button' as const,
        },
      ],
      {
        sourceId: 'footprint_interaction',
        targetType: 'minion',
      },
    );
    (interaction.data as any).continuationContext = { titanUid: 'titan-1', cardUid: 'source-card-1' };

    const footprint = deriveFootprintFromInteraction(interaction);
    expect(footprint).toBeDefined();
    const writes = new Set(footprint!.writes.map(reactionResourceKey));
    expect(writes).toContain('minion:target-1');
    expect(writes).toContain('base:2');
    expect(writes).toContain('playerControl:1');
    expect(writes).toContain('titan:titan-1');
    expect(writes).toContain('cardInstance:source-card-1');
    expect(footprint!.opensInteraction).toBe(true);
    expect(footprint!.fallbackReason).toBeUndefined();
  });

  it.each([
    ['Mushroom Kingdom', 'base_mushroom_kingdom', { minionUid: 'mk-target', baseIndex: 0 }],
    ['Sprout', 'killer_plant_sprout_search', { cardUid: 'sprout-deck-card', baseIndex: 0, playerId: '0' }],
    ['Cellular Bonding', 'shapeshifters_cellular_bonding_choose', { actionUid: 'bonded-action-1' }],
    ['Star Spawn', 'cthulhu_star_spawn', { targetPlayerId: '1', madnessUid: 'madness-1' }],
    ['Mark of Sleep', 'trickster_mark_of_sleep', { pid: '1' }],
    ['The Bride', 'titan_frankenstein_the_bride_start_choose_target', { minionUid: 'bride-target', baseIndex: 1, titanUid: 'bride-titan' }],
    ['Sphinx', 'titan_sphinx_start_turn', { cardUid: 'buried-card', baseIndex: 1, titanUid: 'sphinx-titan' }],
    ['Emperor Penguin', 'titan_penguins_emperor_penguin_play', { baseIndex: 2, titanUid: 'penguin-titan' }],
    ['Mergacon', 'titan_changerbots_mergacon_play', { baseIndex: 2, titanUid: 'mergacon-titan' }],
  ])('%s 结构化交互 option 可推导 footprint，不回退到手写排序桶', (_label, sourceId, value) => {
    const interaction = createSimpleChoice(
      `${sourceId}_footprint`,
      '0',
      '结构化交互',
      [
        { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
        { id: 'apply', label: '执行', value, displayMode: 'button' as const },
      ],
      { sourceId, targetType: 'button' },
    );

    const footprint = deriveFootprintFromInteraction(interaction);
    expect(footprint?.fallbackReason).toBeUndefined();
    expect(footprint?.writes.length).toBeGreaterThan(0);
  });

  it('actionUid-only 结构化交互 option 应映射到 cardInstance footprint，而不是退回 unstructured-options', () => {
    const interaction = createSimpleChoice(
      'action_uid_only_footprint',
      '0',
      '选择附着行动',
      [
        { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
        { id: 'apply', label: '执行', value: { actionUid: 'bonded-action-1' }, displayMode: 'button' as const },
      ],
      { sourceId: 'shapeshifters_cellular_bonding_choose', targetType: 'button' },
    );

    const footprint = deriveFootprintFromInteraction(interaction);
    expect(footprint?.fallbackReason).toBeUndefined();
    expect(footprint?.writes.map(reactionResourceKey)).toContain('cardInstance:bonded-action-1');
  });

  it('targetPlayerId + madnessUid 结构化交互 option 应映射到 playerControl 与 cardInstance footprint', () => {
    const interaction = createSimpleChoice(
      'target_player_madness_footprint',
      '0',
      '选择要给予疯狂卡的玩家',
      [
        { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
        { id: 'apply', label: '执行', value: { targetPlayerId: '1', madnessUid: 'madness-1' }, displayMode: 'button' as const },
      ],
      { sourceId: 'cthulhu_star_spawn', targetType: 'player' },
    );

    const footprint = deriveFootprintFromInteraction(interaction);
    expect(footprint?.fallbackReason).toBeUndefined();
    expect(footprint?.writes.map(reactionResourceKey)).toContain('playerControl:1');
    expect(footprint?.writes.map(reactionResourceKey)).toContain('cardInstance:madness-1');
  });

  it('pid-only 结构化 player-target option 应映射到 playerControl footprint，而不是退回 unstructured-options', () => {
    const interaction = createSimpleChoice(
      'pid_only_player_target_footprint',
      '0',
      '选择一个玩家',
      [
        { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
        { id: 'apply', label: '执行', value: { pid: '1' }, displayMode: 'button' as const },
      ],
      { sourceId: 'trickster_mark_of_sleep', targetType: 'player' },
    );

    const footprint = deriveFootprintFromInteraction(interaction);
    expect(footprint?.fallbackReason).toBeUndefined();
    expect(footprint?.writes.map(reactionResourceKey)).toContain('playerControl:1');
  });

  it('ability runtime prompt 应从 runtimePrompt.continuation.context 推导 footprint，而不是退回 unstructured-options', () => {
    const interaction = createAbilityRuntimeSimpleChoice(
      'runtime_prompt_footprint',
      '0',
      '选择要封锁的派系',
      [{ id: 'robots', label: '机器人', value: { factionId: 'robots' }, displayMode: 'button' as const }],
      { sourceId: 'trickster_block_the_path', targetType: 'generic' },
    );
    (interaction.data as any).runtimePrompt = {
      owner: 'smashup-ability-runtime',
      sourceId: 'trickster_block_the_path',
      continuation: {
        context: {
          cardUid: 'block-path-a',
          baseIndex: 0,
          playerId: '0',
        },
        contextHasMatchState: true,
      },
    };

    const footprint = deriveFootprintFromInteraction(interaction);
    expect(footprint?.fallbackReason).toBeUndefined();
    expect(footprint?.writes.map(reactionResourceKey)).toEqual(expect.arrayContaining([
      'cardInstance:block-path-a',
      'base:0',
    ]));
  });

  it('button-only 交互应从 continuationContext.targetPlayerId 推导 playerControl footprint，而不是只记 cardUid', () => {
    const interaction = createSimpleChoice(
      'moon_zero_three_resolve_footprint',
      '0',
      '三号空间站：放回顶或放到底',
      [
        { id: 'top', label: '放回牌库顶', value: { placement: 'top' }, displayMode: 'button' as const },
        { id: 'bottom', label: '放到牌库底', value: { placement: 'bottom' }, displayMode: 'button' as const },
      ],
      { sourceId: 'titan_super_spies_moon_zero_three_resolve', targetType: 'button' },
    );
    (interaction.data as any).continuationContext = {
      targetPlayerId: '1',
      cardUid: 'peeked-card-1',
      defId: 'wizard_summon',
      ownerId: '1',
    };

    const footprint = deriveFootprintFromInteraction(interaction);
    expect(footprint?.fallbackReason).toBeUndefined();
    expect(footprint?.writes.map(reactionResourceKey)).toEqual(expect.arrayContaining([
      'playerControl:1',
      'cardInstance:peeked-card-1',
    ]));
  });

  it('continuationContext.cardUids 数组应映射到多张 cardInstance footprint，而不是只保留当前选项卡', () => {
    const interaction = createSimpleChoice(
      'invisible_ninja_card_uids_footprint',
      '0',
      'Invisible Ninja：选择要抽的牌',
      [
        { id: 'deck-peek-a', label: 'peek-a', value: { cardUid: 'peek-a', defId: 'wizard_summon' }, displayMode: 'card' as const },
        { id: 'deck-peek-b', label: 'peek-b', value: { cardUid: 'peek-b', defId: 'robot_microbot' }, displayMode: 'card' as const },
      ],
      { sourceId: 'titan_ninjas_invisible_ninja_ongoing', targetType: 'generic' },
    );
    (interaction.data as any).continuationContext = {
      titanUid: 'invisible-titan-1',
      cardUids: ['peek-a', 'peek-b'],
    };

    const footprint = deriveFootprintFromInteraction(interaction);
    expect(footprint?.fallbackReason).toBeUndefined();
    expect(footprint?.writes.map(reactionResourceKey)).toEqual(expect.arrayContaining([
      'titan:invisible-titan-1',
      'cardInstance:peek-a',
      'cardInstance:peek-b',
    ]));
  });

  it('deck reorder 交互应从 topUids/bottomUids 推导多张 cardInstance footprint，而不是只记 targetPlayerId', () => {
    const interaction = createSimpleChoice(
      'deck_reorder_uid_arrays_footprint',
      '0',
      '重排牌库顶',
      [
        {
          id: 'apply',
          label: '顶：A / C；底：B',
          value: {
            targetPlayerId: '0',
            topUids: ['deck-a', 'deck-c'],
            bottomUids: ['deck-b'],
          },
          displayMode: 'button' as const,
        },
      ],
      { sourceId: 'super_spies_for_my_eyes_only_reorder', targetType: 'generic' },
    );

    const footprint = deriveFootprintFromInteraction(interaction);
    expect(footprint?.fallbackReason).toBeUndefined();
    expect(footprint?.writes.map(reactionResourceKey)).toEqual(expect.arrayContaining([
      'playerControl:0',
      'cardInstance:deck-a',
      'cardInstance:deck-b',
      'cardInstance:deck-c',
    ]));
  });

  it('continuationContext.movedUids 数组应映射到多张 minion footprint，而不是只记当前选中的随从', () => {
    const interaction = createSimpleChoice(
      'full_sail_moved_uids_footprint',
      '0',
      '全速航行：继续选择要移动的随从',
      [
        { id: 'done', label: '完成', value: { done: true }, displayMode: 'button' as const },
        {
          id: 'next-minion',
          label: '继续移动',
          value: { minionUid: 'moved-candidate', baseIndex: 1, defId: 'pirate_first_mate' },
          displayMode: 'minion' as const,
        },
      ],
      { sourceId: 'pirate_full_sail_choose_minion', targetType: 'minion' },
    );
    (interaction.data as any).continuationContext = {
      movedUids: ['moved-a', 'moved-b'],
    };

    const footprint = deriveFootprintFromInteraction(interaction);
    expect(footprint?.fallbackReason).toBeUndefined();
    expect(footprint?.writes.map(reactionResourceKey)).toEqual(expect.arrayContaining([
      'minion:moved-candidate',
      'minion:moved-a',
      'minion:moved-b',
    ]));
  });

  it('runtimePrompt.continuation.context.removedActionUids 数组应映射到多张 cardInstance footprint，而不是只记当前选中的行动卡', () => {
    const interaction = createAbilityRuntimeSimpleChoice(
      'meddling_kids_removed_action_uids_footprint',
      '0',
      '多管闲事的小鬼：继续选择要消灭的行动卡',
      [
        {
          id: 'current-action',
          label: '当前行动',
          value: { cardUid: 'current-action', defId: 'test_action', ownerId: '0' },
          displayMode: 'card' as const,
        },
      ],
      { sourceId: 'miskatonic_those_meddling_kids_select', targetType: 'ongoing' },
    );
    (interaction.data as any).runtimePrompt = {
      owner: 'smashup-ability-runtime',
      sourceId: 'miskatonic_those_meddling_kids_select',
      continuation: {
        context: {
          baseIndex: 0,
          removedActionUids: ['removed-action-a', 'removed-action-b'],
        },
        contextHasMatchState: true,
      },
    };

    const footprint = deriveFootprintFromInteraction(interaction);
    expect(footprint?.fallbackReason).toBeUndefined();
    expect(footprint?.writes.map(reactionResourceKey)).toEqual(expect.arrayContaining([
      'base:0',
      'cardInstance:current-action',
      'cardInstance:removed-action-a',
      'cardInstance:removed-action-b',
    ]));
  });

  it('runtimePrompt.continuation.context.selectedMinionUids 数组应映射到多张 minion footprint，而不是只记当前手牌随从', () => {
    const interaction = createAbilityRuntimeSimpleChoice(
      'ninja_disguise_selected_minion_uids_footprint',
      '0',
      '伪装：选择第二个要打出的手牌随从',
      [
        {
          id: 'hand-minion-a',
          label: '手牌随从',
          value: { cardUid: 'hand-minion-a', defId: 'ninja_shadow', power: 3 },
          displayMode: 'card' as const,
        },
      ],
      { sourceId: 'ninja_disguise_choose_play2', targetType: 'hand' },
    );
    (interaction.data as any).runtimePrompt = {
      owner: 'smashup-ability-runtime',
      sourceId: 'ninja_disguise_choose_play2',
      continuation: {
        context: {
          baseIndex: 0,
          selectedMinionUids: ['return-minion-a', 'return-minion-b'],
        },
        contextHasMatchState: true,
      },
    };

    const footprint = deriveFootprintFromInteraction(interaction);
    expect(footprint?.fallbackReason).toBeUndefined();
    expect(footprint?.writes.map(reactionResourceKey)).toEqual(expect.arrayContaining([
      'base:0',
      'cardInstance:hand-minion-a',
      'minion:return-minion-a',
      'minion:return-minion-b',
    ]));
  });

  it('continuationContext.destroyedUids 数组应映射到多张 minion footprint，而不是只记当前选中的摧毁目标', () => {
    const interaction = createSimpleChoice(
      'let_the_dog_out_destroyed_uids_footprint',
      '0',
      '放狗咬人：继续选择要摧毁的随从',
      [
        { id: 'done', label: '完成', value: { done: true }, displayMode: 'button' as const },
        {
          id: 'next-target',
          label: '继续摧毁',
          value: { minionUid: 'fresh-target', baseIndex: 1, defId: 'robot_microbot_alpha' },
          displayMode: 'minion' as const,
        },
      ],
      { sourceId: 'werewolf_let_the_dog_out_targets', targetType: 'minion' },
    );
    (interaction.data as any).continuationContext = {
      destroyedUids: ['destroyed-a', 'destroyed-b'],
    };

    const footprint = deriveFootprintFromInteraction(interaction);
    expect(footprint?.fallbackReason).toBeUndefined();
    expect(footprint?.writes.map(reactionResourceKey)).toEqual(expect.arrayContaining([
      'minion:fresh-target',
      'minion:destroyed-a',
      'minion:destroyed-b',
    ]));
  });

  it('runtimePrompt.continuation.context.pickedToHandUids 数组应映射到多张 cardInstance footprint，而不是只记当前排序候选', () => {
    const interaction = createAbilityRuntimeSimpleChoice(
      'wizard_portal_picked_to_hand_uids_footprint',
      '0',
      '传送：选择下一张放回牌库顶的牌',
      [
        {
          id: 'order-card-a',
          label: '排序候选',
          value: { cardUid: 'order-card-a', defId: 'wizard_neophyte' },
          displayMode: 'card' as const,
        },
      ],
      { sourceId: 'wizard_portal_order', targetType: 'generic' },
    );
    (interaction.data as any).runtimePrompt = {
      owner: 'smashup-ability-runtime',
      sourceId: 'wizard_portal_order',
      continuation: {
        context: {
          pickedToHandUids: ['picked-a', 'picked-b'],
        },
        contextHasMatchState: true,
      },
    };

    const footprint = deriveFootprintFromInteraction(interaction);
    expect(footprint?.fallbackReason).toBeUndefined();
    expect(footprint?.writes.map(reactionResourceKey)).toEqual(expect.arrayContaining([
      'cardInstance:order-card-a',
      'cardInstance:picked-a',
      'cardInstance:picked-b',
    ]));
  });

  it('continuationContext.usedCardUids 数组应映射到多张 cardInstance footprint，而不是只记当前弃牌堆候选', () => {
    const interaction = createAbilityRuntimeSimpleChoice(
      'zombie_lord_used_card_uids_footprint',
      '0',
      '僵尸领主：继续选择弃牌堆中的随从',
      [
        {
          id: 'discard-minion-a',
          label: '弃牌堆候选',
          value: { cardUid: 'discard-minion-a', defId: 'zombie_walker', power: 2 },
          displayMode: 'card' as const,
        },
      ],
      { sourceId: 'zombie_lord_pick', targetType: 'discard_minion' },
    );
    (interaction.data as any).continuationContext = {
      usedCardUids: ['used-a', 'used-b'],
    };

    const footprint = deriveFootprintFromInteraction(interaction);
    expect(footprint?.fallbackReason).toBeUndefined();
    expect(footprint?.writes.map(reactionResourceKey)).toEqual(expect.arrayContaining([
      'cardInstance:discard-minion-a',
      'cardInstance:used-a',
      'cardInstance:used-b',
    ]));
  });

  it('runtimePrompt.continuation.context.discardUids 数组应映射到多张 cardInstance footprint，而不是只记当前选中的受益随从', () => {
    const interaction = createAbilityRuntimeSimpleChoice(
      'vampire_cull_the_weak_discard_uids_footprint',
      '0',
      '剔除弱者：选择要放置指示物的随从',
      [
        {
          id: 'beneficiary-a',
          label: '受益随从',
          value: { minionUid: 'beneficiary-a', baseIndex: 0 },
        },
      ],
      { sourceId: 'vampire_cull_the_weak_pod', targetType: 'minion' },
    );
    (interaction.data as any).runtimePrompt = {
      owner: 'smashup-ability-runtime',
      sourceId: 'vampire_cull_the_weak_pod',
      continuation: {
        context: {
          discardedCount: 2,
          discardUids: ['discarded-a', 'discarded-b'],
        },
        contextHasMatchState: true,
      },
    };

    const footprint = deriveFootprintFromInteraction(interaction);
    expect(footprint?.fallbackReason).toBeUndefined();
    expect(footprint?.writes.map(reactionResourceKey)).toEqual(expect.arrayContaining([
      'minion:beneficiary-a',
      'cardInstance:discarded-a',
      'cardInstance:discarded-b',
    ]));
  });

  it('continuationContext.selectedTargetUids 数组应映射到多张 minion footprint，而不是只记当前第二次分支选中的目标', () => {
    const interaction = createAbilityRuntimeSimpleChoice(
      'the_bride_selected_target_uids_footprint',
      '0',
      'The Bride：选择第二个效果目标',
      [
        {
          id: 'second-target-a',
          label: '第二次目标',
          value: { targetUid: 'second-target-a', defId: 'zombie_walker', kind: 'hand' },
        },
      ],
      { sourceId: 'titan_frankenstein_the_bride_start_choose_target', targetType: 'generic' },
    );
    (interaction.data as any).continuationContext = {
      titanUid: 'bride-titan',
      titanDefId: 'frankenstein_the_bride',
      usedKinds: ['hand'],
      selectedTargetUids: ['first-target-a'],
    };

    const footprint = deriveFootprintFromInteraction(interaction);
    expect(footprint?.fallbackReason).toBeUndefined();
    expect(footprint?.writes.map(reactionResourceKey)).toEqual(expect.arrayContaining([
      'minion:first-target-a',
      'minion:second-target-a',
      'cardInstance:bride-titan',
    ]));
  });

  it('continuationContext.playedHandUids 数组应映射到多张 cardInstance footprint，而不是只记当前第二次手牌候选', () => {
    const interaction = createAbilityRuntimeSimpleChoice(
      'ninja_disguise_played_hand_uids_footprint',
      '0',
      '伪装：选择第二个要打出的手牌随从',
      [
        {
          id: 'hand-minion-b',
          label: '第二次手牌候选',
          value: { cardUid: 'hand-minion-b', defId: 'ninja_tiger_assassin', power: 4 },
          displayMode: 'card' as const,
        },
      ],
      { sourceId: 'ninja_disguise_choose_play2', targetType: 'hand' },
    );
    (interaction.data as any).continuationContext = {
      baseIndex: 0,
      playedHandUids: ['hand-minion-a'],
    };

    const footprint = deriveFootprintFromInteraction(interaction);
    expect(footprint?.fallbackReason).toBeUndefined();
    expect(footprint?.writes.map(reactionResourceKey)).toEqual(expect.arrayContaining([
      'base:0',
      'cardInstance:hand-minion-a',
      'cardInstance:hand-minion-b',
    ]));
  });

  it('option.value.extraDeckUidsForShuffle 数组应映射到多张 cardInstance footprint，而不是只记当前牌库候选', () => {
    const interaction = createAbilityRuntimeSimpleChoice(
      'gelf_extra_deck_uids_for_shuffle_footprint',
      '0',
      'G.E.L.F.：从牌库选择要额外打出的仆从',
      [
        {
          id: 'deck-minion-a',
          label: '牌库候选',
          value: {
            cardUid: 'deck-minion-a',
            defId: 'robot_microbot_alpha',
            baseIndex: 1,
            reason: 'shapeshifters_gelf',
            maxPower: 4,
            excludeDefId: 'shapeshifters_gelf',
            extraDeckUidsForShuffle: ['gelf-self-bottomed'],
          },
          displayMode: 'card' as const,
        },
      ],
      { sourceId: 'shapeshifters_gelf_search', targetType: 'generic' },
    );

    const footprint = deriveFootprintFromInteraction(interaction);
    expect(footprint?.fallbackReason).toBeUndefined();
    expect(footprint?.writes.map(reactionResourceKey)).toEqual(expect.arrayContaining([
      'base:1',
      'cardInstance:deck-minion-a',
      'cardInstance:gelf-self-bottomed',
    ]));
  });

  it('interaction.data.inspectedUids 应映射到整批 inspected cardInstance footprint，而不是只记 option 中出现的行动牌', () => {
    const interaction = createSimpleChoice(
      'monkey_see_inspected_uids_footprint',
      '0',
      '猴子见，猴子做：选择要加入手牌的行动',
      [
        {
          id: 'inspect-action-a',
          label: '行动候选 A',
          value: { cardUid: 'inspect-action-a', defId: 'wizard_summon' },
          displayMode: 'card' as const,
        },
        {
          id: 'inspect-action-b',
          label: '行动候选 B',
          value: { cardUid: 'inspect-action-b', defId: 'robot_microbot_fixer' },
          displayMode: 'card' as const,
        },
      ],
      {
        sourceId: 'cyborg_apes_monkey_see_monkey_do_choose',
        targetType: 'generic',
        multi: { min: 0, max: 2 },
      },
    );
    (interaction.data as any).inspectedUids = ['inspect-action-a', 'inspect-action-b', 'inspect-minion-c'];
    (interaction.data as any).allowedCardUids = ['inspect-action-a', 'inspect-action-b'];

    const footprint = deriveFootprintFromInteraction(interaction);
    expect(footprint?.fallbackReason).toBeUndefined();
    expect(footprint?.writes.map(reactionResourceKey)).toEqual(expect.arrayContaining([
      'cardInstance:inspect-action-a',
      'cardInstance:inspect-action-b',
      'cardInstance:inspect-minion-c',
    ]));
  });

  it('continuationContext.remainingPlayers[].candidateUids 应映射到后续候选随从的 minion footprint，而不是误记成 cardInstance', () => {
    const interaction = createSimpleChoice(
      'temple_of_goju_remaining_candidates_footprint',
      '0',
      '刚柔流寺庙：选择放入牌库底的最高力量随从',
      [
        {
          id: 'current-candidate',
          label: '当前玩家候选',
          value: { minionUid: 'current-candidate', defId: 'pirate_first_mate', baseIndex: 0 },
          displayMode: 'card' as const,
        },
      ],
      { sourceId: 'base_temple_of_goju_tiebreak', targetType: 'minion' },
    );
    (interaction.data as any).continuationContext = {
      baseIndex: 0,
      remainingPlayers: [
        {
          playerId: '1',
          maxPower: 5,
          candidateUids: [
            { uid: 'remaining-minion-a', defId: 'zombie_walker', owner: '1', power: 5 },
            { uid: 'remaining-minion-b', defId: 'robot_microbot_alpha', owner: '1', power: 5 },
          ],
        },
      ],
    };

    const footprint = deriveFootprintFromInteraction(interaction);
    expect(footprint?.fallbackReason).toBeUndefined();
    expect(footprint?.writes.map(reactionResourceKey)).toEqual(expect.arrayContaining([
      'base:0',
      'minion:current-candidate',
      'minion:remaining-minion-a',
      'minion:remaining-minion-b',
    ]));
  });

  it('交互 option 无结构化目标时只标记明确 fallback，不伪造成全局冲突', () => {
    const interaction = createSimpleChoice(
      'unstructured_interaction',
      '0',
      '选择',
      [{ id: 'raw', label: '原始值', value: { apply: true }, displayMode: 'button' as const }],
      { sourceId: 'unstructured_source', targetType: 'button' },
    );

    const footprint = deriveFootprintFromInteraction(interaction);
    expect(footprint).toBeDefined();
    expect(footprint!.writes).toHaveLength(0);
    expect(footprint!.fallbackReason).toContain('unstructured_source');
  });

  it('显式 fallback footprint 会记录审计原因，并按实际资源读写参与冲突比较', () => {
    registerTrigger('test_fallback_reader', 'onTurnStart', () => [{
      type: SU_EVENTS.ABILITY_FEEDBACK,
      payload: { playerId: '0', messageKey: 'reader', tone: 'info' },
      timestamp: 1,
    }] as any, {
      fallbackFootprint: {
        reads: [{ kind: 'playerHand', playerId: '0' }],
        writes: [],
        fallbackReason: 'test reads hand through non-event query',
      },
    });
    registerTrigger('test_fallback_writer', 'onTurnStart', () => [{
      type: SU_EVENTS.CARDS_DRAWN,
      payload: { playerId: '0', count: 1, cardUids: ['drawn-1'] },
      timestamp: 1,
    }] as any);

    const core = baseCore({
      bases: [makeBase('test_base_1', [
        makeMinion('r1', 'test_fallback_reader', '0', 3),
        makeMinion('w1', 'test_fallback_writer', '0', 3),
      ])],
    });
    const queued = collectTriggers(core, 'onTurnStart', {
      state: core,
      matchState: makeMatchState(core),
      playerId: '0',
      random: { shuffle: (a: any[]) => a } as any,
      now: 1,
    });
    const rq = maybeResolveReactionQueue(
      makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers }),
      { shuffle: (a: any[]) => a } as any,
      1,
    );
    expect((rq!.state.sys.interaction.current as any)?.data?.sourceId).toBe('smashup_reaction_choose');
    expect(getReactionFootprintFallbackAudit()).toContainEqual(expect.objectContaining({
      sourceDefId: 'test_fallback_reader',
      reason: 'test reads hand through non-event query',
    }));
  });
});

describe('Reaction queue ordering (Wiki-style)', () => {
  it('current player chooses order among mandatory simultaneous triggers', () => {
    // Arrange: two sources in play on base 1 (witnessed) and two triggers queued
    registerTrigger('test_source_a', 'onMinionMoved', (_ctx: any) => [{
      type: SU_EVENTS.POWER_COUNTER_ADDED,
      payload: { minionUid: 'moved1', baseIndex: 1, amount: 1, reason: 'a' },
      timestamp: 1,
    }] as any);
    registerTrigger('test_source_b', 'onMinionMoved', (_ctx: any) => [{
      type: SU_EVENTS.POWER_COUNTER_REMOVED,
      payload: { minionUid: 'moved1', baseIndex: 1, amount: 1, reason: 'b' },
      timestamp: 1,
    }] as any);

    const core = baseCore({
      bases: [
        makeBase('test_base_1'),
        makeBase('test_base_2', [
          makeMinion('a1', 'test_source_a', '0', 3),
          makeMinion('b1', 'test_source_b', '0', 3),
        ]),
      ],
    });

    // Queue triggers via collectTriggers to ensure witness rules applied
    const queued = collectTriggers(core, 'onMinionMoved', {
      state: core,
      matchState: makeMatchState(core),
      playerId: '0',
      baseIndex: 1,
      triggerMinionUid: 'moved1',
      triggerMinionDefId: 'any_minion',
      random: { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      now: 1,
    });
    expect(queued).toBeDefined();
    const triggers = (queued as any).payload.triggers as TriggerInstance[];
    expect(triggers.length).toBe(2);

    const ms0 = makeMatchState({ ...core, triggerQueue: triggers });

    // Act: reaction queue should open an ordering interaction for current player (0)
    const rq = maybeResolveReactionQueue(ms0, { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any, 1);
    expect(rq).toBeDefined();
    const ms1 = rq!.state;
    const current = ms1.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('smashup_reaction_choose');

    // Choose trigger B first
    const optB = current.data.options.find((o: any) => (o.label as string).includes('test_source_b'));
    expect(optB).toBeDefined();
    const handler = getInteractionHandler('smashup_reaction_choose')!;
    const r2 = handler(ms1 as any, '0', optB.value, current.data, { shuffle: (a: any[]) => a } as any, 2);
    expect(r2).toBeDefined();
    const evts = r2!.events as SmashUpEvent[];
    expect(evts[0].type).toBe(SU_EVENTS.TRIGGER_CONSUMED);
    // And executor event is produced
    expect(evts.some(e => e.type === SU_EVENTS.POWER_COUNTER_REMOVED)).toBe(true);
  });

  it('mandatory 排序中点击已失效旧 trigger 时，应刷新到剩余 live triggers 而不是卡住或误执行旧项', () => {
    registerTrigger('test_source_a', 'onMinionMoved', (_ctx: any) => [{
      type: SU_EVENTS.POWER_COUNTER_ADDED,
      payload: { minionUid: 'moved1', baseIndex: 1, amount: 1, reason: 'a' },
      timestamp: 1,
    }] as any);
    registerTrigger('test_source_b', 'onMinionMoved', (_ctx: any) => [{
      type: SU_EVENTS.POWER_COUNTER_REMOVED,
      payload: { minionUid: 'moved1', baseIndex: 1, amount: 1, reason: 'b' },
      timestamp: 1,
    }] as any);
    registerTrigger('test_source_c', 'onMinionMoved', (_ctx: any) => [{
      type: SU_EVENTS.MINION_METADATA_UPDATED,
      payload: {
        minionUid: 'moved1',
        baseIndex: 1,
        metadataUpdate: { touched: 'c' },
        reason: 'c',
      },
      timestamp: 1,
    }] as any);

    const core = baseCore({
      bases: [
        makeBase('test_base_1'),
        makeBase('test_base_2', [
          makeMinion('a1', 'test_source_a', '0', 3),
          makeMinion('b1', 'test_source_b', '0', 3),
          makeMinion('c1', 'test_source_c', '0', 3),
        ]),
      ],
    });

    const queued = collectTriggers(core, 'onMinionMoved', {
      state: core,
      matchState: makeMatchState(core),
      playerId: '0',
      baseIndex: 1,
      triggerMinionUid: 'moved1',
      triggerMinionDefId: 'any_minion',
      random: { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      now: 1,
    });
    expect(queued).toBeDefined();
    const triggers = (queued as any).payload.triggers as TriggerInstance[];
    expect(triggers.length).toBe(3);

    const ms0 = makeMatchState({ ...core, triggerQueue: triggers });
    const rq = maybeResolveReactionQueue(ms0, { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any, 1);
    expect(rq).toBeDefined();
    const current = rq!.state.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('smashup_reaction_choose');

    const optA = current.data.options.find((o: any) => (o.label as string).includes('test_source_a'));
    expect(optA).toBeDefined();

    const staleState = {
      ...rq!.state,
      core: {
        ...rq!.state.core,
        triggerQueue: triggers.filter(trigger => trigger.sourceDefId !== 'test_source_a'),
      },
      sys: {
        ...rq!.state.sys,
        interaction: {
          ...rq!.state.sys.interaction,
          current: undefined,
        },
      },
    } as any;

    const refreshed = resolveSmashUpReactionChoice(
      staleState,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      2,
      optA.value,
    );

    const nextPrompt = refreshed.state.sys.interaction.current as any;
    expect(nextPrompt?.data?.sourceId).toBe('smashup_reaction_choose');
    const optionLabels = nextPrompt.data.options.map((option: any) => option.label as string);
    expect(optionLabels.some((label: string) => label.includes('test_source_a'))).toBe(false);
    expect(optionLabels.some((label: string) => label.includes('test_source_b'))).toBe(true);
    expect(optionLabels.some((label: string) => label.includes('test_source_c'))).toBe(true);
    expect(refreshed.events).toHaveLength(0);
    expect((refreshed.state.core.triggerQueue ?? []).map((trigger: any) => trigger.sourceDefId).sort()).toEqual([
      'test_source_b',
      'test_source_c',
    ]);
  });

  it('运行时产物显示互不冲突的 mandatory triggers 应自动收口，不再弹排序交互', () => {
    registerTrigger('test_auto_a', 'onMinionMoved', (_ctx: any) => [{
      type: SU_EVENTS.CARDS_DRAWN,
      payload: { playerId: '0', count: 1, cardUids: ['drawn-1'] },
      timestamp: 1,
    }] as any);
    registerTrigger('test_auto_b', 'onMinionMoved', (_ctx: any) => [{
      type: SU_EVENTS.POWER_COUNTER_ADDED,
      payload: { minionUid: 'moved1', baseIndex: 1, amount: 1, reason: 'auto_b' },
      timestamp: 1,
    }] as any);

    const core = baseCore({
      bases: [
        makeBase('test_base_1'),
        makeBase('test_base_2', [
          makeMinion('a1', 'test_auto_a', '0', 3),
          makeMinion('b1', 'test_auto_b', '0', 3),
        ]),
      ],
    });

    const queued = collectTriggers(core, 'onMinionMoved', {
      state: core,
      matchState: makeMatchState(core),
      playerId: '0',
      baseIndex: 1,
      triggerMinionUid: 'moved1',
      triggerMinionDefId: 'any_minion',
      random: { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      now: 1,
    });
    expect(queued).toBeDefined();

    const ms0 = makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers });
    const rq = maybeResolveReactionQueue(ms0, { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any, 1);
    expect(rq).toBeDefined();
    expect(rq!.state.sys.interaction.current).toBeUndefined();
    expect(rq!.state.core.triggerQueue ?? []).toHaveLength(0);
    expect(rq!.events.filter(event => event.type === SU_EVENTS.TRIGGER_CONSUMED)).toHaveLength(2);
    expect(rq!.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
    expect(rq!.events.some(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(true);
  });

  it('不同 source instance 的 mandatory triggers 不应被误判为需要排序', () => {
    registerTrigger('test_self_state_a', 'onTurnStart', (ctx: any) => [{
      type: SU_EVENTS.MINION_METADATA_UPDATED,
      payload: { minionUid: ctx.sourceCardUid, baseIndex: ctx.sourceBaseIndex, metadataUpdate: { touched: 'a' }, reason: 'self_a' },
      timestamp: 1,
    }] as any);
    registerTrigger('test_self_state_b', 'onTurnStart', (ctx: any) => [{
      type: SU_EVENTS.MINION_METADATA_UPDATED,
      payload: { minionUid: ctx.sourceCardUid, baseIndex: ctx.sourceBaseIndex, metadataUpdate: { touched: 'b' }, reason: 'self_b' },
      timestamp: 1,
    }] as any);

    const core = baseCore({
      bases: [
        makeBase('test_base_1', [makeMinion('sa1', 'test_self_state_a', '0', 3)]),
        makeBase('test_base_2', [makeMinion('sb1', 'test_self_state_b', '0', 3)]),
      ],
    });

    const queued = collectTriggers(core, 'onTurnStart', {
      state: core,
      matchState: makeMatchState(core),
      playerId: '0',
      random: { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      now: 1,
    });
    expect(queued).toBeDefined();

    const ms0 = makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers });
    const rq = maybeResolveReactionQueue(ms0, { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any, 1);
    expect(rq).toBeDefined();
    expect(rq!.state.sys.interaction.current).toBeUndefined();
    expect(rq!.state.core.triggerQueue ?? []).toHaveLength(0);
    expect(rq!.events.filter(event => event.type === SU_EVENTS.TRIGGER_CONSUMED)).toHaveLength(2);
    expect(rq!.events.filter(event => event.type === SU_EVENTS.MINION_METADATA_UPDATED)).toHaveLength(2);
  });

  it('singleton mandatory triggers 应先自动收口，排序弹窗只展示真实冲突分量', () => {
    registerTrigger('test_component_singleton_a', 'onTurnStart', (ctx: any) => [{
      type: SU_EVENTS.MINION_METADATA_UPDATED,
      payload: { minionUid: ctx.sourceCardUid, baseIndex: ctx.sourceBaseIndex, metadataUpdate: { touched: 'singleton_a' }, reason: 'singleton_a' },
      timestamp: 1,
    }] as any);
    registerTrigger('test_component_singleton_b', 'onTurnStart', (ctx: any) => [{
      type: SU_EVENTS.MINION_METADATA_UPDATED,
      payload: { minionUid: ctx.sourceCardUid, baseIndex: ctx.sourceBaseIndex, metadataUpdate: { touched: 'singleton_b' }, reason: 'singleton_b' },
      timestamp: 1,
    }] as any);
    registerTrigger('test_component_conflict_writer', 'onTurnStart', (_ctx: any) => [{
      type: SU_EVENTS.CARDS_DRAWN,
      payload: { playerId: '0', count: 1, cardUids: ['drawn-1'] },
      timestamp: 1,
    }] as any);
    registerTrigger('test_component_conflict_reader', 'onTurnStart', (_ctx: any) => [{
      type: SU_EVENTS.ABILITY_FEEDBACK,
      payload: { playerId: '0', messageKey: 'conflict_reader', tone: 'info' },
      timestamp: 1,
    }] as any, {
      fallbackFootprint: {
        reads: [{ kind: 'playerHand', playerId: '0' }],
        writes: [],
        fallbackReason: 'test reader observes player 0 hand without emitting state event',
      },
    });

    const core = baseCore({
      bases: [
        makeBase('test_base_1', [
          makeMinion('single-a', 'test_component_singleton_a', '0', 3),
        ]),
        makeBase('test_base_2', [
          makeMinion('single-b', 'test_component_singleton_b', '0', 3),
          makeMinion('conflict-writer', 'test_component_conflict_writer', '0', 3),
          makeMinion('conflict-reader', 'test_component_conflict_reader', '0', 3),
        ]),
      ],
    });

    const queued = collectTriggers(core, 'onTurnStart', {
      state: core,
      matchState: makeMatchState(core),
      playerId: '0',
      random: { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      now: 1,
    });
    expect(queued).toBeDefined();

    const ms0 = makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers });
    const rq = maybeResolveReactionQueue(ms0, { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any, 1);
    expect(rq).toBeDefined();
    expect(rq!.events.filter(event => event.type === SU_EVENTS.TRIGGER_CONSUMED)).toHaveLength(2);

    const current = rq!.state.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('smashup_reaction_choose');
    const optionLabels = current.data.options.map((option: any) => option.label as string);
    expect(optionLabels.some((label: string) => label.includes('test_component_singleton_a'))).toBe(false);
    expect(optionLabels.some((label: string) => label.includes('test_component_singleton_b'))).toBe(false);
    expect(optionLabels.some((label: string) => label.includes('test_component_conflict_writer'))).toBe(true);
    expect(optionLabels.some((label: string) => label.includes('test_component_conflict_reader'))).toBe(true);
  });

  it('互不冲突的 mandatory triggers 若会进入真实交互，应直接进入真实交互而不是先弹排序', () => {
    registerTrigger('test_real_prompt', 'onTurnStart', (ctx: any) => {
      const interaction = createSimpleChoice(
        `test_real_prompt_${ctx.now}`,
        '0',
        '真实交互',
        [
          { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
          { id: 'apply', label: '执行', value: { baseIndex: 0 }, displayMode: 'button' as const },
        ],
        { sourceId: 'test_real_prompt', targetType: 'button' },
      );
      return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
      };
    }, {});
    registerTrigger('test_real_side_effect', 'onTurnStart', () => ([{
      type: SU_EVENTS.CARDS_DRAWN,
      payload: { playerId: '0', count: 1, cardUids: ['drawn-1'] },
      timestamp: 1,
    }] as any));

    const core = baseCore({
      bases: [
        makeBase('test_base_1', [makeMinion('p1', 'test_real_prompt', '0', 3)]),
        makeBase('test_base_2', [makeMinion('s1', 'test_real_side_effect', '0', 3)]),
      ],
    });

    const queued = collectTriggers(core, 'onTurnStart', {
      state: core,
      matchState: makeMatchState(core),
      playerId: '0',
      random: { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      now: 1,
    });
    expect(queued).toBeDefined();

    const ms0 = makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers });
    const rq = maybeResolveReactionQueue(ms0, { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any, 1);
    expect(rq).toBeDefined();
    expect((rq!.state.sys.interaction.current as any)?.data?.sourceId).toBe('test_real_prompt');
    expect((rq!.state.sys.interaction.current as any)?.data?.sourceId).not.toBe('smashup_reaction_choose');
  });

  it('存在读写冲突的 mandatory triggers 仍应保留排序交互', () => {
    registerTrigger('test_conflict_writer', 'onMinionMoved', (_ctx: any) => [{
      type: SU_EVENTS.POWER_COUNTER_ADDED,
      payload: { minionUid: 'moved1', baseIndex: 1, amount: 1, reason: 'writer' },
      timestamp: 1,
    }] as any);
    registerTrigger('test_conflict_reader', 'onMinionMoved', (_ctx: any) => [{
      type: SU_EVENTS.POWER_COUNTER_REMOVED,
      payload: { minionUid: 'moved1', baseIndex: 1, amount: 1, reason: 'reader' },
      timestamp: 1,
    }] as any);

    const core = baseCore({
      bases: [
        makeBase('test_base_1'),
        makeBase('test_base_2', [
          makeMinion('a1', 'test_conflict_writer', '0', 3),
          makeMinion('b1', 'test_conflict_reader', '0', 3),
        ]),
      ],
    });

    const queued = collectTriggers(core, 'onMinionMoved', {
      state: core,
      matchState: makeMatchState(core),
      playerId: '0',
      baseIndex: 1,
      triggerMinionUid: 'moved1',
      triggerMinionDefId: 'any_minion',
      random: { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      now: 1,
    });
    expect(queued).toBeDefined();

    const ms0 = makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers });
    const rq = maybeResolveReactionQueue(ms0, { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any, 1);
    expect(rq).toBeDefined();
    expect((rq!.state.sys.interaction.current as any)?.data?.sourceId).toBe('smashup_reaction_choose');
  });

  it('witness: onMinionMoved triggers only if source is on destination base at trigger time', () => {
    registerTrigger('test_source_a', 'onMinionMoved', () => [], {});
    const core = baseCore({
      bases: [
        makeBase('test_base_1', [makeMinion('a1', 'test_source_a', '0', 3)]),
        makeBase('test_base_2'),
      ],
    });
    const queued = collectTriggers(core, 'onMinionMoved', {
      state: core,
      matchState: makeMatchState(core),
      playerId: '0',
      baseIndex: 1, // destination is base 1, but source is on base 0
      triggerMinionUid: 'moved1',
      triggerMinionDefId: 'any_minion',
      random: { shuffle: (a: any[]) => a } as any,
      now: 1,
    });
    expect(queued).toBeUndefined();
  });

  it('queued trigger execution re-enters post processing before reaction session continues', () => {
    registerTrigger('test_resolve_reveal', 'onMinionMoved', () => ([{
      type: SU_EVENTS.REVEAL_HAND,
      payload: {
        targetPlayerId: '1',
        viewerPlayerId: '0',
        sourcePlayerId: '0',
        cards: [{ uid: 'card-1', defId: 'test_action' }],
        reason: 'test_reveal',
      },
      timestamp: 2,
    }] as any), {});
    registerTrigger('test_inspection_optional', 'onDeckInspected', () => ([{
      type: SU_EVENTS.ABILITY_FEEDBACK,
      payload: { playerId: '0', messageKey: 'inspection', tone: 'info' },
      timestamp: 2,
    }] as any), {
      optional: true,
    });

    const core = baseCore({
      bases: [
        makeBase('test_base_1'),
        makeBase('test_base_2', [
          makeMinion('r1', 'test_resolve_reveal', '0', 3),
          makeMinion('i1', 'test_inspection_optional', '0', 3),
        ]),
      ],
    });

    const queued = collectTriggers(core, 'onMinionMoved', {
      state: core,
      matchState: makeMatchState(core),
      playerId: '0',
      baseIndex: 1,
      triggerMinionUid: 'moved1',
      triggerMinionDefId: 'any_minion',
      random: { shuffle: (a: any[]) => a } as any,
      now: 1,
    });
    expect(queued).toBeDefined();

    const ms0 = makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers });
    const rq = maybeResolveReactionQueue(ms0, { shuffle: (a: any[]) => a } as any, 2);
    expect(rq).toBeDefined();
    expect(rq!.events.some(event => event.type === SU_EVENTS.REVEAL_HAND)).toBe(true);
    expect(rq!.events.some(event => event.type === SU_EVENTS.TRIGGER_QUEUED)).toBe(true);
  });

  it('afterScoring 排序时会自动清掉已离场来源的 stale trigger，不再继续展示按钮', () => {
    registerTrigger('test_after_source_a', 'afterScoring', () => ([{
      type: SU_EVENTS.MINION_MOVED,
      payload: {
        minionUid: 'b1',
        minionDefId: 'test_after_source_b',
        fromBaseIndex: 0,
        toBaseIndex: 1,
        reason: 'test_after_source_a',
      },
      timestamp: 2,
    }] as any), {});
    registerTrigger('test_after_source_b', 'afterScoring', (ctx: any) => {
      const base = ctx.sourceBaseIndex === undefined ? undefined : ctx.state.bases[ctx.sourceBaseIndex];
      const sourceStillHere = !!base?.minions.some((minion: any) => minion.uid === ctx.sourceCardUid);
      return sourceStillHere
        ? [{
          type: SU_EVENTS.ABILITY_FEEDBACK,
          payload: { playerId: '0', messageKey: 'after_b', tone: 'info' },
          timestamp: 2,
        } as any]
        : [];
    }, {
      fallbackFootprint: {
        reads: [{ kind: 'base', index: 0 }],
        writes: [],
        fallbackReason: 'test source checks whether it is still on scoring base',
      },
    });

    const core = baseCore({
      bases: [
        makeBase('test_base_1', [
          makeMinion('a1', 'test_after_source_a', '0', 3),
          makeMinion('b1', 'test_after_source_b', '0', 3),
        ]),
        makeBase('test_base_2'),
      ],
    });

    const queued = collectTriggers(core, 'afterScoring', {
      state: core,
      matchState: makeMatchState(core),
      playerId: '0',
      baseIndex: 0,
      rankings: [{ playerId: '0', power: 6, vp: 1 }],
      random: { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      now: 1,
    });
    expect(queued).toBeDefined();

    const ms0 = makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers });
    const rq = maybeResolveReactionQueue(ms0, { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any, 1);
    expect(rq).toBeDefined();

    const current = rq!.state.sys.interaction.current as any;
    const optA = current.data.options.find((o: any) => (o.label as string).includes('test_after_source_a'));
    expect(optA).toBeDefined();

    const stateAfterPromptResolved = {
      ...rq!.state,
      sys: {
        ...rq!.state.sys,
        interaction: {
          ...rq!.state.sys.interaction,
          current: undefined,
        },
      },
    } as any;
    const r2 = resolveSmashUpReactionChoice(
      stateAfterPromptResolved,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      2,
      optA.value,
    );
    expect(r2.events.filter((event: any) => event.type === SU_EVENTS.TRIGGER_CONSUMED).length).toBeGreaterThanOrEqual(1);
    expect(r2.state.core.triggerQueue ?? []).toHaveLength(0);
    expect(r2.state.sys.interaction.current).toBeUndefined();
  });

  it('processMoveTriggers stamps queued onMinionMoved reactions with explicit frame ids', () => {
    registerTrigger('test_move_watcher', 'onMinionMoved', () => [], {});

    const core = baseCore({
      bases: [
        makeBase('test_base_1', [makeMinion('moved1', 'test_minion', '0', 2)]),
        makeBase('test_base_2', [makeMinion('watcher1', 'test_move_watcher', '0', 3)]),
      ],
    });

    const result = processMoveTriggers([{
      type: SU_EVENTS.MINION_MOVED,
      payload: {
        minionUid: 'moved1',
        minionDefId: 'test_minion',
        fromBaseIndex: 0,
        toBaseIndex: 1,
        reason: 'test_move',
      },
      timestamp: 7,
    } as any], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 7);

    const queued = result.events.find((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
    expect(queued).toBeDefined();
    const trigger = queued.payload.triggers[0];
    expect(trigger.sourceEventId).toBe('minion-moved:moved1:0:1:7');
    expect(trigger.frameId).toBe('minion-moved-frame:moved1:0:1:7');
    expect(trigger.moveFromBaseIndex).toBe(0);
    expect(trigger.moveToBaseIndex).toBe(1);
  });

  it('processMoveTriggers also stamps from-base queued onMinionMoved reactions with explicit frame ids', () => {
    registerTrigger('test_from_base_watcher', 'onMinionMoved', () => [], {});

    const core = baseCore({
      bases: [
        makeBase('test_base_1', [
          makeMinion('moved1', 'test_minion', '0', 2),
          makeMinion('watcher0', 'test_from_base_watcher', '0', 3),
        ]),
        makeBase('test_base_2'),
      ],
    });

    const result = processMoveTriggers([{
      type: SU_EVENTS.MINION_MOVED,
      payload: {
        minionUid: 'moved1',
        minionDefId: 'test_minion',
        fromBaseIndex: 0,
        toBaseIndex: 1,
        reason: 'test_move',
      },
      timestamp: 7,
    } as any], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 7);

    const queued = result.events.find((event: any) =>
      event.type === SU_EVENTS.TRIGGER_QUEUED
      && event.payload?.triggers?.[0]?.baseIndex === 0,
    ) as any;
    expect(queued).toBeDefined();
    const trigger = queued.payload.triggers[0];
    expect(trigger.sourceEventId).toBe('minion-moved:moved1:0:1:7');
    expect(trigger.frameId).toBe('minion-moved-frame:moved1:0:1:7');
    expect(trigger.moveFromBaseIndex).toBe(0);
    expect(trigger.moveToBaseIndex).toBe(1);
  });

  it('processMoveTriggers should collect moved-minion self triggers from the destination base after the move, not the stale from-base snapshot', () => {
    registerTrigger('test_move_self', 'onMinionMoved', () => [], {});

    const core = baseCore({
      bases: [
        makeBase('test_base_1', [makeMinion('moved-self', 'test_move_self', '0', 2)]),
        makeBase('test_base_2'),
      ],
    });

    const result = processMoveTriggers([{
      type: SU_EVENTS.MINION_MOVED,
      payload: {
        minionUid: 'moved-self',
        minionDefId: 'test_move_self',
        fromBaseIndex: 0,
        toBaseIndex: 1,
        reason: 'test_self_move_witness',
      },
      timestamp: 8,
    } as any], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 8);

    const triggers = result.events
      .filter((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED)
      .flatMap((event: any) => event.payload.triggers)
      .filter((trigger: any) => trigger.sourceDefId === 'test_move_self');

    expect(triggers).toHaveLength(1);
    expect(triggers[0]?.baseIndex).toBe(1);
    expect(triggers[0]?.sourceCardUid).toBe('moved-self');
  });

  it('processMoveTriggers also advances prior non-move events before collecting later onMinionMoved triggers', () => {
    registerTrigger('test_move_titan', 'onMinionMoved', () => [], {});

    const core = baseCore({
      bases: [makeBase('test_base_1'), makeBase('test_base_2')],
      titans: [{
        uid: 'move-titan-a',
        defId: 'test_move_titan',
        faction: 'test_faction',
        ownerId: '0',
        controllerId: '0',
        powerCounters: 0,
        talentUsed: false,
        location: { zone: 'setaside' },
      } as any],
    });

    const result = processMoveTriggers([
      {
        type: SU_EVENTS.TITAN_PLAYED,
        payload: {
          titanUid: 'move-titan-a',
          defId: 'test_move_titan',
          ownerId: '0',
          controllerId: '0',
          baseIndex: 1,
          reason: 'test_titan_entered_before_move',
        },
        timestamp: 8,
      } as any,
      {
        type: SU_EVENTS.MINION_MOVED,
        payload: {
          minionUid: 'moved1',
          minionDefId: 'test_minion',
          fromBaseIndex: 0,
          toBaseIndex: 1,
          reason: 'test_move_after_titan_play',
        },
        timestamp: 9,
      } as any,
    ], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 9);

    const triggers = result.events
      .filter((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED)
      .flatMap((event: any) => event.payload.triggers)
      .filter((trigger: any) => trigger.sourceDefId === 'test_move_titan');

    expect(triggers).toHaveLength(1);
    expect(triggers[0]?.baseIndex).toBe(1);
    expect(triggers[0]?.sourceCardUid).toBe('move-titan-a');
  });

  it('processDestroyTriggers stamps queued onMinionDestroyed reactions with explicit frame ids', () => {
    registerTrigger('test_destroy_watcher', 'onMinionDestroyed', () => [], {});

    const core = baseCore({
      bases: [
        makeBase('test_base_1'),
        makeBase('test_base_2', [
          makeMinion('victim1', 'test_minion', '0', 2),
          makeMinion('watcher1', 'test_destroy_watcher', '0', 3),
        ]),
      ],
    });

    const result = processDestroyTriggers([{
      type: SU_EVENTS.MINION_DESTROYED,
      payload: {
        minionUid: 'victim1',
        minionDefId: 'test_minion',
        fromBaseIndex: 1,
        ownerId: '0',
        destroyerId: '1',
        reason: 'test_destroy',
      },
      timestamp: 7,
    } as any], makeMatchState(core), '1', { shuffle: (a: any[]) => a } as any, 7);

    const queued = result.events.find((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
    expect(queued).toBeDefined();
    const trigger = queued.payload.triggers.find((candidate: any) => candidate.sourceDefId === 'test_destroy_watcher');
    expect(trigger).toBeDefined();
    expect(trigger.sourceEventId).toBe('minion-destroyed:victim1:1:7');
    expect(trigger.frameId).toBe('minion-destroyed-frame:victim1:1:7');
  });

  it('processDestroyTriggers also advances prior non-destroy events before collecting later onMinionDestroyed', () => {
    registerTrigger('test_destroy_titan', 'onMinionDestroyed', () => [], {});

    const core = baseCore({
      bases: [makeBase('test_base_1'), makeBase('test_base_2', [makeMinion('victim1', 'test_minion', '0', 2)])],
      titans: [{
        uid: 'destroy-titan-a',
        defId: 'test_destroy_titan',
        faction: 'test_faction',
        ownerId: '0',
        controllerId: '0',
        powerCounters: 0,
        talentUsed: false,
        location: { zone: 'setaside' },
      } as any],
    });

    const result = processDestroyTriggers([
      {
        type: SU_EVENTS.TITAN_PLAYED,
        payload: {
          titanUid: 'destroy-titan-a',
          defId: 'test_destroy_titan',
          ownerId: '0',
          controllerId: '0',
          baseIndex: 1,
          reason: 'test_titan_entered_before_destroy',
        },
        timestamp: 8,
      } as any,
      {
        type: SU_EVENTS.MINION_DESTROYED,
        payload: {
          minionUid: 'victim1',
          minionDefId: 'test_minion',
          fromBaseIndex: 1,
          ownerId: '0',
          destroyerId: '1',
          reason: 'test_destroy_after_titan_play',
        },
        timestamp: 9,
      } as any,
    ], makeMatchState(core), '1', { shuffle: (a: any[]) => a } as any, 9);

    const queuedEvents = result.events.filter((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED) as any[];
    const triggers = queuedEvents.flatMap((event: any) => event.payload?.triggers ?? []);

    expect(triggers.some((trigger: any) => trigger.sourceDefId === 'test_destroy_titan')).toBe(true);
  });

  it('processDestroyTriggers stamps queued onMinionDiscardedFromBase reactions with explicit frame ids', () => {
    registerTrigger('test_discard_watcher', 'onMinionDiscardedFromBase', () => [], {});

    const core = baseCore({
      bases: [
        makeBase('test_base_1'),
        makeBase('test_base_2', [
          makeMinion('victim2', 'test_minion', '0', 2),
          makeMinion('watcher2', 'test_discard_watcher', '0', 3),
        ]),
      ],
    });

    const result = processDestroyTriggers([{
      type: SU_EVENTS.MINION_DESTROYED,
      payload: {
        minionUid: 'victim2',
        minionDefId: 'test_minion',
        fromBaseIndex: 1,
        ownerId: '0',
        destroyerId: '1',
        reason: 'test_destroy_to_discard',
      },
      timestamp: 7,
    } as any], makeMatchState(core), '1', { shuffle: (a: any[]) => a } as any, 7);

    const queuedEvents = result.events.filter((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED) as any[];
    const trigger = queuedEvents
      .flatMap((event: any) => event.payload?.triggers ?? [])
      .find((candidate: any) => candidate.sourceDefId === 'test_discard_watcher');
    expect(trigger).toBeDefined();
    expect(trigger.sourceEventId).toBe('minion-discarded-from-base:victim2:1:7');
    expect(trigger.frameId).toBe('minion-discarded-from-base-frame:victim2:1:7');
  });

  it('processDestroyTriggers also advances prior non-destroy events before collecting later onMinionDiscardedFromBase', () => {
    registerTrigger('test_discard_titan', 'onMinionDiscardedFromBase', () => [], {});

    const core = baseCore({
      bases: [makeBase('test_base_1'), makeBase('test_base_2', [makeMinion('victim2', 'test_minion', '0', 2)])],
      titans: [{
        uid: 'discard-titan-a',
        defId: 'test_discard_titan',
        faction: 'test_faction',
        ownerId: '0',
        controllerId: '0',
        powerCounters: 0,
        talentUsed: false,
        location: { zone: 'setaside' },
      } as any],
    });

    const result = processDestroyTriggers([
      {
        type: SU_EVENTS.TITAN_PLAYED,
        payload: {
          titanUid: 'discard-titan-a',
          defId: 'test_discard_titan',
          ownerId: '0',
          controllerId: '0',
          baseIndex: 1,
          reason: 'test_titan_entered_before_discarded',
        },
        timestamp: 8,
      } as any,
      {
        type: SU_EVENTS.MINION_DESTROYED,
        payload: {
          minionUid: 'victim2',
          minionDefId: 'test_minion',
          fromBaseIndex: 1,
          ownerId: '0',
          destroyerId: '1',
          reason: 'test_destroy_after_titan_play_for_discard',
        },
        timestamp: 9,
      } as any,
    ], makeMatchState(core), '1', { shuffle: (a: any[]) => a } as any, 9);

    const triggers = result.events
      .filter((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED)
      .flatMap((event: any) => event.payload?.triggers ?? []);

    expect(triggers.some((trigger: any) => trigger.sourceDefId === 'test_discard_titan')).toBe(true);
  });

  it('processAffectTriggers stamps queued onMinionAffected reactions with explicit frame ids', () => {
    registerTrigger('test_affect_watcher', 'onMinionAffected', () => [], {});

    const core = baseCore({
      bases: [
        makeBase('test_base_1', [
          makeMinion('moved1', 'test_minion', '0', 2),
          makeMinion('watcher1', 'test_affect_watcher', '0', 3),
        ]),
        makeBase('test_base_2'),
      ],
    });

    const result = processAffectTriggers([{
      type: SU_EVENTS.MINION_MOVED,
      payload: {
        minionUid: 'moved1',
        minionDefId: 'test_minion',
        fromBaseIndex: 0,
        toBaseIndex: 1,
        reason: 'test_move',
      },
      timestamp: 9,
    } as any], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 9);

    const queued = result.events.find((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
    expect(queued).toBeDefined();
    const trigger = queued.payload.triggers[0];
    expect(trigger.sourceEventId).toBe(`minion-affected:${SU_EVENTS.MINION_MOVED}:moved1:move:0:0:0:9`);
    expect(trigger.frameId).toBe(`minion-affected-frame:${SU_EVENTS.MINION_MOVED}:moved1:move:0:0:0:9`);
  });

  it('processAffectTriggers 为 POWER_COUNTER 变化透传 counterChangeKind/counterDelta', () => {
    registerTrigger('test_affect_watcher', 'onMinionAffected', () => [], {});

    const core = baseCore({
      bases: [
        makeBase('test_base_1', [
          makeMinion('moved1', 'test_minion', '0', 2),
          makeMinion('watcher1', 'test_affect_watcher', '0', 3),
        ]),
        makeBase('test_base_2'),
      ],
    });

    const added = processAffectTriggers([{
      type: SU_EVENTS.POWER_COUNTER_ADDED,
      payload: {
        minionUid: 'moved1',
        baseIndex: 0,
        amount: 2,
        reason: 'test_counter_added',
      },
      timestamp: 12,
    } as any], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 12);

    const addedTrigger = (added.events.find((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED) as any)?.payload?.triggers?.[0];
    expect(addedTrigger).toBeDefined();
    expect(addedTrigger.counterChangeKind).toBe('added');
    expect(addedTrigger.counterDelta).toBe(2);

    const removed = processAffectTriggers([{
      type: SU_EVENTS.POWER_COUNTER_REMOVED,
      payload: {
        minionUid: 'moved1',
        baseIndex: 0,
        amount: 1,
        reason: 'test_counter_removed',
      },
      timestamp: 13,
    } as any], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 13);

    const removedTrigger = (removed.events.find((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED) as any)?.payload?.triggers?.[0];
    expect(removedTrigger).toBeDefined();
    expect(removedTrigger.counterChangeKind).toBe('removed');
    expect(removedTrigger.counterDelta).toBe(-1);
  });

  it('processAffectTriggers 会先推进前置 sibling event，再为后续 affect event 收集 onMinionAffected', () => {
    registerTrigger('test_affect_watcher', 'onMinionAffected', () => [], {});

    const core = baseCore({
      bases: [
        makeBase('test_base_1', [
          makeMinion('watcher1', 'test_affect_watcher', '0', 3),
        ]),
        makeBase('test_base_2', [
          makeMinion('target1', 'test_minion', '0', 2),
        ]),
      ],
    });

    const result = processAffectTriggers([
      {
        type: SU_EVENTS.MINION_MOVED,
        payload: {
          minionUid: 'watcher1',
          minionDefId: 'test_affect_watcher',
          fromBaseIndex: 0,
          toBaseIndex: 1,
          reason: 'move_watcher_first',
        },
        timestamp: 14,
      } as any,
      {
        type: SU_EVENTS.POWER_COUNTER_ADDED,
        payload: {
          minionUid: 'target1',
          baseIndex: 1,
          amount: 1,
          reason: 'affect_target_after_move',
        },
        timestamp: 15,
      } as any,
    ], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 15);

    const queuedEvents = result.events.filter((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED) as any[];
    const triggers = queuedEvents.flatMap((event: any) => event.payload?.triggers ?? []);

    expect(triggers.some((trigger: any) =>
      trigger.sourceDefId === 'test_affect_watcher'
      && trigger.sourceEventId === `minion-affected:${SU_EVENTS.POWER_COUNTER_ADDED}:target1:power_change:1:1:0:15`
    )).toBe(true);
  });

  it('processDeckInspectionTriggers stamps queued onDeckInspected reactions with explicit frame ids', () => {
    registerTrigger('test_inspect_watcher', 'onDeckInspected', () => [], {});

    const core = baseCore({
      bases: [
        makeBase('test_base_1', [makeMinion('watcher1', 'test_inspect_watcher', '0', 3)]),
        makeBase('test_base_2'),
      ],
    });

    const result = processDeckInspectionTriggers([{
      type: SU_EVENTS.REVEAL_HAND,
      payload: {
        targetPlayerId: '1',
        viewerPlayerId: '0',
        sourcePlayerId: '0',
        cards: [{ uid: 'card-1', defId: 'test_action' }],
        reason: 'test_reveal',
      },
      timestamp: 11,
    } as any], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 11);

    const queued = result.events.find((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
    expect(queued).toBeDefined();
    const trigger = queued.payload.triggers[0];
    expect(trigger.sourceEventId).toBe(`deck-inspected:${SU_EVENTS.REVEAL_HAND}:hand:1:0:11`);
    expect(trigger.frameId).toBe(`deck-inspected-frame:${SU_EVENTS.REVEAL_HAND}:hand:1:0:11`);
  });

  it('processDeckInspectionTriggers also advances prior non-inspection events before collecting onDeckInspected', () => {
    registerTrigger('test_inspect_titan', 'onDeckInspected', () => [], {});

    const core = baseCore({
      bases: [makeBase('test_base_1'), makeBase('test_base_2')],
      titans: [{
        uid: 'inspect-titan-a',
        defId: 'test_inspect_titan',
        faction: 'test_faction',
        ownerId: '0',
        controllerId: '0',
        powerCounters: 0,
        talentUsed: false,
        location: { zone: 'setaside' },
      } as any],
    });

    const result = processDeckInspectionTriggers([
      {
        type: SU_EVENTS.TITAN_PLAYED,
        payload: {
          titanUid: 'inspect-titan-a',
          defId: 'test_inspect_titan',
          ownerId: '0',
          controllerId: '0',
          baseIndex: 0,
          reason: 'test_titan_entered_before_inspect',
        },
        timestamp: 10,
      } as any,
      {
        type: SU_EVENTS.DECK_INSPECTED,
        payload: {
          targetPlayerId: '1',
          inspectorPlayerId: '0',
          count: 1,
          reason: 'test_inspect_after_play',
        },
        timestamp: 11,
      } as any,
    ], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 11);

    const queued = result.events.find((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
    expect(queued).toBeDefined();
    expect(queued.payload.triggers.some((trigger: any) => trigger.sourceDefId === 'test_inspect_titan')).toBe(true);
  });

  it('processReturnToHandTriggers stamps queued onCardReturnedToHand reactions with explicit frame ids', () => {
    registerTrigger('test_return_watcher', 'onCardReturnedToHand', () => [], {});

    const core = baseCore({
      bases: [
        makeBase('test_base_1'),
        makeBase('test_base_2', [
          makeMinion('watcher1', 'test_return_watcher', '0', 3),
          makeMinion('returned1', 'test_minion', '0', 2),
        ]),
      ],
    });

    const result = processReturnToHandTriggers([{
      type: SU_EVENTS.MINION_RETURNED,
      payload: {
        minionUid: 'returned1',
        minionDefId: 'test_minion',
        fromBaseIndex: 1,
        toPlayerId: '0',
        reason: 'test_return',
      },
      timestamp: 7,
    } as any], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 7);

    const queued = result.events.find((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
    expect(queued).toBeDefined();
    const trigger = queued.payload.triggers[0];
    expect(trigger.sourceEventId).toBe(`card-returned-to-hand:${SU_EVENTS.MINION_RETURNED}:returned1:0:0:7`);
    expect(trigger.frameId).toBe(`card-returned-to-hand-frame:${SU_EVENTS.MINION_RETURNED}:returned1:0:0:7`);
  });

  it('processReturnToHandTriggers also advances prior non-return events before collecting later onCardReturnedToHand', () => {
    registerTrigger('test_return_titan', 'onCardReturnedToHand', () => [], {});

    const core = baseCore({
      bases: [makeBase('test_base_1'), makeBase('test_base_2', [makeMinion('returned1', 'test_minion', '0', 2)])],
      titans: [{
        uid: 'return-titan-a',
        defId: 'test_return_titan',
        faction: 'test_faction',
        ownerId: '0',
        controllerId: '0',
        powerCounters: 0,
        talentUsed: false,
        location: { zone: 'setaside' },
      } as any],
    });

    const result = processReturnToHandTriggers([
      {
        type: SU_EVENTS.TITAN_PLAYED,
        payload: {
          titanUid: 'return-titan-a',
          defId: 'test_return_titan',
          ownerId: '0',
          controllerId: '0',
          baseIndex: 1,
          reason: 'test_titan_entered_before_return',
        },
        timestamp: 8,
      } as any,
      {
        type: SU_EVENTS.MINION_RETURNED,
        payload: {
          minionUid: 'returned1',
          minionDefId: 'test_minion',
          fromBaseIndex: 1,
          toPlayerId: '0',
          reason: 'test_return_after_titan_play',
        },
        timestamp: 9,
      } as any,
    ], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 9);

    const queued = result.events.find((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
    expect(queued).toBeDefined();
    expect(queued.payload.triggers.some((trigger: any) => trigger.sourceDefId === 'test_return_titan')).toBe(true);
  });

  it('trigger 无手写读写声明时不再阻断收集，排序 footprint 由运行时产物推导', () => {
    registerTrigger('missing_contract_source', 'onTurnStart', () => ([{
      type: SU_EVENTS.CARDS_DRAWN,
      payload: { playerId: '0', count: 1, cardUids: ['drawn-1'] },
      timestamp: 1,
    }] as any));

    const core = baseCore({
      bases: [makeBase('test_base_1', [makeMinion('m1', 'missing_contract_source', '0', 3)])],
    });

    const queued = collectTriggers(core, 'onTurnStart', {
      state: core,
      matchState: makeMatchState(core),
      playerId: '0',
      random: { shuffle: (a: any[]) => a } as any,
      now: 1,
    });
    expect(queued).toBeDefined();
    const state = makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers });
    const resolved = maybeResolveReactionQueue(state, { shuffle: (a: any[]) => a } as any, 1);
    expect(resolved?.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
  });

  it('两个无手写 footprint 的 queued triggers 若运行时产物写同一资源，仍应进入排序交互', () => {
    registerTrigger('missing_contract_conflict_a', 'onTurnStart', () => ([{
      type: SU_EVENTS.MINION_METADATA_UPDATED,
      payload: {
        minionUid: 'shared-target',
        baseIndex: 0,
        metadataUpdate: { touchedBy: 'a' },
        reason: 'missing_contract_a',
      },
      timestamp: 1,
    }] as any));
    registerTrigger('missing_contract_conflict_b', 'onTurnStart', () => ([{
      type: SU_EVENTS.MINION_METADATA_UPDATED,
      payload: {
        minionUid: 'shared-target',
        baseIndex: 0,
        metadataUpdate: { touchedBy: 'b' },
        reason: 'missing_contract_b',
      },
      timestamp: 1,
    }] as any));

    const core = baseCore({
      bases: [makeBase('test_base_1', [
        makeMinion('shared-target', 'sharks_mako', '0', 2),
        makeMinion('a1', 'missing_contract_conflict_a', '0', 3),
        makeMinion('b1', 'missing_contract_conflict_b', '0', 3),
      ])],
    });

    const queued = collectTriggers(core, 'onTurnStart', {
      state: core,
      matchState: makeMatchState(core),
      playerId: '0',
      random: { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      now: 1,
    });
    expect(queued).toBeDefined();
    const state = makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers });

    const queuedResolved = maybeResolveReactionQueue(
      state,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      1,
    );
    expect(queuedResolved).toBeDefined();
    const current = queuedResolved!.state.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('smashup_reaction_choose');
    const optionLabels = current.data.options.map((option: any) => option.label as string);
    expect(optionLabels.some((label: string) => label.includes('missing_contract_conflict_a'))).toBe(true);
    expect(optionLabels.some((label: string) => label.includes('missing_contract_conflict_b'))).toBe(true);

    const optionB = current.data.options.find((option: any) => (option.label as string).includes('missing_contract_conflict_b'));
    expect(optionB).toBeDefined();
    const handled = resolveSmashUpReactionChoice(
      queuedResolved!.state as any,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      2,
      optionB.value,
    );
    expect(handled.events[0].type).toBe(SU_EVENTS.TRIGGER_CONSUMED);
    expect(handled.events).toContainEqual(expect.objectContaining({
      type: SU_EVENTS.MINION_METADATA_UPDATED,
      payload: expect.objectContaining({
        minionUid: 'shared-target',
        metadataUpdate: expect.objectContaining({ touchedBy: 'b' }),
      }),
    }));
  });

  it('trigger 的显式 effectContract 即使 runtime artifacts 为空，仍应参与排序', () => {
    const effectContract = {
      reads: [],
      writes: [{ kind: 'minionMetadata', minionUid: 'shared-target' }],
    } as const;
    registerTrigger('explicit_contract_a', 'onTurnStart', () => ([] as any), {
      effectContract,
    });
    registerTrigger('explicit_contract_b', 'onTurnStart', () => ([] as any), {
      effectContract,
    });

    const core = baseCore({
      bases: [makeBase('test_base_1', [
        makeMinion('shared-target', 'sharks_mako', '0', 2),
        makeMinion('a1', 'explicit_contract_a', '0', 3),
        makeMinion('b1', 'explicit_contract_b', '0', 3),
      ])],
    });

    const queued = collectTriggers(core, 'onTurnStart', {
      state: core,
      matchState: makeMatchState(core),
      playerId: '0',
      random: { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      now: 1,
    });
    expect(queued).toBeDefined();
    const state = makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers });

    const queuedResolved = maybeResolveReactionQueue(
      state,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      1,
    );
    const current = queuedResolved?.state.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('smashup_reaction_choose');
  });

  it('trigger 的显式 effectContract 仍应保留 source card 读取，避免被同帧移除 source 时跳过排序', () => {
    registerTrigger('explicit_contract_source_reader', 'onTurnStart', () => ([] as any), {
      effectContract: {
        reads: [],
        writes: [{ kind: 'playerHand', playerId: '0' }],
      },
    });
    registerTrigger('explicit_contract_source_remover', 'onTurnStart', () => ([{
      type: SU_EVENTS.ONGOING_DETACHED,
      payload: {
        cardUid: 'reader-action',
        defId: 'explicit_contract_source_reader',
        ownerId: '0',
        reason: 'explicit_contract_source_remover',
      },
      timestamp: 1,
    }] as any));

    const core = baseCore({
      bases: [makeBase({
        defId: 'test_base_1',
        minions: [
          makeMinion('remover-1', 'explicit_contract_source_remover', '0', 3),
        ],
        ongoingActions: [
          {
            uid: 'reader-action',
            defId: 'explicit_contract_source_reader',
            ownerId: '0',
          } as any,
        ],
      })],
    });

    const queued = collectTriggers(core, 'onTurnStart', {
      state: core,
      matchState: makeMatchState(core),
      playerId: '0',
      random: { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      now: 1,
    });
    expect(queued).toBeDefined();
    const state = makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers });

    const queuedResolved = maybeResolveReactionQueue(
      state,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      1,
    );
    const current = queuedResolved?.state.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('smashup_reaction_choose');
    expect(current?.data?.options?.some((option: any) => (option.label as string).includes('explicit_contract_source_reader'))).toBe(true);
    expect(current?.data?.options?.some((option: any) => (option.label as string).includes('explicit_contract_source_remover'))).toBe(true);
  });

  it('同 owner 两张 borrowed zombie_overrun 同回合开始自毁时，应因共享真实 owner discard 写入进入排序选择', () => {
    registerTrigger('ordering_borrowed_detach', 'onTurnStart', (ctx: any) => {
      if (ctx.sourceBaseIndex === undefined || !ctx.sourceCardUid) return [] as any;
      const base = ctx.state.bases[ctx.sourceBaseIndex];
      const ongoing = base?.ongoingActions.find((action: any) => action.uid === ctx.sourceCardUid);
      if (!ongoing) return [] as any;
      return [{
        type: SU_EVENTS.ONGOING_DETACHED,
        payload: {
          cardUid: ongoing.uid,
          defId: ongoing.defId,
          ownerId: ongoing.ownerId,
          reason: 'ordering_borrowed_detach',
        },
        timestamp: ctx.now,
      }] as any;
    }, {
      playerContext: 'sourceController',
      perInstance: true,
    });

    const core = baseCore({
      bases: [makeBase({
        defId: 'base_portal_room',
        ongoingActions: [
          {
            uid: 'borrowed-overrun-a',
            defId: 'ordering_borrowed_detach',
            ownerId: '1',
            metadata: { sourceControllerId: '0' },
          } as any,
          {
            uid: 'borrowed-overrun-b',
            defId: 'ordering_borrowed_detach',
            ownerId: '1',
            metadata: { sourceControllerId: '0' },
          } as any,
        ],
      })],
      turnNumber: 31,
    });

    const queued = collectTriggers(core, 'onTurnStart', {
      state: core,
      matchState: makeMatchState(core),
      playerId: '0',
      random: { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      now: 31,
    });
    expect(queued).toBeDefined();
    expect((queued as any).payload.triggers).toHaveLength(2);

    const state = makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers });
    const queuedResolved = maybeResolveReactionQueue(
      state,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      31,
    );
    const current = queuedResolved?.state.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('smashup_reaction_choose');
    expect(current?.data?.options).toHaveLength(2);
  });

  it('borrowed ONGOING_ATTACHED 若会清 sourcePlayerId 手牌区时，应与读取该手牌区的 queued trigger 进入排序选择', () => {
    registerTrigger('ordering_borrowed_attach_writer', 'onTurnStart', () => ([{
      type: SU_EVENTS.ONGOING_ATTACHED,
      payload: {
        cardUid: 'borrowed-attach-a',
        defId: 'ordering_borrowed_attach_payload',
        ownerId: '1',
        sourcePlayerId: '0',
        targetType: 'base',
        targetBaseIndex: 0,
      },
      timestamp: 1,
    }] as any), {});
    registerTrigger('ordering_source_hand_reader', 'onTurnStart', () => ([] as any), {
      effectContract: {
        reads: [{ kind: 'playerHand', playerId: '0' }],
        writes: [],
      },
    });

    const core = baseCore({
      bases: [makeBase('test_base_1', [
        makeMinion('attach-writer-1', 'ordering_borrowed_attach_writer', '0', 3),
        makeMinion('hand-reader-1', 'ordering_source_hand_reader', '0', 3),
      ])],
    });

    const queued = collectTriggers(core, 'onTurnStart', {
      state: core,
      matchState: makeMatchState(core),
      playerId: '0',
      random: { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      now: 1,
    });
    expect(queued).toBeDefined();

    const state = makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers });
    const queuedResolved = maybeResolveReactionQueue(
      state,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      1,
    );
    const current = queuedResolved?.state.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('smashup_reaction_choose');
    expect(current?.data?.options).toHaveLength(2);
  });

  it('queued trigger 的 program.deriveFootprint 即使 runtime artifacts 为空，仍应参与排序', () => {
    registerTrigger('program_footprint_reader', 'onTurnStart', (ctx: any) => ([{
      type: SU_EVENTS.ABILITY_FEEDBACK,
      payload: { playerId: ctx.playerId, messageKey: 'program_reader', tone: 'info' },
      timestamp: 1,
    }] as any), {});
    registerTriggerProgramExecutor(
      'program_footprint_reader',
      'onTurnStart',
      createAbilityRuntimeExecutor(
        createEffectProgram((ctx: any) => ([{
          type: SU_EVENTS.ABILITY_FEEDBACK,
          payload: { playerId: ctx.playerId, messageKey: 'program_reader', tone: 'info' },
          timestamp: 1,
        }] as any), {
          deriveFootprint: () => ({
            reads: [{ kind: 'playerHand', playerId: '0' }],
            writes: [],
          }),
        }),
      ),
    );
    registerTrigger('program_footprint_writer', 'onTurnStart', () => ([{
      type: SU_EVENTS.CARDS_DRAWN,
      payload: { playerId: '0', count: 1, cardUids: ['drawn-1'] },
      timestamp: 1,
    }] as any), {});

    const core = baseCore({
      bases: [makeBase('test_base_1', [
        makeMinion('reader-1', 'program_footprint_reader', '0', 3),
        makeMinion('writer-1', 'program_footprint_writer', '0', 3),
      ])],
    });

    const queued = collectTriggers(core, 'onTurnStart', {
      state: core,
      matchState: makeMatchState(core),
      playerId: '0',
      random: { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      now: 1,
    });
    expect(queued).toBeDefined();

    const state = makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers });
    const queuedResolved = maybeResolveReactionQueue(
      state,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      1,
    );
    const current = queuedResolved?.state.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('smashup_reaction_choose');
    expect(current?.data?.options?.some((option: any) => (option.label as string).includes('program_footprint_reader'))).toBe(true);
    expect(current?.data?.options?.some((option: any) => (option.label as string).includes('program_footprint_writer'))).toBe(true);
    expect(getReactionFootprintFallbackAudit()).toEqual([]);
  });

  it('borrowed source 的 program.deriveFootprint 若依赖 sourceOwnerPlayerId 读取 true owner 手牌区时，应生成 true owner 手牌区 footprint 并与 writer 判定冲突', () => {
    registerTriggerProgramExecutor(
      'program_probe_owner_reader',
      'onTurnStart',
      createAbilityRuntimeExecutor(
        createEffectProgram((ctx: any) => ([{
          type: SU_EVENTS.ABILITY_FEEDBACK,
          payload: { playerId: ctx.playerId, messageKey: 'program_probe_owner_reader', tone: 'info' },
          timestamp: 1,
        }] as any), {
          deriveFootprint: (ctx: any) => ({
            reads: [{ kind: 'playerHand', playerId: ctx.sourceOwnerPlayerId }],
            writes: [],
          }),
        }),
      ),
    );

    const core = baseCore({
      bases: [makeBase('test_base_1', [], {
        ongoingActions: [
          {
            uid: 'borrowed-owner-reader',
            defId: 'program_probe_owner_reader',
            ownerId: '1',
            metadata: { sourceControllerId: '0' },
          } as any,
        ],
      }), makeBase('test_base_2', [
        makeMinion('owner-writer-1', 'program_probe_owner_writer', '0', 3),
      ])],
    });

    const ownerReaderTrigger: TriggerInstance = {
      id: 'program-probe-owner-reader',
      timing: 'onTurnStart',
      playerContext: 'sourceController',
      sourceDefId: 'program_probe_owner_reader',
      sourceCardUid: 'borrowed-owner-reader',
      sourceControllerId: '0',
      sourceOwnerPlayerId: '1',
      sourceBaseIndex: 0,
      mandatory: true,
      resolutionClass: 'mandatory',
      ownerPlayerId: '0',
      eventPlayerId: '0',
      witnessRequirement: 'inPlayAtTriggerTime',
      witnessed: true,
    };
    const ownerWriterTrigger: TriggerInstance = {
      id: 'program-probe-owner-writer',
      timing: 'onTurnStart',
      sourceDefId: 'program_probe_owner_writer',
      sourceCardUid: 'owner-writer-1',
      sourceControllerId: '0',
      sourceOwnerPlayerId: '0',
      sourceBaseIndex: 1,
      mandatory: true,
      resolutionClass: 'mandatory',
      ownerPlayerId: '0',
      eventPlayerId: '0',
      witnessRequirement: 'inPlayAtTriggerTime',
      witnessed: true,
      derivedFootprint: {
        reads: [],
        writes: [{ kind: 'playerHand', playerId: '1' }],
      },
    };
    expect(ownerReaderTrigger.sourceOwnerPlayerId).toBe('1');
    const ownerReaderProbe = deriveFootprintFromTriggerProbe(
      makeMatchState({ ...core, triggerQueue: [ownerReaderTrigger, ownerWriterTrigger] }),
      ownerReaderTrigger,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      1,
    );
    expect(ownerReaderProbe.reads.map(reactionResourceKey)).toContain('playerHand:1');
    expect(ownerWriterTrigger.derivedFootprint?.writes?.map(reactionResourceKey)).toContain('playerHand:1');
    expect(areReactionOrderingTriggersConflicting(
      ownerReaderTrigger,
      ownerWriterTrigger,
      makeMatchState({ ...core, triggerQueue: [ownerReaderTrigger, ownerWriterTrigger] }),
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      1,
    )).toBe(true);
  });

  it('manual queued borrowed reader/writer triggers 在 true owner 手牌区 footprint 冲突时，应进入排序选择', () => {
    registerTriggerProgramExecutor(
      'program_probe_owner_reader_manual',
      'onTurnStart',
      createAbilityRuntimeExecutor(
        createEffectProgram((ctx: any) => ([{
          type: SU_EVENTS.ABILITY_FEEDBACK,
          payload: { playerId: ctx.playerId, messageKey: 'program_probe_owner_reader_manual', tone: 'info' },
          timestamp: 1,
        }] as any), {
          deriveFootprint: (ctx: any) => ({
            reads: [{ kind: 'playerHand', playerId: ctx.sourceOwnerPlayerId }],
            writes: [],
          }),
        }),
      ),
    );

    const core = baseCore({
      bases: [makeBase('test_base_1', [], {
        ongoingActions: [
          {
            uid: 'borrowed-owner-reader-manual',
            defId: 'program_probe_owner_reader_manual',
            ownerId: '1',
            metadata: { sourceControllerId: '0' },
          } as any,
        ],
      })],
    });

    const readerTrigger: TriggerInstance = {
      id: 'program-probe-owner-reader-manual',
      timing: 'onTurnStart',
      frameId: 'manual-owner-hand-ordering-frame',
      sourceEventId: 'manual-owner-hand-ordering-event',
      playerContext: 'sourceController',
      sourceDefId: 'program_probe_owner_reader_manual',
      sourceCardUid: 'borrowed-owner-reader-manual',
      sourceControllerId: '0',
      sourceOwnerPlayerId: '1',
      sourceBaseIndex: 0,
      mandatory: true,
      resolutionClass: 'mandatory',
      ownerPlayerId: '0',
      eventPlayerId: '0',
      witnessRequirement: 'inPlayAtTriggerTime',
      witnessed: true,
    };
    const writerTrigger: TriggerInstance = {
      id: 'program-probe-owner-writer-manual',
      timing: 'onTurnStart',
      frameId: 'manual-owner-hand-ordering-frame',
      sourceEventId: 'manual-owner-hand-ordering-event',
      sourceDefId: 'program_probe_owner_writer_manual',
      sourceCardUid: 'owner-writer-manual',
      sourceControllerId: '0',
      sourceOwnerPlayerId: '0',
      sourceBaseIndex: 0,
      mandatory: true,
      resolutionClass: 'mandatory',
      ownerPlayerId: '0',
      eventPlayerId: '0',
      witnessRequirement: 'inPlayAtTriggerTime',
      witnessed: true,
      derivedFootprint: {
        reads: [],
        writes: [{ kind: 'playerHand', playerId: '1' }],
      },
    };

    const resolved = maybeResolveReactionQueue(
      makeMatchState({
        ...core,
        triggerQueue: [readerTrigger, writerTrigger],
      }),
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      1,
    );
    const current = resolved?.state.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('smashup_reaction_choose');
    expect(current?.data?.options?.some((option: any) => (option.label as string).includes('program_probe_owner_reader_manual'))).toBe(true);
    expect(current?.data?.options?.some((option: any) => (option.label as string).includes('program_probe_owner_writer_manual'))).toBe(true);
  });

  it('POD alias trigger 也应继承 effectContract 参与排序', () => {
    const effectContract = {
      reads: [{ kind: 'playerHand', playerId: '0' }],
      writes: [],
    } as const;
    registerTrigger('pod_alias_contract_source', 'onTurnStart', () => ([] as any), {
      effectContract,
    });
    registerPodOngoingAliases();
    registerTrigger('pod_alias_contract_writer', 'onTurnStart', () => ([{
      type: SU_EVENTS.CARDS_DRAWN,
      payload: {
        playerId: '0',
        count: 1,
        cardUids: ['drawn-1'],
      },
      timestamp: 1,
    }] as any), {});

    const core = baseCore({
      bases: [makeBase('test_base_1', [
        makeMinion('alias-pod-1', 'pod_alias_contract_source_pod', '0', 3),
        makeMinion('writer-1', 'pod_alias_contract_writer', '0', 3),
      ])],
    });

    const queued = collectTriggers(core, 'onTurnStart', {
      state: core,
      matchState: makeMatchState(core),
      playerId: '0',
      random: { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      now: 1,
    });
    expect(queued).toBeDefined();

    const state = makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers });
    const queuedResolved = maybeResolveReactionQueue(
      state,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      1,
    );
    const current = queuedResolved?.state.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('smashup_reaction_choose');
    expect(current?.data?.options?.some((option: any) => (option.label as string).includes('pod_alias_contract_source_pod'))).toBe(true);
    expect(current?.data?.options?.some((option: any) => (option.label as string).includes('pod_alias_contract_writer'))).toBe(true);
  });

  it('POD alias trigger 也应继承 playerContext=sourceController，而不是退回 eventPlayer', () => {
    registerTrigger('pod_alias_controller_source', 'onTurnStart', () => ([] as any), {
      optional: true,
      playerContext: 'sourceController',
    });
    registerPodOngoingAliases();

    const core = baseCore({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      bases: [makeBase('test_base_1', [
        makeMinion('alias-pod-ctrl', 'pod_alias_controller_source_pod', '1', 3),
      ])],
    });

    const queued = collectTriggers(core, 'onTurnStart', {
      state: core,
      matchState: makeMatchState(core),
      playerId: '1',
      random: { shuffle: (a: any[]) => a } as any,
      now: 1,
    });
    expect(queued).toBeDefined();
    expect((queued as any).payload.triggers[0].ownerPlayerId).toBe('1');
  });

  it('queued trigger 缺少 runtime executor 时直接报错，不再静默吞掉', () => {
    const core = baseCore({
      triggerQueue: [{
        id: 'missing-trigger',
        timing: 'onMinionMoved',
        sourceDefId: 'missing_executor_source',
        ownerPlayerId: '0',
        mandatory: true,
        resolutionClass: 'mandatory',
        frameId: 'missing-frame',
        sourceEventId: 'missing-event',
      }] as any,
    });

    const state = makeMatchState(core);

    expect(() =>
      maybeResolveReactionQueue(
        state,
        { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
        99,
      ),
    ).toThrowError(/缺少 ability runtime executor/);
  });
});

