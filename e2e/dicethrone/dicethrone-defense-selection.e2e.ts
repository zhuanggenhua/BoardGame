import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, parse } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from '../framework';
import type { GameTestContext } from '../framework';
import { getEvidenceScreenshotDir, sanitizeEvidencePathSegment } from '../framework/evidenceScreenshots';
import { BLINK_2 } from '../../src/games/dicethrone/heroes/ninja/abilities';
import { TOKEN_IDS } from '../../src/games/dicethrone/domain/ids';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';

type DuelAuditDamageEvent = {
    streamIndex: number;
    targetId: string | null;
    actualDamage: number | null;
    amount: number | null;
    sourceAbilityId: string | null;
};

type DuelAuditCommandEntry = {
    atMs: number;
    marker: string;
    type: string;
    playerId: string;
    payload: Record<string, unknown>;
};

type DuelAuditTimelineEntry = {
    atMs: number;
    reason: string;
    phase: string | null;
    interactionKind: string | null;
    interactionId: string | null;
    responseWindowType: string | null;
    pendingAttackSourceAbilityId: string | null;
    pendingAttackDefenseAbilityId: string | null;
    pendingAttackDamage: number | null;
    hp0: number | null;
    hp1: number | null;
    overlayVisible: boolean;
    overlayRect: { x: number; y: number; width: number; height: number } | null;
    overlayOpacity: string | null;
    overlayTransform: string | null;
    overlayText: string | null;
    damageFloatTexts: string[];
    damageEventCount: number;
    lastDamageEvent: DuelAuditDamageEvent | null;
    lastRejectedCommand: Record<string, unknown> | null;
};

type HarnessState = {
    sys?: {
        phase?: string | null;
        interaction?: {
            current?: {
                kind?: string | null;
                id?: string | null;
            } | null;
        } | null;
        responseWindow?: {
            current?: {
                windowType?: string | null;
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
        players?: Record<string, {
            resources?: {
                hp?: number | null;
            } | null;
        }>;
        pendingAttack?: {
            sourceAbilityId?: string | null;
            defenseAbilityId?: string | null;
            damage?: number | null;
        } | null;
    } | null;
};

type DuelAuditSnapshot = {
    compareRollOverlayMountCount: number;
    compareRollOverlayTexts: string[];
    damageFloatMountCount: number;
    damageFloatTexts: string[];
    compareRollInteractionIds: string[];
    damageEvents: DuelAuditDamageEvent[];
    commandLog: DuelAuditCommandEntry[];
    timeline: DuelAuditTimelineEntry[];
};

const saveDuelAuditLog = async (
    testInfo: TestInfo,
    filename: string,
    snapshot: DuelAuditSnapshot,
): Promise<string> => {
    const stableEvidenceDir = getEvidenceScreenshotDir(testInfo);
    const parsed = parse(filename);
    const stableName = `${sanitizeEvidencePathSegment(parsed.name || 'duel-audit') || 'duel-audit'}.json`;
    const filePath = join(stableEvidenceDir, stableName);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    await testInfo.attach(filename, {
        path: filePath,
        contentType: 'application/json',
    });
    return filePath;
};

const getOverlayVisibleSegmentCount = (timeline: DuelAuditTimelineEntry[]): number => {
    let count = 0;
    let wasVisible = false;
    for (const entry of timeline) {
        if (entry.overlayVisible && !wasVisible) {
            count += 1;
        }
        wasVisible = entry.overlayVisible;
    }
    return count;
};

const getVisibleOverlayInteractionIdCount = (timeline: DuelAuditTimelineEntry[]): number => (
    new Set(
        timeline
            .filter((entry) => entry.overlayVisible && entry.interactionId)
            .map((entry) => entry.interactionId),
    ).size
);

const hasOverlayCollapseReopenPattern = (timeline: DuelAuditTimelineEntry[]): boolean => {
    const visibleHeights = timeline
        .filter((entry) => entry.overlayVisible && entry.overlayRect && entry.overlayRect.height > 0)
        .map((entry) => ({ atMs: entry.atMs, height: entry.overlayRect!.height }));

    if (visibleHeights.length < 3) {
        return false;
    }

    const maxHeight = Math.max(...visibleHeights.map((entry) => entry.height));
    const settleThreshold = maxHeight * 0.8;
    const collapseThreshold = maxHeight * 0.65;

    const settledIndex = visibleHeights.findIndex((entry) => entry.height >= settleThreshold);
    if (settledIndex < 0) {
        return false;
    }

    let collapsedAfterSettle = false;
    for (let index = settledIndex + 1; index < visibleHeights.length; index += 1) {
        if (visibleHeights[index].height <= collapseThreshold) {
            collapsedAfterSettle = true;
            continue;
        }
        if (collapsedAfterSettle && visibleHeights[index].height >= settleThreshold) {
            return true;
        }
    }

    return false;
};

async function setupDefenseEntryScene(
    game: GameTestContext,
    defenderCharacter: 'shadow_thief' | 'paladin',
): Promise<void> {
    await game.openTestGame('dicethrone', { playerID: 1, disableLocalAiAutomation: true });

    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: { CP: 2, HP: 50 },
        },
        player1: {
            resources: { CP: 2, HP: 50 },
            tokens: { [TOKEN_IDS.TAIJI]: 0 },
        },
        currentPlayer: '0',
        phase: 'offensiveRoll',
        extra: {
            selectedCharacters: { '0': 'monk', '1': defenderCharacter },
            hostStarted: true,
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
                isDefendable: true,
                damage: 5,
                bonusDamage: 0,
                sourceAbilityId: 'smash',
            },
        },
    });

    await expect.poll(async () => {
        const state = await game.getState();
        return {
            phase: state?.sys?.phase ?? null,
            defenderId: state?.core?.pendingAttack?.defenderId ?? null,
            sourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
            rollConfirmed: state?.core?.rollConfirmed ?? null,
        };
    }, { timeout: 10000 }).toMatchObject({
        phase: 'offensiveRoll',
        defenderId: '1',
        sourceAbilityId: 'smash',
        rollConfirmed: true,
    });
}

async function setupGunslingerDuelAgainstHarmonyScene(game: GameTestContext): Promise<void> {
    await game.openTestGame('dicethrone', { disableLocalAiAutomation: true });

    await game.setupScene({
        gameId: 'dicethrone',
        randomQueue: [0.99, 0.0],
        player0: {
            resources: { CP: 2, HP: 50 },
            hand: [],
            deck: [],
            discard: [],
        },
        player1: {
            resources: { CP: 2, HP: 50 },
            hand: [],
            deck: [],
            discard: [],
            tokens: {
                [TOKEN_IDS.TAIJI]: 0,
                [TOKEN_IDS.EVASIVE]: 0,
                [TOKEN_IDS.PURIFY]: 0,
            },
        },
        currentPlayer: '0',
        phase: 'defensiveRoll',
        sys: {
            interaction: {
                current: null,
                queue: [],
            },
            responseWindow: {
                current: null,
            },
        },
        extra: {
            selectedCharacters: { '0': 'gunslinger', '1': 'monk' },
            hostStarted: true,
            activePlayerId: '0',
            rollCount: 0,
            rollLimit: 1,
            rollConfirmed: false,
            pendingDamage: null,
            dice: [
                { id: 0, definitionId: 'gunslinger-dice', value: 1, symbol: 'bullet', symbols: ['bullet'], isKept: false },
                { id: 1, definitionId: 'gunslinger-dice', value: 2, symbol: 'dash', symbols: ['dash'], isKept: false },
                { id: 2, definitionId: 'gunslinger-dice', value: 3, symbol: 'bullseye', symbols: ['bullseye'], isKept: false },
                { id: 3, definitionId: 'gunslinger-dice', value: 4, symbol: 'bullet', symbols: ['bullet'], isKept: false },
                { id: 4, definitionId: 'gunslinger-dice', value: 5, symbol: 'dash', symbols: ['dash'], isKept: false },
            ],
            pendingAttack: {
                attackerId: '1',
                defenderId: '0',
                isDefendable: true,
                damage: 5,
                bonusDamage: 0,
                sourceAbilityId: 'harmony',
                defenseAbilityId: 'duel',
            },
        },
    });

    await expect.poll(async () => {
        const state = await game.getState();
        return {
            phase: state?.sys?.phase ?? null,
            activePlayerId: state?.core?.activePlayerId ?? null,
            defenderId: state?.core?.pendingAttack?.defenderId ?? null,
            defenseAbilityId: state?.core?.pendingAttack?.defenseAbilityId ?? null,
            sourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
            rollCount: state?.core?.rollCount ?? null,
            rollConfirmed: state?.core?.rollConfirmed ?? null,
            interactionKind: state?.sys?.interaction?.current?.kind ?? null,
            attackerTaiji: state?.core?.players?.['1']?.tokens?.[TOKEN_IDS.TAIJI] ?? null,
            attackerHandSize: state?.core?.players?.['1']?.hand?.length ?? null,
        };
    }, { timeout: 10000 }).toMatchObject({
        phase: 'defensiveRoll',
        activePlayerId: '0',
        defenderId: '0',
        defenseAbilityId: 'duel',
        sourceAbilityId: 'harmony',
        rollCount: 0,
        rollConfirmed: false,
        interactionKind: null,
        attackerTaiji: 0,
        attackerHandSize: 0,
    });
}

async function setupGunslingerShowdownScene(game: GameTestContext): Promise<void> {
    await game.openTestGame('dicethrone', { disableLocalAiAutomation: true });

    await game.setupScene({
        gameId: 'dicethrone',
        randomQueue: [0.99, 0.0],
        player0: {
            resources: { CP: 2, HP: 50 },
            tokens: { loaded: 0 },
        },
        player1: {
            resources: { CP: 2, HP: 50 },
        },
        currentPlayer: '0',
        phase: 'offensiveRoll',
        extra: {
            selectedCharacters: { '0': 'gunslinger', '1': 'monk' },
            hostStarted: true,
            activePlayerId: '0',
            rollCount: 1,
            rollLimit: 3,
            rollConfirmed: true,
            selectedAbilityId: 'showdown',
            dice: [
                { id: 0, definitionId: 'gunslinger-dice', value: 1, symbol: 'bullet', symbols: ['bullet'], isKept: false },
                { id: 1, definitionId: 'gunslinger-dice', value: 2, symbol: 'dash', symbols: ['dash'], isKept: false },
                { id: 2, definitionId: 'gunslinger-dice', value: 3, symbol: 'bullseye', symbols: ['bullseye'], isKept: false },
                { id: 3, definitionId: 'gunslinger-dice', value: 4, symbol: 'bullet', symbols: ['bullet'], isKept: false },
                { id: 4, definitionId: 'gunslinger-dice', value: 5, symbol: 'dash', symbols: ['dash'], isKept: false },
            ],
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                isDefendable: true,
                damage: 5,
                bonusDamage: 0,
                sourceAbilityId: 'showdown',
            },
        },
    });

    await expect.poll(async () => {
        const state = await game.getState();
        return {
            phase: state?.sys?.phase ?? null,
            sourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
            bonusDamage: state?.core?.pendingAttack?.bonusDamage ?? null,
            selectedAbilityId: state?.core?.selectedAbilityId ?? null,
            interactionKind: state?.sys?.interaction?.current?.kind ?? null,
        };
    }, { timeout: 10000 }).toMatchObject({
        phase: 'offensiveRoll',
        sourceAbilityId: 'showdown',
        bonusDamage: 0,
        selectedAbilityId: 'showdown',
        interactionKind: null,
    });
}

async function dismissAttackShowcaseIfVisible(page: Page): Promise<void> {
    const continueButton = page.getByRole('button', { name: /开始防御|继续|Start Defense|Continue/i }).first();
    if (await continueButton.isVisible({ timeout: 1500 }).catch(() => false)) {
        await continueButton.click();
        await expect(continueButton).toBeHidden({ timeout: 5000 }).catch(() => {});
    }
}

async function openGunslingerDuelCompareRollChoice(page: Page, game: GameTestContext): Promise<void> {
    await dismissAttackShowcaseIfVisible(page);
    await page.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.dice), { timeout: 5000 });
    await page.evaluate(() => {
        window.__BG_TEST_HARNESS__?.dice.setValues([6, 2, 2, 2, 2, 1]);
    });

    await dispatchHarnessCommand(page, 'ROLL_DICE', '0');
    await expect.poll(async () => {
        const state = await game.getState();
        return {
            phase: state?.sys?.phase ?? null,
            rollCount: state?.core?.rollCount ?? null,
            rollConfirmed: state?.core?.rollConfirmed ?? null,
            rollContextKind: state?.core?.currentRollContext?.kind ?? null,
            dice: (state?.core?.currentRollContext?.dice ?? []).map((die: any) => die?.value ?? null),
        };
    }, { timeout: 5000 }).toMatchObject({
        phase: 'defensiveRoll',
        rollCount: 1,
        rollConfirmed: false,
        rollContextKind: 'defensive',
        dice: [6, 2, 2, 2, 2, 1],
    });

    await dispatchHarnessCommand(page, 'CONFIRM_ROLL', '0');
    await expect.poll(async () => {
        const state = await game.getState();
        return {
            phase: state?.sys?.phase ?? null,
            rollConfirmed: state?.core?.rollConfirmed ?? null,
            rollContextStatus: state?.core?.currentRollContext?.status ?? null,
        };
    }, { timeout: 5000 }).toMatchObject({
        phase: 'defensiveRoll',
        rollConfirmed: true,
        rollContextStatus: 'settling',
    });

    await dispatchHarnessCommand(page, 'ADVANCE_PHASE', '0');
    await expect.poll(async () => {
        const state = await game.getState();
        return {
            phase: state?.sys?.phase ?? null,
            rollContextKind: state?.core?.currentRollContext?.kind ?? null,
            rollContextOwner: state?.core?.currentRollContext?.ownerPlayerId ?? null,
        };
    }, { timeout: 5000 }).toMatchObject({
        phase: 'defensiveRoll',
        rollContextKind: 'compare',
        rollContextOwner: '0',
    });

    await dispatchHarnessCommand(page, 'CONFIRM_COMPARE_ROLL', '0');
}

async function setupNinjaBlink2DefenseScene(page: Page, game: GameTestContext): Promise<void> {
    await game.openTestGame('dicethrone', { playerID: 1, disableLocalAiAutomation: true });

    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: { CP: 2, HP: 30 },
        },
        player1: {
            resources: { CP: 5, HP: 50 },
            tokens: { smoke_bomb: 0 },
        },
        currentPlayer: '1',
        phase: 'defensiveRoll',
        extra: {
            selectedCharacters: { '0': 'treant', '1': 'ninja' },
            hostStarted: true,
            activePlayerId: '1',
            currentPlayerIndex: 1,
            currentPlayer: '1',
            rollCount: 0,
            rollLimit: 2,
            rollConfirmed: false,
            rollDiceCount: 3,
            dice: [
                { id: 0, value: 1, isKept: false },
                { id: 1, value: 2, isKept: false },
                { id: 2, value: 3, isKept: false },
                { id: 3, value: 4, isKept: true },
                { id: 4, value: 5, isKept: true },
            ],
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'shattering-fist',
                defenseAbilityId: 'blink',
                isDefendable: true,
                damage: 0,
                bonusDamage: 0,
            },
        },
    });

    await page.evaluate(({ blink2, smokeBombTokenId }) => {
        const harness = (window as Window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => any;
                    set?: (next: any) => Promise<void>;
                };
            };
        }).__BG_TEST_HARNESS__;
        const current = harness?.state?.get?.();
        if (!current || !harness?.state?.set) {
            throw new Error('TestHarness state 不可用');
        }

        const players = { ...(current.core?.players ?? {}) };
        const ninja = { ...(players['1'] ?? {}) };
        players['1'] = {
            ...ninja,
            abilities: Array.isArray(ninja.abilities)
                ? ninja.abilities.map((ability: any) => (ability?.id === 'blink' ? blink2 : ability))
                : ninja.abilities,
            abilityLevels: {
                ...(ninja.abilityLevels ?? {}),
                blink: 2,
            },
            tokens: {
                ...(ninja.tokens ?? {}),
                [smokeBombTokenId]: 0,
            },
        };

        return harness.state.set({
            ...current,
            core: {
                ...current.core,
                players,
            },
        });
    }, { blink2: BLINK_2, smokeBombTokenId: TOKEN_IDS.SMOKE_BOMB });

    await expect.poll(async () => {
        const state = await game.getState();
        return {
            phase: state?.sys?.phase ?? null,
            activePlayerId: state?.core?.activePlayerId ?? null,
            defenseAbilityId: state?.core?.pendingAttack?.defenseAbilityId ?? null,
            rollCount: state?.core?.rollCount ?? null,
            rollLimit: state?.core?.rollLimit ?? null,
            rollDiceCount: state?.core?.rollDiceCount ?? null,
            blinkLevel: state?.core?.players?.['1']?.abilityLevels?.blink ?? null,
        };
    }, { timeout: 10000 }).toEqual({
        phase: 'defensiveRoll',
        activePlayerId: '1',
        defenseAbilityId: 'blink',
        rollCount: 0,
        rollLimit: 2,
        rollDiceCount: 3,
        blinkLevel: 2,
    });
}

async function installDuelAuditProbe(page: Page): Promise<void> {
    await page.evaluate(() => {
        const win = window as Window & {
            __DT_DUEL_AUDIT__?: {
                observer?: MutationObserver;
                timer?: number;
                startedAt: number;
                lastSignature?: string;
                snapshot: DuelAuditSnapshot;
            };
        };

        win.__DT_DUEL_AUDIT__?.observer?.disconnect();
        if (win.__DT_DUEL_AUDIT__?.timer) {
            window.clearInterval(win.__DT_DUEL_AUDIT__.timer);
        }

        const snapshot: DuelAuditSnapshot = {
            compareRollOverlayMountCount: 0,
            compareRollOverlayTexts: [],
            damageFloatMountCount: 0,
            damageFloatTexts: [],
            compareRollInteractionIds: [],
            damageEvents: [],
            commandLog: [],
            timeline: [],
        };

        const startedAt = performance.now();

        const getState = () => {
            const harness = (window as Window & {
                __BG_TEST_HARNESS__?: {
                    state?: { get?: () => HarnessState | null };
                };
            }).__BG_TEST_HARNESS__;
            return harness?.state?.get?.() ?? null;
        };

        const getDamageEvents = (state: HarnessState | null): DuelAuditDamageEvent[] => {
            const entries = state?.sys?.eventStream?.entries ?? [];
            return entries
                .map((entry, streamIndex) => ({ entry, streamIndex }))
                .filter(({ entry }) => entry.event?.type === 'DAMAGE_DEALT')
                .map(({ entry, streamIndex }) => ({
                    streamIndex,
                    targetId: entry.event?.payload?.targetId ?? null,
                    actualDamage: entry.event?.payload?.actualDamage ?? null,
                    amount: entry.event?.payload?.amount ?? null,
                    sourceAbilityId: entry.event?.payload?.sourceAbilityId ?? null,
                }));
        };

        const recordCompareRollInteraction = (state: HarnessState | null) => {
            const interaction = state?.sys?.interaction?.current;
            if (interaction?.kind !== 'compare-roll-choice' || typeof interaction.id !== 'string') {
                return;
            }
            if (snapshot.compareRollInteractionIds[snapshot.compareRollInteractionIds.length - 1] !== interaction.id) {
                snapshot.compareRollInteractionIds.push(interaction.id);
            }
        };

        const collectMatches = (root: Element, selector: string) => {
            const matches: Element[] = [];
            if (root.matches(selector)) {
                matches.push(root);
            }
            matches.push(...Array.from(root.querySelectorAll(selector)));
            return matches;
        };

        const readOverlaySnapshot = () => {
            const overlay = document.querySelector('[data-testid="compare-roll-overlay"]') as HTMLElement | null;
            if (!overlay) {
                return {
                    visible: false,
                    rect: null,
                    opacity: null,
                    transform: null,
                    text: null,
                };
            }

            const rect = overlay.getBoundingClientRect();
            const style = window.getComputedStyle(overlay);
            return {
                visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
                rect: {
                    x: Math.round(rect.x * 100) / 100,
                    y: Math.round(rect.y * 100) / 100,
                    width: Math.round(rect.width * 100) / 100,
                    height: Math.round(rect.height * 100) / 100,
                },
                opacity: style.opacity,
                transform: style.transform,
                text: overlay.textContent?.trim() ?? null,
            };
        };

        const readDamageFloatTexts = () => Array.from(
            document.querySelectorAll('[data-floating-text-preset="impact-damage"]'),
        )
            .map((node) => node.textContent?.trim())
            .filter((value): value is string => Boolean(value));

        const pushTimeline = (reason: string) => {
            const state = getState();
            recordCompareRollInteraction(state);
            const overlay = readOverlaySnapshot();
            const damageEvents = getDamageEvents(state);
            snapshot.damageEvents = damageEvents;

            const timelineEntry: DuelAuditTimelineEntry = {
                atMs: Math.round((performance.now() - startedAt) * 100) / 100,
                reason,
                phase: state?.sys?.phase ?? null,
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                interactionId: state?.sys?.interaction?.current?.id ?? null,
                responseWindowType: state?.sys?.responseWindow?.current?.windowType ?? null,
                pendingAttackSourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
                pendingAttackDefenseAbilityId: state?.core?.pendingAttack?.defenseAbilityId ?? null,
                pendingAttackDamage: state?.core?.pendingAttack?.damage ?? null,
                hp0: state?.core?.players?.['0']?.resources?.hp ?? null,
                hp1: state?.core?.players?.['1']?.resources?.hp ?? null,
                overlayVisible: overlay.visible,
                overlayRect: overlay.rect,
                overlayOpacity: overlay.opacity,
                overlayTransform: overlay.transform,
                overlayText: overlay.text,
                damageFloatTexts: readDamageFloatTexts(),
                damageEventCount: damageEvents.length,
                lastDamageEvent: damageEvents.length > 0 ? damageEvents[damageEvents.length - 1] : null,
                lastRejectedCommand: ((window as Window & {
                    __BG_LAST_COMMAND_REJECTED__?: Record<string, unknown> | null;
                }).__BG_LAST_COMMAND_REJECTED__) ?? null,
            };

            const signature = JSON.stringify({
                reason,
                phase: timelineEntry.phase,
                interactionKind: timelineEntry.interactionKind,
                interactionId: timelineEntry.interactionId,
                responseWindowType: timelineEntry.responseWindowType,
                hp0: timelineEntry.hp0,
                hp1: timelineEntry.hp1,
                overlayVisible: timelineEntry.overlayVisible,
                overlayRect: timelineEntry.overlayRect,
                overlayOpacity: timelineEntry.overlayOpacity,
                overlayTransform: timelineEntry.overlayTransform,
                overlayText: timelineEntry.overlayText,
                damageFloatTexts: timelineEntry.damageFloatTexts,
                damageEventCount: timelineEntry.damageEventCount,
                lastDamageEvent: timelineEntry.lastDamageEvent,
                lastRejectedCommand: timelineEntry.lastRejectedCommand,
            });

            if (win.__DT_DUEL_AUDIT__?.lastSignature === signature) {
                return;
            }

            snapshot.timeline.push(timelineEntry);
            win.__DT_DUEL_AUDIT__!.lastSignature = signature;
        };

        const observer = new MutationObserver((records) => {
            for (const record of records) {
                for (const node of Array.from(record.addedNodes)) {
                    if (!(node instanceof Element)) continue;

                    const overlays = collectMatches(node, '[data-testid="compare-roll-overlay"]');
                    for (const overlay of overlays) {
                        snapshot.compareRollOverlayMountCount += 1;
                        const text = overlay.textContent?.trim();
                        if (text) snapshot.compareRollOverlayTexts.push(text);
                    }

                    const floats = collectMatches(node, '[data-floating-text-preset="impact-damage"]');
                    for (const floatNode of floats) {
                        snapshot.damageFloatMountCount += 1;
                        const text = floatNode.textContent?.trim();
                        if (text) snapshot.damageFloatTexts.push(text);
                    }
                }

                for (const node of Array.from(record.removedNodes)) {
                    if (!(node instanceof Element)) continue;
                    if (collectMatches(node, '[data-testid="compare-roll-overlay"]').length > 0) {
                        pushTimeline('mutation:overlay-removed');
                    }
                }
            }
            pushTimeline('mutation');
        });

        win.__DT_DUEL_AUDIT__ = {
            observer,
            timer: 0,
            startedAt,
            lastSignature: undefined,
            snapshot,
        };

        observer.observe(document.body, { childList: true, subtree: true });
        pushTimeline('probe-installed');
        win.__DT_DUEL_AUDIT__.timer = window.setInterval(() => {
            pushTimeline('interval');
        }, 50);
    });
}

async function readDuelAuditProbe(page: Page): Promise<DuelAuditSnapshot> {
    return await page.evaluate(() => {
        const win = window as Window & {
            __DT_DUEL_AUDIT__?: {
                snapshot: DuelAuditSnapshot;
            };
        };
        return {
            compareRollOverlayMountCount: win.__DT_DUEL_AUDIT__?.snapshot.compareRollOverlayMountCount ?? 0,
            compareRollOverlayTexts: [...(win.__DT_DUEL_AUDIT__?.snapshot.compareRollOverlayTexts ?? [])],
            damageFloatMountCount: win.__DT_DUEL_AUDIT__?.snapshot.damageFloatMountCount ?? 0,
            damageFloatTexts: [...(win.__DT_DUEL_AUDIT__?.snapshot.damageFloatTexts ?? [])],
            compareRollInteractionIds: [...(win.__DT_DUEL_AUDIT__?.snapshot.compareRollInteractionIds ?? [])],
            damageEvents: [...(win.__DT_DUEL_AUDIT__?.snapshot.damageEvents ?? [])],
            commandLog: [...(win.__DT_DUEL_AUDIT__?.snapshot.commandLog ?? [])],
            timeline: [...(win.__DT_DUEL_AUDIT__?.snapshot.timeline ?? [])],
        };
    });
}

async function recordDuelAuditMarker(page: Page, marker: string): Promise<void> {
    await page.evaluate(({ label }) => {
        const win = window as Window & {
            __DT_DUEL_AUDIT__?: {
                startedAt: number;
                lastSignature?: string;
                snapshot: DuelAuditSnapshot;
            };
        };
        if (!win.__DT_DUEL_AUDIT__) {
            return;
        }
        const atMs = Math.round((performance.now() - win.__DT_DUEL_AUDIT__.startedAt) * 100) / 100;
        win.__DT_DUEL_AUDIT__.snapshot.commandLog.push({
            atMs,
            marker: label,
            type: '__marker__',
            playerId: '',
            payload: {},
        });
        win.__DT_DUEL_AUDIT__.lastSignature = undefined;
    }, { label: marker });
}

async function dispatchHarnessCommand(
    page: Page,
    type: string,
    playerId: string,
    payload: Record<string, unknown> = {},
): Promise<void> {
    await page.evaluate(({ commandType, commandPlayerId, commandPayload }) => {
        const win = window as Window & {
            __DT_DUEL_AUDIT__?: {
                startedAt: number;
                lastSignature?: string;
                snapshot: DuelAuditSnapshot;
            };
        };
        if (!win.__DT_DUEL_AUDIT__) {
            return;
        }
        const atMs = Math.round((performance.now() - win.__DT_DUEL_AUDIT__.startedAt) * 100) / 100;
        win.__DT_DUEL_AUDIT__.snapshot.commandLog.push({
            atMs,
            marker: 'dispatch',
            type: commandType,
            playerId: commandPlayerId,
            payload: commandPayload,
        });
        win.__DT_DUEL_AUDIT__.lastSignature = undefined;
    }, {
        commandType: type,
        commandPlayerId: playerId,
        commandPayload: payload,
    });

    await page.waitForFunction(
        () => (window as any).__BG_TEST_HARNESS__?.command?.isRegistered?.() === true,
        { timeout: 15000 },
    );

    await page.evaluate(async ({ commandType, commandPlayerId, commandPayload }) => {
        const harness = (window as Window & {
            __BG_TEST_HARNESS__?: {
                command?: {
                    dispatch?: (command: {
                        type: string;
                        playerId: string;
                        payload: Record<string, unknown>;
                    }) => void | Promise<void>;
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

    await page.waitForTimeout(300);
}

test.describe('DiceThrone - 防御技能选择', () => {
    test('影贼双防御应先要求选择防御技能，再进入防御掷骰', async ({ page, game }) => {
        await setupDefenseEntryScene(game, 'shadow_thief');

        await dispatchHarnessCommand(page, 'ADVANCE_PHASE', '0');

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                defenseAbilityId: state?.core?.pendingAttack?.defenseAbilityId ?? null,
                rollCount: state?.core?.rollCount ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            phase: 'defensiveRoll',
            defenseAbilityId: null,
            rollCount: 0,
        });

        const highlightedSlots = page.locator(
            '[data-ability-slot-scope="main-board"][data-ability-slot][data-can-click="true"][data-should-highlight="true"]',
        );
        await expect(highlightedSlots.first()).toBeVisible({ timeout: 5000 });
        expect(await highlightedSlots.count()).toBeGreaterThanOrEqual(2);

        await highlightedSlots.first().click();

        await expect.poll(async () => {
            const state = await game.getState();
            if (state?.sys?.phase !== 'defensiveRoll') return null;
            return state?.core?.pendingAttack?.defenseAbilityId ?? null;
        }, { timeout: 5000 }).toMatch(/^(shadow-defense|fearless-riposte)$/);

        await expect(page.locator('[data-tutorial-id="dice-roll-button"]')).toBeEnabled({ timeout: 5000 });
    });

    test('圣骑单防御应自动选择 holy-defense 并直接进入防御掷骰', async ({ page, game }) => {
        await setupDefenseEntryScene(game, 'paladin');

        await dispatchHarnessCommand(page, 'ADVANCE_PHASE', '0');

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                defenseAbilityId: state?.core?.pendingAttack?.defenseAbilityId ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            phase: 'defensiveRoll',
            defenseAbilityId: 'holy-defense',
        });

        const state = await game.getState();
        expect(state.core.pendingAttack?.defenseAbilityId).toBe('holy-defense');
        await expect(page.locator('[data-tutorial-id="dice-roll-button"]')).toBeEnabled({ timeout: 5000 });
    });

    test('忍者瞬身 II 应在真实防御掷骰界面支持保留 1 颗并重投另外 2 颗', async ({ page, game }, testInfo) => {
        await setupNinjaBlink2DefenseScene(page, game);
        await dismissAttackShowcaseIfVisible(page);

        const rollButton = page.locator('[data-tutorial-id="dice-roll-button"]').first();
        const confirmButton = page.locator('[data-tutorial-id="dice-confirm-button"]').first();
        const endDefenseButton = page.getByRole('button', { name: /结束防御|End Defense/i }).first();

        await page.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.dice));
        await page.evaluate(() => {
            window.__BG_TEST_HARNESS__?.dice.setValues([1, 4, 6]);
        });

        await expect(rollButton).toBeEnabled({ timeout: 5000 });
        await rollButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                rollCount: state?.core?.rollCount ?? null,
                rollLimit: state?.core?.rollLimit ?? null,
                rollConfirmed: state?.core?.rollConfirmed ?? null,
                dice: (state?.core?.dice ?? []).slice(0, 3).map((die: any) => die?.value ?? null),
            };
        }, { timeout: 5000 }).toEqual({
            rollCount: 1,
            rollLimit: 2,
            rollConfirmed: false,
            dice: [1, 4, 6],
        });
        await game.screenshot('ninja-blink-2-defense-first-roll', testInfo);
        await expect(confirmButton).toBeEnabled({ timeout: 5000 });

        const firstDieButton = page.getByTestId('die-button-0');
        await expect(firstDieButton).toHaveAttribute('data-display-value', '1');
        await expect(firstDieButton).toHaveAttribute('data-clickable', 'true');
        await expect(firstDieButton).toBeVisible({ timeout: 5000 });
        await firstDieButton.click({ force: true });
        const dieLockedByUi = await expect.poll(async () => {
            const state = await game.getState();
            return state?.core?.dice?.[0]?.isKept ?? null;
        }, { timeout: 1500 }).toBe(true).then(() => true).catch(() => false);

        if (!dieLockedByUi) {
            const postUiClickState = await game.getState();
            const postUiClickDiceButtons = await page.evaluate(() => (
                Array.from(document.querySelectorAll('[data-testid^="die-button-"]')).map((node) => {
                    const element = node as HTMLElement;
                    return {
                        testId: element.getAttribute('data-testid'),
                        displayValue: element.getAttribute('data-display-value'),
                        clickable: element.getAttribute('data-clickable'),
                        selected: element.getAttribute('data-selected'),
                    };
                })
            ));

            await dispatchHarnessCommand(page, 'TOGGLE_DIE_LOCK', '1', { dieId: 0 });
            const dieLockedByHarness = await expect.poll(async () => {
                const state = await game.getState();
                return state?.core?.dice?.[0]?.isKept ?? null;
            }, { timeout: 2000 }).toBe(true).then(() => true).catch(() => false);

            if (!dieLockedByHarness) {
                throw new Error(`瞬身 II 防御锁骰失败：真实 UI 点击与 harness 命令都未能锁定 die 0。postUiClickState=${JSON.stringify(postUiClickState?.core?.dice?.slice(0, 5) ?? null)} postUiClickDiceButtons=${JSON.stringify(postUiClickDiceButtons)}`);
            }

            throw new Error(`瞬身 II 防御锁骰失败：真实 UI 点击未锁定 die 0，但 harness 命令可以锁定，说明红点落在 UI 点击链而非技能实现。postUiClickState=${JSON.stringify(postUiClickState?.core?.dice?.slice(0, 5) ?? null)} postUiClickDiceButtons=${JSON.stringify(postUiClickDiceButtons)}`);
        }

        await page.evaluate(() => {
            window.__BG_TEST_HARNESS__?.dice.setValues([6, 6]);
        });
        await expect(rollButton).toBeEnabled({ timeout: 5000 });
        await rollButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                rollCount: state?.core?.rollCount ?? null,
                rollLimit: state?.core?.rollLimit ?? null,
                dice: (state?.core?.dice ?? []).slice(0, 3).map((die: any) => die?.value ?? null),
            };
        }, { timeout: 5000 }).toEqual({
            rollCount: 2,
            rollLimit: 2,
            dice: [1, 6, 6],
        });
        await game.screenshot('ninja-blink-2-defense-second-roll', testInfo);

        await expect(confirmButton).toBeEnabled({ timeout: 5000 });
        await confirmButton.click();
        await expect(endDefenseButton).toBeEnabled({ timeout: 5000 });
        await endDefenseButton.click();

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                attackerHp: state?.core?.players?.['0']?.resources?.[RESOURCE_IDS.HP] ?? null,
                smokeBomb: state?.core?.players?.['1']?.tokens?.[TOKEN_IDS.SMOKE_BOMB] ?? 0,
                pendingAttack: Boolean(state?.core?.pendingAttack),
            };
        }, { timeout: 10000 }).toEqual({
            phase: 'main2',
            attackerHp: 29,
            smokeBomb: 1,
            pendingAttack: false,
        });
        await game.screenshot('ninja-blink-2-defense-closeout', testInfo);
    });

    test('枪手 Duel 对掷展示窗首次出现时不应半弹后重开', async ({ page, game }, testInfo) => {
        await setupGunslingerDuelAgainstHarmonyScene(game);
        await installDuelAuditProbe(page);
        let auditPath = '';

        try {
            await openGunslingerDuelCompareRollChoice(page, game);

            const overlay = page.getByTestId('compare-roll-overlay');
            await expect(overlay).toBeVisible({ timeout: 5000 });
            await expect(page.getByTestId('compare-roll-result')).toContainText('你赢得了对决');
            await expect(page.getByRole('button', { name: '抵挡 1/2 进攻伤害' })).toBeVisible({ timeout: 5000 });
            await game.screenshot('gunslinger-duel-harmony-compare-roll-first-open', testInfo);

            await page.waitForTimeout(1800);

            const audit = await readDuelAuditProbe(page);
            expect(audit.compareRollOverlayMountCount).toBe(1);
            expect(getOverlayVisibleSegmentCount(audit.timeline)).toBe(1);
            expect(getVisibleOverlayInteractionIdCount(audit.timeline)).toBe(1);
            expect(hasOverlayCollapseReopenPattern(audit.timeline)).toBe(false);

            await recordDuelAuditMarker(page, 'ui:click-prevent-half');
            await page.getByRole('button', { name: '抵挡 1/2 进攻伤害' }).click();
            await expect.poll(async () => {
                const state = await game.getState();
                return {
                    phase: state?.sys?.phase ?? null,
                    interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                };
            }, { timeout: 5000 }).toMatchObject({
                phase: 'defensiveRoll',
                interactionKind: null,
            });

            await dispatchHarnessCommand(page, 'ADVANCE_PHASE', '0');
            await expect.poll(async () => {
                const state = await game.getState();
                return {
                    phase: state?.sys?.phase ?? null,
                    hp: state?.core?.players?.['0']?.resources?.hp ?? null,
                    interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                };
            }, { timeout: 5000 }).toMatchObject({
                phase: 'main2',
                hp: 48,
                interactionKind: null,
            });
        } finally {
            const audit = await readDuelAuditProbe(page);
            auditPath = await saveDuelAuditLog(testInfo, 'gunslinger-duel-compare-roll-audit.json', audit);
            testInfo.annotations.push({ type: 'duel-audit-json', description: auditPath });
        }
    });

    test('枪手 Duel 选择抵挡一半后仍应播放僧侣天人合一的伤害浮字', async ({ page, game }, testInfo) => {
        await setupGunslingerDuelAgainstHarmonyScene(game);
        await installDuelAuditProbe(page);
        let auditPath = '';

        try {
            await openGunslingerDuelCompareRollChoice(page, game);

            await expect(page.getByTestId('compare-roll-overlay')).toBeVisible({ timeout: 5000 });
            await expect(page.getByRole('button', { name: '抵挡 1/2 进攻伤害' })).toBeVisible({ timeout: 5000 });
            await game.screenshot('gunslinger-duel-harmony-before-prevent-half', testInfo);

            await recordDuelAuditMarker(page, 'ui:click-prevent-half');
            await page.getByRole('button', { name: '抵挡 1/2 进攻伤害' }).click();
            await expect.poll(async () => {
                const state = await game.getState();
                return {
                    phase: state?.sys?.phase ?? null,
                    interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                };
            }, { timeout: 5000 }).toMatchObject({
                phase: 'defensiveRoll',
                interactionKind: null,
            });

            await dispatchHarnessCommand(page, 'ADVANCE_PHASE', '0');

            await expect.poll(async () => {
                const state = await game.getState();
                return {
                    phase: state?.sys?.phase ?? null,
                    hp: state?.core?.players?.['0']?.resources?.hp ?? null,
                    interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                };
            }, { timeout: 5000 }).toMatchObject({
                phase: 'main2',
                hp: 48,
                interactionKind: null,
            });

            await expect.poll(async () => {
                const audit = await readDuelAuditProbe(page);
                return audit.damageFloatMountCount > 0
                    && audit.damageFloatTexts.some((text) => text.includes('2'))
                    && audit.damageEvents.some((event) =>
                        event.targetId === '0'
                        && event.sourceAbilityId === 'harmony'
                    );
            }, { timeout: 5000 }).toBe(true);

            await game.screenshot('gunslinger-duel-harmony-damage-float', testInfo);
        } finally {
            const audit = await readDuelAuditProbe(page);
            auditPath = await saveDuelAuditLog(testInfo, 'gunslinger-duel-damage-float-audit.json', audit);
            testInfo.annotations.push({ type: 'duel-audit-json', description: auditPath });
        }
    });

    test('枪手 Showdown 应展示双方对掷 UI，并在自动确认后写入加伤', async ({ page, game }, testInfo) => {
        await setupGunslingerShowdownScene(game);

        await dispatchHarnessCommand(page, 'ADVANCE_PHASE', '0');
        await expect.poll(async () => {
            const state = await game.getState();
            return {
                phase: state?.sys?.phase ?? null,
                rollContextKind: state?.core?.currentRollContext?.kind ?? null,
                rollContextOwner: state?.core?.currentRollContext?.ownerPlayerId ?? null,
            };
        }, { timeout: 5000 }).toMatchObject({
            phase: 'offensiveRoll',
            rollContextKind: 'compare',
            rollContextOwner: '0',
        });

        await dispatchHarnessCommand(page, 'CONFIRM_COMPARE_ROLL', '0');

        const overlay = page.getByTestId('compare-roll-overlay');
        await expect(overlay).toBeVisible({ timeout: 5000 });
        await expect(page.getByTestId('compare-roll-participant-0')).toBeVisible();
        await expect(page.getByTestId('compare-roll-participant-1')).toBeVisible();
        await expect(page.getByTestId('compare-roll-result')).toContainText('本次攻击伤害 +2');
        await expect(page.getByTestId('compare-roll-autoconfirm')).toContainText('确认中');
        await game.screenshot('gunslinger-showdown-compare-roll-open', testInfo);

        await expect.poll(async () => {
            const state = await game.getState();
            return {
                interactionKind: state?.sys?.interaction?.current?.kind ?? null,
                phase: state?.sys?.phase ?? null,
                bonusDamage: state?.core?.pendingAttack?.bonusDamage ?? null,
                sourceAbilityId: state?.core?.pendingAttack?.sourceAbilityId ?? null,
            };
        }, { timeout: 8000 }).toMatchObject({
            interactionKind: null,
            phase: 'defensiveRoll',
            bonusDamage: 2,
            sourceAbilityId: 'showdown',
        });

        await expect(overlay).toBeHidden();
        await game.screenshot('gunslinger-showdown-compare-roll-closed', testInfo);
    });
});
