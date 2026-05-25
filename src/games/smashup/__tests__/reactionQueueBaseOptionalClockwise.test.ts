import { describe, it, expect, beforeEach } from 'vitest';
import type { SmashUpCore, TriggerInstance } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { applyEvents, makeMatchState, makeState, makeBase } from './helpers';
import { clearBaseAbilityRegistry, registerBaseAbility, registerBaseAbilities } from '../domain/baseAbilities';
import { registerReactionQueueInteractionHandlers } from '../domain/reactionQueueHandlers';
import { clearInteractionHandlers, getInteractionHandler } from '../domain/abilityInteractionHandlers';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { collectBaseAbilityTriggers } from '../domain/baseAbilityQueue';
import { getSmashUpReactionSession } from '../domain/reactionSession';
import { runCommand } from './testRunner';

function core3p(overrides?: Partial<SmashUpCore>): SmashUpCore {
  return makeState({
    turnOrder: ['0', '1', '2'],
    currentPlayerIndex: 0,
    bases: [makeBase('base_a'), makeBase('base_b')],
    ...overrides,
  });
}

beforeEach(() => {
  clearBaseAbilityRegistry();
  clearInteractionHandlers();
  registerReactionQueueInteractionHandlers();
});

function withResolvedInteraction(ms: any) {
  return {
    ...ms,
    sys: {
      ...ms.sys,
      interaction: {
        current: undefined,
        queue: [],
      },
    },
  };
}

describe('Reaction queue: optional base triggers resolve clockwise', () => {
  it('optional triggers use smashup reaction session and start with the first clockwise eligible player', () => {
    // Two optional base abilities, owned by different players.
    registerBaseAbility('base_a', 'onTurnStart', () => ({ events: [] }), {
      mandatory: false,
    });
    registerBaseAbility('base_b', 'onTurnStart', () => ({ events: [] }), {
      mandatory: false,
    });

    const core = core3p();
    const q1 = collectBaseAbilityTriggers({ core, timing: 'onTurnStart', ownerPlayerId: '1', baseIndex: 0, now: 1 })!;
    const q2 = collectBaseAbilityTriggers({ core, timing: 'onTurnStart', ownerPlayerId: '2', baseIndex: 1, now: 1 })!;
    const triggers: TriggerInstance[] = [
      ...(q1 as any).payload.triggers,
      ...(q2 as any).payload.triggers,
    ];

    const ms0 = makeMatchState({ ...core, triggerQueue: triggers });
    const rq = maybeResolveReactionQueue(ms0, { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any, 1);
    expect(rq).toBeDefined();
    const current = (rq!.state.sys.interaction.current as any);

    // Optional: current player 0 has no options, so the first eligible player clockwise is 1.
    expect(current.playerId).toBe('1');
    expect(current.data.sourceId).toBe('smashup_reaction_choose');
    expect(current.data.options.some((option: any) => String(option.id).includes('base_a'))).toBe(true);
    expect(current.data.options.some((option: any) => String(option.id).includes('base_b'))).toBe(false);
    expect(current.data.options.some((option: any) => option.id === 'pass')).toBe(true);
  });

  it('a player who passed may still act later in the same optional cycle', () => {
    registerBaseAbility('base_a', 'onTurnStart', () => ({ events: [] }), {
      mandatory: false,
    });
    registerBaseAbility('base_b', 'onTurnStart', () => ({ events: [] }), {
      mandatory: false,
    });

    const core = core3p();
    const q1 = collectBaseAbilityTriggers({ core, timing: 'onTurnStart', ownerPlayerId: '1', baseIndex: 0, now: 1 })!;
    const q2 = collectBaseAbilityTriggers({ core, timing: 'onTurnStart', ownerPlayerId: '2', baseIndex: 1, now: 1 })!;
    const playerOneTrigger = (q1 as any).payload.triggers[0];
    const triggers: TriggerInstance[] = [
      playerOneTrigger,
      { ...playerOneTrigger, id: `${playerOneTrigger.id}:again` },
      ...(q2 as any).payload.triggers,
    ];

    const ms0 = makeMatchState({ ...core, triggerQueue: triggers });
    const rq = maybeResolveReactionQueue(ms0, { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any, 1);
    expect(rq).toBeDefined();
    const handler = getInteractionHandler('smashup_reaction_choose');
    expect(handler).toBeTruthy();

    const current1 = rq!.state.sys.interaction.current as any;
    expect(current1.playerId).toBe('1');

    const afterPass = handler!(
      withResolvedInteraction(rq!.state) as any,
      '1',
      { kind: 'pass' },
      current1.data,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      2,
    );
    expect(afterPass).toBeDefined();
    const current2 = afterPass!.state.sys.interaction.current as any;
    expect(current2.playerId).toBe('2');
    expect(current2.data.options.some((option: any) => String(option.id).includes('base_b'))).toBe(true);

    const triggerB = current2.data.options.find((option: any) => String(option.id).includes('base_b'));
    expect(triggerB).toBeDefined();
    const afterPlayerTwoActs = handler!(
      withResolvedInteraction(afterPass!.state) as any,
      '2',
      triggerB.value,
      current2.data,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      3,
    );
    expect(afterPlayerTwoActs).toBeDefined();

    const current3 = afterPlayerTwoActs!.state.sys.interaction.current as any;
    expect(current3.playerId).toBe('1');
    expect(current3.data.sourceId).toBe('smashup_reaction_choose');
    expect(current3.data.options.filter((option: any) => String(option.id).includes('base_a')).length).toBe(2);
  });

  it('optional cycle 全员让过时应消费当前 frame 剩余 trigger 并关闭 session', () => {
    registerBaseAbility('base_a', 'onTurnStart', () => ({ events: [] }), {
      mandatory: false,
    });
    registerBaseAbility('base_b', 'onTurnStart', () => ({ events: [] }), {
      mandatory: false,
    });

    const core = core3p();
    const q1 = collectBaseAbilityTriggers({ core, timing: 'onTurnStart', ownerPlayerId: '1', baseIndex: 0, now: 1 })!;
    const q2 = collectBaseAbilityTriggers({ core, timing: 'onTurnStart', ownerPlayerId: '2', baseIndex: 1, now: 1 })!;
    const triggers: TriggerInstance[] = [
      ...(q1 as any).payload.triggers,
      ...(q2 as any).payload.triggers,
    ];

    const ms0 = makeMatchState({ ...core, triggerQueue: triggers });
    const rq = maybeResolveReactionQueue(ms0, { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any, 1);
    expect(rq).toBeDefined();
    const handler = getInteractionHandler('smashup_reaction_choose');
    expect(handler).toBeTruthy();

    const current1 = rq!.state.sys.interaction.current as any;
    expect(current1.playerId).toBe('1');

    const afterPass1 = handler!(
      withResolvedInteraction(rq!.state) as any,
      '1',
      { kind: 'pass' },
      current1.data,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      2,
    );
    expect(afterPass1).toBeDefined();
    const current2 = afterPass1!.state.sys.interaction.current as any;
    expect(current2.playerId).toBe('2');

    const afterPass2 = handler!(
      withResolvedInteraction(afterPass1!.state) as any,
      '2',
      { kind: 'pass' },
      current2.data,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      3,
    );
    expect(afterPass2).toBeDefined();
    const finalCore = applyEvents(afterPass2!.state.core, afterPass2!.events as any);
    expect(afterPass2!.events.filter((event: any) => event.type === SU_EVENTS.TRIGGER_CONSUMED)).toHaveLength(2);
    expect(finalCore.triggerQueue ?? []).toHaveLength(0);
    expect(afterPass2!.state.sys.interaction.current).toBeUndefined();
    expect(afterPass2!.state.sys.responseWindow?.current).toBeUndefined();
  });

  it('optional cycle 中当前响应者 SYS_INTERACTION_CANCEL 时，应按 pass 推进到下一位 eligible player', () => {
    registerBaseAbility('base_a', 'onTurnStart', () => ({ events: [] }), {
      mandatory: false,
    });
    registerBaseAbility('base_b', 'onTurnStart', () => ({ events: [] }), {
      mandatory: false,
    });

    const core = core3p();
    const q1 = collectBaseAbilityTriggers({ core, timing: 'onTurnStart', ownerPlayerId: '1', baseIndex: 0, now: 1 })!;
    const q2 = collectBaseAbilityTriggers({ core, timing: 'onTurnStart', ownerPlayerId: '2', baseIndex: 1, now: 1 })!;
    const triggers: TriggerInstance[] = [
      ...(q1 as any).payload.triggers,
      ...(q2 as any).payload.triggers,
    ];

    const ms0 = makeMatchState({ ...core, triggerQueue: triggers });
    const rq = maybeResolveReactionQueue(ms0, { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any, 1);
    expect(rq).toBeDefined();
    const current = rq!.state.sys.interaction.current as any;
    expect(current?.playerId).toBe('1');
    expect(current?.data?.sourceId).toBe('smashup_reaction_choose');

    const cancelled = runCommand(rq!.state as any, {
      type: 'SYS_INTERACTION_CANCEL' as any,
      playerId: '1',
      payload: { reason: 'treat-like-pass-in-optional-cycle' },
    } as any, { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any);

    expect(cancelled.success).toBe(true);
    expect((cancelled.finalState.sys.interaction.current as any)?.data?.sourceId).toBe('smashup_reaction_choose');
    expect((cancelled.finalState.sys.interaction.current as any)?.playerId).toBe('2');
    expect(getSmashUpReactionSession(cancelled.finalState as any)?.activePlayerId).toBe('2');
    expect(cancelled.finalState.sys.responseWindow?.current).toBeUndefined();
  });

  it('optional cycle 中当前响应者点击的旧 trigger 若已从 live queue 消失，应按 stale pass 推进到下一位 eligible player', () => {
    registerBaseAbility('base_a', 'onTurnStart', () => ({ events: [] }), {
      mandatory: false,
    });
    registerBaseAbility('base_b', 'onTurnStart', () => ({ events: [] }), {
      mandatory: false,
    });

    const core = core3p();
    const q1 = collectBaseAbilityTriggers({ core, timing: 'onTurnStart', ownerPlayerId: '1', baseIndex: 0, now: 1 })!;
    const q2 = collectBaseAbilityTriggers({ core, timing: 'onTurnStart', ownerPlayerId: '2', baseIndex: 1, now: 1 })!;
    const triggerA = (q1 as any).payload.triggers[0];
    const triggerB = (q2 as any).payload.triggers[0];
    const ms0 = makeMatchState({ ...core, triggerQueue: [triggerA, triggerB] });

    const rq = maybeResolveReactionQueue(ms0, { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any, 1);
    expect(rq).toBeDefined();
    const current = rq!.state.sys.interaction.current as any;
    expect(current?.playerId).toBe('1');

    const staleOption = current.data.options.find((option: any) => String(option.id).includes(triggerA.id));
    expect(staleOption).toBeDefined();

    const staleState = {
      ...rq!.state,
      core: {
        ...rq!.state.core,
        triggerQueue: [triggerB],
      },
      sys: {
        ...rq!.state.sys,
        interaction: {
          current: undefined,
          queue: [],
        },
      },
    } as any;

    const resolved = getInteractionHandler('smashup_reaction_choose')!(
      staleState,
      '1',
      staleOption.value,
      current.data,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      2,
    );

    expect(resolved).toBeDefined();
    expect((resolved!.state.sys.interaction.current as any)?.data?.sourceId).toBe('smashup_reaction_choose');
    expect((resolved!.state.sys.interaction.current as any)?.playerId).toBe('2');
    expect(getSmashUpReactionSession(resolved!.state as any)?.activePlayerId).toBe('2');
    expect((resolved!.state.core.triggerQueue ?? []).map((trigger: any) => trigger.id)).toEqual([triggerB.id]);
  });

  it('optional cycle 中当前响应者若仍有别的 live 选项，点击 stale 旧 trigger 时应刷新并留在当前响应者', () => {
    registerBaseAbility('base_a', 'onTurnStart', () => ({ events: [] }), {
      mandatory: false,
    });
    registerBaseAbility('base_b', 'onTurnStart', () => ({ events: [] }), {
      mandatory: false,
    });
    registerBaseAbility('base_c', 'onTurnStart', () => ({ events: [] }), {
      mandatory: false,
    });

    const core = core3p({
      bases: [makeBase('base_a'), makeBase('base_b'), makeBase('base_c')],
    });
    const q1 = collectBaseAbilityTriggers({ core, timing: 'onTurnStart', ownerPlayerId: '1', baseIndex: 0, now: 1 })!;
    const q2 = collectBaseAbilityTriggers({ core, timing: 'onTurnStart', ownerPlayerId: '2', baseIndex: 1, now: 1 })!;
    const q3 = collectBaseAbilityTriggers({ core, timing: 'onTurnStart', ownerPlayerId: '1', baseIndex: 2, now: 1 })!;
    const triggerA = (q1 as any).payload.triggers[0];
    const triggerB = (q2 as any).payload.triggers[0];
    const triggerC = (q3 as any).payload.triggers[0];
    const ms0 = makeMatchState({ ...core, triggerQueue: [triggerA, triggerB, triggerC] });

    const rq = maybeResolveReactionQueue(ms0, { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any, 1);
    expect(rq).toBeDefined();
    const current = rq!.state.sys.interaction.current as any;
    expect(current?.playerId).toBe('1');

    const staleOption = current.data.options.find((option: any) => String(option.id).includes(triggerA.id));
    expect(staleOption).toBeDefined();

    const staleState = {
      ...rq!.state,
      core: {
        ...rq!.state.core,
        triggerQueue: [triggerB, triggerC],
      },
      sys: {
        ...rq!.state.sys,
        interaction: {
          current: undefined,
          queue: [],
        },
      },
    } as any;

    const resolved = getInteractionHandler('smashup_reaction_choose')!(
      staleState,
      '1',
      staleOption.value,
      current.data,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      2,
    );

    expect(resolved).toBeDefined();
    expect((resolved!.state.sys.interaction.current as any)?.data?.sourceId).toBe('smashup_reaction_choose');
    expect((resolved!.state.sys.interaction.current as any)?.playerId).toBe('1');
    expect(getSmashUpReactionSession(resolved!.state as any)?.activePlayerId).toBe('1');
    const refreshedOptionIds = ((resolved!.state.sys.interaction.current as any)?.data?.options ?? []).map((option: any) => option.id as string);
    expect(refreshedOptionIds.some((id: string) => id.includes(triggerA.id))).toBe(false);
    expect(refreshedOptionIds.some((id: string) => id.includes(triggerC.id))).toBe(true);
    expect((resolved!.state.core.triggerQueue ?? []).map((trigger: any) => trigger.id).sort()).toEqual([triggerB.id, triggerC.id].sort());
  });

  it('base_ninja_dojo 平局冠军时不应先把整条 tied-champion 链暴露成 reaction_choose', () => {
    registerBaseAbilities();

    const core = makeState({
      turnOrder: ['0', '1', '2'],
      currentPlayerIndex: 0,
      bases: [
        makeBase('base_ninja_dojo', [
          { uid: 'dojo-p0', defId: 'test_minion', controller: '0', owner: '0', basePower: 10, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, playedThisTurn: false, attachedActions: [] },
          { uid: 'dojo-p1', defId: 'test_minion', controller: '1', owner: '1', basePower: 10, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, playedThisTurn: false, attachedActions: [] },
          { uid: 'dojo-p2', defId: 'test_minion', controller: '2', owner: '2', basePower: 1, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, playedThisTurn: false, attachedActions: [] },
        ]),
        makeBase('base_other', [
          { uid: 'other-p2', defId: 'test_minion', controller: '2', owner: '2', basePower: 3, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, playedThisTurn: false, attachedActions: [] },
        ]),
      ],
    });

    const queued = collectBaseAbilityTriggers({
      core,
      timing: 'afterScoring',
      ownerPlayerId: '0',
      baseIndex: 0,
      rankings: [
        { playerId: '0', power: 10, vp: 4 },
        { playerId: '1', power: 10, vp: 4 },
        { playerId: '2', power: 1, vp: 2 },
      ],
      now: 1,
    });

    expect(queued).toBeDefined();
    expect((queued as any).payload.triggers[0].mandatory).toBe(true);

    const resolved = maybeResolveReactionQueue(
      makeMatchState({
        ...core,
        triggerQueue: [...(queued as any).payload.triggers],
      }),
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      1,
    );

    const current = resolved?.state.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('base_ninja_dojo');
    expect(current?.playerId).toBe('0');
    expect(current?.data?.options?.some((option: any) => option.value?.minionUid === 'dojo-p2')).toBe(true);
    expect((resolved?.state.sys.interaction.queue ?? [])[0]?.playerId).toBe('1');
  });
});

