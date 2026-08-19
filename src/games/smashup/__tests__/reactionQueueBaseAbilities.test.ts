import { describe, it, expect, beforeEach } from 'vitest';
import type { SmashUpCore, SmashUpEvent, TriggerInstance } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import {
  expectNoPrompt,
  getPromptOption,
  getPromptOptions,
  getPromptSourceId,
  getReactionPrompt,
  getSimpleChoicePrompt,
  makeMatchState,
  makeState,
  makeBase,
  makeMinion,
  respondToPromptOption,
} from './helpers';
import { clearBaseAbilityRegistry, registerBaseAbility, registerExtended } from '../domain/baseAbilities';
import { registerReactionQueueInteractionHandlers } from '../domain/reactionQueueHandlers';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { collectBaseAbilityTriggers, collectExtendedBaseAbilityTriggers } from '../domain/baseAbilityQueue';
import { clearOngoingEffectRegistry, registerTrigger } from '../domain/ongoingEffects';
import { postProcessSystemEvents } from '../domain';
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
    const current = getReactionPrompt(ms1);

    // Pick base_b first
    const optB = getPromptOption(
      current,
      (option: any) => (option.label as string).includes('base_b'),
      'reaction option for base_b',
    );
    const r2 = respondToPromptOption(
      ms1,
      (option: any) => option.id === optB.id,
      'reaction option for base_b',
      '0',
      { shuffle: (a: any[]) => a } as any,
    );
    expect(r2.success).toBe(true);
    expect(r2.error).toBeUndefined();
    expect(r2).toBeDefined();
    const evts = r2.events as SmashUpEvent[];
    expect(evts.some(e => e.type === SU_EVENTS.TRIGGER_CONSUMED)).toBe(true);
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
    expectNoPrompt(result.matchState!);
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

    const current = getReactionPrompt(result.matchState!);
    expect(getPromptOptions(current).some((option: any) => String(option.label).includes('base_a'))).toBe(true);
    expect(getPromptOptions(current).some((option: any) => String(option.label).includes('test_action_watcher'))).toBe(true);
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
    const prompt = getSimpleChoicePrompt(rq!.state, 'base_a_prompt');
    expect(getPromptSourceId(prompt)).not.toBe('smashup_reaction_choose');
  });
});

