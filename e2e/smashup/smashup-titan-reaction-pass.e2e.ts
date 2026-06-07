import type { Page } from '@playwright/test';
import { queueInteraction } from '../../src/engine/systems/InteractionSystem.ts';
import { initAllAbilities } from '../../src/games/smashup/abilities/index.ts';
import { createAbilityRuntimeSimpleChoice } from '../../src/games/smashup/domain/abilityRuntime.ts';
import { collectTriggers } from '../../src/games/smashup/domain/ongoingEffects.ts';
import { startSmashUpReactionSession } from '../../src/games/smashup/domain/reactionSession.ts';
import {
    createScoringBaseRef,
    createScoringSession,
    setScoringSession,
} from '../../src/games/smashup/domain/scoringSession.ts';
import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';

const FIXED_SMASHUP_RANDOM = {
    random: () => 0.5,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};
let smashUpModuleWarmed = false;

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

async function setHarnessState(page: Page, nextState: any): Promise<void> {
    await page.evaluate(async (state) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        if (!harness?.state?.set) {
            throw new Error('TestHarness state.set 不可用');
        }
        await harness.state.set(state);
    }, nextState);
    await page.waitForTimeout(500);
}

async function openLocalSmashUp(page: Page): Promise<void> {
    await page.goto('/play/smashup?skipInitialization=true', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(
        () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
        { timeout: 60000, polling: 200 },
    );
    await page.waitForTimeout(300);
}

async function warmSmashUpModule(browser: any, workerPorts: { frontend: number; gameServer: number; apiServer: number }): Promise<void> {
    if (smashUpModuleWarmed) {
        return;
    }

    const context = await browser.newContext();
    await context.addInitScript(() => {
        (window as any).__E2E_TEST_MODE__ = true;
    });
    await context.addInitScript((ports) => {
        (window as any).__E2E_WORKER_PORTS__ = ports;
        (window as any).__FORCE_GAME_SERVER_URL__ = `http://127.0.0.1:${ports.gameServer}`;
        (window as any).__FORCE_API_SERVER_URL__ = `http://127.0.0.1:${ports.apiServer}`;
        (window as any).__E2E_SKIP_IMAGE_GATE__ = true;
    }, workerPorts);

    const page = await context.newPage();
    try {
        await page.goto(`http://127.0.0.1:${workerPorts.frontend}/play/smashup?skipInitialization=true`, {
            waitUntil: 'domcontentloaded',
            timeout: 300000,
        });
        await page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
            { timeout: 300000, polling: 200 },
        );
        smashUpModuleWarmed = true;
    } finally {
        await context.close().catch(() => undefined);
    }
}

async function readHarnessState(page: Page): Promise<any> {
    return page.evaluate(() => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        return harness?.state?.get?.() ?? null;
    });
}

async function waitForInteractionSourceId(
    page: Page,
    sourceId: string,
    timeout = 8000,
): Promise<void> {
    await expect.poll(async () => {
        const state = await readHarnessState(page);
        return state?.sys?.interaction?.current?.data?.sourceId ?? null;
    }, { timeout }).toBe(sourceId);
}

async function waitForSelectableMinion(page: Page, minionUid: string, timeout = 8000): Promise<void> {
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

function createMushroomOwnBrideTurnStartState(baseState: any) {
    return {
        ...baseState,
        core: {
            ...baseState.core,
            players: {
                ...(baseState.core?.players ?? {}),
                '0': {
                    ...(baseState.core?.players?.['0'] ?? {}),
                    id: '0',
                    vp: 0,
                    hand: [makeInjectedCard('own-bride-hand-minion', 'frankenstein_igor', 'minion', '0')],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['frankenstein', 'aliens'],
                    sameNameMinionDefId: null,
                },
                '1': {
                    ...(baseState.core?.players?.['1'] ?? {}),
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['pirates', 'wizards'],
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
                    minions: [makeInjectedMinion('enemy-own-bride-target', 'pirate_buccaneer', '1', '1', 4)],
                    ongoingActions: [],
                },
                {
                    defId: 'base_great_library',
                    minions: [{
                        ...makeInjectedMinion('own-bride-counter-target', 'frankenstein_lab_assistant', '0', '0', 2),
                        powerCounters: 1,
                    }],
                    ongoingActions: [],
                },
            ],
            titans: [{
                uid: 'own-bride-titan',
                defId: 'frankenstein_the_bride',
                faction: 'frankenstein',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            }],
            enabledExpansions: ['titans'],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 10,
            nextUid: 903,
            cardsPlayedThisTurn: 0,
            powerCountersPlacedOnMinionsThisTurn: 0,
            turnDestroyedMinions: [],
            triggerQueue: [],
        },
        sys: {
            ...baseState.sys,
            phase: 'playCards',
            currentPlayerIndex: 1,
            flowHalted: false,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
            resolution: undefined,
            smashupReactionSession: undefined,
            smashupReactionStack: undefined,
            scoredBaseIndices: undefined,
            smashupScoring: undefined,
            _smashupStartTurnWindowActive: undefined,
            _waitForStartTurnInteractionReduce: undefined,
            _waitForScoreBasesInteractionReduce: undefined,
            _waitForPostScoringReduce: undefined,
        },
    };
}

function createKrakenReactionChooseState(baseState: any) {
    initAllAbilities();

    const core = {
        ...(baseState?.core ?? {}),
        players: {
            ...(baseState?.core?.players ?? {}),
            '0': {
                ...(baseState?.core?.players?.['0'] ?? {}),
                id: '0',
                vp: 0,
                hand: [],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                factions: ['pirates', 'aliens'],
                sameNameMinionDefId: null,
            },
            '1': {
                ...(baseState?.core?.players?.['1'] ?? {}),
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
        bases: [
            {
                defId: 'base_the_homeworld',
                minions: [makeInjectedMinion('pirate-on-score', 'pirate_first_mate', '0', '0', 2)],
                ongoingActions: [],
            },
            { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
        ],
        titans: [{
            uid: 't-kraken-setaside',
            defId: 'pirates_the_kraken',
            faction: 'pirates',
            ownerId: '0',
            controllerId: '0',
            powerCounters: 0,
            talentUsed: false,
            location: { zone: 'setaside' },
        }],
        enabledExpansions: ['titans'],
        baseDeck: [],
        baseDiscard: [],
        turnNumber: 7,
        nextUid: 700,
        cardsPlayedThisTurn: 0,
        powerCountersPlacedOnMinionsThisTurn: 0,
        turnDestroyedMinions: [],
        triggerQueue: [],
    };

    const frameId = 'kraken-after-scoring-frame';
    let state = {
        ...baseState,
        core,
        sys: {
            ...baseState.sys,
            phase: 'scoreBases',
            currentPlayerIndex: 0,
            flowHalted: false,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
            scoredBaseIndices: undefined,
            smashupScoring: undefined,
            smashupReactionSession: undefined,
            smashupReactionStack: undefined,
            _waitForPostScoringReduce: undefined,
            _waitForScoreBasesInteractionReduce: undefined,
            resolution: undefined,
        },
    };

    const queued = collectTriggers(core, 'afterScoring', {
        state: core,
        matchState: state,
        playerId: '0',
        baseIndex: 0,
        rankings: [{ playerId: '0', power: 10, vp: 3 }],
        frameId,
        sourceEventId: frameId,
        random: FIXED_SMASHUP_RANDOM,
        now: 75,
    });
    if (!queued) {
        throw new Error('无法构造海怪克拉肯 afterScoring trigger');
    }

    const krakenTrigger = queued.payload.triggers.find((entry) => entry?.sourceDefId === 'pirates_the_kraken');
    if (!krakenTrigger) {
        throw new Error('无法找到海怪克拉肯 trigger');
    }
    const optionalKrakenTrigger = {
        ...krakenTrigger,
        mandatory: false,
        resolutionClass: 'optional' as const,
    };

    state = {
        ...state,
        core: {
            ...core,
            triggerQueue: [optionalKrakenTrigger],
        },
        sys: {
            ...state.sys,
            interaction: { current: undefined, queue: [] },
        },
    };

    const baseRef = createScoringBaseRef(state.core, 0);
    if (!baseRef) {
        throw new Error('无法构造海怪克拉肯计分基地引用');
    }

    state = setScoringSession(state, {
        ...createScoringSession(state.core, [0]),
        currentBaseRef: baseRef,
        currentStep: 'awaiting-response-window',
    });
    state = startSmashUpReactionSession(state, {
        frameId,
        frameKind: 'score-after',
        phase: 'optional',
        currentPlayerId: '0',
        activePlayerId: '0',
        consecutivePasses: 0,
        sourceBaseIndex: 0,
        responseWindowType: 'afterScoring',
    });

    const interaction = createAbilityRuntimeSimpleChoice(
        'kraken-reaction-pass-window',
        '0',
        'ui.reaction_choose_optional_title',
        [
            {
                id: `trigger:${optionalKrakenTrigger.id}`,
                label: '海怪克拉肯',
                value: { kind: 'trigger', triggerId: optionalKrakenTrigger.id },
                displayMode: 'button',
            },
            {
                id: 'pass',
                label: '让过',
                value: { kind: 'pass' },
                displayMode: 'button',
            },
        ],
        {
            sourceId: 'smashup_reaction_choose',
            targetType: 'button',
            responseValidationMode: 'live',
            autoResolveIfSingle: false,
        },
    );

    return queueInteraction(state, interaction);
}

test.describe('泰坦高亮反应让过收口', () => {
    test.beforeEach(async ({ page: _page }, testInfo) => {
        await clearEvidenceScreenshotsForTest(testInfo);
    });

    test('科学怪人自己的新娘高亮反应点击让过后，应立即收口且不重开', async ({ browser, workerPorts, page }, testInfo) => {
        test.setTimeout(180000);
        await warmSmashUpModule(browser, workerPorts);
        await openLocalSmashUp(page);
        const baseState = await readHarnessState(page);
        await setHarnessState(page, createMushroomOwnBrideTurnStartState(baseState));

        await expect(page.getByTestId('base-zone-0')).toBeVisible({ timeout: 8000 });
        await page.getByTestId('su-end-turn-action-button').click();

        await waitForInteractionSourceId(page, 'base_mushroom_kingdom');
        await waitForSelectableMinion(page, 'enemy-own-bride-target');

        const mushroomPromptShot = getEvidenceScreenshotPath(testInfo, 'mushroom-own-bride-target-prompt', {
            filename: 'smashup-mushroom-own-bride-target-prompt.png',
        });
        await page.screenshot({ path: mushroomPromptShot, fullPage: false });

        await page.locator('[data-minion-uid="enemy-own-bride-target"]').click({ force: true });

        await waitForInteractionSourceId(page, 'smashup_reaction_choose');
        await expect(page.getByTestId('su-rail-titan-own-bride-titan')).toBeVisible({ timeout: 8000 });
        const passButton = page.getByTestId('su-titan-reaction-pass-button');
        await expect(passButton).toBeVisible({ timeout: 8000 });

        await expect.poll(async () => {
            const state = await readHarnessState(page);
            const options = Array.isArray(state?.sys?.interaction?.current?.data?.options)
                ? state.sys.interaction.current.data.options
                : [];
            return {
                sourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
                optionIds: options.map((option: { id?: string }) => option?.id ?? null),
                brideStillQueued: Array.isArray(state?.core?.triggerQueue)
                    ? state.core.triggerQueue.some((trigger: any) => trigger?.sourceDefId === 'frankenstein_the_bride')
                    : false,
            };
        }, { timeout: 8000 }).toEqual({
            sourceId: 'smashup_reaction_choose',
            optionIds: expect.arrayContaining(['pass']),
            brideStillQueued: true,
        });

        const bridePassShot = getEvidenceScreenshotPath(testInfo, 'mushroom-own-bride-pass-window', {
            filename: 'smashup-mushroom-own-bride-pass-window.png',
        });
        await page.screenshot({ path: bridePassShot, fullPage: false });

        await passButton.click();

        await expect.poll(async () => {
            const state = await readHarnessState(page);
            return {
                sourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowOpen: Boolean(state?.sys?.responseWindow?.current),
                brideStillQueued: Array.isArray(state?.core?.triggerQueue)
                    ? state.core.triggerQueue.some((trigger: any) => trigger?.sourceDefId === 'frankenstein_the_bride')
                    : false,
                canContinuePastScoring: state?.sys?.phase !== 'scoreBases',
            };
        }, { timeout: 8000 }).toEqual({
            sourceId: null,
            responseWindowOpen: false,
            brideStillQueued: false,
            canContinuePastScoring: true,
        });

        await page.waitForTimeout(1200);
        const settledState = await readHarnessState(page);
        expect(settledState?.sys?.interaction?.current?.data?.sourceId ?? null).toBeNull();
        expect(Boolean(settledState?.sys?.responseWindow?.current)).toBe(false);
        expect(Array.isArray(settledState?.core?.triggerQueue)
            ? settledState.core.triggerQueue.some((trigger: any) => trigger?.sourceDefId === 'frankenstein_the_bride')
            : false).toBe(false);
        expect(settledState?.sys?.phase).not.toBe('scoreBases');

        const brideResolvedShot = getEvidenceScreenshotPath(testInfo, 'mushroom-own-bride-pass-resolved', {
            filename: 'smashup-mushroom-own-bride-pass-resolved.png',
        });
        await page.screenshot({ path: brideResolvedShot, fullPage: false });
    });

    test('海怪克拉肯高亮反应点击让过后，应立即收口且不重开', async ({ browser, workerPorts, page }, testInfo) => {
        test.setTimeout(180000);
        await warmSmashUpModule(browser, workerPorts);
        await openLocalSmashUp(page);
        const baseState = await readHarnessState(page);
        await setHarnessState(page, createKrakenReactionChooseState(baseState));

        await expect(page.getByTestId('base-zone-0')).toBeVisible({ timeout: 8000 });
        await expect(page.getByTestId('su-rail-titan-t-kraken-setaside')).toBeVisible({ timeout: 8000 });
        const passButton = page.getByTestId('su-titan-reaction-pass-button');
        await expect(passButton).toBeVisible({ timeout: 8000 });

        await expect.poll(async () => {
            const state = await readHarnessState(page);
            const options = Array.isArray(state?.sys?.interaction?.current?.data?.options)
                ? state.sys.interaction.current.data.options
                : [];
            return {
                sourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
                optionIds: options.map((option: { id?: string }) => option?.id ?? null),
                krakenStillQueued: Array.isArray(state?.core?.triggerQueue)
                    ? state.core.triggerQueue.some((trigger: any) => trigger?.sourceDefId === 'pirates_the_kraken')
                    : false,
            };
        }, { timeout: 8000 }).toEqual({
            sourceId: 'smashup_reaction_choose',
            optionIds: expect.arrayContaining([
                'pass',
                expect.stringMatching(/^trigger:afterScoring:pirates_the_kraken:/),
            ]),
            krakenStillQueued: true,
        });

        const krakenPassShot = getEvidenceScreenshotPath(testInfo, 'kraken-reaction-pass-window', {
            filename: 'smashup-kraken-reaction-pass-window.png',
        });
        await page.screenshot({ path: krakenPassShot, fullPage: false });

        await passButton.click();

        await expect.poll(async () => {
            const state = await readHarnessState(page);
            return {
                sourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowOpen: Boolean(state?.sys?.responseWindow?.current),
                krakenStillQueued: Array.isArray(state?.core?.triggerQueue)
                    ? state.core.triggerQueue.some((trigger: any) => trigger?.sourceDefId === 'pirates_the_kraken')
                    : false,
                phase: state?.sys?.phase ?? null,
            };
        }, { timeout: 8000 }).toEqual({
            sourceId: null,
            responseWindowOpen: false,
            krakenStillQueued: false,
            phase: 'scoreBases',
        });

        await page.waitForTimeout(1200);
        const settledState = await readHarnessState(page);
        expect(settledState?.sys?.interaction?.current?.data?.sourceId ?? null).toBeNull();
        expect(Boolean(settledState?.sys?.responseWindow?.current)).toBe(false);
        expect(Array.isArray(settledState?.core?.triggerQueue)
            ? settledState.core.triggerQueue.some((trigger: any) => trigger?.sourceDefId === 'pirates_the_kraken')
            : false).toBe(false);

        const krakenResolvedShot = getEvidenceScreenshotPath(testInfo, 'kraken-reaction-pass-resolved', {
            filename: 'smashup-kraken-reaction-pass-resolved.png',
        });
        await page.screenshot({ path: krakenResolvedShot, fullPage: false });
    });
});
