/**
 * DiceThrone 状态交互共享 UI 契约 E2E
 *
 * 这份文件不再重复验证具体卡牌效果执行，
 * 只守住共享交互层当前仍有独立维护价值的 UI 契约：
 * - `selectStatus` 选择器、确认按钮启用与取消关闭
 * - `selectPlayer` 空目标禁用与“无状态”提示
 * - `selectTargetStatus` 第二阶段的锁定来源卡与真实目标卡结构
 */

import type { Page } from '@playwright/test';
import { test, expect } from './framework';

type MatchState = Record<string, any>;
type CardInteractionDescriptor = Record<string, any>;

const readHarnessState = async <T = MatchState>(page: Page): Promise<T> => {
    return page.evaluate(() => (window as any).__BG_TEST_HARNESS__!.state.get());
};

const applyHarnessState = async (
    page: Page,
    updater: (state: MatchState) => MatchState,
) => {
    const currentState = await readHarnessState<MatchState>(page);
    const nextState = updater(structuredClone(currentState));
    await page.evaluate((state) => {
        (window as any).__BG_TEST_HARNESS__!.state.set(state);
    }, nextState);
    await page.waitForTimeout(200);
};

const waitForInteractionClosed = async (page: Page) => {
    await page.waitForFunction(() => {
        return !(window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current;
    }, { timeout: 5000 });
};

const wrapCardInteraction = (
    interaction: CardInteractionDescriptor,
) => ({
    id: interaction.id,
    kind: 'dt:card-interaction',
    playerId: interaction.playerId,
    data: interaction,
});

const openInteractionHarness = async (page: Page, game: any) => {
    await game.openTestGame('dicethrone');
    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            resources: { hp: 50, cp: 3 },
        },
        player1: {
            resources: { hp: 50, cp: 2 },
        },
        currentPlayer: '0',
        phase: 'main1',
        extra: {
            hostStarted: true,
            selectedCharacters: {
                '0': 'barbarian',
                '1': 'moon_elf',
            },
        },
    });

    await page.waitForFunction(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        return state?.sys?.phase === 'main1'
            && state?.core?.players?.['0']
            && state?.core?.players?.['1'];
    }, { timeout: 10000 });
};

test.describe('DiceThrone - Status Interaction Complete', () => {
    test('selectStatus: 使用现役 dt-status-effect 选择器，取消后不改状态', async ({ page, game }) => {
        await openInteractionHarness(page, game);

        await applyHarnessState(page, (state) => {
            state.core.players['0'].statusEffects = { poison: 2, burn: 1 };
            state.core.players['0'].tokens = {};
            state.sys.interaction = {
                ...(state.sys.interaction ?? {}),
                current: wrapCardInteraction({
                    id: 'test-select-status',
                    type: 'selectStatus',
                    sourceCardId: 'test-card',
                    playerId: '0',
                    titleKey: 'interaction.selectStatusToRemove',
                    selectCount: 1,
                    targetPlayerIds: ['0'],
                    selected: [],
                }),
            };
            return state;
        });

        await expect(page.getByTestId('dt-status-owner-0')).toHaveAttribute('data-team-tone', 'self');
        await expect(page.getByTestId('dt-status-effect-0-poison')).toBeVisible();

        const confirmButton = page.getByRole('button', { name: /确认|Confirm/i }).last();
        const cancelButton = page.getByRole('button', { name: /取消|Cancel/i }).last();

        await expect(confirmButton).toBeDisabled();
        await expect(cancelButton).toBeEnabled();

        await page.getByTestId('dt-status-effect-0-poison').click();
        await expect(confirmButton).toBeEnabled();

        await cancelButton.click();
        await waitForInteractionClosed(page);

        const finalState = await readHarnessState<MatchState>(page);
        expect(finalState.core.players['0'].statusEffects.poison).toBe(2);
        expect(finalState.core.players['0'].statusEffects.burn).toBe(1);
    });

    test('selectStatus: token 也走现役 dt-status-effect 选择器并可启用确认', async ({ page, game }) => {
        await openInteractionHarness(page, game);

        await applyHarnessState(page, (state) => {
            state.core.players['1'].statusEffects = {};
            state.core.players['1'].tokens = { crit: 1 };
            state.sys.interaction = {
                ...(state.sys.interaction ?? {}),
                current: wrapCardInteraction({
                    id: 'test-select-status-token',
                    type: 'selectStatus',
                    sourceCardId: 'test-card',
                    playerId: '0',
                    titleKey: 'interaction.selectStatusToRemove',
                    selectCount: 1,
                    targetPlayerIds: ['1'],
                    selected: [],
                }),
            };
            return state;
        });

        const confirmButton = page.getByRole('button', { name: /确认|Confirm/i }).last();
        await expect(page.getByTestId('dt-status-owner-1')).toHaveAttribute('data-team-tone', 'enemy');
        await expect(page.getByTestId('dt-status-effect-1-crit')).toBeVisible();
        await expect(confirmButton).toBeDisabled();

        await page.getByTestId('dt-status-effect-1-crit').click();
        await expect(confirmButton).toBeEnabled();
    });

    test('selectPlayer: requiresTargetWithStatus 会禁用空目标并显示无状态提示', async ({ page, game }) => {
        await openInteractionHarness(page, game);

        await applyHarnessState(page, (state) => {
            state.core.players['0'].statusEffects = { poison: 1 };
            state.core.players['0'].tokens = {};
            state.core.players['1'].statusEffects = {};
            state.core.players['1'].tokens = {};
            state.sys.interaction = {
                ...(state.sys.interaction ?? {}),
                current: wrapCardInteraction({
                    id: 'test-select-player',
                    type: 'selectPlayer',
                    sourceCardId: 'test-card',
                    playerId: '0',
                    titleKey: 'interaction.selectPlayerToRemoveAllStatus',
                    selectCount: 1,
                    targetPlayerIds: ['0', '1'],
                    selected: [],
                    requiresTargetWithStatus: true,
                }),
            };
            return state;
        });

        const confirmButton = page.getByRole('button', { name: /确认|Confirm/i }).last();
        await expect(page.getByTestId('dt-player-target-0')).toHaveAttribute('data-team-tone', 'self');
        await expect(page.getByTestId('dt-player-target-1')).toHaveAttribute('data-team-tone', 'enemy');
        await expect(page.getByTestId('dt-player-target-1').getByText(/无状态|No Status/i)).toBeVisible();
        await expect(confirmButton).toBeDisabled();

        await page.getByTestId('dt-player-target-1').click();
        await expect(confirmButton).toBeDisabled();

        await page.getByTestId('dt-player-target-0').click();
        await expect(confirmButton).toBeEnabled();
    });

    test('selectTargetStatus: 第二阶段保留锁定来源卡，只显示真实目标卡', async ({ page, game }) => {
        await openInteractionHarness(page, game);

        await applyHarnessState(page, (state) => {
            state.core.players['0'].statusEffects = { poison: 2, burn: 1 };
            state.core.players['0'].tokens = {};
            state.core.players['1'].statusEffects = {};
            state.core.players['1'].tokens = {};
            state.sys.interaction = {
                ...(state.sys.interaction ?? {}),
                current: wrapCardInteraction({
                    id: 'test-transfer-phase-2',
                    type: 'selectTargetStatus',
                    sourceCardId: 'test-card',
                    playerId: '0',
                    titleKey: 'interaction.selectStatusToTransfer',
                    selectCount: 1,
                    targetPlayerIds: ['0', '1'],
                    selected: [],
                    transferConfig: {
                        sourcePlayerId: '0',
                        statusId: 'poison',
                    },
                }),
            };
            return state;
        });

        const confirmButton = page.getByRole('button', { name: /确认|Confirm/i }).last();
        const cancelButton = page.getByRole('button', { name: /取消|Cancel/i }).last();

        await expect(page.getByTestId('dt-transfer-source-locked-0')).toHaveAttribute('data-locked', 'true');
        await expect(page.getByTestId('dt-transfer-source-locked-0')).toHaveAttribute('data-team-tone', 'self');
        await expect(page.getByTestId('dt-transfer-target-1')).toHaveAttribute('data-team-tone', 'enemy');
        await expect(page.getByTestId('dt-transfer-source-effect-poison')).toBeVisible();
        await expect(page.locator('[data-testid^="dt-status-owner-"]')).toHaveCount(0);
        await expect(confirmButton).toBeDisabled();

        await page.getByTestId('dt-transfer-source-locked-0').click();
        await expect(confirmButton).toBeDisabled();

        await page.getByTestId('dt-transfer-target-1').click();
        await expect(confirmButton).toBeEnabled();

        await cancelButton.click();
        await waitForInteractionClosed(page);
    });
});
