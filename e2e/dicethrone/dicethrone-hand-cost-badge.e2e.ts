import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import {
    ensureDebugPanelClosed,
    disableFabMenu,
    setDiceThroneBonusDiceValues,
} from '../helpers/dicethrone';
import { waitForTestHarness } from '../helpers/common';
import { TOKEN_IDS } from '../../src/games/dicethrone/domain/ids';
import { settleCurrentBonusDice } from './bonus-dice-flow';

type HandCardSnapshot = {
    id?: string;
};

const DICETHRONE_OPEN_TIMEOUT_MS = 180000;

const saveEvidenceScreenshot = async (
    page: Page,
    testInfo: TestInfo,
    name: string,
) => {
    const path = getEvidenceScreenshotPath(testInfo, name, {
        filename: `${name}.png`,
    });
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: false });
    return path;
};

const waitForHandCardVisualReady = async (page: Page, cardIds: string[]) => {
    await page.waitForFunction((expectedCardIds) => {
        const handArea = document.querySelector('[data-testid="hand-area"]');
        if (!handArea) return false;
        return (expectedCardIds as string[]).every((cardId) => {
            const card = handArea.querySelector(`[data-card-id="${cardId}"]`);
            return card?.getAttribute('data-is-flipped') === 'true'
                && card.querySelector('[data-testid="dt-hand-card-cost"]');
        });
    }, cardIds, { timeout: 15000, polling: 100 });
    await page.waitForTimeout(800);
};

const waitForVisibleSelector = async (
    page: Page,
    selector: string,
    timeout = 4000,
) => {
    await page.waitForFunction((query) => {
        return Array.from(document.querySelectorAll(query)).some((element) => {
            const htmlElement = element as HTMLElement;
            const rect = htmlElement.getBoundingClientRect();
            const style = window.getComputedStyle(htmlElement);
            return rect.width > 0
                && rect.height > 0
                && style.display !== 'none'
                && style.visibility !== 'hidden'
                && style.opacity !== '0';
        });
    }, selector, { timeout, polling: 100 });
};

const forceManualResponseEnabled = async (page: Page) => {
    await page.evaluate(() => {
        localStorage.setItem('dicethrone:autoResponse', 'true');
    });
};

const readVisibleDamageFloatCenters = async (page: Page) => page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-floating-text-preset="dicethrone-damage"]'))
        .map((element) => {
            const htmlElement = element as HTMLElement;
            const rect = htmlElement.getBoundingClientRect();
            const style = window.getComputedStyle(htmlElement);
            return {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
                text: htmlElement.textContent?.trim() ?? '',
                visible: rect.width > 0
                    && rect.height > 0
                    && style.display !== 'none'
                    && style.visibility !== 'hidden'
                    && style.opacity !== '0',
            };
        })
        .filter((entry) => entry.visible);
});

const injectSamuraiTokenResponseScene = async (
    page: Page,
    options: {
        mode: 'samurai-retribution';
        incomingDamage?: number;
        bonusDiceValues?: number[];
    },
) => {
    await page.evaluate(async ({ mode, incomingDamage }) => {
        const harness = (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => Record<string, unknown> | null;
                    set?: (state: Record<string, unknown>) => void;
                };
            };
        }).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        if (!harness || !state || !harness.state?.set) {
            throw new Error('TestHarness state not ready');
        }

        const damage = incomingDamage ?? 5;
        const random = {
            random: () => 0.5,
            d: (max: number) => Math.min(max, 1),
            range: (min: number) => min,
            shuffle: <T,>(array: T[]) => [...array],
        };

        const [{ initHeroState, ALL_TOKEN_DEFINITIONS }, { TOKEN_IDS: LocalTokenIds }] = await Promise.all([
            import('/src/games/dicethrone/domain/characters.ts'),
            import('/src/games/dicethrone/domain/ids.ts'),
        ]);

        const samuraiBase = initHeroState('0', 'samurai', random as never);
        const opponentBase = initHeroState('1', 'paladin', random as never);

        harness.state.set({
            ...state,
            sys: {
                ...(state.sys as Record<string, unknown>),
                phase: 'offensiveRoll',
                interaction: {
                    current: {
                        id: `dt-token-response-samurai-${mode}-window`,
                        kind: 'dt:token-response',
                        playerId: '0',
                        data: null,
                    },
                    queue: [],
                },
                responseWindow: {
                    ...(((state.sys as Record<string, unknown>).responseWindow as Record<string, unknown>) ?? {}),
                    current: {
                        id: `samurai-${mode}-response-window`,
                        sourceId: `pending-damage:${mode}`,
                        windowType: 'afterAttackResolved',
                        responderQueue: ['0'],
                        currentResponderIndex: 0,
                        passedPlayers: [],
                    },
                },
            },
            core: {
                ...(state.core as Record<string, unknown>),
                activePlayerId: '1',
                hostStarted: true,
                tokenDefinitions: ALL_TOKEN_DEFINITIONS,
                selectedCharacters: {
                    ...(((state.core as Record<string, unknown>).selectedCharacters as Record<string, unknown>) ?? {}),
                    '0': 'samurai',
                    '1': 'paladin',
                },
                rollCount: 1,
                rollConfirmed: true,
                dice: [
                    { id: 0, value: 1, isKept: false, playerId: '1' },
                    { id: 1, value: 2, isKept: false, playerId: '1' },
                    { id: 2, value: 3, isKept: false, playerId: '1' },
                    { id: 3, value: 4, isKept: false, playerId: '1' },
                    { id: 4, value: 5, isKept: false, playerId: '1' },
                ],
                players: {
                    ...(((state.core as Record<string, unknown>).players as Record<string, unknown>) ?? {}),
                    '0': {
                        ...samuraiBase,
                        hand: [],
                        discard: [],
                        resources: {
                            ...samuraiBase.resources,
                            cp: 2,
                            hp: 50,
                        },
                        tokens: {
                            ...samuraiBase.tokens,
                            [LocalTokenIds.HONOR]: 0,
                            [LocalTokenIds.SHAME]: 0,
                            [LocalTokenIds.SAMURAI_RETRIBUTION]: mode === 'samurai-retribution' ? 1 : 0,
                        },
                    },
                    '1': {
                        ...opponentBase,
                        hand: [],
                        discard: [],
                        resources: {
                            ...opponentBase.resources,
                            cp: 2,
                            hp: 50,
                        },
                    },
                },
                pendingAttack: {
                    attackerId: '1',
                    defenderId: '0',
                    isDefendable: true,
                    sourceAbilityId: 'revolver',
                    damage,
                    bonusDamage: 0,
                    attackModifierBonusDamage: 0,
                    damageResolved: false,
                    resolvedDamage: 0,
                    preDefenseResolved: false,
                    offensiveRollEndTokenResolved: false,
                },
                pendingDamage: {
                    id: `samurai-${mode}-window`,
                    sourcePlayerId: '1',
                    targetPlayerId: '0',
                    originalDamage: damage,
                    currentDamage: damage,
                    sourceAbilityId: 'revolver',
                    responseType: 'beforeDamageReceived',
                    responderId: '0',
                    isFullyEvaded: false,
                },
            },
        });
        (window as Window & { __BG_LAST_COMMAND_REJECTED__?: unknown }).__BG_LAST_COMMAND_REJECTED__ = null;
    }, options);

    if (Array.isArray(options.bonusDiceValues) && options.bonusDiceValues.length > 0) {
        await setDiceThroneBonusDiceValues(page, options.bonusDiceValues);
    }
};

const waitForSamuraiTokenResponseScene = async (
    page: Page,
    options: { mode: 'samurai-retribution' },
) => {
    await page.waitForFunction(({ mode }) => {
        const state = (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => Record<string, unknown> | null;
                };
            };
        }).__BG_TEST_HARNESS__?.state?.get?.();
        return state?.core?.pendingDamage?.id === `samurai-${mode}-window`
            && state?.core?.players?.['0']?.characterId === 'samurai'
            && Array.isArray(state?.core?.tokenDefinitions)
            && state.core.tokenDefinitions.length > 0
            && state?.sys?.interaction?.current?.kind === 'dt:token-response';
    }, options, { timeout: 30000, polling: 200 });
};

test.describe('DiceThrone - 手牌费用和伤害数字显示', () => {
    test('手牌费用 token 应显示统一三角费用牌', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await game.openTestGame('dicethrone', { playerID: '0' }, DICETHRONE_OPEN_TIMEOUT_MS);
        await waitForTestHarness(page, 40000);
        await clearEvidenceScreenshotsForTest(testInfo);

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['card-just-this', 'card-play-six', 'card-unexpected'],
                resources: { CP: 2, HP: 50 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': 'monk', '1': 'barbarian' },
                hostStarted: true,
                rollCount: 1,
                rollLimit: 3,
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

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                cp: state?.core?.players?.['0']?.resources?.cp ?? null,
                handIds: ((state?.core?.players?.['0']?.hand ?? []) as HandCardSnapshot[]).map((card) => card.id),
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'offensiveRoll',
            cp: 2,
            handIds: ['card-just-this', 'card-play-six', 'card-unexpected'],
        });

        await waitForHandCardVisualReady(page, ['card-just-this', 'card-play-six', 'card-unexpected']);

        const freeBadge = page
            .locator('[data-testid="hand-area"] [data-card-id="card-just-this"] [data-testid="dt-hand-card-cost"]')
            .first();
        const oneCpBadge = page
            .locator('[data-testid="hand-area"] [data-card-id="card-play-six"] [data-testid="dt-hand-card-cost"]')
            .first();
        const threeCpBadge = page
            .locator('[data-testid="hand-area"] [data-card-id="card-unexpected"] [data-testid="dt-hand-card-cost"]')
            .first();

        await expect(freeBadge).toBeVisible();
        await expect(freeBadge).toHaveText('0');
        await expect(freeBadge).toHaveAttribute('data-affordable', 'true');
        await expect(oneCpBadge).toBeVisible();
        await expect(oneCpBadge).toHaveText('1');
        await expect(oneCpBadge).toHaveAttribute('data-affordable', 'true');
        await expect(threeCpBadge).toBeVisible();
        await expect(threeCpBadge).toHaveText('3');
        await expect(threeCpBadge).toHaveAttribute('data-affordable', 'false');

        await saveEvidenceScreenshot(page, testInfo, '01-hand-cost-badges');
    });

    test('武士反击链路应先在己方显示来伤，再在对方显示反伤数字', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);

        await game.openTestGame('dicethrone', { playerID: '0' }, DICETHRONE_OPEN_TIMEOUT_MS);
        await waitForTestHarness(page, 40000);
        await forceManualResponseEnabled(page);
        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                resources: { CP: 2, HP: 50 },
            },
            player1: {
                resources: { CP: 2, HP: 50 },
            },
            currentPlayer: '1',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': 'samurai', '1': 'paladin' },
                hostStarted: true,
                rollCount: 1,
                rollLimit: 1,
                rollConfirmed: true,
            },
        });
        await waitForVisibleSelector(page, '[data-testid="hand-area"]', 10000);
        await injectSamuraiTokenResponseScene(page, {
            mode: 'samurai-retribution',
            incomingDamage: 5,
            bonusDiceValues: [1],
        });
        await waitForSamuraiTokenResponseScene(page, { mode: 'samurai-retribution' });
        await ensureDebugPanelClosed(page);
        await disableFabMenu(page);

        const retributionToken = page.getByTestId(`dt-player-0-token-${TOKEN_IDS.SAMURAI_RETRIBUTION}`).first();
        const retributionHitTarget = page
            .getByTestId(`dt-player-0-token-${TOKEN_IDS.SAMURAI_RETRIBUTION}-hit-target`)
            .first();
        const selfHealth = page.locator('[data-player-id="player-0"][role="region"] [data-resource="health"]').first();
        const attackerHeader = page.locator('[data-testid="dt-top-header-1"][data-player-id="1"]').first();
        await expect(retributionToken).toHaveAttribute('data-token-clickable', 'true', { timeout: 5000 });
        await expect(retributionHitTarget).toBeVisible({ timeout: 5000 });
        await retributionHitTarget.click();
        await expect.poll(async () => {
            const state = await game.getState() as Record<string, any>;
            return {
                pendingBonusSource: state?.core?.pendingBonusDiceSettlement?.sourceAbilityId ?? null,
                retribution: state?.core?.players?.['0']?.tokens?.samurai_retribution ?? 0,
                pendingDamage: state?.core?.pendingDamage?.currentDamage ?? null,
            };
        }, { timeout: 10000 }).toMatchObject({
            pendingBonusSource: 'samurai-back-strike-reflect',
            retribution: 0,
            pendingDamage: 5,
        });

        const responsePassButton = page.getByTestId('dicethrone-response-pass-button');
        await expect(responsePassButton).toBeVisible({ timeout: 5000 });
        await responsePassButton.click();

        await page.waitForFunction(() => {
            const threshold = window.innerHeight * 0.55;
            return Array.from(document.querySelectorAll('[data-floating-text-preset="dicethrone-damage"]'))
                .some((element) => {
                    const htmlElement = element as HTMLElement;
                    const rect = htmlElement.getBoundingClientRect();
                    const style = window.getComputedStyle(htmlElement);
                    return rect.width > 0
                        && rect.height > 0
                        && style.display !== 'none'
                        && style.visibility !== 'hidden'
                        && style.opacity !== '0'
                        && (rect.top + rect.height / 2) > threshold;
                });
        }, undefined, { timeout: 4000, polling: 50 });
        await page.waitForTimeout(80);
        const incomingFloats = await readVisibleDamageFloatCenters(page);
        const viewport = page.viewportSize();
        expect(incomingFloats.some((entry) => entry.y > ((viewport?.height ?? 720) * 0.55))).toBeTruthy();
        await expect(selfHealth).toContainText('45');
        await expect(attackerHeader).toContainText('50');
        await saveEvidenceScreenshot(page, testInfo, '02-retribution-incoming-damage');

        await settleCurrentBonusDice(
            page,
            () => game.getState() as Promise<Record<string, any>>,
            { sourceAbilityId: 'samurai-back-strike-reflect' },
        );

        await page.waitForFunction(() => {
            const threshold = window.innerHeight * 0.45;
            return Array.from(document.querySelectorAll('[data-floating-text-preset="dicethrone-damage"]'))
                .some((element) => {
                    const htmlElement = element as HTMLElement;
                    const rect = htmlElement.getBoundingClientRect();
                    const style = window.getComputedStyle(htmlElement);
                    return rect.width > 0
                        && rect.height > 0
                        && style.display !== 'none'
                        && style.visibility !== 'hidden'
                        && style.opacity !== '0'
                        && (rect.top + rect.height / 2) < threshold;
                });
        }, undefined, { timeout: 5000, polling: 50 });

        await page.waitForTimeout(80);
        await expect(attackerHeader).toContainText('49');
        await saveEvidenceScreenshot(page, testInfo, '03-retribution-reflect-damage');

        await page.waitForFunction(() => {
            const state = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get?: () => Record<string, unknown> | null;
                    };
                };
            }).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.core?.players?.['0']?.resources?.hp === 45
                && state?.core?.players?.['1']?.resources?.hp === 49
                && state?.core?.pendingDamage == null;
        }, undefined, { timeout: 10000, polling: 200 });

        const finalState = await page.evaluate(() => {
            const state = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    state?: {
                        get?: () => Record<string, unknown> | null;
                    };
                };
            }).__BG_TEST_HARNESS__?.state?.get?.();
            const entries = state?.sys?.eventStream?.entries ?? [];
            const latestBackStrike = [...entries as Array<Record<string, unknown>>]
                .reverse()
                .find((entry) => {
                    const event = entry.event as Record<string, unknown> | undefined;
                    const payload = event?.payload as Record<string, unknown> | undefined;
                    return payload?.effectKey === 'bonusDie.effect.samuraiBackStrikeDie';
                });
            const latestBackStrikeEvent = latestBackStrike?.event as Record<string, unknown> | undefined;
            const latestBackStrikePayload = latestBackStrikeEvent?.payload as Record<string, unknown> | undefined;
            return {
                pendingDamage: state?.core?.pendingDamage ?? null,
                samuraiHp: state?.core?.players?.['0']?.resources?.hp ?? null,
                attackerHp: state?.core?.players?.['1']?.resources?.hp ?? null,
                retribution: state?.core?.players?.['0']?.tokens?.samurai_retribution ?? 0,
                lastEventTypes: (entries as Array<Record<string, unknown>>)
                    .slice(-10)
                    .map((entry) => (entry.event as Record<string, unknown> | undefined)?.type),
                backStrikeRoll: latestBackStrikePayload?.value ?? null,
            };
        });

        await page.waitForFunction(() => {
            const floats = Array.from(document.querySelectorAll('[data-floating-text-preset="dicethrone-damage"]'));
            return floats.every((element) => {
                const htmlElement = element as HTMLElement;
                const rect = htmlElement.getBoundingClientRect();
                const style = window.getComputedStyle(htmlElement);
                const hidden = style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
                return hidden || rect.width === 0 || rect.height === 0;
            });
        }, undefined, { timeout: 6000, polling: 100 });
        await saveEvidenceScreenshot(page, testInfo, '04-retribution-final-hp');

        expect(finalState.pendingDamage).toBeNull();
        expect(finalState.retribution).toBe(0);
        expect(finalState.samuraiHp).toBe(45);
        expect(finalState.attackerHp).toBe(49);
        expect(finalState.backStrikeRoll).toBe(1);
        expect(finalState.lastEventTypes).toContain('BONUS_DIE_ROLLED');
        expect(finalState.lastEventTypes).toContain('DAMAGE_DEALT');
    });
});
