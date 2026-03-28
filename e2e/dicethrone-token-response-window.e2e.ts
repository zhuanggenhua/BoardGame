import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from './framework';
import type { GameTestContext } from './framework';
import { TOKEN_IDS } from '../src/games/dicethrone/domain/ids';
import {
    setupOnlineMatch,
    readCoreState,
    applyCoreStateDirect,
    closeDebugPanelIfOpen,
    maybePassResponse,
    selectCharacter,
    readyAndStartGame,
    waitForGameBoard,
    advanceToOffensiveRoll,
    applyDiceValues,
} from './helpers/dicethrone';

interface TokenHarnessEntry {
    event?: {
        type?: string;
        payload?: {
            effectKey?: string;
            value?: number;
        };
    };
}

interface TokenHarnessPlayer {
    resources?: {
        hp?: number;
    };
    tokens?: Record<string, number>;
    damageShields?: Array<{ value?: number }>;
}

interface TokenHarnessState {
    core?: {
        pendingDamage?: {
            currentDamage?: number;
            tokenUsageTotals?: Record<string, number>;
        } | null;
        players?: Record<string, TokenHarnessPlayer>;
    };
    sys?: {
        eventStream?: {
            entries?: TokenHarnessEntry[];
        };
    };
}

type HarnessWindow = Window & {
    __BG_TEST_HARNESS__?: {
        state?: {
            get?: () => TokenHarnessState;
        };
    };
};

/** 读取指定玩家 tokens */
const getPlayerTokens = (core: Record<string, unknown>, playerId: string) => {
    const players = core.players as Record<string, Record<string, unknown>>;
    return (players[playerId]?.tokens as Record<string, number>) ?? {};
};

/** 注入 tokens */
const injectTokens = async (
    page: Page,
    playerId: string,
    tokens: Record<string, number>,
) => {
    const core = await readCoreState(page) as Record<string, unknown>;
    const players = core.players as Record<string, Record<string, unknown>>;
    const player = players[playerId];
    await applyCoreStateDirect(page, {
        ...core,
        players: {
            ...players,
            [playerId]: {
                ...player,
                tokens: { ...((player.tokens as Record<string, number>) ?? {}), ...tokens },
            },
        },
    });
    await page.waitForTimeout(500);
};

type ScenePlayers = Record<'0' | '1', string>;

async function setupTokenScene(
    game: GameTestContext,
    players: ScenePlayers,
    currentPlayer: '0' | '1' = '0',
): Promise<void> {
    await game.openTestGame('dicethrone');
    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: { CP: 0, HP: 50 },
        },
        player1: {
            resources: { CP: 0, HP: 50 },
        },
        currentPlayer,
        phase: 'main2',
        extra: {
            selectedCharacters: players,
            hostStarted: true,
        },
    });

    await game.waitForPhase('main2', 5000);
}

async function patchPlayerTokens(
    page: Page,
    playerId: '0' | '1',
    tokens: Record<string, number>,
): Promise<void> {
    await page.evaluate(({ id, patch }) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        const player = state?.core?.players?.[id];

        if (!player || typeof harness?.state?.patch !== 'function') {
            throw new Error('TestHarness state.patch 不可用');
        }

        harness.state.patch({
            core: {
                players: {
                    [id]: {
                        ...player,
                        tokens: {
                            ...(player.tokens ?? {}),
                            ...patch,
                        },
                    },
                },
            },
        });
    }, { id: playerId, patch: tokens });

    await page.waitForTimeout(300);
}

async function readTokenCount(
    game: GameTestContext,
    playerId: '0' | '1',
    tokenId: string,
): Promise<number> {
    const player = await game.getPlayerState(playerId);
    return player?.tokens?.[tokenId] ?? 0;
}

async function expectTokenCount(
    game: GameTestContext,
    playerId: '0' | '1',
    tokenId: string,
    count: number,
): Promise<void> {
    await expect.poll(
        () => readTokenCount(game, playerId, tokenId),
        { timeout: 5000 },
    ).toBe(count);
}

test.describe('Token 响应窗口完整流程', () => {
    test('攻击方暴击 token 注入后可见', async ({ page, game }, testInfo: TestInfo) => {
        await setupTokenScene(game, { '0': 'paladin', '1': 'barbarian' });
        await patchPlayerTokens(page, '0', { [TOKEN_IDS.CRIT]: 2 });

        await expectTokenCount(game, '0', TOKEN_IDS.CRIT, 2);
        await game.screenshot('crit-token-visible', testInfo);
    });

    test('防御方守护 token 注入后可见', async ({ page, game }) => {
        await setupTokenScene(game, { '0': 'paladin', '1': 'barbarian' });
        await patchPlayerTokens(page, '1', { [TOKEN_IDS.PROTECT]: 3 });

        await expectTokenCount(game, '1', TOKEN_IDS.PROTECT, 3);
    });

    test('太极 token 注入后可见（双时机 token）', async ({ page, game }) => {
        await setupTokenScene(game, { '0': 'monk', '1': 'barbarian' });

        await patchPlayerTokens(page, '0', { [TOKEN_IDS.TAIJI]: 2 });
        await expectTokenCount(game, '0', TOKEN_IDS.TAIJI, 2);

        await patchPlayerTokens(page, '0', { [TOKEN_IDS.TAIJI]: 1 });
        await expectTokenCount(game, '0', TOKEN_IDS.TAIJI, 1);

        await patchPlayerTokens(page, '0', { [TOKEN_IDS.TAIJI]: 0 });
        await expectTokenCount(game, '0', TOKEN_IDS.TAIJI, 0);
    });

    test('跳过响应时 token 不被消耗', async ({ page, game }) => {
        await setupTokenScene(game, { '0': 'paladin', '1': 'barbarian' });
        await patchPlayerTokens(page, '0', { [TOKEN_IDS.CRIT]: 1 });

        await expectTokenCount(game, '0', TOKEN_IDS.CRIT, 1);
        await expectTokenCount(game, '0', TOKEN_IDS.CRIT, 1);
    });
});

test.describe('Token 响应窗口真实入口', () => {
    test('samurai honor should open from real attack flow and resolve by two clicks', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupOnlineMatch(browser, baseURL);
        if (!setup) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = setup;

        try {
            await selectCharacter(hostPage, 'samurai');
            await selectCharacter(guestPage, 'barbarian');
            await readyAndStartGame(hostPage, guestPage);
            await waitForGameBoard(hostPage);
            await waitForGameBoard(guestPage);

            await advanceToOffensiveRoll(hostPage);
            await hostPage.waitForTimeout(800);

            await injectTokens(hostPage, '0', { [TOKEN_IDS.HONOR]: 3 });
            await closeDebugPanelIfOpen(hostPage);

            const rollButton = hostPage.locator('[data-tutorial-id="dice-roll-button"]');
            await expect(rollButton).toBeEnabled({ timeout: 5000 });
            await rollButton.click();
            await hostPage.waitForTimeout(300);

            await applyDiceValues(hostPage, [1, 1, 1, 1, 1]);
            await closeDebugPanelIfOpen(hostPage);
            await hostPage.waitForTimeout(300);

            const confirmButton = hostPage.locator('[data-tutorial-id="dice-confirm-button"]');
            await expect(confirmButton).toBeEnabled({ timeout: 5000 });
            await confirmButton.click();
            await hostPage.waitForTimeout(500);

            const abilitySlot = hostPage.locator('[data-ability-slot="fist"]').first();
            await expect(abilitySlot).toBeVisible({ timeout: 5000 });
            await abilitySlot.click();
            await hostPage.waitForTimeout(500);

            const attackAdvanceButton = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
            for (let attempt = 0; attempt < 3; attempt += 1) {
                if (await attackAdvanceButton.isEnabled().catch(() => false)) {
                    break;
                }
                await maybePassResponse(hostPage, 10000);
                await hostPage.waitForTimeout(500);
            }
            await expect(attackAdvanceButton).toBeEnabled({ timeout: 5000 });
            await attackAdvanceButton.click();
            const defendEntryButton = guestPage.getByRole('button', { name: /^(DEFEND|Defend|防御)$/i }).first();
            await expect(defendEntryButton).toBeVisible({ timeout: 10000 });
            await defendEntryButton.click();

            const defenseRollButton = guestPage.locator('[data-tutorial-id="dice-roll-button"]');
            await expect(defenseRollButton).toBeEnabled({ timeout: 5000 });
            await defenseRollButton.click();
            await guestPage.waitForTimeout(300);

            await applyDiceValues(guestPage, [1, 1, 1]);
            await closeDebugPanelIfOpen(guestPage);
            await guestPage.waitForTimeout(300);

            const defenseConfirmButton = guestPage.locator('[data-tutorial-id="dice-confirm-button"]');
            await expect(defenseConfirmButton).toBeEnabled({ timeout: 5000 });
            await defenseConfirmButton.click();
            await guestPage.waitForTimeout(300);

            await maybePassResponse(guestPage, 10000);

            const defenseAdvanceButton = guestPage.locator('[data-tutorial-id="advance-phase-button"]');
            for (let attempt = 0; attempt < 3; attempt += 1) {
                if (await defenseAdvanceButton.isEnabled().catch(() => false)) {
                    break;
                }
                await maybePassResponse(guestPage, 10000);
                await guestPage.waitForTimeout(500);
            }
            await expect(defenseAdvanceButton).toBeEnabled({ timeout: 5000 });
            await defenseAdvanceButton.click();

            const honorLabel = hostPage.getByText(/^Honor$/).first();
            const useButton = hostPage.getByRole('button', { name: /^(使用|Use|Use Token)(?: x\d+)?$/i }).first();
            await expect(honorLabel).toBeVisible({ timeout: 8000 });
            await expect(useButton).toBeVisible({ timeout: 5000 });
            await hostPage.screenshot({ path: testInfo.outputPath('samurai-honor-real-flow-before-use.png'), fullPage: false });

            await useButton.click();
            await hostPage.waitForFunction(() => {
                const state = (window as HarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.core?.pendingDamage?.currentDamage === 8
                    && state?.core?.pendingDamage?.tokenUsageTotals?.honor === 1;
            }, undefined, { timeout: 10000, polling: 200 });

            await useButton.click();

            await hostPage.waitForFunction(() => {
                const state = (window as HarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.core?.players?.['1']?.resources?.hp === 40
                    && !state?.core?.pendingDamage;
            }, undefined, { timeout: 10000, polling: 200 });

            const finalState = await readCoreState(hostPage) as {
                players: Record<string, { resources: { hp: number } }>;
            };
            expect(finalState.players['1'].resources.hp).toBe(40);

            await closeDebugPanelIfOpen(hostPage);
            await hostPage.screenshot({ path: testInfo.outputPath('samurai-honor-real-flow-after-use.png'), fullPage: false });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('samurai back strike should open from real attack flow and retaliate on click', async ({ browser }, testInfo) => {
        test.setTimeout(180000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        const setup = await setupOnlineMatch(browser, baseURL);
        if (!setup) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = setup;

        try {
            await selectCharacter(hostPage, 'samurai');
            await selectCharacter(guestPage, 'samurai');
            await readyAndStartGame(hostPage, guestPage);
            await waitForGameBoard(hostPage);
            await waitForGameBoard(guestPage);

            await injectTokens(guestPage, '1', { [TOKEN_IDS.SAMURAI_RETRIBUTION]: 1 });
            await closeDebugPanelIfOpen(guestPage);

            await advanceToOffensiveRoll(hostPage);
            await hostPage.waitForTimeout(800);

            const rollButton = hostPage.locator('[data-tutorial-id="dice-roll-button"]');
            await expect(rollButton).toBeEnabled({ timeout: 5000 });
            await rollButton.click();
            await hostPage.waitForTimeout(300);

            await applyDiceValues(hostPage, [1, 1, 1, 1, 1]);
            await closeDebugPanelIfOpen(hostPage);
            await hostPage.waitForTimeout(300);

            const confirmButton = hostPage.locator('[data-tutorial-id="dice-confirm-button"]');
            await expect(confirmButton).toBeEnabled({ timeout: 5000 });
            await confirmButton.click();
            await hostPage.waitForTimeout(500);

            const abilitySlot = hostPage.locator('[data-ability-slot="fist"]').first();
            await expect(abilitySlot).toBeVisible({ timeout: 5000 });
            await abilitySlot.click();
            await hostPage.waitForTimeout(500);

            await hostPage.waitForTimeout(500);
            await maybePassResponse(hostPage, 10000);

            const resolveAttackButton = hostPage.getByRole('button', { name: /^(Resolve Attack|结算攻击)$/i }).first();
            await expect(resolveAttackButton).toBeVisible({ timeout: 10000 });
            for (let attempt = 0; attempt < 3; attempt += 1) {
                if (await resolveAttackButton.isEnabled().catch(() => false)) {
                    break;
                }
                await maybePassResponse(hostPage, 10000);
                await hostPage.waitForTimeout(500);
            }
            await expect(resolveAttackButton).toBeEnabled({ timeout: 5000 });
            await resolveAttackButton.click();
            const defendEntryButton = guestPage.getByRole('button', { name: /^(DEFEND|Defend|防御)$/i }).first();
            await expect(defendEntryButton).toBeVisible({ timeout: 10000 });
            await defendEntryButton.click();

            const defenseRollButton = guestPage.locator('[data-tutorial-id="dice-roll-button"]');
            await expect(defenseRollButton).toBeEnabled({ timeout: 5000 });
            await defenseRollButton.click();
            await guestPage.waitForTimeout(300);

            await applyDiceValues(guestPage, [4, 4, 4]);
            await closeDebugPanelIfOpen(guestPage);
            await guestPage.waitForTimeout(300);

            const defenseConfirmButton = guestPage.locator('[data-tutorial-id="dice-confirm-button"]');
            await expect(defenseConfirmButton).toBeEnabled({ timeout: 5000 });
            await defenseConfirmButton.click();
            await guestPage.waitForTimeout(300);

            await maybePassResponse(guestPage, 10000);

            const defenseAdvanceButton = guestPage.locator('[data-tutorial-id="advance-phase-button"]');
            await expect(defenseAdvanceButton).toBeEnabled({ timeout: 5000 });
            await defenseAdvanceButton.click();

            const backStrikeLabel = guestPage.getByText(/^Back Strike$/).first();
            const useButton = guestPage.getByRole('button', { name: /^(使用|Use|Use Token)(?: x\d+)?$/i }).first();

            await expect(backStrikeLabel).toBeVisible({ timeout: 8000 });
            await expect(useButton).toBeVisible({ timeout: 5000 });
            await guestPage.screenshot({ path: testInfo.outputPath('samurai-back-strike-real-flow-before-use.png'), fullPage: false });

            const beforeUseState = await guestPage.evaluate(() => {
                const state = (window as HarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return {
                    pendingDamage: state?.core?.pendingDamage?.currentDamage ?? null,
                    attackerHp: state?.core?.players?.['0']?.resources?.hp ?? null,
                    defenderHp: state?.core?.players?.['1']?.resources?.hp ?? null,
                    retribution: state?.core?.players?.['1']?.tokens?.samurai_retribution ?? 0,
                    shieldTotal: ((state?.core?.players?.['1']?.damageShields ?? []) as Array<{ value?: number }>)
                        .reduce((sum, shield) => sum + (shield?.value ?? 0), 0),
                };
            });

            expect(beforeUseState.pendingDamage).toBeGreaterThan(0);
            expect(beforeUseState.retribution).toBe(1);

            await useButton.click();
            await guestPage.waitForFunction(() => {
                const state = (window as HarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return !state?.core?.pendingDamage
                    && (state?.core?.players?.['1']?.tokens?.samurai_retribution ?? 0) === 0;
            }, undefined, { timeout: 10000, polling: 200 });

            const finalState = await guestPage.evaluate(() => {
                const state = (window as HarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                const entries = state?.sys?.eventStream?.entries ?? [];
                const latestBackStrike = [...entries]
                    .reverse()
                    .find((entry) => entry.event?.payload?.effectKey === 'bonusDie.effect.samuraiBackStrikeDie');
                return {
                    pendingDamage: state?.core?.pendingDamage ?? null,
                    attackerHp: state?.core?.players?.['0']?.resources?.hp ?? null,
                    defenderHp: state?.core?.players?.['1']?.resources?.hp ?? null,
                    retribution: state?.core?.players?.['1']?.tokens?.samurai_retribution ?? 0,
                    backStrikeRoll: latestBackStrike?.event?.payload?.value ?? null,
                    lastEventTypes: entries.slice(-10).map((entry) => entry.event?.type),
                };
            });
            const expectedRetaliateDamage = Math.ceil((finalState.backStrikeRoll ?? 0) / 2);
            const expectedDefenderDamage = Math.max(
                0,
                (beforeUseState.pendingDamage ?? 0) - (beforeUseState.shieldTotal ?? 0),
            );

            expect(finalState.pendingDamage).toBeNull();
            expect(finalState.retribution).toBe(0);
            expect(finalState.backStrikeRoll).not.toBeNull();
            expect(finalState.attackerHp).toBe((beforeUseState.attackerHp ?? 0) - expectedRetaliateDamage);
            expect(finalState.defenderHp).toBe((beforeUseState.defenderHp ?? 0) - expectedDefenderDamage);
            expect(finalState.lastEventTypes).toContain('BONUS_DIE_ROLLED');
            expect(finalState.lastEventTypes).toContain('DAMAGE_DEALT');

            await closeDebugPanelIfOpen(guestPage);
            await guestPage.screenshot({ path: testInfo.outputPath('samurai-back-strike-real-flow-after-use.png'), fullPage: false });
        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });
});
