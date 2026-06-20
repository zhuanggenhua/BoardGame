import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import {
    BETRAYAL_COMMANDS,
    BetrayalDomain,
    type BetrayalCommand,
    type BetrayalCommandMap,
    type BetrayalCore,
} from '../src/games/betrayal/game';
import type { Command, MatchState, RandomFn } from '../src/engine/types';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
    disableAudio,
    disableTutorial,
    setChineseLocale,
    waitForTestHarness,
} from './helpers/common';

const EVIDENCE_DIR = 'evidence/betrayal-first-scenario';
const CHARACTER_SELECT_SCREENSHOT = `${EVIDENCE_DIR}/01-山屋惊魂-角色选择-确认前.png`;
const RUNTIME_SCREENSHOT = `${EVIDENCE_DIR}/02-山屋惊魂-运行时-v4牌桌.png`;
const ENDGAME_SCREENSHOT = `${EVIDENCE_DIR}/03-山屋惊魂-终局-幸存者胜利.png`;

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

const initBetrayalContext = async (context: BrowserContext) => {
    await setChineseLocale(context);
    await disableTutorial(context);
    await disableAudio(context);
    await context.addInitScript(() => {
        (window as BetrayalHarnessWindow).__E2E_TEST_MODE__ = true;
    });
};

const saveScreenshot = async (page: Page, path: string) => {
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

function createRuntimeCore(): BetrayalCore {
    let core = BetrayalDomain.setup(['0', '1', '2'], fixedRandom);
    core = applyCommand(core, BETRAYAL_COMMANDS.SELECT_EXPLORER, '0', { explorerId: 'jaden-jones' });
    core = applyCommand(core, BETRAYAL_COMMANDS.CONFIRM_EXPLORER, '0', {});
    return applyCommand(core, BETRAYAL_COMMANDS.START_FIRST_SCENARIO, '0', {});
}

function createEndgameCore(): BetrayalCore {
    let core = createRuntimeCore();
    core = applyCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
    core = applyCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', {});
    core = applyCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
    core = applyCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
    core = applyCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', {});
    return applyCommand(core, BETRAYAL_COMMANDS.COMPLETE_FIRST_SCENARIO, '0', {});
}

const injectCore = async (page: Page, core: BetrayalCore) => {
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

test.describe('山屋惊魂首剧本真实页面截图', () => {
    test('覆盖角色选择、v4运行时和终局三阶段', async ({ page, context }) => {
        test.setTimeout(90000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-first-scenario');

        await page.setViewportSize({ width: 1600, height: 900 });
        await page.goto('/play/betrayal', { waitUntil: 'domcontentloaded' });
        await waitForTestHarness(page, 30000);

        await expect(page.getByTestId('betrayal-character-select-screen')).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-character-confirm')).toBeVisible();
        await saveScreenshot(page, CHARACTER_SELECT_SCREENSHOT);

        await injectCore(page, createRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        const roomGrid = page.getByTestId('betrayal-room-grid');
        await expect(roomGrid).toBeVisible();
        await expect(page.getByTestId('betrayal-action-explore')).toBeVisible();
        await roomGrid.evaluate((element) => {
            element.scrollLeft = 0;
            element.scrollTop = 0;
        });
        const roomGridBox = await roomGrid.boundingBox();
        expect(roomGridBox).not.toBeNull();
        const dragStartX = roomGridBox!.x + roomGridBox!.width / 2;
        const dragStartY = roomGridBox!.y + roomGridBox!.height / 2;
        await page.mouse.move(dragStartX, dragStartY);
        await page.mouse.down();
        await page.mouse.move(dragStartX, dragStartY - 220, { steps: 6 });
        await page.mouse.up();
        await expect.poll(() => roomGrid.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
        await saveScreenshot(page, RUNTIME_SCREENSHOT);

        await injectCore(page, createEndgameCore());
        await expect(page.getByTestId('betrayal-endgame-screen')).toBeVisible({ timeout: 30000 });
        await saveScreenshot(page, ENDGAME_SCREENSHOT);
        await expect(page.getByTestId('betrayal-endgame-screen').getByRole('main').getByText('幸存者逃脱', { exact: true }).first()).toBeVisible();

        assertNoFatalFrontendErrors([{ label: 'betrayal-first-scenario', diagnostics }]);
    });
});
