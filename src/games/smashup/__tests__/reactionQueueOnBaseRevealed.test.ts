import { describe, it, expect, beforeEach } from 'vitest';
import type { SmashUpCore, TriggerInstance } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { scoreOneBase } from '../domain';
import { makeMatchState, makeState, makeBase, makeMinion } from './helpers';
import { clearBaseAbilityRegistry, registerBaseAbilities, registerExtended } from '../domain/baseAbilities';
import { registerReactionQueueInteractionHandlers } from '../domain/reactionQueueHandlers';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { collectExtendedBaseAbilityTriggers } from '../domain/baseAbilityQueue';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';

beforeEach(() => {
  clearBaseAbilityRegistry();
  clearInteractionHandlers();
  registerReactionQueueInteractionHandlers();
});

describe('Reaction queue: extended base timing onBaseRevealed', () => {
  it('optional onBaseRevealed triggers choose next by clockwise owner', () => {
    registerExtended('base_old', 'onBaseRevealed', () => ({ events: [] }), { mandatory: false });

    const core: SmashUpCore = makeState({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      bases: [makeBase('base_old')],
    });

    const q = collectExtendedBaseAbilityTriggers({ core, timing: 'onBaseRevealed', ownerPlayerId: '1', baseIndex: 0, now: 1 })!;
    // Force interaction path: multiple pending triggers -> choose-next prompt.
    const triggers: TriggerInstance[] = [
      ...(q as any).payload.triggers,
      { ...(q as any).payload.triggers[0], id: `${(q as any).payload.triggers[0].id}:2` },
    ];
    const ms0 = makeMatchState({ ...core, triggerQueue: triggers });
    const rq = maybeResolveReactionQueue(ms0 as any, { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any, 1)!;
    const current = rq.state.sys.interaction.current as any;
    expect(current.data.sourceId).toBe('smashup_reaction_choose');
    expect(current.playerId).toBe('1');
  });

  it('optional onBaseRevealed triggers should not queue when chooser is not in turnOrder', () => {
    registerExtended('base_old', 'onBaseRevealed', () => ({ events: [] }), { mandatory: false });

    const core: SmashUpCore = makeState({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      bases: [makeBase('base_old')],
    });

    const q = collectExtendedBaseAbilityTriggers({
      core,
      timing: 'onBaseRevealed',
      ownerPlayerId: '2' as any,
      baseIndex: 0,
      now: 1,
    });

    expect(q).toBeUndefined();
  });

  it('optional onBaseRevealed triggers 的 canTrigger 应按最终 chooser 视角判断，而不是沿用旧 ownerPlayerId', () => {
    registerExtended('base_old', 'onBaseRevealed', () => ({ events: [] }), {
      mandatory: false,
      ownerPlayerId: () => '1',
      canTrigger: (ctx) => ctx.playerId === '1',
    });

    const core: SmashUpCore = makeState({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      bases: [makeBase('base_old')],
    });

    const q = collectExtendedBaseAbilityTriggers({
      core,
      timing: 'onBaseRevealed',
      ownerPlayerId: '0',
      baseIndex: 0,
      now: 1,
    });

    expect(q).toBeDefined();
    expect((q as any).payload.triggers[0].ownerPlayerId).toBe('1');
  });

  it('queued onBaseRevealed extended trigger 应透传 frameId/sourceEventId 给 executor', () => {
    let captured: { frameId?: string; sourceEventId?: string } | undefined;
    registerExtended('base_old', 'onBaseRevealed', (ctx) => {
      captured = {
        frameId: ctx.frameId,
        sourceEventId: ctx.sourceEventId,
      };
      return { events: [] };
    }, { mandatory: true });

    const core: SmashUpCore = makeState({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      bases: [makeBase('base_old')],
    });

    const q = collectExtendedBaseAbilityTriggers({
      core,
      timing: 'onBaseRevealed',
      ownerPlayerId: '0',
      baseIndex: 0,
      frameId: 'base-revealed-frame:1',
      sourceEventId: 'base-revealed:1',
      now: 1,
    });

    expect(q).toBeDefined();

    const ms0 = makeMatchState({
      ...core,
      triggerQueue: [...(q as any).payload.triggers],
    });
    maybeResolveReactionQueue(ms0 as any, { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any, 1);

    expect(captured).toEqual({
      frameId: 'base-revealed-frame:1',
      sourceEventId: 'base-revealed:1',
    });
  });

  it('scoreOneBase 在 BASE_REPLACED 后应按新基地而不是旧基地排 onBaseRevealed 队列', () => {
    registerExtended('base_new', 'onBaseRevealed', () => ({ events: [] }), { mandatory: true });

    const core: SmashUpCore = makeState({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      bases: [
        makeBase('base_tar_pits', [
          makeMinion('p0-big', 'test_minion', '0', 30, '0'),
        ]),
      ],
      baseDeck: ['base_new'],
    });

    const result = scoreOneBase(core, 0, ['base_new'], '0', 1000);
    const queuedReveal = result.events.find((event: any) =>
      event.type === SU_EVENTS.TRIGGER_QUEUED
      && (event.payload?.triggers ?? []).some((trigger: any) => trigger?.timing === 'onBaseRevealed'),
    ) as any;

    expect(queuedReveal).toBeDefined();
    expect(queuedReveal.payload.triggers[0].sourceDefId).toBe('base_new');
    expect(queuedReveal.payload.triggers[0].sourceBaseIndex).toBe(0);
  });

  it('base_sheep_shrine 不应把整条多玩家移动链暴露成当前玩家可整体跳过的 optional trigger', () => {
    registerBaseAbilities();

    const core: SmashUpCore = makeState({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      bases: [
        makeBase('base_sheep_shrine'),
        makeBase('base_other', [
          makeMinion('p0-minion', 'test_minion', '0', 2),
          makeMinion('p1-minion', 'test_minion', '1', 2),
        ]),
      ],
    });

    const queuedReveal = collectExtendedBaseAbilityTriggers({
      core,
      timing: 'onBaseRevealed',
      ownerPlayerId: '0',
      baseIndex: 0,
      now: 1,
    });

    expect(queuedReveal).toBeDefined();
    expect((queuedReveal as any).payload.triggers[0].mandatory).toBe(true);

    const resolved = maybeResolveReactionQueue(
      makeMatchState({
        ...core,
        triggerQueue: [...(queuedReveal as any).payload.triggers],
      }),
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      1,
    );

    const current = resolved?.state.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('base_sheep_shrine');
    expect(current?.playerId).toBe('0');
    expect(current?.data?.options?.some((option: any) => option.value?.minionUid === 'p0-minion')).toBe(true);
    expect((resolved?.state.sys.interaction.queue ?? [])[0]?.playerId).toBe('1');
  });
});

