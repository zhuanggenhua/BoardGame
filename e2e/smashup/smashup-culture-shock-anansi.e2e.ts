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

async function selectReactionTriggerBySource(game: any, sourceDefId: string): Promise<void> {
  await game.waitForInteraction('smashup_reaction_choose', 15000);
  const options = await game.getInteractionOptions();
  const state = await game.getState();
  const triggerQueue = state.core?.triggerQueue ?? [];
  const option = options.find((candidate: InteractionOption) => {
    const triggerId = candidate.value && typeof candidate.value === 'object'
      ? (candidate.value as { triggerId?: unknown }).triggerId
      : undefined;
    return typeof triggerId === 'string'
      && triggerQueue.some((trigger: { id?: string; sourceDefId?: string }) => (
        trigger.id === triggerId && trigger.sourceDefId === sourceDefId
      ));
  });
  expect(option, `响应窗口应包含 ${sourceDefId} 的可选触发`).toBeTruthy();
  await game.selectOption(option.id);
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
    await spotlightQueue.getByRole('button', { name: /^(关闭特写|Close spotlight)$/i }).click({ force: true });
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

    const factionSearch = page.getByTestId('faction-search-input');
    await expect(factionSearch).toBeVisible({ timeout: 15000 });
    await factionSearch.fill('阿南西');

    const option = page.getByTestId('faction-option-anansi_tales');
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
          defId: 'base_the_jungle',
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

  test('羽毛礼物从真实入口完成己方随从移动、给牌与交互收口', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'anansi_tales,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260919,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'feather-card', defId: 'anansi_tales_feather_gifts', type: 'action', owner: '0' },
        ],
        deck: [],
        discard: [],
        factions: ['anansi_tales', 'aliens'],
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
          defId: 'base_the_jungle',
          minions: [
            { uid: 'own-minion', defId: 'anansi_tales_akye_the_turtle', owner: '0', controller: '0', power: 3 },
            { uid: 'enemy-minion', defId: 'pirate_first_mate', owner: '1', controller: '1', power: 2 },
          ],
        },
        { defId: 'base_storytellers_hut', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await assertCardVisualReady(page, 'feather-card');
    await assertCardVisualReady(page, 'own-minion');
    await game.playCard('anansi_tales_feather_gifts');
    await game.waitForInteraction('anansi_tales_feather_gifts', 10000);

    const sourceOptions = await game.getInteractionOptions();
    expect(sourceOptions.some(option => option.value?.minionUid === 'own-minion')).toBe(true);
    expect(sourceOptions.some(option => option.value?.minionUid === 'enemy-minion')).toBe(false);
    await game.screenshot('08-羽毛礼物-选择己方随从', testInfo);

    await game.selectInteractionOptionBy(
      option => option.value?.minionUid === 'own-minion' && option.value?.baseIndex === 0,
      '羽毛礼物选择己方随从',
    );
    await game.waitForInteraction('anansi_tales_feather_gifts_destination', 10000);
    const destinationOptions = await game.getInteractionOptions();
    expect(destinationOptions.some(option => option.value?.baseIndex === 0)).toBe(false);
    expect(destinationOptions.some(option => option.value?.baseIndex === 1)).toBe(true);
    await game.screenshot('09-羽毛礼物-选择另一基地', testInfo);

    await game.selectInteractionOptionBy(
      option => option.value?.baseIndex === 1,
      '羽毛礼物选择另一基地',
    );
    await game.waitForInteraction('anansi_tales_feather_gifts', 10000);
    await game.selectInteractionOptionBy(
      option => option.value?.targetPlayerId === '1',
      '羽毛礼物把行动牌给玩家 1',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        base0Minions: state.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid) ?? [],
        base1Minions: state.core.bases[1]?.minions?.map((minion: { uid?: string }) => minion.uid) ?? [],
        p0Discard: state.core.players['0']?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        p1Hand: state.core.players['1']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 15000 }).toEqual({
      base0Minions: ['enemy-minion'],
      base1Minions: ['own-minion'],
      p0Discard: [],
      p1Hand: ['feather-card'],
      interactionOpen: false,
    });
    await assertCardVisualReady(page, 'own-minion');
    await game.screenshot('10-羽毛礼物-移动给牌并收口', testInfo);
  });

  test('蜘蛛阿南西天赋从真实入口检索、额外打出并锁定同名行动', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'anansi_tales,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260921,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'same-name-copy', defId: 'anansi_tales_trading_stories', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'spider-search-action', defId: 'anansi_tales_trading_stories', type: 'action', owner: '0' },
          { uid: 'spider-deck-buffer', defId: 'anansi_tales_pot_of_beans', type: 'action', owner: '0' },
        ],
        discard: [],
        factions: ['anansi_tales', 'aliens'],
        minionsPlayed: 1,
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
        {
          defId: 'base_anansis_web',
          minions: [
            { uid: 'spider-minion', defId: 'anansi_tales_anansi_the_spider', owner: '0', controller: '0', power: 5, talentUsed: false },
          ],
        },
        { defId: 'base_storytellers_hut', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await expect(page.locator('[data-minion-uid="spider-minion"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-card-uid="same-name-copy"]')).toBeVisible({ timeout: 15000 });
    await game.screenshot('11-蜘蛛阿南西-天赋入口', testInfo);

    await page.locator('[data-minion-uid="spider-minion"]').click({ force: true });
    await game.waitForInteraction('anansi_tales_anansi_the_spider', 10000);
    await game.screenshot('12-蜘蛛阿南西-选择牌库行动', testInfo);
    await game.selectInteractionOptionBy(
      option => optionHasCardUid(option, 'spider-search-action'),
      '蜘蛛阿南西选择牌库里的交易故事',
    );

    await game.waitForInteraction('anansi_tales_trading_stories', 10000);
    await game.skip();
    await game.waitForInteraction('anansi_tales_anansi_the_spider_gift', 10000);
    await game.selectInteractionOptionBy(
      option => optionHasPlayerId(option, '1'),
      '蜘蛛阿南西把额外打出的行动给玩家 1',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      const spider = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'spider-minion');
      return {
        spiderTalentUsed: spider?.talentUsed ?? false,
        spiderBaseUids: state.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid) ?? [],
        p0HandUids: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        p0DiscardUids: state.core.players['0']?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        p1HandUids: state.core.players['1']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        blocked: state.core.blockedActionDefIdsThisTurn?.['0'] ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 15000 }).toEqual({
      spiderTalentUsed: true,
      spiderBaseUids: ['spider-minion'],
      p0HandUids: ['same-name-copy'],
      p0DiscardUids: [],
      p1HandUids: ['spider-search-action'],
      blocked: ['anansi_tales_trading_stories'],
      interactionOpen: false,
    });

    await page.locator('[data-card-uid="same-name-copy"]').click({ force: true });
    await expect.poll(async () => {
      const state = await game.getState();
      return state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid) ?? [];
    }, { timeout: 5000 }).toEqual(['same-name-copy']);
    await game.screenshot('13-蜘蛛阿南西-同名行动被锁定', testInfo);
  });

  test('一锅豆子与奥塞波豹从真实入口完成计数和转牌触发', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'anansi_tales,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260921,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'beans-card', defId: 'anansi_tales_pot_of_beans', type: 'action', owner: '0' }],
        deck: [],
        discard: [],
        factions: ['anansi_tales', 'aliens'],
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
          defId: 'base_the_jungle',
          minions: [
            { uid: 'osebo', defId: 'anansi_tales_osebo_the_leopard', owner: '0', controller: '0', power: 4 },
            { uid: 'bean-target', defId: 'anansi_tales_akye_the_turtle', owner: '0', controller: '0', power: 3 },
          ],
        },
        { defId: 'base_storytellers_hut', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await game.playCard('anansi_tales_pot_of_beans');
    await game.waitForInteraction('anansi_tales_pot_of_beans_counter_allocation', 10000);
    await game.selectInteractionOptionBy(
      option => option.value?.minionUid === 'bean-target',
      '一锅豆子给目标随从放置两个力量指示物',
    );
    await game.waitForInteraction('anansi_tales_pot_of_beans_gift_player', 10000);
    await game.selectInteractionOptionBy(
      option => optionHasPlayerId(option, '1'),
      '一锅豆子把自己给玩家 1',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      const minions = state.core.bases[0]?.minions ?? [];
      return {
        oseboCounters: minions.find((minion: { uid?: string }) => minion.uid === 'osebo')?.powerCounters ?? 0,
        targetCounters: minions.find((minion: { uid?: string }) => minion.uid === 'bean-target')?.powerCounters ?? 0,
        p0Discard: state.core.players['0']?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        p1Hand: state.core.players['1']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
      };
    }, { timeout: 15000 }).toEqual({
      oseboCounters: 1,
      targetCounters: 2,
      p0Discard: [],
      p1Hand: ['beans-card'],
    });
    await game.screenshot('14-一锅豆子-计数与奥塞波豹触发', testInfo);
  });

  test('阿克耶海龟与让它吃饱从真实入口完成抽牌和给牌', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'anansi_tales,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260921,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'akye-card', defId: 'anansi_tales_akye_the_turtle', type: 'minion', owner: '0' },
          { uid: 'gift-card', defId: 'anansi_tales_trading_stories', type: 'action', owner: '0' },
          { uid: 'eat-card', defId: 'anansi_tales_let_it_be_full_and_eat', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'draw-1', defId: 'anansi_tales_pot_of_beans', type: 'action', owner: '0' },
          { uid: 'draw-2', defId: 'anansi_tales_feather_gifts', type: 'action', owner: '0' },
          { uid: 'draw-3', defId: 'anansi_tales_pot_of_wisdom', type: 'action', owner: '0' },
          { uid: 'draw-4', defId: 'anansi_tales_ear_of_corn', type: 'action', owner: '0' },
        ],
        discard: [],
        factions: ['anansi_tales', 'aliens'],
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
        { defId: 'base_the_jungle', minions: [] },
        { defId: 'base_storytellers_hut', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await game.playCard('anansi_tales_akye_the_turtle', { targetBaseIndex: 0 });
    await game.waitForInteraction('anansi_tales_akye_the_turtle', 10000);
    await game.selectInteractionOptionBy(
      option => optionHasCardUid(option, 'gift-card') && optionHasPlayerId(option, '1'),
      '阿克耶海龟把手牌给玩家 1',
    );
    await game.waitForNoInteraction(10000);

    await game.playCard('anansi_tales_let_it_be_full_and_eat');
    await game.waitForInteraction('anansi_tales_let_it_be_full_and_eat', 10000);
    await game.selectInteractionOptionBy(
      option => optionHasPlayerId(option, '1'),
      '让它吃饱把自己给玩家 1',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        base0Minions: state.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid) ?? [],
        p0Hand: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid).sort() ?? [],
        p0Discard: state.core.players['0']?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        p1Hand: state.core.players['1']?.hand?.map((card: { uid?: string }) => card.uid).sort() ?? [],
      };
    }, { timeout: 15000 }).toEqual({
      base0Minions: ['akye-card'],
      p0Hand: ['draw-1', 'draw-2', 'draw-3', 'draw-4'],
      p0Discard: [],
      p1Hand: ['eat-card', 'gift-card'],
    });
    await game.screenshot('15-海龟与让它吃饱-抽牌给牌收口', testInfo);
  });

  test('交易故事从真实入口完成三张多选转移并按数量抽牌', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'anansi_tales,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260921,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'trading-card', defId: 'anansi_tales_trading_stories', type: 'action', owner: '0' },
          { uid: 'gift-1', defId: 'anansi_tales_pot_of_beans', type: 'action', owner: '0' },
          { uid: 'gift-2', defId: 'anansi_tales_feather_gifts', type: 'action', owner: '0' },
          { uid: 'gift-3', defId: 'anansi_tales_let_it_be_full_and_eat', type: 'action', owner: '0' },
          { uid: 'kept-card', defId: 'anansi_tales_ear_of_corn', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'draw-1', defId: 'anansi_tales_collecting_stories', type: 'action', owner: '0' },
          { uid: 'draw-2', defId: 'anansi_tales_pot_of_wisdom', type: 'action', owner: '0' },
          { uid: 'draw-3', defId: 'anansi_tales_the_perfect_gift', type: 'action', owner: '0' },
        ],
        discard: [],
        factions: ['anansi_tales', 'aliens'],
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
        { defId: 'base_anansis_web', minions: [] },
        { defId: 'base_storytellers_hut', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await game.playCard('anansi_tales_trading_stories');
    await game.waitForInteraction('anansi_tales_trading_stories', 10000);
    const options = await game.getInteractionOptions();
    for (const uid of ['gift-1', 'gift-2', 'gift-3']) {
      const option = options.find((candidate: InteractionOption) => optionHasCardUid(candidate, uid));
      expect(option, `交易故事应列出 ${uid}`).toBeTruthy();
      await page.locator(`[data-option-id="${option.id}"]`).click({ force: true });
    }
    await game.confirm();
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        p0Hand: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid).sort() ?? [],
        p0Discard: state.core.players['0']?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        p1Hand: state.core.players['1']?.hand?.map((card: { uid?: string }) => card.uid).sort() ?? [],
      };
    }, { timeout: 15000 }).toEqual({
      p0Hand: ['draw-1', 'draw-2', 'draw-3', 'kept-card'],
      p0Discard: ['trading-card'],
      p1Hand: ['gift-1', 'gift-2', 'gift-3'],
    });
    await game.screenshot('16-交易故事-三张多选转移并抽牌', testInfo);
  });

  test('智慧之锅从真实入口按其他玩家数量抽牌、给牌并获得额外行动', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'anansi_tales,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260921,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'wisdom-card', defId: 'anansi_tales_pot_of_wisdom', type: 'action', owner: '0' }],
        deck: [
          { uid: 'draw-1', defId: 'anansi_tales_pot_of_beans', type: 'action', owner: '0' },
          { uid: 'draw-2', defId: 'anansi_tales_feather_gifts', type: 'action', owner: '0' },
        ],
        discard: [],
        factions: ['anansi_tales', 'aliens'],
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
        { defId: 'base_anansis_web', minions: [] },
        { defId: 'base_storytellers_hut', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await game.playCard('anansi_tales_pot_of_wisdom');
    await game.waitForInteraction('anansi_tales_pot_of_wisdom', 10000);
    await game.selectInteractionOptionBy(
      option => optionHasCardUid(option, 'draw-1') && optionHasPlayerId(option, '1'),
      '智慧之锅把抽到的牌给玩家 1',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        p0Hand: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        p0Deck: state.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        p0Discard: state.core.players['0']?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        p1Hand: state.core.players['1']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        actionLimit: state.core.players['0']?.actionLimit ?? 0,
      };
    }, { timeout: 15000 }).toEqual({
      p0Hand: [],
      p0Deck: ['draw-2'],
      p0Discard: ['wisdom-card'],
      p1Hand: ['draw-1'],
      actionLimit: 2,
    });
    await game.screenshot('17-智慧之锅-抽牌给牌并获得额外行动', testInfo);
  });

  test('收集故事从真实入口检索其他玩家手中自己拥有的行动并额外打出', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'anansi_tales,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260921,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'collecting-card', defId: 'anansi_tales_collecting_stories', type: 'action', owner: '0' }],
        deck: [],
        discard: [],
        factions: ['anansi_tales', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player1: {
        hand: [
          { uid: 'borrowed-action', defId: 'anansi_tales_trading_stories', type: 'action', owner: '0' },
          { uid: 'keep-card', defId: 'anansi_tales_feather_gifts', type: 'action', owner: '1' },
        ],
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
        { defId: 'base_anansis_web', minions: [] },
        { defId: 'base_storytellers_hut', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await game.playCard('anansi_tales_collecting_stories');
    await game.waitForInteraction('anansi_tales_collecting_stories', 10000);
    await game.selectInteractionOptionBy(
      option => optionHasCardUid(option, 'borrowed-action') && option.value?.fromPlayerId === '1',
      '收集故事选择玩家 1 手中自己拥有的交易故事',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        p0Hand: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        p0Discard: state.core.players['0']?.discard?.map((card: { uid?: string }) => card.uid).sort() ?? [],
        p1Hand: state.core.players['1']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
      };
    }, { timeout: 15000 }).toEqual({
      p0Hand: [],
      p0Discard: ['borrowed-action', 'collecting-card'],
      p1Hand: ['keep-card'],
    });
    await game.screenshot('18-收集故事-从他人手中额外打出自己拥有的行动', testInfo);
  });

  test('玉米穗从真实入口洗回弃牌堆行动、获得额外行动并把自己给出', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'anansi_tales,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260921,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'corn-card', defId: 'anansi_tales_ear_of_corn', type: 'action', owner: '0' }],
        deck: [{ uid: 'deck-card', defId: 'anansi_tales_trading_stories', type: 'action', owner: '0' }],
        discard: [
          { uid: 'recycle-1', defId: 'anansi_tales_pot_of_beans', type: 'action', owner: '0' },
          { uid: 'recycle-2', defId: 'anansi_tales_pot_of_wisdom', type: 'action', owner: '0' },
          { uid: 'recycle-3', defId: 'anansi_tales_feather_gifts', type: 'action', owner: '0' },
          { uid: 'ignored-minion', defId: 'anansi_tales_akye_the_turtle', type: 'minion', owner: '0' },
        ],
        factions: ['anansi_tales', 'aliens'],
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
        { defId: 'base_anansis_web', minions: [] },
        { defId: 'base_storytellers_hut', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await game.playCard('anansi_tales_ear_of_corn');
    await game.waitForInteraction('anansi_tales_ear_of_corn', 10000);
    const options = await game.getInteractionOptions();
    for (const uid of ['recycle-1', 'recycle-2', 'recycle-3']) {
      const option = options.find((candidate: InteractionOption) => optionHasCardUid(candidate, uid));
      expect(option, `玉米穗应列出 ${uid}`).toBeTruthy();
      await page.locator(`[data-option-id="${option.id}"]`).click({ force: true });
    }
    await game.confirm();
    await game.waitForInteraction('anansi_tales_ear_of_corn', 10000);
    await game.selectInteractionOptionBy(
      option => optionHasPlayerId(option, '1'),
      '玉米穗把自己给玩家 1',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        p0Deck: state.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid).sort() ?? [],
        p0Discard: state.core.players['0']?.discard?.map((card: { uid?: string }) => card.uid).sort() ?? [],
        p1Hand: state.core.players['1']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        actionLimit: state.core.players['0']?.actionLimit ?? 0,
      };
    }, { timeout: 15000 }).toEqual({
      p0Deck: ['deck-card', 'recycle-1', 'recycle-2', 'recycle-3'].sort(),
      p0Discard: ['ignored-minion'],
      p1Hand: ['corn-card'],
      actionLimit: 2,
    });
    await game.screenshot('19-玉米穗-弃牌堆行动洗回并给牌', testInfo);
  });

  test('奥尼尼巨蟒与马布罗大黄蜂从真实入口响应对手使用借来的牌', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'anansi_tales,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260921,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '1',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'hornet-card', defId: 'anansi_tales_mboro_hornet', type: 'minion', owner: '0' }],
        deck: [],
        discard: [],
        factions: ['anansi_tales', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player1: {
        hand: [{ uid: 'borrowed-action', defId: 'anansi_tales_trading_stories', type: 'action', owner: '0' }],
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
          defId: 'base_anansis_web',
          minions: [
            { uid: 'onini', defId: 'anansi_tales_onini_the_python', owner: '0', controller: '0', power: 4 },
            { uid: 'onini-ally', defId: 'anansi_tales_akye_the_turtle', owner: '0', controller: '0', power: 3 },
          ],
        },
        { defId: 'base_storytellers_hut', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await game.playCard('anansi_tales_trading_stories');
    await selectReactionTriggerBySource(game, 'anansi_tales_onini_the_python');
    await game.waitForInteraction('anansi_tales_onini_the_python_counter', 10000);
    await game.selectInteractionOptionBy(
      option => option.value?.minionUid === 'onini-ally',
      '奥尼尼巨蟒给己方随从放置力量指示物',
    );
    await selectReactionTriggerBySource(game, 'anansi_tales_mboro_hornet');
    await game.waitForInteraction('anansi_tales_mboro_hornet', 10000);
    await game.selectInteractionOptionBy(
      option => option.value?.baseIndex === 1,
      '马布罗大黄蜂额外打到第二基地',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      const base0 = state.core.bases[0]?.minions ?? [];
      const base1 = state.core.bases[1]?.minions ?? [];
      return {
        oniniAllyCounters: base0.find((minion: { uid?: string }) => minion.uid === 'onini-ally')?.powerCounters ?? 0,
        base1Minions: base1.map((minion: { uid?: string }) => minion.uid),
        p0Hand: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 15000 }).toEqual({
      oniniAllyCounters: 1,
      base1Minions: ['hornet-card'],
      p0Hand: [],
      interactionOpen: false,
    });
    await game.screenshot('20-奥尼尼与大黄蜂-借牌反应收口', testInfo);
  });

  test('阿南西之网从真实入口在首次标准行动后抽牌并转移行动', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'anansi_tales,pirates',
      p1: 'ninjas,aliens',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260921,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [{ uid: 'broadside-card', defId: 'pirate_broadside', type: 'action', owner: '0' }],
        deck: [
          { uid: 'draw-1', defId: 'anansi_tales_pot_of_beans', type: 'action', owner: '0' },
          { uid: 'draw-2', defId: 'anansi_tales_feather_gifts', type: 'action', owner: '0' },
        ],
        discard: [],
        factions: ['anansi_tales', 'pirates'],
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
        factions: ['ninjas', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      bases: [
        {
          defId: 'base_anansis_web',
          minions: [
            { uid: 'web-ally', defId: 'anansi_tales_akye_the_turtle', owner: '0', controller: '0', power: 3 },
            { uid: 'web-enemy', defId: 'ninja_acolyte', owner: '1', controller: '1', power: 2 },
          ],
        },
        { defId: 'base_storytellers_hut', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await game.playCard('pirate_broadside');
    await game.waitForInteraction('pirate_broadside_choose_base', 10000);
    await game.selectInteractionOptionBy(
      option => option.value?.baseIndex === 0,
      '侧翼开炮选择阿南西之网',
    );
    await game.waitForInteraction('pirate_broadside_choose_player', 10000);
    await game.selectInteractionOptionBy(
      option => optionHasPlayerId(option, '1'),
      '侧翼开炮选择玩家 1',
    );
    await selectReactionTriggerBySource(game, 'base_anansis_web');
    await game.waitForInteraction('base_anansis_web', 10000);
    await game.selectInteractionOptionBy(
      option => optionHasPlayerId(option, '1'),
      '阿南西之网把标准行动给玩家 1',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        p0Hand: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid).sort() ?? [],
        p0Discard: state.core.players['0']?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        p1Hand: state.core.players['1']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        usedTurn: state.core.bases[0]?.metadata?.anansisWebUsedTurn ?? null,
      };
    }, { timeout: 15000 }).toEqual({
      p0Hand: ['draw-1', 'draw-2'],
      p0Discard: [],
      p1Hand: ['broadside-card'],
      usedTurn: 1,
    });
    await game.screenshot('21-阿南西之网-首次标准行动后转移与抽牌', testInfo);
  });

  test('奥塞波豹从真实打出入口在转牌后获得力量指示物', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'anansi_tales,aliens',
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
          { uid: 'osebo-card', defId: 'anansi_tales_osebo_the_leopard', type: 'minion', owner: '0' },
          { uid: 'beans-card', defId: 'anansi_tales_pot_of_beans', type: 'action', owner: '0' },
        ],
        deck: [],
        discard: [],
        factions: ['anansi_tales', 'aliens'],
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
        {
          defId: 'base_the_jungle',
          minions: [
            { uid: 'ally', defId: 'anansi_tales_akye_the_turtle', owner: '0', controller: '0', power: 3 },
          ],
        },
        { defId: 'base_storytellers_hut', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await game.playCard('anansi_tales_osebo_the_leopard', { targetBaseIndex: 0 });
    await game.waitForNoInteraction(10000);
    await game.playCard('anansi_tales_pot_of_beans');
    await game.waitForInteraction('anansi_tales_pot_of_beans_counter_allocation', 10000);
    await game.selectInteractionOptionBy(
      option => option.value?.minionUid === 'ally',
      '一锅豆子选择己方目标放置两个力量指示物',
    );
    await game.waitForInteraction('anansi_tales_pot_of_beans_gift_player', 10000);
    await game.selectInteractionOptionBy(
      option => optionHasPlayerId(option, '1'),
      '一锅豆子把自己给玩家 1',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      const minions = state.core.bases[0]?.minions ?? [];
      return {
        base0Minions: minions.map((minion: { uid?: string }) => minion.uid),
        oseboCounters: minions.find((minion: { uid?: string }) => minion.uid === 'osebo-card')?.powerCounters ?? 0,
        allyCounters: minions.find((minion: { uid?: string }) => minion.uid === 'ally')?.powerCounters ?? 0,
        p1Hand: state.core.players['1']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 15000 }).toEqual({
      base0Minions: ['ally', 'osebo-card'],
      oseboCounters: 1,
      allyCounters: 2,
      p1Hand: ['beans-card'],
      interactionOpen: false,
    });
    await game.screenshot('22-奥塞波豹-真实入场与转牌加力收口', testInfo);
  });

  test('奥尼尼巨蟒真实打出并由手牌中的马布罗大黄蜂响应借来的牌', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'anansi_tales,aliens',
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
          { uid: 'onini-card', defId: 'anansi_tales_onini_the_python', type: 'minion', owner: '0' },
          { uid: 'mboro-card', defId: 'anansi_tales_mboro_hornet', type: 'minion', owner: '0' },
        ],
        deck: [],
        discard: [],
        factions: ['anansi_tales', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player1: {
        hand: [
          { uid: 'borrowed-action', defId: 'anansi_tales_trading_stories', type: 'action', owner: '0' },
        ],
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
        { defId: 'base_the_jungle', minions: [] },
        { defId: 'base_storytellers_hut', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await game.playCard('anansi_tales_onini_the_python', { targetBaseIndex: 0 });
    await game.waitForNoInteraction(10000);
    await game.advancePhase();
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        currentPlayerIndex: state.core.currentPlayerIndex,
        phase: state.sys?.phase,
      };
    }, { timeout: 10000 }).toEqual({ currentPlayerIndex: 1, phase: 'playCards' });
    await game.playCard('anansi_tales_trading_stories');

    await selectReactionTriggerBySource(game, 'anansi_tales_onini_the_python');
    await game.waitForInteraction('anansi_tales_onini_the_python_counter', 10000);
    await game.selectInteractionOptionBy(
      option => option.value?.minionUid === 'onini-card',
      '奥尼尼巨蟒给自己放置力量指示物',
    );
    await selectReactionTriggerBySource(game, 'anansi_tales_mboro_hornet');
    await game.waitForInteraction('anansi_tales_mboro_hornet', 10000);
    await game.selectInteractionOptionBy(
      option => option.value?.baseIndex === 1,
      '马布罗大黄蜂额外打到第二基地',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      const base0 = state.core.bases[0]?.minions ?? [];
      const base1 = state.core.bases[1]?.minions ?? [];
      return {
        base0Minions: base0.map((minion: { uid?: string }) => minion.uid),
        base1Minions: base1.map((minion: { uid?: string }) => minion.uid),
        oniniCounters: base0.find((minion: { uid?: string }) => minion.uid === 'onini-card')?.powerCounters ?? 0,
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 15000 }).toEqual({
      base0Minions: ['onini-card'],
      base1Minions: ['mboro-card'],
      oniniCounters: 1,
      interactionOpen: false,
    });
    await game.screenshot('23-奥尼尼大黄蜂-真实入场与借牌反应收口', testInfo);
  });
});
