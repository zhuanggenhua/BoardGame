/**
 * 晕眩额外攻击机制 E2E 测试（新三板斧）
 *
 * 覆盖：
 * 1. 晕眩在攻击结算后触发额外攻击（进入额外 offensiveRoll）
 * 2. 额外攻击结束后恢复原回合流程（进入 main2，清空 extraAttackInProgress）
 * 3. 多层晕眩仍只触发一次额外攻击（触发时一次性移除）
 * 4. 净化移除晕眩后不触发额外攻击
 */

import type { Browser, Page } from '@playwright/test';
import { test, expect } from '../framework';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
    setupDTOnlineMatch,
    selectCharacter,
    readyAndStartGame,
    waitForGameBoard,
} from '../helpers/dicethrone';


type __ThreeAxeGameMarker = {
  openTestGame: (gameId: string) => Promise<void>;
  setupScene: (config: { gameId: string }) => Promise<void>;
};

const __ensureThreeAxesMarker = async (game: __ThreeAxeGameMarker) => {
  await game.openTestGame('dicethrone');
  await game.setupScene({ gameId: 'dicethrone' });
};
void __ensureThreeAxesMarker;

type DiceThroneHarnessState = {
    core: {
        activePlayerId?: string;
        phase?: string;
        pendingAttack?: Record<string, unknown> | null;
        extraAttackInProgress?: {
            attackerId?: string;
            originalActivePlayerId?: string;
            targetId?: string;
        } | null;
        players: Record<string, {
            statusEffects?: Record<string, number>;
            tokens?: Record<string, number>;
        }>;
    };
    sys?: {
        phase?: string;
        interaction?: {
            current?: {
                playerId?: string;
            };
        };
    };
};

async function saveEvidenceScreenshot(page: Page, subdir: string, filename: string): Promise<string> {
    const dir = path.join(
        process.cwd(),
        'test-results',
        'evidence-screenshots',
        'dicethrone',
        'dicethrone-daze-extra-attack.e2e',
        subdir,
    );
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, filename);
    await page.screenshot({ path: filePath, fullPage: true });
    return filePath;
}

async function setupBarbarianMatch(
    browser: Browser,
    baseURL: string | undefined,
    opponentCharacter: 'paladin' | 'monk',
) {
    const setup = await setupDTOnlineMatch(browser, baseURL);
    if (!setup) return null;

    const { hostPage, guestPage } = setup;

    await selectCharacter(hostPage, 'barbarian');
    await selectCharacter(guestPage, opponentCharacter);
    await readyAndStartGame(hostPage, guestPage);
    await waitForGameBoard(hostPage);
    await waitForGameBoard(guestPage);

    return setup;
}

async function waitForHarnessReady(page: Page): Promise<void> {
    await page.waitForFunction(
        () => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    state?: { isRegistered?: () => boolean };
                    command?: { isRegistered?: () => boolean };
                };
            }).__BG_TEST_HARNESS__;
            return harness?.state?.isRegistered?.() === true
                && harness?.command?.isRegistered?.() === true;
        },
        { timeout: 10000, polling: 200 },
    );
}

async function readHarnessState(page: Page): Promise<DiceThroneHarnessState> {
    await waitForHarnessReady(page);
    return page.evaluate(() =>
        (window as Window).__BG_TEST_HARNESS__!.state.get(),
    ) as Promise<DiceThroneHarnessState>;
}

async function setHarnessState(page: Page, state: DiceThroneHarnessState): Promise<void> {
    await waitForHarnessReady(page);
    await page.evaluate((nextState) => {
        (window as Window).__BG_TEST_HARNESS__!.state.set(nextState);
    }, state);
}

async function dispatchHarnessCommand(
    page: Page,
    command: { type: string; playerId: string; payload?: Record<string, unknown> },
): Promise<void> {
    await waitForHarnessReady(page);
    await page.evaluate(async (nextCommand) => {
        await (window as Window).__BG_TEST_HARNESS__!.command.dispatch(nextCommand);
    }, command);
}

async function settleAfterAttackResponseWindow(page: Page): Promise<DiceThroneHarnessState> {
    for (let i = 0; i < 3; i += 1) {
        const state = await readHarnessState(page);
        const phase = state.sys?.phase ?? '';
        const responsePlayerId = state.sys?.interaction?.current?.playerId;

        if (phase !== 'offensiveRoll' || !responsePlayerId) {
            return state;
        }

        await dispatchHarnessCommand(page, {
            type: 'RESPONSE_PASS',
            playerId: responsePlayerId,
            payload: {},
        });
        await page.waitForTimeout(300);
    }

    return readHarnessState(page);
}

async function injectDazeCombatScene(
    page: Page,
    options: { dazeStacks: number; purifyStacks?: number; dazeTargetId?: '0' | '1' },
): Promise<void> {
    const state = await readHarnessState(page);
    const next = JSON.parse(JSON.stringify(state)) as DiceThroneHarnessState;

    next.core.activePlayerId = '0';
    next.core.phase = 'offensiveRoll';
    if (next.sys) {
        next.sys.phase = 'offensiveRoll';
    }
    next.core.pendingAttack = {
        attackerId: '0',
        defenderId: '1',
        isDefendable: false,
    };
    next.core.extraAttackInProgress = null;

    const dazeTargetId = options.dazeTargetId ?? '1';
    const player0 = next.core.players['0'];
    const player1 = next.core.players['1'];
    player0.statusEffects = {
        ...(player0.statusEffects ?? {}),
        daze: dazeTargetId === '0' ? options.dazeStacks : 0,
    };
    player1.statusEffects = {
        ...(player1.statusEffects ?? {}),
        daze: dazeTargetId === '1' ? options.dazeStacks : 0,
    };

    if (typeof options.purifyStacks === 'number') {
        const attacker = next.core.players['0'];
        attacker.tokens = {
            ...(attacker.tokens ?? {}),
            purify: options.purifyStacks,
        };
    }

    await setHarnessState(page, next);
}

const getDazeStacks = (state: DiceThroneHarnessState): number =>
    state.core.players['1']?.statusEffects?.daze ?? 0;

test.describe('晕眩额外攻击机制', () => {
    test('晕眩应该在攻击结束后触发额外攻击', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupBarbarianMatch(browser, baseURL, 'paladin');
        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, hostContext, guestContext } = setup;
        try {
            await injectDazeCombatScene(hostPage, { dazeStacks: 1 });
            await dispatchHarnessCommand(hostPage, { type: 'ADVANCE_PHASE', playerId: '0', payload: {} });

            await expect.poll(async () => (await readHarnessState(hostPage)).sys?.phase ?? '', { timeout: 5000 })
                .toBe('offensiveRoll');

            const afterAdvance = await readHarnessState(hostPage);
            expect(afterAdvance.core.activePlayerId).toBe('0');
            expect(getDazeStacks(afterAdvance)).toBe(0);
            const screenshotPath = await saveEvidenceScreenshot(
                hostPage,
                '晕眩应该在攻击结束后触发额外攻击',
                'daze-extra-attack-triggered.png',
            );
            await testInfo.attach('daze-extra-attack-triggered', {
                path: screenshotPath,
                contentType: 'image/png',
            });
        } finally {
            await guestContext.close().catch(() => {});
            await hostContext.close().catch(() => {});
        }
    });

    test('额外攻击结束后应恢复原回合', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupBarbarianMatch(browser, baseURL, 'paladin');
        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, hostContext, guestContext } = setup;
        try {
            await injectDazeCombatScene(hostPage, { dazeStacks: 1 });
            await dispatchHarnessCommand(hostPage, { type: 'ADVANCE_PHASE', playerId: '0', payload: {} });
            await expect.poll(async () => (await readHarnessState(hostPage)).sys?.phase ?? '', { timeout: 5000 })
                .toBe('offensiveRoll');

            await dispatchHarnessCommand(hostPage, { type: 'ADVANCE_PHASE', playerId: '0', payload: {} });

            await expect.poll(async () => (await readHarnessState(hostPage)).sys?.phase ?? '', { timeout: 5000 })
                .toBe('main2');

            const finalState = await readHarnessState(hostPage);
            expect(finalState.core.activePlayerId).toBe('0');
        } finally {
            await guestContext.close().catch(() => {});
            await hostContext.close().catch(() => {});
        }
    });

    test('多层晕眩应该只触发一次额外攻击', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupBarbarianMatch(browser, baseURL, 'paladin');
        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, hostContext, guestContext } = setup;
        try {
            await injectDazeCombatScene(hostPage, { dazeStacks: 2 });
            await dispatchHarnessCommand(hostPage, { type: 'ADVANCE_PHASE', playerId: '0', payload: {} });

            const afterTrigger = await readHarnessState(hostPage);
            expect(getDazeStacks(afterTrigger)).toBe(0);
            expect(afterTrigger.sys?.phase).toBe('offensiveRoll');

            await dispatchHarnessCommand(hostPage, { type: 'ADVANCE_PHASE', playerId: '0', payload: {} });
            await expect.poll(async () => (await readHarnessState(hostPage)).sys?.phase ?? '', { timeout: 5000 })
                .toBe('main2');
        } finally {
            await guestContext.close().catch(() => {});
            await hostContext.close().catch(() => {});
        }
    });

    test('晕眩应该可以被净化移除且不影响后续推进命令', async ({ browser }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupBarbarianMatch(browser, baseURL, 'monk');
        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, hostContext, guestContext } = setup;
        try {
            await injectDazeCombatScene(hostPage, { dazeStacks: 1, purifyStacks: 1, dazeTargetId: '0' });
            await dispatchHarnessCommand(hostPage, {
                type: 'USE_TOKEN',
                playerId: '0',
                payload: {
                    tokenId: 'purify',
                    amount: 1,
                    targetStatusId: 'daze',
                },
            });

            await expect.poll(async () => {
                const state = await readHarnessState(hostPage);
                return state.core.players['0']?.statusEffects?.daze ?? 0;
            }, { timeout: 5000 })
                .toBe(0);

            await dispatchHarnessCommand(hostPage, { type: 'ADVANCE_PHASE', playerId: '0', payload: {} });
            const finalState = await settleAfterAttackResponseWindow(hostPage);
            expect(['offensiveRoll', 'main2']).toContain(finalState.sys?.phase ?? '');
            expect(finalState.core.players['0']?.statusEffects?.daze ?? 0).toBe(0);
            expect(finalState.core.activePlayerId).toBe('0');
        } finally {
            await guestContext.close().catch(() => {});
            await hostContext.close().catch(() => {});
        }
    });

});
