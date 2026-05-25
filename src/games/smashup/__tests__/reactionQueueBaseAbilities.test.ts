import { describe, it, expect, beforeEach } from 'vitest';
import type { SmashUpCore, SmashUpEvent, TriggerInstance } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { makeMatchState, makeState, makeBase, makeMinion } from './helpers';
import { clearBaseAbilityRegistry, registerBaseAbilities, registerBaseAbility, registerExtended } from '../domain/baseAbilities';
import { registerReactionQueueInteractionHandlers } from '../domain/reactionQueueHandlers';
import { clearInteractionHandlers, getInteractionHandler } from '../domain/abilityInteractionHandlers';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { collectBaseAbilityTriggers, collectExtendedBaseAbilityTriggers } from '../domain/baseAbilityQueue';
import { clearOngoingEffectRegistry, collectTriggers, registerTrigger } from '../domain/ongoingEffects';
import { postProcessSystemEvents } from '../domain';
import { processAffectTriggers, processDeckInspectionTriggers, processDestroyTriggers, processMoveTriggers, processReturnToHandTriggers } from '../domain/reducer';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';

function core2b(overrides?: Partial<SmashUpCore>): SmashUpCore {
  return makeState({
    turnOrder: ['0', '1'],
    currentPlayerIndex: 0,
    bases: [makeBase('base_a'), makeBase('base_b')],
    ...overrides,
  });
}

beforeEach(() => {
  clearBaseAbilityRegistry();
  clearOngoingEffectRegistry();
  clearInteractionHandlers();
  registerReactionQueueInteractionHandlers();
});

describe('Reaction queue: base abilities', () => {
  it('two base abilities same timing -> ordering prompt for current player', () => {
    // Arrange: register two base abilities that write the same real player play-limit resource
    registerBaseAbility('base_a', 'onTurnStart', (ctx) => ({
      events: [{
        type: SU_EVENTS.LIMIT_MODIFIED,
        payload: { playerId: ctx.playerId, limitType: 'minion', delta: 1, reason: 'base_a' },
        timestamp: ctx.now,
      }] as any,
    }), {});
    registerBaseAbility('base_b', 'onTurnStart', (ctx) => ({
      events: [{
        type: SU_EVENTS.LIMIT_MODIFIED,
        payload: { playerId: ctx.playerId, limitType: 'minion', delta: 1, reason: 'base_b' },
        timestamp: ctx.now,
      }] as any,
    }), {});

    const core = core2b();

    const qA = collectBaseAbilityTriggers({ core, timing: 'onTurnStart', ownerPlayerId: '0', baseIndex: 0, now: 1 })!;
    const qB = collectBaseAbilityTriggers({ core, timing: 'onTurnStart', ownerPlayerId: '0', baseIndex: 1, now: 1 })!;
    const triggers: TriggerInstance[] = [
      ...(qA as any).payload.triggers,
      ...(qB as any).payload.triggers,
    ];

    const ms0 = makeMatchState({ ...core, triggerQueue: triggers });

    // Act: multiple mandatory triggers -> choose-next interaction
    const rq = maybeResolveReactionQueue(ms0, { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any, 1);
    expect(rq).toBeDefined();
    const ms1 = rq!.state;
    const current = ms1.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('smashup_reaction_choose');

    // Pick base_b first
    const optB = current.data.options.find((o: any) => (o.label as string).includes('base_b'));
    expect(optB).toBeDefined();
    const handler = getInteractionHandler('smashup_reaction_choose')!;
    const r2 = handler(ms1 as any, '0', optB.value, current.data, { shuffle: (a: any[]) => a } as any, 2);
    expect(r2).toBeDefined();
    const evts = r2!.events as SmashUpEvent[];
    expect(evts[0].type).toBe(SU_EVENTS.TRIGGER_CONSUMED);
    expect(evts.some(e => e.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(true);
  });

  it('onActionPlayed base ability is queued and resolved via smashup reaction session', () => {
    registerBaseAbility('base_a', 'onActionPlayed', (ctx) => ({
      events: [{
        type: SU_EVENTS.ABILITY_FEEDBACK,
        payload: { playerId: ctx.playerId, messageKey: 'base-action', tone: 'info' },
        timestamp: ctx.now,
      }] as any,
    }), {});

    const core = core2b();
    const matchState = makeMatchState(core);
    const result = postProcessSystemEvents(core, [{
      type: SU_EVENTS.ACTION_PLAYED,
      payload: {
        playerId: '0',
        cardUid: 'action-1',
        defId: 'test_action',
        targetBaseIndex: 0,
        targetType: 'base',
      },
      timestamp: 1,
    } as any], { shuffle: (a: any[]) => a } as any, matchState);

    expect(result.events.some(event => event.type === SU_EVENTS.TRIGGER_QUEUED)).toBe(true);
    expect(result.events.some(event => event.type === SU_EVENTS.TRIGGER_CONSUMED)).toBe(true);
    expect(result.events.some(event => event.type === SU_EVENTS.ABILITY_FEEDBACK)).toBe(true);
    expect(result.matchState?.sys.interaction?.current).toBeUndefined();
  });

  it('ACTION_PLAYED with multiple mandatory reactions opens one unified ordering interaction', () => {
    registerBaseAbility('base_a', 'onActionPlayed', (ctx) => ({
      events: [{
        type: SU_EVENTS.LIMIT_MODIFIED,
        payload: { playerId: ctx.playerId, limitType: 'action', delta: 1, reason: 'base-action' },
        timestamp: ctx.now,
      }] as any,
    }), {});
    registerTrigger('test_action_watcher', 'onActionPlayed', (ctx) => ([{
      type: SU_EVENTS.LIMIT_MODIFIED,
      payload: { playerId: ctx.playerId, limitType: 'action', delta: 1, reason: 'minion-action' },
      timestamp: ctx.now,
    }] as any), {});

    const core = core2b({
      bases: [
        makeBase('base_a', [makeMinion('watcher-1', 'test_action_watcher', '0', 3)]),
        makeBase('base_b'),
      ],
    });
    const matchState = makeMatchState(core);
    const result = postProcessSystemEvents(core, [{
      type: SU_EVENTS.ACTION_PLAYED,
      payload: {
        playerId: '0',
        cardUid: 'action-1',
        defId: 'test_action',
        targetBaseIndex: 0,
        targetType: 'base',
      },
      timestamp: 1,
    } as any], { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any, matchState);

    const current = result.matchState?.sys.interaction?.current as any;
    expect(current).toBeDefined();
    expect(current.data.sourceId).toBe('smashup_reaction_choose');
    expect(current.data.options.some((option: any) => String(option.label).includes('base_a'))).toBe(true);
    expect(current.data.options.some((option: any) => String(option.label).includes('test_action_watcher'))).toBe(true);
  });

  it('ACTION_PLAYED 命中 mandatory ongoing 与 mandatory extended base onActionPlayed 时，应统一进入 reaction ordering', () => {
    registerTrigger('test_action_watcher', 'onActionPlayed', (ctx) => ([{
      type: SU_EVENTS.LIMIT_MODIFIED,
      payload: { playerId: ctx.playerId, limitType: 'action', delta: 1, reason: 'action-watcher' },
      timestamp: ctx.now,
    }] as any), {});
    registerExtended('base_b', 'onActionPlayed', (ctx) => {
      if (!ctx.matchState) return { events: [] };
      const interaction = createSimpleChoice(
        `base_b_action_${ctx.now}`,
        ctx.playerId,
        '扩展基地：行动触发',
        [{ id: 'ok', label: '确定', value: { ok: true }, displayMode: 'button' as const }],
        { sourceId: 'base_b_action', targetType: 'button' },
      );
      return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }, { mandatory: true });

    const core = core2b({
      bases: [
        makeBase('base_a'),
        makeBase('base_b', [makeMinion('watcher-1', 'test_action_watcher', '0', 3)]),
      ],
    });
    const matchState = makeMatchState(core);

    const result = postProcessSystemEvents(core, [{
      type: SU_EVENTS.ACTION_PLAYED,
      payload: {
        playerId: '0',
        cardUid: 'action-1',
        defId: 'test_action',
        targetBaseIndex: 1,
        targetType: 'base',
      },
      timestamp: 1,
    } as any], { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any, matchState);

    const triggers: TriggerInstance[] = result.events
      .filter((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED)
      .flatMap((event: any) => event.payload.triggers);
    expect(triggers.some(trigger => trigger.sourceDefId === 'test_action_watcher')).toBe(true);
    expect(triggers.some(trigger => trigger.sourceDefId === 'base_b')).toBe(true);
    const current = result.matchState?.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('smashup_reaction_choose');
    expect(current?.data?.options?.some((option: any) => String(option.label).includes('test_action_watcher'))).toBe(true);
    expect(current?.data?.options?.some((option: any) => String(option.label).includes('base_b'))).toBe(true);
  });

  it('ACTION_PLAYED queued reactions stamp a stable sourceEventId and frameId', () => {
    registerBaseAbility('base_a', 'onActionPlayed', () => ({
      events: [{
        type: SU_EVENTS.ABILITY_FEEDBACK,
        payload: { playerId: '0', messageKey: 'base-action', tone: 'info' },
        timestamp: 1,
      }] as any,
    }), {});

    const core = core2b();
    const matchState = makeMatchState(core);
    const result = postProcessSystemEvents(core, [{
      type: SU_EVENTS.ACTION_PLAYED,
      payload: {
        playerId: '0',
        cardUid: 'action-1',
        defId: 'test_action',
        targetBaseIndex: 0,
        targetType: 'base',
      },
      timestamp: 1,
    } as any], { shuffle: (a: any[]) => a } as any, matchState);

    const queued = result.events.find((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
    expect(queued).toBeDefined();
    const trigger = queued.payload.triggers[0];
    expect(trigger.sourceEventId).toBe('action-played:action-1:1');
    expect(trigger.frameId).toBe('action-played-frame:action-1:1');
  });

  it('queued base ability 无手写读写声明时可注册，由 runtime artifacts 推导 footprint', () => {
    expect(() => registerBaseAbility('base_a', 'onTurnStart', () => ({ events: [] })))
      .not.toThrow();
  });

  it('queued extended base ability 无手写读写声明时可收集，由 runtime artifacts 推导 footprint', () => {
    registerExtended('base_a', 'onMinionDestroyed', () => ({ events: [] }), { mandatory: true });

    const core = core2b({
      bases: [makeBase('base_a'), makeBase('base_b')],
    });

    expect(collectExtendedBaseAbilityTriggers({
      core,
      timing: 'onMinionDestroyed',
      ownerPlayerId: '0',
      baseIndex: 0,
      now: 1,
    })).toBeDefined();
  });

  it('无手写 footprint 的 queued extended base ability 进入 queue 后仍可靠 runtime artifacts 执行', () => {
    registerExtended('base_a', 'onBaseRevealed', (ctx) => ({
      events: [{
        type: SU_EVENTS.CARDS_DRAWN,
        payload: { playerId: ctx.playerId, count: 1, cardUids: ['drawn-ext-1'] },
        timestamp: ctx.now,
      }] as any,
    }), { mandatory: true });

    const core = core2b({
      bases: [makeBase('base_a'), makeBase('base_b')],
    });

    const queued = collectExtendedBaseAbilityTriggers({
      core,
      timing: 'onBaseRevealed',
      ownerPlayerId: '0',
      baseIndex: 0,
      now: 1,
    });
    expect(queued).toBeDefined();

    const state = makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers });
    const resolved = maybeResolveReactionQueue(state, { shuffle: (a: any[]) => a } as any, 1);
    expect(resolved?.events).toContainEqual(expect.objectContaining({
      type: SU_EVENTS.CARDS_DRAWN,
      payload: expect.objectContaining({
        playerId: '0',
        cardUids: ['drawn-ext-1'],
      }),
    }));
  });

  it('queued extended onMinionDestroyed base ability 应继续拿到 destroyerId/controllerId/reason', () => {
    registerExtended('base_a', 'onMinionDestroyed', (ctx) => ({
      events: [
        {
          type: SU_EVENTS.VP_AWARDED,
          payload: {
            playerId: ctx.destroyerId ?? 'missing-destroyer',
            amount: 1,
            reason: ctx.reason ?? 'missing-reason',
          },
          timestamp: ctx.now,
        } as any,
        {
          type: SU_EVENTS.ABILITY_FEEDBACK,
          payload: {
            playerId: ctx.playerId,
            messageKey: `controller:${ctx.controllerId ?? 'missing-controller'}`,
            tone: 'info',
          },
          timestamp: ctx.now,
        } as any,
      ],
    }), { mandatory: true });

    const core = core2b({
      bases: [makeBase('base_a'), makeBase('base_b')],
    });

    const queued = collectExtendedBaseAbilityTriggers({
      core,
      timing: 'onMinionDestroyed',
      ownerPlayerId: '0',
      baseIndex: 0,
      triggerMinionUid: 'victim-1',
      triggerMinionDefId: 'test_minion',
      destroyerId: '1',
      controllerId: '0',
      reason: 'test_destroy_reason',
      now: 1,
    });
    expect(queued).toBeDefined();

    const state = makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers });
    const resolved = maybeResolveReactionQueue(state, { shuffle: (a: any[]) => a } as any, 1);

    expect(resolved?.events).toContainEqual(expect.objectContaining({
      type: SU_EVENTS.VP_AWARDED,
      payload: expect.objectContaining({
        playerId: '1',
        reason: 'test_destroy_reason',
      }),
    }));
    expect(resolved?.events).toContainEqual(expect.objectContaining({
      type: SU_EVENTS.ABILITY_FEEDBACK,
      payload: expect.objectContaining({
        messageKey: 'controller:0',
      }),
    }));
  });

  it('queued extended onMinionDestroyed base ability 的 ownerPlayerId/canTrigger/deriveFootprint 也应看到 destroyerId/controllerId/reason', () => {
    registerExtended('base_a', 'onMinionDestroyed', () => ({ events: [] }), {
      mandatory: false,
      ownerPlayerId: (ctx) => ctx.destroyerId,
      canTrigger: (ctx) => (
        ctx.destroyerId === '1'
        && ctx.controllerId === '0'
        && ctx.reason === 'allow_extended_destroy'
        && ctx.minionUid === 'victim-1'
        && ctx.minionDefId === 'test_minion'
      ),
      deriveFootprint: (ctx) => (
        ctx.destroyerId === '1'
          ? {
              reads: [{ kind: 'playerHand', playerId: ctx.destroyerId }],
              writes: [],
            }
          : undefined
      ),
    });

    const core = core2b({
      bases: [makeBase('base_a'), makeBase('base_b')],
    });

    const queued = collectExtendedBaseAbilityTriggers({
      core,
      timing: 'onMinionDestroyed',
      ownerPlayerId: '0',
      baseIndex: 0,
      triggerMinionUid: 'victim-1',
      triggerMinionDefId: 'test_minion',
      destroyerId: '1',
      controllerId: '0',
      reason: 'allow_extended_destroy',
      now: 1,
    });

    expect(queued).toBeDefined();
    const trigger = (queued as any).payload.triggers[0];
    expect(trigger.ownerPlayerId).toBe('1');
    expect(trigger.derivedFootprint).toEqual({
      reads: [{ kind: 'playerHand', playerId: '1' }],
      writes: [],
    });
  });

  it('两个无手写 footprint 的 queued extended base abilities 若运行时产物写同一资源，仍应进入排序交互', () => {
    registerExtended('base_a', 'onBaseRevealed', (ctx) => ({
      events: [{
        type: SU_EVENTS.MINION_METADATA_UPDATED,
        payload: {
          minionUid: 'shared-target',
          baseIndex: 0,
          metadataUpdate: { touchedBy: 'ext-a' },
          reason: 'extended_conflict_a',
        },
        timestamp: ctx.now,
      }] as any,
    }), { mandatory: true });
    registerExtended('base_b', 'onBaseRevealed', (ctx) => ({
      events: [{
        type: SU_EVENTS.MINION_METADATA_UPDATED,
        payload: {
          minionUid: 'shared-target',
          baseIndex: 0,
          metadataUpdate: { touchedBy: 'ext-b' },
          reason: 'extended_conflict_b',
        },
        timestamp: ctx.now,
      }] as any,
    }), { mandatory: true });

    const core = core2b({
      bases: [
        makeBase('base_a', [makeMinion('shared-target', 'sharks_mako', '0', 2)]),
        makeBase('base_b'),
      ],
    });

    const qA = collectExtendedBaseAbilityTriggers({
      core,
      timing: 'onBaseRevealed',
      ownerPlayerId: '0',
      baseIndex: 0,
      now: 1,
    });
    const qB = collectExtendedBaseAbilityTriggers({
      core,
      timing: 'onBaseRevealed',
      ownerPlayerId: '0',
      baseIndex: 1,
      now: 1,
    });
    expect(qA).toBeDefined();
    expect(qB).toBeDefined();

    const state = makeMatchState({
      ...core,
      triggerQueue: [
        ...(qA as any).payload.triggers,
        ...(qB as any).payload.triggers,
      ],
    });

    const queuedResolved = maybeResolveReactionQueue(
      state,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      1,
    );
    expect(queuedResolved).toBeDefined();
    const current = queuedResolved!.state.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('smashup_reaction_choose');
    const optionLabels = current.data.options.map((option: any) => option.label as string);
    expect(optionLabels.some((label: string) => label.includes('base_a'))).toBe(true);
    expect(optionLabels.some((label: string) => label.includes('base_b'))).toBe(true);
  });

  it('queued base ability 的显式 effectContract 即使 runtime artifacts 为空，仍应参与排序', () => {
    const effectContract = {
      reads: [],
      writes: [{ kind: 'minionMetadata', minionUid: 'shared-target' }],
    } as const;
    registerBaseAbility('base_a', 'onTurnStart', () => ({ events: [] }), {
      effectContract,
    });
    registerBaseAbility('base_b', 'onTurnStart', () => ({ events: [] }), {
      effectContract,
    });

    const core = core2b({
      bases: [
        makeBase('base_a', [makeMinion('shared-target', 'sharks_mako', '0', 2)]),
        makeBase('base_b'),
      ],
    });

    const qA = collectBaseAbilityTriggers({ core, timing: 'onTurnStart', ownerPlayerId: '0', baseIndex: 0, now: 1 })!;
    const qB = collectBaseAbilityTriggers({ core, timing: 'onTurnStart', ownerPlayerId: '0', baseIndex: 1, now: 1 })!;
    const state = makeMatchState({
      ...core,
      triggerQueue: [
        ...(qA as any).payload.triggers,
        ...(qB as any).payload.triggers,
      ],
    });

    const queuedResolved = maybeResolveReactionQueue(
      state,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      1,
    );
    const current = queuedResolved?.state.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('smashup_reaction_choose');
  });

  it('queued base ability 的显式 effectContract 仍应保留 source base 读取，避免同帧替换基地时跳过排序', () => {
    registerBaseAbility('base_reader', 'onTurnStart', () => ({ events: [] }), {
      effectContract: {
        reads: [],
        writes: [{ kind: 'playerHand', playerId: '0' }],
      },
    });
    registerTrigger('base_replacer', 'onTurnStart', () => ([{
      type: SU_EVENTS.BASE_REPLACED,
      payload: {
        baseIndex: 0,
        oldBaseDefId: 'base_reader',
        newBaseDefId: 'base_replacement',
        keepCards: true,
      },
      timestamp: 1,
    }] as any));

    const core = core2b({
      bases: [
        makeBase('base_reader', [makeMinion('replacer-1', 'base_replacer', '0', 2)]),
        makeBase('base_b'),
      ],
      baseDeck: ['base_replacement'],
    });

    const qBase = collectBaseAbilityTriggers({
      core,
      timing: 'onTurnStart',
      ownerPlayerId: '0',
      baseIndex: 0,
      frameId: 'turn-start-frame:base-source-read',
      sourceEventId: 'turn-start:base-source-read',
      now: 1,
    })!;
    expect((qBase as any).payload.triggers[0].derivedFootprint?.reads).toContainEqual({ kind: 'base', index: 0 });
    const qReplacer = collectTriggers(core, 'onTurnStart', {
      state: core,
      matchState: makeMatchState(core),
      playerId: '0',
      frameId: 'turn-start-frame:base-source-read',
      sourceEventId: 'turn-start:base-source-read',
      random: { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      now: 1,
    })!;
    const state = makeMatchState({
      ...core,
      triggerQueue: [
        ...(qBase as any).payload.triggers,
        ...(qReplacer as any).payload.triggers,
      ],
    });

    const queuedResolved = maybeResolveReactionQueue(
      state,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      1,
    );
    const current = queuedResolved?.state.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('smashup_reaction_choose');
  });

  it('queued base ability 的 deriveFootprint 即使 runtime artifacts 为空，仍应参与排序', () => {
    registerBaseAbility('base_a', 'onTurnStart', (ctx) => ({
      events: [{
        type: SU_EVENTS.ABILITY_FEEDBACK,
        payload: { playerId: ctx.playerId, messageKey: 'base_a_reader', tone: 'info' },
        timestamp: ctx.now,
      }] as any,
    }), {
      deriveFootprint: () => ({
        reads: [{ kind: 'playerHand', playerId: '0' }],
        writes: [],
      }),
    });
    registerBaseAbility('base_b', 'onTurnStart', (ctx) => ({
      events: [{
        type: SU_EVENTS.CARDS_DRAWN,
        payload: { playerId: ctx.playerId, count: 1, cardUids: ['drawn-1'] },
        timestamp: ctx.now,
      }] as any,
    }), {});

    const core = core2b({
      bases: [
        makeBase('base_a'),
        makeBase('base_b'),
      ],
    });

    const qA = collectBaseAbilityTriggers({ core, timing: 'onTurnStart', ownerPlayerId: '0', baseIndex: 0, now: 1 })!;
    const qB = collectBaseAbilityTriggers({ core, timing: 'onTurnStart', ownerPlayerId: '0', baseIndex: 1, now: 1 })!;
    const state = makeMatchState({
      ...core,
      triggerQueue: [
        ...(qA as any).payload.triggers,
        ...(qB as any).payload.triggers,
      ],
    });

    const queuedResolved = maybeResolveReactionQueue(
      state,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      1,
    );
    const current = queuedResolved?.state.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('smashup_reaction_choose');
  });

  it('queued extended base ability 的显式 effectContract 即使 runtime artifacts 为空，仍应参与排序', () => {
    const effectContract = {
      reads: [],
      writes: [{ kind: 'minionMetadata', minionUid: 'shared-target' }],
    } as const;
    registerExtended('base_a', 'onBaseRevealed', () => ({ events: [] }), {
      effectContract,
    });
    registerExtended('base_b', 'onBaseRevealed', () => ({ events: [] }), {
      effectContract,
    });

    const core = core2b({
      bases: [
        makeBase('base_a', [makeMinion('shared-target', 'sharks_mako', '0', 2)]),
        makeBase('base_b'),
      ],
    });

    const qA = collectExtendedBaseAbilityTriggers({
      core,
      timing: 'onBaseRevealed',
      ownerPlayerId: '0',
      baseIndex: 0,
      now: 1,
    })!;
    const qB = collectExtendedBaseAbilityTriggers({
      core,
      timing: 'onBaseRevealed',
      ownerPlayerId: '0',
      baseIndex: 1,
      now: 1,
    })!;
    const state = makeMatchState({
      ...core,
      triggerQueue: [
        ...(qA as any).payload.triggers,
        ...(qB as any).payload.triggers,
      ],
    });

    const queuedResolved = maybeResolveReactionQueue(
      state,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      1,
    );
    const current = queuedResolved?.state.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('smashup_reaction_choose');
  });

  it('queued extended base ability 的显式 effectContract 仍应保留 source base 读取，避免同帧替换基地时跳过排序', () => {
    registerExtended('base_reader', 'onBaseRevealed', () => ({ events: [] }), {
      effectContract: {
        reads: [],
        writes: [{ kind: 'playerHand', playerId: '0' }],
      },
    });
    registerTrigger('base_replacer', 'onBaseRevealed', () => ([{
      type: SU_EVENTS.BASE_REPLACED,
      payload: {
        baseIndex: 0,
        oldBaseDefId: 'base_reader',
        newBaseDefId: 'base_replacement',
        keepCards: true,
      },
      timestamp: 1,
    }] as any));

    const core = core2b({
      bases: [
        makeBase('base_reader', [makeMinion('replacer-1', 'base_replacer', '0', 2)]),
        makeBase('base_b'),
      ],
      baseDeck: ['base_replacement'],
    });

    const qBase = collectExtendedBaseAbilityTriggers({
      core,
      timing: 'onBaseRevealed',
      ownerPlayerId: '0',
      baseIndex: 0,
      frameId: 'base-revealed-frame:base-source-read',
      sourceEventId: 'base-revealed:base-source-read',
      now: 1,
    })!;
    expect((qBase as any).payload.triggers[0].derivedFootprint?.reads).toContainEqual({ kind: 'base', index: 0 });
    const qReplacer = collectTriggers(core, 'onBaseRevealed', {
      state: core,
      matchState: makeMatchState(core),
      playerId: '0',
      baseIndex: 0,
      frameId: 'base-revealed-frame:base-source-read',
      sourceEventId: 'base-revealed:base-source-read',
      random: { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      now: 1,
    })!;
    const state = makeMatchState({
      ...core,
      triggerQueue: [
        ...(qBase as any).payload.triggers,
        ...(qReplacer as any).payload.triggers,
      ],
    });

    const queuedResolved = maybeResolveReactionQueue(
      state,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      1,
    );
    const current = queuedResolved?.state.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('smashup_reaction_choose');
  });

  it('queued extended base ability 的 deriveFootprint 即使 runtime artifacts 为空，仍应参与排序', () => {
    registerExtended('base_a', 'onBaseRevealed', (ctx) => ({
      events: [{
        type: SU_EVENTS.ABILITY_FEEDBACK,
        payload: { playerId: ctx.playerId, messageKey: 'extended_reader', tone: 'info' },
        timestamp: ctx.now,
      }] as any,
    }), {
      deriveFootprint: () => ({
        reads: [{ kind: 'playerHand', playerId: '0' }],
        writes: [],
      }),
    });
    registerExtended('base_b', 'onBaseRevealed', (ctx) => ({
      events: [{
        type: SU_EVENTS.CARDS_DRAWN,
        payload: { playerId: ctx.playerId, count: 1, cardUids: ['drawn-ext-1'] },
        timestamp: ctx.now,
      }] as any,
    }), {});

    const core = core2b({
      bases: [makeBase('base_a'), makeBase('base_b')],
    });

    const qA = collectExtendedBaseAbilityTriggers({
      core,
      timing: 'onBaseRevealed',
      ownerPlayerId: '0',
      baseIndex: 0,
      now: 1,
    })!;
    const qB = collectExtendedBaseAbilityTriggers({
      core,
      timing: 'onBaseRevealed',
      ownerPlayerId: '0',
      baseIndex: 1,
      now: 1,
    })!;
    const state = makeMatchState({
      ...core,
      triggerQueue: [
        ...(qA as any).payload.triggers,
        ...(qB as any).payload.triggers,
      ],
    });

    const queuedResolved = maybeResolveReactionQueue(
      state,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      1,
    );
    const current = queuedResolved?.state.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('smashup_reaction_choose');
  });

  it('processMoveTriggers 命中 mandatory ongoing 与 mandatory extended base onMinionMoved 时，应统一进入 reaction ordering', () => {
    registerTrigger('test_move_watcher', 'onMinionMoved', (ctx) => ([{
      type: SU_EVENTS.LIMIT_MODIFIED,
      payload: { playerId: ctx.playerId, limitType: 'action', delta: 1, reason: 'move-watcher' },
      timestamp: ctx.now,
    }] as any), {});
    registerExtended('base_b', 'onMinionMoved', (ctx) => {
      if (!ctx.matchState) return { events: [] };
      const interaction = createSimpleChoice(
        `base_b_move_${ctx.now}`,
        ctx.playerId,
        '扩展基地：移动触发',
        [{ id: 'ok', label: '确定', value: { ok: true }, displayMode: 'button' as const }],
        { sourceId: 'base_b_move', targetType: 'button' },
      );
      return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }, { mandatory: true });

    const core = core2b({
      bases: [
        makeBase('base_a'),
        makeBase('base_b', [makeMinion('watcher-1', 'test_move_watcher', '0', 3)]),
      ],
    });

    const result = processMoveTriggers([{
      type: SU_EVENTS.MINION_MOVED,
      payload: {
        minionUid: 'moved-1',
        minionDefId: 'robot_microbot_alpha',
        fromBaseIndex: 0,
        toBaseIndex: 1,
        reason: 'test-move',
      },
      timestamp: 1,
    } as any], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 1);

    const triggers: TriggerInstance[] = result.events
      .filter((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED)
      .flatMap((event: any) => event.payload.triggers);
    expect(triggers.some(trigger => trigger.sourceDefId === 'test_move_watcher')).toBe(true);
    expect(triggers.some(trigger => trigger.sourceDefId === 'base_b')).toBe(true);
    expect(result.matchState?.sys.interaction.current).toBeUndefined();

    const resolved = maybeResolveReactionQueue(
      makeMatchState({ ...core, triggerQueue: triggers }),
      { shuffle: (a: any[]) => a } as any,
      1,
    );
    const current = resolved?.state.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('smashup_reaction_choose');
    expect(current?.data?.options?.some((option: any) => String(option.label).includes('test_move_watcher'))).toBe(true);
    expect(current?.data?.options?.some((option: any) => String(option.label).includes('base_b'))).toBe(true);
  });

  it('processMoveTriggers 首次移动到 The Pasture 时应按移动前计数打开扩展基地交互', () => {
    registerBaseAbilities();

    const core = core2b({
      bases: [
        makeBase('base_a', [
          makeMinion('moved-1', 'robot_microbot_alpha', '0', 2),
          makeMinion('other-1', 'robot_microbot_alpha', '1', 2),
        ]),
        makeBase('base_the_pasture'),
      ],
      minionsMovedToBaseThisTurn: undefined,
    });

    const result = processMoveTriggers([{
      type: SU_EVENTS.MINION_MOVED,
      payload: {
        minionUid: 'moved-1',
        minionDefId: 'robot_microbot_alpha',
        fromBaseIndex: 0,
        toBaseIndex: 1,
        reason: 'test-first-move-to-pasture',
      },
      timestamp: 10,
    } as any], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 10);

    const triggers: TriggerInstance[] = result.events
      .filter((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED)
      .flatMap((event: any) => event.payload.triggers);
    expect(triggers.some(trigger => trigger.sourceDefId === 'base_the_pasture')).toBe(true);

    const resolved = maybeResolveReactionQueue(
      makeMatchState({
        ...(result.matchState?.core ?? core),
        triggerQueue: triggers,
      }),
      { shuffle: (a: any[]) => a } as any,
      10,
    );

    const current = resolved?.state.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('base_the_pasture');
    expect(current?.data?.options?.some((option: any) => option.value?.minionUid === 'other-1')).toBe(true);
  });

  it('processDestroyTriggers 命中 mandatory ongoing 与 mandatory extended base onMinionDestroyed 时，应统一进入 reaction ordering', () => {
    registerTrigger('test_destroy_watcher', 'onMinionDestroyed', (ctx) => ([{
      type: SU_EVENTS.LIMIT_MODIFIED,
      payload: { playerId: ctx.playerId, limitType: 'action', delta: 1, reason: 'destroy-watcher' },
      timestamp: ctx.now,
    }] as any), {});
    registerExtended('base_b', 'onMinionDestroyed', (ctx) => {
      if (!ctx.matchState) return { events: [] };
      const interaction = createSimpleChoice(
        `base_b_destroy_${ctx.now}`,
        ctx.playerId,
        '扩展基地：消灭触发',
        [{ id: 'ok', label: '确定', value: { ok: true }, displayMode: 'button' as const }],
        { sourceId: 'base_b_destroy', targetType: 'button' },
      );
      return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }, { mandatory: true });

    const core = core2b({
      bases: [
        makeBase('base_a'),
        makeBase('base_b', [
          makeMinion('victim-1', 'robot_microbot_alpha', '0', 2),
          makeMinion('watcher-1', 'test_destroy_watcher', '0', 3),
        ]),
      ],
    });

    const result = processDestroyTriggers([{
      type: SU_EVENTS.MINION_DESTROYED,
      payload: {
        minionUid: 'victim-1',
        minionDefId: 'robot_microbot_alpha',
        fromBaseIndex: 1,
        ownerId: '0',
        destroyerId: '1',
        reason: 'test-destroy',
      },
      timestamp: 1,
    } as any], makeMatchState(core), '1', { shuffle: (a: any[]) => a } as any, 1);

    const triggers: TriggerInstance[] = result.events
      .filter((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED)
      .flatMap((event: any) => event.payload.triggers);
    expect(triggers.some(trigger => trigger.sourceDefId === 'test_destroy_watcher')).toBe(true);
    expect(triggers.some(trigger => trigger.sourceDefId === 'base_b')).toBe(true);
    const current = result.matchState?.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('smashup_reaction_choose');
    expect(current?.data?.options?.some((option: any) => String(option.label).includes('test_destroy_watcher'))).toBe(true);
    expect(current?.data?.options?.some((option: any) => String(option.label).includes('base_b'))).toBe(true);
  });

  it('processAffectTriggers 命中 mandatory ongoing 与 mandatory extended base onMinionAffected 时，应统一进入 reaction ordering', () => {
    registerTrigger('test_affect_watcher', 'onMinionAffected', (ctx) => ([{
      type: SU_EVENTS.LIMIT_MODIFIED,
      payload: { playerId: ctx.playerId, limitType: 'action', delta: 1, reason: 'affect-watcher' },
      timestamp: ctx.now,
    }] as any), {});
    registerExtended('base_b', 'onMinionAffected', (ctx) => {
      if (!ctx.matchState) return { events: [] };
      const interaction = createSimpleChoice(
        `base_b_affect_${ctx.now}`,
        ctx.playerId,
        '扩展基地：影响触发',
        [{ id: 'ok', label: '确定', value: { ok: true }, displayMode: 'button' as const }],
        { sourceId: 'base_b_affect', targetType: 'button' },
      );
      return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }, { mandatory: true });

    const core = core2b({
      bases: [
        makeBase('base_a'),
        makeBase('base_b', [
          makeMinion('target-1', 'robot_microbot_alpha', '0', 2),
          makeMinion('watcher-1', 'test_affect_watcher', '0', 3),
        ]),
      ],
    });

    const result = processAffectTriggers([{
      type: SU_EVENTS.POWER_COUNTER_ADDED,
      payload: {
        minionUid: 'target-1',
        baseIndex: 1,
        amount: 1,
        reason: 'test-affect',
        sourceDefId: 'source_action_card',
        sourceCardUid: 'source-action-1',
        sourcePlayerId: '0',
      },
      timestamp: 1,
    } as any], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 1);

    const triggers: TriggerInstance[] = result.events
      .filter((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED)
      .flatMap((event: any) => event.payload.triggers);
    expect(triggers.some(trigger => trigger.sourceDefId === 'test_affect_watcher')).toBe(true);
    expect(triggers.some(trigger => trigger.sourceDefId === 'base_b')).toBe(true);
    expect(result.matchState?.sys.interaction.current).toBeUndefined();

    const resolved = maybeResolveReactionQueue(
      makeMatchState({ ...core, triggerQueue: triggers }),
      { shuffle: (a: any[]) => a } as any,
      1,
    );
    const current = resolved?.state.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('smashup_reaction_choose');
    expect(current?.data?.options?.some((option: any) => String(option.label).includes('test_affect_watcher'))).toBe(true);
    expect(current?.data?.options?.some((option: any) => String(option.label).includes('base_b'))).toBe(true);
  });

  it('processReturnToHandTriggers 命中 mandatory ongoing 与 mandatory extended base onCardReturnedToHand 时，应统一进入 reaction ordering', () => {
    registerTrigger('test_return_watcher', 'onCardReturnedToHand', (ctx) => ([{
      type: SU_EVENTS.LIMIT_MODIFIED,
      payload: { playerId: ctx.playerId, limitType: 'action', delta: 1, reason: 'return-watcher' },
      timestamp: ctx.now,
    }] as any), {});
    registerExtended('base_b', 'onCardReturnedToHand', (ctx) => {
      if (!ctx.matchState) return { events: [] };
      const interaction = createSimpleChoice(
        `base_b_return_${ctx.now}`,
        ctx.playerId,
        '扩展基地：回手触发',
        [{ id: 'ok', label: '确定', value: { ok: true }, displayMode: 'button' as const }],
        { sourceId: 'base_b_return', targetType: 'button' },
      );
      return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }, { mandatory: true });

    const core = core2b({
      bases: [
        makeBase('base_a'),
        makeBase('base_b', [
          makeMinion('watcher-1', 'test_return_watcher', '0', 3),
          makeMinion('return-minion', 'robot_microbot_alpha', '0', 2),
        ]),
      ],
    });

    const result = processReturnToHandTriggers([{
      type: SU_EVENTS.MINION_RETURNED,
      payload: {
        minionUid: 'return-minion',
        minionDefId: 'robot_microbot_alpha',
        fromBaseIndex: 1,
        toPlayerId: '0',
        reason: 'test-return',
      },
      timestamp: 1,
    } as any], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 1);

    const triggers: TriggerInstance[] = result.events
      .filter((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED)
      .flatMap((event: any) => event.payload.triggers);
    expect(triggers.some(trigger => trigger.sourceDefId === 'test_return_watcher')).toBe(true);
    expect(triggers.some(trigger => trigger.sourceDefId === 'base_b')).toBe(true);
    expect(result.matchState?.sys.interaction.current).toBeUndefined();

    const resolved = maybeResolveReactionQueue(
      makeMatchState({ ...core, triggerQueue: triggers }),
      { shuffle: (a: any[]) => a } as any,
      1,
    );
    const current = resolved?.state.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('smashup_reaction_choose');
    expect(current?.data?.options?.some((option: any) => String(option.label).includes('test_return_watcher'))).toBe(true);
    expect(current?.data?.options?.some((option: any) => String(option.label).includes('base_b'))).toBe(true);
  });

  it('processDeckInspectionTriggers 命中 mandatory ongoing 与 mandatory extended base onDeckInspected 时，应统一进入 reaction ordering', () => {
    registerTrigger('test_inspection_watcher', 'onDeckInspected', (ctx) => ([{
      type: SU_EVENTS.LIMIT_MODIFIED,
      payload: { playerId: ctx.playerId, limitType: 'action', delta: 1, reason: 'inspection-watcher' },
      timestamp: ctx.now,
    }] as any), {});
    registerExtended('base_b', 'onDeckInspected', (ctx) => {
      if (!ctx.matchState) return { events: [] };
      const interaction = createSimpleChoice(
        `base_b_inspection_${ctx.now}`,
        ctx.playerId,
        '扩展基地：查牌触发',
        [{ id: 'ok', label: '确定', value: { ok: true }, displayMode: 'button' as const }],
        { sourceId: 'base_b_inspection', targetType: 'button' },
      );
      return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }, { mandatory: true });

    const core = core2b({
      bases: [
        makeBase('base_a'),
        makeBase('base_b', [
          makeMinion('watcher-1', 'test_inspection_watcher', '0', 3),
        ]),
      ],
    });

    const result = processDeckInspectionTriggers([{
      type: SU_EVENTS.REVEAL_DECK_TOP,
      payload: {
        sourcePlayerId: '0',
        targetPlayerId: '0',
        count: 1,
        cards: [{ uid: 'revealed-1', defId: 'robot_microbot_alpha', type: 'minion', owner: '0' }],
        reason: 'test-inspection',
      },
      timestamp: 1,
    } as any], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 1);

    const triggers: TriggerInstance[] = result.events
      .filter((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED)
      .flatMap((event: any) => event.payload.triggers);
    expect(triggers.some(trigger => trigger.sourceDefId === 'test_inspection_watcher')).toBe(true);
    expect(triggers.some(trigger => trigger.sourceDefId === 'base_b')).toBe(true);
    expect(result.matchState?.sys.interaction.current).toBeUndefined();

    const resolved = maybeResolveReactionQueue(
      makeMatchState({ ...core, triggerQueue: triggers }),
      { shuffle: (a: any[]) => a } as any,
      1,
    );
    const current = resolved?.state.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('smashup_reaction_choose');
    expect(current?.data?.options?.some((option: any) => String(option.label).includes('test_inspection_watcher'))).toBe(true);
    expect(current?.data?.options?.some((option: any) => String(option.label).includes('base_b'))).toBe(true);
  });

  it('optional base ability 的 canTrigger 应按最终 chooser 视角判断，而不是沿用旧 ownerPlayerId', () => {
    registerBaseAbility('base_a', 'afterScoring', () => ({ events: [] }), {
      mandatory: false,
      ownerPlayerId: () => '1',
      canTrigger: (ctx) => ctx.playerId === '1',
    });

    const core = core2b({
      bases: [makeBase('base_a'), makeBase('base_b')],
    });

    const queued = collectBaseAbilityTriggers({
      core,
      timing: 'afterScoring',
      ownerPlayerId: '0',
      baseIndex: 0,
      rankings: [{ playerId: '1', power: 5, vp: 2 }],
      now: 1,
    });

    expect(queued).toBeDefined();
    expect((queued as any).payload.triggers[0].ownerPlayerId).toBe('1');
  });

  it('普通 queued base ability 的 canTrigger/deriveFootprint 应看到 frameId/sourceEventId 等运行时上下文', () => {
    registerBaseAbility('base_a', 'onActionPlayed', () => ({ events: [] }), {
      canTrigger: (ctx) => (
        ctx.frameId === 'frame-action-1'
        && ctx.sourceEventId === 'event-action-1'
        && ctx.reason === 'action-played-test'
        && ctx.actionTargetBaseIndex === 0
        && ctx.actionTargetType === 'base'
      ),
      deriveFootprint: (ctx) => (
        ctx.sourceEventId === 'event-action-1'
          ? {
              reads: [{ kind: 'base', baseIndex: ctx.baseIndex }],
              writes: [],
            }
          : undefined
      ),
    });

    const core = core2b({
      bases: [makeBase('base_a'), makeBase('base_b')],
    });

    const queued = collectBaseAbilityTriggers({
      core,
      timing: 'onActionPlayed',
      ownerPlayerId: '0',
      baseIndex: 0,
      actionTargetBaseIndex: 0,
      actionTargetType: 'base',
      reason: 'action-played-test',
      frameId: 'frame-action-1',
      sourceEventId: 'event-action-1',
      now: 1,
    });

    expect(queued).toBeDefined();
    const trigger = (queued as any).payload.triggers[0];
    expect(trigger.frameId).toBe('frame-action-1');
    expect(trigger.sourceEventId).toBe('event-action-1');
    expect(trigger.derivedFootprint?.reads).toContainEqual({ kind: 'base', baseIndex: 0 });
  });

  it('extended queued base ability 的 canTrigger/deriveFootprint 应看到 frameId/sourceEventId 等运行时上下文', () => {
    registerExtended('base_a', 'onMinionDestroyed', () => ({ events: [] }), {
      canTrigger: (ctx) => (
        ctx.frameId === 'frame-destroy-1'
        && ctx.sourceEventId === 'event-destroy-1'
        && ctx.destroyerId === '1'
        && ctx.controllerId === '0'
        && ctx.reason === 'destroy-test'
      ),
      deriveFootprint: (ctx) => (
        ctx.frameId === 'frame-destroy-1'
          ? {
              reads: [{ kind: 'playerHand', playerId: ctx.destroyerId ?? ctx.playerId }],
              writes: [],
            }
          : undefined
      ),
    });

    const core = core2b({
      bases: [makeBase('base_a'), makeBase('base_b')],
    });

    const queued = collectExtendedBaseAbilityTriggers({
      core,
      timing: 'onMinionDestroyed',
      ownerPlayerId: '0',
      baseIndex: 0,
      triggerMinionUid: 'victim-1',
      triggerMinionDefId: 'test_minion',
      destroyerId: '1',
      controllerId: '0',
      reason: 'destroy-test',
      frameId: 'frame-destroy-1',
      sourceEventId: 'event-destroy-1',
      now: 1,
    });

    expect(queued).toBeDefined();
    const trigger = (queued as any).payload.triggers[0];
    expect(trigger.frameId).toBe('frame-destroy-1');
    expect(trigger.sourceEventId).toBe('event-destroy-1');
    expect(trigger.derivedFootprint?.reads).toContainEqual({ kind: 'playerHand', playerId: '1' });
  });

  it('extended queued onActionPlayed base ability 的 canTrigger/deriveFootprint 应看到 action target 上下文', () => {
    registerExtended('base_a', 'onActionPlayed', () => ({ events: [] }), {
      canTrigger: (ctx) => (
        ctx.frameId === 'frame-action-1'
        && ctx.sourceEventId === 'event-action-1'
        && ctx.reason === 'action-played-test'
        && ctx.actionTargetBaseIndex === 0
        && ctx.actionTargetType === 'minion'
        && ctx.actionTargetMinionUid === 'target-1'
      ),
      deriveFootprint: (ctx) => (
        ctx.actionTargetMinionUid === 'target-1'
          ? {
              reads: [{ kind: 'base', index: 0 }],
              writes: [],
            }
          : undefined
      ),
    });

    const core = core2b({
      bases: [makeBase('base_a', [makeMinion('target-1', 'robot_microbot_alpha', '0', 2)]), makeBase('base_b')],
    });

    const queued = collectExtendedBaseAbilityTriggers({
      core,
      timing: 'onActionPlayed',
      ownerPlayerId: '0',
      baseIndex: 0,
      actionTargetBaseIndex: 0,
      actionTargetType: 'minion',
      actionTargetMinionUid: 'target-1',
      reason: 'action-played-test',
      frameId: 'frame-action-1',
      sourceEventId: 'event-action-1',
      now: 1,
    } as any);

    expect(queued).toBeDefined();
    const trigger = (queued as any).payload.triggers[0];
    expect(trigger.actionTargetBaseIndex).toBe(0);
    expect(trigger.actionTargetType).toBe('minion');
    expect(trigger.actionTargetMinionUid).toBe('target-1');
    expect(trigger.derivedFootprint?.reads).toContainEqual({ kind: 'base', index: 0 });
  });

  it('互不冲突的 mandatory base abilities 若会进入真实交互，应直接进入真实交互而不是先弹排序', () => {
    registerBaseAbility('base_a', 'onTurnStart', (ctx) => {
      const interaction = createSimpleChoice(
        `base_a_prompt_${ctx.now}`,
        ctx.playerId,
        'base_a 真实交互',
        [
          { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
          { id: 'apply', label: '执行', value: { playerId: '1' }, displayMode: 'button' as const },
        ],
        { sourceId: 'base_a_prompt', targetType: 'button' },
      );
      return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
      };
    }, {});
    registerBaseAbility('base_b', 'onTurnStart', (ctx) => ({
      events: [{
        type: SU_EVENTS.CARDS_DRAWN,
        payload: { playerId: ctx.playerId, count: 1, cardUids: ['drawn-1'] },
        timestamp: ctx.now,
      }] as any,
    }), {});

    const core = core2b();
    const qA = collectBaseAbilityTriggers({ core, timing: 'onTurnStart', ownerPlayerId: '0', baseIndex: 0, now: 1 })!;
    const qB = collectBaseAbilityTriggers({ core, timing: 'onTurnStart', ownerPlayerId: '0', baseIndex: 1, now: 1 })!;
    const triggers: TriggerInstance[] = [
      ...(qA as any).payload.triggers,
      ...(qB as any).payload.triggers,
    ];

    const ms0 = makeMatchState({ ...core, triggerQueue: triggers });
    const rq = maybeResolveReactionQueue(ms0, { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any, 1);
    expect(rq).toBeDefined();
    expect((rq!.state.sys.interaction.current as any)?.data?.sourceId).toBe('base_a_prompt');
    expect((rq!.state.sys.interaction.current as any)?.data?.sourceId).not.toBe('smashup_reaction_choose');
  });

  it('baseDefId-only queued interaction 不应因 footprint fallback 被错误抬成 reaction ordering', () => {
    registerBaseAbility('base_a', 'afterScoring', (ctx) => {
      const interaction = createSimpleChoice(
        `base_the_nexus_choose_${ctx.now}`,
        ctx.playerId,
        '联结点：选择一个基地放到基地牌库顶',
        [
          { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
          { id: 'base_c', label: '基地 C', value: { baseDefId: 'base_c' }, displayMode: 'button' as const },
        ],
        { sourceId: 'base_the_nexus_choose', targetType: 'button' },
      );
      interaction.data.allowedBaseDefIds = ['base_c'];
      return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
      };
    }, {});
    registerBaseAbility('base_b', 'afterScoring', (ctx) => ({
      events: [{
        type: SU_EVENTS.CARDS_DRAWN,
        payload: { playerId: ctx.playerId, count: 1, cardUids: ['drawn-after-score-1'] },
        timestamp: ctx.now,
      }] as any,
    }), {});

    const core = core2b({
      baseDiscard: ['base_c'],
    });
    const rankings = [{ playerId: '0', power: 5, vp: 2 }];
    const qA = collectBaseAbilityTriggers({ core, timing: 'afterScoring', ownerPlayerId: '0', baseIndex: 0, rankings, now: 1 })!;
    const qB = collectBaseAbilityTriggers({ core, timing: 'afterScoring', ownerPlayerId: '0', baseIndex: 1, rankings, now: 1 })!;
    const ms0 = makeMatchState({
      ...core,
      triggerQueue: [
        ...(qA as any).payload.triggers,
        ...(qB as any).payload.triggers,
      ],
    });

    const rq = maybeResolveReactionQueue(ms0, { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any, 1);
    expect(rq).toBeDefined();
    expect((rq!.state.sys.interaction.current as any)?.data?.sourceId).toBe('base_the_nexus_choose');
    expect((rq!.state.sys.interaction.current as any)?.data?.sourceId).not.toBe('smashup_reaction_choose');
  });

  it('queued afterScoring base ability 真链不应让 rankings 快照被 live mutation 污染', () => {
    registerBaseAbility('base_a', 'afterScoring', (ctx) => ({
      events: [{
        type: SU_EVENTS.ABILITY_FEEDBACK,
        payload: {
          playerId: ctx.playerId,
          messageKey: `base-rankings:${ctx.rankings?.[0]?.playerId ?? 'missing'}:${ctx.rankings?.[0]?.power ?? 'missing'}:${ctx.rankings?.[0]?.vp ?? 'missing'}`,
          tone: 'info',
        },
        timestamp: ctx.now,
      }] as any,
    }), {
      canTrigger: (ctx) => (
        ctx.rankings?.[0]?.playerId === '0'
        && ctx.rankings?.[0]?.power === 5
        && ctx.rankings?.[0]?.vp === 2
      ),
    });

    const core = core2b();
    const rankings = [
      { playerId: '0', power: 5, vp: 2 },
      { playerId: '1', power: 3, vp: 1 },
    ] as any;

    const queued = collectBaseAbilityTriggers({
      core,
      timing: 'afterScoring',
      ownerPlayerId: '0',
      baseIndex: 0,
      rankings,
      now: 1,
    }) as any;

    expect(queued).toBeDefined();
    const trigger = queued.payload.triggers[0];
    expect(trigger.rankings).toEqual([
      { playerId: '0', power: 5, vp: 2 },
      { playerId: '1', power: 3, vp: 1 },
    ]);

    rankings[0].playerId = '9';
    rankings[0].power = 99;
    rankings[0].vp = 7;

    const resolved = maybeResolveReactionQueue(
      makeMatchState({
        ...core,
        triggerQueue: queued.payload.triggers,
      }),
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      1,
    );

    expect(resolved?.events).toContainEqual(expect.objectContaining({
      type: SU_EVENTS.ABILITY_FEEDBACK,
      payload: expect.objectContaining({
        messageKey: 'base-rankings:0:5:2',
      }),
    }));
  });
});

