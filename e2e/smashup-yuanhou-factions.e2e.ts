import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Locator, Page, TestInfo } from '@playwright/test';
import { expect, test } from './framework';
import { getEvidenceScreenshotPath, sanitizeEvidencePathSegment } from './framework/evidenceScreenshots';
import { setChineseLocale } from './helpers/common';

const YUANHOU_FACTIONS = [
  { id: 'shapeshifters', shotName: 'shapeshifters' },
  { id: 'cyborg_apes', shotName: 'cyborg-apes' },
  { id: 'super_spies', shotName: 'super-spies' },
  { id: 'time_travelers', shotName: 'time-travelers' },
] as const;

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

type ReactionDriverGame = {
  getState(): Promise<any>;
  passResponseWindow(playerId?: string): Promise<void>;
  selectInteractionOptionBy(matcher: (option: any) => boolean, description: string): Promise<void>;
};

async function drainOpenReactionOrResponseWindows(
  game: ReactionDriverGame,
  description: string,
  maxSteps = 8,
): Promise<void> {
  const history: unknown[] = [];
  for (let step = 0; step < maxSteps; step += 1) {
    const state = await game.getState();
    const interaction = state?.sys?.interaction?.current;
    const sourceId = interaction?.data?.sourceId;
    history.push({
      step: step + 1,
      phase: state?.sys?.phase,
      interactionId: interaction?.id ?? null,
      sourceId: sourceId ?? null,
      interactionPlayerId: interaction?.playerId ?? null,
      optionIds: (interaction?.data?.options ?? []).map((option: any) => option?.id),
      optionKinds: (interaction?.data?.options ?? []).map((option: any) => option?.value?.kind ?? null),
      responseWindow: state?.sys?.responseWindow?.current
        ? {
            sourceId: state.sys.responseWindow.current.sourceId ?? null,
            windowType: state.sys.responseWindow.current.windowType ?? null,
            responderQueue: state.sys.responseWindow.current.responderQueue ?? null,
            currentResponderIndex: state.sys.responseWindow.current.currentResponderIndex ?? null,
            passedPlayers: state.sys.responseWindow.current.passedPlayers ?? null,
          }
        : null,
      reactionFrames: (state?.sys?.resolution?.frames ?? [])
        .filter((frame: any) => frame?.metadata?.smashupReactionSession)
        .map((frame: any) => ({
          id: frame.id,
          status: frame.status,
          step: frame.step,
          session: frame.metadata.smashupReactionSession,
        })),
    });
    if (sourceId === 'smashup_reaction_choose') {
      await game.selectInteractionOptionBy(
        (option: any) => option?.value?.kind === 'pass',
        `${description}: reaction pass ${step + 1}`,
      );
      continue;
    }

    const responseWindow = state?.sys?.responseWindow?.current;
    if (responseWindow) {
      const responderId = responseWindow.responderQueue?.[responseWindow.currentResponderIndex ?? 0];
      await game.passResponseWindow(responderId);
      continue;
    }

    return;
  }

  const state = await game.getState();
  throw new Error(`${description}: response/reaction windows still open after ${maxSteps} steps: ${
    JSON.stringify({
      interactionSourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
      responseWindow: state?.sys?.responseWindow?.current ?? null,
      history,
    })
  }`);
}

async function surfaceWormholeReactionChoice(
  game: ReactionDriverGame,
  wormholeCardUid: string,
  description: string,
  maxSteps = 8,
): Promise<void> {
  const history: unknown[] = [];
  for (let step = 0; step < maxSteps; step += 1) {
    const state = await game.getState();
    const interaction = state?.sys?.interaction?.current;
    const sourceId = interaction?.data?.sourceId;
    const options = interaction?.data?.options ?? [];
    history.push({
      step: step + 1,
      phase: state?.sys?.phase,
      sourceId: sourceId ?? null,
      optionIds: options.map((option: any) => option?.id),
      optionLabels: options.map((option: any) => option?.label ?? null),
      optionKinds: options.map((option: any) => option?.value?.kind ?? null),
    });

    if (sourceId === 'smashup_reaction_choose') {
      const wormholeOption = options.find((option: any) =>
        option?.value?.kind === 'play_action' && option?.value?.cardUid === wormholeCardUid,
      );
      if (wormholeOption) return;

      const jumperTriggerOption = options.find((option: any) => {
        if (option?.value?.kind !== 'trigger') return false;
        const trigger = state?.core?.triggerQueue?.find((entry: any) => entry?.id === option?.value?.triggerId);
        return trigger?.sourceDefId === 'time_travelers_jumper';
      });
      if (jumperTriggerOption) {
        await game.selectInteractionOptionBy(
          (option: any) => option?.id === jumperTriggerOption.id,
          `${description}: resolve Jumper trigger before Wormhole`,
        );
        continue;
      }
    }

    const responseWindow = state?.sys?.responseWindow?.current;
    if (responseWindow) {
      const responderId = responseWindow.responderQueue?.[responseWindow.currentResponderIndex ?? 0];
      await game.passResponseWindow(responderId);
      continue;
    }

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  throw new Error(`${description}: Wormhole reaction choice did not surface within ${maxSteps} steps: ${
    JSON.stringify(history)
  }`);
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

async function expectDeferredExtraGrantToastSuppressed(
  page: Page,
  kind: 'minion' | 'action',
): Promise<void> {
  const text = kind === 'minion'
    ? '获得1次额外随从机会，处理完当前交互流程后可使用'
    : '获得1次额外行动机会，处理完当前交互流程后可使用';
  await expect(page.getByText(text, { exact: true })).toHaveCount(0);
}

async function dismissSmashUpSpotlightQueueIfVisible(page: Page): Promise<void> {
  const spotlightQueue = page.getByTestId('card-spotlight-queue');
  const revealOverlay = page.getByTestId('reveal-overlay');
  const revealDismissButton = page.getByTestId('reveal-dismiss-btn');

  for (let step = 0; step < 16; step += 1) {
    const revealVisible = await revealOverlay.isVisible().catch(() => false);
    if (revealVisible) {
      await revealDismissButton.click({ force: true });
      await page.waitForTimeout(150);
      continue;
    }

    const spotlightVisible = await spotlightQueue.isVisible().catch(() => false);
    if (spotlightVisible) {
      await spotlightQueue.getByRole('button', { name: /^(关闭特写|Close spotlight)$/i }).click({ force: true });
      await page.waitForTimeout(150);
      continue;
    }

    await page.waitForTimeout(150);
    break;
  }

  await expect(revealOverlay).toBeHidden();
  await expect(spotlightQueue).toBeHidden();
}

test.describe('SmashUp yuanhou 四派系 intake 真实入口验证', () => {
  test('派系选择页能看到四个新派系、实施中标记与素材卡', async ({ page, game }, testInfo) => {
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

    for (const faction of YUANHOU_FACTIONS) {
      const option = page.getByTestId(`faction-option-${faction.id}`);
      await option.scrollIntoViewIfNeeded({ timeout: 15000 });
      await expect(option, `${faction.id} 应在派系选择页可见`).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId(`faction-implementation-banner-${faction.id}`)).toContainText('实施中');

      await expect.poll(async () => option.locator('.atlas-shimmer').count(), {
        message: `${faction.id} 素材预览不应残留 atlas shimmer`,
        timeout: 15000,
      }).toBe(0);

      await option.screenshot({ path: testInfo.outputPath(`yuanhou-faction-option-${faction.shotName}.png`) });
    }

    await game.screenshot('yuanhou-faction-selection-visible', testInfo);
  });

  test('电子猿 Cyberback 可从弃牌堆真实选择持续行动并打到自己身上', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
              discard: [{ uid: 'evo-discard', defId: 'cyborg_apes_cyberevolution', type: 'action', owner: '0' }],
              factions: ['cyborg_apes'],
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
              factions: ['shapeshifters'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_secret_volcano_headquarters',
              breakpoint: 18,
              minions: [{
                uid: 'cyberback-a',
                defId: 'cyborg_apes_cyberback',
                controller: '0',
                owner: '0',
                basePower: 5,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [],
              }],
              ongoingActions: [],
            },
            { defId: 'base_the_vats', breakpoint: 18, minions: [], ongoingActions: [] },
            { defId: 'base_portal_room', breakpoint: 20, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    await expect(page.getByTestId('su-discard-toggle')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('su-discard-toggle').click();
    const discardCard = page.locator('[data-card-uid="evo-discard"]');
    await expect(discardCard).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-cyberback-discard-action-visible', testInfo);

    await discardCard.click();
    const cyberbackHost = page.locator('[data-minion-uid="cyberback-a"]');
    await expect(cyberbackHost).toBeVisible({ timeout: 15000 });
    await cyberbackHost.click();

    await expect.poll(async () => {
      const state = await game.getState();
      const cyberback = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'cyberback-a');
      return cyberback?.attachedActions?.some((action: any) => action.uid === 'evo-discard') === true
        && !state?.core?.players?.['0']?.discard?.some((card: any) => card.uid === 'evo-discard');
    }, {
      message: 'Cyberback 应通过真实 UI 把弃牌堆持续行动附着到自己身上',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-cyberback-action-attached', testInfo);
  });

  test('电子猿 Cyberback 多宿主时可精确选择附着目标', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
              discard: [{ uid: 'shield-discard', defId: 'cyborg_apes_shielding', type: 'action', owner: '0' }],
              factions: ['cyborg_apes'],
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
              factions: ['shapeshifters'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_secret_volcano_headquarters',
              breakpoint: 18,
              minions: [
                {
                  uid: 'cyberback-a',
                  defId: 'cyborg_apes_cyberback',
                  controller: '0',
                  owner: '0',
                  basePower: 5,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'cyberback-b',
                  defId: 'cyborg_apes_cyberback',
                  controller: '0',
                  owner: '0',
                  basePower: 5,
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
            { defId: 'base_portal_room', breakpoint: 20, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    await page.getByTestId('su-discard-toggle').click();
    const discardCard = page.locator('[data-card-uid="shield-discard"]');
    await expect(discardCard).toBeVisible({ timeout: 15000 });
    await discardCard.click();
    await game.screenshot('yuanhou-cyberback-multi-target-selectable', testInfo);

    await page.locator('[data-minion-uid="cyberback-b"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      const cyberbackA = minions.find((minion: any) => minion.uid === 'cyberback-a');
      const cyberbackB = minions.find((minion: any) => minion.uid === 'cyberback-b');
      return cyberbackA?.attachedActions?.length === 0
        && cyberbackB?.attachedActions?.some((action: any) => action.uid === 'shield-discard') === true
        && !state?.core?.players?.['0']?.discard?.some((card: any) => card.uid === 'shield-discard');
    }, {
      message: '多只 Cyberback 时应把弃牌堆行动附着到玩家点击的那一只',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-cyberback-multi-target-attached-to-second', testInfo);
  });

  test('电子猿 Cyberback 真实入口会隐藏非法弃牌并拒绝非法宿主点击', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
              discard: [
                { uid: 'cyberback-valid-discard', defId: 'cyborg_apes_cyberevolution', type: 'action', owner: '0' },
                { uid: 'cyberback-invalid-discard', defId: 'cyborg_apes_going_bananas', type: 'action', owner: '0' },
              ],
              factions: ['cyborg_apes'],
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
              factions: ['sharks'],
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
                uid: 'cyberback-own-host',
                defId: 'cyborg_apes_cyberback',
                controller: '0',
                owner: '0',
                basePower: 5,
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
              minions: [{
                uid: 'cyberback-own-other',
                defId: 'sharks_mako',
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
              defId: 'base_secret_volcano_headquarters',
              breakpoint: 18,
              minions: [{
                uid: 'cyberback-enemy-host',
                defId: 'cyborg_apes_cyberback',
                controller: '1',
                owner: '1',
                basePower: 5,
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
          baseDeck: ['base_secret_volcano_headquarters'],
          baseDiscard: [],
        },
      },
    });

    await page.getByTestId('su-discard-toggle').click();
    const validDiscardCard = page.locator('[data-card-uid="cyberback-valid-discard"]');
    const invalidDiscardCard = page.locator('[data-card-uid="cyberback-invalid-discard"]');

    await expect(validDiscardCard).toBeVisible({ timeout: 15000 });
    await expect(invalidDiscardCard).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-cyberback-discard-panel-shows-valid-and-invalid-actions', testInfo);

    await invalidDiscardCard.click();

    await expect.poll(async () => {
      const state = await game.getState();
      const allMinions = (state?.core?.bases ?? []).flatMap((base: any) => base?.minions ?? []);
      const ownHost = allMinions.find((minion: any) => minion.uid === 'cyberback-own-host');
      const ownOther = allMinions.find((minion: any) => minion.uid === 'cyberback-own-other');
      const enemyHost = allMinions.find((minion: any) => minion.uid === 'cyberback-enemy-host');
      return hasUid(state?.core?.players?.['0']?.discard, 'cyberback-valid-discard')
        && !hasUid(ownHost?.attachedActions, 'cyberback-valid-discard')
        && !hasUid(ownOther?.attachedActions, 'cyberback-valid-discard')
        && !hasUid(enemyHost?.attachedActions, 'cyberback-valid-discard');
    }, {
      message: '即使玩家在弃牌面板点击了 Going Bananas，也不应通过 Cyberback 入口把普通基地行动错误附着到任何宿主上',
      timeout: 15000,
    }).toBe(true);

    await validDiscardCard.click();
    await game.screenshot('yuanhou-cyberback-only-own-cyberback-should-be-valid-target', testInfo);

    await page.locator('[data-minion-uid="cyberback-enemy-host"]').click({ force: true });
    await page.locator('[data-minion-uid="cyberback-own-other"]').click({ force: true });

    await expect.poll(async () => {
      const state = await game.getState();
      const allMinions = (state?.core?.bases ?? []).flatMap((base: any) => base?.minions ?? []);
      const ownHost = allMinions.find((minion: any) => minion.uid === 'cyberback-own-host');
      const ownOther = allMinions.find((minion: any) => minion.uid === 'cyberback-own-other');
      const enemyHost = allMinions.find((minion: any) => minion.uid === 'cyberback-enemy-host');
      return hasUid(state?.core?.players?.['0']?.discard, 'cyberback-valid-discard')
        && !hasUid(ownHost?.attachedActions, 'cyberback-valid-discard')
        && !hasUid(ownOther?.attachedActions, 'cyberback-valid-discard')
        && !hasUid(enemyHost?.attachedActions, 'cyberback-valid-discard');
    }, {
      message: '点击敌方 Cyberback 或己方非 Cyberback 后，不应把合法持续行动错误结算到非法宿主上',
      timeout: 15000,
    }).toBe(true);

    await page.locator('[data-minion-uid="cyberback-own-host"]').click({ force: true });

    await expect.poll(async () => {
      const state = await game.getState();
      const allMinions = (state?.core?.bases ?? []).flatMap((base: any) => base?.minions ?? []);
      const ownHost = allMinions.find((minion: any) => minion.uid === 'cyberback-own-host');
      const ownOther = allMinions.find((minion: any) => minion.uid === 'cyberback-own-other');
      const enemyHost = allMinions.find((minion: any) => minion.uid === 'cyberback-enemy-host');
      return !hasUid(state?.core?.players?.['0']?.discard, 'cyberback-valid-discard')
        && hasUid(ownHost?.attachedActions, 'cyberback-valid-discard')
        && !hasUid(ownOther?.attachedActions, 'cyberback-valid-discard')
        && !hasUid(enemyHost?.attachedActions, 'cyberback-valid-discard');
    }, {
      message: 'Cyberback 真实入口只应允许把合法持续行动附着到己方 Cyberback，而不是敌方 Cyberback 或己方普通随从',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-cyberback-invalid-targets-rejected-and-own-cyberback-attached', testInfo);
  });

  test('变形者-Bacta the Future-真实入口目标受Shell Game保护时仍给其拥有者立即额外随从机会', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
                { uid: 'bacta-hand', defId: 'shapeshifters_bacta_the_future', type: 'action', owner: '0' },
                { uid: 'extra-mimic', defId: 'shapeshifters_mimic', type: 'minion', owner: '0' },
              ],
              deck: [],
              discard: [],
              factions: ['shapeshifters'],
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
              factions: ['cyborg_apes'],
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
                uid: 'protected-host',
                defId: 'shapeshifters_copycat',
                controller: '0',
                owner: '0',
                basePower: 2,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [{ uid: 'shell-attached', defId: 'shapeshifters_shell_game', ownerId: '0' }],
              }],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="bacta-hand"]').click();
    await expect(page.getByTestId('base-zone-0')).toBeVisible({ timeout: 15000 });
    await page.locator('[data-minion-uid="protected-host"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const host = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'protected-host');
      return prompt?.data?.sourceId === 'smashup_immediate_extra_minion'
        && prompt?.playerId === '0'
        && !!host
        && !state?.core?.players?.['0']?.discard?.some((card: any) => card.uid === 'protected-host');
    }, {
      message: '受 Shell Game 保护的宿主应留场，并由 Bacta 为其拥有者创建立即额外随从提示',
      timeout: 15000,
    }).toBe(true);

    await expectOwnedOverlayPromptChromeSuppressed(page);
    await expectDeferredExtraGrantToastSuppressed(page, 'minion');
    await game.screenshot('yuanhou-bacta-shell-protected-host-extra-minion-prompt', testInfo);

    await page.locator('[data-card-uid="extra-mimic"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      return minions.some((minion: any) => minion.uid === 'protected-host')
        && minions.some((minion: any) => minion.uid === 'extra-mimic')
        && state?.sys?.interaction?.current == null
        && !state?.core?.players?.['0']?.hand?.some((card: any) => card.uid === 'extra-mimic');
    }, {
      message: '立即额外随从提示应能从真实 UI 打出额外 Mimic，且 Shell Game 宿主仍留场',
      timeout: 15000,
    }).toBe(true);
    await expect(page.locator('[data-card-uid="extra-mimic"]')).toBeHidden({ timeout: 15000 });
    await expect(page.getByRole('button', { name: '放弃这次额外随从' })).toBeHidden({ timeout: 15000 });

    await game.screenshot('yuanhou-bacta-shell-extra-minion-resolved', testInfo);
  });

  test('变形者-Bacta the Future-真实入口未保护目标会进弃牌并继续给拥有者立即额外随从机会', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
                { uid: 'bacta-unprotected-hand', defId: 'shapeshifters_bacta_the_future', type: 'action', owner: '0' },
                { uid: 'unprotected-extra-mimic', defId: 'shapeshifters_mimic', type: 'minion', owner: '0' },
              ],
              deck: [],
              discard: [],
              factions: ['shapeshifters'],
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
              factions: ['cyborg_apes'],
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
                uid: 'unprotected-target',
                defId: 'shapeshifters_copycat',
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
          ],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="bacta-unprotected-hand"]').click();
    await expect(page.getByTestId('base-zone-0')).toBeVisible({ timeout: 15000 });
    await page.locator('[data-minion-uid="unprotected-target"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      const discard = state?.core?.players?.['0']?.discard ?? [];
      return prompt?.data?.sourceId === 'smashup_immediate_extra_minion'
        && prompt?.playerId === '0'
        && !hasUid(minions, 'unprotected-target')
        && hasUid(discard, 'unprotected-target');
    }, {
      message: '未保护目标应被 Bacta 真实摧毁进入 owner discard，并继续给 owner 创建立即额外随从提示',
      timeout: 15000,
    }).toBe(true);

    await expectOwnedOverlayPromptChromeSuppressed(page);
    await expectDeferredExtraGrantToastSuppressed(page, 'minion');
    await game.screenshot('yuanhou-bacta-unprotected-target-destroyed-extra-minion-prompt', testInfo);

    await page.locator('[data-card-uid="unprotected-extra-mimic"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      const discard = state?.core?.players?.['0']?.discard ?? [];
      return hasUid(minions, 'unprotected-extra-mimic')
        && !hasUid(minions, 'unprotected-target')
        && hasUid(discard, 'unprotected-target')
        && state?.sys?.interaction?.current == null;
    }, {
      message: 'Bacta 未保护目标分支应能从真实 UI 打出额外 Mimic，并保持原目标在弃牌堆',
      timeout: 15000,
    }).toBe(true);
    await expect(page.locator('[data-card-uid="unprotected-extra-mimic"]')).toBeHidden({ timeout: 15000 });
    await expect(page.getByRole('button', { name: '放弃这次额外随从' })).toBeHidden({ timeout: 15000 });

    await game.screenshot('yuanhou-bacta-unprotected-extra-minion-resolved', testInfo);
  });

  test('变形者-Bacta the Future-真实入口摧毁敌方随从后当前页只保留目标拥有者的等待层', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
              factions: ['shapeshifters'],
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
              factions: ['shapeshifters'],
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

    await page.locator('[data-card-uid="bacta-enemy-hand"]').click();
    await expect(page.getByTestId('base-zone-0')).toBeVisible({ timeout: 15000 });
    await page.locator('[data-minion-uid="enemy-owned-target"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      const enemyDiscard = state?.core?.players?.['1']?.discard ?? [];
      return prompt?.data?.sourceId === 'smashup_immediate_extra_minion'
        && prompt?.playerId === '1'
        && !hasUid(minions, 'enemy-owned-target')
        && hasUid(enemyDiscard, 'enemy-owned-target');
    }, {
      message: 'Bacta 摧毁敌方未保护目标后，应给目标 owner P1 创建 immediate extra minion prompt',
      timeout: 15000,
    }).toBe(true);

    const promptedState = await game.getState();
    const promptOptions = promptedState?.sys?.interaction?.current?.data?.options ?? [];
    const promptCardUids = promptOptions
      .map((option: any) => option?.value?.cardUid)
      .filter((uid: unknown): uid is string => typeof uid === 'string');
    expect(hasSkipOption(promptOptions), 'P1 的 immediate extra minion prompt 应允许跳过，不应强制打出').toBe(true);
    expect(promptCardUids, 'P1 的 immediate extra minion 候选必须来自 P1 手牌').toContain('enemy-owner-extra-mimic');
    expect(promptCardUids, 'P1 的 immediate extra minion prompt 不得列出 P0 手牌候选').not.toContain('wrong-owner-mimic');

    await game.screenshot('yuanhou-bacta-enemy-owner-extra-minion-prompt', testInfo);

    await expect(page.getByRole('button', { name: '放弃这次额外随从' })).toHaveCount(0);
    await expect(page.getByText('正在等待 P2')).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-bacta-enemy-owner-waiting-overlay-host', testInfo);
  });

  test('变形者-Transmogrify-真实入口摧毁己方随从后可从牌库选择非第一张合格随从打到同基地', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
              hand: [{ uid: 'transmogrify-hand', defId: 'shapeshifters_transmogrify', type: 'action', owner: '0' }],
              deck: [
                { uid: 'candidate-a', defId: 'shapeshifters_copycat', type: 'minion', owner: '0' },
                { uid: 'candidate-b', defId: 'shapeshifters_mimic', type: 'minion', owner: '0' },
                { uid: 'too-big', defId: 'shapeshifters_doppelganger', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['shapeshifters'],
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
              factions: ['cyborg_apes'],
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
                uid: 'transmogrify-target',
                defId: 'shapeshifters_gelf',
                controller: '0',
                owner: '0',
                basePower: 4,
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

    await page.locator('[data-card-uid="transmogrify-hand"]').click();
    await expect(page.getByTestId('base-zone-0')).toBeVisible({ timeout: 15000 });
    await page.locator('[data-minion-uid="transmogrify-target"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      const discard = state?.core?.players?.['0']?.discard ?? [];
      return prompt?.data?.sourceId === 'shapeshifters_transmogrify_search'
        && !hasUid(minions, 'transmogrify-target')
        && hasUid(discard, 'transmogrify-target');
    }, {
      message: 'Transmogrify 应先真实摧毁己方目标，再打开牌库合格随从选择 prompt',
      timeout: 15000,
    }).toBe(true);
    await expect.poll(async () => {
      const state = await game.getState();
      const options = state?.sys?.interaction?.current?.data?.options ?? [];
      return hasSkipOption(options);
    }, {
      message: 'Transmogrify search prompt 应在当前选择窗口提供 skip option',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-option-id="candidate-a"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="candidate-b"]')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /跳过搜寻|放弃这次选择/ })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="too-big"]')).toBeHidden({ timeout: 15000 });
    await game.screenshot('yuanhou-transmogrify-deck-search-prompt', testInfo);

    await page.locator('[data-option-id="candidate-b"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      const deck = state?.core?.players?.['0']?.deck ?? [];
      const discard = state?.core?.players?.['0']?.discard ?? [];
      return hasUid(minions, 'candidate-b')
        && !hasUid(minions, 'transmogrify-target')
        && !hasUid(deck, 'candidate-b')
        && hasUid(discard, 'transmogrify-target');
    }, {
      message: 'Transmogrify 应把玩家选择的非第一张合格候选从牌库额外打到原基地',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '放弃这次额外随从' })).toBeHidden({ timeout: 15000 });
    await expect.poll(async () => {
      const state = await game.getState();
      return state?.sys?.interaction?.current == null;
    }, {
      message: 'Transmogrify 搜牌打出候选后不应残留 immediate extra prompt',
      timeout: 15000,
    }).toBe(true);
    await expect(page.locator('[data-minion-uid="candidate-b"]')).toBeVisible({ timeout: 15000 });

    await game.screenshot('yuanhou-transmogrify-selected-minion-played', testInfo);
  });

  test('变形者-Transmogrify-真实入口跳过牌库搜寻后应直接收口且不额外打出候选随从', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
              hand: [{ uid: 'transmogrify-skip-hand', defId: 'shapeshifters_transmogrify', type: 'action', owner: '0' }],
              deck: [
                { uid: 'transmogrify-skip-candidate-a', defId: 'shapeshifters_copycat', type: 'minion', owner: '0' },
                { uid: 'transmogrify-skip-candidate-b', defId: 'shapeshifters_mimic', type: 'minion', owner: '0' },
                { uid: 'transmogrify-skip-too-big', defId: 'shapeshifters_doppelganger', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['shapeshifters'],
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
              factions: ['cyborg_apes'],
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
                uid: 'transmogrify-skip-target',
                defId: 'shapeshifters_gelf',
                controller: '0',
                owner: '0',
                basePower: 4,
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

    await page.locator('[data-card-uid="transmogrify-skip-hand"]').click();
    await expect(page.getByTestId('base-zone-0')).toBeVisible({ timeout: 15000 });
    await page.locator('[data-minion-uid="transmogrify-skip-target"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      const discard = state?.core?.players?.['0']?.discard ?? [];
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'shapeshifters_transmogrify_search'
        && !hasUid(minions, 'transmogrify-skip-target')
        && hasUid(discard, 'transmogrify-skip-target')
        && optionIds.includes('transmogrify-skip-candidate-a')
        && optionIds.includes('transmogrify-skip-candidate-b')
        && !optionIds.includes('transmogrify-skip-too-big')
        && hasSkipOption(prompt?.data?.options);
    }, {
      message: 'Transmogrify 真实入口应在摧毁己方目标后进入带 skip 的牌库搜索 prompt',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-option-id="transmogrify-skip-candidate-a"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="transmogrify-skip-candidate-b"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="transmogrify-skip-too-big"]')).toBeHidden({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /跳过搜寻|放弃这次选择/ })).toBeVisible({ timeout: 15000 });

    await game.screenshot('yuanhou-transmogrify-skip-search-prompt', testInfo);

    await game.selectInteractionOptionBy((option) => option?.value?.skip === true, 'Transmogrify 牌库搜索 skip');

    await expect.poll(async () => {
      const state = await game.getState();
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      const deck = state?.core?.players?.['0']?.deck ?? [];
      const discard = state?.core?.players?.['0']?.discard ?? [];
      const hand = state?.core?.players?.['0']?.hand ?? [];
      return state?.sys?.interaction?.current == null
        && minions.length === 0
        && hand.length === 0
        && hasUid(discard, 'transmogrify-skip-hand')
        && hasUid(discard, 'transmogrify-skip-target')
        && hasUid(deck, 'transmogrify-skip-candidate-a')
        && hasUid(deck, 'transmogrify-skip-candidate-b')
        && hasUid(deck, 'transmogrify-skip-too-big');
    }, {
      message: 'Transmogrify 真实点击 skip 后，应直接收口且不会把任何牌库候选额外打回原基地',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '放弃这次额外随从' })).toBeHidden({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="transmogrify-skip-candidate-a"]')).toBeHidden({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="transmogrify-skip-candidate-b"]')).toBeHidden({ timeout: 15000 });

    await game.screenshot('yuanhou-transmogrify-skip-search-resolved', testInfo);
  });

  test('变形者-Mitosis-真实入口可选择同名手牌随从额外打到目标基地', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
                { uid: 'mitosis-hand', defId: 'shapeshifters_mitosis', type: 'action', owner: '0' },
                { uid: 'same-a', defId: 'shapeshifters_gelf', type: 'minion', owner: '0' },
                { uid: 'same-b', defId: 'shapeshifters_gelf', type: 'minion', owner: '0' },
                { uid: 'wrong-name', defId: 'shapeshifters_mimic', type: 'minion', owner: '0' },
              ],
              deck: [],
              discard: [],
              factions: ['shapeshifters'],
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
              factions: ['cyborg_apes'],
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
                uid: 'mitosis-target',
                defId: 'shapeshifters_gelf',
                controller: '0',
                owner: '0',
                basePower: 4,
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

    await page.locator('[data-card-uid="mitosis-hand"]').click();
    await page.locator('[data-minion-uid="mitosis-target"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'shapeshifters_mitosis_choose'
        && optionIds.includes('same-a')
        && optionIds.includes('same-b')
        && !optionIds.includes('wrong-name')
        && hasSkipOption(prompt?.data?.options);
    }, {
      message: 'Mitosis 应在真实行动入口后只列同名手牌随从，并在该选择窗口提供 skip',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-option-id="same-a"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="same-b"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="wrong-name"]')).toBeHidden({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /跳过搜寻|放弃这次选择/ })).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-mitosis-same-name-hand-choice-prompt', testInfo);

    await page.locator('[data-option-id="same-b"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      const hand = state?.core?.players?.['0']?.hand ?? [];
      return state?.sys?.interaction?.current == null
        && hasUid(minions, 'mitosis-target')
        && hasUid(minions, 'same-b')
        && hasUid(hand, 'same-a')
        && hasUid(hand, 'wrong-name')
        && !hasUid(hand, 'same-b');
    }, {
      message: 'Mitosis 选择同名候选后应直接把该手牌随从额外打到目标基地并收口',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '放弃这次额外随从' })).toBeHidden({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="same-b"]')).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-mitosis-selected-same-name-minion-played', testInfo);
  });

  test('变形者-Mitosis-真实入口跳过同名手牌选择后应直接收口且不额外打出候选随从', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
                { uid: 'mitosis-skip-hand', defId: 'shapeshifters_mitosis', type: 'action', owner: '0' },
                { uid: 'mitosis-skip-same-a', defId: 'shapeshifters_gelf', type: 'minion', owner: '0' },
                { uid: 'mitosis-skip-same-b', defId: 'shapeshifters_gelf', type: 'minion', owner: '0' },
                { uid: 'mitosis-skip-wrong-name', defId: 'shapeshifters_mimic', type: 'minion', owner: '0' },
              ],
              deck: [],
              discard: [],
              factions: ['shapeshifters'],
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
              factions: ['cyborg_apes'],
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
                uid: 'mitosis-skip-target',
                defId: 'shapeshifters_gelf',
                controller: '0',
                owner: '0',
                basePower: 4,
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

    await page.locator('[data-card-uid="mitosis-skip-hand"]').click();
    await page.locator('[data-minion-uid="mitosis-skip-target"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'shapeshifters_mitosis_choose'
        && optionIds.includes('mitosis-skip-same-a')
        && optionIds.includes('mitosis-skip-same-b')
        && !optionIds.includes('mitosis-skip-wrong-name')
        && hasSkipOption(prompt?.data?.options);
    }, {
      message: 'Mitosis 真实入口应在同名手牌选择 prompt 提供 skip，并隐藏非同名手牌',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-option-id="mitosis-skip-same-a"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="mitosis-skip-same-b"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="mitosis-skip-wrong-name"]')).toBeHidden({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /跳过搜寻|放弃这次选择/ })).toBeVisible({ timeout: 15000 });

    await game.screenshot('yuanhou-mitosis-skip-same-name-choice-prompt', testInfo);

    await game.selectInteractionOptionBy((option) => option?.value?.skip === true, 'Mitosis 同名手牌选择 skip');

    await expect.poll(async () => {
      const state = await game.getState();
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      const hand = state?.core?.players?.['0']?.hand ?? [];
      const discard = state?.core?.players?.['0']?.discard ?? [];
      return state?.sys?.interaction?.current == null
        && minions.length === 1
        && hasUid(minions, 'mitosis-skip-target')
        && hasUid(hand, 'mitosis-skip-same-a')
        && hasUid(hand, 'mitosis-skip-same-b')
        && hasUid(hand, 'mitosis-skip-wrong-name')
        && hasUid(discard, 'mitosis-skip-hand');
    }, {
      message: 'Mitosis 真实点击 skip 后，应直接收口且不把任何同名手牌候选额外打到目标基地',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '放弃这次额外随从' })).toBeHidden({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="mitosis-skip-same-a"]')).toBeHidden({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="mitosis-skip-same-b"]')).toBeHidden({ timeout: 15000 });

    await game.screenshot('yuanhou-mitosis-skip-same-name-choice-resolved', testInfo);
  });

  test('变形者-Genetic Shift-真实入口可在全体加一与单体加三之间二选一', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { skipInitialization: true }, 45000);

    const setupGeneticShiftScene = async (cardUid: string) => {
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
                hand: [{ uid: cardUid, defId: 'shapeshifters_genetic_shift', type: 'action', owner: '0' }],
                deck: [],
                discard: [],
                factions: ['shapeshifters'],
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
                factions: ['cyborg_apes'],
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
                minions: [
                  {
                    uid: 'mine-a',
                    defId: 'shapeshifters_mimic',
                    controller: '0',
                    owner: '0',
                    basePower: 0,
                    powerCounters: 0,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    talentUsed: false,
                    playedThisTurn: false,
                    attachedActions: [],
                  },
                  {
                    uid: 'mine-b',
                    defId: 'shapeshifters_gelf',
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
                    uid: 'enemy-a',
                    defId: 'cyborg_apes_baboom',
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
            ],
            baseDeck: ['base_faceless_city'],
            baseDiscard: [],
          },
        },
      });
    };

    await setupGeneticShiftScene('genetic-all-hand');
    await page.locator('[data-card-uid="genetic-all-hand"]').click();
    await page.locator('[data-card-uid="genetic-all-hand"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'shapeshifters_genetic_shift_choose'
        && optionIds.includes('all-own-minions')
        && optionIds.includes('mine-a')
        && optionIds.includes('mine-b')
        && !optionIds.includes('enemy-a');
    }, {
      message: 'Genetic Shift 无目标真实入口应弹出模式选择，且单体候选只包含己方随从',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '你的所有仆从 +1' })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="mine-a"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="mine-b"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="enemy-a"]')).toBeHidden({ timeout: 15000 });
    await game.screenshot('yuanhou-genetic-shift-mode-choice-prompt', testInfo);

    await page.getByRole('button', { name: '你的所有仆从 +1' }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      const mineA = minions.find((minion: any) => minion.uid === 'mine-a');
      const mineB = minions.find((minion: any) => minion.uid === 'mine-b');
      const enemy = minions.find((minion: any) => minion.uid === 'enemy-a');
      return state?.sys?.interaction?.current == null
        && mineA?.tempPowerModifier === 1
        && mineB?.tempPowerModifier === 1
        && (enemy?.tempPowerModifier ?? 0) === 0;
    }, {
      message: 'Genetic Shift 选择全体模式后应只给自己的所有随从 +1',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-genetic-shift-all-own-minions-plus-one', testInfo);

    await setupGeneticShiftScene('genetic-single-hand');
    await page.locator('[data-card-uid="genetic-single-hand"]').click();
    await page.locator('[data-card-uid="genetic-single-hand"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'shapeshifters_genetic_shift_choose'
        && optionIds.includes('mine-a')
        && optionIds.includes('mine-b')
        && !optionIds.includes('enemy-a');
    }, {
      message: 'Genetic Shift 第二轮场景仍应只列己方单体候选',
      timeout: 15000,
    }).toBe(true);

    await page.locator('[data-option-id="mine-b"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      const mineA = minions.find((minion: any) => minion.uid === 'mine-a');
      const mineB = minions.find((minion: any) => minion.uid === 'mine-b');
      const enemy = minions.find((minion: any) => minion.uid === 'enemy-a');
      return state?.sys?.interaction?.current == null
        && (mineA?.tempPowerModifier ?? 0) === 0
        && mineB?.tempPowerModifier === 3
        && (enemy?.tempPowerModifier ?? 0) === 0;
    }, {
      message: 'Genetic Shift 选择单体模式后应只给被选己方随从 +3',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-genetic-shift-single-own-minion-plus-three', testInfo);
  });

  test('电子猿-Monkey See Monkey Do-真实入口可从展示顶五中多选行动入手并洗回其余', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
              hand: [{ uid: 'monkey-see-hand', defId: 'cyborg_apes_monkey_see_monkey_do', type: 'action', owner: '0' }],
              deck: [
                { uid: 'deck-action-a', defId: 'cyborg_apes_going_bananas', type: 'action', owner: '0' },
                { uid: 'deck-minion-a', defId: 'cyborg_apes_baboom', type: 'minion', owner: '0' },
                { uid: 'deck-action-b', defId: 'cyborg_apes_juiced_up', type: 'action', owner: '0' },
                { uid: 'deck-minion-b', defId: 'shapeshifters_gelf', type: 'minion', owner: '0' },
                { uid: 'deck-action-c', defId: 'shapeshifters_genetic_shift', type: 'action', owner: '0' },
                { uid: 'deck-tail', defId: 'cyborg_apes_baboom', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['cyborg_apes'],
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
              factions: ['shapeshifters'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            { defId: 'base_monkey_lab', breakpoint: 20, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_the_vats'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="monkey-see-hand"]').click();
    await page.locator('[data-card-uid="monkey-see-hand"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'cyborg_apes_monkey_see_monkey_do_choose'
        && optionIds.includes('deck-action-a')
        && optionIds.includes('deck-action-b')
        && optionIds.includes('deck-action-c')
        && !optionIds.includes('deck-minion-a')
        && !optionIds.includes('deck-minion-b')
        && prompt?.data?.multi?.min === 0;
    }, {
      message: 'Monkey See Monkey Do 应展示顶五后只把其中行动牌列为可多选候选',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-option-id="deck-action-a"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="deck-action-b"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="deck-action-c"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="deck-minion-a"]')).toBeHidden({ timeout: 15000 });
    await game.screenshot('yuanhou-monkey-see-action-choice-prompt', testInfo);

    await page.locator('[data-option-id="deck-action-b"]').click();
    await game.screenshot('yuanhou-monkey-see-selected-action-before-confirm', testInfo);
    await page.getByRole('button', { name: /确认/ }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      const hand = state?.core?.players?.['0']?.hand ?? [];
      const deck = state?.core?.players?.['0']?.deck ?? [];
      const discard = state?.core?.players?.['0']?.discard ?? [];
      return state?.sys?.interaction?.current == null
        && hasUid(hand, 'deck-action-b')
        && !hasUid(deck, 'deck-action-b')
        && hasUid(deck, 'deck-action-a')
        && hasUid(deck, 'deck-action-c')
        && hasUid(discard, 'monkey-see-hand');
    }, {
      message: 'Monkey See Monkey Do 选择行动后应将该行动入手、其余展示牌洗回牌库，并让本行动进弃牌',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-monkey-see-selected-action-drawn-and-rest-shuffled', testInfo);
  });

  test('电子猿-Monkey See Monkey Do-真实入口空选行动后应直接收口且不把任何展示行动加入手牌', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
              hand: [{ uid: 'monkey-see-empty-hand', defId: 'cyborg_apes_monkey_see_monkey_do', type: 'action', owner: '0' }],
              deck: [
                { uid: 'empty-deck-action-a', defId: 'cyborg_apes_going_bananas', type: 'action', owner: '0' },
                { uid: 'empty-deck-minion-a', defId: 'cyborg_apes_baboom', type: 'minion', owner: '0' },
                { uid: 'empty-deck-action-b', defId: 'cyborg_apes_juiced_up', type: 'action', owner: '0' },
                { uid: 'empty-deck-minion-b', defId: 'shapeshifters_gelf', type: 'minion', owner: '0' },
                { uid: 'empty-deck-action-c', defId: 'shapeshifters_genetic_shift', type: 'action', owner: '0' },
                { uid: 'empty-deck-tail', defId: 'cyborg_apes_baboom', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['cyborg_apes'],
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
              factions: ['shapeshifters'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            { defId: 'base_monkey_lab', breakpoint: 20, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_the_vats'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="monkey-see-empty-hand"]').click();
    await page.locator('[data-card-uid="monkey-see-empty-hand"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'cyborg_apes_monkey_see_monkey_do_choose'
        && optionIds.includes('empty-deck-action-a')
        && optionIds.includes('empty-deck-action-b')
        && optionIds.includes('empty-deck-action-c')
        && !optionIds.includes('empty-deck-minion-a')
        && !optionIds.includes('empty-deck-minion-b')
        && prompt?.data?.multi?.min === 0;
    }, {
      message: 'Monkey See Monkey Do 的真实多选 prompt 应允许空选 0 张行动，并且只列展示出的行动候选',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-option-id="empty-deck-action-a"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="empty-deck-action-b"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="empty-deck-action-c"]')).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-monkey-see-empty-select-action-prompt', testInfo);

    await page.getByRole('button', { name: /确认选择|确认(?:\(0\))?/ }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      const hand = state?.core?.players?.['0']?.hand ?? [];
      const deck = state?.core?.players?.['0']?.deck ?? [];
      const discard = state?.core?.players?.['0']?.discard ?? [];
      return state?.sys?.interaction?.current == null
        && !hasUid(hand, 'empty-deck-action-a')
        && !hasUid(hand, 'empty-deck-action-b')
        && !hasUid(hand, 'empty-deck-action-c')
        && hasUid(deck, 'empty-deck-action-a')
        && hasUid(deck, 'empty-deck-action-b')
        && hasUid(deck, 'empty-deck-action-c')
        && hasUid(deck, 'empty-deck-minion-a')
        && hasUid(deck, 'empty-deck-minion-b')
        && hasUid(deck, 'empty-deck-tail')
        && deck.length === 6
        && hasUid(discard, 'monkey-see-empty-hand');
    }, {
      message: 'Monkey See Monkey Do 空选 0 张后应直接收口，不把任何展示行动加入手牌，并把本行动进弃牌',
      timeout: 15000,
    }).toBe(true);

    await dismissSmashUpSpotlightQueueIfVisible(page);
    await expect(page.getByRole('button', { name: /确认/ })).toBeHidden({ timeout: 15000 });
    await game.screenshot('yuanhou-monkey-see-empty-select-resolved-without-drawing-actions', testInfo);
  });

  test('电子猿-Monkey See Monkey Do-展示顶五没有行动时真实入口不创建选择 prompt并进入展示队列', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
              hand: [{ uid: 'monkey-see-no-action-hand', defId: 'cyborg_apes_monkey_see_monkey_do', type: 'action', owner: '0' }],
              deck: [
                { uid: 'no-action-deck-a', defId: 'cyborg_apes_baboom', type: 'minion', owner: '0' },
                { uid: 'no-action-deck-b', defId: 'shapeshifters_gelf', type: 'minion', owner: '0' },
                { uid: 'no-action-deck-c', defId: 'sharks_mako', type: 'minion', owner: '0' },
                { uid: 'no-action-deck-d', defId: 'sharks_hammerhead', type: 'minion', owner: '0' },
                { uid: 'no-action-deck-e', defId: 'shapeshifters_mimic', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['cyborg_apes'],
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
              factions: ['shapeshifters'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            { defId: 'base_monkey_lab', breakpoint: 20, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_the_vats'],
          baseDiscard: [],
        },
      },
    });

    await game.screenshot('yuanhou-monkey-see-no-action-before-play', testInfo);
    await page.locator('[data-card-uid="monkey-see-no-action-hand"]').click();
    await page.locator('[data-card-uid="monkey-see-no-action-hand"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const hand = state?.core?.players?.['0']?.hand ?? [];
      const deck = state?.core?.players?.['0']?.deck ?? [];
      const discard = state?.core?.players?.['0']?.discard ?? [];
      return state?.sys?.interaction?.current == null
        && hand.length === 0
        && !hasUid(hand, 'no-action-deck-a')
        && !hasUid(hand, 'no-action-deck-b')
        && !hasUid(hand, 'no-action-deck-c')
        && !hasUid(hand, 'no-action-deck-d')
        && !hasUid(hand, 'no-action-deck-e')
        && hasUid(deck, 'no-action-deck-a')
        && hasUid(deck, 'no-action-deck-b')
        && hasUid(deck, 'no-action-deck-c')
        && hasUid(deck, 'no-action-deck-d')
        && hasUid(deck, 'no-action-deck-e')
        && deck.length === 5
        && hasUid(discard, 'monkey-see-no-action-hand');
    }, {
      message: 'Monkey See Monkey Do 展示顶五没有行动时，应不创建行动选择 prompt，且不把任何展示牌加入手牌',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-option-id^="no-action-deck-"]')).toHaveCount(0);
    await game.screenshot('yuanhou-monkey-see-no-action-auto-revealed-without-choice-prompt', testInfo);
  });

  test('变形者-GELF-真实入口天赋将自身洗回牌库并可从牌库额外打出合格随从', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
                { uid: 'gelf-candidate-a', defId: 'shapeshifters_copycat', type: 'minion', owner: '0' },
                { uid: 'gelf-candidate-b', defId: 'shapeshifters_mimic', type: 'minion', owner: '0' },
                { uid: 'gelf-too-big', defId: 'shapeshifters_doppelganger', type: 'minion', owner: '0' },
                { uid: 'gelf-deck-copy', defId: 'shapeshifters_gelf', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['shapeshifters'],
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
              factions: ['cyborg_apes'],
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
                uid: 'gelf-talent-source',
                defId: 'shapeshifters_gelf',
                controller: '0',
                owner: '0',
                basePower: 4,
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

    await page.locator('[data-minion-uid="gelf-talent-source"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      const deck = state?.core?.players?.['0']?.deck ?? [];
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'shapeshifters_gelf_search'
        && !hasUid(minions, 'gelf-talent-source')
        && hasUid(deck, 'gelf-talent-source')
        && optionIds.includes('gelf-candidate-a')
        && optionIds.includes('gelf-candidate-b')
        && !optionIds.includes('gelf-too-big')
        && !optionIds.includes('gelf-deck-copy')
        && hasSkipOption(prompt?.data?.options);
    }, {
      message: 'G.E.L.F. 天赋应先把自身洗回牌库，并只展示非 G.E.L.F. 且力量 4 或以下的牌库随从候选',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-option-id="gelf-candidate-a"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="gelf-candidate-b"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="gelf-too-big"]')).toBeHidden({ timeout: 15000 });
    await expect(page.locator('[data-option-id="gelf-deck-copy"]')).toBeHidden({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /跳过搜寻|放弃这次选择/ })).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-gelf-talent-deck-search-prompt', testInfo);

    await page.locator('[data-option-id="gelf-candidate-b"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      const deck = state?.core?.players?.['0']?.deck ?? [];
      return state?.sys?.interaction?.current == null
        && !hasUid(minions, 'gelf-talent-source')
        && hasUid(minions, 'gelf-candidate-b')
        && hasUid(deck, 'gelf-talent-source')
        && !hasUid(deck, 'gelf-candidate-b');
    }, {
      message: 'G.E.L.F. 选择候选后应直接把该随从额外打到原基地，自身留在牌库且不残留 prompt',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '放弃这次额外随从' })).toBeHidden({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="gelf-candidate-b"]')).toBeVisible({ timeout: 15000 });

    await game.screenshot('yuanhou-gelf-selected-minion-played-after-talent', testInfo);
  });

  test('变形者-GELF-真实入口跳过搜寻后应直接收口且不额外打出候选随从', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
                { uid: 'gelf-skip-candidate-a', defId: 'shapeshifters_copycat', type: 'minion', owner: '0' },
                { uid: 'gelf-skip-candidate-b', defId: 'shapeshifters_mimic', type: 'minion', owner: '0' },
                { uid: 'gelf-skip-too-big', defId: 'shapeshifters_doppelganger', type: 'minion', owner: '0' },
                { uid: 'gelf-skip-deck-copy', defId: 'shapeshifters_gelf', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['shapeshifters'],
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
              factions: ['cyborg_apes'],
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
                uid: 'gelf-skip-source',
                defId: 'shapeshifters_gelf',
                controller: '0',
                owner: '0',
                basePower: 4,
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

    await page.locator('[data-minion-uid="gelf-skip-source"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      const deck = state?.core?.players?.['0']?.deck ?? [];
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'shapeshifters_gelf_search'
        && !hasUid(minions, 'gelf-skip-source')
        && hasUid(deck, 'gelf-skip-source')
        && optionIds.includes('gelf-skip-candidate-a')
        && optionIds.includes('gelf-skip-candidate-b')
        && !optionIds.includes('gelf-skip-too-big')
        && !optionIds.includes('gelf-skip-deck-copy')
        && hasSkipOption(prompt?.data?.options);
    }, {
      message: 'G.E.L.F. 天赋真实入口应在把自身洗回牌库后进入带 skip 的牌库搜索 prompt',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-option-id="gelf-skip-candidate-a"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="gelf-skip-candidate-b"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="gelf-skip-too-big"]')).toBeHidden({ timeout: 15000 });
    await expect(page.locator('[data-option-id="gelf-skip-deck-copy"]')).toBeHidden({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /跳过搜寻|放弃这次选择/ })).toBeVisible({ timeout: 15000 });

    await game.screenshot('yuanhou-gelf-talent-skip-search-prompt', testInfo);

    await game.selectInteractionOptionBy((option) => option?.value?.skip === true, 'G.E.L.F. 天赋搜索 skip');

    await expect.poll(async () => {
      const state = await game.getState();
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      const deck = state?.core?.players?.['0']?.deck ?? [];
      const hand = state?.core?.players?.['0']?.hand ?? [];
      return state?.sys?.interaction?.current == null
        && minions.length === 0
        && hand.length === 0
        && hasUid(deck, 'gelf-skip-source')
        && hasUid(deck, 'gelf-skip-candidate-a')
        && hasUid(deck, 'gelf-skip-candidate-b')
        && hasUid(deck, 'gelf-skip-too-big')
        && hasUid(deck, 'gelf-skip-deck-copy');
    }, {
      message: 'G.E.L.F. 真实点击 skip 后，应直接收口且不把任何候选额外打回原基地',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '放弃这次额外随从' })).toBeHidden({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="gelf-skip-candidate-a"]')).toBeHidden({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="gelf-skip-candidate-b"]')).toBeHidden({ timeout: 15000 });

    await game.screenshot('yuanhou-gelf-talent-skip-search-resolved', testInfo);
  });

  test('变形者-Splice as Nice-真实入口会附着到目标随从并给予持续 +2 力量', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
                { uid: 'splice-hand', defId: 'shapeshifters_splice_as_nice', type: 'action', owner: '0' },
              ],
              deck: [],
              discard: [],
              factions: ['shapeshifters', 'time_travelers'],
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
              factions: ['cyborg_apes'],
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
                uid: 'splice-host',
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
              }],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    const spliceHost = page.locator('[data-minion-uid="splice-host"]');
    await expect(spliceHost).toBeVisible({ timeout: 15000 });
    await screenshotLocator(spliceHost, 'yuanhou-splice-as-nice-host-before-attach', testInfo);

    await page.locator('[data-card-uid="splice-hand"]').click();
    await spliceHost.click();

    await expect.poll(async () => {
      const state = await game.getState();
      const host = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'splice-host');
      return state?.sys?.interaction?.current == null
        && host?.attachedActions?.some((action: any) => action?.uid === 'splice-hand')
        && !hasUid(state?.core?.players?.['0']?.hand, 'splice-hand');
    }, {
      message: 'Splice as Nice 从手牌真实打出后，应附着到所选宿主随从且不再留在手牌',
      timeout: 15000,
    }).toBe(true);

    const splicePowerBadge = page.locator('[data-minion-uid="splice-host"] [title*="拼接很美子: +2"]');
    await expect(splicePowerBadge).toBeVisible({ timeout: 15000 });
    await expect(splicePowerBadge).toHaveText('+2');
    await screenshotLocator(spliceHost, 'yuanhou-splice-as-nice-host-after-attach-plus-two', testInfo);
  });

  test('变形者-Mimic-真实入口只跟随场上最高印刷力量并在真正 5 力随从进场后动态跳到 +5', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
                { uid: 'mimic-real-five-hand', defId: 'sharks_megalodon', type: 'minion', owner: '0' },
              ],
              deck: [],
              discard: [],
              factions: ['shapeshifters', 'sharks', 'cyborg_apes'],
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
              factions: ['sharks', 'cyborg_apes'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_the_vats',
              breakpoint: 30,
              minions: [
                {
                  uid: 'mimic-host',
                  defId: 'shapeshifters_mimic',
                  controller: '0',
                  owner: '0',
                  basePower: 0,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'mimic-boosted-two',
                  defId: 'sharks_mako',
                  controller: '1',
                  owner: '1',
                  basePower: 2,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [
                    { uid: 'mimic-boosted-evo', defId: 'cyborg_apes_cyberevolution', ownerId: '1' },
                  ],
                },
              ],
              ongoingActions: [],
            },
            {
              defId: 'base_portal_room',
              breakpoint: 22,
              minions: [],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    const mimicBase = page.getByTestId('base-zone-0');
    const mimicPlusTwoBadge = page.locator('[data-minion-uid="mimic-host"] [title*="变形者: +2"]');
    const boostedPlusThreeBadge = page.locator('[data-minion-uid="mimic-boosted-two"] [title*="电子进化: +3"]');
    await expect(mimicBase).toBeVisible({ timeout: 15000 });
    await expect(mimicPlusTwoBadge).toBeVisible({ timeout: 15000 });
    await expect(mimicPlusTwoBadge).toHaveText('+2');
    await expect(boostedPlusThreeBadge).toBeVisible({ timeout: 15000 });
    await expect(boostedPlusThreeBadge).toHaveText('+3');
    await screenshotViewport(page, 'yuanhou-mimic-printed-power-before-real-five-enters', testInfo);

    await page.locator('[data-card-uid="mimic-real-five-hand"]').click();
    await page.getByTestId('base-zone-1').click({ force: true });

    await expect.poll(async () => {
      const state = await game.getState();
      return state?.sys?.interaction?.current == null
        && hasUid(state?.core?.bases?.[1]?.minions, 'mimic-real-five-hand')
        && !hasUid(state?.core?.players?.['0']?.hand, 'mimic-real-five-hand');
    }, {
      message: '真正印刷 5 力的 Megalodon 从手牌真实进场后，应留在第二个基地上且不再停留在手牌',
      timeout: 15000,
    }).toBe(true);

    const mimicPlusFiveBadge = page.locator('[data-minion-uid="mimic-host"] [title*="变形者: +5"]');
    await expect(mimicPlusFiveBadge).toBeVisible({ timeout: 15000 });
    await expect(mimicPlusFiveBadge).toHaveText('+5');
    await screenshotViewport(page, 'yuanhou-mimic-printed-power-after-real-five-enters', testInfo);
  });

  test('变形者基地-Faceless City-真实入口只剩一个同名候选时应自动加入手牌且不弹搜寻 prompt', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
                { uid: 'faceless-single-played', defId: 'sharks_mako', type: 'minion', owner: '0' },
              ],
              deck: [
                { uid: 'same-only', defId: 'sharks_mako', type: 'minion', owner: '0' },
                { uid: 'other-card', defId: 'sharks_hammerhead', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['shapeshifters', 'sharks'],
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
              factions: ['sharks'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_faceless_city',
              breakpoint: 20,
              minions: [],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_the_vats'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="faceless-single-played"]').click();
    await page.getByTestId('base-zone-0').click({ force: true });

    await expect.poll(async () => {
      const state = await game.getState();
      const hand = state?.core?.players?.['0']?.hand ?? [];
      const deck = state?.core?.players?.['0']?.deck ?? [];
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      return state?.sys?.interaction?.current == null
        && hasUid(hand, 'same-only')
        && !hasUid(deck, 'same-only')
        && deck.map((card: any) => card?.uid).join(',') === 'other-card'
        && hasUid(minions, 'faceless-single-played');
    }, {
      message: 'Faceless City 真实入口只剩一个同名候选时，应自动把 same-only 加入手牌并保持无 prompt 收口',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByText('无面之城：选择是否搜寻同名随从加入手牌')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '跳过搜寻' })).toHaveCount(0);
    await screenshotViewport(page, 'yuanhou-faceless-city-single-candidate-auto-added-without-prompt', testInfo);
  });

  test('变形者基地-Faceless City-真实入口会列出同名随从候选并将所选牌加入手牌', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
                { uid: 'faceless-played', defId: 'sharks_mako', type: 'minion', owner: '0' },
              ],
              deck: [
                { uid: 'same-a', defId: 'sharks_mako', type: 'minion', owner: '0' },
                { uid: 'other-card', defId: 'sharks_hammerhead', type: 'minion', owner: '0' },
                { uid: 'same-b', defId: 'sharks_mako', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['shapeshifters', 'sharks'],
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
              factions: ['sharks'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_faceless_city',
              breakpoint: 20,
              minions: [],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_the_vats'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="faceless-played"]').click();
    await page.getByTestId('base-zone-0').click({ force: true });

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'base_faceless_city_choose'
        && optionIds.includes('same-a')
        && optionIds.includes('same-b')
        && !optionIds.includes('other-card')
        && optionIds.some((optionId: string) => optionId?.includes('skip'));
    }, {
      message: 'Faceless City 在真实打出同名随从后，应弹出只列同名 deck 候选并允许 skip 的搜索 prompt',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-option-id="same-a"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="same-b"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="other-card"]')).toBeHidden({ timeout: 15000 });
    await expect(page.getByRole('button', { name: '跳过搜寻' })).toBeVisible({ timeout: 15000 });
    await screenshotViewport(page, 'yuanhou-faceless-city-same-name-choice-prompt', testInfo);

    await page.locator('[data-option-id="same-b"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const hand = state?.core?.players?.['0']?.hand ?? [];
      const deck = state?.core?.players?.['0']?.deck ?? [];
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      return state?.sys?.interaction?.current == null
        && hasUid(hand, 'same-b')
        && !hasUid(deck, 'same-b')
        && deck.map((card: any) => card?.uid).join(',') === 'same-a,other-card'
        && hasUid(minions, 'faceless-played');
    }, {
      message: 'Faceless City 选择非第一张同名候选后，应把 same-b 加入手牌、把它从牌库移出，并让剩余牌库按测试随机源保持 same-a,other-card',
      timeout: 15000,
    }).toBe(true);

    await screenshotViewport(page, 'yuanhou-faceless-city-selected-same-name-added-to-hand', testInfo);
  });

  test('变形者基地-Faceless City-真实入口跳过搜寻后应直接收口并保留原牌库顺序', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
                { uid: 'faceless-skip-played', defId: 'sharks_mako', type: 'minion', owner: '0' },
              ],
              deck: [
                { uid: 'same-skip-a', defId: 'sharks_mako', type: 'minion', owner: '0' },
                { uid: 'other-skip-card', defId: 'sharks_hammerhead', type: 'minion', owner: '0' },
                { uid: 'same-skip-b', defId: 'sharks_mako', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['shapeshifters', 'sharks'],
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
              factions: ['sharks'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_faceless_city',
              breakpoint: 20,
              minions: [],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_the_vats'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="faceless-skip-played"]').click();
    await page.getByTestId('base-zone-0').click({ force: true });

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'base_faceless_city_choose'
        && optionIds.includes('same-skip-a')
        && optionIds.includes('same-skip-b')
        && !optionIds.includes('other-skip-card')
        && optionIds.some((optionId: string) => optionId?.includes('skip'));
    }, {
      message: 'Faceless City 多候选同名搜索 prompt 应提供真实 skip 入口，并且不暴露非同名牌',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '跳过搜寻' })).toBeVisible({ timeout: 15000 });
    await screenshotViewport(page, 'yuanhou-faceless-city-same-name-skip-prompt', testInfo);
    await page.getByRole('button', { name: '跳过搜寻' }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      const hand = state?.core?.players?.['0']?.hand ?? [];
      const deck = state?.core?.players?.['0']?.deck ?? [];
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      return state?.sys?.interaction?.current == null
        && hand.length === 0
        && deck.map((card: any) => card?.uid).join(',') === 'same-skip-a,other-skip-card,same-skip-b'
        && hasUid(minions, 'faceless-skip-played');
    }, {
      message: 'Faceless City 真实点击 skip 后，应直接收口、不加入手牌，并保持原牌库顺序',
      timeout: 15000,
    }).toBe(true);

    await screenshotViewport(page, 'yuanhou-faceless-city-same-name-skip-resolved', testInfo);
  });

  test('变形者基地-Faceless City-真实入口没有同名候选时不应创建搜寻 prompt且牌库保持不变', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
                { uid: 'faceless-no-match-played', defId: 'sharks_mako', type: 'minion', owner: '0' },
              ],
              deck: [
                { uid: 'other-a', defId: 'sharks_hammerhead', type: 'minion', owner: '0' },
                { uid: 'other-b', defId: 'sharks_tiger_shark', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['shapeshifters', 'sharks'],
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
              factions: ['sharks'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_faceless_city',
              breakpoint: 20,
              minions: [],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_the_vats'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="faceless-no-match-played"]').click();
    await page.getByTestId('base-zone-0').click({ force: true });

    await expect.poll(async () => {
      const state = await game.getState();
      const hand = state?.core?.players?.['0']?.hand ?? [];
      const deck = state?.core?.players?.['0']?.deck ?? [];
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      return state?.sys?.interaction?.current == null
        && hand.length === 0
        && deck.map((card: any) => card?.uid).join(',') === 'other-a,other-b'
        && hasUid(minions, 'faceless-no-match-played');
    }, {
      message: 'Faceless City 真实入口没有同名候选时，不应创建搜寻 prompt，且牌库保持 other-a,other-b 不变',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByText('无面之城：选择是否搜寻同名随从加入手牌')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '跳过搜寻' })).toHaveCount(0);
    await screenshotViewport(page, 'yuanhou-faceless-city-no-match-no-prompt', testInfo);
  });

  test('变形者基地-The Vats-真实入口会把同名随从所在基地置灰并只允许打到别的基地', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
                { uid: 'vats-mako-hand', defId: 'sharks_mako', type: 'minion', owner: '0' },
              ],
              deck: [],
              discard: [],
              factions: ['sharks', 'shapeshifters'],
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
              factions: ['sharks'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_the_vats',
              breakpoint: 15,
              minions: [
                {
                  uid: 'vats-existing-mako',
                  defId: 'sharks_mako',
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
              defId: 'base_portal_room',
              breakpoint: 20,
              minions: [],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    await game.waitForPhase('playCards', 10000);
    await expect(page.locator('[data-card-uid="vats-mako-hand"]')).toBeVisible({ timeout: 15000 });

    await page.locator('[data-card-uid="vats-mako-hand"]').click();

    const theVatsBase = page.getByTestId('base-zone-0');
    const portalRoomBase = page.getByTestId('base-zone-1');
    await expect(theVatsBase).toHaveClass(/cursor-not-allowed/);
    await expect(portalRoomBase).not.toHaveClass(/cursor-not-allowed/);
    await screenshotViewport(page, 'yuanhou-the-vats-same-name-base-blocked-other-base-still-legal', testInfo);

    await theVatsBase.click({ force: true });
    await expect(page.getByText('该基地不可选择')).toBeVisible({ timeout: 15000 });

    await expect.poll(async () => {
      const state = await game.getState();
      return hasUid(state?.core?.players?.['0']?.hand, 'vats-mako-hand')
        && !hasUid(state?.core?.bases?.[0]?.minions, 'vats-mako-hand')
        && !hasUid(state?.core?.bases?.[1]?.minions, 'vats-mako-hand');
    }, {
      message: 'The Vats 的同名限制应阻止同名 Mako 被打到这里，点击受限基地后也不应偷偷进场',
      timeout: 15000,
    }).toBe(true);

    await portalRoomBase.click({ force: true });

    await expect.poll(async () => {
      const state = await game.getState();
      return state?.sys?.interaction?.current == null
        && !hasUid(state?.core?.players?.['0']?.hand, 'vats-mako-hand')
        && !hasUid(state?.core?.bases?.[0]?.minions, 'vats-mako-hand')
        && hasUid(state?.core?.bases?.[1]?.minions, 'vats-mako-hand');
    }, {
      message: '被 The Vats 限制的同名 Mako 仍应能通过真实入口正常打到另一基地并完成收口',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByText('该基地不可选择')).toBeHidden({ timeout: 15000 });
    await expect(page.locator('[data-card-uid="vats-mako-hand"]')).toBeHidden({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="vats-mako-hand"]')).toBeVisible({ timeout: 15000 });
    await screenshotViewport(page, 'yuanhou-the-vats-same-name-minion-played-to-other-base', testInfo);
  });

  test('电子猿-Cyberevolution-真实入口会附着到目标随从并给予持续 +3 力量', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
                { uid: 'evo-hand', defId: 'cyborg_apes_cyberevolution', type: 'action', owner: '0' },
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
              factions: ['shapeshifters'],
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
                uid: 'evo-host',
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
              }],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    const evoHost = page.locator('[data-minion-uid="evo-host"]');
    await expect(evoHost).toBeVisible({ timeout: 15000 });
    await screenshotLocator(evoHost, 'yuanhou-cyberevolution-host-before-attach', testInfo);

    await page.locator('[data-card-uid="evo-hand"]').click();
    await evoHost.click();

    await expect.poll(async () => {
      const state = await game.getState();
      const host = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'evo-host');
      return state?.sys?.interaction?.current == null
        && host?.attachedActions?.some((action: any) => action?.uid === 'evo-hand')
        && !hasUid(state?.core?.players?.['0']?.hand, 'evo-hand');
    }, {
      message: 'Cyberevolution 从手牌真实打出后，应附着到所选宿主随从且不再留在手牌',
      timeout: 15000,
    }).toBe(true);

    const evoPowerBadge = page.locator('[data-minion-uid="evo-host"] [title*="电子进化: +3"]');
    await expect(evoPowerBadge).toBeVisible({ timeout: 15000 });
    await expect(evoPowerBadge).toHaveText('+3');
    await screenshotLocator(evoHost, 'yuanhou-cyberevolution-host-after-attach-plus-three', testInfo);
  });

  test('电子猿-Juiced Up-真实入口会按宿主全部附着行动数量给予持续 +2 倍增', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
                { uid: 'juice-hand', defId: 'cyborg_apes_juiced_up', type: 'action', owner: '0' },
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
              factions: ['shapeshifters'],
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
                uid: 'juice-host',
                defId: 'time_travelers_jumper',
                controller: '0',
                owner: '0',
                basePower: 2,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [
                  { uid: 'juice-existing', defId: 'cyborg_apes_missing_uplink', ownerId: '0' },
                ],
              }],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    const juiceHost = page.locator('[data-minion-uid="juice-host"]');
    await expect(juiceHost).toBeVisible({ timeout: 15000 });
    await screenshotLocator(juiceHost, 'yuanhou-juiced-up-host-before-attach', testInfo);

    await page.locator('[data-card-uid="juice-hand"]').click();
    await juiceHost.click();

    await expect.poll(async () => {
      const state = await game.getState();
      const host = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'juice-host');
      return state?.sys?.interaction?.current == null
        && host?.attachedActions?.some((action: any) => action?.uid === 'juice-hand')
        && host?.attachedActions?.length === 2
        && !hasUid(state?.core?.players?.['0']?.hand, 'juice-hand');
    }, {
      message: 'Juiced Up 从手牌真实打出后，应附着到所选宿主随从，并把宿主附着行动总数变成 2',
      timeout: 15000,
    }).toBe(true);

    const juicePowerBadge = page.locator('[data-minion-uid="juice-host"] [title*="兴奋剂: +4"]');
    await expect(juicePowerBadge).toBeVisible({ timeout: 15000 });
    await expect(juicePowerBadge).toHaveText('+4');
    await screenshotLocator(juiceHost, 'yuanhou-juiced-up-host-after-attach-plus-four', testInfo);
  });

  test('电子猿基地-猴子实验室-真实入口会按每个随从自己的附着行动数量持续加力量', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
                { uid: 'lab-hand', defId: 'cyborg_apes_missing_uplink', type: 'action', owner: '0' },
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
              factions: ['super_spies'],
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
              minions: [{
                uid: 'lab-host',
                defId: 'time_travelers_jumper',
                controller: '0',
                owner: '0',
                basePower: 2,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [
                  { uid: 'lab-existing', defId: 'cyborg_apes_missing_uplink', ownerId: '0' },
                ],
              }],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    const labHost = page.locator('[data-minion-uid="lab-host"]');
    const labPowerBefore = page.locator('[data-minion-uid="lab-host"] [title*="base_monkey_lab: +1"]');
    await expect(labHost).toBeVisible({ timeout: 15000 });
    await expect(labPowerBefore).toBeVisible({ timeout: 15000 });
    await expect(labPowerBefore).toHaveText('+1');
    await screenshotLocator(labHost, 'yuanhou-monkey-lab-host-before-second-attach', testInfo);

    await page.locator('[data-card-uid="lab-hand"]').click();
    await labHost.click();

    await expect.poll(async () => {
      const state = await game.getState();
      const host = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'lab-host');
      return state?.sys?.interaction?.current == null
        && host?.attachedActions?.some((action: any) => action?.uid === 'lab-hand')
        && host?.attachedActions?.length === 2
        && !hasUid(state?.core?.players?.['0']?.hand, 'lab-hand');
    }, {
      message: '猴子实验室上的宿主在真实再附着 1 张行动后，应把该随从自己的附着行动总数变成 2 且流程收口',
      timeout: 15000,
    }).toBe(true);

    const labPowerAfter = page.locator('[data-minion-uid="lab-host"] [title*="base_monkey_lab: +2"]');
    await expect(labPowerAfter).toBeVisible({ timeout: 15000 });
    await expect(labPowerAfter).toHaveText('+2');
    await screenshotLocator(labHost, 'yuanhou-monkey-lab-host-after-second-attach-plus-two', testInfo);
  });

  test('电子猿-Furious George-真实入口会按自己身上的行动数量给予持续 +1 叠加', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
                { uid: 'furious-hand', defId: 'cyborg_apes_missing_uplink', type: 'action', owner: '0' },
              ],
              deck: [],
              discard: [],
              factions: ['cyborg_apes', 'shapeshifters'],
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
              defId: 'base_the_vats',
              breakpoint: 18,
              minions: [{
                uid: 'furious-host',
                defId: 'cyborg_apes_furious_george',
                controller: '0',
                owner: '0',
                basePower: 2,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [
                  { uid: 'furious-existing', defId: 'cyborg_apes_shielding', ownerId: '0' },
                ],
              }],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    const furiousHost = page.locator('[data-minion-uid="furious-host"]');
    await expect(furiousHost).toBeVisible({ timeout: 15000 });
    await screenshotLocator(furiousHost, 'yuanhou-furious-george-before-attach', testInfo);

    await page.locator('[data-card-uid="furious-hand"]').click();
    await furiousHost.click();

    await expect.poll(async () => {
      const state = await game.getState();
      const host = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'furious-host');
      return state?.sys?.interaction?.current == null
        && host?.attachedActions?.some((action: any) => action?.uid === 'furious-hand')
        && host?.attachedActions?.length === 2
        && !hasUid(state?.core?.players?.['0']?.hand, 'furious-hand');
    }, {
      message: 'Furious George 宿主在自己身上第二张行动真实附着后，应把自身 attachedActions 总数变成 2',
      timeout: 15000,
    }).toBe(true);

    const furiousPowerBadge = page.locator('[data-minion-uid="furious-host"] [title*="狂怒的乔治: +2"]');
    await expect(furiousPowerBadge).toBeVisible({ timeout: 15000 });
    await expect(furiousPowerBadge).toHaveText('+2');
    await screenshotLocator(furiousHost, 'yuanhou-furious-george-after-attach-plus-two', testInfo);
  });

  test('电子猿-Baboom-真实天赋给出可跳过的立即额外行动并只能打到自己身上', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
                { uid: 'baboom-boost-hand', defId: 'cyborg_apes_cyberevolution', type: 'action', owner: '0' },
                { uid: 'baboom-base-action-hand', defId: 'cyborg_apes_going_bananas', type: 'action', owner: '0' },
              ],
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
              defId: 'base_monkey_lab',
              breakpoint: 20,
              minions: [
                {
                  uid: 'baboom-other-minion',
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
                  uid: 'baboom-talent-source',
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

    await page.locator('[data-minion-uid="baboom-talent-source"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionCardUids = (prompt?.data?.options ?? [])
        .map((option: { value?: { cardUid?: unknown } }) => option?.value?.cardUid)
        .filter((uid: unknown): uid is string => typeof uid === 'string');
      return prompt?.data?.sourceId === 'smashup_immediate_extra_action'
        && prompt?.playerId === '0'
        && hasSkipOption(prompt?.data?.options)
        && optionCardUids.includes('baboom-boost-hand')
        && !optionCardUids.includes('baboom-base-action-hand');
    }, {
      message: 'Baboom 天赋应创建可跳过的 immediate extra action prompt，且只列能打到本仆从上的行动',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '放弃这次额外战术' })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-card-uid="baboom-boost-hand"]')).toBeVisible({ timeout: 15000 });
    await expectOwnedOverlayPromptChromeSuppressed(page);
    await expectDeferredExtraGrantToastSuppressed(page, 'action');
    await game.screenshot('yuanhou-baboom-extra-action-prompt-with-skip', testInfo);

    await game.selectInteractionOptionBy(
      (option) => option?.value?.cardUid === 'baboom-boost-hand',
      'Baboom immediate extra action selects Cyberevolution',
    );

    await expect.poll(async () => {
      const state = await game.getState();
      const minions = (state?.core?.bases?.[0]?.minions ?? []) as Array<{ uid?: unknown; attachedActions?: unknown }>;
      const source = minions.find(minion => minion.uid === 'baboom-talent-source');
      const other = minions.find(minion => minion.uid === 'baboom-other-minion');
      const hand = state?.core?.players?.['0']?.hand ?? [];
      return state?.sys?.interaction?.current == null
        && hasUid(source?.attachedActions, 'baboom-boost-hand')
        && !hasUid(other?.attachedActions, 'baboom-boost-hand')
        && !hasUid(hand, 'baboom-boost-hand')
        && hasUid(hand, 'baboom-base-action-hand');
    }, {
      message: 'Baboom 选择行动后应自动把行动附着到 Baboom 自己身上，不应打到旁边己方随从',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '放弃这次额外战术' })).toBeHidden({ timeout: 15000 });
    await screenshotViewport(page, 'yuanhou-baboom-extra-action-attached-to-self', testInfo);
  });

  test('电子猿-Baboom-真实点击跳过额外行动后应直接收口且不强制打出任何行动', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
                { uid: 'baboom-skip-boost-hand', defId: 'cyborg_apes_cyberevolution', type: 'action', owner: '0' },
                { uid: 'baboom-skip-base-action-hand', defId: 'cyborg_apes_going_bananas', type: 'action', owner: '0' },
              ],
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
              defId: 'base_monkey_lab',
              breakpoint: 20,
              minions: [
                {
                  uid: 'baboom-skip-other-minion',
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
                  uid: 'baboom-skip-source',
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

    await page.locator('[data-minion-uid="baboom-skip-source"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionCardUids = (prompt?.data?.options ?? [])
        .map((option: { value?: { cardUid?: unknown } }) => option?.value?.cardUid)
        .filter((uid: unknown): uid is string => typeof uid === 'string');
      return prompt?.data?.sourceId === 'smashup_immediate_extra_action'
        && prompt?.playerId === '0'
        && hasSkipOption(prompt?.data?.options)
        && optionCardUids.includes('baboom-skip-boost-hand')
        && !optionCardUids.includes('baboom-skip-base-action-hand');
    }, {
      message: 'Baboom 天赋应创建可跳过的 immediate extra action prompt，且只列能打到本仆从上的行动',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '放弃这次额外战术' })).toBeVisible({ timeout: 15000 });
    await screenshotViewport(page, 'yuanhou-baboom-extra-action-skip-prompt', testInfo);

    await game.selectInteractionOptionBy(
      (option) => option?.value?.skip === true,
      'Baboom immediate extra action skip',
    );

    await expect.poll(async () => {
      const state = await game.getState();
      const minions = (state?.core?.bases?.[0]?.minions ?? []) as Array<{ uid?: unknown; attachedActions?: unknown; talentUsed?: unknown }>;
      const source = minions.find(minion => minion.uid === 'baboom-skip-source');
      const other = minions.find(minion => minion.uid === 'baboom-skip-other-minion');
      const hand = state?.core?.players?.['0']?.hand ?? [];
      return state?.sys?.interaction?.current == null
        && source?.talentUsed === true
        && !hasUid(source?.attachedActions, 'baboom-skip-boost-hand')
        && !hasUid(other?.attachedActions, 'baboom-skip-boost-hand')
        && hasUid(hand, 'baboom-skip-boost-hand')
        && hasUid(hand, 'baboom-skip-base-action-hand');
    }, {
      message: 'Baboom 真实点击 skip 后应直接收口，且所有行动都仍留在手牌中，不应被强制打出或偷偷附着',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '放弃这次额外战术' })).toBeHidden({ timeout: 15000 });
    await screenshotViewport(page, 'yuanhou-baboom-extra-action-skipped-and-closed', testInfo);
  });

  test('电子猿-Baboom-真实入口有多张合法额外行动时应允许选择第二张并只打出所选行动', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
                { uid: 'baboom-multi-first-hand', defId: 'cyborg_apes_cyberevolution', type: 'action', owner: '0' },
                { uid: 'baboom-multi-second-hand', defId: 'cyborg_apes_juiced_up', type: 'action', owner: '0' },
              ],
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
              defId: 'base_monkey_lab',
              breakpoint: 20,
              minions: [
                {
                  uid: 'baboom-multi-other-minion',
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
                  uid: 'baboom-multi-source',
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

    await page.locator('[data-minion-uid="baboom-multi-source"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionCardUids = (prompt?.data?.options ?? [])
        .map((option: { value?: { cardUid?: unknown } }) => option?.value?.cardUid)
        .filter((uid: unknown): uid is string => typeof uid === 'string');
      return prompt?.data?.sourceId === 'smashup_immediate_extra_action'
        && prompt?.playerId === '0'
        && hasSkipOption(prompt?.data?.options)
        && optionCardUids.includes('baboom-multi-first-hand')
        && optionCardUids.includes('baboom-multi-second-hand');
    }, {
      message: 'Baboom 有多张合法额外行动时，应同时列出这两张行动并保留 skip',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-card-uid="baboom-multi-first-hand"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-card-uid="baboom-multi-second-hand"]')).toBeVisible({ timeout: 15000 });
    await screenshotViewport(page, 'yuanhou-baboom-multi-action-choice-prompt', testInfo);

    await game.selectInteractionOptionBy(
      (option) => option?.value?.cardUid === 'baboom-multi-second-hand',
      'Baboom immediate extra action selects second legal action',
    );

    await expect.poll(async () => {
      const state = await game.getState();
      const minions = (state?.core?.bases?.[0]?.minions ?? []) as Array<{ uid?: unknown; attachedActions?: unknown }>;
      const source = minions.find(minion => minion.uid === 'baboom-multi-source');
      const other = minions.find(minion => minion.uid === 'baboom-multi-other-minion');
      const hand = state?.core?.players?.['0']?.hand ?? [];
      return state?.sys?.interaction?.current == null
        && hasUid(source?.attachedActions, 'baboom-multi-second-hand')
        && !hasUid(source?.attachedActions, 'baboom-multi-first-hand')
        && !hasUid(other?.attachedActions, 'baboom-multi-second-hand')
        && hasUid(hand, 'baboom-multi-first-hand')
        && !hasUid(hand, 'baboom-multi-second-hand');
    }, {
      message: 'Baboom 选择第二张合法行动后，应只打出所选行动，并把未选第一张继续留在手牌里',
      timeout: 15000,
    }).toBe(true);

    await screenshotViewport(page, 'yuanhou-baboom-multi-action-second-selected', testInfo);
  });

  test('电子猿-Baboom-真实入口应允许从多张合法额外行动里选择猴子在你的背上并直接附着到自己', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
                { uid: 'baboom-monkey-first-hand', defId: 'cyborg_apes_cyberevolution', type: 'action', owner: '0' },
                { uid: 'baboom-monkey-second-hand', defId: 'cyborg_apes_monkey_on_your_back', type: 'action', owner: '0' },
                { uid: 'baboom-monkey-invalid-hand', defId: 'cyborg_apes_going_bananas', type: 'action', owner: '0' },
              ],
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
              hand: [],
              deck: [],
              discard: [],
              factions: ['sharks'],
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
                  uid: 'baboom-monkey-other-minion',
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
                  uid: 'baboom-monkey-source',
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
                {
                  uid: 'baboom-monkey-enemy',
                  defId: 'sharks_mako',
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
          ],
          baseDeck: ['base_the_vats'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-minion-uid="baboom-monkey-source"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionCardUids = (prompt?.data?.options ?? [])
        .map((option: { value?: { cardUid?: unknown } }) => option?.value?.cardUid)
        .filter((uid: unknown): uid is string => typeof uid === 'string')
        .sort();
      return prompt?.data?.sourceId === 'smashup_immediate_extra_action'
        && prompt?.playerId === '0'
        && hasSkipOption(prompt?.data?.options)
        && optionCardUids.join(',') === 'baboom-monkey-first-hand,baboom-monkey-second-hand';
    }, {
      message: 'Baboom 额外行动在同时存在强化和猴子在你的背上时，应保留两张合法行动并过滤非法基地战术',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-card-uid="baboom-monkey-first-hand"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-card-uid="baboom-monkey-second-hand"]')).toBeVisible({ timeout: 15000 });
    await screenshotViewport(page, 'yuanhou-baboom-monkey-action-choice-prompt', testInfo);

    await game.selectInteractionOptionBy(
      (option) => option?.value?.cardUid === 'baboom-monkey-second-hand',
      'Baboom immediate extra action selects Monkey on Your Back',
    );

    await expect.poll(async () => {
      const state = await game.getState();
      const minions = (state?.core?.bases?.[0]?.minions ?? []) as Array<{ uid?: unknown; attachedActions?: unknown }>;
      const source = minions.find(minion => minion.uid === 'baboom-monkey-source');
      const other = minions.find(minion => minion.uid === 'baboom-monkey-other-minion');
      const enemy = minions.find(minion => minion.uid === 'baboom-monkey-enemy');
      const hand = state?.core?.players?.['0']?.hand ?? [];
      return state?.sys?.interaction?.current == null
        && hasUid(source?.attachedActions, 'baboom-monkey-second-hand')
        && !hasUid(other?.attachedActions, 'baboom-monkey-second-hand')
        && !hasUid(enemy?.attachedActions, 'baboom-monkey-second-hand')
        && hasUid(hand, 'baboom-monkey-first-hand')
        && !hasUid(hand, 'baboom-monkey-second-hand')
        && hasUid(hand, 'baboom-monkey-invalid-hand');
    }, {
      message: 'Baboom 选择猴子在你的背上后，应直接附着到发动天赋的 Baboom 自己身上，并保持其他合法/非法手牌状态正确',
      timeout: 15000,
    }).toBe(true);

    await screenshotViewport(page, 'yuanhou-baboom-monkey-action-attached-to-self', testInfo);
  });

  test('电子猿-Baboom-同基地两只 Baboom 时真实入口应只把额外行动附着到发动天赋的那一只', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
                { uid: 'baboom-twin-boost-hand', defId: 'cyborg_apes_cyberevolution', type: 'action', owner: '0' },
              ],
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
              defId: 'base_monkey_lab',
              breakpoint: 20,
              minions: [
                {
                  uid: 'baboom-twin-other',
                  defId: 'cyborg_apes_baboom',
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
                  uid: 'baboom-twin-source',
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

    await page.locator('[data-minion-uid="baboom-twin-source"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionCardUids = (prompt?.data?.options ?? [])
        .map((option: { value?: { cardUid?: unknown } }) => option?.value?.cardUid)
        .filter((uid: unknown): uid is string => typeof uid === 'string');
      return prompt?.data?.sourceId === 'smashup_immediate_extra_action'
        && prompt?.playerId === '0'
        && optionCardUids.includes('baboom-twin-boost-hand');
    }, {
      message: 'Baboom 天赋在同基地存在另一只 Baboom 时，仍应给当前点击的那只创建 extra action prompt',
      timeout: 15000,
    }).toBe(true);

    await screenshotViewport(page, 'yuanhou-baboom-twin-before-attach', testInfo);

    await game.selectInteractionOptionBy(
      (option) => option?.value?.cardUid === 'baboom-twin-boost-hand',
      'Baboom twin chooses Cyberevolution',
    );

    await expect.poll(async () => {
      const state = await game.getState();
      const minions = (state?.core?.bases?.[0]?.minions ?? []) as Array<{ uid?: unknown; attachedActions?: unknown }>;
      const source = minions.find(minion => minion.uid === 'baboom-twin-source');
      const other = minions.find(minion => minion.uid === 'baboom-twin-other');
      return state?.sys?.interaction?.current == null
        && hasUid(source?.attachedActions, 'baboom-twin-boost-hand')
        && !hasUid(other?.attachedActions, 'baboom-twin-boost-hand');
    }, {
      message: '同基地存在两只 Baboom 时，额外行动应只附着到发动天赋的那一只，不应误附着到另一只同名 Baboom',
      timeout: 15000,
    }).toBe(true);

    await screenshotViewport(page, 'yuanhou-baboom-twin-attached-to-source-only', testInfo);
  });

  test('电子猿-Monkey on Your Back-真实入口可附着到敌方随从', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
                { uid: 'monkey-attach-hand', defId: 'cyborg_apes_monkey_on_your_back', type: 'action', owner: '0' },
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
              factions: ['sharks'],
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
                  uid: 'monkey-attach-own-host',
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
                  uid: 'monkey-attach-enemy-host',
                  defId: 'sharks_mako',
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
          ],
          baseDeck: ['base_the_vats'],
          baseDiscard: [],
        },
      },
    });

    const enemyHost = page.locator('[data-minion-uid="monkey-attach-enemy-host"]');
    await expect(enemyHost).toBeVisible({ timeout: 15000 });
    await screenshotViewport(page, 'yuanhou-monkey-on-your-back-enemy-host-before-attach', testInfo);

    await page.locator('[data-card-uid="monkey-attach-hand"]').click();
    await enemyHost.click();

    await expect.poll(async () => {
      const state = await game.getState();
      const baseMinions = state?.core?.bases?.[0]?.minions ?? [];
      const ownHost = baseMinions.find((minion: any) => minion?.uid === 'monkey-attach-own-host');
      const enemyHostAfter = baseMinions.find((minion: any) => minion?.uid === 'monkey-attach-enemy-host');
      return state?.sys?.interaction?.current == null
        && !hasUid(state?.core?.players?.['0']?.hand, 'monkey-attach-hand')
        && hasUid(enemyHostAfter?.attachedActions, 'monkey-attach-hand')
        && !hasUid(ownHost?.attachedActions, 'monkey-attach-hand');
    }, {
      message: 'Monkey on Your Back 从手牌真实打出后，应允许附着到敌方宿主，且不应误附着到己方随从',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-card-uid="monkey-attach-hand"]')).toBeHidden({ timeout: 15000 });
    await page.mouse.move(12, 12);
    await page.waitForTimeout(800);
    const dismissPreview = page.getByText('点击关闭');
    if (await dismissPreview.isVisible().catch(() => false)) {
      await dismissPreview.click({ force: true });
      await dismissPreview.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    }
    await screenshotViewport(page, 'yuanhou-monkey-on-your-back-attached-to-enemy-host', testInfo);
  });

  test('电子猿-Monkey on Your Back-真实附着行动天赋选择另一玩家低力量随从并把本行动放到底', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
              deck: [{ uid: 'deck-bottom-sentinel', defId: 'cyborg_apes_baboom', type: 'minion', owner: '0' }],
              discard: [],
              factions: ['cyborg_apes'],
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
              factions: ['sharks'],
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
                  uid: 'monkey-own-low',
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
                  uid: 'monkey-host',
                  defId: 'cyborg_apes_furious_george',
                  controller: '0',
                  owner: '0',
                  basePower: 2,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [
                    { uid: 'monkey-back-action', defId: 'cyborg_apes_monkey_on_your_back', ownerId: '0' },
                  ],
                },
                {
                  uid: 'monkey-enemy-high',
                  defId: 'cyborg_apes_cyberback',
                  controller: '1',
                  owner: '1',
                  basePower: 5,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'monkey-enemy-low-a',
                  defId: 'cyborg_apes_baboom',
                  controller: '1',
                  owner: '1',
                  basePower: 3,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'monkey-enemy-low-b',
                  defId: 'cyborg_apes_clyde_2_0',
                  controller: '1',
                  owner: '1',
                  basePower: 4,
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

    const host = page.locator('[data-minion-uid="monkey-host"]');
    await expect(host).toBeVisible({ timeout: 15000 });
    await host.hover();
    const monkeyAction = page.locator('[data-attached-action-uid="monkey-back-action"]');
    await expect(monkeyAction).toBeVisible({ timeout: 15000 });
    await monkeyAction.click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: { id?: unknown }) => option?.id);
      return prompt?.data?.sourceId === 'cyborg_apes_monkey_on_your_back_choose'
        && prompt?.playerId === '0'
        && optionIds.includes('monkey-enemy-low-a')
        && optionIds.includes('monkey-enemy-low-b')
        && !optionIds.includes('monkey-enemy-high')
        && !optionIds.includes('monkey-own-low');
    }, {
      message: 'Monkey on Your Back 真实附着行动天赋应只列同基地另一玩家力量 4 或以下随从',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-minion-uid="monkey-enemy-low-a"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="monkey-enemy-low-b"]')).toBeVisible({ timeout: 15000 });
    await screenshotViewport(page, 'yuanhou-monkey-on-your-back-target-choice-prompt', testInfo);

    await page.locator('[data-minion-uid="monkey-enemy-low-b"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const baseMinions = state?.core?.bases?.[0]?.minions ?? [];
      const hostAfter = baseMinions.find((minion: { uid?: unknown }) => minion?.uid === 'monkey-host');
      const p0DeckUids = (state?.core?.players?.['0']?.deck ?? []).map((card: { uid?: unknown }) => card?.uid);
      const p1Discard = state?.core?.players?.['1']?.discard ?? [];
      return state?.sys?.interaction?.current == null
        && baseMinions.some((minion: { uid?: unknown }) => minion?.uid === 'monkey-enemy-low-a')
        && !baseMinions.some((minion: { uid?: unknown }) => minion?.uid === 'monkey-enemy-low-b')
        && baseMinions.some((minion: { uid?: unknown }) => minion?.uid === 'monkey-enemy-high')
        && baseMinions.some((minion: { uid?: unknown }) => minion?.uid === 'monkey-own-low')
        && !hasUid(hostAfter?.attachedActions, 'monkey-back-action')
        && p0DeckUids.join(',') === 'deck-bottom-sentinel,monkey-back-action'
        && hasUid(p1Discard, 'monkey-enemy-low-b');
    }, {
      message: '选择第二个低力量敌方目标后，应只摧毁该目标并把 Monkey on Your Back 放到拥有者牌库底',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-minion-uid="monkey-enemy-low-b"]')).toBeHidden({ timeout: 15000 });
    await expect(page.getByText('猴子在你的背上：选择要摧毁的随从')).toBeHidden({ timeout: 15000 });
    await screenshotViewport(page, 'yuanhou-monkey-on-your-back-target-destroyed-action-bottomed', testInfo);
  });

  test('电子猿-Shielding-真实入口会清理对手行动并持续保护宿主上的其他行动', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
                { uid: 'shield-hand', defId: 'cyborg_apes_shielding', type: 'action', owner: '0' },
              ],
              deck: [
                { uid: 'p0-draw-a', defId: 'cyborg_apes_furious_george', type: 'minion', owner: '0' },
                { uid: 'p0-draw-b', defId: 'cyborg_apes_cyberback', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['cyborg_apes'],
              minionsPlayed: 1,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [
                { uid: 'bananas-hand', defId: 'cyborg_apes_going_bananas', type: 'action', owner: '1' },
              ],
              deck: [
                { uid: 'p1-draw-a', defId: 'cyborg_apes_furious_george', type: 'minion', owner: '1' },
                { uid: 'p1-draw-b', defId: 'cyborg_apes_cyberback', type: 'minion', owner: '1' },
              ],
              discard: [],
              factions: ['cyborg_apes'],
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
                uid: 'shield-host',
                defId: 'time_travelers_jumper',
                controller: '0',
                owner: '0',
                basePower: 2,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [
                  { uid: 'own-protected-action', defId: 'cyborg_apes_cyberevolution', ownerId: '0' },
                  { uid: 'enemy-existing-action', defId: 'shapeshifters_splice_as_nice', ownerId: '1' },
                ],
              }],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_the_vats'],
          baseDiscard: [],
        },
      },
    });

    const shieldHost = page.locator('[data-minion-uid="shield-host"]');
    await expect(shieldHost).toBeVisible({ timeout: 15000 });
    await screenshotLocator(shieldHost, 'yuanhou-shielding-host-before-play', testInfo);

    await page.locator('[data-card-uid="shield-hand"]').click();
    await shieldHost.click();

    await expect.poll(async () => {
      const state = await game.getState();
      const host = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'shield-host');
      const p0Hand = state?.core?.players?.['0']?.hand ?? [];
      const p1Discard = state?.core?.players?.['1']?.discard ?? [];
      return state?.sys?.interaction?.current == null
        && hasUid(host?.attachedActions, 'own-protected-action')
        && hasUid(host?.attachedActions, 'shield-hand')
        && !hasUid(host?.attachedActions, 'enemy-existing-action')
        && !hasUid(p0Hand, 'shield-hand')
        && hasUid(p1Discard, 'enemy-existing-action');
    }, {
      message: 'Shielding 从手牌真实附着后，应摧毁同宿主其他玩家行动，保留己方旧行动和本 Shielding',
      timeout: 15000,
    }).toBe(true);

    await screenshotLocator(shieldHost, 'yuanhou-shielding-host-after-play-cleared-enemy-action', testInfo);
    await dismissSmashUpSpotlightQueueIfVisible(page);
    await page.getByTestId('su-end-turn-action-button').click();

    await expect.poll(async () => {
      const state = await game.getState();
      return state?.sys?.phase === 'playCards'
        && state?.core?.currentPlayerIndex === 1
        && hasUid(state?.core?.players?.['1']?.hand, 'bananas-hand');
    }, {
      message: 'P0 真实结束回合后应进入 P1 出牌阶段，P1 手牌保留 Going Bananas',
      timeout: 20000,
    }).toBe(true);

    await page.locator('[data-card-uid="bananas-hand"]').click();
    await page.locator('[data-base-index="0"]').click();
    await dismissSmashUpSpotlightQueueIfVisible(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const host = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'shield-host');
      const p0Discard = state?.core?.players?.['0']?.discard ?? [];
      const p1Discard = state?.core?.players?.['1']?.discard ?? [];
      return state?.sys?.interaction?.current == null
        && hasUid(host?.attachedActions, 'own-protected-action')
        && !hasUid(host?.attachedActions, 'shield-hand')
        && hasUid(p0Discard, 'shield-hand')
        && !hasUid(p0Discard, 'own-protected-action')
        && hasUid(p1Discard, 'bananas-hand')
        && hasUid(p1Discard, 'enemy-existing-action');
    }, {
      message: 'P1 真实打出 Going Bananas 后，应摧毁 Shielding 自身，但保留受 Shielding 保护的同宿主其他行动',
      timeout: 15000,
    }).toBe(true);

    await screenshotViewport(page, 'yuanhou-shielding-going-bananas-resolved-protected-other-action', testInfo);
  });

  test('电子猿-Going Bananas-真实入口只清理所选基地其他玩家行动', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
                { uid: 'bananas-cleanup-hand', defId: 'cyborg_apes_going_bananas', type: 'action', owner: '0' },
              ],
              deck: [],
              discard: [],
              factions: ['cyborg_apes'],
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
              factions: ['cyborg_apes', 'time_travelers'],
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
                uid: 'bananas-target-host',
                defId: 'time_travelers_jumper',
                controller: '0',
                owner: '0',
                basePower: 2,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [
                  { uid: 'bananas-own-attached', defId: 'cyborg_apes_cyberevolution', ownerId: '0' },
                  { uid: 'bananas-enemy-attached', defId: 'shapeshifters_splice_as_nice', ownerId: '1' },
                ],
              }],
              ongoingActions: [
                { uid: 'bananas-own-base-action', defId: 'time_travelers_stasis_field', ownerId: '0' },
                { uid: 'bananas-enemy-base-action', defId: 'time_travelers_stasis_field', ownerId: '1' },
              ],
            },
            {
              defId: 'base_portal_room',
              breakpoint: 22,
              minions: [{
                uid: 'bananas-other-host',
                defId: 'time_travelers_jumper',
                controller: '1',
                owner: '1',
                basePower: 2,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [
                  { uid: 'bananas-other-base-attached', defId: 'shapeshifters_splice_as_nice', ownerId: '1' },
                ],
              }],
              ongoingActions: [
                { uid: 'bananas-other-base-action', defId: 'time_travelers_stasis_field', ownerId: '1' },
              ],
            },
          ],
          baseDeck: ['base_the_vats'],
          baseDiscard: [],
        },
      },
    });

    await screenshotViewport(page, 'yuanhou-going-bananas-before-selected-base-cleanup', testInfo);
    await page.locator('[data-card-uid="bananas-cleanup-hand"]').click();
    await page.locator('[data-base-index="0"]').click();
    await dismissSmashUpSpotlightQueueIfVisible(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const base0 = state?.core?.bases?.[0];
      const base1 = state?.core?.bases?.[1];
      const base0Host = base0?.minions?.find((minion: any) => minion.uid === 'bananas-target-host');
      const base1Host = base1?.minions?.find((minion: any) => minion.uid === 'bananas-other-host');
      const p0Discard = state?.core?.players?.['0']?.discard ?? [];
      const p1Discard = state?.core?.players?.['1']?.discard ?? [];
      return state?.sys?.interaction?.current == null
        && hasUid(p0Discard, 'bananas-cleanup-hand')
        && hasUid(base0?.ongoingActions, 'bananas-own-base-action')
        && !hasUid(base0?.ongoingActions, 'bananas-enemy-base-action')
        && hasUid(base0Host?.attachedActions, 'bananas-own-attached')
        && !hasUid(base0Host?.attachedActions, 'bananas-enemy-attached')
        && hasUid(base1?.ongoingActions, 'bananas-other-base-action')
        && hasUid(base1Host?.attachedActions, 'bananas-other-base-attached')
        && hasUid(p1Discard, 'bananas-enemy-base-action')
        && hasUid(p1Discard, 'bananas-enemy-attached');
    }, {
      message: 'Going Bananas 应只清理所选基地上其他玩家的 base ongoing 与 attached action，保留自己行动和另一基地行动',
      timeout: 15000,
    }).toBe(true);

    await screenshotViewport(page, 'yuanhou-going-bananas-selected-base-cleaned-only', testInfo);
  });

  test('变形者-Really-真实入口可从弃牌堆选随从并选择任意合法基地打出', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
                { uid: 'really-hand', defId: 'shapeshifters_really', type: 'action', owner: '0' },
              ],
              deck: [],
              discard: [
                { uid: 'really-discard-a', defId: 'cyborg_apes_furious_george', type: 'minion', owner: '0' },
                { uid: 'really-discard-b', defId: 'shapeshifters_mimic', type: 'minion', owner: '0' },
              ],
              factions: ['shapeshifters'],
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
              factions: ['shapeshifters'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_faceless_city',
              breakpoint: 20,
              minions: [{
                uid: 'really-target',
                defId: 'shapeshifters_doppelganger',
                controller: '0',
                owner: '0',
                basePower: 5,
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
              defId: 'base_the_vats',
              breakpoint: 18,
              minions: [],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="really-hand"]').click();
    await page.locator('[data-minion-uid="really-target"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      const discard = state?.core?.players?.['0']?.discard ?? [];
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'shapeshifters_really_search'
        && !hasUid(minions, 'really-target')
        && hasUid(discard, 'really-target')
        && optionIds.includes('really-discard-a')
        && optionIds.includes('really-discard-b')
        && hasSkipOption(prompt?.data?.options);
    }, {
      message: 'Really? 应先摧毁己方目标并进入可跳过的弃牌堆随从选择 prompt',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-really-discard-search-prompt', testInfo);

    await page.locator('[data-option-id="really-discard-b"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionBaseIndices = (prompt?.data?.options ?? [])
        .map((option: any) => option?.value?.baseIndex)
        .filter((baseIndex: unknown): baseIndex is number => typeof baseIndex === 'number');
      return prompt?.data?.sourceId === 'shapeshifters_really_base'
        && optionBaseIndices.includes(0)
        && optionBaseIndices.includes(1);
    }, {
      message: 'Really? 选择弃牌堆随从后应进入基地选择 prompt，不能固定回原基地',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-really-base-choice-prompt', testInfo);

    await game.selectInteractionOptionBy((option) => option?.value?.baseIndex === 1, 'Really? 选择第二个基地打出额外随从');

    await expect.poll(async () => {
      const state = await game.getState();
      const base0 = state?.core?.bases?.[0]?.minions ?? [];
      const base1 = state?.core?.bases?.[1]?.minions ?? [];
      const discard = state?.core?.players?.['0']?.discard ?? [];
      return state?.sys?.interaction?.current == null
        && !hasUid(base0, 'really-target')
        && !hasUid(base0, 'really-discard-b')
        && hasUid(base1, 'really-discard-b')
        && !hasUid(discard, 'really-discard-b')
        && hasUid(discard, 'really-target');
    }, {
      message: 'Really? 选择基地后应直接把所选弃牌堆随从额外打到目标基地并收口',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '放弃这次额外随从' })).toBeHidden({ timeout: 15000 });
    await game.screenshot('yuanhou-really-selected-minion-played-on-chosen-base', testInfo);
  });

  test('变形者-Really-真实入口跳过弃牌堆搜寻后应直接收口且不额外打出候选随从', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
                { uid: 'really-skip-hand', defId: 'shapeshifters_really', type: 'action', owner: '0' },
              ],
              deck: [],
              discard: [
                { uid: 'really-skip-discard-a', defId: 'cyborg_apes_furious_george', type: 'minion', owner: '0' },
                { uid: 'really-skip-discard-b', defId: 'shapeshifters_mimic', type: 'minion', owner: '0' },
              ],
              factions: ['shapeshifters'],
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
              factions: ['shapeshifters'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_faceless_city',
              breakpoint: 20,
              minions: [{
                uid: 'really-skip-target',
                defId: 'shapeshifters_doppelganger',
                controller: '0',
                owner: '0',
                basePower: 5,
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
              defId: 'base_the_vats',
              breakpoint: 18,
              minions: [],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="really-skip-hand"]').click();
    await page.locator('[data-minion-uid="really-skip-target"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const base0Minions = state?.core?.bases?.[0]?.minions ?? [];
      const discard = state?.core?.players?.['0']?.discard ?? [];
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'shapeshifters_really_search'
        && !hasUid(base0Minions, 'really-skip-target')
        && hasUid(discard, 'really-skip-target')
        && optionIds.includes('really-skip-discard-a')
        && optionIds.includes('really-skip-discard-b')
        && hasSkipOption(prompt?.data?.options);
    }, {
      message: 'Really? 真实入口应在摧毁己方目标后进入带 skip 的弃牌堆随从搜索 prompt',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-option-id="really-skip-discard-a"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="really-skip-discard-b"]')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /跳过搜寻|放弃这次选择/ })).toBeVisible({ timeout: 15000 });

    await game.screenshot('yuanhou-really-skip-discard-search-prompt', testInfo);

    await game.selectInteractionOptionBy((option) => option?.value?.skip === true, 'Really? 弃牌堆搜索 skip');

    await expect.poll(async () => {
      const state = await game.getState();
      const base0Minions = state?.core?.bases?.[0]?.minions ?? [];
      const base1Minions = state?.core?.bases?.[1]?.minions ?? [];
      const discard = state?.core?.players?.['0']?.discard ?? [];
      const hand = state?.core?.players?.['0']?.hand ?? [];
      return state?.sys?.interaction?.current == null
        && base0Minions.length === 0
        && base1Minions.length === 0
        && hand.length === 0
        && hasUid(discard, 'really-skip-hand')
        && hasUid(discard, 'really-skip-target')
        && hasUid(discard, 'really-skip-discard-a')
        && hasUid(discard, 'really-skip-discard-b');
    }, {
      message: 'Really? 真实点击 skip 后，应直接收口且弃牌堆候选不应被偷偷额外打到任何基地',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '放弃这次额外随从' })).toBeHidden({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="really-skip-discard-a"]')).toBeHidden({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="really-skip-discard-b"]')).toBeHidden({ timeout: 15000 });

    await game.screenshot('yuanhou-really-skip-discard-search-resolved', testInfo);
  });

  test('变形者-Doppelganger-真实摧毁进弃牌后触发牌库搜随从并打回原基地', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
              hand: [{ uid: 'bacta-doppelganger-hand', defId: 'shapeshifters_bacta_the_future', type: 'action', owner: '0' }],
              deck: [
                { uid: 'doppel-candidate-a', defId: 'shapeshifters_copycat', type: 'minion', owner: '0' },
                { uid: 'doppel-candidate-b', defId: 'shapeshifters_mimic', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['shapeshifters'],
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
              factions: ['cyborg_apes'],
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
                uid: 'doppelganger-target',
                defId: 'shapeshifters_doppelganger',
                controller: '0',
                owner: '0',
                basePower: 5,
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

    await page.locator('[data-card-uid="bacta-doppelganger-hand"]').click();
    await expect(page.getByTestId('base-zone-0')).toBeVisible({ timeout: 15000 });
    await page.locator('[data-minion-uid="doppelganger-target"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      const discard = state?.core?.players?.['0']?.discard ?? [];
      return prompt?.data?.sourceId === 'smashup_immediate_extra_minion'
        && !hasUid(minions, 'doppelganger-target')
        && hasUid(discard, 'doppelganger-target');
    }, {
      message: 'Bacta 真实摧毁 Doppelganger 后应先出现 Bacta immediate extra prompt，且 Doppelganger 已进弃牌',
      timeout: 15000,
    }).toBe(true);

    await page.getByRole('button', { name: '放弃这次额外随从' }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      return state?.sys?.interaction?.current?.data?.sourceId === 'shapeshifters_doppelganger_search';
    }, {
      message: '跳过 Bacta immediate extra 后，应继续进入 Doppelganger 自身的牌库搜索 prompt',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-option-id="doppel-candidate-a"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="doppel-candidate-b"]')).toBeVisible({ timeout: 15000 });
    await expect.poll(async () => {
      const state = await game.getState();
      const options = state?.sys?.interaction?.current?.data?.options ?? [];
      return hasSkipOption(options);
    }, {
      message: 'Doppelganger search prompt 应在当前选择窗口提供 skip option',
      timeout: 15000,
    }).toBe(true);
    await expect(page.getByRole('button', { name: '放弃这次选择' })).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-doppelganger-search-prompt-after-destroy', testInfo);

    await page.locator('[data-option-id="doppel-candidate-b"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      const deck = state?.core?.players?.['0']?.deck ?? [];
      const discard = state?.core?.players?.['0']?.discard ?? [];
      return hasUid(minions, 'doppel-candidate-b')
        && !hasUid(minions, 'doppelganger-target')
        && !hasUid(deck, 'doppel-candidate-b')
        && hasUid(discard, 'doppelganger-target');
    }, {
      message: 'Doppelganger 搜牌应把玩家选择的随从从 deck 打回原基地，原 Doppelganger 保持在弃牌堆',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '放弃这次额外随从' })).toBeHidden({ timeout: 15000 });
    await expect.poll(async () => {
      const state = await game.getState();
      return state?.sys?.interaction?.current == null;
    }, {
      message: 'Doppelganger 搜牌打出候选后的 immediate extra prompt 应已收口',
      timeout: 15000,
    }).toBe(true);
    await expect(page.locator('[data-minion-uid="doppel-candidate-b"]')).toBeVisible({ timeout: 15000 });

    await game.screenshot('yuanhou-doppelganger-selected-minion-played', testInfo);
  });

  test('变形者-Doppelganger-真实入口跳过牌库搜寻后应直接收口且不额外打出候选随从', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
              hand: [{ uid: 'bacta-doppelganger-skip-hand', defId: 'shapeshifters_bacta_the_future', type: 'action', owner: '0' }],
              deck: [
                { uid: 'doppel-skip-candidate-a', defId: 'shapeshifters_copycat', type: 'minion', owner: '0' },
                { uid: 'doppel-skip-candidate-b', defId: 'shapeshifters_mimic', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['shapeshifters'],
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
              factions: ['cyborg_apes'],
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
                uid: 'doppelganger-skip-target',
                defId: 'shapeshifters_doppelganger',
                controller: '0',
                owner: '0',
                basePower: 5,
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

    await page.locator('[data-card-uid="bacta-doppelganger-skip-hand"]').click();
    await expect(page.getByTestId('base-zone-0')).toBeVisible({ timeout: 15000 });
    await page.locator('[data-minion-uid="doppelganger-skip-target"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      const discard = state?.core?.players?.['0']?.discard ?? [];
      return prompt?.data?.sourceId === 'smashup_immediate_extra_minion'
        && !hasUid(minions, 'doppelganger-skip-target')
        && hasUid(discard, 'doppelganger-skip-target');
    }, {
      message: 'Bacta 真实摧毁 Doppelganger 后应先出现 immediate extra prompt，且目标已进弃牌堆',
      timeout: 15000,
    }).toBe(true);

    await page.getByRole('button', { name: '放弃这次额外随从' }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'shapeshifters_doppelganger_search'
        && optionIds.includes('doppel-skip-candidate-a')
        && optionIds.includes('doppel-skip-candidate-b')
        && hasSkipOption(prompt?.data?.options);
    }, {
      message: '跳过 Bacta immediate extra 后，应进入带 skip 的 Doppelganger 牌库搜索 prompt',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-option-id="doppel-skip-candidate-a"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="doppel-skip-candidate-b"]')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /跳过搜寻|放弃这次选择/ })).toBeVisible({ timeout: 15000 });

    await game.screenshot('yuanhou-doppelganger-skip-search-prompt', testInfo);

    await game.selectInteractionOptionBy((option) => option?.value?.skip === true, 'Doppelganger 牌库搜索 skip');

    await expect.poll(async () => {
      const state = await game.getState();
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      const deck = state?.core?.players?.['0']?.deck ?? [];
      const discard = state?.core?.players?.['0']?.discard ?? [];
      const hand = state?.core?.players?.['0']?.hand ?? [];
      return state?.sys?.interaction?.current == null
        && minions.length === 0
        && hand.length === 0
        && hasUid(discard, 'bacta-doppelganger-skip-hand')
        && hasUid(discard, 'doppelganger-skip-target')
        && hasUid(deck, 'doppel-skip-candidate-a')
        && hasUid(deck, 'doppel-skip-candidate-b');
    }, {
      message: 'Doppelganger 真实点击 skip 后，应直接收口且不会把任何牌库候选打回原基地',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '放弃这次额外随从' })).toBeHidden({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="doppel-skip-candidate-a"]')).toBeHidden({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="doppel-skip-candidate-b"]')).toBeHidden({ timeout: 15000 });

    await game.screenshot('yuanhou-doppelganger-skip-search-resolved', testInfo);
  });

  test('变形者-Copycat-真实入口可选择另一玩家随从并只给本体写入复制元数据', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
              hand: [{ uid: 'copycat-hand', defId: 'shapeshifters_copycat', type: 'minion', owner: '0' }],
              deck: [],
              discard: [],
              factions: ['shapeshifters'],
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
              factions: ['cyborg_apes'],
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
              minions: [
                {
                  uid: 'enemy-a',
                  defId: 'cyborg_apes_baboom',
                  controller: '1',
                  owner: '1',
                  basePower: 3,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'enemy-b',
                  defId: 'cyborg_apes_furious_george',
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
          ],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="copycat-hand"]').click();
    await page.getByTestId('base-zone-0').click();

    await expect.poll(async () => {
      const state = await game.getState();
      return state?.sys?.interaction?.current?.data?.sourceId === 'shapeshifters_copycat_choose'
        && state?.sys?.interaction?.current?.playerId === '0';
    }, {
      message: 'Copycat 打出后应通过真实入口创建选择另一玩家随从的 prompt',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-minion-uid="enemy-a"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="enemy-b"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="enemy-b"]')).toHaveCount(0);
    await game.screenshot('yuanhou-copycat-choose-other-player-minion-prompt', testInfo);

    await page.locator('[data-minion-uid="enemy-b"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const copycat = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'copycat-hand');
      const enemyA = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'enemy-a');
      const enemyB = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'enemy-b');
      return copycat?.metadata?.copiedAbilityDefId === 'cyborg_apes_furious_george'
        && copycat?.metadata?.copiedAbilityUntilTurn === 1
        && enemyA?.metadata?.copiedAbilityDefId == null
        && enemyB?.metadata?.copiedAbilityDefId == null
        && state?.sys?.interaction?.current == null;
    }, {
      message: 'Copycat 应只在本体写入玩家选择的敌方随从能力 metadata',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-copycat-copied-selected-enemy-minion', testInfo);
  });

  test('变形者-Copycat-真实复制 Jumper 后被 Bacta 摧毁时应先给额外随从再给 optional recover 回手', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
                { uid: 'copycat-hand', defId: 'shapeshifters_copycat', type: 'minion', owner: '0' },
                { uid: 'copycat-bacta-hand', defId: 'shapeshifters_bacta_the_future', type: 'action', owner: '0' },
                { uid: 'copycat-extra-mimic', defId: 'shapeshifters_mimic', type: 'minion', owner: '0' },
              ],
              deck: [],
              discard: [],
              factions: ['shapeshifters', 'time_travelers'],
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
              minions: [
                {
                  uid: 'copycat-enemy-jumper',
                  defId: 'time_travelers_jumper',
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
                {
                  uid: 'copycat-enemy-george',
                  defId: 'cyborg_apes_furious_george',
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
            { defId: 'base_the_vats', breakpoint: 18, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="copycat-hand"]').click();
    await page.getByTestId('base-zone-0').click();

    await expect.poll(async () => {
      const state = await game.getState();
      return state?.sys?.interaction?.current?.data?.sourceId === 'shapeshifters_copycat_choose'
        && state?.sys?.interaction?.current?.playerId === '0';
    }, {
      message: 'Copycat 打出后应先进入真实选择另一玩家随从的 prompt',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-minion-uid="copycat-enemy-jumper"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="copycat-enemy-jumper"]')).toHaveCount(0);
    await page.locator('[data-minion-uid="copycat-enemy-jumper"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const copycat = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'copycat-hand');
      return copycat?.metadata?.copiedAbilityDefId === 'time_travelers_jumper'
        && copycat?.metadata?.copiedAbilityUntilTurn === 1
        && state?.sys?.interaction?.current == null;
    }, {
      message: 'Copycat 选择 Jumper 后应先把 copied metadata 写到本体',
      timeout: 15000,
    }).toBe(true);

    await page.locator('[data-card-uid="copycat-bacta-hand"]').click();
    await expect(page.getByTestId('base-zone-0')).toBeVisible({ timeout: 15000 });
    await page.locator('[data-minion-uid="copycat-hand"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const discard = state?.core?.players?.['0']?.discard ?? [];
      return prompt?.data?.sourceId === 'smashup_immediate_extra_minion'
        && prompt?.playerId === '0'
        && hasSkipOption(prompt?.data?.options)
        && hasUid(discard, 'copycat-hand');
    }, {
      message: 'Bacta 摧毁已复制 Jumper 的 Copycat 后，应先出现可跳过的 immediate extra minion prompt，且 Copycat 已进弃牌',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '放弃这次额外随从' })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-card-uid="copycat-extra-mimic"]')).toBeVisible({ timeout: 15000 });
    await screenshotViewport(page, 'yuanhou-copycat-copied-jumper-bacta-immediate-extra-prompt', testInfo);

    await game.selectInteractionOptionBy(
      (option) => option?.value?.skip === true,
      'Copycat copied Jumper skips Bacta immediate extra minion',
    );

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionKinds = (prompt?.data?.options ?? []).map((option: any) => option?.value?.kind);
      return prompt?.data?.sourceId === 'smashup_reaction_choose'
        && prompt?.playerId === '0'
        && optionKinds.includes('trigger')
        && optionKinds.includes('pass');
    }, {
      message: '跳过 Bacta immediate extra 后，应继续进入 Copycat 代理 Jumper 的 optional recover prompt',
      timeout: 15000,
    }).toBe(true);

    await screenshotViewport(page, 'yuanhou-copycat-copied-jumper-reaction-prompt', testInfo);

    await game.selectInteractionOptionBy(
      (option) => option?.value?.kind === 'trigger',
      'Copycat copied Jumper resolves recover trigger',
    );

    await expect.poll(async () => {
      const state = await game.getState();
      const hand = state?.core?.players?.['0']?.hand ?? [];
      const discard = state?.core?.players?.['0']?.discard ?? [];
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      return state?.sys?.interaction?.current == null
        && hasUid(hand, 'copycat-hand')
        && hasUid(hand, 'copycat-extra-mimic')
        && !hasUid(discard, 'copycat-hand')
        && !hasUid(minions, 'copycat-hand');
    }, {
      message: '执行 Copycat 代理的 Jumper optional recover 后，Copycat 应回到 owner 手牌，且额外随从机会仍保持跳过结果',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '放弃这次额外随从' })).toBeHidden({ timeout: 15000 });
    await screenshotViewport(page, 'yuanhou-copycat-copied-jumper-recovered-to-hand', testInfo);
  });

  test('变形者-Copycat-真实代理 Baboom 天赋会给出可跳过的额外行动并只能打到自己身上', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
                { uid: 'copycat-hand', defId: 'shapeshifters_copycat', type: 'minion', owner: '0' },
                { uid: 'copycat-boost-hand', defId: 'cyborg_apes_cyberevolution', type: 'action', owner: '0' },
                { uid: 'copycat-base-action-hand', defId: 'cyborg_apes_going_bananas', type: 'action', owner: '0' },
              ],
              deck: [],
              discard: [],
              factions: ['shapeshifters', 'cyborg_apes'],
              minionsPlayed: 0,
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
              factions: ['cyborg_apes'],
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
              minions: [
                {
                  uid: 'copycat-other-minion',
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
                  uid: 'copycat-enemy-baboom',
                  defId: 'cyborg_apes_baboom',
                  controller: '1',
                  owner: '1',
                  basePower: 3,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'copycat-enemy-george',
                  defId: 'cyborg_apes_furious_george',
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
            { defId: 'base_monkey_lab', breakpoint: 20, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_portal_room'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="copycat-hand"]').click();
    await page.getByTestId('base-zone-0').click();

    await expect.poll(async () => {
      const state = await game.getState();
      return state?.sys?.interaction?.current?.data?.sourceId === 'shapeshifters_copycat_choose'
        && state?.sys?.interaction?.current?.playerId === '0';
    }, {
      message: 'Copycat 打出后应先进入真实选择另一玩家随从的 prompt',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-minion-uid="copycat-enemy-baboom"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="copycat-enemy-baboom"]')).toHaveCount(0);
    await page.locator('[data-minion-uid="copycat-enemy-baboom"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const copycat = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'copycat-hand');
      return copycat?.metadata?.copiedAbilityDefId === 'cyborg_apes_baboom'
        && copycat?.metadata?.copiedAbilityUntilTurn === 1
        && state?.sys?.interaction?.current == null;
    }, {
      message: 'Copycat 选择 Baboom 后应先把 copied metadata 写到本体',
      timeout: 15000,
    }).toBe(true);

    await page.locator('[data-minion-uid="copycat-hand"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionCardUids = (prompt?.data?.options ?? [])
        .map((option: { value?: { cardUid?: unknown } }) => option?.value?.cardUid)
        .filter((uid: unknown): uid is string => typeof uid === 'string');
      return prompt?.data?.sourceId === 'smashup_immediate_extra_action'
        && prompt?.playerId === '0'
        && hasSkipOption(prompt?.data?.options)
        && optionCardUids.includes('copycat-boost-hand')
        && !optionCardUids.includes('copycat-base-action-hand');
    }, {
      message: 'Copycat 复制 Baboom 天赋后，应出现可跳过的 immediate extra action prompt，且只列能打到自己身上的行动',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '放弃这次额外战术' })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-card-uid="copycat-boost-hand"]')).toBeVisible({ timeout: 15000 });
    await screenshotViewport(page, 'yuanhou-copycat-copied-baboom-talent-prompt', testInfo);

    await game.selectInteractionOptionBy(
      (option) => option?.value?.cardUid === 'copycat-boost-hand',
      'Copycat copied Baboom talent selects Cyberevolution',
    );

    await expect.poll(async () => {
      const state = await game.getState();
      const minions = (state?.core?.bases?.[0]?.minions ?? []) as Array<{ uid?: unknown; attachedActions?: unknown; talentUsed?: unknown }>;
      const copycat = minions.find(minion => minion.uid === 'copycat-hand');
      const other = minions.find(minion => minion.uid === 'copycat-other-minion');
      const hand = state?.core?.players?.['0']?.hand ?? [];
      return state?.sys?.interaction?.current == null
        && copycat?.talentUsed === true
        && hasUid(copycat?.attachedActions, 'copycat-boost-hand')
        && !hasUid(other?.attachedActions, 'copycat-boost-hand')
        && !hasUid(hand, 'copycat-boost-hand')
        && hasUid(hand, 'copycat-base-action-hand');
    }, {
      message: 'Copycat 复制 Baboom 天赋后，所选行动应自动附着到 Copycat 自己身上，并收口 prompt',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '放弃这次额外战术' })).toBeHidden({ timeout: 15000 });
    await screenshotViewport(page, 'yuanhou-copycat-copied-baboom-extra-action-attached-to-self', testInfo);
  });

  test('变形者-Copycat-真实复制 Furious George 后会按自己身上的行动数量获得持续加成', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
                { uid: 'copycat-hand', defId: 'shapeshifters_copycat', type: 'minion', owner: '0' },
                { uid: 'copycat-uplink-hand', defId: 'cyborg_apes_missing_uplink', type: 'action', owner: '0' },
              ],
              deck: [],
              discard: [],
              factions: ['shapeshifters', 'cyborg_apes'],
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
              factions: ['cyborg_apes'],
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
              minions: [
                {
                  uid: 'copycat-enemy-george',
                  defId: 'cyborg_apes_furious_george',
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
                {
                  uid: 'copycat-enemy-baboom',
                  defId: 'cyborg_apes_baboom',
                  controller: '1',
                  owner: '1',
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
          ],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="copycat-hand"]').click();
    await page.getByTestId('base-zone-0').click();

    await expect.poll(async () => {
      const state = await game.getState();
      return state?.sys?.interaction?.current?.data?.sourceId === 'shapeshifters_copycat_choose'
        && state?.sys?.interaction?.current?.playerId === '0';
    }, {
      message: 'Copycat 打出后应先进入真实选择另一玩家随从的 prompt',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-minion-uid="copycat-enemy-george"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="copycat-enemy-george"]')).toHaveCount(0);
    await page.locator('[data-minion-uid="copycat-enemy-george"]').click({
      position: { x: 16, y: 16 },
    });

    await expect.poll(async () => {
      const state = await game.getState();
      const copycat = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'copycat-hand');
      return copycat?.metadata?.copiedAbilityDefId === 'cyborg_apes_furious_george'
        && copycat?.metadata?.copiedAbilityUntilTurn === 1
        && state?.sys?.interaction?.current == null;
    }, {
      message: 'Copycat 选择 Furious George 后应先写入 copied metadata 并收口 prompt',
      timeout: 15000,
    }).toBe(true);

    const copycatHost = page.locator('[data-minion-uid="copycat-hand"]');
    await expect(copycatHost).toBeVisible({ timeout: 15000 });
    await screenshotLocator(copycatHost, 'yuanhou-copycat-copied-george-before-attach', testInfo);

    await page.locator('[data-card-uid="copycat-uplink-hand"]').click();
    await copycatHost.click();

    await expect.poll(async () => {
      const state = await game.getState();
      const copycat = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'copycat-hand');
      return state?.sys?.interaction?.current == null
        && copycat?.attachedActions?.some((action: any) => action?.uid === 'copycat-uplink-hand')
        && copycat?.attachedActions?.length === 1
        && !hasUid(state?.core?.players?.['0']?.hand, 'copycat-uplink-hand');
    }, {
      message: 'Copycat 复制 Furious George 后，真实附着一张行动应把该行动挂到自己身上',
      timeout: 15000,
    }).toBe(true);

    const copiedGeorgeBadge = page.locator('[data-minion-uid="copycat-hand"] [title*="shapeshifters_copycat_copied_power"]');
    await expect(copiedGeorgeBadge).toBeVisible({ timeout: 15000 });
    await expect(copiedGeorgeBadge).toHaveText('+1');
    await screenshotLocator(copycatHost, 'yuanhou-copycat-copied-george-after-attach-plus-one', testInfo);
  });

  test('变形者-Copycat-真实复制 Furious George 的持续加成会在回到下一回合时失效', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
                { uid: 'copycat-expire-hand', defId: 'shapeshifters_copycat', type: 'minion', owner: '0' },
                { uid: 'copycat-expire-uplink', defId: 'cyborg_apes_missing_uplink', type: 'action', owner: '0' },
              ],
              deck: [
                { uid: 'copycat-expire-p0-draw-a', defId: 'time_travelers_time_raider', type: 'minion', owner: '0' },
                { uid: 'copycat-expire-p0-draw-b', defId: 'time_travelers_time_walk', type: 'action', owner: '0' },
              ],
              discard: [],
              factions: ['shapeshifters', 'cyborg_apes'],
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
                { uid: 'copycat-expire-p1-draw-a', defId: 'cyborg_apes_baboom', type: 'minion', owner: '1' },
                { uid: 'copycat-expire-p1-draw-b', defId: 'cyborg_apes_juiced_up', type: 'action', owner: '1' },
              ],
              discard: [],
              factions: ['cyborg_apes'],
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
              minions: [
                {
                  uid: 'copycat-expire-enemy-george',
                  defId: 'cyborg_apes_furious_george',
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
                {
                  uid: 'copycat-expire-enemy-baboom',
                  defId: 'cyborg_apes_baboom',
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
          ],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="copycat-expire-hand"]').click();
    await page.getByTestId('base-zone-0').click();

    await expect.poll(async () => {
      const state = await game.getState();
      return state?.sys?.interaction?.current?.data?.sourceId === 'shapeshifters_copycat_choose'
        && state?.sys?.interaction?.current?.playerId === '0';
    }, {
      message: 'Copycat 打出后应进入真实选择另一玩家随从的 prompt',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-minion-uid="copycat-expire-enemy-george"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="copycat-expire-enemy-george"]')).toHaveCount(0);
    await page.locator('[data-minion-uid="copycat-expire-enemy-george"]').click({
      position: { x: 16, y: 16 },
    });

    await expect.poll(async () => {
      const state = await game.getState();
      const copycat = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'copycat-expire-hand');
      return copycat?.metadata?.copiedAbilityDefId === 'cyborg_apes_furious_george'
        && copycat?.metadata?.copiedAbilityUntilTurn === 1
        && state?.sys?.interaction?.current == null;
    }, {
      message: 'Copycat 选择 Furious George 后应写入 copied metadata 并收口 prompt',
      timeout: 15000,
    }).toBe(true);

    const copycatHost = page.locator('[data-minion-uid="copycat-expire-hand"]');
    await page.locator('[data-card-uid="copycat-expire-uplink"]').click();
    await copycatHost.click();

    await expect.poll(async () => {
      const state = await game.getState();
      const copycat = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'copycat-expire-hand');
      return state?.sys?.interaction?.current == null
        && hasUid(copycat?.attachedActions, 'copycat-expire-uplink')
        && !hasUid(state?.core?.players?.['0']?.hand, 'copycat-expire-uplink');
    }, {
      message: 'Copycat 复制 Furious George 后，真实附着 Missing Uplink 应先让本回合的 copied power 生效',
      timeout: 15000,
    }).toBe(true);

    const copiedGeorgeBadge = page.locator('[data-minion-uid="copycat-expire-hand"] [title*="shapeshifters_copycat_copied_power"]');
    await expect(copiedGeorgeBadge).toBeVisible({ timeout: 15000 });
    await expect(copiedGeorgeBadge).toHaveText('+1');
    await screenshotViewport(page, 'yuanhou-copycat-copied-george-expire-before-end-turn-board', testInfo);
    await screenshotLocator(copycatHost, 'yuanhou-copycat-copied-george-expire-before-end-turn', testInfo);

    await dismissSmashUpSpotlightQueueIfVisible(page);
    await page.getByTestId('su-end-turn-action-button').click();

    await expect.poll(async () => {
      const state = await game.getState();
      return state?.core?.currentPlayerIndex === 1
        && state?.sys?.phase === 'playCards'
        && state?.core?.turnNumber === 1
        && state?.sys?.interaction?.current == null;
    }, {
      message: 'P0 结束回合后应先正常进入 P1 的出牌阶段，且 copiedAbilityUntilTurn 仍处于同一 turnNumber',
      timeout: 20000,
    }).toBe(true);

    await page.getByTestId('su-end-turn-action-button').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const copycat = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'copycat-expire-hand');
      return state?.core?.currentPlayerIndex === 0
        && state?.sys?.phase === 'playCards'
        && state?.core?.turnNumber === 2
        && state?.sys?.interaction?.current == null
        && hasUid(copycat?.attachedActions, 'copycat-expire-uplink');
    }, {
      message: 'P1 结束回合后应回到 P0 的下一回合，且 Copycat 身上的行动仍保留以便验证 copied power 生命周期',
      timeout: 20000,
    }).toBe(true);

    await expect(copiedGeorgeBadge).toHaveCount(0);
    await screenshotViewport(page, 'yuanhou-copycat-copied-george-expired-next-turn-board', testInfo);
    await screenshotLocator(copycatHost, 'yuanhou-copycat-copied-george-expired-next-turn', testInfo);
  });

  test('变形者-Copycat-真实复制 Mimic 后只跟随最高印刷力量并忽略有效力量抬升', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
                { uid: 'copycat-mimic-hand', defId: 'shapeshifters_copycat', type: 'minion', owner: '0' },
                { uid: 'copycat-mimic-megalodon', defId: 'sharks_megalodon', type: 'minion', owner: '0' },
              ],
              deck: [],
              discard: [],
              factions: ['shapeshifters', 'sharks'],
              minionsPlayed: 0,
              minionLimit: 2,
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
              defId: 'base_the_vats',
              breakpoint: 18,
              minions: [
                {
                  uid: 'copycat-enemy-mimic',
                  defId: 'shapeshifters_mimic',
                  controller: '1',
                  owner: '1',
                  basePower: 0,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'copycat-boosted-two',
                  defId: 'sharks_mako',
                  controller: '1',
                  owner: '1',
                  basePower: 2,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [
                    { uid: 'copycat-boosted-two-evo', defId: 'cyborg_apes_cyberevolution', ownerId: '1' },
                  ],
                },
              ],
              ongoingActions: [],
            },
            {
              defId: 'base_portal_room',
              breakpoint: 20,
              minions: [],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="copycat-mimic-hand"]').click();
    await page.getByTestId('base-zone-0').click();

    await expect.poll(async () => {
      const state = await game.getState();
      return state?.sys?.interaction?.current?.data?.sourceId === 'shapeshifters_copycat_choose'
        && state?.sys?.interaction?.current?.playerId === '0';
    }, {
      message: 'Copycat 打出后应先进入真实选择另一玩家随从的 prompt',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-minion-uid="copycat-enemy-mimic"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="copycat-enemy-mimic"]')).toHaveCount(0);
    await page.locator('[data-minion-uid="copycat-enemy-mimic"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const copycat = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'copycat-mimic-hand');
      return copycat?.metadata?.copiedAbilityDefId === 'shapeshifters_mimic'
        && copycat?.metadata?.copiedAbilityUntilTurn === 1
        && state?.sys?.interaction?.current == null;
    }, {
      message: 'Copycat 选择 Mimic 后应先把 copied metadata 写到本体',
      timeout: 15000,
    }).toBe(true);

    const copycatHost = page.locator('[data-minion-uid="copycat-mimic-hand"]');
    const copiedMimicBadge = page.locator('[data-minion-uid="copycat-mimic-hand"] [title*="shapeshifters_copycat_copied_power"]');
    await expect(copiedMimicBadge).toHaveCount(0);
    await screenshotViewport(page, 'yuanhou-copycat-copied-mimic-before-printed-five', testInfo);

    await page.locator('[data-card-uid="copycat-mimic-megalodon"]').click();
    await page.getByTestId('base-zone-1').click();

    await expect.poll(async () => {
      const state = await game.getState();
      return hasUid(state?.core?.bases?.[1]?.minions, 'copycat-mimic-megalodon')
        && !hasUid(state?.core?.players?.['0']?.hand, 'copycat-mimic-megalodon')
        && state?.sys?.interaction?.current == null;
    }, {
      message: '真实打出 Megalodon 后，应把这张真正印刷 5 力随从放到第二基地上',
      timeout: 15000,
    }).toBe(true);

    await expect(copiedMimicBadge).toBeVisible({ timeout: 15000 });
    await expect(copiedMimicBadge).toHaveText('+3');
    await screenshotViewport(page, 'yuanhou-copycat-copied-mimic-after-printed-five-plus-three', testInfo);
  });

  test('变形者-Cellular Bonding-真实入口可选择同宿主附着行动并触发复制的回合结束抽牌', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
                { uid: 'cell-bond-hand', defId: 'shapeshifters_cellular_bonding', type: 'action', owner: '0' },
              ],
              deck: [{ uid: 'cell-draw-a', defId: 'cyborg_apes_baboom', type: 'minion', owner: '0' }],
              discard: [],
              factions: ['shapeshifters'],
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
              factions: ['cyborg_apes'],
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
              minions: [
                {
                  uid: 'cell-host',
                  defId: 'shapeshifters_mimic',
                  controller: '0',
                  owner: '0',
                  basePower: 2,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [
                    { uid: 'splice-attached', defId: 'shapeshifters_splice_as_nice', ownerId: '0' },
                    { uid: 'missing-uplink-attached', defId: 'cyborg_apes_missing_uplink', ownerId: '0' },
                  ],
                },
              ],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="cell-bond-hand"]').click();
    await page.locator('[data-minion-uid="cell-host"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const host = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'cell-host');
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'shapeshifters_cellular_bonding_choose'
        && host?.attachedActions?.some((action: any) => action.uid === 'cell-bond-hand') === true
        && optionIds.includes('splice-attached')
        && optionIds.includes('missing-uplink-attached')
        && !optionIds.includes('cell-bond-hand');
    }, {
      message: 'Cellular Bonding 真实打出后应附着到目标宿主，并只列同宿主其他附着行动作为复制候选',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-cellular-bonding-copy-action-prompt', testInfo);

    await page.locator('[data-option-id="missing-uplink-attached"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const host = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'cell-host');
      return state?.sys?.interaction?.current == null
        && host?.metadata?.cellularBondingCardUid === 'cell-bond-hand'
        && host?.metadata?.cellularBondingCopiedActionDefId === 'cyborg_apes_missing_uplink';
    }, {
      message: 'Cellular Bonding 选择 Missing Uplink 后应只在宿主写入对应 copied metadata',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-cellular-bonding-copied-missing-uplink', testInfo);

    await page.getByTestId('su-end-turn-action-button').click();
    for (const label of ['细胞结合', '丢失中继']) {
      const reactionButton = page.getByRole('button', { name: label, exact: true });
      if (await reactionButton.isVisible().catch(() => false)) {
        await reactionButton.click();
      }
    }
    await dismissSmashUpSpotlightQueueIfVisible(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const baseMinions = state?.core?.bases?.[0]?.minions ?? [];
      const host = baseMinions.find((minion: any) => minion.uid === 'cell-host');
      const deck = state?.core?.players?.['0']?.deck ?? [];
      const hand = state?.core?.players?.['0']?.hand ?? [];
      return state?.sys?.interaction?.current == null
        && hasUid(baseMinions, 'cell-host')
        && hasUid(hand, 'cell-draw-a')
        && !hasUid(deck, 'cell-draw-a')
        && host?.attachedActions?.some((action: any) => action.uid === 'cell-bond-hand') === true
        && host?.metadata?.cellularBondingCopiedActionDefId === 'cyborg_apes_missing_uplink';
    }, {
      message: 'Cellular Bonding 复制 Missing Uplink 后应在真实结束回合链路触发抽牌，且本卡继续附着在宿主上',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-cellular-bonding-copied-trigger-resolved', testInfo);
  });

  test('变形者-Cellular Bonding-本体被 Going Bananas 清掉后即使宿主残留 copied Missing Uplink metadata 也不应在回合结束继续抽牌', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
              deck: [
                { uid: 'cell-stale-draw-a', defId: 'time_travelers_time_raider', type: 'minion', owner: '0' },
                { uid: 'cell-stale-draw-b', defId: 'time_travelers_time_walk', type: 'action', owner: '0' },
                { uid: 'cell-stale-draw-c', defId: 'cyborg_apes_baboom', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['shapeshifters', 'cyborg_apes'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [
                { uid: 'cell-stale-enemy-bananas', defId: 'cyborg_apes_going_bananas', type: 'action', owner: '1' },
              ],
              deck: [
                { uid: 'cell-stale-p1-draw-a', defId: 'cyborg_apes_shielding', type: 'action', owner: '1' },
                { uid: 'cell-stale-p1-draw-b', defId: 'cyborg_apes_missing_uplink', type: 'action', owner: '1' },
              ],
              discard: [],
              factions: ['cyborg_apes'],
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
              minions: [
                {
                  uid: 'cell-stale-host',
                  defId: 'shapeshifters_mimic',
                  controller: '0',
                  owner: '0',
                  basePower: 2,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [
                    { uid: 'cell-stale-bonding', defId: 'shapeshifters_cellular_bonding', ownerId: '0' },
                    { uid: 'cell-stale-uplink', defId: 'cyborg_apes_missing_uplink', ownerId: '0' },
                  ],
                  metadata: {
                    cellularBondingCardUid: 'cell-stale-bonding',
                    cellularBondingCopiedActionDefId: 'cyborg_apes_missing_uplink',
                  },
                },
              ],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    const host = page.locator('[data-minion-uid="cell-stale-host"]');
    await expect(host).toBeVisible({ timeout: 15000 });
    await page.locator('[data-card-uid="cell-stale-enemy-bananas"]').click();
    await page.getByTestId('base-zone-0').click({ force: true });

    await expect.poll(async () => {
      const state = await game.getState();
      const liveHost = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'cell-stale-host');
      return state?.sys?.interaction?.current == null
        && !hasUid(liveHost?.attachedActions, 'cell-stale-bonding')
        && !hasUid(liveHost?.attachedActions, 'cell-stale-uplink')
        && liveHost?.metadata?.cellularBondingCardUid === 'cell-stale-bonding'
        && liveHost?.metadata?.cellularBondingCopiedActionDefId === 'cyborg_apes_missing_uplink'
        && !hasUid(state?.core?.players?.['1']?.hand, 'cell-stale-enemy-bananas')
        && hasUid(state?.core?.players?.['1']?.discard, 'cell-stale-enemy-bananas');
    }, {
      message: '敌方 Going Bananas 真实结算后应清掉宿主上的 Cellular Bonding 与原始 Missing Uplink，但宿主 metadata 仍残留以检验 stale copied trigger',
      timeout: 15000,
    }).toBe(true);

    await screenshotViewport(page, 'yuanhou-cellular-bonding-stale-missing-uplink-source-removed-board', testInfo);

    await dismissSmashUpSpotlightQueueIfVisible(page);
    await page.getByTestId('su-end-turn-action-button').click();

    await expect.poll(async () => {
      const state = await game.getState();
      return state?.core?.currentPlayerIndex === 0
        && state?.core?.turnNumber === 2
        && state?.sys?.phase === 'playCards'
        && state?.sys?.interaction?.current == null;
    }, {
      message: 'P1 结束回合后应先正常轮到 P0 的回合2，避免把 stale trigger 检查混进敌方回合',
      timeout: 15000,
    }).toBe(true);

    await dismissSmashUpSpotlightQueueIfVisible(page);
    await page.getByTestId('su-end-turn-action-button').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const liveHost = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'cell-stale-host');
      const p0Hand = state?.core?.players?.['0']?.hand ?? [];
      const p0Deck = state?.core?.players?.['0']?.deck ?? [];
      return state?.core?.currentPlayerIndex === 1
        && state?.core?.turnNumber === 2
        && state?.sys?.phase === 'playCards'
        && state?.sys?.interaction?.current == null
        && hasUid(p0Hand, 'cell-stale-draw-a')
        && hasUid(p0Hand, 'cell-stale-draw-b')
        && !hasUid(p0Hand, 'cell-stale-draw-c')
        && hasUid(p0Deck, 'cell-stale-draw-c')
        && !hasUid(liveHost?.attachedActions, 'cell-stale-enemy-bananas')
        && !hasUid(liveHost?.attachedActions, 'cell-stale-bonding')
        && liveHost?.metadata?.cellularBondingCardUid === 'cell-stale-bonding'
        && liveHost?.metadata?.cellularBondingCopiedActionDefId === 'cyborg_apes_missing_uplink';
    }, {
      message: 'P0 结束回合后即使宿主残留 copied Missing Uplink metadata，也只能拿正常抽2，不能再多抽第3张',
      timeout: 15000,
    }).toBe(true);

    await screenshotViewport(page, 'yuanhou-cellular-bonding-stale-missing-uplink-no-extra-draw-board', testInfo);
  });

  test('变形者-Cellular Bonding-真实复制 Splice as Nice 后在原行动离场时仍提供持续 +2 力量', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
                { uid: 'cell-power-hand', defId: 'shapeshifters_cellular_bonding', type: 'action', owner: '0' },
                { uid: 'shield-power-hand', defId: 'cyborg_apes_shielding', type: 'action', owner: '0' },
              ],
              deck: [],
              discard: [],
              factions: ['shapeshifters', 'cyborg_apes'],
              minionsPlayed: 1,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 2,
            },
            '1': {
              id: '1',
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
              defId: 'base_the_vats',
              breakpoint: 18,
              minions: [{
                uid: 'cell-power-host',
                defId: 'sharks_mako',
                controller: '0',
                owner: '0',
                basePower: 2,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [
                  { uid: 'enemy-splice-attached', defId: 'shapeshifters_splice_as_nice', ownerId: '1' },
                  { uid: 'own-uplink-attached', defId: 'cyborg_apes_missing_uplink', ownerId: '0' },
                ],
              }],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_monkey_lab'],
          baseDiscard: [],
        },
      },
    });

    const host = page.locator('[data-minion-uid="cell-power-host"]');
    await expect(host).toBeVisible({ timeout: 15000 });

    await page.locator('[data-card-uid="cell-power-hand"]').click();
    await host.click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const liveHost = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'cell-power-host');
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'shapeshifters_cellular_bonding_choose'
        && liveHost?.attachedActions?.some((action: any) => action.uid === 'cell-power-hand') === true
        && optionIds.includes('enemy-splice-attached')
        && optionIds.includes('own-uplink-attached')
        && !optionIds.includes('cell-power-hand');
    }, {
      message: 'Cellular Bonding 真实打出后应附着到宿主，并列出同宿主的 Splice 与 Missing Uplink 作为复制候选',
      timeout: 15000,
    }).toBe(true);

    await screenshotViewport(page, 'yuanhou-cellular-bonding-copy-splice-prompt', testInfo);
    await page.locator('[data-option-id="enemy-splice-attached"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const liveHost = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'cell-power-host');
      return state?.sys?.interaction?.current == null
        && liveHost?.metadata?.cellularBondingCardUid === 'cell-power-hand'
        && liveHost?.metadata?.cellularBondingCopiedActionDefId === 'shapeshifters_splice_as_nice';
    }, {
      message: 'Cellular Bonding 选择 Splice as Nice 后应只在宿主写入 copied Splice metadata',
      timeout: 15000,
    }).toBe(true);

    await page.locator('[data-card-uid="shield-power-hand"]').click();
    await host.click();

    await expect.poll(async () => {
      const state = await game.getState();
      const liveHost = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'cell-power-host');
      return state?.sys?.interaction?.current == null
        && hasUid(liveHost?.attachedActions, 'cell-power-hand')
        && hasUid(liveHost?.attachedActions, 'shield-power-hand')
        && hasUid(liveHost?.attachedActions, 'own-uplink-attached')
        && !hasUid(liveHost?.attachedActions, 'enemy-splice-attached')
        && hasUid(state?.core?.players?.['1']?.discard, 'enemy-splice-attached');
    }, {
      message: 'Shielding 真实打出后应清掉原始敌方 Splice，但保留 Cellular Bonding、本方 Shielding 与本方其他行动',
      timeout: 15000,
    }).toBe(true);

    const copiedPowerBadge = page.locator('[data-minion-uid="cell-power-host"] [title*="shapeshifters_cellular_bonding_copied_power"]');
    await expect(copiedPowerBadge).toBeVisible({ timeout: 15000 });
    await expect(copiedPowerBadge).toHaveText('+2');
    await screenshotViewport(page, 'yuanhou-cellular-bonding-copied-splice-after-original-removed', testInfo);
  });

  test('变形者-Cellular Bonding-真实复制 Juiced Up 后在原行动离场时仍按宿主全部附着行动数量提供倍增', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
                { uid: 'cell-juice-hand', defId: 'shapeshifters_cellular_bonding', type: 'action', owner: '0' },
                { uid: 'shield-juice-hand', defId: 'cyborg_apes_shielding', type: 'action', owner: '0' },
              ],
              deck: [],
              discard: [],
              factions: ['shapeshifters', 'cyborg_apes'],
              minionsPlayed: 1,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 2,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [],
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
            {
              defId: 'base_the_vats',
              breakpoint: 18,
              minions: [{
                uid: 'cell-juice-host',
                defId: 'sharks_mako',
                controller: '0',
                owner: '0',
                basePower: 2,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [
                  { uid: 'enemy-juice-attached', defId: 'cyborg_apes_juiced_up', ownerId: '1' },
                  { uid: 'own-uplink-juice-attached', defId: 'cyborg_apes_missing_uplink', ownerId: '0' },
                ],
              }],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_monkey_lab'],
          baseDiscard: [],
        },
      },
    });

    const host = page.locator('[data-minion-uid="cell-juice-host"]');
    await expect(host).toBeVisible({ timeout: 15000 });

    await page.locator('[data-card-uid="cell-juice-hand"]').click();
    await host.click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const liveHost = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'cell-juice-host');
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'shapeshifters_cellular_bonding_choose'
        && liveHost?.attachedActions?.some((action: any) => action.uid === 'cell-juice-hand') === true
        && optionIds.includes('enemy-juice-attached')
        && optionIds.includes('own-uplink-juice-attached')
        && !optionIds.includes('cell-juice-hand');
    }, {
      message: 'Cellular Bonding 真实打出后应附着到宿主，并列出同宿主的 Juiced Up 与 Missing Uplink 作为复制候选',
      timeout: 15000,
    }).toBe(true);

    await screenshotViewport(page, 'yuanhou-cellular-bonding-copy-juiced-up-prompt', testInfo);
    await page.locator('[data-option-id="enemy-juice-attached"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const liveHost = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'cell-juice-host');
      return state?.sys?.interaction?.current == null
        && liveHost?.metadata?.cellularBondingCardUid === 'cell-juice-hand'
        && liveHost?.metadata?.cellularBondingCopiedActionDefId === 'cyborg_apes_juiced_up';
    }, {
      message: 'Cellular Bonding 选择 Juiced Up 后应只在宿主写入 copied Juiced Up metadata',
      timeout: 15000,
    }).toBe(true);

    await page.locator('[data-card-uid="shield-juice-hand"]').click();
    await host.click();

    await expect.poll(async () => {
      const state = await game.getState();
      const liveHost = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'cell-juice-host');
      return state?.sys?.interaction?.current == null
        && hasUid(liveHost?.attachedActions, 'cell-juice-hand')
        && hasUid(liveHost?.attachedActions, 'shield-juice-hand')
        && hasUid(liveHost?.attachedActions, 'own-uplink-juice-attached')
        && !hasUid(liveHost?.attachedActions, 'enemy-juice-attached')
        && hasUid(state?.core?.players?.['1']?.discard, 'enemy-juice-attached')
        && liveHost?.metadata?.cellularBondingCopiedActionDefId === 'cyborg_apes_juiced_up';
    }, {
      message: 'Shielding 真实打出后应清掉原始敌方 Juiced Up，但保留复制态 Cellular Bonding 与本方其他行动',
      timeout: 15000,
    }).toBe(true);

    const copiedJuiceBadge = page.locator('[data-minion-uid="cell-juice-host"] [title*="shapeshifters_cellular_bonding_copied_power"]');
    await expect(copiedJuiceBadge).toBeVisible({ timeout: 15000 });
    await expect(copiedJuiceBadge).toHaveText('+6');
    await screenshotViewport(page, 'yuanhou-cellular-bonding-copied-juiced-up-after-original-removed', testInfo);
  });

  test('变形者-Cellular Bonding-真实代理 Monkey on Your Back 天赋可选择另一玩家低力量随从并把本卡放到底', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
              deck: [{ uid: 'cell-monkey-deck-bottom', defId: 'cyborg_apes_baboom', type: 'minion', owner: '0' }],
              discard: [],
              factions: ['shapeshifters', 'cyborg_apes'],
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
              factions: ['cyborg_apes'],
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
                  uid: 'cell-monkey-own-low',
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
                  uid: 'cell-monkey-host',
                  defId: 'cyborg_apes_furious_george',
                  controller: '0',
                  owner: '0',
                  basePower: 2,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [
                    { uid: 'cell-proxy-action', defId: 'shapeshifters_cellular_bonding', ownerId: '0' },
                    { uid: 'monkey-base-action', defId: 'cyborg_apes_monkey_on_your_back', ownerId: '0' },
                  ],
                  metadata: {
                    cellularBondingCardUid: 'cell-proxy-action',
                    cellularBondingCopiedActionDefId: 'cyborg_apes_monkey_on_your_back',
                  },
                },
                {
                  uid: 'cell-monkey-enemy-high',
                  defId: 'cyborg_apes_cyberback',
                  controller: '1',
                  owner: '1',
                  basePower: 5,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'cell-monkey-enemy-low-a',
                  defId: 'cyborg_apes_baboom',
                  controller: '1',
                  owner: '1',
                  basePower: 3,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'cell-monkey-enemy-low-b',
                  defId: 'cyborg_apes_clyde_2_0',
                  controller: '1',
                  owner: '1',
                  basePower: 4,
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

    const host = page.locator('[data-minion-uid="cell-monkey-host"]');
    await expect(host).toBeVisible({ timeout: 15000 });
    await host.hover();
    const cellProxyAction = page.locator('[data-attached-action-uid="cell-proxy-action"]');
    await expect(cellProxyAction).toBeVisible({ timeout: 15000 });
    await cellProxyAction.click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: { id?: unknown }) => option?.id);
      return prompt?.data?.sourceId === 'cyborg_apes_monkey_on_your_back_choose'
        && prompt?.playerId === '0'
        && optionIds.includes('cell-monkey-enemy-low-a')
        && optionIds.includes('cell-monkey-enemy-low-b')
        && !optionIds.includes('cell-monkey-enemy-high')
        && !optionIds.includes('cell-monkey-own-low');
    }, {
      message: 'Cellular Bonding 复制 Monkey on Your Back 后，应只列同基地另一玩家力量 4 或以下随从',
      timeout: 15000,
    }).toBe(true);

    await screenshotViewport(page, 'yuanhou-cellular-bonding-copied-monkey-talent-prompt', testInfo);

    await page.locator('[data-minion-uid="cell-monkey-enemy-low-b"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const baseMinions = state?.core?.bases?.[0]?.minions ?? [];
      const hostAfter = baseMinions.find((minion: { uid?: unknown }) => minion?.uid === 'cell-monkey-host');
      const p0DeckUids = (state?.core?.players?.['0']?.deck ?? []).map((card: { uid?: unknown }) => card?.uid);
      const p1Discard = state?.core?.players?.['1']?.discard ?? [];
      return state?.sys?.interaction?.current == null
        && baseMinions.some((minion: { uid?: unknown }) => minion?.uid === 'cell-monkey-enemy-low-a')
        && !baseMinions.some((minion: { uid?: unknown }) => minion?.uid === 'cell-monkey-enemy-low-b')
        && baseMinions.some((minion: { uid?: unknown }) => minion?.uid === 'cell-monkey-enemy-high')
        && baseMinions.some((minion: { uid?: unknown }) => minion?.uid === 'cell-monkey-own-low')
        && baseMinions.some((minion: { uid?: unknown }) => minion?.uid === 'cell-monkey-host')
        && !hasUid(hostAfter?.attachedActions, 'cell-proxy-action')
        && hasUid(hostAfter?.attachedActions, 'monkey-base-action')
        && p0DeckUids.join(',') === 'cell-monkey-deck-bottom,cell-proxy-action'
        && hasUid(p1Discard, 'cell-monkey-enemy-low-b');
    }, {
      message: '复制 Monkey on Your Back 后，应只摧毁被选低力量敌方目标，并把 Cellular Bonding 放到底',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-minion-uid="cell-monkey-enemy-low-b"]')).toBeHidden({ timeout: 15000 });
    await expect(page.getByText('猴子在你的背上：选择要摧毁的随从')).toBeHidden({ timeout: 15000 });
    await screenshotViewport(page, 'yuanhou-cellular-bonding-copied-monkey-talent-resolved', testInfo);
  });

  test('变形者-Cellular Bonding-真实计分后可代理 Flying Monkey 移动宿主并摧毁本行动', async ({ page, game }, testInfo) => {
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
              hand: [],
              deck: [
                { uid: 'cell-flying-draw-a', defId: 'cyborg_apes_cyberback', type: 'minion', owner: '0' },
                { uid: 'cell-flying-draw-b', defId: 'cyborg_apes_chimp_chi', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['shapeshifters', 'cyborg_apes'],
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
              factions: ['super_spies'],
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
                uid: 'cell-flying-host',
                defId: 'shapeshifters_mimic',
                controller: '0',
                owner: '0',
                basePower: 24,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [
                  { uid: 'cell-flying-action', defId: 'shapeshifters_cellular_bonding', ownerId: '0' },
                ],
                metadata: {
                  cellularBondingCardUid: 'cell-flying-action',
                  cellularBondingCopiedActionDefId: 'cyborg_apes_flying_monkey',
                },
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

    await game.waitForPhase('playCards', 10000);
    await game.advancePhase();
    await game.waitForPhase('scoreBases', 10000);

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionLabels = (prompt?.data?.options ?? []).map((option: any) => option?.label);
      return prompt?.data?.sourceId === 'cyborg_apes_flying_monkey_move'
        && prompt?.playerId === '0'
        && optionLabels.some((label: string) => label?.includes('秘密火山总部'))
        && optionLabels.some((label: string) => label?.includes('跳过'));
    }, {
      message: 'Cellular Bonding 复制 Flying Monkey 后，真实计分应给拥有者一个可跳过的移动宿主 prompt',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('heading', { name: /细胞结合-飞猴：选择要移动到的另一基地/ })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /秘密火山总部/ })).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-cellular-bonding-copied-flying-monkey-prompt', testInfo);
    await page.getByRole('button', { name: /秘密火山总部/ }).click({ force: true });

    await expect.poll(async () => {
      const state = await game.getState();
      const sourceBase = state?.core?.bases?.[0];
      const destinationBase = state?.core?.bases?.[1];
      const movedHost = destinationBase?.minions?.find((minion: any) => minion.uid === 'cell-flying-host');
      const p0Hand = state?.core?.players?.['0']?.hand ?? [];
      const p0Discard = state?.core?.players?.['0']?.discard ?? [];
      return state?.sys?.interaction?.current == null
        && sourceBase?.defId === 'base_portal_room'
        && sourceBase?.minions?.every((minion: any) => minion.uid !== 'cell-flying-host')
        && destinationBase?.defId === 'base_secret_volcano_headquarters'
        && hasUid(destinationBase?.minions, 'cell-flying-host')
        && movedHost?.attachedActions?.every((action: any) => action.uid !== 'cell-flying-action')
        && hasUid(p0Discard, 'cell-flying-action')
        && hasUid(p0Hand, 'cell-flying-draw-a')
        && hasUid(p0Hand, 'cell-flying-draw-b');
    }, {
      message: 'Cellular Bonding 复制 Flying Monkey 后，应在真实计分后移动宿主、摧毁本卡并完成换基地收口',
      timeout: 20000,
    }).toBe(true);

    await expect(page.getByRole('heading', { name: /细胞结合-飞猴：选择要移动到的另一基地/ })).toBeHidden({ timeout: 15000 });
    await game.screenshot('yuanhou-cellular-bonding-copied-flying-monkey-resolved', testInfo);
  });

  test('变形者-Cellular Bonding-真实复制 Shielding 后在原护盾离场时仍保护宿主其他行动且自己不会错误自保', async ({ page, game }, testInfo) => {
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
                { uid: 'cell-shield-hand', defId: 'shapeshifters_cellular_bonding', type: 'action', owner: '0' },
              ],
              deck: [
                { uid: 'p0-draw-a', defId: 'cyborg_apes_furious_george', type: 'minion', owner: '0' },
                { uid: 'p0-draw-b', defId: 'cyborg_apes_cyberback', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['shapeshifters', 'cyborg_apes'],
              minionsPlayed: 1,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [
                { uid: 'bananas-a', defId: 'cyborg_apes_going_bananas', type: 'action', owner: '1' },
                { uid: 'bananas-b', defId: 'cyborg_apes_going_bananas', type: 'action', owner: '1' },
              ],
              deck: [
                { uid: 'p1-draw-a', defId: 'cyborg_apes_furious_george', type: 'minion', owner: '1' },
                { uid: 'p1-draw-b', defId: 'cyborg_apes_cyberback', type: 'minion', owner: '1' },
              ],
              discard: [],
              factions: ['cyborg_apes'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 2,
            },
          },
          bases: [
            {
              defId: 'base_monkey_lab',
              breakpoint: 20,
              minions: [{
                uid: 'cell-shield-host',
                defId: 'shapeshifters_mimic',
                controller: '0',
                owner: '0',
                basePower: 2,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [
                  { uid: 'protected-action', defId: 'cyborg_apes_cyberevolution', ownerId: '0' },
                  { uid: 'shield-attached', defId: 'cyborg_apes_shielding', ownerId: '0' },
                ],
              }],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_the_vats'],
          baseDiscard: [],
        },
      },
    });

    const host = page.locator('[data-minion-uid="cell-shield-host"]');
    await expect(host).toBeVisible({ timeout: 15000 });

    await page.locator('[data-card-uid="cell-shield-hand"]').click();
    await host.click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      const liveHost = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'cell-shield-host');
      return prompt?.data?.sourceId === 'shapeshifters_cellular_bonding_choose'
        && liveHost?.attachedActions?.some((action: any) => action.uid === 'cell-shield-hand') === true
        && optionIds.includes('shield-attached')
        && optionIds.includes('protected-action')
        && !optionIds.includes('cell-shield-hand');
    }, {
      message: 'Cellular Bonding 真实打出后应只列同宿主旧附着行动，并允许玩家明确复制 Shielding',
      timeout: 15000,
    }).toBe(true);

    await screenshotViewport(page, 'yuanhou-cellular-bonding-copy-shielding-prompt', testInfo);
    await page.locator('[data-option-id="shield-attached"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const liveHost = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'cell-shield-host');
      return state?.sys?.interaction?.current == null
        && liveHost?.metadata?.cellularBondingCardUid === 'cell-shield-hand'
        && liveHost?.metadata?.cellularBondingCopiedActionDefId === 'cyborg_apes_shielding';
    }, {
      message: 'Cellular Bonding 选择 Shielding 后应只在宿主写入 copied Shielding metadata',
      timeout: 15000,
    }).toBe(true);

    await page.getByTestId('su-end-turn-action-button').click();

    await expect.poll(async () => {
      const state = await game.getState();
      return state?.sys?.phase === 'playCards'
        && state?.core?.currentPlayerIndex === 1
        && hasUid(state?.core?.players?.['1']?.hand, 'bananas-a')
        && hasUid(state?.core?.players?.['1']?.hand, 'bananas-b');
    }, {
      message: 'P0 结束回合后应轮到 P1，且两张 Going Bananas 都仍在手牌',
      timeout: 20000,
    }).toBe(true);

    await page.locator('[data-card-uid="bananas-a"]').click();
    await page.locator('[data-base-index="0"]').click();
    await dismissSmashUpSpotlightQueueIfVisible(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const liveHost = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'cell-shield-host');
      const p0Discard = state?.core?.players?.['0']?.discard ?? [];
      const p1Discard = state?.core?.players?.['1']?.discard ?? [];
      return state?.sys?.interaction?.current == null
        && hasUid(liveHost?.attachedActions, 'cell-shield-hand')
        && hasUid(liveHost?.attachedActions, 'protected-action')
        && !hasUid(liveHost?.attachedActions, 'shield-attached')
        && hasUid(p0Discard, 'shield-attached')
        && !hasUid(p0Discard, 'cell-shield-hand')
        && !hasUid(p0Discard, 'protected-action')
        && hasUid(p1Discard, 'bananas-a')
        && hasUid(state?.core?.players?.['1']?.hand, 'bananas-b');
    }, {
      message: '第一张 Going Bananas 应先只清掉原始 Shielding，留下复制态 Cellular Bonding 和受保护行动',
      timeout: 15000,
    }).toBe(true);

    await screenshotLocator(host, 'yuanhou-cellular-bonding-copied-shielding-after-first-bananas', testInfo);

    await page.getByTestId('su-end-turn-action-button').click();

    await expect.poll(async () => {
      const state = await game.getState();
      return state?.sys?.phase === 'playCards'
        && state?.core?.currentPlayerIndex === 0;
    }, {
      message: 'P1 第一张 Going Bananas 结算后，应能正常结束回合并轮到 P0',
      timeout: 20000,
    }).toBe(true);

    await page.getByTestId('su-end-turn-action-button').click();

    await expect.poll(async () => {
      const state = await game.getState();
      return state?.sys?.phase === 'playCards'
        && state?.core?.currentPlayerIndex === 1
        && hasUid(state?.core?.players?.['1']?.hand, 'bananas-b');
    }, {
      message: 'P0 结束自己的空回合后，应再次轮到 P1 且第二张 Going Bananas 仍在手牌',
      timeout: 20000,
    }).toBe(true);

    await page.locator('[data-card-uid="bananas-b"]').click();
    await page.locator('[data-base-index="0"]').click();
    await dismissSmashUpSpotlightQueueIfVisible(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const liveHost = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'cell-shield-host');
      const p0Discard = state?.core?.players?.['0']?.discard ?? [];
      const p1Discard = state?.core?.players?.['1']?.discard ?? [];
      return state?.sys?.interaction?.current == null
        && hasUid(state?.core?.bases?.[0]?.minions, 'cell-shield-host')
        && hasUid(liveHost?.attachedActions, 'protected-action')
        && !hasUid(liveHost?.attachedActions, 'cell-shield-hand')
        && !hasUid(liveHost?.attachedActions, 'shield-attached')
        && hasUid(p0Discard, 'cell-shield-hand')
        && !hasUid(p0Discard, 'protected-action')
        && hasUid(p1Discard, 'bananas-a')
        && hasUid(p1Discard, 'bananas-b');
    }, {
      message: '原始 Shielding 离场后的下一次真实 Going Bananas，应证明复制态 Shielding 仍保护宿主其他行动，但不应让 Cellular Bonding 自己错误自保',
      timeout: 15000,
    }).toBe(true);

    await screenshotLocator(host, 'yuanhou-cellular-bonding-copied-shielding-after-second-bananas', testInfo);
  });

  test('时间旅行者-Doctor When-真实入口可选择另一个己方随从回手并可额外打回', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
                { uid: 'doctor-hand', defId: 'time_travelers_doctor_when', type: 'minion', owner: '0' },
                { uid: 'same-raider-hand', defId: 'time_travelers_time_raider', type: 'minion', owner: '0' },
              ],
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
              minions: [
                {
                  uid: 'jumper-a',
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
                  uid: 'raider-a',
                  defId: 'time_travelers_time_raider',
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
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="doctor-hand"]').click();
    await page.getByTestId('base-zone-0').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'time_travelers_doctor_when_choose'
        && prompt?.playerId === '0'
        && optionIds.includes('jumper-a')
        && optionIds.includes('raider-a')
        && !optionIds.includes('doctor-hand')
        && hasSkipOption(prompt?.data?.options);
    }, {
      message: 'Doctor When 打出后应让 P1 选择另一个己方随从或跳过，不能把 Doctor 自身列为候选',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-minion-uid="jumper-a"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="raider-a"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="raider-a"]')).toHaveCount(0);
    await game.screenshot('yuanhou-doctor-when-return-choice-prompt', testInfo);

    await page.locator('[data-minion-uid="raider-a"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      const hand = state?.core?.players?.['0']?.hand ?? [];
      const promptCardUids = (prompt?.data?.options ?? [])
        .map((option: any) => option?.value?.cardUid)
        .filter((uid: unknown): uid is string => typeof uid === 'string');
      return prompt?.data?.sourceId === 'smashup_immediate_extra_minion'
        && prompt?.playerId === '0'
        && hasUid(hand, 'raider-a')
        && !hasUid(minions, 'raider-a')
        && promptCardUids.includes('raider-a')
        && !promptCardUids.includes('same-raider-hand')
        && !promptCardUids.includes('doctor-hand')
        && hasSkipOption(prompt?.data?.options);
    }, {
      message: 'Doctor When 返回 Raider 后应给同一玩家一个可跳过的 specific-card immediate extra prompt',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-doctor-when-extra-minion-prompt', testInfo);

    await page.locator('[data-card-uid="raider-a"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      const hand = state?.core?.players?.['0']?.hand ?? [];
      return state?.sys?.interaction?.current == null
        && hasUid(minions, 'doctor-hand')
        && hasUid(minions, 'jumper-a')
        && hasUid(minions, 'raider-a')
        && !hasUid(hand, 'raider-a')
        && hasUid(hand, 'same-raider-hand');
    }, {
      message: 'Doctor When extra prompt 选择 Raider 后应把同一随从额外打回基地并收口',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '放弃这次额外随从' })).toBeHidden({ timeout: 15000 });
    await game.screenshot('yuanhou-doctor-when-returned-minion-replayed', testInfo);
  });

  test('时间旅行者-Into the Time Slip-真实入口让被他人控制的随从回到其拥有者而不是控制者手牌', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
              hand: [{ uid: 'slip-hand', defId: 'time_travelers_into_the_time_slip', type: 'action', owner: '0' }],
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
              factions: ['cyborg_apes'],
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
              uid: 'borrowed-slip-minion',
              defId: 'sharks_mako',
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

    await page.locator('[data-card-uid="slip-hand"]').click();
    await page.locator('[data-card-uid="slip-hand"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      const p0Hand = state?.core?.players?.['0']?.hand ?? [];
      const p1Hand = state?.core?.players?.['1']?.hand ?? [];
      return state?.sys?.interaction?.current == null
        && !hasUid(minions, 'borrowed-slip-minion')
        && hasUid(p0Hand, 'borrowed-slip-minion')
        && !hasUid(p1Hand, 'borrowed-slip-minion');
    }, {
      message: 'Into the Time Slip 在真实场上只剩 borrowed-slip-minion 这一个候选时，应自动把它回到 owner=P0 手牌，而不是 controller=P1 手牌',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-into-the-time-slip-borrowed-minion-returned-to-owner-hand', testInfo);
  });

  test('时间旅行者-Into the Time Slip-真实入口只剩一个场上候选时应自动回手且不弹 prompt', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
              hand: [{ uid: 'slip-single-hand', defId: 'time_travelers_into_the_time_slip', type: 'action', owner: '0' }],
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
          bases: [{
            defId: 'base_portal_room',
            breakpoint: 20,
            minions: [],
            ongoingActions: [{
              uid: 'slip-single-stasis',
              defId: 'time_travelers_stasis_field',
              ownerId: '1',
            }],
          }],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await screenshotViewport(page, 'yuanhou-into-the-time-slip-single-candidate-before-play', testInfo);

    await page.locator('[data-card-uid="slip-single-hand"]').click();
    await page.locator('[data-card-uid="slip-single-hand"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const base = state?.core?.bases?.[0];
      const p0Hand = state?.core?.players?.['0']?.hand ?? [];
      const p1Hand = state?.core?.players?.['1']?.hand ?? [];
      return state?.sys?.interaction?.current == null
        && !hasUid(base?.ongoingActions ?? [], 'slip-single-stasis')
        && hasUid(p1Hand, 'slip-single-stasis')
        && !hasUid(p0Hand, 'slip-single-stasis');
    }, {
      message: 'Into the Time Slip 在真实入口只剩一个场上候选时，应直接把该牌回到 owner=P1 手牌且不创建选择 prompt',
      timeout: 15000,
    }).toBe(true);

    await dismissSmashUpSpotlightQueueIfVisible(page);
    await screenshotViewport(page, 'yuanhou-into-the-time-slip-single-candidate-auto-resolved-without-prompt', testInfo);
  });

  test('时间旅行者-Into the Time Slip-真实入口可选择场上的持续行动并回到其拥有者手牌', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
              hand: [{ uid: 'slip-action-hand', defId: 'time_travelers_into_the_time_slip', type: 'action', owner: '0' }],
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
          bases: [{
            defId: 'base_portal_room',
            breakpoint: 20,
            minions: [{
              uid: 'slip-anchor-minion',
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
            }],
            ongoingActions: [{
              uid: 'slip-stasis-a',
              defId: 'time_travelers_stasis_field',
              ownerId: '1',
            }],
          }],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="slip-action-hand"]').click();
    await page.locator('[data-card-uid="slip-action-hand"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'time_travelers_into_the_time_slip_choose'
        && prompt?.playerId === '0'
        && optionIds.includes('slip-stasis-a');
    }, {
      message: 'Into the Time Slip 打出后应允许选择场上的 base ongoing 行动 slip-stasis-a',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-into-the-time-slip-ongoing-action-choice-prompt', testInfo);

    await page.locator('[data-option-id="slip-stasis-a"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const base = state?.core?.bases?.[0];
      const p0Hand = state?.core?.players?.['0']?.hand ?? [];
      const p1Hand = state?.core?.players?.['1']?.hand ?? [];
      return state?.sys?.interaction?.current == null
        && !hasUid(base?.ongoingActions ?? [], 'slip-stasis-a')
        && hasUid(p1Hand, 'slip-stasis-a')
        && !hasUid(p0Hand, 'slip-stasis-a');
    }, {
      message: 'Into the Time Slip 选中场上的持续行动后，应回到 owner=P1 手牌，而不是当前玩家 P0 手牌',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-into-the-time-slip-ongoing-action-returned-to-owner-hand', testInfo);
  });

  test('时间旅行者-Into the Time Slip-真实入口可选择附着行动并回到其拥有者手牌', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
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
              hand: [{ uid: 'slip-attached-hand', defId: 'time_travelers_into_the_time_slip', type: 'action', owner: '0' }],
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
              factions: ['cyborg_apes'],
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
              uid: 'slip-host-minion',
              defId: 'sharks_mako',
              controller: '0',
              owner: '0',
              basePower: 2,
              powerCounters: 0,
              powerModifier: 0,
              tempPowerModifier: 0,
              talentUsed: false,
              playedThisTurn: false,
              attachedActions: [{ uid: 'slip-attached-a', defId: 'cyborg_apes_shielding', ownerId: '1' }],
            }],
            ongoingActions: [],
          }],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="slip-attached-hand"]').click();
    await page.locator('[data-card-uid="slip-attached-hand"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'time_travelers_into_the_time_slip_choose'
        && prompt?.playerId === '0'
        && optionIds.includes('slip-attached-a');
    }, {
      message: 'Into the Time Slip 打出后应允许选择附着在随从上的行动 slip-attached-a',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-into-the-time-slip-attached-action-choice-prompt', testInfo);

    await page.locator('[data-option-id="slip-attached-a"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const attachedActions = state?.core?.bases?.[0]?.minions?.[0]?.attachedActions ?? [];
      const p0Hand = state?.core?.players?.['0']?.hand ?? [];
      const p1Hand = state?.core?.players?.['1']?.hand ?? [];
      return state?.sys?.interaction?.current == null
        && !hasUid(attachedActions, 'slip-attached-a')
        && hasUid(p1Hand, 'slip-attached-a')
        && !hasUid(p0Hand, 'slip-attached-a');
    }, {
      message: 'Into the Time Slip 选中附着行动后，应从宿主身上移除并回到 owner=P1 手牌',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-into-the-time-slip-attached-action-returned-to-owner-hand', testInfo);
  });

  test('时间旅行者-Time Box-真实天赋可在正常额度用尽后额外打低战力随从与额外行动', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
                { uid: 'time-box-low-minion', defId: 'time_travelers_jumper', type: 'minion', owner: '0' },
                { uid: 'time-box-extra-action', defId: 'cyborg_apes_juiced_up', type: 'action', owner: '0' },
              ],
              deck: [],
              discard: [],
              factions: ['time_travelers', 'cyborg_apes'],
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
              factions: ['time_travelers', 'cyborg_apes'],
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
                uid: 'time-box-host',
                defId: 'cyborg_apes_furious_george',
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
          titans: [{
            uid: 'titan-time-box-live',
            defId: 'time_travelers_time_box',
            faction: 'time_travelers',
            ownerId: '0',
            controllerId: '0',
            powerCounters: 0,
            talentUsed: false,
            metadata: { timeBoxCounters: 0 },
            location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
          }],
          baseDeck: [],
          baseDiscard: [],
        },
      },
    });

    await screenshotViewport(page, 'yuanhou-time-box-talent-ready', testInfo);
    await screenshotLocator(page.locator('[data-card-uid="time-box-low-minion"]'), 'yuanhou-time-box-talent-low-minion-hand', testInfo);
    await screenshotLocator(page.locator('[data-card-uid="time-box-extra-action"]'), 'yuanhou-time-box-talent-extra-action-hand', testInfo);

    await page.locator('[data-titan-uid="titan-time-box-live"]').click({ force: true });

    await expect.poll(async () => {
      const state = await game.getState();
      const titan = (state?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'titan-time-box-live');
      return titan?.talentUsed === true;
    }, {
      message: 'Time Box 点击天赋后应立即标记 talentUsed=true',
      timeout: 15000,
    }).toBe(true);

    await screenshotViewport(page, 'yuanhou-time-box-talent-activated', testInfo);

    await page.locator('[data-card-uid="time-box-low-minion"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const base0Class = (await page.getByTestId('base-zone-0').getAttribute('class')) ?? '';
      const base1Class = (await page.getByTestId('base-zone-1').getAttribute('class')) ?? '';
      return prompt == null
        && !base0Class.includes('cursor-not-allowed')
        && base1Class.includes('cursor-not-allowed');
    }, {
      message: 'Time Box 额外随从选牌后，应进入棋盘直选态且只把 Titan 所在基地保留为可落点，别的基地必须置灰',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '放弃这次额外随从' })).toHaveCount(0);
    await screenshotViewport(page, 'yuanhou-time-box-talent-board-direct-after-minion-choice', testInfo);

    await page.getByTestId('base-zone-0').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const baseMinions = state?.core?.bases?.[0]?.minions ?? [];
      const hand = state?.core?.players?.['0']?.hand ?? [];
      return hasUid(baseMinions, 'time-box-low-minion')
        && !hasUid(hand, 'time-box-low-minion');
    }, {
      message: 'Time Box 额外低战力随从应在正常随从额度已用尽时仍能打到 Titan 所在基地',
      timeout: 15000,
    }).toBe(true);

    await screenshotViewport(page, 'yuanhou-time-box-talent-low-minion-played', testInfo);

    await page.locator('[data-card-uid="time-box-extra-action"]').click();
    await page.locator('[data-minion-uid="time-box-low-minion"]').click({ force: true });

    await expect.poll(async () => {
      const state = await game.getState();
      const hand = state?.core?.players?.['0']?.hand ?? [];
      const baseMinions = state?.core?.bases?.[0]?.minions ?? [];
      const playedLowMinion = baseMinions.find((candidate: any) => candidate?.uid === 'time-box-low-minion');
      return state?.sys?.interaction?.current == null
        && !hasUid(hand, 'time-box-extra-action')
        && Array.isArray(playedLowMinion?.attachedActions)
        && hasUid(playedLowMinion.attachedActions, 'time-box-extra-action')
        && state?.core?.players?.['0']?.actionsPlayed === 2;
    }, {
      message: 'Time Box 额外行动应在正常行动额度已用尽时仍能打出，并附着到所选随从上',
      timeout: 15000,
    }).toBe(true);

    await dismissSmashUpSpotlightQueueIfVisible(page);
    await page.locator('[data-minion-uid="time-box-low-minion"]').hover();
    await screenshotLocator(page.locator('[data-minion-uid="time-box-low-minion"]'), 'yuanhou-time-box-talent-low-minion-on-base', testInfo);
    await screenshotLocator(page.locator('[data-attached-action-uid="time-box-extra-action"]'), 'yuanhou-time-box-talent-extra-action-attached', testInfo);
    await screenshotViewport(page, 'yuanhou-time-box-talent-resolved', testInfo);
  });

  test('超级间谍-For My Eyes Only-真实入口可查看自己牌库顶五张并按非默认顶底顺序放回', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
              hand: [{ uid: 'eyes-hand', defId: 'super_spies_for_my_eyes_only', type: 'action', owner: '0' }],
              deck: [
                { uid: 'eyes-deck-a', defId: 'super_spies_spy', type: 'minion', owner: '0' },
                { uid: 'eyes-deck-b', defId: 'super_spies_operative', type: 'minion', owner: '0' },
                { uid: 'eyes-deck-c', defId: 'super_spies_mole', type: 'minion', owner: '0' },
                { uid: 'eyes-deck-d', defId: 'super_spies_secret_agent', type: 'minion', owner: '0' },
                { uid: 'eyes-deck-e', defId: 'time_travelers_jumper', type: 'minion', owner: '0' },
                { uid: 'eyes-deck-f', defId: 'time_travelers_doctor_when', type: 'minion', owner: '0' },
              ],
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
            { defId: 'base_secret_volcano_headquarters', breakpoint: 18, minions: [], ongoingActions: [] },
            { defId: 'base_portal_room', breakpoint: 20, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="eyes-hand"]').click();
    await page.locator('[data-card-uid="eyes-hand"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'super_spies_for_my_eyes_only_reorder'
        && prompt?.playerId === '0'
        && optionIds.length > 0;
    }, {
      message: 'For My Eyes Only 真实打出后应查看自己牌库顶五张，并进入顶/底顺序选择 prompt',
      timeout: 15000,
    }).toBe(true);

    await expectOwnedOverlayPromptChromeSuppressed(page);

    await game.screenshot('yuanhou-for-my-eyes-only-top-five-reorder-prompt', testInfo);
    await page.locator('[data-deck-reorder-card-uid="eyes-deck-e"]').click();
    await page.getByRole('button', { name: '移到牌库底' }).click();
    await page.locator('[data-deck-reorder-card-uid="eyes-deck-b"]').click();
    await page.getByRole('button', { name: '移到牌库底' }).click();
    await page.locator('[data-deck-reorder-card-uid="eyes-deck-d"]').click();
    await page.getByRole('button', { name: '移到牌库底' }).click();
    await page.locator('[data-deck-reorder-card-uid="eyes-deck-c"]').click();
    await page.getByRole('button', { name: '前移' }).click();
    await page.getByRole('button', { name: '确认顺序' }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      const deck = state?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
      const discard = state?.core?.players?.['0']?.discard?.map((card: any) => card.uid) ?? [];
      return state?.sys?.interaction?.current == null
        && deck.join(',') === 'eyes-deck-c,eyes-deck-a,eyes-deck-f,eyes-deck-e,eyes-deck-b,eyes-deck-d'
        && discard.includes('eyes-hand');
    }, {
      message: 'For My Eyes Only 应只重排本次查看的顶五张；未查看第六张保留在中段，本行动进入弃牌堆',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-for-my-eyes-only-top-five-reordered-deck-resolved', testInfo);
  });

  test('超级间谍-For My Eyes Only-真实入口空选重排后应保持牌库默认顺序并直接收口', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
              hand: [{ uid: 'eyes-empty-choice-hand', defId: 'super_spies_for_my_eyes_only', type: 'action', owner: '0' }],
              deck: [
                { uid: 'eyes-empty-choice-deck-a', defId: 'super_spies_spy', type: 'minion', owner: '0' },
                { uid: 'eyes-empty-choice-deck-b', defId: 'super_spies_operative', type: 'minion', owner: '0' },
                { uid: 'eyes-empty-choice-deck-c', defId: 'super_spies_mole', type: 'minion', owner: '0' },
                { uid: 'eyes-empty-choice-deck-d', defId: 'super_spies_secret_agent', type: 'minion', owner: '0' },
                { uid: 'eyes-empty-choice-deck-e', defId: 'time_travelers_jumper', type: 'minion', owner: '0' },
                { uid: 'eyes-empty-choice-deck-f', defId: 'time_travelers_doctor_when', type: 'minion', owner: '0' },
              ],
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
            { defId: 'base_secret_volcano_headquarters', breakpoint: 18, minions: [], ongoingActions: [] },
            { defId: 'base_portal_room', breakpoint: 20, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="eyes-empty-choice-hand"]').click();
    await page.locator('[data-card-uid="eyes-empty-choice-hand"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'super_spies_for_my_eyes_only_reorder'
        && prompt?.playerId === '0'
        && optionIds.length > 0;
    }, {
      message: 'For My Eyes Only 真实打出后应进入顶/底顺序选择 prompt，允许不选任何牌直接确认默认顺序',
      timeout: 15000,
    }).toBe(true);

    await expectOwnedOverlayPromptChromeSuppressed(page);
    await game.screenshot('yuanhou-for-my-eyes-only-empty-selection-prompt', testInfo);
    await page.getByRole('button', { name: '确认顺序' }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      const deck = state?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
      const discard = state?.core?.players?.['0']?.discard?.map((card: any) => card.uid) ?? [];
      return state?.sys?.interaction?.current == null
        && deck.join(',') === 'eyes-empty-choice-deck-a,eyes-empty-choice-deck-b,eyes-empty-choice-deck-c,eyes-empty-choice-deck-d,eyes-empty-choice-deck-e,eyes-empty-choice-deck-f'
        && discard.includes('eyes-empty-choice-hand');
    }, {
      message: 'For My Eyes Only 空选重排后应保持牌库默认顺序，仅把本行动送入弃牌堆并直接收口',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-for-my-eyes-only-empty-selection-resolved', testInfo);
  });

  test('超级间谍-For My Eyes Only-牌库只剩一张时真实入口应自动查看且不弹重排 prompt', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
              hand: [{ uid: 'eyes-single-hand', defId: 'super_spies_for_my_eyes_only', type: 'action', owner: '0' }],
              deck: [
                { uid: 'eyes-single-deck-a', defId: 'super_spies_secret_agent', type: 'minion', owner: '0' },
              ],
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
            { defId: 'base_secret_volcano_headquarters', breakpoint: 18, minions: [], ongoingActions: [] },
            { defId: 'base_portal_room', breakpoint: 20, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await expect(page.locator('[data-card-uid="eyes-single-hand"]')).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-for-my-eyes-only-single-card-before-play', testInfo);

    await page.locator('[data-card-uid="eyes-single-hand"]').click();
    await page.locator('[data-card-uid="eyes-single-hand"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const p0Deck = state?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
      const p0Discard = state?.core?.players?.['0']?.discard?.map((card: any) => card.uid) ?? [];
      return state?.sys?.interaction?.current == null
        && p0Deck.join(',') === 'eyes-single-deck-a'
        && p0Discard.includes('eyes-single-hand')
        && !hasUid(state?.core?.players?.['0']?.hand, 'eyes-single-hand');
    }, {
      message: 'For My Eyes Only 在牌库只剩一张时应自动查看该牌且不创建 super_spies_for_my_eyes_only_reorder prompt，本行动直接进弃牌堆并收口',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: /顶：/ })).toHaveCount(0);
    await game.screenshot('yuanhou-for-my-eyes-only-single-card-auto-inspected-without-reorder-prompt', testInfo);
  });

  test('超级间谍-For My Eyes Only-牌库为空时真实入口不应创建重排 prompt', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
              hand: [{ uid: 'eyes-empty-hand', defId: 'super_spies_for_my_eyes_only', type: 'action', owner: '0' }],
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
            { defId: 'base_secret_volcano_headquarters', breakpoint: 18, minions: [], ongoingActions: [] },
            { defId: 'base_portal_room', breakpoint: 20, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await expect(page.locator('[data-card-uid="eyes-empty-hand"]')).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-for-my-eyes-only-empty-deck-before-play', testInfo);

    await page.locator('[data-card-uid="eyes-empty-hand"]').click();
    await page.locator('[data-card-uid="eyes-empty-hand"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const p0Deck = state?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
      const p0Discard = state?.core?.players?.['0']?.discard?.map((card: any) => card.uid) ?? [];
      return state?.sys?.interaction?.current == null
        && p0Deck.length === 0
        && p0Discard.includes('eyes-empty-hand')
        && !hasUid(state?.core?.players?.['0']?.hand, 'eyes-empty-hand');
    }, {
      message: 'For My Eyes Only 在牌库为空时应直接进弃牌堆并收口，不创建 super_spies_for_my_eyes_only_reorder prompt',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: /顶：/ })).toHaveCount(0);
    await game.screenshot('yuanhou-for-my-eyes-only-empty-deck-no-reorder-prompt', testInfo);
  });

  test('超级间谍-Moon Zero Three-真实 special 可从牌库旁打到没有其他玩家随从的基地', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
                uid: 'moon-special-own-minion',
                defId: 'super_spies_spy',
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
              defId: 'base_portal_room',
              breakpoint: 22,
              minions: [{
                uid: 'moon-special-enemy-minion',
                defId: 'time_travelers_jumper',
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
          titans: [{
            uid: 'moon-zero-setaside',
            defId: 'super_spies_moon_zero_three',
            faction: 'super_spies',
            ownerId: '0',
            controllerId: '0',
            powerCounters: 0,
            talentUsed: false,
            location: { zone: 'setaside' },
          }],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await expect.poll(async () => {
      const state = await game.getState();
      const titan = (state?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'moon-zero-setaside');
      return titan?.location?.zone === 'setaside';
    }, {
      message: '场景注入后，Moon Zero Three 应先处于牌库旁待打出状态',
      timeout: 10000,
    }).toBe(true);

    const setAsideTitan = page.getByTestId('su-rail-titan-moon-zero-setaside');
    const setAsideTitanBadge = page.getByTestId('su-rail-titan-badge-moon-zero-setaside');
    await expect(setAsideTitan).toBeVisible({ timeout: 15000 });
    await expect(setAsideTitanBadge).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-moon-zero-three-special-ready', testInfo);

    await setAsideTitan.click({ force: true });
    await game.screenshot('yuanhou-moon-zero-three-special-selected-for-deploy', testInfo);
    await page.getByTestId('base-zone-0').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const titan = (state?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'moon-zero-setaside');
      const validBaseMinions = state?.core?.bases?.[0]?.minions ?? [];
      const invalidBaseMinions = state?.core?.bases?.[1]?.minions ?? [];
      return titan?.location?.zone === 'base'
        && titan?.location?.baseIndex === 0
        && hasUid(validBaseMinions, 'moon-special-own-minion')
        && hasUid(invalidBaseMinions, 'moon-special-enemy-minion')
        && state?.sys?.interaction?.current == null;
    }, {
      message: 'Moon Zero Three 选择合法基地后，应真实从牌库旁进场到合法基地，且不影响非法基地上的敌方随从',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-moon-zero-three-special-played-to-valid-base', testInfo);
  });

  test('超级间谍-Moon Zero Three-真实 rail special 选中后可再次点击取消，不会被强制打出', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
                uid: 'moon-skip-own-minion',
                defId: 'super_spies_spy',
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
              defId: 'base_portal_room',
              breakpoint: 22,
              minions: [{
                uid: 'moon-skip-enemy-minion',
                defId: 'time_travelers_jumper',
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
          titans: [{
            uid: 'moon-zero-skip-setaside',
            defId: 'super_spies_moon_zero_three',
            faction: 'super_spies',
            ownerId: '0',
            controllerId: '0',
            powerCounters: 0,
            talentUsed: false,
            location: { zone: 'setaside' },
          }],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await expect.poll(async () => {
      const state = await game.getState();
      const titan = (state?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'moon-zero-skip-setaside');
      return titan?.location?.zone === 'setaside' && state?.sys?.interaction?.current == null;
    }, {
      message: '场景注入后，Moon Zero Three 应先处于牌库旁且没有额外交互 prompt',
      timeout: 10000,
    }).toBe(true);

    const setAsideTitan = page.getByTestId('su-rail-titan-moon-zero-skip-setaside');
    await expect(setAsideTitan).toBeVisible({ timeout: 15000 });
    await expect(setAsideTitan).not.toHaveClass(/ring-2 ring-purple-400/);

    await setAsideTitan.click({ force: true });
    await expect(setAsideTitan).toHaveClass(/ring-2 ring-purple-400/);
    await screenshotViewport(page, 'yuanhou-moon-zero-three-special-armed-before-cancel', testInfo);

    await setAsideTitan.click({ force: true });
    await expect(setAsideTitan).not.toHaveClass(/ring-2 ring-purple-400/);
    await screenshotViewport(page, 'yuanhou-moon-zero-three-special-cancelled-before-deploy', testInfo);

    await page.getByTestId('base-zone-0').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const titan = (state?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'moon-zero-skip-setaside');
      const validBaseMinions = state?.core?.bases?.[0]?.minions ?? [];
      const invalidBaseMinions = state?.core?.bases?.[1]?.minions ?? [];
      return titan?.location?.zone === 'setaside'
        && titan?.location?.baseIndex === undefined
        && hasUid(validBaseMinions, 'moon-skip-own-minion')
        && hasUid(invalidBaseMinions, 'moon-skip-enemy-minion')
        && state?.sys?.interaction?.current == null;
    }, {
      message: '取消 Moon Zero Three 的 armed 选择后，再点合法基地也不应强制把 Titan 打出',
      timeout: 15000,
    }).toBe(true);
  });

  test('时间旅行者-Time Box-borrowed setaside Titan 应在控制者页真实出现在 rail 并可打到基地', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
              factions: ['time_travelers', 'cyborg_apes'],
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
                uid: 'borrowed-time-box-host',
                defId: 'cyborg_apes_cyberback',
                controller: '0',
                owner: '0',
                basePower: 5,
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
          titans: [{
            uid: 'borrowed-time-box-setaside',
            defId: 'time_travelers_time_box',
            faction: 'time_travelers',
            ownerId: '1',
            controllerId: '0',
            powerCounters: 0,
            talentUsed: false,
            metadata: { timeBoxCounters: 5, timeBoxPlayArmed: true },
            location: { zone: 'setaside' },
          }],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await expect.poll(async () => {
      const state = await game.getState();
      const titan = (state?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'borrowed-time-box-setaside');
      return titan?.location?.zone === 'setaside'
        && titan?.controllerId === '0'
        && titan?.ownerId === '1'
        && titan?.metadata?.timeBoxCounters === 5
        && titan?.metadata?.timeBoxPlayArmed === true;
    }, {
      message: '场景注入后，borrowed Time Box 应先处于 controller=P0、owner=P1 的牌库旁待进场状态',
      timeout: 10000,
    }).toBe(true);

    const borrowedTimeBoxRail = page.getByTestId('su-rail-titan-borrowed-time-box-setaside');
    const borrowedTimeBoxBadge = page.getByTestId('su-rail-titan-badge-borrowed-time-box-setaside');
    await expect(borrowedTimeBoxRail).toBeVisible({ timeout: 15000 });
    await expect(borrowedTimeBoxBadge).toBeVisible({ timeout: 15000 });
    await screenshotViewport(page, 'yuanhou-borrowed-time-box-visible-on-controller-rail', testInfo);

    await borrowedTimeBoxRail.click({ force: true });
    await expect(borrowedTimeBoxRail).toHaveClass(/ring-2 ring-purple-400/);

    await page.getByTestId('base-zone-1').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const titan = (state?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'borrowed-time-box-setaside');
      return state?.sys?.interaction?.current == null
        && titan?.location?.zone === 'base'
        && titan?.location?.baseIndex === 1
        && titan?.controllerId === '0'
        && titan?.ownerId === '1'
        && titan?.metadata?.timeBoxCounters === 0
        && titan?.metadata?.timeBoxPlayArmed === false;
    }, {
      message: 'controller=P0 从 rail 选择 borrowed Time Box 后，应能真实把它打到基地，且保留 owner=P1 并清零计数',
      timeout: 15000,
    }).toBe(true);

    await screenshotViewport(page, 'yuanhou-borrowed-time-box-played-from-controller-rail', testInfo);
  });

  test('超级间谍-Moon Zero Three-与 Time Box 同时可用时切换 rail 选择后应由 Time Box 真实进场', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
              defId: 'base_monkey_lab',
              breakpoint: 20,
              minions: [{
                uid: 'moon-switch-own-minion',
                defId: 'super_spies_spy',
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
              defId: 'base_portal_room',
              breakpoint: 22,
              minions: [{
                uid: 'moon-switch-enemy-minion',
                defId: 'time_travelers_jumper',
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
          titans: [
            {
              uid: 'moon-zero-switch-setaside',
              defId: 'super_spies_moon_zero_three',
              faction: 'super_spies',
              ownerId: '0',
              controllerId: '0',
              powerCounters: 0,
              talentUsed: false,
              location: { zone: 'setaside' },
            },
            {
              uid: 'time-box-switch-setaside',
              defId: 'time_travelers_time_box',
              faction: 'time_travelers',
              ownerId: '0',
              controllerId: '0',
              powerCounters: 0,
              talentUsed: false,
              location: { zone: 'setaside' },
              metadata: { timeBoxCounters: 5, timeBoxPlayArmed: true },
            },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await expect.poll(async () => {
      const state = await game.getState();
      const moonZero = (state?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'moon-zero-switch-setaside');
      const timeBox = (state?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'time-box-switch-setaside');
      return moonZero?.location?.zone === 'setaside'
        && timeBox?.location?.zone === 'setaside'
        && timeBox?.metadata?.timeBoxCounters === 5
        && timeBox?.metadata?.timeBoxPlayArmed === true;
    }, {
      message: '场景注入后，Moon Zero Three 与 Time Box 都应在牌库旁，且 Time Box 已具备进场机会',
      timeout: 10000,
    }).toBe(true);

    const moonZeroRail = page.getByTestId('su-rail-titan-moon-zero-switch-setaside');
    const timeBoxRail = page.getByTestId('su-rail-titan-time-box-switch-setaside');
    await expect(moonZeroRail).toBeVisible({ timeout: 15000 });
    await expect(timeBoxRail).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('su-rail-titan-badge-moon-zero-switch-setaside')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('su-rail-titan-badge-time-box-switch-setaside')).toBeVisible({ timeout: 15000 });

    await moonZeroRail.click({ force: true });
    await expect(moonZeroRail).toHaveClass(/ring-2 ring-purple-400/);
    await screenshotViewport(page, 'yuanhou-moon-zero-time-box-moon-zero-armed', testInfo);

    await timeBoxRail.click({ force: true });
    await expect(timeBoxRail).toHaveClass(/ring-2 ring-purple-400/);
    await expect(moonZeroRail).not.toHaveClass(/ring-2 ring-purple-400/);
    await screenshotViewport(page, 'yuanhou-moon-zero-time-box-switched-to-time-box', testInfo);

    await page.getByTestId('base-zone-1').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const moonZero = (state?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'moon-zero-switch-setaside');
      const timeBox = (state?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'time-box-switch-setaside');
      const invalidBaseMinions = state?.core?.bases?.[1]?.minions ?? [];
      return timeBox?.location?.zone === 'base'
        && timeBox?.location?.baseIndex === 1
        && moonZero?.location?.zone === 'setaside'
        && hasUid(invalidBaseMinions, 'moon-switch-enemy-minion')
        && state?.sys?.interaction?.current == null;
    }, {
      message: '切换到 Time Box 后，应能真实打到原本对 Moon Zero Three 非法的基地，且 Moon Zero Three 留在牌库旁',
      timeout: 15000,
    }).toBe(true);

    await screenshotViewport(page, 'yuanhou-moon-zero-time-box-time-box-played-after-switch', testInfo);
  });

  test('超级间谍-秘密火山总部-真实计分前会让每位玩家展示牌库顶一张，并只把展示出的随从打到这里', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
                { uid: 'p0-top-minion', defId: 'robot_warbot', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['super_spies'],
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
                { uid: 'p1-top-action', defId: 'robot_tech_center', type: 'action', owner: '1' },
              ],
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
              defId: 'base_secret_volcano_headquarters',
              breakpoint: 18,
              minions: [
                {
                  uid: 'p0-board',
                  defId: 'robot_nukebot',
                  controller: '0',
                  owner: '0',
                  basePower: 5,
                  powerCounters: 3,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'p1-board',
                  defId: 'robot_nukebot',
                  controller: '1',
                  owner: '1',
                  basePower: 5,
                  powerCounters: 5,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
              ],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_portal_room'],
          baseDiscard: [],
        },
      },
    });

    await game.waitForPhase('playCards', 10000);
    await game.screenshot('yuanhou-secret-volcano-before-end-turn', testInfo);
    await game.advancePhase();
    await page.waitForTimeout(1500);

    const revealOverlay = page.getByTestId('reveal-overlay');
    await expect(revealOverlay).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-secret-volcano-reveal-overlay', testInfo);

    await expect.poll(async () => {
      const state = await game.getState();
      const entries = state?.sys?.eventStream?.entries ?? [];
      const revealEntries = entries.filter((entry: any) => entry?.event?.type === 'su:reveal_deck_top');
      const payloads = revealEntries.map((entry: any) => entry?.event?.payload ?? {});
      const revealedUids = payloads.flatMap((payload: any) => (payload?.cards ?? []).map((card: any) => card?.uid));
      const viewerIds = payloads.map((payload: any) => payload?.viewerPlayerId);
      return revealEntries.length === 2
        && revealedUids.includes('p0-top-minion')
        && revealedUids.includes('p1-top-action')
        && viewerIds.every((viewerId: any) => viewerId === 'all');
    }, {
      message: '秘密火山总部真实计分前应发出两条 REVEAL_DECK_TOP 事件，分别包含 p0-top-minion 与 p1-top-action，且 viewerPlayerId=all',
      timeout: 15000,
    }).toBe(true);

    await expect.poll(async () => {
      const state = await game.getState();
      const base = state?.core?.bases?.[0];
      const p0Hand = state?.core?.players?.['0']?.hand ?? [];
      const p0Discard = state?.core?.players?.['0']?.discard ?? [];
      const p1Discard = state?.core?.players?.['1']?.discard ?? [];
      const p0Deck = state?.core?.players?.['0']?.deck ?? [];
      const p1Deck = state?.core?.players?.['1']?.deck ?? [];
      return state?.sys?.phase === 'playCards'
        && state?.core?.currentPlayerIndex === 1
        && base?.defId === 'base_portal_room'
        && state?.core?.players?.['0']?.vp === 4
        && state?.core?.players?.['1']?.vp === 3
        && hasUid(p0Hand, 'p0-board')
        && hasUid(p0Hand, 'p0-top-minion')
        && p0Discard.length === 0
        && hasUid(p1Discard, 'p1-board')
        && !hasUid(p1Discard, 'p1-top-action')
        && p0Deck.length === 0
        && p1Deck.length === 1
        && p1Deck[0]?.uid === 'p1-top-action'
        && state?.sys?.interaction?.current == null;
    }, {
      message: '秘密火山总部计分前应只把展示出的随从打到该基地，随后按新增力量重排名次并完成换基地收口',
      timeout: 20000,
    }).toBe(true);

    await dismissSmashUpSpotlightQueueIfVisible(page);
    await game.screenshot('yuanhou-secret-volcano-scored-with-revealed-minion-only', testInfo);
  });

  test('超级间谍-From Q With Love-真实入口会抽三张并从投影手牌中准确弃两张', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
                { uid: 'q-a', defId: 'super_spies_from_q_with_love', type: 'action', owner: '0' },
                { uid: 'old-hand', defId: 'sharks_mako', type: 'minion', owner: '0' },
              ],
              deck: [
                { uid: 'draw-a', defId: 'sharks_hammerhead', type: 'minion', owner: '0' },
                { uid: 'draw-b', defId: 'sharks_tiger_shark', type: 'minion', owner: '0' },
                { uid: 'draw-c', defId: 'sharks_great_white', type: 'minion', owner: '0' },
              ],
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
            { defId: 'base_isis_swingin_pad', breakpoint: 18, minions: [], ongoingActions: [] },
            { defId: 'base_portal_room', breakpoint: 22, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="q-a"]').click();
    await page.locator('[data-card-uid="q-a"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'super_spies_from_q_with_love_discard'
        && prompt?.playerId === '0'
        && prompt?.data?.multi?.min === 2
        && prompt?.data?.multi?.max === 2
        && optionIds.includes('old-hand')
        && optionIds.includes('draw-a')
        && optionIds.includes('draw-b')
        && optionIds.includes('draw-c')
        && !optionIds.includes('q-a');
    }, {
      message: 'From Q With Love 真实打出后应抽三张，并只把旧手牌与新抽牌组成的投影手牌作为“弃两张”候选',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-option-id="old-hand"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="draw-a"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="draw-b"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="draw-c"]')).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-from-q-with-love-discard-prompt', testInfo);

    await page.locator('[data-option-id="old-hand"]').click();
    await page.locator('[data-option-id="draw-c"]').click();
    await game.screenshot('yuanhou-from-q-with-love-discard-two-selected', testInfo);
    await page.getByRole('button', { name: /确认/ }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      const p0Hand = state?.core?.players?.['0']?.hand?.map((card: any) => card.uid) ?? [];
      const p0Discard = state?.core?.players?.['0']?.discard?.map((card: any) => card.uid) ?? [];
      const p0Deck = state?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
      return state?.sys?.interaction?.current == null
        && p0Hand.join(',') === 'draw-a,draw-b'
        && p0Discard.includes('q-a')
        && p0Discard.includes('old-hand')
        && p0Discard.includes('draw-c')
        && p0Deck.length === 0;
    }, {
      message: 'From Q With Love 确认后应准确弃掉所选两张，并让未弃的新抽牌留在手里',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-from-q-with-love-discard-resolved', testInfo);
  });

  test('超级间谍-From Q With Love-短牌库时真实入口只要求弃掉唯一剩余投影手牌', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
                { uid: 'q-short-a', defId: 'super_spies_from_q_with_love', type: 'action', owner: '0' },
                { uid: 'old-short-hand', defId: 'sharks_mako', type: 'minion', owner: '0' },
              ],
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
            { defId: 'base_isis_swingin_pad', breakpoint: 18, minions: [], ongoingActions: [] },
            { defId: 'base_portal_room', breakpoint: 22, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="q-short-a"]').click();
    await page.locator('[data-card-uid="q-short-a"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'super_spies_from_q_with_love_discard'
        && prompt?.playerId === '0'
        && prompt?.data?.multi?.min === 1
        && prompt?.data?.multi?.max === 1
        && optionIds.length === 1
        && optionIds[0] === 'old-short-hand'
        && !optionIds.includes('q-short-a');
    }, {
      message: 'From Q With Love 在投影手牌只剩一张时，应只创建“弃一张”prompt，并且候选只包含那张旧手牌',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-option-id="old-short-hand"]')).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-from-q-with-love-short-deck-single-discard-prompt', testInfo);

    await page.locator('[data-option-id="old-short-hand"]').click();
    await game.screenshot('yuanhou-from-q-with-love-short-deck-single-discard-selected', testInfo);
    await page.getByRole('button', { name: /确认/ }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      const p0Hand = state?.core?.players?.['0']?.hand?.map((card: any) => card.uid) ?? [];
      const p0Discard = state?.core?.players?.['0']?.discard?.map((card: any) => card.uid) ?? [];
      return state?.sys?.interaction?.current == null
        && p0Hand.length === 0
        && p0Discard.includes('q-short-a')
        && p0Discard.includes('old-short-hand');
    }, {
      message: 'From Q With Love 在短牌库一张候选分支确认后，应只弃掉那唯一剩余投影手牌并完成收口',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-from-q-with-love-short-deck-single-discard-resolved', testInfo);
  });

  test('超级间谍-From Q With Love-投影手牌为空时真实入口不应创建弃牌 prompt', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
              hand: [{ uid: 'q-empty-a', defId: 'super_spies_from_q_with_love', type: 'action', owner: '0' }],
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
            { defId: 'base_isis_swingin_pad', breakpoint: 18, minions: [], ongoingActions: [] },
            { defId: 'base_portal_room', breakpoint: 22, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await game.screenshot('yuanhou-from-q-with-love-empty-projected-before-play', testInfo);
    await page.locator('[data-card-uid="q-empty-a"]').click();
    await page.locator('[data-card-uid="q-empty-a"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const p0Hand = state?.core?.players?.['0']?.hand?.map((card: any) => card.uid) ?? [];
      const p0Discard = state?.core?.players?.['0']?.discard?.map((card: any) => card.uid) ?? [];
      return state?.sys?.interaction?.current == null
        && p0Hand.length === 0
        && p0Discard.length === 1
        && p0Discard[0] === 'q-empty-a';
    }, {
      message: 'From Q With Love 在投影手牌为空时，应直接收口且不创建 discard prompt',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByText('来自Q的爱：选择要弃掉的两张牌')).toHaveCount(0);
    await game.screenshot('yuanhou-from-q-with-love-empty-projected-resolved', testInfo);
  });

  test('超级间谍-Discards Are Forever-真实入口会对每位玩家展示到首个随从为止并弃掉所有展示牌', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
              hand: [{ uid: 'forever-a', defId: 'super_spies_discards_are_forever', type: 'action', owner: '0' }],
              deck: [
                { uid: 'p0-action', defId: 'cyborg_apes_going_bananas', type: 'action', owner: '0' },
                { uid: 'p0-minion', defId: 'sharks_mako', type: 'minion', owner: '0' },
                { uid: 'p0-rest', defId: 'sharks_hammerhead', type: 'minion', owner: '0' },
              ],
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
                { uid: 'p1-action-a', defId: 'super_spies_for_my_eyes_only', type: 'action', owner: '1' },
                { uid: 'p1-action-b', defId: 'cyborg_apes_cyberevolution', type: 'action', owner: '1' },
                { uid: 'p1-minion', defId: 'sharks_hammerhead', type: 'minion', owner: '1' },
                { uid: 'p1-rest', defId: 'sharks_mako', type: 'minion', owner: '1' },
              ],
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

    await game.screenshot('yuanhou-discards-are-forever-before-play', testInfo);
    await page.locator('[data-card-uid="forever-a"]').click();
    await page.locator('[data-card-uid="forever-a"]').click();
    await dismissSmashUpSpotlightQueueIfVisible(page);
    for (let i = 0; i < 4; i += 1) {
      const continueHint = page.getByText(/点击继续/);
      const visible = await continueHint.isVisible().catch(() => false);
      if (!visible) break;
      await continueHint.click({ force: true });
      await page.waitForTimeout(200);
    }

    await expect.poll(async () => {
      const state = await game.getState();
      const p0Deck = state?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
      const p1Deck = state?.core?.players?.['1']?.deck?.map((card: any) => card.uid) ?? [];
      const p0Discard = state?.core?.players?.['0']?.discard?.map((card: any) => card.uid) ?? [];
      const p1Discard = state?.core?.players?.['1']?.discard?.map((card: any) => card.uid) ?? [];
      const p0Hand = state?.core?.players?.['0']?.hand?.map((card: any) => card.uid) ?? [];
      return state?.sys?.interaction?.current == null
        && p0Hand.length === 0
        && p0Deck.join(',') === 'p0-rest'
        && p1Deck.join(',') === 'p1-rest'
        && p0Discard.join(',') === 'forever-a,p0-action,p0-minion'
        && p1Discard.join(',') === 'p1-action-a,p1-action-b,p1-minion';
    }, {
      message: 'Discards Are Forever 应让每位玩家展示到首个随从为止，并把所有展示牌都弃掉，只留下首个随从后的剩余牌库',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-discards-are-forever-resolved', testInfo);
  });

  test('超级间谍-Permit to Kill-真实入口会展示其他玩家顶二、弃随从并让施放者重排非随从', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
              hand: [{ uid: 'permit-a', defId: 'super_spies_permit_to_kill', type: 'action', owner: '0' }],
              deck: [{ uid: 'p0-untouched', defId: 'super_spies_spy', type: 'minion', owner: '0' }],
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
                { uid: 'p1-action-a', defId: 'cyborg_apes_going_bananas', type: 'action', owner: '1' },
                { uid: 'p1-action-b', defId: 'time_travelers_time_is_fleeting', type: 'action', owner: '1' },
                { uid: 'p1-rest', defId: 'super_spies_for_my_eyes_only', type: 'action', owner: '1' },
              ],
              discard: [],
              factions: ['cyborg_apes'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '2': {
              id: '2',
              vp: 0,
              hand: [],
              deck: [
                { uid: 'p2-minion', defId: 'time_travelers_time_raider', type: 'minion', owner: '2' },
                { uid: 'p2-action', defId: 'super_spies_for_my_eyes_only', type: 'action', owner: '2' },
                { uid: 'p2-rest', defId: 'time_travelers_time_walk', type: 'action', owner: '2' },
              ],
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

    await game.screenshot('yuanhou-permit-to-kill-before-play', testInfo);
    await page.locator('[data-card-uid="permit-a"]').click();
    await page.locator('[data-card-uid="permit-a"]').click();
    await dismissSmashUpSpotlightQueueIfVisible(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionLabels = (prompt?.data?.options ?? []).map((option: any) => option?.label);
      const p1Discard = state?.core?.players?.['1']?.discard?.map((card: any) => card.uid) ?? [];
      const p2Discard = state?.core?.players?.['2']?.discard?.map((card: any) => card.uid) ?? [];
      return prompt?.data?.sourceId === 'super_spies_permit_to_kill_order'
        && prompt?.playerId === '0'
        && optionLabels.includes('顶：为了香蕉 / 时间流逝')
        && optionLabels.includes('顶：时间流逝 / 为了香蕉')
        && p1Discard.length === 0
        && p2Discard.includes('p2-minion');
    }, {
      message: 'Permit to Kill 真实打出后应只为 P1 两张非随从展示牌创建回顶顺序 prompt，并已自动弃掉 P2 展示随从',
      timeout: 15000,
    }).toBe(true);

    const reverseOrderButton = page.getByRole('button', { name: '顶：时间流逝 / 为了香蕉' });
    await reverseOrderButton.scrollIntoViewIfNeeded({ timeout: 15000 });
    await game.screenshot('yuanhou-permit-to-kill-order-prompt', testInfo);
    await reverseOrderButton.click();

    await expect.poll(async () => {
      const state = await game.getState();
      const p0Deck = state?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
      const p0Discard = state?.core?.players?.['0']?.discard?.map((card: any) => card.uid) ?? [];
      const p1Deck = state?.core?.players?.['1']?.deck?.map((card: any) => card.uid) ?? [];
      const p1Discard = state?.core?.players?.['1']?.discard?.map((card: any) => card.uid) ?? [];
      const p2Deck = state?.core?.players?.['2']?.deck?.map((card: any) => card.uid) ?? [];
      const p2Discard = state?.core?.players?.['2']?.discard?.map((card: any) => card.uid) ?? [];
      return state?.sys?.interaction?.current == null
        && p0Deck.join(',') === 'p0-untouched'
        && p0Discard.includes('permit-a')
        && p1Deck.join(',') === 'p1-action-b,p1-action-a,p1-rest'
        && p1Discard.length === 0
        && p2Deck.join(',') === 'p2-action,p2-rest'
        && p2Discard.join(',') === 'p2-minion';
    }, {
      message: 'Permit to Kill 确认后应只重排本次展示的 P1 非随从，P2 展示随从进弃牌且 P0 自己牌库不被展示影响',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-permit-to-kill-resolved', testInfo);
  });

  test('超级间谍-Permit to Kill-短牌库时真实入口不应创建多余排序 prompt', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      extra: {
        core: {
          turnOrder: ['0', '1', '2', '3'],
          currentPlayerIndex: 0,
          turnNumber: 1,
          nextUid: 1000,
          players: {
            '0': {
              id: '0',
              vp: 0,
              hand: [{ uid: 'permit-short', defId: 'super_spies_permit_to_kill', type: 'action', owner: '0' }],
              deck: [{ uid: 'p0-untouched', defId: 'super_spies_spy', type: 'minion', owner: '0' }],
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
              deck: [],
              discard: [],
              factions: ['cyborg_apes'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '2': {
              id: '2',
              vp: 0,
              hand: [],
              deck: [
                { uid: 'p2-only-action', defId: 'super_spies_from_q_with_love', type: 'action', owner: '2' },
              ],
              discard: [],
              factions: ['super_spies'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '3': {
              id: '3',
              vp: 0,
              hand: [],
              deck: [
                { uid: 'p3-only-minion', defId: 'time_travelers_time_raider', type: 'minion', owner: '3' },
              ],
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

    await game.screenshot('yuanhou-permit-to-kill-short-before-play', testInfo);
    await page.locator('[data-card-uid="permit-short"]').click();
    await page.locator('[data-card-uid="permit-short"]').click();
    await dismissSmashUpSpotlightQueueIfVisible(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const p0Deck = state?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
      const p0Discard = state?.core?.players?.['0']?.discard?.map((card: any) => card.uid) ?? [];
      const p1Deck = state?.core?.players?.['1']?.deck?.map((card: any) => card.uid) ?? [];
      const p1Discard = state?.core?.players?.['1']?.discard?.map((card: any) => card.uid) ?? [];
      const p2Deck = state?.core?.players?.['2']?.deck?.map((card: any) => card.uid) ?? [];
      const p2Discard = state?.core?.players?.['2']?.discard?.map((card: any) => card.uid) ?? [];
      const p3Deck = state?.core?.players?.['3']?.deck?.map((card: any) => card.uid) ?? [];
      const p3Discard = state?.core?.players?.['3']?.discard?.map((card: any) => card.uid) ?? [];
      const interactionQueue = state?.sys?.interaction?.queue;
      return state?.sys?.interaction?.current == null
        && (!Array.isArray(interactionQueue) || interactionQueue.length === 0)
        && p0Deck.join(',') === 'p0-untouched'
        && p0Discard.includes('permit-short')
        && p1Deck.length === 0
        && p1Discard.length === 0
        && p2Deck.join(',') === 'p2-only-action'
        && p2Discard.length === 0
        && p3Deck.length === 0
        && p3Discard.join(',') === 'p3-only-minion';
    }, {
      message: 'Permit to Kill 在其他玩家为空牌库或只展示一张牌时，应直接收口：单张随从自动进弃牌堆，单张行动保持原顶牌且不创建排序 prompt',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: /^顶：/ })).toHaveCount(0);
    await game.screenshot('yuanhou-permit-to-kill-short-auto-resolved-without-order-prompt', testInfo);
  });

  test('超级间谍-Permit to Kill-四人局真实入口会依次处理每位其他玩家的非随从排序 prompt', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      extra: {
        core: {
          turnOrder: ['0', '1', '2', '3'],
          currentPlayerIndex: 0,
          turnNumber: 1,
          nextUid: 1000,
          players: {
            '0': {
              id: '0',
              vp: 0,
              hand: [{ uid: 'permit-four-player', defId: 'super_spies_permit_to_kill', type: 'action', owner: '0' }],
              deck: [{ uid: 'p0-untouched', defId: 'super_spies_spy', type: 'minion', owner: '0' }],
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
                { uid: 'p1-action-a', defId: 'cyborg_apes_going_bananas', type: 'action', owner: '1' },
                { uid: 'p1-action-b', defId: 'time_travelers_time_is_fleeting', type: 'action', owner: '1' },
                { uid: 'p1-rest', defId: 'super_spies_for_my_eyes_only', type: 'action', owner: '1' },
              ],
              discard: [],
              factions: ['cyborg_apes'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '2': {
              id: '2',
              vp: 0,
              hand: [],
              deck: [
                { uid: 'p2-action-a', defId: 'super_spies_mindraker', type: 'action', owner: '2' },
                { uid: 'p2-action-b', defId: 'super_spies_from_q_with_love', type: 'action', owner: '2' },
                { uid: 'p2-rest', defId: 'time_travelers_time_walk', type: 'action', owner: '2' },
              ],
              discard: [],
              factions: ['super_spies'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '3': {
              id: '3',
              vp: 0,
              hand: [],
              deck: [
                { uid: 'p3-action-a', defId: 'cyborg_apes_cyberevolution', type: 'action', owner: '3' },
                { uid: 'p3-action-b', defId: 'super_spies_live_and_let_chum', type: 'action', owner: '3' },
                { uid: 'p3-rest', defId: 'sharks_mako', type: 'minion', owner: '3' },
              ],
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

    await game.screenshot('yuanhou-permit-to-kill-four-player-before-play', testInfo);
    await page.locator('[data-card-uid="permit-four-player"]').click();
    await page.locator('[data-card-uid="permit-four-player"]').click();
    await dismissSmashUpSpotlightQueueIfVisible(page);

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const queueTargets = (state?.sys?.interaction?.queue ?? []).map((entry: any) => entry?.data?.targetPlayerId);
      return prompt?.data?.sourceId === 'super_spies_permit_to_kill_order'
        && prompt?.data?.targetPlayerId === '1'
        && queueTargets.join(',') === '2,3';
    }, {
      message: '四人局 Permit to Kill 第一段真实 prompt 应先处理 P1，并在队列中保留 P2/P3',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-permit-to-kill-four-player-p1-prompt', testInfo);
    await game.selectInteractionOptionBy(
      (option) => option?.value?.targetPlayerId === '1'
        && option?.value?.topUids?.join(',') === 'p1-action-b,p1-action-a',
      'Permit to Kill four-player reorder P1 reverse order',
    );

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const queueTargets = (state?.sys?.interaction?.queue ?? []).map((entry: any) => entry?.data?.targetPlayerId);
      return prompt?.data?.sourceId === 'super_spies_permit_to_kill_order'
        && prompt?.data?.targetPlayerId === '2'
        && queueTargets.join(',') === '3';
    }, {
      message: '处理完 P1 后，第二段真实 prompt 应继续处理 P2，并只在队列中保留 P3',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-permit-to-kill-four-player-p2-prompt', testInfo);
    await game.selectInteractionOptionBy(
      (option) => option?.value?.targetPlayerId === '2'
        && option?.value?.topUids?.join(',') === 'p2-action-b,p2-action-a',
      'Permit to Kill four-player reorder P2 reverse order',
    );

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const p3Discard = state?.core?.players?.['3']?.discard?.map((card: any) => card.uid) ?? [];
      return prompt?.data?.sourceId === 'super_spies_permit_to_kill_order'
        && prompt?.data?.targetPlayerId === '3'
        && p3Discard.includes('p3-rest') === false;
    }, {
      message: '处理完 P2 后，第三段真实 prompt 应继续处理 P3 的两张非随从展示牌',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-permit-to-kill-four-player-p3-prompt', testInfo);
    await game.selectInteractionOptionBy(
      (option) => option?.value?.targetPlayerId === '3'
        && option?.value?.topUids?.join(',') === 'p3-action-b,p3-action-a',
      'Permit to Kill four-player reorder P3 reverse order',
    );

    await expect.poll(async () => {
      const state = await game.getState();
      const p0Deck = state?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
      const p0Discard = state?.core?.players?.['0']?.discard?.map((card: any) => card.uid) ?? [];
      const p1Deck = state?.core?.players?.['1']?.deck?.map((card: any) => card.uid) ?? [];
      const p2Deck = state?.core?.players?.['2']?.deck?.map((card: any) => card.uid) ?? [];
      const p3Deck = state?.core?.players?.['3']?.deck?.map((card: any) => card.uid) ?? [];
      const p3Discard = state?.core?.players?.['3']?.discard?.map((card: any) => card.uid) ?? [];
      return state?.sys?.interaction?.current == null
        && p0Deck.join(',') === 'p0-untouched'
        && p0Discard.includes('permit-four-player')
        && p1Deck.join(',') === 'p1-action-b,p1-action-a,p1-rest'
        && p2Deck.join(',') === 'p2-action-b,p2-action-a,p2-rest'
        && p3Deck.join(',') === 'p3-action-b,p3-action-a,p3-rest'
        && p3Discard.length === 0;
    }, {
      message: '四人局 Permit to Kill 全部 prompt 收口后，应依次重排 P1/P2/P3，且不误动各玩家未展示的第三张牌',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-permit-to-kill-four-player-resolved', testInfo);
  });

  test('电子猿-Missing Uplink-真实回合结束每张实例各抽一张额外牌', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
                { uid: 'uplink-draw-a', defId: 'cyborg_apes_baboom', type: 'minion', owner: '0' },
                { uid: 'uplink-draw-b', defId: 'cyborg_apes_furious_george', type: 'minion', owner: '0' },
                { uid: 'uplink-draw-c', defId: 'cyborg_apes_cyberback', type: 'minion', owner: '0' },
                { uid: 'uplink-draw-d', defId: 'cyborg_apes_clyde_2_0', type: 'minion', owner: '0' },
                { uid: 'uplink-draw-e', defId: 'cyborg_apes_baboom', type: 'minion', owner: '0' },
              ],
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
              hand: [],
              deck: [],
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
              defId: 'base_monkey_lab',
              breakpoint: 23,
              minions: [
                {
                  uid: 'uplink-host-a',
                  defId: 'cyborg_apes_furious_george',
                  controller: '0',
                  owner: '0',
                  basePower: 2,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [{ uid: 'uplink-a', defId: 'cyborg_apes_missing_uplink', ownerId: '0' }],
                },
                {
                  uid: 'uplink-host-b',
                  defId: 'cyborg_apes_baboom',
                  controller: '0',
                  owner: '0',
                  basePower: 2,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [{ uid: 'uplink-b', defId: 'cyborg_apes_missing_uplink', ownerId: '0' }],
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

    await game.screenshot('yuanhou-missing-uplink-before-end-turn', testInfo);
    await page.getByTestId('su-end-turn-action-button').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const p0Hand = state?.core?.players?.['0']?.hand?.map((card: any) => card.uid) ?? [];
      const p0Deck = state?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
      const base0 = state?.core?.bases?.[0];
      return state?.core?.currentPlayerIndex === 1
        && state?.sys?.phase === 'playCards'
        && p0Hand.join(',') === 'uplink-draw-a,uplink-draw-b,uplink-draw-c,uplink-draw-d'
        && p0Deck.join(',') === 'uplink-draw-e'
        && base0?.minions?.some((minion: any) =>
          minion.uid === 'uplink-host-a'
          && hasUid(minion.attachedActions, 'uplink-a')
        )
        && base0?.minions?.some((minion: any) =>
          minion.uid === 'uplink-host-b'
          && hasUid(minion.attachedActions, 'uplink-b')
        )
        && state?.sys?.interaction?.current == null;
    }, {
      message: 'Missing Uplink 应在拥有者真实结束回合时按两张实例额外抽两张，再叠加正常回合结束抽两张，并在进入 P1 回合后收口',
      timeout: 20000,
    }).toBe(true);

    await game.screenshot('yuanhou-missing-uplink-end-turn-drew-two', testInfo);
  });

  test('鲨鱼-Week of Sharks-真实回合结束两张实例都满足时也只额外抽一张', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
                { uid: 'week-draw-a', defId: 'sharks_mako', type: 'minion', owner: '0' },
                { uid: 'week-draw-b', defId: 'sharks_hammerhead', type: 'minion', owner: '0' },
                { uid: 'week-draw-c', defId: 'sharks_laseratops', type: 'minion', owner: '0' },
                { uid: 'week-draw-d', defId: 'sharks_ropes', type: 'action', owner: '0' },
                { uid: 'week-draw-e', defId: 'sharks_anchors_away', type: 'action', owner: '0' },
              ],
              discard: [],
              factions: ['sharks'],
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
              factions: ['time_travelers'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_the_deep',
              breakpoint: 23,
              minions: [
                {
                  uid: 'week-host-a',
                  defId: 'sharks_mako',
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
              ],
              ongoingActions: [{ uid: 'week-action-a', defId: 'sharks_week_of_sharks', ownerId: '0' }],
            },
            {
              defId: 'base_shark_reef',
              breakpoint: 18,
              minions: [
                {
                  uid: 'week-host-b',
                  defId: 'sharks_hammerhead',
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
              ],
              ongoingActions: [{ uid: 'week-action-b', defId: 'sharks_week_of_sharks', ownerId: '0' }],
            },
          ],
          baseDeck: ['base_portal_room'],
          baseDiscard: [],
        },
      },
    });

    await game.screenshot('sharks-week-of-sharks-before-end-turn', testInfo);
    await page.getByTestId('su-end-turn-action-button').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const p0Hand = state?.core?.players?.['0']?.hand?.map((card: any) => card.uid) ?? [];
      const p0Deck = state?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
      const bases = state?.core?.bases ?? [];
      return state?.core?.currentPlayerIndex === 1
        && state?.sys?.phase === 'playCards'
        && p0Hand.join(',') === 'week-draw-a,week-draw-b,week-draw-c'
        && p0Deck.join(',') === 'week-draw-d,week-draw-e'
        && bases[0]?.ongoingActions?.some((action: any) => action.uid === 'week-action-a')
        && bases[1]?.ongoingActions?.some((action: any) => action.uid === 'week-action-b')
        && state?.sys?.interaction?.current == null;
    }, {
      message: 'Week of Sharks 在两张实例都满足时，真实结束回合也只能额外抽 1 张，再叠加正常结束回合抽 2 张，并在进入 P1 回合后收口',
      timeout: 20000,
    }).toBe(true);

    await game.screenshot('sharks-week-of-sharks-end-turn-drew-once', testInfo);
  });

  test('超级间谍-The Spy Who Ditched Me-真实入口让其他玩家自己选择要弃的随从牌', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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

    await page.locator('[data-card-uid="spy-action-a"]').click();
    await page.locator('[data-card-uid="spy-action-a"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'super_spies_the_spy_who_ditched_me_discard'
        && prompt?.playerId === '1'
        && optionIds.includes('minion-a')
        && optionIds.includes('minion-b')
        && !optionIds.includes('action-only');
    }, {
      message: 'The Spy Who Ditched Me 真实打出后，应让有随从的其他玩家自己选择要弃的随从牌',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByText('正在等待 P2')).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-spy-who-ditched-me-opponent-discard-prompt', testInfo);

    await game.selectInteractionOptionBy(
      (option: any) => option?.id === 'minion-b',
      'The Spy Who Ditched Me: resolve opponent minion discard',
    );

    await expect.poll(async () => {
      const state = await game.getState();
      const p1Hand = state?.core?.players?.['1']?.hand?.map((card: any) => card.uid) ?? [];
      const p1Discard = state?.core?.players?.['1']?.discard?.map((card: any) => card.uid) ?? [];
      const p2Hand = state?.core?.players?.['2']?.hand?.map((card: any) => card.uid) ?? [];
      return state?.sys?.interaction?.current == null
        && p1Hand.join(',') === 'minion-a'
        && p1Discard.join(',') === 'minion-b'
        && p2Hand.join(',') === 'action-only';
    }, {
      message: 'The Spy Who Ditched Me 结算后，应只让目标其他玩家弃掉自己选中的随从，其他仅有行动牌的玩家保持原手牌',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-spy-who-ditched-me-opponent-minion-discarded', testInfo);
  });

  test('超级间谍-The Spy Who Ditched Me-真实入口会私有展示没有随从的其他玩家手牌且不吞掉弃随从 prompt', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
              hand: [{ uid: 'spy-reveal-a', defId: 'super_spies_the_spy_who_ditched_me', type: 'action', owner: '0' }],
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

    await page.locator('[data-card-uid="spy-reveal-a"]').click();
    await page.locator('[data-card-uid="spy-reveal-a"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      return prompt?.data?.sourceId === 'super_spies_the_spy_who_ditched_me_discard'
        && prompt?.playerId === '1';
    }, {
      message: 'The Spy Who Ditched Me 真实打出后，应先进入 P1 的弃随从 prompt，随后由 UI 私有展示那位没有随从的其他玩家手牌',
      timeout: 15000,
    }).toBe(true);

    const revealOverlay = page.getByTestId('reveal-overlay');
    await expect(revealOverlay).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'P3 的手牌' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('只为我的眼睛')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('reveal-card')).toHaveCount(1);
    await game.screenshot('yuanhou-spy-who-ditched-me-reveal-no-minion-hand', testInfo);

    await page.getByTestId('reveal-dismiss-btn').click();
    await expect(revealOverlay).toBeHidden({ timeout: 15000 });
    await dismissSmashUpSpotlightQueueIfVisible(page);
    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      return prompt?.data?.sourceId === 'super_spies_the_spy_who_ditched_me_discard'
        && prompt?.playerId === '1';
    }, {
      message: '关闭私有 reveal 后，远端弃随从 prompt 应仍保留在权威状态里，不应被本地 reveal 收口吞掉',
      timeout: 15000,
    }).toBe(true);
    await expect(page.getByText('正在等待 P2')).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-spy-who-ditched-me-reveal-dismissed-prompt-persists', testInfo);

    await game.selectInteractionOptionBy(
      (option: any) => option?.id === 'minion-a',
      'The Spy Who Ditched Me: resolve remote discard after local reveal dismiss',
    );

    await expect.poll(async () => {
      const state = await game.getState();
      const p1Hand = state?.core?.players?.['1']?.hand?.map((card: any) => card.uid) ?? [];
      const p1Discard = state?.core?.players?.['1']?.discard?.map((card: any) => card.uid) ?? [];
      const p2Hand = state?.core?.players?.['2']?.hand?.map((card: any) => card.uid) ?? [];
      return state?.sys?.interaction?.current == null
        && p1Hand.join(',') === 'minion-b'
        && p1Discard.join(',') === 'minion-a'
        && p2Hand.join(',') === 'action-only';
    }, {
      message: '关闭私有 reveal 后，P1 的弃随从 prompt 应仍可继续完成，且 P2 只做展示不弃牌',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-spy-who-ditched-me-reveal-resolved-after-dismiss', testInfo);
  });

  test('超级间谍-Live and Let Chum-真实计分前可选择低力量随从并摧毁到拥有者弃牌堆', async ({ page, game }, testInfo) => {
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
              hand: [{ uid: 'live-chum-hand', defId: 'super_spies_live_and_let_chum', type: 'action', owner: '0' }],
              deck: [
                { uid: 'live-chum-draw-a', defId: 'super_spies_spy', type: 'minion', owner: '0' },
                { uid: 'live-chum-draw-b', defId: 'super_spies_operative', type: 'minion', owner: '0' },
              ],
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
              defId: 'base_primate_park',
              breakpoint: 20,
              minions: [
                {
                  uid: 'live-chum-anchor',
                  defId: 'super_spies_secret_agent',
                  controller: '0',
                  owner: '0',
                  basePower: 9,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'chum-low-a',
                  defId: 'time_travelers_jumper',
                  controller: '1',
                  owner: '1',
                  basePower: 3,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'chum-low-b',
                  defId: 'time_travelers_time_raider',
                  controller: '1',
                  owner: '1',
                  basePower: 3,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'chum-high-c',
                  defId: 'cyborg_apes_silverback',
                  controller: '1',
                  owner: '1',
                  basePower: 5,
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
              defId: 'base_portal_room',
              breakpoint: 22,
              minions: [],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await game.waitForPhase('playCards', 10000);
    await game.advancePhase();
    await game.waitForPhase('scoreBases', 10000);

    await expect(page.getByRole('button', { name: /让对手鱼饵/ })).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-live-and-let-chum-response-choice', testInfo);
    await page.getByRole('button', { name: /让对手鱼饵/ }).click({ force: true });

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'super_spies_live_and_let_chum_choose'
        && prompt?.playerId === '0'
        && optionIds.includes('chum-low-a')
        && optionIds.includes('chum-low-b')
        && !optionIds.includes('chum-high-c');
    }, {
      message: 'Live and Let Chum 应只列本次计分基地力量 3 或以下的随从候选',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-minion-uid="chum-low-a"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="chum-low-b"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="chum-high-c"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="chum-low-a"]')).toHaveCount(0);
    await expect(page.locator('[data-option-id="chum-high-c"]')).toHaveCount(0);
    await game.screenshot('yuanhou-live-and-let-chum-low-power-choice-prompt', testInfo);
    await page.locator('[data-minion-uid="chum-low-b"]').click();
    await drainOpenReactionOrResponseWindows(game, 'Live and Let Chum 选择低力量随从后的计分响应收口');

    await expect.poll(async () => {
      const state = await game.getState();
      const base = state?.core?.bases?.[0];
      const p0Discard = state?.core?.players?.['0']?.discard ?? [];
      const p1Discard = state?.core?.players?.['1']?.discard ?? [];
      return state?.sys?.interaction?.current == null
        && state?.sys?.responseWindow?.current == null
        && base?.defId === 'base_the_nexus'
        && state?.core?.players?.['0']?.vp === 3
        && state?.core?.players?.['1']?.vp === 2
        && hasUid(p0Discard, 'live-chum-hand')
        && hasUid(p0Discard, 'live-chum-anchor')
        && hasUid(p1Discard, 'chum-low-a')
        && hasUid(p1Discard, 'chum-low-b')
        && hasUid(p1Discard, 'chum-high-c');
    }, {
      message: 'Live and Let Chum 摧毁所选低力量随从后应让 P0 在本次计分中反超获胜，并按 owner 清场',
      timeout: 20000,
    }).toBe(true);

    await screenshotViewport(page, 'yuanhou-live-and-let-chum-scoring-resolved', testInfo);
  });

  test('超级间谍-Live and Let Chum-真实计分前选择受Shell Game保护的低力量宿主时不应被摧毁且本次计分继续按原力量结算', async ({ page, game }, testInfo) => {
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
              hand: [{ uid: 'live-chum-shell-hand', defId: 'super_spies_live_and_let_chum', type: 'action', owner: '0' }],
              deck: [
                { uid: 'live-shell-draw-a', defId: 'super_spies_spy', type: 'minion', owner: '0' },
                { uid: 'live-shell-draw-b', defId: 'super_spies_operative', type: 'minion', owner: '0' },
              ],
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
              defId: 'base_the_vats',
              breakpoint: 15,
              minions: [
                {
                  uid: 'live-shell-anchor',
                  defId: 'super_spies_secret_agent',
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
                  uid: 'live-shell-host',
                  defId: 'shapeshifters_copycat',
                  controller: '1',
                  owner: '1',
                  basePower: 3,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [{ uid: 'live-shell-shield', defId: 'shapeshifters_shell_game', ownerId: '1' }],
                },
                {
                  uid: 'live-shell-low-b',
                  defId: 'time_travelers_time_raider',
                  controller: '1',
                  owner: '1',
                  basePower: 3,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'live-shell-high-c',
                  defId: 'cyborg_apes_silverback',
                  controller: '1',
                  owner: '1',
                  basePower: 5,
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
              defId: 'base_portal_room',
              breakpoint: 22,
              minions: [],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await game.waitForPhase('playCards', 10000);
    await game.advancePhase();
    await game.waitForPhase('scoreBases', 10000);

    await expect(page.getByRole('button', { name: /让对手鱼饵/ })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /让对手鱼饵/ }).click({ force: true });

    await expect.poll(async () => {
        const state = await game.getState();
        const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'super_spies_live_and_let_chum_choose'
        && prompt?.playerId === '0'
        && optionIds.includes('live-shell-host')
        && optionIds.includes('live-shell-low-b')
        && !optionIds.includes('live-shell-high-c');
    }, {
      message: 'Live and Let Chum 应允许选择受 Shell Game 保护的 3 力宿主，同时继续排除 5 力高力量候选',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-minion-uid="live-shell-host"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="live-shell-low-b"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="live-shell-high-c"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="live-shell-host"]')).toHaveCount(0);
    await expect(page.locator('[data-option-id="live-shell-high-c"]')).toHaveCount(0);
    await game.screenshot('yuanhou-live-and-let-chum-shell-game-choice-prompt', testInfo);
    await page.locator('[data-minion-uid="live-shell-host"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const base = state?.core?.bases?.[0];
        const p0Discard = state?.core?.players?.['0']?.discard ?? [];
        const p1Discard = state?.core?.players?.['1']?.discard ?? [];
      return state?.sys?.interaction?.current == null
        && state?.sys?.responseWindow?.current == null
        && base?.defId === 'base_the_nexus'
        && state?.core?.players?.['0']?.vp === 1
        && state?.core?.players?.['1']?.vp === 3
        && hasUid(p0Discard, 'live-chum-shell-hand')
        && hasUid(p0Discard, 'live-shell-anchor')
        && hasUid(p1Discard, 'live-shell-host')
        && hasUid(p1Discard, 'live-shell-low-b')
        && hasUid(p1Discard, 'live-shell-high-c');
    }, {
      message: '选择受 Shell Game 保护的宿主后，不应降低基地总力量，本次计分应继续按原 4 对 11 结算',
      timeout: 20000,
    }).toBe(true);

    await screenshotViewport(page, 'yuanhou-live-and-let-chum-shell-game-scoring-resolved', testInfo);
  });

  test('超级间谍-Mole-真实计分窗口可通过特技把同基地行动作为特殊行动打出', async ({ page, game }, testInfo) => {
    test.setTimeout(240000);
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
                { uid: 'mole-bananas-hand', defId: 'cyborg_apes_going_bananas', type: 'action', owner: '0' },
              ],
              deck: [
                { uid: 'mole-draw-a', defId: 'time_travelers_time_raider', type: 'minion', owner: '0' },
                { uid: 'mole-draw-b', defId: 'super_spies_spy', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['super_spies', 'cyborg_apes'],
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
              factions: ['cyborg_apes'],
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
              minions: [
                {
                  uid: 'mole-p0-anchor',
                  defId: 'time_travelers_jumper',
                  controller: '0',
                  owner: '0',
                  basePower: 6,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'mole-special-a',
                  defId: 'super_spies_mole',
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
                  uid: 'mole-p1-target',
                  defId: 'sharks_hammerhead',
                  controller: '1',
                  owner: '1',
                  basePower: 5,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [{ uid: 'mole-target-action', defId: 'cyborg_apes_cyberevolution', ownerId: '1' }],
                },
              ],
              ongoingActions: [],
            },
            {
              defId: 'base_portal_room',
              breakpoint: 22,
              minions: [],
              ongoingActions: [{ uid: 'mole-other-base-action', defId: 'super_spies_mindraker', ownerId: '1' }],
            },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await game.waitForPhase('playCards', 10000);
    await game.screenshot('yuanhou-mole-scoring-ready-before-end-turn', testInfo);
    await page.getByTestId('su-end-turn-action-button').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const options = prompt?.data?.options ?? [];
      return prompt?.data?.sourceId === 'smashup_reaction_choose'
        && prompt?.playerId === '0'
        && options.some((option: any) =>
          option?.value?.kind === 'activate_special'
          && option?.value?.minionUid === 'mole-special-a'
          && option?.value?.baseIndex === 0,
        );
    }, {
      message: 'Mole 正向场景应先进入真实 beforeScoring 反应选择，并暴露 ACTIVATE_SPECIAL 入口',
      timeout: 15000,
    }).toBe(true);

    await screenshotViewport(page, 'yuanhou-mole-reaction-choice-before-special', testInfo);
    await game.selectInteractionOptionBy(
      (option: any) =>
        option?.value?.kind === 'activate_special'
        && option?.value?.minionUid === 'mole-special-a'
        && option?.value?.baseIndex === 0,
      'Mole beforeScoring ACTIVATE_SPECIAL',
    );

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      return prompt?.data?.sourceId === 'smashup_immediate_extra_action'
        && prompt?.playerId === '0'
        && hasSkipOption(prompt?.data?.options);
    }, {
      message: 'Mole 特技正向链应给出可跳过的额外行动 prompt，并把 Going Bananas 作为可打候选暴露出来',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-card-uid="mole-bananas-hand"]')).toBeVisible({ timeout: 15000 });
    await screenshotViewport(page, 'yuanhou-mole-extra-action-prompt-with-going-bananas', testInfo);
    await page.locator('[data-card-uid="mole-bananas-hand"] button').click({ force: true });
    await expect.poll(async () => {
      const state = await game.getState();
      return state?.core?.players?.['0']?.actionsPlayed === 2
        && !state?.core?.players?.['0']?.hand?.some((card: any) => card.uid === 'mole-bananas-hand');
    }, {
      message: 'Mole 的唯一合法基地应在点击 Going Bananas 后直接完成打出，不再额外弹第二层基地选择 prompt',
      timeout: 15000,
    }).toBe(true);
    await screenshotViewport(page, 'yuanhou-mole-auto-resolved-without-extra-base-prompt', testInfo);
    await dismissSmashUpSpotlightQueueIfVisible(page);
    await drainOpenReactionOrResponseWindows(game, 'Mole 正向链点击 Going Bananas 后的计分响应收口');

    await expect.poll(async () => {
      const state = await game.getState();
      const p0Discard = state?.core?.players?.['0']?.discard ?? [];
      const p1Discard = state?.core?.players?.['1']?.discard ?? [];
      return state?.sys?.interaction?.current == null
        && state?.sys?.responseWindow?.current == null
        && state?.sys?.phase === 'playCards'
        && state?.core?.currentPlayerIndex === 1
        && state?.core?.bases?.[0]?.defId === 'base_the_nexus'
        && state?.core?.players?.['0']?.vp === 3
        && state?.core?.players?.['1']?.vp === 1
        && hasUid(p0Discard, 'mole-bananas-hand')
        && hasUid(state?.core?.players?.['0']?.hand ?? [], 'mole-draw-a')
        && hasUid(state?.core?.players?.['0']?.hand ?? [], 'mole-draw-b')
        && hasUid(p1Discard, 'mole-target-action')
        && hasUid(p1Discard, 'mole-p1-target');
    }, {
      message: 'Mole 正向链应允许 Going Bananas 作为特殊行动真实打到同基地，并在结算后清掉目标行动、完成计分收口',
      timeout: 20000,
    }).toBe(true);

    await screenshotViewport(page, 'yuanhou-mole-special-action-resolved-on-scoring-base', testInfo);
  });

  test('超级间谍-Mindraker-真实计分窗口会禁止其他玩家通过Mole打行动到这里', async ({ page, game }, testInfo) => {
    test.setTimeout(240000);
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
                { uid: 'mind-bananas-hand', defId: 'cyborg_apes_going_bananas', type: 'action', owner: '0' },
              ],
              deck: [],
              discard: [],
              factions: ['super_spies', 'cyborg_apes'],
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
              factions: ['super_spies'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_primate_park',
              breakpoint: 20,
              minions: [
                {
                  uid: 'mind-p0-anchor',
                  defId: 'time_travelers_jumper',
                  controller: '0',
                  owner: '0',
                  basePower: 8,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'mind-mole-a',
                  defId: 'super_spies_mole',
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
                  uid: 'mind-p1-anchor',
                  defId: 'time_travelers_doctor_when',
                  controller: '1',
                  owner: '1',
                  basePower: 10,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
              ],
              ongoingActions: [
                { uid: 'mindraker-a', defId: 'super_spies_mindraker', ownerId: '1' },
              ],
            },
            {
              defId: 'base_portal_room',
              breakpoint: 22,
              minions: [],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await game.waitForPhase('playCards', 10000);
    await game.screenshot('yuanhou-mindraker-scoring-ready-before-end-turn', testInfo);
    await page.getByTestId('su-end-turn-action-button').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const options = prompt?.data?.options ?? [];
      return prompt?.data?.sourceId === 'smashup_reaction_choose'
        && prompt?.playerId === '0'
        && options.some((option: any) =>
          option?.value?.kind === 'activate_special'
          && option?.value?.minionUid === 'mind-mole-a'
          && option?.value?.baseIndex === 0,
        );
    }, {
      message: 'Mindraker 场景应先进入真实 beforeScoring 反应选择，并暴露 Mole 的 ACTIVATE_SPECIAL 入口',
      timeout: 15000,
    }).toBe(true);

    await screenshotViewport(page, 'yuanhou-mindraker-mole-reaction-choice', testInfo);
    await game.selectInteractionOptionBy(
      (option: any) =>
        option?.value?.kind === 'activate_special'
        && option?.value?.minionUid === 'mind-mole-a'
        && option?.value?.baseIndex === 0,
      'Mindraker Mole beforeScoring ACTIVATE_SPECIAL',
    );

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const options = prompt?.data?.options ?? [];
      return prompt?.data?.sourceId === 'smashup_immediate_extra_action'
        && prompt?.playerId === '0'
        && options.some((option: any) => option?.value?.skip === true)
        && !options.some((option: any) => option?.value?.cardUid === 'mind-bananas-hand');
    }, {
      message: 'Mindraker 禁令存在时，Mole 仍应给出可放弃的额外行动 prompt，但 Going Bananas 不能作为可打行动出现',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '放弃这次额外战术' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('su-hand-area')).toHaveCount(0);
    await expect(page.locator('[data-card-uid="mind-bananas-hand"]')).toHaveCount(0);
    await screenshotViewport(page, 'yuanhou-mindraker-skip-only-extra-action-prompt', testInfo);
    await game.selectInteractionOptionBy(
      (option: any) => option?.value?.skip === true,
      'Mindraker Mole immediate extra action skip',
    );
    await drainOpenReactionOrResponseWindows(game, 'Mindraker Mole 放弃额外行动后的计分响应收口');

    await expect.poll(async () => {
      const state = await game.getState();
      const p0Hand = state?.core?.players?.['0']?.hand ?? [];
      const p0Discard = state?.core?.players?.['0']?.discard ?? [];
      const p1Discard = state?.core?.players?.['1']?.discard ?? [];
      return state?.sys?.interaction?.current == null
        && state?.sys?.responseWindow?.current == null
        && state?.sys?.phase === 'playCards'
        && state?.core?.currentPlayerIndex === 1
        && state?.core?.bases?.[0]?.defId === 'base_the_nexus'
        && state?.core?.players?.['0']?.vp === 2
        && state?.core?.players?.['1']?.vp === 2
        && hasUid(p0Hand, 'mind-bananas-hand')
        && hasUid(p0Hand, 'mind-mole-a')
        && hasUid(p0Hand, 'mind-p0-anchor')
        && !hasUid(p0Discard, 'mind-bananas-hand')
        && !hasUid(p0Discard, 'mind-mole-a')
        && hasUid(p1Discard, 'mindraker-a')
        && hasUid(p1Discard, 'mind-p1-anchor');
    }, {
      message: 'Mindraker 禁令存在时，Mole 额外行动只能由玩家放弃；放弃后 Primate Park 应按平局 2:2 收口，Going Bananas 仍留在 P0 手牌且未被非法打出',
      timeout: 20000,
    }).toBe(true);

    await page.waitForTimeout(500);
    await screenshotViewport(page, 'yuanhou-mindraker-scoring-resolved-without-mole-action', testInfo);
  });

  test('超级间谍-The Base Is Not Enough-真实计分前可选择低力量随从并写入临时控制', async ({ page, game }, testInfo) => {
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
              hand: [{ uid: 'base-not-enough-hand', defId: 'super_spies_the_base_is_not_enough', type: 'action', owner: '0' }],
              deck: [
                { uid: 'base-not-enough-draw-a', defId: 'super_spies_spy', type: 'minion', owner: '0' },
                { uid: 'base-not-enough-draw-b', defId: 'super_spies_operative', type: 'minion', owner: '0' },
              ],
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
              defId: 'base_primate_park',
              breakpoint: 20,
              minions: [
                {
                  uid: 'base-not-enough-anchor',
                  defId: 'super_spies_secret_agent',
                  controller: '0',
                  owner: '0',
                  basePower: 9,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'control-low-a',
                  defId: 'time_travelers_jumper',
                  controller: '1',
                  owner: '1',
                  basePower: 3,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'control-low-b',
                  defId: 'time_travelers_time_raider',
                  controller: '1',
                  owner: '1',
                  basePower: 3,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'control-high-c',
                  defId: 'cyborg_apes_silverback',
                  controller: '1',
                  owner: '1',
                  basePower: 5,
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
              defId: 'base_portal_room',
              breakpoint: 22,
              minions: [],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await game.waitForPhase('playCards', 10000);
    await game.advancePhase();
    await game.waitForPhase('scoreBases', 10000);

    await expect(page.getByRole('button', { name: /基地永远不够/ })).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-the-base-is-not-enough-response-choice', testInfo);
    await page.getByRole('button', { name: /基地永远不够/ }).click({ force: true });

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'super_spies_the_base_is_not_enough_choose'
        && prompt?.playerId === '0'
        && optionIds.includes('control-low-a')
        && optionIds.includes('control-low-b')
        && !optionIds.includes('control-high-c');
    }, {
      message: 'The Base Is Not Enough 应只列本次计分基地力量 4 或以下的随从候选',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-minion-uid="control-low-a"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="control-low-b"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="control-high-c"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="control-low-a"]')).toHaveCount(0);
    await expect(page.locator('[data-option-id="control-high-c"]')).toHaveCount(0);
    await game.screenshot('yuanhou-the-base-is-not-enough-low-power-choice-prompt', testInfo);
    await page.locator('[data-minion-uid="control-low-b"]').click();
    await drainOpenReactionOrResponseWindows(game, 'The Base Is Not Enough 选择低力量随从后的计分响应收口');

    await expect.poll(async () => {
      const state = await game.getState();
      const base = state?.core?.bases?.[0];
      const p0Discard = state?.core?.players?.['0']?.discard ?? [];
      const p1Discard = state?.core?.players?.['1']?.discard ?? [];
      return state?.sys?.interaction?.current == null
        && state?.sys?.responseWindow?.current == null
        && base?.defId === 'base_the_nexus'
        && state?.core?.players?.['0']?.vp === 3
        && state?.core?.players?.['1']?.vp === 2
        && hasUid(p0Discard, 'base-not-enough-hand')
        && hasUid(p0Discard, 'base-not-enough-anchor')
        && hasUid(p1Discard, 'control-low-a')
        && hasUid(p1Discard, 'control-low-b')
        && hasUid(p1Discard, 'control-high-c');
    }, {
      message: 'The Base Is Not Enough 控制所选目标后应让 P0 在本次计分中反超获胜，并按 owner 清场',
      timeout: 20000,
    }).toBe(true);

    await screenshotViewport(page, 'yuanhou-the-base-is-not-enough-scoring-resolved', testInfo);
  });

  test('超级间谍-Secret Agent-真实入口会让行动玩家自己选择弃掉剩余手牌', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
                { uid: 'stasis-a', defId: 'time_travelers_stasis_field', type: 'action', owner: '0' },
                { uid: 'hand-a', defId: 'sharks_mako', type: 'minion', owner: '0' },
                { uid: 'hand-b', defId: 'time_travelers_time_walk', type: 'action', owner: '0' },
              ],
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
              hand: [],
              deck: [],
              discard: [],
              factions: ['time_travelers', 'cyborg_apes'],
              minionsPlayed: 0,
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
            { defId: 'base_portal_room', breakpoint: 22, minions: [], ongoingActions: [] },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="stasis-a"]').click();
    await page.getByTestId('base-zone-1').click({ force: true });

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      const targetBase = state?.core?.bases?.[1];
      return prompt?.data?.sourceId === 'super_spies_secret_agent_discard'
        && prompt?.playerId === '0'
        && optionIds.includes('hand-a')
        && optionIds.includes('hand-b')
        && !optionIds.includes('stasis-a')
        && hasUid(targetBase?.ongoingActions, 'stasis-a')
        && state?.core?.players?.['0']?.actionsPlayed === 1;
    }, {
      message: 'Secret Agent 真实打出链应在行动附着到基地后，把弃一张剩余手牌的选择权交还给行动玩家本人',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-card-uid="hand-a"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-card-uid="hand-b"]')).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-secret-agent-discard-prompt', testInfo);

    await page.locator('[data-card-uid="hand-b"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const p0Hand = state?.core?.players?.['0']?.hand?.map((card: any) => card.uid) ?? [];
      const p0Discard = state?.core?.players?.['0']?.discard?.map((card: any) => card.uid) ?? [];
      const targetBase = state?.core?.bases?.[1];
      return state?.sys?.interaction?.current == null
        && p0Hand.join(',') === 'hand-a'
        && p0Discard.join(',') === 'hand-b'
        && hasUid(targetBase?.ongoingActions, 'stasis-a')
        && !hasUid(p0Hand, 'stasis-a');
    }, {
      message: 'Secret Agent 结算后应只让行动玩家弃掉自己选择的剩余手牌，并保留 Stasis Field 继续附着在目标基地',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-secret-agent-discard-resolved', testInfo);
  });

  test('超级间谍-Moon Zero Three-真实天赋可查看任一玩家牌库顶并选择放到牌库底，同时获得本回合首次检索计数', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
                { uid: 'moon-p0-top', defId: 'super_spies_spy', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['super_spies'],
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
                { uid: 'moon-p1-top', defId: 'time_travelers_jumper', type: 'minion', owner: '1' },
                { uid: 'moon-p1-next', defId: 'time_travelers_doctor_when', type: 'minion', owner: '1' },
              ],
              discard: [],
              factions: ['time_travelers'],
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
          titans: [{
            uid: 'moon-zero-live',
            defId: 'super_spies_moon_zero_three',
            faction: 'super_spies',
            ownerId: '0',
            controllerId: '0',
            powerCounters: 0,
            talentUsed: false,
            location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
          }],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await screenshotViewport(page, 'yuanhou-moon-zero-three-talent-ready', testInfo);

    await page.locator('[data-titan-uid="moon-zero-live"]').click({ force: true });

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'titan_super_spies_moon_zero_three_choose_player'
        && prompt?.playerId === '0'
        && optionIds.includes('player-0')
        && optionIds.includes('player-1');
    }, {
      message: 'Moon Zero Three 点击天赋后应先进入“选择要查看的牌库”玩家选择 prompt',
      timeout: 15000,
    }).toBe(true);

    await expectOwnedOverlayPromptChromeSuppressed(page);
    await game.screenshot('yuanhou-moon-zero-three-choose-player-prompt', testInfo);
    await page.getByRole('button', { name: '玩家二 deck' }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'titan_super_spies_moon_zero_three_resolve'
        && prompt?.playerId === '0'
        && optionIds.includes('top')
        && optionIds.includes('bottom');
    }, {
      message: 'Moon Zero Three 选择玩家后应展示该玩家牌库顶牌，并给出放顶/放底按钮',
      timeout: 15000,
    }).toBe(true);

    await expectOwnedOverlayPromptChromeSuppressed(page);
    await game.screenshot('yuanhou-moon-zero-three-top-bottom-prompt', testInfo);
    await page.getByRole('button', { name: '放到牌库底' }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      const p1Deck = state?.core?.players?.['1']?.deck?.map((card: any) => card.uid) ?? [];
      const titan = (state?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'moon-zero-live');
      return state?.sys?.interaction?.current == null
        && p1Deck.join(',') === 'moon-p1-next,moon-p1-top'
        && titan?.talentUsed === true
        && titan?.powerCounters === 1;
    }, {
      message: 'Moon Zero Three 选择放底后，应把目标顶牌移到底，并因本回合第一次 inspect 获得 1 个计数',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-moon-zero-three-bottomed-and-counter-added', testInfo);
  });

  test('超级间谍-Moon Zero Three-真实天赋可查看自己牌库顶并选择放回牌库顶，同时获得本回合首次检索计数', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
                { uid: 'moon-self-top', defId: 'super_spies_spy', type: 'minion', owner: '0' },
                { uid: 'moon-self-next', defId: 'super_spies_operative', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['super_spies'],
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
                { uid: 'moon-p1-top', defId: 'time_travelers_jumper', type: 'minion', owner: '1' },
              ],
              discard: [],
              factions: ['time_travelers'],
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
          titans: [{
            uid: 'moon-zero-self-live',
            defId: 'super_spies_moon_zero_three',
            faction: 'super_spies',
            ownerId: '0',
            controllerId: '0',
            powerCounters: 0,
            talentUsed: false,
            location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
          }],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await screenshotViewport(page, 'yuanhou-moon-zero-three-self-deck-talent-ready', testInfo);

    await page.locator('[data-titan-uid="moon-zero-self-live"]').click({ force: true });

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'titan_super_spies_moon_zero_three_choose_player'
        && prompt?.playerId === '0'
        && optionIds.includes('player-0')
        && optionIds.includes('player-1');
    }, {
      message: 'Moon Zero Three 点击天赋后应先进入“选择要查看的牌库”玩家选择 prompt',
      timeout: 15000,
    }).toBe(true);

    await expectOwnedOverlayPromptChromeSuppressed(page);
    await game.screenshot('yuanhou-moon-zero-three-self-deck-choose-player-prompt', testInfo);
    await page.getByRole('button', { name: '玩家一 deck' }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'titan_super_spies_moon_zero_three_resolve'
        && prompt?.playerId === '0'
        && optionIds.includes('top')
        && optionIds.includes('bottom');
    }, {
      message: 'Moon Zero Three 选择自己牌库后应展示该玩家牌库顶牌，并给出放顶/放底按钮',
      timeout: 15000,
    }).toBe(true);

    await expectOwnedOverlayPromptChromeSuppressed(page);
    await game.screenshot('yuanhou-moon-zero-three-self-deck-top-bottom-prompt', testInfo);
    await page.getByRole('button', { name: '放回牌库顶' }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      const p0Deck = state?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
      const titan = (state?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'moon-zero-self-live');
      return state?.sys?.interaction?.current == null
        && p0Deck.join(',') === 'moon-self-top,moon-self-next'
        && titan?.talentUsed === true
        && titan?.powerCounters === 1;
    }, {
      message: 'Moon Zero Three 选择放顶后，应保持目标牌库顺序不变，并因本回合第一次 inspect 获得 1 个计数',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-moon-zero-three-self-deck-top-resolved', testInfo);
  });

  test('超级间谍-Spy-真实入口可查看自己牌库顶三张并按非默认顶底顺序放回', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
              hand: [{ uid: 'spy-hand', defId: 'super_spies_spy', type: 'minion', owner: '0' }],
              deck: [
                { uid: 'spy-deck-a', defId: 'super_spies_spy', type: 'minion', owner: '0' },
                { uid: 'spy-deck-b', defId: 'super_spies_operative', type: 'minion', owner: '0' },
                { uid: 'spy-deck-c', defId: 'super_spies_mole', type: 'minion', owner: '0' },
                { uid: 'spy-deck-d', defId: 'super_spies_secret_agent', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['super_spies'],
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
              factions: ['time_travelers'],
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

    await page.locator('[data-card-uid="spy-hand"]').click();
    await page.getByTestId('base-zone-0').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      return prompt?.data?.sourceId === 'super_spies_spy_reorder'
        && prompt?.playerId === '0'
        && optionIds.length > 0
        && hasUid(minions, 'spy-hand');
    }, {
      message: 'Spy 真实打出后应先查看自己牌库顶三张，并在本体进场后进入顶/底顺序选择 prompt',
      timeout: 15000,
    }).toBe(true);

    await expectOwnedOverlayPromptChromeSuppressed(page);

    await game.screenshot('yuanhou-spy-top-three-reorder-prompt', testInfo);
    await page.locator('[data-deck-reorder-card-uid="spy-deck-b"]').click();
    await page.getByRole('button', { name: '移到牌库底' }).click();
    await page.locator('[data-deck-reorder-card-uid="spy-deck-c"]').click();
    await page.getByRole('button', { name: '前移' }).click();
    await page.getByRole('button', { name: '确认顺序' }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      const deck = state?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
      return state?.sys?.interaction?.current == null
        && deck.join(',') === 'spy-deck-c,spy-deck-a,spy-deck-d,spy-deck-b';
    }, {
      message: 'Spy 应只重排本次查看的顶三张；所选顶牌先回牌库顶，未查看第四张保留在中段，放底牌留在末尾',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-spy-top-three-reordered-deck-resolved', testInfo);
  });

  test('超级间谍-Spy-真实入口空选重排后应保持牌库默认顺序并直接收口', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
              hand: [{ uid: 'spy-empty-choice-hand', defId: 'super_spies_spy', type: 'minion', owner: '0' }],
              deck: [
                { uid: 'spy-empty-choice-deck-a', defId: 'super_spies_spy', type: 'minion', owner: '0' },
                { uid: 'spy-empty-choice-deck-b', defId: 'super_spies_operative', type: 'minion', owner: '0' },
                { uid: 'spy-empty-choice-deck-c', defId: 'super_spies_mole', type: 'minion', owner: '0' },
                { uid: 'spy-empty-choice-deck-d', defId: 'super_spies_secret_agent', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['super_spies'],
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
              factions: ['time_travelers'],
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

    await page.locator('[data-card-uid="spy-empty-choice-hand"]').click();
    await page.getByTestId('base-zone-0').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      return prompt?.data?.sourceId === 'super_spies_spy_reorder'
        && prompt?.playerId === '0'
        && optionIds.length > 0
        && hasUid(minions, 'spy-empty-choice-hand');
    }, {
      message: 'Spy 真实打出后应进入顶/底顺序选择 prompt，允许不选任何牌直接确认默认顺序',
      timeout: 15000,
    }).toBe(true);

    await expectOwnedOverlayPromptChromeSuppressed(page);
    await game.screenshot('yuanhou-spy-empty-selection-prompt', testInfo);
    await page.getByRole('button', { name: '确认顺序' }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      const deck = state?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      return state?.sys?.interaction?.current == null
        && deck.join(',') === 'spy-empty-choice-deck-a,spy-empty-choice-deck-b,spy-empty-choice-deck-c,spy-empty-choice-deck-d'
        && hasUid(minions, 'spy-empty-choice-hand')
        && !hasUid(state?.core?.players?.['0']?.hand, 'spy-empty-choice-hand');
    }, {
      message: 'Spy 空选重排后应保持牌库默认顺序，本体正常留在基地上并直接收口',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-spy-empty-selection-resolved', testInfo);
  });

  test('超级间谍-Moon Zero Three-Spy 真实入口查看自己牌库顶三张时也应获得本回合首次检索计数', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
              hand: [{ uid: 'moon-spy-hand', defId: 'super_spies_spy', type: 'minion', owner: '0' }],
              deck: [
                { uid: 'moon-spy-deck-a', defId: 'super_spies_spy', type: 'minion', owner: '0' },
                { uid: 'moon-spy-deck-b', defId: 'super_spies_operative', type: 'minion', owner: '0' },
                { uid: 'moon-spy-deck-c', defId: 'super_spies_mole', type: 'minion', owner: '0' },
                { uid: 'moon-spy-deck-d', defId: 'super_spies_secret_agent', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['super_spies'],
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
                { uid: 'moon-spy-p1-top', defId: 'time_travelers_jumper', type: 'minion', owner: '1' },
              ],
              discard: [],
              factions: ['time_travelers'],
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
          titans: [{
            uid: 'moon-zero-spy-live',
            defId: 'super_spies_moon_zero_three',
            faction: 'super_spies',
            ownerId: '0',
            controllerId: '0',
            powerCounters: 0,
            talentUsed: false,
            location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
          }],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await screenshotViewport(page, 'yuanhou-moon-zero-three-spy-before-play', testInfo);

    await page.locator('[data-card-uid="moon-spy-hand"]').click();
    await page.getByTestId('base-zone-0').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      const titan = (state?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'moon-zero-spy-live');
      return prompt?.data?.sourceId === 'super_spies_spy_reorder'
        && prompt?.playerId === '0'
        && optionIds.length > 0
        && hasUid(minions, 'moon-spy-hand')
        && titan?.talentUsed === false;
    }, {
      message: 'Moon Zero Three 在场时，Spy 真实打出后的顶三查看应进入 Spy 自己的 reorder prompt，而不是误走 Titan 天赋入口',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-moon-zero-three-spy-reorder-prompt-counter-added', testInfo);
    await page.locator('[data-deck-reorder-card-uid="moon-spy-deck-b"]').click();
    await page.getByRole('button', { name: '移到牌库底' }).click();
    await page.locator('[data-deck-reorder-card-uid="moon-spy-deck-c"]').click();
    await page.getByRole('button', { name: '前移' }).click();
    await page.getByRole('button', { name: '确认顺序' }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      const deck = state?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
      const titan = (state?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'moon-zero-spy-live');
      return state?.sys?.interaction?.current == null
        && deck.join(',') === 'moon-spy-deck-c,moon-spy-deck-a,moon-spy-deck-d,moon-spy-deck-b'
        && titan?.talentUsed === false
        && titan?.powerCounters === 1
        && state?.core?.moonZeroThreeTriggeredTurnByTitan?.['moon-zero-spy-live'] === 1;
    }, {
      message: 'Moon Zero Three 的首次 inspect 计数应在 Spy 重排收口后保持 1，且不应把这条非天赋来源改写成 Titan 天赋使用',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-moon-zero-three-spy-reordered-counter-preserved', testInfo);
  });

  test('超级间谍-Moon Zero Three-For My Eyes Only 真实入口查看自己牌库顶五张时也应获得本回合首次检索计数', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
              hand: [{ uid: 'moon-eyes-hand', defId: 'super_spies_for_my_eyes_only', type: 'action', owner: '0' }],
              deck: [
                { uid: 'moon-eyes-deck-a', defId: 'super_spies_spy', type: 'minion', owner: '0' },
                { uid: 'moon-eyes-deck-b', defId: 'super_spies_operative', type: 'minion', owner: '0' },
                { uid: 'moon-eyes-deck-c', defId: 'super_spies_mole', type: 'minion', owner: '0' },
                { uid: 'moon-eyes-deck-d', defId: 'super_spies_secret_agent', type: 'minion', owner: '0' },
                { uid: 'moon-eyes-deck-e', defId: 'time_travelers_jumper', type: 'minion', owner: '0' },
                { uid: 'moon-eyes-deck-f', defId: 'time_travelers_doctor_when', type: 'minion', owner: '0' },
              ],
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
            { defId: 'base_secret_volcano_headquarters', breakpoint: 18, minions: [], ongoingActions: [] },
            { defId: 'base_portal_room', breakpoint: 20, minions: [], ongoingActions: [] },
          ],
          titans: [{
            uid: 'moon-zero-eyes-live',
            defId: 'super_spies_moon_zero_three',
            faction: 'super_spies',
            ownerId: '0',
            controllerId: '0',
            powerCounters: 0,
            talentUsed: false,
            location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
          }],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await screenshotViewport(page, 'yuanhou-moon-zero-three-eyes-before-play', testInfo);

    await page.locator('[data-card-uid="moon-eyes-hand"]').click();
    await page.locator('[data-card-uid="moon-eyes-hand"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      const titan = (state?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'moon-zero-eyes-live');
      return prompt?.data?.sourceId === 'super_spies_for_my_eyes_only_reorder'
        && prompt?.playerId === '0'
        && optionIds.length > 0
        && titan?.talentUsed === false
        && titan?.powerCounters === 0;
    }, {
      message: 'Moon Zero Three 在场时，For My Eyes Only 真实打出后应进入自己的顶五重排 prompt，而不是误走 Titan 天赋入口',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-moon-zero-three-eyes-reorder-prompt', testInfo);
    await page.locator('[data-deck-reorder-card-uid="moon-eyes-deck-e"]').click();
    await page.getByRole('button', { name: '移到牌库底' }).click();
    await page.locator('[data-deck-reorder-card-uid="moon-eyes-deck-b"]').click();
    await page.getByRole('button', { name: '移到牌库底' }).click();
    await page.locator('[data-deck-reorder-card-uid="moon-eyes-deck-d"]').click();
    await page.getByRole('button', { name: '移到牌库底' }).click();
    await page.locator('[data-deck-reorder-card-uid="moon-eyes-deck-c"]').click();
    await page.getByRole('button', { name: '前移' }).click();
    await page.getByRole('button', { name: '确认顺序' }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      const deck = state?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
      const discard = state?.core?.players?.['0']?.discard?.map((card: any) => card.uid) ?? [];
      const titan = (state?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'moon-zero-eyes-live');
      return state?.sys?.interaction?.current == null
        && deck.join(',') === 'moon-eyes-deck-c,moon-eyes-deck-a,moon-eyes-deck-f,moon-eyes-deck-e,moon-eyes-deck-b,moon-eyes-deck-d'
        && discard.includes('moon-eyes-hand')
        && titan?.talentUsed === false
        && titan?.powerCounters === 1
        && state?.core?.moonZeroThreeTriggeredTurnByTitan?.['moon-zero-eyes-live'] === 1;
    }, {
      message: 'Moon Zero Three 的首次 inspect 计数应在 For My Eyes Only 重排收口后保持 1，且不应把这条非天赋来源改写成 Titan 天赋使用',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-moon-zero-three-eyes-reordered-counter-preserved', testInfo);
  });

  test('超级间谍-Spy-牌库只剩一张时真实入口应自动查看且不弹重排 prompt', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
              hand: [{ uid: 'spy-single-hand', defId: 'super_spies_spy', type: 'minion', owner: '0' }],
              deck: [
                { uid: 'spy-single-deck-a', defId: 'super_spies_secret_agent', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['super_spies'],
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
              factions: ['time_travelers'],
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

    await expect(page.locator('[data-card-uid="spy-single-hand"]')).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-spy-single-card-before-play', testInfo);

    await page.locator('[data-card-uid="spy-single-hand"]').click();
    await page.getByTestId('base-zone-0').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const p0Deck = state?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
      const baseMinions = state?.core?.bases?.[0]?.minions ?? [];
      return state?.sys?.interaction?.current == null
        && hasUid(baseMinions, 'spy-single-hand')
        && p0Deck.join(',') === 'spy-single-deck-a'
        && !hasUid(state?.core?.players?.['0']?.hand, 'spy-single-hand');
    }, {
      message: 'Spy 在牌库只剩一张时应自动查看该牌且不创建 super_spies_spy_reorder prompt，本体直接进场并收口',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: /顶：/ })).toHaveCount(0);
    await game.screenshot('yuanhou-spy-single-card-auto-inspected-without-reorder-prompt', testInfo);
  });

  test('超级间谍-Spy-牌库为空时真实入口不应创建重排 prompt', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
              hand: [{ uid: 'spy-empty-hand', defId: 'super_spies_spy', type: 'minion', owner: '0' }],
              deck: [],
              discard: [],
              factions: ['super_spies'],
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
              factions: ['time_travelers'],
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

    await expect(page.locator('[data-card-uid="spy-empty-hand"]')).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-spy-empty-deck-before-play', testInfo);

    await page.locator('[data-card-uid="spy-empty-hand"]').click();
    await page.getByTestId('base-zone-0').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const p0Deck = state?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
      const baseMinions = state?.core?.bases?.[0]?.minions ?? [];
      return state?.sys?.interaction?.current == null
        && hasUid(baseMinions, 'spy-empty-hand')
        && p0Deck.length === 0
        && !hasUid(state?.core?.players?.['0']?.hand, 'spy-empty-hand');
    }, {
      message: 'Spy 在牌库为空时应直接进场并收口，不创建 super_spies_spy_reorder prompt',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: /顶：/ })).toHaveCount(0);
    await game.screenshot('yuanhou-spy-empty-deck-no-reorder-prompt', testInfo);
  });

  test('超级间谍-Operative-真实入口可多选玩家并只把选中展示牌放到对应牌库底', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
              hand: [{ uid: 'operative-hand', defId: 'super_spies_operative', type: 'minion', owner: '0' }],
              deck: [
                { uid: 'p0-top', defId: 'super_spies_for_my_eyes_only', type: 'action', owner: '0' },
                { uid: 'p0-second', defId: 'super_spies_from_q_with_love', type: 'action', owner: '0' },
              ],
              discard: [],
              factions: ['super_spies'],
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
                { uid: 'p1-top', defId: 'time_travelers_jumper', type: 'minion', owner: '1' },
                { uid: 'p1-second', defId: 'time_travelers_time_raider', type: 'minion', owner: '1' },
              ],
              discard: [],
              factions: ['time_travelers'],
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

    await page.locator('[data-card-uid="operative-hand"]').click();
    await page.getByTestId('base-zone-0').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      return prompt?.data?.sourceId === 'super_spies_operative_players'
        && prompt?.playerId === '0'
        && optionIds.includes('player-0')
        && optionIds.includes('player-1')
        && hasUid(minions, 'operative-hand');
    }, {
      message: 'Operative 真实打出后应先进入可多选玩家的第一层 prompt，且本体已经在目标基地',
      timeout: 15000,
    }).toBe(true);

    await page.getByRole('button', { name: '超级间谍' }).click();
    await page.getByRole('button', { name: '时间旅行者' }).click();
    await game.screenshot('yuanhou-operative-player-choice-both-selected', testInfo);
    await page.getByRole('button', { name: /确认/ }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'super_spies_operative_top_bottom'
        && prompt?.playerId === '0'
        && optionIds.includes('p0-top')
        && optionIds.includes('p1-top')
        && !optionIds.includes('p0-second')
        && !optionIds.includes('p1-second');
    }, {
      message: 'Operative 第二层 prompt 应只列被选玩家各自刚展示的牌库顶牌',
      timeout: 15000,
    }).toBe(true);

    await page.locator('[data-option-id="p1-top"]').click();
    await game.screenshot('yuanhou-operative-top-bottom-choice-p1-bottom-selected', testInfo);
    await page.getByRole('button', { name: /确认/ }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      const p0Deck = state?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
      const p1Deck = state?.core?.players?.['1']?.deck?.map((card: any) => card.uid) ?? [];
      return state?.sys?.interaction?.current == null
        && p0Deck.join(',') === 'p0-top,p0-second'
        && p1Deck.join(',') === 'p1-second,p1-top';
    }, {
      message: 'Operative 只应把玩家明确选中的展示牌放到底，未选展示牌保持在牌库顶，并清空交互',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-operative-selected-card-bottomed-and-unselected-kept-top', testInfo);
  });

  test('超级间谍-Operative-真实入口空选玩家后应直接收口且不展示任何牌库顶牌', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
              hand: [{ uid: 'operative-empty-hand', defId: 'super_spies_operative', type: 'minion', owner: '0' }],
              deck: [
                { uid: 'operative-empty-p0-top', defId: 'super_spies_for_my_eyes_only', type: 'action', owner: '0' },
                { uid: 'operative-empty-p0-second', defId: 'super_spies_from_q_with_love', type: 'action', owner: '0' },
              ],
              discard: [],
              factions: ['super_spies'],
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
                { uid: 'operative-empty-p1-top', defId: 'time_travelers_jumper', type: 'minion', owner: '1' },
                { uid: 'operative-empty-p1-second', defId: 'time_travelers_time_raider', type: 'minion', owner: '1' },
              ],
              discard: [],
              factions: ['time_travelers'],
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

    await page.locator('[data-card-uid="operative-empty-hand"]').click();
    await page.getByTestId('base-zone-0').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      return prompt?.data?.sourceId === 'super_spies_operative_players'
        && prompt?.playerId === '0'
        && optionIds.includes('player-0')
        && optionIds.includes('player-1')
        && hasUid(minions, 'operative-empty-hand');
    }, {
      message: 'Operative 空选分支也应先进入玩家多选 prompt，且本体已经在目标基地',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '超级间谍' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: '时间旅行者' })).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-operative-empty-player-choice-prompt', testInfo);
    await page.getByRole('button', { name: /确认/ }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      const p0Deck = state?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
      const p1Deck = state?.core?.players?.['1']?.deck?.map((card: any) => card.uid) ?? [];
      return state?.sys?.interaction?.current == null
        && p0Deck.join(',') === 'operative-empty-p0-top,operative-empty-p0-second'
        && p1Deck.join(',') === 'operative-empty-p1-top,operative-empty-p1-second'
        && !hasUid(state?.core?.players?.['0']?.hand, 'operative-empty-hand')
        && hasUid(state?.core?.bases?.[0]?.minions, 'operative-empty-hand');
    }, {
      message: 'Operative 空选 0 人确认后应直接收口，且两边牌库顶顺序保持不变',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-option-id="operative-empty-p0-top"]')).toHaveCount(0);
    await expect(page.locator('[data-option-id="operative-empty-p1-top"]')).toHaveCount(0);
    await game.screenshot('yuanhou-operative-empty-choice-resolved-without-reveal', testInfo);
  });

  test('超级间谍-Operative-真实入口空选展示牌后应保持各牌库顶顺序并直接收口', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
              hand: [{ uid: 'operative-bottom-empty-hand', defId: 'super_spies_operative', type: 'minion', owner: '0' }],
              deck: [
                { uid: 'operative-bottom-empty-p0-top', defId: 'super_spies_for_my_eyes_only', type: 'action', owner: '0' },
                { uid: 'operative-bottom-empty-p0-second', defId: 'super_spies_from_q_with_love', type: 'action', owner: '0' },
              ],
              discard: [],
              factions: ['super_spies'],
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
                { uid: 'operative-bottom-empty-p1-top', defId: 'time_travelers_jumper', type: 'minion', owner: '1' },
                { uid: 'operative-bottom-empty-p1-second', defId: 'time_travelers_time_raider', type: 'minion', owner: '1' },
              ],
              discard: [],
              factions: ['time_travelers'],
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

    await page.locator('[data-card-uid="operative-bottom-empty-hand"]').click();
    await page.getByTestId('base-zone-0').click();

    await expect.poll(async () => {
      const state = await game.getState();
      return state?.sys?.interaction?.current?.data?.sourceId === 'super_spies_operative_players';
    }, {
      message: 'Operative 第二层空选分支前应先进入玩家多选 prompt',
      timeout: 15000,
    }).toBe(true);

    await page.getByRole('button', { name: '超级间谍' }).click();
    await page.getByRole('button', { name: '时间旅行者' }).click();
    await page.getByRole('button', { name: /确认/ }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'super_spies_operative_top_bottom'
        && optionIds.includes('operative-bottom-empty-p0-top')
        && optionIds.includes('operative-bottom-empty-p1-top');
    }, {
      message: 'Operative 第二层 prompt 应只列被展示的两张顶牌，供玩家选择是否放底',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-operative-top-bottom-empty-selection-prompt', testInfo);
    await page.getByRole('button', { name: /确认/ }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      const p0Deck = state?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
      const p1Deck = state?.core?.players?.['1']?.deck?.map((card: any) => card.uid) ?? [];
      return state?.sys?.interaction?.current == null
        && p0Deck.join(',') === 'operative-bottom-empty-p0-top,operative-bottom-empty-p0-second'
        && p1Deck.join(',') === 'operative-bottom-empty-p1-top,operative-bottom-empty-p1-second'
        && hasUid(state?.core?.bases?.[0]?.minions, 'operative-bottom-empty-hand');
    }, {
      message: 'Operative 第二层 0 张放底确认后应直接收口，且两边牌库顶顺序保持不变',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-operative-top-bottom-empty-selection-resolved', testInfo);
  });

  test('时间旅行者-Its Astounding-真实入口可选择弃牌堆行动并继续该行动目标链', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
              hand: [{ uid: 'astounding-hand', defId: 'time_travelers_its_astounding', type: 'action', owner: '0' }],
              deck: [
                { uid: 'draw-a', defId: 'time_travelers_jumper', type: 'minion', owner: '0' },
                { uid: 'draw-b', defId: 'time_travelers_time_raider', type: 'minion', owner: '0' },
              ],
              discard: [
                { uid: 'time-walk-discard', defId: 'time_travelers_time_walk', type: 'action', owner: '0' },
                { uid: 'bananas-discard', defId: 'cyborg_apes_going_bananas', type: 'action', owner: '0' },
              ],
              factions: ['time_travelers', 'cyborg_apes'],
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
              factions: ['shapeshifters'],
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
                uid: 'astounding-host-a',
                defId: 'cyborg_apes_cyberback',
                controller: '0',
                owner: '0',
                basePower: 5,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [
                  { uid: 'own-action-a', defId: 'cyborg_apes_cyberevolution', ownerId: '0' },
                  { uid: 'enemy-action-a', defId: 'shapeshifters_splice_as_nice', ownerId: '1' },
                ],
              }],
              ongoingActions: [],
            },
            {
              defId: 'base_portal_room',
              breakpoint: 20,
              minions: [{
                uid: 'astounding-host-b',
                defId: 'cyborg_apes_cyberback',
                controller: '1',
                owner: '1',
                basePower: 5,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [
                  { uid: 'enemy-action-b', defId: 'cyborg_apes_shielding', ownerId: '1' },
                ],
              }],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="astounding-hand"]').click();
    await page.locator('[data-card-uid="astounding-hand"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'time_travelers_its_astounding_choose'
        && prompt?.playerId === '0'
        && optionIds.includes('time-walk-discard')
        && optionIds.includes('bananas-discard');
    }, {
      message: "It's Astounding 真实入口应先从弃牌堆可打出的行动中选择一张",
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-its-astounding-discard-action-choice-prompt', testInfo);
    await page.locator('[data-option-id="bananas-discard"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'time_travelers_its_astounding_target'
        && prompt?.playerId === '0'
        && optionIds.includes('base-0')
        && optionIds.includes('base-1');
    }, {
      message: "It's Astounding 选择 Going Bananas 后应继续该行动自己的基地目标选择链",
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-its-astounding-going-bananas-target-prompt', testInfo);
    await page.getByRole('button', { name: '猴子实验室' }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      const base0Host = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'astounding-host-a');
      const base1Host = state?.core?.bases?.[1]?.minions?.find((minion: any) => minion.uid === 'astounding-host-b');
      const discard = state?.core?.players?.['0']?.discard ?? [];
      const hand = state?.core?.players?.['0']?.hand ?? [];
      return state?.sys?.interaction?.current == null
        && !hasUid(base0Host?.attachedActions, 'enemy-action-a')
        && hasUid(base0Host?.attachedActions, 'own-action-a')
        && hasUid(base1Host?.attachedActions, 'enemy-action-b')
        && hasUid(discard, 'astounding-hand')
        && hasUid(discard, 'bananas-discard')
        && !hasUid(hand, 'astounding-hand');
    }, {
      message: "It's Astounding 应从弃牌堆额外打出 Going Bananas，并只结算玩家选择的目标基地",
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '猴子实验室' })).toBeHidden({ timeout: 15000 });
    await expect(page.getByRole('button', { name: '传送门' })).toBeHidden({ timeout: 15000 });
    await game.screenshot('yuanhou-its-astounding-going-bananas-resolved', testInfo);
  });

  test('时间旅行者-Its Astounding-真实入口可选择弃牌堆持续行动并继续随从目标附着链', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
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
              hand: [{ uid: 'astounding-evo-hand', defId: 'time_travelers_its_astounding', type: 'action', owner: '0' }],
              deck: [
                { uid: 'astounding-evo-draw-a', defId: 'time_travelers_jumper', type: 'minion', owner: '0' },
              ],
              discard: [
                { uid: 'astounding-evo-discard', defId: 'cyborg_apes_cyberevolution', type: 'action', owner: '0' },
                { uid: 'astounding-evo-walk', defId: 'time_travelers_time_walk', type: 'action', owner: '0' },
              ],
              factions: ['time_travelers', 'cyborg_apes'],
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
              factions: ['shapeshifters'],
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
                uid: 'astounding-evo-own-host',
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
              }],
              ongoingActions: [],
            },
            {
              defId: 'base_portal_room',
              breakpoint: 20,
              minions: [{
                uid: 'astounding-evo-enemy-host',
                defId: 'time_travelers_jumper',
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
          baseDeck: ['base_monkey_lab'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="astounding-evo-hand"]').click();
    await page.locator('[data-card-uid="astounding-evo-hand"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'time_travelers_its_astounding_choose'
        && prompt?.playerId === '0'
        && optionIds.includes('astounding-evo-discard')
        && optionIds.includes('astounding-evo-walk');
    }, {
      message: "It's Astounding 真实入口应先给出弃牌堆里可打出的行动候选",
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-its-astounding-cyberevolution-discard-choice-prompt', testInfo);
    await page.locator('[data-option-id="astounding-evo-discard"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'time_travelers_its_astounding_target'
        && prompt?.playerId === '0'
        && optionIds.includes('minion-astounding-evo-own-host')
        && optionIds.includes('minion-astounding-evo-enemy-host');
    }, {
      message: "It's Astounding 选择 Cyberevolution 后应继续进入随从目标选择链",
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-its-astounding-cyberevolution-target-prompt', testInfo);
    await page.getByRole('button', { name: '跳跃者 @ 传送门' }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      const ownHost = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'astounding-evo-own-host');
      const enemyHost = state?.core?.bases?.[1]?.minions?.find((minion: any) => minion.uid === 'astounding-evo-enemy-host');
      const discard = state?.core?.players?.['0']?.discard ?? [];
      return state?.sys?.interaction?.current == null
        && !hasUid(ownHost?.attachedActions, 'astounding-evo-discard')
        && hasUid(enemyHost?.attachedActions, 'astounding-evo-discard')
        && hasUid(discard, 'astounding-evo-hand')
        && !hasUid(discard, 'astounding-evo-discard');
    }, {
      message: "It's Astounding 应从弃牌堆额外打出 Cyberevolution，并把它附着到玩家所选的随从宿主",
      timeout: 15000,
    }).toBe(true);

    const enemyHost = page.locator('[data-minion-uid="astounding-evo-enemy-host"]');
    const plusThreeBadge = page.locator('[data-minion-uid="astounding-evo-enemy-host"] [title*="电子进化: +3"]');
    await expect(plusThreeBadge).toBeVisible({ timeout: 15000 });
    await expect(plusThreeBadge).toHaveText('+3');
    await screenshotLocator(enemyHost, 'yuanhou-its-astounding-cyberevolution-attached-to-selected-minion', testInfo);
    await screenshotViewport(page, 'yuanhou-its-astounding-cyberevolution-resolved-viewport', testInfo);
  });

  test('电子猿-Primate Park-真实计分后赢家可多选这里附着行动回各自拥有者手牌', async ({ page, game }, testInfo) => {
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
              hand: [],
              deck: [],
              discard: [],
              factions: ['cyborg_apes'],
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
              factions: ['shapeshifters'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_primate_park',
              breakpoint: 20,
              minions: [{
                uid: 'primate-host-a',
                defId: 'cyborg_apes_cyberback',
                controller: '0',
                owner: '0',
                basePower: 20,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [
                  { uid: 'primate-action-own', defId: 'cyborg_apes_cyberevolution', ownerId: '0' },
                  { uid: 'primate-action-enemy', defId: 'cyborg_apes_shielding', ownerId: '1' },
                ],
              }],
              ongoingActions: [],
            },
            {
              defId: 'base_monkey_lab',
              breakpoint: 20,
              minions: [{
                uid: 'other-host-a',
                defId: 'cyborg_apes_cyberback',
                controller: '0',
                owner: '0',
                basePower: 5,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [
                  { uid: 'other-base-action', defId: 'cyborg_apes_juiced_up', ownerId: '1' },
                ],
              }],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await game.waitForPhase('playCards', 10000);
    await game.advancePhase();
    await game.waitForPhase('scoreBases', 10000);

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const status = await page.evaluate(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        return {
          sourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
          windowType: state?.sys?.responseWindow?.current?.windowType ?? null,
        };
      });
      if (status.sourceId === 'base_primate_park_return') break;
      if (status.sourceId === 'smashup_reaction_choose') {
        const primateButton = page.getByRole('button', { name: '灵长类公园' });
        if (await primateButton.isVisible().catch(() => false)) {
          await primateButton.click({ force: true });
          await page.waitForTimeout(300);
          continue;
        }
      }
      if (status.windowType) {
        await game.passResponseWindow();
      }
      await page.waitForTimeout(300);
    }

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'base_primate_park_return'
        && prompt?.playerId === '0'
        && prompt?.data?.multi?.min === 0
        && optionIds.includes('primate-action-own')
        && optionIds.includes('primate-action-enemy')
        && !optionIds.includes('other-base-action');
    }, {
      message: 'Primate Park 真实计分后应只列本基地随从上的附着行动，且允许赢家多选任意数量',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-option-id="primate-action-own"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="primate-action-enemy"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="other-base-action"]')).toBeHidden({ timeout: 15000 });
    await game.screenshot('yuanhou-primate-park-attached-action-choice-prompt', testInfo);

    await page.locator('[data-option-id="primate-action-own"]').click();
    await page.locator('[data-option-id="primate-action-enemy"]').click();
    await game.screenshot('yuanhou-primate-park-two-actions-selected-before-confirm', testInfo);
    await page.getByRole('button', { name: /确认/ }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      const p0Hand = state?.core?.players?.['0']?.hand ?? [];
      const p1Hand = state?.core?.players?.['1']?.hand ?? [];
      const p1Discard = state?.core?.players?.['1']?.discard ?? [];
      const otherHost = state?.core?.bases?.[1]?.minions?.find((minion: any) => minion.uid === 'other-host-a');
      return state?.sys?.interaction?.current == null
        && state?.sys?.responseWindow?.current == null
        && hasUid(p0Hand, 'primate-action-own')
        && hasUid(p1Hand, 'primate-action-enemy')
        && !hasUid(p1Discard, 'primate-action-enemy')
        && hasUid(otherHost?.attachedActions, 'other-base-action');
    }, {
      message: 'Primate Park 选择的附着行动应分别回到各自拥有者手牌，其他基地附着行动保持不变并收口',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: /确认/ })).toBeHidden({ timeout: 15000 });
    await game.screenshot('yuanhou-primate-park-returned-actions-to-owners-hands', testInfo);
  });

  test('电子猿-Primate Park-真实计分后空选附着行动应直接收口并保持未选行动不回手', async ({ page, game }, testInfo) => {
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
              hand: [],
              deck: [
                { uid: 'primate-draw-a', defId: 'sharks_mako', type: 'minion', owner: '0' },
                { uid: 'primate-draw-b', defId: 'time_travelers_time_walk', type: 'action', owner: '0' },
              ],
              discard: [],
              factions: ['cyborg_apes'],
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
                { uid: 'primate-enemy-draw-a', defId: 'sharks_hammerhead', type: 'minion', owner: '1' },
              ],
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
              defId: 'base_primate_park',
              breakpoint: 20,
              minions: [{
                uid: 'primate-host-a',
                defId: 'cyborg_apes_cyberback',
                controller: '0',
                owner: '0',
                basePower: 20,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [
                  { uid: 'primate-action-own', defId: 'cyborg_apes_cyberevolution', ownerId: '0' },
                  { uid: 'primate-action-enemy', defId: 'cyborg_apes_shielding', ownerId: '1' },
                ],
              }],
              ongoingActions: [],
            },
            {
              defId: 'base_monkey_lab',
              breakpoint: 20,
              minions: [{
                uid: 'other-host-a',
                defId: 'cyborg_apes_cyberback',
                controller: '0',
                owner: '0',
                basePower: 5,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [
                  { uid: 'other-base-action', defId: 'cyborg_apes_juiced_up', ownerId: '1' },
                ],
              }],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await game.waitForPhase('playCards', 10000);
    await game.advancePhase();
    await game.waitForPhase('scoreBases', 10000);

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const status = await page.evaluate(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        return {
          sourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
          windowType: state?.sys?.responseWindow?.current?.windowType ?? null,
        };
      });
      if (status.sourceId === 'base_primate_park_return') break;
      if (status.sourceId === 'smashup_reaction_choose') {
        const primateButton = page.getByRole('button', { name: '灵长类公园' });
        if (await primateButton.isVisible().catch(() => false)) {
          await primateButton.click({ force: true });
          await page.waitForTimeout(300);
          continue;
        }
      }
      if (status.windowType) {
        await game.passResponseWindow();
      }
      await page.waitForTimeout(300);
    }

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'base_primate_park_return'
        && prompt?.playerId === '0'
        && prompt?.data?.multi?.min === 0
        && optionIds.includes('primate-action-own')
        && optionIds.includes('primate-action-enemy')
        && !optionIds.includes('other-base-action');
    }, {
      message: 'Primate Park 空选分支也应先给出附着行动多选 prompt，并允许赢家直接 0 张确认',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-primate-park-empty-selection-prompt', testInfo);
    await page.getByRole('button', { name: /确认/ }).click();
    await expect.poll(async () => {
      const state = await game.getState();
      const p0Hand = state?.core?.players?.['0']?.hand ?? [];
      const p1Hand = state?.core?.players?.['1']?.hand ?? [];
      const p0Discard = state?.core?.players?.['0']?.discard ?? [];
      const p1Discard = state?.core?.players?.['1']?.discard ?? [];
      const otherHost = state?.core?.bases?.[0]?.defId === 'base_monkey_lab'
        ? state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.uid === 'other-host-a')
        : state?.core?.bases?.[1]?.minions?.find((minion: any) => minion.uid === 'other-host-a');
      return state?.sys?.interaction?.current == null
        && state?.sys?.responseWindow?.current == null
        && hasUid(p0Hand, 'primate-draw-a')
        && hasUid(p0Hand, 'primate-draw-b')
        && !hasUid(p0Hand, 'primate-action-own')
        && !hasUid(p1Hand, 'primate-action-enemy')
        && hasUid(p0Discard, 'primate-host-a')
        && hasUid(p0Discard, 'primate-action-own')
        && hasUid(p1Discard, 'primate-action-enemy')
        && hasUid(otherHost?.attachedActions, 'other-base-action')
        && state?.core?.bases?.some((base: any) => base?.defId === 'base_the_nexus');
    }, {
      message: 'Primate Park 空选确认后应直接收口，未选行动不回手，且其他基地附着行动保持不变',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: /确认/ })).toBeHidden({ timeout: 15000 });
    await game.screenshot('yuanhou-primate-park-empty-selection-resolved', testInfo);
  });

  test('时间旅行者-Time Box-真实计分回手链会把第 5 枚计数加到不在场 Time Box 并起进场 prompt', async ({ page, game }, testInfo) => {
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
              hand: [],
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
              factions: ['shapeshifters'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_primate_park',
              breakpoint: 20,
              minions: [{
                uid: 'time-box-primate-host',
                defId: 'cyborg_apes_cyberback',
                controller: '0',
                owner: '0',
                basePower: 20,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [
                  { uid: 'time-box-return-action', defId: 'cyborg_apes_shielding', ownerId: '0' },
                ],
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
          titans: [{
            uid: 'time-box-setaside',
            defId: 'time_travelers_time_box',
            faction: 'time_travelers',
            ownerId: '0',
            controllerId: '0',
            powerCounters: 0,
            talentUsed: false,
            metadata: { timeBoxCounters: 4 },
            location: { zone: 'setaside' },
          }],
          baseDeck: ['base_portal_room'],
          baseDiscard: [],
        },
      },
    });

    await expect.poll(async () => {
      const state = await game.getState();
      const titan = (state?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'time-box-setaside');
      return titan?.location?.zone === 'setaside'
        && titan?.metadata?.timeBoxCounters === 4;
    }, {
      message: '场景注入后，Time Box 应先处于不在场且计数为 4 的待触发状态',
      timeout: 10000,
    }).toBe(true);

    await game.waitForPhase('playCards', 10000);
    await game.advancePhase();
    await game.waitForPhase('scoreBases', 10000);

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const status = await page.evaluate(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        return {
          sourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
          windowType: state?.sys?.responseWindow?.current?.windowType ?? null,
        };
      });
      if (status.sourceId === 'base_primate_park_return') break;
      if (status.sourceId === 'smashup_reaction_choose') {
        const primateButton = page.getByRole('button', { name: '灵长类公园' });
        if (await primateButton.isVisible().catch(() => false)) {
          await primateButton.click({ force: true });
          await page.waitForTimeout(300);
          continue;
        }
      }
      if (status.windowType) {
        await game.passResponseWindow();
      }
      await page.waitForTimeout(300);
    }

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'base_primate_park_return'
        && prompt?.playerId === '0'
        && optionIds.includes('time-box-return-action');
    }, {
      message: 'Primate Park 真实计分后应先给出附着行动回手选择，作为 Time Box 回手触发入口',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-option-id="time-box-return-action"]')).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-time-box-primate-park-return-choice-prompt', testInfo);
    await page.locator('[data-option-id="time-box-return-action"]').click();
    await page.getByRole('button', { name: /确认/ }).click();

    let timeBoxTriggerOptionId = '';
    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const triggerOption = (prompt?.data?.options ?? []).find((option: any) => {
        if (option?.value?.kind !== 'trigger') return false;
        const trigger = state?.core?.triggerQueue?.find((entry: any) => entry?.id === option?.value?.triggerId);
        return trigger?.sourceDefId === 'time_travelers_time_box';
      });
      timeBoxTriggerOptionId = typeof triggerOption?.id === 'string' ? triggerOption.id : '';
      return prompt?.data?.sourceId === 'smashup_reaction_choose'
        && prompt?.playerId === '0'
        && timeBoxTriggerOptionId.length > 0;
    }, {
      message: 'Primate Park 把行动回手后，应先进入 Time Box 的 reaction 选择窗口',
      timeout: 15000,
    }).toBe(true);

    await game.selectOption(timeBoxTriggerOptionId);

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const titan = (state?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'time-box-setaside');
      const hand = state?.core?.players?.['0']?.hand ?? [];
      const scoredBase = state?.core?.bases?.[0];
      const host = scoredBase?.minions?.find((candidate: any) => candidate?.uid === 'time-box-primate-host');
      return prompt?.data?.sourceId === 'titan_time_travelers_time_box_play'
        && prompt?.playerId === '0'
        && titan?.location?.zone === 'setaside'
        && titan?.metadata?.timeBoxCounters === 5
        && hasUid(hand, 'time-box-return-action')
        && Array.isArray(host?.attachedActions)
        && !hasUid(host.attachedActions, 'time-box-return-action');
    }, {
      message: 'Primate Park 的场上行动回手后，应把第 5 枚计数加到不在场 Time Box，并起真实进场 prompt',
      timeout: 15000,
    }).toBe(true);

    const skipTimeBoxPlayButton = page.getByRole('button', { name: '跳过', exact: true });
    await expect(skipTimeBoxPlayButton).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-time-box-counter-hit-five-play-prompt', testInfo);
    await skipTimeBoxPlayButton.click();

    await expect.poll(async () => {
      const state = await game.getState();
      const titan = (state?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'time-box-setaside');
      const hand = state?.core?.players?.['0']?.hand ?? [];
      return state?.sys?.interaction?.current == null
        && state?.sys?.responseWindow?.current == null
        && titan?.location?.zone === 'setaside'
        && titan?.metadata?.timeBoxCounters === 5
        && hasUid(hand, 'time-box-return-action');
    }, {
      message: '跳过 Time Box 进场后，应完成收口并保留第 5 枚计数，回手行动仍在 owner 手牌',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-time-box-skip-play-prompt-after-counter-five', testInfo);
  });

  test('时间旅行者-Time Box-真实第5枚计数进场 prompt 可把 Titan 打到基地并清零计数', async ({ page, game }, testInfo) => {
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
              hand: [],
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
              factions: ['shapeshifters'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_primate_park',
              breakpoint: 20,
              minions: [{
                uid: 'time-box-play-host',
                defId: 'cyborg_apes_cyberback',
                controller: '0',
                owner: '0',
                basePower: 20,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [
                  { uid: 'time-box-play-return-action', defId: 'cyborg_apes_shielding', ownerId: '0' },
                ],
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
          titans: [{
            uid: 'time-box-play-setaside',
            defId: 'time_travelers_time_box',
            faction: 'time_travelers',
            ownerId: '0',
            controllerId: '0',
            powerCounters: 0,
            talentUsed: false,
            metadata: { timeBoxCounters: 4 },
            location: { zone: 'setaside' },
          }],
          baseDeck: ['base_portal_room'],
          baseDiscard: [],
        },
      },
    });

    await expect.poll(async () => {
      const state = await game.getState();
      const titan = (state?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'time-box-play-setaside');
      return titan?.location?.zone === 'setaside'
        && titan?.metadata?.timeBoxCounters === 4;
    }, {
      message: '场景注入后，Time Box 应先处于不在场且计数为 4 的待触发状态',
      timeout: 10000,
    }).toBe(true);

    await game.waitForPhase('playCards', 10000);
    await game.advancePhase();
    await game.waitForPhase('scoreBases', 10000);

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const status = await page.evaluate(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        return {
          sourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
          windowType: state?.sys?.responseWindow?.current?.windowType ?? null,
        };
      });
      if (status.sourceId === 'base_primate_park_return') break;
      if (status.sourceId === 'smashup_reaction_choose') {
        const primateButton = page.getByRole('button', { name: '灵长类公园' });
        if (await primateButton.isVisible().catch(() => false)) {
          await primateButton.click({ force: true });
          await page.waitForTimeout(300);
          continue;
        }
      }
      if (status.windowType) {
        await game.passResponseWindow();
      }
      await page.waitForTimeout(300);
    }

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'base_primate_park_return'
        && prompt?.playerId === '0'
        && optionIds.includes('time-box-play-return-action');
    }, {
      message: 'Primate Park 真实计分后应先给出附着行动回手选择，作为 Time Box 回手触发入口',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-option-id="time-box-play-return-action"]')).toBeVisible({ timeout: 15000 });
    await page.locator('[data-option-id="time-box-play-return-action"]').click();
    await page.getByRole('button', { name: /确认/ }).click();

    let timeBoxTriggerOptionId = '';
    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const triggerOption = (prompt?.data?.options ?? []).find((option: any) => {
        if (option?.value?.kind !== 'trigger') return false;
        const trigger = state?.core?.triggerQueue?.find((entry: any) => entry?.id === option?.value?.triggerId);
        return trigger?.sourceDefId === 'time_travelers_time_box';
      });
      timeBoxTriggerOptionId = typeof triggerOption?.id === 'string' ? triggerOption.id : '';
      return prompt?.data?.sourceId === 'smashup_reaction_choose'
        && prompt?.playerId === '0'
        && timeBoxTriggerOptionId.length > 0;
    }, {
      message: 'Primate Park 把行动回手后，应先进入 Time Box 的 reaction 选择窗口',
      timeout: 15000,
    }).toBe(true);

    await game.selectOption(timeBoxTriggerOptionId);

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const titan = (state?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'time-box-play-setaside');
      const hand = state?.core?.players?.['0']?.hand ?? [];
      return prompt?.data?.sourceId === 'titan_time_travelers_time_box_play'
        && prompt?.playerId === '0'
        && titan?.location?.zone === 'setaside'
        && titan?.metadata?.timeBoxCounters === 5
        && hasUid(hand, 'time-box-play-return-action');
    }, {
      message: 'Primate Park 的场上行动回手后，应把第 5 枚计数加到不在场 Time Box，并起真实进场 prompt',
      timeout: 15000,
    }).toBe(true);

    const timeBoxPromptTitle = page.getByText('时间盒子：是否移除全部计数器并打出到一个基地？');
    await expect(timeBoxPromptTitle).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-time-box-counter-hit-five-play-prompt-before-base-choice', testInfo);
    await page.getByTestId('base-zone-1').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const titan = (state?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'time-box-play-setaside');
      const hand = state?.core?.players?.['0']?.hand ?? [];
      return state?.sys?.interaction?.current == null
        && state?.sys?.responseWindow?.current == null
        && titan?.location?.zone === 'base'
        && titan?.location?.baseIndex === 1
        && titan?.metadata?.timeBoxCounters === 0
        && titan?.metadata?.timeBoxPlayArmed === false
        && hasUid(hand, 'time-box-play-return-action')
        && state?.core?.bases?.[0]?.defId === 'base_portal_room';
    }, {
      message: '选择基地后，应把 Time Box 真实打到所选基地并清零计数，同时原计分基地继续正常替换收口',
      timeout: 20000,
    }).toBe(true);

    await expect(timeBoxPromptTitle).toBeHidden({ timeout: 15000 });
    await game.screenshot('yuanhou-time-box-played-from-counter-prompt-and-cleared', testInfo);
  });

  test('时间旅行者-Time Box-真实回合开始在别的 Titan 已在场时仍会加到第 5 枚计数并起进场 prompt', async ({ page, game }, testInfo) => {
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
              uid: 'time-box-turn-start-setaside',
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
              uid: 'moon-zero-three-live',
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

    await expect.poll(async () => {
      const state = await game.getState();
      const timeBox = (state?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'time-box-turn-start-setaside');
      const moonZero = (state?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'moon-zero-three-live');
      return state?.core?.currentPlayerIndex === 1
        && state?.sys?.phase === 'playCards'
        && timeBox?.location?.zone === 'setaside'
        && timeBox?.metadata?.timeBoxCounters === 4
        && moonZero?.location?.zone === 'base'
        && moonZero?.location?.baseIndex === 0;
    }, {
      message: '场景注入后，应处于 P1 出牌阶段，且 P0 的 Time Box 仍在 setaside 计数 4，同时 Moon Zero Three 已在场',
      timeout: 10000,
    }).toBe(true);

    await game.screenshot('yuanhou-time-box-turn-start-before-end-turn', testInfo);
    await game.waitForPhase('playCards', 10000);
    await game.advancePhase();

    let timeBoxTriggerOptionId = '';
    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const triggerOption = (prompt?.data?.options ?? []).find((option: any) => {
        if (option?.value?.kind !== 'trigger') return false;
        const trigger = state?.core?.triggerQueue?.find((entry: any) => entry?.id === option?.value?.triggerId);
        return trigger?.sourceDefId === 'time_travelers_time_box';
      });
      timeBoxTriggerOptionId = typeof triggerOption?.id === 'string' ? triggerOption.id : '';
      return state?.core?.currentPlayerIndex === 0
        && prompt?.data?.sourceId === 'smashup_reaction_choose'
        && prompt?.playerId === '0'
        && timeBoxTriggerOptionId.length > 0;
    }, {
      message: 'P1 结束回合后，P0 的 startTurn 应先出现 Time Box 的 reaction 选择窗口，即使 Moon Zero Three 已在场',
      timeout: 20000,
    }).toBe(true);

    const timeBoxReactionCard = page.getByTestId('su-rail-titan-time-box-turn-start-setaside');
    const timeBoxReactionBadge = page.getByTestId('su-rail-titan-badge-time-box-turn-start-setaside');
    await expect(timeBoxReactionCard).toBeVisible({ timeout: 15000 });
    await expect(timeBoxReactionBadge).toContainText('可触发');
    await game.screenshot('yuanhou-time-box-turn-start-reaction-choice', testInfo);
    await game.selectOption(timeBoxTriggerOptionId);

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const timeBox = (state?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'time-box-turn-start-setaside');
      const moonZero = (state?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'moon-zero-three-live');
      return state?.core?.currentPlayerIndex === 0
        && prompt?.data?.sourceId === 'titan_time_travelers_time_box_play'
        && prompt?.playerId === '0'
        && timeBox?.location?.zone === 'setaside'
        && timeBox?.metadata?.timeBoxCounters === 5
        && moonZero?.location?.zone === 'base';
    }, {
      message: '选择 Time Box reaction 后，应在别的 Titan 已在场时仍把计数加到第 5 枚并起真实进场 prompt',
      timeout: 15000,
    }).toBe(true);

    const skipTimeBoxPlayButton = page.getByRole('button', { name: '跳过', exact: true });
    await expect(skipTimeBoxPlayButton).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-time-box-turn-start-play-prompt', testInfo);
    await skipTimeBoxPlayButton.click();

    await expect.poll(async () => {
      const state = await game.getState();
      const timeBox = (state?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'time-box-turn-start-setaside');
      const moonZero = (state?.core?.titans ?? []).find((candidate: any) => candidate?.uid === 'moon-zero-three-live');
      return state?.core?.currentPlayerIndex === 0
        && state?.sys?.interaction?.current == null
        && state?.sys?.responseWindow?.current == null
        && state?.sys?.phase === 'playCards'
        && timeBox?.location?.zone === 'setaside'
        && timeBox?.metadata?.timeBoxCounters === 5
        && timeBox?.metadata?.timeBoxPlayArmed === false
        && moonZero?.location?.zone === 'base';
    }, {
      message: '跳过 Time Box 进场后，应进入 P0 出牌阶段并保留第 5 枚计数，同时 Moon Zero Three 仍在场',
      timeout: 20000,
    }).toBe(true);

    await game.screenshot('yuanhou-time-box-turn-start-skip-resolved', testInfo);
  });

  test('电子猿-Flying Monkey-真实计分后可移动宿主到另一基地并摧毁本行动', async ({ page, game }, testInfo) => {
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
              hand: [],
              deck: [
                { uid: 'draw-a', defId: 'cyborg_apes_cyberback', type: 'minion', owner: '0' },
                { uid: 'draw-b', defId: 'cyborg_apes_chimp_chi', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['cyborg_apes'],
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
              factions: ['super_spies'],
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
                uid: 'flying-host',
                defId: 'cyborg_apes_cyberback',
                controller: '0',
                owner: '0',
                basePower: 24,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [
                  { uid: 'flying-action', defId: 'cyborg_apes_flying_monkey', ownerId: '0' },
                ],
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

    await game.waitForPhase('playCards', 10000);
    await game.advancePhase();
    await game.waitForPhase('scoreBases', 10000);

    await expect(page.getByRole('heading', { name: /飞猴：选择要移动到的另一基地/ })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /秘密火山总部/ })).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-flying-monkey-destination-choice-prompt', testInfo);
    await page.getByRole('button', { name: /秘密火山总部/ }).click({ force: true });

    await expect.poll(async () => {
      const state = await game.getState();
      const sourceBase = state?.core?.bases?.[0];
      const destinationBase = state?.core?.bases?.[1];
      const movedHost = destinationBase?.minions?.find((minion: any) => minion.uid === 'flying-host');
      const p0Hand = state?.core?.players?.['0']?.hand ?? [];
      const p0Discard = state?.core?.players?.['0']?.discard ?? [];
      return state?.sys?.interaction?.current == null
        && sourceBase?.defId === 'base_portal_room'
        && destinationBase?.defId === 'base_secret_volcano_headquarters'
        && movedHost?.attachedActions?.every((action: any) => action.uid !== 'flying-action')
        && hasUid(destinationBase?.minions, 'flying-host')
        && hasUid(p0Hand, 'draw-a')
        && hasUid(p0Hand, 'draw-b')
        && hasUid(p0Discard, 'flying-action');
    }, {
      message: 'Flying Monkey 应在真实计分后把宿主移到所选另一基地，并摧毁本行动且完成换基地',
      timeout: 20000,
    }).toBe(true);

    await game.screenshot('yuanhou-flying-monkey-host-moved-and-action-destroyed', testInfo);
  });

  test('电子猿-Flying Monkey-真实计分后跳过移动时应按正常计分清场进入弃牌堆', async ({ page, game }, testInfo) => {
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
              hand: [],
              deck: [
                { uid: 'draw-a', defId: 'cyborg_apes_cyberback', type: 'minion', owner: '0' },
                { uid: 'draw-b', defId: 'cyborg_apes_chimp_chi', type: 'minion', owner: '0' },
              ],
              discard: [],
              factions: ['cyborg_apes'],
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
              factions: ['super_spies'],
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
                uid: 'flying-host',
                defId: 'cyborg_apes_cyberback',
                controller: '0',
                owner: '0',
                basePower: 24,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [
                  { uid: 'flying-action', defId: 'cyborg_apes_flying_monkey', ownerId: '0' },
                ],
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

    await game.waitForPhase('playCards', 10000);
    await game.advancePhase();
    await game.waitForPhase('scoreBases', 10000);

    await expect(page.getByRole('heading', { name: /飞猴：选择要移动到的另一基地/ })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /跳过（照常进入弃牌堆）/ })).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-flying-monkey-skip-prompt', testInfo);
    await page.getByRole('button', { name: /跳过（照常进入弃牌堆）/ }).click({ force: true });

    await expect.poll(async () => {
      const state = await game.getState();
      const sourceBase = state?.core?.bases?.[0];
      const destinationBase = state?.core?.bases?.[1];
      const p0Hand = state?.core?.players?.['0']?.hand ?? [];
      const p0Discard = state?.core?.players?.['0']?.discard ?? [];
      return state?.sys?.interaction?.current == null
        && sourceBase?.defId === 'base_portal_room'
        && destinationBase?.defId === 'base_secret_volcano_headquarters'
        && !hasUid(destinationBase?.minions, 'flying-host')
        && hasUid(p0Hand, 'draw-a')
        && hasUid(p0Hand, 'draw-b')
        && hasUid(p0Discard, 'flying-host')
        && hasUid(p0Discard, 'flying-action');
    }, {
      message: 'Flying Monkey 跳过后应让宿主与本行动按正常计分清场进入弃牌堆，并完成换基地收口',
      timeout: 20000,
    }).toBe(true);

    await game.screenshot('yuanhou-flying-monkey-skipped-and-discarded', testInfo);
  });

  test('时间旅行者-Time Is Fleeting-真实计分后可选择弃牌堆基地代替抽新基地', async ({ page, game }, testInfo) => {
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
                { uid: 'time-fleeting-a', defId: 'time_travelers_time_is_fleeting', type: 'action', owner: '0' },
              ],
              deck: [
                { uid: 'draw-a', defId: 'time_travelers_jumper', type: 'minion', owner: '0' },
                { uid: 'draw-b', defId: 'time_travelers_time_raider', type: 'minion', owner: '0' },
              ],
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
              factions: ['cyborg_apes'],
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
                uid: 'fleeting-winner',
                defId: 'time_travelers_time_raider',
                controller: '0',
                owner: '0',
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

    await game.waitForPhase('playCards', 10000);
    await game.advancePhase();
    await game.waitForPhase('scoreBases', 10000);

    await expect(page.getByRole('button', { name: /时间流逝/ })).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-time-is-fleeting-response-choice', testInfo);
    await page.getByRole('button', { name: /时间流逝/ }).click({ force: true });

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'time_travelers_time_is_fleeting_choose'
        && prompt?.playerId === '0'
        && optionIds.includes('base_the_vats')
        && optionIds.includes('base_faceless_city')
        && optionIds.includes('base_the_nexus')
        && !optionIds.includes('base_monkey_lab');
    }, {
      message: 'Time Is Fleeting 真实响应后应只列本次计分前已在基地弃牌堆中的基地',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-option-id="base_the_vats"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="base_faceless_city"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="base_the_nexus"]')).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-time-is-fleeting-base-discard-choice-prompt', testInfo);
    await page.locator('[data-option-id="base_faceless_city"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const sourceBase = state?.core?.bases?.[0];
      const baseDeck = state?.core?.baseDeck ?? [];
      const baseDiscard = state?.core?.baseDiscard ?? [];
      const p0Hand = state?.core?.players?.['0']?.hand ?? [];
      const p0Discard = state?.core?.players?.['0']?.discard ?? [];
      return state?.sys?.interaction?.current == null
        && state?.sys?.responseWindow?.current == null
        && sourceBase?.defId === 'base_faceless_city'
        && !baseDeck.includes('base_faceless_city')
        && baseDeck.includes('base_primate_park')
        && baseDiscard.includes('base_monkey_lab')
        && baseDiscard.includes('base_the_vats')
        && !baseDiscard.includes('base_faceless_city')
        && hasUid(p0Discard, 'time-fleeting-a')
        && hasUid(p0Hand, 'draw-a')
        && hasUid(p0Hand, 'draw-b');
    }, {
      message: 'Time Is Fleeting 选择的弃牌堆基地应改写本次 deferred BASE_REPLACED，而不是继续翻原 baseDeck 顶牌',
      timeout: 20000,
    }).toBe(true);

    await expect(page.locator('[data-option-id="base_faceless_city"]')).toBeHidden({ timeout: 15000 });
    await screenshotViewport(page, 'yuanhou-time-is-fleeting-selected-discard-base-replaced-new-base', testInfo);
  });

  test('时间旅行者-Time Is Fleeting-真实计分后先结算选基地仍应回到 Wormhole special 入口', async ({ page, game }, testInfo) => {
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
          nextUid: 1050,
          players: {
            '0': {
              id: '0',
              vp: 0,
              hand: [
                { uid: 'time-fleeting-chain', defId: 'time_travelers_time_is_fleeting', type: 'action', owner: '0' },
                { uid: 'wormhole-chain', defId: 'time_travelers_wormhole', type: 'action', owner: '0' },
              ],
              deck: [
                { uid: 'deck-rest', defId: 'time_travelers_jumper', type: 'minion', owner: '0' },
              ],
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
              factions: ['cyborg_apes'],
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
                  uid: 'time-chain-winner',
                  defId: 'time_travelers_time_raider',
                  controller: '0',
                  owner: '0',
                  basePower: 24,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'time-chain-enemy',
                  defId: 'cyborg_apes_cyberback',
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
              defId: 'base_portal_room',
              breakpoint: 20,
              minions: [],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_primate_park'],
          baseDiscard: ['base_the_vats', 'base_faceless_city'],
        },
      },
    });

    await game.waitForPhase('playCards', 10000);
    await game.advancePhase();
    await game.waitForPhase('scoreBases', 10000);

    await expect(page.getByRole('button', { name: /时间流逝/ })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /虫洞/ })).toBeVisible({ timeout: 15000 });
    await screenshotViewport(page, 'yuanhou-time-fleeting-wormhole-shared-reaction-choice', testInfo);
    await page.getByRole('button', { name: /时间流逝/ }).click({ force: true });

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'time_travelers_time_is_fleeting_choose'
        && prompt?.playerId === '0'
        && optionIds.includes('base_the_vats')
        && optionIds.includes('base_faceless_city')
        && !optionIds.includes('base_monkey_lab');
    }, {
      message: '先选择 Time Is Fleeting 后，应先进入自己的基地弃牌堆选择 prompt',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-option-id="base_the_vats"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="base_faceless_city"]')).toBeVisible({ timeout: 15000 });
    await screenshotViewport(page, 'yuanhou-time-fleeting-wormhole-time-is-fleeting-prompt', testInfo);
    await page.locator('[data-option-id="base_faceless_city"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionKinds = (prompt?.data?.options ?? []).map((option: any) => option?.value?.kind);
      const optionCardUids = (prompt?.data?.options ?? []).map((option: any) => option?.value?.cardUid);
      return prompt?.data?.sourceId === 'smashup_reaction_choose'
        && prompt?.playerId === '0'
        && optionKinds.includes('pass')
        && optionCardUids.includes('wormhole-chain')
        && !optionCardUids.includes('time-fleeting-chain');
    }, {
      message: 'Time Is Fleeting 选基地 prompt 结算后，应回到同一 reaction choose 并保留 Wormhole 入口',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: /虫洞/ })).toBeVisible({ timeout: 15000 });
    await screenshotViewport(page, 'yuanhou-time-fleeting-wormhole-reaction-returned-with-wormhole', testInfo);
    await page.getByRole('button', { name: /虫洞/ }).click({ force: true });

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'time_travelers_wormhole_choose'
        && prompt?.playerId === '0'
        && prompt?.data?.multi?.min === 0
        && prompt?.data?.multi?.max === 1
        && optionIds.includes('time-chain-winner')
        && !optionIds.includes('time-chain-enemy');
    }, {
      message: '回到 Wormhole 入口后，应继续进入自己的多选随从 prompt，且不吞掉剩余 special',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-minion-uid="time-chain-winner"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="time-chain-winner"]')).toHaveCount(0);
    await screenshotViewport(page, 'yuanhou-time-fleeting-wormhole-wormhole-prompt-after-return', testInfo);
    await page.locator('[data-minion-uid="time-chain-winner"]').click();
    await page.getByRole('button', { name: /确认/ }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      const p0Discard = state?.core?.players?.['0']?.discard ?? [];
      const p0Deck = state?.core?.players?.['0']?.deck ?? [];
      const p0Hand = state?.core?.players?.['0']?.hand ?? [];
      const p1Discard = state?.core?.players?.['1']?.discard ?? [];
      const allBaseMinions = (state?.core?.bases ?? []).flatMap((base: any) => base?.minions ?? []);
      return state?.sys?.interaction?.current == null
        && state?.sys?.responseWindow?.current == null
        && state?.core?.bases?.[0]?.defId === 'base_faceless_city'
        && !hasUid(allBaseMinions, 'time-chain-winner')
        && !hasUid(allBaseMinions, 'time-chain-enemy')
        && (hasUid(p0Deck, 'time-chain-winner') || hasUid(p0Hand, 'time-chain-winner'))
        && !hasUid(p0Discard, 'time-chain-winner')
        && hasUid(p0Discard, 'time-fleeting-chain')
        && hasUid(p0Discard, 'wormhole-chain')
        && hasUid(p1Discard, 'time-chain-enemy');
    }, {
      message: '同窗先结算 Time Is Fleeting 再结算 Wormhole 后，应保留 Faceless City 替换结果，并让 Wormhole 继续生效',
      timeout: 20000,
    }).toBe(true);

    await screenshotViewport(page, 'yuanhou-time-fleeting-wormhole-final-resolved', testInfo);
  });

  test('时间旅行者-Wormhole-真实计分后可选择任意数量己方随从洗入牌库', async ({ page, game }, testInfo) => {
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
                { uid: 'wormhole-hand', defId: 'time_travelers_wormhole', type: 'action', owner: '0' },
              ],
              deck: [
                { uid: 'draw-a', defId: 'time_travelers_jumper', type: 'minion', owner: '0' },
                { uid: 'draw-b', defId: 'time_travelers_time_raider', type: 'minion', owner: '0' },
                { uid: 'draw-c', defId: 'time_travelers_repeater_perfect', type: 'minion', owner: '0' },
                { uid: 'draw-d', defId: 'time_travelers_doctor_when', type: 'minion', owner: '0' },
              ],
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
              factions: ['cyborg_apes'],
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
              minions: [
                {
                  uid: 'wormhole-jumper',
                  defId: 'time_travelers_jumper',
                  controller: '0',
                  owner: '0',
                  basePower: 10,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'wormhole-raider',
                  defId: 'time_travelers_time_raider',
                  controller: '0',
                  owner: '0',
                  basePower: 14,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'wormhole-enemy',
                  defId: 'cyborg_apes_cyberback',
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
              defId: 'base_secret_volcano_headquarters',
              breakpoint: 18,
              minions: [],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    await game.waitForPhase('playCards', 10000);
    await game.advancePhase();
    await game.waitForPhase('scoreBases', 10000);

    await surfaceWormholeReactionChoice(game, 'wormhole-hand', 'Wormhole 选择分支');
    await expect(page.getByRole('button', { name: /虫洞/ })).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-wormhole-response-choice', testInfo);
    await page.getByRole('button', { name: /虫洞/ }).click({ force: true });

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'time_travelers_wormhole_choose'
        && prompt?.playerId === '0'
        && prompt?.data?.multi?.min === 0
        && prompt?.data?.multi?.max === 2
        && optionIds.includes('wormhole-jumper')
        && optionIds.includes('wormhole-raider')
        && !optionIds.includes('wormhole-enemy');
    }, {
      message: 'Wormhole 真实响应后应提供 0..N 多选，只列这里由 P0 控制的随从',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-minion-uid="wormhole-jumper"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="wormhole-raider"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="wormhole-enemy"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="wormhole-jumper"]')).toHaveCount(0);
    await expect(page.locator('[data-option-id="wormhole-enemy"]')).toHaveCount(0);
    await page.locator('[data-minion-uid="wormhole-raider"]').click();
    await game.screenshot('yuanhou-wormhole-minion-multi-select-prompt', testInfo);
    await page.getByRole('button', { name: /确认/ }).click();

    await screenshotViewport(page, 'yuanhou-wormhole-selected-minion-shuffled-response-continues', testInfo);
    await drainOpenReactionOrResponseWindows(game, 'Wormhole 选择后计分响应收口');

    await expect.poll(async () => {
      const state = await game.getState();
      const p0Discard = state?.core?.players?.['0']?.discard ?? [];
      const p0Deck = state?.core?.players?.['0']?.deck ?? [];
      const p0Hand = state?.core?.players?.['0']?.hand ?? [];
      const p1Discard = state?.core?.players?.['1']?.discard ?? [];
      const allBaseMinions = (state?.core?.bases ?? []).flatMap((base: any) => base?.minions ?? []);
      return state?.sys?.interaction?.current == null
        && state?.sys?.responseWindow?.current == null
        && state?.core?.bases?.[0]?.defId === 'base_faceless_city'
        && !hasUid(allBaseMinions, 'wormhole-raider')
        && !hasUid(p0Discard, 'wormhole-raider')
        && (hasUid(p0Deck, 'wormhole-raider') || hasUid(p0Hand, 'wormhole-raider'))
        && hasUid(p0Discard, 'wormhole-jumper')
        && hasUid(p1Discard, 'wormhole-enemy')
        && hasUid(p0Discard, 'wormhole-hand');
    }, {
      message: 'Portal Room 后续响应让过后，Wormhole 未选己方随从和敌方随从才应随计分清场进各自弃牌堆',
      timeout: 20000,
    }).toBe(true);

    await screenshotViewport(page, 'yuanhou-wormhole-selected-minion-shuffled-and-others-discarded', testInfo);
  });

  test('时间旅行者-Wormhole-真实计分后空选时应让所有随从按正常计分清场进入弃牌堆', async ({ page, game }, testInfo) => {
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
          nextUid: 1100,
          players: {
            '0': {
              id: '0',
              vp: 0,
              hand: [
                { uid: 'wormhole-empty-hand', defId: 'time_travelers_wormhole', type: 'action', owner: '0' },
              ],
              deck: [
                { uid: 'empty-draw-a', defId: 'time_travelers_jumper', type: 'minion', owner: '0' },
                { uid: 'empty-draw-b', defId: 'time_travelers_time_raider', type: 'minion', owner: '0' },
                { uid: 'empty-draw-c', defId: 'time_travelers_repeater_perfect', type: 'minion', owner: '0' },
              ],
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
              factions: ['cyborg_apes'],
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
              minions: [
                {
                  uid: 'wormhole-empty-jumper',
                  defId: 'time_travelers_jumper',
                  controller: '0',
                  owner: '0',
                  basePower: 10,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'wormhole-empty-raider',
                  defId: 'time_travelers_time_raider',
                  controller: '0',
                  owner: '0',
                  basePower: 14,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'wormhole-empty-enemy',
                  defId: 'cyborg_apes_cyberback',
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
              defId: 'base_secret_volcano_headquarters',
              breakpoint: 18,
              minions: [],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    await game.waitForPhase('playCards', 10000);
    await game.advancePhase();
    await game.waitForPhase('scoreBases', 10000);

    await surfaceWormholeReactionChoice(game, 'wormhole-empty-hand', 'Wormhole 空选分支');
    await expect(page.getByRole('button', { name: /虫洞/ })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /虫洞/ }).click({ force: true });

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'time_travelers_wormhole_choose'
        && prompt?.playerId === '0'
        && prompt?.data?.multi?.min === 0
        && prompt?.data?.multi?.max === 2
        && optionIds.includes('wormhole-empty-jumper')
        && optionIds.includes('wormhole-empty-raider')
        && !optionIds.includes('wormhole-empty-enemy');
    }, {
      message: 'Wormhole 空选分支也应先进入 0..N 多选 prompt，且只列己方随从',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-minion-uid="wormhole-empty-jumper"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="wormhole-empty-raider"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="wormhole-empty-enemy"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="wormhole-empty-jumper"]')).toHaveCount(0);
    await expect(page.locator('[data-option-id="wormhole-empty-enemy"]')).toHaveCount(0);
    await game.screenshot('yuanhou-wormhole-empty-select-prompt', testInfo);
    await page.getByRole('button', { name: /确认选择|确认(?:\(0\))?/ }).click();

    await screenshotViewport(page, 'yuanhou-wormhole-empty-select-response-continues', testInfo);
    await drainOpenReactionOrResponseWindows(game, 'Wormhole 空选后计分响应收口');

    await expect.poll(async () => {
      const state = await game.getState();
      const p0Discard = state?.core?.players?.['0']?.discard ?? [];
      const p0Deck = state?.core?.players?.['0']?.deck ?? [];
      const p0Hand = state?.core?.players?.['0']?.hand ?? [];
      const p1Discard = state?.core?.players?.['1']?.discard ?? [];
      const allBaseMinions = (state?.core?.bases ?? []).flatMap((base: any) => base?.minions ?? []);
      return state?.sys?.interaction?.current == null
        && state?.sys?.responseWindow?.current == null
        && state?.core?.bases?.[0]?.defId === 'base_faceless_city'
        && hasUid(p0Discard, 'wormhole-empty-hand')
        && hasUid(p0Discard, 'wormhole-empty-jumper')
        && hasUid(p0Discard, 'wormhole-empty-raider')
        && hasUid(p1Discard, 'wormhole-empty-enemy')
        && !hasUid(allBaseMinions, 'wormhole-empty-jumper')
        && !hasUid(allBaseMinions, 'wormhole-empty-raider')
        && !hasUid(allBaseMinions, 'wormhole-empty-enemy')
        && !hasUid(p0Deck, 'wormhole-empty-jumper')
        && !hasUid(p0Deck, 'wormhole-empty-raider')
        && !hasUid(p0Hand, 'wormhole-empty-jumper')
        && !hasUid(p0Hand, 'wormhole-empty-raider');
    }, {
      message: 'Wormhole 空选后，所有基地随从都应按正常计分清场进入各自弃牌堆',
      timeout: 20000,
    }).toBe(true);

    await screenshotViewport(page, 'yuanhou-wormhole-empty-select-all-minions-discarded', testInfo);
  });

  test('时间旅行者-Wormhole-真实计分后全选时应把所有己方随从都洗回各自拥有者牌库', async ({ page, game }, testInfo) => {
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
          nextUid: 1200,
          players: {
            '0': {
              id: '0',
              vp: 0,
              hand: [
                { uid: 'wormhole-all-hand', defId: 'time_travelers_wormhole', type: 'action', owner: '0' },
              ],
              deck: [
                { uid: 'all-draw-a', defId: 'time_travelers_jumper', type: 'minion', owner: '0' },
                { uid: 'all-draw-b', defId: 'time_travelers_time_raider', type: 'minion', owner: '0' },
                { uid: 'all-draw-c', defId: 'time_travelers_repeater_perfect', type: 'minion', owner: '0' },
                { uid: 'all-draw-d', defId: 'time_travelers_doctor_when', type: 'minion', owner: '0' },
              ],
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
              factions: ['cyborg_apes'],
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
              minions: [
                {
                  uid: 'wormhole-all-jumper',
                  defId: 'time_travelers_jumper',
                  controller: '0',
                  owner: '0',
                  basePower: 10,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'wormhole-all-raider',
                  defId: 'time_travelers_time_raider',
                  controller: '0',
                  owner: '0',
                  basePower: 14,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'wormhole-all-enemy',
                  defId: 'cyborg_apes_cyberback',
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
              defId: 'base_secret_volcano_headquarters',
              breakpoint: 18,
              minions: [],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    await game.waitForPhase('playCards', 10000);
    await game.advancePhase();
    await game.waitForPhase('scoreBases', 10000);

    await surfaceWormholeReactionChoice(game, 'wormhole-all-hand', 'Wormhole 全选分支');
    await expect(page.getByRole('button', { name: /虫洞/ })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /虫洞/ }).click({ force: true });

    await expect(page.locator('[data-minion-uid="wormhole-all-jumper"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="wormhole-all-raider"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="wormhole-all-jumper"]')).toHaveCount(0);
    await page.locator('[data-minion-uid="wormhole-all-jumper"]').click();
    await page.locator('[data-minion-uid="wormhole-all-raider"]').click();
    await game.screenshot('yuanhou-wormhole-all-select-prompt', testInfo);
    await page.getByRole('button', { name: /确认\(2\)|确认/ }).click();

    await screenshotViewport(page, 'yuanhou-wormhole-all-select-response-continues', testInfo);
    await drainOpenReactionOrResponseWindows(game, 'Wormhole 全选后计分响应收口');

    await expect.poll(async () => {
      const state = await game.getState();
      const p0Discard = state?.core?.players?.['0']?.discard ?? [];
      const p0Deck = state?.core?.players?.['0']?.deck ?? [];
      const p0Hand = state?.core?.players?.['0']?.hand ?? [];
      const p1Discard = state?.core?.players?.['1']?.discard ?? [];
      const allBaseMinions = (state?.core?.bases ?? []).flatMap((base: any) => base?.minions ?? []);
      return state?.sys?.interaction?.current == null
        && state?.sys?.responseWindow?.current == null
        && state?.core?.bases?.[0]?.defId === 'base_faceless_city'
        && hasUid(p0Discard, 'wormhole-all-hand')
        && hasUid(p1Discard, 'wormhole-all-enemy')
        && !hasUid(p0Discard, 'wormhole-all-jumper')
        && !hasUid(p0Discard, 'wormhole-all-raider')
        && !hasUid(allBaseMinions, 'wormhole-all-jumper')
        && !hasUid(allBaseMinions, 'wormhole-all-raider')
        && (hasUid(p0Deck, 'wormhole-all-jumper') || hasUid(p0Hand, 'wormhole-all-jumper'))
        && (hasUid(p0Deck, 'wormhole-all-raider') || hasUid(p0Hand, 'wormhole-all-raider'));
    }, {
      message: 'Wormhole 全选后，两只己方随从都应洗回 owner deck/hand，而敌方随从仍按正常计分清场进入弃牌堆',
      timeout: 20000,
    }).toBe(true);

    await screenshotViewport(page, 'yuanhou-wormhole-all-selected-minions-shuffled', testInfo);
  });

  test('时间旅行者-Wormhole-真实计分后应允许选择借来的己方控制随从并洗回拥有者牌库', async ({ page, game }, testInfo) => {
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
          nextUid: 1300,
          players: {
            '0': {
              id: '0',
              vp: 0,
              hand: [
                { uid: 'wormhole-borrowed-hand', defId: 'time_travelers_wormhole', type: 'action', owner: '0' },
              ],
              deck: [
                { uid: 'borrowed-draw-a', defId: 'time_travelers_jumper', type: 'minion', owner: '0' },
                { uid: 'borrowed-draw-b', defId: 'time_travelers_time_raider', type: 'minion', owner: '0' },
              ],
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
              deck: [
                { uid: 'p1-deck-a', defId: 'cyborg_apes_baboom', type: 'minion', owner: '1' },
              ],
              discard: [],
              factions: ['cyborg_apes'],
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
              minions: [
                {
                  uid: 'wormhole-owned-minion',
                  defId: 'time_travelers_time_raider',
                  controller: '0',
                  owner: '0',
                  basePower: 10,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'wormhole-borrowed-minion',
                  defId: 'sharks_mako',
                  controller: '0',
                  owner: '1',
                  basePower: 14,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'wormhole-borrowed-enemy',
                  defId: 'cyborg_apes_cyberback',
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
              defId: 'base_secret_volcano_headquarters',
              breakpoint: 18,
              minions: [],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    await game.waitForPhase('playCards', 10000);
    await game.advancePhase();
    await game.waitForPhase('scoreBases', 10000);

    await surfaceWormholeReactionChoice(game, 'wormhole-borrowed-hand', 'Wormhole 借来随从分支');
    await expect(page.getByRole('button', { name: /虫洞/ })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /虫洞/ }).click({ force: true });

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'time_travelers_wormhole_choose'
        && prompt?.playerId === '0'
        && optionIds.includes('wormhole-owned-minion')
        && optionIds.includes('wormhole-borrowed-minion')
        && !optionIds.includes('wormhole-borrowed-enemy');
    }, {
      message: 'Wormhole 应允许选择当前由 P0 控制但 owner=P1 的借来随从，同时仍排除敌方控制随从',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-minion-uid="wormhole-borrowed-minion"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="wormhole-owned-minion"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="wormhole-borrowed-minion"]')).toHaveCount(0);
    await game.screenshot('yuanhou-wormhole-borrowed-minion-choice-prompt', testInfo);
    await screenshotLocator(page.locator('[data-minion-uid="wormhole-borrowed-minion"]'), 'yuanhou-wormhole-borrowed-minion-option', testInfo);
    await page.locator('[data-minion-uid="wormhole-borrowed-minion"]').click();
    await page.getByRole('button', { name: /确认/ }).click();

    await drainOpenReactionOrResponseWindows(game, 'Wormhole 借来随从分支计分响应收口');

    await expect.poll(async () => {
      const state = await game.getState();
      const p0Deck = state?.core?.players?.['0']?.deck ?? [];
      const p0Hand = state?.core?.players?.['0']?.hand ?? [];
      const p0Discard = state?.core?.players?.['0']?.discard ?? [];
      const p1Deck = state?.core?.players?.['1']?.deck ?? [];
      const p1Hand = state?.core?.players?.['1']?.hand ?? [];
      const p1Discard = state?.core?.players?.['1']?.discard ?? [];
      const allBaseMinions = (state?.core?.bases ?? []).flatMap((base: any) => base?.minions ?? []);
      return state?.sys?.interaction?.current == null
        && state?.sys?.responseWindow?.current == null
        && state?.core?.bases?.[0]?.defId === 'base_faceless_city'
        && !hasUid(allBaseMinions, 'wormhole-borrowed-minion')
        && !hasUid(p0Deck, 'wormhole-borrowed-minion')
        && !hasUid(p0Hand, 'wormhole-borrowed-minion')
        && !hasUid(p0Discard, 'wormhole-borrowed-minion')
        && (hasUid(p1Deck, 'wormhole-borrowed-minion') || hasUid(p1Hand, 'wormhole-borrowed-minion'))
        && hasUid(p0Discard, 'wormhole-owned-minion')
        && hasUid(p1Discard, 'wormhole-borrowed-enemy')
        && hasUid(p0Discard, 'wormhole-borrowed-hand');
    }, {
      message: 'Wormhole 选中借来随从后，应把它洗回 owner=P1 牌库/手牌，而未选己方自有随从仍进 P0 discard',
      timeout: 20000,
    }).toBe(true);

    await screenshotViewport(page, 'yuanhou-wormhole-borrowed-minion-shuffled-to-owner', testInfo);
  });

  test('时间旅行者-Repeater Perfect-真实入口可从混合弃牌堆选择非第一张行动放到牌库顶', async ({ page, game }, testInfo) => {
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
              hand: [{ uid: 'repeater-hand', defId: 'time_travelers_repeater_perfect', type: 'minion', owner: '0' }],
              deck: [{ uid: 'repeater-deck-a', defId: 'time_travelers_jumper', type: 'minion', owner: '0' }],
              discard: [
                { uid: 'repeater-discard-minion', defId: 'sharks_hammerhead', type: 'minion', owner: '0' },
                { uid: 'repeater-discard-action-a', defId: 'super_spies_from_q_with_love', type: 'action', owner: '0' },
                { uid: 'repeater-discard-action-b', defId: 'time_travelers_time_walk', type: 'action', owner: '0' },
              ],
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
              factions: ['cyborg_apes'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [{
            defId: 'base_portal_room',
            breakpoint: 20,
            minions: [],
            ongoingActions: [],
          }],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="repeater-hand"]').click();
    await page.getByTestId('base-zone-0').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      const allowedCardUids = prompt?.data?.allowedCardUids ?? [];
      return prompt?.data?.sourceId === 'time_travelers_repeater_perfect_choose'
        && prompt?.playerId === '0'
        && optionIds.includes('repeater-discard-action-a')
        && optionIds.includes('repeater-discard-action-b')
        && !optionIds.includes('repeater-discard-minion')
        && allowedCardUids.includes('repeater-discard-action-a')
        && allowedCardUids.includes('repeater-discard-action-b')
        && !allowedCardUids.includes('repeater-discard-minion');
    }, {
      message: 'Repeater Perfect 打出后应只从真实 UI 提供弃牌堆行动候选，不能把弃牌随从列进选择面',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByTestId('su-discard-toggle')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-discard-view-panel]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-discard-view-panel] [data-card-uid="repeater-discard-action-a"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-discard-view-panel] [data-card-uid="repeater-discard-action-b"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="repeater-discard-action-a"]')).toHaveCount(0);
    await expect(page.locator('[data-option-id="repeater-discard-action-b"]')).toHaveCount(0);
    await game.screenshot('yuanhou-repeater-perfect-discard-action-panel', testInfo);
    await screenshotLocator(page.locator('[data-discard-view-panel] [data-card-uid="repeater-discard-action-b"]'), 'yuanhou-repeater-perfect-second-action-card', testInfo);

    await page.locator('[data-discard-view-panel] [data-card-uid="repeater-discard-action-b"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const deck = state?.core?.players?.['0']?.deck ?? [];
      const discard = state?.core?.players?.['0']?.discard ?? [];
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      return state?.sys?.interaction?.current == null
        && hasUid(minions, 'repeater-hand')
        && deck.map((card: any) => card?.uid).join(',') === 'repeater-discard-action-b,repeater-deck-a'
        && hasUid(discard, 'repeater-discard-minion')
        && hasUid(discard, 'repeater-discard-action-a')
        && !hasUid(discard, 'repeater-discard-action-b');
    }, {
      message: 'Repeater Perfect 选择第二张行动后应把该行动放到自己牌库顶，其余弃牌保留并收口',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-discard-view-panel]')).toBeHidden({ timeout: 15000 });
    await game.screenshot('yuanhou-repeater-perfect-selected-action-topped', testInfo);
  });

  test('时间旅行者-Repeater Perfect-候选很多时仍应走弃牌堆底部面板而不是带搜索的中央弹窗', async ({ page, game }, testInfo) => {
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
              hand: [{ uid: 'repeater-many-hand', defId: 'time_travelers_repeater_perfect', type: 'minion', owner: '0' }],
              deck: [{ uid: 'repeater-many-deck-a', defId: 'time_travelers_jumper', type: 'minion', owner: '0' }],
              discard: [
                { uid: 'repeater-many-discard-action-a', defId: 'time_travelers_time_walk', type: 'action', owner: '0' },
                { uid: 'repeater-many-discard-action-b', defId: 'super_spies_from_q_with_love', type: 'action', owner: '0' },
                { uid: 'repeater-many-discard-action-c', defId: 'cyborg_apes_juiced_up', type: 'action', owner: '0' },
                { uid: 'repeater-many-discard-action-d', defId: 'cyborg_apes_cyberevolution', type: 'action', owner: '0' },
                { uid: 'repeater-many-discard-action-e', defId: 'super_spies_for_my_eyes_only', type: 'action', owner: '0' },
                { uid: 'repeater-many-discard-action-f', defId: 'time_travelers_1_21_gigawatts', type: 'action', owner: '0' },
                { uid: 'repeater-many-discard-action-g', defId: 'time_travelers_time_walk', type: 'action', owner: '0' },
                { uid: 'repeater-many-discard-action-h', defId: 'super_spies_from_q_with_love', type: 'action', owner: '0' },
                { uid: 'repeater-many-discard-action-i', defId: 'cyborg_apes_juiced_up', type: 'action', owner: '0' },
                { uid: 'repeater-many-discard-action-j', defId: 'cyborg_apes_cyberevolution', type: 'action', owner: '0' },
              ],
              factions: ['time_travelers', 'super_spies', 'cyborg_apes'],
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
              factions: ['cyborg_apes'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [{
            defId: 'base_portal_room',
            breakpoint: 20,
            minions: [],
            ongoingActions: [],
          }],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="repeater-many-hand"]').click();
    await page.getByTestId('base-zone-0').click();

    const discardPanelCards = page.locator('[data-discard-view-panel] [data-card-uid^="repeater-many-discard-action-"]');
    await expect(page.locator('[data-discard-view-panel]')).toBeVisible({ timeout: 15000 });
    await expect(discardPanelCards).toHaveCount(10);
    await expect(page.getByTestId('prompt-card-search-input')).toHaveCount(0);
    await expect(page.locator('[data-testid="prompt-card-banner"]')).toHaveCount(0);
    await game.screenshot('yuanhou-repeater-perfect-many-actions-discard-panel', testInfo);

    await page.locator('[data-discard-view-panel] [data-card-uid="repeater-many-discard-action-j"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const deck = state?.core?.players?.['0']?.deck ?? [];
      const discard = state?.core?.players?.['0']?.discard ?? [];
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      return state?.sys?.interaction?.current == null
        && hasUid(minions, 'repeater-many-hand')
        && deck.map((card: any) => card?.uid).join(',') === 'repeater-many-discard-action-j,repeater-many-deck-a'
        && !hasUid(discard, 'repeater-many-discard-action-j');
    }, {
      message: 'Repeater Perfect 候选很多时，仍应通过弃牌堆底部面板选中较靠后的行动并正常收口',
      timeout: 15000,
    }).toBe(true);
  });

  test('时间旅行者-Repeater Perfect-弃牌堆只剩一张行动时真实入口应自动放到牌库顶且不弹 prompt', async ({ page, game }, testInfo) => {
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
              hand: [{ uid: 'repeater-single-hand', defId: 'time_travelers_repeater_perfect', type: 'minion', owner: '0' }],
              deck: [{ uid: 'repeater-single-deck-a', defId: 'time_travelers_jumper', type: 'minion', owner: '0' }],
              discard: [
                { uid: 'repeater-single-discard-minion', defId: 'sharks_hammerhead', type: 'minion', owner: '0' },
                { uid: 'repeater-single-discard-action', defId: 'time_travelers_time_walk', type: 'action', owner: '0' },
              ],
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
              factions: ['cyborg_apes'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [{
            defId: 'base_portal_room',
            breakpoint: 20,
            minions: [],
            ongoingActions: [],
          }],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    await game.screenshot('yuanhou-repeater-perfect-single-action-before-play', testInfo);
    await page.locator('[data-card-uid="repeater-single-hand"]').click();
    await page.getByTestId('base-zone-0').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const deck = state?.core?.players?.['0']?.deck ?? [];
      const discard = state?.core?.players?.['0']?.discard ?? [];
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      return state?.sys?.interaction?.current == null
        && hasUid(minions, 'repeater-single-hand')
        && deck.map((card: any) => card?.uid).join(',') === 'repeater-single-discard-action,repeater-single-deck-a'
        && hasUid(discard, 'repeater-single-discard-minion')
        && !hasUid(discard, 'repeater-single-discard-action');
    }, {
      message: 'Repeater Perfect 弃牌堆只剩一张行动时，应自动把该行动放到牌库顶且不创建选择 prompt',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-option-id="repeater-single-discard-action"]')).toHaveCount(0);
    await game.screenshot('yuanhou-repeater-perfect-single-action-auto-topped', testInfo);
  });

  test('时间旅行者-Repeater Perfect-弃牌堆为空时真实入口应提示无可选行动且不弹 prompt', async ({ page, game }, testInfo) => {
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
              hand: [{ uid: 'repeater-empty-hand', defId: 'time_travelers_repeater_perfect', type: 'minion', owner: '0' }],
              deck: [{ uid: 'repeater-empty-deck-a', defId: 'time_travelers_jumper', type: 'minion', owner: '0' }],
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
              factions: ['cyborg_apes'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [{
            defId: 'base_portal_room',
            breakpoint: 20,
            minions: [],
            ongoingActions: [],
          }],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    await game.screenshot('yuanhou-repeater-perfect-empty-discard-before-play', testInfo);
    await page.locator('[data-card-uid="repeater-empty-hand"]').click();
    await page.getByTestId('base-zone-0').click();

    const discardEmptyToast = page.locator('[role="alert"], [aria-live="polite"]', {
      hasText: '弃牌堆中没有符合条件的卡牌',
    }).first();
    await expect(discardEmptyToast).toBeVisible({ timeout: 5000 });
    await game.screenshot('yuanhou-repeater-perfect-empty-discard-feedback-toast', testInfo);
    await screenshotLocator(discardEmptyToast, 'yuanhou-repeater-perfect-empty-discard-feedback-toast-locator', testInfo);

    await expect.poll(async () => {
      const state = await game.getState();
      const deck = state?.core?.players?.['0']?.deck ?? [];
      const discard = state?.core?.players?.['0']?.discard ?? [];
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      return state?.sys?.interaction?.current == null
        && hasUid(minions, 'repeater-empty-hand')
        && deck.map((card: any) => card?.uid).join(',') === 'repeater-empty-deck-a'
        && discard.length === 0;
    }, {
      message: 'Repeater Perfect 弃牌堆为空时，应只给出 discard_empty 反馈，不创建选择 prompt，也不改动牌库/弃牌堆',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-option-id^="repeater-empty-"]')).toHaveCount(0);
    await game.screenshot('yuanhou-repeater-perfect-empty-discard-feedback-without-prompt', testInfo);
  });

  test('时间旅行者-Time Walk-真实入口会抽两张、把本牌沉到底并授予本回合额外随从与额外行动额度', async ({ page, game }, testInfo) => {
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
                { uid: 'walk-a', defId: 'time_travelers_time_walk', type: 'action', owner: '0' },
                { uid: 'walk-extra-minion', defId: 'time_travelers_jumper', type: 'minion', owner: '0' },
                { uid: 'walk-extra-action', defId: 'cyborg_apes_juiced_up', type: 'action', owner: '0' },
              ],
              deck: [
                { uid: 'walk-draw-a', defId: 'time_travelers_time_raider', type: 'minion', owner: '0' },
                { uid: 'walk-draw-b', defId: 'time_travelers_doctor_when', type: 'minion', owner: '0' },
                { uid: 'walk-deck-c', defId: 'time_travelers_1_21_gigawatts', type: 'action', owner: '0' },
              ],
              discard: [],
              factions: ['time_travelers', 'cyborg_apes'],
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
              factions: ['shapeshifters'],
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
              uid: 'walk-host',
              defId: 'cyborg_apes_cyberback',
              controller: '0',
              owner: '0',
              basePower: 5,
              powerCounters: 0,
              powerModifier: 0,
              tempPowerModifier: 0,
              talentUsed: false,
              playedThisTurn: false,
              attachedActions: [],
            }],
            ongoingActions: [],
          }],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="walk-a"]').click();
    await page.locator('[data-card-uid="walk-a"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state?.core?.players?.['0'];
      const deck = player?.deck ?? [];
      return state?.sys?.interaction?.current == null
        && player?.minionLimit === 2
        && player?.actionLimit === 2
        && player?.actionsPlayed === 1
        && player?.minionsPlayed === 1
        && hasUid(player?.hand, 'walk-draw-a')
        && hasUid(player?.hand, 'walk-draw-b')
        && !hasUid(player?.discard, 'walk-a')
        && deck.map((card: any) => card?.uid).join(',') === 'walk-deck-c,walk-a';
    }, {
      message: 'Time Walk 打出后应真实抽两张、不给 immediate prompt，并把本牌放到自己牌库底同时授予本回合额外随从与额外行动额度',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-time-walk-draw-two-and-bank-extra-quotas', testInfo);
    await dismissSmashUpSpotlightQueueIfVisible(page);

    await page.locator('[data-card-uid="walk-extra-minion"]').click();
    await page.getByTestId('base-zone-0').click({ force: true });

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state?.core?.players?.['0'];
      return hasUid(state?.core?.bases?.[0]?.minions, 'walk-extra-minion')
        && !hasUid(player?.hand, 'walk-extra-minion')
        && player?.minionsPlayed === 2
        && player?.minionLimit === 2;
    }, {
      message: 'Time Walk 授予的 banked extra minion 应允许在正常随从额度已用尽时把 Jumper 真实打到基地上',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-time-walk-extra-minion-played', testInfo);
    await dismissSmashUpSpotlightQueueIfVisible(page);

    await page.locator('[data-card-uid="walk-extra-action"]').click();
    await page.locator('[data-minion-uid="walk-extra-minion"]').click({ force: true });

    await expect.poll(async () => {
      const state = await game.getState();
      const player = state?.core?.players?.['0'];
      const deck = player?.deck ?? [];
      const playedMinion = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion?.uid === 'walk-extra-minion');
      return state?.sys?.interaction?.current == null
        && !hasUid(player?.hand, 'walk-extra-action')
        && player?.actionsPlayed === 2
        && player?.actionLimit === 2
        && deck.map((card: any) => card?.uid).join(',') === 'walk-deck-c,walk-a'
        && (playedMinion?.attachedActions ?? []).some((action: any) => action?.uid === 'walk-extra-action');
    }, {
      message: 'Time Walk 授予的 banked extra action 应允许在正常行动额度已用尽后，把 Juiced Up 真实打到刚打出的额外随从上',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-time-walk-extra-action-played-and-card-bottomed', testInfo);
  });

  test('时间旅行者-Stasis Field-真实入口可贴到基地、阻止本该发生的计分，并在拥有者回合开始自动离场', async ({ page, game }, testInfo) => {
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
                { uid: 'stasis-hand', defId: 'time_travelers_stasis_field', type: 'action', owner: '0' },
              ],
              deck: [
                { uid: 'stasis-p0-draw-a', defId: 'time_travelers_time_raider', type: 'minion', owner: '0' },
                { uid: 'stasis-p0-draw-b', defId: 'time_travelers_time_walk', type: 'action', owner: '0' },
              ],
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
              deck: [
                { uid: 'stasis-p1-draw-a', defId: 'cyborg_apes_furious_george', type: 'minion', owner: '1' },
                { uid: 'stasis-p1-draw-b', defId: 'cyborg_apes_juiced_up', type: 'action', owner: '1' },
              ],
              discard: [],
              factions: ['cyborg_apes'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [{
            defId: 'base_portal_room',
            breakpoint: 20,
            minions: [
              {
                uid: 'stasis-power-a',
                defId: 'sharks_megalodon',
                controller: '0',
                owner: '0',
                basePower: 10,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [],
              },
              {
                uid: 'stasis-power-b',
                defId: 'sharks_megalodon',
                controller: '0',
                owner: '0',
                basePower: 10,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [],
              },
              {
                uid: 'stasis-power-c',
                defId: 'cyborg_apes_cyberback',
                controller: '1',
                owner: '1',
                basePower: 5,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [],
              },
            ],
            ongoingActions: [],
          }],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="stasis-hand"]').click();
    await page.getByTestId('base-zone-0').click({ force: true });

    await expect.poll(async () => {
      const state = await game.getState();
      const base = state?.core?.bases?.[0];
      const player = state?.core?.players?.['0'];
      return state?.sys?.interaction?.current == null
        && hasUid(base?.ongoingActions, 'stasis-hand')
        && !hasUid(player?.hand, 'stasis-hand')
        && player?.actionsPlayed === 1
        && base?.defId === 'base_portal_room';
    }, {
      message: 'Stasis Field 从真实手牌入口打出后，应附着到目标基地并离开手牌',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-stasis-field-attached-to-base', testInfo);
    await dismissSmashUpSpotlightQueueIfVisible(page);

    await page.getByTestId('su-end-turn-action-button').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const base = state?.core?.bases?.[0];
      return state?.core?.currentPlayerIndex === 1
        && state?.sys?.phase === 'playCards'
        && base?.defId === 'base_portal_room'
        && hasUid(base?.ongoingActions, 'stasis-hand')
        && state?.core?.players?.['0']?.vp === 0
        && state?.core?.players?.['1']?.vp === 0
        && (state?.core?.baseDiscard ?? []).length === 0;
    }, {
      message: 'Portal Room 在被 Stasis Field 压制时，即使已达断点，也不应在 P0 结束回合后进入计分/换基地',
      timeout: 20000,
    }).toBe(true);

    await game.screenshot('yuanhou-stasis-field-prevented-base-scoring', testInfo);

    await page.getByTestId('su-end-turn-action-button').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const base = state?.core?.bases?.[0];
      const discard = state?.core?.players?.['0']?.discard ?? [];
      return state?.core?.currentPlayerIndex === 0
        && state?.sys?.phase === 'playCards'
        && base?.defId === 'base_portal_room'
        && !hasUid(base?.ongoingActions, 'stasis-hand')
        && hasUid(discard, 'stasis-hand')
        && state?.core?.players?.['0']?.vp === 0
        && state?.core?.players?.['1']?.vp === 0;
    }, {
      message: '来到拥有者 P0 的回合开始时，Stasis Field 应自动离场进弃牌堆，而不是继续悬挂在基地上',
      timeout: 20000,
    }).toBe(true);

    await game.screenshot('yuanhou-stasis-field-destroyed-at-owner-turn-start', testInfo);
  });

  test('时间旅行者-Time Raider-真实天赋可选择弃牌堆任意牌放到牌库底', async ({ page, game }, testInfo) => {
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
              hand: [],
              deck: [{ uid: 'raider-deck-a', defId: 'time_travelers_jumper', type: 'minion', owner: '0' }],
              discard: [
                { uid: 'raider-discard-minion', defId: 'time_travelers_doctor_when', type: 'minion', owner: '0' },
                { uid: 'raider-discard-action', defId: 'time_travelers_time_walk', type: 'action', owner: '0' },
              ],
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
              factions: ['cyborg_apes'],
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
                uid: 'time-raider-source',
                defId: 'time_travelers_time_raider',
                controller: '0',
                owner: '0',
                basePower: 3,
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

    await page.locator('[data-minion-uid="time-raider-source"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'time_travelers_time_raider_choose'
        && prompt?.playerId === '0'
        && optionIds.includes('raider-discard-minion')
        && optionIds.includes('raider-discard-action');
    }, {
      message: 'Time Raider 天赋应从真实 UI 进入弃牌堆任意牌选择 prompt',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByTestId('su-discard-toggle')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-discard-view-panel]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-discard-view-panel] [data-card-uid="raider-discard-minion"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-discard-view-panel] [data-card-uid="raider-discard-action"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="raider-discard-minion"]')).toHaveCount(0);
    await expect(page.locator('[data-option-id="raider-discard-action"]')).toHaveCount(0);
    await game.screenshot('yuanhou-time-raider-discard-panel', testInfo);
    await screenshotLocator(page.locator('[data-discard-view-panel] [data-card-uid="raider-discard-minion"]'), 'yuanhou-time-raider-discard-minion-card', testInfo);
    await screenshotLocator(page.locator('[data-discard-view-panel] [data-card-uid="raider-discard-action"]'), 'yuanhou-time-raider-discard-action-card', testInfo);

    await page.locator('[data-discard-view-panel] [data-card-uid="raider-discard-action"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const deck = state?.core?.players?.['0']?.deck ?? [];
      const discard = state?.core?.players?.['0']?.discard ?? [];
      const raider = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion?.uid === 'time-raider-source');
      return state?.sys?.interaction?.current == null
        && deck.map((card: any) => card?.uid).join(',') === 'raider-deck-a,raider-discard-action'
        && hasUid(discard, 'raider-discard-minion')
        && !hasUid(discard, 'raider-discard-action')
        && raider?.talentUsed === true;
    }, {
      message: 'Time Raider 选择的弃牌应进入自己牌库底，未选弃牌保留，天赋标记已消耗',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-discard-view-panel]')).toBeHidden({ timeout: 15000 });
    await game.screenshot('yuanhou-time-raider-selected-card-bottomed', testInfo);
  });

  test('时间旅行者-Time Raider-候选很多时仍应走弃牌堆底部面板而不是带搜索的中央弹窗', async ({ page, game }, testInfo) => {
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
              hand: [],
              deck: [{ uid: 'raider-many-deck-a', defId: 'time_travelers_jumper', type: 'minion', owner: '0' }],
              discard: [
                { uid: 'raider-many-discard-a', defId: 'time_travelers_time_walk', type: 'action', owner: '0' },
                { uid: 'raider-many-discard-b', defId: 'time_travelers_doctor_when', type: 'minion', owner: '0' },
                { uid: 'raider-many-discard-c', defId: 'super_spies_from_q_with_love', type: 'action', owner: '0' },
                { uid: 'raider-many-discard-d', defId: 'cyborg_apes_cyberback', type: 'minion', owner: '0' },
                { uid: 'raider-many-discard-e', defId: 'cyborg_apes_juiced_up', type: 'action', owner: '0' },
                { uid: 'raider-many-discard-f', defId: 'time_travelers_jumper', type: 'minion', owner: '0' },
                { uid: 'raider-many-discard-g', defId: 'cyborg_apes_cyberevolution', type: 'action', owner: '0' },
                { uid: 'raider-many-discard-h', defId: 'time_travelers_1_21_gigawatts', type: 'action', owner: '0' },
                { uid: 'raider-many-discard-i', defId: 'time_travelers_repeater_perfect', type: 'minion', owner: '0' },
                { uid: 'raider-many-discard-j', defId: 'super_spies_for_my_eyes_only', type: 'action', owner: '0' },
              ],
              factions: ['time_travelers', 'super_spies', 'cyborg_apes'],
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
              factions: ['cyborg_apes'],
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
                uid: 'time-raider-many-source',
                defId: 'time_travelers_time_raider',
                controller: '0',
                owner: '0',
                basePower: 3,
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

    await page.locator('[data-minion-uid="time-raider-many-source"]').click();

    const discardPanelCards = page.locator('[data-discard-view-panel] [data-card-uid^="raider-many-discard-"]');
    await expect(page.locator('[data-discard-view-panel]')).toBeVisible({ timeout: 15000 });
    await expect(discardPanelCards).toHaveCount(10);
    await expect(page.getByTestId('prompt-card-search-input')).toHaveCount(0);
    await expect(page.locator('[data-testid="prompt-card-banner"]')).toHaveCount(0);
    await game.screenshot('yuanhou-time-raider-many-cards-discard-panel', testInfo);

    await page.locator('[data-discard-view-panel] [data-card-uid="raider-many-discard-j"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const deck = state?.core?.players?.['0']?.deck ?? [];
      const discard = state?.core?.players?.['0']?.discard ?? [];
      const raider = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion?.uid === 'time-raider-many-source');
      return state?.sys?.interaction?.current == null
        && deck.map((card: any) => card?.uid).join(',') === 'raider-many-deck-a,raider-many-discard-j'
        && !hasUid(discard, 'raider-many-discard-j')
        && raider?.talentUsed === true;
    }, {
      message: 'Time Raider 候选很多时，仍应通过弃牌堆底部面板选中较靠后的牌并正常收口',
      timeout: 15000,
    }).toBe(true);
  });

  test('时间旅行者-Time Raider-弃牌堆只剩一张牌时真实入口应自动放到牌库底且不弹 prompt', async ({ page, game }, testInfo) => {
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
              hand: [],
              deck: [{ uid: 'raider-single-deck-a', defId: 'time_travelers_jumper', type: 'minion', owner: '0' }],
              discard: [
                { uid: 'raider-single-discard-card', defId: 'time_travelers_time_walk', type: 'action', owner: '0' },
              ],
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
              factions: ['cyborg_apes'],
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
                uid: 'time-raider-single-source',
                defId: 'time_travelers_time_raider',
                controller: '0',
                owner: '0',
                basePower: 3,
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

    await game.screenshot('yuanhou-time-raider-single-card-before-talent', testInfo);
    await page.locator('[data-minion-uid="time-raider-single-source"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const deck = state?.core?.players?.['0']?.deck ?? [];
      const discard = state?.core?.players?.['0']?.discard ?? [];
      const raider = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion?.uid === 'time-raider-single-source');
      return state?.sys?.interaction?.current == null
        && deck.map((card: any) => card?.uid).join(',') === 'raider-single-deck-a,raider-single-discard-card'
        && discard.length === 0
        && raider?.talentUsed === true;
    }, {
      message: 'Time Raider 弃牌堆只剩一张牌时，应自动把该牌放到牌库底且不创建选择 prompt',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-option-id="raider-single-discard-card"]')).toHaveCount(0);
    await game.screenshot('yuanhou-time-raider-single-card-auto-bottomed', testInfo);
  });

  test('时间旅行者-Time Raider-弃牌堆为空时真实入口应提示无可选牌且不弹 prompt', async ({ page, game }, testInfo) => {
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
              hand: [],
              deck: [{ uid: 'raider-empty-deck-a', defId: 'time_travelers_jumper', type: 'minion', owner: '0' }],
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
              factions: ['cyborg_apes'],
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
                uid: 'time-raider-empty-source',
                defId: 'time_travelers_time_raider',
                controller: '0',
                owner: '0',
                basePower: 3,
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

    await game.screenshot('yuanhou-time-raider-empty-discard-before-talent', testInfo);
    await page.locator('[data-minion-uid="time-raider-empty-source"]').click();

    const discardEmptyToast = page.locator('[role="alert"], [aria-live="polite"]', {
      hasText: '弃牌堆中没有符合条件的卡牌',
    }).first();
    await expect(discardEmptyToast).toBeVisible({ timeout: 5000 });
    await game.screenshot('yuanhou-time-raider-empty-discard-feedback-toast', testInfo);
    await screenshotLocator(discardEmptyToast, 'yuanhou-time-raider-empty-discard-feedback-toast-locator', testInfo);

    await expect.poll(async () => {
      const state = await game.getState();
      const deck = state?.core?.players?.['0']?.deck ?? [];
      const discard = state?.core?.players?.['0']?.discard ?? [];
      const raider = state?.core?.bases?.[0]?.minions?.find((minion: any) => minion?.uid === 'time-raider-empty-source');
      return state?.sys?.interaction?.current == null
        && deck.map((card: any) => card?.uid).join(',') === 'raider-empty-deck-a'
        && discard.length === 0
        && raider?.talentUsed === true;
    }, {
      message: 'Time Raider 弃牌堆为空时，应只给出 discard_empty 反馈，不创建选择 prompt，也不改动牌库/弃牌堆',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-option-id^="raider-empty-"]')).toHaveCount(0);
    await game.screenshot('yuanhou-time-raider-empty-discard-feedback-without-prompt', testInfo);
  });

  test('时间旅行者-1.21-Gigawatts-真实入口可选择行动或仆从并将该类弃牌洗入牌库', async ({ page, game }, testInfo) => {
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
              hand: [{ uid: 'gigawatts-hand', defId: 'time_travelers_1_21_gigawatts', type: 'action', owner: '0' }],
              deck: [
                { uid: 'gigawatts-deck-a', defId: 'time_travelers_jumper', type: 'minion', owner: '0' },
                { uid: 'gigawatts-deck-b', defId: 'time_travelers_time_raider', type: 'minion', owner: '0' },
              ],
              discard: [
                { uid: 'gigawatts-discard-action', defId: 'time_travelers_time_walk', type: 'action', owner: '0' },
                { uid: 'gigawatts-discard-minion-a', defId: 'time_travelers_jumper', type: 'minion', owner: '0' },
                { uid: 'gigawatts-discard-minion-b', defId: 'time_travelers_doctor_when', type: 'minion', owner: '0' },
              ],
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
              factions: ['cyborg_apes'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [{
            defId: 'base_portal_room',
            breakpoint: 20,
            minions: [],
            ongoingActions: [],
          }],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="gigawatts-hand"]').click();
    await page.locator('[data-card-uid="gigawatts-hand"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'time_travelers_1_21_gigawatts_choose'
        && prompt?.playerId === '0'
        && optionIds.includes('actions')
        && optionIds.includes('minions')
        && (prompt?.data?.allowedCardTypes ?? []).includes('action')
        && (prompt?.data?.allowedCardTypes ?? []).includes('minion');
    }, {
      message: '1.21 Gigawatts 应在行动/仆从均存在时从真实 UI 进入牌种选择 prompt',
      timeout: 15000,
    }).toBe(true);

    const actionButton = page.getByRole('button', { name: '行动' });
    const minionButton = page.getByRole('button', { name: '仆从' });
    await expect(actionButton).toBeVisible({ timeout: 15000 });
    await expect(minionButton).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-gigawatts-card-type-choice-prompt', testInfo);
    await screenshotLocator(actionButton, 'yuanhou-gigawatts-actions-option', testInfo);
    await screenshotLocator(minionButton, 'yuanhou-gigawatts-minions-option', testInfo);

    await minionButton.click();

    await expect.poll(async () => {
      const state = await game.getState();
      const deck = state?.core?.players?.['0']?.deck ?? [];
      const discard = state?.core?.players?.['0']?.discard ?? [];
      return state?.sys?.interaction?.current == null
        && hasUid(deck, 'gigawatts-deck-a')
        && hasUid(deck, 'gigawatts-deck-b')
        && hasUid(deck, 'gigawatts-discard-minion-a')
        && hasUid(deck, 'gigawatts-discard-minion-b')
        && hasUid(discard, 'gigawatts-discard-action')
        && hasUid(discard, 'gigawatts-hand')
        && !hasUid(discard, 'gigawatts-discard-minion-a')
        && !hasUid(discard, 'gigawatts-discard-minion-b');
    }, {
      message: '1.21 Gigawatts 选择仆从后应把所有弃牌堆仆从洗入整副牌库，保留行动弃牌和本行动',
      timeout: 15000,
    }).toBe(true);

    await expect(minionButton).toBeHidden({ timeout: 15000 });
    await game.screenshot('yuanhou-gigawatts-selected-minions-shuffled-into-deck', testInfo);
  });

  test('时间旅行者-1.21-Gigawatts-弃牌堆只剩单一牌种时真实入口应自动洗回牌库且不弹按钮 prompt', async ({ page, game }, testInfo) => {
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
              hand: [{ uid: 'gigawatts-single-hand', defId: 'time_travelers_1_21_gigawatts', type: 'action', owner: '0' }],
              deck: [
                { uid: 'gigawatts-single-deck-a', defId: 'time_travelers_jumper', type: 'minion', owner: '0' },
                { uid: 'gigawatts-single-deck-b', defId: 'time_travelers_time_raider', type: 'minion', owner: '0' },
              ],
              discard: [
                { uid: 'gigawatts-single-action-a', defId: 'time_travelers_time_walk', type: 'action', owner: '0' },
                { uid: 'gigawatts-single-action-b', defId: 'super_spies_from_q_with_love', type: 'action', owner: '0' },
              ],
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
              factions: ['cyborg_apes'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [{
            defId: 'base_portal_room',
            breakpoint: 20,
            minions: [],
            ongoingActions: [],
          }],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    await game.screenshot('yuanhou-gigawatts-single-type-before-play', testInfo);
    await page.locator('[data-card-uid="gigawatts-single-hand"]').click();
    await page.locator('[data-card-uid="gigawatts-single-hand"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const deck = state?.core?.players?.['0']?.deck ?? [];
      const discard = state?.core?.players?.['0']?.discard ?? [];
      return state?.sys?.interaction?.current == null
        && hasUid(deck, 'gigawatts-single-deck-a')
        && hasUid(deck, 'gigawatts-single-deck-b')
        && hasUid(deck, 'gigawatts-single-action-a')
        && hasUid(deck, 'gigawatts-single-action-b')
        && hasUid(discard, 'gigawatts-single-hand')
        && !hasUid(discard, 'gigawatts-single-action-a')
        && !hasUid(discard, 'gigawatts-single-action-b');
    }, {
      message: '1.21 Gigawatts 弃牌堆只剩单一牌种时，应自动把该牌种整批洗回牌库且不创建牌种按钮 prompt',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '行动' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '仆从' })).toHaveCount(0);
    await game.screenshot('yuanhou-gigawatts-single-type-auto-shuffled', testInfo);
  });

  test('时间旅行者-1.21-Gigawatts-弃牌堆为空时真实入口应提示无可选牌种且不弹按钮 prompt', async ({ page, game }, testInfo) => {
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
              hand: [{ uid: 'gigawatts-empty-hand', defId: 'time_travelers_1_21_gigawatts', type: 'action', owner: '0' }],
              deck: [
                { uid: 'gigawatts-empty-deck-a', defId: 'time_travelers_jumper', type: 'minion', owner: '0' },
                { uid: 'gigawatts-empty-deck-b', defId: 'time_travelers_time_raider', type: 'minion', owner: '0' },
              ],
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
              factions: ['cyborg_apes'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [{
            defId: 'base_portal_room',
            breakpoint: 20,
            minions: [],
            ongoingActions: [],
          }],
          baseDeck: ['base_faceless_city'],
          baseDiscard: [],
        },
      },
    });

    await game.screenshot('yuanhou-gigawatts-empty-discard-before-play', testInfo);
    await page.locator('[data-card-uid="gigawatts-empty-hand"]').click();
    await page.locator('[data-card-uid="gigawatts-empty-hand"]').click();

    const discardEmptyToast = page.locator('[role="alert"], [aria-live="polite"]', {
      hasText: '弃牌堆中没有符合条件的卡牌',
    }).first();
    await expect(discardEmptyToast).toBeVisible({ timeout: 5000 });
    await game.screenshot('yuanhou-gigawatts-empty-discard-feedback-toast', testInfo);
    await screenshotLocator(discardEmptyToast, 'yuanhou-gigawatts-empty-discard-feedback-toast-locator', testInfo);

    await expect.poll(async () => {
      const state = await game.getState();
      const deck = state?.core?.players?.['0']?.deck ?? [];
      const discard = state?.core?.players?.['0']?.discard ?? [];
      return state?.sys?.interaction?.current == null
        && deck.map((card: any) => card?.uid).join(',') === 'gigawatts-empty-deck-a,gigawatts-empty-deck-b'
        && discard.map((card: any) => card?.uid).join(',') === 'gigawatts-empty-hand';
    }, {
      message: '1.21 Gigawatts 弃牌堆为空时，应只给出 discard_empty 反馈，不创建牌种按钮 prompt，且仅本行动自己正常进入弃牌堆',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '行动' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '仆从' })).toHaveCount(0);
    await game.screenshot('yuanhou-gigawatts-empty-discard-feedback-without-prompt', testInfo);
  });

  test('时间旅行者-Portal Room-真实计分后赢家接受额外回合并在结束后恢复到原顺位玩家', async ({ page, game }, testInfo) => {
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
              factions: ['super_spies'],
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
                uid: 'portal-winner-minion',
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

    await game.waitForPhase('playCards', 10000);
    await game.advancePhase();
    await game.waitForPhase('scoreBases', 10000);

    await expect(page.getByRole('button', { name: /传送门/ })).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-portal-room-response-choice', testInfo);
    await page.getByRole('button', { name: /传送门/ }).click({ force: true });

    await expect.poll(async () => {
      const state = await game.getState();
      return state?.sys?.phase === 'playCards'
        && state?.core?.currentPlayerIndex === 0
        && state?.core?.activeExtraTurn?.playerId === '0'
        && state?.core?.activeExtraTurn?.returnToPlayerIndex === 1
        && state?.core?.activeExtraTurn?.reason === 'base_portal_room'
        && state?.core?.pendingExtraTurns == null
        && state?.core?.bases?.[0]?.defId === 'base_faceless_city';
    }, {
      message: 'Portal Room 接受后应在当前回合结束后启动赢家 P0 的额外回合，并替换已计分基地',
      timeout: 20000,
    }).toBe(true);

    await game.screenshot('yuanhou-portal-room-extra-turn-started-after-current-turn', testInfo);

    await game.advancePhase();

    await expect.poll(async () => {
      const state = await game.getState();
      return state?.sys?.phase === 'playCards'
        && state?.core?.currentPlayerIndex === 1
        && state?.core?.activeExtraTurn == null
        && state?.core?.pendingExtraTurns == null
        && state?.core?.bases?.[0]?.defId === 'base_faceless_city';
    }, {
      message: 'Portal Room 的额外回合结束后，应清空 activeExtraTurn 并回到记录的原顺位玩家 P1',
      timeout: 20000,
    }).toBe(true);

    await game.screenshot('yuanhou-portal-room-extra-turn-finished-returned-to-next-player', testInfo);
  });

  test('时间旅行者-The Nexus-真实计分后赢家可选择基地弃牌堆基地代替抽新基地', async ({ page, game }, testInfo) => {
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
              factions: ['shapeshifters'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_the_nexus',
              breakpoint: 19,
              minions: [{
                uid: 'nexus-winner-minion',
                defId: 'time_travelers_time_raider',
                controller: '0',
                owner: '0',
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
              defId: 'base_portal_room',
              breakpoint: 22,
              minions: [],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_monkey_lab'],
          baseDiscard: ['base_the_vats', 'base_faceless_city', 'base_primate_park'],
        },
      },
    });

    await game.waitForPhase('playCards', 10000);
    await game.advancePhase();
    await game.waitForPhase('scoreBases', 10000);

    await expect(page.getByRole('button', { name: '联结点' })).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-the-nexus-response-choice', testInfo);
    await page.getByRole('button', { name: '联结点' }).click({ force: true });

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'base_the_nexus_choose'
        && prompt?.playerId === '0'
        && optionIds.includes('base_the_vats')
        && optionIds.includes('base_faceless_city')
        && optionIds.includes('base_primate_park');
    }, {
      message: 'The Nexus 真实响应后应让赢家从基地弃牌堆选择一个基地',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '生体培养缸' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: '无面者之城' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: '灵长类公园' })).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-the-nexus-base-discard-choice-prompt', testInfo);
    await page.getByRole('button', { name: '无面者之城' }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      const baseDefIds = state?.core?.bases?.map((base: any) => base.defId) ?? [];
      const baseDeck = state?.core?.baseDeck ?? [];
      const baseDiscard = state?.core?.baseDiscard ?? [];
      return state?.sys?.interaction?.current == null
        && state?.sys?.responseWindow?.current == null
        && baseDefIds.includes('base_faceless_city')
        && !baseDefIds.includes('base_the_nexus')
        && !baseDeck.includes('base_faceless_city')
        && baseDiscard.includes('base_the_nexus')
        && !baseDiscard.includes('base_faceless_city');
    }, {
      message: 'The Nexus 选择的基地应作为本次替换新基地，且从基地弃牌堆移除',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '无面者之城' })).toBeHidden({ timeout: 15000 });
    await screenshotViewport(page, 'yuanhou-the-nexus-selected-discard-base-replaced-new-base', testInfo);
  });

  test('时间旅行者-The Nexus-真实计分后让过响应应继续按正常牌库顶替换基地', async ({ page, game }, testInfo) => {
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
              factions: ['shapeshifters'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_the_nexus',
              breakpoint: 19,
              minions: [{
                uid: 'nexus-skip-winner-minion',
                defId: 'time_travelers_time_raider',
                controller: '0',
                owner: '0',
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
              defId: 'base_portal_room',
              breakpoint: 22,
              minions: [],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_monkey_lab'],
          baseDiscard: ['base_the_vats', 'base_faceless_city', 'base_primate_park'],
        },
      },
    });

    await game.waitForPhase('playCards', 10000);
    await game.advancePhase();
    await game.waitForPhase('scoreBases', 10000);

    await expect(page.getByRole('button', { name: '联结点' })).toBeVisible({ timeout: 15000 });
    await screenshotViewport(page, 'yuanhou-the-nexus-skip-response-choice', testInfo);
    await page.getByRole('button', { name: '联结点' }).click({ force: true });

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'base_the_nexus_choose'
        && prompt?.playerId === '0'
        && optionIds.includes('base_the_vats')
        && optionIds.includes('base_faceless_city')
        && optionIds.includes('base_primate_park');
    }, {
      message: 'The Nexus 真实响应后应先进入基地弃牌堆选择 prompt，再允许让过',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '跳过（照常抽新基地）', exact: true })).toBeVisible({ timeout: 15000 });
    await screenshotViewport(page, 'yuanhou-the-nexus-skip-base-discard-choice-prompt', testInfo);
    await page.getByRole('button', { name: '跳过（照常抽新基地）', exact: true }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      const baseDefIds = state?.core?.bases?.map((base: any) => base.defId) ?? [];
      const baseDeck = state?.core?.baseDeck ?? [];
      const baseDiscard = state?.core?.baseDiscard ?? [];
      return state?.sys?.interaction?.current == null
        && state?.sys?.responseWindow?.current == null
        && baseDefIds.includes('base_monkey_lab')
        && !baseDefIds.includes('base_the_nexus')
        && baseDeck.length === 0
        && baseDiscard.includes('base_the_nexus')
        && baseDiscard.includes('base_the_vats')
        && baseDiscard.includes('base_faceless_city')
        && baseDiscard.includes('base_primate_park');
    }, {
      message: 'The Nexus 让过后应按正常牌库顶翻出 Monkey Lab，并完成本次计分收口',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '跳过（照常抽新基地）', exact: true })).toBeHidden({ timeout: 15000 });
    await screenshotViewport(page, 'yuanhou-the-nexus-skipped-and-replaced-by-base-deck-top', testInfo);
  });

  test('超级间谍-ISI摇摆据点-真实计分后赢家可重排自己牌库顶三张', async ({ page, game }, testInfo) => {
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
              hand: [],
              deck: [
                { uid: 'isi-deck-a', defId: 'super_spies_spy', type: 'minion', owner: '0' },
                { uid: 'isi-deck-b', defId: 'super_spies_operative', type: 'minion', owner: '0' },
                { uid: 'isi-deck-c', defId: 'super_spies_mole', type: 'minion', owner: '0' },
                { uid: 'isi-deck-d', defId: 'super_spies_secret_agent', type: 'minion', owner: '0' },
              ],
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
              defId: 'base_isis_swingin_pad',
              breakpoint: 18,
              minions: [{
                uid: 'isi-winner-minion',
                defId: 'super_spies_secret_agent',
                controller: '0',
                owner: '0',
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

    await game.waitForPhase('playCards', 10000);
    await game.advancePhase();
    await game.waitForPhase('scoreBases', 10000);

    await expect(page.getByRole('button', { name: /ISI/ })).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-isi-swingin-pad-response-choice', testInfo);
    await page.getByRole('button', { name: /ISI/ }).click({ force: true });

    let selectedOptionId = '';
    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      selectedOptionId = (prompt?.data?.options ?? []).find((option: any) =>
        option?.value?.targetPlayerId === '0'
        && option?.value?.topUids?.join(',') === 'isi-deck-c,isi-deck-a'
        && option?.value?.bottomUids?.join(',') === 'isi-deck-b',
      )?.id ?? '';
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'base_isis_swingin_pad_reorder'
        && prompt?.playerId === '0'
        && optionIds.length > 0
        && selectedOptionId.length > 0;
    }, {
      message: 'ISI 摇摆据点真实响应后应让赢家选择自己牌库顶三张的顶/底顺序',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-isi-swingin-pad-reorder-choice-prompt', testInfo);
    await page.locator('[data-deck-reorder-card-uid="isi-deck-b"]').click();
    await page.getByRole('button', { name: '移到牌库底' }).click();
    await page.locator('[data-deck-reorder-card-uid="isi-deck-c"]').click();
    await page.getByRole('button', { name: '前移' }).click();
    await page.getByRole('button', { name: '确认顺序' }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      const p0Deck = state?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
      const p0Hand = state?.core?.players?.['0']?.hand?.map((card: any) => card.uid) ?? [];
      return state?.sys?.interaction?.current == null
        && p0Hand.join(',') === 'isi-deck-c,isi-deck-a'
        && p0Deck.join(',') === 'isi-deck-d,isi-deck-b';
    }, {
      message: 'ISI 摇摆据点应只重排赢家本次查看的顶三张；计分后的抽牌阶段应抽走所选顶两张，未查看第四张留在放底牌之前',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-isi-swingin-pad-reordered-deck-resolved', testInfo);
  });

  test('超级间谍-ISI摇摆据点-真实计分后跳过响应仍应完成收口并保留赢家牌库顺序', async ({ page, game }, testInfo) => {
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
              hand: [],
              deck: [
                { uid: 'isi-deck-a', defId: 'super_spies_spy', type: 'minion', owner: '0' },
                { uid: 'isi-deck-b', defId: 'super_spies_operative', type: 'minion', owner: '0' },
                { uid: 'isi-deck-c', defId: 'super_spies_mole', type: 'minion', owner: '0' },
                { uid: 'isi-deck-d', defId: 'super_spies_secret_agent', type: 'minion', owner: '0' },
              ],
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
              defId: 'base_isis_swingin_pad',
              breakpoint: 18,
              minions: [{
                uid: 'isi-winner-minion',
                defId: 'super_spies_secret_agent',
                controller: '0',
                owner: '0',
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

    await game.waitForPhase('playCards', 10000);
    await game.advancePhase();
    await game.waitForPhase('scoreBases', 10000);

    const skipButton = page.getByRole('button', { name: '让过', exact: true });
    await expect(skipButton).toBeVisible({ timeout: 15000 });
    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionKinds = (prompt?.data?.options ?? []).map((option: any) => option?.value?.kind);
      return prompt?.data?.sourceId === 'smashup_reaction_choose'
        && prompt?.playerId === '0'
        && optionKinds.includes('pass');
    }, {
      message: 'ISI 摇摆据点的真实计分响应窗应先给出可跳过的 reaction choose',
      timeout: 15000,
    }).toBe(true);

    await game.screenshot('yuanhou-isi-swingin-pad-response-skip-choice', testInfo);
    await skipButton.click();

    await expect.poll(async () => {
      const state = await game.getState();
      const p0Deck = state?.core?.players?.['0']?.deck?.map((card: any) => card.uid) ?? [];
      const p0Hand = state?.core?.players?.['0']?.hand?.map((card: any) => card.uid) ?? [];
      return state?.sys?.interaction?.current == null
        && state?.sys?.responseWindow?.current == null
        && state?.sys?.phase === 'playCards'
        && state?.core?.currentPlayerIndex === 1
        && state?.core?.bases?.[0]?.defId === 'base_portal_room'
        && p0Hand.join(',') === 'isi-deck-a,isi-deck-b'
        && p0Deck.join(',') === 'isi-deck-c,isi-deck-d';
    }, {
      message: 'ISI 摇摆据点跳过响应后应完成收口，并保留赢家按原顺序抽到的两张牌',
      timeout: 20000,
    }).toBe(true);

    await game.screenshot('yuanhou-isi-swingin-pad-response-skip-resolved', testInfo);
  });
});
