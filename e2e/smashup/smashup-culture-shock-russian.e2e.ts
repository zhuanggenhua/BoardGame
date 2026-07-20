import { test, expect } from '../framework';
import type { Page } from '@playwright/test';
import { setChineseLocale } from '../helpers/common';

type InteractionOption = {
  value?: unknown;
};

function optionHasMinionUid(option: InteractionOption, minionUid: string): boolean {
  const value = option.value;
  return !!value && typeof value === 'object' && (value as { minionUid?: unknown }).minionUid === minionUid;
}

async function assertRussianFactionDetailLoaded(page: Page): Promise<void> {
  const detail = page.getByTestId('faction-detail-panel');
  await expect(detail).toBeVisible({ timeout: 10000 });
  await expect(detail.getByRole('heading', { name: '俄罗斯童话' })).toBeVisible();
  await expect(detail.getByRole('tab', { name: /手牌\s*·\s*16/ })).toBeVisible();

  for (const cardName of ['芬尼斯特猎鹰', '芭芭雅嘎', '青蛙公主', '变化', '弥撒变化']) {
    await expect(detail.getByText(cardName).first()).toBeVisible();
  }
}

async function assertCardVisualReady(page: Page, cardUid: string): Promise<void> {
  const card = page.locator(`[data-card-uid="${cardUid}"], [data-minion-uid="${cardUid}"]`).first();
  await expect(card).toBeVisible({ timeout: 10000 });
  await expect.poll(async () => card.evaluate((element) => {
    const hasShimmer = element.querySelector('.atlas-shimmer') !== null;
    const hasImage = element.querySelector('img') !== null;
    const hasBackground = Array.from(element.querySelectorAll<HTMLElement>('div')).some((node) => (
      window.getComputedStyle(node).backgroundImage.includes('url(')
    ));
    return { hasShimmer, hasVisual: hasImage || hasBackground };
  }), { timeout: 15000 }).toEqual({ hasShimmer: false, hasVisual: true });
}

async function dismissSpotlightIfPresent(page: Page): Promise<void> {
  const spotlightQueue = page.getByTestId('card-spotlight-queue');
  if (await spotlightQueue.isVisible({ timeout: 300 }).catch(() => false)) {
    await spotlightQueue.getByRole('button', { name: /^(关闭特写|Close spotlight)$/i }).click({ force: true });
    await page.waitForTimeout(200);
  }

  const dismissHint = page.getByText(/Click anywhere to close|点击关闭|点击任意位置关闭/i).first();
  if (await dismissHint.isVisible({ timeout: 300 }).catch(() => false)) {
    await dismissHint.click({ force: true });
    await page.waitForTimeout(200);
  }
}

test.describe('大杀四方文化冲击俄罗斯童话真实入口验证', () => {
  test('派系选择页能看到俄罗斯童话，并加载文化冲击图集', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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

    const option = page.getByTestId('faction-option-russian_fairy_tales');
    await option.scrollIntoViewIfNeeded({ timeout: 15000 });
    await expect(option).toBeVisible({ timeout: 15000 });
    await expect.poll(async () => option.locator('.atlas-shimmer').count(), {
      message: '俄罗斯童话派系卡不应残留 atlas shimmer',
      timeout: 15000,
    }).toBe(0);
    await option.click();
    await assertRussianFactionDetailLoaded(page);
    await game.screenshot('01-俄罗斯童话-派系选择页图集可见', testInfo);
  });

  test('变化可从真实打牌入口将场上随从变形成牌库随从', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'russian_fairy_tales,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260714,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'transformation', defId: 'russian_fairy_tales_transformation', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'deck-action', defId: 'russian_fairy_tales_the_water_of_life', type: 'action', owner: '0' },
          { uid: 'deck-minion', defId: 'russian_fairy_tales_the_birch', type: 'minion', owner: '0' },
        ],
        discard: [],
        factions: ['russian_fairy_tales', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 3,
        vp: 0,
      },
      player1: {
        hand: [],
        deck: [],
        discard: [],
        factions: ['pirates', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      bases: [
        {
          defId: 'base_transformation_spring',
          minions: [
            { uid: 'target-minion', defId: 'pirate_first_mate', owner: '0', controller: '0', power: 2 },
          ],
        },
        { defId: 'base_giant_turnip', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await assertCardVisualReady(page, 'transformation');
    await assertCardVisualReady(page, 'target-minion');
    await game.screenshot('02-变化-触发前', testInfo);

    await game.playCard('russian_fairy_tales_transformation');
    await game.waitForInteraction('russian_fairy_tales_transformation', 10000);
    await game.screenshot('03-变化-选择要变形的随从', testInfo);
    await game.selectInteractionOptionBy(
      option => optionHasMinionUid(option, 'target-minion'),
      '变化选择场上的目标随从',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        base0Minions: state.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid) ?? [],
        deckUids: state.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        discardUids: state.core.players['0']?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      base0Minions: ['deck-minion'],
      deckUids: ['deck-action', 'target-minion'],
      discardUids: ['transformation'],
      interactionOpen: false,
    });
    await assertCardVisualReady(page, 'deck-minion');
    await game.screenshot('04-变化-白桦木变形结算后', testInfo);
  });
});
