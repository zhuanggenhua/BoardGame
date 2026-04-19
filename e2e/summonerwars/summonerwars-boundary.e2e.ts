/**
 * 召唤师战争 - 边界场景 E2E 测试
 *
 * 覆盖：
 * - 事件卡无有效目标时不进入选择模式
 * - 事件卡选择流程取消后正确回滚
 */

import { test, expect, type Browser } from '@playwright/test';
import { ensureGameServerAvailable } from '../helpers/common';
import {
    setupOnlineMatchViaUI,
    completeFactionSelection,
    waitForSummonerWarsUI,
    readCoreState,
    applyCoreState,
    closeDebugPanelIfOpen,
    clickBoardElement,
    waitForPhase,
    cloneState,
} from '../helpers/summonerwars';

// ============================================================================
// 测试专用：卡牌/单位工厂 & 状态构造
// ============================================================================

const createMindControlCard = () => ({
    id: 'trickster-mind-control',
    name: '心灵操控',
    cardType: 'event' as const,
    eventType: 'legendary' as const,
    cost: 0,
    playPhase: 'summon' as const,
    effect: '指定你的召唤师2个区格以内任意数量的敌方士兵和英雄为目标。获得所有目标的控制权，直到回合结束。',
    deckSymbols: [],
    spriteIndex: 0,
    spriteAtlas: 'cards' as const,
});

const createStunCard = () => ({
    id: 'trickster-stun',
    name: '震慑',
    cardType: 'event' as const,
    eventType: 'common' as const,
    cost: 1,
    playPhase: 'move' as const,
    effect: '指定你的召唤师3个直线视野区格以内的一个士兵或英雄为目标。将目标推拉1至3个区格，并且可以穿过士兵和英雄。对目标和每个被穿过的单位造成1点伤害。',
    deckSymbols: [],
    spriteIndex: 9,
    spriteAtlas: 'cards' as const,
});

const createHypnoticLureCard = () => ({
    id: 'trickster-hypnotic-lure',
    name: '催眠引诱',
    cardType: 'event' as const,
    eventType: 'common' as const,
    cost: 0,
    playPhase: 'summon' as const,
    effect: '指定一个士兵或英雄为目标。你可以将目标向你的召唤师靠近而推拉1个区格。\n持续：当你的召唤师攻击这个目标时，获得战力+1。',
    deckSymbols: [],
    spriteIndex: 10,
    spriteAtlas: 'cards' as const,
});

const createEnemyUnit = () => ({
    cardId: 'necro-undead-warrior-test',
    card: {
        id: 'necro-undead-warrior',
        name: '亡灵战士',
        cardType: 'unit' as const,
        unitClass: 'common' as const,
        faction: '堕落王国',
        strength: 2,
        life: 2,
        cost: 1,
        attackType: 'melee' as const,
        attackRange: 1 as const,
        abilities: [],
        deckSymbols: [],
        spriteIndex: 6,
        spriteAtlas: 'cards' as const,
    },
    owner: '1' as const,
    position: { row: 0, col: 0 },
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
});

// --- 棋盘状态操作工具（测试专用，使用 any 因为 coreState 结构动态） ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- E2E 测试中 coreState 为动态 JSON 结构
type CoreState = any;

const findSummonerPosition = (coreState: CoreState, playerId: '0' | '1') => {
    for (let row = 0; row < coreState.board.length; row += 1) {
        for (let col = 0; col < coreState.board[row].length; col += 1) {
            const unit = coreState.board[row][col]?.unit;
            if (unit && unit.owner === playerId && unit.card?.unitClass === 'summoner') {
                return { row, col };
            }
        }
    }
    throw new Error('未找到召唤师位置');
};

const removeEnemyNonSummonerUnits = (coreState: CoreState, enemyId: '0' | '1') => {
    coreState.board = coreState.board.map((row: CoreState[]) =>
        row.map((cell: CoreState) => {
            if (cell.unit && cell.unit.owner === enemyId && cell.unit.card?.unitClass !== 'summoner') {
                return { ...cell, unit: undefined };
            }
            return cell;
        }),
    );
};

const findEmptyCellWithinDistance = (
    coreState: CoreState,
    center: { row: number; col: number },
    maxDist: number,
) => {
    const fallback: { row: number; col: number }[] = [];
    for (let row = 0; row < coreState.board.length; row += 1) {
        for (let col = 0; col < coreState.board[row].length; col += 1) {
            const dist = Math.abs(center.row - row) + Math.abs(center.col - col);
            if (dist === 0 || dist > maxDist) continue;
            const cell = coreState.board[row][col];
            if (!cell.unit && !cell.structure) return { row, col };
            if (cell.unit && cell.unit.card?.unitClass !== 'summoner') {
                fallback.push({ row, col });
            } else if (cell.structure && !cell.structure.card?.isStartingGate) {
                fallback.push({ row, col });
            }
        }
    }
    if (fallback.length > 0) {
        const pick = fallback[0];
        coreState.board[pick.row][pick.col] = {
            ...coreState.board[pick.row][pick.col],
            unit: undefined,
            structure: undefined,
        };
        return pick;
    }
    return null;
};

const placeEnemyUnitNearSummoner = (
    coreState: CoreState,
    summonerPos: { row: number; col: number },
) => {
    const empty = findEmptyCellWithinDistance(coreState, summonerPos, 2);
    if (!empty) throw new Error('无法找到放置心灵操控目标的空位');
    const enemyUnit = createEnemyUnit();
    enemyUnit.position = { ...empty };
    coreState.board[empty.row][empty.col] = {
        ...coreState.board[empty.row][empty.col],
        unit: enemyUnit,
    };
    return empty;
};

const findAnyEmptyCell = (coreState: CoreState) => {
    const fallback: { row: number; col: number }[] = [];
    for (let row = 0; row < coreState.board.length; row += 1) {
        for (let col = 0; col < coreState.board[row].length; col += 1) {
            const cell = coreState.board[row][col];
            if (!cell.unit && !cell.structure) return { row, col };
            if (cell.unit && cell.unit.card?.unitClass !== 'summoner') {
                fallback.push({ row, col });
            } else if (cell.structure && !cell.structure.card?.isStartingGate) {
                fallback.push({ row, col });
            }
        }
    }
    if (fallback.length > 0) {
        const pick = fallback[0];
        coreState.board[pick.row][pick.col] = {
            ...coreState.board[pick.row][pick.col],
            unit: undefined,
            structure: undefined,
        };
        return pick;
    }
    return null;
};

const placeEnemyUnitAnywhere = (coreState: CoreState) => {
    const empty = findAnyEmptyCell(coreState);
    if (!empty) throw new Error('无法找到放置催眠引诱目标的空位');
    const enemyUnit = createEnemyUnit();
    enemyUnit.position = { ...empty };
    coreState.board[empty.row][empty.col] = {
        ...coreState.board[empty.row][empty.col],
        unit: enemyUnit,
    };
    return empty;
};

// --- 状态构造函数 ---

const prepareMindControlNoTargetState = (coreState: CoreState) => {
    const next = cloneState(coreState);
    next.phase = 'summon';
    next.currentPlayer = '0';
    next.selectedUnit = undefined;
    next.attackTargetMode = undefined;
    const player = next.players?.['0'];
    if (!player) throw new Error('无法读取玩家0状态');
    player.hand = [createMindControlCard(), ...player.hand];
    player.magic = 10;
    removeEnemyNonSummonerUnits(next, '1');
    return next;
};

const prepareStunNoTargetState = (coreState: CoreState) => {
    const next = cloneState(coreState);
    next.phase = 'move';
    next.currentPlayer = '0';
    next.selectedUnit = undefined;
    next.attackTargetMode = undefined;
    const player = next.players?.['0'];
    if (!player) throw new Error('无法读取玩家0状态');
    player.hand = [createStunCard(), ...player.hand];
    player.magic = 10;
    player.moveCount = 0;
    removeEnemyNonSummonerUnits(next, '1');
    return next;
};

const prepareMindControlCancelState = (coreState: CoreState) => {
    const next = cloneState(coreState);
    next.phase = 'summon';
    next.currentPlayer = '0';
    next.selectedUnit = undefined;
    next.attackTargetMode = undefined;
    const player = next.players?.['0'];
    if (!player) throw new Error('无法读取玩家0状态');
    player.hand = [createMindControlCard(), ...player.hand];
    player.magic = 10;
    removeEnemyNonSummonerUnits(next, '1');
    const summonerPos = findSummonerPosition(next, '0');
    const targetPosition = placeEnemyUnitNearSummoner(next, summonerPos);
    return { core: next, targetPosition };
};

const prepareHypnoticLureNoTargetState = (coreState: CoreState) => {
    const next = cloneState(coreState);
    next.phase = 'summon';
    next.currentPlayer = '0';
    next.selectedUnit = undefined;
    next.attackTargetMode = undefined;
    const player = next.players?.['0'];
    if (!player) throw new Error('无法读取玩家0状态');
    player.hand = [createHypnoticLureCard(), ...player.hand];
    player.magic = 10;
    removeEnemyNonSummonerUnits(next, '1');
    return next;
};

const prepareHypnoticLureCancelState = (coreState: CoreState) => {
    const next = cloneState(coreState);
    next.phase = 'summon';
    next.currentPlayer = '0';
    next.selectedUnit = undefined;
    next.attackTargetMode = undefined;
    const player = next.players?.['0'];
    if (!player) throw new Error('无法读取玩家0状态');
    player.hand = [createHypnoticLureCard(), ...player.hand];
    player.magic = 10;
    removeEnemyNonSummonerUnits(next, '1');
    const targetPosition = placeEnemyUnitAnywhere(next);
    return { core: next, targetPosition };
};

// ============================================================================
// 测试用例
// ============================================================================

test.describe('SummonerWars 边界交互', () => {
    test('事件卡：心灵操控无有效目标', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupOnlineMatchViaUI(browser, baseURL);
        if (!setup) { test.skip(true, '服务器不可用或创建房间失败'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = setup;

        await completeFactionSelection(hostPage, guestPage);
        await waitForSummonerWarsUI(hostPage);
        await waitForSummonerWarsUI(guestPage);

        const coreState = await readCoreState(hostPage);
        const noTargetCore = prepareMindControlNoTargetState(coreState);
        await applyCoreState(hostPage, noTargetCore);
        await closeDebugPanelIfOpen(hostPage);
        await waitForPhase(hostPage, 'summon');

        const mindControlCard = hostPage.getByTestId('sw-hand-area')
            .locator('[data-card-id="trickster-mind-control"]').first();
        await expect(mindControlCard).toBeVisible({ timeout: 5000 });
        await mindControlCard.click();

        await expect(hostPage.locator('[class*="bg-cyan-900"]').filter({ hasText: /心灵操控/ })).toHaveCount(0);
        await expect(hostPage.locator('[class*="border-cyan-500"]')).toHaveCount(0);
        await expect(mindControlCard).toBeVisible();

        await hostContext.close();
        await guestContext.close();
    });

    test('事件卡：催眠引诱无有效目标', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupOnlineMatchViaUI(browser, baseURL);
        if (!setup) { test.skip(true, '服务器不可用或创建房间失败'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = setup;

        await completeFactionSelection(hostPage, guestPage);
        await waitForSummonerWarsUI(hostPage);
        await waitForSummonerWarsUI(guestPage);

        const coreState = await readCoreState(hostPage);
        const noTargetCore = prepareHypnoticLureNoTargetState(coreState);
        await applyCoreState(hostPage, noTargetCore);
        await closeDebugPanelIfOpen(hostPage);
        await waitForPhase(hostPage, 'summon');

        const card = hostPage.getByTestId('sw-hand-area')
            .locator('[data-card-id="trickster-hypnotic-lure"]').first();
        await expect(card).toBeVisible({ timeout: 5000 });
        await card.click();

        await expect(hostPage.locator('[class*="bg-pink-900"]').filter({ hasText: /催眠引诱/ })).toHaveCount(0);
        await expect(hostPage.locator('[class*="border-pink-400"]')).toHaveCount(0);
        await expect(card).toBeVisible();

        await hostContext.close();
        await guestContext.close();
    });

    test('事件卡：震慑无有效目标', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupOnlineMatchViaUI(browser, baseURL);
        if (!setup) { test.skip(true, '服务器不可用或创建房间失败'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = setup;

        await completeFactionSelection(hostPage, guestPage);
        await waitForSummonerWarsUI(hostPage);
        await waitForSummonerWarsUI(guestPage);

        const coreState = await readCoreState(hostPage);
        const noTargetCore = prepareStunNoTargetState(coreState);
        await applyCoreState(hostPage, noTargetCore);
        await closeDebugPanelIfOpen(hostPage);
        await waitForPhase(hostPage, 'move');

        const card = hostPage.getByTestId('sw-hand-area')
            .locator('[data-card-id="trickster-stun"]').first();
        await expect(card).toBeVisible({ timeout: 5000 });
        await card.click();

        await expect(hostPage.locator('[class*="bg-yellow-900"]').filter({ hasText: /震慑/ })).toHaveCount(0);
        await expect(hostPage.locator('[class*="border-yellow-400"]')).toHaveCount(0);
        await expect(card).toBeVisible();

        await hostContext.close();
        await guestContext.close();
    });

    test('事件卡：心灵操控取消回滚', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupOnlineMatchViaUI(browser, baseURL);
        if (!setup) { test.skip(true, '服务器不可用或创建房间失败'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = setup;

        await completeFactionSelection(hostPage, guestPage);
        await waitForSummonerWarsUI(hostPage);
        await waitForSummonerWarsUI(guestPage);

        const coreState = await readCoreState(hostPage);
        const { core: cancelCore, targetPosition } = prepareMindControlCancelState(coreState);
        await applyCoreState(hostPage, cancelCore);
        await closeDebugPanelIfOpen(hostPage);
        await waitForPhase(hostPage, 'summon');

        const card = hostPage.getByTestId('sw-hand-area')
            .locator('[data-card-id="trickster-mind-control"]').first();
        await expect(card).toBeVisible({ timeout: 5000 });
        await card.click();

        const banner = hostPage.locator('[class*="bg-cyan-900"]').filter({ hasText: /心灵操控/ });
        await expect(banner).toBeVisible({ timeout: 3000 });

        await clickBoardElement(hostPage, `[data-testid="sw-unit-${targetPosition.row}-${targetPosition.col}"]`);
        await expect(banner.getByRole('button', { name: /确认控制/ })).toBeVisible({ timeout: 3000 });
        await banner.getByRole('button', { name: /取消/ }).click();

        await expect(banner).toHaveCount(0);
        await expect(hostPage.locator('[class*="border-cyan-500"]')).toHaveCount(0);
        await expect(card).toBeVisible();

        await hostContext.close();
        await guestContext.close();
    });

    test('事件卡：催眠引诱取消回滚', async ({ browser }, testInfo) => {
        test.setTimeout(90000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupOnlineMatchViaUI(browser, baseURL);
        if (!setup) { test.skip(true, '服务器不可用或创建房间失败'); return; }
        const { hostPage, guestPage, hostContext, guestContext } = setup;

        await completeFactionSelection(hostPage, guestPage);
        await waitForSummonerWarsUI(hostPage);
        await waitForSummonerWarsUI(guestPage);

        const coreState = await readCoreState(hostPage);
        const { core: cancelCore, targetPosition } = prepareHypnoticLureCancelState(coreState);
        await applyCoreState(hostPage, cancelCore);
        await closeDebugPanelIfOpen(hostPage);
        await waitForPhase(hostPage, 'summon');

        const card = hostPage.getByTestId('sw-hand-area')
            .locator('[data-card-id="trickster-hypnotic-lure"]').first();
        await expect(card).toBeVisible({ timeout: 5000 });
        await card.click();

        const banner = hostPage.locator('[class*="bg-pink-900"]').filter({ hasText: /催眠引诱/ });
        await expect(banner).toBeVisible({ timeout: 3000 });

        const targetCell = hostPage.getByTestId(`sw-cell-${targetPosition.row}-${targetPosition.col}`);
        await expect(targetCell).toHaveClass(/border-pink-400/);

        await banner.getByRole('button', { name: /取消/ }).click();

        await expect(banner).toHaveCount(0);
        await expect(targetCell).not.toHaveClass(/border-pink-400/);
        await expect(card).toBeVisible();

        await hostContext.close();
        await guestContext.close();
    });
});
