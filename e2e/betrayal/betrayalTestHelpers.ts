import { mkdirSync } from 'fs';
import { dirname } from 'path';
import type { BrowserContext, Page } from '@playwright/test';
import {
    BETRAYAL_COMMANDS,
    BetrayalDomain,
    type BetrayalCommand,
    type BetrayalCommandMap,
    type BetrayalCore,
    createBetrayalMonsterEncounterCore,
} from '../../src/games/betrayal/game';
import {
    createFirstScenarioHauntCore,
    createStartedFirstScenarioCore,
    playFirstScenarioToSurvivorVictory,
} from '../../src/games/betrayal/testing/firstScenarioTestUtils';
import type { Command, MatchState, RandomFn } from '../../src/engine/types';
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

const fixedRandom: RandomFn = {
    random: () => 0.42,
    d: (max) => Math.max(1, Math.min(max, 1)),
    range: (min) => min,
    shuffle: (array) => [...array],
};

export const initBetrayalContext = async (context: BrowserContext) => {
    await setChineseLocale(context);
    await disableTutorial(context);
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

export const waitForBetrayalPageReady = async (page: Page, attempts = 4) => {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            await waitForTestHarness(page, 8000);
            await waitForBetrayalHarnessState(page, 8000);
            return;
        } catch (error) {
            lastError = error;
            const rescueReloadButton = page.getByRole('button', { name: /刷新重试/i });
            const rescueGate = page.getByTestId('game-page-rescue-gate');
            const rescueTitle = page.getByText('页面没有正常显示');
            const shouldReloadRescueGate = await rescueGate.isVisible({ timeout: 800 }).catch(() => false)
                || await rescueTitle.isVisible({ timeout: 800 }).catch(() => false);

            if (attempt === attempts - 1) {
                throw error;
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
            waitUntil: 'domcontentloaded',
            timeout,
        });
        await waitForBetrayalPageReady(warmupPage);
    } finally {
        await warmupPage.close();
    }
};

export const saveScreenshot = async (page: Page, path: string) => {
    mkdirSync(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: false });
};

function stateOf(core: BetrayalCore): MatchState<BetrayalCore> {
    return { core, sys: {} as MatchState<BetrayalCore>['sys'] };
}

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

function applyCommand<Type extends keyof BetrayalCommandMap>(
    core: BetrayalCore,
    type: Type,
    playerId: string,
    payload: BetrayalCommandMap[Type],
): BetrayalCore {
    const nextCommand = command(type, playerId, payload);
    const validation = BetrayalDomain.validate(stateOf(core), nextCommand);
    if (!validation.valid) {
        throw new Error(validation.error ?? `invalid betrayal command: ${String(type)}`);
    }
    return BetrayalDomain.execute(stateOf(core), nextCommand, fixedRandom)
        .reduce((nextCore, event) => BetrayalDomain.reduce(nextCore, event), core);
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
