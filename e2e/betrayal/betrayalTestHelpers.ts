import { mkdirSync } from 'fs';
import { dirname } from 'path';
import type { BrowserContext, Page } from '@playwright/test';
import {
    type BetrayalCommand,
    type BetrayalCommandMap,
    type BetrayalCore,
    createBetrayalMonsterEncounterCore,
} from '../../src/games/betrayal/game';
import {
    createCorpseLootReadyCore,
    createFirstScenarioHauntCore,
    createJackSpiritReviveReadyCore,
    createJackSpiritPostReviveAttackReadyCore,
    createFirstScenarioReadyToLearnAboutJackCore,
    createFirstScenarioReadyToStudyExorcismCore,
    createFirstScenarioReadyToExorciseCore,
    createFirstScenarioReadyToTraitorVictoryCore,
    createHeroAttackTraitorReadyCore,
    createStartedFirstScenarioCore,
    createTradeReadyCore,
    playFirstScenarioToSurvivorVictory,
} from '../../src/games/betrayal/testing/firstScenarioTestUtils';
import type { Command, MatchState } from '../../src/engine/types';
import {
    disableAudio,
    disableTutorial,
    setChineseLocale,
    waitForTestHarness,
} from '../helpers/common';

type BetrayalHarnessSnapshot = {
    core: BetrayalCore;
    sys?: MatchState<BetrayalCore>['sys'];
};

type BetrayalHarnessWindow = Window & {
    __E2E_TEST_MODE__?: boolean;
    __BG_TEST_HARNESS__?: {
        state?: {
            get?: () => BetrayalHarnessSnapshot;
            set?: (state: BetrayalHarnessSnapshot) => Promise<void> | void;
        };
    };
};

export const initBetrayalContext = async (
    context: BrowserContext,
    options?: { skipTutorial?: boolean },
) => {
    await setChineseLocale(context);
    if (options?.skipTutorial !== false) {
        await disableTutorial(context);
    }
    await disableAudio(context);
    await context.addInitScript(() => {
        (window as BetrayalHarnessWindow).__E2E_TEST_MODE__ = true;
    });
};

export const waitForBetrayalHarnessState = async (page: Page, timeout = 30000) => {
    await page.waitForFunction(
        () => Boolean((window as BetrayalHarnessWindow).__BG_TEST_HARNESS__?.state?.isRegistered?.()),
        { timeout },
    );
};

export const waitForBetrayalHarnessCommand = async (page: Page, timeout = 30000) => {
    await page.waitForFunction(
        () => Boolean((window as BetrayalHarnessWindow).__BG_TEST_HARNESS__?.command?.isRegistered?.()),
        { timeout },
    );
};

const readBetrayalPageDiagnostics = async (page: Page) => {
    return page.evaluate(() => {
        const harness = (window as BetrayalHarnessWindow).__BG_TEST_HARNESS__;
        const rescueGate = document.querySelector('[data-testid="game-page-rescue-gate"]');
        const viewport = document.querySelector('.game-page-viewport');
        const shell = document.querySelector('.mobile-board-shell');
        const content = document.querySelector('.mobile-board-shell__content');
        const loadingScreen = document.querySelector('[data-testid="loading-screen"]');
        const viteOverlay = document.querySelector('vite-error-overlay');
        const rect = (element: Element | null) => {
            if (!element) return null;
            const box = element.getBoundingClientRect();
            return `${Math.round(box.width)}x${Math.round(box.height)}`;
        };

        return {
            href: window.location.href,
            testMode: Boolean((window as BetrayalHarnessWindow).__E2E_TEST_MODE__),
            hasHarness: Boolean(harness),
            harnessStatus: typeof harness?.getStatus === 'function' ? harness.getStatus() : null,
            hasRescueGate: Boolean(rescueGate),
            rescueText: rescueGate?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 500) ?? null,
            viewport: rect(viewport),
            shell: rect(shell),
            content: rect(content),
            hasLoadingScreen: Boolean(loadingScreen),
            hasViteOverlay: Boolean(viteOverlay),
            bodyText: document.body.textContent?.replace(/\s+/g, ' ').trim().slice(0, 700) ?? '',
        };
    }).catch((error) => ({
        diagnosticError: error instanceof Error ? error.message : String(error),
    }));
};

export const waitForBetrayalPageReady = async (page: Page, attempts = 4) => {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            await waitForTestHarness(page, 8000);
            await waitForBetrayalHarnessState(page, 8000);
            return;
        } catch (error) {
            lastError = error;
            const diagnostics = await readBetrayalPageDiagnostics(page);
            const rescueReloadButton = page.getByRole('button', { name: /刷新重试/i });
            const rescueGate = page.getByTestId('game-page-rescue-gate');
            const rescueTitle = page.getByText('页面没有正常显示');
            const shouldReloadRescueGate = await rescueGate.isVisible({ timeout: 800 }).catch(() => false)
                || await rescueTitle.isVisible({ timeout: 800 }).catch(() => false);

            if (attempt === attempts - 1) {
                const detail = JSON.stringify(diagnostics, null, 2);
                throw new Error(`betrayal 页面未能进入 harness。最后错误：${error instanceof Error ? error.message : String(error)}\n诊断：${detail}`);
            }

            if (shouldReloadRescueGate) {
                await rescueReloadButton.click().catch(() => page.reload({ waitUntil: 'domcontentloaded' }));
            } else {
                await page.reload({ waitUntil: 'domcontentloaded' });
            }
            await page.waitForTimeout(1200);
        }
    }

    throw lastError instanceof Error ? lastError : new Error('betrayal 页面未能稳定进入 harness');
};

export const warmBetrayalFrontend = async (context: BrowserContext, timeout = 45000) => {
    const warmupPage = await context.newPage();
    try {
        await warmupPage.goto('/play/betrayal', {
            waitUntil: 'commit',
            timeout,
        });
        await warmupPage.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => undefined);
        await waitForBetrayalPageReady(warmupPage);
    } finally {
        await warmupPage.close();
    }
};

export const saveScreenshot = async (page: Page, path: string) => {
    mkdirSync(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: false });
};

function command<Type extends keyof BetrayalCommandMap>(
    type: Type,
    playerId: string,
    payload: BetrayalCommandMap[Type],
): BetrayalCommand {
    return {
        type,
        playerId,
        payload,
        timestamp: 100,
    } as Command<Type & string, BetrayalCommandMap[Type]> as BetrayalCommand;
}

export function createRuntimeCore(): BetrayalCore {
    return createStartedFirstScenarioCore(['0', '1', '2']);
}

export function createFirstScenarioHauntRuntimeCore(): BetrayalCore {
    return createFirstScenarioHauntCore();
}

export function createMonsterEncounterCore(): BetrayalCore {
    return createBetrayalMonsterEncounterCore(['0', '1', '2']);
}

export function createFirstScenarioSurvivorEndgameCore(): BetrayalCore {
    return playFirstScenarioToSurvivorVictory();
}

export function createFirstScenarioReadyToExorciseRuntimeCore(): BetrayalCore {
    return createFirstScenarioReadyToExorciseCore();
}

export function createFirstScenarioReadyToLearnAboutJackRuntimeCore(): BetrayalCore {
    return createFirstScenarioReadyToLearnAboutJackCore();
}

export function createFirstScenarioReadyToStudyExorcismRuntimeCore(): BetrayalCore {
    return createFirstScenarioReadyToStudyExorcismCore();
}

export function createTradeReadyRuntimeCore(): BetrayalCore {
    return createTradeReadyCore();
}

export function createHeroAttackTraitorReadyRuntimeCore(): BetrayalCore {
    return createHeroAttackTraitorReadyCore();
}

export function createFirstScenarioReadyToTraitorVictoryRuntimeCore(): BetrayalCore {
    return createFirstScenarioReadyToTraitorVictoryCore();
}

export function createCorpseLootReadyRuntimeCore(): BetrayalCore {
    return createCorpseLootReadyCore();
}

export function createJackSpiritReviveReadyRuntimeCore(): BetrayalCore {
    return createJackSpiritReviveReadyCore();
}

export function createJackSpiritPostReviveAttackReadyRuntimeCore(): BetrayalCore {
    return createJackSpiritPostReviveAttackReadyCore();
}

export const injectCore = async (page: Page, core: BetrayalCore) => {
    await page.evaluate((nextCore) => {
        const harness = (window as BetrayalHarnessWindow).__BG_TEST_HARNESS__;
        const state = harness?.state;
        const snapshot = state?.get?.();
        if (!snapshot || !state?.set) {
            throw new Error('betrayal test harness state injector unavailable');
        }
        return state.set({ ...snapshot, core: nextCore });
    }, core);
};

export const dispatchHarnessCommand = async <Type extends keyof BetrayalCommandMap>(
    page: Page,
    type: Type,
    playerId: string,
    payload: BetrayalCommandMap[Type],
) => {
    await waitForBetrayalHarnessCommand(page);
    await page.evaluate(async ({ nextCommand }) => {
        const harness = (window as BetrayalHarnessWindow).__BG_TEST_HARNESS__;
        if (!harness?.command?.dispatch) {
            throw new Error('betrayal test harness command dispatcher unavailable');
        }
        await harness.command.dispatch(nextCommand);
    }, {
        nextCommand: command(type, playerId, payload),
    });
};

export const setHarnessRandomQueue = async (page: Page, values: number[]) => {
    await page.evaluate((queueValues) => {
        const harness = (window as BetrayalHarnessWindow).__BG_TEST_HARNESS__;
        if (!harness?.random?.setQueue) {
            throw new Error('betrayal test harness random queue unavailable');
        }
        harness.random.setQueue(queueValues);
    }, values);
};
