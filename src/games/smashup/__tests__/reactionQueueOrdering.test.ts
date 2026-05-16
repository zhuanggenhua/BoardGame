import { describe, it, expect, beforeEach } from 'vitest';
import type { SmashUpCore, SmashUpEvent, TriggerInstance } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import {
  expectNoPrompt,
  getPromptOption,
  getPromptOptions,
  getSimpleChoicePrompt,
  withPromptHandlerData,
  makeMatchState,
  makeMinion,
  makeState,
  makeBase,
  resolvePromptViaRegisteredHandler,
  withoutCurrentPrompt,
} from './helpers';
import { clearOngoingEffectRegistry, registerTrigger, collectTriggers } from '../domain/ongoingEffects';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { registerReactionQueueInteractionHandlers } from '../domain/reactionQueueHandlers';
import { resolveSmashUpReactionChoice } from '../domain/reactionSession';
import { processAffectTriggers, processDeckInspectionTriggers, processMoveTriggers } from '../domain/reducer';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import {
  clearReactionFootprintFallbackAudit,
  deriveFootprintFromEvent,
  deriveFootprintFromInteraction,
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
    const r2 = resolvePromptViaRegisteredHandler(ms1 as any, current, optB.value, 2, { shuffle: (a: any[]) => a } as any);
    expect(r2).toBeDefined();
    const evts = r2!.events as SmashUpEvent[];
    expect(evts[0].type).toBe(SU_EVENTS.TRIGGER_CONSUMED);
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
    const rq = maybeResolveReactionQueue(ms0, { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any, 1);
    expect(rq).toBeDefined();
    expectNoPrompt(rq!.state);
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
    expectNoPrompt(rq!.state);
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

    const current = getSimpleChoicePrompt(rq!.state, 'smashup_reaction_choose');
    const optionLabels = getPromptOptions(current).map((option: any) => option.label as string);
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
    expect(getSimpleChoicePrompt(rq!.state, 'test_real_prompt')).toBeDefined();
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

    const current = getSimpleChoicePrompt(rq!.state, 'smashup_reaction_choose');
    const optA = getPromptOption(current, (o: any) => (o.label as string).includes('test_after_source_a'), 'test_after_source_a trigger option');

    const stateAfterPromptResolved = withoutCurrentPrompt(rq!.state);
    const r2 = resolveSmashUpReactionChoice(
      stateAfterPromptResolved,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      2,
      optA.value,
    );
    expect(r2.events.filter((event: any) => event.type === SU_EVENTS.TRIGGER_CONSUMED).length).toBeGreaterThanOrEqual(1);
    expect(r2.state.core.triggerQueue ?? []).toHaveLength(0);
    expectNoPrompt(r2.state);
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

