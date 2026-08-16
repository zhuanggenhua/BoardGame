/**
 * DiceThrone 护盾日志显示 E2E 测试
 *
 * 验证护盾减伤在 ActionLog 中的实际显示效果。
 */

import { test, expect } from '../framework';

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
});
