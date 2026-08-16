/**
 * DiceThrone 女猎手真实入口证据。
 *
 * 范围：真实在线双玩家选角、开局、玩家板、手牌、妮拉伙伴状态和流血状态图标。
 * 提示卡仅作本地规则记录，必须不被选角或对局运行时请求。
 * 妮拉实现由本轮用户直接授权；候选设计稿仍不作为验收通过依据。
 */

import type { Browser, Page, TestInfo } from '@playwright/test';
import { dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { getGameServerBaseURL } from '../helpers/common';
import {
    cleanupDTMatch,
    closeDebugPanelIfOpen,
    readyAndStartGame,
    selectCharacter,
    setupOnlineMatch,
    waitForDiceThroneHarness,
    waitForGameBoard,
} from '../helpers/dicethrone';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { STATUS_IDS } from '../../src/games/dicethrone/domain/ids';

type JsonRecord = Record<string, unknown>;
type MatchSetup = NonNullable<Awaited<ReturnType<typeof setupOnlineMatch>>>;

const LIEREN_SLOT_ABILITIES = {
    fist: 'wild-force',
    chi: 'savage-force',
    sky: 'brutal-strike',
    lotus: 'beast-force',
    combo: 'life-revival',
    lightning: 'beast-instinct',
    calm: 'hunt-ambush',
    meditate: 'kindred-bond',
    ultimate: 'jungle-fury',
} as const;

const asRecord = (value: unknown): JsonRecord => (
    value && typeof value === 'object' ? value as JsonRecord : {}
);

const saveEvidenceScreenshot = async (page: Page, testInfo: TestInfo, name: string): Promise<string> => {
    const path = getEvidenceScreenshotPath(testInfo, name, { filename: `${name}.png` });
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: false });
    return path;
};

const waitForImage = async (page: Page, testId: string): Promise<void> => {
    const image = page.getByTestId(testId);
    await expect(image).toBeVisible({ timeout: 15000 });
    await expect.poll(async () => image.evaluate((node) => ({
        complete: (node as HTMLImageElement).complete,
        naturalWidth: (node as HTMLImageElement).naturalWidth,
    }))).toEqual({ complete: true, naturalWidth: expect.any(Number) });
    const naturalWidth = await image.evaluate((node) => (node as HTMLImageElement).naturalWidth);
    expect(naturalWidth, `${testId} 应加载正式图片`).toBeGreaterThan(0);
};

const setupLierenMatch = async (browser: Browser, baseURL: string | undefined): Promise<MatchSetup> => {
    const match = await setupOnlineMatch(browser, baseURL, {
        skipImageGate: true,
        characterSelectionTimeout: 240000,
    });
    if (!match) {
        test.skip(true, '游戏服务器不可用或创建 DiceThrone 房间失败');
        throw new Error('DiceThrone online setup failed');
    }

    await selectCharacter(match.hostPage, 'lieren');
    await selectCharacter(match.guestPage, 'monk');
    return match;
};

const injectLierenBleedStatus = async (matchId: string, page: Page): Promise<void> => {
    const current = await getMatchState(matchId, page) as JsonRecord;
    const root = asRecord(current.G ?? current);
    const core = asRecord(root.core);
    const sys = asRecord(root.sys);
    const players = asRecord(core.players);
    const host = asRecord(players['0']);
    const next = structuredClone(current) as JsonRecord;
    const nextRoot = asRecord(next.G ?? next);
    const turnOrder = Array.isArray(sys.turnOrder)
        ? sys.turnOrder
        : Array.isArray(core.turnOrder)
            ? core.turnOrder
            : Object.keys(players);
    const phase = typeof core.phase === 'string'
        ? core.phase
        : typeof sys.phase === 'string'
            ? sys.phase
            : 'main';
    nextRoot.core = {
        ...core,
        phase,
        players: {
            ...players,
            '0': {
                ...host,
                statusEffects: {
                    ...asRecord(host.statusEffects),
                    [STATUS_IDS.BLEED]: 1,
                },
            },
        },
    };
    nextRoot.sys = {
        ...sys,
        phase,
        turnOrder,
        currentPlayerIndex: typeof sys.currentPlayerIndex === 'number' ? sys.currentPlayerIndex : 0,
    };
    await injectMatchState(matchId, next as never, page);
};

const injectNyraDamageResponse = async (matchId: string, page: Page): Promise<void> => {
    const current = await getMatchState(matchId, page) as JsonRecord;
    const root = asRecord(current.G ?? current);
    const core = asRecord(root.core);
    const sys = asRecord(root.sys);
    const players = asRecord(core.players);
    const host = asRecord(players['0']);
    const companion = asRecord(host.companion);
    const next = structuredClone(current) as JsonRecord;
    const nextRoot = asRecord(next.G ?? next);

    nextRoot.core = {
        ...core,
        players: {
            ...players,
            '0': {
                ...host,
                companion: { ...companion, hp: 5, maxHp: 7 },
                tokens: { ...asRecord(host.tokens), nyras_bond: 1 },
            },
        },
        pendingAttack: {
            attackerId: '1',
            defenderId: '0',
            sourceAbilityId: 'e2e-nyra-hit',
            isDefendable: true,
            damage: 4,
            bonusDamage: 0,
            attackModifierBonusDamage: 0,
            damageResolved: false,
            resolvedDamage: 0,
            preDefenseResolved: true,
            offensiveRollEndTokenResolved: true,
        },
        pendingDamage: {
            id: 'e2e-nyra-damage-response',
            sourcePlayerId: '1',
            targetPlayerId: '0',
            originalDamage: 4,
            currentDamage: 4,
            sourceAbilityId: 'e2e-nyra-hit',
            responseType: 'beforeDamageReceived',
            responderId: '0',
            isFullyEvaded: false,
        },
    };
    nextRoot.sys = {
        ...sys,
        interaction: {
            ...asRecord(sys.interaction),
            current: {
                id: 'e2e-nyra-damage-response',
                kind: 'dt:token-response',
                playerId: '0',
                data: null,
            },
            queue: [],
        },
    };
    await injectMatchState(matchId, next as never, page);
};

test.describe('DiceThrone 女猎手真实入口', () => {
    test('真实在线双玩家应完成女猎手选角初始化、隐藏提示卡并看到妮拉、伤害分配、玩家板、手牌与流血状态图标', async ({ browser }, testInfo) => {
        test.setTimeout(300000);
        await clearEvidenceScreenshotsForTest(testInfo);
        const baseURL = testInfo.project.use.baseURL as string | undefined ?? getGameServerBaseURL();
        const match = await setupLierenMatch(browser, baseURL);

        try {
            await expect(match.hostPage.locator('[data-character-id="lieren"]')).toContainText(/P1/i);
            await expect(match.guestPage.locator('[data-character-id="monk"]')).toContainText(/P2/i);
            await waitForImage(match.hostPage, 'character-selection-player-board-image');
            await expect(match.hostPage.getByTestId('character-selection-player-board-image'))
                .toHaveAttribute('data-debug-current-src', /dicethrone\/images\/lieren\/compressed\/player-board\.webp/i);
            await expect(match.hostPage.getByTestId('tip-board-image')).toHaveCount(0);
            await saveEvidenceScreenshot(match.hostPage, testInfo, '01-选角-女猎手与武僧-角色板');

            await readyAndStartGame(match.hostPage, match.guestPage);
            await waitForGameBoard(match.hostPage);
            await waitForGameBoard(match.guestPage);
            await waitForDiceThroneHarness(match.hostPage);
            await waitForDiceThroneHarness(match.guestPage);
            await closeDebugPanelIfOpen(match.hostPage);
            await closeDebugPanelIfOpen(match.guestPage);
            await match.hostPage.setViewportSize({ width: 1280, height: 720 });
            await match.guestPage.setViewportSize({ width: 1280, height: 720 });

            const hostBoard = match.hostPage.getByTestId('player-board-surface');
            await expect(hostBoard).toHaveAttribute('data-character-id', 'lieren', { timeout: 10000 });
            for (const [slotId, abilityId] of Object.entries(LIEREN_SLOT_ABILITIES)) {
                await expect(hostBoard.locator(`[data-ability-slot="${slotId}"]`).first())
                    .toHaveAttribute('data-base-ability-id', abilityId);
            }
            await waitForImage(match.hostPage, 'player-board-image');
            await expect(match.hostPage.getByTestId('player-board-image'))
                .toHaveAttribute('data-debug-current-src', /dicethrone\/images\/lieren\/compressed\/player-board\.webp/i);
            const nyraPanel = match.hostPage.getByTestId('nyra-companion-panel');
            await expect(nyraPanel).toBeVisible({ timeout: 10000 });
            await expect(nyraPanel).toContainText('7/7');
            await expect(match.hostPage.getByTestId('nyra-bond-heal-button')).toBeDisabled();
            await expect(match.hostPage.locator('[data-testid="hand-area"] [data-card-id]')).toHaveCount(4, { timeout: 10000 });
            await expect(match.hostPage.getByTestId('tip-board-image')).toHaveCount(0);

            await injectLierenBleedStatus(match.matchId, match.hostPage);
            const statusTokens = match.hostPage.locator('[data-tutorial-id="status-tokens"]');
            await expect(statusTokens).toBeVisible({ timeout: 10000 });
            await expect(statusTokens.locator(`[data-status-id="${STATUS_IDS.BLEED}"]`)).toBeVisible({ timeout: 10000 });

            await saveEvidenceScreenshot(match.hostPage, testInfo, '02-牌桌-女猎手妮拉玩家板手牌流血');
            await injectNyraDamageResponse(match.matchId, match.hostPage);
            await expect(match.hostPage.getByTestId('token-response-modal')).toHaveCount(0);
            await expect(nyraPanel).toBeVisible({ timeout: 10000 });
            await expect(nyraPanel).toContainText('4');
            await expect(match.hostPage.getByRole('slider', { name: '消耗羁绊分配伤害' })).toBeVisible();
            await expect(match.hostPage.getByRole('button', { name: '确认分配' })).toBeVisible();
            await expect(match.hostPage.getByRole('button', { name: '转移伤害' })).toBeVisible();
            await saveEvidenceScreenshot(match.hostPage, testInfo, '03-伤害响应-妮拉羁绊分配');
            await expect(match.guestPage.getByTestId('player-board-surface'))
                .toHaveAttribute('data-character-id', 'monk', { timeout: 10000 });
            await saveEvidenceScreenshot(match.guestPage, testInfo, '04-牌桌-对手视角已进入');
        } finally {
            await cleanupDTMatch(match);
        }
    });
});
