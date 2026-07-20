import { test, expect } from '../framework';
import type { Page } from '@playwright/test';
import { setChineseLocale } from '../helpers/common';

type InteractionOption = {
  value?: unknown;
};

function optionHasCardUidAndBase(option: InteractionOption, cardUid: string, baseIndex: number): boolean {
  const value = option.value;
  return !!value
    && typeof value === 'object'
    && (value as { cardUid?: unknown }).cardUid === cardUid
    && (value as { baseIndex?: unknown }).baseIndex === baseIndex;
}

async function assertAncientIncasFactionDetailLoaded(page: Page): Promise<void> {
  const detail = page.getByTestId('faction-detail-panel');
  await expect(detail).toBeVisible({ timeout: 10000 });
  await expect(detail.getByRole('heading', { name: '古代印加人' })).toBeVisible();
  await expect(detail.getByRole('tab', { name: /手牌\s*·\s*12/ })).toBeVisible();

  for (const cardName of ['美洲驼', '印加工程师', '结绳文字', '太阳神庙', '星星上的征兆']) {
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

test.describe('大杀四方文化冲击古代印加人真实入口验证', () => {
  test('派系选择页能看到古代印加人，并加载文化冲击图集', async ({ page, game }, testInfo) => {
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

    const option = page.getByTestId('faction-option-ancient_incas');
    await option.scrollIntoViewIfNeeded({ timeout: 15000 });
    await expect(option).toBeVisible({ timeout: 15000 });
    await expect.poll(async () => option.locator('.atlas-shimmer').count(), {
      message: '古代印加人派系卡不应残留 atlas shimmer',
      timeout: 15000,
    }).toBe(0);
    await option.click();
    await assertAncientIncasFactionDetailLoaded(page);
    await game.screenshot('01-古代印加人-派系选择页图集可见', testInfo);
  });

  test('结绳文字可从真实打牌入口把太阳神庙从弃牌堆额外打到基地', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'ancient_incas,aliens',
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
          { uid: 'quipu', defId: 'ancient_incas_quipu_strings', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'draw-card', defId: 'ancient_incas_llama', type: 'minion', owner: '0' },
        ],
        discard: [
          { uid: 'temple', defId: 'ancient_incas_temple_of_the_sun', type: 'action', owner: '0' },
        ],
        factions: ['ancient_incas', 'aliens'],
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
        { defId: 'base_cuzcu', minions: [] },
        { defId: 'base_machu_picchu', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await assertCardVisualReady(page, 'quipu');
    await game.screenshot('02-结绳文字-触发前', testInfo);

    await game.playCard('ancient_incas_quipu_strings');
    await game.waitForInteraction('ancient_incas_quipu_strings', 10000);
    await game.screenshot('03-结绳文字-选择弃牌堆行动和目标基地', testInfo);
    await game.selectInteractionOptionBy(
      option => optionHasCardUidAndBase(option, 'temple', 0),
      '结绳文字把太阳神庙额外打到库斯科',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        base0Ongoing: state.core.bases[0]?.ongoingActions?.map((action: { uid?: string }) => action.uid) ?? [],
        handUids: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        deckUids: state.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        discardUids: state.core.players['0']?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      base0Ongoing: ['temple'],
      handUids: ['draw-card'],
      deckUids: [],
      discardUids: ['quipu'],
      interactionOpen: false,
    });
    await game.screenshot('04-结绳文字-太阳神庙附着并抽牌后', testInfo);
  });
});
