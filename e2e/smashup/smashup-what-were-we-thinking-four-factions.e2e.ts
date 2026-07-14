import { test, expect } from '../framework';
import type { Page } from '@playwright/test';
import { setChineseLocale } from '../helpers/common';

const WHAT_WERE_WE_THINKING_ATLAS_ID = 'smashup:what-were-we-thinking-cards';
const WHAT_WERE_WE_THINKING_FACTIONS = ['rock_stars', 'teddy_bears', 'grannies', 'explorers'] as const;

type InteractionOption = {
  id?: string;
  value?: unknown;
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
    interaction?: {
      current?: {
        playerId?: string;
        data?: {
          sourceId?: string;
          options?: InteractionOption[];
        };
      };
    };
  };
};

type SmashUpE2EHarness = {
  state?: {
    get?: () => SmashUpE2EState;
  };
  command?: {
    dispatch?: (command: {
      type: 'SYS_INTERACTION_RESPOND';
      playerId: string;
      payload: { optionId?: string; optionIds?: string[] };
    }) => Promise<unknown>;
  };
};

type SmashUpE2EWindow = Window & {
  __BG_TEST_HARNESS__?: SmashUpE2EHarness;
};

function optionHasCardUid(option: InteractionOption, cardUid: string): boolean {
  const value = option.value;
  return !!value && typeof value === 'object' && (value as { cardUid?: unknown }).cardUid === cardUid;
}

function optionHasMinionMove(option: InteractionOption, minionUid: string, toBaseIndex: number): boolean {
  const value = option.value;
  return !!value
    && typeof value === 'object'
    && (value as { minionUid?: unknown }).minionUid === minionUid
    && (value as { toBaseIndex?: unknown }).toBaseIndex === toBaseIndex;
}

async function assertAtlasLoaded(page: Page, atlasId: string, minCardCount: number): Promise<void> {
  await expect.poll(async () => page.evaluate((expectedAtlasId) => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(
      `[data-card-atlas-id="${expectedAtlasId}"]`,
    ));
    return {
      count: nodes.length,
      shimmerCount: nodes.filter(node => node.classList.contains('atlas-shimmer')).length,
      loadedCount: nodes.filter(node => Boolean(node.style.backgroundImage)).length,
    };
  }, atlasId), { timeout: 20000 }).toMatchObject({
    shimmerCount: 0,
  });

  const summary = await page.evaluate((expectedAtlasId) => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(
      `[data-card-atlas-id="${expectedAtlasId}"]`,
    ));
    return {
      count: nodes.length,
      loadedCount: nodes.filter(node => Boolean(node.style.backgroundImage)).length,
    };
  }, atlasId);
  expect(summary.count).toBeGreaterThanOrEqual(minCardCount);
  expect(summary.loadedCount).toBe(summary.count);
}

async function assertNoAtlasShimmer(
  page: Page,
  atlasIds: string[] = [WHAT_WERE_WE_THINKING_ATLAS_ID],
  timeout = 90000,
): Promise<void> {
  const trackedAtlasIds = atlasIds;
  await expect.poll(async () => page.evaluate((expectedAtlasIds) => (
    Array.from(document.querySelectorAll<HTMLElement>('.atlas-shimmer'))
      .filter(node => node.dataset.cardAtlasId && expectedAtlasIds.includes(node.dataset.cardAtlasId))
      .map(node => ({
        atlasId: node.dataset.cardAtlasId ?? null,
        atlasIndex: node.dataset.cardAtlasIndex ?? null,
        title: node.title || null,
      }))
  ), trackedAtlasIds), { timeout }).toEqual([]);
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
      const currentPlayerId = state.core.turnOrder?.[state.core.currentPlayerIndex];
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
  const faction = page.getByTestId(`faction-option-${options.factionId}`);
  await faction.scrollIntoViewIfNeeded({ timeout: 15000 });
  await expect(faction).toBeVisible({ timeout: 15000 });
  await faction.click();
  await expect(page.getByTestId('faction-detail-panel')).toBeVisible({ timeout: 10000 });
  await assertAtlasLoaded(page, WHAT_WERE_WE_THINKING_ATLAS_ID, 12);
  await options.beforeConfirm?.();

  const confirmButton = page.getByTestId('faction-confirm-button');
  await expect(confirmButton).toBeVisible({ timeout: 10000 });
  await expect(confirmButton).toBeEnabled({ timeout: 10000 });
  await confirmButton.click();

  await page.waitForFunction(
    ({ playerId, factionId }) => {
      const state = (window as SmashUpE2EWindow).__BG_TEST_HARNESS__?.state?.get?.();
      const selected = state?.core?.factionSelection?.playerSelections?.[playerId] ?? [];
      const finalFactions = state?.core?.players?.[playerId]?.factions ?? [];
      return selected.includes(factionId) || finalFactions.includes(factionId);
    },
    { playerId: options.playerId, factionId: options.factionId },
    { timeout: 20000, polling: 200 },
  );
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

async function respondToCurrentSkipOption(page: Page): Promise<boolean> {
  const optionId = await page.evaluate(() => {
    const current = (window as SmashUpE2EWindow).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current;
    const skipOption = current?.data?.options?.find(option => {
      const value = option.value;
      return !!option.id && !!value && typeof value === 'object' && (value as { skip?: unknown }).skip === true;
    });
    return skipOption?.id ?? null;
  });
  if (!optionId) return false;

  await respondCurrentInteraction(page, { optionId });
  return true;
}

async function respondToSkipOptionsUntilSettled(page: Page, maxSkips = 4): Promise<number> {
  let skipped = 0;
  for (let attempt = 0; attempt < maxSkips; attempt += 1) {
    if (!(await respondToCurrentSkipOption(page))) break;
    skipped += 1;

    const hasAnotherSkip = await page.getByRole('button', { name: '放弃这次额外随从', exact: true })
      .isVisible({ timeout: 300 })
      .catch(() => false);
    if (!hasAnotherSkip) break;
  }
  return skipped;
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

async function dismissSpotlightIfPresent(page: Page): Promise<void> {
  const spotlightQueue = page.getByTestId('card-spotlight-queue');
  if (await spotlightQueue.isVisible({ timeout: 300 }).catch(() => false)) {
    await spotlightQueue.click({ force: true });
    await page.waitForTimeout(200);
  }
}

test.describe('大杀四方《我们到底在想什么？》四派系真实入口验证', () => {
  test('派系选择页能看到摇滚明星、泰迪熊、外婆、探险家并加载新图集', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'factionSelect',
      extra: {
        core: {
          turnOrder: ['0', '1'],
          currentPlayerIndex: 0,
          turnNumber: 1,
          nextUid: 1000,
          players: {
            '0': { id: '0', vp: 0, hand: [], deck: [], discard: [], factions: ['aliens', 'pirates'], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1 },
            '1': { id: '1', vp: 0, hand: [], deck: [], discard: [], factions: ['ninjas', 'robots'], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1 },
          },
          factionSelection: {
            takenFactions: [],
            playerSelections: { '0': [], '1': [] },
            completedPlayers: [],
          },
        },
      },
    });

    for (const factionId of WHAT_WERE_WE_THINKING_FACTIONS) {
      await closeFactionDetailIfPresent(page);
      const option = page.getByTestId(`faction-option-${factionId}`);
      await option.scrollIntoViewIfNeeded({ timeout: 15000 });
      await expect(option).toBeVisible({ timeout: 15000 });
      await option.click();
      await assertAtlasLoaded(page, WHAT_WERE_WE_THINKING_ATLAS_ID, 12);
      await option.screenshot({ path: testInfo.outputPath(`what-were-we-thinking-faction-option-${factionId}.png`) });
    }

    await game.screenshot('01-我们到底在想什么-四派系选择页可见', testInfo);
  });

  test('真实选秀后可开局，并完成四派系代表能力链', async ({ page, game }, testInfo) => {
    test.setTimeout(300000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      seed: 20260714,
      seat1ManualSetup: true,
    }, 45000);
    await expect(page.locator('[data-tutorial-id="su-faction-select"]')).toBeVisible({ timeout: 30000 });

    await pickFaction(page, {
      playerId: '0',
      selectedCountBeforePick: 0,
      factionId: 'rock_stars',
      beforeConfirm: () => game.screenshot('02-摇滚明星-派系预览', testInfo),
    });
    await pickFaction(page, {
      playerId: '1',
      selectedCountBeforePick: 0,
      factionId: 'grannies',
      beforeConfirm: () => game.screenshot('03-外婆-派系预览', testInfo),
    });
    await pickFaction(page, {
      playerId: '1',
      selectedCountBeforePick: 1,
      factionId: 'explorers',
      beforeConfirm: () => game.screenshot('04-探险家-派系预览', testInfo),
    });
    await pickFaction(page, {
      playerId: '0',
      selectedCountBeforePick: 1,
      factionId: 'teddy_bears',
      beforeConfirm: () => game.screenshot('05-泰迪熊-派系预览', testInfo),
    });

    await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 30000 });
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        p0: [...(state?.core?.players?.['0']?.factions ?? [])].sort(),
        p1: [...(state?.core?.players?.['1']?.factions ?? [])].sort(),
      };
    }, { timeout: 20000 }).toEqual({
      p0: ['rock_stars', 'teddy_bears'],
      p1: ['explorers', 'grannies'],
    });
    await assertNoAtlasShimmer(page);
    await game.screenshot('06-我们到底在想什么-真实选秀开局完成', testInfo);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'rock-luuv', defId: 'rock_stars_rock_of_luuv', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'rock-groupie-a', defId: 'rock_stars_groupie', type: 'minion', owner: '0' },
          { uid: 'rock-groupie-b', defId: 'rock_stars_groupie', type: 'minion', owner: '0' },
          { uid: 'rock-classic-high', defId: 'rock_stars_classic_rocker', type: 'minion', owner: '0' },
        ],
        factions: ['rock_stars', 'teddy_bears'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 4,
      },
      player1: { factions: ['grannies', 'explorers'] },
      bases: [
        { defId: 'base_palooza', minions: [] },
        { defId: 'base_under_the_bed', minions: [] },
      ],
    });

    await game.playCard('rock_stars_rock_of_luuv');
    await game.waitForInteraction('rock_stars_rock_of_luuv', 10000);
    await game.screenshot('07-爱之摇滚-牌库选择中', testInfo);
    await respondWithOptionIds(page, game, [
      option => optionHasCardUid(option, 'rock-groupie-a'),
      option => optionHasCardUid(option, 'rock-groupie-b'),
    ]);
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        handHasA: state.core.players['0']?.hand?.some((card: { uid?: string }) => card.uid === 'rock-groupie-a') ?? false,
        handHasB: state.core.players['0']?.hand?.some((card: { uid?: string }) => card.uid === 'rock-groupie-b') ?? false,
        deckHasHigh: state.core.players['0']?.deck?.some((card: { uid?: string }) => card.uid === 'rock-classic-high') ?? false,
      };
    }, { timeout: 5000 }).toEqual({ handHasA: true, handHasB: true, deckHasHigh: true });
    await game.screenshot('08-爱之摇滚-检索入手后', testInfo);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'sir-squeezes', defId: 'teddy_bears_sir_squeezes', type: 'minion', owner: '0' },
          { uid: 'snuggly-extra', defId: 'teddy_bears_snuggly_bear', type: 'minion', owner: '0' },
          { uid: 'fun-extra', defId: 'teddy_bears_fun_bear', type: 'minion', owner: '0' },
          { uid: 'lovey-too-much', defId: 'teddy_bears_lovey_bear', type: 'minion', owner: '0' },
        ],
        factions: ['rock_stars', 'teddy_bears'],
        minionsPlayed: 0,
        minionLimit: 2,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['grannies', 'explorers'] },
      bases: [
        { defId: 'base_under_the_bed', minions: [] },
        { defId: 'base_out_in_the_woods', minions: [] },
      ],
    });

    await game.playCard('teddy_bears_sir_squeezes', { targetBaseIndex: 0 });
    await game.waitForInteraction('teddy_bears_sir_squeezes', 10000);
    await game.screenshot('09-挤挤爵士-额外手牌随从选择中', testInfo);
    await respondWithOptionIds(page, game, [
      option => optionHasCardUid(option, 'snuggly-extra'),
      option => optionHasCardUid(option, 'fun-extra'),
    ]);
    const skipExtraMinionButton = page.getByRole('button', { name: '放弃这次额外随从', exact: true });
    await expect(skipExtraMinionButton).toBeVisible({ timeout: 10000 });
    await game.screenshot('10-挤挤爵士-剩余额外随从可放弃', testInfo);
    expect(await respondToSkipOptionsUntilSettled(page)).toBeGreaterThan(0);
    await expect(skipExtraMinionButton).toBeHidden({ timeout: 10000 });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const minionUids = state.core.bases[0]?.minions.map((minion: { uid?: string }) => minion.uid).sort() ?? [];
      return {
        minionUids,
        loveyStillInHand: state.core.players['0']?.hand?.some((card: { uid?: string }) => card.uid === 'lovey-too-much') ?? false,
      };
    }, { timeout: 5000 }).toEqual({
      minionUids: ['fun-extra', 'sir-squeezes', 'snuggly-extra'],
      loveyStillInHand: true,
    });
    await game.screenshot('11-挤挤爵士-额外随从打出后', testInfo);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'attic-treasures', defId: 'grannies_attic_treasures', type: 'action', owner: '0' },
          { uid: 'attic-bottom-a', defId: 'grannies_chicken_soup', type: 'action', owner: '0' },
          { uid: 'attic-bottom-b', defId: 'grannies_nana', type: 'minion', owner: '0' },
          { uid: 'attic-bottom-c', defId: 'grannies_knitting_circle', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'attic-draw-a', defId: 'grannies_granny', type: 'minion', owner: '0' },
          { uid: 'attic-draw-b', defId: 'grannies_grandma', type: 'minion', owner: '0' },
          { uid: 'attic-draw-c', defId: 'grannies_family_reunion', type: 'action', owner: '0' },
        ],
        factions: ['grannies', 'explorers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 4,
      },
      player1: { factions: ['rock_stars', 'teddy_bears'] },
      bases: [
        { defId: 'base_grandmas_house', minions: [] },
        { defId: 'base_retirement_community', minions: [] },
      ],
    });

    await game.playCard('grannies_attic_treasures');
    await game.waitForInteraction('grannies_attic_treasures', 10000);
    await game.screenshot('12-阁楼宝藏-手牌选择中', testInfo);
    await respondWithOptionIds(page, game, [
      option => optionHasCardUid(option, 'attic-bottom-a'),
      option => optionHasCardUid(option, 'attic-bottom-b'),
      option => optionHasCardUid(option, 'attic-bottom-c'),
    ]);
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        handUids: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid).sort() ?? [],
        deckUids: state.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid).sort() ?? [],
      };
    }, { timeout: 5000 }).toEqual({
      handUids: ['attic-draw-a', 'attic-draw-b', 'attic-draw-c'],
      deckUids: ['attic-bottom-a', 'attic-bottom-b', 'attic-bottom-c'],
    });
    await game.screenshot('13-阁楼宝藏-置底抽牌后', testInfo);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'x-never', defId: 'explorers_x_never_marks_the_spot', type: 'action', owner: '0' },
        ],
        factions: ['grannies', 'explorers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 4,
      },
      player1: { factions: ['rock_stars', 'teddy_bears'] },
      bases: [
        {
          defId: 'base_ancient_temple',
          minions: [
            { uid: 'explorer-a', defId: 'explorers_guide', owner: '0', controller: '0', power: 4 },
            { uid: 'explorer-b', defId: 'explorers_glory_hound', owner: '0', controller: '0', power: 2 },
          ],
        },
        { defId: 'base_city_of_gold', minions: [] },
        { defId: 'base_lake_minnetonka', minions: [] },
      ],
    });

    await game.playCard('explorers_x_never_marks_the_spot');
    await game.waitForInteraction('explorers_x_never_marks_the_spot', 10000);
    await game.screenshot('14-X从不标记地点-移动目标选择中', testInfo);
    await respondWithOptionIds(page, game, [
      option => optionHasMinionMove(option, 'explorer-a', 1),
      option => optionHasMinionMove(option, 'explorer-b', 2),
    ]);
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        base0: state.core.bases[0]?.minions.map((minion: { uid?: string }) => minion.uid) ?? [],
        base1HasA: state.core.bases[1]?.minions.some((minion: { uid?: string }) => minion.uid === 'explorer-a') ?? false,
        base2HasB: state.core.bases[2]?.minions.some((minion: { uid?: string }) => minion.uid === 'explorer-b') ?? false,
      };
    }, { timeout: 5000 }).toEqual({
      base0: [],
      base1HasA: true,
      base2HasB: true,
    });
    await assertNoAtlasShimmer(page);
    await game.screenshot('15-X从不标记地点-全部移动后', testInfo);
  });
});
