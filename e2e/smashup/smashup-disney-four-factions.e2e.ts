import { test, expect } from '../framework';
import type { Page } from '@playwright/test';
import { setChineseLocale } from '../helpers/common';

const DISNEY_CARD_ATLAS_ID = 'smashup:disney-cards';
const DISNEY_FACTIONS = [
  'aladdin',
  'beauty_and_the_beast',
  'nightmare_before_christmas',
  'wreck_it_ralph',
] as const;

type InteractionOption = {
  id?: string;
  value?: unknown;
};

function optionMode(option: InteractionOption): string | undefined {
  const value = option.value;
  return value && typeof value === 'object'
    ? (value as { mode?: string }).mode
    : undefined;
}

async function assertDisneyAtlasLoaded(page: Page, minCardCount: number): Promise<void> {
  await expect.poll(async () => page.evaluate((expectedAtlasId) => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(
      `[data-card-atlas-id="${expectedAtlasId}"]`,
    ));
    return {
      count: nodes.length,
      shimmerCount: nodes.filter(node => node.classList.contains('atlas-shimmer')).length,
      loadedCount: nodes.filter(node => (
        Boolean(node.style.backgroundImage)
        || Boolean(node.querySelector('img[data-card-atlas-img="true"]'))
      )).length,
    };
  }, DISNEY_CARD_ATLAS_ID), { timeout: 30000 }).toMatchObject({
    shimmerCount: 0,
  });

  const summary = await page.evaluate((expectedAtlasId) => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(
      `[data-card-atlas-id="${expectedAtlasId}"]`,
    ));
    return {
      count: nodes.length,
      loadedCount: nodes.filter(node => (
        Boolean(node.style.backgroundImage)
        || Boolean(node.querySelector('img[data-card-atlas-img="true"]'))
      )).length,
    };
  }, DISNEY_CARD_ATLAS_ID);
  expect(summary.count).toBeGreaterThanOrEqual(minCardCount);
  expect(summary.loadedCount).toBe(summary.count);
}

async function assertNoDisneyAtlasShimmer(page: Page, timeout = 90000): Promise<void> {
  await expect.poll(async () => page.evaluate((expectedAtlasId) => (
    Array.from(document.querySelectorAll<HTMLElement>('.atlas-shimmer'))
      .filter(node => node.dataset.cardAtlasId === expectedAtlasId)
      .map(node => ({
        atlasId: node.dataset.cardAtlasId ?? null,
        atlasIndex: node.dataset.cardAtlasIndex ?? null,
        title: node.title || null,
      }))
  ), DISNEY_CARD_ATLAS_ID), { timeout }).toEqual([]);
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

async function dismissSpotlightIfPresent(page: Page): Promise<void> {
  const spotlightQueue = page.getByTestId('card-spotlight-queue');
  if (await spotlightQueue.isVisible({ timeout: 300 }).catch(() => false)) {
    await spotlightQueue.getByRole('button', { name: /^(关闭特写|Close spotlight)$/i }).click({ force: true });
    await page.waitForTimeout(200);
  }
}

test.describe('大杀四方迪士尼四派系真实入口验证', () => {
  test('派系选择页能看到阿拉丁、美女与野兽、圣诞夜惊魂、无敌破坏王并加载迪士尼图集', async ({ page, game }, testInfo) => {
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

    for (const factionId of DISNEY_FACTIONS) {
      await closeFactionDetailIfPresent(page);
      const option = page.getByTestId(`faction-option-${factionId}`);
      await option.scrollIntoViewIfNeeded({ timeout: 15000 });
      await expect(option).toBeVisible({ timeout: 15000 });
      await option.click();
      await expect(page.getByTestId('faction-detail-panel')).toBeVisible({ timeout: 10000 });
      await assertDisneyAtlasLoaded(page, 1);
      await option.screenshot({ path: testInfo.outputPath(`disney-faction-option-${factionId}.png`) });
    }

    await game.screenshot('01-迪士尼四派系-派系选择页可见', testInfo);
  });

  test('真实打出“愿望”后可从迪士尼 prompt 抽到四派系牌并清空交互', async ({ page, game }, testInfo) => {
    test.setTimeout(150000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        factions: ['aladdin', 'beauty_and_the_beast'],
        hand: [
          { uid: 'wish-card', defId: 'aladdin_wish', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'draw-aladdin', defId: 'aladdin_abu', type: 'minion', owner: '0' },
          { uid: 'draw-beauty', defId: 'beauty_and_the_beast_belle', type: 'minion', owner: '0' },
          { uid: 'draw-nightmare', defId: 'nightmare_before_christmas_monster_garland', type: 'action', owner: '0' },
          { uid: 'draw-ralph', defId: 'wreck_it_ralph_king_candy', type: 'action', owner: '0' },
        ],
        discard: [],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 3,
      },
      player1: {
        factions: ['nightmare_before_christmas', 'wreck_it_ralph'],
        hand: [],
        deck: [],
        discard: [],
      },
      bases: [
        {
          defId: 'base_agrabah_bazaar',
          minions: [
            { uid: 'genie', defId: 'aladdin_genie', owner: '0', controller: '0', power: 5 },
          ],
        },
        {
          defId: 'base_halloween_town',
          minions: [],
        },
      ],
    });

    await game.waitForPhase('playCards', 10000);
    await expect(page.locator('[data-card-uid="wish-card"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="genie"]')).toBeVisible({ timeout: 15000 });
    await assertDisneyAtlasLoaded(page, 2);
    await game.screenshot('02-愿望-真实打出前', testInfo);

    await game.playCard('aladdin_wish');
    await game.waitForInteraction('aladdin_wish', 15000);
    await assertDisneyAtlasLoaded(page, 2);
    await game.screenshot('03-愿望-迪士尼prompt出现', testInfo);

    await game.selectInteractionOptionBy(
      (option: InteractionOption) => optionMode(option) === 'draw',
      '愿望选择抽四张牌',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      return {
        handUids: player.hand.map((card: { uid?: string }) => card.uid).sort(),
        removedUids: (player.removedFromGame ?? []).map((card: { uid?: string }) => card.uid),
        deckCount: player.deck.length,
        interactionSource: state.sys?.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      handUids: ['draw-aladdin', 'draw-beauty', 'draw-nightmare', 'draw-ralph'],
      removedUids: ['wish-card'],
      deckCount: 0,
      interactionSource: null,
    });

    await assertNoDisneyAtlasShimmer(page);
    await game.screenshot('04-愿望-抽到四派系牌并收口', testInfo);
  });
});
