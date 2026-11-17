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
import { clickRaidRegion, payRaidCards } from './raidTestHelpers';

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
    const rect = await canvas.boundingBox();
    if (!rect) throw new Error('七大恨地图画布没有可点击区域');
    await page.mouse.click(
        rect.x + rect.width * node.center.x / QIDAHEN_MAP_WIDTH,
        rect.y + rect.height * node.center.y / QIDAHEN_MAP_HEIGHT,
    );
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
    let defendedRegionId: string | undefined;
    const humanDefenderFight = page.getByTestId('qidahen-resolve-pending-action-defender-fight');
    await expect.poll(async () => {
        const state = await getMatchState(matchId, page);
        const core = state.core as {
            factions?: Record<string, { playerId?: string }>;
            pendingTargetAction?: { battleStep?: string; attackerFactionId?: string; defenderFactionId?: string; targetRegionId?: string } | null;
        };
        const interaction = (state.sys as { interaction?: { current?: { playerId?: string; data?: { options?: Array<{ id?: string }> } } } } | undefined)?.interaction?.current;
        const mingPlayerId = core.factions?.ming?.playerId ?? null;
        defendedRegionId = core.pendingTargetAction?.targetRegionId;
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
    const afterBattle = await getMatchState(matchId, page);
    const battleEvents = (afterBattle.sys?.eventStream?.entries ?? []).map((entry) => entry.event);
    expect(defendedRegionId, '守方应战必须对应实际目标地区').toBeTruthy();
    expect(battleEvents.some((event) => {
        if (event.type !== 'QIDAHEN_BATTLE_ROLLED') return false;
        const report = (event.payload as { report?: { targetRegionId?: string; defenderFactionId?: string; rolls?: unknown } }).report;
        return report?.targetRegionId === defendedRegionId && report.defenderFactionId === 'ming' && !!report.rolls;
    }), '真人应战后须产生针对同一地区的战斗结算').toBe(true);
    expect((afterBattle.core as { pendingTargetAction?: unknown }).pendingTargetAction ?? null, '交回真人前战斗须收口').toBeNull();
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
        await page.getByTestId('qidahen-action-raid').click();
        await clickRaidRegion(page, 'city-region-15');
        await expect.poll(async () => (await getMatchState(new URL(page.url()).pathname.split('/').pop()!, page)).core.regionFocusState?.lockedSourceRegionId).toBe('city-region-15');
        await clickRaidRegion(page, 'city-region-7');
        await expect.poll(async () => (await getMatchState(new URL(page.url()).pathname.split('/').pop()!, page)).core.regionFocusState?.currentTargetRegionId).toBe('city-region-7');
        const matchId = new URL(page.url()).pathname.split('/').pop()!;
        const beforeAttack = await getMatchState(matchId, page);
        const defenderId = beforeAttack.core.factions?.mongol?.playerId;
        expect(defenderId).toBeTruthy();
        expect(defenderId).not.toBe('0');
        const target = (beforeAttack.core.regions as Array<{ id: string; controller: string; troops: number }>)
            .find(region => region.id === 'city-region-7');
        expect(target).toMatchObject({ controller: 'mongol', troops: expect.any(Number) });
        expect(target!.troops).toBeGreaterThan(0);
        const knownEvents = new Set((beforeAttack.sys?.eventStream?.entries ?? []).map(entry => entry.id));
        await payRaidCards(page, 1);
        let latestDefenseDiagnostic: unknown;
        let defenseOption: string | undefined;
        await expect.poll(async () => {
            const state = await getMatchState(matchId, page);
            const freshEvents = (state.sys?.eventStream?.entries ?? []).filter(entry => !knownEvents.has(entry.id));
            latestDefenseDiagnostic = { defenderId, pending: state.core.pendingTargetAction,
                postBattle: state.core.postBattleSelection,
                events: freshEvents.map(entry => entry.event).filter(event => event.type === 'SYS_INTERACTION_RESOLVED') };
            const defense = freshEvents.find(entry => {
                const event = entry.event as { type?: string; payload?: { playerId?: string; sourceId?: string; optionId?: string } };
                return !knownEvents.has(entry.id) && event.type === 'SYS_INTERACTION_RESOLVED'
                    && event.payload?.playerId === defenderId && event.payload.sourceId === 'qidahen:pending-target'
                    && (['defender-fight', 'defender-sortie', 'defender-hold-city'].includes(event.payload.optionId ?? '')
                        || (event.payload.optionId ?? '').startsWith('cavalry-evasion:'));
            });
            defenseOption = (defense?.event as { payload?: { optionId?: string } } | undefined)?.payload?.optionId;
            return defenseOption !== undefined;
        }, { timeout: 30000, message: '等待蒙古 AI 自主选择防守方式' }).toBe(true).catch(error => {
            throw new Error(`${String(error)}\n防守诊断：${JSON.stringify(latestDefenseDiagnostic)}`);
        });
        console.log(`[QIDAHEN_AI_DEFENSE] ${defenseOption}`);
        const fight = page.getByTestId('qidahen-resolve-pending-action');
        const postBattle = page.getByTestId('qidahen-post-battle-selection');
        await expect.poll(async () => await fight.isVisible().catch(() => false)
            || await postBattle.isVisible().catch(() => false), { timeout: 15000 }).toBe(true);
        if (await fight.isVisible()) {
            const troop = page.locator('[data-testid^="qidahen-map-token-"][data-pending-committed-selectable="true"]').first();
            if (await troop.isVisible().catch(() => false)) await troop.click();
            await expect(fight).toBeEnabled({ timeout: 15000 });
            await fight.click();
        }
        await expect(page.getByTestId('qidahen-raid-intent')).toHaveCount(0, { timeout: 30000 });
        await expect.poll(async () => {
            const current = await getMatchState(matchId, page);
            return current.core.pendingTargetAction == null;
        }, { timeout: 30000, message: '等待突袭待结算状态清除' }).toBe(true);
        if (defenseOption?.startsWith('cavalry-evasion:')) {
            const retreatId = defenseOption.slice('cavalry-evasion:'.length);
            const retreatBefore = (beforeAttack.core.regions as Array<{ id: string; troops: number }>)
                .find(region => region.id === retreatId);
            expect(retreatBefore, 'AI 选择的避战地区必须存在').toBeDefined();
            await expect.poll(async () => {
                const state = await getMatchState(matchId, page);
                const retreat = (state.core.regions as Array<{ id: string; troops: number }>)
                    .find(region => region.id === retreatId);
                return retreat?.troops ?? -1;
            }, { timeout: 15000, message: '确认避战骑兵实际到达所选地区' }).toBeGreaterThan(retreatBefore!.troops);
            await expect(postBattle).toBeVisible({ timeout: 15000 });
        }
        if (await postBattle.isVisible().catch(() => false)) {
            await page.getByTestId('qidahen-post-battle-mode-occupy').click();
            await page.locator('button[data-testid^="qidahen-post-battle-choice-"]').first().click();
            await page.getByTestId('qidahen-post-battle-confirm').click();
            await expect(postBattle).toHaveCount(0, { timeout: 15000 });
        }
        await expect.poll(async () => (await getMatchState(matchId, page)).core.postBattleSelection ?? null,
            { timeout: 15000, message: '战后不能遗留待处理选择' }).toBeNull();
    });
});
