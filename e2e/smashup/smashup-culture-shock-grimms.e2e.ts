import { test, expect } from '../framework';
import type { Page } from '@playwright/test';
import { setChineseLocale } from '../helpers/common';

type InteractionOption = {
  id: string;
  value?: unknown;
};

function optionHasMinionUid(option: InteractionOption, minionUid: string): boolean {
  const value = option.value;
  return !!value && typeof value === 'object' && (value as { minionUid?: unknown }).minionUid === minionUid;
}

function optionHasCardUid(option: InteractionOption, cardUid: string): boolean {
  const value = option.value;
  return !!value && typeof value === 'object' && (value as { cardUid?: unknown }).cardUid === cardUid;
}

function optionHasTeamworkPlay(option: InteractionOption, cardUid: string, baseIndex: number): boolean {
  const value = option.value;
  return !!value
    && typeof value === 'object'
    && (value as { cardUid?: unknown }).cardUid === cardUid
    && (value as { mode?: unknown }).mode === 'play'
    && (value as { baseIndex?: unknown }).baseIndex === baseIndex;
}

async function clickDiscardCard(page: Page, cardUid: string): Promise<void> {
  const card = page.locator(`[data-discard-view-panel] [data-card-uid="${cardUid}"]`).first();
  await expect(card).toBeVisible({ timeout: 10000 });
  await card.click({ force: true });
  await page.waitForTimeout(300);
}

async function clickBoardMinion(page: Page, minionUid: string): Promise<void> {
  const minion = page.locator(`[data-minion-uid="${minionUid}"]`).first();
  await expect(minion).toBeVisible({ timeout: 10000 });
  await minion.click({ force: true });
  await page.waitForTimeout(300);
}

async function clickVisibleMinionEdge(page: Page, minionUid: string): Promise<void> {
  const minion = page.locator(`[data-minion-uid="${minionUid}"]`).first();
  await expect(minion).toBeVisible({ timeout: 10000 });
  const box = await minion.boundingBox();
  if (!box) throw new Error(`随从不可测量: ${minionUid}`);
  await minion.click({ position: { x: box.width / 2, y: 5 } });
  await page.waitForTimeout(300);
}

async function clickVisibleMinionBottomEdge(page: Page, minionUid: string): Promise<void> {
  const minion = page.locator(`[data-minion-uid="${minionUid}"]`).first();
  await expect(minion).toBeVisible({ timeout: 10000 });
  const box = await minion.boundingBox();
  if (!box) throw new Error(`随从不可测量: ${minionUid}`);
  await minion.click({ position: { x: box.width / 2, y: box.height - 5 } });
  await page.waitForTimeout(300);
}

async function assertGrimmsFactionDetailLoaded(page: Page): Promise<void> {
  const detail = page.getByTestId('faction-detail-panel');
  await expect(detail).toBeVisible({ timeout: 10000 });
  await expect(detail.getByRole('heading', { name: '格林童话' })).toBeVisible();
  await expect(detail.getByRole('tab', { name: /手牌\s*·\s*18/ })).toBeVisible();

  for (const cardName of ['汉瑟', '格雷特', '樵夫的斧子', '团队合作', '格林兄弟的祝福']) {
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

test.describe('大杀四方文化冲击格林童话真实入口验证', () => {
  test('派系选择页能看到格林童话，并加载文化冲击图集', async ({ page, game }, testInfo) => {
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

    const factionSearch = page.getByTestId('faction-search-input');
    await expect(factionSearch).toBeVisible({ timeout: 15000 });
    await factionSearch.fill('格林');

    const option = page.getByTestId('faction-option-grimms_fairy_tales');
    await expect(option).toBeVisible({ timeout: 15000 });
    await expect.poll(async () => option.locator('.atlas-shimmer').count(), {
      message: '格林童话派系卡不应残留 atlas shimmer',
      timeout: 15000,
    }).toBe(0);
    await option.click();
    await assertGrimmsFactionDetailLoaded(page);
    await game.screenshot('01-格林童话-派系选择页图集可见', testInfo);
  });

  test('团队合作可从真实打牌入口检索并额外打出格雷特', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'grimms_fairy_tales,aliens',
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
          { uid: 'teamwork', defId: 'grimms_fairy_tales_teamwork', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'deck-gretel', defId: 'grimms_fairy_tales_gretel', type: 'minion', owner: '0' },
        ],
        discard: [],
        factions: ['grimms_fairy_tales', 'aliens'],
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
          defId: 'base_gingerbread_house',
          minions: [
            { uid: 'hansel', defId: 'grimms_fairy_tales_hansel', owner: '0', controller: '0', power: 2 },
          ],
        },
        { defId: 'base_woodland_cottage', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await assertCardVisualReady(page, 'teamwork');
    await assertCardVisualReady(page, 'hansel');
    await game.screenshot('02-团队合作-触发前', testInfo);

    await game.playCard('grimms_fairy_tales_teamwork');
    await game.waitForInteraction('grimms_fairy_tales_teamwork', 10000);
    await game.screenshot('03-团队合作-选择场上随从', testInfo);
    await game.selectInteractionOptionBy(
      option => optionHasMinionUid(option, 'hansel'),
      '团队合作选择汉瑟作为能力文字来源',
    );

    await game.waitForInteraction('grimms_fairy_tales_teamwork_card', 10000);
    await game.screenshot('04-团队合作-选择匹配随从处理方式', testInfo);
    await game.selectInteractionOptionBy(
      option => optionHasTeamworkPlay(option, 'deck-gretel', 1),
      '团队合作把格雷特额外打到林中小屋',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        base0Minions: state.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid) ?? [],
        base1Minions: state.core.bases[1]?.minions?.map((minion: { uid?: string }) => minion.uid) ?? [],
        deckUids: state.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        discardUids: state.core.players['0']?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      base0Minions: ['hansel'],
      base1Minions: ['deck-gretel'],
      deckUids: [],
      discardUids: ['teamwork'],
      interactionOpen: false,
    });
    await assertCardVisualReady(page, 'deck-gretel');
    await game.screenshot('05-团队合作-格雷特额外打出结算后', testInfo);
  });

  test('一篮子好东西从真实打牌入口将行动放到牌库顶', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'grimms_fairy_tales,aliens',
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
          { uid: 'basket', defId: 'grimms_fairy_tales_basket_of_goodies', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'deck-minion', defId: 'grimms_fairy_tales_hansel', type: 'minion', owner: '0' },
          { uid: 'deck-action', defId: 'grimms_fairy_tales_another_story', type: 'action', owner: '0' },
        ],
        discard: [],
        factions: ['grimms_fairy_tales', 'aliens'],
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
        { defId: 'base_gingerbread_house', minions: [] },
        { defId: 'base_woodland_cottage', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await assertCardVisualReady(page, 'basket');
    await game.screenshot('06-一篮子好东西-触发前', testInfo);

    await game.playCard('grimms_fairy_tales_basket_of_goodies');
    await game.waitForInteraction('grimms_fairy_tales_basket_of_goodies', 10000);
    await game.screenshot('07-一篮子好东西-选择行动', testInfo);
    await game.selectInteractionOptionBy(
      option => optionHasCardUid(option, 'deck-action'),
      '一篮子好东西把行动放到牌库顶',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        deckUids: state.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        discardUids: state.core.players['0']?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      deckUids: ['deck-action', 'deck-minion'],
      discardUids: ['basket'],
      interactionOpen: false,
    });
    await game.screenshot('08-一篮子好东西-行动置顶结算后', testInfo);
  });

  test('仙女教母与侏儒怪从真实入口分别搜索并设置牌库顶', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'grimms_fairy_tales,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260922,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'fairy-blessing', defId: 'grimms_fairy_tales_fairy_godmothers_blessing', type: 'action', owner: '0' },
          { uid: 'rumpel-card', defId: 'grimms_fairy_tales_rumpelstiltskin', type: 'minion', owner: '0' },
        ],
        deck: [
          { uid: 'deck-minion', defId: 'grimms_fairy_tales_gretel', type: 'minion', owner: '0' },
          { uid: 'deck-action', defId: 'grimms_fairy_tales_another_story', type: 'action', owner: '0' },
          { uid: 'deck-other-minion', defId: 'grimms_fairy_tales_hansel', type: 'minion', owner: '0' },
        ],
        discard: [],
        factions: ['grimms_fairy_tales', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 2,
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
        { defId: 'base_gingerbread_house', minions: [] },
        { defId: 'base_woodland_cottage', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await game.playCard('grimms_fairy_tales_fairy_godmothers_blessing');
    await game.waitForInteraction('grimms_fairy_tales_fairy_godmothers_blessing', 10000);
    await game.selectInteractionOptionBy(
      option => optionHasCardUid(option, 'deck-minion'),
      '仙女教母选择牌库中的随从放到牌库顶',
    );
    await game.waitForNoInteraction(10000);

    await game.playCard('grimms_fairy_tales_rumpelstiltskin', { targetBaseIndex: 0 });
    await game.waitForInteraction('grimms_fairy_tales_rumpelstiltskin', 10000);
    await game.selectInteractionOptionBy(
      option => optionHasCardUid(option, 'deck-action'),
      '侏儒怪选择牌库中的任意牌放到牌库顶',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        base0Minions: state.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid) ?? [],
        deckUids: state.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        discardUids: state.core.players['0']?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      base0Minions: ['rumpel-card'],
      deckUids: ['deck-action', 'deck-minion', 'deck-other-minion'],
      discardUids: ['fairy-blessing'],
      interactionOpen: false,
    });
    await game.screenshot('09-仙女教母与侏儒怪-牌库顶收口', testInfo);
  });

  test('另一个故事、面包屑与老鼠鸟和香肠从真实入口完成洗回、移动和加力', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'grimms_fairy_tales,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260922,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'another-story', defId: 'grimms_fairy_tales_another_story', type: 'action', owner: '0' },
          { uid: 'breadcrumbs', defId: 'grimms_fairy_tales_breadcrumbs', type: 'action', owner: '0' },
          { uid: 'mouse-bird', defId: 'grimms_fairy_tales_mouse_bird_and_sausage', type: 'action', owner: '0' },
        ],
        deck: [],
        discard: [
          { uid: 'discard-action', defId: 'grimms_fairy_tales_basket_of_goodies', type: 'action', owner: '0' },
          { uid: 'discard-hansel', defId: 'grimms_fairy_tales_hansel', type: 'minion', owner: '0' },
          { uid: 'discard-gretel', defId: 'grimms_fairy_tales_gretel', type: 'minion', owner: '0' },
        ],
        factions: ['grimms_fairy_tales', 'aliens'],
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
          defId: 'base_gingerbread_house',
          minions: [
            { uid: 'hansel', defId: 'grimms_fairy_tales_hansel', owner: '0', controller: '0', power: 2 },
            { uid: 'gretel', defId: 'grimms_fairy_tales_gretel', owner: '0', controller: '0', power: 2 },
          ],
        },
        { defId: 'base_woodland_cottage', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await game.playCard('grimms_fairy_tales_another_story');
    await game.waitForInteraction('grimms_fairy_tales_another_story', 10000);
    for (const uid of ['discard-action', 'discard-hansel', 'discard-gretel']) {
      await clickDiscardCard(page, uid);
    }
    await page.locator('[data-discard-view-panel]').getByRole('button', { name: /^确认$/ }).click({ force: true });
    await page.waitForTimeout(300);
    await game.waitForNoInteraction(10000);

    await game.playCard('grimms_fairy_tales_breadcrumbs');
    await game.waitForInteraction('grimms_fairy_tales_breadcrumbs', 10000);
    for (const uid of ['hansel', 'gretel']) {
      await clickBoardMinion(page, uid);
    }
    await game.confirm();
    await game.waitForInteraction('grimms_fairy_tales_breadcrumbs_destination', 10000);
    await game.selectInteractionOptionBy(
      option => option.value?.baseIndex === 1,
      '面包屑把两个随从移动到林中小屋',
    );
    await game.waitForNoInteraction(10000);

    await game.playCard('grimms_fairy_tales_mouse_bird_and_sausage');
    await game.waitForInteraction('grimms_fairy_tales_mouse_bird_and_sausage', 10000);
    for (const uid of ['hansel', 'gretel']) {
      await clickBoardMinion(page, uid);
    }
    await game.confirm();
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        base0Minions: state.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid) ?? [],
        base1Minions: state.core.bases[1]?.minions?.map((minion: { uid?: string }) => ({
          uid: minion.uid,
          tempPowerModifier: minion.tempPowerModifier ?? 0,
        })) ?? [],
        deckUids: state.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid).sort() ?? [],
        discardUids: state.core.players['0']?.discard?.map((card: { uid?: string }) => card.uid).sort() ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 15000 }).toEqual({
      base0Minions: [],
      base1Minions: [
        { uid: 'hansel', tempPowerModifier: 2 },
        { uid: 'gretel', tempPowerModifier: 2 },
      ],
      deckUids: ['discard-action', 'discard-gretel', 'discard-hansel'],
      discardUids: ['another-story', 'breadcrumbs', 'mouse-bird'],
      interactionOpen: false,
    });
    await game.screenshot('10-另一个故事面包屑老鼠鸟和香肠-长链收口', testInfo);
  });

  test('樵夫的斧子从真实入口销毁大灰狼并额外打出牌库随从', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'grimms_fairy_tales,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260922,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'axe', defId: 'grimms_fairy_tales_the_woodsmans_axe', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'deck-hansel', defId: 'grimms_fairy_tales_hansel', type: 'minion', owner: '0' },
        ],
        discard: [],
        factions: ['grimms_fairy_tales', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
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
          defId: 'base_gingerbread_house',
          minions: [
            { uid: 'wolf', defId: 'grimms_fairy_tales_big_bad_wolf', owner: '1', controller: '1', power: 6 },
          ],
        },
        { defId: 'base_woodland_cottage', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await game.playCard('grimms_fairy_tales_the_woodsmans_axe');
    await game.waitForInteraction('grimms_fairy_tales_the_woodsmans_axe', 10000);
    await game.selectInteractionOptionBy(
      option => option.value?.minionUid === 'wolf',
      '樵夫的斧子选择大灰狼',
    );
    await game.waitForInteraction('grimms_fairy_tales_the_woodsmans_axe_deck', 10000);
    await game.selectInteractionOptionBy(
      option => optionHasCardUid(option, 'deck-hansel'),
      '樵夫的斧子选择牌库中的汉瑟额外打出',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        base0Minions: state.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid) ?? [],
        deckUids: state.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        discardUids: state.core.players['0']?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 15000 }).toEqual({
      base0Minions: ['deck-hansel'],
      deckUids: [],
      discardUids: ['axe'],
      interactionOpen: false,
    });
    await game.screenshot('11-樵夫的斧子-大灰狼销毁与额外出牌收口', testInfo);
  });

  test('樵夫的斧子从真实入口销毁基地行动并获得额外行动', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'grimms_fairy_tales,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260922,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'axe', defId: 'grimms_fairy_tales_the_woodsmans_axe', type: 'action', owner: '0' },
        ],
        deck: [],
        discard: [],
        factions: ['grimms_fairy_tales', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
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
          defId: 'base_gingerbread_house',
          minions: [],
          ongoingActions: [
            { uid: 'base-action', defId: 'grimms_fairy_tales_grimms_blessing', ownerId: '1' },
          ],
        },
        { defId: 'base_woodland_cottage', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await game.playCard('grimms_fairy_tales_the_woodsmans_axe');
    await game.waitForInteraction('grimms_fairy_tales_the_woodsmans_axe', 10000);
    await game.selectInteractionOptionBy(
      option => option.value?.actionUid === 'base-action',
      '樵夫的斧子选择基地行动',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        ongoingUids: state.core.bases[0]?.ongoingActions?.map((action: { uid?: string }) => action.uid) ?? [],
        actionLimit: state.core.players['0']?.actionLimit ?? 0,
        discardUids: state.core.players['0']?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      ongoingUids: [],
      actionLimit: 2,
      discardUids: ['axe'],
      interactionOpen: false,
    });
    await game.screenshot('12-樵夫的斧子-基地行动销毁与额外行动收口', testInfo);
  });

  test('青蛙王子从真实打出随从入口触发反应并额外打出弃牌堆随从', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'grimms_fairy_tales,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260922,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'frog', defId: 'grimms_fairy_tales_the_frog_prince', type: 'minion', owner: '0' },
          { uid: 'played-hansel', defId: 'grimms_fairy_tales_hansel', type: 'minion', owner: '0' },
        ],
        deck: [
          { uid: 'deck-card', defId: 'grimms_fairy_tales_basket_of_goodies', type: 'action', owner: '0' },
        ],
        discard: [
          { uid: 'discard-gretel', defId: 'grimms_fairy_tales_gretel', type: 'minion', owner: '0' },
        ],
        factions: ['grimms_fairy_tales', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 2,
        actionsPlayed: 0,
        actionLimit: 1,
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
        { defId: 'base_gingerbread_house', minions: [] },
        { defId: 'base_woodland_cottage', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await game.playCard('grimms_fairy_tales_the_frog_prince', { targetBaseIndex: 0 });
    await game.waitForNoInteraction(10000);

    await game.playCard('grimms_fairy_tales_hansel', { targetBaseIndex: 0 });
    await game.waitForInteraction('smashup_reaction_choose', 15000);
    const reactionState = await game.getState();
    const frogTrigger = (reactionState.core.triggerQueue ?? []).find(
      (trigger: { sourceDefId?: string }) => trigger.sourceDefId === 'grimms_fairy_tales_the_frog_prince',
    );
    expect(frogTrigger, '青蛙王子必须保留真实反应触发项').toBeTruthy();
    await game.selectInteractionOptionBy(
      option => option.value?.triggerId === frogTrigger?.id,
      '选择青蛙王子反应',
    );
    await game.waitForInteraction('grimms_fairy_tales_the_frog_prince', 10000);
    await game.selectInteractionOptionBy(
      option => optionHasCardUid(option, 'discard-gretel'),
      '青蛙王子从弃牌堆选择格雷特额外打出',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        base0Minions: state.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid).sort() ?? [],
        deckUids: state.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid).sort() ?? [],
        discardUids: state.core.players['0']?.discard?.map((card: { uid?: string }) => card.uid).sort() ?? [],
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 15000 }).toEqual({
      base0Minions: ['discard-gretel', 'played-hansel'],
      deckUids: ['deck-card', 'frog'],
      discardUids: [],
      triggerQueueLength: 0,
      interactionOpen: false,
    });
    await game.screenshot('13-青蛙王子-反应与弃牌堆额外出牌收口', testInfo);
  });

  test('姜饼屋从真实计分入口选择两个同力量己方随从并影响计分', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'grimms_fairy_tales,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260922,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [],
        deck: [],
        discard: [],
        factions: ['grimms_fairy_tales', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 0,
        actionsPlayed: 0,
        actionLimit: 0,
        vp: 0,
      },
      player1: {
        hand: [],
        deck: [],
        discard: [],
        factions: ['pirates', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 0,
        actionsPlayed: 0,
        actionLimit: 0,
        vp: 0,
      },
      bases: [
        {
          defId: 'base_gingerbread_house',
          minions: [
            { uid: 'hansel', defId: 'grimms_fairy_tales_hansel', owner: '0', controller: '0', power: 2 },
            { uid: 'rose-red', defId: 'grimms_fairy_tales_rose_red', owner: '0', controller: '0', power: 2 },
            { uid: 'rumpel', defId: 'grimms_fairy_tales_rumpelstiltskin', owner: '0', controller: '0', power: 3 },
            { uid: 'frog', defId: 'grimms_fairy_tales_the_frog_prince', owner: '0', controller: '0', power: 3 },
            { uid: 'wolf', defId: 'grimms_fairy_tales_big_bad_wolf', owner: '0', controller: '0', power: 6 },
            { uid: 'enemy-1', defId: 'pirate_first_mate', owner: '1', controller: '1', power: 2 },
            { uid: 'enemy-2', defId: 'pirate_first_mate', owner: '1', controller: '1', power: 2 },
            { uid: 'enemy-3', defId: 'pirate_first_mate', owner: '1', controller: '1', power: 2 },
            { uid: 'enemy-4', defId: 'pirate_first_mate', owner: '1', controller: '1', power: 2 },
            { uid: 'enemy-5', defId: 'pirate_first_mate', owner: '1', controller: '1', power: 2 },
          ],
        },
        { defId: 'base_woodland_cottage', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await game.advancePhase();
    await game.waitForInteraction('smashup_reaction_choose', 15000);
    const reactionState = await game.getState();
    const gingerbreadTrigger = (reactionState.core.triggerQueue ?? []).find(
      (trigger: { sourceDefId?: string }) => trigger.sourceDefId === 'base_gingerbread_house',
    );
    expect(gingerbreadTrigger, '姜饼屋必须保留计分前响应触发项').toBeTruthy();
    await game.selectInteractionOptionBy(
      option => option.value?.triggerId === gingerbreadTrigger?.id,
      '选择姜饼屋计分前能力',
    );
    await game.waitForInteraction('base_gingerbread_house', 10000);

    const options = await game.getInteractionOptions();
    const targetUids = options
      .map(option => option.value?.minionUid)
      .filter((uid): uid is string => typeof uid === 'string');
    expect(targetUids).toEqual(expect.arrayContaining(['hansel', 'rose-red']));
    for (const uid of ['enemy-1', 'enemy-2', 'enemy-3', 'enemy-4', 'enemy-5', 'wolf']) {
      expect(targetUids).not.toContain(uid);
    }

    await clickBoardMinion(page, 'hansel');
    await clickBoardMinion(page, 'rose-red');
    await game.confirm();
    await game.waitForNoInteraction(15000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        p0Vp: state.core.players['0']?.vp ?? 0,
        p1Vp: state.core.players['1']?.vp ?? 0,
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 15000 }).toEqual({
      p0Vp: 4,
      p1Vp: 2,
      triggerQueueLength: 0,
      interactionOpen: false,
    });
    await game.screenshot('14-姜饼屋-计分前同力量选择与计分收口', testInfo);
  });

  test('林中小屋从真实打出随从入口检索力量 3 以下随从并限制本回合重复触发', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'grimms_fairy_tales,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260922,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'played-hansel', defId: 'grimms_fairy_tales_hansel', type: 'minion', owner: '0' },
        ],
        deck: [
          { uid: 'deck-small', defId: 'grimms_fairy_tales_gretel', type: 'minion', owner: '0' },
          { uid: 'deck-large', defId: 'grimms_fairy_tales_big_bad_wolf', type: 'minion', owner: '0' },
        ],
        discard: [],
        factions: ['grimms_fairy_tales', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
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
        { defId: 'base_woodland_cottage', minions: [] },
        { defId: 'base_gingerbread_house', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await game.playCard('grimms_fairy_tales_hansel', { targetBaseIndex: 0 });
    await game.waitForInteraction('smashup_reaction_choose', 15000);
    const reactionState = await game.getState();
    const cottageTrigger = (reactionState.core.triggerQueue ?? []).find(
      (trigger: { sourceDefId?: string }) => trigger.sourceDefId === 'base_woodland_cottage',
    );
    expect(cottageTrigger, '林中小屋必须保留打出随从后的响应触发项').toBeTruthy();
    await game.selectInteractionOptionBy(
      option => option.value?.triggerId === cottageTrigger?.id,
      '选择林中小屋检索能力',
    );
    await game.waitForInteraction('base_woodland_cottage', 10000);

    const options = await game.getInteractionOptions();
    expect(options.some(option => option.value?.cardUid === 'deck-small')).toBe(true);
    expect(options.some(option => option.value?.cardUid === 'deck-large')).toBe(false);
    await game.selectInteractionOptionBy(
      option => option.value?.cardUid === 'deck-small',
      '林中小屋检索力量 3 以下的格雷特',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        base0Minions: state.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid) ?? [],
        handUids: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        deckUids: state.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        discardUids: state.core.players['0']?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        usedTurn: state.core.bases[0]?.metadata?.woodlandCottageUsedTurn_0 ?? null,
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      base0Minions: ['played-hansel'],
      handUids: ['deck-small'],
      deckUids: ['deck-large'],
      discardUids: [],
      usedTurn: 1,
      interactionOpen: false,
    });
    await game.screenshot('15-林中小屋-力量过滤与本回合一次收口', testInfo);
  });

  test('白马王子与迷人的公主从真实随从入口分别获得额外行动和额外随从额度', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'grimms_fairy_tales,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260922,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'prince', defId: 'grimms_fairy_tales_prince_charming', type: 'minion', owner: '0' },
          { uid: 'princess', defId: 'grimms_fairy_tales_charming_princess', type: 'minion', owner: '0' },
          { uid: 'extra-hansel', defId: 'grimms_fairy_tales_hansel', type: 'minion', owner: '0' },
        ],
        deck: [],
        discard: [],
        factions: ['grimms_fairy_tales', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 2,
        actionsPlayed: 0,
        actionLimit: 1,
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
        { defId: 'base_gingerbread_house', minions: [] },
        { defId: 'base_woodland_cottage', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await game.playCard('grimms_fairy_tales_prince_charming', { targetBaseIndex: 0 });
    await game.waitForNoInteraction(10000);
    await game.playCard('grimms_fairy_tales_charming_princess', { targetBaseIndex: 0 });
    await game.waitForNoInteraction(10000);

    await clickVisibleMinionEdge(page, 'prince');
    await expect.poll(async () => {
      const state = await game.getState();
      const prince = state.core.bases[0]?.minions?.find((minion: { uid?: string }) => minion.uid === 'prince');
      return {
        talentUsed: prince?.talentUsed ?? false,
        actionLimit: state.core.players['0']?.actionLimit ?? 0,
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      talentUsed: true,
      actionLimit: 2,
      interactionOpen: false,
    });

    await clickVisibleMinionBottomEdge(page, 'princess');
    await expect.poll(async () => {
      const state = await game.getState();
      const princess = state.core.bases[0]?.minions?.find((minion: { uid?: string }) => minion.uid === 'princess');
      return {
        princeTalentUsed: state.core.bases[0]?.minions?.find((minion: { uid?: string }) => minion.uid === 'prince')?.talentUsed ?? false,
        princessTalentUsed: princess?.talentUsed ?? false,
        minionLimit: state.core.players['0']?.minionLimit ?? 0,
        baseLimitedMinionQuota: state.core.players['0']?.baseLimitedMinionQuota ?? {},
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      princeTalentUsed: true,
      princessTalentUsed: true,
      minionLimit: 2,
      baseLimitedMinionQuota: { 0: 1 },
      interactionOpen: false,
    });

    await page.locator('[data-card-uid="extra-hansel"]').click();
    await expect.poll(async () => ({
      base0Selectable: await page.locator('[data-base-index="0"]').getAttribute('data-selectable'),
      base0Dimmed: await page.locator('[data-base-index="0"]').getAttribute('data-dimmed'),
      base1Selectable: await page.locator('[data-base-index="1"]').getAttribute('data-selectable'),
      base1Dimmed: await page.locator('[data-base-index="1"]').getAttribute('data-dimmed'),
    }), { timeout: 10000 }).toEqual({
      base0Selectable: 'true',
      base0Dimmed: 'false',
      base1Selectable: 'false',
      base1Dimmed: 'true',
    });
    await game.screenshot('16-白马王子迷人公主-额外随从只高亮所在基地', testInfo);

    await game.selectBase(0);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        base0Minions: state.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid) ?? [],
        base1Minions: state.core.bases[1]?.minions?.map((minion: { uid?: string }) => minion.uid) ?? [],
        handUids: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        baseLimitedMinionQuota: state.core.players['0']?.baseLimitedMinionQuota ?? {},
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      base0Minions: ['prince', 'princess', 'extra-hansel'],
      base1Minions: [],
      handUids: [],
      baseLimitedMinionQuota: { 0: 0 },
      interactionOpen: false,
    });
    await game.screenshot('17-白马王子迷人公主-额外随从落到限定基地后收口', testInfo);
  });

  test('大灰狼从真实打出入口只暴露力量 4 或以下目标并完成销毁', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'grimms_fairy_tales,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260922,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'wolf', defId: 'grimms_fairy_tales_big_bad_wolf', type: 'minion', owner: '0' },
        ],
        deck: [],
        discard: [],
        factions: ['grimms_fairy_tales', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
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
          defId: 'base_gingerbread_house',
          minions: [
            { uid: 'small-target', defId: 'pirate_first_mate', owner: '1', controller: '1', power: 2 },
            { uid: 'large-target', defId: 'pirate_king', owner: '1', controller: '1', power: 5 },
          ],
        },
        { defId: 'base_woodland_cottage', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await game.playCard('grimms_fairy_tales_big_bad_wolf', { targetBaseIndex: 0 });
    await game.waitForInteraction('grimms_fairy_tales_big_bad_wolf', 10000);

    const options = await game.getInteractionOptions();
    const targetUids = options
      .map(option => option.value?.minionUid)
      .filter((uid): uid is string => typeof uid === 'string');
    expect(targetUids).toContain('small-target');
    expect(targetUids).not.toContain('large-target');
    expect(targetUids).not.toContain('wolf');

    await game.selectInteractionOptionBy(
      option => option.value?.minionUid === 'small-target',
      '大灰狼选择力量 4 或以下的随从',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        base0Minions: state.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid) ?? [],
        player1Discard: state.core.players['1']?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      base0Minions: ['large-target', 'wolf'],
      player1Discard: ['small-target'],
      interactionOpen: false,
    });
    await game.screenshot('18-大灰狼-力量阈值目标过滤与销毁收口', testInfo);
  });

  test('小红帽在场时大灰狼真实打出能力不产生交互', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'grimms_fairy_tales,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260922,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'wolf', defId: 'grimms_fairy_tales_big_bad_wolf', type: 'minion', owner: '0' },
        ],
        deck: [],
        discard: [],
        factions: ['grimms_fairy_tales', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
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
          defId: 'base_gingerbread_house',
          minions: [
            { uid: 'hood', defId: 'grimms_fairy_tales_red_riding_hood', owner: '1', controller: '1', power: 3 },
            { uid: 'target', defId: 'pirate_first_mate', owner: '1', controller: '1', power: 2 },
          ],
        },
        { defId: 'base_woodland_cottage', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await game.playCard('grimms_fairy_tales_big_bad_wolf', { targetBaseIndex: 0 });
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        base0Minions: state.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid) ?? [],
        discardUids: state.core.players['1']?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      base0Minions: ['hood', 'target', 'wolf'],
      discardUids: [],
      interactionOpen: false,
    });
    await game.screenshot('19-小红帽-大灰狼能力被抑制收口', testInfo);
  });

  test('格林兄弟的祝福从真实出牌入口落到基地并显示持续力量徽标', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'grimms_fairy_tales,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260922,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'blessing', defId: 'grimms_fairy_tales_grimms_blessing', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'owned-gretel', defId: 'grimms_fairy_tales_gretel', type: 'minion', owner: '0' },
        ],
        discard: [],
        factions: ['grimms_fairy_tales', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
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
          defId: 'base_gingerbread_house',
          minions: [
            { uid: 'hansel', defId: 'grimms_fairy_tales_hansel', owner: '0', controller: '0', power: 2 },
            { uid: 'ally', defId: 'pirate_first_mate', owner: '0', controller: '0', power: 2 },
          ],
        },
        { defId: 'base_woodland_cottage', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await game.playCard('grimms_fairy_tales_grimms_blessing', { targetBaseIndex: 0 });
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        ongoingUids: state.core.bases[0]?.ongoingActions?.map((action: { uid?: string }) => action.uid) ?? [],
        handUids: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        deckUids: state.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      ongoingUids: ['blessing'],
      handUids: [],
      deckUids: ['owned-gretel'],
      interactionOpen: false,
    });

    await expect(page.getByTestId('su-minion-power-badge-hansel')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('su-minion-power-badge-hansel')).toHaveText('+2');
    await expect(page.getByTestId('su-minion-power-badge-ally')).toHaveCount(0);
    await game.screenshot('20-格林兄弟的祝福-持续力量徽标与基地落地', testInfo);
  });

  test('汉瑟与格雷特从真实打出入口在同基地互相获得持续力量', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'grimms_fairy_tales,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260922,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'hansel', defId: 'grimms_fairy_tales_hansel', type: 'minion', owner: '0' },
          { uid: 'gretel', defId: 'grimms_fairy_tales_gretel', type: 'minion', owner: '0' },
        ],
        deck: [],
        discard: [],
        factions: ['grimms_fairy_tales', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 2,
        actionsPlayed: 0,
        actionLimit: 1,
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
        { defId: 'base_gingerbread_house', minions: [] },
        { defId: 'base_woodland_cottage', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await game.playCard('grimms_fairy_tales_hansel', { targetBaseIndex: 0 });
    await game.waitForNoInteraction(10000);
    await game.playCard('grimms_fairy_tales_gretel', { targetBaseIndex: 0 });
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        base0Minions: state.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid) ?? [],
        handUids: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      base0Minions: ['hansel', 'gretel'],
      handUids: [],
      interactionOpen: false,
    });
    await expect(page.getByTestId('su-minion-power-badge-hansel')).toHaveText('+2');
    await expect(page.getByTestId('su-minion-power-badge-gretel')).toHaveText('+2');
    await game.screenshot('21-汉瑟格雷特-同基地持续力量徽标', testInfo);
  });

  test('另一个白雪公主与红玫瑰从真实打出入口在同基地互相获得持续力量', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'grimms_fairy_tales,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260922,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'snow', defId: 'grimms_fairy_tales_the_other_snow_white', type: 'minion', owner: '0' },
          { uid: 'rose', defId: 'grimms_fairy_tales_rose_red', type: 'minion', owner: '0' },
        ],
        deck: [],
        discard: [],
        factions: ['grimms_fairy_tales', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 2,
        actionsPlayed: 0,
        actionLimit: 1,
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
        { defId: 'base_woodland_cottage', minions: [] },
        { defId: 'base_gingerbread_house', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await game.playCard('grimms_fairy_tales_the_other_snow_white', { targetBaseIndex: 0 });
    await game.waitForNoInteraction(10000);
    await game.playCard('grimms_fairy_tales_rose_red', { targetBaseIndex: 0 });
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        base0Minions: state.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid) ?? [],
        handUids: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      base0Minions: ['snow', 'rose'],
      handUids: [],
      interactionOpen: false,
    });
    await expect(page.getByTestId('su-minion-power-badge-snow')).toHaveText('+2');
    await expect(page.getByTestId('su-minion-power-badge-rose')).toHaveText('+2');
    await game.screenshot('22-另一个白雪公主红玫瑰-同基地持续力量徽标', testInfo);
  });

  test('小红帽从真实打出入口让同基地己方随从显示额外力量', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'grimms_fairy_tales,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260922,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'hood', defId: 'grimms_fairy_tales_red_riding_hood', type: 'minion', owner: '0' },
        ],
        deck: [],
        discard: [],
        factions: ['grimms_fairy_tales', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
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
          defId: 'base_gingerbread_house',
          minions: [
            { uid: 'ally', defId: 'pirate_first_mate', owner: '0', controller: '0', power: 2 },
          ],
        },
        { defId: 'base_woodland_cottage', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await game.playCard('grimms_fairy_tales_red_riding_hood', { targetBaseIndex: 0 });
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        base0Minions: state.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid) ?? [],
        handUids: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      base0Minions: ['ally', 'hood'],
      handUids: [],
      interactionOpen: false,
    });
    await expect(page.getByTestId('su-minion-power-badge-hood')).toHaveText('+1');
    await expect(page.getByTestId('su-minion-power-badge-ally')).toHaveText('+1');
    await game.screenshot('23-小红帽-同基地己方随从持续力量徽标', testInfo);
  });
});
