import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { test, expect } from '../framework';
import {
    clearEvidenceScreenshotsForTest,
    getEvidenceScreenshotPath,
} from '../framework/evidenceScreenshots';
import { readCoreState, hideSmashUpDebugPanelForEvidence, setupSmashUpOnlineMatch } from '../helpers/smashup';
import { applyCoreStateDirect } from '../smashup-debug-helpers';

type SmashUpPlayerState = {
    id: string;
    vp: number;
    hand: unknown[];
    deck: unknown[];
    discard: unknown[];
    factions?: string[];
    minionsPlayed?: number;
    minionLimit?: number;
    actionsPlayed?: number;
    actionLimit?: number;
};

type SmashUpBaseMinion = {
    uid: string;
    defId: string;
    controller: string;
    owner: string;
    basePower: number;
    powerCounters: number;
    powerModifier: number;
    tempPowerModifier: number;
    talentUsed: boolean;
    playedThisTurn: boolean;
    attachedActions: unknown[];
    metadata?: Record<string, unknown>;
};

type SmashUpBaseState = {
    defId: string;
    breakpoint: number;
    minions: SmashUpBaseMinion[];
    ongoingActions?: unknown[];
};

type SmashUpCoreState = {
    turnOrder: string[];
    currentPlayerIndex: number;
    turnNumber?: number;
    players: Record<string, SmashUpPlayerState>;
    bases: SmashUpBaseState[];
    baseDeck?: string[];
    baseDiscard?: string[];
    nextUid?: number;
};

const ensureScreenshotDir = (path: string) => {
    mkdirSync(dirname(path), { recursive: true });
};

test.describe('SmashUp 模仿者卡面叠图', () => {
    test('在线对局：模仿者复制后应保留自己本体并叠加目标卡图下半部', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        await clearEvidenceScreenshotsForTest(testInfo);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupSmashUpOnlineMatch(
            browser,
            baseURL,
            {
                hostFactions: ['shapeshifters', 'cyborg_apes'],
                guestFactions: ['ninjas', 'robots'],
            },
        );

        if (!setup) {
            test.skip(true, '大杀四方在线房间不可用，无法执行真实页面截图链路');
            return;
        }

        const { hostPage, hostContext, guestContext } = setup;

        try {
            const core = await readCoreState(hostPage) as SmashUpCoreState;
            const currentPid = core.turnOrder[core.currentPlayerIndex] ?? '0';
            const opponentPid = core.turnOrder.find((pid) => pid !== currentPid) ?? '1';
            const turnNumber = core.turnNumber ?? 1;
            const base0 = core.bases[0];

            if (!base0) {
                throw new Error('缺少基地 0，无法注入模仿者复制态');
            }

            const copiedCopycat: SmashUpBaseMinion = {
                uid: 'copycat-board',
                defId: 'shapeshifters_copycat',
                controller: currentPid,
                owner: currentPid,
                basePower: 2,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [],
                metadata: {
                    copiedAbilityDefId: 'cyborg_apes_furious_george',
                    copiedAbilityUntilTurn: turnNumber,
                },
            };

            const referenceGeorge: SmashUpBaseMinion = {
                uid: 'furious-george-reference',
                defId: 'cyborg_apes_furious_george',
                controller: opponentPid,
                owner: opponentPid,
                basePower: 2,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                playedThisTurn: false,
                attachedActions: [],
            };

            core.bases = core.bases.map((base, index) => {
                if (index !== 0) return { ...base, minions: [] };
                return {
                    ...base,
                    minions: [copiedCopycat, referenceGeorge],
                    ongoingActions: [],
                };
            });

            core.players[currentPid] = {
                ...core.players[currentPid],
                hand: [],
                minionsPlayed: 0,
                actionsPlayed: 0,
            };
            core.players[opponentPid] = {
                ...core.players[opponentPid],
                hand: [],
            };

            await applyCoreStateDirect(hostPage, core);
            const debugPanel = hostPage.getByTestId('debug-panel');
            if (await debugPanel.isVisible().catch(() => false)) {
                await hostPage.getByTestId('debug-toggle').click();
                await expect(debugPanel).toBeHidden({ timeout: 5000 });
            }
            await hideSmashUpDebugPanelForEvidence(hostPage);
            await hostPage.waitForTimeout(1000);

            const copycat = hostPage.locator('[data-minion-uid="copycat-board"]');
            const george = hostPage.locator('[data-minion-uid="furious-george-reference"]');
            const baseZone = hostPage.getByTestId('base-zone-0');

            await expect(copycat).toBeVisible({ timeout: 15000 });
            await expect(george).toBeVisible({ timeout: 15000 });
            await expect(copycat.locator('[data-testid="su-card-bottom-overlay"]')).toBeVisible({ timeout: 15000 });

            await baseZone.scrollIntoViewIfNeeded();
            await copycat.hover();
            await hostPage.waitForTimeout(300);

            const boardScreenshotPath = getEvidenceScreenshotPath(testInfo, 'copycat-board-fullpage', {
                filename: 'smashup-copycat-board-fullpage.png',
            });
            ensureScreenshotDir(boardScreenshotPath);
            await hostPage.screenshot({ path: boardScreenshotPath, fullPage: true });

            const baseCloseupPath = getEvidenceScreenshotPath(testInfo, 'copycat-board-closeup', {
                filename: 'smashup-copycat-board-closeup.png',
            });
            ensureScreenshotDir(baseCloseupPath);
            await copycat.screenshot({ path: baseCloseupPath });

            const georgeCloseupPath = getEvidenceScreenshotPath(testInfo, 'george-reference-closeup', {
                filename: 'smashup-george-reference-closeup.png',
            });
            ensureScreenshotDir(georgeCloseupPath);
            await george.screenshot({ path: georgeCloseupPath });

            const inspectButton = copycat.locator('button.cursor-zoom-in').first();
            await expect(inspectButton).toBeVisible({ timeout: 10000 });
            await inspectButton.click();

            const magnifyOverlay = hostPage.getByTestId('su-card-magnify-overlay');
            const magnifyContent = hostPage.getByTestId('su-card-magnify-content');
            await expect(magnifyOverlay).toBeVisible({ timeout: 10000 });
            await expect(magnifyContent.locator('[data-testid="su-card-bottom-overlay"]')).toBeVisible({ timeout: 10000 });

            const magnifyPagePath = getEvidenceScreenshotPath(testInfo, 'copycat-magnify-page', {
                filename: 'smashup-copycat-magnify-page.png',
            });
            ensureScreenshotDir(magnifyPagePath);
            await hostPage.screenshot({ path: magnifyPagePath, fullPage: true });

            const magnifyCloseupPath = getEvidenceScreenshotPath(testInfo, 'copycat-magnify-closeup', {
                filename: 'smashup-copycat-magnify-closeup.png',
            });
            ensureScreenshotDir(magnifyCloseupPath);
            await magnifyContent.screenshot({ path: magnifyCloseupPath });
        } finally {
            await guestContext.close().catch(() => {});
            await hostContext.close().catch(() => {});
        }
    });
});
