/**
 * DiceThrone 护盾日志显示 E2E 测试
 *
 * 验证护盾减伤在 ActionLog 中的实际显示效果。
 */

import { test, expect } from '../framework';
import { dragDiceThroneHandCardToPlay, maybePassResponse } from '../helpers/dicethrone';

const DICETHRONE_CHEAT_DEAL_DAMAGE_COMMAND = 'SYS_CHEAT_DEAL_DAMAGE';

test.describe('DiceThrone 护盾日志显示', () => {
    test('多个护盾叠加时应显示正确的最终伤害', async ({ page, game }) => {
        await game.openTestGame('dicethrone');

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                resources: { HP: 50 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '0',
            phase: 'main2',
            extra: {
                selectedCharacters: { '0': 'paladin', '1': 'shadow_thief' },
                hostStarted: true,
            },
        });

        await page.evaluate(async (dealDamageCommand) => {
            const holder = window as any;
            const harness = holder.__BG_TEST_HARNESS__;
            if (!harness) {
                throw new Error('TestHarness not available');
            }
            delete holder.__BG_LAST_COMMAND_REJECTED__;

            harness.state.patch({
                core: {
                    players: {
                        '0': {
                            damageShields: [
                                { sourceId: 'card-next-time', value: 6, preventStatus: false },
                                { sourceId: 'holy-defense', value: 3, preventStatus: false },
                            ],
                        },
                    },
                },
            });

            await harness.command.dispatch({
                type: dealDamageCommand,
                playerId: '1',
                payload: {
                    targetId: '0',
                    amount: 10,
                    sourceAbilityId: 'test-attack',
                    sourcePlayerId: '1',
                    damageScope: 'direct',
                },
            });

            const rejected = holder.__BG_LAST_COMMAND_REJECTED__;
            if (rejected?.commandType === dealDamageCommand) {
                throw new Error(`调试伤害命令被拒绝: ${rejected.error}`);
            }
        }, DICETHRONE_CHEAT_DEAL_DAMAGE_COMMAND);

        await page.waitForFunction(
            () => {
                const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
                const entries = state?.sys?.actionLog?.entries ?? [];
                return entries.some((entry: any) => entry.kind === 'DAMAGE_DEALT');
            },
            { timeout: 5000, polling: 200 },
        );

        const logContent = await page.evaluate(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const entries = state?.sys?.actionLog?.entries ?? [];
            const damageEntry = entries.find((entry: any) => entry.kind === 'DAMAGE_DEALT');

            if (!damageEntry) {
                return null;
            }

            const breakdownSeg = damageEntry.segments.find((segment: any) => segment.type === 'breakdown');
            if (!breakdownSeg || breakdownSeg.type !== 'breakdown') {
                return null;
            }

            return {
                displayText: breakdownSeg.displayText,
                lines: breakdownSeg.lines.map((line: any) => ({
                    label: line.label,
                    value: line.value,
                    color: line.color,
                })),
            };
        });

        expect(logContent).not.toBeNull();

        const shieldLines = logContent!.lines.filter((line: any) => line.value < 0);
        expect(shieldLines).toHaveLength(2);

        const shieldValues = shieldLines
            .map((line: any) => line.value)
            .sort((a: number, b: number) => a - b);
        expect(shieldValues).toEqual([-6, -3]);
        expect(logContent!.displayText).toBe('1');
    });

    test('响应窗口内追加下次一定必须并入同一笔待处理伤害事务', async ({ page, game }) => {
        await game.openTestGame('dicethrone');

        await game.setupScene({
            gameId: 'dicethrone',
            player0: {
                hand: ['card-next-time'],
                resources: { CP: 2, HP: 50 },
            },
            player1: {
                resources: { HP: 50 },
            },
            currentPlayer: '1',
            phase: 'main1',
            extra: {
                selectedCharacters: { '0': 'paladin', '1': 'monk' },
                hostStarted: true,
            },
        });

        // 代表态：神圣防御已经在窗口打开前提交了 3 点；本用例只验证真实卡牌响应入口
        // 是否把新增护盾并入同一笔 pendingDamage，并在收口后消费两层护盾。
        await page.evaluate(() => {
            const holder = window as any;
            const harness = holder.__BG_TEST_HARNESS__;
            const state = harness?.state?.get?.();
            if (!harness || !state) throw new Error('TestHarness not available');

            const nextState = structuredClone(state);
            nextState.core.activePlayerId = '1';
            nextState.core.pendingDamage = {
                id: 'holy-defense-plus-next-time-e2e',
                sourcePlayerId: '1',
                targetPlayerId: '0',
                originalDamage: 10,
                currentDamage: 7,
                sourceAbilityId: 'paladin-test-attack',
                responseType: 'beforeDamageReceived',
                responderId: '0',
                damageScope: 'attack',
                preventionCommitted: true,
                isFullyEvaded: false,
                shieldsConsumed: [{
                    sourceId: 'holy-defense',
                    shieldIndex: 0,
                    value: 3,
                    absorbed: 3,
                    pendingDamageId: 'holy-defense-plus-next-time-e2e',
                }],
                modifiers: [{ type: 'shield', value: -3, sourceId: 'holy-defense' }],
            };
            nextState.core.players['0'].damageShields = [
                { sourceId: 'holy-defense', value: 3, preventStatus: false },
            ];
            nextState.sys.phase = 'main1';
            nextState.sys.responseWindow = {
                current: {
                    id: 'holy-defense-plus-next-time-e2e-window',
                    windowType: 'beforeDamageReceived',
                    responderQueue: ['0'],
                    currentResponderIndex: 0,
                    passedPlayers: [],
                },
            };
            nextState.sys.interaction = { current: null, queue: [], isBlocked: false };
            harness.state.set(nextState);
            holder.__BG_LAST_COMMAND_REJECTED__ = null;
        });

        await expect(page.getByTestId('dicethrone-response-window-hint')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('[data-testid="hand-area"] [data-card-id="card-next-time"]')).toBeVisible({ timeout: 10000 });

        await dragDiceThroneHandCardToPlay(page, 'card-next-time');

        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const pending = state?.core?.pendingDamage;
            const shields = state?.core?.players?.['0']?.damageShields ?? [];
            return pending?.currentDamage === 1
                && pending?.preventionCommitted === true
                && pending?.shieldsConsumed?.some((entry: any) => entry.sourceId === 'card-next-time')
                && shields.some((shield: any) => shield.sourceId === 'card-next-time');
        }, undefined, { timeout: 10000, polling: 200 });

        const passed = await maybePassResponse(page, 5000);
        expect(passed).toBe(true);

        await page.waitForFunction(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return state?.core?.pendingDamage == null
                && state?.core?.players?.['0']?.resources?.hp === 49
                && (state?.core?.players?.['0']?.damageShields ?? []).length === 0;
        }, undefined, { timeout: 10000, polling: 200 });

        const finalState = await page.evaluate(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            const entries = state?.sys?.eventStream?.entries ?? [];
            return {
                hp: state?.core?.players?.['0']?.resources?.hp,
                shields: state?.core?.players?.['0']?.damageShields ?? [],
                eventTypes: entries.slice(-8).map((entry: any) => entry.event?.type),
                rejection: (window as any).__BG_LAST_COMMAND_REJECTED__ ?? null,
            };
        });

        expect(finalState.rejection).toBeNull();
        expect(finalState.hp).toBe(49);
        expect(finalState.shields).toEqual([]);
        expect(finalState.eventTypes).toContain('DAMAGE_DEALT');
    });
});
