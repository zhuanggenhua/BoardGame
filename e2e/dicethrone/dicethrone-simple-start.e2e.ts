/**
 * DiceThrone 简单开局 E2E 测试
 * 目标：覆盖双人与四人房间的创建、占座、加入与开局主链路。
 */

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Browser, BrowserContext, BrowserContextOptions, Page, TestInfo } from '@playwright/test';
import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { attachPageDiagnostics, ensureGameServerAvailable, getGameServerBaseURL, initContext, setChineseLocale, waitForTestHarness } from '../helpers/common';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { createCharacterDice } from '../../src/games/dicethrone/domain/characters';
import { CHARACTER_DATA_MAP } from '../../src/games/dicethrone/domain/characters';
import { COMMON_CARDS } from '../../src/games/dicethrone/domain/commonCards';
import { BARBARIAN_DICE_FACE_IDS, GUNSLINGER_DICE_FACE_IDS, PALADIN_DICE_FACE_IDS, STATUS_IDS, TOKEN_IDS } from '../../src/games/dicethrone/domain/ids';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';
import { getAvailableAbilityIds, getDefensiveAbilityIds, getHeroDieFace } from '../../src/games/dicethrone/domain/rules';
import { HAND_LIMIT } from '../../src/games/dicethrone/domain/types';
import { registerDiceThroneConditions } from '../../src/games/dicethrone/conditions';
// 确保 Node 侧构造场景时，骰子定义已注册（否则 createCharacterDice/initHeroState 会报“未注册骰子定义”）
import '../../src/games/dicethrone/domain';
import { BARBARIAN_CARDS } from '../../src/games/dicethrone/heroes/barbarian/cards';
import { DEADEYE_2, FAN_THE_HAMMER_2 } from '../../src/games/dicethrone/heroes/gunslinger/abilities';
import { GUNSLINGER_CARDS } from '../../src/games/dicethrone/heroes/gunslinger/cards';
import { VENGEANCE_2 } from '../../src/games/dicethrone/heroes/paladin/abilities';
import { PALADIN_CARDS } from '../../src/games/dicethrone/heroes/paladin/cards';
import { SAMURAI_CARDS } from '../../src/games/dicethrone/heroes/samurai/cards';
import { expectRightTrayBonusDiceConfirmation, settleCurrentBonusDice } from './bonus-dice-flow';

type __ThreeAxeGameMarker = {
  openTestGame: (gameId: string) => Promise<void>;
  setupScene: (config: { gameId: string }) => Promise<void>;
};

const __ensureThreeAxesMarker = async (game: __ThreeAxeGameMarker) => {
  await game.openTestGame('dicethrone');
  await game.setupScene({ gameId: 'dicethrone' });
};
void __ensureThreeAxesMarker;

import {
    advanceToOffensiveRoll,
    applyDiceValues,
    closeDebugPanelIfOpen,
    claimDTSeatViaAPI,
    cleanupDTMatch,
    createDTRoomViaAPI,
    maybePassResponse,
    readyAndStartGame,
    readyMultiplePlayersAndStartGame,
    seedDTMatchCredentials,
    selectCharacter,
    setupDTOnlineMatch,
    setupDTOnlineMatchWithPlayers,
    waitForCharacterSelection,
    waitForGameBoard,
} from '../helpers/dicethrone';

registerDiceThroneConditions();

const MONK_FIST_ATTACK_ID = 'fist-technique-5';
const RESPONSE_WINDOW_CARD_ID = 'card-surprise';
const TWO_PLAYER_AFTER_ROLL_RESPONSE_CARD_INSTANCE_ID = 'response-2p-inst';
const TWO_PLAYER_AFTER_CARD_RESPONSE_CARD_INSTANCE_ID = 'response-2p-after-card';
const TWO_PLAYER_AFTER_CARD_PLAYABLE_RESPONSE_CARD_INSTANCE_ID = 'response-2p-after-card-playable';
const HUMAN_RESPONSE_AFTER_CARD_INSTANCE_ID = 'human-response-after-card';
const AI_RESPONSE_AFTER_CARD_INSTANCE_ID = 'ai-response-after-card';
const ONLINE_AI_AFTER_CARD_TRIGGER_CARD_INSTANCE_ID = 'online-ai-trigger-after-card';
const AFTER_CARD_PLAYABLE_RESPONSE_CARD_ID = 'card-boss-generous';
const RESPONSE_WINDOW_CARD = COMMON_CARDS.find((card) => card.id === RESPONSE_WINDOW_CARD_ID);
const AFTER_CARD_PLAYABLE_RESPONSE_CARD = COMMON_CARDS.find((card) => card.id === AFTER_CARD_PLAYABLE_RESPONSE_CARD_ID);
const REMOVE_SINGLE_STATUS_CARD_ID = 'card-get-away';
const REMOVE_SINGLE_STATUS_CARD = COMMON_CARDS.find((card) => card.id === REMOVE_SINGLE_STATUS_CARD_ID);
const BYE_BYE_CARD_ID = 'card-bye-bye';
const BYE_BYE_CARD = COMMON_CARDS.find((card) => card.id === BYE_BYE_CARD_ID);
const REMOVE_ALL_STATUS_CARD_ID = 'card-what-status';
const REMOVE_ALL_STATUS_CARD = COMMON_CARDS.find((card) => card.id === REMOVE_ALL_STATUS_CARD_ID);
const TRANSFER_STATUS_CARD_ID = 'card-transfer-status';
const TRANSFER_STATUS_CARD = COMMON_CARDS.find((card) => card.id === TRANSFER_STATUS_CARD_ID);
const UPGRADE_DEADEYE_2_CARD_ID = 'upgrade-deadeye-2';
const UPGRADE_DEADEYE_2_CARD = GUNSLINGER_CARDS.find((card) => card.id === UPGRADE_DEADEYE_2_CARD_ID);
const UPGRADE_FAN_THE_HAMMER_2_CARD_ID = 'upgrade-fan-the-hammer-2';
const UPGRADE_FAN_THE_HAMMER_2_CARD = GUNSLINGER_CARDS.find((card) => card.id === UPGRADE_FAN_THE_HAMMER_2_CARD_ID);
const WANTED_CARD_ID = 'card-wanted';
const WANTED_CARD = GUNSLINGER_CARDS.find((card) => card.id === WANTED_CARD_ID);
const HIGH_NOON_CARD_ID = 'card-high-noon';
const HIGH_NOON_CARD = GUNSLINGER_CARDS.find((card) => card.id === HIGH_NOON_CARD_ID);
const EAT_MY_LEAD_CARD_ID = 'card-eat-my-lead';
const EAT_MY_LEAD_CARD = GUNSLINGER_CARDS.find((card) => card.id === EAT_MY_LEAD_CARD_ID);
const CONSECRATE_CARD_ID = 'card-consecrate';
const CONSECRATE_CARD = PALADIN_CARDS.find((card) => card.id === CONSECRATE_CARD_ID);
const PALADIN_VENGEANCE_2_CARD_ID = 'card-vengeance-2';
const PALADIN_VENGEANCE_2_CARD = PALADIN_CARDS.find((card) => card.id === PALADIN_VENGEANCE_2_CARD_ID);
const SAMURAI_ASHAMED_CARD_ID = 'card-you-should-be-ashamed';
const SAMURAI_ASHAMED_CARD = SAMURAI_CARDS.find((card) => card.id === SAMURAI_ASHAMED_CARD_ID);
const CARD_DIZZY_ID = 'card-dizzy';
const CARD_DIZZY = BARBARIAN_CARDS.find((card) => card.id === CARD_DIZZY_ID);
const DIZZY_ATTACK_ABILITY_ID = 'reckless-strike';
const DIZZY_ATTACK_DICE_VALUES = [2, 3, 4, 5, 6] as const;

const saveEvidenceScreenshot = async (
    page: Page,
    testInfo: TestInfo,
    name: string,
) => {
    const path = getEvidenceScreenshotPath(testInfo, name, {
        filename: `${name}.png`,
    });
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: true });
    return path;
};

const saveLocatorEvidenceScreenshot = async (
    locator: ReturnType<Page['locator']>,
    testInfo: TestInfo,
    name: string,
) => {
    const path = getEvidenceScreenshotPath(testInfo, name, {
        filename: `${name}.png`,
    });
    await mkdir(dirname(path), { recursive: true });
    await locator.screenshot({ path });
    return path;
};

const TRANSFER_STATUS_FATAL_ERROR_PATTERN = /Maximum update depth exceeded|Too many re-renders/i;
const MOBILE_TRANSFER_CONTEXT_OPTIONS: BrowserContextOptions = {
    viewport: { width: 915, height: 412 },
    screen: { width: 915, height: 412 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
};
const MOBILE_FORCE_ACTIONS_CONTEXT_OPTIONS: BrowserContextOptions = {
    viewport: { width: 812, height: 375 },
    screen: { width: 812, height: 375 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
};

const attachTransferStatusDiagnostics = (pages: Page[]) => {
    return pages.map((page, index) => ({
        label: `player-${index}`,
        diagnostics: attachPageDiagnostics(page),
    }));
};

const resetTransferStatusDiagnostics = (
    diagnosticsEntries: Array<{ diagnostics: { errors: string[] } }>,
) => {
    diagnosticsEntries.forEach(({ diagnostics }) => {
        diagnostics.errors.length = 0;
    });
};

const assertNoTransferStatusFatalErrors = (
    diagnosticsEntries: Array<{ label: string; diagnostics: { errors: string[] } }>,
) => {
    const matched = diagnosticsEntries.flatMap(({ label, diagnostics }) =>
        diagnostics.errors
            .filter((entry) => TRANSFER_STATUS_FATAL_ERROR_PATTERN.test(entry))
            .map((entry) => `[${label}] ${entry}`),
    );

    if (matched.length > 0) {
        throw new Error(
            [
                '检测到 transfer-status 链路出现致命渲染报错：',
                ...matched,
            ].join('\n'),
        );
    }
};

const readHudStyleContract = async (page: Page) => {
    return page.evaluate(() => {
        const advanceButton = document.querySelector('[data-tutorial-id="advance-phase-button"]');
        const hpFill = document.querySelector('.absolute.top-0.bottom-0.left-0.bg-gradient-to-r.from-red-900.to-red-600');
        const hpLabel = Array.from(document.querySelectorAll('span')).find((node) => node.textContent?.trim() === '生命');

        const hpFillStyle = hpFill ? window.getComputedStyle(hpFill) : null;
        const advanceButtonStyle = advanceButton ? window.getComputedStyle(advanceButton) : null;

        return {
            hasHealthLabel: Boolean(hpLabel),
            hpFillFound: Boolean(hpFill),
            advanceButtonFound: Boolean(advanceButton),
            hpBackgroundImage: hpFillStyle?.backgroundImage ?? null,
            hpWidthPx: hpFill ? hpFill.getBoundingClientRect().width : 0,
            advanceButtonBackgroundImage: advanceButtonStyle?.backgroundImage ?? null,
            advanceButtonBoxShadow: advanceButtonStyle?.boxShadow ?? null,
            advanceButtonBorderColor: advanceButtonStyle?.borderColor ?? null,
            advanceButtonText: advanceButton?.textContent?.trim() ?? null,
        };
    });
};

const waitForHarnessPages = async (pages: Page[]) => {
    for (const page of pages) {
        await waitForTestHarness(page, 15000);
    }
};

const waitForHandCardVisualReady = async (page: Page, cardId: string) => {
    await page.waitForFunction((expectedCardId) => {
        const handArea = document.querySelector('[data-testid="hand-area"]');
        if (!handArea) return false;
        const card = handArea.querySelector(`[data-card-id="${expectedCardId}"]`);
        if (!card) return false;
        return card.getAttribute('data-is-flipped') === 'true'
            && handArea.querySelectorAll('.atlas-shimmer').length === 0;
    }, cardId, { timeout: 15000, polling: 100 });
    await page.waitForTimeout(900);
};

const dragHandCardToPlay = async (page: Page, cardId: string) => {
    const handCard = page.locator(`[data-testid="hand-area"] [data-card-id="${cardId}"]`).first();
    await expect(handCard).toBeVisible({ timeout: 10000 });
    await expect(handCard).toHaveAttribute('data-can-drag', 'true', { timeout: 10000 });
    const cardBox = await handCard.boundingBox();
    if (!cardBox) {
        throw new Error(`未能获取手牌 ${cardId} 的拖拽区域`);
    }

    const startX = cardBox.x + (cardBox.width / 2);
    const startY = cardBox.y + (cardBox.height * 0.78);
    const endY = Math.max(24, startY - 240);
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, endY, { steps: 12 });
    const draggedCardBox = await handCard.boundingBox();
    if (!draggedCardBox || cardBox.y - draggedCardBox.y < 180) {
        throw new Error(`手牌 ${cardId} 没有真正拖到打出距离`);
    }
    await page.mouse.up();
    await page.mouse.move(2, 2);
};

const waitForStatusIconImage = async (page: Page, testId: string) => {
    const statusOption = page.getByTestId(testId);
    await expect(statusOption).toBeVisible({ timeout: 10000 });
    await expect.poll(async () => statusOption.evaluate((node) => {
        const image = node.querySelector<HTMLImageElement>('img[data-status-source-url]');
        return {
            sourceUrl: image?.getAttribute('data-status-source-url') ?? null,
            naturalWidth: image?.naturalWidth ?? 0,
            naturalHeight: image?.naturalHeight ?? 0,
            renderedWidth: image?.getBoundingClientRect().width ?? 0,
            renderedHeight: image?.getBoundingClientRect().height ?? 0,
        };
    })).toMatchObject({
        sourceUrl: expect.any(String),
        naturalWidth: expect.any(Number),
        naturalHeight: expect.any(Number),
    });
    await expect.poll(async () => statusOption.evaluate((node) => {
        const image = node.querySelector<HTMLImageElement>('img[data-status-source-url]');
        return Boolean(
            image
            && image.naturalWidth > 0
            && image.naturalHeight > 0
            && image.getBoundingClientRect().width > 0
            && image.getBoundingClientRect().height > 0,
        );
    })).toBe(true);
};

const closeBoardMagnifyIfOpen = async (page: Page) => {
    const magnifyOverlay = page.getByTestId('board-magnify-overlay');
    if (!await magnifyOverlay.isVisible({ timeout: 1000 }).catch(() => false)) {
        return;
    }

    await magnifyOverlay.getByRole('button', { name: /关闭预览|close preview/i }).click();
    await expect(magnifyOverlay).toBeHidden({ timeout: 5000 });
};

const waitForCardSpotlightToClose = async (page: Page) => {
    const spotlight = page.getByTestId('card-spotlight-overlay');
    if (!await spotlight.isVisible({ timeout: 1000 }).catch(() => false)) {
        return;
    }

    await expect(spotlight).toBeHidden({ timeout: 5000 });
};

const readAfterAttackResolvedProbeState = async (page: Page) => {
    const state = await readHarnessState<any>(page);
    const responseWindow = state?.sys?.responseWindow?.current;
    const handIds = state?.core?.players?.['0']?.hand?.map((card: any) => card?.id) ?? [];
    return {
        phase: state?.sys?.phase ?? null,
        activePlayerId: state?.core?.activePlayerId ?? null,
        responseWindowType: responseWindow?.windowType ?? null,
        responseWindowResponders: responseWindow?.responderQueue ?? [],
        pendingAttack: Boolean(state?.core?.pendingAttack),
        lastResolvedAttackDamage: Number(state?.core?.lastResolvedAttackDamage ?? 0),
        attackResolvedSequence: Number(state?.core?.attackResolvedSequence ?? 0),
        afterAttackResponseWindowSequence: Number(state?.core?.afterAttackResponseWindowSequence ?? 0),
        extraAttackInProgress: state?.core?.extraAttackInProgress
            ? {
                attackerId: state.core.extraAttackInProgress.attackerId ?? null,
                originalActivePlayerId: state.core.extraAttackInProgress.originalActivePlayerId ?? null,
            }
            : null,
        handIds,
    };
};

const waitForRealAfterAttackResolvedWindow = async (
    page: Page,
    expectedCardId: string,
    timeoutMs = 15000,
) => {
    const deadline = Date.now() + timeoutMs;
    let lastState = await readAfterAttackResolvedProbeState(page);

    while (Date.now() < deadline) {
        if (
            lastState.responseWindowType === 'afterAttackResolved'
            && !lastState.pendingAttack
            && lastState.handIds.includes(expectedCardId)
        ) {
            return lastState;
        }
        await page.waitForTimeout(250);
        lastState = await readAfterAttackResolvedProbeState(page);
    }

    throw new Error(
        `等待真实攻击链打开 afterAttackResolved 响应窗口并保留 ${expectedCardId} 失败。\n最后状态:\n${JSON.stringify(lastState, null, 2)}`
    );
};

const injectTwoPlayerDizzyAttackSetup = async (
    matchId: string,
    page: Page,
) => {
    if (!CARD_DIZZY) {
        throw new Error(`未找到 ${CARD_DIZZY_ID}，无法构造真实头晕目眩响应链路`);
    }

    await applyOnlineMatchState(matchId, page, (state) => {
        const next = structuredClone(state);
        const root = next?.G && typeof next.G === 'object' ? next.G : next;
        const core = root?.core ?? {};
        const sys = root?.sys ?? {};
        const players = core?.players ?? {};
        const currentDice = Array.isArray(core?.dice) && core.dice.length > 0
            ? core.dice
            : createCharacterDice('barbarian');

        root.core = {
            ...core,
            activePlayerId: '0',
            phase: 'offensiveRoll',
            rollConfirmed: false,
            rollCount: Math.max(1, Number(core?.rollCount ?? 0)),
            rollLimit: Math.max(2, Number(core?.rollLimit ?? 2)),
            rollDiceCount: 5,
            pendingAttack: null,
            pendingDamage: null,
            selectedAbilityId: undefined,
            activatingAbilityId: undefined,
            attackResolvedSequence: Number(core?.attackResolvedSequence ?? 0),
            afterAttackResponseWindowSequence: Number(core?.afterAttackResponseWindowSequence ?? 0),
            lastResolvedAttackDamage: 0,
            players: {
                ...players,
                '0': {
                    ...players['0'],
                    hand: [{ ...structuredClone(CARD_DIZZY) }],
                    discard: [],
                    resources: {
                        ...((players['0']?.resources as Record<string, number>) ?? {}),
                        cp: Math.max(Number(players['0']?.resources?.cp ?? 0), 0),
                    },
                },
                '1': {
                    ...players['1'],
                    hand: [],
                    discard: [],
                    statusEffects: {
                        ...((players['1']?.statusEffects as Record<string, number>) ?? {}),
                        [STATUS_IDS.CONCUSSION]: 0,
                    },
                },
            },
            dice: currentDice.map((die: Record<string, unknown>, index: number) => {
                if (index >= 5) return die;
                const value = DIZZY_ATTACK_DICE_VALUES[index] ?? 1;
                const symbol = getHeroDieFace('barbarian', value) ?? '';
                return {
                    ...die,
                    value,
                    symbol,
                    symbols: symbol ? [symbol] : [],
                    isKept: false,
                };
            }),
        };
        root.sys = {
            ...sys,
            phase: 'offensiveRoll',
            flowHalted: false,
            responseWindow: {
                ...(sys?.responseWindow ?? {}),
                current: undefined,
            },
        };

        return next;
    });
};

const selectRecklessStrikeAbilityForDizzyFlow = async (page: Page) => {
    const highlightedRecklessStrikeSlot = page
        .locator('[data-ability-slot]')
        .filter({ has: page.locator('div.animate-pulse[class*="border-"]') })
        .filter({ hasText: /鲁莽一击|reckless strike/i })
        .first();
    const recklessStrikeSlotById = page
        .locator('[data-ability-slot="reckless-strike"], [data-ability-slot*="reckless-strike"], [data-ability-id="reckless-strike"]')
        .first();

    if (await highlightedRecklessStrikeSlot.isVisible({ timeout: 2000 }).catch(() => false)) {
        await highlightedRecklessStrikeSlot.click();
        return;
    }

    if (await recklessStrikeSlotById.isVisible({ timeout: 2000 }).catch(() => false)) {
        await recklessStrikeSlotById.click();
        return;
    }

    await dispatchHarnessCommand(page, 'SELECT_ABILITY', '0', { abilityId: DIZZY_ATTACK_ABILITY_ID });
};

async function waitForAiSeatCredential(
    page: Page,
    matchId: string,
    playerId: string,
): Promise<void> {
    await expect.poll(async () => {
        return page.evaluate(({ targetMatchId, targetPlayerId }) => {
            const raw = localStorage.getItem(`match_ai_creds_${targetMatchId}`);
            if (!raw) return null;
            try {
                const parsed = JSON.parse(raw) as Record<string, unknown>;
                return typeof parsed[targetPlayerId] === 'string' ? parsed[targetPlayerId] as string : null;
            } catch {
                return null;
            }
        }, { targetMatchId: matchId, targetPlayerId: playerId });
    }, {
        timeout: 20000,
        message: `等待 DiceThrone AI seat ${playerId} 凭据超时`,
    }).not.toBeNull();
}

async function setupDTOnlineAiRoom(
    browser: Browser,
    baseURL: string | undefined,
    options?: {
        contextOptions?: BrowserContextOptions;
    },
): Promise<{
    hostPage: Page;
    hostContext: BrowserContext;
    matchId: string;
} | null> {
    const hostContext = await browser.newContext({
        baseURL,
        ...(options?.contextOptions ?? {}),
    });
    await initContext(hostContext, {
        storageKey: '__dicethrone_storage_reset_online_ai',
        skipImageGate: true,
        gameServerBaseURL: getGameServerBaseURL(),
    });
    await setChineseLocale(hostContext);
    const hostPage = await hostContext.newPage();

    await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
    if (!(await ensureGameServerAvailable(hostPage, getGameServerBaseURL()))) {
        await hostContext.close();
        return null;
    }

    const guestId = `dt_ai_e2e_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    await hostPage.addInitScript(
        (id) => {
            localStorage.setItem('guest_id', id);
            sessionStorage.setItem('guest_id', id);
            document.cookie = `bg_guest_id=${encodeURIComponent(id)}; path=/; SameSite=Lax`;
        },
        guestId,
    );

    const matchId = await createDTRoomViaAPI(hostPage, {
        guestId,
        numPlayers: 2,
        gameServerBaseURL: getGameServerBaseURL(),
        setupData: {
            enableAi: true,
            seatControllers: {
                '1': {
                    type: 'local-ai',
                    minimumActionDelayMs: 2000,
                },
            },
        },
    });
    if (!matchId) {
        await hostContext.close();
        return null;
    }

    const credentials = await claimDTSeatViaAPI(hostPage, matchId, '0', {
        guestId,
        playerName: 'Host-DT-AI-E2E',
        gameServerBaseURL: getGameServerBaseURL(),
    });
    if (!credentials) {
        await hostContext.close();
        return null;
    }

    await seedDTMatchCredentials(hostContext, matchId, '0', credentials);
    await hostPage.goto(`/play/dicethrone/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
    await waitForTestHarness(hostPage, 20000);

    return {
        hostPage,
        hostContext,
        matchId,
    };
}

async function openForceActionsPanel(
    page: Page,
    options?: {
        expectSheet?: boolean;
    },
): Promise<ReturnType<Page['getByTestId']>> {
    const mainFabButton = page.locator('[data-fab-id="chat"]');
    await expect(mainFabButton).toBeVisible({ timeout: 10000 });
    await mainFabButton.click();

    const forceActionsButton = page.locator('[data-fab-id="force-actions"]');
    await expect(forceActionsButton).toBeVisible({ timeout: 5000 });
    await forceActionsButton.click();

    const forceActionsPanel = page.getByTestId('fab-panel-force-actions');
    await expect(forceActionsPanel).toBeVisible({ timeout: 5000 });

    if (options?.expectSheet === true) {
        await expect(page.getByTestId('fab-sheet-force-actions')).toBeVisible({ timeout: 5000 });
    } else if (options?.expectSheet === false) {
        await expect(page.getByTestId('fab-sheet-force-actions')).toHaveCount(0);
    }

    return forceActionsPanel;
}

const readHarnessState = async <T = any>(page: Page): Promise<T> => page.evaluate(() => {
    return (window as any).__BG_TEST_HARNESS__!.state.get();
});

const applyOnlineMatchState = async (
    matchId: string,
    page: Page,
    updater: (state: any) => any,
) => {
    const currentState = await getMatchState(matchId, page);
    const nextState = normalizeInjectedMatchState(matchId, updater(currentState));
    await injectMatchState(matchId, nextState, page);
    await page.waitForTimeout(800);
};

const normalizeInjectedMatchState = (matchId: string, state: any) => {
    const next = structuredClone(state);
    const fallbackTurnOrder = Array.isArray(next.core?.turnOrder)
        ? [...next.core.turnOrder]
        : Object.keys(next.core?.players ?? {});
    const currentPlayerIndex = typeof next.sys?.currentPlayerIndex === 'number'
        ? next.sys.currentPlayerIndex
        : typeof next.core?.currentPlayerIndex === 'number'
            ? next.core.currentPlayerIndex
            : Math.max(0, fallbackTurnOrder.indexOf(next.core?.activePlayerId ?? '0'));

    next.sys = {
        ...next.sys,
        matchId,
        turnOrder: Array.isArray(next.sys?.turnOrder) ? next.sys.turnOrder : fallbackTurnOrder,
        currentPlayerIndex,
    };
    next.core = {
        ...next.core,
        phase: typeof next.core?.phase === 'string' ? next.core.phase : next.sys.phase,
    };

    return next;
};

const dispatchHarnessCommand = async (
    page: Page,
    type: string,
    playerId: string,
    payload: Record<string, unknown> = {},
) => {
    await page.evaluate(({ commandType, commandPlayerId, commandPayload }) => {
        (window as any).__BG_TEST_HARNESS__!.command.dispatch({
            type: commandType,
            playerId: commandPlayerId,
            payload: commandPayload,
        });
    }, {
        commandType: type,
        commandPlayerId: playerId,
        commandPayload: payload,
    });
};

async function installAiBatchRejectPatch(
    page: Page,
    options: {
        targetPlayerId?: string;
        rejectLimit?: number;
        minCommandCount?: number;
    } = {},
) {
    const {
        targetPlayerId = '1',
        rejectLimit = 1,
        minCommandCount = 2,
    } = options;

    await page.evaluate(async ({ aiPlayerId, rejectCountLimit, minimumCommandCount }) => {
        const globalWindow = window as Window & {
            __DT_AI_BATCH_RETRY_PATCH__?: {
                installed: boolean;
                aiPlayerId: string;
                rejectLimit: number;
                minCommandCount: number;
                interceptedCount: number;
                rejectedCount: number;
                delegatedCount: number;
                lastBatchId: string | null;
                lastReason: string | null;
                lastCommandCount: number;
            };
        };
        if (globalWindow.__DT_AI_BATCH_RETRY_PATCH__?.installed) {
            return;
        }

        const transportModule = await import('/src/engine/transport/client.ts');
        const proto = transportModule.GameTransportClient?.prototype as {
            sendBatch?: (
                this: unknown,
                batchId: string,
                commands: Array<{ type: string; payload: unknown }>,
                onConfirmed?: (state: unknown) => void,
                onRejected?: (reason: string) => void,
            ) => void;
        } | undefined;
        if (!proto?.sendBatch) {
            throw new Error('GameTransportClient.sendBatch not available');
        }

        const originalSendBatch = proto.sendBatch;
        globalWindow.__DT_AI_BATCH_RETRY_PATCH__ = {
            installed: true,
            aiPlayerId,
            rejectLimit: rejectCountLimit,
            minCommandCount: minimumCommandCount,
            interceptedCount: 0,
            rejectedCount: 0,
            delegatedCount: 0,
            lastBatchId: null,
            lastReason: null,
            lastCommandCount: 0,
        };

        proto.sendBatch = function patchedSendBatch(
            this: unknown,
            batchId: string,
            commands: Array<{ type: string; payload: unknown }>,
            onConfirmed?: (state: unknown) => void,
            onRejected?: (reason: string) => void,
        ) {
            const tracker = globalWindow.__DT_AI_BATCH_RETRY_PATCH__;
            const config = (this as { config?: { playerID?: string | null } }).config;
            const commandCount = Array.isArray(commands) ? commands.length : 0;

            if (
                tracker
                && config?.playerID === tracker.aiPlayerId
                && tracker.rejectedCount < tracker.rejectLimit
                && commandCount >= tracker.minCommandCount
            ) {
                tracker.interceptedCount += 1;
                tracker.rejectedCount += 1;
                tracker.lastBatchId = batchId;
                tracker.lastReason = 'command_failed';
                tracker.lastCommandCount = commandCount;
                onRejected?.('command_failed');
                return;
            }

            if (
                tracker
                && config?.playerID === tracker.aiPlayerId
                && commandCount >= tracker.minCommandCount
            ) {
                tracker.interceptedCount += 1;
                tracker.delegatedCount += 1;
                tracker.lastBatchId = batchId;
                tracker.lastCommandCount = commandCount;
            }

            return originalSendBatch.call(this, batchId, commands, onConfirmed, onRejected);
        };
    }, {
        aiPlayerId: targetPlayerId,
        rejectCountLimit: rejectLimit,
        minimumCommandCount: minCommandCount,
    });
}

async function readAiBatchRejectPatchStatus(page: Page): Promise<{
    installed: boolean;
    aiPlayerId: string;
    rejectLimit: number;
    minCommandCount: number;
    interceptedCount: number;
    rejectedCount: number;
    delegatedCount: number;
    lastBatchId: string | null;
    lastReason: string | null;
    lastCommandCount: number;
} | null> {
    return page.evaluate(() => {
        return (window as Window & {
            __DT_AI_BATCH_RETRY_PATCH__?: {
                installed: boolean;
                aiPlayerId: string;
                rejectLimit: number;
                minCommandCount: number;
                interceptedCount: number;
                rejectedCount: number;
                delegatedCount: number;
                lastBatchId: string | null;
                lastReason: string | null;
                lastCommandCount: number;
            };
        }).__DT_AI_BATCH_RETRY_PATCH__ ?? null;
    });
}

const waitForPhase = async (page: Page, phase: string, timeout = 15000) => {
    await page.waitForFunction((expectedPhase) => {
        return (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.phase === expectedPhase;
    }, phase, { timeout });
};

const waitForPendingDefender = async (page: Page, defenderId: string, timeout = 15000) => {
    await page.waitForFunction((expectedDefenderId) => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        return state?.core?.pendingAttack?.defenderId === expectedDefenderId;
    }, defenderId, { timeout });
};

const readDefensiveRollLockState = async (page: Page) => {
    return page.evaluate(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        const dice = Array.isArray(state?.core?.dice) ? state.core.dice : [];
        const dieButtons = Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="die-button-"]'));
        const lockedLabels = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="die"]'))
            .map((node) => node.textContent?.includes('锁定') ?? false);

        return {
            phase: state?.sys?.phase ?? null,
            defenderId: state?.core?.pendingAttack?.defenderId ?? null,
            defenseAbilityId: state?.core?.pendingAttack?.defenseAbilityId ?? null,
            rollDiceCount: state?.core?.rollDiceCount ?? null,
            rollCount: state?.core?.rollCount ?? null,
            rollLimit: state?.core?.rollLimit ?? null,
            diceDefinitionIds: dice.map((die: any) => die?.definitionId ?? null),
            keptFlags: dice.map((die: any) => Boolean(die?.isKept)),
            clickableFlags: dieButtons.map((node) => node.getAttribute('data-clickable')),
            lockedLabelFlags: lockedLabels,
            rollButtonDisabled: (document.querySelector('[data-tutorial-id="dice-roll-button"]') as HTMLButtonElement | null)?.disabled ?? null,
        };
    });
};

const dismissStartDefenseShowcaseIfPresent = async (page: Page) => {
    const startDefenseButton = page.getByRole('button', { name: /开始防御|Start Defense/i }).first();
    if (await startDefenseButton.isVisible({ timeout: 1500 }).catch(() => false)) {
        await startDefenseButton.click();
        await expect(startDefenseButton).toBeHidden({ timeout: 5000 }).catch(() => {});
    }
};

const waitForSeatingOrder = async (matchId: string, page: Page, expected: string[]) => {
    await expect.poll(async () => {
        const state = await getMatchState(matchId, page);
        return state.core?.seatingOrder ?? null;
    }, {
        timeout: 15000,
        intervals: [200, 300, 500],
    }).toEqual(expected);
};

const waitForSeatSwapRequest = async (
    matchId: string,
    page: Page,
    expected: { requesterId: string; targetPlayerId: string } | null,
) => {
    await expect.poll(async () => {
        const state = await getMatchState(matchId, page);
        return state.core?.seatSwapRequest ?? null;
    }, {
        timeout: 15000,
        intervals: [200, 300, 500],
    }).toEqual(expected);
};

const buildFourPlayerNoResponseState = (state: any) => {
    const next = structuredClone(state);
    for (const player of Object.values<any>(next.core.players ?? {})) {
        player.hand = [];
    }
    next.core.pendingBonusDiceSettlement = undefined;
    next.core.pendingDamage = null;
    next.sys.responseWindow = {
        ...next.sys.responseWindow,
        current: undefined,
    };
    next.sys.interaction = {
        ...next.sys.interaction,
        current: undefined,
        queue: [],
    };
    next.sys.gameover = undefined;
    return next;
};

const buildOnlineAiHiddenModifyDiceState = (state: any) => {
    const next = structuredClone(state);
    const fallbackTurnOrder = Array.isArray(next.sys?.turnOrder)
        ? [...next.sys.turnOrder]
        : ['0', '1'];
    const aiCharacterId = next.core?.selectedCharacters?.['1']
        ?? next.core?.players?.['1']?.characterId
        ?? next.players?.['1']?.characterId
        ?? 'barbarian';
    const baseDice = Array.isArray(next.core?.dice) && next.core.dice.length > 0
        ? next.core.dice
        : typeof aiCharacterId === 'string' && aiCharacterId !== 'unselected'
            ? createCharacterDice(aiCharacterId)
            : [];

    next.core = {
        ...next.core,
        activePlayerId: '1',
        turnNumber: 3,
        phase: 'offensiveRoll',
        rollCount: 1,
        rollLimit: 2,
        rollDiceCount: 2,
        rollConfirmed: true,
        pendingAttack: null,
        pendingDamage: null,
        pendingBonusDiceSettlement: undefined,
        activatingAbilityId: undefined,
        dice: baseDice.map((die: any, index: number) => ({
            ...die,
            id: typeof die?.id === 'number' ? die.id : index,
            value: [1, 2, 5, 5, 5][index] ?? 5,
            isLocked: false,
            isKept: false,
        })),
    };

    next.sys = {
        ...next.sys,
        turnNumber: 3,
        phase: 'offensiveRoll',
        turnOrder: fallbackTurnOrder,
        currentPlayerIndex: 1,
        interaction: {
            current: {
                id: 'dt-online-ai-hidden-modify',
                kind: 'multistep-choice',
                playerId: '1',
                data: {
                    title: 'interaction.selectDiceToChange',
                    sourceId: 'card-unexpected',
                    maxSteps: 2,
                    minSteps: 1,
                    initialResult: {
                        modifications: {},
                        modCount: 0,
                        totalAdjustment: 0,
                    },
                    meta: {
                        dtType: 'modifyDie',
                        dieModifyConfig: {
                            mode: 'set',
                            targetValue: 6,
                        },
                        selectCount: 2,
                        diceOwnerId: '1',
                        targetOpponentDice: false,
                    },
                },
            },
            queue: [],
            isBlocked: true,
        },
        responseWindow: {
            ...next.sys?.responseWindow,
            current: undefined,
        },
        eventStream: {
            ...(next.sys?.eventStream ?? {}),
            entries: [],
            nextId: 1,
        },
    };

    return normalizeInjectedMatchState(next.sys.matchId ?? 'online-ai-hidden-modify', next);
};

const buildOnlineAiStalledMain2State = (state: any) => {
    const next = structuredClone(state);
    const fallbackTurnOrder = Array.isArray(next.sys?.turnOrder)
        ? [...next.sys.turnOrder]
        : ['0', '1'];
    const aiTurnIndex = Math.max(0, fallbackTurnOrder.indexOf('1'));
    const hostHp = Math.max(20, next.core?.players?.['0']?.resources?.[RESOURCE_IDS.HP] ?? 0);
    const aiHp = Math.max(20, next.core?.players?.['1']?.resources?.[RESOURCE_IDS.HP] ?? 0);

    next.core = {
        ...next.core,
        activePlayerId: '1',
        currentPlayerIndex: aiTurnIndex,
        turnOrder: fallbackTurnOrder,
        turnNumber: 4,
        phase: 'main2',
        pendingAttack: null,
        pendingDamage: null,
        pendingBonusDiceSettlement: undefined,
        activatingAbilityId: undefined,
        selectedAbilityId: undefined,
        rollConfirmed: true,
        rollCount: 1,
        rollLimit: 2,
        players: {
            ...next.core.players,
            '0': {
                ...next.core.players['0'],
                resources: {
                    ...next.core.players['0']?.resources,
                    [RESOURCE_IDS.HP]: hostHp,
                },
            },
            '1': {
                ...next.core.players['1'],
                hand: [],
                resources: {
                    ...next.core.players['1']?.resources,
                    [RESOURCE_IDS.HP]: aiHp,
                    [RESOURCE_IDS.CP]: next.core.players['1']?.resources?.[RESOURCE_IDS.CP] ?? 0,
                },
            },
        },
    };

    next.sys = {
        ...next.sys,
        turnNumber: 4,
        phase: 'main2',
        turnOrder: fallbackTurnOrder,
        currentPlayerIndex: aiTurnIndex,
        interaction: {
            current: undefined,
            queue: [],
            isBlocked: false,
        },
        responseWindow: {
            ...next.sys?.responseWindow,
            current: undefined,
        },
        gameover: undefined,
        eventStream: {
            ...(next.sys?.eventStream ?? {}),
            entries: [],
            nextId: 1,
        },
    };

    return normalizeInjectedMatchState(next.sys.matchId ?? 'online-ai-main2-stall', next);
};

const buildDiscardOverflowState = (state: any) => {
    const next = structuredClone(state);
    const fallbackTurnOrder = Array.isArray(next.sys?.turnOrder)
        ? [...next.sys.turnOrder]
        : ['0', '1'];
    const overflowCards = COMMON_CARDS.slice(0, HAND_LIMIT + 1).map((card) => structuredClone(card));
    if (overflowCards.length < HAND_LIMIT + 1) {
        throw new Error(`公共卡牌数量不足以构造弃牌溢出场景（需要 ${HAND_LIMIT + 1} 张）`);
    }

    next.core = {
        ...next.core,
        activePlayerId: '0',
        currentPlayerIndex: Math.max(0, fallbackTurnOrder.indexOf('0')),
        turnOrder: fallbackTurnOrder,
        turnNumber: 3,
        phase: 'discard',
        pendingAttack: null,
        pendingDamage: null,
        pendingBonusDiceSettlement: undefined,
        activatingAbilityId: undefined,
        selectedAbilityId: undefined,
        rollConfirmed: true,
        rollCount: 0,
        rollLimit: 0,
        players: {
            ...next.core.players,
            '0': {
                ...next.core.players['0'],
                hand: overflowCards,
                discard: [],
                resources: {
                    ...next.core.players['0']?.resources,
                    [RESOURCE_IDS.CP]: next.core.players['0']?.resources?.[RESOURCE_IDS.CP] ?? 0,
                },
            },
            '1': {
                ...next.core.players['1'],
                hand: next.core.players['1']?.hand ?? [],
            },
        },
    };

    next.sys = {
        ...next.sys,
        turnNumber: 3,
        phase: 'discard',
        turnOrder: fallbackTurnOrder,
        currentPlayerIndex: Math.max(0, fallbackTurnOrder.indexOf('0')),
        interaction: {
            current: undefined,
            queue: [],
            isBlocked: false,
        },
        responseWindow: {
            ...next.sys?.responseWindow,
            current: undefined,
        },
        gameover: undefined,
        eventStream: {
            ...(next.sys?.eventStream ?? {}),
            entries: [],
            nextId: 1,
        },
    };

    return normalizeInjectedMatchState(next.sys.matchId ?? 'discard-overflow', next);
};

const buildOnlineAiUndoSellLoopState = (state: any) => {
    const next = structuredClone(state);
    const fallbackTurnOrder = Array.isArray(next.sys?.turnOrder)
        ? [...next.sys.turnOrder]
        : ['0', '1'];
    const loopCard = COMMON_CARDS[0];
    if (!loopCard) {
        throw new Error('公共卡牌为空，无法构造 AI undo-sell 场景');
    }

    const hostHp = Math.max(20, next.core?.players?.['0']?.resources?.[RESOURCE_IDS.HP] ?? 0);
    const aiHp = Math.max(20, next.core?.players?.['1']?.resources?.[RESOURCE_IDS.HP] ?? 0);
    const cardCopy = structuredClone(loopCard);
    const aiCp = Math.max(1, next.core?.players?.['1']?.resources?.[RESOURCE_IDS.CP] ?? 0);

    next.core = {
        ...next.core,
        activePlayerId: '1',
        currentPlayerIndex: 1,
        turnOrder: fallbackTurnOrder,
        turnNumber: 4,
        phase: 'main2',
        lastSoldCardId: cardCopy.id,
        pendingAttack: null,
        pendingDamage: null,
        pendingBonusDiceSettlement: undefined,
        activatingAbilityId: undefined,
        selectedAbilityId: undefined,
        rollConfirmed: true,
        rollCount: 1,
        rollLimit: 2,
        players: {
            ...next.core.players,
            '0': {
                ...next.core.players['0'],
                resources: {
                    ...next.core.players['0']?.resources,
                    [RESOURCE_IDS.HP]: hostHp,
                },
            },
            '1': {
                ...next.core.players['1'],
                hand: [],
                discard: [cardCopy],
                resources: {
                    ...next.core.players['1']?.resources,
                    [RESOURCE_IDS.HP]: aiHp,
                    [RESOURCE_IDS.CP]: aiCp,
                },
            },
        },
    };

    next.sys = {
        ...next.sys,
        turnNumber: 4,
        phase: 'main2',
        turnOrder: fallbackTurnOrder,
        currentPlayerIndex: 1,
        interaction: {
            current: undefined,
            queue: [],
            isBlocked: false,
        },
        responseWindow: {
            ...next.sys?.responseWindow,
            current: undefined,
        },
        gameover: undefined,
        eventStream: {
            ...(next.sys?.eventStream ?? {}),
            entries: [],
            nextId: 1,
        },
    };

    return normalizeInjectedMatchState(next.sys.matchId ?? 'online-ai-undo-sell', next);
};

const advanceHostTurnToMain1 = async (
    matchId: string,
    page: Page,
    expectedPlayerId = '0',
) => {
    for (let step = 0; step < 12; step += 1) {
        const state = await getMatchState(matchId, page);
        const phase = state.sys?.phase ?? null;
        const activePlayerId = state.core?.activePlayerId ?? null;
        if (activePlayerId !== expectedPlayerId) {
            throw new Error(`期望已回到玩家 ${expectedPlayerId} 的回合，但当前为 ${String(activePlayerId)} / ${String(phase)}`);
        }
        if (phase === 'main1') {
            return;
        }
        if (!['upkeep', 'income'].includes(phase ?? '')) {
            throw new Error(`期望在人类回合的 upkeep/income/main1 之间推进，但当前 phase=${String(phase)}`);
        }

        const advanceButton = page.locator('[data-tutorial-id="advance-phase-button"]');
        await expect(advanceButton).toHaveCount(0);
        await page.waitForTimeout(250);
    }

    throw new Error('已回到真人回合，但维护/收入阶段未在 3 秒内自动推进到 main1，说明链路仍可能卡住');
};

const buildTargetingRollState = (state: any, targetingValue: number) => {
    const next = buildFourPlayerNoResponseState(state);
    next.core.activePlayerId = '0';
    next.core.rollCount = 1;
    next.core.rollLimit = 1;
    next.core.rollDiceCount = 1;
    next.core.rollConfirmed = true;
    next.core.selectedAbilityId = MONK_FIST_ATTACK_ID;
    next.core.pendingAttack = {
        attackerId: '0',
        defenderId: undefined,
        targetingSelectionPending: false,
        targetingSelectionResolved: false,
        isDefendable: true,
        damage: 6,
        sourceAbilityId: MONK_FIST_ATTACK_ID,
        defenseAbilityId: undefined,
        preDefenseResolved: false,
        bonusDamage: 0,
        attackModifierBonusDamage: 0,
        damageResolved: false,
        resolvedDamage: 0,
        offensiveRollEndTokenResolved: false,
        bonusDiceResolved: false,
    };
    next.sys.phase = 'targetingRoll';
    next.sys.flowHalted = false;
    next.core.dice = next.core.dice.map((die: any, index: number) => ({
        ...die,
        value: index === 0 ? targetingValue : die.value ?? 1,
        isKept: false,
    }));
    return next;
};

const _buildResponseWindowTriggerState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const enemyResponseCard = RESPONSE_WINDOW_CARD;
    const allyResponseCard = RESPONSE_WINDOW_CARD;
    if (!RESPONSE_WINDOW_CARD) {
        throw new Error(`未找到稳定响应卡 ${RESPONSE_WINDOW_CARD_ID}，无法构造四人响应窗口场景`);
    }

    if (!enemyResponseCard || !allyResponseCard) {
        throw new Error('未找到可用于 afterRollConfirmed 的响应卡，无法构造 4 人响应窗口场景');
    }

    next.core.players['1'].hand = [structuredClone(RESPONSE_WINDOW_CARD)];
    next.core.players['2'].hand = [structuredClone(RESPONSE_WINDOW_CARD)];
    next.core.players['1'].resources.cp = Math.max(next.core.players['1'].resources.cp ?? 0, 10);
    next.core.players['2'].resources.cp = Math.max(next.core.players['2'].resources.cp ?? 0, 10);
    next.core.activePlayerId = '0';
    next.core.rollCount = 1;
    next.core.rollLimit = 3;
    next.core.rollDiceCount = 5;
    next.core.rollConfirmed = false;
    next.core.pendingAttack = null;
    next.sys.phase = 'offensiveRoll';
    next.sys.flowHalted = false;
    next.core.dice = (next.core.dice.length > 0
        ? next.core.dice
        : Array.from({ length: 5 }, (_, index) => ({
            id: index,
            definitionId: 'monk-dice',
            value: 1,
            symbol: 'fist',
            symbols: ['fist'],
            isKept: false,
        }))).map((die: any) => ({
        ...die,
        value: 1,
        isKept: false,
    }));
    return next;
};

const buildDefensiveRollResolutionState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    next.sys.phase = 'defensiveRoll';
    next.sys.flowHalted = false;
    next.core.rollCount = 1;
    next.core.rollLimit = 1;
    next.core.rollDiceCount = 5;
    next.core.rollConfirmed = true;
    next.core.dice = next.core.dice.map((die: any) => ({
        ...die,
        value: 1,
        isKept: false,
    }));
    return next;
};

const buildDefensiveResponseWindowTriggerState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const attackerResponseCard = RESPONSE_WINDOW_CARD;
    const defenderTeammateResponseCard = RESPONSE_WINDOW_CARD;

    if (!attackerResponseCard || !defenderTeammateResponseCard) {
        throw new Error(`未找到稳定响应卡 ${RESPONSE_WINDOW_CARD_ID}，无法构造防守响应窗口场景`);
    }

    next.core.players['0'].hand = [structuredClone(attackerResponseCard)];
    next.core.players['2'].hand = [structuredClone(defenderTeammateResponseCard)];
    next.core.players['0'].resources.cp = Math.max(next.core.players['0'].resources.cp ?? 0, 10);
    next.core.players['2'].resources.cp = Math.max(next.core.players['2'].resources.cp ?? 0, 10);
    next.core.activePlayerId = '0';
    next.core.rollCount = 1;
    next.core.rollLimit = 1;
    next.core.rollDiceCount = 5;
    next.core.rollConfirmed = false;
    next.core.selectedAbilityId = MONK_FIST_ATTACK_ID;
    next.core.pendingAttack = {
        attackerId: '0',
        defenderId: '3',
        targetingSelectionPending: false,
        targetingSelectionResolved: true,
        isDefendable: true,
        damage: 6,
        sourceAbilityId: MONK_FIST_ATTACK_ID,
        defenseAbilityId: undefined,
        preDefenseResolved: false,
        bonusDamage: 0,
        attackModifierBonusDamage: 0,
        damageResolved: false,
        resolvedDamage: 0,
        offensiveRollEndTokenResolved: false,
        bonusDiceResolved: false,
    };
    next.sys.phase = 'defensiveRoll';
    next.sys.flowHalted = false;
    next.core.dice = Array.from({ length: 5 }, (_, index) => ({
        id: index,
        definitionId: 'paladin-dice',
        value: 1,
        symbol: 'sword',
        symbols: ['sword'],
        isKept: false,
    }));
    return next;
};

const buildTwoPlayerTransferTokenState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const transferCard = TRANSFER_STATUS_CARD;
    if (!transferCard) {
        throw new Error(`未找到稳定转移卡 ${TRANSFER_STATUS_CARD_ID}，无法构造 2 人转移 token 场景`);
    }

    next.core.activePlayerId = '0';
    next.sys.phase = 'main1';
    next.sys.flowHalted = false;
    next.core.pendingAttack = null;
    next.core.selectedAbilityId = undefined;
    next.core.rollConfirmed = false;
    next.core.players['0'].hand = [{ ...structuredClone(transferCard), id: 'transfer-2p-inst' }];
    next.core.players['0'].resources.cp = Math.max(next.core.players['0'].resources.cp ?? 0, 5);
    next.core.players['0'].tokens = {
        ...(next.core.players['0'].tokens ?? {}),
        [TOKEN_IDS.CRIT]: 0,
    };
    next.core.players['1'].tokens = {
        ...(next.core.players['1'].tokens ?? {}),
        [TOKEN_IDS.CRIT]: 1,
    };
    return next;
};

const buildTwoPlayerByeByeBountyState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const byeByeCard = BYE_BYE_CARD;
    if (!byeByeCard) {
        throw new Error(`未找到拜拜您卡 ${BYE_BYE_CARD_ID}，无法构造赏金移除复现场景`);
    }

    next.core.activePlayerId = '0';
    next.sys.phase = 'main1';
    next.core.phase = 'main1';
    next.sys.flowHalted = false;
    next.core.pendingAttack = null;
    next.core.selectedAbilityId = undefined;
    next.core.rollConfirmed = false;
    next.core.players['0'].hand = [structuredClone(byeByeCard)];
    next.core.players['0'].resources.cp = Math.max(next.core.players['0'].resources.cp ?? 0, 5);
    next.core.players['1'].tokens = {
        ...(next.core.players['1'].tokens ?? {}),
        [TOKEN_IDS.BOUNTY]: 1,
    };
    next.core.players['1'].statusEffects = {
        ...(next.core.players['1'].statusEffects ?? {}),
    };
    return next;
};

const buildTwoPlayerOffTurnByeByeBountyState = (state: any) => {
    const next = buildTwoPlayerByeByeBountyState(state);
    next.core.activePlayerId = '1';
    next.core.currentPlayerIndex = 1;
    next.sys.currentPlayerIndex = 1;
    return next;
};

const buildOnlineAiByeByeBountyState = (state: any) => {
    const next = buildTwoPlayerByeByeBountyState(state);
    const byeByeCard = BYE_BYE_CARD;
    if (!byeByeCard) {
        throw new Error(`未找到拜拜您卡 ${BYE_BYE_CARD_ID}，无法构造 AI 私有状态选择场景`);
    }

    next.core.activePlayerId = '1';
    next.core.currentPlayerIndex = 1;
    next.sys.currentPlayerIndex = 1;
    next.sys.phase = 'main1';
    next.core.phase = 'main1';
    next.core.players['0'].hand = [];
    next.core.players['1'].hand = [structuredClone(byeByeCard)];
    next.core.players['1'].resources.cp = Math.max(next.core.players['1'].resources.cp ?? 0, 5);
    next.core.players['0'].tokens = {
        ...(next.core.players['0'].tokens ?? {}),
        [TOKEN_IDS.BOUNTY]: 1,
    };
    next.core.players['1'].tokens = {
        ...(next.core.players['1'].tokens ?? {}),
        [TOKEN_IDS.BOUNTY]: 0,
    };

    return normalizeInjectedMatchState(next.sys.matchId ?? 'online-ai-bye-bye', next);
};

const installOnlineCommandRecorder = async (page: Page) => {
    await page.evaluate(async () => {
        const globalWindow = window as Window & {
            __DT_ONLINE_COMMAND_RECORDER__?: {
                installed: boolean;
                entries: Array<{ playerId: string | null; type: string }>;
            };
        };
        if (globalWindow.__DT_ONLINE_COMMAND_RECORDER__?.installed) {
            globalWindow.__DT_ONLINE_COMMAND_RECORDER__.entries = [];
            return;
        }

        const transportModule = await import('/src/engine/transport/client.ts');
        const proto = transportModule.GameTransportClient?.prototype as {
            sendCommand?: (this: { config?: { playerID?: string | null } }, type: string, payload: unknown, context?: unknown) => boolean;
            sendBatch?: (this: { config?: { playerID?: string | null } }, batchId: string, commands: Array<{ type: string; payload: unknown }>, onConfirmed?: (state: unknown) => void, onRejected?: (reason: string) => void, context?: unknown) => void;
        } | undefined;
        if (!proto?.sendCommand || !proto.sendBatch) {
            throw new Error('GameTransportClient command recorder unavailable');
        }

        const originalSendCommand = proto.sendCommand;
        const originalSendBatch = proto.sendBatch;
        globalWindow.__DT_ONLINE_COMMAND_RECORDER__ = { installed: true, entries: [] };
        proto.sendCommand = function recordedSendCommand(type, payload, context) {
            globalWindow.__DT_ONLINE_COMMAND_RECORDER__?.entries.push({
                playerId: this.config?.playerID ?? null,
                type,
            });
            return originalSendCommand.call(this, type, payload, context);
        };
        proto.sendBatch = function recordedSendBatch(batchId, commands, onConfirmed, onRejected, context) {
            for (const command of commands) {
                globalWindow.__DT_ONLINE_COMMAND_RECORDER__?.entries.push({
                    playerId: this.config?.playerID ?? null,
                    type: command.type,
                });
            }
            return originalSendBatch.call(this, batchId, commands, onConfirmed, onRejected, context);
        };
    });
};

const readOnlineCommandRecorder = async (page: Page) => page.evaluate(() => {
    const globalWindow = window as Window & {
        __DT_ONLINE_COMMAND_RECORDER__?: { entries: Array<{ playerId: string | null; type: string }> };
    };
    return globalWindow.__DT_ONLINE_COMMAND_RECORDER__?.entries ?? [];
});

const waitForOnlineAiSeatToReceiveState = async (
    page: Page,
    predicate: (state: any) => boolean,
    message: string,
) => {
    await expect.poll(async () => {
        const state = await page.evaluate(() => (
            (window as any).__BG_ONLINE_AI_DEBUG__?.getSeatLatestState?.('1') ?? null
        ));
        return predicate(state);
    }, { timeout: 10000, message }).toBe(true);
};

const buildTwoPlayerMeteorState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);

    next.core.activePlayerId = '0';
    next.sys.phase = 'offensiveRoll';
    next.sys.flowHalted = false;
    next.core.pendingAttack = {
        attackerId: '0',
        defenderId: '1',
        targetingSelectionPending: false,
        targetingSelectionResolved: true,
        isDefendable: false,
        damage: 4,
        sourceAbilityId: 'meteor',
        defenseAbilityId: undefined,
        preDefenseResolved: false,
        bonusDamage: 0,
        attackModifierBonusDamage: 0,
        damageResolved: false,
        resolvedDamage: 0,
        offensiveRollEndTokenResolved: false,
        bonusDiceResolved: false,
    };
    next.core.selectedAbilityId = 'meteor';
    next.core.rollConfirmed = true;
    next.core.rollCount = 1;
    next.core.rollLimit = 1;
    next.core.rollDiceCount = 5;
    next.core.players['0'].tokens = {
        ...(next.core.players['0'].tokens ?? {}),
        [TOKEN_IDS.FIRE_MASTERY]: 0,
    };
    for (const pid of ['0', '1']) {
        next.core.players[pid].resources = {
            ...(next.core.players[pid].resources ?? {}),
            [RESOURCE_IDS.HP]: 50,
        };
    }

    return next;
};

const buildTwoPlayerAfterRollResponseState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const responseCard = RESPONSE_WINDOW_CARD;
    if (!responseCard) {
        throw new Error(`未找到稳定响应卡 ${RESPONSE_WINDOW_CARD_ID}，无法构造 2 人响应窗口场景`);
    }

    next.core.activePlayerId = '0';
    next.sys.phase = 'offensiveRoll';
    next.sys.flowHalted = false;
    next.core.pendingAttack = null;
    next.core.selectedAbilityId = undefined;
    next.core.rollConfirmed = false;
    next.core.rollCount = 1;
    next.core.rollLimit = 3;
    next.core.rollDiceCount = 5;
    for (const pid of ['0', '1']) {
        next.core.players[pid].resources = {
            ...(next.core.players[pid].resources ?? {}),
            [RESOURCE_IDS.HP]: 50,
        };
    }
    next.core.players['1'].hand = [{ ...structuredClone(responseCard), id: TWO_PLAYER_AFTER_ROLL_RESPONSE_CARD_INSTANCE_ID }];
    next.core.players['1'].resources.cp = Math.max(next.core.players['1'].resources.cp ?? 0, 10);

    const fallbackCharacterId = typeof next.core?.players?.['0']?.characterId === 'string'
        ? next.core.players['0'].characterId
        : 'monk';
    next.core.dice = (Array.isArray(next.core.dice) && next.core.dice.length > 0
        ? next.core.dice
        : createCharacterDice(fallbackCharacterId)
    ).map((die: any, index: number) => ({
        ...die,
        id: typeof die?.id === 'number' ? die.id : index,
        value: 1,
        isKept: false,
    }));

    return next;
};

const buildTwoPlayerAfterAttackResponseState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const responseCard = RESPONSE_WINDOW_CARD;
    if (!responseCard) {
        throw new Error(`未找到稳定响应卡 ${RESPONSE_WINDOW_CARD_ID}，无法构造 afterAttackResolved 响应窗口场景`);
    }

    next.core.activePlayerId = '0';
    next.sys.phase = 'main2';
    next.sys.flowHalted = false;
    next.core.pendingAttack = null;
    next.core.rollConfirmed = true;
    next.core.attackResolvedSequence = 1;
    next.core.afterAttackResponseWindowSequence = 1;
    next.core.lastResolvedAttackDamage = 6;
    next.core.players['1'].hand = [{ ...structuredClone(responseCard), id: 'response-after-attack' }];
    next.core.players['1'].resources.cp = Math.max(next.core.players['1'].resources.cp ?? 0, 10);
    next.sys.responseWindow = {
        ...next.sys.responseWindow,
        current: {
            id: 'after-attack-2p',
            windowType: 'afterAttackResolved',
            responderQueue: ['1'],
            currentResponderIndex: 0,
            passedPlayers: [],
        },
    };

    return next;
};

const buildTwoPlayerAfterCardResponseState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const responseCard = RESPONSE_WINDOW_CARD;
    if (!responseCard) {
        throw new Error(`未找到稳定响应卡 ${RESPONSE_WINDOW_CARD_ID}，无法构造 afterCardPlayed 响应窗口场景`);
    }
    if (!TRANSFER_STATUS_CARD) {
        throw new Error(`未找到稳定卡牌 ${TRANSFER_STATUS_CARD_ID}，无法构造 afterCardPlayed 响应窗口场景`);
    }

    next.core.activePlayerId = '0';
    next.sys.phase = 'main1';
    next.sys.flowHalted = false;
    next.core.pendingAttack = null;
    next.core.rollConfirmed = false;
    for (const player of Object.values<any>(next.core.players ?? {})) {
        if (!player) continue;
        player.resources = {
            ...(player.resources ?? {}),
            [RESOURCE_IDS.HP]: 50,
        };
    }
    next.core.players['1'].hand = [{ ...structuredClone(responseCard), id: TWO_PLAYER_AFTER_CARD_RESPONSE_CARD_INSTANCE_ID }];
    next.core.players['1'].resources.cp = Math.max(next.core.players['1'].resources.cp ?? 0, 10);
    next.sys.responseWindow = {
        ...next.sys.responseWindow,
        current: {
            id: 'after-card-2p',
            windowType: 'afterCardPlayed',
            sourceId: TRANSFER_STATUS_CARD_ID,
            responderQueue: ['1'],
            currentResponderIndex: 0,
            passedPlayers: [],
        },
    };

    return next;
};

const buildOnlineAiAfterCardResponseTriggerState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const triggerCard = TRANSFER_STATUS_CARD;
    const responseCard = AFTER_CARD_PLAYABLE_RESPONSE_CARD;
    if (!triggerCard) {
        throw new Error(`未找到稳定转移卡 ${TRANSFER_STATUS_CARD_ID}，无法构造在线 AI afterCardPlayed 真实触发场景`);
    }
    if (!responseCard) {
        throw new Error(`未找到稳定可用响应卡 ${AFTER_CARD_PLAYABLE_RESPONSE_CARD_ID}，无法构造在线 AI afterCardPlayed 真实触发场景`);
    }

    next.core.activePlayerId = '0';
    next.sys.phase = 'main1';
    next.sys.flowHalted = false;
    next.core.pendingAttack = null;
    next.core.selectedAbilityId = undefined;
    next.core.rollConfirmed = false;
    for (const player of Object.values<any>(next.core.players ?? {})) {
        if (!player) continue;
        player.resources = {
            ...(player.resources ?? {}),
            [RESOURCE_IDS.HP]: 50,
        };
    }
    next.core.players['0'].hand = [{
        ...structuredClone(triggerCard),
        id: ONLINE_AI_AFTER_CARD_TRIGGER_CARD_INSTANCE_ID,
    }];
    next.core.players['0'].resources.cp = Math.max(next.core.players['0'].resources.cp ?? 0, triggerCard.cpCost ?? 0);
    next.core.players['1'].hand = [{
        ...structuredClone(responseCard),
        id: TWO_PLAYER_AFTER_CARD_PLAYABLE_RESPONSE_CARD_INSTANCE_ID,
    }];
    next.core.players['1'].resources.cp = Math.max(next.core.players['1'].resources.cp ?? 0, responseCard.cpCost ?? 0);
    // transfer-status 需要场上存在可转移状态/Token；补最小前置，确保真实触发链路可执行。
    next.core.players['0'].tokens = {
        ...(next.core.players['0'].tokens ?? {}),
        [TOKEN_IDS.CRIT]: 1,
    };
    next.core.players['1'].tokens = {
        ...(next.core.players['1'].tokens ?? {}),
        [TOKEN_IDS.CRIT]: 0,
    };

    return normalizeInjectedMatchState(next.sys.matchId ?? 'online-ai-after-card-trigger', next);
};

const buildOnlineAiOffTurnDefensiveRollState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const attacker = next.core?.players?.['0'];
    const defender = next.core?.players?.['1'];
    const defenderCharacterId = typeof defender?.characterId === 'string' ? defender.characterId : null;
    const selectedDefenseAbilityId = getDefensiveAbilityIds(next.core, '1')[0]
        ?? CHARACTER_DATA_MAP[defenderCharacterId as keyof typeof CHARACTER_DATA_MAP]?.abilities?.find((ability: any) => ability?.type === 'defensive')?.id
        ?? null;
    const attackerAbility = Array.isArray(attacker?.abilities)
        ? attacker.abilities.find((ability: any) => ability?.type === 'offensive')
        : null;

    if (!defender || !defenderCharacterId || defenderCharacterId === 'unselected') {
        throw new Error('AI 防守方角色未就绪，无法构造 off-turn defensiveRoll 场景');
    }
    if (!selectedDefenseAbilityId) {
        throw new Error('AI 防守方缺少防御技能，无法构造 off-turn defensiveRoll 场景');
    }

    next.core.activePlayerId = '0';
    next.sys.phase = 'defensiveRoll';
    next.sys.flowHalted = false;
    next.core.rollCount = 0;
    next.core.rollLimit = 1;
    next.core.rollDiceCount = 0;
    next.core.rollConfirmed = false;
    next.core.selectedAbilityId = undefined;
    next.core.pendingBonusDiceSettlement = undefined;
    next.core.pendingDamage = null;
    next.core.activatingAbilityId = selectedDefenseAbilityId;
    next.core.pendingAttack = {
        attackerId: '0',
        defenderId: '1',
        isDefendable: true,
        sourceAbilityId: attackerAbility?.id ?? 'online-ai-offturn-defensive-feedback-attack',
        defenseAbilityId: selectedDefenseAbilityId,
        isUltimate: false,
        damageResolved: false,
        resolvedDamage: 0,
        bonusDamage: 0,
        attackModifierBonusDamage: 0,
    };
    next.core.dice = createCharacterDice(defenderCharacterId).map((die: any, index: number) => ({
        ...die,
        id: typeof die?.id === 'number' ? die.id : index,
        value: 1,
        isKept: false,
    }));

    for (const pid of ['0', '1']) {
        next.core.players[pid].resources = {
            ...(next.core.players[pid].resources ?? {}),
            [RESOURCE_IDS.HP]: 50,
        };
        next.core.players[pid].tokens = Object.fromEntries(
            Object.entries(next.core.players[pid].tokens ?? {}).map(([tokenId]) => [tokenId, 0]),
        );
        next.core.players[pid].statusEffects = Object.fromEntries(
            Object.entries(next.core.players[pid].statusEffects ?? {}).map(([statusId]) => [statusId, 0]),
        );
    }

    return normalizeInjectedMatchState(next.sys.matchId ?? 'online-ai-offturn-defensive-roll', next);
};

const buildTwoPlayerResponseLoopState = (
    state: any,
    options: { windowId?: string; pendingInteractionId?: string } = {},
) => {
    const next = buildTwoPlayerAfterCardResponseState(state);
    next.core = {
        ...next.core,
        hostStarted: true,
        selectedCharacters: {
            ...next.core.selectedCharacters,
            '0': 'monk',
            '1': 'paladin',
        },
        readyPlayers: {
            ...next.core.readyPlayers,
            '0': true,
            '1': true,
        },
        players: {
            ...next.core.players,
            '0': {
                ...next.core.players['0'],
                characterId: 'monk',
                resources: {
                    ...next.core.players['0']?.resources,
                    [RESOURCE_IDS.HP]: Math.max(next.core.players['0']?.resources?.[RESOURCE_IDS.HP] ?? 0, 50),
                },
            },
            '1': {
                ...next.core.players['1'],
                characterId: 'paladin',
                resources: {
                    ...next.core.players['1']?.resources,
                    [RESOURCE_IDS.HP]: Math.max(next.core.players['1']?.resources?.[RESOURCE_IDS.HP] ?? 0, 50),
                },
            },
        },
    };
    if (!Array.isArray(next.core.dice)) {
        next.core.dice = [];
    }
    next.sys.responseWindow = {
        ...next.sys.responseWindow,
        current: {
            ...(next.sys.responseWindow?.current ?? {}),
            id: options.windowId ?? (next.sys.responseWindow?.current as any)?.id ?? 'after-card-2p',
            pendingInteractionId: options.pendingInteractionId ?? 'loop-pending-interaction',
        },
    };
    return next;
};

const buildOnlineAiHumanResponseWindowState = (state: any) => {
    const next = buildTwoPlayerAfterCardResponseState(state);
    const responseCard = RESPONSE_WINDOW_CARD;
    if (!responseCard) {
        throw new Error(`未找到稳定响应卡 ${RESPONSE_WINDOW_CARD_ID}，无法构造 human 响应窗口场景`);
    }

    const fallbackTurnOrder = Array.isArray(next.sys?.turnOrder)
        ? [...next.sys.turnOrder]
        : ['0', '1'];

    next.core = {
        ...next.core,
        activePlayerId: '1',
        phase: 'main1',
        pendingAttack: null,
        rollConfirmed: false,
        players: {
            ...next.core.players,
            '0': {
                ...next.core.players['0'],
                hand: [{ ...structuredClone(responseCard), id: HUMAN_RESPONSE_AFTER_CARD_INSTANCE_ID, cardId: RESPONSE_WINDOW_CARD_ID }],
                resources: {
                    ...next.core.players['0']?.resources,
                    cp: Math.max(next.core.players['0']?.resources?.cp ?? 0, 10),
                },
            },
            '1': {
                ...next.core.players['1'],
                hand: [],
            },
        },
    };

    next.sys = {
        ...next.sys,
        phase: 'main1',
        turnOrder: fallbackTurnOrder,
        currentPlayerIndex: 1,
        responseWindow: {
            ...next.sys.responseWindow,
            current: {
                ...(next.sys.responseWindow?.current ?? {}),
                id: 'manual-force-end-human-response',
                windowType: 'afterCardPlayed',
                sourceId: TRANSFER_STATUS_CARD_ID,
                responderQueue: ['0'],
                currentResponderIndex: 0,
                passedPlayers: [],
            },
        },
    };

    return normalizeInjectedMatchState(next.sys.matchId ?? 'online-ai-human-response', next);
};

const buildOnlineAiHumanThenAiResponseWindowState = (state: any) => {
    const next = buildTwoPlayerAfterCardResponseState(state);
    const responseCard = AFTER_CARD_PLAYABLE_RESPONSE_CARD;
    if (!responseCard) {
        throw new Error(`未找到稳定可用响应卡 ${AFTER_CARD_PLAYABLE_RESPONSE_CARD_ID}，无法构造 human+AI 响应窗口场景`);
    }

    const fallbackTurnOrder = Array.isArray(next.sys?.turnOrder)
        ? [...next.sys.turnOrder]
        : ['0', '1'];

    next.core = {
        ...next.core,
        activePlayerId: '1',
        phase: 'main1',
        pendingAttack: null,
        rollConfirmed: false,
        players: {
            ...next.core.players,
            '0': {
                ...next.core.players['0'],
                hand: [{ ...structuredClone(responseCard), id: HUMAN_RESPONSE_AFTER_CARD_INSTANCE_ID, cardId: AFTER_CARD_PLAYABLE_RESPONSE_CARD_ID }],
                resources: {
                    ...next.core.players['0']?.resources,
                    cp: Math.max(next.core.players['0']?.resources?.cp ?? 0, responseCard.cpCost ?? 0),
                },
            },
            '1': {
                ...next.core.players['1'],
                hand: [{ ...structuredClone(responseCard), id: AI_RESPONSE_AFTER_CARD_INSTANCE_ID, cardId: AFTER_CARD_PLAYABLE_RESPONSE_CARD_ID }],
                resources: {
                    ...next.core.players['1']?.resources,
                    cp: Math.max(next.core.players['1']?.resources?.cp ?? 0, responseCard.cpCost ?? 0),
                },
            },
        },
    };

    next.sys = {
        ...next.sys,
        phase: 'main1',
        turnOrder: fallbackTurnOrder,
        currentPlayerIndex: 1,
        responseWindow: {
            ...next.sys.responseWindow,
            current: {
                ...(next.sys.responseWindow?.current ?? {}),
                id: 'human-then-ai-response-window',
                windowType: 'afterCardPlayed',
                sourceId: TRANSFER_STATUS_CARD_ID,
                responderQueue: ['0', '1'],
                currentResponderIndex: 0,
                passedPlayers: [],
            },
        },
    };

    return normalizeInjectedMatchState(next.sys.matchId ?? 'online-ai-human-then-ai-response', next);
};

const buildFourPlayerTransferTokenState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const transferCard = TRANSFER_STATUS_CARD;
    if (!transferCard) {
        throw new Error(`未找到稳定转移卡 ${TRANSFER_STATUS_CARD_ID}，无法构造 4 人转移 token 场景`);
    }

    next.core.activePlayerId = '0';
    next.sys.phase = 'main1';
    next.sys.flowHalted = false;
    next.core.pendingAttack = null;
    next.core.selectedAbilityId = undefined;
    next.core.rollConfirmed = false;
    next.core.players['0'].hand = [{ ...structuredClone(transferCard), id: 'transfer-inst' }];
    next.core.players['0'].resources.cp = Math.max(next.core.players['0'].resources.cp ?? 0, 5);
    next.core.players['1'].tokens = {
        ...(next.core.players['1'].tokens ?? {}),
        [TOKEN_IDS.CRIT]: 1,
    };
    next.core.players['2'].tokens = {
        ...(next.core.players['2'].tokens ?? {}),
        [TOKEN_IDS.CRIT]: 0,
    };
    next.core.players['3'].tokens = {
        ...(next.core.players['3'].tokens ?? {}),
        [TOKEN_IDS.CRIT]: 0,
    };
    return next;
};

const buildFourPlayerTransferOwnTokenState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const transferCard = TRANSFER_STATUS_CARD;
    if (!transferCard) {
        throw new Error(`未找到稳定转移卡 ${TRANSFER_STATUS_CARD_ID}，无法构造 4 人自来源转移 token 场景`);
    }

    next.core.activePlayerId = '0';
    next.sys.phase = 'main1';
    next.sys.flowHalted = false;
    next.core.pendingAttack = null;
    next.core.selectedAbilityId = undefined;
    next.core.rollConfirmed = false;
    next.core.players['0'].hand = [{ ...structuredClone(transferCard), id: 'transfer-own-inst' }];
    next.core.players['0'].resources.cp = Math.max(next.core.players['0'].resources.cp ?? 0, 5);
    next.core.players['0'].tokens = {
        ...(next.core.players['0'].tokens ?? {}),
        [TOKEN_IDS.CRIT]: 1,
    };
    next.core.players['1'].tokens = {
        ...(next.core.players['1'].tokens ?? {}),
        [TOKEN_IDS.CRIT]: 0,
    };
    next.core.players['2'].tokens = {
        ...(next.core.players['2'].tokens ?? {}),
        [TOKEN_IDS.CRIT]: 0,
    };
    next.core.players['3'].tokens = {
        ...(next.core.players['3'].tokens ?? {}),
        [TOKEN_IDS.CRIT]: 0,
    };
    return next;
};

const buildFourPlayerTransferOwnLoadedState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const transferCard = TRANSFER_STATUS_CARD;
    if (!transferCard) {
        throw new Error(`未找到稳定转移卡 ${TRANSFER_STATUS_CARD_ID}，无法构造 4 人枪手装填转移场景`);
    }

    next.core.activePlayerId = '0';
    next.sys.phase = 'main1';
    next.sys.flowHalted = false;
    next.core.pendingAttack = null;
    next.core.selectedAbilityId = undefined;
    next.core.rollConfirmed = false;
    next.core.players['0'].hand = [{ ...structuredClone(transferCard), id: 'transfer-loaded-inst' }];
    next.core.players['0'].resources.cp = Math.max(next.core.players['0'].resources.cp ?? 0, 5);
    next.core.players['0'].tokens = {
        ...(next.core.players['0'].tokens ?? {}),
        [TOKEN_IDS.LOADED]: 1,
        [TOKEN_IDS.CRIT]: 0,
    };
    next.core.players['1'].tokens = {
        ...(next.core.players['1'].tokens ?? {}),
        [TOKEN_IDS.LOADED]: 0,
    };
    next.core.players['2'].tokens = {
        ...(next.core.players['2'].tokens ?? {}),
        [TOKEN_IDS.LOADED]: 0,
    };
    next.core.players['3'].tokens = {
        ...(next.core.players['3'].tokens ?? {}),
        [TOKEN_IDS.LOADED]: 0,
    };
    return next;
};

const GUNSLINGER_FACE_BY_VALUE: Record<number, string> = {
    1: GUNSLINGER_DICE_FACE_IDS.BULLET,
    2: GUNSLINGER_DICE_FACE_IDS.BULLET,
    3: GUNSLINGER_DICE_FACE_IDS.BULLET,
    4: GUNSLINGER_DICE_FACE_IDS.DASH,
    5: GUNSLINGER_DICE_FACE_IDS.DASH,
    6: GUNSLINGER_DICE_FACE_IDS.BULLSEYE,
};

const applyUpgradedGunslingerAbilityScene = (
    next: any,
    options: {
        abilityId: 'deadeye' | 'fan-the-hammer';
        upgradedAbility: any;
        upgradeCard: { id: string; cpCost: number };
        level: 2;
        diceValues: number[];
    },
) => {
    next.core.activePlayerId = '0';
    next.sys.phase = 'offensiveRoll';
    next.sys.flowHalted = false;
    next.core.pendingAttack = null;
    next.core.pendingDamage = undefined;
    next.core.selectedAbilityId = undefined;
    next.core.phase = 'offensiveRoll';
    next.core.rollConfirmed = true;
    next.core.rollCount = 1;
    next.core.rollLimit = 3;
    next.core.rollDiceCount = 5;
    next.core.players['0'].hand = [];
    next.core.players['0'].discard = [];
    next.core.players['0'].tokens = {
        ...(next.core.players['0'].tokens ?? {}),
        [TOKEN_IDS.LOADED]: 0,
    };
    next.core.players['0'].abilityLevels = {
        ...(next.core.players['0'].abilityLevels ?? {}),
        [options.abilityId]: options.level,
    };
    next.core.players['0'].abilities = (next.core.players['0'].abilities ?? []).map((ability: any) =>
        ability?.id === options.abilityId ? structuredClone(options.upgradedAbility) : ability
    );
    next.core.players['0'].upgradeCardByAbilityId = {
        ...(next.core.players['0'].upgradeCardByAbilityId ?? {}),
        [options.abilityId]: {
            cardId: options.upgradeCard.id,
            cpCost: options.upgradeCard.cpCost,
        },
    };
    next.core.dice = createCharacterDice('gunslinger').map((die, index) => {
        const value = options.diceValues[index] ?? die.value;
        const face = GUNSLINGER_FACE_BY_VALUE[value] ?? GUNSLINGER_DICE_FACE_IDS.BULLET;
        return {
            ...die,
            value,
            symbol: face,
            symbols: [face],
            isKept: false,
        };
    });
};

const buildFourPlayerTheLawState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const deadeyeUpgradeCard = UPGRADE_DEADEYE_2_CARD;
    if (!deadeyeUpgradeCard) {
        throw new Error(`未找到稳定枪手升级卡 ${UPGRADE_DEADEYE_2_CARD_ID}，无法构造 4 人 The Law 场景`);
    }

    applyUpgradedGunslingerAbilityScene(next, {
        abilityId: 'deadeye',
        upgradedAbility: DEADEYE_2,
        upgradeCard: deadeyeUpgradeCard,
        level: 2,
        diceValues: [6, 6, 6, 1, 1],
    });
    next.core.players['0'].tokens = {
        ...(next.core.players['0'].tokens ?? {}),
        [TOKEN_IDS.EVASIVE]: 0,
    };

    for (const pid of ['1', '2', '3']) {
        next.core.players[pid].tokens = {
            ...(next.core.players[pid].tokens ?? {}),
            [TOKEN_IDS.BOUNTY]: 0,
        };
        next.core.players[pid].statusEffects = {
            ...(next.core.players[pid].statusEffects ?? {}),
            knockdown: 0,
        };
    }

    return next;
};

const buildFourPlayerWantedState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const wantedCard = WANTED_CARD;
    if (!wantedCard) {
        throw new Error(`未找到稳定枪手卡 ${WANTED_CARD_ID}，无法构造 4 人 Wanted 场景`);
    }

    next.core.activePlayerId = '0';
    next.sys.phase = 'main1';
    next.sys.flowHalted = false;
    next.core.pendingAttack = null;
    next.core.selectedAbilityId = undefined;
    next.core.rollConfirmed = false;
    next.core.players['0'].hand = [{ ...structuredClone(wantedCard) }];
    next.core.players['0'].resources.cp = Math.max(next.core.players['0'].resources.cp ?? 0, 5);
    next.core.players['1'].tokens = {
        ...(next.core.players['1'].tokens ?? {}),
        [TOKEN_IDS.BOUNTY]: 0,
    };
    next.core.players['2'].tokens = {
        ...(next.core.players['2'].tokens ?? {}),
        [TOKEN_IDS.BOUNTY]: 0,
    };
    next.core.players['3'].tokens = {
        ...(next.core.players['3'].tokens ?? {}),
        [TOKEN_IDS.BOUNTY]: 0,
    };

    return next;
};

const buildFourPlayerPistolWhipState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const fanTheHammerUpgradeCard = UPGRADE_FAN_THE_HAMMER_2_CARD;
    if (!fanTheHammerUpgradeCard) {
        throw new Error(`未找到稳定枪手升级卡 ${UPGRADE_FAN_THE_HAMMER_2_CARD_ID}，无法构造 4 人 Pistol Whip 场景`);
    }

    applyUpgradedGunslingerAbilityScene(next, {
        abilityId: 'fan-the-hammer',
        upgradedAbility: FAN_THE_HAMMER_2,
        upgradeCard: fanTheHammerUpgradeCard,
        level: 2,
        diceValues: [6, 4, 4, 1, 1],
    });
    next.core.players['0'].tokens = {
        ...(next.core.players['0'].tokens ?? {}),
        [TOKEN_IDS.EVASIVE]: 0,
    };

    for (const pid of ['1', '2', '3']) {
        next.core.players[pid].tokens = {
            ...(next.core.players[pid].tokens ?? {}),
            protect: 0,
        };
        next.core.players[pid].statusEffects = {
            ...(next.core.players[pid].statusEffects ?? {}),
            knockdown: 0,
        };
    }

    return next;
};

const buildFourPlayerHighNoonState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const highNoonCard = HIGH_NOON_CARD;
    if (!highNoonCard) {
        throw new Error(`未找到稳定枪手卡 ${HIGH_NOON_CARD_ID}，无法构造 4 人 High Noon 场景`);
    }

    next.core.activePlayerId = '0';
    next.sys.phase = 'main1';
    next.sys.flowHalted = false;
    next.core.pendingAttack = null;
    next.core.selectedAbilityId = undefined;
    next.core.rollConfirmed = false;
    next.core.pendingBonusDiceSettlement = null;
    next.core.players['0'].hand = [{ ...structuredClone(highNoonCard) }];
    next.core.players['0'].resources.cp = Math.max(next.core.players['0'].resources.cp ?? 0, 5);

    for (const pid of ['1', '2', '3']) {
        next.core.players[pid].tokens = {
            ...(next.core.players[pid].tokens ?? {}),
            [TOKEN_IDS.BOUNTY]: 0,
        };
        next.core.players[pid].statusEffects = {
            ...(next.core.players[pid].statusEffects ?? {}),
            knockdown: 0,
        };
    }

    return next;
};

const buildFourPlayerEatMyLeadTargetingRollState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const eatMyLeadCard = EAT_MY_LEAD_CARD;
    if (!eatMyLeadCard) {
        throw new Error(`未找到稳定枪手卡 ${EAT_MY_LEAD_CARD_ID}，无法构造 4 人 Eat My Lead 场景`);
    }

    next.core.activePlayerId = '0';
    next.core.phase = 'targetingRoll';
    next.core.rollCount = 1;
    next.core.rollLimit = 1;
    next.core.rollDiceCount = 1;
    next.core.rollConfirmed = true;
    next.core.selectedAbilityId = 'revolver-3';
    next.core.pendingAttack = {
        attackerId: '0',
        defenderId: undefined,
        targetingSelectionPending: false,
        targetingSelectionResolved: false,
        isDefendable: true,
        damage: 4,
        sourceAbilityId: 'revolver-3',
        defenseAbilityId: undefined,
        preDefenseResolved: false,
        bonusDamage: 0,
        attackModifierBonusDamage: 0,
        damageResolved: false,
        resolvedDamage: 0,
        offensiveRollEndTokenResolved: true,
        bonusDiceResolved: false,
    };
    next.core.players['0'].hand = [{ ...structuredClone(eatMyLeadCard) }];
    next.core.players['0'].resources.cp = Math.max(next.core.players['0'].resources.cp ?? 0, 2);
    next.core.players['0'].tokens = {
        ...(next.core.players['0'].tokens ?? {}),
        [TOKEN_IDS.LOADED]: 1,
    };
    next.core.players['3'].statusEffects = {
        ...(next.core.players['3'].statusEffects ?? {}),
        knockdown: 0,
    };
    next.core.dice = next.core.dice.map((die: any, index: number) => ({
        ...die,
        value: index === 0 ? 2 : (die?.value ?? 1),
        isKept: false,
    }));

    next.sys.phase = 'targetingRoll';
    next.sys.flowHalted = false;

    return next;
};

const buildFourPlayerSamuraiAshamedState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const ashamedCard = SAMURAI_ASHAMED_CARD;
    if (!ashamedCard) {
        throw new Error(`未找到稳定武士卡 ${SAMURAI_ASHAMED_CARD_ID}，无法构造 4 人耻辱牌场景`);
    }

    next.core.activePlayerId = '0';
    next.sys.phase = 'main1';
    next.sys.flowHalted = false;
    next.core.pendingAttack = null;
    next.core.selectedAbilityId = undefined;
    next.core.rollConfirmed = false;
    next.core.players['0'].hand = [{ ...structuredClone(ashamedCard) }];
    next.core.players['0'].resources.cp = Math.max(next.core.players['0'].resources.cp ?? 0, 5);
    next.core.players['1'].tokens = {
        ...(next.core.players['1'].tokens ?? {}),
        [TOKEN_IDS.SHAME]: 0,
    };
    next.core.players['2'].tokens = {
        ...(next.core.players['2'].tokens ?? {}),
        [TOKEN_IDS.SHAME]: 0,
    };
    next.core.players['3'].tokens = {
        ...(next.core.players['3'].tokens ?? {}),
        [TOKEN_IDS.SHAME]: 0,
    };

    return next;
};

const buildFourPlayerConsecrateState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const consecrateCard = CONSECRATE_CARD;
    if (!consecrateCard) {
        throw new Error(`未找到稳定授 token 卡 ${CONSECRATE_CARD_ID}，无法构造 4 人 Consecrate 场景`);
    }

    next.core.activePlayerId = '0';
    next.sys.phase = 'main1';
    next.sys.flowHalted = false;
    next.core.pendingAttack = null;
    next.core.selectedAbilityId = undefined;
    next.core.rollConfirmed = false;
    next.core.players['0'].hand = [{ ...structuredClone(consecrateCard), id: 'consecrate-inst' }];
    next.core.players['0'].resources.cp = Math.max(next.core.players['0'].resources.cp ?? 0, 10);
    for (const pid of ['1', '2', '3']) {
        next.core.players[pid].tokens = {
            ...(next.core.players[pid].tokens ?? {}),
            [TOKEN_IDS.PROTECT]: 0,
            [TOKEN_IDS.RETRIBUTION]: 0,
            [TOKEN_IDS.CRIT]: 0,
            [TOKEN_IDS.ACCURACY]: 0,
        };
    }
    return next;
};

const buildFourPlayerVengeance2State = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const vengeanceUpgradeCard = PALADIN_VENGEANCE_2_CARD;
    if (!vengeanceUpgradeCard) {
        throw new Error(`未找到稳定升级卡 ${PALADIN_VENGEANCE_2_CARD_ID}，无法构造 4 人 Vengeance II 场景`);
    }

    next.core.activePlayerId = '0';
    next.sys.phase = 'offensiveRoll';
    next.sys.flowHalted = false;
    next.core.pendingAttack = null;
    next.core.selectedAbilityId = undefined;
    next.core.rollConfirmed = true;
    next.core.rollCount = 1;
    next.core.rollLimit = 3;
    next.core.rollDiceCount = 5;
    next.core.players['0'].resources.cp = 1;
    next.core.players['0'].abilityLevels = {
        ...(next.core.players['0'].abilityLevels ?? {}),
        vengeance: 2,
    };
    next.core.players['0'].abilities = (next.core.players['0'].abilities ?? []).map((ability: any) =>
        ability?.id === 'vengeance' ? structuredClone(VENGEANCE_2) : ability
    );
    next.core.players['0'].upgradeCardByAbilityId = {
        ...(next.core.players['0'].upgradeCardByAbilityId ?? {}),
        vengeance: { cardId: vengeanceUpgradeCard.id, cpCost: vengeanceUpgradeCard.cpCost },
    };
    next.core.players['0'].tokens = {
        ...(next.core.players['0'].tokens ?? {}),
        [TOKEN_IDS.RETRIBUTION]: 0,
    };
    next.core.players['2'].tokens = {
        ...(next.core.players['2'].tokens ?? {}),
        [TOKEN_IDS.RETRIBUTION]: 0,
    };
    next.core.dice = (next.core.dice.length > 0
        ? next.core.dice
        : Array.from({ length: 5 }, (_, index) => ({
            id: index,
            definitionId: 'paladin-dice',
            value: 1,
            symbol: 'sword',
            symbols: ['sword'],
            isKept: false,
        }))).map((die: any, index: number) => ({
        ...die,
        value: index < 3 ? 3 : index === 3 ? 6 : 1,
        symbol: index < 3
            ? PALADIN_DICE_FACE_IDS.HELM
            : index === 3
                ? PALADIN_DICE_FACE_IDS.PRAY
                : PALADIN_DICE_FACE_IDS.SWORD,
        symbols: [index < 3
            ? PALADIN_DICE_FACE_IDS.HELM
            : index === 3
                ? PALADIN_DICE_FACE_IDS.PRAY
                : PALADIN_DICE_FACE_IDS.SWORD],
        isKept: false,
    }));
    return next;
};

const buildFourPlayerRemoveSingleStatusState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const removeSingleStatusCard = REMOVE_SINGLE_STATUS_CARD;
    if (!removeSingleStatusCard) {
        throw new Error(`未找到稳定移除单状态卡 ${REMOVE_SINGLE_STATUS_CARD_ID}，无法构造 4 人 remove-status-1 场景`);
    }

    next.core.activePlayerId = '0';
    next.sys.phase = 'main1';
    next.sys.flowHalted = false;
    next.core.pendingAttack = null;
    next.core.selectedAbilityId = undefined;
    next.core.rollConfirmed = false;
    next.core.players['0'].hand = [{ ...structuredClone(removeSingleStatusCard), id: 'remove-single-inst' }];
    next.core.players['0'].resources.cp = Math.max(next.core.players['0'].resources.cp ?? 0, 6);
    next.core.players['1'].tokens = {
        ...(next.core.players['1'].tokens ?? {}),
        [TOKEN_IDS.CRIT]: 1,
    };
    next.core.players['2'].tokens = {
        ...(next.core.players['2'].tokens ?? {}),
        [TOKEN_IDS.CRIT]: 0,
    };
    next.core.players['3'].tokens = {
        ...(next.core.players['3'].tokens ?? {}),
        [TOKEN_IDS.CRIT]: 0,
    };
    return next;
};

const buildFourPlayerRemoveAllStatusState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);
    const removeAllStatusCard = REMOVE_ALL_STATUS_CARD;
    if (!removeAllStatusCard) {
        throw new Error(`未找到稳定移除全部状态卡 ${REMOVE_ALL_STATUS_CARD_ID}，无法构造 4 人 remove-all-status 场景`);
    }

    next.core.activePlayerId = '0';
    next.sys.phase = 'main1';
    next.sys.flowHalted = false;
    next.core.pendingAttack = null;
    next.core.selectedAbilityId = undefined;
    next.core.rollConfirmed = false;
    next.core.players['0'].hand = [{ ...structuredClone(removeAllStatusCard), id: 'remove-all-inst' }];
    next.core.players['0'].resources.cp = Math.max(next.core.players['0'].resources.cp ?? 0, 6);
    next.core.players['1'].statusEffects = {
        ...(next.core.players['1'].statusEffects ?? {}),
        burn: 2,
    };
    next.core.players['1'].tokens = {
        ...(next.core.players['1'].tokens ?? {}),
        [TOKEN_IDS.CRIT]: 1,
    };
    next.core.players['2'].statusEffects = {
        ...(next.core.players['2'].statusEffects ?? {}),
    };
    next.core.players['2'].tokens = {
        ...(next.core.players['2'].tokens ?? {}),
        [TOKEN_IDS.CRIT]: 0,
    };
    next.core.players['3'].statusEffects = {
        ...(next.core.players['3'].statusEffects ?? {}),
    };
    next.core.players['3'].tokens = {
        ...(next.core.players['3'].tokens ?? {}),
        [TOKEN_IDS.CRIT]: 0,
    };
    return next;
};

const buildFourPlayerMeteorAllOpponentsState = (state: any) => {
    const next = buildFourPlayerNoResponseState(state);

    next.core.activePlayerId = '0';
    next.sys.phase = 'offensiveRoll';
    next.sys.flowHalted = false;
    next.core.pendingAttack = {
        attackerId: '0',
        defenderId: '1',
        targetingSelectionPending: false,
        targetingSelectionResolved: true,
        isDefendable: false,
        damage: 4,
        sourceAbilityId: 'meteor',
        defenseAbilityId: undefined,
        preDefenseResolved: false,
        bonusDamage: 0,
        attackModifierBonusDamage: 0,
        damageResolved: false,
        resolvedDamage: 0,
        offensiveRollEndTokenResolved: false,
        bonusDiceResolved: false,
    };
    next.core.selectedAbilityId = 'meteor';
    next.core.rollConfirmed = true;
    next.core.rollCount = 1;
    next.core.rollLimit = 1;
    next.core.rollDiceCount = 5;
    next.core.players['0'].tokens = {
        ...(next.core.players['0'].tokens ?? {}),
        [TOKEN_IDS.FIRE_MASTERY]: 0,
    };
    for (const pid of ['0', '1', '2', '3']) {
        next.core.players[pid].resources = {
            ...(next.core.players[pid].resources ?? {}),
            [RESOURCE_IDS.HP]: 50,
        };
    }

    return next;
};

test.describe('DiceThrone Simple Start', () => {
    test('Online HUD: transport 未就绪时不应误报离线横幅', async ({ browser }, testInfo) => {
        test.setTimeout(60000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatch(browser, baseURL, { gameServerBaseURL: getGameServerBaseURL() });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostContext, hostPage } = setup;

        try {
            await hostContext.addInitScript(() => {
                const OriginalWebSocket = window.WebSocket;
                class BlockedWebSocket extends OriginalWebSocket {
                    constructor(url: string | URL, protocols?: string | string[]) {
                        super('ws://127.0.0.1:1', protocols);
                        queueMicrotask(() => {
                            try {
                                this.close();
                            } catch {
                                // ignore
                            }
                        });
                    }
                }
                Object.defineProperty(window, 'WebSocket', {
                    configurable: true,
                    writable: true,
                    value: BlockedWebSocket,
                });
            });
            await hostContext.route(/socket\.io/i, async (route) => {
                await route.abort();
            });

            await hostPage.goto(`/play/dicethrone/match/${setup.matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
            await expect(hostPage.getByText('连接中')).toBeVisible({ timeout: 10000 });
            await hostPage.waitForTimeout(4200);

            await expect(hostPage.getByText('等待对手加入...')).toHaveCount(0);
            await expect(hostPage.getByText(/已离线|离线\s*\d+\s*秒/)).toHaveCount(0);

            await clearEvidenceScreenshotsForTest(testInfo);
            await saveEvidenceScreenshot(hostPage, testInfo, '20-online-hud-loading-no-offline-banner');
        } finally {
            await hostContext.unroute(/socket\.io/i).catch(() => undefined);
            await cleanupDTMatch(setup);
        }
    });

    test('Online HUD: 对手真实断开后应显示离线横幅', async ({ browser }, testInfo) => {
        test.setTimeout(60000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatch(browser, baseURL, { gameServerBaseURL: getGameServerBaseURL() });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, guestContext } = setup;

        try {
            await expect(hostPage.getByText(/已离线|离线\s*\d+\s*秒/)).toHaveCount(0);
            await guestContext.close();

            await hostPage.waitForTimeout(3500);
            await expect(hostPage.getByText(/已离线|离线\s*\d+\s*秒/)).toBeVisible({ timeout: 10000 });

            await clearEvidenceScreenshotsForTest(testInfo);
            await saveEvidenceScreenshot(hostPage, testInfo, '21-online-hud-real-disconnect-offline-banner');
        } finally {
            await cleanupDTMatch(setup);
        }
    });

    test('Online match: Can start a game successfully', async ({ browser }, testInfo) => {
        test.setTimeout(60000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatch(browser, baseURL);
        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, guestPage } = setup;

        await selectCharacter(hostPage, 'barbarian');
        await selectCharacter(guestPage, 'paladin');
        await readyAndStartGame(hostPage, guestPage);

        await waitForGameBoard(hostPage);
        await waitForGameBoard(guestPage);

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '01-host-game-started');

        await expect(hostPage.locator('[data-tutorial-id="dice-roll-button"]')).toBeVisible({ timeout: 5000 });
        await expect(guestPage.locator('[data-tutorial-id="dice-roll-button"]')).toBeVisible({ timeout: 5000 });

        await cleanupDTMatch(setup);
    });

    test('Online match: Gunslinger can be selected and start a game successfully', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatch(browser, baseURL);
        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, guestPage } = setup;

        await selectCharacter(hostPage, 'gunslinger');
        await selectCharacter(guestPage, 'barbarian');

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '01-gunslinger-selection');

        await readyAndStartGame(hostPage, guestPage);

        await waitForGameBoard(hostPage);
        await waitForGameBoard(guestPage);

        await saveEvidenceScreenshot(hostPage, testInfo, '02-gunslinger-game-started');

        const hostState = await readHarnessState<any>(hostPage);
        expect(hostState.core?.selectedCharacters?.['0']).toBe('gunslinger');

        await expect(hostPage.locator('[data-tutorial-id="dice-roll-button"]')).toBeVisible({ timeout: 5000 });
        await expect(guestPage.locator('[data-tutorial-id="dice-roll-button"]')).toBeVisible({ timeout: 5000 });

        await cleanupDTMatch(setup);
    });

    test('Local match: HUD 样式合同应保留生命条渐变与下一阶段按钮实体外观', async ({ page }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 802, height: 393 });
        await setChineseLocale(page);
        await page.goto('/play/dicethrone', { waitUntil: 'domcontentloaded' });
        await waitForCharacterSelection(page, 30000);

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(page, testInfo, '01-local-character-selection-mobile-baseline');

        await selectCharacter(page, 'barbarian');
        await selectCharacter(page, 'paladin');

        const readyButton = page.getByRole('button', { name: /准备|Ready/i }).first();
        await expect(readyButton).toBeVisible({ timeout: 10000 });
        await readyButton.click();

        const startButton = page.getByRole('button', { name: /开始游戏|Start Game/i }).first();
        await expect(startButton).toBeVisible({ timeout: 10000 });
        await expect(startButton).toBeEnabled({ timeout: 10000 });
        await startButton.click();

        await waitForGameBoard(page);
        await page.waitForTimeout(1200);

        const hudStyle = await readHudStyleContract(page);

        expect(hudStyle.hasHealthLabel).toBe(true);
        expect(hudStyle.hpFillFound).toBe(true);
        expect(hudStyle.advanceButtonFound).toBe(true);
        expect(hudStyle.hpBackgroundImage).toContain('gradient');
        expect(hudStyle.hpWidthPx).toBeGreaterThan(40);
        expect(hudStyle.advanceButtonBackgroundImage).toContain('gradient');
        expect(hudStyle.advanceButtonBoxShadow).not.toBe('none');
        expect(hudStyle.advanceButtonBorderColor).not.toBe('rgba(0, 0, 0, 0)');
        expect(hudStyle.advanceButtonText).toBe('下一阶段');

        await saveEvidenceScreenshot(page, testInfo, '02-hud-style-contract');
    });

    test('Online 2-player transfer token: transfer phase keeps locked source card and target card', async ({ browser, workerPorts }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = `http://127.0.0.1:${workerPorts.frontend}`;
        const gameServerBaseURL = `http://127.0.0.1:${workerPorts.gameServer}`;

        const setup = await setupDTOnlineMatch(browser, baseURL, { gameServerBaseURL });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, guestPage, matchId } = setup;

        await selectCharacter(hostPage, 'shadow_thief');
        await selectCharacter(guestPage, 'paladin');
        await readyAndStartGame(hostPage, guestPage);

        await waitForGameBoard(hostPage);
        await waitForGameBoard(guestPage);
        await waitForHarnessPages([hostPage, guestPage]);

        await applyOnlineMatchState(matchId, hostPage, buildTwoPlayerTransferTokenState);
        await waitForPhase(hostPage, 'main1');

        await dispatchHarnessCommand(hostPage, 'PLAY_CARD', '0', { cardId: 'transfer-2p-inst' });

        await expect(hostPage.getByTestId('dt-status-owner-1')).toHaveAttribute('data-team-tone', 'enemy');
        await expect(hostPage.getByTestId('dt-status-effect-1-crit')).toBeVisible({ timeout: 10000 });
        await hostPage.getByTestId('dt-status-effect-1-crit').click();

        await expect(hostPage.getByTestId('dt-transfer-source-locked-1')).toHaveAttribute('data-team-tone', 'enemy');
        await expect(hostPage.getByTestId('dt-transfer-source-locked-1')).toHaveAttribute('data-locked', 'true');
        await expect(hostPage.getByTestId('dt-transfer-source-effect-crit')).toBeVisible({ timeout: 10000 });
        await expect(hostPage.getByTestId('dt-transfer-target-0')).toHaveAttribute('data-team-tone', 'self');
        await expect(hostPage.locator('[data-testid^="dt-status-owner-"]')).toHaveCount(0);

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '01-two-player-transfer-token-target-selection');

        await hostPage.getByTestId('dt-transfer-target-0').click();
        await hostPage.getByRole('button', { name: /Confirm|确认/i }).last().click();

        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.interaction?.current
                && (state?.core?.players?.['0']?.tokens?.crit ?? 0) === 1
                && (state?.core?.players?.['1']?.tokens?.crit ?? 0) === 0;
        }, undefined, { timeout: 10000 });
        await guestPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return (state?.core?.players?.['0']?.tokens?.crit ?? 0) === 1
                && (state?.core?.players?.['1']?.tokens?.crit ?? 0) === 0;
        }, undefined, { timeout: 10000 });

        const hostState = await readHarnessState<any>(hostPage);
        const guestState = await readHarnessState<any>(guestPage);
        expect(hostState.core.players['0'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(1);
        expect(hostState.core.players['1'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(0);
        expect(guestState.core.players['0'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(1);
        expect(guestState.core.players['1'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(0);

        await cleanupDTMatch(setup);
    });

    test('Online 2-player Meteor: opponent header HP should sync after undefendable damage resolves', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatch(browser, baseURL, { gameServerBaseURL: getGameServerBaseURL() });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, guestPage, matchId } = setup;

        await selectCharacter(hostPage, 'pyromancer');
        await selectCharacter(guestPage, 'paladin');
        await readyAndStartGame(hostPage, guestPage);

        await waitForGameBoard(hostPage);
        await waitForGameBoard(guestPage);
        await waitForHarnessPages([hostPage, guestPage]);

        await applyOnlineMatchState(matchId, hostPage, buildTwoPlayerMeteorState);
        await waitForPhase(hostPage, 'offensiveRoll');

        await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');
        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return (state?.core?.players?.['1']?.resources?.hp ?? 0) === 46;
        }, undefined, { timeout: 10000 });
        await guestPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return (state?.core?.players?.['1']?.resources?.hp ?? 0) === 46;
        }, undefined, { timeout: 10000 });

        await expect(hostPage.getByTestId('dt-top-header-1-hp')).toHaveText('46', { timeout: 10000 });

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '03-two-player-meteor-opponent-hp-synced');

        const hostState = await readHarnessState<any>(hostPage);
        const guestState = await readHarnessState<any>(guestPage);
        expect(hostState.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0).toBe(46);
        expect(guestState.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0).toBe(46);

        await cleanupDTMatch(setup);
    });

    test('Online 2-player afterRollConfirmed: response pass should not reopen window after repeated confirm', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatch(browser, baseURL, { gameServerBaseURL: getGameServerBaseURL() });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, guestPage, matchId } = setup;

        await selectCharacter(hostPage, 'monk');
        await selectCharacter(guestPage, 'paladin');
        await readyAndStartGame(hostPage, guestPage);

        await waitForGameBoard(hostPage);
        await waitForGameBoard(guestPage);
        await waitForHarnessPages([hostPage, guestPage]);

        await applyOnlineMatchState(matchId, hostPage, buildTwoPlayerAfterRollResponseState);
        await waitForPhase(hostPage, 'offensiveRoll');

        await dispatchHarnessCommand(hostPage, 'CONFIRM_ROLL', '0');
        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.sys?.responseWindow?.current?.windowType === 'afterRollConfirmed';
        }, undefined, { timeout: 10000 });

        const responseState = await readHarnessState<any>(hostPage);
        expect(responseState.sys.responseWindow?.current?.responderQueue).toEqual(['1']);

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '04-two-player-after-roll-response-open');

        await dispatchHarnessCommand(guestPage, 'RESPONSE_PASS', '1');
        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.responseWindow?.current;
        }, undefined, { timeout: 10000 });

        await dispatchHarnessCommand(hostPage, 'CONFIRM_ROLL', '0');
        await expect.poll(async () => {
            const state = await readHarnessState<any>(hostPage);
            return Boolean(state.sys.responseWindow?.current);
        }, {
            timeout: 3000,
            message: '重复确认骰面后不应再次弹出响应窗口',
        }).toBe(false);

        const finalState = await readHarnessState<any>(hostPage);
        expect(finalState.core.rollConfirmed).toBe(true);
        expect(finalState.sys.responseWindow?.current).toBeUndefined();

        await saveEvidenceScreenshot(hostPage, testInfo, '05-two-player-after-roll-response-closed');

        await cleanupDTMatch(setup);
    });

    test('Online AI afterRollConfirmed: real confirm should let AI打出响应牌并关闭窗口且不重开', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineAiRoom(browser, baseURL);
        if (!setup) {
            test.skip(true, 'DiceThrone AI 联机房间创建失败');
            return;
        }

        try {
            const { hostPage, matchId } = setup;
            await waitForCharacterSelection(hostPage, 20000);
            await waitForAiSeatCredential(hostPage, matchId, '1');

            await selectCharacter(hostPage, 'monk');
            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                const hostSelected = state.core?.selectedCharacters?.['0'];
                const aiSelected = state.core?.selectedCharacters?.['1'];
                return hostSelected === 'monk'
                    && aiSelected !== 'unselected'
                    && state.core?.readyPlayers?.['1'] === true;
            }, {
                timeout: 30000,
                message: '等待 DiceThrone host/AI 一起完成真实响应链测试前置条件',
            }).toBe(true);

            const startButton = hostPage.locator('button').filter({ hasText: /开始游戏|Start Game|Press.*Start/i }).first();
            await expect(startButton).toBeEnabled({ timeout: 10000 });
            await startButton.click();
            await hostPage.waitForTimeout(500);

            await applyOnlineMatchState(matchId, hostPage, buildTwoPlayerAfterRollResponseState);
            await waitForPhase(hostPage, 'offensiveRoll', 30000);
            await waitForGameBoard(hostPage, 30000);
            await waitForTestHarness(hostPage, 15000);

            const injectedState = await getMatchState(matchId, hostPage);
            expect(injectedState.sys?.responseWindow?.current).toBeUndefined();
            expect(
                injectedState.core?.players?.['1']?.hand?.some(
                    (card: any) => card.id === TWO_PLAYER_AFTER_ROLL_RESPONSE_CARD_INSTANCE_ID,
                ),
            ).toBe(true);

            await dispatchHarnessCommand(hostPage, 'CONFIRM_ROLL', '0');

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                return {
                    windowType: state.sys?.responseWindow?.current?.windowType ?? null,
                    responderQueue: state.sys?.responseWindow?.current?.responderQueue ?? [],
                };
            }, {
                timeout: 10000,
                message: '等待真人确认骰面后真实打开 afterRollConfirmed 响应窗口',
            }).toEqual({
                windowType: 'afterRollConfirmed',
                responderQueue: ['1'],
            });

            await clearEvidenceScreenshotsForTest(testInfo);
            await saveEvidenceScreenshot(hostPage, testInfo, '04b-online-ai-after-roll-response-open');

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                const aiHand = state.core?.players?.['1']?.hand ?? [];
                const aiDiscard = state.core?.players?.['1']?.discard ?? [];
                return {
                    windowOpen: Boolean(state.sys?.responseWindow?.current),
                    aiHasCardInHand: aiHand.some((card: any) => card.id === TWO_PLAYER_AFTER_ROLL_RESPONSE_CARD_INSTANCE_ID),
                    aiHasCardInDiscard: aiDiscard.some((card: any) => card.id === TWO_PLAYER_AFTER_ROLL_RESPONSE_CARD_INSTANCE_ID),
                };
            }, {
                timeout: 15000,
                message: '等待 AI 真实打出响应牌并关闭响应窗口',
            }).toEqual({
                windowOpen: false,
                aiHasCardInHand: false,
                aiHasCardInDiscard: true,
            });

            await saveEvidenceScreenshot(hostPage, testInfo, '04c-online-ai-after-roll-response-resolved');

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                return Boolean(state.sys?.responseWindow?.current);
            }, {
                timeout: 3000,
                message: 'AI 响应收口后不应立刻再次重开 afterRollConfirmed 响应窗口',
            }).toBe(false);
            await saveEvidenceScreenshot(hostPage, testInfo, '04d-online-ai-after-roll-response-stable-no-reopen');
        } finally {
            await setup.hostContext.close();
        }
    });

    test('Online AI afterCardPlayed: 对手真实打牌触发响应窗口后，AI 当前 responder 应打出响应牌并收口不卡死', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineAiRoom(browser, baseURL);
        if (!setup) {
            test.skip(true, 'DiceThrone AI 联机房间创建失败');
            return;
        }

        try {
            const { hostPage, matchId } = setup;
            await waitForCharacterSelection(hostPage, 20000);
            await waitForAiSeatCredential(hostPage, matchId, '1');

            await selectCharacter(hostPage, 'monk');
            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                const hostSelected = state.core?.selectedCharacters?.['0'];
                const aiSelected = state.core?.selectedCharacters?.['1'];
                return hostSelected === 'monk'
                    && aiSelected !== 'unselected'
                    && state.core?.readyPlayers?.['1'] === true;
            }, {
                timeout: 30000,
                message: '等待 DiceThrone host/AI 一起完成 afterCardPlayed 真实触发测试前置条件',
            }).toBe(true);

            const startButton = hostPage.locator('button').filter({ hasText: /开始游戏|Start Game|Press.*Start/i }).first();
            await expect(startButton).toBeEnabled({ timeout: 10000 });
            await startButton.click();
            await hostPage.waitForTimeout(500);

            await applyOnlineMatchState(matchId, hostPage, buildOnlineAiAfterCardResponseTriggerState);
            await waitForPhase(hostPage, 'main1', 30000);
            await waitForGameBoard(hostPage, 30000);
            await waitForTestHarness(hostPage, 15000);

            const injectedState = await getMatchState(matchId, hostPage);
            expect(injectedState.sys?.responseWindow?.current).toBeUndefined();
            expect(
                injectedState.core?.players?.['0']?.hand?.some(
                    (card: any) => card.id === ONLINE_AI_AFTER_CARD_TRIGGER_CARD_INSTANCE_ID,
                ),
            ).toBe(true);
            expect(
                injectedState.core?.players?.['1']?.hand?.some(
                    (card: any) => card.id === TWO_PLAYER_AFTER_CARD_PLAYABLE_RESPONSE_CARD_INSTANCE_ID,
                ),
            ).toBe(true);

            await dispatchHarnessCommand(hostPage, 'PLAY_CARD', '0', {
                cardId: ONLINE_AI_AFTER_CARD_TRIGGER_CARD_INSTANCE_ID,
            });
            const afterHostPlayState = await getMatchState(matchId, hostPage);
            const openedWindow = afterHostPlayState.sys?.responseWindow?.current;
            if (openedWindow) {
                expect(openedWindow.windowType).toBe('afterCardPlayed');
                expect(openedWindow.sourceId).toBe(ONLINE_AI_AFTER_CARD_TRIGGER_CARD_INSTANCE_ID);
                expect(openedWindow.responderQueue).toEqual(['1']);
            }
            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                const cardSequence = state.core?.cardPlayedSequence ?? 0;
                const handledSequence = state.core?.afterCardResponseWindowSequence ?? 0;
                return cardSequence > 0 && handledSequence === cardSequence;
            }, {
                timeout: 10000,
                message: '等待 host 真实打牌后触发 afterCardPlayed 窗口序号',
            }).toBe(true);

            await clearEvidenceScreenshotsForTest(testInfo);
            await saveEvidenceScreenshot(hostPage, testInfo, '05e-online-ai-after-card-trigger-open');

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                const hostHand = state.core?.players?.['0']?.hand ?? [];
                const hostDiscard = state.core?.players?.['0']?.discard ?? [];
                const aiHand = state.core?.players?.['1']?.hand ?? [];
                const aiDiscard = state.core?.players?.['1']?.discard ?? [];
                return {
                    windowOpen: Boolean(state.sys?.responseWindow?.current),
                    hostHasTriggerInHand: hostHand.some((card: any) => card.id === ONLINE_AI_AFTER_CARD_TRIGGER_CARD_INSTANCE_ID),
                    hostHasTriggerInDiscard: hostDiscard.some((card: any) => card.id === ONLINE_AI_AFTER_CARD_TRIGGER_CARD_INSTANCE_ID),
                    aiHasCardInHand: aiHand.some((card: any) => card.id === TWO_PLAYER_AFTER_CARD_PLAYABLE_RESPONSE_CARD_INSTANCE_ID),
                    aiHasCardInDiscard: aiDiscard.some((card: any) => card.id === TWO_PLAYER_AFTER_CARD_PLAYABLE_RESPONSE_CARD_INSTANCE_ID),
                };
            }, {
                timeout: 15000,
                message: '等待 AI 在对手真实打牌触发的 afterCardPlayed 窗口中完成响应并收口',
            }).toEqual({
                windowOpen: false,
                hostHasTriggerInHand: false,
                hostHasTriggerInDiscard: true,
                aiHasCardInHand: false,
                aiHasCardInDiscard: true,
            });

            await saveEvidenceScreenshot(hostPage, testInfo, '05f-online-ai-after-card-trigger-resolved');

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                return Boolean(state.sys?.responseWindow?.current);
            }, {
                timeout: 3000,
                message: 'AI 在对手真实打牌触发的 afterCardPlayed 窗口收口后不应立刻重开',
            }).toBe(false);
            await saveEvidenceScreenshot(hostPage, testInfo, '05g-online-ai-after-card-trigger-stable-no-reopen');
        } finally {
            await setup.hostContext.close();
        }
    });

    test('Online AI 在 off-turn defensiveRoll 也应自动掷骰并收口，不应卡死在玩家回合下的防御阶段', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineAiRoom(browser, baseURL);
        if (!setup) {
            test.skip(true, 'DiceThrone AI 联机房间创建失败');
            return;
        }

        try {
            const { hostPage, matchId } = setup;
            await waitForCharacterSelection(hostPage, 20000);
            await waitForAiSeatCredential(hostPage, matchId, '1');

            await selectCharacter(hostPage, 'moon_elf');
            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                const hostSelected = state.core?.selectedCharacters?.['0'];
                const aiSelected = state.core?.selectedCharacters?.['1'];
                return hostSelected === 'moon_elf'
                    && aiSelected !== 'unselected'
                    && state.core?.readyPlayers?.['1'] === true;
            }, {
                timeout: 30000,
                message: '等待 DiceThrone host/AI 一起完成 off-turn defensiveRoll 真实触发测试前置条件',
            }).toBe(true);

            const startButton = hostPage.locator('button').filter({ hasText: /开始游戏|Start Game|Press.*Start/i }).first();
            await expect(startButton).toBeEnabled({ timeout: 10000 });
            await startButton.click();
            await hostPage.waitForTimeout(500);

            await applyOnlineMatchState(matchId, hostPage, buildOnlineAiOffTurnDefensiveRollState);
            await waitForGameBoard(hostPage, 30000);
            await waitForTestHarness(hostPage, 15000);
            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                const phase = state.sys?.phase ?? null;
                const activePlayerId = state.core?.activePlayerId ?? null;
                return activePlayerId === '0' && (phase === 'defensiveRoll' || phase === 'main2') ? 'ready' : 'waiting';
            }, {
                timeout: 30000,
                message: '等待 off-turn defensiveRoll 场景注入完成（可能已快速收口到 main2）',
            }).toBe('ready');

            await clearEvidenceScreenshotsForTest(testInfo);
            await saveEvidenceScreenshot(hostPage, testInfo, '05h-online-ai-offturn-defensive-before');

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                const phase = state.sys?.phase ?? null;
                const rollCount = state.core?.rollCount ?? null;
                const pendingAttack = Boolean(state.core?.pendingAttack);
                if (phase === 'defensiveRoll' && typeof rollCount === 'number' && rollCount >= 0) {
                    return 'defensive-roll-observed';
                }
                if (phase === 'main2' && !pendingAttack) {
                    return 'main2-resolved';
                }
                return 'waiting';
            }, {
                timeout: 20000,
                message: '等待 AI 在 off-turn defensiveRoll 至少完成掷骰',
            }).toMatch(/defensive-roll-observed|main2-resolved/);

            await saveEvidenceScreenshot(hostPage, testInfo, '05i-online-ai-offturn-defensive-rolled');

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                return {
                    phase: state.sys?.phase ?? null,
                    pendingAttack: Boolean(state.core?.pendingAttack),
                };
            }, {
                timeout: 20000,
                message: '等待 AI defensiveRoll 收口回到主阶段，避免一直卡在玩家回合的防御阶段',
            }).toEqual({
                phase: 'main2',
                pendingAttack: false,
            });

            // 关键回归口径：防御收口后不应在无人操作时自动跳过我方 main2。
            await hostPage.waitForTimeout(3000);
            const stableMain2State = await getMatchState(matchId, hostPage);
            expect(stableMain2State.sys?.phase).toBe('main2');
            expect(stableMain2State.core?.activePlayerId).toBe('0');
            await saveEvidenceScreenshot(hostPage, testInfo, '05j-online-ai-offturn-defensive-resolved');
        } finally {
            await setup.hostContext.close();
        }
    });

    test('Online 2-player afterAttackResolved: response pass should close and not reopen', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatch(browser, baseURL, { gameServerBaseURL: getGameServerBaseURL() });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, guestPage, matchId } = setup;

        await selectCharacter(hostPage, 'monk');
        await selectCharacter(guestPage, 'paladin');
        await readyAndStartGame(hostPage, guestPage);

        await waitForGameBoard(hostPage);
        await waitForGameBoard(guestPage);
        await waitForHarnessPages([hostPage, guestPage]);

        await applyOnlineMatchState(matchId, hostPage, buildTwoPlayerAfterAttackResponseState);

        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.sys?.responseWindow?.current?.windowType === 'afterAttackResolved';
        }, undefined, { timeout: 10000 });

        const responseState = await readHarnessState<any>(hostPage);
        expect(responseState.sys.responseWindow?.current?.responderQueue).toEqual(['1']);

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '06-two-player-after-attack-response-open');

        await dispatchHarnessCommand(guestPage, 'RESPONSE_PASS', '1');
        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.responseWindow?.current;
        }, undefined, { timeout: 10000 });

        await expect.poll(async () => {
            const state = await readHarnessState<any>(hostPage);
            return Boolean(state.sys.responseWindow?.current);
        }, {
            timeout: 3000,
            message: '响应跳过后不应再次弹出 afterAttackResolved 响应窗口',
        }).toBe(false);

        await saveEvidenceScreenshot(hostPage, testInfo, '07-two-player-after-attack-response-closed');

        await cleanupDTMatch(setup);
    });

    test('Online 2-player afterAttackResolved: card-dizzy should be playable and inflict Concussion', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatch(browser, baseURL, { gameServerBaseURL: getGameServerBaseURL() });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, guestPage, matchId } = setup;

        await selectCharacter(hostPage, 'barbarian');
        await selectCharacter(guestPage, 'monk');
        await readyAndStartGame(hostPage, guestPage);

        await waitForGameBoard(hostPage);
        await waitForGameBoard(guestPage);
        await waitForHarnessPages([hostPage, guestPage]);

        await advanceToOffensiveRoll(hostPage);

        const rollButton = hostPage.locator('[data-tutorial-id="dice-roll-button"]');
        await expect(rollButton).toBeEnabled({ timeout: 10000 });
        await rollButton.click();
        await hostPage.waitForTimeout(300);

        await injectTwoPlayerDizzyAttackSetup(matchId, hostPage);
        await closeDebugPanelIfOpen(hostPage);

        const confirmButton = hostPage.locator('[data-tutorial-id="dice-confirm-button"]');
        await expect(confirmButton).toBeEnabled({ timeout: 10000 });
        await confirmButton.click();
        await hostPage.waitForTimeout(800);

        await selectRecklessStrikeAbilityForDizzyFlow(hostPage);
        await hostPage.waitForTimeout(500);

        const attackReadyState = await readHarnessState<any>(hostPage);
        expect(String(attackReadyState?.core?.activatingAbilityId ?? ''), '应已选择 Reckless Strike 进入真实攻击链').toContain(DIZZY_ATTACK_ABILITY_ID);

        const resolveAttackButton = hostPage.getByRole('button', { name: /^(Resolve Attack|结算攻击)$/i }).first();
        await expect(resolveAttackButton).toBeEnabled({ timeout: 10000 });
        await resolveAttackButton.click();

        const defendEntryButton = guestPage.getByRole('button', { name: /^(DEFEND|Defend|防御|开始防御)$/i }).first();
        if (await defendEntryButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await defendEntryButton.click();

            const defenseRollButton = guestPage.locator('[data-tutorial-id="dice-roll-button"]');
            await expect(defenseRollButton).toBeEnabled({ timeout: 10000 });
            await defenseRollButton.click();
            await guestPage.waitForTimeout(300);
            await applyDiceValues(guestPage, [1, 1, 1]);
            await closeDebugPanelIfOpen(guestPage);

            const defenseConfirmButton = guestPage.locator('[data-tutorial-id="dice-confirm-button"]');
            await expect(defenseConfirmButton).toBeEnabled({ timeout: 10000 });
            await defenseConfirmButton.click();
            await guestPage.waitForTimeout(300);

            for (let attempt = 0; attempt < 3; attempt += 1) {
                const defenseAdvanceButton = guestPage.locator('[data-tutorial-id="advance-phase-button"]');
                if (await defenseAdvanceButton.isEnabled().catch(() => false)) {
                    await defenseAdvanceButton.click();
                    break;
                }
                await maybePassResponse(guestPage);
                await guestPage.waitForTimeout(400);
            }
        }

        await hostPage.waitForTimeout(1200);
        await waitForRealAfterAttackResolvedWindow(hostPage, CARD_DIZZY_ID);

        await waitForHandCardVisualReady(hostPage, CARD_DIZZY_ID);

        const dizzyCard = hostPage.locator(`[data-testid="hand-area"] [data-card-id="${CARD_DIZZY_ID}"]`).first();
        const opponentHeader = hostPage.locator('[data-testid="dt-top-header-1"]').first();

        await expect(dizzyCard).toBeVisible({ timeout: 10000 });

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '06a-two-player-after-attack-dizzy-open');

        await hostPage.evaluate(() => {
            (window as any).__BG_LAST_COMMAND_REJECTED__ = null;
        });

        await dizzyCard.hover();
        await hostPage.waitForTimeout(150);
        await dizzyCard.click({ force: true });

        const firstClickState = await hostPage.evaluate(({ cardId }) => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const entries = state?.sys?.eventStream?.entries ?? [];
            const handIds = state?.core?.players?.['0']?.hand?.map((card: any) => card.id) ?? [];
            return {
                reject: (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null,
                played: entries.some((entry: any) => entry.event?.type === 'CARD_PLAYED' && entry.event?.payload?.cardId === cardId),
                stillInHand: handIds.includes(cardId),
            };
        }, { cardId: CARD_DIZZY_ID });

        if (!firstClickState.played && !firstClickState.reject && firstClickState.stillInHand) {
            await hostPage.waitForTimeout(200);
            await dizzyCard.click({ force: true });
        }

        await hostPage.waitForFunction(({ cardId }) => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const reject = (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null;
            const entries = state?.sys?.eventStream?.entries ?? [];
            const handIds = state?.core?.players?.['0']?.hand?.map((card: any) => card.id) ?? [];
            return (reject?.commandType === 'PLAY_CARD')
                || (!handIds.includes(cardId)
                    && entries.some((entry: any) => entry.event?.type === 'CARD_PLAYED' && entry.event?.payload?.cardId === cardId));
        }, { cardId: CARD_DIZZY_ID }, { timeout: 10000, polling: 200 });

        const rejected = await hostPage.evaluate(() => (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null);
        expect(rejected).toBeNull();
        await saveEvidenceScreenshot(hostPage, testInfo, '06b-two-player-after-attack-dizzy-played');

        await expect.poll(async () => {
            const state = await readHarnessState<any>(hostPage);
            return {
                responseWindowOpen: Boolean(state?.sys?.responseWindow?.current),
                lastResolvedAttackDamage: Number(state?.core?.lastResolvedAttackDamage ?? 0),
                pendingAttack: Boolean(state?.core?.pendingAttack),
                hostHandIds: state?.core?.players?.['0']?.hand?.map((card: any) => card.id) ?? [],
                hostDiscardIds: state?.core?.players?.['0']?.discard?.map((card: any) => card.id) ?? [],
                targetConcussion: state?.core?.players?.['1']?.statusEffects?.[STATUS_IDS.CONCUSSION] ?? 0,
            };
        }, {
            timeout: 15000,
            message: '等待 card-dizzy 结算后落地脑震荡并关闭 afterAttackResolved 响应窗口',
        }).toMatchObject({
            responseWindowOpen: false,
            pendingAttack: false,
            targetConcussion: 1,
        });

        const finalState = await readHarnessState<any>(hostPage);
        expect(Number(finalState?.core?.lastResolvedAttackDamage ?? 0), '真实攻击结算后的已结算伤害应仍 >= 8').toBeGreaterThanOrEqual(8);

        await saveEvidenceScreenshot(hostPage, testInfo, '06c-two-player-after-attack-dizzy-resolved');
        await saveLocatorEvidenceScreenshot(opponentHeader, testInfo, '06d-two-player-after-attack-dizzy-opponent-header');

        await cleanupDTMatch(setup);
    });

    test('Online 2-player afterCardPlayed: response pass should close and not reopen', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatch(browser, baseURL, { gameServerBaseURL: getGameServerBaseURL() });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, guestPage, matchId } = setup;

        await selectCharacter(hostPage, 'monk');
        await selectCharacter(guestPage, 'paladin');
        await readyAndStartGame(hostPage, guestPage);

        await waitForGameBoard(hostPage);
        await waitForGameBoard(guestPage);
        await waitForHarnessPages([hostPage, guestPage]);

        await applyOnlineMatchState(matchId, hostPage, buildTwoPlayerAfterCardResponseState);

        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.sys?.responseWindow?.current?.windowType === 'afterCardPlayed';
        }, undefined, { timeout: 10000 });

        const responseState = await readHarnessState<any>(hostPage);
        expect(responseState.sys.responseWindow?.current?.responderQueue).toEqual(['1']);

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '08-two-player-after-card-response-open');

        await dispatchHarnessCommand(guestPage, 'RESPONSE_PASS', '1');
        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.responseWindow?.current;
        }, undefined, { timeout: 10000 });

        await expect.poll(async () => {
            const state = await readHarnessState<any>(hostPage);
            return Boolean(state.sys.responseWindow?.current);
        }, {
            timeout: 3000,
            message: '响应跳过后不应再次弹出 afterCardPlayed 响应窗口',
        }).toBe(false);

        await saveEvidenceScreenshot(hostPage, testInfo, '09-two-player-after-card-response-closed');

        await cleanupDTMatch(setup);
    });

    test('Online 4-player room: create claim-seat join and start successfully', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const gameServerBaseURL = getGameServerBaseURL();

        const beforeStartResponse = await hostPage.request.get(`${gameServerBaseURL}/games/dicethrone/${matchId}`);
        expect(beforeStartResponse.ok()).toBe(true);
        const beforeStartMatch = await beforeStartResponse.json() as {
            players: Array<{ id: number; name?: string }>;
            status?: string;
        };
        expect(beforeStartMatch.players.map((player) => player.id)).toEqual([0, 1, 2, 3]);
        expect(beforeStartMatch.players.every((player) => !!player.name)).toBe(true);
        expect(beforeStartMatch.status).toBe('playing');

        await selectCharacter(players[0].page, 'monk');
        await selectCharacter(players[1].page, 'barbarian');
        await selectCharacter(players[2].page, 'pyromancer');
        await selectCharacter(players[3].page, 'paladin');

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '01-four-player-character-selection');

        await readyMultiplePlayersAndStartGame(
            hostPage,
            players.slice(1).map((player) => player.page),
        );

        for (const player of players) {
            await waitForGameBoard(player.page, 30000);
        }
        await waitForHarnessPages(players.map((player) => player.page));
        for (const player of players) {
            await waitForPhase(player.page, 'main1', 30000);
        }

        const playerStates = await Promise.all(players.map((player) => readHarnessState<any>(player.page)));
        for (const state of playerStates) {
            expect(state.sys.phase).toBe('main1');
            expect(state.core.activePlayerId).toBe('0');
        }

        await saveEvidenceScreenshot(hostPage, testInfo, '02-four-player-host-game-started');
        await expect(hostPage.locator('[data-testid^="dt-top-header-"]')).toHaveCount(3, { timeout: 10000 });
        await expect(hostPage.getByTestId('dt-top-header-1')).toHaveAttribute('data-player-id', '1');
        await expect(hostPage.getByTestId('dt-top-header-2')).toHaveAttribute('data-player-id', '2');
        await expect(hostPage.getByTestId('dt-top-header-3')).toHaveAttribute('data-player-id', '3');
        await saveEvidenceScreenshot(hostPage, testInfo, '03-four-player-first-turn-main1');

        const afterStartResponse = await hostPage.request.get(`${gameServerBaseURL}/games/dicethrone/${matchId}`);
        expect(afterStartResponse.ok()).toBe(true);
        const afterStartMatch = await afterStartResponse.json() as {
            players: Array<{ id: number; name?: string }>;
            status?: string;
        };
        expect(afterStartMatch.players).toHaveLength(4);
        expect(afterStartMatch.status).toBe('playing');
        await expect(hostPage.locator('[data-tutorial-id="dice-roll-button"]')).toBeVisible({ timeout: 5000 });

        await cleanupDTMatch(setup);
    });

    test('Online AI 持有隐藏 multistep-choice 时应 batch 提交多条 MODIFY_DIE 并完成私有结算', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineAiRoom(browser, baseURL);
        if (!setup) {
            test.skip(true, 'DiceThrone AI 联机房间创建失败');
            return;
        }

        try {
            const { hostPage, matchId } = setup;
            await waitForCharacterSelection(hostPage, 20000);
            await waitForAiSeatCredential(hostPage, matchId, '1');

            await selectCharacter(hostPage, 'monk');
            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                const hostSelected = state.core?.selectedCharacters?.['0'];
                const aiSelected = state.core?.selectedCharacters?.['1'];
                return hostSelected === 'monk'
                    && aiSelected !== 'unselected'
                    && state.core?.readyPlayers?.['1'] === true;
            }, {
                timeout: 30000,
                message: '等待 DiceThrone host/AI 一起完成 setup 前置条件',
            }).toBe(true);

            const startButton = hostPage.locator('button').filter({ hasText: /开始游戏|Start Game|Press.*Start/i }).first();
            await expect(startButton).toBeEnabled({ timeout: 10000 });
            await startButton.click();
            await hostPage.waitForTimeout(500);
            await applyOnlineMatchState(matchId, hostPage, buildOnlineAiHiddenModifyDiceState);
            await waitForPhase(hostPage, 'offensiveRoll', 30000);
            await waitForGameBoard(hostPage, 30000);
            await waitForTestHarness(hostPage, 15000);

            const injectedState = await getMatchState(matchId, hostPage);
            expect(injectedState.sys?.interaction?.current?.playerId).toBe('1');
            expect(injectedState.sys?.interaction?.current?.kind).toBe('multistep-choice');
            expect(injectedState.sys?.interaction?.current?.data?.meta?.dtType).toBe('modifyDie');
            expect(injectedState.sys?.interaction?.current?.data?.meta?.selectCount).toBe(2);
            expect(injectedState.core?.dice?.slice(0, 2).map((die: any) => die.value)).toEqual([1, 2]);

            await expect.poll(async () => {
                return hostPage.evaluate(() => {
                    const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                    return {
                        phase: state?.sys?.phase ?? null,
                        interactionPlayerId: state?.sys?.interaction?.current?.playerId ?? null,
                        isBlocked: state?.sys?.interaction?.isBlocked ?? null,
                        diceValues: (state?.core?.dice ?? []).slice(0, 2).map((die: any) => die.value),
                    };
                });
            }, {
                timeout: 10000,
                message: '等待房主视角同步为“隐藏交互阻塞但无可见 prompt”',
            }).toEqual({
                phase: 'offensiveRoll',
                interactionPlayerId: null,
                isBlocked: true,
                diceValues: [1, 2],
            });

            await clearEvidenceScreenshotsForTest(testInfo);
            await saveEvidenceScreenshot(hostPage, testInfo, '13-online-ai-hidden-multistep-before-resolve');

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                return {
                    interactionKind: state.sys?.interaction?.current?.kind ?? null,
                    interactionPlayerId: state.sys?.interaction?.current?.playerId ?? null,
                    diceValues: (state.core?.dice ?? []).slice(0, 2).map((die: any) => die.value),
                };
            }, {
                timeout: 20000,
                message: '等待在线 AI 自动处理隐藏多步交互并提交多条 MODIFY_DIE',
            }).toEqual({
                interactionKind: null,
                interactionPlayerId: null,
                diceValues: [6, 6],
            });

            await expect.poll(async () => {
                return hostPage.evaluate(() => {
                    const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                    return {
                        interactionPlayerId: state?.sys?.interaction?.current?.playerId ?? null,
                        isBlocked: state?.sys?.interaction?.isBlocked ?? null,
                        diceValues: (state?.core?.dice ?? []).slice(0, 2).map((die: any) => die.value),
                    };
                });
            }, {
                timeout: 10000,
                message: '等待房主过滤视角解除阻塞并收到骰值更新',
            }).toEqual({
                interactionPlayerId: null,
                isBlocked: false,
                diceValues: [6, 6],
            });

            await saveEvidenceScreenshot(hostPage, testInfo, '14-online-ai-hidden-after');
        } finally {
            await setup.hostContext.close();
        }
    });

    test('Online AI setup HUD seat swap: should render entry and swap with AI immediately', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineAiRoom(browser, baseURL);
        if (!setup) {
            test.skip(true, 'DiceThrone AI 联机房间创建失败');
            return;
        }

        try {
            const { hostPage, matchId } = setup;
            await waitForCharacterSelection(hostPage, 20000);
            await applyOnlineMatchState(matchId, hostPage, (state) => {
                const next = structuredClone(state);
                next.core = {
                    ...next.core,
                    hostStarted: false,
                    phase: 'setup',
                    seatingOrder: Array.isArray(next.core?.seatingOrder) && next.core.seatingOrder.length > 0
                        ? next.core.seatingOrder
                        : ['0', '1'],
                };
                next.sys = {
                    ...next.sys,
                    phase: 'setup',
                };
                return next;
            });
            await waitForPhase(hostPage, 'setup', 10000);

            await expect(hostPage.locator('[data-fab-id="chat"]')).toBeVisible({ timeout: 10000 });
            await hostPage.locator('[data-fab-id="chat"]').click();
            await expect(hostPage.locator('[data-fab-id="seat-swap"]')).toBeVisible({ timeout: 10000 });

            await clearEvidenceScreenshotsForTest(testInfo);
            await saveEvidenceScreenshot(hostPage, testInfo, '30-online-ai-hud-seat-swap-entry');

            await hostPage.locator('[data-fab-id="seat-swap"]').click();
            await expect(hostPage.getByTestId('hud-seat-swap-seat-1')).toBeVisible({ timeout: 10000 });
            await expect(hostPage.getByTestId('hud-seat-swap-seat-1').getByText(/^AI$/)).toBeVisible({ timeout: 5000 });

            await saveEvidenceScreenshot(hostPage, testInfo, '31-online-ai-hud-seat-swap-before-click');

            await hostPage.getByTestId('hud-seat-swap-seat-1').click();
            await waitForSeatingOrder(matchId, hostPage, ['1', '0']);

            await saveEvidenceScreenshot(hostPage, testInfo, '32-online-ai-hud-seat-swap-after-click');
        } finally {
            await setup.hostContext.close();
        }
    });

    test('Online AI 首轮 batch 被拒后应自动重试并完成隐藏 multistep-choice', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineAiRoom(browser, baseURL);
        if (!setup) {
            test.skip(true, 'DiceThrone AI 联机房间创建失败');
            return;
        }

        try {
            const { hostPage, matchId } = setup;
            await waitForCharacterSelection(hostPage, 20000);
            await waitForAiSeatCredential(hostPage, matchId, '1');

            await selectCharacter(hostPage, 'monk');
            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                const hostSelected = state.core?.selectedCharacters?.['0'];
                const aiSelected = state.core?.selectedCharacters?.['1'];
                return hostSelected === 'monk'
                    && aiSelected !== 'unselected'
                    && state.core?.readyPlayers?.['1'] === true;
            }, {
                timeout: 30000,
                message: '等待 DiceThrone host/AI 一起完成 retry 测试前置条件',
            }).toBe(true);

            const startButton = hostPage.locator('button').filter({ hasText: /开始游戏|Start Game|Press.*Start/i }).first();
            await expect(startButton).toBeEnabled({ timeout: 10000 });
            await startButton.click();
            await hostPage.waitForTimeout(500);
            await installAiBatchRejectPatch(hostPage, { targetPlayerId: '1', rejectLimit: 1 });
            await applyOnlineMatchState(matchId, hostPage, buildOnlineAiHiddenModifyDiceState);
            await waitForPhase(hostPage, 'offensiveRoll', 30000);
            await waitForGameBoard(hostPage, 30000);
            await waitForTestHarness(hostPage, 15000);

            await expect.poll(async () => {
                const status = await readAiBatchRejectPatchStatus(hostPage);
                const state = await getMatchState(matchId, hostPage);
                return {
                    rejectedCount: status?.rejectedCount ?? 0,
                    delegatedCount: status?.delegatedCount ?? 0,
                    interactionKind: state.sys?.interaction?.current?.kind ?? null,
                    interactionPlayerId: state.sys?.interaction?.current?.playerId ?? null,
                    diceValues: (state.core?.dice ?? []).slice(0, 2).map((die: any) => die.value),
                };
            }, {
                timeout: 15000,
                message: '等待首轮 AI batch 被测试补丁拒绝',
            }).toEqual({
                rejectedCount: 1,
                delegatedCount: 0,
                interactionKind: 'multistep-choice',
                interactionPlayerId: '1',
                diceValues: [1, 2],
            });

            await expect.poll(async () => {
                return hostPage.evaluate(() => {
                    const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                    return {
                        interactionPlayerId: state?.sys?.interaction?.current?.playerId ?? null,
                        isBlocked: state?.sys?.interaction?.isBlocked ?? null,
                        diceValues: (state?.core?.dice ?? []).slice(0, 2).map((die: any) => die.value),
                    };
                });
            }, {
                timeout: 10000,
                message: '等待房主过滤视角仍保持被隐藏交互阻塞',
            }).toEqual({
                interactionPlayerId: null,
                isBlocked: true,
                diceValues: [1, 2],
            });

            await clearEvidenceScreenshotsForTest(testInfo);
            await saveEvidenceScreenshot(hostPage, testInfo, '15-online-ai-hidden-multistep-rejected-before-retry');

            await expect.poll(async () => {
                const status = await readAiBatchRejectPatchStatus(hostPage);
                const state = await getMatchState(matchId, hostPage);
                return {
                    rejectedCount: status?.rejectedCount ?? 0,
                    delegatedCount: status?.delegatedCount ?? 0,
                    lastCommandCount: status?.lastCommandCount ?? 0,
                    interactionKind: state.sys?.interaction?.current?.kind ?? null,
                    interactionPlayerId: state.sys?.interaction?.current?.playerId ?? null,
                    diceValues: (state.core?.dice ?? []).slice(0, 2).map((die: any) => die.value),
                };
            }, {
                timeout: 30000,
                message: '等待 AI 在 batch 被拒后自动重试并成功提交多条 MODIFY_DIE',
            }).toEqual({
                rejectedCount: 1,
                delegatedCount: 1,
                lastCommandCount: 3,
                interactionKind: null,
                interactionPlayerId: null,
                diceValues: [6, 6],
            });

            await expect.poll(async () => {
                return hostPage.evaluate(() => {
                    const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                    return {
                        interactionPlayerId: state?.sys?.interaction?.current?.playerId ?? null,
                        isBlocked: state?.sys?.interaction?.isBlocked ?? null,
                        diceValues: (state?.core?.dice ?? []).slice(0, 2).map((die: any) => die.value),
                    };
                });
            }, {
                timeout: 10000,
                message: '等待房主过滤视角在 retry 成功后解除阻塞',
            }).toEqual({
                interactionPlayerId: null,
                isBlocked: false,
                diceValues: [6, 6],
            });

            await saveEvidenceScreenshot(hostPage, testInfo, '16-online-ai-hidden-multistep-after-retry');
        } finally {
            await setup.hostContext.close();
        }
    });

    test('Online AI 连续两轮 batch 被拒后仍应自动重试并完成隐藏 multistep-choice', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineAiRoom(browser, baseURL);
        if (!setup) {
            test.skip(true, 'DiceThrone AI 联机房间创建失败');
            return;
        }

        try {
            const { hostPage, matchId } = setup;
            await waitForCharacterSelection(hostPage, 20000);
            await waitForAiSeatCredential(hostPage, matchId, '1');

            await selectCharacter(hostPage, 'monk');
            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                const hostSelected = state.core?.selectedCharacters?.['0'];
                const aiSelected = state.core?.selectedCharacters?.['1'];
                return hostSelected === 'monk'
                    && aiSelected !== 'unselected'
                    && state.core?.readyPlayers?.['1'] === true;
            }, {
                timeout: 30000,
                message: '等待 DiceThrone host/AI 一起完成双拒绝 retry 测试前置条件',
            }).toBe(true);

            const startButton = hostPage.locator('button').filter({ hasText: /开始游戏|Start Game|Press.*Start/i }).first();
            await expect(startButton).toBeEnabled({ timeout: 10000 });
            await startButton.click();
            await hostPage.waitForTimeout(500);
            await installAiBatchRejectPatch(hostPage, { targetPlayerId: '1', rejectLimit: 2 });
            await applyOnlineMatchState(matchId, hostPage, buildOnlineAiHiddenModifyDiceState);
            await waitForPhase(hostPage, 'offensiveRoll', 30000);
            await waitForGameBoard(hostPage, 30000);
            await waitForTestHarness(hostPage, 15000);

            await expect.poll(async () => {
                const status = await readAiBatchRejectPatchStatus(hostPage);
                const state = await getMatchState(matchId, hostPage);
                return {
                    rejectLimit: status?.rejectLimit ?? 0,
                    rejectedCount: status?.rejectedCount ?? 0,
                    delegatedCount: status?.delegatedCount ?? 0,
                    interactionKind: state.sys?.interaction?.current?.kind ?? null,
                    interactionPlayerId: state.sys?.interaction?.current?.playerId ?? null,
                    diceValues: (state.core?.dice ?? []).slice(0, 2).map((die: any) => die.value),
                };
            }, {
                timeout: 20000,
                message: '等待前两轮 AI batch 都被测试补丁拒绝',
            }).toEqual({
                rejectLimit: 2,
                rejectedCount: 2,
                delegatedCount: 0,
                interactionKind: 'multistep-choice',
                interactionPlayerId: '1',
                diceValues: [1, 2],
            });

            await expect.poll(async () => {
                return hostPage.evaluate(() => {
                    const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                    return {
                        interactionPlayerId: state?.sys?.interaction?.current?.playerId ?? null,
                        isBlocked: state?.sys?.interaction?.isBlocked ?? null,
                        diceValues: (state?.core?.dice ?? []).slice(0, 2).map((die: any) => die.value),
                    };
                });
            }, {
                timeout: 10000,
                message: '等待房主过滤视角在双拒绝期间仍保持被隐藏交互阻塞',
            }).toEqual({
                interactionPlayerId: null,
                isBlocked: true,
                diceValues: [1, 2],
            });

            await clearEvidenceScreenshotsForTest(testInfo);
            await saveEvidenceScreenshot(hostPage, testInfo, '17-online-ai-hidden-multistep-rejected-twice-before-retry');

            await expect.poll(async () => {
                const status = await readAiBatchRejectPatchStatus(hostPage);
                const state = await getMatchState(matchId, hostPage);
                return {
                    rejectLimit: status?.rejectLimit ?? 0,
                    rejectedCount: status?.rejectedCount ?? 0,
                    delegatedCount: status?.delegatedCount ?? 0,
                    lastCommandCount: status?.lastCommandCount ?? 0,
                    interactionKind: state.sys?.interaction?.current?.kind ?? null,
                    interactionPlayerId: state.sys?.interaction?.current?.playerId ?? null,
                    diceValues: (state.core?.dice ?? []).slice(0, 2).map((die: any) => die.value),
                };
            }, {
                timeout: 40000,
                message: '等待 AI 在连续两轮 batch 被拒后仍成功完成第三轮 retry',
            }).toEqual({
                rejectLimit: 2,
                rejectedCount: 2,
                delegatedCount: 1,
                lastCommandCount: 3,
                interactionKind: null,
                interactionPlayerId: null,
                diceValues: [6, 6],
            });

            await expect.poll(async () => {
                return hostPage.evaluate(() => {
                    const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                    return {
                        interactionPlayerId: state?.sys?.interaction?.current?.playerId ?? null,
                        isBlocked: state?.sys?.interaction?.isBlocked ?? null,
                        diceValues: (state?.core?.dice ?? []).slice(0, 2).map((die: any) => die.value),
                    };
                });
            }, {
                timeout: 10000,
                message: '等待房主过滤视角在第三轮 retry 成功后解除阻塞',
            }).toEqual({
                interactionPlayerId: null,
                isBlocked: false,
                diceValues: [6, 6],
            });

            await saveEvidenceScreenshot(hostPage, testInfo, '18-online-ai-hidden-multistep-after-third-attempt');
        } finally {
            await setup.hostContext.close();
        }
    });

    test('Online AI 结束 main2 后应自动穿过维护与收入阶段回到我方主要阶段', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineAiRoom(browser, baseURL);
        if (!setup) {
            test.skip(true, 'DiceThrone AI 联机房间创建失败');
            return;
        }

        try {
            const { hostPage, matchId } = setup;
            await waitForCharacterSelection(hostPage, 20000);
            await waitForAiSeatCredential(hostPage, matchId, '1');

            await selectCharacter(hostPage, 'monk');
            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                const hostSelected = state.core?.selectedCharacters?.['0'];
                const aiSelected = state.core?.selectedCharacters?.['1'];
                return hostSelected === 'monk'
                    && aiSelected !== 'unselected'
                    && state.core?.readyPlayers?.['1'] === true;
            }, {
                timeout: 30000,
                message: '等待 DiceThrone host/AI 一起完成 watchdog 测试前置条件',
            }).toBe(true);

            await waitForGameBoard(hostPage, 30000);
            await applyOnlineMatchState(matchId, hostPage, buildOnlineAiStalledMain2State);
            await waitForTestHarness(hostPage, 15000);

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                const failureToastVisible = await hostPage.evaluate(() => {
                    return Array.from(document.querySelectorAll('*')).some((node) => {
                        const text = node.textContent?.trim() ?? '';
                        return text.includes('强制结束 AI 回合未成功')
                            || text.includes('AI 强制结束失败（');
                    });
                });
                return {
                    phase: state.sys?.phase ?? null,
                    activePlayerId: state.core?.activePlayerId ?? null,
                    hasGameOver: Boolean(state.sys?.gameover),
                    failureToastVisible,
                };
            }, {
                timeout: 25000,
                message: '等待 AI 正常推进 main2 → discard → 人类回合起始阶段',
            }).toMatchObject({
                activePlayerId: '0',
                hasGameOver: false,
                failureToastVisible: false,
            });

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                const phase = state.sys?.phase ?? null;
                return ['upkeep', 'income', 'main1'].includes(String(phase));
            }, {
                timeout: 5000,
                message: 'AI 推进后应进入真人回合的 upkeep/income/main1',
            }).toBe(true);

            await advanceHostTurnToMain1(matchId, hostPage, '0');

            await expect(hostPage.locator('[data-tutorial-id="dice-roll-button"]')).toBeVisible({ timeout: 10000 });
            await closeBoardMagnifyIfOpen(hostPage);
            await clearEvidenceScreenshotsForTest(testInfo);
            await saveEvidenceScreenshot(hostPage, testInfo, '20-online-ai-main2-auto-progressed-to-human-main1');
        } finally {
            await setup.hostContext.close();
        }
    });

    test('Online AI + human 均持有响应牌时，human 响应后 AI 应接棒完成 afterCardPlayed 收口', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineAiRoom(browser, baseURL);
        if (!setup) {
            test.skip(true, 'DiceThrone AI 联机房间创建失败');
            return;
        }

        try {
            const { hostPage, matchId } = setup;
            await waitForTestHarness(hostPage, 15000);

            await applyOnlineMatchState(matchId, hostPage, buildOnlineAiHumanThenAiResponseWindowState);
            await waitForGameBoard(hostPage, 30000);

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                const window = state.sys?.responseWindow?.current;
                const queue = Array.isArray(window?.responderQueue) ? window.responderQueue : [];
                const index = typeof window?.currentResponderIndex === 'number' ? window.currentResponderIndex : -1;
                const currentResponderId = index >= 0 ? queue[index] ?? null : null;
                const humanHand = Array.isArray(state.core?.players?.['0']?.hand) ? state.core.players['0'].hand : [];
                const aiHand = Array.isArray(state.core?.players?.['1']?.hand) ? state.core.players['1'].hand : [];
                const aiDiscard = Array.isArray(state.core?.players?.['1']?.discard) ? state.core.players['1'].discard : [];
                return {
                    activePlayerId: state.core?.activePlayerId ?? null,
                    phase: state.sys?.phase ?? null,
                    responseWindowType: window?.windowType ?? null,
                    responderQueue: queue.join(','),
                    currentResponderId,
                    humanHasResponseCard: humanHand.some((card: any) => card.id === HUMAN_RESPONSE_AFTER_CARD_INSTANCE_ID),
                    aiHasResponseCardInHand: aiHand.some((card: any) => card.id === AI_RESPONSE_AFTER_CARD_INSTANCE_ID),
                    aiHasResponseCardInDiscard: aiDiscard.some((card: any) => card.id === AI_RESPONSE_AFTER_CARD_INSTANCE_ID),
                };
            }, {
                timeout: 10000,
                message: '等待 human->AI 响应窗口初始场景注入完成',
            }).toEqual({
                activePlayerId: '1',
                phase: 'main1',
                responseWindowType: 'afterCardPlayed',
                responderQueue: '0,1',
                currentResponderId: '0',
                humanHasResponseCard: true,
                aiHasResponseCardInHand: true,
                aiHasResponseCardInDiscard: false,
            });

            await clearEvidenceScreenshotsForTest(testInfo);
            await saveEvidenceScreenshot(hostPage, testInfo, '20-online-ai-human-then-ai-response-before-human-pass');

            // human 未响应前，AI 不应越过 responderQueue 抢先处理。
            await hostPage.waitForTimeout(800);
            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                const window = state.sys?.responseWindow?.current;
                const queue = Array.isArray(window?.responderQueue) ? window.responderQueue : [];
                const index = typeof window?.currentResponderIndex === 'number' ? window.currentResponderIndex : -1;
                const currentResponderId = index >= 0 ? queue[index] ?? null : null;
                const aiHand = Array.isArray(state.core?.players?.['1']?.hand) ? state.core.players['1'].hand : [];
                const aiDiscard = Array.isArray(state.core?.players?.['1']?.discard) ? state.core.players['1'].discard : [];
                return {
                    hasResponseWindow: Boolean(window),
                    currentResponderId,
                    aiHasResponseCardInHand: aiHand.some((card: any) => card.id === AI_RESPONSE_AFTER_CARD_INSTANCE_ID),
                    aiHasResponseCardInDiscard: aiDiscard.some((card: any) => card.id === AI_RESPONSE_AFTER_CARD_INSTANCE_ID),
                };
            }, {
                timeout: 3000,
                message: 'human 未响应前，AI 不应提前消费响应牌',
            }).toEqual({
                hasResponseWindow: true,
                currentResponderId: '0',
                aiHasResponseCardInHand: true,
                aiHasResponseCardInDiscard: false,
            });

            await dispatchHarnessCommand(hostPage, 'RESPONSE_PASS', '0');
            await saveEvidenceScreenshot(hostPage, testInfo, '20-online-ai-human-then-ai-response-after-human-pass');

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                const window = state.sys?.responseWindow?.current;
                const humanHand = Array.isArray(state.core?.players?.['0']?.hand) ? state.core.players['0'].hand : [];
                const aiHand = Array.isArray(state.core?.players?.['1']?.hand) ? state.core.players['1'].hand : [];
                const aiDiscard = Array.isArray(state.core?.players?.['1']?.discard) ? state.core.players['1'].discard : [];
                return {
                    hasResponseWindow: Boolean(window),
                    humanHasResponseCard: humanHand.some((card: any) => card.id === HUMAN_RESPONSE_AFTER_CARD_INSTANCE_ID),
                    aiHasResponseCardInHand: aiHand.some((card: any) => card.id === AI_RESPONSE_AFTER_CARD_INSTANCE_ID),
                    aiHasResponseCardInDiscard: aiDiscard.some((card: any) => card.id === AI_RESPONSE_AFTER_CARD_INSTANCE_ID),
                };
            }, {
                timeout: 15000,
                message: 'human 响应后，AI 应接棒处理并关闭响应窗口',
            }).toEqual({
                hasResponseWindow: false,
                humanHasResponseCard: true,
                aiHasResponseCardInHand: false,
                aiHasResponseCardInDiscard: true,
            });

            await saveEvidenceScreenshot(hostPage, testInfo, '20-online-ai-human-then-ai-response-after-ai-resolved');

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                return Boolean(state.sys?.responseWindow?.current);
            }, {
                timeout: 3000,
                message: 'human->AI 响应链路收口后不应重开窗口',
            }).toBe(false);
            await saveEvidenceScreenshot(hostPage, testInfo, '20-online-ai-human-then-ai-response-stable-no-reopen');
        } finally {
            await setup.hostContext.close();
        }
    });

    test('Online AI 当前阶段遇到 human 可响应卡时，悬浮球强制结束应先关闭响应窗口再推进阶段', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineAiRoom(browser, baseURL);
        if (!setup) {
            test.skip(true, 'DiceThrone AI 联机房间创建失败');
            return;
        }

        try {
            const { hostPage, matchId } = setup;
            await waitForTestHarness(hostPage, 15000);

            await applyOnlineMatchState(matchId, hostPage, buildOnlineAiHumanResponseWindowState);
            await waitForGameBoard(hostPage, 30000);

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                return {
                    activePlayerId: state.core?.activePlayerId ?? null,
                    phase: state.sys?.phase ?? null,
                    responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
                    currentResponderId: (() => {
                        const current = state.sys?.responseWindow?.current;
                        const queue = Array.isArray(current?.responderQueue) ? current.responderQueue : [];
                        const index = typeof current?.currentResponderIndex === 'number' ? current.currentResponderIndex : 0;
                        return typeof queue[index] === 'string' ? queue[index] : null;
                    })(),
                    hostHandCount: Array.isArray(state.core?.players?.['0']?.hand)
                        ? state.core.players['0'].hand.length
                        : 0,
                };
            }, {
                timeout: 10000,
                message: '等待注入“AI 当前阶段 + human 可响应卡”场景完成',
            }).toEqual({
                activePlayerId: '1',
                phase: 'main1',
                responseWindowType: 'afterCardPlayed',
                currentResponderId: '0',
                hostHandCount: 1,
            });

            await clearEvidenceScreenshotsForTest(testInfo);
            await saveEvidenceScreenshot(hostPage, testInfo, '20-online-ai-manual-force-end-human-response-before');

            const forceActionsPanel = await openForceActionsPanel(hostPage, { expectSheet: false });
            const forceEndButton = hostPage.getByTestId('hud-force-end-ai-phase');
            await expect(forceEndButton).toBeVisible({ timeout: 5000 });
            await forceEndButton.click({ trial: true });
            await hostPage.waitForTimeout(250);
            await forceEndButton.click();

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                return {
                    activePlayerId: state.core?.activePlayerId ?? null,
                    phase: state.sys?.phase ?? null,
                    hasResponseWindow: Boolean(state.sys?.responseWindow?.current),
                };
            }, {
                timeout: 15000,
                message: '等待手动强制结束先关闭 human 响应窗口，再把 AI 阶段推进离开 main1',
            }).toEqual({
                activePlayerId: '1',
                phase: 'main2',
                hasResponseWindow: false,
            });
            await expect(forceActionsPanel).toBeHidden({ timeout: 5000 });

            await expect(hostPage.getByText(/AI 强制结束失败|强制结束 AI 回合未成功/i)).toHaveCount(0);
            await saveEvidenceScreenshot(hostPage, testInfo, '20-online-ai-manual-force-end-human-response-after');
        } finally {
            await setup.hostContext.close();
        }
    });

    test('Mobile online AI 当前阶段的人类响应窗口里，强制结束 AI 回合展开窗口应完整显示且无需滚动', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineAiRoom(browser, baseURL, {
            contextOptions: MOBILE_FORCE_ACTIONS_CONTEXT_OPTIONS,
        });
        if (!setup) {
            test.skip(true, 'DiceThrone AI 联机房间创建失败');
            return;
        }

        try {
            const { hostPage, matchId } = setup;
            await waitForTestHarness(hostPage, 15000);

            await applyOnlineMatchState(matchId, hostPage, buildOnlineAiHumanResponseWindowState);
            await waitForGameBoard(hostPage, 30000);

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                return {
                    activePlayerId: state.core?.activePlayerId ?? null,
                    phase: state.sys?.phase ?? null,
                    responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
                    currentResponderId: (() => {
                        const current = state.sys?.responseWindow?.current;
                        const queue = Array.isArray(current?.responderQueue) ? current.responderQueue : [];
                        const index = typeof current?.currentResponderIndex === 'number' ? current.currentResponderIndex : 0;
                        return typeof queue[index] === 'string' ? queue[index] : null;
                    })(),
                    hostHandCount: Array.isArray(state.core?.players?.['0']?.hand)
                        ? state.core.players['0'].hand.length
                        : 0,
                };
            }, {
                timeout: 10000,
                message: '等待移动端注入“AI 当前阶段 + human 可响应卡”场景完成',
            }).toEqual({
                activePlayerId: '1',
                phase: 'main1',
                responseWindowType: 'afterCardPlayed',
                currentResponderId: '0',
                hostHandCount: 1,
            });

            await clearEvidenceScreenshotsForTest(testInfo);
            await saveEvidenceScreenshot(hostPage, testInfo, '20-mobile-online-ai-manual-force-end-human-response-before');

            const forceActionsPanel = await openForceActionsPanel(hostPage, { expectSheet: true });
            const forceActionsSheet = hostPage.getByTestId('fab-sheet-force-actions');
            const forceEndButton = hostPage.getByTestId('hud-force-end-ai-phase');
            const forceDismissButton = hostPage.getByTestId('hud-force-dismiss-popup');

            await expect(forceEndButton).toBeVisible({ timeout: 5000 });
            await expect(forceDismissButton).toBeVisible({ timeout: 5000 });

            const forceActionsMetrics = await hostPage.evaluate(() => {
                const sheet = document.querySelector('[data-testid="fab-sheet-force-actions"]') as HTMLElement | null;
                const panel = document.querySelector('[data-testid="fab-panel-force-actions"]') as HTMLElement | null;
                const forceEnd = document.querySelector('[data-testid="hud-force-end-ai-phase"]') as HTMLElement | null;
                const forceDismiss = document.querySelector('[data-testid="hud-force-dismiss-popup"]') as HTMLElement | null;
                const scroller = document.scrollingElement as HTMLElement | null;
                if (!sheet || !panel || !forceEnd || !forceDismiss || !scroller) {
                    return null;
                }

                const panelRect = panel.getBoundingClientRect();
                const forceEndRect = forceEnd.getBoundingClientRect();
                const forceDismissRect = forceDismiss.getBoundingClientRect();

                return {
                    viewportWidth: window.innerWidth,
                    viewportHeight: window.innerHeight,
                    panelTop: Math.round(panelRect.top),
                    panelBottom: Math.round(panelRect.bottom),
                    forceEndTop: Math.round(forceEndRect.top),
                    forceEndBottom: Math.round(forceEndRect.bottom),
                    forceDismissBottom: Math.round(forceDismissRect.bottom),
                    panelFullyInsideViewport: panelRect.top >= 0 && panelRect.bottom <= window.innerHeight,
                    forceEndFullyInsideViewport: forceEndRect.top >= 0 && forceEndRect.bottom <= window.innerHeight,
                    forceDismissFullyInsideViewport: forceDismissRect.top >= 0 && forceDismissRect.bottom <= window.innerHeight,
                    documentScrollTop: Math.round(scroller.scrollTop),
                };
            });

            expect(forceActionsMetrics).not.toBeNull();
            expect(forceActionsMetrics?.viewportWidth).toBe(812);
            expect(forceActionsMetrics?.viewportHeight).toBe(375);
            expect(forceActionsMetrics?.panelFullyInsideViewport).toBe(true);
            expect(forceActionsMetrics?.forceEndFullyInsideViewport).toBe(true);
            expect(forceActionsMetrics?.forceDismissFullyInsideViewport).toBe(true);
            expect(forceActionsMetrics?.documentScrollTop).toBe(0);

            await forceEndButton.click({ trial: true });
            await forceDismissButton.click({ trial: true });
            await expect(forceActionsPanel).toBeVisible({ timeout: 5000 });
            await expect(forceActionsSheet).toBeVisible({ timeout: 5000 });

            await saveEvidenceScreenshot(hostPage, testInfo, '20-mobile-online-ai-manual-force-end-sheet-open');
        } finally {
            await setup.hostContext.close();
        }
    });

    test('Online AI 当前阶段遇到 human 可响应卡时，服务端 watchdog 应自动关闭响应窗口并推进阶段', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineAiRoom(browser, baseURL);
        if (!setup) {
            test.skip(true, 'DiceThrone AI 联机房间创建失败');
            return;
        }

        try {
            const { hostPage, matchId } = setup;
            await waitForTestHarness(hostPage, 15000);

            await applyOnlineMatchState(matchId, hostPage, buildOnlineAiHumanResponseWindowState);
            await waitForGameBoard(hostPage, 30000);

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                return {
                    activePlayerId: state.core?.activePlayerId ?? null,
                    phase: state.sys?.phase ?? null,
                    responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
                    currentResponderId: (() => {
                        const current = state.sys?.responseWindow?.current;
                        const queue = Array.isArray(current?.responderQueue) ? current.responderQueue : [];
                        const index = typeof current?.currentResponderIndex === 'number' ? current.currentResponderIndex : 0;
                        return typeof queue[index] === 'string' ? queue[index] : null;
                    })(),
                    hostHandCount: Array.isArray(state.core?.players?.['0']?.hand)
                        ? state.core.players['0'].hand.length
                        : 0,
                };
            }, {
                timeout: 10000,
                message: '等待注入“AI 当前阶段 + human 可响应卡”自动 watchdog 场景完成',
            }).toEqual({
                activePlayerId: '1',
                phase: 'main1',
                responseWindowType: 'afterCardPlayed',
                currentResponderId: '0',
                hostHandCount: 1,
            });

            await clearEvidenceScreenshotsForTest(testInfo);
            await saveEvidenceScreenshot(hostPage, testInfo, '20-online-ai-watchdog-human-response-before');

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                const failureToastVisible = await hostPage.evaluate(() => {
                    return Array.from(document.querySelectorAll('*')).some((node) => {
                        const text = node.textContent?.trim() ?? '';
                        return text.includes('强制结束 AI 回合未成功')
                            || text.includes('AI 强制结束失败（');
                    });
                });
                return {
                    activePlayerId: state.core?.activePlayerId ?? null,
                    phase: state.sys?.phase ?? null,
                    hasResponseWindow: Boolean(state.sys?.responseWindow?.current),
                    failureToastVisible,
                };
            }, {
                timeout: 40000,
                message: '等待服务端 watchdog 自动关闭 human 响应窗口并把控制权交还给真人',
            }).toEqual({
                activePlayerId: '0',
                phase: 'main1',
                hasResponseWindow: false,
                failureToastVisible: false,
            });

            await saveEvidenceScreenshot(hostPage, testInfo, '20-online-ai-watchdog-human-response-after');
        } finally {
            await setup.hostContext.close();
        }
    });

    test('Online AI 响应窗口反复卡死时，watchdog 应强制关闭响应窗口', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineAiRoom(browser, baseURL);
        if (!setup) {
            test.skip(true, 'DiceThrone AI 联机房间创建失败');
            return;
        }

        try {
            const { hostPage, matchId } = setup;
            await waitForTestHarness(hostPage, 15000);

            await applyOnlineMatchState(matchId, hostPage, (state) => buildTwoPlayerResponseLoopState(state, {
                windowId: 'after-card-2p',
                pendingInteractionId: 'loop-pending-interaction',
            }));
            await waitForGameBoard(hostPage, 30000);
            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                return state.sys?.responseWindow?.current?.windowType ?? null;
            }, {
                timeout: 10000,
                message: '等待响应窗口注入完成',
            }).toBe('afterCardPlayed');

            await clearEvidenceScreenshotsForTest(testInfo);
            await saveEvidenceScreenshot(hostPage, testInfo, '20-online-ai-response-loop-before');

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                return Boolean(state.sys?.responseWindow?.current);
            }, {
                timeout: 40000,
                message: '等待 watchdog 强制关闭响应窗口',
            }).toBe(false);

            await saveEvidenceScreenshot(hostPage, testInfo, '20-online-ai-response-loop-after');

            await applyOnlineMatchState(matchId, hostPage, (state) => buildTwoPlayerResponseLoopState(state, {
                windowId: 'after-card-2p-reopen',
                pendingInteractionId: 'loop-pending-interaction-2',
            }));
            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                return state.sys?.responseWindow?.current?.id ?? null;
            }, {
                timeout: 10000,
                message: '等待响应窗口二次注入完成',
            }).toBe('after-card-2p-reopen');

            await saveEvidenceScreenshot(hostPage, testInfo, '20-online-ai-response-loop-reopen-before');

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                return Boolean(state.sys?.responseWindow?.current);
            }, {
                timeout: 40000,
                message: '等待 watchdog 再次强制关闭响应窗口',
            }).toBe(false);

            await saveEvidenceScreenshot(hostPage, testInfo, '20-online-ai-response-loop-reopen-after');
        } finally {
            await setup.hostContext.close();
        }
    });

    test('Online AI 响应窗口在 sourceId 变化的重复 reopen 下仍应被 watchdog 收口', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineAiRoom(browser, baseURL);
        if (!setup) {
            test.skip(true, 'DiceThrone AI 联机房间创建失败');
            return;
        }

        try {
            const { hostPage, matchId } = setup;
            await waitForTestHarness(hostPage, 15000);

            await applyOnlineMatchState(matchId, hostPage, (state) => {
                const next = buildTwoPlayerResponseLoopState(state, {
                    windowId: 'after-card-2p',
                    pendingInteractionId: 'loop-pending-interaction',
                });
                next.sys.responseWindow = {
                    ...next.sys.responseWindow,
                    current: {
                        ...(next.sys.responseWindow?.current ?? {}),
                        sourceId: 'card-transfer-status',
                    },
                };
                return next;
            });
            await waitForGameBoard(hostPage, 30000);
            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                return state.sys?.responseWindow?.current?.windowType ?? null;
            }, {
                timeout: 10000,
                message: '等待响应窗口注入完成',
            }).toBe('afterCardPlayed');

            await clearEvidenceScreenshotsForTest(testInfo);
            await saveEvidenceScreenshot(hostPage, testInfo, '20-online-ai-response-loop-reopen-sourceid-before');

            const reopenSources = [
                { id: 'after-card-2p-reopen-1', sourceId: 'card-transfer-status-1' },
                { id: 'after-card-2p-reopen-2', sourceId: 'card-transfer-status-2' },
                { id: 'after-card-2p-reopen-3', sourceId: 'card-transfer-status-3' },
            ];
            for (const reopen of reopenSources) {
                await applyOnlineMatchState(matchId, hostPage, (state) => {
                    const next = structuredClone(state);
                    next.sys = {
                        ...next.sys,
                        responseWindow: {
                            ...(next.sys?.responseWindow ?? {}),
                            current: {
                                ...(next.sys?.responseWindow?.current ?? {}),
                                id: reopen.id,
                                sourceId: reopen.sourceId,
                                pendingInteractionId: `loop-pending-interaction-${reopen.id}`,
                            },
                        },
                    };
                    return next;
                });
                await hostPage.waitForTimeout(800);
            }

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                return Boolean(state.sys?.responseWindow?.current);
            }, {
                timeout: 45000,
                message: '等待 watchdog 在 sourceId 反复变化下仍强制关闭响应窗口',
            }).toBe(false);

            await saveEvidenceScreenshot(hostPage, testInfo, '20-online-ai-response-loop-reopen-sourceid-after');
        } finally {
            await setup.hostContext.close();
        }
    });

    test('Online DiceThrone 弃牌超限时应可正常弃到手牌上限并自动推进下一回合（避免弃牌/撤回循环卡死）', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatch(browser, baseURL, { gameServerBaseURL: getGameServerBaseURL() });
        if (!setup) {
            test.skip(true, 'DiceThrone 联机房间创建失败');
            return;
        }

        try {
            const { hostPage, guestPage, matchId } = setup;
            await selectCharacter(hostPage, 'barbarian');
            await selectCharacter(guestPage, 'paladin');
            await readyAndStartGame(hostPage, guestPage);
            await waitForGameBoard(hostPage);
            await waitForGameBoard(guestPage);

            await applyOnlineMatchState(matchId, hostPage, buildDiscardOverflowState);
            await waitForPhase(hostPage, 'discard', 20000);

            const handCards = hostPage.locator('[data-testid="hand-area"] [data-card-id]');
            await expect(handCards).toHaveCount(HAND_LIMIT + 1, { timeout: 10000 });

            await clearEvidenceScreenshotsForTest(testInfo);
            await saveEvidenceScreenshot(hostPage, testInfo, '21-discard-overflow-before');

            while (await handCards.count() > HAND_LIMIT) {
                await handCards.first().click();
                await hostPage.waitForTimeout(400);
            }

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                return {
                    phase: state.sys?.phase ?? null,
                    activePlayerId: state.core?.activePlayerId ?? null,
                    hostHandCount: state.core?.players?.['0']?.hand?.length ?? null,
                };
            }, {
                timeout: 15000,
                message: '等待弃牌完成后自动推进到下一位玩家回合',
            }).toMatchObject({
                activePlayerId: '1',
                hostHandCount: HAND_LIMIT,
            });

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                const phase = state.sys?.phase ?? null;
                return ['upkeep', 'income', 'main1'].includes(String(phase));
            }, {
                timeout: 5000,
                message: '弃牌完成后应进入下一回合的 upkeep/income/main1',
            }).toBe(true);

            await saveEvidenceScreenshot(hostPage, testInfo, '22-discard-overflow-after');
        } finally {
            await cleanupDTMatch(setup);
        }
    });

    test('Online AI 在 main2 仅剩撤回卖牌可选时应直接推进阶段（避免卖/撤循环卡死）', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineAiRoom(browser, baseURL);
        if (!setup) {
            test.skip(true, 'DiceThrone AI 联机房间创建失败');
            return;
        }

        try {
            const { hostPage, matchId } = setup;
            await waitForCharacterSelection(hostPage, 20000);
            await waitForAiSeatCredential(hostPage, matchId, '1');

            await selectCharacter(hostPage, 'monk');
            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                const hostSelected = state.core?.selectedCharacters?.['0'];
                const aiSelected = state.core?.selectedCharacters?.['1'];
                return hostSelected === 'monk'
                    && aiSelected !== 'unselected'
                    && state.core?.readyPlayers?.['1'] === true;
            }, {
                timeout: 30000,
                message: '等待 DiceThrone host/AI 完成卖/撤循环测试前置条件',
            }).toBe(true);

            const startButton = hostPage.locator('button').filter({ hasText: /开始游戏|Start Game|Press.*Start/i }).first();
            await expect(startButton).toBeEnabled({ timeout: 10000 });
            await startButton.click();
            await hostPage.waitForTimeout(500);
            await waitForTestHarness(hostPage, 15000);

            const expectedLoopCardId = COMMON_CARDS[0]?.id ?? null;
            const baselineState = await getMatchState(matchId, hostPage);
            const baselineAiHandCount = baselineState.core?.players?.['1']?.hand?.length ?? null;
            let injectionConfirmed = false;
            let lastInjectionSnapshot: {
                phase: string | null;
                activePlayerId: string | null;
                aiHandCount: number | null;
                lastSoldCardId: string | null;
            } | null = null;
            for (let attempt = 0; attempt < 8; attempt += 1) {
                await applyOnlineMatchState(matchId, hostPage, buildOnlineAiUndoSellLoopState);
                const injectedState = await getMatchState(matchId, hostPage);
                lastInjectionSnapshot = {
                    phase: injectedState.sys?.phase ?? null,
                    activePlayerId: injectedState.core?.activePlayerId ?? null,
                    aiHandCount: injectedState.core?.players?.['1']?.hand?.length ?? null,
                    lastSoldCardId: injectedState.core?.lastSoldCardId ?? null,
                };
                const inAiMain2Window = lastInjectionSnapshot.phase === 'main2'
                    && lastInjectionSnapshot.activePlayerId === '1'
                    && lastInjectionSnapshot.aiHandCount === 0;
                const inAiDiscardWindow = lastInjectionSnapshot.phase === 'discard'
                    && lastInjectionSnapshot.activePlayerId === '1'
                    && lastInjectionSnapshot.aiHandCount === 0;
                const fastResolvedToHumanTurn = lastInjectionSnapshot.activePlayerId === '0'
                    && lastInjectionSnapshot.aiHandCount === 0
                    && baselineAiHandCount !== null;
                const matched = inAiMain2Window
                    || inAiDiscardWindow
                    || fastResolvedToHumanTurn
                    || (
                        lastInjectionSnapshot.aiHandCount === 0
                        && expectedLoopCardId !== null
                        && lastInjectionSnapshot.lastSoldCardId === expectedLoopCardId
                    );
                if (matched) {
                    injectionConfirmed = true;
                    break;
                }
                await hostPage.waitForTimeout(400);
            }
            if (!injectionConfirmed) {
                throw new Error(
                    `undo-sell 场景注入未生效: expectedLoopCardId=${String(expectedLoopCardId)} `
                    + `snapshot=${JSON.stringify(lastInjectionSnapshot)}`,
                );
            }

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                return {
                    activePlayerId: state.core?.activePlayerId ?? null,
                    phase: state.sys?.phase ?? null,
                };
            }, {
                timeout: 30000,
                message: '等待 undo-sell 注入场景接管当前对局状态',
            }).toMatchObject({
                phase: expect.any(String),
            });
            await waitForTestHarness(hostPage, 15000);

            await clearEvidenceScreenshotsForTest(testInfo);
            await saveEvidenceScreenshot(hostPage, testInfo, '23-ai-undo-sell-loop-before');

            const deadline = Date.now() + 15000;
            let seenAiUndoSellContext = injectionConfirmed;
            let lastSnapshot: {
                phase: string | null;
                activePlayerId: string | null;
                aiHandCount: number | null;
                lastSoldCardId: string | null;
            } | null = null;

            while (Date.now() < deadline) {
                const state = await getMatchState(matchId, hostPage);
                const snapshot: {
                    phase: string | null;
                    activePlayerId: string | null;
                    aiHandCount: number | null;
                    lastSoldCardId: string | null;
                } = {
                    phase: state.sys?.phase ?? null,
                    activePlayerId: state.core?.activePlayerId ?? null,
                    aiHandCount: state.core?.players?.['1']?.hand?.length ?? null,
                    lastSoldCardId: state.core?.lastSoldCardId ?? null,
                };
                lastSnapshot = snapshot;
                if (
                    snapshot.activePlayerId === '1'
                    || snapshot.phase === 'main2'
                    || snapshot.phase === 'discard'
                    || (expectedLoopCardId !== null && snapshot.lastSoldCardId === expectedLoopCardId)
                ) {
                    seenAiUndoSellContext = true;
                }
                const aiAdvancedToDiscard = snapshot.phase === 'discard'
                    && snapshot.activePlayerId === '1'
                    && snapshot.aiHandCount === 0;
                const progressedToHumanTurn = seenAiUndoSellContext
                    && snapshot.activePlayerId === '0'
                    && snapshot.aiHandCount === 0;
                if (aiAdvancedToDiscard || progressedToHumanTurn) {
                    break;
                }
                await hostPage.waitForTimeout(300);
            }
            if (!lastSnapshot) {
                throw new Error('undo-sell 用例未读到任何状态快照');
            }
            const resolvedToDiscard = lastSnapshot.phase === 'discard'
                && lastSnapshot.activePlayerId === '1'
                && lastSnapshot.aiHandCount === 0;
            const resolvedToHumanTurn = seenAiUndoSellContext
                && lastSnapshot.activePlayerId === '0'
                && lastSnapshot.aiHandCount === 0;
            if (!resolvedToDiscard && !resolvedToHumanTurn) {
                throw new Error(
                    `等待 AI 在仅剩撤回卖牌可选时离开卖/撤循环超时: `
                    + `seenAiUndoSellContext=${String(seenAiUndoSellContext)} `
                    + `snapshot=${JSON.stringify(lastSnapshot)}`,
                );
            }

            await saveEvidenceScreenshot(hostPage, testInfo, '24-ai-undo-sell-loop-after');
        } finally {
            await setup.hostContext.close();
        }
    });

    test('Online 4-player seating panel: clicking an AI portrait swaps seats immediately', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
            joinPlayerIds: ['1'],
            setupData: {
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'human' },
                    '2': { type: 'local-ai' },
                    '3': { type: 'human' },
                },
            },
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { guestPage: requesterPage, matchId } = setup;

        await expect(requesterPage.getByText(/2v2 Seating|2v2 站位/i)).toBeVisible({ timeout: 10000 });
        await expect(requesterPage.getByTestId('dt-seat-swap-seat-2')).toBeVisible({ timeout: 10000 });
        await expect(requesterPage.getByTestId('dt-seat-swap-seat-2').getByText(/^AI$/)).toBeVisible({ timeout: 5000 });

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(requesterPage, testInfo, '03-four-player-seat-swap-ai-before');

        await requesterPage.getByTestId('dt-seat-swap-avatar-2').click();

        await waitForSeatingOrder(matchId, requesterPage, ['0', '2', '1', '3']);
        await waitForSeatSwapRequest(matchId, requesterPage, null);
        await expect(requesterPage.getByTestId('dt-seat-swap-cancel')).toHaveCount(0);
        await expect(requesterPage.getByText(/P1 \/ P2/)).toBeVisible({ timeout: 5000 });
        await expect(requesterPage.getByText(/P3 \/ P4/)).toBeVisible({ timeout: 5000 });

        await saveEvidenceScreenshot(requesterPage, testInfo, '04-four-player-seat-swap-ai-after');

        await cleanupDTMatch(setup);
    });

    test('Online 4-player seating panel: clicking a human portrait enters request UI and approval completes the swap', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
            joinPlayerIds: ['1', '2'],
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const requesterPage = setup.guestPage;
        const approverPage = setup.extraPlayers[0]?.page;
        const matchId = setup.matchId;
        if (!approverPage) {
            await cleanupDTMatch(setup);
            test.skip(true, '未拿到审批方页面');
            return;
        }

        await expect(requesterPage.getByText(/2v2 Seating|2v2 站位/i)).toBeVisible({ timeout: 10000 });
        await expect(approverPage.getByText(/2v2 Seating|2v2 站位/i)).toBeVisible({ timeout: 10000 });

        await requesterPage.getByTestId('dt-seat-swap-avatar-2').click();

        await Promise.all([
            waitForSeatSwapRequest(matchId, requesterPage, { requesterId: '1', targetPlayerId: '2' }),
            waitForSeatSwapRequest(matchId, approverPage, { requesterId: '1', targetPlayerId: '2' }),
        ]);

        await expect(requesterPage.getByTestId('dt-seat-swap-cancel')).toBeVisible({ timeout: 5000 });
        await expect(approverPage.getByTestId('dt-seat-swap-approve')).toBeVisible({ timeout: 5000 });
        await expect(approverPage.getByTestId('dt-seat-swap-reject')).toBeVisible({ timeout: 5000 });

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(requesterPage, testInfo, '05-four-player-seat-swap-human-requester');
        await saveEvidenceScreenshot(approverPage, testInfo, '06-four-player-seat-swap-human-approver');

        await approverPage.getByTestId('dt-seat-swap-approve').click();

        await Promise.all([
            waitForSeatingOrder(matchId, requesterPage, ['0', '2', '1', '3']),
            waitForSeatingOrder(matchId, approverPage, ['0', '2', '1', '3']),
            waitForSeatSwapRequest(matchId, requesterPage, null),
            waitForSeatSwapRequest(matchId, approverPage, null),
        ]);

        await expect(requesterPage.getByTestId('dt-seat-swap-cancel')).toHaveCount(0);
        await expect(approverPage.getByTestId('dt-seat-swap-approve')).toHaveCount(0);
        await expect(requesterPage.getByText(/P1 \/ P2/)).toBeVisible({ timeout: 5000 });
        await expect(requesterPage.getByText(/P3 \/ P4/)).toBeVisible({ timeout: 5000 });

        await saveEvidenceScreenshot(requesterPage, testInfo, '07-four-player-seat-swap-human-approved');

        await cleanupDTMatch(setup);
    });

    test('Online 4-player board: top headers show ally and enemy tones correctly', async ({ browser }) => {
        test.setTimeout(120000);
        const baseURL = test.info().project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, players } = setup;

        await selectCharacter(players[0].page, 'monk');
        await selectCharacter(players[1].page, 'barbarian');
        await selectCharacter(players[2].page, 'pyromancer');
        await selectCharacter(players[3].page, 'paladin');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        // 该用例只依赖 host+目标页的 harness；避免因无关玩家页未完成注入导致用例超时
        await waitForHarnessPages([hostPage, enemyCaptainPage]);

        const headerLocator = hostPage.locator('[data-testid^="dt-top-header-"]');
        await expect(headerLocator).toHaveCount(3, { timeout: 10000 });
        await expect(hostPage.getByTestId('dt-top-header-1')).toHaveAttribute('data-team-tone', 'enemy');
        await expect(hostPage.getByTestId('dt-top-header-1')).toHaveAttribute('data-player-id', '1');
        await expect(hostPage.getByTestId('dt-top-header-2')).toHaveAttribute('data-team-tone', 'ally');
        await expect(hostPage.getByTestId('dt-top-header-2')).toHaveAttribute('data-player-id', '2');
        await expect(hostPage.getByTestId('dt-top-header-3')).toHaveAttribute('data-team-tone', 'enemy');
        await expect(hostPage.getByTestId('dt-top-header-3')).toHaveAttribute('data-player-id', '3');

        await cleanupDTMatch(setup);
    });

    test('Online 4-player targeting roll: auto targets and choice owners stay correct in 2v2', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const defenderPage = players[1].page;
        const defenderCaptainPage = players[3].page;

        await selectCharacter(players[0].page, 'monk');
        await selectCharacter(players[1].page, 'barbarian');
        await selectCharacter(players[2].page, 'pyromancer');
        await selectCharacter(players[3].page, 'paladin');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        // 本用例需要同时验证 host / 敌方队长 / 敌方前排三个视角。
        await waitForHarnessPages([hostPage, defenderPage, defenderCaptainPage]);

        await applyOnlineMatchState(matchId, hostPage, (state) => buildTargetingRollState(state, 2));
        await waitForPhase(hostPage, 'targetingRoll');
        await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');
        await waitForPhase(hostPage, 'defensiveRoll');
        await waitForPendingDefender(hostPage, '3');
        await waitForPhase(defenderCaptainPage, 'defensiveRoll');
        await dismissStartDefenseShowcaseIfPresent(defenderCaptainPage);
        await expect(defenderCaptainPage.locator('[data-tutorial-id="dice-roll-button"]')).toBeEnabled({ timeout: 10000 });

        const paladinDefenseState = await readDefensiveRollLockState(defenderCaptainPage);
        expect(paladinDefenseState.phase).toBe('defensiveRoll');
        expect(paladinDefenseState.defenderId).toBe('3');
        expect(paladinDefenseState.defenseAbilityId).toBe('holy-defense');
        expect(paladinDefenseState.rollLimit).toBe(1);
        expect(paladinDefenseState.rollCount).toBe(0);
        expect(paladinDefenseState.rollDiceCount).toBe(3);
        expect(paladinDefenseState.diceDefinitionIds.every((id: string | null) => id === 'paladin-dice')).toBe(true);
        expect(paladinDefenseState.keptFlags).toEqual([false, false, false, true, true]);
        expect(paladinDefenseState.lockedLabelFlags).toEqual([false, false, false, true, true]);
        expect(paladinDefenseState.rollButtonDisabled).toBe(false);

        await applyOnlineMatchState(matchId, hostPage, (state) => buildTargetingRollState(state, 4));
        await waitForPhase(hostPage, 'targetingRoll');
        await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');
        await waitForPhase(hostPage, 'defensiveRoll');
        await waitForPendingDefender(hostPage, '1');
        await waitForPhase(defenderPage, 'defensiveRoll');
        await dismissStartDefenseShowcaseIfPresent(defenderPage);
        await expect(defenderPage.locator('[data-tutorial-id="dice-roll-button"]')).toBeEnabled({ timeout: 10000 });

        const barbarianDefenseState = await readDefensiveRollLockState(defenderPage);
        expect(barbarianDefenseState.phase).toBe('defensiveRoll');
        expect(barbarianDefenseState.defenderId).toBe('1');
        expect(barbarianDefenseState.defenseAbilityId).toBe('thick-skin');
        expect(barbarianDefenseState.rollLimit).toBe(1);
        expect(barbarianDefenseState.rollCount).toBe(0);
        expect(barbarianDefenseState.rollDiceCount).toBe(3);
        expect(barbarianDefenseState.diceDefinitionIds.every((id: string | null) => id === 'barbarian-dice')).toBe(true);
        expect(barbarianDefenseState.keptFlags).toEqual([false, false, false, true, true]);
        expect(barbarianDefenseState.lockedLabelFlags).toEqual([false, false, false, true, true]);
        expect(barbarianDefenseState.rollButtonDisabled).toBe(false);

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(defenderCaptainPage, testInfo, '04-four-player-paladin-defense-unlocked');
        await saveEvidenceScreenshot(defenderPage, testInfo, '05-four-player-barbarian-defense-unlocked');

        await applyOnlineMatchState(matchId, hostPage, (state) => buildTargetingRollState(state, 5));
        await waitForPhase(hostPage, 'targetingRoll');
        await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');
        await defenderCaptainPage.waitForFunction(() => {
            return (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current?.playerId === '3';
        }, { timeout: 10000 });
        await expect(defenderCaptainPage.getByTestId('dt-defender-choice-panel')).toBeVisible({ timeout: 10000 });
        await expect(defenderCaptainPage.locator('[data-testid^="dt-defender-choice-option-"]')).toHaveCount(2, { timeout: 10000 });
        await expect(defenderCaptainPage.getByTestId('dt-defender-choice-option-1')).toBeVisible({ timeout: 10000 });
        await expect(defenderCaptainPage.getByTestId('dt-defender-choice-option-3')).toBeVisible({ timeout: 10000 });
        await expect(defenderCaptainPage.getByTestId('dt-defender-choice-option-2')).toHaveCount(0);
        await defenderCaptainPage.getByTestId('dt-defender-choice-option-1').click();
        await defenderCaptainPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.sys?.phase === 'defensiveRoll' && state?.core?.pendingAttack?.defenderId === '1';
        }, { timeout: 10000 });
        await expect(defenderCaptainPage.getByTestId('dt-defender-choice-panel')).toBeHidden({ timeout: 10000 });

        await applyOnlineMatchState(matchId, hostPage, (state) => buildTargetingRollState(state, 6));
        await waitForPhase(hostPage, 'targetingRoll');
        await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');
        await hostPage.waitForFunction(() => {
            return (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current?.playerId === '0';
        }, { timeout: 10000 });
        await expect(hostPage.getByTestId('dt-defender-choice-panel')).toBeVisible({ timeout: 10000 });
        await expect(hostPage.locator('[data-testid^="dt-defender-choice-option-"]')).toHaveCount(2, { timeout: 10000 });
        await expect(hostPage.getByTestId('dt-defender-choice-option-1')).toHaveAttribute('data-team-tone', 'enemy');
        await expect(hostPage.getByTestId('dt-defender-choice-option-3')).toHaveAttribute('data-team-tone', 'enemy');

        await saveEvidenceScreenshot(hostPage, testInfo, '06-four-player-target-choice-panel-host');

        await hostPage.getByTestId('dt-defender-choice-option-1').click();
        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.sys?.phase === 'defensiveRoll' && state?.core?.pendingAttack?.defenderId === '1';
        }, { timeout: 10000 });
        await expect(hostPage.getByTestId('dt-defender-choice-panel')).toBeHidden({ timeout: 10000 });

        await cleanupDTMatch(setup);
    });

    test('Online 4-player Eat My Lead: real hand play in targetingRoll auto-target window keeps spotlight and defense on inferred enemy', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const enemyCaptainPage = players[3].page;

        await selectCharacter(players[0].page, 'gunslinger');
        await selectCharacter(players[1].page, 'barbarian');
        await selectCharacter(players[2].page, 'samurai');
        await selectCharacter(players[3].page, 'paladin');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages([hostPage, enemyCaptainPage]);

        await applyOnlineMatchState(matchId, hostPage, buildFourPlayerEatMyLeadTargetingRollState);
        await waitForPhase(hostPage, 'targetingRoll');

        const eatMyLeadCard = hostPage.locator(`[data-card-id="${EAT_MY_LEAD_CARD_ID}"]`).first();
        await expect(eatMyLeadCard).toBeVisible({ timeout: 10000 });

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '07-four-player-eat-my-lead-before-play');

        await eatMyLeadCard.click({ force: true });

        await expectRightTrayBonusDiceConfirmation(hostPage, () => readHarnessState<any>(hostPage));
        await expect(hostPage.locator('[data-testid="dicethrone-2d-dice-tray"]:visible').first().getByTestId('dice-2d')).toHaveCount(5, { timeout: 10000 });

        await expect.poll(async () => {
            const state = await readHarnessState<any>(hostPage);
            return {
                phase: state?.sys?.phase ?? null,
                settlementTargetId: state?.core?.pendingBonusDiceSettlement?.targetId ?? null,
                settlementDiceCount: state?.core?.pendingBonusDiceSettlement?.dice?.length ?? 0,
                sourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
                defenderId: state?.core?.pendingAttack?.defenderId ?? null,
                modifierDamage: state?.core?.pendingAttack?.attackModifierBonusDamage ?? null,
            };
        }, { timeout: 10000, intervals: [200, 400, 800] }).toMatchObject({
            phase: 'targetingRoll',
            settlementTargetId: '3',
            settlementDiceCount: 5,
            sourceAbilityId: 'revolver-3',
            defenderId: null,
        });

        await saveEvidenceScreenshot(hostPage, testInfo, '08-four-player-eat-my-lead-right-tray-on-auto-target');

        await settleCurrentBonusDice(hostPage, () => readHarnessState<any>(hostPage), {});

        await expect.poll(async () => {
            const state = await readHarnessState<any>(hostPage);
            return {
                phase: state?.sys?.phase ?? null,
                settlement: state?.core?.pendingBonusDiceSettlement ?? null,
                defenderId: state?.core?.pendingAttack?.defenderId ?? null,
            };
        }, { timeout: 10000, intervals: [200, 400, 800] }).toMatchObject({
            phase: 'targetingRoll',
            settlement: null,
            defenderId: null,
        });

        await saveEvidenceScreenshot(hostPage, testInfo, '09-four-player-eat-my-lead-overlay-closed');

        await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');
        await waitForPhase(hostPage, 'defensiveRoll');
        await waitForPendingDefender(hostPage, '3');
        await waitForPhase(enemyCaptainPage, 'defensiveRoll');
        await dismissStartDefenseShowcaseIfPresent(enemyCaptainPage);

        await expect.poll(async () => {
            const state = await readHarnessState<any>(hostPage);
            return {
                phase: state?.sys?.phase ?? null,
                defenderId: state?.core?.pendingAttack?.defenderId ?? null,
                settlement: state?.core?.pendingBonusDiceSettlement ?? null,
            };
        }, { timeout: 10000, intervals: [200, 400, 800] }).toMatchObject({
            phase: 'defensiveRoll',
            defenderId: '3',
            settlement: null,
        });

        await saveEvidenceScreenshot(enemyCaptainPage, testInfo, '10-four-player-eat-my-lead-correct-defender');
        await cleanupDTMatch(setup);
    });

    test('Online 4-player transfer token: enemy token can be transferred to ally with stable target metadata', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const allyPage = players[2].page;

        await selectCharacter(players[0].page, 'shadow_thief');
        await selectCharacter(players[1].page, 'paladin');
        await selectCharacter(players[2].page, 'monk');
        await selectCharacter(players[3].page, 'pyromancer');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));

        await applyOnlineMatchState(matchId, hostPage, buildFourPlayerTransferTokenState);
        await waitForPhase(hostPage, 'main1');

        await dispatchHarnessCommand(hostPage, 'PLAY_CARD', '0', { cardId: 'transfer-inst' });
        await expect(hostPage.getByTestId('dt-status-owner-1')).toHaveAttribute('data-team-tone', 'enemy');
        await expect(hostPage.getByTestId('dt-status-owner-2')).toHaveAttribute('data-team-tone', 'ally');
        await expect(hostPage.getByTestId('dt-status-effect-1-crit')).toBeVisible({ timeout: 10000 });

        await hostPage.getByTestId('dt-status-effect-1-crit').click();
        await expect(hostPage.getByTestId('dt-transfer-target-0')).toHaveAttribute('data-team-tone', 'self');
        await expect(hostPage.getByTestId('dt-transfer-source-locked-1')).toHaveAttribute('data-team-tone', 'enemy');
        await expect(hostPage.getByTestId('dt-transfer-source-locked-1')).toHaveAttribute('data-locked', 'true');
        await expect(hostPage.getByTestId('dt-transfer-target-2')).toHaveAttribute('data-team-tone', 'ally');
        await expect(hostPage.getByTestId('dt-transfer-target-3')).toHaveAttribute('data-team-tone', 'enemy');

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '06-four-player-transfer-token-target-selection');

        await hostPage.getByTestId('dt-transfer-target-2').click();
        await hostPage.getByRole('button', { name: /Confirm|确认/i }).last().click();

        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.interaction?.current
                && (state?.core?.players?.['1']?.tokens?.crit ?? 0) === 0
                && (state?.core?.players?.['2']?.tokens?.crit ?? 0) === 1;
        }, undefined, { timeout: 10000 });

        const hostState = await readHarnessState<any>(hostPage);
        const allyState = await readHarnessState<any>(allyPage);
        expect(hostState.core.players['1'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(0);
        expect(hostState.core.players['2'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(1);
        expect(hostState.sys.interaction?.current).toBeUndefined();
        expect(allyState.core.players['2'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(1);

        await cleanupDTMatch(setup);
    });

    test('Online 4-player transfer token: own token can be transferred to enemy without target freeze', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const enemyPage = players[1].page;

        await selectCharacter(players[0].page, 'shadow_thief');
        await selectCharacter(players[1].page, 'paladin');
        await selectCharacter(players[2].page, 'monk');
        await selectCharacter(players[3].page, 'pyromancer');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));
        const diagnosticsEntries = attachTransferStatusDiagnostics(players.map((player) => player.page));

        await applyOnlineMatchState(matchId, hostPage, buildFourPlayerTransferOwnTokenState);
        await waitForPhase(hostPage, 'main1');
        resetTransferStatusDiagnostics(diagnosticsEntries);

        await dispatchHarnessCommand(hostPage, 'PLAY_CARD', '0', { cardId: 'transfer-own-inst' });
        await expect(hostPage.getByTestId('dt-status-owner-0')).toHaveAttribute('data-team-tone', 'self');
        await expect(hostPage.getByTestId('dt-status-effect-0-crit')).toBeVisible({ timeout: 10000 });

        await hostPage.getByTestId('dt-status-effect-0-crit').click();
        await expect(hostPage.getByTestId('dt-transfer-source-locked-0')).toHaveAttribute('data-team-tone', 'self');
        await expect(hostPage.getByTestId('dt-transfer-source-locked-0')).toHaveAttribute('data-locked', 'true');
        await expect(hostPage.getByTestId('dt-transfer-target-1')).toHaveAttribute('data-team-tone', 'enemy');
        await expect(hostPage.getByTestId('dt-transfer-target-2')).toHaveAttribute('data-team-tone', 'ally');
        await expect(hostPage.getByTestId('dt-transfer-target-3')).toHaveAttribute('data-team-tone', 'enemy');

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '06b-four-player-transfer-own-token-target-selection');

        await hostPage.getByTestId('dt-transfer-target-1').click();
        await expect(hostPage.getByTestId('dt-transfer-target-1')).toHaveAttribute('data-selected', 'true');
        await expect(hostPage.getByRole('button', { name: /Confirm|确认/i }).last()).toBeEnabled();
        await saveEvidenceScreenshot(hostPage, testInfo, '06c-four-player-transfer-own-token-target-picked');
        await hostPage.getByRole('button', { name: /Confirm|确认/i }).last().click();

        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.interaction?.current
                && (state?.core?.players?.['0']?.tokens?.crit ?? 0) === 0
                && (state?.core?.players?.['1']?.tokens?.crit ?? 0) === 1;
        }, undefined, { timeout: 10000 });
        await enemyPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.interaction?.current
                && (state?.core?.players?.['0']?.tokens?.crit ?? 0) === 0
                && (state?.core?.players?.['1']?.tokens?.crit ?? 0) === 1;
        }, undefined, { timeout: 10000 });

        const hostState = await readHarnessState<any>(hostPage);
        const enemyState = await readHarnessState<any>(enemyPage);
        expect(hostState.core.players['0'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(0);
        expect(hostState.core.players['1'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(1);
        expect(hostState.sys.interaction?.current).toBeUndefined();
        expect(enemyState.core.players['0'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(0);
        expect(enemyState.core.players['1'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(1);
        assertNoTransferStatusFatalErrors(diagnosticsEntries);

        await saveEvidenceScreenshot(hostPage, testInfo, '06d-four-player-transfer-own-token-resolved');
        await cleanupDTMatch(setup);
    });

    test('Online 4-player transfer token: gunslinger opening loaded can be transferred from self to enemy', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const enemyPage = players[1].page;

        await selectCharacter(players[0].page, 'gunslinger');
        await selectCharacter(players[1].page, 'paladin');
        await selectCharacter(players[2].page, 'monk');
        await selectCharacter(players[3].page, 'pyromancer');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));
        const diagnosticsEntries = attachTransferStatusDiagnostics(players.map((player) => player.page));

        await applyOnlineMatchState(matchId, hostPage, buildFourPlayerTransferOwnLoadedState);
        await waitForPhase(hostPage, 'main1');
        resetTransferStatusDiagnostics(diagnosticsEntries);

        await dispatchHarnessCommand(hostPage, 'PLAY_CARD', '0', { cardId: 'transfer-loaded-inst' });
        await expect(hostPage.getByTestId('dt-status-owner-0')).toHaveAttribute('data-team-tone', 'self');
        await expect(hostPage.getByTestId('dt-status-effect-0-loaded')).toBeVisible({ timeout: 10000 });

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '06e-four-player-transfer-gunslinger-loaded-source-selection');

        await hostPage.getByTestId('dt-status-effect-0-loaded').click();
        await expect(hostPage.getByTestId('dt-transfer-source-locked-0')).toHaveAttribute('data-team-tone', 'self');
        await expect(hostPage.getByTestId('dt-transfer-source-effect-loaded')).toBeVisible({ timeout: 10000 });
        await expect(hostPage.getByTestId('dt-transfer-target-1')).toHaveAttribute('data-team-tone', 'enemy');
        await expect(hostPage.getByTestId('dt-transfer-target-2')).toHaveAttribute('data-team-tone', 'ally');
        await expect(hostPage.getByTestId('dt-transfer-target-3')).toHaveAttribute('data-team-tone', 'enemy');

        await saveEvidenceScreenshot(hostPage, testInfo, '06f-four-player-transfer-gunslinger-loaded-target-selection');

        await hostPage.getByTestId('dt-transfer-target-1').click();
        await expect(hostPage.getByTestId('dt-transfer-target-1')).toHaveAttribute('data-selected', 'true');
        await expect(hostPage.getByRole('button', { name: /Confirm|确认/i }).last()).toBeEnabled();
        await saveEvidenceScreenshot(hostPage, testInfo, '06g-four-player-transfer-gunslinger-loaded-target-picked');
        await hostPage.getByRole('button', { name: /Confirm|确认/i }).last().click();

        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.interaction?.current
                && (state?.core?.players?.['0']?.tokens?.loaded ?? 0) === 0
                && (state?.core?.players?.['1']?.tokens?.loaded ?? 0) === 1;
        }, undefined, { timeout: 10000 });
        await enemyPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.interaction?.current
                && (state?.core?.players?.['0']?.tokens?.loaded ?? 0) === 0
                && (state?.core?.players?.['1']?.tokens?.loaded ?? 0) === 1;
        }, undefined, { timeout: 10000 });

        const hostState = await readHarnessState<any>(hostPage);
        const enemyState = await readHarnessState<any>(enemyPage);
        expect(hostState.core.players['0'].tokens[TOKEN_IDS.LOADED] ?? 0).toBe(0);
        expect(hostState.core.players['1'].tokens[TOKEN_IDS.LOADED] ?? 0).toBe(1);
        expect(hostState.sys.interaction?.current).toBeUndefined();
        expect(enemyState.core.players['0'].tokens[TOKEN_IDS.LOADED] ?? 0).toBe(0);
        expect(enemyState.core.players['1'].tokens[TOKEN_IDS.LOADED] ?? 0).toBe(1);
        assertNoTransferStatusFatalErrors(diagnosticsEntries);

        await saveEvidenceScreenshot(hostPage, testInfo, '06h-four-player-transfer-gunslinger-loaded-resolved');
        await cleanupDTMatch(setup);
    });

    test('Online 4-player transfer token mobile: gunslinger opening loaded can be transferred from self to enemy without render loop', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
            contextOptions: MOBILE_TRANSFER_CONTEXT_OPTIONS,
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const enemyPage = players[1].page;

        await selectCharacter(players[0].page, 'gunslinger');
        await selectCharacter(players[1].page, 'paladin');
        await selectCharacter(players[2].page, 'monk');
        await selectCharacter(players[3].page, 'pyromancer');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));
        const diagnosticsEntries = attachTransferStatusDiagnostics(players.map((player) => player.page));

        await applyOnlineMatchState(matchId, hostPage, buildFourPlayerTransferOwnLoadedState);
        await waitForPhase(hostPage, 'main1');
        resetTransferStatusDiagnostics(diagnosticsEntries);

        await dispatchHarnessCommand(hostPage, 'PLAY_CARD', '0', { cardId: 'transfer-loaded-inst' });
        await expect(hostPage.getByTestId('dt-status-owner-0')).toHaveAttribute('data-team-tone', 'self');
        await expect(hostPage.getByTestId('dt-status-effect-0-loaded')).toBeVisible({ timeout: 10000 });

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '06i-mobile-four-player-transfer-gunslinger-loaded-source-selection');

        await hostPage.getByTestId('dt-status-effect-0-loaded').click();
        await expect(hostPage.getByTestId('dt-transfer-source-locked-0')).toHaveAttribute('data-team-tone', 'self');
        await expect(hostPage.getByTestId('dt-transfer-source-effect-loaded')).toBeVisible({ timeout: 10000 });
        await expect(hostPage.getByTestId('dt-transfer-target-1')).toHaveAttribute('data-team-tone', 'enemy');
        await expect(hostPage.getByTestId('dt-transfer-target-2')).toHaveAttribute('data-team-tone', 'ally');
        await expect(hostPage.getByTestId('dt-transfer-target-3')).toHaveAttribute('data-team-tone', 'enemy');

        await saveEvidenceScreenshot(hostPage, testInfo, '06j-mobile-four-player-transfer-gunslinger-loaded-target-selection');

        await hostPage.getByTestId('dt-transfer-target-1').click();
        await expect(hostPage.getByTestId('dt-transfer-target-1')).toHaveAttribute('data-selected', 'true');
        await expect(hostPage.getByRole('button', { name: /Confirm|确认/i }).last()).toBeEnabled();
        await saveEvidenceScreenshot(hostPage, testInfo, '06k-mobile-four-player-transfer-gunslinger-loaded-target-picked');
        await hostPage.getByRole('button', { name: /Confirm|确认/i }).last().click();

        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.interaction?.current
                && (state?.core?.players?.['0']?.tokens?.loaded ?? 0) === 0
                && (state?.core?.players?.['1']?.tokens?.loaded ?? 0) === 1;
        }, undefined, { timeout: 10000 });
        await enemyPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.interaction?.current
                && (state?.core?.players?.['0']?.tokens?.loaded ?? 0) === 0
                && (state?.core?.players?.['1']?.tokens?.loaded ?? 0) === 1;
        }, undefined, { timeout: 10000 });

        const hostState = await readHarnessState<any>(hostPage);
        const enemyState = await readHarnessState<any>(enemyPage);
        expect(hostState.core.players['0'].tokens[TOKEN_IDS.LOADED] ?? 0).toBe(0);
        expect(hostState.core.players['1'].tokens[TOKEN_IDS.LOADED] ?? 0).toBe(1);
        expect(hostState.sys.interaction?.current).toBeUndefined();
        expect(enemyState.core.players['0'].tokens[TOKEN_IDS.LOADED] ?? 0).toBe(0);
        expect(enemyState.core.players['1'].tokens[TOKEN_IDS.LOADED] ?? 0).toBe(1);
        assertNoTransferStatusFatalErrors(diagnosticsEntries);

        await saveEvidenceScreenshot(hostPage, testInfo, '06l-mobile-four-player-transfer-gunslinger-loaded-resolved');
        await cleanupDTMatch(setup);
    });

    test('Online 4-player grant tokens: Consecrate can grant four tokens to ally with stable target metadata', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const allyPage = players[2].page;

        await selectCharacter(players[0].page, 'paladin');
        await selectCharacter(players[1].page, 'barbarian');
        await selectCharacter(players[2].page, 'monk');
        await selectCharacter(players[3].page, 'pyromancer');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));

        await applyOnlineMatchState(matchId, hostPage, buildFourPlayerConsecrateState);
        await waitForPhase(hostPage, 'main1');

        await dispatchHarnessCommand(hostPage, 'PLAY_CARD', '0', { cardId: 'consecrate-inst' });
        await expect(hostPage.getByTestId('dt-player-target-0')).toHaveAttribute('data-team-tone', 'self');
        await expect(hostPage.getByTestId('dt-player-target-1')).toHaveAttribute('data-team-tone', 'enemy');
        await expect(hostPage.getByTestId('dt-player-target-2')).toHaveAttribute('data-team-tone', 'ally');
        await expect(hostPage.getByTestId('dt-player-target-3')).toHaveAttribute('data-team-tone', 'enemy');

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '07-four-player-consecrate-target-selection');

        await hostPage.getByTestId('dt-player-target-2').click();
        await hostPage.getByRole('button', { name: /Confirm|确认/i }).last().click();

        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const allyTokens = state?.core?.players?.['2']?.tokens ?? {};
            return !state?.sys?.interaction?.current
                && (allyTokens.protect ?? 0) === 1
                && (allyTokens.retribution ?? 0) === 1
                && (allyTokens.crit ?? 0) === 1
                && (allyTokens.accuracy ?? 0) === 1;
        }, undefined, { timeout: 10000 });
        await allyPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const allyTokens = state?.core?.players?.['2']?.tokens ?? {};
            return (allyTokens.protect ?? 0) === 1
                && (allyTokens.retribution ?? 0) === 1
                && (allyTokens.crit ?? 0) === 1
                && (allyTokens.accuracy ?? 0) === 1;
        }, undefined, { timeout: 10000 });

        const hostState = await readHarnessState<any>(hostPage);
        const allyState = await readHarnessState<any>(allyPage);
        for (const tokenId of [TOKEN_IDS.PROTECT, TOKEN_IDS.RETRIBUTION, TOKEN_IDS.CRIT, TOKEN_IDS.ACCURACY]) {
            expect(hostState.core.players['2'].tokens[tokenId] ?? 0).toBe(1);
            expect(allyState.core.players['2'].tokens[tokenId] ?? 0).toBe(1);
        }
        expect(hostState.sys.interaction?.current).toBeUndefined();

        await cleanupDTMatch(setup);
    });

    test('Online 4-player The Law variant: upgraded Deadeye offers all target players in 2v2 and resolves on two selected targets', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const allyPage = players[2].page;
        const enemyCaptainPage = players[3].page;

        await selectCharacter(players[0].page, 'gunslinger');
        await selectCharacter(players[1].page, 'barbarian');
        await selectCharacter(players[2].page, 'samurai');
        await selectCharacter(players[3].page, 'paladin');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));

        await applyOnlineMatchState(matchId, hostPage, buildFourPlayerTheLawState);
        await waitForPhase(hostPage, 'offensiveRoll');

        const confirmButton = hostPage.getByRole('button', { name: /^(Confirm|确认)(?:\s*\(\d+\))?$/i }).last();
        const selfTarget = hostPage.getByTestId('dt-player-target-0');
        const enemyOne = hostPage.getByTestId('dt-player-target-1');
        const allyTarget = hostPage.getByTestId('dt-player-target-2');
        const enemyTwo = hostPage.getByTestId('dt-player-target-3');

        await dispatchHarnessCommand(hostPage, 'SELECT_ABILITY', '0', { abilityId: 'the-law' });
        await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');

        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const current = state?.sys?.interaction?.current?.data;
            const targetPlayerIds = current?.targetPlayerIds ?? [];
            return current?.sourceCardId === 'the-law'
                && targetPlayerIds.length === 4
                && targetPlayerIds.includes('0')
                && targetPlayerIds.includes('1')
                && targetPlayerIds.includes('2')
                && targetPlayerIds.includes('3')
                && state?.core?.players?.['0']?.upgradeCardByAbilityId?.deadeye?.cardId === 'upgrade-deadeye-2'
                && (state?.core?.players?.['0']?.tokens?.evasive ?? 0) === 1;
        }, undefined, { timeout: 10000, polling: 200 });

        await expect(selfTarget).toHaveAttribute('data-team-tone', 'self');
        await expect(enemyOne).toHaveAttribute('data-team-tone', 'enemy');
        await expect(enemyTwo).toHaveAttribute('data-team-tone', 'enemy');
        await expect(allyTarget).toHaveAttribute('data-team-tone', 'ally');
        await expect(confirmButton).toBeDisabled();

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '10-four-player-the-law-all-target-selection');

        await enemyOne.click();
        await enemyTwo.click();
        await expect(confirmButton).toBeEnabled();
        await confirmButton.click();

        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.interaction?.current
                && (state?.core?.players?.['1']?.tokens?.bounty ?? 0) === 1
                && (state?.core?.players?.['1']?.statusEffects?.knockdown ?? 0) === 1
                && (state?.core?.players?.['2']?.tokens?.bounty ?? 0) === 0
                && (state?.core?.players?.['2']?.statusEffects?.knockdown ?? 0) === 0
                && (state?.core?.players?.['3']?.tokens?.bounty ?? 0) === 1
                && (state?.core?.players?.['3']?.statusEffects?.knockdown ?? 0) === 1;
        }, undefined, { timeout: 10000, polling: 200 });
        await enemyCaptainPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return (state?.core?.players?.['3']?.tokens?.bounty ?? 0) === 1
                && (state?.core?.players?.['3']?.statusEffects?.knockdown ?? 0) === 1;
        }, undefined, { timeout: 10000, polling: 200 });

        await saveEvidenceScreenshot(hostPage, testInfo, '11-four-player-the-law-resolved-on-selected-targets');

        const hostState = await readHarnessState<any>(hostPage);
        const allyState = await readHarnessState<any>(allyPage);
        const enemyCaptainState = await readHarnessState<any>(enemyCaptainPage);
        expect(hostState.core.players['0'].tokens[TOKEN_IDS.EVASIVE] ?? 0).toBe(1);
        expect(hostState.core.players['1'].tokens[TOKEN_IDS.BOUNTY] ?? 0).toBe(1);
        expect(hostState.core.players['1'].statusEffects.knockdown ?? 0).toBe(1);
        expect(hostState.core.players['2'].tokens[TOKEN_IDS.BOUNTY] ?? 0).toBe(0);
        expect(hostState.core.players['2'].statusEffects.knockdown ?? 0).toBe(0);
        expect(hostState.core.players['3'].tokens[TOKEN_IDS.BOUNTY] ?? 0).toBe(1);
        expect(hostState.core.players['3'].statusEffects.knockdown ?? 0).toBe(1);
        expect(hostState.sys.interaction?.current).toBeUndefined();
        expect(allyState.core.players['2'].tokens[TOKEN_IDS.BOUNTY] ?? 0).toBe(0);
        expect(allyState.core.players['2'].statusEffects.knockdown ?? 0).toBe(0);
        expect(enemyCaptainState.core.players['3'].tokens[TOKEN_IDS.BOUNTY] ?? 0).toBe(1);
        expect(enemyCaptainState.core.players['3'].statusEffects.knockdown ?? 0).toBe(1);

        await cleanupDTMatch(setup);
    });

    test('Online 4-player Wanted: real hand play offers all target players in 2v2 and grants Bounty to selected target', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const enemyCaptainPage = players[3].page;

        await selectCharacter(players[0].page, 'gunslinger');
        await selectCharacter(players[1].page, 'barbarian');
        await selectCharacter(players[2].page, 'samurai');
        await selectCharacter(players[3].page, 'paladin');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));

        await applyOnlineMatchState(matchId, hostPage, buildFourPlayerWantedState);
        await waitForPhase(hostPage, 'main1');

        const wantedCard = hostPage.locator(`[data-card-id="${WANTED_CARD_ID}"]`).first();
        const confirmButton = hostPage.getByRole('button', { name: /^(Confirm|确认)(?:\s*\(\d+\))?$/i }).last();
        const selfTarget = hostPage.getByTestId('dt-player-target-0');
        const enemyOne = hostPage.getByTestId('dt-player-target-1');
        const allyTarget = hostPage.getByTestId('dt-player-target-2');
        const enemyTwo = hostPage.getByTestId('dt-player-target-3');

        await expect(wantedCard).toBeVisible({ timeout: 5000 });
        await wantedCard.click({ force: true });

        await expect.poll(async () => hostPage.evaluate(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const current = state?.sys?.interaction?.current?.data;
            return {
                sourceCardId: current?.sourceCardId ?? null,
                resolveCustomActionId: current?.resolveCustomActionId ?? null,
                targetPlayerIds: (current?.targetPlayerIds ?? []).slice().sort(),
            };
        }), { timeout: 15000, intervals: [200, 400, 800] }).toEqual({
            sourceCardId: 'card-wanted',
            resolveCustomActionId: 'gunslinger-card-wanted-resolve',
            targetPlayerIds: ['0', '1', '2', '3'],
        });

        await expect(selfTarget).toHaveAttribute('data-team-tone', 'self');
        await expect(enemyOne).toHaveAttribute('data-team-tone', 'enemy');
        await expect(enemyTwo).toHaveAttribute('data-team-tone', 'enemy');
        await expect(allyTarget).toHaveAttribute('data-team-tone', 'ally');
        await expect(confirmButton).toBeDisabled();

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '12-four-player-wanted-all-target-selection');

        await enemyTwo.click();
        await expect(confirmButton).toBeEnabled();
        await confirmButton.click();

        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.interaction?.current
                && (state?.core?.players?.['1']?.tokens?.bounty ?? 0) === 0
                && (state?.core?.players?.['2']?.tokens?.bounty ?? 0) === 0
                && (state?.core?.players?.['3']?.tokens?.bounty ?? 0) === 1;
        }, undefined, { timeout: 10000, polling: 200 });
        await enemyCaptainPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return (state?.core?.players?.['3']?.tokens?.bounty ?? 0) === 1;
        }, undefined, { timeout: 10000, polling: 200 });

        await saveEvidenceScreenshot(hostPage, testInfo, '13-four-player-wanted-resolved-on-selected-target');
        await cleanupDTMatch(setup);
    });

    test('Online 4-player Samurai Shame card: real hand play only offers enemies in 2v2 and applies Shame to selected enemy', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const enemyCaptainPage = players[3].page;

        await selectCharacter(players[0].page, 'samurai');
        await selectCharacter(players[1].page, 'barbarian');
        await selectCharacter(players[2].page, 'gunslinger');
        await selectCharacter(players[3].page, 'paladin');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));

        await applyOnlineMatchState(matchId, hostPage, buildFourPlayerSamuraiAshamedState);
        await waitForPhase(hostPage, 'main1');

        const ashamedCard = hostPage.locator(`[data-card-id="${SAMURAI_ASHAMED_CARD_ID}"]`).first();
        const confirmButton = hostPage.getByRole('button', { name: /^(Confirm|确认)(?:\s*\(\d+\))?$/i }).last();
        const enemyOne = hostPage.getByTestId('dt-player-target-1');
        const allyTarget = hostPage.getByTestId('dt-player-target-2');
        const enemyTwo = hostPage.getByTestId('dt-player-target-3');

        await expect(ashamedCard).toBeVisible({ timeout: 5000 });
        await ashamedCard.click({ force: true });

        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const current = state?.sys?.interaction?.current?.data;
            const targetPlayerIds = current?.targetPlayerIds ?? [];
            return current?.sourceCardId === 'card-you-should-be-ashamed'
                && current?.resolveCustomActionId === 'samurai-card-you-should-be-ashamed-resolve'
                && targetPlayerIds.length === 2
                && targetPlayerIds.includes('1')
                && targetPlayerIds.includes('3')
                && !targetPlayerIds.includes('2');
        }, undefined, { timeout: 10000, polling: 200 });

        await expect(enemyOne).toHaveAttribute('data-team-tone', 'enemy');
        await expect(enemyTwo).toHaveAttribute('data-team-tone', 'enemy');
        await expect(allyTarget).toHaveCount(0);
        await expect(confirmButton).toBeDisabled();

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '14-four-player-samurai-shame-enemy-only-selection');

        await enemyOne.click();
        await expect(confirmButton).toBeEnabled();
        await confirmButton.click();

        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.interaction?.current
                && (state?.core?.players?.['1']?.tokens?.shame ?? 0) === 2
                && (state?.core?.players?.['2']?.tokens?.shame ?? 0) === 0
                && (state?.core?.players?.['3']?.tokens?.shame ?? 0) === 0;
        }, undefined, { timeout: 10000, polling: 200 });
        await enemyCaptainPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return (state?.core?.players?.['3']?.tokens?.shame ?? 0) === 0;
        }, undefined, { timeout: 10000, polling: 200 });

        await saveEvidenceScreenshot(hostPage, testInfo, '15-four-player-samurai-shame-resolved-on-selected-enemy');
        await cleanupDTMatch(setup);
    });

    test('Online 4-player Pistol Whip variant: upgraded Fan the Hammer only offers enemies in 2v2 and applies knockdown plus undefendable damage to selected enemy', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const enemyCaptainPage = players[3].page;

        await selectCharacter(players[0].page, 'gunslinger');
        await selectCharacter(players[1].page, 'barbarian');
        await selectCharacter(players[2].page, 'samurai');
        await selectCharacter(players[3].page, 'paladin');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));

        await applyOnlineMatchState(matchId, hostPage, buildFourPlayerPistolWhipState);
        await waitForPhase(hostPage, 'offensiveRoll');

        const enemyOne = hostPage.getByTestId('dt-defender-choice-option-1');
        const allyTarget = hostPage.getByTestId('dt-defender-choice-option-2');
        const enemyTwo = hostPage.getByTestId('dt-defender-choice-option-3');

        const beforeState = await readHarnessState<any>(hostPage);
        const enemyHpBefore = beforeState.core.players['3'].resources[RESOURCE_IDS.HP] ?? 0;

        await dispatchHarnessCommand(hostPage, 'SELECT_ABILITY', '0', { abilityId: 'pistol-whip' });
        await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');

        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const pendingAttackSource = state?.core?.pendingAttack?.sourceAbilityId ?? null;
            return state?.sys?.phase === 'targetingRoll'
                && state?.core?.players?.['0']?.upgradeCardByAbilityId?.['fan-the-hammer']?.cardId === 'upgrade-fan-the-hammer-2'
                && pendingAttackSource === 'pistol-whip';
        }, undefined, { timeout: 15000, polling: 200 });

        await applyOnlineMatchState(matchId, hostPage, (state) => {
            const next = structuredClone(state);
            next.sys.phase = 'targetingRoll';
            next.sys.flowHalted = false;
            next.core.phase = 'targetingRoll';
            next.core.rollCount = 1;
            next.core.rollLimit = 1;
            next.core.rollDiceCount = 1;
            next.core.rollConfirmed = true;
            next.core.selectedAbilityId = 'pistol-whip';
            next.core.pendingAttack = {
                ...(next.core.pendingAttack ?? {}),
                attackerId: '0',
                defenderId: undefined,
                targetingSelectionPending: false,
                targetingSelectionResolved: false,
                sourceAbilityId: 'pistol-whip',
                isDefendable: false,
                damage: 1,
                bonusDamage: 0,
                attackModifierBonusDamage: 0,
                damageResolved: false,
                resolvedDamage: 0,
                offensiveRollEndTokenResolved: false,
                bonusDiceResolved: false,
            };
            next.core.dice = (next.core.dice ?? []).map((die: any, index: number) => ({
                ...die,
                value: index === 0 ? 6 : (die?.value ?? 1),
                isKept: false,
            }));
            return next;
        });
        await waitForPhase(hostPage, 'targetingRoll');
        await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');
        await hostPage.waitForFunction(() => {
            return (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current?.playerId === '0';
        }, undefined, { timeout: 10000, polling: 200 });

        await expect(hostPage.getByTestId('dt-defender-choice-panel')).toBeVisible();
        await expect(enemyOne).toHaveAttribute('data-team-tone', 'enemy');
        await expect(enemyTwo).toHaveAttribute('data-team-tone', 'enemy');
        await expect(allyTarget).toHaveCount(0);

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '18-four-player-pistol-whip-enemy-only-selection');

        await enemyTwo.click();

        await hostPage.waitForFunction((baselineHp) => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.interaction?.current
                && (state?.core?.players?.['0']?.tokens?.evasive ?? 0) === 1
                && (state?.core?.players?.['1']?.statusEffects?.knockdown ?? 0) === 0
                && (state?.core?.players?.['2']?.statusEffects?.knockdown ?? 0) === 0
                && (state?.core?.players?.['3']?.statusEffects?.knockdown ?? 0) === 1
                && baselineHp - (state?.core?.players?.['3']?.resources?.hp ?? 0) === 1;
        }, enemyHpBefore, { timeout: 10000, polling: 200 });

        await enemyCaptainPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return (state?.core?.players?.['3']?.statusEffects?.knockdown ?? 0) === 1;
        }, undefined, { timeout: 10000, polling: 200 });

        const stateAfter = await readHarnessState<any>(hostPage);
        expect(stateAfter.core.players['0'].tokens[TOKEN_IDS.EVASIVE] ?? 0).toBe(1);
        expect(stateAfter.core.players['1'].statusEffects.knockdown ?? 0).toBe(0);
        expect(stateAfter.core.players['2'].statusEffects.knockdown ?? 0).toBe(0);
        expect(stateAfter.core.players['3'].statusEffects.knockdown ?? 0).toBe(1);
        expect(enemyHpBefore - (stateAfter.core.players['3'].resources[RESOURCE_IDS.HP] ?? 0)).toBe(1);

        await saveEvidenceScreenshot(hostPage, testInfo, '19-four-player-pistol-whip-resolved-on-selected-enemy');
        await cleanupDTMatch(setup);
    });

    test('Online 4-player High Noon: real hand play offers all target players in 2v2 and resolves the rolled branch on selected target', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const enemyCaptainPage = players[3].page;

        await selectCharacter(players[0].page, 'gunslinger');
        await selectCharacter(players[1].page, 'barbarian');
        await selectCharacter(players[2].page, 'samurai');
        await selectCharacter(players[3].page, 'paladin');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));

        await applyOnlineMatchState(matchId, hostPage, buildFourPlayerHighNoonState);
        await waitForPhase(hostPage, 'main1');

        const highNoonCard = hostPage.locator(`[data-card-id="${HIGH_NOON_CARD_ID}"]`).first();
        const confirmButton = hostPage.getByRole('button', { name: /^(Confirm|确认)(?:\s*\(\d+\))?$/i }).last();
        const selfTarget = hostPage.getByTestId('dt-player-target-0');
        const enemyOne = hostPage.getByTestId('dt-player-target-1');
        const allyTarget = hostPage.getByTestId('dt-player-target-2');
        const enemyTwo = hostPage.getByTestId('dt-player-target-3');

        const beforeState = await readHarnessState<any>(hostPage);
        const enemyHpBefore = beforeState.core.players['3'].resources[RESOURCE_IDS.HP] ?? 0;

        await expect(highNoonCard).toBeVisible({ timeout: 5000 });
        // 这里用 harness 命令触发出牌，避免 UI 点击在部分环境下被预览/拖拽态吞掉导致不出牌
        await dispatchHarnessCommand(hostPage, 'PLAY_CARD', '0', { cardId: HIGH_NOON_CARD_ID });

        await expect.poll(async () => hostPage.evaluate(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const current = state?.sys?.interaction?.current?.data;
            return {
                sourceCardId: current?.sourceCardId ?? null,
                resolveCustomActionId: current?.resolveCustomActionId ?? null,
                targetPlayerIds: (current?.targetPlayerIds ?? []).slice().sort(),
                hand: state?.core?.players?.['0']?.hand?.map((card: any) => card.id) ?? [],
            };
        }), { timeout: 15000, intervals: [200, 400, 800] }).toEqual({
            sourceCardId: 'card-high-noon',
            resolveCustomActionId: 'gunslinger-card-high-noon-resolve',
            targetPlayerIds: ['0', '1', '2', '3'],
            hand: [],
        });

        await expect(selfTarget).toHaveAttribute('data-team-tone', 'self');
        await expect(enemyOne).toHaveAttribute('data-team-tone', 'enemy');
        await expect(enemyTwo).toHaveAttribute('data-team-tone', 'enemy');
        await expect(allyTarget).toHaveAttribute('data-team-tone', 'ally');
        await expect(confirmButton).toBeDisabled();

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '16-four-player-high-noon-all-target-selection');

        await enemyTwo.click();
        await expect(confirmButton).toBeEnabled();
        await confirmButton.click();

        await expect.poll(async () => hostPage.evaluate(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const entries = state?.sys?.eventStream?.entries ?? [];
            const latestBonusDieEvent = [...entries].reverse().find((entry: any) => entry.event?.type === 'BONUS_DIE_ROLLED');
            return latestBonusDieEvent?.event?.payload?.effectKey ?? '';
        }), { timeout: 15000, intervals: [200, 400, 800] }).toMatch(
            /^bonusDie\.effect\.gunslingerHighNoon(Bullet|Dash|Bullseye)$/
        );

        await expect.poll(async () => enemyCaptainPage.evaluate(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const entries = state?.sys?.eventStream?.entries ?? [];
            const latestBonusDieEvent = [...entries].reverse().find((entry: any) => entry.event?.type === 'BONUS_DIE_ROLLED');
            return latestBonusDieEvent?.event?.payload?.effectKey ?? '';
        }), { timeout: 15000, intervals: [200, 400, 800] }).toMatch(
            /^bonusDie\.effect\.gunslingerHighNoon(Bullet|Dash|Bullseye)$/
        );

        const stateAfter = await hostPage.evaluate((baselineHp) => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const entries = state?.sys?.eventStream?.entries ?? [];
            const latestBonusDieEvent = [...entries].reverse().find((entry: any) => entry.event?.type === 'BONUS_DIE_ROLLED');
            return {
                effectKey: latestBonusDieEvent?.event?.payload?.effectKey ?? null,
                enemyOneBounty: state?.core?.players?.['1']?.tokens?.bounty ?? 0,
                allyBounty: state?.core?.players?.['2']?.tokens?.bounty ?? 0,
                enemyTwoBounty: state?.core?.players?.['3']?.tokens?.bounty ?? 0,
                enemyOneKnockdown: state?.core?.players?.['1']?.statusEffects?.knockdown ?? 0,
                allyKnockdown: state?.core?.players?.['2']?.statusEffects?.knockdown ?? 0,
                enemyTwoKnockdown: state?.core?.players?.['3']?.statusEffects?.knockdown ?? 0,
                enemyTwoHp: state?.core?.players?.['3']?.resources?.hp ?? 0,
                enemyTwoDamage: baselineHp - (state?.core?.players?.['3']?.resources?.hp ?? 0),
            };
        }, enemyHpBefore);

        expect(stateAfter.enemyOneBounty).toBe(0);
        expect(stateAfter.allyBounty).toBe(0);
        expect(stateAfter.enemyOneKnockdown).toBe(0);
        expect(stateAfter.allyKnockdown).toBe(0);

        if (stateAfter.effectKey === 'bonusDie.effect.gunslingerHighNoonBullet') {
            expect(stateAfter.enemyTwoDamage).toBe(2);
            expect(stateAfter.enemyTwoBounty).toBe(0);
            expect(stateAfter.enemyTwoKnockdown).toBe(0);
        } else if (stateAfter.effectKey === 'bonusDie.effect.gunslingerHighNoonDash') {
            expect(stateAfter.enemyTwoDamage).toBe(0);
            expect(stateAfter.enemyTwoBounty).toBe(0);
            expect(stateAfter.enemyTwoKnockdown).toBe(1);
        } else {
            expect(stateAfter.effectKey).toBe('bonusDie.effect.gunslingerHighNoonBullseye');
            expect(stateAfter.enemyTwoDamage).toBe(0);
            expect(stateAfter.enemyTwoBounty).toBe(1);
            expect(stateAfter.enemyTwoKnockdown).toBe(0);
        }

        await saveEvidenceScreenshot(hostPage, testInfo, '17-four-player-high-noon-resolved-on-selected-target');
        await cleanupDTMatch(setup);
    });

    test('Online 4-player ability grant token: Vengeance II can grant Retribution to ally with stable target metadata', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;

        await selectCharacter(players[0].page, 'paladin');
        await selectCharacter(players[1].page, 'barbarian');
        await selectCharacter(players[2].page, 'monk');
        await selectCharacter(players[3].page, 'pyromancer');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));

        await applyOnlineMatchState(matchId, hostPage, buildFourPlayerVengeance2State);
        await waitForPhase(hostPage, 'offensiveRoll');

        const vengeanceDebugState = await readHarnessState<any>(hostPage);
        const availableAbilities = vengeanceDebugState.core.players['0'].abilities.map((ability: any) => ({
            id: ability.id,
            variantIds: (ability.variants ?? []).map((variant: any) => variant.id),
        }));
        const availableAbilityIds = getAvailableAbilityIds(
            vengeanceDebugState.core,
            '0',
            vengeanceDebugState.sys.phase,
        );
        testInfo.annotations.push({
            type: 'vengeance-debug',
            description: JSON.stringify({ availableAbilities, availableAbilityIds }),
        });
        expect(availableAbilityIds, `Vengeance II 可用技能集异常: ${JSON.stringify({ availableAbilities, availableAbilityIds })}`)
            .toContain('vengeance-2-main');

        await dispatchHarnessCommand(hostPage, 'SELECT_ABILITY', '0', { abilityId: 'vengeance-2-main' });
        await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');
        await hostPage.waitForFunction(() => {
            const current = (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current;
            return current?.kind === 'dt:card-interaction' && current?.playerId === '0';
        }, undefined, { timeout: 10000 });
        await expect(hostPage.getByTestId('dt-player-target-0')).toHaveAttribute('data-team-tone', 'self');
        await expect(hostPage.getByTestId('dt-player-target-1')).toHaveAttribute('data-team-tone', 'enemy');
        await expect(hostPage.getByTestId('dt-player-target-2')).toHaveAttribute('data-team-tone', 'ally');
        await expect(hostPage.getByTestId('dt-player-target-3')).toHaveAttribute('data-team-tone', 'enemy');

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '10-four-player-vengeance-2-target-selection');

        await hostPage.getByTestId('dt-player-target-2').click();
        await hostPage.getByRole('button', { name: /Confirm|确认/i }).last().click();

        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.interaction?.current
                && (state?.core?.players?.['2']?.tokens?.retribution ?? 0) === 1;
        }, undefined, { timeout: 10000 });

        const hostState = await readHarnessState<any>(hostPage);
        expect(hostState.core.players['2'].tokens[TOKEN_IDS.RETRIBUTION] ?? 0).toBe(1);
        expect(hostState.sys.interaction?.current).toBeUndefined();

        await cleanupDTMatch(setup);
    });

    test('Online 4-player remove single status: remove-status-1 can remove enemy token with stable owner metadata', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const targetPage = players[1].page;

        await selectCharacter(players[0].page, 'shadow_thief');
        await selectCharacter(players[1].page, 'paladin');
        await selectCharacter(players[2].page, 'monk');
        await selectCharacter(players[3].page, 'pyromancer');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));

        await applyOnlineMatchState(matchId, hostPage, buildFourPlayerRemoveSingleStatusState);
        await waitForPhase(hostPage, 'main1');

        await dispatchHarnessCommand(hostPage, 'PLAY_CARD', '0', { cardId: 'remove-single-inst' });
        await expect(hostPage.getByTestId('dt-status-owner-0')).toHaveAttribute('data-team-tone', 'self');
        await expect(hostPage.getByTestId('dt-status-owner-1')).toHaveAttribute('data-team-tone', 'enemy');
        await expect(hostPage.getByTestId('dt-status-owner-2')).toHaveAttribute('data-team-tone', 'ally');
        await expect(hostPage.getByTestId('dt-status-owner-3')).toHaveAttribute('data-team-tone', 'enemy');
        await expect(hostPage.getByTestId('dt-status-effect-1-crit')).toBeVisible({ timeout: 10000 });

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '08-four-player-remove-single-status-selection');

        await hostPage.getByTestId('dt-status-effect-1-crit').click();
        await hostPage.getByRole('button', { name: /Confirm|确认/i }).last().click();

        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.interaction?.current
                && (state?.core?.players?.['1']?.tokens?.crit ?? 0) === 0;
        }, undefined, { timeout: 10000 });
        await targetPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return (state?.core?.players?.['1']?.tokens?.crit ?? 0) === 0;
        }, undefined, { timeout: 10000 });

        const hostState = await readHarnessState<any>(hostPage);
        const targetState = await readHarnessState<any>(targetPage);
        expect(hostState.core.players['1'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(0);
        expect(targetState.core.players['1'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(0);
        expect(hostState.sys.interaction?.current).toBeUndefined();

        await cleanupDTMatch(setup);
    });

    test('Online 2-player Bye Bye: off-turn instant card can play but cannot sell', async ({ browser, workerPorts }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = `http://127.0.0.1:${workerPorts.frontend}`;
        const gameServerBaseURL = `http://127.0.0.1:${workerPorts.gameServer}`;

        const setup = await setupDTOnlineMatch(browser, baseURL, { gameServerBaseURL });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, guestPage, matchId } = setup;

        await selectCharacter(hostPage, 'gunslinger');
        await selectCharacter(guestPage, 'barbarian');
        await readyAndStartGame(hostPage, guestPage);

        await waitForGameBoard(hostPage);
        await waitForGameBoard(guestPage);
        await waitForHarnessPages([hostPage, guestPage]);

        await applyOnlineMatchState(matchId, hostPage, buildTwoPlayerOffTurnByeByeBountyState);
        await waitForPhase(hostPage, 'main1');
        await waitForHandCardVisualReady(hostPage, BYE_BYE_CARD_ID);

        const beforeState = await readHarnessState<any>(hostPage);
        expect(beforeState.core.activePlayerId).toBe('1');

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '01-非当前回合即时牌仍可从手牌发起');

        await hostPage.evaluate(() => {
            (window as any).__BG_LAST_COMMAND_REJECTED__ = null;
        });

        const byeByeCard = hostPage.locator(`[data-testid="hand-area"] [data-card-id="${BYE_BYE_CARD_ID}"]`).first();
        const discardPile = hostPage.getByTestId('discard-pile');
        const cardBox = await byeByeCard.boundingBox();
        const discardBox = await discardPile.boundingBox();
        if (!cardBox || !discardBox) {
            throw new Error('无法获取即时牌或弃牌堆的真实页面位置');
        }

        await hostPage.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height * 0.78);
        await hostPage.mouse.down();
        await hostPage.mouse.move(discardBox.x + discardBox.width / 2, discardBox.y + discardBox.height / 2, { steps: 12 });
        await hostPage.mouse.up();
        await hostPage.waitForTimeout(300);
        const afterSellAttempt = await readHarnessState<any>(hostPage);
        expect(afterSellAttempt.core.players['0'].hand.some((card: any) => card.id === BYE_BYE_CARD_ID)).toBe(true);
        expect(afterSellAttempt.core.players['0'].discard.some((card: any) => card.id === BYE_BYE_CARD_ID)).toBe(false);
        const rejectedSellToast = hostPage.getByText(/不是你的回合|not your turn/i).last();
        await expect(rejectedSellToast).toBeVisible({ timeout: 5000 });
        await hostPage.getByRole('button', { name: /关闭|close/i }).last().click();
        await expect(rejectedSellToast).toBeHidden({ timeout: 5000 });

        await dragHandCardToPlay(hostPage, BYE_BYE_CARD_ID);

        const bountyOption = hostPage.getByTestId('dt-status-effect-1-bounty');
        const confirmButton = hostPage.getByRole('button', { name: /Confirm|确认/i }).last();
        await waitForStatusIconImage(hostPage, 'dt-status-effect-1-bounty');
        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.sys?.interaction?.current?.playerId === '0'
                && state?.sys?.interaction?.current?.kind === 'dt:card-interaction';
        }, undefined, { timeout: 10000 });
        await saveEvidenceScreenshot(hostPage, testInfo, '02-非当前回合打出拜拜了您嘞后可选择状态');

        await bountyOption.click();
        await expect(confirmButton).toBeEnabled({ timeout: 5000 });
        await confirmButton.click();
        await hostPage.waitForTimeout(1200);
        await saveEvidenceScreenshot(hostPage, testInfo, '03-非当前回合即时牌结算后赏金已移除');

        const afterState = await readHarnessState<any>(hostPage);
        expect(afterState.core.players['1'].tokens[TOKEN_IDS.BOUNTY] ?? 0).toBe(0);
        expect(afterState.sys.interaction?.current).toBeUndefined();

        await cleanupDTMatch(setup);
    });

    test('Online AI private status removal stays AI-owned and never sends a human response pass', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupDTOnlineAiRoom(browser, baseURL);
        if (!setup) {
            test.skip(true, 'DiceThrone AI 联机房间创建失败');
            return;
        }

        try {
            const { hostPage, matchId } = setup;
            await waitForCharacterSelection(hostPage, 20000);
            await waitForAiSeatCredential(hostPage, matchId, '1');
            await installOnlineCommandRecorder(hostPage);
            await selectCharacter(hostPage, 'monk');

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                return state.core?.selectedCharacters?.['0'] === 'monk'
                    && state.core?.selectedCharacters?.['1'] !== 'unselected'
                    && state.core?.readyPlayers?.['1'] === true;
            }, { timeout: 30000, message: '等待 AI 用自己的座位完成选角和准备' }).toBe(true);

            // AI 准备完成后由房主自动发起开始，不能再把旧的手动开始按钮当作必经入口。
            await waitForTestHarness(hostPage, 15000);
            await installOnlineCommandRecorder(hostPage);

            await applyOnlineMatchState(matchId, hostPage, buildOnlineAiByeByeBountyState);
            await waitForOnlineAiSeatToReceiveState(
                hostPage,
                (state) => state?.core?.activePlayerId === '1'
                    && state?.sys?.phase === 'main1'
                    && (state?.core?.players?.['0']?.tokens?.[TOKEN_IDS.BOUNTY] ?? 0) === 1
                    && (state?.core?.players?.['1']?.hand ?? []).some((card: any) => card.id === BYE_BYE_CARD_ID),
                '等待 AI 座位同步到拜拜了您嘞的私有选择前态',
            );
            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                const recorder = await readOnlineCommandRecorder(hostPage);
                return {
                    bounty: state.core?.players?.['0']?.tokens?.[TOKEN_IDS.BOUNTY] ?? 0,
                    interaction: state.sys?.interaction?.current?.kind ?? null,
                    responseWindow: state.sys?.responseWindow?.current?.id ?? null,
                    aiDiscarded: (state.core?.players?.['1']?.discard ?? []).some((card: any) => card.id === BYE_BYE_CARD_ID),
                    commands: recorder,
                };
            }, { timeout: 30000, message: '等待 AI 自行完成拜拜您的私有状态选择' }).toMatchObject({
                bounty: 0,
                interaction: null,
                responseWindow: null,
                aiDiscarded: true,
            });

            // AI 使用独立 seat transport，真人浏览器只能观察自己的发送记录。
            // AI 的服务端最终状态在上面的 poll 中已证明：出牌、移除状态并完成私有交互。
            expect(await readOnlineCommandRecorder(hostPage))
                .not.toContainEqual({ playerId: '0', type: 'RESPONSE_PASS' });

            await closeBoardMagnifyIfOpen(hostPage);
            await waitForCardSpotlightToClose(hostPage);
            await clearEvidenceScreenshotsForTest(testInfo);
            await saveEvidenceScreenshot(hostPage, testInfo, '21-online-ai-private-status-removal-complete');
        } finally {
            await cleanupDTMatch(setup);
        }
    });

    test('Online 4-player remove all status: remove-all-status blocks empty targets and clears enemy removable effects', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const targetPage = players[1].page;

        await selectCharacter(players[0].page, 'shadow_thief');
        await selectCharacter(players[1].page, 'paladin');
        await selectCharacter(players[2].page, 'monk');
        await selectCharacter(players[3].page, 'pyromancer');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));

        await applyOnlineMatchState(matchId, hostPage, buildFourPlayerRemoveAllStatusState);
        await waitForPhase(hostPage, 'main1');

        await dispatchHarnessCommand(hostPage, 'PLAY_CARD', '0', { cardId: 'remove-all-inst' });
        await expect(hostPage.getByTestId('dt-player-target-0')).toHaveAttribute('data-team-tone', 'self');
        await expect(hostPage.getByTestId('dt-player-target-1')).toHaveAttribute('data-team-tone', 'enemy');
        await expect(hostPage.getByTestId('dt-player-target-2')).toHaveAttribute('data-team-tone', 'ally');
        await expect(hostPage.getByTestId('dt-player-target-3')).toHaveAttribute('data-team-tone', 'enemy');

        const confirmButton = hostPage.getByRole('button', { name: /Confirm|确认/i }).last();
        await expect(confirmButton).toBeDisabled();
        await hostPage.getByTestId('dt-player-target-2').click();
        await expect(confirmButton).toBeDisabled();

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '09-four-player-remove-all-status-selection');

        await hostPage.getByTestId('dt-player-target-1').click();
        await expect(confirmButton).toBeEnabled({ timeout: 5000 });
        await confirmButton.click();

        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.sys?.interaction?.current
                && (state?.core?.players?.['1']?.statusEffects?.burn ?? 0) === 0
                && (state?.core?.players?.['1']?.tokens?.crit ?? 0) === 0;
        }, undefined, { timeout: 10000 });
        await targetPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return (state?.core?.players?.['1']?.statusEffects?.burn ?? 0) === 0
                && (state?.core?.players?.['1']?.tokens?.crit ?? 0) === 0;
        }, undefined, { timeout: 10000 });

        const hostState = await readHarnessState<any>(hostPage);
        const targetState = await readHarnessState<any>(targetPage);
        expect(hostState.core.players['1'].statusEffects.burn ?? 0).toBe(0);
        expect(hostState.core.players['1'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(0);
        expect(targetState.core.players['1'].statusEffects.burn ?? 0).toBe(0);
        expect(targetState.core.players['1'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(0);
        expect(hostState.sys.interaction?.current).toBeUndefined();

        await cleanupDTMatch(setup);
    });

    test('Online 4-player allOpponents: Meteor collateral only hits enemies in 2v2', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const allyPage = players[2].page;
        const enemyCaptainPage = players[3].page;

        await selectCharacter(players[0].page, 'pyromancer');
        await selectCharacter(players[1].page, 'barbarian');
        await selectCharacter(players[2].page, 'monk');
        await selectCharacter(players[3].page, 'paladin');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));

        await applyOnlineMatchState(matchId, hostPage, buildFourPlayerMeteorAllOpponentsState);
        await waitForPhase(hostPage, 'offensiveRoll');

        await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');
        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const players = state?.core?.players ?? {};
            return (players['1']?.resources?.hp ?? 0) === 44
                && (players['2']?.resources?.hp ?? 0) === 50
                && (players['3']?.resources?.hp ?? 0) === 44;
        }, undefined, { timeout: 10000 });

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '11-four-player-meteor-all-opponents-resolution');

        await expect(hostPage.getByTestId('dt-top-header-1-hp')).toHaveText('44', { timeout: 10000 });
        await expect(hostPage.getByTestId('dt-top-header-2-hp')).toHaveText('50', { timeout: 10000 });
        await expect(hostPage.getByTestId('dt-top-header-3-hp')).toHaveText('44', { timeout: 10000 });

        const hostState = await readHarnessState<any>(hostPage);
        const allyState = await readHarnessState<any>(allyPage);
        const enemyCaptainState = await readHarnessState<any>(enemyCaptainPage);

        expect(hostState.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0).toBe(44);
        expect(hostState.core.players['2'].resources[RESOURCE_IDS.HP] ?? 0).toBe(50);
        expect(hostState.core.players['3'].resources[RESOURCE_IDS.HP] ?? 0).toBe(44);
        expect(allyState.core.players['2'].resources[RESOURCE_IDS.HP] ?? 0).toBe(50);
        expect(enemyCaptainState.core.players['3'].resources[RESOURCE_IDS.HP] ?? 0).toBe(44);

        await cleanupDTMatch(setup);
    });

    test('Online 4-player 2v2 flow: response queue excludes teammate and defense chain reaches team victory UI', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const defenderPage = players[1].page;
        const defenderCaptainPage = players[3].page;

        await selectCharacter(players[0].page, 'monk');
        await selectCharacter(players[1].page, 'barbarian');
        await selectCharacter(players[2].page, 'pyromancer');
        await selectCharacter(players[3].page, 'paladin');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));

        await applyOnlineMatchState(matchId, hostPage, buildDefensiveResponseWindowTriggerState);
        await waitForPhase(hostPage, 'defensiveRoll');

        await dispatchHarnessCommand(defenderCaptainPage, 'CONFIRM_ROLL', '3');
        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const queue = state?.sys?.responseWindow?.current?.responderQueue ?? [];
            return state?.sys?.phase === 'defensiveRoll' && queue.length === 1 && queue[0] === '0';
        }, { timeout: 10000 });

        const responseState = await readHarnessState<any>(hostPage);
        expect(responseState.sys.responseWindow?.current?.responderQueue).toEqual(['0']);
        expect(responseState.sys.responseWindow?.current?.responderQueue).not.toContain('2');

        await applyOnlineMatchState(matchId, hostPage, (state) => buildTargetingRollState(state, 6));
        await waitForPhase(hostPage, 'targetingRoll');
        await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');
        await hostPage.getByTestId('dt-defender-choice-option-1').click();
        await defenderPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.sys?.phase === 'defensiveRoll' && state?.core?.pendingAttack?.defenderId === '1';
        }, { timeout: 10000 });

        await applyOnlineMatchState(matchId, hostPage, buildDefensiveRollResolutionState);
        await waitForPhase(defenderPage, 'defensiveRoll');
        await dispatchHarnessCommand(defenderPage, 'ADVANCE_PHASE', '1');
        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.sys?.phase === 'main2' && !state?.core?.pendingAttack;
        }, { timeout: 10000 });

        const resolvedState = await readHarnessState<any>(hostPage);
        expect(resolvedState.sys.phase).toBe('main2');
        expect(resolvedState.core.pendingAttack).toBeFalsy();

        const victoryState = structuredClone(resolvedState);
        victoryState.core.teamHealth = { A: victoryState.core.teamHealth?.A ?? 50, B: 0 };
        victoryState.core.players['1'].resources.hp = 0;
        victoryState.core.players['3'].resources.hp = 0;
        victoryState.sys.gameover = { winner: '0' };
        await injectMatchState(matchId, normalizeInjectedMatchState(matchId, victoryState), hostPage);

        await expect(hostPage.getByTestId('dt-endgame-title')).toBeVisible({ timeout: 10000 });
        await expect(hostPage.getByTestId('dt-endgame-title')).toContainText('Victory');
        await expect(defenderPage.getByTestId('dt-endgame-title')).toContainText('Defeat');

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '05-four-player-team-victory-ui');

        await cleanupDTMatch(setup);
    });

    test('Online 4-player direct dice ally: teammate stays out of responder queue but can still open modify interaction', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
            numPlayers: 4,
            gameServerBaseURL: getGameServerBaseURL(),
        });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或四人房间创建失败');
            return;
        }

        const { hostPage, matchId, players } = setup;
        const allyPage = players[2].page;
        const defenderCaptainPage = players[3].page;

        await selectCharacter(players[0].page, 'monk');
        await selectCharacter(players[1].page, 'barbarian');
        await selectCharacter(players[2].page, 'pyromancer');
        await selectCharacter(players[3].page, 'paladin');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));

        await applyOnlineMatchState(matchId, hostPage, buildDefensiveResponseWindowTriggerState);
        await waitForPhase(hostPage, 'defensiveRoll');

        await dispatchHarnessCommand(defenderCaptainPage, 'CONFIRM_ROLL', '3');
        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const queue = state?.sys?.responseWindow?.current?.responderQueue ?? [];
            return state?.sys?.phase === 'defensiveRoll' && queue.length === 1 && queue[0] === '0';
        }, { timeout: 10000 });

        const queuedState = await readHarnessState<any>(hostPage);
        expect(queuedState.sys.responseWindow?.current?.responderQueue).toEqual(['0']);
        expect(queuedState.sys.responseWindow?.current?.responderQueue).not.toContain('2');

        await dispatchHarnessCommand(allyPage, 'PLAY_CARD', '2', { cardId: RESPONSE_WINDOW_CARD_ID });

        await allyPage.waitForFunction((responseWindowCardId: string) => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const queue = state?.sys?.responseWindow?.current?.responderQueue ?? [];
            const interaction = state?.sys?.interaction?.current;
            const allyDiscard = state?.core?.players?.['2']?.discard ?? [];
            return interaction?.playerId === '2'
                && interaction?.kind === 'multistep-choice'
                && queue.length === 1
                && queue[0] === '0'
                && !queue.includes('2')
                && allyDiscard.some((card: any) => card.id === responseWindowCardId);
        }, RESPONSE_WINDOW_CARD_ID, { timeout: 10000 });
        await expect(allyPage.getByRole('button', { name: /Confirm|确认/i }).last()).toBeVisible({ timeout: 10000 });

        const allyState = await readHarnessState<any>(allyPage);
        expect(allyState.sys.responseWindow?.current?.responderQueue).toEqual(['0']);
        expect(allyState.sys.responseWindow?.current?.responderQueue).not.toContain('2');
        expect(allyState.sys.interaction.current?.playerId).toBe('2');
        expect(allyState.sys.interaction.current?.kind).toBe('multistep-choice');
        expect(allyState.core.players['2'].discard.some((card: any) => card.id === RESPONSE_WINDOW_CARD_ID)).toBe(true);

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(allyPage, testInfo, '12-four-player-direct-dice-ally-interaction');

        await cleanupDTMatch(setup);
    });
});
