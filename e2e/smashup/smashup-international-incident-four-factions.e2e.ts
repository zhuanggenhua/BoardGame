import { test, expect } from '../framework';
import type { Page } from '@playwright/test';
import { setChineseLocale } from '../helpers/common';
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
import { stripNonSerializable } from '../../src/engine/systems/InteractionSystem.ts';

const INTERNATIONAL_INCIDENT_ATLAS_ID = 'smashup:international-incident-cards';

type InteractionOption = {
  id?: string;
  value?: unknown;
};

type SmashUpReactionSession = {
  responseWindowType?: string;
};

type SmashUpResolutionFrame = {
  id?: string;
  metadata?: {
    smashupReactionSession?: SmashUpReactionSession;
  };
};

type SmashUpE2EState = {
  core?: {
    currentPlayerIndex?: number;
    turnOrder?: string[];
    factionSelection?: {
      playerSelections?: Record<string, string[]>;
    };
    players?: Record<string, { factions?: string[] }>;
  };
  sys?: {
    phase?: string;
    responseWindow?: {
      current?: {
        windowType?: string;
      };
    };
    resolution?: {
      activeFrameId?: string;
      frames?: SmashUpResolutionFrame[];
    };
  };
};

type SmashUpE2EWindow = Window & {
  __BG_TEST_HARNESS__?: {
    state?: {
      get?: () => SmashUpE2EState;
    };
    command?: {
      dispatch?: (command: { type: string; playerId: string; payload?: unknown }) => Promise<unknown> | unknown;
    };
  };
};

function optionHasBaseIndex(option: InteractionOption, baseIndex: number): boolean {
  const value = option.value;
  return !!value && typeof value === 'object' && (value as { baseIndex?: unknown }).baseIndex === baseIndex;
}

function optionHasBaseDefId(option: InteractionOption, baseDefId: string): boolean {
  const value = option.value;
  return !!value && typeof value === 'object' && (value as { baseDefId?: unknown }).baseDefId === baseDefId;
}

function optionHasMinionUid(option: InteractionOption, minionUid: string): boolean {
  const value = option.value;
  return !!value && typeof value === 'object' && (value as { minionUid?: unknown }).minionUid === minionUid;
}

function optionHasCardUid(option: InteractionOption, cardUid: string): boolean {
  const value = option.value;
  return !!value && typeof value === 'object' && (value as { cardUid?: unknown }).cardUid === cardUid;
}

function optionHasTriggerId(option: InteractionOption, triggerIdPart: string): boolean {
  const value = option.value;
  return !!value
    && typeof value === 'object'
    && String((value as { triggerId?: unknown }).triggerId ?? '').includes(triggerIdPart);
}

function getLiveReactionSession(state: SmashUpE2EState): SmashUpReactionSession | undefined {
  const frames = state.sys?.resolution?.frames ?? [];
  const frameIds = [
    state.sys?.resolution?.activeFrameId,
    ...frames.map(frame => frame.id).reverse(),
  ].filter((frameId): frameId is string => Boolean(frameId));

  for (const frameId of frameIds) {
    const frame = frames.find(candidate => candidate.id === frameId);
    const session = frame?.metadata?.smashupReactionSession;
    if (session) return session;
  }

  return undefined;
}

function isLiveReactionWindow(state: SmashUpE2EState, windowType: string): boolean {
  return getLiveReactionSession(state)?.responseWindowType === windowType;
}

async function closeFactionDetailIfPresent(page: Page): Promise<void> {
  const closeButton = page.getByTestId('faction-detail-close');
  if (await closeButton.isVisible({ timeout: 300 }).catch(() => false)) {
    await closeButton.click({ force: true });
    await expect(page.getByTestId('faction-detail-panel')).toBeHidden({ timeout: 5000 });
    return;
  }
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('faction-detail-panel')).toBeHidden({ timeout: 5000 }).catch(() => {});
}

async function waitForDraftTurn(page: Page, playerId: string, selectedCount: number): Promise<void> {
  await page.waitForFunction(
    ({ playerId, selectedCount }) => {
      const state = (window as SmashUpE2EWindow).__BG_TEST_HARNESS__?.state?.get?.();
      const selection = state?.core?.factionSelection;
      if (!selection) return false;
      const currentPlayerId = state.core?.turnOrder?.[state.core.currentPlayerIndex ?? 0];
      const picks = selection.playerSelections?.[playerId] ?? [];
      return currentPlayerId === playerId && picks.length === selectedCount;
    },
    { playerId, selectedCount },
    { timeout: 20000, polling: 200 },
  );
}

async function pickFaction(
  page: Page,
  options: {
    playerId: string;
    selectedCountBeforePick: number;
    factionId: string;
    beforeConfirm?: () => Promise<void>;
  },
): Promise<void> {
  await waitForDraftTurn(page, options.playerId, options.selectedCountBeforePick);
  await closeFactionDetailIfPresent(page);

  const searchInput = page.getByTestId('faction-search-input');
  await expect(searchInput).toBeVisible({ timeout: 10000 });
  await searchInput.fill(options.factionId);

  const faction = page.getByTestId(`faction-option-${options.factionId}`);
  await faction.scrollIntoViewIfNeeded({ timeout: 15000 });
  await expect(faction).toBeVisible({ timeout: 15000 });
  await faction.click();
  await expect(page.getByTestId('faction-detail-panel')).toBeVisible({ timeout: 10000 });

  await expect.poll(async () => page.evaluate((atlasId) => (
    document.querySelectorAll(`[data-card-atlas-id="${atlasId}"]`).length
  ), INTERNATIONAL_INCIDENT_ATLAS_ID), { timeout: 20000 }).toBeGreaterThan(0);

  await options.beforeConfirm?.();

  const confirmButton = page.getByTestId('faction-confirm-button');
  await expect(confirmButton).toBeVisible({ timeout: 10000 });
  await expect(confirmButton).toBeEnabled({ timeout: 10000 });
  await confirmButton.click();

  const selectionDeadline = Date.now() + 20000;
  let lastSelectionState: Record<string, unknown> | null = null;
  while (Date.now() < selectionDeadline) {
    lastSelectionState = await page.evaluate(({ playerId, factionId }) => {
      const state = (window as SmashUpE2EWindow).__BG_TEST_HARNESS__?.state?.get?.();
      const selected = state?.core?.factionSelection?.playerSelections?.[playerId] ?? [];
      const finalFactions = state?.core?.players?.[playerId]?.factions ?? [];
      const currentPlayerId = state?.core?.turnOrder?.[state?.core?.currentPlayerIndex ?? 0] ?? null;
      return {
        matched: selected.includes(factionId) || finalFactions.includes(factionId),
        phase: state?.sys?.phase ?? null,
        currentPlayerId,
        selected,
        finalFactions,
      };
    }, { playerId: options.playerId, factionId: options.factionId });
    if (lastSelectionState.matched === true) return;
    await page.waitForTimeout(200);
  }
  throw new Error(`派系选择未落地: ${options.playerId}/${options.factionId} ${JSON.stringify(lastSelectionState)}`);
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

function createInternationalIncidentMeFirstState(baseState: any, frameId: string, baseIndex: number): any {
  initAllAbilities();

  let state = {
    ...baseState,
    core: {
      ...baseState.core,
      scoringEligibleBaseIndices: [baseIndex],
      triggerQueue: baseState.core?.triggerQueue ?? [],
    },
    sys: {
      ...baseState.sys,
      phase: 'scoreBases',
      interaction: { current: undefined, queue: [] },
      responseWindow: { current: undefined },
    },
  };

  const baseRef = createScoringBaseRef(state.core, baseIndex);
  if (!baseRef) {
    throw new Error(`无法构造国际事件计分基地引用: ${baseIndex}`);
  }

  state = setScoringSession(state, {
    ...createScoringSession(state.core, [baseIndex]),
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
    sourceBaseIndex: baseIndex,
    responseWindowType: 'meFirst',
  });

  const advancedState = advanceSmashUpReactionSession(
    state,
    FIXED_SMASHUP_RANDOM as any,
    20260921,
  )?.state ?? state;
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

async function playDiscardSpecialOnMinion(page: Page, cardUid: string, minionUid: string): Promise<void> {
  await page.getByTestId('su-discard-toggle').click();
  const discardCard = page.locator(`[data-card-uid="${cardUid}"]`).last();
  await expect(discardCard).toBeVisible({ timeout: 10000 });
  await discardCard.click();
  await page.waitForTimeout(300);

  const target = page.locator(`[data-minion-uid="${minionUid}"]`);
  await expect(target).toBeVisible({ timeout: 10000 });
  await target.click();
  await page.waitForTimeout(300);
}

async function respondCurrentInteraction(
  page: Page,
  payload: { optionId?: string; optionIds?: string[] },
): Promise<void> {
  await page.evaluate(async (responsePayload) => {
    const harness = (window as SmashUpE2EWindow).__BG_TEST_HARNESS__;
    const current = harness?.state?.get?.()?.sys?.interaction?.current;
    if (!current?.playerId || !harness?.command?.dispatch) {
      throw new Error('No active interaction to respond to');
    }
    await harness.command.dispatch({
      type: 'SYS_INTERACTION_RESPOND',
      playerId: current.playerId,
      payload: responsePayload,
    });
  }, payload);
  await page.waitForTimeout(300);
}

async function respondWithOptionIds(
  page: Page,
  game: { getInteractionOptions: () => Promise<InteractionOption[]> },
  matchers: Array<(option: InteractionOption) => boolean>,
): Promise<void> {
  const options = await game.getInteractionOptions();
  const selectedOptionIds = matchers.map((matcher, index) => {
    const option = options.find(matcher);
    if (!option?.id) {
      throw new Error(`Interaction option ${index + 1} not found`);
    }
    return option.id;
  });
  await respondCurrentInteraction(page, { optionIds: selectedOptionIds });
}

test.describe('大杀四方《环游世界：国际事件》四派系真实入口验证', () => {
  test('真实选秀能选择相扑手、火枪手、骑警、摔角手并进入牌桌', async ({ page, game }, testInfo) => {
    test.setTimeout(180000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      seed: 20260714,
      seat1ManualSetup: true,
    }, 45000);
    await expect(page.locator('[data-tutorial-id="su-faction-select"]')).toBeVisible({ timeout: 30000 });

    await pickFaction(page, {
      playerId: '0',
      selectedCountBeforePick: 0,
      factionId: 'sumo_wrestlers',
      beforeConfirm: () => game.screenshot('01-相扑手-派系预览', testInfo),
    });
    await pickFaction(page, {
      playerId: '1',
      selectedCountBeforePick: 0,
      factionId: 'musketeers',
      beforeConfirm: () => game.screenshot('02-火枪手-派系预览', testInfo),
    });
    await pickFaction(page, {
      playerId: '1',
      selectedCountBeforePick: 1,
      factionId: 'mounties',
      beforeConfirm: () => game.screenshot('03-骑警-派系预览', testInfo),
    });
    await pickFaction(page, {
      playerId: '0',
      selectedCountBeforePick: 1,
      factionId: 'luchadors',
      beforeConfirm: () => game.screenshot('04-摔角手-派系预览', testInfo),
    });

    await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 30000 });
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        p0: [...(state?.core?.players?.['0']?.factions ?? [])].sort(),
        p1: [...(state?.core?.players?.['1']?.factions ?? [])].sort(),
      };
    }, { timeout: 20000 }).toEqual({
      p0: ['luchadors', 'sumo_wrestlers'],
      p1: ['mounties', 'musketeers'],
    });
    await game.screenshot('05-国际事件-真实选秀开局完成', testInfo);
  });

  test('四派系代表能力可从真实手牌或弃牌堆入口结算到权威状态', async ({ page, game }, testInfo) => {
    test.setTimeout(180000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'sumo_wrestlers,musketeers',
      p1: 'mounties,luchadors',
      skipFactionSelect: true,
      seed: 20260714,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'technique-prize', defId: 'sumo_wrestlers_technique_prize', type: 'action', owner: '0' },
        ],
        factions: ['sumo_wrestlers', 'musketeers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 2,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [
        {
          defId: 'base_the_dohyo',
          minions: [
            { uid: 'sumo-target', defId: 'sumo_wrestlers_rookie_sumo', owner: '0', controller: '0', power: 2 },
            { uid: 'sumo-other', defId: 'sumo_wrestlers_third_tier', owner: '0', controller: '0', power: 3 },
            { uid: 'enemy-musketeer', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 3 },
          ],
        },
      ],
    });

    await game.playCard('sumo_wrestlers_technique_prize');
    await game.waitForInteraction('sumo_wrestlers_technique_prize', 10000);
    await game.screenshot('06-技术奖-选择己方随从', testInfo);
    await game.selectInteractionOptionBy(option => optionHasMinionUid(option, 'sumo-target'), '技术奖选择相扑新人');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const minions = state.core.bases[0]?.minions ?? [];
      return minions.map((minion: { uid?: string; powerCounters?: number }) => ({
        uid: minion.uid,
        counters: minion.powerCounters ?? 0,
      }));
    }, { timeout: 5000 }).toEqual([
      { uid: 'sumo-target', counters: 3 },
      { uid: 'sumo-other', counters: 0 },
      { uid: 'enemy-musketeer', counters: 0 },
    ]);
    await game.screenshot('07-技术奖-力量指示物结算后', testInfo);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'one-for-all', defId: 'musketeers_one_for_all', type: 'action', owner: '0' },
        ],
        factions: ['sumo_wrestlers', 'musketeers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 2,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [
        {
          defId: 'base_bastion_saint_gervais',
          minions: [
            { uid: 'base-zero-ally', defId: 'sumo_wrestlers_rookie_sumo', owner: '0', controller: '0', power: 2 },
          ],
        },
        {
          defId: 'base_the_golden_lily',
          minions: [
            { uid: 'base-one-ally-a', defId: 'sumo_wrestlers_third_tier', owner: '0', controller: '0', power: 3 },
            { uid: 'base-one-ally-b', defId: 'sumo_wrestlers_rookie_sumo', owner: '0', controller: '0', power: 2 },
            { uid: 'base-one-enemy', defId: 'mounties_dudlee', owner: '1', controller: '1', power: 2 },
          ],
        },
      ],
    });

    await game.playCard('musketeers_one_for_all');
    await game.waitForInteraction('musketeers_one_for_all', 10000);
    await game.screenshot('08-一为全-选择目标基地', testInfo);
    await game.selectInteractionOptionBy(option => optionHasBaseIndex(option, 1), '一为全选择黄金百合花');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        base0: state.core.bases[0]?.minions.map((minion: { tempPowerModifier?: number }) => minion.tempPowerModifier ?? 0),
        base1: state.core.bases[1]?.minions.map((minion: { tempPowerModifier?: number }) => minion.tempPowerModifier ?? 0),
        actionLimit: state.core.players['0']?.actionLimit,
      };
    }, { timeout: 5000 }).toEqual({
      base0: [0],
      base1: [1, 1, 0],
      actionLimit: 3,
    });
    await game.screenshot('09-一为全-所选基地强化后', testInfo);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [],
        discard: [
          { uid: 'eh-discard', defId: 'mounties_eh', type: 'action', owner: '0' },
        ],
        factions: ['mounties', 'luchadors'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 1,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [
        {
          defId: 'base_great_white_north_eh',
          minions: [
            { uid: 'mountie-target', defId: 'mounties_dudlee', owner: '0', controller: '0', power: 2 },
            { uid: 'enemy-on-north', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 3 },
          ],
        },
      ],
    });

    await game.screenshot('10-嗯-弃牌堆special可用前', testInfo);
    await playDiscardSpecialOnMinion(page, 'eh-discard', 'mountie-target');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const target = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'mountie-target');
      return {
        tempPower: target?.tempPowerModifier ?? 0,
        handUids: state.core.players['0']?.hand.map((card: { uid?: string }) => card.uid) ?? [],
        discardUids: state.core.players['0']?.discard.map((card: { uid?: string }) => card.uid) ?? [],
        usedDiscardPlayAbilities: state.core.players['0']?.usedDiscardPlayAbilities ?? [],
      };
    }, { timeout: 5000 }).toEqual({
      tempPower: 1,
      handUids: ['eh-discard'],
      discardUids: [],
      usedDiscardPlayAbilities: ['mounties_eh'],
    });
    await game.screenshot('11-嗯-弃牌堆special结算后', testInfo);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'quick-setup', defId: 'luchadors_quick_set_up', type: 'action', owner: '0' },
          { uid: 'smart-setup', defId: 'luchadors_smart_set_up', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'ringside-draw-a', defId: 'luchadors_tag_team', type: 'action', owner: '0' },
          { uid: 'ringside-draw-b', defId: 'luchadors_cheap_pop', type: 'action', owner: '0' },
        ],
        factions: ['mounties', 'luchadors'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [
        {
          defId: 'base_ringside',
          minions: [
            { uid: 'friendly-luchador', defId: 'luchadors_yellow_demon', owner: '0', controller: '0', power: 2 },
            { uid: 'setup-host', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 3 },
          ],
        },
      ],
    });

    await game.playCard('luchadors_quick_set_up', { targetMinionUid: 'setup-host' });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const host = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'setup-host');
      return {
        attached: host?.attachedActions.map((action: { defId?: string }) => action.defId) ?? [],
        actionLimit: state.core.players['0']?.actionLimit,
        actionsPlayed: state.core.players['0']?.actionsPlayed,
      };
    }, { timeout: 5000 }).toEqual({
      attached: ['luchadors_quick_set_up'],
      actionLimit: 2,
      actionsPlayed: 1,
    });
    await game.screenshot('12-快速Set-Up-附着并获得额外行动后', testInfo);

    await game.playCard('luchadors_smart_set_up', { targetMinionUid: 'setup-host' });
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      const host = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'setup-host');
      return {
        attached: host?.attachedActions.map((action: { defId?: string }) => action.defId) ?? [],
        handUids: state.core.players['0']?.hand.map((card: { uid?: string }) => card.uid) ?? [],
        deckCount: state.core.players['0']?.deck.length,
      };
    }, { timeout: 5000 }).toEqual({
      attached: ['luchadors_quick_set_up', 'luchadors_smart_set_up'],
      handUids: ['ringside-draw-a', 'ringside-draw-b'],
      deckCount: 0,
    });
    await game.screenshot('13-聪明Set-Up-额外行动附着后', testInfo);
  });

  test('炖肉允许真实入口空选，也能多选手牌后给己方随从放指示物', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'sumo_wrestlers,musketeers',
      p1: 'mounties,luchadors',
      skipFactionSelect: true,
      seed: 20260715,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'stew-skip', defId: 'sumo_wrestlers_bulking_stew', type: 'action', owner: '0' },
          { uid: 'stew-skip-card-a', defId: 'sumo_wrestlers_performance_prize', type: 'action', owner: '0' },
          { uid: 'stew-skip-card-b', defId: 'musketeers_young_musketeer', type: 'minion', owner: '0' },
        ],
        factions: ['sumo_wrestlers', 'musketeers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [
        {
          defId: 'base_the_dohyo',
          minions: [
            { uid: 'stew-skip-target', defId: 'sumo_wrestlers_rookie_sumo', owner: '0', controller: '0', power: 2 },
          ],
        },
      ],
    });

    await game.playCard('sumo_wrestlers_bulking_stew');
    await game.waitForInteraction('sumo_wrestlers_bulking_stew_discard', 10000);
    await game.screenshot('19-炖肉-空选手牌弃置交互', testInfo);
    await respondCurrentInteraction(page, { optionIds: [] });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      const target = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'stew-skip-target');
      return {
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
        discardFodderUids: player.discard
          .map((card: { uid?: string }) => card.uid)
          .filter((uid?: string) => uid === 'stew-skip-card-a' || uid === 'stew-skip-card-b'),
        targetCounters: target?.powerCounters ?? 0,
      };
    }, { timeout: 5000 }).toEqual({
      handUids: ['stew-skip-card-a', 'stew-skip-card-b'],
      discardFodderUids: [],
      targetCounters: 0,
    });
    await game.screenshot('20-炖肉-空选后手牌与指示物不变', testInfo);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'stew-select', defId: 'sumo_wrestlers_bulking_stew', type: 'action', owner: '0' },
          { uid: 'stew-select-card-a', defId: 'sumo_wrestlers_performance_prize', type: 'action', owner: '0' },
          { uid: 'stew-select-card-b', defId: 'musketeers_young_musketeer', type: 'minion', owner: '0' },
        ],
        factions: ['sumo_wrestlers', 'musketeers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [
        {
          defId: 'base_the_dohyo',
          minions: [
            { uid: 'stew-select-target', defId: 'sumo_wrestlers_rookie_sumo', owner: '0', controller: '0', power: 2 },
            { uid: 'stew-select-other', defId: 'sumo_wrestlers_third_tier', owner: '0', controller: '0', power: 3 },
          ],
        },
      ],
    });

    await game.playCard('sumo_wrestlers_bulking_stew');
    await game.waitForInteraction('sumo_wrestlers_bulking_stew_discard', 10000);
    await game.screenshot('21-炖肉-多选手牌弃置交互', testInfo);
    await respondWithOptionIds(page, game, [
      option => optionHasCardUid(option, 'stew-select-card-a'),
      option => optionHasCardUid(option, 'stew-select-card-b'),
    ]);

    await game.waitForInteraction('sumo_wrestlers_bulking_stew_target', 10000);
    await game.screenshot('22-炖肉-选择承接指示物随从', testInfo);
    await game.selectInteractionOptionBy(option => optionHasMinionUid(option, 'stew-select-target'), '炖肉选择相扑新人');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      const minions = state.core.bases[0]?.minions ?? [];
      return {
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
        discardFodderUids: player.discard
          .map((card: { uid?: string }) => card.uid)
          .filter((uid?: string) => uid === 'stew-select-card-a' || uid === 'stew-select-card-b'),
        counters: minions.map((minion: { uid?: string; powerCounters?: number }) => ({
          uid: minion.uid,
          counters: minion.powerCounters ?? 0,
        })),
      };
    }, { timeout: 5000 }).toEqual({
      handUids: [],
      discardFodderUids: ['stew-select-card-a', 'stew-select-card-b'],
      counters: [
        { uid: 'stew-select-target', counters: 2 },
        { uid: 'stew-select-other', counters: 0 },
      ],
    });
    await game.screenshot('23-炖肉-多选结算后力量指示物增加', testInfo);
  });

  test('斗志奖可从真实入口抽牌并分配力量指示物', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'sumo_wrestlers,musketeers',
      p1: 'mounties,luchadors',
      skipFactionSelect: true,
      seed: 20260715,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'spirit-prize', defId: 'sumo_wrestlers_fighting_spirit_prize', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'spirit-draw-a', defId: 'sumo_wrestlers_rookie_sumo', type: 'minion', owner: '0' },
          { uid: 'spirit-draw-b', defId: 'sumo_wrestlers_chikara_mizu', type: 'action', owner: '0' },
        ],
        factions: ['sumo_wrestlers', 'musketeers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [
        {
          defId: 'base_the_dohyo',
          minions: [
            { uid: 'spirit-target-a', defId: 'sumo_wrestlers_rookie_sumo', owner: '0', controller: '0', power: 2 },
            { uid: 'spirit-target-b', defId: 'sumo_wrestlers_top_tier', owner: '0', controller: '0', power: 4 },
            { uid: 'spirit-enemy', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 3 },
          ],
        },
      ],
    });

    await game.playCard('sumo_wrestlers_fighting_spirit_prize');
    await game.waitForInteraction('sumo_wrestlers_fighting_spirit_prize', 10000);
    await game.screenshot('28-斗志奖-选择分配力量指示物随从', testInfo);
    await respondWithOptionIds(page, game, [
      option => optionHasMinionUid(option, 'spirit-target-a'),
      option => optionHasMinionUid(option, 'spirit-target-b'),
    ]);
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      const minions = state.core.bases[0]?.minions ?? [];
      return {
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
        deckUids: player.deck.map((card: { uid?: string }) => card.uid),
        counters: minions.map((minion: { uid?: string; powerCounters?: number }) => ({
          uid: minion.uid,
          counters: minion.powerCounters ?? 0,
        })),
      };
    }, { timeout: 5000 }).toEqual({
      handUids: ['spirit-draw-a', 'spirit-draw-b'],
      deckUids: [],
      counters: [
        { uid: 'spirit-target-a', counters: 1 },
        { uid: 'spirit-target-b', counters: 1 },
        { uid: 'spirit-enemy', counters: 0 },
      ],
    });
    await game.screenshot('29-斗志奖-抽牌并分配指示物后', testInfo);
  });

  test('计分前 special 与压制可从真实入口影响最终权威状态', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'mounties,luchadors',
      p1: 'sumo_wrestlers,musketeers',
      skipFactionSelect: true,
      seed: 20260715,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'scoreBases',
      player0: {
        hand: [
          { uid: 'badge-special', defId: 'mounties_when_calls_the_badge', type: 'action', owner: '0' },
        ],
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
          breakpoint: 7,
          minions: [
            { uid: 'badge-target-a', defId: 'mounties_dudlee', owner: '0', controller: '0', power: 2 },
            { uid: 'badge-target-b', defId: 'mounties_war_canuck', owner: '0', controller: '0', power: 3 },
            { uid: 'badge-enemy', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 3 },
          ],
        },
        {
          defId: 'base_the_golden_lily',
          minions: [
            { uid: 'badge-other-base', defId: 'mounties_northern_mover', owner: '0', controller: '0', power: 4 },
          ],
        },
      ],
    });

    const baseState = await game.getState();
    await setHarnessState(
      page,
      createInternationalIncidentMeFirstState(baseState, 'score-before:international-badge-special', 0),
    );

    await page.waitForFunction(
      () => {
        const state = (window as SmashUpE2EWindow).__BG_TEST_HARNESS__?.state?.get?.();
        const frames = state?.sys?.resolution?.frames ?? [];
        const frameIds = [
          state?.sys?.resolution?.activeFrameId,
          ...frames.map(frame => frame.id).reverse(),
        ].filter((frameId): frameId is string => Boolean(frameId));
        const session = frameIds
          .map(frameId => frames.find(frame => frame.id === frameId)?.metadata?.smashupReactionSession)
          .find(Boolean);
        return state?.sys?.phase === 'scoreBases' && session?.responseWindowType === 'meFirst';
      },
      { timeout: 20000, polling: 200 },
    );
    await game.screenshot('14-呼叫警徽-计分前响应窗口', testInfo);

    const badgeCard = page.locator('[data-testid="su-hand-area"] [data-card-uid="badge-special"]');
    await expect(badgeCard).toBeVisible({ timeout: 10000 });
    await badgeCard.click({ force: true });
    await game.selectBase(0);
    await dismissSpotlightIfPresent(page);
    await game.screenshot('15-呼叫警徽-选择基地并结算', testInfo);

    await expect.poll(async () => {
      const state = await game.getState();
      const interactionSource = state.sys.interaction?.current?.data?.sourceId ?? null;
      return {
        scoringBaseCounters: state.core.bases[0]?.minions.map((minion: { powerCounters?: number }) => minion.powerCounters ?? 0),
        otherBaseCounters: state.core.bases[1]?.minions.map((minion: { powerCounters?: number }) => minion.powerCounters ?? 0),
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
        badgeInteractionCleared: interactionSource !== 'mounties_when_calls_the_badge',
      };
    }, { timeout: 10000 }).toMatchObject({
      scoringBaseCounters: [1, 1, 0],
      otherBaseCounters: [0],
      triggerQueueLength: 0,
      badgeInteractionCleared: true,
    });
    await game.screenshot('16-呼叫警徽-计分前special结算后', testInfo);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'pin-card', defId: 'luchadors_pin', type: 'action', owner: '0' },
        ],
        factions: ['mounties', 'luchadors'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player1: {
        factions: ['sumo_wrestlers', 'musketeers'],
        vp: 0,
      },
      bases: [
        {
          defId: 'base_ringside',
          minions: [
            { uid: 'pin-flor', defId: 'luchadors_flor_loca', owner: '0', controller: '0', basePower: 11 },
            { uid: 'pin-enemy-small', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', basePower: 10 },
            { uid: 'pin-enemy-big', defId: 'musketeers_dartagnan', owner: '1', controller: '1', power: 6 },
          ],
        },
      ],
    });

    await game.playCard('luchadors_pin', { targetMinionUid: 'pin-enemy-big' });
    await game.waitForInteraction('smashup_reaction_choose', 10000);
    await game.selectInteractionOptionBy(
      option => optionHasTriggerId(option, 'base_ringside'),
      '压制选择擂台边强制反应',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const host = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'pin-enemy-big');
      return host?.attachedActions.map((action: { defId?: string }) => action.defId) ?? [];
    }, { timeout: 5000 }).toEqual(['luchadors_pin']);
    await game.screenshot('17-压制-真实附着后', testInfo);

    await page.getByTestId('su-end-turn-action-button').click();
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        p0Vp: state.core.players['0']?.vp,
        p1Vp: state.core.players['1']?.vp,
        phase: state.sys.phase,
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 20000 }).toMatchObject({
      p0Vp: 4,
      p1Vp: 2,
      triggerQueueLength: 0,
      interactionSource: null,
    });
    await game.screenshot('18-压制-计分排除目标力量后', testInfo);
  });

  test('逆转可从真实计分前窗口夺控并摧毁己方 Set-Up 行动', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'luchadors,mounties',
      p1: 'sumo_wrestlers,musketeers',
      skipFactionSelect: true,
      seed: 20260715,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'reversal-card', defId: 'luchadors_reversal', type: 'action', owner: '0' },
        ],
        factions: ['luchadors', 'mounties'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [
        {
          defId: 'base_ringside',
          minions: [
            { uid: 'reversal-ally', defId: 'luchadors_yellow_demon', owner: '0', controller: '0', basePower: 9 },
            {
              uid: 'reversal-target',
              defId: 'musketeers_young_musketeer',
              owner: '1',
              controller: '1',
              basePower: 12,
              attachedActions: [
                { uid: 'rev-quick', defId: 'luchadors_quick_set_up', ownerId: '0' },
                { uid: 'rev-smart', defId: 'luchadors_smart_set_up', ownerId: '0' },
                { uid: 'rev-enemy-action', defId: 'musketeers_all_for_one', ownerId: '1' },
              ],
            },
          ],
        },
      ],
    });

    await game.waitForPhase('playCards');
    await game.waitForCurrentPlayer('0');
    await page.getByTestId('su-end-turn-action-button').click();

    await page.waitForFunction(
      () => {
        const state = (window as SmashUpE2EWindow).__BG_TEST_HARNESS__?.state?.get?.();
        const frames = state?.sys?.resolution?.frames ?? [];
        const frameIds = [
          state?.sys?.resolution?.activeFrameId,
          ...frames.map(frame => frame.id).reverse(),
        ].filter((frameId): frameId is string => Boolean(frameId));
        const session = frameIds
          .map(frameId => frames.find(frame => frame.id === frameId)?.metadata?.smashupReactionSession)
          .find(Boolean);
        return state?.sys?.phase === 'scoreBases' && session?.responseWindowType === 'meFirst';
      },
      { timeout: 20000, polling: 200 },
    );
    await game.screenshot('30-逆转-计分前响应窗口', testInfo);

    await game.playCard('luchadors_reversal', { targetBaseIndex: 0 });
    await game.waitForInteraction('luchadors_reversal_destroy_actions', 10000);
    await game.screenshot('31-逆转-选择摧毁己方Set-Up行动', testInfo);
    await respondWithOptionIds(page, game, [
      option => optionHasCardUid(option, 'rev-quick'),
      option => optionHasCardUid(option, 'rev-smart'),
    ]);

    await game.waitForInteraction('smashup_reaction_choose', 10000);
    await game.selectInteractionOptionBy(
      option => optionHasTriggerId(option, 'base_ringside'),
      '逆转夺控后选择擂台边强制反应',
    );
    await game.waitForInteraction('smashup_reaction_choose', 10000);
    await game.selectInteractionOptionBy(
      option => optionHasTriggerId(option, 'musketeers_all_for_one'),
      '逆转后选择全为一强制反应',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      const attachedSetupUidsOnBoard = state.core.bases.flatMap((base: {
        minions?: Array<{ attachedActions?: Array<{ uid?: string }> }>;
      }) => (base.minions ?? []).flatMap(minion => minion.attachedActions ?? []))
        .map((action: { uid?: string }) => action.uid)
        .filter((uid?: string) => uid === 'rev-quick' || uid === 'rev-smart');
      return {
        p0Vp: player.vp,
        p1Vp: state.core.players['1']?.vp,
        discardUids: player.discard
          .map((card: { uid?: string }) => card.uid)
          .filter((uid?: string) => uid === 'rev-quick' || uid === 'rev-smart'),
        attachedSetupUidsOnBoard,
        responseWindow: getLiveReactionSession(state) ?? null,
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      p0Vp: 4,
      p1Vp: 0,
      discardUids: ['rev-quick', 'rev-smart'],
      attachedSetupUidsOnBoard: [],
      responseWindow: null,
      triggerQueueLength: 0,
      interactionSource: null,
    });
    await game.screenshot('32-逆转-夺控计分并摧毁行动后', testInfo);
  });

  test('最后一搏可从真实计分前窗口反超计分并抽牌', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'musketeers,sumo_wrestlers',
      p1: 'mounties,luchadors',
      skipFactionSelect: true,
      seed: 20260715,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'last-stand-card', defId: 'musketeers_last_stand', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'last-stand-draw', defId: 'musketeers_en_garde', type: 'action', owner: '0' },
        ],
        factions: ['musketeers', 'sumo_wrestlers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player1: {
        factions: ['mounties', 'luchadors'],
        vp: 0,
      },
      bases: [
        {
          defId: 'base_the_dohyo',
          minions: [
            { uid: 'last-stand-guard', defId: 'musketeers_young_musketeer', owner: '0', controller: '0', basePower: 8 },
            { uid: 'last-stand-enemy', defId: 'mounties_dudlee', owner: '1', controller: '1', basePower: 9 },
          ],
        },
      ],
    });

    await game.waitForPhase('playCards');
    await game.waitForCurrentPlayer('0');
    await page.getByTestId('su-end-turn-action-button').click();

    await page.waitForFunction(
      () => {
        const state = (window as SmashUpE2EWindow).__BG_TEST_HARNESS__?.state?.get?.();
        const frames = state?.sys?.resolution?.frames ?? [];
        const frameIds = [
          state?.sys?.resolution?.activeFrameId,
          ...frames.map(frame => frame.id).reverse(),
        ].filter((frameId): frameId is string => Boolean(frameId));
        const session = frameIds
          .map(frameId => frames.find(frame => frame.id === frameId)?.metadata?.smashupReactionSession)
          .find(Boolean);
        return state?.sys?.phase === 'scoreBases' && session?.responseWindowType === 'meFirst';
      },
      { timeout: 20000, polling: 200 },
    );
    await game.screenshot('33-最后一搏-计分前响应窗口', testInfo);
    await dismissSpotlightIfPresent(page);

    await game.playCard('musketeers_last_stand', {
      targetBaseIndex: 0,
    });
    await game.waitForInteraction('musketeers_last_stand', 10000);
    await game.selectInteractionOptionBy(
      option => optionHasMinionUid(option, 'last-stand-guard'),
      '最后一搏选择计分基地上的己方随从',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    const lastStandFinalState = await game.getState();
    const lastStandSettlement = await page.evaluate(() => {
      const state = (window as SmashUpE2EWindow).__BG_TEST_HARNESS__?.state?.get?.();
      const events = (state?.sys?.eventStream?.entries ?? [])
        .map((entry: { event?: { type?: string; payload?: any } }) => entry.event)
        .filter((event: { type?: string } | undefined): event is { type: string; payload?: any } => Boolean(event?.type));
      const reshuffle = [...events].reverse().find(event => (
        event.type === 'su:deck_reshuffled'
        && event.payload?.playerId === '0'
        && Array.isArray(event.payload?.deckUids)
        && event.payload.deckUids.includes('last-stand-card')
        && event.payload.deckUids.includes('last-stand-guard')
      ));
      const reshuffleIndex = reshuffle ? events.indexOf(reshuffle) : -1;
      const drawnAfterReshuffle = reshuffleIndex >= 0
        ? events.slice(reshuffleIndex + 1).find(event => (
          event.type === 'su:cards_drawn'
          && event.payload?.playerId === '0'
          && Array.isArray(event.payload?.cardUids)
          && event.payload.cardUids.includes('last-stand-card')
          && event.payload.cardUids.includes('last-stand-guard')
        ))
        : undefined;
      return {
        actionPlayed: events.some(event => (
          event.type === 'su:action_played' && event.payload?.cardUid === 'last-stand-card'
        )),
        baseCleared: events.some(event => (
          event.type === 'su:base_cleared' && event.payload?.baseDefId === 'base_the_dohyo'
        )),
        baseReplaced: events.some(event => (
          event.type === 'su:base_replaced' && event.payload?.oldBaseDefId === 'base_the_dohyo'
        )),
        reshuffledUids: reshuffle?.payload?.deckUids ?? [],
        drawnAfterReshuffle: drawnAfterReshuffle?.payload?.cardUids ?? [],
      };
    });
    expect(lastStandSettlement.actionPlayed).toBe(true);
    expect(lastStandSettlement.baseCleared).toBe(true);
    expect(lastStandSettlement.baseReplaced).toBe(true);
    expect(lastStandSettlement.reshuffledUids).toEqual(
      expect.arrayContaining(['last-stand-card', 'last-stand-guard']),
    );
    expect(lastStandSettlement.drawnAfterReshuffle).toEqual(
      expect.arrayContaining(['last-stand-card', 'last-stand-guard']),
    );
    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      return {
        p0Vp: player.vp,
        p1Vp: state.core.players['1']?.vp,
        responseWindow: getLiveReactionSession(state) ?? null,
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      p0Vp: 3,
      p1Vp: 2,
      responseWindow: null,
      triggerQueueLength: 0,
      interactionSource: null,
    });
    await game.screenshot('34-最后一搏-反超计分并抽牌后', testInfo);
  });

  test('Capa Roja 可从真实计分前窗口摧毁低印制力量随从并反超计分', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'luchadors,mounties',
      p1: 'sumo_wrestlers,musketeers',
      skipFactionSelect: true,
      seed: 20260715,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [],
        factions: ['luchadors', 'mounties'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player1: {
        factions: ['sumo_wrestlers', 'musketeers'],
        vp: 0,
      },
      bases: [
        {
          defId: 'base_ringside',
          minions: [
            { uid: 'capa-roja', defId: 'luchadors_capa_roja', owner: '0', controller: '0', basePower: 11 },
            { uid: 'capa-target', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', basePower: 12 },
          ],
        },
      ],
    });

    await game.waitForPhase('playCards');
    await game.waitForCurrentPlayer('0');
    await page.getByTestId('su-end-turn-action-button').click();

    await game.waitForInteraction('luchadors_capa_roja', 10000);
    await game.screenshot('35-CapaRoja-计分前选择低印制力量随从', testInfo);
    await respondWithOptionIds(page, game, [
      option => optionHasMinionUid(option, 'capa-target'),
    ]);

    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const player1DiscardUids = state.core.players['1']?.discard.map((card: { uid?: string }) => card.uid) ?? [];
      return {
        p0Vp: state.core.players['0']?.vp,
        p1Vp: state.core.players['1']?.vp,
        targetInDiscard: player1DiscardUids.includes('capa-target'),
        responseWindow: getLiveReactionSession(state) ?? null,
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      p0Vp: 4,
      p1Vp: 0,
      targetInDiscard: true,
      responseWindow: null,
      triggerQueueLength: 0,
      interactionSource: null,
    });
    await game.screenshot('36-CapaRoja-摧毁目标并反超计分后', testInfo);
  });

  test('阿拉密斯可从真实反应窗口获得并消费限定额外行动', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'musketeers,sumo_wrestlers',
      p1: 'mounties,luchadors',
      skipFactionSelect: true,
      seed: 20260715,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'aramis-en-garde', defId: 'musketeers_en_garde', type: 'action', owner: '0' },
          { uid: 'aramis-biding-time', defId: 'musketeers_biding_time', type: 'action', owner: '0' },
        ],
        factions: ['musketeers', 'sumo_wrestlers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [
        {
          defId: 'base_bastion_saint_gervais',
          minions: [
            { uid: 'aramis', defId: 'musketeers_aramis', owner: '0', controller: '0', power: 4 },
          ],
        },
      ],
    });

    await game.playCard('musketeers_en_garde', { targetMinionUid: 'aramis' });
    await page.waitForFunction(() => {
      const harness = (window as SmashUpE2EWindow).__BG_TEST_HARNESS__;
      const options = harness?.state?.get?.()?.sys?.interaction?.current?.data?.options ?? [];
      return options.some((option: InteractionOption) => String(
        (option.value as { triggerId?: unknown } | undefined)?.triggerId ?? '',
      ).includes('musketeers_aramis'));
    }, { timeout: 10000, polling: 200 });
    await game.screenshot('37-阿拉密斯-真实反应窗口', testInfo);
    await game.selectInteractionOptionBy(
      option => optionHasTriggerId(option, 'musketeers_aramis'),
      '阿拉密斯选择强制反应',
    );

    await page.waitForFunction(() => {
      const harness = (window as SmashUpE2EWindow).__BG_TEST_HARNESS__;
      const options = harness?.state?.get?.()?.sys?.interaction?.current?.data?.options ?? [];
      return options.some((option: InteractionOption) => (
        (option.value as { cardUid?: unknown } | undefined)?.cardUid === 'aramis-biding-time'
      ));
    }, { timeout: 10000, polling: 200 });
    await game.screenshot('38-阿拉密斯-限定额外行动候选', testInfo);
    await game.selectInteractionOptionBy(
      option => optionHasCardUid(option, 'aramis-biding-time'),
      '阿拉密斯消费等待时机额外行动',
    );
    await page.waitForFunction(() => {
      const harness = (window as SmashUpE2EWindow).__BG_TEST_HARNESS__;
      const options = harness?.state?.get?.()?.sys?.interaction?.current?.data?.options ?? [];
      return options.some((option: InteractionOption) => (
        (option.value as { minionUid?: unknown } | undefined)?.minionUid === 'aramis'
      ));
    }, { timeout: 10000, polling: 200 });
    await game.screenshot('39-阿拉密斯-等待时机选择目标随从', testInfo);
    await game.selectInteractionOptionBy(
      option => optionHasMinionUid(option, 'aramis'),
      '阿拉密斯等待时机选择目标随从',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const minions = state.core.bases[0]?.minions ?? [];
      const aramis = minions.find((minion: { uid?: string }) => minion.uid === 'aramis');
      const player = state.core.players['0'];
      return {
        aramisTempPower: aramis?.tempPowerModifier ?? 0,
        handHasEnGarde: player.hand.some((card: { uid?: string }) => card.uid === 'aramis-en-garde'),
        handHasBidingTime: player.hand.some((card: { uid?: string }) => card.uid === 'aramis-biding-time'),
        discardUids: player.discard.map((card: { uid?: string }) => card.uid),
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      aramisTempPower: 3,
      handHasEnGarde: false,
      handHasBidingTime: false,
      discardUids: ['aramis-en-garde', 'aramis-biding-time'],
      interactionSource: null,
    });
    await game.screenshot('39-阿拉密斯-限定额外行动结算后', testInfo);
  });

  test('全为一可从真实手牌附着、触发加力并在回合结束自毁', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'musketeers,sumo_wrestlers',
      p1: 'mounties,luchadors',
      skipFactionSelect: true,
      seed: 20260715,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'all-for-one', defId: 'musketeers_all_for_one', type: 'action', owner: '0' },
          { uid: 'all-for-one-en-garde', defId: 'musketeers_en_garde', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'all-for-one-draw-filler', defId: 'musketeers_athos', type: 'minion', owner: '0' },
          { uid: 'all-for-one-turn-draw-filler', defId: 'musketeers_athos', type: 'minion', owner: '0' },
          { uid: 'all-for-one-turn-draw-filler-2', defId: 'musketeers_athos', type: 'minion', owner: '0' },
        ],
        factions: ['musketeers', 'sumo_wrestlers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [
        {
          defId: 'base_the_dohyo',
          minions: [
            { uid: 'all-for-one-host', defId: 'musketeers_porthos', owner: '0', controller: '0', power: 4 },
          ],
        },
      ],
    });
    await game.playCard('musketeers_all_for_one', { targetMinionUid: 'all-for-one-host' });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const host = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'all-for-one-host');
      return {
        attached: host?.attachedActions.map((action: { defId?: string }) => action.defId) ?? [],
        actionLimit: state.core.players['0']?.actionLimit,
      };
    }, { timeout: 5000 }).toEqual({
      attached: ['musketeers_all_for_one'],
      actionLimit: 2,
    });
    await game.screenshot('40-全为一-真实附着并获得额外行动后', testInfo);

    await game.playCard('musketeers_en_garde', { targetMinionUid: 'all-for-one-host' });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const host = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'all-for-one-host');
      return {
        tempPower: host?.tempPowerModifier ?? 0,
        attached: host?.attachedActions.map((action: { defId?: string }) => action.defId) ?? [],
        discardUids: state.core.players['0']?.discard.map((card: { uid?: string }) => card.uid) ?? [],
      };
    }, { timeout: 5000 }).toEqual({
      tempPower: 2,
      attached: ['musketeers_all_for_one'],
      discardUids: ['all-for-one-en-garde'],
    });
    await game.screenshot('41-全为一-直接影响宿主后加力', testInfo);
    await page.getByTestId('su-end-turn-action-button').click();
    await page.waitForTimeout(1000);
    await expect.poll(async () => {
      const state = await game.getState();
      const host = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'all-for-one-host');
      const player = state.core.players['0'];
      return {
        attached: host?.attachedActions.map((action: { defId?: string }) => action.defId) ?? [],
        discardUids: player.discard.map((card: { uid?: string }) => card.uid).sort(),
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      attached: [],
      discardUids: ['all-for-one', 'all-for-one-en-garde'].sort(),
      interactionSource: null,
    });
    await game.screenshot('42-全为一-回合结束自毁后', testInfo);
  });

  test('穆乔摔先生大战怪物允许空选，也能多选弃牌堆行动后回收与洗回', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'luchadors,mounties',
      p1: 'sumo_wrestlers,musketeers',
      skipFactionSelect: true,
      seed: 20260715,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'monsters-skip', defId: 'luchadors_senor_muchoslam_vs_the_monsters', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'skip-deck-keep', defId: 'luchadors_yellow_demon', type: 'minion', owner: '0' },
        ],
        discard: [
          { uid: 'skip-pin', defId: 'luchadors_pin', type: 'action', owner: '0' },
          { uid: 'skip-tag-team', defId: 'luchadors_tag_team', type: 'action', owner: '0' },
        ],
        factions: ['luchadors', 'mounties'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [
        {
          defId: 'base_ringside',
          minions: [
            { uid: 'skip-host', defId: 'musketeers_dartagnan', owner: '1', controller: '1', power: 6 },
          ],
        },
      ],
    });

    await game.playCard('luchadors_senor_muchoslam_vs_the_monsters');
    await game.waitForInteraction('luchadors_senor_muchoslam_vs_the_monsters', 10000);
    await game.screenshot('24-穆乔大战怪物-空选弃牌堆行动交互', testInfo);
    await respondCurrentInteraction(page, { optionIds: [] });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      return {
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
        deckUids: player.deck.map((card: { uid?: string }) => card.uid),
        discardHasOriginalActions: ['skip-pin', 'skip-tag-team'].every(uid =>
          player.discard.some((card: { uid?: string }) => card.uid === uid),
        ),
      };
    }, { timeout: 5000 }).toEqual({
      handUids: [],
      deckUids: ['skip-deck-keep'],
      discardHasOriginalActions: true,
    });
    await game.screenshot('25-穆乔大战怪物-空选后弃牌堆与牌库不变', testInfo);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'monsters-select', defId: 'luchadors_senor_muchoslam_vs_the_monsters', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'select-deck-keep', defId: 'luchadors_yellow_demon', type: 'minion', owner: '0' },
        ],
        discard: [
          { uid: 'select-pin', defId: 'luchadors_pin', type: 'action', owner: '0' },
          { uid: 'select-tag-team', defId: 'luchadors_tag_team', type: 'action', owner: '0' },
        ],
        factions: ['luchadors', 'mounties'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [
        {
          defId: 'base_ringside',
          minions: [
            { uid: 'select-host', defId: 'musketeers_dartagnan', owner: '1', controller: '1', power: 6 },
          ],
        },
      ],
    });

    await game.playCard('luchadors_senor_muchoslam_vs_the_monsters');
    await game.waitForInteraction('luchadors_senor_muchoslam_vs_the_monsters', 10000);
    await game.screenshot('26-穆乔大战怪物-多选弃牌堆行动交互', testInfo);
    await respondWithOptionIds(page, game, [
      option => optionHasCardUid(option, 'select-pin'),
      option => optionHasCardUid(option, 'select-tag-team'),
    ]);
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      return {
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
        deckUids: player.deck.map((card: { uid?: string }) => card.uid),
        discardHasSelectedActions: ['select-pin', 'select-tag-team'].some(uid =>
          player.discard.some((card: { uid?: string }) => card.uid === uid),
        ),
      };
    }, { timeout: 5000 }).toEqual({
      handUids: ['select-pin'],
      deckUids: ['select-deck-keep', 'select-tag-team'],
      discardHasSelectedActions: false,
    });
    await game.screenshot('27-穆乔大战怪物-多选后回收行动并洗回其余', testInfo);
  });

  test('方形擂台可从真实打出随从入口随机回收弃牌堆行动', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'luchadors,mounties',
      p1: 'sumo_wrestlers,musketeers',
      skipFactionSelect: true,
      seed: 20260715,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'squared-flor-loca', defId: 'luchadors_flor_loca', type: 'minion', owner: '0' },
        ],
        discard: [
          { uid: 'squared-pin', defId: 'luchadors_pin', type: 'action', owner: '0' },
        ],
        factions: ['luchadors', 'mounties'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [
        {
          defId: 'base_the_squared_circle',
          minions: [],
        },
      ],
    });

    await game.screenshot('43-方形擂台-打出随从前弃牌堆有行动', testInfo);
    await game.playCard('luchadors_flor_loca', { targetBaseIndex: 0 });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      return {
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
        discardUids: player.discard.map((card: { uid?: string }) => card.uid),
        baseMinions: state.core.bases[0]?.minions.map((minion: { uid?: string }) => minion.uid) ?? [],
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      handUids: ['squared-pin'],
      discardUids: [],
      baseMinions: ['squared-flor-loca'],
      triggerQueueLength: 0,
      interactionSource: null,
    });
    await game.screenshot('44-方形擂台-回收行动并清空流程态', testInfo);
  });

  test('圣热尔韦堡垒可从真实行动影响己方随从入口授予额外行动', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'luchadors,musketeers',
      p1: 'sumo_wrestlers,mounties',
      skipFactionSelect: true,
      seed: 20260715,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'bastion-cheap-pop', defId: 'luchadors_cheap_pop', type: 'action', owner: '0' },
          { uid: 'bastion-tag-team', defId: 'luchadors_tag_team', type: 'action', owner: '0' },
        ],
        factions: ['luchadors', 'musketeers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'mounties'] },
      bases: [
        {
          defId: 'base_bastion_saint_gervais',
          minions: [
            { uid: 'bastion-ally', defId: 'luchadors_flor_loca', owner: '0', controller: '0', power: 3 },
          ],
        },
      ],
    });

    await game.screenshot('45-圣热尔韦堡垒-行动影响己方随从前', testInfo);
    await game.playCard('luchadors_cheap_pop');
    await game.waitForInteraction('luchadors_cheap_pop', 10000);
    await game.selectInteractionOptionBy(
      option => optionHasMinionUid(option, 'bastion-ally'),
      '廉价欢呼选择圣热尔韦堡垒上的己方随从',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      const ally = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'bastion-ally');
      return {
        tempPower: ally?.tempPowerModifier ?? 0,
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
        discardUids: player.discard.map((card: { uid?: string }) => card.uid),
        actionsPlayed: player.actionsPlayed,
        actionLimit: player.actionLimit,
        usedTurn: state.core.bases[0]?.metadata?.internationalIncidentBastionSaintGervaisUsedTurn_0,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      tempPower: 2,
      handUids: ['bastion-tag-team'],
      discardUids: ['bastion-cheap-pop'],
      actionsPlayed: 1,
      actionLimit: 2,
      usedTurn: 1,
      interactionSource: null,
    });
    await game.screenshot('46-圣热尔韦堡垒-获得额外行动后', testInfo);

    await game.playCard('luchadors_tag_team');
    await game.waitForInteraction('luchadors_tag_team_base', 10000);
    await game.selectInteractionOptionBy(
      option => optionHasBaseIndex(option, 0),
      '团队标记选择圣热尔韦堡垒',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      return {
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
        discardUids: player.discard.map((card: { uid?: string }) => card.uid),
        actionsPlayed: player.actionsPlayed,
        actionLimit: player.actionLimit,
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      handUids: [],
      discardUids: ['bastion-cheap-pop', 'bastion-tag-team'],
      actionsPlayed: 2,
      actionLimit: 2,
      triggerQueueLength: 0,
      interactionSource: null,
    });
    await game.screenshot('47-圣热尔韦堡垒-消费额外行动后', testInfo);
  });

  test('擂台边可从真实行动影响另一玩家随从入口抽牌', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'luchadors,mounties',
      p1: 'musketeers,sumo_wrestlers',
      skipFactionSelect: true,
      seed: 20260715,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'ringside-pin', defId: 'luchadors_pin', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'ringside-drawn', defId: 'luchadors_tag_team', type: 'action', owner: '0' },
        ],
        factions: ['luchadors', 'mounties'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['musketeers', 'sumo_wrestlers'] },
      bases: [
        {
          defId: 'base_ringside',
          minions: [
            {
              uid: 'ringside-enemy',
              defId: 'musketeers_dartagnan',
              owner: '1',
              controller: '1',
              power: 4,
              attachedActions: [
                { uid: 'ringside-existing-setup', defId: 'luchadors_smart_set_up', ownerId: '0' },
              ],
            },
          ],
        },
      ],
    });

    await game.screenshot('48-擂台边-压制另一玩家随从前', testInfo);
    await game.playCard('luchadors_pin', { targetMinionUid: 'ringside-enemy' });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      const enemy = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'ringside-enemy');
      return {
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
        deckUids: player.deck.map((card: { uid?: string }) => card.uid),
        attached: enemy?.attachedActions.map((action: { defId?: string }) => action.defId) ?? [],
        actionsPlayed: player.actionsPlayed,
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      handUids: ['ringside-drawn'],
      deckUids: [],
      attached: ['luchadors_smart_set_up', 'luchadors_pin'],
      actionsPlayed: 1,
      triggerQueueLength: 0,
      interactionSource: null,
    });
    await game.screenshot('49-擂台边-压制附着并抽牌后', testInfo);
  });

  test('连连获胜可从真实手牌入口授予两个限定额外行动', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'musketeers,sumo_wrestlers',
      p1: 'mounties,luchadors',
      skipFactionSelect: true,
      seed: 20260919,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'on-a-roll', defId: 'musketeers_on_a_roll', type: 'action', owner: '0' },
          { uid: 'roll-technique', defId: 'sumo_wrestlers_technique_prize', type: 'action', owner: '0' },
          { uid: 'roll-en-garde', defId: 'musketeers_en_garde', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'roll-draw', defId: 'musketeers_biding_time', type: 'action', owner: '0' },
        ],
        factions: ['musketeers', 'sumo_wrestlers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [
        {
          defId: 'base_the_dohyo',
          minions: [
            { uid: 'roll-target', defId: 'sumo_wrestlers_rookie_sumo', owner: '0', controller: '0', power: 2 },
            { uid: 'roll-other', defId: 'sumo_wrestlers_third_tier', owner: '0', controller: '0', power: 3 },
          ],
        },
      ],
    });

    await game.screenshot('50-连连获胜-真实手牌入口前', testInfo);
    await game.playCard('musketeers_on_a_roll');
    await game.waitForInteraction('musketeers_on_a_roll', 10000);
    await game.screenshot('51-连连获胜-选择限定目标随从', testInfo);
    await game.selectInteractionOptionBy(
      option => optionHasMinionUid(option, 'roll-target'),
      '连连获胜选择限定目标随从',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      return {
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
        discardUids: player.discard.map((card: { uid?: string }) => card.uid),
        actionsPlayed: player.actionsPlayed,
        actionLimit: player.actionLimit,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      handUids: ['roll-technique', 'roll-en-garde'],
      discardUids: ['on-a-roll'],
      actionsPlayed: 1,
      actionLimit: 3,
      interactionSource: null,
    });
    await game.screenshot('52-连连获胜-获得两个限定额外行动后', testInfo);

    await game.playCard('sumo_wrestlers_technique_prize');
    await game.waitForInteraction('sumo_wrestlers_technique_prize', 10000);
    await page.waitForFunction(() => {
      const options = (window as SmashUpE2EWindow).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current?.data?.options ?? [];
      return options.some(option => (option?.value as { minionUid?: unknown } | undefined)?.minionUid === 'roll-target');
    }, { timeout: 10000, polling: 200 });
    await game.screenshot('53-连连获胜-第一张额外行动候选中包含限定随从', testInfo);
    await game.selectInteractionOptionBy(
      option => optionHasMinionUid(option, 'roll-target'),
      '连连获胜第一张额外行动选择限定随从',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const target = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'roll-target');
      const other = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'roll-other');
      const player = state.core.players['0'];
      return {
        targetCounters: target?.powerCounters ?? 0,
        otherCounters: other?.powerCounters ?? 0,
        actionsPlayed: player.actionsPlayed,
        actionLimit: player.actionLimit,
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
      };
    }, { timeout: 10000 }).toEqual({
      targetCounters: 3,
      otherCounters: 0,
      actionsPlayed: 2,
      actionLimit: 3,
      handUids: ['roll-en-garde'],
    });
    await game.screenshot('54-连连获胜-第一张额外行动结算后', testInfo);

    await page.click('[data-card-uid="roll-en-garde"]');
    await page.waitForTimeout(300);
    await page.click('[data-minion-uid="roll-target"]');
    await page.waitForTimeout(300);
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await game.screenshot('55-连连获胜-第二张额外行动作用于限定随从后', testInfo);

    await expect.poll(async () => {
      const state = await game.getState();
      const target = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'roll-target');
      const other = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'roll-other');
      const player = state.core.players['0'];
      return {
        targetTempPower: target?.tempPowerModifier ?? 0,
        otherTempPower: other?.tempPowerModifier ?? 0,
        actionsPlayed: player.actionsPlayed,
        actionLimit: player.actionLimit,
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
        discardUids: player.discard.map((card: { uid?: string }) => card.uid),
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      targetTempPower: 1,
      otherTempPower: 0,
      actionsPlayed: 3,
      actionLimit: 4,
      handUids: ['roll-draw'],
      discardUids: ['on-a-roll', 'roll-technique', 'roll-en-garde'],
      interactionSource: null,
    });
    await game.screenshot('56-连连获胜-第二张额外行动结算并清理后', testInfo);
  });

  test('让路可从真实手牌入口移动己方随从并消费额外行动', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'musketeers,sumo_wrestlers',
      p1: 'mounties,luchadors',
      skipFactionSelect: true,
      seed: 20260920,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'make-way', defId: 'musketeers_make_way', type: 'action', owner: '0' },
          { uid: 'make-way-technique', defId: 'sumo_wrestlers_technique_prize', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'make-way-draw', defId: 'musketeers_biding_time', type: 'action', owner: '0' },
        ],
        factions: ['musketeers', 'sumo_wrestlers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [
        {
          defId: 'base_bastion_saint_gervais',
          minions: [
            { uid: 'make-way-target', defId: 'musketeers_young_musketeer', owner: '0', controller: '0', power: 3 },
          ],
        },
        { defId: 'base_the_golden_lily', minions: [] },
      ],
    });

    await game.screenshot('57-让路-真实手牌入口前', testInfo);
    await game.playCard('musketeers_make_way');
    await game.waitForInteraction('musketeers_make_way', 10000);
    await game.screenshot('58-让路-选择己方随从', testInfo);
    await game.selectInteractionOptionBy(
      option => optionHasMinionUid(option, 'make-way-target'),
      '让路选择己方随从',
    );
    await game.waitForInteraction('musketeers_make_way_destination', 10000);
    await game.screenshot('59-让路-选择目标基地', testInfo);
    await game.selectInteractionOptionBy(option => optionHasBaseIndex(option, 1), '让路选择第二座基地');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      return {
        source: state.core.bases[0]?.minions.map((minion: { uid?: string }) => minion.uid),
        destination: state.core.bases[1]?.minions.map((minion: { uid?: string }) => minion.uid),
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
        discardUids: player.discard.map((card: { uid?: string }) => card.uid),
        actionsPlayed: player.actionsPlayed,
        actionLimit: player.actionLimit,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
      };
    }, { timeout: 10000 }).toEqual({
      source: [],
      destination: ['make-way-target'],
      handUids: ['make-way-technique'],
      discardUids: ['make-way'],
      actionsPlayed: 1,
      actionLimit: 2,
      interactionSource: null,
      triggerQueueLength: 0,
    });
    await game.screenshot('60-让路-移动并获得额外行动后', testInfo);

    await game.playCard('sumo_wrestlers_technique_prize');
    await game.waitForInteraction('sumo_wrestlers_technique_prize', 10000);
    await game.screenshot('61-让路-额外行动消费时选择移动后的随从', testInfo);
    await game.selectInteractionOptionBy(
      option => optionHasMinionUid(option, 'make-way-target'),
      '让路后的额外行动选择移动后的随从',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const target = state.core.bases[1]?.minions.find((minion: { uid?: string }) => minion.uid === 'make-way-target');
      const player = state.core.players['0'];
      return {
        targetCounters: target?.powerCounters ?? 0,
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
        discardUids: player.discard.map((card: { uid?: string }) => card.uid),
        actionsPlayed: player.actionsPlayed,
        actionLimit: player.actionLimit,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
      };
    }, { timeout: 10000 }).toEqual({
      targetCounters: 3,
      handUids: [],
      discardUids: ['make-way', 'make-way-technique'],
      actionsPlayed: 2,
      actionLimit: 2,
      interactionSource: null,
      triggerQueueLength: 0,
    });
    await game.screenshot('62-让路-额外行动结算并清理后', testInfo);
  });

  test('情谊信物可从真实手牌入口按来源检索直接影响随从的行动并获得额外行动', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'musketeers,sumo_wrestlers',
      p1: 'mounties,luchadors',
      skipFactionSelect: true,
      seed: 20260920,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'token-main', defId: 'musketeers_token_of_affection', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'token-deck-direct', defId: 'musketeers_en_garde', type: 'action', owner: '0' },
          { uid: 'token-deck-invalid', defId: 'musketeers_make_way', type: 'action', owner: '0' },
        ],
        discard: [
          { uid: 'token-discard-direct', defId: 'musketeers_all_for_one', type: 'action', owner: '0' },
          { uid: 'token-discard-invalid', defId: 'luchadors_tag_team', type: 'action', owner: '0' },
        ],
        factions: ['musketeers', 'sumo_wrestlers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [
        {
          defId: 'base_bastion_saint_gervais',
          minions: [
            { uid: 'token-target', defId: 'musketeers_porthos', owner: '0', controller: '0', power: 4 },
          ],
        },
      ],
    });

    await game.screenshot('69-情谊信物-真实手牌入口前', testInfo);
    await game.playCard('musketeers_token_of_affection');
    await game.waitForInteraction('international_incident_base_move', 10000);

    const searchOptions = await game.getInteractionOptions();
    expect(searchOptions.some(option => option.value?.cardUid === 'token-deck-direct' && option.value?.zone === 'deck')).toBe(true);
    expect(searchOptions.some(option => option.value?.cardUid === 'token-discard-direct' && option.value?.zone === 'discard')).toBe(true);
    expect(searchOptions.some(option => option.value?.cardUid === 'token-deck-invalid')).toBe(false);
    expect(searchOptions.some(option => option.value?.cardUid === 'token-discard-invalid')).toBe(false);
    await game.screenshot('70-情谊信物-牌库与弃牌堆候选', testInfo);

    await game.selectInteractionOptionBy(
      option => option.value?.cardUid === 'token-deck-direct' && option.value?.zone === 'deck',
      '情谊信物从牌库取回预备姿势',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      return {
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
        deckUids: player.deck.map((card: { uid?: string }) => card.uid),
        discardUids: player.discard.map((card: { uid?: string }) => card.uid).sort(),
        actionsPlayed: player.actionsPlayed,
        actionLimit: player.actionLimit,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
      };
    }, { timeout: 10000 }).toEqual({
      handUids: ['token-deck-direct'],
      deckUids: ['token-deck-invalid'],
      discardUids: ['token-discard-direct', 'token-discard-invalid', 'token-main'].sort(),
      actionsPlayed: 1,
      actionLimit: 2,
      interactionSource: null,
      triggerQueueLength: 0,
    });
    await game.screenshot('71-情谊信物-取回行动并获得额外行动后', testInfo);
  });

  test('情谊信物真实入口跳过搜索时保持牌区和行动额度不变', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'musketeers,sumo_wrestlers',
      p1: 'mounties,luchadors',
      skipFactionSelect: true,
      seed: 20260920,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'token-skip', defId: 'musketeers_token_of_affection', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'token-skip-deck', defId: 'musketeers_en_garde', type: 'action', owner: '0' },
        ],
        discard: [
          { uid: 'token-skip-discard', defId: 'musketeers_all_for_one', type: 'action', owner: '0' },
        ],
        factions: ['musketeers', 'sumo_wrestlers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [
        { defId: 'base_bastion_saint_gervais', minions: [] },
      ],
    });

    await game.screenshot('72-情谊信物-跳过路径入口前', testInfo);
    await game.playCard('musketeers_token_of_affection');
    await game.waitForInteraction('international_incident_base_move', 10000);
    await game.screenshot('73-情谊信物-跳过搜索交互', testInfo);
    await game.selectInteractionOptionBy(option => option.value?.skip === true, '情谊信物跳过搜索');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      return {
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
        deckUids: player.deck.map((card: { uid?: string }) => card.uid),
        discardUids: player.discard.map((card: { uid?: string }) => card.uid),
        actionsPlayed: player.actionsPlayed,
        actionLimit: player.actionLimit,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
      };
    }, { timeout: 10000 }).toEqual({
      handUids: [],
      deckUids: ['token-skip-deck'],
      discardUids: ['token-skip-discard', 'token-skip'],
      actionsPlayed: 1,
      actionLimit: 1,
      interactionSource: null,
      triggerQueueLength: 0,
    });
    await game.screenshot('74-情谊信物-跳过后清理完成', testInfo);
  });

  test('投入战斗可从真实手牌入口打出额外随从并消费其限定额外行动', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'musketeers,sumo_wrestlers',
      p1: 'mounties,luchadors',
      skipFactionSelect: true,
      seed: 20260920,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'to-battle', defId: 'musketeers_to_battle', type: 'action', owner: '0' },
          { uid: 'to-battle-extra-minion', defId: 'musketeers_young_musketeer', type: 'minion', owner: '0' },
          { uid: 'to-battle-en-garde', defId: 'musketeers_en_garde', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'to-battle-follow-up', defId: 'musketeers_make_way', type: 'action', owner: '0' },
        ],
        factions: ['musketeers', 'sumo_wrestlers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [
        { defId: 'base_the_golden_lily', minions: [] },
        { defId: 'base_bastion_saint_gervais', minions: [] },
      ],
    });

    await game.screenshot('63-投入战斗-真实手牌入口前', testInfo);
    await game.playCard('musketeers_to_battle');
    await game.waitForInteraction('smashup_immediate_extra_minion', 10000);
    await game.screenshot('64-投入战斗-选择额外随从', testInfo);
    await game.selectInteractionOptionBy(
      option => optionHasCardUid(option, 'to-battle-extra-minion'),
      '投入战斗选择额外随从',
    );
    await game.waitForInteraction('smashup_immediate_extra_minion_base', 10000);
    await game.screenshot('65-投入战斗-选择额外随从基地', testInfo);
    await game.selectInteractionOptionBy(option => optionHasBaseIndex(option, 0), '投入战斗选择额外随从基地');
    await game.waitForInteraction('smashup_immediate_extra_action', 10000);
    await game.screenshot('66-投入战斗-选择限定额外行动', testInfo);
    await game.selectInteractionOptionBy(
      option => optionHasCardUid(option, 'to-battle-en-garde'),
      '投入战斗选择限定额外行动预备姿势',
    );
    await game.waitForInteraction('smashup_immediate_extra_action_minion', 10000);
    await game.screenshot('67-投入战斗-选择额外随从作为行动目标', testInfo);
    await game.selectInteractionOptionBy(
      option => optionHasMinionUid(option, 'to-battle-extra-minion'),
      '投入战斗选择额外随从作为行动目标',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      const target = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'to-battle-extra-minion');
      return {
        baseZeroMinions: state.core.bases[0]?.minions.map((minion: { uid?: string }) => minion.uid),
        targetTempPower: target?.tempPowerModifier ?? 0,
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
        discardUids: player.discard.map((card: { uid?: string }) => card.uid),
        actionsPlayed: player.actionsPlayed,
        actionLimit: player.actionLimit,
        pendingMinionPlayEffects: player.pendingMinionPlayEffects ?? [],
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
      };
    }, { timeout: 10000 }).toEqual({
      baseZeroMinions: ['to-battle-extra-minion'],
      targetTempPower: 2,
      handUids: ['to-battle-follow-up'],
      discardUids: ['to-battle', 'to-battle-en-garde'],
      actionsPlayed: 2,
      actionLimit: 3,
      pendingMinionPlayEffects: [],
      interactionSource: null,
      triggerQueueLength: 0,
    });
    await game.screenshot('68-投入战斗-额外随从与额外行动额度结算并清理后', testInfo);
  });

  test('波尔托斯从真实对手行动入口拒绝影响并保留普通随从目标', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      numPlayers: 2,
      playerID: '1',
      seat0: 'human',
      seat1: 'human',
      disableLocalAiAutomation: true,
      p0: 'musketeers,sumo_wrestlers',
      p1: 'musketeers,luchadors',
      skipInitialization: true,
      seed: 20260920,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '1',
      phase: 'playCards',
      player0: {
        hand: [],
        factions: ['musketeers', 'sumo_wrestlers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: {
        hand: [
          { uid: 'porthos-opponent-action', defId: 'musketeers_en_garde', type: 'action', owner: '1' },
        ],
        deck: [
          { uid: 'porthos-opponent-draw', defId: 'musketeers_biding_time', type: 'action', owner: '1' },
        ],
        factions: ['musketeers', 'luchadors'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      bases: [
        {
          defId: 'base_bastion_saint_gervais',
          minions: [
            { uid: 'porthos-protected', defId: 'musketeers_porthos', owner: '0', controller: '0', power: 4 },
            { uid: 'porthos-control', defId: 'sumo_wrestlers_rookie_sumo', owner: '0', controller: '0', power: 2 },
          ],
        },
      ],
    });

    await game.waitForCurrentPlayer('1');
    await game.screenshot('75-波尔托斯-对手行动入口前', testInfo);
    await page.locator('[data-card-uid="porthos-opponent-action"]').click({ force: true });
    await page.waitForTimeout(300);
    await expect(page.locator('[data-minion-uid="porthos-protected"]')).toHaveAttribute('data-highlighted', 'false');
    await expect(page.locator('[data-minion-uid="porthos-control"]')).toHaveAttribute('data-highlighted', 'true');
    await game.screenshot('76-波尔托斯-对手行动目标过滤后', testInfo);
    await page.locator('[data-minion-uid="porthos-control"]').click({ force: true });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const protectedMinion = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'porthos-protected');
      const ordinaryMinion = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'porthos-control');
      const player = state.core.players['1'];
      return {
        porthosTempPower: protectedMinion?.tempPowerModifier ?? 0,
        ordinaryTempPower: ordinaryMinion?.tempPowerModifier ?? 0,
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
        discardUids: player.discard.map((card: { uid?: string }) => card.uid),
        actionsPlayed: player.actionsPlayed,
        actionLimit: player.actionLimit,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
      };
    }, { timeout: 10000 }).toEqual({
      porthosTempPower: 0,
      ordinaryTempPower: 1,
      handUids: ['porthos-opponent-draw'],
      discardUids: ['porthos-opponent-action'],
      actionsPlayed: 1,
      actionLimit: 2,
      interactionSource: null,
      triggerQueueLength: 0,
    });
    await game.screenshot('77-波尔托斯-对手行动被拒绝且普通随从正常受影响后', testInfo);
  });

  test('波尔托斯控制者可从真实手牌入口用行动影响自身并获得额外行动', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'musketeers,sumo_wrestlers',
      p1: 'mounties,luchadors',
      skipFactionSelect: true,
      seed: 20260920,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'porthos-own-action', defId: 'musketeers_en_garde', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'porthos-own-draw', defId: 'musketeers_biding_time', type: 'action', owner: '0' },
        ],
        factions: ['musketeers', 'sumo_wrestlers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [
        {
          defId: 'base_bastion_saint_gervais',
          minions: [
            { uid: 'porthos-own-target', defId: 'musketeers_porthos', owner: '0', controller: '0', power: 4 },
          ],
        },
      ],
    });

    await game.waitForCurrentPlayer('0');
    await game.screenshot('78-波尔托斯-控制者行动入口前', testInfo);
    await page.locator('[data-card-uid="porthos-own-action"]').click();
    await page.waitForTimeout(300);
    await expect(page.locator('[data-minion-uid="porthos-own-target"]')).toHaveAttribute('data-highlighted', 'true');
    await game.screenshot('79-波尔托斯-控制者可选择自身目标', testInfo);
    await page.locator('[data-minion-uid="porthos-own-target"]').click({ force: true });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const porthos = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'porthos-own-target');
      const player = state.core.players['0'];
      return {
        tempPower: porthos?.tempPowerModifier ?? 0,
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
        discardUids: player.discard.map((card: { uid?: string }) => card.uid),
        actionsPlayed: player.actionsPlayed,
        actionLimit: player.actionLimit,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
      };
    }, { timeout: 10000 }).toEqual({
      tempPower: 1,
      handUids: ['porthos-own-draw'],
      discardUids: ['porthos-own-action'],
      actionsPlayed: 1,
      actionLimit: 3,
      interactionSource: null,
      triggerQueueLength: 0,
    });
    await game.screenshot('80-波尔托斯-控制者行动正常结算后', testInfo);
  });

  test('阿多斯从真实手牌入口在同基地内强化被直接影响的己方随从', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'musketeers,sumo_wrestlers',
      p1: 'mounties,luchadors',
      skipFactionSelect: true,
      seed: 20260920,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'athos-action', defId: 'musketeers_en_garde', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'athos-draw', defId: 'musketeers_biding_time', type: 'action', owner: '0' },
        ],
        factions: ['musketeers', 'sumo_wrestlers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [
        {
          defId: 'base_the_golden_lily',
          minions: [
            { uid: 'athos-source', defId: 'musketeers_athos', owner: '0', controller: '0', power: 4 },
            { uid: 'athos-target', defId: 'sumo_wrestlers_rookie_sumo', owner: '0', controller: '0', power: 2 },
          ],
        },
      ],
    });

    await game.waitForCurrentPlayer('0');
    await game.screenshot('81-阿多斯-控制者行动入口前', testInfo);
    await page.locator('[data-card-uid="athos-action"]').click();
    await page.waitForTimeout(300);
    await expect(page.locator('[data-minion-uid="athos-target"]')).toHaveAttribute('data-highlighted', 'true');
    await game.screenshot('82-阿多斯-选择同基地己方目标', testInfo);
    await page.locator('[data-minion-uid="athos-target"]').click({ force: true });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const source = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'athos-source');
      const target = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'athos-target');
      const player = state.core.players['0'];
      return {
        sourceTempPower: source?.tempPowerModifier ?? 0,
        targetTempPower: target?.tempPowerModifier ?? 0,
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
        discardUids: player.discard.map((card: { uid?: string }) => card.uid),
        actionsPlayed: player.actionsPlayed,
        actionLimit: player.actionLimit,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
      };
    }, { timeout: 10000 }).toEqual({
      sourceTempPower: 0,
      targetTempPower: 2,
      handUids: ['athos-draw'],
      discardUids: ['athos-action'],
      actionsPlayed: 1,
      actionLimit: 2,
      interactionSource: null,
      triggerQueueLength: 0,
    });
    await game.screenshot('83-阿多斯-直接影响后目标获得双重加力并清理', testInfo);
  });

  test('达达尼昂从真实手牌入口被直接影响后抽两张牌并完成清理', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'musketeers,sumo_wrestlers',
      p1: 'mounties,luchadors',
      skipFactionSelect: true,
      seed: 20260920,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'dartagnan-action', defId: 'musketeers_en_garde', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'dartagnan-draw-a', defId: 'musketeers_biding_time', type: 'action', owner: '0' },
          { uid: 'dartagnan-draw-b', defId: 'musketeers_make_way', type: 'action', owner: '0' },
        ],
        factions: ['musketeers', 'sumo_wrestlers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [
        {
          defId: 'base_the_golden_lily',
          minions: [
            { uid: 'dartagnan-target', defId: 'musketeers_dartagnan', owner: '0', controller: '0', power: 4 },
          ],
        },
      ],
    });

    await game.waitForCurrentPlayer('0');
    await game.screenshot('84-达达尼昂-控制者行动入口前', testInfo);
    await page.locator('[data-card-uid="dartagnan-action"]').click();
    await page.waitForTimeout(300);
    await expect(page.locator('[data-minion-uid="dartagnan-target"]')).toHaveAttribute('data-highlighted', 'true');
    await game.screenshot('85-达达尼昂-选择自身目标', testInfo);
    await page.locator('[data-minion-uid="dartagnan-target"]').click({ force: true });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const target = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'dartagnan-target');
      const player = state.core.players['0'];
      return {
        targetTempPower: target?.tempPowerModifier ?? 0,
        handUids: player.hand.map((card: { uid?: string }) => card.uid).sort(),
        discardUids: player.discard.map((card: { uid?: string }) => card.uid),
        deckUids: player.deck.map((card: { uid?: string }) => card.uid),
        actionsPlayed: player.actionsPlayed,
        actionLimit: player.actionLimit,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
      };
    }, { timeout: 10000 }).toEqual({
      targetTempPower: 1,
      handUids: ['dartagnan-draw-a', 'dartagnan-draw-b'],
      discardUids: ['dartagnan-action'],
      deckUids: [],
      actionsPlayed: 1,
      actionLimit: 2,
      interactionSource: null,
      triggerQueueLength: 0,
    });
    await game.screenshot('86-达达尼昂-直接影响后抽两张牌并清理', testInfo);
  });

  test('黄金百合花从真实结束回合入口在有己方随从时抽一张牌', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      numPlayers: 2,
      playerID: '0',
      seat0: 'human',
      seat1: 'human',
      disableLocalAiAutomation: true,
      p0: 'musketeers,sumo_wrestlers',
      p1: 'mounties,luchadors',
      skipInitialization: true,
      seed: 20260920,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [],
        deck: [
          { uid: 'golden-lily-draw', defId: 'musketeers_biding_time', type: 'action', owner: '0' },
        ],
        factions: ['musketeers', 'sumo_wrestlers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [
        {
          defId: 'base_the_golden_lily',
          minions: [
            { uid: 'golden-lily-ally', defId: 'sumo_wrestlers_rookie_sumo', owner: '0', controller: '0', power: 2 },
          ],
        },
      ],
    });

    await game.waitForCurrentPlayer('0');
    await game.screenshot('87-黄金百合花-结束回合入口前', testInfo);
    await page.getByTestId('su-end-turn-action-button').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      return {
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
        deckUids: player.deck.map((card: { uid?: string }) => card.uid),
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 15000 }).toEqual({
      handUids: ['golden-lily-draw'],
      deckUids: [],
      triggerQueueLength: 0,
      interactionSource: null,
    });
    await game.screenshot('88-黄金百合花-回合结束抽牌并清理', testInfo);
  });
});
