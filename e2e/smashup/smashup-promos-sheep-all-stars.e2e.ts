import { test, expect } from '../framework';
import type { Page } from '@playwright/test';
import { setChineseLocale } from '../helpers/common';

const PROMOS_ATLAS_ID = 'smashup:promos-sheep-all-stars-cards';

type InteractionOption = {
  value?: unknown;
};

async function assertAtlasLoaded(page: Page, atlasId: string, minCardCount: number): Promise<void> {
  await expect.poll(async () => page.evaluate((expectedAtlasId) => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(
      `[data-card-atlas-id="${expectedAtlasId}"]`,
    ));
    return {
      count: nodes.length,
      shimmerCount: nodes.filter(node => node.classList.contains('atlas-shimmer')).length,
      loadedCount: nodes.filter(node => {
        const image = node.querySelector<HTMLImageElement>('[data-card-atlas-img="true"]');
        return Boolean(image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
      }).length,
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
      loadedCount: nodes.filter(node => {
        const image = node.querySelector<HTMLImageElement>('[data-card-atlas-img="true"]');
        return Boolean(image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
      }).length,
    };
  }, atlasId);
  expect(summary.count).toBeGreaterThanOrEqual(minCardCount);
  expect(summary.loadedCount).toBe(summary.count);
}

async function assertNoAtlasShimmer(page: Page, timeout = 90000): Promise<void> {
  await expect.poll(async () => page.evaluate(() => (
    Array.from(document.querySelectorAll<HTMLElement>('.atlas-shimmer')).map(node => ({
      atlasId: node.dataset.cardAtlasId ?? null,
      atlasIndex: node.dataset.cardAtlasIndex ?? null,
      title: node.title || null,
    }))
  )), { timeout }).toEqual([]);
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
      const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
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
    atlasCardCount?: number;
    beforeConfirm?: () => Promise<void>;
  },
): Promise<void> {
  await waitForDraftTurn(page, options.playerId, options.selectedCountBeforePick);
  const faction = page.getByTestId(`faction-option-${options.factionId}`);
  await faction.scrollIntoViewIfNeeded({ timeout: 15000 });
  await expect(faction).toBeVisible({ timeout: 15000 });
  await faction.click();
  await expect(page.getByTestId('faction-detail-panel')).toBeVisible({ timeout: 10000 });

  if (options.atlasCardCount !== undefined) {
    await assertAtlasLoaded(page, PROMOS_ATLAS_ID, options.atlasCardCount);
  }

  await options.beforeConfirm?.();

  const confirmButton = page.getByTestId('faction-confirm-button');
  await expect(confirmButton).toBeVisible({ timeout: 10000 });
  await expect(confirmButton).toBeEnabled({ timeout: 10000 });
  await confirmButton.click();

  await page.waitForFunction(
    ({ playerId, factionId }) => {
      const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
      const selected = state?.core?.factionSelection?.playerSelections?.[playerId] ?? [];
      const finalFactions = state?.core?.players?.[playerId]?.factions ?? [];
      return selected.includes(factionId) || finalFactions.includes(factionId);
    },
    { playerId: options.playerId, factionId: options.factionId },
    { timeout: 20000, polling: 200 },
  );
}

function optionHasMinionUid(option: InteractionOption, minionUid: string): boolean {
  const value = option.value;
  return !!value && typeof value === 'object' && (value as { minionUid?: unknown }).minionUid === minionUid;
}

function optionHasCardUid(option: InteractionOption, cardUid: string): boolean {
  const value = option.value;
  return !!value && typeof value === 'object' && (value as { cardUid?: unknown }).cardUid === cardUid;
}

test.describe('大杀四方 Promo 绵羊与全明星真实入口验证', () => {
  test('派系选择页能看到绵羊、全明星，并加载共享 Promo 图集', async ({ page, game }, testInfo) => {
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

    for (const [factionId, expectedCards] of [['sheep', 12], ['all_stars', 20]] as const) {
      await closeFactionDetailIfPresent(page);
      const option = page.getByTestId(`faction-option-${factionId}`);
      await option.scrollIntoViewIfNeeded({ timeout: 15000 });
      await expect(option).toBeVisible({ timeout: 15000 });
      await option.click();
      await assertAtlasLoaded(page, PROMOS_ATLAS_ID, expectedCards);
      await option.screenshot({ path: testInfo.outputPath(`promo-faction-option-${factionId}.png`) });
    }

    await game.screenshot('01-绵羊全明星-派系选择页共享图集可见', testInfo);
  });

  test('真实选秀后可开局，并完成绵羊与全明星代表能力链', async ({ page, game }, testInfo) => {
    test.setTimeout(240000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      seed: 20260713,
      seat1ManualSetup: true,
    }, 45000);
    await expect(page.locator('[data-tutorial-id="su-faction-select"]')).toBeVisible({ timeout: 30000 });

    await pickFaction(page, {
      playerId: '0',
      selectedCountBeforePick: 0,
      factionId: 'sheep',
      atlasCardCount: 12,
      beforeConfirm: () => game.screenshot('02-绵羊-派系预览', testInfo),
    });
    await pickFaction(page, {
      playerId: '1',
      selectedCountBeforePick: 0,
      factionId: 'aliens',
    });
    await pickFaction(page, {
      playerId: '1',
      selectedCountBeforePick: 1,
      factionId: 'pirates',
    });
    await pickFaction(page, {
      playerId: '0',
      selectedCountBeforePick: 1,
      factionId: 'all_stars',
      atlasCardCount: 20,
      beforeConfirm: () => game.screenshot('03-全明星-派系预览', testInfo),
    });

    await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 30000 });
    await expect.poll(async () => {
      const state = await game.getState();
      return [...(state?.core?.players?.['0']?.factions ?? [])].sort();
    }, { timeout: 20000 }).toEqual(['all_stars', 'sheep']);
    await assertNoAtlasShimmer(page);
    await game.screenshot('04-绵羊全明星-真实选秀开局完成', testInfo);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'ewe-action', defId: 'sheep_ewe_shall_pass', type: 'action', owner: '0' },
          { uid: 'prepare-action', defId: 'all_stars_prepare_for_battle', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'prepare-top-a', defId: 'all_stars_puck', type: 'minion', owner: '0' },
          { uid: 'prepare-top-b', defId: 'all_stars_fan', type: 'minion', owner: '0' },
          { uid: 'draw-after-ewe', defId: 'sheep_flock', type: 'minion', owner: '0' },
        ],
        discard: [],
        factions: ['sheep', 'all_stars'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 3,
      },
      player1: {
        hand: [],
        deck: [],
        discard: [],
        factions: ['aliens', 'pirates'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      bases: [
        {
          defId: 'base_the_pasture',
          minions: [
            { uid: 'sheep-runner', defId: 'sheep_flock', owner: '0', controller: '0', power: 2 },
          ],
        },
        { defId: 'base_locker_room', minions: [] },
        { defId: 'base_stadium', minions: [] },
      ],
    });

    await assertNoAtlasShimmer(page);
    await game.screenshot('05-母羊放行-触发前', testInfo);
    await game.playCard('sheep_ewe_shall_pass');
    await game.waitForInteraction('sheep_ewe_shall_pass', 10000);
    await game.screenshot('06-母羊放行-随从选择中', testInfo);
    await game.selectInteractionOptionBy(option => optionHasMinionUid(option, 'sheep-runner'), '母羊放行选择羊群移动');
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        pastureHasRunner: state.core.bases[0]?.minions.some((minion: { uid?: string }) => minion.uid === 'sheep-runner') ?? false,
        lockerHasRunner: state.core.bases[1]?.minions.some((minion: { uid?: string }) => minion.uid === 'sheep-runner') ?? false,
        handHasDrawnCard: state.core.players['0']?.hand?.some((card: { uid?: string }) => card.uid === 'prepare-top-a') ?? false,
      };
    }, { timeout: 10000 }).toEqual({
      pastureHasRunner: false,
      lockerHasRunner: true,
      handHasDrawnCard: true,
    });
    await game.screenshot('07-母羊放行-移动抽牌后', testInfo);

    await game.playCard('all_stars_prepare_for_battle');
    await game.waitForInteraction('all_stars_prepare_for_battle', 10000);
    await game.screenshot('08-准备战斗-选择加入手牌', testInfo);
    await game.selectInteractionOptionBy(option => optionHasCardUid(option, 'prepare-top-b'), '准备战斗选择狂热粉丝');
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        handHasFan: state.core.players['0']?.hand?.some((card: { uid?: string }) => card.uid === 'prepare-top-b') ?? false,
        deckBottomUid: state.core.players['0']?.deck?.at(-1)?.uid ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      handHasFan: true,
      deckBottomUid: 'draw-after-ewe',
    });
    await assertNoAtlasShimmer(page);
    await game.screenshot('09-准备战斗-选择后收口', testInfo);
  });
});
