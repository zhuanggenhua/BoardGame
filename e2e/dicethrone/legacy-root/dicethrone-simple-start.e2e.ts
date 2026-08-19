/**
 * DiceThrone 简单开局 E2E 测试
 * 目标：覆盖双人与四人房间的创建、占座、加入与开局主链路。
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';
import { test, expect } from '../../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../../framework/evidenceScreenshots';
import { ensureGameServerAvailable, getGameServerBaseURL, initContext, setChineseLocale, waitForTestHarness } from '../../helpers/common';
import { getMatchState, injectMatchState } from '../../helpers/state-injection';
import { createCharacterDice } from '../../../src/games/dicethrone/domain/characters';
import { COMMON_CARDS } from '../../../src/games/dicethrone/domain/commonCards';
import { GUNSLINGER_DICE_FACE_IDS, PALADIN_DICE_FACE_IDS, TOKEN_IDS } from '../../../src/games/dicethrone/domain/ids';
import { RESOURCE_IDS } from '../../../src/games/dicethrone/domain/resources';
import { getAvailableAbilityIds } from '../../../src/games/dicethrone/domain/rules';
import { registerDiceThroneConditions } from '../../../src/games/dicethrone/conditions';
import { DEADEYE_2, FAN_THE_HAMMER_2 } from '../../../src/games/dicethrone/heroes/gunslinger/abilities';
import { GUNSLINGER_CARDS } from '../../../src/games/dicethrone/heroes/gunslinger/cards';
import { VENGEANCE_2 } from '../../../src/games/dicethrone/heroes/paladin/abilities';
import { PALADIN_CARDS } from '../../../src/games/dicethrone/heroes/paladin/cards';
import { SAMURAI_CARDS } from '../../../src/games/dicethrone/heroes/samurai/cards';
import {
    claimDTSeatViaAPI,
    cleanupDTMatch,
    createDTRoomViaAPI,
    readyAndStartGame,
    readyMultiplePlayersAndStartGame,
    seedDTMatchCredentials,
    selectCharacter,
    setupDTOnlineMatch,
    setupDTOnlineMatchWithPlayers,
    waitForCharacterSelection,
    waitForGameBoard,
} from '../../helpers/dicethrone';

registerDiceThroneConditions();

const MONK_FIST_ATTACK_ID = 'fist-technique-5';
const RESPONSE_WINDOW_CARD_ID = 'card-surprise';
const RESPONSE_WINDOW_CARD = COMMON_CARDS.find((card) => card.id === RESPONSE_WINDOW_CARD_ID);
const REMOVE_SINGLE_STATUS_CARD_ID = 'card-get-away';
const REMOVE_SINGLE_STATUS_CARD = COMMON_CARDS.find((card) => card.id === REMOVE_SINGLE_STATUS_CARD_ID);
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
const CONSECRATE_CARD_ID = 'card-consecrate';
const CONSECRATE_CARD = PALADIN_CARDS.find((card) => card.id === CONSECRATE_CARD_ID);
const PALADIN_VENGEANCE_2_CARD_ID = 'card-vengeance-2';
const PALADIN_VENGEANCE_2_CARD = PALADIN_CARDS.find((card) => card.id === PALADIN_VENGEANCE_2_CARD_ID);
const SAMURAI_ASHAMED_CARD_ID = 'card-you-should-be-ashamed';
const SAMURAI_ASHAMED_CARD = SAMURAI_CARDS.find((card) => card.id === SAMURAI_ASHAMED_CARD_ID);

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

async function seedAiSeatCredentials(
    page: Page,
    matchId: string,
    credentials: Record<string, string>,
): Promise<void> {
    await page.evaluate(({ targetMatchId, nextCredentials }) => {
        localStorage.setItem(`match_ai_creds_${targetMatchId}`, JSON.stringify(nextCredentials));
        window.dispatchEvent(new Event('match-credentials-changed'));
    }, { targetMatchId: matchId, nextCredentials: credentials });
    await page.waitForTimeout(300);
}

async function setupDTOnlineAiRoom(
    browser: Browser,
    baseURL: string | undefined,
    options: {
        minimumActionDelayMs?: number;
        numPlayers?: number;
        aiSeatIds?: string[];
    } = {},
): Promise<{
    hostPage: Page;
    hostContext: BrowserContext;
    matchId: string;
} | null> {
    const hostContext = await browser.newContext({ baseURL });
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
    const numPlayers = Math.max(2, options.numPlayers ?? 2);
    const aiSeatIds = (options.aiSeatIds?.length
        ? options.aiSeatIds
        : Array.from({ length: numPlayers - 1 }, (_, index) => String(index + 1)))
        .filter((seatId, index, array) => array.indexOf(seatId) === index)
        .filter((seatId) => Number(seatId) >= 1 && Number(seatId) < numPlayers);
    const seatControllers = Object.fromEntries(
        aiSeatIds.map((seatId) => [
            seatId,
            {
                type: 'local-ai',
                minimumActionDelayMs: options.minimumActionDelayMs ?? 2000,
            },
        ]),
    );
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
        numPlayers,
        gameServerBaseURL: getGameServerBaseURL(),
        setupData: {
            enableAi: true,
            seatControllers,
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

async function waitForAiSeatCredentials(
    page: Page,
    matchId: string,
    playerIds: readonly string[],
): Promise<void> {
    for (const playerId of playerIds) {
        await waitForAiSeatCredential(page, matchId, playerId);
    }
}

const FOUR_PLAYER_AI_SEAT_IDS = ['1', '2', '3'] as const;

async function setupDTFourPlayerOnlineAiRoom(
    browser: Browser,
    baseURL: string | undefined,
    options: {
        minimumActionDelayMs?: number;
    } = {},
) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        const setup = await setupDTOnlineAiRoom(browser, baseURL, {
            numPlayers: 4,
            aiSeatIds: [...FOUR_PLAYER_AI_SEAT_IDS],
            minimumActionDelayMs: options.minimumActionDelayMs,
        });
        if (!setup) {
            return null;
        }

        const initialEntry = await resolveOnlineAiRoomEntry(setup.hostPage, 30000)
            .catch(() => 'character-selection' as const);

        if (initialEntry === 'character-selection') {
            return {
                ...setup,
                initialEntry,
            };
        }

        try {
            await waitForGameBoard(setup.hostPage, 30000);
            await waitForTestHarness(setup.hostPage, 15000);
            await expect.poll(async () => {
                const state = await getMatchState(setup.matchId, setup.hostPage);
                return Object.keys(state.core?.players ?? {}).sort();
            }, {
                timeout: 10000,
                message: '等待 4 人 AI 房棋盘态在服务器侧保持 0/1/2/3 四个 seat',
            }).toEqual(['0', '1', '2', '3']);

            return {
                ...setup,
                initialEntry,
            };
        } catch {
            await setup.hostContext.close();
        }
    }

    return null;
}

async function prepareFourPlayerOnlineAiSetup(
    page: Page,
    matchId: string,
    characterId: string,
    waitMessage: string,
    entryHint?: 'board' | 'character-selection',
): Promise<'board' | 'character-selection'> {
    const entry = entryHint ?? await resolveOnlineAiRoomEntry(page, 30000);
    if (entry === 'character-selection') {
        await waitForCharacterSelection(page, 20000);
        await waitForAiSeatCredentials(page, matchId, FOUR_PLAYER_AI_SEAT_IDS);
        await selectCharacter(page, characterId);
        await expect.poll(async () => {
            const state = await getMatchState(matchId, page);
            const hostSelected = state.core?.selectedCharacters?.['0'];
            const aiReady = FOUR_PLAYER_AI_SEAT_IDS.every((seatId) => (
                state.core?.selectedCharacters?.[seatId] !== 'unselected'
                && state.core?.readyPlayers?.[seatId] === true
            ));
            return hostSelected === characterId && aiReady;
        }, {
            timeout: 30000,
            message: waitMessage,
        }).toBe(true);
    } else {
        await waitForGameBoard(page, 30000);
        await waitForTestHarness(page, 15000);
        await expect.poll(async () => {
            const state = await getMatchState(matchId, page);
            const playerIds = Object.keys(state.core?.players ?? {});
            return {
                playerCount: playerIds.length,
                hasAiSeat1: playerIds.includes('1'),
                hasAiSeat2: playerIds.includes('2'),
                hasAiSeat3: playerIds.includes('3'),
            };
        }, {
            timeout: 30000,
            message: '等待 4 人 AI 房棋盘态就绪',
        }).toEqual({
            playerCount: 4,
            hasAiSeat1: true,
            hasAiSeat2: true,
            hasAiSeat3: true,
        });
    }
    return entry;
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

function normalizeInjectedMatchState(matchId: string, state: any) {
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
}

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

const readHarnessTurnSnapshot = async (page: Page) => page.evaluate(() => {
    const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
    return {
        activePlayerId: state?.core?.activePlayerId ?? null,
        phase: state?.sys?.phase ?? null,
        rollCount: state?.core?.rollCount ?? null,
    };
});

async function resolveOnlineAiRoomEntry(
    page: Page,
    timeout = 30000,
): Promise<'board' | 'character-selection'> {
    const entry = await expect.poll(async () => {
        const state = await readHarnessState<any>(page).catch(() => null);
        const advanceVisible = await page.locator('[data-tutorial-id="advance-phase-button"]')
            .isVisible()
            .catch(() => false);
        const rollVisible = await page.locator('[data-tutorial-id="dice-roll-button"]')
            .isVisible()
            .catch(() => false);
        const phase = typeof state?.sys?.phase === 'string'
            ? state.sys.phase
            : typeof state?.core?.phase === 'string'
                ? state.core.phase
                : null;

        if (advanceVisible || rollVisible || phase) {
            return 'board';
        }

        const characterSelectionVisible = await page.locator('[data-character-id]').first()
            .isVisible()
            .catch(() => false);
        const hostSelectedCharacter = state?.core?.selectedCharacters?.['0'] ?? null;
        if (
            characterSelectionVisible
            && (hostSelectedCharacter === null
                || hostSelectedCharacter === undefined
                || /^unselected$/i.test(String(hostSelectedCharacter)))
        ) {
            return 'character-selection';
        }

        return null;
    }, {
        timeout,
        intervals: [250, 500, 800, 1000],
        message: '等待在线真人+AI房间进入棋盘或角色选择入口',
    }).not.toBeNull();

    return entry as 'board' | 'character-selection';
}

async function installAiBatchRejectPatch(
    page: Page,
    options: {
        targetPlayerId?: string;
        rejectLimit?: number;
        minCommandCount?: number;
        resetCounters?: boolean;
    } = {},
) {
    const {
        targetPlayerId = '1',
        rejectLimit = 1,
        minCommandCount = 2,
        resetCounters = true,
    } = options;

    await page.evaluate(async ({ aiPlayerId, rejectCountLimit, minimumCommandCount, shouldResetCounters }) => {
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
            globalWindow.__DT_AI_BATCH_RETRY_PATCH__.aiPlayerId = aiPlayerId;
            globalWindow.__DT_AI_BATCH_RETRY_PATCH__.rejectLimit = rejectCountLimit;
            globalWindow.__DT_AI_BATCH_RETRY_PATCH__.minCommandCount = minimumCommandCount;
            if (shouldResetCounters) {
                globalWindow.__DT_AI_BATCH_RETRY_PATCH__.interceptedCount = 0;
                globalWindow.__DT_AI_BATCH_RETRY_PATCH__.rejectedCount = 0;
                globalWindow.__DT_AI_BATCH_RETRY_PATCH__.delegatedCount = 0;
                globalWindow.__DT_AI_BATCH_RETRY_PATCH__.lastBatchId = null;
                globalWindow.__DT_AI_BATCH_RETRY_PATCH__.lastReason = null;
                globalWindow.__DT_AI_BATCH_RETRY_PATCH__.lastCommandCount = 0;
            }
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
        shouldResetCounters: resetCounters,
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
        : Object.keys(next.core?.players ?? {});
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

const buildOnlineAiStalledMain2State = (state: any, stalledPlayerId = '1') => {
    const next = structuredClone(state);
    const fallbackTurnOrder = Array.isArray(next.sys?.turnOrder)
        ? [...next.sys.turnOrder]
        : Object.keys(next.core?.players ?? {});
    const stalledPlayerIndex = Math.max(0, fallbackTurnOrder.indexOf(stalledPlayerId));
    const hostHp = Math.max(20, next.core?.players?.['0']?.resources?.[RESOURCE_IDS.HP] ?? 0);
    const aiSeatIds = fallbackTurnOrder.filter((playerId) => playerId !== '0');

    next.core = {
        ...next.core,
        activePlayerId: stalledPlayerId,
        currentPlayerIndex: stalledPlayerIndex,
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
            ...Object.fromEntries(aiSeatIds.map((playerId) => {
                const player = next.core.players[playerId];
                const hp = Math.max(20, player?.resources?.[RESOURCE_IDS.HP] ?? 0);
                return [playerId, {
                    ...player,
                    hand: [],
                    resources: {
                        ...player?.resources,
                        [RESOURCE_IDS.HP]: hp,
                        [RESOURCE_IDS.CP]: player?.resources?.[RESOURCE_IDS.CP] ?? 0,
                    },
                }];
            })),
        },
    };

    next.sys = {
        ...next.sys,
        turnNumber: 4,
        phase: 'main2',
        turnOrder: fallbackTurnOrder,
        currentPlayerIndex: stalledPlayerIndex,
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

const advanceHostTurnToMain1 = async (
    matchId: string,
    page: Page,
    expectedPlayerId = '0',
) => {
    for (let step = 0; step < 3; step += 1) {
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
        await expect(advanceButton).toBeVisible({ timeout: 10000 });
        await expect(advanceButton).toBeEnabled({ timeout: 10000 });
        await advanceButton.click();
        await page.waitForTimeout(300);
    }

    throw new Error('已回到真人回合，但在 3 次内仍未能推进到 main1，说明链路仍可能卡住');
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
    test('Online AI setup: host 选完角色后普通 AI 应自动选角色并 ready', async ({ browser }, testInfo) => {
        test.setTimeout(150000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTOnlineAiRoom(browser, baseURL, {
            minimumActionDelayMs: 0,
        });
        if (!setup) {
            test.skip(true, 'DiceThrone AI 联机房间创建失败');
            return;
        }

        try {
            const { hostPage, matchId } = setup;
            await resolveOnlineAiRoomEntry(hostPage, 30000);
            await waitForCharacterSelection(hostPage, 20000);
            await selectCharacter(hostPage, 'tianshi');

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                const aiSelected = state.core?.selectedCharacters?.['1'] ?? null;
                return state.core?.selectedCharacters?.['0'] === 'tianshi'
                    && typeof aiSelected === 'string'
                    && aiSelected.length > 0
                    && aiSelected !== 'unselected'
                    && state.core?.readyPlayers?.['1'] === true
                    && state.core?.players?.['1']?.characterId === aiSelected;
            }, {
                timeout: 30000,
                intervals: [250, 500, 800, 1000],
                message: '等待 DiceThrone 真人选角后普通 AI 自动完成选角与 ready',
            }).toBe(true);

            const afterSetupState = await getMatchState(matchId, hostPage);
            const aiSelected = afterSetupState.core?.selectedCharacters?.['1'];
            expect(aiSelected).toBeTruthy();
            expect(aiSelected).not.toBe('unselected');
            expect(afterSetupState.core?.players?.['1']?.characterId).toBe(aiSelected);

            if (afterSetupState.core?.hostStarted === false) {
                const startButton = hostPage.locator('button').filter({ hasText: /开始游戏|Start Game|Press.*Start/i }).first();
                await expect(startButton).toBeEnabled({ timeout: 10000 });
            } else {
                await waitForGameBoard(hostPage, 30000);
                const boardState = await getMatchState(matchId, hostPage);
                expect(Object.keys(boardState.core?.players ?? {})).toContain('1');
            }
        } finally {
            await setup.hostPage.close({ runBeforeUnload: false }).catch(() => undefined);
            await Promise.race([
                setup.hostContext.close(),
                new Promise<void>((resolve) => {
                    setTimeout(resolve, 5000);
                }),
            ]).catch(() => undefined);
        }
    });

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

    test('Online match: HUD 样式合同应保留生命条渐变与下一阶段按钮实体外观', async ({ browser }, testInfo) => {
        test.setTimeout(60000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupDTOnlineMatch(browser, baseURL, { gameServerBaseURL: getGameServerBaseURL() });
        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, guestPage } = setup;

        try {
            await hostPage.setViewportSize({ width: 802, height: 393 });
            await guestPage.setViewportSize({ width: 802, height: 393 });
            await setChineseLocale(hostPage.context());
            await setChineseLocale(guestPage.context());
            await waitForCharacterSelection(hostPage, 30000);
            await waitForCharacterSelection(guestPage, 30000);

            await clearEvidenceScreenshotsForTest(testInfo);
            await saveEvidenceScreenshot(hostPage, testInfo, '01-online-character-selection-mobile-baseline');

            await selectCharacter(hostPage, 'barbarian');
            await selectCharacter(guestPage, 'paladin');
            await readyAndStartGame(hostPage, guestPage);

            await waitForGameBoard(hostPage);
            await waitForGameBoard(guestPage);
            await hostPage.waitForTimeout(1200);

            const hudStyle = await readHudStyleContract(hostPage);

            expect(hudStyle.hasHealthLabel).toBe(true);
            expect(hudStyle.hpFillFound).toBe(true);
            expect(hudStyle.advanceButtonFound).toBe(true);
            expect(hudStyle.hpBackgroundImage).toContain('gradient');
            expect(hudStyle.hpWidthPx).toBeGreaterThan(40);
            expect(hudStyle.advanceButtonBackgroundImage).toContain('gradient');
            expect(hudStyle.advanceButtonBoxShadow).not.toBe('none');
            expect(hudStyle.advanceButtonBorderColor).not.toBe('rgba(0, 0, 0, 0)');
            expect(hudStyle.advanceButtonText).toBe('下一阶段');

            await saveEvidenceScreenshot(hostPage, testInfo, '02-online-hud-style-contract');
        } finally {
            await cleanupDTMatch(setup);
        }
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

        await expect(hostPage.getByTestId('dt-top-header-1')).toContainText('46', { timeout: 10000 });

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '03-two-player-meteor-opponent-hp-synced');

        const hostState = await readHarnessState<any>(hostPage);
        const guestState = await readHarnessState<any>(guestPage);
        expect(hostState.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0).toBe(46);
        expect(guestState.core.players['1'].resources[RESOURCE_IDS.HP] ?? 0).toBe(46);

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

        const setup = await setupDTFourPlayerOnlineAiRoom(browser, baseURL);
        if (!setup) {
            test.skip(true, 'DiceThrone AI 联机房间创建失败');
            return;
        }

        try {
            const { hostPage, matchId, initialEntry } = setup;
            const roomEntry = await prepareFourPlayerOnlineAiSetup(
                hostPage,
                matchId,
                'monk',
                '等待 DiceThrone host/3 个 AI 一起完成 4 人 setup 前置条件',
                initialEntry,
            );
            if (roomEntry === 'character-selection') {
                const startButton = hostPage.locator('button').filter({ hasText: /开始游戏|Start Game|Press.*Start/i }).first();
                await expect(startButton).toBeEnabled({ timeout: 10000 });
                await startButton.click();
                await hostPage.waitForTimeout(500);
            }
            await applyOnlineMatchState(matchId, hostPage, buildOnlineAiHiddenModifyDiceState);
            await waitForPhase(hostPage, 'offensiveRoll', 30000);
            await waitForGameBoard(hostPage, 30000);
            await waitForTestHarness(hostPage, 15000);

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

    test('Online AI setup HUD seat swap: should render entry and label AI seats correctly', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTFourPlayerOnlineAiRoom(browser, baseURL);
        if (!setup) {
            test.skip(true, 'DiceThrone AI 联机房间创建失败');
            return;
        }

        try {
            const { hostPage, matchId, initialEntry } = setup;
            await prepareFourPlayerOnlineAiSetup(
                hostPage,
                matchId,
                'monk',
                '等待 DiceThrone 4 人 AI 房进入可验证的 setup HUD 换座前置条件',
                initialEntry,
            );
            await applyOnlineMatchState(matchId, hostPage, (state) => {
                const next = structuredClone(state);
                next.core = {
                    ...next.core,
                    hostStarted: false,
                    phase: 'setup',
                    seatingOrder: Array.isArray(next.core?.seatingOrder) && next.core.seatingOrder.length > 0
                        ? next.core.seatingOrder
                        : ['0', '1', '2', '3'],
                    seatControllers: {
                        ...(next.core?.seatControllers ?? {}),
                        '0': { type: 'human' },
                        '1': { type: 'local-ai' },
                        '2': { type: 'local-ai' },
                        '3': { type: 'local-ai' },
                    },
                };
                next.sys = {
                    ...next.sys,
                    phase: 'setup',
                };
                return next;
            });
            await hostPage.waitForTimeout(500);

            await expect(hostPage.locator('[data-fab-id="chat"]')).toBeVisible({ timeout: 10000 });
            await hostPage.locator('[data-fab-id="chat"]').click();
            await expect(hostPage.locator('[data-fab-id="seat-swap"]')).toBeVisible({ timeout: 10000 });

            await clearEvidenceScreenshotsForTest(testInfo);
            await saveEvidenceScreenshot(hostPage, testInfo, '30-online-ai-hud-seat-swap-entry');

            await hostPage.locator('[data-fab-id="seat-swap"]').click();
            await expect(hostPage.getByTestId('hud-seat-swap-seat-1')).toBeVisible({ timeout: 10000 });
            await expect(hostPage.getByTestId('hud-seat-swap-seat-1').getByText(/^AI$/)).toBeVisible({ timeout: 5000 });

            await saveEvidenceScreenshot(hostPage, testInfo, '31-online-ai-hud-seat-swap-before-click');

            await expect(hostPage.getByTestId('hud-seat-swap-seat-2').getByText(/^AI$/)).toBeVisible({ timeout: 5000 });
            await expect(hostPage.getByTestId('hud-seat-swap-seat-3').getByText(/^AI$/)).toBeVisible({ timeout: 5000 });

            await saveEvidenceScreenshot(hostPage, testInfo, '32-online-ai-hud-seat-swap-ai-labeled');
        } finally {
            await setup.hostContext.close();
        }
    });

    test('Online AI 首轮 batch 被拒后应自动重试并完成隐藏 multistep-choice', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTFourPlayerOnlineAiRoom(browser, baseURL);
        if (!setup) {
            test.skip(true, 'DiceThrone AI 联机房间创建失败');
            return;
        }

        try {
            const { hostPage, matchId, initialEntry } = setup;
            const roomEntry = await prepareFourPlayerOnlineAiSetup(
                hostPage,
                matchId,
                'monk',
                '等待 DiceThrone host/3 个 AI 一起完成 4 人 retry 测试前置条件',
                initialEntry,
            );
            if (roomEntry === 'character-selection') {
                const startButton = hostPage.locator('button').filter({ hasText: /开始游戏|Start Game|Press.*Start/i }).first();
                await expect(startButton).toBeEnabled({ timeout: 10000 });
                await startButton.click();
                await hostPage.waitForTimeout(500);
            }
            await installAiBatchRejectPatch(hostPage, { targetPlayerId: '1', rejectLimit: 1 });
            await applyOnlineMatchState(matchId, hostPage, buildOnlineAiHiddenModifyDiceState);
            await waitForPhase(hostPage, 'offensiveRoll', 30000);
            await waitForGameBoard(hostPage, 30000);
            await waitForTestHarness(hostPage, 15000);

            await expect.poll(async () => {
                const status = await readAiBatchRejectPatchStatus(hostPage);
                const state = await getMatchState(matchId, hostPage);
                const diceValues = (state.core?.dice ?? []).slice(0, 2).map((die: any) => die.value);
                return {
                    rejectedCount: status?.rejectedCount ?? 0,
                    delegatedCountAtLeastOne: (status?.delegatedCount ?? 0) >= 1,
                    lastCommandCount: status?.lastCommandCount ?? 0,
                    interactionKind: state.sys?.interaction?.current?.kind ?? null,
                    interactionPlayerId: state.sys?.interaction?.current?.playerId ?? null,
                    diceValues,
                    diceRaisedToHighValues: diceValues.length === 2 && diceValues.every((value: number) => value >= 5),
                };
            }, {
                timeout: 30000,
                message: '等待 AI 在 batch 被拒后自动重试并成功提交多条 MODIFY_DIE',
            }).toEqual({
                rejectedCount: 1,
                delegatedCountAtLeastOne: true,
                lastCommandCount: 3,
                interactionKind: null,
                interactionPlayerId: null,
                diceValues: expect.any(Array),
                diceRaisedToHighValues: true,
            });

            await expect.poll(async () => {
                return hostPage.evaluate(() => {
                    const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                    const diceValues = (state?.core?.dice ?? []).slice(0, 2).map((die: any) => die.value);
                    return {
                        interactionPlayerId: state?.sys?.interaction?.current?.playerId ?? null,
                        isBlocked: state?.sys?.interaction?.isBlocked ?? null,
                        diceValues,
                        diceRaisedToHighValues: diceValues.length === 2 && diceValues.every((value: number) => value >= 5),
                    };
                });
            }, {
                timeout: 10000,
                message: '等待房主过滤视角在 retry 成功后解除阻塞',
            }).toEqual({
                interactionPlayerId: null,
                isBlocked: false,
                diceValues: expect.any(Array),
                diceRaisedToHighValues: true,
            });

            await saveEvidenceScreenshot(hostPage, testInfo, '16-online-ai-hidden-multistep-after-retry');
        } finally {
            await setup.hostContext.close();
        }
    });

    test('Online AI 连续两轮 batch 被拒后仍应自动重试并完成隐藏 multistep-choice', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTFourPlayerOnlineAiRoom(browser, baseURL);
        if (!setup) {
            test.skip(true, 'DiceThrone AI 联机房间创建失败');
            return;
        }

        try {
            const { hostPage, matchId, initialEntry } = setup;
            const roomEntry = await prepareFourPlayerOnlineAiSetup(
                hostPage,
                matchId,
                'monk',
                '等待 DiceThrone host/3 个 AI 一起完成 4 人双拒绝 retry 测试前置条件',
                initialEntry,
            );
            if (roomEntry === 'character-selection') {
                const startButton = hostPage.locator('button').filter({ hasText: /开始游戏|Start Game|Press.*Start/i }).first();
                await expect(startButton).toBeEnabled({ timeout: 10000 });
                await startButton.click();
                await hostPage.waitForTimeout(500);
            }
            await installAiBatchRejectPatch(hostPage, { targetPlayerId: '1', rejectLimit: 2 });
            await applyOnlineMatchState(matchId, hostPage, buildOnlineAiHiddenModifyDiceState);
            await waitForPhase(hostPage, 'offensiveRoll', 30000);
            await waitForGameBoard(hostPage, 30000);
            await waitForTestHarness(hostPage, 15000);

            await expect.poll(async () => {
                const status = await readAiBatchRejectPatchStatus(hostPage);
                const state = await getMatchState(matchId, hostPage);
                const diceValues = (state.core?.dice ?? []).slice(0, 2).map((die: any) => die.value);
                return {
                    rejectLimit: status?.rejectLimit ?? 0,
                    rejectedCount: status?.rejectedCount ?? 0,
                    delegatedCountAtLeastOne: (status?.delegatedCount ?? 0) >= 1,
                    lastCommandCount: status?.lastCommandCount ?? 0,
                    interactionKind: state.sys?.interaction?.current?.kind ?? null,
                    interactionPlayerId: state.sys?.interaction?.current?.playerId ?? null,
                    diceValues,
                    diceRaisedToHighValues: diceValues.length === 2 && diceValues.every((value: number) => value >= 5),
                };
            }, {
                timeout: 40000,
                message: '等待 AI 在连续两轮 batch 被拒后仍成功完成第三轮 retry',
            }).toEqual({
                rejectLimit: 2,
                rejectedCount: 2,
                delegatedCountAtLeastOne: true,
                lastCommandCount: 3,
                interactionKind: null,
                interactionPlayerId: null,
                diceValues: expect.any(Array),
                diceRaisedToHighValues: true,
            });

            await expect.poll(async () => {
                return hostPage.evaluate(() => {
                    const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                    const diceValues = (state?.core?.dice ?? []).slice(0, 2).map((die: any) => die.value);
                    return {
                        interactionPlayerId: state?.sys?.interaction?.current?.playerId ?? null,
                        isBlocked: state?.sys?.interaction?.isBlocked ?? null,
                        diceValues,
                        diceRaisedToHighValues: diceValues.length === 2 && diceValues.every((value: number) => value >= 5),
                    };
                });
            }, {
                timeout: 10000,
                message: '等待房主过滤视角在第三轮 retry 成功后解除阻塞',
            }).toEqual({
                interactionPlayerId: null,
                isBlocked: false,
                diceValues: expect.any(Array),
                diceRaisedToHighValues: true,
            });

            await saveEvidenceScreenshot(hostPage, testInfo, '18-online-ai-hidden-multistep-after-third-attempt');
        } finally {
            await setup.hostContext.close();
        }
    });

    test('Online AI 真人房间：主阶段到攻击链时间线应可区分动作延迟与传输重试', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const aiSeatIds = FOUR_PLAYER_AI_SEAT_IDS;
        const primaryAiSeatId = '1';
        const setup = await setupDTFourPlayerOnlineAiRoom(browser, baseURL, {
            minimumActionDelayMs: 1000,
        });
        if (!setup) {
            test.skip(true, 'DiceThrone AI 联机房间创建失败');
            return;
        }

        const consoleTimeline: Array<{
            atMs: number;
            type: string;
            text: string;
        }> = [];
        const testStartedAt = Date.now();
        const consoleJsonPath = getEvidenceScreenshotPath(testInfo, 'online-ai-real-timeline-console', {
            filename: 'online-ai-real-timeline-console.json',
        }).replace(/\.jpg$/i, '.json');
        const summaryJsonPath = getEvidenceScreenshotPath(testInfo, 'online-ai-real-timeline-summary', {
            filename: 'online-ai-real-timeline-summary.json',
        }).replace(/\.jpg$/i, '.json');
        let wrotePrimarySummary = false;

        try {
            const { hostPage, matchId } = setup;
            hostPage.on('console', (message) => {
                const text = message.text();
                if (!/(LOCAL_AI_PERF|ONLINE_AI_PERF|ONLINE_AI_TRANSPORT|AI_RUNTIME_TRUTH)/.test(text)) {
                    return;
                }
                consoleTimeline.push({
                    atMs: Date.now() - testStartedAt,
                    type: message.type(),
                    text,
                });
            });

            const entry = await resolveOnlineAiRoomEntry(hostPage, 30000);

            if (entry === 'character-selection') {
                await waitForCharacterSelection(hostPage, 20000);
                await waitForAiSeatCredentials(hostPage, matchId, aiSeatIds);
                await selectCharacter(hostPage, 'monk');

                await expect.poll(async () => {
                    return hostPage.evaluate((seatIds) => {
                        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                        const selectedCharacters = state?.core?.selectedCharacters ?? {};
                        const readyPlayers = state?.core?.readyPlayers ?? {};
                        const seatingOrder = Array.isArray(state?.core?.seatingOrder) ? state.core.seatingOrder : [];
                        return {
                            hostSelected: selectedCharacters['0'] ?? null,
                            aiSelectedSeatIds: seatIds.filter((seatId) => {
                                const selected = selectedCharacters[seatId];
                                return selected && selected !== 'unselected';
                            }),
                            aiReadySeatIds: seatIds.filter((seatId) => readyPlayers[seatId] === true),
                            seatingOrder,
                        };
                    }, [...aiSeatIds]);
                }, {
                    timeout: 30000,
                    message: '等待 DiceThrone host/AI 一起完成在线真人房间前置条件',
                }).toEqual({
                    hostSelected: 'monk',
                    aiSelectedSeatIds: [...aiSeatIds],
                    aiReadySeatIds: [...aiSeatIds],
                    seatingOrder: ['0', '1', '2', '3'],
                });

                const startButton = hostPage.locator('button').filter({ hasText: /开始游戏|Start Game|Press.*Start/i }).first();
                await expect(startButton).toBeEnabled({ timeout: 10000 });
                await startButton.click();
                await waitForGameBoard(hostPage, 30000);
            }

            await waitForTestHarness(hostPage, 15000);
            await expect.poll(async () => {
                const snapshot = await readHarnessTurnSnapshot(hostPage);
                const state = await getMatchState(matchId, hostPage);
                return {
                    ...snapshot,
                    seatingOrder: state.core?.seatingOrder ?? null,
                };
            }, {
                timeout: 30000,
                intervals: [200, 300, 500, 800],
                message: '等待在线真人房间进入可推进的 host 主阶段',
            }).toMatchObject({
                activePlayerId: '0',
                phase: 'main1',
                seatingOrder: ['0', '1', '2', '3'],
            });

            await expect(hostPage.getByTestId('dt-top-header-1')).toBeVisible({ timeout: 10000 });
            await expect(hostPage.getByTestId('dt-top-header-2')).toBeVisible({ timeout: 10000 });
            await expect(hostPage.getByTestId('dt-top-header-3')).toBeVisible({ timeout: 10000 });

            await saveEvidenceScreenshot(hostPage, testInfo, '40-online-ai-real-timeline-host-main1');

            for (let step = 0; step < 8; step += 1) {
                const snapshot = await readHarnessTurnSnapshot(hostPage);
                if (snapshot.activePlayerId === '1') {
                    break;
                }
                const responseSkipButton = hostPage.getByRole('button', { name: /略过|Skip/i }).last();
                if (await responseSkipButton.isVisible().catch(() => false)) {
                    await responseSkipButton.click();
                    await hostPage.waitForTimeout(300);
                    continue;
                }
                const advanceButton = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
                if (!(await advanceButton.isEnabled({ timeout: 1000 }).catch(() => false))) {
                    break;
                }
                await advanceButton.click();
                await hostPage.waitForTimeout(500);
            }

            await expect.poll(async () => {
                return readHarnessTurnSnapshot(hostPage);
            }, {
                timeout: 30000,
                intervals: [200, 300, 500, 800],
                message: '等待真人回合结束并进入 AI 回合',
            }).toMatchObject({
                activePlayerId: '1',
            });

            await saveEvidenceScreenshot(hostPage, testInfo, '41-online-ai-real-timeline-ai-turn-start');

            const dismissHostResponseWindowIfVisible = async () => {
                const responseSkipButton = hostPage.getByRole('button', { name: /略过|Skip/i }).last();
                if (await responseSkipButton.isVisible().catch(() => false)) {
                    await responseSkipButton.click();
                    await hostPage.waitForTimeout(300);
                    return true;
                }
                return false;
            };

            const summarizeAiAttackChain = async () => {
                const onlineAiDebug = await hostPage.evaluate((playerId) => {
                    const api = (window as Window & {
                        __BG_ONLINE_AI_DEBUG__?: {
                            getSeatDecisionState?: (targetPlayerId: string) => unknown;
                            getSeatLatestState?: (targetPlayerId: string) => unknown;
                        };
                    }).__BG_ONLINE_AI_DEBUG__;
                    if (!api) {
                        return {
                            decisionState: null,
                            hasSeatLatestState: false,
                        };
                    }
                    return {
                        decisionState: api.getSeatDecisionState?.(playerId) ?? null,
                        hasSeatLatestState: Boolean(api.getSeatLatestState?.(playerId)),
                    };
                }, primaryAiSeatId).catch(() => ({
                    decisionState: null,
                    hasSeatLatestState: false,
                }));
                const aiTurnStartAtMs = consoleTimeline.find((entry) => (
                    entry.text.includes('[ONLINE_AI_TRANSPORT]')
                    && entry.text.includes('"stage":"state-update"')
                    && entry.text.includes('"phase":"main1"')
                    && entry.text.includes(`"currentPlayerId":"${primaryAiSeatId}"`)
                ))?.atMs ?? 0;
                const hostDiscardAtMs = consoleTimeline.find((entry) => (
                    entry.text.includes('[ONLINE_AI_TRANSPORT]')
                    && entry.text.includes('"stage":"state-update"')
                    && entry.text.includes('"phase":"discard"')
                    && entry.text.includes('"currentPlayerId":"0"')
                ))?.atMs ?? null;
                const visibleSubmittedActions = consoleTimeline.filter((entry) => (
                    entry.atMs >= aiTurnStartAtMs
                    && (entry.text.includes('[ONLINE_AI_PERF]') || entry.text.includes('[LOCAL_AI_PERF]'))
                    && entry.text.includes('"stage":"submitted"')
                    && entry.text.includes('"actionVisibility":"visible"')
                ));
                const submittedRolls = visibleSubmittedActions.filter((entry) => (
                    entry.text.includes('"actionKind":"roll-dice"')
                ));
                const submittedAbilitySelections = visibleSubmittedActions.filter((entry) => (
                    entry.text.includes('"actionKind":"select-ability"')
                ));
                const submittedVisibleActions = visibleSubmittedActions.map((entry) => {
                    const actionKindMatch = entry.text.match(/"actionKind":"([^"]+)"/);
                    return {
                        atMs: entry.atMs,
                        actionKind: actionKindMatch?.[1] ?? 'unknown',
                        text: entry.text,
                    };
                });
                const transportWarnings = consoleTimeline.filter((entry) => (
                    entry.text.includes('[ONLINE_AI_TRANSPORT]')
                    && /resync-requested|transport-error/.test(entry.text)
                ));
                const patchApplyFailedEvents = consoleTimeline.filter((entry) => (
                    entry.text.includes('[ONLINE_AI_TRANSPORT]')
                    && entry.text.includes('"stage":"patch-apply-failed"')
                    && entry.text.includes(`"playerId":"${primaryAiSeatId}"`)
                ));
                const secondaryPatchApplyFailedEvents = consoleTimeline.filter((entry) => (
                    entry.text.includes('[ONLINE_AI_TRANSPORT]')
                    && entry.text.includes('"stage":"patch-apply-failed"')
                    && !entry.text.includes(`"playerId":"${primaryAiSeatId}"`)
                ));
                const phaseSnapshot = await readHarnessTurnSnapshot(hostPage);
                const attackChainReachedDefensiveRoll = phaseSnapshot.activePlayerId === '0'
                    && phaseSnapshot.phase === 'defensiveRoll';
                const aiSeatAdvancedPastMain1 = !(
                    phaseSnapshot.activePlayerId === primaryAiSeatId
                    && phaseSnapshot.phase === 'main1'
                );
                const attackChainReached = attackChainReachedDefensiveRoll
                    || (
                        phaseSnapshot.activePlayerId === primaryAiSeatId
                        && (phaseSnapshot.phase === 'offensiveRoll' || phaseSnapshot.phase === 'targetingRoll')
                        && typeof phaseSnapshot.rollCount === 'number'
                        && phaseSnapshot.rollCount > 0
                    )
                    || (
                        phaseSnapshot.activePlayerId === primaryAiSeatId
                        && (phaseSnapshot.phase === 'main2' || phaseSnapshot.phase === 'discard')
                    )
                    || phaseSnapshot.activePlayerId !== primaryAiSeatId;
                const serverAuthorityObserved = consoleTimeline.some((entry) => (
                    entry.text.includes('[AI_RUNTIME_TRUTH]')
                    && entry.text.includes('server-online-ai-executor')
                )) || onlineAiDebug.hasSeatLatestState;
                return {
                    aiTurnStartAtMs,
                    hostDiscardAtMs,
                    handoffGapMs: hostDiscardAtMs === null ? null : aiTurnStartAtMs - hostDiscardAtMs,
                    serverAuthorityObserved,
                    onlineAiDebug,
                    submittedRollCount: submittedRolls.length,
                    submittedAbilitySelectionCount: submittedAbilitySelections.length,
                    submittedVisibleActionCount: submittedVisibleActions.length,
                    submittedVisibleActions,
                    transportWarningCount: transportWarnings.length,
                    patchApplyFailedCount: patchApplyFailedEvents.length,
                    secondaryPatchApplyFailedCount: secondaryPatchApplyFailedEvents.length,
                    activePlayerId: phaseSnapshot.activePlayerId,
                    phase: phaseSnapshot.phase,
                    rollCount: phaseSnapshot.rollCount,
                    aiSeatAdvancedPastMain1,
                    attackChainReached,
                    attackChainReachedDefensiveRoll,
                };
            };

            const isAttackChainReady = (summary: Awaited<ReturnType<typeof summarizeAiAttackChain>>) => {
                return summary.patchApplyFailedCount === 0
                    && summary.serverAuthorityObserved
                    && summary.aiSeatAdvancedPastMain1
                    && summary.attackChainReached;
            };

            const attackChainDeadline = Date.now() + 90000;
            let attackChainSummary = await summarizeAiAttackChain();
            while (!isAttackChainReady(attackChainSummary) && Date.now() < attackChainDeadline) {
                const dismissedResponse = await dismissHostResponseWindowIfVisible();
                if (!dismissedResponse) {
                    await hostPage.waitForTimeout(250);
                }
                attackChainSummary = await summarizeAiAttackChain();
            }

            expect(attackChainSummary.patchApplyFailedCount).toBe(0);
            expect(attackChainSummary.serverAuthorityObserved).toBe(true);
            expect(attackChainSummary.aiSeatAdvancedPastMain1).toBe(true);
            expect(isAttackChainReady(attackChainSummary)).toBe(true);
            expect(attackChainSummary.attackChainReached).toBe(true);

            await saveEvidenceScreenshot(hostPage, testInfo, '42-online-ai-real-timeline-after-attack-chain');

            const rollSubmittedTimeline = attackChainSummary.submittedVisibleActions.filter((entry) => (
                entry.actionKind === 'roll-dice'
            ));
            const visibleActionGaps = attackChainSummary.submittedVisibleActions
                .slice(1)
                .map((entry, index) => ({
                    fromActionKind: attackChainSummary.submittedVisibleActions[index].actionKind,
                    toActionKind: entry.actionKind,
                    gapMs: entry.atMs - attackChainSummary.submittedVisibleActions[index].atMs,
                }));
            const visibleSubmittedPerf = attackChainSummary.submittedVisibleActions
                .map((entry) => {
                    const payloadStart = entry.text.indexOf('{');
                    const payloadEnd = entry.text.lastIndexOf('}');
                    if (payloadStart < 0 || payloadEnd <= payloadStart) {
                        return null;
                    }
                    try {
                        const payload = JSON.parse(entry.text.slice(payloadStart, payloadEnd + 1)) as {
                            actionKind?: string;
                            minimumDelayMs?: number;
                            visibleStepElapsedMs?: number | null;
                            remainingDelayMs?: number;
                            lastVisibleActionAt?: number | null;
                        };
                        return {
                            actionKind: payload.actionKind ?? entry.actionKind,
                            minimumDelayMs: typeof payload.minimumDelayMs === 'number' ? payload.minimumDelayMs : 0,
                            visibleStepElapsedMs: typeof payload.visibleStepElapsedMs === 'number'
                                ? payload.visibleStepElapsedMs
                                : null,
                            remainingDelayMs: typeof payload.remainingDelayMs === 'number' ? payload.remainingDelayMs : 0,
                            lastVisibleActionAt: typeof payload.lastVisibleActionAt === 'number'
                                ? payload.lastVisibleActionAt
                                : null,
                        };
                    } catch {
                        return null;
                    }
                })
                .filter((entry): entry is {
                    actionKind: string;
                    minimumDelayMs: number;
                    visibleStepElapsedMs: number | null;
                    remainingDelayMs: number;
                    lastVisibleActionAt: number | null;
                } => Boolean(entry));
            const visibleDelayViolations = visibleSubmittedPerf
                .filter((entry) => entry.lastVisibleActionAt !== null && entry.minimumDelayMs > 0)
                .map((entry) => ({
                    ...entry,
                    effectiveDelayBudgetMs: Math.max(0, entry.visibleStepElapsedMs ?? 0) + entry.remainingDelayMs,
                }))
                .filter((entry) => entry.effectiveDelayBudgetMs < Math.max(0, entry.minimumDelayMs - 100));
            const derivedSummary = {
                matchId,
                minimumActionDelayMs: 1000,
                aiTurnStartAtMs: attackChainSummary.aiTurnStartAtMs,
                handoffGapMs: attackChainSummary.handoffGapMs,
                serverAuthorityObserved: attackChainSummary.serverAuthorityObserved,
                onlineAiDebug: attackChainSummary.onlineAiDebug,
                submittedRollCount: rollSubmittedTimeline.length,
                submittedAbilitySelectionCount: attackChainSummary.submittedAbilitySelectionCount,
                submittedVisibleActionCount: attackChainSummary.submittedVisibleActionCount,
                activePlayerId: attackChainSummary.activePlayerId,
                phase: attackChainSummary.phase,
                rollCount: attackChainSummary.rollCount,
                aiSeatAdvancedPastMain1: attackChainSummary.aiSeatAdvancedPastMain1,
                attackChainReached: attackChainSummary.attackChainReached,
                attackChainReachedDefensiveRoll: attackChainSummary.attackChainReachedDefensiveRoll,
                patchApplyFailedCount: attackChainSummary.patchApplyFailedCount,
                secondaryPatchApplyFailedCount: attackChainSummary.secondaryPatchApplyFailedCount,
                firstToSecondRollGapMs: rollSubmittedTimeline.length >= 2
                    ? rollSubmittedTimeline[1].atMs - rollSubmittedTimeline[0].atMs
                    : null,
                visibleActionGapCount: visibleActionGaps.length,
                visibleActionGaps,
                visibleSubmittedPerf,
                visibleDelayViolations,
                submittedVisibleActions: attackChainSummary.submittedVisibleActions,
                transportEvents: consoleTimeline.filter((entry) => entry.text.includes('[ONLINE_AI_TRANSPORT]')),
                perfEvents: consoleTimeline.filter((entry) => entry.text.includes('[ONLINE_AI_PERF]') || entry.text.includes('[LOCAL_AI_PERF]')),
            };

            await mkdir(dirname(consoleJsonPath), { recursive: true });
            await writeFile(consoleJsonPath, JSON.stringify(consoleTimeline, null, 2), 'utf8');
            await writeFile(summaryJsonPath, JSON.stringify(derivedSummary, null, 2), 'utf8');
            wrotePrimarySummary = true;

            expect(attackChainSummary.attackChainReached).toBe(true);
            expect(visibleDelayViolations).toEqual([]);
        } finally {
            const rollSubmittedTimeline = consoleTimeline.filter((entry) => (
                (entry.text.includes('[ONLINE_AI_PERF]') || entry.text.includes('[LOCAL_AI_PERF]'))
                && entry.text.includes('"stage":"submitted"')
                && entry.text.includes('"actionKind":"roll-dice"')
            ));
            const transportEvents = consoleTimeline.filter((entry) => entry.text.includes('[ONLINE_AI_TRANSPORT]'));
            const perfEvents = consoleTimeline.filter((entry) => entry.text.includes('[ONLINE_AI_PERF]') || entry.text.includes('[LOCAL_AI_PERF]'));
            const patchApplyFailedCount = transportEvents.filter((entry) => (
                entry.text.includes('"stage":"patch-apply-failed"')
                && entry.text.includes(`"playerId":"${primaryAiSeatId}"`)
            )).length;
            const secondaryPatchApplyFailedCount = transportEvents.filter((entry) => (
                entry.text.includes('"stage":"patch-apply-failed"')
                && !entry.text.includes(`"playerId":"${primaryAiSeatId}"`)
            )).length;
            const aiTurnStartAtMs = transportEvents.find((entry) => (
                entry.text.includes('"stage":"state-update"')
                && entry.text.includes('"phase":"main1"')
                && entry.text.includes(`"currentPlayerId":"${primaryAiSeatId}"`)
            ))?.atMs ?? null;
            const hostDiscardAtMs = transportEvents.find((entry) => (
                entry.text.includes('"stage":"state-update"')
                && entry.text.includes('"phase":"discard"')
                && entry.text.includes('"currentPlayerId":"0"')
            ))?.atMs ?? null;
            const submittedVisibleActions = perfEvents
                .filter((entry) => (
                    entry.text.includes('"stage":"submitted"')
                    && entry.text.includes('"actionVisibility":"visible"')
                    && (aiTurnStartAtMs === null || entry.atMs >= aiTurnStartAtMs)
                ))
                .map((entry) => {
                    const actionKindMatch = entry.text.match(/"actionKind":"([^"]+)"/);
                    return {
                        atMs: entry.atMs,
                        actionKind: actionKindMatch?.[1] ?? 'unknown',
                        text: entry.text,
                    };
                });
            const submittedAbilitySelectionCount = submittedVisibleActions.filter((entry) => entry.actionKind === 'select-ability').length;
            const finalSnapshot = await readHarnessTurnSnapshot(setup.hostPage).catch(() => null);
            const finalServerAuthorityObserved = consoleTimeline.some((entry) => (
                entry.text.includes('[AI_RUNTIME_TRUTH]')
                && entry.text.includes('server-online-ai-executor')
            ));
            const finalSummary = {
                matchId: setup.matchId,
                minimumActionDelayMs: 1000,
                aiTurnStartAtMs,
                handoffGapMs: aiTurnStartAtMs !== null && hostDiscardAtMs !== null
                    ? aiTurnStartAtMs - hostDiscardAtMs
                    : null,
                submittedRollCount: rollSubmittedTimeline.length,
                submittedAbilitySelectionCount,
                submittedVisibleActionCount: submittedVisibleActions.length,
                firstToSecondRollGapMs: rollSubmittedTimeline.length >= 2
                    ? rollSubmittedTimeline[1].atMs - rollSubmittedTimeline[0].atMs
                    : null,
                serverAuthorityObserved: finalServerAuthorityObserved,
                attackChainReachedDefensiveRoll: finalSnapshot?.activePlayerId === '0' && finalSnapshot?.phase === 'defensiveRoll',
                patchApplyFailedCount,
                secondaryPatchApplyFailedCount,
                transportEventCount: transportEvents.length,
                perfEventCount: perfEvents.length,
                finalSnapshot,
                submittedVisibleActions,
                transportEvents,
                perfEvents,
            };
            await mkdir(dirname(consoleJsonPath), { recursive: true });
            await writeFile(consoleJsonPath, JSON.stringify(consoleTimeline, null, 2), 'utf8');
            if (!wrotePrimarySummary) {
                await writeFile(summaryJsonPath, JSON.stringify(finalSummary, null, 2), 'utf8');
            }
            await setup.hostContext.close();
        }
    });

    test('Online AI 在 DiceThrone main2 阶段持续卡死时，服务端 watchdog 应自动多步收口到我方回合且不再弹失败提示', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupDTFourPlayerOnlineAiRoom(browser, baseURL);
        if (!setup) {
            test.skip(true, 'DiceThrone AI 联机房间创建失败');
            return;
        }

        try {
            const { hostPage, matchId, initialEntry } = setup;
            const roomEntry = await prepareFourPlayerOnlineAiSetup(
                hostPage,
                matchId,
                'monk',
                '等待 DiceThrone host/3 个 AI 一起完成 4 人 watchdog 测试前置条件',
                initialEntry,
            );
            if (roomEntry === 'character-selection') {
                const startButton = hostPage.locator('button').filter({ hasText: /开始游戏|Start Game|Press.*Start/i }).first();
                await expect(startButton).toBeEnabled({ timeout: 10000 });
                await startButton.click();
                await hostPage.waitForTimeout(500);
            }
            await clearEvidenceScreenshotsForTest(testInfo);

            for (const [index, stalledPlayerId] of FOUR_PLAYER_AI_SEAT_IDS.entries()) {
                await installAiBatchRejectPatch(hostPage, {
                    targetPlayerId: stalledPlayerId,
                    rejectLimit: 9999,
                    minCommandCount: 1,
                    resetCounters: true,
                });
                await applyOnlineMatchState(matchId, hostPage, (state) => (
                    buildOnlineAiStalledMain2State(state, stalledPlayerId)
                ));
                await waitForPhase(hostPage, 'main2', 30000);
                await waitForGameBoard(hostPage, 30000);
                await waitForTestHarness(hostPage, 15000);

                await expect.poll(async () => {
                    const status = await readAiBatchRejectPatchStatus(hostPage);
                    const state = await getMatchState(matchId, hostPage);
                    return (
                        (status?.rejectedCount ?? 0) >= 1
                        && state.sys?.phase === 'main2'
                        && state.core?.activePlayerId === stalledPlayerId
                        && Array.isArray(state.core?.players?.[stalledPlayerId]?.hand)
                        && state.core.players[stalledPlayerId].hand.length === 0
                    );
                }, {
                    timeout: 5000,
                    message: `等待 AI seat ${stalledPlayerId} main2 卡死场景至少出现一次本地 batch 拒绝`,
                }).toBe(true);

                if (index === 0) {
                    await saveEvidenceScreenshot(hostPage, testInfo, '19-online-ai-main2-stalled-before-watchdog');
                }

                await expect.poll(async () => {
                    const status = await readAiBatchRejectPatchStatus(hostPage);
                    const state = await getMatchState(matchId, hostPage);
                    const failureToastVisible = await hostPage.evaluate(() => {
                        return Array.from(document.querySelectorAll('*')).some((node) => {
                            const text = node.textContent?.trim() ?? '';
                            return text.includes('强制结束 AI 回合未成功')
                                || text.includes('AI 强制结束失败（');
                        });
                    });
                    return {
                        rejectedCount: status?.rejectedCount ?? 0,
                        phase: state.sys?.phase ?? null,
                        activePlayerId: state.core?.activePlayerId ?? null,
                        hasGameOver: Boolean(state.sys?.gameover),
                        failureToastVisible,
                    };
                }, {
                    timeout: 40000,
                    message: `等待服务端 watchdog 收口被卡住的 AI seat ${stalledPlayerId}`,
                }).toMatchObject({
                    rejectedCount: expect.any(Number),
                    activePlayerId: stalledPlayerId === '3' ? '0' : expect.not.stringMatching(`^${stalledPlayerId}$`),
                    hasGameOver: false,
                    failureToastVisible: false,
                });
            }

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                const phase = state.sys?.phase ?? null;
                return ['upkeep', 'income', 'main1'].includes(String(phase));
            }, {
                timeout: 5000,
                message: 'watchdog 收口后应进入真人回合的 upkeep/income/main1',
            }).toBe(true);

            await advanceHostTurnToMain1(matchId, hostPage, '0');

            await expect(hostPage.locator('[data-tutorial-id="dice-roll-button"]')).toBeVisible({ timeout: 10000 });
            await saveEvidenceScreenshot(hostPage, testInfo, '20-online-ai-main2-stalled-after-watchdog');
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
        await waitForHarnessPages(players.map((player) => player.page));

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
        const defenderCaptainPage = players[3].page;

        await selectCharacter(players[0].page, 'monk');
        await selectCharacter(players[1].page, 'barbarian');
        await selectCharacter(players[2].page, 'pyromancer');
        await selectCharacter(players[3].page, 'paladin');
        await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));

        await waitForGameBoard(hostPage);
        await waitForHarnessPages(players.map((player) => player.page));

        await applyOnlineMatchState(matchId, hostPage, (state) => buildTargetingRollState(state, 2));
        await waitForPhase(hostPage, 'targetingRoll');
        await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');
        await waitForPhase(hostPage, 'defensiveRoll');
        await waitForPendingDefender(hostPage, '3');

        await applyOnlineMatchState(matchId, hostPage, (state) => buildTargetingRollState(state, 4));
        await waitForPhase(hostPage, 'targetingRoll');
        await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');
        await waitForPhase(hostPage, 'defensiveRoll');
        await waitForPendingDefender(hostPage, '1');

        await applyOnlineMatchState(matchId, hostPage, (state) => buildTargetingRollState(state, 5));
        await waitForPhase(hostPage, 'targetingRoll');
        await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');
        await defenderCaptainPage.waitForFunction(() => {
            return (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current?.playerId === '3';
        }, { timeout: 10000 });
        await expect(defenderCaptainPage.getByTestId('dt-target-choice-panel')).toBeVisible({ timeout: 10000 });
        await expect(defenderCaptainPage.locator('[data-testid^="dt-target-option-"]')).toHaveCount(2, { timeout: 10000 });
        await expect(defenderCaptainPage.getByTestId('dt-target-option-1')).toBeVisible({ timeout: 10000 });
        await expect(defenderCaptainPage.getByTestId('dt-target-option-3')).toBeVisible({ timeout: 10000 });
        await expect(defenderCaptainPage.getByTestId('dt-target-option-2')).toHaveCount(0);
        await defenderCaptainPage.getByTestId('dt-target-option-1').click();
        await defenderCaptainPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.sys?.phase === 'defensiveRoll' && state?.core?.pendingAttack?.defenderId === '1';
        }, { timeout: 10000 });
        await expect(defenderCaptainPage.getByTestId('dt-target-choice-panel')).toBeHidden({ timeout: 10000 });

        await applyOnlineMatchState(matchId, hostPage, (state) => buildTargetingRollState(state, 6));
        await waitForPhase(hostPage, 'targetingRoll');
        await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');
        await hostPage.waitForFunction(() => {
            return (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current?.playerId === '0';
        }, { timeout: 10000 });
        await expect(hostPage.getByTestId('dt-target-choice-panel')).toBeVisible({ timeout: 10000 });
        await expect(hostPage.locator('[data-testid^="dt-target-option-"]')).toHaveCount(2, { timeout: 10000 });
        await expect(hostPage.getByTestId('dt-target-option-1')).toHaveAttribute('data-team-tone', 'enemy');
        await expect(hostPage.getByTestId('dt-target-option-3')).toHaveAttribute('data-team-tone', 'enemy');

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '04-four-player-target-choice-panel-host');

        await hostPage.getByTestId('dt-target-option-1').click();
        await hostPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.sys?.phase === 'defensiveRoll' && state?.core?.pendingAttack?.defenderId === '1';
        }, { timeout: 10000 });
        await expect(hostPage.getByTestId('dt-target-choice-panel')).toBeHidden({ timeout: 10000 });

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

    test('Online 4-player The Law variant: upgraded Deadeye only offers enemies in 2v2 and resolves on both', async ({ browser }, testInfo) => {
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
                && targetPlayerIds.length === 2
                && targetPlayerIds.includes('1')
                && targetPlayerIds.includes('3')
                && !targetPlayerIds.includes('2')
                && state?.core?.players?.['0']?.upgradeCardByAbilityId?.deadeye?.cardId === 'upgrade-deadeye-2'
                && (state?.core?.players?.['0']?.tokens?.evasive ?? 0) === 1;
        }, undefined, { timeout: 10000, polling: 200 });

        await expect(enemyOne).toHaveAttribute('data-team-tone', 'enemy');
        await expect(enemyTwo).toHaveAttribute('data-team-tone', 'enemy');
        await expect(allyTarget).toHaveCount(0);
        await expect(confirmButton).toBeDisabled();

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '10-four-player-the-law-enemy-only-selection');

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

        await saveEvidenceScreenshot(hostPage, testInfo, '11-four-player-the-law-resolved-on-enemies');

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

    test('Online 4-player Wanted: real hand play only offers enemies in 2v2 and grants Bounty to selected enemy', async ({ browser }, testInfo) => {
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
                targetPlayerIds: current?.targetPlayerIds ?? [],
            };
        }), { timeout: 15000, intervals: [200, 400, 800] }).toEqual({
            sourceCardId: 'card-wanted',
            resolveCustomActionId: 'gunslinger-card-wanted-resolve',
            targetPlayerIds: ['1', '3'],
        });

        await expect(enemyOne).toHaveAttribute('data-team-tone', 'enemy');
        await expect(enemyTwo).toHaveAttribute('data-team-tone', 'enemy');
        await expect(allyTarget).toHaveCount(0);
        await expect(confirmButton).toBeDisabled();

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '12-four-player-wanted-enemy-only-selection');

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

        await saveEvidenceScreenshot(hostPage, testInfo, '13-four-player-wanted-resolved-on-selected-enemy');
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

        const enemyOne = hostPage.getByTestId('dt-target-option-1');
        const allyTarget = hostPage.getByTestId('dt-target-option-2');
        const enemyTwo = hostPage.getByTestId('dt-target-option-3');

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

        await expect(hostPage.getByTestId('dt-target-choice-panel')).toBeVisible();
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

    test('Online 4-player High Noon: real hand play only offers enemies in 2v2 and resolves the rolled branch on selected enemy', async ({ browser }, testInfo) => {
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
        const enemyOne = hostPage.getByTestId('dt-player-target-1');
        const allyTarget = hostPage.getByTestId('dt-player-target-2');
        const enemyTwo = hostPage.getByTestId('dt-player-target-3');

        const beforeState = await readHarnessState<any>(hostPage);
        const enemyHpBefore = beforeState.core.players['3'].resources[RESOURCE_IDS.HP] ?? 0;

        await expect(highNoonCard).toBeVisible({ timeout: 5000 });
        await highNoonCard.click({ force: true });

        await expect.poll(async () => hostPage.evaluate(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const current = state?.sys?.interaction?.current?.data;
            return {
                sourceCardId: current?.sourceCardId ?? null,
                resolveCustomActionId: current?.resolveCustomActionId ?? null,
                targetPlayerIds: current?.targetPlayerIds ?? [],
                hand: state?.core?.players?.['0']?.hand?.map((card: any) => card.id) ?? [],
            };
        }), { timeout: 15000, intervals: [200, 400, 800] }).toEqual({
            sourceCardId: 'card-high-noon',
            resolveCustomActionId: 'gunslinger-card-high-noon-resolve',
            targetPlayerIds: ['1', '3'],
            hand: [],
        });

        await expect(enemyOne).toHaveAttribute('data-team-tone', 'enemy');
        await expect(enemyTwo).toHaveAttribute('data-team-tone', 'enemy');
        await expect(allyTarget).toHaveCount(0);
        await expect(confirmButton).toBeDisabled();

        await clearEvidenceScreenshotsForTest(testInfo);
        await saveEvidenceScreenshot(hostPage, testInfo, '16-four-player-high-noon-enemy-only-selection');

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

        await saveEvidenceScreenshot(hostPage, testInfo, '17-four-player-high-noon-resolved-on-selected-enemy');
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
        await hostPage.getByTestId('dt-target-option-1').click();
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
