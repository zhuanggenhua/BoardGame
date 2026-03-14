/**
 * Watch Out / 濠电姰鍨归悥銏ゅ礃閳轰讲鍋撹椤潡宕奸崱妤€鏆欓柣?闂備胶绮〃鍫ュ箠閹捐鐤?E2E 婵犵數鍋炲娆擃敄閸儲鍎? *
 * 闂佽崵鍠愬ú鏍涘☉妯忕儤绻濋崘顏佹灃婵犮垼娉涢鍡涙嫃鐎ｎ喗鈷戦柣鎰靛墮缁€鍐煟椤撱垻鐣洪柡? * 1. 闂備胶鍘ч〃搴㈢濠婂懏宕插〒姘ｅ亾妤犵偛绉归獮姗€宕橀崣澶屾 Watch Out 闂備礁鎼崯鎶筋敊閹邦喗顫曟繝闈涙处閸庣喖鏌￠崘銊モ偓鍦不濞嗘挻鐓曢柟鐑樻尰缁惰尙鈧娲滈崰鎰般€冮妷鈺佺妞ゆ梻鈷堝Λ妤呮⒑? * 2. 闂備礁鎼Λ娆忣焽濞嗘挸鍚规い鏇楀亾鐎规洩缍侀、鏃堝礋閸偅绶梻浣告啞濮婄粯鎱ㄩ悽绋跨劦妞ゆ帒鍠氶崬鐑樼節绾版ê浜鹃梺璇叉捣椤㈠﹤鈻嶉弴鐑嗘富闁稿瞼鍋為弲顒勬倶閻愯泛浜归柣鐔哥箞楠炴牜鈧稒蓱椤ュ牓鏌℃担闈╁姛闁归濞€椤㈡稑鈽夊▎灞剧亙缂傚倷璁查崑鎾绘煟閹寸倖鎴﹀汲娴煎瓨鐓曢柟杈剧秵閸炴椽鏌熸笟鍨妞ゎ偁鍨介弫鎰板川椤栨粌鎹剁紓? * 3. P1 闂備胶鎳撻悘姘跺箰閹间礁鍚规い鎾跺枎缁剁偟鎲稿澶婄畺闊洦鏌ㄧ欢鐐垫喐瀹ュ鏄ラ柛鏇ㄥ灠缁秹鎮规担鍛婅础缂佲偓婵? 闂備礁鎲￠悷顖涚濠婂懓濮抽柡灞诲劜閸庢垿鎮楅敐搴濈盎闁绘挸鍊块弻娑樜旂€ｎ剛锛熸繝鈷€鍕疄闁诡啫鍥ㄥ仭闁哄瀵у▍銏ゆ⒑閹稿海鈽夊┑鍌涙⒒缁厽寰勭€ｎ偄鍔呴梺鍝勫暙閻楀棗鈻嶉姀鐙€鐔嗛悹楦挎鑲栧┑鐘亾闁告稒娼欑粈?bonus overlay
 */

import { test, expect } from './framework';
import type { Locator, Page } from '@playwright/test';
import { BARBARIAN_CARDS } from '../src/games/dicethrone/heroes/barbarian/cards';
import {
    advanceToOffensiveRoll,
    applyCoreStateDirect,
    disableFabMenu,
    ensureDebugPanelClosed,
    readyAndStartGame,
    readCoreState,
    selectCharacter,
    setupDTOnlineMatch,
    waitForGameBoard,
} from './helpers/dicethrone';
import { waitForTestHarness } from './helpers/common';

const DICETHRONE_OPEN_TIMEOUT_MS = 120000;
const DICETHRONE_TEST_TIMEOUT_MS = 180000;
const DICETHRONE_ONLINE_TEST_TIMEOUT_MS = 240000;

async function expectMinBoundingBox(locator: Locator, label: string, minWidth: number, minHeight: number): Promise<void> {
    const box = await locator.boundingBox();
    expect(box, `${label} should have bounding box`).not.toBeNull();
    expect(box!.width, `${label} width`).toBeGreaterThanOrEqual(minWidth);
    expect(box!.height, `${label} height`).toBeGreaterThanOrEqual(minHeight);
}

async function expectMaxBoundingBox(locator: Locator, label: string, maxWidth: number, maxHeight: number): Promise<void> {
    const box = await locator.boundingBox();
    expect(box, `${label} should have bounding box`).not.toBeNull();
    expect(box!.width, `${label} width`).toBeLessThanOrEqual(maxWidth);
    expect(box!.height, `${label} height`).toBeLessThanOrEqual(maxHeight);
}

async function expectElementInsideViewport(
    locator: Locator,
    label: string,
    viewportWidth: number,
    viewportHeight: number,
): Promise<void> {
    const box = await locator.boundingBox();
    expect(box, `${label} should have bounding box`).not.toBeNull();
    expect(box!.x, `${label} left edge`).toBeGreaterThanOrEqual(0);
    expect(box!.y, `${label} top edge`).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, `${label} right edge`).toBeLessThanOrEqual(viewportWidth + 1);
    expect(box!.y + box!.height, `${label} bottom edge`).toBeLessThanOrEqual(viewportHeight + 1);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
    const metrics = await page.evaluate(() => {
        const root = document.getElementById('root');
        const gamePage = document.querySelector('[data-game-page="true"]');
        const shell = document.querySelector('.mobile-board-shell');
        const shellRect = shell ? shell.getBoundingClientRect() : null;
        return {
            innerWidth: window.innerWidth,
            docScrollWidth: document.documentElement.scrollWidth,
            bodyScrollWidth: document.body.scrollWidth,
            rootScrollWidth: root ? root.scrollWidth : null,
            gamePageClientWidth: gamePage ? gamePage.clientWidth : null,
            shellRect: shellRect
                ? { left: shellRect.left, right: shellRect.right, width: shellRect.width }
                : null,
        };
    });

    const maxAllowed = metrics.innerWidth + 1;
    expect(metrics.docScrollWidth, 'documentElement should not overflow horizontally').toBeLessThanOrEqual(maxAllowed);
    expect(metrics.bodyScrollWidth, 'body should not overflow horizontally').toBeLessThanOrEqual(maxAllowed);
    if (metrics.rootScrollWidth !== null) {
        expect(metrics.rootScrollWidth, '#root should not overflow horizontally').toBeLessThanOrEqual(maxAllowed);
    }
    if (metrics.shellRect && metrics.gamePageClientWidth !== null) {
        expect(metrics.shellRect.left, 'mobile board shell left edge should stay in viewport').toBeGreaterThanOrEqual(-1);
        expect(metrics.shellRect.right, 'mobile board shell right edge should stay in viewport')
            .toBeLessThanOrEqual(metrics.gamePageClientWidth + 1);
    }
}

test('self watch out should show bonus die spotlight', async ({ page, game }, testInfo) => {
    test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

    await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);

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
        'bonusDie.effect.watchOut.bow': /(Bow.*\+2 Damage|\+2\s*Damage)/i,
        'bonusDie.effect.watchOut.foot': /(Foot.*Inflict Entangle|Inflict Entangle|Entangle)/i,
        'bonusDie.effect.watchOut.moon': /(Moon.*Inflict Blinded|Inflict Blinded|Blinded)/i,
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

test('crit bonus damage should not show attack-modifier badge', async ({ page, game }, testInfo) => {
    test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

    await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);

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

test('me too copy mode should allow locked source and target dice', async ({ page, game }, testInfo) => {
    test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

    await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);

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

test('opponent lucky card should only show card spotlight for viewer', async ({ browser }, testInfo) => {
    test.setTimeout(DICETHRONE_ONLINE_TEST_TIMEOUT_MS);

    const baseURL = testInfo.project.use.baseURL as string | undefined;
    const setup = await setupDTOnlineMatch(browser, baseURL);
    if (!setup) {
        test.skip(true, 'online setup unavailable in current environment');
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
            throw new Error('闂備礁鎼悧婊勭濠靛洨鐝舵慨妞诲亾鐎?card-lucky');
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

test('mobile narrow viewport should keep magnify entries visible and clickable', async ({ page, game }, testInfo) => {
    test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

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

    await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
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
    await disableFabMenu(page);

    const playerBoardMagnifyButton = page.locator('[data-testid="player-board-magnify-button"]');
    const discardPileInspectButton = page.locator('[data-testid="discard-pile-inspect-button"]');
    const autoResponseToggle = page.locator('[data-testid="auto-response-toggle"]');
    const boardMagnifyOverlay = page.locator('[data-testid="board-magnify-overlay"]');
    const diceFaces = page.locator('[data-testid="dice-3d"]');
    const rollButton = page.locator('[data-tutorial-id="dice-roll-button"]');
    const confirmButton = page.locator('[data-tutorial-id="dice-confirm-button"]');

    await expect(playerBoardMagnifyButton).toHaveCSS('opacity', '1');
    await expect(discardPileInspectButton).toHaveCSS('opacity', '1');
    await expectMinBoundingBox(playerBoardMagnifyButton, 'player board magnify button', 18, 18);
    await expectMinBoundingBox(discardPileInspectButton, 'discard pile inspect button', 14, 14);
    await expectMaxBoundingBox(playerBoardMagnifyButton, 'player board magnify button', 24, 24);
    await expectMaxBoundingBox(discardPileInspectButton, 'discard pile inspect button', 18, 18);
    await expectMaxBoundingBox(autoResponseToggle, 'auto response toggle', 88, 26);
    await expectMaxBoundingBox(rollButton, 'roll button', 44, 24);
    await expectMaxBoundingBox(confirmButton, 'confirm button', 44, 24);
    await expect(diceFaces).toHaveCount(5, { timeout: 5000 });
    await expectNoHorizontalOverflow(page);
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    await expectElementInsideViewport(playerBoardMagnifyButton, 'player board magnify button', viewport!.width, viewport!.height);
    await expectElementInsideViewport(discardPileInspectButton, 'discard pile inspect button', viewport!.width, viewport!.height);
    await expectElementInsideViewport(rollButton, 'roll button', viewport!.width, viewport!.height);
    await expectElementInsideViewport(confirmButton, 'confirm button', viewport!.width, viewport!.height);

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

test('mobile long press hand card should open magnify without playing card', async ({ page, game }, testInfo) => {
    test.setTimeout(DICETHRONE_TEST_TIMEOUT_MS);

    await page.setViewportSize({ width: 812, height: 375 });
    await game.openTestGame('dicethrone', {}, DICETHRONE_OPEN_TIMEOUT_MS);
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

    await page.waitForFunction(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        return state?.sys?.phase === 'offensiveRoll'
            && state?.core?.activePlayerId === '0'
            && state?.core?.players?.['0']?.hand?.some((card: any) => card.id === 'watch-out');
    }, { timeout: 10000, polling: 200 });

    await ensureDebugPanelClosed(page);
    await disableFabMenu(page);

    const handCard = page.locator('[data-testid="hand-area"] [data-card-id="watch-out"]').first();
    const boardMagnifyOverlay = page.locator('[data-testid="board-magnify-overlay"]');

    await expect(handCard).toBeVisible({ timeout: 5000 });
    await expect(handCard).toHaveAttribute('data-is-flipped', 'true');

    const box = await handCard.boundingBox();
    expect(box, 'hand card should provide touch coordinates').not.toBeNull();
    const clientX = box!.x + box!.width / 2;
    const clientY = box!.y + box!.height / 2;

    await handCard.dispatchEvent('pointerdown', {
        bubbles: true,
        pointerId: 1,
        pointerType: 'touch',
        clientX,
        clientY,
    });
    await page.waitForTimeout(520);
    await handCard.dispatchEvent('pointerup', {
        bubbles: true,
        pointerId: 1,
        pointerType: 'touch',
        clientX,
        clientY,
    });

    await expect(boardMagnifyOverlay).toBeVisible({ timeout: 5000 });
    await game.screenshot('13-mobile-hand-long-press-magnify-open', testInfo);

    const stateAfterLongPress = await page.evaluate(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        return {
            handIds: state?.core?.players?.['0']?.hand?.map((card: any) => card.id) ?? [],
        };
    });
    expect(stateAfterLongPress.handIds).toContain('watch-out');
});
