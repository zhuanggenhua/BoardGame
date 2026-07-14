import { test, expect } from '../framework';
import type { Page } from '@playwright/test';
import { setChineseLocale } from '../helpers/common';

type InteractionOption = {
  value?: unknown;
};

function optionHasCardUid(option: InteractionOption, cardUid: string): boolean {
  const value = option.value;
  return !!value && typeof value === 'object' && (value as { cardUid?: unknown }).cardUid === cardUid;
}

function optionHasPlayerId(option: InteractionOption, playerId: string): boolean {
  const value = option.value;
  return !!value && typeof value === 'object' && (value as { targetPlayerId?: unknown }).targetPlayerId === playerId;
}

async function assertAnansiFactionDetailLoaded(page: Page): Promise<void> {
  const detail = page.getByTestId('faction-detail-panel');
  await expect(detail).toBeVisible({ timeout: 10000 });
  await expect(detail.getByRole('heading', { name: '阿南西传说' })).toBeVisible();
  await expect(detail.getByRole('tab', { name: /手牌\s*·\s*13/ })).toBeVisible();

  for (const cardName of ['蜘蛛阿南西', '完美的礼物', '交易故事', '羽毛礼物']) {
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
    await spotlightQueue.click({ force: true });
    await page.waitForTimeout(200);
  }

  const dismissHint = page.getByText(/Click anywhere to close|点击关闭|点击任意位置关闭/i).first();
  if (await dismissHint.isVisible({ timeout: 300 }).catch(() => false)) {
    await dismissHint.click({ force: true });
    await page.waitForTimeout(200);
  }
}

test.describe('大杀四方文化冲击阿南西传说真实入口验证', () => {
  test('派系选择页能看到阿南西传说，并加载文化冲击图集', async ({ page, game }, testInfo) => {
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

    const option = page.getByTestId('faction-option-anansi_tales');
    await option.scrollIntoViewIfNeeded({ timeout: 15000 });
    await expect(option).toBeVisible({ timeout: 15000 });
    await expect.poll(async () => option.locator('.atlas-shimmer').count(), {
      message: '阿南西传说派系卡不应残留 atlas shimmer',
      timeout: 15000,
    }).toBe(0);
    await option.click();
    await assertAnansiFactionDetailLoaded(page);
    await game.screenshot('01-阿南西传说-派系选择页图集可见', testInfo);
  });

  test('完美的礼物与故事讲述者小屋可从真实入口结算到权威状态', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'anansi_tales,aliens',
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
          { uid: 'perfect-gift', defId: 'anansi_tales_the_perfect_gift', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'selected-action', defId: 'anansi_tales_trading_stories', type: 'action', owner: '0' },
          { uid: 'draw-buffer', defId: 'anansi_tales_pot_of_beans', type: 'action', owner: '0' },
        ],
        discard: [],
        factions: ['anansi_tales', 'aliens'],
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
        { defId: 'base_storytellers_hut', minions: [] },
        {
          defId: 'base_anansis_web',
          minions: [
            { uid: 'web-ally', defId: 'anansi_tales_akye_the_turtle', owner: '0', controller: '0', power: 3 },
          ],
        },
      ],
      extra: {
        core: {
          turnNumber: 1,
          usedBaseAbilitiesThisTurn: [],
        },
      },
    });

    await game.waitForPhase('playCards');
    await expect(page.locator('[data-card-uid="perfect-gift"]')).toBeVisible({ timeout: 15000 });
    await assertCardVisualReady(page, 'perfect-gift');
    await assertCardVisualReady(page, 'web-ally');
    await game.screenshot('02-完美的礼物-触发前', testInfo);

    await game.playCard('anansi_tales_the_perfect_gift');
    await game.waitForInteraction('anansi_tales_the_perfect_gift', 10000);
    await game.screenshot('03-完美的礼物-牌库行动选择中', testInfo);
    await game.selectInteractionOptionBy(
      option => optionHasCardUid(option, 'selected-action'),
      '完美的礼物选择牌库里的交易故事',
    );

    await game.waitForInteraction('anansi_tales_the_perfect_gift_gift', 10000);
    await game.screenshot('04-完美的礼物-给出玩家选择中', testInfo);
    await game.selectInteractionOptionBy(
      option => optionHasPlayerId(option, '1'),
      '完美的礼物把交易故事给玩家 1',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        deckUids: state.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        p0DiscardUids: state.core.players['0']?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        p1HandUids: state.core.players['1']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      deckUids: ['draw-buffer'],
      p0DiscardUids: ['perfect-gift'],
      p1HandUids: ['selected-action'],
      interactionOpen: false,
    });
    await game.screenshot('05-完美的礼物-行动给出结算后', testInfo);

    const beforeHut = await game.getState();
    const beforeActionLimit = beforeHut.core.players['0']?.actionLimit ?? 0;
    await expect(page.getByTestId('base-ability-badge-0')).toBeVisible({ timeout: 10000 });
    await game.screenshot('06-故事讲述者小屋-主动基地能力触发前', testInfo);

    await game.selectBase(0);
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        counters: state.core.bases[0]?.metadata?.storytellersHutCounters ?? 0,
        actionLimit: state.core.players['0']?.actionLimit ?? 0,
        usedCount: state.core.usedBaseAbilitiesThisTurn?.filter((entry: { playerId?: string; baseIndex?: number; baseDefId?: string }) => (
          entry.playerId === '0' && entry.baseIndex === 0 && entry.baseDefId === 'base_storytellers_hut'
        )).length ?? 0,
      };
    }, { timeout: 10000 }).toEqual({
      counters: 1,
      actionLimit: beforeActionLimit + 1,
      usedCount: 1,
    });
    await assertCardVisualReady(page, 'web-ally');
    await game.screenshot('07-故事讲述者小屋-主动基地能力结算后', testInfo);
  });
});
