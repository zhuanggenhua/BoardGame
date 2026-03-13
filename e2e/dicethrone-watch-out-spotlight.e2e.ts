/**
 * Watch Out / 大吉大利 特写 E2E 测试
 *
 * 覆盖三条链路：
 * 1. 自己打出 Watch Out 时，应看到单骰特写
 * 2. 暴击只增加总伤害时，不应错误显示攻击修正徽章
 * 3. P1 打出大吉大利时，P0 只应看到卡牌特写，不应重复看到 bonus overlay
 */

import { test, expect } from './framework';
import type { Locator } from '@playwright/test';
import { BARBARIAN_CARDS } from '../src/games/dicethrone/heroes/barbarian/cards';
import {
    advanceToOffensiveRoll,
    applyCoreStateDirect,
    ensureDebugPanelClosed,
    readyAndStartGame,
    readCoreState,
    selectCharacter,
    setupDTOnlineMatch,
    waitForGameBoard,
} from './helpers/dicethrone';
import { waitForTestHarness } from './helpers/common';

async function expectMinBoundingBox(locator: Locator, label: string, minWidth: number, minHeight: number): Promise<void> {
    const box = await locator.boundingBox();
    expect(box, `${label} 应可见`).not.toBeNull();
    expect(box!.width, `${label} 宽度过小`).toBeGreaterThanOrEqual(minWidth);
    expect(box!.height, `${label} 高度过小`).toBeGreaterThanOrEqual(minHeight);
}

test('自己打出 Watch Out 应显示骰子特写', async ({ page, game }, testInfo) => {
    test.setTimeout(60000);

    await game.openTestGame('dicethrone', {}, 30000);

    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            hand: ['watch-out'],
            resources: { CP: 2, HP: 50 },
        },
        player1: {
            resources: { HP: 50 },
        },
        currentPlayer: '0',
        phase: 'offensiveRoll',
        extra: {
            selectedCharacters: { '0': 'moon_elf', '1': 'barbarian' },
            hostStarted: true,
            rollCount: 1,
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
                isDefendable: true,
                damage: 5,
                bonusDamage: 0,
            },
        },
    });

    await page.waitForFunction(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
        return state?.sys?.phase === 'offensiveRoll'
            && state?.core?.activePlayerId === '0'
            && state?.core?.players?.['0']?.hand?.some((card: any) => card.id === 'watch-out');
    }, { timeout: 10000 });

    await game.screenshot('01-initial-state', testInfo);

    const handArea = page.locator('[data-testid="hand-area"]');
    const handCards = handArea.locator('[data-card-id]');
    await expect(handCards).toHaveCount(1, { timeout: 10000 });

    const watchOutCard = page.locator('[data-card-id="watch-out"]').first();
    await watchOutCard.waitFor({ state: 'visible', timeout: 10000 });
    await watchOutCard.click();

    const bonusDieOverlay = page.locator('[data-testid="bonus-die-overlay"]');
    await expect(bonusDieOverlay).toBeVisible({ timeout: 2000 });

    const afterClickState = await page.evaluate(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
        const entries = state?.sys?.eventStream?.entries ?? [];
        const bonusDieEvent = [...entries].reverse().find((entry: any) => entry.event?.type === 'BONUS_DIE_ROLLED');
        return {
            player0Hand: state?.core?.players?.['0']?.hand?.map((card: any) => card.id),
            lastEventTypes: entries.slice(-4).map((entry: any) => entry.event?.type),
            bonusDieEffectKey: bonusDieEvent?.event?.payload?.effectKey,
        };
    });

    const expectedOverlayTextByEffectKey: Record<string, RegExp> = {
        'bonusDie.effect.watchOut.bow': /(Bow🎯: \+2 Damage|弓🎯：伤害\+2)/,
        'bonusDie.effect.watchOut.foot': /(Foot🦶: Inflict Entangle|足🦶：施加缠绕)/,
        'bonusDie.effect.watchOut.moon': /(Moon🌙: Inflict Blinded|月🌙：施加致盲)/,
    };

    expect(afterClickState.bonusDieEffectKey).toMatch(/^bonusDie\.effect\.watchOut\.(bow|foot|moon)$/);
    await expect(
        bonusDieOverlay,
    ).toContainText(expectedOverlayTextByEffectKey[afterClickState.bonusDieEffectKey], { timeout: 5000 });

    await game.screenshot('02-after-play-card', testInfo);
    await game.screenshot('03-final-state', testInfo);

    expect(afterClickState.player0Hand).not.toContain('watch-out');
    expect(afterClickState.lastEventTypes).toContain('BONUS_DIE_ROLLED');
});

test('暴击只增加总伤害，不应显示攻击修正伤害徽章', async ({ page, game }, testInfo) => {
    test.setTimeout(60000);

    await game.openTestGame('dicethrone', {}, 30000);

    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: {
                CP: 3,
                HP: 11,
            },
            tokens: {
                crit: 0,
                accuracy: 0,
                protect: 0,
                retribution: 0,
                blessing_of_divinity: 0,
                tithes_upgraded: 0,
            },
        },
        player1: {
            resources: {
                CP: 1,
                HP: 26,
            },
        },
        currentPlayer: '0',
        phase: 'defensiveRoll',
        extra: {
            selectedCharacters: { '0': 'paladin', '1': 'moon_elf' },
            hostStarted: true,
            rollCount: 1,
            rollConfirmed: true,
            dice: [
                { id: 0, value: 4, isKept: false },
                { id: 1, value: 5, isKept: false },
                { id: 2, value: 2, isKept: false },
                { id: 3, value: 2, isKept: false },
                { id: 4, value: 3, isKept: false },
            ],
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                isDefendable: true,
                sourceAbilityId: 'holy-strike-2-small',
                damageResolved: false,
                resolvedDamage: 0,
                preDefenseResolved: true,
                offensiveRollEndTokenResolved: true,
                bonusDamage: 4,
                attackModifierBonusDamage: 0,
            },
        },
    });

    await page.waitForFunction(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
        return state?.sys?.phase === 'defensiveRoll'
            && state?.core?.pendingAttack?.bonusDamage === 4
            && state?.core?.pendingAttack?.attackModifierBonusDamage === 0;
    }, { timeout: 10000 });

    await page.waitForTimeout(1000);

    const badge = page.locator('[data-testid="attack-modifier-bonus-badge"]');
    await expect(badge).toHaveCount(0);

    const uiState = await page.evaluate(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
        return {
            phase: state?.sys?.phase,
            bonusDamage: state?.core?.pendingAttack?.bonusDamage ?? null,
            attackModifierBonusDamage: state?.core?.pendingAttack?.attackModifierBonusDamage ?? null,
            badgeCount: document.querySelectorAll('[data-testid="attack-modifier-bonus-badge"]').length,
        };
    });

    expect(uiState.phase).toBe('defensiveRoll');
    expect(uiState.bonusDamage).toBe(4);
    expect(uiState.attackModifierBonusDamage).toBe(0);
    expect(uiState.badgeCount).toBe(0);

    await game.screenshot('06-crit-no-attack-modifier-badge', testInfo);
});

test('俺也一样 copy 模式应允许选择已锁定骰子作为源和目标', async ({ page, game }, testInfo) => {
    test.setTimeout(60000);

    await game.openTestGame('dicethrone', {}, 30000);

    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            hand: ['card-me-too', 'card-me-too'],
            resources: {
                cp: 3,
                hp: 1,
            },
        },
        player1: {
            resources: {
                cp: 2,
                hp: 16,
            },
        },
        currentPlayer: '0',
        phase: 'offensiveRoll',
        extra: {
            selectedCharacters: { '0': 'moon_elf', '1': 'paladin' },
            hostStarted: true,
            rollCount: 3,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: false,
            pendingAttack: null,
            dice: [
                { id: 0, value: 6, isKept: true },
                { id: 1, value: 5, isKept: true },
                { id: 2, value: 4, isKept: false },
                { id: 3, value: 2, isKept: false },
                { id: 4, value: 3, isKept: false },
            ],
        },
    });

    await page.waitForFunction(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
        return state?.sys?.phase === 'offensiveRoll'
            && state?.core?.players?.['0']?.hand?.filter((card: any) => card.id === 'card-me-too').length === 2
            && state?.core?.dice?.[0]?.isKept === true
            && state?.core?.dice?.[1]?.isKept === true;
    }, { timeout: 10000 });

    const dice = page.locator('[data-testid="die"]');
    await expect(dice).toHaveCount(5);
    const dieButtons = Array.from({ length: 5 }, (_, index) => page.locator(`[data-testid="die-button-${index}"]`));

    const firstCopyCard = page.locator('[data-card-id="card-me-too"]').first();
    await expect(firstCopyCard).toHaveAttribute('data-is-flipped', 'true');
    await expect(firstCopyCard).toHaveAttribute('data-can-drag', 'true');
    await firstCopyCard.click({ force: true });

    await page.waitForFunction(() => {
        const interaction = (window as any).__BG_TEST_HARNESS__?.state?.get()?.sys?.interaction?.current;
        return interaction?.data?.meta?.dtType === 'modifyDie'
            && interaction?.data?.meta?.dieModifyConfig?.mode === 'copy';
    }, { timeout: 5000 });

    await dieButtons[0].click();
    await expect(dieButtons[0]).toHaveAttribute('data-selected', 'true', { timeout: 5000 });
    await expect(dieButtons[0]).toHaveAttribute('data-display-value', '6');

    await dieButtons[3].click();

    await page.waitForFunction(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
        return state?.core?.dice?.[3]?.value === 6
            && state?.core?.players?.['0']?.hand?.filter((card: any) => card.id === 'card-me-too').length === 1;
    }, { timeout: 5000 });

    const secondCopyCard = page.locator('[data-card-id="card-me-too"]').first();
    await expect(secondCopyCard).toHaveAttribute('data-is-flipped', 'true');
    await expect(secondCopyCard).toHaveAttribute('data-can-drag', 'true');
    await secondCopyCard.click({ force: true });

    await page.waitForFunction(() => {
        const interaction = (window as any).__BG_TEST_HARNESS__?.state?.get()?.sys?.interaction?.current;
        return interaction?.data?.meta?.dtType === 'modifyDie'
            && interaction?.data?.meta?.dieModifyConfig?.mode === 'copy';
    }, { timeout: 5000 });

    await dieButtons[4].click();
    await expect(dieButtons[4]).toHaveAttribute('data-selected', 'true', { timeout: 5000 });
    await expect(dieButtons[4]).toHaveAttribute('data-display-value', '3');

    await dieButtons[1].click();

    await page.waitForFunction(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
        return state?.core?.dice?.[1]?.value === 3
            && state?.core?.players?.['0']?.hand?.filter((card: any) => card.id === 'card-me-too').length === 0;
    }, { timeout: 5000 });

    const finalState = await page.evaluate(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
        return {
            diceValues: (state?.core?.dice ?? []).map((die: any) => die.value),
            keptFlags: (state?.core?.dice ?? []).map((die: any) => die.isKept),
            handIds: (state?.core?.players?.['0']?.hand ?? []).map((card: any) => card.id),
        };
    });

    expect(finalState.diceValues).toEqual([6, 3, 4, 6, 3]);
    expect(finalState.keptFlags).toEqual([true, true, false, false, false]);
    expect(finalState.handIds).not.toContain('card-me-too');

    await game.screenshot('07-me-too-locked-dice-copy', testInfo);
});

test('P1 打出大吉大利时，P0 只应看到卡牌特写，不应重复看到多骰 overlay', async ({ browser }, testInfo) => {
    test.setTimeout(120000);

    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const setup = await setupDTOnlineMatch(browser, baseURL);
    if (!setup) {
        test.skip(true, '游戏服务器不可用或房间创建失败');
        return;
    }

    const { hostPage, guestPage, hostContext, guestContext } = setup;

    try {
        await selectCharacter(hostPage, 'moon_elf');
        await selectCharacter(guestPage, 'barbarian');
        await readyAndStartGame(hostPage, guestPage);
        await waitForGameBoard(hostPage);
        await waitForGameBoard(guestPage);
        await waitForTestHarness(hostPage, 10000);
        await waitForTestHarness(guestPage, 10000);
        await advanceToOffensiveRoll(hostPage);

        const coreState = await readCoreState(hostPage) as Record<string, any>;
        const luckyCard = BARBARIAN_CARDS.find(card => card.id === 'card-lucky');
        if (!luckyCard) {
            throw new Error('未找到 card-lucky');
        }

        const injectedCore = JSON.parse(JSON.stringify(coreState));
        injectedCore.activePlayerId = '1';
        injectedCore.rollCount = 1;
        injectedCore.rollConfirmed = true;
        injectedCore.dice = [
            { id: 0, value: 1, isKept: false, playerId: '1' },
            { id: 1, value: 2, isKept: false, playerId: '1' },
            { id: 2, value: 3, isKept: false, playerId: '1' },
            { id: 3, value: 4, isKept: false, playerId: '1' },
            { id: 4, value: 5, isKept: false, playerId: '1' },
        ];
        injectedCore.pendingAttack = {
            attackerId: '1',
            defenderId: '0',
            isDefendable: true,
            damage: 5,
            bonusDamage: 0,
        };
        injectedCore.pendingBonusDiceSettlement = undefined;
        injectedCore.players['0'].resources.CP = 2;
        injectedCore.players['0'].resources.HP = 50;
        injectedCore.players['1'].resources.CP = 3;
        injectedCore.players['1'].resources.HP = 40;
        injectedCore.players['1'].hand = [JSON.parse(JSON.stringify(luckyCard))];

        await applyCoreStateDirect(hostPage, injectedCore);
        await ensureDebugPanelClosed(hostPage);
        await ensureDebugPanelClosed(guestPage);

        await guestPage.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
            return state?.sys?.phase === 'offensiveRoll'
                && state?.core?.activePlayerId === '1'
                && state?.core?.players?.['1']?.hand?.some((card: any) => card.id === 'card-lucky');
        }, { timeout: 15000 });

        await hostPage.screenshot({
            path: testInfo.outputPath('04-p0-before-p1-play-lucky.png'),
            fullPage: false,
        });

        const luckyCardInHand = guestPage.locator('[data-card-id="card-lucky"]').first();
        await expect(luckyCardInHand).toBeVisible({ timeout: 10000 });
        await luckyCardInHand.click();

        const hostCardSpotlight = hostPage.locator('[data-testid="card-spotlight-overlay"]');
        await expect(hostCardSpotlight).toBeVisible({ timeout: 15000 });
        await expect(hostPage.locator('[data-testid="card-spotlight-die"]')).toHaveCount(3, { timeout: 15000 });

        await hostPage.waitForTimeout(1200);

        const visibleBonusOverlayCount = await hostPage
            .locator('[data-testid="bonus-die-overlay"]')
            .evaluateAll((nodes) => nodes.filter((node) => {
                const element = node as HTMLElement;
                const style = window.getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                return style.display !== 'none'
                    && style.visibility !== 'hidden'
                    && rect.width > 0
                    && rect.height > 0;
            }).length);
        expect(visibleBonusOverlayCount).toBe(0);

        const overlayState = await hostPage.evaluate(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get();
            return {
                lastEventTypes: (state?.sys?.eventStream?.entries ?? []).slice(-8).map((entry: any) => entry.event?.type),
                pendingBonusDiceSettlement: state?.core?.pendingBonusDiceSettlement
                    ? {
                        id: state.core.pendingBonusDiceSettlement.id,
                        attackerId: state.core.pendingBonusDiceSettlement.attackerId,
                        diceCount: state.core.pendingBonusDiceSettlement.dice?.length ?? 0,
                        displayOnly: state.core.pendingBonusDiceSettlement.displayOnly,
                    }
                    : null,
            };
        });

        expect(overlayState.lastEventTypes).toContain('CARD_PLAYED');
        expect(overlayState.lastEventTypes.filter((type) => type === 'BONUS_DIE_ROLLED')).toHaveLength(4);
        expect(overlayState.lastEventTypes).not.toContain('BONUS_DICE_REROLL_REQUESTED');
        expect(overlayState.pendingBonusDiceSettlement).toBeNull();

        await hostPage.screenshot({
            path: testInfo.outputPath('05-p0-after-p1-play-lucky-no-duplicate-overlay.png'),
            fullPage: false,
        });
    } finally {
        await guestContext.close();
        await hostContext.close();
    }
});

test('触控窄视口下放大入口常显且可点击', async ({ page, game }, testInfo) => {
    test.setTimeout(60000);

    await page.setViewportSize({ width: 812, height: 375 });
    await page.addInitScript((query: string) => {
        const originalMatchMedia = window.matchMedia.bind(window);
        window.matchMedia = ((media: string) => {
            if (media !== query) {
                return originalMatchMedia(media);
            }

            return {
                matches: true,
                media,
                onchange: null,
                addListener: () => {},
                removeListener: () => {},
                addEventListener: () => {},
                removeEventListener: () => {},
                dispatchEvent: () => true,
            } as MediaQueryList;
        }) as typeof window.matchMedia;
    }, '(pointer: coarse)');

    await game.openTestGame('dicethrone', {}, 30000);
    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: { CP: 2, HP: 50 },
            discard: ['watch-out'],
        },
        player1: {
            resources: { HP: 50 },
        },
        currentPlayer: '0',
        phase: 'offensiveRoll',
        extra: {
            selectedCharacters: { '0': 'moon_elf', '1': 'barbarian' },
            hostStarted: true,
            rollCount: 1,
            rollConfirmed: false,
            dice: [
                { id: 0, value: 1, isKept: false },
                { id: 1, value: 2, isKept: false },
                { id: 2, value: 3, isKept: false },
                { id: 3, value: 4, isKept: false },
                { id: 4, value: 5, isKept: false },
            ],
        },
    });

    await page.waitForFunction(
        () => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return window.innerWidth === 812
                && window.matchMedia('(pointer: coarse)').matches
                && state?.sys?.phase === 'offensiveRoll'
                && (state?.core?.players?.['0']?.discard?.length ?? 0) === 1;
        },
        { timeout: 10000, polling: 200 },
    );
    await ensureDebugPanelClosed(page);
    await page.evaluate(() => {
        const debugToggleContainer = document.querySelector('[data-testid="debug-toggle-container"]') as HTMLElement | null;
        if (!debugToggleContainer) return;
        debugToggleContainer.style.pointerEvents = 'none';
        debugToggleContainer.style.opacity = '0';
    });

    const playerBoardMagnifyButton = page.locator('[data-testid="player-board-magnify-button"]');
    const discardPileInspectButton = page.locator('[data-testid="discard-pile-inspect-button"]');
    const boardMagnifyOverlay = page.locator('[data-testid="board-magnify-overlay"]');
    const diceTray = page.locator('[data-tutorial-id="dice-tray"]');
    const diceFaces = page.locator('[data-testid="dice-3d"]');
    const rollButton = page.locator('[data-tutorial-id="dice-roll-button"]');
    const confirmButton = page.locator('[data-tutorial-id="dice-confirm-button"]');

    await expect(playerBoardMagnifyButton).toHaveCSS('opacity', '1');
    await expect(discardPileInspectButton).toHaveCSS('opacity', '1');
    await expectMinBoundingBox(playerBoardMagnifyButton, '玩家面板放大按钮', 40, 40);
    await expectMinBoundingBox(discardPileInspectButton, '弃牌堆查看按钮', 40, 40);
    await expect(diceFaces).toHaveCount(5, { timeout: 5000 });
    await expectMinBoundingBox(diceTray, '骰盘', 56, 140);
    await expectMinBoundingBox(diceFaces.first(), '单个骰子', 24, 24);
    await expectMinBoundingBox(rollButton, '投掷按钮', 44, 28);
    await expectMinBoundingBox(confirmButton, '确认按钮', 44, 28);

    await game.screenshot('10-mobile-main-board-state', testInfo);

    await playerBoardMagnifyButton.click();
    await expect(boardMagnifyOverlay).toBeVisible({ timeout: 5000 });
    await game.screenshot('11-mobile-player-board-magnify-open', testInfo);

    await boardMagnifyOverlay.click({ position: { x: 10, y: 10 } });
    await expect(boardMagnifyOverlay).toBeHidden({ timeout: 5000 });

    await discardPileInspectButton.click();
    await expect(boardMagnifyOverlay).toBeVisible({ timeout: 5000 });
    await expect(
        boardMagnifyOverlay.locator('img[alt="Card Preview"], .atlas-shimmer, [style*="background-image"]').first(),
    ).toBeVisible({ timeout: 5000 });
    await game.screenshot('12-mobile-discard-pile-inspect-open', testInfo);
});
