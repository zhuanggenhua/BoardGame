import { test, expect } from '../framework';
import type { GameTestContext } from '../framework';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';
import { TOKEN_IDS } from '../../src/games/dicethrone/domain/ids';
import { DESKTOP_REFERENCE_VIEWPORT, MOBILE_LANDSCAPE_REFERENCE_VIEWPORT } from '../../src/shared/referenceViewports';
import '../../src/games/dicethrone/domain';

test.setTimeout(120000);

type JsonRecord = Record<string, any>;

async function setupDefenseSelectedScene(game: GameTestContext): Promise<void> {
    await game.openTestGame('dicethrone', { playerID: '1' });
    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: { CP: 2, HP: 50 },
        },
        player1: {
            resources: { CP: 2, HP: 50 },
        },
        currentPlayer: '0',
        phase: 'defensiveRoll',
        extra: {
            selectedCharacters: { '0': 'monk', '1': 'shadow_thief' },
            hostStarted: true,
            rollCount: 0,
            rollLimit: 1,
            rollConfirmed: false,
            dice: [
                { id: 0, value: 1, isKept: false },
                { id: 1, value: 2, isKept: false },
                { id: 2, value: 3, isKept: false },
                { id: 3, value: 4, isKept: false },
                { id: 4, value: 5, isKept: false },
            ],
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                isDefendable: true,
                damage: 5,
                bonusDamage: 0,
                sourceAbilityId: 'smash',
                defenseAbilityId: 'shadow-defense',
            },
            activePlayerId: '1',
        },
    });

    await expect.poll(async () => {
        const state = await game.getState();
        return {
            phase: state?.sys?.phase ?? null,
            activePlayerId: state?.core?.activePlayerId ?? null,
            defenseAbilityId: state?.core?.pendingAttack?.defenseAbilityId ?? null,
        };
    }, { timeout: 10000 }).toMatchObject({
        phase: 'defensiveRoll',
        activePlayerId: '1',
        defenseAbilityId: 'shadow-defense',
    });

    const continueButton = game.page.getByRole('button', { name: /开始防御|继续/i });
    if ((await continueButton.count()) > 0) {
        await continueButton.first().click();
        await expect(continueButton).toHaveCount(0, { timeout: 5000 });
    }
}

async function setupTokenResponseWindow(game: GameTestContext): Promise<void> {
    await game.openTestGame('dicethrone', { playerID: '0' });
    await game.setupScene({
        gameId: 'dicethrone',
        randomQueue: [1],
        player0: {
            hand: ['card-artificer-mechanical-strike'],
            resources: { [RESOURCE_IDS.CP]: 10, [RESOURCE_IDS.HP]: 40 },
            tokens: {
                [TOKEN_IDS.HEAL_BOT]: 1,
                [TOKEN_IDS.NANOBOT]: 0,
                [TOKEN_IDS.SHOCK_BOT]: 0,
                [TOKEN_IDS.SYNTH]: 2,
            },
        },
        player1: {
            resources: { [RESOURCE_IDS.CP]: 10, [RESOURCE_IDS.HP]: 50 },
        },
        currentPlayer: '1',
        phase: 'defensiveRoll',
        sys: {
            interaction: {
                current: {
                    id: 'dt-token-response-artificer-before-damage',
                    kind: 'dt:token-response',
                    playerId: '0',
                    data: {
                        pendingDamageId: 'artificer-before-damage',
                    },
                },
                queue: [],
            },
            responseWindow: {
                current: {
                    id: 'artificer-before-damage-response-window',
                    windowType: 'afterAttackResolved',
                    sourceId: 'fist-technique',
                    responderQueue: ['0'],
                    currentResponderIndex: 0,
                    passedPlayers: [],
                },
            },
        },
        extra: {
            selectedCharacters: { '0': 'artificer', '1': 'monk' },
            hostStarted: true,
            pendingAttack: {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'fist-technique',
                isDefendable: true,
            },
            pendingDamage: {
                id: 'artificer-before-damage',
                sourcePlayerId: '1',
                targetPlayerId: '0',
                originalDamage: 6,
                currentDamage: 6,
                sourceAbilityId: 'fist-technique',
                damageScope: 'attack',
                responseType: 'beforeDamageReceived',
                responderId: '0',
                isFullyEvaded: false,
            },
        },
    });

    await game.page.evaluate((healBotId) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        if (!state || !harness?.state?.set) {
            throw new Error('TestHarness state 不可用');
        }
        const core = state.core as JsonRecord;
        const players = core.players as Record<string, JsonRecord>;
        const artificer = players['0'];
        return harness.state.set({
            ...state,
            core: {
                ...core,
                players: {
                    ...players,
                    '0': {
                        ...artificer,
                        tokenStackLimits: {
                            ...(artificer.tokenStackLimits ?? {}),
                            [healBotId]: 1,
                        },
                        artificerBotState: {
                            ...(artificer.artificerBotState ?? {}),
                            [healBotId]: {
                                built: true,
                                upgraded: false,
                                activationsUsedThisTurn: 0,
                            },
                        },
                    },
                },
            },
        });
    }, TOKEN_IDS.HEAL_BOT);

    await game.waitForPhase('defensiveRoll', 10000);
    await expect(game.page.getByTestId('token-response-modal')).toBeVisible({ timeout: 10000 });
}

async function readTokenModalMetrics(page: import('@playwright/test').Page) {
    return page.evaluate(() => {
        const modal = document.querySelector('[data-testid="token-response-modal"]');
        const shell = modal?.closest('.relative.bg-slate-950');
        const shellRect = shell?.getBoundingClientRect();
        const useButton = Array.from(document.querySelectorAll('[data-testid="token-response-modal"] button'))
            .find((button) => button.textContent?.trim() === '使用');
        const useButtonRect = useButton?.getBoundingClientRect();
        return {
            viewport: { width: window.innerWidth, height: window.innerHeight },
            shell: shellRect ? {
                width: Math.round(shellRect.width),
                height: Math.round(shellRect.height),
                x: Math.round(shellRect.x),
                y: Math.round(shellRect.y),
                bottom: Math.round(shellRect.bottom),
            } : null,
            useButton: useButtonRect ? {
                width: Math.round(useButtonRect.width),
                height: Math.round(useButtonRect.height),
            } : null,
        };
    });
}

test('DiceThrone UI 收窄修复取证：防御选中态与 Token 面板完整显示', async ({ page, game }, testInfo) => {
    await page.setViewportSize(DESKTOP_REFERENCE_VIEWPORT);
    await setupDefenseSelectedScene(game);
    const selectedAbility = page.locator('[data-testid^="dt-ability-selected-"]').first();
    await expect(selectedAbility).toBeVisible({ timeout: 5000 });
    const selectedMetrics = await selectedAbility.evaluate((selected) => {
        const style = window.getComputedStyle(selected);
        return {
            testId: selected.getAttribute('data-testid'),
            childElementCount: selected.children.length,
            backgroundImage: style.backgroundImage,
            boxShadow: style.boxShadow,
            zIndex: style.zIndex,
        };
    });
    expect(selectedMetrics.childElementCount).toBe(0);
    expect(selectedMetrics.backgroundImage).toContain('linear-gradient');
    await game.screenshot('防御技能选中态-清晰单层渐变描边', testInfo);

    await page.setViewportSize(DESKTOP_REFERENCE_VIEWPORT);
    await setupTokenResponseWindow(game);
    await game.screenshot('PC-Token响应窗口-按钮原尺寸', testInfo);
    const desktopMetrics = await readTokenModalMetrics(page);

    await page.setViewportSize(MOBILE_LANDSCAPE_REFERENCE_VIEWPORT);
    await page.waitForTimeout(800);
    await expect(page.getByTestId('token-response-modal')).toBeVisible({ timeout: 5000 });
    await game.screenshot('手机横屏-Token响应窗口完整显示', testInfo);
    const mobileMetrics = await readTokenModalMetrics(page);

    expect(mobileMetrics.shell?.y ?? -1).toBeGreaterThanOrEqual(0);
    expect(mobileMetrics.shell?.bottom ?? 9999).toBeLessThanOrEqual(MOBILE_LANDSCAPE_REFERENCE_VIEWPORT.height);

    console.log('[DT_UI_SCOPE_REGRESSION]', JSON.stringify({
        selectedMetrics,
        desktopMetrics,
        mobileMetrics,
    }, null, 2));
});
