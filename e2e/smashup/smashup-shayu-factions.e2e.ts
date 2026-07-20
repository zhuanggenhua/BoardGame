import { test, expect } from '../framework';
import { setChineseLocale } from '../helpers/common';
import type { Page } from '@playwright/test';

type InteractionOption = {
  id: string;
  label?: string;
  value?: unknown;
};

type InteractionGame = {
  getInteractionOptions(): Promise<InteractionOption[]>;
};

type ResponseWindowGame = InteractionGame & {
  selectInteractionOptionBy(matcher: (option: InteractionOption) => boolean, description: string): Promise<void>;
  passResponseWindow(playerId?: string): Promise<void>;
};

type BrowserHarnessState = {
  sys?: {
    interaction?: { current?: { data?: { sourceId?: string } } };
    responseWindow?: { current?: { windowType?: string } };
  };
};

type SkippableInteractionGame = {
  skip(): Promise<void>;
};

type BrowserHarnessWindow = Window & {
  __BG_TEST_HARNESS__?: { state?: { get?: () => BrowserHarnessState } };
};

function optionHasBaseIndex(option: unknown, baseIndex: number): boolean {
  if (!option || typeof option !== 'object') return false;
  const value = (option as { value?: unknown }).value;
  if (!value || typeof value !== 'object') return false;
  return (value as { baseIndex?: unknown }).baseIndex === baseIndex;
}

function optionHasMinionUid(option: unknown, minionUid: string): boolean {
  if (!option || typeof option !== 'object') return false;
  const value = (option as { value?: unknown }).value;
  if (!value || typeof value !== 'object') return false;
  return (value as { minionUid?: unknown }).minionUid === minionUid;
}

function optionHasReactionKind(option: unknown, kind: string): boolean {
  if (!option || typeof option !== 'object') return false;
  const value = (option as { value?: unknown }).value;
  if (!value || typeof value !== 'object') return false;
  return (value as { kind?: unknown }).kind === kind;
}

async function getReactionWindowStatus(page: Page): Promise<{ sourceId: string | null; windowType: string | null }> {
  return page.evaluate(() => {
    const state = (window as unknown as BrowserHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
    return {
      sourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
      windowType: state?.sys?.responseWindow?.current?.windowType ?? null,
    };
  });
}

async function passCurrentReactionChoice(game: ResponseWindowGame, description: string): Promise<void> {
  await game.selectInteractionOptionBy(
    (option: InteractionOption) => optionHasReactionKind(option, 'pass'),
    description,
  );
}

async function passOpenReactionOrResponseWindow(page: Page, game: ResponseWindowGame, description: string): Promise<boolean> {
  const status = await getReactionWindowStatus(page);
  if (status.sourceId === 'smashup_reaction_choose') {
    await passCurrentReactionChoice(game, description);
    return true;
  }
  if (status.windowType) {
    await game.passResponseWindow();
    return true;
  }
  return false;
}

async function skipCurrentInteractionIfSource(
  page: Page,
  game: SkippableInteractionGame,
  sourceId: string,
  description: string,
): Promise<boolean> {
  const status = await getReactionWindowStatus(page);
  if (status.sourceId !== sourceId) {
    return false;
  }
  await test.step(description, async () => {
    await game.skip();
  });
  return true;
}

async function skipWoodenHorseIfPresent(
  page: Page,
  game: SkippableInteractionGame,
  description: string,
): Promise<void> {
  await skipCurrentInteractionIfSource(page, game, 'base_wooden_horse', description);
}

async function respondToCurrentInteraction(page: Page, payload: { optionId?: string; optionIds?: string[] }): Promise<void> {
  await page.evaluate((interactionPayload) => {
    type Harness = {
      state: { get: () => unknown };
      command: { dispatch: (command: { type: string; playerId?: string; payload?: unknown }) => void };
    };
    const harness = (window as unknown as { __BG_TEST_HARNESS__?: Harness }).__BG_TEST_HARNESS__;
    const state = harness?.state?.get?.() as { sys?: { interaction?: { current?: { playerId?: string } } } } | undefined;
    const current = state?.sys?.interaction?.current;
    if (!harness || !current?.playerId) {
      throw new Error('当前没有可响应的交互');
    }
    harness.command.dispatch({
      type: 'SYS_INTERACTION_RESPOND',
      playerId: current.playerId,
      payload: interactionPayload,
    });
  }, payload);
  await page.waitForTimeout(300);
}

async function selectMultiInteractionOptionsBy(
  page: Page,
  game: InteractionGame,
  matcher: (option: InteractionOption) => boolean,
  expectedCount: number,
  description: string,
): Promise<void> {
  const options = await game.getInteractionOptions();
  const selected = options.filter(matcher);
  expect(selected.length, description).toBe(expectedCount);
  await respondToCurrentInteraction(page, { optionIds: selected.map(option => option.id) });
}

async function clickHandCardThenMinion(page: Page, cardUid: string, minionUid: string): Promise<void> {
  await page.locator(`[data-card-uid="${cardUid}"]`).click({ force: true });
  await page.waitForTimeout(300);
  await page.locator(`[data-minion-uid="${minionUid}"]`).click({ force: true });
  await page.waitForTimeout(300);
}

async function dismissRevealOverlayIfPresent(page: Page): Promise<void> {
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

async function clickCardAtRatio(page: Page, selector: string, xRatio: number, yRatio: number): Promise<void> {
  const locator = page.locator(selector).first();
  await expect(locator).toBeVisible({ timeout: 15000 });
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(`无法取得元素坐标：${selector}`);
  }
  await page.mouse.click(box.x + box.width * xRatio, box.y + box.height * yRatio);
  await page.waitForTimeout(300);
}

test.describe('SmashUp shayu 三派系真实入口验证', () => {
  test('派系选择页能看到 Sharks / Tornados / Mythic Greeks 与素材卡', async ({ page, game }, testInfo) => {
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

    await page.getByTestId('faction-option-sharks').scrollIntoViewIfNeeded({ timeout: 15000 });
    await expect(page.getByTestId('faction-option-sharks')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('faction-option-tornados')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('faction-option-mythic_greeks')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('faction-implementation-banner-sharks')).toContainText('实施中');
    await expect(page.getByTestId('faction-implementation-banner-tornados')).toContainText('实施中');
    await expect(page.getByTestId('faction-implementation-banner-mythic_greeks')).toContainText('实施中');
    await page.getByTestId('faction-option-sharks').screenshot({ path: testInfo.outputPath('shayu-faction-option-sharks.png') });
    await page.getByTestId('faction-option-tornados').screenshot({ path: testInfo.outputPath('shayu-faction-option-tornados.png') });
    await page.getByTestId('faction-option-mythic_greeks').screenshot({ path: testInfo.outputPath('shayu-faction-option-mythic-greeks.png') });
    await game.screenshot('shayu-faction-selection-visible', testInfo);
  });

  test('Sharks 与 Tornados 代表行动可从手牌真实打出并完成交互', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'sharks,tornados',
      p1: 'mythic_greeks,robots',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260510,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      player0: {
        hand: [
          { uid: 'p0-torn-apart', defId: 'sharks_torn_apart', type: 'action' },
          { uid: 'p0-carried-away', defId: 'tornados_carried_away', type: 'action' },
        ],
        factions: ['sharks', 'tornados'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 2,
      },
      player1: {
        factions: ['mythic_greeks', 'robots'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      bases: [
        {
          defId: 'base_the_deep',
          minions: [
            { uid: 'p1-victim', defId: 'tornados_dust_devil', owner: '1', controller: '1', power: 2 },
            { uid: 'p1-move-me', defId: 'sharks_mako', owner: '1', controller: '1', power: 2 },
          ],
        },
        { defId: 'base_tornado_alley', minions: [], ongoingActions: [] },
      ],
      currentPlayer: '0',
      phase: 'playCards',
    });

    await game.waitForPhase('playCards');
    await expect(page.locator('[data-card-uid="p0-torn-apart"]')).toBeVisible();
    await game.playCard('sharks_torn_apart', { targetMinionUid: 'p1-victim' });
    await game.waitForNoInteraction(10000);
    await expect(page.locator('[data-minion-uid="p1-victim"]')).toHaveCount(0);
    await game.screenshot('shayu-sharks-torn-apart-after-destroy', testInfo);

    await game.playCard('tornados_carried_away', { targetBaseIndex: 0, targetMinionUid: 'p1-move-me' });
    await game.waitForInteraction('tornados_carried_away_dest', 10000);
    await game.selectInteractionOptionBy((option: unknown) => optionHasBaseIndex(option, 1), '移动到第二个基地');
    await game.waitForNoInteraction(10000);
    await expect(page.locator('[data-minion-uid="p1-move-me"]')).toBeVisible();
    await expect.poll(async () => {
      const state = await game.getState();
      return state.core.bases[1]?.minions.some((minion: { uid?: string }) => minion.uid === 'p1-move-me');
    }, { timeout: 5000 }).toBe(true);
    await game.screenshot('shayu-tornados-carried-away-after-move', testInfo);
  });

  test('Sharks 高风险链覆盖大白鲨天赋结算、飞鲨与激光束真实入口', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'sharks,tornados',
      p1: 'mythic_greeks,robots',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260512,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      player0: {
        hand: [
          { uid: 'p0-air-jaws', defId: 'sharks_air_jaws', type: 'action' },
          { uid: 'p0-laser', defId: 'sharks_freakin_laser_beam', type: 'action' },
        ],
        factions: ['sharks', 'tornados'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 3,
      },
      player1: {
        factions: ['mythic_greeks', 'robots'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      bases: [
        {
          defId: 'base_the_deep',
          minions: [
            { uid: 'great-white', defId: 'sharks_great_white', owner: '0', controller: '0', power: 4 },
            { uid: 'air-source', defId: 'sharks_mako', owner: '0', controller: '0', power: 2 },
            { uid: 'laser-source', defId: 'sharks_hammerhead', owner: '0', controller: '0', power: 3 },
            { uid: 'laser-low', defId: 'tornados_dust_devil', owner: '1', controller: '1', power: 2 },
          ],
        },
        {
          defId: 'base_wooden_horse',
          minions: [
            { uid: 'great-white-target', defId: 'tornados_dust_devil', owner: '1', controller: '1', power: 2 },
          ],
        },
        {
          defId: 'base_oracle_at_delphi',
          minions: [
            { uid: 'air-jaws-target', defId: 'tornados_dust_devil', owner: '1', controller: '1', power: 2 },
          ],
        },
      ],
      currentPlayer: '0',
      phase: 'playCards',
    });

    await game.waitForPhase('playCards');

    await expect(page.locator('[data-minion-uid="great-white"]')).toBeVisible({ timeout: 15000 });
    await clickCardAtRatio(page, '[data-minion-uid="great-white"]', 0.5, 0.18);
    await game.waitForInteraction('sharks_great_white', 10000);
    await game.screenshot('shayu-sharks-great-white-talent-destination-open', testInfo);
    await game.selectInteractionOptionBy((option: unknown) => optionHasBaseIndex(option, 1), '大白鲨移动到第二个基地');
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        moved: state.core.bases[1]?.minions.some((minion: { uid?: string }) => minion.uid === 'great-white') ?? false,
        targetRemoved: !(state.core.bases[1]?.minions.some((minion: { uid?: string }) => minion.uid === 'great-white-target') ?? false),
      };
    }, { timeout: 5000 }).toEqual({ moved: true, targetRemoved: true });
    await game.screenshot('shayu-sharks-great-white-after-move-destroy', testInfo);

    await game.playCard('sharks_air_jaws', { targetBaseIndex: 0, targetMinionUid: 'air-source' });
    await game.waitForInteraction('sharks_air_jaws_destination', 10000);
    await game.screenshot('shayu-sharks-air-jaws-destination-open', testInfo);
    await game.selectInteractionOptionBy((option: unknown) => optionHasBaseIndex(option, 2), '飞鲨移动到第三个基地');
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        moved: state.core.bases[2]?.minions.some((minion: { uid?: string }) => minion.uid === 'air-source') ?? false,
        targetRemoved: !(state.core.bases[2]?.minions.some((minion: { uid?: string }) => minion.uid === 'air-jaws-target') ?? false),
      };
    }, { timeout: 5000 }).toEqual({ moved: true, targetRemoved: true });
    await game.screenshot('shayu-sharks-air-jaws-after-move-destroy', testInfo);

    await game.playCard('sharks_freakin_laser_beam', { targetBaseIndex: 0, targetMinionUid: 'laser-source' });
    await game.waitForInteraction('sharks_freakin_laser_beam', 10000);
    await game.screenshot('shayu-sharks-laser-beam-target-open', testInfo);
    await game.selectInteractionOptionBy((option: unknown) => optionHasMinionUid(option, 'laser-low'), '激光束消灭同基地低战力目标');
    await game.waitForNoInteraction(10000);
    await expect(page.locator('[data-minion-uid="laser-low"]')).toHaveCount(0);
    await game.screenshot('shayu-sharks-laser-beam-after-destroy', testInfo);
  });

  test('Sharks 灰鲭鲨不会把火焰陷阱的无归因消灭误判成自己消灭', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'sharks,tornados',
      p1: 'tricksters,robots',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260523,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      player0: {
        hand: [
          { uid: 'p0-mako', defId: 'sharks_mako', type: 'minion' },
          { uid: 'p0-hammerhead', defId: 'sharks_hammerhead', type: 'minion' },
        ],
        factions: ['sharks', 'tornados'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: {
        factions: ['tricksters', 'robots'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      bases: [
        {
          defId: 'base_shark_reef',
          minions: [],
          ongoingActions: [{ uid: 'enemy-trap', defId: 'trickster_flame_trap', ownerId: '1' }],
        },
      ],
      currentPlayer: '0',
      phase: 'playCards',
    });

    await game.waitForPhase('playCards');
    await expect(page.locator('[data-card-uid="p0-mako"]')).toBeVisible({ timeout: 15000 });
    await game.playCard('sharks_hammerhead', { targetBaseIndex: 0 });
    await game.waitForNoInteraction(10000);

    await expect(page.locator('[data-card-uid="p0-mako"]')).toBeVisible();
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        currentSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
        makoStillInHand: state.core.players['0']?.hand.some((card: { uid?: string }) => card.uid === 'p0-mako') ?? false,
        hammerheadDestroyed: !(state.core.bases[0]?.minions.some((minion: { uid?: string }) => minion.uid === 'p0-hammerhead') ?? false),
        flameTrapDetached: !(state.core.bases[0]?.ongoingActions.some((action: { uid?: string }) => action.uid === 'enemy-trap') ?? false),
        unexpectedExtraMako: state.core.bases[0]?.minions.some((minion: { uid?: string }) => minion.uid === 'p0-mako') ?? false,
      };
    }, { timeout: 5000 }).toEqual({
      currentSourceId: null,
      makoStillInHand: true,
      hammerheadDestroyed: true,
      flameTrapDetached: true,
      unexpectedExtraMako: false,
    });
    await game.screenshot('shayu-sharks-mako-flame-trap-no-extra-play', testInfo);
  });

  test('Mythic Greeks 代表行动可从手牌真实打出并改变权威状态', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'sharks,tornados',
      p1: 'mythic_greeks,robots',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260511,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      player0: {
        factions: ['sharks', 'tornados'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: {
        hand: [
          { uid: 'p1-apollo', defId: 'mythic_greeks_favor_of_apollo', type: 'action' },
        ],
        deck: [
          { uid: 'p1-draw', defId: 'mythic_greeks_spartan', type: 'minion' },
        ],
        factions: ['mythic_greeks', 'robots'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      bases: [
        { defId: 'base_oracle_at_delphi', minions: [], ongoingActions: [] },
      ],
      currentPlayer: '1',
      phase: 'playCards',
    });

    await game.waitForCurrentPlayer('1');
    await expect(page.locator('[data-card-uid="p1-apollo"]')).toBeVisible();
    await game.playCard('mythic_greeks_favor_of_apollo');
    await game.waitForNoInteraction(10000);
    await expect(page.locator('[data-card-uid="p1-draw"]')).toBeVisible();
    await expect.poll(async () => {
      const state = await game.getState();
      return state.core.players['1'].actionLimit;
    }, { timeout: 5000 }).toBe(2);
    await game.screenshot('shayu-mythic-greeks-apollo-after-action', testInfo);
  });

  test('Mythic Greeks 与 Tornados 复杂入口覆盖哈迪斯、宙斯、雅典娜和信风', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'mythic_greeks,tornados',
      p1: 'sharks,robots',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260512,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      player0: {
        hand: [
          { uid: 'p0-hades', defId: 'mythic_greeks_favor_of_hades', type: 'action' },
          { uid: 'p0-zeus', defId: 'mythic_greeks_favor_of_zeus', type: 'action' },
          { uid: 'p0-athena', defId: 'mythic_greeks_favor_of_athena', type: 'action' },
          { uid: 'p0-trade', defId: 'tornados_trade_winds', type: 'action' },
        ],
        deck: [
          { uid: 'athena-minion-a', defId: 'mythic_greeks_spartan', type: 'minion' },
          { uid: 'athena-action-pick', defId: 'mythic_greeks_favor_of_apollo', type: 'action' },
          { uid: 'athena-action-order', defId: 'sharks_torn_apart', type: 'action' },
          { uid: 'athena-minion-b', defId: 'sharks_mako', type: 'minion' },
          { uid: 'athena-minion-c', defId: 'tornados_dust_devil', type: 'minion' },
          { uid: 'athena-rest', defId: 'tornados_twister', type: 'minion' },
        ],
        discard: [
          { uid: 'hades-recover', defId: 'sharks_torn_apart', type: 'action' },
          { uid: 'hades-stay', defId: 'mythic_greeks_favor_of_apollo', type: 'action' },
          { uid: 'hades-minion-ignore', defId: 'mythic_greeks_spartan', type: 'minion' },
        ],
        factions: ['mythic_greeks', 'tornados'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 5,
      },
      player1: {
        factions: ['sharks', 'robots'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      bases: [
        {
          defId: 'base_oracle_at_delphi',
          minions: [
            { uid: 'trade-first', defId: 'sharks_mako', owner: '0', controller: '0', power: 2 },
          ],
        },
        {
          defId: 'base_wooden_horse',
          minions: [
            { uid: 'trade-second', defId: 'tornados_dust_devil', owner: '1', controller: '1', power: 2 },
            { uid: 'trade-too-big', defId: 'sharks_hammerhead', owner: '1', controller: '1', power: 4 },
          ],
        },
      ],
      currentPlayer: '0',
      phase: 'playCards',
    });

    await game.waitForPhase('playCards');

    await game.playCard('mythic_greeks_favor_of_hades');
    await game.waitForInteraction('mythic_greeks_favor_of_hades', 10000);
    await game.screenshot('shayu-mythic-greeks-hades-discard-choice-open', testInfo);
    await game.selectInteractionOptionBy((option: unknown) => {
      const value = (option as { value?: { cardUid?: string } })?.value;
      return value?.cardUid === 'hades-recover';
    }, '哈迪斯选择弃牌堆行动回手');
    await skipWoodenHorseIfPresent(page, game, '哈迪斯行动后跳过特洛伊木马可选触发');
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      return state.core.players['0']?.hand.some((card: { uid?: string }) => card.uid === 'hades-recover') ?? false;
    }, { timeout: 5000 }).toBe(true);
    await game.screenshot('shayu-mythic-greeks-hades-after-recover', testInfo);

    await game.playCard('mythic_greeks_favor_of_zeus', { targetBaseIndex: 1 });
    await skipWoodenHorseIfPresent(page, game, '宙斯行动后跳过特洛伊木马可选触发');
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      return state.core.tempBreakpointModifiers?.[1] ?? 0;
    }, { timeout: 5000 }).toBe(-5);
    await game.screenshot('shayu-mythic-greeks-zeus-after-breakpoint', testInfo);

    await game.playCard('mythic_greeks_favor_of_athena');
    await game.waitForInteraction('mythic_greeks_favor_of_athena_pick', 10000);
    await game.screenshot('shayu-mythic-greeks-athena-pick-open', testInfo);
    await game.selectInteractionOptionBy((option: unknown) => {
      const value = (option as { value?: { cardUid?: string } })?.value;
      return value?.cardUid === 'athena-action-pick';
    }, '雅典娜选择一张行动牌入手');
    await game.waitForInteraction('mythic_greeks_favor_of_athena_order', 10000);
    await game.screenshot('shayu-mythic-greeks-athena-order-open', testInfo);
    await game.selectInteractionOptionBy((option: unknown) => {
      const value = (option as { value?: { cardUid?: string } })?.value;
      return value?.cardUid === 'athena-minion-b';
    }, '雅典娜第一张回顶牌');
    await game.waitForInteraction('mythic_greeks_favor_of_athena_order', 10000);
    await game.selectInteractionOptionBy((option: unknown) => {
      const value = (option as { value?: { cardUid?: string } })?.value;
      return value?.cardUid === 'athena-minion-a';
    }, '雅典娜第二张回顶牌');
    await game.waitForInteraction('mythic_greeks_favor_of_athena_order', 10000);
    await game.selectInteractionOptionBy((option: unknown) => {
      const value = (option as { value?: { cardUid?: string } })?.value;
      return value?.cardUid === 'athena-action-order';
    }, '雅典娜第三张回顶牌');
    await skipWoodenHorseIfPresent(page, game, '雅典娜行动后跳过特洛伊木马可选触发');
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        picked: state.core.players['0']?.hand.some((card: { uid?: string }) => card.uid === 'athena-action-pick') ?? false,
        topTwo: state.core.players['0']?.deck.slice(0, 2).map((card: { uid?: string }) => card.uid).join(','),
      };
    }, { timeout: 5000 }).toEqual({ picked: true, topTwo: 'athena-minion-b,athena-minion-a' });
    await dismissRevealOverlayIfPresent(page);
    await game.screenshot('shayu-mythic-greeks-athena-after-order', testInfo);

    await game.playCard('tornados_trade_winds');
    await game.waitForInteraction('tornados_trade_winds_first', 10000);
    await game.screenshot('shayu-tornados-trade-winds-first-open', testInfo);
    await game.selectInteractionOptionBy((option: unknown) => optionHasMinionUid(option, 'trade-first'), '信风选择第一个随从');
    await game.waitForInteraction('tornados_trade_winds_second', 10000);
    await game.screenshot('shayu-tornados-trade-winds-second-open', testInfo);
    await game.selectInteractionOptionBy((option: unknown) => optionHasMinionUid(option, 'trade-second'), '信风选择另一基地第二个随从');
    await skipWoodenHorseIfPresent(page, game, '信风行动后跳过特洛伊木马可选触发');
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        firstMoved: state.core.bases[1]?.minions.some((minion: { uid?: string }) => minion.uid === 'trade-first') ?? false,
        secondMoved: state.core.bases[0]?.minions.some((minion: { uid?: string }) => minion.uid === 'trade-second') ?? false,
      };
    }, { timeout: 5000 }).toEqual({ firstMoved: true, secondMoved: true });
    await game.screenshot('shayu-tornados-trade-winds-after-swap', testInfo);
  });

  test('Sharks 疯狂进食与 Tornados 旋风群覆盖多选和逐目标移动交互', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'sharks,tornados',
      p1: 'mythic_greeks,robots',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260512,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      player0: {
        hand: [
          { uid: 'p0-feeding-frenzy', defId: 'sharks_feeding_frenzy', type: 'action' },
          { uid: 'p0-whirlwinds', defId: 'tornados_whirlwinds', type: 'action' },
        ],
        factions: ['sharks', 'tornados'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 3,
      },
      player1: {
        factions: ['mythic_greeks', 'robots'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      bases: [
        {
          defId: 'base_the_deep',
          minions: [
            { uid: 'p1-feed-a', defId: 'tornados_dust_devil', owner: '1', controller: '1', power: 2 },
            { uid: 'p1-feed-b', defId: 'sharks_mako', owner: '1', controller: '1', power: 2 },
            { uid: 'p1-feed-big', defId: 'tornados_twister', owner: '1', controller: '1', power: 3 },
          ],
        },
        {
          defId: 'base_tornado_alley',
          minions: [
            { uid: 'p0-whirl-a', defId: 'sharks_mako', owner: '0', controller: '0', power: 2 },
            { uid: 'p0-whirl-b', defId: 'tornados_twister', owner: '0', controller: '0', power: 3 },
          ],
        },
        { defId: 'base_oracle_at_delphi', minions: [], ongoingActions: [] },
      ],
      currentPlayer: '0',
      phase: 'playCards',
    });

    await game.waitForPhase('playCards');
    await game.playCard('sharks_feeding_frenzy', { targetBaseIndex: 0 });
    await game.waitForInteraction('sharks_feeding_frenzy', 10000);
    await selectMultiInteractionOptionsBy(
      page,
      game,
      option => optionHasMinionUid(option, 'p1-feed-a') || optionHasMinionUid(option, 'p1-feed-b'),
      2,
      '疯狂进食应能多选两个力量≤2随从',
    );
    await game.waitForNoInteraction(10000);
    await expect(page.locator('[data-minion-uid="p1-feed-a"]')).toHaveCount(0);
    await expect(page.locator('[data-minion-uid="p1-feed-b"]')).toHaveCount(0);
    await expect(page.locator('[data-minion-uid="p1-feed-big"]')).toBeVisible();
    await game.screenshot('shayu-sharks-feeding-frenzy-after-multi-destroy', testInfo);

    await game.playCard('tornados_whirlwinds');
    await game.waitForInteraction('tornados_whirlwinds', 10000);
    await selectMultiInteractionOptionsBy(
      page,
      game,
      option => optionHasMinionUid(option, 'p0-whirl-a') || optionHasMinionUid(option, 'p0-whirl-b'),
      2,
      '旋风群应能多选两个己方随从',
    );

    await game.waitForInteraction('tornados_whirlwinds_dest', 10000);
    await game.selectInteractionOptionBy((option: unknown) => optionHasBaseIndex(option, 0), '第一个旋风群目标移动到第一个基地');
    await game.waitForInteraction('tornados_whirlwinds_dest', 10000);
    await game.selectInteractionOptionBy((option: unknown) => optionHasBaseIndex(option, 2), '第二个旋风群目标移动到第三个基地');
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        firstHasWhirlA: state.core.bases[0]?.minions.some((minion: { uid?: string }) => minion.uid === 'p0-whirl-a'),
        thirdHasWhirlB: state.core.bases[2]?.minions.some((minion: { uid?: string }) => minion.uid === 'p0-whirl-b'),
      };
    }, { timeout: 5000 }).toEqual({ firstHasWhirlA: true, thirdHasWhirlB: true });
    await game.screenshot('shayu-tornados-whirlwinds-after-per-minion-destinations', testInfo);
  });

  test('Tornados 旋风真实入口必须允许跳过可选移动', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'tornados,sharks',
      p1: 'mythic_greeks,robots',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260514,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      player0: {
        hand: [
          { uid: 'p0-twister', defId: 'tornados_twister', type: 'minion' },
        ],
        factions: ['tornados', 'sharks'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: {
        factions: ['mythic_greeks', 'robots'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      bases: [
        { defId: 'base_trailer_park', minions: [] },
        {
          defId: 'base_wooden_horse',
          minions: [
            { uid: 'twister-pull-candidate', defId: 'sharks_mako', owner: '1', controller: '1', power: 2 },
          ],
        },
      ],
      currentPlayer: '0',
      phase: 'playCards',
    });

    await game.waitForPhase('playCards');
    await game.playCard('tornados_twister', { targetBaseIndex: 0 });
    await game.waitForInteraction('tornados_twister', 10000);
    await expect(page.getByRole('button', { name: /^(跳过|Skip)(?:\s*\(\d+\))?$/i })).toBeVisible();
    await game.screenshot('shayu-tornados-twister-skip-open', testInfo);

    await game.skip();
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        twisterPlayedHere: state.core.bases[0]?.minions.some((minion: { uid?: string }) => minion.uid === 'p0-twister') ?? false,
        candidateStayedThere: state.core.bases[1]?.minions.some((minion: { uid?: string }) => minion.uid === 'twister-pull-candidate') ?? false,
        candidateNotPulled: state.core.bases[0]?.minions.some((minion: { uid?: string }) => minion.uid === 'twister-pull-candidate') ?? false,
      };
    }, { timeout: 5000 }).toEqual({
      twisterPlayedHere: true,
      candidateStayedThere: true,
      candidateNotPulled: false,
    });
    await game.screenshot('shayu-tornados-twister-after-skip', testInfo);
  });

  test('Mythic Greeks 赫拉与波塞冬覆盖随从多选和弃牌多选交互', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'sharks,tornados',
      p1: 'mythic_greeks,robots',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260513,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      player0: {
        factions: ['sharks', 'tornados'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: {
        hand: [
          { uid: 'p1-hera', defId: 'mythic_greeks_favor_of_hera', type: 'action' },
          { uid: 'p1-poseidon', defId: 'mythic_greeks_favor_of_poseidon', type: 'action' },
        ],
        discard: [
          { uid: 'p1-discard-a', defId: 'mythic_greeks_favor_of_hades', type: 'action' },
          { uid: 'p1-discard-b', defId: 'mythic_greeks_favor_of_zeus', type: 'action' },
          { uid: 'p1-discard-c', defId: 'mythic_greeks_argonaut', type: 'minion' },
        ],
        deck: [
          { uid: 'p1-deck-anchor', defId: 'mythic_greeks_spartan', type: 'minion' },
        ],
        factions: ['mythic_greeks', 'robots'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 3,
      },
      bases: [
        {
          defId: 'base_oracle_at_delphi',
          minions: [
            { uid: 'p1-greek-a', defId: 'robot_zapbot', owner: '1', controller: '1', power: 2 },
            { uid: 'p0-enemy-a', defId: 'sharks_mako', owner: '0', controller: '0', power: 2 },
          ],
        },
        {
          defId: 'base_the_deep',
          minions: [
            { uid: 'p1-greek-b', defId: 'robot_hoverbot', owner: '1', controller: '1', power: 3 },
          ],
          ongoingActions: [],
        },
      ],
      currentPlayer: '1',
      phase: 'playCards',
    });

    await game.waitForCurrentPlayer('1');
    await game.playCard('mythic_greeks_favor_of_hera');
    await game.waitForInteraction('mythic_greeks_favor_of_hera', 10000);
    await selectMultiInteractionOptionsBy(
      page,
      game,
      option => optionHasMinionUid(option, 'p1-greek-a') || optionHasMinionUid(option, 'p0-enemy-a'),
      2,
      '赫拉的恩惠应能选择至多两个任意玩家的随从',
    );
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      const minions = state.core.bases.flatMap((base: { minions?: Array<{ uid?: string; powerCounters?: number }> }) => base.minions ?? []);
      return minions
        .filter((minion: { uid?: string }) => minion.uid === 'p1-greek-a' || minion.uid === 'p0-enemy-a')
        .map((minion: { powerCounters?: number }) => minion.powerCounters ?? 0)
        .sort();
    }, { timeout: 5000 }).toEqual([1, 1]);
    await game.screenshot('shayu-mythic-greeks-hera-after-two-counters', testInfo);

    await game.playCard('mythic_greeks_favor_of_poseidon');
    await game.waitForInteraction('mythic_greeks_favor_of_poseidon', 10000);
    await selectMultiInteractionOptionsBy(
      page,
      game,
      option => {
        const value = option.value;
        if (!value || typeof value !== 'object') return false;
        const cardUid = (value as { cardUid?: unknown }).cardUid;
        return cardUid === 'p1-discard-a' || cardUid === 'p1-discard-b';
      },
      2,
      '波塞冬的恩惠应能选择两张弃牌洗回牌库',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state.core.players['1'];
      return {
        deckUids: player.deck.map((card: { uid?: string }) => card.uid),
        discardUids: player.discard.map((card: { uid?: string }) => card.uid),
      };
    }, { timeout: 5000 }).toEqual({
      deckUids: expect.arrayContaining(['p1-discard-a', 'p1-discard-b', 'p1-deck-anchor']),
      discardUids: expect.not.arrayContaining(['p1-discard-a', 'p1-discard-b']),
    });
    await game.screenshot('shayu-mythic-greeks-poseidon-after-discard-shuffle', testInfo);
  });

  test('Tornados 扯走覆盖基地持续行动与随从附着行动的 detach + attach 转移', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'tornados,dinosaurs',
      p1: 'sharks,mythic_greeks',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260514,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      player0: {
        hand: [
          { uid: 'p0-ripped-off-base', defId: 'tornados_ripped_off', type: 'action' },
          { uid: 'p0-ripped-off-minion', defId: 'tornados_ripped_off', type: 'action' },
        ],
        factions: ['tornados', 'dinosaurs'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 3,
      },
      player1: {
        factions: ['sharks', 'mythic_greeks'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      bases: [
        {
          defId: 'base_the_deep',
          minions: [
            {
              uid: 'attached-source-minion',
              defId: 'dino_war_raptor',
              owner: '0',
              controller: '0',
              power: 2,
              attachedActions: [{ uid: 'attached-upgrade', defId: 'dino_upgrade', ownerId: '0' }],
            },
          ],
          ongoingActions: [{ uid: 'base-preserve', defId: 'dino_wildlife_preserve', ownerId: '0' }],
        },
        {
          defId: 'base_tornado_alley',
          minions: [
            { uid: 'attached-target-minion', defId: 'sharks_mako', owner: '1', controller: '1', power: 2 },
          ],
          ongoingActions: [],
        },
      ],
      currentPlayer: '0',
      phase: 'playCards',
    });

    await game.waitForPhase('playCards');
    await game.playCard('tornados_ripped_off');
    await game.waitForInteraction('tornados_ripped_off', 10000);
    await game.selectInteractionOptionBy(
      (option: unknown) => {
        const value = (option as { value?: { cardUid?: string } })?.value;
        return value?.cardUid === 'base-preserve';
      },
      '选择基地持续行动“野生保护区”',
    );
    await game.waitForInteraction('tornados_ripped_off_target_base', 10000);
    await game.selectInteractionOptionBy((option: unknown) => optionHasBaseIndex(option, 1), '转移到第二个基地');
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        base0Actions: state.core.bases[0].ongoingActions.map((action: { uid?: string }) => action.uid),
        base1Actions: state.core.bases[1].ongoingActions.map((action: { uid?: string }) => action.uid),
      };
    }, { timeout: 5000 }).toEqual({
      base0Actions: expect.not.arrayContaining(['base-preserve']),
      base1Actions: expect.arrayContaining(['base-preserve']),
    });
    await game.screenshot('shayu-tornados-ripped-off-base-action-transferred', testInfo);

    await game.playCard('tornados_ripped_off');
    await game.waitForInteraction('tornados_ripped_off', 10000);
    await game.selectInteractionOptionBy(
      (option: unknown) => {
        const value = (option as { value?: { cardUid?: string } })?.value;
        return value?.cardUid === 'attached-upgrade';
      },
      '选择随从附着行动“升级”',
    );
    await game.waitForInteraction('tornados_ripped_off_target_minion', 10000);
    await game.selectInteractionOptionBy((option: unknown) => optionHasMinionUid(option, 'attached-target-minion'), '转移到第二个随从');
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      const minions = state.core.bases.flatMap((base: { minions?: Array<{ uid?: string; attachedActions?: Array<{ uid?: string }> }> }) => base.minions ?? []);
      const source = minions.find((minion: { uid?: string }) => minion.uid === 'attached-source-minion');
      const target = minions.find((minion: { uid?: string }) => minion.uid === 'attached-target-minion');
      return {
        sourceAttachments: source?.attachedActions?.map((action: { uid?: string }) => action.uid) ?? [],
        targetAttachments: target?.attachedActions?.map((action: { uid?: string }) => action.uid) ?? [],
      };
    }, { timeout: 5000 }).toEqual({
      sourceAttachments: expect.not.arrayContaining(['attached-upgrade']),
      targetAttachments: expect.arrayContaining(['attached-upgrade']),
    });
    await game.screenshot('shayu-tornados-ripped-off-minion-action-transferred', testInfo);
  });

  test('Tornados 不在堪萨斯替换基地时保留随从并清理基地/随从行动卡', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'tornados,dinosaurs',
      p1: 'sharks,mythic_greeks',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260515,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      player0: {
        hand: [
          { uid: 'p0-not-in-kansas', defId: 'tornados_not_in_kansas', type: 'action' },
        ],
        factions: ['tornados', 'dinosaurs'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: {
        factions: ['sharks', 'mythic_greeks'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      bases: [
        {
          defId: 'base_the_deep',
          minions: [
            {
              uid: 'kansas-survivor',
              defId: 'dino_war_raptor',
              owner: '0',
              controller: '0',
              power: 2,
              attachedActions: [{ uid: 'kansas-upgrade', defId: 'dino_upgrade', ownerId: '0' }],
            },
            { uid: 'kansas-rival', defId: 'sharks_mako', owner: '1', controller: '1', power: 2 },
          ],
          ongoingActions: [{ uid: 'kansas-preserve', defId: 'dino_wildlife_preserve', ownerId: '0' }],
        },
        { defId: 'base_tornado_alley', minions: [], ongoingActions: [] },
      ],
      currentPlayer: '0',
      phase: 'playCards',
      extra: {
        core: {
          baseDeck: ['base_oracle_at_delphi', 'base_trailer_park'],
        },
      },
    });

    await game.waitForPhase('playCards');
    await game.playCard('tornados_not_in_kansas', { targetBaseIndex: 0 });
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      const base = state.core.bases[0];
      const survivor = base.minions.find((minion: { uid?: string }) => minion.uid === 'kansas-survivor');
      return {
        baseDefId: base.defId,
        minionUids: base.minions.map((minion: { uid?: string }) => minion.uid),
        baseActions: base.ongoingActions.map((action: { uid?: string }) => action.uid),
        survivorAttachments: survivor?.attachedActions?.map((action: { uid?: string }) => action.uid) ?? [],
        baseDeck: state.core.baseDeck,
      };
    }, { timeout: 5000 }).toEqual({
      baseDefId: 'base_oracle_at_delphi',
      minionUids: expect.arrayContaining(['kansas-survivor', 'kansas-rival']),
      baseActions: [],
      survivorAttachments: [],
      baseDeck: ['base_trailer_park', 'base_the_deep'],
    });
    await game.screenshot('shayu-tornados-not-in-kansas-after-base-replace', testInfo);
  });

  test('Tornado Alley 基地能力在本回合首次移入时触发，第二次移入不重复触发', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'tornados,sharks',
      p1: 'mythic_greeks,robots',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260516,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      player0: {
        hand: [
          { uid: 'p0-carried-to-alley-a', defId: 'tornados_carried_away', type: 'action' },
          { uid: 'p0-carried-to-alley-b', defId: 'tornados_carried_away', type: 'action' },
        ],
        factions: ['tornados', 'sharks'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 3,
      },
      player1: {
        factions: ['mythic_greeks', 'robots'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      bases: [
        {
          defId: 'base_the_deep',
          minions: [
            { uid: 'alley-first-mover', defId: 'sharks_mako', owner: '0', controller: '0', power: 2 },
            { uid: 'alley-second-mover', defId: 'tornados_twister', owner: '0', controller: '0', power: 3 },
          ],
        },
        { defId: 'base_tornado_alley', minions: [], ongoingActions: [] },
        {
          defId: 'base_oracle_at_delphi',
          minions: [
            { uid: 'alley-pulled-by-base', defId: 'mythic_greeks_spartan', owner: '0', controller: '0', power: 2 },
          ],
          ongoingActions: [],
        },
      ],
      currentPlayer: '0',
      phase: 'playCards',
    });

    await game.waitForPhase('playCards');
    await clickHandCardThenMinion(page, 'p0-carried-to-alley-a', 'alley-first-mover');
    await game.waitForInteraction('tornados_carried_away_dest', 10000);
    await game.selectInteractionOptionBy((option: unknown) => optionHasBaseIndex(option, 1), '移动到龙卷风走廊');

    await game.waitForInteraction('base_tornado_alley', 10000);
    await game.screenshot('shayu-tornado-alley-trigger-open', testInfo);
    await game.selectInteractionOptionBy((option: unknown) => optionHasMinionUid(option, 'alley-pulled-by-base'), '基地能力拉入另一个随从');
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        alleyMinions: state.core.bases[1].minions.map((minion: { uid?: string }) => minion.uid),
        usedBaseAbilityCount: (state.core.usedBaseAbilitiesThisTurn ?? []).filter((entry: { baseDefId?: string }) => entry.baseDefId === 'base_tornado_alley').length,
      };
    }, { timeout: 5000 }).toEqual({
      alleyMinions: expect.arrayContaining(['alley-first-mover', 'alley-pulled-by-base']),
      usedBaseAbilityCount: 1,
    });
    await game.screenshot('shayu-tornado-alley-after-first-trigger', testInfo);

    await clickHandCardThenMinion(page, 'p0-carried-to-alley-b', 'alley-second-mover');
    await game.waitForInteraction('tornados_carried_away_dest', 10000);
    await game.selectInteractionOptionBy((option: unknown) => optionHasBaseIndex(option, 1), '第二次移动到龙卷风走廊');
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        alleyMinions: state.core.bases[1].minions.map((minion: { uid?: string }) => minion.uid),
        interactionSourceId: state.sys.interaction?.current?.data?.sourceId ?? null,
        usedBaseAbilityCount: (state.core.usedBaseAbilitiesThisTurn ?? []).filter((entry: { baseDefId?: string }) => entry.baseDefId === 'base_tornado_alley').length,
      };
    }, { timeout: 5000 }).toEqual({
      alleyMinions: expect.arrayContaining(['alley-first-mover', 'alley-pulled-by-base', 'alley-second-mover']),
      interactionSourceId: null,
      usedBaseAbilityCount: 1,
    });
    await game.screenshot('shayu-tornado-alley-second-move-no-repeat-trigger', testInfo);
  });

  test('Mythic Greeks 阿尔戈英雄真实入场会触发奥德修斯/赫拉克勒斯/斯巴达人的行动后能力', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'sharks,tornados',
      p1: 'mythic_greeks,robots',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260517,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      player0: {
        factions: ['sharks', 'tornados'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: {
        hand: [
          { uid: 'p1-argonaut', defId: 'mythic_greeks_argonaut', type: 'minion' },
        ],
        factions: ['mythic_greeks', 'robots'],
        minionsPlayed: 1,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      bases: [
        {
          defId: 'base_oracle_at_delphi',
          minions: [
            { uid: 'greek-odysseus', defId: 'mythic_greeks_odysseus', owner: '1', controller: '1', power: 3 },
            { uid: 'greek-jason', defId: 'mythic_greeks_jason', owner: '1', controller: '1', power: 4 },
            { uid: 'greek-heracles', defId: 'mythic_greeks_heracles', owner: '1', controller: '1', power: 5 },
            { uid: 'greek-spartan', defId: 'mythic_greeks_spartan', owner: '1', controller: '1', power: 2 },
          ],
        },
        {
          defId: 'base_the_deep',
          minions: [
            { uid: 'greek-jason-target', defId: 'sharks_mako', owner: '1', controller: '1', power: 2 },
            { uid: 'greek-enemy-target', defId: 'tornados_dust_devil', owner: '0', controller: '0', power: 2 },
          ],
          ongoingActions: [],
        },
      ],
      currentPlayer: '1',
      phase: 'playCards',
    });

    await game.waitForCurrentPlayer('1');
    await game.playCard('mythic_greeks_argonaut', { targetBaseIndex: 0 });
    await game.waitForInteraction('mythic_greeks_argonaut_odysseus', 10000);
    await game.screenshot('shayu-mythic-greeks-argonaut-odysseus-prompt', testInfo);
    await game.selectInteractionOptionBy((option: unknown) => optionHasMinionUid(option, 'greek-odysseus'), '阿尔戈触发奥德修斯给奥德修斯放 +1 指示物');
    await game.waitForInteraction('mythic_greeks_jason', 10000);
    await game.screenshot('shayu-mythic-greeks-argonaut-jason-prompt', testInfo);
    await game.selectInteractionOptionBy((option: unknown) => optionHasBaseIndex(option, 1), '阿尔戈继续触发伊阿宋选择第二基地');
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      const minions = state.core.bases[0].minions;
      const byUid = (uid: string) => minions.find((minion: { uid?: string }) => minion.uid === uid);
      const secondBaseMinions = state.core.bases[1].minions;
      const secondByUid = (uid: string) => secondBaseMinions.find((minion: { uid?: string }) => minion.uid === uid);
      return {
        argonautInPlay: minions.some((minion: { uid?: string }) => minion.uid === 'p1-argonaut'),
        minionsPlayed: state.core.players['1'].minionsPlayed,
        actionsPlayed: state.core.players['1'].actionsPlayed,
        odysseusCounters: byUid('greek-odysseus')?.powerCounters ?? 0,
        heraclesTempPower: byUid('greek-heracles')?.tempPowerModifier ?? 0,
        spartanCounters: byUid('greek-spartan')?.powerCounters ?? 0,
        spartanTurnFlag: byUid('greek-spartan')?.metadata?.mythicGreeksSpartanTriggeredTurn ?? null,
        jasonTargetTempPower: secondByUid('greek-jason-target')?.tempPowerModifier ?? 0,
        enemyTargetTempPower: secondByUid('greek-enemy-target')?.tempPowerModifier ?? 0,
        jasonTurnFlag: byUid('greek-jason')?.metadata?.mythicGreeksJasonTriggeredTurn ?? null,
      };
    }, { timeout: 5000 }).toEqual({
      argonautInPlay: true,
      minionsPlayed: 1,
      actionsPlayed: 1,
      odysseusCounters: 1,
      heraclesTempPower: 1,
      spartanCounters: 1,
      spartanTurnFlag: 1,
      jasonTargetTempPower: 1,
      enemyTargetTempPower: 0,
      jasonTurnFlag: 1,
    });
    await game.screenshot('shayu-mythic-greeks-argonaut-after-action-triggers', testInfo);
  });

  test('Tornados 计分前特殊牌从 Me First 窗口打出并完成移入/移出计分基地', async ({ page, game }, testInfo) => {
    test.setTimeout(150000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'tornados,dinosaurs',
      p1: 'sharks,mythic_greeks',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260518,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      player0: {
        hand: [
          { uid: 'p0-over-rainbow', defId: 'tornados_over_the_rainbow', type: 'action' },
          { uid: 'p0-picked-up', defId: 'tornados_picked_up', type: 'action' },
        ],
        factions: ['tornados', 'dinosaurs'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: {
        factions: ['sharks', 'mythic_greeks'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      bases: [
        {
          defId: 'base_the_deep',
          minions: [
            { uid: 'score-anchor', defId: 'dino_king_rex', owner: '0', controller: '0', basePower: 16 },
          ],
        },
        {
          defId: 'base_oracle_at_delphi',
          minions: [
            { uid: 'rainbow-source', defId: 'tornados_twister', owner: '0', controller: '0', power: 3 },
          ],
          ongoingActions: [],
        },
        { defId: 'base_trailer_park', minions: [], ongoingActions: [] },
      ],
      currentPlayer: '0',
      phase: 'playCards',
    });

    await game.waitForPhase('playCards');
    await game.advancePhase();
    await game.waitForPhase('scoreBases', 10000);
    await game.waitForResponseWindow('meFirst', 10000);
    await game.screenshot('shayu-tornados-before-scoring-me-first-open', testInfo);

    await game.waitForInteraction('smashup_reaction_choose', 10000);
    await game.selectInteractionOptionBy(
      (option: InteractionOption) => option.label?.includes('飞越彩虹') === true,
      'Me First 选择飞越彩虹',
    );
    await game.waitForInteraction('tornados_over_the_rainbow', 10000);
    await game.selectInteractionOptionBy((option: unknown) => optionHasMinionUid(option, 'rainbow-source'), '飞越彩虹选择计分基地外的己方随从');
    await game.waitForInteraction('smashup_reaction_choose', 10000);
    await expect.poll(async () => {
      const state = await game.getState();
      return state.core.bases[0].minions.some((minion: { uid?: string }) => minion.uid === 'rainbow-source');
    }, { timeout: 5000 }).toBe(true);
    await game.screenshot('shayu-tornados-over-the-rainbow-after-move-in', testInfo);

    await game.waitForInteraction('smashup_reaction_choose', 10000);
    await game.selectInteractionOptionBy(
      (option: InteractionOption) => option.label?.includes('卷起') === true,
      'Me First 选择卷起',
    );
    await game.waitForInteraction('tornados_picked_up', 10000);
    await game.selectInteractionOptionBy((option: unknown) => optionHasMinionUid(option, 'rainbow-source'), '卷起选择刚移入计分基地的随从');
    await game.waitForInteraction('tornados_picked_up_dest', 10000);
    await game.selectInteractionOptionBy((option: unknown) => optionHasBaseIndex(option, 2), '卷起移到第三个基地');
    await game.waitForInteraction('smashup_reaction_choose', 10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        scoringHasRainbowSource: state.core.bases[0].minions.some((minion: { uid?: string }) => minion.uid === 'rainbow-source'),
        thirdHasRainbowSource: state.core.bases[2].minions.some((minion: { uid?: string }) => minion.uid === 'rainbow-source'),
        windowType: state.sys.responseWindow?.current?.windowType ?? null,
      };
    }, { timeout: 5000 }).toEqual({
      scoringHasRainbowSource: false,
      thirdHasRainbowSource: true,
      windowType: 'meFirst',
    });
    await game.screenshot('shayu-tornados-picked-up-after-move-out', testInfo);
  });

  test('Tornados 尘卷风计分前触发可选移动到计分基地', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'tornados,dinosaurs',
      p1: 'sharks,mythic_greeks',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260519,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      player0: {
        hand: [],
        factions: ['tornados', 'dinosaurs'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: {
        factions: ['sharks', 'mythic_greeks'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      bases: [
        {
          defId: 'base_the_deep',
          minions: [
            { uid: 'dust-score-anchor', defId: 'dino_king_rex', owner: '0', controller: '0', basePower: 16 },
          ],
        },
        {
          defId: 'base_oracle_at_delphi',
          minions: [
            { uid: 'dust-devil-source', defId: 'tornados_dust_devil', owner: '0', controller: '0', power: 2 },
          ],
          ongoingActions: [],
        },
      ],
      currentPlayer: '0',
      phase: 'playCards',
    });

    await game.waitForPhase('playCards');
    await game.advancePhase();
    await game.waitForPhase('scoreBases', 10000);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const sourceId = await page.evaluate(() => {
        const state = (window as unknown as BrowserHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
        return {
          interactionSourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
          windowType: state?.sys?.responseWindow?.current?.windowType ?? null,
        };
      });
      if (sourceId.interactionSourceId === 'tornados_dust_devil') break;
      if (sourceId.windowType) {
        await game.passResponseWindow();
      }
      await page.waitForTimeout(300);
    }

    await game.waitForInteraction('tornados_dust_devil', 10000);
    await game.screenshot('shayu-tornados-dust-devil-before-scoring-prompt', testInfo);
    await game.selectInteractionOptionBy(
      (option: unknown) => {
        const value = (option as { value?: { choice?: string } })?.value;
        return value?.choice === 'move';
      },
      '尘卷风选择移动到计分基地',
    );

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        scoringHasDustDevil: state.core.bases[0].minions.some((minion: { uid?: string }) => minion.uid === 'dust-devil-source'),
        sourceBaseHasDustDevil: state.core.bases[1].minions.some((minion: { uid?: string }) => minion.uid === 'dust-devil-source'),
      };
    }, { timeout: 5000 }).toEqual({
      scoringHasDustDevil: true,
      sourceBaseHasDustDevil: false,
    });
    await game.screenshot('shayu-tornados-dust-devil-after-move-to-scoring', testInfo);
  });

  test('Tornados 随风而逝从 afterScoring 窗口打出并让随从逃离清场', async ({ page, game }, testInfo) => {
    test.setTimeout(150000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'tornados,dinosaurs',
      p1: 'sharks,mythic_greeks',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260520,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      player0: {
        hand: [
          { uid: 'p0-gone-wind', defId: 'tornados_gone_with_the_wind', type: 'action' },
        ],
        factions: ['tornados', 'dinosaurs'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      player1: {
        factions: ['sharks', 'mythic_greeks'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
      },
      bases: [
        {
          defId: 'base_the_deep',
          minions: [
            { uid: 'gone-anchor', defId: 'dino_king_rex', owner: '0', controller: '0', basePower: 14 },
            { uid: 'gone-runner', defId: 'tornados_twister', owner: '0', controller: '0', power: 3 },
          ],
        },
        { defId: 'base_trailer_park', minions: [], ongoingActions: [] },
      ],
      currentPlayer: '0',
      phase: 'playCards',
      extra: {
        core: {
          baseDeck: ['base_oracle_at_delphi', 'base_tornado_alley'],
        },
      },
    });

    await game.waitForPhase('playCards');
    await game.advancePhase();
    await game.waitForPhase('scoreBases', 10000);
    await page.waitForFunction(
      () => {
        const state = (window as unknown as BrowserHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
        return state?.sys?.interaction?.current?.data?.sourceId === 'smashup_reaction_choose'
          || Boolean(state?.sys?.responseWindow?.current?.windowType);
      },
      { timeout: 10000, polling: 200 },
    );
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const status = await getReactionWindowStatus(page);
      const options = status.sourceId === 'smashup_reaction_choose'
        ? await game.getInteractionOptions()
        : [];
      if (status.windowType === 'afterScoring' && options.some((option) => option.label?.includes('随风而逝') === true)) break;
      const didPass = await passOpenReactionOrResponseWindow(page, game, `随风而逝前置响应让过 ${attempt + 1}`);
      expect(didPass, '等待 afterScoring 随风而逝入口期间必须存在可让过的响应').toBe(true);
      await page.waitForTimeout(300);
    }
    await expect.poll(async () => {
      const status = await getReactionWindowStatus(page);
      const options = status.sourceId === 'smashup_reaction_choose'
        ? await game.getInteractionOptions()
        : [];
      return {
        windowType: status.windowType,
        hasGoneWithTheWind: options.some((option) => option.label?.includes('随风而逝') === true),
      };
    }, { timeout: 10000 }).toEqual({
      windowType: 'afterScoring',
      hasGoneWithTheWind: true,
    });
    await game.screenshot('shayu-tornados-gone-with-the-wind-after-scoring-open', testInfo);

    await game.waitForInteraction('smashup_reaction_choose', 10000);
    await game.selectInteractionOptionBy(
      (option: InteractionOption) => option.label?.includes('随风而逝') === true,
      'afterScoring 选择随风而逝',
    );
    await game.waitForInteraction('tornados_gone_with_the_wind', 10000);
    await game.selectInteractionOptionBy((option: unknown) => optionHasMinionUid(option, 'gone-runner'), '随风而逝选择计分基地上的己方随从');
    await game.waitForInteraction('tornados_gone_with_the_wind_dest', 10000);
    await game.selectInteractionOptionBy((option: unknown) => optionHasBaseIndex(option, 1), '随风而逝移动到第二个基地');

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        scoringHasRunner: state.core.bases[0].minions.some((minion: { uid?: string }) => minion.uid === 'gone-runner'),
        safeBaseHasRunner: state.core.bases[1].minions.some((minion: { uid?: string }) => minion.uid === 'gone-runner'),
      };
    }, { timeout: 5000 }).toEqual({
      scoringHasRunner: false,
      safeBaseHasRunner: true,
    });
    await game.screenshot('shayu-tornados-gone-with-the-wind-after-move-away', testInfo);

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const didPass = await passOpenReactionOrResponseWindow(page, game, `随风而逝收口响应让过 ${attempt + 1}`);
      if (!didPass) break;
    }

    await expect.poll(async () => {
      const state = await game.getState();
      const player0 = state.core.players['0'];
      return {
        safeBaseHasRunner: state.core.bases[1].minions.some((minion: { uid?: string }) => minion.uid === 'gone-runner'),
        runnerInDiscard: player0.discard.some((card: { uid?: string }) => card.uid === 'gone-runner'),
      };
    }, { timeout: 10000 }).toEqual({
      safeBaseHasRunner: true,
      runnerInDiscard: false,
    });
    await game.screenshot('shayu-tornados-gone-with-the-wind-after-scoring-cleanup', testInfo);
  });
});
