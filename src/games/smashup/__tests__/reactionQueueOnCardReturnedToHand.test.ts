import { beforeEach, describe, expect, it } from 'vitest';
import { clearOngoingEffectRegistry, registerTrigger } from '../domain/ongoingEffects';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { registerReactionQueueInteractionHandlers } from '../domain/reactionQueueHandlers';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { processReturnToHandTriggers } from '../domain/reducer';
import { makeBase, makeCard, makeMatchState, makeMinion, makeState } from './helpers';
import { SU_EVENTS } from '../domain/types';

beforeEach(() => {
  clearOngoingEffectRegistry();
  clearInteractionHandlers();
  registerReactionQueueInteractionHandlers();
});

describe('reaction queue: onCardReturnedToHand ordering', () => {
  const registerMandatoryReturnTriggers = () => {
    registerTrigger('test_return_a', 'onCardReturnedToHand', (ctx) => ([{
      type: SU_EVENTS.CARDS_DRAWN,
      payload: { playerId: ctx.playerId, count: 1, cardUids: ['return-a'] },
      timestamp: ctx.now,
    }] as any));
    registerTrigger('test_return_b', 'onCardReturnedToHand', (ctx) => ([{
      type: SU_EVENTS.CARDS_DRAWN,
      payload: { playerId: ctx.playerId, count: 1, cardUids: ['return-b'] },
      timestamp: ctx.now,
    }] as any));
  };

  const expectOrderingPrompt = (processedEvents: any[], core: any) => {
    const queued = processedEvents.find(event => event.type === SU_EVENTS.TRIGGER_QUEUED);
    expect(queued).toBeDefined();
    const triggers = queued.payload.triggers;
    const ms0 = makeMatchState({ ...core, triggerQueue: triggers });
    const rq = maybeResolveReactionQueue(ms0, { shuffle: (a: any[]) => a } as any, 1);
    expect(rq).toBeDefined();
    expect((rq!.state.sys.interaction.current as any)?.data?.sourceId).toBe('smashup_reaction_choose');
  };

  it('multiple mandatory returned-to-hand triggers opened by MINION_RETURNED enter ordering interaction', () => {
    registerMandatoryReturnTriggers();

    const core = makeState({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      bases: [makeBase('test_base_1', [
        makeMinion('source-a', 'test_return_a', '0', 3),
        makeMinion('source-b', 'test_return_b', '0', 3),
        makeMinion('return-minion', 'any_minion', '0', 3),
      ])],
    });

    const processed = processReturnToHandTriggers([{
      type: SU_EVENTS.MINION_RETURNED,
      payload: {
        minionUid: 'return-minion',
        minionDefId: 'any_minion',
        fromBaseIndex: 0,
        toPlayerId: '0',
        reason: 'test-return',
      },
      timestamp: 1,
    } as any], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 1);

    expectOrderingPrompt(processed.events as any[], core);
  });

  it('multiple mandatory returned-to-hand triggers opened by CARD_TRANSFERRED from play enter ordering interaction', () => {
    registerMandatoryReturnTriggers();

    const core = makeState({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      bases: [makeBase('test_base_1', [
        makeMinion('source-a', 'test_return_a', '0', 3),
        makeMinion('source-b', 'test_return_b', '0', 3),
        makeMinion('host-a', 'host_minion', '0', 3, {
          attachedActions: [{ uid: 'attached-a', defId: 'test_action', ownerId: '0' }],
        }),
      ])],
    });

    const processed = processReturnToHandTriggers([{
      type: SU_EVENTS.CARD_TRANSFERRED,
      payload: {
        cardUid: 'attached-a',
        defId: 'test_action',
        fromPlayerId: '0',
        toPlayerId: '0',
        reason: 'test-transfer',
      },
      timestamp: 1,
    } as any], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 1);

    expectOrderingPrompt(processed.events as any[], core);
  });

  it('multiple mandatory returned-to-hand triggers opened by CARD_RECOVERED_FROM_DISCARD enter ordering interaction', () => {
    registerMandatoryReturnTriggers();

    const core = makeState({
      players: {
        '0': {
          ...makeState().players['0'],
          discard: [makeCard('discard-a', 'test_action', 'action', '0')],
        },
        '1': makeState().players['1'],
      },
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      bases: [makeBase('test_base_1', [
        makeMinion('source-a', 'test_return_a', '0', 3),
        makeMinion('source-b', 'test_return_b', '0', 3),
      ])],
    });

    const processed = processReturnToHandTriggers([{
      type: SU_EVENTS.CARD_RECOVERED_FROM_DISCARD,
      payload: {
        playerId: '0',
        cardUids: ['discard-a'],
        reason: 'test-recover',
      },
      timestamp: 1,
    } as any], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 1);

    expectOrderingPrompt(processed.events as any[], core);
  });

  it('multiple mandatory returned-to-hand triggers opened by BURIED_CARD_RETURNED_TO_HAND enter ordering interaction', () => {
    registerMandatoryReturnTriggers();

    const core = makeState({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      bases: [makeBase({
        defId: 'test_base_1',
        minions: [
          makeMinion('source-a', 'test_return_a', '0', 3),
          makeMinion('source-b', 'test_return_b', '0', 3),
        ],
        ongoingActions: [],
        buriedCards: [{
          uid: 'buried-a',
          defId: 'any_buried_action',
          ownerId: '0',
          controllerId: '0',
          trueOwnerId: '0',
          buriedFrom: 'hand',
        } as any],
      })],
    });

    const processed = processReturnToHandTriggers([{
      type: SU_EVENTS.BURIED_CARD_RETURNED_TO_HAND,
      payload: {
        playerId: '0',
        cardUid: 'buried-a',
        baseIndex: 0,
      },
      timestamp: 1,
    } as any], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 1);

    expectOrderingPrompt(processed.events as any[], core);
  });

  it('CARD_RECOVERED_FROM_DISCARD 回手随从时，queued trigger 应继续拿到 returned minion provenance', () => {
    registerTrigger('test_return_runtime', 'onCardReturnedToHand', (ctx) => ([{
      type: SU_EVENTS.ABILITY_FEEDBACK,
      payload: {
        playerId: ctx.playerId,
        messageKey: `${ctx.triggerMinionUid}:${ctx.triggerMinionDefId}`,
        tone: 'info',
      },
      timestamp: ctx.now,
    }] as any), {
      canTrigger: (ctx) => (
        ctx.triggerMinionUid === 'discard-minion'
        && ctx.triggerMinionDefId === 'test_return_runtime'
        && ctx.playerId === '0'
      ),
    });

    const core = makeState({
      players: {
        '0': {
          ...makeState().players['0'],
          discard: [
            makeCard('discard-action', 'test_action', 'action', '0'),
            makeCard('discard-minion', 'test_return_runtime', 'minion', '0'),
          ],
        },
        '1': makeState().players['1'],
      },
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      bases: [makeBase('test_base_1', [
        makeMinion('source-a', 'test_return_runtime', '0', 3),
      ])],
    });

    const processed = processReturnToHandTriggers([{
      type: SU_EVENTS.CARD_RECOVERED_FROM_DISCARD,
      payload: {
        playerId: '0',
        cardUids: ['discard-action', 'discard-minion'],
        reason: 'test-recover-minion-runtime',
      },
      timestamp: 1,
    } as any], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 1);

    const queued = (processed.events as any[]).find(event => event.type === SU_EVENTS.TRIGGER_QUEUED);
    expect(queued).toBeDefined();

    const resolved = maybeResolveReactionQueue(
      makeMatchState({
        ...(core as any),
        triggerQueue: queued.payload.triggers,
      }),
      { shuffle: (a: any[]) => a } as any,
      1,
    );

    expect(resolved?.events).toContainEqual(expect.objectContaining({
      type: SU_EVENTS.ABILITY_FEEDBACK,
      payload: expect.objectContaining({
        messageKey: 'discard-minion:test_return_runtime',
      }),
    }));
  });

  it('CARD_RECOVERED_FROM_DISCARD 同批回手多张随从时，应按每张随从分别打开 returned trigger frame', () => {
    registerTrigger('test_return_runtime', 'onCardReturnedToHand', () => [], {
      canTrigger: (ctx) => typeof ctx.triggerMinionUid === 'string' && ctx.triggerMinionUid.startsWith('discard-minion-'),
    });

    const core = makeState({
      players: {
        '0': {
          ...makeState().players['0'],
          discard: [
            makeCard('discard-minion-a', 'test_return_runtime', 'minion', '0'),
            makeCard('discard-minion-b', 'test_return_runtime', 'minion', '0'),
          ],
        },
        '1': makeState().players['1'],
      },
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      bases: [makeBase('test_base_1', [
        makeMinion('source-a', 'test_return_runtime', '0', 3),
      ])],
    });

    const processed = processReturnToHandTriggers([{
      type: SU_EVENTS.CARD_RECOVERED_FROM_DISCARD,
      payload: {
        playerId: '0',
        cardUids: ['discard-minion-a', 'discard-minion-b'],
        reason: 'test-recover-two-minions-runtime',
      },
      timestamp: 3,
    } as any], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 3);

    const triggers = (processed.events as any[])
      .filter(event => event.type === SU_EVENTS.TRIGGER_QUEUED)
      .flatMap(event => event.payload.triggers);

    expect(triggers.map((trigger: any) => trigger.triggerMinionUid).sort()).toEqual([
      'discard-minion-a',
      'discard-minion-b',
    ]);
    expect(new Set(triggers.map((trigger: any) => trigger.frameId)).size).toBe(2);
    expect(triggers.map((trigger: any) => trigger.sourceEventId).sort()).toEqual([
      `card-returned-to-hand:${SU_EVENTS.CARD_RECOVERED_FROM_DISCARD}:discard-minion-a:0:0:3`,
      `card-returned-to-hand:${SU_EVENTS.CARD_RECOVERED_FROM_DISCARD}:discard-minion-b:0:0:3`,
    ]);
  });

  it('global hand self-trigger 也应在刚回手后入队，而不是继续按旧现场漏排', () => {
    registerTrigger('global_return_self', 'onCardReturnedToHand', (ctx) => ([{
      type: SU_EVENTS.ABILITY_FEEDBACK,
      payload: {
        playerId: ctx.playerId,
        messageKey: `${ctx.playerId}:${ctx.triggerMinionUid}:${ctx.triggerMinionDefId}`,
        tone: 'info',
      },
      timestamp: ctx.now,
    }] as any), {
      global: true,
      globalZones: ['hand'],
      canTrigger: (ctx) => (
        ctx.playerId === '0'
        && ctx.triggerMinionUid === 'stolen-returner'
        && ctx.triggerMinionDefId === 'global_return_self'
      ),
    });

    const core = makeState({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 1,
      bases: [makeBase('test_base_1', [
        makeMinion('stolen-returner', 'global_return_self', '1', 3, { owner: '0' }),
      ])],
    });

    const processed = processReturnToHandTriggers([{
      type: SU_EVENTS.MINION_RETURNED,
      payload: {
        minionUid: 'stolen-returner',
        minionDefId: 'global_return_self',
        fromBaseIndex: 0,
        toPlayerId: '0',
        reason: 'test-global-hand-self-return',
      },
      timestamp: 1,
    } as any], makeMatchState(core), '1', { shuffle: (a: any[]) => a } as any, 1);

    const queued = (processed.events as any[]).find(event => event.type === SU_EVENTS.TRIGGER_QUEUED);
    expect(queued).toBeDefined();
    const triggers = queued.payload.triggers;
    expect(triggers.some((trigger: any) => trigger.sourceDefId === 'global_return_self')).toBe(true);

    const resolved = maybeResolveReactionQueue(
      makeMatchState({
        ...(core as any),
        triggerQueue: triggers,
      }),
      { shuffle: (a: any[]) => a } as any,
      1,
    );

    expect(resolved?.events).toContainEqual(expect.objectContaining({
      type: SU_EVENTS.ABILITY_FEEDBACK,
      payload: expect.objectContaining({
        messageKey: '0:stolen-returner:global_return_self',
      }),
    }));
  });

  it('同批次前一条回手事件已把 source 送进 hand 时，后一条 returned-to-hand 也应看到更新后的现场', () => {
    registerTrigger('global_return_self', 'onCardReturnedToHand', (ctx) => ([{
      type: SU_EVENTS.ABILITY_FEEDBACK,
      payload: {
        playerId: ctx.playerId,
        messageKey: `${ctx.playerId}:${ctx.triggerMinionUid}`,
        tone: 'info',
      },
      timestamp: ctx.now,
    }] as any), {
      global: true,
      globalZones: ['hand'],
      canTrigger: (ctx) => (
        ctx.playerId === '0'
        && ctx.triggerMinionUid === 'second-return'
      ),
    });

    const core = makeState({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 1,
      bases: [makeBase('test_base_1', [
        makeMinion('stolen-returner', 'global_return_self', '1', 3, { owner: '0' }),
        makeMinion('second-return', 'any_minion', '0', 3),
      ])],
    });

    const processed = processReturnToHandTriggers([
      {
        type: SU_EVENTS.MINION_RETURNED,
        payload: {
          minionUid: 'stolen-returner',
          minionDefId: 'global_return_self',
          fromBaseIndex: 0,
          toPlayerId: '0',
          reason: 'test-batch-return-self-first',
        },
        timestamp: 1,
      } as any,
      {
        type: SU_EVENTS.MINION_RETURNED,
        payload: {
          minionUid: 'second-return',
          minionDefId: 'any_minion',
          fromBaseIndex: 0,
          toPlayerId: '0',
          reason: 'test-batch-return-second',
        },
        timestamp: 1,
      } as any,
    ], makeMatchState(core), '1', { shuffle: (a: any[]) => a } as any, 1);

    const queued = (processed.events as any[]).find(event => event.type === SU_EVENTS.TRIGGER_QUEUED);
    expect(queued).toBeDefined();

    const resolved = maybeResolveReactionQueue(
      makeMatchState({
        ...(core as any),
        triggerQueue: queued.payload.triggers,
      }),
      { shuffle: (a: any[]) => a } as any,
      1,
    );

    expect(resolved?.events).toContainEqual(expect.objectContaining({
      type: SU_EVENTS.ABILITY_FEEDBACK,
      payload: expect.objectContaining({
        messageKey: '0:second-return',
      }),
    }));
  });

  it('同批次前一条非 return 事件也应顺序推进现场，而不是只让 return carrier 自己前进', () => {
    const core = makeState({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      players: {
        '0': makeState().players['0'],
        '1': makeState().players['1'],
      },
      bases: [{
        defId: 'base_a',
        minions: [
          makeMinion('host-1', 'robot_microbot_alpha', '0', 2),
          makeMinion('returned-after-control-shift', 'robot_microbot_beta', '0', 3),
        ],
        ongoingActions: [],
      }],
    });

    const processed = processReturnToHandTriggers([
      {
        type: SU_EVENTS.MINION_CONTROL_CHANGED,
        payload: {
          minionUid: 'host-1',
          baseIndex: 0,
          toControllerId: '1',
        },
        timestamp: 1,
      } as any,
      {
        type: SU_EVENTS.MINION_RETURNED,
        payload: {
          minionUid: 'returned-after-control-shift',
          minionDefId: 'robot_microbot_beta',
          fromBaseIndex: 0,
          toPlayerId: '0',
          reason: 'test_return_after_control_shift',
        },
        timestamp: 1,
      } as any,
    ], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 1);

    expect(processed.matchState?.core.bases[0]?.minions.find(minion => minion.uid === 'host-1')?.controller).toBe('1');
  });

  it('MINION_RETURNED opened onCardReturnedToHand queued reactions should stamp explicit frame/source ids', () => {
    registerTrigger('test_return_frame', 'onCardReturnedToHand', () => [], {});

    const core = makeState({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      bases: [makeBase('test_base_1', [
        makeMinion('source-a', 'test_return_frame', '0', 3),
        makeMinion('return-minion', 'any_minion', '0', 3),
      ])],
    });

    const processed = processReturnToHandTriggers([{
      type: SU_EVENTS.MINION_RETURNED,
      payload: {
        minionUid: 'return-minion',
        minionDefId: 'any_minion',
        fromBaseIndex: 0,
        toPlayerId: '0',
        reason: 'test-return',
      },
      timestamp: 7,
    } as any], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 7);

    const queued = (processed.events as any[]).find(event => event.type === SU_EVENTS.TRIGGER_QUEUED);
    expect(queued).toBeDefined();
    const trigger = queued.payload.triggers[0];
    expect(trigger.sourceEventId).toBe(`card-returned-to-hand:${SU_EVENTS.MINION_RETURNED}:return-minion:0:0:7`);
    expect(trigger.frameId).toBe(`card-returned-to-hand-frame:${SU_EVENTS.MINION_RETURNED}:return-minion:0:0:7`);
  });

  it('MINION_RETURNED 让宿主从场上回手时，已随宿主离场的附着 source 也应按显式 source provenance 入队', () => {
    registerTrigger('test_attached_return_source', 'onCardReturnedToHand', () => [], {
      perInstance: true,
      playerContext: 'sourceController',
    });

    const core = makeState({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      players: {
        '0': makeState().players['0'],
        '1': makeState().players['1'],
      },
      bases: [makeBase('test_base_1', [
        makeMinion('return-host', 'any_minion', '1', 3, {
          attachedActions: [{ uid: 'attached-source', defId: 'test_attached_return_source', ownerId: '0' }] as any,
        }),
      ])],
    });

    const processed = processReturnToHandTriggers([{
      type: SU_EVENTS.MINION_RETURNED,
      payload: {
        minionUid: 'return-host',
        minionDefId: 'any_minion',
        fromBaseIndex: 0,
        toPlayerId: '1',
        reason: 'test-return-host',
      },
      timestamp: 8,
    } as any], makeMatchState(core), '1', { shuffle: (a: any[]) => a } as any, 8);

    const queued = (processed.events as any[]).find(event => event.type === SU_EVENTS.TRIGGER_QUEUED);
    expect(queued).toBeDefined();
    const trigger = queued.payload.triggers[0];
    expect(trigger.sourceDefId).toBe('test_attached_return_source');
    expect(trigger.sourceCardUid).toBe('attached-source');
    expect(trigger.sourceControllerId).toBe('0');
    expect(trigger.ownerPlayerId).toBe('0');
    expect(trigger.eventPlayerId).toBe('1');
    expect(trigger.triggerMinionUid).toBe('return-host');
  });

  it('CARD_TRANSFERRED from play opened onCardReturnedToHand queued reactions should stamp explicit frame/source ids', () => {
    registerTrigger('test_return_frame', 'onCardReturnedToHand', () => [], {});

    const core = makeState({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      bases: [makeBase('test_base_1', [
        makeMinion('source-a', 'test_return_frame', '0', 3),
        makeMinion('host-a', 'host_minion', '0', 3, {
          attachedActions: [{ uid: 'attached-a', defId: 'test_action', ownerId: '0' }],
        }),
      ])],
    });

    const processed = processReturnToHandTriggers([{
      type: SU_EVENTS.CARD_TRANSFERRED,
      payload: {
        cardUid: 'attached-a',
        defId: 'test_action',
        fromPlayerId: '0',
        toPlayerId: '0',
        reason: 'test-transfer',
      },
      timestamp: 7,
    } as any], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 7);

    const queued = (processed.events as any[]).find(event => event.type === SU_EVENTS.TRIGGER_QUEUED);
    expect(queued).toBeDefined();
    const trigger = queued.payload.triggers[0];
    expect(trigger.sourceEventId).toBe(`card-returned-to-hand:${SU_EVENTS.CARD_TRANSFERRED}:attached-a:0:0:7`);
    expect(trigger.frameId).toBe(`card-returned-to-hand-frame:${SU_EVENTS.CARD_TRANSFERRED}:attached-a:0:0:7`);
  });

  it('CARD_TRANSFERRED 让宿主从场上回手时，已随宿主离场的附着 source 也应按显式 source provenance 入队', () => {
    registerTrigger('test_attached_return_source', 'onCardReturnedToHand', () => [], {
      perInstance: true,
      playerContext: 'sourceController',
    });

    const core = makeState({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      players: {
        '0': makeState().players['0'],
        '1': makeState().players['1'],
      },
      bases: [makeBase('test_base_1', [
        makeMinion('return-host', 'any_minion', '1', 3, {
          attachedActions: [{ uid: 'attached-source', defId: 'test_attached_return_source', ownerId: '0' }] as any,
        }),
      ])],
    });

    const processed = processReturnToHandTriggers([{
      type: SU_EVENTS.CARD_TRANSFERRED,
      payload: {
        cardUid: 'return-host',
        defId: 'any_minion',
        fromPlayerId: '1',
        toPlayerId: '1',
        reason: 'test-transfer-host',
      },
      timestamp: 9,
    } as any], makeMatchState(core), '1', { shuffle: (a: any[]) => a } as any, 9);

    const queued = (processed.events as any[]).find(event => event.type === SU_EVENTS.TRIGGER_QUEUED);
    expect(queued).toBeDefined();
    const trigger = queued.payload.triggers[0];
    expect(trigger.sourceDefId).toBe('test_attached_return_source');
    expect(trigger.sourceCardUid).toBe('attached-source');
    expect(trigger.sourceControllerId).toBe('0');
    expect(trigger.ownerPlayerId).toBe('0');
    expect(trigger.eventPlayerId).toBe('1');
    expect(trigger.triggerMinionUid).toBe('return-host');
  });

  it('CARD_RECOVERED_FROM_DISCARD opened onCardReturnedToHand queued reactions should stamp explicit frame/source ids', () => {
    registerTrigger('test_return_frame', 'onCardReturnedToHand', () => [], {});

    const core = makeState({
      players: {
        '0': {
          ...makeState().players['0'],
          discard: [makeCard('discard-a', 'test_action', 'action', '0')],
        },
        '1': makeState().players['1'],
      },
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      bases: [makeBase('test_base_1', [
        makeMinion('source-a', 'test_return_frame', '0', 3),
      ])],
    });

    const processed = processReturnToHandTriggers([{
      type: SU_EVENTS.CARD_RECOVERED_FROM_DISCARD,
      payload: {
        playerId: '0',
        cardUids: ['discard-a'],
        reason: 'test-recover',
      },
      timestamp: 7,
    } as any], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 7);

    const queued = (processed.events as any[]).find(event => event.type === SU_EVENTS.TRIGGER_QUEUED);
    expect(queued).toBeDefined();
    const trigger = queued.payload.triggers[0];
    expect(trigger.sourceEventId).toBe(`card-returned-to-hand:${SU_EVENTS.CARD_RECOVERED_FROM_DISCARD}:discard-a:0:0:7`);
    expect(trigger.frameId).toBe(`card-returned-to-hand-frame:${SU_EVENTS.CARD_RECOVERED_FROM_DISCARD}:discard-a:0:0:7`);
  });

  it('BURIED_CARD_RETURNED_TO_HAND opened onCardReturnedToHand queued reactions should stamp explicit frame/source ids', () => {
    registerTrigger('test_return_frame', 'onCardReturnedToHand', () => [], {});

    const core = makeState({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      bases: [makeBase({
        defId: 'test_base_1',
        minions: [
          makeMinion('source-a', 'test_return_frame', '0', 3),
        ],
        ongoingActions: [],
        buriedCards: [{
          uid: 'buried-a',
          defId: 'any_buried_action',
          ownerId: '0',
          controllerId: '0',
          trueOwnerId: '0',
          buriedFrom: 'hand',
        } as any],
      })],
    });

    const processed = processReturnToHandTriggers([{
      type: SU_EVENTS.BURIED_CARD_RETURNED_TO_HAND,
      payload: {
        playerId: '0',
        cardUid: 'buried-a',
        baseIndex: 0,
      },
      timestamp: 7,
    } as any], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 7);

    const queued = (processed.events as any[]).find(event => event.type === SU_EVENTS.TRIGGER_QUEUED);
    expect(queued).toBeDefined();
    const trigger = queued.payload.triggers[0];
    expect(trigger.sourceEventId).toBe(`card-returned-to-hand:${SU_EVENTS.BURIED_CARD_RETURNED_TO_HAND}:buried-a:0:0:7`);
    expect(trigger.frameId).toBe(`card-returned-to-hand-frame:${SU_EVENTS.BURIED_CARD_RETURNED_TO_HAND}:buried-a:0:0:7`);
  });
});
