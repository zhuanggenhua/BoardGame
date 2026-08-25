import { test, expect } from '../framework';
import { setChineseLocale } from '../helpers/common';
import { clearEvidenceScreenshotsForTest } from '../framework/evidenceScreenshots';
import { SU_COMMANDS } from '../../src/games/smashup/domain/types';

type SmashUpE2EState = {
  core: {
    turnOrder: string[];
    currentPlayerIndex: number;
    madnessDeck?: string[];
    bases: Array<{
      defId: string;
      minions: Array<{
        uid: string;
        defId: string;
        metadata?: Record<string, unknown>;
      }>;
      ongoingActions?: Array<{
        uid: string;
        defId: string;
        ownerId: string;
      }>;
    }>;
    players: Record<string, {
      deck: Array<{ uid: string; defId: string }>;
      hand: Array<{ uid: string; defId: string }>;
      discard: Array<{ uid: string; defId: string }>;
      storedCards?: Array<{
        uid: string;
        defId: string;
        type: 'minion' | 'action';
        owner: string;
        storedByPlayerId: string;
        counters?: number;
        reason: string;
      }>;
      minionsPlayed?: number;
      minionLimit?: number;
      actionsPlayed?: number;
      actionLimit?: number;
      specificExtraMinionPlays?: Array<{
        cardUid: string;
        restrictToBase?: number;
        powerMax?: number;
      }>;
    }>;
  };
  sys: {
    phase?: string;
    interaction?: { current?: unknown } | null;
    responseWindow?: { current?: unknown } | null;
  };
};

const FIVE_FACTIONS = [
  { id: 'action_heroes', name: '动作英雄', baseSlots: [0, 1] },
  { id: 'backtimers', name: '返时者', baseSlots: [2, 3] },
  { id: 'extramorphs', name: '异形变体', baseSlots: [4, 5] },
  { id: 'teens', name: '青少年', baseSlots: [6, 7] },
  { id: 'wraithrustlers', name: '怨灵捕手', baseSlots: [8, 9] },
] as const;

const EXCELLENT_MOVIES_TEENS_BASE_ATLAS = 'smashup:excellent-movies-teens-bases';
const FOUR_PLAYER_STASIS_BASE_IDS = [
  'base_alternate_present',
  'base_the_jungle',
  'base_the_mothership',
  'base_central_brain',
  'base_tortuga',
] as const;
const FOUR_PLAYER_STASIS_BASE_INDICES = [0, 1, 2, 3, 4] as const;

test.describe('SmashUp Excellent Movies + Teens 五派系真实入口验证', () => {
  test('派系选择页可看到五个已完成派系，并能显示卡牌与基地详情', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await clearEvidenceScreenshotsForTest(testInfo);

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
            '0': { id: '0', vp: 0, hand: [], deck: [], discard: [], factions: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1 },
            '1': { id: '1', vp: 0, hand: [], deck: [], discard: [], factions: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1 },
          },
          factionSelection: {
            takenFactions: [],
            playerSelections: { '0': [], '1': [] },
            completedPlayers: [],
          },
        },
      },
    });

    const searchInput = page.getByTestId('faction-search-input');
    await expect(searchInput).toBeVisible({ timeout: 15000 });

    for (const faction of FIVE_FACTIONS) {
      await searchInput.fill(faction.name);
      const option = page.getByTestId(`faction-option-${faction.id}`);
      await option.scrollIntoViewIfNeeded({ timeout: 15000 });
      await expect(option).toBeVisible({ timeout: 15000 });
      await expect(option.locator('.atlas-shimmer')).toHaveCount(0, { timeout: 15000 });

      await option.click();
      const detailPanel = page.getByTestId('faction-detail-panel');
      await expect(detailPanel).toBeVisible({ timeout: 15000 });
      await expect(detailPanel).toContainText(faction.name, { timeout: 15000 });
      await expect(detailPanel.locator('.atlas-shimmer')).toHaveCount(0, { timeout: 15000 });
      await expect(page.getByTestId('faction-detail-implementation-banner'), `${faction.name} 不应再显示实施中横幅`)
        .toHaveCount(0);
      await expect(page.getByTestId('faction-preview-card').first(), `${faction.name} 应显示卡牌预览`)
        .toBeVisible({ timeout: 15000 });
      await detailPanel.getByRole('tab', { name: /基地/ }).click();
      const baseCards = page.getByTestId('faction-base-card');
      await expect(baseCards.first(), `${faction.name} 应显示基地图集预览`)
        .toBeVisible({ timeout: 15000 });
      for (const [index, baseSlot] of faction.baseSlots.entries()) {
        const atlasFrame = baseCards.nth(index).locator('[data-card-atlas-frame="true"]');
        await expect(atlasFrame, `${faction.name} 基地 ${index + 1} 应使用 Excellent Movies + Teens 基地图集`)
          .toHaveAttribute('data-card-atlas-id', EXCELLENT_MOVIES_TEENS_BASE_ATLAS);
        await expect(atlasFrame, `${faction.name} 基地 ${index + 1} 应使用正确 atlas 槽位`)
          .toHaveAttribute('data-card-atlas-index', String(baseSlot));
        await expect(atlasFrame.locator('[data-card-atlas-img="true"]'), `${faction.name} 基地 ${index + 1} 应加载 atlas 图片`)
          .toBeVisible({ timeout: 15000 });
      }

      await game.screenshot(`${faction.name}派系详情面板`, testInfo);

      await page.getByTestId('faction-detail-close').click();
      await expect(detailPanel).toHaveCount(0, { timeout: 10000 });
      await searchInput.fill('');
    }
  });

  test('异形变体蛋田天赋在真实页面中创建牌库额外随从提示，并能打出抱胸怪', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
    await setChineseLocale(page.context());
    await clearEvidenceScreenshotsForTest(testInfo);

    await game.openTestGame('smashup', {
      p0: 'extramorphs,action_heroes',
      p1: 'teens,wraithrustlers',
      skipFactionSelect: true,
      skipInitialization: true,
      seed: 20260803,
    }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        factions: ['extramorphs', 'action_heroes'],
        hand: [],
        deck: [
          { uid: 'alien-life', defId: 'extramorphs_alien_life_form', type: 'minion', owner: '0' },
          { uid: 'chestbreaker', defId: 'extramorphs_chestbreaker', type: 'minion', owner: '0' },
        ],
        discard: [],
        minionsPlayed: 1,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: {
        factions: ['teens', 'wraithrustlers'],
        hand: [],
        deck: [],
        discard: [],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      bases: [
        {
          defId: 'base_the_jungle',
          minions: [],
          ongoingActions: [{ uid: 'egg-field', defId: 'extramorphs_egg_field', ownerId: '0' }],
        },
      ],
    });

    await game.waitForPhase('playCards');
    await expect(page.getByTestId('base-zone-0')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-ongoing-uid="egg-field"]')).toBeVisible({ timeout: 15000 });
    await game.screenshot('异形变体蛋田天赋发动前', testInfo);

    await page.evaluate(async (commandType) => {
      const harness = (window as any).__BG_TEST_HARNESS__;
      await harness.command.dispatch({
        type: commandType,
        playerId: '0',
        payload: { ongoingCardUid: 'egg-field', baseIndex: 0 },
      });
    }, SU_COMMANDS.USE_TALENT);

    await expect.poll(async () => {
      const state = await game.getState() as SmashUpE2EState;
      return {
        deckUids: state.core.players['0'].deck.map(card => card.uid),
        specificExtraMinionPlays: state.core.players['0'].specificExtraMinionPlays,
        interactionOpen: Boolean(state.sys.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      deckUids: ['chestbreaker', 'alien-life'],
      specificExtraMinionPlays: [
        expect.objectContaining({ cardUid: 'chestbreaker', restrictToBase: 0, powerMax: 2 }),
      ],
      interactionOpen: false,
    });

    await expect(page.getByTestId('su-deck-stack')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('su-deck-stack').click();
    await expect(page.getByTestId('base-zone-0')).toHaveAttribute('data-deploy-mode', 'true', { timeout: 10000 });
    await expect(page.getByTestId('base-zone-0')).toHaveAttribute('data-selectable', 'true', { timeout: 10000 });
    await game.screenshot('异形变体蛋田选择牌库顶抱胸怪目标基地', testInfo);

    await page.getByTestId('base-zone-0').click();
    await game.waitForNoInteraction(10000);
    await game.screenshot('异形变体蛋田打出抱胸怪后', testInfo);

    await expect.poll(async () => {
      const state = await game.getState() as SmashUpE2EState;
      return {
        deckUids: state.core.players['0'].deck.map(card => card.uid),
        minionUids: state.core.bases[0].minions.map(minion => minion.uid),
        playedFrom: state.core.bases[0].minions.find(minion => minion.uid === 'chestbreaker')?.metadata?.playedFrom,
        minionsPlayed: state.core.players['0'].minionsPlayed,
        minionLimit: state.core.players['0'].minionLimit,
        specificExtraMinionPlays: state.core.players['0'].specificExtraMinionPlays,
        interactionOpen: Boolean(state.sys.interaction?.current),
        responseWindowOpen: Boolean(state.sys.responseWindow?.current),
      };
    }, { timeout: 10000 }).toEqual({
      deckUids: ['alien-life'],
      minionUids: ['chestbreaker'],
      playedFrom: 'deck',
      minionsPlayed: 1,
      minionLimit: 1,
      specificExtraMinionPlays: undefined,
      interactionOpen: false,
      responseWindowOpen: false,
    });
  });

  test('返时者停滞区显示指示物并在回合开始归零后提示额外打出', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await clearEvidenceScreenshotsForTest(testInfo);

    await game.openTestGame('smashup', {
      p0: 'backtimers,teens',
      p1: 'action_heroes,extramorphs',
      skipFactionSelect: true,
      skipInitialization: true,
      seed: 20260823,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '1',
      phase: 'playCards',
      extra: {
        core: {
          turnOrder: ['0', '1'],
          currentPlayerIndex: 1,
          turnNumber: 3,
          nextUid: 5000,
          players: {
            '0': {
              id: '0',
              vp: 0,
              hand: [],
              deck: [],
              discard: [],
              factions: ['backtimers', 'teens'],
              minionsPlayed: 1,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
              storedCards: [{
                uid: 'stasis-zany-prof',
                defId: 'backtimers_zany_prof',
                type: 'minion',
                owner: '0',
                storedByPlayerId: '0',
                counters: 1,
                reason: 'backtimers_stasis',
              }],
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [],
              deck: [],
              discard: [],
              factions: ['action_heroes', 'extramorphs'],
              minionsPlayed: 1,
              minionLimit: 1,
              actionsPlayed: 1,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_alternate_present',
              minions: [],
              ongoingActions: [],
            },
          ],
        },
      },
    });

    await game.waitForPhase('playCards');
    const stasisEntry = page.getByTestId('su-backtimers-stasis-entry');
    await expect(stasisEntry).toBeVisible({ timeout: 15000 });
    await expect(stasisEntry).toHaveAttribute('data-stasis-card-count', '1');
    await expect.poll(async () => stasisEntry.evaluate((element) => Math.round(element.getBoundingClientRect().left)), { timeout: 10000 }).toBeLessThan(260);
    await expect.poll(async () => stasisEntry.evaluate((element) => Math.round(element.getBoundingClientRect().top)), { timeout: 10000 }).toBeLessThan(180);
    await expect(page.getByTestId('su-backtimers-stasis-zone')).toHaveCount(0);
    await stasisEntry.click();
    const stasisZone = page.getByTestId('su-backtimers-stasis-zone');
    const stasisCard = page.locator('[data-stasis-card-uid="stasis-zany-prof"]');
    await expect(stasisZone).toBeVisible({ timeout: 15000 });
    await expect(stasisZone).toHaveAttribute('data-stasis-anchor', 'top-left-hud');
    await expect(stasisZone).toContainText('停滞区');
    await expect(stasisCard).toBeVisible({ timeout: 15000 });
    await expect(stasisCard).toHaveAttribute('data-stasis-counters', '1');
    await expect(stasisCard).not.toContainText('停滞 × 1');
    await expect(page.getByTestId('su-backtimers-stasis-badge-stasis-zany-prof')).toHaveText('停滞');
    await expect(page.getByTestId('su-backtimers-stasis-counter-stasis-zany-prof')).toHaveText('1');
    await expect.poll(async () => {
      return page.getByTestId('su-backtimers-stasis-zone').evaluate((element) => Math.round(element.getBoundingClientRect().width));
    }, { timeout: 10000 }).toBeLessThanOrEqual(260);
    await game.screenshot('返时者停滞入口展开后显示1个指示物', testInfo);

    await page.evaluate(async () => {
      const harness = (window as any).__BG_TEST_HARNESS__;
      await harness.command.dispatch({
        type: 'ADVANCE_PHASE',
        playerId: '1',
        payload: {},
      });
    });

    await game.waitForInteraction('smashup_immediate_extra_minion', 15000);
    await expect(page.getByTestId('prompt-card-grid')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="stored-card-0"]')).toBeVisible({ timeout: 15000 });
    await game.screenshot('返时者回合开始归零后额外打出提示', testInfo);

    const firstOptions = await game.getInteractionOptions();
    const storedOption = firstOptions.find((option: any) => option.value?.cardUid === 'stasis-zany-prof' && option.value?.source === 'stored');
    expect(storedOption, '返时者归零停滞牌应作为 stored 来源的额外随从选项出现').toBeTruthy();
    await game.selectOption(storedOption.id);

    await game.waitForInteraction('smashup_immediate_extra_minion_base', 15000);
    const baseOptions = await game.getInteractionOptions();
    const baseOption = baseOptions.find((option: any) => option.value?.baseIndex === 0);
    expect(baseOption, '返时者停滞牌应能选择基地打出').toBeTruthy();
    await game.selectOption(baseOption.id);
    await game.waitForNoInteraction(15000);

    await expect(page.locator('[data-minion-uid="stasis-zany-prof"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-stasis-card-uid="stasis-zany-prof"]')).toHaveCount(0, { timeout: 15000 });
    await game.screenshot('返时者额外打出后停滞区清空', testInfo);

    await expect.poll(async () => {
      const state = await game.getState() as SmashUpE2EState;
      return {
        stasisCards: state.core.players['0'].storedCards ?? [],
        minionUids: state.core.bases[0].minions.map(minion => minion.uid),
        minionsPlayed: state.core.players['0'].minionsPlayed,
        interactionOpen: Boolean(state.sys.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      stasisCards: [],
      minionUids: ['stasis-zany-prof'],
      minionsPlayed: 0,
      interactionOpen: false,
    });
  });

  test('返时者四人多停滞只处理当前玩家并保留多个额外打出提示', async ({ page, game }, testInfo) => {
    test.setTimeout(150000);
    await setChineseLocale(page.context());
    await clearEvidenceScreenshotsForTest(testInfo);

    await game.openTestGame('smashup', {
      players: 4,
      playerID: '0',
      seat0: 'human',
      seat1: 'human',
      seat2: 'human',
      seat3: 'human',
      disableLocalAiAutomation: true,
      skipInitialization: true,
      seed: 20260824,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '3',
      phase: 'endTurn',
      bases: FOUR_PLAYER_STASIS_BASE_IDS.map(defId => ({
        defId,
        minions: [],
        ongoingActions: [],
      })),
      extra: {
        core: {
          turnOrder: ['0', '1', '2', '3'],
          currentPlayerIndex: 3,
          turnNumber: 8,
          nextUid: 9000,
          madnessDeck: Array.from({ length: 30 }, () => 'special_madness'),
          players: {
            '0': {
              id: '0',
              vp: 0,
              hand: [],
              deck: [],
              discard: [],
              factions: ['backtimers', 'teens'],
              minionsPlayed: 1,
              minionLimit: 1,
              actionsPlayed: 1,
              actionLimit: 1,
              storedCards: [
                {
                  uid: 'p0-release-a',
                  defId: 'backtimers_sidelined_girlfriend',
                  type: 'minion',
                  owner: '0',
                  storedByPlayerId: '0',
                  counters: 1,
                  reason: 'backtimers_stasis',
                },
                {
                  uid: 'p0-release-b',
                  defId: 'backtimers_zany_prof',
                  type: 'minion',
                  owner: '0',
                  storedByPlayerId: '0',
                  counters: 1,
                  reason: 'backtimers_stasis',
                },
                {
                  uid: 'p0-release-action',
                  defId: 'backtimers_future_almanac',
                  type: 'action',
                  owner: '0',
                  storedByPlayerId: '0',
                  counters: 1,
                  reason: 'backtimers_stasis',
                },
                {
                  uid: 'p0-waiting',
                  defId: 'backtimers_lightning_strike',
                  type: 'action',
                  owner: '0',
                  storedByPlayerId: '0',
                  counters: 2,
                  reason: 'backtimers_stasis',
                },
              ],
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [],
              deck: [],
              discard: [],
              factions: ['backtimers', 'action_heroes'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
              storedCards: [{
                uid: 'p1-stasis',
                defId: 'backtimers_sidelined_girlfriend',
                type: 'minion',
                owner: '1',
                storedByPlayerId: '1',
                counters: 1,
                reason: 'backtimers_stasis',
              }],
            },
            '2': {
              id: '2',
              vp: 0,
              hand: [],
              deck: [],
              discard: [],
              factions: ['backtimers', 'extramorphs'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
              storedCards: [{
                uid: 'p2-stasis',
                defId: 'backtimers_future_almanac',
                type: 'action',
                owner: '2',
                storedByPlayerId: '2',
                counters: 1,
                reason: 'backtimers_stasis',
              }],
            },
            '3': {
              id: '3',
              vp: 0,
              hand: [],
              deck: [],
              discard: [],
              factions: ['backtimers', 'wraithrustlers'],
              minionsPlayed: 1,
              minionLimit: 1,
              actionsPlayed: 1,
              actionLimit: 1,
              storedCards: [{
                uid: 'p3-stasis',
                defId: 'backtimers_zany_prof',
                type: 'minion',
                owner: '3',
                storedByPlayerId: '3',
                counters: 1,
                reason: 'backtimers_stasis',
              }],
            },
          },
        },
      },
    });

    await game.waitForPhase('endTurn');
    await expect.poll(async () => {
      const state = await game.getState() as SmashUpE2EState;
      return {
        playerIds: Object.keys(state.core.players).sort(),
        currentPlayerId: state.core.turnOrder[state.core.currentPlayerIndex],
        phase: state.sys.phase,
        baseCount: state.core.bases.length,
        baseDefIds: state.core.bases.map(base => base.defId),
        madnessCount: state.core.madnessDeck?.length ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      playerIds: ['0', '1', '2', '3'],
      currentPlayerId: '3',
      phase: 'endTurn',
      baseCount: 5,
      baseDefIds: [...FOUR_PLAYER_STASIS_BASE_IDS],
      madnessCount: 30,
    });
    const expectSelectorsInsideViewport = async (selectors: string[], label: string) => {
      const clippingIssues = await page.evaluate((targetSelectors) => {
        return targetSelectors.flatMap((selector) => {
          const element = document.querySelector<HTMLElement>(selector);
          if (!element) return [`${selector}: missing`];
          const rect = element.getBoundingClientRect();
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          const isVisible = rect.width > 0 && rect.height > 0;
          const isInside = rect.left >= 0 && rect.top >= 0 && rect.right <= viewportWidth && rect.bottom <= viewportHeight;
          return isVisible && isInside
            ? []
            : [`${selector}: ${Math.round(rect.left)},${Math.round(rect.top)}-${Math.round(rect.right)},${Math.round(rect.bottom)} / ${viewportWidth}x${viewportHeight}`];
        });
      }, selectors);
      expect(clippingIssues, label).toEqual([]);
    };
    const expectSelectorsDoNotOverlap = async (firstSelector: string, secondSelector: string, label: string) => {
      const overlap = await page.evaluate(({ firstSelector, secondSelector }) => {
        const rectOf = (selector: string) => {
          const element = document.querySelector<HTMLElement>(selector);
          if (!element) return null;
          const rect = element.getBoundingClientRect();
          return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
        };
        const first = rectOf(firstSelector);
        const second = rectOf(secondSelector);
        if (!first || !second) return { missing: true, overlaps: true, first, second };
        const overlaps = !(first.right <= second.left || second.right <= first.left || first.bottom <= second.top || second.bottom <= first.top);
        return { missing: false, overlaps, first, second };
      }, { firstSelector, secondSelector });
      expect(overlap.missing, `${label}: selector missing ${JSON.stringify(overlap)}`).toBe(false);
      expect(overlap.overlaps, `${label}: ${JSON.stringify(overlap)}`).toBe(false);
    };

    for (const baseIndex of FOUR_PLAYER_STASIS_BASE_INDICES) {
      await expect(page.getByTestId(`base-zone-${baseIndex}`)).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId(`base-zone-${baseIndex}`)).toHaveAttribute('data-base-index', String(baseIndex));
    }
    await expect(page.getByTestId('su-madness-supply')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('su-madness-supply-count')).toHaveText('x 30');
    const stasisEntry = page.getByTestId('su-backtimers-stasis-entry');
    await expect(stasisEntry).toBeVisible({ timeout: 15000 });
    await expect(stasisEntry).toHaveAttribute('data-stasis-card-count', '7');
    await expect.poll(async () => stasisEntry.evaluate((element) => Math.round(element.getBoundingClientRect().left)), { timeout: 10000 }).toBeLessThan(260);
    await expect.poll(async () => stasisEntry.evaluate((element) => Math.round(element.getBoundingClientRect().top)), { timeout: 10000 }).toBeLessThan(180);
    await expect(page.getByTestId('su-backtimers-stasis-zone')).toHaveCount(0);
    await expectSelectorsDoNotOverlap(
      '[data-testid="su-backtimers-stasis-entry"]',
      '[data-testid="su-turn-tracker"]',
      '停滞入口不能压住左上回合牌',
    );
    await expectSelectorsDoNotOverlap(
      '[data-testid="su-backtimers-stasis-entry"]',
      '[data-testid="su-special-supply-row"]',
      '停滞入口不能压住疯狂牌供应行',
    );
    await expectSelectorsInsideViewport([
      ...FOUR_PLAYER_STASIS_BASE_INDICES.map(baseIndex => `[data-testid="base-zone-${baseIndex}"]`),
      ...FOUR_PLAYER_STASIS_BASE_INDICES.map(baseIndex => `[data-testid="su-base-breakpoint-token-${baseIndex}"]`),
      '[data-testid="su-backtimers-stasis-entry"]',
      '[data-testid="su-special-supply-row"]',
    ], '四人五基地截图中所有基地本体和计分圆都不能被视口裁切');
    await game.screenshot('返时者四人五基地停滞入口初始态', testInfo);
    await stasisEntry.click();
    const stasisZone = page.getByTestId('su-backtimers-stasis-zone');
    await expect(stasisZone).toBeVisible({ timeout: 15000 });
    await expect(stasisZone).toHaveAttribute('data-stasis-anchor', 'top-left-hud');
    await expect(stasisZone).toHaveAttribute('data-stasis-card-count', '7');
    await expectSelectorsInsideViewport([
      '[data-testid="su-backtimers-stasis-entry"]',
      '[data-testid="su-backtimers-stasis-zone"]',
    ], '停滞区展开面板必须从左上公开入口打开且不能被视口裁切');
    for (const [uid, ownerId, counters] of [
      ['p0-release-a', '0', '1'],
      ['p0-release-b', '0', '1'],
      ['p0-release-action', '0', '1'],
      ['p0-waiting', '0', '2'],
      ['p1-stasis', '1', '1'],
      ['p2-stasis', '2', '1'],
      ['p3-stasis', '3', '1'],
    ] as const) {
      const card = page.locator(`[data-stasis-card-uid="${uid}"]`);
      await expect(card).toBeVisible({ timeout: 15000 });
      await expect(card).toHaveAttribute('data-stasis-owner-id', ownerId);
      await expect(card).toHaveAttribute('data-stasis-counters', counters);
    }
    await game.screenshot('返时者四人五基地停滞面板展开', testInfo);

    await page.evaluate(async () => {
      const harness = (window as any).__BG_TEST_HARNESS__;
      const state = harness.state.get();
      const playerId = state.core.turnOrder[state.core.currentPlayerIndex];
      await harness.command.dispatch({
        type: 'ADVANCE_PHASE',
        playerId,
        payload: {},
      });
    });

    await game.waitForInteraction('smashup_immediate_extra_minion', 15000);
    await expect(stasisZone).toHaveAttribute('data-stasis-card-count', '7');
    for (const [uid, counters, ready] of [
      ['p0-release-a', '0', 'true'],
      ['p0-release-b', '0', 'true'],
      ['p0-release-action', '0', 'true'],
      ['p0-waiting', '1', 'false'],
      ['p1-stasis', '1', 'false'],
      ['p2-stasis', '1', 'false'],
      ['p3-stasis', '1', 'false'],
    ] as const) {
      const card = page.locator(`[data-stasis-card-uid="${uid}"]`);
      await expect(card).toHaveAttribute('data-stasis-counters', counters);
      await expect(card).toHaveAttribute('data-stasis-ready', ready);
    }
    await expect(page.getByTestId('prompt-card-grid')).toBeVisible({ timeout: 15000 });
    await game.screenshot('返时者四人五基地回合开始只归零玩家0', testInfo);

    const firstMinionOptions = await game.getInteractionOptions();
    const firstMinionOption = firstMinionOptions.find((option: any) => option.value?.cardUid === 'p0-release-a');
    expect(firstMinionOption, '玩家0第一张归零随从应先获得独立额外打出提示').toBeTruthy();
    await game.selectOption(firstMinionOption.id);

    await game.waitForInteraction('smashup_immediate_extra_minion_base', 15000);
    const firstBaseOptions = await game.getInteractionOptions();
    const firstBaseOption = firstBaseOptions.find((option: any) => option.value?.baseIndex === 0);
    expect(firstBaseOption, '玩家0第一张归零随从应能选择基地打出').toBeTruthy();
    await game.selectOption(firstBaseOption.id);

    await game.waitForInteraction('smashup_immediate_extra_minion', 15000);
    const secondMinionOptions = await game.getInteractionOptions();
    const secondMinionOption = secondMinionOptions.find((option: any) => option.value?.cardUid === 'p0-release-b');
    expect(secondMinionOption, '玩家0第二张归零随从不能被第一张额外打出吞掉').toBeTruthy();
    await expect(page.locator('[data-minion-uid="p0-release-a"]')).toBeVisible({ timeout: 15000 });
    await expectSelectorsInsideViewport(['[data-minion-uid="p0-release-a"]'], '额外打出的第一张随从不能被视口边缘裁切');
    await expect(page.locator('[data-stasis-card-uid="p0-release-a"]')).toHaveCount(0, { timeout: 15000 });
    await expect(page.locator('[data-stasis-card-uid="p0-release-b"]')).toHaveAttribute('data-stasis-ready', 'true');
    await game.screenshot('返时者四人五基地第一张打出后第二张仍提示', testInfo);

    const secondSkipOption = secondMinionOptions.find((option: any) => option.id === 'skip');
    expect(secondSkipOption, '第二个额外随从提示应保留放弃选项').toBeTruthy();
    await game.selectOption(secondSkipOption.id);

    await game.waitForInteraction('smashup_immediate_extra_action', 15000);
    const actionOptions = await game.getInteractionOptions();
    const actionOption = actionOptions.find((option: any) => option.value?.cardUid === 'p0-release-action');
    expect(actionOption, '玩家0归零行动牌应在两个随从机会后继续获得独立额外打出提示').toBeTruthy();
    await expect(page.locator('[data-stasis-card-uid="p1-stasis"]')).toHaveAttribute('data-stasis-counters', '1');
    await expect(page.locator('[data-stasis-card-uid="p2-stasis"]')).toHaveAttribute('data-stasis-counters', '1');
    await expect(page.locator('[data-stasis-card-uid="p3-stasis"]')).toHaveAttribute('data-stasis-counters', '1');
    await game.screenshot('返时者四人五基地行动牌独立提示且其他玩家未处理', testInfo);

    await expect.poll(async () => {
      const state = await game.getState() as SmashUpE2EState;
      const countersByPlayer = Object.fromEntries(Object.entries(state.core.players).map(([playerId, player]) => [
        playerId,
        (player.storedCards ?? []).map(card => [card.uid, card.counters ?? 0]),
      ]));
      return {
        currentPlayerId: state.core.turnOrder[state.core.currentPlayerIndex],
        baseCount: state.core.bases.length,
        countersByPlayer,
        minionUids: state.core.bases[0].minions.map(minion => minion.uid),
        interactionSourceId: (state.sys.interaction?.current as any)?.data?.sourceId,
      };
    }, { timeout: 10000 }).toEqual({
      currentPlayerId: '0',
      baseCount: 5,
      countersByPlayer: {
        '0': [
          ['p0-release-b', 0],
          ['p0-release-action', 0],
          ['p0-waiting', 1],
        ],
        '1': [['p1-stasis', 1]],
        '2': [['p2-stasis', 1]],
        '3': [['p3-stasis', 1]],
      },
      minionUids: ['p0-release-a'],
      interactionSourceId: 'smashup_immediate_extra_action',
    });
  });
});
