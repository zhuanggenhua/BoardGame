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
import { test, expect } from '../../framework';
import { ALL_TOKEN_DEFINITIONS, initHeroState } from '../../../src/games/dicethrone/domain/characters';
import { TOKEN_IDS } from '../../../src/games/dicethrone/domain/ids';

type MatchState = Record<string, any>;
type CardInteractionDescriptor = Record<string, any>;
const FIXED_RANDOM = {
    random: () => 0.5,
    d: (max: number) => Math.min(max, 1),
    range: (min: number) => min,
    shuffle: <T,>(array: T[]) => [...array],
};

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

const createTokenResponseInteraction = (playerId = '0') => ({
    id: `dt-token-response-${playerId}`,
    kind: 'dt:token-response',
    playerId,
    data: null,
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

const injectSamuraiHonorTokenResponseScene = async (page: Page) => {
    const currentState = await readHarnessState<MatchState>(page);
    const samuraiBase = initHeroState('0', 'samurai', FIXED_RANDOM as any);
    const monkBase = initHeroState('1', 'monk', FIXED_RANDOM as any);

    const nextState = structuredClone(currentState);
    nextState.sys.phase = 'offensiveRoll';
    nextState.sys.interaction = {
        ...(nextState.sys.interaction ?? {}),
        current: {
            id: 'dt-token-response-samurai-honor-window',
            kind: 'dt:token-response',
            playerId: '0',
            data: null,
        },
        queue: [],
    };
    nextState.core.activePlayerId = '0';
    nextState.core.hostStarted = true;
    nextState.core.tokenDefinitions = ALL_TOKEN_DEFINITIONS;
    nextState.core.selectedCharacters = {
        ...(nextState.core.selectedCharacters ?? {}),
        '0': 'samurai',
        '1': 'monk',
    };
    nextState.core.rollCount = 1;
    nextState.core.rollConfirmed = true;
    nextState.core.dice = [1, 2, 3, 4, 5].map((value, index) => ({
        id: index,
        value,
        isKept: false,
        playerId: '0',
    }));
    nextState.core.players['0'] = {
        ...samuraiBase,
        hand: [],
        discard: [],
        resources: {
            ...samuraiBase.resources,
            cp: 2,
            hp: 50,
        },
        tokens: {
            ...samuraiBase.tokens,
            [TOKEN_IDS.HONOR]: 3,
            [TOKEN_IDS.SHAME]: 0,
            [TOKEN_IDS.SAMURAI_RETRIBUTION]: 0,
        },
    };
    nextState.core.players['1'] = {
        ...monkBase,
        hand: [],
        discard: [],
        resources: {
            ...monkBase.resources,
            cp: 2,
            hp: 50,
        },
    };
    nextState.core.pendingAttack = {
        attackerId: '0',
        defenderId: '1',
        isDefendable: true,
        sourceAbilityId: 'katana-slice-3',
        damage: 4,
        bonusDamage: 0,
        attackModifierBonusDamage: 0,
        damageResolved: false,
        resolvedDamage: 0,
        preDefenseResolved: false,
        offensiveRollEndTokenResolved: false,
    };
    nextState.core.pendingDamage = {
        id: 'samurai-honor-window',
        sourcePlayerId: '0',
        targetPlayerId: '1',
        originalDamage: 4,
        currentDamage: 4,
        sourceAbilityId: 'katana-slice-3',
        responseType: 'beforeDamageDealt',
        responderId: '0',
        isFullyEvaded: false,
    };

    await page.evaluate((state) => {
        (window as any).__BG_TEST_HARNESS__!.state.set(state);
    }, nextState);
    await page.waitForTimeout(300);
};

test.describe('DiceThrone - Status Interaction Complete', () => {
    test.describe.configure({ timeout: 120000 });

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
        await expect(page.getByTestId('dt-player-target-1').getByText(/没有状态效果|No status effects/i)).toBeVisible();
        await expect(confirmButton).toBeDisabled();

        await page.getByTestId('dt-player-target-1').click();
        await expect(confirmButton).toBeDisabled();

        await page.getByTestId('dt-player-target-0').click();
        await expect(confirmButton).toBeEnabled();
    });

    test('selectPlayer 当前台交互存在时，不应再并列弹出 token 响应窗口', async ({ page, game }, testInfo) => {
        await openInteractionHarness(page, game);

        await applyHarnessState(page, (state) => {
            state.core.players['0'].statusEffects = { poison: 1 };
            state.core.players['0'].tokens = { protect: 1 };
            state.core.players['1'].statusEffects = {};
            state.core.players['1'].tokens = {};
            state.core.pendingDamage = {
                id: 'test-pending-damage-overlap',
                sourcePlayerId: '1',
                targetPlayerId: '0',
                originalDamage: 5,
                currentDamage: 5,
                responseType: 'beforeDamageReceived',
                responderId: '0',
                tokenUsageTotals: {},
            };
            state.sys.interaction = {
                ...(state.sys.interaction ?? {}),
                current: wrapCardInteraction({
                    id: 'test-select-player-overlap',
                    type: 'selectPlayer',
                    sourceCardId: 'test-card',
                    playerId: '0',
                    titleKey: 'interaction.selectPlayerToRemoveAllStatus',
                    selectCount: 1,
                    targetPlayerIds: ['0', '1'],
                    selected: [],
                    requiresTargetWithStatus: true,
                }),
                queue: [createTokenResponseInteraction('0')],
            };
            return state;
        });

        const confirmButton = page.getByRole('button', { name: /确认|Confirm/i }).last();
        await expect(page.getByTestId('dt-player-target-0')).toBeVisible();
        await expect(page.getByTestId('token-response-modal')).toHaveCount(0);
        await expect(confirmButton).toBeDisabled();

        await page.getByTestId('dt-player-target-0').click();
        await expect(confirmButton).toBeEnabled();
        await game.screenshot('select-player-foreground-over-token-response', testInfo);
    });

    test('selectPlayer 取消后，应恢复排队的 token 响应窗口为前台', async ({ page, game }, testInfo) => {
        await openInteractionHarness(page, game);

        await applyHarnessState(page, (state) => {
            state.core.players['0'].statusEffects = { poison: 1 };
            state.core.players['0'].tokens = { protect: 1 };
            state.core.players['1'].statusEffects = {};
            state.core.players['1'].tokens = {};
            state.core.pendingDamage = {
                id: 'test-pending-damage-resume-after-cancel',
                sourcePlayerId: '1',
                targetPlayerId: '0',
                originalDamage: 5,
                currentDamage: 5,
                responseType: 'beforeDamageReceived',
                responderId: '0',
                tokenUsageTotals: {},
            };
            state.sys.interaction = {
                ...(state.sys.interaction ?? {}),
                current: wrapCardInteraction({
                    id: 'test-select-player-cancel-resume-token',
                    type: 'selectPlayer',
                    sourceCardId: 'test-card',
                    playerId: '0',
                    titleKey: 'interaction.selectPlayerToRemoveAllStatus',
                    selectCount: 1,
                    targetPlayerIds: ['0', '1'],
                    selected: [],
                    requiresTargetWithStatus: true,
                }),
                queue: [createTokenResponseInteraction('0')],
            };
            return state;
        });

        await expect(page.getByTestId('dt-player-target-0')).toBeVisible();
        await expect(page.getByTestId('token-response-modal')).toHaveCount(0);
        await game.screenshot('select-player-before-token-response-resume', testInfo);

        await page.getByRole('button', { name: /取消|Cancel/i }).last().click();

        await page.waitForFunction(() => {
            const current = (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current;
            return current?.kind === 'dt:token-response';
        }, { timeout: 5000, polling: 200 });

        const tokenResponseModal = page.getByTestId('token-response-modal');
        await expect(tokenResponseModal).toBeVisible();
        await expect(page.getByTestId('dt-player-target-0')).toHaveCount(0);
        await expect(tokenResponseModal).toContainText(/\b5\b/);
        await game.screenshot('select-player-cancel-resumes-token-response', testInfo);
    });

    test('token 响应窗口在前台时，samurai honor 可连续使用两次并正常收口', async ({ page, game }, testInfo) => {
        await openInteractionHarness(page, game);
        await injectSamuraiHonorTokenResponseScene(page);

        const tokenResponseModal = page.getByTestId('token-response-modal');
        const honorLabel = page.getByText(/^荣誉$|^Honor$/).first();
        const useButton = page.getByRole('button', { name: /^(使用|Use|Use Token)(?: x\d+)?$/i }).first();

        await expect(tokenResponseModal).toBeVisible();
        await expect(honorLabel).toBeVisible();
        await expect(useButton).toBeVisible();
        await game.screenshot('samurai-honor-token-response-before-first-use', testInfo);

        await useButton.click();
        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.core?.pendingDamage?.currentDamage === 5
                && state?.core?.pendingDamage?.tokenUsageTotals?.honor === 1
                && state?.core?.players?.['0']?.tokens?.honor === 2;
        }, { timeout: 10000, polling: 200 });
        await expect(tokenResponseModal).toContainText(/\b5\b/);
        await game.screenshot('samurai-honor-token-response-after-first-use', testInfo);

        await useButton.click();
        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.core?.pendingDamage
                && !state?.sys?.interaction?.current
                && state?.core?.players?.['0']?.tokens?.honor === 1
                && state?.core?.players?.['1']?.resources?.hp === 43;
        }, { timeout: 10000, polling: 200 });

        const finalState = await readHarnessState<MatchState>(page);
        expect(finalState.core.pendingDamage ?? null).toBeNull();
        expect(finalState.sys.interaction.current ?? null).toBeNull();
        expect(finalState.core.players['0'].tokens.honor).toBe(1);
        expect(finalState.core.players['1'].resources.hp).toBe(43);
        await expect(tokenResponseModal).toBeHidden();
        await game.screenshot('samurai-honor-token-response-finalized', testInfo);
    });

    test('simple-choice 关闭后，应恢复排队的 token 响应窗口并允许继续收口', async ({ page, game }, testInfo) => {
        await openInteractionHarness(page, game);

        await applyHarnessState(page, (state) => {
            state.core.players['0'].statusEffects = {};
            state.core.players['0'].tokens = { protect: 1 };
            state.core.players['1'].statusEffects = {};
            state.core.players['1'].tokens = {};
            state.core.pendingDamage = {
                id: 'test-pending-damage-resume-after-choice',
                sourcePlayerId: '1',
                targetPlayerId: '0',
                originalDamage: 5,
                currentDamage: 5,
                responseType: 'beforeDamageReceived',
                responderId: '0',
                tokenUsageTotals: {},
            };
            state.sys.interaction = {
                ...(state.sys.interaction ?? {}),
                current: {
                    id: 'test-simple-choice-foreground',
                    kind: 'simple-choice',
                    playerId: '0',
                    data: {
                        title: '测试前台选择',
                        options: [
                            {
                                id: 'continue',
                                label: '继续',
                                value: 'continue',
                            },
                        ],
                    },
                },
                queue: [createTokenResponseInteraction('0')],
            };
            return state;
        });

        await expect(page.getByText('测试前台选择')).toBeVisible();
        await expect(page.getByTestId('token-response-modal')).toHaveCount(0);
        await game.screenshot('simple-choice-before-token-response-resume', testInfo);

        await page.getByRole('button', { name: /^继续$/ }).click();

        await page.waitForFunction(() => {
            const current = (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current;
            return current?.kind === 'dt:token-response';
        }, { timeout: 5000, polling: 200 });

        const tokenResponseModal = page.getByTestId('token-response-modal');
        await expect(tokenResponseModal).toBeVisible();
        await expect(page.getByText('测试前台选择')).toHaveCount(0);
        await game.screenshot('simple-choice-resumes-token-response', testInfo);

        await page.getByRole('button', { name: /跳过|Skip/i }).click();
        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return !state?.core?.pendingDamage && !state?.sys?.interaction?.current;
        }, { timeout: 5000, polling: 200 });

        await expect(tokenResponseModal).toBeHidden();
        await game.screenshot('simple-choice-token-response-finalized', testInfo);
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
