/**
 * 大杀四方四人局布局测试 - 使用 TestHarness
 * 快速注入状态并截图
 */

import { test } from './fixtures';

test.describe('大杀四方四人局布局', () => {
    test('四人局布局截图', async ({ page }) => {
        // 1. 访问测试环境
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        // 2. 点击 Smash Up
        await page.click('text=Smash Up');
        await page.waitForTimeout(1000);
        
        // 3. 点击 Create Room
        await page.click('button:has-text("Create Room")');
        await page.waitForTimeout(1000);
        
        // 4. 选择 4 人局（点击 "4 players" 按钮）
        await page.click('button:has-text("4 players")');
        await page.waitForTimeout(500);
        
        // 5. 确认创建
        await page.click('button:has-text("Confirm")');
        await page.waitForTimeout(3000);

        // 6. 使用 TestHarness 注入状态
        const fourPlayerState = {
            players: {
                '0': {
                    id: '0',
                    vp: 8,
                    hand: [
                        { uid: 'h0-1', defId: 'alien_invader', type: 'minion', owner: '0' },
                        { uid: 'h0-2', defId: 'alien_scout', type: 'minion', owner: '0' },
                        { uid: 'h0-3', defId: 'pirate_first_mate', type: 'minion', owner: '0' },
                        { uid: 'h0-4', defId: 'pirate_full_sail', type: 'action', owner: '0' },
                    ],
                    deck: Array.from({ length: 30 }, (_, i) => ({ uid: `d0-${i}`, defId: 'test_card', type: 'minion', owner: '0' })),
                    discard: [],
                    minionsPlayed: 1,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['aliens', 'pirates'],
                },
                '1': {
                    id: '1',
                    vp: 6,
                    hand: [
                        { uid: 'h1-1', defId: 'ninja_shinobi', type: 'minion', owner: '1' },
                        { uid: 'h1-2', defId: 'ninja_infiltrate', type: 'action', owner: '1' },
                        { uid: 'h1-3', defId: 'dino_king_rex', type: 'minion', owner: '1' },
                    ],
                    deck: Array.from({ length: 30 }, (_, i) => ({ uid: `d1-${i}`, defId: 'test_card', type: 'minion', owner: '1' })),
                    discard: [],
                    minionsPlayed: 1,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['ninjas', 'dinosaurs'],
                },
                '2': {
                    id: '2',
                    vp: 5,
                    hand: [
                        { uid: 'h2-1', defId: 'wizard_chronomage', type: 'minion', owner: '2' },
                        { uid: 'h2-2', defId: 'wizard_arcane_burst', type: 'action', owner: '2' },
                    ],
                    deck: Array.from({ length: 30 }, (_, i) => ({ uid: `d2-${i}`, defId: 'test_card', type: 'minion', owner: '2' })),
                    discard: [],
                    minionsPlayed: 1,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['wizards', 'zombies'],
                },
                '3': {
                    id: '3',
                    vp: 4,
                    hand: [
                        { uid: 'h3-1', defId: 'robot_microbot_alpha', type: 'minion', owner: '3' },
                        { uid: 'h3-2', defId: 'robot_zapbot', type: 'minion', owner: '3' },
                    ],
                    deck: Array.from({ length: 30 }, (_, i) => ({ uid: `d3-${i}`, defId: 'test_card', type: 'minion', owner: '3' })),
                    discard: [],
                    minionsPlayed: 1,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['robots', 'tricksters'],
                },
            },
            turnOrder: ['0', '1', '2', '3'],
            currentPlayerIndex: 0,
            bases: [
                {
                    defId: 'base_the_homeworld',
                    minions: [
                        { uid: 'm1', defId: 'alien_invader', controller: '0', owner: '0', basePower: 4, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'm2', defId: 'pirate_first_mate', controller: '0', owner: '0', basePower: 3, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'm3', defId: 'ninja_shinobi', controller: '1', owner: '1', basePower: 2, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [
                        { uid: 'og1', defId: 'pirate_full_sail', ownerId: '0' },
                    ],
                },
                {
                    defId: 'base_the_jungle_oasis',
                    minions: [
                        { uid: 'm4', defId: 'dino_king_rex', controller: '1', owner: '1', basePower: 5, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'm5', defId: 'wizard_chronomage', controller: '2', owner: '2', basePower: 3, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_the_tar_pits',
                    minions: [
                        { uid: 'm6', defId: 'zombie_walker', controller: '2', owner: '2', basePower: 2, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'm7', defId: 'robot_microbot_alpha', controller: '3', owner: '3', basePower: 2, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_the_maze_of_the_minotaur',
                    minions: [
                        { uid: 'm8', defId: 'trickster_leprechaun', controller: '3', owner: '3', basePower: 3, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_the_temple_of_goju',
                    minions: [],
                    ongoingActions: [],
                },
            ],
            baseDeck: ['base_haunted_house', 'base_central_brain'],
            turnNumber: 3,
            nextUid: 100,
        };

        // 使用 TestHarness 注入状态
        await page.evaluate((state) => {
            if (window.__BG_TEST_HARNESS__) {
                window.__BG_TEST_HARNESS__.applyCoreState(state);
            }
        }, fourPlayerState);
        
        await page.waitForTimeout(2000);

        // 7. 截图
        await page.screenshot({
            path: 'test-results/smashup-4p-layout-harness.png',
            fullPage: true,
        });

        console.log('✅ 四人局布局截图已保存到 test-results/smashup-4p-layout-harness.png');
    });
});
