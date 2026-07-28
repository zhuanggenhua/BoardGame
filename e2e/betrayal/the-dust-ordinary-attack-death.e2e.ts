import { expect, test, type Page } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createDustOrdinaryAttackDeathRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    setHarnessRandomQueue,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';
import type { BetrayalCore } from '../../src/games/betrayal/game';

const EVIDENCE_DIR = 'evidence/betrayal-the-dust-ordinary-attack-death';
const BEFORE_SCREENSHOT = `${EVIDENCE_DIR}/01-普通攻击前.jpg`;
const DAMAGE_PANEL_SCREENSHOT = `${EVIDENCE_DIR}/02-攻击后伤害分配面板.jpg`;
const TRAITOR_VICTORY_SCREENSHOT = `${EVIDENCE_DIR}/03-确认分配后叛徒胜利.jpg`;
const ATTACKER_TEST_URL = '/play/betrayal?players=3&playerID=0&seat0=human&seat1=human&seat2=human&seed=the-dust-ordinary-attack-death';
const DEFENDER_TEST_URL = '/play/betrayal?players=3&playerID=1&seat0=human&seat1=human&seat2=human&seed=the-dust-ordinary-attack-death-defender';
const SHARED_ROOM_ID = 'hallway';
const ATTACKER_ID = '0';
const DEFENDER_ID = '1';
const ALREADY_DEAD_ID = '2';

type DustOrdinaryAttackDeathState = {
    phase?: string;
    currentPlayer?: string;
    currentRoomId?: string | null;
    otherRooms?: Record<string, string | null>;
    pendingDamageAllocation?: {
        playerId?: string;
        sourceTitle?: string;
        damageKind?: string;
        amount?: number;
        allowedTraits?: string[];
        allowSkull?: boolean;
    } | null;
    recentRoll?: {
        kind?: string;
        sourceTitle?: string;
        dice?: number[];
        passiveBonus?: number;
        latestLabel?: string;
        attack?: {
            previousDamageToDefender?: number;
            defenderRoll?: number;
        };
    } | null;
    deadPlayerIds?: string[];
    feverishPlayerIds?: string[];
    feverishRoomId?: string | null;
    endgameResult?: {
        hauntId?: string;
        outcome?: string;
        winners?: string[];
    } | null;
    latestLog?: string;
};

const readDustOrdinaryAttackDeathState = async (
    page: Page,
): Promise<DustOrdinaryAttackDeathState> =>
    page.evaluate(({ feverishId }) => {
        const core = (window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: BetrayalCore;
                    };
                };
            };
        }).__BG_TEST_HARNESS__?.state?.get?.()?.core;
        const feverish = core?.monsters?.find((monster) => monster.id === feverishId);
        return {
            phase: core?.phase,
            currentPlayer: core?.currentPlayer,
            currentRoomId: core?.currentExplorer?.roomId ?? null,
            otherRooms: Object.fromEntries(
                (core?.otherExplorers ?? []).map((explorer) => [
                    explorer.playerId,
                    explorer.roomId ?? null,
                ]),
            ),
            pendingDamageAllocation: core?.pendingDamageAllocation ?? null,
            recentRoll: core?.recentRoll
                ? {
                    kind: core.recentRoll.kind,
                    sourceTitle: core.recentRoll.sourceTitle,
                    dice: core.recentRoll.dice,
                    passiveBonus: core.recentRoll.passiveBonus,
                    latestLabel: core.recentRoll.latestLabel,
                    attack: core.recentRoll.attack
                        ? {
                            previousDamageToDefender: core.recentRoll.attack.previousDamageToDefender,
                            defenderRoll: core.recentRoll.attack.defenderRoll,
                        }
                        : undefined,
                }
                : null,
            deadPlayerIds: core?.scenarioRuntime?.deadExplorerPlayerIds ?? [],
            feverishPlayerIds: core?.scenarioRuntime?.dust?.feverishPlayerIds ?? [],
            feverishRoomId: feverish?.roomId ?? null,
            endgameResult: core?.endgameResult ?? null,
            latestLog: core?.activityLog?.[0]?.text ?? '',
        };
    }, { feverishId: `feverish-${DEFENDER_ID}` });

const readHarnessCore = async (page: Page): Promise<BetrayalCore> =>
    page.evaluate(() => {
        const core = (window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: { get?: () => { core?: BetrayalCore } };
            };
        }).__BG_TEST_HARNESS__?.state?.get?.()?.core;
        if (!core) {
            throw new Error('betrayal test harness core reader unavailable');
        }
        return core;
    });

const dismissHauntRevealCueIfVisible = async (page: Page) => {
    const closeButton = page.getByTestId('betrayal-haunt-reveal-close');
    if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click();
        await expect(page.getByTestId('betrayal-haunt-reveal-cue')).toHaveCount(0);
    }
};

test.describe('山屋惊魂作祟3灰尘普通攻击致死分配', () => {
    test('玩家从地图普通攻击同房探索者后，伤害先分配，确认后才变狂热病患并触发叛徒胜利', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-the-dust-ordinary-attack-death');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(ATTACKER_TEST_URL, { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await injectCore(page, createDustOrdinaryAttackDeathRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await dismissHauntRevealCueIfVisible(page);
        await expect.poll(() => readDustOrdinaryAttackDeathState(page)).toMatchObject({
            phase: 'haunt',
            currentPlayer: ATTACKER_ID,
            currentRoomId: SHARED_ROOM_ID,
            otherRooms: {
                [DEFENDER_ID]: SHARED_ROOM_ID,
                [ALREADY_DEAD_ID]: 'entrance-hall',
            },
            pendingDamageAllocation: null,
            deadPlayerIds: [ALREADY_DEAD_ID],
            feverishPlayerIds: [],
            endgameResult: null,
        });
        const attackAction = page.getByTestId('betrayal-action-use');
        const defenderToken = page.getByTestId(`betrayal-room-occupant-${SHARED_ROOM_ID}-${DEFENDER_ID}`);
        await expect(attackAction).toBeVisible();
        await expect(attackAction).toContainText('攻击灰尘');
        await expect(attackAction).toHaveAttribute('data-haunt-primary-action-mode', 'choose-target');
        await expect(defenderToken).toBeVisible();
        await expect(defenderToken).not.toHaveAttribute('data-direct-target', 'true');
        await saveScreenshot(page, BEFORE_SCREENSHOT);

        await attackAction.click();
        await expect(attackAction).toHaveAttribute('data-haunt-primary-action-mode', 'targeting');
        await expect(defenderToken).toHaveAttribute('data-direct-target', 'true');
        await expect(page.getByTestId(`betrayal-room-occupant-target-outline-${SHARED_ROOM_ID}-${DEFENDER_ID}`)).toHaveAttribute('data-highlight-shape', 'pentagon');
        await setHarnessRandomQueue(page, [0.99, 0.99, 0.01, 0.01]);
        await defenderToken.click();

        await expect.poll(() => readDustOrdinaryAttackDeathState(page)).toMatchObject({
            phase: 'haunt',
            currentPlayer: ATTACKER_ID,
            pendingDamageAllocation: {
                playerId: DEFENDER_ID,
                sourceTitle: '攻击',
                damageKind: 'physical',
                amount: 4,
                allowedTraits: ['might', 'speed'],
                allowSkull: true,
            },
            recentRoll: {
                kind: 'attackRoll',
                sourceTitle: '攻击投骰',
                dice: [2, 2],
                passiveBonus: 0,
                latestLabel: '造成 4 点伤害',
                attack: {
                    previousDamageToDefender: 4,
                    defenderRoll: 0,
                },
            },
            deadPlayerIds: [ALREADY_DEAD_ID],
            feverishPlayerIds: [],
            endgameResult: null,
        });
        const defenderAllocationCore = await readHarnessCore(page);

        await page.goto(DEFENDER_TEST_URL, { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);
        await injectCore(page, defenderAllocationCore);
        await dismissHauntRevealCueIfVisible(page);

        const damagePanel = page.getByTestId('betrayal-damage-allocation-panel');
        await expect(damagePanel).toBeVisible();
        await expect(damagePanel).toHaveAttribute('data-player-id', DEFENDER_ID);
        await expect(page.getByTestId('betrayal-damage-allocation-source')).toContainText('攻击');
        await expect(page.getByTestId('betrayal-damage-allocation-amount')).toContainText('4 点物理伤害');
        await expect(page.getByTestId('betrayal-damage-allocation-traits')).toContainText('力量');
        await expect(page.getByTestId('betrayal-damage-allocation-traits')).toContainText('速度');
        await expect(page.getByTestId('betrayal-damage-allocation-confirm')).toBeDisabled();
        await saveScreenshot(page, DAMAGE_PANEL_SCREENSHOT);

        const mightDamage = page.getByTestId('betrayal-damage-allocation-trait-might');
        for (let index = 0; index < 4; index += 1) {
            await mightDamage.click();
        }
        await expect(mightDamage).toHaveAttribute('data-damage-selected-count', '4');
        await expect(page.getByTestId('betrayal-damage-allocation-confirm')).toBeEnabled();
        await page.getByTestId('betrayal-damage-allocation-confirm').click();

        const endgameScreen = page.getByTestId('betrayal-endgame-screen');
        await expect(endgameScreen).toBeVisible({ timeout: 30000 });
        await expect(endgameScreen).toContainText('灰尘');
        await expect(endgameScreen).toContainText('叛徒得逞');
        await expect.poll(() => readDustOrdinaryAttackDeathState(page)).toMatchObject({
            phase: 'endgame',
            pendingDamageAllocation: null,
            deadPlayerIds: expect.arrayContaining([DEFENDER_ID, ALREADY_DEAD_ID]),
            feverishPlayerIds: expect.arrayContaining([DEFENDER_ID]),
            feverishRoomId: SHARED_ROOM_ID,
            endgameResult: {
                hauntId: 'the-dust',
                outcome: 'traitor',
                winners: [ATTACKER_ID],
            },
        });
        await saveScreenshot(page, TRAITOR_VICTORY_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-the-dust-ordinary-attack-death', diagnostics }]);
    });
});
