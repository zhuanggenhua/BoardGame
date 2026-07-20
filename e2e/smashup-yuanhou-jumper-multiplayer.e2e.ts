import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Locator, Page, TestInfo } from '@playwright/test';
import { expect, test } from './framework';
import { getEvidenceScreenshotPath, sanitizeEvidencePathSegment } from './framework/evidenceScreenshots';
import { setChineseLocale } from './helpers/common';
import { setupSmashUpOnlineMatch, waitForSmashUpUI } from './helpers/smashup';
import { getMatchState, injectMatchState } from './helpers/state-injection';

function hasUid(items: unknown, uid: string): boolean {
  return Array.isArray(items)
    && items.some(item => typeof item === 'object' && item !== null && (item as { uid?: unknown }).uid === uid);
}

function hasSkipOption(options: unknown): boolean {
  return Array.isArray(options)
    && options.some(option =>
      typeof option === 'object'
      && option !== null
      && (option as { id?: unknown; value?: { skip?: unknown } }).id === 'skip'
      && (option as { value?: { skip?: unknown } }).value?.skip === true,
    );
}

async function readHarnessState(page: Page): Promise<any> {
  return page.evaluate(() => {
    const harness = (window as any).__BG_TEST_HARNESS__;
    return harness?.state?.get?.() ?? null;
  });
}

async function readMatchRoomLiveSnapshot(page: Page): Promise<any> {
  return page.evaluate(() => {
    const globalWindow = window as Window & {
      __BG_MATCHROOM_DEBUG__?: {
        getLiveSnapshot?: () => unknown;
      };
    };
    return globalWindow.__BG_MATCHROOM_DEBUG__?.getLiveSnapshot?.() ?? null;
  });
}

async function startMatchRoomLiveTrace(page: Page, traceKey: string): Promise<void> {
  await page.evaluate((key) => {
    const globalWindow = window as Window & {
      __SU_MATCHROOM_LIVE_TRACE__?: Record<string, {
        intervalId?: number;
        samples: Array<Record<string, unknown>>;
      }>;
      __BG_MATCHROOM_DEBUG__?: {
        getLiveSnapshot?: () => unknown;
      };
    };
    const traces = globalWindow.__SU_MATCHROOM_LIVE_TRACE__ ?? {};
    const existing = traces[key];
    if (typeof existing?.intervalId === 'number') {
      window.clearInterval(existing.intervalId);
    }
    const record = {
      samples: [] as Array<Record<string, unknown>>,
      intervalId: window.setInterval(() => {
        const snapshot = globalWindow.__BG_MATCHROOM_DEBUG__?.getLiveSnapshot?.() ?? null;
        record.samples.push({
          ts: Date.now(),
          snapshot,
        });
        if (record.samples.length > 240) {
          record.samples.shift();
        }
      }, 50),
    };
    traces[key] = record;
    globalWindow.__SU_MATCHROOM_LIVE_TRACE__ = traces;
  }, traceKey);
}

async function stopMatchRoomLiveTrace(page: Page, traceKey: string): Promise<void> {
  await page.evaluate((key) => {
    const globalWindow = window as Window & {
      __SU_MATCHROOM_LIVE_TRACE__?: Record<string, {
        intervalId?: number;
      }>;
    };
    const intervalId = globalWindow.__SU_MATCHROOM_LIVE_TRACE__?.[key]?.intervalId;
    if (typeof intervalId === 'number') {
      window.clearInterval(intervalId);
    }
  }, traceKey);
}

async function readMatchRoomLiveTrace(page: Page, traceKey: string): Promise<Array<Record<string, unknown>>> {
  return page.evaluate((key) => {
    const globalWindow = window as Window & {
      __SU_MATCHROOM_LIVE_TRACE__?: Record<string, {
        samples?: Array<Record<string, unknown>>;
      }>;
    };
    return globalWindow.__SU_MATCHROOM_LIVE_TRACE__?.[key]?.samples ?? [];
  }, traceKey);
}

async function respondToCurrentInteractionOption(page: Page, optionId: string): Promise<void> {
  await page.evaluate(async (id) => {
    const harness = (window as any).__BG_TEST_HARNESS__;
    const state = harness?.state?.get?.();
    const interaction = state?.sys?.interaction?.current;
    const options = interaction?.data?.options ?? [];
    const option = options.find((entry: any) => entry?.id === id);

    if (!interaction || !option) {
      throw new Error(`Current interaction option not found: ${id}`);
    }

    await harness.command.dispatch({
      type: 'SYS_INTERACTION_RESPOND',
      playerId: interaction.playerId,
      payload: { optionId: id },
    });
  }, optionId);
  await page.waitForTimeout(300);
}

async function suppressDebugChromeForEvidence(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as Window & { __BG_HIDE_DEBUG_PANEL__?: boolean }).__BG_HIDE_DEBUG_PANEL__ = true;
    if (document.getElementById('__bg-hide-debug-evidence-style')) return;
    const style = document.createElement('style');
    style.id = '__bg-hide-debug-evidence-style';
    style.textContent = [
      '[data-testid="debug-toggle-container"] { opacity: 0 !important; pointer-events: none !important; }',
      '[data-testid="debug-panel"] { opacity: 0 !important; pointer-events: none !important; }',
    ].join('\n');
    document.head.appendChild(style);
  }).catch(() => {});
  await page.waitForTimeout(50);
}

async function screenshotViewport(page: Page, name: string, testInfo: TestInfo): Promise<void> {
  await suppressDebugChromeForEvidence(page);
  const path = getEvidenceScreenshotPath(testInfo, name, {
    filename: `${sanitizeEvidencePathSegment(name) || 'screenshot'}.png`,
  });
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage: false });
}

async function screenshotLocator(locator: Locator, name: string, testInfo: TestInfo): Promise<void> {
  await suppressDebugChromeForEvidence(locator.page());
  const path = getEvidenceScreenshotPath(testInfo, name, {
    filename: `${sanitizeEvidencePathSegment(name) || 'screenshot'}.png`,
  });
  await mkdir(dirname(path), { recursive: true });
  await locator.screenshot({ path });
}

async function expectOwnedOverlayPromptChromeSuppressed(page: Page): Promise<void> {
  await expect(page.getByTestId('fab-menu')).toHaveCount(0);
  await expect(page.locator('[data-tutorial-id="su-turn-tracker"]')).toHaveCount(0);
  await expect(page.getByTestId('su-end-turn-action-button')).toHaveCount(0);
  await expect(page.getByTestId('su-end-turn-hints')).toHaveCount(0);
  await expect(page.getByTestId('su-end-turn-visibility-toggle')).toHaveCount(0);
  await expect(page.locator('[data-tutorial-id="su-scoreboard"]')).toHaveCount(0);
  await expect(page.getByTestId('su-deck-stack')).toHaveCount(0);
  await expect(page.getByTestId('su-discard-toggle')).toHaveCount(0);
  await expect(page.getByTestId('debug-toggle-container')).toHaveCount(0);
  await expect(page.getByTestId('debug-panel')).toHaveCount(0);
}

async function dismissSmashUpSpotlightQueueIfVisible(page: Page): Promise<void> {
  const spotlightQueue = page.getByTestId('card-spotlight-queue');
  const visible = await spotlightQueue.isVisible().catch(() => false);
  if (!visible) return;
  await spotlightQueue.getByRole('button', { name: /^(关闭特写|Close spotlight)$/i }).click({ force: true });
  await expect(spotlightQueue).toBeHidden();
  await page.waitForTimeout(150);
}

async function installManualResyncTracker(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const globalWindow = window as Window & {
      __SU_MANUAL_RESYNC_TRACKER__?: {
        installed: boolean;
        manualResyncCount: number;
        reasons: string[];
      };
    };
    if (globalWindow.__SU_MANUAL_RESYNC_TRACKER__?.installed) return;

    const transportModule = await import('/src/engine/transport/client.ts');
    const proto = transportModule.GameTransportClient?.prototype as {
      sendSync?: (this: unknown, reason: string) => void;
    } | undefined;
    if (!proto?.sendSync) {
      throw new Error('GameTransportClient.sendSync not available');
    }

    const originalSendSync = proto.sendSync;
    globalWindow.__SU_MANUAL_RESYNC_TRACKER__ = {
      installed: true,
      manualResyncCount: 0,
      reasons: [],
    };

    proto.sendSync = function patchedSendSync(this: unknown, reason: string) {
      if (reason === 'manual-resync') {
        globalWindow.__SU_MANUAL_RESYNC_TRACKER__!.manualResyncCount += 1;
        globalWindow.__SU_MANUAL_RESYNC_TRACKER__!.reasons.push(reason);
      }
      return originalSendSync.call(this, reason);
    };
  });
}

async function getManualResyncCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const globalWindow = window as Window & {
      __SU_MANUAL_RESYNC_TRACKER__?: {
        manualResyncCount?: number;
      };
    };
    return globalWindow.__SU_MANUAL_RESYNC_TRACKER__?.manualResyncCount ?? 0;
  });
}

async function triggerShellVisibilityResync(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('bg-shell-app-hidden'));
  });
  await page.waitForTimeout(120);
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('bg-shell-app-visible'));
  });
}

test.describe('SmashUp yuanhou 多客户端真实链路', () => {
  test('电子猿-Missing Uplink-真实多客户端下拥有者结束回合后双方页面都应同步额外抽牌结果', async ({ page, game, browser }, testInfo) => {
    test.setTimeout(180000);
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
              hand: [],
              deck: [
                { uid: 'uplink-mp-draw-a', defId: 'cyborg_apes_baboom', type: 'minion', owner: '0' },
                { uid: 'uplink-mp-draw-b', defId: 'cyborg_apes_furious_george', type: 'minion', owner: '0' },
                { uid: 'uplink-mp-draw-c', defId: 'cyborg_apes_cyberback', type: 'minion', owner: '0' },
                { uid: 'uplink-mp-draw-d', defId: 'cyborg_apes_clyde_2_0', type: 'minion', owner: '0' },
                { uid: 'uplink-mp-draw-e', defId: 'cyborg_apes_baboom', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['cyborg_apes', 'super_spies'],
              minionsPlayed: 1,
              minionLimit: 1,
              actionsPlayed: 1,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [],
              deck: [],
              discard: [],
              factions: ['time_travelers', 'shapeshifters'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_monkey_lab',
              breakpoint: 23,
              minions: [
                {
                  uid: 'uplink-mp-host-a',
                  defId: 'cyborg_apes_furious_george',
                  controller: '0',
                  owner: '0',
                  basePower: 2,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [{ uid: 'uplink-mp-a', defId: 'cyborg_apes_missing_uplink', ownerId: '0' }],
                },
                {
                  uid: 'uplink-mp-host-b',
                  defId: 'cyborg_apes_baboom',
                  controller: '0',
                  owner: '0',
                  basePower: 2,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [{ uid: 'uplink-mp-b', defId: 'cyborg_apes_missing_uplink', ownerId: '0' }],
                },
              ],
              ongoingActions: [],
            },
            { defId: 'base_portal_room', breakpoint: 22, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    const preparedState = JSON.parse(JSON.stringify(await game.getState()));
    const setup = await setupSmashUpOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, {
      hostFactions: ['cyborg_apes', 'super_spies'],
      guestFactions: ['time_travelers', 'shapeshifters'],
      skipFactionSelection: true,
      testInfo,
    });
    if (!setup) {
      test.skip(true, 'SmashUp 联机房间创建失败');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

    try {
      const mergedState = JSON.parse(JSON.stringify(preparedState));
      mergedState.core = {
        ...mergedState.core,
        phase: preparedState?.sys?.phase ?? preparedState?.core?.phase ?? 'playCards',
        factionSelection: undefined,
        titans: [],
        triggerQueue: [],
      };
      mergedState.sys = {
        ...mergedState.sys,
        matchId,
        turnOrder: Array.isArray(preparedState?.core?.turnOrder)
          ? [...preparedState.core.turnOrder]
          : mergedState.sys?.turnOrder,
        currentPlayerIndex: typeof preparedState?.core?.currentPlayerIndex === 'number'
          ? preparedState.core.currentPlayerIndex
          : mergedState.sys?.currentPlayerIndex,
        phase: preparedState?.sys?.phase ?? mergedState.sys?.phase,
        interaction: {
          ...mergedState.sys?.interaction,
          current: undefined,
        },
        responseWindow: {
          ...mergedState.sys?.responseWindow,
          current: undefined,
        },
      };

      await injectMatchState(matchId, mergedState, hostPage);
      await hostPage.reload({ waitUntil: 'domcontentloaded' });
      await guestPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForSmashUpUI(hostPage);
      await waitForSmashUpUI(guestPage);

      await expect(hostPage.getByTestId('su-end-turn-action-button')).toBeVisible({ timeout: 15000 });
      await expect(hostPage.getByTestId('su-end-turn-hints')).toBeVisible({ timeout: 15000 });
      await expect(hostPage.getByTestId('su-end-turn-visibility-toggle')).toBeVisible({ timeout: 15000 });
      await screenshotViewport(hostPage, 'yuanhou-missing-uplink-multiplayer-before-end-turn-host', testInfo);

      await hostPage.getByTestId('su-end-turn-action-button').click();

      await expect.poll(async () => {
        const serverState = await getMatchState(matchId, hostPage);
        const p0Hand = serverState?.core?.players?.['0']?.hand?.map((card: any) => card.uid) ?? [];
        const p0Deck = serverState?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
        const base0 = serverState?.core?.bases?.[0];
        return serverState?.core?.currentPlayerIndex === 1
          && serverState?.sys?.phase === 'playCards'
          && p0Hand.join(',') === 'uplink-mp-draw-a,uplink-mp-draw-b,uplink-mp-draw-c,uplink-mp-draw-d'
          && p0Deck.join(',') === 'uplink-mp-draw-e'
          && base0?.minions?.some((minion: any) =>
            minion.uid === 'uplink-mp-host-a'
            && hasUid(minion.attachedActions, 'uplink-mp-a')
          )
          && base0?.minions?.some((minion: any) =>
            minion.uid === 'uplink-mp-host-b'
            && hasUid(minion.attachedActions, 'uplink-mp-b')
          )
          && serverState?.sys?.interaction?.current == null;
      }, {
        message: 'Host 真实结束回合后，服务端应按两张 Missing Uplink 额外抽两张并叠加正常结束回合抽两张，再进入 P1 出牌阶段',
        timeout: 20000,
      }).toBe(true);

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const guestState = await readHarnessState(guestPage);
        const hostHand = hostState?.core?.players?.['0']?.hand?.map((card: any) => card.uid) ?? [];
        const guestHand = guestState?.core?.players?.['0']?.hand?.map((card: any) => card.uid) ?? [];
        const hostDeck = hostState?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
        const guestDeck = guestState?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
        return hostState?.core?.currentPlayerIndex === 1
          && guestState?.core?.currentPlayerIndex === 1
          && hostState?.sys?.phase === 'playCards'
          && guestState?.sys?.phase === 'playCards'
          && hostState?.sys?.interaction?.current == null
          && guestState?.sys?.interaction?.current == null
          && hostHand.join(',') === 'uplink-mp-draw-a,uplink-mp-draw-b,uplink-mp-draw-c,uplink-mp-draw-d'
          && guestHand.join(',') === hostHand.join(',')
          && hostDeck.join(',') === 'uplink-mp-draw-e'
          && guestDeck.join(',') === hostDeck.join(',');
      }, {
        message: 'Missing Uplink 结算后，Host/Guest 两页都应同步到 P1 出牌阶段并看到一致的权威牌库/手牌结果',
        timeout: 20000,
      }).toBe(true);

      await expect(hostPage.getByText(/正在等待 Guest-SU-E2E/)).toHaveCount(0);
      await expect(guestPage.getByText(/正在等待 Host-SU-E2E/)).toHaveCount(0);
      await screenshotViewport(hostPage, 'yuanhou-missing-uplink-multiplayer-resolved-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-missing-uplink-multiplayer-resolved-guest', testInfo);
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });

  test('变形者-Bacta the Future-真实多客户端下敌方 owner 可自行跳过额外随从且双方页面正常收口', async ({ page, game, browser }, testInfo) => {
    test.setTimeout(180000);
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
                { uid: 'bacta-enemy-hand', defId: 'shapeshifters_bacta_the_future', type: 'action', owner: '0' },
                { uid: 'wrong-owner-mimic', defId: 'shapeshifters_mimic', type: 'minion', owner: '0' },
              ],
              deck: [],
              discard: [],
              factions: ['shapeshifters', 'super_spies'],
              minionsPlayed: 1,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [
                { uid: 'enemy-owner-extra-mimic', defId: 'shapeshifters_mimic', type: 'minion', owner: '1' },
              ],
              deck: [],
              discard: [],
              factions: ['shapeshifters', 'time_travelers'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_the_vats',
              breakpoint: 18,
              minions: [{
                uid: 'enemy-owned-target',
                defId: 'shapeshifters_copycat',
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
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    const preparedState = JSON.parse(JSON.stringify(await game.getState()));
    const setup = await setupSmashUpOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, {
      hostFactions: ['shapeshifters', 'super_spies'],
      guestFactions: ['shapeshifters', 'time_travelers'],
      skipFactionSelection: true,
      testInfo,
    });
    if (!setup) {
      test.skip(true, 'SmashUp 联机房间创建失败');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

    try {
      const mergedState = JSON.parse(JSON.stringify(preparedState));
      mergedState.core = {
        ...mergedState.core,
        phase: preparedState?.sys?.phase ?? preparedState?.core?.phase ?? 'playCards',
        factionSelection: undefined,
        titans: [],
        triggerQueue: [],
      };
      mergedState.sys = {
        ...mergedState.sys,
        matchId,
        turnOrder: Array.isArray(preparedState?.core?.turnOrder)
          ? [...preparedState.core.turnOrder]
          : mergedState.sys?.turnOrder,
        currentPlayerIndex: typeof preparedState?.core?.currentPlayerIndex === 'number'
          ? preparedState.core.currentPlayerIndex
          : mergedState.sys?.currentPlayerIndex,
        phase: preparedState?.sys?.phase ?? mergedState.sys?.phase,
        interaction: {
          ...mergedState.sys?.interaction,
          current: undefined,
        },
        responseWindow: {
          ...mergedState.sys?.responseWindow,
          current: undefined,
        },
      };

      await injectMatchState(matchId, mergedState, hostPage);
      await hostPage.reload({ waitUntil: 'domcontentloaded' });
      await guestPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForSmashUpUI(hostPage);
      await waitForSmashUpUI(guestPage);

      await expect(hostPage.locator('[data-card-uid="bacta-enemy-hand"]')).toBeVisible({ timeout: 15000 });
      await hostPage.locator('[data-card-uid="bacta-enemy-hand"]').click();
      await hostPage.locator('[data-minion-uid="enemy-owned-target"]').click();

      await expect.poll(async () => {
        const guestState = await readHarnessState(guestPage);
        const prompt = guestState?.sys?.interaction?.current;
        const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
        const optionCardUids = (prompt?.data?.options ?? [])
          .map((option: any) => option?.value?.cardUid)
          .filter((uid: unknown): uid is string => typeof uid === 'string');
        const guestDiscard = guestState?.core?.players?.['1']?.discard ?? [];
        const baseMinions = guestState?.core?.bases?.[0]?.minions ?? [];
        return prompt?.data?.sourceId === 'smashup_immediate_extra_minion'
          && prompt?.playerId === '1'
          && optionIds.includes('skip')
          && optionCardUids.includes('enemy-owner-extra-mimic')
          && !optionCardUids.includes('wrong-owner-mimic')
          && hasUid(guestDiscard, 'enemy-owned-target')
          && !hasUid(baseMinions, 'enemy-owned-target');
      }, {
        message: 'Host 用 Bacta 摧毁 Guest 的随从后，owner-only extra minion prompt 应只归 Guest 页面，且候选只来自 Guest 手牌',
        timeout: 20000,
      }).toBe(true);

      await expect(hostPage.getByRole('button', { name: '放弃这次额外随从' })).toHaveCount(0);
      await expect(hostPage.locator('[data-card-uid="enemy-owner-extra-mimic"]')).toHaveCount(0);
      await expect(guestPage.locator('[data-card-uid="bacta-enemy-hand"]')).toHaveCount(0);
      await expect(guestPage.locator('[data-card-uid="enemy-owner-extra-mimic"]')).toBeVisible({ timeout: 15000 });
      await expect(guestPage.getByRole('button', { name: '放弃这次额外随从' })).toBeVisible({ timeout: 15000 });
      await screenshotViewport(guestPage, 'yuanhou-bacta-enemy-owner-skip-prompt-guest', testInfo);
      await screenshotViewport(hostPage, 'yuanhou-bacta-enemy-owner-no-prompt-host', testInfo);

      await guestPage.getByRole('button', { name: '放弃这次额外随从' }).click();

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const guestState = await readHarnessState(guestPage);
        const hostPrompt = hostState?.sys?.interaction?.current;
        const guestPrompt = guestState?.sys?.interaction?.current;
        return hostPrompt == null
          && guestPrompt == null
          && hostState?.sys?.responseWindow?.current == null
          && guestState?.sys?.responseWindow?.current == null
          && hostState?.sys?.phase === 'playCards'
          && guestState?.sys?.phase === 'playCards';
      }, {
        message: 'Guest 跳过 Bacta 给予的额外随从后，应直接回到普通出牌态，且不应残留 interaction / response window',
        timeout: 20000,
      }).toBe(true);

      await expect(hostPage.getByRole('button', { name: '模仿者' })).toHaveCount(0);
      await expect(hostPage.getByRole('button', { name: '让过' })).toHaveCount(0);
      await expect(guestPage.getByRole('button', { name: '放弃这次额外随从' })).toHaveCount(0);
      await expect(guestPage.getByRole('button', { name: '模仿者' })).toHaveCount(0);
      await expect(guestPage.getByRole('button', { name: '让过' })).toHaveCount(0);

      await expect.poll(async () => {
        const serverState = await getMatchState(matchId, hostPage);
        const p1Hand = serverState?.core?.players?.['1']?.hand ?? [];
        const p1Discard = serverState?.core?.players?.['1']?.discard ?? [];
        const baseMinions = serverState?.core?.bases?.[0]?.minions ?? [];
        return serverState?.sys?.interaction?.current == null
          && serverState?.sys?.responseWindow?.current == null
          && hasUid(p1Hand, 'enemy-owner-extra-mimic')
          && hasUid(p1Discard, 'enemy-owned-target')
          && !hasUid(baseMinions, 'enemy-owned-target');
      }, {
        message: 'Guest 跳过额外随从后，Bacta 这条真实链应完成收口，且 Guest 手牌不应被强制打出',
        timeout: 20000,
      }).toBe(true);

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const guestState = await readHarnessState(guestPage);
        return hostState?.sys?.interaction?.current == null
          && guestState?.sys?.interaction?.current == null
          && hostState?.sys?.responseWindow?.current == null
          && guestState?.sys?.responseWindow?.current == null
          && hostState?.sys?.phase === 'playCards'
          && guestState?.sys?.phase === 'playCards';
      }, {
        message: 'Bacta 双页链在 guest 跳过额外随从后，Host/Guest 页面都应同步完成收口',
        timeout: 15000,
      }).toBe(true);

      await expect(guestPage.getByRole('button', { name: '放弃这次额外随从' })).toHaveCount(0);
      await screenshotViewport(guestPage, 'yuanhou-bacta-enemy-owner-skipped-resolved-guest', testInfo);
      await screenshotViewport(hostPage, 'yuanhou-bacta-enemy-owner-skipped-resolved-host', testInfo);
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });

  test('电子猿-Baboom-真实多客户端下额外行动 prompt 应只出现在发动者页面', async ({ page, game, browser }, testInfo) => {
    test.setTimeout(180000);
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
                { uid: 'baboom-mp-boost-hand', defId: 'cyborg_apes_cyberevolution', type: 'action', owner: '0' },
                { uid: 'baboom-mp-base-action-hand', defId: 'cyborg_apes_going_bananas', type: 'action', owner: '0' },
              ],
              deck: [],
              discard: [],
              factions: ['cyborg_apes', 'time_travelers'],
              minionsPlayed: 1,
              minionLimit: 1,
              actionsPlayed: 1,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [],
              deck: [],
              discard: [],
              factions: ['shapeshifters', 'super_spies'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_monkey_lab',
              breakpoint: 20,
              minions: [
                {
                  uid: 'baboom-mp-other-minion',
                  defId: 'time_travelers_jumper',
                  controller: '0',
                  owner: '0',
                  basePower: 2,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'baboom-mp-source',
                  defId: 'cyborg_apes_baboom',
                  controller: '0',
                  owner: '0',
                  basePower: 3,
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
            { defId: 'base_the_vats', breakpoint: 18, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_portal_room'],
          baseDiscard: [],
        },
      },
    });

    const preparedState = JSON.parse(JSON.stringify(await game.getState()));
    const setup = await setupSmashUpOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, {
      hostFactions: ['cyborg_apes', 'time_travelers'],
      guestFactions: ['shapeshifters', 'super_spies'],
      skipFactionSelection: true,
      testInfo,
    });
    if (!setup) {
      test.skip(true, 'SmashUp 联机房间创建失败');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

    try {
      const mergedState = JSON.parse(JSON.stringify(preparedState));
      mergedState.core = {
        ...mergedState.core,
        phase: preparedState?.sys?.phase ?? preparedState?.core?.phase ?? 'playCards',
        factionSelection: undefined,
        titans: [],
        triggerQueue: [],
      };
      mergedState.sys = {
        ...mergedState.sys,
        matchId,
        turnOrder: Array.isArray(preparedState?.core?.turnOrder)
          ? [...preparedState.core.turnOrder]
          : mergedState.sys?.turnOrder,
        currentPlayerIndex: typeof preparedState?.core?.currentPlayerIndex === 'number'
          ? preparedState.core.currentPlayerIndex
          : mergedState.sys?.currentPlayerIndex,
        phase: preparedState?.sys?.phase ?? mergedState.sys?.phase,
        interaction: {
          ...mergedState.sys?.interaction,
          current: undefined,
        },
        responseWindow: {
          ...mergedState.sys?.responseWindow,
          current: undefined,
        },
      };

      await injectMatchState(matchId, mergedState, hostPage);
      await hostPage.reload({ waitUntil: 'domcontentloaded' });
      await guestPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForSmashUpUI(hostPage);
      await waitForSmashUpUI(guestPage);

      await expect(hostPage.locator('[data-minion-uid="baboom-mp-source"]')).toBeVisible({ timeout: 15000 });
      await hostPage.locator('[data-minion-uid="baboom-mp-source"]').click();

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const hostPrompt = hostState?.sys?.interaction?.current;
        const optionCardUids = (hostPrompt?.data?.options ?? [])
          .map((option: any) => option?.value?.cardUid)
          .filter((uid: unknown): uid is string => typeof uid === 'string');
        return hostPrompt?.data?.sourceId === 'smashup_immediate_extra_action'
          && hostPrompt?.playerId === '0'
          && hasSkipOption(hostPrompt?.data?.options)
          && optionCardUids.includes('baboom-mp-boost-hand')
          && !optionCardUids.includes('baboom-mp-base-action-hand');
      }, {
        message: 'Host 发动 Baboom 天赋后，应只在 Host 页面进入可跳过的 extra-action prompt，且不列出 Going Bananas',
        timeout: 20000,
      }).toBe(true);

      await expect.poll(async () => {
        const guestState = await readHarnessState(guestPage);
        return guestState?.sys?.interaction?.current == null;
      }, {
        message: 'Guest 页面不应拿到 Baboom extra-action prompt 控制权',
        timeout: 20000,
      }).toBe(true);

      await expect(hostPage.getByRole('button', { name: '放弃这次额外战术' })).toBeVisible({ timeout: 15000 });
      await expect(guestPage.getByRole('button', { name: '放弃这次额外战术' })).toHaveCount(0);
      await screenshotViewport(hostPage, 'yuanhou-baboom-multiplayer-prompt-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-baboom-multiplayer-no-prompt-guest', testInfo);

      await hostPage.getByRole('button', { name: '放弃这次额外战术' }).click();

      await expect.poll(async () => {
        const serverState = await getMatchState(matchId, hostPage);
        const hostHand = serverState?.core?.players?.['0']?.hand ?? [];
        const minions = serverState?.core?.bases?.[0]?.minions ?? [];
        const source = minions.find((minion: any) => minion?.uid === 'baboom-mp-source');
        const other = minions.find((minion: any) => minion?.uid === 'baboom-mp-other-minion');
        return serverState?.sys?.interaction?.current == null
          && hasUid(hostHand, 'baboom-mp-boost-hand')
          && hasUid(hostHand, 'baboom-mp-base-action-hand')
          && !hasUid(source?.attachedActions, 'baboom-mp-boost-hand')
          && !hasUid(other?.attachedActions, 'baboom-mp-boost-hand');
      }, {
        message: 'Host 点击 skip 后，服务端权威状态应直接收口且两张行动继续留在手牌，不应偷偷附着',
        timeout: 20000,
      }).toBe(true);

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const guestState = await readHarnessState(guestPage);
        return hostState?.sys?.interaction?.current == null
          && guestState?.sys?.interaction?.current == null;
      }, {
        message: 'Host skip 收口后，Host/Guest 两页都不应残留 Baboom extra-action prompt',
        timeout: 20000,
      }).toBe(true);

      await screenshotViewport(hostPage, 'yuanhou-baboom-multiplayer-resolved-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-baboom-multiplayer-resolved-guest', testInfo);
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });

  test('电子猿-Baboom-恢复可见触发 manual-resync 后 owner-only extra-action prompt 仍只归拥有者页面', async ({ page, game, browser }, testInfo) => {
    test.setTimeout(180000);
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
                { uid: 'baboom-visibility-boost-hand', defId: 'cyborg_apes_cyberevolution', type: 'action', owner: '0' },
                { uid: 'baboom-visibility-base-action-hand', defId: 'super_spies_going_bananas', type: 'action', owner: '0' },
              ],
              deck: [],
              discard: [],
              factions: ['cyborg_apes', 'time_travelers'],
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
              factions: ['shapeshifters', 'super_spies'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_monkey_lab',
              breakpoint: 20,
              minions: [
                {
                  uid: 'baboom-visibility-other-minion',
                  defId: 'time_travelers_jumper',
                  controller: '0',
                  owner: '0',
                  basePower: 2,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'baboom-visibility-source',
                  defId: 'cyborg_apes_baboom',
                  controller: '0',
                  owner: '0',
                  basePower: 3,
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
            { defId: 'base_the_vats', breakpoint: 18, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_portal_room'],
          baseDiscard: [],
        },
      },
    });

    const preparedState = JSON.parse(JSON.stringify(await game.getState()));
    const setup = await setupSmashUpOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, {
      hostFactions: ['cyborg_apes', 'time_travelers'],
      guestFactions: ['shapeshifters', 'super_spies'],
      skipFactionSelection: true,
      testInfo,
    });
    if (!setup) {
      test.skip(true, 'SmashUp 联机房间创建失败');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

    try {
      const mergedState = JSON.parse(JSON.stringify(preparedState));
      mergedState.core = {
        ...mergedState.core,
        phase: preparedState?.sys?.phase ?? preparedState?.core?.phase ?? 'playCards',
        factionSelection: undefined,
        titans: [],
        triggerQueue: [],
      };
      mergedState.sys = {
        ...mergedState.sys,
        matchId,
        turnOrder: Array.isArray(preparedState?.core?.turnOrder)
          ? [...preparedState.core.turnOrder]
          : mergedState.sys?.turnOrder,
        currentPlayerIndex: typeof preparedState?.core?.currentPlayerIndex === 'number'
          ? preparedState.core.currentPlayerIndex
          : mergedState.sys?.currentPlayerIndex,
        phase: preparedState?.sys?.phase ?? mergedState.sys?.phase,
        interaction: {
          ...mergedState.sys?.interaction,
          current: undefined,
        },
        responseWindow: {
          ...mergedState.sys?.responseWindow,
          current: undefined,
        },
      };

      await injectMatchState(matchId, mergedState, hostPage);
      await hostPage.reload({ waitUntil: 'domcontentloaded' });
      await guestPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForSmashUpUI(hostPage);
      await waitForSmashUpUI(guestPage);
      await installManualResyncTracker(hostPage);

      await expect(hostPage.locator('[data-minion-uid="baboom-visibility-source"]')).toBeVisible({ timeout: 15000 });
      await hostPage.locator('[data-minion-uid="baboom-visibility-source"]').click();

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const hostPrompt = hostState?.sys?.interaction?.current;
        const optionCardUids = (hostPrompt?.data?.options ?? [])
          .map((option: any) => option?.value?.cardUid)
          .filter((uid: unknown): uid is string => typeof uid === 'string');
        return hostPrompt?.data?.sourceId === 'smashup_immediate_extra_action'
          && hostPrompt?.playerId === '0'
          && hasSkipOption(hostPrompt?.data?.options)
          && optionCardUids.includes('baboom-visibility-boost-hand')
          && !optionCardUids.includes('baboom-visibility-base-action-hand');
      }, {
        message: 'Baboom 初始 owner-only prompt 应先稳定出现在 Host 页面',
        timeout: 20000,
      }).toBe(true);

      await triggerShellVisibilityResync(hostPage);

      await expect.poll(async () => await getManualResyncCount(hostPage), {
        message: 'Host 从 hidden -> visible 恢复后，应至少触发一次 manual-resync',
        timeout: 10000,
      }).toBeGreaterThanOrEqual(1);

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const guestState = await readHarnessState(guestPage);
        const hostPrompt = hostState?.sys?.interaction?.current;
        const optionCardUids = (hostPrompt?.data?.options ?? [])
          .map((option: any) => option?.value?.cardUid)
          .filter((uid: unknown): uid is string => typeof uid === 'string');
        return hostPrompt?.data?.sourceId === 'smashup_immediate_extra_action'
          && hostPrompt?.playerId === '0'
          && hasSkipOption(hostPrompt?.data?.options)
          && optionCardUids.includes('baboom-visibility-boost-hand')
          && !optionCardUids.includes('baboom-visibility-base-action-hand')
          && guestState?.sys?.interaction?.current == null;
      }, {
        message: '恢复可见并 resync 后，Baboom owner-only prompt 仍应只留在 Host 页面，Guest 不得接管',
        timeout: 20000,
      }).toBe(true);

      await expect(hostPage.getByTestId('card-spotlight-queue')).toBeHidden({ timeout: 15000 });
      await expect(hostPage.getByRole('button', { name: '放弃这次额外战术' })).toHaveCount(1);
      await expect(guestPage.getByRole('button', { name: '放弃这次额外战术' })).toHaveCount(0);
      await expect(hostPage.getByText(/正在等待 Guest-SU-E2E/)).toHaveCount(0);
      await screenshotViewport(hostPage, 'yuanhou-baboom-manual-resync-prompt-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-baboom-manual-resync-no-prompt-guest', testInfo);

      await hostPage.getByRole('button', { name: '放弃这次额外战术' }).click();

      await expect.poll(async () => {
        const serverState = await getMatchState(matchId, hostPage);
        const hostHand = serverState?.core?.players?.['0']?.hand ?? [];
        const minions = serverState?.core?.bases?.[0]?.minions ?? [];
        const source = minions.find((minion: any) => minion?.uid === 'baboom-visibility-source');
        const other = minions.find((minion: any) => minion?.uid === 'baboom-visibility-other-minion');
        return serverState?.sys?.interaction?.current == null
          && hasUid(hostHand, 'baboom-visibility-boost-hand')
          && hasUid(hostHand, 'baboom-visibility-base-action-hand')
          && !hasUid(source?.attachedActions, 'baboom-visibility-boost-hand')
          && !hasUid(other?.attachedActions, 'baboom-visibility-boost-hand');
      }, {
        message: 'manual-resync 后再 skip，服务端状态仍应正常收口且不偷偷附着行动',
        timeout: 20000,
      }).toBe(true);

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const guestState = await readHarnessState(guestPage);
        return hostState?.sys?.interaction?.current == null
          && guestState?.sys?.interaction?.current == null;
      }, {
        message: 'manual-resync 后 skip 收口，Host/Guest 两页都不应残留 Baboom prompt 或 waiting overlay',
        timeout: 20000,
      }).toBe(true);

      await screenshotViewport(hostPage, 'yuanhou-baboom-manual-resync-resolved-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-baboom-manual-resync-resolved-guest', testInfo);
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });

  test('超级间谍-The Spy Who Ditched Me-真实多客户端下应只在目标玩家页面给出弃随从选择权', async ({ page, game, browser }, testInfo) => {
    test.setTimeout(180000);
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
              hand: [{ uid: 'spy-action-a', defId: 'super_spies_the_spy_who_ditched_me', type: 'action', owner: '0' }],
              deck: [],
              discard: [],
              factions: ['super_spies'],
              minionsPlayed: 1,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [
                { uid: 'minion-a', defId: 'sharks_mako', type: 'minion', owner: '1' },
                { uid: 'minion-b', defId: 'sharks_hammerhead', type: 'minion', owner: '1' },
              ],
              deck: [],
              discard: [],
              factions: ['time_travelers'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            { defId: 'base_isis_swingin_pad', breakpoint: 21, minions: [], ongoingActions: [] },
            { defId: 'base_portal_room', breakpoint: 22, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    const preparedState = JSON.parse(JSON.stringify(await game.getState()));
    const setup = await setupSmashUpOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, {
      hostFactions: ['time_travelers', 'super_spies'],
      guestFactions: ['shapeshifters', 'cyborg_apes'],
      skipFactionSelection: true,
      testInfo,
    });
    if (!setup) {
      test.skip(true, 'SmashUp 联机房间创建失败');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

    try {
      const mergedState = JSON.parse(JSON.stringify(preparedState));
      mergedState.core = {
        ...mergedState.core,
        phase: preparedState?.sys?.phase ?? preparedState?.core?.phase ?? 'playCards',
        factionSelection: undefined,
        titans: [],
        triggerQueue: [],
      };
      mergedState.sys = {
        ...mergedState.sys,
        matchId,
        turnOrder: Array.isArray(preparedState?.core?.turnOrder)
          ? [...preparedState.core.turnOrder]
          : mergedState.sys?.turnOrder,
        currentPlayerIndex: typeof preparedState?.core?.currentPlayerIndex === 'number'
          ? preparedState.core.currentPlayerIndex
          : mergedState.sys?.currentPlayerIndex,
        phase: preparedState?.sys?.phase ?? mergedState.sys?.phase,
        interaction: {
          ...mergedState.sys?.interaction,
          current: undefined,
        },
        responseWindow: {
          ...mergedState.sys?.responseWindow,
          current: undefined,
        },
      };

      await injectMatchState(matchId, mergedState, hostPage);
      await hostPage.reload({ waitUntil: 'domcontentloaded' });
      await guestPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForSmashUpUI(hostPage);
      await waitForSmashUpUI(guestPage);

      await expect(hostPage.locator('[data-card-uid="spy-action-a"]')).toBeVisible({ timeout: 15000 });
      await hostPage.locator('[data-card-uid="spy-action-a"]').click();
      await hostPage.locator('[data-card-uid="spy-action-a"]').click();

      await expect.poll(async () => {
        const guestState = await readHarnessState(guestPage);
        const guestPrompt = guestState?.sys?.interaction?.current;
        const guestOptionIds = (guestPrompt?.data?.options ?? []).map((option: any) => option?.id);
        return guestPrompt?.data?.sourceId === 'super_spies_the_spy_who_ditched_me_discard'
          && guestPrompt?.playerId === '1'
          && guestOptionIds.includes('minion-a')
          && guestOptionIds.includes('minion-b');
      }, {
        message: 'P0 打出 The Spy Who Ditched Me 后，目标玩家 P1 页面应进入弃随从 prompt 并暴露两张手牌候选',
        timeout: 20000,
      }).toBe(true);

      await expect(hostPage.getByRole('heading', { name: /抛弃我的间谍：选择一张随从牌弃掉/ })).toHaveCount(0);
      await expect(hostPage.getByText(/正在等待 Guest-SU-E2E/)).toHaveCount(0);
      await expect(hostPage.locator('[data-option-id="minion-a"]')).toHaveCount(0);
      await expect(hostPage.locator('[data-option-id="minion-b"]')).toHaveCount(0);
      await expect(guestPage.locator('[data-card-uid="minion-a"]')).toBeVisible({ timeout: 15000 });
      await expect(guestPage.locator('[data-card-uid="minion-b"]')).toBeVisible({ timeout: 15000 });
      await screenshotViewport(guestPage, 'yuanhou-spy-who-ditched-me-discard-prompt-guest', testInfo);
      await screenshotViewport(hostPage, 'yuanhou-spy-who-ditched-me-non-target-host', testInfo);

      await guestPage.locator('[data-card-uid="minion-b"]').click();

      await expect.poll(async () => {
        const serverState = await getMatchState(matchId, hostPage);
        const p1Hand = serverState?.core?.players?.['1']?.hand ?? [];
        const p1Discard = serverState?.core?.players?.['1']?.discard ?? [];
        return serverState?.sys?.interaction?.current == null
          && !hasUid(p1Hand, 'minion-b')
          && hasUid(p1Hand, 'minion-a')
          && hasUid(p1Discard, 'minion-b');
      }, {
        message: 'P1 在自己页面选择 minion-b 后，服务端权威状态应只弃掉该随从并完成收口',
        timeout: 20000,
      }).toBe(true);

      await expect(hostPage.getByText(/正在等待 Guest-SU-E2E/)).toBeHidden({ timeout: 15000 });
      await expect(hostPage.getByRole('heading', { name: /抛弃我的间谍：选择一张随从牌弃掉/ })).toBeHidden({ timeout: 15000 });
      await expect(guestPage.locator('[data-card-uid="minion-a"]')).toBeVisible({ timeout: 15000 });
      await screenshotViewport(guestPage, 'yuanhou-spy-who-ditched-me-resolved-guest', testInfo);
      await screenshotViewport(hostPage, 'yuanhou-spy-who-ditched-me-resolved-host', testInfo);
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });

  test('超级间谍-The Spy Who Ditched Me-目标玩家恢复可见触发 manual-resync 后弃随从 prompt 仍只归目标页且 Host 不残留 waiting overlay', async ({ page, game, browser }, testInfo) => {
    test.setTimeout(180000);
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
              hand: [{ uid: 'spy-resync-action-a', defId: 'super_spies_the_spy_who_ditched_me', type: 'action', owner: '0' }],
              deck: [],
              discard: [],
              factions: ['super_spies'],
              minionsPlayed: 1,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [
                { uid: 'spy-resync-minion-a', defId: 'sharks_mako', type: 'minion', owner: '1' },
                { uid: 'spy-resync-minion-b', defId: 'sharks_hammerhead', type: 'minion', owner: '1' },
              ],
              deck: [],
              discard: [],
              factions: ['time_travelers'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            { defId: 'base_isis_swingin_pad', breakpoint: 21, minions: [], ongoingActions: [] },
            { defId: 'base_portal_room', breakpoint: 22, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    const preparedState = JSON.parse(JSON.stringify(await game.getState()));
    const setup = await setupSmashUpOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, {
      hostFactions: ['time_travelers', 'super_spies'],
      guestFactions: ['shapeshifters', 'cyborg_apes'],
      skipFactionSelection: true,
      testInfo,
    });
    if (!setup) {
      test.skip(true, 'SmashUp 联机房间创建失败');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

    try {
      const mergedState = JSON.parse(JSON.stringify(preparedState));
      mergedState.core = {
        ...mergedState.core,
        phase: preparedState?.sys?.phase ?? preparedState?.core?.phase ?? 'playCards',
        factionSelection: undefined,
        titans: [],
        triggerQueue: [],
      };
      mergedState.sys = {
        ...mergedState.sys,
        matchId,
        turnOrder: Array.isArray(preparedState?.core?.turnOrder)
          ? [...preparedState.core.turnOrder]
          : mergedState.sys?.turnOrder,
        currentPlayerIndex: typeof preparedState?.core?.currentPlayerIndex === 'number'
          ? preparedState.core.currentPlayerIndex
          : mergedState.sys?.currentPlayerIndex,
        phase: preparedState?.sys?.phase ?? mergedState.sys?.phase,
        interaction: {
          ...mergedState.sys?.interaction,
          current: undefined,
        },
        responseWindow: {
          ...mergedState.sys?.responseWindow,
          current: undefined,
        },
      };

      await injectMatchState(matchId, mergedState, hostPage);
      await hostPage.reload({ waitUntil: 'domcontentloaded' });
      await guestPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForSmashUpUI(hostPage);
      await waitForSmashUpUI(guestPage);
      await installManualResyncTracker(guestPage);
      await expect.poll(async () => {
        const hostSnapshot = await readMatchRoomLiveSnapshot(hostPage);
        const guestSnapshot = await readMatchRoomLiveSnapshot(guestPage);
        return hostSnapshot?.providerPlayerID === '0'
          && hostSnapshot?.effectivePlayerID === '0'
          && hostSnapshot?.isSpectatorRoute === false
          && guestSnapshot?.providerPlayerID === '1'
          && guestSnapshot?.effectivePlayerID === '1'
          && guestSnapshot?.isSpectatorRoute === false;
      }, {
        message: '多人页壳调试快照应在 manual-resync 采样前就绪，并保持 Host/Guest 各自 seat 视角',
        timeout: 15000,
      }).toBe(true);

      await expect(hostPage.locator('[data-card-uid="spy-resync-action-a"]')).toBeVisible({ timeout: 15000 });
      await hostPage.locator('[data-card-uid="spy-resync-action-a"]').click();
      await hostPage.locator('[data-card-uid="spy-resync-action-a"]').click();

      await expect.poll(async () => {
        const guestState = await readHarnessState(guestPage);
        const guestPrompt = guestState?.sys?.interaction?.current;
        const guestOptionIds = (guestPrompt?.data?.options ?? []).map((option: any) => option?.id);
        return guestPrompt?.data?.sourceId === 'super_spies_the_spy_who_ditched_me_discard'
          && guestPrompt?.playerId === '1'
          && guestOptionIds.includes('spy-resync-minion-a')
          && guestOptionIds.includes('spy-resync-minion-b');
      }, {
        message: 'The Spy Who Ditched Me 初始真实链应先在目标玩家 Guest 页面给出弃随从 prompt',
        timeout: 20000,
      }).toBe(true);

      await startMatchRoomLiveTrace(hostPage, 'spy-manual-resync-host');
      await startMatchRoomLiveTrace(guestPage, 'spy-manual-resync-guest');
      await triggerShellVisibilityResync(guestPage);

      await expect.poll(async () => await getManualResyncCount(guestPage), {
        message: '目标玩家 Guest 从 hidden -> visible 恢复后，应至少触发一次 manual-resync',
        timeout: 10000,
      }).toBeGreaterThanOrEqual(1);

      await expect.poll(async () => {
        const guestState = await readHarnessState(guestPage);
        const guestPrompt = guestState?.sys?.interaction?.current;
        const guestOptionIds = (guestPrompt?.data?.options ?? []).map((option: any) => option?.id);
        return guestPrompt?.data?.sourceId === 'super_spies_the_spy_who_ditched_me_discard'
          && guestPrompt?.playerId === '1'
          && guestOptionIds.includes('spy-resync-minion-a')
          && guestOptionIds.includes('spy-resync-minion-b');
      }, {
        message: 'manual-resync 后，弃随从 prompt 仍应只留在目标玩家 Guest 页面',
        timeout: 20000,
      }).toBe(true);

      await stopMatchRoomLiveTrace(hostPage, 'spy-manual-resync-host');
      await stopMatchRoomLiveTrace(guestPage, 'spy-manual-resync-guest');
      const hostLiveTrace = await readMatchRoomLiveTrace(hostPage, 'spy-manual-resync-host');
      const guestLiveTrace = await readMatchRoomLiveTrace(guestPage, 'spy-manual-resync-guest');
      const hostBadSamples = hostLiveTrace.filter((entry: any) => {
        const snapshot = entry?.snapshot;
        if (!snapshot) return true;
        return snapshot?.providerPlayerID !== '0'
          || snapshot?.effectivePlayerID !== '0'
          || snapshot?.statusPlayerID !== '0'
          || snapshot?.isSpectatorRoute !== false
          || snapshot?.stateView?.interactionSourceId === 'super_spies_the_spy_who_ditched_me_discard';
      });
      const guestBadSamples = guestLiveTrace.filter((entry: any) => {
        const snapshot = entry?.snapshot;
        if (!snapshot) return true;
        return snapshot?.providerPlayerID !== '1'
          || snapshot?.effectivePlayerID !== '1'
          || snapshot?.statusPlayerID !== '1'
          || snapshot?.isSpectatorRoute !== false
          || (snapshot?.stateView?.interactionSourceId != null
            && snapshot?.stateView?.interactionSourceId !== 'super_spies_the_spy_who_ditched_me_discard');
      });
      const guestPromptSamples = guestLiveTrace.filter((entry: any) =>
        entry?.snapshot?.stateView?.interactionSourceId === 'super_spies_the_spy_who_ditched_me_discard');
      expect(hostBadSamples, `Host live trace should not drift to spectator/wrong prompt: ${JSON.stringify(hostBadSamples.slice(0, 5))}`).toEqual([]);
      expect(guestBadSamples, `Guest live trace should not drift to spectator/null/wrong prompt: ${JSON.stringify(guestBadSamples.slice(0, 5))}`).toEqual([]);
      expect(guestPromptSamples.length, 'Guest live trace should contain the discard prompt throughout manual-resync window').toBeGreaterThan(0);

      await expect(hostPage.getByRole('heading', { name: /抛弃我的间谍：选择一张随从牌弃掉/ })).toHaveCount(0);
      await expect(hostPage.getByText(/正在等待 Guest-SU-E2E/)).toHaveCount(0);
      await expect(hostPage.locator('[data-option-id="spy-resync-minion-a"]')).toHaveCount(0);
      await expect(hostPage.locator('[data-option-id="spy-resync-minion-b"]')).toHaveCount(0);
      await expect(guestPage.locator('[data-card-uid="spy-resync-minion-a"]')).toBeVisible({ timeout: 15000 });
      await expect(guestPage.locator('[data-card-uid="spy-resync-minion-b"]')).toBeVisible({ timeout: 15000 });
      await screenshotViewport(guestPage, 'yuanhou-spy-who-ditched-me-manual-resync-discard-prompt-guest', testInfo);
      await screenshotViewport(hostPage, 'yuanhou-spy-who-ditched-me-manual-resync-no-prompt-host', testInfo);

      await guestPage.locator('[data-card-uid="spy-resync-minion-b"]').click();

      await expect.poll(async () => {
        const serverState = await getMatchState(matchId, hostPage);
        const p1Hand = serverState?.core?.players?.['1']?.hand ?? [];
        const p1Discard = serverState?.core?.players?.['1']?.discard ?? [];
        return serverState?.sys?.interaction?.current == null
          && !hasUid(p1Hand, 'spy-resync-minion-b')
          && hasUid(p1Hand, 'spy-resync-minion-a')
          && hasUid(p1Discard, 'spy-resync-minion-b');
      }, {
        message: 'manual-resync 后由 Guest 选择弃掉 minion-b，服务端权威状态仍应只弃掉该随从并完成收口',
        timeout: 20000,
      }).toBe(true);

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const guestState = await readHarnessState(guestPage);
        return hostState?.sys?.interaction?.current == null
          && guestState?.sys?.interaction?.current == null;
      }, {
        message: 'manual-resync 收口后，Host/Guest 两页都不应残留 The Spy Who Ditched Me prompt 或 waiting overlay',
        timeout: 15000,
      }).toBe(true);

      await expect(hostPage.getByText(/正在等待 Guest-SU-E2E/)).toBeHidden({ timeout: 15000 });
      await screenshotViewport(guestPage, 'yuanhou-spy-who-ditched-me-manual-resync-resolved-guest', testInfo);
      await screenshotViewport(hostPage, 'yuanhou-spy-who-ditched-me-manual-resync-resolved-host', testInfo);
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });

  test('超级间谍-The Spy Who Ditched Me-真实多客户端下若目标只剩一张随从应自动弃掉且不弹 prompt', async ({ page, game, browser }, testInfo) => {
    test.setTimeout(180000);
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
              hand: [{ uid: 'spy-single-action-a', defId: 'super_spies_the_spy_who_ditched_me', type: 'action', owner: '0' }],
              deck: [],
              discard: [],
              factions: ['super_spies'],
              minionsPlayed: 1,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [{ uid: 'single-minion-a', defId: 'sharks_mako', type: 'minion', owner: '1' }],
              deck: [],
              discard: [],
              factions: ['time_travelers'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            { defId: 'base_isis_swingin_pad', breakpoint: 21, minions: [], ongoingActions: [] },
            { defId: 'base_portal_room', breakpoint: 22, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    const preparedState = JSON.parse(JSON.stringify(await game.getState()));
    const setup = await setupSmashUpOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, {
      hostFactions: ['time_travelers', 'super_spies'],
      guestFactions: ['shapeshifters', 'cyborg_apes'],
      skipFactionSelection: true,
      testInfo,
    });
    if (!setup) {
      test.skip(true, 'SmashUp 联机房间创建失败');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

    try {
      const mergedState = JSON.parse(JSON.stringify(preparedState));
      mergedState.core = {
        ...mergedState.core,
        phase: preparedState?.sys?.phase ?? preparedState?.core?.phase ?? 'playCards',
        factionSelection: undefined,
        titans: [],
        triggerQueue: [],
      };
      mergedState.sys = {
        ...mergedState.sys,
        matchId,
        turnOrder: Array.isArray(preparedState?.core?.turnOrder)
          ? [...preparedState.core.turnOrder]
          : mergedState.sys?.turnOrder,
        currentPlayerIndex: typeof preparedState?.core?.currentPlayerIndex === 'number'
          ? preparedState.core.currentPlayerIndex
          : mergedState.sys?.currentPlayerIndex,
        phase: preparedState?.sys?.phase ?? mergedState.sys?.phase,
        interaction: {
          ...mergedState.sys?.interaction,
          current: undefined,
        },
        responseWindow: {
          ...mergedState.sys?.responseWindow,
          current: undefined,
        },
      };

      await injectMatchState(matchId, mergedState, hostPage);
      await hostPage.reload({ waitUntil: 'domcontentloaded' });
      await guestPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForSmashUpUI(hostPage);
      await waitForSmashUpUI(guestPage);

      await expect(hostPage.locator('[data-card-uid="spy-single-action-a"]')).toBeVisible({ timeout: 15000 });
      await screenshotViewport(hostPage, 'yuanhou-spy-who-ditched-me-single-minion-before-play-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-spy-who-ditched-me-single-minion-before-play-guest', testInfo);

      await hostPage.locator('[data-card-uid="spy-single-action-a"]').click();
      await hostPage.locator('[data-card-uid="spy-single-action-a"]').click();

      await expect.poll(async () => {
        const serverState = await getMatchState(matchId, hostPage);
        const guestState = await readHarnessState(guestPage);
        const guestPrompt = guestState?.sys?.interaction?.current;
        const p1Hand = serverState?.core?.players?.['1']?.hand ?? [];
        const p1Discard = serverState?.core?.players?.['1']?.discard ?? [];
        return guestPrompt == null
          && !hasUid(p1Hand, 'single-minion-a')
          && hasUid(p1Discard, 'single-minion-a')
          && serverState?.sys?.interaction?.current == null;
      }, {
        message: 'The Spy Who Ditched Me 在联机真实入口下若目标只剩一张随从，应直接自动弃掉且不在 Guest 页创建 discard prompt',
        timeout: 20000,
      }).toBe(true);

      await expect(guestPage.getByRole('heading', { name: /抛弃我的间谍：选择一张随从牌弃掉/ })).toHaveCount(0);
      await expect(guestPage.locator('[data-option-id="single-minion-a"]')).toHaveCount(0);
      await expect(hostPage.getByRole('heading', { name: /抛弃我的间谍：选择一张随从牌弃掉/ })).toHaveCount(0);
      await screenshotViewport(guestPage, 'yuanhou-spy-who-ditched-me-single-minion-auto-discard-guest', testInfo);
      await screenshotViewport(hostPage, 'yuanhou-spy-who-ditched-me-single-minion-auto-discard-host', testInfo);
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });

  test('超级间谍-The Spy Who Ditched Me-真实多客户端下应只在施放者页面私有展示无随从玩家手牌', async ({ page, game, browser }, testInfo) => {
    test.setTimeout(180000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      extra: {
        core: {
          turnOrder: ['0', '1', '2'],
          currentPlayerIndex: 0,
          turnNumber: 1,
          nextUid: 1000,
          players: {
            '0': {
              id: '0',
              vp: 0,
              hand: [{ uid: 'spy-reveal-mp', defId: 'super_spies_the_spy_who_ditched_me', type: 'action', owner: '0' }],
              deck: [],
              discard: [],
              factions: ['super_spies'],
              minionsPlayed: 1,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [
                { uid: 'minion-a', defId: 'sharks_mako', type: 'minion', owner: '1' },
                { uid: 'minion-b', defId: 'sharks_hammerhead', type: 'minion', owner: '1' },
              ],
              deck: [],
              discard: [],
              factions: ['time_travelers'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '2': {
              id: '2',
              vp: 0,
              hand: [{ uid: 'action-only', defId: 'super_spies_for_my_eyes_only', type: 'action', owner: '2' }],
              deck: [],
              discard: [],
              factions: ['cyborg_apes'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            { defId: 'base_isis_swingin_pad', breakpoint: 21, minions: [], ongoingActions: [] },
            { defId: 'base_portal_room', breakpoint: 22, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    const preparedState = JSON.parse(JSON.stringify(await game.getState()));
    const setup = await setupSmashUpOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, {
      hostFactions: ['super_spies', 'time_travelers'],
      guestFactions: ['shapeshifters', 'cyborg_apes'],
      skipFactionSelection: true,
      testInfo,
    });
    if (!setup) {
      test.skip(true, 'SmashUp 联机房间创建失败');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

    try {
      const mergedState = JSON.parse(JSON.stringify(preparedState));
      mergedState.core = {
        ...mergedState.core,
        phase: preparedState?.sys?.phase ?? preparedState?.core?.phase ?? 'playCards',
        factionSelection: undefined,
        titans: [],
        triggerQueue: [],
      };
      mergedState.sys = {
        ...mergedState.sys,
        matchId,
        turnOrder: Array.isArray(preparedState?.core?.turnOrder)
          ? [...preparedState.core.turnOrder]
          : mergedState.sys?.turnOrder,
        currentPlayerIndex: typeof preparedState?.core?.currentPlayerIndex === 'number'
          ? preparedState.core.currentPlayerIndex
          : mergedState.sys?.currentPlayerIndex,
        phase: preparedState?.sys?.phase ?? mergedState.sys?.phase,
        interaction: {
          ...mergedState.sys?.interaction,
          current: undefined,
        },
        responseWindow: {
          ...mergedState.sys?.responseWindow,
          current: undefined,
        },
      };

      await injectMatchState(matchId, mergedState, hostPage);
      await hostPage.reload({ waitUntil: 'domcontentloaded' });
      await guestPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForSmashUpUI(hostPage);
      await waitForSmashUpUI(guestPage);

      await expect(hostPage.locator('[data-card-uid="spy-reveal-mp"]')).toBeVisible({ timeout: 15000 });
      await hostPage.locator('[data-card-uid="spy-reveal-mp"]').click();
      await hostPage.locator('[data-card-uid="spy-reveal-mp"]').click();

      await expect.poll(async () => {
        const guestState = await readHarnessState(guestPage);
        const guestPrompt = guestState?.sys?.interaction?.current;
        const guestOptionIds = (guestPrompt?.data?.options ?? []).map((option: any) => option?.id);
        return guestPrompt?.data?.sourceId === 'super_spies_the_spy_who_ditched_me_discard'
          && guestPrompt?.playerId === '1'
          && guestOptionIds.includes('minion-a')
          && guestOptionIds.includes('minion-b');
      }, {
        message: 'P0 打出 The Spy Who Ditched Me 后，目标玩家 P1 页面应进入弃随从 prompt 并暴露两张手牌候选',
        timeout: 20000,
      }).toBe(true);

      await expect(hostPage.getByTestId('reveal-overlay')).toBeVisible({ timeout: 15000 });
      await expect(hostPage.getByRole('heading', { name: 'P3 的手牌' })).toBeVisible({ timeout: 15000 });
      await expect(hostPage.getByText('只为我的眼睛')).toBeVisible({ timeout: 15000 });
      await expect(hostPage.getByTestId('reveal-card')).toHaveCount(1);
      await expect(guestPage.getByRole('heading', { name: 'P3 的手牌' })).toHaveCount(0);
      await expect(guestPage.getByText('只为我的眼睛')).toHaveCount(0);
      await expect(guestPage.getByTestId('reveal-card')).toHaveCount(0);
      await screenshotViewport(hostPage, 'yuanhou-spy-who-ditched-me-multiplayer-reveal-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-spy-who-ditched-me-multiplayer-discard-guest', testInfo);

      await hostPage.getByTestId('reveal-overlay').click({ position: { x: 12, y: 12 } });
      await expect(hostPage.getByTestId('reveal-overlay')).toBeHidden({ timeout: 15000 });
      await dismissSmashUpSpotlightQueueIfVisible(hostPage);
      await expect(hostPage.getByRole('heading', { name: /抛弃我的间谍：选择一张随从牌弃掉/ })).toHaveCount(0);
      await expect(hostPage.getByText('等待对方操作')).toBeVisible({ timeout: 15000 });
      await expect(hostPage.getByTestId('su-end-turn-action-button')).toHaveCount(0);
      await expect(hostPage.getByTestId('su-end-turn-hints')).toHaveCount(0);
      await expect(hostPage.getByTestId('su-end-turn-visibility-toggle')).toHaveCount(0);
      await screenshotViewport(hostPage, 'yuanhou-spy-who-ditched-me-multiplayer-reveal-dismissed-host', testInfo);

      await guestPage.locator('[data-card-uid="minion-b"]').click();

      await expect.poll(async () => {
        const serverState = await getMatchState(matchId, hostPage);
        const p1Hand = serverState?.core?.players?.['1']?.hand?.map((card: any) => card.uid) ?? [];
        const p1Discard = serverState?.core?.players?.['1']?.discard?.map((card: any) => card.uid) ?? [];
        const p2Hand = serverState?.core?.players?.['2']?.hand?.map((card: any) => card.uid) ?? [];
        return serverState?.sys?.interaction?.current == null
          && p1Hand.join(',') === 'minion-a'
          && p1Discard.join(',') === 'minion-b'
          && p2Hand.join(',') === 'action-only';
      }, {
        message: '关闭私有 reveal 后，P1 的弃随从 prompt 应仍可继续完成，且 P2 只做展示不弃牌',
        timeout: 20000,
      }).toBe(true);

      await expect(hostPage.getByText('等待对方操作')).toBeHidden({ timeout: 15000 });
      await expect(hostPage.getByRole('heading', { name: /抛弃我的间谍：选择一张随从牌弃掉/ })).toHaveCount(0);
      await expect(guestPage.getByRole('heading', { name: 'P3 的手牌' })).toHaveCount(0);
      await screenshotViewport(hostPage, 'yuanhou-spy-who-ditched-me-multiplayer-resolved-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-spy-who-ditched-me-multiplayer-resolved-guest', testInfo);
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });

  test('超级间谍-Operative-真实多客户端下两层 prompt 都应只出现在行动玩家页面', async ({ page, game, browser }, testInfo) => {
    test.setTimeout(180000);
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
              hand: [{ uid: 'operative-mp-hand', defId: 'super_spies_operative', type: 'minion', owner: '0' }],
              deck: [
                { uid: 'operative-mp-p0-top', defId: 'super_spies_for_my_eyes_only', type: 'action', owner: '0' },
                { uid: 'operative-mp-p0-second', defId: 'super_spies_from_q_with_love', type: 'action', owner: '0' },
              ],
              discard: [],
              factions: ['super_spies', 'time_travelers'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [],
              deck: [
                { uid: 'operative-mp-p1-top', defId: 'time_travelers_jumper', type: 'minion', owner: '1' },
                { uid: 'operative-mp-p1-second', defId: 'time_travelers_time_raider', type: 'minion', owner: '1' },
              ],
              discard: [],
              factions: ['shapeshifters', 'cyborg_apes'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            { defId: 'base_secret_volcano_headquarters', breakpoint: 18, minions: [], ongoingActions: [] },
            { defId: 'base_portal_room', breakpoint: 20, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    const preparedState = JSON.parse(JSON.stringify(await game.getState()));
    const setup = await setupSmashUpOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, {
      hostFactions: ['super_spies', 'time_travelers'],
      guestFactions: ['shapeshifters', 'cyborg_apes'],
      skipFactionSelection: true,
      testInfo,
    });
    if (!setup) {
      test.skip(true, 'SmashUp 联机房间创建失败');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

    try {
      const mergedState = JSON.parse(JSON.stringify(preparedState));
      mergedState.core = {
        ...mergedState.core,
        phase: preparedState?.sys?.phase ?? preparedState?.core?.phase ?? 'playCards',
        factionSelection: undefined,
        titans: [],
        triggerQueue: [],
      };
      mergedState.sys = {
        ...mergedState.sys,
        matchId,
        turnOrder: Array.isArray(preparedState?.core?.turnOrder)
          ? [...preparedState.core.turnOrder]
          : mergedState.sys?.turnOrder,
        currentPlayerIndex: typeof preparedState?.core?.currentPlayerIndex === 'number'
          ? preparedState.core.currentPlayerIndex
          : mergedState.sys?.currentPlayerIndex,
        phase: preparedState?.sys?.phase ?? mergedState.sys?.phase,
        interaction: {
          ...mergedState.sys?.interaction,
          current: undefined,
        },
        responseWindow: {
          ...mergedState.sys?.responseWindow,
          current: undefined,
        },
      };

      await injectMatchState(matchId, mergedState, hostPage);
      await hostPage.reload({ waitUntil: 'domcontentloaded' });
      await guestPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForSmashUpUI(hostPage);
      await waitForSmashUpUI(guestPage);

      await expect(hostPage.locator('[data-card-uid="operative-mp-hand"]')).toBeVisible({ timeout: 15000 });
      await hostPage.locator('[data-card-uid="operative-mp-hand"]').click();
      await hostPage.getByTestId('base-zone-0').click();

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const hostPrompt = hostState?.sys?.interaction?.current;
        const optionIds = (hostPrompt?.data?.options ?? []).map((option: any) => option?.id);
        return hostPrompt?.data?.sourceId === 'super_spies_operative_players'
          && hostPrompt?.playerId === '0'
          && optionIds.includes('player-0')
          && optionIds.includes('player-1')
          && hasUid(hostState?.core?.bases?.[0]?.minions, 'operative-mp-hand');
      }, {
        message: 'Host 打出 Operative 后，第一层玩家多选 prompt 应只出现在 Host 页面',
        timeout: 20000,
      }).toBe(true);

      await expect.poll(async () => {
        const guestState = await readHarnessState(guestPage);
        return guestState?.sys?.interaction?.current == null;
      }, {
        message: 'Guest 页面不应拿到 Operative 第一层玩家多选 prompt 控制权',
        timeout: 20000,
      }).toBe(true);

      await expect(hostPage.getByRole('button', { name: '玩家 0' })).toBeVisible({ timeout: 15000 });
      await expect(hostPage.getByRole('button', { name: '玩家 1' })).toBeVisible({ timeout: 15000 });
      await expect(guestPage.getByRole('button', { name: '玩家 0' })).toHaveCount(0);
      await expect(guestPage.getByRole('button', { name: '玩家 1' })).toHaveCount(0);
      await screenshotViewport(hostPage, 'yuanhou-operative-multiplayer-player-choice-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-operative-multiplayer-no-player-choice-guest', testInfo);

      await hostPage.getByRole('button', { name: '玩家 1' }).click();
      await hostPage.getByRole('button', { name: /确认/ }).click();

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const hostPrompt = hostState?.sys?.interaction?.current;
        const optionIds = (hostPrompt?.data?.options ?? []).map((option: any) => option?.id);
        return hostPrompt?.data?.sourceId === 'super_spies_operative_top_bottom'
          && hostPrompt?.playerId === '0'
          && optionIds.includes('operative-mp-p1-top')
          && !optionIds.includes('operative-mp-p0-top');
      }, {
        message: 'Host 只勾选玩家1后，第二层放底 prompt 应仍只归 Host 页面，并只列玩家1刚展示的顶牌',
        timeout: 20000,
      }).toBe(true);

      await expect.poll(async () => {
        const guestState = await readHarnessState(guestPage);
        return guestState?.sys?.interaction?.current == null;
      }, {
        message: 'Guest 页面不应拿到 Operative 第二层放底 prompt 控制权',
        timeout: 20000,
      }).toBe(true);

      await expect(hostPage.locator('[data-option-id="operative-mp-p1-top"]')).toBeVisible({ timeout: 15000 });
      await expect(hostPage.locator('[data-option-id="operative-mp-p0-top"]')).toHaveCount(0);
      await expect(guestPage.locator('[data-option-id="operative-mp-p1-top"]')).toHaveCount(0);
      await expect(hostPage.getByTestId('reveal-overlay')).toHaveCount(0);
      await screenshotViewport(hostPage, 'yuanhou-operative-multiplayer-top-bottom-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-operative-multiplayer-no-top-bottom-guest', testInfo);

      await hostPage.locator('[data-option-id="operative-mp-p1-top"]').click();
      await hostPage.getByRole('button', { name: /确认/ }).click();

      await expect.poll(async () => {
        const serverState = await getMatchState(matchId, hostPage);
        const p0Deck = serverState?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
        const p1Deck = serverState?.core?.players?.['1']?.deck?.map((card: any) => card.uid) ?? [];
        return serverState?.sys?.interaction?.current == null
          && p0Deck.join(',') === 'operative-mp-p0-top,operative-mp-p0-second'
          && p1Deck.join(',') === 'operative-mp-p1-second,operative-mp-p1-top';
      }, {
        message: 'Host 在第二层只选择 Guest 展示顶牌后，服务端应只把该牌放到底并完成收口',
        timeout: 20000,
      }).toBe(true);

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const guestState = await readHarnessState(guestPage);
        return hostState?.sys?.interaction?.current == null
          && guestState?.sys?.interaction?.current == null;
      }, {
        message: 'Operative 多客户端收口后，Host/Guest 两页都不应残留任何交互 prompt',
        timeout: 20000,
      }).toBe(true);

      await screenshotViewport(hostPage, 'yuanhou-operative-multiplayer-resolved-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-operative-multiplayer-resolved-guest', testInfo);
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });

  test('超级间谍-Operative-恢复可见触发 manual-resync 后两层 prompt 仍只归行动玩家页面', async ({ page, game, browser }, testInfo) => {
    test.setTimeout(180000);
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
              hand: [{ uid: 'operative-resync-hand', defId: 'super_spies_operative', type: 'minion', owner: '0' }],
              deck: [
                { uid: 'operative-resync-p0-top', defId: 'super_spies_for_my_eyes_only', type: 'action', owner: '0' },
                { uid: 'operative-resync-p0-second', defId: 'super_spies_from_q_with_love', type: 'action', owner: '0' },
              ],
              discard: [],
              factions: ['super_spies', 'time_travelers'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [],
              deck: [
                { uid: 'operative-resync-p1-top', defId: 'time_travelers_jumper', type: 'minion', owner: '1' },
                { uid: 'operative-resync-p1-second', defId: 'time_travelers_time_raider', type: 'minion', owner: '1' },
              ],
              discard: [],
              factions: ['shapeshifters', 'cyborg_apes'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            { defId: 'base_secret_volcano_headquarters', breakpoint: 18, minions: [], ongoingActions: [] },
            { defId: 'base_portal_room', breakpoint: 20, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    const preparedState = JSON.parse(JSON.stringify(await game.getState()));
    const setup = await setupSmashUpOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, {
      hostFactions: ['super_spies', 'time_travelers'],
      guestFactions: ['shapeshifters', 'cyborg_apes'],
      skipFactionSelection: true,
      testInfo,
    });
    if (!setup) {
      test.skip(true, 'SmashUp 联机房间创建失败');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

    try {
      const mergedState = JSON.parse(JSON.stringify(preparedState));
      mergedState.core = {
        ...mergedState.core,
        phase: preparedState?.sys?.phase ?? preparedState?.core?.phase ?? 'playCards',
        factionSelection: undefined,
        titans: [],
        triggerQueue: [],
      };
      mergedState.sys = {
        ...mergedState.sys,
        matchId,
        turnOrder: Array.isArray(preparedState?.core?.turnOrder)
          ? [...preparedState.core.turnOrder]
          : mergedState.sys?.turnOrder,
        currentPlayerIndex: typeof preparedState?.core?.currentPlayerIndex === 'number'
          ? preparedState.core.currentPlayerIndex
          : mergedState.sys?.currentPlayerIndex,
        phase: preparedState?.sys?.phase ?? mergedState.sys?.phase,
        interaction: {
          ...mergedState.sys?.interaction,
          current: undefined,
        },
        responseWindow: {
          ...mergedState.sys?.responseWindow,
          current: undefined,
        },
      };

      await injectMatchState(matchId, mergedState, hostPage);
      await hostPage.reload({ waitUntil: 'domcontentloaded' });
      await guestPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForSmashUpUI(hostPage);
      await waitForSmashUpUI(guestPage);
      await installManualResyncTracker(hostPage);

      await expect(hostPage.locator('[data-card-uid="operative-resync-hand"]')).toBeVisible({ timeout: 15000 });
      await hostPage.locator('[data-card-uid="operative-resync-hand"]').click();
      await hostPage.getByTestId('base-zone-0').click();

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const hostPrompt = hostState?.sys?.interaction?.current;
        const optionIds = (hostPrompt?.data?.options ?? []).map((option: any) => option?.id);
        return hostPrompt?.data?.sourceId === 'super_spies_operative_players'
          && hostPrompt?.playerId === '0'
          && optionIds.includes('player-0')
          && optionIds.includes('player-1')
          && hasUid(hostState?.core?.bases?.[0]?.minions, 'operative-resync-hand');
      }, {
        message: 'Host 打出 Operative 后，应先进入第一层玩家多选 prompt',
        timeout: 20000,
      }).toBe(true);

      await triggerShellVisibilityResync(hostPage);

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const guestState = await readHarnessState(guestPage);
        const hostPrompt = hostState?.sys?.interaction?.current;
        const optionIds = (hostPrompt?.data?.options ?? []).map((option: any) => option?.id);
        return await getManualResyncCount(hostPage) >= 1
          && hostPrompt?.data?.sourceId === 'super_spies_operative_players'
          && hostPrompt?.playerId === '0'
          && optionIds.includes('player-0')
          && optionIds.includes('player-1')
          && guestState?.sys?.interaction?.current == null;
      }, {
        message: 'manual-resync 后，Operative 第一层玩家 prompt 仍应只留在 Host 页面',
        timeout: 20000,
      }).toBe(true);

      await expect(hostPage.getByRole('button', { name: '玩家 0' })).toBeVisible({ timeout: 15000 });
      await expect(hostPage.getByRole('button', { name: '玩家 1' })).toBeVisible({ timeout: 15000 });
      await expect(guestPage.getByRole('button', { name: '玩家 0' })).toHaveCount(0);
      await expect(guestPage.getByRole('button', { name: '玩家 1' })).toHaveCount(0);
      await expectOwnedOverlayPromptChromeSuppressed(hostPage);
      await hostPage.mouse.move(24, 24);
      await guestPage.mouse.move(24, 24);
      await hostPage.waitForTimeout(150);
      await screenshotViewport(hostPage, 'yuanhou-operative-manual-resync-player-choice-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-operative-manual-resync-no-player-choice-guest', testInfo);

      await hostPage.getByRole('button', { name: '玩家 1' }).click();
      await hostPage.getByRole('button', { name: /确认/ }).click();

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const hostPrompt = hostState?.sys?.interaction?.current;
        const optionIds = (hostPrompt?.data?.options ?? []).map((option: any) => option?.id);
        return hostPrompt?.data?.sourceId === 'super_spies_operative_top_bottom'
          && hostPrompt?.playerId === '0'
          && optionIds.includes('operative-resync-p1-top')
          && !optionIds.includes('operative-resync-p0-top');
      }, {
        message: 'Host 只勾选玩家1后，应进入第二层放底 prompt，且只列玩家1展示顶牌',
        timeout: 20000,
      }).toBe(true);

      await triggerShellVisibilityResync(hostPage);

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const guestState = await readHarnessState(guestPage);
        const hostPrompt = hostState?.sys?.interaction?.current;
        const optionIds = (hostPrompt?.data?.options ?? []).map((option: any) => option?.id);
        return await getManualResyncCount(hostPage) >= 2
          && hostPrompt?.data?.sourceId === 'super_spies_operative_top_bottom'
          && hostPrompt?.playerId === '0'
          && optionIds.includes('operative-resync-p1-top')
          && !optionIds.includes('operative-resync-p0-top')
          && guestState?.sys?.interaction?.current == null;
      }, {
        message: 'manual-resync 后，Operative 第二层放底 prompt 仍应只留在 Host 页面',
        timeout: 20000,
      }).toBe(true);

      await expect(hostPage.locator('[data-option-id="operative-resync-p1-top"]')).toBeVisible({ timeout: 15000 });
      await expect(hostPage.locator('[data-option-id="operative-resync-p0-top"]')).toHaveCount(0);
      await expect(guestPage.locator('[data-option-id="operative-resync-p1-top"]')).toHaveCount(0);
      await expect(hostPage.getByTestId('reveal-overlay')).toHaveCount(0);
      await expectOwnedOverlayPromptChromeSuppressed(hostPage);
      await hostPage.mouse.move(24, 24);
      await guestPage.mouse.move(24, 24);
      await hostPage.waitForTimeout(150);
      await screenshotViewport(hostPage, 'yuanhou-operative-manual-resync-top-bottom-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-operative-manual-resync-no-top-bottom-guest', testInfo);

      await hostPage.locator('[data-option-id="operative-resync-p1-top"]').click();
      await hostPage.getByRole('button', { name: /确认/ }).click();

      await expect.poll(async () => {
        const serverState = await getMatchState(matchId, hostPage);
        const p0Deck = serverState?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
        const p1Deck = serverState?.core?.players?.['1']?.deck?.map((card: any) => card.uid) ?? [];
        return serverState?.sys?.interaction?.current == null
          && p0Deck.join(',') === 'operative-resync-p0-top,operative-resync-p0-second'
          && p1Deck.join(',') === 'operative-resync-p1-second,operative-resync-p1-top';
      }, {
        message: 'manual-resync 后 Host 在第二层只选择 Guest 展示顶牌时，服务端应只把该牌放到底并完成收口',
        timeout: 20000,
      }).toBe(true);

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const guestState = await readHarnessState(guestPage);
        return hostState?.sys?.interaction?.current == null
          && guestState?.sys?.interaction?.current == null;
      }, {
        message: 'Operative manual-resync 收口后，Host/Guest 两页都不应残留任何交互 prompt',
        timeout: 15000,
      }).toBe(true);

      await screenshotViewport(hostPage, 'yuanhou-operative-manual-resync-resolved-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-operative-manual-resync-resolved-guest', testInfo);
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });

  test('超级间谍-Spy-真实多客户端下私有顶三重排 prompt 应只出现在行动玩家页面', async ({ page, game, browser }, testInfo) => {
    test.setTimeout(180000);
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
              hand: [{ uid: 'spy-mp-hand', defId: 'super_spies_spy', type: 'minion', owner: '0' }],
              deck: [
                { uid: 'spy-mp-deck-a', defId: 'super_spies_spy', type: 'minion', owner: '0' },
                { uid: 'spy-mp-deck-b', defId: 'super_spies_operative', type: 'minion', owner: '0' },
                { uid: 'spy-mp-deck-c', defId: 'super_spies_mole', type: 'minion', owner: '0' },
                { uid: 'spy-mp-deck-d', defId: 'super_spies_secret_agent', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['super_spies', 'time_travelers'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [],
              deck: [
                { uid: 'spy-mp-guest-a', defId: 'time_travelers_jumper', type: 'minion', owner: '1' },
                { uid: 'spy-mp-guest-b', defId: 'time_travelers_time_raider', type: 'minion', owner: '1' },
              ],
              discard: [],
              factions: ['shapeshifters', 'cyborg_apes'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            { defId: 'base_secret_volcano_headquarters', breakpoint: 18, minions: [], ongoingActions: [] },
            { defId: 'base_portal_room', breakpoint: 20, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    const preparedState = JSON.parse(JSON.stringify(await game.getState()));
    const setup = await setupSmashUpOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, {
      hostFactions: ['super_spies', 'time_travelers'],
      guestFactions: ['shapeshifters', 'cyborg_apes'],
      skipFactionSelection: true,
      testInfo,
    });
    if (!setup) {
      test.skip(true, 'SmashUp 联机房间创建失败');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

    try {
      const mergedState = JSON.parse(JSON.stringify(preparedState));
      mergedState.core = {
        ...mergedState.core,
        phase: preparedState?.sys?.phase ?? preparedState?.core?.phase ?? 'playCards',
        factionSelection: undefined,
        titans: [],
        triggerQueue: [],
      };
      mergedState.sys = {
        ...mergedState.sys,
        matchId,
        turnOrder: Array.isArray(preparedState?.core?.turnOrder)
          ? [...preparedState.core.turnOrder]
          : mergedState.sys?.turnOrder,
        currentPlayerIndex: typeof preparedState?.core?.currentPlayerIndex === 'number'
          ? preparedState.core.currentPlayerIndex
          : mergedState.sys?.currentPlayerIndex,
        phase: preparedState?.sys?.phase ?? mergedState.sys?.phase,
        interaction: {
          ...mergedState.sys?.interaction,
          current: undefined,
        },
        responseWindow: {
          ...mergedState.sys?.responseWindow,
          current: undefined,
        },
      };

      await injectMatchState(matchId, mergedState, hostPage);
      await hostPage.reload({ waitUntil: 'domcontentloaded' });
      await guestPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForSmashUpUI(hostPage);
      await waitForSmashUpUI(guestPage);

      await expect(hostPage.locator('[data-card-uid="spy-mp-hand"]')).toBeVisible({ timeout: 15000 });
      await hostPage.locator('[data-card-uid="spy-mp-hand"]').click();
      await hostPage.getByTestId('base-zone-0').click();

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const hostPrompt = hostState?.sys?.interaction?.current;
        const optionIds = (hostPrompt?.data?.options ?? []).map((option: any) => option?.id);
        return hostPrompt?.data?.sourceId === 'super_spies_spy_reorder'
          && hostPrompt?.playerId === '0'
          && optionIds.length > 0
          && hasUid(hostState?.core?.bases?.[0]?.minions, 'spy-mp-hand');
      }, {
        message: 'Host 打出 Spy 后，私有顶三重排 prompt 应只出现在 Host 页面',
        timeout: 20000,
      }).toBe(true);

      await expect.poll(async () => {
        const guestState = await readHarnessState(guestPage);
        return guestState?.sys?.interaction?.current == null;
      }, {
        message: 'Guest 页面不应拿到 Spy 的私有顶三重排 prompt 控制权',
        timeout: 20000,
      }).toBe(true);

      await expect(hostPage.locator('[data-deck-reorder-card-uid="spy-mp-deck-b"]')).toBeVisible({ timeout: 15000 });
      await expect(hostPage.getByRole('button', { name: '确认顺序' })).toBeVisible({ timeout: 15000 });
      await expect(guestPage.getByRole('button', { name: '确认顺序' })).toHaveCount(0);
      await expect(hostPage.getByTestId('reveal-overlay')).toHaveCount(0);
      await expectOwnedOverlayPromptChromeSuppressed(hostPage);
      await screenshotViewport(hostPage, 'yuanhou-spy-multiplayer-reorder-prompt-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-spy-multiplayer-no-reorder-prompt-guest', testInfo);

      await hostPage.locator('[data-deck-reorder-card-uid="spy-mp-deck-b"]').click();
      await hostPage.getByRole('button', { name: '移到牌库底' }).click();
      await hostPage.locator('[data-deck-reorder-card-uid="spy-mp-deck-c"]').click();
      await hostPage.getByRole('button', { name: '前移' }).click();
      await hostPage.getByRole('button', { name: '确认顺序' }).click();

      await expect.poll(async () => {
        const serverState = await getMatchState(matchId, hostPage);
        const p0Deck = serverState?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
        return serverState?.sys?.interaction?.current == null
          && p0Deck.join(',') === 'spy-mp-deck-c,spy-mp-deck-a,spy-mp-deck-d,spy-mp-deck-b';
      }, {
        message: 'Host 完成 Spy 顶三重排后，服务端应只改写 Host 自己牌库的 inspected 顶三顺序',
        timeout: 20000,
      }).toBe(true);

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const guestState = await readHarnessState(guestPage);
        return hostState?.sys?.interaction?.current == null
          && guestState?.sys?.interaction?.current == null;
      }, {
        message: 'Spy 顶三重排收口后，Host/Guest 两页都不应残留私有 prompt',
        timeout: 15000,
      }).toBe(true);

      await screenshotViewport(hostPage, 'yuanhou-spy-multiplayer-reordered-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-spy-multiplayer-reordered-guest', testInfo);
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });

  test('超级间谍-Spy-恢复可见触发 manual-resync 后私有顶三重排 prompt 仍只归行动玩家页面', async ({ page, game, browser }, testInfo) => {
    test.setTimeout(180000);
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
              hand: [{ uid: 'spy-resync-hand', defId: 'super_spies_spy', type: 'minion', owner: '0' }],
              deck: [
                { uid: 'spy-resync-deck-a', defId: 'super_spies_spy', type: 'minion', owner: '0' },
                { uid: 'spy-resync-deck-b', defId: 'super_spies_operative', type: 'minion', owner: '0' },
                { uid: 'spy-resync-deck-c', defId: 'super_spies_mole', type: 'minion', owner: '0' },
                { uid: 'spy-resync-deck-d', defId: 'super_spies_secret_agent', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['super_spies', 'time_travelers'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [],
              deck: [
                { uid: 'spy-resync-guest-a', defId: 'time_travelers_jumper', type: 'minion', owner: '1' },
                { uid: 'spy-resync-guest-b', defId: 'time_travelers_time_raider', type: 'minion', owner: '1' },
              ],
              discard: [],
              factions: ['shapeshifters', 'cyborg_apes'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            { defId: 'base_secret_volcano_headquarters', breakpoint: 18, minions: [], ongoingActions: [] },
            { defId: 'base_portal_room', breakpoint: 20, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    const preparedState = JSON.parse(JSON.stringify(await game.getState()));
    const setup = await setupSmashUpOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, {
      hostFactions: ['super_spies', 'time_travelers'],
      guestFactions: ['shapeshifters', 'cyborg_apes'],
      skipFactionSelection: true,
      testInfo,
    });
    if (!setup) {
      test.skip(true, 'SmashUp 联机房间创建失败');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

    try {
      const mergedState = JSON.parse(JSON.stringify(preparedState));
      mergedState.core = {
        ...mergedState.core,
        phase: preparedState?.sys?.phase ?? preparedState?.core?.phase ?? 'playCards',
        factionSelection: undefined,
        titans: [],
        triggerQueue: [],
      };
      mergedState.sys = {
        ...mergedState.sys,
        matchId,
        turnOrder: Array.isArray(preparedState?.core?.turnOrder)
          ? [...preparedState.core.turnOrder]
          : mergedState.sys?.turnOrder,
        currentPlayerIndex: typeof preparedState?.core?.currentPlayerIndex === 'number'
          ? preparedState.core.currentPlayerIndex
          : mergedState.sys?.currentPlayerIndex,
        phase: preparedState?.sys?.phase ?? mergedState.sys?.phase,
        interaction: {
          ...mergedState.sys?.interaction,
          current: undefined,
        },
        responseWindow: {
          ...mergedState.sys?.responseWindow,
          current: undefined,
        },
      };

      await injectMatchState(matchId, mergedState, hostPage);
      await hostPage.reload({ waitUntil: 'domcontentloaded' });
      await guestPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForSmashUpUI(hostPage);
      await waitForSmashUpUI(guestPage);
      await installManualResyncTracker(hostPage);

      await expect(hostPage.locator('[data-card-uid="spy-resync-hand"]')).toBeVisible({ timeout: 15000 });
      await hostPage.locator('[data-card-uid="spy-resync-hand"]').click();
      await hostPage.getByTestId('base-zone-0').click();

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const hostPrompt = hostState?.sys?.interaction?.current;
        const optionIds = (hostPrompt?.data?.options ?? []).map((option: any) => option?.id);
        return hostPrompt?.data?.sourceId === 'super_spies_spy_reorder'
          && hostPrompt?.playerId === '0'
          && optionIds.length > 0
          && hasUid(hostState?.core?.bases?.[0]?.minions, 'spy-resync-hand');
      }, {
        message: 'Host 打出 Spy 后，应先进入私有顶三重排 prompt',
        timeout: 20000,
      }).toBe(true);

      await triggerShellVisibilityResync(hostPage);

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const guestState = await readHarnessState(guestPage);
        const hostPrompt = hostState?.sys?.interaction?.current;
        const optionIds = (hostPrompt?.data?.options ?? []).map((option: any) => option?.id);
        return await getManualResyncCount(hostPage) >= 1
          && hostPrompt?.data?.sourceId === 'super_spies_spy_reorder'
          && hostPrompt?.playerId === '0'
          && optionIds.length > 0
          && guestState?.sys?.interaction?.current == null;
      }, {
        message: 'manual-resync 后，Spy 的私有顶三重排 prompt 仍应只留在 Host 页面',
        timeout: 20000,
      }).toBe(true);

      const spyConfirmButton = hostPage.getByRole('button', { name: '确认顺序' });
      await expect(hostPage.getByText('间谍：将这几张牌按任意顺序放回牌库顶/底')).toBeVisible({ timeout: 15000 });
      await expect(spyConfirmButton).toBeVisible({ timeout: 15000 });
      await expect(guestPage.getByRole('button', { name: '确认顺序' })).toHaveCount(0);
      await expect(hostPage.getByTestId('reveal-overlay')).toHaveCount(0);
      await expectOwnedOverlayPromptChromeSuppressed(hostPage);
      await hostPage.mouse.move(24, 24);
      await guestPage.mouse.move(24, 24);
      await hostPage.waitForTimeout(150);
      await screenshotViewport(hostPage, 'yuanhou-spy-manual-resync-reorder-prompt-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-spy-manual-resync-no-reorder-prompt-guest', testInfo);

      await spyConfirmButton.click();

      await expect.poll(async () => {
        const serverState = await getMatchState(matchId, hostPage);
        const p0Deck = serverState?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
        return serverState?.sys?.interaction?.current == null
          && p0Deck.join(',') === 'spy-resync-deck-a,spy-resync-deck-b,spy-resync-deck-c,spy-resync-deck-d';
      }, {
        message: 'manual-resync 后按默认顺序确认 Spy，服务端仍应只收口 Host 自己的私有重排交互',
        timeout: 20000,
      }).toBe(true);

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const guestState = await readHarnessState(guestPage);
        return hostState?.sys?.interaction?.current == null
          && guestState?.sys?.interaction?.current == null;
      }, {
        message: 'manual-resync 后 Spy 顶三重排收口，Host/Guest 两页都不应残留私有 prompt',
        timeout: 15000,
      }).toBe(true);

      await screenshotViewport(hostPage, 'yuanhou-spy-manual-resync-resolved-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-spy-manual-resync-resolved-guest', testInfo);
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });

  test('超级间谍-For My Eyes Only-真实多客户端下私有顶五重排 prompt 应只出现在行动玩家页面', async ({ page, game, browser }, testInfo) => {
    test.setTimeout(180000);
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
              hand: [{ uid: 'eyes-mp-hand', defId: 'super_spies_for_my_eyes_only', type: 'action', owner: '0' }],
              deck: [
                { uid: 'eyes-mp-deck-a', defId: 'super_spies_spy', type: 'minion', owner: '0' },
                { uid: 'eyes-mp-deck-b', defId: 'super_spies_operative', type: 'minion', owner: '0' },
                { uid: 'eyes-mp-deck-c', defId: 'super_spies_mole', type: 'minion', owner: '0' },
                { uid: 'eyes-mp-deck-d', defId: 'super_spies_secret_agent', type: 'minion', owner: '0' },
                { uid: 'eyes-mp-deck-e', defId: 'time_travelers_jumper', type: 'minion', owner: '0' },
                { uid: 'eyes-mp-deck-f', defId: 'time_travelers_doctor_when', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['super_spies', 'time_travelers'],
              minionsPlayed: 1,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [],
              deck: [
                { uid: 'eyes-mp-guest-a', defId: 'time_travelers_jumper', type: 'minion', owner: '1' },
                { uid: 'eyes-mp-guest-b', defId: 'time_travelers_time_raider', type: 'minion', owner: '1' },
              ],
              discard: [],
              factions: ['shapeshifters', 'cyborg_apes'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            { defId: 'base_secret_volcano_headquarters', breakpoint: 18, minions: [], ongoingActions: [] },
            { defId: 'base_portal_room', breakpoint: 20, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    const preparedState = JSON.parse(JSON.stringify(await game.getState()));
    const setup = await setupSmashUpOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, {
      hostFactions: ['super_spies', 'time_travelers'],
      guestFactions: ['shapeshifters', 'cyborg_apes'],
      skipFactionSelection: true,
      testInfo,
    });
    if (!setup) {
      test.skip(true, 'SmashUp 联机房间创建失败');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

    try {
      const mergedState = JSON.parse(JSON.stringify(preparedState));
      mergedState.core = {
        ...mergedState.core,
        phase: preparedState?.sys?.phase ?? preparedState?.core?.phase ?? 'playCards',
        factionSelection: undefined,
        titans: [],
        triggerQueue: [],
      };
      mergedState.sys = {
        ...mergedState.sys,
        matchId,
        turnOrder: Array.isArray(preparedState?.core?.turnOrder)
          ? [...preparedState.core.turnOrder]
          : mergedState.sys?.turnOrder,
        currentPlayerIndex: typeof preparedState?.core?.currentPlayerIndex === 'number'
          ? preparedState.core.currentPlayerIndex
          : mergedState.sys?.currentPlayerIndex,
        phase: preparedState?.sys?.phase ?? mergedState.sys?.phase,
        interaction: {
          ...mergedState.sys?.interaction,
          current: undefined,
        },
        responseWindow: {
          ...mergedState.sys?.responseWindow,
          current: undefined,
        },
      };

      await injectMatchState(matchId, mergedState, hostPage);
      await hostPage.reload({ waitUntil: 'domcontentloaded' });
      await guestPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForSmashUpUI(hostPage);
      await waitForSmashUpUI(guestPage);

      await expect(hostPage.locator('[data-card-uid="eyes-mp-hand"]')).toBeVisible({ timeout: 15000 });
      await hostPage.locator('[data-card-uid="eyes-mp-hand"]').click();
      await hostPage.locator('[data-card-uid="eyes-mp-hand"]').click();

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const hostPrompt = hostState?.sys?.interaction?.current;
        const optionIds = (hostPrompt?.data?.options ?? []).map((option: any) => option?.id);
        return hostPrompt?.data?.sourceId === 'super_spies_for_my_eyes_only_reorder'
          && hostPrompt?.playerId === '0'
          && optionIds.length > 0
          && hasUid(hostState?.core?.players?.['0']?.discard, 'eyes-mp-hand');
      }, {
        message: 'Host 打出 For My Eyes Only 后，私有顶五重排 prompt 应只出现在 Host 页面',
        timeout: 20000,
      }).toBe(true);

      await expect.poll(async () => {
        const guestState = await readHarnessState(guestPage);
        return guestState?.sys?.interaction?.current == null;
      }, {
        message: 'Guest 页面不应拿到 For My Eyes Only 的私有顶五重排 prompt 控制权',
        timeout: 20000,
      }).toBe(true);

      await expect(hostPage.locator('[data-deck-reorder-card-uid="eyes-mp-deck-e"]')).toBeVisible({ timeout: 15000 });
      await expect(hostPage.getByRole('button', { name: '确认顺序' })).toBeVisible({ timeout: 15000 });
      await expect(guestPage.getByRole('button', { name: '确认顺序' })).toHaveCount(0);
      await expect(hostPage.getByTestId('reveal-overlay')).toHaveCount(0);
      await expectOwnedOverlayPromptChromeSuppressed(hostPage);
      await screenshotViewport(hostPage, 'yuanhou-for-my-eyes-only-multiplayer-reorder-prompt-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-for-my-eyes-only-multiplayer-no-reorder-prompt-guest', testInfo);

      await hostPage.locator('[data-deck-reorder-card-uid="eyes-mp-deck-e"]').click();
      await hostPage.getByRole('button', { name: '移到牌库底' }).click();
      await hostPage.locator('[data-deck-reorder-card-uid="eyes-mp-deck-b"]').click();
      await hostPage.getByRole('button', { name: '移到牌库底' }).click();
      await hostPage.locator('[data-deck-reorder-card-uid="eyes-mp-deck-d"]').click();
      await hostPage.getByRole('button', { name: '移到牌库底' }).click();
      await hostPage.locator('[data-deck-reorder-card-uid="eyes-mp-deck-c"]').click();
      await hostPage.getByRole('button', { name: '前移' }).click();
      await hostPage.getByRole('button', { name: '确认顺序' }).click();

      await expect.poll(async () => {
        const serverState = await getMatchState(matchId, hostPage);
        const p0Deck = serverState?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
        const p0Discard = serverState?.core?.players?.['0']?.discard?.map((card: any) => card.uid) ?? [];
        return serverState?.sys?.interaction?.current == null
          && p0Deck.join(',') === 'eyes-mp-deck-c,eyes-mp-deck-a,eyes-mp-deck-f,eyes-mp-deck-e,eyes-mp-deck-b,eyes-mp-deck-d'
          && p0Discard.includes('eyes-mp-hand');
      }, {
        message: 'Host 完成 For My Eyes Only 顶五重排后，服务端应只改写 Host 自己牌库的 inspected 顶五顺序，并让本行动进入弃牌堆',
        timeout: 20000,
      }).toBe(true);

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const guestState = await readHarnessState(guestPage);
        return hostState?.sys?.interaction?.current == null
          && guestState?.sys?.interaction?.current == null;
      }, {
        message: 'For My Eyes Only 顶五重排收口后，Host/Guest 两页都不应残留私有 prompt',
        timeout: 15000,
      }).toBe(true);

      await screenshotViewport(hostPage, 'yuanhou-for-my-eyes-only-multiplayer-reordered-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-for-my-eyes-only-multiplayer-reordered-guest', testInfo);
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });

  test('超级间谍-For My Eyes Only-恢复可见触发 manual-resync 后私有顶五重排 prompt 仍只归行动玩家页面', async ({ page, game, browser }, testInfo) => {
    test.setTimeout(180000);
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
              hand: [{ uid: 'eyes-resync-hand', defId: 'super_spies_for_my_eyes_only', type: 'action', owner: '0' }],
              deck: [
                { uid: 'eyes-resync-deck-a', defId: 'super_spies_spy', type: 'minion', owner: '0' },
                { uid: 'eyes-resync-deck-b', defId: 'super_spies_operative', type: 'minion', owner: '0' },
                { uid: 'eyes-resync-deck-c', defId: 'super_spies_mole', type: 'minion', owner: '0' },
                { uid: 'eyes-resync-deck-d', defId: 'super_spies_secret_agent', type: 'minion', owner: '0' },
                { uid: 'eyes-resync-deck-e', defId: 'time_travelers_jumper', type: 'minion', owner: '0' },
                { uid: 'eyes-resync-deck-f', defId: 'time_travelers_doctor_when', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['super_spies', 'time_travelers'],
              minionsPlayed: 1,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [],
              deck: [
                { uid: 'eyes-resync-guest-a', defId: 'time_travelers_jumper', type: 'minion', owner: '1' },
                { uid: 'eyes-resync-guest-b', defId: 'time_travelers_time_raider', type: 'minion', owner: '1' },
              ],
              discard: [],
              factions: ['shapeshifters', 'cyborg_apes'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            { defId: 'base_secret_volcano_headquarters', breakpoint: 18, minions: [], ongoingActions: [] },
            { defId: 'base_portal_room', breakpoint: 20, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    const preparedState = JSON.parse(JSON.stringify(await game.getState()));
    const setup = await setupSmashUpOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, {
      hostFactions: ['super_spies', 'time_travelers'],
      guestFactions: ['shapeshifters', 'cyborg_apes'],
      skipFactionSelection: true,
      testInfo,
    });
    if (!setup) {
      test.skip(true, 'SmashUp 联机房间创建失败');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

    try {
      const mergedState = JSON.parse(JSON.stringify(preparedState));
      mergedState.core = {
        ...mergedState.core,
        phase: preparedState?.sys?.phase ?? preparedState?.core?.phase ?? 'playCards',
        factionSelection: undefined,
        titans: [],
        triggerQueue: [],
      };
      mergedState.sys = {
        ...mergedState.sys,
        matchId,
        turnOrder: Array.isArray(preparedState?.core?.turnOrder)
          ? [...preparedState.core.turnOrder]
          : mergedState.sys?.turnOrder,
        currentPlayerIndex: typeof preparedState?.core?.currentPlayerIndex === 'number'
          ? preparedState.core.currentPlayerIndex
          : mergedState.sys?.currentPlayerIndex,
        phase: preparedState?.sys?.phase ?? mergedState.sys?.phase,
        interaction: {
          ...mergedState.sys?.interaction,
          current: undefined,
        },
        responseWindow: {
          ...mergedState.sys?.responseWindow,
          current: undefined,
        },
      };

      await injectMatchState(matchId, mergedState, hostPage);
      await hostPage.reload({ waitUntil: 'domcontentloaded' });
      await guestPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForSmashUpUI(hostPage);
      await waitForSmashUpUI(guestPage);
      await installManualResyncTracker(hostPage);

      await expect(hostPage.locator('[data-card-uid="eyes-resync-hand"]')).toBeVisible({ timeout: 15000 });
      await hostPage.locator('[data-card-uid="eyes-resync-hand"]').click();
      await hostPage.locator('[data-card-uid="eyes-resync-hand"]').click();

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const hostPrompt = hostState?.sys?.interaction?.current;
        const optionIds = (hostPrompt?.data?.options ?? []).map((option: any) => option?.id);
        return hostPrompt?.data?.sourceId === 'super_spies_for_my_eyes_only_reorder'
          && hostPrompt?.playerId === '0'
          && optionIds.length > 0
          && hasUid(hostState?.core?.players?.['0']?.discard, 'eyes-resync-hand');
      }, {
        message: 'Host 打出 For My Eyes Only 后，应先进入私有顶五重排 prompt',
        timeout: 20000,
      }).toBe(true);

      await triggerShellVisibilityResync(hostPage);

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const guestState = await readHarnessState(guestPage);
        const hostPrompt = hostState?.sys?.interaction?.current;
        const optionIds = (hostPrompt?.data?.options ?? []).map((option: any) => option?.id);
        return await getManualResyncCount(hostPage) >= 1
          && hostPrompt?.data?.sourceId === 'super_spies_for_my_eyes_only_reorder'
          && hostPrompt?.playerId === '0'
          && optionIds.length > 0
          && guestState?.sys?.interaction?.current == null;
      }, {
        message: 'manual-resync 后，For My Eyes Only 的私有顶五重排 prompt 仍应只留在 Host 页面',
        timeout: 20000,
      }).toBe(true);

      const eyesConfirmButton = hostPage.getByRole('button', { name: '确认顺序' });
      await expect(hostPage.getByText('只为我的眼睛：选择牌库顶/牌库底顺序')).toBeVisible({ timeout: 15000 });
      await expect(eyesConfirmButton).toBeVisible({ timeout: 15000 });
      await expect(guestPage.getByRole('button', { name: '确认顺序' })).toHaveCount(0);
      await expect(hostPage.getByTestId('reveal-overlay')).toHaveCount(0);
      await expectOwnedOverlayPromptChromeSuppressed(hostPage);
      await hostPage.mouse.move(24, 24);
      await guestPage.mouse.move(24, 24);
      await hostPage.waitForTimeout(150);
      await screenshotViewport(hostPage, 'yuanhou-for-my-eyes-only-manual-resync-reorder-prompt-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-for-my-eyes-only-manual-resync-no-reorder-prompt-guest', testInfo);

      await eyesConfirmButton.click();

      await expect.poll(async () => {
        const serverState = await getMatchState(matchId, hostPage);
        const p0Deck = serverState?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
        const p0Discard = serverState?.core?.players?.['0']?.discard?.map((card: any) => card.uid) ?? [];
        return serverState?.sys?.interaction?.current == null
          && p0Deck.join(',') === 'eyes-resync-deck-a,eyes-resync-deck-b,eyes-resync-deck-c,eyes-resync-deck-d,eyes-resync-deck-e,eyes-resync-deck-f'
          && p0Discard.includes('eyes-resync-hand');
      }, {
        message: 'manual-resync 后按当前默认顺序确认 For My Eyes Only，服务端仍应只收口 Host 自己的私有重排交互并弃掉本行动',
        timeout: 20000,
      }).toBe(true);

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const guestState = await readHarnessState(guestPage);
        return hostState?.sys?.interaction?.current == null
          && guestState?.sys?.interaction?.current == null;
      }, {
        message: 'manual-resync 后 For My Eyes Only 顶五重排收口，Host/Guest 两页都不应残留私有 prompt',
        timeout: 15000,
      }).toBe(true);

      await screenshotViewport(hostPage, 'yuanhou-for-my-eyes-only-manual-resync-resolved-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-for-my-eyes-only-manual-resync-resolved-guest', testInfo);
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });

  test('超级间谍-From Q With Love-恢复可见触发 manual-resync 后私有弃牌 prompt 仍只归行动玩家页面', async ({ page, game, browser }, testInfo) => {
    test.setTimeout(180000);
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
                { uid: 'q-resync-hand', defId: 'super_spies_from_q_with_love', type: 'action', owner: '0' },
                { uid: 'q-resync-old-hand', defId: 'sharks_mako', type: 'minion', owner: '0' },
              ],
              deck: [
                { uid: 'q-resync-draw-a', defId: 'sharks_hammerhead', type: 'minion', owner: '0' },
                { uid: 'q-resync-draw-b', defId: 'sharks_tiger_shark', type: 'minion', owner: '0' },
                { uid: 'q-resync-draw-c', defId: 'sharks_great_white', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['super_spies', 'time_travelers'],
              minionsPlayed: 1,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [],
              deck: [
                { uid: 'q-resync-guest-a', defId: 'time_travelers_jumper', type: 'minion', owner: '1' },
                { uid: 'q-resync-guest-b', defId: 'time_travelers_time_raider', type: 'minion', owner: '1' },
              ],
              discard: [],
              factions: ['shapeshifters', 'cyborg_apes'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            { defId: 'base_secret_volcano_headquarters', breakpoint: 18, minions: [], ongoingActions: [] },
            { defId: 'base_portal_room', breakpoint: 20, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    const preparedState = JSON.parse(JSON.stringify(await game.getState()));
    const setup = await setupSmashUpOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, {
      hostFactions: ['super_spies', 'time_travelers'],
      guestFactions: ['shapeshifters', 'cyborg_apes'],
      skipFactionSelection: true,
      testInfo,
    });
    if (!setup) {
      test.skip(true, 'SmashUp 联机房间创建失败');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

    try {
      const mergedState = JSON.parse(JSON.stringify(preparedState));
      mergedState.core = {
        ...mergedState.core,
        phase: preparedState?.sys?.phase ?? preparedState?.core?.phase ?? 'playCards',
        factionSelection: undefined,
        titans: [],
        triggerQueue: [],
      };
      mergedState.sys = {
        ...mergedState.sys,
        matchId,
        turnOrder: Array.isArray(preparedState?.core?.turnOrder)
          ? [...preparedState.core.turnOrder]
          : mergedState.sys?.turnOrder,
        currentPlayerIndex: typeof preparedState?.core?.currentPlayerIndex === 'number'
          ? preparedState.core.currentPlayerIndex
          : mergedState.sys?.currentPlayerIndex,
        phase: preparedState?.sys?.phase ?? mergedState.sys?.phase,
        interaction: {
          ...mergedState.sys?.interaction,
          current: undefined,
        },
        responseWindow: {
          ...mergedState.sys?.responseWindow,
          current: undefined,
        },
      };

      await injectMatchState(matchId, mergedState, hostPage);
      await hostPage.reload({ waitUntil: 'domcontentloaded' });
      await guestPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForSmashUpUI(hostPage);
      await waitForSmashUpUI(guestPage);
      await installManualResyncTracker(hostPage);

      await expect(hostPage.locator('[data-card-uid="q-resync-hand"]')).toBeVisible({ timeout: 15000 });
      await hostPage.locator('[data-card-uid="q-resync-hand"]').click();
      await hostPage.locator('[data-card-uid="q-resync-hand"]').click();

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const guestState = await readHarnessState(guestPage);
        const prompt = hostState?.sys?.interaction?.current;
        const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
        return prompt?.data?.sourceId === 'super_spies_from_q_with_love_discard'
          && prompt?.playerId === '0'
          && prompt?.data?.multi?.min === 2
          && prompt?.data?.multi?.max === 2
          && optionIds.includes('q-resync-old-hand')
          && optionIds.includes('q-resync-draw-a')
          && optionIds.includes('q-resync-draw-b')
          && optionIds.includes('q-resync-draw-c')
          && !optionIds.includes('q-resync-hand')
          && guestState?.sys?.interaction?.current == null;
      }, {
        message: 'Host 真实打出 From Q With Love 后，应只在 Host 页面进入投影手牌弃两张 prompt，Guest 页面不得出现私有 discard prompt',
        timeout: 20000,
      }).toBe(true);

      await triggerShellVisibilityResync(hostPage);

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const guestState = await readHarnessState(guestPage);
        const prompt = hostState?.sys?.interaction?.current;
        const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
        return await getManualResyncCount(hostPage) >= 1
          && prompt?.data?.sourceId === 'super_spies_from_q_with_love_discard'
          && prompt?.playerId === '0'
          && prompt?.data?.multi?.min === 2
          && prompt?.data?.multi?.max === 2
          && optionIds.includes('q-resync-old-hand')
          && optionIds.includes('q-resync-draw-a')
          && optionIds.includes('q-resync-draw-b')
          && optionIds.includes('q-resync-draw-c')
          && !optionIds.includes('q-resync-hand')
          && guestState?.sys?.interaction?.current == null;
      }, {
        message: 'manual-resync 后，From Q With Love 的私有 discard prompt 仍应只留在 Host 页面',
        timeout: 20000,
      }).toBe(true);

      await dismissSmashUpSpotlightQueueIfVisible(hostPage);
      await dismissSmashUpSpotlightQueueIfVisible(guestPage);
      await expect(hostPage.getByRole('heading', { name: /来自Q的爱：选择要弃掉的两张牌/ })).toBeVisible({ timeout: 15000 });
      await expect(hostPage.locator('[data-option-id="q-resync-old-hand"]')).toBeVisible({ timeout: 15000 });
      await expect(hostPage.locator('[data-option-id="q-resync-draw-a"]')).toBeVisible({ timeout: 15000 });
      await expect(hostPage.locator('[data-option-id="q-resync-draw-b"]')).toBeVisible({ timeout: 15000 });
      await expect(hostPage.locator('[data-option-id="q-resync-draw-c"]')).toBeVisible({ timeout: 15000 });
      await expect(guestPage.getByRole('button', { name: /确认/ })).toHaveCount(0);
      await expect(guestPage.getByRole('heading', { name: /来自Q的爱：选择要弃掉的两张牌/ })).toHaveCount(0);
      await screenshotViewport(hostPage, 'yuanhou-from-q-with-love-manual-resync-discard-prompt-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-from-q-with-love-manual-resync-no-discard-prompt-guest', testInfo);

      await hostPage.locator('[data-option-id="q-resync-old-hand"]').click();
      await hostPage.locator('[data-option-id="q-resync-draw-c"]').click();
      await hostPage.getByRole('button', { name: /确认/ }).click();

      await expect.poll(async () => {
        const serverState = await getMatchState(matchId, hostPage);
        const p0Hand = serverState?.core?.players?.['0']?.hand?.map((card: any) => card.uid) ?? [];
        const p0Discard = serverState?.core?.players?.['0']?.discard?.map((card: any) => card.uid) ?? [];
        const p0Deck = serverState?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
        return serverState?.sys?.interaction?.current == null
          && p0Hand.join(',') === 'q-resync-draw-a,q-resync-draw-b'
          && p0Discard.includes('q-resync-hand')
          && p0Discard.includes('q-resync-old-hand')
          && p0Discard.includes('q-resync-draw-c')
          && p0Deck.length === 0;
      }, {
        message: 'manual-resync 后由 Host 确认弃牌，服务端权威状态应只弃掉所选两张并保留未弃的新抽牌',
        timeout: 20000,
      }).toBe(true);

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const guestState = await readHarnessState(guestPage);
        return hostState?.sys?.interaction?.current == null
          && guestState?.sys?.interaction?.current == null;
      }, {
        message: 'From Q With Love manual-resync 收口后，Host/Guest 两页都不应残留私有 discard prompt',
        timeout: 15000,
      }).toBe(true);

      await dismissSmashUpSpotlightQueueIfVisible(hostPage);
      await dismissSmashUpSpotlightQueueIfVisible(guestPage);
      await screenshotViewport(hostPage, 'yuanhou-from-q-with-love-manual-resync-resolved-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-from-q-with-love-manual-resync-resolved-guest', testInfo);
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });

  test('超级间谍-Secret Agent-真实多客户端下应只在行动玩家页面给出弃手牌选择权', async ({ page, game, browser }, testInfo) => {
    test.setTimeout(180000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '1',
      phase: 'playCards',
      extra: {
        core: {
          turnOrder: ['0', '1'],
          currentPlayerIndex: 1,
          turnNumber: 1,
          nextUid: 1000,
          players: {
            '0': {
              id: '0',
              vp: 0,
              hand: [],
              deck: [],
              discard: [],
              factions: ['super_spies', 'time_travelers'],
              minionsPlayed: 1,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [
                { uid: 'stasis-a', defId: 'time_travelers_stasis_field', type: 'action', owner: '1' },
                { uid: 'hand-a', defId: 'sharks_mako', type: 'minion', owner: '1' },
                { uid: 'hand-b', defId: 'time_travelers_time_walk', type: 'action', owner: '1' },
              ],
              deck: [],
              discard: [],
              factions: ['time_travelers', 'cyborg_apes'],
              minionsPlayed: 1,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_isis_swingin_pad',
              breakpoint: 21,
              minions: [{
                uid: 'agent-a',
                defId: 'super_spies_secret_agent',
                controller: '0',
                owner: '0',
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
            { defId: 'base_portal_room', breakpoint: 22, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    const preparedState = JSON.parse(JSON.stringify(await game.getState()));
    const setup = await setupSmashUpOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, {
      hostFactions: ['super_spies', 'time_travelers'],
      guestFactions: ['shapeshifters', 'cyborg_apes'],
      skipFactionSelection: true,
      testInfo,
    });
    if (!setup) {
      test.skip(true, 'SmashUp 联机房间创建失败');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

    try {
      const mergedState = JSON.parse(JSON.stringify(preparedState));
      mergedState.core = {
        ...mergedState.core,
        phase: preparedState?.sys?.phase ?? preparedState?.core?.phase ?? 'playCards',
        factionSelection: undefined,
        titans: [],
        triggerQueue: [],
      };
      mergedState.sys = {
        ...mergedState.sys,
        matchId,
        turnOrder: Array.isArray(preparedState?.core?.turnOrder)
          ? [...preparedState.core.turnOrder]
          : mergedState.sys?.turnOrder,
        currentPlayerIndex: typeof preparedState?.core?.currentPlayerIndex === 'number'
          ? preparedState.core.currentPlayerIndex
          : mergedState.sys?.currentPlayerIndex,
        phase: preparedState?.sys?.phase ?? mergedState.sys?.phase,
        interaction: {
          ...mergedState.sys?.interaction,
          current: undefined,
        },
        responseWindow: {
          ...mergedState.sys?.responseWindow,
          current: undefined,
        },
      };

      await injectMatchState(matchId, mergedState, hostPage);
      await hostPage.reload({ waitUntil: 'domcontentloaded' });
      await guestPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForSmashUpUI(hostPage);
      await waitForSmashUpUI(guestPage);

      await expect(guestPage.locator('[data-card-uid="stasis-a"]')).toBeVisible({ timeout: 15000 });
      await guestPage.locator('[data-card-uid="stasis-a"]').click();
      await guestPage.getByTestId('base-zone-1').click({ force: true });

      await expect.poll(async () => {
        const guestState = await readHarnessState(guestPage);
        const prompt = guestState?.sys?.interaction?.current;
        const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
        const targetBase = guestState?.core?.bases?.[1];
        return prompt?.data?.sourceId === 'super_spies_secret_agent_discard'
          && prompt?.playerId === '1'
          && optionIds.includes('hand-a')
          && optionIds.includes('hand-b')
          && !optionIds.includes('stasis-a')
          && hasUid(targetBase?.ongoingActions, 'stasis-a');
      }, {
        message: 'P1 真实打出 Stasis Field 后，行动玩家 P1 页面应进入 Secret Agent 弃手牌 prompt，并且候选只包含剩余 hand-a/hand-b',
        timeout: 20000,
      }).toBe(true);

      await expect(hostPage.getByRole('heading', { name: /秘密特工：选择要弃掉的手牌/ })).toHaveCount(0);
      await expect(hostPage.locator('[data-card-uid="hand-a"]')).toHaveCount(0);
      await expect(hostPage.locator('[data-card-uid="hand-b"]')).toHaveCount(0);
      await dismissSmashUpSpotlightQueueIfVisible(hostPage);
      await dismissSmashUpSpotlightQueueIfVisible(guestPage);
      await screenshotViewport(guestPage, 'yuanhou-secret-agent-discard-prompt-guest', testInfo);
      await screenshotViewport(hostPage, 'yuanhou-secret-agent-non-target-host', testInfo);

      await guestPage.locator('[data-card-uid="hand-b"]').click();

      await expect.poll(async () => {
        const serverState = await getMatchState(matchId, hostPage);
        const p1Hand = serverState?.core?.players?.['1']?.hand ?? [];
        const p1Discard = serverState?.core?.players?.['1']?.discard ?? [];
        const targetBase = serverState?.core?.bases?.[1];
        return serverState?.sys?.interaction?.current == null
          && hasUid(p1Hand, 'hand-a')
          && !hasUid(p1Hand, 'hand-b')
          && hasUid(p1Discard, 'hand-b')
          && hasUid(targetBase?.ongoingActions, 'stasis-a');
      }, {
        message: 'P1 在自己页面选择 hand-b 后，服务端权威状态应只弃掉 hand-b，并保留 Stasis Field 继续附着在 Portal Room',
        timeout: 20000,
      }).toBe(true);

      await expect(guestPage.getByRole('heading', { name: /秘密特工：选择要弃掉的手牌/ })).toHaveCount(0);
      await expect(guestPage.locator('[data-card-uid="hand-a"]')).toBeVisible({ timeout: 15000 });
      await screenshotViewport(guestPage, 'yuanhou-secret-agent-resolved-guest', testInfo);
      await screenshotViewport(hostPage, 'yuanhou-secret-agent-resolved-host', testInfo);
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });

  test('超级间谍-Secret Agent-真实多客户端下若只剩一张手牌应自动弃掉且不弹 prompt', async ({ page, game, browser }, testInfo) => {
    test.setTimeout(180000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '1',
      phase: 'playCards',
      extra: {
        core: {
          turnOrder: ['0', '1'],
          currentPlayerIndex: 1,
          turnNumber: 1,
          nextUid: 1000,
          players: {
            '0': {
              id: '0',
              vp: 0,
              hand: [],
              deck: [],
              discard: [],
              factions: ['super_spies', 'time_travelers'],
              minionsPlayed: 1,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [
                { uid: 'secret-short-stasis', defId: 'time_travelers_stasis_field', type: 'action', owner: '1' },
                { uid: 'secret-short-last', defId: 'sharks_mako', type: 'minion', owner: '1' },
              ],
              deck: [],
              discard: [],
              factions: ['time_travelers', 'cyborg_apes'],
              minionsPlayed: 1,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_isis_swingin_pad',
              breakpoint: 21,
              minions: [{
                uid: 'secret-short-agent',
                defId: 'super_spies_secret_agent',
                controller: '0',
                owner: '0',
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
            { defId: 'base_portal_room', breakpoint: 22, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    const preparedState = JSON.parse(JSON.stringify(await game.getState()));
    const setup = await setupSmashUpOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, {
      hostFactions: ['super_spies', 'time_travelers'],
      guestFactions: ['time_travelers', 'cyborg_apes'],
      skipFactionSelection: true,
      testInfo,
    });
    if (!setup) {
      test.skip(true, 'SmashUp 联机房间创建失败');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

    try {
      const mergedState = JSON.parse(JSON.stringify(preparedState));
      mergedState.core = {
        ...mergedState.core,
        phase: preparedState?.sys?.phase ?? preparedState?.core?.phase ?? 'playCards',
        factionSelection: undefined,
        titans: [],
        triggerQueue: [],
      };
      mergedState.sys = {
        ...mergedState.sys,
        matchId,
        turnOrder: Array.isArray(preparedState?.core?.turnOrder)
          ? [...preparedState.core.turnOrder]
          : mergedState.sys?.turnOrder,
        currentPlayerIndex: typeof preparedState?.core?.currentPlayerIndex === 'number'
          ? preparedState.core.currentPlayerIndex
          : mergedState.sys?.currentPlayerIndex,
        phase: preparedState?.sys?.phase ?? mergedState.sys?.phase,
        interaction: {
          ...mergedState.sys?.interaction,
          current: undefined,
        },
        responseWindow: {
          ...mergedState.sys?.responseWindow,
          current: undefined,
        },
      };

      await injectMatchState(matchId, mergedState, hostPage);
      await hostPage.reload({ waitUntil: 'domcontentloaded' });
      await guestPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForSmashUpUI(hostPage);
      await waitForSmashUpUI(guestPage);

      await expect(guestPage.locator('[data-card-uid="secret-short-stasis"]')).toBeVisible({ timeout: 15000 });
      await guestPage.locator('[data-card-uid="secret-short-stasis"]').click();
      await guestPage.getByTestId('base-zone-1').click({ force: true });

      await expect.poll(async () => {
        const serverState = await getMatchState(matchId, hostPage);
        const p1Hand = serverState?.core?.players?.['1']?.hand ?? [];
        const p1Discard = serverState?.core?.players?.['1']?.discard ?? [];
        const ongoing = serverState?.core?.bases?.[1]?.ongoingActions ?? [];
        return serverState?.sys?.interaction?.current == null
          && !hasUid(p1Hand, 'secret-short-last')
          && hasUid(p1Discard, 'secret-short-last')
          && hasUid(ongoing, 'secret-short-stasis');
      }, {
        message: 'Guest 真实打出行动后若只剩一张手牌，Secret Agent 应自动弃掉该牌且不创建 discard prompt',
        timeout: 20000,
      }).toBe(true);

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const guestState = await readHarnessState(guestPage);
        return hostState?.sys?.interaction?.current == null
          && guestState?.sys?.interaction?.current == null;
      }, {
        message: 'Secret Agent 单候选自动分支收口后，Host/Guest 两页都不应残留 prompt',
        timeout: 20000,
      }).toBe(true);

      await expect(guestPage.getByRole('heading', { name: /秘密特工：选择要弃掉的手牌/ })).toHaveCount(0);
      await expect(hostPage.getByRole('heading', { name: /秘密特工：选择要弃掉的手牌/ })).toHaveCount(0);
      await expect(hostPage.getByText(/正在等待 Guest-SU-E2E/)).toHaveCount(0);
      await expect(guestPage.locator('[data-card-uid="secret-short-last"]')).toHaveCount(0);
      await screenshotViewport(guestPage, 'yuanhou-secret-agent-single-auto-discard-guest', testInfo);
      await screenshotViewport(hostPage, 'yuanhou-secret-agent-single-auto-discard-host', testInfo);
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });

  test('超级间谍-Secret Agent-真实多客户端下若打完后已无剩余手牌则不应创建弃牌 prompt', async ({ page, game, browser }, testInfo) => {
    test.setTimeout(180000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '1',
      phase: 'playCards',
      extra: {
        core: {
          turnOrder: ['0', '1'],
          currentPlayerIndex: 1,
          turnNumber: 1,
          nextUid: 1000,
          players: {
            '0': {
              id: '0',
              vp: 0,
              hand: [],
              deck: [],
              discard: [],
              factions: ['super_spies', 'time_travelers'],
              minionsPlayed: 1,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [
                { uid: 'secret-zero-stasis', defId: 'time_travelers_stasis_field', type: 'action', owner: '1' },
              ],
              deck: [],
              discard: [],
              factions: ['time_travelers', 'cyborg_apes'],
              minionsPlayed: 1,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_isis_swingin_pad',
              breakpoint: 21,
              minions: [{
                uid: 'secret-zero-agent',
                defId: 'super_spies_secret_agent',
                controller: '0',
                owner: '0',
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
            { defId: 'base_portal_room', breakpoint: 22, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    const preparedState = JSON.parse(JSON.stringify(await game.getState()));
    const setup = await setupSmashUpOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, {
      hostFactions: ['super_spies', 'time_travelers'],
      guestFactions: ['time_travelers', 'cyborg_apes'],
      skipFactionSelection: true,
      testInfo,
    });
    if (!setup) {
      test.skip(true, 'SmashUp 联机房间创建失败');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

    try {
      const mergedState = JSON.parse(JSON.stringify(preparedState));
      mergedState.core = {
        ...mergedState.core,
        phase: preparedState?.sys?.phase ?? preparedState?.core?.phase ?? 'playCards',
        factionSelection: undefined,
        titans: [],
        triggerQueue: [],
      };
      mergedState.sys = {
        ...mergedState.sys,
        matchId,
        turnOrder: Array.isArray(preparedState?.core?.turnOrder)
          ? [...preparedState.core.turnOrder]
          : mergedState.sys?.turnOrder,
        currentPlayerIndex: typeof preparedState?.core?.currentPlayerIndex === 'number'
          ? preparedState.core.currentPlayerIndex
          : mergedState.sys?.currentPlayerIndex,
        phase: preparedState?.sys?.phase ?? mergedState.sys?.phase,
        interaction: {
          ...mergedState.sys?.interaction,
          current: undefined,
        },
        responseWindow: {
          ...mergedState.sys?.responseWindow,
          current: undefined,
        },
      };

      await injectMatchState(matchId, mergedState, hostPage);
      await hostPage.reload({ waitUntil: 'domcontentloaded' });
      await guestPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForSmashUpUI(hostPage);
      await waitForSmashUpUI(guestPage);

      await expect(guestPage.locator('[data-card-uid="secret-zero-stasis"]')).toBeVisible({ timeout: 15000 });
      await guestPage.locator('[data-card-uid="secret-zero-stasis"]').click();
      await guestPage.getByTestId('base-zone-1').click({ force: true });

      await expect.poll(async () => {
        const serverState = await getMatchState(matchId, hostPage);
        const p1Hand = serverState?.core?.players?.['1']?.hand ?? [];
        const p1Discard = serverState?.core?.players?.['1']?.discard ?? [];
        const ongoing = serverState?.core?.bases?.[1]?.ongoingActions ?? [];
        return serverState?.sys?.interaction?.current == null
          && p1Hand.length === 0
          && p1Discard.length === 0
          && hasUid(ongoing, 'secret-zero-stasis');
      }, {
        message: 'Guest 真实打出行动后若已无剩余手牌，Secret Agent 不应创建 discard prompt，且刚打出的行动应继续附着在基地上',
        timeout: 20000,
      }).toBe(true);

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const guestState = await readHarnessState(guestPage);
        return hostState?.sys?.interaction?.current == null
          && guestState?.sys?.interaction?.current == null;
      }, {
        message: 'Secret Agent 空手牌自动无事发生分支收口后，Host/Guest 两页都不应残留 prompt',
        timeout: 20000,
      }).toBe(true);

      await expect(guestPage.getByRole('heading', { name: /秘密特工：选择要弃掉的手牌/ })).toHaveCount(0);
      await expect(hostPage.getByRole('heading', { name: /秘密特工：选择要弃掉的手牌/ })).toHaveCount(0);
      await expect(hostPage.getByText(/正在等待 Guest-SU-E2E/)).toHaveCount(0);
      await expect(guestPage.locator('[data-card-uid="secret-zero-stasis"]')).toHaveCount(0);
      await screenshotViewport(guestPage, 'yuanhou-secret-agent-zero-hand-no-prompt-guest', testInfo);
      await screenshotViewport(hostPage, 'yuanhou-secret-agent-zero-hand-no-prompt-host', testInfo);
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });

  test('电子猿-Clyde 2.0-真实多客户端下离场行动选择权在Clyde控制者页面并可收入手牌或正常弃牌', async ({ page, game, browser }, testInfo) => {
    test.setTimeout(180000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { skipInitialization: true }, 45000);

    const prepareState = async (suffix: string) => {
      await game.setupScene({
        gameId: 'smashup',
        currentPlayer: '1',
        phase: 'playCards',
        extra: {
          core: {
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            turnNumber: 1,
            nextUid: 1000,
            players: {
              '0': {
                id: '0',
                vp: 0,
                hand: [],
                deck: [],
                discard: [],
                factions: ['cyborg_apes'],
                minionsPlayed: 1,
                minionLimit: 1,
                actionsPlayed: 1,
                actionLimit: 1,
              },
              '1': {
                id: '1',
                vp: 0,
                hand: [{ uid: `bananas-${suffix}`, defId: 'cyborg_apes_going_bananas', type: 'action', owner: '1' }],
                deck: [],
                discard: [],
                factions: ['cyborg_apes'],
                minionsPlayed: 1,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
              },
            },
            bases: [
              {
                defId: 'base_monkey_lab',
                breakpoint: 23,
                minions: [
                  {
                    uid: `clyde-${suffix}`,
                    defId: 'cyborg_apes_clyde_2_0',
                    controller: '0',
                    owner: '0',
                    basePower: 4,
                    powerCounters: 0,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    talentUsed: false,
                    playedThisTurn: false,
                    attachedActions: [],
                  },
                  {
                    uid: `host-${suffix}`,
                    defId: 'cyborg_apes_furious_george',
                    controller: '0',
                    owner: '0',
                    basePower: 2,
                    powerCounters: 0,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    talentUsed: false,
                    playedThisTurn: false,
                    attachedActions: [{ uid: `shield-${suffix}`, defId: 'cyborg_apes_shielding', ownerId: '0' }],
                  },
                ],
                ongoingActions: [],
              },
              { defId: 'base_portal_room', breakpoint: 22, minions: [], ongoingActions: [] },
            ],
            baseDeck: ['base_the_nexus'],
            baseDiscard: [],
          },
        },
      });
      return JSON.parse(JSON.stringify(await game.getState()));
    };

    const returnBranchState = await prepareState('return');
    const discardBranchState = await prepareState('discard');

    const setup = await setupSmashUpOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, {
      hostFactions: ['cyborg_apes', 'super_spies'],
      guestFactions: ['cyborg_apes', 'shapeshifters'],
      skipFactionSelection: true,
      testInfo,
    });
    if (!setup) {
      test.skip(true, 'SmashUp 联机房间创建失败');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

    const loadPreparedState = async (preparedState: any) => {
      const mergedState = JSON.parse(JSON.stringify(preparedState));
      mergedState.core = {
        ...mergedState.core,
        phase: preparedState?.sys?.phase ?? preparedState?.core?.phase ?? 'playCards',
        factionSelection: undefined,
        titans: [],
        triggerQueue: [],
      };
      mergedState.sys = {
        ...mergedState.sys,
        matchId,
        turnOrder: Array.isArray(preparedState?.core?.turnOrder)
          ? [...preparedState.core.turnOrder]
          : mergedState.sys?.turnOrder,
        currentPlayerIndex: typeof preparedState?.core?.currentPlayerIndex === 'number'
          ? preparedState.core.currentPlayerIndex
          : mergedState.sys?.currentPlayerIndex,
        phase: preparedState?.sys?.phase ?? mergedState.sys?.phase,
        interaction: {
          ...mergedState.sys?.interaction,
          current: undefined,
        },
        responseWindow: {
          ...mergedState.sys?.responseWindow,
          current: undefined,
        },
      };

      await injectMatchState(matchId, mergedState, hostPage);
      await hostPage.reload({ waitUntil: 'domcontentloaded' });
      await guestPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForSmashUpUI(hostPage);
      await waitForSmashUpUI(guestPage);
    };

    const playGoingBananasFromGuest = async (suffix: string) => {
      await expect(guestPage.locator(`[data-card-uid="bananas-${suffix}"]`)).toBeVisible({ timeout: 15000 });
      await expect(hostPage.locator(`[data-minion-uid="clyde-${suffix}"]`)).toBeVisible({ timeout: 15000 });
      await expect(hostPage.locator(`[data-minion-uid="host-${suffix}"]`)).toBeVisible({ timeout: 15000 });
      await guestPage.locator(`[data-card-uid="bananas-${suffix}"]`).click();
      await guestPage.locator('[data-base-index="0"]').click();

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const prompt = hostState?.sys?.interaction?.current;
        const host = hostState?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === `host-${suffix}`);
        const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
        return prompt?.data?.sourceId === 'cyborg_apes_clyde_2_0_detach'
          && prompt?.playerId === '0'
          && optionIds.includes('return-to-hand')
          && optionIds.includes('discard')
          && hasUid(host?.attachedActions, `shield-${suffix}`);
      }, {
        message: `P1 真实打出 Going Bananas 后，P0 的 Clyde 2.0 页面应拿到离场行动替代选择 ${suffix}`,
        timeout: 20000,
      }).toBe(true);

      await dismissSmashUpSpotlightQueueIfVisible(hostPage);
      await dismissSmashUpSpotlightQueueIfVisible(guestPage);
    };

    try {
      await loadPreparedState(returnBranchState);
      await screenshotViewport(hostPage, 'yuanhou-clyde-before-going-bananas-return-branch-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-clyde-before-going-bananas-return-branch-guest', testInfo);
      await playGoingBananasFromGuest('return');

      const hostReturnButton = hostPage.getByRole('button', { name: '收入手牌' });
      const hostDiscardButton = hostPage.getByRole('button', { name: '进入弃牌堆' });
      await expect(hostReturnButton).toBeVisible({ timeout: 15000 });
      await expect(hostDiscardButton).toBeVisible({ timeout: 15000 });
      await expect(guestPage.getByRole('button', { name: '收入手牌' })).toHaveCount(0);
      await screenshotViewport(hostPage, 'yuanhou-clyde-detach-choice-prompt-return-branch-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-clyde-detach-choice-waiting-guest', testInfo);
      await hostReturnButton.click();

      await expect.poll(async () => {
        const serverState = await getMatchState(matchId, hostPage);
        const host = serverState?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'host-return');
        const p0Hand = serverState?.core?.players?.['0']?.hand ?? [];
        const p0Discard = serverState?.core?.players?.['0']?.discard ?? [];
        const p1Discard = serverState?.core?.players?.['1']?.discard ?? [];
        return serverState?.sys?.interaction?.current == null
          && !hasUid(host?.attachedActions, 'shield-return')
          && hasUid(p0Hand, 'shield-return')
          && !hasUid(p0Discard, 'shield-return')
          && hasUid(p1Discard, 'bananas-return');
      }, {
        message: 'P0 在自己页面选择收入手牌后，shield-return 应进入 P0 hand，P1 的 Going Bananas 进 P1 discard',
        timeout: 20000,
      }).toBe(true);

      await screenshotViewport(hostPage, 'yuanhou-clyde-returned-action-to-hand-host', testInfo);

      await loadPreparedState(discardBranchState);
      await playGoingBananasFromGuest('discard');

      const hostDiscardChoice = hostPage.getByRole('button', { name: '进入弃牌堆' });
      await expect(hostDiscardChoice).toBeVisible({ timeout: 15000 });
      await screenshotViewport(hostPage, 'yuanhou-clyde-detach-choice-prompt-discard-branch-host', testInfo);
      await hostDiscardChoice.click();

      await expect.poll(async () => {
        const serverState = await getMatchState(matchId, hostPage);
        const host = serverState?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'host-discard');
        const p0Hand = serverState?.core?.players?.['0']?.hand ?? [];
        const p0Discard = serverState?.core?.players?.['0']?.discard ?? [];
        const p1Discard = serverState?.core?.players?.['1']?.discard ?? [];
        return serverState?.sys?.interaction?.current == null
          && !hasUid(host?.attachedActions, 'shield-discard')
          && !hasUid(p0Hand, 'shield-discard')
          && hasUid(p0Discard, 'shield-discard')
          && hasUid(p1Discard, 'bananas-discard');
      }, {
        message: 'P0 在自己页面选择正常弃牌后，shield-discard 应进入 P0 discard 而不是 hand',
        timeout: 20000,
      }).toBe(true);

      await screenshotViewport(hostPage, 'yuanhou-clyde-declined-action-discarded-host', testInfo);
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });

  test('时间旅行者-Jumper-真实多客户端下应先给 owner 的 Bacta extra prompt，再给 controller 的 optional reaction，并最终回 owner 手牌', async ({ page, game, browser }, testInfo) => {
    test.setTimeout(180000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '1',
      phase: 'playCards',
      extra: {
        core: {
          turnOrder: ['0', '1'],
          currentPlayerIndex: 1,
          turnNumber: 1,
          nextUid: 1000,
          players: {
            '0': {
              id: '0',
              vp: 0,
              hand: [{ uid: 'owner-extra-minion', defId: 'shapeshifters_mimic', type: 'minion', owner: '0' }],
              deck: [],
              discard: [],
              factions: ['time_travelers', 'shapeshifters'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [{ uid: 'p1-bacta-hand', defId: 'shapeshifters_bacta_the_future', type: 'action', owner: '1' }],
              deck: [],
              discard: [],
              factions: ['time_travelers', 'shapeshifters'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [{
            defId: 'base_portal_room',
            breakpoint: 20,
            minions: [{
              uid: 'stolen-jumper',
              defId: 'time_travelers_jumper',
              controller: '1',
              owner: '0',
              basePower: 2,
              powerCounters: 0,
              powerModifier: 0,
              tempPowerModifier: 0,
              talentUsed: false,
              playedThisTurn: false,
              attachedActions: [],
            }],
            ongoingActions: [],
          }],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    const preparedState = JSON.parse(JSON.stringify(await game.getState()));
    const setup = await setupSmashUpOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, {
      hostFactions: ['time_travelers', 'super_spies'],
      guestFactions: ['shapeshifters', 'cyborg_apes'],
      skipFactionSelection: true,
      testInfo,
    });
    if (!setup) {
      test.skip(true, 'SmashUp 联机房间创建失败');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

    try {
      const mergedState = JSON.parse(JSON.stringify(preparedState));
      mergedState.core = {
        ...mergedState.core,
        phase: preparedState?.sys?.phase ?? preparedState?.core?.phase ?? 'playCards',
        factionSelection: undefined,
        titans: [],
        triggerQueue: [],
      };
      mergedState.sys = {
        ...mergedState.sys,
        matchId,
        turnOrder: Array.isArray(preparedState?.core?.turnOrder)
          ? [...preparedState.core.turnOrder]
          : mergedState.sys?.turnOrder,
        currentPlayerIndex: typeof preparedState?.core?.currentPlayerIndex === 'number'
          ? preparedState.core.currentPlayerIndex
          : mergedState.sys?.currentPlayerIndex,
        phase: preparedState?.sys?.phase ?? mergedState.sys?.phase,
        interaction: {
          ...mergedState.sys?.interaction,
          current: undefined,
        },
        responseWindow: {
          ...mergedState.sys?.responseWindow,
          current: undefined,
        },
      };

      await injectMatchState(matchId, mergedState, hostPage);
      await hostPage.reload({ waitUntil: 'domcontentloaded' });
      await guestPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForSmashUpUI(hostPage);
      await waitForSmashUpUI(guestPage);

      await expect(guestPage.locator('[data-card-uid="p1-bacta-hand"]')).toBeVisible({ timeout: 15000 });
      await expect(guestPage.locator('[data-minion-uid="stolen-jumper"]')).toBeVisible({ timeout: 15000 });

      await guestPage.locator('[data-card-uid="p1-bacta-hand"]').click();
      await guestPage.waitForTimeout(250);
      await guestPage.locator('[data-minion-uid="stolen-jumper"]').click();

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const p0Discard = hostState?.core?.players?.['0']?.discard ?? [];
        const prompt = hostState?.sys?.interaction?.current;
        const promptCardUids = (prompt?.data?.options ?? [])
          .map((option: any) => option?.value?.cardUid)
          .filter((uid: unknown): uid is string => typeof uid === 'string');
        return prompt?.data?.sourceId === 'smashup_immediate_extra_minion'
          && prompt?.playerId === '0'
          && hasUid(p0Discard, 'stolen-jumper')
          && promptCardUids.includes('owner-extra-minion');
      }, {
        message: 'P1 用 Bacta 摧毁 stolen-jumper 后，应先在 owner=P0 页进入 Bacta 的 immediate extra minion prompt',
        timeout: 20000,
      }).toBe(true);

      await expect(hostPage.locator('[data-card-uid="owner-extra-minion"]')).toBeVisible({ timeout: 15000 });
      await expect(hostPage.getByRole('button', { name: '放弃这次额外随从' })).toBeVisible({ timeout: 15000 });
      await screenshotViewport(hostPage, 'yuanhou-jumper-owner-extra-prompt-host', testInfo);

      await hostPage.getByRole('button', { name: '放弃这次额外随从' }).click();

      let triggerOptionId = '';
      await expect.poll(async () => {
        const guestState = await readHarnessState(guestPage);
        const prompt = guestState?.sys?.interaction?.current;
        const triggerOption = (prompt?.data?.options ?? []).find((option: any) => option?.value?.kind === 'trigger');
        triggerOptionId = typeof triggerOption?.id === 'string' ? triggerOption.id : '';
        return prompt?.data?.sourceId === 'smashup_reaction_choose'
          && prompt?.playerId === '1'
          && triggerOptionId.length > 0;
      }, {
        message: 'owner=P0 跳过 Bacta extra prompt 后，应在 controller=P1 页进入 Jumper 的 optional reaction prompt',
        timeout: 20000,
      }).toBe(true);

      const guestTriggerButton = guestPage.getByRole('button', { name: /跳跃者/ });
      const hostTriggerButton = hostPage.getByRole('button', { name: /跳跃者/ });
      await expect(guestTriggerButton).toBeVisible({ timeout: 15000 });
      await expect(hostTriggerButton).toHaveCount(0);
      await screenshotViewport(guestPage, 'yuanhou-jumper-controller-reaction-prompt-guest', testInfo);
      await screenshotLocator(guestTriggerButton, 'yuanhou-jumper-controller-trigger-option', testInfo);

      await guestTriggerButton.click();

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const p0Hand = hostState?.core?.players?.['0']?.hand ?? [];
        const p0Discard = hostState?.core?.players?.['0']?.discard ?? [];
        const p1Hand = hostState?.core?.players?.['1']?.hand ?? [];
        return hostState?.sys?.interaction?.current == null
          && hasUid(p0Hand, 'stolen-jumper')
          && !hasUid(p0Discard, 'stolen-jumper')
          && !hasUid(p1Hand, 'stolen-jumper');
      }, {
        message: 'controller=P1 选择触发 Jumper 后，stolen-jumper 应回 owner=P0 手牌而不是 P1 手牌',
        timeout: 20000,
      }).toBe(true);

      await expect(hostPage.locator('[data-card-uid="stolen-jumper"]')).toBeVisible({ timeout: 15000 });
      await screenshotViewport(hostPage, 'yuanhou-jumper-returned-to-owner-hand-host', testInfo);
      await screenshotLocator(hostPage.locator('[data-card-uid="stolen-jumper"]'), 'yuanhou-jumper-returned-card-in-owner-hand', testInfo);
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });

  test('时间旅行者-Time Box-真实多客户端下 Jumper 从弃牌堆回 owner 手牌后应由 owner 页面获得第5枚计数进场选择', async ({ page, game, browser }, testInfo) => {
    test.setTimeout(180000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '1',
      phase: 'playCards',
      extra: {
        core: {
          turnOrder: ['0', '1'],
          currentPlayerIndex: 1,
          turnNumber: 1,
          nextUid: 1000,
          players: {
            '0': {
              id: '0',
              vp: 0,
              hand: [{ uid: 'owner-extra-minion', defId: 'shapeshifters_mimic', type: 'minion', owner: '0' }],
              deck: [],
              discard: [],
              factions: ['time_travelers', 'shapeshifters'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [{ uid: 'p1-bacta-hand', defId: 'shapeshifters_bacta_the_future', type: 'action', owner: '1' }],
              deck: [],
              discard: [],
              factions: ['time_travelers', 'shapeshifters'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [{
            defId: 'base_portal_room',
            breakpoint: 20,
            minions: [{
              uid: 'stolen-jumper',
              defId: 'time_travelers_jumper',
              controller: '1',
              owner: '0',
              basePower: 2,
              powerCounters: 0,
              powerModifier: 0,
              tempPowerModifier: 0,
              talentUsed: false,
              playedThisTurn: false,
              attachedActions: [],
            }],
            ongoingActions: [],
          }],
          titans: [{
            uid: 'time-box-a',
            defId: 'time_travelers_time_box',
            faction: 'time_travelers',
            ownerId: '0',
            controllerId: '0',
            powerCounters: 0,
            talentUsed: false,
            metadata: { timeBoxCounters: 4 },
            location: { zone: 'setaside' },
          }],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    const preparedState = JSON.parse(JSON.stringify(await game.getState()));
    const setup = await setupSmashUpOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, {
      hostFactions: ['time_travelers', 'super_spies'],
      guestFactions: ['shapeshifters', 'cyborg_apes'],
      skipFactionSelection: true,
      testInfo,
    });
    if (!setup) {
      test.skip(true, 'SmashUp 联机房间创建失败');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

    try {
      const mergedState = JSON.parse(JSON.stringify(preparedState));
      mergedState.core = {
        ...mergedState.core,
        phase: preparedState?.sys?.phase ?? preparedState?.core?.phase ?? 'playCards',
        factionSelection: undefined,
        titans: JSON.parse(JSON.stringify(preparedState?.core?.titans ?? [])),
        triggerQueue: [],
      };
      mergedState.sys = {
        ...mergedState.sys,
        matchId,
        turnOrder: Array.isArray(preparedState?.core?.turnOrder)
          ? [...preparedState.core.turnOrder]
          : mergedState.sys?.turnOrder,
        currentPlayerIndex: typeof preparedState?.core?.currentPlayerIndex === 'number'
          ? preparedState.core.currentPlayerIndex
          : mergedState.sys?.currentPlayerIndex,
        phase: preparedState?.sys?.phase ?? mergedState.sys?.phase,
        interaction: {
          ...mergedState.sys?.interaction,
          current: undefined,
        },
        responseWindow: {
          ...mergedState.sys?.responseWindow,
          current: undefined,
        },
      };

      await injectMatchState(matchId, mergedState, hostPage);
      await hostPage.reload({ waitUntil: 'domcontentloaded' });
      await guestPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForSmashUpUI(hostPage);
      await waitForSmashUpUI(guestPage);

      await expect(guestPage.locator('[data-card-uid="p1-bacta-hand"]')).toBeVisible({ timeout: 15000 });
      await expect(guestPage.locator('[data-minion-uid="stolen-jumper"]')).toBeVisible({ timeout: 15000 });

      await guestPage.locator('[data-card-uid="p1-bacta-hand"]').click();
      await guestPage.waitForTimeout(250);
      await guestPage.locator('[data-minion-uid="stolen-jumper"]').click();

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const p0Discard = hostState?.core?.players?.['0']?.discard ?? [];
        const prompt = hostState?.sys?.interaction?.current;
        const promptCardUids = (prompt?.data?.options ?? [])
          .map((option: any) => option?.value?.cardUid)
          .filter((uid: unknown): uid is string => typeof uid === 'string');
        return prompt?.data?.sourceId === 'smashup_immediate_extra_minion'
          && prompt?.playerId === '0'
          && hasUid(p0Discard, 'stolen-jumper')
          && promptCardUids.includes('owner-extra-minion');
      }, {
        message: 'P1 用 Bacta 摧毁 stolen-jumper 后，应先在 owner=P0 页进入 Bacta 的 immediate extra minion prompt',
        timeout: 20000,
      }).toBe(true);

      await expect(hostPage.locator('[data-card-uid="owner-extra-minion"]')).toBeVisible({ timeout: 15000 });
      await expect(hostPage.getByRole('button', { name: '放弃这次额外随从' })).toBeVisible({ timeout: 15000 });
      await screenshotViewport(hostPage, 'yuanhou-time-box-jumper-owner-extra-prompt-host', testInfo);
      await hostPage.getByRole('button', { name: '放弃这次额外随从' }).click();

      let jumperTriggerOptionId = '';
      await expect.poll(async () => {
        const guestState = await readHarnessState(guestPage);
        const prompt = guestState?.sys?.interaction?.current;
        const triggerOption = (prompt?.data?.options ?? []).find((option: any) => option?.value?.kind === 'trigger');
        jumperTriggerOptionId = typeof triggerOption?.id === 'string' ? triggerOption.id : '';
        return prompt?.data?.sourceId === 'smashup_reaction_choose'
          && prompt?.playerId === '1'
          && jumperTriggerOptionId.length > 0;
      }, {
        message: 'owner=P0 跳过 Bacta extra prompt 后，应在 controller=P1 页进入 Jumper 的 optional reaction prompt',
        timeout: 20000,
      }).toBe(true);

      const guestJumperTriggerButton = guestPage.getByRole('button', { name: /跳跃者/ });
      await expect(guestJumperTriggerButton).toBeVisible({ timeout: 15000 });
      await screenshotViewport(guestPage, 'yuanhou-time-box-jumper-controller-reaction-prompt-guest', testInfo);
      await guestJumperTriggerButton.click();

      let timeBoxTriggerOptionId = '';
      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const prompt = hostState?.sys?.interaction?.current;
        const p0Hand = hostState?.core?.players?.['0']?.hand ?? [];
        const p0Discard = hostState?.core?.players?.['0']?.discard ?? [];
        const titan = (hostState?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'time-box-a');
        const triggerOption = (prompt?.data?.options ?? []).find((option: any) => {
          if (option?.value?.kind !== 'trigger') return false;
          const trigger = hostState?.core?.triggerQueue?.find((entry: any) => entry?.id === option?.value?.triggerId);
          return trigger?.sourceDefId === 'time_travelers_time_box';
        });
        timeBoxTriggerOptionId = typeof triggerOption?.id === 'string' ? triggerOption.id : '';
        return prompt?.data?.sourceId === 'smashup_reaction_choose'
          && prompt?.playerId === '0'
          && timeBoxTriggerOptionId.length > 0
          && hasUid(p0Hand, 'stolen-jumper')
          && !hasUid(p0Discard, 'stolen-jumper')
          && titan?.location?.zone === 'setaside'
          && titan?.metadata?.timeBoxCounters === 4;
      }, {
        message: 'controller=P1 让 Jumper 回 owner 手牌后，应在 owner=P0 页进入 Time Box 的 reaction 选择窗口',
        timeout: 20000,
      }).toBe(true);

      const hostTimeBoxTriggerButton = hostPage.getByRole('button', { name: '时间盒子', exact: true }).last();
      await expect(hostTimeBoxTriggerButton).toBeVisible({ timeout: 15000 });
      await expect.poll(async () => {
        const guestState = await readHarnessState(guestPage);
        return guestState?.sys?.interaction?.current == null;
      }, {
        message: 'Time Box 的反应选择权不应跑到 controller=P1 的 guest 页面',
        timeout: 15000,
      }).toBe(true);
      await screenshotViewport(hostPage, 'yuanhou-time-box-trigger-after-jumper-recover-host', testInfo);
      await hostTimeBoxTriggerButton.click();

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const prompt = hostState?.sys?.interaction?.current;
        const titan = (hostState?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'time-box-a');
        const p0Hand = hostState?.core?.players?.['0']?.hand ?? [];
        return prompt?.data?.sourceId === 'titan_time_travelers_time_box_play'
          && prompt?.playerId === '0'
          && titan?.location?.zone === 'setaside'
          && titan?.metadata?.timeBoxCounters === 5
          && hasUid(p0Hand, 'stolen-jumper');
      }, {
        message: 'owner=P0 选择 Time Box trigger 后，应把第 5 枚计数加到 setaside Titan，并起 owner 页的真实进场 prompt',
        timeout: 20000,
      }).toBe(true);

      await expect(hostPage.getByText('时间盒子：是否移除全部计数器并打出到一个基地？')).toBeVisible({ timeout: 15000 });
      await expect(guestPage.getByText('时间盒子：是否移除全部计数器并打出到一个基地？')).toHaveCount(0);
      await screenshotViewport(hostPage, 'yuanhou-time-box-play-prompt-after-jumper-recover-host', testInfo);
      await hostPage.getByRole('button', { name: '跳过', exact: true }).click();

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const guestState = await readHarnessState(guestPage);
        const titan = (hostState?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'time-box-a');
        const p0Hand = hostState?.core?.players?.['0']?.hand ?? [];
        return hostState?.sys?.interaction?.current == null
          && guestState?.sys?.interaction?.current == null
          && titan?.location?.zone === 'setaside'
          && titan?.metadata?.timeBoxCounters === 5
          && hasUid(p0Hand, 'stolen-jumper');
      }, {
        message: 'owner=P0 跳过 Time Box 进场后，应完成收口并保留第 5 枚计数，同时 Jumper 继续留在 owner 手牌',
        timeout: 20000,
      }).toBe(true);

      await expect(hostPage.locator('[data-card-uid="stolen-jumper"]')).toBeVisible({ timeout: 15000 });
      await screenshotViewport(hostPage, 'yuanhou-time-box-after-jumper-recover-resolved-host', testInfo);
      await screenshotLocator(hostPage.locator('[data-card-uid="stolen-jumper"]'), 'yuanhou-time-box-jumper-card-in-owner-hand', testInfo);
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });

  test('时间旅行者-Time Box-真实多客户端下回合开始应只给 owner 页面第5枚计数反应与进场选择', async ({ page, game, browser }, testInfo) => {
    test.setTimeout(180000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '1',
      phase: 'playCards',
      extra: {
        core: {
          turnOrder: ['0', '1'],
          currentPlayerIndex: 1,
          turnNumber: 2,
          nextUid: 1000,
          players: {
            '0': {
              id: '0',
              vp: 0,
              hand: [],
              deck: [],
              discard: [],
              factions: ['time_travelers', 'super_spies'],
              minionsPlayed: 0,
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
              factions: ['shapeshifters', 'cyborg_apes'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_portal_room',
              breakpoint: 20,
              minions: [{
                uid: 'moon-zero-host',
                defId: 'super_spies_operative',
                controller: '0',
                owner: '0',
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
            {
              defId: 'base_the_nexus',
              breakpoint: 20,
              minions: [],
              ongoingActions: [],
            },
          ],
          titans: [
            {
              uid: 'time-box-turn-start-mp-setaside',
              defId: 'time_travelers_time_box',
              faction: 'time_travelers',
              ownerId: '0',
              controllerId: '0',
              powerCounters: 0,
              talentUsed: false,
              metadata: { timeBoxCounters: 4 },
              location: { zone: 'setaside' },
            },
            {
              uid: 'moon-zero-three-turn-start-live',
              defId: 'super_spies_moon_zero_three',
              faction: 'super_spies',
              ownerId: '0',
              controllerId: '0',
              powerCounters: 0,
              talentUsed: false,
              location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            },
          ],
          baseDeck: [],
          baseDiscard: [],
        },
      },
    });

    const preparedState = JSON.parse(JSON.stringify(await game.getState()));
    const setup = await setupSmashUpOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, {
      hostFactions: ['time_travelers', 'super_spies'],
      guestFactions: ['shapeshifters', 'cyborg_apes'],
      skipFactionSelection: true,
      testInfo,
    });
    if (!setup) {
      test.skip(true, 'SmashUp 联机房间创建失败');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

    try {
      const mergedState = JSON.parse(JSON.stringify(preparedState));
      mergedState.core = {
        ...mergedState.core,
        phase: preparedState?.sys?.phase ?? preparedState?.core?.phase ?? 'playCards',
        factionSelection: undefined,
        titans: JSON.parse(JSON.stringify(preparedState?.core?.titans ?? [])),
        triggerQueue: [],
      };
      mergedState.sys = {
        ...mergedState.sys,
        matchId,
        turnOrder: Array.isArray(preparedState?.core?.turnOrder)
          ? [...preparedState.core.turnOrder]
          : mergedState.sys?.turnOrder,
        currentPlayerIndex: typeof preparedState?.core?.currentPlayerIndex === 'number'
          ? preparedState.core.currentPlayerIndex
          : mergedState.sys?.currentPlayerIndex,
        phase: preparedState?.sys?.phase ?? mergedState.sys?.phase,
        interaction: {
          ...mergedState.sys?.interaction,
          current: undefined,
        },
        responseWindow: {
          ...mergedState.sys?.responseWindow,
          current: undefined,
        },
      };

      await injectMatchState(matchId, mergedState, hostPage);
      await hostPage.reload({ waitUntil: 'domcontentloaded' });
      await guestPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForSmashUpUI(hostPage);
      await waitForSmashUpUI(guestPage);

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const titan = (hostState?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'time-box-turn-start-mp-setaside');
        const moonZero = (hostState?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'moon-zero-three-turn-start-live');
        return hostState?.core?.currentPlayerIndex === 1
          && hostState?.sys?.phase === 'playCards'
          && titan?.location?.zone === 'setaside'
          && titan?.metadata?.timeBoxCounters === 4
          && moonZero?.location?.zone === 'base'
          && moonZero?.location?.baseIndex === 0;
      }, {
        message: '场景注入后，应处于 P1 出牌阶段，且 P0 的 Time Box 仍在 setaside 计数 4，同时 Moon Zero Three 已在场',
        timeout: 15000,
      }).toBe(true);

      const guestEndTurnButton = guestPage.getByTestId('su-end-turn-action-button');
      await expect(guestEndTurnButton).toBeVisible({ timeout: 15000 });
      await guestEndTurnButton.click();

      let timeBoxTriggerOptionId = '';
      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const prompt = hostState?.sys?.interaction?.current;
        const triggerOption = (prompt?.data?.options ?? []).find((option: any) => {
          if (option?.value?.kind !== 'trigger') return false;
          const trigger = hostState?.core?.triggerQueue?.find((entry: any) => entry?.id === option?.value?.triggerId);
          return trigger?.sourceDefId === 'time_travelers_time_box';
        });
        timeBoxTriggerOptionId = typeof triggerOption?.id === 'string' ? triggerOption.id : '';
        return hostState?.core?.currentPlayerIndex === 0
          && prompt?.data?.sourceId === 'smashup_reaction_choose'
          && prompt?.playerId === '0'
          && timeBoxTriggerOptionId.length > 0;
      }, {
        message: 'P1 结束回合后，P0 的 startTurn 应只在 host 页进入 Time Box 的 reaction 选择窗口',
        timeout: 20000,
      }).toBe(true);

      await expect.poll(async () => {
        const guestState = await readHarnessState(guestPage);
        return guestState?.sys?.interaction?.current == null;
      }, {
        message: 'Time Box 的 startTurn reaction 选择权不应跑到 guest 页面',
        timeout: 15000,
      }).toBe(true);

      const hostTimeBoxReactionCard = hostPage.getByTestId('su-rail-titan-time-box-turn-start-mp-setaside');
      const hostTimeBoxReactionBadge = hostPage.getByTestId('su-rail-titan-badge-time-box-turn-start-mp-setaside');
      await expect(hostTimeBoxReactionCard).toBeVisible({ timeout: 15000 });
      await expect(hostTimeBoxReactionBadge).toContainText('可触发');
      await expect(hostPage.getByTestId('su-deck-stack')).toHaveCount(0);
      await expect(hostPage.getByTestId('su-discard-toggle')).toHaveCount(0);
      await expect(hostPage.getByTestId('su-end-turn-action-button')).toHaveCount(0);
      await expect(hostPage.getByText('轮到你了！')).toHaveCount(0, { timeout: 5000 });
      await expect(guestPage.getByTestId('su-rail-titan-badge-time-box-turn-start-mp-setaside')).toHaveCount(0);
      await screenshotViewport(hostPage, 'yuanhou-time-box-turn-start-multiplayer-reaction-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-time-box-turn-start-multiplayer-no-reaction-guest', testInfo);

      await respondToCurrentInteractionOption(hostPage, timeBoxTriggerOptionId);

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const guestState = await readHarnessState(guestPage);
        const prompt = hostState?.sys?.interaction?.current;
        const titan = (hostState?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'time-box-turn-start-mp-setaside');
        return prompt?.data?.sourceId === 'titan_time_travelers_time_box_play'
          && prompt?.playerId === '0'
          && titan?.location?.zone === 'setaside'
          && titan?.metadata?.timeBoxCounters === 5
          && guestState?.sys?.interaction?.current == null;
      }, {
        message: 'owner=P0 选择 Time Box reaction 后，应只在 host 页起第 5 枚计数进场 prompt，guest 页不能拿到该 prompt',
        timeout: 20000,
      }).toBe(true);

      await expect(hostPage.getByText('时间盒子：是否移除全部计数器并打出到一个基地？')).toBeVisible({ timeout: 15000 });
      await expect(guestPage.getByText('时间盒子：是否移除全部计数器并打出到一个基地？')).toHaveCount(0);
      await screenshotViewport(hostPage, 'yuanhou-time-box-turn-start-multiplayer-play-prompt-host', testInfo);

      await hostPage.getByRole('button', { name: '跳过', exact: true }).click();

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const guestState = await readHarnessState(guestPage);
        const titan = (hostState?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'time-box-turn-start-mp-setaside');
        const moonZero = (hostState?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'moon-zero-three-turn-start-live');
        return hostState?.core?.currentPlayerIndex === 0
          && hostState?.sys?.phase === 'playCards'
          && hostState?.sys?.interaction?.current == null
          && guestState?.sys?.interaction?.current == null
          && titan?.location?.zone === 'setaside'
          && titan?.metadata?.timeBoxCounters === 5
          && titan?.metadata?.timeBoxPlayArmed === false
          && moonZero?.location?.zone === 'base';
      }, {
        message: 'owner=P0 跳过 Time Box 进场后，应在 host/guest 两页都完成收口，并保留第 5 枚计数',
        timeout: 20000,
      }).toBe(true);

      await screenshotViewport(hostPage, 'yuanhou-time-box-turn-start-multiplayer-resolved-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-time-box-turn-start-multiplayer-resolved-guest', testInfo);
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });

  test('时间旅行者-Time Box-恢复可见触发 manual-resync 后 owner-only reaction 与进场 prompt 仍只归 owner 页面', async ({ page, game, browser }, testInfo) => {
    test.setTimeout(180000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '1',
      phase: 'playCards',
      extra: {
        core: {
          turnOrder: ['0', '1'],
          currentPlayerIndex: 1,
          turnNumber: 2,
          nextUid: 1000,
          players: {
            '0': {
              id: '0',
              vp: 0,
              hand: [],
              deck: [],
              discard: [],
              factions: ['time_travelers', 'super_spies'],
              minionsPlayed: 0,
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
              factions: ['shapeshifters', 'cyborg_apes'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_portal_room',
              breakpoint: 20,
              minions: [{
                uid: 'moon-zero-manual-resync-host',
                defId: 'super_spies_operative',
                controller: '0',
                owner: '0',
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
            {
              defId: 'base_the_nexus',
              breakpoint: 20,
              minions: [],
              ongoingActions: [],
            },
          ],
          titans: [
            {
              uid: 'time-box-manual-resync-setaside',
              defId: 'time_travelers_time_box',
              faction: 'time_travelers',
              ownerId: '0',
              controllerId: '0',
              powerCounters: 0,
              talentUsed: false,
              metadata: { timeBoxCounters: 4 },
              location: { zone: 'setaside' },
            },
            {
              uid: 'moon-zero-manual-resync-live',
              defId: 'super_spies_moon_zero_three',
              faction: 'super_spies',
              ownerId: '0',
              controllerId: '0',
              powerCounters: 0,
              talentUsed: false,
              location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            },
          ],
          baseDeck: [],
          baseDiscard: [],
        },
      },
    });

    const preparedState = JSON.parse(JSON.stringify(await game.getState()));
    const setup = await setupSmashUpOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, {
      hostFactions: ['time_travelers', 'super_spies'],
      guestFactions: ['shapeshifters', 'cyborg_apes'],
      skipFactionSelection: true,
      testInfo,
    });
    if (!setup) {
      test.skip(true, 'SmashUp 联机房间创建失败');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

    try {
      const mergedState = JSON.parse(JSON.stringify(preparedState));
      mergedState.core = {
        ...mergedState.core,
        phase: preparedState?.sys?.phase ?? preparedState?.core?.phase ?? 'playCards',
        factionSelection: undefined,
        titans: JSON.parse(JSON.stringify(preparedState?.core?.titans ?? [])),
        triggerQueue: [],
      };
      mergedState.sys = {
        ...mergedState.sys,
        matchId,
        turnOrder: Array.isArray(preparedState?.core?.turnOrder)
          ? [...preparedState.core.turnOrder]
          : mergedState.sys?.turnOrder,
        currentPlayerIndex: typeof preparedState?.core?.currentPlayerIndex === 'number'
          ? preparedState.core.currentPlayerIndex
          : mergedState.sys?.currentPlayerIndex,
        phase: preparedState?.sys?.phase ?? mergedState.sys?.phase,
        interaction: {
          ...mergedState.sys?.interaction,
          current: undefined,
        },
        responseWindow: {
          ...mergedState.sys?.responseWindow,
          current: undefined,
        },
      };

      await injectMatchState(matchId, mergedState, hostPage);
      await hostPage.reload({ waitUntil: 'domcontentloaded' });
      await guestPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForSmashUpUI(hostPage);
      await waitForSmashUpUI(guestPage);
      await installManualResyncTracker(hostPage);

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const titan = (hostState?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'time-box-manual-resync-setaside');
        const moonZero = (hostState?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'moon-zero-manual-resync-live');
        return hostState?.core?.currentPlayerIndex === 1
          && hostState?.sys?.phase === 'playCards'
          && titan?.location?.zone === 'setaside'
          && titan?.metadata?.timeBoxCounters === 4
          && moonZero?.location?.zone === 'base'
          && moonZero?.location?.baseIndex === 0;
      }, {
        message: '场景注入后，应处于 P1 出牌阶段，且 Time Box 仍在 setaside 计数 4，同时 Moon Zero Three 已在场',
        timeout: 15000,
      }).toBe(true);

      const guestEndTurnButton = guestPage.getByTestId('su-end-turn-action-button');
      await expect(guestEndTurnButton).toBeVisible({ timeout: 15000 });
      await guestEndTurnButton.click();

      let timeBoxTriggerOptionId = '';
      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const prompt = hostState?.sys?.interaction?.current;
        const triggerOption = (prompt?.data?.options ?? []).find((option: any) => {
          if (option?.value?.kind !== 'trigger') return false;
          const trigger = hostState?.core?.triggerQueue?.find((entry: any) => entry?.id === option?.value?.triggerId);
          return trigger?.sourceDefId === 'time_travelers_time_box';
        });
        timeBoxTriggerOptionId = typeof triggerOption?.id === 'string' ? triggerOption.id : '';
        return hostState?.core?.currentPlayerIndex === 0
          && prompt?.data?.sourceId === 'smashup_reaction_choose'
          && prompt?.playerId === '0'
          && timeBoxTriggerOptionId.length > 0;
      }, {
        message: 'P1 结束回合后，P0 的 startTurn 应先只在 host 页进入 Time Box reaction 选择窗口',
        timeout: 20000,
      }).toBe(true);

      await triggerShellVisibilityResync(hostPage);

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const guestState = await readHarnessState(guestPage);
        const prompt = hostState?.sys?.interaction?.current;
        return await getManualResyncCount(hostPage) >= 1
          && prompt?.data?.sourceId === 'smashup_reaction_choose'
          && prompt?.playerId === '0'
          && guestState?.sys?.interaction?.current == null;
      }, {
        message: 'manual-resync 后，Time Box 的 owner-only reaction 选择窗口仍应只留在 host 页',
        timeout: 20000,
      }).toBe(true);

      const hostTimeBoxReactionCard = hostPage.getByTestId('su-rail-titan-time-box-manual-resync-setaside');
      const hostTimeBoxReactionBadge = hostPage.getByTestId('su-rail-titan-badge-time-box-manual-resync-setaside');
      await expect(hostTimeBoxReactionCard).toBeVisible({ timeout: 15000 });
      await expect(hostTimeBoxReactionBadge).toContainText('可触发');
      await expect(hostPage.getByTestId('su-deck-stack')).toHaveCount(0);
      await expect(hostPage.getByTestId('su-discard-toggle')).toHaveCount(0);
      await expect(hostPage.getByTestId('su-end-turn-action-button')).toHaveCount(0);
      await expect(hostPage.getByText('轮到你了！')).toHaveCount(0, { timeout: 5000 });
      await expect(guestPage.getByTestId('su-rail-titan-badge-time-box-manual-resync-setaside')).toHaveCount(0);
      await expect(hostPage.getByTestId('card-spotlight-queue')).toBeHidden({ timeout: 15000 });
      await expect(guestPage.getByTestId('card-spotlight-queue')).toBeHidden({ timeout: 15000 });
      await expect(hostPage.getByTestId('reveal-overlay')).toHaveCount(0);
      await expect(guestPage.getByTestId('reveal-overlay')).toHaveCount(0);
      await expect(hostPage.getByTestId('me-first-overlay')).toBeHidden();
      await expect(guestPage.getByTestId('me-first-overlay')).toBeHidden();
      await screenshotViewport(hostPage, 'yuanhou-time-box-manual-resync-reaction-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-time-box-manual-resync-no-reaction-guest', testInfo);

      await respondToCurrentInteractionOption(hostPage, timeBoxTriggerOptionId);

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const guestState = await readHarnessState(guestPage);
        const prompt = hostState?.sys?.interaction?.current;
        const titan = (hostState?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'time-box-manual-resync-setaside');
        return prompt?.data?.sourceId === 'titan_time_travelers_time_box_play'
          && prompt?.playerId === '0'
          && titan?.location?.zone === 'setaside'
          && titan?.metadata?.timeBoxCounters === 5
          && guestState?.sys?.interaction?.current == null;
      }, {
        message: '触发 Time Box reaction 后，应只在 host 页起第 5 枚计数进场 prompt',
        timeout: 20000,
      }).toBe(true);

      await triggerShellVisibilityResync(hostPage);

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const guestState = await readHarnessState(guestPage);
        const prompt = hostState?.sys?.interaction?.current;
        return await getManualResyncCount(hostPage) >= 2
          && prompt?.data?.sourceId === 'titan_time_travelers_time_box_play'
          && prompt?.playerId === '0'
          && guestState?.sys?.interaction?.current == null;
      }, {
        message: 'manual-resync 后，Time Box 的 owner-only 进场 prompt 仍应只留在 host 页',
        timeout: 20000,
      }).toBe(true);

      await expect(hostPage.getByText('时间盒子：是否移除全部计数器并打出到一个基地？')).toBeVisible({ timeout: 15000 });
      await expect(guestPage.getByText('时间盒子：是否移除全部计数器并打出到一个基地？')).toHaveCount(0);
      await expect(hostPage.getByTestId('card-spotlight-queue')).toBeHidden({ timeout: 15000 });
      await expect(guestPage.getByTestId('card-spotlight-queue')).toBeHidden({ timeout: 15000 });
      await expect(hostPage.getByTestId('reveal-overlay')).toHaveCount(0);
      await expect(guestPage.getByTestId('reveal-overlay')).toHaveCount(0);
      await expect(hostPage.getByTestId('me-first-overlay')).toBeHidden();
      await expect(guestPage.getByTestId('me-first-overlay')).toBeHidden();
      await screenshotViewport(hostPage, 'yuanhou-time-box-manual-resync-play-prompt-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-time-box-manual-resync-no-play-prompt-guest', testInfo);

      await hostPage.getByRole('button', { name: '跳过', exact: true }).click();

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const guestState = await readHarnessState(guestPage);
        const titan = (hostState?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'time-box-manual-resync-setaside');
        const moonZero = (hostState?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'moon-zero-manual-resync-live');
        return hostState?.core?.currentPlayerIndex === 0
          && hostState?.sys?.phase === 'playCards'
          && hostState?.sys?.interaction?.current == null
          && guestState?.sys?.interaction?.current == null
          && titan?.location?.zone === 'setaside'
          && titan?.metadata?.timeBoxCounters === 5
          && titan?.metadata?.timeBoxPlayArmed === false
          && moonZero?.location?.zone === 'base';
      }, {
        message: 'manual-resync 后再跳过 Time Box 进场，两页都应正常收口并保留第 5 枚计数',
        timeout: 20000,
      }).toBe(true);

      await screenshotViewport(hostPage, 'yuanhou-time-box-manual-resync-resolved-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-time-box-manual-resync-resolved-guest', testInfo);
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });

  test('时间旅行者-Portal Room-真实多客户端下赢家不是当前回合玩家时应只给赢家页面额外回合选择权', async ({ page, game, browser }, testInfo) => {
    test.setTimeout(180000);
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
              hand: [],
              deck: [],
              discard: [],
              factions: ['time_travelers'],
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
              factions: ['time_travelers'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_portal_room',
              breakpoint: 20,
              minions: [{
                uid: 'portal-p1-winner',
                defId: 'time_travelers_time_raider',
                controller: '1',
                owner: '1',
                basePower: 23,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [],
              }],
              ongoingActions: [],
            },
            {
              defId: 'base_the_nexus',
              breakpoint: 19,
              minions: [],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    const preparedState = JSON.parse(JSON.stringify(await game.getState()));
    const setup = await setupSmashUpOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, {
      hostFactions: ['time_travelers', 'super_spies'],
      guestFactions: ['shapeshifters', 'cyborg_apes'],
      skipFactionSelection: true,
      testInfo,
    });
    if (!setup) {
      test.skip(true, 'SmashUp 联机房间创建失败');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

    try {
      const mergedState = JSON.parse(JSON.stringify(preparedState));
      mergedState.core = {
        ...mergedState.core,
        phase: preparedState?.sys?.phase ?? preparedState?.core?.phase ?? 'playCards',
        factionSelection: undefined,
        titans: [],
        triggerQueue: [],
        pendingExtraTurns: undefined,
        activeExtraTurn: undefined,
      };
      mergedState.sys = {
        ...mergedState.sys,
        matchId,
        turnOrder: Array.isArray(preparedState?.core?.turnOrder)
          ? [...preparedState.core.turnOrder]
          : mergedState.sys?.turnOrder,
        currentPlayerIndex: typeof preparedState?.core?.currentPlayerIndex === 'number'
          ? preparedState.core.currentPlayerIndex
          : mergedState.sys?.currentPlayerIndex,
        phase: preparedState?.sys?.phase ?? mergedState.sys?.phase,
        interaction: {
          ...mergedState.sys?.interaction,
          current: undefined,
        },
        responseWindow: {
          ...mergedState.sys?.responseWindow,
          current: undefined,
        },
      };

      await injectMatchState(matchId, mergedState, hostPage);
      await hostPage.reload({ waitUntil: 'domcontentloaded' });
      await guestPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForSmashUpUI(hostPage);
      await waitForSmashUpUI(guestPage);

      const endTurnButton = hostPage.getByTestId('su-end-turn-action-button');
      await expect(endTurnButton).toBeVisible({ timeout: 15000 });
      await endTurnButton.click();

      let triggerOptionId = '';
      await expect.poll(async () => {
        const guestState = await readHarnessState(guestPage);
        const prompt = guestState?.sys?.interaction?.current;
        const triggerOption = (prompt?.data?.options ?? []).find((option: any) => option?.id !== 'pass');
        triggerOptionId = typeof triggerOption?.id === 'string' ? triggerOption.id : '';
        return prompt?.data?.sourceId === 'smashup_reaction_choose'
          && prompt?.playerId === '1'
          && guestState?.sys?.phase === 'scoreBases'
          && guestState?.core?.currentPlayerIndex === 0
          && guestState?.core?.bases?.[0]?.defId === 'base_portal_room'
          && triggerOptionId.length > 0;
      }, {
        message: 'P0 结束当前回合并触发 Portal Room 计分后，赢家=P1 页面应进入额外回合响应窗口',
        timeout: 20000,
      }).toBe(true);

      const guestPortalButton = guestPage.getByRole('button', { name: /传送门/ });
      const hostPortalButton = hostPage.getByRole('button', { name: /传送门/ });
      const hostPortalBase = hostPage.getByTestId('base-zone-0');
      await expect(hostPage.getByTestId('me-first-overlay')).toBeVisible({ timeout: 15000 });
      await expect(hostPage.getByTestId('me-first-waiting-shell')).toBeVisible({ timeout: 15000 });
      await expect(hostPage.getByTestId('me-first-status')).toContainText('等待');
      await expect(hostPage.getByText('计分后响应')).toHaveCount(0);
      await expect(hostPage.getByTestId('me-first-pass-button')).toHaveCount(0);
      await expect(hostPage.getByTestId('me-first-progress')).toHaveCount(0);
      await expect(hostPage.getByTestId('fab-menu')).toHaveCount(0);
      await expect(hostPage.locator('[data-tutorial-id="su-turn-tracker"]')).toHaveCount(0);
      await expect(hostPage.getByTestId('su-end-turn-action-button')).toHaveCount(0);
      await expect(hostPage.getByTestId('su-end-turn-hints')).toHaveCount(0);
      await expect(hostPage.getByTestId('su-end-turn-visibility-toggle')).toHaveCount(0);
      await expect(hostPage.locator('[data-tutorial-id="su-scoreboard"]')).toHaveCount(0);
      await expect(hostPage.getByTestId('su-deck-stack')).toHaveCount(0);
      await expect(hostPage.getByTestId('su-discard-toggle')).toHaveCount(0);
      await expect(hostPage.getByTestId('debug-toggle-container')).toHaveCount(0);
      await expect(hostPage.getByTestId('debug-panel')).toHaveCount(0);
      await expect(guestPortalButton).toBeVisible({ timeout: 15000 });
      await expect(hostPortalButton).toHaveCount(0);
      await expect(hostPortalBase).toBeVisible({ timeout: 15000 });
      await expect(guestPage.getByTestId('card-spotlight-queue')).toBeHidden({ timeout: 15000 });
      await expect(hostPage.getByTestId('card-spotlight-queue')).toBeHidden({ timeout: 15000 });
      await expect(guestPage.getByTestId('reveal-overlay')).toHaveCount(0);
      await expect(hostPage.getByTestId('reveal-overlay')).toHaveCount(0);
      await expect(guestPage.getByTestId('me-first-overlay')).toBeHidden();
      await screenshotViewport(guestPage, 'yuanhou-portal-room-winner-prompt-guest', testInfo);
      await screenshotViewport(hostPage, 'yuanhou-portal-room-current-player-no-choice-host', testInfo);
      await screenshotLocator(guestPortalButton, 'yuanhou-portal-room-trigger-base-guest', testInfo);

      await hostPortalBase.click();

      await expect.poll(async () => {
        const guestState = await readHarnessState(guestPage);
        const prompt = guestState?.sys?.interaction?.current;
        return prompt?.data?.sourceId === 'smashup_reaction_choose'
          && prompt?.playerId === '1'
          && guestState?.core?.currentPlayerIndex === 0
          && guestState?.core?.pendingExtraTurns == null;
      }, {
        message: '当前回合玩家 P0 点击同一基地后，不应消耗掉属于赢家 P1 的 Portal Room 选择权',
        timeout: 10000,
      }).toBe(true);

      await guestPortalButton.click({ force: true });

      await expect.poll(async () => {
        const guestState = await readHarnessState(guestPage);
        return guestState?.sys?.phase === 'playCards'
          && guestState?.core?.currentPlayerIndex === 1
          && guestState?.core?.activeExtraTurn?.playerId === '1'
          && guestState?.core?.activeExtraTurn?.returnToPlayerIndex === 1
          && guestState?.core?.activeExtraTurn?.reason === 'base_portal_room'
          && guestState?.core?.pendingExtraTurns == null
          && guestState?.core?.bases?.[0]?.defId === 'base_faceless_city';
      }, {
        message: 'P1 接受 Portal Room 后，应启动赢家 P1 的额外回合并替换已计分基地',
        timeout: 20000,
      }).toBe(true);

      await screenshotViewport(guestPage, 'yuanhou-portal-room-extra-turn-started-for-winner-guest', testInfo);
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });

  test('时间旅行者-Portal Room-真实三人局下赢家额外回合结束后应回到原本下一位玩家', async ({ page, game, browser }, testInfo) => {
    test.setTimeout(180000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '1',
      phase: 'playCards',
      extra: {
        core: {
          turnOrder: ['0', '1', '2'],
          currentPlayerIndex: 1,
          turnNumber: 1,
          nextUid: 1000,
          players: {
            '0': {
              id: '0',
              vp: 0,
              hand: [],
              deck: [],
              discard: [],
              factions: ['time_travelers'],
              minionsPlayed: 0,
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
              factions: ['super_spies'],
              minionsPlayed: 1,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '2': {
              id: '2',
              vp: 0,
              hand: [],
              deck: [],
              discard: [],
              factions: ['shapeshifters'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_portal_room',
              breakpoint: 20,
              minions: [{
                uid: 'portal-3p-winner',
                defId: 'time_travelers_time_raider',
                controller: '0',
                owner: '0',
                basePower: 23,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [],
              }],
              ongoingActions: [],
            },
            {
              defId: 'base_the_nexus',
              breakpoint: 19,
              minions: [],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    const preparedState = JSON.parse(JSON.stringify(await game.getState()));
    const setup = await setupSmashUpOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, {
      hostFactions: ['time_travelers', 'super_spies'],
      guestFactions: ['shapeshifters', 'cyborg_apes'],
      skipFactionSelection: true,
      testInfo,
    });
    if (!setup) {
      test.skip(true, 'SmashUp 联机房间创建失败');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

    try {
      const mergedState = JSON.parse(JSON.stringify(preparedState));
      mergedState.core = {
        ...mergedState.core,
        phase: preparedState?.sys?.phase ?? preparedState?.core?.phase ?? 'playCards',
        factionSelection: undefined,
        titans: [],
        triggerQueue: [],
        pendingExtraTurns: undefined,
        activeExtraTurn: undefined,
      };
      mergedState.sys = {
        ...mergedState.sys,
        matchId,
        turnOrder: Array.isArray(preparedState?.core?.turnOrder)
          ? [...preparedState.core.turnOrder]
          : mergedState.sys?.turnOrder,
        currentPlayerIndex: typeof preparedState?.core?.currentPlayerIndex === 'number'
          ? preparedState.core.currentPlayerIndex
          : mergedState.sys?.currentPlayerIndex,
        phase: preparedState?.sys?.phase ?? mergedState.sys?.phase,
        interaction: {
          ...mergedState.sys?.interaction,
          current: undefined,
        },
        responseWindow: {
          ...mergedState.sys?.responseWindow,
          current: undefined,
        },
      };

      await injectMatchState(matchId, mergedState, hostPage);
      await hostPage.reload({ waitUntil: 'domcontentloaded' });
      await guestPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForSmashUpUI(hostPage);
      await waitForSmashUpUI(guestPage);

      const guestEndTurnButton = guestPage.getByTestId('su-end-turn-action-button');
      await expect(guestEndTurnButton).toBeVisible({ timeout: 15000 });
      await guestEndTurnButton.click();

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const prompt = hostState?.sys?.interaction?.current;
        return prompt?.data?.sourceId === 'smashup_reaction_choose'
          && prompt?.playerId === '0'
          && hostState?.sys?.phase === 'scoreBases'
          && hostState?.core?.currentPlayerIndex === 1
          && hostState?.core?.bases?.[0]?.defId === 'base_portal_room';
      }, {
        message: '三人局 P1 结束回合并触发 Portal Room 计分后，赢家=P0 页面应进入额外回合响应窗口',
        timeout: 20000,
      }).toBe(true);

      const hostPortalButton = hostPage.getByRole('button', { name: /传送门/ });
      const guestPortalButton = guestPage.getByRole('button', { name: /传送门/ });
      await expect(hostPortalButton).toBeVisible({ timeout: 15000 });
      await expect(guestPortalButton).toHaveCount(0);
      await screenshotViewport(hostPage, 'yuanhou-portal-room-3p-winner-prompt-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-portal-room-3p-current-player-no-choice-guest', testInfo);

      await hostPortalButton.click({ force: true });

      await expect.poll(async () => {
        const serverState = await getMatchState(matchId, hostPage);
        return serverState?.sys?.phase === 'playCards'
          && serverState?.core?.currentPlayerIndex === 0
          && serverState?.core?.activeExtraTurn?.playerId === '0'
          && serverState?.core?.activeExtraTurn?.returnToPlayerIndex === 2
          && serverState?.core?.activeExtraTurn?.reason === 'base_portal_room'
          && serverState?.core?.pendingExtraTurns == null
          && serverState?.core?.bases?.[0]?.defId === 'base_faceless_city';
      }, {
        message: 'P0 接受三人局 Portal Room 后，应启动赢家额外回合，并把 returnToPlayerIndex 锁到原本下一位 P2',
        timeout: 20000,
      }).toBe(true);

      const hostExtraTurnEndButton = hostPage.getByTestId('su-end-turn-action-button');
      await expect(hostExtraTurnEndButton).toBeVisible({ timeout: 15000 });
      await screenshotViewport(hostPage, 'yuanhou-portal-room-3p-extra-turn-started-host', testInfo);
      await hostExtraTurnEndButton.click();

      await expect.poll(async () => {
        const serverState = await getMatchState(matchId, hostPage);
        return {
          currentPlayerIndex: serverState?.core?.currentPlayerIndex ?? null,
          phase: serverState?.sys?.phase ?? null,
          activeExtraTurn: serverState?.core?.activeExtraTurn ?? null,
          pendingExtraTurns: serverState?.core?.pendingExtraTurns ?? null,
          base0: serverState?.core?.bases?.[0]?.defId ?? null,
        };
      }, {
        message: 'P0 的额外回合结束后，服务端应恢复到原顺位下一位 P2，并清空额外回合状态',
        timeout: 20000,
      }).toEqual({
        currentPlayerIndex: 2,
        phase: 'startTurn',
        activeExtraTurn: null,
        pendingExtraTurns: null,
        base0: 'base_faceless_city',
      });

      await screenshotViewport(hostPage, 'yuanhou-portal-room-3p-extra-turn-finished-host', testInfo);
      await screenshotViewport(guestPage, 'yuanhou-portal-room-3p-extra-turn-finished-guest', testInfo);
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });

  test('时间旅行者-Time Is Fleeting-真实多客户端下赢家不是当前回合玩家时应只给赢家页面弃牌堆基地选择权', async ({ page, game, browser }, testInfo) => {
    test.setTimeout(180000);
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
              hand: [],
              deck: [],
              discard: [],
              factions: ['time_travelers'],
              minionsPlayed: 1,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [
                { uid: 'time-fleeting-guest', defId: 'time_travelers_time_is_fleeting', type: 'action', owner: '1' },
              ],
              deck: [],
              discard: [],
              factions: ['time_travelers'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_monkey_lab',
              breakpoint: 20,
              minions: [{
                uid: 'time-fleeting-guest-winner',
                defId: 'time_travelers_time_raider',
                controller: '1',
                owner: '1',
                basePower: 24,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [],
              }],
              ongoingActions: [],
            },
            {
              defId: 'base_portal_room',
              breakpoint: 20,
              minions: [],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_primate_park'],
          baseDiscard: ['base_the_vats', 'base_faceless_city', 'base_the_nexus'],
        },
      },
    });

    const preparedState = JSON.parse(JSON.stringify(await game.getState()));
    const setup = await setupSmashUpOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, {
      hostFactions: ['time_travelers', 'super_spies'],
      guestFactions: ['shapeshifters', 'cyborg_apes'],
      skipFactionSelection: true,
      testInfo,
    });
    if (!setup) {
      test.skip(true, 'SmashUp 联机房间创建失败');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

    try {
      const mergedState = JSON.parse(JSON.stringify(preparedState));
      mergedState.core = {
        ...mergedState.core,
        phase: preparedState?.sys?.phase ?? preparedState?.core?.phase ?? 'playCards',
        factionSelection: undefined,
        titans: [],
        triggerQueue: [],
      };
      mergedState.sys = {
        ...mergedState.sys,
        matchId,
        turnOrder: Array.isArray(preparedState?.core?.turnOrder)
          ? [...preparedState.core.turnOrder]
          : mergedState.sys?.turnOrder,
        currentPlayerIndex: typeof preparedState?.core?.currentPlayerIndex === 'number'
          ? preparedState.core.currentPlayerIndex
          : mergedState.sys?.currentPlayerIndex,
        phase: preparedState?.sys?.phase ?? mergedState.sys?.phase,
        interaction: {
          ...mergedState.sys?.interaction,
          current: undefined,
        },
        responseWindow: {
          ...mergedState.sys?.responseWindow,
          current: undefined,
        },
      };

      await injectMatchState(matchId, mergedState, hostPage);
      await hostPage.reload({ waitUntil: 'domcontentloaded' });
      await guestPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForSmashUpUI(hostPage);
      await waitForSmashUpUI(guestPage);

      const endTurnButton = hostPage.getByTestId('su-end-turn-action-button');
      await expect(endTurnButton).toBeVisible({ timeout: 15000 });
      await endTurnButton.click();

      let triggerOptionId = '';
      await expect.poll(async () => {
        const guestState = await readHarnessState(guestPage);
        const prompt = guestState?.sys?.interaction?.current;
        const triggerOption = (prompt?.data?.options ?? []).find((option: any) => option?.id !== 'pass');
        triggerOptionId = typeof triggerOption?.id === 'string' ? triggerOption.id : '';
        return prompt?.data?.sourceId === 'smashup_reaction_choose'
          && prompt?.playerId === '1'
          && guestState?.sys?.phase === 'scoreBases'
          && guestState?.core?.currentPlayerIndex === 0
          && guestState?.core?.bases?.[0]?.defId === 'base_monkey_lab'
          && triggerOptionId.length > 0;
      }, {
        message: 'P0 结束当前回合并触发 Monkey Lab 计分后，赢家=P1 页面应进入 Time Is Fleeting 响应窗口',
        timeout: 20000,
      }).toBe(true);

      const guestFleetingButton = guestPage.getByRole('button', { name: /时间流逝/ });
      const hostFleetingButton = hostPage.getByRole('button', { name: /时间流逝/ });
      const hostMonkeyLabBase = hostPage.getByTestId('base-zone-0');
      await expect(guestFleetingButton).toBeVisible({ timeout: 15000 });
      await expect(hostFleetingButton).toHaveCount(0);
      await expect(hostMonkeyLabBase).toBeVisible({ timeout: 15000 });
      await screenshotViewport(guestPage, 'yuanhou-time-is-fleeting-winner-prompt-guest', testInfo);
      await screenshotViewport(hostPage, 'yuanhou-time-is-fleeting-current-player-no-choice-host', testInfo);

      await hostMonkeyLabBase.click();

      await expect.poll(async () => {
        const guestState = await readHarnessState(guestPage);
        const prompt = guestState?.sys?.interaction?.current;
        return prompt?.data?.sourceId === 'smashup_reaction_choose'
          && prompt?.playerId === '1'
          && guestState?.core?.currentPlayerIndex === 0
          && guestState?.sys?.phase === 'scoreBases';
      }, {
        message: '当前回合玩家 P0 点击同一基地后，不应消耗掉属于赢家 P1 的 Time Is Fleeting 选择权',
        timeout: 10000,
      }).toBe(true);

      await guestFleetingButton.click({ force: true });

      await expect.poll(async () => {
        const guestState = await readHarnessState(guestPage);
        const prompt = guestState?.sys?.interaction?.current;
        const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
        return prompt?.data?.sourceId === 'time_travelers_time_is_fleeting_choose'
          && prompt?.playerId === '1'
          && optionIds.includes('base_the_vats')
          && optionIds.includes('base_faceless_city')
          && optionIds.includes('base_the_nexus')
          && !optionIds.includes('base_monkey_lab');
      }, {
        message: '赢家 P1 点击 Time Is Fleeting 后，应只看到基地弃牌堆里的合法基地候选',
        timeout: 15000,
      }).toBe(true);

      await expect(guestPage.locator('[data-option-id="base_faceless_city"]')).toBeVisible({ timeout: 15000 });
      await screenshotViewport(guestPage, 'yuanhou-time-is-fleeting-discard-base-choice-guest', testInfo);
      await guestPage.locator('[data-option-id="base_faceless_city"]').click();

      await expect.poll(async () => {
        const serverState = await getMatchState(matchId, hostPage);
        const baseDeck = serverState?.core?.baseDeck ?? [];
        const baseDiscard = serverState?.core?.baseDiscard ?? [];
        const p1Hand = serverState?.core?.players?.['1']?.hand ?? [];
        const p1Discard = serverState?.core?.players?.['1']?.discard ?? [];
        return serverState?.sys?.phase === 'playCards'
          && serverState?.core?.currentPlayerIndex === 1
          && serverState?.sys?.interaction?.current == null
          && serverState?.sys?.responseWindow?.current == null
          && serverState?.core?.bases?.[0]?.defId === 'base_faceless_city'
          && !baseDeck.includes('base_faceless_city')
          && baseDeck.includes('base_primate_park')
          && baseDiscard.includes('base_monkey_lab')
          && baseDiscard.includes('base_the_vats')
          && !baseDiscard.includes('base_faceless_city')
          && !hasUid(p1Hand, 'time-fleeting-guest')
          && hasUid(p1Discard, 'time-fleeting-guest');
      }, {
        message: 'P1 选择 Faceless City 后，应由弃牌堆基地替换已计分基地并进入 P1 的正常出牌阶段',
        timeout: 20000,
      }).toBe(true);

      await expect(guestPage.locator('[data-option-id="base_faceless_city"]')).toBeHidden({ timeout: 15000 });
      await expect(hostPage.getByRole('button', { name: /时间流逝/ })).toHaveCount(0);
      await screenshotViewport(guestPage, 'yuanhou-time-is-fleeting-replaced-base-resolved-guest', testInfo);
      await screenshotViewport(hostPage, 'yuanhou-time-is-fleeting-replaced-base-resolved-host', testInfo);
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });

  test('时间旅行者-Time Is Fleeting-恢复可见触发 manual-resync 后赢家页弃牌堆基地选择权仍只归赢家页面', async ({ page, game, browser }, testInfo) => {
    test.setTimeout(180000);
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
              hand: [],
              deck: [],
              discard: [],
              factions: ['time_travelers'],
              minionsPlayed: 1,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [
                { uid: 'time-fleeting-manual-resync-guest', defId: 'time_travelers_time_is_fleeting', type: 'action', owner: '1' },
              ],
              deck: [],
              discard: [],
              factions: ['time_travelers'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_monkey_lab',
              breakpoint: 20,
              minions: [{
                uid: 'time-fleeting-manual-resync-guest-winner',
                defId: 'time_travelers_time_raider',
                controller: '1',
                owner: '1',
                basePower: 24,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [],
              }],
              ongoingActions: [],
            },
            {
              defId: 'base_portal_room',
              breakpoint: 20,
              minions: [],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_primate_park'],
          baseDiscard: ['base_the_vats', 'base_faceless_city', 'base_the_nexus'],
        },
      },
    });

    const preparedState = JSON.parse(JSON.stringify(await game.getState()));
    const setup = await setupSmashUpOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, {
      hostFactions: ['time_travelers', 'super_spies'],
      guestFactions: ['shapeshifters', 'cyborg_apes'],
      skipFactionSelection: true,
      testInfo,
    });
    if (!setup) {
      test.skip(true, 'SmashUp 联机房间创建失败');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

    try {
      const mergedState = JSON.parse(JSON.stringify(preparedState));
      mergedState.core = {
        ...mergedState.core,
        phase: preparedState?.sys?.phase ?? preparedState?.core?.phase ?? 'playCards',
        factionSelection: undefined,
        titans: [],
        triggerQueue: [],
      };
      mergedState.sys = {
        ...mergedState.sys,
        matchId,
        turnOrder: Array.isArray(preparedState?.core?.turnOrder)
          ? [...preparedState.core.turnOrder]
          : mergedState.sys?.turnOrder,
        currentPlayerIndex: typeof preparedState?.core?.currentPlayerIndex === 'number'
          ? preparedState.core.currentPlayerIndex
          : mergedState.sys?.currentPlayerIndex,
        phase: preparedState?.sys?.phase ?? mergedState.sys?.phase,
        interaction: {
          ...mergedState.sys?.interaction,
          current: undefined,
        },
        responseWindow: {
          ...mergedState.sys?.responseWindow,
          current: undefined,
        },
      };

      await injectMatchState(matchId, mergedState, hostPage);
      await hostPage.reload({ waitUntil: 'domcontentloaded' });
      await guestPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForSmashUpUI(hostPage);
      await waitForSmashUpUI(guestPage);
      await installManualResyncTracker(guestPage);
      await expect.poll(async () => {
        const hostSnapshot = await readMatchRoomLiveSnapshot(hostPage);
        const guestSnapshot = await readMatchRoomLiveSnapshot(guestPage);
        return hostSnapshot?.providerPlayerID === '0'
          && hostSnapshot?.effectivePlayerID === '0'
          && hostSnapshot?.isSpectatorRoute === false
          && guestSnapshot?.providerPlayerID === '1'
          && guestSnapshot?.effectivePlayerID === '1'
          && guestSnapshot?.isSpectatorRoute === false;
      }, {
        message: 'Time Is Fleeting manual-resync 采样前，Host/Guest 页壳 live snapshot 应先对齐各自 seat',
        timeout: 15000,
      }).toBe(true);

      const endTurnButton = hostPage.getByTestId('su-end-turn-action-button');
      await expect(endTurnButton).toBeVisible({ timeout: 15000 });
      await endTurnButton.click();

      let triggerOptionId = '';
      await expect.poll(async () => {
        const guestState = await readHarnessState(guestPage);
        const prompt = guestState?.sys?.interaction?.current;
        const triggerOption = (prompt?.data?.options ?? []).find((option: any) => option?.id !== 'pass');
        triggerOptionId = typeof triggerOption?.id === 'string' ? triggerOption.id : '';
        return prompt?.data?.sourceId === 'smashup_reaction_choose'
          && prompt?.playerId === '1'
          && guestState?.sys?.phase === 'scoreBases'
          && guestState?.core?.currentPlayerIndex === 0
          && triggerOptionId.length > 0;
      }, {
        message: 'P0 结束当前回合并触发 Monkey Lab 计分后，赢家=P1 页面应进入 Time Is Fleeting 响应窗口',
        timeout: 20000,
      }).toBe(true);

      await startMatchRoomLiveTrace(hostPage, 'time-fleeting-manual-resync-host');
      await startMatchRoomLiveTrace(guestPage, 'time-fleeting-manual-resync-guest');
      await triggerShellVisibilityResync(guestPage);

      await expect.poll(async () => {
        const guestState = await readHarnessState(guestPage);
        const prompt = guestState?.sys?.interaction?.current;
        return {
          manualResyncCount: await getManualResyncCount(guestPage),
          sourceId: prompt?.data?.sourceId ?? null,
          playerId: prompt?.playerId ?? null,
          hostSourceId: (await readHarnessState(hostPage))?.sys?.interaction?.current?.data?.sourceId ?? null,
        };
      }, {
        message: 'manual-resync 后，Time Is Fleeting 的赢家 reaction 选择窗口仍应只留在 Guest 页面',
        timeout: 20000,
      }).toEqual({
        manualResyncCount: 1,
        sourceId: 'smashup_reaction_choose',
        playerId: '1',
        hostSourceId: null,
      });

      const guestFleetingButton = guestPage.getByRole('button', { name: /时间流逝/ });
      await expect(guestFleetingButton).toBeVisible({ timeout: 15000 });
      await expect(hostPage.getByRole('button', { name: /时间流逝/ })).toHaveCount(0);
      await screenshotViewport(guestPage, 'yuanhou-time-is-fleeting-manual-resync-winner-prompt-guest', testInfo);
      await screenshotViewport(hostPage, 'yuanhou-time-is-fleeting-manual-resync-current-player-no-choice-host', testInfo);

      await guestFleetingButton.click({ force: true });

      await expect.poll(async () => {
        const guestState = await readHarnessState(guestPage);
        const prompt = guestState?.sys?.interaction?.current;
        const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
        return prompt?.data?.sourceId === 'time_travelers_time_is_fleeting_choose'
          && prompt?.playerId === '1'
          && optionIds.includes('base_the_vats')
          && optionIds.includes('base_faceless_city')
          && optionIds.includes('base_the_nexus');
      }, {
        message: '赢家 P1 点击 Time Is Fleeting 后，应进入弃牌堆基地选择 prompt',
        timeout: 15000,
      }).toBe(true);

      await triggerShellVisibilityResync(guestPage);

      await expect.poll(async () => {
        const guestState = await readHarnessState(guestPage);
        const prompt = guestState?.sys?.interaction?.current;
        const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
        return {
          manualResyncCount: await getManualResyncCount(guestPage),
          sourceId: prompt?.data?.sourceId ?? null,
          playerId: prompt?.playerId ?? null,
          optionIds,
          hostSourceId: (await readHarnessState(hostPage))?.sys?.interaction?.current?.data?.sourceId ?? null,
        };
      }, {
        message: 'manual-resync 后，Time Is Fleeting 的弃牌堆基地选择 prompt 仍应只留在赢家页面',
        timeout: 20000,
      }).toEqual({
        manualResyncCount: 2,
        sourceId: 'time_travelers_time_is_fleeting_choose',
        playerId: '1',
        optionIds: ['base_the_vats', 'base_faceless_city', 'base_the_nexus'],
        hostSourceId: null,
      });

      await stopMatchRoomLiveTrace(hostPage, 'time-fleeting-manual-resync-host');
      await stopMatchRoomLiveTrace(guestPage, 'time-fleeting-manual-resync-guest');
      const hostLiveTrace = await readMatchRoomLiveTrace(hostPage, 'time-fleeting-manual-resync-host');
      const guestLiveTrace = await readMatchRoomLiveTrace(guestPage, 'time-fleeting-manual-resync-guest');
      const hostBadSamples = hostLiveTrace.filter((entry: any) => {
        const snapshot = entry?.snapshot;
        if (!snapshot) return true;
        return snapshot?.providerPlayerID !== '0'
          || snapshot?.effectivePlayerID !== '0'
          || snapshot?.statusPlayerID !== '0'
          || snapshot?.isSpectatorRoute !== false
          || snapshot?.stateView?.interactionPlayerId === '1'
          || snapshot?.stateView?.interactionSourceId === 'smashup_reaction_choose'
          || snapshot?.stateView?.interactionSourceId === 'time_travelers_time_is_fleeting_choose';
      });
      const guestBadSamples = guestLiveTrace.filter((entry: any) => {
        const snapshot = entry?.snapshot;
        if (!snapshot) return true;
        const sourceId = snapshot?.stateView?.interactionSourceId;
        return snapshot?.providerPlayerID !== '1'
          || snapshot?.effectivePlayerID !== '1'
          || snapshot?.statusPlayerID !== '1'
          || snapshot?.isSpectatorRoute !== false
          || (sourceId != null
            && sourceId !== 'smashup_reaction_choose'
            && sourceId !== 'time_travelers_time_is_fleeting_choose');
      });
      const guestWinnerPromptSamples = guestLiveTrace.filter((entry: any) => {
        const sourceId = entry?.snapshot?.stateView?.interactionSourceId;
        return sourceId === 'smashup_reaction_choose' || sourceId === 'time_travelers_time_is_fleeting_choose';
      });
      expect(hostBadSamples, `Host live trace should not drift to winner prompt/spectator: ${JSON.stringify(hostBadSamples.slice(0, 5))}`).toEqual([]);
      expect(guestBadSamples, `Guest live trace should stay on winner page seat without wrong prompt drift: ${JSON.stringify(guestBadSamples.slice(0, 5))}`).toEqual([]);
      expect(guestWinnerPromptSamples.length, 'Guest live trace should contain winner prompt samples across manual-resync windows').toBeGreaterThan(0);

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        return {
          responseWindowSourceId: hostState?.sys?.responseWindow?.current?.sourceId ?? null,
          currentInteractionSourceId: hostState?.sys?.interaction?.current?.data?.sourceId ?? null,
        };
      }, {
        message: '赢家进入 Time Is Fleeting 的弃牌堆基地选择后，当前回合玩家页面不应残留旧的 response window 或 me-first 交互',
        timeout: 15000,
      }).toEqual({
        responseWindowSourceId: null,
        currentInteractionSourceId: null,
      });
      await expect(hostPage.getByTestId('me-first-overlay')).toHaveCount(0);
      await expect(hostPage.getByTestId('card-spotlight-queue')).toBeHidden({ timeout: 15000 });

      await screenshotViewport(guestPage, 'yuanhou-time-is-fleeting-manual-resync-discard-base-choice-guest', testInfo);
      await screenshotViewport(hostPage, 'yuanhou-time-is-fleeting-manual-resync-no-discard-base-choice-host', testInfo);
      await guestPage.locator('[data-option-id="base_faceless_city"]').click();

      await expect.poll(async () => {
        const serverState = await getMatchState(matchId, hostPage);
        const baseDeck = serverState?.core?.baseDeck ?? [];
        const baseDiscard = serverState?.core?.baseDiscard ?? [];
        const p1Discard = serverState?.core?.players?.['1']?.discard ?? [];
        return serverState?.sys?.phase === 'playCards'
          && serverState?.core?.currentPlayerIndex === 1
          && serverState?.sys?.interaction?.current == null
          && serverState?.sys?.responseWindow?.current == null
          && serverState?.core?.bases?.[0]?.defId === 'base_faceless_city'
          && !baseDeck.includes('base_faceless_city')
          && baseDeck.includes('base_primate_park')
          && baseDiscard.includes('base_monkey_lab')
          && baseDiscard.includes('base_the_vats')
          && !baseDiscard.includes('base_faceless_city')
          && hasUid(p1Discard, 'time-fleeting-manual-resync-guest');
      }, {
        message: 'manual-resync 后由赢家选择 Faceless City，仍应正常替换计分基地并完成收口',
        timeout: 20000,
      }).toBe(true);

      await expect(guestPage.locator('[data-option-id="base_faceless_city"]')).toBeHidden({ timeout: 15000 });
      await expect(hostPage.getByRole('button', { name: /时间流逝/ })).toHaveCount(0);
      await screenshotViewport(guestPage, 'yuanhou-time-is-fleeting-manual-resync-resolved-guest', testInfo);
      await screenshotViewport(hostPage, 'yuanhou-time-is-fleeting-manual-resync-resolved-host', testInfo);
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });

  test('超级间谍-ISI摇摆据点-真实多客户端下赢家不是当前回合玩家时应只给赢家页面重排牌库', async ({ page, game, browser }, testInfo) => {
    test.setTimeout(180000);
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
              hand: [],
              deck: [],
              discard: [],
              factions: ['super_spies'],
              minionsPlayed: 1,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [],
              deck: [
                { uid: 'isi-guest-a', defId: 'super_spies_spy', type: 'minion', owner: '1' },
                { uid: 'isi-guest-b', defId: 'super_spies_operative', type: 'minion', owner: '1' },
                { uid: 'isi-guest-c', defId: 'super_spies_mole', type: 'minion', owner: '1' },
              ],
              discard: [],
              factions: ['super_spies'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_isis_swingin_pad',
              breakpoint: 18,
              minions: [{
                uid: 'isi-guest-winner',
                defId: 'super_spies_secret_agent',
                controller: '1',
                owner: '1',
                basePower: 22,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [],
              }],
              ongoingActions: [],
            },
            {
              defId: 'base_secret_volcano_headquarters',
              breakpoint: 18,
              minions: [],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_portal_room'],
          baseDiscard: [],
        },
      },
    });

    const preparedState = JSON.parse(JSON.stringify(await game.getState()));
    const setup = await setupSmashUpOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined, {
      hostFactions: ['super_spies', 'time_travelers'],
      guestFactions: ['shapeshifters', 'cyborg_apes'],
      skipFactionSelection: true,
      testInfo,
    });
    if (!setup) {
      test.skip(true, 'SmashUp 联机房间创建失败');
      return;
    }

    const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

    try {
      const mergedState = JSON.parse(JSON.stringify(preparedState));
      mergedState.core = {
        ...mergedState.core,
        phase: preparedState?.sys?.phase ?? preparedState?.core?.phase ?? 'playCards',
        factionSelection: undefined,
        titans: [],
        triggerQueue: [],
      };
      mergedState.sys = {
        ...mergedState.sys,
        matchId,
        turnOrder: Array.isArray(preparedState?.core?.turnOrder)
          ? [...preparedState.core.turnOrder]
          : mergedState.sys?.turnOrder,
        currentPlayerIndex: typeof preparedState?.core?.currentPlayerIndex === 'number'
          ? preparedState.core.currentPlayerIndex
          : mergedState.sys?.currentPlayerIndex,
        phase: preparedState?.sys?.phase ?? mergedState.sys?.phase,
        interaction: {
          ...mergedState.sys?.interaction,
          current: undefined,
        },
        responseWindow: {
          ...mergedState.sys?.responseWindow,
          current: undefined,
        },
      };

      await injectMatchState(matchId, mergedState, hostPage);
      await hostPage.reload({ waitUntil: 'domcontentloaded' });
      await guestPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForSmashUpUI(hostPage);
      await waitForSmashUpUI(guestPage);

      const endTurnButton = hostPage.getByTestId('su-end-turn-action-button');
      await expect(endTurnButton).toBeVisible({ timeout: 15000 });
      await endTurnButton.click();

      const promptButton = hostPage.getByRole('button', { name: /ISI/ });
      const guestButton = guestPage.getByRole('button', { name: /ISI/ });
      let promptPage = hostPage;
      await expect.poll(async () => {
        const hostVisible = await promptButton.isVisible().catch(() => false);
        const guestVisible = await guestButton.isVisible().catch(() => false);
        if (hostVisible) {
          promptPage = hostPage;
          return true;
        }
        if (guestVisible) {
          promptPage = guestPage;
          return true;
        }
        return false;
      }, {
        message: 'P0 结束当前回合并触发 ISI 计分后，赢家页面应出现 ISI 选择按钮',
        timeout: 20000,
      }).toBe(true);

      const otherPage = promptPage === hostPage ? guestPage : hostPage;
      let selectedOptionId = '';
      let selectedOrderLabel = '';
      const promptIsiButton = promptPage.getByRole('button', { name: /ISI/ });
      const otherIsiButton = otherPage.getByRole('button', { name: /ISI/ });
      const promptBase = promptPage.getByTestId('base-zone-0');
      await expect(promptIsiButton).toBeVisible({ timeout: 15000 });
      await expect(otherIsiButton).toHaveCount(0);
      await expect(promptBase).toBeVisible({ timeout: 15000 });
      await screenshotViewport(promptPage, 'yuanhou-isi-swingin-pad-winner-page-prompt', testInfo);
      await screenshotViewport(otherPage, 'yuanhou-isi-swingin-pad-other-page-no-choice', testInfo);

      await promptBase.click();

      await expect.poll(async () => {
        const hostState = await readHarnessState(hostPage);
        const guestState = await readHarnessState(guestPage);
        const hostPrompt = hostState?.sys?.interaction?.current ?? hostState?.sys?.responseWindow?.current;
        const guestPrompt = guestState?.sys?.interaction?.current ?? guestState?.sys?.responseWindow?.current;
        return (hostPrompt?.data?.sourceId === 'smashup_reaction_choose' || guestPrompt?.data?.sourceId === 'smashup_reaction_choose')
          && (hostPrompt?.playerId === '1' || guestPrompt?.playerId === '1')
          && hostState?.core?.currentPlayerIndex === 0
          && guestState?.core?.currentPlayerIndex === 0;
      }, {
        message: '当前回合玩家 P0 点击同一基地后，不应消耗掉属于赢家 P1 的 ISI 选择权',
        timeout: 10000,
      }).toBe(true);

      await promptIsiButton.click({ force: true });

      await expect.poll(async () => {
        const promptState = await readHarnessState(promptPage);
        const prompt = promptState?.sys?.interaction?.current ?? promptState?.sys?.responseWindow?.current;
        const selected = (prompt?.data?.options ?? []).find((option: any) =>
          option?.value?.targetPlayerId === '1'
          && option?.value?.topUids?.join(',') === 'isi-guest-c,isi-guest-a'
          && option?.value?.bottomUids?.join(',') === 'isi-guest-b',
        );
        selectedOptionId = selected?.id ?? '';
        selectedOrderLabel = selected?.label ?? '';
        return prompt?.data?.sourceId === 'base_isis_swingin_pad_reorder'
          && prompt?.playerId === '1'
          && Array.isArray(prompt?.data?.inspectedUids)
          && prompt.data.inspectedUids.join(',') === 'isi-guest-a,isi-guest-b,isi-guest-c'
          && selectedOptionId.length > 0
          && selectedOrderLabel.length > 0;
      }, {
        message: 'ISI 响应后，应在赢家 P1 页面进入其自己牌库顶三张重排 prompt',
        timeout: 15000,
      }).toBe(true);

      await expect(promptPage.locator('[data-deck-reorder-card-uid="isi-guest-b"]')).toBeVisible({ timeout: 15000 });
      await expect(promptPage.getByRole('button', { name: '确认顺序' })).toBeVisible({ timeout: 15000 });
      await expect(promptPage.getByTestId('reveal-overlay')).toHaveCount(0);
      await screenshotViewport(promptPage, 'yuanhou-isi-swingin-pad-reorder-prompt', testInfo);
      await promptPage.locator('[data-deck-reorder-card-uid="isi-guest-b"]').click();
      await promptPage.getByRole('button', { name: '移到牌库底' }).click();
      await promptPage.locator('[data-deck-reorder-card-uid="isi-guest-c"]').click();
      await promptPage.getByRole('button', { name: '前移' }).click();
      await promptPage.getByRole('button', { name: '确认顺序' }).click();

      await expect.poll(async () => {
        const serverState = await getMatchState(matchId, hostPage);
        const p1Deck = serverState?.core?.players?.['1']?.deck?.map((card: any) => card.uid) ?? [];
        return serverState?.sys?.interaction?.current == null
          && p1Deck.join(',') === 'isi-guest-c,isi-guest-a,isi-guest-b'
          && serverState?.core?.bases?.[0]?.defId === 'base_portal_room';
      }, {
        message: 'P1 完成 ISI 重排后，应只改写赢家自己的牌库顺序并完成计分收口',
        timeout: 20000,
      }).toBe(true);

      await screenshotViewport(promptPage, 'yuanhou-isi-swingin-pad-reordered-deck-resolved-winner-page', testInfo);
      await screenshotViewport(otherPage, 'yuanhou-isi-swingin-pad-reordered-deck-resolved-other-page', testInfo);
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });
});
