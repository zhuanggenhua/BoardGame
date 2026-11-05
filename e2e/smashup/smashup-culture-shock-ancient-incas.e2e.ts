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

async function dispatchSmashUpCommand(
  page: Page,
  type: string,
  playerId: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await page.evaluate(({ commandType, commandPlayerId, commandPayload }) => {
    const harness = (window as any).__BG_TEST_HARNESS__;
    harness.command.dispatch({
      type: commandType,
      playerId: commandPlayerId,
      payload: commandPayload,
    });
  }, { commandType: type, commandPlayerId: playerId, commandPayload: payload });
  await page.waitForTimeout(300);
}

async function selectReactionTriggerBySource(game: any, page: Page, sourceDefId: string): Promise<void> {
  await game.waitForInteraction('smashup_reaction_choose');
  const optionId = await page.evaluate((targetSourceDefId) => {
    const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
    const options = state?.sys?.interaction?.current?.data?.options ?? [];
    const triggerQueue = state?.core?.triggerQueue ?? [];
    const option = options.find((candidate: any) => {
      const triggerId = candidate?.value?.triggerId;
      return typeof triggerId === 'string'
        && triggerQueue.some((trigger: any) => trigger?.id === triggerId && trigger?.sourceDefId === targetSourceDefId);
    });
    return option?.id ?? null;
  }, sourceDefId);
  expect(optionId, `反应窗口应包含 ${sourceDefId} 的可选触发`).toBeTruthy();
  await game.selectOption(optionId);
}

async function chooseAshlarFromAfterScoringResponse(game: any, page: Page): Promise<void> {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const state = await game.getState();
    const sourceId = state.sys?.interaction?.current?.data?.sourceId ?? null;
    const options = await game.getInteractionOptions();
    const ashlarOption = options.find((option: InteractionOption) =>
      option.value
      && typeof option.value === 'object'
      && (option.value as { kind?: unknown }).kind === 'play_action'
      && (option.value as { cardUid?: unknown }).cardUid === 'ashlar',
    );
    if (ashlarOption) {
      await game.selectOption(ashlarOption.id);
      return;
    }
    if (sourceId === 'smashup_reaction_choose') {
      await game.passResponseWindow();
      continue;
    }
    await page.waitForTimeout(250);
  }
  throw new Error('计分后响应窗口未出现方石砌体出牌选项');
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

    await expect(page.getByTestId('faction-filter-toolbar')).toBeVisible({ timeout: 15000 });
    const search = page.getByTestId('faction-search-input');
    await search.fill('ancient_incas');

    const option = page.getByTestId('faction-option-ancient_incas');
    await expect(option).toBeVisible({ timeout: 15000 });
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

  test('金色秃鹰逐张绑定行动并连续强制额外出牌', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'ancient_incas,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260918,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'condor', defId: 'ancient_incas_golden_condor', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'draw-card', defId: 'ancient_incas_llama', type: 'minion', owner: '0' },
        ],
        discard: [],
        factions: ['ancient_incas', 'aliens'],
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
          defId: 'base_machu_picchu',
          minions: [
            { uid: 'llama-on-base', defId: 'ancient_incas_llama', baseIndex: 0, owner: '0', controller: '0' },
          ],
          ongoingActions: [
            { uid: 'action-a', defId: 'ancient_incas_temple_of_the_sun', ownerId: '0' },
            { uid: 'action-b', defId: 'ancient_incas_fortress_walls', ownerId: '0' },
          ],
        },
        { defId: 'base_cuzcu', minions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await assertCardVisualReady(page, 'condor');
    await game.playCard('ancient_incas_golden_condor');
    await game.waitForInteraction('ancient_incas_golden_condor', 10000);

    const selectionOptions = await game.getInteractionOptions();
    const actionA = selectionOptions.find(option => option.value?.cardUid === 'action-a');
    const actionB = selectionOptions.find(option => option.value?.cardUid === 'action-b');
    expect(actionA, '金色秃鹰应列出第一张己方行动').toBeTruthy();
    expect(actionB, '金色秃鹰应列出第二张己方行动').toBeTruthy();
    await page.locator(`[data-option-id="${actionA!.id}"]`).click({ force: true });
    await page.locator(`[data-option-id="${actionB!.id}"]`).click({ force: true });
    await page.waitForTimeout(200);
    await game.screenshot('05-金色秃鹰-多选两张行动', testInfo);
    await game.confirm();

    await game.waitForInteraction('smashup_immediate_extra_action', 10000);
    let immediateOptions = await game.getInteractionOptions();
    expect(immediateOptions.some(option => option.value?.cardUid === 'action-a')).toBe(true);
    expect(immediateOptions.some(option => option.value?.cardUid === 'action-b')).toBe(false);
    expect(immediateOptions.some(option => option.value?.skip === true)).toBe(false);
    await game.screenshot('06-金色秃鹰-第一张强制额外行动', testInfo);

    await game.selectInteractionOptionBy(option => option.value?.cardUid === 'action-a', '选择第一张绑定行动');
    await game.waitForInteraction('smashup_immediate_extra_action_base', 10000);
    await game.selectInteractionOptionBy(option => option.value?.baseIndex === 0, '第一张绑定行动选择基地');

    await game.waitForInteraction('smashup_immediate_extra_action', 10000);
    immediateOptions = await game.getInteractionOptions();
    expect(immediateOptions.some(option => option.value?.cardUid === 'action-a')).toBe(false);
    expect(immediateOptions.some(option => option.value?.cardUid === 'action-b')).toBe(true);
    expect(immediateOptions.some(option => option.value?.skip === true)).toBe(false);
    await game.screenshot('07-金色秃鹰-第二张强制额外行动', testInfo);

    await game.selectInteractionOptionBy(option => option.value?.cardUid === 'action-b', '选择第二张绑定行动');
    await game.waitForInteraction('smashup_immediate_extra_action_base', 10000);
    await game.selectInteractionOptionBy(option => option.value?.baseIndex === 0, '第二张绑定行动选择基地');
    await game.waitForInteraction('ancient_incas_fortress_walls', 10000);
    await game.selectInteractionOptionBy(option => option.value?.minionUid === 'llama-on-base', '防护墙选择美洲驼');
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const state = await game.getState();
      const sourceId = state.sys?.interaction?.current?.data?.sourceId;
      if (!sourceId) break;
      if (sourceId === 'smashup_reaction_choose') {
        await game.selectOption('pass');
        continue;
      }
      throw new Error(`金色秃鹰第二张行动结算后残留未预期交互: ${sourceId}`);
    }
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        ongoingUids: state.core.bases[0]?.ongoingActions?.map((action: { uid?: string }) => action.uid) ?? [],
        handUids: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        deckUids: state.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        discardUids: state.core.players['0']?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
        llamaCounters: state.core.bases[0]?.minions?.find((minion: { uid?: string }) => minion.uid === 'llama-on-base')?.powerCounters ?? 0,
      };
    }, { timeout: 10000 }).toEqual({
      ongoingUids: ['action-a', 'action-b'],
      handUids: ['draw-card', 'condor'],
      deckUids: [],
      discardUids: [],
      interactionOpen: false,
      llamaCounters: 1,
    });
    await game.screenshot('08-金色秃鹰-两张行动结算并收口', testInfo);
  });

  test('方石砌体在计分后响应窗口回手一张行动，其余行动进入牌库并完成清场换基地', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'ancient_incas,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260918,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'ashlar', defId: 'ancient_incas_ashlar_masonry', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'draw-card', defId: 'ancient_incas_llama', type: 'minion', owner: '0' },
        ],
        discard: [],
        factions: ['ancient_incas', 'aliens'],
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
          defId: 'base_machu_picchu',
          minions: [
            { uid: 'scorer', defId: 'ancient_incas_llama', owner: '0', controller: '0', baseIndex: 0, basePower: 20 },
          ],
          ongoingActions: [
            { uid: 'keep-action', defId: 'ancient_incas_armory', ownerId: '0' },
            { uid: 'deck-action-a', defId: 'ancient_incas_armory', ownerId: '0' },
            { uid: 'deck-action-b', defId: 'ancient_incas_signs_in_the_stars', ownerId: '0' },
          ],
        },
        { defId: 'base_cuzcu', minions: [], ongoingActions: [] },
      ],
      extra: {
        core: {
          baseDeck: ['base_cuzcu'],
          nextUid: 5000,
        },
      },
    });

    await game.waitForPhase('playCards');
    await assertCardVisualReady(page, 'ashlar');
    await game.advancePhase();
    await game.waitForPhase('scoreBases', 10000);
    await chooseAshlarFromAfterScoringResponse(game, page);
    await game.waitForInteraction('ancient_incas_ashlar_masonry', 15000);

    const ashlarOptions = await game.getInteractionOptions();
    expect(ashlarOptions.filter((option: InteractionOption) => option.value?.cardUid).map(
      (option: InteractionOption) => option.value?.cardUid,
    ).sort()).toEqual(['deck-action-a', 'deck-action-b', 'keep-action'].sort());
    await game.screenshot('09-方石砌体-计分后选择回手行动', testInfo);
    await game.selectInteractionOptionBy(
      option => option.value?.cardUid === 'keep-action',
      '方石砌体选择太阳神庙回手',
    );
    await game.waitForNoInteraction(15000);

    await expect.poll(async () => {
      const state = await game.getState();
      const entries = state.sys?.eventStream?.entries ?? [];
      const deckReordered = entries.find((entry: any) =>
        entry.event?.type === 'su:deck_reordered'
        && ['deck-action-a', 'deck-action-b'].every((uid) => entry.event?.payload?.deckUids?.includes(uid)),
      );
      return {
        base0: state.core.bases[0]?.defId ?? null,
        base0Minions: state.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid) ?? [],
        base0Actions: state.core.bases[0]?.ongoingActions?.map((action: { uid?: string }) => action.uid) ?? [],
        keepInHand: state.core.players['0']?.hand?.some((card: { uid?: string }) => card.uid === 'keep-action') ?? false,
        ashlarInDiscard: state.core.players['0']?.discard?.some((card: { uid?: string }) => card.uid === 'ashlar') ?? false,
        restInDiscard: state.core.players['0']?.discard?.some((card: { uid?: string }) =>
          card.uid === 'deck-action-a' || card.uid === 'deck-action-b',
        ) ?? false,
        deckReordered: Boolean(deckReordered),
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 15000 }).toEqual({
      base0: 'base_cuzcu',
      base0Minions: [],
      base0Actions: [],
      keepInHand: true,
      ashlarInDiscard: true,
      restInDiscard: false,
      deckReordered: true,
      interactionOpen: false,
    });
    await game.screenshot('10-方石砌体-清场换基地后收口', testInfo);
  });

  test('皇家公路真实入口覆盖打出时双向移动与其它基地行动后的持续触发', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'ancient_incas,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260918,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'highway', defId: 'ancient_incas_royal_highway', type: 'action', owner: '0' },
          { uid: 'armory', defId: 'ancient_incas_armory', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'draw-card', defId: 'ancient_incas_llama', type: 'minion', owner: '0' },
        ],
        discard: [],
        factions: ['ancient_incas', 'aliens'],
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
        {
          defId: 'base_machu_picchu',
          minions: [
            { uid: 'home', defId: 'ancient_incas_llama', baseIndex: 0, owner: '0', controller: '0' },
          ],
          ongoingActions: [],
        },
        {
          defId: 'base_cuzcu',
          minions: [
            { uid: 'away', defId: 'ancient_incas_llama', baseIndex: 1, owner: '0', controller: '0' },
            { uid: 'enemy', defId: 'pirate_first_mate', baseIndex: 1, owner: '1', controller: '1' },
          ],
          ongoingActions: [],
        },
      ],
    });

    await game.waitForPhase('playCards');
    await assertCardVisualReady(page, 'highway');
    await game.playCard('ancient_incas_royal_highway', { targetBaseIndex: 0 });
    await game.waitForInteraction('ancient_incas_royal_highway', 10000);

    const initialOptions = await game.getInteractionOptions();
    expect(initialOptions.some(option => option.value?.minionUid === 'away' && option.value?.toBaseIndex === 0)).toBe(true);
    expect(initialOptions.some(option => option.value?.minionUid === 'home' && option.value?.toBaseIndex === 1)).toBe(true);
    expect(initialOptions.some(option => option.value?.minionUid === 'enemy')).toBe(false);
    await game.screenshot('11-皇家公路-打出时双向移动候选', testInfo);

    await game.selectInteractionOptionBy(
      option => option.value?.minionUid === 'away' && option.value?.fromBaseIndex === 1 && option.value?.toBaseIndex === 0,
      '皇家公路把其它基地的己方随从移入此基地',
    );
    await game.waitForNoInteraction(10000);

    await game.playCard('ancient_incas_armory', { targetBaseIndex: 1 });
    await game.waitForInteraction('smashup_reaction_choose', 10000);

    const reactionState = await game.getState();
    const highwayTrigger = (reactionState.core.triggerQueue ?? []).find((trigger: any) =>
      trigger.sourceDefId === 'ancient_incas_royal_highway',
    );
    expect(highwayTrigger, '在其它基地打出己方行动后应进入皇家公路可选反应').toBeTruthy();
    await game.selectInteractionOptionBy(
      option => option.value?.triggerId === highwayTrigger.id,
      '选择皇家公路持续触发',
    );
    await game.waitForInteraction('ancient_incas_royal_highway_move', 10000);

    const ongoingOptions = await game.getInteractionOptions();
    expect(ongoingOptions.some(option => option.value?.minionUid === 'away' && option.value?.fromBaseIndex === 0 && option.value?.toBaseIndex === 1)).toBe(true);
    expect(ongoingOptions.some(option => option.value?.minionUid === 'home' && option.value?.fromBaseIndex === 0 && option.value?.toBaseIndex === 1)).toBe(true);
    expect(ongoingOptions.some(option => option.value?.minionUid === 'enemy')).toBe(false);
    await game.screenshot('12-皇家公路-其它基地行动后的移动候选', testInfo);

    await game.selectInteractionOptionBy(
      option => option.value?.minionUid === 'away' && option.value?.fromBaseIndex === 0 && option.value?.toBaseIndex === 1,
      '皇家公路把己方随从移出此基地',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      const entries = state.sys?.eventStream?.entries ?? [];
      return {
        base0Minions: state.core.bases[0]?.minions?.map((minion: { uid?: string }) => minion.uid) ?? [],
        base1Minions: (state.core.bases[1]?.minions?.map((minion: { uid?: string }) => minion.uid) ?? []).sort(),
        base0Actions: state.core.bases[0]?.ongoingActions?.map((action: { uid?: string }) => action.uid) ?? [],
        base1Actions: state.core.bases[1]?.ongoingActions?.map((action: { uid?: string }) => action.uid) ?? [],
        highwayMoves: entries.filter((entry: any) =>
          entry.event?.type === 'su:minion_moved'
          && entry.event?.payload?.reason === 'ancient_incas_royal_highway',
        ).length,
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 15000 }).toEqual({
      base0Minions: ['home'],
      base1Minions: ['away', 'enemy'],
      base0Actions: ['highway'],
      base1Actions: ['armory'],
      highwayMoves: 2,
      interactionOpen: false,
    });
    await game.screenshot('13-皇家公路-双向移动与持续触发收口', testInfo);
  });

  test('萨帕·印加真实入口覆盖牌库弃牌堆检索与行动后指示物', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'ancient_incas,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260918,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'sapa', defId: 'ancient_incas_sapa_inca', type: 'minion', owner: '0' },
        ],
        deck: [
          { uid: 'temple', defId: 'ancient_incas_temple_of_the_sun', type: 'action', owner: '0' },
          { uid: 'draw-card', defId: 'ancient_incas_llama', type: 'minion', owner: '0' },
        ],
        discard: [
          { uid: 'armory', defId: 'ancient_incas_armory', type: 'action', owner: '0' },
          { uid: 'ashlar', defId: 'ancient_incas_ashlar_masonry', type: 'action', owner: '0' },
        ],
        factions: ['ancient_incas', 'aliens'],
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
        { defId: 'base_cuzcu', minions: [], ongoingActions: [] },
        { defId: 'base_machu_picchu', minions: [], ongoingActions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await assertCardVisualReady(page, 'sapa');
    await game.playCard('ancient_incas_sapa_inca', { targetBaseIndex: 0 });
    await game.waitForInteraction('ancient_incas_sapa_inca', 10000);

    const searchOptions = await game.getInteractionOptions();
    expect(searchOptions.some(option => option.value?.cardUid === 'temple' && option.value?.zone === 'deck')).toBe(true);
    expect(searchOptions.some(option => option.value?.cardUid === 'armory' && option.value?.zone === 'discard')).toBe(true);
    expect(searchOptions.some(option => option.value?.cardUid === 'ashlar')).toBe(false);
    await game.screenshot('14-萨帕·印加-牌库与弃牌堆检索候选', testInfo);

    await game.selectInteractionOptionBy(
      option => option.value?.cardUid === 'temple' && option.value?.zone === 'deck',
      '萨帕·印加从牌库检索太阳神庙',
    );
    await game.waitForNoInteraction(10000);

    await game.playCard('ancient_incas_temple_of_the_sun', { targetBaseIndex: 0 });
    await game.waitForInteraction('ancient_incas_sapa_inca_counter', 10000);
    await game.selectInteractionOptionBy(
      option => option.value?.minionUid === 'sapa' && option.value?.baseIndex === 0,
      '萨帕·印加给此基地己方随从放置指示物',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      const entries = state.sys?.eventStream?.entries ?? [];
      return {
        base0Minions: state.core.bases[0]?.minions?.map((minion: { uid?: string; powerCounters?: number }) => ({
          uid: minion.uid,
          powerCounters: minion.powerCounters,
        })) ?? [],
        base0Actions: state.core.bases[0]?.ongoingActions?.map((action: { uid?: string }) => action.uid) ?? [],
        handUids: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        discardUids: state.core.players['0']?.discard?.map((card: { uid?: string }) => card.uid) ?? [],
        deckUids: state.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        counterEvents: entries.filter((entry: any) =>
          entry.event?.type === 'su:power_counter_added'
          && entry.event?.payload?.sourceDefId === 'ancient_incas_counter',
        ).length,
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 15000 }).toEqual({
      base0Minions: [{ uid: 'sapa', powerCounters: 1 }],
      base0Actions: ['temple'],
      handUids: ['draw-card'],
      discardUids: ['armory', 'ashlar'],
      deckUids: [],
      counterEvents: 1,
      interactionOpen: false,
    });
    await game.screenshot('15-萨帕·印加-行动后指示物收口', testInfo);
  });

  test('防护墙真实入口覆盖打出时与其它行动后的两次指示物选择', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'ancient_incas,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260918,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'fortress', defId: 'ancient_incas_fortress_walls', type: 'action', owner: '0' },
          { uid: 'temple', defId: 'ancient_incas_temple_of_the_sun', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'draw-card', defId: 'ancient_incas_llama', type: 'minion', owner: '0' },
        ],
        discard: [],
        factions: ['ancient_incas', 'aliens'],
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
        {
          defId: 'base_cuzcu',
          minions: [
            { uid: 'own', defId: 'ancient_incas_llama', baseIndex: 0, owner: '0', controller: '0' },
            { uid: 'enemy', defId: 'pirate_first_mate', baseIndex: 0, owner: '1', controller: '1' },
          ],
          ongoingActions: [],
        },
        { defId: 'base_machu_picchu', minions: [], ongoingActions: [] },
      ],
    });

    await game.waitForPhase('playCards');
    await assertCardVisualReady(page, 'fortress');
    await game.playCard('ancient_incas_fortress_walls', { targetBaseIndex: 0 });
    await game.waitForInteraction('ancient_incas_fortress_walls', 10000);

    const onPlayOptions = await game.getInteractionOptions();
    expect(onPlayOptions.some(option => option.value?.minionUid === 'own' && option.value?.baseIndex === 0)).toBe(true);
    expect(onPlayOptions.some(option => option.value?.minionUid === 'enemy')).toBe(false);
    expect(onPlayOptions.some(option => option.value?.skip === true)).toBe(false);
    await game.screenshot('16-防护墙-打出时选择己方随从', testInfo);

    await game.selectInteractionOptionBy(
      option => option.value?.minionUid === 'own' && option.value?.baseIndex === 0,
      '防护墙打出时给己方随从放置指示物',
    );
    await game.waitForNoInteraction(10000);

    await game.playCard('ancient_incas_temple_of_the_sun', { targetBaseIndex: 0 });
    await game.waitForInteraction('smashup_reaction_choose', 10000);

    const reactionState = await game.getState();
    const fortressTrigger = (reactionState.core.triggerQueue ?? []).find((trigger: any) =>
      trigger.sourceDefId === 'ancient_incas_fortress_walls',
    );
    expect(fortressTrigger, '同基地己方打出其它行动后应进入防护墙可选反应').toBeTruthy();
    await game.selectInteractionOptionBy(
      option => option.value?.triggerId === fortressTrigger.id,
      '选择防护墙持续触发',
    );
    await game.waitForInteraction('ancient_incas_fortress_walls_counter', 10000);

    const ongoingOptions = await game.getInteractionOptions();
    expect(ongoingOptions.some(option => option.value?.minionUid === 'own' && option.value?.baseIndex === 0)).toBe(true);
    expect(ongoingOptions.some(option => option.value?.minionUid === 'enemy')).toBe(false);
    expect(ongoingOptions.some(option => option.value?.skip === true)).toBe(true);
    await game.screenshot('17-防护墙-其它行动后的可选指示物', testInfo);

    await game.selectInteractionOptionBy(
      option => option.value?.minionUid === 'own' && option.value?.baseIndex === 0,
      '防护墙持续触发给己方随从放置指示物',
    );
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      const entries = state.sys?.eventStream?.entries ?? [];
      return {
        base0Minions: state.core.bases[0]?.minions?.map((minion: { uid?: string; powerCounters?: number }) => ({
          uid: minion.uid,
          powerCounters: minion.powerCounters,
        })) ?? [],
        base0Actions: state.core.bases[0]?.ongoingActions?.map((action: { uid?: string }) => action.uid) ?? [],
        handUids: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        deckUids: state.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        counterEvents: entries.filter((entry: any) =>
          entry.event?.type === 'su:power_counter_added'
          && entry.event?.payload?.sourceDefId === 'ancient_incas_counter',
        ).length,
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 15000 }).toEqual({
      base0Minions: [
        { uid: 'own', powerCounters: 2 },
        { uid: 'enemy', powerCounters: 0 },
      ],
      base0Actions: ['fortress', 'temple'],
      handUids: ['draw-card'],
      deckUids: [],
      counterEvents: 2,
      interactionOpen: false,
    });
    await game.screenshot('18-防护墙-两次指示物结算收口', testInfo);
  });

  test('星星上的征兆真实打出复制牌库顶基地能力，天赋后仍保留原基地能力并切换额外来源', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'ancient_incas,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260918,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [
          { uid: 'signs', defId: 'ancient_incas_signs_in_the_stars', type: 'action', owner: '0' },
          { uid: 'armory-a', defId: 'ancient_incas_armory', type: 'action', owner: '0' },
          { uid: 'armory-b', defId: 'ancient_incas_armory', type: 'action', owner: '0' },
        ],
        deck: [
          { uid: 'draw-signs', defId: 'ancient_incas_llama', type: 'minion', owner: '0' },
          { uid: 'draw-armory-a', defId: 'ancient_incas_llama', type: 'minion', owner: '0' },
          { uid: 'draw-armory-b', defId: 'ancient_incas_llama', type: 'minion', owner: '0' },
        ],
        discard: [],
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
        { defId: 'base_machu_picchu', minions: [], ongoingActions: [] },
        { defId: 'base_cuzcu', minions: [], ongoingActions: [] },
      ],
      extra: {
        core: {
          baseDeck: ['base_machu_picchu', 'base_cuzcu'],
        },
      },
    });

    await game.waitForPhase('playCards');
    await assertCardVisualReady(page, 'signs');
    await game.playCard('ancient_incas_signs_in_the_stars', { targetBaseIndex: 0 });
    await game.waitForNoInteraction(10000);

    await expect.poll(async () => {
      const state = await game.getState();
      return {
        base0Actions: state.core.bases[0]?.ongoingActions?.map((action: { uid?: string }) => action.uid) ?? [],
        sourceUid: state.core.bases[0]?.metadata?.signsInTheStarsSourceUid ?? null,
        faceUpBase: state.core.bases[0]?.metadata?.signsInTheStarsFaceUpBaseDefId ?? null,
        handUids: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        deckUids: state.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
      };
    }, { timeout: 10000 }).toEqual({
      base0Actions: ['signs'],
      sourceUid: 'signs',
      faceUpBase: 'base_machu_picchu',
      handUids: ['armory-a', 'armory-b', 'draw-signs'],
      deckUids: ['draw-armory-a', 'draw-armory-b'],
    });
    await game.screenshot('19-星星上的征兆-打出后复制马丘比丘', testInfo);

    await game.playCard('ancient_incas_armory', { targetBaseIndex: 0 });
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        base0Actions: state.core.bases[0]?.ongoingActions?.map((action: { uid?: string }) => action.uid) ?? [],
        handUids: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        deckUids: state.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
      };
    }, { timeout: 10000 }).toEqual({
      base0Actions: ['signs', 'armory-a'],
      handUids: ['armory-b', 'draw-signs', 'draw-armory-a'],
      deckUids: ['draw-armory-b'],
    });

    const signsCard = page.locator('[data-ongoing-uid="signs"]');
    await expect(signsCard).toBeVisible({ timeout: 10000 });
    await signsCard.click({ force: true });
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        talentUsed: state.core.bases[0]?.ongoingActions?.find((action: { uid?: string }) => action.uid === 'signs')?.talentUsed ?? false,
        baseDeck: state.core.baseDeck ?? [],
      };
    }, { timeout: 10000 }).toEqual({
      talentUsed: true,
      baseDeck: ['base_cuzcu', 'base_machu_picchu'],
    });
    await game.screenshot('20-星星上的征兆-天赋后牌库顶翻转', testInfo);

    await game.playCard('ancient_incas_armory', { targetBaseIndex: 0 });
    await game.waitForNoInteraction(10000);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        base0Actions: state.core.bases[0]?.ongoingActions?.map((action: { uid?: string }) => action.uid) ?? [],
        handUids: state.core.players['0']?.hand?.map((card: { uid?: string }) => card.uid) ?? [],
        deckUids: state.core.players['0']?.deck?.map((card: { uid?: string }) => card.uid) ?? [],
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 10000 }).toEqual({
      base0Actions: ['signs', 'armory-a', 'armory-b'],
        handUids: ['draw-signs', 'draw-armory-a', 'draw-armory-b'],
        deckUids: [],
        interactionOpen: false,
      });
    await game.screenshot('21-星星上的征兆-换顶后保留原基地能力', testInfo);
  });

  test('星星上的征兆在每名玩家回合开始可翻面，下一回合恢复', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'ancient_incas,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260918,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '1',
      phase: 'playCards',
      player0: {
        hand: [],
        deck: [],
        discard: [],
        factions: ['ancient_incas', 'aliens'],
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
          defId: 'base_machu_picchu',
          minions: [],
          ongoingActions: [{
            uid: 'signs-turn',
            defId: 'ancient_incas_signs_in_the_stars',
            ownerId: '0',
            talentUsed: false,
            metadata: {
              signsInTheStarsSourceUid: 'signs-turn',
              signsInTheStarsFaceUpBaseDefId: 'base_machu_picchu',
              signsInTheStarsFaceDownUntilTurn: null,
            },
          }],
        },
        { defId: 'base_cuzcu', minions: [], ongoingActions: [] },
      ],
      extra: {
        core: {
          currentPlayerIndex: 1,
          turnNumber: 1,
          baseDeck: ['base_machu_picchu'],
        },
      },
    });

    await game.waitForPhase('playCards');
    await game.advancePhase();
    await selectReactionTriggerBySource(game, page, 'ancient_incas_signs_in_the_stars');
    await game.waitForInteraction('ancient_incas_signs_in_the_stars_turn_start');

    const turnStartOptions = await game.getInteractionOptions();
    expect(turnStartOptions.some(option => option.value?.faceDown === true)).toBe(true);
    expect(turnStartOptions.some(option => option.value?.skip === true)).toBe(true);
    await game.screenshot('22-星星上的征兆-回合开始翻面选择', testInfo);
    await game.selectInteractionOptionBy(option => option.value?.faceDown === true, '本回合翻面关闭星星上的征兆');
    await game.waitForNoInteraction(10000);

    const disabledState = await game.getState();
    const disabledTurn = disabledState.core.turnNumber;
    expect(disabledState.core.bases[0]?.metadata?.signsInTheStarsFaceDownUntilTurn).toBe(disabledTurn);

    await game.advancePhase();
    await game.advancePhase();
    await selectReactionTriggerBySource(game, page, 'ancient_incas_signs_in_the_stars');
    await game.waitForInteraction('ancient_incas_signs_in_the_stars_turn_start');

    const restoredState = await game.getState();
    expect(restoredState.core.turnNumber).toBeGreaterThan(disabledTurn);
    expect(restoredState.core.bases[0]?.metadata?.signsInTheStarsFaceDownUntilTurn).not.toBe(restoredState.core.turnNumber);
    await game.screenshot('23-星星上的征兆-下一回合恢复并再次出现选择', testInfo);
    await game.selectInteractionOptionBy(option => option.value?.skip === true, '下一回合保持星星上的征兆正面');
    await game.waitForNoInteraction(10000);
  });

  test('星星上的征兆随基地清场离场后不再残留', async ({ page, game }, testInfo) => {
    test.setTimeout(120000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', {
      p0: 'ancient_incas,aliens',
      p1: 'pirates,ninjas',
      skipFactionSelect: true,
      skipInitialization: false,
      seed: 20260918,
    }, 45000);

    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      player0: {
        hand: [],
        deck: [],
        discard: [],
        factions: ['ancient_incas', 'aliens'],
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
          defId: 'base_machu_picchu',
          minions: [{ uid: 'scorer-signs', defId: 'ancient_incas_llama', owner: '0', controller: '0', baseIndex: 0, basePower: 20 }],
          ongoingActions: [{
            uid: 'signs-clear',
            defId: 'ancient_incas_signs_in_the_stars',
            ownerId: '0',
            metadata: {
              signsInTheStarsSourceUid: 'signs-clear',
              signsInTheStarsFaceUpBaseDefId: 'base_machu_picchu',
              signsInTheStarsFaceDownUntilTurn: null,
            },
          }],
        },
        { defId: 'base_cuzcu', minions: [], ongoingActions: [] },
      ],
      extra: {
        core: {
          baseDeck: ['base_cuzcu'],
        },
      },
    });

    await game.advancePhase();
    await game.waitForNoInteraction(15000);
    await expect.poll(async () => {
      const state = await game.getState();
      return {
        base0DefId: state.core.bases[0]?.defId ?? null,
        base0Actions: state.core.bases[0]?.ongoingActions?.map((action: { uid?: string }) => action.uid) ?? [],
        sourceUid: state.core.bases[0]?.metadata?.signsInTheStarsSourceUid ?? null,
        interactionOpen: Boolean(state.sys?.interaction?.current),
      };
    }, { timeout: 15000 }).toEqual({
      base0DefId: 'base_cuzcu',
      base0Actions: [],
      sourceUid: null,
      interactionOpen: false,
    });
    await game.screenshot('24-星星上的征兆-基地清场后能力离场', testInfo);
  });
});
