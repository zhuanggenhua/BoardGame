import { expect, test, type Page } from '@playwright/test';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createDustFeverishAttackReadyRuntimeCore,
    createDustFeverishNaturalMonsterTurnBeforeRollRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    setHarnessRandomQueue,
    waitForBetrayalPageReady,
    waitForPhysicalDiceSettled,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';
import type { BetrayalCore } from '../../src/games/betrayal/game';

const EVIDENCE_DIR = 'evidence/betrayal-the-dust-feverish-natural-monster-turn';
const NATURAL_BEFORE_SCREENSHOT = `${EVIDENCE_DIR}/01-灰尘狂热病患自然回合-上一玩家结束前.jpg`;
const NATURAL_ROLL_SCREENSHOT = `${EVIDENCE_DIR}/02-灰尘狂热病患自然回合-移动骰出现.jpg`;
const NATURAL_MOVE_TARGET_SCREENSHOT = `${EVIDENCE_DIR}/03-灰尘狂热病患自然回合-移动目标高亮.jpg`;
const NATURAL_HANDOFF_SCREENSHOT = `${EVIDENCE_DIR}/04-灰尘狂热病患自然回合-结束后交接.jpg`;
const ATTACK_READY_SCREENSHOT = `${EVIDENCE_DIR}/05-灰尘狂热病患攻击前动作槽.jpg`;
const ATTACK_TARGET_SCREENSHOT = `${EVIDENCE_DIR}/06-灰尘狂热病患攻击目标高亮.jpg`;
const ATTACK_DICE_SCREENSHOT = `${EVIDENCE_DIR}/07-灰尘狂热病患攻击骰盘.jpg`;
const NATURAL_FEVERISH_TEST_URL = '/play/betrayal?players=3&playerID=2&seat0=human&seat1=human&seat2=human&seed=the-dust-feverish-natural-turn';
const FEVERISH_CONTROLLER_TEST_URL = '/play/betrayal?players=3&playerID=0&seat0=human&seat1=human&seat2=human&seed=the-dust-feverish-natural-controller';
const ATTACK_FEVERISH_TEST_URL = '/play/betrayal?players=3&playerID=0&seat0=human&seat1=human&seat2=human&seed=the-dust-feverish-attack';
const FEVERISH_ID = 'feverish-0';
const FEVERISH_START_ROOM_ID = 'hallway';
const FEVERISH_MOVE_TARGET_ROOM_ID = 'entrance-hall';
const HERO_TARGET_PLAYER_ID = '1';

type FeverishState = {
    currentPlayer?: string;
    activeRoomId?: string | null;
    movesRemaining?: number | null;
    recentRollKind?: string | null;
    recentRollTrait?: string | null;
    recentRollDice?: number[] | null;
    feverishRoomId?: string | null;
    feverishPlayerIds?: string[];
    deadPlayerIds?: string[];
    attackedMonsterIdsThisTurn?: string[];
    pendingDamagePlayerId?: string | null;
};

const readFeverishState = async (page: Page): Promise<FeverishState> =>
    page.evaluate(({ monsterId }) => {
        const snapshot = (window as typeof window & {
            __BG_TEST_HARNESS__?: {
                state?: {
                    get?: () => {
                        core?: {
                            currentPlayer?: string;
                            activeRoomId?: string | null;
                            movesRemaining?: number | null;
                            monsters?: Array<{ id: string; roomId: string | null }>;
                            recentRoll?: { kind?: string; trait?: string; dice?: number[] } | null;
                            pendingDamageAllocation?: { playerId?: string } | null;
                            scenarioRuntime?: {
                                deadExplorerPlayerIds?: string[];
                                dust?: { feverishPlayerIds?: string[] };
                                monsterTurn?: { attackedMonsterIdsThisTurn?: string[] };
                            };
                        };
                    };
                };
            };
        }).__BG_TEST_HARNESS__?.state?.get?.();
        const core = snapshot?.core;
        const feverish = core?.monsters?.find((monster) => monster.id === monsterId);
        return {
            currentPlayer: core?.currentPlayer,
            activeRoomId: core?.activeRoomId ?? null,
            movesRemaining: core?.movesRemaining ?? null,
            recentRollKind: core?.recentRoll?.kind ?? null,
            recentRollTrait: core?.recentRoll?.trait ?? null,
            recentRollDice: core?.recentRoll?.dice ?? null,
            feverishRoomId: feverish?.roomId ?? null,
            feverishPlayerIds: core?.scenarioRuntime?.dust?.feverishPlayerIds ?? [],
            deadPlayerIds: core?.scenarioRuntime?.deadExplorerPlayerIds ?? [],
            attackedMonsterIdsThisTurn:
                core?.scenarioRuntime?.monsterTurn?.attackedMonsterIdsThisTurn ?? [],
            pendingDamagePlayerId: core?.pendingDamageAllocation?.playerId ?? null,
        };
    }, { monsterId: FEVERISH_ID });

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

const dismissRecentRollPanelIfVisible = async (page: Page) => {
    const rollPanel = page.getByTestId('betrayal-recent-roll-panel');
    if (await rollPanel.isVisible({ timeout: 1000 }).catch(() => false)) {
        await page.getByRole('button', { name: /返回牌桌/ }).click();
        await expect(page.getByTestId('betrayal-recent-roll-panel')).toHaveCount(0);
    }
};

test.describe('山屋惊魂作祟3灰尘狂热病患自然怪物回合', () => {
    test('死亡叛徒变狂热病患后，自然轮到其移动并结束交给下一名玩家', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-the-dust-feverish-natural-turn');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(NATURAL_FEVERISH_TEST_URL, { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await injectCore(page, createDustFeverishNaturalMonsterTurnBeforeRollRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect.poll(() => readFeverishState(page)).toMatchObject({
            currentPlayer: '2',
            feverishRoomId: FEVERISH_START_ROOM_ID,
            feverishPlayerIds: ['0'],
            deadPlayerIds: expect.arrayContaining(['0']),
            recentRollKind: null,
        });
        await dismissHauntRevealCueIfVisible(page);
        await expect(page.getByTestId('betrayal-action-endTurn')).toBeEnabled();
        await expect(page.getByTestId(`betrayal-room-monster-${FEVERISH_START_ROOM_ID}-${FEVERISH_ID}`)).toBeVisible();
        await saveScreenshot(page, NATURAL_BEFORE_SCREENSHOT);

        await setHarnessRandomQueue(page, [0.5, 0.5, 0.01, 0.01, 0.01]);
        await page.getByTestId('betrayal-action-endTurn').click();
        await expect.poll(() => readFeverishState(page)).toMatchObject({
            currentPlayer: '0',
            activeRoomId: FEVERISH_START_ROOM_ID,
            movesRemaining: 2,
            recentRollKind: 'monsterMoveRoll',
            recentRollTrait: 'speed',
            recentRollDice: [1, 1, 0, 0, 0],
            feverishRoomId: FEVERISH_START_ROOM_ID,
        });
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/狂热病患速度 5 投出 2|本回合可移动 2 间/);
        await saveScreenshot(page, NATURAL_ROLL_SCREENSHOT);

        const feverishControllerCore = await readHarnessCore(page);
        await page.goto(FEVERISH_CONTROLLER_TEST_URL, { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);
        await injectCore(page, feverishControllerCore);
        await expect.poll(() => readFeverishState(page)).toMatchObject({
            currentPlayer: '0',
            activeRoomId: FEVERISH_START_ROOM_ID,
            movesRemaining: 2,
            recentRollKind: 'monsterMoveRoll',
            feverishRoomId: FEVERISH_START_ROOM_ID,
        });
        await dismissHauntRevealCueIfVisible(page);
        await dismissRecentRollPanelIfVisible(page);
        await page.getByTestId('betrayal-action-move').click();
        await expect(page.getByTestId(`betrayal-room-${FEVERISH_MOVE_TARGET_ROOM_ID}`)).toBeEnabled();
        await saveScreenshot(page, NATURAL_MOVE_TARGET_SCREENSHOT);

        await page.getByTestId(`betrayal-room-${FEVERISH_MOVE_TARGET_ROOM_ID}`).click();
        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText(/狂热病患移动到了/);
        await expect.poll(() => readFeverishState(page)).toMatchObject({
            currentPlayer: '0',
            activeRoomId: FEVERISH_MOVE_TARGET_ROOM_ID,
            feverishRoomId: FEVERISH_MOVE_TARGET_ROOM_ID,
            movesRemaining: 1,
        });

        await page.getByTestId('betrayal-action-endTurn').click();
        await expect.poll(() => readFeverishState(page)).toMatchObject({
            currentPlayer: '1',
            recentRollKind: null,
            feverishRoomId: FEVERISH_MOVE_TARGET_ROOM_ID,
        });
        await saveScreenshot(page, NATURAL_HANDOFF_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-the-dust-feverish-natural-turn', diagnostics }]);
    });

    test('狂热病患从怪物动作槽进入攻击态后，可点地图英雄 token 结算攻击', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-the-dust-feverish-attack');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(ATTACK_FEVERISH_TEST_URL, { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await injectCore(page, createDustFeverishAttackReadyRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await expect.poll(() => readFeverishState(page)).toMatchObject({
            currentPlayer: '0',
            feverishRoomId: FEVERISH_START_ROOM_ID,
            movesRemaining: 0,
        });
        await dismissHauntRevealCueIfVisible(page);

        const monsterAttackAction = page.getByTestId('betrayal-action-monsterAttack');
        const feverishToken = page.getByTestId(`betrayal-room-monster-${FEVERISH_START_ROOM_ID}-${FEVERISH_ID}`);
        const heroTargetToken = page.getByTestId(`betrayal-room-occupant-${FEVERISH_START_ROOM_ID}-${HERO_TARGET_PLAYER_ID}`);
        await expect(monsterAttackAction).toBeVisible();
        await expect(monsterAttackAction).toContainText('狂热病患攻击');
        await expect(feverishToken).toBeVisible();
        await expect(heroTargetToken).toBeVisible();
        await expect(heroTargetToken).not.toHaveAttribute('data-direct-target', 'true');
        await saveScreenshot(page, ATTACK_READY_SCREENSHOT);

        await monsterAttackAction.click();
        await expect(monsterAttackAction).toContainText('取消攻击');
        await expect(page.getByTestId('betrayal-action-cue')).toContainText('狂热病患');
        await expect(feverishToken).toHaveAttribute('data-direct-target', 'true');
        await feverishToken.click();
        await expect(heroTargetToken).toHaveAttribute('data-direct-target', 'true');
        await expect(page.getByTestId(`betrayal-room-occupant-target-outline-${FEVERISH_START_ROOM_ID}-${HERO_TARGET_PLAYER_ID}`)).toHaveAttribute('data-highlight-shape', 'pentagon');
        await saveScreenshot(page, ATTACK_TARGET_SCREENSHOT);

        await setHarnessRandomQueue(page, [
            0.99, 0.99, 0.99, 0.99, 0.99, 0.99,
            0.01, 0.01, 0.01, 0.01, 0.01,
        ]);
        await heroTargetToken.click();

        await expect(page.getByTestId('betrayal-room-latest-feedback')).toContainText('狂热病患');
        const attackRollPanel = page.getByTestId('betrayal-recent-roll-panel');
        await expect(attackRollPanel).toBeVisible();
        await expect(attackRollPanel).toContainText('狂热病患攻击');
        await expect(attackRollPanel).toContainText('攻击投骰');
        await waitForPhysicalDiceSettled(attackRollPanel);
        await saveScreenshot(page, ATTACK_DICE_SCREENSHOT);
        await expect.poll(() => readFeverishState(page)).toMatchObject({
            attackedMonsterIdsThisTurn: expect.arrayContaining([FEVERISH_ID]),
            pendingDamagePlayerId: HERO_TARGET_PLAYER_ID,
        });

        assertNoFatalFrontendErrors([{ label: 'betrayal-the-dust-feverish-attack', diagnostics }]);
    });
});
