import { test, expect } from '../framework';
import type { Page } from '@playwright/test';
import { GameTestContext } from '../framework/GameTestContext';
import { setChineseLocale } from '../helpers/common';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import {
  cleanupTwoPlayerMatch,
  setupTwoPlayerMatch,
  waitForHandArea,
} from './smashup-helpers';
import { initAllAbilities } from '../../src/games/smashup/abilities/index.ts';
import {
  advanceSmashUpReactionSession,
  startSmashUpReactionSession,
} from '../../src/games/smashup/domain/reactionSession.ts';
import {
  createScoringBaseRef,
  createScoringSession,
  setScoringSession,
} from '../../src/games/smashup/domain/scoringSession.ts';
import { collectTriggers } from '../../src/games/smashup/domain/ongoingEffects.ts';
import { stripNonSerializable } from '../../src/engine/systems/InteractionSystem.ts';

type InteractionOption = {
  id?: string;
  value?: unknown;
};

function optionValue(option: InteractionOption): Record<string, unknown> {
  return option.value && typeof option.value === 'object'
    ? option.value as Record<string, unknown>
    : {};
}

async function dismissSpotlightIfPresent(page: Page): Promise<void> {
  const spotlightQueue = page.getByTestId('card-spotlight-queue');
  if (await spotlightQueue.isVisible({ timeout: 300 }).catch(() => false)) {
    await spotlightQueue.getByRole('button', { name: /^(关闭特写|Close spotlight)$/i }).click({ force: true });
    await page.waitForTimeout(200);
  }
}

const FIXED_SMASHUP_RANDOM = {
  random: () => 0.5,
  d: () => 1,
  range: (min: number) => min,
  shuffle: <T>(items: T[]) => [...items],
};

async function setHarnessState(page: Page, nextState: any): Promise<void> {
  await page.evaluate(async (state) => {
    const harness = (window as any).__BG_TEST_HARNESS__;
    if (!harness?.state?.set) {
      throw new Error('TestHarness state.set 不可用');
    }
    await harness.state.set(state);
  }, nextState);
  await page.waitForTimeout(500);
}

function createMountiesBadgeReactionChooseState(baseState: any, frameId: string): any {
  initAllAbilities();

  let state = {
    ...baseState,
    core: {
      ...baseState.core,
      scoringEligibleBaseIndices: [0],
      triggerQueue: baseState.core?.triggerQueue ?? [],
    },
    sys: {
      ...baseState.sys,
      phase: 'scoreBases',
      interaction: { current: undefined, queue: [] },
      responseWindow: { current: undefined },
    },
  };

  const baseRef = createScoringBaseRef(state.core, 0);
  if (!baseRef) {
    throw new Error('无法构造呼叫警徽计分基地引用');
  }

  state = setScoringSession(state, {
    ...createScoringSession(state.core, [0]),
    currentBaseRef: baseRef,
    currentStep: 'awaiting-response-window',
  });
  state = startSmashUpReactionSession(state, {
    frameId,
    frameKind: 'score-before',
    phase: 'optional',
    currentPlayerId: '0',
    activePlayerId: '0',
    consecutivePasses: 0,
    sourceBaseIndex: 0,
    responseWindowType: 'meFirst',
  });

  const advancedState = advanceSmashUpReactionSession(state, FIXED_SMASHUP_RANDOM as any, 1)?.state ?? state;
  return {
    ...advancedState,
    sys: {
      ...advancedState.sys,
      interaction: {
        ...advancedState.sys.interaction,
        current: stripNonSerializable(advancedState.sys.interaction?.current),
        queue: (advancedState.sys.interaction?.queue ?? [])
          .map((interaction: any) => stripNonSerializable(interaction))
          .filter(Boolean),
      },
    },
  };
}

function createGreatWhiteNorthBeforeScoringState(
  baseState: any,
  frameId: string,
  options?: { holdBeforeScoring?: boolean },
): any {
  initAllAbilities();

  const queued = collectTriggers(baseState.core, 'beforeScoring', {
    state: baseState.core,
    matchState: baseState,
    playerId: '0',
    baseIndex: 0,
    frameId,
    sourceEventId: frameId,
    random: FIXED_SMASHUP_RANDOM as any,
    now: 20260921,
  }, { sourceDefIds: ['base_great_white_north_eh'] });
  const triggerQueue = queued?.payload.triggers ?? [];
  if (triggerQueue.length === 0) {
    throw new Error('无法构造大白北方 beforeScoring 触发队列');
  }

  let state = {
    ...baseState,
    core: {
      ...baseState.core,
      scoringEligibleBaseIndices: options?.holdBeforeScoring ? [] : [0],
      beforeScoringTriggeredBases: [0],
      triggerQueue,
    },
    sys: {
      ...baseState.sys,
      phase: options?.holdBeforeScoring ? 'playCards' : 'scoreBases',
      interaction: { current: undefined, queue: [] },
      responseWindow: { current: undefined },
    },
  };

  if (!options?.holdBeforeScoring) {
    const baseRef = createScoringBaseRef(state.core, 0);
    if (!baseRef) {
      throw new Error('无法构造大白北方计分基地引用');
    }

    state = setScoringSession(state, {
      ...createScoringSession(state.core, [0]),
      currentBaseRef: baseRef,
      currentStep: 'awaiting-before-response-window',
    });
  }
  state = startSmashUpReactionSession(state, {
    frameId,
    frameKind: 'score-before',
    phase: 'mandatory',
    currentPlayerId: '0',
    activePlayerId: '0',
    consecutivePasses: 0,
    sourceBaseIndex: 0,
    responseWindowType: 'meFirst',
  });

  const advancedState = advanceSmashUpReactionSession(state, FIXED_SMASHUP_RANDOM as any, 20260921)?.state ?? state;
  return {
    ...advancedState,
    sys: {
      ...advancedState.sys,
      interaction: {
        ...advancedState.sys.interaction,
        current: stripNonSerializable(advancedState.sys.interaction?.current),
        queue: (advancedState.sys.interaction?.queue ?? [])
          .map((interaction: any) => stripNonSerializable(interaction))
          .filter(Boolean),
      },
    },
  };
}

function createGreatWhiteNorthOnlineSceneState(baseState: any): any {
  const makeMinion = (uid: string, defId: string, owner: '0' | '1', power: number) => ({
    uid,
    defId,
    owner,
    controller: owner,
    basePower: power,
    power,
    powerCounters: 0,
    tempPowerModifier: 0,
    attachedActions: [],
  });

  const players = {
    ...baseState.core.players,
    '0': {
      ...baseState.core.players['0'],
      factions: ['mounties', 'luchadors'],
      hand: [],
      discard: [],
      minionsPlayed: 0,
      minionLimit: 1,
      actionsPlayed: 0,
      actionLimit: 1,
    },
    '1': {
      ...baseState.core.players['1'],
      factions: ['musketeers', 'sumo_wrestlers'],
      hand: [],
      discard: [],
      minionsPlayed: 0,
      minionLimit: 1,
      actionsPlayed: 0,
      actionLimit: 1,
    },
  };

  const bases = [
    {
      ...baseState.core.bases[0],
      defId: 'base_great_white_north_eh',
      minions: [
        makeMinion('north-p0-first', 'mounties_dudlee', '0', 2),
        makeMinion('north-p0-second', 'mounties_war_canuck', '0', 3),
        makeMinion('north-p1', 'musketeers_young_musketeer', '1', 3),
      ],
      ongoingActions: [],
    },
    {
      ...baseState.core.bases[1],
      defId: 'base_ringside',
      minions: [],
      ongoingActions: [],
    },
    {
      ...baseState.core.bases[2],
      defId: 'base_strategic_syrup_reserve',
      minions: [],
      ongoingActions: [],
    },
  ];

  return {
    ...baseState,
    core: {
      ...baseState.core,
      players,
      bases,
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      phase: 'playCards',
      triggerQueue: [],
      scoringEligibleBaseIndices: [],
      beforeScoringTriggeredBases: [],
    },
    sys: {
      ...baseState.sys,
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      phase: 'playCards',
      interaction: { current: undefined, queue: [] },
      responseWindow: { current: undefined },
    },
  };
}

function createBringEmInOnlineSceneState(baseState: any): any {
  const makeMinion = (uid: string, defId: string, owner: '0' | '1', power: number) => ({
    uid,
    defId,
    owner,
    controller: owner,
    basePower: power,
    power,
    powerCounters: 0,
    tempPowerModifier: 0,
    attachedActions: [],
  });

  const players = {
    ...baseState.core.players,
    '0': {
      ...baseState.core.players['0'],
      factions: ['mounties', 'luchadors'],
      hand: [{ uid: 'bring-in-card', defId: 'mounties_bring_em_in', type: 'action', owner: '0' }],
      discard: [],
      minionsPlayed: 0,
      minionLimit: 1,
      actionsPlayed: 0,
      actionLimit: 1,
    },
    '1': {
      ...baseState.core.players['1'],
      factions: ['mounties', 'musketeers'],
      hand: [{ uid: 'move-aboot-card', defId: 'mounties_move_aboot', type: 'action', owner: '1' }],
      discard: [],
      minionsPlayed: 0,
      minionLimit: 1,
      actionsPlayed: 0,
      actionLimit: 1,
    },
  };

  const bases = [
    {
      ...baseState.core.bases[0],
      defId: 'base_strategic_syrup_reserve',
      minions: [makeMinion('bring-in-target', 'musketeers_young_musketeer', '1', 3)],
      ongoingActions: [],
    },
    {
      ...baseState.core.bases[1],
      defId: 'base_great_white_north_eh',
      minions: [makeMinion('bring-in-destination', 'mounties_dudlee', '0', 2)],
      ongoingActions: [],
    },
  ];

  return {
    ...baseState,
    core: {
      ...baseState.core,
      players,
      bases,
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      phase: 'playCards',
      triggerQueue: [],
      scoringEligibleBaseIndices: [],
      beforeScoringTriggeredBases: [],
    },
    sys: {
      ...baseState.sys,
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      phase: 'playCards',
      interaction: { current: undefined, queue: [] },
      responseWindow: { current: undefined },
    },
  };
}

test.describe('大杀四方国际事件骑警真实入口审计', () => {
  test('达德利从真实随从入口移动到有对手随从的其它基地并获得 +1', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      numPlayers: 2,
      skipInitialization: true,
      seed: 20260923,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [],
        factions: ['mounties', 'luchadors'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [
        {
          defId: 'base_strategic_syrup_reserve',
          minions: [
            { uid: 'dudlee-talent', defId: 'mounties_dudlee', owner: '0', controller: '0', power: 2 },
          ],
        },
        {
          defId: 'base_great_white_north_eh',
          minions: [
            { uid: 'dudlee-enemy-base', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 3 },
          ],
        },
        {
          defId: 'base_ringside',
          minions: [],
        },
      ],
    });

    await page.locator('[data-minion-uid="dudlee-talent"]').click({ force: true });
    await game.waitForInteraction('mounties_dudlee_destination', 10000);
    const destinationOptions = await game.getInteractionOptions();
    expect(destinationOptions.map(option => optionValue(option).baseIndex)).toEqual([1]);
    await game.screenshot('骑警-达德利-选择有对手随从的其它基地', testInfo);
    await game.selectInteractionOptionBy(
      option => optionValue(option).baseIndex === 1,
      '达德利选择目标基地',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      const dudlee = state.core.bases[1]?.minions.find((minion: { uid?: string }) => minion.uid === 'dudlee-talent');
      return {
        sourceBase: state.core.bases[0]?.minions.map((minion: { uid?: string }) => minion.uid) ?? [],
        targetBase: state.core.bases[1]?.minions.map((minion: { uid?: string }) => minion.uid) ?? [],
        tempPower: dudlee?.tempPowerModifier ?? 0,
        talentUsed: dudlee?.talentUsed ?? false,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      sourceBase: [],
      targetBase: ['dudlee-enemy-base', 'dudlee-talent'],
      tempPower: 1,
      talentUsed: true,
      interactionSource: null,
    });
    await game.screenshot('骑警-达德利-移动并获得加力', testInfo);
  });

  test('战争骑警在当前基地有对手随从时从真实随从入口获得 +2', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      numPlayers: 2,
      skipInitialization: true,
      seed: 20260924,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [],
        factions: ['mounties', 'luchadors'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [
        {
          defId: 'base_great_white_north_eh',
          minions: [
            { uid: 'war-canuck-talent', defId: 'mounties_war_canuck', owner: '0', controller: '0', power: 3 },
            { uid: 'war-canuck-enemy', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 3 },
          ],
        },
        {
          defId: 'base_ringside',
          minions: [],
        },
      ],
    });

    await page.locator('[data-minion-uid="war-canuck-talent"]').click({ force: true });
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      const warCanuck = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'war-canuck-talent');
      return {
        powerModifier: warCanuck?.powerModifier ?? 0,
        talentUsed: warCanuck?.talentUsed ?? false,
        timedPowerModifiers: state.core.timedPowerModifiers?.filter((entry: { minionUid?: string }) => entry.minionUid === 'war-canuck-talent').length ?? 0,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      powerModifier: 2,
      talentUsed: true,
      timedPowerModifiers: 1,
      interactionSource: null,
    });
    await game.screenshot('骑警-战争骑警-当前基地有对手随从时获得加力', testInfo);
  });

  test('北方搬运者从真实随从入口选择移动分支并移动另一个己方随从', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      numPlayers: 2,
      skipInitialization: true,
      seed: 20260925,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [],
        factions: ['mounties', 'luchadors'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [
        {
          defId: 'base_strategic_syrup_reserve',
          minions: [
            { uid: 'northern-ally', defId: 'mounties_dudlee', owner: '0', controller: '0', power: 2 },
            { uid: 'northern-talent', defId: 'mounties_northern_mover', owner: '0', controller: '0', power: 4 },
          ],
        },
        {
          defId: 'base_great_white_north_eh',
          minions: [],
        },
      ],
    });

    await page.locator('[data-minion-uid="northern-talent"]').click({ force: true });
    await game.waitForInteraction('mounties_northern_mover_target', 10000);
    const targetOptions = await game.getInteractionOptions();
    expect(targetOptions.filter(option => optionValue(option).minionUid === 'northern-talent')).toHaveLength(0);
    expect(targetOptions.filter(option => optionValue(option).minionUid === 'northern-ally')).toHaveLength(1);
    await game.screenshot('骑警-北方搬运者-选择另一个己方随从', testInfo);
    await game.selectInteractionOptionBy(
      option => optionValue(option).minionUid === 'northern-ally',
      '北方搬运者选择另一个己方随从',
    );

    await game.waitForInteraction('mounties_northern_mover_mode', 10000);
    const modeOptions = await game.getInteractionOptions();
    expect(modeOptions.map(option => String(optionValue(option).mode)).sort()).toEqual(['move', 'power']);
    await game.screenshot('骑警-北方搬运者-移动或加力分支', testInfo);
    await game.selectInteractionOptionBy(
      option => optionValue(option).mode === 'move',
      '北方搬运者选择移动分支',
    );

    await game.waitForInteraction('mounties_northern_mover_destination', 10000);
    const destinationOptions = await game.getInteractionOptions();
    expect(destinationOptions.map(option => optionValue(option).baseIndex)).toEqual([1]);
    await game.selectInteractionOptionBy(
      option => optionValue(option).baseIndex === 1,
      '北方搬运者选择另一个基地',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      const mover = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'northern-talent');
      return {
        sourceBase: state.core.bases[0]?.minions.map((minion: { uid?: string }) => minion.uid) ?? [],
        destinationBase: state.core.bases[1]?.minions.map((minion: { uid?: string }) => minion.uid) ?? [],
        talentUsed: mover?.talentUsed ?? false,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      sourceBase: ['northern-talent'],
      destinationBase: ['northern-ally'],
      talentUsed: true,
      interactionSource: null,
    });
    await game.screenshot('骑警-北方搬运者-移动分支收口', testInfo);
  });

  test('北方搬运者从真实随从入口在无其它基地时只显示 +1 分支', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      numPlayers: 2,
      skipInitialization: true,
      seed: 20260926,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [],
        factions: ['mounties', 'luchadors'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [
        {
          defId: 'base_strategic_syrup_reserve',
          minions: [
            { uid: 'northern-power-target', defId: 'mounties_dudlee', owner: '0', controller: '0', power: 2 },
            { uid: 'northern-power', defId: 'mounties_northern_mover', owner: '0', controller: '0', power: 4 },
          ],
        },
      ],
    });

    await page.locator('[data-minion-uid="northern-power"]').click({ force: true });
    await game.waitForInteraction('mounties_northern_mover_target', 10000);
    await game.selectInteractionOptionBy(
      option => optionValue(option).minionUid === 'northern-power-target',
      '北方搬运者选择加力目标',
    );

    await game.waitForInteraction('mounties_northern_mover_mode', 10000);
    const modeOptions = await game.getInteractionOptions();
    expect(modeOptions.map(option => String(optionValue(option).mode))).toEqual(['power']);
    await game.screenshot('骑警-北方搬运者-无其它基地只显示加力', testInfo);
    await game.selectInteractionOptionBy(
      option => optionValue(option).mode === 'power',
      '北方搬运者选择加力分支',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      const target = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'northern-power-target');
      const mover = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'northern-power');
      return {
        targetTempPower: target?.tempPowerModifier ?? 0,
        moverStillPresent: Boolean(mover),
        talentUsed: mover?.talentUsed ?? false,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      targetTempPower: 1,
      moverStillPresent: true,
      talentUsed: true,
      interactionSource: null,
    });
    await game.screenshot('骑警-北方搬运者-加力分支收口', testInfo);
  });

  test('挪过去从真实手牌入口只允许移动另一个基地的己方随从并获得 +2', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      numPlayers: 2,
      skipInitialization: true,
      seed: 20260927,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'move-aboot-card', defId: 'mounties_move_aboot', type: 'action', owner: '0' }],
        factions: ['mounties', 'luchadors'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [
        {
          defId: 'base_strategic_syrup_reserve',
          minions: [
            { uid: 'move-aboot-source', defId: 'mounties_dudlee', owner: '0', controller: '0', power: 2 },
          ],
        },
        {
          defId: 'base_great_white_north_eh',
          minions: [
            { uid: 'move-aboot-same-base', defId: 'mounties_war_canuck', owner: '0', controller: '0', power: 3 },
            { uid: 'move-aboot-enemy', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 3 },
          ],
        },
      ],
    });

    await game.playCard('mounties_move_aboot');
    await game.waitForInteraction('mounties_move_aboot', 10000);
    const sourceOptions = await game.getInteractionOptions();
    expect(sourceOptions.filter(option => optionValue(option).minionUid === 'move-aboot-source')).toHaveLength(1);
    expect(sourceOptions.filter(option => optionValue(option).minionUid === 'move-aboot-same-base')).toHaveLength(0);
    await game.screenshot('骑警-挪过去-只显示另一个基地的己方随从', testInfo);
    await game.selectInteractionOptionBy(
      option => optionValue(option).minionUid === 'move-aboot-source',
      '挪过去选择另一个基地的己方随从',
    );

    await game.waitForInteraction('mounties_move_aboot_destination', 10000);
    const destinationOptions = await game.getInteractionOptions();
    expect(destinationOptions.map(option => optionValue(option).baseIndex)).toEqual([1]);
    await game.selectInteractionOptionBy(
      option => optionValue(option).baseIndex === 1,
      '挪过去选择有对手随从的基地',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      const source = state.core.bases[1]?.minions.find((minion: { uid?: string }) => minion.uid === 'move-aboot-source');
      return {
        sourceBase: state.core.bases[0]?.minions.map((minion: { uid?: string }) => minion.uid) ?? [],
        destinationBase: state.core.bases[1]?.minions.map((minion: { uid?: string }) => minion.uid) ?? [],
        tempPower: source?.tempPowerModifier ?? 0,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      sourceBase: [],
      destinationBase: ['move-aboot-same-base', 'move-aboot-enemy', 'move-aboot-source'],
      tempPower: 2,
      interactionSource: null,
    });
    await game.screenshot('骑警-挪过去-移动并获得+2', testInfo);
  });

  test('Haich-Q 从真实基地持续行动入口把己方随从移入宿主基地', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      numPlayers: 2,
      skipInitialization: true,
      seed: 20260928,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [],
        factions: ['mounties', 'luchadors'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [
        {
          defId: 'base_strategic_syrup_reserve',
          ongoingActions: [
            { uid: 'haich-q-move-in', defId: 'mounties_haich_q', ownerId: '0', talentUsed: false },
          ],
          minions: [
            { uid: 'haich-q-host-ally', defId: 'mounties_dudlee', owner: '0', controller: '0', power: 2 },
            { uid: 'haich-q-host-enemy', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 3 },
          ],
        },
        {
          defId: 'base_great_white_north_eh',
          minions: [
            { uid: 'haich-q-away-ally', defId: 'mounties_war_canuck', owner: '0', controller: '0', power: 3 },
          ],
        },
        { defId: 'base_ringside', minions: [] },
      ],
    });

    await page.locator('[data-ongoing-uid="haich-q-move-in"]').click({ force: true });
    await game.waitForInteraction('mounties_haich_q_move', 10000);
    const sourceOptions = await game.getInteractionOptions();
    expect(sourceOptions).toHaveLength(2);
    expect(sourceOptions.map(option => optionValue(option).minionUid)).toEqual([
      'haich-q-host-ally',
      'haich-q-host-enemy',
      'haich-q-away-ally',
    ].filter(uid => uid !== 'haich-q-host-enemy'));
    await game.screenshot('骑警-Haich-Q-选择移入随从', testInfo);
    await game.selectInteractionOptionBy(
      option => optionValue(option).minionUid === 'haich-q-away-ally',
      'Haich-Q 选择移入宿主基地的随从',
    );

    await game.waitForInteraction('mounties_haich_q_destination', 10000);
    const destinationOptions = await game.getInteractionOptions();
    expect(destinationOptions.map(option => optionValue(option).baseIndex)).toEqual([0]);
    await game.selectInteractionOptionBy(
      option => optionValue(option).baseIndex === 0,
      'Haich-Q 选择宿主基地',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        hostBase: state.core.bases[0]?.minions.map((minion: { uid?: string }) => minion.uid) ?? [],
        awayBase: state.core.bases[1]?.minions.map((minion: { uid?: string }) => minion.uid) ?? [],
        talentUsed: state.core.bases[0]?.ongoingActions?.find((action: { uid?: string }) => action.uid === 'haich-q-move-in')?.talentUsed ?? false,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      hostBase: ['haich-q-host-ally', 'haich-q-host-enemy', 'haich-q-away-ally'],
      awayBase: [],
      talentUsed: true,
      interactionSource: null,
    });
    await game.screenshot('骑警-Haich-Q-移入宿主基地并收口', testInfo);
  });

  test('Haich-Q 从真实基地持续行动入口把宿主基地的己方随从移出', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      numPlayers: 2,
      skipInitialization: true,
      seed: 20260929,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [],
        factions: ['mounties', 'luchadors'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [
        {
          defId: 'base_strategic_syrup_reserve',
          ongoingActions: [
            { uid: 'haich-q-move-out', defId: 'mounties_haich_q', ownerId: '0', talentUsed: false },
          ],
          minions: [
            { uid: 'haich-q-source-ally', defId: 'mounties_dudlee', owner: '0', controller: '0', power: 2 },
          ],
        },
        { defId: 'base_great_white_north_eh', minions: [] },
        { defId: 'base_ringside', minions: [] },
      ],
    });

    await page.locator('[data-ongoing-uid="haich-q-move-out"]').click({ force: true });
    await game.waitForInteraction('mounties_haich_q_move', 10000);
    const sourceOptions = await game.getInteractionOptions();
    expect(sourceOptions.map(option => optionValue(option).minionUid)).toEqual(['haich-q-source-ally']);
    await game.selectInteractionOptionBy(
      option => optionValue(option).minionUid === 'haich-q-source-ally',
      'Haich-Q 选择移出宿主基地的随从',
    );

    await game.waitForInteraction('mounties_haich_q_destination', 10000);
    const destinationOptions = await game.getInteractionOptions();
    expect(destinationOptions.map(option => optionValue(option).baseIndex)).toEqual([1, 2]);
    await game.screenshot('骑警-Haich-Q-选择移出目的地', testInfo);
    await game.selectInteractionOptionBy(
      option => optionValue(option).baseIndex === 2,
      'Haich-Q 选择宿主基地外的目的地',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        hostBase: state.core.bases[0]?.minions.map((minion: { uid?: string }) => minion.uid) ?? [],
        destinationBase: state.core.bases[2]?.minions.map((minion: { uid?: string }) => minion.uid) ?? [],
        talentUsed: state.core.bases[0]?.ongoingActions?.find((action: { uid?: string }) => action.uid === 'haich-q-move-out')?.talentUsed ?? false,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      hostBase: [],
      destinationBase: ['haich-q-source-ally'],
      talentUsed: true,
      interactionSource: null,
    });
    await game.screenshot('骑警-Haich-Q-移出宿主基地并收口', testInfo);
  });

  test('战斗麋鹿从真实手牌入口附着到己方随从', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      numPlayers: 2,
      skipInitialization: true,
      seed: 20260929,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'battle-moose-card', defId: 'mounties_battle_moose', type: 'action', owner: '0' }],
        factions: ['mounties', 'luchadors'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: {
        factions: ['all_stars', 'musketeers'],
        hand: [],
      },
      bases: [
        {
          defId: 'base_ringside',
          breakpoint: 7,
          minions: [
            {
              uid: 'battle-moose-host',
              defId: 'mounties_dudlee',
              owner: '0',
              controller: '0',
              power: 3,
            },
            {
              uid: 'battle-moose-unprotected',
              defId: 'mounties_war_canuck',
              owner: '0',
              controller: '0',
              power: 3,
            },
          ],
        },
      ],
    });

    const battleMooseCard = page.locator('[data-card-uid="battle-moose-card"]');
    await expect(battleMooseCard).toBeVisible({ timeout: 10000 });
    await battleMooseCard.click({ force: true });
    await page.waitForTimeout(300);
    const battleMooseHost = page.locator('[data-minion-uid="battle-moose-host"]');
    await expect(battleMooseHost).toBeVisible({ timeout: 10000 });
    await battleMooseHost.click({ force: true });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const host = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'battle-moose-host');
      return host?.attachedActions.map((action: { defId?: string }) => action.defId) ?? [];
    }, { timeout: 10000 }).toEqual(['mounties_battle_moose']);
    await game.screenshot('骑警-战斗麋鹿-真实手牌附着到己方随从', testInfo);
  });

  test('战斗麋鹿阻止其他玩家从真实手牌打出行动牌摧毁同基地己方随从', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      numPlayers: 2,
      playerID: '1',
      seat0: 'human',
      seat1: 'human',
      disableLocalAiAutomation: true,
      skipInitialization: true,
      seed: 20260930,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '1',
      phase: 'playCards',
      player0: {
        hand: [],
        factions: ['mounties', 'luchadors'],
      },
      player1: {
        factions: ['all_stars', 'musketeers'],
        hand: [{ uid: 'seeing-stars-card', defId: 'all_stars_seeing_stars', type: 'action', owner: '1' }],
        actionsPlayed: 0,
        actionLimit: 1,
      },
      bases: [
        {
          defId: 'base_ringside',
          breakpoint: 7,
          minions: [
            {
              uid: 'battle-moose-host',
              defId: 'mounties_dudlee',
              owner: '0',
              controller: '0',
              power: 3,
              attachedActions: [
                {
                  uid: 'battle-moose-attached',
                  defId: 'mounties_battle_moose',
                  ownerId: '0',
                  metadata: { sourceControllerId: '0' },
                },
              ],
            },
          ],
        },
        {
          defId: 'base_the_homeworld',
          minions: [
            {
              uid: 'battle-moose-unprotected',
              defId: 'mounties_war_canuck',
              owner: '0',
              controller: '0',
              power: 3,
            },
          ],
        },
      ],
    });

    await game.playCard('all_stars_seeing_stars');
    await game.waitForInteraction('all_stars_seeing_stars', 10000);
    const seeingStarsOptions = await game.getInteractionOptions();
    expect(seeingStarsOptions.some(option => optionValue(option).minionUid === 'battle-moose-host')).toBe(false);
    expect(seeingStarsOptions.some(option => optionValue(option).minionUid === 'battle-moose-unprotected')).toBe(true);
    await game.screenshot('骑警-战斗麋鹿-对手卡牌摧毁目标过滤', testInfo);
    await game.selectInteractionOptionBy(
      option => optionValue(option).minionUid === 'battle-moose-unprotected',
      '战斗麋鹿选择未受保护的己方随从作为对照目标',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const hostBaseMinionUids = state.core.bases[0]?.minions.map((minion: { uid?: string }) => minion.uid) ?? [];
      const comparisonBaseMinionUids = state.core.bases[1]?.minions.map((minion: { uid?: string }) => minion.uid) ?? [];
      const host = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'battle-moose-host');
      return {
        hostBaseMinionUids,
        comparisonBaseMinionUids,
        hostActionDefIds: host?.attachedActions.map((action: { defId?: string }) => action.defId) ?? [],
        player1DiscardUids: state.core.players['1']?.discard.map((card: { uid?: string }) => card.uid) ?? [],
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      hostBaseMinionUids: ['battle-moose-host'],
      comparisonBaseMinionUids: [],
      hostActionDefIds: ['mounties_battle_moose'],
      player1DiscardUids: ['seeing-stars-card'],
      triggerQueueLength: 0,
      interactionSource: null,
    });
    await game.screenshot('骑警-战斗麋鹿-保护与对照目标结算收口', testInfo);
  });

  test('力量肉汁薯条从真实手牌入口只强化选定基地至多两个己方随从，并在回合结束失效', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      numPlayers: 2,
      skipInitialization: true,
      seed: 20260931,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'power-poutine-card', defId: 'mounties_power_poutine', type: 'action', owner: '0' }],
        factions: ['mounties', 'luchadors'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [
        {
          defId: 'base_strategic_syrup_reserve',
          minions: [
            { uid: 'power-poutine-own-a', defId: 'mounties_dudlee', owner: '0', controller: '0', power: 2 },
            { uid: 'power-poutine-own-b', defId: 'mounties_war_canuck', owner: '0', controller: '0', power: 3 },
            { uid: 'power-poutine-own-c', defId: 'mounties_northern_mover', owner: '0', controller: '0', power: 4 },
            { uid: 'power-poutine-enemy', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 3 },
          ],
        },
        {
          defId: 'base_great_white_north_eh',
          minions: [
            { uid: 'power-poutine-other-base', defId: 'mounties_dudlee', owner: '0', controller: '0', power: 2 },
          ],
        },
      ],
    });

    await game.playCard('mounties_power_poutine', { targetBaseIndex: 0 });
    await game.waitForInteraction('mounties_power_poutine', 10000);

    const options = await game.getInteractionOptions();
    expect(options.filter(option => ['power-poutine-own-a', 'power-poutine-own-b', 'power-poutine-own-c'].includes(String(optionValue(option).minionUid)))).toHaveLength(3);
    expect(options.some(option => optionValue(option).minionUid === 'power-poutine-enemy')).toBe(false);
    expect(options.some(option => optionValue(option).minionUid === 'power-poutine-other-base')).toBe(false);
    await game.screenshot('骑警-力量肉汁薯条-选定基地的己方随从多选', testInfo);

    await page.locator('[data-minion-uid="power-poutine-own-a"]').click({ force: true });
    await page.locator('[data-minion-uid="power-poutine-own-b"]').click({ force: true });
    await expect(page.getByText(/已选 2\s*\/\s*2/)).toBeVisible();
    await game.confirm();
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        tempPower: state.core.bases[0]?.minions.map((minion: { uid?: string; tempPowerModifier?: number }) => ({
          uid: minion.uid,
          value: minion.tempPowerModifier ?? 0,
        })) ?? [],
        otherBasePower: state.core.bases[1]?.minions[0]?.tempPowerModifier ?? 0,
        discardUids: state.core.players['0']?.discard.map((card: { uid?: string }) => card.uid) ?? [],
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      tempPower: [
        { uid: 'power-poutine-own-a', value: 2 },
        { uid: 'power-poutine-own-b', value: 2 },
        { uid: 'power-poutine-own-c', value: 0 },
        { uid: 'power-poutine-enemy', value: 0 },
      ],
      otherBasePower: 0,
      discardUids: ['power-poutine-card'],
      interactionSource: null,
    });
    await game.screenshot('骑警-力量肉汁薯条-最多两个目标结算', testInfo);

    await page.getByTestId('su-end-turn-action-button').click();
    await page.waitForTimeout(1000);
    await expect.poll(async () => {
      const state = await game.getState();
      return state.core.bases[0]?.minions.map((minion: { tempPowerModifier?: number }) => minion.tempPowerModifier ?? 0) ?? [];
    }, { timeout: 10000 }).toEqual([0, 0, 0, 0]);
    await game.screenshot('骑警-力量肉汁薯条-回合结束临时力量清除', testInfo);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'power-poutine-empty-card', defId: 'mounties_power_poutine', type: 'action', owner: '0' }],
        factions: ['mounties', 'luchadors'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [
        {
          defId: 'base_strategic_syrup_reserve',
          minions: [
            { uid: 'power-poutine-empty-enemy', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 3 },
          ],
        },
      ],
    });

    await game.playCard('mounties_power_poutine', { targetBaseIndex: 0 });
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        enemyPower: state.core.bases[0]?.minions[0]?.tempPowerModifier ?? 0,
        discardUids: state.core.players['0']?.discard.map((card: { uid?: string }) => card.uid) ?? [],
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      enemyPower: 0,
      discardUids: ['power-poutine-empty-card'],
      interactionSource: null,
    });
    await game.screenshot('骑警-力量肉汁薯条-无己方随从不创建空交互', testInfo);
  });

  test('呼叫警徽从真实打出和计分前特殊入口选择有己方随从的基地并放置指示物', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      numPlayers: 2,
      skipInitialization: true,
      seed: 20260930,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'badge-on-play', defId: 'mounties_when_calls_the_badge', type: 'action', owner: '0' }],
        factions: ['mounties', 'luchadors'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [
        {
          defId: 'base_strategic_syrup_reserve',
          minions: [
            { uid: 'badge-play-own-a', defId: 'mounties_dudlee', owner: '0', controller: '0', power: 2 },
            { uid: 'badge-play-enemy', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 3 },
          ],
        },
        {
          defId: 'base_great_white_north_eh',
          minions: [
            { uid: 'badge-play-own-b', defId: 'mounties_war_canuck', owner: '0', controller: '0', power: 3 },
          ],
        },
        { defId: 'base_ringside', minions: [] },
      ],
    });

    await game.playCard('mounties_when_calls_the_badge');
    await game.waitForInteraction('mounties_when_calls_the_badge', 10000);
    const onPlayOptions = await game.getInteractionOptions();
    expect(onPlayOptions.map(option => optionValue(option).baseIndex).sort()).toEqual([0, 1]);
    await game.screenshot('骑警-呼叫警徽-打出时选择有己方随从的基地', testInfo);
    await game.selectInteractionOptionBy(
      option => optionValue(option).baseIndex === 1,
      '呼叫警徽打出时选择第二个基地',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        firstBaseCounters: state.core.bases[0]?.minions.map((minion: { powerCounters?: number }) => minion.powerCounters ?? 0) ?? [],
        secondBaseCounters: state.core.bases[1]?.minions.map((minion: { powerCounters?: number }) => minion.powerCounters ?? 0) ?? [],
        discardUids: state.core.players['0']?.discard.map((card: { uid?: string }) => card.uid) ?? [],
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      firstBaseCounters: [0, 0],
      secondBaseCounters: [1],
      discardUids: ['badge-on-play'],
      interactionSource: null,
    });
    await game.screenshot('骑警-呼叫警徽-打出后只给目标基地己方随从加指示物', testInfo);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'badge-special-direct', defId: 'mounties_when_calls_the_badge', type: 'action', owner: '0' }],
        factions: ['mounties', 'luchadors'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [
        {
          defId: 'base_great_white_north_eh',
          minions: [
            { uid: 'badge-special-own-a', defId: 'mounties_dudlee', owner: '0', controller: '0', power: 10 },
            { uid: 'badge-special-own-b', defId: 'mounties_war_canuck', owner: '0', controller: '0', power: 8 },
            { uid: 'badge-special-enemy', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 3 },
          ],
        },
        { defId: 'base_the_golden_lily', minions: [] },
      ],
    });

    const baseState = await game.getState();
    const frameId = 'score-before:mounties-when-calls-the-badge';
    await setHarnessState(page, createMountiesBadgeReactionChooseState(baseState, frameId));
    await expect.poll(async () => {
      const state = await game.getState();
      const frames = state.sys?.resolution?.frames ?? [];
      const session = frames
        .map((frame: any) => frame?.metadata?.smashupReactionSession)
        .find(Boolean);
      return {
        phase: state.sys?.phase ?? null,
        interactionSource: state.sys?.interaction?.current?.data?.sourceId ?? null,
        responseWindow: session?.responseWindowType ?? null,
        activePlayerId: session?.activePlayerId ?? null,
      };
    }).toEqual({
      phase: 'scoreBases',
      interactionSource: 'smashup_reaction_choose',
      responseWindow: 'meFirst',
      activePlayerId: '0',
    });

    const reactionOptions = await game.getInteractionOptions();
    const badgeReactionOptions = reactionOptions.filter((option) => {
      const value = optionValue(option);
      return value.kind === 'play_action' && value.cardUid === 'badge-special-direct';
    });
    expect(badgeReactionOptions.map(option => optionValue(option).targetBaseIndex)).toEqual([0]);

    const specialCard = page.locator('[data-testid="su-hand-area"] [data-card-uid="badge-special-direct"]');
    await expect(specialCard).toBeVisible({ timeout: 10000 });
    await specialCard.click({ force: true });
    await game.screenshot('骑警-呼叫警徽-计分前特殊选择基地', testInfo);
    await game.selectBase(0);
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        counters: state.core.bases[0]?.minions.map((minion: { powerCounters?: number }) => minion.powerCounters ?? 0) ?? [],
        otherBaseMinions: state.core.bases[1]?.minions.map((minion: { uid?: string; powerCounters?: number }) => ({
          uid: minion.uid,
          counters: minion.powerCounters ?? 0,
        })) ?? [],
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      counters: [1, 1, 0],
      otherBaseMinions: [],
      triggerQueueLength: 0,
      interactionSource: null,
    });
    await game.screenshot('骑警-呼叫警徽-计分前特殊结算后', testInfo);
  });

  test('大白北方从真实计分前入口逐玩家选择移动，并只给实际移动者 +1', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const setup = await setupTwoPlayerMatch(browser, baseURL, { skipImageGate: true });
    if (!setup) {
      test.skip(true, '游戏服务器不可用或创建房间失败');
      return;
    }

    const { hostPage, guestPage, matchId } = setup;
    const hostGame = new GameTestContext(hostPage);
    const guestGame = new GameTestContext(guestPage);

    try {
      const initialState = await getMatchState(matchId, hostPage);
      const sceneState = createGreatWhiteNorthOnlineSceneState(initialState);
      const frameId = 'score-before:base-great-white-north:20260921';
      await injectMatchState(
        matchId,
        createGreatWhiteNorthBeforeScoringState(sceneState, frameId, { holdBeforeScoring: true }),
        hostPage,
      );
      await Promise.all([
        waitForHandArea(hostPage),
        waitForHandArea(guestPage),
      ]);
      await hostGame.waitForInteraction('base_great_white_north_eh', 15000);
      const firstOptions = await hostGame.getInteractionOptions();
      const firstMoves = firstOptions.filter(option => optionValue(option).minionUid);
      expect(firstMoves).toHaveLength(4);
      expect(firstMoves.map(option => optionValue(option).minionUid)).toEqual([
        'north-p0-first',
        'north-p0-first',
        'north-p0-second',
        'north-p0-second',
      ]);
      await hostPage.screenshot({ path: testInfo.outputPath('骑警-大白北方-首位玩家多候选.png'), fullPage: false });

      await hostGame.selectInteractionOptionBy(
        option => optionValue(option).minionUid === 'north-p0-second' && optionValue(option).toBaseIndex === 2,
        '大白北方首位玩家选择非第一随从和非第一目的地',
      );

      await expect.poll(async () => {
        const state = await getMatchState(matchId, hostPage);
        return {
          sourceBase: state.core.bases[0]?.minions.map((minion: { uid?: string }) => minion.uid) ?? [],
          destinationBase: state.core.bases[2]?.minions.map((minion: { uid?: string; tempPowerModifier?: number }) => ({
            uid: minion.uid,
            tempPowerModifier: minion.tempPowerModifier ?? 0,
          })) ?? [],
          interactionPlayerId: state.sys.interaction?.current?.playerId ?? null,
          interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
        };
      }, { timeout: 15000 }).toEqual({
        sourceBase: ['north-p0-first', 'north-p1'],
        destinationBase: [{ uid: 'north-p0-second', tempPowerModifier: 1 }],
        interactionPlayerId: '1',
        interactionSource: 'base_great_white_north_eh',
      });
      await guestGame.waitForInteraction('base_great_white_north_eh', 15000);
      await guestPage.screenshot({ path: testInfo.outputPath('骑警-大白北方-第二位玩家交互.png'), fullPage: false });

      const secondOptions = await guestGame.getInteractionOptions();
      expect(secondOptions.filter(option => optionValue(option).minionUid)).toHaveLength(2);
      expect(secondOptions.map(option => optionValue(option).minionUid).filter(Boolean)).not.toContain('north-p0-first');
      await guestGame.selectInteractionOptionBy(
        option => optionValue(option).minionUid === 'north-p1' && optionValue(option).toBaseIndex === 1,
        '大白北方第二位玩家选择移动到第一目的地',
      );

      await expect.poll(async () => {
        const state = await getMatchState(matchId, hostPage);
        const first = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'north-p0-first');
        const second = state.core.bases[2]?.minions.find((minion: { uid?: string }) => minion.uid === 'north-p0-second');
        const playerOne = state.core.bases[1]?.minions.find((minion: { uid?: string }) => minion.uid === 'north-p1');
        return {
          base0: state.core.bases[0]?.minions.map((minion: { uid?: string }) => minion.uid) ?? [],
          base1: state.core.bases[1]?.minions.map((minion: { uid?: string }) => minion.uid) ?? [],
          base2: state.core.bases[2]?.minions.map((minion: { uid?: string }) => minion.uid) ?? [],
          firstTempPower: first?.tempPowerModifier ?? 0,
          secondTempPower: second?.tempPowerModifier ?? 0,
          playerOneTempPower: playerOne?.tempPowerModifier ?? 0,
          interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
          triggerQueueLength: state.core.triggerQueue?.length ?? 0,
        };
      }, { timeout: 5000 }).toMatchObject({
        base0: ['north-p0-first'],
        base1: ['north-p1'],
        base2: ['north-p0-second'],
        firstTempPower: 0,
        secondTempPower: 1,
        playerOneTempPower: 1,
      });

      await expect.poll(async () => {
        const state = await getMatchState(matchId, hostPage);
        return {
          interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
          triggerQueueLength: state.core.triggerQueue?.length ?? 0,
        };
      }, { timeout: 15000 }).toEqual({
        interactionSource: null,
        triggerQueueLength: 0,
      });
      await hostPage.screenshot({ path: testInfo.outputPath('骑警-大白北方-逐玩家移动收口.png'), fullPage: false });
    } finally {
      await cleanupTwoPlayerMatch(setup);
    }
  });

  test('带进来从真实手牌附着到对手随从，并在跨基地移动后增加 +1', async ({ browser }, testInfo) => {
    test.setTimeout(120000);
    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const setup = await setupTwoPlayerMatch(browser, baseURL, { skipImageGate: true });
    if (!setup) {
      test.skip(true, '游戏服务器不可用或创建房间失败');
      return;
    }

    const { hostPage, guestPage, matchId } = setup;
    const hostGame = new GameTestContext(hostPage);
    const guestGame = new GameTestContext(guestPage);

    try {
      const initialState = await getMatchState(matchId, hostPage);
      await injectMatchState(matchId, createBringEmInOnlineSceneState(initialState), hostPage);
      await Promise.all([
        waitForHandArea(hostPage),
        waitForHandArea(guestPage),
      ]);

      const bringInCard = hostPage.locator('[data-card-uid="bring-in-card"]');
      await expect(bringInCard).toBeVisible({ timeout: 10000 });
      await bringInCard.click({ force: true });
      await hostPage.waitForTimeout(300);
      await hostPage.locator('[data-minion-uid="bring-in-target"]').click({ force: true });
      await hostGame.waitForNoInteraction(10000);
      await dismissSpotlightIfPresent(hostPage);
      await expect.poll(async () => {
        const state = await getMatchState(matchId, hostPage);
        const target = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'bring-in-target');
        return {
          attachedActions: target?.attachedActions?.map((action: { defId?: string }) => action.defId) ?? [],
          hostDiscard: state.core.players['0']?.discard.map((card: { uid?: string }) => card.uid) ?? [],
          interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
        };
      }, { timeout: 15000 }).toEqual({
        attachedActions: ['mounties_bring_em_in'],
        hostDiscard: [],
        interactionSource: null,
      });
      await hostPage.screenshot({ path: testInfo.outputPath('骑警-带进来-真实手牌附着到对手随从.png'), fullPage: false });

      await hostPage.getByTestId('su-end-turn-action-button').click({ force: true });
      await guestGame.waitForCurrentPlayer('1', 15000);

      await guestGame.playCard('mounties_move_aboot');
      await guestGame.waitForInteraction('mounties_move_aboot', 10000);
      const sourceOptions = await guestGame.getInteractionOptions();
      expect(sourceOptions.map(option => optionValue(option).minionUid)).toEqual(['bring-in-target']);
      await guestGame.selectInteractionOptionBy(
        option => optionValue(option).minionUid === 'bring-in-target',
        '带进来目标随从选择跨基地移动',
      );

      await guestGame.waitForInteraction('mounties_move_aboot_destination', 10000);
      const destinationOptions = await guestGame.getInteractionOptions();
      expect(destinationOptions.map(option => optionValue(option).baseIndex)).toEqual([1]);
      await guestGame.selectInteractionOptionBy(
        option => optionValue(option).baseIndex === 1,
        '带进来目标随从选择另一个基地',
      );
      await expect.poll(async () => {
        const state = await getMatchState(matchId, hostPage);
        const moved = state.core.bases[1]?.minions.find((minion: { uid?: string }) => minion.uid === 'bring-in-target');
        return {
          sourceBase: state.core.bases[0]?.minions.map((minion: { uid?: string }) => minion.uid) ?? [],
          destinationBase: state.core.bases[1]?.minions.map((minion: { uid?: string }) => minion.uid) ?? [],
          powerCounters: moved?.powerCounters ?? 0,
          attachedActions: moved?.attachedActions?.map((action: { defId?: string }) => action.defId) ?? [],
          guestDiscard: state.core.players['1']?.discard.map((card: { uid?: string }) => card.uid) ?? [],
          interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
          triggerQueueLength: state.core.triggerQueue?.length ?? 0,
        };
      }, { timeout: 15000 }).toEqual({
        sourceBase: [],
        destinationBase: ['bring-in-destination', 'bring-in-target'],
        powerCounters: 1,
        attachedActions: ['mounties_bring_em_in'],
        guestDiscard: ['move-aboot-card'],
        interactionSource: null,
        triggerQueueLength: 0,
      });
      await guestPage.waitForTimeout(500);
      await guestPage.screenshot({ path: testInfo.outputPath('骑警-带进来-跨基地移动后增加+1并收口.png'), fullPage: false });
    } finally {
      await cleanupTwoPlayerMatch(setup);
    }
  });

  test('总能抓到目标允许玩家选择非第一组合法组合，并在回合结束摧毁所选目标', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      numPlayers: 3,
      skipInitialization: true,
      seed: 20260920,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'always-get-our-man', defId: 'mounties_always_get_our_man', type: 'action', owner: '0' }],
        factions: ['mounties', 'luchadors'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      player2: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [
        {
          defId: 'base_strategic_syrup_reserve',
          minions: [
            { uid: 'first-own', defId: 'mounties_war_canuck', owner: '0', controller: '0', power: 4 },
            { uid: 'second-own', defId: 'mounties_northern_mover', owner: '0', controller: '0', power: 4 },
          ],
        },
        {
          defId: 'base_great_white_north_eh',
          minions: [
            { uid: 'first-target', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 2 },
          ],
        },
        {
          defId: 'base_ringside',
          minions: [
            { uid: 'second-target', defId: 'sumo_wrestlers_rookie_sumo', owner: '2', controller: '2', power: 2 },
          ],
        },
      ],
    });

    await game.playCard('mounties_always_get_our_man');
    await game.waitForInteraction('mounties_always_get_our_man_source', 10000);
    const sourceOptions = await game.getInteractionOptions();
    expect(sourceOptions.filter(option => ['first-own', 'second-own'].includes(String(optionValue(option).minionUid)))).toHaveLength(2);
    await game.screenshot('骑警-总能抓到目标-选择己方随从', testInfo);
    await game.selectInteractionOptionBy(
      option => optionValue(option).minionUid === 'second-own',
      '总能抓到目标选择第二个己方随从',
    );

    await game.waitForInteraction('mounties_always_get_our_man_target', 10000);
    const targetOptions = await game.getInteractionOptions();
    expect(targetOptions.filter(option => ['first-target', 'second-target'].includes(String(optionValue(option).minionUid)))).toHaveLength(2);
    await game.screenshot('骑警-总能抓到目标-选择较低力量目标', testInfo);
    await game.selectInteractionOptionBy(
      option => optionValue(option).minionUid === 'second-target',
      '总能抓到目标选择第二个合法对手随从',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      const marked = state.core.bases[2]?.minions.find((minion: { uid?: string }) => minion.uid === 'second-target');
      return {
        sourceBase: state.core.bases[0]?.minions.map((minion: { uid?: string }) => minion.uid) ?? [],
        firstTargetBase: state.core.bases[1]?.minions.map((minion: { uid?: string }) => minion.uid) ?? [],
        secondTargetBase: state.core.bases[2]?.minions.map((minion: { uid?: string }) => minion.uid) ?? [],
        marked: Boolean(marked?.metadata?.internationalIncidentAlwaysGetOurMan),
      };
    }, { timeout: 10000 }).toEqual({
      sourceBase: ['first-own'],
      firstTargetBase: ['first-target'],
      secondTargetBase: ['second-target', 'second-own'],
      marked: true,
    });
    await game.screenshot('骑警-总能抓到目标-移动与标记收口', testInfo);

    await page.getByTestId('su-end-turn-action-button').click();
    await page.waitForTimeout(1000);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        firstTargetBase: state.core.bases[1]?.minions.map((minion: { uid?: string }) => minion.uid) ?? [],
        secondTargetBase: state.core.bases[2]?.minions.map((minion: { uid?: string }) => minion.uid) ?? [],
        player2Discard: state.core.players['2']?.discard.map((card: { uid?: string }) => card.uid) ?? [],
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      firstTargetBase: ['first-target'],
      secondTargetBase: ['second-own'],
      player2Discard: ['second-target'],
      interactionSource: null,
    });
    await game.screenshot('骑警-总能抓到目标-回合结束摧毁所选目标', testInfo);
  });

  test('嗯？在第一张行动后可从弃牌堆发动并回手', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      numPlayers: 2,
      skipInitialization: true,
      seed: 20260921,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'first-action', defId: 'ninja_assassination', type: 'action', owner: '0' }],
        discard: [{ uid: 'eh-discard', defId: 'mounties_eh', type: 'action', owner: '0' }],
        factions: ['mounties', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [
        {
          defId: 'base_strategic_syrup_reserve',
          minions: [
            { uid: 'enemy-target', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 3 },
          ],
        },
        {
          defId: 'base_great_white_north_eh',
          minions: [
            { uid: 'eh-ally', defId: 'mounties_dudlee', owner: '0', controller: '0', power: 2 },
          ],
        },
      ],
    });

    await game.playCard('ninja_assassination', { targetBaseIndex: 0, targetMinionUid: 'enemy-target' });
    await game.waitForNoInteraction(10000);

    await page.getByTestId('su-discard-toggle').click();
    const ehCard = page.locator('[data-card-uid="eh-discard"]').last();
    await expect(ehCard).toBeVisible({ timeout: 10000 });
    await game.screenshot('骑警-嗯-第一张行动后弃牌堆可发动', testInfo);
    await ehCard.click();
    await page.waitForTimeout(300);
    await page.locator('[data-minion-uid="eh-ally"]').click({ force: true });
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        tempPower: state.core.bases[1]?.minions.find((minion: { uid?: string }) => minion.uid === 'eh-ally')?.tempPowerModifier ?? 0,
        handUids: state.core.players['0']?.hand.map((card: { uid?: string }) => card.uid) ?? [],
        discardUids: state.core.players['0']?.discard.map((card: { uid?: string }) => card.uid) ?? [],
        usedDiscardPlayAbilities: state.core.players['0']?.usedDiscardPlayAbilities ?? [],
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      tempPower: 1,
      handUids: ['eh-discard'],
      discardUids: [],
      usedDiscardPlayAbilities: ['mounties_eh'],
      interactionSource: null,
    });
    await game.screenshot('骑警-嗯-加力并回手收口', testInfo);
  });

  test('嗯？在第二张行动后不应再从弃牌堆开放', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      numPlayers: 2,
      skipInitialization: true,
      seed: 20260922,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [],
        discard: [{ uid: 'eh-after-second-action', defId: 'mounties_eh', type: 'action', owner: '0' }],
        factions: ['mounties', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 2,
        actionLimit: 2,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [
        {
          defId: 'base_strategic_syrup_reserve',
          minions: [
            { uid: 'eh-after-second-action-ally', defId: 'mounties_dudlee', owner: '0', controller: '0', power: 2 },
          ],
        },
      ],
    });

    await page.getByTestId('su-discard-toggle').click();
    const ehCard = page.locator('[data-card-uid="eh-after-second-action"]').last();
    await expect(ehCard).toBeVisible({ timeout: 10000 });
    await ehCard.click();
    await page.waitForTimeout(500);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        tempPower: state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'eh-after-second-action-ally')?.tempPowerModifier ?? 0,
        discardUids: state.core.players['0']?.discard.map((card: { uid?: string }) => card.uid) ?? [],
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      tempPower: 0,
      discardUids: ['eh-after-second-action'],
      interactionSource: null,
    });
    await game.screenshot('骑警-嗯-第二张行动后不可发动', testInfo);
  });
});
