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
    await expect(game.page.getByTestId('dicethrone-response-window-hint')).toBeVisible({ timeout: 10000 });
    await expect(game.page.getByTestId(`dt-player-0-token-${TOKEN_IDS.HEAL_BOT}`)).toHaveAttribute('data-token-clickable', 'true');
}

async function readTokenResponseMetrics(page: import('@playwright/test').Page) {
    return page.evaluate(() => {
        const prompt = document.querySelector<HTMLElement>('[data-testid="dicethrone-response-window-hint"]');
        const token = document.querySelector('[data-token-clickable="true"]');
        const promptRect = prompt?.getBoundingClientRect();
        const tokenRect = token?.getBoundingClientRect();
        return {
            viewport: { width: window.innerWidth, height: window.innerHeight },
            prompt: promptRect ? {
                width: Math.round(promptRect.width),
                height: Math.round(promptRect.height),
                x: Math.round(promptRect.x),
                y: Math.round(promptRect.y),
                bottom: Math.round(promptRect.bottom),
                position: window.getComputedStyle(prompt).position,
                anchor: prompt.getAttribute('data-anchor'),
                placement: prompt.getAttribute('data-placement'),
                centeredOnViewport: Math.abs((promptRect.x + promptRect.width / 2) - (window.innerWidth / 2)) < 2,
                nearHandLiftBand: promptRect.bottom > window.innerHeight * 0.50,
                bottomInset: Math.round(window.innerHeight - promptRect.bottom),
            } : null,
            token: tokenRect ? {
                x: Math.round(tokenRect.x),
                y: Math.round(tokenRect.y),
                bottom: Math.round(tokenRect.bottom),
                clickable: token.getAttribute('data-token-clickable'),
            } : null,
        };
    });
}

test('DiceThrone UI 收窄修复取证：防御选中态与 Token 面板完整显示', async ({ page, game }, testInfo) => {
    await page.setViewportSize(DESKTOP_REFERENCE_VIEWPORT);
    await setupDefenseSelectedScene(game);
    const selectedDefenseSlot = page.locator(
        '[data-ability-slot-scope="main-board"][data-resolved-ability-id="shadow-defense"][data-base-ability-id="shadow-defense"][data-is-selected="true"]'
    );
    await expect(selectedDefenseSlot).toHaveCount(1, { timeout: 5000 });
    await expect(selectedDefenseSlot).toHaveAttribute('data-ability-slot', 'lightning');
    const selectedDefenseOverlay = selectedDefenseSlot.getByTestId('dt-ability-selected-lightning');
    await expect(selectedDefenseOverlay).toBeVisible({ timeout: 5000 });
    const selectedMetrics = await selectedDefenseOverlay.evaluate((selected) => {
        const style = window.getComputedStyle(selected);
        const slot = selected.parentElement;
        return {
            slotId: slot?.getAttribute('data-ability-slot'),
            slotScope: slot?.getAttribute('data-ability-slot-scope'),
            resolvedAbilityId: slot?.getAttribute('data-resolved-ability-id'),
            baseAbilityId: slot?.getAttribute('data-base-ability-id'),
            isSelected: slot?.getAttribute('data-is-selected'),
            testId: selected.getAttribute('data-testid'),
            childElementCount: selected.children.length,
            backgroundImage: style.backgroundImage,
            boxShadow: style.boxShadow,
            zIndex: style.zIndex,
        };
    });
    expect(selectedMetrics.childElementCount).toBe(0);
    expect(selectedMetrics.backgroundImage).toContain('linear-gradient');
    expect(selectedMetrics).toMatchObject({
        slotId: 'lightning',
        slotScope: 'main-board',
        resolvedAbilityId: 'shadow-defense',
        baseAbilityId: 'shadow-defense',
        isSelected: 'true',
        testId: 'dt-ability-selected-lightning',
    });
    await game.screenshot('防御投掷-暗影守护防御技能已选中高亮', testInfo);

    await page.setViewportSize(DESKTOP_REFERENCE_VIEWPORT);
    await setupTokenResponseWindow(game);
    await game.screenshot('PC-Token响应窗口-按钮原尺寸', testInfo);
    const desktopMetrics = await readTokenResponseMetrics(page);

    await page.setViewportSize(MOBILE_LANDSCAPE_REFERENCE_VIEWPORT);
    await page.waitForTimeout(800);
    await expect(page.getByTestId('dicethrone-response-window-hint')).toBeVisible({ timeout: 5000 });
    await game.screenshot('手机横屏-Token响应窗口完整显示', testInfo);
    const mobileMetrics = await readTokenResponseMetrics(page);

    expect(mobileMetrics.prompt?.y ?? -1).toBeGreaterThanOrEqual(0);
    expect(mobileMetrics.prompt?.bottom ?? 9999).toBeLessThanOrEqual(MOBILE_LANDSCAPE_REFERENCE_VIEWPORT.height);
    expect(mobileMetrics.prompt?.position).toBe('fixed');
    expect(mobileMetrics.prompt?.anchor).toBe('viewport');
    expect(mobileMetrics.prompt?.placement).toBe('fixed-hand-lift-slot');
    expect(mobileMetrics.prompt?.centeredOnViewport).toBe(true);
    expect(mobileMetrics.prompt?.nearHandLiftBand).toBe(true);
    expect(mobileMetrics.prompt?.bottomInset ?? 0).toBeGreaterThan(128);
    expect(mobileMetrics.token?.clickable).toBe('true');

    console.log('[DT_UI_SCOPE_REGRESSION]', JSON.stringify({
        selectedMetrics,
        desktopMetrics,
        mobileMetrics,
    }, null, 2));
});
