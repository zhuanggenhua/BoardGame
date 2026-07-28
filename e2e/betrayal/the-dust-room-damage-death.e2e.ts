import { expect, test, type Page } from '@playwright/test';
import type { BetrayalCore } from '../../src/games/betrayal/game';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    createDustRoomDamageDeathRuntimeCore,
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = 'evidence/betrayal-the-dust-room-damage-death';
const BEFORE_SCREENSHOT = `${EVIDENCE_DIR}/01-火炉房伤害前.jpg`;
const DAMAGE_PANEL_SCREENSHOT = `${EVIDENCE_DIR}/02-火炉房伤害分配面板.jpg`;
const FEVERISH_SCREENSHOT = `${EVIDENCE_DIR}/03-确认分配后狂热病患生成.jpg`;
const TEST_URL = '/play/betrayal?players=3&playerID=1&seat0=human&seat1=human&seat2=human&seed=the-dust-room-damage-death';
const FURNACE_ROOM_ID = 'ground-north';
const TARGET_PLAYER_ID = '1';
const NEXT_PLAYER_ID = '2';
const FEVERISH_ID = `feverish-${TARGET_PLAYER_ID}`;

type DustRoomDamageDeathState = {
    phase?: string;
    currentPlayer?: string;
    currentRoomId?: string | null;
    furnaceRoomName?: string | null;
    pendingDamageAllocation?: {
        playerId?: string;
        sourceTitle?: string;
        damageKind?: string;
        amount?: number;
        allowedTraits?: string[];
        allowSkull?: boolean;
        nextPlayerId?: string | null;
    } | null;
    deadPlayerIds?: string[];
    feverishPlayerIds?: string[];
    feverishRoomId?: string | null;
    permanentTraitorPlayerIds?: string[];
    endgameResult?: {
        hauntId?: string;
        outcome?: string;
        winners?: string[];
    } | null;
    latestLog?: string;
};

const readDustRoomDamageDeathState = async (
    page: Page,
): Promise<DustRoomDamageDeathState> =>
    page.evaluate(({ furnaceRoomId, feverishId }) => {
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
        const furnaceRoom = core?.rooms?.find((room) => room.id === furnaceRoomId);
        return {
            phase: core?.phase,
            currentPlayer: core?.currentPlayer,
            currentRoomId: core?.currentExplorer?.roomId ?? null,
            furnaceRoomName: furnaceRoom?.name ?? null,
            pendingDamageAllocation: core?.pendingDamageAllocation ?? null,
            deadPlayerIds: core?.scenarioRuntime?.deadExplorerPlayerIds ?? [],
            feverishPlayerIds: core?.scenarioRuntime?.dust?.feverishPlayerIds ?? [],
            feverishRoomId: feverish?.roomId ?? null,
            permanentTraitorPlayerIds: core?.scenarioRuntime?.dust?.permanentTraitorPlayerIds ?? [],
            endgameResult: core?.endgameResult ?? null,
            latestLog: core?.activityLog?.[0]?.text ?? '',
        };
    }, { furnaceRoomId: FURNACE_ROOM_ID, feverishId: FEVERISH_ID });

const dismissHauntRevealCueIfVisible = async (page: Page) => {
    const closeButton = page.getByTestId('betrayal-haunt-reveal-close');
    if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click();
        await expect(page.getByTestId('betrayal-haunt-reveal-cue')).toHaveCount(0);
    }
};

test.describe('山屋惊魂作祟3灰尘房间伤害致死', () => {
    test('永久叛徒在火炉房结束回合受到房间伤害时，先分配伤害，确认死亡后生成狂热病患', async ({ page, context }) => {
        test.setTimeout(120000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-the-dust-room-damage-death');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto(TEST_URL, { waitUntil: 'domcontentloaded' });
        await waitForBetrayalPageReady(page);

        await injectCore(page, createDustRoomDamageDeathRuntimeCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await dismissHauntRevealCueIfVisible(page);
        await expect.poll(() => readDustRoomDamageDeathState(page)).toMatchObject({
            phase: 'haunt',
            currentPlayer: TARGET_PLAYER_ID,
            currentRoomId: FURNACE_ROOM_ID,
            furnaceRoomName: '火炉房',
            pendingDamageAllocation: null,
            deadPlayerIds: [],
            feverishPlayerIds: [],
            permanentTraitorPlayerIds: [TARGET_PLAYER_ID],
            endgameResult: null,
        });
        await expect(page.getByTestId('betrayal-dust-progress-strip')).toContainText('灰尘');
        await expect(page.getByTestId('betrayal-action-endTurn')).toBeEnabled();
        await saveScreenshot(page, BEFORE_SCREENSHOT);

        await page.getByTestId('betrayal-action-endTurn').click();

        const damagePanel = page.getByTestId('betrayal-damage-allocation-panel');
        await expect(damagePanel).toBeVisible();
        await expect(damagePanel).toHaveAttribute('data-player-id', TARGET_PLAYER_ID);
        await expect(page.getByTestId('betrayal-damage-allocation-source')).toContainText('火炉房');
        await expect(page.getByTestId('betrayal-damage-allocation-amount')).toContainText('1 点物理伤害');
        await expect(page.getByTestId('betrayal-damage-allocation-traits')).toContainText('力量');
        await expect(page.getByTestId('betrayal-damage-allocation-traits')).toContainText('速度');
        await expect(page.getByTestId('betrayal-damage-allocation-confirm')).toBeDisabled();
        await expect.poll(() => readDustRoomDamageDeathState(page)).toMatchObject({
            currentPlayer: TARGET_PLAYER_ID,
            pendingDamageAllocation: {
                playerId: TARGET_PLAYER_ID,
                sourceTitle: '火炉房',
                damageKind: 'physical',
                amount: 1,
                allowedTraits: ['might', 'speed'],
                allowSkull: true,
                nextPlayerId: NEXT_PLAYER_ID,
            },
            deadPlayerIds: [],
            feverishPlayerIds: [],
        });
        await saveScreenshot(page, DAMAGE_PANEL_SCREENSHOT);

        await page.getByTestId('betrayal-damage-allocation-trait-might').click();
        await expect(page.getByTestId('betrayal-damage-allocation-trait-might')).toHaveAttribute('data-damage-selected-count', '1');
        await expect(page.getByTestId('betrayal-damage-allocation-confirm')).toBeEnabled();
        await page.getByTestId('betrayal-damage-allocation-confirm').click();

        await expect(damagePanel).toHaveCount(0);
        await expect(page.getByTestId(`betrayal-room-monster-${FURNACE_ROOM_ID}-${FEVERISH_ID}`)).toBeVisible({ timeout: 30000 });
        await expect(page.getByTestId('betrayal-endgame-screen')).toHaveCount(0);
        await expect.poll(() => readDustRoomDamageDeathState(page)).toMatchObject({
            phase: 'haunt',
            currentPlayer: NEXT_PLAYER_ID,
            pendingDamageAllocation: null,
            deadPlayerIds: expect.arrayContaining([TARGET_PLAYER_ID]),
            feverishPlayerIds: expect.arrayContaining([TARGET_PLAYER_ID]),
            feverishRoomId: FURNACE_ROOM_ID,
            endgameResult: null,
        });
        await saveScreenshot(page, FEVERISH_SCREENSHOT);

        assertNoFatalFrontendErrors([{ label: 'betrayal-the-dust-room-damage-death', diagnostics }]);
    });
});
