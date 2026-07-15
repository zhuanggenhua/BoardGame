import { test, expect } from '../framework';
import type { Page } from '@playwright/test';
import { setChineseLocale } from '../helpers/common';

const MARVEL_VILLAINS_ATLAS_ID = 'smashup:marvel-villains-cards';
const MARVEL_VILLAINS_UNIQUE_CARD_COUNT_BY_FACTION: Record<string, number> = {
  hydra: 11,
  kree: 12,
  masters_of_evil: 12,
  sinister_six: 14,
};

type InteractionOption = {
  value?: unknown;
};

function optionHasBaseIndex(option: InteractionOption, baseIndex: number): boolean {
  const value = option.value;
  return !!value && typeof value === 'object' && (value as { baseIndex?: unknown }).baseIndex === baseIndex;
}

function optionHasCardUid(option: InteractionOption, cardUid: string): boolean {
  const value = option.value;
  return !!value && typeof value === 'object' && (value as { cardUid?: unknown }).cardUid === cardUid;
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
      const harness = (window as Window & {
        __BG_TEST_HARNESS__?: { state?: { get?: () => unknown } };
      }).__BG_TEST_HARNESS__;
      const state = harness?.state?.get?.() as {
        core?: {
          factionSelection?: {
            playerSelections?: Record<string, string[]>;
          };
          turnOrder?: string[];
          currentPlayerIndex?: number;
        };
      } | undefined;
      const selection = state?.core?.factionSelection;
      if (!selection) return false;
      const currentPlayerId = state.core.turnOrder?.[state.core.currentPlayerIndex ?? 0];
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
  await assertAtlasLoaded(
    page,
    MARVEL_VILLAINS_ATLAS_ID,
    MARVEL_VILLAINS_UNIQUE_CARD_COUNT_BY_FACTION[options.factionId] ?? 12,
  );
  await options.beforeConfirm?.();

  const confirmButton = page.getByTestId('faction-confirm-button');
  await expect(confirmButton).toBeVisible({ timeout: 10000 });
  await expect(confirmButton).toBeEnabled({ timeout: 10000 });
  await confirmButton.click();

  await page.waitForFunction(
    ({ playerId, factionId }) => {
      const harness = (window as Window & {
        __BG_TEST_HARNESS__?: { state?: { get?: () => unknown } };
      }).__BG_TEST_HARNESS__;
      const state = harness?.state?.get?.() as {
        core?: {
          factionSelection?: {
            playerSelections?: Record<string, string[]>;
          };
          players?: Record<string, { factions?: string[] }>;
        };
      } | undefined;
      const selected = state?.core?.factionSelection?.playerSelections?.[playerId] ?? [];
      const finalFactions = state?.core?.players?.[playerId]?.factions ?? [];
      return selected.includes(factionId) || finalFactions.includes(factionId);
    },
    { playerId: options.playerId, factionId: options.factionId },
    { timeout: 20000, polling: 200 },
  );
}

async function dismissSpotlightIfPresent(page: Page): Promise<void> {
  const spotlightQueue = page.getByTestId('card-spotlight-queue');
  if (await spotlightQueue.isVisible({ timeout: 300 }).catch(() => false)) {
    await spotlightQueue.click({ force: true });
    await page.waitForTimeout(200);
  }
}

test.describe('大杀四方漫威反派四派系真实入口验证', () => {
  test('派系选择页能看到九头蛇、克里、邪恶大师、邪恶六人组，并加载共享漫威反派图集', async ({ page, game }, testInfo) => {
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

    for (const factionId of ['hydra', 'kree', 'masters_of_evil', 'sinister_six']) {
      await closeFactionDetailIfPresent(page);
      const option = page.getByTestId(`faction-option-${factionId}`);
      await option.scrollIntoViewIfNeeded({ timeout: 15000 });
      await expect(option).toBeVisible({ timeout: 15000 });
      await option.click();
      await assertAtlasLoaded(
        page,
        MARVEL_VILLAINS_ATLAS_ID,
        MARVEL_VILLAINS_UNIQUE_CARD_COUNT_BY_FACTION[factionId] ?? 12,
      );
      await option.screenshot({ path: testInfo.outputPath(`marvel-villains-faction-option-${factionId}.png`) });
    }

    await game.screenshot('01-漫威反派四派-派系选择页共享图集可见', testInfo);
  });

  test('四派系真实选秀后可开局，并完成九头蛇、克里、邪恶大师、邪恶六人组代表能力链', async ({ page, game }, testInfo) => {
    test.setTimeout(240000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      seed: 20260714,
      seat1ManualSetup: true,
    }, 45000);
    await expect(page.locator('[data-tutorial-id="su-faction-select"]')).toBeVisible({ timeout: 30000 });

    await pickFaction(page, {
      playerId: '0',
      selectedCountBeforePick: 0,
      factionId: 'hydra',
      beforeConfirm: () => game.screenshot('02-九头蛇-派系预览', testInfo),
    });
    await pickFaction(page, {
      playerId: '1',
      selectedCountBeforePick: 0,
      factionId: 'masters_of_evil',
      beforeConfirm: () => game.screenshot('03-邪恶大师-派系预览', testInfo),
    });
    await pickFaction(page, {
      playerId: '1',
      selectedCountBeforePick: 1,
      factionId: 'sinister_six',
      beforeConfirm: () => game.screenshot('04-邪恶六人组-派系预览', testInfo),
    });
    await pickFaction(page, {
      playerId: '0',
      selectedCountBeforePick: 1,
      factionId: 'kree',
      beforeConfirm: () => game.screenshot('05-克里-派系预览', testInfo),
    });

    await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 30000 });
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        p0: [...(state?.core?.players?.['0']?.factions ?? [])].sort(),
        p1: [...(state?.core?.players?.['1']?.factions ?? [])].sort(),
      };
    }, { timeout: 20000 }).toEqual({
      p0: ['hydra', 'kree'],
      p1: ['masters_of_evil', 'sinister_six'],
    });
    await assertNoAtlasShimmer(page);
    await game.screenshot('06-漫威反派四派-真实选秀开局完成', testInfo);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'p0-hail-hydra', defId: 'hydra_hail_hydra', type: 'action', owner: '0' },
          { uid: 'p0-battle-rage', defId: 'kree_battle_rage', type: 'action', owner: '0' },
          { uid: 'p0-acceptable-losses', defId: 'masters_of_evil_acceptable_losses', type: 'action', owner: '0' },
          { uid: 'p0-move-goods', defId: 'sinister_six_move_the_goods', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'p0-hydra-draw-a', defId: 'hydra_hydra_agent', type: 'minion', owner: '0' },
          { uid: 'p0-hydra-draw-b', defId: 'hydra_hour_of_destiny', type: 'action', owner: '0' },
          { uid: 'p0-kree-draw', defId: 'kree_speed_up', type: 'action', owner: '0' },
        ],
        discard: [],
        factions: ['hydra', 'kree', 'masters_of_evil', 'sinister_six'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 6,
        vp: 0,
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
          defId: 'base_juice_bar',
          minions: [],
          ongoingActions: [
            { uid: 'sinister-plan', defId: 'sinister_six_my_master_plan', ownerId: '0', talentUsed: false },
          ],
        },
        {
          defId: 'base_moon_dumpster',
          minions: [
            { uid: 'hydra-agent', defId: 'hydra_hydra_agent', owner: '0', controller: '0', power: 2 },
          ],
          ongoingActions: [],
        },
        {
          defId: 'base_the_pasture',
          minions: [
            { uid: 'kree-target', defId: 'kree_ronan_the_accuser', owner: '0', controller: '0', power: 3 },
          ],
          ongoingActions: [],
        },
        {
          defId: 'base_the_jungle',
          minions: [
            { uid: 'masters-big', defId: 'masters_of_evil_ulysses_klaw', owner: '0', controller: '0', power: 4 },
          ],
          ongoingActions: [],
        },
      ],
    });

    await assertNoAtlasShimmer(page);
    await game.screenshot('07-漫威反派代表能力-触发前', testInfo);

    await game.playCard('hydra_hail_hydra', { targetMinionUid: 'hydra-agent' });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const allMinions = state.core.bases.flatMap((base: { minions?: Array<{ uid?: string }> }) => base.minions ?? []);
      return {
        hydraAgentOnBase: allMinions.some((minion: { uid?: string }) => minion.uid === 'hydra-agent'),
        drewFirstCard: state.core.players['0']?.hand?.some((card: { uid?: string }) => card.uid === 'p0-hydra-draw-a') ?? false,
        drewSecondCard: state.core.players['0']?.hand?.some((card: { uid?: string }) => card.uid === 'p0-hydra-draw-b') ?? false,
      };
    }, { timeout: 10000 }).toEqual({
      hydraAgentOnBase: false,
      drewFirstCard: true,
      drewSecondCard: true,
    });
    await game.screenshot('08-九头蛇万岁-献祭抽牌后', testInfo);

    await game.playCard('kree_battle_rage', { targetMinionUid: 'kree-target' });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const target = state.core.bases
        .flatMap((base: { minions?: Array<{ uid?: string; tempPowerModifier?: number; powerModifier?: number }> }) => base.minions ?? [])
        .find((minion: { uid?: string }) => minion.uid === 'kree-target');
      return {
        modifier: (target?.tempPowerModifier ?? 0) + (target?.powerModifier ?? 0),
        drewKreeCard: state.core.players['0']?.hand?.some((card: { uid?: string }) => card.uid === 'p0-kree-draw') ?? false,
      };
    }, { timeout: 10000 }).toEqual({
      modifier: 2,
      drewKreeCard: true,
    });
    await game.screenshot('09-克里战斗狂怒-加力抽牌后', testInfo);

    await game.playCard('masters_of_evil_acceptable_losses', { targetMinionUid: 'masters-big' });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const allMinions = state.core.bases.flatMap((base: { minions?: Array<{ uid?: string }> }) => base.minions ?? []);
      return {
        mastersBigOnBase: allMinions.some((minion: { uid?: string }) => minion.uid === 'masters-big'),
        vp: state.core.players['0']?.vp ?? 0,
      };
    }, { timeout: 10000 }).toEqual({
      mastersBigOnBase: false,
      vp: 1,
    });
    await game.screenshot('10-邪恶大师可接受损失-摧毁得VP后', testInfo);

    await game.playCard('sinister_six_move_the_goods');
    await game.waitForInteraction('marvel_villains_move_modifier_prompt', 10000);
    await game.selectInteractionOptionBy(option => optionHasCardUid(option, 'sinister-plan'), '邪恶六人组移动货物选择我的总计划');
    await game.waitForInteraction('marvel_villains_base_destination_prompt', 10000);
    await game.selectInteractionOptionBy(option => optionHasBaseIndex(option, 1), '邪恶六人组移动货物移动到第二个基地');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        base0HasPlan: state.core.bases[0]?.ongoingActions.some((action: { uid?: string }) => action.uid === 'sinister-plan') ?? false,
        base1HasPlan: state.core.bases[1]?.ongoingActions.some((action: { uid?: string }) => action.uid === 'sinister-plan') ?? false,
      };
    }, { timeout: 10000 }).toEqual({
      base0HasPlan: false,
      base1HasPlan: true,
    });
    await assertNoAtlasShimmer(page);
    await game.screenshot('11-邪恶六人组移动货物-基地神器移动后', testInfo);
  });
});
