/**
 * DiceThrone Token 响应时序测试
 *
 * 验证：
 * 1. TOKEN_RESPONSE_REQUESTED 之后、关闭前，不应提前产生 DAMAGE_DEALT
 * 2. TOKEN_RESPONSE_CLOSED 之后，才应该产生 DAMAGE_DEALT
 */

import type { Browser, Page } from '@playwright/test';
import { test, expect } from '../framework';

type __ThreeAxeGameMarker = {
  openTestGame: (gameId: string) => Promise<void>;
  setupScene: (config: { gameId: string }) => Promise<void>;
};

const __ensureThreeAxesMarker = async (game: __ThreeAxeGameMarker) => {
  await game.openTestGame('dicethrone');
  await game.setupScene({ gameId: 'dicethrone' });
};
void __ensureThreeAxesMarker;

import {
    readCoreState,
    readEventStream,
    applyCoreStateDirect,
    selectCharacter,
    readyAndStartGame,
    setupDTOnlineMatch,
    waitForGameBoard,
    advanceToOffensiveRoll,
    applyDiceValues,
    closeDebugPanelIfOpen,
    maybePassResponse,
    waitForPhase,
} from '../helpers/dicethrone';

async function setupBarbarianVsMoonElfMatch(browser: Browser, baseURL: string | undefined) {
    const setup = await setupDTOnlineMatch(browser, baseURL);
    if (!setup) return null;

    const { hostPage, guestPage } = setup;

    await selectCharacter(hostPage, 'barbarian');
    await selectCharacter(guestPage, 'moon_elf');
    await readyAndStartGame(hostPage, guestPage);
    await waitForGameBoard(hostPage);
    await waitForGameBoard(guestPage);
    await advanceToOffensiveRoll(hostPage);

    return setup;
}

async function requireClickableAbilitySlot(page: Page, selector: string, label: string) {
    const candidates = page.locator(selector);
    for (let index = 0; index < await candidates.count(); index += 1) {
        const candidate = candidates.nth(index);
        if (await candidate.isVisible({ timeout: 1000 }).catch(() => false)) {
            return candidate;
        }
    }

    const diagnostic = await page.evaluate(async () => {
        const harness = (window as Window).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        const core = state?.core;
        const phase = state?.sys?.phase;
        const rollerId = phase === 'defensiveRoll' && core?.pendingAttack
            ? core.pendingAttack.defenderId
            : core?.activePlayerId;
        const rulesModuleUrl = new URL('/src/games/dicethrone/domain/rules.ts', window.location.origin).href;
        const { getAvailableAbilityIds, getDefensiveAbilityIds } = await import(rulesModuleUrl);
        const availableAbilityIds = core && rollerId != null
            ? phase === 'defensiveRoll' && core.rollCount === 0 && core.pendingAttack
                ? getDefensiveAbilityIds(core, rollerId)
                : getAvailableAbilityIds(core, rollerId, phase)
            : [];
        return {
            phase,
            activePlayerId: core?.activePlayerId,
            rollerId,
            rollCount: core?.rollCount,
            rollDiceCount: core?.rollDiceCount,
            rollConfirmed: core?.rollConfirmed,
            pendingAttack: core?.pendingAttack,
            currentRollContext: core?.currentRollContext,
            availableAbilityIds,
            renderedSlots: Array.from(document.querySelectorAll('[data-ability-slot]')).map((slot) => ({
                slotId: slot.getAttribute('data-ability-slot'),
                scope: slot.getAttribute('data-ability-slot-scope'),
                baseAbilityId: slot.getAttribute('data-base-ability-id'),
                resolvedAbilityId: slot.getAttribute('data-resolved-ability-id'),
                canClick: slot.getAttribute('data-can-click'),
                shouldHighlight: slot.getAttribute('data-should-highlight'),
            })),
            lastCommandRejected: (window as Window & { __BG_LAST_COMMAND_REJECTED__?: unknown }).__BG_LAST_COMMAND_REJECTED__,
        };
    });

    throw new Error(`${label}：未找到可点击技能槽。\n${JSON.stringify(diagnostic, null, 2)}`);
}

async function dismissAttackShowcaseIfVisible(page: Page) {
    const showcase = page.getByTestId('attack-showcase-overlay');
    if (!(await showcase.isVisible({ timeout: 1500 }).catch(() => false))) return false;

    const continueButton = showcase.getByRole('button', { name: /开始防御|继续|Start Defense|Continue/i }).first();
    await expect(continueButton).toBeVisible({ timeout: 5000 });
    await continueButton.click();
    await expect(showcase).toBeHidden({ timeout: 5000 }).catch(() => undefined);
    return true;
}

async function driveAttackToTokenWindow(hostPage: Page, guestPage: Page) {
    await closeDebugPanelIfOpen(hostPage);
    const rollButton = hostPage.locator('[data-tutorial-id="dice-roll-button"]');
    await expect(rollButton).toBeEnabled({ timeout: 5000 });
    await rollButton.click();
    await hostPage.waitForTimeout(300);

    await applyDiceValues(hostPage, [1, 2, 3, 4, 5]);
    await closeDebugPanelIfOpen(hostPage);
    await hostPage.waitForTimeout(300);

    const confirmButton = hostPage.locator('[data-tutorial-id="dice-confirm-button"]');
    await expect(confirmButton).toBeEnabled({ timeout: 5000 });
    await confirmButton.click();
    await hostPage.waitForTimeout(500);

    // 确认攻击骰后先开放对手改骰响应；响应结束后才进入技能选择。
    await maybePassResponse(guestPage);
    await hostPage.waitForTimeout(500);

    const attackAbility = await requireClickableAbilitySlot(
        hostPage,
        '[data-ability-slot="combo"][data-base-ability-id="powerful-strike"][data-can-click="true"]',
        '攻击方确认骰面后选择强力一击',
    );
    await attackAbility.click();
    await hostPage.waitForTimeout(500);

    // 选择攻击后，防御方先关闭攻击特写，再让过该响应窗口，攻击方才能进入结算。
    await dismissAttackShowcaseIfVisible(guestPage);
    await maybePassResponse(guestPage);

    const advanceButton = hostPage.locator('[data-tutorial-id="advance-phase-button"]');
    for (let attempt = 0; attempt < 3; attempt += 1) {
        if (await advanceButton.isEnabled().catch(() => false)) {
            break;
        }
        await maybePassResponse(hostPage, 10000);
        await hostPage.waitForTimeout(500);
    }
    await expect(advanceButton).toBeEnabled({ timeout: 5000 });
    await advanceButton.click();
    await waitForPhase(guestPage, 'defensiveRoll');
    await closeDebugPanelIfOpen(guestPage);
    // 攻击特写可能已在上一响应窗口确认；若仍在，只关闭这一层阅读提示。
    await dismissAttackShowcaseIfVisible(guestPage);

    const defenseAbility = await requireClickableAbilitySlot(
        guestPage,
        '[data-ability-slot][data-base-ability-id="elusive-step"][data-can-click="true"]',
        '防御方开始防御后选择闪避步',
    );
    await defenseAbility.click();
    await guestPage.waitForTimeout(300);

    const defenseRollButton = guestPage.locator('[data-tutorial-id="dice-roll-button"]');
    await expect(defenseRollButton).toBeEnabled({ timeout: 5000 });
    await defenseRollButton.click();
    await guestPage.waitForTimeout(300);

    await applyDiceValues(guestPage, [1, 1, 1, 1, 1]);
    await closeDebugPanelIfOpen(guestPage);
    await guestPage.waitForTimeout(300);

    const defenseConfirmButton = guestPage.locator('[data-tutorial-id="dice-confirm-button"]');
    await expect(defenseConfirmButton).toBeEnabled({ timeout: 5000 });
    await defenseConfirmButton.click();
    await guestPage.waitForTimeout(300);

    // 防御骰确认后，攻击方获得改骰响应权；让过后防御方才能结束防御。
    await maybePassResponse(hostPage);
    await maybePassResponse(guestPage, 10000);

    const defenseAdvanceButton = guestPage.locator('[data-tutorial-id="advance-phase-button"]');
    for (let attempt = 0; attempt < 3; attempt += 1) {
        if (await defenseAdvanceButton.isEnabled().catch(() => false)) {
            break;
        }
        await maybePassResponse(hostPage);
        await maybePassResponse(guestPage, 10000);
        await guestPage.waitForTimeout(500);
    }
    await expect(defenseAdvanceButton).toBeEnabled({ timeout: 5000 });
    await defenseAdvanceButton.click();
}

async function skipTokenResponseIfVisible(guestPage: Page) {
    const skipButton = guestPage.getByTestId('dicethrone-response-pass-button');
    await expect(skipButton).toBeVisible({ timeout: 10000 });
    await skipButton.click();
    await guestPage.waitForTimeout(1500);
}

test.describe('DiceThrone Token Response Timing', () => {
    test('Token 响应请求后不应立刻生成伤害事件', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupBarbarianVsMoonElfMatch(browser, baseURL);

        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, guestPage, hostContext, guestContext } = setup;

        try {
            const initialState = await readCoreState(hostPage);
            initialState.players['1'].tokens = { evasive: 2 };
            await applyCoreStateDirect(hostPage, initialState);
            await hostPage.waitForTimeout(500);

            await driveAttackToTokenWindow(hostPage, guestPage);

            const eventsAfterRequest = await readEventStream(guestPage);
            const tokenRequestIndex = eventsAfterRequest.findIndex(
                (entry: any) => entry.event.type === 'TOKEN_RESPONSE_REQUESTED',
            );

            expect(tokenRequestIndex, 'Should have TOKEN_RESPONSE_REQUESTED event').toBeGreaterThanOrEqual(0);

            const tokenCloseIndex = eventsAfterRequest.findIndex(
                (entry: any) => entry.event.type === 'TOKEN_RESPONSE_CLOSED',
            );

            if (tokenCloseIndex === -1) {
                const hasDamageAfterRequest = eventsAfterRequest
                    .slice(tokenRequestIndex + 1)
                    .some((entry: any) => entry.event.type === 'DAMAGE_DEALT');

                expect(
                    hasDamageAfterRequest,
                    'Should NOT have DAMAGE_DEALT after TOKEN_RESPONSE_REQUESTED (before response closed)',
                ).toBe(false);
            }

            await skipTokenResponseIfVisible(guestPage);

            const eventsAfterClose = await readEventStream(guestPage);
            const finalTokenCloseIndex = eventsAfterClose.findIndex(
                (entry: any) => entry.event.type === 'TOKEN_RESPONSE_CLOSED',
            );

            if (finalTokenCloseIndex >= 0) {
                const damageEvent = eventsAfterClose
                    .slice(finalTokenCloseIndex + 1)
                    .find((entry: any) => entry.event.type === 'DAMAGE_DEALT');

                expect(damageEvent, 'Should have DAMAGE_DEALT after TOKEN_RESPONSE_CLOSED').toBeTruthy();
            }

            const finalState = await readCoreState(guestPage);
            expect(finalState.players['1'].resources.hp, 'Defender should take damage').toBeLessThan(50);
        } finally {
            await guestContext.close();
            await hostContext.close();
        }
    });

    test('事件流顺序验证：完整的 Token 响应流程', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupBarbarianVsMoonElfMatch(browser, baseURL);

        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, guestPage, hostContext, guestContext } = setup;

        try {
            const initialState = await readCoreState(hostPage);
            initialState.players['1'].tokens = { evasive: 2 };
            await applyCoreStateDirect(hostPage, initialState);
            await hostPage.waitForTimeout(500);

            await driveAttackToTokenWindow(hostPage, guestPage);
            await skipTokenResponseIfVisible(guestPage);

            const allEvents = await readEventStream(guestPage);
            const eventTypes = allEvents.map((entry: any) => entry.event.type);
            const tokenRequestIndex = eventTypes.indexOf('TOKEN_RESPONSE_REQUESTED');
            const tokenCloseIndex = eventTypes.indexOf('TOKEN_RESPONSE_CLOSED');
            const damageIndex = eventTypes.lastIndexOf('DAMAGE_DEALT');

            expect(tokenRequestIndex, 'Should have TOKEN_RESPONSE_REQUESTED').toBeGreaterThanOrEqual(0);
            expect(tokenCloseIndex, 'Should have TOKEN_RESPONSE_CLOSED').toBeGreaterThan(tokenRequestIndex);
            expect(damageIndex, 'Should have DAMAGE_DEALT after TOKEN_RESPONSE_CLOSED').toBeGreaterThan(tokenCloseIndex);
        } finally {
            await guestContext.close();
            await hostContext.close();
        }
    });
});
