import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from '../framework';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import {
    disableAudio,
    disableTutorial,
    injectSkipImageGate,
    resetMatchStorage,
    setChineseLocale,
    waitForFrontendAssets,
    waitForHomeGameList,
} from '../helpers/common';
import { getMatchState } from '../helpers/state-injection';
import { QIDAHEN_REGION_GRAPH_NODE_BY_ID } from '../../src/games/qidahen/ui/mapGraph';
import { QIDAHEN_MAP_HEIGHT, QIDAHEN_MAP_WIDTH } from '../../src/games/qidahen/ui/mapRegions';
import { getQidahenWheelDestination } from '../../src/games/qidahen/domain/wheelRules';

const MAP_REGION_POINTS = {
    songjin: { x: 0.683, y: 0.586 },
} as const;

async function ensureLobbyReady(page: Page): Promise<void> {
    await page.goto('/', { waitUntil: 'commit', timeout: 15000 });
    await waitForFrontendAssets(page, 45000);
    await waitForHomeGameList(page, 45000);
    await expect(page.locator('[data-game-id="qidahen"]')).toBeVisible({ timeout: 15000 });
}

async function hoverMapRegion(
    page: Page,
    regionId: keyof typeof MAP_REGION_POINTS,
): Promise<void> {
    const point = MAP_REGION_POINTS[regionId];
    const canvas = page.getByTestId('qidahen-map-hitmap-canvas');
    await expect(canvas).toBeVisible({ timeout: 15000 });
    await canvas.evaluate((element, targetPoint) => {
        const rect = element.getBoundingClientRect();
        const init: PointerEventInit = {
            clientX: rect.left + rect.width * targetPoint.x,
            clientY: rect.top + rect.height * targetPoint.y,
            pointerId: 1,
            pointerType: 'mouse',
            button: 0,
            buttons: 1,
            bubbles: true,
            cancelable: true,
        };
        element.dispatchEvent(new PointerEvent('pointermove', init));
    }, point);
}

async function clickMapRegionById(page: Page, regionId: string): Promise<void> {
    const node = QIDAHEN_REGION_GRAPH_NODE_BY_ID.get(regionId);
    if (!node?.center) throw new Error(`七大恨地图缺少 ${regionId} 的真实地区中心`);
    const canvas = page.getByTestId('qidahen-map-hitmap-canvas');
    await expect(canvas).toBeVisible({ timeout: 15000 });
    await canvas.evaluate((element, point) => {
        const rect = element.getBoundingClientRect();
        const init: PointerEventInit = {
            clientX: rect.left + rect.width * point.x,
            clientY: rect.top + rect.height * point.y,
            pointerId: 1,
            pointerType: 'mouse',
            button: 0,
            buttons: 1,
            bubbles: true,
            cancelable: true,
        };
        element.dispatchEvent(new PointerEvent('pointermove', init));
        element.dispatchEvent(new PointerEvent('pointerdown', init));
        element.dispatchEvent(new PointerEvent('pointerup', init));
        element.dispatchEvent(new PointerEvent('pointerleave', init));
    }, { x: node.center.x / QIDAHEN_MAP_WIDTH, y: node.center.y / QIDAHEN_MAP_HEIGHT });
}

async function captureEvidence(
    page: Page,
    testInfo: TestInfo,
    filename: string,
): Promise<string> {
    const screenshotPath = getEvidenceScreenshotPath(testInfo, filename, {
        subdir: 'qidahen/homepage-first-turn',
        filename,
    });
    mkdirSync(dirname(screenshotPath), { recursive: true });
    await page.screenshot({
        path: screenshotPath,
        fullPage: false,
        animations: 'disabled',
    });
    return screenshotPath;
}

async function openQidahenCreateRoomModal(page: Page): Promise<void> {
    await page.locator('[data-game-id="qidahen"]').first().click();
    await expect(page).toHaveURL(/game=qidahen/);

    const detailsModal = page.locator('[data-testid="game-details-modal-root"]:visible').last();
    await expect(detailsModal).toBeVisible({ timeout: 15000 });

    const openCreateRoomButton = detailsModal.getByTestId('game-details-open-create-room');
    await expect(openCreateRoomButton).toBeVisible({ timeout: 10000 });
    await openCreateRoomButton.click();

    await expect(page.getByTestId('create-room-modal').last()).toBeVisible({ timeout: 10000 });
}

async function enterQidahenBoard(page: Page): Promise<void> {
    await expect(page).toHaveURL(/\/play\/qidahen\/match\//, { timeout: 30000 });

    const url = new URL(page.url());
    if (!url.searchParams.get('playerID')) {
        url.searchParams.set('playerID', '0');
        await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
    }

    await expect(page.getByTestId('qidahen-board')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('qidahen-scenario-pregame-screen')).toHaveCount(0);
    await expect(page.getByTestId('qidahen-faction-selection-screen')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('qidahen-action-wheel')).toHaveCount(0);
    await page.getByTestId('qidahen-scenario-menu-open').click();
    await expect(page.getByTestId('qidahen-scenario-vote-screen')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('qidahen-scenario-vote-option-post-sarhu-1619').click();
    await page.getByTestId('qidahen-scenario-vote-confirm').click();
    await expect(page.getByTestId('qidahen-scenario-vote-screen')).toHaveCount(0, { timeout: 30000 });
    const matchId = new URL(page.url()).pathname.split('/').pop();
    if (!matchId) throw new Error('七大恨 E2E 缺少 matchId，无法确认剧本命令已同步');
    await expect.poll(async () => {
        const state = await getMatchState(matchId, page);
        const core = state.core as { scenarioVote?: unknown };
        return core.scenarioVote ?? null;
    }, { timeout: 15000, message: '等待剧本确认到达服务端后再操作阵营' }).toBeNull();
    const factionScreen = page.getByTestId('qidahen-faction-selection-screen');
    if (await factionScreen.isVisible().catch(() => false)) {
        await page.getByTestId('qidahen-faction-option-ming').click();
        await page.getByTestId('qidahen-faction-selection-confirm').click();
        let latestAuthority: Record<string, unknown> | null = null;
        await expect.poll(async () => {
            const state = await getMatchState(matchId, page);
            const core = state.core as {
                factionSelection?: unknown;
                factions?: Record<string, { playerId?: string }>;
                playerIds?: unknown;
            };
            latestAuthority = {
                matchId,
                stateID: state._stateID,
                factionSelection: core.factionSelection ?? null,
                mingPlayerId: core.factions?.ming?.playerId ?? null,
                factions: Object.fromEntries(Object.entries(core.factions ?? {}).map(([id, faction]) => [id, faction.playerId ?? null])),
                playerIds: core.playerIds ?? null,
            };
            return latestAuthority;
        }, { timeout: 15000, message: '确认服务端完成最后一个阵营选择并进入 setup' })
            .toMatchObject({ factionSelection: null, mingPlayerId: '0' })
            .catch((error) => {
                throw new Error(`${error instanceof Error ? error.message : String(error)}\n权威房间状态：${JSON.stringify(latestAuthority)}`);
            });
    }
    await expect(page.getByTestId('qidahen-inmatch-setup-overlay')).toBeVisible({ timeout: 15000 });
    await completeHostQidahenSetup(page, 'character');
    await completeHostQidahenSetup(page, 'armament');
    await expect(page.getByTestId('qidahen-inmatch-setup-overlay')).toHaveCount(0, { timeout: 30000 });
    let latestDefenderAuthority: Record<string, unknown> | null = null;
    const humanDefenderFight = page.getByTestId('qidahen-resolve-pending-action-defender-fight');
    await expect.poll(async () => {
        const state = await getMatchState(matchId, page);
        const core = state.core as {
            factions?: Record<string, { playerId?: string }>;
            pendingTargetAction?: { battleStep?: string; attackerFactionId?: string; defenderFactionId?: string } | null;
        };
        const interaction = (state.sys as { interaction?: { current?: { playerId?: string; data?: { options?: Array<{ id?: string }> } } } } | undefined)?.interaction?.current;
        const mingPlayerId = core.factions?.ming?.playerId ?? null;
        const optionIds = (interaction?.data?.options ?? []).map((option) => option.id).filter(Boolean);
        latestDefenderAuthority = {
            stateID: state._stateID,
            pendingTargetAction: core.pendingTargetAction ?? null,
            interactionPlayerId: interaction?.playerId ?? null,
            mingPlayerId,
            optionIds,
        };
        return core.pendingTargetAction?.battleStep === 'defender-declaration'
            && core.pendingTargetAction.defenderFactionId === 'ming'
            && interaction?.playerId === mingPlayerId
            && optionIds.includes('defender-fight');
    }, { timeout: 90000, message: '等待真人大明收到后金进攻后的守方应战选择' })
        .toBe(true)
        .catch((error) => {
            throw new Error(`${error instanceof Error ? error.message : String(error)}\n守方权威状态：${JSON.stringify(latestDefenderAuthority)}`);
        });
    await expect(humanDefenderFight).toBeVisible({ timeout: 15000 });
    await expect(humanDefenderFight).toBeEnabled();
    await humanDefenderFight.click();
    let latestOpeningAuthority: Record<string, unknown> | null = null;
    await expect.poll(async () => {
        const state = await getMatchState(matchId, page);
        const core = state.core as {
            currentPlayer?: string;
            currentFactionOrder?: string[];
            factions?: Record<string, { playerId?: string }>;
            turnPhase?: string;
            wheelActionUsed?: boolean;
            factionActionUsed?: boolean;
            selectedRegionId?: string;
            pendingTargetAction?: {
                actionId?: string;
                battleStep?: string;
                attackerFactionId?: string;
                defenderFactionId?: string;
                sourceRegionId?: string;
                targetRegionId?: string;
                targetRuntimeRegionId?: string;
                committedTroops?: number;
                forceCommitments?: Array<{ factionId?: string; committedTroops?: number; selectedSpecialPieceIds?: string[] }>;
            } | null;
            lastSeasonSummary?: { title?: string; lines?: string[] } | null;
        };
        const sys = state.sys as { interaction?: { current?: { id?: string; playerId?: string; kind?: string; data?: { sourceId?: string; options?: Array<{ id?: string }> } } | null; queue?: unknown[] } } | undefined;
        const pending = core.pendingTargetAction ?? null;
        const interaction = sys?.interaction?.current ?? null;
        const mingPlayerId = core.factions?.ming?.playerId ?? null;
        latestOpeningAuthority = {
            stateID: state._stateID,
            currentPlayer: core.currentPlayer ?? null,
            currentFactionOrder: core.currentFactionOrder ?? null,
            mingPlayerId,
            turnPhase: core.turnPhase ?? null,
            wheelActionUsed: core.wheelActionUsed ?? null,
            factionActionUsed: core.factionActionUsed ?? null,
            selectedRegionId: core.selectedRegionId ?? null,
            pendingTargetAction: pending ? {
                actionId: pending.actionId ?? null,
                battleStep: pending.battleStep ?? null,
                attackerFactionId: pending.attackerFactionId ?? null,
                defenderFactionId: pending.defenderFactionId ?? null,
                sourceRegionId: pending.sourceRegionId ?? null,
                targetRegionId: pending.targetRegionId ?? null,
                targetRuntimeRegionId: pending.targetRuntimeRegionId ?? null,
                committedTroops: pending.committedTroops ?? null,
                forceCommitments: (pending.forceCommitments ?? []).map((force) => ({
                    factionId: force.factionId ?? null,
                    committedTroops: force.committedTroops ?? null,
                    selectedSpecialPieceIds: force.selectedSpecialPieceIds ?? [],
                })),
            } : null,
            pendingBattleActingFaction: pending
                ? pending.battleStep === 'defender-declaration' && pending.defenderFactionId !== 'neutral'
                    ? pending.defenderFactionId
                    : pending.battleStep === 'retreat'
                        ? null
                        : pending.attackerFactionId ?? null
                : null,
            pendingBattleActingPlayerId: interaction?.playerId ?? null,
            interaction: interaction ? {
                id: interaction.id ?? null,
                kind: interaction.kind ?? null,
                sourceId: interaction.data?.sourceId ?? null,
                optionIds: (interaction.data?.options ?? []).map((option) => option.id).filter(Boolean),
            } : null,
            interactionQueueLength: sys?.interaction?.queue?.length ?? null,
            lastSeasonSummary: core.lastSeasonSummary ?? null,
        };
        return core.currentPlayer === mingPlayerId && mingPlayerId != null;
    }, { timeout: 120000, message: '等待后金与蒙古按剧本顺序完成开局行动，由大明真人进入首个操作窗口' })
        .toBe(true)
        .catch((error) => {
            throw new Error(`${error instanceof Error ? error.message : String(error)}\n开局权威状态：${JSON.stringify(latestOpeningAuthority)}`);
        });
    await expect(page.getByTestId('qidahen-player-ming')).toContainText('当前', { timeout: 15000 });
    await expect(page.getByTestId('qidahen-turn-banner')).toHaveCount(0);
}

async function completeHostQidahenSetup(page: Page, kind: 'character' | 'armament'): Promise<void> {
    const groupPrefix = `qidahen-inmatch-setup-${kind}-`;
    const optionPrefix = `qidahen-inmatch-setup-${kind}-option-`;
    const confirmPrefix = `qidahen-inmatch-setup-${kind}-confirm-`;
    for (let guard = 0; guard < 8; guard += 1) {
        const group = page.locator(`[data-testid^="${groupPrefix}"][data-qidahen-inline-choice="${kind}"][data-completed="false"]`).first();
        if (!(await group.isVisible().catch(() => false))) return;
        const groupTestId = await group.getAttribute('data-testid');
        if (!groupTestId) throw new Error(`七大恨缺少待确认${kind} group test id`);
        const groupId = groupTestId.slice(groupPrefix.length);
        const confirm = page.getByTestId(`${confirmPrefix}${groupId}`);
        for (let index = 0; index < 10 && !(await confirm.isEnabled()); index += 1) {
            const option = group.locator(`[data-testid^="${optionPrefix}${groupId}-"]:not([disabled])`).first();
            await expect(option, `七大恨 ${kind} ${groupId} 应有可选项`).toBeVisible();
            await option.click();
        }
        await expect(confirm, `七大恨 ${kind} ${groupId} 应完成选择后可确认`).toBeEnabled();
        await confirm.click();
        await expect(group).toHaveAttribute('data-completed', 'true');
    }
    await expect(page.locator(`[data-testid^="${groupPrefix}"][data-qidahen-inline-choice="${kind}"][data-completed="false"]`)).toHaveCount(0);
}

test.describe('七大恨主页首回合黄金链', () => {
    test.setTimeout(180000);

    test.beforeEach(async ({ context }) => {
        await setChineseLocale(context);
        await disableTutorial(context);
        await disableAudio(context);
        await injectSkipImageGate(context, true);
        await resetMatchStorage(context, '__qidahen_homepage_first_turn__');
    });

    test('从主页创建七大恨房间后可完成首个基础回合', async ({ page }, testInfo) => {
        await page.setViewportSize({ width: 1920, height: 1080 });
        await ensureLobbyReady(page);
        await openQidahenCreateRoomModal(page);

        const createRoomModal = page.getByTestId('create-room-modal').last();
        await expect(createRoomModal).toBeVisible();

        const enableAiButton = createRoomModal.getByRole('button', { name: /加入 AI/ });
        await enableAiButton.click();
        await expect(enableAiButton).toContainText('已开启');

        await captureEvidence(page, testInfo, '七大恨-首页进入并完成首回合-01-首页房间入口.png');

        const confirmCreateRoomButton = page.getByTestId('create-room-confirm-button');
        await expect(confirmCreateRoomButton).toBeVisible({ timeout: 10000 });
        await confirmCreateRoomButton.click();

        await enterQidahenBoard(page);

        const wheelMoveTarget = page.getByTestId('qidahen-wheel-move-target-move-1-free');
        await expect(wheelMoveTarget).toBeVisible({ timeout: 15000 });
        await captureEvidence(page, testInfo, '七大恨-首页进入并完成首回合-02-进入对局后可操作.png');

        await page.getByTestId('qidahen-map-zoom-reset').click();
        await hoverMapRegion(page, 'songjin');
        await expect(page.getByTestId('qidahen-map-region-tip')).toContainText('皮岛 · 大明', { timeout: 15000 });
        const beforeWheelMoveState = await getMatchState(new URL(page.url()).pathname.split('/').pop()!, page);
        const beforeWheelPosition = (beforeWheelMoveState.core as { actionWheelPosition?: string }).actionWheelPosition;
        if (!beforeWheelPosition) throw new Error('轮盘移动前权威状态缺少起点');
        const expectedWheelPosition = getQidahenWheelDestination(beforeWheelPosition, 1).id;
        await wheelMoveTarget.click();
        await expect(page.getByTestId('qidahen-player-ming')).toContainText('当前', { timeout: 15000 });
        await expect(page.getByTestId('qidahen-turn-banner')).toHaveCount(0);
        let latestWheelResolution: Record<string, unknown> | null = null;
        await expect.poll(async () => {
            const state = await getMatchState(new URL(page.url()).pathname.split('/').pop()!, page);
            const core = state.core as {
                actionWheelPosition?: string;
                handCards?: Array<{ id: string; faction: string; cardDefId?: string }>;
            };
            const sys = state.sys as {
                resolution?: {
                    activeFrameId?: string;
                    frames?: Array<{
                        id?: string;
                        kind?: string;
                        metadata?: { qidahenTurn?: { factionId?: string; positionId?: string; step?: string } };
                    }>;
                };
                interaction?: { current?: { playerId?: string; data?: { sourceId?: string; options?: Array<{ id?: string }> } } };
            } | undefined;
            const frame = sys?.resolution?.frames?.find((candidate) => candidate.id === sys.resolution?.activeFrameId);
            const turn = frame?.metadata?.qidahenTurn;
            const interaction = sys?.interaction?.current;
            const optionIds = (interaction?.data?.options ?? []).map((option) => option.id).filter(Boolean);
            latestWheelResolution = {
                stateID: state._stateID,
                beforeWheelPosition,
                expectedWheelPosition,
                actionWheelPosition: core.actionWheelPosition ?? null,
                frameKind: frame?.kind ?? null,
                frameFactionId: turn?.factionId ?? null,
                framePositionId: turn?.positionId ?? null,
                frameStep: turn?.step ?? null,
                interactionPlayerId: interaction?.playerId ?? null,
                interactionSourceId: interaction?.data?.sourceId ?? null,
                optionIds,
                mingHand: core.handCards?.filter((card) => card.faction === 'ming').map((card) => ({ id: card.id, cardDefId: card.cardDefId })) ?? [],
            };
            return beforeWheelPosition != null
                && core.actionWheelPosition === expectedWheelPosition
                && frame?.kind === 'qidahen:turn-resolution'
                && turn?.factionId === 'ming'
                && turn?.positionId === core.actionWheelPosition
                && interaction?.data?.sourceId === 'qidahen:turn-resolution-choice'
                && interaction?.playerId === '0'
                && optionIds.includes('military-farm');
        }, { timeout: 15000, message: '确认轮盘移动已提交，并进入大明真人持有的合法军屯行动选择' })
            .toBe(true)
            .catch((error) => {
                throw new Error(`${error instanceof Error ? error.message : String(error)}\n轮盘权威状态：${JSON.stringify(latestWheelResolution)}`);
            });

        await page.getByTestId('qidahen-turn-option-military-farm').click();
        let farmTargetState: { targetId: string; troopsBefore: number; mingHandBefore: number | null } | null = null;
        await expect.poll(async () => {
            const state = await getMatchState(new URL(page.url()).pathname.split('/').pop()!, page);
            const core = state.core as { regions?: Array<{ id: string; troops: number }>; factions?: Record<string, { handCount?: number }> };
            const current = (state.sys as { interaction?: { current?: { data?: { options?: Array<{ id?: string }> } } } } | undefined)?.interaction?.current;
            const targetId = current?.data?.options?.find((option) => option.id && option.id.startsWith('city-region-'))?.id;
            const region = core.regions?.find((candidate) => candidate.id === targetId);
            farmTargetState = targetId && region ? {
                targetId,
                troopsBefore: region.troops,
                mingHandBefore: core.factions?.ming?.handCount ?? null,
            } : null;
            return farmTargetState !== null;
        }, { timeout: 15000, message: '等待服务端公布当前合法的军屯区域' }).toBe(true);
        if (!farmTargetState) throw new Error('军屯合法选项没有对应权威地区状态');
        const farmTargetId = farmTargetState.targetId;
        await clickMapRegionById(page, farmTargetId);
        await expect(page.getByTestId('qidahen-turn-choice')).toHaveAttribute('data-turn-step', 'farm-target');
        await expect(page.getByTestId('qidahen-turn-confirm')).toBeEnabled({ timeout: 15000 });
        await page.getByTestId('qidahen-turn-confirm').click();
        await expect.poll(async () => {
            const state = await getMatchState(new URL(page.url()).pathname.split('/').pop()!, page);
            const core = state.core as { regions?: Array<{ id: string; troops: number }>; factions?: Record<string, { handCount?: number }> };
            const region = core.regions?.find((candidate) => candidate.id === farmTargetId);
            return region?.troops === farmTargetState.troopsBefore + 1
                && typeof farmTargetState.mingHandBefore === 'number'
                && core.factions?.ming?.handCount === farmTargetState.mingHandBefore + 2;
        }, { timeout: 15000, message: '确认真人选择军屯后部队增加一支且抽取两张手牌' }).toBe(true);
        await captureEvidence(page, testInfo, '七大恨-首页进入并完成首回合-03-完成真实军屯行动.png');
        await expect(page.getByTestId('qidahen-turn-option-finish-slot')).toBeVisible({ timeout: 15000 });
        await page.getByTestId('qidahen-turn-option-finish-slot').click();
        await expect(page.getByTestId('qidahen-turn-option-skip-hand')).toBeVisible({ timeout: 15000 });
        await page.getByTestId('qidahen-turn-option-skip-hand').click();

        await expect(page.getByTestId('qidahen-player-mongol')).toContainText('当前', { timeout: 15000 });
        await expect(page.getByTestId('qidahen-turn-banner')).toHaveCount(0);
        await captureEvidence(page, testInfo, '七大恨-首页进入并完成首回合-04-首回合完成后.png');
    });
});
