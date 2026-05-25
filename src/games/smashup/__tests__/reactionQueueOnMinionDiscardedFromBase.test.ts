import { describe, it, expect, beforeEach } from 'vitest';
import { clearOngoingEffectRegistry, registerTrigger, collectTriggers } from '../domain/ongoingEffects';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { registerReactionQueueInteractionHandlers } from '../domain/reactionQueueHandlers';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { processDestroyTriggers } from '../domain/reducer';
import { makeMatchState, makeState, makeBase, makeCard, makeMinion, makePlayer } from './helpers';
import { SU_EVENTS } from '../domain/types';

beforeEach(() => {
  clearOngoingEffectRegistry();
  clearInteractionHandlers();
  registerReactionQueueInteractionHandlers();
});

describe('reaction queue: onMinionDiscardedFromBase ordering', () => {
  it('multiple mandatory discarded-from-base triggers open ordering interaction', () => {
    registerTrigger('test_discard_a', 'onMinionDiscardedFromBase', (ctx) => ([{
      type: SU_EVENTS.CARDS_DRAWN,
      payload: { playerId: ctx.playerId, count: 1, cardUids: ['discard-a'] },
      timestamp: ctx.now,
    }] as any));
    registerTrigger('test_discard_b', 'onMinionDiscardedFromBase', (ctx) => ([{
      type: SU_EVENTS.CARDS_DRAWN,
      payload: { playerId: ctx.playerId, count: 1, cardUids: ['discard-b'] },
      timestamp: ctx.now,
    }] as any));

    const core = makeState({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      bases: [
        makeBase('test_base_1', [
          makeMinion('a1', 'test_discard_a', '0', 3),
          makeMinion('b1', 'test_discard_b', '0', 3),
          makeMinion('m1', 'any_minion', '0', 2),
        ]),
      ],
    });

    const queued = collectTriggers(core, 'onMinionDiscardedFromBase', {
      state: core,
      matchState: makeMatchState(core),
      playerId: '0',
      baseIndex: 0,
      triggerMinionUid: 'm1',
      triggerMinionDefId: 'any_minion',
      triggerMinion: core.bases[0].minions.find(m => m.uid === 'm1') as any,
      random: { shuffle: (a: any[]) => a } as any,
      now: 1,
    });
    expect(queued).toBeDefined();
    const triggers = (queued as any).payload.triggers;
    const ms0 = makeMatchState({ ...core, triggerQueue: triggers });

    const rq = maybeResolveReactionQueue(ms0, { shuffle: (a: any[]) => a } as any, 1);
    expect(rq).toBeDefined();
    const current = rq!.state.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('smashup_reaction_choose');
  });

  it('processDestroyTriggers 不应把 onMinionDiscardedFromBase 错过滤成只剩 triggerMinionDefId 来源', () => {
    registerTrigger('victim_minion', 'onMinionDiscardedFromBase', (ctx) => ([{
      type: SU_EVENTS.CARDS_DRAWN,
      payload: { playerId: ctx.playerId, count: 1, cardUids: ['self-trigger'] },
      timestamp: ctx.now,
    }] as any));
    registerTrigger('global_discard_watcher', 'onMinionDiscardedFromBase', (ctx) => ([{
      type: SU_EVENTS.CARDS_DRAWN,
      payload: { playerId: ctx.playerId, count: 1, cardUids: ['global-trigger'] },
      timestamp: ctx.now,
    }] as any), { global: true });

    const core = makeState({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 1,
      players: {
        '0': makePlayer('0', {
          discard: [makeCard('watcher-card', 'global_discard_watcher', 'action', '0')],
        }),
        '1': makePlayer('1'),
      },
      bases: [
        makeBase('test_base_1', [
          makeMinion('victim-1', 'victim_minion', '0', 3),
        ]),
      ],
    });

    const result = processDestroyTriggers([{
      type: SU_EVENTS.MINION_DESTROYED,
      payload: {
        minionUid: 'victim-1',
        minionDefId: 'victim_minion',
        fromBaseIndex: 0,
        ownerId: '0',
        destroyerId: '1',
        reason: 'test_destroy',
      },
      timestamp: 1000,
    } as any], makeMatchState(core), '1', { shuffle: (a: any[]) => a } as any, 1000);

    const triggers = result.events
      .filter((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED)
      .flatMap((event: any) => event.payload.triggers);

    expect(triggers.some((trigger: any) => trigger.sourceDefId === 'victim_minion')).toBe(true);
    expect(triggers.some((trigger: any) => trigger.sourceDefId === 'global_discard_watcher')).toBe(true);
  });

  it('global discard self-trigger 在被他人控制时也应在刚进弃牌堆后入队', () => {
    registerTrigger('global_discard_self', 'onMinionDiscardedFromBase', (ctx) => ([{
      type: SU_EVENTS.CARDS_DRAWN,
      payload: { playerId: ctx.playerId, count: 1, cardUids: ['global-self-trigger'] },
      timestamp: ctx.now,
    }] as any), {
      global: true,
      globalZones: ['discard'],
      playerContext: 'eventPlayer',
    });

    const core = makeState({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 1,
      players: {
        '0': makePlayer('0'),
        '1': makePlayer('1', {
          hand: [makeCard('bacta-a', 'shapeshifters_bacta_the_future', 'action', '1')],
        }),
      },
      bases: [
        makeBase('test_base_1', [
          makeMinion('stolen-jumper', 'global_discard_self', '1', 2, { owner: '0' }),
        ]),
      ],
    });

    const result = processDestroyTriggers([{
      type: SU_EVENTS.MINION_DESTROYED,
      payload: {
        minionUid: 'stolen-jumper',
        minionDefId: 'global_discard_self',
        fromBaseIndex: 0,
        ownerId: '0',
        destroyerId: '1',
        reason: 'test_destroy',
      },
      timestamp: 1000,
    } as any], makeMatchState(core), '1', { shuffle: (a: any[]) => a } as any, 1000);

    const triggers = result.events
      .filter((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED)
      .flatMap((event: any) => event.payload.triggers);

    expect(triggers.some((trigger: any) => trigger.sourceDefId === 'global_discard_self')).toBe(true);
    expect(triggers.some((trigger: any) => trigger.triggerMinionUid === 'stolen-jumper')).toBe(true);
    expect(triggers.some((trigger: any) => trigger.ownerPlayerId === '1')).toBe(true);
  });

  it('queued onMinionDiscardedFromBase attached-action trigger 在宿主已离场后仍应保留 triggerMinion 的 attached-action LKI', () => {
    registerTrigger('test_attached_discard_trigger', 'onMinionDiscardedFromBase', (ctx) => (
      ctx.triggerMinion?.attachedActions?.some(action => (
        action.uid === ctx.sourceCardUid
        && action.defId === 'test_attached_discard_trigger'
      ))
        ? [{
            type: SU_EVENTS.CARDS_DRAWN,
            payload: {
              playerId: ctx.sourceControllerId ?? ctx.playerId,
              count: 1,
              cardUids: ['attached-lki-draw'],
            },
            timestamp: ctx.now,
          } as any]
        : []
    ), {
      perInstance: true,
      playerContext: 'sourceController',
    });

    const beforeDiscardCore = makeState({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 1,
      players: {
        '0': makePlayer('0'),
        '1': makePlayer('1'),
      },
      bases: [
        makeBase('test_base_1', [
          makeMinion('victim-1', 'victim_minion', '0', 3, {
            attachedActions: [{ uid: 'attached-1', defId: 'test_attached_discard_trigger', ownerId: '0' }],
          }),
        ]),
      ],
    });

    const queued = collectTriggers(beforeDiscardCore, 'onMinionDiscardedFromBase', {
      state: beforeDiscardCore,
      matchState: makeMatchState(beforeDiscardCore),
      playerId: '0',
      baseIndex: 0,
      triggerMinionUid: 'victim-1',
      triggerMinionDefId: 'victim_minion',
      triggerMinion: beforeDiscardCore.bases[0].minions[0] as any,
      random: { shuffle: (a: any[]) => a } as any,
      now: 1001,
    }) as any;

    expect(queued).toBeDefined();

    const afterDiscardCore = makeState({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 1,
      players: {
        '0': makePlayer('0', {
          discard: [makeCard('victim-1', 'victim_minion', 'minion', '0')],
        }),
        '1': makePlayer('1'),
      },
      bases: [makeBase('test_base_1', [])],
      triggerQueue: queued.payload.triggers,
    });

    const resolved = maybeResolveReactionQueue(
      makeMatchState(afterDiscardCore),
      { shuffle: (a: any[]) => a } as any,
      1001,
    );

    expect(resolved).toBeDefined();
    expect(resolved!.events.some((event: any) => (
      event.type === SU_EVENTS.CARDS_DRAWN
      && event.payload?.playerId === '0'
      && event.payload?.cardUids?.includes('attached-lki-draw')
    ))).toBe(true);
  });
});

