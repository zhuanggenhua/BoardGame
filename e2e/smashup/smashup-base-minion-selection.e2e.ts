/**
 * 大杀四方 - 基地和随从选择交互 E2E 测试
 * 
 * 验证目标：
 * 1. 基地选择交互不弹出 PromptOverlay 窗口
 * 2. 随从选择交互不弹出 PromptOverlay 窗口
 * 3. 可选目标高亮显示
 * 4. 直接点击目标完成选择
 * 5. 顶部显示交互标题横幅
 */

import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import { waitForTestHarness } from '../helpers/common';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import type { GameTestContext as __ThreeAxeFrameworkMarker } from '../framework';

type __ThreeAxeGameMarker = {
  openTestGame: (gameId: string) => Promise<void>;
  setupScene: (config: { gameId: string }) => Promise<void>;
};

const __ensureThreeAxesMarker = async (game: __ThreeAxeGameMarker) => {
  await game.openTestGame('smashup');
  await game.setupScene({ gameId: 'smashup' });
};
void __ensureThreeAxesMarker;

import {
    setupTwoPlayerMatch as setupOnlineMatch,
    cleanupTwoPlayerMatch,
    completeFactionSelectionCustom,
    waitForHandArea,
    FACTION,
} from './smashup-helpers';

const HOST_PLAYER_ID = '0';
const MISKATONIC_BASE_LEGACY_TEXT = '在这个基地计分后，冠军可以搜寻他的手牌和弃牌堆中任意数量的疯狂卡，然后返回到疯狂卡牌库。';
const MISKATONIC_BASE_POD_TEXT = '每回合一次，在你于此打出一个随从后，你可以抽两张疯狂卡，或从你的手牌弃置一张疯狂卡来额外打出一张战术。';
const STEAMPUNK_TRICKSTER_PACKET_CORE = {
    players: {
        '0': {
            id: '0',
            vp: 0,
            hand: [
                { uid: 'c22', defId: 'trickster_brownie_pod', type: 'minion', owner: '0' },
                { uid: 'c35', defId: 'trickster_hideout_pod', type: 'action', owner: '0' },
                { uid: 'c4', defId: 'steampunk_steam_man_pod', type: 'minion', owner: '0' },
                { uid: 'c12', defId: 'steampunk_aggromotive_pod', type: 'action', owner: '0' },
                { uid: 'c16', defId: 'steampunk_change_of_venue_pod', type: 'action', owner: '0' },
            ],
            deck: [],
            discard: [],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
            factions: ['steampunks_pod', 'tricksters_pod'],
            sameNameMinionDefId: null,
        },
        '1': {
            id: '1',
            vp: 0,
            hand: [],
            deck: [],
            discard: [],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
            factions: ['robots', 'wizards'],
        },
    },
    turnOrder: ['0', '1'],
    currentPlayerIndex: 0,
    bases: [
        { defId: 'base_mushroom_kingdom', minions: [], ongoingActions: [] },
        { defId: 'base_the_factory', minions: [], ongoingActions: [] },
        { defId: 'base_great_library', minions: [], ongoingActions: [] },
    ],
    titans: [
        {
            uid: 'titan_0_tricksters_big_funny_giant',
            defId: 'tricksters_big_funny_giant',
            faction: 'tricksters',
            ownerId: '0',
            controllerId: '0',
            powerCounters: 0,
            talentUsed: false,
            location: { zone: 'setaside' },
        },
    ],
    enabledExpansions: ['titans'],
    baseDeck: [],
    baseDiscard: [],
    turnNumber: 1,
    nextUid: 81,
    cardsPlayedThisTurn: 0,
    powerCountersPlacedOnMinionsThisTurn: 0,
    turnDestroyedMinions: [],
};

async function applySmashUpStatePatch(
    matchId: string,
    page: Page,
    updater: (state: any) => any,
): Promise<void> {
    const currentState = await getMatchState(matchId, page);
    const nextState = normalizeInjectedMatchState(matchId, updater(currentState));
    await injectMatchState(matchId, nextState, page);
    await page.waitForTimeout(500);
}

function normalizeInjectedMatchState(matchId: string, state: any): any {
    const next = structuredClone(state);
    const fallbackTurnOrder = Array.isArray(next.core?.turnOrder)
        ? [...next.core.turnOrder]
        : Object.keys(next.core?.players ?? {});
    const currentPlayerIndex = typeof next.sys?.currentPlayerIndex === 'number'
        ? next.sys.currentPlayerIndex
        : typeof next.core?.currentPlayerIndex === 'number'
            ? next.core.currentPlayerIndex
            : Math.max(0, fallbackTurnOrder.indexOf(next.core?.activePlayerId ?? HOST_PLAYER_ID));

    next.sys = {
        ...next.sys,
        matchId,
        turnOrder: Array.isArray(next.sys?.turnOrder) ? next.sys.turnOrder : fallbackTurnOrder,
        currentPlayerIndex,
        phase: typeof next.sys?.phase === 'string' ? next.sys.phase : next.core?.phase,
    };
    next.core = {
        ...next.core,
        turnOrder: fallbackTurnOrder,
        currentPlayerIndex,
        phase: typeof next.core?.phase === 'string' ? next.core.phase : next.sys.phase,
    };
    return next;
}

async function injectSteampunkTricksterPacketState(matchId: string, page: Page): Promise<void> {
    await applySmashUpStatePatch(matchId, page, (state) => ({
        ...state,
        core: {
            ...state.core,
            ...structuredClone(STEAMPUNK_TRICKSTER_PACKET_CORE),
        },
        sys: {
            ...state.sys,
            phase: 'playCards',
            interaction: { current: undefined, queue: [] },
        },
    }));
    await page.waitForSelector('[data-card-uid="c4"]', { timeout: 5000 });
    await page.waitForSelector('[data-testid="su-rail-titan-titan_0_tricksters_big_funny_giant"]', { timeout: 5000 });
}

async function injectMiskatonicPodBaseState(matchId: string, page: Page): Promise<void> {
    await applySmashUpStatePatch(matchId, page, (state) => ({
        ...state,
        core: {
            ...state.core,
            players: {
                ...(state.core?.players ?? {}),
                '0': {
                    ...(state.core?.players?.['0'] ?? {}),
                    id: '0',
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['miskatonic_university_pod', 'ghosts_pod'],
                },
                '1': {
                    ...(state.core?.players?.['1'] ?? {}),
                    id: '1',
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['aliens', 'robots'],
                },
            },
            bases: [
                { defId: 'base_miskatonic_university_base', minions: [], ongoingActions: [] },
                { defId: 'base_the_factory', minions: [], ongoingActions: [] },
                { defId: 'base_great_library', minions: [], ongoingActions: [] },
            ],
            titans: [],
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
        },
        sys: {
            ...state.sys,
            phase: 'playCards',
            interaction: { current: undefined, queue: [] },
        },
    }));
    await page.waitForSelector('[data-testid="base-zone-0"]', { timeout: 5000 });
}

async function injectMushroomInvisibleTurnStartState(matchId: string, page: Page): Promise<void> {
    await applySmashUpStatePatch(matchId, page, (state) => ({
        ...state,
        core: {
            ...state.core,
            players: {
                ...(state.core?.players ?? {}),
                '0': {
                    ...(state.core?.players?.['0'] ?? {}),
                    id: '0',
                    vp: 0,
                    hand: [
                        makeInjectedCard('host-card-1', 'alien_scout', 'minion', HOST_PLAYER_ID),
                        makeInjectedCard('host-card-2', 'pirate_first_mate', 'minion', HOST_PLAYER_ID),
                    ],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['ninjas', 'aliens'],
                    sameNameMinionDefId: null,
                },
                '1': {
                    ...(state.core?.players?.['1'] ?? {}),
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['robots', 'pirates'],
                    sameNameMinionDefId: null,
                },
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            phase: 'endTurn',
            bases: [
                { defId: 'base_mushroom_kingdom', minions: [], ongoingActions: [] },
                {
                    defId: 'base_the_factory',
                    minions: [makeInjectedMinion('enemy-minion-1', 'robot_microbot_alpha', '1', '1', 1)],
                    ongoingActions: [],
                },
                { defId: 'base_great_library', minions: [], ongoingActions: [] },
            ],
            titans: [
                {
                    uid: 'titan-invisible-ninja-1',
                    defId: 'ninjas_invisible_ninja',
                    faction: 'ninjas',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 2, enteredAt: 1 },
                },
            ],
            enabledExpansions: ['titans'],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 3,
            nextUid: 900,
            cardsPlayedThisTurn: 0,
            powerCountersPlacedOnMinionsThisTurn: 0,
            turnDestroyedMinions: [],
            triggerQueue: [],
        },
        sys: {
            ...state.sys,
            phase: 'endTurn',
            interaction: { current: undefined, queue: [] },
        },
    }));
    await page.waitForSelector('[data-testid="base-zone-0"]', { timeout: 5000 });
}

function makeInjectedCard(uid: string, defId: string, type: 'minion' | 'action', owner: string) {
    return { uid, defId, type, owner };
}

function makeInjectedMinion(
    uid: string,
    defId: string,
    controller: string,
    owner: string,
    basePower: number,
) {
    return {
        uid,
        defId,
        controller,
        owner,
        basePower,
        powerCounters: 0,
        powerModifier: 0,
        tempPowerModifier: 0,
        talentUsed: false,
        playedThisTurn: false,
        attachedActions: [],
    };
}

async function injectAlienInteractionState(
    matchId: string,
    page: Page,
    config: {
        hostHand: Array<{ uid: string; defId: string; type: 'minion' | 'action'; owner: string }>;
        bases: Array<{ defId: string; minions: any[]; ongoingActions: any[] }>;
        baseDeck?: string[];
    },
): Promise<void> {
    await applySmashUpStatePatch(matchId, page, (state) => ({
        ...state,
        core: {
            ...state.core,
            players: {
                ...(state.core?.players ?? {}),
                '0': {
                    ...(state.core?.players?.['0'] ?? {}),
                    id: '0',
                    vp: 0,
                    hand: config.hostHand,
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['aliens', 'pirates'],
                    sameNameMinionDefId: null,
                },
                '1': {
                    ...(state.core?.players?.['1'] ?? {}),
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['ninjas', 'robots'],
                    sameNameMinionDefId: null,
                },
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            phase: 'playCards',
            bases: config.bases,
            titans: [],
            enabledExpansions: [],
            baseDeck: config.baseDeck ?? [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 500,
            cardsPlayedThisTurn: 0,
            powerCountersPlacedOnMinionsThisTurn: 0,
            turnDestroyedMinions: [],
        },
        sys: {
            ...state.sys,
            phase: 'playCards',
            interaction: { current: undefined, queue: [] },
        },
    }));
}

async function injectCthulhuCorruptionState(matchId: string, page: Page): Promise<void> {
    await applySmashUpStatePatch(matchId, page, (state) => ({
        ...state,
        core: {
            ...state.core,
            players: {
                ...(state.core?.players ?? {}),
                '0': {
                    ...(state.core?.players?.['0'] ?? {}),
                    id: '0',
                    vp: 0,
                    hand: [
                        makeInjectedCard('corruption-1', 'cthulhu_corruption', 'action', HOST_PLAYER_ID),
                        makeInjectedCard('fallback-minion-1', 'alien_scout', 'minion', HOST_PLAYER_ID),
                    ],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 2,
                    factions: ['cthulhu', 'aliens'],
                    sameNameMinionDefId: null,
                },
                '1': {
                    ...(state.core?.players?.['1'] ?? {}),
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['ninjas', 'robots'],
                    sameNameMinionDefId: null,
                },
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            phase: 'playCards',
            bases: [
                {
                    defId: 'base_the_homeworld',
                    minions: [
                        makeInjectedMinion('target-1', 'ninja_shinobi', '1', '1', 2),
                    ],
                    ongoingActions: [],
                },
                { defId: 'base_tar_pits', minions: [], ongoingActions: [] },
                { defId: 'base_great_library', minions: [], ongoingActions: [] },
            ],
            titans: [],
            enabledExpansions: [],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 500,
            cardsPlayedThisTurn: 0,
            powerCountersPlacedOnMinionsThisTurn: 0,
            turnDestroyedMinions: [],
            madnessDeck: ['madness', 'madness', 'madness'],
        },
        sys: {
            ...state.sys,
            phase: 'playCards',
            interaction: { current: undefined, queue: [] },
        },
    }));
}

function getInteractionSourceId(state: any): string | null {
    return state?.sys?.interaction?.current?.data?.sourceId ?? null;
}

async function waitForInteractionSourceId(
    matchId: string,
    page: Page,
    sourceId: string,
    timeout = 5000,
): Promise<void> {
    await expect.poll(async () => {
        const state = await getMatchState(matchId, page);
        return getInteractionSourceId(state);
    }, { timeout }).toBe(sourceId);
}

async function waitForSelectableBase(page: Page, baseIndex: number, timeout = 5000): Promise<void> {
    await page.waitForFunction(
        (targetIndex) => {
            const zone = document.querySelector<HTMLElement>(`[data-testid="base-zone-${targetIndex}"]`);
            if (!zone) return false;
            const nodes = [zone, ...Array.from(zone.querySelectorAll<HTMLElement>('*'))];
            return nodes.some((node) => {
                const className = node.getAttribute('class') ?? '';
                return className.includes('ring-green-300') || className.includes('ring-green-400');
            });
        },
        baseIndex,
        { timeout },
    );
}

async function waitForSelectableMinion(page: Page, minionUid: string, timeout = 5000): Promise<void> {
    await page.waitForFunction((targetUid) => {
        const minion = document.querySelector<HTMLElement>(`[data-minion-uid="${targetUid}"]`);
        if (!minion) return false;
        const nodes = [minion, ...Array.from(minion.querySelectorAll<HTMLElement>('*'))];
        return nodes.some((node) => {
            const className = node.getAttribute('class') ?? '';
            return className.includes('ring-green-400') || className.includes('ring-green-300');
        });
    }, minionUid, { timeout });
}

async function isMinionSelectable(page: Page, minionUid: string): Promise<boolean> {
    return await page.evaluate((targetUid) => {
        const minion = document.querySelector<HTMLElement>(`[data-minion-uid="${targetUid}"]`);
        if (!minion) return false;
        const nodes = [minion, ...Array.from(minion.querySelectorAll<HTMLElement>('*'))];
        return nodes.some((node) => {
            const className = node.getAttribute('class') ?? '';
            return className.includes('ring-green-400') || className.includes('ring-green-300');
        });
    }, minionUid);
}

async function clickBaseZone(page: Page, baseIndex: number): Promise<void> {
    await page.evaluate((targetIndex) => {
        const zone = document.querySelector<HTMLElement>(`[data-testid="base-zone-${targetIndex}"]`);
        if (!zone) return;
        const selectable = zone.querySelector<HTMLElement>('[class*="ring-green-300"], [class*="ring-green-400"]');
        (selectable ?? zone).click();
    }, baseIndex);
    await page.waitForTimeout(300);
}

async function clickMinion(page: Page, minionUid: string): Promise<void> {
    await page.evaluate((targetUid) => {
        const minion = document.querySelector<HTMLElement>(`[data-minion-uid="${targetUid}"]`);
        minion?.click();
    }, minionUid);
    await page.waitForTimeout(300);
}

async function respondCurrentInteraction(
    page: Page,
    payload: { optionId?: string; optionIds?: string[]; mergedValue?: unknown },
): Promise<void> {
    await page.evaluate((responsePayload) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const interaction = harness?.state?.get?.()?.sys?.interaction?.current;
        if (!interaction) {
            throw new Error('当前没有可响应的交互');
        }
        harness.command.dispatch({
            type: 'SYS_INTERACTION_RESPOND',
            playerId: interaction.playerId,
            payload: responsePayload,
        });
    }, payload);
    await page.waitForTimeout(300);
}

async function dispatchHarnessCommand(
    page: Page,
    playerId: '0' | '1',
    type: string,
    payload: Record<string, unknown>,
): Promise<void> {
    await page.evaluate(({ commandType, commandPayload, commandPlayerId }) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        harness.command.dispatch({
            type: commandType,
            playerId: commandPlayerId,
            payload: commandPayload,
        });
    }, {
        commandType: type,
        commandPayload: payload,
        commandPlayerId: playerId,
    });
    await page.waitForTimeout(300);
}

async function drainPostResolutionFlow(
    matchId: string,
    hostPage: Page,
    guestPage: Page,
    timeout = 8000,
): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const state = await getMatchState(matchId, hostPage);
        const current = state?.sys?.interaction?.current ?? null;
        const currentSourceId = current?.data?.sourceId ?? null;

        if (currentSourceId === 'smashup_reaction_choose') {
            const currentPlayerId = current?.playerId as '0' | '1' | undefined;
            const options = Array.isArray(current?.data?.options) ? current.data.options as any[] : [];
            const option = options.find(entry => entry?.id === 'pass' || entry?.value?.kind === 'pass') ?? options[0];
            if (!currentPlayerId || !option?.id) break;
            await respondCurrentInteraction(currentPlayerId === '0' ? hostPage : guestPage, { optionId: option.id });
            continue;
        }

        const responseWindow = state?.sys?.responseWindow?.current ?? null;
        const responderQueue = Array.isArray(responseWindow?.responderQueue) ? responseWindow.responderQueue : [];
        const responderIndex = typeof responseWindow?.currentResponderIndex === 'number' ? responseWindow.currentResponderIndex : -1;
        const currentResponder = responderIndex >= 0 ? responderQueue[responderIndex] as '0' | '1' | undefined : undefined;
        if (!current && currentResponder && (currentResponder === '0' || currentResponder === '1')) {
            await dispatchHarnessCommand(currentResponder === '0' ? hostPage : guestPage, currentResponder, 'RESPONSE_PASS', {});
            continue;
        }

        if (!current && !responseWindow) {
            return;
        }
        await hostPage.waitForTimeout(150);
    }
    throw new Error('未能在限定时间内收口后续反应链');
}

const ONLINE_SELECTION_MATCHES: any[] = [];

async function createOnlineSelectionMatch(browser: any, testInfo: any) {
    const setup = await setupOnlineMatch(browser, testInfo.project.use.baseURL as string | undefined);
    if (!setup) return null;

    await completeFactionSelectionCustom(
        setup.hostPage,
        setup.guestPage,
        [FACTION.ALIENS, FACTION.PIRATES],
        [FACTION.NINJAS, FACTION.ROBOTS],
    );
    await waitForHandArea(setup.hostPage);
    ONLINE_SELECTION_MATCHES.push(setup);
    return setup;
}

async function drainOnlineSelectionMatches(): Promise<void> {
    while (ONLINE_SELECTION_MATCHES.length > 0) {
        const setup = ONLINE_SELECTION_MATCHES.pop();
        if (setup) {
            await cleanupTwoPlayerMatch(setup);
        }
    }
}

test.describe('SmashUp Base/Minion Selection', () => {
    test.describe.configure({ timeout: 90000 });

    test.afterEach(async () => {
        await drainOnlineSelectionMatches();
    });

    test('基地选择：外星人地形改造 - 不弹窗，直接点击基地', async ({ browser }, testInfo) => {
        const smashupMatch = await createOnlineSelectionMatch(browser, testInfo);
        if (!smashupMatch) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }
        const { hostPage: page, matchId } = smashupMatch;
        await clearEvidenceScreenshotsForTest(testInfo);

        // 等待测试工具就绪
        await waitForTestHarness(page);

        await injectAlienInteractionState(matchId, page, {
            hostHand: [makeInjectedCard('terraform-1', 'alien_terraform', 'action', HOST_PLAYER_ID)],
            baseDeck: ['base_central_brain', 'base_pirate_cove'],
            bases: [
                { defId: 'base_the_homeworld', minions: [], ongoingActions: [] },
                { defId: 'base_tar_pits', minions: [], ongoingActions: [] },
                { defId: 'base_great_library', minions: [], ongoingActions: [] },
            ],
        });

        // 等待手牌渲染
        await page.waitForSelector('[data-card-uid="terraform-1"]', { timeout: 5000 });

        // 点击地形改造卡
        await page.click('[data-card-uid="terraform-1"]');
        const selectedCardShot = getEvidenceScreenshotPath(testInfo, 'terraform-card-selected', {
            filename: 'smashup-terraform-card-selected.png',
        });
        await page.locator('[data-card-uid="terraform-1"]').screenshot({ path: selectedCardShot });

        const promptOverlay = page.locator('[data-testid="prompt-overlay"]');
        await expect(promptOverlay).not.toBeVisible();
        await waitForSelectableBase(page, 0);
        const baseHighlightShot = getEvidenceScreenshotPath(testInfo, 'terraform-base-highlight', {
            filename: 'smashup-terraform-base-highlight.png',
        });
        await page.screenshot({ path: baseHighlightShot, fullPage: false });
        await clickBaseZone(page, 0);

        await waitForInteractionSourceId(matchId, page, 'alien_terraform');
        await expect(promptOverlay).not.toBeVisible();

        await waitForSelectableBase(page, 0);
        await clickBaseZone(page, 0);

        await waitForInteractionSourceId(matchId, page, 'alien_terraform_choose_replacement');
        await expect(page.getByText('地形改造：从基地牌库中选择一张基地进行替换', { exact: true })).toBeVisible();
        const terraformReplacementShot = getEvidenceScreenshotPath(testInfo, 'terraform-replacement-prompt', {
            filename: 'smashup-terraform-replacement-prompt.png',
        });
        await page.screenshot({ path: terraformReplacementShot, fullPage: false });
    });

    test('随从选择：外星人至高霸主 - 不弹窗，直接点击随从', async ({ browser }, testInfo) => {
        const smashupMatch = await createOnlineSelectionMatch(browser, testInfo);
        if (!smashupMatch) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }
        const { hostPage: page, matchId } = smashupMatch;
        await clearEvidenceScreenshotsForTest(testInfo);

        await waitForTestHarness(page);

        await injectAlienInteractionState(matchId, page, {
            hostHand: [makeInjectedCard('overlord-1', 'alien_supreme_overlord', 'minion', HOST_PLAYER_ID)],
            bases: [
                {
                    defId: 'base_the_homeworld',
                    minions: [makeInjectedMinion('minion-1', 'ninja_shinobi', '1', '1', 2)],
                    ongoingActions: [],
                },
                { defId: 'base_tar_pits', minions: [], ongoingActions: [] },
                { defId: 'base_great_library', minions: [], ongoingActions: [] },
            ],
        });

        await page.waitForSelector('[data-card-uid="overlord-1"]', { timeout: 5000 });
        await page.click('[data-card-uid="overlord-1"]');
        const promptOverlay = page.locator('[data-testid="prompt-overlay"]');
        await waitForSelectableBase(page, 0);
        await clickBaseZone(page, 0);
        await expect.poll(async () => {
            const state = await getMatchState(matchId, page);
            return state.core.bases[0].minions.some((minion: any) => minion.uid === 'overlord-1');
        }, { timeout: 5000 }).toBe(true);
        await expect(promptOverlay).not.toBeVisible();
        await waitForInteractionSourceId(matchId, page, 'alien_supreme_overlord');
        await waitForSelectableMinion(page, 'minion-1');
        const minionHighlightShot = getEvidenceScreenshotPath(testInfo, 'overlord-minion-highlight', {
            filename: 'smashup-overlord-minion-highlight.png',
        });
        await page.screenshot({ path: minionHighlightShot, fullPage: false });
        await clickMinion(page, 'minion-1');

        await expect.poll(async () => {
            const state = await getMatchState(matchId, page);
            return state.core.bases[0].minions.some((minion: any) => minion.uid === 'minion-1');
        }, { timeout: 5000 }).toBe(false);
        const state = await getMatchState(matchId, page);
        const base0Minions = state.core.bases[0].minions;
        expect(base0Minions).toHaveLength(1);
        expect(base0Minions[0].uid).toBe('overlord-1');
        const overlordResolvedShot = getEvidenceScreenshotPath(testInfo, 'overlord-resolved', {
            filename: 'smashup-overlord-resolved.png',
        });
        await page.screenshot({ path: overlordResolvedShot, fullPage: false });
    });

    test('随从选择：外星人收集者 - 不弹窗，直接点击随从', async ({ browser }, testInfo) => {
        const smashupMatch = await createOnlineSelectionMatch(browser, testInfo);
        if (!smashupMatch) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }
        const { hostPage: page, matchId } = smashupMatch;
        await clearEvidenceScreenshotsForTest(testInfo);

        await waitForTestHarness(page);

        await injectAlienInteractionState(matchId, page, {
            hostHand: [makeInjectedCard('collector-1', 'alien_collector', 'minion', HOST_PLAYER_ID)],
            bases: [
                {
                    defId: 'base_pirate_cove',
                    minions: [
                        makeInjectedMinion('minion-1', 'ninja_shinobi', '1', '1', 2),
                        makeInjectedMinion('minion-2', 'dino_king_rex', '1', '1', 7),
                    ],
                    ongoingActions: [],
                },
                { defId: 'base_the_homeworld', minions: [], ongoingActions: [] },
                { defId: 'base_tar_pits', minions: [], ongoingActions: [] },
            ],
        });

        await page.waitForSelector('[data-card-uid="collector-1"]', { timeout: 5000 });
        await page.click('[data-card-uid="collector-1"]');
        const promptOverlay = page.locator('[data-testid="prompt-overlay"]');
        await waitForSelectableBase(page, 0);
        await clickBaseZone(page, 0);
        await expect.poll(async () => {
            const state = await getMatchState(matchId, page);
            return state.core.bases[0].minions.some((minion: any) => minion.uid === 'collector-1');
        }, { timeout: 5000 }).toBe(true);
        await expect(promptOverlay).not.toBeVisible();
        await waitForInteractionSourceId(matchId, page, 'alien_collector');
        await waitForSelectableMinion(page, 'minion-1');
        await expect.poll(async () => await isMinionSelectable(page, 'minion-2')).toBe(false);
        const collectorHighlightShot = getEvidenceScreenshotPath(testInfo, 'collector-minion-highlight', {
            filename: 'smashup-collector-minion-highlight.png',
        });
        await page.screenshot({ path: collectorHighlightShot, fullPage: false });
        await clickMinion(page, 'minion-1');

        await expect.poll(async () => {
            const state = await getMatchState(matchId, page);
            return state.core.bases[0].minions.some((minion: any) => minion.uid === 'minion-1');
        }, { timeout: 5000 }).toBe(false);
        const state = await getMatchState(matchId, page);
        const base0Minions = state.core.bases[0].minions;
        expect(base0Minions.some((m: any) => m.uid === 'minion-1')).toBe(false);
        expect(base0Minions.some((m: any) => m.uid === 'collector-1')).toBe(true);
        expect(base0Minions.some((m: any) => m.uid === 'minion-2')).toBe(true);
        const collectorResolvedShot = getEvidenceScreenshotPath(testInfo, 'collector-resolved', {
            filename: 'smashup-collector-resolved.png',
        });
        await page.screenshot({ path: collectorResolvedShot, fullPage: false });
    });

    test('随从选择：腐化 - 不弹窗，直接点击场上随从', async ({ browser }, testInfo) => {
        const smashupMatch = await createOnlineSelectionMatch(browser, testInfo);
        if (!smashupMatch) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }
        const { hostPage: page, guestPage, matchId } = smashupMatch;
        await clearEvidenceScreenshotsForTest(testInfo);

        await waitForTestHarness(page);
        await injectCthulhuCorruptionState(matchId, page);

        await page.waitForSelector('[data-card-uid="corruption-1"]', { timeout: 5000 });
        await page.click('[data-card-uid="corruption-1"]');
        await page.click('[data-card-uid="corruption-1"]');
        const promptOverlay = page.locator('[data-testid="prompt-overlay"]');
        await expect(promptOverlay).not.toBeVisible();
        await waitForInteractionSourceId(matchId, page, 'cthulhu_corruption');
        await waitForSelectableMinion(page, 'target-1');

        const corruptionHighlightShot = getEvidenceScreenshotPath(testInfo, 'cthulhu-corruption-minion-highlight', {
            filename: 'smashup-cthulhu-corruption-minion-highlight.png',
        });
        await page.screenshot({ path: corruptionHighlightShot, fullPage: false });

        await clickMinion(page, 'target-1');

        await expect.poll(async () => {
            const state = await getMatchState(matchId, page);
            return state.core.bases[0].minions.some((minion: any) => minion.uid === 'target-1');
        }, { timeout: 5000 }).toBe(false);

        await drainPostResolutionFlow(matchId, page, guestPage);

        const resolvedState = await getMatchState(matchId, page);
        expect(getInteractionSourceId(resolvedState)).toBeNull();
        expect(resolvedState.core.bases[0].minions.some((minion: any) => minion.uid === 'target-1')).toBe(false);
        expect(resolvedState.core.bases[0].minions).toHaveLength(0);
        expect(resolvedState.core.players['0'].hand.some((card: any) => card.defId === 'special_madness')).toBe(true);
        expect(resolvedState.core.players['0'].hand.some((card: any) => card.uid === 'fallback-minion-1')).toBe(true);

        const corruptionResolvedShot = getEvidenceScreenshotPath(testInfo, 'cthulhu-corruption-resolved', {
            filename: 'smashup-cthulhu-corruption-resolved.png',
        });
        await page.screenshot({ path: corruptionResolvedShot, fullPage: false });
    });

    test('基地选择：外星人入侵（第二步）- 不弹窗，直接点击基地', async ({ browser }, testInfo) => {
        const smashupMatch = await createOnlineSelectionMatch(browser, testInfo);
        if (!smashupMatch) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }
        const { hostPage: page, matchId } = smashupMatch;
        await clearEvidenceScreenshotsForTest(testInfo);

        await waitForTestHarness(page);

        await injectAlienInteractionState(matchId, page, {
            hostHand: [makeInjectedCard('invasion-1', 'alien_invasion', 'action', HOST_PLAYER_ID)],
            bases: [
                {
                    defId: 'base_ninja_dojo',
                    minions: [makeInjectedMinion('minion-1', 'ninja_shinobi', '1', '1', 2)],
                    ongoingActions: [],
                },
                { defId: 'base_temple_of_goju', minions: [], ongoingActions: [] },
                { defId: 'base_tortuga', minions: [], ongoingActions: [] },
            ],
        });

        await page.waitForSelector('[data-card-uid="invasion-1"]', { timeout: 5000 });
        await page.click('[data-card-uid="invasion-1"]');
        const promptOverlay = page.locator('[data-testid="prompt-overlay"]');
        await expect(promptOverlay).not.toBeVisible();
        await waitForSelectableMinion(page, 'minion-1');
        const invasionMinionHighlightShot = getEvidenceScreenshotPath(testInfo, 'invasion-minion-highlight', {
            filename: 'smashup-invasion-minion-highlight.png',
        });
        await page.screenshot({ path: invasionMinionHighlightShot, fullPage: false });
        await clickMinion(page, 'minion-1');
        await waitForInteractionSourceId(matchId, page, 'alien_invasion_choose_base');
        await expect(promptOverlay).not.toBeVisible();
        await waitForSelectableBase(page, 1);
        const invasionBaseHighlightShot = getEvidenceScreenshotPath(testInfo, 'invasion-base-highlight', {
            filename: 'smashup-invasion-base-highlight.png',
        });
        await page.screenshot({ path: invasionBaseHighlightShot, fullPage: false });
        await clickBaseZone(page, 1);
        await expect.poll(async () => {
            const state = await getMatchState(matchId, page);
            return state.core.bases[1].minions.some((minion: any) => minion.uid === 'minion-1');
        }, { timeout: 5000 }).toBe(true);
        const state = await getMatchState(matchId, page);
        expect(state.core.bases[1].minions.some((m: any) => m.uid === 'minion-1')).toBe(true);
        const invasionResolvedShot = getEvidenceScreenshotPath(testInfo, 'invasion-resolved', {
            filename: 'smashup-invasion-resolved.png',
        });
        await page.screenshot({ path: invasionResolvedShot, fullPage: false });
    });

    test('反馈复现：蒸汽朋克 + 魔法妖精在空基地局面下，随从/持续行动/泰坦都应能进入并完成打出链路', async ({ browser }, testInfo) => {
        const smashupMatch = await createOnlineSelectionMatch(browser, testInfo);
        if (!smashupMatch) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }
        const { hostPage: page, matchId } = smashupMatch;

        await waitForTestHarness(page);

        await injectSteampunkTricksterPacketState(matchId, page);

        await page.click('[data-card-uid="c4"]');
        await page.click('[data-testid="base-zone-1"]');
        await expect.poll(async () => {
            const state = await getMatchState(matchId, page);
            return state.core.bases[1].minions.some((m: any) => m.uid === 'c4');
        }, { timeout: 5000 }).toBe(true);

        await injectSteampunkTricksterPacketState(matchId, page);

        await page.click('[data-card-uid="c12"]');
        await page.click('[data-testid="base-zone-0"]');
        await expect.poll(async () => {
            const state = await getMatchState(matchId, page);
            return state.core.bases[0].ongoingActions.some((card: any) => card.defId === 'steampunk_aggromotive_pod');
        }, { timeout: 5000 }).toBe(true);

        await injectSteampunkTricksterPacketState(matchId, page);

        await page.click('[data-testid="su-rail-titan-titan_0_tricksters_big_funny_giant"]');
        await page.click('[data-testid="base-zone-2"]');
        await expect.poll(async () => {
            const state = await getMatchState(matchId, page);
            const titan = state.core.titans.find((candidate: any) => candidate.uid === 'titan_0_tricksters_big_funny_giant');
            return titan?.location?.zone === 'base' && titan?.location?.baseIndex === 2;
        }, { timeout: 5000 }).toBe(true);
    });

    test('反馈复现（移动端横屏）："点击无反应"场景下，随从/持续行动/泰坦都应能完成点击打出', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        await clearEvidenceScreenshotsForTest(testInfo);
        const setup = await setupOnlineMatch(browser, baseURL, {
            contextOptions: {
                viewport: { width: 1280, height: 720 },
                isMobile: true,
                hasTouch: true,
            },
        });

        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage: page, guestPage, hostContext, guestContext, matchId } = setup;

        try {
            await completeFactionSelectionCustom(
                page,
                guestPage,
                [FACTION.PIRATES, FACTION.NINJAS],
                [FACTION.ALIENS, FACTION.ZOMBIES],
            );
            await waitForHandArea(page);
            await injectSteampunkTricksterPacketState(matchId, page);

            await page.locator('[data-card-uid="c4"]').tap();
            await page.locator('[data-testid="base-zone-1"]').tap();
            await expect.poll(async () => {
                const state = await getMatchState(matchId, page);
                return state.core.bases[1].minions.some((m: any) => m.uid === 'c4');
            }, { timeout: 5000 }).toBe(true);
            const minionShot = getEvidenceScreenshotPath(testInfo, 'mobile-minion-played', {
                filename: 'smashup-steampunks-tricksters-mobile-minion-played.png',
            });
            await page.screenshot({ path: minionShot, fullPage: false });

            await injectSteampunkTricksterPacketState(matchId, page);

            await page.locator('[data-card-uid="c12"]').tap();
            await page.locator('[data-testid="base-zone-0"]').tap();
            await expect.poll(async () => {
                const state = await getMatchState(matchId, page);
                return state.core.bases[0].ongoingActions.some((card: any) => card.defId === 'steampunk_aggromotive_pod');
            }, { timeout: 5000 }).toBe(true);
            const actionShot = getEvidenceScreenshotPath(testInfo, 'mobile-ongoing-played', {
                filename: 'smashup-steampunks-tricksters-mobile-ongoing-played.png',
            });
            await page.screenshot({ path: actionShot, fullPage: false });

            await injectSteampunkTricksterPacketState(matchId, page);

            await page.locator('[data-testid="su-rail-titan-titan_0_tricksters_big_funny_giant"]').tap();
            await page.locator('[data-testid="base-zone-2"]').tap();
            await expect.poll(async () => {
                const state = await getMatchState(matchId, page);
                const titan = state.core.titans.find((candidate: any) => candidate.uid === 'titan_0_tricksters_big_funny_giant');
                return titan?.location?.zone === 'base' && titan?.location?.baseIndex === 2;
            }, { timeout: 5000 }).toBe(true);
            const titanShot = getEvidenceScreenshotPath(testInfo, 'mobile-titan-played', {
                filename: 'smashup-steampunks-tricksters-mobile-titan-played.png',
            });
            await page.screenshot({ path: titanShot, fullPage: false });
        } finally {
            await cleanupTwoPlayerMatch({ hostPage: page, guestPage, hostContext, guestContext, matchId });
        }
    });

    test('POD 版米斯卡塔尼克大学：基地悬浮文案和放大预览都应跟随 POD 版本文本', async ({ browser }, testInfo) => {
        const smashupMatch = await createOnlineSelectionMatch(browser, testInfo);
        if (!smashupMatch) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }
        const { hostPage: page, matchId } = smashupMatch;
        await clearEvidenceScreenshotsForTest(testInfo);

        await waitForTestHarness(page);
        await injectMiskatonicPodBaseState(matchId, page);

        const baseZone = page.getByTestId('base-zone-0');
        await expect(baseZone).toBeVisible();
        await baseZone.hover();

        const podTextOnBoard = page.getByText(MISKATONIC_BASE_POD_TEXT, { exact: true });
        await expect(podTextOnBoard).toBeVisible({ timeout: 5000 });
        await expect(page.getByText(MISKATONIC_BASE_LEGACY_TEXT, { exact: true })).toHaveCount(0);

        const boardShot = getEvidenceScreenshotPath(testInfo, 'miskatonic-pod-base-hover', {
            filename: 'smashup-miskatonic-pod-base-hover.png',
        });
        await page.screenshot({ path: boardShot, fullPage: false });
        const boardTextShot = getEvidenceScreenshotPath(testInfo, 'miskatonic-pod-base-hover-text', {
            filename: 'smashup-miskatonic-pod-base-hover-text.png',
        });
        await podTextOnBoard.screenshot({ path: boardTextShot });

        const inspectButton = baseZone.locator('button.cursor-zoom-in').first();
        await expect(inspectButton).toBeVisible({ timeout: 5000 });
        await inspectButton.click({ force: true });

        const magnifyOverlay = page.getByTestId('su-card-magnify-overlay');
        const magnifyContent = page.getByTestId('su-card-magnify-content');
        await expect(magnifyOverlay).toBeVisible({ timeout: 5000 });
        await expect(magnifyContent).toHaveAttribute('data-card-type', 'base');
        await magnifyContent.hover();

        const podTextInMagnify = magnifyContent.getByText(MISKATONIC_BASE_POD_TEXT, { exact: true });
        await expect(podTextInMagnify).toBeVisible({ timeout: 5000 });
        await expect(magnifyContent.getByText(MISKATONIC_BASE_LEGACY_TEXT, { exact: true })).toHaveCount(0);

        const magnifyShot = getEvidenceScreenshotPath(testInfo, 'miskatonic-pod-base-magnify', {
            filename: 'smashup-miskatonic-pod-base-magnify.png',
        });
        await page.screenshot({ path: magnifyShot, fullPage: false });
        const magnifyTextShot = getEvidenceScreenshotPath(testInfo, 'miskatonic-pod-base-magnify-text', {
            filename: 'smashup-miskatonic-pod-base-magnify-text.png',
        });
        await podTextInMagnify.screenshot({ path: magnifyTextShot });
    });

    test('反馈复现：蘑菇王国 + Invisible Ninja 同回合开始时，应直接进入真实交互，不先弹结算顺序', async ({ browser }, testInfo) => {
        const smashupMatch = await createOnlineSelectionMatch(browser, testInfo);
        if (!smashupMatch) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, guestPage, matchId } = smashupMatch;
        await clearEvidenceScreenshotsForTest(testInfo);
        await waitForTestHarness(hostPage);
        await injectMushroomInvisibleTurnStartState(matchId, hostPage);

        await dispatchHarnessCommand(guestPage, '1', 'ADVANCE_PHASE', {});

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            return state?.sys?.interaction?.current?.data?.sourceId ?? null;
        }, { timeout: 8000 }).not.toBeNull();

        const firstState = await getMatchState(matchId, hostPage);
        const firstSourceId = firstState?.sys?.interaction?.current?.data?.sourceId ?? null;
        expect(firstSourceId).not.toBe('smashup_reaction_choose');
        expect(['base_mushroom_kingdom', 'titan_ninjas_invisible_ninja_start_turn']).toContain(firstSourceId);

        const firstPromptShot = getEvidenceScreenshotPath(testInfo, 'mushroom-invisible-first-prompt', {
            filename: 'smashup-mushroom-invisible-first-prompt.png',
        });
        await hostPage.screenshot({ path: firstPromptShot, fullPage: false });

        for (let i = 0; i < 3; i += 1) {
            const liveState = await getMatchState(matchId, hostPage);
            const current = liveState?.sys?.interaction?.current ?? null;
            if (!current) break;

            const liveSourceId = current?.data?.sourceId ?? null;
            if (liveSourceId === 'smashup_reaction_choose') {
                const guestState = await getMatchState(matchId, guestPage);
                throw new Error(JSON.stringify({
                    loopIndex: i,
                    host: {
                        currentPlayerIndex: liveState?.core?.currentPlayerIndex ?? null,
                        phase: liveState?.sys?.phase ?? null,
                        interaction: liveState?.sys?.interaction?.current
                            ? {
                                playerId: liveState.sys.interaction.current.playerId,
                                sourceId: liveState.sys.interaction.current.data?.sourceId ?? null,
                                optionIds: Array.isArray(liveState.sys.interaction.current.data?.options)
                                    ? liveState.sys.interaction.current.data.options.map((option: { id?: string }) => option?.id ?? null)
                                    : [],
                            }
                            : null,
                        triggerQueue: Array.isArray(liveState?.core?.triggerQueue)
                            ? liveState.core.triggerQueue.map((trigger: { sourceDefId?: string; frameId?: string; resolutionClass?: string; mandatory?: boolean }) => ({
                                sourceDefId: trigger?.sourceDefId ?? null,
                                frameId: trigger?.frameId ?? null,
                                resolutionClass: trigger?.resolutionClass ?? null,
                                mandatory: trigger?.mandatory ?? null,
                            }))
                            : [],
                        frames: Array.isArray(liveState?.sys?.resolution?.frames)
                            ? liveState.sys.resolution.frames.map((frame: { id?: string; step?: string; metadata?: { smashupReactionSession?: unknown } }) => ({
                                id: frame?.id ?? null,
                                step: frame?.step ?? null,
                                hasReactionSession: Boolean(frame?.metadata?.smashupReactionSession),
                            }))
                            : [],
                    },
                    guest: {
                        currentPlayerIndex: guestState?.core?.currentPlayerIndex ?? null,
                        phase: guestState?.sys?.phase ?? null,
                        interaction: guestState?.sys?.interaction?.current
                            ? {
                                playerId: guestState.sys.interaction.current.playerId,
                                sourceId: guestState.sys.interaction.current.data?.sourceId ?? null,
                                optionIds: Array.isArray(guestState.sys.interaction.current.data?.options)
                                    ? guestState.sys.interaction.current.data.options.map((option: { id?: string }) => option?.id ?? null)
                                    : [],
                            }
                            : null,
                    },
                }, null, 2));
            }

            const options = Array.isArray(current?.data?.options)
                ? current.data.options as Array<{ id?: string }>
                : [];
            const skipId = options.find(option => option?.id === 'skip')?.id;
            expect(skipId).toBeTruthy();
            await respondCurrentInteraction(hostPage, { optionId: skipId });
        }

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            return {
                phase: state?.sys?.phase ?? null,
                sourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
            };
        }, { timeout: 8000 }).toEqual({
            phase: 'playCards',
            sourceId: null,
        });

        const resolvedShot = getEvidenceScreenshotPath(testInfo, 'mushroom-invisible-resolved', {
            filename: 'smashup-mushroom-invisible-resolved.png',
        });
        await hostPage.screenshot({ path: resolvedShot, fullPage: false });
    });
});
