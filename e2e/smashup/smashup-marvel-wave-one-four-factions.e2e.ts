import { test, expect } from '../framework';
import type { Page } from '@playwright/test';
import { setChineseLocale } from '../helpers/common';

const MARVEL_ATLAS_ID = 'smashup:marvel-wave-one-cards';
const MARVEL_UNIQUE_CARD_COUNT_BY_FACTION: Record<string, number> = {
  avengers: 18,
  shield: 12,
  spider_verse: 12,
  ultimates: 12,
};

type InteractionOption = {
  id?: string;
  label?: string;
  value?: unknown;
};

type InteractionOptionValue = {
  baseIndex?: unknown;
  cardUid?: string;
  minionUid?: string;
};

function getInteractionOptionValue(option: InteractionOption): InteractionOptionValue {
  const value = option.value;
  return value && typeof value === 'object' ? value as InteractionOptionValue : {};
}

function optionHasBaseIndex(option: InteractionOption, baseIndex: number): boolean {
  return getInteractionOptionValue(option).baseIndex === baseIndex;
}

async function assertAtlasLoaded(page: Page, atlasId: string, minCardCount: number): Promise<void> {
  await expect.poll(async () => page.evaluate((expectedAtlasId) => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(
      `[data-card-atlas-id="${expectedAtlasId}"]`,
    ));
    return {
      count: nodes.length,
      shimmerCount: nodes.filter(node => node.classList.contains('atlas-shimmer')).length,
      loadedCount: nodes.filter(node => Boolean(node.querySelector('img[data-card-atlas-img="true"]'))).length,
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
      loadedCount: nodes.filter(node => Boolean(node.querySelector('img[data-card-atlas-img="true"]'))).length,
    };
  }, atlasId);
  expect(summary.count).toBeGreaterThanOrEqual(minCardCount);
  expect(summary.loadedCount).toBe(summary.count);
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

async function assertNoAtlasShimmer(page: Page, timeout = 90000): Promise<void> {
  await expect.poll(async () => page.evaluate(() => (
    Array.from(document.querySelectorAll<HTMLElement>('.atlas-shimmer')).map(node => ({
      atlasId: node.dataset.cardAtlasId ?? null,
      atlasIndex: node.dataset.cardAtlasIndex ?? null,
      title: node.title || null,
    }))
  )), { timeout }).toEqual([]);
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
    beforeConfirm?: () => Promise<void>;
  },
): Promise<void> {
  await waitForDraftTurn(page, options.playerId, options.selectedCountBeforePick);
  const faction = page.getByTestId(`faction-option-${options.factionId}`);
  await faction.scrollIntoViewIfNeeded({ timeout: 15000 });
  await expect(faction).toBeVisible({ timeout: 15000 });
  await faction.click();
  await expect(page.getByTestId('faction-detail-panel')).toBeVisible({ timeout: 10000 });
  await assertAtlasLoaded(page, MARVEL_ATLAS_ID, MARVEL_UNIQUE_CARD_COUNT_BY_FACTION[options.factionId] ?? 12);
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

async function playActionOnMinion(page: Page, cardUid: string, minionUid: string): Promise<void> {
  await page.locator(`[data-card-uid="${cardUid}"]`).click();
  await page.waitForTimeout(300);

  const optionId = await page.evaluate((targetMinionUid) => {
    const harness = (window as Window & {
      __BG_TEST_HARNESS__?: { state?: { get?: () => unknown } };
    }).__BG_TEST_HARNESS__;
    const state = harness?.state?.get?.() as {
      sys?: {
        interaction?: {
          current?: {
            data?: { options?: Array<{ id?: string; value?: { minionUid?: string } }> };
          };
        };
      };
    } | undefined;
    const options = state?.sys?.interaction?.current?.data?.options ?? [];
    return options.find(option => option.value?.minionUid === targetMinionUid)?.id ?? null;
  }, minionUid);
  if (optionId) {
    await page.getByTestId(`interaction-option-${optionId}`).click();
    await page.waitForTimeout(300);
    return;
  }

  const target = page.locator(`[data-minion-uid="${minionUid}"]`);
  const box = await target.boundingBox();
  if (!box) throw new Error(`Target minion ${minionUid} not visible`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.18);
  await page.waitForTimeout(300);
}

async function dismissSpotlightIfPresent(page: Page): Promise<void> {
  const spotlightQueue = page.getByTestId('card-spotlight-queue');
  if (await spotlightQueue.isVisible({ timeout: 300 }).catch(() => false)) {
    await spotlightQueue.click({ force: true });
    await page.waitForTimeout(200);
  }
}

test.describe('大杀四方漫威第一波四派系真实入口验证', () => {
  test('派系选择页能看到复仇者、神盾局、蜘蛛宇宙、终极战队，并加载共享漫威图集', async ({ page, game }, testInfo) => {
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

    for (const factionId of ['avengers', 'shield', 'spider_verse', 'ultimates']) {
      await closeFactionDetailIfPresent(page);
      const option = page.getByTestId(`faction-option-${factionId}`);
      await option.scrollIntoViewIfNeeded({ timeout: 15000 });
      await expect(option).toBeVisible({ timeout: 15000 });
      await option.click();
      await assertAtlasLoaded(page, MARVEL_ATLAS_ID, MARVEL_UNIQUE_CARD_COUNT_BY_FACTION[factionId] ?? 12);
      await option.screenshot({ path: testInfo.outputPath(`marvel-wave-one-faction-option-${factionId}.png`) });
    }
    await game.screenshot('marvel-wave-one-faction-selection-visible', testInfo);
  });

  test('四派系真实选秀后可开局并完成代表能力链', async ({ page, game }, testInfo) => {
    test.setTimeout(240000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      seed: 20260712,
      seat1ManualSetup: true,
    }, 45000);
    await expect(page.locator('[data-tutorial-id="su-faction-select"]')).toBeVisible({ timeout: 30000 });

    await pickFaction(page, {
      playerId: '0',
      selectedCountBeforePick: 0,
      factionId: 'avengers',
      beforeConfirm: () => game.screenshot('01-复仇者-派系预览', testInfo),
    });
    await pickFaction(page, {
      playerId: '1',
      selectedCountBeforePick: 0,
      factionId: 'spider_verse',
      beforeConfirm: () => game.screenshot('02-蜘蛛宇宙-派系预览', testInfo),
    });
    await pickFaction(page, {
      playerId: '1',
      selectedCountBeforePick: 1,
      factionId: 'ultimates',
      beforeConfirm: () => game.screenshot('03-终极战队-派系预览', testInfo),
    });
    await pickFaction(page, {
      playerId: '0',
      selectedCountBeforePick: 1,
      factionId: 'shield',
      beforeConfirm: () => game.screenshot('04-神盾局-派系预览', testInfo),
    });

    await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 30000 });
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        p0: [...(state?.core?.players?.['0']?.factions ?? [])].sort(),
        p1: [...(state?.core?.players?.['1']?.factions ?? [])].sort(),
      };
    }, { timeout: 20000 }).toEqual({
      p0: ['avengers', 'shield'],
      p1: ['spider_verse', 'ultimates'],
    });
    await assertNoAtlasShimmer(page);
    await game.screenshot('05-漫威四派-真实选秀开局完成', testInfo);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'p0-tactical-advantage', defId: 'avengers_tactical_advantage', type: 'action', owner: '0' },
          { uid: 'p0-shield-together', defId: 'shield_together', type: 'action', owner: '0' },
          { uid: 'p0-spider-sense', defId: 'spider_verse_spider_sense', type: 'action', owner: '0' },
          { uid: 'p0-power-speed', defId: 'ultimates_power_and_speed', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'p0-deck-a', defId: 'avengers_hulk', type: 'minion', owner: '0' },
          { uid: 'p0-deck-b', defId: 'shield_agent', type: 'minion', owner: '0' },
        ],
        factions: ['avengers', 'shield'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 4,
      },
      player1: {
        hand: [],
        deck: [],
        discard: [],
        factions: ['spider_verse', 'ultimates'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      bases: [
        {
          defId: 'base_juice_bar',
          minions: [
            { uid: 'p0-avenger-target', defId: 'avengers_black_widow', owner: '0', controller: '0', power: 5 },
            { uid: 'p0-shield-agent', defId: 'shield_agent', owner: '0', controller: '0', power: 2 },
            { uid: 'p0-ultimate-target', defId: 'ultimates_blue_marvel', owner: '0', controller: '0', power: 2 },
          ],
        },
        {
          defId: 'base_moon_dumpster',
          minions: [],
        },
      ],
    });

    await assertNoAtlasShimmer(page);
    await game.screenshot('06-漫威代表能力-触发前', testInfo);

    await playActionOnMinion(page, 'p0-tactical-advantage', 'p0-avenger-target');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const target = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'p0-avenger-target');
      return (target?.tempPowerModifier ?? 0) + (target?.powerModifier ?? 0);
    }, { timeout: 5000 }).toBeGreaterThanOrEqual(3);
    await game.screenshot('07-复仇者-战术优势加力后', testInfo);

    await game.playCard('shield_together');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const agent = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'p0-shield-agent');
      return (agent?.tempPowerModifier ?? 0) + (agent?.powerModifier ?? 0);
    }, { timeout: 5000 }).toBeGreaterThanOrEqual(1);
    await game.screenshot('08-神盾局-并肩作战加力后', testInfo);

    await game.playCard('spider_verse_spider_sense');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        handHasDeckA: state.core.players['0']?.hand?.some((card: { uid?: string }) => card.uid === 'p0-deck-a') ?? false,
        handHasDeckB: state.core.players['0']?.hand?.some((card: { uid?: string }) => card.uid === 'p0-deck-b') ?? false,
      };
    }, { timeout: 5000 }).toEqual({ handHasDeckA: true, handHasDeckB: true });
    await game.screenshot('09-蜘蛛宇宙-蜘蛛感应抽牌后', testInfo);

    await game.playCard('ultimates_power_and_speed', { targetMinionUid: 'p0-ultimate-target' });
    await game.waitForInteraction('ultimates_power_and_speed_move', 10000);
    await game.selectInteractionOptionBy(option => optionHasBaseIndex(option, 1), '终极战队力量与速度移动到第二个基地');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        base0HasTarget: state.core.bases[0]?.minions.some((minion: { uid?: string }) => minion.uid === 'p0-ultimate-target') ?? false,
        base1HasTarget: state.core.bases[1]?.minions.some((minion: { uid?: string }) => minion.uid === 'p0-ultimate-target') ?? false,
      };
    }, { timeout: 5000 }).toEqual({ base0HasTarget: false, base1HasTarget: true });
    await assertNoAtlasShimmer(page);
    await game.screenshot('10-终极战队-力量与速度移动后', testInfo);
  });

  test('蜘蛛宇宙-能力越大…-真实计分前响应只应选择当前基地角色并提供+2力量', async ({ page, game }, testInfo) => {
    test.setTimeout(150000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      extra: {
        core: {
          turnOrder: ['0', '1'],
          currentPlayerIndex: 0,
          turnNumber: 1,
          nextUid: 1000,
          players: {
            '0': {
              id: '0',
              vp: 0,
              hand: [
                { uid: 'great-power-hand', defId: 'spider_verse_with_great_power', type: 'action', owner: '0' },
              ],
              deck: [],
              discard: [],
              factions: ['spider_verse'],
              minionsPlayed: 1,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [],
              deck: [],
              discard: [],
              factions: ['shield'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_juice_bar',
              breakpoint: 20,
              minions: [
                {
                  uid: 'great-power-here',
                  defId: 'spider_verse_spider_man_2099',
                  controller: '0',
                  owner: '0',
                  basePower: 18,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'great-power-enemy-here',
                  defId: 'shield_agent',
                  controller: '1',
                  owner: '1',
                  basePower: 2,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
              ],
              ongoingActions: [],
            },
            {
              defId: 'base_moon_dumpster',
              breakpoint: 20,
              minions: [{
                uid: 'great-power-there',
                defId: 'shield_agent',
                controller: '1',
                owner: '1',
                basePower: 2,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [],
              }],
              ongoingActions: [],
            },
          ],
        },
      },
    });

    await game.waitForPhase('playCards', 10000);
    await game.advancePhase();
    await game.waitForPhase('scoreBases', 10000);

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const options = (prompt?.data?.options ?? []) as InteractionOption[];
      return {
        sourceId: prompt?.data?.sourceId ?? null,
        hasGreatPower: options.some(option => getInteractionOptionValue(option).cardUid === 'great-power-hand'),
      };
    }, { timeout: 15000 }).toEqual({
      sourceId: 'smashup_reaction_choose',
      hasGreatPower: true,
    });
    await game.screenshot('11-能力越大-计分前响应入口', testInfo);
    await game.playCard('spider_verse_with_great_power', { targetBaseIndex: 0 });
    await game.waitForInteraction('spider_verse_with_great_power', 10000);

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionValues = ((prompt?.data?.options ?? []) as InteractionOption[])
        .map(option => getInteractionOptionValue(option));
      return {
        sourceId: prompt?.data?.sourceId ?? null,
        playerId: prompt?.playerId ?? null,
        optionMinionUids: optionValues.map(option => option.minionUid).filter(Boolean).sort(),
      };
    }, {
      message: '能力越大…作为计分前特殊打出后，只应列当前计分基地上的角色',
      timeout: 15000,
    }).toEqual({
      sourceId: 'spider_verse_with_great_power',
      playerId: '0',
      optionMinionUids: ['great-power-enemy-here', 'great-power-here'],
    });

    await expect(page.locator('[data-minion-uid="great-power-here"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="great-power-there"]')).toBeVisible({ timeout: 15000 });
    await game.screenshot('12-能力越大-当前基地角色选择窗', testInfo);
    await game.selectInteractionOptionBy(
      (option: InteractionOption) => getInteractionOptionValue(option).minionUid === 'great-power-here',
      '能力越大…选择当前基地己方角色',
    );

    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const here = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'great-power-here');
      const there = state.core.bases[1]?.minions.find((minion: { uid?: string }) => minion.uid === 'great-power-there');
      return {
        hereBonus: (here?.tempPowerModifier ?? 0) + (here?.powerModifier ?? 0),
        thereBonus: (there?.tempPowerModifier ?? 0) + (there?.powerModifier ?? 0),
        interactionSource: state?.sys?.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      hereBonus: 2,
      thereBonus: 0,
      interactionSource: null,
    });
    await game.screenshot('13-能力越大-选择后当前基地角色加2', testInfo);
  });
});
