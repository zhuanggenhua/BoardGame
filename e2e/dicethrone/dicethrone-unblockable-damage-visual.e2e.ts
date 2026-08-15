import { test, expect } from '../framework';
import type { Page } from '@playwright/test';

type HarnessState = {
    sys?: {
        phase?: string | null;
        interaction?: {
            current?: {
                kind?: string | null;
                id?: string | null;
            } | null;
        } | null;
        eventStream?: {
            entries?: Array<{
                event?: {
                    type?: string | null;
                    payload?: {
                        targetId?: string | null;
                        actualDamage?: number | null;
                        amount?: number | null;
                        sourceAbilityId?: string | null;
                    } | null;
                } | null;
            }>;
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
            damage?: number | null;
            bonusDamage?: number | null;
            isDefendable?: boolean | null;
        } | null;
        players?: Record<string, {
            resources?: {
                hp?: number | null;
            } | null;
        }>;
    } | null;
};

type DamageAuditEntry = {
    atMs: number;
    phase: string | null;
    hp0: number | null;
    damageFloatTexts: string[];
    damageEventCount: number;
    lastRejectedCommand: Record<string, unknown> | null;
};

const dispatchHarnessCommand = async (
    page: Page,
    type: string,
    playerId: string,
    payload: Record<string, unknown> = {},
): Promise<void> => {
    await page.evaluate(async ({ commandType, commandPlayerId, commandPayload }) => {
        const harness = (window as Window & {
            __BG_TEST_HARNESS__?: {
                command?: {
                    dispatch?: (command: {
                        type: string;
                        playerId: string;
                        payload: Record<string, unknown>;
                    }) => void;
                };
            };
        }).__BG_TEST_HARNESS__;

        if (!harness?.command?.dispatch) {
            throw new Error('TestHarness command dispatcher not ready');
        }

        await harness.command.dispatch({
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

const clearLastRejectedCommand = async (page: Page) => {
    await page.evaluate(() => {
        (window as Window & {
            __BG_LAST_COMMAND_REJECTED__?: unknown;
        }).__BG_LAST_COMMAND_REJECTED__ = null;
    });
};

const installDamageAuditProbe = async (page: Page) => {
    await page.evaluate(() => {
        const win = window as Window & {
            __DT_UNBLOCKABLE_AUDIT__?: {
                observer?: MutationObserver;
                timer?: number;
                startedAt: number;
                snapshot: {
                    damageFloatMountCount: number;
                    damageFloatTexts: string[];
                    timeline: DamageAuditEntry[];
                };
            };
        };

        win.__DT_UNBLOCKABLE_AUDIT__?.observer?.disconnect();
        if (win.__DT_UNBLOCKABLE_AUDIT__?.timer) {
            window.clearInterval(win.__DT_UNBLOCKABLE_AUDIT__.timer);
        }

        const snapshot = {
            damageFloatMountCount: 0,
            damageFloatTexts: [] as string[],
            timeline: [] as DamageAuditEntry[],
        };
        const startedAt = performance.now();

        const getState = (): HarnessState | null => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    state?: { get?: () => HarnessState | null };
                };
            }).__BG_TEST_HARNESS__;
            return harness?.state?.get?.() ?? null;
        };

        const readDamageFloatTexts = () => Array.from(
            document.querySelectorAll('[data-floating-text-preset="impact-damage"]'),
        )
            .map((node) => node.textContent?.trim())
            .filter((value): value is string => Boolean(value));

        const readDamageEvents = (state: HarnessState | null) => {
            const entries = state?.sys?.eventStream?.entries ?? [];
            return entries.filter((entry) => entry.event?.type === 'DAMAGE_DEALT');
        };

        const pushTimeline = () => {
            const state = getState();
            const damageEvents = readDamageEvents(state);
            const entry: DamageAuditEntry = {
                atMs: Math.round((performance.now() - startedAt) * 100) / 100,
                phase: state?.sys?.phase ?? null,
                hp0: state?.core?.players?.['0']?.resources?.hp ?? null,
                damageFloatTexts: readDamageFloatTexts(),
                damageEventCount: damageEvents.length,
                lastRejectedCommand: ((window as Window & {
                    __BG_LAST_COMMAND_REJECTED__?: Record<string, unknown> | null;
                }).__BG_LAST_COMMAND_REJECTED__) ?? null,
            };

            const last = snapshot.timeline[snapshot.timeline.length - 1];
            if (last && JSON.stringify(last) === JSON.stringify(entry)) {
                return;
            }
            snapshot.timeline.push(entry);
        };

        const observer = new MutationObserver((records) => {
            for (const record of records) {
                for (const node of Array.from(record.addedNodes)) {
                    if (!(node instanceof Element)) continue;
                    if (node.matches('[data-floating-text-preset="impact-damage"]')
                        || node.querySelector('[data-floating-text-preset="impact-damage"]')) {
                        snapshot.damageFloatMountCount += 1;
                        const text = node.textContent?.trim();
                        if (text) snapshot.damageFloatTexts.push(text);
                    }
                }
            }
            pushTimeline();
        });

        observer.observe(document.body, { childList: true, subtree: true });
        win.__DT_UNBLOCKABLE_AUDIT__ = {
            observer,
            timer: window.setInterval(pushTimeline, 50),
            startedAt,
            snapshot,
        };
        pushTimeline();
    });
};

const readDamageAudit = async (page: Page) => page.evaluate(() => {
    const win = window as Window & {
        __DT_UNBLOCKABLE_AUDIT__?: {
            snapshot: {
                damageFloatMountCount: number;
                damageFloatTexts: string[];
                timeline: DamageAuditEntry[];
            };
        };
    };
    return win.__DT_UNBLOCKABLE_AUDIT__?.snapshot ?? {
        damageFloatMountCount: 0,
        damageFloatTexts: [],
        timeline: [],
    };
});

const readLastRejectedCommand = async (page: Page) => page.evaluate(() => (
    (window as Window & { __BG_LAST_COMMAND_REJECTED__?: Record<string, unknown> | null }).__BG_LAST_COMMAND_REJECTED__ ?? null
));

test.describe('DiceThrone 不可防御伤害飞字', () => {
    test('僧侣天人合一结算后应播放伤害动画和跳字', async ({ page, game }, testInfo) => {
        await game.openTestGame('dicethrone');
        await game.setupScene({
            gameId: 'dicethrone',
            currentPlayer: '0',
            phase: 'offensiveRoll',
            player0: {
                resources: { HP: 50, CP: 2 },
            },
            player1: {
                resources: { HP: 50, CP: 2 },
            },
            extra: {
                selectedCharacters: { '0': 'gunslinger', '1': 'monk' },
                hostStarted: true,
                activePlayerId: '1',
                rollCount: 1,
                rollLimit: 1,
                rollConfirmed: true,
                selectedAbilityId: 'transcendence',
                dice: [
                    { id: 0, definitionId: 'monk-dice', value: 4, symbol: 'lotus', symbols: ['lotus'], isKept: false },
                    { id: 1, definitionId: 'monk-dice', value: 4, symbol: 'lotus', symbols: ['lotus'], isKept: false },
                    { id: 2, definitionId: 'monk-dice', value: 4, symbol: 'lotus', symbols: ['lotus'], isKept: false },
                    { id: 3, definitionId: 'monk-dice', value: 4, symbol: 'lotus', symbols: ['lotus'], isKept: false },
                    { id: 4, definitionId: 'monk-dice', value: 4, symbol: 'lotus', symbols: ['lotus'], isKept: false },
                ],
                pendingAttack: {
                    attackerId: '1',
                    defenderId: '0',
                    sourceAbilityId: 'transcendence',
                    damage: 10,
                    bonusDamage: 0,
                    isDefendable: false,
                    isUltimate: true,
                    targetingSelectionPending: false,
                    targetingSelectionResolved: true,
                    preDefenseResolved: false,
                    damageResolved: false,
                    resolvedDamage: 0,
                    offensiveRollEndTokenResolved: false,
                    bonusDiceResolved: false,
                    attackModifierBonusDamage: 0,
                },
            },
        });

        const setupState = await game.getState();
        console.log('[DT-UNBLOCKABLE][setup]', JSON.stringify({
            phase: setupState?.sys?.phase ?? null,
            activePlayerId: setupState?.core?.activePlayerId ?? null,
            currentPlayer: '0',
            pendingAttack: setupState?.core?.pendingAttack ?? null,
            rollCount: setupState?.core?.rollCount ?? null,
            rollConfirmed: setupState?.core?.rollConfirmed ?? null,
        }, null, 2));

        await installDamageAuditProbe(page);
        await clearLastRejectedCommand(page);
        await game.screenshot('unblockable-before-resolve', testInfo);

        await dispatchHarnessCommand(page, 'ADVANCE_PHASE', '1');

        await expect.poll(async () => {
            const state = await game.getState();
            const audit = await readDamageAudit(page);
            return {
                phase: state?.sys?.phase ?? null,
                hp0: state?.core?.players?.['0']?.resources?.hp ?? null,
                damageEventCount: state?.sys?.eventStream?.entries?.filter((entry: { event?: { type?: string } }) => entry.event?.type === 'DAMAGE_DEALT').length ?? 0,
                damageFloatMountCount: audit.damageFloatMountCount,
                damageFloatTexts: audit.damageFloatTexts,
                lastRejectedCommand: await readLastRejectedCommand(page),
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'main2',
            hp0: 40,
            damageEventCount: 1,
            lastRejectedCommand: null,
        });

        await expect(page.locator('[data-floating-text-preset="impact-damage"]').first()).toBeVisible({ timeout: 10000 });
        await game.screenshot('unblockable-after-resolve', testInfo);

        const audit = await readDamageAudit(page);
        console.log('[DT-UNBLOCKABLE]', JSON.stringify(audit, null, 2));
        expect(audit.damageFloatMountCount, '伤害飞字没有挂载').toBeGreaterThan(0);
        expect(audit.damageFloatTexts.join(' '), '伤害飞字文本不包含 10').toContain('10');
        expect(audit.timeline.some((entry) => entry.damageEventCount > 0), 'timeline 没有记录到 DAMAGE_DEALT').toBe(true);
    });

    test('圣骑士基础不可防御技能结算后也应播放伤害动画和跳字', async ({ page, game }, testInfo) => {
        await game.openTestGame('dicethrone');
        await game.setupScene({
            gameId: 'dicethrone',
            currentPlayer: '0',
            phase: 'offensiveRoll',
            player0: {
                resources: { HP: 50, CP: 2 },
            },
            player1: {
                resources: { HP: 50, CP: 2 },
            },
            extra: {
                selectedCharacters: { '0': 'gunslinger', '1': 'paladin' },
                hostStarted: true,
                activePlayerId: '1',
                rollCount: 1,
                rollLimit: 1,
                rollConfirmed: true,
                dice: [
                    { id: 0, definitionId: 'paladin-dice', value: 1, symbol: 'sword', symbols: ['sword'], isKept: false },
                    { id: 1, definitionId: 'paladin-dice', value: 1, symbol: 'sword', symbols: ['sword'], isKept: false },
                    { id: 2, definitionId: 'paladin-dice', value: 1, symbol: 'sword', symbols: ['sword'], isKept: false },
                    { id: 3, definitionId: 'paladin-dice', value: 6, symbol: 'pray', symbols: ['pray'], isKept: false },
                    { id: 4, definitionId: 'paladin-dice', value: 3, symbol: 'helm', symbols: ['helm'], isKept: false },
                ],
            },
        });

        const setupState = await game.getState();
        console.log('[DT-UNBLOCKABLE-PALADIN][setup]', JSON.stringify({
            phase: setupState?.sys?.phase ?? null,
            activePlayerId: setupState?.core?.activePlayerId ?? null,
            currentPlayer: '0',
            pendingAttack: setupState?.core?.pendingAttack ?? null,
            rollCount: setupState?.core?.rollCount ?? null,
            rollConfirmed: setupState?.core?.rollConfirmed ?? null,
        }, null, 2));

        await installDamageAuditProbe(page);
        await clearLastRejectedCommand(page);
        await dispatchHarnessCommand(page, 'SELECT_ABILITY', '1', { abilityId: 'blessing-of-might' });

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                pendingAttack: state?.core?.pendingAttack
                    ? {
                        attackerId: state.core.pendingAttack.attackerId ?? null,
                        defenderId: state.core.pendingAttack.defenderId ?? null,
                        sourceAbilityId: state.core.pendingAttack.sourceAbilityId ?? null,
                        damage: state.core.pendingAttack.damage ?? null,
                        isDefendable: state.core.pendingAttack.isDefendable ?? null,
                    }
                    : null,
                lastRejectedCommand: await readLastRejectedCommand(page),
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'offensiveRoll',
            pendingAttack: {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'blessing-of-might',
                isDefendable: false,
            },
            lastRejectedCommand: null,
        });

        await clearLastRejectedCommand(page);
        await game.screenshot('paladin-unblockable-before-resolve', testInfo);
        await dispatchHarnessCommand(page, 'ADVANCE_PHASE', '1');

        await expect.poll(async () => {
            const state = await game.getState();
            const audit = await readDamageAudit(page);
            return {
                phase: state?.sys?.phase ?? null,
                hp0: state?.core?.players?.['0']?.resources?.hp ?? null,
                damageEventCount: state?.sys?.eventStream?.entries?.filter((entry: { event?: { type?: string } }) => entry.event?.type === 'DAMAGE_DEALT').length ?? 0,
                damageFloatMountCount: audit.damageFloatMountCount,
                damageFloatTexts: audit.damageFloatTexts,
                lastRejectedCommand: await readLastRejectedCommand(page),
            };
        }, { timeout: 10000 }).toMatchObject({
            phase: 'main2',
            hp0: 47,
            damageEventCount: 1,
            lastRejectedCommand: null,
        });

        await expect(page.locator('[data-floating-text-preset="impact-damage"]').first()).toBeVisible({ timeout: 10000 });
        await game.screenshot('paladin-unblockable-after-resolve', testInfo);

        const audit = await readDamageAudit(page);
        console.log('[DT-UNBLOCKABLE-PALADIN]', JSON.stringify(audit, null, 2));
        expect(audit.damageFloatMountCount, '圣骑士伤害飞字没有挂载').toBeGreaterThan(0);
        expect(audit.damageFloatTexts.join(' '), '圣骑士伤害飞字文本不包含 3').toContain('3');
        expect(audit.timeline.some((entry) => entry.damageEventCount > 0), '圣骑士 timeline 没有记录到 DAMAGE_DEALT').toBe(true);
    });
});
