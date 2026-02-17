/**
 * 外星人派系审计修复回归测试
 *
 * 覆盖卡牌 ID 更新后的能力验证：
 * 1) alien_disintegrator: 放到拥有者牌库底
 * 2) alien_beam_up: 返回随从到手牌
 * 3) alien_crop_circles: 任意数量随从（多步）
 * 4) alien_terraform: 三步替换基地并在新基地额外打随从
 * 5) alien_abduction: 返回随从 + 额外随从
 * 6) alien_invasion: 移动随从到另一个基地
 */
 

import { beforeAll, describe, expect, it } from 'vitest';
import type { MatchState, RandomFn } from '../../../engine/types';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers, getInteractionHandler } from '../domain/abilityInteractionHandlers';
import type { BaseInPlay, CardInstance, MinionOnBase, PlayerState, SmashUpCore } from '../domain/types';
import { makeMatchState as makeMatchStateFromHelpers } from './helpers';
import { runCommand } from './testRunner';

function makeCard(uid: string, defId: string, type: 'minion' | 'action', owner: string): CardInstance {
  return { uid, defId, type, owner };
}

function makeMinion(uid: string, defId: string, controller: string, power: number, owner?: string): MinionOnBase {
  return {
    uid, defId, controller, owner: owner ?? controller,
    basePower: power, powerModifier: 0, talentUsed: false, attachedActions: [],
  };
}

function makePlayer(id: string, overrides?: Partial<PlayerState>): PlayerState {
  return {
    id, vp: 0, hand: [], deck: [], discard: [],
    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
    factions: ['aliens', 'pirates'] as [string, string],
    ...overrides,
  };
}

function makeBase(defId: string, minions: MinionOnBase[] = []): BaseInPlay {
  return { defId, minions, ongoingActions: [] };
}

function makeState(overrides?: Partial<SmashUpCore>): SmashUpCore {
  return {
    players: { '0': makePlayer('0'), '1': makePlayer('1') },
    turnOrder: ['0', '1'], currentPlayerIndex: 0,
    bases: [], baseDeck: [], turnNumber: 1, nextUid: 100,
    ...overrides,
  };
}

function makeMatchState(core: SmashUpCore): MatchState<SmashUpCore> {
  return makeMatchStateFromHelpers(core);
}

const dummyRandom: RandomFn = {
  random: () => 0.5,
  d: (max: number) => Math.max(1, Math.floor(max / 2)),
  range: (min: number, max: number) => Math.floor((min + max) / 2),
  shuffle: (arr: any[]) => [...arr],
};

function execPlayAction(state: SmashUpCore, playerId: string, cardUid: string, targetBaseIndex?: number) {
  const ms = makeMatchState(state);
  const result = runCommand(ms, {
    type: SU_COMMANDS.PLAY_ACTION,
    playerId,
    payload: { cardUid, targetBaseIndex },
  } as any, dummyRandom);
  return { events: result.events, matchState: result.finalState };
}

beforeAll(() => {
  clearRegistry();
  clearBaseAbilityRegistry();
  clearInteractionHandlers();
  resetAbilityInit();
  initAllAbilities();
});

describe('Aliens 审计修复回归（新 ID）', () => {
  it('alien_disintegrator: 结算为 CARD_TO_DECK_BOTTOM', () => {
    const handler = getInteractionHandler('alien_disintegrator');
    expect(handler).toBeDefined();
    const core = makeState({
      bases: [makeBase('base_old', [makeMinion('m1', 'minion_a', '0', 2)])],
    });
    const result = handler!(makeMatchState(core), '0', { minionUid: 'm1', baseIndex: 0 }, undefined, dummyRandom, 1000);
    expect(result).toBeDefined();
    expect(result!.events).toHaveLength(1);
    expect(result!.events[0].type).toBe(SU_EVENTS.CARD_TO_DECK_BOTTOM);
    expect((result!.events[0] as any).payload).toMatchObject({
      cardUid: 'm1', ownerId: '0', reason: 'alien_disintegrator',
    });
  });

  it('alien_beam_up: 创建随从选择交互并返回手牌', () => {
    const state = makeState({
      players: {
        '0': makePlayer('0', { hand: [makeCard('a1', 'alien_beam_up', 'action', '0')] }),
        '1': makePlayer('1'),
      },
      bases: [
        makeBase('base_old', [makeMinion('m1', 'minion_a', '0', 3)]),
        makeBase('base_new', [makeMinion('m2', 'minion_b', '1', 2)]),
      ],
    });
    const { matchState } = execPlayAction(state, '0', 'a1');
    const current = (matchState.sys as any).interaction?.current;
    expect(current?.data?.sourceId).toBe('alien_beam_up');

    const handler = getInteractionHandler('alien_beam_up');
    expect(handler).toBeDefined();
    const resolved = handler!(makeMatchState(state), '0', { minionUid: 'm2', baseIndex: 1 }, undefined, dummyRandom, 1001);
    expect(resolved).toBeDefined();
    expect(resolved!.events).toHaveLength(1);
    expect(resolved!.events[0].type).toBe(SU_EVENTS.MINION_RETURNED);
    expect((resolved!.events[0] as any).payload.reason).toBe('alien_beam_up');
  });

  it('alien_crop_circles: 选择基地后自动返回所有随从（强制效果）', () => {
    const core = makeState({
      bases: [makeBase('base_old', [
        makeMinion('m1', 'minion_a', '0', 3),
        makeMinion('m2', 'minion_b', '1', 2),
      ])],
    });

    const handler = getInteractionHandler('alien_crop_circles');
    expect(handler).toBeDefined();
    
    // 选择基地后，直接返回该基地所有随从
    const result = handler!(makeMatchState(core), '0', { baseIndex: 0 }, undefined, dummyRandom, 2000);
    expect(result).toBeDefined();
    
    // 应该产生 2 个 MINION_RETURNED 事件（基地上有 2 个随从）
    const returned = result!.events.filter(e => e.type === SU_EVENTS.MINION_RETURNED);
    expect(returned).toHaveLength(2);
    
    // 验证两个随从都被返回
    const returnedUids = returned.map(e => (e as any).payload.minionUid);
    expect(returnedUids).toContain('m1');
    expect(returnedUids).toContain('m2');
  });

  it('alien_terraform: 三步交互替换基地并仅能在新基地额外打随从', () => {
    const core = makeState({
      players: {
        '0': makePlayer('0', { hand: [makeCard('h1', 'alien_invader', 'minion', '0')] }),
        '1': makePlayer('1'),
      },
      bases: [makeBase('base_old', [makeMinion('m1', 'minion_a', '0', 3)])],
      baseDeck: ['base_new', 'base_alt'],
    });

    const handler1 = getInteractionHandler('alien_terraform');
    expect(handler1).toBeDefined();
    const step1 = handler1!(makeMatchState(core), '0', { baseIndex: 0 }, undefined, dummyRandom, 3000);
    expect(step1).toBeDefined();
    const step1Current = (step1!.state.sys as any).interaction?.current;
    expect(step1Current?.data?.sourceId).toBe('alien_terraform_choose_replacement');

    const handler2 = getInteractionHandler('alien_terraform_choose_replacement');
    expect(handler2).toBeDefined();
    const step2 = handler2!(
      makeMatchState(core),
      '0',
      { newBaseDefId: 'base_new' },
      step1Current?.data,
      dummyRandom,
      3001,
    );
    expect(step2).toBeDefined();
    const replaced = step2!.events.find(e => e.type === SU_EVENTS.BASE_REPLACED);
    expect(replaced).toBeDefined();
    expect((replaced as any).payload).toMatchObject({
      baseIndex: 0,
      oldBaseDefId: 'base_old',
      newBaseDefId: 'base_new',
      keepCards: true,
    });

    const step2Current = (step2!.state.sys as any).interaction?.current;
    expect(step2Current?.data?.sourceId).toBe('alien_terraform_play_minion');

    const handler3 = getInteractionHandler('alien_terraform_play_minion');
    expect(handler3).toBeDefined();
    const step3 = handler3!(
      makeMatchState(core),
      '0',
      { cardUid: 'h1', defId: 'alien_invader' },
      step2Current?.data,
      dummyRandom,
      3002,
    );
    expect(step3).toBeDefined();
    const minionPlayed = step3!.events.find(e => e.type === SU_EVENTS.MINION_PLAYED);
    expect(minionPlayed).toBeDefined();
    expect((minionPlayed as any).payload.baseIndex).toBe(0);

    const extraMinion = step3!.events.find(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
    expect(extraMinion).toBeDefined();
    expect((extraMinion as any).payload).toMatchObject({
      playerId: '0',
      limitType: 'minion',
      delta: 1,
      reason: 'alien_terraform',
    });
  });

  it('alien_terraform: 第三步选择跳过时不产生额外随从事件', () => {
    const core = makeState({
      players: {
        '0': makePlayer('0', { hand: [makeCard('h1', 'alien_invader', 'minion', '0')] }),
        '1': makePlayer('1'),
      },
      bases: [makeBase('base_old', [makeMinion('m1', 'minion_a', '0', 3)])],
      baseDeck: ['base_new', 'base_alt'],
    });

    const handler1 = getInteractionHandler('alien_terraform');
    const handler2 = getInteractionHandler('alien_terraform_choose_replacement');
    const handler3 = getInteractionHandler('alien_terraform_play_minion');
    expect(handler1).toBeDefined();
    expect(handler2).toBeDefined();
    expect(handler3).toBeDefined();

    const step1 = handler1!(makeMatchState(core), '0', { baseIndex: 0 }, undefined, dummyRandom, 3010);
    const step1Current = (step1!.state.sys as any).interaction?.current;
    const step2 = handler2!(
      makeMatchState(core),
      '0',
      { newBaseDefId: 'base_new' },
      step1Current?.data,
      dummyRandom,
      3011,
    );
    const step2Current = (step2!.state.sys as any).interaction?.current;

    const step3 = handler3!(
      makeMatchState(core),
      '0',
      { skip: true },
      step2Current?.data,
      dummyRandom,
      3012,
    );
    expect(step3).toBeDefined();
    expect(step3!.events).toEqual([]);
  });

  it('alien_abduction: 返回随从 + 额外随从额度', () => {
    const core = makeState({
      bases: [makeBase('base_old', [makeMinion('m1', 'minion_a', '1', 3)])],
    });
    const handler = getInteractionHandler('alien_abduction');
    expect(handler).toBeDefined();
    const result = handler!(makeMatchState(core), '0', { minionUid: 'm1', baseIndex: 0 }, undefined, dummyRandom, 4000);
    expect(result).toBeDefined();
    expect(result!.events).toHaveLength(2);
    expect(result!.events[0].type).toBe(SU_EVENTS.MINION_RETURNED);
    expect(result!.events[1].type).toBe(SU_EVENTS.LIMIT_MODIFIED);
  });

  it('alien_invasion: 两步交互移动随从', () => {
    const core = makeState({
      bases: [
        makeBase('base_a', [makeMinion('m1', 'minion_a', '0', 3)]),
        makeBase('base_b', []),
      ],
    });
    // 第一步：选择随从
    const handler1 = getInteractionHandler('alien_invasion_choose_minion');
    expect(handler1).toBeDefined();
    const step1 = handler1!(makeMatchState(core), '0', { minionUid: 'm1', baseIndex: 0 }, undefined, dummyRandom, 5000);
    expect(step1).toBeDefined();
    const step1Current = (step1!.state.sys as any).interaction?.current;
    expect(step1Current?.data?.sourceId).toBe('alien_invasion_choose_base');

    // 第二步：选择目标基地
    const handler2 = getInteractionHandler('alien_invasion_choose_base');
    expect(handler2).toBeDefined();
    const step2 = handler2!(
      makeMatchState(core), '0', { baseIndex: 1 },
      step1Current?.data, dummyRandom, 5001,
    );
    expect(step2).toBeDefined();
    expect(step2!.events).toHaveLength(1);
    expect(step2!.events[0].type).toBe(SU_EVENTS.MINION_MOVED);
  });
});
