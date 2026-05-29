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
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import type { BaseInPlay, CardInstance, MinionOnBase, PlayerState, SmashUpCore, TitanState } from '../domain/types';
import { ALIEN_ACTIONS } from '../data/factions/aliens';
import { ALIEN_POD_ACTIONS } from '../data/factions/aliens_pod';
import { actionLikeNeedsPlayBase, actionLikeNeedsPlayMinion, buildDeck } from '../domain/utils';
import { makeMatchState as makeMatchStateFromHelpers } from './helpers';
import { runCommand } from './testRunner';

function makeCard(uid: string, defId: string, type: 'minion' | 'action', owner: string): CardInstance {
  return { uid, defId, type, owner };
}

function makeMinion(
  uid: string,
  defId: string,
  controller: string,
  power: number,
  ownerOrOverrides?: string | Partial<MinionOnBase>,
): MinionOnBase {
  const overrides = typeof ownerOrOverrides === 'string'
    ? {}
    : ownerOrOverrides ?? {};
  return {
    uid,
    defId,
    controller,
    owner: typeof ownerOrOverrides === 'string' ? ownerOrOverrides : controller,
    basePower: power, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [],
    ...overrides,
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

function execPlayAction(
  state: SmashUpCore,
  playerId: string,
  cardUid: string,
  targetBaseIndex?: number,
  targetMinionUid?: string,
) {
  const ms = makeMatchState(state);
  const result = runCommand(ms, {
    type: SU_COMMANDS.PLAY_ACTION,
    playerId,
    payload: { cardUid, targetBaseIndex, targetMinionUid },
  } as any, dummyRandom);
  return { events: result.events, matchState: result.finalState };
}

function respondInteraction(matchState: MatchState<SmashUpCore>, playerId: string, optionId: string) {
  return runCommand(matchState, {
    type: 'SYS_INTERACTION_RESPOND',
    playerId,
    payload: { optionId },
  } as any, dummyRandom);
}

beforeAll(() => {
  clearRegistry();
  clearBaseAbilityRegistry();
  clearInteractionHandlers();
  resetAbilityInit();
  initAllAbilities();
});

describe('Aliens 审计修复回归（新 ID）', () => {
  it('D8: 外星人目标型行动卡应声明 playNeedsBase/playNeedsMinion，确保 Board 进入直点模式', () => {
    expect(ALIEN_ACTIONS.find(card => card.id === 'alien_terraform')?.playNeedsBase).toBe(true);
    expect(ALIEN_ACTIONS.find(card => card.id === 'alien_invasion')?.playNeedsMinion).toBe(true);
    expect(ALIEN_ACTIONS.find(card => card.id === 'alien_disintegrator')?.playNeedsMinion).toBe(true);
    expect(ALIEN_ACTIONS.find(card => card.id === 'alien_beam_up')?.playNeedsMinion).toBe(true);
    expect(ALIEN_ACTIONS.find(card => card.id === 'alien_abduction')?.playNeedsMinion).toBe(true);

    expect(ALIEN_POD_ACTIONS.find(card => card.id === 'alien_terraform_pod')?.playNeedsBase).toBe(true);
    expect(ALIEN_POD_ACTIONS.find(card => card.id === 'alien_invasion_pod')?.playNeedsMinion).toBe(true);
    expect(ALIEN_POD_ACTIONS.find(card => card.id === 'alien_disintegrator_pod')?.playNeedsMinion).toBe(true);
    expect(ALIEN_POD_ACTIONS.find(card => card.id === 'alien_beam_up_pod')?.playNeedsMinion).toBe(true);
    expect(ALIEN_POD_ACTIONS.find(card => card.id === 'alien_abduction_pod')?.playNeedsMinion).toBe(true);
  });

  it('D8: minion 目标行动卡不能再被误判成 base 目标模式', () => {
    const invasion = ALIEN_ACTIONS.find(card => card.id === 'alien_invasion');
    const disintegrator = ALIEN_ACTIONS.find(card => card.id === 'alien_disintegrator');
    const beamUp = ALIEN_ACTIONS.find(card => card.id === 'alien_beam_up');
    const abduction = ALIEN_ACTIONS.find(card => card.id === 'alien_abduction');

    for (const card of [invasion, disintegrator, beamUp, abduction]) {
      expect(card).toBeTruthy();
      expect(actionLikeNeedsPlayMinion(card!)).toBe(true);
      expect(actionLikeNeedsPlayBase(card!)).toBe(false);
    }
  });

  it('D8: 外星人关键行动卡数量应锁定为反馈口径（麦田怪圈=1，分解者=2，光束捕捉=2）', () => {
    const actionCount = (id: string) => ALIEN_ACTIONS.find(card => card.id === id)?.count;
    expect(actionCount('alien_crop_circles')).toBe(1);
    expect(actionCount('alien_disintegrator')).toBe(2);
    expect(actionCount('alien_beam_up')).toBe(2);

    const { deck } = buildDeck(['aliens', 'pirates'], '0', 0, dummyRandom);
    const deckCount = (defId: string) => deck.filter(card => card.defId === defId).length;
    expect(deckCount('alien_crop_circles')).toBe(1);
    expect(deckCount('alien_disintegrator')).toBe(2);
    expect(deckCount('alien_beam_up')).toBe(2);
  });

  it('alien_disintegrator: 结算为 CARD_TO_DECK_BOTTOM', () => {
    const core = makeState({
      players: {
        '0': makePlayer('0', { hand: [makeCard('a1', 'alien_disintegrator', 'action', '0')] }),
        '1': makePlayer('1'),
      },
      bases: [makeBase('base_old', [makeMinion('m1', 'minion_a', '0', 2, { powerModifier: 0 })])],
    });
    const result = execPlayAction(core, '0', 'a1', 0, 'm1');
    expect(result.events).toHaveLength(2);
    const resolved = result.events.find(event => event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM);
    expect(resolved).toBeDefined();
    expect((resolved as any).payload).toMatchObject({
      cardUid: 'm1', ownerId: '0', reason: 'alien_disintegrator',
    });
  });

  it('alien_beam_up: 直点目标随从打出后直接返回手牌', () => {
    const state = makeState({
      players: {
        '0': makePlayer('0', { hand: [makeCard('a1', 'alien_beam_up', 'action', '0')] }),
        '1': makePlayer('1'),
      },
      bases: [
        makeBase('base_old', [makeMinion('m1', 'minion_a', '0', 3, { powerModifier: 0 })]),
        makeBase('base_new', [makeMinion('m2', 'minion_b', '1', 2, { powerModifier: 0 })]),
      ],
    });
    const played = execPlayAction(state, '0', 'a1', 1, 'm2');
    expect((played.matchState.sys as any).interaction?.current).toBeUndefined();
    const returned = played.events.find(event => event.type === SU_EVENTS.MINION_RETURNED);
    expect(returned).toBeDefined();
    expect((returned as any).payload).toMatchObject({
      minionUid: 'm2',
      fromBaseIndex: 1,
      reason: 'alien_beam_up',
    });
  });

  it('alien_crop_circles: 选择基地后自动返回所有随从（强制效果）', () => {
    const core = makeState({
      players: {
        '0': makePlayer('0', { hand: [makeCard('a1', 'alien_crop_circles', 'action', '0')] }),
        '1': makePlayer('1'),
      },
      bases: [makeBase('base_old', [
        makeMinion('m1', 'minion_a', '0', 3, { powerModifier: 0 }),
        makeMinion('m2', 'minion_b', '1', 2),
      ])],
    });
    const played = execPlayAction(core, '0', 'a1');
    const current = (played.matchState.sys as any).interaction?.current;
    expect(current?.data?.sourceId).toBe('alien_crop_circles');
    const baseOption = current?.data?.options?.find((entry: any) => entry.value?.baseIndex === 0);
    expect(baseOption).toBeDefined();
    const result = respondInteraction(played.matchState, '0', baseOption.id);

    const returned = result.events.filter(e => e.type === SU_EVENTS.MINION_RETURNED);
    expect(returned).toHaveLength(2);
    
    // 验证两个随从都被返回
    const returnedUids = returned.map(e => (e as any).payload.minionUid);
    expect(returnedUids).toContain('m1');
    expect(returnedUids).toContain('m2');
  });

  it('alien_terraform: 三步交互替换基地并仅能在新基地额外打随从', () => {
    const core = makeState({
      players: {
        '0': makePlayer('0', { hand: [makeCard('tf1', 'alien_terraform', 'action', '0'), makeCard('h1', 'alien_invader', 'minion', '0')] }),
        '1': makePlayer('1'),
      },
      bases: [makeBase('base_old', [makeMinion('m1', 'minion_a', '0', 3, { powerModifier: 0 })])],
      baseDeck: ['base_new', 'base_alt'],
    });

    const played = execPlayAction(core, '0', 'tf1', 0);
    const step1Current = (played.matchState.sys as any).interaction?.current;
    expect(step1Current?.data?.sourceId).toBe('alien_terraform_choose_replacement');
    const replacementOption = step1Current?.data?.options?.find((entry: any) => entry.value?.newBaseDefId === 'base_new');
    expect(replacementOption).toBeDefined();

    const step2 = respondInteraction(played.matchState, '0', replacementOption.id);
    const replaced = step2.events.find(e => e.type === SU_EVENTS.BASE_REPLACED);
    expect(replaced).toBeDefined();
    expect((replaced as any).payload).toMatchObject({
      baseIndex: 0,
      oldBaseDefId: 'base_old',
      newBaseDefId: 'base_new',
      keepCards: true,
    });

    const step2Current = (step2.finalState.sys as any).interaction?.current;
    expect(step2Current?.data?.sourceId).toBe('alien_terraform_play_minion');
    const minionOption = step2Current?.data?.options?.find((entry: any) => entry.value?.cardUid === 'h1');
    expect(minionOption).toBeDefined();

    const step3 = respondInteraction(step2.finalState, '0', minionOption.id);
    const minionPlayed = step3.events.find(e => e.type === SU_EVENTS.MINION_PLAYED);
    expect(minionPlayed).toBeDefined();
    expect((minionPlayed as any).payload.baseIndex).toBe(0);

    const extraMinion = step3.events.find(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
    expect(extraMinion).toBeDefined();
    expect((extraMinion as any).payload).toMatchObject({
      playerId: '0',
      limitType: 'minion',
      delta: 1,
      reason: 'alien_terraform',
    });
  });

  it('alien_terraform: 第三步额外打出借来的手牌随从时应保留真实 owner', () => {
    const core = makeState({
      players: {
        '0': makePlayer('0', { hand: [makeCard('tf1', 'alien_terraform', 'action', '0'), makeCard('borrowed', 'alien_invader', 'minion', '1')] }),
        '1': makePlayer('1'),
      },
      bases: [makeBase('base_old', [makeMinion('m1', 'minion_a', '0', 3, { powerModifier: 0 })])],
      baseDeck: ['base_new', 'base_alt'],
    });

    const played = execPlayAction(core, '0', 'tf1', 0);
    const step1Current = (played.matchState.sys as any).interaction?.current;
    const replacementOption = step1Current?.data?.options?.find((entry: any) => entry.value?.newBaseDefId === 'base_new');
    expect(replacementOption).toBeDefined();

    const step2 = respondInteraction(played.matchState, '0', replacementOption.id);
    const step2Current = (step2.finalState.sys as any).interaction?.current;
    const minionOption = step2Current?.data?.options?.find((entry: any) => entry.value?.cardUid === 'borrowed');
    expect(minionOption).toBeDefined();

    const step3 = respondInteraction(step2.finalState, '0', minionOption.id);
    const minionPlayed = step3.events.find(e => e.type === SU_EVENTS.MINION_PLAYED);
    expect((minionPlayed as any)?.payload).toMatchObject({
      playerId: '0',
      cardUid: 'borrowed',
      defId: 'alien_invader',
      ownerId: '1',
      baseIndex: 0,
      reason: 'alien_terraform',
    });
    expect(step3.finalState.core.bases[0]?.minions.find(minion => minion.uid === 'borrowed')).toMatchObject({
      controller: '0',
      owner: '1',
    });
  });

  it('alien_terraform: 第三步允许选择可视作随从打出的 set-aside 泰坦', () => {
    const tricksterTitan: TitanState = {
      uid: 't1',
      defId: 'tricksters_big_funny_giant',
      faction: 'tricksters',
      ownerId: '0',
      controllerId: '0',
      powerCounters: 0,
      talentUsed: false,
      location: { zone: 'setaside' },
    };
    const core = makeState({
      players: {
        '0': makePlayer('0', { hand: [makeCard('tf1', 'alien_terraform', 'action', '0'), makeCard('h1', 'alien_invader', 'minion', '0')] }),
        '1': makePlayer('1'),
      },
      titans: [tricksterTitan],
      bases: [makeBase('base_old', [makeMinion('m1', 'minion_a', '0', 3, { powerModifier: 0 })])],
      baseDeck: ['base_new', 'base_alt'],
    });

    const played = execPlayAction(core, '0', 'tf1', 0);
    const step1Current = (played.matchState.sys as any).interaction?.current;
    const replacementOption = step1Current?.data?.options?.find((entry: any) => entry.value?.newBaseDefId === 'base_new');
    expect(replacementOption).toBeDefined();
    const step2 = respondInteraction(played.matchState, '0', replacementOption.id);
    const step2Current = (step2.finalState.sys as any).interaction?.current;
    const titanOption = step2Current?.data?.options?.find((opt: any) => opt.value?.titanUid === 't1');
    expect(titanOption).toBeDefined();
    expect(titanOption.value).toMatchObject({
      titanUid: 't1',
      defId: 'tricksters_big_funny_giant',
      playKind: 'minion',
    });

    const step3 = respondInteraction(step2.finalState, '0', titanOption.id);
    const titanPlayed = step3.events.find(e => e.type === SU_EVENTS.TITAN_PLAYED);
    expect(titanPlayed).toBeDefined();
    expect((titanPlayed as any).payload).toMatchObject({
      titanUid: 't1',
      defId: 'tricksters_big_funny_giant',
      controllerId: '0',
      baseIndex: 0,
      baseDefId: 'base_new',
      reason: 'alien_terraform',
    });
  });

  it('alien_terraform: 第三步应允许当前控制者打出 borrowed set-aside 泰坦', () => {
    const borrowedTitan: TitanState = {
      uid: 'borrowed-titan',
      defId: 'tricksters_big_funny_giant',
      faction: 'tricksters',
      ownerId: '1',
      controllerId: '0',
      powerCounters: 0,
      talentUsed: false,
      location: { zone: 'setaside' },
    };
    const core = makeState({
      players: {
        '0': makePlayer('0', { hand: [makeCard('tf1', 'alien_terraform', 'action', '0'), makeCard('h1', 'alien_invader', 'minion', '0')] }),
        '1': makePlayer('1'),
      },
      titans: [borrowedTitan],
      bases: [makeBase('base_old', [makeMinion('m1', 'minion_a', '0', 3, { powerModifier: 0 })])],
      baseDeck: ['base_new', 'base_alt'],
    });

    const played = execPlayAction(core, '0', 'tf1', 0);
    const step1Current = (played.matchState.sys as any).interaction?.current;
    const replacementOption = step1Current?.data?.options?.find((entry: any) => entry.value?.newBaseDefId === 'base_new');
    expect(replacementOption).toBeDefined();

    const step2 = respondInteraction(played.matchState, '0', replacementOption.id);
    const step2Current = (step2.finalState.sys as any).interaction?.current;
    const titanOption = step2Current?.data?.options?.find((opt: any) => opt.value?.titanUid === 'borrowed-titan');
    expect(titanOption).toBeDefined();

    const step3 = respondInteraction(step2.finalState, '0', titanOption.id);
    const titanPlayed = step3.events.find(e => e.type === SU_EVENTS.TITAN_PLAYED);
    expect(titanPlayed).toBeDefined();
    expect((titanPlayed as any).payload).toMatchObject({
      titanUid: 'borrowed-titan',
      defId: 'tricksters_big_funny_giant',
      ownerId: '1',
      controllerId: '0',
      baseIndex: 0,
      baseDefId: 'base_new',
      reason: 'alien_terraform',
    });
    expect((step3.finalState.core.titans ?? []).find(titan => titan.uid === 'borrowed-titan')).toMatchObject({
      ownerId: '1',
      controllerId: '0',
      location: { zone: 'base', baseIndex: 0 },
    });
  });

  it('alien_terraform: 第三步选择跳过时不产生额外随从事件', () => {
    const core = makeState({
      players: {
        '0': makePlayer('0', { hand: [makeCard('tf1', 'alien_terraform', 'action', '0'), makeCard('h1', 'alien_invader', 'minion', '0')] }),
        '1': makePlayer('1'),
      },
      bases: [makeBase('base_old', [makeMinion('m1', 'minion_a', '0', 3, { powerModifier: 0 })])],
      baseDeck: ['base_new', 'base_alt'],
    });

    const played = execPlayAction(core, '0', 'tf1', 0);
    const step1Current = (played.matchState.sys as any).interaction?.current;
    const replacementOption = step1Current?.data?.options?.find((entry: any) => entry.value?.newBaseDefId === 'base_new');
    expect(replacementOption).toBeDefined();
    const step2 = respondInteraction(played.matchState, '0', replacementOption.id);
    const step2Current = (step2.finalState.sys as any).interaction?.current;
    const skipOption = step2Current?.data?.options?.find((entry: any) => entry.value?.skip === true);
    expect(skipOption).toBeDefined();

    const step3 = respondInteraction(step2.finalState, '0', skipOption.id);
    const domainEvents = step3.events.filter(event => !String(event.type).startsWith('SYS_'));
    expect(domainEvents).toEqual([]);
  });

  it('alien_abduction: 返回随从 + 额外随从额度', () => {
    const core = makeState({
      players: {
        '0': makePlayer('0', { hand: [makeCard('a1', 'alien_abduction', 'action', '0')] }),
        '1': makePlayer('1'),
      },
      bases: [makeBase('base_old', [makeMinion('m1', 'minion_a', '1', 3, { powerModifier: 0 })])],
    });
    const result = execPlayAction(core, '0', 'a1', 0, 'm1');
    expect(result.events).toHaveLength(3);
    expect(result.events.find(event => event.type === SU_EVENTS.MINION_RETURNED)).toBeDefined();
    expect(result.events.find(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toBeDefined();
  });

  it('alien_invasion: 直点目标后进入选基地并移动随从', () => {
    const core = makeState({
      players: {
        '0': makePlayer('0', { hand: [makeCard('inv1', 'alien_invasion', 'action', '0')] }),
        '1': makePlayer('1'),
      },
      bases: [
        makeBase('base_a', [makeMinion('m1', 'minion_a', '0', 3)]),
        makeBase('base_b', []),
      ],
    });
    const played = execPlayAction(core, '0', 'inv1', 0, 'm1');
    const current = (played.matchState.sys as any).interaction?.current;
    expect(current?.data?.sourceId).toBe('alien_invasion_choose_base');
    const baseOption = current?.data?.options?.find((entry: any) => entry.value?.baseIndex === 1);
    expect(baseOption).toBeDefined();
    const step2 = respondInteraction(played.matchState, '0', baseOption.id);
    const moved = step2.events.find(event => event.type === SU_EVENTS.MINION_MOVED);
    expect(moved).toBeDefined();
    expect((moved as any).payload).toMatchObject({
      minionUid: 'm1',
      fromBaseIndex: 0,
      toBaseIndex: 1,
    });
  });

  it('alien_invasion: 直点随从打出时应直接进入选基地第二步', () => {
    const core = makeState({
      players: {
        '0': makePlayer('0', {
          hand: [makeCard('inv1', 'alien_invasion', 'action', '0')],
          factions: ['aliens', 'pirates'] as [string, string],
        }),
        '1': makePlayer('1'),
      },
      bases: [
        makeBase('base_a', [makeMinion('m1', 'minion_a', '0', 3)]),
        makeBase('base_b', []),
      ],
    });

    const result = runCommand(
      makeMatchState(core),
      {
        type: SU_COMMANDS.PLAY_ACTION,
        playerId: '0',
        payload: { cardUid: 'inv1', targetBaseIndex: 0, targetMinionUid: 'm1' },
      },
      dummyRandom,
    );

    expect(result.success).toBe(true);
    expect((result.finalState.sys.interaction?.current?.data as any)?.sourceId).toBe('alien_invasion_choose_base');
  });

  it('alien_invasion: 第二步若目标已离开来源基地则不再移动', () => {
    const core = makeState({
      players: {
        '0': makePlayer('0', { hand: [makeCard('inv1', 'alien_invasion', 'action', '0')] }),
        '1': makePlayer('1'),
      },
      bases: [
        makeBase('base_a', [makeMinion('m1', 'minion_a', '0', 3)]),
        makeBase('base_b', []),
      ],
    });

    const played = execPlayAction(core, '0', 'inv1', 0, 'm1');
    const step1Current = (played.matchState.sys as any).interaction?.current;
    expect(step1Current?.data?.sourceId).toBe('alien_invasion_choose_base');

    const staleCore = makeState({
      ...core,
      players: {
        ...core.players,
        '0': makePlayer('0', {
          ...core.players['0'],
          discard: [makeCard('m1', 'minion_a', 'minion', '0')],
        }),
      },
      bases: [
        makeBase('base_a', []),
        makeBase('base_b', []),
      ],
    });

    const staleState: MatchState<SmashUpCore> = {
      core: staleCore,
      sys: {
        ...played.matchState.sys,
        interaction: {
          ...((played.matchState.sys as any).interaction),
          current: step1Current,
        },
      } as any,
    };
    const baseOption = step1Current?.data?.options?.find((entry: any) => entry.value?.baseIndex === 1);
    expect(baseOption).toBeDefined();
    const step2 = respondInteraction(staleState, '0', baseOption.id);
    const domainEvents = step2.events.filter(event => !String(event.type).startsWith('SYS_'));
    expect(domainEvents).toHaveLength(0);
  });

  it('alien_invasion: 第二步若目标基地已不存在则不再移动', () => {
    const core = makeState({
      players: {
        '0': makePlayer('0', { hand: [makeCard('inv1', 'alien_invasion', 'action', '0')] }),
        '1': makePlayer('1'),
      },
      bases: [
        makeBase('base_a', [makeMinion('m1', 'minion_a', '0', 3)]),
        makeBase('base_b', []),
      ],
    });

    const played = execPlayAction(core, '0', 'inv1', 0, 'm1');
    const step1Current = (played.matchState.sys as any).interaction?.current;
    expect(step1Current?.data?.sourceId).toBe('alien_invasion_choose_base');

    const staleCore = makeState({
      ...core,
      bases: [makeBase('base_a', [makeMinion('m1', 'minion_a', '0', 3)])],
    });

    const staleState: MatchState<SmashUpCore> = {
      core: staleCore,
      sys: {
        ...played.matchState.sys,
        interaction: {
          ...((played.matchState.sys as any).interaction),
          current: step1Current,
        },
      } as any,
    };
    const baseOption = step1Current?.data?.options?.find((entry: any) => entry.value?.baseIndex === 1);
    expect(baseOption).toBeDefined();
    const step2 = respondInteraction(staleState, '0', baseOption.id);

    const domainEvents = step2.events.filter(event => !String(event.type).startsWith('SYS_'));
    expect(domainEvents).toHaveLength(0);
  });
});
