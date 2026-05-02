/**
 * 大杀四方 - 多基地计分完整流程 E2E 测试
 *
 * 对齐当前 resolution frame 栈化后的真实语义：
 * - 多基地计分仍先给出排序交互
 * - 第二次选择后，最后一个锁定基地会自动收口，不再重复弹旧式选择框
 */

import { test, expect } from '../framework';

async function openScene(game: any): Promise<void> {
    await game.openTestGame('smashup');
    await game.setupScene({
        gameId: 'smashup',
        player0: { hand: [], deck: [], discard: [], vp: 0, factions: ['dinosaurs', 'zombies'] },
        player1: { hand: [], deck: [], discard: [], vp: 0, factions: ['ghosts', 'wizards'] },
        currentPlayer: '0',
        phase: 'playCards',
        bases: [
            {
                defId: 'base_the_jungle',
                minions: [
                    { uid: 'b0-p0', defId: 'test_minion', owner: '0', controller: '0', baseIndex: 0, basePower: 7 },
                    { uid: 'b0-p1', defId: 'test_minion', owner: '1', controller: '1', baseIndex: 0, basePower: 6 },
                ],
            },
            {
                defId: 'base_dread_lookout',
                minions: [
                    { uid: 'b1-p1', defId: 'test_minion', owner: '1', controller: '1', baseIndex: 1, basePower: 11 },
                    { uid: 'b1-p0', defId: 'test_minion', owner: '0', controller: '0', baseIndex: 1, basePower: 10 },
                ],
            },
            {
                defId: 'base_tsars_palace',
                minions: [
                    { uid: 'b2-p0', defId: 'test_minion', owner: '0', controller: '0', baseIndex: 2, basePower: 12 },
                    { uid: 'b2-p1', defId: 'test_minion', owner: '1', controller: '1', baseIndex: 2, basePower: 11 },
                ],
            },
        ],
        extra: {
            core: {
                baseDeck: [
                    'base_central_brain',
                    'base_cave_of_shinies',
                    'base_rhodes_plaza',
                    'base_the_factory',
                ],
                nextUid: 2000,
            },
        },
    });
}

test.describe('多基地计分完整流程', () => {
    test('第二次排序选择后，最后一个基地应自动结算且只结算一次', async ({ game }, testInfo) => {
        await openScene(game);
        await game.screenshot('multi-base-auto-finish-initial', testInfo);

        await game.advancePhase();
        await game.waitForInteraction('multi_base_scoring', 15000);
        await game.screenshot('multi-base-auto-finish-first-choice', testInfo);

        await game.selectInteractionOptionBy(
            (option: { value?: Record<string, unknown> }) => option.value?.baseDefId === 'base_tsars_palace',
            '第一次选择沙皇宫殿',
        );

        await game.waitForInteraction('multi_base_scoring', 15000);
        await game.screenshot('multi-base-auto-finish-second-choice', testInfo);

        await game.selectInteractionOptionBy(
            (option: { value?: Record<string, unknown> }) => option.value?.baseDefId === 'base_the_jungle',
            '第二次选择绿洲丛林',
        );

        await game.waitForNoInteraction(15000);
        await game.screenshot('multi-base-auto-finish-final', testInfo);

        const finalState = await game.getState();
        expect(finalState.sys.interaction?.current).toBeFalsy();
        expect(finalState.sys.phase).toBe('playCards');
        expect(finalState.core.players['0'].vp).toBe(9);
        expect(finalState.core.players['1'].vp).toBe(7);
        expect(finalState.core.bases.map((base: { defId: string }) => base.defId)).toEqual([
            'base_cave_of_shinies',
            'base_rhodes_plaza',
            'base_central_brain',
        ]);
        expect(finalState.core.baseDeck).toEqual(['base_the_factory']);
    });
});
