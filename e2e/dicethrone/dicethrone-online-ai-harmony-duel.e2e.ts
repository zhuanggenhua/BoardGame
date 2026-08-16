import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';
import { expect, test } from '../framework';
import { getEvidenceScreenshotDir, sanitizeEvidencePathSegment } from '../framework/evidenceScreenshots';
import {
    ensureGameServerAvailable,
    getGameServerBaseURL,
    initContext,
    setChineseLocale,
    waitForTestHarness,
} from '../helpers/common';
import {
    claimDTSeatViaAPI,
    createDTRoomViaAPI,
    seedDTMatchCredentials,
    waitForCharacterSelection,
} from '../helpers/dicethrone';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import type { MatchState, RandomFn } from '../../src/engine/types';
import '../../src/games/dicethrone/domain';
import { createCharacterDice, initHeroState } from '../../src/games/dicethrone/domain/characters';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';
import { buildAfterRollConfirmedSignature } from '../../src/games/dicethrone/domain/responseWindowGuards';
import { getHeroDieFace } from '../../src/games/dicethrone/domain/rules';

type HarnessState = {
    sys?: {
        phase?: string | null;
        interaction?: {
            current?: {
                kind?: string | null;
                id?: string | null;
                playerId?: string | null;
            } | null;
        } | null;
        responseWindow?: {
            current?: {
                windowType?: string | null;
                sourceId?: string | null;
                responderQueue?: string[];
                currentResponderIndex?: number | null;
            } | null;
        } | null;
        eventStream?: {
            entries?: Array<{
                event?: {
                    type?: string | null;
                    payload?: {
                        targetId?: string | null;
                        actualDamage?: number | null;
                        amount?: number | null;
                        sourceAbilityId?: string | null;
                    } | null;
                } | null;
            }>;
        } | null;
        turnOrder?: string[];
        currentPlayerIndex?: number | null;
        flowHalted?: boolean | null;
    } | null;
    core?: {
        activePlayerId?: string | null;
        turnNumber?: number | null;
        rollCount?: number | null;
        rollLimit?: number | null;
        rollConfirmed?: boolean | null;
        rollConfirmedSequence?: number | null;
        afterRollResponseWindowSequence?: number | null;
        afterRollResponseWindowSignature?: string | null;
        selectedAbilityId?: string | null;
        hostStarted?: boolean | null;
        selectedCharacters?: Record<string, string | null> | null;
        readyPlayers?: Record<string, boolean | null> | null;
        seatControllers?: Record<string, { type?: string | null; minimumActionDelayMs?: number | null }> | null;
        dice?: Array<{
            id?: number;
            value?: number;
            symbol?: string | null;
            symbols?: string[] | null;
            definitionId?: string | null;
            isKept?: boolean | null;
        }>;
        players?: Record<string, {
            resources?: Record<string, number> | null;
        }>;
        pendingAttack?: {
            attackerId?: string | null;
            defenderId?: string | null;
            sourceAbilityId?: string | null;
            defenseAbilityId?: string | null;
            damage?: number | null;
            bonusDamage?: number | null;
            isDefendable?: boolean | null;
        } | null;
        pendingDamage?: unknown;
        interaction?: unknown;
        selectedCharacterIds?: unknown;
    } | null;
};

type OnlineAiAuditDamageEvent = {
    streamIndex: number;
    targetId: string | null;
    actualDamage: number | null;
    amount: number | null;
    sourceAbilityId: string | null;
};

type OnlineAiAuditTimelineEntry = {
    atMs: number;
    reason: string;
    phase: string | null;
    interactionKind: string | null;
    interactionId: string | null;
    responseWindowType: string | null;
    pendingAttackSourceAbilityId: string | null;
    pendingAttackDefenseAbilityId: string | null;
    hp0: number | null;
    hp1: number | null;
    overlayVisible: boolean;
    overlayRect: { x: number; y: number; width: number; height: number } | null;
    overlayOpacity: string | null;
    overlayTransform: string | null;
    damageFloatTexts: string[];
    damageEventCount: number;
    lastDamageEvent: OnlineAiAuditDamageEvent | null;
};

type OnlineAiAuditSnapshot = {
    compareRollOverlayMountCount: number;
    compareRollVisibleSegments: number;
    compareRollCollapseReopenDetected: boolean;
    compareRollOverlayTexts: string[];
    damageFloatMountCount: number;
    damageFloatTexts: string[];
    damageEvents: OnlineAiAuditDamageEvent[];
    aiPerfLogs: Array<{ stage: string; payload: Record<string, unknown> }>;
    aiTruthLogs: Array<{ stage: string; payload: Record<string, unknown> }>;
    timeline: OnlineAiAuditTimelineEntry[];
};

type OnlineAiMatchState = MatchState<unknown> & HarnessState;

const DICE_THRONE_PREPARE_RANDOM: RandomFn = {
    shuffle: <T>(values: T[]) => [...values],
    random: () => 0.5,
    d: (_n: number) => 1,
    range: (min: number, _max: number) => min,
};

const saveEvidenceScreenshot = async (page: Page, testInfo: TestInfo, name: string) => {
    const path = getEvidenceScreenshotPath(testInfo, name);
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: true });
    return path;
};

const getEvidenceScreenshotPath = (testInfo: TestInfo, name: string) => {
    const dir = getEvidenceScreenshotDir(testInfo);
    return join(dir, `${sanitizeEvidencePathSegment(name) || 'screenshot'}.png`);
};

const saveOnlineAiAuditLog = async (
    testInfo: TestInfo,
    filename: string,
    snapshot: OnlineAiAuditSnapshot,
): Promise<string> => {
    const stableEvidenceDir = getEvidenceScreenshotDir(testInfo);
    const filePath = join(stableEvidenceDir, `${sanitizeEvidencePathSegment(filename) || 'online-ai-audit.json'}`);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    await testInfo.attach(filename, { path: filePath, contentType: 'application/json' });
    return filePath;
};

const expectCompareRollMainResultLayer = async (page: Page, timeout = 5000): Promise<void> => {
    const panel = page.getByTestId('compare-roll-overlay');
    await expect(panel).toBeVisible({ timeout });
    await expect(panel).toHaveAttribute('data-placement', 'main-result-layer');
    await expect(panel.locator('xpath=ancestor::*[@data-player-seat-anchor][1]')).toHaveCount(0);
    await expect(panel.locator('[data-testid="dice-2d"]')).toHaveCount(0);
    await expect(page.getByTestId('roll-spotlight-dice-content')).toHaveCount(0);
};

const applyOnlineAiMatchState = async (
    matchId: string,
    page: Page,
    mutator: (state: OnlineAiMatchState) => OnlineAiMatchState,
) => {
    const current = await getMatchState(matchId, page) as OnlineAiMatchState;
    const next = mutator(structuredClone(current) as OnlineAiMatchState);
    await injectMatchState(matchId, next, page);
};

const dismissStartDefenseShowcaseIfPresent = async (page: Page, timeoutMs = 2000) => {
    const deadline = Date.now() + timeoutMs;
    const overlay = page.getByTestId('attack-showcase-overlay');
    const startDefenseButton = page.getByRole('button', { name: /开始防御|Start Defense/i }).first();
    while (Date.now() < deadline) {
        if (await startDefenseButton.isVisible({ timeout: 250 }).catch(() => false)) {
            await startDefenseButton.click();
            await expect(overlay).toHaveCount(0, { timeout: 5000 }).catch(() => {});
            return;
        }
        if (!await overlay.isVisible({ timeout: 250 }).catch(() => false)) {
            return;
        }
        await page.waitForTimeout(200);
    }
};

const dispatchHarnessCommand = async (
    page: Page,
    type: string,
    playerId: string,
    payload: Record<string, unknown> = {},
) => {
    await page.evaluate(async ({ commandType, commandPlayerId, commandPayload }) => {
        const harness = (window as Window & {
            __BG_TEST_HARNESS__?: {
                command?: {
                    dispatch?: (command: {
                        type: string;
                        playerId: string;
                        payload: Record<string, unknown>;
                    }) => void | Promise<void>;
                };
            };
        }).__BG_TEST_HARNESS__;

        if (!harness?.command?.dispatch) {
            throw new Error('TestHarness command dispatcher not ready');
        }

        await harness.command.dispatch({
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

const primeDiceValues = async (page: Page, values: number[]) => {
    await page.waitForFunction(
        () => Boolean((window as Window & {
            __BG_TEST_HARNESS__?: { dice?: { setValues?: (nextValues: number[]) => void } };
        }).__BG_TEST_HARNESS__?.dice?.setValues),
        { timeout: 5000 },
    );
    await page.evaluate((nextValues) => {
        const harness = (window as Window & {
            __BG_TEST_HARNESS__?: { dice?: { setValues?: (values: number[]) => void } };
        }).__BG_TEST_HARNESS__;
        if (!harness?.dice?.setValues) {
            throw new Error('TestHarness dice injector not ready');
        }
        harness.dice.setValues(nextValues);
    }, values);
};

const buildDuelDie = (
    core: Record<string, unknown>,
    baseDie: Record<string, unknown>,
    ownerId: string,
    value: number,
) => {
    const player = (core.players as Record<string, { characterId?: string }> | undefined)?.[ownerId];
    const characterId = player?.characterId;
    const face = characterId
        ? getHeroDieFace(characterId as Parameters<typeof getHeroDieFace>[0], value)
        : null;
    return {
        ...baseDie,
        ownerId,
        definitionId: characterId ? `${characterId}-dice` : baseDie.definitionId,
        value,
        symbol: face,
        symbols: face ? [face] : [],
        isKept: false,
    };
};

const stabilizeDuelRollContextValues = async (
    matchId: string,
    page: Page,
    values: { defenderValue: number; attackerValue: number },
) => {
    await applyOnlineAiMatchState(matchId, page, (state) => {
        const next = structuredClone(state) as OnlineAiMatchState;
        const core = (next.core ?? {}) as Record<string, unknown>;
        const pendingAttack = (core.pendingAttack ?? {}) as Record<string, unknown>;
        const defenderId = typeof pendingAttack.defenderId === 'string' ? pendingAttack.defenderId : '0';
        const attackerId = typeof pendingAttack.attackerId === 'string' ? pendingAttack.attackerId : '1';
        const rollDiceCount = typeof core.rollDiceCount === 'number' ? core.rollDiceCount : 1;
        const currentRollContext = (core.currentRollContext ?? {}) as Record<string, unknown>;
        const contextDice = Array.isArray(currentRollContext.dice)
            ? currentRollContext.dice as Array<Record<string, unknown>>
            : [];
        const defenderDie = buildDuelDie(core, contextDice[0] ?? { id: 0 }, defenderId, values.defenderValue);
        const attackerDie = buildDuelDie(core, contextDice[1] ?? { id: 1 }, attackerId, values.attackerValue);
        const coreDice = Array.isArray(core.dice) ? core.dice as Array<Record<string, unknown>> : [];

        next.core = {
            ...next.core,
            dice: coreDice.map((die, index) => (
                index < rollDiceCount
                    ? buildDuelDie(core, die, defenderId, values.defenderValue)
                    : die
            )),
            currentRollContext: {
                ...currentRollContext,
                dice: [defenderDie, attackerDie],
            },
        };

        return next;
    });
};

const waitForAiSeatCredential = async (page: Page, matchId: string, playerId: string) => {
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
};

async function waitForCharacterSelectionWithRetry(page: Page, timeout = 60000): Promise<void> {
    const deadline = Date.now() + timeout;
    let reloadCount = 0;
    const maxReloads = 2;

    while (Date.now() < deadline) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) break;

        try {
            await waitForCharacterSelection(page, Math.min(remaining, 15000));
            return;
        } catch {
            const retryButton = page.getByRole('button', { name: /点击重试加载|重试加载|重试|Retry/i }).first();
            if (await retryButton.isVisible().catch(() => false)) {
                await retryButton.click();
                await page.waitForTimeout(2000);
                continue;
            }

            const loadingScreen = page.locator('[data-testid="loading-screen"]').first();
            const isLoading = await loadingScreen.isVisible().catch(() => false);
            if (isLoading && reloadCount < maxReloads) {
                reloadCount += 1;
                await page.reload({ waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(1000);
                continue;
            }

            await page.waitForTimeout(1000);
        }
    }

    throw new Error('等待角色选择页超时');
}

async function setupDTOnlineAiRoom(
    browser: Browser,
    baseURL: string | undefined,
): Promise<{ hostPage: Page; hostContext: BrowserContext; matchId: string } | null> {
    const hostContext = await browser.newContext({ baseURL });
    await initContext(hostContext, {
        storageKey: '__dicethrone_storage_reset_online_ai',
        skipTutorial: false,
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

    const guestId = `dt_online_ai_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
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
        playerName: 'Host-Online-AI',
        gameServerBaseURL: getGameServerBaseURL(),
    });
    if (!credentials) {
        await hostContext.close();
        return null;
    }

    const aiCredentials = await claimDTSeatViaAPI(hostPage, matchId, '1', {
        guestId,
        playerName: 'AI-Online-AI',
        gameServerBaseURL: getGameServerBaseURL(),
    });
    if (!aiCredentials) {
        await hostContext.close();
        return null;
    }
    const aiSeatCredentials = { '1': aiCredentials };
    await hostContext.addInitScript(({ targetMatchId, credentials }) => {
        localStorage.setItem(`match_ai_creds_${targetMatchId}`, JSON.stringify(credentials));
        window.dispatchEvent(new Event('match-credentials-changed'));
    }, { targetMatchId: matchId, credentials: aiSeatCredentials });
    await hostPage.evaluate(({ targetMatchId, credentials }) => {
        localStorage.setItem(`match_ai_creds_${targetMatchId}`, JSON.stringify(credentials));
        window.dispatchEvent(new Event('match-credentials-changed'));
    }, { targetMatchId: matchId, credentials: aiSeatCredentials });

    await seedDTMatchCredentials(hostContext, matchId, '0', credentials);
    await hostPage.goto(`/play/dicethrone/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
    await waitForTestHarness(hostPage, 20000);

    return { hostPage, hostContext, matchId };
}

const installOnlineAiAuditProbe = async (page: Page) => {
    await page.evaluate(() => {
        const win = window as Window & {
            __DT_ONLINE_AI_AUDIT__?: {
                observer?: MutationObserver;
                timer?: number;
                startedAt: number;
                lastSignature?: string;
                snapshot: OnlineAiAuditSnapshot;
            };
        };

        win.__DT_ONLINE_AI_AUDIT__?.observer?.disconnect();
        if (win.__DT_ONLINE_AI_AUDIT__?.timer) {
            window.clearInterval(win.__DT_ONLINE_AI_AUDIT__.timer);
        }

        const snapshot: OnlineAiAuditSnapshot = {
            compareRollOverlayMountCount: 0,
            compareRollVisibleSegments: 0,
            compareRollCollapseReopenDetected: false,
            compareRollOverlayTexts: [],
            damageFloatMountCount: 0,
            damageFloatTexts: [],
            damageEvents: [],
            aiPerfLogs: [],
            aiTruthLogs: [],
            timeline: [],
        };
        const startedAt = performance.now();

        const getState = (): HarnessState | null => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    state?: { get?: () => HarnessState | null };
                };
            }).__BG_TEST_HARNESS__;
            return harness?.state?.get?.() ?? null;
        };

        const getDamageEvents = (state: HarnessState | null): OnlineAiAuditDamageEvent[] => {
            const entries = state?.sys?.eventStream?.entries ?? [];
            return entries
                .map((entry, streamIndex) => ({ entry, streamIndex }))
                .filter(({ entry }) => entry.event?.type === 'DAMAGE_DEALT')
                .map(({ entry, streamIndex }) => ({
                    streamIndex,
                    targetId: entry.event?.payload?.targetId ?? null,
                    actualDamage: entry.event?.payload?.actualDamage ?? null,
                    amount: entry.event?.payload?.amount ?? null,
                    sourceAbilityId: entry.event?.payload?.sourceAbilityId ?? null,
                }));
        };

        const readOverlaySnapshot = () => {
            const overlay = document.querySelector('[data-testid="compare-roll-overlay"]') as HTMLElement | null;
            if (!overlay) {
                return {
                    visible: false,
                    rect: null,
                    opacity: null,
                    transform: null,
                    text: null,
                };
            }

            const rect = overlay.getBoundingClientRect();
            const style = window.getComputedStyle(overlay);
            return {
                visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
                rect: {
                    x: Math.round(rect.x * 100) / 100,
                    y: Math.round(rect.y * 100) / 100,
                    width: Math.round(rect.width * 100) / 100,
                    height: Math.round(rect.height * 100) / 100,
                },
                opacity: style.opacity,
                transform: style.transform,
                text: overlay.textContent?.trim() ?? null,
            };
        };

        const readDamageFloatTexts = () => Array.from(
            document.querySelectorAll('[data-floating-text-preset="impact-damage"]'),
        )
            .map((node) => node.textContent?.trim())
            .filter((value): value is string => Boolean(value));

        const pushTimeline = (reason: string) => {
            const state = getState();
            const overlay = readOverlaySnapshot();
            const damageEvents = getDamageEvents(state);
            snapshot.damageEvents = damageEvents;

            const timelineEntry: OnlineAiAuditTimelineEntry = {
                atMs: Math.round((performance.now() - startedAt) * 100) / 100,
                reason,
                phase: state?.sys?.phase ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                interactionId: state?.sys?.interaction?.current?.id ?? null,
                responseWindowType: state?.sys?.responseWindow?.current?.windowType ?? null,
                pendingAttackSourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
                pendingAttackDefenseAbilityId: state?.core?.pendingAttack?.defenseAbilityId ?? null,
                hp0: state?.core?.players?.['0']?.resources?.hp ?? null,
                hp1: state?.core?.players?.['1']?.resources?.hp ?? null,
                overlayVisible: overlay.visible,
                overlayRect: overlay.rect,
                overlayOpacity: overlay.opacity,
                overlayTransform: overlay.transform,
                damageFloatTexts: readDamageFloatTexts(),
                damageEventCount: damageEvents.length,
                lastDamageEvent: damageEvents.length > 0 ? damageEvents[damageEvents.length - 1] : null,
            };

            const signature = JSON.stringify({
                reason,
                phase: timelineEntry.phase,
                interactionKind: timelineEntry.interactionKind,
                interactionId: timelineEntry.interactionId,
                responseWindowType: timelineEntry.responseWindowType,
                hp0: timelineEntry.hp0,
                hp1: timelineEntry.hp1,
                overlayVisible: timelineEntry.overlayVisible,
                overlayRect: timelineEntry.overlayRect,
                overlayOpacity: timelineEntry.overlayOpacity,
                overlayTransform: timelineEntry.overlayTransform,
                damageFloatTexts: timelineEntry.damageFloatTexts,
                damageEventCount: timelineEntry.damageEventCount,
                lastDamageEvent: timelineEntry.lastDamageEvent,
            });

            if (win.__DT_ONLINE_AI_AUDIT__?.lastSignature === signature) {
                return;
            }

            snapshot.timeline.push(timelineEntry);
            win.__DT_ONLINE_AI_AUDIT__!.lastSignature = signature;
        };

        const observer = new MutationObserver((records) => {
            for (const record of records) {
                for (const node of Array.from(record.addedNodes)) {
                    if (!(node instanceof Element)) continue;
                    if (node.matches('[data-testid="compare-roll-overlay"]') || node.querySelector('[data-testid="compare-roll-overlay"]')) {
                        snapshot.compareRollOverlayMountCount += 1;
                        const text = node.textContent?.trim();
                        if (text) snapshot.compareRollOverlayTexts.push(text);
                    }
                    if (node.matches('[data-floating-text-preset="impact-damage"]') || node.querySelector('[data-floating-text-preset="impact-damage"]')) {
                        snapshot.damageFloatMountCount += 1;
                        const text = node.textContent?.trim();
                        if (text) snapshot.damageFloatTexts.push(text);
                    }
                }
            }
            pushTimeline('mutation');
        });

        observer.observe(document.body, { childList: true, subtree: true });
        win.__DT_ONLINE_AI_AUDIT__ = {
            observer,
            timer: window.setInterval(() => pushTimeline('interval'), 50),
            startedAt,
            lastSignature: undefined,
            snapshot,
        };
        pushTimeline('probe-installed');
    });
};

const readOnlineAiAudit = async (page: Page): Promise<OnlineAiAuditSnapshot> => page.evaluate(() => {
    const win = window as Window & {
        __DT_ONLINE_AI_AUDIT__?: {
            snapshot: OnlineAiAuditSnapshot;
        };
    };
    const snapshot = win.__DT_ONLINE_AI_AUDIT__?.snapshot;
    if (!snapshot) {
        return {
            compareRollOverlayMountCount: 0,
            compareRollVisibleSegments: 0,
            compareRollCollapseReopenDetected: false,
            compareRollOverlayTexts: [],
            damageFloatMountCount: 0,
            damageFloatTexts: [],
            damageEvents: [],
            aiPerfLogs: [],
            aiTruthLogs: [],
            timeline: [],
        };
    }

    let visibleSegments = 0;
    let wasVisible = false;
    let collapseReopenDetected = false;
    let collapsedAfterSettle = false;
    const visibleHeights = snapshot.timeline
        .filter((entry) => entry.overlayVisible && entry.overlayRect && entry.overlayRect.height > 0)
        .map((entry) => entry.overlayRect!.height);
    const maxHeight = visibleHeights.length > 0 ? Math.max(...visibleHeights) : 0;
    const settleThreshold = maxHeight > 0 ? maxHeight * 0.8 : 0;
    const collapseThreshold = maxHeight > 0 ? maxHeight * 0.65 : 0;
    for (const entry of snapshot.timeline) {
        if (entry.overlayVisible && !wasVisible) {
            visibleSegments += 1;
        }
        wasVisible = entry.overlayVisible;
    }
    if (maxHeight > 0) {
        const settledIndex = snapshot.timeline.findIndex((entry) => entry.overlayVisible && entry.overlayRect && entry.overlayRect.height >= settleThreshold);
        if (settledIndex >= 0) {
            for (let index = settledIndex + 1; index < snapshot.timeline.length; index += 1) {
                const entry = snapshot.timeline[index];
                if (!entry.overlayVisible || !entry.overlayRect) {
                    continue;
                }
                if (entry.overlayRect.height <= collapseThreshold) {
                    collapsedAfterSettle = true;
                    continue;
                }
                if (collapsedAfterSettle && entry.overlayRect.height >= settleThreshold) {
                    collapseReopenDetected = true;
                    break;
                }
            }
        }
    }

    return {
        ...snapshot,
        compareRollVisibleSegments: visibleSegments,
        compareRollCollapseReopenDetected: collapseReopenDetected,
    };
});

const buildOnlineAiMonkHarmonyState = (state: OnlineAiMatchState) => {
    const next = structuredClone(state) as OnlineAiMatchState;
    const host = initHeroState('0', 'gunslinger', DICE_THRONE_PREPARE_RANDOM);
    const ai = initHeroState('1', 'monk', DICE_THRONE_PREPARE_RANDOM);

    next.core = {
        ...next.core,
        hostStarted: true,
        phase: 'offensiveRoll',
        selectedCharacters: {
            ...next.core?.selectedCharacters,
            '0': 'gunslinger',
            '1': 'monk',
        },
        readyPlayers: {
            ...next.core?.readyPlayers,
            '0': true,
            '1': true,
        },
        seatControllers: {
            ...(next.core?.seatControllers ?? {}),
            '0': { type: 'human' },
            '1': { type: 'local-ai', minimumActionDelayMs: 2000 },
        },
        activePlayerId: '1',
        turnNumber: typeof next.core?.turnNumber === 'number' ? next.core.turnNumber : 1,
        rollCount: 1,
        rollLimit: 1,
        rollConfirmed: true,
        rollConfirmedSequence: 1,
        afterRollResponseWindowSequence: 1,
        players: {
            ...(next.core?.players ?? {}),
            '0': {
                ...host,
                resources: {
                    ...(host.resources ?? {}),
                    [RESOURCE_IDS.HP]: 50,
                    [RESOURCE_IDS.CP]: 2,
                },
            },
            '1': {
                ...ai,
                hand: [],
                deck: [],
                discard: [],
                resources: {
                    ...(ai.resources ?? {}),
                    [RESOURCE_IDS.HP]: 50,
                    [RESOURCE_IDS.CP]: 2,
                },
            },
        },
        dice: createCharacterDice('monk').map((die, index) => {
            const values = [1, 2, 3, 4, 6];
            const value = values[index] ?? 1;
            const symbol = getHeroDieFace('monk', value);
            return {
                ...die,
                value,
                symbol,
                symbols: [symbol],
                isKept: false,
            };
        }),
        selectedAbilityId: undefined,
        pendingAttack: undefined,
        pendingDamage: undefined,
        interaction: undefined,
    };

    next.core.afterRollResponseWindowSignature = buildAfterRollConfirmedSignature(next.core);
    next.sys = {
        ...next.sys,
        phase: 'offensiveRoll',
        turnOrder: ['0', '1'],
        currentPlayerIndex: 1,
        flowHalted: false,
        responseWindow: {
            ...(next.sys?.responseWindow ?? {}),
            current: null,
        },
        interaction: {
            ...(next.sys?.interaction ?? {}),
            current: null,
        },
    };

    return next;
};

const buildOnlineAiPaladinDamageState = (state: OnlineAiMatchState) => {
    const next = structuredClone(state) as OnlineAiMatchState;
    const host = initHeroState('0', 'gunslinger', DICE_THRONE_PREPARE_RANDOM);
    const ai = initHeroState('1', 'paladin', DICE_THRONE_PREPARE_RANDOM);

    next.core = {
        ...next.core,
        hostStarted: true,
        phase: 'offensiveRoll',
        selectedCharacters: {
            ...next.core?.selectedCharacters,
            '0': 'gunslinger',
            '1': 'paladin',
        },
        readyPlayers: {
            ...next.core?.readyPlayers,
            '0': true,
            '1': true,
        },
        seatControllers: {
            ...(next.core?.seatControllers ?? {}),
            '0': { type: 'human' },
            '1': { type: 'local-ai', minimumActionDelayMs: 2000 },
        },
        activePlayerId: '1',
        turnNumber: typeof next.core?.turnNumber === 'number' ? next.core.turnNumber : 1,
        rollCount: 1,
        rollLimit: 1,
        rollConfirmed: true,
        rollConfirmedSequence: 1,
        afterRollResponseWindowSequence: 1,
        players: {
            ...(next.core?.players ?? {}),
            '0': {
                ...host,
                resources: {
                    ...(host.resources ?? {}),
                    [RESOURCE_IDS.HP]: 50,
                    [RESOURCE_IDS.CP]: 2,
                },
            },
            '1': {
                ...ai,
                hand: [],
                deck: [],
                discard: [],
                resources: {
                    ...(ai.resources ?? {}),
                    [RESOURCE_IDS.HP]: 50,
                    [RESOURCE_IDS.CP]: 2,
                },
            },
        },
        dice: createCharacterDice('paladin').map((die, index) => {
            const values = [1, 1, 1, 6, 3];
            const value = values[index] ?? 1;
            const symbol = getHeroDieFace('paladin', value);
            return {
                ...die,
                value,
                symbol,
                symbols: [symbol],
                isKept: false,
            };
        }),
        selectedAbilityId: undefined,
        pendingAttack: undefined,
        pendingDamage: undefined,
        interaction: undefined,
    };

    next.core.afterRollResponseWindowSignature = buildAfterRollConfirmedSignature(next.core);
    next.sys = {
        ...next.sys,
        phase: 'offensiveRoll',
        turnOrder: ['0', '1'],
        currentPlayerIndex: 1,
        flowHalted: false,
        responseWindow: {
            ...(next.sys?.responseWindow ?? {}),
            current: null,
        },
        interaction: {
            ...(next.sys?.interaction ?? {}),
            current: null,
        },
    };

    return next;
};

test.describe('DiceThrone 在线 AI 真链路', () => {
    test('僧侣 harmony + 枪手 duel：compare-roll 不应半弹后重开，伤害浮字应出现', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupDTOnlineAiRoom(browser, baseURL);
        if (!setup) {
            test.skip(true, '游戏服务器不可用或在线 AI 房间创建失败');
            return;
        }

        const consoleLogs: Array<{ stage: string; payload: Record<string, unknown> }> = [];
        setup.hostPage.on('console', async (msg) => {
            const text = msg.text();
            if (!text.includes('[LOCAL_AI_PERF]') && !text.includes('[AI_RUNTIME_TRUTH]')) {
                return;
            }
            const args = msg.args();
            const marker = args[0] ? await args[0].jsonValue().catch(() => null) : null;
            const payload = args[1] ? await args[1].jsonValue().catch(() => null) : null;
            if (marker === '[LOCAL_AI_PERF]' && payload && typeof payload === 'object') {
                consoleLogs.push(payload as { stage: string; payload: Record<string, unknown> });
            }
        });

        try {
            const { hostPage, matchId } = setup;
            await waitForCharacterSelectionWithRetry(hostPage, 30000);
            await waitForAiSeatCredential(hostPage, matchId, '1');
            await hostPage.evaluate(() => {
                const harness = (window as Window & {
                    __BG_TEST_HARNESS__?: { random?: { setQueue?: (values: number[]) => void } };
                }).__BG_TEST_HARNESS__;
                harness?.random?.setQueue?.([0.99, 0.0]);
            });

            await installOnlineAiAuditProbe(hostPage);
            await applyOnlineAiMatchState(matchId, hostPage, buildOnlineAiMonkHarmonyState);

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                return {
                    phase: state.sys?.phase ?? null,
                    sourceAbilityId: state.core?.pendingAttack?.sourceAbilityId ?? null,
                    defenseAbilityId: state.core?.pendingAttack?.defenseAbilityId ?? null,
                };
            }, {
                timeout: 30000,
                message: '等待在线 AI 真实选择 harmony 并进入防御阶段',
            }).toMatchObject({
                phase: 'defensiveRoll',
                sourceAbilityId: 'harmony',
                defenseAbilityId: 'duel',
            });

            await dismissStartDefenseShowcaseIfPresent(hostPage, 7000);
            await primeDiceValues(hostPage, [6, 1]);
            await dispatchHarnessCommand(hostPage, 'ROLL_DICE', '0');
            await stabilizeDuelRollContextValues(matchId, hostPage, { defenderValue: 6, attackerValue: 1 });
            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                return {
                    phase: state.sys?.phase ?? null,
                    rollCount: state.core?.rollCount ?? null,
                    rollConfirmed: state.core?.rollConfirmed ?? null,
                    rollContextKind: (state.core as { currentRollContext?: { kind?: string | null; dice?: Array<{ value?: number | null }> } | null })?.currentRollContext?.kind ?? null,
                    dice: (state.core as { currentRollContext?: { dice?: Array<{ value?: number | null }> } | null })?.currentRollContext?.dice?.map((die) => die.value ?? null) ?? [],
                };
            }, {
                timeout: 15000,
                message: '等待真人防御方完成 Duel 防御掷骰',
            }).toMatchObject({
                phase: 'defensiveRoll',
                rollCount: 1,
                rollConfirmed: false,
                rollContextKind: 'defensive',
                dice: [6, 1],
            });

            await dispatchHarnessCommand(hostPage, 'CONFIRM_ROLL', '0');
            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                return {
                    phase: state.sys?.phase ?? null,
                    rollConfirmed: state.core?.rollConfirmed ?? null,
                    rollContextStatus: (state.core as { currentRollContext?: { status?: string | null } | null })?.currentRollContext?.status ?? null,
                };
            }, {
                timeout: 15000,
                message: '等待真人防御方确认 Duel 防御骰',
            }).toMatchObject({
                phase: 'defensiveRoll',
                rollConfirmed: true,
                rollContextStatus: 'settling',
            });

            await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');
            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                const rollContext = (state.core as {
                    currentRollContext?: {
                        kind?: string | null;
                        status?: string | null;
                        ownerPlayerId?: string | null;
                        dice?: Array<{ value?: number | null }>;
                    } | null;
                })?.currentRollContext;
                return {
                    phase: state.sys?.phase ?? null,
                    rollContextKind: rollContext?.kind ?? null,
                    rollContextStatus: rollContext?.status ?? null,
                    rollContextOwner: rollContext?.ownerPlayerId ?? null,
                    dice: rollContext?.dice?.map((die) => die.value ?? null) ?? [],
                };
            }, {
                timeout: 15000,
                message: '等待 Duel 对掷进入右侧骰盘确认',
            }).toMatchObject({
                phase: 'defensiveRoll',
                rollContextKind: 'compare',
                rollContextStatus: 'open',
                rollContextOwner: '0',
                dice: [6, 1],
            });

            await dismissStartDefenseShowcaseIfPresent(hostPage, 7000);
            const compareDiceTray = hostPage.locator('[data-testid="dicethrone-2d-dice-tray"]:visible').first();
            const compareConfirmButton = compareDiceTray
                .locator('xpath=ancestor::*[@data-player-seat-anchor][1]')
                .locator('[data-tutorial-id="dice-confirm-button"]')
                .first();
            await expect(compareConfirmButton).toBeVisible({ timeout: 5000 });
            await expect(compareConfirmButton).toBeEnabled();
            await compareConfirmButton.click();

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                const overlayVisible = await hostPage.getByTestId('compare-roll-overlay').isVisible().catch(() => false);
                const preventHalfVisible = await hostPage.getByRole('button', { name: '抵挡 1/2 进攻伤害' }).isVisible().catch(() => false);
                return {
                    phase: state.sys?.phase ?? null,
                    sourceAbilityId: state.core?.pendingAttack?.sourceAbilityId ?? null,
                    defenseAbilityId: state.core?.pendingAttack?.defenseAbilityId ?? null,
                    interactionKind: state.sys?.interaction?.current?.kind ?? null,
                    overlayVisible,
                    preventHalfVisible,
                };
            }, {
                timeout: 15000,
                message: '等待 Duel 对掷窗口进入 compare-roll-choice',
            }).toMatchObject({
                phase: 'defensiveRoll',
                sourceAbilityId: 'harmony',
                defenseAbilityId: 'duel',
                interactionKind: 'compare-roll-choice',
                overlayVisible: true,
                preventHalfVisible: true,
            });

            await expectCompareRollMainResultLayer(hostPage);
            await saveEvidenceScreenshot(hostPage, testInfo, 'online-ai-duel-before-prevent-half');

            await hostPage.getByRole('button', { name: '抵挡 1/2 进攻伤害' }).click();
            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                return {
                    phase: state.sys?.phase ?? null,
                    interactionKind: state.sys?.interaction?.current?.kind ?? null,
                };
            }, {
                timeout: 5000,
                message: '等待 compare-roll 选择收口回到 defensiveRoll',
            }).toMatchObject({
                phase: 'defensiveRoll',
                interactionKind: null,
            });

            await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');
            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                const audit = await readOnlineAiAudit(hostPage);
                return {
                    phase: state.sys?.phase ?? null,
                    pendingAttackActive: Boolean(state.core?.pendingAttack),
                    hp0: state.core?.players?.['0']?.resources?.[RESOURCE_IDS.HP] ?? null,
                    damageFloatMountCount: audit.damageFloatMountCount,
                    damageFloatTexts: audit.damageFloatTexts,
                    damageEvents: audit.damageEvents,
                };
            }, {
                timeout: 15000,
                message: '等待 Duel prevent-half 后的伤害浮字与掉血',
            }).toMatchObject({
                pendingAttackActive: false,
                hp0: 48,
            });

            await expect.poll(async () => {
                const audit = await readOnlineAiAudit(hostPage);
                return audit.damageFloatMountCount > 0
                    && audit.damageFloatTexts.some((text) => text.includes('2'))
                    && audit.damageEvents.some((event) => event.targetId === '0' && event.sourceAbilityId === 'harmony');
            }, {
                timeout: 5000,
                message: '等待 harmony 伤害浮字真实挂载',
            }).toBe(true);

            const audit = await readOnlineAiAudit(hostPage);
            expect(audit.compareRollOverlayMountCount).toBeGreaterThan(0);
            expect(audit.compareRollVisibleSegments).toBe(1);
            expect(audit.compareRollCollapseReopenDetected).toBe(false);
            await saveEvidenceScreenshot(hostPage, testInfo, 'online-ai-duel-after-prevent-half');

            const finalAuditPath = await saveOnlineAiAuditLog(testInfo, 'online-ai-duel-audit.json', {
                ...audit,
                aiPerfLogs: consoleLogs,
                aiTruthLogs: [],
            });
            testInfo.annotations.push({ type: 'online-ai-duel-audit-json', description: finalAuditPath });
        } finally {
            await setup.hostContext.close().catch(() => {});
        }
    });

    test('圣骑士 blessing-of-might：在线 AI 伤害浮字应稳定挂载', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupDTOnlineAiRoom(browser, baseURL);
        if (!setup) {
            test.skip(true, '游戏服务器不可用或在线 AI 房间创建失败');
            return;
        }

        const consoleLogs: Array<{ stage: string; payload: Record<string, unknown> }> = [];
        setup.hostPage.on('console', async (msg) => {
            const text = msg.text();
            if (!text.includes('[LOCAL_AI_PERF]') && !text.includes('[AI_RUNTIME_TRUTH]')) {
                return;
            }
            const args = msg.args();
            const marker = args[0] ? await args[0].jsonValue().catch(() => null) : null;
            const payload = args[1] ? await args[1].jsonValue().catch(() => null) : null;
            if (marker === '[LOCAL_AI_PERF]' && payload && typeof payload === 'object') {
                consoleLogs.push(payload as { stage: string; payload: Record<string, unknown> });
            }
        });

        try {
            const { hostPage, matchId } = setup;
            await waitForCharacterSelectionWithRetry(hostPage, 30000);
            await waitForAiSeatCredential(hostPage, matchId, '1');
            await hostPage.evaluate(() => {
                const harness = (window as Window & {
                    __BG_TEST_HARNESS__?: { random?: { setQueue?: (values: number[]) => void } };
                }).__BG_TEST_HARNESS__;
                harness?.random?.setQueue?.([0.99, 0.0]);
            });

            await installOnlineAiAuditProbe(hostPage);
            await applyOnlineAiMatchState(matchId, hostPage, buildOnlineAiPaladinDamageState);

            await expect.poll(async () => {
                const state = await getMatchState(matchId, hostPage);
                return {
                    hp0: state.core?.players?.['0']?.resources?.[RESOURCE_IDS.HP] ?? null,
                };
            }, {
                timeout: 30000,
                message: '等待在线 AI 真实结算 blessing-of-might 并造成不可防御伤害',
            }).toMatchObject({
                hp0: 47,
            });

            await expect.poll(async () => {
                const audit = await readOnlineAiAudit(hostPage);
                return audit.damageEvents.some((event) => event.targetId === '0' && event.sourceAbilityId === 'blessing-of-might');
            }, {
                timeout: 30000,
                message: '等待在线 AI 真实结算 blessing-of-might 并造成不可防御伤害',
            }).toBe(true);

            await expect.poll(async () => {
                const audit = await readOnlineAiAudit(hostPage);
                return audit.damageFloatMountCount > 0
                    && audit.damageFloatTexts.some((text) => text.includes('3') || text.includes('4'));
            }, {
                timeout: 10000,
                message: '等待 blessing-of-might 的伤害浮字挂载',
            }).toBe(true);

            await saveEvidenceScreenshot(hostPage, testInfo, 'online-ai-paladin-after-resolve');

            const audit = await readOnlineAiAudit(hostPage);
            expect(audit.damageEvents.some((event) => event.sourceAbilityId === 'blessing-of-might')).toBe(true);
            expect(audit.compareRollCollapseReopenDetected).toBe(false);
            const finalAuditPath = await saveOnlineAiAuditLog(testInfo, 'online-ai-paladin-audit.json', {
                ...audit,
                aiPerfLogs: consoleLogs,
                aiTruthLogs: [],
            });
            testInfo.annotations.push({ type: 'online-ai-paladin-audit-json', description: finalAuditPath });
        } finally {
            await setup.hostContext.close().catch(() => {});
        }
    });
});
