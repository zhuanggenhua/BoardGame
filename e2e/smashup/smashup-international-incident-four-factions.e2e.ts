import { test, expect } from '../framework';
import type { Page } from '@playwright/test';
import { setChineseLocale } from '../helpers/common';

const INTERNATIONAL_INCIDENT_ATLAS_ID = 'smashup:international-incident-cards';

type InteractionOption = {
  id?: string;
  value?: unknown;
};

type SmashUpE2EState = {
  core?: {
    currentPlayerIndex?: number;
    turnOrder?: string[];
    factionSelection?: {
      playerSelections?: Record<string, string[]>;
    };
    players?: Record<string, { factions?: string[] }>;
  };
  sys?: {
    phase?: string;
    responseWindow?: {
      current?: {
        windowType?: string;
      };
    };
  };
};

type SmashUpE2EWindow = Window & {
  __BG_TEST_HARNESS__?: {
    state?: {
      get?: () => SmashUpE2EState;
    };
    command?: {
      dispatch?: (command: { type: string; playerId: string; payload?: unknown }) => Promise<unknown> | unknown;
    };
  };
};

function optionHasBaseIndex(option: InteractionOption, baseIndex: number): boolean {
  const value = option.value;
  return !!value && typeof value === 'object' && (value as { baseIndex?: unknown }).baseIndex === baseIndex;
}

function optionHasBaseDefId(option: InteractionOption, baseDefId: string): boolean {
  const value = option.value;
  return !!value && typeof value === 'object' && (value as { baseDefId?: unknown }).baseDefId === baseDefId;
}

function optionHasMinionUid(option: InteractionOption, minionUid: string): boolean {
  const value = option.value;
  return !!value && typeof value === 'object' && (value as { minionUid?: unknown }).minionUid === minionUid;
}

function optionHasCardUid(option: InteractionOption, cardUid: string): boolean {
  const value = option.value;
  return !!value && typeof value === 'object' && (value as { cardUid?: unknown }).cardUid === cardUid;
}

function optionHasTriggerId(option: InteractionOption, triggerIdPart: string): boolean {
  const value = option.value;
  return !!value
    && typeof value === 'object'
    && String((value as { triggerId?: unknown }).triggerId ?? '').includes(triggerIdPart);
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
      const state = (window as SmashUpE2EWindow).__BG_TEST_HARNESS__?.state?.get?.();
      const selection = state?.core?.factionSelection;
      if (!selection) return false;
      const currentPlayerId = state.core?.turnOrder?.[state.core.currentPlayerIndex ?? 0];
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
  await closeFactionDetailIfPresent(page);

  const faction = page.getByTestId(`faction-option-${options.factionId}`);
  await faction.scrollIntoViewIfNeeded({ timeout: 15000 });
  await expect(faction).toBeVisible({ timeout: 15000 });
  await faction.click();
  await expect(page.getByTestId('faction-detail-panel')).toBeVisible({ timeout: 10000 });

  await expect.poll(async () => page.evaluate((atlasId) => (
    document.querySelectorAll(`[data-card-atlas-id="${atlasId}"]`).length
  ), INTERNATIONAL_INCIDENT_ATLAS_ID), { timeout: 20000 }).toBeGreaterThan(0);

  await options.beforeConfirm?.();

  const confirmButton = page.getByTestId('faction-confirm-button');
  await expect(confirmButton).toBeVisible({ timeout: 10000 });
  await expect(confirmButton).toBeEnabled({ timeout: 10000 });
  await confirmButton.click();

  await page.waitForFunction(
    ({ playerId, factionId }) => {
      const state = (window as SmashUpE2EWindow).__BG_TEST_HARNESS__?.state?.get?.();
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
    await spotlightQueue.getByRole('button', { name: /^(关闭特写|Close spotlight)$/i }).click({ force: true });
    await page.waitForTimeout(200);
  }
}

async function playDiscardSpecialOnMinion(page: Page, cardUid: string, minionUid: string): Promise<void> {
  await page.getByTestId('su-discard-toggle').click();
  const discardCard = page.locator(`[data-card-uid="${cardUid}"]`).last();
  await expect(discardCard).toBeVisible({ timeout: 10000 });
  await discardCard.click();
  await page.waitForTimeout(300);

  const target = page.locator(`[data-minion-uid="${minionUid}"]`);
  await expect(target).toBeVisible({ timeout: 10000 });
  await target.click();
  await page.waitForTimeout(300);
}

async function respondCurrentInteraction(
  page: Page,
  payload: { optionId?: string; optionIds?: string[] },
): Promise<void> {
  await page.evaluate(async (responsePayload) => {
    const harness = (window as SmashUpE2EWindow).__BG_TEST_HARNESS__;
    const current = harness?.state?.get?.()?.sys?.interaction?.current;
    if (!current?.playerId || !harness?.command?.dispatch) {
      throw new Error('No active interaction to respond to');
    }
    await harness.command.dispatch({
      type: 'SYS_INTERACTION_RESPOND',
      playerId: current.playerId,
      payload: responsePayload,
    });
  }, payload);
  await page.waitForTimeout(300);
}

async function respondWithOptionIds(
  page: Page,
  game: { getInteractionOptions: () => Promise<InteractionOption[]> },
  matchers: Array<(option: InteractionOption) => boolean>,
): Promise<void> {
  const options = await game.getInteractionOptions();
  const selectedOptionIds = matchers.map((matcher, index) => {
    const option = options.find(matcher);
    if (!option?.id) {
      throw new Error(`Interaction option ${index + 1} not found`);
    }
    return option.id;
  });
  await respondCurrentInteraction(page, { optionIds: selectedOptionIds });
}

test.describe('大杀四方《环游世界：国际事件》四派系真实入口验证', () => {
  test('真实选秀能选择相扑手、火枪手、骑警、摔角手并进入牌桌', async ({ page, game }, testInfo) => {
    test.setTimeout(180000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      seed: 20260714,
      seat1ManualSetup: true,
    }, 45000);
    await expect(page.locator('[data-tutorial-id="su-faction-select"]')).toBeVisible({ timeout: 30000 });

    await pickFaction(page, {
      playerId: '0',
      selectedCountBeforePick: 0,
      factionId: 'sumo_wrestlers',
      beforeConfirm: () => game.screenshot('01-相扑手-派系预览', testInfo),
    });
    await pickFaction(page, {
      playerId: '1',
      selectedCountBeforePick: 0,
      factionId: 'musketeers',
      beforeConfirm: () => game.screenshot('02-火枪手-派系预览', testInfo),
    });
    await pickFaction(page, {
      playerId: '1',
      selectedCountBeforePick: 1,
      factionId: 'mounties',
      beforeConfirm: () => game.screenshot('03-骑警-派系预览', testInfo),
    });
    await pickFaction(page, {
      playerId: '0',
      selectedCountBeforePick: 1,
      factionId: 'luchadors',
      beforeConfirm: () => game.screenshot('04-摔角手-派系预览', testInfo),
    });

    await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 30000 });
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        p0: [...(state?.core?.players?.['0']?.factions ?? [])].sort(),
        p1: [...(state?.core?.players?.['1']?.factions ?? [])].sort(),
      };
    }, { timeout: 20000 }).toEqual({
      p0: ['luchadors', 'sumo_wrestlers'],
      p1: ['mounties', 'musketeers'],
    });
    await game.screenshot('05-国际事件-真实选秀开局完成', testInfo);
  });

  test('四派系代表能力可从真实手牌或弃牌堆入口结算到权威状态', async ({ page, game }, testInfo) => {
    test.setTimeout(180000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'sumo_wrestlers,musketeers',
      p1: 'mounties,luchadors',
      skipFactionSelect: true,
      seed: 20260714,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'technique-prize', defId: 'sumo_wrestlers_technique_prize', type: 'action', owner: '0' },
        ],
        factions: ['sumo_wrestlers', 'musketeers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 2,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [
        {
          defId: 'base_the_dohyo',
          minions: [
            { uid: 'sumo-target', defId: 'sumo_wrestlers_rookie_sumo', owner: '0', controller: '0', power: 2 },
            { uid: 'sumo-other', defId: 'sumo_wrestlers_third_tier', owner: '0', controller: '0', power: 3 },
            { uid: 'enemy-musketeer', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 3 },
          ],
        },
      ],
    });

    await game.playCard('sumo_wrestlers_technique_prize');
    await game.waitForInteraction('sumo_wrestlers_technique_prize', 10000);
    await game.screenshot('06-技术奖-选择己方随从', testInfo);
    await game.selectInteractionOptionBy(option => optionHasMinionUid(option, 'sumo-target'), '技术奖选择相扑新人');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const minions = state.core.bases[0]?.minions ?? [];
      return minions.map((minion: { uid?: string; powerCounters?: number }) => ({
        uid: minion.uid,
        counters: minion.powerCounters ?? 0,
      }));
    }, { timeout: 5000 }).toEqual([
      { uid: 'sumo-target', counters: 3 },
      { uid: 'sumo-other', counters: 0 },
      { uid: 'enemy-musketeer', counters: 0 },
    ]);
    await game.screenshot('07-技术奖-力量指示物结算后', testInfo);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'one-for-all', defId: 'musketeers_one_for_all', type: 'action', owner: '0' },
        ],
        factions: ['sumo_wrestlers', 'musketeers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 2,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [
        {
          defId: 'base_bastion_saint_gervais',
          minions: [
            { uid: 'base-zero-ally', defId: 'sumo_wrestlers_rookie_sumo', owner: '0', controller: '0', power: 2 },
          ],
        },
        {
          defId: 'base_the_golden_lily',
          minions: [
            { uid: 'base-one-ally-a', defId: 'sumo_wrestlers_third_tier', owner: '0', controller: '0', power: 3 },
            { uid: 'base-one-ally-b', defId: 'sumo_wrestlers_rookie_sumo', owner: '0', controller: '0', power: 2 },
            { uid: 'base-one-enemy', defId: 'mounties_dudlee', owner: '1', controller: '1', power: 2 },
          ],
        },
      ],
    });

    await game.playCard('musketeers_one_for_all');
    await game.waitForInteraction('musketeers_one_for_all', 10000);
    await game.screenshot('08-一为全-选择目标基地', testInfo);
    await game.selectInteractionOptionBy(option => optionHasBaseIndex(option, 1), '一为全选择黄金百合花');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        base0: state.core.bases[0]?.minions.map((minion: { tempPowerModifier?: number }) => minion.tempPowerModifier ?? 0),
        base1: state.core.bases[1]?.minions.map((minion: { tempPowerModifier?: number }) => minion.tempPowerModifier ?? 0),
        actionLimit: state.core.players['0']?.actionLimit,
      };
    }, { timeout: 5000 }).toEqual({
      base0: [0],
      base1: [1, 1, 0],
      actionLimit: 3,
    });
    await game.screenshot('09-一为全-所选基地强化后', testInfo);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [],
        discard: [
          { uid: 'eh-discard', defId: 'mounties_eh', type: 'action', owner: '0' },
        ],
        factions: ['mounties', 'luchadors'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 1,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [
        {
          defId: 'base_great_white_north_eh',
          minions: [
            { uid: 'mountie-target', defId: 'mounties_dudlee', owner: '0', controller: '0', power: 2 },
            { uid: 'enemy-on-north', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 3 },
          ],
        },
      ],
    });

    await game.screenshot('10-嗯-弃牌堆special可用前', testInfo);
    await playDiscardSpecialOnMinion(page, 'eh-discard', 'mountie-target');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const target = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'mountie-target');
      return {
        tempPower: target?.tempPowerModifier ?? 0,
        handUids: state.core.players['0']?.hand.map((card: { uid?: string }) => card.uid) ?? [],
        discardUids: state.core.players['0']?.discard.map((card: { uid?: string }) => card.uid) ?? [],
        usedDiscardPlayAbilities: state.core.players['0']?.usedDiscardPlayAbilities ?? [],
      };
    }, { timeout: 5000 }).toEqual({
      tempPower: 1,
      handUids: ['eh-discard'],
      discardUids: [],
      usedDiscardPlayAbilities: ['mounties_eh'],
    });
    await game.screenshot('11-嗯-弃牌堆special结算后', testInfo);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'quick-setup', defId: 'luchadors_quick_set_up', type: 'action', owner: '0' },
          { uid: 'smart-setup', defId: 'luchadors_smart_set_up', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'ringside-draw-a', defId: 'luchadors_tag_team', type: 'action', owner: '0' },
          { uid: 'ringside-draw-b', defId: 'luchadors_cheap_pop', type: 'action', owner: '0' },
        ],
        factions: ['mounties', 'luchadors'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [
        {
          defId: 'base_ringside',
          minions: [
            { uid: 'friendly-luchador', defId: 'luchadors_yellow_demon', owner: '0', controller: '0', power: 2 },
            { uid: 'setup-host', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 3 },
          ],
        },
      ],
    });

    await game.playCard('luchadors_quick_set_up', { targetMinionUid: 'setup-host' });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const host = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'setup-host');
      return {
        attached: host?.attachedActions.map((action: { defId?: string }) => action.defId) ?? [],
        actionLimit: state.core.players['0']?.actionLimit,
        actionsPlayed: state.core.players['0']?.actionsPlayed,
      };
    }, { timeout: 5000 }).toEqual({
      attached: ['luchadors_quick_set_up'],
      actionLimit: 2,
      actionsPlayed: 1,
    });
    await game.screenshot('12-快速Set-Up-附着并获得额外行动后', testInfo);

    await game.playCard('luchadors_smart_set_up', { targetMinionUid: 'setup-host' });
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      const host = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'setup-host');
      return {
        attached: host?.attachedActions.map((action: { defId?: string }) => action.defId) ?? [],
        handUids: state.core.players['0']?.hand.map((card: { uid?: string }) => card.uid) ?? [],
        deckCount: state.core.players['0']?.deck.length,
      };
    }, { timeout: 5000 }).toEqual({
      attached: ['luchadors_quick_set_up', 'luchadors_smart_set_up'],
      handUids: ['ringside-draw-a', 'ringside-draw-b'],
      deckCount: 0,
    });
    await game.screenshot('13-聪明Set-Up-额外行动附着后', testInfo);
  });

  test('炖肉允许真实入口空选，也能多选手牌后给己方随从放指示物', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'sumo_wrestlers,musketeers',
      p1: 'mounties,luchadors',
      skipFactionSelect: true,
      seed: 20260715,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'stew-skip', defId: 'sumo_wrestlers_bulking_stew', type: 'action', owner: '0' },
          { uid: 'stew-skip-card-a', defId: 'sumo_wrestlers_performance_prize', type: 'action', owner: '0' },
          { uid: 'stew-skip-card-b', defId: 'musketeers_young_musketeer', type: 'minion', owner: '0' },
        ],
        factions: ['sumo_wrestlers', 'musketeers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [
        {
          defId: 'base_the_dohyo',
          minions: [
            { uid: 'stew-skip-target', defId: 'sumo_wrestlers_rookie_sumo', owner: '0', controller: '0', power: 2 },
          ],
        },
      ],
    });

    await game.playCard('sumo_wrestlers_bulking_stew');
    await game.waitForInteraction('sumo_wrestlers_bulking_stew_discard', 10000);
    await game.screenshot('19-炖肉-空选手牌弃置交互', testInfo);
    await respondCurrentInteraction(page, { optionIds: [] });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      const target = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'stew-skip-target');
      return {
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
        discardFodderUids: player.discard
          .map((card: { uid?: string }) => card.uid)
          .filter((uid?: string) => uid === 'stew-skip-card-a' || uid === 'stew-skip-card-b'),
        targetCounters: target?.powerCounters ?? 0,
      };
    }, { timeout: 5000 }).toEqual({
      handUids: ['stew-skip-card-a', 'stew-skip-card-b'],
      discardFodderUids: [],
      targetCounters: 0,
    });
    await game.screenshot('20-炖肉-空选后手牌与指示物不变', testInfo);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'stew-select', defId: 'sumo_wrestlers_bulking_stew', type: 'action', owner: '0' },
          { uid: 'stew-select-card-a', defId: 'sumo_wrestlers_performance_prize', type: 'action', owner: '0' },
          { uid: 'stew-select-card-b', defId: 'musketeers_young_musketeer', type: 'minion', owner: '0' },
        ],
        factions: ['sumo_wrestlers', 'musketeers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [
        {
          defId: 'base_the_dohyo',
          minions: [
            { uid: 'stew-select-target', defId: 'sumo_wrestlers_rookie_sumo', owner: '0', controller: '0', power: 2 },
            { uid: 'stew-select-other', defId: 'sumo_wrestlers_third_tier', owner: '0', controller: '0', power: 3 },
          ],
        },
      ],
    });

    await game.playCard('sumo_wrestlers_bulking_stew');
    await game.waitForInteraction('sumo_wrestlers_bulking_stew_discard', 10000);
    await game.screenshot('21-炖肉-多选手牌弃置交互', testInfo);
    await respondWithOptionIds(page, game, [
      option => optionHasCardUid(option, 'stew-select-card-a'),
      option => optionHasCardUid(option, 'stew-select-card-b'),
    ]);

    await game.waitForInteraction('sumo_wrestlers_bulking_stew_target', 10000);
    await game.screenshot('22-炖肉-选择承接指示物随从', testInfo);
    await game.selectInteractionOptionBy(option => optionHasMinionUid(option, 'stew-select-target'), '炖肉选择相扑新人');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      const minions = state.core.bases[0]?.minions ?? [];
      return {
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
        discardFodderUids: player.discard
          .map((card: { uid?: string }) => card.uid)
          .filter((uid?: string) => uid === 'stew-select-card-a' || uid === 'stew-select-card-b'),
        counters: minions.map((minion: { uid?: string; powerCounters?: number }) => ({
          uid: minion.uid,
          counters: minion.powerCounters ?? 0,
        })),
      };
    }, { timeout: 5000 }).toEqual({
      handUids: [],
      discardFodderUids: ['stew-select-card-a', 'stew-select-card-b'],
      counters: [
        { uid: 'stew-select-target', counters: 2 },
        { uid: 'stew-select-other', counters: 0 },
      ],
    });
    await game.screenshot('23-炖肉-多选结算后力量指示物增加', testInfo);
  });

  test('斗志奖可从真实入口抽牌并分配力量指示物', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'sumo_wrestlers,musketeers',
      p1: 'mounties,luchadors',
      skipFactionSelect: true,
      seed: 20260715,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'spirit-prize', defId: 'sumo_wrestlers_fighting_spirit_prize', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'spirit-draw-a', defId: 'sumo_wrestlers_rookie_sumo', type: 'minion', owner: '0' },
          { uid: 'spirit-draw-b', defId: 'sumo_wrestlers_chikara_mizu', type: 'action', owner: '0' },
        ],
        factions: ['sumo_wrestlers', 'musketeers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [
        {
          defId: 'base_the_dohyo',
          minions: [
            { uid: 'spirit-target-a', defId: 'sumo_wrestlers_rookie_sumo', owner: '0', controller: '0', power: 2 },
            { uid: 'spirit-target-b', defId: 'sumo_wrestlers_top_tier', owner: '0', controller: '0', power: 4 },
            { uid: 'spirit-enemy', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 3 },
          ],
        },
      ],
    });

    await game.playCard('sumo_wrestlers_fighting_spirit_prize');
    await game.waitForInteraction('sumo_wrestlers_fighting_spirit_prize', 10000);
    await game.screenshot('28-斗志奖-选择分配力量指示物随从', testInfo);
    await respondWithOptionIds(page, game, [
      option => optionHasMinionUid(option, 'spirit-target-a'),
      option => optionHasMinionUid(option, 'spirit-target-b'),
    ]);
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      const minions = state.core.bases[0]?.minions ?? [];
      return {
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
        deckUids: player.deck.map((card: { uid?: string }) => card.uid),
        counters: minions.map((minion: { uid?: string; powerCounters?: number }) => ({
          uid: minion.uid,
          counters: minion.powerCounters ?? 0,
        })),
      };
    }, { timeout: 5000 }).toEqual({
      handUids: ['spirit-draw-a', 'spirit-draw-b'],
      deckUids: [],
      counters: [
        { uid: 'spirit-target-a', counters: 1 },
        { uid: 'spirit-target-b', counters: 1 },
        { uid: 'spirit-enemy', counters: 0 },
      ],
    });
    await game.screenshot('29-斗志奖-抽牌并分配指示物后', testInfo);
  });

  test('计分前 special 与压制可从真实入口影响最终权威状态', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'mounties,luchadors',
      p1: 'sumo_wrestlers,musketeers',
      skipFactionSelect: true,
      seed: 20260715,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'scoreBases',
      player0: {
        hand: [
          { uid: 'badge-special', defId: 'mounties_when_calls_the_badge', type: 'action', owner: '0' },
        ],
        factions: ['mounties', 'luchadors'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [
        {
          defId: 'base_great_white_north_eh',
          breakpoint: 7,
          minions: [
            { uid: 'badge-target-a', defId: 'mounties_dudlee', owner: '0', controller: '0', power: 2 },
            { uid: 'badge-target-b', defId: 'mounties_war_canuck', owner: '0', controller: '0', power: 3 },
            { uid: 'badge-enemy', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 3 },
          ],
        },
        {
          defId: 'base_the_golden_lily',
          minions: [
            { uid: 'badge-other-base', defId: 'mounties_northern_mover', owner: '0', controller: '0', power: 4 },
          ],
        },
      ],
      responseWindow: {
        id: 'me-first-badge-special',
        windowType: 'meFirst',
        sourceId: 'scoreBases',
        responderQueue: ['0', '1'],
        currentResponderIndex: 0,
        passedPlayers: [],
        actionTakenThisRound: false,
        consecutivePassRounds: 0,
      },
    });

    await page.waitForFunction(
      () => {
        const state = (window as SmashUpE2EWindow).__BG_TEST_HARNESS__?.state?.get?.();
        const windowType = state?.sys?.responseWindow?.current?.windowType;
        return state?.sys?.phase === 'scoreBases' && windowType === 'meFirst';
      },
      { timeout: 20000, polling: 200 },
    );
    await game.screenshot('14-呼叫警徽-计分前响应窗口', testInfo);

    await game.playCard('mounties_when_calls_the_badge', { targetBaseIndex: 0 });
    await game.waitForInteraction('mounties_when_calls_the_badge', 10000);
    await game.screenshot('15-呼叫警徽-选择加指示物基地', testInfo);
    await game.selectInteractionOptionBy(option => optionHasBaseIndex(option, 0), '呼叫警徽选择计分基地');
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const interactionSource = state.sys.interaction?.current?.data?.sourceId ?? null;
      return {
        scoringBaseCounters: state.core.bases[0]?.minions.map((minion: { powerCounters?: number }) => minion.powerCounters ?? 0),
        otherBaseCounters: state.core.bases[1]?.minions.map((minion: { powerCounters?: number }) => minion.powerCounters ?? 0),
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
        badgeInteractionCleared: interactionSource !== 'mounties_when_calls_the_badge',
      };
    }, { timeout: 10000 }).toMatchObject({
      scoringBaseCounters: [1, 1, 0],
      otherBaseCounters: [0],
      triggerQueueLength: 0,
      badgeInteractionCleared: true,
    });
    await game.screenshot('16-呼叫警徽-计分前special结算后', testInfo);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'pin-card', defId: 'luchadors_pin', type: 'action', owner: '0' },
        ],
        factions: ['mounties', 'luchadors'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player1: {
        factions: ['sumo_wrestlers', 'musketeers'],
        vp: 0,
      },
      bases: [
        {
          defId: 'base_ringside',
          breakpoint: 7,
          minions: [
            { uid: 'pin-flor', defId: 'luchadors_flor_loca', owner: '0', controller: '0', power: 3 },
            { uid: 'pin-enemy-small', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', power: 2 },
            { uid: 'pin-enemy-big', defId: 'musketeers_dartagnan', owner: '1', controller: '1', power: 6 },
          ],
        },
      ],
    });

    await game.playCard('luchadors_pin', { targetMinionUid: 'pin-enemy-big' });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const host = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'pin-enemy-big');
      return host?.attachedActions.map((action: { defId?: string }) => action.defId) ?? [];
    }, { timeout: 5000 }).toEqual(['luchadors_pin']);
    await game.screenshot('17-压制-真实附着后', testInfo);

    await page.getByTestId('su-end-turn-action-button').click();
    await game.waitForInteraction('multi_base_scoring', 10000);
    await game.selectInteractionOptionBy(
      option => optionHasBaseIndex(option, 0) || optionHasBaseDefId(option, 'base_ringside'),
      '压制选择擂台边计分',
    );
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        p0Vp: state.core.players['0']?.vp,
        p1Vp: state.core.players['1']?.vp,
        phase: state.sys.phase,
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 20000 }).toMatchObject({
      p0Vp: 4,
      p1Vp: 2,
      triggerQueueLength: 0,
      interactionSource: null,
    });
    await game.screenshot('18-压制-计分排除目标力量后', testInfo);
  });

  test('逆转可从真实计分前窗口夺控并摧毁己方 Set-Up 行动', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'luchadors,mounties',
      p1: 'sumo_wrestlers,musketeers',
      skipFactionSelect: true,
      seed: 20260715,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'reversal-card', defId: 'luchadors_reversal', type: 'action', owner: '0' },
        ],
        factions: ['luchadors', 'mounties'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [
        {
          defId: 'base_ringside',
          minions: [
            { uid: 'reversal-ally', defId: 'luchadors_yellow_demon', owner: '0', controller: '0', basePower: 9 },
            {
              uid: 'reversal-target',
              defId: 'musketeers_young_musketeer',
              owner: '1',
              controller: '1',
              basePower: 12,
              attachedActions: [
                { uid: 'rev-quick', defId: 'luchadors_quick_set_up', ownerId: '0' },
                { uid: 'rev-smart', defId: 'luchadors_smart_set_up', ownerId: '0' },
                { uid: 'rev-enemy-action', defId: 'musketeers_all_for_one', ownerId: '1' },
              ],
            },
          ],
        },
      ],
    });

    await game.waitForPhase('playCards');
    await game.waitForCurrentPlayer('0');
    await page.getByTestId('su-end-turn-action-button').click();

    await page.waitForFunction(
      () => {
        const state = (window as SmashUpE2EWindow).__BG_TEST_HARNESS__?.state?.get?.();
        const windowType = state?.sys?.responseWindow?.current?.windowType;
        return state?.sys?.phase === 'scoreBases' && windowType === 'meFirst';
      },
      { timeout: 20000, polling: 200 },
    );
    await game.screenshot('30-逆转-计分前响应窗口', testInfo);

    await game.playCard('luchadors_reversal', { targetBaseIndex: 0 });
    await game.waitForInteraction('luchadors_reversal_destroy_actions', 10000);
    await game.screenshot('31-逆转-选择摧毁己方Set-Up行动', testInfo);
    await respondWithOptionIds(page, game, [
      option => optionHasCardUid(option, 'rev-quick'),
      option => optionHasCardUid(option, 'rev-smart'),
    ]);

    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      const attachedSetupUidsOnBoard = state.core.bases.flatMap((base: {
        minions?: Array<{ attachedActions?: Array<{ uid?: string }> }>;
      }) => (base.minions ?? []).flatMap(minion => minion.attachedActions ?? []))
        .map((action: { uid?: string }) => action.uid)
        .filter((uid?: string) => uid === 'rev-quick' || uid === 'rev-smart');
      return {
        p0Vp: player.vp,
        p1Vp: state.core.players['1']?.vp,
        discardUids: player.discard
          .map((card: { uid?: string }) => card.uid)
          .filter((uid?: string) => uid === 'rev-quick' || uid === 'rev-smart'),
        attachedSetupUidsOnBoard,
        responseWindow: state.sys.responseWindow?.current ?? null,
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      p0Vp: 4,
      p1Vp: 0,
      discardUids: ['rev-quick', 'rev-smart'],
      attachedSetupUidsOnBoard: [],
      responseWindow: null,
      triggerQueueLength: 0,
      interactionSource: null,
    });
    await game.screenshot('32-逆转-夺控计分并摧毁行动后', testInfo);
  });

  test('最后一搏可从真实计分前窗口反超计分并抽牌', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'musketeers,sumo_wrestlers',
      p1: 'mounties,luchadors',
      skipFactionSelect: true,
      seed: 20260715,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'last-stand-card', defId: 'musketeers_last_stand', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'last-stand-draw', defId: 'musketeers_en_garde', type: 'action', owner: '0' },
        ],
        factions: ['musketeers', 'sumo_wrestlers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player1: {
        factions: ['mounties', 'luchadors'],
        vp: 0,
      },
      bases: [
        {
          defId: 'base_the_dohyo',
          minions: [
            { uid: 'last-stand-guard', defId: 'musketeers_young_musketeer', owner: '0', controller: '0', basePower: 8 },
            { uid: 'last-stand-enemy', defId: 'mounties_dudlee', owner: '1', controller: '1', basePower: 9 },
          ],
        },
      ],
    });

    await game.waitForPhase('playCards');
    await game.waitForCurrentPlayer('0');
    await page.getByTestId('su-end-turn-action-button').click();

    await page.waitForFunction(
      () => {
        const state = (window as SmashUpE2EWindow).__BG_TEST_HARNESS__?.state?.get?.();
        const windowType = state?.sys?.responseWindow?.current?.windowType;
        return state?.sys?.phase === 'scoreBases' && windowType === 'meFirst';
      },
      { timeout: 20000, polling: 200 },
    );
    await game.screenshot('33-最后一搏-计分前响应窗口', testInfo);
    await dismissSpotlightIfPresent(page);

    await game.playCard('musketeers_last_stand', {
      targetBaseIndex: 0,
    });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      return {
        p0Vp: player.vp,
        p1Vp: state.core.players['1']?.vp,
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
        deckUids: player.deck.map((card: { uid?: string }) => card.uid),
        responseWindow: state.sys.responseWindow?.current ?? null,
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      p0Vp: 3,
      p1Vp: 2,
      handUids: ['last-stand-draw'],
      deckUids: [],
      responseWindow: null,
      triggerQueueLength: 0,
      interactionSource: null,
    });
    await game.screenshot('34-最后一搏-反超计分并抽牌后', testInfo);
  });

  test('Capa Roja 可从真实计分前窗口摧毁低印制力量随从并反超计分', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'luchadors,mounties',
      p1: 'sumo_wrestlers,musketeers',
      skipFactionSelect: true,
      seed: 20260715,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [],
        factions: ['luchadors', 'mounties'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 0,
      },
      player1: {
        factions: ['sumo_wrestlers', 'musketeers'],
        vp: 0,
      },
      bases: [
        {
          defId: 'base_ringside',
          minions: [
            { uid: 'capa-roja', defId: 'luchadors_capa_roja', owner: '0', controller: '0', basePower: 11 },
            { uid: 'capa-target', defId: 'musketeers_young_musketeer', owner: '1', controller: '1', basePower: 12 },
          ],
        },
      ],
    });

    await game.waitForPhase('playCards');
    await game.waitForCurrentPlayer('0');
    await page.getByTestId('su-end-turn-action-button').click();

    await game.waitForInteraction('luchadors_capa_roja', 10000);
    await game.screenshot('35-CapaRoja-计分前选择低印制力量随从', testInfo);
    await respondWithOptionIds(page, game, [
      option => optionHasMinionUid(option, 'capa-target'),
    ]);

    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const player1DiscardUids = state.core.players['1']?.discard.map((card: { uid?: string }) => card.uid) ?? [];
      return {
        p0Vp: state.core.players['0']?.vp,
        p1Vp: state.core.players['1']?.vp,
        targetInDiscard: player1DiscardUids.includes('capa-target'),
        responseWindow: state.sys.responseWindow?.current ?? null,
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      p0Vp: 4,
      p1Vp: 0,
      targetInDiscard: true,
      responseWindow: null,
      triggerQueueLength: 0,
      interactionSource: null,
    });
    await game.screenshot('36-CapaRoja-摧毁目标并反超计分后', testInfo);
  });

  test('阿拉密斯可从真实反应窗口获得并消费限定额外行动', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'musketeers,sumo_wrestlers',
      p1: 'mounties,luchadors',
      skipFactionSelect: true,
      seed: 20260715,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'aramis-en-garde', defId: 'musketeers_en_garde', type: 'action', owner: '0' },
          { uid: 'aramis-biding-time', defId: 'musketeers_biding_time', type: 'action', owner: '0' },
        ],
        factions: ['musketeers', 'sumo_wrestlers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [
        {
          defId: 'base_bastion_saint_gervais',
          minions: [
            { uid: 'aramis', defId: 'musketeers_aramis', owner: '0', controller: '0', power: 4 },
          ],
        },
      ],
    });

    await game.playCard('musketeers_en_garde', { targetMinionUid: 'aramis' });
    await page.waitForFunction(() => {
      const harness = (window as SmashUpE2EWindow).__BG_TEST_HARNESS__;
      const options = harness?.state?.get?.()?.sys?.interaction?.current?.data?.options ?? [];
      return options.some((option: InteractionOption) => String(
        (option.value as { triggerId?: unknown } | undefined)?.triggerId ?? '',
      ).includes('musketeers_aramis'));
    }, { timeout: 10000, polling: 200 });
    await game.screenshot('37-阿拉密斯-真实反应窗口', testInfo);
    await game.selectInteractionOptionBy(
      option => optionHasTriggerId(option, 'musketeers_aramis'),
      '阿拉密斯选择强制反应',
    );

    await page.waitForFunction(() => {
      const harness = (window as SmashUpE2EWindow).__BG_TEST_HARNESS__;
      const options = harness?.state?.get?.()?.sys?.interaction?.current?.data?.options ?? [];
      return options.some((option: InteractionOption) => (
        (option.value as { cardUid?: unknown } | undefined)?.cardUid === 'aramis-biding-time'
      ));
    }, { timeout: 10000, polling: 200 });
    await game.screenshot('38-阿拉密斯-限定额外行动候选', testInfo);
    await game.selectInteractionOptionBy(
      option => optionHasCardUid(option, 'aramis-biding-time'),
      '阿拉密斯消费等待时机额外行动',
    );
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const minions = state.core.bases[0]?.minions ?? [];
      const aramis = minions.find((minion: { uid?: string }) => minion.uid === 'aramis');
      const player = state.core.players['0'];
      return {
        aramisTempPower: aramis?.tempPowerModifier ?? 0,
        handHasEnGarde: player.hand.some((card: { uid?: string }) => card.uid === 'aramis-en-garde'),
        handHasBidingTime: player.hand.some((card: { uid?: string }) => card.uid === 'aramis-biding-time'),
        discardUids: player.discard.map((card: { uid?: string }) => card.uid),
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      aramisTempPower: 3,
      handHasEnGarde: false,
      handHasBidingTime: false,
      discardUids: ['aramis-en-garde', 'aramis-biding-time'],
      interactionSource: null,
    });
    await game.screenshot('39-阿拉密斯-限定额外行动结算后', testInfo);
  });

  test('全为一可从真实手牌附着、触发加力并在回合结束自毁', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'musketeers,sumo_wrestlers',
      p1: 'mounties,luchadors',
      skipFactionSelect: true,
      seed: 20260715,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'all-for-one', defId: 'musketeers_all_for_one', type: 'action', owner: '0' },
          { uid: 'all-for-one-en-garde', defId: 'musketeers_en_garde', type: 'action', owner: '0' },
        ],
        factions: ['musketeers', 'sumo_wrestlers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['mounties', 'luchadors'] },
      bases: [
        {
          defId: 'base_the_dohyo',
          minions: [
            { uid: 'all-for-one-host', defId: 'musketeers_porthos', owner: '0', controller: '0', power: 4 },
          ],
        },
      ],
    });

    await game.playCard('musketeers_all_for_one', { targetMinionUid: 'all-for-one-host' });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const host = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'all-for-one-host');
      return {
        attached: host?.attachedActions.map((action: { defId?: string }) => action.defId) ?? [],
        actionLimit: state.core.players['0']?.actionLimit,
      };
    }, { timeout: 5000 }).toEqual({
      attached: ['musketeers_all_for_one'],
      actionLimit: 2,
    });
    await game.screenshot('40-全为一-真实附着并获得额外行动后', testInfo);

    await game.playCard('musketeers_en_garde', { targetMinionUid: 'all-for-one-host' });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const host = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'all-for-one-host');
      return {
        tempPower: host?.tempPowerModifier ?? 0,
        attached: host?.attachedActions.map((action: { defId?: string }) => action.defId) ?? [],
        discardUids: state.core.players['0']?.discard.map((card: { uid?: string }) => card.uid) ?? [],
      };
    }, { timeout: 5000 }).toEqual({
      tempPower: 2,
      attached: ['musketeers_all_for_one'],
      discardUids: ['all-for-one-en-garde'],
    });
    await game.screenshot('41-全为一-直接影响宿主后加力', testInfo);

    await page.getByTestId('su-end-turn-action-button').click();
    await expect.poll(async () => {
      const state = await game.getState();
      const host = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'all-for-one-host');
      const player = state.core.players['0'];
      return {
        attached: host?.attachedActions.map((action: { defId?: string }) => action.defId) ?? [],
        discardUids: player.discard.map((card: { uid?: string }) => card.uid).sort(),
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      attached: [],
      discardUids: ['all-for-one', 'all-for-one-en-garde'].sort(),
      interactionSource: null,
    });
    await game.screenshot('42-全为一-回合结束自毁后', testInfo);
  });

  test('穆乔摔先生大战怪物允许空选，也能多选弃牌堆行动后回收与洗回', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'luchadors,mounties',
      p1: 'sumo_wrestlers,musketeers',
      skipFactionSelect: true,
      seed: 20260715,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'monsters-skip', defId: 'luchadors_senor_muchoslam_vs_the_monsters', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'skip-deck-keep', defId: 'luchadors_yellow_demon', type: 'minion', owner: '0' },
        ],
        discard: [
          { uid: 'skip-pin', defId: 'luchadors_pin', type: 'action', owner: '0' },
          { uid: 'skip-tag-team', defId: 'luchadors_tag_team', type: 'action', owner: '0' },
        ],
        factions: ['luchadors', 'mounties'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [
        {
          defId: 'base_ringside',
          minions: [
            { uid: 'skip-host', defId: 'musketeers_dartagnan', owner: '1', controller: '1', power: 6 },
          ],
        },
      ],
    });

    await game.playCard('luchadors_senor_muchoslam_vs_the_monsters');
    await game.waitForInteraction('luchadors_senor_muchoslam_vs_the_monsters', 10000);
    await game.screenshot('24-穆乔大战怪物-空选弃牌堆行动交互', testInfo);
    await respondCurrentInteraction(page, { optionIds: [] });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      return {
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
        deckUids: player.deck.map((card: { uid?: string }) => card.uid),
        discardHasOriginalActions: ['skip-pin', 'skip-tag-team'].every(uid =>
          player.discard.some((card: { uid?: string }) => card.uid === uid),
        ),
      };
    }, { timeout: 5000 }).toEqual({
      handUids: [],
      deckUids: ['skip-deck-keep'],
      discardHasOriginalActions: true,
    });
    await game.screenshot('25-穆乔大战怪物-空选后弃牌堆与牌库不变', testInfo);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'monsters-select', defId: 'luchadors_senor_muchoslam_vs_the_monsters', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'select-deck-keep', defId: 'luchadors_yellow_demon', type: 'minion', owner: '0' },
        ],
        discard: [
          { uid: 'select-pin', defId: 'luchadors_pin', type: 'action', owner: '0' },
          { uid: 'select-tag-team', defId: 'luchadors_tag_team', type: 'action', owner: '0' },
        ],
        factions: ['luchadors', 'mounties'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [
        {
          defId: 'base_ringside',
          minions: [
            { uid: 'select-host', defId: 'musketeers_dartagnan', owner: '1', controller: '1', power: 6 },
          ],
        },
      ],
    });

    await game.playCard('luchadors_senor_muchoslam_vs_the_monsters');
    await game.waitForInteraction('luchadors_senor_muchoslam_vs_the_monsters', 10000);
    await game.screenshot('26-穆乔大战怪物-多选弃牌堆行动交互', testInfo);
    await respondWithOptionIds(page, game, [
      option => optionHasCardUid(option, 'select-pin'),
      option => optionHasCardUid(option, 'select-tag-team'),
    ]);
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      return {
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
        deckUids: player.deck.map((card: { uid?: string }) => card.uid),
        discardHasSelectedActions: ['select-pin', 'select-tag-team'].some(uid =>
          player.discard.some((card: { uid?: string }) => card.uid === uid),
        ),
      };
    }, { timeout: 5000 }).toEqual({
      handUids: ['select-pin'],
      deckUids: ['select-deck-keep', 'select-tag-team'],
      discardHasSelectedActions: false,
    });
    await game.screenshot('27-穆乔大战怪物-多选后回收行动并洗回其余', testInfo);
  });

  test('方形擂台可从真实打出随从入口随机回收弃牌堆行动', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'luchadors,mounties',
      p1: 'sumo_wrestlers,musketeers',
      skipFactionSelect: true,
      seed: 20260715,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'squared-flor-loca', defId: 'luchadors_flor_loca', type: 'minion', owner: '0' },
        ],
        discard: [
          { uid: 'squared-pin', defId: 'luchadors_pin', type: 'action', owner: '0' },
        ],
        factions: ['luchadors', 'mounties'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'musketeers'] },
      bases: [
        {
          defId: 'base_the_squared_circle',
          minions: [],
        },
      ],
    });

    await game.screenshot('43-方形擂台-打出随从前弃牌堆有行动', testInfo);
    await game.playCard('luchadors_flor_loca', { targetBaseIndex: 0 });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      return {
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
        discardUids: player.discard.map((card: { uid?: string }) => card.uid),
        baseMinions: state.core.bases[0]?.minions.map((minion: { uid?: string }) => minion.uid) ?? [],
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      handUids: ['squared-pin'],
      discardUids: [],
      baseMinions: ['squared-flor-loca'],
      triggerQueueLength: 0,
      interactionSource: null,
    });
    await game.screenshot('44-方形擂台-回收行动并清空流程态', testInfo);
  });

  test('圣热尔韦堡垒可从真实行动影响己方随从入口授予额外行动', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'luchadors,musketeers',
      p1: 'sumo_wrestlers,mounties',
      skipFactionSelect: true,
      seed: 20260715,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'bastion-cheap-pop', defId: 'luchadors_cheap_pop', type: 'action', owner: '0' },
          { uid: 'bastion-tag-team', defId: 'luchadors_tag_team', type: 'action', owner: '0' },
        ],
        factions: ['luchadors', 'musketeers'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['sumo_wrestlers', 'mounties'] },
      bases: [
        {
          defId: 'base_bastion_saint_gervais',
          minions: [
            { uid: 'bastion-ally', defId: 'luchadors_flor_loca', owner: '0', controller: '0', power: 3 },
          ],
        },
      ],
    });

    await game.screenshot('45-圣热尔韦堡垒-行动影响己方随从前', testInfo);
    await game.playCard('luchadors_cheap_pop');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      const ally = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'bastion-ally');
      return {
        tempPower: ally?.tempPowerModifier ?? 0,
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
        discardUids: player.discard.map((card: { uid?: string }) => card.uid),
        actionsPlayed: player.actionsPlayed,
        actionLimit: player.actionLimit,
        usedTurn: state.core.bases[0]?.metadata?.internationalIncidentBastionSaintGervaisUsedTurn_0,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      tempPower: 2,
      handUids: ['bastion-tag-team'],
      discardUids: ['bastion-cheap-pop'],
      actionsPlayed: 1,
      actionLimit: 2,
      usedTurn: 1,
      interactionSource: null,
    });
    await game.screenshot('46-圣热尔韦堡垒-获得额外行动后', testInfo);

    await game.playCard('luchadors_tag_team');
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      return {
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
        discardUids: player.discard.map((card: { uid?: string }) => card.uid),
        actionsPlayed: player.actionsPlayed,
        actionLimit: player.actionLimit,
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      handUids: [],
      discardUids: ['bastion-cheap-pop', 'bastion-tag-team'],
      actionsPlayed: 2,
      actionLimit: 2,
      triggerQueueLength: 0,
      interactionSource: null,
    });
    await game.screenshot('47-圣热尔韦堡垒-消费额外行动后', testInfo);
  });

  test('擂台边可从真实行动影响另一玩家随从入口抽牌', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'luchadors,mounties',
      p1: 'musketeers,sumo_wrestlers',
      skipFactionSelect: true,
      seed: 20260715,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'ringside-pin', defId: 'luchadors_pin', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'ringside-drawn', defId: 'luchadors_tag_team', type: 'action', owner: '0' },
        ],
        factions: ['luchadors', 'mounties'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: { factions: ['musketeers', 'sumo_wrestlers'] },
      bases: [
        {
          defId: 'base_ringside',
          minions: [
            {
              uid: 'ringside-enemy',
              defId: 'musketeers_dartagnan',
              owner: '1',
              controller: '1',
              power: 4,
              attachedActions: [
                { uid: 'ringside-existing-setup', defId: 'luchadors_smart_set_up', ownerId: '0' },
              ],
            },
          ],
        },
      ],
    });

    await game.screenshot('48-擂台边-压制另一玩家随从前', testInfo);
    await game.playCard('luchadors_pin', { targetMinionUid: 'ringside-enemy' });
    await game.waitForNoInteraction(10000);
    await dismissSpotlightIfPresent(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['0'];
      const enemy = state.core.bases[0]?.minions.find((minion: { uid?: string }) => minion.uid === 'ringside-enemy');
      return {
        handUids: player.hand.map((card: { uid?: string }) => card.uid),
        deckUids: player.deck.map((card: { uid?: string }) => card.uid),
        attached: enemy?.attachedActions.map((action: { defId?: string }) => action.defId) ?? [],
        actionsPlayed: player.actionsPlayed,
        triggerQueueLength: state.core.triggerQueue?.length ?? 0,
        interactionSource: state.sys.interaction?.current?.data?.sourceId ?? null,
      };
    }, { timeout: 10000 }).toEqual({
      handUids: ['ringside-drawn'],
      deckUids: [],
      attached: ['luchadors_smart_set_up', 'luchadors_pin'],
      actionsPlayed: 1,
      triggerQueueLength: 0,
      interactionSource: null,
    });
    await game.screenshot('49-擂台边-压制附着并抽牌后', testInfo);
  });
});
