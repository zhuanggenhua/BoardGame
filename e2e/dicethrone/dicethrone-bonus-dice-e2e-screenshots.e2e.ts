import type { Page } from '@playwright/test';
import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import {
    dispatchDiceThroneCommand,
    ensureDebugPanelClosed,
    resolveSelectedAttack,
    setDiceThroneBonusDiceValues,
    setDiceThroneDiceValues,
    waitForDiceThroneHarness,
} from '../helpers/dicethrone';

const DICETHRONE_OPEN_TIMEOUT_MS = 180000;

async function screenshotStep(
    page: Page,
    testInfo: Parameters<typeof getEvidenceScreenshotPath>[0],
    name: string,
): Promise<string> {
    const path = getEvidenceScreenshotPath(testInfo, name, { requireChineseName: true });
    await page.screenshot({ path, fullPage: false });
    return path;
}

async function waitForCardSpotlight(page: Page, cardId: string) {
    const spotlight = page.locator(`[data-testid="card-spotlight-overlay"][data-card-id="${cardId}"]`).first();
    await expect(spotlight).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(900);
    return spotlight;
}

async function waitForCardSpotlightGone(page: Page) {
    await expect(page.locator('[data-testid="card-spotlight-overlay"]')).toHaveCount(0, { timeout: 8000 });
}

async function waitForBonusOverlay(page: Page) {
    const overlay = page.locator('[data-testid="bonus-die-overlay"]').first();
    await expect(overlay).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(900);
    return overlay;
}

async function dispatch(page: Page, type: string, playerId: string, payload: Record<string, unknown> = {}) {
    await dispatchDiceThroneCommand(page, { type, playerId, payload });
    await page.waitForTimeout(250);
}

test.describe('DiceThrone 奖励骰端到端截图链', () => {
    test('月精灵万箭齐发从打牌到五颗奖励骰展示再到伤害收口', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);
        await clearEvidenceScreenshotsForTest(testInfo);

        await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
        await waitForDiceThroneHarness(page);
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['volley'],
                resources: { CP: 3, HP: 50 },
            },
            player1: {
                resources: { CP: 2, HP: 50 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': 'moon_elf', '1': 'barbarian' },
                hostStarted: true,
                activePlayerId: '0',
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: true,
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
                    isDefendable: false,
                    sourceAbilityId: 'longbow-4-1',
                    damage: 5,
                    bonusDamage: 0,
                    attackModifierBonusDamage: 0,
                    damageResolved: false,
                    resolvedDamage: 0,
                    preDefenseResolved: false,
                    offensiveRollEndTokenResolved: false,
                },
                pendingDamage: null,
                pendingBonusDiceSettlement: undefined,
            },
        });
        await ensureDebugPanelClosed(page);

        await expect(page.locator('[data-testid="hand-area"] [data-card-id="volley"]').first())
            .toBeVisible({ timeout: 10000 });
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                handIds: state?.core?.players?.['0']?.hand?.map((card: any) => card.id) ?? [],
                sourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'offensiveRoll',
            handIds: ['volley'],
            sourceAbilityId: 'longbow-4-1',
        });
        await screenshotStep(page, testInfo, '01-万箭齐发-打牌前攻击已选且手牌可见');

        await setDiceThroneBonusDiceValues(page, [1, 2, 3, 4, 5]);
        await dispatch(page, 'PLAY_CARD', '0', { cardId: 'volley' });

        const spotlight = await waitForCardSpotlight(page, 'volley');
        await expect(spotlight.locator('[data-testid="card-spotlight-die"]')).toHaveCount(5, { timeout: 5000 });
        await expect(spotlight.locator('[data-testid="card-spotlight-summary-text"]').first()).toBeVisible({ timeout: 5000 });
        await expect.poll(async () => {
            const state = await game.getState();
            const bonusEvents = (state?.sys?.eventStream?.entries ?? [])
                .filter((entry: any) => entry?.event?.type === 'BONUS_DIE_ROLLED');
            const summary = bonusEvents
                .map((entry: any) => entry.event?.payload)
                .find((payload: any) => payload?.effectKey === 'bonusDie.effect.volley.result');
            return {
                bonusEventCount: bonusEvents.length,
                summaryKey: summary?.effectKey ?? null,
                pendingSettlement: state?.core?.pendingBonusDiceSettlement ? 'present' : 'none',
                handIds: state?.core?.players?.['0']?.hand?.map((card: any) => card.id) ?? [],
                discardIds: state?.core?.players?.['0']?.discard?.map((card: any) => card.id) ?? [],
            };
        }, { timeout: 10000 }).toMatchObject({
            bonusEventCount: 6,
            summaryKey: 'bonusDie.effect.volley.result',
            pendingSettlement: 'none',
            handIds: [],
            discardIds: ['volley'],
        });
        await screenshotStep(page, testInfo, '02-万箭齐发-卡牌特写展示五颗奖励骰和结果描述');

        await waitForCardSpotlightGone(page);
        await screenshotStep(page, testInfo, '03-万箭齐发-特写关闭后攻击修正留在结算前');

        const beforeResolve = await game.getState();
        const defenderHpBefore = beforeResolve?.core?.players?.['1']?.resources?.HP
            ?? beforeResolve?.core?.players?.['1']?.resources?.hp
            ?? 50;
        const expectedDamage = (beforeResolve?.core?.pendingAttack?.damage ?? 0)
            + (beforeResolve?.core?.pendingAttack?.bonusDamage ?? 0);

        await resolveSelectedAttack(page);
        await expect.poll(async () => {
            const state = await game.getState();
            const defender = state?.core?.players?.['1'];
            return {
                phase: state?.sys?.phase ?? null,
                pendingAttack: state?.core?.pendingAttack ?? null,
                defenderHp: defender?.resources?.HP ?? defender?.resources?.hp ?? null,
                entangle: defender?.statusEffects?.entangle ?? defender?.tokens?.entangle ?? 0,
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'main2',
            pendingAttack: null,
            defenderHp: defenderHpBefore - expectedDamage,
            entangle: 1,
        });
        await screenshotStep(page, testInfo, '04-万箭齐发-伤害和缠绕已落地流程收口');
    });

    test('武僧雷霆万钧从技能触发到奖励骰重掷再到结算收口', async ({ page, game }, testInfo) => {
        test.setTimeout(150000);
        await clearEvidenceScreenshotsForTest(testInfo);

        await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
        await waitForDiceThroneHarness(page);
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                resources: { CP: 0, HP: 50 },
                tokens: { taiji: 2 },
            },
            player1: {
                resources: { CP: 0, HP: 50 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': 'monk', '1': 'barbarian' },
                hostStarted: true,
                activePlayerId: '0',
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: true,
                dice: [
                    { id: 0, value: 3, isKept: false },
                    { id: 1, value: 3, isKept: false },
                    { id: 2, value: 3, isKept: false },
                    { id: 3, value: 1, isKept: false },
                    { id: 4, value: 1, isKept: false },
                ],
                pendingAttack: null,
                pendingDamage: null,
                pendingBonusDiceSettlement: undefined,
            },
        });
        await ensureDebugPanelClosed(page);

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                diceValues: state?.core?.dice?.map((die: any) => die.value).slice(0, 5) ?? [],
                taiji: state?.core?.players?.['0']?.tokens?.taiji ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            phase: 'offensiveRoll',
            diceValues: [3, 3, 3, 1, 1],
            taiji: 2,
        });
        const thunderStrikeSlot = page
            .locator('[data-ability-slot][data-resolved-ability-id="thunder-strike"]')
            .first();
        await expect(thunderStrikeSlot).toBeVisible({ timeout: 10000 });
        await expect(thunderStrikeSlot).toHaveAttribute('data-can-click', 'true', { timeout: 10000 });
        await screenshotStep(page, testInfo, '01-雷霆万钧-三掌骰面已确认技能可选');

        await dispatch(page, 'SELECT_ABILITY', '0', { abilityId: 'thunder-strike' });
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                sourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'offensiveRoll',
            sourceAbilityId: 'thunder-strike',
        });
        await screenshotStep(page, testInfo, '02-雷霆万钧-技能已触发进入攻击结算');

        await setDiceThroneBonusDiceValues(page, [4, 5, 6]);
        await dispatch(page, 'ADVANCE_PHASE', '0');
        await expect.poll(async () => (await game.getState())?.sys?.phase ?? null, { timeout: 10000 }).toBe('defensiveRoll');
        await dispatch(page, 'ROLL_DICE', '1');
        await dispatch(page, 'CONFIRM_ROLL', '1');
        await dispatch(page, 'RESPONSE_PASS', '1');
        await dispatch(page, 'ADVANCE_PHASE', '1');

        const overlay = await waitForBonusOverlay(page);
        await expect(overlay.locator('[data-testid^="bonus-die-reroll-option-"]')).toHaveCount(3, { timeout: 5000 });
        await expect(overlay.getByRole('button', { name: /Confirm Damage|确认伤害|继续/i }).last())
            .toBeVisible({ timeout: 5000 });
        const openedSettlement = await game.getState();
        const defenderHpBefore = openedSettlement?.core?.players?.['1']?.resources?.HP
            ?? openedSettlement?.core?.players?.['1']?.resources?.hp
            ?? 50;
        await expect.poll(async () => {
            const state = await game.getState();
            const settlement = state?.core?.pendingBonusDiceSettlement;
            return {
                sourceAbilityId: settlement?.sourceAbilityId ?? null,
                diceCount: settlement?.dice?.length ?? 0,
                rerollCount: settlement?.rerollCount ?? null,
                maxRerollCount: settlement?.maxRerollCount ?? null,
                taiji: state?.core?.players?.['0']?.tokens?.taiji ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            sourceAbilityId: 'thunder-strike',
            diceCount: 3,
            rerollCount: 0,
            maxRerollCount: 1,
            taiji: 2,
        });
        await screenshotStep(page, testInfo, '03-雷霆万钧-奖励骰面板出现且可花太极重掷');

        await setDiceThroneBonusDiceValues(page, [2]);
        await page.getByTestId('bonus-die-reroll-option-0').click({ force: true });
        await expect.poll(async () => {
            const state = await game.getState();
            const settlement = state?.core?.pendingBonusDiceSettlement;
            return {
                rerollCount: settlement?.rerollCount ?? null,
                lastRerolledDieIndex: settlement?.lastRerolledDieIndex ?? null,
                diceValues: settlement?.dice?.map((die: any) => die.value) ?? [],
                taiji: state?.core?.players?.['0']?.tokens?.taiji ?? 0,
            };
        }, { timeout: 10000 }).toMatchObject({
            rerollCount: 1,
            lastRerolledDieIndex: 0,
            diceValues: [2, expect.any(Number), expect.any(Number)],
            taiji: 0,
        });
        await screenshotStep(page, testInfo, '04-雷霆万钧-重掷一颗后太极耗尽骰面更新');

        const beforeSettle = await game.getState();
        const expectedDamage = beforeSettle?.core?.pendingBonusDiceSettlement?.dice
            ?.reduce((sum: number, die: any) => sum + (die.value ?? 0), 0) ?? 0;
        await overlay.getByRole('button', { name: /Confirm Damage|确认伤害|继续/i }).last().click();
        await expect.poll(async () => {
            const state = await game.getState();
            const defender = state?.core?.players?.['1'];
            return {
                phase: state?.sys?.phase ?? null,
                pendingSettlement: state?.core?.pendingBonusDiceSettlement ?? null,
                pendingDamage: state?.core?.pendingDamage ?? null,
                defenderHp: defender?.resources?.HP ?? defender?.resources?.hp ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            phase: 'main2',
            pendingSettlement: null,
            pendingDamage: null,
            defenderHp: defenderHpBefore - expectedDamage,
        });
        await screenshotStep(page, testInfo, '05-雷霆万钧-确认后按重掷后点数造成伤害收口');
    });
});
