import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from '../framework';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { waitForTestHarness } from '../helpers/common';

const OPEN_TIMEOUT_MS = 180000;

type HarnessState = {
    sys?: {
        phase?: string | null;
        interaction?: {
            current?: {
                kind?: string | null;
                playerId?: string | null;
                data?: { type?: string | null } | null;
            } | null;
        } | null;
        eventStream?: {
            entries?: EventStreamEntry[];
        } | null;
    } | null;
    core?: {
        activePlayerId?: string | null;
        rollCount?: number | null;
        rollConfirmed?: boolean | null;
        pendingAttack?: {
            attackerId?: string | null;
            defenderId?: string | null;
            sourceAbilityId?: string | null;
            isDefendable?: boolean | null;
        } | null;
        players?: Record<string, {
            resources?: {
                hp?: number | null;
            } | null;
        }>;
    } | null;
};

type EventStreamEntry = {
    event?: {
        type?: string | null;
        payload?: {
            targetId?: string | null;
            amount?: number | null;
            actualDamage?: number | null;
            sourceAbilityId?: string | null;
        } | null;
    } | null;
};

const saveEvidenceScreenshot = async (page: Page, testInfo: TestInfo, name: string) => {
    const path = getEvidenceScreenshotPath(testInfo, name, {
        filename: `${name}.png`,
    });
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: false });
    return path;
};

const dispatchHarnessCommand = async (
    page: Page,
    type: string,
    playerId: string,
    payload: Record<string, unknown> = {},
) => {
    await page.evaluate(({ commandType, commandPlayerId, commandPayload }) => {
        (window as Window & {
            __BG_TEST_HARNESS__?: {
                command?: {
                    dispatch?: (command: {
                        type: string;
                        playerId: string;
                        payload: Record<string, unknown>;
                    }) => void;
                };
            };
        }).__BG_TEST_HARNESS__?.command?.dispatch?.({
            type: commandType,
            playerId: commandPlayerId,
            payload: commandPayload,
        });
    }, {
        commandType: type,
        commandPlayerId: playerId,
        commandPayload: payload,
    });
};

const readVisibleDamageFloatCenters = async (page: Page) => page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-floating-text-preset="impact-damage"]'))
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

const readHarnessSummary = async (page: Page) => page.evaluate(() => {
    const state = (window as Window & {
        __BG_TEST_HARNESS__?: {
            state?: { get?: () => HarnessState | null };
        };
    }).__BG_TEST_HARNESS__?.state?.get?.();
    const interaction = state?.sys?.interaction?.current ?? null;
    return {
        phase: state?.sys?.phase ?? null,
        activePlayerId: state?.core?.activePlayerId ?? null,
        rollCount: state?.core?.rollCount ?? null,
        rollConfirmed: state?.core?.rollConfirmed ?? null,
        pendingAttack: state?.core?.pendingAttack
            ? {
                attackerId: state.core.pendingAttack.attackerId ?? null,
                defenderId: state.core.pendingAttack.defenderId ?? null,
                sourceAbilityId: state.core.pendingAttack.sourceAbilityId ?? null,
                isDefendable: state.core.pendingAttack.isDefendable ?? null,
            }
            : null,
        interaction: interaction
            ? {
                kind: interaction.kind ?? null,
                playerId: interaction.playerId ?? null,
                dataType: interaction.data?.type ?? null,
            }
            : null,
        lastRejectedCommand: (window as Window & {
            __BG_LAST_COMMAND_REJECTED__?: unknown;
        }).__BG_LAST_COMMAND_REJECTED__ ?? null,
    };
});

const clearLastRejectedCommand = async (page: Page) => {
    await page.evaluate(() => {
        (window as Window & {
            __BG_LAST_COMMAND_REJECTED__?: unknown;
        }).__BG_LAST_COMMAND_REJECTED__ = null;
    });
};

const prepareTreantMoonElfScene = async (page: Page) => {
    await page.evaluate(async () => {
        const harness = (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => Record<string, unknown> | null;
                    patch?: (state: Record<string, unknown>) => void;
                };
            };
        }).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        if (!harness || !state || !harness.state?.patch) {
            throw new Error('TestHarness state not ready');
        }

        const [{ initHeroState, createCharacterDice, ALL_TOKEN_DEFINITIONS }] = await Promise.all([
            import('/src/games/dicethrone/domain/characters.ts'),
        ]);
        const random = {
            random: () => 0.5,
            d: (max: number) => Math.min(max, 1),
            range: (min: number) => min,
            shuffle: <T,>(array: T[]) => [...array],
        };
        const treant = initHeroState('0', 'treant', random as never);
        const moonElf = initHeroState('1', 'moon_elf', random as never);

        harness.state.patch({
            core: {
                activePlayerId: '0',
                selectedCharacters: { '0': 'treant', '1': 'moon_elf' },
                tokenDefinitions: ALL_TOKEN_DEFINITIONS,
                dice: createCharacterDice('treant'),
                players: {
                    '0': {
                        ...treant,
                        hand: [],
                        discard: [],
                        resources: {
                            ...treant.resources,
                            cp: 12,
                            hp: 50,
                        },
                        tokens: {
                            ...treant.tokens,
                            treant_seedling: 0,
                            treant_sapling: 0,
                            treant_divine: 0,
                            life_sap: 0,
                            thorn: 0,
                        },
                    },
                    '1': {
                        ...moonElf,
                        hand: [],
                        discard: [],
                        resources: {
                            ...moonElf.resources,
                            cp: 12,
                            hp: 50,
                        },
                        tokens: {
                            ...moonElf.tokens,
                            evasive: 0,
                            blinded: 0,
                            entangle: 0,
                            targeted: 0,
                        },
                    },
                },
            },
            sys: {
                responseWindow: {},
                interaction: {
                    queue: [],
                    isBlocked: false,
                },
            },
        });
    });
};

test.describe('DiceThrone Treant vs Moon Elf Visual Damage', () => {
    test('破碎之拳打到打不到我时应同时看到两段伤害动画和两边掉血', async ({ page, game }, testInfo) => {
        test.setTimeout(120000);

        await game.openTestGame('dicethrone', {}, OPEN_TIMEOUT_MS);
        await waitForTestHarness(page, 40000);

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                resources: { CP: 12, HP: 50 },
            },
            player1: {
                resources: { CP: 12, HP: 50 },
            },
            currentPlayer: '0',
            phase: 'offensiveRoll',
            extra: {
                selectedCharacters: { '0': 'treant', '1': 'moon_elf' },
                hostStarted: true,
                rollCount: 1,
                rollLimit: 2,
                rollConfirmed: false,
            },
        });

        await prepareTreantMoonElfScene(page);
        await clearLastRejectedCommand(page);

        const initialSummary = await readHarnessSummary(page);
        expect(initialSummary.phase).toBe('offensiveRoll');

        const selfHealth = page.locator('[data-player-id="player-0"][role="region"] [data-resource="health"]').first();
        const opponentHeader = page.locator('[data-testid="dt-top-header-1"][data-player-id="1"]').first();

        await page.evaluate(() => {
            (window as Window & {
                __BG_TEST_HARNESS__?: {
                    dice?: {
                        setValues?: (values: number[]) => void;
                    };
                };
            }).__BG_TEST_HARNESS__?.dice?.setValues?.([3, 2, 2, 1, 3]);
        });
        await dispatchHarnessCommand(page, 'ROLL_DICE', '0');
        await dispatchHarnessCommand(page, 'CONFIRM_ROLL', '0');
        await dispatchHarnessCommand(page, 'RESPONSE_PASS', '0');
        await dispatchHarnessCommand(page, 'RESPONSE_PASS', '1');
        await dispatchHarnessCommand(page, 'SELECT_ABILITY', '0', { abilityId: 'shattering-fist-5' });
        const afterOffensiveSelect = await readHarnessSummary(page);
        if (afterOffensiveSelect.pendingAttack?.sourceAbilityId !== 'shattering-fist-5') {
            throw new Error(`offensive select did not create pendingAttack: ${JSON.stringify(afterOffensiveSelect)}`);
        }
        await dispatchHarnessCommand(page, 'ADVANCE_PHASE', '0');

        await page.waitForFunction(() => {
            const state = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    state?: { get?: () => HarnessState | null };
                };
            }).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.sys?.phase === 'defensiveRoll'
                && state?.core?.pendingAttack?.defenderId === '1';
        }, undefined, { timeout: 10000, polling: 100 });

        const defensiveSummary = await readHarnessSummary(page);
        expect(defensiveSummary.phase).toBe('defensiveRoll');
        expect(defensiveSummary.pendingAttack).toEqual(expect.objectContaining({
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'shattering-fist-5',
            isDefendable: true,
        }));

        await page.evaluate(() => {
            (window as Window & {
                __BG_TEST_HARNESS__?: {
                    dice?: {
                        setValues?: (values: number[]) => void;
                    };
                };
            }).__BG_TEST_HARNESS__?.dice?.setValues?.([2, 4, 6, 5, 1]);
        });
        await dispatchHarnessCommand(page, 'ROLL_DICE', '1');
        await dispatchHarnessCommand(page, 'CONFIRM_ROLL', '1');
        await dispatchHarnessCommand(page, 'SELECT_ABILITY', '1', { abilityId: 'elusive-step' });
        const afterDefensiveSelect = await readHarnessSummary(page);
        if (afterDefensiveSelect.pendingAttack?.sourceAbilityId !== 'shattering-fist-5') {
            throw new Error(`defensive select lost pendingAttack: ${JSON.stringify(afterDefensiveSelect)}`);
        }
        await dispatchHarnessCommand(page, 'ADVANCE_PHASE', '1');

        await page.waitForFunction(() => {
            const threshold = window.innerHeight * 0.55;
            return Array.from(document.querySelectorAll('[data-floating-text-preset="impact-damage"]'))
                .some((element) => {
                    const htmlElement = element as HTMLElement;
                    const rect = htmlElement.getBoundingClientRect();
                    const style = window.getComputedStyle(htmlElement);
                    return rect.width > 0
                        && rect.height > 0
                        && style.display !== 'none'
                        && style.visibility !== 'hidden'
                        && style.opacity !== '0'
                        && (rect.top + rect.height / 2) > threshold
                        && (htmlElement.textContent?.includes('-1') ?? false);
                });
        }, undefined, { timeout: 3000, polling: 50 });

        await expect(selfHealth).toContainText('49');
        await expect(opponentHeader).toContainText('50');
        const incomingFloats = await readVisibleDamageFloatCenters(page);
        const viewport = page.viewportSize();
        expect(incomingFloats.some((entry) => entry.y > ((viewport?.height ?? 720) * 0.55) && entry.text.includes('-1'))).toBeTruthy();
        await saveEvidenceScreenshot(page, testInfo, '01-self-damage-visible');

        await page.waitForFunction(() => {
            const threshold = window.innerHeight * 0.45;
            return Array.from(document.querySelectorAll('[data-floating-text-preset="impact-damage"]'))
                .some((element) => {
                    const htmlElement = element as HTMLElement;
                    const rect = htmlElement.getBoundingClientRect();
                    const style = window.getComputedStyle(htmlElement);
                    return rect.width > 0
                        && rect.height > 0
                        && style.display !== 'none'
                        && style.visibility !== 'hidden'
                        && style.opacity !== '0'
                        && (rect.top + rect.height / 2) < threshold
                        && (htmlElement.textContent?.includes('-3') ?? false);
                });
        }, undefined, { timeout: 2000, polling: 50 });

        await expect(opponentHeader).toContainText('47');
        const reflectedFloats = await readVisibleDamageFloatCenters(page);
        expect(reflectedFloats.some((entry) => entry.y < ((viewport?.height ?? 720) * 0.45) && entry.text.includes('-3'))).toBeTruthy();
        await saveEvidenceScreenshot(page, testInfo, '02-opponent-damage-visible');

        await page.waitForFunction(() => {
            const state = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    state?: { get?: () => HarnessState | null };
                };
            }).__BG_TEST_HARNESS__?.state?.get?.();
            const floats = Array.from(document.querySelectorAll('[data-floating-text-preset="impact-damage"]'));
            const allHidden = floats.every((element) => {
                const htmlElement = element as HTMLElement;
                const rect = htmlElement.getBoundingClientRect();
                const style = window.getComputedStyle(htmlElement);
                return style.display === 'none'
                    || style.visibility === 'hidden'
                    || style.opacity === '0'
                    || rect.width === 0
                    || rect.height === 0;
            });
            return state?.sys?.phase === 'main2'
                && state?.core?.players?.['0']?.resources?.hp === 49
                && state?.core?.players?.['1']?.resources?.hp === 47
                && allHidden;
        }, undefined, { timeout: 8000, polling: 100 });

        await saveEvidenceScreenshot(page, testInfo, '03-final-hp-stable');

        const finalState = await page.evaluate(() => {
            const state = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    state?: { get?: () => HarnessState | null };
                };
            }).__BG_TEST_HARNESS__?.state?.get?.();
            const entries = state?.sys?.eventStream?.entries ?? [];
            return {
                phase: state?.sys?.phase ?? null,
                selfHp: state?.core?.players?.['0']?.resources?.hp ?? null,
                opponentHp: state?.core?.players?.['1']?.resources?.hp ?? null,
                lastDamageEvents: entries
                    .filter((entry: EventStreamEntry) => entry.event?.type === 'DAMAGE_DEALT')
                    .slice(-2)
                    .map((entry: EventStreamEntry) => ({
                        targetId: entry.event?.payload?.targetId ?? null,
                        amount: entry.event?.payload?.amount ?? null,
                        actualDamage: entry.event?.payload?.actualDamage ?? null,
                        sourceAbilityId: entry.event?.payload?.sourceAbilityId ?? null,
                    })),
            };
        });

        expect(finalState.phase).toBe('main2');
        expect(finalState.selfHp).toBe(49);
        expect(finalState.opponentHp).toBe(47);
        expect(finalState.lastDamageEvents).toEqual([
            expect.objectContaining({ targetId: '0', amount: 1, actualDamage: 1, sourceAbilityId: 'elusive-step' }),
            expect.objectContaining({ targetId: '1', amount: 7, actualDamage: 7, sourceAbilityId: 'shattering-fist-5' }),
        ]);
    });
});
