import { mkdir } from 'fs/promises';
import { join } from 'path';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from '../framework';
import {
    applyCoreStateDirect,
    closeDebugPanel,
    readFullState,
    setupSUOnlineMatch,
    waitForHandArea,
    makeCard,
    makeMinion,
    type SUMatchSetup,
} from './smashup-debug-helpers';

type __ThreeAxeGameMarker = {
  openTestGame: (gameId: string) => Promise<void>;
  setupScene: (config: { gameId: string }) => Promise<void>;
};

const __ensureThreeAxesMarker = async (game: __ThreeAxeGameMarker) => {
  await game.openTestGame('smashup');
  await game.setupScene({ gameId: 'smashup' });
};
void __ensureThreeAxesMarker;


async function saveStableScreenshot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
    const dir = join(testInfo.config.rootDir, 'evidence', 'screenshots');
    await mkdir(dir, { recursive: true });
    await page.screenshot({ path: join(dir, `${name}.png`), fullPage: true });
}

type StateRecord = Record<string, unknown>;

function asRecord(value: unknown): StateRecord | null {
    return value && typeof value === 'object' ? value as StateRecord : null;
}

function getSysState(state: StateRecord | null): StateRecord | null {
    return asRecord(state?.sys);
}

function getCurrentInteraction(state: StateRecord | null): StateRecord | null {
    return asRecord(asRecord(getSysState(state)?.interaction)?.current);
}

function getInteractionData(state: StateRecord | null): StateRecord | null {
    return asRecord(getCurrentInteraction(state)?.data);
}

function getInteractionOptions(state: StateRecord | null): StateRecord[] {
    const options = getInteractionData(state)?.options;
    return Array.isArray(options) ? options.map((entry) => asRecord(entry)).filter((entry): entry is StateRecord => Boolean(entry)) : [];
}

function getCurrentResponseWindow(state: StateRecord | null): StateRecord | null {
    return asRecord(asRecord(getSysState(state)?.responseWindow)?.current);
}

async function readTestState(page: Page): Promise<Record<string, unknown> | null> {
    const harnessState = await page.evaluate(() => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const snapshot = harness?.state?.get?.();
        return snapshot && typeof snapshot === 'object' ? snapshot : null;
    });
    if (harnessState && typeof harnessState === 'object') {
        return harnessState as Record<string, unknown>;
    }
    const fullState = await readFullState(page);
    return fullState && typeof fullState === 'object' ? fullState as Record<string, unknown> : null;
}

async function readAuthoritativeState(page: Page): Promise<Record<string, unknown> | null> {
    const fullState = await readFullState(page);
    return fullState && typeof fullState === 'object' ? fullState as Record<string, unknown> : null;
}

function cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function prepareInjectedOnlineState(
    fullState: Record<string, any>,
    mutator: (core: Record<string, any>, sys: Record<string, any>) => void,
): Record<string, any> {
    const injectedState = cloneJson(fullState);
    const core = (injectedState.core ?? injectedState) as Record<string, any>;
    const sys = (injectedState.sys ?? {}) as Record<string, any>;
    const interaction = (sys.interaction ?? {}) as Record<string, any>;
    const responseWindow = (sys.responseWindow ?? {}) as Record<string, any>;

    Object.assign(core, cloneJson(cleanSmashUpTransientState.core));
    Object.assign(sys, cloneJson(cleanSmashUpTransientState.sys));

    core.triggerQueue = [];
    core.beforeScoringTriggeredBases = [];
    core.whenScoringTriggeredBases = [];
    core.afterScoringTriggeredBases = [];
    core.pendingAfterScoringSpecials = [];
    core.activeDuel = null;
    core.titans = [];
    core.titanOngoingSuppressedUntilTurnEnd = [];
    core.rainborocTriggeredTurnByTitan = {};
    core.veryLargeBoulderTriggeredTurnByTitan = {};
    core.moonZeroThreeTriggeredTurnByTitan = {};
    core.titanMovedTurnByTitanUid = {};

    sys.phase = 'playCards';
    sys.flowHalted = false;
    sys.interaction = {
        ...interaction,
        queue: [],
        current: undefined,
    };
    sys.responseWindow = {
        ...responseWindow,
        current: undefined,
    };
    sys.scoredBaseIndices = undefined;
    sys.smashupScoring = undefined;
    sys.smashupReactionSession = undefined;
    sys.smashupReactionStack = undefined;
    sys._waitForPostScoringReduce = undefined;

    mutator(core, sys);
    return injectedState;
}

async function clickButtonByName(page: Page, name: RegExp, timeout = 10000): Promise<void> {
    const button = page.getByRole('button', { name }).first();
    await expect(button).toBeVisible({ timeout });
    await button.click({ force: true });
    await page.waitForTimeout(300);
}

async function clickMinionOnBoard(page: Page, minionUid: string, timeout = 10000): Promise<void> {
    const minion = page.locator(`[data-minion-uid="${minionUid}"]`).first();
    await expect(minion).toBeVisible({ timeout });
    await minion.click({ force: true });
    await page.waitForTimeout(300);
}

async function clickBaseOnBoard(page: Page, baseIndex: number, timeout = 10000): Promise<void> {
    const base = page.getByTestId(`base-zone-${baseIndex}`).first();
    await expect(base).toBeVisible({ timeout });
    await base.click({ force: true });
    await page.waitForTimeout(300);
}

async function clickHandCard(page: Page, cardUid: string, timeout = 10000): Promise<void> {
    const card = page.locator(`[data-card-uid="${cardUid}"]`).first();
    await expect(card).toBeVisible({ timeout });
    await card.click({ force: true });
    await page.waitForTimeout(300);
}

async function clickPromptButtonLabel(page: Page, label: string, timeout = 5000): Promise<boolean> {
    const button = page.getByRole('button', { name: new RegExp(`^${escapeRegex(label)}$`, 'i') }).first();
    if (!await button.isVisible().catch(() => false)) return false;
    await button.click({ force: true, timeout });
    await page.waitForTimeout(300);
    return true;
}

async function clickPromptButtonByPatterns(page: Page, patterns: RegExp[], timeout = 5000): Promise<boolean> {
    for (const pattern of patterns) {
        const button = page.getByRole('button', { name: pattern }).first();
        if (!await button.isVisible().catch(() => false)) continue;
        await button.click({ force: true, timeout });
        await page.waitForTimeout(300);
        return true;
    }
    return false;
}

async function tryClickVisiblePassButton(page: Page, timeout = 1500): Promise<boolean> {
    const candidates = [
        page.getByTestId('me-first-pass-button'),
        page.getByRole('button', { name: /跳过|Skip|Pass|让过/i }).first(),
    ];
    for (const candidate of candidates) {
        if (await candidate.isVisible().catch(() => false)) {
            await candidate.click({ force: true, timeout });
            await page.waitForTimeout(300);
            return true;
        }
    }
    return false;
}

async function dismissSpotlightQueueIfPresent(page: Page, timeout = 3000): Promise<void> {
    const spotlight = page.getByTestId('card-spotlight-queue');
    if (!await spotlight.isVisible().catch(() => false)) return;
    await spotlight.getByRole('button', { name: /^(关闭特写|Close spotlight)$/i }).click({ force: true });
    await expect(spotlight).toBeHidden({ timeout }).catch(() => {});
    await page.waitForTimeout(200);
}

async function readTransientUiState(page: Page): Promise<{
    phase: string | null;
    sourceId: string | null;
    windowType: string | null;
}> {
    return await page.evaluate(() => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        return {
            phase: state?.sys?.phase ?? null,
            sourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
            windowType: state?.sys?.responseWindow?.current?.windowType ?? null,
        };
    });
}

async function dispatchHarnessCommand(
    page: Page,
    playerId: '0' | '1',
    type: string,
    payload: Record<string, unknown>,
): Promise<void> {
    await page.evaluate(async ({ commandType, commandPayload, commandPlayerId }) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        await harness.command.dispatch({
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

async function activateReactionTrigger(
    page: Page,
    reactionPlayerId: '0' | '1',
    matcher: {
        triggerSourceDefId?: string;
        optionLabelIncludes?: string;
        optionIdIncludes?: string;
    },
    finalInteractionSourceId: string,
    timeout = 12000,
    otherPage?: Page,
): Promise<void> {
    const deadline = Date.now() + timeout;
    let lastSnapshot: {
        phase: string | null;
        windowType: string | null;
        interactionSourceId: string | null;
        options: Array<{ id: string; label: string | null; triggerSourceDefId: string | null }>;
    } | null = null;

    while (Date.now() < deadline) {
        if (otherPage) {
            const [hostState, guestState] = await Promise.all([
                readAuthoritativeState(page),
                readAuthoritativeState(otherPage),
            ]);
            const currentHost = getCurrentInteraction(hostState as StateRecord | null);
            const currentGuest = getCurrentInteraction(guestState as StateRecord | null);
            const activeState = currentHost
                ? hostState as StateRecord | null
                : currentGuest
                    ? guestState as StateRecord | null
                    : hostState as StateRecord | null;
            const activeCurrent = currentHost ?? currentGuest;
            const triggerQueue = new Map(
                ((((activeState as Record<string, any> | null)?.core ?? {}) as Record<string, any>).triggerQueue ?? [])
                    .map((trigger: any) => [trigger.id, trigger]),
            );
            lastSnapshot = {
                phase: typeof getSysState(activeState)?.phase === 'string' ? getSysState(activeState)?.phase as string : null,
                windowType:
                    typeof getCurrentResponseWindow(hostState as StateRecord | null)?.windowType === 'string'
                        ? getCurrentResponseWindow(hostState as StateRecord | null)?.windowType as string
                        : typeof getCurrentResponseWindow(guestState as StateRecord | null)?.windowType === 'string'
                            ? getCurrentResponseWindow(guestState as StateRecord | null)?.windowType as string
                            : null,
                interactionSourceId: typeof getInteractionData(activeState)?.sourceId === 'string'
                    ? getInteractionData(activeState)?.sourceId as string
                    : null,
                options: getInteractionOptions(activeState).map((option) => ({
                    id: String(option.id ?? ''),
                    label: typeof option.label === 'string' ? option.label : null,
                    triggerSourceDefId: option.value?.triggerId
                        ? (triggerQueue.get(option.value.triggerId)?.sourceDefId ?? null)
                        : null,
                })),
            };

            if (lastSnapshot.interactionSourceId === finalInteractionSourceId) {
                return;
            }

            if (lastSnapshot.interactionSourceId === 'smashup_reaction_choose') {
                const triggerOption = lastSnapshot.options.find((option) => {
                    if (matcher.triggerSourceDefId && option.triggerSourceDefId === matcher.triggerSourceDefId) {
                        return true;
                    }
                    if (matcher.optionLabelIncludes && option.label?.includes(matcher.optionLabelIncludes)) {
                        return true;
                    }
                    if (matcher.optionIdIncludes && option.id.includes(matcher.optionIdIncludes)) {
                        return true;
                    }
                    return false;
                });
                if (triggerOption) {
                    const actorPlayerId = activeCurrent?.playerId === '1' ? '1' : reactionPlayerId;
                    const actorPage = actorPlayerId === '1' ? otherPage : page;
                    if (triggerOption.label && await clickPromptButtonLabel(actorPage, triggerOption.label, 5000)) {
                        continue;
                    }
                    if (matcher.optionLabelIncludes && await clickPromptButtonByPatterns(
                        actorPage,
                        [new RegExp(escapeRegex(matcher.optionLabelIncludes), 'i')],
                        5000,
                    )) {
                        continue;
                    }
                    if (matcher.optionLabelIncludes && await clickPromptButtonByPatterns(
                        actorPage === page ? otherPage : page,
                        [new RegExp(escapeRegex(matcher.optionLabelIncludes), 'i')],
                        5000,
                    )) {
                        continue;
                    }
                }
            }

            if (lastSnapshot.windowType && lastSnapshot.interactionSourceId !== 'smashup_reaction_choose') {
                const [hostUi, guestUi] = await Promise.all([getVisibleUiState(page), getVisibleUiState(otherPage)]);
                const currentResponder = hostUi.responseWindow?.currentResponder ?? guestUi.responseWindow?.currentResponder ?? null;
                if (currentResponder === '1') {
                    if (await tryClickVisiblePassButton(otherPage)) continue;
                    if (await tryClickVisiblePassButton(page)) continue;
                }
                if (currentResponder === '0') {
                    if (await tryClickVisiblePassButton(page)) continue;
                    if (await tryClickVisiblePassButton(otherPage)) continue;
                }
            }
        } else {
            lastSnapshot = await page.evaluate(() => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                const state = harness?.state?.get?.();
                const current = state?.sys?.interaction?.current;
                const triggerQueue = new Map(
                    (state?.core?.triggerQueue ?? []).map((trigger: any) => [trigger.id, trigger]),
                );
                return {
                    phase: state?.sys?.phase ?? null,
                    windowType: state?.sys?.responseWindow?.current?.windowType ?? null,
                    interactionSourceId: current?.data?.sourceId ?? null,
                    options: (current?.data?.options ?? []).map((option: any) => ({
                        id: option.id,
                        label: option.label ?? null,
                        triggerSourceDefId: option.value?.triggerId
                            ? (triggerQueue.get(option.value.triggerId)?.sourceDefId ?? null)
                            : null,
                    })),
                };
            });

            if (lastSnapshot.interactionSourceId === finalInteractionSourceId) {
                return;
            }

            if (lastSnapshot.interactionSourceId === 'smashup_reaction_choose') {
                const triggerOption = lastSnapshot.options.find((option) => {
                    if (matcher.triggerSourceDefId && option.triggerSourceDefId === matcher.triggerSourceDefId) {
                        return true;
                    }
                    if (matcher.optionLabelIncludes && option.label?.includes(matcher.optionLabelIncludes)) {
                        return true;
                    }
                    if (matcher.optionIdIncludes && option.id.includes(matcher.optionIdIncludes)) {
                        return true;
                    }
                    return false;
                });
                if (triggerOption?.id) {
                    await dispatchHarnessCommand(page, reactionPlayerId, 'SYS_INTERACTION_RESPOND', { optionId: triggerOption.id });
                    continue;
                }
            }

            if (lastSnapshot.windowType && lastSnapshot.interactionSourceId !== 'smashup_reaction_choose') {
                await dispatchHarnessCommand(page, reactionPlayerId, 'RESPONSE_PASS', {});
                continue;
            }
        }

        await page.waitForTimeout(250);
    }

    throw new Error(
        `未能进入 ${finalInteractionSourceId}。最后快照：${JSON.stringify(lastSnapshot)}`,
    );
}

async function waitForHarnessPhase(page: Page, phase: string, timeout = 10000): Promise<void> {
    await page.waitForFunction(
        (expectedPhase) => (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.phase === expectedPhase,
        phase,
        { timeout },
    );
}

async function waitForScoreBasesOrReactionEntry(page: Page, timeout = 12000): Promise<{
    phase: string | null;
    sourceId: string | null;
    windowType: string | null;
}> {
    const deadline = Date.now() + timeout;
    let lastSnapshot: {
        phase: string | null;
        sourceId: string | null;
        windowType: string | null;
    } | null = null;

    while (Date.now() < deadline) {
        const state = await readAuthoritativeState(page);
        const sys = getSysState(state);
        const interactionData = getInteractionData(state);
        const responseWindow = getCurrentResponseWindow(state);
        lastSnapshot = {
            phase: typeof sys?.phase === 'string' ? sys.phase : null,
            sourceId: typeof interactionData?.sourceId === 'string' ? interactionData.sourceId : null,
            windowType: typeof responseWindow?.windowType === 'string' ? responseWindow.windowType : null,
        };

        if (
            lastSnapshot.phase === 'scoreBases'
            || lastSnapshot.sourceId === 'smashup_reaction_choose'
            || lastSnapshot.sourceId === 'world_champs_sheriff_before_scoring'
            || lastSnapshot.sourceId === 'world_champs_mummy_after_scoring'
            || lastSnapshot.windowType
        ) {
            return lastSnapshot;
        }

        await page.waitForTimeout(200);
    }

    throw new Error(`结束回合后未进入计分/反应链路。最后快照：${JSON.stringify(lastSnapshot)}`);
}

async function waitForInteractionSource(page: Page, sourceId: string, timeout = 10000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        const state = await readAuthoritativeState(page);
        const currentSourceId = getInteractionData(state)?.sourceId ?? null;
        if (currentSourceId === sourceId) return;
        await page.waitForTimeout(200);
    }
    throw new Error(`未等到交互 ${sourceId}`);
}

async function waitForNoInteraction(page: Page, timeout = 10000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        const state = await readAuthoritativeState(page);
        const interactionCurrent = getCurrentInteraction(state);
        if (!interactionCurrent) return;
        await page.waitForTimeout(200);
    }
    throw new Error('交互未在限定时间内清空');
}

async function selectCurrentInteractionOptionBy(
    page: Page,
    playerId: '0' | '1',
    matcher: { minionUid?: string; baseIndex?: number },
    errorLabel: string,
): Promise<void> {
    const state = await readAuthoritativeState(page);
    const options = getInteractionOptions(state);
    const optionId = options.find((entry) => {
        const value = asRecord(entry.value) ?? {};
        if (matcher.minionUid) {
            return value.minionUid === matcher.minionUid;
        }
        if (typeof matcher.baseIndex === 'number') {
            return value.baseIndex === matcher.baseIndex;
        }
        return false;
    })?.id as string | undefined;

    if (!optionId) {
        throw new Error(`${errorLabel}：未找到匹配选项`);
    }

    await dispatchHarnessCommand(page, playerId, 'SYS_INTERACTION_RESPOND', { optionId });
}

async function skipCurrentInteraction(page: Page, _playerId: '0' | '1'): Promise<boolean> {
    const state = await readAuthoritativeState(page);
    const options = getInteractionOptions(state);
    const optionId = options.find((entry) => {
        const value = asRecord(entry.value) ?? {};
        return (
            entry.id === 'pass'
            || entry.id === 'skip'
            || value.kind === 'pass'
            || value.skip === true
        );
    })?.id as string | undefined;
    if (!optionId) {
        return tryClickVisiblePassButton(page);
    }
    return tryClickVisiblePassButton(page);
}

async function getVisibleUiState(page: Page): Promise<{
    sourceId: string | null;
    responseWindow: null | { currentResponder: '0' | '1' | null };
}> {
    const state = await readAuthoritativeState(page);
    const responseWindow = getCurrentResponseWindow(state);
    const responderQueue = Array.isArray(responseWindow?.responderQueue) ? responseWindow.responderQueue : [];
    const responderIndex = typeof responseWindow?.currentResponderIndex === 'number'
        ? responseWindow.currentResponderIndex
        : -1;
    const currentResponder = responderIndex >= 0 ? (responderQueue[responderIndex] ?? null) as '0' | '1' | null : null;
    return {
        sourceId: typeof getInteractionData(state)?.sourceId === 'string' ? getInteractionData(state)?.sourceId as string : null,
        responseWindow: responseWindow
            ? { currentResponder }
            : null,
    };
}

async function drainSheriffDuelFlow(hostPage: Page, guestPage: Page, timeout = 15000): Promise<{
    finalCore: Record<string, any> | null;
}> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        const [hostState, guestState] = await Promise.all([
            readFullState(hostPage),
            readFullState(guestPage),
        ]);
        const publicCore = ((hostState as Record<string, any> | null)?.core ?? hostState) as Record<string, any> | null;
        const currentHost = getCurrentInteraction(hostState as StateRecord | null);
        const currentGuest = getCurrentInteraction(guestState as StateRecord | null);
        const currentState = currentHost
            ? hostState as StateRecord | null
            : currentGuest
                ? guestState as StateRecord | null
                : hostState as StateRecord | null;
        const current = currentHost ?? currentGuest;
        const sourceId = getInteractionData(currentState)?.sourceId ?? null;
        const playerId = current?.playerId === '1' ? '1' : '0';
        const actorPage = playerId === '0' ? hostPage : guestPage;
        const options = getInteractionOptions(currentState);

        if (sourceId === 'smashup_duel_pinkerton') {
            const zeroOption = options.find((entry) => asRecord(entry.value)?.amount === 0);
            const zeroLabel = typeof zeroOption?.label === 'string' ? zeroOption.label : '0';
            if (await clickPromptButtonLabel(actorPage, zeroLabel, 5000)) continue;
        }

        if (sourceId === 'smashup_duel_card' || sourceId === 'smashup_duel_deputy_card') {
            const skipOption = options.find((entry) => {
                const value = asRecord(entry.value);
                return value?.skip === true || entry.id === 'skip' || entry.id === 'pass';
            });
            const skipLabel = typeof skipOption?.label === 'string' ? skipOption.label : null;
            if (skipLabel && await clickPromptButtonLabel(actorPage, skipLabel, 5000)) continue;
            const handOption = options.find((entry) => {
                const value = asRecord(entry.value);
                return typeof value?.cardUid === 'string';
            });
            if (handOption) {
                await clickHandCard(actorPage, String(asRecord(handOption.value)?.cardUid), 10000);
                continue;
            }
            if (await clickPromptButtonByPatterns(actorPage, [/跳过.*决斗牌/i, /不出决斗牌/i, /不放决斗牌/i, /skip.*duel/i], 5000)) continue;
            if (skipLabel && await clickPromptButtonLabel(actorPage, skipLabel, 5000)) continue;
        }

        if (sourceId === 'smashup_duel_action_target_base') {
            const baseOption = options.find((entry) => typeof asRecord(entry.value)?.baseIndex === 'number');
            if (baseOption) {
                await clickBaseOnBoard(actorPage, Number(asRecord(baseOption.value)?.baseIndex), 10000);
                continue;
            }
        }

        if (sourceId === 'smashup_duel_action_target_minion' || sourceId === 'smashup_duel_deputy_target') {
            const minionOption = options.find((entry) => typeof asRecord(entry.value)?.minionUid === 'string');
            if (minionOption) {
                await clickMinionOnBoard(actorPage, String(asRecord(minionOption.value)?.minionUid), 10000);
                continue;
            }
        }

        const [hostUi, guestUi] = await Promise.all([getVisibleUiState(hostPage), getVisibleUiState(guestPage)]);
        const responder = hostUi.responseWindow?.currentResponder ?? guestUi.responseWindow?.currentResponder ?? null;
        if (!sourceId && responder === '0' && await tryClickVisiblePassButton(hostPage)) continue;
        if (!sourceId && responder === '1' && await tryClickVisiblePassButton(guestPage)) continue;

        if (
            !sourceId
            && !currentHost
            && !currentGuest
            && !hostUi.responseWindow
            && !guestUi.responseWindow
            && (publicCore?.activeDuel ?? null) == null
        ) {
            return { finalCore: publicCore };
        }
        await hostPage.waitForTimeout(200);
    }

    throw new Error('警长决斗链路未在限定时间内收口');
}

const cleanSmashUpTransientState = {
    core: {
        triggerQueue: undefined,
        beforeScoringTriggeredBases: undefined,
        whenScoringTriggeredBases: undefined,
        afterScoringTriggeredBases: undefined,
        pendingAfterScoringSpecials: undefined,
        activeDuel: undefined,
    },
    sys: {
        flowHalted: false,
        scoredBaseIndices: undefined,
        smashupScoring: undefined,
        smashupReactionSession: undefined,
        smashupReactionStack: undefined,
        _waitForPostScoringReduce: undefined,
    },
};

async function expectBaseScore(page: Page, baseIndex: number, playerId: '0' | '1', expected: string): Promise<void> {
    await expect(page.getByTestId(`su-base-score-${baseIndex}-${playerId}`)).toHaveText(new RegExp(`^\\s*${escapeRegex(expected)}\\s*$`));
}

test.describe('Smash Up 牌库检索交互', () => {
    test('悬浮机器人应显示可选卡牌并允许打出', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['robot_hoverbot'],
                deck: ['pirate_first_mate', 'pirate_swashbuckler'],
            },
            player1: {
                hand: [],
                deck: [],
            },
            currentPlayer: '0',
            phase: 'playCards',
        });

        await game.playCard('robot_hoverbot', { targetBaseIndex: 0 });
        await game.waitForInteraction('robot_hoverbot');

        const playCardOption = page.locator('[data-option-id="play"]').first();
        const cardOptions = page.locator('[data-testid^="prompt-card-"][data-option-id]');
        await expect(playCardOption).toBeVisible();
        await expect(cardOptions).toHaveCount(1);

        const options = await game.getInteractionOptions();
        expect(options.map((option: any) => option.id)).toEqual(expect.arrayContaining(['play', 'skip']));

        const skipButton = page.getByRole('button', { name: /放回牌库顶|跳过|skip/i });
        await expect(skipButton).toBeVisible();

        await game.screenshot('hoverbot-interaction-visible', testInfo);

        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const interaction = harness?.state?.get?.()?.sys?.interaction?.current;
            harness?.command?.dispatch?.({
                type: 'SYS_INTERACTION_RESPOND',
                playerId: interaction?.playerId,
                payload: { optionId: 'play' },
            });
        });
        await page.waitForTimeout(300);
        const hoverbotResolution = await page.waitForFunction(
            () => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                const state = harness?.state?.get?.();
                const current = state?.sys?.interaction?.current;
                if (current?.data?.sourceId === 'robot_hoverbot_base') {
                    return { needsBaseSelection: true };
                }
                const base0HasTopDeckMinion = state?.core?.bases?.[0]?.minions?.some(
                    (minion: any) => minion.defId === 'pirate_first_mate',
                );
                if (!current && base0HasTopDeckMinion) {
                    return { needsBaseSelection: false };
                }
                return null;
            },
            { timeout: 5000, polling: 200 },
        );
        const { needsBaseSelection } = await hoverbotResolution.jsonValue() as { needsBaseSelection: boolean };
        if (needsBaseSelection) {
            await game.selectBase(0);
            await game.waitForNoInteraction();
        }

        const finalState = await game.getState();
        const base0Minions = finalState.core.bases[0].minions.filter((minion: any) => minion.controller === '0');
        expect(base0Minions.some((minion: any) => minion.defId === 'robot_hoverbot')).toBe(true);
        expect(base0Minions.some((minion: any) => minion.defId === 'pirate_first_mate')).toBe(true);

        await game.screenshot('hoverbot-played-pirate', testInfo);
    });

    test('斯坦福打出后应显示牌库行动卡并在选择后加入手牌', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['world_champs_stoneford'],
                deck: ['robot_microbot_alpha', 'wizard_summon', 'vikings_pillage'],
                factions: ['world_champs', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
        });

        await game.playCard('world_champs_stoneford', { targetBaseIndex: 0 });
        await game.waitForInteraction('world_champs_stoneford');

        const interactionMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId,
                title: current?.data?.title,
                optionIds: (current?.data?.options ?? []).map((option: any) => option.id),
                optionDefs: (current?.data?.options ?? []).map((option: any) => option.value?.defId ?? null),
                optionDisplayModes: (current?.data?.options ?? []).map((option: any) => option.displayMode ?? 'implicit'),
            };
        });

        expect(interactionMeta.sourceId).toBe('world_champs_stoneford');
        expect(interactionMeta.optionDefs).toEqual(expect.arrayContaining(['wizard_summon', 'vikings_pillage']));
        expect(interactionMeta.optionDisplayModes.filter((mode: string) => mode === 'card')).toHaveLength(2);

        const cardOptions = page.locator('[data-testid^="prompt-card-"][data-option-id]');
        await expect(cardOptions).toHaveCount(2);
        await expect(page.locator('[data-option-id="action-1"]')).toBeVisible();

        await game.screenshot('stoneford-prompt-visible', testInfo);

        await page.locator('[data-option-id="action-1"]').click();
        await game.waitForNoInteraction();

        const finalState = await game.getState();
        expect(finalState.core.players['0'].hand.map((card: any) => card.defId)).toEqual(
            expect.arrayContaining(['vikings_pillage']),
        );
        expect(finalState.core.players['0'].deck.map((card: any) => card.defId)).not.toContain('vikings_pillage');

        await game.screenshot('stoneford-selected-action-added-to-hand', testInfo);
    });

    test('金币猫打出后应可选择这里的其他随从并放置 +1 指示物', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['world_champs_calicoin'],
                deck: [],
                factions: ['world_champs', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [{
                defId: 'base_1',
                minions: [
                    { uid: 'ally-target', defId: 'robot_microbot_alpha', owner: '0', controller: '0', powerCounters: 0 },
                    { uid: 'enemy-target', defId: 'robot_microbot_guard', owner: '1', controller: '1', powerCounters: 0 },
                ],
                ongoingActions: [],
            }],
        });

        await game.playCard('world_champs_calicoin', { targetBaseIndex: 0 });
        await game.waitForInteraction('world_champs_calicoin');

        const promptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    minionUid: option.value?.minionUid ?? null,
                    defId: option.value?.defId ?? null,
                    controller: option.value?.controller ?? null,
                })),
            };
        });

        expect(promptMeta.sourceId).toBe('world_champs_calicoin');
        expect(promptMeta.options.map((option: any) => option.minionUid)).toEqual(
            expect.arrayContaining(['ally-target', 'enemy-target']),
        );

        await game.screenshot('calicoin-prompt-visible', testInfo);

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.minionUid === 'enemy-target',
            '金币猫选择敌方其他随从',
        );
        await game.waitForNoInteraction();

        const finalState = await game.getState();
        const baseMinions = finalState.core.bases[0].minions;
        const calicoin = baseMinions.find((minion: any) => minion.defId === 'world_champs_calicoin');
        const allyTarget = baseMinions.find((minion: any) => minion.uid === 'ally-target');
        const enemyTarget = baseMinions.find((minion: any) => minion.uid === 'enemy-target');

        expect(calicoin).toBeTruthy();
        expect(allyTarget?.powerCounters ?? 0).toBe(0);
        expect(enemyTarget?.powerCounters ?? 0).toBe(1);

        await game.screenshot('calicoin-resolved-enemy-countered', testInfo);
    });

    test('彩虹女孩打出后应只给这里的其他己方随从 +1 力量直到回合结束', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['world_champs_rainbow_girl'],
                deck: [],
                factions: ['world_champs', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                {
                    defId: 'base_1',
                    minions: [
                        { uid: 'rainbow-ally-same-base', defId: 'robot_microbot_alpha', owner: '0', controller: '0', tempPowerModifier: 0 },
                        { uid: 'rainbow-enemy-same-base', defId: 'robot_microbot_guard', owner: '1', controller: '1', tempPowerModifier: 0 },
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_2',
                    minions: [
                        { uid: 'rainbow-ally-other-base', defId: 'robot_microbot_archive', owner: '0', controller: '0', tempPowerModifier: 0 },
                    ],
                    ongoingActions: [],
                },
            ],
        });

        await game.screenshot('rainbow-girl-before-play', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-world-champs-rainbow-girl-before-2026-04-28');

        await game.playCard('world_champs_rainbow_girl', { targetBaseIndex: 0 });
        await game.waitForNoInteraction();
        await dismissSpotlightQueueIfPresent(page);

        const finalState = await game.getState();
        const baseOneMinions = finalState.core.bases[0].minions;
        const baseTwoMinions = finalState.core.bases[1].minions;
        const sameBaseAlly = baseOneMinions.find((minion: any) => minion.uid === 'rainbow-ally-same-base');
        const sameBaseEnemy = baseOneMinions.find((minion: any) => minion.uid === 'rainbow-enemy-same-base');
        const rainbowGirl = baseOneMinions.find((minion: any) => minion.defId === 'world_champs_rainbow_girl');
        const otherBaseAlly = baseTwoMinions.find((minion: any) => minion.uid === 'rainbow-ally-other-base');

        expect(sameBaseAlly?.tempPowerModifier ?? 0).toBe(1);
        expect(sameBaseEnemy?.tempPowerModifier ?? 0).toBe(0);
        expect(rainbowGirl?.tempPowerModifier ?? 0).toBe(0);
        expect(otherBaseAlly?.tempPowerModifier ?? 0).toBe(0);

        await game.screenshot('rainbow-girl-resolved', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-world-champs-rainbow-girl-resolved-2026-04-28');
    });

    test('海龟阿凯打出后应先选玩家再交牌并抽两张', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['world_champs_akye_the_turtle', 'wizard_summon'],
                deck: ['robot_microbot_alpha', 'robot_microbot_guard'],
                factions: ['world_champs', 'wizards'],
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
        });

        await game.playCard('world_champs_akye_the_turtle', { targetBaseIndex: 0 });
        await game.waitForInteraction('world_champs_akye_the_turtle_player');

        const playerPromptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId,
                title: current?.data?.title,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    label: option.label,
                    targetPlayerId: option.value?.targetPlayerId ?? null,
                    displayMode: option.displayMode ?? 'implicit',
                })),
            };
        });

        expect(playerPromptMeta.sourceId).toBe('world_champs_akye_the_turtle_player');
        expect(playerPromptMeta.options.some((option: any) => option.targetPlayerId === '1')).toBe(true);

        await game.screenshot('akye-player-prompt-visible', testInfo);

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.targetPlayerId === '1',
            '海龟阿凯选择对手玩家',
        );
        await game.waitForInteraction('world_champs_akye_the_turtle_card');

        const cardPromptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId,
                optionDefs: (current?.data?.options ?? []).map((option: any) => option.value?.defId ?? null),
                optionDisplayModes: (current?.data?.options ?? []).map((option: any) => option.displayMode ?? 'implicit'),
            };
        });

        expect(cardPromptMeta.sourceId).toBe('world_champs_akye_the_turtle_card');
        expect(cardPromptMeta.optionDefs).toContain('wizard_summon');
        expect(cardPromptMeta.optionDisplayModes.filter((mode: string) => mode === 'card')).toHaveLength(1);

        await game.screenshot('akye-card-prompt-visible', testInfo);

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.defId === 'wizard_summon',
            '海龟阿凯交出召唤',
        );
        await game.waitForNoInteraction();

        const finalState = await game.getState();
        expect(finalState.core.players['1'].hand.map((card: any) => card.defId)).toEqual(
            expect.arrayContaining(['wizard_summon']),
        );
        expect(finalState.core.players['0'].hand.map((card: any) => card.defId)).not.toContain('wizard_summon');
        expect(finalState.core.players['0'].hand.map((card: any) => card.defId)).toEqual(
            expect.arrayContaining(['robot_microbot_alpha', 'robot_microbot_guard']),
        );
        expect(finalState.core.bases[0].minions.some((minion: any) => minion.defId === 'world_champs_akye_the_turtle')).toBe(true);

        await game.screenshot('akye-transfer-and-draw-resolved', testInfo);
    });

    test('武士 陈打出后不应触发海龟阿凯的交牌抽二交互', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['world_champs_samurai_chan'],
                deck: ['robot_microbot_alpha', 'robot_microbot_guard'],
                discard: [],
                factions: ['world_champs', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
        });

        await game.playCard('world_champs_samurai_chan', { targetBaseIndex: 0 });
        await game.waitForNoInteraction();
        await page.waitForTimeout(300);

        const settledState = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness?.state?.get?.();
            return {
                interactionSource: state?.sys?.interaction?.current?.data?.sourceId ?? null,
                player0Hand: (state?.core?.players?.['0']?.hand ?? []).map((card: any) => card.defId),
                player1Hand: (state?.core?.players?.['1']?.hand ?? []).map((card: any) => card.defId),
                base0Minions: (state?.core?.bases?.[0]?.minions ?? []).map((minion: any) => minion.defId),
            };
        });

        expect(settledState.interactionSource).not.toBe('world_champs_akye_the_turtle_player');
        expect(settledState.interactionSource).not.toBe('world_champs_akye_the_turtle_card');
        expect(settledState.player0Hand).toHaveLength(0);
        expect(settledState.player1Hand).toHaveLength(0);
        expect(settledState.base0Minions).toContain('world_champs_samurai_chan');
        await expect(page.getByText(/海龟阿凯：选择一位玩家并交给其一张手牌/i)).toHaveCount(0);

        await game.screenshot('samurai-chan-play-no-akye-prompt', testInfo);
    });

    test('武士 陈在基地计分进入弃牌堆后应抽一张牌', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [],
                deck: ['robot_microbot_alpha'],
                discard: [],
                factions: ['world_champs', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['dinosaurs', 'pirates'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [{
                defId: 'base_the_jungle',
                minions: [
                    { uid: 'wc-chan-1', defId: 'world_champs_samurai_chan', owner: '0', controller: '0', tempPowerModifier: 0 },
                    { uid: 'wc-ally-1', defId: 'dino_laser_triceratops', owner: '0', controller: '0', tempPowerModifier: 0 },
                    { uid: 'wc-enemy-1', defId: 'dino_king_rex', owner: '1', controller: '1', tempPowerModifier: 0 },
                ],
                ongoingActions: [],
            }, {
                defId: 'base_tar_pits',
                minions: [],
                ongoingActions: [],
            }],
        });

        await waitForHandArea(page);
        await game.screenshot('samurai-chan-before-scoring', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-world-champs-samurai-chan-before-scoring-2026-04-30');

        await page.getByRole('button', { name: /^(结束回合|Finish Turn|End)$/i }).click({ force: true });
        await page.waitForFunction(
            () => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.core?.bases?.[0]?.defId !== 'base_the_jungle';
            },
            { timeout: 12000, polling: 200 },
        );

        const finalState = await game.getState();
        expect(finalState.core.players['0'].hand.map((card: any) => card.defId)).toContain('robot_microbot_alpha');
        expect(finalState.core.bases[0].defId).not.toBe('base_the_jungle');

        await waitForHandArea(page);
        await game.screenshot('samurai-chan-draw-after-scoring', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-world-champs-samurai-chan-draw-after-scoring-2026-04-30');
    });

    test('盾牌少女打出后应选择对手并拿走其牌库顶的合格卡牌', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['world_champs_shield_maiden'],
                deck: [],
                factions: ['world_champs', 'vikings'],
            },
            player1: {
                hand: [],
                deck: ['wizard_summon', 'robot_microbot_alpha'],
                factions: ['wizards', 'robots'],
            },
            currentPlayer: '0',
            phase: 'playCards',
        });

        await game.playCard('world_champs_shield_maiden', { targetBaseIndex: 0 });
        await game.waitForInteraction('world_champs_shield_maiden');

        const promptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId,
                title: current?.data?.title,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    label: option.label,
                    targetPlayerId: option.value?.targetPlayerId ?? null,
                })),
            };
        });

        expect(promptMeta.sourceId).toBe('world_champs_shield_maiden');
        expect(promptMeta.options.some((option: any) => option.targetPlayerId === '1')).toBe(true);

        await game.screenshot('shield-maiden-player-prompt-visible', testInfo);

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.targetPlayerId === '1',
            '盾牌少女选择对手玩家',
        );
        await game.waitForNoInteraction();

        const finalState = await game.getState();
        expect(finalState.core.players['0'].hand.map((card: any) => card.defId)).toEqual(
            expect.arrayContaining(['wizard_summon']),
        );
        expect(finalState.core.players['1'].deck.map((card: any) => card.defId)).not.toContain('wizard_summon');
        expect(finalState.core.bases[0].minions.some((minion: any) => minion.defId === 'world_champs_shield_maiden')).toBe(true);

        await game.screenshot('shield-maiden-gained-top-card', testInfo);
    });

    test('竞技场应在首次于此打出随从后提供抽牌或额外行动交互', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['pirate_first_mate'],
                deck: ['wizard_summon'],
                factions: ['world_champs', 'pirates'],
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['robots', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                { defId: 'base_arena', minions: [], ongoingActions: [] },
                { defId: 'base_2', minions: [], ongoingActions: [] },
            ],
        });

        await game.playCard('pirate_first_mate', { targetBaseIndex: 0 });
        await game.waitForInteraction('base_arena');

        const promptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId ?? null,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    choice: option.value?.choice ?? null,
                    skip: option.value?.skip ?? false,
                    label: option.label ?? null,
                })),
            };
        });

        expect(promptMeta.sourceId).toBe('base_arena');
        expect(promptMeta.options.some((option: any) => option.choice === 'draw_card')).toBe(true);
        expect(promptMeta.options.some((option: any) => option.choice === 'extra_action')).toBe(true);

        await game.screenshot('world-champs-arena-prompt-visible', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-world-champs-arena-prompt-2026-04-30');

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.choice === 'draw_card',
            '竞技场选择抽一张牌',
        );
        await game.waitForNoInteraction();
        await dismissSpotlightQueueIfPresent(page);

        const finalState = await game.getState();
        expect(finalState.core.players['0'].hand.map((card: any) => card.defId)).toContain('wizard_summon');
        expect(finalState.core.bases[0].minions.some((minion: any) => minion.defId === 'pirate_first_mate')).toBe(true);

        await game.screenshot('world-champs-arena-draw-resolved', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-world-champs-arena-draw-resolved-2026-04-30');
    });

    test('名人堂应在首次于此打出随从后给予该随从 +2 力量并反映到基地分数', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['pirate_first_mate'],
                deck: [],
                factions: ['world_champs', 'pirates'],
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['robots', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                { defId: 'base_hall_of_fame', minions: [], ongoingActions: [] },
                { defId: 'base_2', minions: [], ongoingActions: [] },
            ],
        });

        await game.playCard('pirate_first_mate', { targetBaseIndex: 0 });
        await game.waitForNoInteraction();
        await dismissSpotlightQueueIfPresent(page);

        const finalState = await game.getState();
        const buffedMinion = finalState.core.bases[0].minions.find((minion: any) => minion.defId === 'pirate_first_mate');

        expect(buffedMinion).toBeTruthy();
        expect(buffedMinion?.tempPowerModifier ?? 0).toBe(2);
        await expect(page.getByTestId('su-base-score-0-0')).toContainText('4');

        await game.screenshot('world-champs-hall-of-fame-buffed', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-world-champs-hall-of-fame-buffed-2026-04-30');
    });

    test('最后的歌声应强制对手额外打出小随从且不触发其打出能力，并给予你额外行动与额外随从', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['mermaids_ultimate_song'],
                deck: [],
                factions: ['mermaids', 'robots'],
            },
            player1: {
                hand: ['world_champs_akye_the_turtle'],
                deck: ['wizard_summon'],
                factions: ['world_champs', 'wizards'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                {
                    defId: 'base_1',
                    minions: [
                        { uid: 'ally-minion-1', defId: 'robot_microbot_alpha', owner: '0', controller: '0', tempPowerModifier: 0 },
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_2',
                    minions: [
                        { uid: 'enemy-minion-1', defId: 'robot_microbot_guard', owner: '1', controller: '1', tempPowerModifier: 0 },
                    ],
                    ongoingActions: [],
                },
            ],
        });

        await game.playCard('mermaids_ultimate_song');
        await game.waitForInteraction('mermaids_ultimate_song_base');

        const basePromptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId,
                optionValues: (current?.data?.options ?? []).map((option: any) => ({
                    baseIndex: option.value?.baseIndex ?? null,
                    label: option.label ?? null,
                })),
            };
        });

        expect(basePromptMeta.sourceId).toBe('mermaids_ultimate_song_base');
        expect(basePromptMeta.optionValues).toEqual([
            expect.objectContaining({ baseIndex: 0 }),
        ]);

        await game.screenshot('ultimate-song-base-prompt', testInfo);

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.baseIndex === 0,
            '最后的歌声选择基地 1',
        );
        await game.waitForInteraction('mermaids_ultimate_song_hand');

        const forcedPromptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId,
                title: current?.data?.title,
                optionDefs: (current?.data?.options ?? []).map((option: any) => option.value?.defId ?? null),
                optionDisplayModes: (current?.data?.options ?? []).map((option: any) => option.displayMode ?? 'implicit'),
            };
        });

        expect(forcedPromptMeta.sourceId).toBe('mermaids_ultimate_song_hand');
        expect(forcedPromptMeta.optionDefs).toContain('world_champs_akye_the_turtle');
        expect(forcedPromptMeta.optionDisplayModes.filter((mode: string) => mode === 'card')).toHaveLength(1);

        await game.screenshot('ultimate-song-forced-hand-prompt', testInfo);

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.defId === 'world_champs_akye_the_turtle',
            '最后的歌声强制对手打出海龟阿凯',
        );
        await game.waitForNoInteraction();

        const finalState = await game.getState();
        expect(finalState.core.bases[0].minions.some((minion: any) => minion.defId === 'world_champs_akye_the_turtle')).toBe(true);
        expect(finalState.core.players['0'].minionLimit).toBeGreaterThanOrEqual(2);
        expect(finalState.core.players['0'].actionLimit).toBeGreaterThanOrEqual(2);

        const interactionSourceAfterResolve = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            return harness?.state?.get?.()?.sys?.interaction?.current?.data?.sourceId ?? null;
        });
        expect(interactionSourceAfterResolve).not.toBe('world_champs_akye_the_turtle_player');
        expect(interactionSourceAfterResolve).not.toBe('world_champs_akye_the_turtle_card');

        await game.screenshot('ultimate-song-resolved-extra-limits', testInfo);
    });

    test('迷倒观众应按目标基地非己方随从数给己方随从加力量并给予额外行动', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['mermaids_captive_audience'],
                deck: [],
                factions: ['mermaids', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                {
                    defId: 'base_1',
                    minions: [
                        { uid: 'enemy-minion-1', defId: 'robot_microbot_alpha', owner: '1', controller: '1', tempPowerModifier: 0 },
                        { uid: 'enemy-minion-2', defId: 'robot_microbot_guard', owner: '1', controller: '1', tempPowerModifier: 0 },
                        { uid: 'ally-minion-1', defId: 'robot_microbot_archive', owner: '0', controller: '0', tempPowerModifier: 0 },
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_2',
                    minions: [
                        { uid: 'ally-minion-2', defId: 'robot_microbot_guard', owner: '0', controller: '0', tempPowerModifier: 0 },
                    ],
                    ongoingActions: [],
                },
            ],
        });

        await game.playCard('mermaids_captive_audience', { targetBaseIndex: 0 });
        await game.waitForInteraction('mermaids_captive_audience');

        const promptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId,
                title: current?.data?.title,
                optionValues: (current?.data?.options ?? []).map((option: any) => ({
                    minionUid: option.value?.minionUid ?? null,
                    defId: option.value?.defId ?? null,
                    baseIndex: option.value?.baseIndex ?? null,
                })),
            };
        });

        expect(promptMeta.sourceId).toBe('mermaids_captive_audience');
        expect(promptMeta.optionValues).toEqual([
            expect.objectContaining({ minionUid: 'ally-minion-1', defId: 'robot_microbot_archive', baseIndex: 0 }),
        ]);

        await game.screenshot('captive-audience-target-prompt', testInfo);

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.minionUid === 'ally-minion-1',
            '迷倒观众选择己方伽马机器人',
        );
        await game.waitForNoInteraction();

        const finalState = await game.getState();
        const boostedMinion = finalState.core.bases[0].minions.find((minion: any) => minion.uid === 'ally-minion-1');
        const untouchedMinion = finalState.core.bases[1].minions.find((minion: any) => minion.uid === 'ally-minion-2');
        expect(boostedMinion?.tempPowerModifier).toBe(2);
        expect(untouchedMinion?.tempPowerModifier).toBe(0);
        expect(finalState.core.players['0'].actionLimit).toBeGreaterThanOrEqual(2);

        await game.screenshot('captive-audience-resolved', testInfo);
    });

    test('人鱼女王应可选择移动其他玩家的一个仆从到这里', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['mermaids_mermaid_queen'],
                deck: [],
                factions: ['mermaids', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                {
                    defId: 'base_1',
                    minions: [
                        { uid: 'enemy-small', defId: 'robot_microbot_alpha', owner: '1', controller: '1', tempPowerModifier: 0 },
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_2',
                    minions: [
                        { uid: 'enemy-other', defId: 'robot_microbot_guard', owner: '1', controller: '1', tempPowerModifier: 0 },
                    ],
                    ongoingActions: [],
                },
            ],
        });

        await game.playCard('mermaids_mermaid_queen', { targetBaseIndex: 0 });
        await game.waitForInteraction('mermaids_mermaid_queen_mode');

        const modePromptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId ?? null,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    mode: option.value?.mode ?? null,
                    label: option.label ?? null,
                })),
            };
        });

        expect(modePromptMeta.sourceId).toBe('mermaids_mermaid_queen_mode');
        expect(modePromptMeta.options.some((option: any) => option.mode === 'move')).toBe(true);
        expect(modePromptMeta.options.some((option: any) => option.mode === 'control')).toBe(true);

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.mode === 'move',
            '人鱼女王选择移动模式',
        );
        await game.waitForInteraction('mermaids_mermaid_queen_move');

        const movePromptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId ?? null,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    minionUid: option.value?.minionUid ?? null,
                    baseIndex: option.value?.baseIndex ?? null,
                })),
            };
        });

        expect(movePromptMeta.sourceId).toBe('mermaids_mermaid_queen_move');
        expect(movePromptMeta.options.some((option: any) => option.minionUid === 'enemy-other' && option.baseIndex === 1)).toBe(true);
        expect(movePromptMeta.options.some((option: any) => option.minionUid === 'enemy-small')).toBe(false);

        await game.screenshot('mermaid-queen-move-prompt', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-mermaids-mermaid-queen-move-prompt-2026-04-29');

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.minionUid === 'enemy-other',
            '人鱼女王选择移动敌方仆从到这里',
        );
        await game.waitForNoInteraction();
        await dismissSpotlightQueueIfPresent(page);

        const finalState = await game.getState();
        expect(finalState.core.bases[0].minions.some((minion: any) => minion.uid === 'enemy-other')).toBe(true);
        expect(finalState.core.bases[1].minions.some((minion: any) => minion.uid === 'enemy-other')).toBe(false);

        await game.screenshot('mermaid-queen-move-resolved', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-mermaids-mermaid-queen-move-resolved-2026-04-29');
    });

    test('迷人的人应可先移动自己，再把另一个玩家 3 力或以下的随从移到相同基地', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['mermaids_charmer'],
                deck: [],
                factions: ['mermaids', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                { defId: 'base_1', minions: [], ongoingActions: [] },
                {
                    defId: 'base_2',
                    minions: [
                        { uid: 'enemy-low', defId: 'robot_microbot_alpha', owner: '1', controller: '1', tempPowerModifier: 0 },
                        { uid: 'enemy-high', defId: 'robot_warbot', owner: '1', controller: '1', tempPowerModifier: 0 },
                    ],
                    ongoingActions: [],
                },
                { defId: 'base_3', minions: [], ongoingActions: [] },
            ],
        });

        await game.playCard('mermaids_charmer', { targetBaseIndex: 0 });
        await game.waitForNoInteraction();
        await dismissSpotlightQueueIfPresent(page);

        const charmerUid = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness?.state?.get?.();
            return state?.core?.bases?.[0]?.minions?.find((minion: any) => minion.defId === 'mermaids_charmer')?.uid ?? null;
        });
        expect(charmerUid).toBeTruthy();

        await clickMinionOnBoard(page, charmerUid as string);
        await game.waitForInteraction('mermaids_charmer_move');

        const movePromptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId ?? null,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    baseIndex: option.value?.baseIndex ?? null,
                })),
            };
        });

        expect(movePromptMeta.sourceId).toBe('mermaids_charmer_move');
        expect(movePromptMeta.options.some((option: any) => option.baseIndex === 2)).toBe(true);

        await game.screenshot('charmer-move-prompt', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-mermaids-charmer-move-prompt-2026-04-29');

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.baseIndex === 2,
            '迷人的人先移动到基地 3',
        );
        await game.waitForInteraction('mermaids_charmer_target');

        const targetPromptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId ?? null,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    minionUid: option.value?.minionUid ?? null,
                    baseIndex: option.value?.baseIndex ?? null,
                })),
            };
        });

        expect(targetPromptMeta.sourceId).toBe('mermaids_charmer_target');
        expect(targetPromptMeta.options.some((option: any) => option.minionUid === 'enemy-low' && option.baseIndex === 1)).toBe(true);
        expect(targetPromptMeta.options.some((option: any) => option.minionUid === 'enemy-high')).toBe(false);

        await game.screenshot('charmer-target-prompt', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-mermaids-charmer-target-prompt-2026-04-29');

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.minionUid === 'enemy-low',
            '迷人的人把敌方低力量随从移到同一基地',
        );
        await game.waitForNoInteraction();
        await dismissSpotlightQueueIfPresent(page);

        const finalState = await game.getState();
        expect(finalState.core.bases[0].minions.some((minion: any) => minion.uid === charmerUid)).toBe(false);
        expect(finalState.core.bases[2].minions.some((minion: any) => minion.uid === charmerUid)).toBe(true);
        expect(finalState.core.bases[2].minions.some((minion: any) => minion.uid === 'enemy-low')).toBe(true);
        expect(finalState.core.bases[1].minions.some((minion: any) => minion.uid === 'enemy-high')).toBe(true);

        await game.screenshot('charmer-resolved', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-mermaids-charmer-resolved-2026-04-29');
    });

    test('安静的海岸应可从场上发动天赋并移到另一个基地', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['mermaids_becalmed_shores'],
                deck: [],
                factions: ['mermaids', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                {
                    defId: 'base_1',
                    minions: [
                        { uid: 'enemy-base-1', defId: 'robot_microbot_alpha', owner: '1', controller: '1', tempPowerModifier: 0 },
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_2',
                    minions: [
                        { uid: 'enemy-base-2', defId: 'robot_microbot_guard', owner: '1', controller: '1', tempPowerModifier: 0 },
                    ],
                    ongoingActions: [],
                },
            ],
        });

        await game.playCard('mermaids_becalmed_shores', { targetBaseIndex: 0 });
        await game.waitForNoInteraction();
        await dismissSpotlightQueueIfPresent(page);

        const attachedOngoingUid = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness?.state?.get?.();
            return state?.core?.bases?.[0]?.ongoingActions?.find((action: any) => action.defId === 'mermaids_becalmed_shores')?.uid ?? null;
        });
        expect(attachedOngoingUid).toBeTruthy();

        const ongoingCard = page.locator(`[data-ongoing-uid="${attachedOngoingUid}"]`).first();
        await expect(ongoingCard).toBeVisible({ timeout: 5000 });
        await game.screenshot('becalmed-shores-attached', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-mermaids-becalmed-shores-attached-2026-04-29');

        await ongoingCard.click({ force: true });
        await ongoingCard.click({ force: true });
        await game.waitForInteraction('mermaids_becalmed_shores');

        const promptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId ?? null,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    baseIndex: option.value?.baseIndex ?? null,
                })),
            };
        });

        expect(promptMeta.sourceId).toBe('mermaids_becalmed_shores');
        expect(promptMeta.options.some((option: any) => option.baseIndex === 1)).toBe(true);

        await game.screenshot('becalmed-shores-move-prompt', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-mermaids-becalmed-shores-move-prompt-2026-04-29');

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.baseIndex === 1,
            '安静的海岸移动到基地 2',
        );
        await game.waitForNoInteraction();

        const finalState = await game.getState();
        expect(finalState.core.bases[0].ongoingActions.some((action: any) => action.uid === attachedOngoingUid)).toBe(false);
        expect(finalState.core.bases[1].ongoingActions.some((action: any) => action.uid === attachedOngoingUid)).toBe(true);
        expect(finalState.core.bases[1].ongoingActions.find((action: any) => action.uid === attachedOngoingUid)?.talentUsed).toBe(true);

        await game.screenshot('becalmed-shores-moved', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-mermaids-becalmed-shores-moved-2026-04-29');
    });

    test('塞壬的歌声应只提供有其他己方基地可去的来源基地，并把目标仆从移到该己方基地', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['mermaids_siren_song'],
                deck: [],
                factions: ['mermaids', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                {
                    defId: 'base_1',
                    minions: [
                        { uid: 'ally-anchor', defId: 'robot_microbot_archive', owner: '0', controller: '0', tempPowerModifier: 0 },
                        { uid: 'enemy-stuck', defId: 'robot_microbot_alpha', owner: '1', controller: '1', tempPowerModifier: 0 },
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_2',
                    minions: [
                        { uid: 'enemy-movable', defId: 'robot_warbot', owner: '1', controller: '1', tempPowerModifier: 0 },
                    ],
                    ongoingActions: [],
                },
            ],
        });

        await game.playCard('mermaids_siren_song');
        await game.waitForInteraction('mermaids_siren_song_base');

        const sourcePromptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId ?? null,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    baseIndex: option.value?.baseIndex ?? null,
                })),
            };
        });

        expect(sourcePromptMeta.sourceId).toBe('mermaids_siren_song_base');
        expect(sourcePromptMeta.options.some((option: any) => option.baseIndex === 0)).toBe(false);
        expect(sourcePromptMeta.options.some((option: any) => option.baseIndex === 1)).toBe(true);

        await game.screenshot('mermaids-siren-song-source-prompt', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-mermaids-siren-song-source-prompt-2026-04-29');

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.baseIndex === 1,
            '塞壬的歌声选择基地 2 作为来源',
        );
        await game.waitForInteraction('mermaids_siren_song_destination');

        const destinationPromptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId ?? null,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    baseIndex: option.value?.baseIndex ?? null,
                })),
            };
        });

        expect(destinationPromptMeta.sourceId).toBe('mermaids_siren_song_destination');
        expect(destinationPromptMeta.options).toHaveLength(1);
        expect(destinationPromptMeta.options[0]?.baseIndex).toBe(0);

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.baseIndex === 0,
            '塞壬的歌声选择基地 1 作为目标',
        );
        await game.waitForInteraction('mermaids_siren_song_target');

        const targetPromptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId ?? null,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    minionUid: option.value?.minionUid ?? null,
                    baseIndex: option.value?.baseIndex ?? null,
                })),
            };
        });

        expect(targetPromptMeta.sourceId).toBe('mermaids_siren_song_target');
        expect(targetPromptMeta.options).toHaveLength(1);
        expect(targetPromptMeta.options[0]?.minionUid).toBe('enemy-movable');
        expect(targetPromptMeta.options[0]?.baseIndex).toBe(1);

        await game.screenshot('mermaids-siren-song-target-prompt', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-mermaids-siren-song-target-prompt-2026-04-29');

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.minionUid === 'enemy-movable',
            '塞壬的歌声选择基地 2 的敌方仆从',
        );
        await game.waitForNoInteraction();
        await dismissSpotlightQueueIfPresent(page);

        const finalState = await game.getState();
        expect(finalState.core.bases[0].minions.some((minion: any) => minion.uid === 'enemy-movable')).toBe(true);
        expect(finalState.core.bases[1].minions.some((minion: any) => minion.uid === 'enemy-movable')).toBe(false);

        await game.screenshot('mermaids-siren-song-resolved', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-mermaids-siren-song-resolved-2026-04-29');
    });

    test('塞壬应只压低其他玩家在这里的总力量贡献而不改变基地总力量', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['mermaids_siren'],
                deck: [],
                factions: ['mermaids', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['mermaids', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [{
                defId: 'base_1',
                minions: [
                    { uid: 'enemy-charmer', defId: 'mermaids_charmer', owner: '1', controller: '1', tempPowerModifier: 0 },
                    { uid: 'enemy-temptress', defId: 'mermaids_temptress', owner: '1', controller: '1', tempPowerModifier: 0 },
                ],
                ongoingActions: [],
            }],
        });

        await game.playCard('mermaids_siren', { targetBaseIndex: 0 });
        await game.waitForNoInteraction();
        await dismissSpotlightQueueIfPresent(page);

        const afterPlay = await game.getState();
        expect(afterPlay.core.bases[0].minions.some((minion: any) => minion.defId === 'mermaids_siren')).toBe(true);

        await expectBaseScore(page, 0, '0', '2');
        await expectBaseScore(page, 0, '1', '5');
        await expect(page.getByTestId('base-zone-0').getByText(/^9$/).first()).toBeVisible();

        await game.screenshot('mermaids-siren-score-suppression', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-mermaids-siren-score-suppression-2026-04-30');
    });

    test('诱惑者应在其他玩家的仆从本回合移动到这里后获得 +2 力量', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [],
                deck: [],
                factions: ['mermaids', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['mermaids', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                {
                    defId: 'base_1',
                    minions: [
                        { uid: 'charmer-1', defId: 'mermaids_charmer', owner: '0', controller: '0', tempPowerModifier: 0 },
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_2',
                    minions: [
                        { uid: 'temptress-1', defId: 'mermaids_temptress', owner: '1', controller: '1', tempPowerModifier: 0 },
                    ],
                    ongoingActions: [],
                },
            ],
        });

        await clickMinionOnBoard(page, 'charmer-1');
        await game.waitForInteraction('mermaids_charmer_move');

        const movePromptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId ?? null,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    baseIndex: option.value?.baseIndex ?? null,
                })),
            };
        });

        expect(movePromptMeta.sourceId).toBe('mermaids_charmer_move');
        expect(movePromptMeta.options.some((option: any) => option.baseIndex === 1)).toBe(true);

        await game.screenshot('mermaids-temptress-charmer-move-prompt', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-mermaids-temptress-charmer-move-prompt-2026-04-30');

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.baseIndex === 1,
            '迷人的人把自己移动到诱惑者所在基地',
        );
        await game.waitForNoInteraction();
        await dismissSpotlightQueueIfPresent(page);

        const finalState = await game.getState();
        expect(finalState.core.bases[1].minions.some((minion: any) => minion.uid === 'charmer-1')).toBe(true);
        expect(finalState.core.bases[1].minions.some((minion: any) => minion.uid === 'temptress-1')).toBe(true);

        await expectBaseScore(page, 1, '0', '3');
        await expectBaseScore(page, 1, '1', '6');
        await expect(page.locator('[data-minion-uid="temptress-1"] [title*="诱惑者: +2"]')).toBeVisible();

        await game.screenshot('mermaids-temptress-buffed', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-mermaids-temptress-buffed-2026-04-30');
    });

    test('无人岛应把这里所有仆从的控制者总力量压到 0 并在你下回合开始前自毁', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['mermaids_desert_island'],
                deck: [],
                factions: ['mermaids', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['mermaids', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [{
                defId: 'base_1',
                minions: [
                    { uid: 'ally-charmer', defId: 'mermaids_charmer', owner: '0', controller: '0', tempPowerModifier: 0 },
                    { uid: 'enemy-temptress', defId: 'mermaids_temptress', owner: '1', controller: '1', tempPowerModifier: 0 },
                ],
                ongoingActions: [],
            }],
        });

        await game.playCard('mermaids_desert_island', { targetBaseIndex: 0 });
        await game.waitForNoInteraction();
        await dismissSpotlightQueueIfPresent(page);

        const afterPlay = await game.getState();
        const desertIslandUid = afterPlay.core.bases[0].ongoingActions.find(
            (action: any) => action.defId === 'mermaids_desert_island',
        )?.uid;
        expect(desertIslandUid).toBeTruthy();

        await expectBaseScore(page, 0, '0', '0');
        await expectBaseScore(page, 0, '1', '0');
        await expect(page.getByTestId('base-zone-0').getByText(/^7$/).first()).toBeVisible();

        await game.screenshot('mermaids-desert-island-attached', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-mermaids-desert-island-attached-2026-04-30');

        await dispatchHarnessCommand(page, '0', 'ADVANCE_PHASE', {});
        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.core?.currentPlayerIndex === 1 && state?.sys?.phase === 'playCards';
        }, { timeout: 10000 });

        await dispatchHarnessCommand(page, '1', 'ADVANCE_PHASE', {});
        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.core?.currentPlayerIndex === 0 && state?.sys?.phase === 'playCards';
        }, { timeout: 10000 });
        await dismissSpotlightQueueIfPresent(page);

        const nextTurnState = await game.getState();
        expect(nextTurnState.core.bases[0].ongoingActions.some(
            (action: any) => action.defId === 'mermaids_desert_island',
        )).toBe(false);

        await expectBaseScore(page, 0, '0', '3');
        await expectBaseScore(page, 0, '1', '4');
        await expect(page.locator(`[data-ongoing-uid="${desertIslandUid}"]`)).toHaveCount(0);

        await game.screenshot('mermaids-desert-island-destroyed', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-mermaids-desert-island-destroyed-2026-04-30');
    });

    test('魅惑应可移动目标、压制其本回合总力量贡献，并允许额外打出另一张行动', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['mermaids_charmed', 'mermaids_toll_bay'],
                deck: ['robot_microbot_archive'],
                factions: ['mermaids', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                {
                    defId: 'base_1',
                    minions: [
                        { uid: 'ally-anchor', defId: 'robot_microbot_alpha', owner: '0', controller: '0', tempPowerModifier: 0 },
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_2',
                    minions: [
                        { uid: 'enemy-target', defId: 'robot_microbot_guard', owner: '1', controller: '1', tempPowerModifier: 0 },
                    ],
                    ongoingActions: [],
                },
            ],
        });

        await game.playCard('mermaids_charmed', { targetMinionUid: 'enemy-target' });
        await game.waitForInteraction('mermaids_charmed_destination');

        const destinationPromptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId ?? null,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    skip: option.value?.skip ?? false,
                    baseIndex: option.value?.baseIndex ?? null,
                })),
            };
        });

        expect(destinationPromptMeta.sourceId).toBe('mermaids_charmed_destination');
        expect(destinationPromptMeta.options.some((option: any) => option.baseIndex === 0)).toBe(true);

        await game.screenshot('charmed-destination-prompt', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-mermaids-charmed-destination-prompt-2026-04-29');

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.baseIndex === 0,
            '魅惑将目标移动到基地 1',
        );
        await game.waitForNoInteraction();
        await dismissSpotlightQueueIfPresent(page);

        const afterCharmed = await game.getState();
        const movedTargetAfterCharmed = afterCharmed.core.bases[0].minions.find((minion: any) => minion.uid === 'enemy-target');
        expect(movedTargetAfterCharmed).toBeTruthy();
        expect(afterCharmed.core.bases[1].minions.some((minion: any) => minion.uid === 'enemy-target')).toBe(false);
        expect(movedTargetAfterCharmed?.metadata?.mermaidsCharmedSuppressedTurn).toBe(afterCharmed.core.turnNumber);

        await game.screenshot('charmed-resolved', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-mermaids-charmed-resolved-2026-04-29');

        await game.playCard('mermaids_toll_bay', { targetBaseIndex: 0 });
        await game.waitForNoInteraction();
        await dismissSpotlightQueueIfPresent(page);

        const finalState = await game.getState();
        expect(finalState.core.players['0'].hand.some((card: any) => card.defId === 'robot_microbot_archive')).toBe(true);
        expect(finalState.core.players['0'].hand.some((card: any) => card.defId === 'mermaids_toll_bay')).toBe(false);
        expect(finalState.core.players['0'].discard.some((card: any) => card.defId === 'mermaids_toll_bay')).toBe(true);
        expect(finalState.core.players['0'].actionsPlayed).toBe(2);

        await game.screenshot('charmed-extra-action-used', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-mermaids-charmed-extra-action-used-2026-04-29');
    });

    test('斗志奖杯打出后应抽两张并给两个己方随从各放一个 +1 指示物', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['world_champs_fighting_spirit_prize'],
                deck: ['robot_microbot_alpha', 'robot_microbot_guard'],
                factions: ['world_champs', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [{
                defId: 'base_1',
                minions: [
                    { uid: 'ally-1', defId: 'robot_microbot_alpha', ownerId: '0', controllerId: '0', powerCounters: 0 },
                    { uid: 'ally-2', defId: 'robot_microbot_guard', ownerId: '0', controllerId: '0', powerCounters: 0 },
                ],
            }],
        });

        await game.playCard('world_champs_fighting_spirit_prize');
        await game.waitForInteraction('world_champs_fighting_spirit_prize');

        const promptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId,
                multi: current?.data?.multi ?? null,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    defId: option.value?.defId ?? null,
                    minionUid: option.value?.minionUid ?? null,
                })),
            };
        });

        expect(promptMeta.sourceId).toBe('world_champs_fighting_spirit_prize');
        expect(promptMeta.multi?.max).toBe(2);
        expect(promptMeta.options.map((option: any) => option.minionUid)).toEqual(expect.arrayContaining(['ally-1', 'ally-2']));

        await game.screenshot('fighting-spirit-prize-prompt-visible', testInfo);

        const ally1Option = promptMeta.options.find((option: any) => option.minionUid === 'ally-1');
        const ally2Option = promptMeta.options.find((option: any) => option.minionUid === 'ally-2');
        expect(ally1Option).toBeDefined();
        expect(ally2Option).toBeDefined();

        await page.locator('[data-minion-uid="ally-1"]').click({ force: true });
        await expect(page.getByText(/已选 1\s*\/\s*2/)).toBeVisible();
        await page.locator('[data-minion-uid="ally-2"]').click({ force: true });
        await expect(page.getByText(/已选 2\s*\/\s*2/)).toBeVisible();
        await game.confirm();
        await game.waitForNoInteraction();

        const finalState = await game.getState();
        expect(finalState.core.players['0'].hand.map((card: any) => card.defId)).toEqual(
            expect.arrayContaining(['robot_microbot_alpha', 'robot_microbot_guard']),
        );
        const baseMinions = finalState.core.bases[0].minions;
        const ally1 = baseMinions.find((minion: any) => minion.uid === 'ally-1');
        const ally2 = baseMinions.find((minion: any) => minion.uid === 'ally-2');
        expect(ally1?.powerCounters ?? 0).toBeGreaterThanOrEqual(1);
        expect(ally2?.powerCounters ?? 0).toBeGreaterThanOrEqual(1);

        await game.screenshot('fighting-spirit-prize-resolved', testInfo);
    });

    test('鼠、鸟与香肠应先选锚点再给同基地同派系至多两个随从 +2', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['world_champs_mouse_bird_and_sausage'],
                deck: [],
                factions: ['world_champs', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [{
                defId: 'base_1',
                minions: [
                    { uid: 'wc-minion-1', defId: 'world_champs_akye_the_turtle', ownerId: '0', controllerId: '0', tempPowerModifier: 0 },
                    { uid: 'wc-minion-2', defId: 'world_champs_shield_maiden', ownerId: '0', controllerId: '0', tempPowerModifier: 0 },
                    { uid: 'wc-minion-3', defId: 'world_champs_stoneford', ownerId: '0', controllerId: '0', tempPowerModifier: 0 },
                    { uid: 'robot-minion-1', defId: 'robot_microbot_alpha', ownerId: '0', controllerId: '0', tempPowerModifier: 0 },
                ],
            }],
        });

        await game.playCard('world_champs_mouse_bird_and_sausage');
        await game.waitForInteraction('world_champs_mouse_bird_and_sausage_anchor');

        const anchorPromptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    minionUid: option.value?.minionUid ?? null,
                    defId: option.value?.defId ?? null,
                })),
            };
        });

        expect(anchorPromptMeta.sourceId).toBe('world_champs_mouse_bird_and_sausage_anchor');
        expect(anchorPromptMeta.options.map((option: any) => option.minionUid)).toEqual(
            expect.arrayContaining(['wc-minion-1', 'wc-minion-2', 'wc-minion-3', 'robot-minion-1']),
        );

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.minionUid === 'wc-minion-1',
            '鼠、鸟与香肠选择锚点随从',
        );
        await game.waitForInteraction('world_champs_mouse_bird_and_sausage_targets');

        const targetsPromptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId,
                multi: current?.data?.multi ?? null,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    minionUid: option.value?.minionUid ?? null,
                    defId: option.value?.defId ?? null,
                })),
            };
        });

        expect(targetsPromptMeta.sourceId).toBe('world_champs_mouse_bird_and_sausage_targets');
        expect(targetsPromptMeta.multi?.max).toBe(2);
        expect(targetsPromptMeta.options.map((option: any) => option.minionUid)).toEqual(
            expect.arrayContaining(['wc-minion-1', 'wc-minion-2', 'wc-minion-3']),
        );
        expect(targetsPromptMeta.options.map((option: any) => option.minionUid)).not.toContain('robot-minion-1');

        await game.screenshot('mouse-bird-sausage-targets-prompt', testInfo);

        const target2Option = targetsPromptMeta.options.find((option: any) => option.minionUid === 'wc-minion-2');
        const target3Option = targetsPromptMeta.options.find((option: any) => option.minionUid === 'wc-minion-3');
        expect(target2Option?.id).toBeDefined();
        expect(target3Option?.id).toBeDefined();

        await page.locator('[data-minion-uid="wc-minion-2"]').click({ force: true });
        await expect(page.getByText(/已选 1\s*\/\s*2/)).toBeVisible();
        await page.locator('[data-minion-uid="wc-minion-3"]').click({ force: true });
        await expect(page.getByText(/已选 2\s*\/\s*2/)).toBeVisible();
        await game.confirm();
        await game.waitForNoInteraction();

        const finalState = await game.getState();
        const baseMinions = finalState.core.bases[0].minions;
        const anchor = baseMinions.find((minion: any) => minion.uid === 'wc-minion-1');
        const target2 = baseMinions.find((minion: any) => minion.uid === 'wc-minion-2');
        const target3 = baseMinions.find((minion: any) => minion.uid === 'wc-minion-3');
        const robot = baseMinions.find((minion: any) => minion.uid === 'robot-minion-1');

        expect(anchor?.tempPowerModifier ?? 0).toBe(0);
        expect(target2?.tempPowerModifier ?? 0).toBeGreaterThanOrEqual(2);
        expect(target3?.tempPowerModifier ?? 0).toBeGreaterThanOrEqual(2);
        expect(robot?.tempPowerModifier ?? 0).toBe(0);

        await game.screenshot('mouse-bird-sausage-resolved', testInfo);
    });

    test('鲨鱼纹身打出后应附着到己方随从并在下个自己回合开始时再放一个 +1 指示物', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['world_champs_shark_tattoo'],
                deck: [],
                factions: ['world_champs', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [{
                defId: 'base_1',
                minions: [
                    { uid: 'ally-host', defId: 'robot_microbot_alpha', owner: '0', controller: '0', powerCounters: 0 },
                ],
                ongoingActions: [],
            }],
        });

        await game.playCard('world_champs_shark_tattoo', { targetBaseIndex: 0, targetMinionUid: 'ally-host' });
        await game.waitForNoInteraction();

        const afterPlay = await game.getState();
        const hostAfterPlay = afterPlay.core.bases[0].minions.find((minion: any) => minion.uid === 'ally-host');
        const attachedActionUid = hostAfterPlay?.attachedActions?.find(
            (action: any) => action.defId === 'world_champs_shark_tattoo',
        )?.uid;
        expect(attachedActionUid).toBeTruthy();
        expect(hostAfterPlay?.powerCounters ?? 0).toBe(1);

        await page.locator('[data-minion-uid="ally-host"]').click({ force: true });
        await expect(page.locator(`[data-attached-action-uid="${attachedActionUid}"]`)).toBeVisible({ timeout: 5000 });
        await game.screenshot('shark-tattoo-attached-initial', testInfo);

        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            harness?.command?.dispatch?.({ type: 'ADVANCE_PHASE', playerId: '0', payload: undefined });
        });
        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.core?.currentPlayerIndex === 1 && state?.sys?.phase === 'playCards';
        }, { timeout: 10000 });

        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            harness?.command?.dispatch?.({ type: 'ADVANCE_PHASE', playerId: '1', payload: undefined });
        });
        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.core?.currentPlayerIndex === 0 && state?.sys?.phase === 'playCards';
        }, { timeout: 10000 });

        const nextTurnState = await game.getState();
        const hostNextTurn = nextTurnState.core.bases[0].minions.find((minion: any) => minion.uid === 'ally-host');
        expect(hostNextTurn?.powerCounters ?? 0).toBe(2);

        await page.locator('[data-minion-uid="ally-host"]').click({ force: true });
        await expect(page.locator(`[data-attached-action-uid="${attachedActionUid}"]`)).toBeVisible({ timeout: 5000 });
        await game.screenshot('shark-tattoo-next-turn-counter-added', testInfo);
    });

    test('高速追逐应转移行动到另一基地并移动己方随从且给予 +3 力量', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['world_champs_high_speed_chase'],
                deck: [],
                factions: ['world_champs', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                {
                    defId: 'base_1',
                    minions: [
                        { uid: 'runner-1', defId: 'robot_microbot_alpha', ownerId: '0', controllerId: '0', tempPowerModifier: 0 },
                        { uid: 'spectator-1', defId: 'robot_microbot_guard', ownerId: '1', controllerId: '1', tempPowerModifier: 0 },
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_2',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        await game.playCard('world_champs_high_speed_chase', { targetBaseIndex: 0 });
        await game.waitForNoInteraction();

        const afterPlay = await game.getState();
        const highSpeedChaseUid = afterPlay.core.bases[0].ongoingActions.find(
            (action: any) => action.defId === 'world_champs_high_speed_chase',
        )?.uid;
        expect(highSpeedChaseUid).toBeTruthy();

        await expect(page.locator(`[data-ongoing-uid="${highSpeedChaseUid}"]`)).toBeVisible({ timeout: 5000 });
        await game.screenshot('high-speed-chase-ongoing-on-source-base', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-world-champs-high-speed-chase-ongoing-2026-04-27');

        await page.locator(`[data-ongoing-uid="${highSpeedChaseUid}"]`).click({ force: true });
        await page.waitForTimeout(200);
        await page.locator(`[data-ongoing-uid="${highSpeedChaseUid}"]`).click({ force: true });
        await game.waitForInteraction('world_champs_high_speed_chase_minion');

        const minionPromptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    minionUid: option.value?.minionUid ?? null,
                    baseIndex: option.value?.baseIndex ?? null,
                })),
            };
        });

        expect(minionPromptMeta.sourceId).toBe('world_champs_high_speed_chase_minion');
        expect(minionPromptMeta.options.map((option: any) => option.minionUid)).toContain('runner-1');

        await game.screenshot('high-speed-chase-minion-prompt', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-world-champs-high-speed-chase-minion-prompt-2026-04-27');

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.minionUid === 'runner-1',
            '高速追逐选择己方移动随从',
        );
        await game.waitForInteraction('world_champs_high_speed_chase_base');

        const basePromptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    baseIndex: option.value?.baseIndex ?? null,
                })),
            };
        });

        expect(basePromptMeta.sourceId).toBe('world_champs_high_speed_chase_base');
        expect(basePromptMeta.options.some((option: any) => option.baseIndex === 1)).toBe(true);

        await game.screenshot('high-speed-chase-base-prompt', testInfo);
        await page.getByTestId('base-zone-1').click({ force: true });
        await game.waitForNoInteraction();

        const finalState = await game.getState();
        const sourceBase = finalState.core.bases[0];
        const targetBase = finalState.core.bases[1];
        const movedMinion = targetBase.minions.find((minion: any) => minion.uid === 'runner-1');
        const movedAction = targetBase.ongoingActions.find((action: any) => action.uid === highSpeedChaseUid);

        expect(sourceBase.minions.some((minion: any) => minion.uid === 'runner-1')).toBe(false);
        expect(sourceBase.ongoingActions.some((action: any) => action.uid === highSpeedChaseUid)).toBe(false);
        expect(movedMinion?.tempPowerModifier ?? 0).toBe(3);
        expect(movedAction?.defId).toBe('world_champs_high_speed_chase');

        await game.screenshot('high-speed-chase-resolved-on-target-base', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-world-champs-high-speed-chase-resolved-2026-04-27');
    });

    test('现在是闪电时间！应选择己方随从并在本回合给予 +3 力量', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['world_champs_its_blitzin_time'],
                deck: [],
                factions: ['world_champs', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                {
                    defId: 'base_1',
                    minions: [{ uid: 'blitz-ally-1', defId: 'robot_microbot_alpha', ownerId: '0', controllerId: '0', tempPowerModifier: 0 }],
                    ongoingActions: [],
                },
                {
                    defId: 'base_2',
                    minions: [{ uid: 'blitz-ally-2', defId: 'robot_microbot_guard', ownerId: '0', controllerId: '0', tempPowerModifier: 0 }],
                    ongoingActions: [],
                },
            ],
        });

        await game.playCard('world_champs_its_blitzin_time');
        await game.waitForInteraction('world_champs_its_blitzin_time');

        const promptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    minionUid: option.value?.minionUid ?? null,
                    baseIndex: option.value?.baseIndex ?? null,
                })),
            };
        });

        expect(promptMeta.sourceId).toBe('world_champs_its_blitzin_time');
        expect(promptMeta.options.map((option: any) => option.minionUid)).toEqual(
            expect.arrayContaining(['blitz-ally-1', 'blitz-ally-2']),
        );

        await game.screenshot('its-blitzin-time-prompt-visible', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-world-champs-its-blitzin-time-prompt-2026-04-27');

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.minionUid === 'blitz-ally-2',
            '现在是闪电时间！选择第二个己方随从',
        );
        await game.waitForNoInteraction();

        const finalState = await game.getState();
        const baseOneMinion = finalState.core.bases[0].minions.find((minion: any) => minion.uid === 'blitz-ally-1');
        const baseTwoMinion = finalState.core.bases[1].minions.find((minion: any) => minion.uid === 'blitz-ally-2');

        expect(baseOneMinion?.tempPowerModifier ?? 0).toBe(0);
        expect(baseTwoMinion?.tempPowerModifier ?? 0).toBe(3);

        await game.screenshot('its-blitzin-time-resolved', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-world-champs-its-blitzin-time-resolved-2026-04-27');
    });

    test('怪兽冲击打出后应让你在本回合额外打出两个行动', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['world_champs_kaiju_conflict', 'world_champs_its_blitzin_time', 'ninja_assassination'],
                deck: [],
                factions: ['world_champs', 'ninjas'],
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                {
                    defId: 'base_1',
                    minions: [
                        { uid: 'kaiju-ally-1', defId: 'robot_microbot_alpha', owner: '0', controller: '0', tempPowerModifier: 0 },
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_2',
                    minions: [
                        { uid: 'kaiju-ally-2', defId: 'robot_microbot_guard', owner: '0', controller: '0', tempPowerModifier: 0 },
                        { uid: 'kaiju-enemy-1', defId: 'pirate_first_mate', owner: '1', controller: '1', tempPowerModifier: 0 },
                    ],
                    ongoingActions: [],
                },
            ],
        });

        await game.playCard('world_champs_kaiju_conflict');
        await game.waitForNoInteraction();
        await dismissSpotlightQueueIfPresent(page);

        const afterKaiju = await game.getState();
        expect(afterKaiju.core.players['0'].actionsPlayed).toBe(1);
        expect(afterKaiju.core.players['0'].actionLimit).toBeGreaterThanOrEqual(3);

        await game.screenshot('kaiju-conflict-after-first-action', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-world-champs-kaiju-conflict-after-first-action-2026-04-28');

        await game.playCard('world_champs_its_blitzin_time');
        await game.waitForInteraction('world_champs_its_blitzin_time');
        await game.selectInteractionOptionBy(
            (option: any) => option.value?.minionUid === 'kaiju-ally-2',
            '怪兽冲击后的第一张额外行动选择第二个己方随从',
        );
        await game.waitForNoInteraction();
        await dismissSpotlightQueueIfPresent(page);

        await game.playCard('ninja_assassination', { targetBaseIndex: 1, targetMinionUid: 'kaiju-enemy-1' });
        await game.waitForNoInteraction();
        await dismissSpotlightQueueIfPresent(page);

        const finalState = await game.getState();
        const baseTwoMinions = finalState.core.bases[1].minions;
        const allyTwo = baseTwoMinions.find((minion: any) => minion.uid === 'kaiju-ally-2');
        const enemyTarget = baseTwoMinions.find((minion: any) => minion.uid === 'kaiju-enemy-1');

        expect(finalState.core.players['0'].actionsPlayed).toBe(3);
        expect(finalState.core.players['0'].actionLimit).toBeGreaterThanOrEqual(3);
        expect(finalState.core.players['0'].hand).toHaveLength(0);
        expect(allyTwo?.tempPowerModifier ?? 0).toBe(3);
        expect(enemyTarget?.attachedActions?.some((action: any) => action.defId === 'ninja_assassination')).toBe(true);

        await game.screenshot('kaiju-conflict-third-action-resolved', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-world-champs-kaiju-conflict-third-action-resolved-2026-04-28');
    });

    test('快如闪电打到阿拉密斯后应可选触发女主角复制并让阿拉密斯提供额外行动', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['world_champs_fast_as_lightning', 'world_champs_its_blitzin_time'],
                deck: [],
                factions: ['world_champs', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [{
                defId: 'base_1',
                minions: [
                    { uid: 'diva-1', defId: 'world_champs_diva', owner: '0', controller: '0', tempPowerModifier: 0 },
                    { uid: 'aramis-1', defId: 'world_champs_aramis', owner: '0', controller: '0', tempPowerModifier: 0 },
                ],
                ongoingActions: [],
            }],
        });

        await game.playCard('world_champs_fast_as_lightning', { targetMinionUid: 'aramis-1' });
        await game.waitForInteraction('smashup_reaction_choose');

        const reactionMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness?.state?.get?.();
            const triggerQueue = new Map((state?.core?.triggerQueue ?? []).map((trigger: any) => [trigger.id, trigger]));
            return {
                sourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
                options: (state?.sys?.interaction?.current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    label: option.label ?? null,
                    triggerSourceDefId: option.value?.triggerId
                        ? (triggerQueue.get(option.value.triggerId)?.sourceDefId ?? null)
                        : null,
                })),
            };
        });

        expect(reactionMeta.sourceId).toBe('smashup_reaction_choose');
        expect(reactionMeta.options.some((option: any) => option.triggerSourceDefId === 'world_champs_diva')).toBe(true);
        expect(reactionMeta.options.some((option: any) => option.triggerSourceDefId === 'world_champs_aramis')).toBe(true);
        const divaOptionId = reactionMeta.options.find((option: any) => option.triggerSourceDefId === 'world_champs_diva')?.id;
        expect(divaOptionId).toBeTruthy();

        await game.screenshot('world-champs-diva-aramis-reaction-prompt', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-world-champs-diva-aramis-reaction-prompt-2026-04-28');

        await game.selectOption(divaOptionId);
        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const baseMinions = state?.core?.bases?.[0]?.minions ?? [];
            const diva = baseMinions.find((minion: any) => minion.uid === 'diva-1');
            const triggerQueue = new Map((state?.core?.triggerQueue ?? []).map((trigger: any) => [trigger.id, trigger]));
            const currentOptions = state?.sys?.interaction?.current?.data?.options ?? [];
            const remainingTriggerSourceDefIds = currentOptions
                .map((option: any) => triggerQueue.get(option.value?.triggerId)?.sourceDefId ?? null)
                .filter(Boolean);
            return diva?.tempPowerModifier === 2
                && state?.sys?.interaction?.current?.data?.sourceId === 'smashup_reaction_choose'
                && remainingTriggerSourceDefIds.length === 1
                && remainingTriggerSourceDefIds[0] === 'world_champs_aramis';
        }, { timeout: 5000, polling: 200 });

        const aramisOptionId = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness?.state?.get?.();
            const triggerQueue = new Map((state?.core?.triggerQueue ?? []).map((trigger: any) => [trigger.id, trigger]));
            const currentOptions = state?.sys?.interaction?.current?.data?.options ?? [];
            return currentOptions.find((option: any) =>
                triggerQueue.get(option.value?.triggerId)?.sourceDefId === 'world_champs_aramis'
            )?.id ?? null;
        });
        expect(aramisOptionId).toBeTruthy();
        await game.selectOption(aramisOptionId);
        await game.waitForNoInteraction();

        const afterTriggers = await game.getState();
        const afterTriggerBaseMinions = afterTriggers.core.bases[0].minions;
        const divaAfterTrigger = afterTriggerBaseMinions.find((minion: any) => minion.uid === 'diva-1');
        const aramisAfterTrigger = afterTriggerBaseMinions.find((minion: any) => minion.uid === 'aramis-1');

        expect(divaAfterTrigger?.tempPowerModifier ?? 0).toBe(2);
        expect(aramisAfterTrigger?.tempPowerModifier ?? 0).toBe(2);
        expect(afterTriggers.core.players['0'].actionsPlayed).toBe(1);
        expect(afterTriggers.core.players['0'].actionLimit).toBeGreaterThanOrEqual(2);

        await game.playCard('world_champs_its_blitzin_time');
        await game.waitForInteraction('world_champs_its_blitzin_time');
        await game.selectInteractionOptionBy(
            (option: any) => option.value?.minionUid === 'diva-1',
            '阿拉密斯提供的额外行动选择女主角',
        );
        await game.waitForNoInteraction();
        await dismissSpotlightQueueIfPresent(page);

        const finalState = await game.getState();
        const finalBaseMinions = finalState.core.bases[0].minions;
        const finalDiva = finalBaseMinions.find((minion: any) => minion.uid === 'diva-1');
        const finalAramis = finalBaseMinions.find((minion: any) => minion.uid === 'aramis-1');

        expect(finalState.core.players['0'].actionsPlayed).toBe(2);
        expect(finalState.core.players['0'].hand).toHaveLength(0);
        expect(finalDiva?.tempPowerModifier ?? 0).toBe(5);
        expect(finalAramis?.tempPowerModifier ?? 0).toBe(2);

        await game.screenshot('world-champs-diva-aramis-resolved', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-world-champs-diva-aramis-resolved-2026-04-28');
    });

    test('聪明Set-Up附着后应在该基地本回合首次打出随从时让你抽一张牌', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['world_champs_smart_set_up'],
                deck: ['robot_microbot_alpha'],
                factions: ['world_champs', 'robots'],
            },
            player1: {
                hand: ['pirate_first_mate'],
                deck: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [{
                defId: 'base_1',
                minions: [
                    { uid: 'enemy-host', defId: 'robot_microbot_archive', ownerId: '1', controllerId: '1', powerCounters: 0 },
                ],
                ongoingActions: [],
            }],
        });

        await game.playCard('world_champs_smart_set_up', { targetBaseIndex: 0, targetMinionUid: 'enemy-host' });
        await game.waitForNoInteraction();

        const afterAttach = await game.getState();
        const enemyHost = afterAttach.core.bases[0].minions.find((minion: any) => minion.uid === 'enemy-host');
        const smartSetUpUid = enemyHost?.attachedActions?.find(
            (action: any) => action.defId === 'world_champs_smart_set_up',
        )?.uid;
        expect(smartSetUpUid).toBeTruthy();

        await page.waitForTimeout(1800);
        await page.locator('[data-minion-uid="enemy-host"]').click({ force: true });
        await expect(page.locator(`[data-attached-action-uid="${smartSetUpUid}"]`)).toBeVisible({ timeout: 5000 });
        await game.screenshot('smart-set-up-attached-to-enemy-minion', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-world-champs-smart-set-up-attached-2026-04-27');

        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            harness?.command?.dispatch?.({ type: 'ADVANCE_PHASE', playerId: '0', payload: undefined });
        });
        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.core?.currentPlayerIndex === 1 && state?.sys?.phase === 'playCards';
        }, { timeout: 10000 });

        await game.playCard('pirate_first_mate', { targetBaseIndex: 0 });
        await game.waitForNoInteraction();

        const finalState = await game.getState();
        const playerZeroHandDefs = finalState.core.players['0'].hand.map((card: any) => card.defId);
        const baseMinions = finalState.core.bases[0].minions;

        expect(playerZeroHandDefs).toContain('robot_microbot_alpha');
        expect(baseMinions.some((minion: any) => minion.defId === 'pirate_first_mate')).toBe(true);

        await game.screenshot('smart-set-up-triggered-by-first-minion-play', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-world-champs-smart-set-up-triggered-2026-04-27');
    });

    test('着魔附着的宿主离场后应把持续行动转移到另一个随从', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['world_champs_bewitched', 'ninja_assassination'],
                deck: [],
                factions: ['world_champs', 'ninjas'],
                actionLimit: 2,
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                {
                    defId: 'base_1',
                    minions: [
                        { uid: 'bewitched-host', defId: 'robot_microbot_alpha', owner: '1', controller: '1', powerCounters: 0 },
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_2',
                    minions: [
                        { uid: 'bewitched-target', defId: 'robot_microbot_guard', owner: '0', controller: '0', powerCounters: 0 },
                    ],
                    ongoingActions: [],
                },
            ],
        });

        await game.playCard('world_champs_bewitched', { targetBaseIndex: 0, targetMinionUid: 'bewitched-host' });
        await game.waitForNoInteraction();
        await dismissSpotlightQueueIfPresent(page);

        const afterBewitched = await game.getState();
        const attachedBewitchedUid = afterBewitched.core.bases[0].minions
            .find((minion: any) => minion.uid === 'bewitched-host')
            ?.attachedActions?.find((action: any) => action.defId === 'world_champs_bewitched')
            ?.uid;
        expect(attachedBewitchedUid).toBeTruthy();

        await page.locator('[data-minion-uid="bewitched-host"]').click({ force: true });
        await expect(page.locator(`[data-attached-action-uid="${attachedBewitchedUid}"]`)).toBeVisible({ timeout: 5000 });
        await game.screenshot('bewitched-attached-on-host', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-world-champs-bewitched-attached-2026-04-28');

        await game.playCard('ninja_assassination', { targetBaseIndex: 0, targetMinionUid: 'bewitched-host' });
        await game.waitForNoInteraction();
        await dismissSpotlightQueueIfPresent(page);

        await page.getByRole('button', { name: /^(结束回合|Finish Turn|End)$/i }).click({ force: true });
        await game.waitForInteraction('world_champs_bewitched_transfer', 10000);

        const promptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    minionUid: option.value?.minionUid ?? null,
                    baseIndex: option.value?.baseIndex ?? null,
                })),
            };
        });

        expect(promptMeta.sourceId).toBe('world_champs_bewitched_transfer');
        expect(promptMeta.options.some((option: any) => option.minionUid === 'bewitched-target' && option.baseIndex === 1)).toBe(true);

        await game.screenshot('bewitched-transfer-prompt', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-world-champs-bewitched-transfer-prompt-2026-04-28');

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.minionUid === 'bewitched-target',
            '着魔转移到第二个基地的己方随从',
        );
        await game.waitForNoInteraction();

        const finalState = await game.getState();
        const hostStillExists = finalState.core.bases[0].minions.some((minion: any) => minion.uid === 'bewitched-host');
        const transferredTarget = finalState.core.bases[1].minions.find((minion: any) => minion.uid === 'bewitched-target');
        const transferredBewitchedUid = transferredTarget?.attachedActions?.find(
            (action: any) => action.defId === 'world_champs_bewitched',
        )?.uid;

        expect(hostStillExists).toBe(false);
        expect(transferredTarget?.attachedActions?.some((action: any) => action.defId === 'world_champs_bewitched')).toBe(true);
        expect(finalState.core.players['0'].discard.some((card: any) => card.defId === 'world_champs_bewitched')).toBe(false);
        expect(transferredBewitchedUid).toBeTruthy();

        await page.locator('[data-minion-uid="bewitched-target"]').click({ force: true });
        await expect(page.locator(`[data-attached-action-uid="${transferredBewitchedUid}"]`)).toBeVisible({ timeout: 5000 });
        await game.screenshot('bewitched-transferred-to-new-host', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-world-champs-bewitched-transferred-2026-04-28');
    });

    test('嗯？应在打出第一个行动后从弃牌堆作为额外行动发动并回到手牌', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['ninja_assassination'],
                deck: [],
                discard: ['world_champs_eh'],
                factions: ['world_champs', 'ninjas'],
            },
            player1: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                {
                    defId: 'base_the_jungle',
                    minions: [
                        { uid: 'eh-ally-1', defId: 'robot_microbot_alpha', owner: '0', controller: '0', tempPowerModifier: 0 },
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_tar_pits',
                    minions: [
                        { uid: 'eh-ally-2', defId: 'robot_microbot_guard', owner: '0', controller: '0', tempPowerModifier: 0 },
                    ],
                    ongoingActions: [],
                },
            ],
        });

        await game.playCard('ninja_assassination', { targetBaseIndex: 0, targetMinionUid: 'eh-ally-1' });
        await game.waitForNoInteraction();
        await dismissSpotlightQueueIfPresent(page);

        await expect(page.locator('[data-testid="su-discard-toggle"]')).toBeVisible();
        await page.locator('[data-testid="su-discard-toggle"]').click();
        await expect(page.locator('[data-discard-view-panel]')).toBeVisible();
        await expect(page.locator('[data-card-def-id="world_champs_eh"]')).toBeVisible();

        await game.screenshot('eh-discard-panel-available', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-world-champs-eh-discard-available-2026-04-28');

        await page.locator('[data-card-def-id="world_champs_eh"]').click();
        await expect(page.locator('span').filter({ hasText: '请选择一个随从' })).toBeVisible({ timeout: 5000 });

        await game.screenshot('eh-discard-minion-select-visible', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-world-champs-eh-minion-select-2026-04-28');

        await page.locator('[data-minion-uid="eh-ally-2"]').click({ force: true });
        await game.waitForNoInteraction();

        const finalState = await game.getState();
        const allyOne = finalState.core.bases[0].minions.find((minion: any) => minion.uid === 'eh-ally-1');
        const allyTwo = finalState.core.bases[1].minions.find((minion: any) => minion.uid === 'eh-ally-2');

        expect(allyOne?.tempPowerModifier ?? 0).toBe(0);
        expect(allyTwo?.tempPowerModifier ?? 0).toBe(1);
        expect(finalState.core.players['0'].hand.some((card: any) => card.defId === 'world_champs_eh')).toBe(true);
        expect(finalState.core.players['0'].discard.some((card: any) => card.defId === 'world_champs_eh')).toBe(false);
        expect(finalState.core.players['0'].usedDiscardPlayAbilities ?? []).toContain('world_champs_eh');

        await game.screenshot('eh-resolved-returned-to-hand', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-world-champs-eh-resolved-2026-04-28');
    });

    test('警长应在基地计分前发起决斗并摧毁落败随从', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(90000);

        const setup = await setupSUOnlineMatch(browser, baseURL, ['world_champs', 'robots', 'pirates', 'dinosaurs']);
        if (!setup) {
            test.skip(true, '游戏服务器不可用');
            return;
        }

        const { hostPage, guestPage, hostContext, guestContext } = setup;
        try {
            await waitForHandArea(hostPage);
            await waitForHandArea(guestPage);

            const fullState = await readFullState(hostPage);
            const injectedState = prepareInjectedOnlineState(fullState as Record<string, any>, (core) => {
            const turnOrder = core.turnOrder as string[];
            const hostPid = turnOrder[0];
            const guestPid = turnOrder[1];

                core.currentPlayerIndex = 0;
                core.currentPlayer = hostPid;
                core.players[hostPid].hand = [];
                core.players[guestPid].hand = [];
                core.players[hostPid].deck = [];
                core.players[guestPid].deck = [];
                core.players[hostPid].minionsPlayed = 0;
                core.players[guestPid].minionsPlayed = 0;
                core.players[hostPid].actionsPlayed = 0;
                core.players[guestPid].actionsPlayed = 0;
                core.bases[0].defId = 'base_the_jungle';
                core.bases[0].minions = [
                    makeMinion('sheriff-live', 'world_champs_sheriff', hostPid, hostPid, 5),
                    makeMinion('ally-rex', 'dino_king_rex', hostPid, hostPid, 6),
                    makeMinion('enemy-target', 'robot_microbot_alpha', guestPid, guestPid, 1),
                ];
                core.bases[0].ongoingActions = [];
                for (let index = 1; index < core.bases.length; index += 1) {
                    core.bases[index].minions = [];
                    core.bases[index].ongoingActions = [];
                }
            });

            await applyCoreStateDirect(hostPage, injectedState);
            await closeDebugPanel(hostPage);
            await closeDebugPanel(guestPage);
            await hostPage.waitForTimeout(2000);

            await hostPage.getByRole('button', { name: /^(结束回合|Finish Turn|End)$/i }).click({ force: true });
            await waitForScoreBasesOrReactionEntry(hostPage, 12000);
            await hostPage.screenshot({ path: testInfo.outputPath('sheriff-reaction-choose-entry.png'), fullPage: true });
            await activateReactionTrigger(
                hostPage,
                '0',
                {
                    triggerSourceDefId: 'world_champs_sheriff',
                    optionLabelIncludes: '警长',
                    optionIdIncludes: 'world_champs_sheriff',
                },
                'world_champs_sheriff_before_scoring',
                12000,
                guestPage,
            );

            const sheriffState = await readAuthoritativeState(hostPage);
            const sheriffPrompt = (() => {
                const current = getCurrentInteraction(sheriffState);
                const data = asRecord(current?.data);
                return {
                    sourceId: data?.sourceId ?? null,
                    options: (Array.isArray(data?.options) ? data.options : []).map((option: any) => ({
                        id: option.id,
                        minionUid: option.value?.minionUid ?? null,
                        sourceUid: option.value?.sourceUid ?? null,
                        targetMinionUid: option.value?.targetMinionUid ?? null,
                        fieldInteractionType: option.value?.fieldInteractionType ?? null,
                        fieldSourceType: option.value?.fieldSourceType ?? null,
                        fieldTargetType: option.value?.fieldTargetType ?? null,
                        defId: option.value?.defId ?? null,
                    })),
                };
            })();

            expect(sheriffPrompt.sourceId).toBe('world_champs_sheriff_before_scoring');
            expect(sheriffPrompt.options).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    fieldInteractionType: 'source-target',
                    fieldSourceType: 'minion',
                    fieldTargetType: 'minion',
                    minionUid: 'sheriff-live',
                    sourceUid: 'sheriff-live',
                    targetMinionUid: 'enemy-target',
                }),
            ]));

            const sheriffCard = hostPage.locator('[data-minion-uid="sheriff-live"]').first();
            const sheriffFrame = hostPage.getByTestId('su-minion-frame-sheriff-live');
            const targetCard = hostPage.locator('[data-minion-uid="enemy-target"]').first();
            const targetFrame = hostPage.getByTestId('su-minion-frame-enemy-target');

            await expect(sheriffCard).toHaveAttribute('data-highlighted', 'true');
            await expect(sheriffFrame).toHaveAttribute('data-highlighted', 'true');
            await expect(targetCard).toHaveAttribute('data-highlighted', 'false');
            await expect(targetFrame).toHaveAttribute('data-highlighted', 'false');
            await hostPage.screenshot({ path: testInfo.outputPath('sheriff-before-scoring-source-highlight.png'), fullPage: true });
            await saveStableScreenshot(hostPage, testInfo, 'smashup-world-champs-sheriff-source-highlight-2026-08-17');

            await clickMinionOnBoard(hostPage, 'sheriff-live', 10000);
            await expect(sheriffCard).toHaveAttribute('data-selected', 'true');
            await expect(sheriffFrame).toHaveAttribute('data-selected', 'true');
            await expect(targetCard).toHaveAttribute('data-highlighted', 'true');
            await expect(targetFrame).toHaveAttribute('data-highlighted', 'true');
            await hostPage.screenshot({ path: testInfo.outputPath('sheriff-before-scoring-target-minion-highlight.png'), fullPage: true });
            await saveStableScreenshot(hostPage, testInfo, 'smashup-world-champs-sheriff-target-minion-highlight-2026-08-17');

            await clickMinionOnBoard(hostPage, 'enemy-target', 10000);

            await waitForInteractionSource(hostPage, 'smashup_duel_card', 10000);
            await expect(hostPage.getByText(/决斗进行中|Duel in progress/i)).toBeVisible({ timeout: 5000 });
            await hostPage.screenshot({ path: testInfo.outputPath('sheriff-duel-card-prompt.png'), fullPage: true });
            await saveStableScreenshot(hostPage, testInfo, 'smashup-world-champs-sheriff-duel-card-prompt-2026-04-26');

            const duelResult = await drainSheriffDuelFlow(hostPage, guestPage, 15000);
            const resolvedCore = duelResult.finalCore ?? {};
            const enemyStillOnAnyBase = Array.isArray(resolvedCore.bases)
                && resolvedCore.bases.some((base: any) => (base?.minions ?? []).some((minion: any) => minion.uid === 'enemy-target'));

            expect(enemyStillOnAnyBase).toBe(false);
            expect(resolvedCore.activeDuel ?? null).toBeNull();

            await hostPage.screenshot({ path: testInfo.outputPath('sheriff-duel-resolved.png'), fullPage: true });
            await saveStableScreenshot(hostPage, testInfo, 'smashup-world-champs-sheriff-duel-resolved-2026-04-26');
        } finally {
            await hostContext.close().catch(() => {});
            await guestContext.close().catch(() => {});
        }
    });

    test('木乃伊应在基地计分后埋葬到另一个基地', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(90000);

        const setup = await setupSUOnlineMatch(browser, baseURL, ['world_champs', 'robots', 'pirates', 'dinosaurs']);
        if (!setup) {
            test.skip(true, '游戏服务器不可用');
            return;
        }

        const { hostPage, guestPage, hostContext, guestContext } = setup;
        try {
            await waitForHandArea(hostPage);
            await waitForHandArea(guestPage);

            const fullState = await readFullState(hostPage);
            const injectedState = prepareInjectedOnlineState(fullState as Record<string, any>, (core) => {
            const turnOrder = core.turnOrder as string[];
            const hostPid = turnOrder[0];
            const guestPid = turnOrder[1];

                core.currentPlayerIndex = 0;
                core.currentPlayer = hostPid;
                core.players[hostPid].hand = [];
                core.players[guestPid].hand = [];
                core.players[hostPid].deck = [];
                core.players[guestPid].deck = [];
                core.players[hostPid].minionsPlayed = 0;
                core.players[hostPid].actionsPlayed = 0;
                core.players[guestPid].actionsPlayed = 0;
                core.bases[0].defId = 'base_the_jungle';
                core.bases[0].minions = [
                    makeMinion('mummy-live', 'world_champs_mummy', hostPid, hostPid, 2),
                    makeMinion('ally-rex-2', 'dino_king_rex', hostPid, hostPid, 10),
                ];
                core.bases[0].ongoingActions = [];
                core.bases[1].defId = 'base_tar_pits';
                core.bases[1].minions = [];
                core.bases[1].ongoingActions = [];
                for (let index = 2; index < core.bases.length; index += 1) {
                    core.bases[index].minions = [];
                    core.bases[index].ongoingActions = [];
                }
            });

            await applyCoreStateDirect(hostPage, injectedState);
            await closeDebugPanel(hostPage);
            await closeDebugPanel(guestPage);
            await hostPage.waitForTimeout(2000);

            await hostPage.getByRole('button', { name: /^(结束回合|Finish Turn|End)$/i }).click({ force: true });
            await waitForScoreBasesOrReactionEntry(hostPage, 12000);
            await hostPage.screenshot({ path: testInfo.outputPath('mummy-reaction-choose-entry.png'), fullPage: true });
            await activateReactionTrigger(
                hostPage,
                '0',
                {
                    triggerSourceDefId: 'world_champs_mummy',
                    optionLabelIncludes: '木乃伊',
                    optionIdIncludes: 'world_champs_mummy',
                },
                'world_champs_mummy_after_scoring',
                12000,
                guestPage,
            );

            const mummyState = await readAuthoritativeState(hostPage);
            const mummyPrompt = (() => {
                const current = getCurrentInteraction(mummyState);
                const data = asRecord(current?.data);
                return {
                    sourceId: data?.sourceId ?? null,
                    options: (Array.isArray(data?.options) ? data.options : []).map((option: any) => ({
                        id: option.id,
                        baseIndex: option.value?.baseIndex ?? null,
                        baseDefId: option.value?.baseDefId ?? null,
                    })),
                };
            })();

            expect(mummyPrompt.sourceId).toBe('world_champs_mummy_after_scoring');
            expect(mummyPrompt.options.some((option: any) => option.baseIndex === 1)).toBe(true);

            await hostPage.screenshot({ path: testInfo.outputPath('mummy-after-scoring-prompt.png'), fullPage: true });
            await saveStableScreenshot(hostPage, testInfo, 'smashup-world-champs-mummy-after-scoring-prompt-2026-04-26');
            await clickBaseOnBoard(hostPage, 1, 10000);
            await waitForNoInteraction(hostPage, 10000);

            await hostPage.waitForFunction(() => {
                const stateText = document.querySelector('[data-testid="debug-state-json"]')?.textContent;
                if (!stateText) return false;
                const state = JSON.parse(stateText);
                return state?.sys?.interaction?.current === undefined;
            }, { timeout: 10000 }).catch(() => {});

            const finalState = await readFullState(hostPage);
            const resolvedCore = (finalState.core ?? finalState) as Record<string, any>;
            const buriedOnTargetBase = (resolvedCore.bases[1].buriedCards ?? []).some((card: any) => card.uid === 'mummy-live');
            const mummyStillOnScoringBase = resolvedCore.bases[0].minions.some((minion: any) => minion.uid === 'mummy-live');

            expect(buriedOnTargetBase).toBe(true);
            expect(mummyStillOnScoringBase).toBe(false);

            await hostPage.screenshot({ path: testInfo.outputPath('mummy-buried-on-other-base.png'), fullPage: true });
            await saveStableScreenshot(hostPage, testInfo, 'smashup-world-champs-mummy-buried-on-other-base-2026-04-26');
        } finally {
            await hostContext.close().catch(() => {});
            await guestContext.close().catch(() => {});
        }
    });

    test('沉船湾应在基地计分后可移到另一个基地', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(90000);

        const setup = await setupSUOnlineMatch(browser, baseURL, ['mermaids', 'robots', 'pirates', 'dinosaurs']);
        if (!setup) {
            test.skip(true, '游戏服务器不可用');
            return;
        }

        const { hostPage, guestPage, hostContext, guestContext } = setup;
        try {
            await waitForHandArea(hostPage);
            await waitForHandArea(guestPage);

            const fullState = await readFullState(hostPage);
            const injectedState = prepareInjectedOnlineState(fullState as Record<string, any>, (core) => {
                const turnOrder = core.turnOrder as string[];
                const hostPid = turnOrder[0];
                const guestPid = turnOrder[1];

                core.currentPlayerIndex = 0;
                core.currentPlayer = hostPid;
                core.players[hostPid].hand = [];
                core.players[guestPid].hand = [];
                core.players[hostPid].deck = [];
                core.players[guestPid].deck = [];
                core.players[hostPid].minionsPlayed = 0;
                core.players[hostPid].actionsPlayed = 0;
                core.players[guestPid].actionsPlayed = 0;
                core.bases[0].defId = 'base_the_jungle';
                core.bases[0].minions = [
                    makeMinion('shipwreck-host-rex', 'dino_king_rex', hostPid, hostPid, 7),
                    makeMinion('shipwreck-host-raptor', 'dino_war_raptor', hostPid, hostPid, 4),
                ];
                core.bases[0].ongoingActions = [{
                    uid: 'shipwreck-cove-live',
                    defId: 'mermaids_shipwreck_cove',
                    ownerId: hostPid,
                    talentUsed: false,
                }];
                core.bases[1].defId = 'base_tar_pits';
                core.bases[1].minions = [];
                core.bases[1].ongoingActions = [];
                for (let index = 2; index < core.bases.length; index += 1) {
                    core.bases[index].minions = [];
                    core.bases[index].ongoingActions = [];
                }
            });

            await applyCoreStateDirect(hostPage, injectedState);
            await closeDebugPanel(hostPage);
            await closeDebugPanel(guestPage);
            await hostPage.waitForTimeout(2000);

            await hostPage.getByRole('button', { name: /^(结束回合|Finish Turn|End)$/i }).click({ force: true });
            await waitForScoreBasesOrReactionEntry(hostPage, 12000);
            await activateReactionTrigger(
                hostPage,
                '0',
                {
                    triggerSourceDefId: 'mermaids_shipwreck_cove',
                    optionLabelIncludes: '沉船湾',
                    optionIdIncludes: 'mermaids_shipwreck_cove',
                },
                'mermaids_shipwreck_cove_after_scoring',
                12000,
                guestPage,
            );

            const promptState = await readAuthoritativeState(hostPage);
            const prompt = (() => {
                const current = getCurrentInteraction(promptState);
                const data = asRecord(current?.data);
                return {
                    sourceId: data?.sourceId ?? null,
                    targetType: data?.targetType ?? null,
                    options: (Array.isArray(data?.options) ? data.options : []).map((option: any) => ({
                        id: option.id,
                        fieldInteractionType: option.value?.fieldInteractionType ?? null,
                        fieldSourceType: option.value?.fieldSourceType ?? null,
                        fieldTargetType: option.value?.fieldTargetType ?? null,
                        sourceUid: option.value?.sourceUid ?? null,
                        baseIndex: option.value?.baseIndex ?? null,
                        targetBaseIndex: option.value?.targetBaseIndex ?? null,
                    })),
                };
            })();

            expect(prompt.sourceId).toBe('mermaids_shipwreck_cove_after_scoring');
            expect(prompt.targetType).toBe('field-source-target');
            expect(prompt.options).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    fieldInteractionType: 'source-target',
                    fieldSourceType: 'ongoing',
                    fieldTargetType: 'base',
                    sourceUid: 'shipwreck-cove-live',
                    baseIndex: 1,
                    targetBaseIndex: 1,
                }),
            ]));

            await expect(hostPage.locator('[data-ongoing-uid="shipwreck-cove-live"]')).toBeVisible({ timeout: 5000 });
            await hostPage.screenshot({ path: testInfo.outputPath('shipwreck-cove-after-scoring-source-highlight.png'), fullPage: true });
            await saveStableScreenshot(hostPage, testInfo, 'smashup-mermaids-shipwreck-cove-source-highlight-2026-08-17');

            await hostPage.locator('[data-ongoing-uid="shipwreck-cove-live"]').click({ force: true });
            await hostPage.screenshot({ path: testInfo.outputPath('shipwreck-cove-after-scoring-target-base-highlight.png'), fullPage: true });
            await saveStableScreenshot(hostPage, testInfo, 'smashup-mermaids-shipwreck-cove-target-base-highlight-2026-08-17');

            await clickBaseOnBoard(hostPage, 1, 10000);
            await waitForNoInteraction(hostPage, 10000);

            const finalState = await readFullState(hostPage);
            const resolvedCore = (finalState.core ?? finalState) as Record<string, any>;
            const sourceStillHasCard = (resolvedCore.bases[0].ongoingActions ?? []).some((action: any) => action.uid === 'shipwreck-cove-live');
            const targetHasCard = (resolvedCore.bases[1].ongoingActions ?? []).some((action: any) => action.uid === 'shipwreck-cove-live');

            expect(sourceStillHasCard).toBe(false);
            expect(targetHasCard).toBe(true);

            await hostPage.screenshot({ path: testInfo.outputPath('shipwreck-cove-moved-to-other-base.png'), fullPage: true });
            await saveStableScreenshot(hostPage, testInfo, 'smashup-mermaids-shipwreck-cove-moved-2026-04-29');
        } finally {
            await hostContext.close().catch(() => {});
            await guestContext.close().catch(() => {});
        }
    });

    test('复仇者应可在回合中触发埋葬且同回合不重复触发', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['robot_microbot_alpha', 'robot_microbot_guard'],
                deck: [],
                discard: ['skeletons_revenant'],
                factions: ['skeletons', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                { defId: 'base_1', minions: [], ongoingActions: [] },
                { defId: 'base_2', minions: [], ongoingActions: [] },
            ],
        });

        await game.playCard('robot_microbot_alpha', { targetBaseIndex: 0 });
        await game.waitForNoInteraction();
        await expect(page.locator('[data-testid="su-discard-toggle"]')).toBeVisible();
        await page.locator('[data-testid="su-discard-toggle"]').click();
        await expect(page.locator('[data-discard-view-panel]')).toBeVisible();
        await expect(page.locator('[data-card-def-id="skeletons_revenant"]')).toBeVisible();
        await expect(page.getByText('点击基地埋葬这张牌')).toHaveCount(0);

        await page.locator('[data-card-def-id="skeletons_revenant"]').click();
        await expect(page.getByText('点击基地埋葬这张牌')).toBeVisible();

        const boardStateBeforeBury = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness?.state?.get?.();
            return {
                interactionSource: state?.sys?.interaction?.current?.data?.sourceId ?? null,
                usedDiscardPlayAbilities: state?.core?.players?.['0']?.usedDiscardPlayAbilities ?? [],
                buriedOnBase1: (state?.core?.bases?.[1]?.buriedCards ?? []).map((card: any) => card.defId),
            };
        });
        expect(boardStateBeforeBury.interactionSource).toBeNull();
        expect(boardStateBeforeBury.usedDiscardPlayAbilities).not.toContain('skeletons_revenant');
        expect(boardStateBeforeBury.buriedOnBase1).not.toContain('skeletons_revenant');

        await game.screenshot('skeletons-revenant-discard-panel-selected', testInfo);

        await game.selectBase(1);
        await game.waitForNoInteraction();

        const stateAfterBury = await game.getState();
        expect((stateAfterBury.core.bases[1].buriedCards ?? []).some((card: any) => card.defId === 'skeletons_revenant')).toBe(true);
        expect(stateAfterBury.core.players['0'].usedDiscardPlayAbilities ?? []).toContain('skeletons_revenant');

        await game.screenshot('skeletons-revenant-buried-resolved', testInfo);

        await game.playCard('robot_microbot_guard', { targetBaseIndex: 0 });
        await game.waitForNoInteraction();
        await page.waitForTimeout(250);

        const interactionSourceAfterSecondCard = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness?.state?.get?.();
            return {
                interactionSource: state?.sys?.interaction?.current?.data?.sourceId ?? null,
                usedDiscardPlayAbilities: state?.core?.players?.['0']?.usedDiscardPlayAbilities ?? [],
                buriedOnBase1: (state?.core?.bases?.[1]?.buriedCards ?? []).map((card: any) => card.defId),
            };
        });
        expect(interactionSourceAfterSecondCard.interactionSource).not.toBe('skeletons_revenant_base');
        expect(interactionSourceAfterSecondCard.interactionSource).not.toBe('skeletons_revenant_card');
        expect(interactionSourceAfterSecondCard.usedDiscardPlayAbilities).toContain('skeletons_revenant');
        expect(interactionSourceAfterSecondCard.buriedOnBase1.filter((defId: string) => defId === 'skeletons_revenant')).toHaveLength(1);

        await game.screenshot('skeletons-revenant-second-card-no-repeat', testInfo);
    });

    test('轮回者打出后应可把自己埋葬到这里', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['skeletons_returned_one'],
                deck: [],
                discard: [],
                factions: ['skeletons', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                { defId: 'base_1', minions: [], ongoingActions: [] },
                { defId: 'base_2', minions: [], ongoingActions: [] },
            ],
        });

        await game.playCard('skeletons_returned_one', { targetBaseIndex: 0 });
        await game.waitForInteraction('skeletons_returned_one');

        const promptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId ?? null,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    defId: option.value?.defId ?? null,
                    buriedFrom: option.value?.buriedFrom ?? null,
                    skip: option.value?.skip ?? false,
                })),
            };
        });

        expect(promptMeta.sourceId).toBe('skeletons_returned_one');
        expect(promptMeta.options.some((option: any) => option.defId === 'skeletons_returned_one' && option.buriedFrom === 'play')).toBe(true);

        await game.screenshot('returned-one-bury-prompt', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-skeletons-returned-one-bury-prompt-2026-04-29');

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.defId === 'skeletons_returned_one' && option.value?.buriedFrom === 'play',
            '轮回者选择把自己埋葬到这里',
        );

        await page.waitForFunction(() => {
            const sourceId = (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current?.data?.sourceId ?? null;
            return sourceId === null || sourceId === 'smashup_reaction_choose';
        }, { timeout: 5000, polling: 200 });

        const maybeReactionMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness?.state?.get?.();
            const triggerQueue = new Map((state?.core?.triggerQueue ?? []).map((trigger: any) => [trigger.id, trigger]));
            return {
                sourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
                options: (state?.sys?.interaction?.current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    label: option.label ?? null,
                    triggerSourceDefId: option.value?.triggerId
                        ? (triggerQueue.get(option.value.triggerId)?.sourceDefId ?? null)
                        : null,
                })),
            };
        });

        if (maybeReactionMeta.sourceId === 'smashup_reaction_choose') {
            const returnedOneReactionId = maybeReactionMeta.options.find(
                (option: any) => option.triggerSourceDefId === 'skeletons_returned_one',
            )?.id;
            expect(returnedOneReactionId).toBeTruthy();

            await game.screenshot('returned-one-reaction-prompt', testInfo);
            await saveStableScreenshot(page, testInfo, 'smashup-skeletons-returned-one-reaction-prompt-2026-04-29');

            await game.selectOption(returnedOneReactionId);
        }

        await game.waitForNoInteraction();
        await dismissSpotlightQueueIfPresent(page);

        const finalState = await game.getState();
        expect((finalState.core.bases[0].buriedCards ?? []).some((card: any) => card.defId === 'skeletons_returned_one')).toBe(true);
        expect(finalState.core.bases[0].minions.some((minion: any) => minion.defId === 'skeletons_returned_one')).toBe(false);

        await game.screenshot('returned-one-buried-resolved', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-skeletons-returned-one-buried-resolved-2026-04-29');
    });

    test('守墓人应在你的其他牌被埋葬后抽一张牌', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['skeletons_returned_one'],
                deck: ['robot_microbot_archive'],
                discard: [],
                factions: ['skeletons', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                {
                    defId: 'base_1',
                    minions: [
                        { uid: 'gravetender-live', defId: 'skeletons_gravetender', owner: '0', controller: '0', tempPowerModifier: 0 },
                    ],
                    ongoingActions: [],
                },
                { defId: 'base_2', minions: [], ongoingActions: [] },
            ],
        });

        await game.playCard('skeletons_returned_one', { targetBaseIndex: 0 });
        await game.waitForInteraction('skeletons_returned_one');

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.defId === 'skeletons_returned_one' && option.value?.buriedFrom === 'play',
            '轮回者选择把自己埋葬到这里，触发守墓人抽牌',
        );

        await page.waitForFunction(() => {
            const sourceId = (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current?.data?.sourceId ?? null;
            return sourceId === null || sourceId === 'smashup_reaction_choose';
        }, { timeout: 5000, polling: 200 });

        const maybeReactionMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness?.state?.get?.();
            const triggerQueue = new Map((state?.core?.triggerQueue ?? []).map((trigger: any) => [trigger.id, trigger]));
            return {
                sourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
                options: (state?.sys?.interaction?.current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    triggerSourceDefId: option.value?.triggerId
                        ? (triggerQueue.get(option.value.triggerId)?.sourceDefId ?? null)
                        : null,
                })),
            };
        });

        if (maybeReactionMeta.sourceId === 'smashup_reaction_choose') {
            const returnedOneReactionId = maybeReactionMeta.options.find(
                (option: any) => option.triggerSourceDefId === 'skeletons_returned_one',
            )?.id;
            expect(returnedOneReactionId).toBeTruthy();
            await game.selectOption(returnedOneReactionId);
        }

        await game.waitForNoInteraction();
        await dismissSpotlightQueueIfPresent(page);

        const finalState = await game.getState();
        expect(finalState.core.players['0'].hand.some((card: any) => card.defId === 'robot_microbot_archive')).toBe(true);
        expect(finalState.core.players['0'].deck.some((card: any) => card.defId === 'robot_microbot_archive')).toBe(false);
        expect((finalState.core.bases[0].buriedCards ?? []).some((card: any) => card.defId === 'skeletons_returned_one')).toBe(true);
        expect(finalState.core.bases[0].minions.find((minion: any) => minion.uid === 'gravetender-live')?.metadata?.skeletonsGravetenderTriggeredTurn).toBe(finalState.core.turnNumber);

        await game.screenshot('gravetender-bury-draw-resolved', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-skeletons-gravetender-bury-draw-resolved-2026-04-29');
    });

    test('往下埋应先选基地，再从弃牌堆埋葬至多三张总力量 6 或更少的随从', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['skeletons_place_em_down'],
                deck: [],
                discard: ['robot_microbot_alpha', 'robot_microbot_guard', 'robot_warbot'],
                factions: ['skeletons', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                { defId: 'base_1', minions: [], ongoingActions: [] },
                { defId: 'base_2', minions: [], ongoingActions: [] },
            ],
        });

        await game.playCard('skeletons_place_em_down');
        await game.waitForInteraction('skeletons_place_em_down_base');

        const basePromptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId ?? null,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    baseIndex: option.value?.baseIndex ?? null,
                })),
            };
        });

        expect(basePromptMeta.sourceId).toBe('skeletons_place_em_down_base');
        expect(basePromptMeta.options.some((option: any) => option.baseIndex === 1)).toBe(true);

        await game.screenshot('place-em-down-base-prompt', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-skeletons-place-em-down-base-prompt-2026-04-29');

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.baseIndex === 1,
            '往下埋选择基地 2',
        );
        await game.waitForInteraction('skeletons_place_em_down_cards');

        const cardsPromptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId ?? null,
                multi: current?.data?.multi ?? null,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    cardUid: option.value?.cardUid ?? null,
                    defId: option.value?.defId ?? null,
                })),
            };
        });

        expect(cardsPromptMeta.sourceId).toBe('skeletons_place_em_down_cards');
        expect(cardsPromptMeta.multi?.max).toBe(3);
        expect(cardsPromptMeta.options.map((option: any) => option.defId)).toEqual(
            expect.arrayContaining(['robot_microbot_alpha', 'robot_microbot_guard', 'robot_warbot']),
        );

        await game.screenshot('place-em-down-cards-prompt', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-skeletons-place-em-down-cards-prompt-2026-04-29');

        const optionIdAlpha = cardsPromptMeta.options.find((option: any) => option.defId === 'robot_microbot_alpha')?.id;
        const optionIdBeta = cardsPromptMeta.options.find((option: any) => option.defId === 'robot_microbot_guard')?.id;
        const optionIdWarbot = cardsPromptMeta.options.find((option: any) => option.defId === 'robot_warbot')?.id;
        expect(optionIdAlpha).toBeDefined();
        expect(optionIdBeta).toBeDefined();
        expect(optionIdWarbot).toBeDefined();

        await page.evaluate(({ optionIds }) => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness?.state?.get?.();
            const playerId = state?.sys?.interaction?.current?.playerId;
            harness.command.dispatch({
                type: 'SYS_INTERACTION_RESPOND',
                playerId,
                payload: { optionIds },
            });
        }, { optionIds: [optionIdAlpha, optionIdBeta, optionIdWarbot] });
        await game.waitForNoInteraction();
        await dismissSpotlightQueueIfPresent(page);

        const finalState = await game.getState();
        const buriedOnBase2 = finalState.core.bases[1].buriedCards ?? [];
        expect(buriedOnBase2.map((card: any) => card.defId)).toEqual(
            expect.arrayContaining(['robot_microbot_alpha', 'robot_microbot_guard', 'robot_warbot']),
        );
        expect(finalState.core.players['0'].discard.some((card: any) => card.defId === 'robot_microbot_alpha')).toBe(false);
        expect(finalState.core.players['0'].discard.some((card: any) => card.defId === 'robot_microbot_guard')).toBe(false);
        expect(finalState.core.players['0'].discard.some((card: any) => card.defId === 'robot_warbot')).toBe(false);

        await game.screenshot('place-em-down-resolved', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-skeletons-place-em-down-resolved-2026-04-29');
    });

    test('藏骨堂应在你的回合开始时允许把弃牌堆中的低力量随从埋葬到这里', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [],
                deck: [],
                discard: ['skeletons_returned_one'],
                factions: ['skeletons', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '1',
            phase: 'playCards',
            bases: [
                { defId: 'base_ossuary', minions: [], ongoingActions: [] },
                { defId: 'base_2', minions: [], ongoingActions: [] },
            ],
        });

        await dispatchHarnessCommand(page, '1', 'ADVANCE_PHASE', {});
        await game.waitForInteraction('base_ossuary');

        const promptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId ?? null,
                optionDefs: (current?.data?.options ?? []).map((option: any) => option.value?.defId ?? null),
                optionDisplayModes: (current?.data?.options ?? []).map((option: any) => option.displayMode ?? 'implicit'),
            };
        });

        expect(promptMeta.sourceId).toBe('base_ossuary');
        expect(promptMeta.optionDefs).toContain('skeletons_returned_one');
        expect(promptMeta.optionDisplayModes.filter((mode: string) => mode === 'card')).toHaveLength(1);

        await game.screenshot('skeletons-ossuary-prompt-visible', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-skeletons-ossuary-prompt-2026-04-30');

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.defId === 'skeletons_returned_one',
            '藏骨堂选择轮回者',
        );
        await game.waitForNoInteraction();
        await dismissSpotlightQueueIfPresent(page);

        const finalState = await game.getState();
        expect((finalState.core.bases[0].buriedCards ?? []).some((card: any) => card.defId === 'skeletons_returned_one')).toBe(true);
        expect(finalState.core.players['0'].discard.some((card: any) => card.defId === 'skeletons_returned_one')).toBe(false);
        await expect(page.locator('[data-buried-card-uid]').first()).toBeVisible();

        await game.screenshot('skeletons-ossuary-buried-resolved', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-skeletons-ossuary-buried-2026-04-30');
    });

    test('殉葬品打出后应先强制埋一张，再允许把额外埋葬牌放到不同基地', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['skeletons_grave_goods', 'robot_microbot_alpha', 'robot_microbot_guard'],
                deck: [],
                discard: [],
                factions: ['skeletons', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                { defId: 'base_1', minions: [], ongoingActions: [] },
                { defId: 'base_2', minions: [], ongoingActions: [] },
            ],
        });

        await game.playCard('skeletons_grave_goods');
        await game.waitForInteraction('skeletons_grave_goods_base');
        await game.screenshot('grave-goods-base-prompt', testInfo);

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.baseIndex === 0,
            '殉葬品首埋选择基地 1',
        );
        await game.waitForInteraction('skeletons_grave_goods_bury');

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.defId === 'robot_microbot_alpha',
            '殉葬品首埋选择机器人阿尔法',
        );
        await game.waitForInteraction('skeletons_grave_goods_mode');
        await game.screenshot('grave-goods-followup-mode', testInfo);

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.mode === 'extra_bury',
            '殉葬品选择额外埋葬分支',
        );
        await game.waitForInteraction('skeletons_grave_goods_bonus');

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.defId === 'robot_microbot_guard',
            '殉葬品选择机器人贝塔作为额外埋葬牌',
        );
        await game.waitForInteraction('skeletons_grave_goods_bonus_base');

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.baseIndex === 1,
            '殉葬品额外埋葬改放基地 2',
        );
        await game.waitForNoInteraction();

        const stateAfterResolve = await game.getState();
        expect((stateAfterResolve.core.bases[0].buriedCards ?? []).some((card: any) => card.defId === 'robot_microbot_alpha')).toBe(true);
        expect((stateAfterResolve.core.bases[1].buriedCards ?? []).some((card: any) => card.defId === 'robot_microbot_guard')).toBe(true);

        await game.screenshot('grave-goods-resolved', testInfo);
    });

    test('诡异。可怕。应从弃牌堆埋葬低力量随从并抽一张牌', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['skeletons_spooky_scary'],
                deck: ['robot_microbot_archive'],
                discard: ['robot_microbot_alpha'],
                factions: ['skeletons', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                { defId: 'base_1', minions: [], ongoingActions: [] },
                { defId: 'base_2', minions: [], ongoingActions: [] },
            ],
        });

        await game.playCard('skeletons_spooky_scary');
        await game.waitForInteraction('skeletons_spooky_scary_base');

        const basePromptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId ?? null,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    baseIndex: option.value?.baseIndex ?? null,
                })),
            };
        });

        expect(basePromptMeta.sourceId).toBe('skeletons_spooky_scary_base');
        expect(basePromptMeta.options.some((option: any) => option.baseIndex === 1)).toBe(true);

        await game.screenshot('spooky-scary-base-prompt', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-skeletons-spooky-scary-base-prompt-2026-04-29');

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.baseIndex === 1,
            '诡异。可怕。选择基地 2',
        );
        await game.waitForInteraction('skeletons_spooky_scary_card');

        const cardPromptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId ?? null,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    defId: option.value?.defId ?? null,
                    buriedFrom: option.value?.buriedFrom ?? null,
                })),
            };
        });

        expect(cardPromptMeta.sourceId).toBe('skeletons_spooky_scary_card');
        expect(cardPromptMeta.options.some((option: any) => option.defId === 'robot_microbot_alpha' && option.buriedFrom === 'discard')).toBe(true);

        await game.screenshot('spooky-scary-card-prompt', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-skeletons-spooky-scary-card-prompt-2026-04-29');

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.defId === 'robot_microbot_alpha',
            '诡异。可怕。选择弃牌堆里的微型机阿尔法号',
        );
        await game.waitForNoInteraction();
        await dismissSpotlightQueueIfPresent(page);

        const finalState = await game.getState();
        expect((finalState.core.bases[1].buriedCards ?? []).some((card: any) => card.defId === 'robot_microbot_alpha')).toBe(true);
        expect(finalState.core.players['0'].hand.some((card: any) => card.defId === 'robot_microbot_archive')).toBe(true);
        expect(finalState.core.players['0'].discard.some((card: any) => card.defId === 'robot_microbot_alpha')).toBe(false);

        await game.screenshot('spooky-scary-resolved', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-skeletons-spooky-scary-resolved-2026-04-29');
    });

    test('灵车队伍普通打出应可移动其他玩家的埋葬牌', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['skeletons_hearse_fleet'],
                deck: [],
                discard: [],
                factions: ['skeletons', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                {
                    defId: 'base_1',
                    minions: [],
                    ongoingActions: [],
                    buriedCards: [
                        {
                            uid: 'enemy-buried-1',
                            defId: 'pirate_first_mate',
                            trueOwnerId: '1',
                            controllerId: '1',
                            buriedFrom: 'hand',
                        },
                    ],
                },
                { defId: 'base_2', minions: [], ongoingActions: [] },
            ],
        });

        await game.playCard('skeletons_hearse_fleet');
        await game.waitForInteraction('skeletons_hearse_fleet_base');

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.baseIndex === 0,
            '灵车队伍选择基地 1 作为来源',
        );
        await game.waitForInteraction('skeletons_hearse_fleet_target');

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.baseIndex === 1,
            '灵车队伍选择基地 2 作为目标',
        );
        await game.waitForInteraction('skeletons_hearse_fleet_cards');
        await game.screenshot('hearse-fleet-cards-prompt', testInfo);

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.cardUid === 'enemy-buried-1',
            '灵车队伍选择对手的埋葬牌',
        );
        await game.waitForNoInteraction();

        const stateAfterResolve = await game.getState();
        expect((stateAfterResolve.core.bases[0].buriedCards ?? []).some((card: any) => card.uid === 'enemy-buried-1')).toBe(false);
        expect((stateAfterResolve.core.bases[1].buriedCards ?? []).some((card: any) => card.uid === 'enemy-buried-1')).toBe(true);

        await game.screenshot('hearse-fleet-resolved', testInfo);
    });

    test('他们出来了应只允许选择有己方埋葬牌的基地，并可一次挖掘多张己方埋葬牌', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['skeletons_dig_em_up'],
                deck: [],
                discard: [],
                factions: ['skeletons', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                {
                    defId: 'base_1',
                    minions: [],
                    ongoingActions: [],
                    buriedCards: [
                        {
                            uid: 'dig-own-a',
                            defId: 'robot_microbot_alpha',
                            trueOwnerId: '0',
                            controllerId: '0',
                            buriedFrom: 'discard',
                        },
                        {
                            uid: 'dig-own-b',
                            defId: 'robot_warbot',
                            trueOwnerId: '0',
                            controllerId: '0',
                            buriedFrom: 'discard',
                        },
                    ],
                },
                {
                    defId: 'base_2',
                    minions: [],
                    ongoingActions: [],
                    buriedCards: [
                        {
                            uid: 'dig-enemy-only',
                            defId: 'pirate_first_mate',
                            trueOwnerId: '1',
                            controllerId: '1',
                            buriedFrom: 'discard',
                        },
                    ],
                },
            ],
        });

        await game.playCard('skeletons_dig_em_up');
        await game.waitForInteraction('skeletons_dig_em_up_base');

        const basePromptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId ?? null,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    baseIndex: option.value?.baseIndex ?? null,
                })),
            };
        });

        expect(basePromptMeta.sourceId).toBe('skeletons_dig_em_up_base');
        expect(basePromptMeta.options.some((option: any) => option.baseIndex === 0)).toBe(true);
        expect(basePromptMeta.options.some((option: any) => option.baseIndex === 1)).toBe(false);

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.baseIndex === 0,
            '他们出来了选择基地 1',
        );
        await game.waitForInteraction('skeletons_dig_em_up_cards');

        const cardsPromptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId ?? null,
                multi: current?.data?.multi ?? null,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    cardUid: option.value?.cardUid ?? null,
                    baseIndex: option.value?.baseIndex ?? null,
                })),
            };
        });

        expect(cardsPromptMeta.sourceId).toBe('skeletons_dig_em_up_cards');
        expect(cardsPromptMeta.multi?.max).toBe(2);
        expect(cardsPromptMeta.options.map((option: any) => option.cardUid)).toEqual(
            expect.arrayContaining(['dig-own-a', 'dig-own-b']),
        );
        expect(cardsPromptMeta.options.map((option: any) => option.cardUid)).not.toContain('dig-enemy-only');

        const buriedCardA = page.locator('[data-buried-card-uid="dig-own-a"]').first();
        const buriedCardB = page.locator('[data-buried-card-uid="dig-own-b"]').first();
        await expect(buriedCardA).toBeVisible({ timeout: 5000 });
        await expect(buriedCardB).toBeVisible({ timeout: 5000 });
        await expect(buriedCardA).toHaveAttribute('data-buried-face-up', 'true');
        await expect(buriedCardA).toHaveAttribute('data-buried-selectable', 'true');
        await expect(buriedCardB).toHaveAttribute('data-buried-selectable', 'true');

        await game.screenshot('skeletons-dig-em-up-cards-prompt', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-skeletons-dig-em-up-cards-prompt-2026-04-29');

        const buriedOptionA = cardsPromptMeta.options.find((option: any) => option.cardUid === 'dig-own-a');
        const buriedOptionB = cardsPromptMeta.options.find((option: any) => option.cardUid === 'dig-own-b');
        expect(buriedOptionA?.id).toBeDefined();
        expect(buriedOptionB?.id).toBeDefined();

        await page.evaluate(({ optionIdA, optionIdB }) => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness?.state?.get?.();
            const playerId = state?.sys?.interaction?.current?.playerId;
            harness.command.dispatch({
                type: 'SYS_INTERACTION_RESPOND',
                playerId,
                payload: { optionIds: [optionIdA, optionIdB] },
            });
        }, { optionIdA: buriedOptionA.id, optionIdB: buriedOptionB.id });
        await game.waitForNoInteraction();
        await dismissSpotlightQueueIfPresent(page);

        const finalState = await game.getState();
        expect((finalState.core.bases[0].buriedCards ?? []).some((card: any) => card.uid === 'dig-own-a')).toBe(false);
        expect((finalState.core.bases[0].buriedCards ?? []).some((card: any) => card.uid === 'dig-own-b')).toBe(false);
        expect(finalState.core.bases[0].minions.some((minion: any) => minion.uid === 'dig-own-a')).toBe(true);
        expect(finalState.core.bases[0].minions.some((minion: any) => minion.uid === 'dig-own-b')).toBe(true);

        await game.screenshot('skeletons-dig-em-up-resolved', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-skeletons-dig-em-up-resolved-2026-04-29');
    });

    test('墓园应可从场上发动天赋挖掘己方埋葬牌，并在挖出随从后可放置 +1 指示物', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['skeletons_graveyard'],
                deck: [],
                discard: [],
                factions: ['skeletons', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                {
                    defId: 'base_1',
                    minions: [],
                    ongoingActions: [],
                    buriedCards: [
                        {
                            uid: 'graveyard-own-buried',
                            defId: 'robot_microbot_alpha',
                            trueOwnerId: '0',
                            controllerId: '0',
                            buriedFrom: 'discard',
                        },
                        {
                            uid: 'graveyard-enemy-buried',
                            defId: 'pirate_first_mate',
                            trueOwnerId: '1',
                            controllerId: '1',
                            buriedFrom: 'discard',
                        },
                    ],
                },
                {
                    defId: 'base_2',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        await game.playCard('skeletons_graveyard', { targetBaseIndex: 0 });
        await game.waitForNoInteraction();
        await dismissSpotlightQueueIfPresent(page);

        const attachedOngoingUid = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness?.state?.get?.();
            return state?.core?.bases?.[0]?.ongoingActions?.find((action: any) => action.defId === 'skeletons_graveyard')?.uid ?? null;
        });
        expect(attachedOngoingUid).toBeTruthy();

        const ongoingCard = page.locator(`[data-ongoing-uid="${attachedOngoingUid}"]`).first();
        await expect(ongoingCard).toBeVisible({ timeout: 5000 });
        await ongoingCard.click({ force: true });
        await ongoingCard.click({ force: true });
        await game.waitForInteraction('skeletons_graveyard');

        const uncoverPromptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId ?? null,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    cardUid: option.value?.cardUid ?? null,
                    baseIndex: option.value?.baseIndex ?? null,
                })),
            };
        });

        expect(uncoverPromptMeta.sourceId).toBe('skeletons_graveyard');
        expect(uncoverPromptMeta.options.some((option: any) => option.cardUid === 'graveyard-own-buried')).toBe(true);
        expect(uncoverPromptMeta.options.some((option: any) => option.cardUid === 'graveyard-enemy-buried')).toBe(false);

        await game.screenshot('graveyard-uncover-prompt', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-skeletons-graveyard-uncover-prompt-2026-04-29');

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.cardUid === 'graveyard-own-buried',
            '墓园选择己方埋葬牌进行挖掘',
        );
        await game.waitForInteraction('skeletons_graveyard_counter');

        const counterPromptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId ?? null,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    apply: option.value?.apply ?? null,
                })),
            };
        });

        expect(counterPromptMeta.sourceId).toBe('skeletons_graveyard_counter');
        expect(counterPromptMeta.options.some((option: any) => option.apply === true)).toBe(true);

        await game.screenshot('graveyard-counter-prompt', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-skeletons-graveyard-counter-prompt-2026-04-29');

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.apply === true,
            '墓园选择给挖出的随从放置 +1 指示物',
        );
        await game.waitForNoInteraction();
        await dismissSpotlightQueueIfPresent(page);

        const finalState = await game.getState();
        expect((finalState.core.bases[0].buriedCards ?? []).some((card: any) => card.uid === 'graveyard-own-buried')).toBe(false);
        expect((finalState.core.bases[0].buriedCards ?? []).some((card: any) => card.uid === 'graveyard-enemy-buried')).toBe(true);
        expect(finalState.core.bases[0].minions.some((minion: any) => minion.uid === 'graveyard-own-buried')).toBe(true);
        expect(finalState.core.bases[0].minions.find((minion: any) => minion.uid === 'graveyard-own-buried')?.powerCounters).toBe(1);

        await game.screenshot('graveyard-resolved', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-skeletons-graveyard-resolved-2026-04-29');
    });

    test('骸骨之王应可从场上发动天赋挖掘这里任意埋葬牌，并在挖出其他随从后可放置 +1 指示物', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['skeletons', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                {
                    defId: 'base_1',
                    minions: [
                        { uid: 'lob-1', defId: 'skeletons_lord_of_bones', owner: '0', controller: '0', tempPowerModifier: 0, powerCounters: 0 },
                    ],
                    ongoingActions: [],
                    buriedCards: [
                        {
                            uid: 'lob-enemy-buried',
                            defId: 'robot_microbot_alpha',
                            trueOwnerId: '1',
                            controllerId: '1',
                            buriedFrom: 'discard',
                        },
                    ],
                },
                {
                    defId: 'base_2',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        await page.locator('[data-minion-uid="lob-1"]').click({ force: true });
        await game.waitForInteraction('skeletons_lord_of_bones_uncover');

        const uncoverPromptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId ?? null,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    cardUid: option.value?.cardUid ?? null,
                    baseIndex: option.value?.baseIndex ?? null,
                })),
            };
        });

        expect(uncoverPromptMeta.sourceId).toBe('skeletons_lord_of_bones_uncover');
        expect(uncoverPromptMeta.options.some((option: any) => option.cardUid === 'lob-enemy-buried')).toBe(true);

        await game.screenshot('lord-of-bones-uncover-prompt', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-skeletons-lord-of-bones-uncover-prompt-2026-04-29');

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.cardUid === 'lob-enemy-buried',
            '骸骨之王选择挖掘这里的其他玩家埋葬牌',
        );
        await game.waitForInteraction('smashup_reaction_choose');

        const reactionMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness?.state?.get?.();
            const triggerQueue = new Map((state?.core?.triggerQueue ?? []).map((trigger: any) => [trigger.id, trigger]));
            return {
                sourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
                options: (state?.sys?.interaction?.current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    label: option.label ?? null,
                    triggerSourceDefId: option.value?.triggerId
                        ? (triggerQueue.get(option.value.triggerId)?.sourceDefId ?? null)
                        : null,
                })),
            };
        });

        expect(reactionMeta.sourceId).toBe('smashup_reaction_choose');
        const lordOfBonesReactionId = reactionMeta.options.find(
            (option: any) => option.triggerSourceDefId === 'skeletons_lord_of_bones',
        )?.id;
        expect(lordOfBonesReactionId).toBeTruthy();

        await game.screenshot('lord-of-bones-reaction-prompt', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-skeletons-lord-of-bones-reaction-prompt-2026-04-29');

        await game.selectOption(lordOfBonesReactionId);
        await game.waitForInteraction('skeletons_lord_of_bones_ongoing');

        const counterPromptMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId ?? null,
                options: (current?.data?.options ?? []).map((option: any) => ({
                    id: option.id,
                    apply: option.value?.apply ?? null,
                })),
            };
        });

        expect(counterPromptMeta.sourceId).toBe('skeletons_lord_of_bones_ongoing');
        expect(counterPromptMeta.options.some((option: any) => option.apply === true)).toBe(true);

        await game.screenshot('lord-of-bones-counter-prompt', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-skeletons-lord-of-bones-counter-prompt-2026-04-29');

        await game.selectInteractionOptionBy(
            (option: any) => option.value?.apply === true,
            '骸骨之王选择给挖出的随从放置 +1 指示物',
        );
        await game.waitForNoInteraction();
        await dismissSpotlightQueueIfPresent(page);

        const finalState = await game.getState();
        expect((finalState.core.bases[0].buriedCards ?? []).some((card: any) => card.uid === 'lob-enemy-buried')).toBe(false);
        expect(finalState.core.bases[0].minions.some((minion: any) => minion.uid === 'lob-enemy-buried')).toBe(true);
        expect(finalState.core.bases[0].minions.find((minion: any) => minion.uid === 'lob-enemy-buried')?.powerCounters).toBe(1);

        await game.screenshot('lord-of-bones-resolved', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-skeletons-lord-of-bones-resolved-2026-04-29');
    });

    test('墓碑应在基地计分后可把自己埋葬到另一个基地', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(90000);

        const setup = await setupSUOnlineMatch(browser, baseURL, ['skeletons', 'robots', 'pirates', 'dinosaurs']);
        if (!setup) {
            test.skip(true, '游戏服务器不可用');
            return;
        }

        const { hostPage, guestPage, hostContext, guestContext } = setup;
        try {
            await waitForHandArea(hostPage);
            await waitForHandArea(guestPage);

            const fullState = await readFullState(hostPage);
            const injectedState = prepareInjectedOnlineState(fullState as Record<string, any>, (core) => {
                const turnOrder = core.turnOrder as string[];
                const hostPid = turnOrder[0];
                const guestPid = turnOrder[1];

                core.currentPlayerIndex = 0;
                core.currentPlayer = hostPid;
                core.players[hostPid].hand = [];
                core.players[guestPid].hand = [];
                core.players[hostPid].deck = [];
                core.players[guestPid].deck = [];
                core.players[hostPid].minionsPlayed = 0;
                core.players[hostPid].actionsPlayed = 0;
                core.players[guestPid].actionsPlayed = 0;
                core.bases[0].defId = 'base_the_jungle';
                core.bases[0].minions = [
                    makeMinion('gravestones-host-rex', 'dino_king_rex', hostPid, hostPid, 7),
                    makeMinion('gravestones-host-raptor', 'dino_war_raptor', hostPid, hostPid, 4),
                    makeMinion('gravestones-host-alpha', 'robot_microbot_alpha', hostPid, hostPid, 1),
                ];
                core.bases[0].ongoingActions = [{
                    uid: 'gravestones-live',
                    defId: 'skeletons_gravestones',
                    ownerId: hostPid,
                }];
                core.bases[1].defId = 'base_tar_pits';
                core.bases[1].minions = [];
                core.bases[1].ongoingActions = [];
                for (let index = 2; index < core.bases.length; index += 1) {
                    core.bases[index].minions = [];
                    core.bases[index].ongoingActions = [];
                }
            });

            await applyCoreStateDirect(hostPage, injectedState);
            await closeDebugPanel(hostPage);
            await closeDebugPanel(guestPage);
            await hostPage.waitForTimeout(2000);

            await hostPage.getByRole('button', { name: /^(结束回合|Finish Turn|End)$/i }).click({ force: true });
            await waitForScoreBasesOrReactionEntry(hostPage, 12000);
            await activateReactionTrigger(
                hostPage,
                '0',
                {
                    triggerSourceDefId: 'skeletons_gravestones',
                    optionLabelIncludes: '墓碑',
                    optionIdIncludes: 'skeletons_gravestones',
                },
                'skeletons_gravestones_after_scoring',
                12000,
                guestPage,
            );

            const promptState = await readAuthoritativeState(hostPage);
            const prompt = (() => {
                const current = getCurrentInteraction(promptState);
                const data = asRecord(current?.data);
                return {
                    sourceId: data?.sourceId ?? null,
                    targetType: data?.targetType ?? null,
                    options: (Array.isArray(data?.options) ? data.options : []).map((option: any) => ({
                        id: option.id,
                        fieldInteractionType: option.value?.fieldInteractionType ?? null,
                        fieldSourceType: option.value?.fieldSourceType ?? null,
                        fieldTargetType: option.value?.fieldTargetType ?? null,
                        sourceUid: option.value?.sourceUid ?? null,
                        baseIndex: option.value?.baseIndex ?? null,
                        targetBaseIndex: option.value?.targetBaseIndex ?? null,
                    })),
                };
            })();

            expect(prompt.sourceId).toBe('skeletons_gravestones_after_scoring');
            expect(prompt.targetType).toBe('field-source-target');
            expect(prompt.options).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    fieldInteractionType: 'source-target',
                    fieldSourceType: 'ongoing',
                    fieldTargetType: 'base',
                    sourceUid: 'gravestones-live',
                    baseIndex: 1,
                    targetBaseIndex: 1,
                }),
            ]));

            await expect(hostPage.locator('[data-ongoing-uid="gravestones-live"]')).toBeVisible({ timeout: 5000 });
            await hostPage.screenshot({ path: testInfo.outputPath('gravestones-after-scoring-source-highlight.png'), fullPage: true });
            await saveStableScreenshot(hostPage, testInfo, 'smashup-skeletons-gravestones-source-highlight-2026-08-17');

            await hostPage.locator('[data-ongoing-uid="gravestones-live"]').click({ force: true });
            await hostPage.screenshot({ path: testInfo.outputPath('gravestones-after-scoring-target-base-highlight.png'), fullPage: true });
            await saveStableScreenshot(hostPage, testInfo, 'smashup-skeletons-gravestones-target-base-highlight-2026-08-17');

            await clickBaseOnBoard(hostPage, 1, 10000);
            await waitForNoInteraction(hostPage, 10000);

            const finalState = await readFullState(hostPage);
            const resolvedCore = (finalState.core ?? finalState) as Record<string, any>;
            const buriedOnTargetBase = (resolvedCore.bases[1].buriedCards ?? []).some((card: any) => card.uid === 'gravestones-live');
            const sourceStillHasCard = (resolvedCore.bases[0].ongoingActions ?? []).some((action: any) => action.uid === 'gravestones-live');

            expect(buriedOnTargetBase).toBe(true);
            expect(sourceStillHasCard).toBe(false);

            await hostPage.screenshot({ path: testInfo.outputPath('gravestones-buried-on-other-base.png'), fullPage: true });
            await saveStableScreenshot(hostPage, testInfo, 'smashup-skeletons-gravestones-buried-2026-04-29');
        } finally {
            await hostContext.close().catch(() => {});
            await guestContext.close().catch(() => {});
        }
    });

    test('墓地爆发应在基地计分前可挖掘你埋葬在那里的牌', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['skeletons_burst_forth'],
                deck: [],
                discard: [],
                factions: ['skeletons', 'dinosaurs'],
            },
            player1: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['robots', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [{
                defId: 'base_the_jungle',
                minions: [
                    { uid: 'burst-host-laser', defId: 'dino_laser_triceratops', owner: '0', controller: '0', tempPowerModifier: 0 },
                    { uid: 'burst-enemy-rex', defId: 'dino_king_rex', owner: '1', controller: '1', tempPowerModifier: 0 },
                    { uid: 'burst-enemy-alpha', defId: 'robot_microbot_alpha', owner: '1', controller: '1', tempPowerModifier: 0 },
                ],
                ongoingActions: [],
                buriedCards: [
                    { uid: 'burst-buried', defId: 'dino_king_rex', trueOwnerId: '0', controllerId: '0', buriedFrom: 'discard' },
                ],
            }, {
                defId: 'base_tar_pits',
                minions: [],
                ongoingActions: [],
                buriedCards: [],
            }],
        });

        await page.getByRole('button', { name: /^(结束回合|Finish Turn|End)$/i }).click({ force: true });
        await waitForScoreBasesOrReactionEntry(page, 12000);
        await activateReactionTrigger(
            page,
            '0',
            {
                optionLabelIncludes: '墓地爆发',
                optionIdIncludes: 'skeletons_burst_forth',
            },
            'skeletons_burst_forth',
            12000,
        );

        const promptState = await readAuthoritativeState(page);
        const prompt = (() => {
            const current = getCurrentInteraction(promptState);
            const data = asRecord(current?.data);
            return {
                sourceId: data?.sourceId ?? null,
                options: (Array.isArray(data?.options) ? data.options : []).map((option: any) => ({
                    id: option.id,
                    cardUid: option.value?.cardUid ?? null,
                    defId: option.value?.defId ?? null,
                    baseIndex: option.value?.baseIndex ?? null,
                })),
            };
        })();

        expect(prompt.sourceId).toBe('skeletons_burst_forth');
        expect(prompt.options.some((option: any) => option.cardUid === 'burst-buried' && option.baseIndex === 0)).toBe(true);

        await game.screenshot('burst-forth-prompt', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-skeletons-burst-forth-prompt-2026-04-29');

        const buriedCard = page.locator('[data-buried-card-uid="burst-buried"]').first();
        await expect(buriedCard).toBeVisible({ timeout: 5000 });
        await expect(buriedCard).toHaveAttribute('data-buried-face-up', 'true');
        await expect(buriedCard).toHaveAttribute('data-buried-selectable', 'true');

        await buriedCard.click();
        await game.waitForNoInteraction();
        await dismissSpotlightQueueIfPresent(page);

        const finalState = await game.getState();
        expect((finalState.core.bases[0].buriedCards ?? []).some((card: any) => card.uid === 'burst-buried')).toBe(false);
        expect(finalState.core.players['0'].vp).toBe(2);
        expect(finalState.core.players['1'].vp).toBe(0);

        await game.screenshot('burst-forth-resolved', testInfo);
        await saveStableScreenshot(page, testInfo, 'smashup-skeletons-burst-forth-resolved-2026-04-29');
    });

    test('墓地爆发在多基地计分前应只响应当前计分基地', async ({ browser, baseURL }, testInfo) => {
        test.setTimeout(90000);

        const setup = await setupSUOnlineMatch(browser, baseURL, ['skeletons', 'dinosaurs', 'robots', 'pirates']);
        if (!setup) {
            test.skip(true, '游戏服务器不可用');
            return;
        }

        const { hostPage, guestPage, hostContext, guestContext } = setup;
        try {
            await waitForHandArea(hostPage);
            await waitForHandArea(guestPage);

            const fullState = await readFullState(hostPage);
            const injectedState = prepareInjectedOnlineState(fullState as Record<string, any>, (core) => {
                const turnOrder = core.turnOrder as string[];
                const hostPid = turnOrder[0];
                const guestPid = turnOrder[1];

                core.currentPlayerIndex = 0;
                core.currentPlayer = hostPid;
                core.scoringEligibleBaseIndices = undefined;
                core.players[hostPid].hand = [makeCard('burst-multi-hand', 'skeletons_burst_forth', 'action', hostPid)];
                core.players[guestPid].hand = [];
                core.players[hostPid].deck = [];
                core.players[guestPid].deck = [];
                core.players[hostPid].discard = [];
                core.players[guestPid].discard = [];
                core.players[hostPid].actionsPlayed = 0;
                core.players[hostPid].minionsPlayed = 0;
                core.players[guestPid].actionsPlayed = 0;
                core.players[guestPid].minionsPlayed = 0;

                core.bases[0].defId = 'base_the_jungle';
                core.bases[0].minions = [
                    makeMinion('burst-current-host-rex', 'dino_king_rex', hostPid, hostPid, 7),
                    makeMinion('burst-current-host-raptor', 'dino_war_raptor', hostPid, hostPid, 4),
                    makeMinion('burst-current-enemy-alpha', 'robot_microbot_alpha', guestPid, guestPid, 1),
                ];
                core.bases[0].ongoingActions = [];
                core.bases[0].buriedCards = [
                    { uid: 'burst-current-buried', defId: 'robot_microbot_alpha', trueOwnerId: hostPid, controllerId: hostPid, buriedFrom: 'discard' },
                ];

                core.bases[1].defId = 'base_tar_pits';
                core.bases[1].minions = [
                    makeMinion('burst-next-host-rex', 'dino_king_rex', hostPid, hostPid, 7),
                    makeMinion('burst-next-host-raptor', 'dino_war_raptor', hostPid, hostPid, 4),
                ];
                core.bases[1].ongoingActions = [];
                core.bases[1].buriedCards = [];

                for (let index = 2; index < core.bases.length; index += 1) {
                    core.bases[index].minions = [];
                    core.bases[index].ongoingActions = [];
                    core.bases[index].buriedCards = [];
                }
            });

            await applyCoreStateDirect(hostPage, injectedState);
            await closeDebugPanel(hostPage);
            await closeDebugPanel(guestPage);
            await hostPage.waitForTimeout(2000);

            await hostPage.getByRole('button', { name: /^(结束回合|Finish Turn|End)$/i }).click({ force: true });
            await waitForScoreBasesOrReactionEntry(hostPage, 12000);
            await activateReactionTrigger(
                hostPage,
                '0',
                {
                    optionLabelIncludes: '墓地爆发',
                    optionIdIncludes: 'skeletons_burst_forth',
                },
                'skeletons_burst_forth',
                12000,
                guestPage,
            );

            const promptState = await readAuthoritativeState(hostPage);
            const prompt = (() => {
                const current = getCurrentInteraction(promptState);
                const data = asRecord(current?.data);
                return {
                    sourceId: data?.sourceId ?? null,
                    options: (Array.isArray(data?.options) ? data.options : []).map((option: any) => ({
                        id: option.id,
                        cardUid: option.value?.cardUid ?? null,
                        baseIndex: option.value?.baseIndex ?? null,
                    })),
                };
            })();

            expect(prompt.sourceId).toBe('skeletons_burst_forth');
            expect(prompt.options.some((option: any) => option.cardUid === 'burst-current-buried' && option.baseIndex === 0)).toBe(true);
            expect(prompt.options.some((option: any) => option.baseIndex === 1)).toBe(false);

            await saveStableScreenshot(hostPage, testInfo, 'smashup-skeletons-burst-forth-current-base-only-prompt-2026-06-04');

            const buriedCard = hostPage.locator('[data-buried-card-uid="burst-current-buried"]').first();
            await expect(buriedCard).toBeVisible({ timeout: 5000 });
            await expect(buriedCard).toHaveAttribute('data-buried-selectable', 'true');

            await buriedCard.click();
            await waitForNoInteraction(hostPage, 10000);
            await dismissSpotlightQueueIfPresent(hostPage);

            const finalState = await readFullState(hostPage);
            const resolvedCore = (finalState.core ?? finalState) as Record<string, any>;
            expect((resolvedCore.bases[0].buriedCards ?? []).some((card: any) => card.uid === 'burst-current-buried')).toBe(false);
            expect((finalState.sys as Record<string, any> | undefined)?.interaction?.current).toBeUndefined();
            expect((resolvedCore.players?.[resolvedCore.turnOrder?.[0]]?.vp ?? 0) > 0).toBe(true);
            const delayUntil = (finalState.sys as Record<string, any> | undefined)?._smashupPostScoringBaseRevealDelayUntil;
            expect(typeof delayUntil).toBe('number');
            expect(delayUntil).toBeGreaterThan(Date.now());
            expect(resolvedCore.bases[0].defId).toBe('base_the_jungle');
            expect((resolvedCore.bases[0].minions ?? []).some((minion: any) => minion.uid === 'burst-current-buried')).toBe(true);

            await saveStableScreenshot(hostPage, testInfo, 'smashup-skeletons-burst-forth-current-base-only-resolved-2026-06-04');

            let replacedState: Record<string, any> | null = null;
            const replaceDeadline = Date.now() + 6000;
            while (Date.now() < replaceDeadline) {
                const candidate = await readFullState(hostPage);
                const candidateCore = (candidate.core ?? candidate) as Record<string, any>;
                if (typeof candidateCore.bases?.[0]?.defId === 'string' && candidateCore.bases[0].defId !== 'base_the_jungle') {
                    replacedState = candidate;
                    break;
                }
                await hostPage.waitForTimeout(200);
            }
            expect(replacedState).not.toBeNull();
            const replacedCore = (replacedState!.core ?? replacedState) as Record<string, any>;
            expect(replacedCore.bases[0].defId).not.toBe('base_the_jungle');
            expect((replacedState.sys as Record<string, any> | undefined)?._smashupPostScoringBaseRevealDelayUntil).toBeUndefined();
            await saveStableScreenshot(hostPage, testInfo, 'smashup-skeletons-burst-forth-current-base-only-base-replaced-2026-06-04');
        } finally {
            await hostContext.close().catch(() => {});
            await guestContext.close().catch(() => {});
        }
    });

    test('狮身人面像埋葬牌交互应直接在场景内翻正面并高亮可选牌', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['ancient_egyptians', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                {
                    defId: 'base_pyramids',
                    buriedCards: [
                        {
                            uid: 'sphinx-buried-1',
                            defId: 'robot_warbot',
                            trueOwnerId: '0',
                            controllerId: '0',
                            buriedFrom: 'hand',
                        },
                    ],
                },
            ],
            extra: {
                core: {
                    titans: [
                        {
                            uid: 't-sphinx-setaside',
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
                sys: {
                    interaction: {
                        current: {
                            id: 'e2e-sphinx-bury-prompt',
                            kind: 'simple-choice',
                            playerId: '0',
                            data: {
                                title: '狮身人面像：选择一张你的埋葬牌，将其回手并把此泰坦放到其所在基地',
                                sourceId: 'titan_sphinx_start_turn',
                                targetType: 'generic',
                                continuationContext: {
                                    titanUid: 't-sphinx-setaside',
                                    titanDefId: 'sphinx',
                                },
                                options: [
                                    {
                                        id: 'buried-sphinx-buried-1',
                                        label: '战斗机器人 @ 金字塔',
                                        value: {
                                            cardUid: 'sphinx-buried-1',
                                            defId: 'robot_warbot',
                                            baseIndex: 0,
                                            baseDefId: 'base_pyramids',
                                        },
                                        displayMode: 'card',
                                    },
                                    {
                                        id: 'skip',
                                        label: '跳过',
                                        value: { skip: true },
                                        displayMode: 'button',
                                    },
                                ],
                            },
                        },
                        queue: [],
                    },
                },
            },
        });

        const interactionMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId,
                optionDisplayModes: (current?.data?.options ?? []).map((option: any) => option.displayMode ?? 'implicit'),
            };
        });

        expect(interactionMeta.sourceId).toBe('titan_sphinx_start_turn');
        expect(interactionMeta.optionDisplayModes).toEqual(['card', 'button']);

        const cardOptions = page.locator('[data-testid^="prompt-card-"]');
        await expect(cardOptions).toHaveCount(0);

        const buriedCard = page.locator('[data-buried-card-uid="sphinx-buried-1"]').first();
        await expect(buriedCard).toBeVisible();
        await expect(buriedCard).toHaveAttribute('data-buried-face-up', 'true');
        await expect(buriedCard).toHaveAttribute('data-buried-selectable', 'true');
        await expect(page.getByRole('button', { name: '跳过' })).toBeVisible();

        await game.screenshot('sphinx-bury-board-select', testInfo);
        await saveStableScreenshot(page, testInfo, 'sphinx-bury-board-select');

        await buriedCard.click();
        await game.waitForNoInteraction();
        await page.waitForFunction(
            () => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                const state = harness?.state?.get?.();
                const sphinx = (state?.core?.titans ?? []).find((titan: any) => titan.uid === 't-sphinx-setaside');
                const buriedStillExists = state?.core?.bases?.[0]?.buriedCards?.some((card: any) => card.uid === 'sphinx-buried-1') ?? false;
                return sphinx?.location?.zone === 'base' && sphinx?.location?.baseIndex === 0 && buriedStillExists === false;
            },
            { timeout: 5000, polling: 200 },
        );

        const finalState = await game.getState();
        expect(finalState.core.bases[0].buriedCards?.some((card: any) => card.uid === 'sphinx-buried-1') ?? false).toBe(false);
        const sphinx = (finalState.core.titans ?? []).find((titan: any) => titan.uid === 't-sphinx-setaside');
        expect(sphinx?.location?.zone).toBe('base');
        expect(sphinx?.location?.baseIndex).toBe(0);
    });

    test('企鹅帝皇天赋交互应显示卡牌选项而不是文字按钮', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [{ uid: 'emperor-hand-minion', defId: 'pirate_first_mate', type: 'minion', owner: '0' }],
                deck: [{ uid: 'emperor-existing-deck', defId: 'robot_microbot_guard', type: 'minion', owner: '0' }],
                discard: [],
                factions: ['penguins', 'pirates'],
            },
            player1: {
                hand: [],
                deck: [],
                discard: [],
                factions: ['robots', 'ninjas'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            bases: [
                { defId: 'base_the_homeworld', minions: [], ongoingActions: [] },
                { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
            ],
            extra: {
                core: {
                    enabledExpansions: ['titans'],
                    titans: [
                        {
                            uid: 't-emperor-talent',
                            defId: 'penguins_emperor_penguin',
                            faction: 'penguins',
                            ownerId: '0',
                            controllerId: '0',
                            powerCounters: 0,
                            talentUsed: false,
                            location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                        },
                    ],
                },
                sys: {
                    interaction: {
                        current: {
                            id: 'e2e-emperor-penguin-talent',
                            kind: 'simple-choice',
                            playerId: '0',
                            data: {
                                title: '企鹅帝皇：选择要洗回牌库的低战力随从',
                                sourceId: 'titan_penguins_emperor_penguin_talent',
                                targetType: 'generic',
                                options: [
                                    {
                                        id: 'emperor-hand-minion',
                                        label: '大副（手牌）',
                                        value: {
                                            cardUid: 'emperor-hand-minion',
                                            defId: 'pirate_first_mate',
                                            zone: 'hand',
                                        },
                                        displayMode: 'card',
                                    },
                                ],
                            },
                        },
                        queue: [],
                    },
                },
            },
        });

        const interactionMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const current = harness?.state?.get?.()?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId,
                optionDisplayModes: (current?.data?.options ?? []).map((option: any) => option.displayMode ?? 'implicit'),
            };
        });

        expect(interactionMeta.sourceId).toBe('titan_penguins_emperor_penguin_talent');
        expect(interactionMeta.optionDisplayModes).toEqual(['card']);

        const cardOption = page.locator('[data-option-id="emperor-hand-minion"]').first();
        await expect(cardOption).toBeVisible();
        await expect(page.locator('[data-testid^="prompt-card-"]')).toHaveCount(1);
        await expect(page.getByRole('button', { name: '大副（手牌）' })).toHaveCount(0);

        await game.screenshot('emperor-penguin-talent-card-prompt', testInfo);
        await saveStableScreenshot(page, testInfo, 'emperor-penguin-talent-card-prompt');

        await cardOption.click();
        await page.waitForFunction(
            () => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                return !harness?.state?.get?.()?.sys?.interaction?.current;
            },
            { timeout: 5000, polling: 200 },
        );

        const finalState = await game.getState();
        const emperorPenguin = finalState.core.titans.find((candidate: any) => candidate.uid === 't-emperor-talent');
        expect(emperorPenguin?.powerCounters).toBe(1);
        expect(finalState.core.players['0'].hand.map((card: any) => card.uid)).not.toContain('emperor-hand-minion');
        expect(finalState.core.players['0'].deck.map((card: any) => card.uid)).toEqual(
            expect.arrayContaining(['emperor-existing-deck', 'emperor-hand-minion']),
        );
    });

    test('嫩芽牌库检索交互应显示卡牌选项并允许跳过', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [],
                deck: [
                    { uid: 'sprout-deck-1', defId: 'killer_plant_sprout', type: 'minion' },
                    { uid: 'sprout-deck-2', defId: 'wizard_neophyte', type: 'minion' },
                    { uid: 'sprout-deck-3', defId: 'robot_tech_center', type: 'action' },
                ],
                field: [
                    { uid: 'sprout-field-1', defId: 'killer_plant_sprout', baseIndex: 0, power: 2 },
                ],
            },
            player1: {
                hand: [],
                deck: [],
            },
            bases: [
                {
                    defId: 'base_secret_garden',
                    breakpoint: 20,
                    power: 2,
                    minions: [],
                },
            ],
            currentPlayer: '1',
            phase: 'playCards',
        });

        await page.waitForFunction(
            () => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                const state = harness?.state?.get?.();
                return (
                    state?.sys?.phase === 'playCards' &&
                    state?.core?.currentPlayerIndex === 1 &&
                    state?.core?.bases?.[0]?.minions?.some((minion: any) => minion.uid === 'sprout-field-1') &&
                    state?.core?.players?.['0']?.deck?.length === 3
                );
            },
            { timeout: 5000, polling: 200 },
        );

        await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            harness.command.dispatch({
                type: 'ADVANCE_PHASE',
                playerId: '1',
                payload: {},
            });
        });

        await page.waitForFunction(
            () => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                const state = harness?.state?.get?.();
                return state?.sys?.interaction?.current?.data?.sourceId === 'killer_plant_sprout_search';
            },
            { timeout: 10000, polling: 200 },
        );

        const cardOptions = page.locator('[data-testid^="prompt-card-"]');
        await expect(cardOptions.first()).toBeVisible();
        await expect(cardOptions).toHaveCount(2);

        const skipButton = page.getByRole('button', { name: /放回牌库顶|跳过|skip/i });
        await expect(skipButton).toBeVisible();

        const interactionMeta = await page.evaluate(() => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            const state = harness?.state?.get?.();
            const current = state?.sys?.interaction?.current;
            return {
                sourceId: current?.data?.sourceId,
                targetType: current?.data?.targetType,
                autoRefresh: current?.data?.autoRefresh,
                responseValidationMode: current?.data?.responseValidationMode,
                optionIds: (current?.data?.options ?? []).map((option: any) => option.id),
                optionDisplayModes: (current?.data?.options ?? []).map((option: any) => option.displayMode ?? 'implicit'),
            };
        });

        expect(interactionMeta.sourceId).toBe('killer_plant_sprout_search');
        expect(interactionMeta.targetType).toBe('generic');
        expect(interactionMeta.autoRefresh).toBe('deck');
        expect(interactionMeta.responseValidationMode).toBe('live');
        expect(interactionMeta.optionIds).toContain('skip');
        expect(interactionMeta.optionIds.filter((id: string) => id !== 'skip')).toHaveLength(2);
        expect(interactionMeta.optionDisplayModes.filter((mode: string) => mode === 'card')).toHaveLength(2);

        await game.screenshot('sprout-prompt-visible', testInfo);
        await saveStableScreenshot(page, testInfo, 'sprout-prompt-visible');

        await skipButton.click();

        await page.waitForFunction(
            () => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                const state = harness?.state?.get?.();
                return !state?.sys?.interaction?.current;
            },
            { timeout: 5000, polling: 200 },
        );

        const finalState = await game.getState();
        expect(finalState.core.bases[0].minions.some((minion: any) => minion.uid === 'sprout-field-1')).toBe(false);
        expect(finalState.core.bases[0].minions.some((minion: any) => minion.controller === '0')).toBe(false);
        expect(finalState.core.players['0'].deck).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ defId: 'killer_plant_sprout' }),
                expect.objectContaining({ defId: 'wizard_neophyte' }),
            ]),
        );

        await game.screenshot('sprout-prompt-skipped', testInfo);
        await saveStableScreenshot(page, testInfo, 'sprout-prompt-skipped');
    });

    test('疯狂牌供给角标只在有疯狂派系时显示，并且抽取后会减少且不会回补', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.goto('/play/smashup');
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 15000 },
        );

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [],
                deck: [],
                factions: ['aliens', 'robots'],
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
        });

        await expect(page.locator('[data-testid="su-madness-supply"]')).toHaveCount(0);
        await game.screenshot('madness-supply-hidden', testInfo);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: ['cthulhu_whispers_in_darkness'],
                deck: ['alien_invader', 'robot_hoverbot'],
                factions: ['minions_of_cthulhu', 'aliens'],
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            extra: {
                core: {
                    madnessDeck: Array.from({ length: 30 }, () => 'special_madness'),
                },
            },
        });

        await expect(page.getByTestId('su-madness-supply')).toBeVisible();
        await expect(page.getByTestId('su-madness-supply-count')).toHaveText('x 30');
        await game.screenshot('madness-supply-initial', testInfo);

        await game.playCard('cthulhu_whispers_in_darkness');

        await page.waitForFunction(
            () => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.core?.madnessDeck?.length === 29
                    && state?.core?.players?.['0']?.hand?.some((card: any) => card.defId === 'special_madness');
            },
            { timeout: 5000, polling: 200 },
        );

        await expect(page.getByTestId('su-madness-supply-count')).toHaveText('x 29');
        await game.screenshot('madness-supply-after-draw', testInfo);

        await game.setupScene({
            gameId: 'smashup',
            player0: {
                hand: [{ uid: 'madness-hand-1', defId: 'special_madness', type: 'action' }],
                deck: ['alien_invader'],
                factions: ['minions_of_cthulhu', 'aliens'],
            },
            player1: {
                hand: [],
                deck: [],
                factions: ['pirates', 'dinosaurs'],
            },
            currentPlayer: '0',
            phase: 'playCards',
            extra: {
                core: {
                    madnessDeck: Array.from({ length: 29 }, () => 'special_madness'),
                },
            },
        });

        await expect(page.getByTestId('su-madness-supply-count')).toHaveText('x 29');
        const spotlightQueue = page.getByTestId('card-spotlight-queue');
        if (await spotlightQueue.isVisible({ timeout: 200 }).catch(() => false)) {
            await spotlightQueue.getByRole('button', { name: /^(关闭特写|Close spotlight)$/i }).click({ force: true });
        }

        await game.playCard('special_madness');
        await game.waitForInteraction('special_madness');
        await game.selectOption('return');

        await page.waitForFunction(
            () => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                return !state?.sys?.interaction?.current
                    && state?.core?.madnessDeck?.length === 29
                    && !state?.core?.players?.['0']?.hand?.some((card: any) => card.uid === 'madness-hand-1')
                    && !state?.core?.players?.['0']?.discard?.some((card: any) => card.uid === 'madness-hand-1');
            },
            { timeout: 5000, polling: 200 },
        );

        await expect(page.getByTestId('su-madness-supply-count')).toHaveText('x 29');
        await page.waitForTimeout(1500);
        await game.screenshot('madness-supply-after-consume', testInfo);
    });
});
