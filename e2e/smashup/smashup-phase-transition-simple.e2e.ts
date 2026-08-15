/**
 * 大杀四方 - 阶段切换与行动卡特写回归
 */

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';
import { test, expect } from '../framework';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { selectFaction, waitForSmashUpUI } from '../helpers/smashup';
import { setupSmashUpMatchSkipSetup } from '../helpers/smashup-skip-setup';
import {
    ensureGameServerAvailable,
    getGameServerBaseURL,
    initContext,
    seedMatchCredentials,
    waitForMatchAvailable,
} from '../helpers/common';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { SMASHUP_FACTION_IDS } from '../../src/games/smashup/domain/ids';

async function saveEvidenceScreenshot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
    const path = getEvidenceScreenshotPath(testInfo, name);
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: true });
}

async function expectActionFxAutoDismisses(page: Page, defId: string): Promise<void> {
    const fxCard = page.getByTestId('smashup-action-fx-card');
    const spotlightQueue = page.getByTestId('card-spotlight-queue');

    await expect(fxCard).toBeVisible({ timeout: 8000 });
    await expect(fxCard).toHaveAttribute('data-card-def-id', defId);
    await expect(spotlightQueue).toHaveCount(0);

    await expect(fxCard, '行动卡展示必须是瞬时 FX，不能升级成手动关闭特写').toBeHidden({ timeout: 3000 });
    await expect(spotlightQueue).toHaveCount(0);
}

async function applyOnlineMatchState(
    matchId: string,
    page: Page,
    updater: (state: any) => any,
): Promise<void> {
    const currentState = await getMatchState(matchId, page);
    const nextState = updater(currentState);
    await injectMatchState(matchId, nextState, page);
    await page.waitForTimeout(800);
}

async function setupSmashUpOnlineAiRoom(
    browser: Browser,
    baseURL: string | undefined,
    options?: {
        numPlayers?: number;
        seatControllers?: Record<string, unknown>;
        beforeEnterMatch?: (args: { hostPage: Page; matchId: string }) => Promise<void> | void;
    },
): Promise<{
    hostPage: Page;
    hostContext: BrowserContext;
    matchId: string;
} | null> {
    const hostContext = await browser.newContext({ baseURL });
    await initContext(hostContext, { storageKey: '__su_storage_reset_ai', skipImageGate: true });
    const hostPage = await hostContext.newPage();

    await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
    await hostPage.waitForSelector('[data-game-id]', { timeout: 15000 }).catch(() => {});

    if (!(await ensureGameServerAvailable(hostPage))) {
        await hostContext.close();
        return null;
    }

    const guestId = `su_ai_e2e_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    await hostPage.addInitScript(
        (id) => {
            localStorage.setItem('guest_id', id);
            sessionStorage.setItem('guest_id', id);
            document.cookie = `bg_guest_id=${encodeURIComponent(id)}; path=/; SameSite=Lax`;
        },
        guestId,
    );

    const base = getGameServerBaseURL();
    const createResponse = await hostPage.request.post(`${base}/games/smashup/create`, {
        data: {
            numPlayers: options?.numPlayers ?? 2,
            setupData: {
                guestId,
                ownerKey: `guest:${guestId}`,
                ownerType: 'guest',
                enableAi: true,
                seatControllers: options?.seatControllers ?? {
                    '1': {
                        type: 'local-ai',
                        minimumActionDelayMs: 2000,
                    },
                },
            },
        },
    });
    if (!createResponse.ok()) {
        await hostContext.close();
        return null;
    }

    const createData = (await createResponse.json().catch(() => null)) as { matchID?: string } | null;
    const matchId = createData?.matchID;
    if (!matchId) {
        await hostContext.close();
        return null;
    }

    const claimResponse = await hostPage.request.post(`${base}/games/smashup/${matchId}/claim-seat`, {
        data: { playerID: '0', playerName: 'Host-SU-AI-E2E', guestId },
    });
    if (!claimResponse.ok()) {
        await hostContext.close();
        return null;
    }

    const claimData = (await claimResponse.json().catch(() => null)) as { playerCredentials?: string } | null;
    const credentials = claimData?.playerCredentials;
    if (!credentials) {
        await hostContext.close();
        return null;
    }

    await seedMatchCredentials(hostPage, 'smashup', matchId, '0', credentials);

    if (!(await waitForMatchAvailable(hostPage, 'smashup', matchId, 20000))) {
        await hostContext.close();
        return null;
    }

    await options?.beforeEnterMatch?.({ hostPage, matchId });
    await hostPage.goto(`/play/smashup/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
    return { hostPage, hostContext, matchId };
}

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
        message: `等待 AI seat ${playerId} 凭据超时`,
    }).not.toBeNull();

    await page.waitForTimeout(1200);
}

async function installSmashUpAiChoiceRejectPatch(
    page: Page,
    options: {
        targetPlayerId?: string;
        allowBatchKinds?: Array<'force-skip' | 'force-end-turn'>;
    } = {},
): Promise<void> {
    const {
        targetPlayerId = '1',
        allowBatchKinds = ['force-skip'],
    } = options;

    await page.evaluate(async ({ aiPlayerId, allowedFallbackKinds }) => {
        const globalWindow = window as Window & {
            __SU_AI_FORCE_SKIP_PATCH__?: {
                installed: boolean;
                aiPlayerId: string;
                rejectedCount: number;
                delegatedCount: number;
                lastBatchId: string | null;
                lastReason: string | null;
                forceSkipDelegated: boolean;
                forceEndTurnDelegated: boolean;
                latestInteractionKind: string | null;
                latestInteractionSourceId: string | null;
                latestInteractionPlayerId: string | null;
            };
        };
        if (globalWindow.__SU_AI_FORCE_SKIP_PATCH__?.installed) {
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
            sendCommand?: (
                this: unknown,
                commandType: string,
                payload: unknown,
            ) => void;
            updateLatestState?: (
                this: unknown,
                state: unknown,
            ) => void;
        } | undefined;
        if (!proto?.sendBatch || !proto.sendCommand) {
            throw new Error('GameTransportClient transport hooks not available');
        }

        const originalSendBatch = proto.sendBatch;
        const originalSendCommand = proto.sendCommand;
        const originalUpdateLatestState = proto.updateLatestState;
        globalWindow.__SU_AI_FORCE_SKIP_PATCH__ = {
            installed: true,
            aiPlayerId,
            rejectedCount: 0,
            delegatedCount: 0,
            lastBatchId: null,
            lastReason: null,
            forceSkipDelegated: false,
            forceEndTurnDelegated: false,
            latestInteractionKind: null,
            latestInteractionSourceId: null,
            latestInteractionPlayerId: null,
        };

        if (originalUpdateLatestState) {
            proto.updateLatestState = function patchedUpdateLatestState(this: unknown, state: unknown) {
                const tracker = globalWindow.__SU_AI_FORCE_SKIP_PATCH__;
                const config = (this as { config?: { playerID?: string | null } }).config;
                if (
                    tracker
                    && config?.playerID === tracker.aiPlayerId
                    && state
                    && typeof state === 'object'
                ) {
                    const interaction = (state as {
                        sys?: {
                            interaction?: {
                                current?: {
                                    kind?: string;
                                    playerId?: string;
                                    data?: { sourceId?: string };
                                };
                            };
                        };
                    }).sys?.interaction?.current;
                    tracker.latestInteractionKind = interaction?.kind ?? null;
                    tracker.latestInteractionSourceId = interaction?.data?.sourceId ?? null;
                    tracker.latestInteractionPlayerId = interaction?.playerId ?? null;
                }
                return originalUpdateLatestState.call(this, state);
            };
        }

        proto.sendBatch = function patchedSendBatch(
            this: unknown,
            batchId: string,
            commands: Array<{ type: string; payload: unknown }>,
            onConfirmed?: (state: unknown) => void,
            onRejected?: (reason: string) => void,
        ) {
            const tracker = globalWindow.__SU_AI_FORCE_SKIP_PATCH__;
            const config = (this as { config?: { playerID?: string | null } }).config;
            const playerId = config?.playerID ?? null;
            const firstCommand = commands[0] ?? null;
            const firstOptionId = firstCommand?.payload
                && typeof firstCommand.payload === 'object'
                && 'optionId' in (firstCommand.payload as Record<string, unknown>)
                ? ((firstCommand.payload as { optionId?: unknown }).optionId ?? null)
                : null;
            const isInteractionResponse = firstCommand?.type === 'SYS_INTERACTION_RESPOND';
            const fallbackKind = batchId.includes('force-end-turn')
                ? 'force-end-turn'
                : (
                    isInteractionResponse && firstOptionId === 'skip'
                        ? 'force-skip'
                        : null
                );
            const isAllowedFallback = fallbackKind !== null && allowedFallbackKinds.includes(fallbackKind);

            if (
                tracker
                && playerId === tracker.aiPlayerId
                && isInteractionResponse
                && !isAllowedFallback
            ) {
                tracker.rejectedCount += 1;
                tracker.lastBatchId = `${batchId}:${String(firstOptionId ?? 'unknown')}`;
                tracker.lastReason = 'command_failed';
                onRejected?.('command_failed');
                return;
            }

            if (
                tracker
                && playerId === tracker.aiPlayerId
                && isAllowedFallback
            ) {
                tracker.delegatedCount += 1;
                tracker.lastBatchId = batchId;
                tracker.forceSkipDelegated = fallbackKind === 'force-skip';
                tracker.forceEndTurnDelegated = fallbackKind === 'force-end-turn';
            }

            return originalSendBatch.call(this, batchId, commands, onConfirmed, onRejected);
        };

        proto.sendCommand = function patchedSendCommand(
            this: unknown,
            commandType: string,
            payload: unknown,
        ) {
            const tracker = globalWindow.__SU_AI_FORCE_SKIP_PATCH__;
            const config = (this as { config?: { playerID?: string | null } }).config;
            const playerId = config?.playerID ?? null;
            const optionId = payload
                && typeof payload === 'object'
                && 'optionId' in (payload as Record<string, unknown>)
                ? ((payload as { optionId?: unknown }).optionId ?? null)
                : null;
            const isInteractionResponse = commandType === 'SYS_INTERACTION_RESPOND';
            const isAllowedForceSkip = isInteractionResponse
                && optionId === 'skip'
                && allowedFallbackKinds.includes('force-skip');
            const isForceEndTurnCommand = allowedFallbackKinds.includes('force-end-turn')
                && ['ADVANCE_PHASE', 'END_TURN', 'FORCE_END_TURN'].includes(commandType);

            if (
                tracker
                && playerId === tracker.aiPlayerId
                && isInteractionResponse
                && !isAllowedForceSkip
            ) {
                tracker.rejectedCount += 1;
                tracker.lastBatchId = `${commandType}:${String(optionId ?? 'unknown')}`;
                tracker.lastReason = 'command_failed';
                return;
            }

            if (
                tracker
                && playerId === tracker.aiPlayerId
                && (isAllowedForceSkip || isForceEndTurnCommand)
            ) {
                tracker.delegatedCount += 1;
                tracker.lastBatchId = isInteractionResponse
                    ? `${commandType}:${String(optionId ?? 'unknown')}`
                    : commandType;
                tracker.forceSkipDelegated = tracker.forceSkipDelegated || isAllowedForceSkip;
                tracker.forceEndTurnDelegated = tracker.forceEndTurnDelegated || isForceEndTurnCommand;
            }

            return originalSendCommand.call(this, commandType, payload);
        };
    }, {
        aiPlayerId: targetPlayerId,
        allowedFallbackKinds: allowBatchKinds,
    });
}

async function readSmashUpAiChoiceRejectPatchStatus(page: Page): Promise<{
    installed: boolean;
    aiPlayerId: string;
    rejectedCount: number;
    delegatedCount: number;
    lastBatchId: string | null;
    lastReason: string | null;
    forceSkipDelegated: boolean;
    forceEndTurnDelegated: boolean;
    latestInteractionKind: string | null;
    latestInteractionSourceId: string | null;
    latestInteractionPlayerId: string | null;
} | null> {
    return page.evaluate(() => {
        return (window as Window & {
            __SU_AI_FORCE_SKIP_PATCH__?: {
                installed: boolean;
                aiPlayerId: string;
                rejectedCount: number;
                delegatedCount: number;
                lastBatchId: string | null;
                lastReason: string | null;
                forceSkipDelegated: boolean;
                forceEndTurnDelegated: boolean;
                latestInteractionKind: string | null;
                latestInteractionSourceId: string | null;
                latestInteractionPlayerId: string | null;
            };
        }).__SU_AI_FORCE_SKIP_PATCH__ ?? null;
    });
}

async function installSmashUpAiResponsePassPatch(
    page: Page,
    targetPlayerIds: string[],
): Promise<void> {
    await page.evaluate(async ({ ids }) => {
        const globalWindow = window as Window & {
            __SU_AI_FORCE_RESPONSE_PASS_PATCH__?: {
                installed: boolean;
                targetPlayerIds: string[];
                rewrittenBatches: number;
            };
        };
        if (globalWindow.__SU_AI_FORCE_RESPONSE_PASS_PATCH__?.installed) {
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
        globalWindow.__SU_AI_FORCE_RESPONSE_PASS_PATCH__ = {
            installed: true,
            targetPlayerIds: ids,
            rewrittenBatches: 0,
        };

        proto.sendBatch = function patchedSendBatch(
            this: unknown,
            batchId: string,
            commands: Array<{ type: string; payload: unknown }>,
            onConfirmed?: (state: unknown) => void,
            onRejected?: (reason: string) => void,
        ) {
            const tracker = globalWindow.__SU_AI_FORCE_RESPONSE_PASS_PATCH__;
            const config = (this as { config?: { playerID?: string | null } }).config;
            const playerId = config?.playerID ?? null;
            const latestState = (this as {
                latestState?: {
                    sys?: {
                        responseWindow?: {
                            current?: {
                                windowType?: string;
                                responderQueue?: string[];
                                currentResponderIndex?: number;
                            } | null;
                        };
                    };
                } | null;
            }).latestState;
            const responseWindow = latestState?.sys?.responseWindow?.current ?? null;
            const responder = responseWindow?.responderQueue?.[responseWindow.currentResponderIndex ?? 0] ?? null;

            const shouldRewrite = Boolean(
                tracker
                && playerId
                && tracker.targetPlayerIds.includes(playerId)
                && responseWindow?.windowType === 'meFirst'
                && responder === playerId
                && commands.some((command) => command.type === 'PLAY_ACTION'),
            );

            if (shouldRewrite) {
                tracker!.rewrittenBatches += 1;
                const rewritten = commands.map((command) => (
                    command.type === 'PLAY_ACTION'
                        ? { type: 'RESPONSE_PASS', payload: {} }
                        : command
                ));
                return originalSendBatch.call(this, batchId, rewritten, onConfirmed, onRejected);
            }

            return originalSendBatch.call(this, batchId, commands, onConfirmed, onRejected);
        };
    }, { ids: targetPlayerIds });
}

async function waitForTurnTracker(page: Page, side: 'YOU' | 'OPP'): Promise<void> {
    const sideText = side === 'YOU' ? /YOU|你自己/i : /OPP|对手/i;
    await expect(
        page.locator('[data-tutorial-id="su-turn-tracker"]').filter({ hasText: sideText }),
    ).toBeVisible({ timeout: 8000 });
}

async function getPlayerActionUid(page: Page, playerId: '0' | '1', defId: string): Promise<string | null> {
    return page.evaluate(({ currentPlayerId, targetDefId }) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        const hand = state?.core?.players?.[currentPlayerId]?.hand ?? [];
        return hand.find((card: any) => card.defId === targetDefId)?.uid ?? null;
    }, { currentPlayerId: playerId, targetDefId: defId });
}

async function playActionCardWithoutTargetByUi(
    page: Page,
    matchId: string,
    playerId: '0' | '1',
    cardUid: string,
): Promise<void> {
    const card = page.locator(`[data-card-uid="${cardUid}"]`);
    await expect(card).toBeVisible({ timeout: 5000 });

    // SmashUp hand cards use "first click selects, second click confirms" for no-target actions.
    await card.click();
    await page.waitForTimeout(250);
    await card.click();

    await expect.poll(async () => {
        const state = await getMatchState(matchId, page) as any;
        const player = state?.core?.players?.[playerId];
        const eventStreamEntries = state?.sys?.eventStream?.entries ?? [];
        return {
            inHand: Boolean(player?.hand?.some((entry: any) => entry.uid === cardUid)),
            inDiscard: Boolean(player?.discard?.some((entry: any) => entry.uid === cardUid)),
            hasActionPlayed: eventStreamEntries.some((entry: any) => (
                entry.event?.type === 'su:action_played'
                && entry.event?.payload?.cardUid === cardUid
            )),
        };
    }, {
        timeout: 10000,
        message: `等待玩家 ${playerId} 通过真实 UI 打出行动卡 ${cardUid}`,
    }).toEqual({
        inHand: false,
        inDiscard: true,
        hasActionPlayed: true,
    });
}

async function getCurrentInteraction(page: Page): Promise<any> {
    return page.evaluate(() => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        return harness?.state?.get?.()?.sys?.interaction?.current ?? null;
    });
}

async function getCurrentInteractionOptions(page: Page): Promise<any[]> {
    return page.evaluate(() => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        return harness?.state?.get?.()?.sys?.interaction?.current?.data?.options ?? [];
    });
}

async function findCurrentInteractionOption(
    page: Page,
    predicate: (option: any) => boolean,
): Promise<any | undefined> {
    const options = await getCurrentInteractionOptions(page);
    return options.find(predicate);
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

async function waitForSelectableMinion(page: Page, minionUid: string): Promise<void> {
    await expect.poll(async () => {
        return page.evaluate((uid) => {
            const node = document.querySelector(`[data-minion-uid="${uid}"]`);
            if (!(node instanceof HTMLElement)) return { exists: false, selectable: false, className: '' };
            return {
                exists: true,
                selectable: node.className.includes('ring-purple-400') || node.className.includes('ring-purple-300'),
                className: node.className,
            };
        }, minionUid);
    }, {
        timeout: 8000,
        message: `随从 ${minionUid} 未进入可选态`,
    }).toMatchObject({
        exists: true,
        selectable: true,
    });
}

async function dismissSpotlightIfVisible(page: Page): Promise<void> {
    const spotlightQueue = page.getByTestId('card-spotlight-queue');
    const isVisible = await spotlightQueue.isVisible({ timeout: 300 }).catch(() => false);
    if (!isVisible) return;
    await spotlightQueue.getByRole('button', { name: /^(关闭特写|Close spotlight)$/i }).click({ force: true });
    await expect(spotlightQueue).toBeHidden({ timeout: 5000 });
}

async function clickSelectableMinion(page: Page, minionUid: string): Promise<void> {
    await waitForSelectableMinion(page, minionUid);
    await page.locator(`[data-minion-uid="${minionUid}"]`).click({ force: true });
    await page.waitForTimeout(300);
}

async function expectDuelParticipantMinions(page: Page, minionUids: string[]): Promise<void> {
    for (const minionUid of minionUids) {
        await expect(page.locator(`[data-minion-uid="${minionUid}"][data-duel-participant="true"]`)).toHaveCount(1);
    }
}

const makeSmashUpCard = (uid: string, defId: string, type: 'action' | 'minion', owner: '0' | '1') => ({
    uid,
    defId,
    type,
    owner,
});

function buildActionSpotlightState(baseState: any, currentPlayerIndex: 0 | 1) {
    const nextState = JSON.parse(JSON.stringify(baseState));

    nextState.core.currentPlayerIndex = currentPlayerIndex;
    nextState.core.phase = 'playCards';
    nextState.core.factionSelection = undefined;
    nextState.core.players['0'] = {
        ...nextState.core.players['0'],
        hand: [makeSmashUpCard('p0-action-1', 'wizard_mystic_studies', 'action', '0')],
        deck: [
            makeSmashUpCard('p0-deck-1', 'wizard_neophyte', 'minion', '0'),
            makeSmashUpCard('p0-deck-2', 'wizard_apprentice', 'minion', '0'),
        ],
        discard: [],
        actionsPlayed: 0,
        actionLimit: 1,
        minionsPlayed: 0,
        minionLimit: 1,
        minionsPlayedPerBase: {},
        sameNameMinionDefId: null,
        factions: ['wizards', 'steampunks'],
    };
    nextState.core.players['1'] = {
        ...nextState.core.players['1'],
        hand: [makeSmashUpCard('p1-action-1', 'wizard_mystic_studies', 'action', '1')],
        deck: [
            makeSmashUpCard('p1-deck-1', 'wizard_chronomage', 'minion', '1'),
            makeSmashUpCard('p1-deck-2', 'wizard_archmage', 'minion', '1'),
        ],
        discard: [],
        actionsPlayed: 0,
        actionLimit: 1,
        minionsPlayed: 0,
        minionLimit: 1,
        minionsPlayedPerBase: {},
        sameNameMinionDefId: null,
        factions: ['wizards', 'steampunks'],
    };

    nextState.sys = {
        ...nextState.sys,
        turnOrder: Array.isArray(nextState.core.turnOrder) ? [...nextState.core.turnOrder] : nextState.sys.turnOrder,
        currentPlayerIndex,
        phase: 'playCards',
        interaction: nextState.sys.interaction
            ? { ...nextState.sys.interaction, current: undefined, queue: [], isBlocked: false }
            : nextState.sys.interaction,
        responseWindow: nextState.sys.responseWindow
            ? { ...nextState.sys.responseWindow, current: undefined }
            : nextState.sys.responseWindow,
        eventStream: nextState.sys.eventStream
            ? { ...nextState.sys.eventStream, entries: [], nextId: 1 }
            : nextState.sys.eventStream,
    };

    return nextState;
}

function buildOnlineSharedVisibleWaitingPromptState(baseState: any) {
    const nextState = JSON.parse(JSON.stringify(baseState));
    const existingPlayers = nextState.core?.players ?? {};
    const existingBases = Array.isArray(nextState.core?.bases) ? nextState.core.bases : [];
    const primaryBase = existingBases[0] ?? { defId: 'base_temple_of_goju', minions: [], ongoingActions: [] };
    const turnOrder = Array.isArray(nextState.core?.turnOrder) && nextState.core.turnOrder.length > 0
        ? [...nextState.core.turnOrder]
        : ['0', '1'];

    nextState.core = {
        ...nextState.core,
        currentPlayerIndex: 0,
        phase: 'playCards',
        turnNumber: 1,
        turnOrder,
        factionSelection: undefined,
        players: {
            ...existingPlayers,
            '0': {
                ...(existingPlayers['0'] ?? {}),
                hand: [],
                deck: [],
                discard: [],
                factions: ['super_spies', 'time_travelers'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                minionsPlayedPerBase: {},
                sameNameMinionDefId: null,
            },
            '1': {
                ...(existingPlayers['1'] ?? {}),
                hand: [],
                deck: [],
                discard: [],
                factions: ['super_spies', 'time_travelers'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                minionsPlayedPerBase: {},
                sameNameMinionDefId: null,
            },
        },
        bases: [{
            ...primaryBase,
            defId: primaryBase.defId ?? 'base_temple_of_goju',
            minions: [],
            ongoingActions: Array.isArray(primaryBase.ongoingActions) ? primaryBase.ongoingActions : [],
        }],
    };

    nextState.sys = {
        ...nextState.sys,
        turnOrder,
        currentPlayerIndex: 0,
        phase: 'playCards',
        turnNumber: 1,
        flowHalted: false,
        interaction: {
            current: {
                id: 'spy-visible-waiting-probe',
                kind: 'simple-choice',
                playerId: '0',
                data: {
                    title: 'Host-SU-E2E 选择要弃掉的手牌',
                    sourceId: 'the_spy_who_ditched_me_waiting_probe',
                    targetType: 'button',
                    options: [
                        { id: 'confirm', label: '确认', value: { action: 'confirm' }, displayMode: 'button' },
                    ],
                },
            },
            queue: [],
            isBlocked: false,
        },
        responseWindow: {
            current: null,
            history: [],
        },
        eventStream: {
            ...(nextState.sys?.eventStream ?? {}),
            entries: [],
            nextId: 1,
        },
    };

    return nextState;
}

function buildOnlineClosedPromptState(baseState: any) {
    const nextState = JSON.parse(JSON.stringify(baseState));
    nextState.sys = {
        ...nextState.sys,
        interaction: {
            current: undefined,
            queue: [],
            isBlocked: false,
        },
        eventStream: {
            ...(nextState.sys?.eventStream ?? {}),
            entries: [],
            nextId: Math.max(2, Number(nextState.sys?.eventStream?.nextId ?? 1) + 1),
        },
    };
    return nextState;
}

function buildFactionSelectStuckState(baseState: any) {
    const nextState = JSON.parse(JSON.stringify(baseState));

    nextState.core.currentPlayerIndex = 0;
    nextState.core.turnNumber = 1;
    nextState.core.factionSelection = undefined;
    nextState.core.players['0'] = {
        ...nextState.core.players['0'],
        factions: ['tricksters_pod', 'steampunks_pod'],
    };
    nextState.core.players['1'] = {
        ...nextState.core.players['1'],
        factions: ['vampires_pod', 'bear_cavalry_pod'],
    };

    nextState.sys = {
        ...nextState.sys,
        phase: 'factionSelect',
        interaction: {
            current: {
                id: 'starting_hand_mulligan_0_test',
                kind: 'simple-choice',
                playerId: '0',
                data: {
                    title: '起手无随从：是否重抽一次？（只能重抽一次）',
                    options: [
                        { id: 'keep', label: '保留手牌', value: { choice: 'keep' }, displayMode: 'button' },
                        { id: 'mulligan', label: '重抽一次', value: { choice: 'mulligan' }, displayMode: 'button' },
                    ],
                    sourceId: 'starting_hand_mulligan',
                    targetType: 'generic',
                },
            },
            queue: [],
            isBlocked: false,
        },
    };

    return nextState;
}

function buildRuntimeOwnedPromptMarker(
    sourceId: string,
    continuationId: string,
    context: Record<string, unknown>,
) {
    return {
        owner: 'smashup-ability-runtime',
        sourceId,
        continuationId,
        continuation: {
            context,
            contextHasMatchState: true,
        },
    };
}

function buildOnlineAiHiddenSacrificeState(baseState: any) {
    const nextState = JSON.parse(JSON.stringify(baseState));
    const existingPlayers = nextState.core?.players ?? {};
    const existingBases = Array.isArray(nextState.core?.bases) ? nextState.core.bases : [];
    const primaryBase = existingBases[0] ?? { defId: 'base_temple_of_goju', minions: [], ongoingActions: [] };
    const turnOrder = Array.isArray(nextState.core?.turnOrder) && nextState.core.turnOrder.length > 0
        ? [...nextState.core.turnOrder]
        : ['0', '1'];

    nextState.core = {
        ...nextState.core,
        currentPlayerIndex: 1,
        phase: 'playCards',
        turnNumber: 3,
        turnOrder,
        factionSelection: undefined,
        players: {
            ...existingPlayers,
            '0': {
                ...(existingPlayers['0'] ?? {}),
                hand: [],
                deck: [],
                discard: [],
                factions: ['pirates', 'aliens'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                minionsPlayedPerBase: {},
                sameNameMinionDefId: null,
            },
            '1': {
                ...(existingPlayers['1'] ?? {}),
                hand: [
                    { uid: 'ai-sacrifice-action', defId: 'wizard_sacrifice', type: 'action', owner: '1' },
                ],
                deck: [
                    { uid: 'ai-draw-1', defId: 'wizard_archmage', type: 'minion', owner: '1' },
                    { uid: 'ai-draw-2', defId: 'wizard_apprentice', type: 'minion', owner: '1' },
                    { uid: 'ai-draw-3', defId: 'wizard_enchantress', type: 'minion', owner: '1' },
                ],
                discard: [],
                factions: ['wizards', 'ninjas'],
                minionsPlayed: 1,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                minionsPlayedPerBase: {},
                sameNameMinionDefId: null,
            },
        },
        bases: [
            {
                ...primaryBase,
                defId: primaryBase.defId ?? 'base_temple_of_goju',
                minions: [{
                    uid: 'ai-sacrifice-target',
                    defId: 'ninja_shinobi',
                    controller: '1',
                    owner: '1',
                    basePower: 3,
                    powerCounters: 0,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    talentUsed: false,
                    playedThisTurn: true,
                    attachedActions: [],
                }],
                ongoingActions: Array.isArray(primaryBase.ongoingActions) ? primaryBase.ongoingActions : [],
            },
        ],
    };

    nextState.sys = {
        ...nextState.sys,
        turnOrder,
        currentPlayerIndex: 1,
        phase: 'playCards',
        turnNumber: 3,
        flowHalted: false,
        interaction: {
            current: undefined,
            queue: [],
            isBlocked: false,
        },
        responseWindow: {
            current: null,
            history: [],
        },
        eventStream: {
            ...(nextState.sys?.eventStream ?? {}),
            entries: [],
            nextId: 1,
        },
    };

    return nextState;
}

function buildOnlineAiHiddenHoverbotState(baseState: any) {
    const nextState = JSON.parse(JSON.stringify(baseState));
    const runtimeNow = 1777939000100;
    const existingPlayers = nextState.core?.players ?? {};
    const existingBases = Array.isArray(nextState.core?.bases) ? nextState.core.bases : [];
    const primaryBase = existingBases[0] ?? { defId: 'base_tortuga', minions: [], ongoingActions: [] };
    const turnOrder = Array.isArray(nextState.core?.turnOrder) && nextState.core.turnOrder.length > 0
        ? [...nextState.core.turnOrder]
        : ['0', '1'];

    nextState.core = {
        ...nextState.core,
        currentPlayerIndex: 1,
        phase: 'playCards',
        turnNumber: 3,
        turnOrder,
        factionSelection: undefined,
        players: {
            ...existingPlayers,
            '0': {
                ...(existingPlayers['0'] ?? {}),
                hand: [],
                deck: [],
                discard: [],
                factions: ['pirates', 'aliens'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                minionsPlayedPerBase: {},
                sameNameMinionDefId: null,
            },
            '1': {
                ...(existingPlayers['1'] ?? {}),
                hand: [],
                deck: [
                    { uid: 'ai-top-zapbot', defId: 'robot_zapbot', type: 'minion', owner: '1' },
                    { uid: 'ai-next-minion', defId: 'robot_microbot_alpha', type: 'minion', owner: '1' },
                ],
                discard: [],
                factions: ['robots', 'wizards'],
                minionsPlayed: 1,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                minionsPlayedPerBase: {},
                sameNameMinionDefId: null,
            },
        },
        bases: [
            {
                ...primaryBase,
                defId: primaryBase.defId ?? 'base_tortuga',
                minions: [{
                    uid: 'ai-hoverbot-on-base',
                    defId: 'robot_hoverbot',
                    controller: '1',
                    owner: '1',
                    basePower: 1,
                    powerCounters: 0,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    talentUsed: false,
                    playedThisTurn: true,
                    attachedActions: [],
                }],
                ongoingActions: Array.isArray(primaryBase.ongoingActions) ? primaryBase.ongoingActions : [],
            },
        ],
    };

    nextState.sys = {
        ...nextState.sys,
        turnOrder,
        currentPlayerIndex: 1,
        phase: 'playCards',
        turnNumber: 3,
        flowHalted: false,
        interaction: {
            current: {
                id: 'robot_hoverbot_hidden_choice',
                playerId: '1',
                kind: 'simple-choice',
                data: {
                    title: '牌库顶是 cards.robot_zapbot.name（力量 2），是否作为额外随从打出？',
                    sourceId: 'robot_hoverbot',
                    targetType: 'generic',
                    responseValidationMode: 'live',
                    runtimePrompt: buildRuntimeOwnedPromptMarker(
                        'robot_hoverbot',
                        'smashup-runtime:robot_hoverbot:e2e-hidden-choice',
                        {
                            playerId: '1',
                            now: runtimeNow,
                            revealEvents: [],
                            topCard: {
                                uid: 'ai-top-zapbot',
                                defId: 'robot_zapbot',
                                type: 'minion',
                                owner: '1',
                            },
                            topPower: 2,
                        },
                    ),
                    options: [
                        {
                            id: 'play',
                            label: '打出 cards.robot_zapbot.name',
                            value: { cardUid: 'ai-top-zapbot', defId: 'robot_zapbot', power: 2 },
                            displayMode: 'card',
                        },
                        {
                            id: 'skip',
                            label: '放回牌库顶',
                            value: { skip: true },
                            displayMode: 'button',
                        },
                    ],
                },
            },
            queue: [],
            isBlocked: true,
        },
        responseWindow: {
            current: null,
            history: [],
        },
        eventStream: {
            ...(nextState.sys?.eventStream ?? {}),
            entries: [],
            nextId: 1,
        },
    };

    return nextState;
}

function buildOnlineAiPassTurnState(baseState: any) {
    const nextState = JSON.parse(JSON.stringify(baseState));
    const existingPlayers = nextState.core?.players ?? {};
    const existingBases = Array.isArray(nextState.core?.bases) && nextState.core.bases.length > 0
        ? nextState.core.bases
        : [{ defId: 'base_jungle_oasis', minions: [], ongoingActions: [] }];
    const turnOrder = Array.isArray(nextState.core?.turnOrder) && nextState.core.turnOrder.length > 0
        ? [...nextState.core.turnOrder]
        : ['0', '1'];

    nextState.core = {
        ...nextState.core,
        currentPlayerIndex: 1,
        phase: 'playCards',
        turnNumber: 4,
        turnOrder,
        factionSelection: undefined,
        players: {
            ...existingPlayers,
            '0': {
                ...(existingPlayers['0'] ?? {}),
                hand: [
                    { uid: 'host-card-1', defId: 'pirates_first_mate', type: 'minion', owner: '0' },
                    { uid: 'host-card-2', defId: 'pirates_broadside', type: 'action', owner: '0' },
                ],
                deck: [],
                discard: [],
                factions: ['pirates', 'aliens'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                minionsPlayedPerBase: {},
                sameNameMinionDefId: null,
                vp: 3,
            },
            '1': {
                ...(existingPlayers['1'] ?? {}),
                hand: [],
                deck: [],
                discard: [],
                factions: ['wizards', 'ninjas'],
                minionsPlayed: 1,
                minionLimit: 1,
                actionsPlayed: 1,
                actionLimit: 1,
                minionsPlayedPerBase: {},
                sameNameMinionDefId: null,
                vp: 2,
            },
        },
        bases: existingBases.map((base: any, index: number) => ({
            ...base,
            defId: base.defId ?? (index === 0 ? 'base_jungle_oasis' : 'base_mushroom_kingdom'),
            minions: Array.isArray(base.minions) ? base.minions : [],
            ongoingActions: Array.isArray(base.ongoingActions) ? base.ongoingActions : [],
        })),
    };

    nextState.sys = {
        ...nextState.sys,
        turnOrder,
        currentPlayerIndex: 1,
        phase: 'playCards',
        turnNumber: 4,
        flowHalted: false,
        interaction: {
            current: undefined,
            queue: [],
            isBlocked: false,
        },
        responseWindow: {
            current: null,
            history: [],
        },
        eventStream: {
            ...(nextState.sys?.eventStream ?? {}),
            entries: [],
            nextId: 1,
        },
    };

    return nextState;
}

function buildOnlineAiResponseWindowPlayableState(baseState: any) {
    const nextState = JSON.parse(JSON.stringify(baseState));
    const existingPlayers = nextState.core?.players ?? {};
    const existingBases = Array.isArray(nextState.core?.bases) ? nextState.core.bases : [];
    const turnOrder = Array.isArray(nextState.core?.turnOrder) && nextState.core.turnOrder.length > 0
        ? [...nextState.core.turnOrder]
        : ['0', '1'];
    const primaryBase = existingBases[0] ?? { defId: 'base_the_mothership', minions: [], ongoingActions: [] };
    const secondaryBase = existingBases[1] ?? { defId: 'base_tortuga', minions: [], ongoingActions: [] };

    nextState.core = {
        ...nextState.core,
        currentPlayerIndex: 0,
        phase: 'playCards',
        turnNumber: 4,
        turnOrder,
        factionSelection: undefined,
        players: {
            ...existingPlayers,
            '0': {
                ...(existingPlayers['0'] ?? {}),
                hand: [
                    { uid: 'host-under-pressure-card', defId: 'giant_ant_under_pressure', type: 'action', owner: '0' },
                ],
                deck: [],
                discard: [],
                factions: ['giant_ants', 'aliens'],
                minionsPlayed: 1,
                minionLimit: 1,
                actionsPlayed: 1,
                actionLimit: 1,
                minionsPlayedPerBase: {},
                sameNameMinionDefId: null,
                vp: 4,
            },
            '1': {
                ...(existingPlayers['1'] ?? {}),
                hand: [
                    { uid: 'ai-under-pressure-card', defId: 'giant_ant_under_pressure', type: 'action', owner: '1' },
                ],
                deck: [],
                discard: [],
                factions: ['giant_ants', 'pirates'],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                minionsPlayedPerBase: {},
                sameNameMinionDefId: null,
                vp: 3,
            },
        },
        bases: [
            {
                ...primaryBase,
                defId: primaryBase.defId ?? 'base_the_mothership',
                minions: [
                    {
                        uid: 'host-under-pressure-source',
                        defId: 'giant_ant_worker',
                        controller: '0',
                        owner: '0',
                        basePower: 3,
                        powerCounters: 2,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        playedThisTurn: false,
                        attachedActions: [],
                    },
                    {
                        uid: 'ai-under-pressure-source',
                        defId: 'giant_ant_soldier',
                        controller: '1',
                        owner: '1',
                        basePower: 3,
                        powerCounters: 1,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        playedThisTurn: false,
                        attachedActions: [],
                    },
                    ...Array.from({ length: 4 }, (_, index) => ({
                        uid: `host-pressure-enemy-${index}`,
                        defId: 'test_minion',
                        controller: '0',
                        owner: '0',
                        basePower: 5,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        playedThisTurn: false,
                        attachedActions: [],
                    })),
                ],
                ongoingActions: Array.isArray(primaryBase.ongoingActions) ? primaryBase.ongoingActions : [],
            },
            {
                ...secondaryBase,
                defId: secondaryBase.defId ?? 'base_tortuga',
                minions: [
                    {
                        uid: 'host-under-pressure-target',
                        defId: 'alien_invader',
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
                        uid: 'ai-under-pressure-target',
                        defId: 'pirates_first_mate',
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
                ongoingActions: Array.isArray(secondaryBase.ongoingActions) ? secondaryBase.ongoingActions : [],
            },
        ],
    };

    nextState.sys = {
        ...nextState.sys,
        turnOrder,
        currentPlayerIndex: 0,
        phase: 'playCards',
        turnNumber: 4,
        flowHalted: false,
        interaction: {
            current: undefined,
            queue: [],
            isBlocked: false,
        },
        responseWindow: {
            current: null,
            history: [],
        },
        eventStream: {
            ...(nextState.sys?.eventStream ?? {}),
            entries: [],
            nextId: 1,
        },
    };

    return nextState;
}

function buildOnlineAiFourPlayerResponseWindowStressState(baseState: any) {
    const nextState = JSON.parse(JSON.stringify(baseState));
    const existingPlayers = nextState.core?.players ?? {};
    const existingBases = Array.isArray(nextState.core?.bases) ? nextState.core.bases : [];
    const turnOrder = ['0', '1', '2', '3'];
    const primaryBase = existingBases[0] ?? { defId: 'base_the_mothership', minions: [], ongoingActions: [] };
    const secondaryBase = existingBases[1] ?? { defId: 'base_tortuga', minions: [], ongoingActions: [] };

    const buildPlayer = (playerId: '0' | '1' | '2' | '3', vp: number) => ({
        ...(existingPlayers[playerId] ?? {}),
        hand: [
            { uid: `p${playerId}-full-sail-1`, defId: 'pirate_full_sail', type: 'action', owner: playerId },
            { uid: `p${playerId}-full-sail-2`, defId: 'pirate_full_sail', type: 'action', owner: playerId },
        ],
        deck: [],
        discard: [],
        factions: ['giant_ants', 'pirates'],
        minionsPlayed: 1,
        minionLimit: 1,
        actionsPlayed: 1,
        actionLimit: 1,
        minionsPlayedPerBase: {},
        sameNameMinionDefId: null,
        vp,
    });

    const sourceMinions = turnOrder.map((playerId) => ({
        uid: `p${playerId}-under-pressure-source`,
        defId: 'giant_ant_soldier',
        controller: playerId,
        owner: playerId,
        basePower: 3,
        powerCounters: 2,
        powerModifier: 3,
        tempPowerModifier: 0,
        talentUsed: false,
        playedThisTurn: false,
        attachedActions: [],
    }));

    const targetMinions = turnOrder.map((playerId) => ({
        uid: `p${playerId}-under-pressure-target`,
        defId: 'pirates_first_mate',
        controller: playerId,
        owner: playerId,
        basePower: 2,
        powerCounters: 0,
        powerModifier: 0,
        tempPowerModifier: 0,
        talentUsed: false,
        playedThisTurn: false,
        attachedActions: [],
    }));

    nextState.core = {
        ...nextState.core,
        currentPlayerIndex: 0,
        phase: 'playCards',
        turnNumber: 9,
        turnOrder,
        factionSelection: undefined,
        players: {
            ...existingPlayers,
            '0': buildPlayer('0', 5),
            '1': buildPlayer('1', 4),
            '2': buildPlayer('2', 3),
            '3': buildPlayer('3', 2),
        },
        bases: [
            {
                ...primaryBase,
                defId: primaryBase.defId ?? 'base_the_mothership',
                breakpoint: 12,
                minions: sourceMinions,
                ongoingActions: Array.isArray(primaryBase.ongoingActions) ? primaryBase.ongoingActions : [],
            },
            {
                ...secondaryBase,
                defId: secondaryBase.defId ?? 'base_tortuga',
                minions: targetMinions,
                ongoingActions: Array.isArray(secondaryBase.ongoingActions) ? secondaryBase.ongoingActions : [],
            },
        ],
        baseDeck: ['base_the_factory', 'base_cave_of_shinies', 'base_rhodes_plaza'],
    };

    nextState.sys = {
        ...nextState.sys,
        turnOrder,
        currentPlayerIndex: 0,
        phase: 'playCards',
        turnNumber: 9,
        flowHalted: false,
        interaction: {
            current: undefined,
            queue: [],
            isBlocked: false,
        },
        responseWindow: {
            current: null,
            history: [],
        },
        eventStream: {
            ...(nextState.sys?.eventStream ?? {}),
            entries: [],
            nextId: 1,
        },
    };

    return nextState;
}

function buildOnlineAiComplexMultiBaseScoringState(baseState: any) {
    const nextState = JSON.parse(JSON.stringify(baseState));
    const existingPlayers = nextState.core?.players ?? {};

    nextState.core = {
        ...nextState.core,
        currentPlayerIndex: 1,
        phase: 'scoreBases',
        turnNumber: 8,
        turnOrder: ['0', '1'],
        factionSelection: undefined,
        scoringEligibleBaseIndices: [0, 1, 2],
        baseDeck: ['base_the_factory', 'base_cave_of_shinies', 'base_rhodes_plaza'],
        players: {
            ...existingPlayers,
            '0': {
                ...(existingPlayers['0'] ?? {}),
                hand: [],
                deck: [],
                discard: [],
                factions: ['ninjas', 'aliens'],
                minionsPlayed: 1,
                minionLimit: 1,
                actionsPlayed: 1,
                actionLimit: 1,
                minionsPlayedPerBase: {},
                sameNameMinionDefId: null,
                vp: 2,
            },
            '1': {
                ...(existingPlayers['1'] ?? {}),
                hand: [],
                deck: [],
                discard: [],
                factions: ['dinosaurs', 'wizards'],
                minionsPlayed: 1,
                minionLimit: 1,
                actionsPlayed: 1,
                actionLimit: 1,
                minionsPlayedPerBase: {},
                sameNameMinionDefId: null,
                vp: 3,
            },
        },
        bases: [
            {
                defId: 'base_the_jungle',
                breakpoint: 12,
                minions: [
                    {
                        uid: 'ai-b0-king-rex',
                        defId: 'test_minion',
                        controller: '1',
                        owner: '1',
                        basePower: 9,
                        powerCounters: 0,
                        powerModifier: 12,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        playedThisTurn: false,
                        attachedActions: [],
                    },
                    {
                        uid: 'ai-b0-tiger-assassin',
                        defId: 'test_minion',
                        controller: '0',
                        owner: '0',
                        basePower: 8,
                        powerCounters: 0,
                        powerModifier: 10,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        playedThisTurn: false,
                        attachedActions: [],
                    },
                ],
                ongoingActions: [],
            },
            {
                defId: 'base_ninja_dojo',
                breakpoint: 18,
                minions: [
                    {
                        uid: 'ai-b1-king-rex',
                        defId: 'test_minion',
                        controller: '1',
                        owner: '1',
                        basePower: 9,
                        powerCounters: 0,
                        powerModifier: 13,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        playedThisTurn: false,
                        attachedActions: [],
                    },
                    {
                        uid: 'ai-b1-shinobi',
                        defId: 'test_minion',
                        controller: '0',
                        owner: '0',
                        basePower: 8,
                        powerCounters: 0,
                        powerModifier: 11,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        playedThisTurn: false,
                        attachedActions: [],
                    },
                ],
                ongoingActions: [],
            },
            {
                defId: 'base_pirate_cove',
                breakpoint: 20,
                minions: [
                    {
                        uid: 'ai-b2-king-rex',
                        defId: 'test_minion',
                        controller: '1',
                        owner: '1',
                        basePower: 9,
                        powerCounters: 0,
                        powerModifier: 14,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        playedThisTurn: false,
                        attachedActions: [],
                    },
                    {
                        uid: 'ai-b2-invader',
                        defId: 'test_minion',
                        controller: '0',
                        owner: '0',
                        basePower: 8,
                        powerCounters: 0,
                        powerModifier: 12,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        playedThisTurn: false,
                        attachedActions: [],
                    },
                ],
                ongoingActions: [],
            },
        ],
    };

    nextState.sys = {
        ...nextState.sys,
        turnOrder: ['0', '1'],
        currentPlayerIndex: 1,
        phase: 'scoreBases',
        turnNumber: 8,
        flowHalted: false,
        interaction: {
            current: undefined,
            queue: [],
            isBlocked: false,
        },
        responseWindow: {
            current: null,
            history: [],
        },
        eventStream: {
            ...(nextState.sys?.eventStream ?? {}),
            entries: [],
            nextId: 1,
        },
    };

    return nextState;
}

async function installUiRefreshMonitor(page: Page): Promise<void> {
    await page.evaluate(() => {
        const selectors = {
            turnTracker: '[data-tutorial-id="su-turn-tracker"]',
            scoreboard: '[data-tutorial-id="su-scoreboard"]',
            handArea: '[data-testid="su-hand-area"]',
        } as const;

        const refs = {
            turnTracker: document.querySelector(selectors.turnTracker),
            scoreboard: document.querySelector(selectors.scoreboard),
            handArea: document.querySelector(selectors.handArea),
        };

        const stats = {
            loadingVisibleSamples: 0,
            samples: 0,
            replacements: {
                turnTracker: 0,
                scoreboard: 0,
                handArea: 0,
            },
            disconnects: {
                turnTracker: 0,
                scoreboard: 0,
                handArea: 0,
            },
        };

        const sample = () => {
            stats.samples += 1;
            if (document.querySelector('[data-testid="loading-screen"]')) {
                stats.loadingVisibleSamples += 1;
            }

            for (const key of Object.keys(selectors) as Array<keyof typeof selectors>) {
                const current = refs[key];
                const next = document.querySelector(selectors[key]);
                if (current && !current.isConnected) {
                    stats.disconnects[key] += 1;
                }
                if (current && next && current !== next) {
                    stats.replacements[key] += 1;
                    refs[key] = next;
                } else if (!current && next) {
                    refs[key] = next;
                }
            }
        };

        sample();
        const timer = window.setInterval(sample, 50);
        (window as Window & {
            __SU_REFRESH_MONITOR__?: {
                stats: typeof stats;
                stop: () => typeof stats;
            };
        }).__SU_REFRESH_MONITOR__ = {
            stats,
            stop: () => {
                window.clearInterval(timer);
                sample();
                return stats;
            },
        };
    });
}

async function readUiRefreshMonitor(page: Page) {
    return page.evaluate(() => {
        const monitor = (window as Window & {
            __SU_REFRESH_MONITOR__?: {
                stop: () => unknown;
            };
        }).__SU_REFRESH_MONITOR__;
        if (!monitor) {
            throw new Error('UI refresh monitor not installed');
        }
        return monitor.stop();
    });
}

test('简单阶段转换 - 点击结束回合', async ({ page, game }, testInfo) => {
    test.setTimeout(60000);

    await page.goto('/play/smashup');
    await page.waitForFunction(
        () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered(),
        { timeout: 15000 },
    );

    await game.setupScene({
        gameId: 'smashup',
        player0: {
            hand: [{ uid: 'card-1', defId: 'wizard_portal', type: 'action' }],
        },
        player1: {},
        bases: [{ breakpoint: 25, power: 0 }],
        currentPlayer: '0',
        phase: 'playCards',
    });

    await page.waitForTimeout(2000);
    await game.screenshot('01-initial-state', testInfo);

    const initialPhase = await page.evaluate(() => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        return harness.state.get().sys.phase;
    });
    console.log('[TEST] 初始阶段:', initialPhase);

    await game.advancePhase();

    await game.screenshot('02-after-finish-turn', testInfo);

    await expect.poll(async () => {
        const state = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            return harness.state.get();
        });
        return {
            phase: state.sys.phase,
            currentPlayerIndex: state.core.currentPlayerIndex,
        };
    }, { timeout: 10000 }).toEqual({
        phase: 'playCards',
        currentPlayerIndex: 1,
    });
});

test('Oops 四派系在派系选择与注入场景中都能显示资源', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);

    await game.openTestGame('smashup');

    const factionHeading = page.locator('h1').filter({ hasText: /Draft Your Factions|选择你的派系/i });
    await expect(factionHeading).toBeVisible({ timeout: 15000 });

    const factionNames = [
        /Ancient Egyptians|古埃及人/i,
        /Cowboys|牛仔/i,
        /Samurai|武士/i,
        /Vikings|维京人/i,
    ];

    for (const namePattern of factionNames) {
        const card = page.getByText(namePattern).first();
        await card.scrollIntoViewIfNeeded();
        await expect(card).toBeVisible({ timeout: 10000 });
    }
    await expect.poll(async () => page.locator('.atlas-shimmer').count(), {
        timeout: 10000,
        message: 'Oops 四派系在派系选择界面中不应停留在 shimmer 占位态',
    }).toBe(0);

    await game.screenshot('oops-faction-selection-visible', testInfo);

    await game.setupScene({
        gameId: 'smashup',
        player0: {
            factions: ['vikings', 'samurai'],
            hand: [
                { uid: 'p0-viking-minion', defId: 'vikings_huscarl', type: 'minion' },
                { uid: 'p0-samurai-action', defId: 'samurai_yokai_attack', type: 'action' },
            ],
            deck: [
                { uid: 'p0-deck-1', defId: 'vikings_raider', type: 'minion' },
                { uid: 'p0-deck-2', defId: 'samurai_shogun', type: 'minion' },
            ],
            discard: [],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
        },
        player1: {
            factions: ['ancient_egyptians', 'cowboys'],
            hand: [],
            deck: [
                { uid: 'p1-deck-1', defId: 'ancient_egyptians_mummy', type: 'minion' },
                { uid: 'p1-deck-2', defId: 'cowboys_deputy', type: 'minion' },
            ],
            discard: [],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
        },
        currentPlayer: '0',
        phase: 'playCards',
        bases: [
            { defId: 'base_drakkar' },
            { defId: 'base_shoguns_palace' },
            { defId: 'base_pyramids' },
        ],
        extra: {
            core: {
                turnOrder: ['0', '1'],
                turnNumber: 1,
                nextUid: 5000,
                baseDeck: ['base_longhouse', 'base_saloon', 'base_sakura_garden'],
            },
        },
    });

    await waitForSmashUpUI(page);

    await expect(page.locator('[data-base-index="0"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-base-index="1"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-base-index="2"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-card-uid="p0-viking-minion"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-card-uid="p0-samurai-action"]')).toBeVisible({ timeout: 10000 });

    await expect.poll(async () => page.locator('.atlas-shimmer').count(), {
        timeout: 10000,
        message: 'Oops 四派系接入后的卡图/基地图不应停留在 shimmer 占位态',
    }).toBe(0);

    const state = await page.evaluate(() => (window as any).__BG_TEST_HARNESS__?.state?.get?.() ?? null);
    expect(state).toBeTruthy();
    expect(state.core.players['0'].factions).toEqual(['vikings', 'samurai']);
    expect(state.core.players['1'].factions).toEqual(['ancient_egyptians', 'cowboys']);
    expect(state.core.bases.map((base: any) => base.defId)).toEqual([
        'base_drakkar',
        'base_shoguns_palace',
        'base_pyramids',
    ]);

    await game.screenshot('oops-faction-intake-board', testInfo);
});

test('Oops Ancient Egyptians 埋葬条带与翻开交互应在浏览器中可完成', async ({ page, game }, testInfo) => {
    test.setTimeout(60000);

    await game.openTestGame('smashup');
    await game.setupScene({
        gameId: 'smashup',
        player0: {
            factions: ['ancient_egyptians', 'robots'],
            hand: [
                { uid: 'seal-1', defId: 'ancient_egyptians_seal_the_tomb', type: 'action' },
            ],
            deck: [
                { uid: 'draw-1', defId: 'robot_microbot_alpha', type: 'minion' },
                { uid: 'draw-2', defId: 'robot_zapbot', type: 'minion' },
                { uid: 'draw-3', defId: 'robot_warbot', type: 'minion' },
            ],
            discard: [],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
        },
        player1: {
            factions: ['vikings', 'samurai'],
            hand: [],
            deck: [],
            discard: [],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
        },
        currentPlayer: '0',
        phase: 'playCards',
        bases: [
            { defId: 'base_pyramids' },
            { defId: 'base_a' },
        ],
        extra: {
            core: {
                turnOrder: ['0', '1'],
                turnNumber: 1,
                nextUid: 5000,
                bases: [
                    {
                        defId: 'base_pyramids',
                        minions: [
                            {
                                uid: 'guard-1',
                                defId: 'robot_microbot_alpha',
                                owner: '0',
                                controller: '0',
                                basePower: 1,
                                counters: 0,
                                talentUsed: false,
                                attachedActions: [],
                            },
                        ],
                        ongoingActions: [],
                        buriedCards: [
                            {
                                uid: 'buried-yk',
                                defId: 'ancient_egyptians_you_can_take_it_with_you',
                                trueOwnerId: '0',
                                controllerId: '0',
                                buriedFrom: 'hand',
                            },
                        ],
                    },
                    {
                        defId: 'base_a',
                        minions: [],
                        ongoingActions: [],
                    },
                ],
            },
        },
    });

    await waitForSmashUpUI(page);
    await expect(page.locator('[data-buried-count="1"]').first()).toBeVisible({ timeout: 8000 });
    await saveEvidenceScreenshot(page, testInfo, 'oops-bury-strip-before-uncover');

    await page.locator('[data-testid="su-hand-area"] [data-card-uid="seal-1"]').click({ force: true });
    await page.waitForTimeout(300);
    await page.locator('[data-base-index="0"]').click({ force: true });

    await dismissSpotlightIfVisible(page);
    await expect.poll(async () => (await getCurrentInteraction(page))?.data?.sourceId ?? null).toBe('ancient_egyptians_seal_the_tomb_mode');
    await page.getByRole('button', { name: /翻开同一基地至多两张你的埋葬牌/i }).click();

    await expect.poll(async () => (await getCurrentInteraction(page))?.data?.sourceId ?? null).toBe('ancient_egyptians_seal_the_tomb_uncover');
    await page.getByRole('button', { name: /随身带走 @ 金字塔|You Can Take It With You @ Pyramids/i }).click();
    await page.getByRole('button', { name: /^(确认|Confirm)(?:\s*\(\d+\))?$/i }).click();

    await expect.poll(async () => {
        const state = await game.getState();
        return state.core.bases[0].buriedCards?.length ?? 0;
    }, { timeout: 8000 }).toBe(0);

    await expect.poll(async () => {
        const state = await game.getState();
        return state.core.players['0'].hand.length;
    }, { timeout: 8000 }).toBe(3);

    await expect.poll(async () => {
        const state = await game.getState();
        return state.core.players['0'].discard.some((card: any) => card.defId === 'ancient_egyptians_you_can_take_it_with_you');
    }, { timeout: 8000 }).toBe(true);

    await saveEvidenceScreenshot(page, testInfo, 'oops-bury-strip-after-uncover');
});

test('Oops Sphinx 起始回合回收埋葬牌后，标准翻开阶段不应再出现刚消耗的埋葬牌', async ({ page, game }, testInfo) => {
    test.setTimeout(60000);

    await game.openTestGame('smashup');
    await game.setupScene({
        gameId: 'smashup',
        player0: {
            factions: ['ancient_egyptians', 'robots'],
            hand: [],
            deck: [
                { uid: 'draw-1', defId: 'robot_microbot_alpha', type: 'minion' },
                { uid: 'draw-2', defId: 'robot_zapbot', type: 'minion' },
            ],
            discard: [],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
        },
        player1: {
            factions: ['vikings', 'samurai'],
            hand: [],
            deck: [],
            discard: [],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
        },
        currentPlayer: '1',
        phase: 'endTurn',
        bases: [
            { defId: 'base_pyramids' },
            { defId: 'base_a' },
        ],
        extra: {
            core: {
                turnOrder: ['0', '1'],
                turnNumber: 1,
                nextUid: 7000,
                bases: [
                    {
                        defId: 'base_pyramids',
                        minions: [],
                        ongoingActions: [],
                        buriedCards: [
                            {
                                uid: 'sphinx-buried-return',
                                defId: 'ancient_egyptians_lost_knowledge',
                                trueOwnerId: '0',
                                controllerId: '0',
                                buriedFrom: 'hand',
                            },
                            {
                                uid: 'sphinx-buried-keep',
                                defId: 'ancient_egyptians_you_can_take_it_with_you',
                                trueOwnerId: '0',
                                controllerId: '0',
                                buriedFrom: 'hand',
                            },
                        ],
                    },
                    {
                        defId: 'base_a',
                        minions: [],
                        ongoingActions: [],
                    },
                ],
                titans: [
                    {
                        uid: 'titan-sphinx-setaside',
                        defId: 'sphinx',
                        faction: 'ancient_egyptians',
                        ownerId: '0',
                        controllerId: '0',
                        powerCounters: 0,
                        talentUsed: false,
                        location: { zone: 'setaside' },
                    },
                ],
            },
        },
    });

    await waitForSmashUpUI(page);
    await expect(page.locator('[data-buried-count="2"]').first()).toBeVisible({ timeout: 8000 });

    await dispatchHarnessCommand(page, '1', 'ADVANCE_PHASE', {});

    await expect.poll(async () => (await getCurrentInteraction(page))?.data?.sourceId ?? null).toBe('titan_sphinx_start_turn');
    await saveEvidenceScreenshot(page, testInfo, 'sphinx-real-start-turn-before-return');

    const initialOptionUids = await page.evaluate(() => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const options = harness?.state?.get?.()?.sys?.interaction?.current?.data?.options ?? [];
        return options
            .map((option: any) => option?.value?.cardUid)
            .filter((uid: unknown) => typeof uid === 'string');
    });
    expect(initialOptionUids).toEqual(['sphinx-buried-return', 'sphinx-buried-keep']);

    const returnOption = await findCurrentInteractionOption(
        page,
        (option) => option?.value?.cardUid === 'sphinx-buried-return',
    );
    expect(returnOption?.id).toBeTruthy();
    await respondCurrentInteraction(page, { optionId: returnOption.id });

    await expect.poll(async () => (await getCurrentInteraction(page))?.data?.sourceId ?? null).toBe('bury_uncover_start_turn');

    await expect.poll(async () => {
        const interaction = await getCurrentInteraction(page);
        const options = interaction?.data?.options ?? [];
        return options
            .map((option: any) => option?.value?.cardUid)
            .filter((uid: unknown) => typeof uid === 'string');
    }, { timeout: 8000 }).toEqual(['sphinx-buried-keep']);

    await expect.poll(async () => {
        const state = await game.getState();
        return state.core.players['0'].hand.some((card: any) => card.uid === 'sphinx-buried-return');
    }, { timeout: 8000 }).toBe(true);

    await expect(page.locator('[data-buried-card-uid="sphinx-buried-return"]')).toHaveCount(0);
    await expect(page.locator('[data-buried-card-uid="sphinx-buried-keep"]')).toHaveCount(1);
    await saveEvidenceScreenshot(page, testInfo, 'sphinx-real-start-turn-after-return-before-uncover');
});

test('Oops Cowboys 决斗交互应按官方链路完成 Pinkerton/决斗牌/Deputy/结算', async ({ page, game }, testInfo) => {
    test.setTimeout(60000);
    const duelBannerText = /决斗进行中|Duel in progress/i;
    const duelCardPromptText = /决斗牌：从手牌选择 1 张要用于这场决斗的牌，或跳过|Duel: choose 1 duel card from hand, or skip/i;
    const deputyPromptText = /副警长：你可以弃掉 1 张副警长，使 1 个随从直到回合结束获得 \+2 力量|Deputy: you may discard a Deputy to give a minion \+2 power until end of turn/i;

    await game.openTestGame('smashup');
    await game.setupScene({
        gameId: 'smashup',
        player0: {
            factions: ['cowboys', 'robots'],
            hand: [
                { uid: 'gun-1', defId: 'cowboys_gunfighter', type: 'minion' },
                { uid: 'deputy-1', defId: 'cowboys_deputy', type: 'minion' },
            ],
            deck: [],
            discard: [],
            field: [
                { uid: 'pink-1', defId: 'cowboys_pinkerton', baseIndex: 0, owner: '0', controller: '0', power: 4 },
            ],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
        },
        player1: {
            factions: ['samurai', 'vikings'],
            hand: [],
            deck: [],
            discard: [],
            field: [
                { uid: 'enemy-1', defId: 'robot_microbot_alpha', baseIndex: 0, owner: '1', controller: '1', power: 2 },
            ],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
        },
        currentPlayer: '0',
        phase: 'playCards',
        bases: [{ defId: 'base_a' }],
        extra: {
            core: {
                turnOrder: ['0', '1'],
                turnNumber: 1,
                nextUid: 6000,
            },
        },
    });

    await waitForSmashUpUI(page);
    await game.playCard('cowboys_gunfighter', { targetBaseIndex: 0 });
    await expect.poll(async () => (await getCurrentInteraction(page))?.data?.sourceId ?? null).toBe('cowboys_gunfighter');

    await waitForSelectableMinion(page, 'enemy-1');
    await clickSelectableMinion(page, 'enemy-1');

    await expect.poll(async () => (await getCurrentInteraction(page))?.data?.sourceId ?? null).toBe('smashup_duel_pinkerton');
    await expect(page.getByText(duelBannerText)).toBeVisible({ timeout: 8000 });
    await expectDuelParticipantMinions(page, ['gun-1', 'enemy-1']);
    await saveEvidenceScreenshot(page, testInfo, 'oops-duel-pinkerton-prompt');
    await page.getByRole('button', { name: /放置 1 个指示物|Place 1 counter/i }).click();

    await expect.poll(async () => (await getCurrentInteraction(page))?.data?.sourceId ?? null).toBe('smashup_duel_card');
    await expect(page.getByText(duelCardPromptText)).toBeVisible({ timeout: 8000 });
    await expectDuelParticipantMinions(page, ['gun-1', 'enemy-1']);
    await saveEvidenceScreenshot(page, testInfo, 'oops-duel-card-prompt');
    await page.getByRole('button', { name: /跳过（不从手牌打出决斗牌）|Skip \(play no duel card\)/i }).click();

    await expect.poll(async () => {
        const interaction = await getCurrentInteraction(page);
        return interaction ? { sourceId: interaction.data?.sourceId ?? null, playerId: interaction.playerId ?? null } : null;
    }, { timeout: 8000 }).toEqual({ sourceId: 'smashup_duel_card', playerId: '1' });
    const enemySkipOption = await findCurrentInteractionOption(page, option => option?.value?.skip === true);
    expect(enemySkipOption).toBeTruthy();
    await respondCurrentInteraction(page, { optionId: enemySkipOption.id });

    await expect.poll(async () => {
        const interaction = await getCurrentInteraction(page);
        return interaction ? { sourceId: interaction.data?.sourceId ?? null, playerId: interaction.playerId ?? null } : null;
    }, { timeout: 8000 }).toEqual({ sourceId: 'smashup_duel_deputy_card', playerId: '0' });
    await expect(page.getByText(deputyPromptText)).toBeVisible({ timeout: 8000 });
    await saveEvidenceScreenshot(page, testInfo, 'oops-duel-deputy-card-prompt');
    await page.locator('[data-card-uid="deputy-1"]').click({ force: true });

    await expect.poll(async () => (await getCurrentInteraction(page))?.data?.sourceId ?? null).toBe('smashup_duel_deputy_target');
    await expectDuelParticipantMinions(page, ['gun-1', 'enemy-1']);
    await saveEvidenceScreenshot(page, testInfo, 'oops-duel-deputy-target-prompt');
    await clickSelectableMinion(page, 'gun-1');

    await expect.poll(async () => {
        const state = await game.getState();
        return {
            enemyGone: !state.core.bases[0].minions.some((minion: any) => minion.uid === 'enemy-1'),
            deputyDiscarded: state.core.players['0'].discard.some((card: any) => card.uid === 'deputy-1'),
            activeDuel: state.core.activeDuel ?? null,
        };
    }, { timeout: 8000 }).toEqual({
        enemyGone: true,
        deputyDiscarded: true,
        activeDuel: null,
    });
    await expect(page.getByText(duelBannerText)).toHaveCount(0);
    await expect(page.locator('[data-duel-participant="true"]')).toHaveCount(0);

    await saveEvidenceScreenshot(page, testInfo, 'oops-duel-after-resolve');
});

test('Oops Samurai 额外出牌效果应在浏览器中兑现额外随从与行动额度', async ({ page, game }, testInfo) => {
    test.setTimeout(60000);

    await game.openTestGame('smashup');
    await game.setupScene({
        gameId: 'smashup',
        player0: {
            factions: ['samurai', 'cowboys'],
            hand: [
                { uid: 'yokai-1', defId: 'samurai_yokai_attack', type: 'action' },
            ],
            deck: [],
            discard: [],
            field: [
                { uid: 'ally-1', defId: 'samurai_ronin', baseIndex: 0, owner: '0', controller: '0', power: 3 },
            ],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
        },
        player1: {
            factions: ['vikings', 'robots'],
            hand: [],
            deck: [],
            discard: [],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
        },
        currentPlayer: '0',
        phase: 'playCards',
        bases: [{ defId: 'base_a' }],
        extra: {
            core: {
                turnOrder: ['0', '1'],
                turnNumber: 1,
                nextUid: 7000,
            },
        },
    });

    await waitForSmashUpUI(page);
    await page.locator('[data-testid="su-hand-area"] [data-card-uid="yokai-1"]').click({ force: true });
    await dismissSpotlightIfVisible(page);
    await expect.poll(async () => (await getCurrentInteraction(page))?.data?.sourceId ?? null).toBe('samurai_yokai_attack');

    await waitForSelectableMinion(page, 'ally-1');
    await saveEvidenceScreenshot(page, testInfo, 'oops-extra-play-before-select');
    await clickSelectableMinion(page, 'ally-1');

    await expect.poll(async () => (await getCurrentInteraction(page))?.data?.sourceId ?? null, { timeout: 8000 }).toBe(null);

    await expect.poll(async () => {
        const state = await game.getState();
        return {
            allyGone: !state.core.bases[0].minions.some((minion: any) => minion.uid === 'ally-1'),
            actionDiscarded: state.core.players['0'].discard.some((card: any) => card.uid === 'yokai-1'),
            handEmpty: state.core.players['0'].hand.length === 0,
            minionLimit: state.core.players['0'].minionLimit,
            actionLimit: state.core.players['0'].actionLimit,
        };
    }, { timeout: 8000 }).toEqual({
        allyGone: true,
        actionDiscarded: true,
        handEmpty: true,
        minionLimit: 2,
        actionLimit: 2,
    });

    await saveEvidenceScreenshot(page, testInfo, 'oops-extra-play-after-resolve');
});

test('在线模式对手打出行动卡时应显示瞬时行动卡展示且不生成关闭队列', async ({ browser }, testInfo) => {
    test.setTimeout(120000);

    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const firstSetup = await setupSmashUpMatchSkipSetup(browser, baseURL);
    if (!firstSetup) {
        test.skip(true, 'SmashUp 联机房间创建失败');
        return;
    }

    try {
        const { hostPage, guestPage } = firstSetup;
        await applyOnlineMatchState(firstSetup.matchId, hostPage, (state) => buildActionSpotlightState(state, 0));
        await waitForSmashUpUI(hostPage);
        await waitForSmashUpUI(guestPage);
        await waitForTurnTracker(hostPage, 'YOU');
        await waitForTurnTracker(guestPage, 'OPP');

        const hostSpotlightQueue = hostPage.getByTestId('card-spotlight-queue');

        const hostActionUid = await getPlayerActionUid(hostPage, '0', 'wizard_mystic_studies');
        expect(hostActionUid).toBeTruthy();
        await playActionCardWithoutTargetByUi(hostPage, firstSetup.matchId, '0', hostActionUid);
        await expectActionFxAutoDismisses(guestPage, 'wizard_mystic_studies');
        await expect(hostSpotlightQueue).toHaveCount(0);
        await saveEvidenceScreenshot(guestPage, testInfo, 'action-fx-auto-dismissed-online-p0');
    } finally {
        await firstSetup.guestContext.close();
        await firstSetup.hostContext.close();
    }

    const secondSetup = await setupSmashUpMatchSkipSetup(browser, baseURL);
    if (!secondSetup) {
        test.skip(true, 'SmashUp 联机房间创建失败（P1 场景）');
        return;
    }

    try {
        const { hostPage, guestPage } = secondSetup;
        await applyOnlineMatchState(secondSetup.matchId, hostPage, (state) => buildActionSpotlightState(state, 1));
        await waitForSmashUpUI(hostPage);
        await waitForSmashUpUI(guestPage);
        await waitForTurnTracker(hostPage, 'OPP');
        await waitForTurnTracker(guestPage, 'YOU');

        const hostSpotlightQueue = hostPage.getByTestId('card-spotlight-queue');
        const guestSpotlightQueue = guestPage.getByTestId('card-spotlight-queue');

        const guestActionUid = await getPlayerActionUid(guestPage, '1', 'wizard_mystic_studies');
        expect(guestActionUid).toBeTruthy();
        await playActionCardWithoutTargetByUi(guestPage, secondSetup.matchId, '1', guestActionUid);
        await expectActionFxAutoDismisses(hostPage, 'wizard_mystic_studies');
        await expect(guestSpotlightQueue).toHaveCount(0);
        await saveEvidenceScreenshot(hostPage, testInfo, 'action-fx-auto-dismissed-online-p1');
        await expect(hostSpotlightQueue).toHaveCount(0);
    } finally {
        await secondSetup.guestContext.close();
        await secondSetup.hostContext.close();
    }
});

test('在线双人非目标页在 prompt 打开与权威关闭后都不应残留 waiting overlay', async ({ browser }, testInfo) => {
    test.setTimeout(120000);

    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const setup = await setupSmashUpMatchSkipSetup(browser, baseURL);
    if (!setup) {
        test.skip(true, 'SmashUp 联机房间创建失败');
        return;
    }

    try {
        const { hostPage, guestPage, matchId } = setup;
        const waitingText = /正在等待\s*Host-SU-E2E|Waiting for\s*Host-SU-E2E/i;

        await applyOnlineMatchState(matchId, hostPage, buildOnlineSharedVisibleWaitingPromptState);
        await waitForSmashUpUI(hostPage);
        await waitForSmashUpUI(guestPage);

        await expect(hostPage.getByRole('button', { name: /确认|Confirm/i })).toBeVisible({ timeout: 15000 });
        await expect.poll(async () => {
            return guestPage.evaluate(() => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return {
                    currentId: state?.sys?.interaction?.current?.id ?? null,
                    isBlocked: state?.sys?.interaction?.isBlocked ?? null,
                };
            });
        }, {
            timeout: 15000,
            message: '等待 Guest 非目标页收到过滤后的 prompt 打开态',
        }).toEqual({
            currentId: null,
            isBlocked: true,
        });
        await expect(guestPage.getByText(waitingText)).toHaveCount(0, { timeout: 15000 });
        await saveEvidenceScreenshot(guestPage, testInfo, 'online-waiting-overlay-open-filtered-nontarget');

        await applyOnlineMatchState(matchId, hostPage, buildOnlineClosedPromptState);

        await expect.poll(async () => {
            return guestPage.evaluate(() => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return {
                    currentId: state?.sys?.interaction?.current?.id ?? null,
                    isBlocked: state?.sys?.interaction?.isBlocked ?? null,
                };
            });
        }, {
            timeout: 15000,
            message: '等待 Host 页面收到 prompt 权威关闭态',
        }).toEqual({
            currentId: null,
            isBlocked: false,
        });

        await expect(guestPage.getByText(waitingText)).toHaveCount(0, { timeout: 15000 });
        await saveEvidenceScreenshot(guestPage, testInfo, 'online-waiting-overlay-after-authoritative-close');
    } finally {
        await setup.guestContext.close();
        await setup.hostContext.close();
    }
});

test('回归：在线 AI 在 factionSelect 阶段 seat state 延迟就绪时，不得被 watchdog 跳过到空牌对局', async ({ browser }, testInfo) => {
    test.setTimeout(180000);

    const baseURL = testInfo.project.use.baseURL as string | undefined;
    let delayedAiClaimCount = 0;
    const setup = await setupSmashUpOnlineAiRoom(browser, baseURL, {
        seatControllers: {
            '1': {
                type: 'local-ai',
                difficulty: 'expert',
                minimumActionDelayMs: 150,
            },
        },
        beforeEnterMatch: async ({ hostPage, matchId }) => {
            await hostPage.route(`**/games/smashup/${matchId}/claim-seat`, async (route) => {
                const postData = route.request().postDataJSON?.() as { playerID?: string } | undefined;
                if (route.request().method() === 'POST' && postData?.playerID === '1') {
                    delayedAiClaimCount += 1;
                    await new Promise((resolve) => setTimeout(resolve, 10_000));
                }
                await route.continue();
            });
        },
    });
    if (!setup) {
        test.skip(true, 'SmashUp AI 联机房间创建失败');
        return;
    }

    try {
        const { hostPage, matchId } = setup;
        const factionHeading = hostPage.getByText('选择你的派系');
        await expect(factionHeading).toBeVisible({ timeout: 15000 });

        await selectFaction(hostPage, 0);
        await saveEvidenceScreenshot(hostPage, testInfo, 'online-ai-faction-select-host-picked-first');

        await hostPage.waitForTimeout(8800);

        const stalledState = await getMatchState(matchId, hostPage);
        expect(delayedAiClaimCount).toBeGreaterThan(0);
        expect(stalledState.sys?.phase).toBe('factionSelect');
        expect(stalledState.core?.factionSelection).toBeTruthy();
        expect(stalledState.core?.factionSelection?.playerSelections?.['0']?.length ?? 0).toBe(1);
        expect(stalledState.core?.players?.['0']?.factions ?? []).toEqual(['', '']);
        expect(stalledState.core?.players?.['1']?.factions ?? []).toEqual(['', '']);
        expect(stalledState.core?.players?.['0']?.hand?.length ?? 0).toBe(0);
        expect(stalledState.core?.players?.['1']?.hand?.length ?? 0).toBe(0);
        await saveEvidenceScreenshot(hostPage, testInfo, 'online-ai-faction-select-still-waiting-after-watchdog');

        await waitForAiSeatCredential(hostPage, matchId, '1');

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            return {
                phase: state.sys?.phase ?? null,
                currentPlayerIndex: state.core?.currentPlayerIndex ?? null,
                hostPicks: state.core?.factionSelection?.playerSelections?.['0']?.length ?? 0,
                aiPicks: state.core?.factionSelection?.playerSelections?.['1']?.length ?? 0,
            };
        }, {
            timeout: 30000,
            message: '等待 AI 在 seat 建连后补完两次派系选择并把选秀权交还房主',
        }).toEqual({
            phase: 'factionSelect',
            currentPlayerIndex: 0,
            hostPicks: 1,
            aiPicks: 2,
        });
        await saveEvidenceScreenshot(hostPage, testInfo, 'online-ai-faction-select-ai-picked-twice');

        const stateBeforeHostSecondPick = await getMatchState(matchId, hostPage);
        const takenFactions = new Set(stateBeforeHostSecondPick.core?.factionSelection?.takenFactions ?? []);
        const hostSecondFactionId = Object.values(SMASHUP_FACTION_IDS).find((factionId) => (
            factionId !== SMASHUP_FACTION_IDS.MADNESS && !takenFactions.has(factionId)
        ));
        expect(hostSecondFactionId).toBeTruthy();
        await hostPage.evaluate(async ({ factionId }) => {
            await window.__BG_TEST_HARNESS__!.command.dispatch({
                type: 'su:select_faction',
                playerId: '0',
                payload: { factionId },
            });
        }, { factionId: hostSecondFactionId! });

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            const hostFactions = state.core?.players?.['0']?.factions ?? [];
            const aiFactions = state.core?.players?.['1']?.factions ?? [];
            return {
                phase: state.sys?.phase ?? null,
                factionSelection: state.core?.factionSelection ?? null,
                hostFactionsFilled: hostFactions.every((item: string) => Boolean(item)),
                aiFactionsFilled: aiFactions.every((item: string) => Boolean(item)),
                hostHand: state.core?.players?.['0']?.hand?.length ?? 0,
                aiHand: state.core?.players?.['1']?.hand?.length ?? 0,
                hostDeck: state.core?.players?.['0']?.deck?.length ?? 0,
                aiDeck: state.core?.players?.['1']?.deck?.length ?? 0,
            };
        }, {
            timeout: 30000,
            message: '等待选秀完成后正常进入对局并初始化双方牌组',
        }).toEqual({
            phase: 'playCards',
            factionSelection: null,
            hostFactionsFilled: true,
            aiFactionsFilled: true,
            hostHand: 5,
            aiHand: 5,
            hostDeck: 35,
            aiDeck: 35,
        });

        await waitForSmashUpUI(hostPage);
        await saveEvidenceScreenshot(hostPage, testInfo, 'online-ai-faction-select-final-playcards');
    } finally {
        await setup.hostContext.close();
    }
});

test('在线 AI 持有隐藏交互时应自动 batch 响应并推进状态', async ({ browser }, testInfo) => {
    test.setTimeout(120000);

    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const setup = await setupSmashUpOnlineAiRoom(browser, baseURL);
    if (!setup) {
        test.skip(true, 'SmashUp AI 联机房间创建失败');
        return;
    }

    try {
        const { hostPage, matchId } = setup;
        await waitForAiSeatCredential(hostPage, matchId, '1');

        await applyOnlineMatchState(matchId, hostPage, buildOnlineAiHiddenSacrificeState);
        await waitForSmashUpUI(hostPage);

        await expect(hostPage.getByText('选择要牺牲的随从（抽取等量力量的牌）')).toHaveCount(0);

        await saveEvidenceScreenshot(hostPage, testInfo, 'online-ai-hidden-choice-before-resolve');

        await expect.poll(async () => {
            return await hostPage.evaluate(() => {
                const debugState = window.__BG_ONLINE_AI_DEBUG__?.getSeatDecisionState('1') ?? null;
                const stage = typeof debugState?.stage === 'string' ? debugState.stage : null;
                return {
                    stage,
                    blockedReason: typeof debugState?.blockedReason === 'string' ? debugState.blockedReason : null,
                    idleReason: typeof debugState?.idleReason === 'string' ? debugState.idleReason : null,
                    sawDecision: [
                        'action',
                        'submitted',
                        'confirmed',
                        'rejected',
                        'duplicate-attempt-suppressed',
                        'stale-attempt-released',
                        'server-authority-observed',
                    ].includes(stage ?? ''),
                };
            });
        }, {
            timeout: 8000,
            message: '等待在线 AI 至少进入一次决策/提交阶段',
        }).toMatchObject({
            blockedReason: null,
            idleReason: null,
            sawDecision: true,
        });

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            return {
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                interactionPlayerId: state.sys?.interaction?.current?.playerId ?? null,
                minionsOnBase: state.core?.bases?.[0]?.minions?.map((minion: any) => minion.uid) ?? [],
                aiHandDefIds: state.core?.players?.['1']?.hand?.map((card: any) => card.defId) ?? [],
                aiDeckCount: state.core?.players?.['1']?.deck?.length ?? -1,
            };
        }, {
            timeout: 20000,
            message: '等待在线 AI 自动响应隐藏交互并完成结算',
        }).toEqual({
            interactionSourceId: null,
            interactionPlayerId: null,
            minionsOnBase: [],
            aiHandDefIds: ['wizard_archmage', 'wizard_apprentice', 'wizard_enchantress'],
            aiDeckCount: 0,
        });

        await expect.poll(async () => {
            return hostPage.locator('[data-minion-uid="ai-sacrifice-target"]').count();
        }, { timeout: 8000 }).toBe(0);

        await saveEvidenceScreenshot(hostPage, testInfo, 'online-ai-hidden-choice-after-resolve');
    } finally {
        await setup.hostContext.close();
    }
});

test('在线 AI 在三基地并发达标场景下应完成 multi_base_scoring 收口且不出现卡死', async ({ browser }, testInfo) => {
    test.setTimeout(150000);

    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const setup = await setupSmashUpOnlineAiRoom(browser, baseURL, {
        seatControllers: {
            '1': {
                type: 'local-ai',
                difficulty: 'expert',
                minimumActionDelayMs: 150,
            },
        },
    });
    if (!setup) {
        test.skip(true, 'SmashUp AI 联机房间创建失败');
        return;
    }

    try {
        const { hostPage, matchId } = setup;
        await waitForAiSeatCredential(hostPage, matchId, '1');
        await applyOnlineMatchState(matchId, hostPage, buildOnlineAiComplexMultiBaseScoringState);
        await waitForSmashUpUI(hostPage);
        await hostPage.evaluate(() => {
            const win = window as Window & {
                __SU_AI_MULTI_BASE_TRACK__?: Array<{
                    phase: string | null;
                    currentPlayerIndex: number | null;
                    timestamp: number;
                }>;
                __SU_AI_MULTI_BASE_TRACK_TIMER__?: number;
            };
            const sample = () => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                const phase = state?.sys?.phase ?? null;
                const currentPlayerIndex = typeof state?.core?.currentPlayerIndex === 'number'
                    ? state.core.currentPlayerIndex
                    : null;
                const track = win.__SU_AI_MULTI_BASE_TRACK__ ?? [];
                track.push({
                    phase,
                    currentPlayerIndex,
                    timestamp: Date.now(),
                });
                if (track.length > 800) {
                    track.shift();
                }
                win.__SU_AI_MULTI_BASE_TRACK__ = track;
            };
            if (typeof win.__SU_AI_MULTI_BASE_TRACK_TIMER__ === 'number') {
                window.clearInterval(win.__SU_AI_MULTI_BASE_TRACK_TIMER__);
            }
            win.__SU_AI_MULTI_BASE_TRACK__ = [];
            sample();
            win.__SU_AI_MULTI_BASE_TRACK_TIMER__ = window.setInterval(sample, 80);
        });

        const injectedState = await getMatchState(matchId, hostPage);
        expect(['scoreBases', 'playCards']).toContain(injectedState.sys?.phase);

        await saveEvidenceScreenshot(hostPage, testInfo, 'online-ai-multi-base-before');

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            const interactionCurrent = state.sys?.interaction?.current ?? null;
            const responseWindowCurrent = state.sys?.responseWindow?.current ?? null;
            const vp0 = state.core?.players?.['0']?.vp ?? 0;
            const vp1 = state.core?.players?.['1']?.vp ?? 0;
            return {
                phase: state.sys?.phase ?? null,
                interactionSourceId: interactionCurrent?.data?.sourceId ?? null,
                interactionPlayerId: interactionCurrent?.playerId ?? null,
                responseWindowType: responseWindowCurrent?.windowType ?? null,
                vp0AtLeast5: vp0 >= 5,
                vp1AtLeast7: vp1 >= 7,
            };
        }, {
            timeout: 45000,
            message: '等待在线 AI 在三基地并发达标场景中完成计分并收口回到 playCards',
        }).toEqual({
            phase: 'playCards',
            interactionSourceId: null,
            interactionPlayerId: null,
            responseWindowType: null,
            vp0AtLeast5: true,
            vp1AtLeast7: true,
        });

        const track = await hostPage.evaluate(() => {
            const win = window as Window & {
                __SU_AI_MULTI_BASE_TRACK__?: Array<{
                    phase: string | null;
                    currentPlayerIndex: number | null;
                    timestamp: number;
                }>;
                __SU_AI_MULTI_BASE_TRACK_TIMER__?: number;
            };
            if (typeof win.__SU_AI_MULTI_BASE_TRACK_TIMER__ === 'number') {
                window.clearInterval(win.__SU_AI_MULTI_BASE_TRACK_TIMER__);
                win.__SU_AI_MULTI_BASE_TRACK_TIMER__ = undefined;
            }
            return win.__SU_AI_MULTI_BASE_TRACK__ ?? [];
        });
        const playCardsTrack = track.filter((item: {
            phase: string | null;
            currentPlayerIndex: number | null;
            timestamp: number;
        }) => item.phase === 'playCards' && typeof item.currentPlayerIndex === 'number');
        let swaps = 0;
        for (let i = 1; i < playCardsTrack.length; i += 1) {
            if (playCardsTrack[i].currentPlayerIndex !== playCardsTrack[i - 1].currentPlayerIndex) {
                swaps += 1;
            }
        }
        expect(swaps).toBeLessThanOrEqual(1);

        await saveEvidenceScreenshot(hostPage, testInfo, 'online-ai-multi-base-after');
        await expect(hostPage.getByText(/AI 响应超时|AI 强制结束失败/)).toHaveCount(0);
    } finally {
        await setup.hostContext.close();
    }
});

test('在线 AI 的盘旋机器人隐藏交互卡住时，应在 4 秒后自动跳过并恢复对局', async ({ browser }, testInfo) => {
    test.setTimeout(120000);

    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const setup = await setupSmashUpOnlineAiRoom(browser, baseURL);
    if (!setup) {
        test.skip(true, 'SmashUp AI 联机房间创建失败');
        return;
    }

    try {
        const { hostPage, matchId } = setup;
        await waitForAiSeatCredential(hostPage, matchId, '1');
        await installSmashUpAiChoiceRejectPatch(hostPage, { targetPlayerId: '1' });

        await applyOnlineMatchState(matchId, hostPage, buildOnlineAiHiddenHoverbotState);
        await waitForSmashUpUI(hostPage);

        await expect(hostPage.getByText('牌库顶是 cards.robot_zapbot.name（力量 2），是否作为额外随从打出？')).toHaveCount(0);

        await expect.poll(async () => {
            return hostPage.evaluate(() => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return {
                    interactionPlayerId: state?.sys?.interaction?.current?.playerId ?? null,
                    isBlocked: state?.sys?.interaction?.isBlocked ?? null,
                    baseMinions: state?.core?.bases?.[0]?.minions?.map((minion: any) => minion.uid) ?? [],
                };
            });
        }, {
            timeout: 10000,
            message: '等待房主视角进入“隐藏交互阻塞但无可见 prompt”状态',
        }).toEqual({
            interactionPlayerId: null,
            isBlocked: true,
            baseMinions: ['ai-hoverbot-on-base'],
        });

        await expect.poll(async () => {
            return (await readSmashUpAiChoiceRejectPatchStatus(hostPage))?.rejectedCount ?? 0;
        }, {
            timeout: 10000,
            message: '等待 AI seat 至少尝试一次 hoverbot 隐藏交互',
        }).toBeGreaterThan(0);

        const patchStatusAfterAutoSkip = await readSmashUpAiChoiceRejectPatchStatus(hostPage);
        expect(patchStatusAfterAutoSkip?.rejectedCount ?? 0).toBeGreaterThan(0);

        await expect.poll(async () => {
            return (await readSmashUpAiChoiceRejectPatchStatus(hostPage))?.forceSkipDelegated ?? false;
        }, {
            timeout: 20000,
            message: '等待 4 秒自动跳过委托标记生效',
        }).toBe(true);

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            return {
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                interactionPlayerId: state.sys?.interaction?.current?.playerId ?? null,
                baseMinions: state.core?.bases?.[0]?.minions?.map((minion: any) => minion.uid) ?? [],
                deckTop: state.core?.players?.['1']?.deck?.[0]?.defId ?? null,
            };
        }, {
            timeout: 20000,
            message: '等待 4 秒自动跳过提交成功并解除隐藏交互',
        }).toEqual({
            interactionSourceId: null,
            interactionPlayerId: null,
            baseMinions: ['ai-hoverbot-on-base'],
            deckTop: 'robot_zapbot',
        });

        await expect.poll(async () => {
            return hostPage.evaluate(() => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return {
                    interactionPlayerId: state?.sys?.interaction?.current?.playerId ?? null,
                    isBlocked: state?.sys?.interaction?.isBlocked ?? null,
                    currentPlayerIndex: state?.core?.currentPlayerIndex ?? null,
                    toastVisible: Array.from(document.querySelectorAll('h4')).some((node) =>
                        node.textContent?.trim() === 'AI 响应超时'),
                };
            });
        }, {
            timeout: 10000,
            message: '等待强制跳过后房主解除阻塞并收起超时 toast',
        }).toMatchObject({
            interactionPlayerId: null,
            isBlocked: false,
            toastVisible: false,
        });

        const resolvedHoverbotState = await getMatchState(matchId, hostPage);
        expect([0, 1]).toContain(resolvedHoverbotState.core?.currentPlayerIndex ?? null);
        await expect(hostPage.getByText(/AI 强制结束失败/i)).toHaveCount(0);
        await saveEvidenceScreenshot(hostPage, testInfo, 'online-ai-hoverbot-force-skip-after-resolve');
    } finally {
        await setup.hostContext.close();
    }
});

test('在线 AI 持有真实响应牌时，应在 meFirst 响应窗口内自动响应而不卡死', async ({ browser }, testInfo) => {
    test.setTimeout(120000);

    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const setup = await setupSmashUpOnlineAiRoom(browser, baseURL);
    if (!setup) {
        test.skip(true, 'SmashUp AI 联机房间创建失败');
        return;
    }

    try {
        const { hostPage, matchId } = setup;
        await waitForAiSeatCredential(hostPage, matchId, '1');

        await applyOnlineMatchState(matchId, hostPage, buildOnlineAiResponseWindowPlayableState);
        await waitForSmashUpUI(hostPage);

        const injectedState = await getMatchState(matchId, hostPage);
        const injectedHostHand = injectedState.core?.players?.['0']?.hand as Array<{ defId?: string }> | undefined;
        const injectedAiHand = injectedState.core?.players?.['1']?.hand as Array<{ defId?: string }> | undefined;
        const injectedPrimaryBaseMinions = injectedState.core?.bases?.[0]?.minions as Array<{ uid?: string; powerCounters?: number }> | undefined;
        const injectedSecondaryBaseMinions = injectedState.core?.bases?.[1]?.minions as Array<{ uid?: string; powerCounters?: number }> | undefined;
        expect(injectedState.core?.currentPlayerIndex).toBe(0);
        expect(injectedState.sys?.phase).toBe('playCards');
        expect(injectedState.sys?.responseWindow?.current ?? null).toBeNull();
        expect(injectedHostHand?.map((card) => card.defId)).toEqual(['giant_ant_under_pressure']);
        expect(injectedAiHand?.map((card) => card.defId)).toEqual(['giant_ant_under_pressure']);
        expect(injectedPrimaryBaseMinions?.find((minion) => minion.uid === 'host-under-pressure-source')?.powerCounters).toBe(2);
        expect(injectedPrimaryBaseMinions?.find((minion) => minion.uid === 'ai-under-pressure-source')?.powerCounters).toBe(1);
        expect(injectedSecondaryBaseMinions?.find((minion) => minion.uid === 'host-under-pressure-target')?.powerCounters).toBe(0);
        expect(injectedSecondaryBaseMinions?.find((minion) => minion.uid === 'ai-under-pressure-target')?.powerCounters).toBe(0);

        await dispatchHarnessCommand(hostPage, '0', 'ADVANCE_PHASE', {});

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            const responseWindow = state.sys?.responseWindow?.current ?? null;
            return {
                windowType: responseWindow?.windowType ?? null,
                currentResponder: responseWindow?.responderQueue?.[responseWindow.currentResponderIndex] ?? null,
            };
        }, {
            timeout: 10000,
            message: '等待真实推进到计分阶段后打开 meFirst 响应窗口',
        }).toEqual({
            windowType: 'meFirst',
            currentResponder: '0',
        });

        await saveEvidenceScreenshot(hostPage, testInfo, 'online-ai-response-window-playable-host-first');

        await respondCurrentInteraction(hostPage, { optionId: 'pass' });

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            const responseWindow = state.sys?.responseWindow?.current ?? null;
            const currentResponder = responseWindow?.responderQueue?.[responseWindow.currentResponderIndex] ?? null;
            const aiHand = state.core?.players?.['1']?.hand as Array<{ defId?: string }> | undefined;
            const aiDiscard = state.core?.players?.['1']?.discard as Array<{ defId?: string }> | undefined;
            const aiHandDefIds = aiHand?.map((card) => card.defId).filter(Boolean) ?? [];
            const aiDiscardDefIds = aiDiscard?.map((card) => card.defId).filter(Boolean) ?? [];
            const interactionSourceId = state.sys?.interaction?.current?.data?.sourceId ?? null;
            const interactionPlayerId = state.sys?.interaction?.current?.playerId ?? null;
            return currentResponder === '1'
                || interactionPlayerId === '1'
                || interactionSourceId === 'giant_ant_under_pressure_choose_source'
                || interactionSourceId === 'giant_ant_under_pressure_choose_target'
                || interactionSourceId === 'giant_ant_under_pressure_choose_amount'
                || aiDiscardDefIds.includes('giant_ant_under_pressure')
                || !aiHandDefIds.includes('giant_ant_under_pressure');
        }, {
            timeout: 8000,
            message: '等待房主 pass 后 AI 接手响应窗口并开始推进',
        }).toBe(true);

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            const responseWindow = state.sys?.responseWindow?.current ?? null;
            const currentResponder = responseWindow?.responderQueue?.[responseWindow.currentResponderIndex] ?? null;
            const hostHand = state.core?.players?.['0']?.hand as Array<{ defId?: string }> | undefined;
            const aiHand = state.core?.players?.['1']?.hand as Array<{ defId?: string }> | undefined;
            const aiDiscard = state.core?.players?.['1']?.discard as Array<{ defId?: string }> | undefined;
            const primaryBaseMinions = state.core?.bases?.[0]?.minions as Array<{ uid?: string; powerCounters?: number }> | undefined;
            const secondaryBaseMinions = state.core?.bases?.[1]?.minions as Array<{ uid?: string; powerCounters?: number }> | undefined;
            const hostHandDefIds = hostHand?.map((card) => card.defId).filter(Boolean) ?? [];
            const aiHandDefIds = aiHand?.map((card) => card.defId).filter(Boolean) ?? [];
            const aiDiscardDefIds = aiDiscard?.map((card) => card.defId).filter(Boolean) ?? [];
            const sourceCounters = primaryBaseMinions?.find((minion) => minion.uid === 'ai-under-pressure-source')?.powerCounters ?? null;
            const targetCounters = secondaryBaseMinions?.find((minion) => minion.uid === 'ai-under-pressure-target')?.powerCounters ?? null;
            return {
                currentPlayerIndex: state.core?.currentPlayerIndex ?? null,
                responseWindowId: responseWindow?.id ?? null,
                currentResponder,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                interactionPlayerId: state.sys?.interaction?.current?.playerId ?? null,
                hostHandDefIds,
                aiHandDefIds,
                aiDiscardDefIds,
                sourceCounters,
                targetCounters,
            };
        }, {
            timeout: 12000,
            message: '等待在线 AI 在响应窗口打出承受压力并完成后续选择',
        }).toMatchObject({
            currentPlayerIndex: 0,
            responseWindowId: expect.stringContaining('smashup_reaction_window_'),
            currentResponder: '0',
            interactionSourceId: 'smashup_reaction_choose',
            interactionPlayerId: '0',
            hostHandDefIds: ['giant_ant_under_pressure'],
            aiHandDefIds: [],
            aiDiscardDefIds: ['giant_ant_under_pressure'],
            sourceCounters: 0,
            targetCounters: 1,
        });

        await saveEvidenceScreenshot(hostPage, testInfo, 'online-ai-response-window-playable-after-ai-response');
        await respondCurrentInteraction(hostPage, { optionId: 'pass' });

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            const responseWindow = state.sys?.responseWindow?.current ?? null;
            return {
                responseWindowId: responseWindow?.id ?? null,
                currentResponder: responseWindow?.responderQueue?.[responseWindow.currentResponderIndex] ?? null,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                interactionPlayerId: state.sys?.interaction?.current?.playerId ?? null,
            };
        }, {
            timeout: 8000,
            message: '等待房主在 AI 响应后 pass 一次，统一反应窗口最终收口',
        }).toEqual({
            responseWindowId: null,
            currentResponder: null,
            interactionSourceId: null,
            interactionPlayerId: null,
        });

        await expect(hostPage.getByTestId('me-first-overlay')).toHaveCount(0);
        await expect(hostPage.getByText('AI 响应超时')).toHaveCount(0);
        await expect(hostPage.getByText('AI 自动跳过。')).toHaveCount(0);
        await expect(hostPage.getByText(/AI 强制结束失败/i)).toHaveCount(0);
        await saveEvidenceScreenshot(hostPage, testInfo, 'online-ai-response-window-playable-after-resolve');
    } finally {
        await setup.hostContext.close();
    }
});

test('在线四人（1人+3AI）在计分响应窗口中应出现完整轮转且不卡死', async ({ browser }, testInfo) => {
    test.setTimeout(240000);

    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const setup = await setupSmashUpOnlineAiRoom(browser, baseURL, {
        numPlayers: 4,
        seatControllers: {
            '1': {
                type: 'local-ai',
                difficulty: 'expert',
                minimumActionDelayMs: 60,
            },
            '2': {
                type: 'local-ai',
                difficulty: 'expert',
                minimumActionDelayMs: 60,
            },
            '3': {
                type: 'local-ai',
                difficulty: 'expert',
                minimumActionDelayMs: 60,
            },
        },
    });
    if (!setup) {
        test.skip(true, 'SmashUp 四人 AI 联机房间创建失败');
        return;
    }

    try {
        const { hostPage, matchId } = setup;
        await waitForAiSeatCredential(hostPage, matchId, '1');
        await waitForAiSeatCredential(hostPage, matchId, '2');
        await waitForAiSeatCredential(hostPage, matchId, '3');
        await installSmashUpAiResponsePassPatch(hostPage, ['1', '2', '3']);

        await applyOnlineMatchState(matchId, hostPage, buildOnlineAiFourPlayerResponseWindowStressState);
        await waitForSmashUpUI(hostPage);

        const injectedState = await getMatchState(matchId, hostPage);
        expect(injectedState.core?.turnOrder).toEqual(['0', '1', '2', '3']);
        expect(injectedState.core?.currentPlayerIndex).toBe(0);
        for (const pid of ['0', '1', '2', '3'] as const) {
            const hand = (injectedState.core?.players?.[pid]?.hand ?? []) as Array<{ defId?: string }>;
            const responseCardCount = hand.filter((card) => card.defId === 'pirate_full_sail').length;
            expect(responseCardCount).toBeGreaterThanOrEqual(2);
        }

        await saveEvidenceScreenshot(hostPage, testInfo, 'online-ai-4p-response-rotation-before');

        await hostPage.evaluate(() => {
            const win = window as Window & {
                __SU_RESPONSE_ROTATION_TRACK__?: string[];
                __SU_RESPONSE_ROTATION_TIMER__?: number;
            };
            const sample = () => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                const rw = state?.sys?.responseWindow?.current;
                const responder = rw?.responderQueue?.[rw?.currentResponderIndex ?? 0];
                if (typeof responder === 'string') {
                    const track = win.__SU_RESPONSE_ROTATION_TRACK__ ?? [];
                    track.push(responder);
                    if (track.length > 2000) {
                        track.shift();
                    }
                    win.__SU_RESPONSE_ROTATION_TRACK__ = track;
                }
            };
            if (typeof win.__SU_RESPONSE_ROTATION_TIMER__ === 'number') {
                window.clearInterval(win.__SU_RESPONSE_ROTATION_TIMER__);
            }
            win.__SU_RESPONSE_ROTATION_TRACK__ = [];
            sample();
            win.__SU_RESPONSE_ROTATION_TIMER__ = window.setInterval(sample, 40);
        });

        await dispatchHarnessCommand(hostPage, '0', 'ADVANCE_PHASE', {});

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            const responseWindow = state.sys?.responseWindow?.current ?? null;
            return {
                phase: state.sys?.phase ?? null,
                responseWindow,
            };
        }, {
            timeout: 15000,
            message: '等待四人计分响应窗口打开',
        }).toMatchObject({
            phase: 'scoreBases',
            responseWindow: {
                windowType: 'meFirst',
            },
        });
        const openedState = await getMatchState(matchId, hostPage);
        const openedResponseWindow = (openedState as unknown as {
            sys?: {
                responseWindow?: {
                    current?: {
                        responderQueue?: string[];
                        currentResponderIndex?: number;
                    } | null;
                };
            };
        }).sys?.responseWindow?.current ?? null;
        const openedResponderQueue = openedResponseWindow?.responderQueue ?? [];
        const openedCurrentResponder = openedResponderQueue[openedResponseWindow?.currentResponderIndex ?? 0] ?? null;
        expect(openedResponderQueue.length).toBe(4);
        expect(openedCurrentResponder).toBe('0');
        expect(openedResponderQueue.includes('1')).toBe(true);
        expect(openedResponderQueue.includes('2')).toBe(true);
        expect(openedResponderQueue.includes('3')).toBe(true);
        console.log('[4p-response] openedResponderQueue=', JSON.stringify(openedResponderQueue));

        let responseClosed = false;
        let sawResponseWindow = false;
        for (let i = 0; i < 700; i += 1) {
            const state = await getMatchState(matchId, hostPage);
            const interactionCurrent = state.sys?.interaction?.current ?? null;
            if (interactionCurrent?.playerId === '0' && interactionCurrent?.data?.sourceId === 'smashup_reaction_choose') {
                try {
                    await respondCurrentInteraction(hostPage, { optionId: 'pass' });
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    if (!message.includes('当前没有可响应的交互')) {
                        throw error;
                    }
                }
                continue;
            }
            const responseWindow = state.sys?.responseWindow?.current ?? null;
            if (responseWindow) {
                sawResponseWindow = true;
            }
            if (!responseWindow) {
                if (sawResponseWindow && state.sys?.phase === 'playCards' && !interactionCurrent) {
                    responseClosed = true;
                    break;
                }
                await hostPage.waitForTimeout(120);
                continue;
            }
            const currentResponder = responseWindow.responderQueue?.[responseWindow.currentResponderIndex];
            if (currentResponder === '0') {
                await dispatchHarnessCommand(hostPage, '0', 'RESPONSE_PASS', {});
            } else {
                await hostPage.waitForTimeout(200);
            }
        }

        expect(responseClosed).toBe(true);

        const trackedResponderHistory = await hostPage.evaluate(() => {
            const win = window as Window & {
                __SU_RESPONSE_ROTATION_TRACK__?: string[];
                __SU_RESPONSE_ROTATION_TIMER__?: number;
            };
            if (typeof win.__SU_RESPONSE_ROTATION_TIMER__ === 'number') {
                window.clearInterval(win.__SU_RESPONSE_ROTATION_TIMER__);
                win.__SU_RESPONSE_ROTATION_TIMER__ = undefined;
            }
            return win.__SU_RESPONSE_ROTATION_TRACK__ ?? [];
        });
        const compactHistory = trackedResponderHistory.filter((id: string, idx: number) => (
            idx === 0 || id !== trackedResponderHistory[idx - 1]
        ));
        console.log('[4p-response] compactHistory=', JSON.stringify(compactHistory.slice(0, 80)));
        const hasSubsequence = (source: string[], target: string[]): boolean => {
            let pointer = 0;
            for (const item of source) {
                if (item === target[pointer]) {
                    pointer += 1;
                }
                if (pointer === target.length) {
                    return true;
                }
            }
            return false;
        };

        expect(compactHistory.includes('1')).toBe(true);
        expect(compactHistory.includes('2')).toBe(true);
        expect(compactHistory.includes('3')).toBe(true);
        expect(hasSubsequence(compactHistory, ['0', '1', '2', '3'])).toBe(true);

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            return {
                phase: state.sys?.phase ?? null,
                hasResponseWindow: Boolean(state.sys?.responseWindow?.current),
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
            };
        }, {
            timeout: 15000,
            message: '等待四人多段计分响应窗口全部收口并回到 playCards',
        }).toEqual({
            phase: 'playCards',
            hasResponseWindow: false,
            interactionSourceId: null,
        });
        const finalState = await getMatchState(matchId, hostPage);
        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            return state.sys?.interaction?.current?.data?.sourceId ?? null;
        }, {
            timeout: 10000,
            message: '等待四人响应链收口后清空房主残留交互',
        }).toBeNull();
        expect(finalState.sys?.phase).toBe('playCards');
        await expect(hostPage.getByText('AI 响应超时')).toHaveCount(0);
        await expect(hostPage.getByText('AI 自动跳过。')).toHaveCount(0);
        await expect(hostPage.getByText(/AI 强制结束失败/i)).toHaveCount(0);

        await saveEvidenceScreenshot(hostPage, testInfo, 'online-ai-4p-response-rotation-after');
    } finally {
        await setup.hostContext.close();
    }
});

test('在线 AI 连续 8 秒没有任何实际进展时，应自动强制结束当前回合', async ({ browser }, testInfo) => {
    test.setTimeout(120000);

    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const setup = await setupSmashUpOnlineAiRoom(browser, baseURL);
    if (!setup) {
        test.skip(true, 'SmashUp AI 联机房间创建失败');
        return;
    }

    try {
        const { hostPage, matchId } = setup;
        await waitForAiSeatCredential(hostPage, matchId, '1');
        await installSmashUpAiChoiceRejectPatch(hostPage, {
            targetPlayerId: '1',
            allowBatchKinds: ['force-end-turn'],
        });

        await applyOnlineMatchState(matchId, hostPage, buildOnlineAiHiddenSacrificeState);
        await waitForSmashUpUI(hostPage);

        await expect(hostPage.getByText('选择要牺牲的随从（抽取等量力量的牌）')).toHaveCount(0);

        await expect.poll(async () => {
            return hostPage.evaluate(() => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return {
                    interactionPlayerId: state?.sys?.interaction?.current?.playerId ?? null,
                    isBlocked: state?.sys?.interaction?.isBlocked ?? null,
                    currentPlayerIndex: state?.core?.currentPlayerIndex ?? null,
                    baseMinions: state?.core?.bases?.[0]?.minions?.map((minion: any) => minion.uid) ?? [],
                };
            });
        }, {
            timeout: 10000,
            message: '等待房主视角进入“隐藏交互阻塞但无可见 prompt”状态',
        }).toEqual({
            interactionPlayerId: null,
            isBlocked: true,
            currentPlayerIndex: 1,
            baseMinions: ['ai-sacrifice-target'],
        });

        await saveEvidenceScreenshot(hostPage, testInfo, 'online-ai-force-end-turn-before-timeout');

        await expect.poll(async () => {
            return (await readSmashUpAiChoiceRejectPatchStatus(hostPage))?.rejectedCount ?? 0;
        }, {
            timeout: 10000,
            message: '等待 AI seat 至少尝试一次 wizard sacrifice 隐藏交互',
        }).toBeGreaterThan(0);

        await expect(hostPage.getByText(/AI 强制结束失败/i)).toHaveCount(0);

        await expect.poll(async () => {
            return (await readSmashUpAiChoiceRejectPatchStatus(hostPage))?.forceEndTurnDelegated ?? false;
        }, {
            timeout: 20000,
            message: '等待 8 秒强制结束回合委托标记生效',
        }).toBe(true);

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            return {
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                interactionPlayerId: state.sys?.interaction?.current?.playerId ?? null,
                currentPlayerIndex: state.core?.currentPlayerIndex ?? null,
                baseMinions: state.core?.bases?.[0]?.minions?.map((minion: any) => minion.uid) ?? [],
            };
        }, {
            timeout: 20000,
            message: '等待 8 秒强制结束回合提交成功并切回房主',
        }).toEqual({
            interactionSourceId: null,
            interactionPlayerId: null,
            currentPlayerIndex: 0,
            baseMinions: ['ai-sacrifice-target'],
        });

        await expect.poll(async () => {
            return hostPage.evaluate(() => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return {
                    interactionPlayerId: state?.sys?.interaction?.current?.playerId ?? null,
                    isBlocked: state?.sys?.interaction?.isBlocked ?? null,
                    currentPlayerIndex: state?.core?.currentPlayerIndex ?? null,
                };
            });
        }, {
            timeout: 10000,
            message: '等待房主过滤视角解除阻塞并接回当前回合',
        }).toEqual({
            interactionPlayerId: null,
            isBlocked: false,
            currentPlayerIndex: 0,
        });

        await expect(
            hostPage.locator('[data-tutorial-id="su-turn-tracker"]').filter({ hasText: /你自己|YOU/i }),
        ).toBeVisible({ timeout: 8000 });
        await expect(hostPage.getByText(/AI 强制结束失败/i)).toHaveCount(0);
        await saveEvidenceScreenshot(hostPage, testInfo, 'online-ai-force-end-turn-after-resolve');
    } finally {
        await setup.hostContext.close();
    }
});

test('在线 AI 结束回合切回我方时不应出现整板重挂载或 loading 闪屏', async ({ browser }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL;
    const setup = await setupSmashUpOnlineAiRoom(browser, baseURL);
    if (!setup) {
        test.skip(true, 'SmashUp AI 联机房间创建失败');
        return;
    }

    const { hostPage, hostContext, matchId } = setup;

    try {
        await waitForAiSeatCredential(hostPage, matchId, '1');
        await installUiRefreshMonitor(hostPage);
        await applyOnlineMatchState(matchId, hostPage, buildOnlineAiPassTurnState);
        await waitForSmashUpUI(hostPage);
        await saveEvidenceScreenshot(hostPage, testInfo, 'online-ai-pass-turn-before-host-turn');

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            return {
                currentPlayerIndex: state.core?.currentPlayerIndex,
                turnNumber: state.core?.turnNumber,
                phase: state.sys?.phase,
            };
        }, {
            timeout: 12000,
            message: '等待 AI 自动结束回合并切回玩家 0',
        }).toMatchObject({
            currentPlayerIndex: 0,
        });

        await expect(hostPage.locator('[data-tutorial-id="su-turn-tracker"]')).toBeVisible({ timeout: 8000 });
        await hostPage.waitForTimeout(1200);
        await saveEvidenceScreenshot(hostPage, testInfo, 'online-ai-pass-turn-after-host-turn');

        const monitor = await readUiRefreshMonitor(hostPage) as {
            loadingVisibleSamples: number;
            samples: number;
            replacements: Record<string, number>;
            disconnects: Record<string, number>;
        };

        expect(monitor.loadingVisibleSamples).toBe(0);
        expect(monitor.replacements.turnTracker).toBe(0);
        expect(monitor.replacements.scoreboard).toBe(0);
        expect(monitor.replacements.handArea).toBe(0);
        expect(monitor.disconnects.turnTracker).toBe(0);
        expect(monitor.disconnects.scoreboard).toBe(0);
        expect(monitor.disconnects.handArea).toBe(0);
    } finally {
        await hostContext.close();
    }
});

test('阵营选择已清空但 phase 残留时，仍应显示起手重抽交互', async ({ page, game }, testInfo) => {
    test.setTimeout(60000);

    await page.goto('/play/smashup');
    await page.waitForFunction(
        () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
        { timeout: 15000, polling: 200 },
    );

    await game.setupScene({
        gameId: 'smashup',
        player0: { factions: ['tricksters_pod', 'steampunks_pod'] },
        player1: { factions: ['vampires_pod', 'bear_cavalry_pod'] },
        currentPlayer: '0',
        phase: 'playCards',
    });

    await page.evaluate((updaterSource) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = harness.state.get();
        const updater = new Function('state', `${updaterSource}`) as (state: any) => any;
        harness.state.set(updater(state));
    }, `return (${buildFactionSelectStuckState.toString()})(state);`);

    await page.waitForTimeout(500);
    await expect(page.locator('[data-tutorial-id="su-faction-select"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '保留手牌' })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: '重抽一次' })).toBeVisible({ timeout: 8000 });

    await saveEvidenceScreenshot(page, testInfo, 'stuck-faction-select-mulligan-visible');
});
