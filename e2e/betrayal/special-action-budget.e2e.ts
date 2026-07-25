import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'path';
import type { BetrayalCore, BetrayalInventoryCard } from '../../src/games/betrayal/game';
import { createStartedFirstScenarioCore } from '../../src/games/betrayal/testing/firstScenarioTestUtils';
import {
    assertNoFatalFrontendErrors,
    attachPageDiagnostics,
} from '../helpers/common';
import {
    initBetrayalContext,
    injectCore,
    saveScreenshot,
    waitForBetrayalPageReady,
    warmBetrayalFrontend,
} from './betrayalTestHelpers';

const EVIDENCE_DIR = resolve(process.cwd(), 'evidence/betrayal-core-interactions/special-action-budget');
const PASSIVE_POSSESSION_SCREENSHOT = `${EVIDENCE_DIR}/01-被动持有物不能主动使用.jpg`;
const NEW_POSSESSION_SCREENSHOT = `${EVIDENCE_DIR}/02-本回合新获得下回合可用.jpg`;
const USED_ROOM_EFFECT_SCREENSHOT = `${EVIDENCE_DIR}/03-房间效果本回合已用.jpg`;

type HarnessWindow = Window & {
    __BG_TEST_HARNESS__?: {
        state?: {
            get?: () => {
                core?: BetrayalCore;
            };
        };
    };
};

function dismissBlockingOverlays(core: BetrayalCore): void {
    core.latestDiscovery = null;
    core.latestDiscoveryOwnerPlayerId = null;
    core.pendingEventChoice = null;
    core.pendingTradeAgreement = null;
    core.pendingDamageAllocation = null;
    core.recentRoll = null;
    core.recentAllTraitCheck = null;
    core.latestRoomDrawResolution = null;
    core.turnEndedByDiscovery = false;
    core.activePlayerId = null;
}

function setCurrentInventory(
    core: BetrayalCore,
    cards: BetrayalInventoryCard[],
    options: { turnStartCardIds?: string[]; receivedCardIds?: string[] } = {},
): void {
    const inventory = cards.map((card) => ({ ...card }));
    core.currentExplorer = {
        ...core.currentExplorer,
        inventory,
    };
    core.currentExplorerInventory = inventory.map((card) => ({ ...card }));
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.turnStartInventoryCardIds = options.turnStartCardIds ?? inventory.map((card) => card.id);
    core.receivedCardIdsThisTurnByPlayerId = {
        ...core.receivedCardIdsThisTurnByPlayerId,
        [core.currentExplorer.playerId]: options.receivedCardIds ?? [],
    };
    core.usedCardIdsThisTurn = [];
    core.recommendedAction = 'use';
}

function createPassivePossessionBudgetCore(): BetrayalCore {
    const core = createStartedFirstScenarioCore(['0', '1', '2']);
    dismissBlockingOverlays(core);
    setCurrentInventory(core, [{ id: 'armor', name: '盔甲', kind: 'omen' }]);
    return core;
}

function createNewPossessionBudgetCore(): BetrayalCore {
    const core = createStartedFirstScenarioCore(['0', '1', '2']);
    dismissBlockingOverlays(core);
    setCurrentInventory(
        core,
        [{ id: 'holy-water', name: '奇怪的药品', kind: 'item' }],
        { turnStartCardIds: [], receivedCardIds: ['holy-water'] },
    );
    return core;
}

function createUsedRoomEffectBudgetCore(): BetrayalCore {
    const core = createStartedFirstScenarioCore(['0', '1', '2']);
    dismissBlockingOverlays(core);
    setCurrentInventory(core, []);
    const roomId = 'upper-landing';
    core.currentExplorer = {
        ...core.currentExplorer,
        roomId,
        inventory: [],
    };
    core.currentExplorerInventory = [];
    core.turnStartInventoryCardIds = [];
    core.activeRoomId = roomId;
    core.currentExplorerRoomId = roomId;
    core.movesRemaining = 4;
    core.recommendedAction = 'move';
    core.rooms = core.rooms.map((room) =>
        room.id === roomId
            ? {
                ...room,
                state: 'discovered',
                name: '神秘电梯',
                visualId: 'mysticElevator',
                enterEffect: 'mysticElevator',
            }
            : room,
    );
    core.scenarioRuntime = {
        ...core.scenarioRuntime,
        usedRoomEffectIdsThisTurn: ['mysticElevator'],
    };
    return core;
}

async function waitForInventoryAtlas(page: Page, cardIds: string[]) {
    await expect.poll(async () => page.evaluate((ids) => {
        return Object.fromEntries(ids.map((cardId) => {
            const image = document.querySelector<HTMLImageElement>(
                `[data-testid="betrayal-inventory-${cardId}-front-atlas"]`,
            );
            return [
                cardId,
                Boolean(image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0),
            ];
        }));
    }, cardIds), {
        message: '特殊行动预算 E2E 必须等持有区正式牌面 atlas 加载完成后再截图',
        timeout: 15000,
    }).toEqual(Object.fromEntries(cardIds.map((cardId) => [cardId, true])));
}

async function readBudgetViewState(page: Page) {
    return page.evaluate(() => {
        const holder = window as HarnessWindow;
        const core = holder.__BG_TEST_HARNESS__?.state?.get?.().core;
        const useAction = document.querySelector<HTMLButtonElement>('[data-testid="betrayal-action-use"]');
        const roomEffectAction = document.querySelector<HTMLButtonElement>('[data-testid="betrayal-action-roomEffect"]');
        const visibleReason = document.querySelector<HTMLElement>('[data-testid="betrayal-action-disabled-reason-visible"]');
        const mobileUseStatus = document.querySelector<HTMLElement>('[data-testid="betrayal-mobile-use-status"]');
        return {
            phase: core?.phase ?? null,
            currentPlayer: core?.currentPlayer ?? null,
            currentInventoryIds: core?.currentExplorerInventory?.map((card) => card.id) ?? [],
            turnStartInventoryCardIds: core?.turnStartInventoryCardIds ?? [],
            receivedCardIds: core?.receivedCardIdsThisTurnByPlayerId?.[core.currentExplorer.playerId] ?? [],
            usedCardIds: core?.usedCardIdsThisTurn ?? [],
            usedRoomEffectIds: core?.scenarioRuntime?.usedRoomEffectIdsThisTurn ?? [],
            currentRoomId: core?.currentExplorer?.roomId ?? null,
            useDisabled: Boolean(useAction?.disabled),
            useDisabledReason: useAction?.getAttribute('data-action-disabled-reason') ?? '',
            roomEffectText: roomEffectAction?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
            roomEffectDisabled: Boolean(roomEffectAction?.disabled),
            roomEffectDisabledReason: roomEffectAction?.getAttribute('data-action-disabled-reason') ?? '',
            visibleReason: visibleReason?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
            mobileUseStatus: mobileUseStatus?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        };
    });
}

test.describe('山屋惊魂特殊行动预算', () => {
    test('真实牌桌显示被动、刚获得和房间效果已用的特殊行动禁用原因', async ({ page, context }) => {
        test.setTimeout(180000);
        await initBetrayalContext(context);
        const diagnostics = attachPageDiagnostics(page, 'betrayal-special-action-budget');

        await page.setViewportSize({ width: 1600, height: 900 });
        await warmBetrayalFrontend(context);
        await page.goto('/play/betrayal?players=3&seat0=human&seat1=human&seat2=human&playerID=0', {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
        });
        await waitForBetrayalPageReady(page);

        await injectCore(page, createPassivePossessionBudgetCore());
        await expect(page.getByTestId('betrayal-board')).toBeVisible({ timeout: 30000 });
        await waitForInventoryAtlas(page, ['armor']);
        await page.getByTestId('betrayal-inventory-armor').click();
        await expect(page.getByTestId('betrayal-action-use')).toBeDisabled();
        await expect(page.getByTestId('betrayal-action-use')).toHaveAttribute(
            'data-action-disabled-reason',
            '被动效果，不能主动使用',
        );
        await expect(page.getByTestId('betrayal-action-disabled-reason-visible')).toContainText('被动效果，不能主动使用');
        await expect.poll(() => readBudgetViewState(page), {
            message: '被动持有物必须保留使用入口，但说明它不是主动特殊行动',
            timeout: 10000,
        }).toMatchObject({
            phase: 'preHaunt',
            currentPlayer: '0',
            currentInventoryIds: ['armor'],
            turnStartInventoryCardIds: ['armor'],
            useDisabled: true,
            useDisabledReason: '被动效果，不能主动使用',
            visibleReason: '被动效果，不能主动使用',
            mobileUseStatus: '被动效果，不能主动使用',
        });
        await saveScreenshot(page, PASSIVE_POSSESSION_SCREENSHOT);

        await injectCore(page, createNewPossessionBudgetCore());
        await waitForInventoryAtlas(page, ['holy-water']);
        await page.getByTestId('betrayal-inventory-holy-water').click();
        await expect(page.getByTestId('betrayal-action-use')).toBeDisabled();
        await expect(page.getByTestId('betrayal-action-use')).toHaveAttribute(
            'data-action-disabled-reason',
            '本回合新获得，下回合可用',
        );
        await expect(page.getByTestId('betrayal-action-disabled-reason-visible')).toContainText('本回合新获得，下回合可用');
        await expect(page.getByTestId('betrayal-inventory-holy-water-shell').locator('..')).toContainText('下回合');
        await expect.poll(() => readBudgetViewState(page), {
            message: '本回合新获得的主动持有物必须在真实页面说明下回合才可用',
            timeout: 10000,
        }).toMatchObject({
            phase: 'preHaunt',
            currentPlayer: '0',
            currentInventoryIds: ['holy-water'],
            turnStartInventoryCardIds: [],
            receivedCardIds: ['holy-water'],
            useDisabled: true,
            useDisabledReason: '本回合新获得，下回合可用',
            visibleReason: '本回合新获得，下回合可用',
            mobileUseStatus: '本回合新获得，下回合可用',
        });
        await saveScreenshot(page, NEW_POSSESSION_SCREENSHOT);

        await injectCore(page, createUsedRoomEffectBudgetCore());
        const roomEffectAction = page.getByTestId('betrayal-action-roomEffect');
        await expect(roomEffectAction).toBeVisible();
        await expect(roomEffectAction).toContainText('神秘电梯');
        await expect(roomEffectAction).toBeDisabled();
        await expect(roomEffectAction).toHaveAttribute(
            'data-action-disabled-reason',
            '该房间效果本回合已用',
        );
        await expect(page.getByTestId('betrayal-action-disabled-reason-visible')).toContainText('该房间效果本回合已用');
        await expect.poll(() => readBudgetViewState(page), {
            message: '房间效果每来源每回合一次，已用后仍保留入口和短禁用原因',
            timeout: 10000,
        }).toMatchObject({
            phase: 'preHaunt',
            currentPlayer: '0',
            currentInventoryIds: [],
            usedRoomEffectIds: ['mysticElevator'],
            currentRoomId: 'upper-landing',
            roomEffectText: expect.stringContaining('神秘电梯'),
            roomEffectDisabled: true,
            roomEffectDisabledReason: '该房间效果本回合已用',
            visibleReason: '该房间效果本回合已用',
        });
        await saveScreenshot(page, USED_ROOM_EFFECT_SCREENSHOT);

        await assertNoFatalFrontendErrors([{ label: 'betrayal-special-action-budget', diagnostics }]);
    });
});
