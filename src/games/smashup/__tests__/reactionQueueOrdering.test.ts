import { describe, it, expect, beforeEach } from 'vitest';
import type { MatchState, RandomFn } from '../../../engine/types';
import type { SmashUpCore, SmashUpEvent, TriggerInstance } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import {
  applyEvents,
  expectNoPrompt,
  getPromptOption,
  getPromptOptions,
  getSimpleChoicePrompt,
  withPromptHandlerData,
  makeMatchState,
  makeMinion,
  makeState,
  makeBase,
  respondToPromptOption,
  withoutCurrentPrompt,
} from './helpers';
import { clearOngoingEffectRegistry, registerTrigger, collectTriggers } from '../domain/ongoingEffects';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { registerReactionQueueInteractionHandlers } from '../domain/reactionQueueHandlers';
import { resolveSmashUpReactionChoice, startSmashUpReactionSession } from '../domain/reactionSession';
import { processAffectTriggers, processDeckInspectionTriggers, processMoveTriggers } from '../domain/reducer';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { createAbilityRuntimeExecutor, createEffectProgram } from '../domain/abilityRuntime';
import { registerTriggerProgramExecutor } from '../domain/triggerExecutors';
import {
  clearReactionFootprintFallbackAudit,
  deriveFootprintFromEvent,
  deriveFootprintFromInteraction,
  deriveFootprintFromTriggerProbe,
  getReactionFootprintFallbackAudit,
  reactionResourceKey,
  resourceFootprintsConflict,
} from '../domain/reactionResources';
import '../domain/index';

function commitReactionEvents(
  state: MatchState<SmashUpCore>,
  events: SmashUpEvent[],
): MatchState<SmashUpCore> {
  return {
    ...state,
    core: applyEvents(state.core, events),
  };
}

function advanceReactionQueueThroughCommitBarrier(
  state: MatchState<SmashUpCore>,
  random: RandomFn,
  now: number,
  maxSteps = 20,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
  let currentState = state;
  const events: SmashUpEvent[] = [];
  for (let step = 0; step < maxSteps; step += 1) {
    const advanced = maybeResolveReactionQueue(currentState, random, now + step);
    if (!advanced) {
      return { state: currentState, events };
    }
    events.push(...advanced.events);
    currentState = commitReactionEvents(advanced.state, advanced.events);
    if (currentState.sys.interaction?.current || advanced.events.length === 0) {
      return { state: currentState, events };
    }
  }
  throw new Error('Reaction queue did not settle within test commit barrier limit');
}

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
  clearRegistry();
  clearBaseAbilityRegistry();
  clearOngoingEffectRegistry();
  clearInteractionHandlers();
  clearReactionFootprintFallbackAudit();
  resetAbilityInit();
  initAllAbilities();
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
    const interactionWithContext = withPromptHandlerData(interaction, {
      continuationContext: { titanUid: 'titan-1', cardUid: 'source-card-1' },
    });

    const footprint = deriveFootprintFromInteraction(interactionWithContext);
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

  it('continuationContext.selectedTargetUids 数组应映射到多张 minion footprint，而不是只记当前第二次分支选中的目标', () => {
    const interaction = createSimpleChoice(
      'the_bride_second_target',
      '0',
      '新娘：选择第二个目标',
      [
        { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
        {
          id: 'second-target-a',
          label: '第二目标 A',
          value: { targetUid: 'second-target-a', defId: 'zombie_walker', kind: 'hand' },
          displayMode: 'button' as const,
        },
      ],
      {
        sourceId: 'titan_frankenstein_the_bride_start_choose_target',
        targetType: 'button',
      },
    );
    const interactionWithContext = withPromptHandlerData(interaction, {
      continuationContext: {
        titanUid: 'bride-titan',
        selectedTargetUids: ['first-target-a'],
      },
    });

    const footprint = deriveFootprintFromInteraction(interactionWithContext);
    expect(footprint).toBeDefined();
    const writes = new Set(footprint!.writes.map(reactionResourceKey));
    expect(writes).toContain('minion:first-target-a');
    expect(writes).toContain('minion:second-target-a');
    expect(writes).toContain('cardInstance:bride-titan');
    expect(footprint!.fallbackReason).toBeUndefined();
  });

  it.each([
    ['Mushroom Kingdom', 'base_mushroom_kingdom', { minionUid: 'mk-target', baseIndex: 0 }],
    ['Sprout', 'killer_plant_sprout_search', { cardUid: 'sprout-deck-card', baseIndex: 0, playerId: '0' }],
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

  it('borrowed ACTION_PLAYED 在 fromDiscard 场景下应同时暴露 source discard 与 owner discard 写入', () => {
    const footprint = deriveFootprintFromEvent({
      type: SU_EVENTS.ACTION_PLAYED,
      payload: {
        playerId: '0',
        ownerId: '1',
        cardUid: 'borrowed-action-a',
        defId: 'test_action',
        fromDiscard: true,
        baseIndex: 0,
      },
      timestamp: 1,
    } as SmashUpEvent);

    const writes = new Set(footprint.writes.map(reactionResourceKey));
    expect(writes).toContain('cardInstance:borrowed-action-a');
    expect(writes).toContain('playerDiscard:0');
    expect(writes).toContain('playerDiscard:1');
    expect(writes).toContain('playerPlayLimit:0');
  });

  it('borrowed ONGOING_ATTACHED 事件应显式暴露 sourcePlayerId 与 ownerId 的牌区写入', () => {
    const footprint = deriveFootprintFromEvent({
      type: SU_EVENTS.ONGOING_ATTACHED,
      payload: {
        cardUid: 'borrowed-ongoing-a',
        defId: 'test_ongoing',
        ownerId: '1',
        sourcePlayerId: '0',
        targetType: 'minion',
        targetBaseIndex: 0,
        targetMinionUid: 'target-minion-a',
      },
      timestamp: 1,
    } as SmashUpEvent);

    const writes = new Set(footprint.writes.map(reactionResourceKey));
    expect(writes).toContain('cardInstance:borrowed-ongoing-a');
    expect(writes).toContain('base:0');
    expect(writes).toContain('playerHand:0');
    expect(writes).toContain('playerDeck:0');
    expect(writes).toContain('playerDiscard:0');
    expect(writes).toContain('playerHand:1');
    expect(writes).toContain('playerDeck:1');
    expect(writes).toContain('playerDiscard:1');
  });

  it('su:card_to_deck_top 在 borrowed/sourcePlayer 场景下应同时暴露 sourcePlayerId 与 ownerId 的牌区写入', () => {
    const footprint = deriveFootprintFromEvent({
      type: SU_EVENTS.CARD_TO_DECK_TOP,
      payload: {
        cardUid: 'borrowed-card-top',
        defId: 'test_minion',
        ownerId: '1',
        sourcePlayerId: '0',
        sourceControllerId: '0',
        sourceCardUid: 'borrowed-card-top',
        sourceDefId: 'test_minion',
        sourceBaseIndex: 0,
        playerId: '0',
        fromPlayerId: '0',
      },
      timestamp: 1,
    } as SmashUpEvent);

    const writes = new Set(footprint.writes.map(reactionResourceKey));
    expect(writes).toContain('cardInstance:borrowed-card-top');
    expect(writes).toContain('playerHand:0');
    expect(writes).toContain('playerDeck:0');
    expect(writes).toContain('playerDiscard:0');
    expect(writes).toContain('playerDeck:1');
    expect(writes).toContain('playerDiscard:1');
  });

  it('su:card_to_deck_bottom 在 borrowed/sourcePlayer 场景下应同时暴露 sourcePlayerId 与 ownerId 的牌区写入', () => {
    const footprint = deriveFootprintFromEvent({
      type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
      payload: {
        cardUid: 'borrowed-card-bottom',
        defId: 'test_minion',
        ownerId: '1',
        sourcePlayerId: '0',
        sourceControllerId: '0',
        sourceCardUid: 'borrowed-card-bottom',
        sourceDefId: 'test_minion',
        sourceBaseIndex: 0,
        playerId: '0',
        fromPlayerId: '0',
      },
      timestamp: 1,
    } as SmashUpEvent);

    const writes = new Set(footprint.writes.map(reactionResourceKey));
    expect(writes).toContain('cardInstance:borrowed-card-bottom');
    expect(writes).toContain('playerHand:0');
    expect(writes).toContain('playerDeck:0');
    expect(writes).toContain('playerDiscard:0');
    expect(writes).toContain('playerDeck:1');
    expect(writes).toContain('playerDiscard:1');
  });

  it('ONGOING_DETACHED 事件应显式暴露真实 owner discard 写入，而不是只记 cardInstance', () => {
    const footprint = deriveFootprintFromEvent({
      type: SU_EVENTS.ONGOING_DETACHED,
      payload: {
        cardUid: 'borrowed-overrun-a',
        defId: 'zombie_overrun',
        ownerId: '1',
        reason: 'zombie_overrun_self_destruct',
        sourcePlayerId: '0',
        sourceCardUid: 'borrowed-overrun-a',
        sourceDefId: 'zombie_overrun',
        sourceControllerId: '0',
        sourceBaseIndex: 0,
      },
      timestamp: 1,
    } as SmashUpEvent);

    const writes = new Set(footprint.writes.map(reactionResourceKey));
    expect(writes).toContain('cardInstance:borrowed-overrun-a');
    expect(writes).toContain('playerDiscard:1');
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
    expect(getSimpleChoicePrompt(rq!.state, 'smashup_reaction_choose')).toBeDefined();
    expect(getReactionFootprintFallbackAudit()).toContainEqual(expect.objectContaining({
      sourceDefId: 'test_fallback_reader',
      reason: 'test reads hand through non-event query',
    }));
  });

  it('queued trigger 的 program.deriveFootprint 即使 runtime artifacts 为空，仍应参与排序', () => {
    registerTrigger('program_probe_no_runtime_artifacts', 'onTurnStart', () => [], {});
    registerTriggerProgramExecutor(
      'program_probe_no_runtime_artifacts',
      'onTurnStart',
      createAbilityRuntimeExecutor(createEffectProgram(
        () => [],
        {
          deriveFootprint: () => ({
            reads: [{ kind: 'playerHand', playerId: '0' }],
            writes: [],
          }),
        },
      )),
    );

    const trigger = {
      id: 'program-probe-no-runtime-artifacts',
      timing: 'onTurnStart',
      sourceDefId: 'program_probe_no_runtime_artifacts',
      ownerPlayerId: '0',
      sourceControllerId: '0',
      mandatory: true,
      resolutionClass: 'mandatory',
    } as TriggerInstance;

    const footprint = deriveFootprintFromTriggerProbe(
      makeMatchState(baseCore()),
      trigger,
      { shuffle: (items: any[]) => items } as any,
      1,
    );

    expect(footprint.fallbackReason).toBeUndefined();
    expect(footprint.reads.map(reactionResourceKey)).toContain('playerHand:0');
  });

  it('borrowed source 的 program.deriveFootprint 若依赖 sourceOwnerPlayerId 读取 true owner 手牌区时，应生成 true owner 手牌区 footprint 并与 writer 判定冲突', () => {
    registerTrigger('program_probe_owner_reader', 'onTurnStart', () => [], {});
    registerTriggerProgramExecutor(
      'program_probe_owner_reader',
      'onTurnStart',
      createAbilityRuntimeExecutor(createEffectProgram(
        () => [],
        {
          deriveFootprint: (ctx: any) => ({
            reads: [{ kind: 'playerHand', playerId: ctx.sourceOwnerPlayerId }],
            writes: [],
          }),
        },
      )),
    );

    const readerTrigger = {
      id: 'program-probe-owner-reader',
      timing: 'onTurnStart',
      sourceDefId: 'program_probe_owner_reader',
      ownerPlayerId: '0',
      sourceControllerId: '0',
      sourceOwnerPlayerId: '1',
      mandatory: true,
      resolutionClass: 'mandatory',
    } as TriggerInstance;

    const readerFootprint = deriveFootprintFromTriggerProbe(
      makeMatchState(baseCore()),
      readerTrigger,
      { shuffle: (items: any[]) => items } as any,
      1,
    );
    const writerFootprint = {
      reads: [],
      writes: [{ kind: 'playerHand', playerId: '1' }],
    } as any;

    expect(readerFootprint.fallbackReason).toBeUndefined();
    expect(readerFootprint.reads.map(reactionResourceKey)).toContain('playerHand:1');
    expect(resourceFootprintsConflict(readerFootprint, writerFootprint)).toBe(true);
  });

  it('manual queued borrowed reader/writer triggers 在 true owner 手牌区 footprint 冲突时，应进入排序选择', () => {
    const frameId = 'manual-owner-hand-ordering-frame';
    const sourceEventId = 'manual-owner-hand-ordering-event';
    const state = makeMatchState(baseCore({
      triggerQueue: [
        {
          id: 'manual-owner-reader',
          timing: 'onTurnStart',
          sourceDefId: 'program_probe_owner_reader_manual',
          ownerPlayerId: '0',
          sourceControllerId: '0',
          sourceOwnerPlayerId: '1',
          mandatory: true,
          resolutionClass: 'mandatory',
          frameId,
          sourceEventId,
          fallbackFootprint: {
            reads: [{ kind: 'playerHand', playerId: '1' }],
            writes: [],
            fallbackReason: 'manual queued borrowed reader observes true owner hand',
          },
        },
        {
          id: 'manual-owner-writer',
          timing: 'onTurnStart',
          sourceDefId: 'program_probe_owner_writer_manual',
          ownerPlayerId: '0',
          sourceControllerId: '0',
          sourceOwnerPlayerId: '1',
          mandatory: true,
          resolutionClass: 'mandatory',
          frameId,
          sourceEventId,
          fallbackFootprint: {
            reads: [],
            writes: [{ kind: 'playerHand', playerId: '1' }],
            fallbackReason: 'manual queued borrowed writer writes true owner hand',
          },
        },
      ] as any,
    }));

    const rq = maybeResolveReactionQueue(
      state,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      1,
    );

    expect(rq).toBeDefined();
    expect(getSimpleChoicePrompt(rq!.state, 'smashup_reaction_choose')).toBeDefined();
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
    const current = getSimpleChoicePrompt(ms1, 'smashup_reaction_choose');

    // Choose trigger B first
    const optB = getPromptOption(current, (o: any) => (o.label as string).includes('test_source_b'), 'test_source_b trigger option');
    const r2 = respondToPromptOption(
      ms1,
      (option: any) => option.id === optB.id,
      'test_source_b trigger option',
      '0',
      { shuffle: (a: any[]) => a } as any,
    );
    expect(r2).toBeDefined();
    const evts = r2.events as SmashUpEvent[];
    expect(evts.some(e => e.type === SU_EVENTS.TRIGGER_CONSUMED)).toBe(true);
    // And executor event is produced
    expect(evts.some(e => e.type === SU_EVENTS.POWER_COUNTER_REMOVED)).toBe(true);
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
    const rq = advanceReactionQueueThroughCommitBarrier(
      ms0,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      1,
    );
    expectNoPrompt(rq.state);
    expect(rq.state.core.triggerQueue ?? []).toHaveLength(0);
    expect(rq.events.filter(event => event.type === SU_EVENTS.TRIGGER_CONSUMED)).toHaveLength(2);
    expect(rq.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
    expect(rq.events.some(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(true);
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
    const rq = advanceReactionQueueThroughCommitBarrier(
      ms0,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      1,
    );
    expectNoPrompt(rq.state);
    expect(rq.state.core.triggerQueue ?? []).toHaveLength(0);
    expect(rq.events.filter(event => event.type === SU_EVENTS.TRIGGER_CONSUMED)).toHaveLength(2);
    expect(rq.events.filter(event => event.type === SU_EVENTS.MINION_METADATA_UPDATED)).toHaveLength(2);
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
    const rq = advanceReactionQueueThroughCommitBarrier(
      ms0,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      1,
    );
    expect(rq.events.filter(event => event.type === SU_EVENTS.TRIGGER_CONSUMED)).toHaveLength(2);

    const current = getSimpleChoicePrompt(rq.state, 'smashup_reaction_choose');
    const optionLabels = getPromptOptions(current).map((option: any) => option.label as string);
    expect(optionLabels.some((label: string) => label.includes('test_component_singleton_a'))).toBe(false);
    expect(optionLabels.some((label: string) => label.includes('test_component_singleton_b'))).toBe(false);
    expect(optionLabels.some((label: string) => label.includes('test_component_conflict_writer'))).toBe(true);
    expect(optionLabels.some((label: string) => label.includes('test_component_conflict_reader'))).toBe(true);
  });

  it('borrowed ONGOING_ATTACHED 若会清 sourcePlayerId 手牌区时，应与读取该手牌区的 queued trigger 进入排序选择', () => {
    registerTrigger('test_borrowed_attach_writer', 'onTurnStart', () => ([{
      type: SU_EVENTS.ONGOING_ATTACHED,
      payload: {
        cardUid: 'borrowed-ongoing-a',
        defId: 'test_borrowed_attach_writer',
        ownerId: '1',
        sourcePlayerId: '0',
        targetType: 'minion',
        targetBaseIndex: 0,
        targetMinionUid: 'host-a',
      },
      timestamp: 1,
    }] as any));
    registerTrigger('test_borrowed_attach_reader', 'onTurnStart', () => ([{
      type: SU_EVENTS.ABILITY_FEEDBACK,
      payload: { playerId: '0', messageKey: 'borrowed_attach_reader', tone: 'info' },
      timestamp: 1,
    }] as any), {
      fallbackFootprint: {
        reads: [{ kind: 'playerHand', playerId: '0' }],
        writes: [],
        fallbackReason: 'test borrowed attach reader observes source player hand',
      },
    });

    const core = baseCore({
      players: {
        '0': { ...makeState().players['0'], hand: [{ uid: 'hand-a', defId: 'test_action', owner: '0', type: 'action' }] as any },
        '1': makeState().players['1'],
      },
      bases: [
        makeBase('test_base_1', [
          makeMinion('writer-a', 'test_borrowed_attach_writer', '0', 3),
          makeMinion('reader-a', 'test_borrowed_attach_reader', '0', 3),
          makeMinion('host-a', 'test_host', '0', 3),
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

    const rq = maybeResolveReactionQueue(
      makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers }),
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      1,
    );
    expect(getSimpleChoicePrompt(rq!.state, 'smashup_reaction_choose')).toBeDefined();
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
    expect(getSimpleChoicePrompt(rq!.state, 'test_real_prompt')).toBeDefined();
  });

  it('同 owner 两张 borrowed zombie_overrun 同回合开始自毁时，应因共享真实 owner discard 写入进入排序选择', () => {
    const base = makeBase({
      defId: 'base_portal_room',
      ongoingActions: [],
    });
    const baseCoreState = makeState({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      players: {
        '0': makeState().players['0'],
        '1': makeState().players['1'],
      },
      bases: [base],
      turnNumber: 31,
    });
    const firstAttach = processAffectTriggers([{
      type: SU_EVENTS.ONGOING_ATTACHED,
      payload: {
        cardUid: 'borrowed-overrun-a',
        defId: 'zombie_overrun',
        ownerId: '1',
        sourcePlayerId: '0',
        targetType: 'base',
        targetBaseIndex: 0,
      },
      timestamp: 30,
    } as any], makeMatchState(baseCoreState), '0', { shuffle: (a: any[]) => a } as any, 30);
    const withFirst = applyEvents(baseCoreState, firstAttach.events);
    const secondAttach = processAffectTriggers([{
      type: SU_EVENTS.ONGOING_ATTACHED,
      payload: {
        cardUid: 'borrowed-overrun-b',
        defId: 'zombie_overrun',
        ownerId: '1',
        sourcePlayerId: '0',
        targetType: 'base',
        targetBaseIndex: 0,
      },
      timestamp: 30.1,
    } as any], makeMatchState(withFirst), '0', { shuffle: (a: any[]) => a } as any, 30.1);
    const core = applyEvents(withFirst, secondAttach.events);

    const queued = collectTriggers(core, 'onTurnStart', {
      state: core,
      matchState: makeMatchState(core),
      playerId: '0',
      random: { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      now: 31,
    });
    expect(queued).toBeDefined();

    const rq = maybeResolveReactionQueue(
      makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers }),
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      31,
    );
    expect(getSimpleChoicePrompt(rq!.state, 'smashup_reaction_choose')).toBeDefined();
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
    expect(getSimpleChoicePrompt(rq!.state, 'smashup_reaction_choose')).toBeDefined();
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

  it('afterScoring 来源在触发后离场时，已排队 trigger 仍应继续结算', () => {
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
    registerTrigger('test_after_source_b', 'afterScoring', () => ([{
      type: SU_EVENTS.ABILITY_FEEDBACK,
      payload: { playerId: '0', messageKey: 'after_b', tone: 'info' },
      timestamp: 2,
    } as any]), {
      fallbackFootprint: {
        reads: [{ kind: 'base', index: 0 }],
        writes: [],
        fallbackReason: 'test source resolves from queued trigger snapshot after leaving base',
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

    const current = getSimpleChoicePrompt(rq!.state, 'smashup_reaction_choose');
    const optA = getPromptOption(current, (o: any) => (o.label as string).includes('test_after_source_a'), 'test_after_source_a trigger option');

    const stateAfterPromptResolved = withoutCurrentPrompt(rq!.state);
    const r2 = resolveSmashUpReactionChoice(
      stateAfterPromptResolved,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      2,
      optA.value,
    );
    const continued = advanceReactionQueueThroughCommitBarrier(
      commitReactionEvents(r2.state, r2.events),
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      3,
    );
    const allEvents = [...r2.events, ...continued.events];
    expect(allEvents.filter((event: any) => event.type === SU_EVENTS.TRIGGER_CONSUMED).length).toBeGreaterThanOrEqual(2);
    expect(allEvents).toContainEqual(expect.objectContaining({
      type: SU_EVENTS.ABILITY_FEEDBACK,
      payload: expect.objectContaining({ messageKey: 'after_b' }),
    }));
    expect(continued.state.core.triggerQueue ?? []).toHaveLength(0);
    expectNoPrompt(continued.state);
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

  it('强制触发按钮所属 frame 与当前 afterScoring session 漂移时，仍应按按钮 trigger frame 消费', () => {
    registerTrigger('test_discard_from_base_watcher', 'onMinionDiscardedFromBase', () => ([{
      type: SU_EVENTS.ABILITY_FEEDBACK,
      payload: { playerId: '0', messageKey: 'discard_from_base_resolved' },
      timestamp: 2,
    } as any]), {});

    const triggerFrameId = 'onMinionDiscardedFromBase:onMinionDiscardedFromBase:0';
    const trigger: TriggerInstance = {
      id: `${triggerFrameId}:test_discard_from_base_watcher:0`,
      timing: 'onMinionDiscardedFromBase',
      playerContext: 'sourceController',
      sourceDefId: 'test_discard_from_base_watcher',
      sourceCardUid: 'discard-watcher',
      sourceControllerId: '0',
      sourceOwnerPlayerId: '0',
      mandatory: true,
      resolutionClass: 'mandatory',
      frameId: triggerFrameId,
      sourceEventId: 'onMinionDiscardedFromBase:0',
      ownerPlayerId: '0',
      eventPlayerId: '0',
      baseIndex: 0,
      triggerMinionUid: 'discarded-host',
      triggerMinionDefId: 'test_host',
      triggerMinionPower: 3,
    } as TriggerInstance;
    const core = baseCore({
      triggerQueue: [trigger],
    });
    const state = startSmashUpReactionSession(makeMatchState(core), {
      frameId: 'score-after:0:0',
      frameKind: 'score-after',
      responseWindowType: 'afterScoring',
    });

    const resolved = resolveSmashUpReactionChoice(
      state,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      2,
      { kind: 'trigger', triggerId: trigger.id },
    );

    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: SU_EVENTS.TRIGGER_CONSUMED,
      payload: { triggerId: trigger.id },
    }));
    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: SU_EVENTS.ABILITY_FEEDBACK,
      payload: expect.objectContaining({ messageKey: 'discard_from_base_resolved' }),
    }));
    const committed = commitReactionEvents(resolved.state, resolved.events);
    expect(committed.core.triggerQueue ?? []).toHaveLength(0);
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
      titans: [{
        uid: 'inspect-titan-1',
        defId: 'test_inspect_titan',
        faction: 'wizards',
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
          titanUid: 'inspect-titan-1',
          defId: 'test_inspect_titan',
          ownerId: '0',
          controllerId: '0',
          baseIndex: 0,
          baseDefId: core.bases[0].defId,
          reason: 'test_inspection_setup',
        },
        timestamp: 12,
      } as any,
      {
        type: SU_EVENTS.DECK_INSPECTED,
        payload: {
          inspectorPlayerId: '0',
          targetPlayerId: '1',
          reason: 'test_inspection_after_titan',
        },
        timestamp: 13,
      } as any,
    ], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 13);

    const queued = result.events.find((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
    expect(queued).toBeDefined();
    expect(queued.payload.triggers.some((trigger: any) => trigger.sourceDefId === 'test_inspect_titan')).toBe(true);
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

