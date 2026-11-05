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

function optionHasBaseIndex(option: InteractionOption, baseIndex: number): boolean {
  const value = option.value;
  return !!value && typeof value === 'object' && (value as { baseIndex?: unknown }).baseIndex === baseIndex;
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

async function dismissRevealIfPresent(page: Page): Promise<void> {
  const reveal = page.getByTestId('reveal-overlay');
  if (!(await reveal.isVisible({ timeout: 300 }).catch(() => false))) return;
  await reveal.getByTestId('reveal-dismiss-btn').click({ force: true });
  await expect(reveal).toBeHidden({ timeout: 5000 });
}

async function clickDiscardCard(page: Page, cardUid: string): Promise<void> {
  const card = page.locator(`[data-discard-view-panel] [data-card-uid="${cardUid}"]`).first();
  await expect(card).toBeVisible({ timeout: 10000 });
  await card.click({ force: true });
  await page.waitForTimeout(300);
}

async function dismissCardMagnifyIfPresent(page: Page): Promise<void> {
  const overlay = page.getByTestId('su-card-magnify-overlay');
  if (!(await overlay.isVisible({ timeout: 300 }).catch(() => false))) return;
  await overlay.getByRole('button', { name: 'X' }).click({ force: true });
  await expect(overlay).toBeHidden({ timeout: 5000 });
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

    const factionSearch = page.getByTestId('faction-search-input');
    await expect(factionSearch).toBeVisible({ timeout: 15000 });
    await factionSearch.fill('俄罗斯');

    const option = page.getByTestId('faction-option-russian_fairy_tales');
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
          defId: 'base_giant_turnip',
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
        deckUids: [...(state.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid) ?? [])].sort(),
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

  test('变形之泉从真实打出入口只触发一次并把牌库顶随从作为额外随从打出', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'russian_fairy_tales,ninjas',
      p1: 'pirates,dinosaurs',
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
          { uid: 'spring-played-minion', defId: 'pirate_first_mate', type: 'minion', owner: '0' },
        ],
        deck: [
          { uid: 'spring-deck-action', defId: 'ninja_assassination', type: 'action', owner: '0' },
          { uid: 'spring-deck-minion', defId: 'russian_fairy_tales_the_birch', type: 'minion', owner: '0' },
        ],
        discard: [],
        factions: ['russian_fairy_tales', 'ninjas'],
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
        factions: ['pirates', 'dinosaurs'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      bases: [
        { defId: 'base_transformation_spring', minions: [] },
        { defId: 'base_giant_turnip', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await assertCardVisualReady(page, 'spring-played-minion');
    await game.screenshot('05-变形之泉-打出随从前', testInfo);

    await game.playCard('pirate_first_mate', { targetBaseIndex: 0 });
    await game.waitForInteraction('smashup_reaction_choose', 15000);
    const reactionState = await game.getState();
    const springTrigger = (reactionState.core.triggerQueue ?? []).find((trigger: { sourceDefId?: string; triggerMinionUid?: string }) => (
      trigger.sourceDefId === 'base_transformation_spring'
        && trigger.triggerMinionUid === 'spring-played-minion'
    ));
    expect(springTrigger, '变形之泉反应窗口应包含刚打出随从的触发项').toBeTruthy();
    await game.screenshot('06-变形之泉-反应窗口', testInfo);

    await game.selectInteractionOptionBy(
      option => option.value?.triggerId === springTrigger?.id,
      '选择变形之泉反应',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    const finalState = await game.getState();
    expect(finalState.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid)).toEqual([
      'spring-deck-minion',
    ]);
    expect(finalState.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid)).toEqual([
      'spring-deck-action',
      'spring-played-minion',
    ]);
    expect(finalState.core.players['0']?.hand).toEqual([]);
    expect(finalState.core.players['0']?.discard).toEqual([]);
    expect(finalState.core.bases[0]?.metadata?.transformationSpringUsedTurn_0).toBe(finalState.core.turnNumber);
    expect((finalState.sys?.eventStream?.entries ?? []).some((entry: any) => (
      entry.event?.type === 'su:card_to_deck_bottom'
        && entry.event?.payload?.cardUid === 'spring-played-minion'
        && entry.event?.payload?.sourceDefId === 'base_transformation_spring'
        && entry.event?.payload?.sourceBaseIndex === 0
    ))).toBe(true);
    expect((finalState.sys?.eventStream?.entries ?? []).some((entry: any) => (
      entry.event?.type === 'su:minion_played'
        && entry.event?.payload?.cardUid === 'spring-deck-minion'
        && entry.event?.payload?.fromDeck === true
        && entry.event?.payload?.discardPlaySourceId === 'base_transformation_spring'
    ))).toBe(true);
    expect((finalState.sys?.eventStream?.entries ?? []).some((entry: any) => (
      entry.event?.type === 'su:deck_reordered'
        && entry.event?.payload?.playerId === '0'
        && entry.event?.payload?.deckUids?.includes('spring-played-minion')
    ))).toBe(true);
    expect(finalState.sys?.interaction?.current).toBeFalsy();
    expect(finalState.core.triggerQueue ?? []).toHaveLength(0);
    await assertCardVisualReady(page, 'spring-deck-minion');
    await game.screenshot('07-变形之泉-额外随从打出并收口', testInfo);
  });

  test('巨型芜菁从真实打出入口按基地随从数量实时降低断点', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'russian_fairy_tales,ninjas',
      p1: 'pirates,dinosaurs',
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
          { uid: 'turnip-third-minion', defId: 'pirate_first_mate', type: 'minion', owner: '0' },
        ],
        deck: [],
        discard: [],
        factions: ['russian_fairy_tales', 'ninjas'],
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
        factions: ['pirates', 'dinosaurs'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      bases: [
        {
          defId: 'base_giant_turnip',
          minions: [
            { uid: 'turnip-existing-a', defId: 'pirate_first_mate', owner: '0', controller: '0', power: 2 },
            { uid: 'turnip-existing-b', defId: 'pirate_first_mate', owner: '1', controller: '1', power: 2 },
          ],
        },
        { defId: 'base_transformation_spring', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await assertCardVisualReady(page, 'turnip-third-minion');
    await assertCardVisualReady(page, 'turnip-existing-a');
    await assertCardVisualReady(page, 'turnip-existing-b');
    const breakpointToken = page.getByTestId('su-base-breakpoint-token-0');
    await expect(breakpointToken).toContainText('/ 28');
    await game.screenshot('08-巨型芜菁-两名随从时断点为28', testInfo);

    await game.playCard('pirate_first_mate', { targetBaseIndex: 0 });
    await game.waitForNoInteraction(10000);

    const finalState = await game.getState();
    expect(finalState.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid)).toEqual([
      'turnip-existing-a',
      'turnip-existing-b',
      'turnip-third-minion',
    ]);
    await expect(breakpointToken).toContainText('/ 27');
    expect(finalState.sys?.interaction?.current).toBeFalsy();
    expect(finalState.core.triggerQueue ?? []).toHaveLength(0);
    await game.screenshot('09-巨型芜菁-第三个随从打出后断点为27并收口', testInfo);
  });

  test('弥撒变化在真实入口下按真实拥有者归还借来牌并让双方按原手牌数抽回', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'russian_fairy_tales,aliens',
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
          { uid: 'mass-transformation', defId: 'russian_fairy_tales_mass_transformation', type: 'action', owner: '0' },
          { uid: 'borrowed-hand', defId: 'russian_fairy_tales_toad', type: 'minion', owner: '1', controller: '0' },
          { uid: 'p0-hand-b', defId: 'russian_fairy_tales_baba_yaga', type: 'minion', owner: '0', controller: '0' },
        ],
        deck: [
          { uid: 'p0-deck-a', defId: 'russian_fairy_tales_the_water_of_life', type: 'action', owner: '0' },
          { uid: 'p0-deck-b', defId: 'russian_fairy_tales_transformation', type: 'action', owner: '0' },
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
        hand: [
          { uid: 'p1-hand', defId: 'pirate_first_mate', type: 'minion', owner: '1', controller: '1' },
        ],
        deck: [
          { uid: 'p1-deck-a', defId: 'pirate_full_sail', type: 'action', owner: '1' },
          { uid: 'p1-deck-b', defId: 'ninja_shinobi', type: 'minion', owner: '1', controller: '1' },
        ],
        discard: [],
        factions: ['pirates', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      bases: [
        { defId: 'base_giant_turnip', minions: [] },
        { defId: 'base_transformation_spring', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await assertCardVisualReady(page, 'mass-transformation');
    await assertCardVisualReady(page, 'borrowed-hand');
    await game.screenshot('05-弥撒变化-借来手牌触发前', testInfo);

    await game.playCard('russian_fairy_tales_mass_transformation');
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        p0Hand: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        p0Deck: state.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        p0Discard: state.core.players['0']?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        p1Hand: state.core.players['1']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        p1Deck: state.core.players['1']?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        p1Discard: state.core.players['1']?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 15000 }).toEqual({
      p0Hand: ['p0-deck-a', 'p0-deck-b'],
      p0Deck: ['p0-hand-b'],
      p0Discard: ['mass-transformation'],
      p1Hand: ['p1-deck-a'],
      p1Deck: ['p1-deck-b', 'borrowed-hand', 'p1-hand'],
      p1Discard: [],
      interactionOpen: false,
    });
    await game.screenshot('06-弥撒变化-借来牌归还真实拥有者并抽回', testInfo);
  });

  test('芬尼斯特猎鹰被借来控制时，真实计分前特殊入口仍回到控制者手牌并额外打出', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'russian_fairy_tales,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260919,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'scoreBases',
      extra: {
        core: {
          scoringEligibleBaseIndices: [0],
        },
      },
      player0: {
        hand: [],
        deck: [],
        discard: [],
        factions: ['russian_fairy_tales', 'aliens'],
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
          defId: 'base_giant_turnip',
          minions: [
            { uid: 'borrowed-finist', defId: 'russian_fairy_tales_finist_the_falcon', owner: '1', controller: '0', power: 4 },
          ],
        },
        { defId: 'base_giant_turnip', minions: [] },
      ],
    });

    await game.waitForPhase('scoreBases');
    await assertCardVisualReady(page, 'borrowed-finist');
    await game.screenshot('07-芬尼斯特-借控计分前触发', testInfo);

    await page.locator('[data-minion-uid="borrowed-finist"]').click();
    await game.waitForInteraction('russian_fairy_tales_finist_the_falcon', 10000);
    await game.screenshot('08-芬尼斯特-借控选择额外打出基地', testInfo);
    await game.selectInteractionOptionBy(
      option => optionHasBaseIndex(option, 1),
      '芬尼斯特选择第二基地',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        base0Minions: state.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid) ?? [],
        base1Minions: state.core.bases[1]?.minions?.map((minion: { uid?: string; controller?: string; owner?: string }) => ({
          uid: minion.uid,
          controller: minion.controller,
          owner: minion.owner,
        })) ?? [],
        p0Hand: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        p1Hand: state.core.players['1']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 15000 }).toEqual({
      base0Minions: [],
      base1Minions: [{ uid: 'borrowed-finist', controller: '0', owner: '1' }],
      p0Hand: [],
      p1Hand: [],
      interactionOpen: false,
    });
    await game.screenshot('09-芬尼斯特-借控回手后额外打出并收口', testInfo);
  });

  test('青蛙公主在借来控制的宿主上真实触发后按 owner/controller 语义转移', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'russian_fairy_tales,aliens',
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
          { uid: 'frog-action', defId: 'russian_fairy_tales_the_frog_princess', type: 'action', owner: '0' },
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
        deck: [
          { uid: 'p1-deck', defId: 'pirate_first_mate', type: 'minion', owner: '1' },
        ],
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
          defId: 'base_giant_turnip',
          minions: [
            { uid: 'borrowed-host', defId: 'pirate_first_mate', owner: '1', controller: '0', power: 2 },
          ],
        },
        { defId: 'base_giant_turnip', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await assertCardVisualReady(page, 'frog-action');
    await assertCardVisualReady(page, 'borrowed-host');
    await game.screenshot('10-青蛙公主-借来宿主附着前', testInfo);

    await game.playCard('russian_fairy_tales_the_frog_princess', {
      targetBaseIndex: 0,
      targetMinionUid: 'borrowed-host',
    });
    await game.waitForNoInteraction(10000);
    const borrowedHost = page.locator('[data-minion-uid="borrowed-host"]');
    await page.mouse.move(0, 0);
    await borrowedHost.hover();
    await expect(borrowedHost).toHaveAttribute('data-attached-overlay-visible', 'true', { timeout: 10000 });
    await expect(page.locator('[data-attached-action-uid="frog-action"]')).toBeVisible({ timeout: 10000 });
    await game.screenshot('11-青蛙公主-借来宿主附着后', testInfo);

    await page.locator('[data-attached-action-uid="frog-action"]').click({ force: true });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const minion = state.core.bases[0]?.minions.find((candidate: { uid?: string }) => candidate.uid === 'deck-minion');
      return {
        base0Minions: state.core.bases[0]?.minions?.map((candidate: { uid?: string }) => candidate.uid) ?? [],
        frogOnReplacement: minion?.attachedActions?.some((action: { uid?: string; talentUsed?: boolean }) => (
          action.uid === 'frog-action' && action.talentUsed === true
        )) ?? false,
        p0Deck: state.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        p1Deck: state.core.players['1']?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 15000 }).toEqual({
      base0Minions: ['deck-minion'],
      frogOnReplacement: true,
      p0Deck: ['deck-action'],
      p1Deck: ['p1-deck', 'borrowed-host'],
      interactionOpen: false,
    });
    await game.screenshot('12-青蛙公主-宿主回拥有者牌库并转移行动后', testInfo);
  });

  test('着魔从真实附着入口在宿主离场后转移到另一个随从', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'russian_fairy_tales,ninjas',
      p1: 'pirates,dinosaurs',
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
          { uid: 'bewitched-card', defId: 'russian_fairy_tales_bewitched', type: 'action', owner: '0' },
          { uid: 'assassination-card', defId: 'ninja_assassination', type: 'action', owner: '0' },
        ],
        deck: [],
        discard: [],
        factions: ['russian_fairy_tales', 'ninjas'],
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
        factions: ['pirates', 'dinosaurs'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      bases: [
        {
          defId: 'base_giant_turnip',
          minions: [
            { uid: 'bewitched-host', defId: 'pirate_first_mate', owner: '1', controller: '1', power: 2 },
          ],
        },
        {
          defId: 'base_giant_turnip',
          minions: [
            { uid: 'bewitched-target', defId: 'pirate_buccaneer', owner: '0', controller: '0', power: 3 },
          ],
        },
      ],
    });

    await game.waitForPhase('playCards');
    await assertCardVisualReady(page, 'bewitched-card');
    await assertCardVisualReady(page, 'bewitched-host');
    await game.screenshot('13-着魔-真实附着入口触发前', testInfo);

    await game.playCard('russian_fairy_tales_bewitched', { targetBaseIndex: 0, targetMinionUid: 'bewitched-host' });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    const afterAttach = await game.getState();
    const hostAfterAttach = afterAttach.core.bases[0]?.minions?.find((minion: { uid?: string }) => minion.uid === 'bewitched-host');
    const attachedBewitchedUid = hostAfterAttach?.attachedActions?.find((action: { defId?: string; uid?: string }) => (
      action.defId === 'russian_fairy_tales_bewitched'
    ))?.uid;
    expect(attachedBewitchedUid).toBeTruthy();
    expect(hostAfterAttach?.attachedActions?.map((action: { defId?: string }) => action.defId)).toEqual([
      'russian_fairy_tales_bewitched',
    ]);
    await page.locator('[data-minion-uid="bewitched-host"]').click({ force: true });
    await expect(page.locator(`[data-attached-action-uid="${attachedBewitchedUid}"]`)).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('su-minion-power-badge-bewitched-host')).toContainText('+2');
    await game.screenshot('14-着魔-宿主附着并获得加力', testInfo);
    await dismissCardMagnifyIfPresent(page);

    await game.playCard('ninja_assassination', { targetBaseIndex: 0, targetMinionUid: 'bewitched-host' });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await page.getByRole('button', { name: /^(结束回合|Finish Turn|End)$/i }).click({ force: true });
    await game.waitForInteraction('russian_fairy_tales_bewitched_transfer', 15000);
    await game.screenshot('15-着魔-宿主离场后的转移选择', testInfo);

    const transferOptions = await game.getInteractionOptions();
    expect(transferOptions.some((option: any) => option.value?.minionUid === 'bewitched-target' && option.value?.baseIndex === 1)).toBe(true);
    await game.selectInteractionOptionBy(
      option => option.value?.minionUid === 'bewitched-target',
      '着魔转移到第二基地的随从',
    );
    await game.waitForNoInteraction(10000);

    const finalState = await game.getState();
    const hostStillExists = finalState.core.bases.some((base: any) => base.minions?.some((minion: any) => minion.uid === 'bewitched-host'));
    const transferredTarget = finalState.core.bases[1]?.minions?.find((minion: { uid?: string }) => minion.uid === 'bewitched-target');
    const transferredAction = transferredTarget?.attachedActions?.find((action: { defId?: string; uid?: string }) => (
      action.defId === 'russian_fairy_tales_bewitched'
    ));
    expect(hostStillExists).toBe(false);
    expect(transferredAction?.uid).toBe(attachedBewitchedUid);
    expect(finalState.core.players['0']?.discard?.some((card: { defId?: string }) => card.defId === 'russian_fairy_tales_bewitched')).toBe(false);
    expect(finalState.sys?.interaction?.current).toBeFalsy();

    await page.locator('[data-minion-uid="bewitched-target"]').click({ force: true });
    await expect(page.locator(`[data-attached-action-uid="${attachedBewitchedUid}"]`)).toBeVisible({ timeout: 10000 });
    await game.screenshot('16-着魔-附着行动转移并收口', testInfo);
  });

  test('芭芭雅嘎从真实天赋入口把同基地随从放回拥有者牌库底并替换上场', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'russian_fairy_tales,ninjas',
      p1: 'pirates,dinosaurs',
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
          { uid: 'baba-yaga-card', defId: 'russian_fairy_tales_baba_yaga', type: 'minion', owner: '0' },
        ],
        deck: [
          { uid: 'replacement-card', defId: 'russian_fairy_tales_the_birch', type: 'minion', owner: '0' },
        ],
        discard: [],
        factions: ['russian_fairy_tales', 'ninjas'],
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
        factions: ['pirates', 'dinosaurs'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      bases: [
        {
          defId: 'base_giant_turnip',
          minions: [
            { uid: 'target-minion', defId: 'pirate_first_mate', owner: '0', controller: '0', power: 2 },
          ],
        },
        { defId: 'base_transformation_spring', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await assertCardVisualReady(page, 'baba-yaga-card');
    await assertCardVisualReady(page, 'target-minion');
    await game.screenshot('20-芭芭雅嘎-真实打出前', testInfo);

    await game.playCard('russian_fairy_tales_baba_yaga', { targetBaseIndex: 0 });
    await game.waitForNoInteraction(10000);
    await page.locator('[data-minion-uid="baba-yaga-card"]').click({ force: true });
    await game.waitForInteraction('russian_fairy_tales_baba_yaga', 10000);
    await game.screenshot('21-芭芭雅嘎-天赋选择同基地随从', testInfo);

    const options = await game.getInteractionOptions();
    expect(options.some((option: any) => (
      option.value?.minionUid === 'target-minion' && option.value?.baseIndex === 0
    ))).toBe(true);
    await game.selectInteractionOptionBy(
      option => option.value?.minionUid === 'target-minion' && option.value?.baseIndex === 0,
      '芭芭雅嘎选择同基地目标随从',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    const finalState = await game.getState();
    expect(finalState.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid)).toEqual([
      'baba-yaga-card',
      'replacement-card',
    ]);
    expect(finalState.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid)).toEqual([
      'target-minion',
    ]);
    expect(finalState.core.players['0']?.hand).toEqual([]);
    expect(finalState.core.players['0']?.discard).toEqual([]);
    expect(finalState.core.bases[0]?.minions?.find((minion: { uid?: string }) => minion.uid === 'baba-yaga-card')?.talentUsed).toBe(true);
    expect((finalState.sys?.eventStream?.entries ?? []).some((entry: any) => (
      entry.event?.type === 'su:card_to_deck_bottom'
        && entry.event?.payload?.cardUid === 'target-minion'
        && entry.event?.payload?.sourceDefId === 'russian_fairy_tales_baba_yaga'
    ))).toBe(true);
    expect((finalState.sys?.eventStream?.entries ?? []).some((entry: any) => (
      entry.event?.type === 'su:minion_played'
        && entry.event?.payload?.cardUid === 'replacement-card'
        && entry.event?.payload?.fromDeck === true
        && entry.event?.payload?.discardPlaySourceId === 'russian_fairy_tales_baba_yaga'
    ))).toBe(true);
    expect(finalState.sys?.interaction?.current).toBeFalsy();
    expect(finalState.core.triggerQueue ?? []).toHaveLength(0);
    await assertCardVisualReady(page, 'replacement-card');
    await game.screenshot('22-芭芭雅嘎-替换随从上场并收口', testInfo);
  });

  test('白桦木从真实回合开始触发入口自毁并把白桦木女神额外打回原基地', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'russian_fairy_tales,ninjas',
      p1: 'pirates,dinosaurs',
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
        deck: [
          { uid: 'birch-draw-buffer-1', defId: 'ninja_assassination', type: 'action', owner: '0' },
          { uid: 'birch-draw-buffer-2', defId: 'ninja_assassination', type: 'action', owner: '0' },
          { uid: 'birch-woman-start-card', defId: 'russian_fairy_tales_the_birch_woman', type: 'minion', owner: '0' },
        ],
        discard: [],
        factions: ['russian_fairy_tales', 'ninjas'],
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
        factions: ['pirates', 'dinosaurs'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      bases: [
        {
          defId: 'base_giant_turnip',
          minions: [
            { uid: 'birch-start-card', defId: 'russian_fairy_tales_the_birch', owner: '0', controller: '0', power: 2 },
          ],
        },
        { defId: 'base_transformation_spring', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await assertCardVisualReady(page, 'birch-start-card');
    await game.screenshot('23-白桦木-回合结束前', testInfo);

    await page.getByRole('button', { name: /^(结束回合|Finish Turn|End)$/i }).click({ force: true });
    await game.waitForInteraction('smashup_reaction_choose', 20000);
    await game.screenshot('24-白桦木-下一回合开始触发选择', testInfo);
    await game.selectInteractionOptionBy(
      option => option.value?.kind === 'trigger'
        && String(option.value?.triggerId ?? '').includes('russian_fairy_tales_the_birch'),
      '选择白桦木回合开始触发',
    );
    await game.waitForInteraction('russian_fairy_tales_search_card', 15000);

    const afterDestroy = await game.getState();
    expect(afterDestroy.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid)).toEqual([]);
    expect(afterDestroy.core.players['0']?.discard?.map((card: { uid?: string }) => card.uid)).toContain('birch-start-card');
    expect(afterDestroy.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid)).toEqual(['birch-woman-start-card']);
    expect(afterDestroy.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid)).toEqual([
      'birch-draw-buffer-1',
      'birch-draw-buffer-2',
    ]);
    await game.screenshot('25-白桦木-自毁后搜索白桦木女神', testInfo);

    await game.selectInteractionOptionBy(
      option => option.value?.cardUid === 'birch-woman-start-card'
        && option.value?.mode === 'play'
        && option.value?.baseIndex === 0,
      '白桦木选择把白桦木女神额外打回原基地',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    const finalState = await game.getState();
    expect(finalState.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid)).toEqual([
      'birch-woman-start-card',
    ]);
    expect(finalState.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid)).toEqual([
      'birch-draw-buffer-1',
      'birch-draw-buffer-2',
    ]);
    expect(finalState.core.players['0']?.deck).toEqual([]);
    expect(finalState.core.players['0']?.discard?.map((card: { uid?: string }) => card.uid)).toContain('birch-start-card');
    expect((finalState.sys?.eventStream?.entries ?? []).some((entry: any) => (
      entry.event?.type === 'su:minion_destroyed'
        && entry.event?.payload?.minionUid === 'birch-start-card'
    ))).toBe(true);
    expect((finalState.sys?.eventStream?.entries ?? []).some((entry: any) => (
      entry.event?.type === 'su:minion_played'
        && entry.event?.payload?.cardUid === 'birch-woman-start-card'
        && entry.event?.payload?.fromDeck === true
        && entry.event?.payload?.discardPlaySourceId === 'russian_fairy_tales_the_birch'
    ))).toBe(true);
    expect(finalState.sys?.interaction?.current).toBeFalsy();
    expect(finalState.core.triggerQueue ?? []).toHaveLength(0);
    await assertCardVisualReady(page, 'birch-woman-start-card');
    await game.screenshot('26-白桦木-白桦木女神额外打出并收口', testInfo);
  });

  test('白桦木女神从真实弃牌触发入口搜索白桦木并作为额外随从打出', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'russian_fairy_tales,ninjas',
      p1: 'pirates,dinosaurs',
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
          { uid: 'birch-woman-card', defId: 'russian_fairy_tales_the_birch_woman', type: 'minion', owner: '0' },
          { uid: 'assassination-card', defId: 'ninja_assassination', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'birch-card', defId: 'russian_fairy_tales_the_birch', type: 'minion', owner: '0' },
        ],
        discard: [],
        factions: ['russian_fairy_tales', 'ninjas'],
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
        factions: ['pirates', 'dinosaurs'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      bases: [
        {
          defId: 'base_central_brain',
          minions: [
            { uid: 'score-driver', defId: 'dino_king_rex', owner: '1', controller: '1', basePower: 20 },
          ],
        },
        { defId: 'base_giant_turnip', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await assertCardVisualReady(page, 'birch-woman-card');
    await game.screenshot('17-白桦木女神-真实打出前', testInfo);

    await game.playCard('russian_fairy_tales_the_birch_woman', { targetBaseIndex: 0 });
    await game.waitForNoInteraction(10000);
    await game.playCard('ninja_assassination', { targetBaseIndex: 0, targetMinionUid: 'birch-woman-card' });
    await game.waitForNoInteraction(10000);
    await page.getByRole('button', { name: /^(结束回合|Finish Turn|End)$/i }).click({ force: true });

    await game.waitForInteraction('smashup_reaction_choose', 15000);
    await game.selectInteractionOptionBy(
      option => option.value?.kind === 'trigger'
        && String(option.value?.triggerId ?? '').includes('russian_fairy_tales_the_birch_woman'),
      '选择白桦木女神弃置后的触发',
    );
    await game.waitForInteraction('russian_fairy_tales_search_card', 15000);
    const afterScoringState = await game.getState();
    expect(afterScoringState.core.players['0']?.hand).toEqual([]);
    expect(afterScoringState.core.players['0']?.discard?.map((card: { uid?: string }) => card.uid)).toEqual(expect.arrayContaining([
      'birch-woman-card',
      'assassination-card',
    ]));
    expect(afterScoringState.core.players['0']?.discard).toHaveLength(2);
    expect(afterScoringState.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid)).toEqual(['birch-card']);
    expect(afterScoringState.core.players['0']?.vp).toBe(2);
    await game.screenshot('18-白桦木女神-离场后搜索白桦木', testInfo);
    await game.selectInteractionOptionBy(
      option => option.value?.cardUid === 'birch-card'
        && option.value?.mode === 'play'
        && option.value?.baseIndex === 0,
      '白桦木女神选择把白桦木作为额外随从打到原基地',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    const finalState = await game.getState();
    expect(finalState.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid)).toEqual(['birch-card']);
    expect(finalState.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid)).toEqual(expect.arrayContaining([
      'birch-woman-card',
      'assassination-card',
    ]));
    expect(finalState.core.players['0']?.discard?.some((card: { uid?: string }) => card.uid === 'birch-card')).toBe(false);
    expect(finalState.core.players['0']?.deck?.some((card: { uid?: string }) => card.uid === 'birch-card')).toBe(false);
    expect(finalState.core.players['0']?.hand?.some((card: { uid?: string }) => card.uid === 'birch-card')).toBe(false);
    expect((finalState.sys?.eventStream?.entries ?? []).some((entry: any) => (
      entry.event?.type === 'su:minion_played'
        && entry.event?.payload?.cardUid === 'birch-card'
        && entry.event?.payload?.fromDeck === true
        && entry.event?.payload?.discardPlaySourceId === 'russian_fairy_tales_the_birch_woman'
    ))).toBe(true);
    expect(finalState.sys?.interaction?.current).toBeFalsy();
    expect(finalState.core.triggerQueue ?? []).toHaveLength(0);
    await assertCardVisualReady(page, 'birch-card');
    await game.screenshot('19-白桦木女神-白桦木额外打出并收口', testInfo);
  });

  test('沙皇之鹰从真实打出入口完成弃牌堆随从回牌库顶和抽牌两种选择', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'russian_fairy_tales,ninjas',
      p1: 'pirates,dinosaurs',
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
          { uid: 'tsar-eagle-discard-card', defId: 'russian_fairy_tales_tsar_eagle', type: 'minion', owner: '0' },
          { uid: 'tsar-eagle-draw-card', defId: 'russian_fairy_tales_tsar_eagle', type: 'minion', owner: '0' },
        ],
        deck: [
          { uid: 'tsar-eagle-draw-target', defId: 'russian_fairy_tales_the_water_of_life', type: 'action', owner: '0' },
        ],
        discard: [],
        factions: ['russian_fairy_tales', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 2,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player1: {
        hand: [],
        deck: [
          { uid: 'opponent-existing-card', defId: 'pirate_first_mate', type: 'minion', owner: '1' },
        ],
        discard: [
          { uid: 'opponent-discard-minion', defId: 'russian_fairy_tales_tsar_eagle', type: 'minion', owner: '1' },
        ],
        factions: ['pirates', 'dinosaurs'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      bases: [
        { defId: 'base_giant_turnip', minions: [] },
        { defId: 'base_giant_turnip', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await assertCardVisualReady(page, 'tsar-eagle-discard-card');
    await game.screenshot('27-沙皇之鹰-真实打出前', testInfo);

    await game.playCard('russian_fairy_tales_tsar_eagle', { targetBaseIndex: 0 });
    await game.waitForInteraction('russian_fairy_tales_tsar_eagle', 15000);
    await game.selectInteractionOptionBy(
      option => option.value?.cardUid === 'opponent-discard-minion'
        && option.value?.mode === 'deckTop'
        && option.value?.targetPlayerId === '1',
      '沙皇之鹰选择对手弃牌堆随从',
    );
    await game.waitForNoInteraction(10000);

    const afterDeckTop = await game.getState();
    expect(afterDeckTop.core.players['1']?.discard).toEqual([]);
    expect(afterDeckTop.core.players['1']?.deck?.map((card: { uid?: string }) => card.uid)).toEqual([
      'opponent-discard-minion',
      'opponent-existing-card',
    ]);
    expect((afterDeckTop.sys?.eventStream?.entries ?? []).some((entry: any) => (
      entry.event?.type === 'su:card_to_deck_top'
        && entry.event?.payload?.cardUid === 'opponent-discard-minion'
        && entry.event?.payload?.ownerId === '1'
        && entry.event?.payload?.sourcePlayerId === '0'
        && entry.event?.payload?.sourceDefId === 'russian_fairy_tales_tsar_eagle'
    ))).toBe(true);
    await game.screenshot('28-沙皇之鹰-弃牌堆随从回牌库顶并收口', testInfo);

    await game.playCard('russian_fairy_tales_tsar_eagle', { targetBaseIndex: 0 });
    await game.waitForInteraction('russian_fairy_tales_tsar_eagle', 15000);
    await game.selectInteractionOptionBy(
      option => option.value?.mode === 'draw',
      '沙皇之鹰选择抽牌',
    );
    await game.waitForNoInteraction(10000);

    const finalState = await game.getState();
    expect(finalState.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid)).toContain('tsar-eagle-draw-target');
    expect(finalState.core.players['0']?.deck).toEqual([]);
    expect(finalState.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid)).toEqual([
      'tsar-eagle-discard-card',
      'tsar-eagle-draw-card',
    ]);
    expect((finalState.sys?.eventStream?.entries ?? []).some((entry: any) => (
      entry.event?.type === 'su:cards_drawn'
        && entry.event?.payload?.cardUids?.includes('tsar-eagle-draw-target')
        && entry.event?.payload?.playerId === '0'
    ))).toBe(true);
    expect(finalState.sys?.interaction?.current).toBeFalsy();
    expect(finalState.core.triggerQueue ?? []).toHaveLength(0);
    await assertCardVisualReady(page, 'tsar-eagle-draw-card');
    await game.screenshot('29-沙皇之鹰-抽牌分支并收口', testInfo);
  });

  test('灰色之狼从真实天赋入口回牌库顶并把手牌随从额外打到原基地', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'russian_fairy_tales,ninjas',
      p1: 'pirates,dinosaurs',
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
          { uid: 'gray-wolf-card', defId: 'russian_fairy_tales_the_gray_wolf', type: 'minion', owner: '0' },
          { uid: 'gray-wolf-extra-birch', defId: 'russian_fairy_tales_the_birch', type: 'minion', owner: '0' },
        ],
        deck: [
          { uid: 'gray-wolf-existing-card', defId: 'russian_fairy_tales_the_water_of_life', type: 'action', owner: '0' },
        ],
        discard: [],
        factions: ['russian_fairy_tales', 'ninjas'],
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
        factions: ['pirates', 'dinosaurs'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      bases: [
        { defId: 'base_giant_turnip', minions: [] },
        { defId: 'base_giant_turnip', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await assertCardVisualReady(page, 'gray-wolf-card');
    await assertCardVisualReady(page, 'gray-wolf-extra-birch');
    await game.screenshot('30-灰色之狼-真实打出前', testInfo);

    await game.playCard('russian_fairy_tales_the_gray_wolf', { targetBaseIndex: 0 });
    await game.waitForNoInteraction(10000);
    await page.locator('[data-minion-uid="gray-wolf-card"]').click({ force: true });
    await game.waitForInteraction('russian_fairy_tales_the_gray_wolf', 10000);

    const options = await game.getInteractionOptions();
    expect(options.some((option: any) => (
      option.value?.cardUid === 'gray-wolf-extra-birch'
        && option.value?.zone === 'hand'
        && option.value?.mode === 'play'
        && option.value?.baseIndex === 0
    ))).toBe(true);
    await game.screenshot('31-灰色之狼-天赋选择手牌随从', testInfo);
    await game.selectInteractionOptionBy(
      option => option.value?.cardUid === 'gray-wolf-extra-birch'
        && option.value?.zone === 'hand'
        && option.value?.baseIndex === 0,
      '灰色之狼选择手牌随从额外出牌',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    const finalState = await game.getState();
    expect(finalState.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid)).toEqual([
      'gray-wolf-card',
      'gray-wolf-existing-card',
    ]);
    expect(finalState.core.players['0']?.hand).toEqual([]);
    expect(finalState.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid)).toEqual([
      'gray-wolf-extra-birch',
    ]);
    expect(finalState.core.bases[0]?.minions?.[0]?.powerCounters).toBe(1);
    expect((finalState.sys?.eventStream?.entries ?? []).some((entry: any) => (
      entry.event?.type === 'su:card_to_deck_top'
        && entry.event?.payload?.cardUid === 'gray-wolf-card'
        && entry.event?.payload?.ownerId === '0'
        && entry.event?.payload?.sourceDefId === 'russian_fairy_tales_the_gray_wolf'
    ))).toBe(true);
    expect((finalState.sys?.eventStream?.entries ?? []).some((entry: any) => (
      entry.event?.type === 'su:minion_played'
        && entry.event?.payload?.cardUid === 'gray-wolf-extra-birch'
        && entry.event?.payload?.consumesNormalLimit === false
        && entry.event?.payload?.discardPlaySourceId === 'russian_fairy_tales_the_gray_wolf'
    ))).toBe(true);
    expect(finalState.sys?.interaction?.current).toBeFalsy();
    expect(finalState.core.triggerQueue ?? []).toHaveLength(0);
    await assertCardVisualReady(page, 'gray-wolf-extra-birch');
    await game.screenshot('32-灰色之狼-回牌库顶并额外打出收口', testInfo);
  });

  test('愚蠢的魔术师从真实打出入口抽三张并逐张整理到牌库顶和底', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'russian_fairy_tales,ninjas',
      p1: 'pirates,dinosaurs',
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
          { uid: 'foolish-magician-card', defId: 'russian_fairy_tales_foolish_magician', type: 'minion', owner: '0' },
        ],
        deck: [
          { uid: 'foolish-draw-a', defId: 'russian_fairy_tales_the_water_of_life', type: 'action', owner: '0' },
          { uid: 'foolish-draw-b', defId: 'russian_fairy_tales_tsar_eagle', type: 'minion', owner: '0' },
          { uid: 'foolish-draw-c', defId: 'russian_fairy_tales_toad', type: 'minion', owner: '0' },
        ],
        discard: [],
        factions: ['russian_fairy_tales', 'ninjas'],
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
        factions: ['pirates', 'dinosaurs'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      bases: [
        { defId: 'base_giant_turnip', minions: [] },
        { defId: 'base_giant_turnip', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await assertCardVisualReady(page, 'foolish-magician-card');
    await game.screenshot('33-愚蠢的魔术师-真实打出前', testInfo);

    await game.playCard('russian_fairy_tales_foolish_magician', { targetBaseIndex: 0 });
    await game.waitForInteraction('russian_fairy_tales_foolish_magician', 15000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => page.locator('[data-option-id]').count(), {
      timeout: 15000,
      message: '愚蠢的魔术师整理交互必须先渲染出真实选项',
    }).toBeGreaterThan(0);
    const options = await game.getInteractionOptions();
    const placements = [
      { uid: 'foolish-draw-a', placement: 'bottom' },
      { uid: 'foolish-draw-b', placement: 'bottom' },
      { uid: 'foolish-draw-c', placement: 'top' },
    ] as const;
    for (const selection of placements) {
      const option = options.find((candidate: any) => (
        candidate.value?.cardUid === selection.uid
          && candidate.value?.placement === selection.placement
      ));
      expect(option, `愚蠢的魔术师应提供 ${selection.uid} 放到${selection.placement === 'top' ? '牌库顶' : '牌库底'}`).toBeTruthy();
      const optionLocator = page.locator(`[data-option-id="${option!.id}"]`).first();
      await expect(optionLocator, `愚蠢的魔术师选项 ${option!.id} 必须可见`).toBeVisible({ timeout: 10000 });
      await optionLocator.click({ force: true });
    }
    await game.screenshot('34-愚蠢的魔术师-逐张选择牌库位置', testInfo);
    await game.confirm();
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    const finalState = await game.getState();
    expect(finalState.core.players['0']?.hand).toEqual([]);
    expect(finalState.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid)).toEqual([
      'foolish-draw-c',
      'foolish-draw-a',
      'foolish-draw-b',
    ]);
    expect(finalState.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid)).toEqual([
      'foolish-magician-card',
    ]);
    expect((finalState.sys?.eventStream?.entries ?? []).some((entry: any) => (
      entry.event?.type === 'su:cards_drawn'
        && entry.event?.payload?.playerId === '0'
        && entry.event?.payload?.cardUids?.join(',') === 'foolish-draw-a,foolish-draw-b,foolish-draw-c'
    ))).toBe(true);
    expect((finalState.sys?.eventStream?.entries ?? []).some((entry: any) => (
      entry.event?.type === 'su:card_to_deck_top'
        && entry.event?.payload?.cardUid === 'foolish-draw-c'
        && entry.event?.payload?.sourceDefId === 'russian_fairy_tales_foolish_magician'
    ))).toBe(true);
    expect((finalState.sys?.eventStream?.entries ?? []).filter((entry: any) => (
      entry.event?.type === 'su:card_to_deck_bottom'
        && entry.event?.payload?.sourceDefId === 'russian_fairy_tales_foolish_magician'
    ))).toHaveLength(2);
    expect(finalState.sys?.interaction?.current).toBeFalsy();
    expect(finalState.core.triggerQueue ?? []).toHaveLength(0);
    await assertCardVisualReady(page, 'foolish-magician-card');
    await game.screenshot('35-愚蠢的魔术师-整理牌库并收口', testInfo);
  });

  test('蟾蜍从真实打出入口交给对手并把其随从洗回真实拥有者牌库', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'russian_fairy_tales,ninjas',
      p1: 'pirates,dinosaurs',
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
          { uid: 'toad-card', defId: 'russian_fairy_tales_toad', type: 'minion', owner: '0' },
        ],
        deck: [],
        discard: [],
        factions: ['russian_fairy_tales', 'ninjas'],
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
        factions: ['pirates', 'dinosaurs'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      bases: [
        {
          defId: 'base_giant_turnip',
          minions: [
            { uid: 'toad-victim', defId: 'pirate_first_mate', owner: '1', controller: '1', basePower: 2 },
          ],
        },
        { defId: 'base_giant_turnip', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await assertCardVisualReady(page, 'toad-card');
    await assertCardVisualReady(page, 'toad-victim');
    await game.screenshot('36-蟾蜍-真实打出前', testInfo);

    await game.playCard('russian_fairy_tales_toad', { targetBaseIndex: 0 });
    await game.waitForInteraction('russian_fairy_tales_toad', 15000);
    const options = await game.getInteractionOptions();
    expect(options.some((option: any) => (
      option.value?.minionUid === 'toad-victim'
        && option.value?.targetPlayerId === '1'
        && option.value?.baseIndex === 0
    ))).toBe(true);
    await game.screenshot('37-蟾蜍-选择同基地对手随从', testInfo);

    await page.locator('[data-minion-uid="toad-victim"]').click({ force: true });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    const finalState = await game.getState();
    const baseMinions = finalState.core.bases[0]?.minions ?? [];
    expect(baseMinions.map((minion: { uid?: string }) => minion.uid)).toEqual(['toad-card']);
    expect(baseMinions).toEqual([
      expect.objectContaining({ uid: 'toad-card', owner: '0', controller: '1' }),
    ]);
    expect(baseMinions.some((minion: { uid?: string }) => minion.uid === 'toad-victim')).toBe(false);
    expect(finalState.core.players['1']?.deck?.map((card: { uid?: string }) => card.uid)).toContain('toad-victim');
    expect(finalState.core.players['1']?.discard).toEqual([]);
    expect(finalState.core.players['0']?.hand).toEqual([]);

    expect((finalState.sys?.eventStream?.entries ?? []).some((entry: any) => (
      entry.event?.type === 'su:minion_control_changed'
        && entry.event?.payload?.minionUid === 'toad-card'
        && entry.event?.payload?.ownerId === '0'
        && entry.event?.payload?.fromControllerId === '0'
        && entry.event?.payload?.toControllerId === '1'
        && entry.event?.payload?.sourceDefId === 'russian_fairy_tales_toad'
    ))).toBe(true);
    expect((finalState.sys?.eventStream?.entries ?? []).some((entry: any) => (
      entry.event?.type === 'su:card_to_deck_bottom'
        && entry.event?.payload?.cardUid === 'toad-victim'
        && entry.event?.payload?.ownerId === '1'
        && entry.event?.payload?.sourceCardUid === 'toad-card'
        && entry.event?.payload?.sourceDefId === 'russian_fairy_tales_toad'
    ))).toBe(true);
    expect((finalState.sys?.eventStream?.entries ?? []).some((entry: any) => (
      entry.event?.type === 'su:deck_reordered'
        && entry.event?.payload?.playerId === '1'
        && entry.event?.payload?.deckUids?.includes('toad-victim')
    ))).toBe(true);
    expect(finalState.sys?.interaction?.current).toBeFalsy();
    expect(finalState.core.triggerQueue ?? []).toHaveLength(0);
    await assertCardVisualReady(page, 'toad-card');
    await game.screenshot('38-蟾蜍-交给对手并洗回其拥有者牌库收口', testInfo);
  });

  test('生命之水从真实打出入口把弃牌堆随从放到牌库顶并获得额外行动', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'russian_fairy_tales,ninjas',
      p1: 'pirates,dinosaurs',
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
          { uid: 'water-card', defId: 'russian_fairy_tales_the_water_of_life', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'water-existing', defId: 'russian_fairy_tales_tsar_eagle', type: 'minion', owner: '0' },
        ],
        discard: [
          { uid: 'water-target', defId: 'russian_fairy_tales_toad', type: 'minion', owner: '0' },
        ],
        factions: ['russian_fairy_tales', 'ninjas'],
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
        factions: ['pirates', 'dinosaurs'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      bases: [
        { defId: 'base_transformation_spring', minions: [] },
        { defId: 'base_giant_turnip', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await assertCardVisualReady(page, 'water-card');
    await game.screenshot('39-生命之水-真实打出前', testInfo);

    const beforeState = await game.getState();
    const beforeActionLimit = beforeState.core.players['0']?.actionLimit ?? 0;
    await game.playCard('russian_fairy_tales_the_water_of_life');
    await game.waitForInteraction('russian_fairy_tales_the_water_of_life', 15000);
    await expect(page.locator('[data-discard-view-panel]')).toBeVisible({ timeout: 15000 });
    const options = await game.getInteractionOptions();
    expect(options.some((option: any) => (
      option.value?.cardUid === 'water-target'
        && option.value?.zone === 'discard'
        && option.value?.mode === 'deckTop'
    ))).toBe(true);
    await game.screenshot('40-生命之水-选择弃牌堆随从', testInfo);

    await clickDiscardCard(page, 'water-target');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    const finalState = await game.getState();
    expect(finalState.core.players['0']?.hand).toEqual([]);
    expect(finalState.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid)).toEqual([
      'water-target',
      'water-existing',
    ]);
    expect(finalState.core.players['0']?.discard?.map((card: { uid?: string }) => card.uid)).toEqual(['water-card']);
    expect(finalState.core.players['0']?.actionLimit).toBe(beforeActionLimit + 1);
    expect((finalState.sys?.eventStream?.entries ?? []).some((entry: any) => (
      entry.event?.type === 'su:card_to_deck_top'
        && entry.event?.payload?.cardUid === 'water-target'
        && entry.event?.payload?.ownerId === '0'
        && entry.event?.payload?.sourceDefId === 'russian_fairy_tales_the_water_of_life'
    ))).toBe(true);
    expect((finalState.sys?.eventStream?.entries ?? []).some((entry: any) => (
      entry.event?.type === 'su:limit_modified'
        && entry.event?.payload?.playerId === '0'
        && entry.event?.payload?.limitType === 'action'
        && entry.event?.payload?.delta === 1
    ))).toBe(true);
    expect(finalState.sys?.interaction?.current).toBeFalsy();
    expect(finalState.core.triggerQueue ?? []).toHaveLength(0);
    await game.screenshot('41-生命之水-牌库顶与额外行动收口', testInfo);
  });

  test('我不知道要拿什么从真实打出入口展示牌库并把两张行动加入手牌', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'russian_fairy_tales,ninjas',
      p1: 'pirates,dinosaurs',
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
          { uid: 'fetch-card', defId: 'russian_fairy_tales_fetch_i_know_not_what', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'fetch-minion-a', defId: 'russian_fairy_tales_tsar_eagle', type: 'minion', owner: '0' },
          { uid: 'fetch-action-a', defId: 'russian_fairy_tales_the_water_of_life', type: 'action', owner: '0' },
          { uid: 'fetch-minion-b', defId: 'russian_fairy_tales_toad', type: 'minion', owner: '0' },
          { uid: 'fetch-action-b', defId: 'russian_fairy_tales_transformation', type: 'action', owner: '0' },
          { uid: 'fetch-tail', defId: 'russian_fairy_tales_baba_yaga', type: 'minion', owner: '0' },
        ],
        discard: [],
        factions: ['russian_fairy_tales', 'ninjas'],
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
        factions: ['pirates', 'dinosaurs'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      bases: [
        { defId: 'base_transformation_spring', minions: [] },
        { defId: 'base_giant_turnip', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await assertCardVisualReady(page, 'fetch-card');
    await game.screenshot('42-我不知道要拿什么-真实打出前', testInfo);

    await game.playCard('russian_fairy_tales_fetch_i_know_not_what');
    await game.waitForInteraction('russian_fairy_tales_fetch_i_know_not_what', 15000);
    await dismissSpotlightIfPresent(page);
    await expect(page.locator('[data-option-id="action-0"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="action-1"]')).toBeVisible({ timeout: 15000 });
    const options = await game.getInteractionOptions();
    const actionA = options.find((option: any) => option.value?.cardUid === 'fetch-action-a');
    const actionB = options.find((option: any) => option.value?.cardUid === 'fetch-action-b');
    expect(actionA).toBeTruthy();
    expect(actionB).toBeTruthy();
    await game.screenshot('43-我不知道要拿什么-展示牌库并选择两张行动', testInfo);
    await dismissRevealIfPresent(page);

    const promptCardGrid = page.getByTestId('prompt-card-grid');
    const actionACard = promptCardGrid.locator(`[data-option-id="${actionA!.id}"]`).first();
    const actionBCard = promptCardGrid.locator(`[data-option-id="${actionB!.id}"]`).first();
    await expect(actionACard).toBeVisible({ timeout: 10000 });
    await expect(actionBCard).toBeVisible({ timeout: 10000 });
    await actionACard.click({ force: true });
    await expect(page.getByText(/已选\s*1\s*\/\s*2/)).toBeVisible({ timeout: 10000 });
    await actionBCard.click({ force: true });
    await expect(page.getByText(/已选\s*2\s*\/\s*2/)).toBeVisible({ timeout: 10000 });
    await game.confirm();
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    const finalState = await game.getState();
    expect(finalState.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid)).toEqual(expect.arrayContaining([
      'fetch-action-a',
      'fetch-action-b',
    ]));
    expect(finalState.core.players['0']?.hand).toHaveLength(2);
    expect(finalState.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid)).toEqual(expect.arrayContaining([
      'fetch-minion-a',
      'fetch-minion-b',
      'fetch-tail',
    ]));
    expect(finalState.core.players['0']?.deck).toHaveLength(3);
    expect(finalState.core.players['0']?.discard?.map((card: { uid?: string }) => card.uid)).toEqual(['fetch-card']);
    expect((finalState.sys?.eventStream?.entries ?? []).some((entry: any) => (
      entry.event?.type === 'su:reveal_deck_top'
        && entry.event?.payload?.targetPlayerId === '0'
        && entry.event?.payload?.count === 4
        && entry.event?.payload?.reason === 'russian_fairy_tales_fetch_i_know_not_what'
        && entry.event?.payload?.cards?.map((card: any) => card.uid).join(',') === 'fetch-minion-a,fetch-action-a,fetch-minion-b,fetch-action-b'
    ))).toBe(true);
    for (const uid of ['fetch-action-a', 'fetch-action-b']) {
      expect((finalState.sys?.eventStream?.entries ?? []).some((entry: any) => (
        entry.event?.type === 'su:card_transferred'
          && entry.event?.payload?.cardUid === uid
          && entry.event?.payload?.toPlayerId === '0'
          && entry.event?.payload?.reason === 'russian_fairy_tales_fetch_i_know_not_what'
      ))).toBe(true);
    }
    expect((finalState.sys?.eventStream?.entries ?? []).some((entry: any) => (
      entry.event?.type === 'su:deck_reordered'
        && entry.event?.payload?.playerId === '0'
        && entry.event?.payload?.deckUids?.length === 3
        && entry.event?.payload?.deckUids?.includes('fetch-minion-a')
        && entry.event?.payload?.deckUids?.includes('fetch-minion-b')
        && entry.event?.payload?.deckUids?.includes('fetch-tail')
    ))).toBe(true);
    expect(finalState.sys?.interaction?.current).toBeFalsy();
    expect(finalState.core.triggerQueue ?? []).toHaveLength(0);
    await game.screenshot('44-我不知道要拿什么-两张行动入手并洗回其余牌', testInfo);
  });

  test('我不知道能去何处从真实打出入口选择基地并分别洗回其他玩家随从', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      numPlayers: 3,
      p0: 'russian_fairy_tales,ninjas',
      p1: 'pirates,dinosaurs',
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
          { uid: 'go-card', defId: 'russian_fairy_tales_go_i_know_not_whither', type: 'action', owner: '0' },
        ],
        deck: [],
        discard: [],
        factions: ['russian_fairy_tales', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player1: {
        hand: [],
        deck: [
          { uid: 'p1-deck', defId: 'pirate_first_mate', type: 'minion', owner: '1' },
        ],
        discard: [],
        factions: ['pirates', 'dinosaurs'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player2: {
        hand: [],
        deck: [
          { uid: 'p2-deck', defId: 'alien_invader', type: 'minion', owner: '2' },
        ],
        discard: [],
        factions: ['aliens', 'robots'],
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
            { uid: 'own-minion', defId: 'russian_fairy_tales_tsar_eagle', owner: '0', controller: '0', power: 2 },
            { uid: 'p1-minion', defId: 'pirate_first_mate', owner: '1', controller: '1', power: 2 },
            { uid: 'p2-minion', defId: 'alien_invader', owner: '2', controller: '2', power: 3 },
          ],
        },
        { defId: 'base_giant_turnip', minions: [] },
      ],
    });

    await page.evaluate(async () => {
      const harness = (window as any).__BG_TEST_HARNESS__;
      const state = harness.state.get();
      const player2 = state.core.players?.['2'];
      if (!player2) throw new Error('三人局缺少玩家 2 状态');
      await harness.state.patch({
        core: {
          players: {
            ...state.core.players,
            '2': {
              ...player2,
              deck: [
                { uid: 'p2-deck', defId: 'alien_invader', type: 'minion', owner: '2' },
              ],
            },
          },
        },
      });
    });

    await game.waitForPhase('playCards');
    await assertCardVisualReady(page, 'go-card');
    await assertCardVisualReady(page, 'own-minion');
    await assertCardVisualReady(page, 'p1-minion');
    await assertCardVisualReady(page, 'p2-minion');
    await game.screenshot('45-我不知道能去何处-真实打出前', testInfo);

    const actionCard = page.locator('[data-card-uid="go-card"]').first();
    await actionCard.click({ force: true });
    await expect(actionCard).toHaveAttribute('data-selected', 'true');
    await expect(page.locator('[data-base-index="0"]')).toHaveAttribute('data-selectable', 'true');
    await expect(page.locator('[data-base-index="1"]')).toHaveAttribute('data-selectable', 'true');
    await game.screenshot('46-我不知道能去何处-选择基地', testInfo);

    const targetBase = page.locator('[data-base-index="0"]').first();
    await expect(targetBase).toBeVisible({ timeout: 10000 });
    await targetBase.click({ force: true });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    const finalState = await game.getState();
    expect(finalState.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid)).toEqual(['own-minion']);
    expect(finalState.core.players['1']?.deck?.map((card: { uid?: string }) => card.uid)).toEqual(expect.arrayContaining([
      'p1-deck',
      'p1-minion',
    ]));
    expect(finalState.core.players['1']?.deck).toHaveLength(2);
    expect(finalState.core.players['2']?.deck?.map((card: { uid?: string }) => card.uid)).toEqual(expect.arrayContaining([
      'p2-deck',
      'p2-minion',
    ]));
    expect(finalState.core.players['2']?.deck).toHaveLength(2);
    expect(finalState.core.players['0']?.deck).toEqual([]);
    expect(finalState.core.players['0']?.discard?.map((card: { uid?: string }) => card.uid)).toEqual(['go-card']);
    for (const [uid, ownerId] of [['p1-minion', '1'], ['p2-minion', '2']] as const) {
      expect((finalState.sys?.eventStream?.entries ?? []).some((entry: any) => (
        entry.event?.type === 'su:card_to_deck_bottom'
          && entry.event?.payload?.cardUid === uid
          && entry.event?.payload?.ownerId === ownerId
          && entry.event?.payload?.sourcePlayerId === '0'
          && entry.event?.payload?.sourceDefId === 'russian_fairy_tales_go_i_know_not_whither'
          && entry.event?.payload?.sourceBaseIndex === 0
      ))).toBe(true);
    }
    expect((finalState.sys?.eventStream?.entries ?? []).filter((entry: any) => (
      entry.event?.type === 'su:deck_reordered'
        && ['1', '2'].includes(entry.event?.payload?.playerId)
        && entry.event?.payload?.deckUids?.includes(entry.event?.payload?.playerId === '1' ? 'p1-minion' : 'p2-minion')
    ))).toHaveLength(2);
    expect(finalState.sys?.interaction?.current).toBeFalsy();
    expect(finalState.core.triggerQueue ?? []).toHaveLength(0);
    await game.screenshot('47-我不知道能去何处-其他玩家随从分别回到拥有者牌库', testInfo);
  });

  test('去看看我妹妹从真实打出入口附着基地，并在己方随从打出后手动选择反应抽牌', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'russian_fairy_tales,ninjas',
      p1: 'pirates,dinosaurs',
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
          { uid: 'sister-card', defId: 'russian_fairy_tales_go_see_my_sister', type: 'action', owner: '0' },
          { uid: 'play-minion', defId: 'pirate_first_mate', type: 'minion', owner: '0' },
        ],
        deck: [
          { uid: 'draw-card', defId: 'russian_fairy_tales_the_water_of_life', type: 'action', owner: '0' },
        ],
        discard: [],
        factions: ['russian_fairy_tales', 'ninjas'],
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
        factions: ['pirates', 'dinosaurs'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      bases: [
        { defId: 'base_the_mothership', minions: [] },
        { defId: 'base_the_factory', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await assertCardVisualReady(page, 'sister-card');
    await assertCardVisualReady(page, 'play-minion');
    await game.screenshot('48-去看看我妹妹-真实打出前', testInfo);

    await game.playCard('russian_fairy_tales_go_see_my_sister', { targetBaseIndex: 0 });
    await game.waitForNoInteraction(10000);
    const attachedState = await game.getState();
    expect(attachedState.core.bases[0]?.ongoingActions?.some((action: { uid?: string }) => action.uid === 'sister-card')).toBe(true);
    await game.screenshot('49-去看看我妹妹-附着到第一座基地', testInfo);

    await game.playCard('pirate_first_mate', { targetBaseIndex: 0 });
    await game.waitForInteraction('smashup_reaction_choose', 15000);
    const reactionState = await game.getState();
    const sisterTrigger = (reactionState.core.triggerQueue ?? []).find((trigger: { sourceDefId?: string }) => (
      trigger.sourceDefId === 'russian_fairy_tales_go_see_my_sister'
    ));
    expect(sisterTrigger, '反应窗口应包含去看看我妹妹的触发项').toBeTruthy();
    await game.screenshot('50-去看看我妹妹-选择反应触发', testInfo);
    await game.selectInteractionOptionBy(
      option => option.value?.triggerId === sisterTrigger?.id,
      '选择去看看我妹妹反应',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    const finalState = await game.getState();
    expect(finalState.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid)).toEqual(['play-minion']);
    expect(finalState.core.bases[0]?.ongoingActions?.map((action: { uid?: string }) => action.uid)).toEqual(['sister-card']);
    expect(finalState.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid)).toEqual(['draw-card']);
    expect(finalState.core.players['0']?.deck).toEqual([]);
    expect(finalState.core.players['0']?.discard).toEqual([]);
    expect(finalState.sys?.interaction?.current).toBeFalsy();
    expect(finalState.core.triggerQueue ?? []).toHaveLength(0);
    await game.screenshot('51-去看看我妹妹-反应抽牌并收口', testInfo);
  });
});
