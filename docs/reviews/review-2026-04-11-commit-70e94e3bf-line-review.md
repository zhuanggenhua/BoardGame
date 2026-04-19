# 逐行审查：70e94e3bfedc7c7925f392ab180f35e0ad59c991

- 说明：本文件按 git diff 逐行输出（仅新增/删除行），每行给出审查结论。
- 结论标签：OK=低风险/文档测试；注意=需要核对逻辑/交互；风险=可能引起回归（人工标注）。
- 回归判定：4 人 targetingRoll 引入后未同步允许 ROLL_DICE/CONFIRM_ROLL/TOGGLE_DIE_LOCK 在 targetingRoll 中执行，导致流程用例 invalid_phase。

DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:1 | 注意 删除/收口测试，覆盖减少需确认 | /**
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:2 | 注意 删除/收口测试，覆盖减少需确认 |  * 圣骑士复仇 II 技能 - 选择玩家授予反击 Token E2E 测试
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:3 | 注意 删除/收口测试，覆盖减少需确认 |  *
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:4 | 注意 删除/收口测试，覆盖减少需确认 |  * 测试场景：
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:5 | 注意 删除/收口测试，覆盖减少需确认 |  * 1. 触发复仇 II 技能（3盔+1祈祷）
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:6 | 注意 删除/收口测试，覆盖减少需确认 |  * 2. 出现选择玩家界面
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:7 | 注意 删除/收口测试，覆盖减少需确认 |  * 3. 选择自己或对手
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:8 | 注意 删除/收口测试，覆盖减少需确认 |  * 4. 确认选择
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:9 | 注意 删除/收口测试，覆盖减少需确认 |  * 5. 验证目标玩家获得反击 token
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:10 | 注意 删除/收口测试，覆盖减少需确认 |  */
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:11 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:12 | 注意 删除/收口测试，覆盖减少需确认 | import { test, expect } from '@playwright/test';
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:13 | 注意 删除/收口测试，覆盖减少需确认 | import { TOKEN_IDS } from '../src/games/dicethrone/domain/ids';
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:14 | 注意 删除/收口测试，覆盖减少需确认 | import { RESOURCE_IDS } from '../src/games/dicethrone/domain/resources';
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:15 | 注意 删除/收口测试，覆盖减少需确认 | import {
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:16 | 注意 删除/收口测试，覆盖减少需确认 |     setupDTOnlineMatch,
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:17 | 注意 删除/收口测试，覆盖减少需确认 |     selectCharacter,
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:18 | 注意 删除/收口测试，覆盖减少需确认 |     waitForGameBoard,
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:19 | 注意 删除/收口测试，覆盖减少需确认 |     readCoreState,
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:20 | 注意 删除/收口测试，覆盖减少需确认 |     applyDiceValues,
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:21 | 注意 删除/收口测试，覆盖减少需确认 |     closeDebugPanelIfOpen,
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:22 | 注意 删除/收口测试，覆盖减少需确认 | } from './helpers/dicethrone';
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:23 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:24 | 注意 删除/收口测试，覆盖减少需确认 | /** 读取指定玩家 tokens */
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:25 | 注意 删除/收口测试，覆盖减少需确认 | const getPlayerTokens = (core: Record<string, unknown>, playerId: string) => {
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:26 | 注意 删除/收口测试，覆盖减少需确认 |     const players = core.players as Record<string, Record<string, unknown>>;
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:27 | 注意 删除/收口测试，覆盖减少需确认 |     return (players[playerId]?.tokens as Record<string, number>) ?? {};
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:28 | 注意 删除/收口测试，覆盖减少需确认 | };
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:29 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:30 | 注意 删除/收口测试，覆盖减少需确认 | /** 读取指定玩家 CP */
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:31 | 注意 删除/收口测试，覆盖减少需确认 | const getPlayerCp = (core: Record<string, unknown>, playerId: string) => {
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:32 | 注意 删除/收口测试，覆盖减少需确认 |     const players = core.players as Record<string, Record<string, unknown>>;
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:33 | 注意 删除/收口测试，覆盖减少需确认 |     const resources = players[playerId]?.resources as Record<string, number> | undefined;
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:34 | 注意 删除/收口测试，覆盖减少需确认 |     return resources?.[RESOURCE_IDS.CP] ?? 0;
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:35 | 注意 删除/收口测试，覆盖减少需确认 | };
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:36 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:37 | 注意 删除/收口测试，覆盖减少需确认 | const INITIAL_CP = 1; // 初始 CP 值
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:38 | 注意 删除/收口测试，覆盖减少需确认 | const getPlayerCp = (core: Record<string, unknown>, playerId: string) => {
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:39 | 注意 删除/收口测试，覆盖减少需确认 |     const players = core.players as Record<string, Record<string, unknown>>;
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:40 | 注意 删除/收口测试，覆盖减少需确认 |     const resources = players[playerId]?.resources as Record<string, number> | undefined;
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:41 | 注意 删除/收口测试，覆盖减少需确认 |     return resources?.[RESOURCE_IDS.CP] ?? 0;
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:42 | 注意 删除/收口测试，覆盖减少需确认 | };
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:43 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:44 | 注意 删除/收口测试，覆盖减少需确认 | test.describe('圣骑士复仇 II - 选择玩家授予反击', () => {
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:45 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:46 | 注意 删除/收口测试，覆盖减少需确认 |     test('选择自己授予反击 token', async ({ browser }, testInfo) => {
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:47 | 注意 删除/收口测试，覆盖减少需确认 |         test.setTimeout(120000);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:48 | 注意 删除/收口测试，覆盖减少需确认 |         const baseURL = testInfo.project.use.baseURL as string | undefined;
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:49 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:50 | 注意 删除/收口测试，覆盖减少需确认 |         const setup = await setupDTOnlineMatch(browser, baseURL);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:51 | 注意 删除/收口测试，覆盖减少需确认 |         if (!setup) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:52 | 注意 删除/收口测试，覆盖减少需确认 |         const { hostPage, guestPage, hostContext, guestContext } = setup;
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:53 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:54 | 注意 删除/收口测试，覆盖减少需确认 |         try {
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:55 | 注意 删除/收口测试，覆盖减少需确认 |             // 选择英雄：圣骑士 vs 野蛮人
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:56 | 注意 删除/收口测试，覆盖减少需确认 |             await selectCharacter(hostPage, 'paladin');
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:57 | 注意 删除/收口测试，覆盖减少需确认 |             await selectCharacter(guestPage, 'barbarian');
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:58 | 注意 删除/收口测试，覆盖减少需确认 |             
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:59 | 注意 删除/收口测试，覆盖减少需确认 |             // 等待游戏开始
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:60 | 注意 删除/收口测试，覆盖减少需确认 |             await waitForGameBoard(hostPage);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:61 | 注意 删除/收口测试，覆盖减少需确认 |             await waitForGameBoard(guestPage);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:62 | 注意 删除/收口测试，覆盖减少需确认 |             
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:63 | 注意 删除/收口测试，覆盖减少需确认 |             await hostPage.waitForTimeout(1000);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:64 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:65 | 注意 删除/收口测试，覆盖减少需确认 |             // 圣骑士是玩家 0（host）
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:66 | 注意 删除/收口测试，覆盖减少需确认 |             const page = hostPage;
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:67 | 注意 删除/收口测试，覆盖减少需确认 |             const paladinId = '0';
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:68 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:69 | 注意 删除/收口测试，覆盖减少需确认 |             // 推进到攻击掷骰阶段
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:70 | 注意 删除/收口测试，覆盖减少需确认 |             const nextPhaseBtn = page.locator('[data-tutorial-id="advance-phase-button"]');
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:71 | 注意 删除/收口测试，覆盖减少需确认 |             await nextPhaseBtn.click();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:72 | 注意 删除/收口测试，覆盖减少需确认 |             await page.waitForTimeout(500);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:73 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:74 | 注意 删除/收口测试，覆盖减少需确认 |             // 注入骰面：3盔+1祈祷（触发复仇 II 主技能）
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:75 | 注意 删除/收口测试，覆盖减少需确认 |             await applyDiceValues(page, [3, 3, 3, 6, 1, 1]); // 3个盔(3) + 1个祈祷(6) + 2个剑(1)
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:76 | 注意 删除/收口测试，覆盖减少需确认 |             await page.waitForTimeout(500);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:77 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:78 | 注意 删除/收口测试，覆盖减少需确认 |             // 确认骰面
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:79 | 注意 删除/收口测试，覆盖减少需确认 |             const confirmBtn = page.locator('button:has-text("确认")').first();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:80 | 注意 删除/收口测试，覆盖减少需确认 |             await confirmBtn.click();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:81 | 注意 删除/收口测试，覆盖减少需确认 |             await page.waitForTimeout(1000);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:82 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:83 | 注意 删除/收口测试，覆盖减少需确认 |             // 选择技能（复仇 II）
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:84 | 注意 删除/收口测试，覆盖减少需确认 |             const abilityBtn = page.locator('[data-ability-id="vengeance"]').first();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:85 | 注意 删除/收口测试，覆盖减少需确认 |             await abilityBtn.click();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:86 | 注意 删除/收口测试，覆盖减少需确认 |             await page.waitForTimeout(1000);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:87 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:88 | 注意 删除/收口测试，覆盖减少需确认 |             // 应该出现选择玩家界面
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:89 | 注意 删除/收口测试，覆盖减少需确认 |             const modalTitle = page.locator('text=选择一名玩家');
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:90 | 注意 删除/收口测试，覆盖减少需确认 |             await expect(modalTitle).toBeVisible({ timeout: 5000 });
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:91 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:92 | 注意 删除/收口测试，覆盖减少需确认 |             // 截图：选择玩家界面
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:93 | 注意 删除/收口测试，覆盖减少需确认 |             await page.screenshot({ path: testInfo.outputPath('vengeance-select-player-modal.png'), fullPage: false });
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:94 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:95 | 注意 删除/收口测试，覆盖减少需确认 |             // 选择自己（圣骑士）
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:96 | 注意 删除/收口测试，覆盖减少需确认 |             const selfOption = page.locator('text=自己').first();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:97 | 注意 删除/收口测试，覆盖减少需确认 |             await expect(selfOption).toBeVisible();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:98 | 注意 删除/收口测试，覆盖减少需确认 |             
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:99 | 注意 删除/收口测试，覆盖减少需确认 |             // 验证可以点击（不是 disabled 状态）
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:100 | 注意 删除/收口测试，覆盖减少需确认 |             const selfContainer = selfOption.locator('xpath=ancestor::div[contains(@class, "cursor-pointer")]').first();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:101 | 注意 删除/收口测试，覆盖减少需确认 |             await expect(selfContainer).toBeVisible();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:102 | 注意 删除/收口测试，覆盖减少需确认 |             
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:103 | 注意 删除/收口测试，覆盖减少需确认 |             await selfOption.click();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:104 | 注意 删除/收口测试，覆盖减少需确认 |             await page.waitForTimeout(500);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:105 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:106 | 注意 删除/收口测试，覆盖减少需确认 |             // 截图：选择后状态
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:107 | 注意 删除/收口测试，覆盖减少需确认 |             await page.screenshot({ path: testInfo.outputPath('vengeance-player-selected.png'), fullPage: false });
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:108 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:109 | 注意 删除/收口测试，覆盖减少需确认 |             // 确认选择
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:110 | 注意 删除/收口测试，覆盖减少需确认 |             const confirmSelectBtn = page.locator('button:has-text("确认")').last();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:111 | 注意 删除/收口测试，覆盖减少需确认 |             await confirmSelectBtn.click();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:112 | 注意 删除/收口测试，覆盖减少需确认 |             await page.waitForTimeout(1000);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:113 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:114 | 注意 删除/收口测试，覆盖减少需确认 |             // 验证圣骑士获得了反击 token
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:115 | 注意 删除/收口测试，覆盖减少需确认 |             let core = await readCoreState(page) as Record<string, unknown>;
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:116 | 注意 删除/收口测试，覆盖减少需确认 |             let tokens = getPlayerTokens(core, paladinId);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:117 | 注意 删除/收口测试，覆盖减少需确认 |             expect(tokens[TOKEN_IDS.RETRIBUTION], '圣骑士应获得 1 层反击').toBe(1);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:118 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:119 | 注意 删除/收口测试，覆盖减少需确认 |             // 推进阶段到 main2（触发 postDamage 效果）
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:120 | 注意 删除/收口测试，覆盖减少需确认 |             const nextPhaseBtn2 = page.locator('[data-tutorial-id="advance-phase-button"]');
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:121 | 注意 删除/收口测试，覆盖减少需确认 |             await nextPhaseBtn2.click();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:122 | 注意 删除/收口测试，覆盖减少需确认 |             await page.waitForTimeout(1000);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:123 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:124 | 注意 删除/收口测试，覆盖减少需确认 |             // 验证获得了 4 CP（复仇 II 的第二个效果，在 postDamage 时机执行）
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:125 | 注意 删除/收口测试，覆盖减少需确认 |             core = await readCoreState(page) as Record<string, unknown>;
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:126 | 注意 删除/收口测试，覆盖减少需确认 |             const cp = getPlayerCp(core, paladinId);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:127 | 注意 删除/收口测试，覆盖减少需确认 |             expect(cp, '圣骑士应在攻击结算后获得 4 CP').toBe(INITIAL_CP + 4);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:128 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:129 | 注意 删除/收口测试，覆盖减少需确认 |             await closeDebugPanelIfOpen(page);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:130 | 注意 删除/收口测试，覆盖减少需确认 |             await page.screenshot({ path: testInfo.outputPath('vengeance-self-complete.png'), fullPage: false });
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:131 | 注意 删除/收口测试，覆盖减少需确认 |         } finally {
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:132 | 注意 删除/收口测试，覆盖减少需确认 |             await hostContext.close();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:133 | 注意 删除/收口测试，覆盖减少需确认 |             await guestContext.close();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:134 | 注意 删除/收口测试，覆盖减少需确认 |         }
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:135 | 注意 删除/收口测试，覆盖减少需确认 |     });
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:136 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:137 | 注意 删除/收口测试，覆盖减少需确认 |     test('选择对手授予反击 token', async ({ browser }, testInfo) => {
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:138 | 注意 删除/收口测试，覆盖减少需确认 |         test.setTimeout(120000);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:139 | 注意 删除/收口测试，覆盖减少需确认 |         const baseURL = testInfo.project.use.baseURL as string | undefined;
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:140 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:141 | 注意 删除/收口测试，覆盖减少需确认 |         const setup = await setupDTOnlineMatch(browser, baseURL);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:142 | 注意 删除/收口测试，覆盖减少需确认 |         if (!setup) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:143 | 注意 删除/收口测试，覆盖减少需确认 |         const { hostPage, guestPage, hostContext, guestContext } = setup;
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:144 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:145 | 注意 删除/收口测试，覆盖减少需确认 |         try {
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:146 | 注意 删除/收口测试，覆盖减少需确认 |             // 选择英雄：圣骑士 vs 野蛮人
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:147 | 注意 删除/收口测试，覆盖减少需确认 |             await selectCharacter(hostPage, 'paladin');
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:148 | 注意 删除/收口测试，覆盖减少需确认 |             await selectCharacter(guestPage, 'barbarian');
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:149 | 注意 删除/收口测试，覆盖减少需确认 |             
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:150 | 注意 删除/收口测试，覆盖减少需确认 |             // 等待游戏开始
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:151 | 注意 删除/收口测试，覆盖减少需确认 |             await waitForGameBoard(hostPage);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:152 | 注意 删除/收口测试，覆盖减少需确认 |             await waitForGameBoard(guestPage);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:153 | 注意 删除/收口测试，覆盖减少需确认 |             
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:154 | 注意 删除/收口测试，覆盖减少需确认 |             await hostPage.waitForTimeout(1000);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:155 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:156 | 注意 删除/收口测试，覆盖减少需确认 |             // 圣骑士是玩家 0（host），对手是玩家 1
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:157 | 注意 删除/收口测试，覆盖减少需确认 |             const page = hostPage;
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:158 | 注意 删除/收口测试，覆盖减少需确认 |             const paladinId = '0';
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:159 | 注意 删除/收口测试，覆盖减少需确认 |             const opponentId = '1';
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:160 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:161 | 注意 删除/收口测试，覆盖减少需确认 |             // 推进到攻击掷骰阶段
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:162 | 注意 删除/收口测试，覆盖减少需确认 |             const nextPhaseBtn = page.locator('[data-tutorial-id="advance-phase-button"]');
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:163 | 注意 删除/收口测试，覆盖减少需确认 |             await nextPhaseBtn.click();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:164 | 注意 删除/收口测试，覆盖减少需确认 |             await page.waitForTimeout(500);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:165 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:166 | 注意 删除/收口测试，覆盖减少需确认 |             // 注入骰面：3盔+1祈祷
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:167 | 注意 删除/收口测试，覆盖减少需确认 |             await applyDiceValues(page, [3, 3, 3, 6, 1, 1]);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:168 | 注意 删除/收口测试，覆盖减少需确认 |             await page.waitForTimeout(500);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:169 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:170 | 注意 删除/收口测试，覆盖减少需确认 |             // 确认骰面
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:171 | 注意 删除/收口测试，覆盖减少需确认 |             const confirmBtn = page.locator('button:has-text("确认")').first();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:172 | 注意 删除/收口测试，覆盖减少需确认 |             await confirmBtn.click();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:173 | 注意 删除/收口测试，覆盖减少需确认 |             await page.waitForTimeout(1000);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:174 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:175 | 注意 删除/收口测试，覆盖减少需确认 |             // 选择技能
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:176 | 注意 删除/收口测试，覆盖减少需确认 |             const abilityBtn = page.locator('[data-ability-id="vengeance"]').first();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:177 | 注意 删除/收口测试，覆盖减少需确认 |             await abilityBtn.click();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:178 | 注意 删除/收口测试，覆盖减少需确认 |             await page.waitForTimeout(1000);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:179 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:180 | 注意 删除/收口测试，覆盖减少需确认 |             // 选择对手
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:181 | 注意 删除/收口测试，覆盖减少需确认 |             const opponentOption = page.locator('text=对手').first();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:182 | 注意 删除/收口测试，覆盖减少需确认 |             await expect(opponentOption).toBeVisible({ timeout: 5000 });
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:183 | 注意 删除/收口测试，覆盖减少需确认 |             
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:184 | 注意 删除/收口测试，覆盖减少需确认 |             // 验证可以点击
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:185 | 注意 删除/收口测试，覆盖减少需确认 |             const opponentContainer = opponentOption.locator('xpath=ancestor::div[contains(@class, "cursor-pointer")]').first();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:186 | 注意 删除/收口测试，覆盖减少需确认 |             await expect(opponentContainer).toBeVisible();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:187 | 注意 删除/收口测试，覆盖减少需确认 |             
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:188 | 注意 删除/收口测试，覆盖减少需确认 |             await opponentOption.click();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:189 | 注意 删除/收口测试，覆盖减少需确认 |             await page.waitForTimeout(500);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:190 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:191 | 注意 删除/收口测试，覆盖减少需确认 |             // 确认选择
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:192 | 注意 删除/收口测试，覆盖减少需确认 |             const confirmSelectBtn = page.locator('button:has-text("确认")').last();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:193 | 注意 删除/收口测试，覆盖减少需确认 |             await confirmSelectBtn.click();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:194 | 注意 删除/收口测试，覆盖减少需确认 |             await page.waitForTimeout(1000);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:195 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:196 | 注意 删除/收口测试，覆盖减少需确认 |             // 验证对手获得了反击 token
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:197 | 注意 删除/收口测试，覆盖减少需确认 |             let core = await readCoreState(page) as Record<string, unknown>;
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:198 | 注意 删除/收口测试，覆盖减少需确认 |             const opponentTokens = getPlayerTokens(core, opponentId);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:199 | 注意 删除/收口测试，覆盖减少需确认 |             expect(opponentTokens[TOKEN_IDS.RETRIBUTION], '对手应获得 1 层反击').toBe(1);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:200 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:201 | 注意 删除/收口测试，覆盖减少需确认 |             // 验证圣骑士没有获得反击
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:202 | 注意 删除/收口测试，覆盖减少需确认 |             const paladinTokens = getPlayerTokens(core, paladinId);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:203 | 注意 删除/收口测试，覆盖减少需确认 |             expect(paladinTokens[TOKEN_IDS.RETRIBUTION] ?? 0, '圣骑士不应获得反击').toBe(0);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:204 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:205 | 注意 删除/收口测试，覆盖减少需确认 |             // 推进阶段到 main2（触发 postDamage 效果）
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:206 | 注意 删除/收口测试，覆盖减少需确认 |             const nextPhaseBtn2 = page.locator('[data-tutorial-id="advance-phase-button"]');
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:207 | 注意 删除/收口测试，覆盖减少需确认 |             await nextPhaseBtn2.click();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:208 | 注意 删除/收口测试，覆盖减少需确认 |             await page.waitForTimeout(1000);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:209 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:210 | 注意 删除/收口测试，覆盖减少需确认 |             // 验证圣骑士获得了 4 CP（在 postDamage 时机执行）
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:211 | 注意 删除/收口测试，覆盖减少需确认 |             core = await readCoreState(page) as Record<string, unknown>;
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:212 | 注意 删除/收口测试，覆盖减少需确认 |             const cp = getPlayerCp(core, paladinId);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:213 | 注意 删除/收口测试，覆盖减少需确认 |             expect(cp, '圣骑士应在攻击结算后获得 4 CP').toBe(INITIAL_CP + 4);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:214 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:215 | 注意 删除/收口测试，覆盖减少需确认 |             await closeDebugPanelIfOpen(page);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:216 | 注意 删除/收口测试，覆盖减少需确认 |             await page.screenshot({ path: testInfo.outputPath('vengeance-opponent-complete.png'), fullPage: false });
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:217 | 注意 删除/收口测试，覆盖减少需确认 |         } finally {
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:218 | 注意 删除/收口测试，覆盖减少需确认 |             await hostContext.close();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:219 | 注意 删除/收口测试，覆盖减少需确认 |             await guestContext.close();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:220 | 注意 删除/收口测试，覆盖减少需确认 |         }
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:221 | 注意 删除/收口测试，覆盖减少需确认 |     });
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:222 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:223 | 注意 删除/收口测试，覆盖减少需确认 |     test('取消选择应关闭界面', async ({ browser }, testInfo) => {
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:224 | 注意 删除/收口测试，覆盖减少需确认 |         test.setTimeout(120000);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:225 | 注意 删除/收口测试，覆盖减少需确认 |         const baseURL = testInfo.project.use.baseURL as string | undefined;
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:226 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:227 | 注意 删除/收口测试，覆盖减少需确认 |         const setup = await setupDTOnlineMatch(browser, baseURL);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:228 | 注意 删除/收口测试，覆盖减少需确认 |         if (!setup) { test.skip(true, '游戏服务器不可用或房间创建失败'); return; }
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:229 | 注意 删除/收口测试，覆盖减少需确认 |         const { hostPage, guestPage, hostContext, guestContext } = setup;
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:230 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:231 | 注意 删除/收口测试，覆盖减少需确认 |         try {
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:232 | 注意 删除/收口测试，覆盖减少需确认 |             // 选择英雄：圣骑士 vs 野蛮人
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:233 | 注意 删除/收口测试，覆盖减少需确认 |             await selectCharacter(hostPage, 'paladin');
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:234 | 注意 删除/收口测试，覆盖减少需确认 |             await selectCharacter(guestPage, 'barbarian');
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:235 | 注意 删除/收口测试，覆盖减少需确认 |             
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:236 | 注意 删除/收口测试，覆盖减少需确认 |             // 等待游戏开始
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:237 | 注意 删除/收口测试，覆盖减少需确认 |             await waitForGameBoard(hostPage);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:238 | 注意 删除/收口测试，覆盖减少需确认 |             await waitForGameBoard(guestPage);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:239 | 注意 删除/收口测试，覆盖减少需确认 |             
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:240 | 注意 删除/收口测试，覆盖减少需确认 |             await hostPage.waitForTimeout(1000);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:241 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:242 | 注意 删除/收口测试，覆盖减少需确认 |             // 圣骑士是玩家 0（host）
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:243 | 注意 删除/收口测试，覆盖减少需确认 |             const page = hostPage;
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:244 | 注意 删除/收口测试，覆盖减少需确认 |             const paladinId = '0';
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:245 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:246 | 注意 删除/收口测试，覆盖减少需确认 |             // 推进到攻击掷骰阶段
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:247 | 注意 删除/收口测试，覆盖减少需确认 |             const nextPhaseBtn = page.locator('[data-tutorial-id="advance-phase-button"]');
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:248 | 注意 删除/收口测试，覆盖减少需确认 |             await nextPhaseBtn.click();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:249 | 注意 删除/收口测试，覆盖减少需确认 |             await page.waitForTimeout(500);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:250 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:251 | 注意 删除/收口测试，覆盖减少需确认 |             // 注入骰面
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:252 | 注意 删除/收口测试，覆盖减少需确认 |             await applyDiceValues(page, [3, 3, 3, 6, 1, 1]);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:253 | 注意 删除/收口测试，覆盖减少需确认 |             await page.waitForTimeout(500);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:254 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:255 | 注意 删除/收口测试，覆盖减少需确认 |             // 确认骰面
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:256 | 注意 删除/收口测试，覆盖减少需确认 |             const confirmBtn = page.locator('button:has-text("确认")').first();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:257 | 注意 删除/收口测试，覆盖减少需确认 |             await confirmBtn.click();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:258 | 注意 删除/收口测试，覆盖减少需确认 |             await page.waitForTimeout(1000);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:259 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:260 | 注意 删除/收口测试，覆盖减少需确认 |             // 选择技能
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:261 | 注意 删除/收口测试，覆盖减少需确认 |             const abilityBtn = page.locator('[data-ability-id="vengeance"]').first();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:262 | 注意 删除/收口测试，覆盖减少需确认 |             await abilityBtn.click();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:263 | 注意 删除/收口测试，覆盖减少需确认 |             await page.waitForTimeout(1000);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:264 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:265 | 注意 删除/收口测试，覆盖减少需确认 |             // 验证界面出现
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:266 | 注意 删除/收口测试，覆盖减少需确认 |             const modalTitle = page.locator('text=选择一名玩家');
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:267 | 注意 删除/收口测试，覆盖减少需确认 |             await expect(modalTitle).toBeVisible({ timeout: 5000 });
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:268 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:269 | 注意 删除/收口测试，覆盖减少需确认 |             // 点击取消
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:270 | 注意 删除/收口测试，覆盖减少需确认 |             const cancelBtn = page.locator('button:has-text("取消")').last();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:271 | 注意 删除/收口测试，覆盖减少需确认 |             await cancelBtn.click();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:272 | 注意 删除/收口测试，覆盖减少需确认 |             await page.waitForTimeout(1000);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:273 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:274 | 注意 删除/收口测试，覆盖减少需确认 |             // 验证界面关闭
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:275 | 注意 删除/收口测试，覆盖减少需确认 |             await expect(modalTitle).not.toBeVisible();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:276 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:277 | 注意 删除/收口测试，覆盖减少需确认 |             // 验证没有获得 token
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:278 | 注意 删除/收口测试，覆盖减少需确认 |             const core = await readCoreState(page) as Record<string, unknown>;
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:279 | 注意 删除/收口测试，覆盖减少需确认 |             const tokens = getPlayerTokens(core, paladinId);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:280 | 注意 删除/收口测试，覆盖减少需确认 |             expect(tokens[TOKEN_IDS.RETRIBUTION] ?? 0, '取消后不应获得反击').toBe(0);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:281 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:282 | 注意 删除/收口测试，覆盖减少需确认 |             await closeDebugPanelIfOpen(page);
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:283 | 注意 删除/收口测试，覆盖减少需确认 |         } finally {
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:284 | 注意 删除/收口测试，覆盖减少需确认 |             await hostContext.close();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:285 | 注意 删除/收口测试，覆盖减少需确认 |             await guestContext.close();
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:286 | 注意 删除/收口测试，覆盖减少需确认 |         }
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:287 | 注意 删除/收口测试，覆盖减少需确认 |     });
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:288 | 注意 删除/收口测试，覆盖减少需确认 | });
DEL e2e/dicethrone-paladin-vengeance-select-player.e2e.ts:289 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-simple-start.e2e.ts:2 | 注意 删除/收口测试，覆盖减少需确认 |  * DiceThrone 简单启动测试
DEL e2e/dicethrone-simple-start.e2e.ts:3 | 注意 删除/收口测试，覆盖减少需确认 |  * 只测试到游戏开始，不测试业务逻辑
ADD e2e/dicethrone-simple-start.e2e.ts:2 | OK 测试/覆盖新增，需与主链保持一致 |  * DiceThrone 简单开局 E2E 测试
ADD e2e/dicethrone-simple-start.e2e.ts:3 | OK 测试/覆盖新增，需与主链保持一致 |  * 目标：覆盖双人与四人房间的创建、占座、加入与开局主链路。
DEL e2e/dicethrone-simple-start.e2e.ts:6 | 注意 删除/收口测试，覆盖减少需确认 | import { test, expect } from '@playwright/test';
DEL e2e/dicethrone-simple-start.e2e.ts:7 | 注意 删除/收口测试，覆盖减少需确认 | import { setupDTOnlineMatch, selectCharacter, waitForGameBoard, readyAndStartGame } from './helpers/dicethrone';
ADD e2e/dicethrone-simple-start.e2e.ts:6 | OK 测试/覆盖新增，需与主链保持一致 | import { mkdir } from 'node:fs/promises';
ADD e2e/dicethrone-simple-start.e2e.ts:7 | OK 测试/覆盖新增，需与主链保持一致 | import { dirname } from 'node:path';
ADD e2e/dicethrone-simple-start.e2e.ts:8 | OK 测试/覆盖新增，需与主链保持一致 | import type { Page, TestInfo } from '@playwright/test';
ADD e2e/dicethrone-simple-start.e2e.ts:9 | OK 测试/覆盖新增，需与主链保持一致 | import { test, expect } from './framework';
ADD e2e/dicethrone-simple-start.e2e.ts:10 | OK 测试/覆盖新增，需与主链保持一致 | import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from './framework/evidenceScreenshots';
ADD e2e/dicethrone-simple-start.e2e.ts:11 | OK 测试/覆盖新增，需与主链保持一致 | import { waitForTestHarness } from './helpers/common';
ADD e2e/dicethrone-simple-start.e2e.ts:12 | OK 测试/覆盖新增，需与主链保持一致 | import { getMatchState, injectMatchState } from './helpers/state-injection';
ADD e2e/dicethrone-simple-start.e2e.ts:13 | OK 测试/覆盖新增，需与主链保持一致 | import { COMMON_CARDS } from '../src/games/dicethrone/domain/commonCards';
ADD e2e/dicethrone-simple-start.e2e.ts:14 | OK 测试/覆盖新增，需与主链保持一致 | import { PALADIN_DICE_FACE_IDS, TOKEN_IDS } from '../src/games/dicethrone/domain/ids';
ADD e2e/dicethrone-simple-start.e2e.ts:15 | OK 测试/覆盖新增，需与主链保持一致 | import { getAvailableAbilityIds } from '../src/games/dicethrone/domain/rules';
ADD e2e/dicethrone-simple-start.e2e.ts:16 | OK 测试/覆盖新增，需与主链保持一致 | import { registerDiceThroneConditions } from '../src/games/dicethrone/conditions';
ADD e2e/dicethrone-simple-start.e2e.ts:17 | OK 测试/覆盖新增，需与主链保持一致 | import { VENGEANCE_2 } from '../src/games/dicethrone/heroes/paladin/abilities';
ADD e2e/dicethrone-simple-start.e2e.ts:18 | OK 测试/覆盖新增，需与主链保持一致 | import { PALADIN_CARDS } from '../src/games/dicethrone/heroes/paladin/cards';
ADD e2e/dicethrone-simple-start.e2e.ts:19 | OK 测试/覆盖新增，需与主链保持一致 | import {
ADD e2e/dicethrone-simple-start.e2e.ts:20 | OK 测试/覆盖新增，需与主链保持一致 |     cleanupDTMatch,
ADD e2e/dicethrone-simple-start.e2e.ts:21 | OK 测试/覆盖新增，需与主链保持一致 |     readyAndStartGame,
ADD e2e/dicethrone-simple-start.e2e.ts:22 | OK 测试/覆盖新增，需与主链保持一致 |     readyMultiplePlayersAndStartGame,
ADD e2e/dicethrone-simple-start.e2e.ts:23 | OK 测试/覆盖新增，需与主链保持一致 |     selectCharacter,
ADD e2e/dicethrone-simple-start.e2e.ts:24 | OK 测试/覆盖新增，需与主链保持一致 |     setupDTOnlineMatch,
ADD e2e/dicethrone-simple-start.e2e.ts:25 | OK 测试/覆盖新增，需与主链保持一致 |     setupDTOnlineMatchWithPlayers,
ADD e2e/dicethrone-simple-start.e2e.ts:26 | OK 测试/覆盖新增，需与主链保持一致 |     waitForGameBoard,
ADD e2e/dicethrone-simple-start.e2e.ts:27 | OK 测试/覆盖新增，需与主链保持一致 | } from './helpers/dicethrone';
ADD e2e/dicethrone-simple-start.e2e.ts:28 | OK 测试/覆盖新增，需与主链保持一致 | import { getGameServerBaseURL } from './helpers/common';
ADD e2e/dicethrone-simple-start.e2e.ts:29 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:30 | OK 测试/覆盖新增，需与主链保持一致 | registerDiceThroneConditions();
ADD e2e/dicethrone-simple-start.e2e.ts:31 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:32 | OK 测试/覆盖新增，需与主链保持一致 | const MONK_FIST_ATTACK_ID = 'fist-technique-5';
ADD e2e/dicethrone-simple-start.e2e.ts:33 | OK 测试/覆盖新增，需与主链保持一致 | const RESPONSE_WINDOW_CARD_ID = 'card-surprise';
ADD e2e/dicethrone-simple-start.e2e.ts:34 | OK 测试/覆盖新增，需与主链保持一致 | const RESPONSE_WINDOW_CARD = COMMON_CARDS.find((card) => card.id === RESPONSE_WINDOW_CARD_ID);
ADD e2e/dicethrone-simple-start.e2e.ts:35 | OK 测试/覆盖新增，需与主链保持一致 | const REMOVE_SINGLE_STATUS_CARD_ID = 'card-get-away';
ADD e2e/dicethrone-simple-start.e2e.ts:36 | OK 测试/覆盖新增，需与主链保持一致 | const REMOVE_SINGLE_STATUS_CARD = COMMON_CARDS.find((card) => card.id === REMOVE_SINGLE_STATUS_CARD_ID);
ADD e2e/dicethrone-simple-start.e2e.ts:37 | OK 测试/覆盖新增，需与主链保持一致 | const REMOVE_ALL_STATUS_CARD_ID = 'card-what-status';
ADD e2e/dicethrone-simple-start.e2e.ts:38 | OK 测试/覆盖新增，需与主链保持一致 | const REMOVE_ALL_STATUS_CARD = COMMON_CARDS.find((card) => card.id === REMOVE_ALL_STATUS_CARD_ID);
ADD e2e/dicethrone-simple-start.e2e.ts:39 | OK 测试/覆盖新增，需与主链保持一致 | const TRANSFER_STATUS_CARD_ID = 'card-transfer-status';
ADD e2e/dicethrone-simple-start.e2e.ts:40 | OK 测试/覆盖新增，需与主链保持一致 | const TRANSFER_STATUS_CARD = COMMON_CARDS.find((card) => card.id === TRANSFER_STATUS_CARD_ID);
ADD e2e/dicethrone-simple-start.e2e.ts:41 | OK 测试/覆盖新增，需与主链保持一致 | const CONSECRATE_CARD_ID = 'card-consecrate';
ADD e2e/dicethrone-simple-start.e2e.ts:42 | OK 测试/覆盖新增，需与主链保持一致 | const CONSECRATE_CARD = PALADIN_CARDS.find((card) => card.id === CONSECRATE_CARD_ID);
ADD e2e/dicethrone-simple-start.e2e.ts:43 | OK 测试/覆盖新增，需与主链保持一致 | const PALADIN_VENGEANCE_2_CARD_ID = 'card-vengeance-2';
ADD e2e/dicethrone-simple-start.e2e.ts:44 | OK 测试/覆盖新增，需与主链保持一致 | const PALADIN_VENGEANCE_2_CARD = PALADIN_CARDS.find((card) => card.id === PALADIN_VENGEANCE_2_CARD_ID);
ADD e2e/dicethrone-simple-start.e2e.ts:45 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:46 | OK 测试/覆盖新增，需与主链保持一致 | const saveEvidenceScreenshot = async (
ADD e2e/dicethrone-simple-start.e2e.ts:47 | OK 测试/覆盖新增，需与主链保持一致 |     page: Page,
ADD e2e/dicethrone-simple-start.e2e.ts:48 | OK 测试/覆盖新增，需与主链保持一致 |     testInfo: TestInfo,
ADD e2e/dicethrone-simple-start.e2e.ts:49 | OK 测试/覆盖新增，需与主链保持一致 |     name: string,
ADD e2e/dicethrone-simple-start.e2e.ts:50 | OK 测试/覆盖新增，需与主链保持一致 | ) => {
ADD e2e/dicethrone-simple-start.e2e.ts:51 | OK 测试/覆盖新增，需与主链保持一致 |     const path = getEvidenceScreenshotPath(testInfo, name, {
ADD e2e/dicethrone-simple-start.e2e.ts:52 | OK 测试/覆盖新增，需与主链保持一致 |         filename: `${name}.png`,
ADD e2e/dicethrone-simple-start.e2e.ts:53 | OK 测试/覆盖新增，需与主链保持一致 |     });
ADD e2e/dicethrone-simple-start.e2e.ts:54 | OK 测试/覆盖新增，需与主链保持一致 |     await mkdir(dirname(path), { recursive: true });
ADD e2e/dicethrone-simple-start.e2e.ts:55 | OK 测试/覆盖新增，需与主链保持一致 |     await page.screenshot({ path, fullPage: true });
ADD e2e/dicethrone-simple-start.e2e.ts:56 | OK 测试/覆盖新增，需与主链保持一致 |     return path;
ADD e2e/dicethrone-simple-start.e2e.ts:57 | OK 测试/覆盖新增，需与主链保持一致 | };
ADD e2e/dicethrone-simple-start.e2e.ts:58 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:59 | OK 测试/覆盖新增，需与主链保持一致 | const waitForHarnessPages = async (pages: Page[]) => {
ADD e2e/dicethrone-simple-start.e2e.ts:60 | OK 测试/覆盖新增，需与主链保持一致 |     for (const page of pages) {
ADD e2e/dicethrone-simple-start.e2e.ts:61 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForTestHarness(page, 15000);
ADD e2e/dicethrone-simple-start.e2e.ts:62 | OK 测试/覆盖新增，需与主链保持一致 |     }
ADD e2e/dicethrone-simple-start.e2e.ts:63 | OK 测试/覆盖新增，需与主链保持一致 | };
ADD e2e/dicethrone-simple-start.e2e.ts:64 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:65 | OK 测试/覆盖新增，需与主链保持一致 | const readHarnessState = async <T = any>(page: Page): Promise<T> => page.evaluate(() => {
ADD e2e/dicethrone-simple-start.e2e.ts:66 | OK 测试/覆盖新增，需与主链保持一致 |     return (window as any).__BG_TEST_HARNESS__!.state.get();
ADD e2e/dicethrone-simple-start.e2e.ts:67 | OK 测试/覆盖新增，需与主链保持一致 | });
ADD e2e/dicethrone-simple-start.e2e.ts:68 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:69 | OK 测试/覆盖新增，需与主链保持一致 | const applyOnlineMatchState = async (
ADD e2e/dicethrone-simple-start.e2e.ts:70 | OK 测试/覆盖新增，需与主链保持一致 |     matchId: string,
ADD e2e/dicethrone-simple-start.e2e.ts:71 | OK 测试/覆盖新增，需与主链保持一致 |     page: Page,
ADD e2e/dicethrone-simple-start.e2e.ts:72 | OK 测试/覆盖新增，需与主链保持一致 |     updater: (state: any) => any,
ADD e2e/dicethrone-simple-start.e2e.ts:73 | OK 测试/覆盖新增，需与主链保持一致 | ) => {
ADD e2e/dicethrone-simple-start.e2e.ts:74 | OK 测试/覆盖新增，需与主链保持一致 |     const currentState = await getMatchState(matchId, page);
ADD e2e/dicethrone-simple-start.e2e.ts:75 | OK 测试/覆盖新增，需与主链保持一致 |     const nextState = normalizeInjectedMatchState(matchId, updater(currentState));
ADD e2e/dicethrone-simple-start.e2e.ts:76 | OK 测试/覆盖新增，需与主链保持一致 |     await injectMatchState(matchId, nextState, page);
ADD e2e/dicethrone-simple-start.e2e.ts:77 | OK 测试/覆盖新增，需与主链保持一致 |     await page.waitForTimeout(800);
ADD e2e/dicethrone-simple-start.e2e.ts:78 | OK 测试/覆盖新增，需与主链保持一致 | };
ADD e2e/dicethrone-simple-start.e2e.ts:79 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:80 | OK 测试/覆盖新增，需与主链保持一致 | const normalizeInjectedMatchState = (matchId: string, state: any) => {
ADD e2e/dicethrone-simple-start.e2e.ts:81 | OK 测试/覆盖新增，需与主链保持一致 |     const next = structuredClone(state);
ADD e2e/dicethrone-simple-start.e2e.ts:82 | OK 测试/覆盖新增，需与主链保持一致 |     const fallbackTurnOrder = Array.isArray(next.core?.turnOrder)
ADD e2e/dicethrone-simple-start.e2e.ts:83 | OK 测试/覆盖新增，需与主链保持一致 |         ? [...next.core.turnOrder]
ADD e2e/dicethrone-simple-start.e2e.ts:84 | OK 测试/覆盖新增，需与主链保持一致 |         : Object.keys(next.core?.players ?? {});
ADD e2e/dicethrone-simple-start.e2e.ts:85 | OK 测试/覆盖新增，需与主链保持一致 |     const currentPlayerIndex = typeof next.sys?.currentPlayerIndex === 'number'
ADD e2e/dicethrone-simple-start.e2e.ts:86 | OK 测试/覆盖新增，需与主链保持一致 |         ? next.sys.currentPlayerIndex
ADD e2e/dicethrone-simple-start.e2e.ts:87 | OK 测试/覆盖新增，需与主链保持一致 |         : typeof next.core?.currentPlayerIndex === 'number'
ADD e2e/dicethrone-simple-start.e2e.ts:88 | OK 测试/覆盖新增，需与主链保持一致 |             ? next.core.currentPlayerIndex
ADD e2e/dicethrone-simple-start.e2e.ts:89 | OK 测试/覆盖新增，需与主链保持一致 |             : Math.max(0, fallbackTurnOrder.indexOf(next.core?.activePlayerId ?? '0'));
ADD e2e/dicethrone-simple-start.e2e.ts:90 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:91 | OK 测试/覆盖新增，需与主链保持一致 |     next.sys = {
ADD e2e/dicethrone-simple-start.e2e.ts:92 | OK 测试/覆盖新增，需与主链保持一致 |         ...next.sys,
ADD e2e/dicethrone-simple-start.e2e.ts:93 | OK 测试/覆盖新增，需与主链保持一致 |         matchId,
ADD e2e/dicethrone-simple-start.e2e.ts:94 | OK 测试/覆盖新增，需与主链保持一致 |         turnOrder: Array.isArray(next.sys?.turnOrder) ? next.sys.turnOrder : fallbackTurnOrder,
ADD e2e/dicethrone-simple-start.e2e.ts:95 | OK 测试/覆盖新增，需与主链保持一致 |         currentPlayerIndex,
ADD e2e/dicethrone-simple-start.e2e.ts:96 | OK 测试/覆盖新增，需与主链保持一致 |     };
ADD e2e/dicethrone-simple-start.e2e.ts:97 | OK 测试/覆盖新增，需与主链保持一致 |     next.core = {
ADD e2e/dicethrone-simple-start.e2e.ts:98 | OK 测试/覆盖新增，需与主链保持一致 |         ...next.core,
ADD e2e/dicethrone-simple-start.e2e.ts:99 | OK 测试/覆盖新增，需与主链保持一致 |         phase: typeof next.core?.phase === 'string' ? next.core.phase : next.sys.phase,
ADD e2e/dicethrone-simple-start.e2e.ts:100 | OK 测试/覆盖新增，需与主链保持一致 |     };
ADD e2e/dicethrone-simple-start.e2e.ts:101 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:102 | OK 测试/覆盖新增，需与主链保持一致 |     return next;
ADD e2e/dicethrone-simple-start.e2e.ts:103 | OK 测试/覆盖新增，需与主链保持一致 | };
ADD e2e/dicethrone-simple-start.e2e.ts:104 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:105 | OK 测试/覆盖新增，需与主链保持一致 | const dispatchHarnessCommand = async (
ADD e2e/dicethrone-simple-start.e2e.ts:106 | OK 测试/覆盖新增，需与主链保持一致 |     page: Page,
ADD e2e/dicethrone-simple-start.e2e.ts:107 | OK 测试/覆盖新增，需与主链保持一致 |     type: string,
ADD e2e/dicethrone-simple-start.e2e.ts:108 | OK 测试/覆盖新增，需与主链保持一致 |     playerId: string,
ADD e2e/dicethrone-simple-start.e2e.ts:109 | OK 测试/覆盖新增，需与主链保持一致 |     payload: Record<string, unknown> = {},
ADD e2e/dicethrone-simple-start.e2e.ts:110 | OK 测试/覆盖新增，需与主链保持一致 | ) => {
ADD e2e/dicethrone-simple-start.e2e.ts:111 | OK 测试/覆盖新增，需与主链保持一致 |     await page.evaluate(({ commandType, commandPlayerId, commandPayload }) => {
ADD e2e/dicethrone-simple-start.e2e.ts:112 | OK 测试/覆盖新增，需与主链保持一致 |         (window as any).__BG_TEST_HARNESS__!.command.dispatch({
ADD e2e/dicethrone-simple-start.e2e.ts:113 | OK 测试/覆盖新增，需与主链保持一致 |             type: commandType,
ADD e2e/dicethrone-simple-start.e2e.ts:114 | OK 测试/覆盖新增，需与主链保持一致 |             playerId: commandPlayerId,
ADD e2e/dicethrone-simple-start.e2e.ts:115 | OK 测试/覆盖新增，需与主链保持一致 |             payload: commandPayload,
ADD e2e/dicethrone-simple-start.e2e.ts:116 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD e2e/dicethrone-simple-start.e2e.ts:117 | OK 测试/覆盖新增，需与主链保持一致 |     }, {
ADD e2e/dicethrone-simple-start.e2e.ts:118 | OK 测试/覆盖新增，需与主链保持一致 |         commandType: type,
ADD e2e/dicethrone-simple-start.e2e.ts:119 | OK 测试/覆盖新增，需与主链保持一致 |         commandPlayerId: playerId,
ADD e2e/dicethrone-simple-start.e2e.ts:120 | OK 测试/覆盖新增，需与主链保持一致 |         commandPayload: payload,
ADD e2e/dicethrone-simple-start.e2e.ts:121 | OK 测试/覆盖新增，需与主链保持一致 |     });
ADD e2e/dicethrone-simple-start.e2e.ts:122 | OK 测试/覆盖新增，需与主链保持一致 | };
ADD e2e/dicethrone-simple-start.e2e.ts:123 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:124 | OK 测试/覆盖新增，需与主链保持一致 | const waitForPhase = async (page: Page, phase: string, timeout = 15000) => {
ADD e2e/dicethrone-simple-start.e2e.ts:125 | OK 测试/覆盖新增，需与主链保持一致 |     await page.waitForFunction((expectedPhase) => {
ADD e2e/dicethrone-simple-start.e2e.ts:126 | OK 测试/覆盖新增，需与主链保持一致 |         return (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.phase === expectedPhase;
ADD e2e/dicethrone-simple-start.e2e.ts:127 | OK 测试/覆盖新增，需与主链保持一致 |     }, phase, { timeout });
ADD e2e/dicethrone-simple-start.e2e.ts:128 | OK 测试/覆盖新增，需与主链保持一致 | };
ADD e2e/dicethrone-simple-start.e2e.ts:129 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:130 | OK 测试/覆盖新增，需与主链保持一致 | const waitForPendingDefender = async (page: Page, defenderId: string, timeout = 15000) => {
ADD e2e/dicethrone-simple-start.e2e.ts:131 | OK 测试/覆盖新增，需与主链保持一致 |     await page.waitForFunction((expectedDefenderId) => {
ADD e2e/dicethrone-simple-start.e2e.ts:132 | OK 测试/覆盖新增，需与主链保持一致 |         const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
ADD e2e/dicethrone-simple-start.e2e.ts:133 | OK 测试/覆盖新增，需与主链保持一致 |         return state?.core?.pendingAttack?.defenderId === expectedDefenderId;
ADD e2e/dicethrone-simple-start.e2e.ts:134 | OK 测试/覆盖新增，需与主链保持一致 |     }, defenderId, { timeout });
ADD e2e/dicethrone-simple-start.e2e.ts:135 | OK 测试/覆盖新增，需与主链保持一致 | };
ADD e2e/dicethrone-simple-start.e2e.ts:136 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:137 | OK 测试/覆盖新增，需与主链保持一致 | const buildFourPlayerNoResponseState = (state: any) => {
ADD e2e/dicethrone-simple-start.e2e.ts:138 | OK 测试/覆盖新增，需与主链保持一致 |     const next = structuredClone(state);
ADD e2e/dicethrone-simple-start.e2e.ts:139 | OK 测试/覆盖新增，需与主链保持一致 |     for (const player of Object.values<any>(next.core.players ?? {})) {
ADD e2e/dicethrone-simple-start.e2e.ts:140 | OK 测试/覆盖新增，需与主链保持一致 |         player.hand = [];
ADD e2e/dicethrone-simple-start.e2e.ts:141 | OK 测试/覆盖新增，需与主链保持一致 |     }
ADD e2e/dicethrone-simple-start.e2e.ts:142 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.pendingBonusDiceSettlement = undefined;
ADD e2e/dicethrone-simple-start.e2e.ts:143 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.pendingDamage = null;
ADD e2e/dicethrone-simple-start.e2e.ts:144 | OK 测试/覆盖新增，需与主链保持一致 |     next.sys.responseWindow = {
ADD e2e/dicethrone-simple-start.e2e.ts:145 | OK 测试/覆盖新增，需与主链保持一致 |         ...next.sys.responseWindow,
ADD e2e/dicethrone-simple-start.e2e.ts:146 | OK 测试/覆盖新增，需与主链保持一致 |         current: undefined,
ADD e2e/dicethrone-simple-start.e2e.ts:147 | OK 测试/覆盖新增，需与主链保持一致 |     };
ADD e2e/dicethrone-simple-start.e2e.ts:148 | OK 测试/覆盖新增，需与主链保持一致 |     next.sys.interaction = {
ADD e2e/dicethrone-simple-start.e2e.ts:149 | OK 测试/覆盖新增，需与主链保持一致 |         ...next.sys.interaction,
ADD e2e/dicethrone-simple-start.e2e.ts:150 | OK 测试/覆盖新增，需与主链保持一致 |         current: undefined,
ADD e2e/dicethrone-simple-start.e2e.ts:151 | OK 测试/覆盖新增，需与主链保持一致 |         queue: [],
ADD e2e/dicethrone-simple-start.e2e.ts:152 | OK 测试/覆盖新增，需与主链保持一致 |     };
ADD e2e/dicethrone-simple-start.e2e.ts:153 | OK 测试/覆盖新增，需与主链保持一致 |     next.sys.gameover = undefined;
ADD e2e/dicethrone-simple-start.e2e.ts:154 | OK 测试/覆盖新增，需与主链保持一致 |     return next;
ADD e2e/dicethrone-simple-start.e2e.ts:155 | OK 测试/覆盖新增，需与主链保持一致 | };
ADD e2e/dicethrone-simple-start.e2e.ts:156 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:157 | OK 测试/覆盖新增，需与主链保持一致 | const buildTargetingRollState = (state: any, targetingValue: number) => {
ADD e2e/dicethrone-simple-start.e2e.ts:158 | OK 测试/覆盖新增，需与主链保持一致 |     const next = buildFourPlayerNoResponseState(state);
ADD e2e/dicethrone-simple-start.e2e.ts:159 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.activePlayerId = '0';
ADD e2e/dicethrone-simple-start.e2e.ts:160 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.rollCount = 1;
ADD e2e/dicethrone-simple-start.e2e.ts:161 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.rollLimit = 1;
ADD e2e/dicethrone-simple-start.e2e.ts:162 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.rollDiceCount = 1;
ADD e2e/dicethrone-simple-start.e2e.ts:163 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.rollConfirmed = true;
ADD e2e/dicethrone-simple-start.e2e.ts:164 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.selectedAbilityId = MONK_FIST_ATTACK_ID;
ADD e2e/dicethrone-simple-start.e2e.ts:165 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.pendingAttack = {
ADD e2e/dicethrone-simple-start.e2e.ts:166 | OK 测试/覆盖新增，需与主链保持一致 |         attackerId: '0',
ADD e2e/dicethrone-simple-start.e2e.ts:167 | OK 测试/覆盖新增，需与主链保持一致 |         defenderId: undefined,
ADD e2e/dicethrone-simple-start.e2e.ts:168 | OK 测试/覆盖新增，需与主链保持一致 |         targetingSelectionPending: false,
ADD e2e/dicethrone-simple-start.e2e.ts:169 | OK 测试/覆盖新增，需与主链保持一致 |         targetingSelectionResolved: false,
ADD e2e/dicethrone-simple-start.e2e.ts:170 | OK 测试/覆盖新增，需与主链保持一致 |         isDefendable: true,
ADD e2e/dicethrone-simple-start.e2e.ts:171 | OK 测试/覆盖新增，需与主链保持一致 |         damage: 6,
ADD e2e/dicethrone-simple-start.e2e.ts:172 | OK 测试/覆盖新增，需与主链保持一致 |         sourceAbilityId: MONK_FIST_ATTACK_ID,
ADD e2e/dicethrone-simple-start.e2e.ts:173 | OK 测试/覆盖新增，需与主链保持一致 |         defenseAbilityId: undefined,
ADD e2e/dicethrone-simple-start.e2e.ts:174 | OK 测试/覆盖新增，需与主链保持一致 |         preDefenseResolved: false,
ADD e2e/dicethrone-simple-start.e2e.ts:175 | OK 测试/覆盖新增，需与主链保持一致 |         bonusDamage: 0,
ADD e2e/dicethrone-simple-start.e2e.ts:176 | OK 测试/覆盖新增，需与主链保持一致 |         attackModifierBonusDamage: 0,
ADD e2e/dicethrone-simple-start.e2e.ts:177 | OK 测试/覆盖新增，需与主链保持一致 |         damageResolved: false,
ADD e2e/dicethrone-simple-start.e2e.ts:178 | OK 测试/覆盖新增，需与主链保持一致 |         resolvedDamage: 0,
ADD e2e/dicethrone-simple-start.e2e.ts:179 | OK 测试/覆盖新增，需与主链保持一致 |         offensiveRollEndTokenResolved: false,
ADD e2e/dicethrone-simple-start.e2e.ts:180 | OK 测试/覆盖新增，需与主链保持一致 |         bonusDiceResolved: false,
ADD e2e/dicethrone-simple-start.e2e.ts:181 | OK 测试/覆盖新增，需与主链保持一致 |     };
ADD e2e/dicethrone-simple-start.e2e.ts:182 | OK 测试/覆盖新增，需与主链保持一致 |     next.sys.phase = 'targetingRoll';
ADD e2e/dicethrone-simple-start.e2e.ts:183 | OK 测试/覆盖新增，需与主链保持一致 |     next.sys.flowHalted = false;
ADD e2e/dicethrone-simple-start.e2e.ts:184 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.dice = next.core.dice.map((die: any, index: number) => ({
ADD e2e/dicethrone-simple-start.e2e.ts:185 | OK 测试/覆盖新增，需与主链保持一致 |         ...die,
ADD e2e/dicethrone-simple-start.e2e.ts:186 | OK 测试/覆盖新增，需与主链保持一致 |         value: index === 0 ? targetingValue : die.value ?? 1,
ADD e2e/dicethrone-simple-start.e2e.ts:187 | OK 测试/覆盖新增，需与主链保持一致 |         isKept: false,
ADD e2e/dicethrone-simple-start.e2e.ts:188 | OK 测试/覆盖新增，需与主链保持一致 |     }));
ADD e2e/dicethrone-simple-start.e2e.ts:189 | OK 测试/覆盖新增，需与主链保持一致 |     return next;
ADD e2e/dicethrone-simple-start.e2e.ts:190 | OK 测试/覆盖新增，需与主链保持一致 | };
ADD e2e/dicethrone-simple-start.e2e.ts:191 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:192 | OK 测试/覆盖新增，需与主链保持一致 | const _buildResponseWindowTriggerState = (state: any) => {
ADD e2e/dicethrone-simple-start.e2e.ts:193 | OK 测试/覆盖新增，需与主链保持一致 |     const next = buildFourPlayerNoResponseState(state);
ADD e2e/dicethrone-simple-start.e2e.ts:194 | OK 测试/覆盖新增，需与主链保持一致 |     const enemyResponseCard = RESPONSE_WINDOW_CARD;
ADD e2e/dicethrone-simple-start.e2e.ts:195 | OK 测试/覆盖新增，需与主链保持一致 |     const allyResponseCard = RESPONSE_WINDOW_CARD;
ADD e2e/dicethrone-simple-start.e2e.ts:196 | OK 测试/覆盖新增，需与主链保持一致 |     if (!RESPONSE_WINDOW_CARD) {
ADD e2e/dicethrone-simple-start.e2e.ts:197 | OK 测试/覆盖新增，需与主链保持一致 |         throw new Error(`未找到稳定响应卡 ${RESPONSE_WINDOW_CARD_ID}，无法构造四人响应窗口场景`);
ADD e2e/dicethrone-simple-start.e2e.ts:198 | OK 测试/覆盖新增，需与主链保持一致 |     }
ADD e2e/dicethrone-simple-start.e2e.ts:199 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:200 | OK 测试/覆盖新增，需与主链保持一致 |     if (!enemyResponseCard || !allyResponseCard) {
ADD e2e/dicethrone-simple-start.e2e.ts:201 | OK 测试/覆盖新增，需与主链保持一致 |         throw new Error('未找到可用于 afterRollConfirmed 的响应卡，无法构造 4 人响应窗口场景');
ADD e2e/dicethrone-simple-start.e2e.ts:202 | OK 测试/覆盖新增，需与主链保持一致 |     }
ADD e2e/dicethrone-simple-start.e2e.ts:203 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:204 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['1'].hand = [structuredClone(RESPONSE_WINDOW_CARD)];
ADD e2e/dicethrone-simple-start.e2e.ts:205 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['2'].hand = [structuredClone(RESPONSE_WINDOW_CARD)];
ADD e2e/dicethrone-simple-start.e2e.ts:206 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['1'].resources.cp = Math.max(next.core.players['1'].resources.cp ?? 0, 10);
ADD e2e/dicethrone-simple-start.e2e.ts:207 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['2'].resources.cp = Math.max(next.core.players['2'].resources.cp ?? 0, 10);
ADD e2e/dicethrone-simple-start.e2e.ts:208 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.activePlayerId = '0';
ADD e2e/dicethrone-simple-start.e2e.ts:209 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.rollCount = 1;
ADD e2e/dicethrone-simple-start.e2e.ts:210 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.rollLimit = 3;
ADD e2e/dicethrone-simple-start.e2e.ts:211 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.rollDiceCount = 5;
ADD e2e/dicethrone-simple-start.e2e.ts:212 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.rollConfirmed = false;
ADD e2e/dicethrone-simple-start.e2e.ts:213 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.pendingAttack = null;
ADD e2e/dicethrone-simple-start.e2e.ts:214 | OK 测试/覆盖新增，需与主链保持一致 |     next.sys.phase = 'offensiveRoll';
ADD e2e/dicethrone-simple-start.e2e.ts:215 | OK 测试/覆盖新增，需与主链保持一致 |     next.sys.flowHalted = false;
ADD e2e/dicethrone-simple-start.e2e.ts:216 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.dice = (next.core.dice.length > 0
ADD e2e/dicethrone-simple-start.e2e.ts:217 | OK 测试/覆盖新增，需与主链保持一致 |         ? next.core.dice
ADD e2e/dicethrone-simple-start.e2e.ts:218 | OK 测试/覆盖新增，需与主链保持一致 |         : Array.from({ length: 5 }, (_, index) => ({
ADD e2e/dicethrone-simple-start.e2e.ts:219 | OK 测试/覆盖新增，需与主链保持一致 |             id: index,
ADD e2e/dicethrone-simple-start.e2e.ts:220 | OK 测试/覆盖新增，需与主链保持一致 |             definitionId: 'monk-dice',
ADD e2e/dicethrone-simple-start.e2e.ts:221 | OK 测试/覆盖新增，需与主链保持一致 |             value: 1,
ADD e2e/dicethrone-simple-start.e2e.ts:222 | OK 测试/覆盖新增，需与主链保持一致 |             symbol: 'fist',
ADD e2e/dicethrone-simple-start.e2e.ts:223 | OK 测试/覆盖新增，需与主链保持一致 |             symbols: ['fist'],
ADD e2e/dicethrone-simple-start.e2e.ts:224 | OK 测试/覆盖新增，需与主链保持一致 |             isKept: false,
ADD e2e/dicethrone-simple-start.e2e.ts:225 | OK 测试/覆盖新增，需与主链保持一致 |         }))).map((die: any) => ({
ADD e2e/dicethrone-simple-start.e2e.ts:226 | OK 测试/覆盖新增，需与主链保持一致 |         ...die,
ADD e2e/dicethrone-simple-start.e2e.ts:227 | OK 测试/覆盖新增，需与主链保持一致 |         value: 1,
ADD e2e/dicethrone-simple-start.e2e.ts:228 | OK 测试/覆盖新增，需与主链保持一致 |         isKept: false,
ADD e2e/dicethrone-simple-start.e2e.ts:229 | OK 测试/覆盖新增，需与主链保持一致 |     }));
ADD e2e/dicethrone-simple-start.e2e.ts:230 | OK 测试/覆盖新增，需与主链保持一致 |     return next;
ADD e2e/dicethrone-simple-start.e2e.ts:231 | OK 测试/覆盖新增，需与主链保持一致 | };
ADD e2e/dicethrone-simple-start.e2e.ts:232 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:233 | OK 测试/覆盖新增，需与主链保持一致 | const buildDefensiveRollResolutionState = (state: any) => {
ADD e2e/dicethrone-simple-start.e2e.ts:234 | OK 测试/覆盖新增，需与主链保持一致 |     const next = buildFourPlayerNoResponseState(state);
ADD e2e/dicethrone-simple-start.e2e.ts:235 | OK 测试/覆盖新增，需与主链保持一致 |     next.sys.phase = 'defensiveRoll';
ADD e2e/dicethrone-simple-start.e2e.ts:236 | OK 测试/覆盖新增，需与主链保持一致 |     next.sys.flowHalted = false;
ADD e2e/dicethrone-simple-start.e2e.ts:237 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.rollCount = 1;
ADD e2e/dicethrone-simple-start.e2e.ts:238 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.rollLimit = 1;
ADD e2e/dicethrone-simple-start.e2e.ts:239 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.rollDiceCount = 5;
ADD e2e/dicethrone-simple-start.e2e.ts:240 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.rollConfirmed = true;
ADD e2e/dicethrone-simple-start.e2e.ts:241 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.dice = next.core.dice.map((die: any) => ({
ADD e2e/dicethrone-simple-start.e2e.ts:242 | OK 测试/覆盖新增，需与主链保持一致 |         ...die,
ADD e2e/dicethrone-simple-start.e2e.ts:243 | OK 测试/覆盖新增，需与主链保持一致 |         value: 1,
ADD e2e/dicethrone-simple-start.e2e.ts:244 | OK 测试/覆盖新增，需与主链保持一致 |         isKept: false,
ADD e2e/dicethrone-simple-start.e2e.ts:245 | OK 测试/覆盖新增，需与主链保持一致 |     }));
ADD e2e/dicethrone-simple-start.e2e.ts:246 | OK 测试/覆盖新增，需与主链保持一致 |     return next;
ADD e2e/dicethrone-simple-start.e2e.ts:247 | OK 测试/覆盖新增，需与主链保持一致 | };
ADD e2e/dicethrone-simple-start.e2e.ts:248 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:249 | OK 测试/覆盖新增，需与主链保持一致 | const buildDefensiveResponseWindowTriggerState = (state: any) => {
ADD e2e/dicethrone-simple-start.e2e.ts:250 | OK 测试/覆盖新增，需与主链保持一致 |     const next = buildFourPlayerNoResponseState(state);
ADD e2e/dicethrone-simple-start.e2e.ts:251 | OK 测试/覆盖新增，需与主链保持一致 |     const attackerResponseCard = RESPONSE_WINDOW_CARD;
ADD e2e/dicethrone-simple-start.e2e.ts:252 | OK 测试/覆盖新增，需与主链保持一致 |     const defenderTeammateResponseCard = RESPONSE_WINDOW_CARD;
ADD e2e/dicethrone-simple-start.e2e.ts:253 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:254 | OK 测试/覆盖新增，需与主链保持一致 |     if (!attackerResponseCard || !defenderTeammateResponseCard) {
ADD e2e/dicethrone-simple-start.e2e.ts:255 | OK 测试/覆盖新增，需与主链保持一致 |         throw new Error(`未找到稳定响应卡 ${RESPONSE_WINDOW_CARD_ID}，无法构造防守响应窗口场景`);
ADD e2e/dicethrone-simple-start.e2e.ts:256 | OK 测试/覆盖新增，需与主链保持一致 |     }
ADD e2e/dicethrone-simple-start.e2e.ts:257 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:258 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['0'].hand = [structuredClone(attackerResponseCard)];
ADD e2e/dicethrone-simple-start.e2e.ts:259 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['2'].hand = [structuredClone(defenderTeammateResponseCard)];
ADD e2e/dicethrone-simple-start.e2e.ts:260 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['0'].resources.cp = Math.max(next.core.players['0'].resources.cp ?? 0, 10);
ADD e2e/dicethrone-simple-start.e2e.ts:261 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['2'].resources.cp = Math.max(next.core.players['2'].resources.cp ?? 0, 10);
ADD e2e/dicethrone-simple-start.e2e.ts:262 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.activePlayerId = '0';
ADD e2e/dicethrone-simple-start.e2e.ts:263 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.rollCount = 1;
ADD e2e/dicethrone-simple-start.e2e.ts:264 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.rollLimit = 1;
ADD e2e/dicethrone-simple-start.e2e.ts:265 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.rollDiceCount = 5;
ADD e2e/dicethrone-simple-start.e2e.ts:266 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.rollConfirmed = false;
ADD e2e/dicethrone-simple-start.e2e.ts:267 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.selectedAbilityId = MONK_FIST_ATTACK_ID;
ADD e2e/dicethrone-simple-start.e2e.ts:268 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.pendingAttack = {
ADD e2e/dicethrone-simple-start.e2e.ts:269 | OK 测试/覆盖新增，需与主链保持一致 |         attackerId: '0',
ADD e2e/dicethrone-simple-start.e2e.ts:270 | OK 测试/覆盖新增，需与主链保持一致 |         defenderId: '3',
ADD e2e/dicethrone-simple-start.e2e.ts:271 | OK 测试/覆盖新增，需与主链保持一致 |         targetingSelectionPending: false,
ADD e2e/dicethrone-simple-start.e2e.ts:272 | OK 测试/覆盖新增，需与主链保持一致 |         targetingSelectionResolved: true,
ADD e2e/dicethrone-simple-start.e2e.ts:273 | OK 测试/覆盖新增，需与主链保持一致 |         isDefendable: true,
ADD e2e/dicethrone-simple-start.e2e.ts:274 | OK 测试/覆盖新增，需与主链保持一致 |         damage: 6,
ADD e2e/dicethrone-simple-start.e2e.ts:275 | OK 测试/覆盖新增，需与主链保持一致 |         sourceAbilityId: MONK_FIST_ATTACK_ID,
ADD e2e/dicethrone-simple-start.e2e.ts:276 | OK 测试/覆盖新增，需与主链保持一致 |         defenseAbilityId: undefined,
ADD e2e/dicethrone-simple-start.e2e.ts:277 | OK 测试/覆盖新增，需与主链保持一致 |         preDefenseResolved: false,
ADD e2e/dicethrone-simple-start.e2e.ts:278 | OK 测试/覆盖新增，需与主链保持一致 |         bonusDamage: 0,
ADD e2e/dicethrone-simple-start.e2e.ts:279 | OK 测试/覆盖新增，需与主链保持一致 |         attackModifierBonusDamage: 0,
ADD e2e/dicethrone-simple-start.e2e.ts:280 | OK 测试/覆盖新增，需与主链保持一致 |         damageResolved: false,
ADD e2e/dicethrone-simple-start.e2e.ts:281 | OK 测试/覆盖新增，需与主链保持一致 |         resolvedDamage: 0,
ADD e2e/dicethrone-simple-start.e2e.ts:282 | OK 测试/覆盖新增，需与主链保持一致 |         offensiveRollEndTokenResolved: false,
ADD e2e/dicethrone-simple-start.e2e.ts:283 | OK 测试/覆盖新增，需与主链保持一致 |         bonusDiceResolved: false,
ADD e2e/dicethrone-simple-start.e2e.ts:284 | OK 测试/覆盖新增，需与主链保持一致 |     };
ADD e2e/dicethrone-simple-start.e2e.ts:285 | OK 测试/覆盖新增，需与主链保持一致 |     next.sys.phase = 'defensiveRoll';
ADD e2e/dicethrone-simple-start.e2e.ts:286 | OK 测试/覆盖新增，需与主链保持一致 |     next.sys.flowHalted = false;
ADD e2e/dicethrone-simple-start.e2e.ts:287 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.dice = Array.from({ length: 5 }, (_, index) => ({
ADD e2e/dicethrone-simple-start.e2e.ts:288 | OK 测试/覆盖新增，需与主链保持一致 |         id: index,
ADD e2e/dicethrone-simple-start.e2e.ts:289 | OK 测试/覆盖新增，需与主链保持一致 |         definitionId: 'paladin-dice',
ADD e2e/dicethrone-simple-start.e2e.ts:290 | OK 测试/覆盖新增，需与主链保持一致 |         value: 1,
ADD e2e/dicethrone-simple-start.e2e.ts:291 | OK 测试/覆盖新增，需与主链保持一致 |         symbol: 'sword',
ADD e2e/dicethrone-simple-start.e2e.ts:292 | OK 测试/覆盖新增，需与主链保持一致 |         symbols: ['sword'],
ADD e2e/dicethrone-simple-start.e2e.ts:293 | OK 测试/覆盖新增，需与主链保持一致 |         isKept: false,
ADD e2e/dicethrone-simple-start.e2e.ts:294 | OK 测试/覆盖新增，需与主链保持一致 |     }));
ADD e2e/dicethrone-simple-start.e2e.ts:295 | OK 测试/覆盖新增，需与主链保持一致 |     return next;
ADD e2e/dicethrone-simple-start.e2e.ts:296 | OK 测试/覆盖新增，需与主链保持一致 | };
ADD e2e/dicethrone-simple-start.e2e.ts:297 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:298 | OK 测试/覆盖新增，需与主链保持一致 | const buildTwoPlayerTransferTokenState = (state: any) => {
ADD e2e/dicethrone-simple-start.e2e.ts:299 | OK 测试/覆盖新增，需与主链保持一致 |     const next = buildFourPlayerNoResponseState(state);
ADD e2e/dicethrone-simple-start.e2e.ts:300 | OK 测试/覆盖新增，需与主链保持一致 |     const transferCard = TRANSFER_STATUS_CARD;
ADD e2e/dicethrone-simple-start.e2e.ts:301 | OK 测试/覆盖新增，需与主链保持一致 |     if (!transferCard) {
ADD e2e/dicethrone-simple-start.e2e.ts:302 | OK 测试/覆盖新增，需与主链保持一致 |         throw new Error(`未找到稳定转移卡 ${TRANSFER_STATUS_CARD_ID}，无法构造 2 人转移 token 场景`);
ADD e2e/dicethrone-simple-start.e2e.ts:303 | OK 测试/覆盖新增，需与主链保持一致 |     }
ADD e2e/dicethrone-simple-start.e2e.ts:304 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:305 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.activePlayerId = '0';
ADD e2e/dicethrone-simple-start.e2e.ts:306 | OK 测试/覆盖新增，需与主链保持一致 |     next.sys.phase = 'main1';
ADD e2e/dicethrone-simple-start.e2e.ts:307 | OK 测试/覆盖新增，需与主链保持一致 |     next.sys.flowHalted = false;
ADD e2e/dicethrone-simple-start.e2e.ts:308 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.pendingAttack = null;
ADD e2e/dicethrone-simple-start.e2e.ts:309 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.selectedAbilityId = undefined;
ADD e2e/dicethrone-simple-start.e2e.ts:310 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.rollConfirmed = false;
ADD e2e/dicethrone-simple-start.e2e.ts:311 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['0'].hand = [{ ...structuredClone(transferCard), id: 'transfer-2p-inst' }];
ADD e2e/dicethrone-simple-start.e2e.ts:312 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['0'].resources.cp = Math.max(next.core.players['0'].resources.cp ?? 0, 5);
ADD e2e/dicethrone-simple-start.e2e.ts:313 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['0'].tokens = {
ADD e2e/dicethrone-simple-start.e2e.ts:314 | OK 测试/覆盖新增，需与主链保持一致 |         ...(next.core.players['0'].tokens ?? {}),
ADD e2e/dicethrone-simple-start.e2e.ts:315 | OK 测试/覆盖新增，需与主链保持一致 |         [TOKEN_IDS.CRIT]: 0,
ADD e2e/dicethrone-simple-start.e2e.ts:316 | OK 测试/覆盖新增，需与主链保持一致 |     };
ADD e2e/dicethrone-simple-start.e2e.ts:317 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['1'].tokens = {
ADD e2e/dicethrone-simple-start.e2e.ts:318 | OK 测试/覆盖新增，需与主链保持一致 |         ...(next.core.players['1'].tokens ?? {}),
ADD e2e/dicethrone-simple-start.e2e.ts:319 | OK 测试/覆盖新增，需与主链保持一致 |         [TOKEN_IDS.CRIT]: 1,
ADD e2e/dicethrone-simple-start.e2e.ts:320 | OK 测试/覆盖新增，需与主链保持一致 |     };
ADD e2e/dicethrone-simple-start.e2e.ts:321 | OK 测试/覆盖新增，需与主链保持一致 |     return next;
ADD e2e/dicethrone-simple-start.e2e.ts:322 | OK 测试/覆盖新增，需与主链保持一致 | };
ADD e2e/dicethrone-simple-start.e2e.ts:323 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:324 | OK 测试/覆盖新增，需与主链保持一致 | const buildFourPlayerTransferTokenState = (state: any) => {
ADD e2e/dicethrone-simple-start.e2e.ts:325 | OK 测试/覆盖新增，需与主链保持一致 |     const next = buildFourPlayerNoResponseState(state);
ADD e2e/dicethrone-simple-start.e2e.ts:326 | OK 测试/覆盖新增，需与主链保持一致 |     const transferCard = TRANSFER_STATUS_CARD;
ADD e2e/dicethrone-simple-start.e2e.ts:327 | OK 测试/覆盖新增，需与主链保持一致 |     if (!transferCard) {
ADD e2e/dicethrone-simple-start.e2e.ts:328 | OK 测试/覆盖新增，需与主链保持一致 |         throw new Error(`未找到稳定转移卡 ${TRANSFER_STATUS_CARD_ID}，无法构造 4 人转移 token 场景`);
ADD e2e/dicethrone-simple-start.e2e.ts:329 | OK 测试/覆盖新增，需与主链保持一致 |     }
ADD e2e/dicethrone-simple-start.e2e.ts:330 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:331 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.activePlayerId = '0';
ADD e2e/dicethrone-simple-start.e2e.ts:332 | OK 测试/覆盖新增，需与主链保持一致 |     next.sys.phase = 'main1';
ADD e2e/dicethrone-simple-start.e2e.ts:333 | OK 测试/覆盖新增，需与主链保持一致 |     next.sys.flowHalted = false;
ADD e2e/dicethrone-simple-start.e2e.ts:334 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.pendingAttack = null;
ADD e2e/dicethrone-simple-start.e2e.ts:335 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.selectedAbilityId = undefined;
ADD e2e/dicethrone-simple-start.e2e.ts:336 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.rollConfirmed = false;
ADD e2e/dicethrone-simple-start.e2e.ts:337 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['0'].hand = [{ ...structuredClone(transferCard), id: 'transfer-inst' }];
ADD e2e/dicethrone-simple-start.e2e.ts:338 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['0'].resources.cp = Math.max(next.core.players['0'].resources.cp ?? 0, 5);
ADD e2e/dicethrone-simple-start.e2e.ts:339 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['1'].tokens = {
ADD e2e/dicethrone-simple-start.e2e.ts:340 | OK 测试/覆盖新增，需与主链保持一致 |         ...(next.core.players['1'].tokens ?? {}),
ADD e2e/dicethrone-simple-start.e2e.ts:341 | OK 测试/覆盖新增，需与主链保持一致 |         [TOKEN_IDS.CRIT]: 1,
ADD e2e/dicethrone-simple-start.e2e.ts:342 | OK 测试/覆盖新增，需与主链保持一致 |     };
ADD e2e/dicethrone-simple-start.e2e.ts:343 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['2'].tokens = {
ADD e2e/dicethrone-simple-start.e2e.ts:344 | OK 测试/覆盖新增，需与主链保持一致 |         ...(next.core.players['2'].tokens ?? {}),
ADD e2e/dicethrone-simple-start.e2e.ts:345 | OK 测试/覆盖新增，需与主链保持一致 |         [TOKEN_IDS.CRIT]: 0,
ADD e2e/dicethrone-simple-start.e2e.ts:346 | OK 测试/覆盖新增，需与主链保持一致 |     };
ADD e2e/dicethrone-simple-start.e2e.ts:347 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['3'].tokens = {
ADD e2e/dicethrone-simple-start.e2e.ts:348 | OK 测试/覆盖新增，需与主链保持一致 |         ...(next.core.players['3'].tokens ?? {}),
ADD e2e/dicethrone-simple-start.e2e.ts:349 | OK 测试/覆盖新增，需与主链保持一致 |         [TOKEN_IDS.CRIT]: 0,
ADD e2e/dicethrone-simple-start.e2e.ts:350 | OK 测试/覆盖新增，需与主链保持一致 |     };
ADD e2e/dicethrone-simple-start.e2e.ts:351 | OK 测试/覆盖新增，需与主链保持一致 |     return next;
ADD e2e/dicethrone-simple-start.e2e.ts:352 | OK 测试/覆盖新增，需与主链保持一致 | };
ADD e2e/dicethrone-simple-start.e2e.ts:353 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:354 | OK 测试/覆盖新增，需与主链保持一致 | const buildFourPlayerConsecrateState = (state: any) => {
ADD e2e/dicethrone-simple-start.e2e.ts:355 | OK 测试/覆盖新增，需与主链保持一致 |     const next = buildFourPlayerNoResponseState(state);
ADD e2e/dicethrone-simple-start.e2e.ts:356 | OK 测试/覆盖新增，需与主链保持一致 |     const consecrateCard = CONSECRATE_CARD;
ADD e2e/dicethrone-simple-start.e2e.ts:357 | OK 测试/覆盖新增，需与主链保持一致 |     if (!consecrateCard) {
ADD e2e/dicethrone-simple-start.e2e.ts:358 | OK 测试/覆盖新增，需与主链保持一致 |         throw new Error(`未找到稳定授 token 卡 ${CONSECRATE_CARD_ID}，无法构造 4 人 Consecrate 场景`);
ADD e2e/dicethrone-simple-start.e2e.ts:359 | OK 测试/覆盖新增，需与主链保持一致 |     }
ADD e2e/dicethrone-simple-start.e2e.ts:360 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:361 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.activePlayerId = '0';
ADD e2e/dicethrone-simple-start.e2e.ts:362 | OK 测试/覆盖新增，需与主链保持一致 |     next.sys.phase = 'main1';
ADD e2e/dicethrone-simple-start.e2e.ts:363 | OK 测试/覆盖新增，需与主链保持一致 |     next.sys.flowHalted = false;
ADD e2e/dicethrone-simple-start.e2e.ts:364 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.pendingAttack = null;
ADD e2e/dicethrone-simple-start.e2e.ts:365 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.selectedAbilityId = undefined;
ADD e2e/dicethrone-simple-start.e2e.ts:366 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.rollConfirmed = false;
ADD e2e/dicethrone-simple-start.e2e.ts:367 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['0'].hand = [{ ...structuredClone(consecrateCard), id: 'consecrate-inst' }];
ADD e2e/dicethrone-simple-start.e2e.ts:368 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['0'].resources.cp = Math.max(next.core.players['0'].resources.cp ?? 0, 10);
ADD e2e/dicethrone-simple-start.e2e.ts:369 | OK 测试/覆盖新增，需与主链保持一致 |     for (const pid of ['1', '2', '3']) {
ADD e2e/dicethrone-simple-start.e2e.ts:370 | OK 测试/覆盖新增，需与主链保持一致 |         next.core.players[pid].tokens = {
ADD e2e/dicethrone-simple-start.e2e.ts:371 | OK 测试/覆盖新增，需与主链保持一致 |             ...(next.core.players[pid].tokens ?? {}),
ADD e2e/dicethrone-simple-start.e2e.ts:372 | OK 测试/覆盖新增，需与主链保持一致 |             [TOKEN_IDS.PROTECT]: 0,
ADD e2e/dicethrone-simple-start.e2e.ts:373 | OK 测试/覆盖新增，需与主链保持一致 |             [TOKEN_IDS.RETRIBUTION]: 0,
ADD e2e/dicethrone-simple-start.e2e.ts:374 | OK 测试/覆盖新增，需与主链保持一致 |             [TOKEN_IDS.CRIT]: 0,
ADD e2e/dicethrone-simple-start.e2e.ts:375 | OK 测试/覆盖新增，需与主链保持一致 |             [TOKEN_IDS.ACCURACY]: 0,
ADD e2e/dicethrone-simple-start.e2e.ts:376 | OK 测试/覆盖新增，需与主链保持一致 |         };
ADD e2e/dicethrone-simple-start.e2e.ts:377 | OK 测试/覆盖新增，需与主链保持一致 |     }
ADD e2e/dicethrone-simple-start.e2e.ts:378 | OK 测试/覆盖新增，需与主链保持一致 |     return next;
ADD e2e/dicethrone-simple-start.e2e.ts:379 | OK 测试/覆盖新增，需与主链保持一致 | };
ADD e2e/dicethrone-simple-start.e2e.ts:380 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:381 | OK 测试/覆盖新增，需与主链保持一致 | const buildFourPlayerVengeance2State = (state: any) => {
ADD e2e/dicethrone-simple-start.e2e.ts:382 | OK 测试/覆盖新增，需与主链保持一致 |     const next = buildFourPlayerNoResponseState(state);
ADD e2e/dicethrone-simple-start.e2e.ts:383 | OK 测试/覆盖新增，需与主链保持一致 |     const vengeanceUpgradeCard = PALADIN_VENGEANCE_2_CARD;
ADD e2e/dicethrone-simple-start.e2e.ts:384 | OK 测试/覆盖新增，需与主链保持一致 |     if (!vengeanceUpgradeCard) {
ADD e2e/dicethrone-simple-start.e2e.ts:385 | OK 测试/覆盖新增，需与主链保持一致 |         throw new Error(`未找到稳定升级卡 ${PALADIN_VENGEANCE_2_CARD_ID}，无法构造 4 人 Vengeance II 场景`);
ADD e2e/dicethrone-simple-start.e2e.ts:386 | OK 测试/覆盖新增，需与主链保持一致 |     }
ADD e2e/dicethrone-simple-start.e2e.ts:387 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:388 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.activePlayerId = '0';
ADD e2e/dicethrone-simple-start.e2e.ts:389 | OK 测试/覆盖新增，需与主链保持一致 |     next.sys.phase = 'offensiveRoll';
ADD e2e/dicethrone-simple-start.e2e.ts:390 | OK 测试/覆盖新增，需与主链保持一致 |     next.sys.flowHalted = false;
ADD e2e/dicethrone-simple-start.e2e.ts:391 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.pendingAttack = null;
ADD e2e/dicethrone-simple-start.e2e.ts:392 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.selectedAbilityId = undefined;
ADD e2e/dicethrone-simple-start.e2e.ts:393 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.rollConfirmed = true;
ADD e2e/dicethrone-simple-start.e2e.ts:394 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.rollCount = 1;
ADD e2e/dicethrone-simple-start.e2e.ts:395 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.rollLimit = 3;
ADD e2e/dicethrone-simple-start.e2e.ts:396 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.rollDiceCount = 5;
ADD e2e/dicethrone-simple-start.e2e.ts:397 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['0'].resources.cp = 1;
ADD e2e/dicethrone-simple-start.e2e.ts:398 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['0'].abilityLevels = {
ADD e2e/dicethrone-simple-start.e2e.ts:399 | OK 测试/覆盖新增，需与主链保持一致 |         ...(next.core.players['0'].abilityLevels ?? {}),
ADD e2e/dicethrone-simple-start.e2e.ts:400 | OK 测试/覆盖新增，需与主链保持一致 |         vengeance: 2,
ADD e2e/dicethrone-simple-start.e2e.ts:401 | OK 测试/覆盖新增，需与主链保持一致 |     };
ADD e2e/dicethrone-simple-start.e2e.ts:402 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['0'].abilities = (next.core.players['0'].abilities ?? []).map((ability: any) =>
ADD e2e/dicethrone-simple-start.e2e.ts:403 | OK 测试/覆盖新增，需与主链保持一致 |         ability?.id === 'vengeance' ? structuredClone(VENGEANCE_2) : ability
ADD e2e/dicethrone-simple-start.e2e.ts:404 | OK 测试/覆盖新增，需与主链保持一致 |     );
ADD e2e/dicethrone-simple-start.e2e.ts:405 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['0'].upgradeCardByAbilityId = {
ADD e2e/dicethrone-simple-start.e2e.ts:406 | OK 测试/覆盖新增，需与主链保持一致 |         ...(next.core.players['0'].upgradeCardByAbilityId ?? {}),
ADD e2e/dicethrone-simple-start.e2e.ts:407 | OK 测试/覆盖新增，需与主链保持一致 |         vengeance: { cardId: vengeanceUpgradeCard.id, cpCost: vengeanceUpgradeCard.cpCost },
ADD e2e/dicethrone-simple-start.e2e.ts:408 | OK 测试/覆盖新增，需与主链保持一致 |     };
ADD e2e/dicethrone-simple-start.e2e.ts:409 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['0'].tokens = {
ADD e2e/dicethrone-simple-start.e2e.ts:410 | OK 测试/覆盖新增，需与主链保持一致 |         ...(next.core.players['0'].tokens ?? {}),
ADD e2e/dicethrone-simple-start.e2e.ts:411 | OK 测试/覆盖新增，需与主链保持一致 |         [TOKEN_IDS.RETRIBUTION]: 0,
ADD e2e/dicethrone-simple-start.e2e.ts:412 | OK 测试/覆盖新增，需与主链保持一致 |     };
ADD e2e/dicethrone-simple-start.e2e.ts:413 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['2'].tokens = {
ADD e2e/dicethrone-simple-start.e2e.ts:414 | OK 测试/覆盖新增，需与主链保持一致 |         ...(next.core.players['2'].tokens ?? {}),
ADD e2e/dicethrone-simple-start.e2e.ts:415 | OK 测试/覆盖新增，需与主链保持一致 |         [TOKEN_IDS.RETRIBUTION]: 0,
ADD e2e/dicethrone-simple-start.e2e.ts:416 | OK 测试/覆盖新增，需与主链保持一致 |     };
ADD e2e/dicethrone-simple-start.e2e.ts:417 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.dice = (next.core.dice.length > 0
ADD e2e/dicethrone-simple-start.e2e.ts:418 | OK 测试/覆盖新增，需与主链保持一致 |         ? next.core.dice
ADD e2e/dicethrone-simple-start.e2e.ts:419 | OK 测试/覆盖新增，需与主链保持一致 |         : Array.from({ length: 5 }, (_, index) => ({
ADD e2e/dicethrone-simple-start.e2e.ts:420 | OK 测试/覆盖新增，需与主链保持一致 |             id: index,
ADD e2e/dicethrone-simple-start.e2e.ts:421 | OK 测试/覆盖新增，需与主链保持一致 |             definitionId: 'paladin-dice',
ADD e2e/dicethrone-simple-start.e2e.ts:422 | OK 测试/覆盖新增，需与主链保持一致 |             value: 1,
ADD e2e/dicethrone-simple-start.e2e.ts:423 | OK 测试/覆盖新增，需与主链保持一致 |             symbol: 'sword',
ADD e2e/dicethrone-simple-start.e2e.ts:424 | OK 测试/覆盖新增，需与主链保持一致 |             symbols: ['sword'],
ADD e2e/dicethrone-simple-start.e2e.ts:425 | OK 测试/覆盖新增，需与主链保持一致 |             isKept: false,
ADD e2e/dicethrone-simple-start.e2e.ts:426 | OK 测试/覆盖新增，需与主链保持一致 |         }))).map((die: any, index: number) => ({
ADD e2e/dicethrone-simple-start.e2e.ts:427 | OK 测试/覆盖新增，需与主链保持一致 |         ...die,
ADD e2e/dicethrone-simple-start.e2e.ts:428 | OK 测试/覆盖新增，需与主链保持一致 |         value: index < 3 ? 3 : index === 3 ? 6 : 1,
ADD e2e/dicethrone-simple-start.e2e.ts:429 | OK 测试/覆盖新增，需与主链保持一致 |         symbol: index < 3
ADD e2e/dicethrone-simple-start.e2e.ts:430 | OK 测试/覆盖新增，需与主链保持一致 |             ? PALADIN_DICE_FACE_IDS.HELM
ADD e2e/dicethrone-simple-start.e2e.ts:431 | OK 测试/覆盖新增，需与主链保持一致 |             : index === 3
ADD e2e/dicethrone-simple-start.e2e.ts:432 | OK 测试/覆盖新增，需与主链保持一致 |                 ? PALADIN_DICE_FACE_IDS.PRAY
ADD e2e/dicethrone-simple-start.e2e.ts:433 | OK 测试/覆盖新增，需与主链保持一致 |                 : PALADIN_DICE_FACE_IDS.SWORD,
ADD e2e/dicethrone-simple-start.e2e.ts:434 | OK 测试/覆盖新增，需与主链保持一致 |         symbols: [index < 3
ADD e2e/dicethrone-simple-start.e2e.ts:435 | OK 测试/覆盖新增，需与主链保持一致 |             ? PALADIN_DICE_FACE_IDS.HELM
ADD e2e/dicethrone-simple-start.e2e.ts:436 | OK 测试/覆盖新增，需与主链保持一致 |             : index === 3
ADD e2e/dicethrone-simple-start.e2e.ts:437 | OK 测试/覆盖新增，需与主链保持一致 |                 ? PALADIN_DICE_FACE_IDS.PRAY
ADD e2e/dicethrone-simple-start.e2e.ts:438 | OK 测试/覆盖新增，需与主链保持一致 |                 : PALADIN_DICE_FACE_IDS.SWORD],
ADD e2e/dicethrone-simple-start.e2e.ts:439 | OK 测试/覆盖新增，需与主链保持一致 |         isKept: false,
ADD e2e/dicethrone-simple-start.e2e.ts:440 | OK 测试/覆盖新增，需与主链保持一致 |     }));
ADD e2e/dicethrone-simple-start.e2e.ts:441 | OK 测试/覆盖新增，需与主链保持一致 |     return next;
ADD e2e/dicethrone-simple-start.e2e.ts:442 | OK 测试/覆盖新增，需与主链保持一致 | };
ADD e2e/dicethrone-simple-start.e2e.ts:443 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:444 | OK 测试/覆盖新增，需与主链保持一致 | const buildFourPlayerRemoveSingleStatusState = (state: any) => {
ADD e2e/dicethrone-simple-start.e2e.ts:445 | OK 测试/覆盖新增，需与主链保持一致 |     const next = buildFourPlayerNoResponseState(state);
ADD e2e/dicethrone-simple-start.e2e.ts:446 | OK 测试/覆盖新增，需与主链保持一致 |     const removeSingleStatusCard = REMOVE_SINGLE_STATUS_CARD;
ADD e2e/dicethrone-simple-start.e2e.ts:447 | OK 测试/覆盖新增，需与主链保持一致 |     if (!removeSingleStatusCard) {
ADD e2e/dicethrone-simple-start.e2e.ts:448 | OK 测试/覆盖新增，需与主链保持一致 |         throw new Error(`未找到稳定移除单状态卡 ${REMOVE_SINGLE_STATUS_CARD_ID}，无法构造 4 人 remove-status-1 场景`);
ADD e2e/dicethrone-simple-start.e2e.ts:449 | OK 测试/覆盖新增，需与主链保持一致 |     }
ADD e2e/dicethrone-simple-start.e2e.ts:450 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:451 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.activePlayerId = '0';
ADD e2e/dicethrone-simple-start.e2e.ts:452 | OK 测试/覆盖新增，需与主链保持一致 |     next.sys.phase = 'main1';
ADD e2e/dicethrone-simple-start.e2e.ts:453 | OK 测试/覆盖新增，需与主链保持一致 |     next.sys.flowHalted = false;
ADD e2e/dicethrone-simple-start.e2e.ts:454 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.pendingAttack = null;
ADD e2e/dicethrone-simple-start.e2e.ts:455 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.selectedAbilityId = undefined;
ADD e2e/dicethrone-simple-start.e2e.ts:456 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.rollConfirmed = false;
ADD e2e/dicethrone-simple-start.e2e.ts:457 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['0'].hand = [{ ...structuredClone(removeSingleStatusCard), id: 'remove-single-inst' }];
ADD e2e/dicethrone-simple-start.e2e.ts:458 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['0'].resources.cp = Math.max(next.core.players['0'].resources.cp ?? 0, 6);
ADD e2e/dicethrone-simple-start.e2e.ts:459 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['1'].tokens = {
ADD e2e/dicethrone-simple-start.e2e.ts:460 | OK 测试/覆盖新增，需与主链保持一致 |         ...(next.core.players['1'].tokens ?? {}),
ADD e2e/dicethrone-simple-start.e2e.ts:461 | OK 测试/覆盖新增，需与主链保持一致 |         [TOKEN_IDS.CRIT]: 1,
ADD e2e/dicethrone-simple-start.e2e.ts:462 | OK 测试/覆盖新增，需与主链保持一致 |     };
ADD e2e/dicethrone-simple-start.e2e.ts:463 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['2'].tokens = {
ADD e2e/dicethrone-simple-start.e2e.ts:464 | OK 测试/覆盖新增，需与主链保持一致 |         ...(next.core.players['2'].tokens ?? {}),
ADD e2e/dicethrone-simple-start.e2e.ts:465 | OK 测试/覆盖新增，需与主链保持一致 |         [TOKEN_IDS.CRIT]: 0,
ADD e2e/dicethrone-simple-start.e2e.ts:466 | OK 测试/覆盖新增，需与主链保持一致 |     };
ADD e2e/dicethrone-simple-start.e2e.ts:467 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['3'].tokens = {
ADD e2e/dicethrone-simple-start.e2e.ts:468 | OK 测试/覆盖新增，需与主链保持一致 |         ...(next.core.players['3'].tokens ?? {}),
ADD e2e/dicethrone-simple-start.e2e.ts:469 | OK 测试/覆盖新增，需与主链保持一致 |         [TOKEN_IDS.CRIT]: 0,
ADD e2e/dicethrone-simple-start.e2e.ts:470 | OK 测试/覆盖新增，需与主链保持一致 |     };
ADD e2e/dicethrone-simple-start.e2e.ts:471 | OK 测试/覆盖新增，需与主链保持一致 |     return next;
ADD e2e/dicethrone-simple-start.e2e.ts:472 | OK 测试/覆盖新增，需与主链保持一致 | };
ADD e2e/dicethrone-simple-start.e2e.ts:473 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:474 | OK 测试/覆盖新增，需与主链保持一致 | const buildFourPlayerRemoveAllStatusState = (state: any) => {
ADD e2e/dicethrone-simple-start.e2e.ts:475 | OK 测试/覆盖新增，需与主链保持一致 |     const next = buildFourPlayerNoResponseState(state);
ADD e2e/dicethrone-simple-start.e2e.ts:476 | OK 测试/覆盖新增，需与主链保持一致 |     const removeAllStatusCard = REMOVE_ALL_STATUS_CARD;
ADD e2e/dicethrone-simple-start.e2e.ts:477 | OK 测试/覆盖新增，需与主链保持一致 |     if (!removeAllStatusCard) {
ADD e2e/dicethrone-simple-start.e2e.ts:478 | OK 测试/覆盖新增，需与主链保持一致 |         throw new Error(`未找到稳定移除全部状态卡 ${REMOVE_ALL_STATUS_CARD_ID}，无法构造 4 人 remove-all-status 场景`);
ADD e2e/dicethrone-simple-start.e2e.ts:479 | OK 测试/覆盖新增，需与主链保持一致 |     }
ADD e2e/dicethrone-simple-start.e2e.ts:480 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:481 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.activePlayerId = '0';
ADD e2e/dicethrone-simple-start.e2e.ts:482 | OK 测试/覆盖新增，需与主链保持一致 |     next.sys.phase = 'main1';
ADD e2e/dicethrone-simple-start.e2e.ts:483 | OK 测试/覆盖新增，需与主链保持一致 |     next.sys.flowHalted = false;
ADD e2e/dicethrone-simple-start.e2e.ts:484 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.pendingAttack = null;
ADD e2e/dicethrone-simple-start.e2e.ts:485 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.selectedAbilityId = undefined;
ADD e2e/dicethrone-simple-start.e2e.ts:486 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.rollConfirmed = false;
ADD e2e/dicethrone-simple-start.e2e.ts:487 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['0'].hand = [{ ...structuredClone(removeAllStatusCard), id: 'remove-all-inst' }];
ADD e2e/dicethrone-simple-start.e2e.ts:488 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['0'].resources.cp = Math.max(next.core.players['0'].resources.cp ?? 0, 6);
ADD e2e/dicethrone-simple-start.e2e.ts:489 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['1'].statusEffects = {
ADD e2e/dicethrone-simple-start.e2e.ts:490 | OK 测试/覆盖新增，需与主链保持一致 |         ...(next.core.players['1'].statusEffects ?? {}),
ADD e2e/dicethrone-simple-start.e2e.ts:491 | OK 测试/覆盖新增，需与主链保持一致 |         burn: 2,
ADD e2e/dicethrone-simple-start.e2e.ts:492 | OK 测试/覆盖新增，需与主链保持一致 |     };
ADD e2e/dicethrone-simple-start.e2e.ts:493 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['1'].tokens = {
ADD e2e/dicethrone-simple-start.e2e.ts:494 | OK 测试/覆盖新增，需与主链保持一致 |         ...(next.core.players['1'].tokens ?? {}),
ADD e2e/dicethrone-simple-start.e2e.ts:495 | OK 测试/覆盖新增，需与主链保持一致 |         [TOKEN_IDS.CRIT]: 1,
ADD e2e/dicethrone-simple-start.e2e.ts:496 | OK 测试/覆盖新增，需与主链保持一致 |     };
ADD e2e/dicethrone-simple-start.e2e.ts:497 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['2'].statusEffects = {
ADD e2e/dicethrone-simple-start.e2e.ts:498 | OK 测试/覆盖新增，需与主链保持一致 |         ...(next.core.players['2'].statusEffects ?? {}),
ADD e2e/dicethrone-simple-start.e2e.ts:499 | OK 测试/覆盖新增，需与主链保持一致 |     };
ADD e2e/dicethrone-simple-start.e2e.ts:500 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['2'].tokens = {
ADD e2e/dicethrone-simple-start.e2e.ts:501 | OK 测试/覆盖新增，需与主链保持一致 |         ...(next.core.players['2'].tokens ?? {}),
ADD e2e/dicethrone-simple-start.e2e.ts:502 | OK 测试/覆盖新增，需与主链保持一致 |         [TOKEN_IDS.CRIT]: 0,
ADD e2e/dicethrone-simple-start.e2e.ts:503 | OK 测试/覆盖新增，需与主链保持一致 |     };
ADD e2e/dicethrone-simple-start.e2e.ts:504 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['3'].statusEffects = {
ADD e2e/dicethrone-simple-start.e2e.ts:505 | OK 测试/覆盖新增，需与主链保持一致 |         ...(next.core.players['3'].statusEffects ?? {}),
ADD e2e/dicethrone-simple-start.e2e.ts:506 | OK 测试/覆盖新增，需与主链保持一致 |     };
ADD e2e/dicethrone-simple-start.e2e.ts:507 | OK 测试/覆盖新增，需与主链保持一致 |     next.core.players['3'].tokens = {
ADD e2e/dicethrone-simple-start.e2e.ts:508 | OK 测试/覆盖新增，需与主链保持一致 |         ...(next.core.players['3'].tokens ?? {}),
ADD e2e/dicethrone-simple-start.e2e.ts:509 | OK 测试/覆盖新增，需与主链保持一致 |         [TOKEN_IDS.CRIT]: 0,
ADD e2e/dicethrone-simple-start.e2e.ts:510 | OK 测试/覆盖新增，需与主链保持一致 |     };
ADD e2e/dicethrone-simple-start.e2e.ts:511 | OK 测试/覆盖新增，需与主链保持一致 |     return next;
ADD e2e/dicethrone-simple-start.e2e.ts:512 | OK 测试/覆盖新增，需与主链保持一致 | };
DEL e2e/dicethrone-simple-start.e2e.ts:15 | 注意 删除/收口测试，覆盖减少需确认 |         
DEL e2e/dicethrone-simple-start.e2e.ts:20 | 注意 删除/收口测试，覆盖减少需确认 |         
DEL e2e/dicethrone-simple-start.e2e.ts:21 | 注意 删除/收口测试，覆盖减少需确认 |         const { hostPage, guestPage, hostContext, guestContext } = setup;
DEL e2e/dicethrone-simple-start.e2e.ts:23 | 注意 删除/收口测试，覆盖减少需确认 |         // 选择英雄：野蛮人 vs 圣骑士
ADD e2e/dicethrone-simple-start.e2e.ts:525 | OK 测试/覆盖新增，需与主链保持一致 |         const { hostPage, guestPage } = setup;
ADD e2e/dicethrone-simple-start.e2e.ts:526 | OK 测试/覆盖新增，需与主链保持一致 | 
DEL e2e/dicethrone-simple-start.e2e.ts:26 | 注意 删除/收口测试，覆盖减少需确认 |         
DEL e2e/dicethrone-simple-start.e2e.ts:27 | 注意 删除/收口测试，覆盖减少需确认 |         // 准备并开始游戏
DEL e2e/dicethrone-simple-start.e2e.ts:29 | 注意 删除/收口测试，覆盖减少需确认 |         
DEL e2e/dicethrone-simple-start.e2e.ts:30 | 注意 删除/收口测试，覆盖减少需确认 |         // 等待游戏开始
ADD e2e/dicethrone-simple-start.e2e.ts:530 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:531 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForGameBoard(hostPage);
ADD e2e/dicethrone-simple-start.e2e.ts:532 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForGameBoard(guestPage);
ADD e2e/dicethrone-simple-start.e2e.ts:533 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:534 | OK 测试/覆盖新增，需与主链保持一致 |         await clearEvidenceScreenshotsForTest(testInfo);
ADD e2e/dicethrone-simple-start.e2e.ts:535 | OK 测试/覆盖新增，需与主链保持一致 |         await saveEvidenceScreenshot(hostPage, testInfo, '01-host-game-started');
ADD e2e/dicethrone-simple-start.e2e.ts:536 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:537 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.locator('[data-tutorial-id="dice-roll-button"]')).toBeVisible({ timeout: 5000 });
ADD e2e/dicethrone-simple-start.e2e.ts:538 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(guestPage.locator('[data-tutorial-id="dice-roll-button"]')).toBeVisible({ timeout: 5000 });
ADD e2e/dicethrone-simple-start.e2e.ts:539 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:540 | OK 测试/覆盖新增，需与主链保持一致 |         await cleanupDTMatch(setup);
ADD e2e/dicethrone-simple-start.e2e.ts:541 | OK 测试/覆盖新增，需与主链保持一致 |     });
ADD e2e/dicethrone-simple-start.e2e.ts:542 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:543 | OK 测试/覆盖新增，需与主链保持一致 |     test('Online 2-player transfer token: transfer phase keeps locked source card and target card', async ({ browser, workerPorts }, testInfo) => {
ADD e2e/dicethrone-simple-start.e2e.ts:544 | OK 测试/覆盖新增，需与主链保持一致 |         test.setTimeout(90000);
ADD e2e/dicethrone-simple-start.e2e.ts:545 | OK 测试/覆盖新增，需与主链保持一致 |         const baseURL = `http://127.0.0.1:${workerPorts.frontend}`;
ADD e2e/dicethrone-simple-start.e2e.ts:546 | OK 测试/覆盖新增，需与主链保持一致 |         const gameServerBaseURL = 'http://127.0.0.1:20000';
ADD e2e/dicethrone-simple-start.e2e.ts:547 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:548 | OK 测试/覆盖新增，需与主链保持一致 |         const setup = await setupDTOnlineMatch(browser, baseURL, { gameServerBaseURL });
ADD e2e/dicethrone-simple-start.e2e.ts:549 | OK 测试/覆盖新增，需与主链保持一致 |         if (!setup) {
ADD e2e/dicethrone-simple-start.e2e.ts:550 | OK 测试/覆盖新增，需与主链保持一致 |             test.skip(true, '游戏服务器不可用或创建房间失败');
ADD e2e/dicethrone-simple-start.e2e.ts:551 | OK 测试/覆盖新增，需与主链保持一致 |             return;
ADD e2e/dicethrone-simple-start.e2e.ts:552 | OK 测试/覆盖新增，需与主链保持一致 |         }
ADD e2e/dicethrone-simple-start.e2e.ts:553 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:554 | OK 测试/覆盖新增，需与主链保持一致 |         const { hostPage, guestPage, matchId } = setup;
ADD e2e/dicethrone-simple-start.e2e.ts:555 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:556 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(hostPage, 'shadow_thief');
ADD e2e/dicethrone-simple-start.e2e.ts:557 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(guestPage, 'paladin');
ADD e2e/dicethrone-simple-start.e2e.ts:558 | OK 测试/覆盖新增，需与主链保持一致 |         await readyAndStartGame(hostPage, guestPage);
ADD e2e/dicethrone-simple-start.e2e.ts:559 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:562 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForHarnessPages([hostPage, guestPage]);
ADD e2e/dicethrone-simple-start.e2e.ts:563 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:564 | OK 测试/覆盖新增，需与主链保持一致 |         await applyOnlineMatchState(matchId, hostPage, buildTwoPlayerTransferTokenState);
ADD e2e/dicethrone-simple-start.e2e.ts:565 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForPhase(hostPage, 'main1');
ADD e2e/dicethrone-simple-start.e2e.ts:566 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:567 | OK 测试/覆盖新增，需与主链保持一致 |         await dispatchHarnessCommand(hostPage, 'PLAY_CARD', '0', { cardId: 'transfer-2p-inst' });
ADD e2e/dicethrone-simple-start.e2e.ts:568 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:569 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-status-owner-1')).toHaveAttribute('data-team-tone', 'enemy');
ADD e2e/dicethrone-simple-start.e2e.ts:570 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-status-effect-1-crit')).toBeVisible({ timeout: 10000 });
ADD e2e/dicethrone-simple-start.e2e.ts:571 | OK 测试/覆盖新增，需与主链保持一致 |         await hostPage.getByTestId('dt-status-effect-1-crit').click();
ADD e2e/dicethrone-simple-start.e2e.ts:572 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:573 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-transfer-source-locked-1')).toHaveAttribute('data-team-tone', 'enemy');
ADD e2e/dicethrone-simple-start.e2e.ts:574 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-transfer-source-locked-1')).toHaveAttribute('data-locked', 'true');
ADD e2e/dicethrone-simple-start.e2e.ts:575 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-transfer-source-effect-crit')).toBeVisible({ timeout: 10000 });
ADD e2e/dicethrone-simple-start.e2e.ts:576 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-transfer-target-0')).toHaveAttribute('data-team-tone', 'self');
ADD e2e/dicethrone-simple-start.e2e.ts:577 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.locator('[data-testid^="dt-status-owner-"]')).toHaveCount(0);
ADD e2e/dicethrone-simple-start.e2e.ts:578 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:579 | OK 测试/覆盖新增，需与主链保持一致 |         await clearEvidenceScreenshotsForTest(testInfo);
ADD e2e/dicethrone-simple-start.e2e.ts:580 | OK 测试/覆盖新增，需与主链保持一致 |         await saveEvidenceScreenshot(hostPage, testInfo, '01-two-player-transfer-token-target-selection');
ADD e2e/dicethrone-simple-start.e2e.ts:581 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:582 | OK 测试/覆盖新增，需与主链保持一致 |         await hostPage.getByTestId('dt-transfer-target-0').click();
ADD e2e/dicethrone-simple-start.e2e.ts:583 | OK 测试/覆盖新增，需与主链保持一致 |         await hostPage.getByRole('button', { name: /Confirm|确认/i }).last().click();
ADD e2e/dicethrone-simple-start.e2e.ts:584 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:585 | OK 测试/覆盖新增，需与主链保持一致 |         await hostPage.waitForFunction(() => {
ADD e2e/dicethrone-simple-start.e2e.ts:586 | OK 测试/覆盖新增，需与主链保持一致 |             const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
ADD e2e/dicethrone-simple-start.e2e.ts:587 | OK 测试/覆盖新增，需与主链保持一致 |             return !state?.sys?.interaction?.current
ADD e2e/dicethrone-simple-start.e2e.ts:588 | OK 测试/覆盖新增，需与主链保持一致 |                 && (state?.core?.players?.['0']?.tokens?.crit ?? 0) === 1
ADD e2e/dicethrone-simple-start.e2e.ts:589 | OK 测试/覆盖新增，需与主链保持一致 |                 && (state?.core?.players?.['1']?.tokens?.crit ?? 0) === 0;
ADD e2e/dicethrone-simple-start.e2e.ts:590 | OK 测试/覆盖新增，需与主链保持一致 |         }, undefined, { timeout: 10000 });
ADD e2e/dicethrone-simple-start.e2e.ts:591 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:592 | OK 测试/覆盖新增，需与主链保持一致 |         const hostState = await readHarnessState<any>(hostPage);
ADD e2e/dicethrone-simple-start.e2e.ts:593 | OK 测试/覆盖新增，需与主链保持一致 |         const guestState = await readHarnessState<any>(guestPage);
ADD e2e/dicethrone-simple-start.e2e.ts:594 | OK 测试/覆盖新增，需与主链保持一致 |         expect(hostState.core.players['0'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(1);
ADD e2e/dicethrone-simple-start.e2e.ts:595 | OK 测试/覆盖新增，需与主链保持一致 |         expect(hostState.core.players['1'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(0);
ADD e2e/dicethrone-simple-start.e2e.ts:596 | OK 测试/覆盖新增，需与主链保持一致 |         expect(guestState.core.players['0'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(1);
ADD e2e/dicethrone-simple-start.e2e.ts:597 | OK 测试/覆盖新增，需与主链保持一致 |         expect(guestState.core.players['1'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(0);
ADD e2e/dicethrone-simple-start.e2e.ts:598 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:599 | OK 测试/覆盖新增，需与主链保持一致 |         await cleanupDTMatch(setup);
ADD e2e/dicethrone-simple-start.e2e.ts:600 | OK 测试/覆盖新增，需与主链保持一致 |     });
ADD e2e/dicethrone-simple-start.e2e.ts:601 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:602 | OK 测试/覆盖新增，需与主链保持一致 |     test('Online 4-player room: create claim-seat join and start successfully', async ({ browser }, testInfo) => {
ADD e2e/dicethrone-simple-start.e2e.ts:603 | OK 测试/覆盖新增，需与主链保持一致 |         test.setTimeout(120000);
ADD e2e/dicethrone-simple-start.e2e.ts:604 | OK 测试/覆盖新增，需与主链保持一致 |         const baseURL = testInfo.project.use.baseURL as string | undefined;
ADD e2e/dicethrone-simple-start.e2e.ts:605 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:606 | OK 测试/覆盖新增，需与主链保持一致 |         const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
ADD e2e/dicethrone-simple-start.e2e.ts:607 | OK 测试/覆盖新增，需与主链保持一致 |             numPlayers: 4,
ADD e2e/dicethrone-simple-start.e2e.ts:608 | OK 测试/覆盖新增，需与主链保持一致 |             gameServerBaseURL: getGameServerBaseURL(),
ADD e2e/dicethrone-simple-start.e2e.ts:609 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD e2e/dicethrone-simple-start.e2e.ts:610 | OK 测试/覆盖新增，需与主链保持一致 |         if (!setup) {
ADD e2e/dicethrone-simple-start.e2e.ts:611 | OK 测试/覆盖新增，需与主链保持一致 |             test.skip(true, '游戏服务器不可用或四人房间创建失败');
ADD e2e/dicethrone-simple-start.e2e.ts:612 | OK 测试/覆盖新增，需与主链保持一致 |             return;
ADD e2e/dicethrone-simple-start.e2e.ts:613 | OK 测试/覆盖新增，需与主链保持一致 |         }
ADD e2e/dicethrone-simple-start.e2e.ts:614 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:615 | OK 测试/覆盖新增，需与主链保持一致 |         const { hostPage, matchId, players } = setup;
ADD e2e/dicethrone-simple-start.e2e.ts:616 | OK 测试/覆盖新增，需与主链保持一致 |         const gameServerBaseURL = getGameServerBaseURL();
ADD e2e/dicethrone-simple-start.e2e.ts:617 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:618 | OK 测试/覆盖新增，需与主链保持一致 |         const beforeStartResponse = await hostPage.request.get(`${gameServerBaseURL}/games/dicethrone/${matchId}`);
ADD e2e/dicethrone-simple-start.e2e.ts:619 | OK 测试/覆盖新增，需与主链保持一致 |         expect(beforeStartResponse.ok()).toBe(true);
ADD e2e/dicethrone-simple-start.e2e.ts:620 | OK 测试/覆盖新增，需与主链保持一致 |         const beforeStartMatch = await beforeStartResponse.json() as {
ADD e2e/dicethrone-simple-start.e2e.ts:621 | OK 测试/覆盖新增，需与主链保持一致 |             players: Array<{ id: number; name?: string }>;
ADD e2e/dicethrone-simple-start.e2e.ts:622 | OK 测试/覆盖新增，需与主链保持一致 |             status?: string;
ADD e2e/dicethrone-simple-start.e2e.ts:623 | OK 测试/覆盖新增，需与主链保持一致 |         };
ADD e2e/dicethrone-simple-start.e2e.ts:624 | OK 测试/覆盖新增，需与主链保持一致 |         expect(beforeStartMatch.players.map((player) => player.id)).toEqual([0, 1, 2, 3]);
ADD e2e/dicethrone-simple-start.e2e.ts:625 | OK 测试/覆盖新增，需与主链保持一致 |         expect(beforeStartMatch.players.every((player) => !!player.name)).toBe(true);
ADD e2e/dicethrone-simple-start.e2e.ts:626 | OK 测试/覆盖新增，需与主链保持一致 |         expect(beforeStartMatch.status).toBe('playing');
ADD e2e/dicethrone-simple-start.e2e.ts:627 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:628 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[0].page, 'monk');
ADD e2e/dicethrone-simple-start.e2e.ts:629 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[1].page, 'barbarian');
ADD e2e/dicethrone-simple-start.e2e.ts:630 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[2].page, 'pyromancer');
ADD e2e/dicethrone-simple-start.e2e.ts:631 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[3].page, 'paladin');
ADD e2e/dicethrone-simple-start.e2e.ts:632 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:633 | OK 测试/覆盖新增，需与主链保持一致 |         await readyMultiplePlayersAndStartGame(
ADD e2e/dicethrone-simple-start.e2e.ts:634 | OK 测试/覆盖新增，需与主链保持一致 |             hostPage,
ADD e2e/dicethrone-simple-start.e2e.ts:635 | OK 测试/覆盖新增，需与主链保持一致 |             players.slice(1).map((player) => player.page),
ADD e2e/dicethrone-simple-start.e2e.ts:636 | OK 测试/覆盖新增，需与主链保持一致 |         );
ADD e2e/dicethrone-simple-start.e2e.ts:637 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:638 | OK 测试/覆盖新增，需与主链保持一致 |         for (const player of players) {
ADD e2e/dicethrone-simple-start.e2e.ts:639 | OK 测试/覆盖新增，需与主链保持一致 |             await waitForGameBoard(player.page, 30000);
ADD e2e/dicethrone-simple-start.e2e.ts:640 | OK 测试/覆盖新增，需与主链保持一致 |         }
ADD e2e/dicethrone-simple-start.e2e.ts:641 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:642 | OK 测试/覆盖新增，需与主链保持一致 |         await clearEvidenceScreenshotsForTest(testInfo);
ADD e2e/dicethrone-simple-start.e2e.ts:643 | OK 测试/覆盖新增，需与主链保持一致 |         await saveEvidenceScreenshot(hostPage, testInfo, '02-four-player-host-game-started');
ADD e2e/dicethrone-simple-start.e2e.ts:644 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:645 | OK 测试/覆盖新增，需与主链保持一致 |         const afterStartResponse = await hostPage.request.get(`${gameServerBaseURL}/games/dicethrone/${matchId}`);
ADD e2e/dicethrone-simple-start.e2e.ts:646 | OK 测试/覆盖新增，需与主链保持一致 |         expect(afterStartResponse.ok()).toBe(true);
ADD e2e/dicethrone-simple-start.e2e.ts:647 | OK 测试/覆盖新增，需与主链保持一致 |         const afterStartMatch = await afterStartResponse.json() as {
ADD e2e/dicethrone-simple-start.e2e.ts:648 | OK 测试/覆盖新增，需与主链保持一致 |             players: Array<{ id: number; name?: string }>;
ADD e2e/dicethrone-simple-start.e2e.ts:649 | OK 测试/覆盖新增，需与主链保持一致 |             status?: string;
ADD e2e/dicethrone-simple-start.e2e.ts:650 | OK 测试/覆盖新增，需与主链保持一致 |         };
ADD e2e/dicethrone-simple-start.e2e.ts:651 | OK 测试/覆盖新增，需与主链保持一致 |         expect(afterStartMatch.players).toHaveLength(4);
ADD e2e/dicethrone-simple-start.e2e.ts:652 | OK 测试/覆盖新增，需与主链保持一致 |         expect(afterStartMatch.status).toBe('playing');
ADD e2e/dicethrone-simple-start.e2e.ts:653 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.locator('[data-tutorial-id="dice-roll-button"]')).toBeVisible({ timeout: 5000 });
ADD e2e/dicethrone-simple-start.e2e.ts:654 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:655 | OK 测试/覆盖新增，需与主链保持一致 |         await cleanupDTMatch(setup);
ADD e2e/dicethrone-simple-start.e2e.ts:656 | OK 测试/覆盖新增，需与主链保持一致 |     });
ADD e2e/dicethrone-simple-start.e2e.ts:657 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:658 | OK 测试/覆盖新增，需与主链保持一致 |     test('Online 4-player seating panel: host can move to empty slot and occupied seat is rejected', async ({ browser }, testInfo) => {
ADD e2e/dicethrone-simple-start.e2e.ts:659 | OK 测试/覆盖新增，需与主链保持一致 |         test.setTimeout(120000);
ADD e2e/dicethrone-simple-start.e2e.ts:660 | OK 测试/覆盖新增，需与主链保持一致 |         const baseURL = testInfo.project.use.baseURL as string | undefined;
ADD e2e/dicethrone-simple-start.e2e.ts:661 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:662 | OK 测试/覆盖新增，需与主链保持一致 |         const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
ADD e2e/dicethrone-simple-start.e2e.ts:663 | OK 测试/覆盖新增，需与主链保持一致 |             numPlayers: 4,
ADD e2e/dicethrone-simple-start.e2e.ts:664 | OK 测试/覆盖新增，需与主链保持一致 |             gameServerBaseURL: getGameServerBaseURL(),
ADD e2e/dicethrone-simple-start.e2e.ts:665 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD e2e/dicethrone-simple-start.e2e.ts:666 | OK 测试/覆盖新增，需与主链保持一致 |         if (!setup) {
ADD e2e/dicethrone-simple-start.e2e.ts:667 | OK 测试/覆盖新增，需与主链保持一致 |             test.skip(true, '游戏服务器不可用或四人房间创建失败');
ADD e2e/dicethrone-simple-start.e2e.ts:668 | OK 测试/覆盖新增，需与主链保持一致 |             return;
ADD e2e/dicethrone-simple-start.e2e.ts:669 | OK 测试/覆盖新增，需与主链保持一致 |         }
ADD e2e/dicethrone-simple-start.e2e.ts:670 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:671 | OK 测试/覆盖新增，需与主链保持一致 |         const { hostPage } = setup;
ADD e2e/dicethrone-simple-start.e2e.ts:672 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:673 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByText('2v2 Seating')).toBeVisible({ timeout: 10000 });
ADD e2e/dicethrone-simple-start.e2e.ts:674 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByText('Team A')).toBeVisible({ timeout: 5000 });
ADD e2e/dicethrone-simple-start.e2e.ts:675 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByText('P1 / P3')).toBeVisible({ timeout: 5000 });
ADD e2e/dicethrone-simple-start.e2e.ts:676 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByText('Team B')).toBeVisible({ timeout: 5000 });
ADD e2e/dicethrone-simple-start.e2e.ts:677 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByText('P2 / P4')).toBeVisible({ timeout: 5000 });
ADD e2e/dicethrone-simple-start.e2e.ts:678 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:679 | OK 测试/覆盖新增，需与主链保持一致 |         const seatOneButton = hostPage.locator('button')
ADD e2e/dicethrone-simple-start.e2e.ts:680 | OK 测试/覆盖新增，需与主链保持一致 |             .filter({ hasText: 'Seat 1' })
ADD e2e/dicethrone-simple-start.e2e.ts:681 | OK 测试/覆盖新增，需与主链保持一致 |             .filter({ hasText: 'P1' })
ADD e2e/dicethrone-simple-start.e2e.ts:682 | OK 测试/覆盖新增，需与主链保持一致 |             .first();
ADD e2e/dicethrone-simple-start.e2e.ts:683 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(seatOneButton).toBeVisible({ timeout: 5000 });
ADD e2e/dicethrone-simple-start.e2e.ts:684 | OK 测试/覆盖新增，需与主链保持一致 |         await seatOneButton.click();
ADD e2e/dicethrone-simple-start.e2e.ts:685 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:686 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByText('P1 selected. Click an empty slot to finish the move.')).toBeVisible({ timeout: 5000 });
ADD e2e/dicethrone-simple-start.e2e.ts:687 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:688 | OK 测试/覆盖新增，需与主链保持一致 |         const occupiedSeatButton = hostPage.locator('button')
ADD e2e/dicethrone-simple-start.e2e.ts:689 | OK 测试/覆盖新增，需与主链保持一致 |             .filter({ hasText: 'P2' })
ADD e2e/dicethrone-simple-start.e2e.ts:690 | OK 测试/覆盖新增，需与主链保持一致 |             .first();
ADD e2e/dicethrone-simple-start.e2e.ts:691 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(occupiedSeatButton).toBeVisible({ timeout: 5000 });
ADD e2e/dicethrone-simple-start.e2e.ts:692 | OK 测试/覆盖新增，需与主链保持一致 |         await occupiedSeatButton.click();
ADD e2e/dicethrone-simple-start.e2e.ts:693 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:694 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByText('That position is already occupied. Seat swapping is not supported.')).toBeVisible({ timeout: 5000 });
ADD e2e/dicethrone-simple-start.e2e.ts:695 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:696 | OK 测试/覆盖新增，需与主链保持一致 |         const emptySeatThreeButton = hostPage.locator('button')
ADD e2e/dicethrone-simple-start.e2e.ts:697 | OK 测试/覆盖新增，需与主链保持一致 |             .filter({ hasText: 'Empty' })
ADD e2e/dicethrone-simple-start.e2e.ts:698 | OK 测试/覆盖新增，需与主链保持一致 |             .filter({ hasText: 'Seat 3' })
ADD e2e/dicethrone-simple-start.e2e.ts:699 | OK 测试/覆盖新增，需与主链保持一致 |             .first();
ADD e2e/dicethrone-simple-start.e2e.ts:700 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(emptySeatThreeButton).toBeVisible({ timeout: 5000 });
ADD e2e/dicethrone-simple-start.e2e.ts:701 | OK 测试/覆盖新增，需与主链保持一致 |         await emptySeatThreeButton.click();
ADD e2e/dicethrone-simple-start.e2e.ts:702 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:703 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByText('Click a player first, then click an empty slot to move them. Swapping seats is not allowed.')).toBeVisible({ timeout: 5000 });
ADD e2e/dicethrone-simple-start.e2e.ts:704 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByText('P2 / P1')).toBeVisible({ timeout: 5000 });
ADD e2e/dicethrone-simple-start.e2e.ts:705 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByText('P3 / P4')).toBeVisible({ timeout: 5000 });
ADD e2e/dicethrone-simple-start.e2e.ts:706 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:707 | OK 测试/覆盖新增，需与主链保持一致 |         await clearEvidenceScreenshotsForTest(testInfo);
ADD e2e/dicethrone-simple-start.e2e.ts:708 | OK 测试/覆盖新增，需与主链保持一致 |         await saveEvidenceScreenshot(hostPage, testInfo, '03-four-player-seating-panel-moved');
ADD e2e/dicethrone-simple-start.e2e.ts:709 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:710 | OK 测试/覆盖新增，需与主链保持一致 |         await cleanupDTMatch(setup);
ADD e2e/dicethrone-simple-start.e2e.ts:711 | OK 测试/覆盖新增，需与主链保持一致 |     });
ADD e2e/dicethrone-simple-start.e2e.ts:712 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:713 | OK 测试/覆盖新增，需与主链保持一致 |     test('Online 4-player board: top headers show ally and enemy tones correctly', async ({ browser }) => {
ADD e2e/dicethrone-simple-start.e2e.ts:714 | OK 测试/覆盖新增，需与主链保持一致 |         test.setTimeout(120000);
ADD e2e/dicethrone-simple-start.e2e.ts:715 | OK 测试/覆盖新增，需与主链保持一致 |         const baseURL = test.info().project.use.baseURL as string | undefined;
ADD e2e/dicethrone-simple-start.e2e.ts:716 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:717 | OK 测试/覆盖新增，需与主链保持一致 |         const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
ADD e2e/dicethrone-simple-start.e2e.ts:718 | OK 测试/覆盖新增，需与主链保持一致 |             numPlayers: 4,
ADD e2e/dicethrone-simple-start.e2e.ts:719 | OK 测试/覆盖新增，需与主链保持一致 |             gameServerBaseURL: getGameServerBaseURL(),
ADD e2e/dicethrone-simple-start.e2e.ts:720 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD e2e/dicethrone-simple-start.e2e.ts:721 | OK 测试/覆盖新增，需与主链保持一致 |         if (!setup) {
ADD e2e/dicethrone-simple-start.e2e.ts:722 | OK 测试/覆盖新增，需与主链保持一致 |             test.skip(true, '游戏服务器不可用或四人房间创建失败');
ADD e2e/dicethrone-simple-start.e2e.ts:723 | OK 测试/覆盖新增，需与主链保持一致 |             return;
ADD e2e/dicethrone-simple-start.e2e.ts:724 | OK 测试/覆盖新增，需与主链保持一致 |         }
ADD e2e/dicethrone-simple-start.e2e.ts:725 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:726 | OK 测试/覆盖新增，需与主链保持一致 |         const { hostPage, players } = setup;
ADD e2e/dicethrone-simple-start.e2e.ts:727 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:728 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[0].page, 'monk');
ADD e2e/dicethrone-simple-start.e2e.ts:729 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[1].page, 'barbarian');
ADD e2e/dicethrone-simple-start.e2e.ts:730 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[2].page, 'pyromancer');
ADD e2e/dicethrone-simple-start.e2e.ts:731 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[3].page, 'paladin');
ADD e2e/dicethrone-simple-start.e2e.ts:732 | OK 测试/覆盖新增，需与主链保持一致 |         await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));
ADD e2e/dicethrone-simple-start.e2e.ts:733 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:734 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForGameBoard(hostPage);
ADD e2e/dicethrone-simple-start.e2e.ts:735 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForHarnessPages(players.map((player) => player.page));
ADD e2e/dicethrone-simple-start.e2e.ts:736 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:737 | OK 测试/覆盖新增，需与主链保持一致 |         const headerLocator = hostPage.locator('[data-testid^="dt-top-header-"]');
ADD e2e/dicethrone-simple-start.e2e.ts:738 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(headerLocator).toHaveCount(3, { timeout: 10000 });
ADD e2e/dicethrone-simple-start.e2e.ts:739 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-top-header-1')).toHaveAttribute('data-team-tone', 'enemy');
ADD e2e/dicethrone-simple-start.e2e.ts:740 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-top-header-1')).toHaveAttribute('data-player-id', '1');
ADD e2e/dicethrone-simple-start.e2e.ts:741 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-top-header-2')).toHaveAttribute('data-team-tone', 'ally');
ADD e2e/dicethrone-simple-start.e2e.ts:742 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-top-header-2')).toHaveAttribute('data-player-id', '2');
ADD e2e/dicethrone-simple-start.e2e.ts:743 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-top-header-3')).toHaveAttribute('data-team-tone', 'enemy');
ADD e2e/dicethrone-simple-start.e2e.ts:744 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-top-header-3')).toHaveAttribute('data-player-id', '3');
ADD e2e/dicethrone-simple-start.e2e.ts:745 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:746 | OK 测试/覆盖新增，需与主链保持一致 |         await cleanupDTMatch(setup);
ADD e2e/dicethrone-simple-start.e2e.ts:747 | OK 测试/覆盖新增，需与主链保持一致 |     });
ADD e2e/dicethrone-simple-start.e2e.ts:748 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:749 | OK 测试/覆盖新增，需与主链保持一致 |     test('Online 4-player targeting roll: auto targets and choice owners stay correct in 2v2', async ({ browser }, testInfo) => {
ADD e2e/dicethrone-simple-start.e2e.ts:750 | OK 测试/覆盖新增，需与主链保持一致 |         test.setTimeout(120000);
ADD e2e/dicethrone-simple-start.e2e.ts:751 | OK 测试/覆盖新增，需与主链保持一致 |         const baseURL = testInfo.project.use.baseURL as string | undefined;
ADD e2e/dicethrone-simple-start.e2e.ts:752 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:753 | OK 测试/覆盖新增，需与主链保持一致 |         const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
ADD e2e/dicethrone-simple-start.e2e.ts:754 | OK 测试/覆盖新增，需与主链保持一致 |             numPlayers: 4,
ADD e2e/dicethrone-simple-start.e2e.ts:755 | OK 测试/覆盖新增，需与主链保持一致 |             gameServerBaseURL: getGameServerBaseURL(),
ADD e2e/dicethrone-simple-start.e2e.ts:756 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD e2e/dicethrone-simple-start.e2e.ts:757 | OK 测试/覆盖新增，需与主链保持一致 |         if (!setup) {
ADD e2e/dicethrone-simple-start.e2e.ts:758 | OK 测试/覆盖新增，需与主链保持一致 |             test.skip(true, '游戏服务器不可用或四人房间创建失败');
ADD e2e/dicethrone-simple-start.e2e.ts:759 | OK 测试/覆盖新增，需与主链保持一致 |             return;
ADD e2e/dicethrone-simple-start.e2e.ts:760 | OK 测试/覆盖新增，需与主链保持一致 |         }
ADD e2e/dicethrone-simple-start.e2e.ts:761 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:762 | OK 测试/覆盖新增，需与主链保持一致 |         const { hostPage, matchId, players } = setup;
ADD e2e/dicethrone-simple-start.e2e.ts:763 | OK 测试/覆盖新增，需与主链保持一致 |         const defenderCaptainPage = players[3].page;
ADD e2e/dicethrone-simple-start.e2e.ts:764 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:765 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[0].page, 'monk');
ADD e2e/dicethrone-simple-start.e2e.ts:766 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[1].page, 'barbarian');
ADD e2e/dicethrone-simple-start.e2e.ts:767 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[2].page, 'pyromancer');
ADD e2e/dicethrone-simple-start.e2e.ts:768 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[3].page, 'paladin');
ADD e2e/dicethrone-simple-start.e2e.ts:769 | OK 测试/覆盖新增，需与主链保持一致 |         await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));
ADD e2e/dicethrone-simple-start.e2e.ts:770 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:771 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForGameBoard(hostPage);
ADD e2e/dicethrone-simple-start.e2e.ts:772 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForHarnessPages(players.map((player) => player.page));
ADD e2e/dicethrone-simple-start.e2e.ts:773 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:774 | OK 测试/覆盖新增，需与主链保持一致 |         await applyOnlineMatchState(matchId, hostPage, (state) => buildTargetingRollState(state, 2));
ADD e2e/dicethrone-simple-start.e2e.ts:775 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForPhase(hostPage, 'targetingRoll');
ADD e2e/dicethrone-simple-start.e2e.ts:776 | OK 测试/覆盖新增，需与主链保持一致 |         await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');
ADD e2e/dicethrone-simple-start.e2e.ts:777 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForPhase(hostPage, 'defensiveRoll');
ADD e2e/dicethrone-simple-start.e2e.ts:778 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForPendingDefender(hostPage, '3');
ADD e2e/dicethrone-simple-start.e2e.ts:779 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:780 | OK 测试/覆盖新增，需与主链保持一致 |         await applyOnlineMatchState(matchId, hostPage, (state) => buildTargetingRollState(state, 4));
ADD e2e/dicethrone-simple-start.e2e.ts:781 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForPhase(hostPage, 'targetingRoll');
ADD e2e/dicethrone-simple-start.e2e.ts:782 | OK 测试/覆盖新增，需与主链保持一致 |         await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');
ADD e2e/dicethrone-simple-start.e2e.ts:783 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForPhase(hostPage, 'defensiveRoll');
ADD e2e/dicethrone-simple-start.e2e.ts:784 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForPendingDefender(hostPage, '1');
ADD e2e/dicethrone-simple-start.e2e.ts:785 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:786 | OK 测试/覆盖新增，需与主链保持一致 |         await applyOnlineMatchState(matchId, hostPage, (state) => buildTargetingRollState(state, 5));
ADD e2e/dicethrone-simple-start.e2e.ts:787 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForPhase(hostPage, 'targetingRoll');
ADD e2e/dicethrone-simple-start.e2e.ts:788 | OK 测试/覆盖新增，需与主链保持一致 |         await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');
ADD e2e/dicethrone-simple-start.e2e.ts:789 | OK 测试/覆盖新增，需与主链保持一致 |         await defenderCaptainPage.waitForFunction(() => {
ADD e2e/dicethrone-simple-start.e2e.ts:790 | OK 测试/覆盖新增，需与主链保持一致 |             return (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current?.playerId === '3';
ADD e2e/dicethrone-simple-start.e2e.ts:791 | OK 测试/覆盖新增，需与主链保持一致 |         }, { timeout: 10000 });
ADD e2e/dicethrone-simple-start.e2e.ts:792 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(defenderCaptainPage.getByTestId('dt-target-choice-panel')).toBeVisible({ timeout: 10000 });
ADD e2e/dicethrone-simple-start.e2e.ts:793 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(defenderCaptainPage.locator('[data-testid^="dt-target-option-"]')).toHaveCount(3, { timeout: 10000 });
ADD e2e/dicethrone-simple-start.e2e.ts:794 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(defenderCaptainPage.getByTestId('dt-target-option-1')).toHaveAttribute('data-team-tone', 'ally');
ADD e2e/dicethrone-simple-start.e2e.ts:795 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(defenderCaptainPage.getByTestId('dt-target-option-2')).toHaveAttribute('data-team-tone', 'enemy');
ADD e2e/dicethrone-simple-start.e2e.ts:796 | OK 测试/覆盖新增，需与主链保持一致 |         await defenderCaptainPage.getByTestId('dt-target-option-1').click();
ADD e2e/dicethrone-simple-start.e2e.ts:797 | OK 测试/覆盖新增，需与主链保持一致 |         await defenderCaptainPage.waitForFunction(() => {
ADD e2e/dicethrone-simple-start.e2e.ts:798 | OK 测试/覆盖新增，需与主链保持一致 |             const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
ADD e2e/dicethrone-simple-start.e2e.ts:799 | OK 测试/覆盖新增，需与主链保持一致 |             return state?.sys?.phase === 'defensiveRoll' && state?.core?.pendingAttack?.defenderId === '1';
ADD e2e/dicethrone-simple-start.e2e.ts:800 | OK 测试/覆盖新增，需与主链保持一致 |         }, { timeout: 10000 });
ADD e2e/dicethrone-simple-start.e2e.ts:801 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(defenderCaptainPage.getByTestId('dt-target-choice-panel')).toBeHidden({ timeout: 10000 });
ADD e2e/dicethrone-simple-start.e2e.ts:802 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:803 | OK 测试/覆盖新增，需与主链保持一致 |         await applyOnlineMatchState(matchId, hostPage, (state) => buildTargetingRollState(state, 6));
ADD e2e/dicethrone-simple-start.e2e.ts:804 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForPhase(hostPage, 'targetingRoll');
ADD e2e/dicethrone-simple-start.e2e.ts:805 | OK 测试/覆盖新增，需与主链保持一致 |         await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');
ADD e2e/dicethrone-simple-start.e2e.ts:806 | OK 测试/覆盖新增，需与主链保持一致 |         await hostPage.waitForFunction(() => {
ADD e2e/dicethrone-simple-start.e2e.ts:807 | OK 测试/覆盖新增，需与主链保持一致 |             return (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current?.playerId === '0';
ADD e2e/dicethrone-simple-start.e2e.ts:808 | OK 测试/覆盖新增，需与主链保持一致 |         }, { timeout: 10000 });
ADD e2e/dicethrone-simple-start.e2e.ts:809 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-target-choice-panel')).toBeVisible({ timeout: 10000 });
ADD e2e/dicethrone-simple-start.e2e.ts:810 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.locator('[data-testid^="dt-target-option-"]')).toHaveCount(3, { timeout: 10000 });
ADD e2e/dicethrone-simple-start.e2e.ts:811 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-target-option-2')).toHaveAttribute('data-team-tone', 'ally');
ADD e2e/dicethrone-simple-start.e2e.ts:812 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:813 | OK 测试/覆盖新增，需与主链保持一致 |         await clearEvidenceScreenshotsForTest(testInfo);
ADD e2e/dicethrone-simple-start.e2e.ts:814 | OK 测试/覆盖新增，需与主链保持一致 |         await saveEvidenceScreenshot(hostPage, testInfo, '04-four-player-target-choice-panel-host');
ADD e2e/dicethrone-simple-start.e2e.ts:815 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:816 | OK 测试/覆盖新增，需与主链保持一致 |         await hostPage.getByTestId('dt-target-option-1').click();
ADD e2e/dicethrone-simple-start.e2e.ts:817 | OK 测试/覆盖新增，需与主链保持一致 |         await hostPage.waitForFunction(() => {
ADD e2e/dicethrone-simple-start.e2e.ts:818 | OK 测试/覆盖新增，需与主链保持一致 |             const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
ADD e2e/dicethrone-simple-start.e2e.ts:819 | OK 测试/覆盖新增，需与主链保持一致 |             return state?.sys?.phase === 'defensiveRoll' && state?.core?.pendingAttack?.defenderId === '1';
ADD e2e/dicethrone-simple-start.e2e.ts:820 | OK 测试/覆盖新增，需与主链保持一致 |         }, { timeout: 10000 });
ADD e2e/dicethrone-simple-start.e2e.ts:821 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-target-choice-panel')).toBeHidden({ timeout: 10000 });
ADD e2e/dicethrone-simple-start.e2e.ts:822 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:823 | OK 测试/覆盖新增，需与主链保持一致 |         await cleanupDTMatch(setup);
ADD e2e/dicethrone-simple-start.e2e.ts:824 | OK 测试/覆盖新增，需与主链保持一致 |     });
ADD e2e/dicethrone-simple-start.e2e.ts:825 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:826 | OK 测试/覆盖新增，需与主链保持一致 |     test('Online 4-player transfer token: enemy token can be transferred to ally with stable target metadata', async ({ browser }, testInfo) => {
ADD e2e/dicethrone-simple-start.e2e.ts:827 | OK 测试/覆盖新增，需与主链保持一致 |         test.setTimeout(150000);
ADD e2e/dicethrone-simple-start.e2e.ts:828 | OK 测试/覆盖新增，需与主链保持一致 |         const baseURL = testInfo.project.use.baseURL as string | undefined;
ADD e2e/dicethrone-simple-start.e2e.ts:829 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:830 | OK 测试/覆盖新增，需与主链保持一致 |         const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
ADD e2e/dicethrone-simple-start.e2e.ts:831 | OK 测试/覆盖新增，需与主链保持一致 |             numPlayers: 4,
ADD e2e/dicethrone-simple-start.e2e.ts:832 | OK 测试/覆盖新增，需与主链保持一致 |             gameServerBaseURL: getGameServerBaseURL(),
ADD e2e/dicethrone-simple-start.e2e.ts:833 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD e2e/dicethrone-simple-start.e2e.ts:834 | OK 测试/覆盖新增，需与主链保持一致 |         if (!setup) {
ADD e2e/dicethrone-simple-start.e2e.ts:835 | OK 测试/覆盖新增，需与主链保持一致 |             test.skip(true, '游戏服务器不可用或四人房间创建失败');
ADD e2e/dicethrone-simple-start.e2e.ts:836 | OK 测试/覆盖新增，需与主链保持一致 |             return;
ADD e2e/dicethrone-simple-start.e2e.ts:837 | OK 测试/覆盖新增，需与主链保持一致 |         }
ADD e2e/dicethrone-simple-start.e2e.ts:838 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:839 | OK 测试/覆盖新增，需与主链保持一致 |         const { hostPage, matchId, players } = setup;
ADD e2e/dicethrone-simple-start.e2e.ts:840 | OK 测试/覆盖新增，需与主链保持一致 |         const allyPage = players[2].page;
ADD e2e/dicethrone-simple-start.e2e.ts:841 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:842 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[0].page, 'shadow_thief');
ADD e2e/dicethrone-simple-start.e2e.ts:843 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[1].page, 'paladin');
ADD e2e/dicethrone-simple-start.e2e.ts:844 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[2].page, 'monk');
ADD e2e/dicethrone-simple-start.e2e.ts:845 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[3].page, 'pyromancer');
ADD e2e/dicethrone-simple-start.e2e.ts:846 | OK 测试/覆盖新增，需与主链保持一致 |         await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));
ADD e2e/dicethrone-simple-start.e2e.ts:847 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:848 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForGameBoard(hostPage);
ADD e2e/dicethrone-simple-start.e2e.ts:849 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForHarnessPages(players.map((player) => player.page));
ADD e2e/dicethrone-simple-start.e2e.ts:850 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:851 | OK 测试/覆盖新增，需与主链保持一致 |         await applyOnlineMatchState(matchId, hostPage, buildFourPlayerTransferTokenState);
ADD e2e/dicethrone-simple-start.e2e.ts:852 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForPhase(hostPage, 'main1');
ADD e2e/dicethrone-simple-start.e2e.ts:853 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:854 | OK 测试/覆盖新增，需与主链保持一致 |         await dispatchHarnessCommand(hostPage, 'PLAY_CARD', '0', { cardId: 'transfer-inst' });
ADD e2e/dicethrone-simple-start.e2e.ts:855 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-status-owner-1')).toHaveAttribute('data-team-tone', 'enemy');
ADD e2e/dicethrone-simple-start.e2e.ts:856 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-status-owner-2')).toHaveAttribute('data-team-tone', 'ally');
ADD e2e/dicethrone-simple-start.e2e.ts:857 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-status-effect-1-crit')).toBeVisible({ timeout: 10000 });
ADD e2e/dicethrone-simple-start.e2e.ts:858 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:859 | OK 测试/覆盖新增，需与主链保持一致 |         await hostPage.getByTestId('dt-status-effect-1-crit').click();
ADD e2e/dicethrone-simple-start.e2e.ts:860 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-transfer-target-0')).toHaveAttribute('data-team-tone', 'self');
ADD e2e/dicethrone-simple-start.e2e.ts:861 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-transfer-source-locked-1')).toHaveAttribute('data-team-tone', 'enemy');
ADD e2e/dicethrone-simple-start.e2e.ts:862 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-transfer-source-locked-1')).toHaveAttribute('data-locked', 'true');
ADD e2e/dicethrone-simple-start.e2e.ts:863 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-transfer-target-2')).toHaveAttribute('data-team-tone', 'ally');
ADD e2e/dicethrone-simple-start.e2e.ts:864 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-transfer-target-3')).toHaveAttribute('data-team-tone', 'enemy');
ADD e2e/dicethrone-simple-start.e2e.ts:865 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:866 | OK 测试/覆盖新增，需与主链保持一致 |         await clearEvidenceScreenshotsForTest(testInfo);
ADD e2e/dicethrone-simple-start.e2e.ts:867 | OK 测试/覆盖新增，需与主链保持一致 |         await saveEvidenceScreenshot(hostPage, testInfo, '06-four-player-transfer-token-target-selection');
ADD e2e/dicethrone-simple-start.e2e.ts:868 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:869 | OK 测试/覆盖新增，需与主链保持一致 |         await hostPage.getByTestId('dt-transfer-target-2').click();
ADD e2e/dicethrone-simple-start.e2e.ts:870 | OK 测试/覆盖新增，需与主链保持一致 |         await hostPage.getByRole('button', { name: /Confirm|确认/i }).last().click();
ADD e2e/dicethrone-simple-start.e2e.ts:871 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:872 | OK 测试/覆盖新增，需与主链保持一致 |         await hostPage.waitForFunction(() => {
ADD e2e/dicethrone-simple-start.e2e.ts:873 | OK 测试/覆盖新增，需与主链保持一致 |             const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
ADD e2e/dicethrone-simple-start.e2e.ts:874 | OK 测试/覆盖新增，需与主链保持一致 |             return !state?.sys?.interaction?.current
ADD e2e/dicethrone-simple-start.e2e.ts:875 | OK 测试/覆盖新增，需与主链保持一致 |                 && (state?.core?.players?.['1']?.tokens?.crit ?? 0) === 0
ADD e2e/dicethrone-simple-start.e2e.ts:876 | OK 测试/覆盖新增，需与主链保持一致 |                 && (state?.core?.players?.['2']?.tokens?.crit ?? 0) === 1;
ADD e2e/dicethrone-simple-start.e2e.ts:877 | OK 测试/覆盖新增，需与主链保持一致 |         }, undefined, { timeout: 10000 });
ADD e2e/dicethrone-simple-start.e2e.ts:878 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:879 | OK 测试/覆盖新增，需与主链保持一致 |         const hostState = await readHarnessState<any>(hostPage);
ADD e2e/dicethrone-simple-start.e2e.ts:880 | OK 测试/覆盖新增，需与主链保持一致 |         const allyState = await readHarnessState<any>(allyPage);
ADD e2e/dicethrone-simple-start.e2e.ts:881 | OK 测试/覆盖新增，需与主链保持一致 |         expect(hostState.core.players['1'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(0);
ADD e2e/dicethrone-simple-start.e2e.ts:882 | OK 测试/覆盖新增，需与主链保持一致 |         expect(hostState.core.players['2'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(1);
ADD e2e/dicethrone-simple-start.e2e.ts:883 | OK 测试/覆盖新增，需与主链保持一致 |         expect(hostState.sys.interaction?.current).toBeUndefined();
ADD e2e/dicethrone-simple-start.e2e.ts:884 | OK 测试/覆盖新增，需与主链保持一致 |         expect(allyState.core.players['2'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(1);
ADD e2e/dicethrone-simple-start.e2e.ts:885 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:886 | OK 测试/覆盖新增，需与主链保持一致 |         await cleanupDTMatch(setup);
ADD e2e/dicethrone-simple-start.e2e.ts:887 | OK 测试/覆盖新增，需与主链保持一致 |     });
ADD e2e/dicethrone-simple-start.e2e.ts:888 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:889 | OK 测试/覆盖新增，需与主链保持一致 |     test('Online 4-player grant tokens: Consecrate can grant four tokens to ally with stable target metadata', async ({ browser }, testInfo) => {
ADD e2e/dicethrone-simple-start.e2e.ts:890 | OK 测试/覆盖新增，需与主链保持一致 |         test.setTimeout(150000);
ADD e2e/dicethrone-simple-start.e2e.ts:891 | OK 测试/覆盖新增，需与主链保持一致 |         const baseURL = testInfo.project.use.baseURL as string | undefined;
ADD e2e/dicethrone-simple-start.e2e.ts:892 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:893 | OK 测试/覆盖新增，需与主链保持一致 |         const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
ADD e2e/dicethrone-simple-start.e2e.ts:894 | OK 测试/覆盖新增，需与主链保持一致 |             numPlayers: 4,
ADD e2e/dicethrone-simple-start.e2e.ts:895 | OK 测试/覆盖新增，需与主链保持一致 |             gameServerBaseURL: getGameServerBaseURL(),
ADD e2e/dicethrone-simple-start.e2e.ts:896 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD e2e/dicethrone-simple-start.e2e.ts:897 | OK 测试/覆盖新增，需与主链保持一致 |         if (!setup) {
ADD e2e/dicethrone-simple-start.e2e.ts:898 | OK 测试/覆盖新增，需与主链保持一致 |             test.skip(true, '游戏服务器不可用或四人房间创建失败');
ADD e2e/dicethrone-simple-start.e2e.ts:899 | OK 测试/覆盖新增，需与主链保持一致 |             return;
ADD e2e/dicethrone-simple-start.e2e.ts:900 | OK 测试/覆盖新增，需与主链保持一致 |         }
ADD e2e/dicethrone-simple-start.e2e.ts:901 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:902 | OK 测试/覆盖新增，需与主链保持一致 |         const { hostPage, matchId, players } = setup;
ADD e2e/dicethrone-simple-start.e2e.ts:903 | OK 测试/覆盖新增，需与主链保持一致 |         const allyPage = players[2].page;
ADD e2e/dicethrone-simple-start.e2e.ts:904 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:905 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[0].page, 'paladin');
ADD e2e/dicethrone-simple-start.e2e.ts:906 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[1].page, 'barbarian');
ADD e2e/dicethrone-simple-start.e2e.ts:907 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[2].page, 'monk');
ADD e2e/dicethrone-simple-start.e2e.ts:908 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[3].page, 'pyromancer');
ADD e2e/dicethrone-simple-start.e2e.ts:909 | OK 测试/覆盖新增，需与主链保持一致 |         await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));
ADD e2e/dicethrone-simple-start.e2e.ts:910 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:911 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForGameBoard(hostPage);
ADD e2e/dicethrone-simple-start.e2e.ts:912 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForHarnessPages(players.map((player) => player.page));
ADD e2e/dicethrone-simple-start.e2e.ts:913 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:914 | OK 测试/覆盖新增，需与主链保持一致 |         await applyOnlineMatchState(matchId, hostPage, buildFourPlayerConsecrateState);
ADD e2e/dicethrone-simple-start.e2e.ts:915 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForPhase(hostPage, 'main1');
ADD e2e/dicethrone-simple-start.e2e.ts:916 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:917 | OK 测试/覆盖新增，需与主链保持一致 |         await dispatchHarnessCommand(hostPage, 'PLAY_CARD', '0', { cardId: 'consecrate-inst' });
ADD e2e/dicethrone-simple-start.e2e.ts:918 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-player-target-0')).toHaveAttribute('data-team-tone', 'self');
ADD e2e/dicethrone-simple-start.e2e.ts:919 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-player-target-1')).toHaveAttribute('data-team-tone', 'enemy');
ADD e2e/dicethrone-simple-start.e2e.ts:920 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-player-target-2')).toHaveAttribute('data-team-tone', 'ally');
ADD e2e/dicethrone-simple-start.e2e.ts:921 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-player-target-3')).toHaveAttribute('data-team-tone', 'enemy');
ADD e2e/dicethrone-simple-start.e2e.ts:922 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:923 | OK 测试/覆盖新增，需与主链保持一致 |         await clearEvidenceScreenshotsForTest(testInfo);
ADD e2e/dicethrone-simple-start.e2e.ts:924 | OK 测试/覆盖新增，需与主链保持一致 |         await saveEvidenceScreenshot(hostPage, testInfo, '07-four-player-consecrate-target-selection');
ADD e2e/dicethrone-simple-start.e2e.ts:925 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:926 | OK 测试/覆盖新增，需与主链保持一致 |         await hostPage.getByTestId('dt-player-target-2').click();
ADD e2e/dicethrone-simple-start.e2e.ts:927 | OK 测试/覆盖新增，需与主链保持一致 |         await hostPage.getByRole('button', { name: /Confirm|确认/i }).last().click();
ADD e2e/dicethrone-simple-start.e2e.ts:928 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:929 | OK 测试/覆盖新增，需与主链保持一致 |         await hostPage.waitForFunction(() => {
ADD e2e/dicethrone-simple-start.e2e.ts:930 | OK 测试/覆盖新增，需与主链保持一致 |             const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
ADD e2e/dicethrone-simple-start.e2e.ts:931 | OK 测试/覆盖新增，需与主链保持一致 |             const allyTokens = state?.core?.players?.['2']?.tokens ?? {};
ADD e2e/dicethrone-simple-start.e2e.ts:932 | OK 测试/覆盖新增，需与主链保持一致 |             return !state?.sys?.interaction?.current
ADD e2e/dicethrone-simple-start.e2e.ts:933 | OK 测试/覆盖新增，需与主链保持一致 |                 && (allyTokens.protect ?? 0) === 1
ADD e2e/dicethrone-simple-start.e2e.ts:934 | OK 测试/覆盖新增，需与主链保持一致 |                 && (allyTokens.retribution ?? 0) === 1
ADD e2e/dicethrone-simple-start.e2e.ts:935 | OK 测试/覆盖新增，需与主链保持一致 |                 && (allyTokens.crit ?? 0) === 1
ADD e2e/dicethrone-simple-start.e2e.ts:936 | OK 测试/覆盖新增，需与主链保持一致 |                 && (allyTokens.accuracy ?? 0) === 1;
ADD e2e/dicethrone-simple-start.e2e.ts:937 | OK 测试/覆盖新增，需与主链保持一致 |         }, undefined, { timeout: 10000 });
ADD e2e/dicethrone-simple-start.e2e.ts:938 | OK 测试/覆盖新增，需与主链保持一致 |         await allyPage.waitForFunction(() => {
ADD e2e/dicethrone-simple-start.e2e.ts:939 | OK 测试/覆盖新增，需与主链保持一致 |             const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
ADD e2e/dicethrone-simple-start.e2e.ts:940 | OK 测试/覆盖新增，需与主链保持一致 |             const allyTokens = state?.core?.players?.['2']?.tokens ?? {};
ADD e2e/dicethrone-simple-start.e2e.ts:941 | OK 测试/覆盖新增，需与主链保持一致 |             return (allyTokens.protect ?? 0) === 1
ADD e2e/dicethrone-simple-start.e2e.ts:942 | OK 测试/覆盖新增，需与主链保持一致 |                 && (allyTokens.retribution ?? 0) === 1
ADD e2e/dicethrone-simple-start.e2e.ts:943 | OK 测试/覆盖新增，需与主链保持一致 |                 && (allyTokens.crit ?? 0) === 1
ADD e2e/dicethrone-simple-start.e2e.ts:944 | OK 测试/覆盖新增，需与主链保持一致 |                 && (allyTokens.accuracy ?? 0) === 1;
ADD e2e/dicethrone-simple-start.e2e.ts:945 | OK 测试/覆盖新增，需与主链保持一致 |         }, undefined, { timeout: 10000 });
ADD e2e/dicethrone-simple-start.e2e.ts:946 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:947 | OK 测试/覆盖新增，需与主链保持一致 |         const hostState = await readHarnessState<any>(hostPage);
ADD e2e/dicethrone-simple-start.e2e.ts:948 | OK 测试/覆盖新增，需与主链保持一致 |         const allyState = await readHarnessState<any>(allyPage);
ADD e2e/dicethrone-simple-start.e2e.ts:949 | OK 测试/覆盖新增，需与主链保持一致 |         for (const tokenId of [TOKEN_IDS.PROTECT, TOKEN_IDS.RETRIBUTION, TOKEN_IDS.CRIT, TOKEN_IDS.ACCURACY]) {
ADD e2e/dicethrone-simple-start.e2e.ts:950 | OK 测试/覆盖新增，需与主链保持一致 |             expect(hostState.core.players['2'].tokens[tokenId] ?? 0).toBe(1);
ADD e2e/dicethrone-simple-start.e2e.ts:951 | OK 测试/覆盖新增，需与主链保持一致 |             expect(allyState.core.players['2'].tokens[tokenId] ?? 0).toBe(1);
ADD e2e/dicethrone-simple-start.e2e.ts:952 | OK 测试/覆盖新增，需与主链保持一致 |         }
ADD e2e/dicethrone-simple-start.e2e.ts:953 | OK 测试/覆盖新增，需与主链保持一致 |         expect(hostState.sys.interaction?.current).toBeUndefined();
ADD e2e/dicethrone-simple-start.e2e.ts:954 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:955 | OK 测试/覆盖新增，需与主链保持一致 |         await cleanupDTMatch(setup);
ADD e2e/dicethrone-simple-start.e2e.ts:956 | OK 测试/覆盖新增，需与主链保持一致 |     });
ADD e2e/dicethrone-simple-start.e2e.ts:957 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:958 | OK 测试/覆盖新增，需与主链保持一致 |     test('Online 4-player ability grant token: Vengeance II can grant Retribution to ally with stable target metadata', async ({ browser }, testInfo) => {
ADD e2e/dicethrone-simple-start.e2e.ts:959 | OK 测试/覆盖新增，需与主链保持一致 |         test.setTimeout(150000);
ADD e2e/dicethrone-simple-start.e2e.ts:960 | OK 测试/覆盖新增，需与主链保持一致 |         const baseURL = testInfo.project.use.baseURL as string | undefined;
ADD e2e/dicethrone-simple-start.e2e.ts:961 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:962 | OK 测试/覆盖新增，需与主链保持一致 |         const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
ADD e2e/dicethrone-simple-start.e2e.ts:963 | OK 测试/覆盖新增，需与主链保持一致 |             numPlayers: 4,
ADD e2e/dicethrone-simple-start.e2e.ts:964 | OK 测试/覆盖新增，需与主链保持一致 |             gameServerBaseURL: getGameServerBaseURL(),
ADD e2e/dicethrone-simple-start.e2e.ts:965 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD e2e/dicethrone-simple-start.e2e.ts:966 | OK 测试/覆盖新增，需与主链保持一致 |         if (!setup) {
ADD e2e/dicethrone-simple-start.e2e.ts:967 | OK 测试/覆盖新增，需与主链保持一致 |             test.skip(true, '游戏服务器不可用或四人房间创建失败');
ADD e2e/dicethrone-simple-start.e2e.ts:968 | OK 测试/覆盖新增，需与主链保持一致 |             return;
ADD e2e/dicethrone-simple-start.e2e.ts:969 | OK 测试/覆盖新增，需与主链保持一致 |         }
ADD e2e/dicethrone-simple-start.e2e.ts:970 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:971 | OK 测试/覆盖新增，需与主链保持一致 |         const { hostPage, matchId, players } = setup;
ADD e2e/dicethrone-simple-start.e2e.ts:972 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:973 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[0].page, 'paladin');
ADD e2e/dicethrone-simple-start.e2e.ts:974 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[1].page, 'barbarian');
ADD e2e/dicethrone-simple-start.e2e.ts:975 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[2].page, 'monk');
ADD e2e/dicethrone-simple-start.e2e.ts:976 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[3].page, 'pyromancer');
ADD e2e/dicethrone-simple-start.e2e.ts:977 | OK 测试/覆盖新增，需与主链保持一致 |         await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));
ADD e2e/dicethrone-simple-start.e2e.ts:978 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:979 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForGameBoard(hostPage);
ADD e2e/dicethrone-simple-start.e2e.ts:980 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForHarnessPages(players.map((player) => player.page));
ADD e2e/dicethrone-simple-start.e2e.ts:981 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:982 | OK 测试/覆盖新增，需与主链保持一致 |         await applyOnlineMatchState(matchId, hostPage, buildFourPlayerVengeance2State);
ADD e2e/dicethrone-simple-start.e2e.ts:983 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForPhase(hostPage, 'offensiveRoll');
ADD e2e/dicethrone-simple-start.e2e.ts:984 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:985 | OK 测试/覆盖新增，需与主链保持一致 |         const vengeanceDebugState = await readHarnessState<any>(hostPage);
ADD e2e/dicethrone-simple-start.e2e.ts:986 | OK 测试/覆盖新增，需与主链保持一致 |         const availableAbilities = vengeanceDebugState.core.players['0'].abilities.map((ability: any) => ({
ADD e2e/dicethrone-simple-start.e2e.ts:987 | OK 测试/覆盖新增，需与主链保持一致 |             id: ability.id,
ADD e2e/dicethrone-simple-start.e2e.ts:988 | OK 测试/覆盖新增，需与主链保持一致 |             variantIds: (ability.variants ?? []).map((variant: any) => variant.id),
ADD e2e/dicethrone-simple-start.e2e.ts:989 | OK 测试/覆盖新增，需与主链保持一致 |         }));
ADD e2e/dicethrone-simple-start.e2e.ts:990 | OK 测试/覆盖新增，需与主链保持一致 |         const availableAbilityIds = getAvailableAbilityIds(
ADD e2e/dicethrone-simple-start.e2e.ts:991 | OK 测试/覆盖新增，需与主链保持一致 |             vengeanceDebugState.core,
ADD e2e/dicethrone-simple-start.e2e.ts:992 | OK 测试/覆盖新增，需与主链保持一致 |             '0',
ADD e2e/dicethrone-simple-start.e2e.ts:993 | OK 测试/覆盖新增，需与主链保持一致 |             vengeanceDebugState.sys.phase,
ADD e2e/dicethrone-simple-start.e2e.ts:994 | OK 测试/覆盖新增，需与主链保持一致 |         );
ADD e2e/dicethrone-simple-start.e2e.ts:995 | OK 测试/覆盖新增，需与主链保持一致 |         testInfo.annotations.push({
ADD e2e/dicethrone-simple-start.e2e.ts:996 | OK 测试/覆盖新增，需与主链保持一致 |             type: 'vengeance-debug',
ADD e2e/dicethrone-simple-start.e2e.ts:997 | OK 测试/覆盖新增，需与主链保持一致 |             description: JSON.stringify({ availableAbilities, availableAbilityIds }),
ADD e2e/dicethrone-simple-start.e2e.ts:998 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD e2e/dicethrone-simple-start.e2e.ts:999 | OK 测试/覆盖新增，需与主链保持一致 |         expect(availableAbilityIds, `Vengeance II 可用技能集异常: ${JSON.stringify({ availableAbilities, availableAbilityIds })}`)
ADD e2e/dicethrone-simple-start.e2e.ts:1000 | OK 测试/覆盖新增，需与主链保持一致 |             .toContain('vengeance-2-main');
ADD e2e/dicethrone-simple-start.e2e.ts:1001 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1002 | OK 测试/覆盖新增，需与主链保持一致 |         await dispatchHarnessCommand(hostPage, 'SELECT_ABILITY', '0', { abilityId: 'vengeance-2-main' });
ADD e2e/dicethrone-simple-start.e2e.ts:1003 | OK 测试/覆盖新增，需与主链保持一致 |         await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');
ADD e2e/dicethrone-simple-start.e2e.ts:1004 | OK 测试/覆盖新增，需与主链保持一致 |         await hostPage.waitForFunction(() => {
ADD e2e/dicethrone-simple-start.e2e.ts:1005 | OK 测试/覆盖新增，需与主链保持一致 |             const current = (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current;
ADD e2e/dicethrone-simple-start.e2e.ts:1006 | OK 测试/覆盖新增，需与主链保持一致 |             return current?.kind === 'dt:card-interaction' && current?.playerId === '0';
ADD e2e/dicethrone-simple-start.e2e.ts:1007 | OK 测试/覆盖新增，需与主链保持一致 |         }, undefined, { timeout: 10000 });
ADD e2e/dicethrone-simple-start.e2e.ts:1008 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-player-target-0')).toHaveAttribute('data-team-tone', 'self');
ADD e2e/dicethrone-simple-start.e2e.ts:1009 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-player-target-1')).toHaveAttribute('data-team-tone', 'enemy');
ADD e2e/dicethrone-simple-start.e2e.ts:1010 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-player-target-2')).toHaveAttribute('data-team-tone', 'ally');
ADD e2e/dicethrone-simple-start.e2e.ts:1011 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-player-target-3')).toHaveAttribute('data-team-tone', 'enemy');
ADD e2e/dicethrone-simple-start.e2e.ts:1012 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1013 | OK 测试/覆盖新增，需与主链保持一致 |         await clearEvidenceScreenshotsForTest(testInfo);
ADD e2e/dicethrone-simple-start.e2e.ts:1014 | OK 测试/覆盖新增，需与主链保持一致 |         await saveEvidenceScreenshot(hostPage, testInfo, '10-four-player-vengeance-2-target-selection');
ADD e2e/dicethrone-simple-start.e2e.ts:1015 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1016 | OK 测试/覆盖新增，需与主链保持一致 |         await hostPage.getByTestId('dt-player-target-2').click();
ADD e2e/dicethrone-simple-start.e2e.ts:1017 | OK 测试/覆盖新增，需与主链保持一致 |         await hostPage.getByRole('button', { name: /Confirm|确认/i }).last().click();
ADD e2e/dicethrone-simple-start.e2e.ts:1018 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1019 | OK 测试/覆盖新增，需与主链保持一致 |         await hostPage.waitForFunction(() => {
ADD e2e/dicethrone-simple-start.e2e.ts:1020 | OK 测试/覆盖新增，需与主链保持一致 |             const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
ADD e2e/dicethrone-simple-start.e2e.ts:1021 | OK 测试/覆盖新增，需与主链保持一致 |             return !state?.sys?.interaction?.current
ADD e2e/dicethrone-simple-start.e2e.ts:1022 | OK 测试/覆盖新增，需与主链保持一致 |                 && (state?.core?.players?.['2']?.tokens?.retribution ?? 0) === 1;
ADD e2e/dicethrone-simple-start.e2e.ts:1023 | OK 测试/覆盖新增，需与主链保持一致 |         }, undefined, { timeout: 10000 });
ADD e2e/dicethrone-simple-start.e2e.ts:1024 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1025 | OK 测试/覆盖新增，需与主链保持一致 |         const hostState = await readHarnessState<any>(hostPage);
ADD e2e/dicethrone-simple-start.e2e.ts:1026 | OK 测试/覆盖新增，需与主链保持一致 |         expect(hostState.core.players['2'].tokens[TOKEN_IDS.RETRIBUTION] ?? 0).toBe(1);
ADD e2e/dicethrone-simple-start.e2e.ts:1027 | OK 测试/覆盖新增，需与主链保持一致 |         expect(hostState.sys.interaction?.current).toBeUndefined();
ADD e2e/dicethrone-simple-start.e2e.ts:1028 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1029 | OK 测试/覆盖新增，需与主链保持一致 |         await cleanupDTMatch(setup);
ADD e2e/dicethrone-simple-start.e2e.ts:1030 | OK 测试/覆盖新增，需与主链保持一致 |     });
ADD e2e/dicethrone-simple-start.e2e.ts:1031 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1032 | OK 测试/覆盖新增，需与主链保持一致 |     test('Online 4-player remove single status: remove-status-1 can remove enemy token with stable owner metadata', async ({ browser }, testInfo) => {
ADD e2e/dicethrone-simple-start.e2e.ts:1033 | OK 测试/覆盖新增，需与主链保持一致 |         test.setTimeout(150000);
ADD e2e/dicethrone-simple-start.e2e.ts:1034 | OK 测试/覆盖新增，需与主链保持一致 |         const baseURL = testInfo.project.use.baseURL as string | undefined;
ADD e2e/dicethrone-simple-start.e2e.ts:1035 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1036 | OK 测试/覆盖新增，需与主链保持一致 |         const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
ADD e2e/dicethrone-simple-start.e2e.ts:1037 | OK 测试/覆盖新增，需与主链保持一致 |             numPlayers: 4,
ADD e2e/dicethrone-simple-start.e2e.ts:1038 | OK 测试/覆盖新增，需与主链保持一致 |             gameServerBaseURL: getGameServerBaseURL(),
ADD e2e/dicethrone-simple-start.e2e.ts:1039 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD e2e/dicethrone-simple-start.e2e.ts:1040 | OK 测试/覆盖新增，需与主链保持一致 |         if (!setup) {
ADD e2e/dicethrone-simple-start.e2e.ts:1041 | OK 测试/覆盖新增，需与主链保持一致 |             test.skip(true, '游戏服务器不可用或四人房间创建失败');
ADD e2e/dicethrone-simple-start.e2e.ts:1042 | OK 测试/覆盖新增，需与主链保持一致 |             return;
ADD e2e/dicethrone-simple-start.e2e.ts:1043 | OK 测试/覆盖新增，需与主链保持一致 |         }
ADD e2e/dicethrone-simple-start.e2e.ts:1044 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1045 | OK 测试/覆盖新增，需与主链保持一致 |         const { hostPage, matchId, players } = setup;
ADD e2e/dicethrone-simple-start.e2e.ts:1046 | OK 测试/覆盖新增，需与主链保持一致 |         const targetPage = players[1].page;
ADD e2e/dicethrone-simple-start.e2e.ts:1047 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1048 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[0].page, 'shadow_thief');
ADD e2e/dicethrone-simple-start.e2e.ts:1049 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[1].page, 'paladin');
ADD e2e/dicethrone-simple-start.e2e.ts:1050 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[2].page, 'monk');
ADD e2e/dicethrone-simple-start.e2e.ts:1051 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[3].page, 'pyromancer');
ADD e2e/dicethrone-simple-start.e2e.ts:1052 | OK 测试/覆盖新增，需与主链保持一致 |         await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));
ADD e2e/dicethrone-simple-start.e2e.ts:1053 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1054 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForGameBoard(hostPage);
ADD e2e/dicethrone-simple-start.e2e.ts:1055 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForHarnessPages(players.map((player) => player.page));
ADD e2e/dicethrone-simple-start.e2e.ts:1056 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1057 | OK 测试/覆盖新增，需与主链保持一致 |         await applyOnlineMatchState(matchId, hostPage, buildFourPlayerRemoveSingleStatusState);
ADD e2e/dicethrone-simple-start.e2e.ts:1058 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForPhase(hostPage, 'main1');
ADD e2e/dicethrone-simple-start.e2e.ts:1059 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1060 | OK 测试/覆盖新增，需与主链保持一致 |         await dispatchHarnessCommand(hostPage, 'PLAY_CARD', '0', { cardId: 'remove-single-inst' });
ADD e2e/dicethrone-simple-start.e2e.ts:1061 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-status-owner-0')).toHaveAttribute('data-team-tone', 'self');
ADD e2e/dicethrone-simple-start.e2e.ts:1062 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-status-owner-1')).toHaveAttribute('data-team-tone', 'enemy');
ADD e2e/dicethrone-simple-start.e2e.ts:1063 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-status-owner-2')).toHaveAttribute('data-team-tone', 'ally');
ADD e2e/dicethrone-simple-start.e2e.ts:1064 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-status-owner-3')).toHaveAttribute('data-team-tone', 'enemy');
ADD e2e/dicethrone-simple-start.e2e.ts:1065 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-status-effect-1-crit')).toBeVisible({ timeout: 10000 });
ADD e2e/dicethrone-simple-start.e2e.ts:1066 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1067 | OK 测试/覆盖新增，需与主链保持一致 |         await clearEvidenceScreenshotsForTest(testInfo);
ADD e2e/dicethrone-simple-start.e2e.ts:1068 | OK 测试/覆盖新增，需与主链保持一致 |         await saveEvidenceScreenshot(hostPage, testInfo, '08-four-player-remove-single-status-selection');
ADD e2e/dicethrone-simple-start.e2e.ts:1069 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1070 | OK 测试/覆盖新增，需与主链保持一致 |         await hostPage.getByTestId('dt-status-effect-1-crit').click();
ADD e2e/dicethrone-simple-start.e2e.ts:1071 | OK 测试/覆盖新增，需与主链保持一致 |         await hostPage.getByRole('button', { name: /Confirm|确认/i }).last().click();
ADD e2e/dicethrone-simple-start.e2e.ts:1072 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1073 | OK 测试/覆盖新增，需与主链保持一致 |         await hostPage.waitForFunction(() => {
ADD e2e/dicethrone-simple-start.e2e.ts:1074 | OK 测试/覆盖新增，需与主链保持一致 |             const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
ADD e2e/dicethrone-simple-start.e2e.ts:1075 | OK 测试/覆盖新增，需与主链保持一致 |             return !state?.sys?.interaction?.current
ADD e2e/dicethrone-simple-start.e2e.ts:1076 | OK 测试/覆盖新增，需与主链保持一致 |                 && (state?.core?.players?.['1']?.tokens?.crit ?? 0) === 0;
ADD e2e/dicethrone-simple-start.e2e.ts:1077 | OK 测试/覆盖新增，需与主链保持一致 |         }, undefined, { timeout: 10000 });
ADD e2e/dicethrone-simple-start.e2e.ts:1078 | OK 测试/覆盖新增，需与主链保持一致 |         await targetPage.waitForFunction(() => {
ADD e2e/dicethrone-simple-start.e2e.ts:1079 | OK 测试/覆盖新增，需与主链保持一致 |             const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
ADD e2e/dicethrone-simple-start.e2e.ts:1080 | OK 测试/覆盖新增，需与主链保持一致 |             return (state?.core?.players?.['1']?.tokens?.crit ?? 0) === 0;
ADD e2e/dicethrone-simple-start.e2e.ts:1081 | OK 测试/覆盖新增，需与主链保持一致 |         }, undefined, { timeout: 10000 });
ADD e2e/dicethrone-simple-start.e2e.ts:1082 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1083 | OK 测试/覆盖新增，需与主链保持一致 |         const hostState = await readHarnessState<any>(hostPage);
ADD e2e/dicethrone-simple-start.e2e.ts:1084 | OK 测试/覆盖新增，需与主链保持一致 |         const targetState = await readHarnessState<any>(targetPage);
ADD e2e/dicethrone-simple-start.e2e.ts:1085 | OK 测试/覆盖新增，需与主链保持一致 |         expect(hostState.core.players['1'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(0);
ADD e2e/dicethrone-simple-start.e2e.ts:1086 | OK 测试/覆盖新增，需与主链保持一致 |         expect(targetState.core.players['1'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(0);
ADD e2e/dicethrone-simple-start.e2e.ts:1087 | OK 测试/覆盖新增，需与主链保持一致 |         expect(hostState.sys.interaction?.current).toBeUndefined();
ADD e2e/dicethrone-simple-start.e2e.ts:1088 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1089 | OK 测试/覆盖新增，需与主链保持一致 |         await cleanupDTMatch(setup);
ADD e2e/dicethrone-simple-start.e2e.ts:1090 | OK 测试/覆盖新增，需与主链保持一致 |     });
ADD e2e/dicethrone-simple-start.e2e.ts:1091 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1092 | OK 测试/覆盖新增，需与主链保持一致 |     test('Online 4-player remove all status: remove-all-status blocks empty targets and clears enemy removable effects', async ({ browser }, testInfo) => {
ADD e2e/dicethrone-simple-start.e2e.ts:1093 | OK 测试/覆盖新增，需与主链保持一致 |         test.setTimeout(150000);
ADD e2e/dicethrone-simple-start.e2e.ts:1094 | OK 测试/覆盖新增，需与主链保持一致 |         const baseURL = testInfo.project.use.baseURL as string | undefined;
ADD e2e/dicethrone-simple-start.e2e.ts:1095 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1096 | OK 测试/覆盖新增，需与主链保持一致 |         const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
ADD e2e/dicethrone-simple-start.e2e.ts:1097 | OK 测试/覆盖新增，需与主链保持一致 |             numPlayers: 4,
ADD e2e/dicethrone-simple-start.e2e.ts:1098 | OK 测试/覆盖新增，需与主链保持一致 |             gameServerBaseURL: getGameServerBaseURL(),
ADD e2e/dicethrone-simple-start.e2e.ts:1099 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD e2e/dicethrone-simple-start.e2e.ts:1100 | OK 测试/覆盖新增，需与主链保持一致 |         if (!setup) {
ADD e2e/dicethrone-simple-start.e2e.ts:1101 | OK 测试/覆盖新增，需与主链保持一致 |             test.skip(true, '游戏服务器不可用或四人房间创建失败');
ADD e2e/dicethrone-simple-start.e2e.ts:1102 | OK 测试/覆盖新增，需与主链保持一致 |             return;
ADD e2e/dicethrone-simple-start.e2e.ts:1103 | OK 测试/覆盖新增，需与主链保持一致 |         }
ADD e2e/dicethrone-simple-start.e2e.ts:1104 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1105 | OK 测试/覆盖新增，需与主链保持一致 |         const { hostPage, matchId, players } = setup;
ADD e2e/dicethrone-simple-start.e2e.ts:1106 | OK 测试/覆盖新增，需与主链保持一致 |         const targetPage = players[1].page;
ADD e2e/dicethrone-simple-start.e2e.ts:1107 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1108 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[0].page, 'shadow_thief');
ADD e2e/dicethrone-simple-start.e2e.ts:1109 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[1].page, 'paladin');
ADD e2e/dicethrone-simple-start.e2e.ts:1110 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[2].page, 'monk');
ADD e2e/dicethrone-simple-start.e2e.ts:1111 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[3].page, 'pyromancer');
ADD e2e/dicethrone-simple-start.e2e.ts:1112 | OK 测试/覆盖新增，需与主链保持一致 |         await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));
ADD e2e/dicethrone-simple-start.e2e.ts:1113 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1114 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForGameBoard(hostPage);
ADD e2e/dicethrone-simple-start.e2e.ts:1115 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForHarnessPages(players.map((player) => player.page));
ADD e2e/dicethrone-simple-start.e2e.ts:1116 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1117 | OK 测试/覆盖新增，需与主链保持一致 |         await applyOnlineMatchState(matchId, hostPage, buildFourPlayerRemoveAllStatusState);
ADD e2e/dicethrone-simple-start.e2e.ts:1118 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForPhase(hostPage, 'main1');
ADD e2e/dicethrone-simple-start.e2e.ts:1119 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1120 | OK 测试/覆盖新增，需与主链保持一致 |         await dispatchHarnessCommand(hostPage, 'PLAY_CARD', '0', { cardId: 'remove-all-inst' });
ADD e2e/dicethrone-simple-start.e2e.ts:1121 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-player-target-0')).toHaveAttribute('data-team-tone', 'self');
ADD e2e/dicethrone-simple-start.e2e.ts:1122 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-player-target-1')).toHaveAttribute('data-team-tone', 'enemy');
ADD e2e/dicethrone-simple-start.e2e.ts:1123 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-player-target-2')).toHaveAttribute('data-team-tone', 'ally');
ADD e2e/dicethrone-simple-start.e2e.ts:1124 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-player-target-3')).toHaveAttribute('data-team-tone', 'enemy');
ADD e2e/dicethrone-simple-start.e2e.ts:1125 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1126 | OK 测试/覆盖新增，需与主链保持一致 |         const confirmButton = hostPage.getByRole('button', { name: /Confirm|确认/i }).last();
ADD e2e/dicethrone-simple-start.e2e.ts:1127 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(confirmButton).toBeDisabled();
ADD e2e/dicethrone-simple-start.e2e.ts:1128 | OK 测试/覆盖新增，需与主链保持一致 |         await hostPage.getByTestId('dt-player-target-2').click();
ADD e2e/dicethrone-simple-start.e2e.ts:1129 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(confirmButton).toBeDisabled();
ADD e2e/dicethrone-simple-start.e2e.ts:1130 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1131 | OK 测试/覆盖新增，需与主链保持一致 |         await clearEvidenceScreenshotsForTest(testInfo);
ADD e2e/dicethrone-simple-start.e2e.ts:1132 | OK 测试/覆盖新增，需与主链保持一致 |         await saveEvidenceScreenshot(hostPage, testInfo, '09-four-player-remove-all-status-selection');
ADD e2e/dicethrone-simple-start.e2e.ts:1133 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1134 | OK 测试/覆盖新增，需与主链保持一致 |         await hostPage.getByTestId('dt-player-target-1').click();
ADD e2e/dicethrone-simple-start.e2e.ts:1135 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(confirmButton).toBeEnabled({ timeout: 5000 });
ADD e2e/dicethrone-simple-start.e2e.ts:1136 | OK 测试/覆盖新增，需与主链保持一致 |         await confirmButton.click();
ADD e2e/dicethrone-simple-start.e2e.ts:1137 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1138 | OK 测试/覆盖新增，需与主链保持一致 |         await hostPage.waitForFunction(() => {
ADD e2e/dicethrone-simple-start.e2e.ts:1139 | OK 测试/覆盖新增，需与主链保持一致 |             const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
ADD e2e/dicethrone-simple-start.e2e.ts:1140 | OK 测试/覆盖新增，需与主链保持一致 |             return !state?.sys?.interaction?.current
ADD e2e/dicethrone-simple-start.e2e.ts:1141 | OK 测试/覆盖新增，需与主链保持一致 |                 && (state?.core?.players?.['1']?.statusEffects?.burn ?? 0) === 0
ADD e2e/dicethrone-simple-start.e2e.ts:1142 | OK 测试/覆盖新增，需与主链保持一致 |                 && (state?.core?.players?.['1']?.tokens?.crit ?? 0) === 0;
ADD e2e/dicethrone-simple-start.e2e.ts:1143 | OK 测试/覆盖新增，需与主链保持一致 |         }, undefined, { timeout: 10000 });
ADD e2e/dicethrone-simple-start.e2e.ts:1144 | OK 测试/覆盖新增，需与主链保持一致 |         await targetPage.waitForFunction(() => {
ADD e2e/dicethrone-simple-start.e2e.ts:1145 | OK 测试/覆盖新增，需与主链保持一致 |             const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
ADD e2e/dicethrone-simple-start.e2e.ts:1146 | OK 测试/覆盖新增，需与主链保持一致 |             return (state?.core?.players?.['1']?.statusEffects?.burn ?? 0) === 0
ADD e2e/dicethrone-simple-start.e2e.ts:1147 | OK 测试/覆盖新增，需与主链保持一致 |                 && (state?.core?.players?.['1']?.tokens?.crit ?? 0) === 0;
ADD e2e/dicethrone-simple-start.e2e.ts:1148 | OK 测试/覆盖新增，需与主链保持一致 |         }, undefined, { timeout: 10000 });
ADD e2e/dicethrone-simple-start.e2e.ts:1149 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1150 | OK 测试/覆盖新增，需与主链保持一致 |         const hostState = await readHarnessState<any>(hostPage);
ADD e2e/dicethrone-simple-start.e2e.ts:1151 | OK 测试/覆盖新增，需与主链保持一致 |         const targetState = await readHarnessState<any>(targetPage);
ADD e2e/dicethrone-simple-start.e2e.ts:1152 | OK 测试/覆盖新增，需与主链保持一致 |         expect(hostState.core.players['1'].statusEffects.burn ?? 0).toBe(0);
ADD e2e/dicethrone-simple-start.e2e.ts:1153 | OK 测试/覆盖新增，需与主链保持一致 |         expect(hostState.core.players['1'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(0);
ADD e2e/dicethrone-simple-start.e2e.ts:1154 | OK 测试/覆盖新增，需与主链保持一致 |         expect(targetState.core.players['1'].statusEffects.burn ?? 0).toBe(0);
ADD e2e/dicethrone-simple-start.e2e.ts:1155 | OK 测试/覆盖新增，需与主链保持一致 |         expect(targetState.core.players['1'].tokens[TOKEN_IDS.CRIT] ?? 0).toBe(0);
ADD e2e/dicethrone-simple-start.e2e.ts:1156 | OK 测试/覆盖新增，需与主链保持一致 |         expect(hostState.sys.interaction?.current).toBeUndefined();
ADD e2e/dicethrone-simple-start.e2e.ts:1157 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1158 | OK 测试/覆盖新增，需与主链保持一致 |         await cleanupDTMatch(setup);
ADD e2e/dicethrone-simple-start.e2e.ts:1159 | OK 测试/覆盖新增，需与主链保持一致 |     });
ADD e2e/dicethrone-simple-start.e2e.ts:1160 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1161 | OK 测试/覆盖新增，需与主链保持一致 |     test('Online 4-player 2v2 flow: response queue excludes teammate and defense chain reaches team victory UI', async ({ browser }, testInfo) => {
ADD e2e/dicethrone-simple-start.e2e.ts:1162 | OK 测试/覆盖新增，需与主链保持一致 |         test.setTimeout(120000);
ADD e2e/dicethrone-simple-start.e2e.ts:1163 | OK 测试/覆盖新增，需与主链保持一致 |         const baseURL = testInfo.project.use.baseURL as string | undefined;
ADD e2e/dicethrone-simple-start.e2e.ts:1164 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1165 | OK 测试/覆盖新增，需与主链保持一致 |         const setup = await setupDTOnlineMatchWithPlayers(browser, baseURL, {
ADD e2e/dicethrone-simple-start.e2e.ts:1166 | OK 测试/覆盖新增，需与主链保持一致 |             numPlayers: 4,
ADD e2e/dicethrone-simple-start.e2e.ts:1167 | OK 测试/覆盖新增，需与主链保持一致 |             gameServerBaseURL: getGameServerBaseURL(),
ADD e2e/dicethrone-simple-start.e2e.ts:1168 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD e2e/dicethrone-simple-start.e2e.ts:1169 | OK 测试/覆盖新增，需与主链保持一致 |         if (!setup) {
ADD e2e/dicethrone-simple-start.e2e.ts:1170 | OK 测试/覆盖新增，需与主链保持一致 |             test.skip(true, '游戏服务器不可用或四人房间创建失败');
ADD e2e/dicethrone-simple-start.e2e.ts:1171 | OK 测试/覆盖新增，需与主链保持一致 |             return;
ADD e2e/dicethrone-simple-start.e2e.ts:1172 | OK 测试/覆盖新增，需与主链保持一致 |         }
ADD e2e/dicethrone-simple-start.e2e.ts:1173 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1174 | OK 测试/覆盖新增，需与主链保持一致 |         const { hostPage, matchId, players } = setup;
ADD e2e/dicethrone-simple-start.e2e.ts:1175 | OK 测试/覆盖新增，需与主链保持一致 |         const defenderPage = players[1].page;
ADD e2e/dicethrone-simple-start.e2e.ts:1176 | OK 测试/覆盖新增，需与主链保持一致 |         const defenderCaptainPage = players[3].page;
ADD e2e/dicethrone-simple-start.e2e.ts:1177 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1178 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[0].page, 'monk');
ADD e2e/dicethrone-simple-start.e2e.ts:1179 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[1].page, 'barbarian');
ADD e2e/dicethrone-simple-start.e2e.ts:1180 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[2].page, 'pyromancer');
ADD e2e/dicethrone-simple-start.e2e.ts:1181 | OK 测试/覆盖新增，需与主链保持一致 |         await selectCharacter(players[3].page, 'paladin');
ADD e2e/dicethrone-simple-start.e2e.ts:1182 | OK 测试/覆盖新增，需与主链保持一致 |         await readyMultiplePlayersAndStartGame(hostPage, players.slice(1).map((player) => player.page));
ADD e2e/dicethrone-simple-start.e2e.ts:1183 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1184 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForGameBoard(hostPage);
ADD e2e/dicethrone-simple-start.e2e.ts:1185 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForHarnessPages(players.map((player) => player.page));
ADD e2e/dicethrone-simple-start.e2e.ts:1186 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1187 | OK 测试/覆盖新增，需与主链保持一致 |         await applyOnlineMatchState(matchId, hostPage, buildDefensiveResponseWindowTriggerState);
ADD e2e/dicethrone-simple-start.e2e.ts:1188 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForPhase(hostPage, 'defensiveRoll');
ADD e2e/dicethrone-simple-start.e2e.ts:1189 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1190 | OK 测试/覆盖新增，需与主链保持一致 |         await dispatchHarnessCommand(defenderCaptainPage, 'CONFIRM_ROLL', '3');
ADD e2e/dicethrone-simple-start.e2e.ts:1191 | OK 测试/覆盖新增，需与主链保持一致 |         await hostPage.waitForFunction(() => {
ADD e2e/dicethrone-simple-start.e2e.ts:1192 | OK 测试/覆盖新增，需与主链保持一致 |             const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
ADD e2e/dicethrone-simple-start.e2e.ts:1193 | OK 测试/覆盖新增，需与主链保持一致 |             const queue = state?.sys?.responseWindow?.current?.responderQueue ?? [];
ADD e2e/dicethrone-simple-start.e2e.ts:1194 | OK 测试/覆盖新增，需与主链保持一致 |             return state?.sys?.phase === 'defensiveRoll' && queue.length === 1 && queue[0] === '0';
ADD e2e/dicethrone-simple-start.e2e.ts:1195 | OK 测试/覆盖新增，需与主链保持一致 |         }, { timeout: 10000 });
ADD e2e/dicethrone-simple-start.e2e.ts:1196 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1197 | OK 测试/覆盖新增，需与主链保持一致 |         const responseState = await readHarnessState<any>(hostPage);
ADD e2e/dicethrone-simple-start.e2e.ts:1198 | OK 测试/覆盖新增，需与主链保持一致 |         expect(responseState.sys.responseWindow?.current?.responderQueue).toEqual(['0']);
ADD e2e/dicethrone-simple-start.e2e.ts:1199 | OK 测试/覆盖新增，需与主链保持一致 |         expect(responseState.sys.responseWindow?.current?.responderQueue).not.toContain('2');
ADD e2e/dicethrone-simple-start.e2e.ts:1200 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1201 | OK 测试/覆盖新增，需与主链保持一致 |         await applyOnlineMatchState(matchId, hostPage, (state) => buildTargetingRollState(state, 6));
ADD e2e/dicethrone-simple-start.e2e.ts:1202 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForPhase(hostPage, 'targetingRoll');
ADD e2e/dicethrone-simple-start.e2e.ts:1203 | OK 测试/覆盖新增，需与主链保持一致 |         await dispatchHarnessCommand(hostPage, 'ADVANCE_PHASE', '0');
ADD e2e/dicethrone-simple-start.e2e.ts:1204 | OK 测试/覆盖新增，需与主链保持一致 |         await hostPage.getByTestId('dt-target-option-1').click();
ADD e2e/dicethrone-simple-start.e2e.ts:1205 | OK 测试/覆盖新增，需与主链保持一致 |         await defenderPage.waitForFunction(() => {
ADD e2e/dicethrone-simple-start.e2e.ts:1206 | OK 测试/覆盖新增，需与主链保持一致 |             const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
ADD e2e/dicethrone-simple-start.e2e.ts:1207 | OK 测试/覆盖新增，需与主链保持一致 |             return state?.sys?.phase === 'defensiveRoll' && state?.core?.pendingAttack?.defenderId === '1';
ADD e2e/dicethrone-simple-start.e2e.ts:1208 | OK 测试/覆盖新增，需与主链保持一致 |         }, { timeout: 10000 });
ADD e2e/dicethrone-simple-start.e2e.ts:1209 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1210 | OK 测试/覆盖新增，需与主链保持一致 |         await applyOnlineMatchState(matchId, hostPage, buildDefensiveRollResolutionState);
ADD e2e/dicethrone-simple-start.e2e.ts:1211 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForPhase(defenderPage, 'defensiveRoll');
ADD e2e/dicethrone-simple-start.e2e.ts:1212 | OK 测试/覆盖新增，需与主链保持一致 |         await dispatchHarnessCommand(defenderPage, 'ADVANCE_PHASE', '1');
ADD e2e/dicethrone-simple-start.e2e.ts:1213 | OK 测试/覆盖新增，需与主链保持一致 |         await hostPage.waitForFunction(() => {
ADD e2e/dicethrone-simple-start.e2e.ts:1214 | OK 测试/覆盖新增，需与主链保持一致 |             const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
ADD e2e/dicethrone-simple-start.e2e.ts:1215 | OK 测试/覆盖新增，需与主链保持一致 |             return state?.sys?.phase === 'main2' && !state?.core?.pendingAttack;
ADD e2e/dicethrone-simple-start.e2e.ts:1216 | OK 测试/覆盖新增，需与主链保持一致 |         }, { timeout: 10000 });
ADD e2e/dicethrone-simple-start.e2e.ts:1217 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-simple-start.e2e.ts:1218 | OK 测试/覆盖新增，需与主链保持一致 |         const resolvedState = await readHarnessState<any>(hostPage);
ADD e2e/dicethrone-simple-start.e2e.ts:1219 | OK 测试/覆盖新增，需与主链保持一致 |         expect(resolvedState.sys.phase).toBe('main2');
ADD e2e/dicethrone-simple-start.e2e.ts:1220 | OK 测试/覆盖新增，需与主链保持一致 |         expect(resolvedState.core.pendingAttack).toBeFalsy();
DEL e2e/dicethrone-simple-start.e2e.ts:34 | 注意 删除/收口测试，覆盖减少需确认 |         // 截图验证
DEL e2e/dicethrone-simple-start.e2e.ts:35 | 注意 删除/收口测试，覆盖减少需确认 |         await hostPage.screenshot({ path: testInfo.outputPath('host-game-started.png'), fullPage: false });
DEL e2e/dicethrone-simple-start.e2e.ts:36 | 注意 删除/收口测试，覆盖减少需确认 |         await guestPage.screenshot({ path: testInfo.outputPath('guest-game-started.png'), fullPage: false });
ADD e2e/dicethrone-simple-start.e2e.ts:1222 | OK 测试/覆盖新增，需与主链保持一致 |         const victoryState = structuredClone(resolvedState);
ADD e2e/dicethrone-simple-start.e2e.ts:1223 | OK 测试/覆盖新增，需与主链保持一致 |         victoryState.core.teamHealth = { A: victoryState.core.teamHealth?.A ?? 50, B: 0 };
ADD e2e/dicethrone-simple-start.e2e.ts:1224 | OK 测试/覆盖新增，需与主链保持一致 |         victoryState.core.players['1'].resources.hp = 0;
ADD e2e/dicethrone-simple-start.e2e.ts:1225 | OK 测试/覆盖新增，需与主链保持一致 |         victoryState.core.players['3'].resources.hp = 0;
ADD e2e/dicethrone-simple-start.e2e.ts:1226 | OK 测试/覆盖新增，需与主链保持一致 |         victoryState.sys.gameover = { winner: '0' };
ADD e2e/dicethrone-simple-start.e2e.ts:1227 | OK 测试/覆盖新增，需与主链保持一致 |         await injectMatchState(matchId, normalizeInjectedMatchState(matchId, victoryState), hostPage);
DEL e2e/dicethrone-simple-start.e2e.ts:38 | 注意 删除/收口测试，覆盖减少需确认 |         // 验证游戏界面元素存在（而不是验证 window.__BG_STATE__，因为 DiceThrone 使用新的传输层架构）
DEL e2e/dicethrone-simple-start.e2e.ts:39 | 注意 删除/收口测试，覆盖减少需确认 |         const hostDiceButton = hostPage.locator('[data-tutorial-id="dice-roll-button"]');
DEL e2e/dicethrone-simple-start.e2e.ts:40 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(hostDiceButton).toBeVisible({ timeout: 5000 });
ADD e2e/dicethrone-simple-start.e2e.ts:1229 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-endgame-title')).toBeVisible({ timeout: 10000 });
ADD e2e/dicethrone-simple-start.e2e.ts:1230 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(hostPage.getByTestId('dt-endgame-title')).toContainText('Victory');
ADD e2e/dicethrone-simple-start.e2e.ts:1231 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(defenderPage.getByTestId('dt-endgame-title')).toContainText('Defeat');
DEL e2e/dicethrone-simple-start.e2e.ts:42 | 注意 删除/收口测试，覆盖减少需确认 |         const guestDiceButton = guestPage.locator('[data-tutorial-id="dice-roll-button"]');
DEL e2e/dicethrone-simple-start.e2e.ts:43 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(guestDiceButton).toBeVisible({ timeout: 5000 });
ADD e2e/dicethrone-simple-start.e2e.ts:1233 | OK 测试/覆盖新增，需与主链保持一致 |         await clearEvidenceScreenshotsForTest(testInfo);
ADD e2e/dicethrone-simple-start.e2e.ts:1234 | OK 测试/覆盖新增，需与主链保持一致 |         await saveEvidenceScreenshot(hostPage, testInfo, '05-four-player-team-victory-ui');
DEL e2e/dicethrone-simple-start.e2e.ts:45 | 注意 删除/收口测试，覆盖减少需确认 |         await guestContext.close();
DEL e2e/dicethrone-simple-start.e2e.ts:46 | 注意 删除/收口测试，覆盖减少需确认 |         await hostContext.close();
ADD e2e/dicethrone-simple-start.e2e.ts:1236 | OK 测试/覆盖新增，需与主链保持一致 |         await cleanupDTMatch(setup);
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:1 | 注意 删除/收口测试，覆盖减少需确认 | /**
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:2 | 注意 删除/收口测试，覆盖减少需确认 |  * DiceThrone 状态选择交互 - 取消按钮测试
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:3 | 注意 删除/收口测试，覆盖减少需确认 |  * 
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:4 | 注意 删除/收口测试，覆盖减少需确认 |  * 验证状态选择交互的 UI 正确显示，包括取消按钮
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:5 | 注意 删除/收口测试，覆盖减少需确认 |  */
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:6 | 注意 删除/收口测试，覆盖减少需确认 | import { test, expect } from './fixtures';
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:7 | 注意 删除/收口测试，覆盖减少需确认 | import { setupOnlineMatch, readCoreState, waitForTestHarness } from './helpers/common';
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:8 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:9 | 注意 删除/收口测试，覆盖减少需确认 | test.describe('DiceThrone - Status Interaction Cancel Button', () => {
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:10 | 注意 删除/收口测试，覆盖减少需确认 |     test('should show cancel button in status selection interaction', async ({ page }) => {
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:11 | 注意 删除/收口测试，覆盖减少需确认 |         // 1. 创建对局
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:12 | 注意 删除/收口测试，覆盖减少需确认 |         const { roomId } = await setupOnlineMatch(page, 'dicethrone', {
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:13 | 注意 删除/收口测试，覆盖减少需确认 |             player0Character: 'barbarian',
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:14 | 注意 删除/收口测试，覆盖减少需确认 |             player1Character: 'moon-elf',
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:15 | 注意 删除/收口测试，覆盖减少需确认 |         });
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:16 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:17 | 注意 删除/收口测试，覆盖减少需确认 |         // 2. 等待测试工具就绪
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:18 | 注意 删除/收口测试，覆盖减少需确认 |         await waitForTestHarness(page);
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:19 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:20 | 注意 删除/收口测试，覆盖减少需确认 |         // 3. 注入状态：玩家 0 有多个状态效果
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:21 | 注意 删除/收口测试，覆盖减少需确认 |         await page.evaluate(() => {
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:22 | 注意 删除/收口测试，覆盖减少需确认 |             window.__BG_TEST_HARNESS__!.state.patch({
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:23 | 注意 删除/收口测试，覆盖减少需确认 |                 'players.0.statusEffects': { poison: 2, burn: 1 },
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:24 | 注意 删除/收口测试，覆盖减少需确认 |             });
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:25 | 注意 删除/收口测试，覆盖减少需确认 |         });
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:26 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:27 | 注意 删除/收口测试，覆盖减少需确认 |         // 4. 验证状态已注入
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:28 | 注意 删除/收口测试，覆盖减少需确认 |         const state = await readCoreState(page);
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:29 | 注意 删除/收口测试，覆盖减少需确认 |         expect(state.players['0'].statusEffects.poison).toBe(2);
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:30 | 注意 删除/收口测试，覆盖减少需确认 |         expect(state.players['0'].statusEffects.burn).toBe(1);
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:31 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:32 | 注意 删除/收口测试，覆盖减少需确认 |         // 5. 触发移除状态交互（使用调试面板）
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:33 | 注意 删除/收口测试，覆盖减少需确认 |         // 打开调试面板
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:34 | 注意 删除/收口测试，覆盖减少需确认 |         await page.click('[data-testid="debug-panel-toggle"]');
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:35 | 注意 删除/收口测试，覆盖减少需确认 |         
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:36 | 注意 删除/收口测试，覆盖减少需确认 |         // 等待调试面板展开
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:37 | 注意 删除/收口测试，覆盖减少需确认 |         await page.waitForSelector('[data-testid="debug-panel-content"]', { state: 'visible' });
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:38 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:39 | 注意 删除/收口测试，覆盖减少需确认 |         // 点击"移除状态"按钮（假设调试面板有此功能）
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:40 | 注意 删除/收口测试，覆盖减少需确认 |         // 如果没有，我们需要通过命令直接创建交互
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:41 | 注意 删除/收口测试，覆盖减少需确认 |         await page.evaluate(() => {
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:42 | 注意 删除/收口测试，覆盖减少需确认 |             // 直接创建一个状态选择交互
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:43 | 注意 删除/收口测试，覆盖减少需确认 |             window.__BG_TEST_HARNESS__!.command.dispatch({
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:44 | 注意 删除/收口测试，覆盖减少需确认 |                 type: 'CREATE_STATUS_INTERACTION',
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:45 | 注意 删除/收口测试，覆盖减少需确认 |                 payload: {
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:46 | 注意 删除/收口测试，覆盖减少需确认 |                     kind: 'selectStatus',
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:47 | 注意 删除/收口测试，覆盖减少需确认 |                     playerId: '0',
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:48 | 注意 删除/收口测试，覆盖减少需确认 |                     titleKey: 'interaction.selectStatusToRemove',
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:49 | 注意 删除/收口测试，覆盖减少需确认 |                     selectCount: 1,
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:50 | 注意 删除/收口测试，覆盖减少需确认 |                     targetPlayerIds: ['0'],
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:51 | 注意 删除/收口测试，覆盖减少需确认 |                 },
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:52 | 注意 删除/收口测试，覆盖减少需确认 |             });
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:53 | 注意 删除/收口测试，覆盖减少需确认 |         });
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:54 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:55 | 注意 删除/收口测试，覆盖减少需确认 |         // 6. 验证弹窗显示
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:56 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(page.locator('text=选择要移除的状态效果')).toBeVisible({ timeout: 5000 });
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:57 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:58 | 注意 删除/收口测试，覆盖减少需确认 |         // 7. 验证取消按钮存在且可用
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:59 | 注意 删除/收口测试，覆盖减少需确认 |         const cancelButton = page.locator('button:has-text("取消")');
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:60 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(cancelButton).toBeVisible();
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:61 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(cancelButton).toBeEnabled();
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:62 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:63 | 注意 删除/收口测试，覆盖减少需确认 |         // 8. 验证确认按钮存在（初始应该禁用，因为没有选择）
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:64 | 注意 删除/收口测试，覆盖减少需确认 |         const confirmButton = page.locator('button:has-text("确认")');
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:65 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(confirmButton).toBeVisible();
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:66 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(confirmButton).toBeDisabled();
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:67 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:68 | 注意 删除/收口测试，覆盖减少需确认 |         // 9. 选择一个状态
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:69 | 注意 删除/收口测试，覆盖减少需确认 |         await page.click('[data-testid="status-badge-poison"]');
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:70 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:71 | 注意 删除/收口测试，覆盖减少需确认 |         // 10. 验证确认按钮变为可用
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:72 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(confirmButton).toBeEnabled();
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:73 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:74 | 注意 删除/收口测试，覆盖减少需确认 |         // 11. 点击取消按钮
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:75 | 注意 删除/收口测试，覆盖减少需确认 |         await cancelButton.click();
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:76 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:77 | 注意 删除/收口测试，覆盖减少需确认 |         // 12. 验证弹窗关闭
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:78 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(page.locator('text=选择要移除的状态效果')).not.toBeVisible();
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:79 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:80 | 注意 删除/收口测试，覆盖减少需确认 |         // 13. 验证状态未改变
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:81 | 注意 删除/收口测试，覆盖减少需确认 |         const finalState = await readCoreState(page);
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:82 | 注意 删除/收口测试，覆盖减少需确认 |         expect(finalState.players['0'].statusEffects.poison).toBe(2);
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:83 | 注意 删除/收口测试，覆盖减少需确认 |         expect(finalState.players['0'].statusEffects.burn).toBe(1);
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:84 | 注意 删除/收口测试，覆盖减少需确认 |     });
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:85 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:86 | 注意 删除/收口测试，覆盖减少需确认 |     test('should close interaction without changes when cancel is clicked', async ({ page }) => {
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:87 | 注意 删除/收口测试，覆盖减少需确认 |         // 1. 创建对局
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:88 | 注意 删除/收口测试，覆盖减少需确认 |         const { roomId } = await setupOnlineMatch(page, 'dicethrone', {
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:89 | 注意 删除/收口测试，覆盖减少需确认 |             player0Character: 'barbarian',
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:90 | 注意 删除/收口测试，覆盖减少需确认 |             player1Character: 'moon-elf',
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:91 | 注意 删除/收口测试，覆盖减少需确认 |         });
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:92 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:93 | 注意 删除/收口测试，覆盖减少需确认 |         // 2. 等待测试工具就绪
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:94 | 注意 删除/收口测试，覆盖减少需确认 |         await waitForTestHarness(page);
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:95 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:96 | 注意 删除/收口测试，覆盖减少需确认 |         // 3. 注入状态：玩家 0 有状态效果
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:97 | 注意 删除/收口测试，覆盖减少需确认 |         await page.evaluate(() => {
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:98 | 注意 删除/收口测试，覆盖减少需确认 |             window.__BG_TEST_HARNESS__!.state.patch({
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:99 | 注意 删除/收口测试，覆盖减少需确认 |                 'players.0.statusEffects': { poison: 3 },
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:100 | 注意 删除/收口测试，覆盖减少需确认 |             });
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:101 | 注意 删除/收口测试，覆盖减少需确认 |         });
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:102 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:103 | 注意 删除/收口测试，覆盖减少需确认 |         // 4. 创建状态选择交互
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:104 | 注意 删除/收口测试，覆盖减少需确认 |         await page.evaluate(() => {
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:105 | 注意 删除/收口测试，覆盖减少需确认 |             window.__BG_TEST_HARNESS__!.command.dispatch({
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:106 | 注意 删除/收口测试，覆盖减少需确认 |                 type: 'CREATE_STATUS_INTERACTION',
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:107 | 注意 删除/收口测试，覆盖减少需确认 |                 payload: {
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:108 | 注意 删除/收口测试，覆盖减少需确认 |                     kind: 'selectStatus',
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:109 | 注意 删除/收口测试，覆盖减少需确认 |                     playerId: '0',
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:110 | 注意 删除/收口测试，覆盖减少需确认 |                     titleKey: 'interaction.selectStatusToRemove',
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:111 | 注意 删除/收口测试，覆盖减少需确认 |                     selectCount: 1,
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:112 | 注意 删除/收口测试，覆盖减少需确认 |                     targetPlayerIds: ['0'],
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:113 | 注意 删除/收口测试，覆盖减少需确认 |                 },
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:114 | 注意 删除/收口测试，覆盖减少需确认 |             });
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:115 | 注意 删除/收口测试，覆盖减少需确认 |         });
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:116 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:117 | 注意 删除/收口测试，覆盖减少需确认 |         // 5. 等待弹窗显示
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:118 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(page.locator('text=选择要移除的状态效果')).toBeVisible();
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:119 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:120 | 注意 删除/收口测试，覆盖减少需确认 |         // 6. 选择一个状态
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:121 | 注意 删除/收口测试，覆盖减少需确认 |         await page.click('[data-testid="status-badge-poison"]');
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:122 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:123 | 注意 删除/收口测试，覆盖减少需确认 |         // 7. 点击取消（不是确认）
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:124 | 注意 删除/收口测试，覆盖减少需确认 |         await page.click('button:has-text("取消")');
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:125 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:126 | 注意 删除/收口测试，覆盖减少需确认 |         // 8. 验证弹窗关闭
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:127 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(page.locator('text=选择要移除的状态效果')).not.toBeVisible();
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:128 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:129 | 注意 删除/收口测试，覆盖减少需确认 |         // 9. 验证状态未改变（仍然是 3 层中毒）
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:130 | 注意 删除/收口测试，覆盖减少需确认 |         const finalState = await readCoreState(page);
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:131 | 注意 删除/收口测试，覆盖减少需确认 |         expect(finalState.players['0'].statusEffects.poison).toBe(3);
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:132 | 注意 删除/收口测试，覆盖减少需确认 |     });
DEL e2e/dicethrone-status-interaction-cancel.e2e.ts:133 | 注意 删除/收口测试，覆盖减少需确认 | });
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:2 | 注意 删除/收口测试，覆盖减少需确认 |  * DiceThrone 状态选择交互 - 完整测试套件
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:3 | 注意 删除/收口测试，覆盖减少需确认 |  * 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:4 | 注意 删除/收口测试，覆盖减少需确认 |  * 测试所有状态选择交互类型：
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:5 | 注意 删除/收口测试，覆盖减少需确认 |  * 1. selectStatus - 选择单个状态效果并移除
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:6 | 注意 删除/收口测试，覆盖减少需确认 |  * 2. selectPlayer - 选择玩家并移除其所有状态
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:7 | 注意 删除/收口测试，覆盖减少需确认 |  * 3. selectTargetStatus - 转移状态（两阶段：选择状态 → 选择目标玩家）
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:8 | 注意 删除/收口测试，覆盖减少需确认 |  * 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:9 | 注意 删除/收口测试，覆盖减少需确认 |  * 验证点：
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:10 | 注意 删除/收口测试，覆盖减少需确认 |  * - 弹窗正确显示
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:11 | 注意 删除/收口测试，覆盖减少需确认 |  * - 取消按钮存在且可用
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:12 | 注意 删除/收口测试，覆盖减少需确认 |  * - 确认按钮初始禁用，选择后启用
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:13 | 注意 删除/收口测试，覆盖减少需确认 |  * - 取消后状态不变
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:14 | 注意 删除/收口测试，覆盖减少需确认 |  * - 确认后状态正确变更
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:2 | OK 测试/覆盖新增，需与主链保持一致 |  * DiceThrone 状态交互共享 UI 契约 E2E
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:3 | OK 测试/覆盖新增，需与主链保持一致 |  *
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:4 | OK 测试/覆盖新增，需与主链保持一致 |  * 这份文件不再重复验证具体卡牌效果执行，
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:5 | OK 测试/覆盖新增，需与主链保持一致 |  * 只守住共享交互层当前仍有独立维护价值的 UI 契约：
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:6 | OK 测试/覆盖新增，需与主链保持一致 |  * - `selectStatus` 选择器、确认按钮启用与取消关闭
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:7 | OK 测试/覆盖新增，需与主链保持一致 |  * - `selectPlayer` 空目标禁用与“无状态”提示
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:8 | OK 测试/覆盖新增，需与主链保持一致 |  * - `selectTargetStatus` 第二阶段的锁定来源卡与真实目标卡结构
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:16 | 注意 删除/收口测试，覆盖减少需确认 | import { test, expect } from './fixtures';
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:17 | 注意 删除/收口测试，覆盖减少需确认 | import { setupOnlineMatch, readCoreState, waitForTestHarness } from './helpers/common';
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:19 | 注意 删除/收口测试，覆盖减少需确认 | test.describe('DiceThrone - Status Interaction Complete', () => {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:20 | 注意 删除/收口测试，覆盖减少需确认 |     test('selectStatus: should show cancel button and allow cancellation', async ({ page }) => {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:21 | 注意 删除/收口测试，覆盖减少需确认 |         // 1. 创建对局
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:22 | 注意 删除/收口测试，覆盖减少需确认 |         const { roomId } = await setupOnlineMatch(page, 'dicethrone', {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:23 | 注意 删除/收口测试，覆盖减少需确认 |             player0Character: 'barbarian',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:24 | 注意 删除/收口测试，覆盖减少需确认 |             player1Character: 'moon-elf',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:25 | 注意 删除/收口测试，覆盖减少需确认 |         });
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:26 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:27 | 注意 删除/收口测试，覆盖减少需确认 |         // 2. 等待测试工具就绪
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:28 | 注意 删除/收口测试，覆盖减少需确认 |         await waitForTestHarness(page);
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:29 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:30 | 注意 删除/收口测试，覆盖减少需确认 |         // 3. 注入状态：玩家 0 有多个状态效果
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:31 | 注意 删除/收口测试，覆盖减少需确认 |         await page.evaluate(() => {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:32 | 注意 删除/收口测试，覆盖减少需确认 |             window.__BG_TEST_HARNESS__!.state.patch({
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:33 | 注意 删除/收口测试，覆盖减少需确认 |                 'players.0.statusEffects': { poison: 2, burn: 1, bleed: 1 },
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:34 | 注意 删除/收口测试，覆盖减少需确认 |             });
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:35 | 注意 删除/收口测试，覆盖减少需确认 |         });
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:36 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:37 | 注意 删除/收口测试，覆盖减少需确认 |         // 4. 验证状态已注入
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:38 | 注意 删除/收口测试，覆盖减少需确认 |         let state = await readCoreState(page);
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:39 | 注意 删除/收口测试，覆盖减少需确认 |         expect(state.players['0'].statusEffects.poison).toBe(2);
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:40 | 注意 删除/收口测试，覆盖减少需确认 |         expect(state.players['0'].statusEffects.burn).toBe(1);
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:41 | 注意 删除/收口测试，覆盖减少需确认 |         expect(state.players['0'].statusEffects.bleed).toBe(1);
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:42 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:43 | 注意 删除/收口测试，覆盖减少需确认 |         // 5. 触发状态选择交互（使用 TestHarness 直接创建交互）
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:44 | 注意 删除/收口测试，覆盖减少需确认 |         await page.evaluate(() => {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:45 | 注意 删除/收口测试，覆盖减少需确认 |             // 创建一个 selectStatus 交互
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:46 | 注意 删除/收口测试，覆盖减少需确认 |             const interaction = {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:47 | 注意 删除/收口测试，覆盖减少需确认 |                 id: 'test-select-status',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:48 | 注意 删除/收口测试，覆盖减少需确认 |                 kind: 'selectStatus',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:49 | 注意 删除/收口测试，覆盖减少需确认 |                 playerId: '0',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:50 | 注意 删除/收口测试，覆盖减少需确认 |                 titleKey: 'interaction.selectStatusToRemove',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:51 | 注意 删除/收口测试，覆盖减少需确认 |                 selectCount: 1,
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:52 | 注意 删除/收口测试，覆盖减少需确认 |                 targetPlayerIds: ['0'],
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:53 | 注意 删除/收口测试，覆盖减少需确认 |                 selected: [],
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:54 | 注意 删除/收口测试，覆盖减少需确认 |             };
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:55 | 注意 删除/收口测试，覆盖减少需确认 |             
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:56 | 注意 删除/收口测试，覆盖减少需确认 |             // 直接写入 sys.interaction
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:57 | 注意 删除/收口测试，覆盖减少需确认 |             window.__BG_TEST_HARNESS__!.state.patch({
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:58 | 注意 删除/收口测试，覆盖减少需确认 |                 'sys.interaction.current': interaction,
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:59 | 注意 删除/收口测试，覆盖减少需确认 |             });
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:60 | 注意 删除/收口测试，覆盖减少需确认 |         });
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:61 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:62 | 注意 删除/收口测试，覆盖减少需确认 |         // 6. 验证弹窗显示
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:63 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(page.locator('text=选择要移除的状态效果')).toBeVisible({ timeout: 5000 });
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:64 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:65 | 注意 删除/收口测试，覆盖减少需确认 |         // 7. 验证取消按钮存在且可用
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:66 | 注意 删除/收口测试，覆盖减少需确认 |         const cancelButton = page.locator('button:has-text("取消")');
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:67 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(cancelButton).toBeVisible();
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:68 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(cancelButton).toBeEnabled();
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:69 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:70 | 注意 删除/收口测试，覆盖减少需确认 |         // 8. 验证确认按钮存在但初始禁用
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:71 | 注意 删除/收口测试，覆盖减少需确认 |         const confirmButton = page.locator('button:has-text("确认")');
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:72 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(confirmButton).toBeVisible();
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:73 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(confirmButton).toBeDisabled();
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:74 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:75 | 注意 删除/收口测试，覆盖减少需确认 |         // 9. 点击取消按钮
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:76 | 注意 删除/收口测试，覆盖减少需确认 |         await cancelButton.click();
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:77 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:78 | 注意 删除/收口测试，覆盖减少需确认 |         // 10. 验证弹窗关闭
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:79 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(page.locator('text=选择要移除的状态效果')).not.toBeVisible({ timeout: 3000 });
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:80 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:81 | 注意 删除/收口测试，覆盖减少需确认 |         // 11. 验证状态未改变
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:82 | 注意 删除/收口测试，覆盖减少需确认 |         state = await readCoreState(page);
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:83 | 注意 删除/收口测试，覆盖减少需确认 |         expect(state.players['0'].statusEffects.poison).toBe(2);
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:84 | 注意 删除/收口测试，覆盖减少需确认 |         expect(state.players['0'].statusEffects.burn).toBe(1);
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:85 | 注意 删除/收口测试，覆盖减少需确认 |         expect(state.players['0'].statusEffects.bleed).toBe(1);
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:86 | 注意 删除/收口测试，覆盖减少需确认 |     });
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:87 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:88 | 注意 删除/收口测试，覆盖减少需确认 |     test('selectStatus: should allow selecting status and confirming', async ({ page }) => {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:89 | 注意 删除/收口测试，覆盖减少需确认 |         // 1. 创建对局
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:90 | 注意 删除/收口测试，覆盖减少需确认 |         const { roomId } = await setupOnlineMatch(page, 'dicethrone', {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:91 | 注意 删除/收口测试，覆盖减少需确认 |             player0Character: 'barbarian',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:92 | 注意 删除/收口测试，覆盖减少需确认 |             player1Character: 'moon-elf',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:93 | 注意 删除/收口测试，覆盖减少需确认 |         });
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:94 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:95 | 注意 删除/收口测试，覆盖减少需确认 |         // 2. 等待测试工具就绪
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:96 | 注意 删除/收口测试，覆盖减少需确认 |         await waitForTestHarness(page);
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:97 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:98 | 注意 删除/收口测试，覆盖减少需确认 |         // 3. 注入状态
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:99 | 注意 删除/收口测试，覆盖减少需确认 |         await page.evaluate(() => {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:100 | 注意 删除/收口测试，覆盖减少需确认 |             window.__BG_TEST_HARNESS__!.state.patch({
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:101 | 注意 删除/收口测试，覆盖减少需确认 |                 'players.0.statusEffects': { poison: 3 },
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:102 | 注意 删除/收口测试，覆盖减少需确认 |             });
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:103 | 注意 删除/收口测试，覆盖减少需确认 |         });
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:104 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:105 | 注意 删除/收口测试，覆盖减少需确认 |         // 4. 创建交互
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:106 | 注意 删除/收口测试，覆盖减少需确认 |         await page.evaluate(() => {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:107 | 注意 删除/收口测试，覆盖减少需确认 |             const interaction = {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:108 | 注意 删除/收口测试，覆盖减少需确认 |                 id: 'test-select-status-2',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:109 | 注意 删除/收口测试，覆盖减少需确认 |                 kind: 'selectStatus',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:110 | 注意 删除/收口测试，覆盖减少需确认 |                 playerId: '0',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:111 | 注意 删除/收口测试，覆盖减少需确认 |                 titleKey: 'interaction.selectStatusToRemove',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:112 | 注意 删除/收口测试，覆盖减少需确认 |                 selectCount: 1,
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:113 | 注意 删除/收口测试，覆盖减少需确认 |                 targetPlayerIds: ['0'],
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:114 | 注意 删除/收口测试，覆盖减少需确认 |                 selected: [],
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:115 | 注意 删除/收口测试，覆盖减少需确认 |             };
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:116 | 注意 删除/收口测试，覆盖减少需确认 |             
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:117 | 注意 删除/收口测试，覆盖减少需确认 |             window.__BG_TEST_HARNESS__!.state.patch({
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:118 | 注意 删除/收口测试，覆盖减少需确认 |                 'sys.interaction.current': interaction,
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:119 | 注意 删除/收口测试，覆盖减少需确认 |             });
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:120 | 注意 删除/收口测试，覆盖减少需确认 |         });
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:11 | OK 测试/覆盖新增，需与主链保持一致 | import type { Page } from '@playwright/test';
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:12 | OK 测试/覆盖新增，需与主链保持一致 | import { test, expect } from './framework';
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:13 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:14 | OK 测试/覆盖新增，需与主链保持一致 | type MatchState = Record<string, any>;
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:15 | OK 测试/覆盖新增，需与主链保持一致 | type CardInteractionDescriptor = Record<string, any>;
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:16 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:17 | OK 测试/覆盖新增，需与主链保持一致 | const readHarnessState = async <T = MatchState>(page: Page): Promise<T> => {
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:18 | OK 测试/覆盖新增，需与主链保持一致 |     return page.evaluate(() => (window as any).__BG_TEST_HARNESS__!.state.get());
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:19 | OK 测试/覆盖新增，需与主链保持一致 | };
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:20 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:21 | OK 测试/覆盖新增，需与主链保持一致 | const applyHarnessState = async (
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:22 | OK 测试/覆盖新增，需与主链保持一致 |     page: Page,
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:23 | OK 测试/覆盖新增，需与主链保持一致 |     updater: (state: MatchState) => MatchState,
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:24 | OK 测试/覆盖新增，需与主链保持一致 | ) => {
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:25 | OK 测试/覆盖新增，需与主链保持一致 |     const currentState = await readHarnessState<MatchState>(page);
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:26 | OK 测试/覆盖新增，需与主链保持一致 |     const nextState = updater(structuredClone(currentState));
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:27 | OK 测试/覆盖新增，需与主链保持一致 |     await page.evaluate((state) => {
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:28 | OK 测试/覆盖新增，需与主链保持一致 |         (window as any).__BG_TEST_HARNESS__!.state.set(state);
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:29 | OK 测试/覆盖新增，需与主链保持一致 |     }, nextState);
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:30 | OK 测试/覆盖新增，需与主链保持一致 |     await page.waitForTimeout(200);
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:31 | OK 测试/覆盖新增，需与主链保持一致 | };
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:32 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:33 | OK 测试/覆盖新增，需与主链保持一致 | const waitForInteractionClosed = async (page: Page) => {
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:34 | OK 测试/覆盖新增，需与主链保持一致 |     await page.waitForFunction(() => {
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:35 | OK 测试/覆盖新增，需与主链保持一致 |         return !(window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.interaction?.current;
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:36 | OK 测试/覆盖新增，需与主链保持一致 |     }, { timeout: 5000 });
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:37 | OK 测试/覆盖新增，需与主链保持一致 | };
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:38 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:39 | OK 测试/覆盖新增，需与主链保持一致 | const wrapCardInteraction = (
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:40 | OK 测试/覆盖新增，需与主链保持一致 |     interaction: CardInteractionDescriptor,
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:41 | OK 测试/覆盖新增，需与主链保持一致 | ) => ({
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:42 | OK 测试/覆盖新增，需与主链保持一致 |     id: interaction.id,
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:43 | OK 测试/覆盖新增，需与主链保持一致 |     kind: 'dt:card-interaction',
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:44 | OK 测试/覆盖新增，需与主链保持一致 |     playerId: interaction.playerId,
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:45 | OK 测试/覆盖新增，需与主链保持一致 |     data: interaction,
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:46 | OK 测试/覆盖新增，需与主链保持一致 | });
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:122 | 注意 删除/收口测试，覆盖减少需确认 |         // 5. 等待弹窗显示
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:123 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(page.locator('text=选择要移除的状态效果')).toBeVisible();
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:124 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:125 | 注意 删除/收口测试，覆盖减少需确认 |         // 6. 选择一个状态（点击状态徽章）
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:126 | 注意 删除/收口测试，覆盖减少需确认 |         // 注意：实际的选择器需要根据 SelectableEffectsContainer 的实现调整
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:127 | 注意 删除/收口测试，覆盖减少需确认 |         const statusBadge = page.locator('[data-testid="status-badge-poison"]').or(
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:128 | 注意 删除/收口测试，覆盖减少需确认 |             page.locator('[data-status-id="poison"]')
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:129 | 注意 删除/收口测试，覆盖减少需确认 |         ).first();
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:130 | 注意 删除/收口测试，覆盖减少需确认 |         
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:131 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(statusBadge).toBeVisible({ timeout: 3000 });
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:132 | 注意 删除/收口测试，覆盖减少需确认 |         await statusBadge.click();
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:133 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:134 | 注意 删除/收口测试，覆盖减少需确认 |         // 7. 验证确认按钮变为可用
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:135 | 注意 删除/收口测试，覆盖减少需确认 |         const confirmButton = page.locator('button:has-text("确认")');
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:136 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(confirmButton).toBeEnabled({ timeout: 2000 });
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:137 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:138 | 注意 删除/收口测试，覆盖减少需确认 |         // 8. 点击确认（注意：这会触发实际的命令分发，需要模拟或跳过）
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:139 | 注意 删除/收口测试，覆盖减少需确认 |         // 由于我们只是测试 UI，这里可以验证按钮可点击即可
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:140 | 注意 删除/收口测试，覆盖减少需确认 |         // 实际的状态移除逻辑由领域层测试覆盖
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:48 | OK 测试/覆盖新增，需与主链保持一致 | const openInteractionHarness = async (page: Page, game: any) => {
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:49 | OK 测试/覆盖新增，需与主链保持一致 |     await game.openTestGame('dicethrone');
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:50 | OK 测试/覆盖新增，需与主链保持一致 |     await game.setupScene({
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:51 | OK 测试/覆盖新增，需与主链保持一致 |         gameId: 'dicethrone',
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:52 | OK 测试/覆盖新增，需与主链保持一致 |         player0: {
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:53 | OK 测试/覆盖新增，需与主链保持一致 |             resources: { hp: 50, cp: 3 },
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:54 | OK 测试/覆盖新增，需与主链保持一致 |         },
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:55 | OK 测试/覆盖新增，需与主链保持一致 |         player1: {
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:56 | OK 测试/覆盖新增，需与主链保持一致 |             resources: { hp: 50, cp: 2 },
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:57 | OK 测试/覆盖新增，需与主链保持一致 |         },
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:58 | OK 测试/覆盖新增，需与主链保持一致 |         currentPlayer: '0',
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:59 | OK 测试/覆盖新增，需与主链保持一致 |         phase: 'main1',
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:60 | OK 测试/覆盖新增，需与主链保持一致 |         extra: {
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:61 | OK 测试/覆盖新增，需与主链保持一致 |             hostStarted: true,
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:62 | OK 测试/覆盖新增，需与主链保持一致 |             selectedCharacters: {
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:63 | OK 测试/覆盖新增，需与主链保持一致 |                 '0': 'barbarian',
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:64 | OK 测试/覆盖新增，需与主链保持一致 |                 '1': 'moon_elf',
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:65 | OK 测试/覆盖新增，需与主链保持一致 |             },
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:66 | OK 测试/覆盖新增，需与主链保持一致 |         },
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:143 | 注意 删除/收口测试，覆盖减少需确认 |     test('selectPlayer: should show player selection UI', async ({ page }) => {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:144 | 注意 删除/收口测试，覆盖减少需确认 |         // 1. 创建对局
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:145 | 注意 删除/收口测试，覆盖减少需确认 |         const { roomId } = await setupOnlineMatch(page, 'dicethrone', {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:146 | 注意 删除/收口测试，覆盖减少需确认 |             player0Character: 'barbarian',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:147 | 注意 删除/收口测试，覆盖减少需确认 |             player1Character: 'moon-elf',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:148 | 注意 删除/收口测试，覆盖减少需确认 |         });
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:149 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:150 | 注意 删除/收口测试，覆盖减少需确认 |         // 2. 等待测试工具就绪
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:151 | 注意 删除/收口测试，覆盖减少需确认 |         await waitForTestHarness(page);
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:69 | OK 测试/覆盖新增，需与主链保持一致 |     await page.waitForFunction(() => {
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:70 | OK 测试/覆盖新增，需与主链保持一致 |         const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:71 | OK 测试/覆盖新增，需与主链保持一致 |         return state?.sys?.phase === 'main1'
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:72 | OK 测试/覆盖新增，需与主链保持一致 |             && state?.core?.players?.['0']
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:73 | OK 测试/覆盖新增，需与主链保持一致 |             && state?.core?.players?.['1'];
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:74 | OK 测试/覆盖新增，需与主链保持一致 |     }, { timeout: 10000 });
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:75 | OK 测试/覆盖新增，需与主链保持一致 | };
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:153 | 注意 删除/收口测试，覆盖减少需确认 |         // 3. 注入状态：两个玩家都有状态
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:154 | 注意 删除/收口测试，覆盖减少需确认 |         await page.evaluate(() => {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:155 | 注意 删除/收口测试，覆盖减少需确认 |             window.__BG_TEST_HARNESS__!.state.patch({
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:156 | 注意 删除/收口测试，覆盖减少需确认 |                 'players.0.statusEffects': { poison: 2 },
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:157 | 注意 删除/收口测试，覆盖减少需确认 |                 'players.1.statusEffects': { burn: 1 },
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:158 | 注意 删除/收口测试，覆盖减少需确认 |             });
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:159 | 注意 删除/收口测试，覆盖减少需确认 |         });
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:160 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:161 | 注意 删除/收口测试，覆盖减少需确认 |         // 4. 创建玩家选择交互
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:162 | 注意 删除/收口测试，覆盖减少需确认 |         await page.evaluate(() => {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:163 | 注意 删除/收口测试，覆盖减少需确认 |             const interaction = {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:164 | 注意 删除/收口测试，覆盖减少需确认 |                 id: 'test-select-player',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:165 | 注意 删除/收口测试，覆盖减少需确认 |                 kind: 'selectPlayer',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:166 | 注意 删除/收口测试，覆盖减少需确认 |                 playerId: '0',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:167 | 注意 删除/收口测试，覆盖减少需确认 |                 titleKey: 'interaction.selectPlayerToRemoveAllStatus',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:168 | 注意 删除/收口测试，覆盖减少需确认 |                 selectCount: 1,
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:169 | 注意 删除/收口测试，覆盖减少需确认 |                 targetPlayerIds: ['0', '1'],
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:170 | 注意 删除/收口测试，覆盖减少需确认 |                 selected: [],
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:77 | OK 测试/覆盖新增，需与主链保持一致 | test.describe('DiceThrone - Status Interaction Complete', () => {
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:78 | OK 测试/覆盖新增，需与主链保持一致 |     test('selectStatus: 使用现役 dt-status-effect 选择器，取消后不改状态', async ({ page, game }) => {
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:79 | OK 测试/覆盖新增，需与主链保持一致 |         await openInteractionHarness(page, game);
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:80 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:81 | OK 测试/覆盖新增，需与主链保持一致 |         await applyHarnessState(page, (state) => {
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:82 | OK 测试/覆盖新增，需与主链保持一致 |             state.core.players['0'].statusEffects = { poison: 2, burn: 1 };
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:83 | OK 测试/覆盖新增，需与主链保持一致 |             state.core.players['0'].tokens = {};
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:84 | OK 测试/覆盖新增，需与主链保持一致 |             state.sys.interaction = {
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:85 | OK 测试/覆盖新增，需与主链保持一致 |                 ...(state.sys.interaction ?? {}),
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:86 | OK 测试/覆盖新增，需与主链保持一致 |                 current: wrapCardInteraction({
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:87 | OK 测试/覆盖新增，需与主链保持一致 |                     id: 'test-select-status',
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:88 | OK 测试/覆盖新增，需与主链保持一致 |                     type: 'selectStatus',
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:89 | OK 测试/覆盖新增，需与主链保持一致 |                     sourceCardId: 'test-card',
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:90 | OK 测试/覆盖新增，需与主链保持一致 |                     playerId: '0',
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:91 | OK 测试/覆盖新增，需与主链保持一致 |                     titleKey: 'interaction.selectStatusToRemove',
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:92 | OK 测试/覆盖新增，需与主链保持一致 |                     selectCount: 1,
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:93 | OK 测试/覆盖新增，需与主链保持一致 |                     targetPlayerIds: ['0'],
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:94 | OK 测试/覆盖新增，需与主链保持一致 |                     selected: [],
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:95 | OK 测试/覆盖新增，需与主链保持一致 |                 }),
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:172 | 注意 删除/收口测试，覆盖减少需确认 |             
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:173 | 注意 删除/收口测试，覆盖减少需确认 |             window.__BG_TEST_HARNESS__!.state.patch({
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:174 | 注意 删除/收口测试，覆盖减少需确认 |                 'sys.interaction.current': interaction,
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:175 | 注意 删除/收口测试，覆盖减少需确认 |             });
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:97 | OK 测试/覆盖新增，需与主链保持一致 |             return state;
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:178 | 注意 删除/收口测试，覆盖减少需确认 |         // 5. 验证弹窗显示
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:179 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(page.locator('text=选择玩家')).toBeVisible({ timeout: 5000 });
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:100 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(page.getByTestId('dt-status-owner-0')).toHaveAttribute('data-team-tone', 'self');
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:101 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(page.getByTestId('dt-status-effect-0-poison')).toBeVisible();
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:181 | 注意 删除/收口测试，覆盖减少需确认 |         // 6. 验证显示两个玩家选项
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:182 | 注意 删除/收口测试，覆盖减少需确认 |         const selfOption = page.locator('text=自己').or(page.locator('text=Self'));
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:183 | 注意 删除/收口测试，覆盖减少需确认 |         const opponentOption = page.locator('text=对手').or(page.locator('text=Opponent'));
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:184 | 注意 删除/收口测试，覆盖减少需确认 |         
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:185 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(selfOption).toBeVisible();
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:186 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(opponentOption).toBeVisible();
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:103 | OK 测试/覆盖新增，需与主链保持一致 |         const confirmButton = page.getByRole('button', { name: /确认|Confirm/i }).last();
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:104 | OK 测试/覆盖新增，需与主链保持一致 |         const cancelButton = page.getByRole('button', { name: /取消|Cancel/i }).last();
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:188 | 注意 删除/收口测试，覆盖减少需确认 |         // 7. 验证取消按钮存在
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:189 | 注意 删除/收口测试，覆盖减少需确认 |         const cancelButton = page.locator('button:has-text("取消")');
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:190 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(cancelButton).toBeVisible();
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:106 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(confirmButton).toBeDisabled();
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:193 | 注意 删除/收口测试，覆盖减少需确认 |         // 8. 点击取消
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:109 | OK 测试/覆盖新增，需与主链保持一致 |         await page.getByTestId('dt-status-effect-0-poison').click();
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:110 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(confirmButton).toBeEnabled();
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:111 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:113 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForInteractionClosed(page);
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:196 | 注意 删除/收口测试，覆盖减少需确认 |         // 9. 验证弹窗关闭
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:197 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(page.locator('text=选择玩家')).not.toBeVisible({ timeout: 3000 });
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:115 | OK 测试/覆盖新增，需与主链保持一致 |         const finalState = await readHarnessState<MatchState>(page);
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:116 | OK 测试/覆盖新增，需与主链保持一致 |         expect(finalState.core.players['0'].statusEffects.poison).toBe(2);
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:117 | OK 测试/覆盖新增，需与主链保持一致 |         expect(finalState.core.players['0'].statusEffects.burn).toBe(1);
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:200 | 注意 删除/收口测试，覆盖减少需确认 |     test('selectTargetStatus: should show two-phase transfer UI', async ({ page }) => {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:201 | 注意 删除/收口测试，覆盖减少需确认 |         // 1. 创建对局
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:202 | 注意 删除/收口测试，覆盖减少需确认 |         const { roomId } = await setupOnlineMatch(page, 'dicethrone', {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:203 | 注意 删除/收口测试，覆盖减少需确认 |             player0Character: 'barbarian',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:204 | 注意 删除/收口测试，覆盖减少需确认 |             player1Character: 'moon-elf',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:205 | 注意 删除/收口测试，覆盖减少需确认 |         });
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:206 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:207 | 注意 删除/收口测试，覆盖减少需确认 |         // 2. 等待测试工具就绪
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:208 | 注意 删除/收口测试，覆盖减少需确认 |         await waitForTestHarness(page);
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:209 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:210 | 注意 删除/收口测试，覆盖减少需确认 |         // 3. 注入状态
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:211 | 注意 删除/收口测试，覆盖减少需确认 |         await page.evaluate(() => {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:212 | 注意 删除/收口测试，覆盖减少需确认 |             window.__BG_TEST_HARNESS__!.state.patch({
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:213 | 注意 删除/收口测试，覆盖减少需确认 |                 'players.0.statusEffects': { poison: 2, burn: 1 },
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:214 | 注意 删除/收口测试，覆盖减少需确认 |             });
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:215 | 注意 删除/收口测试，覆盖减少需确认 |         });
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:216 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:217 | 注意 删除/收口测试，覆盖减少需确认 |         // 4. 创建转移状态交互（第一阶段：选择状态）
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:218 | 注意 删除/收口测试，覆盖减少需确认 |         await page.evaluate(() => {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:219 | 注意 删除/收口测试，覆盖减少需确认 |             const interaction = {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:220 | 注意 删除/收口测试，覆盖减少需确认 |                 id: 'test-transfer-status',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:221 | 注意 删除/收口测试，覆盖减少需确认 |                 kind: 'selectTargetStatus',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:222 | 注意 删除/收口测试，覆盖减少需确认 |                 playerId: '0',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:223 | 注意 删除/收口测试，覆盖减少需确认 |                 titleKey: 'interaction.selectStatusToTransfer',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:224 | 注意 删除/收口测试，覆盖减少需确认 |                 selectCount: 1,
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:225 | 注意 删除/收口测试，覆盖减少需确认 |                 targetPlayerIds: ['0'],
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:226 | 注意 删除/收口测试，覆盖减少需确认 |                 selected: [],
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:227 | 注意 删除/收口测试，覆盖减少需确认 |                 transferConfig: {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:228 | 注意 删除/收口测试，覆盖减少需确认 |                     sourcePlayerId: '0',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:229 | 注意 删除/收口测试，覆盖减少需确认 |                     statusId: '', // 第一阶段还未选择
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:230 | 注意 删除/收口测试，覆盖减少需确认 |                 },
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:231 | 注意 删除/收口测试，覆盖减少需确认 |             };
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:232 | 注意 删除/收口测试，覆盖减少需确认 |             
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:233 | 注意 删除/收口测试，覆盖减少需确认 |             window.__BG_TEST_HARNESS__!.state.patch({
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:234 | 注意 删除/收口测试，覆盖减少需确认 |                 'sys.interaction.current': interaction,
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:235 | 注意 删除/收口测试，覆盖减少需确认 |             });
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:236 | 注意 删除/收口测试，覆盖减少需确认 |         });
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:237 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:238 | 注意 删除/收口测试，覆盖减少需确认 |         // 5. 验证第一阶段弹窗显示
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:239 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(page.locator('text=选择要转移的状态')).toBeVisible({ timeout: 5000 });
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:240 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:241 | 注意 删除/收口测试，覆盖减少需确认 |         // 6. 验证取消按钮存在
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:242 | 注意 删除/收口测试，覆盖减少需确认 |         const cancelButton = page.locator('button:has-text("取消")');
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:243 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(cancelButton).toBeVisible();
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:244 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(cancelButton).toBeEnabled();
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:245 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:246 | 注意 删除/收口测试，覆盖减少需确认 |         // 7. 模拟选择状态后进入第二阶段
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:247 | 注意 删除/收口测试，覆盖减少需确认 |         await page.evaluate(() => {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:248 | 注意 删除/收口测试，覆盖减少需确认 |             const interaction = {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:249 | 注意 删除/收口测试，覆盖减少需确认 |                 id: 'test-transfer-status-phase2',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:250 | 注意 删除/收口测试，覆盖减少需确认 |                 kind: 'selectTargetStatus',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:251 | 注意 删除/收口测试，覆盖减少需确认 |                 playerId: '0',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:252 | 注意 删除/收口测试，覆盖减少需确认 |                 titleKey: 'interaction.selectStatusToTransfer',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:253 | 注意 删除/收口测试，覆盖减少需确认 |                 selectCount: 1,
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:254 | 注意 删除/收口测试，覆盖减少需确认 |                 targetPlayerIds: ['0', '1'],
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:255 | 注意 删除/收口测试，覆盖减少需确认 |                 selected: [],
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:256 | 注意 删除/收口测试，覆盖减少需确认 |                 transferConfig: {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:257 | 注意 删除/收口测试，覆盖减少需确认 |                     sourcePlayerId: '0',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:258 | 注意 删除/收口测试，覆盖减少需确认 |                     statusId: 'poison', // 已选择状态
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:259 | 注意 删除/收口测试，覆盖减少需确认 |                 },
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:120 | OK 测试/覆盖新增，需与主链保持一致 |     test('selectStatus: token 也走现役 dt-status-effect 选择器并可启用确认', async ({ page, game }) => {
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:121 | OK 测试/覆盖新增，需与主链保持一致 |         await openInteractionHarness(page, game);
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:122 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:123 | OK 测试/覆盖新增，需与主链保持一致 |         await applyHarnessState(page, (state) => {
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:124 | OK 测试/覆盖新增，需与主链保持一致 |             state.core.players['1'].statusEffects = {};
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:125 | OK 测试/覆盖新增，需与主链保持一致 |             state.core.players['1'].tokens = { crit: 1 };
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:126 | OK 测试/覆盖新增，需与主链保持一致 |             state.sys.interaction = {
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:127 | OK 测试/覆盖新增，需与主链保持一致 |                 ...(state.sys.interaction ?? {}),
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:128 | OK 测试/覆盖新增，需与主链保持一致 |                 current: wrapCardInteraction({
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:129 | OK 测试/覆盖新增，需与主链保持一致 |                     id: 'test-select-status-token',
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:130 | OK 测试/覆盖新增，需与主链保持一致 |                     type: 'selectStatus',
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:131 | OK 测试/覆盖新增，需与主链保持一致 |                     sourceCardId: 'test-card',
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:132 | OK 测试/覆盖新增，需与主链保持一致 |                     playerId: '0',
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:133 | OK 测试/覆盖新增，需与主链保持一致 |                     titleKey: 'interaction.selectStatusToRemove',
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:134 | OK 测试/覆盖新增，需与主链保持一致 |                     selectCount: 1,
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:135 | OK 测试/覆盖新增，需与主链保持一致 |                     targetPlayerIds: ['1'],
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:136 | OK 测试/覆盖新增，需与主链保持一致 |                     selected: [],
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:137 | OK 测试/覆盖新增，需与主链保持一致 |                 }),
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:261 | 注意 删除/收口测试，覆盖减少需确认 |             
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:262 | 注意 删除/收口测试，覆盖减少需确认 |             window.__BG_TEST_HARNESS__!.state.patch({
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:263 | 注意 删除/收口测试，覆盖减少需确认 |                 'sys.interaction.current': interaction,
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:264 | 注意 删除/收口测试，覆盖减少需确认 |             });
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:139 | OK 测试/覆盖新增，需与主链保持一致 |             return state;
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:267 | 注意 删除/收口测试，覆盖减少需确认 |         // 8. 验证第二阶段提示显示
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:268 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(page.locator('text=选择目标玩家')).toBeVisible({ timeout: 3000 });
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:269 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:270 | 注意 删除/收口测试，覆盖减少需确认 |         // 9. 验证取消按钮仍然存在
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:271 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(cancelButton).toBeVisible();
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:272 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(cancelButton).toBeEnabled();
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:273 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:274 | 注意 删除/收口测试，覆盖减少需确认 |         // 10. 点击取消
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:275 | 注意 删除/收口测试，覆盖减少需确认 |         await cancelButton.click();
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:142 | OK 测试/覆盖新增，需与主链保持一致 |         const confirmButton = page.getByRole('button', { name: /确认|Confirm/i }).last();
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:143 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(page.getByTestId('dt-status-owner-1')).toHaveAttribute('data-team-tone', 'enemy');
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:144 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(page.getByTestId('dt-status-effect-1-crit')).toBeVisible();
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:145 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(confirmButton).toBeDisabled();
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:277 | 注意 删除/收口测试，覆盖减少需确认 |         // 11. 验证弹窗关闭
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:278 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(page.locator('text=选择目标玩家')).not.toBeVisible({ timeout: 3000 });
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:147 | OK 测试/覆盖新增，需与主链保持一致 |         await page.getByTestId('dt-status-effect-1-crit').click();
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:148 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(confirmButton).toBeEnabled();
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:281 | 注意 删除/收口测试，覆盖减少需确认 |     test('should handle multiple status types correctly', async ({ page }) => {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:282 | 注意 删除/收口测试，覆盖减少需确认 |         // 1. 创建对局
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:283 | 注意 删除/收口测试，覆盖减少需确认 |         const { roomId } = await setupOnlineMatch(page, 'dicethrone', {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:284 | 注意 删除/收口测试，覆盖减少需确认 |             player0Character: 'barbarian',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:285 | 注意 删除/收口测试，覆盖减少需确认 |             player1Character: 'moon-elf',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:286 | 注意 删除/收口测试，覆盖减少需确认 |         });
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:287 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:288 | 注意 删除/收口测试，覆盖减少需确认 |         // 2. 等待测试工具就绪
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:289 | 注意 删除/收口测试，覆盖减少需确认 |         await waitForTestHarness(page);
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:290 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:291 | 注意 删除/收口测试，覆盖减少需确认 |         // 3. 注入多种状态效果
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:292 | 注意 删除/收口测试，覆盖减少需确认 |         await page.evaluate(() => {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:293 | 注意 删除/收口测试，覆盖减少需确认 |             window.__BG_TEST_HARNESS__!.state.patch({
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:294 | 注意 删除/收口测试，覆盖减少需确认 |                 'players.0.statusEffects': { 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:295 | 注意 删除/收口测试，覆盖减少需确认 |                     poison: 3, 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:296 | 注意 删除/收口测试，覆盖减少需确认 |                     burn: 2, 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:297 | 注意 删除/收口测试，覆盖减少需确认 |                     bleed: 1,
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:298 | 注意 删除/收口测试，覆盖减少需确认 |                     stun: 1,
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:299 | 注意 删除/收口测试，覆盖减少需确认 |                 },
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:300 | 注意 删除/收口测试，覆盖减少需确认 |             });
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:301 | 注意 删除/收口测试，覆盖减少需确认 |         });
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:302 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:303 | 注意 删除/收口测试，覆盖减少需确认 |         // 4. 创建交互
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:304 | 注意 删除/收口测试，覆盖减少需确认 |         await page.evaluate(() => {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:305 | 注意 删除/收口测试，覆盖减少需确认 |             const interaction = {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:306 | 注意 删除/收口测试，覆盖减少需确认 |                 id: 'test-multiple-status',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:307 | 注意 删除/收口测试，覆盖减少需确认 |                 kind: 'selectStatus',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:308 | 注意 删除/收口测试，覆盖减少需确认 |                 playerId: '0',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:309 | 注意 删除/收口测试，覆盖减少需确认 |                 titleKey: 'interaction.selectStatusToRemove',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:310 | 注意 删除/收口测试，覆盖减少需确认 |                 selectCount: 1,
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:311 | 注意 删除/收口测试，覆盖减少需确认 |                 targetPlayerIds: ['0'],
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:312 | 注意 删除/收口测试，覆盖减少需确认 |                 selected: [],
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:151 | OK 测试/覆盖新增，需与主链保持一致 |     test('selectPlayer: requiresTargetWithStatus 会禁用空目标并显示无状态提示', async ({ page, game }) => {
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:152 | OK 测试/覆盖新增，需与主链保持一致 |         await openInteractionHarness(page, game);
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:153 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:154 | OK 测试/覆盖新增，需与主链保持一致 |         await applyHarnessState(page, (state) => {
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:155 | OK 测试/覆盖新增，需与主链保持一致 |             state.core.players['0'].statusEffects = { poison: 1 };
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:156 | OK 测试/覆盖新增，需与主链保持一致 |             state.core.players['0'].tokens = {};
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:157 | OK 测试/覆盖新增，需与主链保持一致 |             state.core.players['1'].statusEffects = {};
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:158 | OK 测试/覆盖新增，需与主链保持一致 |             state.core.players['1'].tokens = {};
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:159 | OK 测试/覆盖新增，需与主链保持一致 |             state.sys.interaction = {
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:160 | OK 测试/覆盖新增，需与主链保持一致 |                 ...(state.sys.interaction ?? {}),
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:161 | OK 测试/覆盖新增，需与主链保持一致 |                 current: wrapCardInteraction({
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:162 | OK 测试/覆盖新增，需与主链保持一致 |                     id: 'test-select-player',
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:163 | OK 测试/覆盖新增，需与主链保持一致 |                     type: 'selectPlayer',
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:164 | OK 测试/覆盖新增，需与主链保持一致 |                     sourceCardId: 'test-card',
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:165 | OK 测试/覆盖新增，需与主链保持一致 |                     playerId: '0',
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:166 | OK 测试/覆盖新增，需与主链保持一致 |                     titleKey: 'interaction.selectPlayerToRemoveAllStatus',
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:167 | OK 测试/覆盖新增，需与主链保持一致 |                     selectCount: 1,
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:168 | OK 测试/覆盖新增，需与主链保持一致 |                     targetPlayerIds: ['0', '1'],
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:169 | OK 测试/覆盖新增，需与主链保持一致 |                     selected: [],
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:170 | OK 测试/覆盖新增，需与主链保持一致 |                     requiresTargetWithStatus: true,
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:171 | OK 测试/覆盖新增，需与主链保持一致 |                 }),
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:314 | 注意 删除/收口测试，覆盖减少需确认 |             
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:315 | 注意 删除/收口测试，覆盖减少需确认 |             window.__BG_TEST_HARNESS__!.state.patch({
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:316 | 注意 删除/收口测试，覆盖减少需确认 |                 'sys.interaction.current': interaction,
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:317 | 注意 删除/收口测试，覆盖减少需确认 |             });
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:173 | OK 测试/覆盖新增，需与主链保持一致 |             return state;
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:320 | 注意 删除/收口测试，覆盖减少需确认 |         // 5. 验证弹窗显示
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:321 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(page.locator('text=选择要移除的状态效果')).toBeVisible();
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:322 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:323 | 注意 删除/收口测试，覆盖减少需确认 |         // 6. 验证显示所有状态（至少应该看到多个状态徽章）
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:324 | 注意 删除/收口测试，覆盖减少需确认 |         const statusBadges = page.locator('[data-testid^="status-badge-"]').or(
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:325 | 注意 删除/收口测试，覆盖减少需确认 |             page.locator('[data-status-id]')
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:326 | 注意 删除/收口测试，覆盖减少需确认 |         );
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:327 | 注意 删除/收口测试，覆盖减少需确认 |         
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:328 | 注意 删除/收口测试，覆盖减少需确认 |         const badgeCount = await statusBadges.count();
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:329 | 注意 删除/收口测试，覆盖减少需确认 |         expect(badgeCount).toBeGreaterThanOrEqual(4); // 至少4种状态
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:176 | OK 测试/覆盖新增，需与主链保持一致 |         const confirmButton = page.getByRole('button', { name: /确认|Confirm/i }).last();
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:177 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(page.getByTestId('dt-player-target-0')).toHaveAttribute('data-team-tone', 'self');
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:178 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(page.getByTestId('dt-player-target-1')).toHaveAttribute('data-team-tone', 'enemy');
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:179 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(page.getByTestId('dt-player-target-1').getByText(/无状态|No Status/i)).toBeVisible();
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:180 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(confirmButton).toBeDisabled();
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:331 | 注意 删除/收口测试，覆盖减少需确认 |         // 7. 验证取消按钮
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:332 | 注意 删除/收口测试，覆盖减少需确认 |         const cancelButton = page.locator('button:has-text("取消")');
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:333 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(cancelButton).toBeVisible();
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:334 | 注意 删除/收口测试，覆盖减少需确认 |         await cancelButton.click();
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:182 | OK 测试/覆盖新增，需与主链保持一致 |         await page.getByTestId('dt-player-target-1').click();
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:183 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(confirmButton).toBeDisabled();
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:336 | 注意 删除/收口测试，覆盖减少需确认 |         // 8. 验证弹窗关闭
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:337 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(page.locator('text=选择要移除的状态效果')).not.toBeVisible();
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:185 | OK 测试/覆盖新增，需与主链保持一致 |         await page.getByTestId('dt-player-target-0').click();
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:186 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(confirmButton).toBeEnabled();
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:340 | 注意 删除/收口测试，覆盖减少需确认 |     test('should show "no status" message when player has no status', async ({ page }) => {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:341 | 注意 删除/收口测试，覆盖减少需确认 |         // 1. 创建对局
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:342 | 注意 删除/收口测试，覆盖减少需确认 |         const { roomId } = await setupOnlineMatch(page, 'dicethrone', {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:343 | 注意 删除/收口测试，覆盖减少需确认 |             player0Character: 'barbarian',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:344 | 注意 删除/收口测试，覆盖减少需确认 |             player1Character: 'moon-elf',
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:189 | OK 测试/覆盖新增，需与主链保持一致 |     test('selectTargetStatus: 第二阶段保留锁定来源卡，只显示真实目标卡', async ({ page, game }) => {
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:190 | OK 测试/覆盖新增，需与主链保持一致 |         await openInteractionHarness(page, game);
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:191 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:192 | OK 测试/覆盖新增，需与主链保持一致 |         await applyHarnessState(page, (state) => {
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:193 | OK 测试/覆盖新增，需与主链保持一致 |             state.core.players['0'].statusEffects = { poison: 2, burn: 1 };
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:194 | OK 测试/覆盖新增，需与主链保持一致 |             state.core.players['0'].tokens = {};
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:195 | OK 测试/覆盖新增，需与主链保持一致 |             state.core.players['1'].statusEffects = {};
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:196 | OK 测试/覆盖新增，需与主链保持一致 |             state.core.players['1'].tokens = {};
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:197 | OK 测试/覆盖新增，需与主链保持一致 |             state.sys.interaction = {
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:198 | OK 测试/覆盖新增，需与主链保持一致 |                 ...(state.sys.interaction ?? {}),
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:199 | OK 测试/覆盖新增，需与主链保持一致 |                 current: wrapCardInteraction({
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:200 | OK 测试/覆盖新增，需与主链保持一致 |                     id: 'test-transfer-phase-2',
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:201 | OK 测试/覆盖新增，需与主链保持一致 |                     type: 'selectTargetStatus',
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:202 | OK 测试/覆盖新增，需与主链保持一致 |                     sourceCardId: 'test-card',
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:203 | OK 测试/覆盖新增，需与主链保持一致 |                     playerId: '0',
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:204 | OK 测试/覆盖新增，需与主链保持一致 |                     titleKey: 'interaction.selectStatusToTransfer',
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:205 | OK 测试/覆盖新增，需与主链保持一致 |                     selectCount: 1,
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:206 | OK 测试/覆盖新增，需与主链保持一致 |                     targetPlayerIds: ['0', '1'],
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:207 | OK 测试/覆盖新增，需与主链保持一致 |                     selected: [],
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:208 | OK 测试/覆盖新增，需与主链保持一致 |                     transferConfig: {
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:209 | OK 测试/覆盖新增，需与主链保持一致 |                         sourcePlayerId: '0',
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:210 | OK 测试/覆盖新增，需与主链保持一致 |                         statusId: 'poison',
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:211 | OK 测试/覆盖新增，需与主链保持一致 |                     },
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:212 | OK 测试/覆盖新增，需与主链保持一致 |                 }),
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:213 | OK 测试/覆盖新增，需与主链保持一致 |             };
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:214 | OK 测试/覆盖新增，需与主链保持一致 |             return state;
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:347 | 注意 删除/收口测试，覆盖减少需确认 |         // 2. 等待测试工具就绪
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:348 | 注意 删除/收口测试，覆盖减少需确认 |         await waitForTestHarness(page);
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:349 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:350 | 注意 删除/收口测试，覆盖减少需确认 |         // 3. 确保玩家没有状态
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:351 | 注意 删除/收口测试，覆盖减少需确认 |         await page.evaluate(() => {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:352 | 注意 删除/收口测试，覆盖减少需确认 |             window.__BG_TEST_HARNESS__!.state.patch({
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:353 | 注意 删除/收口测试，覆盖减少需确认 |                 'players.0.statusEffects': {},
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:354 | 注意 删除/收口测试，覆盖减少需确认 |                 'players.1.statusEffects': {},
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:355 | 注意 删除/收口测试，覆盖减少需确认 |             });
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:356 | 注意 删除/收口测试，覆盖减少需确认 |         });
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:217 | OK 测试/覆盖新增，需与主链保持一致 |         const confirmButton = page.getByRole('button', { name: /确认|Confirm/i }).last();
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:218 | OK 测试/覆盖新增，需与主链保持一致 |         const cancelButton = page.getByRole('button', { name: /取消|Cancel/i }).last();
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:358 | 注意 删除/收口测试，覆盖减少需确认 |         // 4. 创建玩家选择交互
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:359 | 注意 删除/收口测试，覆盖减少需确认 |         await page.evaluate(() => {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:360 | 注意 删除/收口测试，覆盖减少需确认 |             const interaction = {
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:361 | 注意 删除/收口测试，覆盖减少需确认 |                 id: 'test-no-status',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:362 | 注意 删除/收口测试，覆盖减少需确认 |                 kind: 'selectPlayer',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:363 | 注意 删除/收口测试，覆盖减少需确认 |                 playerId: '0',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:364 | 注意 删除/收口测试，覆盖减少需确认 |                 titleKey: 'interaction.selectPlayerToRemoveAllStatus',
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:365 | 注意 删除/收口测试，覆盖减少需确认 |                 selectCount: 1,
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:366 | 注意 删除/收口测试，覆盖减少需确认 |                 targetPlayerIds: ['0', '1'],
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:367 | 注意 删除/收口测试，覆盖减少需确认 |                 selected: [],
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:368 | 注意 删除/收口测试，覆盖减少需确认 |             };
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:369 | 注意 删除/收口测试，覆盖减少需确认 |             
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:370 | 注意 删除/收口测试，覆盖减少需确认 |             window.__BG_TEST_HARNESS__!.state.patch({
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:371 | 注意 删除/收口测试，覆盖减少需确认 |                 'sys.interaction.current': interaction,
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:372 | 注意 删除/收口测试，覆盖减少需确认 |             });
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:373 | 注意 删除/收口测试，覆盖减少需确认 |         });
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:220 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(page.getByTestId('dt-transfer-source-locked-0')).toHaveAttribute('data-locked', 'true');
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:221 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(page.getByTestId('dt-transfer-source-locked-0')).toHaveAttribute('data-team-tone', 'self');
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:222 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(page.getByTestId('dt-transfer-target-1')).toHaveAttribute('data-team-tone', 'enemy');
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:223 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(page.getByTestId('dt-transfer-source-effect-poison')).toBeVisible();
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:224 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(page.locator('[data-testid^="dt-status-owner-"]')).toHaveCount(0);
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:225 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(confirmButton).toBeDisabled();
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:375 | 注意 删除/收口测试，覆盖减少需确认 |         // 5. 验证弹窗显示
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:376 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(page.locator('text=选择玩家')).toBeVisible();
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:227 | OK 测试/覆盖新增，需与主链保持一致 |         await page.getByTestId('dt-transfer-source-locked-0').click();
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:228 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(confirmButton).toBeDisabled();
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:378 | 注意 删除/收口测试，覆盖减少需确认 |         // 6. 验证显示"无状态"提示
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:379 | 注意 删除/收口测试，覆盖减少需确认 |         const noStatusMessage = page.locator('text=无状态').or(
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:380 | 注意 删除/收口测试，覆盖减少需确认 |             page.locator('text=No Status')
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:381 | 注意 删除/收口测试，覆盖减少需确认 |         );
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:382 | 注意 删除/收口测试，覆盖减少需确认 |         
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:383 | 注意 删除/收口测试，覆盖减少需确认 |         // 应该至少有一个"无状态"提示（两个玩家都没有状态）
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:384 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(noStatusMessage.first()).toBeVisible();
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:230 | OK 测试/覆盖新增，需与主链保持一致 |         await page.getByTestId('dt-transfer-target-1').click();
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:231 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(confirmButton).toBeEnabled();
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:386 | 注意 删除/收口测试，覆盖减少需确认 |         // 7. 验证取消按钮
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:387 | 注意 删除/收口测试，覆盖减少需确认 |         const cancelButton = page.locator('button:has-text("取消")');
DEL e2e/dicethrone-status-interaction-complete.e2e.ts:388 | 注意 删除/收口测试，覆盖减少需确认 |         await expect(cancelButton).toBeVisible();
ADD e2e/dicethrone-status-interaction-complete.e2e.ts:234 | OK 测试/覆盖新增，需与主链保持一致 |         await waitForInteractionClosed(page);
DEL e2e/dicethrone-status-removal.e2e.ts:1 | 注意 删除/收口测试，覆盖减少需确认 | /**
DEL e2e/dicethrone-status-removal.e2e.ts:2 | 注意 删除/收口测试，覆盖减少需确认 |  * DiceThrone - 选择状态移除 E2E 测试
DEL e2e/dicethrone-status-removal.e2e.ts:3 | 注意 删除/收口测试，覆盖减少需确认 |  * 
DEL e2e/dicethrone-status-removal.e2e.ts:4 | 注意 删除/收口测试，覆盖减少需确认 |  * 覆盖范围：
DEL e2e/dicethrone-status-removal.e2e.ts:5 | 注意 删除/收口测试，覆盖减少需确认 |  * - 移除1个状态（remove-status-1）：选择状态 + 移除
DEL e2e/dicethrone-status-removal.e2e.ts:6 | 注意 删除/收口测试，覆盖减少需确认 |  * - 移除自身状态（remove-status-self）：选择自身状态 + 移除
DEL e2e/dicethrone-status-removal.e2e.ts:7 | 注意 删除/收口测试，覆盖减少需确认 |  * - 移除所有状态（remove-all-status）：自动移除所有状态
DEL e2e/dicethrone-status-removal.e2e.ts:8 | 注意 删除/收口测试，覆盖减少需确认 |  * - 转移状态（transfer-status）：选择状态 + 选择目标
DEL e2e/dicethrone-status-removal.e2e.ts:9 | 注意 删除/收口测试，覆盖减少需确认 |  * 
DEL e2e/dicethrone-status-removal.e2e.ts:10 | 注意 删除/收口测试，覆盖减少需确认 |  * 交互模式：选择状态移除
DEL e2e/dicethrone-status-removal.e2e.ts:11 | 注意 删除/收口测试，覆盖减少需确认 |  * - 点击技能按钮/打出卡牌
DEL e2e/dicethrone-status-removal.e2e.ts:12 | 注意 删除/收口测试，覆盖减少需确认 |  * - 状态图标高亮
DEL e2e/dicethrone-status-removal.e2e.ts:13 | 注意 删除/收口测试，覆盖减少需确认 |  * - 点击选择状态
DEL e2e/dicethrone-status-removal.e2e.ts:14 | 注意 删除/收口测试，覆盖减少需确认 |  * - 确认
DEL e2e/dicethrone-status-removal.e2e.ts:15 | 注意 删除/收口测试，覆盖减少需确认 |  * - 状态移除
DEL e2e/dicethrone-status-removal.e2e.ts:16 | 注意 删除/收口测试，覆盖减少需确认 |  */
DEL e2e/dicethrone-status-removal.e2e.ts:17 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:18 | 注意 删除/收口测试，覆盖减少需确认 | import { test, expect } from '@playwright/test';
DEL e2e/dicethrone-status-removal.e2e.ts:19 | 注意 删除/收口测试，覆盖减少需确认 | import { setupDTOnlineMatch, selectCharacter, waitForGameBoard } from './helpers/dicethrone';
DEL e2e/dicethrone-status-removal.e2e.ts:20 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:21 | 注意 删除/收口测试，覆盖减少需确认 | test.describe('DiceThrone - 选择状态移除', () => {
DEL e2e/dicethrone-status-removal.e2e.ts:22 | 注意 删除/收口测试，覆盖减少需确认 |   test('移除1个状态：选择状态并移除', async ({ browser }, testInfo) => {
DEL e2e/dicethrone-status-removal.e2e.ts:23 | 注意 删除/收口测试，覆盖减少需确认 |     const baseURL = testInfo.project.use.baseURL as string | undefined;
DEL e2e/dicethrone-status-removal.e2e.ts:24 | 注意 删除/收口测试，覆盖减少需确认 |     const setup = await setupDTOnlineMatch(browser, baseURL);
DEL e2e/dicethrone-status-removal.e2e.ts:25 | 注意 删除/收口测试，覆盖减少需确认 |     
DEL e2e/dicethrone-status-removal.e2e.ts:26 | 注意 删除/收口测试，覆盖减少需确认 |     if (!setup) {
DEL e2e/dicethrone-status-removal.e2e.ts:27 | 注意 删除/收口测试，覆盖减少需确认 |       test.skip(true, '游戏服务器不可用或创建房间失败');
DEL e2e/dicethrone-status-removal.e2e.ts:28 | 注意 删除/收口测试，覆盖减少需确认 |       return;
DEL e2e/dicethrone-status-removal.e2e.ts:29 | 注意 删除/收口测试，覆盖减少需确认 |     }
DEL e2e/dicethrone-status-removal.e2e.ts:30 | 注意 删除/收口测试，覆盖减少需确认 |     
DEL e2e/dicethrone-status-removal.e2e.ts:31 | 注意 删除/收口测试，覆盖减少需确认 |     const { hostPage } = setup;
DEL e2e/dicethrone-status-removal.e2e.ts:32 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:33 | 注意 删除/收口测试，覆盖减少需确认 |     // 1. 选择英雄并开始游戏
DEL e2e/dicethrone-status-removal.e2e.ts:34 | 注意 删除/收口测试，覆盖减少需确认 |     await selectCharacter(hostPage, 'paladin');
DEL e2e/dicethrone-status-removal.e2e.ts:35 | 注意 删除/收口测试，覆盖减少需确认 |     await selectCharacter(setup.guestPage, 'shadow_thief');
DEL e2e/dicethrone-status-removal.e2e.ts:36 | 注意 删除/收口测试，覆盖减少需确认 |     await waitForGameBoard(hostPage);
DEL e2e/dicethrone-status-removal.e2e.ts:37 | 注意 删除/收口测试，覆盖减少需确认 |     await startButton.click();
DEL e2e/dicethrone-status-removal.e2e.ts:38 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:39 | 注意 删除/收口测试，覆盖减少需确认 |     // 等待游戏开始
DEL e2e/dicethrone-status-removal.e2e.ts:40 | 注意 删除/收口测试，覆盖减少需确认 |     await expect(page.getByTestId('dt-phase-banner')).toBeVisible({ timeout: 10000 });
DEL e2e/dicethrone-status-removal.e2e.ts:41 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:42 | 注意 删除/收口测试，覆盖减少需确认 |     // 2. 推进到主要阶段1（可以打出卡牌）
DEL e2e/dicethrone-status-removal.e2e.ts:43 | 注意 删除/收口测试，覆盖减少需确认 |     const advanceButton = page.getByRole('button', { name: /推进阶段|Advance Phase/i });
DEL e2e/dicethrone-status-removal.e2e.ts:44 | 注意 删除/收口测试，覆盖减少需确认 |     
DEL e2e/dicethrone-status-removal.e2e.ts:45 | 注意 删除/收口测试，覆盖减少需确认 |     // 跳过收入阶段
DEL e2e/dicethrone-status-removal.e2e.ts:46 | 注意 删除/收口测试，覆盖减少需确认 |     await expect(advanceButton).toBeEnabled({ timeout: 5000 });
DEL e2e/dicethrone-status-removal.e2e.ts:47 | 注意 删除/收口测试，覆盖减少需确认 |     await advanceButton.click();
DEL e2e/dicethrone-status-removal.e2e.ts:48 | 注意 删除/收口测试，覆盖减少需确认 |     await page.waitForTimeout(500);
DEL e2e/dicethrone-status-removal.e2e.ts:49 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:50 | 注意 删除/收口测试，覆盖减少需确认 |     // 跳过进攻投掷阶段（如果需要）
DEL e2e/dicethrone-status-removal.e2e.ts:51 | 注意 删除/收口测试，覆盖减少需确认 |     const currentPhase = await page.getByTestId('dt-phase-banner').textContent();
DEL e2e/dicethrone-status-removal.e2e.ts:52 | 注意 删除/收口测试，覆盖减少需确认 |     if (currentPhase?.includes('进攻投掷') || currentPhase?.includes('Offensive Roll')) {
DEL e2e/dicethrone-status-removal.e2e.ts:53 | 注意 删除/收口测试，覆盖减少需确认 |       // 投掷骰子
DEL e2e/dicethrone-status-removal.e2e.ts:54 | 注意 删除/收口测试，覆盖减少需确认 |       const rollButton = page.getByRole('button', { name: /投掷骰子|Roll Dice/i });
DEL e2e/dicethrone-status-removal.e2e.ts:55 | 注意 删除/收口测试，覆盖减少需确认 |       if (await rollButton.isVisible().catch(() => false)) {
DEL e2e/dicethrone-status-removal.e2e.ts:56 | 注意 删除/收口测试，覆盖减少需确认 |         await rollButton.click();
DEL e2e/dicethrone-status-removal.e2e.ts:57 | 注意 删除/收口测试，覆盖减少需确认 |         await page.waitForTimeout(1000);
DEL e2e/dicethrone-status-removal.e2e.ts:58 | 注意 删除/收口测试，覆盖减少需确认 |         
DEL e2e/dicethrone-status-removal.e2e.ts:59 | 注意 删除/收口测试，覆盖减少需确认 |         // 确认骰面
DEL e2e/dicethrone-status-removal.e2e.ts:60 | 注意 删除/收口测试，覆盖减少需确认 |         const confirmButton = page.getByRole('button', { name: /确认骰面|Confirm Dice/i });
DEL e2e/dicethrone-status-removal.e2e.ts:61 | 注意 删除/收口测试，覆盖减少需确认 |         if (await confirmButton.isVisible().catch(() => false)) {
DEL e2e/dicethrone-status-removal.e2e.ts:62 | 注意 删除/收口测试，覆盖减少需确认 |           await confirmButton.click();
DEL e2e/dicethrone-status-removal.e2e.ts:63 | 注意 删除/收口测试，覆盖减少需确认 |           await page.waitForTimeout(500);
DEL e2e/dicethrone-status-removal.e2e.ts:64 | 注意 删除/收口测试，覆盖减少需确认 |         }
DEL e2e/dicethrone-status-removal.e2e.ts:65 | 注意 删除/收口测试，覆盖减少需确认 |       }
DEL e2e/dicethrone-status-removal.e2e.ts:66 | 注意 删除/收口测试，覆盖减少需确认 |       
DEL e2e/dicethrone-status-removal.e2e.ts:67 | 注意 删除/收口测试，覆盖减少需确认 |       // 推进到主要阶段1
DEL e2e/dicethrone-status-removal.e2e.ts:68 | 注意 删除/收口测试，覆盖减少需确认 |       await advanceButton.click();
DEL e2e/dicethrone-status-removal.e2e.ts:69 | 注意 删除/收口测试，覆盖减少需确认 |       await page.waitForTimeout(500);
DEL e2e/dicethrone-status-removal.e2e.ts:70 | 注意 删除/收口测试，覆盖减少需确认 |     }
DEL e2e/dicethrone-status-removal.e2e.ts:71 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:72 | 注意 删除/收口测试，覆盖减少需确认 |     // 3. 先给自己添加一个状态（通过打出状态卡牌）
DEL e2e/dicethrone-status-removal.e2e.ts:73 | 注意 删除/收口测试，覆盖减少需确认 |     const handArea = page.getByTestId('dt-hand-area');
DEL e2e/dicethrone-status-removal.e2e.ts:74 | 注意 删除/收口测试，覆盖减少需确认 |     await expect(handArea).toBeVisible({ timeout: 5000 });
DEL e2e/dicethrone-status-removal.e2e.ts:75 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:76 | 注意 删除/收口测试，覆盖减少需确认 |     // 查找能添加状态的卡牌（如毒、燃烧等）
DEL e2e/dicethrone-status-removal.e2e.ts:77 | 注意 删除/收口测试，覆盖减少需确认 |     const statusCard = handArea.locator('[data-card-effect*="poison"]').or(
DEL e2e/dicethrone-status-removal.e2e.ts:78 | 注意 删除/收口测试，覆盖减少需确认 |       handArea.locator('[data-card-effect*="burn"]').or(
DEL e2e/dicethrone-status-removal.e2e.ts:79 | 注意 删除/收口测试，覆盖减少需确认 |         handArea.locator('[data-card-name*="毒"]').or(
DEL e2e/dicethrone-status-removal.e2e.ts:80 | 注意 删除/收口测试，覆盖减少需确认 |           handArea.locator('[data-card-name*="燃烧"]')
DEL e2e/dicethrone-status-removal.e2e.ts:81 | 注意 删除/收口测试，覆盖减少需确认 |         )
DEL e2e/dicethrone-status-removal.e2e.ts:82 | 注意 删除/收口测试，覆盖减少需确认 |       )
DEL e2e/dicethrone-status-removal.e2e.ts:83 | 注意 删除/收口测试，覆盖减少需确认 |     ).first();
DEL e2e/dicethrone-status-removal.e2e.ts:84 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:85 | 注意 删除/收口测试，覆盖减少需确认 |     // 如果有状态卡牌，先打出添加状态
DEL e2e/dicethrone-status-removal.e2e.ts:86 | 注意 删除/收口测试，覆盖减少需确认 |     if (await statusCard.isVisible().catch(() => false)) {
DEL e2e/dicethrone-status-removal.e2e.ts:87 | 注意 删除/收口测试，覆盖减少需确认 |       await statusCard.click();
DEL e2e/dicethrone-status-removal.e2e.ts:88 | 注意 删除/收口测试，覆盖减少需确认 |       await page.waitForTimeout(1000);
DEL e2e/dicethrone-status-removal.e2e.ts:89 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:90 | 注意 删除/收口测试，覆盖减少需确认 |       // 如果需要选择目标，选择自己
DEL e2e/dicethrone-status-removal.e2e.ts:91 | 注意 删除/收口测试，覆盖减少需确认 |       const targetSelector = page.locator('[data-testid="target-selector"]');
DEL e2e/dicethrone-status-removal.e2e.ts:92 | 注意 删除/收口测试，覆盖减少需确认 |       if (await targetSelector.isVisible().catch(() => false)) {
DEL e2e/dicethrone-status-removal.e2e.ts:93 | 注意 删除/收口测试，覆盖减少需确认 |         const selfTarget = page.locator('[data-target="self"]').or(
DEL e2e/dicethrone-status-removal.e2e.ts:94 | 注意 删除/收口测试，覆盖减少需确认 |           page.locator('[data-player="0"]')
DEL e2e/dicethrone-status-removal.e2e.ts:95 | 注意 删除/收口测试，覆盖减少需确认 |         ).first();
DEL e2e/dicethrone-status-removal.e2e.ts:96 | 注意 删除/收口测试，覆盖减少需确认 |         if (await selfTarget.isVisible().catch(() => false)) {
DEL e2e/dicethrone-status-removal.e2e.ts:97 | 注意 删除/收口测试，覆盖减少需确认 |           await selfTarget.click();
DEL e2e/dicethrone-status-removal.e2e.ts:98 | 注意 删除/收口测试，覆盖减少需确认 |           await page.waitForTimeout(500);
DEL e2e/dicethrone-status-removal.e2e.ts:99 | 注意 删除/收口测试，覆盖减少需确认 |         }
DEL e2e/dicethrone-status-removal.e2e.ts:100 | 注意 删除/收口测试，覆盖减少需确认 |       }
DEL e2e/dicethrone-status-removal.e2e.ts:101 | 注意 删除/收口测试，覆盖减少需确认 |     }
DEL e2e/dicethrone-status-removal.e2e.ts:102 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:103 | 注意 删除/收口测试，覆盖减少需确认 |     // 4. 验证状态图标出现
DEL e2e/dicethrone-status-removal.e2e.ts:104 | 注意 删除/收口测试，覆盖减少需确认 |     const statusArea = page.locator('[data-testid="status-area"]').or(
DEL e2e/dicethrone-status-removal.e2e.ts:105 | 注意 删除/收口测试，覆盖减少需确认 |       page.locator('[class*="status"]')
DEL e2e/dicethrone-status-removal.e2e.ts:106 | 注意 删除/收口测试，覆盖减少需确认 |     );
DEL e2e/dicethrone-status-removal.e2e.ts:107 | 注意 删除/收口测试，覆盖减少需确认 |     
DEL e2e/dicethrone-status-removal.e2e.ts:108 | 注意 删除/收口测试，覆盖减少需确认 |     const statusIcons = statusArea.locator('[data-testid^="status-"]').or(
DEL e2e/dicethrone-status-removal.e2e.ts:109 | 注意 删除/收口测试，覆盖减少需确认 |       statusArea.locator('[class*="status-icon"]')
DEL e2e/dicethrone-status-removal.e2e.ts:110 | 注意 删除/收口测试，覆盖减少需确认 |     );
DEL e2e/dicethrone-status-removal.e2e.ts:111 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:112 | 注意 删除/收口测试，覆盖减少需确认 |     // 如果没有状态，跳过测试
DEL e2e/dicethrone-status-removal.e2e.ts:113 | 注意 删除/收口测试，覆盖减少需确认 |     const statusCount = await statusIcons.count().catch(() => 0);
DEL e2e/dicethrone-status-removal.e2e.ts:114 | 注意 删除/收口测试，覆盖减少需确认 |     if (statusCount === 0) {
DEL e2e/dicethrone-status-removal.e2e.ts:115 | 注意 删除/收口测试，覆盖减少需确认 |       test.skip(true, '没有状态可以移除');
DEL e2e/dicethrone-status-removal.e2e.ts:116 | 注意 删除/收口测试，覆盖减少需确认 |     }
DEL e2e/dicethrone-status-removal.e2e.ts:117 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:118 | 注意 删除/收口测试，覆盖减少需确认 |     const firstStatus = statusIcons.first();
DEL e2e/dicethrone-status-removal.e2e.ts:119 | 注意 删除/收口测试，覆盖减少需确认 |     await expect(firstStatus).toBeVisible({ timeout: 5000 });
DEL e2e/dicethrone-status-removal.e2e.ts:120 | 注意 删除/收口测试，覆盖减少需确认 |     const initialStatusId = await firstStatus.getAttribute('data-status-id').catch(() => null);
DEL e2e/dicethrone-status-removal.e2e.ts:121 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:122 | 注意 删除/收口测试，覆盖减少需确认 |     // 5. 查找并打出"移除状态"的卡牌
DEL e2e/dicethrone-status-removal.e2e.ts:123 | 注意 删除/收口测试，覆盖减少需确认 |     const removeCard = handArea.locator('[data-card-effect*="remove-status"]').or(
DEL e2e/dicethrone-status-removal.e2e.ts:124 | 注意 删除/收口测试，覆盖减少需确认 |       handArea.locator('[data-card-name*="净化"]').or(
DEL e2e/dicethrone-status-removal.e2e.ts:125 | 注意 删除/收口测试，覆盖减少需确认 |         handArea.locator('[data-card-name*="Purify"]').or(
DEL e2e/dicethrone-status-removal.e2e.ts:126 | 注意 删除/收口测试，覆盖减少需确认 |           handArea.locator('[data-card-name*="移除"]')
DEL e2e/dicethrone-status-removal.e2e.ts:127 | 注意 删除/收口测试，覆盖减少需确认 |         )
DEL e2e/dicethrone-status-removal.e2e.ts:128 | 注意 删除/收口测试，覆盖减少需确认 |       )
DEL e2e/dicethrone-status-removal.e2e.ts:129 | 注意 删除/收口测试，覆盖减少需确认 |     ).first();
DEL e2e/dicethrone-status-removal.e2e.ts:130 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:131 | 注意 删除/收口测试，覆盖减少需确认 |     if (!await removeCard.isVisible().catch(() => false)) {
DEL e2e/dicethrone-status-removal.e2e.ts:132 | 注意 删除/收口测试，覆盖减少需确认 |       test.skip(true, '手牌中没有移除状态卡牌');
DEL e2e/dicethrone-status-removal.e2e.ts:133 | 注意 删除/收口测试，覆盖减少需确认 |     }
DEL e2e/dicethrone-status-removal.e2e.ts:134 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:135 | 注意 删除/收口测试，覆盖减少需确认 |     // 打出卡牌
DEL e2e/dicethrone-status-removal.e2e.ts:136 | 注意 删除/收口测试，覆盖减少需确认 |     await removeCard.click();
DEL e2e/dicethrone-status-removal.e2e.ts:137 | 注意 删除/收口测试，覆盖减少需确认 |     await page.waitForTimeout(500);
DEL e2e/dicethrone-status-removal.e2e.ts:138 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:139 | 注意 删除/收口测试，覆盖减少需确认 |     // 6. 验证状态选择界面出现
DEL e2e/dicethrone-status-removal.e2e.ts:140 | 注意 删除/收口测试，覆盖减少需确认 |     const statusSelector = page.locator('[data-testid="status-selector"]').or(
DEL e2e/dicethrone-status-removal.e2e.ts:141 | 注意 删除/收口测试，覆盖减少需确认 |       page.locator('[class*="status-select"]').or(
DEL e2e/dicethrone-status-removal.e2e.ts:142 | 注意 删除/收口测试，覆盖减少需确认 |         page.getByText(/选择状态|Select Status/i)
DEL e2e/dicethrone-status-removal.e2e.ts:143 | 注意 删除/收口测试，覆盖减少需确认 |       )
DEL e2e/dicethrone-status-removal.e2e.ts:144 | 注意 删除/收口测试，覆盖减少需确认 |     );
DEL e2e/dicethrone-status-removal.e2e.ts:145 | 注意 删除/收口测试，覆盖减少需确认 |     await expect(statusSelector).toBeVisible({ timeout: 8000 });
DEL e2e/dicethrone-status-removal.e2e.ts:146 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:147 | 注意 删除/收口测试，覆盖减少需确认 |     // 7. 选择第一个状态
DEL e2e/dicethrone-status-removal.e2e.ts:148 | 注意 删除/收口测试，覆盖减少需确认 |     const selectableStatus = statusArea.locator('[data-testid^="status-"][data-selectable="true"]').or(
DEL e2e/dicethrone-status-removal.e2e.ts:149 | 注意 删除/收口测试，覆盖减少需确认 |       statusArea.locator('[data-testid^="status-"][class*="selectable"]')
DEL e2e/dicethrone-status-removal.e2e.ts:150 | 注意 删除/收口测试，覆盖减少需确认 |     ).first();
DEL e2e/dicethrone-status-removal.e2e.ts:151 | 注意 删除/收口测试，覆盖减少需确认 |     await expect(selectableStatus).toBeVisible({ timeout: 3000 });
DEL e2e/dicethrone-status-removal.e2e.ts:152 | 注意 删除/收口测试，覆盖减少需确认 |     await selectableStatus.click();
DEL e2e/dicethrone-status-removal.e2e.ts:153 | 注意 删除/收口测试，覆盖减少需确认 |     await page.waitForTimeout(500);
DEL e2e/dicethrone-status-removal.e2e.ts:154 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:155 | 注意 删除/收口测试，覆盖减少需确认 |     // 8. 确认选择（如果需要）
DEL e2e/dicethrone-status-removal.e2e.ts:156 | 注意 删除/收口测试，覆盖减少需确认 |     const confirmButton = page.getByRole('button', { name: /确认|Confirm|完成|Done/i });
DEL e2e/dicethrone-status-removal.e2e.ts:157 | 注意 删除/收口测试，覆盖减少需确认 |     if (await confirmButton.isVisible().catch(() => false)) {
DEL e2e/dicethrone-status-removal.e2e.ts:158 | 注意 删除/收口测试，覆盖减少需确认 |       await confirmButton.click();
DEL e2e/dicethrone-status-removal.e2e.ts:159 | 注意 删除/收口测试，覆盖减少需确认 |       await page.waitForTimeout(500);
DEL e2e/dicethrone-status-removal.e2e.ts:160 | 注意 删除/收口测试，覆盖减少需确认 |     }
DEL e2e/dicethrone-status-removal.e2e.ts:161 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:162 | 注意 删除/收口测试，覆盖减少需确认 |     // 9. 验证状态被移除
DEL e2e/dicethrone-status-removal.e2e.ts:163 | 注意 删除/收口测试，覆盖减少需确认 |     await expect.poll(async () => {
DEL e2e/dicethrone-status-removal.e2e.ts:164 | 注意 删除/收口测试，覆盖减少需确认 |       const currentStatusCount = await statusIcons.count().catch(() => 0);
DEL e2e/dicethrone-status-removal.e2e.ts:165 | 注意 删除/收口测试，覆盖减少需确认 |       return currentStatusCount < statusCount;
DEL e2e/dicethrone-status-removal.e2e.ts:166 | 注意 删除/收口测试，覆盖减少需确认 |     }, { timeout: 5000 }).toBe(true);
DEL e2e/dicethrone-status-removal.e2e.ts:167 | 注意 删除/收口测试，覆盖减少需确认 |   });
DEL e2e/dicethrone-status-removal.e2e.ts:168 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:169 | 注意 删除/收口测试，覆盖减少需确认 |   test('移除自身状态：自动移除所有自身状态', async ({ page }) => {
DEL e2e/dicethrone-status-removal.e2e.ts:170 | 注意 删除/收口测试，覆盖减少需确认 |     // 1. 选择英雄并开始游戏
DEL e2e/dicethrone-status-removal.e2e.ts:171 | 注意 删除/收口测试，覆盖减少需确认 |     const heroCard = page.locator('[data-testid="hero-card"]').first();
DEL e2e/dicethrone-status-removal.e2e.ts:172 | 注意 删除/收口测试，覆盖减少需确认 |     await expect(heroCard).toBeVisible({ timeout: 10000 });
DEL e2e/dicethrone-status-removal.e2e.ts:173 | 注意 删除/收口测试，覆盖减少需确认 |     await heroCard.click();
DEL e2e/dicethrone-status-removal.e2e.ts:174 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:175 | 注意 删除/收口测试，覆盖减少需确认 |     const startButton = page.getByRole('button', { name: /开始游戏|Start Game/i });
DEL e2e/dicethrone-status-removal.e2e.ts:176 | 注意 删除/收口测试，覆盖减少需确认 |     await expect(startButton).toBeVisible({ timeout: 5000 });
DEL e2e/dicethrone-status-removal.e2e.ts:177 | 注意 删除/收口测试，覆盖减少需确认 |     await startButton.click();
DEL e2e/dicethrone-status-removal.e2e.ts:178 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:179 | 注意 删除/收口测试，覆盖减少需确认 |     await expect(page.getByTestId('dt-phase-banner')).toBeVisible({ timeout: 10000 });
DEL e2e/dicethrone-status-removal.e2e.ts:180 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:181 | 注意 删除/收口测试，覆盖减少需确认 |     // 2. 推进到可以使用技能的阶段
DEL e2e/dicethrone-status-removal.e2e.ts:182 | 注意 删除/收口测试，覆盖减少需确认 |     const advanceButton = page.getByRole('button', { name: /推进阶段|Advance Phase/i });
DEL e2e/dicethrone-status-removal.e2e.ts:183 | 注意 删除/收口测试，覆盖减少需确认 |     await expect(advanceButton).toBeEnabled({ timeout: 5000 });
DEL e2e/dicethrone-status-removal.e2e.ts:184 | 注意 删除/收口测试，覆盖减少需确认 |     await advanceButton.click();
DEL e2e/dicethrone-status-removal.e2e.ts:185 | 注意 删除/收口测试，覆盖减少需确认 |     await page.waitForTimeout(500);
DEL e2e/dicethrone-status-removal.e2e.ts:186 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:187 | 注意 删除/收口测试，覆盖减少需确认 |     // 跳过投掷阶段
DEL e2e/dicethrone-status-removal.e2e.ts:188 | 注意 删除/收口测试，覆盖减少需确认 |     const currentPhase = await page.getByTestId('dt-phase-banner').textContent();
DEL e2e/dicethrone-status-removal.e2e.ts:189 | 注意 删除/收口测试，覆盖减少需确认 |     if (currentPhase?.includes('进攻投掷') || currentPhase?.includes('Offensive Roll')) {
DEL e2e/dicethrone-status-removal.e2e.ts:190 | 注意 删除/收口测试，覆盖减少需确认 |       const rollButton = page.getByRole('button', { name: /投掷骰子|Roll Dice/i });
DEL e2e/dicethrone-status-removal.e2e.ts:191 | 注意 删除/收口测试，覆盖减少需确认 |       if (await rollButton.isVisible().catch(() => false)) {
DEL e2e/dicethrone-status-removal.e2e.ts:192 | 注意 删除/收口测试，覆盖减少需确认 |         await rollButton.click();
DEL e2e/dicethrone-status-removal.e2e.ts:193 | 注意 删除/收口测试，覆盖减少需确认 |         await page.waitForTimeout(1000);
DEL e2e/dicethrone-status-removal.e2e.ts:194 | 注意 删除/收口测试，覆盖减少需确认 |         
DEL e2e/dicethrone-status-removal.e2e.ts:195 | 注意 删除/收口测试，覆盖减少需确认 |         const confirmButton = page.getByRole('button', { name: /确认骰面|Confirm Dice/i });
DEL e2e/dicethrone-status-removal.e2e.ts:196 | 注意 删除/收口测试，覆盖减少需确认 |         if (await confirmButton.isVisible().catch(() => false)) {
DEL e2e/dicethrone-status-removal.e2e.ts:197 | 注意 删除/收口测试，覆盖减少需确认 |           await confirmButton.click();
DEL e2e/dicethrone-status-removal.e2e.ts:198 | 注意 删除/收口测试，覆盖减少需确认 |           await page.waitForTimeout(500);
DEL e2e/dicethrone-status-removal.e2e.ts:199 | 注意 删除/收口测试，覆盖减少需确认 |         }
DEL e2e/dicethrone-status-removal.e2e.ts:200 | 注意 删除/收口测试，覆盖减少需确认 |       }
DEL e2e/dicethrone-status-removal.e2e.ts:201 | 注意 删除/收口测试，覆盖减少需确认 |       
DEL e2e/dicethrone-status-removal.e2e.ts:202 | 注意 删除/收口测试，覆盖减少需确认 |       await advanceButton.click();
DEL e2e/dicethrone-status-removal.e2e.ts:203 | 注意 删除/收口测试，覆盖减少需确认 |       await page.waitForTimeout(500);
DEL e2e/dicethrone-status-removal.e2e.ts:204 | 注意 删除/收口测试，覆盖减少需确认 |     }
DEL e2e/dicethrone-status-removal.e2e.ts:205 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:206 | 注意 删除/收口测试，覆盖减少需确认 |     // 3. 先给自己添加状态
DEL e2e/dicethrone-status-removal.e2e.ts:207 | 注意 删除/收口测试，覆盖减少需确认 |     const handArea = page.getByTestId('dt-hand-area');
DEL e2e/dicethrone-status-removal.e2e.ts:208 | 注意 删除/收口测试，覆盖减少需确认 |     await expect(handArea).toBeVisible({ timeout: 5000 });
DEL e2e/dicethrone-status-removal.e2e.ts:209 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:210 | 注意 删除/收口测试，覆盖减少需确认 |     const statusCard = handArea.locator('[data-card-effect*="poison"]').or(
DEL e2e/dicethrone-status-removal.e2e.ts:211 | 注意 删除/收口测试，覆盖减少需确认 |       handArea.locator('[data-card-effect*="burn"]')
DEL e2e/dicethrone-status-removal.e2e.ts:212 | 注意 删除/收口测试，覆盖减少需确认 |     ).first();
DEL e2e/dicethrone-status-removal.e2e.ts:213 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:214 | 注意 删除/收口测试，覆盖减少需确认 |     if (await statusCard.isVisible().catch(() => false)) {
DEL e2e/dicethrone-status-removal.e2e.ts:215 | 注意 删除/收口测试，覆盖减少需确认 |       await statusCard.click();
DEL e2e/dicethrone-status-removal.e2e.ts:216 | 注意 删除/收口测试，覆盖减少需确认 |       await page.waitForTimeout(1000);
DEL e2e/dicethrone-status-removal.e2e.ts:217 | 注意 删除/收口测试，覆盖减少需确认 |     }
DEL e2e/dicethrone-status-removal.e2e.ts:218 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:219 | 注意 删除/收口测试，覆盖减少需确认 |     // 4. 验证状态存在
DEL e2e/dicethrone-status-removal.e2e.ts:220 | 注意 删除/收口测试，覆盖减少需确认 |     const statusArea = page.locator('[data-testid="status-area"]').or(
DEL e2e/dicethrone-status-removal.e2e.ts:221 | 注意 删除/收口测试，覆盖减少需确认 |       page.locator('[class*="status"]')
DEL e2e/dicethrone-status-removal.e2e.ts:222 | 注意 删除/收口测试，覆盖减少需确认 |     );
DEL e2e/dicethrone-status-removal.e2e.ts:223 | 注意 删除/收口测试，覆盖减少需确认 |     
DEL e2e/dicethrone-status-removal.e2e.ts:224 | 注意 删除/收口测试，覆盖减少需确认 |     const statusIcons = statusArea.locator('[data-testid^="status-"]');
DEL e2e/dicethrone-status-removal.e2e.ts:225 | 注意 删除/收口测试，覆盖减少需确认 |     const initialStatusCount = await statusIcons.count().catch(() => 0);
DEL e2e/dicethrone-status-removal.e2e.ts:226 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:227 | 注意 删除/收口测试，覆盖减少需确认 |     if (initialStatusCount === 0) {
DEL e2e/dicethrone-status-removal.e2e.ts:228 | 注意 删除/收口测试，覆盖减少需确认 |       test.skip(true, '没有状态可以移除');
DEL e2e/dicethrone-status-removal.e2e.ts:229 | 注意 删除/收口测试，覆盖减少需确认 |     }
DEL e2e/dicethrone-status-removal.e2e.ts:230 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:231 | 注意 删除/收口测试，覆盖减少需确认 |     // 5. 查找并使用"移除所有状态"的卡牌/技能
DEL e2e/dicethrone-status-removal.e2e.ts:232 | 注意 删除/收口测试，覆盖减少需确认 |     const removeAllCard = handArea.locator('[data-card-effect*="remove-all-status"]').or(
DEL e2e/dicethrone-status-removal.e2e.ts:233 | 注意 删除/收口测试，覆盖减少需确认 |       handArea.locator('[data-card-name*="净化"]').or(
DEL e2e/dicethrone-status-removal.e2e.ts:234 | 注意 删除/收口测试，覆盖减少需确认 |         handArea.locator('[data-card-name*="Purify"]')
DEL e2e/dicethrone-status-removal.e2e.ts:235 | 注意 删除/收口测试，覆盖减少需确认 |       )
DEL e2e/dicethrone-status-removal.e2e.ts:236 | 注意 删除/收口测试，覆盖减少需确认 |     ).first();
DEL e2e/dicethrone-status-removal.e2e.ts:237 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:238 | 注意 删除/收口测试，覆盖减少需确认 |     if (!await removeAllCard.isVisible().catch(() => false)) {
DEL e2e/dicethrone-status-removal.e2e.ts:239 | 注意 删除/收口测试，覆盖减少需确认 |       test.skip(true, '手牌中没有移除所有状态卡牌');
DEL e2e/dicethrone-status-removal.e2e.ts:240 | 注意 删除/收口测试，覆盖减少需确认 |     }
DEL e2e/dicethrone-status-removal.e2e.ts:241 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:242 | 注意 删除/收口测试，覆盖减少需确认 |     // 打出卡牌
DEL e2e/dicethrone-status-removal.e2e.ts:243 | 注意 删除/收口测试，覆盖减少需确认 |     await removeAllCard.click();
DEL e2e/dicethrone-status-removal.e2e.ts:244 | 注意 删除/收口测试，覆盖减少需确认 |     await page.waitForTimeout(1000);
DEL e2e/dicethrone-status-removal.e2e.ts:245 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/dicethrone-status-removal.e2e.ts:246 | 注意 删除/收口测试，覆盖减少需确认 |     // 6. 验证所有状态被移除（不需要选择，自动移除）
DEL e2e/dicethrone-status-removal.e2e.ts:247 | 注意 删除/收口测试，覆盖减少需确认 |     await expect.poll(async () => {
DEL e2e/dicethrone-status-removal.e2e.ts:248 | 注意 删除/收口测试，覆盖减少需确认 |       const currentStatusCount = await statusIcons.count().catch(() => 0);
DEL e2e/dicethrone-status-removal.e2e.ts:249 | 注意 删除/收口测试，覆盖减少需确认 |       return currentStatusCount === 0;
DEL e2e/dicethrone-status-removal.e2e.ts:250 | 注意 删除/收口测试，覆盖减少需确认 |     }, { timeout: 5000 }).toBe(true);
DEL e2e/dicethrone-status-removal.e2e.ts:251 | 注意 删除/收口测试，覆盖减少需确认 |   });
DEL e2e/dicethrone-status-removal.e2e.ts:252 | 注意 删除/收口测试，覆盖减少需确认 | });
DEL e2e/framework/fixtures.ts:105 | 注意 删除/收口测试，覆盖减少需确认 |         await use(ports);
DEL e2e/framework/fixtures.ts:106 | 注意 删除/收口测试，覆盖减少需确认 |     }, { scope: 'worker' }],
ADD e2e/framework/fixtures.ts:105 | OK 测试/覆盖新增，需与主链保持一致 |         const previousEnv = {
ADD e2e/framework/fixtures.ts:106 | OK 测试/覆盖新增，需与主链保持一致 |             PW_PORT: process.env.PW_PORT,
ADD e2e/framework/fixtures.ts:107 | OK 测试/覆盖新增，需与主链保持一致 |             PW_GAME_SERVER_PORT: process.env.PW_GAME_SERVER_PORT,
ADD e2e/framework/fixtures.ts:108 | OK 测试/覆盖新增，需与主链保持一致 |             PW_API_SERVER_PORT: process.env.PW_API_SERVER_PORT,
ADD e2e/framework/fixtures.ts:109 | OK 测试/覆盖新增，需与主链保持一致 |             VITE_FRONTEND_URL: process.env.VITE_FRONTEND_URL,
ADD e2e/framework/fixtures.ts:110 | OK 测试/覆盖新增，需与主链保持一致 |             PW_GAME_SERVER_URL: process.env.PW_GAME_SERVER_URL,
ADD e2e/framework/fixtures.ts:111 | OK 测试/覆盖新增，需与主链保持一致 |         };
ADD e2e/framework/fixtures.ts:112 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/framework/fixtures.ts:113 | OK 测试/覆盖新增，需与主链保持一致 |         process.env.PW_PORT = String(ports.frontend);
ADD e2e/framework/fixtures.ts:114 | OK 测试/覆盖新增，需与主链保持一致 |         process.env.PW_GAME_SERVER_PORT = String(ports.gameServer);
ADD e2e/framework/fixtures.ts:115 | OK 测试/覆盖新增，需与主链保持一致 |         process.env.PW_API_SERVER_PORT = String(ports.apiServer);
ADD e2e/framework/fixtures.ts:116 | OK 测试/覆盖新增，需与主链保持一致 |         process.env.VITE_FRONTEND_URL = `http://127.0.0.1:${ports.frontend}`;
ADD e2e/framework/fixtures.ts:117 | OK 测试/覆盖新增，需与主链保持一致 |         process.env.PW_GAME_SERVER_URL = `http://127.0.0.1:${ports.gameServer}`;
ADD e2e/framework/fixtures.ts:118 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/framework/fixtures.ts:119 | OK 测试/覆盖新增，需与主链保持一致 |         try {
ADD e2e/framework/fixtures.ts:120 | OK 测试/覆盖新增，需与主链保持一致 |             await use(ports);
ADD e2e/framework/fixtures.ts:121 | OK 测试/覆盖新增，需与主链保持一致 |         } finally {
ADD e2e/framework/fixtures.ts:122 | OK 测试/覆盖新增，需与主链保持一致 |             if (previousEnv.PW_PORT === undefined) delete process.env.PW_PORT;
ADD e2e/framework/fixtures.ts:123 | OK 测试/覆盖新增，需与主链保持一致 |             else process.env.PW_PORT = previousEnv.PW_PORT;
ADD e2e/framework/fixtures.ts:124 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/framework/fixtures.ts:125 | OK 测试/覆盖新增，需与主链保持一致 |             if (previousEnv.PW_GAME_SERVER_PORT === undefined) delete process.env.PW_GAME_SERVER_PORT;
ADD e2e/framework/fixtures.ts:126 | OK 测试/覆盖新增，需与主链保持一致 |             else process.env.PW_GAME_SERVER_PORT = previousEnv.PW_GAME_SERVER_PORT;
ADD e2e/framework/fixtures.ts:127 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/framework/fixtures.ts:128 | OK 测试/覆盖新增，需与主链保持一致 |             if (previousEnv.PW_API_SERVER_PORT === undefined) delete process.env.PW_API_SERVER_PORT;
ADD e2e/framework/fixtures.ts:129 | OK 测试/覆盖新增，需与主链保持一致 |             else process.env.PW_API_SERVER_PORT = previousEnv.PW_API_SERVER_PORT;
ADD e2e/framework/fixtures.ts:130 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/framework/fixtures.ts:131 | OK 测试/覆盖新增，需与主链保持一致 |             if (previousEnv.VITE_FRONTEND_URL === undefined) delete process.env.VITE_FRONTEND_URL;
ADD e2e/framework/fixtures.ts:132 | OK 测试/覆盖新增，需与主链保持一致 |             else process.env.VITE_FRONTEND_URL = previousEnv.VITE_FRONTEND_URL;
ADD e2e/framework/fixtures.ts:133 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/framework/fixtures.ts:134 | OK 测试/覆盖新增，需与主链保持一致 |             if (previousEnv.PW_GAME_SERVER_URL === undefined) delete process.env.PW_GAME_SERVER_URL;
ADD e2e/framework/fixtures.ts:135 | OK 测试/覆盖新增，需与主链保持一致 |             else process.env.PW_GAME_SERVER_URL = previousEnv.PW_GAME_SERVER_URL;
ADD e2e/framework/fixtures.ts:136 | OK 测试/覆盖新增，需与主链保持一致 |         }
ADD e2e/framework/fixtures.ts:137 | OK 测试/覆盖新增，需与主链保持一致 |     }, { scope: 'worker', auto: true }],
DEL e2e/helpers/common.ts:125 | 注意 删除/收口测试，覆盖减少需确认 | export const ensureGameServerAvailable = async (page: Page) => {
DEL e2e/helpers/common.ts:126 | 注意 删除/收口测试，覆盖减少需确认 |     const gameServerBaseURL = getGameServerBaseURL();
DEL e2e/helpers/common.ts:127 | 注意 删除/收口测试，覆盖减少需确认 |     // 游戏服务器没有 /games 根路由，尝试创建一个测试房间来检查可用性
DEL e2e/helpers/common.ts:128 | 注意 删除/收口测试，覆盖减少需确认 |     const testUrl = `${gameServerBaseURL}/games/smashup/create`;
DEL e2e/helpers/common.ts:129 | 注意 删除/收口测试，覆盖减少需确认 |     try {
DEL e2e/helpers/common.ts:130 | 注意 删除/收口测试，覆盖减少需确认 |         const response = await page.request.post(testUrl, {
DEL e2e/helpers/common.ts:131 | 注意 删除/收口测试，覆盖减少需确认 |             data: { numPlayers: 2, setupData: { guestId: `test_${Date.now()}` } },
DEL e2e/helpers/common.ts:132 | 注意 删除/收口测试，覆盖减少需确认 |         });
DEL e2e/helpers/common.ts:133 | 注意 删除/收口测试，覆盖减少需确认 |         // 201 Created 或 200 OK 都表示服务器可用
DEL e2e/helpers/common.ts:134 | 注意 删除/收口测试，覆盖减少需确认 |         return response.ok() || response.status() === 201;
DEL e2e/helpers/common.ts:135 | 注意 删除/收口测试，覆盖减少需确认 |     } catch {
DEL e2e/helpers/common.ts:136 | 注意 删除/收口测试，覆盖减少需确认 |         return false;
ADD e2e/helpers/common.ts:125 | OK 测试/覆盖新增，需与主链保持一致 | export const ensureGameServerAvailable = async (
ADD e2e/helpers/common.ts:126 | OK 测试/覆盖新增，需与主链保持一致 |     page: Page,
ADD e2e/helpers/common.ts:127 | OK 测试/覆盖新增，需与主链保持一致 |     gameServerBaseURLOverride?: string,
ADD e2e/helpers/common.ts:128 | OK 测试/覆盖新增，需与主链保持一致 | ) => {
ADD e2e/helpers/common.ts:129 | OK 测试/覆盖新增，需与主链保持一致 |     const gameServerBaseURL = gameServerBaseURLOverride ?? getGameServerBaseURL();
ADD e2e/helpers/common.ts:130 | OK 测试/覆盖新增，需与主链保持一致 |     const listUrl = `${gameServerBaseURL}/games`;
ADD e2e/helpers/common.ts:131 | OK 测试/覆盖新增，需与主链保持一致 |     const startedAt = Date.now();
ADD e2e/helpers/common.ts:132 | OK 测试/覆盖新增，需与主链保持一致 |     const timeoutMs = 15000;
ADD e2e/helpers/common.ts:133 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/common.ts:134 | OK 测试/覆盖新增，需与主链保持一致 |     while (Date.now() - startedAt < timeoutMs) {
ADD e2e/helpers/common.ts:135 | OK 测试/覆盖新增，需与主链保持一致 |         try {
ADD e2e/helpers/common.ts:136 | OK 测试/覆盖新增，需与主链保持一致 |             const response = await page.request.get(listUrl);
ADD e2e/helpers/common.ts:137 | OK 测试/覆盖新增，需与主链保持一致 |             if (response.ok()) {
ADD e2e/helpers/common.ts:138 | OK 测试/覆盖新增，需与主链保持一致 |                 return true;
ADD e2e/helpers/common.ts:139 | OK 测试/覆盖新增，需与主链保持一致 |             }
ADD e2e/helpers/common.ts:140 | OK 测试/覆盖新增，需与主链保持一致 |         } catch {
ADD e2e/helpers/common.ts:141 | OK 测试/覆盖新增，需与主链保持一致 |             // ignore transient startup/network errors
ADD e2e/helpers/common.ts:142 | OK 测试/覆盖新增，需与主链保持一致 |         }
ADD e2e/helpers/common.ts:143 | OK 测试/覆盖新增，需与主链保持一致 |         await page.waitForTimeout(1000);
ADD e2e/helpers/common.ts:145 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/common.ts:146 | OK 测试/覆盖新增，需与主链保持一致 |     return false;
DEL e2e/helpers/common.ts:325 | 注意 删除/收口测试，覆盖减少需确认 | export const injectDirectGameServerUrl = async (context: BrowserContext) => {
DEL e2e/helpers/common.ts:326 | 注意 删除/收口测试，覆盖减少需确认 |     const gameServerUrl = getGameServerBaseURL();
ADD e2e/helpers/common.ts:334 | OK 测试/覆盖新增，需与主链保持一致 | export const injectDirectGameServerUrl = async (
ADD e2e/helpers/common.ts:335 | OK 测试/覆盖新增，需与主链保持一致 |     context: BrowserContext,
ADD e2e/helpers/common.ts:336 | OK 测试/覆盖新增，需与主链保持一致 |     gameServerBaseURLOverride?: string,
ADD e2e/helpers/common.ts:337 | OK 测试/覆盖新增，需与主链保持一致 | ) => {
ADD e2e/helpers/common.ts:338 | OK 测试/覆盖新增，需与主链保持一致 |     const gameServerUrl = gameServerBaseURLOverride ?? getGameServerBaseURL();
DEL e2e/helpers/common.ts:364 | 注意 删除/收口测试，覆盖减少需确认 |     opts?: { storageKey?: string; skipTutorial?: boolean },
ADD e2e/helpers/common.ts:376 | OK 测试/覆盖新增，需与主链保持一致 |     opts?: { storageKey?: string; skipTutorial?: boolean; gameServerBaseURL?: string },
DEL e2e/helpers/common.ts:370 | 注意 删除/收口测试，覆盖减少需确认 |     await injectDirectGameServerUrl(context);
ADD e2e/helpers/common.ts:382 | OK 测试/覆盖新增，需与主链保持一致 |     await injectDirectGameServerUrl(context, opts?.gameServerBaseURL);
ADD e2e/helpers/dicethrone.ts:5 | OK 测试/覆盖新增，需与主链保持一致 | import { appendFileSync, mkdirSync } from 'node:fs';
ADD e2e/helpers/dicethrone.ts:6 | OK 测试/覆盖新增，需与主链保持一致 | import { dirname, resolve } from 'node:path';
DEL e2e/helpers/dicethrone.ts:6 | 注意 删除/收口测试，覆盖减少需确认 | import {
DEL e2e/helpers/dicethrone.ts:7 | 注意 删除/收口测试，覆盖减少需确认 |     getGameServerBaseURL,
DEL e2e/helpers/dicethrone.ts:8 | 注意 删除/收口测试，覆盖减少需确认 |     blockAudioRequests,
DEL e2e/helpers/dicethrone.ts:9 | 注意 删除/收口测试，覆盖减少需确认 |     setEnglishLocale,
DEL e2e/helpers/dicethrone.ts:10 | 注意 删除/收口测试，覆盖减少需确认 |     resetMatchStorage,
DEL e2e/helpers/dicethrone.ts:11 | 注意 删除/收口测试，覆盖减少需确认 |     disableTutorial,
DEL e2e/helpers/dicethrone.ts:12 | 注意 删除/收口测试，覆盖减少需确认 |     disableAudio,
DEL e2e/helpers/dicethrone.ts:13 | 注意 删除/收口测试，覆盖减少需确认 |     dismissViteOverlay,
DEL e2e/helpers/dicethrone.ts:14 | 注意 删除/收口测试，覆盖减少需确认 |     waitForHomeGameList,
DEL e2e/helpers/dicethrone.ts:15 | 注意 删除/收口测试，覆盖减少需确认 |     dismissLobbyConfirmIfNeeded,
DEL e2e/helpers/dicethrone.ts:16 | 注意 删除/收口测试，覆盖减少需确认 |     ensureGameServerAvailable,
DEL e2e/helpers/dicethrone.ts:17 | 注意 删除/收口测试，覆盖减少需确认 |     initContext,
DEL e2e/helpers/dicethrone.ts:18 | 注意 删除/收口测试，覆盖减少需确认 | } from './common';
ADD e2e/helpers/dicethrone.ts:8 | OK 测试/覆盖新增，需与主链保持一致 | import { getGameServerBaseURL, ensureGameServerAvailable, initContext } from './common';
ADD e2e/helpers/dicethrone.ts:11 | OK 测试/覆盖新增，需与主链保持一致 | const createDtGuestId = (prefix: string) => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
ADD e2e/helpers/dicethrone.ts:12 | OK 测试/覆盖新增，需与主链保持一致 | const TRANSIENT_GOTO_ERROR_PATTERNS = [
ADD e2e/helpers/dicethrone.ts:13 | OK 测试/覆盖新增，需与主链保持一致 |     'ERR_INSUFFICIENT_RESOURCES',
ADD e2e/helpers/dicethrone.ts:14 | OK 测试/覆盖新增，需与主链保持一致 |     'ERR_ABORTED',
ADD e2e/helpers/dicethrone.ts:15 | OK 测试/覆盖新增，需与主链保持一致 |     'NS_BINDING_ABORTED',
ADD e2e/helpers/dicethrone.ts:16 | OK 测试/覆盖新增，需与主链保持一致 | ];
ADD e2e/helpers/dicethrone.ts:17 | OK 测试/覆盖新增，需与主链保持一致 | const TRANSIENT_API_ERROR_PATTERNS = [
ADD e2e/helpers/dicethrone.ts:18 | OK 测试/覆盖新增，需与主链保持一致 |     'ECONNREFUSED',
ADD e2e/helpers/dicethrone.ts:19 | OK 测试/覆盖新增，需与主链保持一致 |     'ECONNRESET',
ADD e2e/helpers/dicethrone.ts:20 | OK 测试/覆盖新增，需与主链保持一致 |     'ETIMEDOUT',
ADD e2e/helpers/dicethrone.ts:21 | OK 测试/覆盖新增，需与主链保持一致 |     'socket hang up',
ADD e2e/helpers/dicethrone.ts:22 | OK 测试/覆盖新增，需与主链保持一致 |     'fetch failed',
ADD e2e/helpers/dicethrone.ts:23 | OK 测试/覆盖新增，需与主链保持一致 |     'network error',
ADD e2e/helpers/dicethrone.ts:24 | OK 测试/覆盖新增，需与主链保持一致 | ];
ADD e2e/helpers/dicethrone.ts:25 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:26 | OK 测试/覆盖新增，需与主链保持一致 | const isTransientGotoError = (error: unknown) => {
ADD e2e/helpers/dicethrone.ts:27 | OK 测试/覆盖新增，需与主链保持一致 |     const message = error instanceof Error ? error.message : String(error);
ADD e2e/helpers/dicethrone.ts:28 | OK 测试/覆盖新增，需与主链保持一致 |     return TRANSIENT_GOTO_ERROR_PATTERNS.some(pattern => message.includes(pattern));
ADD e2e/helpers/dicethrone.ts:29 | OK 测试/覆盖新增，需与主链保持一致 | };
ADD e2e/helpers/dicethrone.ts:30 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:31 | OK 测试/覆盖新增，需与主链保持一致 | const isTransientApiError = (error: unknown) => {
ADD e2e/helpers/dicethrone.ts:32 | OK 测试/覆盖新增，需与主链保持一致 |     const message = error instanceof Error ? error.message : String(error);
ADD e2e/helpers/dicethrone.ts:33 | OK 测试/覆盖新增，需与主链保持一致 |     const lowered = message.toLowerCase();
ADD e2e/helpers/dicethrone.ts:34 | OK 测试/覆盖新增，需与主链保持一致 |     return TRANSIENT_API_ERROR_PATTERNS.some(pattern => lowered.includes(pattern.toLowerCase()));
ADD e2e/helpers/dicethrone.ts:35 | OK 测试/覆盖新增，需与主链保持一致 | };
ADD e2e/helpers/dicethrone.ts:36 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:37 | OK 测试/覆盖新增，需与主链保持一致 | const isRetryableApiStatus = (status: number) => status === 408 || status === 425 || status === 429 || status >= 500;
ADD e2e/helpers/dicethrone.ts:38 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:39 | OK 测试/覆盖新增，需与主链保持一致 | const setupDebugLogPath = resolve(process.cwd(), 'temp', 'dicethrone-setup-debug.log');
ADD e2e/helpers/dicethrone.ts:40 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:41 | OK 测试/覆盖新增，需与主链保持一致 | const appendSetupDebug = (message: string) => {
ADD e2e/helpers/dicethrone.ts:42 | OK 测试/覆盖新增，需与主链保持一致 |     try {
ADD e2e/helpers/dicethrone.ts:43 | OK 测试/覆盖新增，需与主链保持一致 |         mkdirSync(dirname(setupDebugLogPath), { recursive: true });
ADD e2e/helpers/dicethrone.ts:44 | OK 测试/覆盖新增，需与主链保持一致 |         appendFileSync(setupDebugLogPath, `[${new Date().toISOString()}] ${message}\n`, 'utf8');
ADD e2e/helpers/dicethrone.ts:45 | OK 测试/覆盖新增，需与主链保持一致 |     } catch {
ADD e2e/helpers/dicethrone.ts:46 | OK 测试/覆盖新增，需与主链保持一致 |         // 调试日志失败不应影响测试主流程。
ADD e2e/helpers/dicethrone.ts:47 | OK 测试/覆盖新增，需与主链保持一致 |     }
ADD e2e/helpers/dicethrone.ts:48 | OK 测试/覆盖新增，需与主链保持一致 | };
ADD e2e/helpers/dicethrone.ts:49 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:50 | OK 测试/覆盖新增，需与主链保持一致 | const gotoWithRetry = async (
ADD e2e/helpers/dicethrone.ts:51 | OK 测试/覆盖新增，需与主链保持一致 |     page: Page,
ADD e2e/helpers/dicethrone.ts:52 | OK 测试/覆盖新增，需与主链保持一致 |     url: string,
ADD e2e/helpers/dicethrone.ts:53 | OK 测试/覆盖新增，需与主链保持一致 |     options: { label: string; timeout?: number; attempts?: number },
ADD e2e/helpers/dicethrone.ts:54 | OK 测试/覆盖新增，需与主链保持一致 | ) => {
ADD e2e/helpers/dicethrone.ts:55 | OK 测试/覆盖新增，需与主链保持一致 |     const attempts = options.attempts ?? 3;
ADD e2e/helpers/dicethrone.ts:56 | OK 测试/覆盖新增，需与主链保持一致 |     const timeout = options.timeout ?? 20000;
ADD e2e/helpers/dicethrone.ts:57 | OK 测试/覆盖新增，需与主链保持一致 |     let lastError: unknown;
ADD e2e/helpers/dicethrone.ts:58 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:59 | OK 测试/覆盖新增，需与主链保持一致 |     for (let attempt = 1; attempt <= attempts; attempt++) {
ADD e2e/helpers/dicethrone.ts:60 | OK 测试/覆盖新增，需与主链保持一致 |         try {
ADD e2e/helpers/dicethrone.ts:61 | OK 测试/覆盖新增，需与主链保持一致 |             return await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
ADD e2e/helpers/dicethrone.ts:62 | OK 测试/覆盖新增，需与主链保持一致 |         } catch (error) {
ADD e2e/helpers/dicethrone.ts:63 | OK 测试/覆盖新增，需与主链保持一致 |             lastError = error;
ADD e2e/helpers/dicethrone.ts:64 | OK 测试/覆盖新增，需与主链保持一致 |             if (!isTransientGotoError(error) || attempt === attempts) {
ADD e2e/helpers/dicethrone.ts:65 | OK 测试/覆盖新增，需与主链保持一致 |                 throw error;
ADD e2e/helpers/dicethrone.ts:66 | OK 测试/覆盖新增，需与主链保持一致 |             }
ADD e2e/helpers/dicethrone.ts:67 | OK 测试/覆盖新增，需与主链保持一致 |             await page.waitForTimeout(500 * attempt);
ADD e2e/helpers/dicethrone.ts:68 | OK 测试/覆盖新增，需与主链保持一致 |         }
ADD e2e/helpers/dicethrone.ts:69 | OK 测试/覆盖新增，需与主链保持一致 |     }
ADD e2e/helpers/dicethrone.ts:70 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:71 | OK 测试/覆盖新增，需与主链保持一致 |     throw lastError instanceof Error
ADD e2e/helpers/dicethrone.ts:72 | OK 测试/覆盖新增，需与主链保持一致 |         ? lastError
ADD e2e/helpers/dicethrone.ts:73 | OK 测试/覆盖新增，需与主链保持一致 |         : new Error(`[${options.label}] 页面跳转失败`);
ADD e2e/helpers/dicethrone.ts:74 | OK 测试/覆盖新增，需与主链保持一致 | };
ADD e2e/helpers/dicethrone.ts:75 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:76 | OK 测试/覆盖新增，需与主链保持一致 | const postJsonWithRetry = async (
ADD e2e/helpers/dicethrone.ts:77 | OK 测试/覆盖新增，需与主链保持一致 |     page: Page,
ADD e2e/helpers/dicethrone.ts:78 | OK 测试/覆盖新增，需与主链保持一致 |     url: string,
ADD e2e/helpers/dicethrone.ts:79 | OK 测试/覆盖新增，需与主链保持一致 |     data: Record<string, unknown>,
ADD e2e/helpers/dicethrone.ts:80 | OK 测试/覆盖新增，需与主链保持一致 |     options: {
ADD e2e/helpers/dicethrone.ts:81 | OK 测试/覆盖新增，需与主链保持一致 |         label: string;
ADD e2e/helpers/dicethrone.ts:82 | OK 测试/覆盖新增，需与主链保持一致 |         attempts?: number;
ADD e2e/helpers/dicethrone.ts:83 | OK 测试/覆盖新增，需与主链保持一致 |         headers?: Record<string, string>;
ADD e2e/helpers/dicethrone.ts:84 | OK 测试/覆盖新增，需与主链保持一致 |     },
ADD e2e/helpers/dicethrone.ts:85 | OK 测试/覆盖新增，需与主链保持一致 | ) => {
ADD e2e/helpers/dicethrone.ts:86 | OK 测试/覆盖新增，需与主链保持一致 |     const attempts = options.attempts ?? 3;
ADD e2e/helpers/dicethrone.ts:87 | OK 测试/覆盖新增，需与主链保持一致 |     let lastError: unknown;
ADD e2e/helpers/dicethrone.ts:88 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:89 | OK 测试/覆盖新增，需与主链保持一致 |     for (let attempt = 1; attempt <= attempts; attempt++) {
ADD e2e/helpers/dicethrone.ts:90 | OK 测试/覆盖新增，需与主链保持一致 |         try {
ADD e2e/helpers/dicethrone.ts:91 | OK 测试/覆盖新增，需与主链保持一致 |             const response = await page.request.post(url, {
ADD e2e/helpers/dicethrone.ts:92 | OK 测试/覆盖新增，需与主链保持一致 |                 headers: options.headers,
ADD e2e/helpers/dicethrone.ts:93 | OK 测试/覆盖新增，需与主链保持一致 |                 data,
ADD e2e/helpers/dicethrone.ts:94 | OK 测试/覆盖新增，需与主链保持一致 |             });
ADD e2e/helpers/dicethrone.ts:95 | OK 测试/覆盖新增，需与主链保持一致 |             if (response.ok()) {
ADD e2e/helpers/dicethrone.ts:96 | OK 测试/覆盖新增，需与主链保持一致 |                 return response;
ADD e2e/helpers/dicethrone.ts:97 | OK 测试/覆盖新增，需与主链保持一致 |             }
ADD e2e/helpers/dicethrone.ts:98 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:99 | OK 测试/覆盖新增，需与主链保持一致 |             if (!isRetryableApiStatus(response.status()) || attempt === attempts) {
ADD e2e/helpers/dicethrone.ts:100 | OK 测试/覆盖新增，需与主链保持一致 |                 appendSetupDebug(`API_FAIL label=${options.label} attempt=${attempt} status=${response.status()} url=${url}`);
ADD e2e/helpers/dicethrone.ts:101 | OK 测试/覆盖新增，需与主链保持一致 |                 return response;
ADD e2e/helpers/dicethrone.ts:102 | OK 测试/覆盖新增，需与主链保持一致 |             }
ADD e2e/helpers/dicethrone.ts:103 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:104 | OK 测试/覆盖新增，需与主链保持一致 |             appendSetupDebug(`API_RETRY label=${options.label} attempt=${attempt} status=${response.status()} url=${url}`);
ADD e2e/helpers/dicethrone.ts:105 | OK 测试/覆盖新增，需与主链保持一致 |         } catch (error) {
ADD e2e/helpers/dicethrone.ts:106 | OK 测试/覆盖新增，需与主链保持一致 |             lastError = error;
ADD e2e/helpers/dicethrone.ts:107 | OK 测试/覆盖新增，需与主链保持一致 |             if (!isTransientApiError(error) || attempt === attempts) {
ADD e2e/helpers/dicethrone.ts:108 | OK 测试/覆盖新增，需与主链保持一致 |                 throw error;
ADD e2e/helpers/dicethrone.ts:109 | OK 测试/覆盖新增，需与主链保持一致 |             }
ADD e2e/helpers/dicethrone.ts:110 | OK 测试/覆盖新增，需与主链保持一致 |             appendSetupDebug(`API_RETRY label=${options.label} attempt=${attempt} error=${error instanceof Error ? error.message : String(error)} url=${url}`);
ADD e2e/helpers/dicethrone.ts:111 | OK 测试/覆盖新增，需与主链保持一致 |         }
ADD e2e/helpers/dicethrone.ts:112 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:113 | OK 测试/覆盖新增，需与主链保持一致 |         await page.waitForTimeout(500 * attempt);
ADD e2e/helpers/dicethrone.ts:114 | OK 测试/覆盖新增，需与主链保持一致 |     }
ADD e2e/helpers/dicethrone.ts:115 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:116 | OK 测试/覆盖新增，需与主链保持一致 |     if (lastError) {
ADD e2e/helpers/dicethrone.ts:117 | OK 测试/覆盖新增，需与主链保持一致 |         throw lastError instanceof Error ? lastError : new Error(String(lastError));
ADD e2e/helpers/dicethrone.ts:118 | OK 测试/覆盖新增，需与主链保持一致 |     }
ADD e2e/helpers/dicethrone.ts:119 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:120 | OK 测试/覆盖新增，需与主链保持一致 |     return null;
ADD e2e/helpers/dicethrone.ts:121 | OK 测试/覆盖新增，需与主链保持一致 | };
DEL e2e/helpers/dicethrone.ts:26 | 注意 删除/收口测试，覆盖减少需确认 | export const createDTRoomViaAPI = async (page: Page, guestId?: string): Promise<string | null> => {
ADD e2e/helpers/dicethrone.ts:127 | OK 测试/覆盖新增，需与主链保持一致 | export const createDTRoomViaAPI = async (
ADD e2e/helpers/dicethrone.ts:128 | OK 测试/覆盖新增，需与主链保持一致 |     page: Page,
ADD e2e/helpers/dicethrone.ts:129 | OK 测试/覆盖新增，需与主链保持一致 |     options?: { guestId?: string; numPlayers?: number; gameServerBaseURL?: string },
ADD e2e/helpers/dicethrone.ts:130 | OK 测试/覆盖新增，需与主链保持一致 | ): Promise<string | null> => {
DEL e2e/helpers/dicethrone.ts:28 | 注意 删除/收口测试，覆盖减少需确认 |         const actualGuestId = guestId ?? `dt_e2e_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
DEL e2e/helpers/dicethrone.ts:29 | 注意 删除/收口测试，覆盖减少需确认 |         const gameServerBaseURL = getGameServerBaseURL();
ADD e2e/helpers/dicethrone.ts:132 | OK 测试/覆盖新增，需与主链保持一致 |         const actualGuestId = options?.guestId ?? createDtGuestId('dt_e2e');
ADD e2e/helpers/dicethrone.ts:133 | OK 测试/覆盖新增，需与主链保持一致 |         const numPlayers = options?.numPlayers ?? 2;
ADD e2e/helpers/dicethrone.ts:134 | OK 测试/覆盖新增，需与主链保持一致 |         const gameServerBaseURL = options?.gameServerBaseURL ?? getGameServerBaseURL();
DEL e2e/helpers/dicethrone.ts:31 | 注意 删除/收口测试，覆盖减少需确认 |         
DEL e2e/helpers/dicethrone.ts:32 | 注意 删除/收口测试，覆盖减少需确认 |         const response = await page.request.post(url, {
DEL e2e/helpers/dicethrone.ts:33 | 注意 删除/收口测试，覆盖减少需确认 |             data: { numPlayers: 2, setupData: { guestId: actualGuestId } },
ADD e2e/helpers/dicethrone.ts:136 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:137 | OK 测试/覆盖新增，需与主链保持一致 |         const response = await postJsonWithRetry(page, url, {
ADD e2e/helpers/dicethrone.ts:138 | OK 测试/覆盖新增，需与主链保持一致 |             numPlayers,
ADD e2e/helpers/dicethrone.ts:139 | OK 测试/覆盖新增，需与主链保持一致 |             setupData: { guestId: actualGuestId },
ADD e2e/helpers/dicethrone.ts:140 | OK 测试/覆盖新增，需与主链保持一致 |         }, {
ADD e2e/helpers/dicethrone.ts:141 | OK 测试/覆盖新增，需与主链保持一致 |             label: 'create-room',
DEL e2e/helpers/dicethrone.ts:35 | 注意 删除/收口测试，覆盖减少需确认 |         
DEL e2e/helpers/dicethrone.ts:36 | 注意 删除/收口测试，覆盖减少需确认 |         if (!response.ok()) return null;
ADD e2e/helpers/dicethrone.ts:143 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:144 | OK 测试/覆盖新增，需与主链保持一致 |         if (!response?.ok()) return null;
DEL e2e/helpers/dicethrone.ts:39 | 注意 删除/收口测试，覆盖减少需确认 |     } catch {
ADD e2e/helpers/dicethrone.ts:147 | OK 测试/覆盖新增，需与主链保持一致 |     } catch (error) {
ADD e2e/helpers/dicethrone.ts:148 | OK 测试/覆盖新增，需与主链保持一致 |         appendSetupDebug(`API_FAIL label=create-room error=${error instanceof Error ? error.message : String(error)}`);
ADD e2e/helpers/dicethrone.ts:159 | OK 测试/覆盖新增，需与主链保持一致 |     gameServerBaseURLOverride?: string,
DEL e2e/helpers/dicethrone.ts:51 | 注意 删除/收口测试，覆盖减少需确认 |     const gameServerBaseURL = getGameServerBaseURL();
DEL e2e/helpers/dicethrone.ts:52 | 注意 删除/收口测试，覆盖减少需确认 |     const url = `${gameServerBaseURL}/games/${GAME_NAME}/${matchId}/join`;
DEL e2e/helpers/dicethrone.ts:53 | 注意 删除/收口测试，覆盖减少需确认 |     
DEL e2e/helpers/dicethrone.ts:54 | 注意 删除/收口测试，覆盖减少需确认 |     const response = await page.request.post(url, {
DEL e2e/helpers/dicethrone.ts:55 | 注意 删除/收口测试，覆盖减少需确认 |         data: {
ADD e2e/helpers/dicethrone.ts:161 | OK 测试/覆盖新增，需与主链保持一致 |     try {
ADD e2e/helpers/dicethrone.ts:162 | OK 测试/覆盖新增，需与主链保持一致 |         const gameServerBaseURL = gameServerBaseURLOverride ?? getGameServerBaseURL();
ADD e2e/helpers/dicethrone.ts:163 | OK 测试/覆盖新增，需与主链保持一致 |         const url = `${gameServerBaseURL}/games/${GAME_NAME}/${matchId}/join`;
ADD e2e/helpers/dicethrone.ts:164 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:165 | OK 测试/覆盖新增，需与主链保持一致 |         const response = await postJsonWithRetry(page, url, {
DEL e2e/helpers/dicethrone.ts:59 | 注意 删除/收口测试，覆盖减少需确认 |         },
DEL e2e/helpers/dicethrone.ts:60 | 注意 删除/收口测试，覆盖减少需确认 |     });
DEL e2e/helpers/dicethrone.ts:61 | 注意 删除/收口测试，覆盖减少需确认 |     
DEL e2e/helpers/dicethrone.ts:62 | 注意 删除/收口测试，覆盖减少需确认 |     if (!response.ok()) return null;
DEL e2e/helpers/dicethrone.ts:63 | 注意 删除/收口测试，覆盖减少需确认 |     const data = (await response.json().catch(() => null)) as { playerCredentials?: string } | null;
DEL e2e/helpers/dicethrone.ts:64 | 注意 删除/收口测试，覆盖减少需确认 |     return data?.playerCredentials ?? null;
ADD e2e/helpers/dicethrone.ts:169 | OK 测试/覆盖新增，需与主链保持一致 |         }, {
ADD e2e/helpers/dicethrone.ts:170 | OK 测试/覆盖新增，需与主链保持一致 |             label: `join-match-${playerId}`,
ADD e2e/helpers/dicethrone.ts:171 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD e2e/helpers/dicethrone.ts:172 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:173 | OK 测试/覆盖新增，需与主链保持一致 |         if (!response?.ok()) return null;
ADD e2e/helpers/dicethrone.ts:174 | OK 测试/覆盖新增，需与主链保持一致 |         const data = (await response.json().catch(() => null)) as { playerCredentials?: string } | null;
ADD e2e/helpers/dicethrone.ts:175 | OK 测试/覆盖新增，需与主链保持一致 |         return data?.playerCredentials ?? null;
ADD e2e/helpers/dicethrone.ts:176 | OK 测试/覆盖新增，需与主链保持一致 |     } catch (error) {
ADD e2e/helpers/dicethrone.ts:177 | OK 测试/覆盖新增，需与主链保持一致 |         appendSetupDebug(`API_FAIL label=join-match-${playerId} error=${error instanceof Error ? error.message : String(error)}`);
ADD e2e/helpers/dicethrone.ts:178 | OK 测试/覆盖新增，需与主链保持一致 |         return null;
ADD e2e/helpers/dicethrone.ts:179 | OK 测试/覆盖新增，需与主链保持一致 |     }
ADD e2e/helpers/dicethrone.ts:180 | OK 测试/覆盖新增，需与主链保持一致 | };
ADD e2e/helpers/dicethrone.ts:181 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:182 | OK 测试/覆盖新增，需与主链保持一致 | export const claimDTSeatViaAPI = async (
ADD e2e/helpers/dicethrone.ts:183 | OK 测试/覆盖新增，需与主链保持一致 |     page: Page,
ADD e2e/helpers/dicethrone.ts:184 | OK 测试/覆盖新增，需与主链保持一致 |     matchId: string,
ADD e2e/helpers/dicethrone.ts:185 | OK 测试/覆盖新增，需与主链保持一致 |     playerId: string,
ADD e2e/helpers/dicethrone.ts:186 | OK 测试/覆盖新增，需与主链保持一致 |     options: { guestId?: string; playerName?: string; token?: string; gameServerBaseURL?: string },
ADD e2e/helpers/dicethrone.ts:187 | OK 测试/覆盖新增，需与主链保持一致 | ): Promise<string | null> => {
ADD e2e/helpers/dicethrone.ts:188 | OK 测试/覆盖新增，需与主链保持一致 |     try {
ADD e2e/helpers/dicethrone.ts:189 | OK 测试/覆盖新增，需与主链保持一致 |         const gameServerBaseURL = options.gameServerBaseURL ?? getGameServerBaseURL();
ADD e2e/helpers/dicethrone.ts:190 | OK 测试/覆盖新增，需与主链保持一致 |         const url = `${gameServerBaseURL}/games/${GAME_NAME}/${matchId}/claim-seat`;
ADD e2e/helpers/dicethrone.ts:191 | OK 测试/覆盖新增，需与主链保持一致 |         const headers: Record<string, string> = {};
ADD e2e/helpers/dicethrone.ts:192 | OK 测试/覆盖新增，需与主链保持一致 |         if (options.token) {
ADD e2e/helpers/dicethrone.ts:193 | OK 测试/覆盖新增，需与主链保持一致 |             headers.Authorization = `Bearer ${options.token}`;
ADD e2e/helpers/dicethrone.ts:194 | OK 测试/覆盖新增，需与主链保持一致 |         }
ADD e2e/helpers/dicethrone.ts:195 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:196 | OK 测试/覆盖新增，需与主链保持一致 |         const response = await postJsonWithRetry(page, url, {
ADD e2e/helpers/dicethrone.ts:197 | OK 测试/覆盖新增，需与主链保持一致 |             playerID: playerId,
ADD e2e/helpers/dicethrone.ts:198 | OK 测试/覆盖新增，需与主链保持一致 |             ...(options.token ? {} : options.guestId ? { guestId: options.guestId } : {}),
ADD e2e/helpers/dicethrone.ts:199 | OK 测试/覆盖新增，需与主链保持一致 |             ...(options.playerName ? { playerName: options.playerName } : {}),
ADD e2e/helpers/dicethrone.ts:200 | OK 测试/覆盖新增，需与主链保持一致 |         }, {
ADD e2e/helpers/dicethrone.ts:201 | OK 测试/覆盖新增，需与主链保持一致 |             label: `claim-seat-${playerId}`,
ADD e2e/helpers/dicethrone.ts:202 | OK 测试/覆盖新增，需与主链保持一致 |             headers,
ADD e2e/helpers/dicethrone.ts:203 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD e2e/helpers/dicethrone.ts:204 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:205 | OK 测试/覆盖新增，需与主链保持一致 |         if (!response?.ok()) return null;
ADD e2e/helpers/dicethrone.ts:206 | OK 测试/覆盖新增，需与主链保持一致 |         const data = (await response.json().catch(() => null)) as { playerCredentials?: string } | null;
ADD e2e/helpers/dicethrone.ts:207 | OK 测试/覆盖新增，需与主链保持一致 |         return data?.playerCredentials ?? null;
ADD e2e/helpers/dicethrone.ts:208 | OK 测试/覆盖新增，需与主链保持一致 |     } catch (error) {
ADD e2e/helpers/dicethrone.ts:209 | OK 测试/覆盖新增，需与主链保持一致 |         appendSetupDebug(`API_FAIL label=claim-seat-${playerId} error=${error instanceof Error ? error.message : String(error)}`);
ADD e2e/helpers/dicethrone.ts:210 | OK 测试/覆盖新增，需与主链保持一致 |         return null;
ADD e2e/helpers/dicethrone.ts:211 | OK 测试/覆盖新增，需与主链保持一致 |     }
DEL e2e/helpers/dicethrone.ts:94 | 注意 删除/收口测试，覆盖减少需确认 |     await expect(page.locator('h2').filter({ hasText: /选择你的英雄|Select Your Hero/i })).toBeVisible({ timeout });
ADD e2e/helpers/dicethrone.ts:241 | OK 测试/覆盖新增，需与主链保持一致 |     const characterCards = page.locator('[data-character-id]');
ADD e2e/helpers/dicethrone.ts:242 | OK 测试/覆盖新增，需与主链保持一致 |     await expect(characterCards.first()).toBeVisible({ timeout });
DEL e2e/helpers/dicethrone.ts:101 | 注意 删除/收口测试，覆盖减少需确认 |     
DEL e2e/helpers/dicethrone.ts:102 | 注意 删除/收口测试，覆盖减少需确认 |     // DiceThrone 的角色选择不需要确认按钮，点击后直接选中
DEL e2e/helpers/dicethrone.ts:103 | 注意 删除/收口测试，覆盖减少需确认 |     // 等待一小段时间让状态更新
DEL e2e/helpers/dicethrone.ts:107 | 注意 删除/收口测试，覆盖减少需确认 | export const readyAndStartGame = async (hostPage: Page, guestPage: Page) => {
DEL e2e/helpers/dicethrone.ts:108 | 注意 删除/收口测试，覆盖减少需确认 |     // Guest 点击准备按钮
DEL e2e/helpers/dicethrone.ts:109 | 注意 删除/收口测试，覆盖减少需确认 |     const guestReadyButton = guestPage.getByRole('button', { name: /Ready|准备/i });
DEL e2e/helpers/dicethrone.ts:110 | 注意 删除/收口测试，覆盖减少需确认 |     await expect(guestReadyButton).toBeVisible({ timeout: 5000 });
DEL e2e/helpers/dicethrone.ts:111 | 注意 删除/收口测试，覆盖减少需确认 |     await guestReadyButton.click();
DEL e2e/helpers/dicethrone.ts:112 | 注意 删除/收口测试，覆盖减少需确认 |     
DEL e2e/helpers/dicethrone.ts:113 | 注意 删除/收口测试，覆盖减少需确认 |     // 等待 Guest 页面状态更新（显示 "Ready, Waiting..." 或类似文本）
DEL e2e/helpers/dicethrone.ts:114 | 注意 删除/收口测试，覆盖减少需确认 |     await guestPage.waitForTimeout(500);
DEL e2e/helpers/dicethrone.ts:115 | 注意 删除/收口测试，覆盖减少需确认 |     
DEL e2e/helpers/dicethrone.ts:116 | 注意 删除/收口测试，覆盖减少需确认 |     // 等待 Host 页面接收到 Guest 的 Ready 状态并显示开始按钮
DEL e2e/helpers/dicethrone.ts:117 | 注意 删除/收口测试，覆盖减少需确认 |     // Host 点击开始游戏按钮 - 使用更宽松的选择器
DEL e2e/helpers/dicethrone.ts:118 | 注意 删除/收口测试，覆盖减少需确认 |     const hostStartButton = hostPage.getByRole('button', { name: /Start Game|开始游戏|Press.*Start|按.*开始/i });
DEL e2e/helpers/dicethrone.ts:119 | 注意 删除/收口测试，覆盖减少需确认 |     
DEL e2e/helpers/dicethrone.ts:120 | 注意 删除/收口测试，覆盖减少需确认 |     // 等待按钮出现并启用（给足够时间让 WebSocket 同步状态）
ADD e2e/helpers/dicethrone.ts:252 | OK 测试/覆盖新增，需与主链保持一致 | export const readyPlayersAndStartGame = async (hostPage: Page, guestPages: Page[]) => {
ADD e2e/helpers/dicethrone.ts:253 | OK 测试/覆盖新增，需与主链保持一致 |     for (const guestPage of guestPages) {
ADD e2e/helpers/dicethrone.ts:254 | OK 测试/覆盖新增，需与主链保持一致 |         const guestReadyButton = guestPage.getByRole('button', { name: /Ready/i });
ADD e2e/helpers/dicethrone.ts:255 | OK 测试/覆盖新增，需与主链保持一致 |         await expect(guestReadyButton).toBeVisible({ timeout: 5000 });
ADD e2e/helpers/dicethrone.ts:256 | OK 测试/覆盖新增，需与主链保持一致 |         await guestReadyButton.click();
ADD e2e/helpers/dicethrone.ts:257 | OK 测试/覆盖新增，需与主链保持一致 |         await guestPage.waitForTimeout(500);
ADD e2e/helpers/dicethrone.ts:258 | OK 测试/覆盖新增，需与主链保持一致 |     }
ADD e2e/helpers/dicethrone.ts:259 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:260 | OK 测试/覆盖新增，需与主链保持一致 |     const hostStartButton = hostPage.getByRole('button', { name: /Start Game|Press.*Start/i });
DEL e2e/helpers/dicethrone.ts:123 | 注意 删除/收口测试，覆盖减少需确认 |     
ADD e2e/helpers/dicethrone.ts:267 | OK 测试/覆盖新增，需与主链保持一致 | export const readyAndStartGame = async (hostPage: Page, guestPage: Page) => {
ADD e2e/helpers/dicethrone.ts:268 | OK 测试/覆盖新增，需与主链保持一致 |     await readyPlayersAndStartGame(hostPage, [guestPage]);
ADD e2e/helpers/dicethrone.ts:269 | OK 测试/覆盖新增，需与主链保持一致 | };
ADD e2e/helpers/dicethrone.ts:270 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:271 | OK 测试/覆盖新增，需与主链保持一致 | export const readyMultiplePlayersAndStartGame = readyPlayersAndStartGame;
ADD e2e/helpers/dicethrone.ts:272 | OK 测试/覆盖新增，需与主链保持一致 | 
DEL e2e/helpers/dicethrone.ts:129 | 注意 删除/收口测试，覆盖减少需确认 |     // 等待游戏棋盘的关键元素出现（使用 tutorial-id 定位骰子投掷按钮）
DEL e2e/helpers/dicethrone.ts:134 | 注意 删除/收口测试，覆盖减少需确认 | // 双人对局设置
ADD e2e/helpers/dicethrone.ts:278 | OK 测试/覆盖新增，需与主链保持一致 | // 联机场景 setup
ADD e2e/helpers/dicethrone.ts:287 | OK 测试/覆盖新增，需与主链保持一致 |     players: DTPlayerSession[];
ADD e2e/helpers/dicethrone.ts:288 | OK 测试/覆盖新增，需与主链保持一致 |     extraPlayers: DTPlayerSession[];
DEL e2e/helpers/dicethrone.ts:145 | 注意 删除/收口测试，覆盖减少需确认 | export const setupDTOnlineMatch = async (
ADD e2e/helpers/dicethrone.ts:291 | OK 测试/覆盖新增，需与主链保持一致 | export interface DTPlayerSession {
ADD e2e/helpers/dicethrone.ts:292 | OK 测试/覆盖新增，需与主链保持一致 |     context: BrowserContext;
ADD e2e/helpers/dicethrone.ts:293 | OK 测试/覆盖新增，需与主链保持一致 |     page: Page;
ADD e2e/helpers/dicethrone.ts:294 | OK 测试/覆盖新增，需与主链保持一致 |     playerId: string;
ADD e2e/helpers/dicethrone.ts:295 | OK 测试/覆盖新增，需与主链保持一致 |     guestId: string;
ADD e2e/helpers/dicethrone.ts:296 | OK 测试/覆盖新增，需与主链保持一致 |     playerName: string;
ADD e2e/helpers/dicethrone.ts:297 | OK 测试/覆盖新增，需与主链保持一致 |     credentials: string;
ADD e2e/helpers/dicethrone.ts:298 | OK 测试/覆盖新增，需与主链保持一致 | }
ADD e2e/helpers/dicethrone.ts:299 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:300 | OK 测试/覆盖新增，需与主链保持一致 | const createPlayerContext = async (
DEL e2e/helpers/dicethrone.ts:148 | 注意 删除/收口测试，覆盖减少需确认 | ): Promise<DTMatchSetup | null> => {
DEL e2e/helpers/dicethrone.ts:149 | 注意 删除/收口测试，覆盖减少需确认 |     const hostContext = await browser.newContext({ baseURL });
DEL e2e/helpers/dicethrone.ts:150 | 注意 删除/收口测试，覆盖减少需确认 |     await initContext(hostContext, { storageKey: '__dicethrone_storage_reset', skipTutorial: false });
DEL e2e/helpers/dicethrone.ts:151 | 注意 删除/收口测试，覆盖减少需确认 |     const hostPage = await hostContext.newPage();
DEL e2e/helpers/dicethrone.ts:152 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/helpers/dicethrone.ts:153 | 注意 删除/收口测试，覆盖减少需确认 |     await hostPage.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => {});
DEL e2e/helpers/dicethrone.ts:154 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/helpers/dicethrone.ts:155 | 注意 删除/收口测试，覆盖减少需确认 |     if (!(await ensureGameServerAvailable(hostPage))) return null;
ADD e2e/helpers/dicethrone.ts:303 | OK 测试/覆盖新增，需与主链保持一致 |     storageKey: string,
ADD e2e/helpers/dicethrone.ts:304 | OK 测试/覆盖新增，需与主链保持一致 |     gameServerBaseURL?: string,
ADD e2e/helpers/dicethrone.ts:305 | OK 测试/覆盖新增，需与主链保持一致 | ) => {
ADD e2e/helpers/dicethrone.ts:306 | OK 测试/覆盖新增，需与主链保持一致 |     const context = await browser.newContext({ baseURL });
ADD e2e/helpers/dicethrone.ts:307 | OK 测试/覆盖新增，需与主链保持一致 |     await initContext(context, { storageKey, skipTutorial: false, gameServerBaseURL });
ADD e2e/helpers/dicethrone.ts:308 | OK 测试/覆盖新增，需与主链保持一致 |     const page = await context.newPage();
ADD e2e/helpers/dicethrone.ts:309 | OK 测试/覆盖新增，需与主链保持一致 |     await page.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => {});
ADD e2e/helpers/dicethrone.ts:310 | OK 测试/覆盖新增，需与主链保持一致 |     return { context, page };
ADD e2e/helpers/dicethrone.ts:311 | OK 测试/覆盖新增，需与主链保持一致 | };
DEL e2e/helpers/dicethrone.ts:157 | 注意 删除/收口测试，覆盖减少需确认 |     const hostGuestId = `e2e_host_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
DEL e2e/helpers/dicethrone.ts:158 | 注意 删除/收口测试，覆盖减少需确认 |     const matchId = await createDTRoomViaAPI(hostPage, hostGuestId);
DEL e2e/helpers/dicethrone.ts:159 | 注意 删除/收口测试，覆盖减少需确认 |     if (!matchId) return null;
ADD e2e/helpers/dicethrone.ts:313 | OK 测试/覆盖新增，需与主链保持一致 | export const setupDTOnlineMatchWithPlayers = async (
ADD e2e/helpers/dicethrone.ts:314 | OK 测试/覆盖新增，需与主链保持一致 |     browser: Browser,
ADD e2e/helpers/dicethrone.ts:315 | OK 测试/覆盖新增，需与主链保持一致 |     baseURL: string | undefined,
ADD e2e/helpers/dicethrone.ts:316 | OK 测试/覆盖新增，需与主链保持一致 |     options?: { numPlayers?: number; gameServerBaseURL?: string },
ADD e2e/helpers/dicethrone.ts:317 | OK 测试/覆盖新增，需与主链保持一致 | ): Promise<DTMatchSetup | null> => {
ADD e2e/helpers/dicethrone.ts:318 | OK 测试/覆盖新增，需与主链保持一致 |     const numPlayers = options?.numPlayers ?? 2;
ADD e2e/helpers/dicethrone.ts:319 | OK 测试/覆盖新增，需与主链保持一致 |     const gameServerBaseURL = options?.gameServerBaseURL ?? getGameServerBaseURL();
ADD e2e/helpers/dicethrone.ts:320 | OK 测试/覆盖新增，需与主链保持一致 |     const openedContexts: BrowserContext[] = [];
ADD e2e/helpers/dicethrone.ts:321 | OK 测试/覆盖新增，需与主链保持一致 |     let setupStep = `start numPlayers=${numPlayers} baseURL=${baseURL ?? 'undefined'} gameServer=${gameServerBaseURL}`;
DEL e2e/helpers/dicethrone.ts:161 | 注意 删除/收口测试，覆盖减少需确认 |     const hostCredentials = await joinDTMatchViaAPI(hostPage, matchId, '0', `Host-${Date.now()}`, hostGuestId);
DEL e2e/helpers/dicethrone.ts:162 | 注意 删除/收口测试，覆盖减少需确认 |     if (!hostCredentials) return null;
ADD e2e/helpers/dicethrone.ts:323 | OK 测试/覆盖新增，需与主链保持一致 |     try {
ADD e2e/helpers/dicethrone.ts:324 | OK 测试/覆盖新增，需与主链保持一致 |         const { context: hostContext, page: hostPage } = await createPlayerContext(
ADD e2e/helpers/dicethrone.ts:325 | OK 测试/覆盖新增，需与主链保持一致 |             browser,
ADD e2e/helpers/dicethrone.ts:326 | OK 测试/覆盖新增，需与主链保持一致 |             baseURL,
ADD e2e/helpers/dicethrone.ts:327 | OK 测试/覆盖新增，需与主链保持一致 |             '__dicethrone_storage_reset_host',
ADD e2e/helpers/dicethrone.ts:328 | OK 测试/覆盖新增，需与主链保持一致 |             gameServerBaseURL,
ADD e2e/helpers/dicethrone.ts:329 | OK 测试/覆盖新增，需与主链保持一致 |         );
ADD e2e/helpers/dicethrone.ts:330 | OK 测试/覆盖新增，需与主链保持一致 |         openedContexts.push(hostContext);
ADD e2e/helpers/dicethrone.ts:331 | OK 测试/覆盖新增，需与主链保持一致 |         setupStep = 'host_context_ready';
ADD e2e/helpers/dicethrone.ts:332 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:333 | OK 测试/覆盖新增，需与主链保持一致 |         if (!(await ensureGameServerAvailable(hostPage, gameServerBaseURL))) {
ADD e2e/helpers/dicethrone.ts:334 | OK 测试/覆盖新增，需与主链保持一致 |             appendSetupDebug(`FAIL step=${setupStep} numPlayers=${numPlayers} reason=game_server_unavailable`);
ADD e2e/helpers/dicethrone.ts:335 | OK 测试/覆盖新增，需与主链保持一致 |             return null;
ADD e2e/helpers/dicethrone.ts:336 | OK 测试/覆盖新增，需与主链保持一致 |         }
ADD e2e/helpers/dicethrone.ts:337 | OK 测试/覆盖新增，需与主链保持一致 |         setupStep = 'game_server_available';
DEL e2e/helpers/dicethrone.ts:164 | 注意 删除/收口测试，覆盖减少需确认 |     await seedDTMatchCredentials(hostContext, matchId, '0', hostCredentials);
DEL e2e/helpers/dicethrone.ts:165 | 注意 删除/收口测试，覆盖减少需确认 |     await hostPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });
DEL e2e/helpers/dicethrone.ts:166 | 注意 删除/收口测试，覆盖减少需确认 |     await waitForCharacterSelection(hostPage);
ADD e2e/helpers/dicethrone.ts:339 | OK 测试/覆盖新增，需与主链保持一致 |         const hostGuestId = createDtGuestId('e2e_host');
ADD e2e/helpers/dicethrone.ts:340 | OK 测试/覆盖新增，需与主链保持一致 |         const matchId = await createDTRoomViaAPI(hostPage, { guestId: hostGuestId, numPlayers, gameServerBaseURL });
ADD e2e/helpers/dicethrone.ts:341 | OK 测试/覆盖新增，需与主链保持一致 |         if (!matchId) {
ADD e2e/helpers/dicethrone.ts:342 | OK 测试/覆盖新增，需与主链保持一致 |             appendSetupDebug(`FAIL step=${setupStep} numPlayers=${numPlayers} reason=create_room_failed`);
ADD e2e/helpers/dicethrone.ts:343 | OK 测试/覆盖新增，需与主链保持一致 |             return null;
ADD e2e/helpers/dicethrone.ts:344 | OK 测试/覆盖新增，需与主链保持一致 |         }
ADD e2e/helpers/dicethrone.ts:345 | OK 测试/覆盖新增，需与主链保持一致 |         setupStep = `room_created matchId=${matchId}`;
DEL e2e/helpers/dicethrone.ts:168 | 注意 删除/收口测试，覆盖减少需确认 |     const guestContext = await browser.newContext({ baseURL });
DEL e2e/helpers/dicethrone.ts:169 | 注意 删除/收口测试，覆盖减少需确认 |     await initContext(guestContext, { storageKey: '__dicethrone_storage_reset', skipTutorial: false });
DEL e2e/helpers/dicethrone.ts:170 | 注意 删除/收口测试，覆盖减少需确认 |     const guestPage = await guestContext.newPage();
ADD e2e/helpers/dicethrone.ts:347 | OK 测试/覆盖新增，需与主链保持一致 |         const hostPlayerName = `Host-${Date.now()}`;
ADD e2e/helpers/dicethrone.ts:348 | OK 测试/覆盖新增，需与主链保持一致 |         const hostCredentials = await claimDTSeatViaAPI(hostPage, matchId, '0', {
ADD e2e/helpers/dicethrone.ts:349 | OK 测试/覆盖新增，需与主链保持一致 |             guestId: hostGuestId,
ADD e2e/helpers/dicethrone.ts:350 | OK 测试/覆盖新增，需与主链保持一致 |             playerName: hostPlayerName,
ADD e2e/helpers/dicethrone.ts:351 | OK 测试/覆盖新增，需与主链保持一致 |             gameServerBaseURL,
ADD e2e/helpers/dicethrone.ts:352 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD e2e/helpers/dicethrone.ts:353 | OK 测试/覆盖新增，需与主链保持一致 |         if (!hostCredentials) {
ADD e2e/helpers/dicethrone.ts:354 | OK 测试/覆盖新增，需与主链保持一致 |             appendSetupDebug(`FAIL step=${setupStep} numPlayers=${numPlayers} reason=host_claim_failed`);
ADD e2e/helpers/dicethrone.ts:355 | OK 测试/覆盖新增，需与主链保持一致 |             return null;
ADD e2e/helpers/dicethrone.ts:356 | OK 测试/覆盖新增，需与主链保持一致 |         }
ADD e2e/helpers/dicethrone.ts:357 | OK 测试/覆盖新增，需与主链保持一致 |         setupStep = 'host_claimed';
DEL e2e/helpers/dicethrone.ts:172 | 注意 删除/收口测试，覆盖减少需确认 |     // 先导航到首页，确保 guestPage 有正确的 cookie
DEL e2e/helpers/dicethrone.ts:173 | 注意 删除/收口测试，覆盖减少需确认 |     await guestPage.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => {});
DEL e2e/helpers/dicethrone.ts:174 | 注意 删除/收口测试，覆盖减少需确认 |     await guestPage.waitForTimeout(500);
ADD e2e/helpers/dicethrone.ts:359 | OK 测试/覆盖新增，需与主链保持一致 |         await seedDTMatchCredentials(hostContext, matchId, '0', hostCredentials);
ADD e2e/helpers/dicethrone.ts:360 | OK 测试/覆盖新增，需与主链保持一致 |         await gotoWithRetry(hostPage, `/play/${GAME_NAME}/match/${matchId}?playerID=0`, {
ADD e2e/helpers/dicethrone.ts:361 | OK 测试/覆盖新增，需与主链保持一致 |             label: 'host-match-page',
ADD e2e/helpers/dicethrone.ts:362 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD e2e/helpers/dicethrone.ts:363 | OK 测试/覆盖新增，需与主链保持一致 |         setupStep = 'host_goto_done';
ADD e2e/helpers/dicethrone.ts:364 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:365 | OK 测试/覆盖新增，需与主链保持一致 |         const players: DTPlayerSession[] = [{
ADD e2e/helpers/dicethrone.ts:366 | OK 测试/覆盖新增，需与主链保持一致 |             context: hostContext,
ADD e2e/helpers/dicethrone.ts:367 | OK 测试/覆盖新增，需与主链保持一致 |             page: hostPage,
ADD e2e/helpers/dicethrone.ts:368 | OK 测试/覆盖新增，需与主链保持一致 |             playerId: '0',
ADD e2e/helpers/dicethrone.ts:369 | OK 测试/覆盖新增，需与主链保持一致 |             guestId: hostGuestId,
ADD e2e/helpers/dicethrone.ts:370 | OK 测试/覆盖新增，需与主链保持一致 |             playerName: hostPlayerName,
ADD e2e/helpers/dicethrone.ts:371 | OK 测试/覆盖新增，需与主链保持一致 |             credentials: hostCredentials,
ADD e2e/helpers/dicethrone.ts:372 | OK 测试/覆盖新增，需与主链保持一致 |         }];
ADD e2e/helpers/dicethrone.ts:373 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:374 | OK 测试/覆盖新增，需与主链保持一致 |         for (let index = 1; index < numPlayers; index++) {
ADD e2e/helpers/dicethrone.ts:375 | OK 测试/覆盖新增，需与主链保持一致 |             const playerId = String(index);
ADD e2e/helpers/dicethrone.ts:376 | OK 测试/覆盖新增，需与主链保持一致 |             const { context: guestContext, page: guestPage } = await createPlayerContext(
ADD e2e/helpers/dicethrone.ts:377 | OK 测试/覆盖新增，需与主链保持一致 |                 browser,
ADD e2e/helpers/dicethrone.ts:378 | OK 测试/覆盖新增，需与主链保持一致 |                 baseURL,
ADD e2e/helpers/dicethrone.ts:379 | OK 测试/覆盖新增，需与主链保持一致 |                 `__dicethrone_storage_reset_${playerId}`,
ADD e2e/helpers/dicethrone.ts:380 | OK 测试/覆盖新增，需与主链保持一致 |                 gameServerBaseURL,
ADD e2e/helpers/dicethrone.ts:381 | OK 测试/覆盖新增，需与主链保持一致 |             );
ADD e2e/helpers/dicethrone.ts:382 | OK 测试/覆盖新增，需与主链保持一致 |             openedContexts.push(guestContext);
ADD e2e/helpers/dicethrone.ts:383 | OK 测试/覆盖新增，需与主链保持一致 |             await guestPage.waitForTimeout(500);
ADD e2e/helpers/dicethrone.ts:384 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:385 | OK 测试/覆盖新增，需与主链保持一致 |             const guestId = createDtGuestId(`e2e_guest_${playerId}`);
ADD e2e/helpers/dicethrone.ts:386 | OK 测试/覆盖新增，需与主链保持一致 |             const playerName = `Guest-${playerId}-${Date.now()}`;
ADD e2e/helpers/dicethrone.ts:387 | OK 测试/覆盖新增，需与主链保持一致 |             const guestCredentials = await joinDTMatchViaAPI(
ADD e2e/helpers/dicethrone.ts:388 | OK 测试/覆盖新增，需与主链保持一致 |                 guestPage,
ADD e2e/helpers/dicethrone.ts:389 | OK 测试/覆盖新增，需与主链保持一致 |                 matchId,
ADD e2e/helpers/dicethrone.ts:390 | OK 测试/覆盖新增，需与主链保持一致 |                 playerId,
ADD e2e/helpers/dicethrone.ts:391 | OK 测试/覆盖新增，需与主链保持一致 |                 playerName,
ADD e2e/helpers/dicethrone.ts:392 | OK 测试/覆盖新增，需与主链保持一致 |                 guestId,
ADD e2e/helpers/dicethrone.ts:393 | OK 测试/覆盖新增，需与主链保持一致 |                 gameServerBaseURL,
ADD e2e/helpers/dicethrone.ts:394 | OK 测试/覆盖新增，需与主链保持一致 |             );
ADD e2e/helpers/dicethrone.ts:395 | OK 测试/覆盖新增，需与主链保持一致 |             if (!guestCredentials) {
ADD e2e/helpers/dicethrone.ts:396 | OK 测试/覆盖新增，需与主链保持一致 |                 appendSetupDebug(`FAIL step=${setupStep} numPlayers=${numPlayers} reason=guest_join_failed playerId=${playerId}`);
ADD e2e/helpers/dicethrone.ts:397 | OK 测试/覆盖新增，需与主链保持一致 |                 return null;
ADD e2e/helpers/dicethrone.ts:398 | OK 测试/覆盖新增，需与主链保持一致 |             }
ADD e2e/helpers/dicethrone.ts:399 | OK 测试/覆盖新增，需与主链保持一致 |             setupStep = `guest_${playerId}_joined`;
ADD e2e/helpers/dicethrone.ts:400 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:401 | OK 测试/覆盖新增，需与主链保持一致 |             await seedDTMatchCredentials(guestContext, matchId, playerId, guestCredentials);
ADD e2e/helpers/dicethrone.ts:402 | OK 测试/覆盖新增，需与主链保持一致 |             await gotoWithRetry(guestPage, `/play/${GAME_NAME}/match/${matchId}?playerID=${playerId}`, {
ADD e2e/helpers/dicethrone.ts:403 | OK 测试/覆盖新增，需与主链保持一致 |                 label: `guest-${playerId}-match-page`,
ADD e2e/helpers/dicethrone.ts:404 | OK 测试/覆盖新增，需与主链保持一致 |             });
ADD e2e/helpers/dicethrone.ts:405 | OK 测试/覆盖新增，需与主链保持一致 |             setupStep = `guest_${playerId}_goto_done`;
ADD e2e/helpers/dicethrone.ts:406 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:407 | OK 测试/覆盖新增，需与主链保持一致 |             players.push({
ADD e2e/helpers/dicethrone.ts:408 | OK 测试/覆盖新增，需与主链保持一致 |                 context: guestContext,
ADD e2e/helpers/dicethrone.ts:409 | OK 测试/覆盖新增，需与主链保持一致 |                 page: guestPage,
ADD e2e/helpers/dicethrone.ts:410 | OK 测试/覆盖新增，需与主链保持一致 |                 playerId,
ADD e2e/helpers/dicethrone.ts:411 | OK 测试/覆盖新增，需与主链保持一致 |                 guestId,
ADD e2e/helpers/dicethrone.ts:412 | OK 测试/覆盖新增，需与主链保持一致 |                 playerName,
ADD e2e/helpers/dicethrone.ts:413 | OK 测试/覆盖新增，需与主链保持一致 |                 credentials: guestCredentials,
ADD e2e/helpers/dicethrone.ts:414 | OK 测试/覆盖新增，需与主链保持一致 |             });
ADD e2e/helpers/dicethrone.ts:415 | OK 测试/覆盖新增，需与主链保持一致 |         }
DEL e2e/helpers/dicethrone.ts:176 | 注意 删除/收口测试，覆盖减少需确认 |     const guestGuestId = `e2e_guest_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
DEL e2e/helpers/dicethrone.ts:177 | 注意 删除/收口测试，覆盖减少需确认 |     // 使用 guestPage 的 request 而不是 hostPage，确保 cookie 正确
DEL e2e/helpers/dicethrone.ts:178 | 注意 删除/收口测试，覆盖减少需确认 |     const guestCredentials = await joinDTMatchViaAPI(guestPage, matchId, '1', `Guest-${Date.now()}`, guestGuestId);
DEL e2e/helpers/dicethrone.ts:179 | 注意 删除/收口测试，覆盖减少需确认 |     if (!guestCredentials) return null;
ADD e2e/helpers/dicethrone.ts:417 | OK 测试/覆盖新增，需与主链保持一致 |         const guestPlayer = players[1];
ADD e2e/helpers/dicethrone.ts:418 | OK 测试/覆盖新增，需与主链保持一致 |         if (!guestPlayer) {
ADD e2e/helpers/dicethrone.ts:419 | OK 测试/覆盖新增，需与主链保持一致 |             appendSetupDebug(`FAIL step=${setupStep} numPlayers=${numPlayers} reason=missing_guest_player`);
ADD e2e/helpers/dicethrone.ts:420 | OK 测试/覆盖新增，需与主链保持一致 |             return null;
ADD e2e/helpers/dicethrone.ts:421 | OK 测试/覆盖新增，需与主链保持一致 |         }
DEL e2e/helpers/dicethrone.ts:181 | 注意 删除/收口测试，覆盖减少需确认 |     await seedDTMatchCredentials(guestContext, matchId, '1', guestCredentials);
DEL e2e/helpers/dicethrone.ts:182 | 注意 删除/收口测试，覆盖减少需确认 |     await guestPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=1`, { waitUntil: 'domcontentloaded' });
DEL e2e/helpers/dicethrone.ts:183 | 注意 删除/收口测试，覆盖减少需确认 |     await waitForCharacterSelection(guestPage);
ADD e2e/helpers/dicethrone.ts:423 | OK 测试/覆盖新增，需与主链保持一致 |         for (const player of players) {
ADD e2e/helpers/dicethrone.ts:424 | OK 测试/覆盖新增，需与主链保持一致 |             await waitForCharacterSelection(player.page);
ADD e2e/helpers/dicethrone.ts:425 | OK 测试/覆盖新增，需与主链保持一致 |         }
ADD e2e/helpers/dicethrone.ts:426 | OK 测试/覆盖新增，需与主链保持一致 |         setupStep = 'all_character_selection_ready';
ADD e2e/helpers/dicethrone.ts:427 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:428 | OK 测试/覆盖新增，需与主链保持一致 |         appendSetupDebug(`OK matchId=${matchId} numPlayers=${numPlayers}`);
ADD e2e/helpers/dicethrone.ts:429 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/dicethrone.ts:430 | OK 测试/覆盖新增，需与主链保持一致 |         return {
ADD e2e/helpers/dicethrone.ts:431 | OK 测试/覆盖新增，需与主链保持一致 |             hostContext,
ADD e2e/helpers/dicethrone.ts:432 | OK 测试/覆盖新增，需与主链保持一致 |             guestContext: guestPlayer.context,
ADD e2e/helpers/dicethrone.ts:433 | OK 测试/覆盖新增，需与主链保持一致 |             hostPage,
ADD e2e/helpers/dicethrone.ts:434 | OK 测试/覆盖新增，需与主链保持一致 |             guestPage: guestPlayer.page,
ADD e2e/helpers/dicethrone.ts:435 | OK 测试/覆盖新增，需与主链保持一致 |             matchId,
ADD e2e/helpers/dicethrone.ts:436 | OK 测试/覆盖新增，需与主链保持一致 |             players,
ADD e2e/helpers/dicethrone.ts:437 | OK 测试/覆盖新增，需与主链保持一致 |             extraPlayers: players.slice(2),
ADD e2e/helpers/dicethrone.ts:438 | OK 测试/覆盖新增，需与主链保持一致 |         };
ADD e2e/helpers/dicethrone.ts:439 | OK 测试/覆盖新增，需与主链保持一致 |     } catch (error) {
ADD e2e/helpers/dicethrone.ts:440 | OK 测试/覆盖新增，需与主链保持一致 |         const message = error instanceof Error
ADD e2e/helpers/dicethrone.ts:441 | OK 测试/覆盖新增，需与主链保持一致 |             ? `${error.name}: ${error.message}`
ADD e2e/helpers/dicethrone.ts:442 | OK 测试/覆盖新增，需与主链保持一致 |             : String(error);
ADD e2e/helpers/dicethrone.ts:443 | OK 测试/覆盖新增，需与主链保持一致 |         appendSetupDebug(`FAIL step=${setupStep} numPlayers=${numPlayers} error=${message}`);
ADD e2e/helpers/dicethrone.ts:444 | OK 测试/覆盖新增，需与主链保持一致 |         await Promise.all(openedContexts.map(async (context) => {
ADD e2e/helpers/dicethrone.ts:445 | OK 测试/覆盖新增，需与主链保持一致 |             await context.close().catch(() => {});
ADD e2e/helpers/dicethrone.ts:446 | OK 测试/覆盖新增，需与主链保持一致 |         }));
ADD e2e/helpers/dicethrone.ts:447 | OK 测试/覆盖新增，需与主链保持一致 |         return null;
ADD e2e/helpers/dicethrone.ts:448 | OK 测试/覆盖新增，需与主链保持一致 |     }
ADD e2e/helpers/dicethrone.ts:449 | OK 测试/覆盖新增，需与主链保持一致 | };
DEL e2e/helpers/dicethrone.ts:185 | 注意 删除/收口测试，覆盖减少需确认 |     return { hostContext, guestContext, hostPage, guestPage, matchId };
ADD e2e/helpers/dicethrone.ts:451 | OK 测试/覆盖新增，需与主链保持一致 | export const setupDTOnlineMatch = async (
ADD e2e/helpers/dicethrone.ts:452 | OK 测试/覆盖新增，需与主链保持一致 |     browser: Browser,
ADD e2e/helpers/dicethrone.ts:453 | OK 测试/覆盖新增，需与主链保持一致 |     baseURL: string | undefined,
ADD e2e/helpers/dicethrone.ts:454 | OK 测试/覆盖新增，需与主链保持一致 |     options?: { gameServerBaseURL?: string },
ADD e2e/helpers/dicethrone.ts:455 | OK 测试/覆盖新增，需与主链保持一致 | ): Promise<DTMatchSetup | null> => {
ADD e2e/helpers/dicethrone.ts:456 | OK 测试/覆盖新增，需与主链保持一致 |     return setupDTOnlineMatchWithPlayers(browser, baseURL, {
ADD e2e/helpers/dicethrone.ts:457 | OK 测试/覆盖新增，需与主链保持一致 |         numPlayers: 2,
ADD e2e/helpers/dicethrone.ts:458 | OK 测试/覆盖新增，需与主链保持一致 |         gameServerBaseURL: options?.gameServerBaseURL,
ADD e2e/helpers/dicethrone.ts:459 | OK 测试/覆盖新增，需与主链保持一致 |     });
DEL e2e/helpers/dicethrone.ts:189 | 注意 删除/收口测试，覆盖减少需确认 |     await setup.guestContext.close();
DEL e2e/helpers/dicethrone.ts:190 | 注意 删除/收口测试，覆盖减少需确认 |     await setup.hostContext.close();
ADD e2e/helpers/dicethrone.ts:463 | OK 测试/覆盖新增，需与主链保持一致 |     const uniqueContexts = new Set<BrowserContext>([
ADD e2e/helpers/dicethrone.ts:464 | OK 测试/覆盖新增，需与主链保持一致 |         ...(setup.players?.map((player) => player.context) ?? []),
ADD e2e/helpers/dicethrone.ts:465 | OK 测试/覆盖新增，需与主链保持一致 |         setup.guestContext,
ADD e2e/helpers/dicethrone.ts:466 | OK 测试/覆盖新增，需与主链保持一致 |         setup.hostContext,
ADD e2e/helpers/dicethrone.ts:467 | OK 测试/覆盖新增，需与主链保持一致 |     ]);
ADD e2e/helpers/dicethrone.ts:468 | OK 测试/覆盖新增，需与主链保持一致 |     await Promise.all(Array.from(uniqueContexts).map(async (context) => {
ADD e2e/helpers/dicethrone.ts:469 | OK 测试/覆盖新增，需与主链保持一致 |         await context.close().catch(() => {});
ADD e2e/helpers/dicethrone.ts:470 | OK 测试/覆盖新增，需与主链保持一致 |     }));
DEL e2e/helpers/dicethrone.ts:193 | 注意 删除/收口测试，覆盖减少需确认 | 
DEL e2e/helpers/dicethrone.ts:195 | 注意 删除/收口测试，覆盖减少需确认 | // 调试面板操作
ADD e2e/helpers/dicethrone.ts:474 | OK 测试/覆盖新增，需与主链保持一致 | // 璋冭瘯闈㈡澘鎿嶄綔
DEL e2e/helpers/dicethrone.ts:198 | 注意 删除/收口测试，覆盖减少需确认 | /** 确保调试面板打开 */
ADD e2e/helpers/dicethrone.ts:477 | OK 测试/覆盖新增，需与主链保持一致 | /** 纭繚璋冭瘯闈㈡澘鎵撳紑 */
DEL e2e/helpers/dicethrone.ts:206 | 注意 删除/收口测试，覆盖减少需确认 | /** 确保调试面板关闭 */
ADD e2e/helpers/dicethrone.ts:485 | OK 测试/覆盖新增，需与主链保持一致 | /** 纭繚璋冭瘯闈㈡澘鍏抽棴 */
DEL e2e/helpers/dicethrone.ts:214 | 注意 删除/收口测试，覆盖减少需确认 | /** 隐藏 FAB 菜单和调试开关，避免遮挡移动端窄视口点击区域 */
ADD e2e/helpers/dicethrone.ts:493 | OK 测试/覆盖新增，需与主链保持一致 | /** 闅愯棌 FAB 鑿滃崟鍜岃皟璇曞紑鍏筹紝閬垮厤閬尅绉诲姩绔獎瑙嗗彛鐐瑰嚮鍖哄煙 */
DEL e2e/helpers/dicethrone.ts:224 | 注意 删除/收口测试，覆盖减少需确认 | /** 切换到调试面板的状态 Tab */
ADD e2e/helpers/dicethrone.ts:503 | OK 测试/覆盖新增，需与主链保持一致 | /** 鍒囨崲鍒拌皟璇曢潰鏉跨殑鐘舵€?Tab */
DEL e2e/helpers/dicethrone.ts:233 | 注意 删除/收口测试，覆盖减少需确认 | /** 切换到调试面板的控制 Tab */
ADD e2e/helpers/dicethrone.ts:512 | OK 测试/覆盖新增，需与主链保持一致 | /** 鍒囨崲鍒拌皟璇曢潰鏉跨殑鎺у埗 Tab */
DEL e2e/helpers/dicethrone.ts:243 | 注意 删除/收口测试，覆盖减少需确认 |  * 读取 core 状态
ADD e2e/helpers/dicethrone.ts:522 | OK 测试/覆盖新增，需与主链保持一致 |  * 璇诲彇 core 鐘舵€?
DEL e2e/helpers/dicethrone.ts:253 | 注意 删除/收口测试，覆盖减少需确认 |  * 读取事件流（EventStream）
ADD e2e/helpers/dicethrone.ts:532 | OK 测试/覆盖新增，需与主链保持一致 |  * 璇诲彇浜嬩欢娴侊紙EventStream锛?
DEL e2e/helpers/dicethrone.ts:264 | 注意 删除/收口测试，覆盖减少需确认 |  * 直接注入 core 状态（使用调试面板）
ADD e2e/helpers/dicethrone.ts:543 | OK 测试/覆盖新增，需与主链保持一致 |  * 鐩存帴娉ㄥ叆 core 鐘舵€侊紙浣跨敤璋冭瘯闈㈡澘锛?
DEL e2e/helpers/dicethrone.ts:278 | 注意 删除/收口测试，覆盖减少需确认 |  * 通过调试面板修改资源值
ADD e2e/helpers/dicethrone.ts:557 | OK 测试/覆盖新增，需与主链保持一致 |  * 閫氳繃璋冭瘯闈㈡澘淇敼璧勬簮鍊?
DEL e2e/helpers/dicethrone.ts:290 | 注意 删除/收口测试，覆盖减少需确认 |  * 通过调试面板设置玩家 token
ADD e2e/helpers/dicethrone.ts:569 | OK 测试/覆盖新增，需与主链保持一致 |  * 閫氳繃璋冭瘯闈㈡澘璁剧疆鐜╁ token
DEL e2e/helpers/dicethrone.ts:305 | 注意 删除/收口测试，覆盖减少需确认 |  * 设置骰子值（通过调试面板）
ADD e2e/helpers/dicethrone.ts:584 | OK 测试/覆盖新增，需与主链保持一致 |  * 璁剧疆楠板瓙鍊硷紙閫氳繃璋冭瘯闈㈡澘锛?
DEL e2e/helpers/dicethrone.ts:312 | 注意 删除/收口测试，覆盖减少需确认 |     // 更新骰子值
ADD e2e/helpers/dicethrone.ts:591 | OK 测试/覆盖新增，需与主链保持一致 |     // 鏇存柊楠板瓙鍊?
DEL e2e/helpers/dicethrone.ts:316 | 注意 删除/收口测试，覆盖减少需确认 |         symbol: values[i] ?? die.value, // 简化处理，实际应该根据 definitionId 查找 face
ADD e2e/helpers/dicethrone.ts:595 | OK 测试/覆盖新增，需与主链保持一致 |         symbol: values[i] ?? die.value, // 绠€鍖栧鐞嗭紝瀹為檯搴旇鏍规嵁 definitionId 鏌ユ壘 face
DEL e2e/helpers/dicethrone.ts:319 | 注意 删除/收口测试，覆盖减少需确认 |     state.rollConfirmed = false; // 允许用户重新确认
ADD e2e/helpers/dicethrone.ts:598 | OK 测试/覆盖新增，需与主链保持一致 |     state.rollConfirmed = false; // 鍏佽鐢ㄦ埛閲嶆柊纭
DEL e2e/helpers/dicethrone.ts:324 | 注意 删除/收口测试，覆盖减少需确认 |  * 通过 dispatch 修改状态（已废弃，使用 applyCoreStateDirect 替代）
ADD e2e/helpers/dicethrone.ts:603 | OK 测试/覆盖新增，需与主链保持一致 |  * 閫氳繃 dispatch 淇敼鐘舵€侊紙宸插簾寮冿紝浣跨敤 applyCoreStateDirect 鏇夸唬锛?
DEL e2e/helpers/dicethrone.ts:333 | 注意 删除/收口测试，覆盖减少需确认 | // 其他辅助函数
ADD e2e/helpers/dicethrone.ts:612 | OK 测试/覆盖新增，需与主链保持一致 | // 鍏朵粬杈呭姪鍑芥暟
DEL e2e/helpers/dicethrone.ts:337 | 注意 删除/收口测试，覆盖减少需确认 |  * 等待主要阶段
ADD e2e/helpers/dicethrone.ts:616 | OK 测试/覆盖新增，需与主链保持一致 |  * 绛夊緟涓昏闃舵
DEL e2e/helpers/dicethrone.ts:340 | 注意 删除/收口测试，覆盖减少需确认 |     await expect(page.getByText(/Main Phase|主要阶段/i)).toBeVisible({ timeout });
ADD e2e/helpers/dicethrone.ts:619 | OK 测试/覆盖新增，需与主链保持一致 |     await expect(page.getByText(/Main Phase|涓昏闃舵/i)).toBeVisible({ timeout });
DEL e2e/helpers/dicethrone.ts:344 | 注意 删除/收口测试，覆盖减少需确认 |  * 等待棋盘准备就绪
ADD e2e/helpers/dicethrone.ts:623 | OK 测试/覆盖新增，需与主链保持一致 |  * 绛夊緟妫嬬洏鍑嗗灏辩华
DEL e2e/helpers/dicethrone.ts:351 | 注意 删除/收口测试，覆盖减少需确认 |  * 等待教程棋盘就绪
DEL e2e/helpers/dicethrone.ts:352 | 注意 删除/收口测试，覆盖减少需确认 |  * 教程首页先出现的是 tutorial overlay，而不是骰子按钮。
ADD e2e/helpers/dicethrone.ts:630 | OK 测试/覆盖新增，需与主链保持一致 |  * 绛夊緟鏁欑▼妫嬬洏灏辩华
ADD e2e/helpers/dicethrone.ts:631 | OK 测试/覆盖新增，需与主链保持一致 |  * 鏁欑▼棣栭〉鍏堝嚭鐜扮殑鏄?tutorial overlay锛岃€屼笉鏄瀛愭寜閽€?
DEL e2e/helpers/dicethrone.ts:371 | 注意 删除/收口测试，覆盖减少需确认 |  * 从 URL 获取玩家 ID
ADD e2e/helpers/dicethrone.ts:650 | OK 测试/覆盖新增，需与主链保持一致 |  * 浠?URL 鑾峰彇鐜╁ ID
DEL e2e/helpers/dicethrone.ts:380 | 注意 删除/收口测试，覆盖减少需确认 |  * 获取模态框容器（通过标题）
ADD e2e/helpers/dicethrone.ts:659 | OK 测试/覆盖新增，需与主链保持一致 |  * 鑾峰彇妯℃€佹瀹瑰櫒锛堥€氳繃鏍囬锛?
DEL e2e/helpers/dicethrone.ts:387 | 注意 删除/收口测试，覆盖减少需确认 |  * 断言手牌可见
ADD e2e/helpers/dicethrone.ts:666 | OK 测试/覆盖新增，需与主链保持一致 |  * 鏂█鎵嬬墝鍙
DEL e2e/helpers/dicethrone.ts:397 | 注意 删除/收口测试，覆盖减少需确认 |  * 等待教学步骤
ADD e2e/helpers/dicethrone.ts:676 | OK 测试/覆盖新增，需与主链保持一致 |  * 绛夊緟鏁欏姝ラ
DEL e2e/helpers/dicethrone.ts:404 | 注意 删除/收口测试，覆盖减少需确认 |  * 分发本地命令（教程模式）
ADD e2e/helpers/dicethrone.ts:683 | OK 测试/覆盖新增，需与主链保持一致 |  * 鍒嗗彂鏈湴鍛戒护锛堟暀绋嬫ā寮忥級
DEL e2e/helpers/dicethrone.ts:418 | 注意 删除/收口测试，覆盖减少需确认 |  * 尝试点击 Pass 按钮（如果存在响应窗口）
DEL e2e/helpers/dicethrone.ts:419 | 注意 删除/收口测试，覆盖减少需确认 |  * @returns 是否点击了 Pass 按钮
ADD e2e/helpers/dicethrone.ts:697 | OK 测试/覆盖新增，需与主链保持一致 |  * 灏濊瘯鐐瑰嚮 Pass 鎸夐挳锛堝鏋滃瓨鍦ㄥ搷搴旂獥鍙ｏ級
ADD e2e/helpers/dicethrone.ts:698 | OK 测试/覆盖新增，需与主链保持一致 |  * @returns 鏄惁鐐瑰嚮浜?Pass 鎸夐挳
DEL e2e/helpers/dicethrone.ts:422 | 注意 删除/收口测试，覆盖减少需确认 |     const passButton = page.getByRole('button', { name: /^(Pass|跳过)$/i });
ADD e2e/helpers/dicethrone.ts:701 | OK 测试/覆盖新增，需与主链保持一致 |     const passButton = page.getByRole('button', { name: /^(Pass|璺宠繃)$/i });
DEL e2e/helpers/dicethrone.ts:432 | 注意 删除/收口测试，覆盖减少需确认 |  * 等待特定阶段
ADD e2e/helpers/dicethrone.ts:711 | OK 测试/覆盖新增，需与主链保持一致 |  * 绛夊緟鐗瑰畾闃舵
DEL e2e/helpers/dicethrone.ts:445 | 注意 删除/收口测试，覆盖减少需确认 |  * 推进到进攻投骰阶段
ADD e2e/helpers/dicethrone.ts:724 | OK 测试/覆盖新增，需与主链保持一致 |  * 鎺ㄨ繘鍒拌繘鏀绘姇楠伴樁娈?
DEL e2e/helpers/dicethrone.ts:449 | 注意 删除/收口测试，覆盖减少需确认 |     // 持续点击 Next Phase 直到进入 offensiveRoll 阶段
ADD e2e/helpers/dicethrone.ts:728 | OK 测试/覆盖新增，需与主链保持一致 |     // 鎸佺画鐐瑰嚮 Next Phase 鐩村埌杩涘叆 offensiveRoll 闃舵
DEL e2e/helpers/dicethrone.ts:454 | 注意 删除/收口测试，覆盖减少需确认 |             // 检查是否到达骰子投掷阶段
ADD e2e/helpers/dicethrone.ts:733 | OK 测试/覆盖新增，需与主链保持一致 |             // 妫€鏌ユ槸鍚﹀埌杈鹃瀛愭姇鎺烽樁娈?
DEL e2e/helpers/dicethrone.ts:466 | 注意 删除/收口测试，覆盖减少需确认 |  * 关闭调试面板（如果打开）
ADD e2e/helpers/dicethrone.ts:745 | OK 测试/覆盖新增，需与主链保持一致 |  * 鍏抽棴璋冭瘯闈㈡澘锛堝鏋滄墦寮€锛?
DEL e2e/helpers/dicethrone.ts:477 | 注意 删除/收口测试，覆盖减少需确认 |  * 设置在线对局（旧版兼容函数）
ADD e2e/helpers/dicethrone.ts:756 | OK 测试/覆盖新增，需与主链保持一致 |  * 璁剧疆鍦ㄧ嚎瀵瑰眬锛堟棫鐗堝吋瀹瑰嚱鏁帮級
DEL e2e/helpers/state-injection.ts:15 | 注意 删除/收口测试，覆盖减少需确认 | const TEST_API_BASE = process.env.TEST_API_BASE || getGameServerBaseURL();
ADD e2e/helpers/state-injection.ts:23 | OK 测试/覆盖新增，需与主链保持一致 | async function resolveTestApiBase(page?: Page): Promise<string> {
ADD e2e/helpers/state-injection.ts:24 | OK 测试/覆盖新增，需与主链保持一致 |     if (process.env.TEST_API_BASE) {
ADD e2e/helpers/state-injection.ts:25 | OK 测试/覆盖新增，需与主链保持一致 |         return process.env.TEST_API_BASE;
ADD e2e/helpers/state-injection.ts:26 | OK 测试/覆盖新增，需与主链保持一致 |     }
ADD e2e/helpers/state-injection.ts:27 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/state-injection.ts:28 | OK 测试/覆盖新增，需与主链保持一致 |     if (page) {
ADD e2e/helpers/state-injection.ts:29 | OK 测试/覆盖新增，需与主链保持一致 |         const forcedBase = await page.evaluate(() => {
ADD e2e/helpers/state-injection.ts:30 | OK 测试/覆盖新增，需与主链保持一致 |             return (window as Window & { __FORCE_GAME_SERVER_URL__?: string }).__FORCE_GAME_SERVER_URL__ ?? null;
ADD e2e/helpers/state-injection.ts:31 | OK 测试/覆盖新增，需与主链保持一致 |         }).catch(() => null);
ADD e2e/helpers/state-injection.ts:32 | OK 测试/覆盖新增，需与主链保持一致 |         if (forcedBase) {
ADD e2e/helpers/state-injection.ts:33 | OK 测试/覆盖新增，需与主链保持一致 |             return forcedBase;
ADD e2e/helpers/state-injection.ts:34 | OK 测试/覆盖新增，需与主链保持一致 |         }
ADD e2e/helpers/state-injection.ts:35 | OK 测试/覆盖新增，需与主链保持一致 |     }
ADD e2e/helpers/state-injection.ts:36 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD e2e/helpers/state-injection.ts:37 | OK 测试/覆盖新增，需与主链保持一致 |     return getGameServerBaseURL();
ADD e2e/helpers/state-injection.ts:38 | OK 测试/覆盖新增，需与主链保持一致 | }
ADD e2e/helpers/state-injection.ts:39 | OK 测试/覆盖新增，需与主链保持一致 | 
DEL e2e/helpers/state-injection.ts:100 | 注意 删除/收口测试，覆盖减少需确认 |     const response = await fetch(`${TEST_API_BASE}/test/inject-state`, {
ADD e2e/helpers/state-injection.ts:116 | OK 测试/覆盖新增，需与主链保持一致 |     const testApiBase = await resolveTestApiBase(page);
ADD e2e/helpers/state-injection.ts:117 | OK 测试/覆盖新增，需与主链保持一致 |     const response = await fetch(`${testApiBase}/test/inject-state`, {
DEL e2e/helpers/state-injection.ts:133 | 注意 删除/收口测试，覆盖减少需确认 |     const response = await fetch(`${TEST_API_BASE}/test/patch-state`, {
ADD e2e/helpers/state-injection.ts:150 | OK 测试/覆盖新增，需与主链保持一致 |     const testApiBase = await resolveTestApiBase(page);
ADD e2e/helpers/state-injection.ts:151 | OK 测试/覆盖新增，需与主链保持一致 |     const response = await fetch(`${testApiBase}/test/patch-state`, {
DEL e2e/helpers/state-injection.ts:162 | 注意 删除/收口测试，覆盖减少需确认 |     const response = await fetch(`${TEST_API_BASE}/test/get-state/${matchId}`, {
ADD e2e/helpers/state-injection.ts:180 | OK 测试/覆盖新增，需与主链保持一致 |     const testApiBase = await resolveTestApiBase(page);
ADD e2e/helpers/state-injection.ts:181 | OK 测试/覆盖新增，需与主链保持一致 |     const response = await fetch(`${testApiBase}/test/get-state/${matchId}`, {
DEL e2e/helpers/state-injection.ts:208 | 注意 删除/收口测试，覆盖减少需确认 |     const response = await fetch(`${TEST_API_BASE}/test/snapshot-state`, {
ADD e2e/helpers/state-injection.ts:227 | OK 测试/覆盖新增，需与主链保持一致 |     const testApiBase = await resolveTestApiBase(page);
ADD e2e/helpers/state-injection.ts:228 | OK 测试/覆盖新增，需与主链保持一致 |     const response = await fetch(`${testApiBase}/test/snapshot-state`, {
DEL e2e/helpers/state-injection.ts:237 | 注意 删除/收口测试，覆盖减少需确认 |     const response = await fetch(`${TEST_API_BASE}/test/restore-state`, {
ADD e2e/helpers/state-injection.ts:257 | OK 测试/覆盖新增，需与主链保持一致 |     const testApiBase = await resolveTestApiBase(page);
ADD e2e/helpers/state-injection.ts:258 | OK 测试/覆盖新增，需与主链保持一致 |     const response = await fetch(`${testApiBase}/test/restore-state`, {
ADD evidence/dicethrone-simple-start-e2e-test.md:1 | OK 文档/记录/证据，对运行逻辑无直接影响 | # DiceThrone 简单开局、4 人 2v2 与多人目标交互 E2E 证据
ADD evidence/dicethrone-simple-start-e2e-test.md:2 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD evidence/dicethrone-simple-start-e2e-test.md:3 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## 本轮覆盖范围
ADD evidence/dicethrone-simple-start-e2e-test.md:4 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 2 人联机开局链路：建房、入房、选角、准备、开局。
ADD evidence/dicethrone-simple-start-e2e-test.md:5 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 4 人联机房链路：建房、host `claim-seat`、其余 3 人 `join`、全员选角、开局。
ADD evidence/dicethrone-simple-start-e2e-test.md:6 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 4 人选角页站位链路：默认站位展示、点击空位移动、点击已占位拒绝交换。
ADD evidence/dicethrone-simple-start-e2e-test.md:7 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 4 人 2v2 战斗链路：顶部三窗、Targeting Roll 自动/手动选目标、目标面板显示与关闭、同队响应过滤、团队胜负 UI。
ADD evidence/dicethrone-simple-start-e2e-test.md:8 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 2 人多人目标交互链路：`Transfer Status` 第二阶段锁定来源卡 + 真实目标卡。
ADD evidence/dicethrone-simple-start-e2e-test.md:9 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 4 人多人目标交互链路：`Transfer Status` 在线双阶段交互、`Consecrate` 的任意玩家多 token 授予、`Vengeance II` 的任意玩家授 `Retribution`、`remove-status-1` 与 `remove-all-status` 的在线移除链路。
ADD evidence/dicethrone-simple-start-e2e-test.md:10 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD evidence/dicethrone-simple-start-e2e-test.md:11 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## 执行命令
ADD evidence/dicethrone-simple-start-e2e-test.md:12 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `node D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\node_modules\typescript\lib\tsc.js --noEmit --pretty false`
ADD evidence/dicethrone-simple-start-e2e-test.md:13 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts`
ADD evidence/dicethrone-simple-start-e2e-test.md:14 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `$env:PW_USE_DEV_SERVERS='true'; $env:PW_START_SERVERS='false'; $env:PW_HAS_EXPLICIT_TARGET='true'; $env:NODE_OPTIONS='--max-old-space-size=4096'; $env:VITE_DEV_PORT='6174'; $env:GAME_SERVER_PORT='20000'; $env:API_SERVER_PORT='21000'; node .\node_modules\@playwright\test\cli.js test e2e/dicethrone-simple-start.e2e.ts`
ADD evidence/dicethrone-simple-start-e2e-test.md:15 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player transfer token: enemy token can be transferred to ally with stable target metadata"`
ADD evidence/dicethrone-simple-start-e2e-test.md:16 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player grant tokens: Consecrate can grant four tokens to ally with stable target metadata"`
ADD evidence/dicethrone-simple-start-e2e-test.md:17 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player ability grant token: Vengeance II can grant Retribution to ally with stable target metadata"`
ADD evidence/dicethrone-simple-start-e2e-test.md:18 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player remove single status: remove-status-1 can remove enemy token with stable owner metadata"`
ADD evidence/dicethrone-simple-start-e2e-test.md:19 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player remove all status: remove-all-status blocks empty targets and clears enemy removable effects"`
ADD evidence/dicethrone-simple-start-e2e-test.md:20 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player 2v2 flow: response queue excludes teammate and defense chain reaches team victory UI"`
ADD evidence/dicethrone-simple-start-e2e-test.md:21 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `npm run test:e2e:ci -- e2e/dicethrone-simple-start.e2e.ts`
ADD evidence/dicethrone-simple-start-e2e-test.md:22 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD evidence/dicethrone-simple-start-e2e-test.md:23 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## 截图证据
ADD evidence/dicethrone-simple-start-e2e-test.md:24 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 2 人房 host 开局：
ADD evidence/dicethrone-simple-start-e2e-test.md:25 | OK 文档/记录/证据，对运行逻辑无直接影响 |   `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-match-Can-start-a-game-successfully\01-host-game-started.png`
ADD evidence/dicethrone-simple-start-e2e-test.md:26 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 2 人 `Transfer Status` 第二阶段目标选择：
ADD evidence/dicethrone-simple-start-e2e-test.md:27 | OK 文档/记录/证据，对运行逻辑无直接影响 |   `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-2-player-transfer-token-transfer-phase-keeps-locked-source-card-and-target-card\01-two-player-transfer-token-target-selection.png`
ADD evidence/dicethrone-simple-start-e2e-test.md:28 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 4 人房 host 开局：
ADD evidence/dicethrone-simple-start-e2e-test.md:29 | OK 文档/记录/证据，对运行逻辑无直接影响 |   `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-4-player-room-create-claim-seat-join-and-start-successfully\02-four-player-host-game-started.png`
ADD evidence/dicethrone-simple-start-e2e-test.md:30 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 4 人房站位移动：
ADD evidence/dicethrone-simple-start-e2e-test.md:31 | OK 文档/记录/证据，对运行逻辑无直接影响 |   `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-4-player-seating-panel-host-can-move-to-empty-slot-and-occupied-seat-is-rejected\03-four-player-seating-panel-moved.png`
ADD evidence/dicethrone-simple-start-e2e-test.md:32 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 4 人 2v2 目标面板：
ADD evidence/dicethrone-simple-start-e2e-test.md:33 | OK 文档/记录/证据，对运行逻辑无直接影响 |   `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-4-player-targeting-roll-auto-targets-and-choice-owners-stay-correct-in-2v2\04-four-player-target-choice-panel-host.png`
ADD evidence/dicethrone-simple-start-e2e-test.md:34 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 4 人 2v2 团队胜利：
ADD evidence/dicethrone-simple-start-e2e-test.md:35 | OK 文档/记录/证据，对运行逻辑无直接影响 |   `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-4-player-2v2-flow-response-queue-excludes-teammate-and-defense-chain-reaches-team-victory-UI\05-four-player-team-victory-ui.png`
ADD evidence/dicethrone-simple-start-e2e-test.md:36 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 4 人 `Transfer Status` 第二阶段目标选择：
ADD evidence/dicethrone-simple-start-e2e-test.md:37 | OK 文档/记录/证据，对运行逻辑无直接影响 |   `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-4-player-transfer-token-enemy-token-can-be-transferred-to-ally-with-stable-target-metadata\06-four-player-transfer-token-target-selection.png`
ADD evidence/dicethrone-simple-start-e2e-test.md:38 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 4 人 `Consecrate` 目标选择：
ADD evidence/dicethrone-simple-start-e2e-test.md:39 | OK 文档/记录/证据，对运行逻辑无直接影响 |   `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-4-player-grant-tokens-Consecrate-can-grant-four-tokens-to-ally-with-stable-target-metadata\07-four-player-consecrate-target-selection.png`
ADD evidence/dicethrone-simple-start-e2e-test.md:40 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 4 人 `Vengeance II` 目标选择：
ADD evidence/dicethrone-simple-start-e2e-test.md:41 | OK 文档/记录/证据，对运行逻辑无直接影响 |   `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-4-player-ability-grant-token-Vengeance-II-can-grant-Retribution-to-ally-with-stable-target-metadata\10-four-player-vengeance-2-target-selection.png`
ADD evidence/dicethrone-simple-start-e2e-test.md:42 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 4 人 `remove-status-1` 目标选择：
ADD evidence/dicethrone-simple-start-e2e-test.md:43 | OK 文档/记录/证据，对运行逻辑无直接影响 |   `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-4-player-remove-single-status-remove-status-1-can-remove-enemy-token-with-stable-owner-metadata\08-four-player-remove-single-status-selection.png`
ADD evidence/dicethrone-simple-start-e2e-test.md:44 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 4 人 `remove-all-status` 目标选择：
ADD evidence/dicethrone-simple-start-e2e-test.md:45 | OK 文档/记录/证据，对运行逻辑无直接影响 |   `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-4-player-remove-all-status-remove-all-status-blocks-empty-targets-and-clears-enemy-removable-effects\09-four-player-remove-all-status-selection.png`
ADD evidence/dicethrone-simple-start-e2e-test.md:46 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD evidence/dicethrone-simple-start-e2e-test.md:47 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## 截图分析
ADD evidence/dicethrone-simple-start-e2e-test.md:48 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `01` 证明 2 人联机主链路未被 4 人 / 2v2 改动破坏，host 已进入正式棋盘并可见掷骰区。
ADD evidence/dicethrone-simple-start-e2e-test.md:49 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `01-two-player-transfer-token-target-selection` 证明 2 人 `Transfer Status` 第二阶段也已同步吃到共享“四宫格/锁定来源卡”实现：`P2` 作为来源卡被锁定保留，`P1` 作为唯一真实目标卡显示为 `SELF`，不再是 4 人专用结构。
ADD evidence/dicethrone-simple-start-e2e-test.md:50 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `02` 证明 4 人房已成功进入正式棋盘，顶部并排出现 3 个他人窗，4 人布局生效。
ADD evidence/dicethrone-simple-start-e2e-test.md:51 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `03` 证明选角页右下 `2v2 Seating` 面板可用，移动后分队从默认的 `P1 / P3`、`P2 / P4` 更新为 `P2 / P1`、`P3 / P4`；同一用例也断言了点击已占位时会出现“禁止交换位置”的拒绝反馈。
ADD evidence/dicethrone-simple-start-e2e-test.md:52 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `04` 证明 `Targeting Roll` 的目标选择面板真实出现，面板内有 3 个纵向目标项；该用例同时断言了 `1/2` 自动锁左敌、`3/4` 自动锁右敌、`5` 由防守队选择、`6` 由进攻方选择，并检查了目标项的 `data-team-tone` 敌我标识。
ADD evidence/dicethrone-simple-start-e2e-test.md:53 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `05` 证明 2v2 主链路可落到团队胜负 UI：敌方队伍生命归零后 host 端显示 `Victory`；同一用例还在进入该画面前断言了防守方确认掷骰后响应队列只包含 `['0']`，不会把同队玩家 `2` 放进同队响应队列。
ADD evidence/dicethrone-simple-start-e2e-test.md:54 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `06` 证明 4 人 `Transfer Status` 在线双阶段交互已经闭环：第一阶段可选中敌方 `Crit` token，第二阶段现为统一四宫格，来源玩家 `P2` 保留在原位但以锁定禁用态显示，另外 `P1/P3/P4` 三张为真实可选目标；同一用例最终断言 token 从敌方 `P2` 成功转移到队友 `P3`，且队友页权威状态同步为 `crit=1`。
ADD evidence/dicethrone-simple-start-e2e-test.md:55 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `07` 证明 4 人 `Consecrate` 的任意玩家授 token 也已在线闭环：玩家选择面板可稳定区分 `self/ally/enemy` 四类候选；同一用例最终断言队友 `P3` 同时获得 `Protect/Retribution/Crit/Accuracy` 四个 token，且 host 与队友页权威状态一致。
ADD evidence/dicethrone-simple-start-e2e-test.md:56 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `10` 证明 4 人 `Vengeance II` 已从“规则层可通过”推进到真实在线闭环：该技能在 4 人 / 2v2 下不会误进 `targetingRoll`，而是停在玩家选择交互；同一用例最终断言队友 `P3` 获得 `Retribution`，证明“无单一敌方目标、无伤害、但仍需交互”的共享攻击流程已经兼容多人链路。
ADD evidence/dicethrone-simple-start-e2e-test.md:57 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `08` 证明 4 人 `remove-status-1` 已拿到在线证据：第一阶段仍按四宫格展示状态拥有者，host 选择敌方 `P2` 的 `Crit` 后，host 页与目标页最终都同步为 `crit=0`。
ADD evidence/dicethrone-simple-start-e2e-test.md:58 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `09` 证明 4 人 `remove-all-status` 已拿到在线证据：空目标会被禁用并显示 `无状态`，而敌方 `P2` 的可移除 `burn/crit` 会在确认后被全部清空；目标页需要等待权威态广播追平后再断言，不能只读 host 页。
ADD evidence/dicethrone-simple-start-e2e-test.md:59 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD evidence/dicethrone-simple-start-e2e-test.md:60 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## 自动化结果
ADD evidence/dicethrone-simple-start-e2e-test.md:61 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts`：`12 passed`
ADD evidence/dicethrone-simple-start-e2e-test.md:62 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player ability grant token: Vengeance II can grant Retribution to ally with stable target metadata"`：`1 passed`
ADD evidence/dicethrone-simple-start-e2e-test.md:63 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/rule-consistency.test.ts --configLoader native`：`31 passed`
ADD evidence/dicethrone-simple-start-e2e-test.md:64 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `$env:PW_USE_DEV_SERVERS='true'; $env:PW_START_SERVERS='false'; $env:PW_HAS_EXPLICIT_TARGET='true'; $env:NODE_OPTIONS='--max-old-space-size=4096'; $env:VITE_DEV_PORT='6174'; $env:GAME_SERVER_PORT='20000'; $env:API_SERVER_PORT='21000'; node .\node_modules\@playwright\test\cli.js test e2e/dicethrone-simple-start.e2e.ts`：`9 passed`
ADD evidence/dicethrone-simple-start-e2e-test.md:65 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 覆盖用例：
ADD evidence/dicethrone-simple-start-e2e-test.md:66 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `Online match: Can start a game successfully`
ADD evidence/dicethrone-simple-start-e2e-test.md:67 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `Online 2-player transfer token: transfer phase keeps locked source card and target card`
ADD evidence/dicethrone-simple-start-e2e-test.md:68 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `Online 4-player room: create claim-seat join and start successfully`
ADD evidence/dicethrone-simple-start-e2e-test.md:69 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `Online 4-player seating panel: host can move to empty slot and occupied seat is rejected`
ADD evidence/dicethrone-simple-start-e2e-test.md:70 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `Online 4-player board: top headers show ally and enemy tones correctly`
ADD evidence/dicethrone-simple-start-e2e-test.md:71 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `Online 4-player targeting roll: auto targets and choice owners stay correct in 2v2`
ADD evidence/dicethrone-simple-start-e2e-test.md:72 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `Online 4-player transfer token: enemy token can be transferred to ally with stable target metadata`
ADD evidence/dicethrone-simple-start-e2e-test.md:73 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `Online 4-player grant tokens: Consecrate can grant four tokens to ally with stable target metadata`
ADD evidence/dicethrone-simple-start-e2e-test.md:74 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `Online 4-player ability grant token: Vengeance II can grant Retribution to ally with stable target metadata`
ADD evidence/dicethrone-simple-start-e2e-test.md:75 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `Online 4-player remove single status: remove-status-1 can remove enemy token with stable owner metadata`
ADD evidence/dicethrone-simple-start-e2e-test.md:76 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `Online 4-player remove all status: remove-all-status blocks empty targets and clears enemy removable effects`
ADD evidence/dicethrone-simple-start-e2e-test.md:77 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `Online 4-player 2v2 flow: response queue excludes teammate and defense chain reaches team victory UI`
ADD evidence/dicethrone-simple-start-e2e-test.md:78 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD evidence/dicethrone-simple-start-e2e-test.md:79 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## 结论
ADD evidence/dicethrone-simple-start-e2e-test.md:80 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 本轮 E2E 已覆盖 OpenSpec `add-dicethrone-2v2-team-mode` 的在线主链路，也补上了 `update-dicethrone-4p-player-target-interactions` Batch 1 的代表性多人目标交互证据。
ADD evidence/dicethrone-simple-start-e2e-test.md:81 | OK 文档/记录/证据，对运行逻辑无直接影响 | - DiceThrone 4 人 / 2v2 当前已具备可验证的开房、入座、选角、站位、目标投骰、目标面板、顶部三窗、同队响应过滤、团队胜负 UI 闭环。
ADD evidence/dicethrone-simple-start-e2e-test.md:82 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `Transfer Status` 这条多人目标交互主链路已经升级为 4 人在线版本，能真实证明“敌方 token -> 队友”转移在权威状态与 UI 元信息两端都成立。
ADD evidence/dicethrone-simple-start-e2e-test.md:83 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 同一套共享转移 UI 也已拿到 2 人在线证据，不再只是从 4 人截图反推 2 人必然正确。
ADD evidence/dicethrone-simple-start-e2e-test.md:84 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `Consecrate` 也已经升级为 4 人在线版本，能真实证明“任意玩家多 token 授予”不再是 2 人专用路径。
ADD evidence/dicethrone-simple-start-e2e-test.md:85 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `Vengeance II` 也已经升级为 4 人在线版本，能真实证明“无单一敌方目标、无伤害、但仍需玩家交互”的授 token 技能不会在多人模式下被共享攻击流程吞掉。
ADD evidence/dicethrone-simple-start-e2e-test.md:86 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `remove-status-1` 与 `remove-all-status` 也已拿到 4 人在线证据，说明“任意玩家移除状态/移除全部可移除状态”不再只停留在规则层或组件层。
ADD evidence/dicethrone-simple-start-e2e-test.md:87 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `Transfer Status` 的第二阶段 UI 现已回到更符合语义的四宫格：来源玩家不是被隐藏或改写成摘要，而是作为锁定来源卡保留在 4 人布局中。
ADD findings.md:4 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 2026-03-26 新确认：Dice Throne 4人 / 2v2 的 `targetingRoll` 已不再在攻击发起时预写 `defenderId`，目标解析契约已经切换为“先进 `targetingRoll`，后写回 defender”。
ADD findings.md:5 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `FlowSystem` 的 `onPhaseEnter` 读取的是 phase 切换后的 `nextState`，但看不到 `onPhaseExit` 里刚产生且尚未 reduce 的领域事件；因此 2v2 在 `targetingRoll` 退出时如果才写回 defender，就会漏掉 `defensiveRoll` 的唯一防御技能自动选择。
ADD findings.md:6 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 最小正确修复不是回退到旧的“预写 defender”，而是在 `targetingRoll` exit 且 defender 已解析、攻击可防御时，提前补发唯一防御技能的 `ABILITY_ACTIVATED`，让后续 `ROLL_DICE` 校验直接成立。
ADD findings.md:7 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 旧的 4 人模式卡牌目标回归用例依赖了“只要进入战斗就已有 defenderId”的过时假设；在新契约下，测试必须先真实跑完 `targetingRoll -> defensiveRoll`，再断言 `executeCardCommand()` 的对手目标命中当前战斗对手。
ADD findings.md:208 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:209 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## 2026-03-25 Dice Throne 4 人/2v2 targetingRoll 收尾发现
ADD findings.md:210 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:211 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 根因不是 `customId` 或 payload 丢失，而是目标选择完成后缺少稳定的“已完成”标记，同时 `src/games/dicethrone/domain/flowHooks.ts` 里还残留了一段旧的 5/6 分支，会再次发出 `CHOICE_REQUESTED`。
ADD findings.md:212 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 仅把 `targetingSelectionPending` 改回 `false` 不足以阻止同一条命令链里的重复选择；需要一个能跨 reducer、system、effect 共享的幂等信号，因此新增 `pendingAttack.targetingSelectionResolved`。
ADD findings.md:213 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 4 人/2v2 模式下，`targetingRoll` 掷出 `5/6` 的正确行为是：玩家完成目标选择后应直接进入 `defensiveRoll`，不需要再手动 `ADVANCE_PHASE`。
ADD findings.md:214 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 直接检查 flow hook 事件链时，选择目标后应看到 `SYS_INTERACTION_RESOLVED`、`CHOICE_RESOLVED(select-target:1)`、`ATTACK_PRE_DEFENSE_RESOLVED`、`SYS_PHASE_CHANGED { from: 'targetingRoll', to: 'defensiveRoll' }`，说明推进链路本来就应该在响应命令内完成。
ADD findings.md:215 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `src/games/dicethrone/__tests__/flow.test.ts` 的断言口径已同步为“目标选择后自动推进”，避免后续又把手动 `ADVANCE_PHASE` 误当成正确行为。
ADD findings.md:216 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:217 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## 2026-03-25 Dice Throne 4人/2v2 targetingRoll 收尾发现（格式修正）
ADD findings.md:218 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:219 | OK 文档/记录/证据，对运行逻辑无直接影响 | 本次卡在 `targetingRoll` 的根因不是 `customId` 或 payload 丢失，而是目标选择完成后缺少稳定的“已完成”标记，同时 `src/games/dicethrone/domain/flowHooks.ts` 里还残留了一段旧的 5/6 分支，会再次发出 `CHOICE_REQUESTED`。
ADD findings.md:220 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:221 | OK 文档/记录/证据，对运行逻辑无直接影响 | 仅把 `targetingSelectionPending` 改回 `false` 不足以阻止同一条命令链里的重复选择，因此需要一个能跨 reducer、system、effect 共享的幂等信号；这也是新增 `pendingAttack.targetingSelectionResolved` 的原因。
ADD findings.md:222 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:223 | OK 文档/记录/证据，对运行逻辑无直接影响 | 4 人/2v2 模式下，`targetingRoll` 掷出 `5/6` 的正确行为是：玩家完成目标选择后直接进入 `defensiveRoll`，不需要再手动 `ADVANCE_PHASE`。`flow.test.ts` 的断言口径也已与此对齐。
ADD findings.md:224 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## 2026-03-25 Dice Throne 4人/2v2 验证补跑发现
ADD findings.md:225 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:226 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 当前受限终端可以完成 `tsc`，但无法在 Vitest 初始化阶段启动 worker / esbuild service；默认 forks worker 报 `spawn EPERM`，改成 `--pool threads --no-file-parallelism --maxWorkers 1` 后，仍在 `vite:esbuild` 处理 `vitest.setup.ts` 时触发同样的 `spawn EPERM`。
ADD findings.md:227 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 这说明当前 blocker 是终端对子进程 / esbuild service 的限制，不是这批 DiceThrone 4 人改动自身的编译错误；至少静态类型检查仍为绿色。
ADD findings.md:228 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `src/games/dicethrone/domain/flowHooks.ts` 的 `targetingRoll` 5/6 分支里残留了一个 `if (true) { ... } else { ... }` 的死代码块，本轮已清理，只保留真实执行路径。
ADD findings.md:229 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 当前 Git 命令也受 `dubious ownership` 影响，但可通过 `git -c safe.directory=D:/gongzuo/webgame/BoardGame-wt-dicethrone-4p-team-mode ...` 在单命令级绕过；由于 `C:/Users/zhuagenbao/.gitconfig` 无写权限，不能持久写入 `safe.directory`。
ADD findings.md:230 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:231 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## 2026-03-25 Dice Throne 4人/2v2 站位移动闭环发现
ADD findings.md:232 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:233 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 4 人 team mode 的站位调整不需要新增“空座位槽”状态；对当前 `seatingOrder` 采用“移除玩家后按目标下标重新插入”的模型，就能直接支撑“先点玩家，再点空位”的 UI 交互。
ADD findings.md:234 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 站位调整真正需要守住的边界是：`setup` 阶段、4 人 team mode、房主权限、开局后锁定、目标下标合法、禁止移动到原位。把这些统一放进领域校验后，前端只负责交互引导，不需要各处散落判断。
ADD findings.md:235 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `SEATING_MOVED` 事件直接携带完整 `seatingOrder` 比“只传 source/target 再让 reducer 重算”更稳，因为 reducer 可以据此一次性重建 `teamIdByPlayerId`，避免座位、队伍、左右对手三套派生关系短暂失步。
ADD findings.md:236 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 这轮最小 UI 接法不是重做整个选角页，而是在右下既有红框区加一个站位面板。这样既满足 spec，也降低了与并发改动冲突的概率。
ADD findings.md:237 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `PLAYER_UNREADY` 此前已经在 `Board.tsx` 被 UI 调用，但 `resolveMoves`、领域执行、事件与 reducer 没有全链路接通；这属于典型的“入口已存在、领域没闭环”的历史缺口，这轮已顺手补齐。
ADD findings.md:238 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Addendum（2026-03-25）：DiceThrone 四人房服务端 / E2E 闭环发现
ADD findings.md:239 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:240 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 当前真正的阻塞不是业务逻辑，而是 `e2e/helpers/dicethrone.ts` 曾被坏正则和不可达旧代码污染，导致 Playwright 在解析阶段直接报 `Unterminated regular expression`。
ADD findings.md:241 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `initContext()` 已统一注入英文 locale，所以 `waitForCharacterSelection()` 只匹配 `Select Your Hero` 即可稳定工作。
ADD findings.md:242 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 4 人联机 setup 采用 `create -> claim-seat(host) -> join(guest1/2/3)` 即可覆盖本次服务端关键链路；不需要为每个 guest 再走一次 `claim-seat` 才能验证 4 座 metadata 与 `playing` 状态流转。
ADD findings.md:243 | OK 文档/记录/证据，对运行逻辑无直接影响 | - E2E 断言确认：`GET /games/dicethrone/:matchId` 在 4 个 seat 全部占用后返回 `players=[0,1,2,3]`、每个 seat 都带 `name`、`status === 'playing'`。
ADD findings.md:244 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 实际截图确认 4 人房顶部存在 3 个他人窗口，且已进入主阶段并显示投骰区，说明不是“接口绿了但 UI 还卡在准备页”。
ADD findings.md:245 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 新发现的服务端缺口是：`/games/:name/create` 原本只按 `minPlayers/maxPlayers` 校验，DiceThrone 会错误放行 3 人房。现在已改为优先按 manifest `playerOptions` 白名单校验，`[2,4]` 不再接受 `3`。
ADD findings.md:246 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 证据文档已新增：`evidence/dicethrone-simple-start-e2e-test.md`。
ADD findings.md:247 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:248 | OK 文档/记录/证据，对运行逻辑无直接影响 | ---
ADD findings.md:249 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:250 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## 2026-03-26 Dice Throne 4人/2v2 回合顺序与 OpenSpec 审计发现
ADD findings.md:251 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:252 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `getPlayerOrder/getNextPlayerId` 之前仍按 `seatingOrder` 顺时针轮转，这与 OpenSpec 要求的“起始玩家所在队连走两手，再切到敌队两手”不一致；`flow.test.ts` 里原先期待 `0→1→2→3` 其实把旧错误行为固化成了测试。
ADD findings.md:253 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 2v2 回合顺序和 4 人 UI 排布不能共用同一个顺序函数。`Board.tsx` 顶部三窗如果继续依赖 `getPlayerOrder`，修正 turn order 后会把观察顺序也一起改掉，因此要把 UI 继续绑定到 `getSeatingOrder`。
ADD findings.md:254 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 现有实现与测试已足够支撑这些 OpenSpec 项为已完成：`1.2`（队伍状态模型）、`1.6/1.7`（Targeting Roll 与目标选择）、`1.9`（共享体力伤害/治疗/上限）、`1.10`（同队响应过滤与队友干预边界）、`1.11`（队伍胜负判定）、`1.12`（`playerView` 与 4 人 Board 映射）、`1.18`（规则/边界/服务端/E2E 覆盖）。
ADD findings.md:255 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 本轮补上 `startingPlayerId='1'` 的 turn-order 规则测试后，可以确认 2v2 顺序不是写死在默认 host=0 场景上。
ADD findings.md:256 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 4 人选角页的站位面板已可以直接被在线 E2E 稳定选择：使用 `2v2 Seating` 标题 + `Seat n` / `Empty` / `Team A/B` 文案即可覆盖“默认站位展示 → 点击空位移动 → 点击已占位拒绝”这一整条真实 UI 链路，不必额外改组件结构或新增测试专用入口。
ADD findings.md:257 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:258 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## 2026-03-26 DiceThrone 4 人 / 2v2 E2E 收口发现
ADD findings.md:259 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:260 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 旧的“进攻方确认掷骰后只应出现敌方响应者”假设不稳定，根因不是在线注入接口，而是 `CONFIRM_ROLL` 在 `offensiveRoll` 下会使用 `getContextualOpponentId()` 选择当前语境对手；在 4 人座位顺序 `0,1,2,3` 下，玩家 `0` 的默认语境对手优先落到左侧敌人 `3`，不是 `1`。
ADD findings.md:261 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 因此要稳定验证“队友不响应队友”，应走“防守方确认掷骰后”的链路：当 `pendingAttack.attackerId='0'`、`defenderId='3'` 时，防守方 `3` 确认掷骰后，语境对手稳定是 `0`，此时同队玩家 `2` 会被正确排除在响应队列外。
ADD findings.md:262 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 在线 `/test/get-state` 返回的是权威状态，但响应窗口是否打开仍严格依赖真实前置条件；仅补 `rollCount` 和手牌不够，还必须补齐可操作骰子，否则 `requireDiceExists` 会把响应卡全部过滤掉。
ADD findings.md:263 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 目标面板证据截图必须在面板可见时截取；若等点击后再截，虽然断言仍能通过，但截图会落在后续防守阶段，不能直接作为 `2.7` 的可视证据。
ADD findings.md:264 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 现有 `e2e/dicethrone-simple-start.e2e.ts` 已足够覆盖 OpenSpec `2.5-2.9`，不需要再新建 E2E 文件；关键是把状态构造函数改成“显式稳定场景”，避免依赖在线对局里的动态抽牌结果。
ADD findings.md:265 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:266 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## 2026-03-26 DiceThrone 4 人玩家目标交互专项审计发现
ADD findings.md:267 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:268 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 这次收口完成的是 2v2 核心规则闭环，不等于“所有面向玩家目标的技能/卡牌都已做 4 人审计”。多人能力兼容需要独立切一轮。
ADD findings.md:269 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `customActions/common.ts` 里的“移除 1 个状态 / 移除所有状态 / 转移状态”与 `customActions/paladin.ts` 里的 `Vengeance II`、`Consecrate`，都已经把候选目标扩成 `Object.keys(state.players)`；说明领域入口具备 4 人潜力，但这不代表验证和 UI 已完整跟上。
ADD findings.md:270 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `InteractionOverlay.tsx` 当前在 4 人玩家选择卡片里仍以 `self/opponent` 为主语义，组件测试也主要按 `['0','1']` 写断言；在 4 人下，这种口径不足以证明多个敌/友候选都能被稳定区分与正确点击。
ADD findings.md:271 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `validateGrantTokens` 与 `validateTransferStatus` 目前仅校验“存在 pendingInteraction 且 playerId 匹配”，没有进一步核对目标玩家是否在 `targetPlayerIds` 中、转移目标是否与来源玩家不同，属于共享验证层缺口。
ADD findings.md:272 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `TRANSFER_STATUS` 执行层本身已经同时支持状态与 token 的转移，并且会拦截 `removable: false` 的 token；因此第一批重点不是重写 execute，而是把验证、交互与 4 人 E2E 补齐到和执行层能力一致。
ADD findings.md:273 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 现有 `dicethrone-paladin-vengeance-select-player.e2e.ts` 仍是 2 人版本，只证明了“自己/对手”二选一，不足以作为 4 人“任意玩家授 token”的证据。
ADD findings.md:274 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:275 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## 2026-03-26 DiceThrone 4 人玩家目标交互 Batch 1 收口发现
ADD findings.md:276 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:277 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `TRANSFER_STATUS` 的真实在线 blocker 不在 execute，而在验证层与 UI 双阶段建模错位：`Board.tsx` 只在本地把交互从 `selectStatus` 推演成 `selectTargetStatus`，服务端权威态仍停在 `selectStatus + transferConfig:{}`；若 `validateTransferStatus` 只接受 `selectTargetStatus`，在线点击确认后会被验证层拒绝。
ADD findings.md:278 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 正确做法不是放松成“任何 transfer 命令都放行”，而是兼容两种合法权威态：
ADD findings.md:279 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `selectTargetStatus`：继续严格校验 `sourcePlayerId/statusId` 与交互上下文完全匹配。
ADD findings.md:280 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `selectStatus + transferConfig:{}`：允许从命令 payload 读取 `fromPlayerId/statusId`，但仍必须校验来源玩家在候选集内、来源上真实存在该状态或 token、目标在候选集内且不等于来源。
ADD findings.md:281 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 4 人状态 / 可移除 token 交互要想稳定 E2E，不能只给玩家卡片加 test id；第一阶段的可点击状态徽章也必须有稳定 selector。为 `SelectableEffectsContainer` 增加 `getItemTestId()` 后，`InteractionOverlay` 才能输出 `dt-status-effect-<pid>-<effectId>` 这类稳定入口。
ADD findings.md:282 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `Transfer Status` 是 Batch 1 最有代表性的在线链路，因为它同时覆盖“来源玩家选择、第二阶段目标候选、来源玩家排除、友敌标识、权威状态广播”五个风险点；单独跑通这一条，比继续扩 2 人 `Vengeance` 旧 E2E 更能说明 4 人兼容已开始收口。
ADD findings.md:283 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:284 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## 2026-03-26 DiceThrone 4 人授 token 在线证据补强发现
ADD findings.md:285 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:286 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 只靠 `GRANT_TOKENS` 的规则层测试还不足以证明“任意玩家授 token”真的完成 4 人兼容；因为最容易漏的是 `tokenGrantConfigs` 多 token 路径，以及在线玩家选择面板是否还能稳定区分多个敌/友候选。
ADD findings.md:287 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `Consecrate` 比 `Vengeance II` 更适合作为第二条在线证据：它一次授予 `Protect/Retribution/Crit/Accuracy` 四个 token，能同时覆盖 `tokenGrantConfigs`、`selectPlayer`、多玩家候选渲染和权威状态同步。
ADD findings.md:288 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 实测表明 `Board.tsx -> engineMoves.grantTokens()` 这一段在 4 人下已经能把 ally 目标稳定带到服务端，并由 `execute.ts` 正确生成四个 `TOKEN_GRANTED` 事件；这说明当前 `selectPlayer + tokenGrantConfigs` 主链路已经具备在线可验证性。
ADD findings.md:289 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:290 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## 2026-03-26 DiceThrone 面向多人能力审计边界更新
ADD findings.md:291 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:292 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 按当前代码检索，真正属于“面向玩家目标”的多人高风险入口主要集中在：
ADD findings.md:293 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `customActions/paladin.ts`：`paladin-vengeance-select-player`、`paladin-consecrate`
ADD findings.md:294 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `customActions/common.ts`：`remove-status-1`、`remove-all-status`、`transfer-status`
ADD findings.md:295 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 其中更复杂、风险更高的两类已经拿到 4 人在线证据：
ADD findings.md:296 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `transfer-status`：双阶段状态 / token 转移
ADD findings.md:297 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `paladin-consecrate`：任意玩家多 token 授予
ADD findings.md:298 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `remove-status-1` / `remove-all-status` 仍属于玩家目标交互，但复杂度低于已收口的 `Transfer Status`；按当前决策，不再优先补它们的在线 E2E，把时间留给后续更复杂或更高风险的多人交互。
ADD findings.md:299 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:300 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## 2026-03-26 DiceThrone 4 人目标交互 UI 精简发现
ADD findings.md:301 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:302 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 用户指出的“为什么选中还额外多一个框、为什么四人会像有六个框”是对的，根因在 `InteractionOverlay.tsx` 的 `selectTargetStatus` 第二阶段：它同时渲染了第一阶段的来源状态卡和第二阶段的目标玩家卡，视觉上把“来源展示”和“目标选择”叠在了一个 modal 里。
ADD findings.md:303 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 正确收口不是再给卡片加更多提示，而是减少并行信息：第二阶段只保留一个紧凑的来源摘要块，再显示真实可选目标卡片。来源玩家继续整排保留会让 4 人场景从“3 个目标”膨胀成“1 排来源 + 1 排目标”的 6 框感知。
ADD findings.md:304 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 已选目标的外挂勾选块也属于重复信号。卡片自身边框高亮已经足够表达“当前选中”，再在卡片外侧加一个独立小框只会制造“多了一层框”的噪音。
ADD findings.md:305 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 在线截图 `06-four-player-transfer-token-target-selection.png` 复核后确认，新版第二阶段已收口为“1 个来源摘要 + 3 张候选目标卡”，符合用户对 4 人目标选择密度和层级的直觉预期。
ADD findings.md:306 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:307 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## 2026-03-26 DiceThrone 4 人目标交互四宫格修正发现
ADD findings.md:308 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:309 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 用户继续指出“既然本质是先选一个再选另一个，就不该把来源做成异类摘要块，而应保持四宫格”是对的；上一版把来源卡降成摘要，虽然去掉了 6 框，但也把原本统一的玩家选择语义拆坏了。
ADD findings.md:310 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 更正确的结构是：第二阶段仍展示同一组 4 个玩家卡，其中来源玩家保留在原位，但转为 `locked/disabled` 态；其余 3 张仍是可点击目标。这样用户看到的仍是“四人里先选一个，再选另一个”，而不是“先选一个，再读一段说明，再选另一个”。
ADD findings.md:311 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 因此 `selectTargetStatus` 第二阶段现已改为四宫格：来源玩家卡使用 `dt-transfer-source-locked-<pid>`，保留座位/敌我/被转移 token 信息，但不可点击；另外 3 张继续使用 `dt-transfer-target-<pid>`。
ADD findings.md:312 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 这次在线 E2E 包装器整份 `dicethrone-simple-start.e2e.ts` 都走成了 `skip`，说明当前没拿到新的在线证据；所以这轮只能确认组件层和类型层已经改对，不能把它表述成“新截图已复核完成”。
ADD findings.md:313 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:314 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## 2026-03-27 DiceThrone 联机 E2E 跳过根因修复
ADD findings.md:315 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:316 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 导致 `setupDTOnlineMatchWithPlayers()` 返回 `null` 的真实原因不是“游戏服务器不可用”，而是浏览器偶发在 `page.goto(/play/dicethrone/match/...)` 阶段抛出 `net::ERR_INSUFFICIENT_RESOURCES`；因为 helper 直接吞掉异常并返回 `null`，测试表面上才会退化成 `skip`。
ADD findings.md:317 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 手工 API 探针已确认 `/games/dicethrone/create`、`/claim-seat`、`/join` 都能正常返回；也就是说联机链路的服务端并没有坏，问题集中在前端 match 页导航的瞬时资源错误。
ADD findings.md:318 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 最小正确修复不是改业务断言，也不是把 `skip` 改成硬失败，而是在 `e2e/helpers/dicethrone.ts` 为联机 match 页导航增加小范围重试，专门兜住 `ERR_INSUFFICIENT_RESOURCES`、`ERR_ABORTED`、`NS_BINDING_ABORTED` 这类瞬时错误。
ADD findings.md:319 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 修复后，4 人 `Transfer Status` 单用例重新恢复为 `1 passed`，整份 `e2e/dicethrone-simple-start.e2e.ts` 也恢复为 `8 passed`；同时新截图确认第二阶段确实是“四宫格 + 锁定来源卡”，不是只靠测试选择器蒙混过关。
ADD findings.md:320 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:321 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## 2026-03-27 DiceThrone 2 人 Transfer Status 进度确认
ADD findings.md:322 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:323 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 2 人转移没有被漏掉；因为 `selectTargetStatus` 第二阶段现在是共享组件逻辑，2 人也会显示来源锁定卡 `dt-transfer-source-locked-*` 和真实目标卡 `dt-transfer-target-*`。
ADD findings.md:324 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 新增到 `e2e/dicethrone-simple-start.e2e.ts` 的 2 人在线用例，已经把 UI 结构断言和 token 转移结果都写进去了；当前缺的不是测试设计，而是把它从 `skip` 推到真实执行。
ADD findings.md:325 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 直接 `tsx + Playwright` 探针已证明 `setupDTOnlineMatch()` 在同一组端口服务下可以成功返回 `OK <matchId>`；因此现有 `skip` 更像是项目 Playwright 运行链路里的目标/环境口径问题，而不是 2 人联机 helper 或 `Transfer Status` 业务本身损坏。
ADD findings.md:326 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:327 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## 2026-03-27 DiceThrone 2 人联机 setup 真正 blocker 收口
ADD findings.md:328 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:329 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 2 人联机 helper 的第一个真 blocker 不是选角组件改坏，而是时序错位：host 在只有自己占座时就提前等待角色选择页，但真实页面此时只会显示 `Waiting for opponent...`。正确顺序必须是“所有玩家进入 match 页后，再统一等待选角 UI”。
ADD findings.md:330 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 第二个真 blocker 不是 `/create` / `/join` API，而是“同一条测试链路分叉到了两个游戏服端口”：
ADD findings.md:331 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - API helper 显式打到了 `http://127.0.0.1:20000`
ADD findings.md:332 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 浏览器页里的 `__FORCE_GAME_SERVER_URL__` 却仍被 `initContext()` 按旧环境注成了 `18000`
ADD findings.md:333 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `/test/get-state` / `/test/inject-state` 也继续跟着旧默认口径打到 `18000`
ADD findings.md:334 | OK 文档/记录/证据，对运行逻辑无直接影响 |   这会表现为：房间能创建、凭证能拿到，但 match 页一直 `CONNECTING / Loading match resources...`，或者状态注入直接 `ECONNREFUSED 127.0.0.1:18000`。
ADD findings.md:335 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 因此最小正确修复不是继续堆选择器等待，也不是把用例改回本地 `/test` 场景，而是把同一个 `gameServerBaseURL` override 贯穿到：
ADD findings.md:336 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `initContext()` 注入的 `__FORCE_GAME_SERVER_URL__`
ADD findings.md:337 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - DiceThrone 在线 helper 的上下文创建
ADD findings.md:338 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `/test/*` 状态注入 helper
ADD findings.md:339 | OK 文档/记录/证据，对运行逻辑无直接影响 |   只有这样浏览器 WebSocket、API 调房、状态注入三条链路才会重新指向同一台游戏服。
ADD findings.md:340 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 2 人 `Transfer Status` 在线用例自身也有一个测试设计缺口：它一开始直接断言第二阶段 `dt-transfer-source-locked-1`，但真实流程必须先在第一阶段点击 `dt-status-effect-1-crit` 才会进入第二阶段。这不是业务 bug，而是测试漏走了一步用户操作。
ADD findings.md:341 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 在显式 `6174/20000/21000` 环境下，`dicethrone-simple-start.e2e.ts` 已拿到 `9 passed` 的有效在线结果；但连续多次直接 CLI 复跑时仍偶发整份 `skip`。当前判断这是 Playwright runner / 本机环境的瞬时不稳定，不是本轮修复的代码回退。
ADD findings.md:342 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:343 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## 2026-03-27 DiceThrone remove-status 在线证据与默认脚本回归
ADD findings.md:344 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:345 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 当前默认 `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts` 口径已经能直接拿到 `11 passed`，不再需要手工先写显式 `6174/20000/21000` 环境变量才能证明多人目标交互成立。
ADD findings.md:346 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `remove-status-1` / `remove-all-status` 真正容易误判的点不在 host 页执行，而在目标页权威态同步：host 页往往会先看到 `crit/burn` 被清空，但目标页广播会慢半拍。如果只在 host 页断言，很容易把测试写成“假绿”。
ADD findings.md:347 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 对这两类移除交互，最小正确修复不是改领域逻辑，而是在 E2E 中显式等待目标页 `__BG_TEST_HARNESS__` 状态追平后再断言。这样既不放宽业务约束，也避免把多页广播时序误报成规则 bug。
ADD findings.md:348 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 到这一步，玩家目标交互第一批三类高风险链路都已拿到 4 人在线证据：
ADD findings.md:349 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `transfer-status`
ADD findings.md:350 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `paladin-consecrate`
ADD findings.md:351 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `remove-status-1` / `remove-all-status`
ADD findings.md:352 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:353 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## 2026-03-27 DiceThrone Vengeance II 与 Batch 1 spec 边界校正
ADD findings.md:354 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:355 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 用户指出“spec 不止这个”是对的。当前 `proposal/design/tasks` 已按 Batch 1 写清范围，但原 `spec.md` 仍只有一个总括 requirement，容易被误读成“所有 4 人玩家目标交互都已审计完成”。
ADD findings.md:356 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 更准确的 spec 结构应把 Batch 1 拆成明确 requirement：`任意玩家授 token`、`任意玩家移除状态`、`状态/可移除 token 转移`、`无单一敌方目标的无伤害技能流程兼容`。这样才能把“本轮已收口哪些共享根因”和“尚未纳入的后续批次”分开。
ADD findings.md:357 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `Vengeance II` 在 4 人 / 2v2 下最初不弹玩家选择，根因不是 E2E 断言或 abilityId 写错，而是共享攻击流程不支持“无默认 defender、无伤害、但仍会触发玩家交互与 postDamage”的技能。
ADD findings.md:358 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 这条共享层缺口具体表现为：
ADD findings.md:359 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `preDefense` 在 `defenderId` 为空时被错误短路；
ADD findings.md:360 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 4 人模式下无脑进入 `targetingRoll`；
ADD findings.md:361 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `INTERACTION_REQUESTED` 没被当成阻塞事件，导致 phase 提前推进；
ADD findings.md:362 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 无 `defenderId` 的攻击没能完整跑完 `withDamage/postDamage`，使后续资源结果丢失。
ADD findings.md:363 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 正确修复不是给 `Vengeance II` 单独开特判，而是把共享攻击流程收紧到“按攻击真实语义推进”：
ADD findings.md:364 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 无单一敌方目标的无伤害技能不再误进 `targetingRoll`；
ADD findings.md:365 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `INTERACTION_REQUESTED` 会阻塞流程，等待玩家完成交互；
ADD findings.md:366 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 无 `defenderId` 的攻击也能完成 `postDamage` 结算。
ADD findings.md:367 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `rule-consistency.test.ts` 新增/调整的回归已经覆盖这类共享根因，而不是只锁一条 UI 路径：
ADD findings.md:368 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 4 人模式下有真实单一敌方目标的攻击仍进入 `targetingRoll`；
ADD findings.md:369 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 无单一敌方目标的无伤害技能不会误进 `targetingRoll`；
ADD findings.md:370 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 无默认 `defender` 的 4 人无伤害技能仍会发出 `INTERACTION_REQUESTED` 并继续后续结算。
ADD findings.md:371 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `Vengeance II` 现在已经拿到真实 4 人在线证据，说明 Batch 1 中“任意玩家授 token”这一类不再只靠 `Consecrate` 代表；同时也证明共享攻击流程已不再把这类技能吞掉。
ADD findings.md:372 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 到当前版本，Batch 1 已拿到 4 人在线证据的代表性入口是：
ADD findings.md:373 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `transfer-status`
ADD findings.md:374 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `paladin-consecrate`
ADD findings.md:375 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `paladin-vengeance-select-player` / `Vengeance II`
ADD findings.md:376 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `remove-status-1`
ADD findings.md:377 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - `remove-all-status`
ADD findings.md:378 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 这轮还确认了一个测试层陷阱：E2E 文件如果直接从 `domain/rules.ts` 调 `getAvailableAbilityIds()` 做 Node 侧调试，而没有显式调用 `registerDiceThroneConditions()`，会因为 `diceSet/allSymbolsPresent` 未注册而误报“技能不可用”。浏览器端通过 `domain/index.ts` 会自动注册条件，但测试进程不会。
ADD findings.md:379 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:380 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## 2026-03-28 DiceThrone worktree 依赖树残缺导致的验证假失败
ADD findings.md:381 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:382 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 本轮最后的真实 blocker 不是业务逻辑，而是 `BoardGame-wt-dicethrone-4p-team-mode/node_modules` 里多个关键包只剩局部目录，缺了包根入口文件；直接表现为 `tsc.js`、`vitest.mjs`、`dotenv/config`、`playwright/cli.js` 等路径解析失败。
ADD findings.md:383 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 这种失败会把“验证命令起不来”伪装成“代码又坏了”，但根因与 DiceThrone 4 人玩家目标交互无关；修复前应先区分是测试环境损坏，还是业务回归。
ADD findings.md:384 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 在当前 worktree 里，最直接可行的恢复方式是重新执行一次 `npm install`，把锁文件对应的缺失入口补回；补完后，`openspec validate`、`rule-consistency.test.ts`、`dicethrone-simple-start.e2e.ts` 已分别恢复为 `valid`、`31 passed`、`12 passed`。
ADD findings.md:385 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:386 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## 2026-03-28 DiceThrone Consecrate 多页同步等待补正
ADD findings.md:387 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:388 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `Consecrate` 单用例本身是绿的，整文件串跑时真正失败的不是授 token 逻辑，而是 ally 页权威态比 host 页慢半拍，导致测试在 `readHarnessState(allyPage)` 时抢跑。
ADD findings.md:389 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 这类失败和前面的 `remove-status-1` / `remove-all-status` 属于同一类多页广播时序问题；最小正确修复仍然是 E2E 补显式等待，而不是去动领域逻辑。
ADD findings.md:390 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 现已在 `Consecrate` 用例中补上 `allyPage.waitForFunction()`，要求队友页的 `Protect / Retribution / Crit / Accuracy` 四个 token 都追平后再读 harness state。
ADD findings.md:391 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 补完后，`dicethrone-simple-start.e2e.ts` 默认整文件回归重新稳定为 `12 passed`，因此此前旧专项收敛阶段记录的 `11 passed, 1 skipped` 已被新的有效结果覆盖。
ADD findings.md:392 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:393 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## 2026-03-28 DiceThrone 旧专项 E2E 收敛审计
ADD findings.md:394 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD findings.md:395 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `dicethrone-status-interaction-complete.e2e.ts` 仍有独立价值，因为它对应的是共享交互层 UI 契约：`selectStatus`、`selectPlayer`、`selectTargetStatus` 的按钮可用性、禁用态和第二阶段卡片结构。这些断言不应继续散落在已偏业务化的旧文件里。
ADD findings.md:396 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `dicethrone-status-removal.e2e.ts` 已经不是“待修一下就能用”的状态，而是同时依赖旧页面结构、旧英雄入口、旧 `hero-card/status-area/target-selector` 选择器。继续修它，本质上是在重写一份与 `simple-start` 高度重复的文件。
ADD findings.md:397 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `dicethrone-status-interaction-cancel.e2e.ts` 与 `status-interaction-complete` 在测试主题上高度重复，只是旧版把“取消按钮”拆成了单独文件；保留它只会制造重复维护点。
ADD findings.md:398 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `dicethrone-paladin-vengeance-select-player.e2e.ts` 已经被当前 4 人 `Vengeance II` 在线证据实质取代，而且它本身还保留 2 人 self/opponent 旧语义、重复函数定义与过时的 `+4 CP` 绑定断言，不适合作为现役专项继续存在。
ADD findings.md:399 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 因此这轮最正确的收敛方案是：
ADD findings.md:400 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 保留并现代化 `dicethrone-status-interaction-complete.e2e.ts`
ADD findings.md:401 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 退役 `dicethrone-status-removal.e2e.ts`
ADD findings.md:402 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 退役 `dicethrone-status-interaction-cancel.e2e.ts`
ADD findings.md:403 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 退役 `dicethrone-paladin-vengeance-select-player.e2e.ts`
ADD findings.md:404 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 同步清理 `playwright.config.ts` 里的对应 legacy ignore
ADD findings.md:405 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `Board.tsx` 当前并不会直接读取裸 `InteractionDescriptor`；状态交互弹窗的真实入口是 `sys.interaction.current.kind === 'dt:card-interaction'`，再从 `data` 解包出 `InteractionDescriptor`。因此任何 harness 级 E2E 若直接往 `current` 塞裸对象，页面上不会出现交互弹窗。
ADD findings.md:406 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 这轮 `simple-start` 的异常不是收敛改动带来的功能回退，而是 runner / 服务启动层噪音：
ADD findings.md:407 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 一次整文件回归结果为 `11 passed, 1 skipped`，唯一跳过的是 `targeting roll` 用例；
ADD findings.md:408 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 单独复跑同一 targeting roll 用例也直接走到 `setupDTOnlineMatchWithPlayers()` 返回 `null`；
ADD findings.md:409 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 调试日志已记录 `game_server_unavailable`、`apiRequestContext.post: connect ECONNREFUSED 127.0.0.1:20000`，另一次整文件复跑则在 global setup 阶段出现 Vite 前端进程异常退出。
ADD findings.md:410 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 因此本轮可以下的代码结论是：旧专项 E2E 收敛本身已完成，且新 `status-interaction-complete` 套件稳定可跑；`simple-start` 的 residual risk 仍然是既有 E2E 基础设施抖动，不是本轮删除/重写旧专项文件造成的行为变化。
DEL openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:2 | 注意 代码变更需核对 | - [ ] 1.1 扩展 DiceThrone 房间配置：`playerOptions` 支持 `[2,4]`，引擎配置 `minPlayers/maxPlayers` 支持 4 人。
DEL openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:3 | 注意 代码变更需核对 | - [ ] 1.2 设计并落地团队状态模型（队伍归属、共享体力、上限策略），确保 1v1 与 2v2 可共存。
DEL openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:4 | 注意 代码变更需核对 | - [ ] 1.3 新增 2v2 站位配置输入：默认站位采用官方座位顺序，并允许开局前“点击空位移动位置”。
DEL openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:5 | 注意 代码变更需核对 | - [ ] 1.4 新增站位合法性校验：仅允许移动到空位，不允许交换位；开始后锁定站位。
DEL openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:6 | 注意 代码变更需核对 | - [ ] 1.5 改造回合顺序函数（`getPlayerOrder/getNextPlayerId`）为 2v2 队伍交替序列，并处理不同起始玩家轮转。
DEL openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:7 | 注意 代码变更需核对 | - [ ] 1.6 新增 2v2 目标掷骰阶段（Targeting Roll）：按 d6 规则确定防御方，接入阶段推进与命令校验。
DEL openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:8 | 注意 代码变更需核对 | - [ ] 1.7 补齐 2v2 目标选择全部新交互流程：1/2 自动锁定左侧对手、3/4 自动锁定右侧对手、5 由被攻击方队伍选择、6 由进攻方选择。
DEL openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:9 | 注意 代码变更需核对 | - [ ] 1.8 改造攻击发起与卡牌执行中的目标选择逻辑，移除“唯一对手推断”路径。
DEL openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:10 | 注意 代码变更需核对 | - [ ] 1.9 改造伤害/治疗与战斗收尾逻辑，使共享体力在攻击、附属伤害、治疗、上限钳制下行为一致。
DEL openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:11 | 注意 代码变更需核对 | - [ ] 1.10 改造响应队列与可打牌窗口，满足 2v2 干预规则（队友可改骰，队友不可直接替队友承受/减免输出伤害，且队友不响应队友，除非牌面明确允许）。
DEL openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:12 | 注意 代码变更需核对 | - [ ] 1.11 改造 `isGameOver` 为队伍判定（队伍 HP<=0 失败、双方同时归零平局）。
DEL openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:13 | 注意 代码变更需核对 | - [ ] 1.12 改造 `playerView` 与前端 Board 玩家映射：队友手牌可见、对手隐藏，4 人布局与目标展示正确。
DEL openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:14 | 注意 代码变更需核对 | - [ ] 1.13 在选角界面右下红框区域接入“目标交互/站位面板”（默认值、点击空位移动、非法操作反馈、锁定态）。
DEL openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:15 | 注意 代码变更需核对 | - [ ] 1.14 实现顶部并排 3 个他人悬浮窗（2 敌 + 1 友），并通过边缘高亮明确区分敌我。
DEL openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:16 | 注意 代码变更需核对 | - [ ] 1.15 实现“攻击阶段结束后的目标选择面板”：展示 3 个可选目标，样式复用悬浮窗并纵向排列，点击即确认目标。
DEL openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:17 | 注意 代码变更需核对 | - [ ] 1.16 将目标选择结果与 Targeting Roll 分支打通：目标确认后写入 defenderId 并回显。
DEL openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:18 | 注意 代码变更需核对 | - [ ] 1.17 改造服务端创建与入座：`/games/:name/create` 按游戏配置校验人数；4 座位元数据、claim-seat 状态流转正确。
DEL openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:19 | 注意 代码变更需核对 | - [ ] 1.18 补充并更新测试：规则函数、站位移动校验、目标选择交互分支、攻击/结算、胜负判定、视图过滤、服务端创建与入座流程（2 人与 4 人均覆盖）。
ADD openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:2 | 注意 代码变更需核对 | - [x] 1.1 扩展 DiceThrone 房间配置：`playerOptions` 支持 `[2,4]`，引擎配置 `minPlayers/maxPlayers` 支持 4 人。
ADD openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:3 | 注意 代码变更需核对 | - [x] 1.2 设计并落地图队状态模型（队伍归属、共享体力、上限策略），确保 1v1 与 2v2 可共存。
ADD openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:4 | 注意 代码变更需核对 | - [x] 1.3 新增 2v2 站位配置输入：默认站位采用官方座位顺序，并允许开局前“点击空位移动位置”。
ADD openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:5 | 注意 代码变更需核对 | - [x] 1.4 新增站位合法性校验：仅允许移动到空位，不允许交换位；开始后锁定站位。
ADD openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:6 | 注意 代码变更需核对 | - [x] 1.5 改造回合顺序函数（`getPlayerOrder/getNextPlayerId`）为 2v2 队伍交替序列，并处理不同起始玩家轮转。
ADD openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:7 | 注意 代码变更需核对 | - [x] 1.6 新增 2v2 目标投掷阶段（Targeting Roll）：按 d6 规则确定防御方，接入阶段推进与命令校验。
ADD openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:8 | 注意 代码变更需核对 | - [x] 1.7 补齐 2v2 目标选择全部新交流程：1/2 自动锁定左侧对手，3/4 自动锁定右侧对手，5 由被攻击方队伍选择，6 由进攻方选择。
ADD openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:9 | 注意 代码变更需核对 | - [x] 1.8 改造攻击发起与卡牌执行中的目标选择逻辑，移除“唯一对手推断”路径。
ADD openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:10 | 注意 代码变更需核对 | - [x] 1.9 改造伤害、治疗与战斗收尾逻辑，使共享体力在攻击、附属伤害、治疗、上限钳制下行为一致。
ADD openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:11 | 注意 代码变更需核对 | - [x] 1.10 改造响应队列与可打牌窗口，满足 2v2 干预规则（队友可改骰，队友不可直接替队友承受/减免输出伤害，且队友不响应队友，除非牌面明确允许）。
ADD openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:12 | 注意 代码变更需核对 | - [x] 1.11 改造 `isGameOver` 为队伍判定（队伍 HP<=0 失败、双方同时归零平局）。
ADD openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:13 | 注意 代码变更需核对 | - [x] 1.12 改造 `playerView` 与前端 Board 玩家映射：队友手牌可见、对手隐藏，4 人布局与目标展示正确。
ADD openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:14 | 注意 代码变更需核对 | - [x] 1.13 在选角界面右下红框区域接入“目标交互 + 站位面板”（默认值、点击空位移动、非法操作反馈、锁定态）。
ADD openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:15 | 注意 代码变更需核对 | - [x] 1.14 实现顶部并排 3 个他人悬浮窗（2 敌 + 1 友），并通过边缘高亮明确区分敌我。
ADD openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:16 | 注意 代码变更需核对 | - [x] 1.15 实现“攻击阶段结束后的目标选择面板”：展示 3 个可选目标，样式复用悬浮窗并纵向排列，点击即确认目标。
ADD openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:17 | 注意 代码变更需核对 | - [x] 1.16 将目标选择结果与 Targeting Roll 分支打通：目标确认后写入 `defenderId` 并回显。
ADD openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:18 | 注意 代码变更需核对 | - [x] 1.17 改造服务端创建与入座：`/games/:name/create` 按游戏配置校验人数；4 座位元数据、`claim-seat` 状态流转正确。
ADD openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:19 | 注意 代码变更需核对 | - [x] 1.18 补充并更新测试：规则函数、站位移动校验、目标选择交互分支、攻击/结算、胜负判定、视图过滤、服务端创建与入座流程（2 人与 4 人均要覆盖）。
DEL openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:22 | 注意 代码变更需核对 | - [ ] 2.1 `openspec validate add-dicethrone-2v2-team-mode --strict --no-interactive` 通过。
DEL openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:23 | 注意 代码变更需核对 | - [ ] 2.2 DiceThrone 领域测试新增 2v2 覆盖并通过（回合顺序、目标掷骰、共享体力、胜负判定）。
DEL openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:24 | 注意 代码变更需核对 | - [ ] 2.3 服务端路由与大厅流程验证通过（创建 4 人房、4 人入座后进入 playing）。
DEL openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:25 | 注意 代码变更需核对 | - [ ] 2.4 手动走查站位交互链路：默认站位显示正确，点击空位移动生效，尝试交换位被拒绝。
DEL openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:26 | 注意 代码变更需核对 | - [ ] 2.5 手动走查目标交互链路：1/2、3/4 自动目标正确；5 由防守队选择；6 由进攻方选择。
DEL openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:27 | 注意 代码变更需核对 | - [ ] 2.6 手动走查顶部悬浮窗链路：顶部 3 窗并排稳定，敌我边缘高亮正确。
DEL openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:28 | 注意 代码变更需核对 | - [ ] 2.7 手动走查目标面板链路：攻击阶段结束后出现 3 目标竖排，点击后立即确认并关闭。
DEL openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:29 | 注意 代码变更需核对 | - [ ] 2.8 手动走查 2v2 对局主链路：开房→入座→选角/站位→目标掷骰→攻击/防御→团队胜负。
DEL openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:30 | 注意 代码变更需核对 | - [ ] 2.9 手动走查响应窗口链路：同队玩家不会进入同队响应队列（队友不响应队友）。
ADD openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:22 | 注意 代码变更需核对 | - [x] 2.1 `openspec validate add-dicethrone-2v2-team-mode --strict --no-interactive` 通过。
ADD openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:23 | 注意 代码变更需核对 | - [x] 2.2 DiceThrone 领域测试新增 2v2 覆盖并通过（回合顺序、目标投骰、共享体力、胜负判定）。
ADD openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:24 | 注意 代码变更需核对 | - [x] 2.3 服务端路由与大厅流程验证通过（创建 4 人房、4 人入座后进入 `playing`）。
ADD openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:25 | 注意 代码变更需核对 | - [x] 2.4 手动走查站位交互链路：默认站位显示正确，点击空位移动生效，尝试交换位被拒绝。
ADD openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:26 | 注意 代码变更需核对 | - [x] 2.5 手动走查目标交互链路：1/2、3/4 自动目标正确，5 由防守队选择，6 由进攻方选择。
ADD openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:27 | 注意 代码变更需核对 | - [x] 2.6 手动走查顶部悬浮窗链路：顶部 3 窗并排稳定，敌我边缘高亮正确。
ADD openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:28 | 注意 代码变更需核对 | - [x] 2.7 手动走查目标面板链路：攻击阶段结束后出现 3 目标竖排，点击后立即确认并关闭。
ADD openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:29 | 注意 代码变更需核对 | - [x] 2.8 手动走查 2v2 对局主链路：开房→入座→选角/站位→目标投骰→攻击/防御→团队胜负。
ADD openspec/changes/add-dicethrone-2v2-team-mode/tasks.md:30 | 注意 代码变更需核对 | - [x] 2.9 手动走查响应窗口链路：同队玩家不会进入同队响应队列（队友不响应队友）。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:1 | 注意 代码变更需核对 | ## Context
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:2 | 注意 代码变更需核对 | 当前 4 人 / 2v2 的核心规则已经落地，但“面向玩家目标”的交互属于另一层兼容问题：
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:3 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:4 | 注意 代码变更需核对 | - 领域层的部分 custom action 已经把候选目标扩展为 `Object.keys(state.players)`。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:5 | 注意 代码变更需核对 | - 组件测试与部分 E2E 仍按 `['0', '1']`、`自己/对手` 的 2 人口径编写。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:6 | 注意 代码变更需核对 | - `validateGrantTokens` 与 `validateTransferStatus` 目前只检查“是否有 pendingInteraction、是否是当前玩家”，没有严格校验目标玩家、来源玩家、转移约束。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:7 | 注意 代码变更需核对 | - `TRANSFER_STATUS` 执行层实际上同时支持状态与 token 的转移，但 4 人链路未形成明确验证闭环。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:8 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:9 | 注意 代码变更需核对 | 因此，这轮不应再混进“所有 2v2 功能”的大收口，而应独立成一个小 change，聚焦第一批高风险多人目标交互。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:10 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:11 | 注意 代码变更需核对 | ## Goals
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:12 | 注意 代码变更需核对 | - 收口第一批高风险“玩家目标交互”在 4 人 / 2v2 下的规则、验证、UI 与 E2E。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:13 | 注意 代码变更需核对 | - 让 4 人玩家选择面板能够稳定区分多个候选玩家，而不是继续依赖 2 人语义。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:14 | 注意 代码变更需核对 | - 为后续第二批/第三批多人能力审计建立统一模式和测试锚点。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:15 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:16 | 注意 代码变更需核对 | ## Non-Goals
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:17 | 注意 代码变更需核对 | - 不在本 change 中承诺“一次性穷举所有英雄全部多人能力”。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:18 | 注意 代码变更需核对 | - 不重开 2v2 核心规则（回合、目标投骰、共享体力、响应窗口主链路）的既有 change。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:19 | 注意 代码变更需核对 | - 不在本 change 中处理与“玩家目标交互”无关的视觉系统或普通 1v1 行为。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:20 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:21 | 注意 代码变更需核对 | ## Decisions
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:22 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:23 | 注意 代码变更需核对 | ### 1. 采用“新 change + 分批收口”，不回头扩写已完成 change
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:24 | 注意 代码变更需核对 | - 原因：`add-dicethrone-2v2-team-mode` 已处于 complete 状态，再把后续专项缺口继续混入会让范围和验收边界失真。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:25 | 注意 代码变更需核对 | - 结果：本 change 仅承担第一批“玩家目标交互”专项收口。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:26 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:27 | 注意 代码变更需核对 | ### 2. 第一批只覆盖三类高风险交互
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:28 | 注意 代码变更需核对 | - 任意玩家授 token
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:29 | 注意 代码变更需核对 | - 任意玩家移除状态
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:30 | 注意 代码变更需核对 | - 状态 / 可移除 token 转移到另一玩家
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:31 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:32 | 注意 代码变更需核对 | 原因：这三类都共享 `selectPlayer` / `selectStatus` / `selectTargetStatus` / `TRANSFER_STATUS` 这一套核心实现，是最适合先做共享根因收口的切片。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:33 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:34 | 注意 代码变更需核对 | ### 3. 先修共享抽象，再补单卡 E2E
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:35 | 注意 代码变更需核对 | - 共享层包括：
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:36 | 注意 代码变更需核对 |   - `PendingInteraction.targetPlayerIds`
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:37 | 注意 代码变更需核对 |   - `GRANT_TOKENS` / `TRANSFER_STATUS` 验证
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:38 | 注意 代码变更需核对 |   - `InteractionOverlay` 的 4 人候选渲染
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:39 | 注意 代码变更需核对 |   - `Board.tsx` 的本地交互提交链
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:40 | 注意 代码变更需核对 | - 单卡验证优先挑代表性场景：
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:41 | 注意 代码变更需核对 |   - `Vengeance II`（任意玩家授 token）
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:42 | 注意 代码变更需核对 |   - `Transfer Status!` 或同类双阶段转移卡
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:43 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:44 | 注意 代码变更需核对 | ## Risks / Trade-offs
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:45 | 注意 代码变更需核对 | - 当前工作树已有大量并发修改，必须避免误碰无关 2v2 代码。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:46 | 注意 代码变更需核对 | - 若这轮直接追求“全英雄穷举”，会把 spec 和实现边界再次做大，难以稳定收口。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:47 | 注意 代码变更需核对 | - 组件 UI 目前使用 `self/opponent` 文案表达玩家身份，4 人下需要补更稳定的区分方式，否则 E2E 难以可靠定位正确候选目标。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:48 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:49 | 注意 代码变更需核对 | ## Migration Plan
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:50 | 注意 代码变更需核对 | 1. 盘点第一批相关 custom action、卡牌、命令和测试覆盖。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:51 | 注意 代码变更需核对 | 2. 收紧验证层与交互层共享抽象。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:52 | 注意 代码变更需核对 | 3. 以代表性多人能力补齐 4 人 Vitest / E2E。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:53 | 注意 代码变更需核对 | 4. 更新证据与 planning-with-files；未纳入本批次的多人能力记录到后续批次。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:54 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:55 | 注意 代码变更需核对 | ## Open Questions
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:56 | 注意 代码变更需核对 | - 4 人玩家选择卡片中，是否统一展示“昵称 + P 座位 + 阵营色”，作为所有多人目标交互的标准样式。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/design.md:57 | 注意 代码变更需核对 | - `TRANSFER_STATUS` 是否继续沿用当前命名，同时承载 token 转移；还是仅在 spec 中明确“状态/可移除 token”都走该命令。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/proposal.md:1 | 注意 代码变更需核对 | # Change: DiceThrone 4 人玩家目标交互第一批收口
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/proposal.md:2 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/proposal.md:3 | 注意 代码变更需核对 | ## Why
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/proposal.md:4 | 注意 代码变更需核对 | `add-dicethrone-2v2-team-mode` 已收口 4 人 / 2v2 的核心规则闭环，但“面向玩家目标”的技能、卡牌与状态转移交互并未完成全量审计。当前代码中已经存在多人化入口（如 `targetPlayerIds: Object.keys(state.players)`），但验证层、交互 UI 与 E2E 仍残留 2 人口径，特别是“任意玩家授 token”“移除玩家状态”“转移状态/可移除 token”这几类高风险路径。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/proposal.md:5 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/proposal.md:6 | 注意 代码变更需核对 | 如果不补这层专项收口，DiceThrone 会出现“2v2 主链路正确，但具体多人技能/卡牌交互仍可能带 2 人假设”的隐性缺口。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/proposal.md:7 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/proposal.md:8 | 注意 代码变更需核对 | ## What Changes
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/proposal.md:9 | 注意 代码变更需核对 | - 新增一条针对 DiceThrone 4 人 / 2v2 的“玩家目标交互兼容”收口 change，专门覆盖第一批高风险多人能力。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/proposal.md:10 | 注意 代码变更需核对 | - 审计并收口以下第一批范围：
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/proposal.md:11 | 注意 代码变更需核对 |   - 任意玩家授 token 的技能交互（如 `Vengeance II`、`Consecrate`）
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/proposal.md:12 | 注意 代码变更需核对 |   - 任意玩家移除状态 / 移除全部状态的卡牌交互
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/proposal.md:13 | 注意 代码变更需核对 |   - 状态 / 可移除 token 在玩家之间转移的双阶段交互
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/proposal.md:14 | 注意 代码变更需核对 | - 收紧 `GRANT_TOKENS`、`TRANSFER_STATUS` 等命令的交互期验证，避免仅凭“有 pendingInteraction”就放行。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/proposal.md:15 | 注意 代码变更需核对 | - 将相关交互 UI 从“2 人 self/opponent 视角”补到可稳定区分 4 人候选目标的版本，并补齐稳定测试锚点。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/proposal.md:16 | 注意 代码变更需核对 | - 为第一批能力补齐 4 人版本的领域测试、组件测试和在线 E2E。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/proposal.md:17 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/proposal.md:18 | 注意 代码变更需核对 | ## Impact
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/proposal.md:19 | 注意 代码变更需核对 | - Affected specs: `dicethrone-team-mode`
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/proposal.md:20 | 注意 代码变更需核对 | - Affected code:
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/proposal.md:21 | 注意 代码变更需核对 |   - `src/games/dicethrone/domain/customActions/common.ts`
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/proposal.md:22 | 注意 代码变更需核对 |   - `src/games/dicethrone/domain/customActions/paladin.ts`
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/proposal.md:23 | 注意 代码变更需核对 |   - `src/games/dicethrone/domain/commandValidation.ts`
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/proposal.md:24 | 注意 代码变更需核对 |   - `src/games/dicethrone/domain/execute.ts`
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/proposal.md:25 | 注意 代码变更需核对 |   - `src/games/dicethrone/Board.tsx`
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/proposal.md:26 | 注意 代码变更需核对 |   - `src/games/dicethrone/ui/InteractionOverlay.tsx`
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/proposal.md:27 | 注意 代码变更需核对 |   - `src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx`
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/proposal.md:28 | 注意 代码变更需核对 |   - 现有 DiceThrone 相关 Vitest / Playwright 测试文件
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:1 | 注意 代码变更需核对 | ## ADDED Requirements
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:2 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:3 | 注意 代码变更需核对 | > 本 change 只收口 DiceThrone 4 人 / 2v2 “玩家目标交互”第一批高风险能力，不代表所有多人玩家目标效果已被穷举审计。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:4 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:5 | 注意 代码变更需核对 | ### Requirement: Batch 1 任意玩家授 token 交互兼容
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:6 | 注意 代码变更需核对 | 系统 SHALL 在 4 人 / 2v2 模式下，正确支持 Batch 1 范围内“给任意玩家 token”的技能交互；玩家选择面板、验证层与执行层 MUST 共同按真实候选玩家集工作，不得退化为 2 人 `self/opponent` 假设。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:7 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:8 | 注意 代码变更需核对 | #### Scenario: Vengeance II 在 4 人模式下展示完整候选集并授予队友 Retribution
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:9 | 注意 代码变更需核对 | - **GIVEN** 4 人 / 2v2 对局中，圣骑士触发 `Vengeance II`
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:10 | 注意 代码变更需核对 | - **WHEN** 系统打开玩家选择交互
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:11 | 注意 代码变更需核对 | - **THEN** 面板展示所有合法候选玩家，并能稳定区分 `self / ally / enemy`
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:12 | 注意 代码变更需核对 | - **AND** 当玩家选择合法队友并确认后，系统授予该队友 `Retribution`
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:13 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:14 | 注意 代码变更需核对 | #### Scenario: Consecrate 在 4 人模式下授予任意玩家多 token
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:15 | 注意 代码变更需核对 | - **GIVEN** 4 人 / 2v2 对局中，圣骑士打出 `Consecrate`
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:16 | 注意 代码变更需核对 | - **WHEN** 玩家选择一名合法目标并确认
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:17 | 注意 代码变更需核对 | - **THEN** 系统 MUST 一次性授予该目标 `Protect / Retribution / Crit / Accuracy`
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:18 | 注意 代码变更需核对 | - **AND** host 页与目标页都能同步观察到相同的 token 结果
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:19 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:20 | 注意 代码变更需核对 | #### Scenario: 非法授 token 目标会被验证层拒绝
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:21 | 注意 代码变更需核对 | - **GIVEN** 当前存在“给任意玩家 token”的交互
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:22 | 注意 代码变更需核对 | - **WHEN** 客户端提交不在 `targetPlayerIds` 内的目标玩家
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:23 | 注意 代码变更需核对 | - **THEN** 验证层 MUST 拒绝该命令
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:24 | 注意 代码变更需核对 | - **AND** 不得仅因“存在 pendingInteraction”就默认放行
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:25 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:26 | 注意 代码变更需核对 | ### Requirement: Batch 1 任意玩家移除状态交互兼容
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:27 | 注意 代码变更需核对 | 系统 SHALL 在 4 人 / 2v2 模式下，正确支持 Batch 1 范围内“移除 1 个状态 / token”与“移除一名玩家全部可移除状态 / token”的交互；合法目标约束与目标页权威态同步 MUST 一致。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:28 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:29 | 注意 代码变更需核对 | #### Scenario: remove-status-1 只允许选择合法状态拥有者并移除目标效果
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:30 | 注意 代码变更需核对 | - **GIVEN** 4 人 / 2v2 对局中触发 `remove-status-1`
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:31 | 注意 代码变更需核对 | - **WHEN** 系统打开状态拥有者与状态效果选择交互
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:32 | 注意 代码变更需核对 | - **THEN** 面板只展示合法候选玩家及其可移除状态 / token
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:33 | 注意 代码变更需核对 | - **AND** 当玩家确认后，目标效果会从权威状态中被移除
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:34 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:35 | 注意 代码变更需核对 | #### Scenario: remove-all-status 会拦截空目标并清空可移除效果
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:36 | 注意 代码变更需核对 | - **GIVEN** 4 人 / 2v2 对局中触发 `remove-all-status`
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:37 | 注意 代码变更需核对 | - **WHEN** 玩家尝试选择没有任何可移除状态 / token 的目标
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:38 | 注意 代码变更需核对 | - **THEN** 确认操作 MUST 保持禁用
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:39 | 注意 代码变更需核对 | - **AND** 当玩家改为选择合法目标并确认后，该目标的所有可移除状态 / token 都会被清空
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:40 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:41 | 注意 代码变更需核对 | ### Requirement: Batch 1 状态与可移除 token 转移交互兼容
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:42 | 注意 代码变更需核对 | 系统 SHALL 在 4 人 / 2v2 模式下，正确支持 Batch 1 范围内“从一名玩家转移状态或可移除 token 到另一名玩家”的双阶段交互；共享 UI、验证层与执行层 MUST 一致理解来源玩家、目标玩家与可转移效果。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:43 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:44 | 注意 代码变更需核对 | #### Scenario: Transfer Status 在 4 人模式下以四宫格完成双阶段选择
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:45 | 注意 代码变更需核对 | - **GIVEN** 4 人 / 2v2 对局中触发 `Transfer Status`
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:46 | 注意 代码变更需核对 | - **WHEN** 玩家先完成来源状态 / token 选择，再进入目标玩家选择阶段
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:47 | 注意 代码变更需核对 | - **THEN** 第二阶段仍展示同一组 4 张玩家卡
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:48 | 注意 代码变更需核对 | - **AND** 已选来源玩家卡会以锁定禁用态保留在原位
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:49 | 注意 代码变更需核对 | - **AND** 其余合法目标玩家卡可继续被选择
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:50 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:51 | 注意 代码变更需核对 | #### Scenario: Transfer Status 不能把效果转回来源玩家自己
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:52 | 注意 代码变更需核对 | - **GIVEN** 当前存在状态 / token 转移交互
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:53 | 注意 代码变更需核对 | - **WHEN** 客户端把 `toPlayerId` 提交为 `fromPlayerId`
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:54 | 注意 代码变更需核对 | - **THEN** 验证层 MUST 拒绝该命令
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:55 | 注意 代码变更需核对 | - **AND** 不得执行任何状态或 token 转移
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:56 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:57 | 注意 代码变更需核对 | #### Scenario: 不可移除 token 不会被 Transfer Status 转移
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:58 | 注意 代码变更需核对 | - **GIVEN** 目标玩家身上同时存在可移除与不可移除 token
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:59 | 注意 代码变更需核对 | - **WHEN** 玩家尝试触发状态 / token 转移
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:60 | 注意 代码变更需核对 | - **THEN** 系统只允许转移可移除状态 / token
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:61 | 注意 代码变更需核对 | - **AND** 不可移除 token 必须被排除在可选与可执行结果之外
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:62 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:63 | 注意 代码变更需核对 | ### Requirement: Batch 1 无单一敌方目标的无伤害技能流程兼容
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:64 | 注意 代码变更需核对 | 系统 SHALL 在 4 人 / 2v2 模式下，正确处理 Batch 1 范围内“无单一敌方目标、但仍会触发玩家交互或 postDamage 效果”的无伤害技能；攻击流程 MUST 按实际效果阻塞与继续，不得误走普通单体攻击分支。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:65 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:66 | 注意 代码变更需核对 | #### Scenario: 无默认 defender 的无伤害技能不会误进 targetingRoll
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:67 | 注意 代码变更需核对 | - **GIVEN** 4 人 / 2v2 对局中触发一个没有默认 defender 的无伤害技能
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:68 | 注意 代码变更需核对 | - **WHEN** 该技能需要进入玩家选择交互
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:69 | 注意 代码变更需核对 | - **THEN** 系统不得因为当前是 4 人模式就强制进入 `targetingRoll`
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:70 | 注意 代码变更需核对 | - **AND** 攻击流程应停在交互前，等待玩家完成选择
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:71 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:72 | 注意 代码变更需核对 | #### Scenario: INTERACTION_REQUESTED 会阻塞该类无伤害技能的后续推进
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:73 | 注意 代码变更需核对 | - **GIVEN** 上述技能在 `preDefense` 阶段发出了 `INTERACTION_REQUESTED`
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:74 | 注意 代码变更需核对 | - **WHEN** 交互尚未完成
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:75 | 注意 代码变更需核对 | - **THEN** 攻击流程 MUST 保持阻塞
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:76 | 注意 代码变更需核对 | - **AND** 不得提前推进到后续 phase 或吞掉交互
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:77 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:78 | 注意 代码变更需核对 | #### Scenario: 无默认 defender 的无伤害技能仍会执行 postDamage 结果
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:79 | 注意 代码变更需核对 | - **GIVEN** 上述技能交互已完成
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:80 | 注意 代码变更需核对 | - **WHEN** 攻击流程继续结算
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:81 | 注意 代码变更需核对 | - **THEN** 系统仍会执行该技能的 `postDamage` 效果
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/specs/dicethrone-team-mode/spec.md:82 | 注意 代码变更需核对 | - **AND** 相关资源或 token 结果会正确写回权威状态
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/tasks.md:1 | 注意 代码变更需核对 | ## 1. Audit
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/tasks.md:2 | 注意 代码变更需核对 | - [x] 1.1 盘点第一批 4 人玩家目标交互能力：任意玩家授 token、任意玩家移除状态、状态/可移除 token 转移。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/tasks.md:3 | 注意 代码变更需核对 | - [x] 1.2 对照代码与现有测试，记录仍带 2 人假设的验证层、UI 组件和 E2E 入口。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/tasks.md:4 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/tasks.md:5 | 注意 代码变更需核对 | ## 2. Implementation
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/tasks.md:6 | 注意 代码变更需核对 | - [x] 2.1 收紧 `GRANT_TOKENS` 与 `TRANSFER_STATUS` 的交互期验证：目标玩家必须属于候选集，转移目标不得等于来源玩家，交互上下文必须完整。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/tasks.md:7 | 注意 代码变更需核对 | - [x] 2.2 改造 `InteractionOverlay` / `Board.tsx` 的玩家选择渲染与提交流程，使 4 人候选目标可稳定区分并可测试。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/tasks.md:8 | 注意 代码变更需核对 | - [x] 2.3 确认 `TRANSFER_STATUS` 在 4 人模式下对状态与可移除 token 的双阶段交互都能正确执行。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/tasks.md:9 | 注意 代码变更需核对 | - [x] 2.4 补齐第一批代表性多人能力的规则/组件测试，覆盖 `Transfer Status`、`Consecrate`、`remove-status-1`、`remove-all-status` 与 `Vengeance II`。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/tasks.md:10 | 注意 代码变更需核对 | - [x] 2.5 修正共享攻击流程对“无单一敌方目标、无伤害、但仍会触发交互 / postDamage”的技能支持，避免 4 人模式下误进 `targetingRoll` 或提前吞掉 `INTERACTION_REQUESTED`。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/tasks.md:11 | 注意 代码变更需核对 | - [x] 2.6 补齐 4 人在线 E2E，覆盖 `Transfer Status`、`Consecrate`、`remove-status-1`、`remove-all-status` 与 `Vengeance II` 的真实链路。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/tasks.md:12 | 注意 代码变更需核对 | 
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/tasks.md:13 | 注意 代码变更需核对 | ## 3. Validation
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/tasks.md:14 | 注意 代码变更需核对 | - [x] 3.1 `openspec validate update-dicethrone-4p-player-target-interactions --strict --no-interactive` 通过。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/tasks.md:15 | 注意 代码变更需核对 | - [x] 3.2 相关 DiceThrone Vitest 通过，包括 `rule-consistency.test.ts` 中的 4 人玩家目标交互与无 defender 流程回归。
ADD openspec/changes/update-dicethrone-4p-player-target-interactions/tasks.md:16 | 注意 代码变更需核对 | - [x] 3.3 相关 DiceThrone 4 人 E2E 通过并补证据，当前 `e2e/dicethrone-simple-start.e2e.ts` 已覆盖 12 条在线用例。
DEL playwright.config.ts:119 | 注意 代码变更需核对 |     '**/dicethrone-paladin-vengeance-select-player.e2e.ts',
DEL playwright.config.ts:121 | 注意 代码变更需核对 |     '**/dicethrone-status-interaction-cancel.e2e.ts',
DEL playwright.config.ts:122 | 注意 代码变更需核对 |     '**/dicethrone-status-interaction-complete.e2e.ts',
ADD progress.md:3 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Session: 2026-03-26 Dice Throne 4人 / 2v2 攻击目标延后解析收口
ADD progress.md:4 | OK 文档/记录/证据，对运行逻辑无直接影响 | - **Status:** completed
ADD progress.md:5 | OK 文档/记录/证据，对运行逻辑无直接影响 | - Actions taken:
ADD progress.md:6 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 延续上一轮“攻击目标改为 targetingRoll 后解析”的实现，优先检查 `pendingAttack.defenderId` 可选化后的真实回归，而不是继续做无差别类型清理。
ADD progress.md:7 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 运行 `node D:\gongzuo\webgame\BoardGame\node_modules\typescript\lib\tsc.js --noEmit --pretty false`，确认当前 worktree 下这批 2v2 改动已可编译。
ADD progress.md:8 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 跑 `flow.test.ts` 后定位到两个失败点：4 人模式卡牌目标测试仍依赖旧的预写 defender 契约，以及 `targetingRoll -> defensiveRoll` 后唯一防御技能未自动选中。
ADD progress.md:9 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 在 `src/games/dicethrone/domain/flowHooks.ts` 新增 `buildAutoDefenseAbilityEvent(...)`，并在 `targetingRoll` 退出、已解析 defender 且攻击可防御时补发 `ABILITY_ACTIVATED`。
ADD progress.md:10 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 在 `src/games/dicethrone/__tests__/flow.test.ts` 把卡牌目标回归改为先真实完成 `targetingRoll -> defensiveRoll` 再断言，确保测试口径与新契约一致。
ADD progress.md:11 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 回填 `openspec/changes/add-dicethrone-2v2-team-mode/tasks.md`，将 `1.8` 标记为已完成。
ADD progress.md:12 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:13 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Test Results
ADD progress.md:14 | OK 文档/记录/证据，对运行逻辑无直接影响 | | Test | Input | Expected | Actual | Status |
ADD progress.md:15 | OK 文档/记录/证据，对运行逻辑无直接影响 | |------|-------|----------|--------|--------|
ADD progress.md:16 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 2 个失败用例定向回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/flow.test.ts -t "4 人模式下卡牌对手效果优先命中当前战斗对手\|4 人模式下防御掷骰确认后的响应窗口只归当前攻击方" --configLoader native` | 两个 2v2 回归用例都恢复通过 | `2 passed` | ✅ |
ADD progress.md:17 | OK 文档/记录/证据，对运行逻辑无直接影响 | | DiceThrone 4P 三文件回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/flow.test.ts src/games/dicethrone/__tests__/rule-consistency.test.ts src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts --configLoader native` | 2v2 相关流程、规则与边界回归全部通过 | `148 passed` | ✅ |
ADD progress.md:18 | OK 文档/记录/证据，对运行逻辑无直接影响 | | TypeScript 类型检查 | `node D:\gongzuo\webgame\BoardGame\node_modules\typescript\lib\tsc.js --noEmit --pretty false` | 无类型错误 | 无输出 | ✅ |
ADD progress.md:19 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:20 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Next Step
ADD progress.md:21 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 继续核对 OpenSpec 未勾选的 `1.5-1.12` / `1.18`，优先复查共享体力、结算链、playerView 过滤和剩余 2v2 手工验收项。
ADD progress.md:22 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:205 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:206 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Session: 2026-03-25 Dice Throne 4 人/2v2 targetingRoll 目标选择收尾
ADD progress.md:207 | OK 文档/记录/证据，对运行逻辑无直接影响 | - **Status:** completed
ADD progress.md:208 | OK 文档/记录/证据，对运行逻辑无直接影响 | - Actions taken:
ADD progress.md:209 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 追踪 `targetingRoll` 的 5/6 分支，从 `src/games/dicethrone/domain/flowHooks.ts` 到 `CHOICE_REQUESTED`、交互创建、`select-target:*` effect 的整条链路。
ADD progress.md:210 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 确认仅清理 `targetingSelectionPending` 不能阻止重复目标选择，因此在 `PendingAttack` 上补充 `targetingSelectionResolved` 作为幂等保护。
ADD progress.md:211 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 在 `src/games/dicethrone/domain/reducer.ts` 与 `src/games/dicethrone/domain/systems.ts` 中，为 `targeting-roll` 的 `CHOICE_REQUESTED` 加入“已完成则忽略”的保护，防止重复创建交互。
ADD progress.md:212 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 在 `src/games/dicethrone/domain/flowHooks.ts` 中封住历史残留的 5/6 旧分支，使 `SYS_INTERACTION_RESPOND` 在选择完成后自动推进到 `defensiveRoll`。
ADD progress.md:213 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 更新 `src/games/dicethrone/__tests__/flow.test.ts`，把 4 人模式 `targetingRoll` 的断言改为“选择后直接进入 `defensiveRoll`”，并复跑相关测试与 `tsc`。
ADD progress.md:214 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:215 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Test Results
ADD progress.md:216 | OK 文档/记录/证据，对运行逻辑无直接影响 | | Test | Input | Expected | Actual | Status |
ADD progress.md:217 | OK 文档/记录/证据，对运行逻辑无直接影响 | |------|-------|----------|--------|--------|
ADD progress.md:218 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 4 人模式 targetingRoll 定向回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/flow.test.ts -t "4 人模式 targetingRoll" --configLoader native` | 目标选择后自动推进，不再卡在 `targetingRoll` | 通过 | ✅ |
ADD progress.md:219 | OK 文档/记录/证据，对运行逻辑无直接影响 | | flow + rule consistency 回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/flow.test.ts src/games/dicethrone/__tests__/rule-consistency.test.ts --configLoader native` | 相关规则与流程回归通过 | `109 passed` | ✅ |
ADD progress.md:220 | OK 文档/记录/证据，对运行逻辑无直接影响 | | TypeScript 类型检查 | `node D:\gongzuo\webgame\BoardGame\node_modules\typescript\lib\tsc.js --noEmit --pretty false` | 无类型错误 | 无输出 | ✅ |
ADD progress.md:221 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:222 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Error Log
ADD progress.md:223 | OK 文档/记录/证据，对运行逻辑无直接影响 | | Timestamp | Error | Attempt | Resolution |
ADD progress.md:224 | OK 文档/记录/证据，对运行逻辑无直接影响 | |-----------|-------|---------|------------|
ADD progress.md:225 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 2026-03-25 | `src/games/dicethrone/domain/flowHooks.ts` 里仍有历史残留的 5/6 分支，选择目标后又发出一次 `CHOICE_REQUESTED`，导致流程停在 `targetingRoll` | 1 | 保留正确分支，并用 `targetingSelectionResolved` 在 reducer/system 两侧增加幂等保护，封住重复选择链路 |
ADD progress.md:226 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:227 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Session: 2026-03-25 Dice Throne 4人/2v2 targetingRoll 目标选择收尾（格式修正）
ADD progress.md:228 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:229 | OK 文档/记录/证据，对运行逻辑无直接影响 | **Status:** completed
ADD progress.md:230 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:231 | OK 文档/记录/证据，对运行逻辑无直接影响 | 本轮先追踪了 `targetingRoll` 的 5/6 分支，从 `src/games/dicethrone/domain/flowHooks.ts` 到 `CHOICE_REQUESTED`、交互创建、`select-target:*` effect 的整条链路，确认仅清理 `targetingSelectionPending` 不能阻止重复目标选择，因此补上了 `targetingSelectionResolved` 作为幂等保护。
ADD progress.md:232 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:233 | OK 文档/记录/证据，对运行逻辑无直接影响 | 随后在 `src/games/dicethrone/domain/reducer.ts` 与 `src/games/dicethrone/domain/systems.ts` 中加入“已完成则忽略”的保护，并在 `src/games/dicethrone/domain/flowHooks.ts` 中封住历史残留的 5/6 旧分支，使 `SYS_INTERACTION_RESPOND` 在选择完成后自动推进到 `defensiveRoll`。`src/games/dicethrone/__tests__/flow.test.ts` 已同步更新。
ADD progress.md:234 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:235 | OK 文档/记录/证据，对运行逻辑无直接影响 | Validation: `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/flow.test.ts -t "4 人模式 targetingRoll" --configLoader native` 通过；`node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/flow.test.ts src/games/dicethrone/__tests__/rule-consistency.test.ts --configLoader native` 得到 `109 passed`；`node D:\gongzuo\webgame\BoardGame\node_modules\typescript\lib\tsc.js --noEmit --pretty false` 无输出。
ADD progress.md:236 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:237 | OK 文档/记录/证据，对运行逻辑无直接影响 | Error Log: `src/games/dicethrone/domain/flowHooks.ts` 中仍有历史残留的 5/6 分支，选择目标后又发出一次 `CHOICE_REQUESTED`，导致流程停在 `targetingRoll`；最终通过保留正确分支并引入 `targetingSelectionResolved` 的双侧幂等保护解决。
ADD progress.md:238 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:239 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Session: 2026-03-25 Dice Throne 4人/2v2 验证补跑与死代码清理
ADD progress.md:240 | OK 文档/记录/证据，对运行逻辑无直接影响 | - **Status:** in_progress
ADD progress.md:241 | OK 文档/记录/证据，对运行逻辑无直接影响 | - Actions taken:
ADD progress.md:242 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 恢复本 worktree 的 `task_plan.md` / `findings.md` / `progress.md`，确认当前任务仍是 Dice Throne 4 人 / 2v2 这条线，不扩散到其他 worktree。
ADD progress.md:243 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 发现 Git 因 owner SID 不一致触发 `dubious ownership`；改用 `git -c safe.directory=D:/gongzuo/webgame/BoardGame-wt-dicethrone-4p-team-mode ...` 继续只读检查，未改全局 Git 配置。
ADD progress.md:244 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 尝试补跑 `flow.test.ts` / `rule-consistency.test.ts` / `boundaryEdgeCases.test.ts`，默认 Vitest forks worker 初始化直接报 `spawn EPERM`。
ADD progress.md:245 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 改用 `--pool threads --no-file-parallelism --maxWorkers 1` 再试一次，仍在 `vite:esbuild` 转换 `vitest.setup.ts` 时触发 `spawn EPERM`，确认 blocker 来自当前终端对子进程 / esbuild service 的限制。
ADD progress.md:246 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 在复查 `src/games/dicethrone/domain/flowHooks.ts` 时，发现 `targetingRoll` 的 5/6 分支残留 `if (true) { ... } else { ... }` 死代码；本轮已删除，只保留“目标已由选择交互写回后继续攻击流程”的真实路径。
ADD progress.md:247 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 重新运行 `tsc`，确认本轮清理未引入类型错误。
ADD progress.md:248 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:249 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Test Results
ADD progress.md:250 | OK 文档/记录/证据，对运行逻辑无直接影响 | | Test | Input | Expected | Actual | Status |
ADD progress.md:251 | OK 文档/记录/证据，对运行逻辑无直接影响 | |------|-------|----------|--------|--------|
ADD progress.md:252 | OK 文档/记录/证据，对运行逻辑无直接影响 | | TypeScript 类型检查 | `node D:\gongzuo\webgame\BoardGame\node_modules\typescript\lib\tsc.js --noEmit --pretty false` | 无类型错误 | 无输出 | ✅ |
ADD progress.md:253 | OK 文档/记录/证据，对运行逻辑无直接影响 | | DiceThrone 4P 核心回归（默认 Vitest worker） | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/flow.test.ts src/games/dicethrone/__tests__/rule-consistency.test.ts src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts --configLoader native` | 跑完 3 个相关文件 | `spawn EPERM`，worker 未启动 | ⚠ |
ADD progress.md:254 | OK 文档/记录/证据，对运行逻辑无直接影响 | | DiceThrone 4P 核心回归（threads 单线程） | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/flow.test.ts src/games/dicethrone/__tests__/rule-consistency.test.ts src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` | 避开 forks 并跑完 3 个相关文件 | `vite:esbuild` 处理 `vitest.setup.ts` 时 `spawn EPERM` | ⚠ |
ADD progress.md:255 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:256 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Error Log
ADD progress.md:257 | OK 文档/记录/证据，对运行逻辑无直接影响 | | Timestamp | Error | Attempt | Resolution |
ADD progress.md:258 | OK 文档/记录/证据，对运行逻辑无直接影响 | |-----------|-------|---------|------------|
ADD progress.md:259 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 2026-03-25 | Git `dubious ownership` 阻止 `status/log/diff` | 1 | 改用 `git -c safe.directory=D:/gongzuo/webgame/BoardGame-wt-dicethrone-4p-team-mode ...` 单命令绕过；全局 `.gitconfig` 无写权限 |
ADD progress.md:260 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 2026-03-25 | Vitest 默认 worker 初始化报 `spawn EPERM` | 1 | 改试 `--pool threads --no-file-parallelism --maxWorkers 1`，确认不是单纯 forks worker 问题 |
ADD progress.md:261 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 2026-03-25 | Vitest threads 模式仍在 `vite:esbuild` 转换阶段报 `spawn EPERM` | 2 | 记录为当前受限终端 blocker；本轮改用 `tsc` + 死代码清理推进 |
ADD progress.md:262 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:263 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Session: 2026-03-25 Dice Throne 4人/2v2 站位移动闭环与 OpenSpec 回填
ADD progress.md:264 | OK 文档/记录/证据，对运行逻辑无直接影响 | - **Status:** completed
ADD progress.md:265 | OK 文档/记录/证据，对运行逻辑无直接影响 | - Actions taken:
ADD progress.md:266 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 复核当前 worktree 的 Dice Throne 改动进度，确认本轮新增重点是 4 人/2v2 开局前站位移动闭环，而不是再扩散到新的功能面。
ADD progress.md:267 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 在领域层补齐 `MOVE_SEAT` / `SEATING_MOVED` / `PLAYER_UNREADY` 全链路，并把站位合法性收敛到 `commandValidation`。
ADD progress.md:268 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 在 `DiceThroneHeroSelection.tsx` 右下区域接入站位面板，支持房主“先选玩家，再点空位”的插入式移动；已有玩家位置点击会给出本地反馈，非房主保持只读。
ADD progress.md:269 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 为 `flow.test.ts` 新增 4 个站位相关用例，覆盖房主移动成功、非房主拒绝、原位移动拒绝、开局后锁定。
ADD progress.md:270 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 复核 `rule-consistency.test.ts` / `boundaryEdgeCases.test.ts` 中已有 2v2 覆盖，确认回合顺序、`targetingRoll`、共享体力、胜负判定都已纳入通过集。
ADD progress.md:271 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 执行 `openspec validate add-dicethrone-2v2-team-mode --strict --no-interactive` 并通过。
ADD progress.md:272 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 更新 `openspec/changes/add-dicethrone-2v2-team-mode/tasks.md`，勾选 `1.3`、`1.4`、`1.13`、`2.1`、`2.2`；手动走查项保持未勾选。
ADD progress.md:273 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:274 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Test Results
ADD progress.md:275 | OK 文档/记录/证据，对运行逻辑无直接影响 | | Test | Input | Expected | Actual | Status |
ADD progress.md:276 | OK 文档/记录/证据，对运行逻辑无直接影响 | |------|-------|----------|--------|--------|
ADD progress.md:277 | OK 文档/记录/证据，对运行逻辑无直接影响 | | DiceThrone 4P 三文件回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/flow.test.ts src/games/dicethrone/__tests__/rule-consistency.test.ts src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts --configLoader native` | 4 人/2v2 相关流程、规则与边界全部通过 | `146 passed` | ✅ |
ADD progress.md:278 | OK 文档/记录/证据，对运行逻辑无直接影响 | | TypeScript 类型检查 | `node D:\gongzuo\webgame\BoardGame\node_modules\typescript\lib\tsc.js --noEmit --pretty false` | 无类型错误 | 无输出 | ✅ |
ADD progress.md:279 | OK 文档/记录/证据，对运行逻辑无直接影响 | | OpenSpec 校验 | `openspec validate add-dicethrone-2v2-team-mode --strict --no-interactive` | change 校验通过 | `Change 'add-dicethrone-2v2-team-mode' is valid` | ✅ |
ADD progress.md:280 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:281 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Error Log
ADD progress.md:282 | OK 文档/记录/证据，对运行逻辑无直接影响 | | Timestamp | Error | Attempt | Resolution |
ADD progress.md:283 | OK 文档/记录/证据，对运行逻辑无直接影响 | |-----------|-------|---------|------------|
ADD progress.md:284 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 2026-03-25 | 当前 worktree 存在并发修改，不能假设只有单一功能线 | 1 | 只同步当前已验证完成的 2v2 站位/规范进度，不回滚或重写其他未完成改动 |
ADD progress.md:285 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Session: 2026-03-25 DiceThrone 四人房服务端 / E2E 闭环
ADD progress.md:286 | OK 文档/记录/证据，对运行逻辑无直接影响 | - **Status:** completed
ADD progress.md:287 | OK 文档/记录/证据，对运行逻辑无直接影响 | - Actions taken:
ADD progress.md:288 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 重整 `e2e/helpers/dicethrone.ts`，统一 2 人 / 4 人 setup，新增 `claimDTSeatViaAPI`、`DTPlayerSession`、`setupDTOnlineMatchWithPlayers()`，并删除坏正则与死代码。
ADD progress.md:289 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 重写 `e2e/dicethrone-simple-start.e2e.ts`，补齐 2 人与 4 人简单开局用例，并接入证据截图保存。
ADD progress.md:290 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 自审 2 人与 4 人 host 截图，确认都已进入正式棋盘态。
ADD progress.md:291 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 将服务端人数/占座状态规则抽到 `src/server/matchOccupancy.ts`，新增 `areAllSeatsOccupied()` 与显式 `playerOptions` 白名单校验，堵住 DiceThrone 误放行 3 人房的问题。
ADD progress.md:292 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 回填 `openspec/changes/add-dicethrone-2v2-team-mode/tasks.md`，勾选本轮已完成的服务端 / 验证项。
ADD progress.md:293 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 新增证据文档 `evidence/dicethrone-simple-start-e2e-test.md`。
ADD progress.md:294 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:295 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Test Results
ADD progress.md:296 | OK 文档/记录/证据，对运行逻辑无直接影响 | | Test | Input | Expected | Actual | Status |
ADD progress.md:297 | OK 文档/记录/证据，对运行逻辑无直接影响 | |------|-------|----------|--------|--------|
ADD progress.md:298 | OK 文档/记录/证据，对运行逻辑无直接影响 | | TypeScript 静态检查 | `node D:\gongzuo\webgame\BoardGame\node_modules\typescript\lib\tsc.js --noEmit --pretty false` | 无类型 / 语法错误 | 通过 | ✅ |
ADD progress.md:299 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 服务端占座/人数规则单测 | `node scripts/infra/vitest-cli-safe.mjs run src/server/__tests__/matchOccupancy.test.ts --configLoader native` | 占座判断、全座占满、`playerOptions` 人数白名单都正确 | `5 passed` | ✅ |
ADD progress.md:300 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 4 人房单用例 E2E | `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player room: create claim-seat join and start successfully"` | 4 人房创建、占座、加入、开局成功 | `1 passed` | ✅ |
ADD progress.md:301 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 简单开局整文件 E2E | `npm run test:e2e:ci -- e2e/dicethrone-simple-start.e2e.ts` | 2 人 + 4 人两条开局链路都通过 | `2 passed` | ✅ |
ADD progress.md:302 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 校验收紧后 4 人回归 E2E | `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player room: create claim-seat join and start successfully"` | 合法 4 人房仍可创建并开局 | `1 passed` | ✅ |
ADD progress.md:303 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:304 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Next Step
ADD progress.md:305 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 继续推进 OpenSpec 仍未完成的 2v2 规则 / 结算项。
ADD progress.md:306 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 如需继续收口验证，优先补 `2.4-2.9` 的人工走查或更细粒度 E2E。
ADD progress.md:307 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:308 | OK 文档/记录/证据，对运行逻辑无直接影响 | ---
ADD progress.md:309 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:310 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Session: 2026-03-26 Dice Throne 4人/2v2 回合顺序收口与 OpenSpec 对齐
ADD progress.md:311 | OK 文档/记录/证据，对运行逻辑无直接影响 | - **Status:** completed
ADD progress.md:312 | OK 文档/记录/证据，对运行逻辑无直接影响 | - Actions taken:
ADD progress.md:313 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 对照 OpenSpec `tasks.md` 审计 2v2 未勾选项，确认真正还没落地的核心缺口是 `1.5`：`getPlayerOrder/getNextPlayerId` 仍按站位顺时针轮转。
ADD progress.md:314 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 在 `src/games/dicethrone/domain/rules.ts` 中补上 2v2 队伍交替 turn order：以 `startingPlayerId` 所在队为首，按“己队两手 → 敌队两手”构建轮转序列。
ADD progress.md:315 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 在 `src/games/dicethrone/Board.tsx` 中把顶部三窗顺序改回显式使用 `getSeatingOrder`，避免修复回合顺序时把 4 人 UI 显示顺序一并带偏。
ADD progress.md:316 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 更新 `src/games/dicethrone/__tests__/flow.test.ts`，把 4 人轮转断言从旧的 `0→1→2→3` 改为 `0→2→1→3`，并同步修正命令序列。
ADD progress.md:317 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 更新 `src/games/dicethrone/__tests__/rule-consistency.test.ts`，新增 `startingPlayerId='1'` 的 2v2 turn-order 断言，覆盖非默认起始玩家。
ADD progress.md:318 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 回填 `openspec/changes/add-dicethrone-2v2-team-mode/tasks.md`，将已被代码与测试覆盖但此前未回填的 `1.2`、`1.5`、`1.6`、`1.7`、`1.9`、`1.10`、`1.11`、`1.12`、`1.18` 勾为完成；人工走查项 `2.4-2.9` 保持未勾选。
ADD progress.md:319 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:320 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Test Results
ADD progress.md:321 | OK 文档/记录/证据，对运行逻辑无直接影响 | | Test | Input | Expected | Actual | Status |
ADD progress.md:322 | OK 文档/记录/证据，对运行逻辑无直接影响 | |------|-------|----------|--------|--------|
ADD progress.md:323 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 2v2 回合顺序定向回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/flow.test.ts -t "4 人开局会初始化 2v2 团队状态并按队伍交替顺序轮转回合|4 人模式起始玩家为 1 号位时按同队连走后再切换敌队" --configLoader native` | 新旧 turn-order 用例通过 | `1 passed` | ✅ |
ADD progress.md:324 | OK 文档/记录/证据，对运行逻辑无直接影响 | | DiceThrone 4P 三文件回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/flow.test.ts src/games/dicethrone/__tests__/rule-consistency.test.ts src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts --configLoader native` | 2v2 规则、阶段、结算、边界持续通过 | `149 passed` | ✅ |
ADD progress.md:325 | OK 文档/记录/证据，对运行逻辑无直接影响 | | TypeScript 类型检查 | `node D:\gongzuo\webgame\BoardGame\node_modules\typescript\lib\tsc.js --noEmit --pretty false` | 无类型错误 | 无输出 | ✅ |
ADD progress.md:326 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:327 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Error Log
ADD progress.md:328 | OK 文档/记录/证据，对运行逻辑无直接影响 | | Timestamp | Error | Attempt | Resolution |
ADD progress.md:329 | OK 文档/记录/证据，对运行逻辑无直接影响 | |-----------|-------|---------|------------|
ADD progress.md:330 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 2026-03-26 | 定向 flow 回归第一次失败，旧测试命令仍按 `0→1→2→3` 驱动第二个回合 | 1 | 同步把测试命令序列改成真实新顺序 `0→2→1→3` 后通过 |
ADD progress.md:331 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:332 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Session: 2026-03-26 Dice Throne 4人站位面板在线 E2E 收口
ADD progress.md:333 | OK 文档/记录/证据，对运行逻辑无直接影响 | - **Status:** completed
ADD progress.md:334 | OK 文档/记录/证据，对运行逻辑无直接影响 | - Actions taken:
ADD progress.md:335 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 继续沿用现有 `e2e/dicethrone-simple-start.e2e.ts`，新增 4 人在线站位面板用例，不新建测试文件。
ADD progress.md:336 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 复用 `setupDTOnlineMatchWithPlayers()` 启 4 人联机选角页，直接在真实在线 UI 上验证 `2v2 Seating` 面板。
ADD progress.md:337 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 用例先断言默认分队 `Team A = P1 / P3`、`Team B = P2 / P4`，再执行“选中 P1 → 点击已占用 P2 触发拒绝提示 → 点击 Empty Seat 3 完成移动”，最后断言分队更新为 `Team A = P2 / P1`、`Team B = P3 / P4`。
ADD progress.md:338 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 保存并自审证据截图 `03-four-player-seating-panel-moved.png`，确认站位面板画面和分队文案与断言一致。
ADD progress.md:339 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 更新 `evidence/dicethrone-simple-start-e2e-test.md`，补入绝对路径截图与分析；同步将 OpenSpec `2.4` 回填为完成。
ADD progress.md:340 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:341 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Test Results
ADD progress.md:342 | OK 文档/记录/证据，对运行逻辑无直接影响 | | Test | Input | Expected | Actual | Status |
ADD progress.md:343 | OK 文档/记录/证据，对运行逻辑无直接影响 | |------|-------|----------|--------|--------|
ADD progress.md:344 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 4 人站位面板单用例 E2E | `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player seating panel: host can move to empty slot and occupied seat is rejected"` | 房主可移动到空位，点击已占位会显示拒绝反馈 | `1 passed` | ✅ |
ADD progress.md:345 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:346 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Evidence
ADD progress.md:347 | OK 文档/记录/证据，对运行逻辑无直接影响 | | Artifact | Absolute Path | Notes |
ADD progress.md:348 | OK 文档/记录/证据，对运行逻辑无直接影响 | |----------|---------------|-------|
ADD progress.md:349 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 4 人站位移动截图 | `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-4-player-seating-panel-host-can-move-to-empty-slot-and-occupied-seat-is-rejected\03-four-player-seating-panel-moved.png` | 自审确认 `Team A = P2 / P1`、`Team B = P3 / P4` |
ADD progress.md:350 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:351 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Session: 2026-03-26 DiceThrone 4 人 / 2v2 E2E 收口
ADD progress.md:352 | OK 文档/记录/证据，对运行逻辑无直接影响 | - **Status:** completed
ADD progress.md:353 | OK 文档/记录/证据，对运行逻辑无直接影响 | - Actions taken:
ADD progress.md:354 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 复核 `e2e/dicethrone-simple-start.e2e.ts` 剩余 blocker，确认最后一条 2v2 主链路用例卡在“响应窗口场景不稳定”，不是服务端 `/test` 注入本身失效。
ADD progress.md:355 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 将在线状态构造从“动态搜对手牌库里的可响应卡”改成“显式使用稳定通用卡 `card-surprise`”，并补齐响应窗口所需的 CP 与骰子前置。
ADD progress.md:356 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 将 `2.9` 的 E2E 验证口径改为更稳定的“防守方确认掷骰后，同队玩家不会进入同队响应队列”，用真实 `pendingAttack.attackerId='0'`、`defenderId='3'` 场景断言响应队列仅为 `['0']`。
ADD progress.md:357 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 将 `04-four-player-target-choice-panel-host` 的截图时机前移到目标面板可见时，保证证据截图本身能直接展示 3 个纵向目标项。
ADD progress.md:358 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 复跑单用例 `Online 4-player 2v2 flow: response queue excludes teammate and defense chain reaches team victory UI`，随后复跑整份 `e2e/dicethrone-simple-start.e2e.ts`，确认 6 条 E2E 全部通过。
ADD progress.md:359 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 重写 `evidence/dicethrone-simple-start-e2e-test.md`，补齐 5 张截图的绝对路径与分析；同步将 OpenSpec `2.5-2.9` 回填为 completed。
ADD progress.md:360 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:361 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Test Results
ADD progress.md:362 | OK 文档/记录/证据，对运行逻辑无直接影响 | | Test | Input | Expected | Actual | Status |
ADD progress.md:363 | OK 文档/记录/证据，对运行逻辑无直接影响 | |------|-------|----------|--------|--------|
ADD progress.md:364 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 2v2 主链路单用例 E2E | `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player 2v2 flow: response queue excludes teammate and defense chain reaches team victory UI"` | 同队响应过滤 + 防御推进 + 团队胜负 UI 全链路通过 | `1 passed` | ✅ |
ADD progress.md:365 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 简单开局整文件 E2E | `npm run test:e2e:ci -- e2e/dicethrone-simple-start.e2e.ts` | 2 人 + 4 人 + 站位 + 顶部三窗 + targetingRoll + 2v2 主链路全部通过 | `6 passed` | ✅ |
ADD progress.md:366 | OK 文档/记录/证据，对运行逻辑无直接影响 | | TypeScript 类型检查 | `node .\node_modules\typescript\lib\tsc.js --noEmit --pretty false` | 无类型错误 | 无输出 | ✅ |
ADD progress.md:367 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:368 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Next Step
ADD progress.md:369 | OK 文档/记录/证据，对运行逻辑无直接影响 | - DiceThrone 4 人 / 2v2 这条 OpenSpec 线当前已完成收口；后续若继续推进，应切回仓库其它主线问题或等待新的用户目标。
ADD progress.md:370 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:371 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Session: 2026-03-26 DiceThrone 4 人玩家目标交互专项立项
ADD progress.md:372 | OK 文档/记录/证据，对运行逻辑无直接影响 | - **Status:** in_progress
ADD progress.md:373 | OK 文档/记录/证据，对运行逻辑无直接影响 | - Actions taken:
ADD progress.md:374 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 复核当前 worktree 的 DiceThrone 4 人 / 2v2 真实完成边界，确认已完成的是核心规则闭环，不是“所有面向玩家目标的能力全量审计”。
ADD progress.md:375 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 对照 `testing-audit.md` 重新盘点多人目标相关入口，命中 `customActions/common.ts`、`customActions/paladin.ts`、`InteractionOverlay.tsx`、`Board.tsx`、`commandValidation.ts`、`TRANSFER_STATUS` 执行链。
ADD progress.md:376 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 确认第一批高风险范围应独立成新 OpenSpec change，而不是继续把新缺口塞回已 complete 的 `add-dicethrone-2v2-team-mode`。
ADD progress.md:377 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 新建 OpenSpec change `update-dicethrone-4p-player-target-interactions`，为“任意玩家授 token / 任意玩家移除状态 / 状态或可移除 token 转移”建立 proposal、design、tasks 与 spec delta。
ADD progress.md:378 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 将后续实现策略拆为 Batch 1/2/3，并同步回填 `task_plan.md` / `findings.md` / `progress.md`。
ADD progress.md:379 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:380 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Validation
ADD progress.md:381 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 待执行：`openspec validate update-dicethrone-4p-player-target-interactions --strict --no-interactive`
ADD progress.md:382 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:383 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Next Step
ADD progress.md:384 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 按 Batch 1 先实现共享验证层与 4 人玩家选择 UI 的收口，再补代表性 4 人 E2E。
ADD progress.md:385 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:386 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Session: 2026-03-26 DiceThrone 4 人玩家目标交互 Batch 1 收口
ADD progress.md:387 | OK 文档/记录/证据，对运行逻辑无直接影响 | - **Status:** completed
ADD progress.md:388 | OK 文档/记录/证据，对运行逻辑无直接影响 | - Actions taken:
ADD progress.md:389 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 为 `InteractionOverlay` 的 4 人玩家卡片补齐稳定 `data-testid/data-team-tone` 后，继续把第一阶段可点击状态 / token 徽章也补成稳定 selector：`dt-status-effect-<pid>-<effectId>`。
ADD progress.md:390 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 修正 `InteractionOverlay.test.tsx` 的旧断言，避免继续用 `getByText('自己')` 这类在 4 人新 UI 下会重复命中的脆弱查询。
ADD progress.md:391 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 在 `commandValidation.ts` 中收口 `TRANSFER_STATUS` 的真实在线路径：兼容权威态仍处于 `selectStatus + transferConfig:{}` 的双阶段 UI，同时保留 `selectTargetStatus` 的严格校验。
ADD progress.md:392 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 在 `rule-consistency.test.ts` 新增“在线双阶段 UI 的 `selectStatus` 权威态下允许合法 4 人 token 转移”的验证，堵住本轮 E2E 暴露出的真实缺口。
ADD progress.md:393 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 在现有 `e2e/dicethrone-simple-start.e2e.ts` 中新增 4 人 `Transfer Status` 用例：host 将敌方 `Crit` token 转给队友，并断言第二阶段来源玩家被排除、友敌标识正确、队友页权威状态同步。
ADD progress.md:394 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 复跑单用例后，继续复跑整份 `e2e/dicethrone-simple-start.e2e.ts`，确认新增的第 7 条 E2E 与既有 6 条一起稳定通过。
ADD progress.md:395 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 回填 OpenSpec `update-dicethrone-4p-player-target-interactions/tasks.md`、证据文档 `evidence/dicethrone-simple-start-e2e-test.md` 与三件套。
ADD progress.md:396 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:397 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Test Results
ADD progress.md:398 | OK 文档/记录/证据，对运行逻辑无直接影响 | | Test | Input | Expected | Actual | Status |
ADD progress.md:399 | OK 文档/记录/证据，对运行逻辑无直接影响 | |------|-------|----------|--------|--------|
ADD progress.md:400 | OK 文档/记录/证据，对运行逻辑无直接影响 | | DiceThrone 交互组件 + 规则回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx src/games/dicethrone/__tests__/rule-consistency.test.ts --configLoader native` | 4 人玩家目标 UI 与验证层回归通过 | `45 passed` | ✅ |
ADD progress.md:401 | OK 文档/记录/证据，对运行逻辑无直接影响 | | TypeScript 类型检查 | `node .\node_modules\typescript\lib\tsc.js --noEmit --pretty false` | 无类型错误 | 无输出 | ✅ |
ADD progress.md:402 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 4 人转移 token 单用例 E2E | `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player transfer token: enemy token can be transferred to ally with stable target metadata"` | 敌方 token 可转给队友，第二阶段元信息与来源排除正确 | `1 passed` | ✅ |
ADD progress.md:403 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 简单开局整文件 E2E | `npm run test:e2e:ci -- e2e/dicethrone-simple-start.e2e.ts` | 2 人 + 4 人 + 2v2 + 4 人转移 token 全部通过 | `7 passed` | ✅ |
ADD progress.md:404 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:405 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Evidence
ADD progress.md:406 | OK 文档/记录/证据，对运行逻辑无直接影响 | | Artifact | Absolute Path | Notes |
ADD progress.md:407 | OK 文档/记录/证据，对运行逻辑无直接影响 | |----------|---------------|-------|
ADD progress.md:408 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 4 人转移 token 第二阶段截图 | `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-4-player-transfer-token-enemy-token-can-be-transferred-to-ally-with-stable-target-metadata\06-four-player-transfer-token-target-selection.png` | 自审确认第二阶段候选仅剩 `P1/P3/P4`，来源玩家 `P2` 已被排除，`P3` 标为 `ALLY` |
ADD progress.md:409 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:410 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Session: 2026-03-26 DiceThrone 4 人任意玩家授 token 在线证据补强
ADD progress.md:411 | OK 文档/记录/证据，对运行逻辑无直接影响 | - **Status:** completed
ADD progress.md:412 | OK 文档/记录/证据，对运行逻辑无直接影响 | - Actions taken:
ADD progress.md:413 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 在 `e2e/dicethrone-simple-start.e2e.ts` 中继续沿用现有 4 人在线 helper，新增 `Consecrate` 用例，不新建测试文件。
ADD progress.md:414 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 构造稳定在线场景：host 选圣骑士，主阶段注入 `card-consecrate`，随后触发 `selectPlayer` 交互。
ADD progress.md:415 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 用例断言 4 个候选玩家卡片的 `data-team-tone` 正确，随后选择队友 `P3` 并确认。
ADD progress.md:416 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 最终同时在 host 页与队友页断言 `Protect/Retribution/Crit/Accuracy` 四个 token 都被权威状态授予为 `1`。
ADD progress.md:417 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 自审新增截图 `07-four-player-consecrate-target-selection.png`，确认画面真实展示 `self/ally/enemy` 四类候选，而不是 2 人残留 UI。
ADD progress.md:418 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:419 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Test Results
ADD progress.md:420 | OK 文档/记录/证据，对运行逻辑无直接影响 | | Test | Input | Expected | Actual | Status |
ADD progress.md:421 | OK 文档/记录/证据，对运行逻辑无直接影响 | |------|-------|----------|--------|--------|
ADD progress.md:422 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 4 人 Consecrate 单用例 E2E | `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player grant tokens: Consecrate can grant four tokens to ally with stable target metadata"` | 队友可被选中并同时获得 4 个 token | `1 passed` | ✅ |
ADD progress.md:423 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 规则层多 token 验证回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/rule-consistency.test.ts --configLoader native` | `tokenGrantConfigs` 在 4 人合法目标下通过 | `28 passed` | ✅ |
ADD progress.md:424 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 简单开局整文件 E2E | `npm run test:e2e:ci -- e2e/dicethrone-simple-start.e2e.ts` | 含转移 token 与 Consecrate 的 8 条在线链路全部通过 | `8 passed` | ✅ |
ADD progress.md:425 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:426 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Evidence
ADD progress.md:427 | OK 文档/记录/证据，对运行逻辑无直接影响 | | Artifact | Absolute Path | Notes |
ADD progress.md:428 | OK 文档/记录/证据，对运行逻辑无直接影响 | |----------|---------------|-------|
ADD progress.md:429 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 4 人 Consecrate 目标选择截图 | `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-4-player-grant-tokens-Consecrate-can-grant-four-tokens-to-ally-with-stable-target-metadata\07-four-player-consecrate-target-selection.png` | 自审确认 4 个候选玩家都可见，`P3` 标为 `ALLY` |
ADD progress.md:430 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:431 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Session: 2026-03-26 DiceThrone 面向多人能力审计边界收敛
ADD progress.md:432 | OK 文档/记录/证据，对运行逻辑无直接影响 | - **Status:** completed
ADD progress.md:433 | OK 文档/记录/证据，对运行逻辑无直接影响 | - Actions taken:
ADD progress.md:434 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 复查 `customActions/common.ts` 与 `customActions/paladin.ts` 中所有玩家目标交互入口，确认当前真正仍有多人语义的高风险入口已收敛到 `transfer-status`、`paladin-consecrate`、`paladin-vengeance-select-player`、`remove-status-1`、`remove-all-status`。
ADD progress.md:435 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 基于已完成的在线证据重新排序优先级：`Transfer Status` 与 `Consecrate` 已经覆盖了双阶段转移和多 token 授予这两类更复杂主链路。
ADD progress.md:436 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 按当前决策，不再优先为更简单的 `remove-status-1/remove-all-status` 额外补在线 E2E，避免把时间花在比已完成链路更简单的路径上。
ADD progress.md:437 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:438 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Conclusion
ADD progress.md:439 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 目前“面向多人目标”的复杂主链路已不再是完全未审计状态。
ADD progress.md:440 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 后续若继续扩展，应优先看新的复杂多人交互，而不是回头补比 `Transfer Status` 更简单的移除状态用例。
ADD progress.md:441 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:442 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Session: 2026-03-26 DiceThrone 4 人目标交互 UI 精简
ADD progress.md:443 | OK 文档/记录/证据，对运行逻辑无直接影响 | - **Status:** completed
ADD progress.md:444 | OK 文档/记录/证据，对运行逻辑无直接影响 | - Actions taken:
ADD progress.md:445 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 在 `src/games/dicethrone/ui/InteractionOverlay.tsx` 中重构 `selectTargetStatus` 第二阶段渲染：不再继续保留第一阶段整排 `dt-status-owner-*` 来源卡，改为显示单个来源摘要块 `dt-transfer-source-summary`。
ADD progress.md:446 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 去掉 `selectPlayer` 与 `transfer target` 已选态的外挂勾选块，统一改为仅依赖卡片自身边框高亮表达选中状态，消除“多一个框”的视觉噪音。
ADD progress.md:447 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 顺手抽出友敌 `teamTone -> className` 的样式映射，减少三处玩家卡片渲染里的重复分支。
ADD progress.md:448 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 在 `src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx` 新增断言，锁住“第二阶段不再渲染第一阶段来源卡，只保留来源摘要与真实目标卡片”的结构。
ADD progress.md:449 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 复跑组件测试、类型检查和 4 人 `Transfer Status` 在线 E2E，并自审更新后的目标选择截图。
ADD progress.md:450 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:451 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Test Results
ADD progress.md:452 | OK 文档/记录/证据，对运行逻辑无直接影响 | | Test | Input | Expected | Actual | Status |
ADD progress.md:453 | OK 文档/记录/证据，对运行逻辑无直接影响 | |------|-------|----------|--------|--------|
ADD progress.md:454 | OK 文档/记录/证据，对运行逻辑无直接影响 | | InteractionOverlay 组件回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx --configLoader native` | 第二阶段只显示来源摘要与目标卡片 | `18 passed` | ✅ |
ADD progress.md:455 | OK 文档/记录/证据，对运行逻辑无直接影响 | | TypeScript 类型检查 | `node .\node_modules\typescript\lib\tsc.js --noEmit --pretty false` | 无类型错误 | 无输出 | ✅ |
ADD progress.md:456 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 4 人转移 token 在线回归 | `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player transfer token: enemy token can be transferred to ally with stable target metadata"` | 真实 UI 不再出现来源卡 + 目标卡并排混排 | `1 passed` | ✅ |
ADD progress.md:457 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:458 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Evidence
ADD progress.md:459 | OK 文档/记录/证据，对运行逻辑无直接影响 | | Artifact | Absolute Path | Notes |
ADD progress.md:460 | OK 文档/记录/证据，对运行逻辑无直接影响 | |----------|---------------|-------|
ADD progress.md:461 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 4 人转移 token 第二阶段精简后截图 | `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-4-player-transfer-token-enemy-token-can-be-transferred-to-ally-with-stable-target-metadata\06-four-player-transfer-token-target-selection.png` | 自审确认仅剩来源摘要 + `P1/P3/P4` 三张目标卡，不再出现 6 框感知 |
ADD progress.md:462 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:463 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Session: 2026-03-26 DiceThrone 4 人目标交互四宫格修正
ADD progress.md:464 | OK 文档/记录/证据，对运行逻辑无直接影响 | - **Status:** completed
ADD progress.md:465 | OK 文档/记录/证据，对运行逻辑无直接影响 | - Actions taken:
ADD progress.md:466 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 按用户反馈撤回“来源摘要块”方案，把 `selectTargetStatus` 第二阶段改回统一四宫格语义。
ADD progress.md:467 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 来源玩家保留在原位，改成锁定禁用卡 `dt-transfer-source-locked-<pid>`；其余 3 张保持 `dt-transfer-target-<pid>` 可点击目标卡。
ADD progress.md:468 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 组件测试不再断言“来源玩家消失”，改为断言“来源玩家仍在四宫格里，但 `data-locked=true`”。
ADD progress.md:469 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 同步把 transfer token 在线用例从“来源玩家隐藏”改成“来源玩家锁定显示”的断言口径。
ADD progress.md:470 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:471 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Test Results
ADD progress.md:472 | OK 文档/记录/证据，对运行逻辑无直接影响 | | Test | Input | Expected | Actual | Status |
ADD progress.md:473 | OK 文档/记录/证据，对运行逻辑无直接影响 | |------|-------|----------|--------|--------|
ADD progress.md:474 | OK 文档/记录/证据，对运行逻辑无直接影响 | | InteractionOverlay 四宫格回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx --configLoader native` | 第二阶段显示 4 张玩家卡，其中来源卡锁定 | `18 passed` | ✅ |
ADD progress.md:475 | OK 文档/记录/证据，对运行逻辑无直接影响 | | TypeScript 类型检查 | `node .\node_modules\typescript\lib\tsc.js --noEmit --pretty false` | 无类型错误 | 无输出 | ✅ |
ADD progress.md:476 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 4 人 transfer token 单用例 E2E | `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player transfer token: enemy token can be transferred to ally with stable target metadata"` | 复核四宫格在线结构 | `1 skipped` | ⚠️ |
ADD progress.md:477 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 简单开局整文件 E2E | `npm run test:e2e:ci -- e2e/dicethrone-simple-start.e2e.ts` | 复核整份 8 条在线链路 | `8 skipped` | ⚠️ |
ADD progress.md:478 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:479 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Conclusion
ADD progress.md:480 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 当前 UI 结构已经改成用户要求的“四宫格 + 锁定来源卡”。
ADD progress.md:481 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 这轮 E2E 包装器没有给出新的在线证据，因此本次只确认组件层和类型层通过，在线截图需后续环境恢复后补证。
ADD progress.md:482 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:483 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Session: 2026-03-27 DiceThrone 联机导航重试与四宫格在线证据恢复
ADD progress.md:484 | OK 文档/记录/证据，对运行逻辑无直接影响 | - **Status:** completed
ADD progress.md:485 | OK 文档/记录/证据，对运行逻辑无直接影响 | - Actions taken:
ADD progress.md:486 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 先手动起单 worker E2E 服务并直接探针 `/games/dicethrone/create`、`/claim-seat`、`/join`，确认服务端联机接口本身正常。
ADD progress.md:487 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 再用最小 Playwright 探针复现 `setupDTOnlineMatchWithPlayers()` 返回 `null` 的真实根因：`page.goto(/play/dicethrone/match/...)` 偶发抛出 `net::ERR_INSUFFICIENT_RESOURCES`，被 helper 吞掉后伪装成 `skip`。
ADD progress.md:488 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 在 `e2e/helpers/dicethrone.ts` 中新增 `gotoWithRetry()`，仅对联机 match 页导航加入瞬时错误重试，兜住 `ERR_INSUFFICIENT_RESOURCES` / `ERR_ABORTED` / `NS_BINDING_ABORTED`。
ADD progress.md:489 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 复跑 4 人 `Transfer Status` 单用例和整份 `e2e/dicethrone-simple-start.e2e.ts`，确认 `skip` 已消失，8 条用例重新全部通过。
ADD progress.md:490 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 自审最新 `06-four-player-transfer-token-target-selection.png`，确认第二阶段真实呈现为 2x2 四宫格，`P2` 以锁定来源卡留在原位，另外 `P1/P3/P4` 为可选目标。
ADD progress.md:491 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:492 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Test Results
ADD progress.md:493 | OK 文档/记录/证据，对运行逻辑无直接影响 | | Test | Input | Expected | Actual | Status |
ADD progress.md:494 | OK 文档/记录/证据，对运行逻辑无直接影响 | |------|-------|----------|--------|--------|
ADD progress.md:495 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 4 人 transfer token 单用例 E2E | `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player transfer token: enemy token can be transferred to ally with stable target metadata"` | 消除假 `skip`，恢复真实在线断言 | `1 passed` | ✅ |
ADD progress.md:496 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 简单开局整文件 E2E | `npm run test:e2e:ci -- e2e/dicethrone-simple-start.e2e.ts` | 含四宫格版本 transfer token 在内的 8 条在线链路全部通过 | `8 passed` | ✅ |
ADD progress.md:497 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:498 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Evidence
ADD progress.md:499 | OK 文档/记录/证据，对运行逻辑无直接影响 | | Artifact | Absolute Path | Notes |
ADD progress.md:500 | OK 文档/记录/证据，对运行逻辑无直接影响 | |----------|---------------|-------|
ADD progress.md:501 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 4 人 transfer token 第二阶段四宫格截图 | `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-4-player-transfer-token-enemy-token-can-be-transferred-to-ally-with-stable-target-metadata\06-four-player-transfer-token-target-selection.png` | 自审确认为 2x2 四宫格；`P2` 卡显示 `ENEMY / 已选来源` 且锁定，未再退回“来源摘要块” |
ADD progress.md:502 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:503 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Session: 2026-03-27 DiceThrone 2 人 Transfer Status 在线证据补齐
ADD progress.md:504 | OK 文档/记录/证据，对运行逻辑无直接影响 | - **Status:** in_progress
ADD progress.md:505 | OK 文档/记录/证据，对运行逻辑无直接影响 | - Actions taken:
ADD progress.md:506 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 确认 `src/games/dicethrone/ui/InteractionOverlay.tsx` 的 `selectTargetStatus` 第二阶段是共享实现，2 人与 4 人都会走同一套“四宫格 + 锁定来源卡”结构。
ADD progress.md:507 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 在 `e2e/dicethrone-simple-start.e2e.ts` 新增 2 人 `Transfer Status` 在线用例，断言来源卡 `dt-transfer-source-locked-1`、目标卡 `dt-transfer-target-0` 与交互结束后的 token 转移结果。
ADD progress.md:508 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 复跑 `InteractionOverlay` 组件测试，确认共享层回归仍为 `18 passed`。
ADD progress.md:509 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 用 `node --import tsx -` 直接调用 `setupDTOnlineMatch()`，已确认在当前 `6174/20000/21000` 环境下可以成功创建并返回联机房间。
ADD progress.md:510 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 当前 blocker 已收敛为 Playwright 运行链路中的 `skip` 口径问题，而不是 2 人转移 UI 或联机 helper 整体失效。
ADD progress.md:511 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:512 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Test Results
ADD progress.md:513 | OK 文档/记录/证据，对运行逻辑无直接影响 | | Test | Input | Expected | Actual | Status |
ADD progress.md:514 | OK 文档/记录/证据，对运行逻辑无直接影响 | |------|-------|----------|--------|--------|
ADD progress.md:515 | OK 文档/记录/证据，对运行逻辑无直接影响 | | InteractionOverlay 组件回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx --configLoader native` | 2 人/4 人共享转移 UI 仍稳定 | `18 passed` | ✅ |
ADD progress.md:516 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 2 人联机 setup 直接探针 | `node --import tsx -` 调用 `setupDTOnlineMatch()` | helper 成功返回对局 setup | `OK <matchId>` | ✅ |
ADD progress.md:517 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 2 人转移 token 在线单用例 | `Playwright + simple-start 新用例` | 获得真实在线证据 | 当前仍被 `skip`，根因待继续下钻 | ⚠️ |
ADD progress.md:518 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:519 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Conclusion
ADD progress.md:520 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 2 人 `Transfer Status` 已经跟着共享层一起改到四宫格。
ADD progress.md:521 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 当前仍未完成的是“把现役 Playwright 链路里的 2 人单用例打绿”，不是业务 UI 语义本身。
ADD progress.md:522 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:523 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Session: 2026-03-27 DiceThrone 2 人联机 setup 顺序与直连状态注入修复
ADD progress.md:524 | OK 文档/记录/证据，对运行逻辑无直接影响 | - **Status:** completed
ADD progress.md:525 | OK 文档/记录/证据，对运行逻辑无直接影响 | - Actions taken:
ADD progress.md:526 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 把 `setupDTOnlineMatchWithPlayers()` 改成“全员进入 match 页后再统一等待选角 UI”，修掉 host 在房间未满员时提前等待角色选择页而导致的假 `skip`。
ADD progress.md:527 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 在 `e2e/helpers/common.ts` 为 `initContext()` / `injectDirectGameServerUrl()` 增加显式 `gameServerBaseURL` override，让 DiceThrone 在线 helper 创建的浏览器页与 API 同时直连 `20000`。
ADD progress.md:528 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 在 `e2e/helpers/state-injection.ts` 中把 `/test/*` 状态注入基地址改成优先跟随页面里的 `__FORCE_GAME_SERVER_URL__`，消除“浏览器页连 `20000`，状态注入却打 `18000`”的分叉。
ADD progress.md:529 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 修正 2 人 `Transfer Status` 在线用例的双阶段断言：先点击第一阶段 `dt-status-effect-1-crit`，再验证第二阶段锁定来源卡与目标卡。
ADD progress.md:530 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 自审新增 2 人截图 `01-two-player-transfer-token-target-selection.png`，确认画面真实展示 `P2` 锁定来源卡 + `P1` 唯一目标卡，而不是只靠 selector 断言。
ADD progress.md:531 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:532 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Test Results
ADD progress.md:533 | OK 文档/记录/证据，对运行逻辑无直接影响 | | Test | Input | Expected | Actual | Status |
ADD progress.md:534 | OK 文档/记录/证据，对运行逻辑无直接影响 | |------|-------|----------|--------|--------|
ADD progress.md:535 | OK 文档/记录/证据，对运行逻辑无直接影响 | | TypeScript 类型检查 | `node .\node_modules\typescript\lib\tsc.js --noEmit --pretty false` | 无类型错误 | 无输出 | ✅ |
ADD progress.md:536 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 2 人 transfer token 单用例 E2E | `$env:PW_USE_DEV_SERVERS='true'; $env:PW_START_SERVERS='false'; $env:PW_HAS_EXPLICIT_TARGET='true'; $env:NODE_OPTIONS='--max-old-space-size=4096'; $env:VITE_DEV_PORT='6174'; $env:GAME_SERVER_PORT='20000'; $env:API_SERVER_PORT='21000'; node .\node_modules\@playwright\test\cli.js test e2e/dicethrone-simple-start.e2e.ts --grep "Online 2-player transfer token: transfer phase keeps locked source card and target card"` | 2 人第二阶段锁定来源卡在线通过 | `1 passed` | ✅ |
ADD progress.md:537 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 4 人 transfer token 回归 | `$env:PW_USE_DEV_SERVERS='true'; $env:PW_START_SERVERS='false'; $env:PW_HAS_EXPLICIT_TARGET='true'; $env:NODE_OPTIONS='--max-old-space-size=4096'; $env:VITE_DEV_PORT='6174'; $env:GAME_SERVER_PORT='20000'; $env:API_SERVER_PORT='21000'; node .\node_modules\@playwright\test\cli.js test e2e/dicethrone-simple-start.e2e.ts --grep "Online 4-player transfer token: enemy token can be transferred to ally with stable target metadata"` | helper 修复不带坏 4 人主链路 | `1 passed` | ✅ |
ADD progress.md:538 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 简单开局整文件 E2E | `$env:PW_USE_DEV_SERVERS='true'; $env:PW_START_SERVERS='false'; $env:PW_HAS_EXPLICIT_TARGET='true'; $env:NODE_OPTIONS='--max-old-space-size=4096'; $env:VITE_DEV_PORT='6174'; $env:GAME_SERVER_PORT='20000'; $env:API_SERVER_PORT='21000'; node .\node_modules\@playwright\test\cli.js test e2e/dicethrone-simple-start.e2e.ts` | 2 人 + 4 人 + 2v2 共 9 条在线链路全部通过 | `9 passed` | ✅ |
ADD progress.md:539 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:540 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Evidence
ADD progress.md:541 | OK 文档/记录/证据，对运行逻辑无直接影响 | | Artifact | Absolute Path | Notes |
ADD progress.md:542 | OK 文档/记录/证据，对运行逻辑无直接影响 | |----------|---------------|-------|
ADD progress.md:543 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 2 人 transfer token 第二阶段截图 | `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-2-player-transfer-token-transfer-phase-keeps-locked-source-card-and-target-card\01-two-player-transfer-token-target-selection.png` | 自审确认 `P2` 卡以锁定来源态保留，`P1` 为唯一真实目标卡 |
ADD progress.md:544 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:545 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Note
ADD progress.md:546 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 在连续多次直接 CLI 复跑时，仍偶发出现整份文件瞬时 `skip`，但同口径手工探针与已拿到的 `9 passed` 结果都表明这是 runner/环境抖动，不是本轮代码逻辑回退。
ADD progress.md:547 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:548 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Session: 2026-03-27 DiceThrone remove-status 在线证据补齐与默认脚本回归
ADD progress.md:549 | OK 文档/记录/证据，对运行逻辑无直接影响 | - **Status:** completed
ADD progress.md:550 | OK 文档/记录/证据，对运行逻辑无直接影响 | - Actions taken:
ADD progress.md:551 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 保留既有 2 人 / 4 人 `Transfer Status` 与 `Consecrate` 在线场景不动，继续在现有 `e2e/dicethrone-simple-start.e2e.ts` 中推进 `remove-status-1` 与 `remove-all-status` 的 4 人在线链路。
ADD progress.md:552 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 针对目标页偶发“比 host 慢半拍”的权威态广播问题，只在 E2E 断言层补 `targetPage.waitForFunction()`，不修改 DiceThrone 领域逻辑。
ADD progress.md:553 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 用默认 `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts` 口径复跑整文件，确认不依赖手工环境变量时也能直接得到有效在线结果。
ADD progress.md:554 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 将 `08-four-player-remove-single-status-selection.png` 与 `09-four-player-remove-all-status-selection.png` 补入证据文档，并把整文件结果更新为 `11 passed`。
ADD progress.md:555 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:556 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Test Results
ADD progress.md:557 | OK 文档/记录/证据，对运行逻辑无直接影响 | | Test | Input | Expected | Actual | Status |
ADD progress.md:558 | OK 文档/记录/证据，对运行逻辑无直接影响 | |------|-------|----------|--------|--------|
ADD progress.md:559 | OK 文档/记录/证据，对运行逻辑无直接影响 | | TypeScript 类型检查 | `node .\node_modules\typescript\lib\tsc.js --noEmit --pretty false` | 无类型错误 | 无输出 | ✅ |
ADD progress.md:560 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 简单开局整文件 E2E（默认脚本） | `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts` | 2 人、4 人、2v2、转移、授 token、移除状态共 11 条在线链路全部通过 | `11 passed` | ✅ |
ADD progress.md:561 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:562 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Evidence
ADD progress.md:563 | OK 文档/记录/证据，对运行逻辑无直接影响 | | Artifact | Absolute Path | Notes |
ADD progress.md:564 | OK 文档/记录/证据，对运行逻辑无直接影响 | |----------|---------------|-------|
ADD progress.md:565 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 4 人 remove single status 目标选择截图 | `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-4-player-remove-single-status-remove-status-1-can-remove-enemy-token-with-stable-owner-metadata\08-four-player-remove-single-status-selection.png` | 自审确认敌方拥有者卡仍按 4 人语义显示，点击 `Crit` 后最终 host/目标页都同步为 `crit=0` |
ADD progress.md:566 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 4 人 remove all status 目标选择截图 | `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-4-player-remove-all-status-remove-all-status-blocks-empty-targets-and-clears-enemy-removable-effects\09-four-player-remove-all-status-selection.png` | 自审确认空目标被禁用，敌方 `burn/crit` 可被整组移除 |
ADD progress.md:567 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:568 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Session: 2026-03-27 DiceThrone Batch 1 spec 拆分与 Vengeance II 共享流程收口
ADD progress.md:569 | OK 文档/记录/证据，对运行逻辑无直接影响 | - **Status:** completed
ADD progress.md:570 | OK 文档/记录/证据，对运行逻辑无直接影响 | - Actions taken:
ADD progress.md:571 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 将 `update-dicethrone-4p-player-target-interactions/spec.md` 从单一总括 requirement 拆成 4 个 Batch 1 requirement，分别覆盖：任意玩家授 token、任意玩家移除状态、状态 / 可移除 token 转移、无单一敌方目标的无伤害技能流程兼容。
ADD progress.md:572 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 把 `Vengeance II` 这轮真实修复纳入 Batch 1：共享攻击流程已兼容“无默认 defender、无伤害、但仍会触发玩家交互 / postDamage”的 4 人技能，不再误进 `targetingRoll`，也不会吞掉 `INTERACTION_REQUESTED`。
ADD progress.md:573 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 回填 `tasks.md`、`evidence/dicethrone-simple-start-e2e-test.md`、`findings.md` 与 `task_plan.md`，把 Batch 1 当前真实覆盖边界从“泛指多人目标交互”收紧为已落地的代表性入口集合。
ADD progress.md:574 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 补入 4 人 `Vengeance II` 在线截图 `10-four-player-vengeance-2-target-selection.png`，并把证据文档中的默认整文件结果更新为 12 条在线用例。
ADD progress.md:575 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 修复当前 worktree 的依赖树残缺问题：按锁文件版本补回 `vitest`、`typescript`、`dotenv` 等缺失包入口文件，使 `tsc`、Vitest 与 E2E 启动器恢复可执行。
ADD progress.md:576 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:577 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Test Results
ADD progress.md:578 | OK 文档/记录/证据，对运行逻辑无直接影响 | | Test | Input | Expected | Actual | Status |
ADD progress.md:579 | OK 文档/记录/证据，对运行逻辑无直接影响 | |------|-------|----------|--------|--------|
ADD progress.md:580 | OK 文档/记录/证据，对运行逻辑无直接影响 | | OpenSpec 严格校验 | `openspec validate update-dicethrone-4p-player-target-interactions --strict --no-interactive` | Batch 1 拆分后的 spec 仍满足 OpenSpec 格式 | `valid` | ✅ |
ADD progress.md:581 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 规则回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/rule-consistency.test.ts --configLoader native` | 4 人玩家目标交互与无 defender 流程回归通过 | `31 passed` | ✅ |
ADD progress.md:582 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 简单开局整文件 E2E | `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts` | 12 条在线用例全部通过 | `12 passed` | ✅ |
ADD progress.md:583 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:584 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Evidence
ADD progress.md:585 | OK 文档/记录/证据，对运行逻辑无直接影响 | | Artifact | Absolute Path | Notes |
ADD progress.md:586 | OK 文档/记录/证据，对运行逻辑无直接影响 | |----------|---------------|-------|
ADD progress.md:587 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 4 人 Vengeance II 目标选择截图 | `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-4-player-ability-grant-token-Vengeance-II-can-grant-Retribution-to-ally-with-stable-target-metadata\10-four-player-vengeance-2-target-selection.png` | 自审目标选择面板中 `P1/P2/P3/P4` 均可区分，队友 `P3` 被选中后可稳定获得 `Retribution` |
ADD progress.md:588 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:589 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Next Step
ADD progress.md:590 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 若继续推进玩家目标交互专项，应进入 Batch 2，继续盘点尚未纳入 Batch 1 的其余英雄/卡牌入口，而不是再把 Batch 1 说成“全量多人能力审计完成”。
ADD progress.md:591 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:592 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Session: 2026-03-28 DiceThrone 旧专项 E2E 收敛启动
ADD progress.md:593 | OK 文档/记录/证据，对运行逻辑无直接影响 | - **Status:** in_progress
ADD progress.md:594 | OK 文档/记录/证据，对运行逻辑无直接影响 | - Actions taken:
ADD progress.md:595 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 切回正确 worktree `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode`，确认这边才存在 `update-dicethrone-4p-player-target-interactions` 与相关 Batch 1 产物。
ADD progress.md:596 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 重新核对 `playwright.config.ts` 的 `LEGACY_DISCOVERY_BROKEN_TESTS`，确认当前被显式忽略的 DiceThrone 旧专项文件包括 `dicethrone-paladin-vengeance-select-player.e2e.ts`、`dicethrone-status-interaction-cancel.e2e.ts`、`dicethrone-status-interaction-complete.e2e.ts`。
ADD progress.md:597 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 复查旧文件内容与之前实跑结论，已确认：
ADD progress.md:598 | OK 文档/记录/证据，对运行逻辑无直接影响 |     - `status-interaction-complete` 还有共享交互 UI 契约价值，但实现还是旧 harness / 旧 selector 口径；
ADD progress.md:599 | OK 文档/记录/证据，对运行逻辑无直接影响 |     - `status-removal` 已与现役页面结构严重脱节；
ADD progress.md:600 | OK 文档/记录/证据，对运行逻辑无直接影响 |     - `status-interaction-cancel` 与 `status-interaction-complete` 高度重复；
ADD progress.md:601 | OK 文档/记录/证据，对运行逻辑无直接影响 |     - `paladin-vengeance-select-player` 已被 `simple-start` 中的 4 人 `Vengeance II` 在线证据覆盖。
ADD progress.md:602 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 已在三件套中记录本轮收敛方案：保留并现代化 `status-interaction-complete`，退役另外三份旧专项文件，并同步清理 Playwright ignore。
ADD progress.md:603 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:604 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Current Focus
ADD progress.md:605 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 将 `dicethrone-status-interaction-complete.e2e.ts` 改写为现役可运行套件，覆盖共享交互层当前仍需要独立守住的 UI 契约。
ADD progress.md:606 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 删除三份已确认无继续维护价值的旧专项 E2E，并清理配置。
ADD progress.md:607 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:608 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Session: 2026-03-28 DiceThrone 旧专项 E2E 收敛完成
ADD progress.md:609 | OK 文档/记录/证据，对运行逻辑无直接影响 | - **Status:** completed
ADD progress.md:610 | OK 文档/记录/证据，对运行逻辑无直接影响 | - Actions taken:
ADD progress.md:611 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 将 `e2e/dicethrone-status-interaction-complete.e2e.ts` 整体重写为现役共享交互契约 E2E，统一改用 `./framework`、`game.openTestGame()`、当前 `dt-*` 选择器与 `sys.interaction.current.kind='dt:card-interaction'` 包装结构。
ADD progress.md:612 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 新套件收口为 4 条高价值断言：
ADD progress.md:613 | OK 文档/记录/证据，对运行逻辑无直接影响 |     - `selectStatus` 状态徽章选择与取消关闭；
ADD progress.md:614 | OK 文档/记录/证据，对运行逻辑无直接影响 |     - `selectStatus` token 路径也走同一套 `dt-status-effect-*`；
ADD progress.md:615 | OK 文档/记录/证据，对运行逻辑无直接影响 |     - `selectPlayer` 的空目标禁用与“无状态”提示；
ADD progress.md:616 | OK 文档/记录/证据，对运行逻辑无直接影响 |     - `selectTargetStatus` 第二阶段的锁定来源卡与真实目标卡结构。
ADD progress.md:617 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 正式退役 3 份旧专项文件：
ADD progress.md:618 | OK 文档/记录/证据，对运行逻辑无直接影响 |     - `e2e/dicethrone-status-removal.e2e.ts`
ADD progress.md:619 | OK 文档/记录/证据，对运行逻辑无直接影响 |     - `e2e/dicethrone-status-interaction-cancel.e2e.ts`
ADD progress.md:620 | OK 文档/记录/证据，对运行逻辑无直接影响 |     - `e2e/dicethrone-paladin-vengeance-select-player.e2e.ts`
ADD progress.md:621 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 同步更新 `playwright.config.ts`，移除上述 DiceThrone 旧专项对应的 legacy ignore。
ADD progress.md:622 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:623 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Test Results
ADD progress.md:624 | OK 文档/记录/证据，对运行逻辑无直接影响 | | Test | Input | Expected | Actual | Status |
ADD progress.md:625 | OK 文档/记录/证据，对运行逻辑无直接影响 | |------|-------|----------|--------|--------|
ADD progress.md:626 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 新版共享交互契约 E2E | `npm run test:e2e:ci:file -- e2e/dicethrone-status-interaction-complete.e2e.ts` | 旧专项保留件应恢复为现役可运行套件 | `4 passed` | ✅ |
ADD progress.md:627 | OK 文档/记录/证据，对运行逻辑无直接影响 | | `simple-start` 主证据回归 | `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts` | 收敛旧专项后不带坏 12 条现役在线主链路 | `11 passed, 1 skipped` | ⚠️ |
ADD progress.md:628 | OK 文档/记录/证据，对运行逻辑无直接影响 | | targeting roll 单用例复核 | `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player targeting roll: auto targets and choice owners stay correct in 2v2"` | 复核跳过是否为真实回归 | `1 skipped` | ⚠️ |
ADD progress.md:629 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:630 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Conclusion
ADD progress.md:631 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 旧专项 E2E 的代码级收敛已完成，新保留套件稳定可跑，不再是 `No tests found` 或旧 selector 状态。
ADD progress.md:632 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `simple-start` 的异常仍表现为既有测试基础设施抖动：调试日志出现 `game_server_unavailable`、`ECONNREFUSED 127.0.0.1:20000`，另一次复跑则在 global setup 阶段遇到 Vite 前端进程异常退出。当前没有证据表明这与本轮收敛改动存在功能因果关系。
ADD progress.md:633 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:634 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Session: 2026-03-28 DiceThrone Batch 1 最终复核
ADD progress.md:635 | OK 文档/记录/证据，对运行逻辑无直接影响 | - **Status:** completed
ADD progress.md:636 | OK 文档/记录/证据，对运行逻辑无直接影响 | - Actions taken:
ADD progress.md:637 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 在当前 worktree 里补齐依赖树，恢复 `typescript`、`vitest`、`dotenv`、`playwright` 等验证入口，使 `tsc`、Vitest 和 E2E 启动器重新可执行。
ADD progress.md:638 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 将 `scripts/infra/vitest-cli-safe.mjs` 改为兼容新版 Vitest 包结构：优先走旧版 `vitest.mjs`，否则自动解析 `dist/chunks/cac.*.js + cli-api.*.js` 调用 CLI。
ADD progress.md:639 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 修正 `Consecrate` 在线用例的多页同步口径：在 host 页确认 4 个 token 写入后，再显式等待 ally 页权威态追平，再读取 harness state 断言。
ADD progress.md:640 | OK 文档/记录/证据，对运行逻辑无直接影响 |   - 重新执行 OpenSpec 严格校验、DiceThrone 规则回归和 `simple-start` 整文件 E2E，确认 Batch 1 当前最终口径真实为全绿。
ADD progress.md:641 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:642 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Test Results
ADD progress.md:643 | OK 文档/记录/证据，对运行逻辑无直接影响 | | Test | Input | Expected | Actual | Status |
ADD progress.md:644 | OK 文档/记录/证据，对运行逻辑无直接影响 | |------|-------|----------|--------|--------|
ADD progress.md:645 | OK 文档/记录/证据，对运行逻辑无直接影响 | | TypeScript 类型检查 | `node .\node_modules\typescript\lib\tsc.js --noEmit --pretty false` | 无类型错误 | 无输出 | ✅ |
ADD progress.md:646 | OK 文档/记录/证据，对运行逻辑无直接影响 | | OpenSpec 严格校验 | `openspec validate update-dicethrone-4p-player-target-interactions --strict --no-interactive` | Batch 1 spec / tasks / design 仍满足格式要求 | `valid` | ✅ |
ADD progress.md:647 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 规则回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/rule-consistency.test.ts --configLoader native` | 4 人玩家目标交互与无 defender 流程回归通过 | `31 passed` | ✅ |
ADD progress.md:648 | OK 文档/记录/证据，对运行逻辑无直接影响 | | 简单开局整文件 E2E | `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts` | 12 条在线用例全部通过 | `12 passed` | ✅ |
ADD progress.md:649 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD progress.md:650 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Conclusion
ADD progress.md:651 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `update-dicethrone-4p-player-target-interactions` 当前 Batch 1 口径已经重新落回真实完成态，不再停留在“文档写 completed、但本地命令起不来”。
ADD progress.md:652 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `Consecrate` 串跑时的最后一个不稳定点已收口为测试层等待问题，而不是业务逻辑回退；修正后 `simple-start` 重新回到 `12 passed`。
ADD public/locales/en/game-dicethrone.json:590 | OK 文案/本地化变更 |     "game_already_started": "The match has already started, so seating and ready state can no longer be changed",
ADD public/locales/en/game-dicethrone.json:591 | OK 文案/本地化变更 |     "not_team_mode": "The current match is not in 2v2 mode",
ADD public/locales/en/game-dicethrone.json:592 | OK 文案/本地化变更 |     "invalid_seat_target": "Invalid empty seat target",
ADD public/locales/en/game-dicethrone.json:593 | OK 文案/本地化变更 |     "seat_not_changed": "Please choose a different empty slot",
DEL public/locales/en/game-dicethrone.json:716 | OK 文案/本地化变更 |     "opponent": "Opponent"
ADD public/locales/en/game-dicethrone.json:720 | OK 文案/本地化变更 |     "opponent": "Opponent",
ADD public/locales/en/game-dicethrone.json:721 | OK 文案/本地化变更 |     "ally": "Ally",
ADD public/locales/en/game-dicethrone.json:722 | OK 文案/本地化变更 |     "enemy": "Enemy"
DEL public/locales/en/game-dicethrone.json:2368 | OK 文案/本地化变更 |     "you": "You"
ADD public/locales/en/game-dicethrone.json:2374 | OK 文案/本地化变更 |     "you": "You",
ADD public/locales/en/game-dicethrone.json:2375 | OK 文案/本地化变更 |     "seating": {
ADD public/locales/en/game-dicethrone.json:2376 | OK 文案/本地化变更 |       "title": "2v2 Seating",
ADD public/locales/en/game-dicethrone.json:2377 | OK 文案/本地化变更 |       "hostTip": "Click a player first, then click an empty slot to move them. Swapping seats is not allowed.",
ADD public/locales/en/game-dicethrone.json:2378 | OK 文案/本地化变更 |       "readOnly": "Only the host can edit seating. Other players can view it only.",
ADD public/locales/en/game-dicethrone.json:2379 | OK 文案/本地化变更 |       "moveHint": "{{player}} selected. Click an empty slot to finish the move.",
ADD public/locales/en/game-dicethrone.json:2380 | OK 文案/本地化变更 |       "occupied": "That position is already occupied. Seat swapping is not supported.",
ADD public/locales/en/game-dicethrone.json:2381 | OK 文案/本地化变更 |       "emptySlot": "Empty",
ADD public/locales/en/game-dicethrone.json:2382 | OK 文案/本地化变更 |       "currentSlot": "Current slot",
ADD public/locales/en/game-dicethrone.json:2383 | OK 文案/本地化变更 |       "cancel": "Cancel",
ADD public/locales/en/game-dicethrone.json:2384 | OK 文案/本地化变更 |       "seatNumber": "Seat {{seat}}",
ADD public/locales/en/game-dicethrone.json:2385 | OK 文案/本地化变更 |       "teamA": "Team A",
ADD public/locales/en/game-dicethrone.json:2386 | OK 文案/本地化变更 |       "teamB": "Team B",
ADD public/locales/en/game-dicethrone.json:2387 | OK 文案/本地化变更 |       "targetOptionDisabled": "Unavailable"
ADD public/locales/en/game-dicethrone.json:2388 | OK 文案/本地化变更 |     }
DEL public/locales/zh-CN/game-dicethrone.json:373 | OK 文案/本地化变更 |     "you": "你"
ADD public/locales/zh-CN/game-dicethrone.json:373 | OK 文案/本地化变更 |     "you": "你",
ADD public/locales/zh-CN/game-dicethrone.json:374 | OK 文案/本地化变更 |     "seating": {
ADD public/locales/zh-CN/game-dicethrone.json:375 | OK 文案/本地化变更 |       "title": "2v2 站位",
ADD public/locales/zh-CN/game-dicethrone.json:376 | OK 文案/本地化变更 |       "hostTip": "点击任意玩家头像，再点击空位完成移动。不支持交换位。",
ADD public/locales/zh-CN/game-dicethrone.json:377 | OK 文案/本地化变更 |       "readOnly": "仅房主可调整站位，其他玩家只读查看。",
ADD public/locales/zh-CN/game-dicethrone.json:378 | OK 文案/本地化变更 |       "moveHint": "已选中 {{player}}，点击空位完成移动。",
ADD public/locales/zh-CN/game-dicethrone.json:379 | OK 文案/本地化变更 |       "occupied": "该位置已有玩家，不支持交换位。",
ADD public/locales/zh-CN/game-dicethrone.json:380 | OK 文案/本地化变更 |       "emptySlot": "空位",
ADD public/locales/zh-CN/game-dicethrone.json:381 | OK 文案/本地化变更 |       "currentSlot": "当前位置",
ADD public/locales/zh-CN/game-dicethrone.json:382 | OK 文案/本地化变更 |       "cancel": "取消",
ADD public/locales/zh-CN/game-dicethrone.json:383 | OK 文案/本地化变更 |       "seatNumber": "{{seat}}号位",
ADD public/locales/zh-CN/game-dicethrone.json:384 | OK 文案/本地化变更 |       "teamA": "A 队",
ADD public/locales/zh-CN/game-dicethrone.json:385 | OK 文案/本地化变更 |       "teamB": "B 队",
ADD public/locales/zh-CN/game-dicethrone.json:386 | OK 文案/本地化变更 |       "targetOptionDisabled": "不可选"
ADD public/locales/zh-CN/game-dicethrone.json:387 | OK 文案/本地化变更 |     }
ADD public/locales/zh-CN/game-dicethrone.json:619 | OK 文案/本地化变更 |     "game_already_started": "对局已经开始，不能再调整站位或准备状态",
ADD public/locales/zh-CN/game-dicethrone.json:620 | OK 文案/本地化变更 |     "not_team_mode": "当前不是 2v2 模式",
ADD public/locales/zh-CN/game-dicethrone.json:621 | OK 文案/本地化变更 |     "invalid_seat_target": "目标空位无效",
ADD public/locales/zh-CN/game-dicethrone.json:622 | OK 文案/本地化变更 |     "seat_not_changed": "请选择新的空位",
DEL public/locales/zh-CN/game-dicethrone.json:689 | OK 文案/本地化变更 |     "opponent": "对手"
ADD public/locales/zh-CN/game-dicethrone.json:707 | OK 文案/本地化变更 |     "opponent": "对手",
ADD public/locales/zh-CN/game-dicethrone.json:708 | OK 文案/本地化变更 |     "ally": "队友",
ADD public/locales/zh-CN/game-dicethrone.json:709 | OK 文案/本地化变更 |     "enemy": "敌方"
DEL scripts/infra/vite-with-logging.js:99 | 注意 工具链/脚本改动，需核对执行口径 | const shouldForceInline = process.env.BG_VITE_FORCE_INLINE === '1' || !process.stdin.isTTY;
ADD scripts/infra/vite-with-logging.js:99 | 注意 工具链/脚本改动，需核对执行口径 | const shouldForceInline = process.env.BG_VITE_FORCE_INLINE === '1';
DEL scripts/infra/vite-with-logging.js:104 | 注意 工具链/脚本改动，需核对执行口径 |   const reason = process.env.BG_VITE_FORCE_INLINE === '1'
DEL scripts/infra/vite-with-logging.js:105 | 注意 工具链/脚本改动，需核对执行口径 |     ? 'BG_VITE_FORCE_INLINE=1'
DEL scripts/infra/vite-with-logging.js:106 | 注意 工具链/脚本改动，需核对执行口径 |     : 'stdin is not a TTY';
ADD scripts/infra/vite-with-logging.js:104 | 注意 工具链/脚本改动，需核对执行口径 |   const reason = 'BG_VITE_FORCE_INLINE=1';
ADD scripts/infra/vitest-cli-safe.mjs:3 | 注意 工具链/脚本改动，需核对执行口径 | import { existsSync, readdirSync } from 'node:fs';
ADD scripts/infra/vitest-cli-safe.mjs:4 | 注意 工具链/脚本改动，需核对执行口径 | import { fileURLToPath, pathToFileURL } from 'node:url';
DEL scripts/infra/vitest-cli-safe.mjs:36 | 注意 工具链/脚本改动，需核对执行口径 | await import(new URL('../../node_modules/vitest/vitest.mjs', import.meta.url));
ADD scripts/infra/vitest-cli-safe.mjs:38 | 注意 工具链/脚本改动，需核对执行口径 | const vitestRootUrl = new URL('../../node_modules/vitest/', import.meta.url);
ADD scripts/infra/vitest-cli-safe.mjs:39 | 注意 工具链/脚本改动，需核对执行口径 | const legacyEntryUrl = new URL('vitest.mjs', vitestRootUrl);
ADD scripts/infra/vitest-cli-safe.mjs:40 | 注意 工具链/脚本改动，需核对执行口径 | 
ADD scripts/infra/vitest-cli-safe.mjs:41 | 注意 工具链/脚本改动，需核对执行口径 | if (existsSync(fileURLToPath(legacyEntryUrl))) {
ADD scripts/infra/vitest-cli-safe.mjs:42 | 注意 工具链/脚本改动，需核对执行口径 |     await import(legacyEntryUrl);
ADD scripts/infra/vitest-cli-safe.mjs:43 | 注意 工具链/脚本改动，需核对执行口径 | } else {
ADD scripts/infra/vitest-cli-safe.mjs:44 | 注意 工具链/脚本改动，需核对执行口径 |     const vitestChunksDir = fileURLToPath(new URL('dist/chunks/', vitestRootUrl));
ADD scripts/infra/vitest-cli-safe.mjs:45 | 注意 工具链/脚本改动，需核对执行口径 |     const chunkNames = readdirSync(vitestChunksDir);
ADD scripts/infra/vitest-cli-safe.mjs:46 | 注意 工具链/脚本改动，需核对执行口径 |     const resolveChunkUrl = (prefix) => {
ADD scripts/infra/vitest-cli-safe.mjs:47 | 注意 工具链/脚本改动，需核对执行口径 |         const chunkName = chunkNames.find((name) => name.startsWith(prefix) && name.endsWith('.js'));
ADD scripts/infra/vitest-cli-safe.mjs:48 | 注意 工具链/脚本改动，需核对执行口径 |         if (!chunkName) {
ADD scripts/infra/vitest-cli-safe.mjs:49 | 注意 工具链/脚本改动，需核对执行口径 |             throw new Error(`Vitest CLI 入口不存在：${prefix}*（目录：${vitestChunksDir}）`);
ADD scripts/infra/vitest-cli-safe.mjs:50 | 注意 工具链/脚本改动，需核对执行口径 |         }
ADD scripts/infra/vitest-cli-safe.mjs:51 | 注意 工具链/脚本改动，需核对执行口径 |         return pathToFileURL(`${vitestChunksDir}\\${chunkName}`).href;
ADD scripts/infra/vitest-cli-safe.mjs:52 | 注意 工具链/脚本改动，需核对执行口径 |     };
ADD scripts/infra/vitest-cli-safe.mjs:53 | 注意 工具链/脚本改动，需核对执行口径 | 
ADD scripts/infra/vitest-cli-safe.mjs:54 | 注意 工具链/脚本改动，需核对执行口径 |     const [{ p: parseCLI }, cliApiModule] = await Promise.all([
ADD scripts/infra/vitest-cli-safe.mjs:55 | 注意 工具链/脚本改动，需核对执行口径 |         import(resolveChunkUrl('cac.')),
ADD scripts/infra/vitest-cli-safe.mjs:56 | 注意 工具链/脚本改动，需核对执行口径 |         import(resolveChunkUrl('cli-api.')),
ADD scripts/infra/vitest-cli-safe.mjs:57 | 注意 工具链/脚本改动，需核对执行口径 |     ]);
ADD scripts/infra/vitest-cli-safe.mjs:58 | 注意 工具链/脚本改动，需核对执行口径 | 
ADD scripts/infra/vitest-cli-safe.mjs:59 | 注意 工具链/脚本改动，需核对执行口径 |     const cliApi = cliApiModule.q ?? {};
ADD scripts/infra/vitest-cli-safe.mjs:60 | 注意 工具链/脚本改动，需核对执行口径 |     const startVitest = cliApi.startVitest ?? cliApiModule.s;
ADD scripts/infra/vitest-cli-safe.mjs:61 | 注意 工具链/脚本改动，需核对执行口径 |     if (typeof parseCLI !== 'function' || typeof startVitest !== 'function') {
ADD scripts/infra/vitest-cli-safe.mjs:62 | 注意 工具链/脚本改动，需核对执行口径 |         throw new Error('Vitest CLI 兼容加载失败：未找到 parseCLI 或 startVitest');
ADD scripts/infra/vitest-cli-safe.mjs:63 | 注意 工具链/脚本改动，需核对执行口径 |     }
ADD scripts/infra/vitest-cli-safe.mjs:64 | 注意 工具链/脚本改动，需核对执行口径 | 
ADD scripts/infra/vitest-cli-safe.mjs:65 | 注意 工具链/脚本改动，需核对执行口径 |     const args = process.argv.slice(2);
ADD scripts/infra/vitest-cli-safe.mjs:66 | 注意 工具链/脚本改动，需核对执行口径 |     const subcommand = args[0];
ADD scripts/infra/vitest-cli-safe.mjs:67 | 注意 工具链/脚本改动，需核对执行口径 |     const mode = subcommand === 'bench' || subcommand === 'benchmark' ? 'benchmark' : 'test';
ADD scripts/infra/vitest-cli-safe.mjs:68 | 注意 工具链/脚本改动，需核对执行口径 |     const { filter, options } = parseCLI(['vitest', ...args]);
ADD scripts/infra/vitest-cli-safe.mjs:69 | 注意 工具链/脚本改动，需核对执行口径 |     const ctx = await startVitest(mode, filter, options);
ADD scripts/infra/vitest-cli-safe.mjs:70 | 注意 工具链/脚本改动，需核对执行口径 |     if (ctx && typeof ctx.shouldKeepServer === 'function' && !ctx.shouldKeepServer()) {
ADD scripts/infra/vitest-cli-safe.mjs:71 | 注意 工具链/脚本改动，需核对执行口径 |         await ctx.exit();
ADD scripts/infra/vitest-cli-safe.mjs:72 | 注意 工具链/脚本改动，需核对执行口径 |     }
ADD scripts/infra/vitest-cli-safe.mjs:73 | 注意 工具链/脚本改动，需核对执行口径 | }
DEL server.ts:28 | 注意 引擎/服务逻辑变更，需核对副作用 | import { hasOccupiedPlayers } from './src/server/matchOccupancy';
ADD server.ts:28 | 注意 引擎/服务逻辑变更，需核对副作用 | import { areAllSeatsOccupied, hasOccupiedPlayers, isSupportedPlayerCount } from './src/server/matchOccupancy';
DEL server.ts:539 | 注意 引擎/服务逻辑变更，需核对副作用 |     const gameEngine = SERVER_ENGINES.find((engine) => normalizeGameName(engine.gameId) === gameName);
ADD server.ts:539 | 注意 引擎/服务逻辑变更，需核对副作用 |     const gameEntry = GAME_SERVER_MANIFEST.find((entry) => normalizeGameName(entry.manifest.id) === gameName);
ADD server.ts:540 | 注意 引擎/服务逻辑变更，需核对副作用 |     const gameEngine = gameEntry?.engineConfig;
DEL server.ts:545 | 注意 引擎/服务逻辑变更，需核对副作用 |     if (isNaN(numPlayers) || numPlayers < minPlayers || numPlayers > maxPlayers) {
ADD server.ts:546 | 注意 引擎/服务逻辑变更，需核对副作用 |     const playerOptions = gameEntry?.manifest.playerOptions;
ADD server.ts:547 | 注意 引擎/服务逻辑变更，需核对副作用 |     if (!isSupportedPlayerCount(numPlayers, minPlayers, maxPlayers, playerOptions)) {
DEL server.ts:761 | 注意 引擎/服务逻辑变更，需核对副作用 |         const allSeated = Object.values(metadata.players).every(p => p.name || p.credentials);
DEL server.ts:762 | 注意 引擎/服务逻辑变更，需核对副作用 |         if (allSeated) {
ADD server.ts:763 | 注意 引擎/服务逻辑变更，需核对副作用 |         if (areAllSeatsOccupied(metadata.players)) {
DEL src/games/dicethrone/Board.tsx:10 | 注意 代码变更需核对 | import { isCardPlayableInResponseWindow, getAvailableAbilityIds } from './domain/rules';
ADD src/games/dicethrone/Board.tsx:10 | 注意 代码变更需核对 | import { isCardPlayableInResponseWindow, getAvailableAbilityIds, getSeatingOrder, getOpponents, areTeammates } from './domain/rules';
DEL src/games/dicethrone/Board.tsx:139 | 注意 代码变更需核对 |     const otherPid = Object.keys(G.players).find(id => id !== rootPid) || '1';
ADD src/games/dicethrone/Board.tsx:139 | 注意 代码变更需核对 |     const currentPhase = access.turnPhase;
ADD src/games/dicethrone/Board.tsx:140 | 注意 代码变更需核对 |     const playerNames = React.useMemo(() => {
ADD src/games/dicethrone/Board.tsx:141 | 注意 代码变更需核对 |         const names: Record<string, string> = {};
ADD src/games/dicethrone/Board.tsx:142 | 注意 代码变更需核对 |         Object.keys(G.players).forEach(pid => {
ADD src/games/dicethrone/Board.tsx:143 | 注意 代码变更需核对 |             names[pid] = matchData?.find(p => String(p.id) === pid)?.name ?? t('common.opponent');
ADD src/games/dicethrone/Board.tsx:144 | 注意 代码变更需核对 |         });
ADD src/games/dicethrone/Board.tsx:145 | 注意 代码变更需核对 |         return names;
ADD src/games/dicethrone/Board.tsx:146 | 注意 代码变更需核对 |     }, [G.players, matchData, t]);
ADD src/games/dicethrone/Board.tsx:147 | 注意 代码变更需核对 |     const isResponseWindowOpen = !!rawG.sys.responseWindow?.current;
ADD src/games/dicethrone/Board.tsx:148 | 注意 代码变更需核对 |     const currentResponderIndex = rawG.sys.responseWindow?.current?.currentResponderIndex;
ADD src/games/dicethrone/Board.tsx:149 | 注意 代码变更需核对 |     const currentResponderId = rawG.sys.responseWindow?.current
ADD src/games/dicethrone/Board.tsx:150 | 注意 代码变更需核对 |         ? rawG.sys.responseWindow.current.responderQueue[rawG.sys.responseWindow.current.currentResponderIndex]
ADD src/games/dicethrone/Board.tsx:151 | 注意 代码变更需核对 |         : undefined;
ADD src/games/dicethrone/Board.tsx:152 | 注意 代码变更需核对 |     const playerOrder = React.useMemo(() => getSeatingOrder(G), [G]);
ADD src/games/dicethrone/Board.tsx:153 | 注意 代码变更需核对 |     const otherPids = React.useMemo(() => playerOrder.filter(pid => pid !== rootPid), [playerOrder, rootPid]);
ADD src/games/dicethrone/Board.tsx:154 | 注意 代码变更需核对 |     const defaultFocusedPid = React.useMemo(() => {
ADD src/games/dicethrone/Board.tsx:155 | 注意 代码变更需核对 |         const defensiveTargetPid = G.pendingAttack?.defenderId;
ADD src/games/dicethrone/Board.tsx:156 | 注意 代码变更需核对 |         if (defensiveTargetPid && defensiveTargetPid !== rootPid) {
ADD src/games/dicethrone/Board.tsx:157 | 注意 代码变更需核对 |             return defensiveTargetPid;
ADD src/games/dicethrone/Board.tsx:158 | 注意 代码变更需核对 |         }
ADD src/games/dicethrone/Board.tsx:159 | 注意 代码变更需核对 | 
ADD src/games/dicethrone/Board.tsx:160 | 注意 代码变更需核对 |         if (isResponseWindowOpen && currentResponderId === rootPid) {
ADD src/games/dicethrone/Board.tsx:161 | 注意 代码变更需核对 |             const responseSourcePid = G.pendingDamage?.sourcePlayerId ?? G.pendingAttack?.sourcePlayerId;
ADD src/games/dicethrone/Board.tsx:162 | 注意 代码变更需核对 |             if (responseSourcePid && responseSourcePid !== rootPid) {
ADD src/games/dicethrone/Board.tsx:163 | 注意 代码变更需核对 |                 return responseSourcePid;
ADD src/games/dicethrone/Board.tsx:164 | 注意 代码变更需核对 |             }
ADD src/games/dicethrone/Board.tsx:165 | 注意 代码变更需核对 |         }
ADD src/games/dicethrone/Board.tsx:166 | 注意 代码变更需核对 | 
ADD src/games/dicethrone/Board.tsx:167 | 注意 代码变更需核对 |         const activeOpponentPid = G.activePlayerId !== rootPid && !areTeammates(G, rootPid, G.activePlayerId)
ADD src/games/dicethrone/Board.tsx:168 | 注意 代码变更需核对 |             ? G.activePlayerId
ADD src/games/dicethrone/Board.tsx:169 | 注意 代码变更需核对 |             : undefined;
ADD src/games/dicethrone/Board.tsx:170 | 注意 代码变更需核对 | 
ADD src/games/dicethrone/Board.tsx:171 | 注意 代码变更需核对 |         return activeOpponentPid ?? getOpponents(G, rootPid)[0] ?? otherPids[0] ?? rootPid;
ADD src/games/dicethrone/Board.tsx:172 | 注意 代码变更需核对 |     }, [G, rootPid, isResponseWindowOpen, currentResponderId, otherPids]);
ADD src/games/dicethrone/Board.tsx:173 | 注意 代码变更需核对 |     const [focusedPid, setFocusedPid] = React.useState(() => defaultFocusedPid);
ADD src/games/dicethrone/Board.tsx:174 | 注意 代码变更需核对 |     const otherPid = focusedPid;
ADD src/games/dicethrone/Board.tsx:176 | 注意 代码变更需核对 |     const opponentName = playerNames[otherPid] ?? t('common.opponent');
ADD src/games/dicethrone/Board.tsx:177 | 注意 代码变更需核对 | 
ADD src/games/dicethrone/Board.tsx:178 | 注意 代码变更需核对 |     React.useEffect(() => {
ADD src/games/dicethrone/Board.tsx:179 | 注意 代码变更需核对 |         if (otherPids.length === 0) {
ADD src/games/dicethrone/Board.tsx:180 | 注意 代码变更需核对 |             return;
ADD src/games/dicethrone/Board.tsx:181 | 注意 代码变更需核对 |         }
ADD src/games/dicethrone/Board.tsx:182 | 注意 代码变更需核对 | 
ADD src/games/dicethrone/Board.tsx:183 | 注意 代码变更需核对 |         if (!otherPids.includes(focusedPid)) {
ADD src/games/dicethrone/Board.tsx:184 | 注意 代码变更需核对 |             setFocusedPid(defaultFocusedPid);
ADD src/games/dicethrone/Board.tsx:185 | 注意 代码变更需核对 |             return;
ADD src/games/dicethrone/Board.tsx:186 | 注意 代码变更需核对 |         }
ADD src/games/dicethrone/Board.tsx:187 | 注意 代码变更需核对 | 
ADD src/games/dicethrone/Board.tsx:188 | 注意 代码变更需核对 |         const defensiveTargetPid = currentPhase === 'defensiveRoll' && G.pendingAttack?.defenderId !== rootPid
ADD src/games/dicethrone/Board.tsx:189 | 注意 代码变更需核对 |             ? G.pendingAttack?.defenderId
ADD src/games/dicethrone/Board.tsx:190 | 注意 代码变更需核对 |             : undefined;
ADD src/games/dicethrone/Board.tsx:191 | 注意 代码变更需核对 |         const responseTargetPid = isResponseWindowOpen && currentResponderId === rootPid
ADD src/games/dicethrone/Board.tsx:192 | 注意 代码变更需核对 |             ? defaultFocusedPid
ADD src/games/dicethrone/Board.tsx:193 | 注意 代码变更需核对 |             : undefined;
ADD src/games/dicethrone/Board.tsx:194 | 注意 代码变更需核对 |         const nextFocusedPid = defensiveTargetPid ?? responseTargetPid;
ADD src/games/dicethrone/Board.tsx:195 | 注意 代码变更需核对 | 
ADD src/games/dicethrone/Board.tsx:196 | 注意 代码变更需核对 |         if (nextFocusedPid && nextFocusedPid !== focusedPid) {
ADD src/games/dicethrone/Board.tsx:197 | 注意 代码变更需核对 |             setFocusedPid(nextFocusedPid);
ADD src/games/dicethrone/Board.tsx:198 | 注意 代码变更需核对 |         }
ADD src/games/dicethrone/Board.tsx:199 | 注意 代码变更需核对 |     }, [
ADD src/games/dicethrone/Board.tsx:200 | 注意 代码变更需核对 |         otherPids,
ADD src/games/dicethrone/Board.tsx:201 | 注意 代码变更需核对 |         focusedPid,
ADD src/games/dicethrone/Board.tsx:202 | 注意 代码变更需核对 |         defaultFocusedPid,
ADD src/games/dicethrone/Board.tsx:203 | 注意 代码变更需核对 |         currentPhase,
ADD src/games/dicethrone/Board.tsx:204 | 注意 代码变更需核对 |         G.pendingAttack?.defenderId,
ADD src/games/dicethrone/Board.tsx:205 | 注意 代码变更需核对 |         rootPid,
ADD src/games/dicethrone/Board.tsx:206 | 注意 代码变更需核对 |         isResponseWindowOpen,
ADD src/games/dicethrone/Board.tsx:207 | 注意 代码变更需核对 |         currentResponderId,
ADD src/games/dicethrone/Board.tsx:208 | 注意 代码变更需核对 |     ]);
DEL src/games/dicethrone/Board.tsx:142 | 注意 代码变更需核对 |     const opponentName = matchData?.find(p => String(p.id) === otherPid)?.name ?? t('common.opponent');
DEL src/games/dicethrone/Board.tsx:145 | 注意 代码变更需核对 |     const currentPhase = access.turnPhase;
DEL src/games/dicethrone/Board.tsx:173 | 注意 代码变更需核对 |     const playerNames = React.useMemo(() => {
DEL src/games/dicethrone/Board.tsx:174 | 注意 代码变更需核对 |         const names: Record<string, string> = {};
DEL src/games/dicethrone/Board.tsx:175 | 注意 代码变更需核对 |         Object.keys(G.players).forEach(pid => {
DEL src/games/dicethrone/Board.tsx:176 | 注意 代码变更需核对 |             names[pid] = matchData?.find(p => String(p.id) === pid)?.name ?? t('common.opponent');
DEL src/games/dicethrone/Board.tsx:177 | 注意 代码变更需核对 |         });
DEL src/games/dicethrone/Board.tsx:178 | 注意 代码变更需核对 |         return names;
DEL src/games/dicethrone/Board.tsx:179 | 注意 代码变更需核对 |     }, [G.players, matchData, t]);
DEL src/games/dicethrone/Board.tsx:180 | 注意 代码变更需核对 | 
DEL src/games/dicethrone/Board.tsx:452 | 注意 代码变更需核对 |     const isResponseWindowOpen = !!rawG.sys.responseWindow?.current;
DEL src/games/dicethrone/Board.tsx:453 | 注意 代码变更需核对 |     const currentResponderIndex = rawG.sys.responseWindow?.current?.currentResponderIndex;
DEL src/games/dicethrone/Board.tsx:454 | 注意 代码变更需核对 |     const currentResponderId = rawG.sys.responseWindow?.current
DEL src/games/dicethrone/Board.tsx:455 | 注意 代码变更需核对 |         ? rawG.sys.responseWindow.current.responderQueue[rawG.sys.responseWindow.current.currentResponderIndex]
DEL src/games/dicethrone/Board.tsx:456 | 注意 代码变更需核对 |         : undefined;
DEL src/games/dicethrone/Board.tsx:457 | 注意 代码变更需核对 | 
ADD src/games/dicethrone/Board.tsx:557 | 注意 代码变更需核对 |     const isFourPlayerView = otherPids.length > 1;
ADD src/games/dicethrone/Board.tsx:558 | 注意 代码变更需核对 |     const handleOpponentHeaderSelect = React.useCallback((targetPid: string) => {
ADD src/games/dicethrone/Board.tsx:559 | 注意 代码变更需核对 |         if (shouldAutoObserve) return;
ADD src/games/dicethrone/Board.tsx:560 | 注意 代码变更需核对 | 
ADD src/games/dicethrone/Board.tsx:561 | 注意 代码变更需核对 |         if (targetPid !== focusedPid || isSelfView) {
ADD src/games/dicethrone/Board.tsx:562 | 注意 代码变更需核对 |             setFocusedPid(targetPid);
ADD src/games/dicethrone/Board.tsx:563 | 注意 代码变更需核对 |             setViewMode('opponent');
ADD src/games/dicethrone/Board.tsx:564 | 注意 代码变更需核对 |             return;
ADD src/games/dicethrone/Board.tsx:565 | 注意 代码变更需核对 |         }
ADD src/games/dicethrone/Board.tsx:566 | 注意 代码变更需核对 | 
ADD src/games/dicethrone/Board.tsx:567 | 注意 代码变更需核对 |         if (isFourPlayerView) {
ADD src/games/dicethrone/Board.tsx:568 | 注意 代码变更需核对 |             setViewMode('self');
ADD src/games/dicethrone/Board.tsx:569 | 注意 代码变更需核对 |             return;
ADD src/games/dicethrone/Board.tsx:570 | 注意 代码变更需核对 |         }
ADD src/games/dicethrone/Board.tsx:571 | 注意 代码变更需核对 | 
ADD src/games/dicethrone/Board.tsx:572 | 注意 代码变更需核对 |         toggleViewMode();
ADD src/games/dicethrone/Board.tsx:573 | 注意 代码变更需核对 |     }, [shouldAutoObserve, focusedPid, isSelfView, isFourPlayerView, setViewMode, toggleViewMode]);
ADD src/games/dicethrone/Board.tsx:574 | 注意 代码变更需核对 | 
DEL src/games/dicethrone/Board.tsx:507 | 注意 代码变更需核对 |     const isRollPhase = currentPhase === 'offensiveRoll' || currentPhase === 'defensiveRoll';
ADD src/games/dicethrone/Board.tsx:577 | 注意 代码变更需核对 |     const isRollPhase = currentPhase === 'offensiveRoll' || currentPhase === 'targetingRoll' || currentPhase === 'defensiveRoll';
DEL src/games/dicethrone/Board.tsx:533 | 注意 代码变更需核对 |         : (isViewRolling ? G.pendingAttack?.sourceAbilityId : undefined);
ADD src/games/dicethrone/Board.tsx:603 | 注意 代码变更需核对 |         : currentPhase === 'offensiveRoll'
ADD src/games/dicethrone/Board.tsx:604 | 注意 代码变更需核对 |             ? (isViewRolling ? G.pendingAttack?.sourceAbilityId : undefined)
ADD src/games/dicethrone/Board.tsx:605 | 注意 代码变更需核对 |             : undefined;
DEL src/games/dicethrone/Board.tsx:893 | 注意 代码变更需核对 |             if (currentPhase === 'offensiveRoll' && !G.rollConfirmed) {
ADD src/games/dicethrone/Board.tsx:965 | 注意 代码变更需核对 |             if ((currentPhase === 'offensiveRoll' || currentPhase === 'targetingRoll') && !G.rollConfirmed) {
DEL src/games/dicethrone/Board.tsx:933 | 注意 代码变更需核对 |         if (currentPhase === 'offensiveRoll' && isActivePlayer) {
ADD src/games/dicethrone/Board.tsx:1005 | 注意 代码变更需核对 |         if ((currentPhase === 'offensiveRoll' || currentPhase === 'targetingRoll') && isActivePlayer) {
ADD src/games/dicethrone/Board.tsx:1050 | 注意 代码变更需核对 |         : currentPhase === 'targetingRoll'
ADD src/games/dicethrone/Board.tsx:1051 | 注意 代码变更需核对 |             ? '确认目标'
ADD src/games/dicethrone/Board.tsx:1076 | 注意 代码变更需核对 |                             seatingOrder={G.seatingOrder}
ADD src/games/dicethrone/Board.tsx:1080 | 注意 代码变更需核对 |                             onMoveSeat={engineMoves.moveSeat}
DEL src/games/dicethrone/Board.tsx:1049 | 注意 代码变更需核对 |                 {opponent && (
DEL src/games/dicethrone/Board.tsx:1050 | 注意 代码变更需核对 |                     <OpponentHeader
DEL src/games/dicethrone/Board.tsx:1051 | 注意 代码变更需核对 |                         opponent={opponent}
DEL src/games/dicethrone/Board.tsx:1052 | 注意 代码变更需核对 |                         opponentName={opponentName}
DEL src/games/dicethrone/Board.tsx:1053 | 注意 代码变更需核对 |                         viewMode={viewMode}
DEL src/games/dicethrone/Board.tsx:1054 | 注意 代码变更需核对 |                         isOpponentShaking={opponentImpact.shake.isShaking}
DEL src/games/dicethrone/Board.tsx:1055 | 注意 代码变更需核对 |                         hitStopActive={opponentImpact.hitStop.isActive}
DEL src/games/dicethrone/Board.tsx:1056 | 注意 代码变更需核对 |                         hitStopConfig={opponentImpact.hitStop.config}
DEL src/games/dicethrone/Board.tsx:1057 | 注意 代码变更需核对 |                         shouldAutoObserve={shouldAutoObserve}
DEL src/games/dicethrone/Board.tsx:1058 | 注意 代码变更需核对 |                         onToggleView={() => {
DEL src/games/dicethrone/Board.tsx:1059 | 注意 代码变更需核对 |                             toggleViewMode();
DEL src/games/dicethrone/Board.tsx:1060 | 注意 代码变更需核对 |                         }}
DEL src/games/dicethrone/Board.tsx:1061 | 注意 代码变更需核对 |                         headerError={headerError}
DEL src/games/dicethrone/Board.tsx:1062 | 注意 代码变更需核对 |                         opponentBuffRef={opponentBuffRef}
DEL src/games/dicethrone/Board.tsx:1063 | 注意 代码变更需核对 |                         opponentHpRef={opponentHpRef}
DEL src/games/dicethrone/Board.tsx:1064 | 注意 代码变更需核对 |                         opponentCpRef={opponentCpRef}
DEL src/games/dicethrone/Board.tsx:1065 | 注意 代码变更需核对 |                         statusIconAtlas={statusIconAtlas}
DEL src/games/dicethrone/Board.tsx:1066 | 注意 代码变更需核对 |                         locale={locale}
DEL src/games/dicethrone/Board.tsx:1067 | 注意 代码变更需核对 |                         containerRef={opponentHeaderRef}
DEL src/games/dicethrone/Board.tsx:1068 | 注意 代码变更需核对 |                         tokenDefinitions={G.tokenDefinitions}
DEL src/games/dicethrone/Board.tsx:1069 | 注意 代码变更需核对 |                         damageFlashActive={opponentImpact.flash.isActive}
DEL src/games/dicethrone/Board.tsx:1070 | 注意 代码变更需核对 |                         damageFlashDamage={opponentImpact.flash.damage}
DEL src/games/dicethrone/Board.tsx:1071 | 注意 代码变更需核对 |                         overrideHp={damageBuffer.get(`hp-${otherPid}`, opponent.resources[RESOURCE_IDS.HP] ?? 0)}
DEL src/games/dicethrone/Board.tsx:1072 | 注意 代码变更需核对 |                     />
ADD src/games/dicethrone/Board.tsx:1125 | 注意 代码变更需核对 |                 {otherPids.length > 0 && (
ADD src/games/dicethrone/Board.tsx:1126 | 注意 代码变更需核对 |                     <div className="absolute top-[0.9vw] left-1/2 z-50 flex -translate-x-1/2 items-start gap-[0.6vw] pointer-events-none">
ADD src/games/dicethrone/Board.tsx:1127 | 注意 代码变更需核对 |                         {otherPids.map((pid) => {
ADD src/games/dicethrone/Board.tsx:1128 | 注意 代码变更需核对 |                             const headerPlayer = G.players[pid];
ADD src/games/dicethrone/Board.tsx:1129 | 注意 代码变更需核对 |                             if (!headerPlayer) return null;
ADD src/games/dicethrone/Board.tsx:1130 | 注意 代码变更需核对 |                             const headerIndex = otherPids.indexOf(pid);
ADD src/games/dicethrone/Board.tsx:1131 | 注意 代码变更需核对 | 
ADD src/games/dicethrone/Board.tsx:1132 | 注意 代码变更需核对 |                             const isFocusedHeader = pid === otherPid;
ADD src/games/dicethrone/Board.tsx:1133 | 注意 代码变更需核对 |                             const isTeammateHeader = areTeammates(G, rootPid, pid);
ADD src/games/dicethrone/Board.tsx:1134 | 注意 代码变更需核对 | 
ADD src/games/dicethrone/Board.tsx:1135 | 注意 代码变更需核对 |                             return (
ADD src/games/dicethrone/Board.tsx:1136 | 注意 代码变更需核对 |                                 <OpponentHeader
ADD src/games/dicethrone/Board.tsx:1137 | 注意 代码变更需核对 |                                     key={pid}
ADD src/games/dicethrone/Board.tsx:1138 | 注意 代码变更需核对 |                                     opponent={headerPlayer}
ADD src/games/dicethrone/Board.tsx:1139 | 注意 代码变更需核对 |                                     playerId={pid}
ADD src/games/dicethrone/Board.tsx:1140 | 注意 代码变更需核对 |                                     opponentName={playerNames[pid] ?? t('common.opponent')}
ADD src/games/dicethrone/Board.tsx:1141 | 注意 代码变更需核对 |                                     viewMode={viewMode}
ADD src/games/dicethrone/Board.tsx:1142 | 注意 代码变更需核对 |                                     tone={isTeammateHeader ? 'ally' : 'enemy'}
ADD src/games/dicethrone/Board.tsx:1143 | 注意 代码变更需核对 |                                     testId={`dt-top-header-${headerIndex + 1}`}
ADD src/games/dicethrone/Board.tsx:1144 | 注意 代码变更需核对 |                                     compact={isFourPlayerView}
ADD src/games/dicethrone/Board.tsx:1145 | 注意 代码变更需核对 |                                     selected={isFocusedHeader}
ADD src/games/dicethrone/Board.tsx:1146 | 注意 代码变更需核对 |                                     observed={!isSelfView && isFocusedHeader}
ADD src/games/dicethrone/Board.tsx:1147 | 注意 代码变更需核对 |                                     isOpponentShaking={isFocusedHeader && opponentImpact.shake.isShaking}
ADD src/games/dicethrone/Board.tsx:1148 | 注意 代码变更需核对 |                                     hitStopActive={isFocusedHeader ? opponentImpact.hitStop.isActive : false}
ADD src/games/dicethrone/Board.tsx:1149 | 注意 代码变更需核对 |                                     hitStopConfig={isFocusedHeader ? opponentImpact.hitStop.config : undefined}
ADD src/games/dicethrone/Board.tsx:1150 | 注意 代码变更需核对 |                                     shouldAutoObserve={shouldAutoObserve}
ADD src/games/dicethrone/Board.tsx:1151 | 注意 代码变更需核对 |                                     onToggleView={() => {
ADD src/games/dicethrone/Board.tsx:1152 | 注意 代码变更需核对 |                                         handleOpponentHeaderSelect(pid);
ADD src/games/dicethrone/Board.tsx:1153 | 注意 代码变更需核对 |                                     }}
ADD src/games/dicethrone/Board.tsx:1154 | 注意 代码变更需核对 |                                     headerError={isFocusedHeader ? headerError : null}
ADD src/games/dicethrone/Board.tsx:1155 | 注意 代码变更需核对 |                                     opponentBuffRef={isFocusedHeader ? opponentBuffRef : undefined}
ADD src/games/dicethrone/Board.tsx:1156 | 注意 代码变更需核对 |                                     opponentHpRef={isFocusedHeader ? opponentHpRef : undefined}
ADD src/games/dicethrone/Board.tsx:1157 | 注意 代码变更需核对 |                                     opponentCpRef={isFocusedHeader ? opponentCpRef : undefined}
ADD src/games/dicethrone/Board.tsx:1158 | 注意 代码变更需核对 |                                     statusIconAtlas={statusIconAtlas}
ADD src/games/dicethrone/Board.tsx:1159 | 注意 代码变更需核对 |                                     locale={locale}
ADD src/games/dicethrone/Board.tsx:1160 | 注意 代码变更需核对 |                                     containerRef={isFocusedHeader ? opponentHeaderRef : undefined}
ADD src/games/dicethrone/Board.tsx:1161 | 注意 代码变更需核对 |                                     containerClassName="pointer-events-auto"
ADD src/games/dicethrone/Board.tsx:1162 | 注意 代码变更需核对 |                                     tokenDefinitions={G.tokenDefinitions}
ADD src/games/dicethrone/Board.tsx:1163 | 注意 代码变更需核对 |                                     damageFlashActive={isFocusedHeader && opponentImpact.flash.isActive}
ADD src/games/dicethrone/Board.tsx:1164 | 注意 代码变更需核对 |                                     damageFlashDamage={isFocusedHeader ? opponentImpact.flash.damage : undefined}
ADD src/games/dicethrone/Board.tsx:1165 | 注意 代码变更需核对 |                                     overrideHp={isFocusedHeader
ADD src/games/dicethrone/Board.tsx:1166 | 注意 代码变更需核对 |                                         ? damageBuffer.get(`hp-${pid}`, headerPlayer.resources[RESOURCE_IDS.HP] ?? 0)
ADD src/games/dicethrone/Board.tsx:1167 | 注意 代码变更需核对 |                                         : undefined}
ADD src/games/dicethrone/Board.tsx:1168 | 注意 代码变更需核对 |                                 />
ADD src/games/dicethrone/Board.tsx:1169 | 注意 代码变更需核对 |                             );
ADD src/games/dicethrone/Board.tsx:1170 | 注意 代码变更需核对 |                         })}
ADD src/games/dicethrone/Board.tsx:1171 | 注意 代码变更需核对 |                     </div>
ADD src/games/dicethrone/Board.tsx:1555 | 注意 代码变更需核对 |                     playerNames={playerNames}
ADD src/games/dicethrone/Board.tsx:1556 | 注意 代码变更需核对 |                     seatingOrder={G.seatingOrder}
ADD src/games/dicethrone/Board.tsx:1557 | 注意 代码变更需核对 |                     teamIdByPlayerId={G.teamIdByPlayerId}
DEL src/games/dicethrone/Board.tsx:1481 | 注意 代码变更需核对 |                     playerNames={playerNames}
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:39 | OK 测试/覆盖新增，需与主链保持一致 | function getInitTeamCore(): DiceThroneCore {
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:40 | OK 测试/覆盖新增，需与主链保持一致 |     const state = createInitializedState(['0', '1', '2', '3'], fixedRandom);
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:41 | OK 测试/覆盖新增，需与主链保持一致 |     return state.core;
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:42 | OK 测试/覆盖新增，需与主链保持一致 | }
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:43 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:82 | OK 测试/覆盖新增，需与主链保持一致 |     it('2v2 模式下伤害会同步扣减同队共享体力', () => {
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:83 | OK 测试/覆盖新增，需与主链保持一致 |         const core = getInitTeamCore();
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:84 | OK 测试/覆盖新增，需与主链保持一致 |         const result = reduce(core, ev('DAMAGE_DEALT', { targetId: '0', actualDamage: 6 }));
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:85 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:86 | OK 测试/覆盖新增，需与主链保持一致 |         expect(result.players['0'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 6);
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:87 | OK 测试/覆盖新增，需与主链保持一致 |         expect(result.players['2'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 6);
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:88 | OK 测试/覆盖新增，需与主链保持一致 |         expect(result.teamHealth).toEqual({ A: INITIAL_HEALTH - 6, B: INITIAL_HEALTH });
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:89 | OK 测试/覆盖新增，需与主链保持一致 |     });
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:90 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:91 | OK 测试/覆盖新增，需与主链保持一致 |     it('2v2 模式下治疗不会让共享体力超过上限', () => {
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:92 | OK 测试/覆盖新增，需与主链保持一致 |         const core = getInitTeamCore();
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:93 | OK 测试/覆盖新增，需与主链保持一致 |         const damaged = reduce(core, ev('DAMAGE_DEALT', { targetId: '0', actualDamage: 5 }));
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:94 | OK 测试/覆盖新增，需与主链保持一致 |         const healed = reduce(damaged, ev('HEAL_APPLIED', { targetId: '2', amount: 100 }));
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:95 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:96 | OK 测试/覆盖新增，需与主链保持一致 |         expect(healed.players['0'].resources[RESOURCE_IDS.HP]).toBe(60);
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:97 | OK 测试/覆盖新增，需与主链保持一致 |         expect(healed.players['2'].resources[RESOURCE_IDS.HP]).toBe(60);
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:98 | OK 测试/覆盖新增，需与主链保持一致 |         expect(healed.teamHealth).toEqual({ A: 60, B: INITIAL_HEALTH });
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:99 | OK 测试/覆盖新增，需与主链保持一致 |     });
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:100 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:468 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:469 | OK 测试/覆盖新增，需与主链保持一致 |     it('2v2 模式下一队共享体力归零时判定另一队获胜', () => {
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:470 | OK 测试/覆盖新增，需与主链保持一致 |         const core = getInitTeamCore();
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:471 | OK 测试/覆盖新增，需与主链保持一致 |         core.players['0'].resources[RESOURCE_IDS.HP] = 0;
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:472 | OK 测试/覆盖新增，需与主链保持一致 |         core.players['2'].resources[RESOURCE_IDS.HP] = 0;
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:473 | OK 测试/覆盖新增，需与主链保持一致 |         core.teamHealth = { A: 0, B: INITIAL_HEALTH };
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:474 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:475 | OK 测试/覆盖新增，需与主链保持一致 |         const result = DiceThroneDomain.isGameOver!(core);
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:476 | OK 测试/覆盖新增，需与主链保持一致 |         expect(result).toBeDefined();
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:477 | OK 测试/覆盖新增，需与主链保持一致 |         expect(result!.winner).toBe('1');
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:478 | OK 测试/覆盖新增，需与主链保持一致 |     });
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:479 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:480 | OK 测试/覆盖新增，需与主链保持一致 |     it('2v2 模式下双方共享体力同时归零时判定平局', () => {
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:481 | OK 测试/覆盖新增，需与主链保持一致 |         const core = getInitTeamCore();
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:482 | OK 测试/覆盖新增，需与主链保持一致 |         core.players['0'].resources[RESOURCE_IDS.HP] = 0;
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:483 | OK 测试/覆盖新增，需与主链保持一致 |         core.players['1'].resources[RESOURCE_IDS.HP] = 0;
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:484 | OK 测试/覆盖新增，需与主链保持一致 |         core.players['2'].resources[RESOURCE_IDS.HP] = 0;
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:485 | OK 测试/覆盖新增，需与主链保持一致 |         core.players['3'].resources[RESOURCE_IDS.HP] = 0;
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:486 | OK 测试/覆盖新增，需与主链保持一致 |         core.teamHealth = { A: 0, B: 0 };
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:487 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:488 | OK 测试/覆盖新增，需与主链保持一致 |         const result = DiceThroneDomain.isGameOver!(core);
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:489 | OK 测试/覆盖新增，需与主链保持一致 |         expect(result).toBeDefined();
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:490 | OK 测试/覆盖新增，需与主链保持一致 |         expect(result!.draw).toBe(true);
ADD src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts:491 | OK 测试/覆盖新增，需与主链保持一致 |     });
ADD src/games/dicethrone/__tests__/flow.test.ts:15 | OK 测试/覆盖新增，需与主链保持一致 | import { RESOURCE_IDS } from '../domain/resources';
ADD src/games/dicethrone/__tests__/flow.test.ts:17 | OK 测试/覆盖新增，需与主链保持一致 | import { executeCardCommand } from '../domain/executeCards';
ADD src/games/dicethrone/__tests__/flow.test.ts:18 | OK 测试/覆盖新增，需与主链保持一致 | import { getLeftOpponentId, getResponderQueue, getRightOpponentId, getTeamIdByPlayerIdMap } from '../domain/rules';
ADD src/games/dicethrone/__tests__/flow.test.ts:19 | OK 测试/覆盖新增，需与主链保持一致 | import { playerView } from '../domain/view';
DEL src/games/dicethrone/__tests__/flow.test.ts:65 | 注意 删除/收口测试，覆盖减少需确认 |         cmd('SELECT_CHARACTER', '0', { characterId: characters['0'] ?? 'monk' }),
DEL src/games/dicethrone/__tests__/flow.test.ts:66 | 注意 删除/收口测试，覆盖减少需确认 |         cmd('SELECT_CHARACTER', '1', { characterId: characters['1'] ?? 'monk' }),
DEL src/games/dicethrone/__tests__/flow.test.ts:67 | 注意 删除/收口测试，覆盖减少需确认 |         cmd('PLAYER_READY', '1'),
DEL src/games/dicethrone/__tests__/flow.test.ts:68 | 注意 删除/收口测试，覆盖减少需确认 |         cmd('HOST_START_GAME', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:69 | OK 测试/覆盖新增，需与主链保持一致 |         ...playerIds.map((playerId) => cmd('SELECT_CHARACTER', playerId, { characterId: characters[playerId] ?? 'monk' })),
ADD src/games/dicethrone/__tests__/flow.test.ts:70 | OK 测试/覆盖新增，需与主链保持一致 |         ...playerIds
ADD src/games/dicethrone/__tests__/flow.test.ts:71 | OK 测试/覆盖新增，需与主链保持一致 |             .filter((playerId) => playerId !== playerIds[0])
ADD src/games/dicethrone/__tests__/flow.test.ts:72 | OK 测试/覆盖新增，需与主链保持一致 |             .map((playerId) => cmd('PLAYER_READY', playerId)),
ADD src/games/dicethrone/__tests__/flow.test.ts:73 | OK 测试/覆盖新增，需与主链保持一致 |         cmd('HOST_START_GAME', playerIds[0]),
ADD src/games/dicethrone/__tests__/flow.test.ts:309 | OK 测试/覆盖新增，需与主链保持一致 |         it('4 人开局会初始化 2v2 团队状态并按队伍交替顺序轮转回合', () => {
ADD src/games/dicethrone/__tests__/flow.test.ts:310 | OK 测试/覆盖新增，需与主链保持一致 |             const playerIds: PlayerId[] = ['0', '1', '2', '3'];
ADD src/games/dicethrone/__tests__/flow.test.ts:311 | OK 测试/覆盖新增，需与主链保持一致 |             const pipelineConfig = {
ADD src/games/dicethrone/__tests__/flow.test.ts:312 | OK 测试/覆盖新增，需与主链保持一致 |                 domain: DiceThroneDomain,
ADD src/games/dicethrone/__tests__/flow.test.ts:313 | OK 测试/覆盖新增，需与主链保持一致 |                 systems: testSystems,
ADD src/games/dicethrone/__tests__/flow.test.ts:314 | OK 测试/覆盖新增，需与主链保持一致 |             };
ADD src/games/dicethrone/__tests__/flow.test.ts:315 | OK 测试/覆盖新增，需与主链保持一致 |             let state = createNoResponseSetup()(playerIds, fixedRandom);
ADD src/games/dicethrone/__tests__/flow.test.ts:316 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:317 | OK 测试/覆盖新增，需与主链保持一致 |             expect(state.core.seatingOrder).toEqual(['0', '1', '2', '3']);
ADD src/games/dicethrone/__tests__/flow.test.ts:318 | OK 测试/覆盖新增，需与主链保持一致 |             expect(state.core.teamIdByPlayerId).toEqual({
ADD src/games/dicethrone/__tests__/flow.test.ts:319 | OK 测试/覆盖新增，需与主链保持一致 |                 '0': 'A',
ADD src/games/dicethrone/__tests__/flow.test.ts:320 | OK 测试/覆盖新增，需与主链保持一致 |                 '1': 'B',
ADD src/games/dicethrone/__tests__/flow.test.ts:321 | OK 测试/覆盖新增，需与主链保持一致 |                 '2': 'A',
ADD src/games/dicethrone/__tests__/flow.test.ts:322 | OK 测试/覆盖新增，需与主链保持一致 |                 '3': 'B',
ADD src/games/dicethrone/__tests__/flow.test.ts:323 | OK 测试/覆盖新增，需与主链保持一致 |             });
ADD src/games/dicethrone/__tests__/flow.test.ts:324 | OK 测试/覆盖新增，需与主链保持一致 |             expect(state.core.teamHealth).toEqual({ A: INITIAL_HEALTH, B: INITIAL_HEALTH });
ADD src/games/dicethrone/__tests__/flow.test.ts:325 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:326 | OK 测试/覆盖新增，需与主链保持一致 |             const activePlayerSequence: PlayerId[] = [state.core.activePlayerId];
ADD src/games/dicethrone/__tests__/flow.test.ts:327 | OK 测试/覆盖新增，需与主链保持一致 |             const turnAdvanceCommands: CommandInput[] = [
ADD src/games/dicethrone/__tests__/flow.test.ts:328 | OK 测试/覆盖新增，需与主链保持一致 |                 ...advanceTo('discard', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:329 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('ADVANCE_PHASE', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:330 | OK 测试/覆盖新增，需与主链保持一致 |                 ...advanceTo('discard', '2'),
ADD src/games/dicethrone/__tests__/flow.test.ts:331 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('ADVANCE_PHASE', '2'),
ADD src/games/dicethrone/__tests__/flow.test.ts:332 | OK 测试/覆盖新增，需与主链保持一致 |                 ...advanceTo('discard', '1'),
ADD src/games/dicethrone/__tests__/flow.test.ts:333 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('ADVANCE_PHASE', '1'),
ADD src/games/dicethrone/__tests__/flow.test.ts:334 | OK 测试/覆盖新增，需与主链保持一致 |             ];
ADD src/games/dicethrone/__tests__/flow.test.ts:335 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:336 | OK 测试/覆盖新增，需与主链保持一致 |             for (const input of turnAdvanceCommands) {
ADD src/games/dicethrone/__tests__/flow.test.ts:337 | OK 测试/覆盖新增，需与主链保持一致 |                 const command = {
ADD src/games/dicethrone/__tests__/flow.test.ts:338 | OK 测试/覆盖新增，需与主链保持一致 |                     type: input.type,
ADD src/games/dicethrone/__tests__/flow.test.ts:339 | OK 测试/覆盖新增，需与主链保持一致 |                     playerId: input.playerId,
ADD src/games/dicethrone/__tests__/flow.test.ts:340 | OK 测试/覆盖新增，需与主链保持一致 |                     payload: input.payload,
ADD src/games/dicethrone/__tests__/flow.test.ts:341 | OK 测试/覆盖新增，需与主链保持一致 |                     timestamp: Date.now(),
ADD src/games/dicethrone/__tests__/flow.test.ts:342 | OK 测试/覆盖新增，需与主链保持一致 |                 } as DiceThroneCommand;
ADD src/games/dicethrone/__tests__/flow.test.ts:343 | OK 测试/覆盖新增，需与主链保持一致 |                 const result = executePipeline(pipelineConfig, state, command, fixedRandom, playerIds);
ADD src/games/dicethrone/__tests__/flow.test.ts:344 | OK 测试/覆盖新增，需与主链保持一致 |                 expect(result.success).toBe(true);
ADD src/games/dicethrone/__tests__/flow.test.ts:345 | OK 测试/覆盖新增，需与主链保持一致 |                 state = result.state as MatchState<DiceThroneCore>;
ADD src/games/dicethrone/__tests__/flow.test.ts:346 | OK 测试/覆盖新增，需与主链保持一致 |                 if (input.type === 'ADVANCE_PHASE' && state.sys.phase === 'main1') {
ADD src/games/dicethrone/__tests__/flow.test.ts:347 | OK 测试/覆盖新增，需与主链保持一致 |                     activePlayerSequence.push(state.core.activePlayerId);
ADD src/games/dicethrone/__tests__/flow.test.ts:348 | OK 测试/覆盖新增，需与主链保持一致 |                 }
ADD src/games/dicethrone/__tests__/flow.test.ts:349 | OK 测试/覆盖新增，需与主链保持一致 |             }
ADD src/games/dicethrone/__tests__/flow.test.ts:350 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:351 | OK 测试/覆盖新增，需与主链保持一致 |             expect(activePlayerSequence).toEqual(['0', '2', '1', '3']);
ADD src/games/dicethrone/__tests__/flow.test.ts:352 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD src/games/dicethrone/__tests__/flow.test.ts:353 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:354 | OK 测试/覆盖新增，需与主链保持一致 |         it('4 人 setup 阶段允许房主调整站位并同步更新分队与左右对手', () => {
ADD src/games/dicethrone/__tests__/flow.test.ts:355 | OK 测试/覆盖新增，需与主链保持一致 |             const playerIds: PlayerId[] = ['0', '1', '2', '3'];
ADD src/games/dicethrone/__tests__/flow.test.ts:356 | OK 测试/覆盖新增，需与主链保持一致 |             const pipelineConfig = {
ADD src/games/dicethrone/__tests__/flow.test.ts:357 | OK 测试/覆盖新增，需与主链保持一致 |                 domain: DiceThroneDomain,
ADD src/games/dicethrone/__tests__/flow.test.ts:358 | OK 测试/覆盖新增，需与主链保持一致 |                 systems: testSystems,
ADD src/games/dicethrone/__tests__/flow.test.ts:359 | OK 测试/覆盖新增，需与主链保持一致 |             };
ADD src/games/dicethrone/__tests__/flow.test.ts:360 | OK 测试/覆盖新增，需与主链保持一致 |             let state: MatchState<DiceThroneCore> = {
ADD src/games/dicethrone/__tests__/flow.test.ts:361 | OK 测试/覆盖新增，需与主链保持一致 |                 core: DiceThroneDomain.setup(playerIds, fixedRandom),
ADD src/games/dicethrone/__tests__/flow.test.ts:362 | OK 测试/覆盖新增，需与主链保持一致 |                 sys: createInitialSystemState(playerIds, testSystems, undefined),
ADD src/games/dicethrone/__tests__/flow.test.ts:363 | OK 测试/覆盖新增，需与主链保持一致 |             };
ADD src/games/dicethrone/__tests__/flow.test.ts:364 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:365 | OK 测试/覆盖新增，需与主链保持一致 |             const moveSeatCommand = {
ADD src/games/dicethrone/__tests__/flow.test.ts:366 | OK 测试/覆盖新增，需与主链保持一致 |                 type: 'MOVE_SEAT',
ADD src/games/dicethrone/__tests__/flow.test.ts:367 | OK 测试/覆盖新增，需与主链保持一致 |                 playerId: '0',
ADD src/games/dicethrone/__tests__/flow.test.ts:368 | OK 测试/覆盖新增，需与主链保持一致 |                 payload: {
ADD src/games/dicethrone/__tests__/flow.test.ts:369 | OK 测试/覆盖新增，需与主链保持一致 |                     playerId: '0',
ADD src/games/dicethrone/__tests__/flow.test.ts:370 | OK 测试/覆盖新增，需与主链保持一致 |                     targetSeatIndex: 2,
ADD src/games/dicethrone/__tests__/flow.test.ts:371 | OK 测试/覆盖新增，需与主链保持一致 |                 },
ADD src/games/dicethrone/__tests__/flow.test.ts:372 | OK 测试/覆盖新增，需与主链保持一致 |                 timestamp: Date.now(),
ADD src/games/dicethrone/__tests__/flow.test.ts:373 | OK 测试/覆盖新增，需与主链保持一致 |             } as DiceThroneCommand;
ADD src/games/dicethrone/__tests__/flow.test.ts:374 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:375 | OK 测试/覆盖新增，需与主链保持一致 |             const result = executePipeline(pipelineConfig, state, moveSeatCommand, fixedRandom, playerIds);
ADD src/games/dicethrone/__tests__/flow.test.ts:376 | OK 测试/覆盖新增，需与主链保持一致 |             expect(result.success).toBe(true);
ADD src/games/dicethrone/__tests__/flow.test.ts:377 | OK 测试/覆盖新增，需与主链保持一致 |             state = result.state as MatchState<DiceThroneCore>;
ADD src/games/dicethrone/__tests__/flow.test.ts:378 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:379 | OK 测试/覆盖新增，需与主链保持一致 |             expect(state.core.seatingOrder).toEqual(['1', '2', '0', '3']);
ADD src/games/dicethrone/__tests__/flow.test.ts:380 | OK 测试/覆盖新增，需与主链保持一致 |             expect(getTeamIdByPlayerIdMap(state.core)).toEqual({
ADD src/games/dicethrone/__tests__/flow.test.ts:381 | OK 测试/覆盖新增，需与主链保持一致 |                 '0': 'A',
ADD src/games/dicethrone/__tests__/flow.test.ts:382 | OK 测试/覆盖新增，需与主链保持一致 |                 '1': 'A',
ADD src/games/dicethrone/__tests__/flow.test.ts:383 | OK 测试/覆盖新增，需与主链保持一致 |                 '2': 'B',
ADD src/games/dicethrone/__tests__/flow.test.ts:384 | OK 测试/覆盖新增，需与主链保持一致 |                 '3': 'B',
ADD src/games/dicethrone/__tests__/flow.test.ts:385 | OK 测试/覆盖新增，需与主链保持一致 |             });
ADD src/games/dicethrone/__tests__/flow.test.ts:386 | OK 测试/覆盖新增，需与主链保持一致 |             expect(getLeftOpponentId(state.core, '0')).toBe('2');
ADD src/games/dicethrone/__tests__/flow.test.ts:387 | OK 测试/覆盖新增，需与主链保持一致 |             expect(getRightOpponentId(state.core, '0')).toBe('3');
ADD src/games/dicethrone/__tests__/flow.test.ts:388 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD src/games/dicethrone/__tests__/flow.test.ts:389 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:390 | OK 测试/覆盖新增，需与主链保持一致 |         it('4 人 setup 阶段禁止非房主调整站位', () => {
ADD src/games/dicethrone/__tests__/flow.test.ts:391 | OK 测试/覆盖新增，需与主链保持一致 |             const playerIds: PlayerId[] = ['0', '1', '2', '3'];
ADD src/games/dicethrone/__tests__/flow.test.ts:392 | OK 测试/覆盖新增，需与主链保持一致 |             const pipelineConfig = {
ADD src/games/dicethrone/__tests__/flow.test.ts:393 | OK 测试/覆盖新增，需与主链保持一致 |                 domain: DiceThroneDomain,
ADD src/games/dicethrone/__tests__/flow.test.ts:394 | OK 测试/覆盖新增，需与主链保持一致 |                 systems: testSystems,
ADD src/games/dicethrone/__tests__/flow.test.ts:395 | OK 测试/覆盖新增，需与主链保持一致 |             };
ADD src/games/dicethrone/__tests__/flow.test.ts:396 | OK 测试/覆盖新增，需与主链保持一致 |             const state: MatchState<DiceThroneCore> = {
ADD src/games/dicethrone/__tests__/flow.test.ts:397 | OK 测试/覆盖新增，需与主链保持一致 |                 core: DiceThroneDomain.setup(playerIds, fixedRandom),
ADD src/games/dicethrone/__tests__/flow.test.ts:398 | OK 测试/覆盖新增，需与主链保持一致 |                 sys: createInitialSystemState(playerIds, testSystems, undefined),
ADD src/games/dicethrone/__tests__/flow.test.ts:399 | OK 测试/覆盖新增，需与主链保持一致 |             };
ADD src/games/dicethrone/__tests__/flow.test.ts:400 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:401 | OK 测试/覆盖新增，需与主链保持一致 |             const moveSeatCommand = {
ADD src/games/dicethrone/__tests__/flow.test.ts:402 | OK 测试/覆盖新增，需与主链保持一致 |                 type: 'MOVE_SEAT',
ADD src/games/dicethrone/__tests__/flow.test.ts:403 | OK 测试/覆盖新增，需与主链保持一致 |                 playerId: '1',
ADD src/games/dicethrone/__tests__/flow.test.ts:404 | OK 测试/覆盖新增，需与主链保持一致 |                 payload: {
ADD src/games/dicethrone/__tests__/flow.test.ts:405 | OK 测试/覆盖新增，需与主链保持一致 |                     playerId: '0',
ADD src/games/dicethrone/__tests__/flow.test.ts:406 | OK 测试/覆盖新增，需与主链保持一致 |                     targetSeatIndex: 2,
ADD src/games/dicethrone/__tests__/flow.test.ts:407 | OK 测试/覆盖新增，需与主链保持一致 |                 },
ADD src/games/dicethrone/__tests__/flow.test.ts:408 | OK 测试/覆盖新增，需与主链保持一致 |                 timestamp: Date.now(),
ADD src/games/dicethrone/__tests__/flow.test.ts:409 | OK 测试/覆盖新增，需与主链保持一致 |             } as DiceThroneCommand;
ADD src/games/dicethrone/__tests__/flow.test.ts:410 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:411 | OK 测试/覆盖新增，需与主链保持一致 |             const result = executePipeline(pipelineConfig, state, moveSeatCommand, fixedRandom, playerIds);
ADD src/games/dicethrone/__tests__/flow.test.ts:412 | OK 测试/覆盖新增，需与主链保持一致 |             expect(result.success).toBe(false);
ADD src/games/dicethrone/__tests__/flow.test.ts:413 | OK 测试/覆盖新增，需与主链保持一致 |             expect(result.error).toBe('player_mismatch');
ADD src/games/dicethrone/__tests__/flow.test.ts:414 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD src/games/dicethrone/__tests__/flow.test.ts:415 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:416 | OK 测试/覆盖新增，需与主链保持一致 |         it('4 人 setup 阶段禁止移动到当前位置', () => {
ADD src/games/dicethrone/__tests__/flow.test.ts:417 | OK 测试/覆盖新增，需与主链保持一致 |             const playerIds: PlayerId[] = ['0', '1', '2', '3'];
ADD src/games/dicethrone/__tests__/flow.test.ts:418 | OK 测试/覆盖新增，需与主链保持一致 |             const pipelineConfig = {
ADD src/games/dicethrone/__tests__/flow.test.ts:419 | OK 测试/覆盖新增，需与主链保持一致 |                 domain: DiceThroneDomain,
ADD src/games/dicethrone/__tests__/flow.test.ts:420 | OK 测试/覆盖新增，需与主链保持一致 |                 systems: testSystems,
ADD src/games/dicethrone/__tests__/flow.test.ts:421 | OK 测试/覆盖新增，需与主链保持一致 |             };
ADD src/games/dicethrone/__tests__/flow.test.ts:422 | OK 测试/覆盖新增，需与主链保持一致 |             const state: MatchState<DiceThroneCore> = {
ADD src/games/dicethrone/__tests__/flow.test.ts:423 | OK 测试/覆盖新增，需与主链保持一致 |                 core: DiceThroneDomain.setup(playerIds, fixedRandom),
ADD src/games/dicethrone/__tests__/flow.test.ts:424 | OK 测试/覆盖新增，需与主链保持一致 |                 sys: createInitialSystemState(playerIds, testSystems, undefined),
ADD src/games/dicethrone/__tests__/flow.test.ts:425 | OK 测试/覆盖新增，需与主链保持一致 |             };
ADD src/games/dicethrone/__tests__/flow.test.ts:426 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:427 | OK 测试/覆盖新增，需与主链保持一致 |             const moveSeatCommand = {
ADD src/games/dicethrone/__tests__/flow.test.ts:428 | OK 测试/覆盖新增，需与主链保持一致 |                 type: 'MOVE_SEAT',
ADD src/games/dicethrone/__tests__/flow.test.ts:429 | OK 测试/覆盖新增，需与主链保持一致 |                 playerId: '0',
ADD src/games/dicethrone/__tests__/flow.test.ts:430 | OK 测试/覆盖新增，需与主链保持一致 |                 payload: {
ADD src/games/dicethrone/__tests__/flow.test.ts:431 | OK 测试/覆盖新增，需与主链保持一致 |                     playerId: '2',
ADD src/games/dicethrone/__tests__/flow.test.ts:432 | OK 测试/覆盖新增，需与主链保持一致 |                     targetSeatIndex: 2,
ADD src/games/dicethrone/__tests__/flow.test.ts:433 | OK 测试/覆盖新增，需与主链保持一致 |                 },
ADD src/games/dicethrone/__tests__/flow.test.ts:434 | OK 测试/覆盖新增，需与主链保持一致 |                 timestamp: Date.now(),
ADD src/games/dicethrone/__tests__/flow.test.ts:435 | OK 测试/覆盖新增，需与主链保持一致 |             } as DiceThroneCommand;
ADD src/games/dicethrone/__tests__/flow.test.ts:436 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:437 | OK 测试/覆盖新增，需与主链保持一致 |             const result = executePipeline(pipelineConfig, state, moveSeatCommand, fixedRandom, playerIds);
ADD src/games/dicethrone/__tests__/flow.test.ts:438 | OK 测试/覆盖新增，需与主链保持一致 |             expect(result.success).toBe(false);
ADD src/games/dicethrone/__tests__/flow.test.ts:439 | OK 测试/覆盖新增，需与主链保持一致 |             expect(result.error).toBe('seat_not_changed');
ADD src/games/dicethrone/__tests__/flow.test.ts:440 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD src/games/dicethrone/__tests__/flow.test.ts:441 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:442 | OK 测试/覆盖新增，需与主链保持一致 |         it('4 人对局开始后锁定站位', () => {
ADD src/games/dicethrone/__tests__/flow.test.ts:443 | OK 测试/覆盖新增，需与主链保持一致 |             const playerIds: PlayerId[] = ['0', '1', '2', '3'];
ADD src/games/dicethrone/__tests__/flow.test.ts:444 | OK 测试/覆盖新增，需与主链保持一致 |             const pipelineConfig = {
ADD src/games/dicethrone/__tests__/flow.test.ts:445 | OK 测试/覆盖新增，需与主链保持一致 |                 domain: DiceThroneDomain,
ADD src/games/dicethrone/__tests__/flow.test.ts:446 | OK 测试/覆盖新增，需与主链保持一致 |                 systems: testSystems,
ADD src/games/dicethrone/__tests__/flow.test.ts:447 | OK 测试/覆盖新增，需与主链保持一致 |             };
ADD src/games/dicethrone/__tests__/flow.test.ts:448 | OK 测试/覆盖新增，需与主链保持一致 |             const state = createInitializedStateWithCharacters(playerIds, fixedRandom, {
ADD src/games/dicethrone/__tests__/flow.test.ts:449 | OK 测试/覆盖新增，需与主链保持一致 |                 '0': 'monk',
ADD src/games/dicethrone/__tests__/flow.test.ts:450 | OK 测试/覆盖新增，需与主链保持一致 |                 '1': 'barbarian',
ADD src/games/dicethrone/__tests__/flow.test.ts:451 | OK 测试/覆盖新增，需与主链保持一致 |                 '2': 'pyromancer',
ADD src/games/dicethrone/__tests__/flow.test.ts:452 | OK 测试/覆盖新增，需与主链保持一致 |                 '3': 'paladin',
ADD src/games/dicethrone/__tests__/flow.test.ts:453 | OK 测试/覆盖新增，需与主链保持一致 |             });
ADD src/games/dicethrone/__tests__/flow.test.ts:454 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:455 | OK 测试/覆盖新增，需与主链保持一致 |             const moveSeatCommand = {
ADD src/games/dicethrone/__tests__/flow.test.ts:456 | OK 测试/覆盖新增，需与主链保持一致 |                 type: 'MOVE_SEAT',
ADD src/games/dicethrone/__tests__/flow.test.ts:457 | OK 测试/覆盖新增，需与主链保持一致 |                 playerId: '0',
ADD src/games/dicethrone/__tests__/flow.test.ts:458 | OK 测试/覆盖新增，需与主链保持一致 |                 payload: {
ADD src/games/dicethrone/__tests__/flow.test.ts:459 | OK 测试/覆盖新增，需与主链保持一致 |                     playerId: '0',
ADD src/games/dicethrone/__tests__/flow.test.ts:460 | OK 测试/覆盖新增，需与主链保持一致 |                     targetSeatIndex: 3,
ADD src/games/dicethrone/__tests__/flow.test.ts:461 | OK 测试/覆盖新增，需与主链保持一致 |                 },
ADD src/games/dicethrone/__tests__/flow.test.ts:462 | OK 测试/覆盖新增，需与主链保持一致 |                 timestamp: Date.now(),
ADD src/games/dicethrone/__tests__/flow.test.ts:463 | OK 测试/覆盖新增，需与主链保持一致 |             } as DiceThroneCommand;
ADD src/games/dicethrone/__tests__/flow.test.ts:464 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:465 | OK 测试/覆盖新增，需与主链保持一致 |             const result = executePipeline(pipelineConfig, state, moveSeatCommand, fixedRandom, playerIds);
ADD src/games/dicethrone/__tests__/flow.test.ts:466 | OK 测试/覆盖新增，需与主链保持一致 |             expect(result.success).toBe(false);
ADD src/games/dicethrone/__tests__/flow.test.ts:467 | OK 测试/覆盖新增，需与主链保持一致 |             expect(result.error).toBe('invalid_phase');
ADD src/games/dicethrone/__tests__/flow.test.ts:468 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD src/games/dicethrone/__tests__/flow.test.ts:469 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:470 | OK 测试/覆盖新增，需与主链保持一致 |         it('4 人模式攻击发起时不会在 targetingRoll 前预写 defenderId', () => {
ADD src/games/dicethrone/__tests__/flow.test.ts:471 | OK 测试/覆盖新增，需与主链保持一致 |             const playerIds: PlayerId[] = ['0', '1', '2', '3'];
ADD src/games/dicethrone/__tests__/flow.test.ts:472 | OK 测试/覆盖新增，需与主链保持一致 |             const pipelineConfig = {
ADD src/games/dicethrone/__tests__/flow.test.ts:473 | OK 测试/覆盖新增，需与主链保持一致 |                 domain: DiceThroneDomain,
ADD src/games/dicethrone/__tests__/flow.test.ts:474 | OK 测试/覆盖新增，需与主链保持一致 |                 systems: testSystems,
ADD src/games/dicethrone/__tests__/flow.test.ts:475 | OK 测试/覆盖新增，需与主链保持一致 |             };
ADD src/games/dicethrone/__tests__/flow.test.ts:476 | OK 测试/覆盖新增，需与主链保持一致 |             let state = createNoResponseSetup()(playerIds, fixedRandom);
ADD src/games/dicethrone/__tests__/flow.test.ts:477 | OK 测试/覆盖新增，需与主链保持一致 |             const commands: CommandInput[] = [
ADD src/games/dicethrone/__tests__/flow.test.ts:478 | OK 测试/覆盖新增，需与主链保持一致 |                 ...advanceTo('offensiveRoll', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:479 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('ROLL_DICE', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:480 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('CONFIRM_ROLL', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:481 | OK 测试/覆盖新增，需与主链保持一致 |             ];
ADD src/games/dicethrone/__tests__/flow.test.ts:482 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:483 | OK 测试/覆盖新增，需与主链保持一致 |             for (const input of commands) {
ADD src/games/dicethrone/__tests__/flow.test.ts:484 | OK 测试/覆盖新增，需与主链保持一致 |                 const command = {
ADD src/games/dicethrone/__tests__/flow.test.ts:485 | OK 测试/覆盖新增，需与主链保持一致 |                     type: input.type,
ADD src/games/dicethrone/__tests__/flow.test.ts:486 | OK 测试/覆盖新增，需与主链保持一致 |                     playerId: input.playerId,
ADD src/games/dicethrone/__tests__/flow.test.ts:487 | OK 测试/覆盖新增，需与主链保持一致 |                     payload: input.payload,
ADD src/games/dicethrone/__tests__/flow.test.ts:488 | OK 测试/覆盖新增，需与主链保持一致 |                     timestamp: Date.now(),
ADD src/games/dicethrone/__tests__/flow.test.ts:489 | OK 测试/覆盖新增，需与主链保持一致 |                 } as DiceThroneCommand;
ADD src/games/dicethrone/__tests__/flow.test.ts:490 | OK 测试/覆盖新增，需与主链保持一致 |                 const result = executePipeline(pipelineConfig, state, command, fixedRandom, playerIds);
ADD src/games/dicethrone/__tests__/flow.test.ts:491 | OK 测试/覆盖新增，需与主链保持一致 |                 expect(result.success).toBe(true);
ADD src/games/dicethrone/__tests__/flow.test.ts:492 | OK 测试/覆盖新增，需与主链保持一致 |                 state = result.state as MatchState<DiceThroneCore>;
ADD src/games/dicethrone/__tests__/flow.test.ts:493 | OK 测试/覆盖新增，需与主链保持一致 |             }
ADD src/games/dicethrone/__tests__/flow.test.ts:494 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:495 | OK 测试/覆盖新增，需与主链保持一致 |             const selectAbilityResult = executePipeline(
ADD src/games/dicethrone/__tests__/flow.test.ts:496 | OK 测试/覆盖新增，需与主链保持一致 |                 pipelineConfig,
ADD src/games/dicethrone/__tests__/flow.test.ts:497 | OK 测试/覆盖新增，需与主链保持一致 |                 state,
ADD src/games/dicethrone/__tests__/flow.test.ts:498 | OK 测试/覆盖新增，需与主链保持一致 |                 {
ADD src/games/dicethrone/__tests__/flow.test.ts:499 | OK 测试/覆盖新增，需与主链保持一致 |                     type: 'SELECT_ABILITY',
ADD src/games/dicethrone/__tests__/flow.test.ts:500 | OK 测试/覆盖新增，需与主链保持一致 |                     playerId: '0',
ADD src/games/dicethrone/__tests__/flow.test.ts:501 | OK 测试/覆盖新增，需与主链保持一致 |                     payload: { abilityId: fistAttackAbilityId },
ADD src/games/dicethrone/__tests__/flow.test.ts:502 | OK 测试/覆盖新增，需与主链保持一致 |                     timestamp: Date.now(),
ADD src/games/dicethrone/__tests__/flow.test.ts:503 | OK 测试/覆盖新增，需与主链保持一致 |                 } as DiceThroneCommand,
ADD src/games/dicethrone/__tests__/flow.test.ts:504 | OK 测试/覆盖新增，需与主链保持一致 |                 fixedRandom,
ADD src/games/dicethrone/__tests__/flow.test.ts:505 | OK 测试/覆盖新增，需与主链保持一致 |                 playerIds
ADD src/games/dicethrone/__tests__/flow.test.ts:506 | OK 测试/覆盖新增，需与主链保持一致 |             );
ADD src/games/dicethrone/__tests__/flow.test.ts:507 | OK 测试/覆盖新增，需与主链保持一致 |             expect(selectAbilityResult.success).toBe(true);
ADD src/games/dicethrone/__tests__/flow.test.ts:508 | OK 测试/覆盖新增，需与主链保持一致 |             state = selectAbilityResult.state as MatchState<DiceThroneCore>;
ADD src/games/dicethrone/__tests__/flow.test.ts:509 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:510 | OK 测试/覆盖新增，需与主链保持一致 |             expect(state.core.pendingAttack?.attackerId).toBe('0');
ADD src/games/dicethrone/__tests__/flow.test.ts:511 | OK 测试/覆盖新增，需与主链保持一致 |             expect(state.core.pendingAttack?.defenderId).toBeUndefined();
ADD src/games/dicethrone/__tests__/flow.test.ts:512 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD src/games/dicethrone/__tests__/flow.test.ts:513 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:514 | OK 测试/覆盖新增，需与主链保持一致 |         it('4 人模式下队友手牌可见且不会进入同队响应队列', () => {
ADD src/games/dicethrone/__tests__/flow.test.ts:515 | OK 测试/覆盖新增，需与主链保持一致 |             const playerIds: PlayerId[] = ['0', '1', '2', '3'];
ADD src/games/dicethrone/__tests__/flow.test.ts:516 | OK 测试/覆盖新增，需与主链保持一致 |             const state = createInitializedState(playerIds, fixedRandom);
ADD src/games/dicethrone/__tests__/flow.test.ts:517 | OK 测试/覆盖新增，需与主链保持一致 |             state.core.players['0'].hand = [getCardById('card-inner-peace')];
ADD src/games/dicethrone/__tests__/flow.test.ts:518 | OK 测试/覆盖新增，需与主链保持一致 |             state.core.players['1'].hand = [getCardById('card-surprise')];
ADD src/games/dicethrone/__tests__/flow.test.ts:519 | OK 测试/覆盖新增，需与主链保持一致 |             state.core.players['2'].hand = [getCardById('card-surprise')];
ADD src/games/dicethrone/__tests__/flow.test.ts:520 | OK 测试/覆盖新增，需与主链保持一致 |             state.core.players['3'].hand = [getCardById('card-surprise')];
ADD src/games/dicethrone/__tests__/flow.test.ts:521 | OK 测试/覆盖新增，需与主链保持一致 |             state.core.players['1'].resources[RESOURCE_IDS.CP] = 10;
ADD src/games/dicethrone/__tests__/flow.test.ts:522 | OK 测试/覆盖新增，需与主链保持一致 |             state.core.players['2'].resources[RESOURCE_IDS.CP] = 10;
ADD src/games/dicethrone/__tests__/flow.test.ts:523 | OK 测试/覆盖新增，需与主链保持一致 |             state.core.players['3'].resources[RESOURCE_IDS.CP] = 10;
ADD src/games/dicethrone/__tests__/flow.test.ts:524 | OK 测试/覆盖新增，需与主链保持一致 |             state.core.dice = Array.from({ length: 5 }, (_, index) => ({
ADD src/games/dicethrone/__tests__/flow.test.ts:525 | OK 测试/覆盖新增，需与主链保持一致 |                 id: index,
ADD src/games/dicethrone/__tests__/flow.test.ts:526 | OK 测试/覆盖新增，需与主链保持一致 |                 definitionId: 'monk-dice',
ADD src/games/dicethrone/__tests__/flow.test.ts:527 | OK 测试/覆盖新增，需与主链保持一致 |                 value: 1,
ADD src/games/dicethrone/__tests__/flow.test.ts:528 | OK 测试/覆盖新增，需与主链保持一致 |                 symbol: 'fist',
ADD src/games/dicethrone/__tests__/flow.test.ts:529 | OK 测试/覆盖新增，需与主链保持一致 |                 symbols: ['fist'],
ADD src/games/dicethrone/__tests__/flow.test.ts:530 | OK 测试/覆盖新增，需与主链保持一致 |                 isKept: false,
ADD src/games/dicethrone/__tests__/flow.test.ts:531 | OK 测试/覆盖新增，需与主链保持一致 |             }));
ADD src/games/dicethrone/__tests__/flow.test.ts:532 | OK 测试/覆盖新增，需与主链保持一致 |             state.core.rollCount = 1;
ADD src/games/dicethrone/__tests__/flow.test.ts:533 | OK 测试/覆盖新增，需与主链保持一致 |             state.core.rollConfirmed = true;
ADD src/games/dicethrone/__tests__/flow.test.ts:534 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:535 | OK 测试/覆盖新增，需与主链保持一致 |             const filtered = playerView(state.core, '0').players!;
ADD src/games/dicethrone/__tests__/flow.test.ts:536 | OK 测试/覆盖新增，需与主链保持一致 |             expect(filtered['2'].hand[0]?.name).toBe(state.core.players['2'].hand[0]?.name);
ADD src/games/dicethrone/__tests__/flow.test.ts:537 | OK 测试/覆盖新增，需与主链保持一致 |             expect(filtered['1'].hand[0]?.name).toBe('???');
ADD src/games/dicethrone/__tests__/flow.test.ts:538 | OK 测试/覆盖新增，需与主链保持一致 |             expect(filtered['3'].hand[0]?.name).toBe('???');
ADD src/games/dicethrone/__tests__/flow.test.ts:539 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:540 | OK 测试/覆盖新增，需与主链保持一致 |             const responderQueue = getResponderQueue(
ADD src/games/dicethrone/__tests__/flow.test.ts:541 | OK 测试/覆盖新增，需与主链保持一致 |                 state.core,
ADD src/games/dicethrone/__tests__/flow.test.ts:542 | OK 测试/覆盖新增，需与主链保持一致 |                 'afterRollConfirmed',
ADD src/games/dicethrone/__tests__/flow.test.ts:543 | OK 测试/覆盖新增，需与主链保持一致 |                 '0',
ADD src/games/dicethrone/__tests__/flow.test.ts:544 | OK 测试/覆盖新增，需与主链保持一致 |                 undefined,
ADD src/games/dicethrone/__tests__/flow.test.ts:545 | OK 测试/覆盖新增，需与主链保持一致 |                 '0',
ADD src/games/dicethrone/__tests__/flow.test.ts:546 | OK 测试/覆盖新增，需与主链保持一致 |                 'offensiveRoll'
ADD src/games/dicethrone/__tests__/flow.test.ts:547 | OK 测试/覆盖新增，需与主链保持一致 |             );
ADD src/games/dicethrone/__tests__/flow.test.ts:548 | OK 测试/覆盖新增，需与主链保持一致 |             expect(responderQueue).toEqual(['1', '3']);
ADD src/games/dicethrone/__tests__/flow.test.ts:549 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD src/games/dicethrone/__tests__/flow.test.ts:550 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:551 | OK 测试/覆盖新增，需与主链保持一致 |         it('4 人模式下卡牌对手效果优先命中当前战斗对手', () => {
ADD src/games/dicethrone/__tests__/flow.test.ts:552 | OK 测试/覆盖新增，需与主链保持一致 |             const playerIds: PlayerId[] = ['0', '1', '2', '3'];
ADD src/games/dicethrone/__tests__/flow.test.ts:553 | OK 测试/覆盖新增，需与主链保持一致 |             const pipelineConfig = {
ADD src/games/dicethrone/__tests__/flow.test.ts:554 | OK 测试/覆盖新增，需与主链保持一致 |                 domain: DiceThroneDomain,
ADD src/games/dicethrone/__tests__/flow.test.ts:555 | OK 测试/覆盖新增，需与主链保持一致 |                 systems: testSystems,
ADD src/games/dicethrone/__tests__/flow.test.ts:556 | OK 测试/覆盖新增，需与主链保持一致 |             };
ADD src/games/dicethrone/__tests__/flow.test.ts:557 | OK 测试/覆盖新增，需与主链保持一致 |             let state = createInitializedStateWithCharacters(playerIds, fixedRandom, {
ADD src/games/dicethrone/__tests__/flow.test.ts:558 | OK 测试/覆盖新增，需与主链保持一致 |                 '0': 'monk',
ADD src/games/dicethrone/__tests__/flow.test.ts:559 | OK 测试/覆盖新增，需与主链保持一致 |                 '1': 'barbarian',
ADD src/games/dicethrone/__tests__/flow.test.ts:560 | OK 测试/覆盖新增，需与主链保持一致 |                 '2': 'pyromancer',
ADD src/games/dicethrone/__tests__/flow.test.ts:561 | OK 测试/覆盖新增，需与主链保持一致 |                 '3': 'monk',
ADD src/games/dicethrone/__tests__/flow.test.ts:562 | OK 测试/覆盖新增，需与主链保持一致 |             });
ADD src/games/dicethrone/__tests__/flow.test.ts:563 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:564 | OK 测试/覆盖新增，需与主链保持一致 |             for (const pid of playerIds) {
ADD src/games/dicethrone/__tests__/flow.test.ts:565 | OK 测试/覆盖新增，需与主链保持一致 |                 state.core.players[pid].hand = [];
ADD src/games/dicethrone/__tests__/flow.test.ts:566 | OK 测试/覆盖新增，需与主链保持一致 |                 state.core.players[pid].deck = [];
ADD src/games/dicethrone/__tests__/flow.test.ts:567 | OK 测试/覆盖新增，需与主链保持一致 |             }
ADD src/games/dicethrone/__tests__/flow.test.ts:568 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:569 | OK 测试/覆盖新增，需与主链保持一致 |             const commands: CommandInput[] = [
ADD src/games/dicethrone/__tests__/flow.test.ts:570 | OK 测试/覆盖新增，需与主链保持一致 |                 ...advanceTo('offensiveRoll', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:571 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('ROLL_DICE', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:572 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('CONFIRM_ROLL', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:573 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('SELECT_ABILITY', '0', { abilityId: fistAttackAbilityId }),
ADD src/games/dicethrone/__tests__/flow.test.ts:574 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('ADVANCE_PHASE', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:575 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('ROLL_DICE', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:576 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('CONFIRM_ROLL', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:577 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('ADVANCE_PHASE', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:578 | OK 测试/覆盖新增，需与主链保持一致 |             ];
ADD src/games/dicethrone/__tests__/flow.test.ts:579 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:580 | OK 测试/覆盖新增，需与主链保持一致 |             for (const input of commands) {
ADD src/games/dicethrone/__tests__/flow.test.ts:581 | OK 测试/覆盖新增，需与主链保持一致 |                 const command = {
ADD src/games/dicethrone/__tests__/flow.test.ts:582 | OK 测试/覆盖新增，需与主链保持一致 |                     type: input.type,
ADD src/games/dicethrone/__tests__/flow.test.ts:583 | OK 测试/覆盖新增，需与主链保持一致 |                     playerId: input.playerId,
ADD src/games/dicethrone/__tests__/flow.test.ts:584 | OK 测试/覆盖新增，需与主链保持一致 |                     payload: input.payload,
ADD src/games/dicethrone/__tests__/flow.test.ts:585 | OK 测试/覆盖新增，需与主链保持一致 |                     timestamp: Date.now(),
ADD src/games/dicethrone/__tests__/flow.test.ts:586 | OK 测试/覆盖新增，需与主链保持一致 |                 } as DiceThroneCommand;
ADD src/games/dicethrone/__tests__/flow.test.ts:587 | OK 测试/覆盖新增，需与主链保持一致 |                 const result = executePipeline(pipelineConfig, state, command, fixedRandom, playerIds);
ADD src/games/dicethrone/__tests__/flow.test.ts:588 | OK 测试/覆盖新增，需与主链保持一致 |                 expect(result.success).toBe(true);
ADD src/games/dicethrone/__tests__/flow.test.ts:589 | OK 测试/覆盖新增，需与主链保持一致 |                 state = result.state as MatchState<DiceThroneCore>;
ADD src/games/dicethrone/__tests__/flow.test.ts:590 | OK 测试/覆盖新增，需与主链保持一致 |             }
ADD src/games/dicethrone/__tests__/flow.test.ts:591 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:592 | OK 测试/覆盖新增，需与主链保持一致 |             state.core.players['3'].hand = [getCardById('card-palm-strike')];
ADD src/games/dicethrone/__tests__/flow.test.ts:593 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:594 | OK 测试/覆盖新增，需与主链保持一致 |             const events = executeCardCommand(
ADD src/games/dicethrone/__tests__/flow.test.ts:595 | OK 测试/覆盖新增，需与主链保持一致 |                 state,
ADD src/games/dicethrone/__tests__/flow.test.ts:596 | OK 测试/覆盖新增，需与主链保持一致 |                 {
ADD src/games/dicethrone/__tests__/flow.test.ts:597 | OK 测试/覆盖新增，需与主链保持一致 |                     type: 'PLAY_CARD',
ADD src/games/dicethrone/__tests__/flow.test.ts:598 | OK 测试/覆盖新增，需与主链保持一致 |                     playerId: '3',
ADD src/games/dicethrone/__tests__/flow.test.ts:599 | OK 测试/覆盖新增，需与主链保持一致 |                     payload: { cardId: 'card-palm-strike' },
ADD src/games/dicethrone/__tests__/flow.test.ts:600 | OK 测试/覆盖新增，需与主链保持一致 |                     timestamp: Date.now(),
ADD src/games/dicethrone/__tests__/flow.test.ts:601 | OK 测试/覆盖新增，需与主链保持一致 |                 } as DiceThroneCommand,
ADD src/games/dicethrone/__tests__/flow.test.ts:602 | OK 测试/覆盖新增，需与主链保持一致 |                 fixedRandom,
ADD src/games/dicethrone/__tests__/flow.test.ts:603 | OK 测试/覆盖新增，需与主链保持一致 |                 state.sys.phase as TurnPhase,
ADD src/games/dicethrone/__tests__/flow.test.ts:604 | OK 测试/覆盖新增，需与主链保持一致 |                 Date.now()
ADD src/games/dicethrone/__tests__/flow.test.ts:605 | OK 测试/覆盖新增，需与主链保持一致 |             );
ADD src/games/dicethrone/__tests__/flow.test.ts:606 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:607 | OK 测试/覆盖新增，需与主链保持一致 |             const appliedStatusEvent = events.find((event) => event.type === 'STATUS_APPLIED');
ADD src/games/dicethrone/__tests__/flow.test.ts:608 | OK 测试/覆盖新增，需与主链保持一致 |             expect(appliedStatusEvent).toBeDefined();
ADD src/games/dicethrone/__tests__/flow.test.ts:609 | OK 测试/覆盖新增，需与主链保持一致 |             expect((appliedStatusEvent as { payload: { targetId: PlayerId } }).payload.targetId).toBe('0');
ADD src/games/dicethrone/__tests__/flow.test.ts:610 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD src/games/dicethrone/__tests__/flow.test.ts:611 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:612 | OK 测试/覆盖新增，需与主链保持一致 |         it('4 人模式下防御掷骰确认后的响应窗口只归当前攻击方', () => {
ADD src/games/dicethrone/__tests__/flow.test.ts:613 | OK 测试/覆盖新增，需与主链保持一致 |             const playerIds: PlayerId[] = ['0', '1', '2', '3'];
ADD src/games/dicethrone/__tests__/flow.test.ts:614 | OK 测试/覆盖新增，需与主链保持一致 |             const pipelineConfig = {
ADD src/games/dicethrone/__tests__/flow.test.ts:615 | OK 测试/覆盖新增，需与主链保持一致 |                 domain: DiceThroneDomain,
ADD src/games/dicethrone/__tests__/flow.test.ts:616 | OK 测试/覆盖新增，需与主链保持一致 |                 systems: testSystems,
ADD src/games/dicethrone/__tests__/flow.test.ts:617 | OK 测试/覆盖新增，需与主链保持一致 |             };
ADD src/games/dicethrone/__tests__/flow.test.ts:618 | OK 测试/覆盖新增，需与主链保持一致 |             let state = createInitializedStateWithCharacters(playerIds, fixedRandom, {
ADD src/games/dicethrone/__tests__/flow.test.ts:619 | OK 测试/覆盖新增，需与主链保持一致 |                 '0': 'monk',
ADD src/games/dicethrone/__tests__/flow.test.ts:620 | OK 测试/覆盖新增，需与主链保持一致 |                 '1': 'barbarian',
ADD src/games/dicethrone/__tests__/flow.test.ts:621 | OK 测试/覆盖新增，需与主链保持一致 |                 '2': 'monk',
ADD src/games/dicethrone/__tests__/flow.test.ts:622 | OK 测试/覆盖新增，需与主链保持一致 |                 '3': 'monk',
ADD src/games/dicethrone/__tests__/flow.test.ts:623 | OK 测试/覆盖新增，需与主链保持一致 |             });
ADD src/games/dicethrone/__tests__/flow.test.ts:624 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:625 | OK 测试/覆盖新增，需与主链保持一致 |             for (const pid of playerIds) {
ADD src/games/dicethrone/__tests__/flow.test.ts:626 | OK 测试/覆盖新增，需与主链保持一致 |                 state.core.players[pid].hand = [];
ADD src/games/dicethrone/__tests__/flow.test.ts:627 | OK 测试/覆盖新增，需与主链保持一致 |                 state.core.players[pid].deck = [];
ADD src/games/dicethrone/__tests__/flow.test.ts:628 | OK 测试/覆盖新增，需与主链保持一致 |             }
ADD src/games/dicethrone/__tests__/flow.test.ts:629 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:630 | OK 测试/覆盖新增，需与主链保持一致 |             const commandsToDefensiveRoll: CommandInput[] = [
ADD src/games/dicethrone/__tests__/flow.test.ts:631 | OK 测试/覆盖新增，需与主链保持一致 |                 ...advanceTo('offensiveRoll', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:632 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('ROLL_DICE', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:633 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('CONFIRM_ROLL', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:634 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('SELECT_ABILITY', '0', { abilityId: fistAttackAbilityId }),
ADD src/games/dicethrone/__tests__/flow.test.ts:635 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('ADVANCE_PHASE', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:636 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('ROLL_DICE', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:637 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('CONFIRM_ROLL', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:638 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('ADVANCE_PHASE', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:639 | OK 测试/覆盖新增，需与主链保持一致 |             ];
ADD src/games/dicethrone/__tests__/flow.test.ts:640 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:641 | OK 测试/覆盖新增，需与主链保持一致 |             for (const input of commandsToDefensiveRoll) {
ADD src/games/dicethrone/__tests__/flow.test.ts:642 | OK 测试/覆盖新增，需与主链保持一致 |                 const command = {
ADD src/games/dicethrone/__tests__/flow.test.ts:643 | OK 测试/覆盖新增，需与主链保持一致 |                     type: input.type,
ADD src/games/dicethrone/__tests__/flow.test.ts:644 | OK 测试/覆盖新增，需与主链保持一致 |                     playerId: input.playerId,
ADD src/games/dicethrone/__tests__/flow.test.ts:645 | OK 测试/覆盖新增，需与主链保持一致 |                     payload: input.payload,
ADD src/games/dicethrone/__tests__/flow.test.ts:646 | OK 测试/覆盖新增，需与主链保持一致 |                     timestamp: Date.now(),
ADD src/games/dicethrone/__tests__/flow.test.ts:647 | OK 测试/覆盖新增，需与主链保持一致 |                 } as DiceThroneCommand;
ADD src/games/dicethrone/__tests__/flow.test.ts:648 | OK 测试/覆盖新增，需与主链保持一致 |                 const result = executePipeline(pipelineConfig, state, command, fixedRandom, playerIds);
ADD src/games/dicethrone/__tests__/flow.test.ts:649 | OK 测试/覆盖新增，需与主链保持一致 |                 expect(result.success).toBe(true);
ADD src/games/dicethrone/__tests__/flow.test.ts:650 | OK 测试/覆盖新增，需与主链保持一致 |                 state = result.state as MatchState<DiceThroneCore>;
ADD src/games/dicethrone/__tests__/flow.test.ts:651 | OK 测试/覆盖新增，需与主链保持一致 |             }
ADD src/games/dicethrone/__tests__/flow.test.ts:652 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:653 | OK 测试/覆盖新增，需与主链保持一致 |             state.core.players['0'].hand = [getCardById('card-flick')];
ADD src/games/dicethrone/__tests__/flow.test.ts:654 | OK 测试/覆盖新增，需与主链保持一致 |             state.core.players['0'].resources[RESOURCE_IDS.CP] = 10;
ADD src/games/dicethrone/__tests__/flow.test.ts:655 | OK 测试/覆盖新增，需与主链保持一致 |             state.core.players['2'].hand = [getCardById('card-flick')];
ADD src/games/dicethrone/__tests__/flow.test.ts:656 | OK 测试/覆盖新增，需与主链保持一致 |             state.core.players['2'].resources[RESOURCE_IDS.CP] = 10;
ADD src/games/dicethrone/__tests__/flow.test.ts:657 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:658 | OK 测试/覆盖新增，需与主链保持一致 |             for (const input of [
ADD src/games/dicethrone/__tests__/flow.test.ts:659 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('ROLL_DICE', '3'),
ADD src/games/dicethrone/__tests__/flow.test.ts:660 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('CONFIRM_ROLL', '3'),
ADD src/games/dicethrone/__tests__/flow.test.ts:661 | OK 测试/覆盖新增，需与主链保持一致 |             ]) {
ADD src/games/dicethrone/__tests__/flow.test.ts:662 | OK 测试/覆盖新增，需与主链保持一致 |                 const command = {
ADD src/games/dicethrone/__tests__/flow.test.ts:663 | OK 测试/覆盖新增，需与主链保持一致 |                     type: input.type,
ADD src/games/dicethrone/__tests__/flow.test.ts:664 | OK 测试/覆盖新增，需与主链保持一致 |                     playerId: input.playerId,
ADD src/games/dicethrone/__tests__/flow.test.ts:665 | OK 测试/覆盖新增，需与主链保持一致 |                     payload: input.payload,
ADD src/games/dicethrone/__tests__/flow.test.ts:666 | OK 测试/覆盖新增，需与主链保持一致 |                     timestamp: Date.now(),
ADD src/games/dicethrone/__tests__/flow.test.ts:667 | OK 测试/覆盖新增，需与主链保持一致 |                 } as DiceThroneCommand;
ADD src/games/dicethrone/__tests__/flow.test.ts:668 | OK 测试/覆盖新增，需与主链保持一致 |                 const result = executePipeline(pipelineConfig, state, command, fixedRandom, playerIds);
ADD src/games/dicethrone/__tests__/flow.test.ts:669 | OK 测试/覆盖新增，需与主链保持一致 |                 expect(result.success).toBe(true);
ADD src/games/dicethrone/__tests__/flow.test.ts:670 | OK 测试/覆盖新增，需与主链保持一致 |                 state = result.state as MatchState<DiceThroneCore>;
ADD src/games/dicethrone/__tests__/flow.test.ts:671 | OK 测试/覆盖新增，需与主链保持一致 |             }
ADD src/games/dicethrone/__tests__/flow.test.ts:672 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:673 | OK 测试/覆盖新增，需与主链保持一致 |             expect(state.sys.responseWindow?.current?.windowType).toBe('afterRollConfirmed');
ADD src/games/dicethrone/__tests__/flow.test.ts:674 | OK 测试/覆盖新增，需与主链保持一致 |             expect(state.sys.responseWindow?.current?.responderQueue).toEqual(['0']);
ADD src/games/dicethrone/__tests__/flow.test.ts:675 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD src/games/dicethrone/__tests__/flow.test.ts:676 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:677 | OK 测试/覆盖新增，需与主链保持一致 |         it('4 人模式在进攻阶段结算后会先进入 targetingRoll', () => {
ADD src/games/dicethrone/__tests__/flow.test.ts:678 | OK 测试/覆盖新增，需与主链保持一致 |             const playerIds: PlayerId[] = ['0', '1', '2', '3'];
ADD src/games/dicethrone/__tests__/flow.test.ts:679 | OK 测试/覆盖新增，需与主链保持一致 |             const pipelineConfig = {
ADD src/games/dicethrone/__tests__/flow.test.ts:680 | OK 测试/覆盖新增，需与主链保持一致 |                 domain: DiceThroneDomain,
ADD src/games/dicethrone/__tests__/flow.test.ts:681 | OK 测试/覆盖新增，需与主链保持一致 |                 systems: testSystems,
ADD src/games/dicethrone/__tests__/flow.test.ts:682 | OK 测试/覆盖新增，需与主链保持一致 |             };
ADD src/games/dicethrone/__tests__/flow.test.ts:683 | OK 测试/覆盖新增，需与主链保持一致 |             let state = createNoResponseSetup()(playerIds, fixedRandom);
ADD src/games/dicethrone/__tests__/flow.test.ts:684 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:685 | OK 测试/覆盖新增，需与主链保持一致 |             const commands: CommandInput[] = [
ADD src/games/dicethrone/__tests__/flow.test.ts:686 | OK 测试/覆盖新增，需与主链保持一致 |                 ...advanceTo('offensiveRoll', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:687 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('ROLL_DICE', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:688 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('CONFIRM_ROLL', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:689 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('SELECT_ABILITY', '0', { abilityId: fistAttackAbilityId }),
ADD src/games/dicethrone/__tests__/flow.test.ts:690 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('ADVANCE_PHASE', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:691 | OK 测试/覆盖新增，需与主链保持一致 |             ];
ADD src/games/dicethrone/__tests__/flow.test.ts:692 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:693 | OK 测试/覆盖新增，需与主链保持一致 |             for (const input of commands) {
ADD src/games/dicethrone/__tests__/flow.test.ts:694 | OK 测试/覆盖新增，需与主链保持一致 |                 const command = {
ADD src/games/dicethrone/__tests__/flow.test.ts:695 | OK 测试/覆盖新增，需与主链保持一致 |                     type: input.type,
ADD src/games/dicethrone/__tests__/flow.test.ts:696 | OK 测试/覆盖新增，需与主链保持一致 |                     playerId: input.playerId,
ADD src/games/dicethrone/__tests__/flow.test.ts:697 | OK 测试/覆盖新增，需与主链保持一致 |                     payload: input.payload,
ADD src/games/dicethrone/__tests__/flow.test.ts:698 | OK 测试/覆盖新增，需与主链保持一致 |                     timestamp: Date.now(),
ADD src/games/dicethrone/__tests__/flow.test.ts:699 | OK 测试/覆盖新增，需与主链保持一致 |                 } as DiceThroneCommand;
ADD src/games/dicethrone/__tests__/flow.test.ts:700 | OK 测试/覆盖新增，需与主链保持一致 |                 const result = executePipeline(pipelineConfig, state, command, fixedRandom, playerIds);
ADD src/games/dicethrone/__tests__/flow.test.ts:701 | OK 测试/覆盖新增，需与主链保持一致 |                 expect(result.success).toBe(true);
ADD src/games/dicethrone/__tests__/flow.test.ts:702 | OK 测试/覆盖新增，需与主链保持一致 |                 state = result.state as MatchState<DiceThroneCore>;
ADD src/games/dicethrone/__tests__/flow.test.ts:703 | OK 测试/覆盖新增，需与主链保持一致 |             }
ADD src/games/dicethrone/__tests__/flow.test.ts:704 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:705 | OK 测试/覆盖新增，需与主链保持一致 |             expect(state.sys.phase).toBe('targetingRoll');
ADD src/games/dicethrone/__tests__/flow.test.ts:706 | OK 测试/覆盖新增，需与主链保持一致 |             expect(state.core.rollLimit).toBe(1);
ADD src/games/dicethrone/__tests__/flow.test.ts:707 | OK 测试/覆盖新增，需与主链保持一致 |             expect(state.core.rollDiceCount).toBe(1);
ADD src/games/dicethrone/__tests__/flow.test.ts:708 | OK 测试/覆盖新增，需与主链保持一致 |             expect(state.core.rollConfirmed).toBe(false);
ADD src/games/dicethrone/__tests__/flow.test.ts:709 | OK 测试/覆盖新增，需与主链保持一致 |             expect(state.core.pendingAttack?.defenderId).toBeUndefined();
ADD src/games/dicethrone/__tests__/flow.test.ts:710 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD src/games/dicethrone/__tests__/flow.test.ts:711 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:712 | OK 测试/覆盖新增，需与主链保持一致 |         it('4 人模式 targetingRoll 掷出 1/2 时自动锁定左侧对手', () => {
ADD src/games/dicethrone/__tests__/flow.test.ts:713 | OK 测试/覆盖新增，需与主链保持一致 |             const playerIds: PlayerId[] = ['0', '1', '2', '3'];
ADD src/games/dicethrone/__tests__/flow.test.ts:714 | OK 测试/覆盖新增，需与主链保持一致 |             const pipelineConfig = {
ADD src/games/dicethrone/__tests__/flow.test.ts:715 | OK 测试/覆盖新增，需与主链保持一致 |                 domain: DiceThroneDomain,
ADD src/games/dicethrone/__tests__/flow.test.ts:716 | OK 测试/覆盖新增，需与主链保持一致 |                 systems: testSystems,
ADD src/games/dicethrone/__tests__/flow.test.ts:717 | OK 测试/覆盖新增，需与主链保持一致 |             };
ADD src/games/dicethrone/__tests__/flow.test.ts:718 | OK 测试/覆盖新增，需与主链保持一致 |             const random = createQueuedRandom([1, 1, 1, 1, 1, 2]);
ADD src/games/dicethrone/__tests__/flow.test.ts:719 | OK 测试/覆盖新增，需与主链保持一致 |             let state = createNoResponseSetup()(playerIds, random);
ADD src/games/dicethrone/__tests__/flow.test.ts:720 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:721 | OK 测试/覆盖新增，需与主链保持一致 |             const commands: CommandInput[] = [
ADD src/games/dicethrone/__tests__/flow.test.ts:722 | OK 测试/覆盖新增，需与主链保持一致 |                 ...advanceTo('offensiveRoll', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:723 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('ROLL_DICE', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:724 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('CONFIRM_ROLL', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:725 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('SELECT_ABILITY', '0', { abilityId: fistAttackAbilityId }),
ADD src/games/dicethrone/__tests__/flow.test.ts:726 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('ADVANCE_PHASE', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:727 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('ROLL_DICE', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:728 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('CONFIRM_ROLL', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:729 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('ADVANCE_PHASE', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:730 | OK 测试/覆盖新增，需与主链保持一致 |             ];
ADD src/games/dicethrone/__tests__/flow.test.ts:731 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:732 | OK 测试/覆盖新增，需与主链保持一致 |             for (const input of commands) {
ADD src/games/dicethrone/__tests__/flow.test.ts:733 | OK 测试/覆盖新增，需与主链保持一致 |                 const command = {
ADD src/games/dicethrone/__tests__/flow.test.ts:734 | OK 测试/覆盖新增，需与主链保持一致 |                     type: input.type,
ADD src/games/dicethrone/__tests__/flow.test.ts:735 | OK 测试/覆盖新增，需与主链保持一致 |                     playerId: input.playerId,
ADD src/games/dicethrone/__tests__/flow.test.ts:736 | OK 测试/覆盖新增，需与主链保持一致 |                     payload: input.payload,
ADD src/games/dicethrone/__tests__/flow.test.ts:737 | OK 测试/覆盖新增，需与主链保持一致 |                     timestamp: Date.now(),
ADD src/games/dicethrone/__tests__/flow.test.ts:738 | OK 测试/覆盖新增，需与主链保持一致 |                 } as DiceThroneCommand;
ADD src/games/dicethrone/__tests__/flow.test.ts:739 | OK 测试/覆盖新增，需与主链保持一致 |                 const result = executePipeline(pipelineConfig, state, command, random, playerIds);
ADD src/games/dicethrone/__tests__/flow.test.ts:740 | OK 测试/覆盖新增，需与主链保持一致 |                 expect(result.success).toBe(true);
ADD src/games/dicethrone/__tests__/flow.test.ts:741 | OK 测试/覆盖新增，需与主链保持一致 |                 state = result.state as MatchState<DiceThroneCore>;
ADD src/games/dicethrone/__tests__/flow.test.ts:742 | OK 测试/覆盖新增，需与主链保持一致 |             }
ADD src/games/dicethrone/__tests__/flow.test.ts:743 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:744 | OK 测试/覆盖新增，需与主链保持一致 |             expect(state.sys.phase).toBe('defensiveRoll');
ADD src/games/dicethrone/__tests__/flow.test.ts:745 | OK 测试/覆盖新增，需与主链保持一致 |             expect(state.core.pendingAttack?.defenderId).toBe('3');
ADD src/games/dicethrone/__tests__/flow.test.ts:746 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD src/games/dicethrone/__tests__/flow.test.ts:747 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:748 | OK 测试/覆盖新增，需与主链保持一致 |         it('4 人模式 targetingRoll 掷出 3/4 时自动锁定右侧对手', () => {
ADD src/games/dicethrone/__tests__/flow.test.ts:749 | OK 测试/覆盖新增，需与主链保持一致 |             const playerIds: PlayerId[] = ['0', '1', '2', '3'];
ADD src/games/dicethrone/__tests__/flow.test.ts:750 | OK 测试/覆盖新增，需与主链保持一致 |             const pipelineConfig = {
ADD src/games/dicethrone/__tests__/flow.test.ts:751 | OK 测试/覆盖新增，需与主链保持一致 |                 domain: DiceThroneDomain,
ADD src/games/dicethrone/__tests__/flow.test.ts:752 | OK 测试/覆盖新增，需与主链保持一致 |                 systems: testSystems,
ADD src/games/dicethrone/__tests__/flow.test.ts:753 | OK 测试/覆盖新增，需与主链保持一致 |             };
ADD src/games/dicethrone/__tests__/flow.test.ts:754 | OK 测试/覆盖新增，需与主链保持一致 |             const random = createQueuedRandom([1, 1, 1, 1, 1, 4]);
ADD src/games/dicethrone/__tests__/flow.test.ts:755 | OK 测试/覆盖新增，需与主链保持一致 |             let state = createNoResponseSetup()(playerIds, random);
ADD src/games/dicethrone/__tests__/flow.test.ts:756 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:757 | OK 测试/覆盖新增，需与主链保持一致 |             const commands: CommandInput[] = [
ADD src/games/dicethrone/__tests__/flow.test.ts:758 | OK 测试/覆盖新增，需与主链保持一致 |                 ...advanceTo('offensiveRoll', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:759 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('ROLL_DICE', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:760 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('CONFIRM_ROLL', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:761 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('SELECT_ABILITY', '0', { abilityId: fistAttackAbilityId }),
ADD src/games/dicethrone/__tests__/flow.test.ts:762 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('ADVANCE_PHASE', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:763 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('ROLL_DICE', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:764 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('CONFIRM_ROLL', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:765 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('ADVANCE_PHASE', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:766 | OK 测试/覆盖新增，需与主链保持一致 |             ];
ADD src/games/dicethrone/__tests__/flow.test.ts:767 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:768 | OK 测试/覆盖新增，需与主链保持一致 |             for (const input of commands) {
ADD src/games/dicethrone/__tests__/flow.test.ts:769 | OK 测试/覆盖新增，需与主链保持一致 |                 const command = {
ADD src/games/dicethrone/__tests__/flow.test.ts:770 | OK 测试/覆盖新增，需与主链保持一致 |                     type: input.type,
ADD src/games/dicethrone/__tests__/flow.test.ts:771 | OK 测试/覆盖新增，需与主链保持一致 |                     playerId: input.playerId,
ADD src/games/dicethrone/__tests__/flow.test.ts:772 | OK 测试/覆盖新增，需与主链保持一致 |                     payload: input.payload,
ADD src/games/dicethrone/__tests__/flow.test.ts:773 | OK 测试/覆盖新增，需与主链保持一致 |                     timestamp: Date.now(),
ADD src/games/dicethrone/__tests__/flow.test.ts:774 | OK 测试/覆盖新增，需与主链保持一致 |                 } as DiceThroneCommand;
ADD src/games/dicethrone/__tests__/flow.test.ts:775 | OK 测试/覆盖新增，需与主链保持一致 |                 const result = executePipeline(pipelineConfig, state, command, random, playerIds);
ADD src/games/dicethrone/__tests__/flow.test.ts:776 | OK 测试/覆盖新增，需与主链保持一致 |                 expect(result.success).toBe(true);
ADD src/games/dicethrone/__tests__/flow.test.ts:777 | OK 测试/覆盖新增，需与主链保持一致 |                 state = result.state as MatchState<DiceThroneCore>;
ADD src/games/dicethrone/__tests__/flow.test.ts:778 | OK 测试/覆盖新增，需与主链保持一致 |             }
ADD src/games/dicethrone/__tests__/flow.test.ts:779 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:780 | OK 测试/覆盖新增，需与主链保持一致 |             expect(state.sys.phase).toBe('defensiveRoll');
ADD src/games/dicethrone/__tests__/flow.test.ts:781 | OK 测试/覆盖新增，需与主链保持一致 |             expect(state.core.pendingAttack?.defenderId).toBe('1');
ADD src/games/dicethrone/__tests__/flow.test.ts:782 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD src/games/dicethrone/__tests__/flow.test.ts:783 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:784 | OK 测试/覆盖新增，需与主链保持一致 |         it('4 人模式 targetingRoll 掷出 5 时由防守队选择目标', () => {
ADD src/games/dicethrone/__tests__/flow.test.ts:785 | OK 测试/覆盖新增，需与主链保持一致 |             const playerIds: PlayerId[] = ['0', '1', '2', '3'];
ADD src/games/dicethrone/__tests__/flow.test.ts:786 | OK 测试/覆盖新增，需与主链保持一致 |             const pipelineConfig = {
ADD src/games/dicethrone/__tests__/flow.test.ts:787 | OK 测试/覆盖新增，需与主链保持一致 |                 domain: DiceThroneDomain,
ADD src/games/dicethrone/__tests__/flow.test.ts:788 | OK 测试/覆盖新增，需与主链保持一致 |                 systems: testSystems,
ADD src/games/dicethrone/__tests__/flow.test.ts:789 | OK 测试/覆盖新增，需与主链保持一致 |             };
ADD src/games/dicethrone/__tests__/flow.test.ts:790 | OK 测试/覆盖新增，需与主链保持一致 |             const random = createQueuedRandom([1, 1, 1, 1, 1, 5]);
ADD src/games/dicethrone/__tests__/flow.test.ts:791 | OK 测试/覆盖新增，需与主链保持一致 |             let state = createNoResponseSetup()(playerIds, random);
ADD src/games/dicethrone/__tests__/flow.test.ts:792 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:793 | OK 测试/覆盖新增，需与主链保持一致 |             const setupCommands: CommandInput[] = [
ADD src/games/dicethrone/__tests__/flow.test.ts:794 | OK 测试/覆盖新增，需与主链保持一致 |                 ...advanceTo('offensiveRoll', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:795 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('ROLL_DICE', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:796 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('CONFIRM_ROLL', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:797 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('SELECT_ABILITY', '0', { abilityId: fistAttackAbilityId }),
ADD src/games/dicethrone/__tests__/flow.test.ts:798 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('ADVANCE_PHASE', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:799 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('ROLL_DICE', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:800 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('CONFIRM_ROLL', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:801 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('ADVANCE_PHASE', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:802 | OK 测试/覆盖新增，需与主链保持一致 |             ];
ADD src/games/dicethrone/__tests__/flow.test.ts:803 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:804 | OK 测试/覆盖新增，需与主链保持一致 |             for (const input of setupCommands) {
ADD src/games/dicethrone/__tests__/flow.test.ts:805 | OK 测试/覆盖新增，需与主链保持一致 |                 const command = {
ADD src/games/dicethrone/__tests__/flow.test.ts:806 | OK 测试/覆盖新增，需与主链保持一致 |                     type: input.type,
ADD src/games/dicethrone/__tests__/flow.test.ts:807 | OK 测试/覆盖新增，需与主链保持一致 |                     playerId: input.playerId,
ADD src/games/dicethrone/__tests__/flow.test.ts:808 | OK 测试/覆盖新增，需与主链保持一致 |                     payload: input.payload,
ADD src/games/dicethrone/__tests__/flow.test.ts:809 | OK 测试/覆盖新增，需与主链保持一致 |                     timestamp: Date.now(),
ADD src/games/dicethrone/__tests__/flow.test.ts:810 | OK 测试/覆盖新增，需与主链保持一致 |                 } as DiceThroneCommand;
ADD src/games/dicethrone/__tests__/flow.test.ts:811 | OK 测试/覆盖新增，需与主链保持一致 |                 const result = executePipeline(pipelineConfig, state, command, random, playerIds);
ADD src/games/dicethrone/__tests__/flow.test.ts:812 | OK 测试/覆盖新增，需与主链保持一致 |                 expect(result.success).toBe(true);
ADD src/games/dicethrone/__tests__/flow.test.ts:813 | OK 测试/覆盖新增，需与主链保持一致 |                 state = result.state as MatchState<DiceThroneCore>;
ADD src/games/dicethrone/__tests__/flow.test.ts:814 | OK 测试/覆盖新增，需与主链保持一致 |             }
ADD src/games/dicethrone/__tests__/flow.test.ts:815 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:816 | OK 测试/覆盖新增，需与主链保持一致 |             expect(state.sys.phase).toBe('targetingRoll');
ADD src/games/dicethrone/__tests__/flow.test.ts:817 | OK 测试/覆盖新增，需与主链保持一致 |             expect(state.sys.interaction.current?.playerId).toBe('3');
ADD src/games/dicethrone/__tests__/flow.test.ts:818 | OK 测试/覆盖新增，需与主链保持一致 |             const choiceOptions = ((state.sys.interaction.current as any)?.data?.options ?? []) as Array<{ id: string; value?: { customId?: string }; disabled?: boolean }>;
ADD src/games/dicethrone/__tests__/flow.test.ts:819 | OK 测试/覆盖新增，需与主链保持一致 |             expect(choiceOptions).toHaveLength(3);
ADD src/games/dicethrone/__tests__/flow.test.ts:820 | OK 测试/覆盖新增，需与主链保持一致 |             expect(choiceOptions.some((option) => option.value?.customId === 'select-target:2' && option.disabled === true)).toBe(true);
ADD src/games/dicethrone/__tests__/flow.test.ts:821 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:822 | OK 测试/覆盖新增，需与主链保持一致 |             const chooseRightOpponent = choiceOptions.find((option) => option.value?.customId === 'select-target:1');
ADD src/games/dicethrone/__tests__/flow.test.ts:823 | OK 测试/覆盖新增，需与主链保持一致 |             expect(chooseRightOpponent).toBeDefined();
ADD src/games/dicethrone/__tests__/flow.test.ts:824 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:825 | OK 测试/覆盖新增，需与主链保持一致 |             const resolveResult = executePipeline(
ADD src/games/dicethrone/__tests__/flow.test.ts:826 | OK 测试/覆盖新增，需与主链保持一致 |                 pipelineConfig,
ADD src/games/dicethrone/__tests__/flow.test.ts:827 | OK 测试/覆盖新增，需与主链保持一致 |                 state,
ADD src/games/dicethrone/__tests__/flow.test.ts:828 | OK 测试/覆盖新增，需与主链保持一致 |                 {
ADD src/games/dicethrone/__tests__/flow.test.ts:829 | OK 测试/覆盖新增，需与主链保持一致 |                     type: 'SYS_INTERACTION_RESPOND',
ADD src/games/dicethrone/__tests__/flow.test.ts:830 | OK 测试/覆盖新增，需与主链保持一致 |                     playerId: '3',
ADD src/games/dicethrone/__tests__/flow.test.ts:831 | OK 测试/覆盖新增，需与主链保持一致 |                     payload: { optionId: chooseRightOpponent!.id },
ADD src/games/dicethrone/__tests__/flow.test.ts:832 | OK 测试/覆盖新增，需与主链保持一致 |                     timestamp: Date.now(),
ADD src/games/dicethrone/__tests__/flow.test.ts:833 | OK 测试/覆盖新增，需与主链保持一致 |                 } as DiceThroneCommand,
ADD src/games/dicethrone/__tests__/flow.test.ts:834 | OK 测试/覆盖新增，需与主链保持一致 |                 random,
ADD src/games/dicethrone/__tests__/flow.test.ts:835 | OK 测试/覆盖新增，需与主链保持一致 |                 playerIds
ADD src/games/dicethrone/__tests__/flow.test.ts:836 | OK 测试/覆盖新增，需与主链保持一致 |             );
ADD src/games/dicethrone/__tests__/flow.test.ts:837 | OK 测试/覆盖新增，需与主链保持一致 |             expect(resolveResult.success).toBe(true);
ADD src/games/dicethrone/__tests__/flow.test.ts:838 | OK 测试/覆盖新增，需与主链保持一致 |             state = resolveResult.state as MatchState<DiceThroneCore>;
ADD src/games/dicethrone/__tests__/flow.test.ts:839 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:840 | OK 测试/覆盖新增，需与主链保持一致 |             expect(state.sys.phase).toBe('defensiveRoll');
ADD src/games/dicethrone/__tests__/flow.test.ts:841 | OK 测试/覆盖新增，需与主链保持一致 |             expect(state.core.pendingAttack?.defenderId).toBe('1');
ADD src/games/dicethrone/__tests__/flow.test.ts:842 | OK 测试/覆盖新增，需与主链保持一致 |             expect(state.core.pendingAttack?.targetingSelectionPending).toBe(false);
ADD src/games/dicethrone/__tests__/flow.test.ts:843 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD src/games/dicethrone/__tests__/flow.test.ts:844 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:845 | OK 测试/覆盖新增，需与主链保持一致 |         it('4 人模式 targetingRoll 掷出 6 时由进攻方选择目标', () => {
ADD src/games/dicethrone/__tests__/flow.test.ts:846 | OK 测试/覆盖新增，需与主链保持一致 |             const playerIds: PlayerId[] = ['0', '1', '2', '3'];
ADD src/games/dicethrone/__tests__/flow.test.ts:847 | OK 测试/覆盖新增，需与主链保持一致 |             const pipelineConfig = {
ADD src/games/dicethrone/__tests__/flow.test.ts:848 | OK 测试/覆盖新增，需与主链保持一致 |                 domain: DiceThroneDomain,
ADD src/games/dicethrone/__tests__/flow.test.ts:849 | OK 测试/覆盖新增，需与主链保持一致 |                 systems: testSystems,
ADD src/games/dicethrone/__tests__/flow.test.ts:850 | OK 测试/覆盖新增，需与主链保持一致 |             };
ADD src/games/dicethrone/__tests__/flow.test.ts:851 | OK 测试/覆盖新增，需与主链保持一致 |             const random = createQueuedRandom([1, 1, 1, 1, 1, 6]);
ADD src/games/dicethrone/__tests__/flow.test.ts:852 | OK 测试/覆盖新增，需与主链保持一致 |             let state = createNoResponseSetup()(playerIds, random);
ADD src/games/dicethrone/__tests__/flow.test.ts:853 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:854 | OK 测试/覆盖新增，需与主链保持一致 |             const setupCommands: CommandInput[] = [
ADD src/games/dicethrone/__tests__/flow.test.ts:855 | OK 测试/覆盖新增，需与主链保持一致 |                 ...advanceTo('offensiveRoll', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:856 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('ROLL_DICE', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:857 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('CONFIRM_ROLL', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:858 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('SELECT_ABILITY', '0', { abilityId: fistAttackAbilityId }),
ADD src/games/dicethrone/__tests__/flow.test.ts:859 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('ADVANCE_PHASE', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:860 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('ROLL_DICE', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:861 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('CONFIRM_ROLL', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:862 | OK 测试/覆盖新增，需与主链保持一致 |                 cmd('ADVANCE_PHASE', '0'),
ADD src/games/dicethrone/__tests__/flow.test.ts:863 | OK 测试/覆盖新增，需与主链保持一致 |             ];
ADD src/games/dicethrone/__tests__/flow.test.ts:864 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:865 | OK 测试/覆盖新增，需与主链保持一致 |             for (const input of setupCommands) {
ADD src/games/dicethrone/__tests__/flow.test.ts:866 | OK 测试/覆盖新增，需与主链保持一致 |                 const command = {
ADD src/games/dicethrone/__tests__/flow.test.ts:867 | OK 测试/覆盖新增，需与主链保持一致 |                     type: input.type,
ADD src/games/dicethrone/__tests__/flow.test.ts:868 | OK 测试/覆盖新增，需与主链保持一致 |                     playerId: input.playerId,
ADD src/games/dicethrone/__tests__/flow.test.ts:869 | OK 测试/覆盖新增，需与主链保持一致 |                     payload: input.payload,
ADD src/games/dicethrone/__tests__/flow.test.ts:870 | OK 测试/覆盖新增，需与主链保持一致 |                     timestamp: Date.now(),
ADD src/games/dicethrone/__tests__/flow.test.ts:871 | OK 测试/覆盖新增，需与主链保持一致 |                 } as DiceThroneCommand;
ADD src/games/dicethrone/__tests__/flow.test.ts:872 | OK 测试/覆盖新增，需与主链保持一致 |                 const result = executePipeline(pipelineConfig, state, command, random, playerIds);
ADD src/games/dicethrone/__tests__/flow.test.ts:873 | OK 测试/覆盖新增，需与主链保持一致 |                 expect(result.success).toBe(true);
ADD src/games/dicethrone/__tests__/flow.test.ts:874 | OK 测试/覆盖新增，需与主链保持一致 |                 state = result.state as MatchState<DiceThroneCore>;
ADD src/games/dicethrone/__tests__/flow.test.ts:875 | OK 测试/覆盖新增，需与主链保持一致 |             }
ADD src/games/dicethrone/__tests__/flow.test.ts:876 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:877 | OK 测试/覆盖新增，需与主链保持一致 |             expect(state.sys.phase).toBe('targetingRoll');
ADD src/games/dicethrone/__tests__/flow.test.ts:878 | OK 测试/覆盖新增，需与主链保持一致 |             expect(state.sys.interaction.current?.playerId).toBe('0');
ADD src/games/dicethrone/__tests__/flow.test.ts:879 | OK 测试/覆盖新增，需与主链保持一致 |             const choiceOptions = ((state.sys.interaction.current as any)?.data?.options ?? []) as Array<{ id: string; value?: { customId?: string } }>;
ADD src/games/dicethrone/__tests__/flow.test.ts:880 | OK 测试/覆盖新增，需与主链保持一致 |             const chooseRightOpponent = choiceOptions.find((option) => option.value?.customId === 'select-target:1');
ADD src/games/dicethrone/__tests__/flow.test.ts:881 | OK 测试/覆盖新增，需与主链保持一致 |             expect(chooseRightOpponent).toBeDefined();
ADD src/games/dicethrone/__tests__/flow.test.ts:882 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:883 | OK 测试/覆盖新增，需与主链保持一致 |             const resolveResult = executePipeline(
ADD src/games/dicethrone/__tests__/flow.test.ts:884 | OK 测试/覆盖新增，需与主链保持一致 |                 pipelineConfig,
ADD src/games/dicethrone/__tests__/flow.test.ts:885 | OK 测试/覆盖新增，需与主链保持一致 |                 state,
ADD src/games/dicethrone/__tests__/flow.test.ts:886 | OK 测试/覆盖新增，需与主链保持一致 |                 {
ADD src/games/dicethrone/__tests__/flow.test.ts:887 | OK 测试/覆盖新增，需与主链保持一致 |                     type: 'SYS_INTERACTION_RESPOND',
ADD src/games/dicethrone/__tests__/flow.test.ts:888 | OK 测试/覆盖新增，需与主链保持一致 |                     playerId: '0',
ADD src/games/dicethrone/__tests__/flow.test.ts:889 | OK 测试/覆盖新增，需与主链保持一致 |                     payload: { optionId: chooseRightOpponent!.id },
ADD src/games/dicethrone/__tests__/flow.test.ts:890 | OK 测试/覆盖新增，需与主链保持一致 |                     timestamp: Date.now(),
ADD src/games/dicethrone/__tests__/flow.test.ts:891 | OK 测试/覆盖新增，需与主链保持一致 |                 } as DiceThroneCommand,
ADD src/games/dicethrone/__tests__/flow.test.ts:892 | OK 测试/覆盖新增，需与主链保持一致 |                 random,
ADD src/games/dicethrone/__tests__/flow.test.ts:893 | OK 测试/覆盖新增，需与主链保持一致 |                 playerIds
ADD src/games/dicethrone/__tests__/flow.test.ts:894 | OK 测试/覆盖新增，需与主链保持一致 |             );
ADD src/games/dicethrone/__tests__/flow.test.ts:895 | OK 测试/覆盖新增，需与主链保持一致 |             expect(resolveResult.success).toBe(true);
ADD src/games/dicethrone/__tests__/flow.test.ts:896 | OK 测试/覆盖新增，需与主链保持一致 |             state = resolveResult.state as MatchState<DiceThroneCore>;
ADD src/games/dicethrone/__tests__/flow.test.ts:897 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/flow.test.ts:898 | OK 测试/覆盖新增，需与主链保持一致 |             expect(state.sys.phase).toBe('defensiveRoll');
ADD src/games/dicethrone/__tests__/flow.test.ts:899 | OK 测试/覆盖新增，需与主链保持一致 |             expect(state.core.pendingAttack?.defenderId).toBe('1');
ADD src/games/dicethrone/__tests__/flow.test.ts:900 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD src/games/dicethrone/__tests__/flow.test.ts:901 | OK 测试/覆盖新增，需与主链保持一致 | 
DEL src/games/dicethrone/__tests__/rule-consistency.test.ts:19 | 注意 删除/收口测试，覆盖减少需确认 | import { getNextPhase, canAdvancePhase, getTokenStackLimit } from '../domain/rules';
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:19 | OK 测试/覆盖新增，需与主链保持一致 | import { getNextPhase, canAdvancePhase, getPlayerOrder, getNextPlayerId, getTokenStackLimit } from '../domain/rules';
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:20 | OK 测试/覆盖新增，需与主链保持一致 | import { validateCommand } from '../domain/commandValidation';
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:21 | OK 测试/覆盖新增，需与主链保持一致 | import { resolveOffensivePreDefenseEffects } from '../domain/attack';
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:23 | OK 测试/覆盖新增，需与主链保持一致 | import { VENGEANCE_2 } from '../heroes/paladin/abilities';
DEL src/games/dicethrone/__tests__/rule-consistency.test.ts:141 | 注意 删除/收口测试，覆盖减少需确认 |             'setup', 'upkeep', 'income', 'main1', 'offensiveRoll', 'defensiveRoll', 'main2', 'discard',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:144 | OK 测试/覆盖新增，需与主链保持一致 |             'setup', 'upkeep', 'income', 'main1', 'offensiveRoll', 'targetingRoll', 'defensiveRoll', 'main2', 'discard',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:186 | OK 测试/覆盖新增，需与主链保持一致 |     it('4 人模式 offensiveRoll 有待结算攻击 → targetingRoll', () => {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:187 | OK 测试/覆盖新增，需与主链保持一致 |         const core = createMockCore({
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:188 | OK 测试/覆盖新增，需与主链保持一致 |             players: {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:189 | OK 测试/覆盖新增，需与主链保持一致 |                 '0': { abilities: CHARACTER_DATA_MAP.monk.abilities } as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:190 | OK 测试/覆盖新增，需与主链保持一致 |                 '1': {} as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:191 | OK 测试/覆盖新增，需与主链保持一致 |                 '2': {} as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:192 | OK 测试/覆盖新增，需与主链保持一致 |                 '3': {} as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:193 | OK 测试/覆盖新增，需与主链保持一致 |             },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:194 | OK 测试/覆盖新增，需与主链保持一致 |             seatingOrder: ['0', '1', '2', '3'],
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:195 | OK 测试/覆盖新增，需与主链保持一致 |             teamIdByPlayerId: {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:196 | OK 测试/覆盖新增，需与主链保持一致 |                 '0': 'A',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:197 | OK 测试/覆盖新增，需与主链保持一致 |                 '1': 'B',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:198 | OK 测试/覆盖新增，需与主链保持一致 |                 '2': 'A',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:199 | OK 测试/覆盖新增，需与主链保持一致 |                 '3': 'B',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:200 | OK 测试/覆盖新增，需与主链保持一致 |             },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:201 | OK 测试/覆盖新增，需与主链保持一致 |             pendingAttack: {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:202 | OK 测试/覆盖新增，需与主链保持一致 |                 attackerId: '0',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:203 | OK 测试/覆盖新增，需与主链保持一致 |                 defenderId: undefined,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:204 | OK 测试/覆盖新增，需与主链保持一致 |                 sourceAbilityId: 'fist-technique-5',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:205 | OK 测试/覆盖新增，需与主链保持一致 |                 isDefendable: true,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:206 | OK 测试/覆盖新增，需与主链保持一致 |             } as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:207 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:208 | OK 测试/覆盖新增，需与主链保持一致 |         const next = getNextPhase(core, 'offensiveRoll');
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:209 | OK 测试/覆盖新增，需与主链保持一致 |         expect(next).toBe('targetingRoll');
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:210 | OK 测试/覆盖新增，需与主链保持一致 |     });
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:211 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:212 | OK 测试/覆盖新增，需与主链保持一致 |     it('4 人模式无单一敌方目标的无伤害技能不进入 targetingRoll', () => {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:213 | OK 测试/覆盖新增，需与主链保持一致 |         const core = createMockCore({
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:214 | OK 测试/覆盖新增，需与主链保持一致 |             players: {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:215 | OK 测试/覆盖新增，需与主链保持一致 |                 '0': { abilities: [structuredClone(VENGEANCE_2)] } as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:216 | OK 测试/覆盖新增，需与主链保持一致 |                 '1': {} as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:217 | OK 测试/覆盖新增，需与主链保持一致 |                 '2': {} as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:218 | OK 测试/覆盖新增，需与主链保持一致 |                 '3': {} as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:219 | OK 测试/覆盖新增，需与主链保持一致 |             },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:220 | OK 测试/覆盖新增，需与主链保持一致 |             seatingOrder: ['0', '1', '2', '3'],
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:221 | OK 测试/覆盖新增，需与主链保持一致 |             teamIdByPlayerId: {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:222 | OK 测试/覆盖新增，需与主链保持一致 |                 '0': 'A',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:223 | OK 测试/覆盖新增，需与主链保持一致 |                 '1': 'B',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:224 | OK 测试/覆盖新增，需与主链保持一致 |                 '2': 'A',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:225 | OK 测试/覆盖新增，需与主链保持一致 |                 '3': 'B',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:226 | OK 测试/覆盖新增，需与主链保持一致 |             },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:227 | OK 测试/覆盖新增，需与主链保持一致 |             pendingAttack: {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:228 | OK 测试/覆盖新增，需与主链保持一致 |                 attackerId: '0',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:229 | OK 测试/覆盖新增，需与主链保持一致 |                 defenderId: undefined,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:230 | OK 测试/覆盖新增，需与主链保持一致 |                 sourceAbilityId: 'vengeance-2-main',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:231 | OK 测试/覆盖新增，需与主链保持一致 |                 isDefendable: false,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:232 | OK 测试/覆盖新增，需与主链保持一致 |             } as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:233 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:234 | OK 测试/覆盖新增，需与主链保持一致 |         const next = getNextPhase(core, 'offensiveRoll');
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:235 | OK 测试/覆盖新增，需与主链保持一致 |         expect(next).toBe('main2');
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:236 | OK 测试/覆盖新增，需与主链保持一致 |     });
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:237 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:261 | OK 测试/覆盖新增，需与主链保持一致 |     it('4 人模式起始玩家为 1 号位时按同队连走后再切换敌队', () => {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:262 | OK 测试/覆盖新增，需与主链保持一致 |         const core = createMockCore({
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:263 | OK 测试/覆盖新增，需与主链保持一致 |             players: {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:264 | OK 测试/覆盖新增，需与主链保持一致 |                 '0': {} as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:265 | OK 测试/覆盖新增，需与主链保持一致 |                 '1': {} as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:266 | OK 测试/覆盖新增，需与主链保持一致 |                 '2': {} as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:267 | OK 测试/覆盖新增，需与主链保持一致 |                 '3': {} as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:268 | OK 测试/覆盖新增，需与主链保持一致 |             },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:269 | OK 测试/覆盖新增，需与主链保持一致 |             seatingOrder: ['0', '1', '2', '3'],
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:270 | OK 测试/覆盖新增，需与主链保持一致 |             teamIdByPlayerId: {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:271 | OK 测试/覆盖新增，需与主链保持一致 |                 '0': 'A',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:272 | OK 测试/覆盖新增，需与主链保持一致 |                 '1': 'B',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:273 | OK 测试/覆盖新增，需与主链保持一致 |                 '2': 'A',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:274 | OK 测试/覆盖新增，需与主链保持一致 |                 '3': 'B',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:275 | OK 测试/覆盖新增，需与主链保持一致 |             },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:276 | OK 测试/覆盖新增，需与主链保持一致 |             startingPlayerId: '1',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:277 | OK 测试/覆盖新增，需与主链保持一致 |             activePlayerId: '1',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:278 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:279 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:280 | OK 测试/覆盖新增，需与主链保持一致 |         expect(getPlayerOrder(core)).toEqual(['1', '3', '0', '2']);
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:281 | OK 测试/覆盖新增，需与主链保持一致 |         expect(getNextPlayerId(core)).toBe('3');
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:282 | OK 测试/覆盖新增，需与主链保持一致 |     });
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:283 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:442 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:443 | OK 测试/覆盖新增，需与主链保持一致 | describe('Property 9: 4 人玩家目标交互验证', () => {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:444 | OK 测试/覆盖新增，需与主链保持一致 |     const createFourPlayerCore = (overrides: Partial<DiceThroneCore> = {}): DiceThroneCore => ({
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:445 | OK 测试/覆盖新增，需与主链保持一致 |         players: {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:446 | OK 测试/覆盖新增，需与主链保持一致 |             '0': { statusEffects: {}, tokens: {}, hand: [], resources: {} } as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:447 | OK 测试/覆盖新增，需与主链保持一致 |             '1': { statusEffects: { poison: 1 }, tokens: {}, hand: [], resources: {} } as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:448 | OK 测试/覆盖新增，需与主链保持一致 |             '2': { statusEffects: {}, tokens: { crit: 1 }, hand: [], resources: {} } as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:449 | OK 测试/覆盖新增，需与主链保持一致 |             '3': { statusEffects: {}, tokens: {}, hand: [], resources: {} } as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:450 | OK 测试/覆盖新增，需与主链保持一致 |         },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:451 | OK 测试/覆盖新增，需与主链保持一致 |         activePlayerId: '0',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:452 | OK 测试/覆盖新增，需与主链保持一致 |         startingPlayerId: '0',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:453 | OK 测试/覆盖新增，需与主链保持一致 |         turnNumber: 2,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:454 | OK 测试/覆盖新增，需与主链保持一致 |         pendingAttack: null,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:455 | OK 测试/覆盖新增，需与主链保持一致 |         selectedCharacters: { '0': 'paladin', '1': 'barbarian', '2': 'monk', '3': 'pyromancer' },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:456 | OK 测试/覆盖新增，需与主链保持一致 |         readyPlayers: {},
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:457 | OK 测试/覆盖新增，需与主链保持一致 |         hostPlayerId: '0',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:458 | OK 测试/覆盖新增，需与主链保持一致 |         hostStarted: true,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:459 | OK 测试/覆盖新增，需与主链保持一致 |         dice: [],
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:460 | OK 测试/覆盖新增，需与主链保持一致 |         rollCount: 0,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:461 | OK 测试/覆盖新增，需与主链保持一致 |         rollLimit: 3,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:462 | OK 测试/覆盖新增，需与主链保持一致 |         rollDiceCount: 5,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:463 | OK 测试/覆盖新增，需与主链保持一致 |         rollConfirmed: false,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:464 | OK 测试/覆盖新增，需与主链保持一致 |         tokenDefinitions: ALL_TOKEN_DEFINITIONS,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:465 | OK 测试/覆盖新增，需与主链保持一致 |         seatingOrder: ['0', '1', '2', '3'],
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:466 | OK 测试/覆盖新增，需与主链保持一致 |         teamIdByPlayerId: { '0': 'A', '1': 'B', '2': 'A', '3': 'B' },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:467 | OK 测试/覆盖新增，需与主链保持一致 |         ...overrides,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:468 | OK 测试/覆盖新增，需与主链保持一致 |     } as DiceThroneCore);
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:469 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:470 | OK 测试/覆盖新增，需与主链保持一致 |     it('GRANT_TOKENS 只允许命中交互候选集中的玩家', () => {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:471 | OK 测试/覆盖新增，需与主链保持一致 |         const core = createFourPlayerCore();
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:472 | OK 测试/覆盖新增，需与主链保持一致 |         const result = validateCommand(
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:473 | OK 测试/覆盖新增，需与主链保持一致 |             core,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:474 | OK 测试/覆盖新增，需与主链保持一致 |             {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:475 | OK 测试/覆盖新增，需与主链保持一致 |                 type: 'GRANT_TOKENS',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:476 | OK 测试/覆盖新增，需与主链保持一致 |                 playerId: '0',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:477 | OK 测试/覆盖新增，需与主链保持一致 |                 payload: {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:478 | OK 测试/覆盖新增，需与主链保持一致 |                     targetPlayerId: '3',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:479 | OK 测试/覆盖新增，需与主链保持一致 |                     tokens: [{ tokenId: TOKEN_IDS.RETRIBUTION, amount: 1 }],
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:480 | OK 测试/覆盖新增，需与主链保持一致 |                 },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:481 | OK 测试/覆盖新增，需与主链保持一致 |             } as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:482 | OK 测试/覆盖新增，需与主链保持一致 |             'main2',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:483 | OK 测试/覆盖新增，需与主链保持一致 |             {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:484 | OK 测试/覆盖新增，需与主链保持一致 |                 id: 'grant-retribution',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:485 | OK 测试/覆盖新增，需与主链保持一致 |                 playerId: '0',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:486 | OK 测试/覆盖新增，需与主链保持一致 |                 sourceCardId: 'vengeance',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:487 | OK 测试/覆盖新增，需与主链保持一致 |                 type: 'selectPlayer',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:488 | OK 测试/覆盖新增，需与主链保持一致 |                 titleKey: 'interaction.selectPlayerForRetribution',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:489 | OK 测试/覆盖新增，需与主链保持一致 |                 selectCount: 1,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:490 | OK 测试/覆盖新增，需与主链保持一致 |                 selected: [],
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:491 | OK 测试/覆盖新增，需与主链保持一致 |                 targetPlayerIds: ['0', '2'],
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:492 | OK 测试/覆盖新增，需与主链保持一致 |                 tokenGrantConfig: { tokenId: TOKEN_IDS.RETRIBUTION, amount: 1 },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:493 | OK 测试/覆盖新增，需与主链保持一致 |             },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:494 | OK 测试/覆盖新增，需与主链保持一致 |         );
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:495 | OK 测试/覆盖新增，需与主链保持一致 |         expect(result.valid).toBe(false);
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:496 | OK 测试/覆盖新增，需与主链保持一致 |         expect(result.error).toBe('invalid_target_player');
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:497 | OK 测试/覆盖新增，需与主链保持一致 |     });
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:498 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:499 | OK 测试/覆盖新增，需与主链保持一致 |     it('GRANT_TOKENS 在 4 人模式下允许多 token 配置授予给合法队友目标', () => {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:500 | OK 测试/覆盖新增，需与主链保持一致 |         const core = createFourPlayerCore();
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:501 | OK 测试/覆盖新增，需与主链保持一致 |         const result = validateCommand(
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:502 | OK 测试/覆盖新增，需与主链保持一致 |             core,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:503 | OK 测试/覆盖新增，需与主链保持一致 |             {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:504 | OK 测试/覆盖新增，需与主链保持一致 |                 type: 'GRANT_TOKENS',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:505 | OK 测试/覆盖新增，需与主链保持一致 |                 playerId: '0',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:506 | OK 测试/覆盖新增，需与主链保持一致 |                 payload: {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:507 | OK 测试/覆盖新增，需与主链保持一致 |                     targetPlayerId: '2',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:508 | OK 测试/覆盖新增，需与主链保持一致 |                     tokens: [
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:509 | OK 测试/覆盖新增，需与主链保持一致 |                         { tokenId: TOKEN_IDS.PROTECT, amount: 1 },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:510 | OK 测试/覆盖新增，需与主链保持一致 |                         { tokenId: TOKEN_IDS.RETRIBUTION, amount: 1 },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:511 | OK 测试/覆盖新增，需与主链保持一致 |                         { tokenId: TOKEN_IDS.CRIT, amount: 1 },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:512 | OK 测试/覆盖新增，需与主链保持一致 |                         { tokenId: TOKEN_IDS.ACCURACY, amount: 1 },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:513 | OK 测试/覆盖新增，需与主链保持一致 |                     ],
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:514 | OK 测试/覆盖新增，需与主链保持一致 |                 },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:515 | OK 测试/覆盖新增，需与主链保持一致 |             } as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:516 | OK 测试/覆盖新增，需与主链保持一致 |             'main2',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:517 | OK 测试/覆盖新增，需与主链保持一致 |             {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:518 | OK 测试/覆盖新增，需与主链保持一致 |                 id: 'consecrate',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:519 | OK 测试/覆盖新增，需与主链保持一致 |                 playerId: '0',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:520 | OK 测试/覆盖新增，需与主链保持一致 |                 sourceCardId: 'card-consecrate',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:521 | OK 测试/覆盖新增，需与主链保持一致 |                 type: 'selectPlayer',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:522 | OK 测试/覆盖新增，需与主链保持一致 |                 titleKey: 'interaction.selectPlayerForConsecrate',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:523 | OK 测试/覆盖新增，需与主链保持一致 |                 selectCount: 1,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:524 | OK 测试/覆盖新增，需与主链保持一致 |                 selected: [],
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:525 | OK 测试/覆盖新增，需与主链保持一致 |                 targetPlayerIds: ['0', '1', '2', '3'],
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:526 | OK 测试/覆盖新增，需与主链保持一致 |                 tokenGrantConfigs: [
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:527 | OK 测试/覆盖新增，需与主链保持一致 |                     { tokenId: TOKEN_IDS.PROTECT, amount: 1 },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:528 | OK 测试/覆盖新增，需与主链保持一致 |                     { tokenId: TOKEN_IDS.RETRIBUTION, amount: 1 },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:529 | OK 测试/覆盖新增，需与主链保持一致 |                     { tokenId: TOKEN_IDS.CRIT, amount: 1 },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:530 | OK 测试/覆盖新增，需与主链保持一致 |                     { tokenId: TOKEN_IDS.ACCURACY, amount: 1 },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:531 | OK 测试/覆盖新增，需与主链保持一致 |                 ],
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:532 | OK 测试/覆盖新增，需与主链保持一致 |             },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:533 | OK 测试/覆盖新增，需与主链保持一致 |         );
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:534 | OK 测试/覆盖新增，需与主链保持一致 |         expect(result.valid).toBe(true);
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:535 | OK 测试/覆盖新增，需与主链保持一致 |     });
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:536 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:537 | OK 测试/覆盖新增，需与主链保持一致 |     it('GRANT_TOKENS 在 4 人模式下允许单 token 配置授予给合法队友目标', () => {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:538 | OK 测试/覆盖新增，需与主链保持一致 |         const core = createFourPlayerCore();
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:539 | OK 测试/覆盖新增，需与主链保持一致 |         const result = validateCommand(
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:540 | OK 测试/覆盖新增，需与主链保持一致 |             core,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:541 | OK 测试/覆盖新增，需与主链保持一致 |             {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:542 | OK 测试/覆盖新增，需与主链保持一致 |                 type: 'GRANT_TOKENS',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:543 | OK 测试/覆盖新增，需与主链保持一致 |                 playerId: '0',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:544 | OK 测试/覆盖新增，需与主链保持一致 |                 payload: {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:545 | OK 测试/覆盖新增，需与主链保持一致 |                     targetPlayerId: '2',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:546 | OK 测试/覆盖新增，需与主链保持一致 |                     tokens: [{ tokenId: TOKEN_IDS.RETRIBUTION, amount: 1 }],
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:547 | OK 测试/覆盖新增，需与主链保持一致 |                 },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:548 | OK 测试/覆盖新增，需与主链保持一致 |             } as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:549 | OK 测试/覆盖新增，需与主链保持一致 |             'offensiveRoll',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:550 | OK 测试/覆盖新增，需与主链保持一致 |             {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:551 | OK 测试/覆盖新增，需与主链保持一致 |                 id: 'vengeance',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:552 | OK 测试/覆盖新增，需与主链保持一致 |                 playerId: '0',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:553 | OK 测试/覆盖新增，需与主链保持一致 |                 sourceCardId: 'vengeance',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:554 | OK 测试/覆盖新增，需与主链保持一致 |                 type: 'selectPlayer',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:555 | OK 测试/覆盖新增，需与主链保持一致 |                 titleKey: 'interaction.selectPlayerForRetribution',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:556 | OK 测试/覆盖新增，需与主链保持一致 |                 selectCount: 1,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:557 | OK 测试/覆盖新增，需与主链保持一致 |                 selected: [],
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:558 | OK 测试/覆盖新增，需与主链保持一致 |                 targetPlayerIds: ['0', '1', '2', '3'],
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:559 | OK 测试/覆盖新增，需与主链保持一致 |                 tokenGrantConfig: { tokenId: TOKEN_IDS.RETRIBUTION, amount: 1 },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:560 | OK 测试/覆盖新增，需与主链保持一致 |             },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:561 | OK 测试/覆盖新增，需与主链保持一致 |         );
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:562 | OK 测试/覆盖新增，需与主链保持一致 |         expect(result.valid).toBe(true);
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:563 | OK 测试/覆盖新增，需与主链保持一致 |     });
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:564 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:565 | OK 测试/覆盖新增，需与主链保持一致 |     it('无默认 defender 的 4 人无伤害技能仍会执行 preDefense 交互效果', () => {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:566 | OK 测试/覆盖新增，需与主链保持一致 |         const core = createFourPlayerCore({
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:567 | OK 测试/覆盖新增，需与主链保持一致 |             players: {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:568 | OK 测试/覆盖新增，需与主链保持一致 |                 '0': {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:569 | OK 测试/覆盖新增，需与主链保持一致 |                     statusEffects: {},
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:570 | OK 测试/覆盖新增，需与主链保持一致 |                     tokens: {},
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:571 | OK 测试/覆盖新增，需与主链保持一致 |                     hand: [],
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:572 | OK 测试/覆盖新增，需与主链保持一致 |                     resources: {},
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:573 | OK 测试/覆盖新增，需与主链保持一致 |                     abilities: [structuredClone(VENGEANCE_2)],
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:574 | OK 测试/覆盖新增，需与主链保持一致 |                 } as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:575 | OK 测试/覆盖新增，需与主链保持一致 |                 '1': { statusEffects: {}, tokens: {}, hand: [], resources: {} } as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:576 | OK 测试/覆盖新增，需与主链保持一致 |                 '2': { statusEffects: {}, tokens: {}, hand: [], resources: {} } as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:577 | OK 测试/覆盖新增，需与主链保持一致 |                 '3': { statusEffects: {}, tokens: {}, hand: [], resources: {} } as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:578 | OK 测试/覆盖新增，需与主链保持一致 |             },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:579 | OK 测试/覆盖新增，需与主链保持一致 |             pendingAttack: {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:580 | OK 测试/覆盖新增，需与主链保持一致 |                 attackerId: '0',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:581 | OK 测试/覆盖新增，需与主链保持一致 |                 defenderId: undefined,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:582 | OK 测试/覆盖新增，需与主链保持一致 |                 sourceAbilityId: 'vengeance-2-main',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:583 | OK 测试/覆盖新增，需与主链保持一致 |                 preDefenseResolved: false,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:584 | OK 测试/覆盖新增，需与主链保持一致 |                 isDefendable: false,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:585 | OK 测试/覆盖新增，需与主链保持一致 |             } as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:586 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:587 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:588 | OK 测试/覆盖新增，需与主链保持一致 |         const events = resolveOffensivePreDefenseEffects(core, 123);
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:589 | OK 测试/覆盖新增，需与主链保持一致 |         const interactionEvent = events.find((event) => event.type === 'INTERACTION_REQUESTED') as any;
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:590 | OK 测试/覆盖新增，需与主链保持一致 |         const resolvedEvent = events.find((event) => event.type === 'ATTACK_PRE_DEFENSE_RESOLVED') as any;
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:591 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:592 | OK 测试/覆盖新增，需与主链保持一致 |         expect(interactionEvent).toBeTruthy();
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:593 | OK 测试/覆盖新增，需与主链保持一致 |         expect(interactionEvent.payload.interaction.type).toBe('selectPlayer');
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:594 | OK 测试/覆盖新增，需与主链保持一致 |         expect(interactionEvent.payload.interaction.targetPlayerIds).toEqual(['0', '1', '2', '3']);
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:595 | OK 测试/覆盖新增，需与主链保持一致 |         expect(interactionEvent.payload.interaction.tokenGrantConfig).toEqual({
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:596 | OK 测试/覆盖新增，需与主链保持一致 |             tokenId: TOKEN_IDS.RETRIBUTION,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:597 | OK 测试/覆盖新增，需与主链保持一致 |             amount: 1,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:598 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:599 | OK 测试/覆盖新增，需与主链保持一致 |         expect(resolvedEvent).toBeTruthy();
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:600 | OK 测试/覆盖新增，需与主链保持一致 |         expect(resolvedEvent.payload.defenderId).toBeUndefined();
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:601 | OK 测试/覆盖新增，需与主链保持一致 |     });
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:602 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:603 | OK 测试/覆盖新增，需与主链保持一致 |     it('TRANSFER_STATUS 禁止把状态或 token 转移回来源玩家自己', () => {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:604 | OK 测试/覆盖新增，需与主链保持一致 |         const core = createFourPlayerCore();
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:605 | OK 测试/覆盖新增，需与主链保持一致 |         const result = validateCommand(
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:606 | OK 测试/覆盖新增，需与主链保持一致 |             core,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:607 | OK 测试/覆盖新增，需与主链保持一致 |             {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:608 | OK 测试/覆盖新增，需与主链保持一致 |                 type: 'TRANSFER_STATUS',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:609 | OK 测试/覆盖新增，需与主链保持一致 |                 playerId: '0',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:610 | OK 测试/覆盖新增，需与主链保持一致 |                 payload: {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:611 | OK 测试/覆盖新增，需与主链保持一致 |                     fromPlayerId: '2',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:612 | OK 测试/覆盖新增，需与主链保持一致 |                     toPlayerId: '2',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:613 | OK 测试/覆盖新增，需与主链保持一致 |                     statusId: TOKEN_IDS.CRIT,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:614 | OK 测试/覆盖新增，需与主链保持一致 |                 },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:615 | OK 测试/覆盖新增，需与主链保持一致 |             } as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:616 | OK 测试/覆盖新增，需与主链保持一致 |             'main2',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:617 | OK 测试/覆盖新增，需与主链保持一致 |             {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:618 | OK 测试/覆盖新增，需与主链保持一致 |                 id: 'transfer-status',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:619 | OK 测试/覆盖新增，需与主链保持一致 |                 playerId: '0',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:620 | OK 测试/覆盖新增，需与主链保持一致 |                 sourceCardId: 'card-transfer-status',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:621 | OK 测试/覆盖新增，需与主链保持一致 |                 type: 'selectTargetStatus',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:622 | OK 测试/覆盖新增，需与主链保持一致 |                 titleKey: 'interaction.selectStatusToTransfer',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:623 | OK 测试/覆盖新增，需与主链保持一致 |                 selectCount: 1,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:624 | OK 测试/覆盖新增，需与主链保持一致 |                 selected: [],
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:625 | OK 测试/覆盖新增，需与主链保持一致 |                 targetPlayerIds: ['0', '1', '2', '3'],
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:626 | OK 测试/覆盖新增，需与主链保持一致 |                 transferConfig: {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:627 | OK 测试/覆盖新增，需与主链保持一致 |                     sourcePlayerId: '2',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:628 | OK 测试/覆盖新增，需与主链保持一致 |                     statusId: TOKEN_IDS.CRIT,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:629 | OK 测试/覆盖新增，需与主链保持一致 |                 },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:630 | OK 测试/覆盖新增，需与主链保持一致 |             },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:631 | OK 测试/覆盖新增，需与主链保持一致 |         );
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:632 | OK 测试/覆盖新增，需与主链保持一致 |         expect(result.valid).toBe(false);
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:633 | OK 测试/覆盖新增，需与主链保持一致 |         expect(result.error).toBe('invalid_target_player');
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:634 | OK 测试/覆盖新增，需与主链保持一致 |     });
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:635 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:636 | OK 测试/覆盖新增，需与主链保持一致 |     it('TRANSFER_STATUS 在在线双阶段 UI 的 selectStatus 权威态下仍允许合法 4 人 token 转移', () => {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:637 | OK 测试/覆盖新增，需与主链保持一致 |         const core = createFourPlayerCore({
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:638 | OK 测试/覆盖新增，需与主链保持一致 |             players: {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:639 | OK 测试/覆盖新增，需与主链保持一致 |                 '0': { resources: {}, statusEffects: {}, tokens: {} } as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:640 | OK 测试/覆盖新增，需与主链保持一致 |                 '1': { resources: {}, statusEffects: {}, tokens: { [TOKEN_IDS.CRIT]: 1 } } as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:641 | OK 测试/覆盖新增，需与主链保持一致 |                 '2': { resources: {}, statusEffects: {}, tokens: {} } as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:642 | OK 测试/覆盖新增，需与主链保持一致 |                 '3': { resources: {}, statusEffects: {}, tokens: {} } as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:643 | OK 测试/覆盖新增，需与主链保持一致 |             },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:644 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:645 | OK 测试/覆盖新增，需与主链保持一致 |         const result = validateCommand(
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:646 | OK 测试/覆盖新增，需与主链保持一致 |             core,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:647 | OK 测试/覆盖新增，需与主链保持一致 |             {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:648 | OK 测试/覆盖新增，需与主链保持一致 |                 type: 'TRANSFER_STATUS',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:649 | OK 测试/覆盖新增，需与主链保持一致 |                 playerId: '0',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:650 | OK 测试/覆盖新增，需与主链保持一致 |                 payload: {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:651 | OK 测试/覆盖新增，需与主链保持一致 |                     fromPlayerId: '1',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:652 | OK 测试/覆盖新增，需与主链保持一致 |                     toPlayerId: '2',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:653 | OK 测试/覆盖新增，需与主链保持一致 |                     statusId: TOKEN_IDS.CRIT,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:654 | OK 测试/覆盖新增，需与主链保持一致 |                 },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:655 | OK 测试/覆盖新增，需与主链保持一致 |             } as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:656 | OK 测试/覆盖新增，需与主链保持一致 |             'main2',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:657 | OK 测试/覆盖新增，需与主链保持一致 |             {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:658 | OK 测试/覆盖新增，需与主链保持一致 |                 id: 'transfer-status-live',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:659 | OK 测试/覆盖新增，需与主链保持一致 |                 playerId: '0',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:660 | OK 测试/覆盖新增，需与主链保持一致 |                 sourceCardId: 'card-transfer-status',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:661 | OK 测试/覆盖新增，需与主链保持一致 |                 type: 'selectStatus',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:662 | OK 测试/覆盖新增，需与主链保持一致 |                 titleKey: 'interaction.selectStatusToTransfer',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:663 | OK 测试/覆盖新增，需与主链保持一致 |                 selectCount: 1,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:664 | OK 测试/覆盖新增，需与主链保持一致 |                 selected: [],
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:665 | OK 测试/覆盖新增，需与主链保持一致 |                 targetPlayerIds: ['0', '1', '2', '3'],
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:666 | OK 测试/覆盖新增，需与主链保持一致 |                 transferConfig: {},
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:667 | OK 测试/覆盖新增，需与主链保持一致 |             },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:668 | OK 测试/覆盖新增，需与主链保持一致 |         );
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:669 | OK 测试/覆盖新增，需与主链保持一致 |         expect(result.valid).toBe(true);
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:670 | OK 测试/覆盖新增，需与主链保持一致 |     });
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:671 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:672 | OK 测试/覆盖新增，需与主链保持一致 |     it('REMOVE_STATUS 在 requiresTargetWithStatus=true 时拒绝空目标', () => {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:673 | OK 测试/覆盖新增，需与主链保持一致 |         const core = createFourPlayerCore();
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:674 | OK 测试/覆盖新增，需与主链保持一致 |         const result = validateCommand(
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:675 | OK 测试/覆盖新增，需与主链保持一致 |             core,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:676 | OK 测试/覆盖新增，需与主链保持一致 |             {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:677 | OK 测试/覆盖新增，需与主链保持一致 |                 type: 'REMOVE_STATUS',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:678 | OK 测试/覆盖新增，需与主链保持一致 |                 playerId: '0',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:679 | OK 测试/覆盖新增，需与主链保持一致 |                 payload: {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:680 | OK 测试/覆盖新增，需与主链保持一致 |                     targetPlayerId: '3',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:681 | OK 测试/覆盖新增，需与主链保持一致 |                 },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:682 | OK 测试/覆盖新增，需与主链保持一致 |             } as any,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:683 | OK 测试/覆盖新增，需与主链保持一致 |             'main2',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:684 | OK 测试/覆盖新增，需与主链保持一致 |             {
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:685 | OK 测试/覆盖新增，需与主链保持一致 |                 id: 'remove-all-status',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:686 | OK 测试/覆盖新增，需与主链保持一致 |                 playerId: '0',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:687 | OK 测试/覆盖新增，需与主链保持一致 |                 sourceCardId: 'card-what-status',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:688 | OK 测试/覆盖新增，需与主链保持一致 |                 type: 'selectPlayer',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:689 | OK 测试/覆盖新增，需与主链保持一致 |                 titleKey: 'interaction.selectPlayerToRemoveAllStatus',
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:690 | OK 测试/覆盖新增，需与主链保持一致 |                 selectCount: 1,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:691 | OK 测试/覆盖新增，需与主链保持一致 |                 selected: [],
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:692 | OK 测试/覆盖新增，需与主链保持一致 |                 targetPlayerIds: ['0', '1', '2', '3'],
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:693 | OK 测试/覆盖新增，需与主链保持一致 |                 requiresTargetWithStatus: true,
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:694 | OK 测试/覆盖新增，需与主链保持一致 |             },
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:695 | OK 测试/覆盖新增，需与主链保持一致 |         );
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:696 | OK 测试/覆盖新增，需与主链保持一致 |         expect(result.valid).toBe(false);
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:697 | OK 测试/覆盖新增，需与主链保持一致 |         expect(result.error).toBe('target_has_no_status');
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:698 | OK 测试/覆盖新增，需与主链保持一致 |     });
ADD src/games/dicethrone/__tests__/rule-consistency.test.ts:699 | OK 测试/覆盖新增，需与主链保持一致 | });
DEL src/games/dicethrone/__tests__/test-utils.ts:83 | 注意 删除/收口测试，覆盖减少需确认 | export const setupCommands: CommandInput[] = [
DEL src/games/dicethrone/__tests__/test-utils.ts:84 | 注意 删除/收口测试，覆盖减少需确认 |     { type: 'SELECT_CHARACTER', playerId: '0', payload: { characterId: 'monk' } },
DEL src/games/dicethrone/__tests__/test-utils.ts:85 | 注意 删除/收口测试，覆盖减少需确认 |     { type: 'SELECT_CHARACTER', playerId: '1', payload: { characterId: 'monk' } },
DEL src/games/dicethrone/__tests__/test-utils.ts:86 | 注意 删除/收口测试，覆盖减少需确认 |     { type: 'PLAYER_READY', playerId: '1', payload: {} },
DEL src/games/dicethrone/__tests__/test-utils.ts:87 | 注意 删除/收口测试，覆盖减少需确认 |     { type: 'HOST_START_GAME', playerId: '0', payload: {} },
DEL src/games/dicethrone/__tests__/test-utils.ts:88 | 注意 删除/收口测试，覆盖减少需确认 | ];
ADD src/games/dicethrone/__tests__/test-utils.ts:83 | OK 测试/覆盖新增，需与主链保持一致 | export const buildSetupCommands = (playerIds: PlayerId[]): CommandInput[] => {
ADD src/games/dicethrone/__tests__/test-utils.ts:84 | OK 测试/覆盖新增，需与主链保持一致 |     const hostPlayerId = playerIds[0];
ADD src/games/dicethrone/__tests__/test-utils.ts:85 | OK 测试/覆盖新增，需与主链保持一致 |     const commands: CommandInput[] = playerIds.map((playerId) => ({
ADD src/games/dicethrone/__tests__/test-utils.ts:86 | OK 测试/覆盖新增，需与主链保持一致 |         type: 'SELECT_CHARACTER',
ADD src/games/dicethrone/__tests__/test-utils.ts:87 | OK 测试/覆盖新增，需与主链保持一致 |         playerId,
ADD src/games/dicethrone/__tests__/test-utils.ts:88 | OK 测试/覆盖新增，需与主链保持一致 |         payload: { characterId: 'monk' },
ADD src/games/dicethrone/__tests__/test-utils.ts:89 | OK 测试/覆盖新增，需与主链保持一致 |     }));
ADD src/games/dicethrone/__tests__/test-utils.ts:90 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/test-utils.ts:91 | OK 测试/覆盖新增，需与主链保持一致 |     playerIds.forEach((playerId) => {
ADD src/games/dicethrone/__tests__/test-utils.ts:92 | OK 测试/覆盖新增，需与主链保持一致 |         if (playerId === hostPlayerId) return;
ADD src/games/dicethrone/__tests__/test-utils.ts:93 | OK 测试/覆盖新增，需与主链保持一致 |         commands.push({ type: 'PLAYER_READY', playerId, payload: {} });
ADD src/games/dicethrone/__tests__/test-utils.ts:94 | OK 测试/覆盖新增，需与主链保持一致 |     });
ADD src/games/dicethrone/__tests__/test-utils.ts:95 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/__tests__/test-utils.ts:96 | OK 测试/覆盖新增，需与主链保持一致 |     commands.push({ type: 'HOST_START_GAME', playerId: hostPlayerId, payload: {} });
ADD src/games/dicethrone/__tests__/test-utils.ts:97 | OK 测试/覆盖新增，需与主链保持一致 |     return commands;
ADD src/games/dicethrone/__tests__/test-utils.ts:98 | OK 测试/覆盖新增，需与主链保持一致 | };
DEL src/games/dicethrone/__tests__/test-utils.ts:101 | 注意 删除/收口测试，覆盖减少需确认 |     for (const cmd of setupCommands) {
ADD src/games/dicethrone/__tests__/test-utils.ts:111 | OK 测试/覆盖新增，需与主链保持一致 |     for (const cmd of buildSetupCommands(playerIds)) {
DEL src/games/dicethrone/audio.config.ts:218 | 注意 代码变更需核对 |                 return currentPhase === 'offensiveRoll' || currentPhase === 'defensiveRoll';
ADD src/games/dicethrone/audio.config.ts:218 | 注意 代码变更需核对 |                 return currentPhase === 'offensiveRoll' || currentPhase === 'targetingRoll' || currentPhase === 'defensiveRoll';
ADD src/games/dicethrone/domain/abilityLookup.ts:11 | 注意 领域逻辑变更，需核对流程/状态/校验 | import type { EffectAction } from './tokenTypes';
ADD src/games/dicethrone/domain/abilityLookup.ts:92 | 注意 领域逻辑变更，需核对流程/状态/校验 | /**
ADD src/games/dicethrone/domain/abilityLookup.ts:93 | 注意 领域逻辑变更，需核对流程/状态/校验 |  * 判断该技能是否依赖“单一敌方目标”
ADD src/games/dicethrone/domain/abilityLookup.ts:94 | 注意 领域逻辑变更，需核对流程/状态/校验 |  *
ADD src/games/dicethrone/domain/abilityLookup.ts:95 | 注意 领域逻辑变更，需核对流程/状态/校验 |  * 用于 4 人 / 2v2 下判断是否真的需要进入 targetingRoll。
ADD src/games/dicethrone/domain/abilityLookup.ts:96 | 注意 领域逻辑变更，需核对流程/状态/校验 |  * 纯 self-target / 任意玩家选择类技能不应被误判成必须先选受击者。
ADD src/games/dicethrone/domain/abilityLookup.ts:97 | 注意 领域逻辑变更，需核对流程/状态/校验 |  */
ADD src/games/dicethrone/domain/abilityLookup.ts:98 | 注意 领域逻辑变更，需核对流程/状态/校验 | export function playerAbilityNeedsSingleOpponentTarget(
ADD src/games/dicethrone/domain/abilityLookup.ts:99 | 注意 领域逻辑变更，需核对流程/状态/校验 |     state: DiceThroneCore,
ADD src/games/dicethrone/domain/abilityLookup.ts:100 | 注意 领域逻辑变更，需核对流程/状态/校验 |     playerId: PlayerId,
ADD src/games/dicethrone/domain/abilityLookup.ts:101 | 注意 领域逻辑变更，需核对流程/状态/校验 |     abilityId: string
ADD src/games/dicethrone/domain/abilityLookup.ts:102 | 注意 领域逻辑变更，需核对流程/状态/校验 | ): boolean {
ADD src/games/dicethrone/domain/abilityLookup.ts:103 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const effects = getPlayerAbilityEffects(state, playerId, abilityId);
ADD src/games/dicethrone/domain/abilityLookup.ts:104 | 注意 领域逻辑变更，需核对流程/状态/校验 |     return effects.some((effect) => effect.action ? effectNeedsSingleOpponentTarget(effect.action) : false);
ADD src/games/dicethrone/domain/abilityLookup.ts:105 | 注意 领域逻辑变更，需核对流程/状态/校验 | }
ADD src/games/dicethrone/domain/abilityLookup.ts:106 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/abilityLookup.ts:138 | 注意 领域逻辑变更，需核对流程/状态/校验 | function effectNeedsSingleOpponentTarget(action: EffectAction): boolean {
ADD src/games/dicethrone/domain/abilityLookup.ts:139 | 注意 领域逻辑变更，需核对流程/状态/校验 |     return action.target === 'opponent' || action.target === 'select';
ADD src/games/dicethrone/domain/abilityLookup.ts:140 | 注意 领域逻辑变更，需核对流程/状态/校验 | }
ADD src/games/dicethrone/domain/abilityLookup.ts:141 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/attack.ts:13 | 注意 领域逻辑变更，需核对流程/状态/校验 | const isBlockingInteractionEvent = (event: DiceThroneEvent): boolean =>
ADD src/games/dicethrone/domain/attack.ts:14 | 注意 领域逻辑变更，需核对流程/状态/校验 |     event.type === 'CHOICE_REQUESTED' || event.type === 'INTERACTION_REQUESTED';
ADD src/games/dicethrone/domain/attack.ts:15 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
DEL src/games/dicethrone/domain/attack.ts:15 | 注意 领域逻辑变更，需核对流程/状态/校验 |     defenderId: string,
ADD src/games/dicethrone/domain/attack.ts:18 | 注意 领域逻辑变更，需核对流程/状态/校验 |     defenderId: string | undefined,
ADD src/games/dicethrone/domain/attack.ts:40 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const effectDefenderId = defenderId ?? attackerId;
DEL src/games/dicethrone/domain/attack.ts:44 | 注意 领域逻辑变更，需核对流程/状态/校验 |         defenderId,
ADD src/games/dicethrone/domain/attack.ts:48 | 注意 领域逻辑变更，需核对流程/状态/校验 |         // 4 人 / 2v2 下存在“无伤害、无默认 defender”的进攻技能；
ADD src/games/dicethrone/domain/attack.ts:49 | 注意 领域逻辑变更，需核对流程/状态/校验 |         // 这类技能的 self-target preDefense 效果仍必须执行，不能因为 defenderId 缺失被整段跳过。
ADD src/games/dicethrone/domain/attack.ts:50 | 注意 领域逻辑变更，需核对流程/状态/校验 |         defenderId: effectDefenderId,
DEL src/games/dicethrone/domain/attack.ts:63 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!pending?.defenseAbilityId) {
ADD src/games/dicethrone/domain/attack.ts:69 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!pending?.defenseAbilityId || !pending.defenderId) {
ADD src/games/dicethrone/domain/attack.ts:126 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!pending.defenderId) {
ADD src/games/dicethrone/domain/attack.ts:127 | 注意 领域逻辑变更，需核对流程/状态/校验 |         const { attackerId, sourceAbilityId, defenseAbilityId } = pending;
ADD src/games/dicethrone/domain/attack.ts:128 | 注意 领域逻辑变更，需核对流程/状态/校验 |         const events: DiceThroneEvent[] = [];
ADD src/games/dicethrone/domain/attack.ts:129 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/attack.ts:130 | 注意 领域逻辑变更，需核对流程/状态/校验 |         if (sourceAbilityId) {
ADD src/games/dicethrone/domain/attack.ts:131 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const effects = getPlayerAbilityEffects(state, attackerId, sourceAbilityId);
ADD src/games/dicethrone/domain/attack.ts:132 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const attackCtx: EffectContext = {
ADD src/games/dicethrone/domain/attack.ts:133 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 attackerId,
ADD src/games/dicethrone/domain/attack.ts:134 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 defenderId: attackerId,
ADD src/games/dicethrone/domain/attack.ts:135 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 sourceAbilityId,
ADD src/games/dicethrone/domain/attack.ts:136 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 state,
ADD src/games/dicethrone/domain/attack.ts:137 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 damageDealt: 0,
ADD src/games/dicethrone/domain/attack.ts:138 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 timestamp,
ADD src/games/dicethrone/domain/attack.ts:139 | 注意 领域逻辑变更，需核对流程/状态/校验 |             };
ADD src/games/dicethrone/domain/attack.ts:140 | 注意 领域逻辑变更，需核对流程/状态/校验 |             events.push(...resolveEffectsToEvents(effects, 'withDamage', attackCtx, {
ADD src/games/dicethrone/domain/attack.ts:141 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 bonusDamage: pending.bonusDamage ?? 0,
ADD src/games/dicethrone/domain/attack.ts:142 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 bonusDamageOnce: true,
ADD src/games/dicethrone/domain/attack.ts:143 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 random,
ADD src/games/dicethrone/domain/attack.ts:144 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 skipDamage: true,
ADD src/games/dicethrone/domain/attack.ts:145 | 注意 领域逻辑变更，需核对流程/状态/校验 |             }));
ADD src/games/dicethrone/domain/attack.ts:146 | 注意 领域逻辑变更，需核对流程/状态/校验 |             events.push(...resolveEffectsToEvents(effects, 'postDamage', attackCtx, { random }));
ADD src/games/dicethrone/domain/attack.ts:147 | 注意 领域逻辑变更，需核对流程/状态/校验 |         }
ADD src/games/dicethrone/domain/attack.ts:148 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/attack.ts:149 | 注意 领域逻辑变更，需核对流程/状态/校验 |         events.push({
ADD src/games/dicethrone/domain/attack.ts:150 | 注意 领域逻辑变更，需核对流程/状态/校验 |             type: 'ATTACK_RESOLVED',
ADD src/games/dicethrone/domain/attack.ts:151 | 注意 领域逻辑变更，需核对流程/状态/校验 |             payload: {
ADD src/games/dicethrone/domain/attack.ts:152 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 attackerId,
ADD src/games/dicethrone/domain/attack.ts:153 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 defenderId: undefined,
ADD src/games/dicethrone/domain/attack.ts:154 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 sourceAbilityId,
ADD src/games/dicethrone/domain/attack.ts:155 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 defenseAbilityId,
ADD src/games/dicethrone/domain/attack.ts:156 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 totalDamage: 0,
ADD src/games/dicethrone/domain/attack.ts:157 | 注意 领域逻辑变更，需核对流程/状态/校验 |             },
ADD src/games/dicethrone/domain/attack.ts:158 | 注意 领域逻辑变更，需核对流程/状态/校验 |             sourceCommandType: 'ABILITY_EFFECT',
ADD src/games/dicethrone/domain/attack.ts:159 | 注意 领域逻辑变更，需核对流程/状态/校验 |             timestamp,
ADD src/games/dicethrone/domain/attack.ts:160 | 注意 领域逻辑变更，需核对流程/状态/校验 |         } as AttackResolvedEvent);
ADD src/games/dicethrone/domain/attack.ts:161 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return events;
ADD src/games/dicethrone/domain/attack.ts:162 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/attack.ts:163 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
DEL src/games/dicethrone/domain/attack.ts:125 | 注意 领域逻辑变更，需核对流程/状态/校验 |         const hasChoice = preDefenseEvents.some((event) => event.type === 'CHOICE_REQUESTED');
ADD src/games/dicethrone/domain/attack.ts:169 | 注意 领域逻辑变更，需核对流程/状态/校验 |         const hasChoice = preDefenseEvents.some(isBlockingInteractionEvent);
DEL src/games/dicethrone/domain/attack.ts:158 | 注意 领域逻辑变更，需核对流程/状态/校验 |         const hasChoiceInWithDamage = withDamageEvents.some(e => e.type === 'CHOICE_REQUESTED');
ADD src/games/dicethrone/domain/attack.ts:202 | 注意 领域逻辑变更，需核对流程/状态/校验 |         const hasChoiceInWithDamage = withDamageEvents.some(isBlockingInteractionEvent);
DEL src/games/dicethrone/domain/attack.ts:169 | 注意 领域逻辑变更，需核对流程/状态/校验 |         const hasChoiceInPostDamage = postDamageEvents.some(e => e.type === 'CHOICE_REQUESTED');
ADD src/games/dicethrone/domain/attack.ts:213 | 注意 领域逻辑变更，需核对流程/状态/校验 |         const hasChoiceInPostDamage = postDamageEvents.some(isBlockingInteractionEvent);
DEL src/games/dicethrone/domain/attack.ts:207 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!pending) {
ADD src/games/dicethrone/domain/attack.ts:251 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!pending || !pending.defenderId) {
DEL src/games/dicethrone/domain/attack.ts:274 | 注意 领域逻辑变更，需核对流程/状态/校验 |             defenderId,
ADD src/games/dicethrone/domain/attack.ts:318 | 注意 领域逻辑变更，需核对流程/状态/校验 |             defenderId: defenderId ?? attackerId,
ADD src/games/dicethrone/domain/choiceEffects.ts:47 | 注意 领域逻辑变更，需核对流程/状态/校验 | export function resolveChoiceEffect(context: ChoiceEffectContext): Partial<DiceThroneCore> | undefined {
ADD src/games/dicethrone/domain/choiceEffects.ts:48 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (context.customId.startsWith('select-target:')) {
ADD src/games/dicethrone/domain/choiceEffects.ts:49 | 注意 领域逻辑变更，需核对流程/状态/校验 |         const defenderId = context.customId.slice('select-target:'.length);
ADD src/games/dicethrone/domain/choiceEffects.ts:50 | 注意 领域逻辑变更，需核对流程/状态/校验 |         if (!defenderId || !context.state.pendingAttack || !context.state.players[defenderId]) {
ADD src/games/dicethrone/domain/choiceEffects.ts:51 | 注意 领域逻辑变更，需核对流程/状态/校验 |             return undefined;
ADD src/games/dicethrone/domain/choiceEffects.ts:52 | 注意 领域逻辑变更，需核对流程/状态/校验 |         }
ADD src/games/dicethrone/domain/choiceEffects.ts:53 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return {
ADD src/games/dicethrone/domain/choiceEffects.ts:54 | 注意 领域逻辑变更，需核对流程/状态/校验 |             pendingAttack: {
ADD src/games/dicethrone/domain/choiceEffects.ts:55 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 ...context.state.pendingAttack,
ADD src/games/dicethrone/domain/choiceEffects.ts:56 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 defenderId,
ADD src/games/dicethrone/domain/choiceEffects.ts:57 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 targetingSelectionPending: false,
ADD src/games/dicethrone/domain/choiceEffects.ts:58 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 targetingSelectionResolved: true,
ADD src/games/dicethrone/domain/choiceEffects.ts:59 | 注意 领域逻辑变更，需核对流程/状态/校验 |             },
ADD src/games/dicethrone/domain/choiceEffects.ts:60 | 注意 领域逻辑变更，需核对流程/状态/校验 |         };
ADD src/games/dicethrone/domain/choiceEffects.ts:61 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/choiceEffects.ts:62 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/choiceEffects.ts:63 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const handler = getChoiceEffectHandler(context.customId);
ADD src/games/dicethrone/domain/choiceEffects.ts:64 | 注意 领域逻辑变更，需核对流程/状态/校验 |     return handler?.(context);
ADD src/games/dicethrone/domain/choiceEffects.ts:65 | 注意 领域逻辑变更，需核对流程/状态/校验 | }
ADD src/games/dicethrone/domain/choiceEffects.ts:66 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/commandCategories.ts:57 | 注意 领域逻辑变更，需核对流程/状态/校验 |     'MOVE_SEAT': CommandCategory.STRATEGIC,
ADD src/games/dicethrone/domain/commandValidation.ts:29 | 注意 领域逻辑变更，需核对流程/状态/校验 |     MoveSeatCommand,
ADD src/games/dicethrone/domain/commandValidation.ts:31 | 注意 领域逻辑变更，需核对流程/状态/校验 |     PlayerUnreadyCommand,
ADD src/games/dicethrone/domain/commandValidation.ts:56 | 注意 领域逻辑变更，需核对流程/状态/校验 |     getSeatingOrder,
ADD src/games/dicethrone/domain/commandValidation.ts:57 | 注意 领域逻辑变更，需核对流程/状态/校验 |     isTeamMode,
ADD src/games/dicethrone/domain/commandValidation.ts:104 | 注意 领域逻辑变更，需核对流程/状态/校验 | const getLegacyDiceInteraction = (
ADD src/games/dicethrone/domain/commandValidation.ts:105 | 注意 领域逻辑变更，需核对流程/状态/校验 |     pendingInteraction: PendingInteractionLike | undefined
ADD src/games/dicethrone/domain/commandValidation.ts:106 | 注意 领域逻辑变更，需核对流程/状态/校验 | ): InteractionDescriptor | null => {
ADD src/games/dicethrone/domain/commandValidation.ts:107 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!pendingInteraction || isEngineInteractionDescriptor(pendingInteraction)) {
ADD src/games/dicethrone/domain/commandValidation.ts:108 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return null;
ADD src/games/dicethrone/domain/commandValidation.ts:109 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/commandValidation.ts:110 | 注意 领域逻辑变更，需核对流程/状态/校验 |     return pendingInteraction;
ADD src/games/dicethrone/domain/commandValidation.ts:111 | 注意 领域逻辑变更，需核对流程/状态/校验 | };
ADD src/games/dicethrone/domain/commandValidation.ts:112 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/commandValidation.ts:113 | 注意 领域逻辑变更，需核对流程/状态/校验 | const hasStatusOrToken = (
ADD src/games/dicethrone/domain/commandValidation.ts:114 | 注意 领域逻辑变更，需核对流程/状态/校验 |     state: DiceThroneCore,
ADD src/games/dicethrone/domain/commandValidation.ts:115 | 注意 领域逻辑变更，需核对流程/状态/校验 |     playerId: PlayerId,
ADD src/games/dicethrone/domain/commandValidation.ts:116 | 注意 领域逻辑变更，需核对流程/状态/校验 |     statusId?: string
ADD src/games/dicethrone/domain/commandValidation.ts:117 | 注意 领域逻辑变更，需核对流程/状态/校验 | ): boolean => {
ADD src/games/dicethrone/domain/commandValidation.ts:118 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const player = state.players[playerId];
ADD src/games/dicethrone/domain/commandValidation.ts:119 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!player) return false;
ADD src/games/dicethrone/domain/commandValidation.ts:120 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!statusId) {
ADD src/games/dicethrone/domain/commandValidation.ts:121 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return Object.values(player.statusEffects ?? {}).some(value => value > 0)
ADD src/games/dicethrone/domain/commandValidation.ts:122 | 注意 领域逻辑变更，需核对流程/状态/校验 |             || Object.values(player.tokens ?? {}).some(value => value > 0);
ADD src/games/dicethrone/domain/commandValidation.ts:123 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/commandValidation.ts:124 | 注意 领域逻辑变更，需核对流程/状态/校验 |     return (player.statusEffects?.[statusId] ?? 0) > 0
ADD src/games/dicethrone/domain/commandValidation.ts:125 | 注意 领域逻辑变更，需核对流程/状态/校验 |         || (player.tokens?.[statusId] ?? 0) > 0;
ADD src/games/dicethrone/domain/commandValidation.ts:126 | 注意 领域逻辑变更，需核对流程/状态/校验 | };
ADD src/games/dicethrone/domain/commandValidation.ts:127 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/commandValidation.ts:128 | 注意 领域逻辑变更，需核对流程/状态/校验 | const normalizeTokenPayload = (
ADD src/games/dicethrone/domain/commandValidation.ts:129 | 注意 领域逻辑变更，需核对流程/状态/校验 |     tokens: Array<{ tokenId: string; amount: number }>
ADD src/games/dicethrone/domain/commandValidation.ts:130 | 注意 领域逻辑变更，需核对流程/状态/校验 | ): string[] => tokens
ADD src/games/dicethrone/domain/commandValidation.ts:131 | 注意 领域逻辑变更，需核对流程/状态/校验 |     .map(({ tokenId, amount }) => `${tokenId}:${amount}`)
ADD src/games/dicethrone/domain/commandValidation.ts:132 | 注意 领域逻辑变更，需核对流程/状态/校验 |     .sort();
ADD src/games/dicethrone/domain/commandValidation.ts:133 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
DEL src/games/dicethrone/domain/commandValidation.ts:109 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (phase !== 'offensiveRoll' && phase !== 'defensiveRoll') {
ADD src/games/dicethrone/domain/commandValidation.ts:143 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (phase !== 'offensiveRoll' && phase !== 'targetingRoll' && phase !== 'defensiveRoll') {
ADD src/games/dicethrone/domain/commandValidation.ts:219 | 注意 领域逻辑变更，需核对流程/状态/校验 | /**
ADD src/games/dicethrone/domain/commandValidation.ts:220 | 注意 领域逻辑变更，需核对流程/状态/校验 |  * 验证 2v2 站位移动命令
ADD src/games/dicethrone/domain/commandValidation.ts:221 | 注意 领域逻辑变更，需核对流程/状态/校验 |  */
ADD src/games/dicethrone/domain/commandValidation.ts:222 | 注意 领域逻辑变更，需核对流程/状态/校验 | const validateMoveSeat = (
ADD src/games/dicethrone/domain/commandValidation.ts:223 | 注意 领域逻辑变更，需核对流程/状态/校验 |     state: DiceThroneCore,
ADD src/games/dicethrone/domain/commandValidation.ts:224 | 注意 领域逻辑变更，需核对流程/状态/校验 |     cmd: MoveSeatCommand,
ADD src/games/dicethrone/domain/commandValidation.ts:225 | 注意 领域逻辑变更，需核对流程/状态/校验 |     playerId: PlayerId,
ADD src/games/dicethrone/domain/commandValidation.ts:226 | 注意 领域逻辑变更，需核对流程/状态/校验 |     phase: TurnPhase
ADD src/games/dicethrone/domain/commandValidation.ts:227 | 注意 领域逻辑变更，需核对流程/状态/校验 | ): ValidationResult => {
ADD src/games/dicethrone/domain/commandValidation.ts:228 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (phase !== 'setup') {
ADD src/games/dicethrone/domain/commandValidation.ts:229 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return fail('invalid_phase');
ADD src/games/dicethrone/domain/commandValidation.ts:230 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/commandValidation.ts:231 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/commandValidation.ts:232 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!isTeamMode(state)) {
ADD src/games/dicethrone/domain/commandValidation.ts:233 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return fail('not_team_mode');
ADD src/games/dicethrone/domain/commandValidation.ts:234 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/commandValidation.ts:235 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/commandValidation.ts:236 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (state.hostStarted) {
ADD src/games/dicethrone/domain/commandValidation.ts:237 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return fail('game_already_started');
ADD src/games/dicethrone/domain/commandValidation.ts:238 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/commandValidation.ts:239 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/commandValidation.ts:240 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!isMoveAllowed(playerId, state.hostPlayerId)) {
ADD src/games/dicethrone/domain/commandValidation.ts:241 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return fail('player_mismatch');
ADD src/games/dicethrone/domain/commandValidation.ts:242 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/commandValidation.ts:243 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/commandValidation.ts:244 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const movingPlayerId = cmd.payload.playerId;
ADD src/games/dicethrone/domain/commandValidation.ts:245 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!state.players[movingPlayerId]) {
ADD src/games/dicethrone/domain/commandValidation.ts:246 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return fail('player_not_found');
ADD src/games/dicethrone/domain/commandValidation.ts:247 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/commandValidation.ts:248 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/commandValidation.ts:249 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const seatingOrder = getSeatingOrder(state);
ADD src/games/dicethrone/domain/commandValidation.ts:250 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const currentSeatIndex = seatingOrder.indexOf(movingPlayerId);
ADD src/games/dicethrone/domain/commandValidation.ts:251 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (currentSeatIndex === -1) {
ADD src/games/dicethrone/domain/commandValidation.ts:252 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return fail('invalid_seat_target');
ADD src/games/dicethrone/domain/commandValidation.ts:253 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/commandValidation.ts:254 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/commandValidation.ts:255 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const { targetSeatIndex } = cmd.payload;
ADD src/games/dicethrone/domain/commandValidation.ts:256 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!Number.isInteger(targetSeatIndex) || targetSeatIndex < 0 || targetSeatIndex >= seatingOrder.length) {
ADD src/games/dicethrone/domain/commandValidation.ts:257 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return fail('invalid_seat_target');
ADD src/games/dicethrone/domain/commandValidation.ts:258 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/commandValidation.ts:259 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/commandValidation.ts:260 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (targetSeatIndex === currentSeatIndex) {
ADD src/games/dicethrone/domain/commandValidation.ts:261 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return fail('seat_not_changed');
ADD src/games/dicethrone/domain/commandValidation.ts:262 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/commandValidation.ts:263 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/commandValidation.ts:264 | 注意 领域逻辑变更，需核对流程/状态/校验 |     return ok();
ADD src/games/dicethrone/domain/commandValidation.ts:265 | 注意 领域逻辑变更，需核对流程/状态/校验 | };
ADD src/games/dicethrone/domain/commandValidation.ts:266 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/commandValidation.ts:289 | 注意 领域逻辑变更，需核对流程/状态/校验 | /**
ADD src/games/dicethrone/domain/commandValidation.ts:290 | 注意 领域逻辑变更，需核对流程/状态/校验 |  * 验证玩家取消准备命令
ADD src/games/dicethrone/domain/commandValidation.ts:291 | 注意 领域逻辑变更，需核对流程/状态/校验 |  */
ADD src/games/dicethrone/domain/commandValidation.ts:292 | 注意 领域逻辑变更，需核对流程/状态/校验 | const validatePlayerUnready = (
ADD src/games/dicethrone/domain/commandValidation.ts:293 | 注意 领域逻辑变更，需核对流程/状态/校验 |     state: DiceThroneCore,
ADD src/games/dicethrone/domain/commandValidation.ts:294 | 注意 领域逻辑变更，需核对流程/状态/校验 |     _cmd: PlayerUnreadyCommand,
ADD src/games/dicethrone/domain/commandValidation.ts:295 | 注意 领域逻辑变更，需核对流程/状态/校验 |     playerId: PlayerId,
ADD src/games/dicethrone/domain/commandValidation.ts:296 | 注意 领域逻辑变更，需核对流程/状态/校验 |     phase: TurnPhase
ADD src/games/dicethrone/domain/commandValidation.ts:297 | 注意 领域逻辑变更，需核对流程/状态/校验 | ): ValidationResult => {
ADD src/games/dicethrone/domain/commandValidation.ts:298 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (phase !== 'setup') {
ADD src/games/dicethrone/domain/commandValidation.ts:299 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return fail('invalid_phase');
ADD src/games/dicethrone/domain/commandValidation.ts:300 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/commandValidation.ts:301 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/commandValidation.ts:302 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (state.hostStarted) {
ADD src/games/dicethrone/domain/commandValidation.ts:303 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return fail('game_already_started');
ADD src/games/dicethrone/domain/commandValidation.ts:304 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/commandValidation.ts:305 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/commandValidation.ts:306 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!state.players[playerId]) {
ADD src/games/dicethrone/domain/commandValidation.ts:307 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return fail('player_not_found');
ADD src/games/dicethrone/domain/commandValidation.ts:308 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/commandValidation.ts:309 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/commandValidation.ts:310 | 注意 领域逻辑变更，需核对流程/状态/校验 |     return ok();
ADD src/games/dicethrone/domain/commandValidation.ts:311 | 注意 领域逻辑变更，需核对流程/状态/校验 | };
ADD src/games/dicethrone/domain/commandValidation.ts:312 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
DEL src/games/dicethrone/domain/commandValidation.ts:246 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (phase !== 'offensiveRoll' && phase !== 'defensiveRoll') {
ADD src/games/dicethrone/domain/commandValidation.ts:352 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (phase !== 'offensiveRoll' && phase !== 'targetingRoll' && phase !== 'defensiveRoll') {
DEL src/games/dicethrone/domain/commandValidation.ts:778 | 注意 领域逻辑变更，需核对流程/状态/校验 |     _state: DiceThroneCore,
DEL src/games/dicethrone/domain/commandValidation.ts:779 | 注意 领域逻辑变更，需核对流程/状态/校验 |     _cmd: RemoveStatusCommand,
ADD src/games/dicethrone/domain/commandValidation.ts:884 | 注意 领域逻辑变更，需核对流程/状态/校验 |     state: DiceThroneCore,
ADD src/games/dicethrone/domain/commandValidation.ts:885 | 注意 领域逻辑变更，需核对流程/状态/校验 |     cmd: RemoveStatusCommand,
DEL src/games/dicethrone/domain/commandValidation.ts:781 | 注意 领域逻辑变更，需核对流程/状态/校验 |     pendingInteraction?: InteractionDescriptor
ADD src/games/dicethrone/domain/commandValidation.ts:887 | 注意 领域逻辑变更，需核对流程/状态/校验 |     pendingInteraction?: PendingInteractionLike
DEL src/games/dicethrone/domain/commandValidation.ts:783 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!pendingInteraction) {
ADD src/games/dicethrone/domain/commandValidation.ts:889 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const interaction = getLegacyDiceInteraction(pendingInteraction);
ADD src/games/dicethrone/domain/commandValidation.ts:890 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!interaction) {
DEL src/games/dicethrone/domain/commandValidation.ts:786 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (pendingInteraction.playerId !== playerId) {
ADD src/games/dicethrone/domain/commandValidation.ts:893 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (interaction.playerId !== playerId) {
DEL src/games/dicethrone/domain/commandValidation.ts:789 | 注意 领域逻辑变更，需核对流程/状态/校验 |     return ok();
ADD src/games/dicethrone/domain/commandValidation.ts:896 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/commandValidation.ts:897 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const { targetPlayerId, statusId } = cmd.payload;
ADD src/games/dicethrone/domain/commandValidation.ts:898 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!interaction.targetPlayerIds?.includes(targetPlayerId)) {
ADD src/games/dicethrone/domain/commandValidation.ts:899 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return fail('invalid_target_player');
ADD src/games/dicethrone/domain/commandValidation.ts:900 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/commandValidation.ts:901 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/commandValidation.ts:902 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (interaction.type === 'selectPlayer') {
ADD src/games/dicethrone/domain/commandValidation.ts:903 | 注意 领域逻辑变更，需核对流程/状态/校验 |         if (statusId !== undefined) {
ADD src/games/dicethrone/domain/commandValidation.ts:904 | 注意 领域逻辑变更，需核对流程/状态/校验 |             return fail('invalid_remove_status_interaction');
ADD src/games/dicethrone/domain/commandValidation.ts:905 | 注意 领域逻辑变更，需核对流程/状态/校验 |         }
ADD src/games/dicethrone/domain/commandValidation.ts:906 | 注意 领域逻辑变更，需核对流程/状态/校验 |         if (interaction.requiresTargetWithStatus && !hasStatusOrToken(state, targetPlayerId)) {
ADD src/games/dicethrone/domain/commandValidation.ts:907 | 注意 领域逻辑变更，需核对流程/状态/校验 |             return fail('target_has_no_status');
ADD src/games/dicethrone/domain/commandValidation.ts:908 | 注意 领域逻辑变更，需核对流程/状态/校验 |         }
ADD src/games/dicethrone/domain/commandValidation.ts:909 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return ok();
ADD src/games/dicethrone/domain/commandValidation.ts:910 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/commandValidation.ts:911 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/commandValidation.ts:912 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (interaction.type === 'selectStatus') {
ADD src/games/dicethrone/domain/commandValidation.ts:913 | 注意 领域逻辑变更，需核对流程/状态/校验 |         if (!statusId) {
ADD src/games/dicethrone/domain/commandValidation.ts:914 | 注意 领域逻辑变更，需核对流程/状态/校验 |             return fail('status_id_required');
ADD src/games/dicethrone/domain/commandValidation.ts:915 | 注意 领域逻辑变更，需核对流程/状态/校验 |         }
ADD src/games/dicethrone/domain/commandValidation.ts:916 | 注意 领域逻辑变更，需核对流程/状态/校验 |         if (!hasStatusOrToken(state, targetPlayerId, statusId)) {
ADD src/games/dicethrone/domain/commandValidation.ts:917 | 注意 领域逻辑变更，需核对流程/状态/校验 |             return fail('status_not_found');
ADD src/games/dicethrone/domain/commandValidation.ts:918 | 注意 领域逻辑变更，需核对流程/状态/校验 |         }
ADD src/games/dicethrone/domain/commandValidation.ts:919 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return ok();
ADD src/games/dicethrone/domain/commandValidation.ts:920 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/commandValidation.ts:921 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/commandValidation.ts:922 | 注意 领域逻辑变更，需核对流程/状态/校验 |     return fail('invalid_remove_status_interaction');
DEL src/games/dicethrone/domain/commandValidation.ts:796 | 注意 领域逻辑变更，需核对流程/状态/校验 |     _state: DiceThroneCore,
DEL src/games/dicethrone/domain/commandValidation.ts:797 | 注意 领域逻辑变更，需核对流程/状态/校验 |     _cmd: TransferStatusCommand,
ADD src/games/dicethrone/domain/commandValidation.ts:929 | 注意 领域逻辑变更，需核对流程/状态/校验 |     state: DiceThroneCore,
ADD src/games/dicethrone/domain/commandValidation.ts:930 | 注意 领域逻辑变更，需核对流程/状态/校验 |     cmd: TransferStatusCommand,
DEL src/games/dicethrone/domain/commandValidation.ts:799 | 注意 领域逻辑变更，需核对流程/状态/校验 |     pendingInteraction?: InteractionDescriptor
ADD src/games/dicethrone/domain/commandValidation.ts:932 | 注意 领域逻辑变更，需核对流程/状态/校验 |     pendingInteraction?: PendingInteractionLike
DEL src/games/dicethrone/domain/commandValidation.ts:801 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!pendingInteraction) {
ADD src/games/dicethrone/domain/commandValidation.ts:934 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const interaction = getLegacyDiceInteraction(pendingInteraction);
ADD src/games/dicethrone/domain/commandValidation.ts:935 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!interaction) {
DEL src/games/dicethrone/domain/commandValidation.ts:804 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (pendingInteraction.playerId !== playerId) {
ADD src/games/dicethrone/domain/commandValidation.ts:938 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (interaction.playerId !== playerId) {
ADD src/games/dicethrone/domain/commandValidation.ts:941 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/commandValidation.ts:942 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const isRealtimeTransferFlow =
ADD src/games/dicethrone/domain/commandValidation.ts:943 | 注意 领域逻辑变更，需核对流程/状态/校验 |         interaction.type === 'selectStatus' && interaction.transferConfig !== undefined;
ADD src/games/dicethrone/domain/commandValidation.ts:944 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (interaction.type !== 'selectTargetStatus' && !isRealtimeTransferFlow) {
ADD src/games/dicethrone/domain/commandValidation.ts:945 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return fail('invalid_transfer_status_interaction');
ADD src/games/dicethrone/domain/commandValidation.ts:946 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/commandValidation.ts:947 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/commandValidation.ts:948 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const sourcePlayerId = interaction.transferConfig?.sourcePlayerId ?? cmd.payload.fromPlayerId;
ADD src/games/dicethrone/domain/commandValidation.ts:949 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const statusId = interaction.transferConfig?.statusId ?? cmd.payload.statusId;
ADD src/games/dicethrone/domain/commandValidation.ts:950 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!sourcePlayerId || !statusId) {
ADD src/games/dicethrone/domain/commandValidation.ts:951 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return fail('invalid_transfer_status_interaction');
ADD src/games/dicethrone/domain/commandValidation.ts:952 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/commandValidation.ts:953 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!interaction.targetPlayerIds?.includes(sourcePlayerId)) {
ADD src/games/dicethrone/domain/commandValidation.ts:954 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return fail('invalid_target_player');
ADD src/games/dicethrone/domain/commandValidation.ts:955 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/commandValidation.ts:956 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!hasStatusOrToken(state, sourcePlayerId, statusId)) {
ADD src/games/dicethrone/domain/commandValidation.ts:957 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return fail('status_not_found');
ADD src/games/dicethrone/domain/commandValidation.ts:958 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/commandValidation.ts:959 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (
ADD src/games/dicethrone/domain/commandValidation.ts:960 | 注意 领域逻辑变更，需核对流程/状态/校验 |         interaction.type === 'selectTargetStatus'
ADD src/games/dicethrone/domain/commandValidation.ts:961 | 注意 领域逻辑变更，需核对流程/状态/校验 |         && (cmd.payload.fromPlayerId !== sourcePlayerId || cmd.payload.statusId !== statusId)
ADD src/games/dicethrone/domain/commandValidation.ts:962 | 注意 领域逻辑变更，需核对流程/状态/校验 |     ) {
ADD src/games/dicethrone/domain/commandValidation.ts:963 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return fail('interaction_payload_mismatch');
ADD src/games/dicethrone/domain/commandValidation.ts:964 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/commandValidation.ts:965 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (cmd.payload.toPlayerId === sourcePlayerId) {
ADD src/games/dicethrone/domain/commandValidation.ts:966 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return fail('invalid_target_player');
ADD src/games/dicethrone/domain/commandValidation.ts:967 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/commandValidation.ts:968 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!interaction.targetPlayerIds?.includes(cmd.payload.toPlayerId)) {
ADD src/games/dicethrone/domain/commandValidation.ts:969 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return fail('invalid_target_player');
ADD src/games/dicethrone/domain/commandValidation.ts:970 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
DEL src/games/dicethrone/domain/commandValidation.ts:1082 | 注意 领域逻辑变更，需核对流程/状态/校验 |     _cmd: GrantTokensCommand,
ADD src/games/dicethrone/domain/commandValidation.ts:1246 | 注意 领域逻辑变更，需核对流程/状态/校验 |     cmd: GrantTokensCommand,
DEL src/games/dicethrone/domain/commandValidation.ts:1084 | 注意 领域逻辑变更，需核对流程/状态/校验 |     pendingInteraction?: InteractionDescriptor
ADD src/games/dicethrone/domain/commandValidation.ts:1248 | 注意 领域逻辑变更，需核对流程/状态/校验 |     pendingInteraction?: PendingInteractionLike
DEL src/games/dicethrone/domain/commandValidation.ts:1086 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!pendingInteraction) {
ADD src/games/dicethrone/domain/commandValidation.ts:1250 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const interaction = getLegacyDiceInteraction(pendingInteraction);
ADD src/games/dicethrone/domain/commandValidation.ts:1251 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!interaction) {
DEL src/games/dicethrone/domain/commandValidation.ts:1089 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (pendingInteraction.playerId !== playerId) {
ADD src/games/dicethrone/domain/commandValidation.ts:1254 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (interaction.playerId !== playerId) {
ADD src/games/dicethrone/domain/commandValidation.ts:1257 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/commandValidation.ts:1258 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (interaction.type !== 'selectPlayer') {
ADD src/games/dicethrone/domain/commandValidation.ts:1259 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return fail('invalid_grant_tokens_interaction');
ADD src/games/dicethrone/domain/commandValidation.ts:1260 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/commandValidation.ts:1261 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!interaction.targetPlayerIds?.includes(cmd.payload.targetPlayerId)) {
ADD src/games/dicethrone/domain/commandValidation.ts:1262 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return fail('invalid_target_player');
ADD src/games/dicethrone/domain/commandValidation.ts:1263 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/commandValidation.ts:1264 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/commandValidation.ts:1265 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const expectedTokens = interaction.tokenGrantConfigs ?? (
ADD src/games/dicethrone/domain/commandValidation.ts:1266 | 注意 领域逻辑变更，需核对流程/状态/校验 |         interaction.tokenGrantConfig ? [interaction.tokenGrantConfig] : []
ADD src/games/dicethrone/domain/commandValidation.ts:1267 | 注意 领域逻辑变更，需核对流程/状态/校验 |     );
ADD src/games/dicethrone/domain/commandValidation.ts:1268 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (expectedTokens.length === 0) {
ADD src/games/dicethrone/domain/commandValidation.ts:1269 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return fail('invalid_grant_tokens_interaction');
ADD src/games/dicethrone/domain/commandValidation.ts:1270 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/commandValidation.ts:1271 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/commandValidation.ts:1272 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const expectedPayload = normalizeTokenPayload(expectedTokens);
ADD src/games/dicethrone/domain/commandValidation.ts:1273 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const actualPayload = normalizeTokenPayload(cmd.payload.tokens ?? []);
ADD src/games/dicethrone/domain/commandValidation.ts:1274 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (expectedPayload.length !== actualPayload.length) {
ADD src/games/dicethrone/domain/commandValidation.ts:1275 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return fail('interaction_payload_mismatch');
ADD src/games/dicethrone/domain/commandValidation.ts:1276 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/commandValidation.ts:1277 | 注意 领域逻辑变更，需核对流程/状态/校验 |     for (let index = 0; index < expectedPayload.length; index++) {
ADD src/games/dicethrone/domain/commandValidation.ts:1278 | 注意 领域逻辑变更，需核对流程/状态/校验 |         if (expectedPayload[index] !== actualPayload[index]) {
ADD src/games/dicethrone/domain/commandValidation.ts:1279 | 注意 领域逻辑变更，需核对流程/状态/校验 |             return fail('interaction_payload_mismatch');
ADD src/games/dicethrone/domain/commandValidation.ts:1280 | 注意 领域逻辑变更，需核对流程/状态/校验 |         }
ADD src/games/dicethrone/domain/commandValidation.ts:1281 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/commandValidation.ts:1319 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (isCommandType(command, 'MOVE_SEAT')) return validateMoveSeat(state, command, playerId, phase);
ADD src/games/dicethrone/domain/commandValidation.ts:1321 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (isCommandType(command, 'PLAYER_UNREADY')) return validatePlayerUnready(state, command, playerId, phase);
ADD src/games/dicethrone/domain/commands.ts:109 | 注意 领域逻辑变更，需核对流程/状态/校验 | /** 2v2 站位移动命令 */
ADD src/games/dicethrone/domain/commands.ts:110 | 注意 领域逻辑变更，需核对流程/状态/校验 | export interface MoveSeatCommand extends Command<'MOVE_SEAT'> {
ADD src/games/dicethrone/domain/commands.ts:111 | 注意 领域逻辑变更，需核对流程/状态/校验 |     payload: {
ADD src/games/dicethrone/domain/commands.ts:112 | 注意 领域逻辑变更，需核对流程/状态/校验 |         /** 被移动的玩家 */
ADD src/games/dicethrone/domain/commands.ts:113 | 注意 领域逻辑变更，需核对流程/状态/校验 |         playerId: PlayerId;
ADD src/games/dicethrone/domain/commands.ts:114 | 注意 领域逻辑变更，需核对流程/状态/校验 |         /** 移除该玩家后，插入到新的目标下标 */
ADD src/games/dicethrone/domain/commands.ts:115 | 注意 领域逻辑变更，需核对流程/状态/校验 |         targetSeatIndex: number;
ADD src/games/dicethrone/domain/commands.ts:116 | 注意 领域逻辑变更，需核对流程/状态/校验 |     };
ADD src/games/dicethrone/domain/commands.ts:117 | 注意 领域逻辑变更，需核对流程/状态/校验 | }
ADD src/games/dicethrone/domain/commands.ts:118 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/commands.ts:268 | 注意 领域逻辑变更，需核对流程/状态/校验 |     | MoveSeatCommand
ADD src/games/dicethrone/domain/core-types.ts:26 | 注意 领域逻辑变更，需核对流程/状态/校验 |     | 'targetingRoll'
ADD src/games/dicethrone/domain/core-types.ts:68 | 注意 领域逻辑变更，需核对流程/状态/校验 | export type TeamId = 'A' | 'B';
DEL src/games/dicethrone/domain/core-types.ts:106 | 注意 领域逻辑变更，需核对流程/状态/校验 |     phase?: 'offensiveRoll' | 'defensiveRoll';
ADD src/games/dicethrone/domain/core-types.ts:108 | 注意 领域逻辑变更，需核对流程/状态/校验 |     phase?: 'offensiveRoll' | 'targetingRoll' | 'defensiveRoll';
DEL src/games/dicethrone/domain/core-types.ts:163 | 注意 领域逻辑变更，需核对流程/状态/校验 |     defenderId: PlayerId;
ADD src/games/dicethrone/domain/core-types.ts:165 | 注意 领域逻辑变更，需核对流程/状态/校验 |     defenderId?: PlayerId;
ADD src/games/dicethrone/domain/core-types.ts:166 | 注意 领域逻辑变更，需核对流程/状态/校验 |     /** 2v2 目标掷骰 5/6 分支等待玩家确认目标时为 true */
ADD src/games/dicethrone/domain/core-types.ts:167 | 注意 领域逻辑变更，需核对流程/状态/校验 |     targetingSelectionPending?: boolean;
ADD src/games/dicethrone/domain/core-types.ts:168 | 注意 领域逻辑变更，需核对流程/状态/校验 |     targetingSelectionResolved?: boolean;
ADD src/games/dicethrone/domain/core-types.ts:401 | 注意 领域逻辑变更，需核对流程/状态/校验 |     /** 2v2 模式下的环桌座位顺序，用于分队与回合顺序推导 */
ADD src/games/dicethrone/domain/core-types.ts:402 | 注意 领域逻辑变更，需核对流程/状态/校验 |     seatingOrder?: PlayerId[];
ADD src/games/dicethrone/domain/core-types.ts:403 | 注意 领域逻辑变更，需核对流程/状态/校验 |     /** 2v2 模式下按座位推导后的队伍归属 */
ADD src/games/dicethrone/domain/core-types.ts:404 | 注意 领域逻辑变更，需核对流程/状态/校验 |     teamIdByPlayerId?: Record<PlayerId, TeamId>;
ADD src/games/dicethrone/domain/core-types.ts:405 | 注意 领域逻辑变更，需核对流程/状态/校验 |     /** 2v2 模式下的共享体力；同队成员 HP 需要与该值保持同步 */
ADD src/games/dicethrone/domain/core-types.ts:406 | 注意 领域逻辑变更，需核对流程/状态/校验 |     teamHealth?: Record<TeamId, number>;
ADD src/games/dicethrone/domain/core-types.ts:482 | 注意 领域逻辑变更，需核对流程/状态/校验 |     'targetingRoll',
ADD src/games/dicethrone/domain/events.ts:67 | 注意 领域逻辑变更，需核对流程/状态/校验 |   PLAYER_UNREADY: 'ui',          // 玩家取消准备（UI 层播放）
ADD src/games/dicethrone/domain/events.ts:69 | 注意 领域逻辑变更，需核对流程/状态/校验 |   SEATING_MOVED: 'ui',           // 站位调整（UI 层播放）
ADD src/games/dicethrone/domain/events.ts:202 | 注意 领域逻辑变更，需核对流程/状态/校验 | /** 2v2 站位移动事件 */
ADD src/games/dicethrone/domain/events.ts:203 | 注意 领域逻辑变更，需核对流程/状态/校验 | export interface SeatingMovedEvent extends GameEvent<'SEATING_MOVED'> {
ADD src/games/dicethrone/domain/events.ts:204 | 注意 领域逻辑变更，需核对流程/状态/校验 |     payload: {
ADD src/games/dicethrone/domain/events.ts:205 | 注意 领域逻辑变更，需核对流程/状态/校验 |         playerId: PlayerId;
ADD src/games/dicethrone/domain/events.ts:206 | 注意 领域逻辑变更，需核对流程/状态/校验 |         sourceSeatIndex: number;
ADD src/games/dicethrone/domain/events.ts:207 | 注意 领域逻辑变更，需核对流程/状态/校验 |         targetSeatIndex: number;
ADD src/games/dicethrone/domain/events.ts:208 | 注意 领域逻辑变更，需核对流程/状态/校验 |         seatingOrder: PlayerId[];
ADD src/games/dicethrone/domain/events.ts:209 | 注意 领域逻辑变更，需核对流程/状态/校验 |     };
ADD src/games/dicethrone/domain/events.ts:210 | 注意 领域逻辑变更，需核对流程/状态/校验 | }
ADD src/games/dicethrone/domain/events.ts:211 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/events.ts:219 | 注意 领域逻辑变更，需核对流程/状态/校验 | /** 玩家取消准备事件 */
ADD src/games/dicethrone/domain/events.ts:220 | 注意 领域逻辑变更，需核对流程/状态/校验 | export interface PlayerUnreadyEvent extends GameEvent<'PLAYER_UNREADY'> {
ADD src/games/dicethrone/domain/events.ts:221 | 注意 领域逻辑变更，需核对流程/状态/校验 |     payload: {
ADD src/games/dicethrone/domain/events.ts:222 | 注意 领域逻辑变更，需核对流程/状态/校验 |         playerId: PlayerId;
ADD src/games/dicethrone/domain/events.ts:223 | 注意 领域逻辑变更，需核对流程/状态/校验 |     };
ADD src/games/dicethrone/domain/events.ts:224 | 注意 领域逻辑变更，需核对流程/状态/校验 | }
ADD src/games/dicethrone/domain/events.ts:225 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
DEL src/games/dicethrone/domain/events.ts:475 | 注意 领域逻辑变更，需核对流程/状态/校验 |         defenderId: PlayerId;
ADD src/games/dicethrone/domain/events.ts:494 | 注意 领域逻辑变更，需核对流程/状态/校验 |         defenderId?: PlayerId;
DEL src/games/dicethrone/domain/events.ts:496 | 注意 领域逻辑变更，需核对流程/状态/校验 |         defenderId: PlayerId;
ADD src/games/dicethrone/domain/events.ts:515 | 注意 领域逻辑变更，需核对流程/状态/校验 |         defenderId?: PlayerId;
DEL src/games/dicethrone/domain/events.ts:505 | 注意 领域逻辑变更，需核对流程/状态/校验 |         defenderId: PlayerId;
ADD src/games/dicethrone/domain/events.ts:524 | 注意 领域逻辑变更，需核对流程/状态/校验 |         defenderId?: PlayerId;
ADD src/games/dicethrone/domain/events.ts:568 | 注意 领域逻辑变更，需核对流程/状态/校验 |             /** true 时仅展示，不允许点击 */
ADD src/games/dicethrone/domain/events.ts:569 | 注意 领域逻辑变更，需核对流程/状态/校验 |             disabled?: boolean;
ADD src/games/dicethrone/domain/events.ts:817 | 注意 领域逻辑变更，需核对流程/状态/校验 |     | SeatingMovedEvent
ADD src/games/dicethrone/domain/events.ts:819 | 注意 领域逻辑变更，需核对流程/状态/校验 |     | PlayerUnreadyEvent
ADD src/games/dicethrone/domain/execute.ts:23 | 注意 领域逻辑变更，需核对流程/状态/校验 |     SeatingMovedEvent,
ADD src/games/dicethrone/domain/execute.ts:25 | 注意 领域逻辑变更，需核对流程/状态/校验 |     PlayerUnreadyEvent,
ADD src/games/dicethrone/domain/execute.ts:29 | 注意 领域逻辑变更，需核对流程/状态/校验 |     getDefaultOpponentId,
ADD src/games/dicethrone/domain/execute.ts:30 | 注意 领域逻辑变更，需核对流程/状态/校验 |     getContextualOpponentId,
ADD src/games/dicethrone/domain/execute.ts:34 | 注意 领域逻辑变更，需核对流程/状态/校验 |     getSeatingOrder,
ADD src/games/dicethrone/domain/execute.ts:35 | 注意 领域逻辑变更，需核对流程/状态/校验 |     isTeamMode,
ADD src/games/dicethrone/domain/execute.ts:174 | 注意 领域逻辑变更，需核对流程/状态/校验 |         case 'MOVE_SEAT': {
ADD src/games/dicethrone/domain/execute.ts:175 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const movingPlayerId = command.payload.playerId;
ADD src/games/dicethrone/domain/execute.ts:176 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const seatingOrder = getSeatingOrder(state);
ADD src/games/dicethrone/domain/execute.ts:177 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const sourceSeatIndex = seatingOrder.indexOf(movingPlayerId);
ADD src/games/dicethrone/domain/execute.ts:178 | 注意 领域逻辑变更，需核对流程/状态/校验 |             if (sourceSeatIndex === -1) {
ADD src/games/dicethrone/domain/execute.ts:179 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 break;
ADD src/games/dicethrone/domain/execute.ts:180 | 注意 领域逻辑变更，需核对流程/状态/校验 |             }
ADD src/games/dicethrone/domain/execute.ts:181 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/execute.ts:182 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const remainingPlayers = seatingOrder.filter((pid) => pid !== movingPlayerId);
ADD src/games/dicethrone/domain/execute.ts:183 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const nextSeatingOrder = [
ADD src/games/dicethrone/domain/execute.ts:184 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 ...remainingPlayers.slice(0, command.payload.targetSeatIndex),
ADD src/games/dicethrone/domain/execute.ts:185 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 movingPlayerId,
ADD src/games/dicethrone/domain/execute.ts:186 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 ...remainingPlayers.slice(command.payload.targetSeatIndex),
ADD src/games/dicethrone/domain/execute.ts:187 | 注意 领域逻辑变更，需核对流程/状态/校验 |             ];
ADD src/games/dicethrone/domain/execute.ts:188 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/execute.ts:189 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const seatingMovedEvent: SeatingMovedEvent = {
ADD src/games/dicethrone/domain/execute.ts:190 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 type: 'SEATING_MOVED',
ADD src/games/dicethrone/domain/execute.ts:191 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 payload: {
ADD src/games/dicethrone/domain/execute.ts:192 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     playerId: movingPlayerId,
ADD src/games/dicethrone/domain/execute.ts:193 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     sourceSeatIndex,
ADD src/games/dicethrone/domain/execute.ts:194 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     targetSeatIndex: command.payload.targetSeatIndex,
ADD src/games/dicethrone/domain/execute.ts:195 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     seatingOrder: nextSeatingOrder,
ADD src/games/dicethrone/domain/execute.ts:196 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 },
ADD src/games/dicethrone/domain/execute.ts:197 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 sourceCommandType: command.type,
ADD src/games/dicethrone/domain/execute.ts:198 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 timestamp,
ADD src/games/dicethrone/domain/execute.ts:199 | 注意 领域逻辑变更，需核对流程/状态/校验 |             };
ADD src/games/dicethrone/domain/execute.ts:200 | 注意 领域逻辑变更，需核对流程/状态/校验 |             events.push(seatingMovedEvent);
ADD src/games/dicethrone/domain/execute.ts:201 | 注意 领域逻辑变更，需核对流程/状态/校验 |             break;
ADD src/games/dicethrone/domain/execute.ts:202 | 注意 领域逻辑变更，需核对流程/状态/校验 |         }
ADD src/games/dicethrone/domain/execute.ts:203 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/execute.ts:217 | 注意 领域逻辑变更，需核对流程/状态/校验 |         case 'PLAYER_UNREADY': {
ADD src/games/dicethrone/domain/execute.ts:218 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const unreadyEvent: PlayerUnreadyEvent = {
ADD src/games/dicethrone/domain/execute.ts:219 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 type: 'PLAYER_UNREADY',
ADD src/games/dicethrone/domain/execute.ts:220 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 payload: {
ADD src/games/dicethrone/domain/execute.ts:221 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     playerId: command.playerId,
ADD src/games/dicethrone/domain/execute.ts:222 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 },
ADD src/games/dicethrone/domain/execute.ts:223 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 sourceCommandType: command.type,
ADD src/games/dicethrone/domain/execute.ts:224 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 timestamp,
ADD src/games/dicethrone/domain/execute.ts:225 | 注意 领域逻辑变更，需核对流程/状态/校验 |             };
ADD src/games/dicethrone/domain/execute.ts:226 | 注意 领域逻辑变更，需核对流程/状态/校验 |             events.push(unreadyEvent);
ADD src/games/dicethrone/domain/execute.ts:227 | 注意 领域逻辑变更，需核对流程/状态/校验 |             break;
ADD src/games/dicethrone/domain/execute.ts:228 | 注意 领域逻辑变更，需核对流程/状态/校验 |         }
ADD src/games/dicethrone/domain/execute.ts:229 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
DEL src/games/dicethrone/domain/execute.ts:215 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const playerIds = Object.keys(state.players);
DEL src/games/dicethrone/domain/execute.ts:216 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const opponentId = playerIds.find(pid => pid !== rollerId) || rollerId;
ADD src/games/dicethrone/domain/execute.ts:264 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const opponentId = getContextualOpponentId(stateAfterConfirm, rollerId) ?? rollerId;
DEL src/games/dicethrone/domain/execute.ts:268 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const defenderId = getNextPlayerId(state);
ADD src/games/dicethrone/domain/execute.ts:316 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const defenderId = isTeamMode(state)
ADD src/games/dicethrone/domain/execute.ts:317 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     ? undefined
ADD src/games/dicethrone/domain/execute.ts:318 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     : (getDefaultOpponentId(state, state.activePlayerId) ?? getNextPlayerId(state));
ADD src/games/dicethrone/domain/executeCards.ts:23 | 注意 领域逻辑变更，需核对流程/状态/校验 |     getContextualOpponentId,
DEL src/games/dicethrone/domain/executeCards.ts:169 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const opponentId = Object.keys(state.players).find(id => id !== actingPlayerId) || actingPlayerId;
ADD src/games/dicethrone/domain/executeCards.ts:170 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const opponentId = getContextualOpponentId(state, actingPlayerId) ?? actingPlayerId;
DEL src/games/dicethrone/domain/executeCards.ts:197 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const opponentId = Object.keys(state.players).find(id => id !== actingPlayerId) || actingPlayerId;
ADD src/games/dicethrone/domain/executeCards.ts:198 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const opponentId = getContextualOpponentId(state, actingPlayerId) ?? actingPlayerId;
DEL src/games/dicethrone/domain/executeCards.ts:288 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const opponentId = Object.keys(state.players).find(id => id !== state.activePlayerId) || state.activePlayerId;
ADD src/games/dicethrone/domain/executeCards.ts:289 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const opponentId = getContextualOpponentId(state, state.activePlayerId) ?? state.activePlayerId;
DEL src/games/dicethrone/domain/flowHooks.ts:25 | 注意 领域逻辑变更，需核对流程/状态/校验 | import { canAdvancePhase, getNextPhase, getNextPlayerId, getPlayerDieFace, getResponderQueue, getRollerId } from './rules';
ADD src/games/dicethrone/domain/flowHooks.ts:25 | 注意 领域逻辑变更，需核对流程/状态/校验 | import {
ADD src/games/dicethrone/domain/flowHooks.ts:26 | 注意 领域逻辑变更，需核对流程/状态/校验 |     canAdvancePhase,
ADD src/games/dicethrone/domain/flowHooks.ts:27 | 注意 领域逻辑变更，需核对流程/状态/校验 |     getNextPhase,
ADD src/games/dicethrone/domain/flowHooks.ts:28 | 注意 领域逻辑变更，需核对流程/状态/校验 |     getNextPlayerId,
ADD src/games/dicethrone/domain/flowHooks.ts:29 | 注意 领域逻辑变更，需核对流程/状态/校验 |     getPlayerDieFace,
ADD src/games/dicethrone/domain/flowHooks.ts:30 | 注意 领域逻辑变更，需核对流程/状态/校验 |     getResponderQueue,
ADD src/games/dicethrone/domain/flowHooks.ts:31 | 注意 领域逻辑变更，需核对流程/状态/校验 |     getRollerId,
ADD src/games/dicethrone/domain/flowHooks.ts:32 | 注意 领域逻辑变更，需核对流程/状态/校验 |     getTargetingRollAutoDefenderId,
ADD src/games/dicethrone/domain/flowHooks.ts:33 | 注意 领域逻辑变更，需核对流程/状态/校验 |     getTargetingRollChoiceOptions,
ADD src/games/dicethrone/domain/flowHooks.ts:34 | 注意 领域逻辑变更，需核对流程/状态/校验 |     getTargetingRollChoiceOwnerId,
ADD src/games/dicethrone/domain/flowHooks.ts:35 | 注意 领域逻辑变更，需核对流程/状态/校验 |     isTeamMode,
ADD src/games/dicethrone/domain/flowHooks.ts:36 | 注意 领域逻辑变更，需核对流程/状态/校验 | } from './rules';
DEL src/games/dicethrone/domain/flowHooks.ts:35 | 注意 领域逻辑变更，需核对流程/状态/校验 | import { getPlayerAbilityBaseDamage } from './abilityLookup';
ADD src/games/dicethrone/domain/flowHooks.ts:46 | 注意 领域逻辑变更，需核对流程/状态/校验 | import { getPlayerAbilityBaseDamage, playerAbilityHasDamage, playerAbilityNeedsSingleOpponentTarget } from './abilityLookup';
ADD src/games/dicethrone/domain/flowHooks.ts:49 | 注意 领域逻辑变更，需核对流程/状态/校验 | const pendingAttackNeedsTargetingRoll = (core: DiceThroneCore): boolean => {
ADD src/games/dicethrone/domain/flowHooks.ts:50 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const pendingAttack = core.pendingAttack;
ADD src/games/dicethrone/domain/flowHooks.ts:51 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const sourceAbilityId = pendingAttack?.sourceAbilityId;
ADD src/games/dicethrone/domain/flowHooks.ts:52 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!pendingAttack || !sourceAbilityId || pendingAttack.defenderId !== undefined || !isTeamMode(core)) {
ADD src/games/dicethrone/domain/flowHooks.ts:53 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return false;
ADD src/games/dicethrone/domain/flowHooks.ts:54 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/flowHooks.ts:55 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:56 | 注意 领域逻辑变更，需核对流程/状态/校验 |     return playerAbilityHasDamage(core, pendingAttack.attackerId, sourceAbilityId)
ADD src/games/dicethrone/domain/flowHooks.ts:57 | 注意 领域逻辑变更，需核对流程/状态/校验 |         || playerAbilityNeedsSingleOpponentTarget(core, pendingAttack.attackerId, sourceAbilityId);
ADD src/games/dicethrone/domain/flowHooks.ts:58 | 注意 领域逻辑变更，需核对流程/状态/校验 | };
ADD src/games/dicethrone/domain/flowHooks.ts:59 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:60 | 注意 领域逻辑变更，需核对流程/状态/校验 | const isBlockingInteractionEvent = (event: DiceThroneEvent): boolean =>
ADD src/games/dicethrone/domain/flowHooks.ts:61 | 注意 领域逻辑变更，需核对流程/状态/校验 |     event.type === 'CHOICE_REQUESTED' || event.type === 'INTERACTION_REQUESTED';
ADD src/games/dicethrone/domain/flowHooks.ts:62 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:117 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!defenderId) return { dazeEvents: [], triggered: false };
ADD src/games/dicethrone/domain/flowHooks.ts:177 | 注意 领域逻辑变更，需核对流程/状态/校验 | function buildAutoDefenseAbilityEvent(
ADD src/games/dicethrone/domain/flowHooks.ts:178 | 注意 领域逻辑变更，需核对流程/状态/校验 |     core: DiceThroneCore,
ADD src/games/dicethrone/domain/flowHooks.ts:179 | 注意 领域逻辑变更，需核对流程/状态/校验 |     commandType: string,
ADD src/games/dicethrone/domain/flowHooks.ts:180 | 注意 领域逻辑变更，需核对流程/状态/校验 |     timestamp: number
ADD src/games/dicethrone/domain/flowHooks.ts:181 | 注意 领域逻辑变更，需核对流程/状态/校验 | ): AbilityActivatedEvent | undefined {
ADD src/games/dicethrone/domain/flowHooks.ts:182 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const defenderId = core.pendingAttack?.defenderId;
ADD src/games/dicethrone/domain/flowHooks.ts:183 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!defenderId) return undefined;
ADD src/games/dicethrone/domain/flowHooks.ts:184 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:185 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const defender = core.players[defenderId];
ADD src/games/dicethrone/domain/flowHooks.ts:186 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!defender) return undefined;
ADD src/games/dicethrone/domain/flowHooks.ts:187 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:188 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const defensiveAbilities = defender.abilities.filter((ability) => ability.type === 'defensive');
ADD src/games/dicethrone/domain/flowHooks.ts:189 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (defensiveAbilities.length !== 1) return undefined;
ADD src/games/dicethrone/domain/flowHooks.ts:190 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:191 | 注意 领域逻辑变更，需核对流程/状态/校验 |     return {
ADD src/games/dicethrone/domain/flowHooks.ts:192 | 注意 领域逻辑变更，需核对流程/状态/校验 |         type: 'ABILITY_ACTIVATED',
ADD src/games/dicethrone/domain/flowHooks.ts:193 | 注意 领域逻辑变更，需核对流程/状态/校验 |         payload: {
ADD src/games/dicethrone/domain/flowHooks.ts:194 | 注意 领域逻辑变更，需核对流程/状态/校验 |             abilityId: defensiveAbilities[0].id,
ADD src/games/dicethrone/domain/flowHooks.ts:195 | 注意 领域逻辑变更，需核对流程/状态/校验 |             playerId: defenderId,
ADD src/games/dicethrone/domain/flowHooks.ts:196 | 注意 领域逻辑变更，需核对流程/状态/校验 |             isDefense: true,
ADD src/games/dicethrone/domain/flowHooks.ts:197 | 注意 领域逻辑变更，需核对流程/状态/校验 |         },
ADD src/games/dicethrone/domain/flowHooks.ts:198 | 注意 领域逻辑变更，需核对流程/状态/校验 |         sourceCommandType: commandType,
ADD src/games/dicethrone/domain/flowHooks.ts:199 | 注意 领域逻辑变更，需核对流程/状态/校验 |         timestamp,
ADD src/games/dicethrone/domain/flowHooks.ts:200 | 注意 领域逻辑变更，需核对流程/状态/校验 |     };
ADD src/games/dicethrone/domain/flowHooks.ts:201 | 注意 领域逻辑变更，需核对流程/状态/校验 | }
ADD src/games/dicethrone/domain/flowHooks.ts:202 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:223 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!defenderId) return null;
ADD src/games/dicethrone/domain/flowHooks.ts:388 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 if (pendingAttackNeedsTargetingRoll(core) && !core.pendingAttack.damageResolved && !core.pendingAttack.bonusDiceResolved) {
ADD src/games/dicethrone/domain/flowHooks.ts:389 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     return { events, overrideNextPhase: 'targetingRoll' };
ADD src/games/dicethrone/domain/flowHooks.ts:390 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 }
ADD src/games/dicethrone/domain/flowHooks.ts:391 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:438 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     if (!core.pendingAttack.defenderId) {
ADD src/games/dicethrone/domain/flowHooks.ts:439 | 注意 领域逻辑变更，需核对流程/状态/校验 |                         return { events, halt: true };
ADD src/games/dicethrone/domain/flowHooks.ts:440 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     }
DEL src/games/dicethrone/domain/flowHooks.ts:436 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const defender = core.players[core.pendingAttack.defenderId];
ADD src/games/dicethrone/domain/flowHooks.ts:496 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const defender = core.pendingAttack.defenderId
ADD src/games/dicethrone/domain/flowHooks.ts:497 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     ? core.players[core.pendingAttack.defenderId]
ADD src/games/dicethrone/domain/flowHooks.ts:498 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     : undefined;
DEL src/games/dicethrone/domain/flowHooks.ts:438 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 if (sneakStacks > 0 && !core.pendingAttack.isUltimate) {
ADD src/games/dicethrone/domain/flowHooks.ts:500 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 if (core.pendingAttack.defenderId && sneakStacks > 0 && !core.pendingAttack.isUltimate) {
DEL src/games/dicethrone/domain/flowHooks.ts:445 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     const hasSneakChoice = preDefenseEventsSneak.some((event) => event.type === 'CHOICE_REQUESTED');
ADD src/games/dicethrone/domain/flowHooks.ts:507 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     const hasSneakChoice = preDefenseEventsSneak.some(isBlockingInteractionEvent);
DEL src/games/dicethrone/domain/flowHooks.ts:477 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     const hasPostDamageChoiceSneak = postDamageEventsSneak.some(e => e.type === 'CHOICE_REQUESTED');
ADD src/games/dicethrone/domain/flowHooks.ts:539 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     const hasPostDamageChoiceSneak = postDamageEventsSneak.some(isBlockingInteractionEvent);
DEL src/games/dicethrone/domain/flowHooks.ts:506 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const hasChoice = preDefenseEvents.some((event) => event.type === 'CHOICE_REQUESTED');
ADD src/games/dicethrone/domain/flowHooks.ts:568 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const hasChoice = preDefenseEvents.some(isBlockingInteractionEvent);
ADD src/games/dicethrone/domain/flowHooks.ts:622 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 if (pendingAttackNeedsTargetingRoll(core)) {
ADD src/games/dicethrone/domain/flowHooks.ts:623 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     return { events, overrideNextPhase: 'targetingRoll' };
ADD src/games/dicethrone/domain/flowHooks.ts:624 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 }
ADD src/games/dicethrone/domain/flowHooks.ts:625 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
DEL src/games/dicethrone/domain/flowHooks.ts:569 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const hasAttackChoice = attackEvents.some((event) => event.type === 'CHOICE_REQUESTED');
ADD src/games/dicethrone/domain/flowHooks.ts:635 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const hasAttackChoice = attackEvents.some(isBlockingInteractionEvent);
ADD src/games/dicethrone/domain/flowHooks.ts:668 | 注意 领域逻辑变更，需核对流程/状态/校验 |         // ========== targetingRoll 阶段退出：确定防御方后继续攻击流程 ==========
ADD src/games/dicethrone/domain/flowHooks.ts:669 | 注意 领域逻辑变更，需核对流程/状态/校验 |         if (from === 'targetingRoll') {
ADD src/games/dicethrone/domain/flowHooks.ts:670 | 注意 领域逻辑变更，需核对流程/状态/校验 |             if (!core.pendingAttack) {
ADD src/games/dicethrone/domain/flowHooks.ts:671 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 return { events, overrideNextPhase: 'main2' };
ADD src/games/dicethrone/domain/flowHooks.ts:672 | 注意 领域逻辑变更，需核对流程/状态/校验 |             }
ADD src/games/dicethrone/domain/flowHooks.ts:673 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:674 | 注意 领域逻辑变更，需核对流程/状态/校验 |             let targetingCore = core;
ADD src/games/dicethrone/domain/flowHooks.ts:675 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const attackerId = core.pendingAttack.attackerId;
ADD src/games/dicethrone/domain/flowHooks.ts:676 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const targetingValue = core.dice[0]?.value ?? 1;
ADD src/games/dicethrone/domain/flowHooks.ts:677 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const autoDefenderId = getTargetingRollAutoDefenderId(core, attackerId, targetingValue);
ADD src/games/dicethrone/domain/flowHooks.ts:678 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:679 | 注意 领域逻辑变更，需核对流程/状态/校验 |             if (autoDefenderId) {
ADD src/games/dicethrone/domain/flowHooks.ts:680 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const targetResolvedEvent: DiceThroneEvent = {
ADD src/games/dicethrone/domain/flowHooks.ts:681 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     type: 'CHOICE_RESOLVED',
ADD src/games/dicethrone/domain/flowHooks.ts:682 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     payload: {
ADD src/games/dicethrone/domain/flowHooks.ts:683 | 注意 领域逻辑变更，需核对流程/状态/校验 |                         playerId: attackerId,
ADD src/games/dicethrone/domain/flowHooks.ts:684 | 注意 领域逻辑变更，需核对流程/状态/校验 |                         value: 1,
ADD src/games/dicethrone/domain/flowHooks.ts:685 | 注意 领域逻辑变更，需核对流程/状态/校验 |                         customId: `select-target:${autoDefenderId}`,
ADD src/games/dicethrone/domain/flowHooks.ts:686 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     },
ADD src/games/dicethrone/domain/flowHooks.ts:687 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     sourceCommandType: command.type,
ADD src/games/dicethrone/domain/flowHooks.ts:688 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     timestamp,
ADD src/games/dicethrone/domain/flowHooks.ts:689 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 };
ADD src/games/dicethrone/domain/flowHooks.ts:690 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 events.push(targetResolvedEvent);
ADD src/games/dicethrone/domain/flowHooks.ts:691 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 targetingCore = applyEvents(core, [targetResolvedEvent], reduce);
ADD src/games/dicethrone/domain/flowHooks.ts:692 | 注意 领域逻辑变更，需核对流程/状态/校验 |             } else if (targetingValue === 5 || targetingValue === 6) {
ADD src/games/dicethrone/domain/flowHooks.ts:693 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 if (core.pendingAttack.targetingSelectionPending) {
ADD src/games/dicethrone/domain/flowHooks.ts:694 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     return { events, halt: true };
ADD src/games/dicethrone/domain/flowHooks.ts:695 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 }
ADD src/games/dicethrone/domain/flowHooks.ts:696 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:697 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 if (
ADD src/games/dicethrone/domain/flowHooks.ts:698 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     core.pendingAttack.targetingSelectionResolved !== true
ADD src/games/dicethrone/domain/flowHooks.ts:699 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     && !(
ADD src/games/dicethrone/domain/flowHooks.ts:700 | 注意 领域逻辑变更，需核对流程/状态/校验 |                         state.sys.flowHalted === true
ADD src/games/dicethrone/domain/flowHooks.ts:701 | 注意 领域逻辑变更，需核对流程/状态/校验 |                         && state.sys.interaction?.current === undefined
ADD src/games/dicethrone/domain/flowHooks.ts:702 | 注意 领域逻辑变更，需核对流程/状态/校验 |                         && core.pendingAttack.targetingSelectionPending !== true
ADD src/games/dicethrone/domain/flowHooks.ts:703 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     )
ADD src/games/dicethrone/domain/flowHooks.ts:704 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 ) {
ADD src/games/dicethrone/domain/flowHooks.ts:705 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     const choiceOwnerId = getTargetingRollChoiceOwnerId(core, attackerId, targetingValue);
ADD src/games/dicethrone/domain/flowHooks.ts:706 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     if (!choiceOwnerId) {
ADD src/games/dicethrone/domain/flowHooks.ts:707 | 注意 领域逻辑变更，需核对流程/状态/校验 |                         return { events, overrideNextPhase: core.pendingAttack.isDefendable ? 'defensiveRoll' : 'main2' };
ADD src/games/dicethrone/domain/flowHooks.ts:708 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     }
ADD src/games/dicethrone/domain/flowHooks.ts:709 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:710 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     const choiceEvent: ChoiceRequestedEvent = {
ADD src/games/dicethrone/domain/flowHooks.ts:711 | 注意 领域逻辑变更，需核对流程/状态/校验 |                         type: 'CHOICE_REQUESTED',
ADD src/games/dicethrone/domain/flowHooks.ts:712 | 注意 领域逻辑变更，需核对流程/状态/校验 |                         payload: {
ADD src/games/dicethrone/domain/flowHooks.ts:713 | 注意 领域逻辑变更，需核对流程/状态/校验 |                             playerId: choiceOwnerId,
ADD src/games/dicethrone/domain/flowHooks.ts:714 | 注意 领域逻辑变更，需核对流程/状态/校验 |                             sourceAbilityId: 'targeting-roll',
ADD src/games/dicethrone/domain/flowHooks.ts:715 | 注意 领域逻辑变更，需核对流程/状态/校验 |                             titleKey: targetingValue === 5 ? '鐢卞鎵嬪喅瀹氳皝鎵垮彈鏈鏀诲嚮' : '閫夋嫨鏈鏀诲嚮鐩爣',
ADD src/games/dicethrone/domain/flowHooks.ts:716 | 注意 领域逻辑变更，需核对流程/状态/校验 |                             options: getTargetingRollChoiceOptions(core, attackerId),
ADD src/games/dicethrone/domain/flowHooks.ts:717 | 注意 领域逻辑变更，需核对流程/状态/校验 |                         },
ADD src/games/dicethrone/domain/flowHooks.ts:718 | 注意 领域逻辑变更，需核对流程/状态/校验 |                         sourceCommandType: command.type,
ADD src/games/dicethrone/domain/flowHooks.ts:719 | 注意 领域逻辑变更，需核对流程/状态/校验 |                         timestamp,
ADD src/games/dicethrone/domain/flowHooks.ts:720 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     };
ADD src/games/dicethrone/domain/flowHooks.ts:721 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     events.push(choiceEvent);
ADD src/games/dicethrone/domain/flowHooks.ts:722 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     return { events, halt: true };
ADD src/games/dicethrone/domain/flowHooks.ts:723 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 }
ADD src/games/dicethrone/domain/flowHooks.ts:724 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:725 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 // 5/6 分支的目标已由选择交互写回，继续后续攻击流程，避免重复弹窗。
ADD src/games/dicethrone/domain/flowHooks.ts:726 | 注意 领域逻辑变更，需核对流程/状态/校验 |             }
ADD src/games/dicethrone/domain/flowHooks.ts:727 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:728 | 注意 领域逻辑变更，需核对流程/状态/校验 |             if (!targetingCore.pendingAttack) {
ADD src/games/dicethrone/domain/flowHooks.ts:729 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 return { events, overrideNextPhase: 'main2' };
ADD src/games/dicethrone/domain/flowHooks.ts:730 | 注意 领域逻辑变更，需核对流程/状态/校验 |             }
ADD src/games/dicethrone/domain/flowHooks.ts:731 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:732 | 注意 领域逻辑变更，需核对流程/状态/校验 |             if (!targetingCore.pendingAttack.defenderId) {
ADD src/games/dicethrone/domain/flowHooks.ts:733 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 return { events, halt: true };
ADD src/games/dicethrone/domain/flowHooks.ts:734 | 注意 领域逻辑变更，需核对流程/状态/校验 |             }
ADD src/games/dicethrone/domain/flowHooks.ts:735 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:736 | 注意 领域逻辑变更，需核对流程/状态/校验 |             if (targetingCore.pendingAttack.damageResolved) {
ADD src/games/dicethrone/domain/flowHooks.ts:737 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const coreForPostDamage = getCoreForPostDamageAfterEvasion(targetingCore);
ADD src/games/dicethrone/domain/flowHooks.ts:738 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const isFullyEvaded = coreForPostDamage !== targetingCore;
ADD src/games/dicethrone/domain/flowHooks.ts:739 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const postDamageEvents = resolvePostDamageEffects(coreForPostDamage, random, timestamp);
ADD src/games/dicethrone/domain/flowHooks.ts:740 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const filteredPostDamageEvents = isFullyEvaded
ADD src/games/dicethrone/domain/flowHooks.ts:741 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     ? postDamageEvents.filter(e => e.type !== 'DAMAGE_DEALT')
ADD src/games/dicethrone/domain/flowHooks.ts:742 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     : postDamageEvents;
ADD src/games/dicethrone/domain/flowHooks.ts:743 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 events.push(...filteredPostDamageEvents);
ADD src/games/dicethrone/domain/flowHooks.ts:744 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:745 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const hasBonusDiceRerollPost = postDamageEvents.some(e =>
ADD src/games/dicethrone/domain/flowHooks.ts:746 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     e.type === 'BONUS_DICE_REROLL_REQUESTED' &&
ADD src/games/dicethrone/domain/flowHooks.ts:747 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     !(e as any).payload?.settlement?.displayOnly
ADD src/games/dicethrone/domain/flowHooks.ts:748 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 );
ADD src/games/dicethrone/domain/flowHooks.ts:749 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 if (hasBonusDiceRerollPost) {
ADD src/games/dicethrone/domain/flowHooks.ts:750 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     return { events, halt: true };
ADD src/games/dicethrone/domain/flowHooks.ts:751 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 }
ADD src/games/dicethrone/domain/flowHooks.ts:752 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:753 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const { dazeEvents, triggered } = checkDazeExtraAttack(
ADD src/games/dicethrone/domain/flowHooks.ts:754 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     targetingCore, events, command.type, timestamp
ADD src/games/dicethrone/domain/flowHooks.ts:755 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 );
ADD src/games/dicethrone/domain/flowHooks.ts:756 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 if (triggered) {
ADD src/games/dicethrone/domain/flowHooks.ts:757 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     events.push(...dazeEvents);
ADD src/games/dicethrone/domain/flowHooks.ts:758 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     return { events, overrideNextPhase: 'offensiveRoll' };
ADD src/games/dicethrone/domain/flowHooks.ts:759 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 }
ADD src/games/dicethrone/domain/flowHooks.ts:760 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:761 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const afterAttackWindow = checkAfterAttackResponseWindow(targetingCore, events, command.type, timestamp, from as TurnPhase);
ADD src/games/dicethrone/domain/flowHooks.ts:762 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 if (afterAttackWindow) {
ADD src/games/dicethrone/domain/flowHooks.ts:763 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     events.push(afterAttackWindow);
ADD src/games/dicethrone/domain/flowHooks.ts:764 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     return { events, halt: true };
ADD src/games/dicethrone/domain/flowHooks.ts:765 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 }
ADD src/games/dicethrone/domain/flowHooks.ts:766 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:767 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 return { events, overrideNextPhase: 'main2' };
ADD src/games/dicethrone/domain/flowHooks.ts:768 | 注意 领域逻辑变更，需核对流程/状态/校验 |             }
ADD src/games/dicethrone/domain/flowHooks.ts:769 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:770 | 注意 领域逻辑变更，需核对流程/状态/校验 |             if (targetingCore.pendingAttack.bonusDiceResolved) {
ADD src/games/dicethrone/domain/flowHooks.ts:771 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const { attackerId: resolvedAttackerId, defenderId, sourceAbilityId, defenseAbilityId } = targetingCore.pendingAttack;
ADD src/games/dicethrone/domain/flowHooks.ts:772 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const totalDamage = targetingCore.pendingAttack.resolvedDamage ?? 0;
ADD src/games/dicethrone/domain/flowHooks.ts:773 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 events.push({
ADD src/games/dicethrone/domain/flowHooks.ts:774 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     type: 'ATTACK_RESOLVED',
ADD src/games/dicethrone/domain/flowHooks.ts:775 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     payload: { attackerId: resolvedAttackerId, defenderId, sourceAbilityId, defenseAbilityId, totalDamage },
ADD src/games/dicethrone/domain/flowHooks.ts:776 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     sourceCommandType: command.type,
ADD src/games/dicethrone/domain/flowHooks.ts:777 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     timestamp,
ADD src/games/dicethrone/domain/flowHooks.ts:778 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 } as AttackResolvedEvent);
ADD src/games/dicethrone/domain/flowHooks.ts:779 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:780 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const { dazeEvents, triggered } = checkDazeExtraAttack(
ADD src/games/dicethrone/domain/flowHooks.ts:781 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     targetingCore, events, command.type, timestamp
ADD src/games/dicethrone/domain/flowHooks.ts:782 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 );
ADD src/games/dicethrone/domain/flowHooks.ts:783 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 if (triggered) {
ADD src/games/dicethrone/domain/flowHooks.ts:784 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     events.push(...dazeEvents);
ADD src/games/dicethrone/domain/flowHooks.ts:785 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     return { events, overrideNextPhase: 'offensiveRoll' };
ADD src/games/dicethrone/domain/flowHooks.ts:786 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 }
ADD src/games/dicethrone/domain/flowHooks.ts:787 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:788 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const afterAttackWindow = checkAfterAttackResponseWindow(targetingCore, events, command.type, timestamp, from as TurnPhase);
ADD src/games/dicethrone/domain/flowHooks.ts:789 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 if (afterAttackWindow) {
ADD src/games/dicethrone/domain/flowHooks.ts:790 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     events.push(afterAttackWindow);
ADD src/games/dicethrone/domain/flowHooks.ts:791 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     return { events, halt: true };
ADD src/games/dicethrone/domain/flowHooks.ts:792 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 }
ADD src/games/dicethrone/domain/flowHooks.ts:793 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:794 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 return { events, overrideNextPhase: 'main2' };
ADD src/games/dicethrone/domain/flowHooks.ts:795 | 注意 领域逻辑变更，需核对流程/状态/校验 |             }
ADD src/games/dicethrone/domain/flowHooks.ts:796 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:797 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const attacker = targetingCore.players[targetingCore.pendingAttack.attackerId];
ADD src/games/dicethrone/domain/flowHooks.ts:798 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const blindedStacks = attacker?.statusEffects[STATUS_IDS.BLINDED] ?? 0;
ADD src/games/dicethrone/domain/flowHooks.ts:799 | 注意 领域逻辑变更，需核对流程/状态/校验 |             if (blindedStacks > 0 && random) {
ADD src/games/dicethrone/domain/flowHooks.ts:800 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const blindedValue = random.d(6);
ADD src/games/dicethrone/domain/flowHooks.ts:801 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const blindedFace = getPlayerDieFace(targetingCore, targetingCore.pendingAttack.attackerId, blindedValue) ?? '';
ADD src/games/dicethrone/domain/flowHooks.ts:802 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 events.push({
ADD src/games/dicethrone/domain/flowHooks.ts:803 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     type: 'BONUS_DIE_ROLLED',
ADD src/games/dicethrone/domain/flowHooks.ts:804 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     payload: { value: blindedValue, face: blindedFace, playerId: targetingCore.pendingAttack.attackerId, targetPlayerId: targetingCore.pendingAttack.attackerId, effectKey: 'bonusDie.effect.blinded' },
ADD src/games/dicethrone/domain/flowHooks.ts:805 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     sourceCommandType: command.type,
ADD src/games/dicethrone/domain/flowHooks.ts:806 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     timestamp,
ADD src/games/dicethrone/domain/flowHooks.ts:807 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 } as any);
ADD src/games/dicethrone/domain/flowHooks.ts:808 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 events.push({
ADD src/games/dicethrone/domain/flowHooks.ts:809 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     type: 'STATUS_REMOVED',
ADD src/games/dicethrone/domain/flowHooks.ts:810 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     payload: { targetId: targetingCore.pendingAttack.attackerId, statusId: STATUS_IDS.BLINDED, stacks: blindedStacks },
ADD src/games/dicethrone/domain/flowHooks.ts:811 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     sourceCommandType: command.type,
ADD src/games/dicethrone/domain/flowHooks.ts:812 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     timestamp,
ADD src/games/dicethrone/domain/flowHooks.ts:813 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 } as any);
ADD src/games/dicethrone/domain/flowHooks.ts:814 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 if (blindedValue <= 2) {
ADD src/games/dicethrone/domain/flowHooks.ts:815 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     return { events, overrideNextPhase: 'main2' };
ADD src/games/dicethrone/domain/flowHooks.ts:816 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 }
ADD src/games/dicethrone/domain/flowHooks.ts:817 | 注意 领域逻辑变更，需核对流程/状态/校验 |             }
ADD src/games/dicethrone/domain/flowHooks.ts:818 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:819 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const defender = targetingCore.pendingAttack.defenderId
ADD src/games/dicethrone/domain/flowHooks.ts:820 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 ? targetingCore.players[targetingCore.pendingAttack.defenderId]
ADD src/games/dicethrone/domain/flowHooks.ts:821 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 : undefined;
ADD src/games/dicethrone/domain/flowHooks.ts:822 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const sneakStacks = defender?.tokens[TOKEN_IDS.SNEAK] ?? 0;
ADD src/games/dicethrone/domain/flowHooks.ts:823 | 注意 领域逻辑变更，需核对流程/状态/校验 |             if (sneakStacks > 0 && !targetingCore.pendingAttack.isUltimate) {
ADD src/games/dicethrone/domain/flowHooks.ts:824 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const preDefenseEventsSneak = resolveOffensivePreDefenseEffects(targetingCore, timestamp);
ADD src/games/dicethrone/domain/flowHooks.ts:825 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 events.push(...preDefenseEventsSneak);
ADD src/games/dicethrone/domain/flowHooks.ts:826 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:827 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const hasSneakChoice = preDefenseEventsSneak.some(isBlockingInteractionEvent);
ADD src/games/dicethrone/domain/flowHooks.ts:828 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const hasBonusDiceRerollPreDefenseSneak = preDefenseEventsSneak.some((event) =>
ADD src/games/dicethrone/domain/flowHooks.ts:829 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     event.type === 'BONUS_DICE_REROLL_REQUESTED' &&
ADD src/games/dicethrone/domain/flowHooks.ts:830 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     !(event as any).payload?.settlement?.displayOnly
ADD src/games/dicethrone/domain/flowHooks.ts:831 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 );
ADD src/games/dicethrone/domain/flowHooks.ts:832 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 if (hasSneakChoice || hasBonusDiceRerollPreDefenseSneak) {
ADD src/games/dicethrone/domain/flowHooks.ts:833 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     return { events, halt: true };
ADD src/games/dicethrone/domain/flowHooks.ts:834 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 }
ADD src/games/dicethrone/domain/flowHooks.ts:835 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:836 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const coreAfterPreDefenseSneak = preDefenseEventsSneak.length > 0
ADD src/games/dicethrone/domain/flowHooks.ts:837 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     ? applyEvents(targetingCore, [...events] as DiceThroneEvent[], reduce)
ADD src/games/dicethrone/domain/flowHooks.ts:838 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     : targetingCore;
ADD src/games/dicethrone/domain/flowHooks.ts:839 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:840 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const sneakBaseDamage = getPendingAttackExpectedDamage(coreAfterPreDefenseSneak, targetingCore.pendingAttack, 1);
ADD src/games/dicethrone/domain/flowHooks.ts:841 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const coreForPostDamage = {
ADD src/games/dicethrone/domain/flowHooks.ts:842 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     ...coreAfterPreDefenseSneak,
ADD src/games/dicethrone/domain/flowHooks.ts:843 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     pendingAttack: {
ADD src/games/dicethrone/domain/flowHooks.ts:844 | 注意 领域逻辑变更，需核对流程/状态/校验 |                         ...coreAfterPreDefenseSneak.pendingAttack!,
ADD src/games/dicethrone/domain/flowHooks.ts:845 | 注意 领域逻辑变更，需核对流程/状态/校验 |                         resolvedDamage: sneakBaseDamage,
ADD src/games/dicethrone/domain/flowHooks.ts:846 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     },
ADD src/games/dicethrone/domain/flowHooks.ts:847 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 };
ADD src/games/dicethrone/domain/flowHooks.ts:848 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const postDamageEventsSneak = resolvePostDamageEffects(coreForPostDamage, random, timestamp);
ADD src/games/dicethrone/domain/flowHooks.ts:849 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 events.push(...postDamageEventsSneak.filter(e => e.type !== 'DAMAGE_DEALT'));
ADD src/games/dicethrone/domain/flowHooks.ts:850 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:851 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const hasBonusDiceRerollSneak = postDamageEventsSneak.some(e =>
ADD src/games/dicethrone/domain/flowHooks.ts:852 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     e.type === 'BONUS_DICE_REROLL_REQUESTED' &&
ADD src/games/dicethrone/domain/flowHooks.ts:853 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     !(e as any).payload?.settlement?.displayOnly
ADD src/games/dicethrone/domain/flowHooks.ts:854 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 );
ADD src/games/dicethrone/domain/flowHooks.ts:855 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const hasPostDamageChoiceSneak = postDamageEventsSneak.some(isBlockingInteractionEvent);
ADD src/games/dicethrone/domain/flowHooks.ts:856 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const hasTokenResponseSneak = postDamageEventsSneak.some(e => e.type === 'TOKEN_RESPONSE_REQUESTED');
ADD src/games/dicethrone/domain/flowHooks.ts:857 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 if (hasBonusDiceRerollSneak || hasPostDamageChoiceSneak || hasTokenResponseSneak) {
ADD src/games/dicethrone/domain/flowHooks.ts:858 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     return { events, halt: true };
ADD src/games/dicethrone/domain/flowHooks.ts:859 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 }
ADD src/games/dicethrone/domain/flowHooks.ts:860 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:861 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const { dazeEvents: dazeEventsSneak, triggered: dazeTriggeredSneak } = checkDazeExtraAttack(
ADD src/games/dicethrone/domain/flowHooks.ts:862 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     targetingCore, events, command.type, timestamp
ADD src/games/dicethrone/domain/flowHooks.ts:863 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 );
ADD src/games/dicethrone/domain/flowHooks.ts:864 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 if (dazeTriggeredSneak) {
ADD src/games/dicethrone/domain/flowHooks.ts:865 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     events.push(...dazeEventsSneak);
ADD src/games/dicethrone/domain/flowHooks.ts:866 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     return { events, overrideNextPhase: 'offensiveRoll' };
ADD src/games/dicethrone/domain/flowHooks.ts:867 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 }
ADD src/games/dicethrone/domain/flowHooks.ts:868 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:869 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const afterAttackWindowSneak = checkAfterAttackResponseWindow(targetingCore, events, command.type, timestamp, from as TurnPhase);
ADD src/games/dicethrone/domain/flowHooks.ts:870 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 if (afterAttackWindowSneak) {
ADD src/games/dicethrone/domain/flowHooks.ts:871 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     events.push(afterAttackWindowSneak);
ADD src/games/dicethrone/domain/flowHooks.ts:872 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     return { events, halt: true };
ADD src/games/dicethrone/domain/flowHooks.ts:873 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 }
ADD src/games/dicethrone/domain/flowHooks.ts:874 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:875 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 return { events, overrideNextPhase: 'main2' };
ADD src/games/dicethrone/domain/flowHooks.ts:876 | 注意 领域逻辑变更，需核对流程/状态/校验 |             }
ADD src/games/dicethrone/domain/flowHooks.ts:877 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:878 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const preDefenseEvents = resolveOffensivePreDefenseEffects(targetingCore, timestamp);
ADD src/games/dicethrone/domain/flowHooks.ts:879 | 注意 领域逻辑变更，需核对流程/状态/校验 |             events.push(...preDefenseEvents);
ADD src/games/dicethrone/domain/flowHooks.ts:880 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:881 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const hasChoice = preDefenseEvents.some(isBlockingInteractionEvent);
ADD src/games/dicethrone/domain/flowHooks.ts:882 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const hasBonusDiceRerollPreDefense = preDefenseEvents.some((event) =>
ADD src/games/dicethrone/domain/flowHooks.ts:883 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 event.type === 'BONUS_DICE_REROLL_REQUESTED' &&
ADD src/games/dicethrone/domain/flowHooks.ts:884 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 !(event as any).payload?.settlement?.displayOnly
ADD src/games/dicethrone/domain/flowHooks.ts:885 | 注意 领域逻辑变更，需核对流程/状态/校验 |             );
ADD src/games/dicethrone/domain/flowHooks.ts:886 | 注意 领域逻辑变更，需核对流程/状态/校验 |             if (hasChoice || hasBonusDiceRerollPreDefense) {
ADD src/games/dicethrone/domain/flowHooks.ts:887 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 return { events, halt: true };
ADD src/games/dicethrone/domain/flowHooks.ts:888 | 注意 领域逻辑变更，需核对流程/状态/校验 |             }
ADD src/games/dicethrone/domain/flowHooks.ts:889 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:890 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const coreAfterPreDefense = preDefenseEvents.length > 0
ADD src/games/dicethrone/domain/flowHooks.ts:891 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 ? applyEvents(targetingCore, preDefenseEvents as DiceThroneEvent[], reduce)
ADD src/games/dicethrone/domain/flowHooks.ts:892 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 : targetingCore;
ADD src/games/dicethrone/domain/flowHooks.ts:893 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:894 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const sourceAbilityId = coreAfterPreDefense.pendingAttack?.sourceAbilityId;
ADD src/games/dicethrone/domain/flowHooks.ts:895 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const expectedDamage = coreAfterPreDefense.pendingAttack
ADD src/games/dicethrone/domain/flowHooks.ts:896 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 ? getPendingAttackExpectedDamage(coreAfterPreDefense, coreAfterPreDefense.pendingAttack)
ADD src/games/dicethrone/domain/flowHooks.ts:897 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 : 0;
ADD src/games/dicethrone/domain/flowHooks.ts:898 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const offensiveRollEndTokens = getUsableTokensForOffensiveRollEnd(coreAfterPreDefense, attackerId, expectedDamage);
ADD src/games/dicethrone/domain/flowHooks.ts:899 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:900 | 注意 领域逻辑变更，需核对流程/状态/校验 |             if (offensiveRollEndTokens.length > 0 && !coreAfterPreDefense.pendingAttack?.offensiveRollEndTokenResolved) {
ADD src/games/dicethrone/domain/flowHooks.ts:901 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const tokenOptions = offensiveRollEndTokens.map(def => ({
ADD src/games/dicethrone/domain/flowHooks.ts:902 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     tokenId: def.id,
ADD src/games/dicethrone/domain/flowHooks.ts:903 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     value: 1,
ADD src/games/dicethrone/domain/flowHooks.ts:904 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     customId: `use-${def.id}`,
ADD src/games/dicethrone/domain/flowHooks.ts:905 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     labelKey: `tokens.${def.id}.name`,
ADD src/games/dicethrone/domain/flowHooks.ts:906 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 }));
ADD src/games/dicethrone/domain/flowHooks.ts:907 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 tokenOptions.push({
ADD src/games/dicethrone/domain/flowHooks.ts:908 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     tokenId: undefined as any,
ADD src/games/dicethrone/domain/flowHooks.ts:909 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     value: 0,
ADD src/games/dicethrone/domain/flowHooks.ts:910 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     customId: 'skip',
ADD src/games/dicethrone/domain/flowHooks.ts:911 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     labelKey: 'tokenResponse.skip',
ADD src/games/dicethrone/domain/flowHooks.ts:912 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 });
ADD src/games/dicethrone/domain/flowHooks.ts:913 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:914 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const choiceEvent: ChoiceRequestedEvent = {
ADD src/games/dicethrone/domain/flowHooks.ts:915 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     type: 'CHOICE_REQUESTED',
ADD src/games/dicethrone/domain/flowHooks.ts:916 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     payload: {
ADD src/games/dicethrone/domain/flowHooks.ts:917 | 注意 领域逻辑变更，需核对流程/状态/校验 |                         playerId: attackerId,
ADD src/games/dicethrone/domain/flowHooks.ts:918 | 注意 领域逻辑变更，需核对流程/状态/校验 |                         sourceAbilityId: sourceAbilityId ?? 'offensive-roll-end-token',
ADD src/games/dicethrone/domain/flowHooks.ts:919 | 注意 领域逻辑变更，需核对流程/状态/校验 |                         titleKey: 'offensiveRollEndToken.title',
ADD src/games/dicethrone/domain/flowHooks.ts:920 | 注意 领域逻辑变更，需核对流程/状态/校验 |                         options: tokenOptions,
ADD src/games/dicethrone/domain/flowHooks.ts:921 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     },
ADD src/games/dicethrone/domain/flowHooks.ts:922 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     sourceCommandType: command.type,
ADD src/games/dicethrone/domain/flowHooks.ts:923 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     timestamp,
ADD src/games/dicethrone/domain/flowHooks.ts:924 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 };
ADD src/games/dicethrone/domain/flowHooks.ts:925 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 events.push(choiceEvent);
ADD src/games/dicethrone/domain/flowHooks.ts:926 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 return { events, halt: true };
ADD src/games/dicethrone/domain/flowHooks.ts:927 | 注意 领域逻辑变更，需核对流程/状态/校验 |             }
ADD src/games/dicethrone/domain/flowHooks.ts:928 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:929 | 注意 领域逻辑变更，需核对流程/状态/校验 |             if (coreAfterPreDefense.pendingAttack?.isDefendable) {
ADD src/games/dicethrone/domain/flowHooks.ts:930 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const autoDefenseAbilityEvent = buildAutoDefenseAbilityEvent(coreAfterPreDefense, command.type, timestamp);
ADD src/games/dicethrone/domain/flowHooks.ts:931 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 if (autoDefenseAbilityEvent) {
ADD src/games/dicethrone/domain/flowHooks.ts:932 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     events.push(autoDefenseAbilityEvent);
ADD src/games/dicethrone/domain/flowHooks.ts:933 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 }
ADD src/games/dicethrone/domain/flowHooks.ts:934 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 return { events, overrideNextPhase: 'defensiveRoll' };
ADD src/games/dicethrone/domain/flowHooks.ts:935 | 注意 领域逻辑变更，需核对流程/状态/校验 |             }
ADD src/games/dicethrone/domain/flowHooks.ts:936 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:937 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const attackEvents = resolveAttack(coreAfterPreDefense, random, { includePreDefense: false }, timestamp);
ADD src/games/dicethrone/domain/flowHooks.ts:938 | 注意 领域逻辑变更，需核对流程/状态/校验 |             events.push(...attackEvents);
ADD src/games/dicethrone/domain/flowHooks.ts:939 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:940 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const hasAttackChoice = attackEvents.some(isBlockingInteractionEvent);
ADD src/games/dicethrone/domain/flowHooks.ts:941 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const hasTokenResponse = attackEvents.some((event) => event.type === 'TOKEN_RESPONSE_REQUESTED');
ADD src/games/dicethrone/domain/flowHooks.ts:942 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const hasBonusDiceRerollOff = attackEvents.some((event) =>
ADD src/games/dicethrone/domain/flowHooks.ts:943 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 event.type === 'BONUS_DICE_REROLL_REQUESTED' &&
ADD src/games/dicethrone/domain/flowHooks.ts:944 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 !(event as any).payload?.settlement?.displayOnly
ADD src/games/dicethrone/domain/flowHooks.ts:945 | 注意 领域逻辑变更，需核对流程/状态/校验 |             );
ADD src/games/dicethrone/domain/flowHooks.ts:946 | 注意 领域逻辑变更，需核对流程/状态/校验 |             if (hasAttackChoice || hasTokenResponse || hasBonusDiceRerollOff) {
ADD src/games/dicethrone/domain/flowHooks.ts:947 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 return { events, halt: true };
ADD src/games/dicethrone/domain/flowHooks.ts:948 | 注意 领域逻辑变更，需核对流程/状态/校验 |             }
ADD src/games/dicethrone/domain/flowHooks.ts:949 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:950 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const { dazeEvents: dazeEventsOff, triggered: dazeTriggeredOff } = checkDazeExtraAttack(
ADD src/games/dicethrone/domain/flowHooks.ts:951 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 coreAfterPreDefense, events, command.type, timestamp
ADD src/games/dicethrone/domain/flowHooks.ts:952 | 注意 领域逻辑变更，需核对流程/状态/校验 |             );
ADD src/games/dicethrone/domain/flowHooks.ts:953 | 注意 领域逻辑变更，需核对流程/状态/校验 |             if (dazeTriggeredOff) {
ADD src/games/dicethrone/domain/flowHooks.ts:954 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 events.push(...dazeEventsOff);
ADD src/games/dicethrone/domain/flowHooks.ts:955 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 return { events, overrideNextPhase: 'offensiveRoll' };
ADD src/games/dicethrone/domain/flowHooks.ts:956 | 注意 领域逻辑变更，需核对流程/状态/校验 |             }
ADD src/games/dicethrone/domain/flowHooks.ts:957 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:958 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const afterAttackWindowOff = checkAfterAttackResponseWindow(coreAfterPreDefense, events, command.type, timestamp, from as TurnPhase);
ADD src/games/dicethrone/domain/flowHooks.ts:959 | 注意 领域逻辑变更，需核对流程/状态/校验 |             if (afterAttackWindowOff) {
ADD src/games/dicethrone/domain/flowHooks.ts:960 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 events.push(afterAttackWindowOff);
ADD src/games/dicethrone/domain/flowHooks.ts:961 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 return { events, halt: true };
ADD src/games/dicethrone/domain/flowHooks.ts:962 | 注意 领域逻辑变更，需核对流程/状态/校验 |             }
ADD src/games/dicethrone/domain/flowHooks.ts:963 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:964 | 注意 领域逻辑变更，需核对流程/状态/校验 |             return { events, overrideNextPhase: 'main2' };
ADD src/games/dicethrone/domain/flowHooks.ts:965 | 注意 领域逻辑变更，需核对流程/状态/校验 |         }
ADD src/games/dicethrone/domain/flowHooks.ts:966 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:1017 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     if (!core.pendingAttack.defenderId) {
ADD src/games/dicethrone/domain/flowHooks.ts:1018 | 注意 领域逻辑变更，需核对流程/状态/校验 |                         return { events, halt: true };
ADD src/games/dicethrone/domain/flowHooks.ts:1019 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     }
ADD src/games/dicethrone/domain/flowHooks.ts:1047 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 if (!core.pendingAttack.defenderId) {
ADD src/games/dicethrone/domain/flowHooks.ts:1048 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     return { events, halt: true };
ADD src/games/dicethrone/domain/flowHooks.ts:1049 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 }
DEL src/games/dicethrone/domain/flowHooks.ts:686 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const hasAttackChoice = attackEvents.some((event) => event.type === 'CHOICE_REQUESTED');
ADD src/games/dicethrone/domain/flowHooks.ts:1057 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const hasAttackChoice = attackEvents.some(isBlockingInteractionEvent);
DEL src/games/dicethrone/domain/flowHooks.ts:784 | 注意 领域逻辑变更，需核对流程/状态/校验 |         // ====== 3. 战斗阶段（offensiveRoll/defensiveRoll）：仅在 flowHalted 时自动推进 ======
ADD src/games/dicethrone/domain/flowHooks.ts:1155 | 注意 领域逻辑变更，需核对流程/状态/校验 |         // ====== 3. 战斗阶段（offensiveRoll/targetingRoll/defensiveRoll）：仅在 flowHalted 时自动推进 ======
DEL src/games/dicethrone/domain/flowHooks.ts:790 | 注意 领域逻辑变更，需核对流程/状态/校验 |         if (phase === 'offensiveRoll' || phase === 'defensiveRoll') {
DEL src/games/dicethrone/domain/flowHooks.ts:791 | 注意 领域逻辑变更，需核对流程/状态/校验 |             if (!state.sys.flowHalted) return undefined;
DEL src/games/dicethrone/domain/flowHooks.ts:792 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:1161 | 注意 领域逻辑变更，需核对流程/状态/校验 |         if (phase === 'offensiveRoll' || phase === 'targetingRoll' || phase === 'defensiveRoll') {
ADD src/games/dicethrone/domain/flowHooks.ts:1206 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:1207 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const pendingTargetingChoice = hasSysInteractionResolved
ADD src/games/dicethrone/domain/flowHooks.ts:1208 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 && phase === 'targetingRoll'
ADD src/games/dicethrone/domain/flowHooks.ts:1209 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 && core.pendingAttack !== null
ADD src/games/dicethrone/domain/flowHooks.ts:1210 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 && core.pendingAttack !== undefined
ADD src/games/dicethrone/domain/flowHooks.ts:1211 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 && core.pendingAttack.targetingSelectionPending === true;
ADD src/games/dicethrone/domain/flowHooks.ts:1212 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/flowHooks.ts:1213 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const shouldAttemptAutoContinue = state.sys.flowHalted
ADD src/games/dicethrone/domain/flowHooks.ts:1214 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 || hasSysInteractionResolved
ADD src/games/dicethrone/domain/flowHooks.ts:1215 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 || hasTokenResponseClosed;
ADD src/games/dicethrone/domain/flowHooks.ts:1216 | 注意 领域逻辑变更，需核对流程/状态/校验 |             if (!shouldAttemptAutoContinue) return undefined;
DEL src/games/dicethrone/domain/flowHooks.ts:838 | 注意 领域逻辑变更，需核对流程/状态/校验 |             if (!hasActiveInteraction && !hasActiveResponseWindow && !hasPendingDamage && !hasPendingBonusDice && !pendingOffensiveTokenChoice) {
ADD src/games/dicethrone/domain/flowHooks.ts:1218 | 注意 领域逻辑变更，需核对流程/状态/校验 |             if (!hasActiveInteraction && !hasActiveResponseWindow && !hasPendingDamage && !hasPendingBonusDice && !pendingOffensiveTokenChoice && !pendingTargetingChoice) {
ADD src/games/dicethrone/domain/flowHooks.ts:1338 | 注意 领域逻辑变更，需核对流程/状态/校验 |             if (!defenderId) {
ADD src/games/dicethrone/domain/flowHooks.ts:1339 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 return undefined;
ADD src/games/dicethrone/domain/flowHooks.ts:1340 | 注意 领域逻辑变更，需核对流程/状态/校验 |             }
ADD src/games/dicethrone/domain/ids.ts:204 | 注意 领域逻辑变更，需核对流程/状态/校验 |     MOVE_SEAT: 'MOVE_SEAT',
DEL src/games/dicethrone/domain/index.ts:8 | 注意 领域逻辑变更，需核对流程/状态/校验 | import type { DiceThroneCore, DiceThroneCommand, DiceThroneEvent, HeroState, CharacterId, TurnPhase, InteractionDescriptor, DtResponseWindowType } from './types';
ADD src/games/dicethrone/domain/index.ts:8 | 注意 领域逻辑变更，需核对流程/状态/校验 | import type { DiceThroneCore, DiceThroneCommand, DiceThroneEvent, HeroState, CharacterId, TurnPhase, InteractionDescriptor, DtResponseWindowType, TeamId } from './types';
ADD src/games/dicethrone/domain/index.ts:28 | 注意 领域逻辑变更，需核对流程/状态/校验 | import { INITIAL_HEALTH } from './types';
ADD src/games/dicethrone/domain/index.ts:29 | 注意 领域逻辑变更，需核对流程/状态/校验 | import { buildTeamIdByPlayerIdFromSeatingOrder, getTeamIdByPlayerIdMap, isTeamMode } from './rules';
ADD src/games/dicethrone/domain/index.ts:84 | 注意 领域逻辑变更，需核对流程/状态/校验 |         const isFourPlayerTeamMode = playerIds.length === 4;
ADD src/games/dicethrone/domain/index.ts:85 | 注意 领域逻辑变更，需核对流程/状态/校验 |         const seatingOrder = isFourPlayerTeamMode ? [...playerIds] : undefined;
ADD src/games/dicethrone/domain/index.ts:86 | 注意 领域逻辑变更，需核对流程/状态/校验 |         const teamIdByPlayerId = isFourPlayerTeamMode && seatingOrder
ADD src/games/dicethrone/domain/index.ts:87 | 注意 领域逻辑变更，需核对流程/状态/校验 |             ? buildTeamIdByPlayerIdFromSeatingOrder(seatingOrder)
ADD src/games/dicethrone/domain/index.ts:88 | 注意 领域逻辑变更，需核对流程/状态/校验 |             : undefined;
ADD src/games/dicethrone/domain/index.ts:89 | 注意 领域逻辑变更，需核对流程/状态/校验 |         const teamHealth = isFourPlayerTeamMode
ADD src/games/dicethrone/domain/index.ts:90 | 注意 领域逻辑变更，需核对流程/状态/校验 |             ? { A: INITIAL_HEALTH, B: INITIAL_HEALTH }
ADD src/games/dicethrone/domain/index.ts:91 | 注意 领域逻辑变更，需核对流程/状态/校验 |             : undefined;
ADD src/games/dicethrone/domain/index.ts:92 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/index.ts:95 | 注意 领域逻辑变更，需核对流程/状态/校验 |             seatingOrder,
ADD src/games/dicethrone/domain/index.ts:96 | 注意 领域逻辑变更，需核对流程/状态/校验 |             teamIdByPlayerId,
ADD src/games/dicethrone/domain/index.ts:97 | 注意 领域逻辑变更，需核对流程/状态/校验 |             teamHealth,
ADD src/games/dicethrone/domain/index.ts:154 | 注意 领域逻辑变更，需核对流程/状态/校验 |         if (isTeamMode(state)) {
ADD src/games/dicethrone/domain/index.ts:155 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const teamIdByPlayerId = getTeamIdByPlayerIdMap(state);
ADD src/games/dicethrone/domain/index.ts:156 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const healthByTeam: Record<TeamId, number> = {
ADD src/games/dicethrone/domain/index.ts:157 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 A: state.teamHealth?.A ?? INITIAL_HEALTH,
ADD src/games/dicethrone/domain/index.ts:158 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 B: state.teamHealth?.B ?? INITIAL_HEALTH,
ADD src/games/dicethrone/domain/index.ts:159 | 注意 领域逻辑变更，需核对流程/状态/校验 |             };
ADD src/games/dicethrone/domain/index.ts:160 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/index.ts:161 | 注意 领域逻辑变更，需核对流程/状态/校验 |             (Object.keys(state.players) as PlayerId[]).forEach((playerId) => {
ADD src/games/dicethrone/domain/index.ts:162 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const teamId = teamIdByPlayerId[playerId];
ADD src/games/dicethrone/domain/index.ts:163 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 if (!teamId) return;
ADD src/games/dicethrone/domain/index.ts:164 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 const hp = state.players[playerId]?.resources[RESOURCE_IDS.HP] ?? healthByTeam[teamId];
ADD src/games/dicethrone/domain/index.ts:165 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 healthByTeam[teamId] = Math.min(healthByTeam[teamId], hp);
ADD src/games/dicethrone/domain/index.ts:166 | 注意 领域逻辑变更，需核对流程/状态/校验 |             });
ADD src/games/dicethrone/domain/index.ts:167 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/index.ts:168 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const teamADefeated = healthByTeam.A <= 0;
ADD src/games/dicethrone/domain/index.ts:169 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const teamBDefeated = healthByTeam.B <= 0;
ADD src/games/dicethrone/domain/index.ts:170 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/index.ts:171 | 注意 领域逻辑变更，需核对流程/状态/校验 |             if (!teamADefeated && !teamBDefeated) return undefined;
ADD src/games/dicethrone/domain/index.ts:172 | 注意 领域逻辑变更，需核对流程/状态/校验 |             if (teamADefeated && teamBDefeated) return { draw: true };
ADD src/games/dicethrone/domain/index.ts:173 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/index.ts:174 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const winnerTeamId: TeamId = teamADefeated ? 'B' : 'A';
ADD src/games/dicethrone/domain/index.ts:175 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const winner = (Object.keys(state.players) as PlayerId[]).find(
ADD src/games/dicethrone/domain/index.ts:176 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 (playerId) => teamIdByPlayerId[playerId] === winnerTeamId
ADD src/games/dicethrone/domain/index.ts:177 | 注意 领域逻辑变更，需核对流程/状态/校验 |             );
ADD src/games/dicethrone/domain/index.ts:178 | 注意 领域逻辑变更，需核对流程/状态/校验 |             return winner ? { winner } : { draw: true };
ADD src/games/dicethrone/domain/index.ts:179 | 注意 领域逻辑变更，需核对流程/状态/校验 |         }
ADD src/games/dicethrone/domain/index.ts:180 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
DEL src/games/dicethrone/domain/reduceCombat.ts:9 | 注意 领域逻辑变更，需核对流程/状态/校验 | import { getFaceCounts, getActiveDice } from './rules';
ADD src/games/dicethrone/domain/reduceCombat.ts:9 | 注意 领域逻辑变更，需核对流程/状态/校验 | import { getFaceCounts, getActiveDice, getTeamId, isTeamMode } from './rules';
ADD src/games/dicethrone/domain/reduceCombat.ts:16 | 注意 领域逻辑变更，需核对流程/状态/校验 | const buildPlayersWithSyncedHp = (
ADD src/games/dicethrone/domain/reduceCombat.ts:17 | 注意 领域逻辑变更，需核对流程/状态/校验 |     state: DiceThroneCore,
ADD src/games/dicethrone/domain/reduceCombat.ts:18 | 注意 领域逻辑变更，需核对流程/状态/校验 |     targetId: string,
ADD src/games/dicethrone/domain/reduceCombat.ts:19 | 注意 领域逻辑变更，需核对流程/状态/校验 |     newHp: number
ADD src/games/dicethrone/domain/reduceCombat.ts:20 | 注意 领域逻辑变更，需核对流程/状态/校验 | ): DiceThroneCore['players'] => {
ADD src/games/dicethrone/domain/reduceCombat.ts:21 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const target = state.players[targetId];
ADD src/games/dicethrone/domain/reduceCombat.ts:22 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!target) return state.players;
ADD src/games/dicethrone/domain/reduceCombat.ts:23 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/reduceCombat.ts:24 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!isTeamMode(state)) {
ADD src/games/dicethrone/domain/reduceCombat.ts:25 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return {
ADD src/games/dicethrone/domain/reduceCombat.ts:26 | 注意 领域逻辑变更，需核对流程/状态/校验 |             ...state.players,
ADD src/games/dicethrone/domain/reduceCombat.ts:27 | 注意 领域逻辑变更，需核对流程/状态/校验 |             [targetId]: {
ADD src/games/dicethrone/domain/reduceCombat.ts:28 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 ...target,
ADD src/games/dicethrone/domain/reduceCombat.ts:29 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 resources: { ...target.resources, [RESOURCE_IDS.HP]: newHp },
ADD src/games/dicethrone/domain/reduceCombat.ts:30 | 注意 领域逻辑变更，需核对流程/状态/校验 |             },
ADD src/games/dicethrone/domain/reduceCombat.ts:31 | 注意 领域逻辑变更，需核对流程/状态/校验 |         };
ADD src/games/dicethrone/domain/reduceCombat.ts:32 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/reduceCombat.ts:33 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/reduceCombat.ts:34 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const teamId = getTeamId(state, targetId);
ADD src/games/dicethrone/domain/reduceCombat.ts:35 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!teamId) return state.players;
ADD src/games/dicethrone/domain/reduceCombat.ts:36 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/reduceCombat.ts:37 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const nextPlayers = { ...state.players };
ADD src/games/dicethrone/domain/reduceCombat.ts:38 | 注意 领域逻辑变更，需核对流程/状态/校验 |     Object.entries(state.players).forEach(([playerId, player]) => {
ADD src/games/dicethrone/domain/reduceCombat.ts:39 | 注意 领域逻辑变更，需核对流程/状态/校验 |         if (getTeamId(state, playerId) !== teamId) return;
ADD src/games/dicethrone/domain/reduceCombat.ts:40 | 注意 领域逻辑变更，需核对流程/状态/校验 |         nextPlayers[playerId] = {
ADD src/games/dicethrone/domain/reduceCombat.ts:41 | 注意 领域逻辑变更，需核对流程/状态/校验 |             ...player,
ADD src/games/dicethrone/domain/reduceCombat.ts:42 | 注意 领域逻辑变更，需核对流程/状态/校验 |             resources: { ...player.resources, [RESOURCE_IDS.HP]: newHp },
ADD src/games/dicethrone/domain/reduceCombat.ts:43 | 注意 领域逻辑变更，需核对流程/状态/校验 |         };
ADD src/games/dicethrone/domain/reduceCombat.ts:44 | 注意 领域逻辑变更，需核对流程/状态/校验 |     });
ADD src/games/dicethrone/domain/reduceCombat.ts:45 | 注意 领域逻辑变更，需核对流程/状态/校验 |     return nextPlayers;
ADD src/games/dicethrone/domain/reduceCombat.ts:46 | 注意 领域逻辑变更，需核对流程/状态/校验 | };
ADD src/games/dicethrone/domain/reduceCombat.ts:47 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/reduceCombat.ts:48 | 注意 领域逻辑变更，需核对流程/状态/校验 | const buildNextTeamHealth = (
ADD src/games/dicethrone/domain/reduceCombat.ts:49 | 注意 领域逻辑变更，需核对流程/状态/校验 |     state: DiceThroneCore,
ADD src/games/dicethrone/domain/reduceCombat.ts:50 | 注意 领域逻辑变更，需核对流程/状态/校验 |     targetId: string,
ADD src/games/dicethrone/domain/reduceCombat.ts:51 | 注意 领域逻辑变更，需核对流程/状态/校验 |     newHp: number
ADD src/games/dicethrone/domain/reduceCombat.ts:52 | 注意 领域逻辑变更，需核对流程/状态/校验 | ): DiceThroneCore['teamHealth'] => {
ADD src/games/dicethrone/domain/reduceCombat.ts:53 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!isTeamMode(state)) return state.teamHealth;
ADD src/games/dicethrone/domain/reduceCombat.ts:54 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const teamId = getTeamId(state, targetId);
ADD src/games/dicethrone/domain/reduceCombat.ts:55 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!teamId) return state.teamHealth;
ADD src/games/dicethrone/domain/reduceCombat.ts:56 | 注意 领域逻辑变更，需核对流程/状态/校验 |     return {
ADD src/games/dicethrone/domain/reduceCombat.ts:57 | 注意 领域逻辑变更，需核对流程/状态/校验 |         A: teamId === 'A' ? newHp : (state.teamHealth?.A ?? newHp),
ADD src/games/dicethrone/domain/reduceCombat.ts:58 | 注意 领域逻辑变更，需核对流程/状态/校验 |         B: teamId === 'B' ? newHp : (state.teamHealth?.B ?? newHp),
ADD src/games/dicethrone/domain/reduceCombat.ts:59 | 注意 领域逻辑变更，需核对流程/状态/校验 |     };
ADD src/games/dicethrone/domain/reduceCombat.ts:60 | 注意 领域逻辑变更，需核对流程/状态/校验 | };
ADD src/games/dicethrone/domain/reduceCombat.ts:61 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/reduceCombat.ts:231 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const syncedPlayers = buildPlayersWithSyncedHp(state, targetId, hpAfter);
ADD src/games/dicethrone/domain/reduceCombat.ts:232 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const nextTarget = syncedPlayers[targetId];
ADD src/games/dicethrone/domain/reduceCombat.ts:233 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
DEL src/games/dicethrone/domain/reduceCombat.ts:188 | 注意 领域逻辑变更，需核对流程/状态/校验 |             ...state.players,
DEL src/games/dicethrone/domain/reduceCombat.ts:189 | 注意 领域逻辑变更，需核对流程/状态/校验 |             [targetId]: { ...target, damageShields: newDamageShields, resources: newResources },
ADD src/games/dicethrone/domain/reduceCombat.ts:237 | 注意 领域逻辑变更，需核对流程/状态/校验 |             ...syncedPlayers,
ADD src/games/dicethrone/domain/reduceCombat.ts:238 | 注意 领域逻辑变更，需核对流程/状态/校验 |             [targetId]: { ...nextTarget, damageShields: newDamageShields, resources: newResources },
ADD src/games/dicethrone/domain/reduceCombat.ts:240 | 注意 领域逻辑变更，需核对流程/状态/校验 |         teamHealth: buildNextTeamHealth(state, targetId, hpAfter),
ADD src/games/dicethrone/domain/reduceCombat.ts:276 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const syncedPlayers = buildPlayersWithSyncedHp(state, targetId, newResources[RESOURCE_IDS.HP] ?? 0);
ADD src/games/dicethrone/domain/reduceCombat.ts:277 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
DEL src/games/dicethrone/domain/reduceCombat.ts:228 | 注意 领域逻辑变更，需核对流程/状态/校验 |         players: {
DEL src/games/dicethrone/domain/reduceCombat.ts:229 | 注意 领域逻辑变更，需核对流程/状态/校验 |             ...state.players,
DEL src/games/dicethrone/domain/reduceCombat.ts:230 | 注意 领域逻辑变更，需核对流程/状态/校验 |             [targetId]: { ...target, resources: newResources },
DEL src/games/dicethrone/domain/reduceCombat.ts:231 | 注意 领域逻辑变更，需核对流程/状态/校验 |         },
ADD src/games/dicethrone/domain/reduceCombat.ts:280 | 注意 领域逻辑变更，需核对流程/状态/校验 |         players: syncedPlayers,
ADD src/games/dicethrone/domain/reduceCombat.ts:281 | 注意 领域逻辑变更，需核对流程/状态/校验 |         teamHealth: buildNextTeamHealth(state, targetId, newResources[RESOURCE_IDS.HP] ?? 0),
DEL src/games/dicethrone/domain/reduceCombat.ts:332 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const defender = state.players[defenderId];
ADD src/games/dicethrone/domain/reduceCombat.ts:382 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const defender = defenderId ? state.players[defenderId] : undefined;
DEL src/games/dicethrone/domain/reduceCombat.ts:337 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (defender?.damageShields?.length) {
ADD src/games/dicethrone/domain/reduceCombat.ts:387 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (defenderId && defender?.damageShields?.length) {
DEL src/games/dicethrone/domain/reduceCombat.ts:345 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const currentDefender = players[defenderId];
ADD src/games/dicethrone/domain/reduceCombat.ts:395 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const currentDefender = defenderId ? players[defenderId] : undefined;
ADD src/games/dicethrone/domain/reduceCombat.ts:403 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const cappedHp = result.pool[RESOURCE_IDS.HP] ?? 0;
ADD src/games/dicethrone/domain/reduceCombat.ts:404 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const syncedPlayers = buildPlayersWithSyncedHp({ ...state, players }, defenderId, cappedHp);
DEL src/games/dicethrone/domain/reduceCombat.ts:354 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 ...players,
DEL src/games/dicethrone/domain/reduceCombat.ts:355 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 [defenderId]: { ...currentDefender, resources: result.pool },
ADD src/games/dicethrone/domain/reduceCombat.ts:406 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 ...syncedPlayers,
ADD src/games/dicethrone/domain/reduceCombat.ts:407 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 [defenderId]: { ...syncedPlayers[defenderId], resources: result.pool },
ADD src/games/dicethrone/domain/reduceCombat.ts:416 | 注意 领域逻辑变更，需核对流程/状态/校验 |         teamHealth: currentDefender
ADD src/games/dicethrone/domain/reduceCombat.ts:417 | 注意 领域逻辑变更，需核对流程/状态/校验 |             ? buildNextTeamHealth(state, defenderId!, players[defenderId!]?.resources[RESOURCE_IDS.HP] ?? 0)
ADD src/games/dicethrone/domain/reduceCombat.ts:418 | 注意 领域逻辑变更，需核对流程/状态/校验 |             : state.teamHealth,
DEL src/games/dicethrone/domain/reducer.ts:13 | 注意 领域逻辑变更，需核对流程/状态/校验 | import { getDieFaceByDefinition, getTokenStackLimit, getRollerId } from './rules';
ADD src/games/dicethrone/domain/reducer.ts:13 | 注意 领域逻辑变更，需核对流程/状态/校验 | import { buildTeamIdByPlayerIdFromSeatingOrder, getDieFaceByDefinition, getTokenStackLimit, getRollerId } from './rules';
DEL src/games/dicethrone/domain/reducer.ts:18 | 注意 领域逻辑变更，需核对流程/状态/校验 | import { getChoiceEffectHandler, registerChoiceEffectHandler } from './choiceEffects';
ADD src/games/dicethrone/domain/reducer.ts:18 | 注意 领域逻辑变更，需核对流程/状态/校验 | import { registerChoiceEffectHandler, resolveChoiceEffect } from './choiceEffects';
ADD src/games/dicethrone/domain/reducer.ts:134 | 注意 领域逻辑变更，需核对流程/状态/校验 | /**
ADD src/games/dicethrone/domain/reducer.ts:135 | 注意 领域逻辑变更，需核对流程/状态/校验 |  * 处理 2v2 站位移动事件
ADD src/games/dicethrone/domain/reducer.ts:136 | 注意 领域逻辑变更，需核对流程/状态/校验 |  */
ADD src/games/dicethrone/domain/reducer.ts:137 | 注意 领域逻辑变更，需核对流程/状态/校验 | const handleSeatingMoved: EventHandler<Extract<DiceThroneEvent, { type: 'SEATING_MOVED' }>> = (
ADD src/games/dicethrone/domain/reducer.ts:138 | 注意 领域逻辑变更，需核对流程/状态/校验 |     state,
ADD src/games/dicethrone/domain/reducer.ts:139 | 注意 领域逻辑变更，需核对流程/状态/校验 |     event
ADD src/games/dicethrone/domain/reducer.ts:140 | 注意 领域逻辑变更，需核对流程/状态/校验 | ) => ({
ADD src/games/dicethrone/domain/reducer.ts:141 | 注意 领域逻辑变更，需核对流程/状态/校验 |     ...state,
ADD src/games/dicethrone/domain/reducer.ts:142 | 注意 领域逻辑变更，需核对流程/状态/校验 |     seatingOrder: event.payload.seatingOrder,
ADD src/games/dicethrone/domain/reducer.ts:143 | 注意 领域逻辑变更，需核对流程/状态/校验 |     teamIdByPlayerId: buildTeamIdByPlayerIdFromSeatingOrder(event.payload.seatingOrder),
ADD src/games/dicethrone/domain/reducer.ts:144 | 注意 领域逻辑变更，需核对流程/状态/校验 | });
ADD src/games/dicethrone/domain/reducer.ts:145 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/reducer.ts:157 | 注意 领域逻辑变更，需核对流程/状态/校验 | /**
ADD src/games/dicethrone/domain/reducer.ts:158 | 注意 领域逻辑变更，需核对流程/状态/校验 |  * 处理玩家取消准备事件
ADD src/games/dicethrone/domain/reducer.ts:159 | 注意 领域逻辑变更，需核对流程/状态/校验 |  */
ADD src/games/dicethrone/domain/reducer.ts:160 | 注意 领域逻辑变更，需核对流程/状态/校验 | const handlePlayerUnready: EventHandler<Extract<DiceThroneEvent, { type: 'PLAYER_UNREADY' }>> = (
ADD src/games/dicethrone/domain/reducer.ts:161 | 注意 领域逻辑变更，需核对流程/状态/校验 |     state,
ADD src/games/dicethrone/domain/reducer.ts:162 | 注意 领域逻辑变更，需核对流程/状态/校验 |     event
ADD src/games/dicethrone/domain/reducer.ts:163 | 注意 领域逻辑变更，需核对流程/状态/校验 | ) => ({
ADD src/games/dicethrone/domain/reducer.ts:164 | 注意 领域逻辑变更，需核对流程/状态/校验 |     ...state,
ADD src/games/dicethrone/domain/reducer.ts:165 | 注意 领域逻辑变更，需核对流程/状态/校验 |     readyPlayers: { ...state.readyPlayers, [event.payload.playerId]: false },
ADD src/games/dicethrone/domain/reducer.ts:166 | 注意 领域逻辑变更，需核对流程/状态/校验 | });
ADD src/games/dicethrone/domain/reducer.ts:167 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
DEL src/games/dicethrone/domain/reducer.ts:406 | 注意 领域逻辑变更，需核对流程/状态/校验 |     state
ADD src/games/dicethrone/domain/reducer.ts:429 | 注意 领域逻辑变更，需核对流程/状态/校验 |     state,
ADD src/games/dicethrone/domain/reducer.ts:430 | 注意 领域逻辑变更，需核对流程/状态/校验 |     event
ADD src/games/dicethrone/domain/reducer.ts:432 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const isTargetSelection = event.payload.options.some((option) => option.customId?.startsWith('select-target:'));
ADD src/games/dicethrone/domain/reducer.ts:433 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (isTargetSelection && state.pendingAttack) {
ADD src/games/dicethrone/domain/reducer.ts:434 | 注意 领域逻辑变更，需核对流程/状态/校验 |         if (state.pendingAttack.targetingSelectionResolved === true) {
ADD src/games/dicethrone/domain/reducer.ts:435 | 注意 领域逻辑变更，需核对流程/状态/校验 |             return state;
ADD src/games/dicethrone/domain/reducer.ts:436 | 注意 领域逻辑变更，需核对流程/状态/校验 |         }
ADD src/games/dicethrone/domain/reducer.ts:437 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return {
ADD src/games/dicethrone/domain/reducer.ts:438 | 注意 领域逻辑变更，需核对流程/状态/校验 |             ...state,
ADD src/games/dicethrone/domain/reducer.ts:439 | 注意 领域逻辑变更，需核对流程/状态/校验 |             pendingAttack: {
ADD src/games/dicethrone/domain/reducer.ts:440 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 ...state.pendingAttack,
ADD src/games/dicethrone/domain/reducer.ts:441 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 targetingSelectionPending: true,
ADD src/games/dicethrone/domain/reducer.ts:442 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 targetingSelectionResolved: false,
ADD src/games/dicethrone/domain/reducer.ts:443 | 注意 领域逻辑变更，需核对流程/状态/校验 |             },
ADD src/games/dicethrone/domain/reducer.ts:444 | 注意 领域逻辑变更，需核对流程/状态/校验 |         };
ADD src/games/dicethrone/domain/reducer.ts:445 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/reducer.ts:446 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
DEL src/games/dicethrone/domain/reducer.ts:450 | 注意 领域逻辑变更，需核对流程/状态/校验 |         const handler = getChoiceEffectHandler(customId);
DEL src/games/dicethrone/domain/reducer.ts:451 | 注意 领域逻辑变更，需核对流程/状态/校验 |         if (handler) {
DEL src/games/dicethrone/domain/reducer.ts:452 | 注意 领域逻辑变更，需核对流程/状态/校验 |             const result = handler({ state: resultState, playerId, customId, sourceAbilityId, value });
DEL src/games/dicethrone/domain/reducer.ts:453 | 注意 领域逻辑变更，需核对流程/状态/校验 |             if (result) {
DEL src/games/dicethrone/domain/reducer.ts:454 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 resultState = { ...resultState, ...result };
DEL src/games/dicethrone/domain/reducer.ts:455 | 注意 领域逻辑变更，需核对流程/状态/校验 |             }
ADD src/games/dicethrone/domain/reducer.ts:489 | 注意 领域逻辑变更，需核对流程/状态/校验 |         const result = resolveChoiceEffect({ state: resultState, playerId, customId, sourceAbilityId, value });
ADD src/games/dicethrone/domain/reducer.ts:490 | 注意 领域逻辑变更，需核对流程/状态/校验 |         if (result) {
ADD src/games/dicethrone/domain/reducer.ts:491 | 注意 领域逻辑变更，需核对流程/状态/校验 |             resultState = { ...resultState, ...result };
ADD src/games/dicethrone/domain/reducer.ts:895 | 注意 领域逻辑变更，需核对流程/状态/校验 |         case 'SEATING_MOVED':
ADD src/games/dicethrone/domain/reducer.ts:896 | 注意 领域逻辑变更，需核对流程/状态/校验 |             return handleSeatingMoved(state, event);
ADD src/games/dicethrone/domain/reducer.ts:899 | 注意 领域逻辑变更，需核对流程/状态/校验 |         case 'PLAYER_UNREADY':
ADD src/games/dicethrone/domain/reducer.ts:900 | 注意 领域逻辑变更，需核对流程/状态/校验 |             return handlePlayerUnready(state, event);
ADD src/games/dicethrone/domain/reducer.ts:935 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 if (to === 'targetingRoll') {
ADD src/games/dicethrone/domain/reducer.ts:936 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     const playerDice = createPlayerDice(state, activePlayerId);
ADD src/games/dicethrone/domain/reducer.ts:937 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     return {
ADD src/games/dicethrone/domain/reducer.ts:938 | 注意 领域逻辑变更，需核对流程/状态/校验 |                         ...state,
ADD src/games/dicethrone/domain/reducer.ts:939 | 注意 领域逻辑变更，需核对流程/状态/校验 |                         activePlayerId,
ADD src/games/dicethrone/domain/reducer.ts:940 | 注意 领域逻辑变更，需核对流程/状态/校验 |                         rollCount: 0,
ADD src/games/dicethrone/domain/reducer.ts:941 | 注意 领域逻辑变更，需核对流程/状态/校验 |                         rollLimit: 1,
ADD src/games/dicethrone/domain/reducer.ts:942 | 注意 领域逻辑变更，需核对流程/状态/校验 |                         rollDiceCount: 1,
ADD src/games/dicethrone/domain/reducer.ts:943 | 注意 领域逻辑变更，需核对流程/状态/校验 |                         rollConfirmed: false,
ADD src/games/dicethrone/domain/reducer.ts:944 | 注意 领域逻辑变更，需核对流程/状态/校验 |                         dice: resetDiceArray(playerDice ?? state.dice, 1),
ADD src/games/dicethrone/domain/reducer.ts:945 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     };
ADD src/games/dicethrone/domain/reducer.ts:946 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 }
ADD src/games/dicethrone/domain/reducer.ts:947 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/rules.ts:26 | 注意 领域逻辑变更，需核对流程/状态/校验 | import { playerAbilityHasDamage, playerAbilityNeedsSingleOpponentTarget } from './abilityLookup';
DEL src/games/dicethrone/domain/rules.ts:127 | 注意 领域逻辑变更，需核对流程/状态/校验 | const DEFAULT_TEAM_HEALTH_MAX = 60;
ADD src/games/dicethrone/domain/rules.ts:143 | 注意 领域逻辑变更，需核对流程/状态/校验 | export const buildTeamIdByPlayerIdFromSeatingOrder = (
ADD src/games/dicethrone/domain/rules.ts:144 | 注意 领域逻辑变更，需核对流程/状态/校验 |     seatingOrder: PlayerId[]
ADD src/games/dicethrone/domain/rules.ts:145 | 注意 领域逻辑变更，需核对流程/状态/校验 | ): Record<PlayerId, TeamId> => {
ADD src/games/dicethrone/domain/rules.ts:146 | 注意 领域逻辑变更，需核对流程/状态/校验 |     return seatingOrder.reduce((acc, pid, seatIndex) => {
ADD src/games/dicethrone/domain/rules.ts:147 | 注意 领域逻辑变更，需核对流程/状态/校验 |         acc[pid] = deriveTeamIdFromSeatIndex(seatIndex);
ADD src/games/dicethrone/domain/rules.ts:148 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return acc;
ADD src/games/dicethrone/domain/rules.ts:149 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }, {} as Record<PlayerId, TeamId>);
ADD src/games/dicethrone/domain/rules.ts:150 | 注意 领域逻辑变更，需核对流程/状态/校验 | };
ADD src/games/dicethrone/domain/rules.ts:151 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
DEL src/games/dicethrone/domain/rules.ts:151 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const derivedMap = {} as Record<PlayerId, TeamId>;
DEL src/games/dicethrone/domain/rules.ts:152 | 注意 领域逻辑变更，需核对流程/状态/校验 |     seatingOrder.forEach((pid, seatIndex) => {
DEL src/games/dicethrone/domain/rules.ts:153 | 注意 领域逻辑变更，需核对流程/状态/校验 |         derivedMap[pid] = deriveTeamIdFromSeatIndex(seatIndex);
DEL src/games/dicethrone/domain/rules.ts:154 | 注意 领域逻辑变更，需核对流程/状态/校验 |     });
ADD src/games/dicethrone/domain/rules.ts:160 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const derivedMap = buildTeamIdByPlayerIdFromSeatingOrder(seatingOrder);
DEL src/games/dicethrone/domain/rules.ts:184 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const playerIds = Object.keys(state.players) as PlayerId[];
ADD src/games/dicethrone/domain/rules.ts:190 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const playerIds = getSeatingOrder(state);
DEL src/games/dicethrone/domain/rules.ts:189 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const playerIds = Object.keys(state.players) as PlayerId[];
ADD src/games/dicethrone/domain/rules.ts:195 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const playerIds = getSeatingOrder(state);
ADD src/games/dicethrone/domain/rules.ts:217 | 注意 领域逻辑变更，需核对流程/状态/校验 | /**
ADD src/games/dicethrone/domain/rules.ts:218 | 注意 领域逻辑变更，需核对流程/状态/校验 |  * 获取当前战斗上下文里的实际对手。
ADD src/games/dicethrone/domain/rules.ts:219 | 注意 领域逻辑变更，需核对流程/状态/校验 |  * 用于 2v2 下在响应窗口/打牌阶段跟随当前 pendingAttack，而不是重新按默认对手推断。
ADD src/games/dicethrone/domain/rules.ts:220 | 注意 领域逻辑变更，需核对流程/状态/校验 |  */
ADD src/games/dicethrone/domain/rules.ts:221 | 注意 领域逻辑变更，需核对流程/状态/校验 | export const getCombatOpponentId = (
ADD src/games/dicethrone/domain/rules.ts:222 | 注意 领域逻辑变更，需核对流程/状态/校验 |     state: DiceThroneCore,
ADD src/games/dicethrone/domain/rules.ts:223 | 注意 领域逻辑变更，需核对流程/状态/校验 |     playerId: PlayerId
ADD src/games/dicethrone/domain/rules.ts:224 | 注意 领域逻辑变更，需核对流程/状态/校验 | ): PlayerId | undefined => {
ADD src/games/dicethrone/domain/rules.ts:225 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const pendingAttack = state.pendingAttack;
ADD src/games/dicethrone/domain/rules.ts:226 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!pendingAttack) return undefined;
ADD src/games/dicethrone/domain/rules.ts:227 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (pendingAttack.attackerId === playerId) {
ADD src/games/dicethrone/domain/rules.ts:228 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return pendingAttack.defenderId;
ADD src/games/dicethrone/domain/rules.ts:229 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/rules.ts:230 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (pendingAttack.defenderId === playerId) {
ADD src/games/dicethrone/domain/rules.ts:231 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return pendingAttack.attackerId;
ADD src/games/dicethrone/domain/rules.ts:232 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/rules.ts:233 | 注意 领域逻辑变更，需核对流程/状态/校验 |     return undefined;
ADD src/games/dicethrone/domain/rules.ts:234 | 注意 领域逻辑变更，需核对流程/状态/校验 | };
ADD src/games/dicethrone/domain/rules.ts:235 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/rules.ts:236 | 注意 领域逻辑变更，需核对流程/状态/校验 | /**
ADD src/games/dicethrone/domain/rules.ts:237 | 注意 领域逻辑变更，需核对流程/状态/校验 |  * 获取当前命令/效果应使用的对手。
ADD src/games/dicethrone/domain/rules.ts:238 | 注意 领域逻辑变更，需核对流程/状态/校验 |  * 优先跟随当前战斗上下文，其次才回退到默认对手。
ADD src/games/dicethrone/domain/rules.ts:239 | 注意 领域逻辑变更，需核对流程/状态/校验 |  */
ADD src/games/dicethrone/domain/rules.ts:240 | 注意 领域逻辑变更，需核对流程/状态/校验 | export const getContextualOpponentId = (
ADD src/games/dicethrone/domain/rules.ts:241 | 注意 领域逻辑变更，需核对流程/状态/校验 |     state: DiceThroneCore,
ADD src/games/dicethrone/domain/rules.ts:242 | 注意 领域逻辑变更，需核对流程/状态/校验 |     playerId: PlayerId
ADD src/games/dicethrone/domain/rules.ts:243 | 注意 领域逻辑变更，需核对流程/状态/校验 | ): PlayerId | undefined => {
ADD src/games/dicethrone/domain/rules.ts:244 | 注意 领域逻辑变更，需核对流程/状态/校验 |     return getCombatOpponentId(state, playerId) ?? getDefaultOpponentId(state, playerId);
ADD src/games/dicethrone/domain/rules.ts:245 | 注意 领域逻辑变更，需核对流程/状态/校验 | };
ADD src/games/dicethrone/domain/rules.ts:246 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/rules.ts:274 | 注意 领域逻辑变更，需核对流程/状态/校验 | export const getTargetingRollAutoDefenderId = (
ADD src/games/dicethrone/domain/rules.ts:275 | 注意 领域逻辑变更，需核对流程/状态/校验 |     state: DiceThroneCore,
ADD src/games/dicethrone/domain/rules.ts:276 | 注意 领域逻辑变更，需核对流程/状态/校验 |     attackerId: PlayerId,
ADD src/games/dicethrone/domain/rules.ts:277 | 注意 领域逻辑变更，需核对流程/状态/校验 |     rollValue: number
ADD src/games/dicethrone/domain/rules.ts:278 | 注意 领域逻辑变更，需核对流程/状态/校验 | ): PlayerId | undefined => {
ADD src/games/dicethrone/domain/rules.ts:279 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (rollValue === 1 || rollValue === 2) {
ADD src/games/dicethrone/domain/rules.ts:280 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return getLeftOpponentId(state, attackerId);
ADD src/games/dicethrone/domain/rules.ts:281 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/rules.ts:282 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (rollValue === 3 || rollValue === 4) {
ADD src/games/dicethrone/domain/rules.ts:283 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return getRightOpponentId(state, attackerId);
ADD src/games/dicethrone/domain/rules.ts:284 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/rules.ts:285 | 注意 领域逻辑变更，需核对流程/状态/校验 |     return undefined;
ADD src/games/dicethrone/domain/rules.ts:286 | 注意 领域逻辑变更，需核对流程/状态/校验 | };
ADD src/games/dicethrone/domain/rules.ts:287 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/rules.ts:288 | 注意 领域逻辑变更，需核对流程/状态/校验 | export const getTargetingRollChoiceOwnerId = (
ADD src/games/dicethrone/domain/rules.ts:289 | 注意 领域逻辑变更，需核对流程/状态/校验 |     state: DiceThroneCore,
ADD src/games/dicethrone/domain/rules.ts:290 | 注意 领域逻辑变更，需核对流程/状态/校验 |     attackerId: PlayerId,
ADD src/games/dicethrone/domain/rules.ts:291 | 注意 领域逻辑变更，需核对流程/状态/校验 |     rollValue: number
ADD src/games/dicethrone/domain/rules.ts:292 | 注意 领域逻辑变更，需核对流程/状态/校验 | ): PlayerId | undefined => {
ADD src/games/dicethrone/domain/rules.ts:293 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (rollValue === 5) {
ADD src/games/dicethrone/domain/rules.ts:294 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return getDefaultOpponentId(state, attackerId);
ADD src/games/dicethrone/domain/rules.ts:295 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/rules.ts:296 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (rollValue === 6) {
ADD src/games/dicethrone/domain/rules.ts:297 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return attackerId;
ADD src/games/dicethrone/domain/rules.ts:298 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/rules.ts:299 | 注意 领域逻辑变更，需核对流程/状态/校验 |     return undefined;
ADD src/games/dicethrone/domain/rules.ts:300 | 注意 领域逻辑变更，需核对流程/状态/校验 | };
ADD src/games/dicethrone/domain/rules.ts:301 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/rules.ts:302 | 注意 领域逻辑变更，需核对流程/状态/校验 | export const getTargetingRollChoiceOptions = (
ADD src/games/dicethrone/domain/rules.ts:303 | 注意 领域逻辑变更，需核对流程/状态/校验 |     state: DiceThroneCore,
ADD src/games/dicethrone/domain/rules.ts:304 | 注意 领域逻辑变更，需核对流程/状态/校验 |     attackerId: PlayerId
ADD src/games/dicethrone/domain/rules.ts:305 | 注意 领域逻辑变更，需核对流程/状态/校验 | ): Array<{
ADD src/games/dicethrone/domain/rules.ts:306 | 注意 领域逻辑变更，需核对流程/状态/校验 |     customId: string;
ADD src/games/dicethrone/domain/rules.ts:307 | 注意 领域逻辑变更，需核对流程/状态/校验 |     value: number;
ADD src/games/dicethrone/domain/rules.ts:308 | 注意 领域逻辑变更，需核对流程/状态/校验 |     labelKey: string;
ADD src/games/dicethrone/domain/rules.ts:309 | 注意 领域逻辑变更，需核对流程/状态/校验 |     disabled?: boolean;
ADD src/games/dicethrone/domain/rules.ts:310 | 注意 领域逻辑变更，需核对流程/状态/校验 | }> => {
ADD src/games/dicethrone/domain/rules.ts:311 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const seatingOrder = getSeatingOrder(state);
ADD src/games/dicethrone/domain/rules.ts:312 | 注意 领域逻辑变更，需核对流程/状态/校验 |     return seatingOrder
ADD src/games/dicethrone/domain/rules.ts:313 | 注意 领域逻辑变更，需核对流程/状态/校验 |         .filter((pid) => pid !== attackerId)
ADD src/games/dicethrone/domain/rules.ts:314 | 注意 领域逻辑变更，需核对流程/状态/校验 |         .map((pid) => ({
ADD src/games/dicethrone/domain/rules.ts:315 | 注意 领域逻辑变更，需核对流程/状态/校验 |             customId: `select-target:${pid}`,
ADD src/games/dicethrone/domain/rules.ts:316 | 注意 领域逻辑变更，需核对流程/状态/校验 |             value: 1,
ADD src/games/dicethrone/domain/rules.ts:317 | 注意 领域逻辑变更，需核对流程/状态/校验 |             labelKey: `玩家 ${Number(pid) + 1}`,
ADD src/games/dicethrone/domain/rules.ts:318 | 注意 领域逻辑变更，需核对流程/状态/校验 |             disabled: areTeammates(state, attackerId, pid),
ADD src/games/dicethrone/domain/rules.ts:319 | 注意 领域逻辑变更，需核对流程/状态/校验 |         }));
ADD src/games/dicethrone/domain/rules.ts:320 | 注意 领域逻辑变更，需核对流程/状态/校验 | };
ADD src/games/dicethrone/domain/rules.ts:321 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/rules.ts:326 | 注意 领域逻辑变更，需核对流程/状态/校验 | const rotateOrderToStart = (order: PlayerId[], startPlayerId: PlayerId): PlayerId[] => {
ADD src/games/dicethrone/domain/rules.ts:327 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const startIndex = order.indexOf(startPlayerId);
ADD src/games/dicethrone/domain/rules.ts:328 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (startIndex <= 0) return order;
ADD src/games/dicethrone/domain/rules.ts:329 | 注意 领域逻辑变更，需核对流程/状态/校验 |     return [...order.slice(startIndex), ...order.slice(0, startIndex)];
ADD src/games/dicethrone/domain/rules.ts:330 | 注意 领域逻辑变更，需核对流程/状态/校验 | };
ADD src/games/dicethrone/domain/rules.ts:331 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/rules.ts:332 | 注意 领域逻辑变更，需核对流程/状态/校验 | const buildTeamTurnOrder = (state: DiceThroneCore): PlayerId[] => {
ADD src/games/dicethrone/domain/rules.ts:333 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const seatingOrder = getSeatingOrder(state);
ADD src/games/dicethrone/domain/rules.ts:334 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!isTeamMode(state)) {
ADD src/games/dicethrone/domain/rules.ts:335 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return seatingOrder;
ADD src/games/dicethrone/domain/rules.ts:336 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/rules.ts:337 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/rules.ts:338 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const startingPlayerId = state.players[state.startingPlayerId]
ADD src/games/dicethrone/domain/rules.ts:339 | 注意 领域逻辑变更，需核对流程/状态/校验 |         ? state.startingPlayerId
ADD src/games/dicethrone/domain/rules.ts:340 | 注意 领域逻辑变更，需核对流程/状态/校验 |         : seatingOrder[0];
ADD src/games/dicethrone/domain/rules.ts:341 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!startingPlayerId) {
ADD src/games/dicethrone/domain/rules.ts:342 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return seatingOrder;
ADD src/games/dicethrone/domain/rules.ts:343 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/rules.ts:344 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/rules.ts:345 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const startingTeamId = getTeamId(state, startingPlayerId);
ADD src/games/dicethrone/domain/rules.ts:346 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (!startingTeamId) {
ADD src/games/dicethrone/domain/rules.ts:347 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return seatingOrder;
ADD src/games/dicethrone/domain/rules.ts:348 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/rules.ts:349 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/rules.ts:350 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const sameTeamPlayers = rotateOrderToStart(
ADD src/games/dicethrone/domain/rules.ts:351 | 注意 领域逻辑变更，需核对流程/状态/校验 |         seatingOrder.filter((pid) => getTeamId(state, pid) === startingTeamId),
ADD src/games/dicethrone/domain/rules.ts:352 | 注意 领域逻辑变更，需核对流程/状态/校验 |         startingPlayerId
ADD src/games/dicethrone/domain/rules.ts:353 | 注意 领域逻辑变更，需核对流程/状态/校验 |     );
ADD src/games/dicethrone/domain/rules.ts:354 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const opposingTeamPlayers = seatingOrder.filter((pid) => getTeamId(state, pid) !== startingTeamId);
ADD src/games/dicethrone/domain/rules.ts:355 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/rules.ts:356 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (sameTeamPlayers.length !== 2 || opposingTeamPlayers.length !== 2) {
ADD src/games/dicethrone/domain/rules.ts:357 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return seatingOrder;
ADD src/games/dicethrone/domain/rules.ts:358 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/rules.ts:359 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/rules.ts:360 | 注意 领域逻辑变更，需核对流程/状态/校验 |     return [...sameTeamPlayers, ...opposingTeamPlayers];
ADD src/games/dicethrone/domain/rules.ts:361 | 注意 领域逻辑变更，需核对流程/状态/校验 | };
ADD src/games/dicethrone/domain/rules.ts:362 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
DEL src/games/dicethrone/domain/rules.ts:246 | 注意 领域逻辑变更，需核对流程/状态/校验 |     return Object.keys(state.players);
ADD src/games/dicethrone/domain/rules.ts:367 | 注意 领域逻辑变更，需核对流程/状态/校验 |     return buildTeamTurnOrder(state);
DEL src/games/dicethrone/domain/rules.ts:266 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (phase === 'offensiveRoll') {
ADD src/games/dicethrone/domain/rules.ts:387 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (phase === 'offensiveRoll' || phase === 'targetingRoll') {
DEL src/games/dicethrone/domain/rules.ts:271 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return state.pendingAttack.defenderId;
ADD src/games/dicethrone/domain/rules.ts:392 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return state.pendingAttack.defenderId ?? state.activePlayerId;
ADD src/games/dicethrone/domain/rules.ts:446 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/rules.ts:447 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (phase === 'targetingRoll') {
ADD src/games/dicethrone/domain/rules.ts:448 | 注意 领域逻辑变更，需核对流程/状态/校验 |         return state.rollCount > 0 && state.rollConfirmed;
ADD src/games/dicethrone/domain/rules.ts:449 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/rules.ts:472 | 注意 领域逻辑变更，需核对流程/状态/校验 |         const sourceAbilityId = state.pendingAttack?.sourceAbilityId;
ADD src/games/dicethrone/domain/rules.ts:473 | 注意 领域逻辑变更，需核对流程/状态/校验 |         const needsTargetingRoll = Boolean(
ADD src/games/dicethrone/domain/rules.ts:474 | 注意 领域逻辑变更，需核对流程/状态/校验 |             isTeamMode(state)
ADD src/games/dicethrone/domain/rules.ts:475 | 注意 领域逻辑变更，需核对流程/状态/校验 |             && state.pendingAttack
ADD src/games/dicethrone/domain/rules.ts:476 | 注意 领域逻辑变更，需核对流程/状态/校验 |             && sourceAbilityId
ADD src/games/dicethrone/domain/rules.ts:477 | 注意 领域逻辑变更，需核对流程/状态/校验 |             && state.pendingAttack.defenderId === undefined
ADD src/games/dicethrone/domain/rules.ts:478 | 注意 领域逻辑变更，需核对流程/状态/校验 |             && (
ADD src/games/dicethrone/domain/rules.ts:479 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 playerAbilityHasDamage(state, state.pendingAttack.attackerId, sourceAbilityId)
ADD src/games/dicethrone/domain/rules.ts:480 | 注意 领域逻辑变更，需核对流程/状态/校验 |                 || playerAbilityNeedsSingleOpponentTarget(state, state.pendingAttack.attackerId, sourceAbilityId)
ADD src/games/dicethrone/domain/rules.ts:481 | 注意 领域逻辑变更，需核对流程/状态/校验 |             )
ADD src/games/dicethrone/domain/rules.ts:482 | 注意 领域逻辑变更，需核对流程/状态/校验 |         );
ADD src/games/dicethrone/domain/rules.ts:483 | 注意 领域逻辑变更，需核对流程/状态/校验 |         if (needsTargetingRoll) {
ADD src/games/dicethrone/domain/rules.ts:484 | 注意 领域逻辑变更，需核对流程/状态/校验 |             nextPhase = 'targetingRoll';
ADD src/games/dicethrone/domain/rules.ts:485 | 注意 领域逻辑变更，需核对流程/状态/校验 |             return nextPhase;
ADD src/games/dicethrone/domain/rules.ts:486 | 注意 领域逻辑变更，需核对流程/状态/校验 |         }
ADD src/games/dicethrone/domain/rules.ts:487 | 注意 领域逻辑变更，需核对流程/状态/校验 |         if (state.pendingAttack && state.pendingAttack.isDefendable) {
ADD src/games/dicethrone/domain/rules.ts:488 | 注意 领域逻辑变更，需核对流程/状态/校验 |             nextPhase = 'defensiveRoll';
ADD src/games/dicethrone/domain/rules.ts:489 | 注意 领域逻辑变更，需核对流程/状态/校验 |         } else {
ADD src/games/dicethrone/domain/rules.ts:490 | 注意 领域逻辑变更，需核对流程/状态/校验 |             nextPhase = 'main2';
ADD src/games/dicethrone/domain/rules.ts:491 | 注意 领域逻辑变更，需核对流程/状态/校验 |         }
ADD src/games/dicethrone/domain/rules.ts:492 | 注意 领域逻辑变更，需核对流程/状态/校验 |     }
ADD src/games/dicethrone/domain/rules.ts:493 | 注意 领域逻辑变更，需核对流程/状态/校验 | 
ADD src/games/dicethrone/domain/rules.ts:494 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (phase === 'targetingRoll') {
DEL src/games/dicethrone/domain/rules.ts:594 | 注意 领域逻辑变更，需核对流程/状态/校验 |         if (phase !== 'offensiveRoll' && phase !== 'defensiveRoll') {
ADD src/games/dicethrone/domain/rules.ts:742 | 注意 领域逻辑变更，需核对流程/状态/校验 |         if (phase !== 'offensiveRoll' && phase !== 'targetingRoll' && phase !== 'defensiveRoll') {
DEL src/games/dicethrone/domain/rules.ts:841 | 注意 领域逻辑变更，需核对流程/状态/校验 |         if (phase !== 'offensiveRoll' && phase !== 'defensiveRoll') {
ADD src/games/dicethrone/domain/rules.ts:989 | 注意 领域逻辑变更，需核对流程/状态/校验 |         if (phase !== 'offensiveRoll' && phase !== 'targetingRoll' && phase !== 'defensiveRoll') {
DEL src/games/dicethrone/domain/rules.ts:1128 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const allPlayers = Object.keys(state.players) as PlayerId[];
ADD src/games/dicethrone/domain/rules.ts:1276 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const allPlayers = getPlayerOrder(state);
ADD src/games/dicethrone/domain/rules.ts:1278 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const shouldExcludeSameTeam = isTeamMode(state);
ADD src/games/dicethrone/domain/rules.ts:1279 | 注意 领域逻辑变更，需核对流程/状态/校验 |     const isBlockedByTeamRule = (playerId: PlayerId): boolean => (
ADD src/games/dicethrone/domain/rules.ts:1280 | 注意 领域逻辑变更，需核对流程/状态/校验 |         shouldExcludeSameTeam
ADD src/games/dicethrone/domain/rules.ts:1281 | 注意 领域逻辑变更，需核对流程/状态/校验 |         && playerId !== triggerId
ADD src/games/dicethrone/domain/rules.ts:1282 | 注意 领域逻辑变更，需核对流程/状态/校验 |         && areTeammates(state, playerId, triggerId)
ADD src/games/dicethrone/domain/rules.ts:1283 | 注意 领域逻辑变更，需核对流程/状态/校验 |     );
ADD src/games/dicethrone/domain/rules.ts:1294 | 注意 领域逻辑变更，需核对流程/状态/校验 |         if (isBlockedByTeamRule(pid)) continue;
ADD src/games/dicethrone/domain/systems.ts:195 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     const isResolvedTargetingChoice = payload.sourceAbilityId === 'targeting-roll'
ADD src/games/dicethrone/domain/systems.ts:196 | 注意 领域逻辑变更，需核对流程/状态/校验 |                         && newState.core.pendingAttack?.targetingSelectionResolved === true;
ADD src/games/dicethrone/domain/systems.ts:197 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     if (isResolvedTargetingChoice) {
ADD src/games/dicethrone/domain/systems.ts:198 | 注意 领域逻辑变更，需核对流程/状态/校验 |                         continue;
ADD src/games/dicethrone/domain/systems.ts:199 | 注意 领域逻辑变更，需核对流程/状态/校验 |                     }
ADD src/games/dicethrone/domain/systems.ts:208 | 注意 领域逻辑变更，需核对流程/状态/校验 |                         disabled?: boolean;
ADD src/games/dicethrone/domain/systems.ts:218 | 注意 领域逻辑变更，需核对流程/状态/校验 |                             disabled: opt.disabled,
ADD src/games/dicethrone/domain/view.ts:8 | 注意 领域逻辑变更，需核对流程/状态/校验 | import { areTeammates } from './rules';
DEL src/games/dicethrone/domain/view.ts:32 | 注意 领域逻辑变更，需核对流程/状态/校验 |     isOwner: boolean
ADD src/games/dicethrone/domain/view.ts:33 | 注意 领域逻辑变更，需核对流程/状态/校验 |     isVisibleToViewer: boolean
DEL src/games/dicethrone/domain/view.ts:36 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (isOwner) {
DEL src/games/dicethrone/domain/view.ts:37 | 注意 领域逻辑变更，需核对流程/状态/校验 |         // 自己的状态完全可见
ADD src/games/dicethrone/domain/view.ts:37 | 注意 领域逻辑变更，需核对流程/状态/校验 |     if (isVisibleToViewer) {
ADD src/games/dicethrone/domain/view.ts:38 | 注意 领域逻辑变更，需核对流程/状态/校验 |         // 自己与队友都展示完整信息
DEL src/games/dicethrone/domain/view.ts:62 | 注意 领域逻辑变更，需核对流程/状态/校验 |         const isOwner = playerId === viewingPlayerId;
DEL src/games/dicethrone/domain/view.ts:63 | 注意 领域逻辑变更，需核对流程/状态/校验 |         filteredPlayers[playerId] = filterPlayerView(player, isOwner);
ADD src/games/dicethrone/domain/view.ts:63 | 注意 领域逻辑变更，需核对流程/状态/校验 |         const isVisibleToViewer = playerId === viewingPlayerId
ADD src/games/dicethrone/domain/view.ts:64 | 注意 领域逻辑变更，需核对流程/状态/校验 |             || areTeammates(state, playerId, viewingPlayerId);
ADD src/games/dicethrone/domain/view.ts:65 | 注意 领域逻辑变更，需核对流程/状态/校验 |         filteredPlayers[playerId] = filterPlayerView(player, isVisibleToViewer);
ADD src/games/dicethrone/game.ts:1006 | 注意 代码变更需核对 |     'MOVE_SEAT',
DEL src/games/dicethrone/game.ts:1037 | 注意 代码变更需核对 |     maxPlayers: 2,
ADD src/games/dicethrone/game.ts:1038 | 注意 代码变更需核对 |     maxPlayers: 4,
DEL src/games/dicethrone/hooks/useAnimationEffects.ts:197 | 注意 代码变更需核对 |         const targetPlayer = targetId === opponentId ? opponent : player;
ADD src/games/dicethrone/hooks/useAnimationEffects.ts:197 | 注意 代码变更需核对 |         const targetPlayer = targetId === currentPlayerId
ADD src/games/dicethrone/hooks/useAnimationEffects.ts:198 | 注意 代码变更需核对 |             ? player
ADD src/games/dicethrone/hooks/useAnimationEffects.ts:199 | 注意 代码变更需核对 |             : targetId === opponentId
ADD src/games/dicethrone/hooks/useAnimationEffects.ts:200 | 注意 代码变更需核对 |                 ? opponent
ADD src/games/dicethrone/hooks/useAnimationEffects.ts:201 | 注意 代码变更需核对 |                 : undefined;
DEL src/games/dicethrone/hooks/useAnimationEffects.ts:242 | 注意 代码变更需核对 |         const targetPlayer = targetId === opponentId ? opponent : player;
ADD src/games/dicethrone/hooks/useAnimationEffects.ts:246 | 注意 代码变更需核对 |         const targetPlayer = targetId === currentPlayerId
ADD src/games/dicethrone/hooks/useAnimationEffects.ts:247 | 注意 代码变更需核对 |             ? player
ADD src/games/dicethrone/hooks/useAnimationEffects.ts:248 | 注意 代码变更需核对 |             : targetId === opponentId
ADD src/games/dicethrone/hooks/useAnimationEffects.ts:249 | 注意 代码变更需核对 |                 ? opponent
ADD src/games/dicethrone/hooks/useAnimationEffects.ts:250 | 注意 代码变更需核对 |                 : undefined;
ADD src/games/dicethrone/hooks/useAnimationEffects.ts:282 | 注意 代码变更需核对 |         const isTrackedPlayer = playerId === currentPlayerId || playerId === opponentId;
ADD src/games/dicethrone/hooks/useAnimationEffects.ts:283 | 注意 代码变更需核对 | 
ADD src/games/dicethrone/hooks/useAnimationEffects.ts:284 | 注意 代码变更需核对 |         if (!isTrackedPlayer) {
ADD src/games/dicethrone/hooks/useAnimationEffects.ts:285 | 注意 代码变更需核对 |             return null;
ADD src/games/dicethrone/hooks/useAnimationEffects.ts:286 | 注意 代码变更需核对 |         }
DEL src/games/dicethrone/hooks/useDiceThroneState.ts:132 | 注意 代码变更需核对 |         const isRollPhase = turnPhase === 'offensiveRoll' || turnPhase === 'defensiveRoll';
ADD src/games/dicethrone/hooks/useDiceThroneState.ts:132 | 注意 代码变更需核对 |         const isAbilityRollPhase = turnPhase === 'offensiveRoll' || turnPhase === 'defensiveRoll';
DEL src/games/dicethrone/hooks/useDiceThroneState.ts:144 | 注意 代码变更需核对 |             : isRollPhase
ADD src/games/dicethrone/hooks/useDiceThroneState.ts:144 | 注意 代码变更需核对 |             : isAbilityRollPhase
DEL src/games/dicethrone/hooks/useDiceThroneState.ts:200 | 注意 代码变更需核对 |     options: Array<{ id: string; label: string; statusId?: string; tokenId?: string; customId?: string; value?: number }>;
ADD src/games/dicethrone/hooks/useDiceThroneState.ts:200 | 注意 代码变更需核对 |     options: Array<{ id: string; label: string; statusId?: string; tokenId?: string; customId?: string; value?: number; disabled?: boolean }>;
DEL src/games/dicethrone/hooks/useDiceThroneState.ts:213 | 注意 代码变更需核对 |                     const rawValue = opt.value as { statusId?: string; tokenId?: string; customId?: string; value?: number } | undefined;
ADD src/games/dicethrone/hooks/useDiceThroneState.ts:213 | 注意 代码变更需核对 |                     const rawValue = opt.value as { statusId?: string; tokenId?: string; customId?: string; value?: number; disabled?: boolean } | undefined;
ADD src/games/dicethrone/hooks/useDiceThroneState.ts:221 | 注意 代码变更需核对 |                         disabled: opt.disabled ?? rawValue?.disabled,
DEL src/games/dicethrone/manifest.ts:14 | 注意 代码变更需核对 |     playerOptions: [2],
ADD src/games/dicethrone/manifest.ts:14 | 注意 代码变更需核对 |     playerOptions: [2, 4],
DEL src/games/dicethrone/manifest.ts:16 | 注意 代码变更需核对 |     bestPlayers: [2],
ADD src/games/dicethrone/manifest.ts:16 | 注意 代码变更需核对 |     bestPlayers: [2, 4],
ADD src/games/dicethrone/ui/BoardOverlays.tsx:68 | 注意 UI/交互变更，需核对可用性与绑定 |     playerNames: Record<PlayerId, string>;
ADD src/games/dicethrone/ui/BoardOverlays.tsx:69 | 注意 UI/交互变更，需核对可用性与绑定 |     seatingOrder?: PlayerId[];
ADD src/games/dicethrone/ui/BoardOverlays.tsx:70 | 注意 UI/交互变更，需核对可用性与绑定 |     teamIdByPlayerId?: Record<PlayerId, string>;
DEL src/games/dicethrone/ui/BoardOverlays.tsx:77 | 注意 UI/交互变更，需核对可用性与绑定 |         options: Array<{ id: string; label: string; statusId?: string; tokenId?: string; customId?: string; value?: number }>;
ADD src/games/dicethrone/ui/BoardOverlays.tsx:80 | 注意 UI/交互变更，需核对可用性与绑定 |         options: Array<{ id: string; label: string; statusId?: string; tokenId?: string; customId?: string; value?: number; disabled?: boolean }>;
ADD src/games/dicethrone/ui/BoardOverlays.tsx:81 | 注意 UI/交互变更，需核对可用性与绑定 |         sourceAbilityId?: string;
DEL src/games/dicethrone/ui/BoardOverlays.tsx:143 | 注意 UI/交互变更，需核对可用性与绑定 |     playerNames: Record<PlayerId, string>;
ADD src/games/dicethrone/ui/BoardOverlays.tsx:336 | 注意 UI/交互变更，需核对可用性与绑定 |                         playerNames={props.playerNames}
ADD src/games/dicethrone/ui/BoardOverlays.tsx:337 | 注意 UI/交互变更，需核对可用性与绑定 |                         seatingOrder={props.seatingOrder}
ADD src/games/dicethrone/ui/BoardOverlays.tsx:338 | 注意 UI/交互变更，需核对可用性与绑定 |                         teamIdByPlayerId={props.teamIdByPlayerId}
DEL src/games/dicethrone/ui/BoardOverlays.tsx:346 | 注意 UI/交互变更，需核对可用性与绑定 |                         choice={props.choice.hasChoice ? { title: props.choice.title ?? '', options: props.choice.options, slider: props.choice.slider } : null}
ADD src/games/dicethrone/ui/BoardOverlays.tsx:352 | 注意 UI/交互变更，需核对可用性与绑定 |                         choice={props.choice.hasChoice
ADD src/games/dicethrone/ui/BoardOverlays.tsx:353 | 注意 UI/交互变更，需核对可用性与绑定 |                             ? {
ADD src/games/dicethrone/ui/BoardOverlays.tsx:354 | 注意 UI/交互变更，需核对可用性与绑定 |                                 title: props.choice.title ?? '',
ADD src/games/dicethrone/ui/BoardOverlays.tsx:355 | 注意 UI/交互变更，需核对可用性与绑定 |                                 options: props.choice.options,
ADD src/games/dicethrone/ui/BoardOverlays.tsx:356 | 注意 UI/交互变更，需核对可用性与绑定 |                                 slider: props.choice.slider,
ADD src/games/dicethrone/ui/BoardOverlays.tsx:357 | 注意 UI/交互变更，需核对可用性与绑定 |                                 sourceAbilityId: props.choice.sourceAbilityId,
ADD src/games/dicethrone/ui/BoardOverlays.tsx:358 | 注意 UI/交互变更，需核对可用性与绑定 |                             }
ADD src/games/dicethrone/ui/BoardOverlays.tsx:359 | 注意 UI/交互变更，需核对可用性与绑定 |                             : null}
ADD src/games/dicethrone/ui/BoardOverlays.tsx:369 | 注意 UI/交互变更，需核对可用性与绑定 |                         currentPlayerId={props.currentPlayerId}
ADD src/games/dicethrone/ui/BoardOverlays.tsx:370 | 注意 UI/交互变更，需核对可用性与绑定 |                         players={props.players}
ADD src/games/dicethrone/ui/BoardOverlays.tsx:371 | 注意 UI/交互变更，需核对可用性与绑定 |                         playerNames={props.playerNames}
ADD src/games/dicethrone/ui/BoardOverlays.tsx:372 | 注意 UI/交互变更，需核对可用性与绑定 |                         teamIdByPlayerId={props.teamIdByPlayerId}
ADD src/games/dicethrone/ui/CharacterSelectionAdapter.tsx:18 | 注意 UI/交互变更，需核对可用性与绑定 |     seatingOrder?: PlayerId[];
ADD src/games/dicethrone/ui/CharacterSelectionAdapter.tsx:21 | 注意 UI/交互变更，需核对可用性与绑定 |     onUnready: () => void;
ADD src/games/dicethrone/ui/CharacterSelectionAdapter.tsx:22 | 注意 UI/交互变更，需核对可用性与绑定 |     onMoveSeat: (playerId: PlayerId, targetSeatIndex: number) => void;
ADD src/games/dicethrone/ui/CharacterSelectionAdapter.tsx:36 | 注意 UI/交互变更，需核对可用性与绑定 |             seatingOrder={props.seatingOrder}
ADD src/games/dicethrone/ui/CharacterSelectionAdapter.tsx:39 | 注意 UI/交互变更，需核对可用性与绑定 |             onUnready={props.onUnready}
ADD src/games/dicethrone/ui/CharacterSelectionAdapter.tsx:40 | 注意 UI/交互变更，需核对可用性与绑定 |             onMoveSeat={props.onMoveSeat}
ADD src/games/dicethrone/ui/ChoiceModal.tsx:10 | 注意 UI/交互变更，需核对可用性与绑定 | import { OpponentHeader } from './OpponentHeader';
ADD src/games/dicethrone/ui/ChoiceModal.tsx:11 | 注意 UI/交互变更，需核对可用性与绑定 | import type { HeroState } from '../types';
ADD src/games/dicethrone/ui/ChoiceModal.tsx:20 | 注意 UI/交互变更，需核对可用性与绑定 |     disabled?: boolean;
ADD src/games/dicethrone/ui/ChoiceModal.tsx:36 | 注意 UI/交互变更，需核对可用性与绑定 |     sourceAbilityId?: string;
ADD src/games/dicethrone/ui/ChoiceModal.tsx:51 | 注意 UI/交互变更，需核对可用性与绑定 |     currentPlayerId,
ADD src/games/dicethrone/ui/ChoiceModal.tsx:52 | 注意 UI/交互变更，需核对可用性与绑定 |     players,
ADD src/games/dicethrone/ui/ChoiceModal.tsx:53 | 注意 UI/交互变更，需核对可用性与绑定 |     playerNames,
ADD src/games/dicethrone/ui/ChoiceModal.tsx:54 | 注意 UI/交互变更，需核对可用性与绑定 |     teamIdByPlayerId,
ADD src/games/dicethrone/ui/ChoiceModal.tsx:64 | 注意 UI/交互变更，需核对可用性与绑定 |     currentPlayerId?: string;
ADD src/games/dicethrone/ui/ChoiceModal.tsx:65 | 注意 UI/交互变更，需核对可用性与绑定 |     players?: Record<string, HeroState>;
ADD src/games/dicethrone/ui/ChoiceModal.tsx:66 | 注意 UI/交互变更，需核对可用性与绑定 |     playerNames?: Record<string, string>;
ADD src/games/dicethrone/ui/ChoiceModal.tsx:67 | 注意 UI/交互变更，需核对可用性与绑定 |     teamIdByPlayerId?: Record<string, string>;
ADD src/games/dicethrone/ui/ChoiceModal.tsx:109 | 注意 UI/交互变更，需核对可用性与绑定 |     const isTargetChoice = Boolean(
ADD src/games/dicethrone/ui/ChoiceModal.tsx:110 | 注意 UI/交互变更，需核对可用性与绑定 |         choice
ADD src/games/dicethrone/ui/ChoiceModal.tsx:111 | 注意 UI/交互变更，需核对可用性与绑定 |         && choice.sourceAbilityId === 'targeting-roll'
ADD src/games/dicethrone/ui/ChoiceModal.tsx:112 | 注意 UI/交互变更，需核对可用性与绑定 |         && currentPlayerId
ADD src/games/dicethrone/ui/ChoiceModal.tsx:113 | 注意 UI/交互变更，需核对可用性与绑定 |         && players
ADD src/games/dicethrone/ui/ChoiceModal.tsx:114 | 注意 UI/交互变更，需核对可用性与绑定 |         && choice.options.length > 0
ADD src/games/dicethrone/ui/ChoiceModal.tsx:115 | 注意 UI/交互变更，需核对可用性与绑定 |         && choice.options.every((option) => option.customId?.startsWith('select-target:'))
ADD src/games/dicethrone/ui/ChoiceModal.tsx:116 | 注意 UI/交互变更，需核对可用性与绑定 |     );
DEL src/games/dicethrone/ui/ChoiceModal.tsx:102 | 注意 UI/交互变更，需核对可用性与绑定 |             width="md"
ADD src/games/dicethrone/ui/ChoiceModal.tsx:122 | 注意 UI/交互变更，需核对可用性与绑定 |             width={isTargetChoice ? 'xl' : 'md'}
ADD src/games/dicethrone/ui/ChoiceModal.tsx:123 | 注意 UI/交互变更，需核对可用性与绑定 |             className={isTargetChoice ? 'max-w-4xl' : undefined}
ADD src/games/dicethrone/ui/ChoiceModal.tsx:172 | 注意 UI/交互变更，需核对可用性与绑定 |                 ) : isTargetChoice && choice && currentPlayerId && players ? (
ADD src/games/dicethrone/ui/ChoiceModal.tsx:173 | 注意 UI/交互变更，需核对可用性与绑定 |                     <TargetChoicePanel
ADD src/games/dicethrone/ui/ChoiceModal.tsx:174 | 注意 UI/交互变更，需核对可用性与绑定 |                         choice={choice}
ADD src/games/dicethrone/ui/ChoiceModal.tsx:175 | 注意 UI/交互变更，需核对可用性与绑定 |                         canResolve={canResolve}
ADD src/games/dicethrone/ui/ChoiceModal.tsx:176 | 注意 UI/交互变更，需核对可用性与绑定 |                         onResolve={onResolve}
ADD src/games/dicethrone/ui/ChoiceModal.tsx:177 | 注意 UI/交互变更，需核对可用性与绑定 |                         players={players}
ADD src/games/dicethrone/ui/ChoiceModal.tsx:178 | 注意 UI/交互变更，需核对可用性与绑定 |                         playerNames={playerNames}
ADD src/games/dicethrone/ui/ChoiceModal.tsx:179 | 注意 UI/交互变更，需核对可用性与绑定 |                         currentPlayerId={currentPlayerId}
ADD src/games/dicethrone/ui/ChoiceModal.tsx:180 | 注意 UI/交互变更，需核对可用性与绑定 |                         teamIdByPlayerId={teamIdByPlayerId}
ADD src/games/dicethrone/ui/ChoiceModal.tsx:181 | 注意 UI/交互变更，需核对可用性与绑定 |                         locale={locale}
ADD src/games/dicethrone/ui/ChoiceModal.tsx:182 | 注意 UI/交互变更，需核对可用性与绑定 |                     />
DEL src/games/dicethrone/ui/ChoiceModal.tsx:179 | 注意 UI/交互变更，需核对可用性与绑定 |                                             disabled={!canResolve}
ADD src/games/dicethrone/ui/ChoiceModal.tsx:211 | 注意 UI/交互变更，需核对可用性与绑定 |                                             disabled={!canResolve || option.disabled}
DEL src/games/dicethrone/ui/ChoiceModal.tsx:199 | 注意 UI/交互变更，需核对可用性与绑定 |                                             disabled={!canResolve}
ADD src/games/dicethrone/ui/ChoiceModal.tsx:231 | 注意 UI/交互变更，需核对可用性与绑定 |                                             disabled={!canResolve || option.disabled}
ADD src/games/dicethrone/ui/ChoiceModal.tsx:249 | 注意 UI/交互变更，需核对可用性与绑定 | const TargetChoicePanel = ({
ADD src/games/dicethrone/ui/ChoiceModal.tsx:250 | 注意 UI/交互变更，需核对可用性与绑定 |     choice,
ADD src/games/dicethrone/ui/ChoiceModal.tsx:251 | 注意 UI/交互变更，需核对可用性与绑定 |     canResolve,
ADD src/games/dicethrone/ui/ChoiceModal.tsx:252 | 注意 UI/交互变更，需核对可用性与绑定 |     onResolve,
ADD src/games/dicethrone/ui/ChoiceModal.tsx:253 | 注意 UI/交互变更，需核对可用性与绑定 |     players,
ADD src/games/dicethrone/ui/ChoiceModal.tsx:254 | 注意 UI/交互变更，需核对可用性与绑定 |     playerNames,
ADD src/games/dicethrone/ui/ChoiceModal.tsx:255 | 注意 UI/交互变更，需核对可用性与绑定 |     currentPlayerId,
ADD src/games/dicethrone/ui/ChoiceModal.tsx:256 | 注意 UI/交互变更，需核对可用性与绑定 |     teamIdByPlayerId,
ADD src/games/dicethrone/ui/ChoiceModal.tsx:257 | 注意 UI/交互变更，需核对可用性与绑定 |     locale,
ADD src/games/dicethrone/ui/ChoiceModal.tsx:258 | 注意 UI/交互变更，需核对可用性与绑定 | }: {
ADD src/games/dicethrone/ui/ChoiceModal.tsx:259 | 注意 UI/交互变更，需核对可用性与绑定 |     choice: ChoiceData;
ADD src/games/dicethrone/ui/ChoiceModal.tsx:260 | 注意 UI/交互变更，需核对可用性与绑定 |     canResolve: boolean;
ADD src/games/dicethrone/ui/ChoiceModal.tsx:261 | 注意 UI/交互变更，需核对可用性与绑定 |     onResolve: (optionId: string) => void;
ADD src/games/dicethrone/ui/ChoiceModal.tsx:262 | 注意 UI/交互变更，需核对可用性与绑定 |     players: Record<string, HeroState>;
ADD src/games/dicethrone/ui/ChoiceModal.tsx:263 | 注意 UI/交互变更，需核对可用性与绑定 |     playerNames?: Record<string, string>;
ADD src/games/dicethrone/ui/ChoiceModal.tsx:264 | 注意 UI/交互变更，需核对可用性与绑定 |     currentPlayerId: string;
ADD src/games/dicethrone/ui/ChoiceModal.tsx:265 | 注意 UI/交互变更，需核对可用性与绑定 |     teamIdByPlayerId?: Record<string, string>;
ADD src/games/dicethrone/ui/ChoiceModal.tsx:266 | 注意 UI/交互变更，需核对可用性与绑定 |     locale?: string;
ADD src/games/dicethrone/ui/ChoiceModal.tsx:267 | 注意 UI/交互变更，需核对可用性与绑定 | }) => {
ADD src/games/dicethrone/ui/ChoiceModal.tsx:268 | 注意 UI/交互变更，需核对可用性与绑定 |     const { t } = useTranslation('game-dicethrone');
ADD src/games/dicethrone/ui/ChoiceModal.tsx:269 | 注意 UI/交互变更，需核对可用性与绑定 |     const resolveTone = (targetPlayerId: string): 'ally' | 'enemy' => {
ADD src/games/dicethrone/ui/ChoiceModal.tsx:270 | 注意 UI/交互变更，需核对可用性与绑定 |         const currentTeamId = teamIdByPlayerId?.[currentPlayerId];
ADD src/games/dicethrone/ui/ChoiceModal.tsx:271 | 注意 UI/交互变更，需核对可用性与绑定 |         const targetTeamId = teamIdByPlayerId?.[targetPlayerId];
ADD src/games/dicethrone/ui/ChoiceModal.tsx:272 | 注意 UI/交互变更，需核对可用性与绑定 |         if (currentTeamId && targetTeamId && currentTeamId === targetTeamId) {
ADD src/games/dicethrone/ui/ChoiceModal.tsx:273 | 注意 UI/交互变更，需核对可用性与绑定 |             return 'ally';
ADD src/games/dicethrone/ui/ChoiceModal.tsx:274 | 注意 UI/交互变更，需核对可用性与绑定 |         }
ADD src/games/dicethrone/ui/ChoiceModal.tsx:275 | 注意 UI/交互变更，需核对可用性与绑定 |         return 'enemy';
ADD src/games/dicethrone/ui/ChoiceModal.tsx:276 | 注意 UI/交互变更，需核对可用性与绑定 |     };
ADD src/games/dicethrone/ui/ChoiceModal.tsx:277 | 注意 UI/交互变更，需核对可用性与绑定 | 
ADD src/games/dicethrone/ui/ChoiceModal.tsx:278 | 注意 UI/交互变更，需核对可用性与绑定 |     return (
ADD src/games/dicethrone/ui/ChoiceModal.tsx:279 | 注意 UI/交互变更，需核对可用性与绑定 |         <div className="w-full max-w-[42rem] flex flex-col gap-3" data-testid="dt-target-choice-panel">
ADD src/games/dicethrone/ui/ChoiceModal.tsx:280 | 注意 UI/交互变更，需核对可用性与绑定 |             {choice.options.map((option) => {
ADD src/games/dicethrone/ui/ChoiceModal.tsx:281 | 注意 UI/交互变更，需核对可用性与绑定 |                 const targetPlayerId = option.customId?.slice('select-target:'.length);
ADD src/games/dicethrone/ui/ChoiceModal.tsx:282 | 注意 UI/交互变更，需核对可用性与绑定 |                 if (!targetPlayerId) return null;
ADD src/games/dicethrone/ui/ChoiceModal.tsx:283 | 注意 UI/交互变更，需核对可用性与绑定 | 
ADD src/games/dicethrone/ui/ChoiceModal.tsx:284 | 注意 UI/交互变更，需核对可用性与绑定 |                 const targetPlayer = players[targetPlayerId];
ADD src/games/dicethrone/ui/ChoiceModal.tsx:285 | 注意 UI/交互变更，需核对可用性与绑定 |                 if (!targetPlayer) return null;
ADD src/games/dicethrone/ui/ChoiceModal.tsx:286 | 注意 UI/交互变更，需核对可用性与绑定 | 
ADD src/games/dicethrone/ui/ChoiceModal.tsx:287 | 注意 UI/交互变更，需核对可用性与绑定 |                 return (
ADD src/games/dicethrone/ui/ChoiceModal.tsx:288 | 注意 UI/交互变更，需核对可用性与绑定 |                     <div key={option.id} className="relative w-full">
ADD src/games/dicethrone/ui/ChoiceModal.tsx:289 | 注意 UI/交互变更，需核对可用性与绑定 |                         <OpponentHeader
ADD src/games/dicethrone/ui/ChoiceModal.tsx:290 | 注意 UI/交互变更，需核对可用性与绑定 |                             opponent={targetPlayer}
ADD src/games/dicethrone/ui/ChoiceModal.tsx:291 | 注意 UI/交互变更，需核对可用性与绑定 |                             playerId={targetPlayerId}
ADD src/games/dicethrone/ui/ChoiceModal.tsx:292 | 注意 UI/交互变更，需核对可用性与绑定 |                             opponentName={playerNames?.[targetPlayerId] ?? `P${Number(targetPlayerId) + 1}`}
ADD src/games/dicethrone/ui/ChoiceModal.tsx:293 | 注意 UI/交互变更，需核对可用性与绑定 |                             viewMode="opponent"
ADD src/games/dicethrone/ui/ChoiceModal.tsx:294 | 注意 UI/交互变更，需核对可用性与绑定 |                             isOpponentShaking={false}
ADD src/games/dicethrone/ui/ChoiceModal.tsx:295 | 注意 UI/交互变更，需核对可用性与绑定 |                             shouldAutoObserve={false}
ADD src/games/dicethrone/ui/ChoiceModal.tsx:296 | 注意 UI/交互变更，需核对可用性与绑定 |                             onToggleView={() => {
ADD src/games/dicethrone/ui/ChoiceModal.tsx:297 | 注意 UI/交互变更，需核对可用性与绑定 |                                 if (!canResolve || option.disabled) return;
ADD src/games/dicethrone/ui/ChoiceModal.tsx:298 | 注意 UI/交互变更，需核对可用性与绑定 |                                 onResolve(option.id);
ADD src/games/dicethrone/ui/ChoiceModal.tsx:299 | 注意 UI/交互变更，需核对可用性与绑定 |                             }}
ADD src/games/dicethrone/ui/ChoiceModal.tsx:300 | 注意 UI/交互变更，需核对可用性与绑定 |                             tone={resolveTone(targetPlayerId)}
ADD src/games/dicethrone/ui/ChoiceModal.tsx:301 | 注意 UI/交互变更，需核对可用性与绑定 |                             selected={!option.disabled}
ADD src/games/dicethrone/ui/ChoiceModal.tsx:302 | 注意 UI/交互变更，需核对可用性与绑定 |                             observed={false}
ADD src/games/dicethrone/ui/ChoiceModal.tsx:303 | 注意 UI/交互变更，需核对可用性与绑定 |                             compact={false}
ADD src/games/dicethrone/ui/ChoiceModal.tsx:304 | 注意 UI/交互变更，需核对可用性与绑定 |                             locale={locale}
ADD src/games/dicethrone/ui/ChoiceModal.tsx:305 | 注意 UI/交互变更，需核对可用性与绑定 |                             containerClassName="w-full pointer-events-auto"
ADD src/games/dicethrone/ui/ChoiceModal.tsx:306 | 注意 UI/交互变更，需核对可用性与绑定 |                             disabled={option.disabled}
ADD src/games/dicethrone/ui/ChoiceModal.tsx:307 | 注意 UI/交互变更，需核对可用性与绑定 |                             testId={`dt-target-option-${targetPlayerId}`}
ADD src/games/dicethrone/ui/ChoiceModal.tsx:308 | 注意 UI/交互变更，需核对可用性与绑定 |                         />
ADD src/games/dicethrone/ui/ChoiceModal.tsx:309 | 注意 UI/交互变更，需核对可用性与绑定 |                         {option.disabled && (
ADD src/games/dicethrone/ui/ChoiceModal.tsx:310 | 注意 UI/交互变更，需核对可用性与绑定 |                             <div className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-black/55 px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-slate-300">
ADD src/games/dicethrone/ui/ChoiceModal.tsx:311 | 注意 UI/交互变更，需核对可用性与绑定 |                                 {t('selection.targetOptionDisabled')}
ADD src/games/dicethrone/ui/ChoiceModal.tsx:312 | 注意 UI/交互变更，需核对可用性与绑定 |                             </div>
ADD src/games/dicethrone/ui/ChoiceModal.tsx:313 | 注意 UI/交互变更，需核对可用性与绑定 |                         )}
ADD src/games/dicethrone/ui/ChoiceModal.tsx:314 | 注意 UI/交互变更，需核对可用性与绑定 |                     </div>
ADD src/games/dicethrone/ui/ChoiceModal.tsx:315 | 注意 UI/交互变更，需核对可用性与绑定 |                 );
ADD src/games/dicethrone/ui/ChoiceModal.tsx:316 | 注意 UI/交互变更，需核对可用性与绑定 |             })}
ADD src/games/dicethrone/ui/ChoiceModal.tsx:317 | 注意 UI/交互变更，需核对可用性与绑定 |         </div>
ADD src/games/dicethrone/ui/ChoiceModal.tsx:318 | 注意 UI/交互变更，需核对可用性与绑定 |     );
ADD src/games/dicethrone/ui/ChoiceModal.tsx:319 | 注意 UI/交互变更，需核对可用性与绑定 | };
ADD src/games/dicethrone/ui/ChoiceModal.tsx:320 | 注意 UI/交互变更，需核对可用性与绑定 | 
DEL src/games/dicethrone/ui/ChoiceModal.tsx:397 | 注意 UI/交互变更，需核对可用性与绑定 | };
ADD src/games/dicethrone/ui/ChoiceModal.tsx:501 | 注意 UI/交互变更，需核对可用性与绑定 | };
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:26 | 注意 UI/交互变更，需核对可用性与绑定 |     seatingOrder?: PlayerId[];
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:30 | 注意 UI/交互变更，需核对可用性与绑定 |     onMoveSeat: (playerId: PlayerId, targetSeatIndex: number) => void;
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:58 | 注意 UI/交互变更，需核对可用性与绑定 |     seatingOrder,
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:62 | 注意 UI/交互变更，需核对可用性与绑定 |     onMoveSeat,
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:69 | 注意 UI/交互变更，需核对可用性与绑定 |     const isFourPlayerMode = playerIds.length === 4;
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:93 | 注意 UI/交互变更，需核对可用性与绑定 |     const [pendingSeatPlayerId, setPendingSeatPlayerId] = useState<PlayerId | null>(null);
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:94 | 注意 UI/交互变更，需核对可用性与绑定 |     const [seatFeedbackKey, setSeatFeedbackKey] = useState<string | null>(null);
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:95 | 注意 UI/交互变更，需核对可用性与绑定 | 
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:96 | 注意 UI/交互变更，需核对可用性与绑定 |     const effectiveSeatingOrder = useMemo(() => {
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:97 | 注意 UI/交互变更，需核对可用性与绑定 |         const orderedPlayers = seatingOrder?.filter((pid) => playerIds.includes(pid)) ?? [];
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:98 | 注意 UI/交互变更，需核对可用性与绑定 |         return orderedPlayers.length === playerIds.length ? orderedPlayers : playerIds;
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:99 | 注意 UI/交互变更，需核对可用性与绑定 |     }, [seatingOrder, playerIds]);
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:100 | 注意 UI/交互变更，需核对可用性与绑定 |     const selectedSeatIndex = pendingSeatPlayerId
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:101 | 注意 UI/交互变更，需核对可用性与绑定 |         ? effectiveSeatingOrder.indexOf(pendingSeatPlayerId)
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:102 | 注意 UI/交互变更，需核对可用性与绑定 |         : -1;
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:103 | 注意 UI/交互变更，需核对可用性与绑定 |     const teamAPlayers = effectiveSeatingOrder.filter((_, index) => index % 2 === 0);
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:104 | 注意 UI/交互变更，需核对可用性与绑定 |     const teamBPlayers = effectiveSeatingOrder.filter((_, index) => index % 2 === 1);
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:105 | 注意 UI/交互变更，需核对可用性与绑定 |     const remainingSeatPlayers = pendingSeatPlayerId
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:106 | 注意 UI/交互变更，需核对可用性与绑定 |         ? effectiveSeatingOrder.filter((pid) => pid !== pendingSeatPlayerId)
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:107 | 注意 UI/交互变更，需核对可用性与绑定 |         : effectiveSeatingOrder;
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:108 | 注意 UI/交互变更，需核对可用性与绑定 |     const seatTargetIndexes = pendingSeatPlayerId
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:109 | 注意 UI/交互变更，需核对可用性与绑定 |         ? Array.from({ length: remainingSeatPlayers.length + 1 }, (_, index) => index)
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:110 | 注意 UI/交互变更，需核对可用性与绑定 |         : [];
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:111 | 注意 UI/交互变更，需核对可用性与绑定 | 
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:112 | 注意 UI/交互变更，需核对可用性与绑定 |     const getPlayerLabel = (pid: string) => PLAYER_LABELS[pid] ?? `P${Number(pid) + 1}`;
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:113 | 注意 UI/交互变更，需核对可用性与绑定 | 
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:114 | 注意 UI/交互变更，需核对可用性与绑定 |     React.useEffect(() => {
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:115 | 注意 UI/交互变更，需核对可用性与绑定 |         if (pendingSeatPlayerId && !effectiveSeatingOrder.includes(pendingSeatPlayerId)) {
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:116 | 注意 UI/交互变更，需核对可用性与绑定 |             setPendingSeatPlayerId(null);
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:117 | 注意 UI/交互变更，需核对可用性与绑定 |             setSeatFeedbackKey(null);
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:118 | 注意 UI/交互变更，需核对可用性与绑定 |         }
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:119 | 注意 UI/交互变更，需核对可用性与绑定 |     }, [pendingSeatPlayerId, effectiveSeatingOrder]);
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:141 | 注意 UI/交互变更，需核对可用性与绑定 |     const handleSeatPlayerClick = (pid: PlayerId) => {
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:142 | 注意 UI/交互变更，需核对可用性与绑定 |         if (!isHost) {
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:143 | 注意 UI/交互变更，需核对可用性与绑定 |             setSeatFeedbackKey('selection.seating.readOnly');
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:144 | 注意 UI/交互变更，需核对可用性与绑定 |             return;
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:145 | 注意 UI/交互变更，需核对可用性与绑定 |         }
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:146 | 注意 UI/交互变更，需核对可用性与绑定 |         if (!isFourPlayerMode) {
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:147 | 注意 UI/交互变更，需核对可用性与绑定 |             return;
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:148 | 注意 UI/交互变更，需核对可用性与绑定 |         }
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:149 | 注意 UI/交互变更，需核对可用性与绑定 |         if (pendingSeatPlayerId && pendingSeatPlayerId !== pid) {
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:150 | 注意 UI/交互变更，需核对可用性与绑定 |             setSeatFeedbackKey('selection.seating.occupied');
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:151 | 注意 UI/交互变更，需核对可用性与绑定 |             return;
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:152 | 注意 UI/交互变更，需核对可用性与绑定 |         }
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:153 | 注意 UI/交互变更，需核对可用性与绑定 | 
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:154 | 注意 UI/交互变更，需核对可用性与绑定 |         setSeatFeedbackKey(null);
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:155 | 注意 UI/交互变更，需核对可用性与绑定 |         setPendingSeatPlayerId((current) => (current === pid ? null : pid));
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:156 | 注意 UI/交互变更，需核对可用性与绑定 |     };
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:157 | 注意 UI/交互变更，需核对可用性与绑定 | 
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:158 | 注意 UI/交互变更，需核对可用性与绑定 |     const handleSeatTargetClick = (targetSeatIndex: number) => {
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:159 | 注意 UI/交互变更，需核对可用性与绑定 |         if (!pendingSeatPlayerId) {
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:160 | 注意 UI/交互变更，需核对可用性与绑定 |             return;
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:161 | 注意 UI/交互变更，需核对可用性与绑定 |         }
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:162 | 注意 UI/交互变更，需核对可用性与绑定 |         setSeatFeedbackKey(null);
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:163 | 注意 UI/交互变更，需核对可用性与绑定 |         onMoveSeat(pendingSeatPlayerId, targetSeatIndex);
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:164 | 注意 UI/交互变更，需核对可用性与绑定 |         setPendingSeatPlayerId(null);
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:165 | 注意 UI/交互变更，需核对可用性与绑定 |     };
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:166 | 注意 UI/交互变更，需核对可用性与绑定 | 
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:167 | 注意 UI/交互变更，需核对可用性与绑定 |     const seatHintText = (() => {
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:168 | 注意 UI/交互变更，需核对可用性与绑定 |         if (!isFourPlayerMode) {
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:169 | 注意 UI/交互变更，需核对可用性与绑定 |             return null;
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:170 | 注意 UI/交互变更，需核对可用性与绑定 |         }
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:171 | 注意 UI/交互变更，需核对可用性与绑定 |         if (seatFeedbackKey) {
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:172 | 注意 UI/交互变更，需核对可用性与绑定 |             return t(seatFeedbackKey);
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:173 | 注意 UI/交互变更，需核对可用性与绑定 |         }
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:174 | 注意 UI/交互变更，需核对可用性与绑定 |         if (!isHost) {
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:175 | 注意 UI/交互变更，需核对可用性与绑定 |             return t('selection.seating.readOnly');
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:176 | 注意 UI/交互变更，需核对可用性与绑定 |         }
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:177 | 注意 UI/交互变更，需核对可用性与绑定 |         if (pendingSeatPlayerId) {
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:178 | 注意 UI/交互变更，需核对可用性与绑定 |             return t('selection.seating.moveHint', {
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:179 | 注意 UI/交互变更，需核对可用性与绑定 |                 player: getPlayerLabel(pendingSeatPlayerId),
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:180 | 注意 UI/交互变更，需核对可用性与绑定 |             });
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:181 | 注意 UI/交互变更，需核对可用性与绑定 |         }
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:182 | 注意 UI/交互变更，需核对可用性与绑定 |         return t('selection.seating.hostTip');
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:183 | 注意 UI/交互变更，需核对可用性与绑定 |     })();
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:184 | 注意 UI/交互变更，需核对可用性与绑定 | 
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:185 | 注意 UI/交互变更，需核对可用性与绑定 |     const renderSeatPlayerCard = (pid: PlayerId, seatIndex: number, compact = false) => {
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:186 | 注意 UI/交互变更，需核对可用性与绑定 |         const isSelected = pendingSeatPlayerId === pid;
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:187 | 注意 UI/交互变更，需核对可用性与绑定 |         const colors = PLAYER_COLORS[pid] || PLAYER_COLORS['0'];
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:188 | 注意 UI/交互变更，需核对可用性与绑定 |         const hasSelected = selectedCharacters[pid] && selectedCharacters[pid] !== 'unselected';
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:189 | 注意 UI/交互变更，需核对可用性与绑定 | 
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:190 | 注意 UI/交互变更，需核对可用性与绑定 |         return (
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:191 | 注意 UI/交互变更，需核对可用性与绑定 |             <button
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:192 | 注意 UI/交互变更，需核对可用性与绑定 |                 key={`seat-player-${pid}-${seatIndex}`}
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:193 | 注意 UI/交互变更，需核对可用性与绑定 |                 type="button"
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:194 | 注意 UI/交互变更，需核对可用性与绑定 |                 onClick={() => handleSeatPlayerClick(pid)}
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:195 | 注意 UI/交互变更，需核对可用性与绑定 |                 className={clsx(
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:196 | 注意 UI/交互变更，需核对可用性与绑定 |                     'rounded-[0.8vw] border text-left transition-all',
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:197 | 注意 UI/交互变更，需核对可用性与绑定 |                     compact
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:198 | 注意 UI/交互变更，需核对可用性与绑定 |                         ? 'min-w-[4.8vw] px-[0.55vw] py-[0.45vw]'
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:199 | 注意 UI/交互变更，需核对可用性与绑定 |                         : 'min-w-[8.4vw] px-[0.8vw] py-[0.65vw]',
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:200 | 注意 UI/交互变更，需核对可用性与绑定 |                     isSelected
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:201 | 注意 UI/交互变更，需核对可用性与绑定 |                         ? 'border-amber-400 bg-amber-500/12 shadow-[0_0_1vw_rgba(245,158,11,0.3)]'
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:202 | 注意 UI/交互变更，需核对可用性与绑定 |                         : 'border-white/12 bg-black/25 hover:border-white/28 hover:bg-white/8',
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:203 | 注意 UI/交互变更，需核对可用性与绑定 |                     !isHost && 'cursor-default hover:border-white/12 hover:bg-black/25'
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:204 | 注意 UI/交互变更，需核对可用性与绑定 |                 )}
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:205 | 注意 UI/交互变更，需核对可用性与绑定 |             >
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:206 | 注意 UI/交互变更，需核对可用性与绑定 |                 <div className="flex items-center gap-[0.5vw]">
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:207 | 注意 UI/交互变更，需核对可用性与绑定 |                     <div
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:208 | 注意 UI/交互变更，需核对可用性与绑定 |                         className={clsx(
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:209 | 注意 UI/交互变更，需核对可用性与绑定 |                             'rounded-full flex items-center justify-center font-black',
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:210 | 注意 UI/交互变更，需核对可用性与绑定 |                             compact ? 'h-[1.2vw] w-[1.2vw] text-[0.5vw]' : 'h-[1.5vw] w-[1.5vw] text-[0.62vw]'
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:211 | 注意 UI/交互变更，需核对可用性与绑定 |                         )}
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:212 | 注意 UI/交互变更，需核对可用性与绑定 |                         style={{
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:213 | 注意 UI/交互变更，需核对可用性与绑定 |                             backgroundColor: colors.bg,
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:214 | 注意 UI/交互变更，需核对可用性与绑定 |                             color: colors.text,
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:215 | 注意 UI/交互变更，需核对可用性与绑定 |                             boxShadow: `0 0 12px ${colors.glow}`,
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:216 | 注意 UI/交互变更，需核对可用性与绑定 |                         }}
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:217 | 注意 UI/交互变更，需核对可用性与绑定 |                     >
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:218 | 注意 UI/交互变更，需核对可用性与绑定 |                         {getPlayerLabel(pid)}
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:219 | 注意 UI/交互变更，需核对可用性与绑定 |                     </div>
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:220 | 注意 UI/交互变更，需核对可用性与绑定 |                     <div className="min-w-0">
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:221 | 注意 UI/交互变更，需核对可用性与绑定 |                         <div className={clsx('font-black text-white/90', compact ? 'text-[0.46vw]' : 'text-[0.56vw]')}>
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:222 | 注意 UI/交互变更，需核对可用性与绑定 |                             {t('selection.seating.seatNumber', { seat: seatIndex + 1 })}
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:223 | 注意 UI/交互变更，需核对可用性与绑定 |                         </div>
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:224 | 注意 UI/交互变更，需核对可用性与绑定 |                         <div className={clsx('truncate', compact ? 'text-[0.42vw] text-white/55' : 'text-[0.52vw] text-white/60')}>
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:225 | 注意 UI/交互变更，需核对可用性与绑定 |                             {playerNames[pid]}
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:226 | 注意 UI/交互变更，需核对可用性与绑定 |                         </div>
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:227 | 注意 UI/交互变更，需核对可用性与绑定 |                     </div>
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:228 | 注意 UI/交互变更，需核对可用性与绑定 |                 </div>
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:229 | 注意 UI/交互变更，需核对可用性与绑定 |                 <div className={clsx(
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:230 | 注意 UI/交互变更，需核对可用性与绑定 |                     'mt-[0.35vw] truncate font-bold',
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:231 | 注意 UI/交互变更，需核对可用性与绑定 |                     compact ? 'text-[0.42vw]' : 'text-[0.5vw]',
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:232 | 注意 UI/交互变更，需核对可用性与绑定 |                     hasSelected ? 'text-amber-300' : 'text-white/35'
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:233 | 注意 UI/交互变更，需核对可用性与绑定 |                 )}>
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:234 | 注意 UI/交互变更，需核对可用性与绑定 |                     {hasSelected ? t(`characters.${selectedCharacters[pid]}`) : t('selection.notSelected')}
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:235 | 注意 UI/交互变更，需核对可用性与绑定 |                 </div>
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:236 | 注意 UI/交互变更，需核对可用性与绑定 |             </button>
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:237 | 注意 UI/交互变更，需核对可用性与绑定 |         );
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:238 | 注意 UI/交互变更，需核对可用性与绑定 |     };
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:239 | 注意 UI/交互变更，需核对可用性与绑定 | 
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:240 | 注意 UI/交互变更，需核对可用性与绑定 |     const renderSeatTargetCard = (targetSeatIndex: number) => {
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:241 | 注意 UI/交互变更，需核对可用性与绑定 |         const isCurrentSlot = targetSeatIndex === selectedSeatIndex;
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:242 | 注意 UI/交互变更，需核对可用性与绑定 |         return (
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:243 | 注意 UI/交互变更，需核对可用性与绑定 |             <button
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:244 | 注意 UI/交互变更，需核对可用性与绑定 |                 key={`seat-target-${targetSeatIndex}`}
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:245 | 注意 UI/交互变更，需核对可用性与绑定 |                 type="button"
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:246 | 注意 UI/交互变更，需核对可用性与绑定 |                 disabled={isCurrentSlot}
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:247 | 注意 UI/交互变更，需核对可用性与绑定 |                 onClick={() => handleSeatTargetClick(targetSeatIndex)}
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:248 | 注意 UI/交互变更，需核对可用性与绑定 |                 className={clsx(
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:249 | 注意 UI/交互变更，需核对可用性与绑定 |                     'min-w-[3.8vw] rounded-[0.75vw] border border-dashed px-[0.55vw] py-[0.45vw] text-center transition-all',
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:250 | 注意 UI/交互变更，需核对可用性与绑定 |                     isCurrentSlot
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:251 | 注意 UI/交互变更，需核对可用性与绑定 |                         ? 'border-white/10 bg-white/5 text-white/30 cursor-not-allowed'
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:252 | 注意 UI/交互变更，需核对可用性与绑定 |                         : 'border-emerald-400/45 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/16 hover:border-emerald-300'
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:253 | 注意 UI/交互变更，需核对可用性与绑定 |                 )}
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:254 | 注意 UI/交互变更，需核对可用性与绑定 |             >
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:255 | 注意 UI/交互变更，需核对可用性与绑定 |                 <div className="text-[0.42vw] font-black uppercase tracking-[0.18em]">
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:256 | 注意 UI/交互变更，需核对可用性与绑定 |                     {t('selection.seating.emptySlot')}
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:257 | 注意 UI/交互变更，需核对可用性与绑定 |                 </div>
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:258 | 注意 UI/交互变更，需核对可用性与绑定 |                 <div className="mt-[0.16vw] text-[0.48vw] font-semibold">
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:259 | 注意 UI/交互变更，需核对可用性与绑定 |                     {isCurrentSlot
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:260 | 注意 UI/交互变更，需核对可用性与绑定 |                         ? t('selection.seating.currentSlot')
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:261 | 注意 UI/交互变更，需核对可用性与绑定 |                         : t('selection.seating.seatNumber', { seat: targetSeatIndex + 1 })}
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:262 | 注意 UI/交互变更，需核对可用性与绑定 |                 </div>
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:263 | 注意 UI/交互变更，需核对可用性与绑定 |             </button>
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:264 | 注意 UI/交互变更，需核对可用性与绑定 |         );
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:265 | 注意 UI/交互变更，需核对可用性与绑定 |     };
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:266 | 注意 UI/交互变更，需核对可用性与绑定 | 
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:409 | 注意 UI/交互变更，需核对可用性与绑定 |                 {isFourPlayerMode && (
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:410 | 注意 UI/交互变更，需核对可用性与绑定 |                     <div className="absolute right-[2vw] bottom-[9vw] w-[22vw] rounded-[1vw] border border-white/12 bg-black/45 p-[0.95vw] backdrop-blur-xl shadow-[0_1.2vw_3vw_rgba(0,0,0,0.35)]">
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:411 | 注意 UI/交互变更，需核对可用性与绑定 |                         <div className="flex items-start justify-between gap-[0.8vw]">
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:412 | 注意 UI/交互变更，需核对可用性与绑定 |                             <div>
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:413 | 注意 UI/交互变更，需核对可用性与绑定 |                                 <div className="text-[0.72vw] font-black uppercase tracking-[0.18em] text-white/88">
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:414 | 注意 UI/交互变更，需核对可用性与绑定 |                                     {t('selection.seating.title')}
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:415 | 注意 UI/交互变更，需核对可用性与绑定 |                                 </div>
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:416 | 注意 UI/交互变更，需核对可用性与绑定 |                                 <div className="mt-[0.2vw] text-[0.5vw] leading-relaxed text-white/56">
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:417 | 注意 UI/交互变更，需核对可用性与绑定 |                                     {seatHintText}
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:418 | 注意 UI/交互变更，需核对可用性与绑定 |                                 </div>
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:419 | 注意 UI/交互变更，需核对可用性与绑定 |                             </div>
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:420 | 注意 UI/交互变更，需核对可用性与绑定 |                             {pendingSeatPlayerId && (
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:421 | 注意 UI/交互变更，需核对可用性与绑定 |                                 <button
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:422 | 注意 UI/交互变更，需核对可用性与绑定 |                                     type="button"
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:423 | 注意 UI/交互变更，需核对可用性与绑定 |                                     onClick={() => {
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:424 | 注意 UI/交互变更，需核对可用性与绑定 |                                         setPendingSeatPlayerId(null);
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:425 | 注意 UI/交互变更，需核对可用性与绑定 |                                         setSeatFeedbackKey(null);
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:426 | 注意 UI/交互变更，需核对可用性与绑定 |                                     }}
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:427 | 注意 UI/交互变更，需核对可用性与绑定 |                                     className="rounded-full border border-white/15 px-[0.65vw] py-[0.25vw] text-[0.48vw] font-semibold text-white/68 transition hover:border-white/30 hover:text-white"
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:428 | 注意 UI/交互变更，需核对可用性与绑定 |                                 >
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:429 | 注意 UI/交互变更，需核对可用性与绑定 |                                     {t('selection.seating.cancel')}
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:430 | 注意 UI/交互变更，需核对可用性与绑定 |                                 </button>
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:431 | 注意 UI/交互变更，需核对可用性与绑定 |                             )}
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:432 | 注意 UI/交互变更，需核对可用性与绑定 |                         </div>
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:433 | 注意 UI/交互变更，需核对可用性与绑定 | 
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:434 | 注意 UI/交互变更，需核对可用性与绑定 |                         {!pendingSeatPlayerId && (
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:435 | 注意 UI/交互变更，需核对可用性与绑定 |                             <div className="mt-[0.85vw] flex flex-wrap gap-[0.45vw]">
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:436 | 注意 UI/交互变更，需核对可用性与绑定 |                                 {effectiveSeatingOrder.map((pid, seatIndex) => renderSeatPlayerCard(pid, seatIndex))}
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:437 | 注意 UI/交互变更，需核对可用性与绑定 |                             </div>
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:438 | 注意 UI/交互变更，需核对可用性与绑定 |                         )}
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:439 | 注意 UI/交互变更，需核对可用性与绑定 | 
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:440 | 注意 UI/交互变更，需核对可用性与绑定 |                         {pendingSeatPlayerId && (
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:441 | 注意 UI/交互变更，需核对可用性与绑定 |                             <div className="mt-[0.85vw] flex flex-wrap items-center gap-[0.38vw]">
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:442 | 注意 UI/交互变更，需核对可用性与绑定 |                                 {seatTargetIndexes.map((targetSeatIndex, index) => (
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:443 | 注意 UI/交互变更，需核对可用性与绑定 |                                     <React.Fragment key={`seat-editor-${targetSeatIndex}`}>
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:444 | 注意 UI/交互变更，需核对可用性与绑定 |                                         {renderSeatTargetCard(targetSeatIndex)}
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:445 | 注意 UI/交互变更，需核对可用性与绑定 |                                         {remainingSeatPlayers[index] && renderSeatPlayerCard(remainingSeatPlayers[index], index, true)}
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:446 | 注意 UI/交互变更，需核对可用性与绑定 |                                     </React.Fragment>
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:447 | 注意 UI/交互变更，需核对可用性与绑定 |                                 ))}
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:448 | 注意 UI/交互变更，需核对可用性与绑定 |                             </div>
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:449 | 注意 UI/交互变更，需核对可用性与绑定 |                         )}
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:450 | 注意 UI/交互变更，需核对可用性与绑定 | 
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:451 | 注意 UI/交互变更，需核对可用性与绑定 |                         <div className="mt-[0.8vw] grid grid-cols-2 gap-[0.45vw] text-[0.48vw] text-white/72">
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:452 | 注意 UI/交互变更，需核对可用性与绑定 |                             <div className="rounded-[0.8vw] border border-sky-400/22 bg-sky-500/10 px-[0.7vw] py-[0.55vw]">
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:453 | 注意 UI/交互变更，需核对可用性与绑定 |                                 <div className="font-black uppercase tracking-[0.16em] text-sky-200/90">
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:454 | 注意 UI/交互变更，需核对可用性与绑定 |                                     {t('selection.seating.teamA')}
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:455 | 注意 UI/交互变更，需核对可用性与绑定 |                                 </div>
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:456 | 注意 UI/交互变更，需核对可用性与绑定 |                                 <div className="mt-[0.18vw] text-white/78">
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:457 | 注意 UI/交互变更，需核对可用性与绑定 |                                     {teamAPlayers.map(getPlayerLabel).join(' / ')}
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:458 | 注意 UI/交互变更，需核对可用性与绑定 |                                 </div>
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:459 | 注意 UI/交互变更，需核对可用性与绑定 |                             </div>
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:460 | 注意 UI/交互变更，需核对可用性与绑定 |                             <div className="rounded-[0.8vw] border border-rose-400/22 bg-rose-500/10 px-[0.7vw] py-[0.55vw]">
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:461 | 注意 UI/交互变更，需核对可用性与绑定 |                                 <div className="font-black uppercase tracking-[0.16em] text-rose-200/90">
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:462 | 注意 UI/交互变更，需核对可用性与绑定 |                                     {t('selection.seating.teamB')}
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:463 | 注意 UI/交互变更，需核对可用性与绑定 |                                 </div>
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:464 | 注意 UI/交互变更，需核对可用性与绑定 |                                 <div className="mt-[0.18vw] text-white/78">
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:465 | 注意 UI/交互变更，需核对可用性与绑定 |                                     {teamBPlayers.map(getPlayerLabel).join(' / ')}
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:466 | 注意 UI/交互变更，需核对可用性与绑定 |                                 </div>
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:467 | 注意 UI/交互变更，需核对可用性与绑定 |                             </div>
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:468 | 注意 UI/交互变更，需核对可用性与绑定 |                         </div>
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:469 | 注意 UI/交互变更，需核对可用性与绑定 |                     </div>
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:470 | 注意 UI/交互变更，需核对可用性与绑定 |                 )}
ADD src/games/dicethrone/ui/DiceThroneHeroSelection.tsx:471 | 注意 UI/交互变更，需核对可用性与绑定 | 
DEL src/games/dicethrone/ui/DiceTray.tsx:335 | 注意 UI/交互变更，需核对可用性与绑定 |     const isRollPhase = currentPhase === 'offensiveRoll' || currentPhase === 'defensiveRoll';
ADD src/games/dicethrone/ui/DiceTray.tsx:335 | 注意 UI/交互变更，需核对可用性与绑定 |     const isRollPhase = currentPhase === 'offensiveRoll' || currentPhase === 'targetingRoll' || currentPhase === 'defensiveRoll';
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:9 | 注意 UI/交互变更，需核对可用性与绑定 | import { Check } from 'lucide-react';
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:22 | 注意 UI/交互变更，需核对可用性与绑定 |     /** 玩家显示名 */
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:23 | 注意 UI/交互变更，需核对可用性与绑定 |     playerNames?: Record<PlayerId, string>;
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:24 | 注意 UI/交互变更，需核对可用性与绑定 |     /** 当前 4 人站位顺序 */
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:25 | 注意 UI/交互变更，需核对可用性与绑定 |     seatingOrder?: PlayerId[];
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:26 | 注意 UI/交互变更，需核对可用性与绑定 |     /** 队伍映射（4 人 / 2v2 用于区分友敌） */
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:27 | 注意 UI/交互变更，需核对可用性与绑定 |     teamIdByPlayerId?: Record<PlayerId, string>;
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:46 | 注意 UI/交互变更，需核对可用性与绑定 |     playerNames,
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:47 | 注意 UI/交互变更，需核对可用性与绑定 |     seatingOrder,
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:48 | 注意 UI/交互变更，需核对可用性与绑定 |     teamIdByPlayerId,
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:67 | 注意 UI/交互变更，需核对可用性与绑定 |     const shouldRenderStatusOwners = isStatusSelection && !isTransferTargetSelection;
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:84 | 注意 UI/交互变更，需核对可用性与绑定 |     const currentTeamId = teamIdByPlayerId?.[currentPlayerId];
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:85 | 注意 UI/交互变更，需核对可用性与绑定 |     const fallbackSeatOrder = React.useMemo(() => Object.keys(players) as PlayerId[], [players]);
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:86 | 注意 UI/交互变更，需核对可用性与绑定 |     const resolvedSeatingOrder = seatingOrder && seatingOrder.length > 0 ? seatingOrder : fallbackSeatOrder;
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:87 | 注意 UI/交互变更，需核对可用性与绑定 | 
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:88 | 注意 UI/交互变更，需核对可用性与绑定 |     const getPlayerMeta = React.useCallback((pid: PlayerId) => {
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:89 | 注意 UI/交互变更，需核对可用性与绑定 |         const isSelf = pid === currentPlayerId;
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:90 | 注意 UI/交互变更，需核对可用性与绑定 |         const isAlly = !isSelf && !!currentTeamId && teamIdByPlayerId?.[pid] === currentTeamId;
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:91 | 注意 UI/交互变更，需核对可用性与绑定 |         const teamTone = isSelf ? 'self' : isAlly ? 'ally' : 'enemy';
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:92 | 注意 UI/交互变更，需核对可用性与绑定 |         const seatIndex = resolvedSeatingOrder.indexOf(pid);
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:93 | 注意 UI/交互变更，需核对可用性与绑定 |         const seatNumber = seatIndex >= 0 ? seatIndex + 1 : Number.parseInt(String(pid), 10) + 1;
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:94 | 注意 UI/交互变更，需核对可用性与绑定 |         const seatLabel = Number.isFinite(seatNumber) ? `P${seatNumber}` : `P${String(pid)}`;
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:95 | 注意 UI/交互变更，需核对可用性与绑定 |         const displayName = playerNames?.[pid] || (isSelf ? t('common.self') : t('common.opponent'));
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:96 | 注意 UI/交互变更，需核对可用性与绑定 |         const relationLabel = isSelf ? t('common.self') : isAlly ? t('common.ally') : t('common.enemy');
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:97 | 注意 UI/交互变更，需核对可用性与绑定 |         return { isSelf, isAlly, teamTone, seatLabel, displayName, relationLabel };
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:98 | 注意 UI/交互变更，需核对可用性与绑定 |     }, [currentPlayerId, currentTeamId, playerNames, resolvedSeatingOrder, t, teamIdByPlayerId]);
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:99 | 注意 UI/交互变更，需核对可用性与绑定 | 
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:100 | 注意 UI/交互变更，需核对可用性与绑定 |     const getToneClasses = React.useCallback((teamTone: 'self' | 'ally' | 'enemy') => {
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:101 | 注意 UI/交互变更，需核对可用性与绑定 |         if (teamTone === 'self') {
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:102 | 注意 UI/交互变更，需核对可用性与绑定 |             return {
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:103 | 注意 UI/交互变更，需核对可用性与绑定 |                 idleBorderClassName: 'border-cyan-500/60 bg-cyan-950/20 hover:border-cyan-400',
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:104 | 注意 UI/交互变更，需核对可用性与绑定 |                 passiveBorderClassName: 'border-cyan-500/60 bg-cyan-950/20',
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:105 | 注意 UI/交互变更，需核对可用性与绑定 |                 titleClassName: 'text-cyan-300',
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:106 | 注意 UI/交互变更，需核对可用性与绑定 |                 badgeClassName: 'border-cyan-400/60 text-cyan-200 bg-cyan-950/50',
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:107 | 注意 UI/交互变更，需核对可用性与绑定 |             };
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:108 | 注意 UI/交互变更，需核对可用性与绑定 |         }
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:109 | 注意 UI/交互变更，需核对可用性与绑定 |         if (teamTone === 'ally') {
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:110 | 注意 UI/交互变更，需核对可用性与绑定 |             return {
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:111 | 注意 UI/交互变更，需核对可用性与绑定 |                 idleBorderClassName: 'border-emerald-500/60 bg-emerald-950/20 hover:border-emerald-400',
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:112 | 注意 UI/交互变更，需核对可用性与绑定 |                 passiveBorderClassName: 'border-emerald-500/60 bg-emerald-950/20',
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:113 | 注意 UI/交互变更，需核对可用性与绑定 |                 titleClassName: 'text-emerald-300',
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:114 | 注意 UI/交互变更，需核对可用性与绑定 |                 badgeClassName: 'border-emerald-400/60 text-emerald-200 bg-emerald-950/50',
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:115 | 注意 UI/交互变更，需核对可用性与绑定 |             };
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:116 | 注意 UI/交互变更，需核对可用性与绑定 |         }
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:117 | 注意 UI/交互变更，需核对可用性与绑定 |         return {
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:118 | 注意 UI/交互变更，需核对可用性与绑定 |             idleBorderClassName: 'border-rose-500/60 bg-slate-800/50 hover:border-rose-400',
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:119 | 注意 UI/交互变更，需核对可用性与绑定 |             passiveBorderClassName: 'border-rose-500/60 bg-slate-800/50',
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:120 | 注意 UI/交互变更，需核对可用性与绑定 |             titleClassName: 'text-rose-300',
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:121 | 注意 UI/交互变更，需核对可用性与绑定 |             badgeClassName: 'border-rose-400/60 text-rose-200 bg-rose-950/50',
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:122 | 注意 UI/交互变更，需核对可用性与绑定 |         };
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:123 | 注意 UI/交互变更，需核对可用性与绑定 |     }, []);
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:124 | 注意 UI/交互变更，需核对可用性与绑定 | 
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:125 | 注意 UI/交互变更，需核对可用性与绑定 |     const transferSourceCard = React.useMemo(() => {
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:126 | 注意 UI/交互变更，需核对可用性与绑定 |         if (!isTransferTargetSelection) return null;
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:127 | 注意 UI/交互变更，需核对可用性与绑定 |         const sourcePlayerId = interaction.transferConfig?.sourcePlayerId;
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:128 | 注意 UI/交互变更，需核对可用性与绑定 |         const statusId = interaction.transferConfig?.statusId;
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:129 | 注意 UI/交互变更，需核对可用性与绑定 |         if (!sourcePlayerId || !statusId) return null;
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:130 | 注意 UI/交互变更，需核对可用性与绑定 | 
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:131 | 注意 UI/交互变更，需核对可用性与绑定 |         const sourcePlayer = players[sourcePlayerId];
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:132 | 注意 UI/交互变更，需核对可用性与绑定 |         if (!sourcePlayer) return null;
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:133 | 注意 UI/交互变更，需核对可用性与绑定 | 
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:134 | 注意 UI/交互变更，需核对可用性与绑定 |         const effectStacks = sourcePlayer.statusEffects?.[statusId] ?? 0;
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:135 | 注意 UI/交互变更，需核对可用性与绑定 |         const tokenStacks = sourcePlayer.tokens?.[statusId] ?? 0;
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:136 | 注意 UI/交互变更，需核对可用性与绑定 |         return {
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:137 | 注意 UI/交互变更，需核对可用性与绑定 |             playerId: sourcePlayerId,
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:138 | 注意 UI/交互变更，需核对可用性与绑定 |             statusId,
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:139 | 注意 UI/交互变更，需核对可用性与绑定 |             effects: effectStacks > 0 ? { [statusId]: effectStacks } : {},
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:140 | 注意 UI/交互变更，需核对可用性与绑定 |             tokens: tokenStacks > 0 ? { [statusId]: tokenStacks } : {},
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:141 | 注意 UI/交互变更，需核对可用性与绑定 |         };
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:142 | 注意 UI/交互变更，需核对可用性与绑定 |     }, [interaction.transferConfig?.sourcePlayerId, interaction.transferConfig?.statusId, isTransferTargetSelection, players]);
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:143 | 注意 UI/交互变更，需核对可用性与绑定 | 
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:119 | 注意 UI/交互变更，需核对可用性与绑定 |                 {(isStatusSelection || isPlayerSelection) && (
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:188 | 注意 UI/交互变更，需核对可用性与绑定 |                 {(shouldRenderStatusOwners || isPlayerSelection) && (
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:125 | 注意 UI/交互变更，需核对可用性与绑定 |                             const isSelf = pid === currentPlayerId;
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:126 | 注意 UI/交互变更，需核对可用性与绑定 |                             const playerLabel = isSelf ? t('common.self') : t('common.opponent');
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:194 | 注意 UI/交互变更，需核对可用性与绑定 |                             const { teamTone, seatLabel, displayName, relationLabel } = getPlayerMeta(pid);
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:195 | 注意 UI/交互变更，需核对可用性与绑定 |                             const { idleBorderClassName, passiveBorderClassName, titleClassName, badgeClassName } = getToneClasses(teamTone);
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:135 | 注意 UI/交互变更，需核对可用性与绑定 |                                     <div key={pid} className="relative flex items-center gap-3">
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:136 | 注意 UI/交互变更，需核对可用性与绑定 |                                         <div
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:137 | 注意 UI/交互变更，需核对可用性与绑定 |                                             onClick={() => canSelect && onSelectPlayer(pid)}
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:138 | 注意 UI/交互变更，需核对可用性与绑定 |                                             className={`
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:139 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 p-4 rounded-xl border-2 transition-all duration-200 min-w-[200px]
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:140 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 ${canSelect ? 'cursor-pointer hover:scale-105' : 'opacity-50 cursor-not-allowed'}
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:141 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 ${isSelected
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:142 | 注意 UI/交互变更，需核对可用性与绑定 |                                                     ? 'border-green-500 bg-green-900/30 ring-2 ring-green-400'
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:143 | 注意 UI/交互变更，需核对可用性与绑定 |                                                     : canSelect
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:144 | 注意 UI/交互变更，需核对可用性与绑定 |                                                         ? 'border-amber-500/50 bg-slate-800/50 hover:border-amber-400'
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:145 | 注意 UI/交互变更，需核对可用性与绑定 |                                                         : 'border-slate-700 bg-slate-800/30'}
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:146 | 注意 UI/交互变更，需核对可用性与绑定 |                                             `}
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:147 | 注意 UI/交互变更，需核对可用性与绑定 |                                         >
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:148 | 注意 UI/交互变更，需核对可用性与绑定 |                                             <div className="text-center mb-2">
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:149 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 <div className={`font-bold text-lg ${isSelf ? 'text-cyan-400' : 'text-red-400'}`}>
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:150 | 注意 UI/交互变更，需核对可用性与绑定 |                                                     {playerLabel}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:204 | 注意 UI/交互变更，需核对可用性与绑定 |                                     <div
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:205 | 注意 UI/交互变更，需核对可用性与绑定 |                                         key={pid}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:206 | 注意 UI/交互变更，需核对可用性与绑定 |                                         onClick={() => canSelect && onSelectPlayer(pid)}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:207 | 注意 UI/交互变更，需核对可用性与绑定 |                                         data-testid={`dt-player-target-${pid}`}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:208 | 注意 UI/交互变更，需核对可用性与绑定 |                                         data-player-id={pid}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:209 | 注意 UI/交互变更，需核对可用性与绑定 |                                         data-team-tone={teamTone}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:210 | 注意 UI/交互变更，需核对可用性与绑定 |                                         className={`
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:211 | 注意 UI/交互变更，需核对可用性与绑定 |                                             p-4 rounded-xl border-2 transition-all duration-200 min-w-[200px]
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:212 | 注意 UI/交互变更，需核对可用性与绑定 |                                             ${canSelect ? 'cursor-pointer hover:scale-[1.03]' : 'opacity-50 cursor-not-allowed'}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:213 | 注意 UI/交互变更，需核对可用性与绑定 |                                             ${isSelected
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:214 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 ? 'border-amber-400 bg-amber-950/30 ring-2 ring-amber-300/80'
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:215 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 : canSelect
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:216 | 注意 UI/交互变更，需核对可用性与绑定 |                                                     ? idleBorderClassName
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:217 | 注意 UI/交互变更，需核对可用性与绑定 |                                                     : 'border-slate-700 bg-slate-800/30'}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:218 | 注意 UI/交互变更，需核对可用性与绑定 |                                         `}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:219 | 注意 UI/交互变更，需核对可用性与绑定 |                                     >
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:220 | 注意 UI/交互变更，需核对可用性与绑定 |                                         <div className="mb-3 flex items-start justify-between gap-3">
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:221 | 注意 UI/交互变更，需核对可用性与绑定 |                                             <div className="min-w-0">
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:222 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 <div className={`font-bold text-lg leading-tight ${titleClassName}`}>
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:223 | 注意 UI/交互变更，需核对可用性与绑定 |                                                     {displayName}
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:152 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 {player.nickname && (
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:153 | 注意 UI/交互变更，需核对可用性与绑定 |                                                     <div className="text-slate-400 text-sm mt-1">
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:154 | 注意 UI/交互变更，需核对可用性与绑定 |                                                         {player.nickname}
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:155 | 注意 UI/交互变更，需核对可用性与绑定 |                                                     </div>
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:156 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 )}
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:157 | 注意 UI/交互变更，需核对可用性与绑定 |                                             </div>
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:158 | 注意 UI/交互变更，需核对可用性与绑定 |                                             {/* 显示玩家的状态效果（仅供参考） */}
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:159 | 注意 UI/交互变更，需核对可用性与绑定 |                                             <SelectableEffectsContainer
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:160 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 effects={player.statusEffects ?? {}}
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:161 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 tokens={player.tokens}
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:162 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 highlightAll={false}
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:163 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 size="small"
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:164 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 className="justify-center"
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:165 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 locale={locale}
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:166 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 atlas={statusIconAtlas}
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:167 | 注意 UI/交互变更，需核对可用性与绑定 |                                             />
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:168 | 注意 UI/交互变更，需核对可用性与绑定 |                                             {!hasStatus && requiresTargetWithStatus && (
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:169 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 <div className="text-slate-500 text-sm text-center mt-2">
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:170 | 注意 UI/交互变更，需核对可用性与绑定 |                                                     {t('interaction.noStatus')}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:225 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:226 | 注意 UI/交互变更，需核对可用性与绑定 |                                                     {relationLabel}
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:172 | 注意 UI/交互变更，需核对可用性与绑定 |                                             )}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:228 | 注意 UI/交互变更，需核对可用性与绑定 |                                             </div>
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:229 | 注意 UI/交互变更，需核对可用性与绑定 |                                             <div className={`rounded-full border px-2 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${badgeClassName}`}>
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:230 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 {seatLabel}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:231 | 注意 UI/交互变更，需核对可用性与绑定 |                                             </div>
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:174 | 注意 UI/交互变更，需核对可用性与绑定 |                                         {/* 打勾图标绝对定位在卡片右侧 */}
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:175 | 注意 UI/交互变更，需核对可用性与绑定 |                                         {isSelected && (
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:176 | 注意 UI/交互变更，需核对可用性与绑定 |                                             <div className="absolute -right-10 top-1/2 -translate-y-1/2">
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:177 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 <div className="bg-green-500 rounded-full p-1">
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:178 | 注意 UI/交互变更，需核对可用性与绑定 |                                                     <Check size={20} className="text-white" strokeWidth={3} />
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:179 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 </div>
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:233 | 注意 UI/交互变更，需核对可用性与绑定 |                                         {/* 显示玩家的状态效果（仅供参考） */}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:234 | 注意 UI/交互变更，需核对可用性与绑定 |                                         <SelectableEffectsContainer
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:235 | 注意 UI/交互变更，需核对可用性与绑定 |                                             effects={player.statusEffects ?? {}}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:236 | 注意 UI/交互变更，需核对可用性与绑定 |                                             tokens={player.tokens}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:237 | 注意 UI/交互变更，需核对可用性与绑定 |                                             highlightAll={false}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:238 | 注意 UI/交互变更，需核对可用性与绑定 |                                             getItemTestId={(statusId) => `dt-status-effect-${pid}-${statusId}`}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:239 | 注意 UI/交互变更，需核对可用性与绑定 |                                             size="small"
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:240 | 注意 UI/交互变更，需核对可用性与绑定 |                                             className="justify-center"
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:241 | 注意 UI/交互变更，需核对可用性与绑定 |                                             locale={locale}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:242 | 注意 UI/交互变更，需核对可用性与绑定 |                                             atlas={statusIconAtlas}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:243 | 注意 UI/交互变更，需核对可用性与绑定 |                                         />
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:244 | 注意 UI/交互变更，需核对可用性与绑定 |                                         {!hasStatus && requiresTargetWithStatus && (
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:245 | 注意 UI/交互变更，需核对可用性与绑定 |                                             <div className="text-slate-500 text-sm text-center mt-2">
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:246 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 {t('interaction.noStatus')}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:257 | 注意 UI/交互变更，需核对可用性与绑定 |                                     data-testid={`dt-status-owner-${pid}`}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:258 | 注意 UI/交互变更，需核对可用性与绑定 |                                     data-player-id={pid}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:259 | 注意 UI/交互变更，需核对可用性与绑定 |                                     data-team-tone={teamTone}
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:193 | 注意 UI/交互变更，需核对可用性与绑定 |                                             ? 'border-amber-500/50 bg-slate-800/50'
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:263 | 注意 UI/交互变更，需核对可用性与绑定 |                                             ? passiveBorderClassName
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:197 | 注意 UI/交互变更，需核对可用性与绑定 |                                     <div className="text-center mb-2">
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:198 | 注意 UI/交互变更，需核对可用性与绑定 |                                         <span className={`font-bold text-lg ${isSelf ? 'text-cyan-400' : 'text-red-400'}`}>
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:199 | 注意 UI/交互变更，需核对可用性与绑定 |                                             {playerLabel}
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:200 | 注意 UI/交互变更，需核对可用性与绑定 |                                         </span>
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:267 | 注意 UI/交互变更，需核对可用性与绑定 |                                     <div className="mb-3 flex items-start justify-between gap-3">
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:268 | 注意 UI/交互变更，需核对可用性与绑定 |                                         <div className="min-w-0">
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:269 | 注意 UI/交互变更，需核对可用性与绑定 |                                             <div className={`font-bold text-lg leading-tight ${titleClassName}`}>
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:270 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 {displayName}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:271 | 注意 UI/交互变更，需核对可用性与绑定 |                                             </div>
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:272 | 注意 UI/交互变更，需核对可用性与绑定 |                                             <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:273 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 {relationLabel}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:274 | 注意 UI/交互变更，需核对可用性与绑定 |                                             </div>
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:275 | 注意 UI/交互变更，需核对可用性与绑定 |                                         </div>
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:276 | 注意 UI/交互变更，需核对可用性与绑定 |                                         <div className={`rounded-full border px-2 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${badgeClassName}`}>
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:277 | 注意 UI/交互变更，需核对可用性与绑定 |                                             {seatLabel}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:278 | 注意 UI/交互变更，需核对可用性与绑定 |                                         </div>
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:287 | 注意 UI/交互变更，需核对可用性与绑定 |                                             getItemTestId={(statusId) => `dt-status-effect-${pid}-${statusId}`}
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:227 | 注意 UI/交互变更，需核对可用性与绑定 |                     <div className="flex flex-wrap gap-4 justify-center">
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:228 | 注意 UI/交互变更，需核对可用性与绑定 |                         {targetPlayerIds
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:229 | 注意 UI/交互变更，需核对可用性与绑定 |                             .filter(pid => pid !== interaction.transferConfig?.sourcePlayerId)
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:230 | 注意 UI/交互变更，需核对可用性与绑定 |                             .map(pid => {
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:231 | 注意 UI/交互变更，需核对可用性与绑定 |                                 const player = players[pid];
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:232 | 注意 UI/交互变更，需核对可用性与绑定 |                                 if (!player) return null;
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:233 | 注意 UI/交互变更，需核对可用性与绑定 |                                 const isSelf = pid === currentPlayerId;
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:234 | 注意 UI/交互变更，需核对可用性与绑定 |                                 const playerLabel = isSelf ? t('common.self') : t('common.opponent');
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:235 | 注意 UI/交互变更，需核对可用性与绑定 |                                 const isSelected = selectedItems.includes(pid);
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:306 | 注意 UI/交互变更，需核对可用性与绑定 |                     <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:307 | 注意 UI/交互变更，需核对可用性与绑定 |                         {targetPlayerIds.map(pid => {
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:308 | 注意 UI/交互变更，需核对可用性与绑定 |                             const player = players[pid];
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:309 | 注意 UI/交互变更，需核对可用性与绑定 |                             if (!player) return null;
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:237 | 注意 UI/交互变更，需核对可用性与绑定 |                                 return (
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:238 | 注意 UI/交互变更，需核对可用性与绑定 |                                     <div
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:239 | 注意 UI/交互变更，需核对可用性与绑定 |                                         key={pid}
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:240 | 注意 UI/交互变更，需核对可用性与绑定 |                                         onClick={() => onSelectPlayer(pid)}
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:241 | 注意 UI/交互变更，需核对可用性与绑定 |                                         className={`
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:242 | 注意 UI/交互变更，需核对可用性与绑定 |                                             p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 min-w-[150px]
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:243 | 注意 UI/交互变更，需核对可用性与绑定 |                                             hover:scale-105
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:244 | 注意 UI/交互变更，需核对可用性与绑定 |                                             ${isSelected
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:245 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 ? 'border-green-500 bg-green-900/30 ring-2 ring-green-400'
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:246 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 : 'border-amber-500/50 bg-slate-800/50 hover:border-amber-400'}
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:247 | 注意 UI/交互变更，需核对可用性与绑定 |                                         `}
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:248 | 注意 UI/交互变更，需核对可用性与绑定 |                                     >
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:249 | 注意 UI/交互变更，需核对可用性与绑定 |                                         <div className="text-center">
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:250 | 注意 UI/交互变更，需核对可用性与绑定 |                                             <span className={`font-bold text-lg ${isSelf ? 'text-cyan-400' : 'text-red-400'}`}>
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:251 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 {playerLabel}
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:252 | 注意 UI/交互变更，需核对可用性与绑定 |                                             </span>
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:253 | 注意 UI/交互变更，需核对可用性与绑定 |                                             {isSelected && (
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:254 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 <Check size={16} className="ml-2 text-green-400" strokeWidth={3} />
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:255 | 注意 UI/交互变更，需核对可用性与绑定 |                                             )}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:311 | 注意 UI/交互变更，需核对可用性与绑定 |                             const isSourcePlayer = pid === interaction.transferConfig?.sourcePlayerId;
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:312 | 注意 UI/交互变更，需核对可用性与绑定 |                             const { teamTone, seatLabel, displayName, relationLabel } = getPlayerMeta(pid);
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:313 | 注意 UI/交互变更，需核对可用性与绑定 |                             const { idleBorderClassName, passiveBorderClassName, titleClassName, badgeClassName } = getToneClasses(teamTone);
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:314 | 注意 UI/交互变更，需核对可用性与绑定 |                             const isSelected = selectedItems.includes(pid);
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:315 | 注意 UI/交互变更，需核对可用性与绑定 |                             const canSelect = !isSourcePlayer;
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:316 | 注意 UI/交互变更，需核对可用性与绑定 | 
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:317 | 注意 UI/交互变更，需核对可用性与绑定 |                             return (
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:318 | 注意 UI/交互变更，需核对可用性与绑定 |                                 <div
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:319 | 注意 UI/交互变更，需核对可用性与绑定 |                                     key={pid}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:320 | 注意 UI/交互变更，需核对可用性与绑定 |                                     onClick={() => canSelect && onSelectPlayer(pid)}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:321 | 注意 UI/交互变更，需核对可用性与绑定 |                                     data-testid={isSourcePlayer ? `dt-transfer-source-locked-${pid}` : `dt-transfer-target-${pid}`}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:322 | 注意 UI/交互变更，需核对可用性与绑定 |                                     data-player-id={pid}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:323 | 注意 UI/交互变更，需核对可用性与绑定 |                                     data-team-tone={teamTone}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:324 | 注意 UI/交互变更，需核对可用性与绑定 |                                     data-locked={isSourcePlayer ? 'true' : 'false'}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:325 | 注意 UI/交互变更，需核对可用性与绑定 |                                     className={`
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:326 | 注意 UI/交互变更，需核对可用性与绑定 |                                         p-4 rounded-xl border-2 transition-all duration-200 min-w-0
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:327 | 注意 UI/交互变更，需核对可用性与绑定 |                                         ${canSelect ? 'cursor-pointer hover:scale-[1.03]' : 'cursor-not-allowed opacity-75'}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:328 | 注意 UI/交互变更，需核对可用性与绑定 |                                         ${isSourcePlayer
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:329 | 注意 UI/交互变更，需核对可用性与绑定 |                                             ? 'border-slate-500/70 bg-slate-900/80'
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:330 | 注意 UI/交互变更，需核对可用性与绑定 |                                             : isSelected
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:331 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 ? 'border-amber-400 bg-amber-950/30 ring-2 ring-amber-300/80'
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:332 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 : idleBorderClassName}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:333 | 注意 UI/交互变更，需核对可用性与绑定 |                                     `}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:334 | 注意 UI/交互变更，需核对可用性与绑定 |                                 >
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:335 | 注意 UI/交互变更，需核对可用性与绑定 |                                     <div className="mb-3 flex items-start justify-between gap-3">
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:336 | 注意 UI/交互变更，需核对可用性与绑定 |                                         <div className="min-w-0">
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:337 | 注意 UI/交互变更，需核对可用性与绑定 |                                             <div className={`font-bold text-lg leading-tight ${titleClassName}`}>
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:338 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 {displayName}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:339 | 注意 UI/交互变更，需核对可用性与绑定 |                                             </div>
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:340 | 注意 UI/交互变更，需核对可用性与绑定 |                                             <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:341 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 {isSourcePlayer ? `${relationLabel} / 已选来源` : relationLabel}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:342 | 注意 UI/交互变更，需核对可用性与绑定 |                                             </div>
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:343 | 注意 UI/交互变更，需核对可用性与绑定 |                                         </div>
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:344 | 注意 UI/交互变更，需核对可用性与绑定 |                                         <div className={`rounded-full border px-2 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${badgeClassName}`}>
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:345 | 注意 UI/交互变更，需核对可用性与绑定 |                                             {seatLabel}
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:258 | 注意 UI/交互变更，需核对可用性与绑定 |                                 );
DEL src/games/dicethrone/ui/InteractionOverlay.tsx:259 | 注意 UI/交互变更，需核对可用性与绑定 |                             })}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:348 | 注意 UI/交互变更，需核对可用性与绑定 |                                     {isSourcePlayer && transferSourceCard ? (
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:349 | 注意 UI/交互变更，需核对可用性与绑定 |                                         Object.keys(transferSourceCard.effects).length > 0 || Object.keys(transferSourceCard.tokens).length > 0 ? (
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:350 | 注意 UI/交互变更，需核对可用性与绑定 |                                             <SelectableEffectsContainer
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:351 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 effects={transferSourceCard.effects}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:352 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 tokens={transferSourceCard.tokens}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:353 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 highlightAll={false}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:354 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 selectedId={transferSourceCard.statusId}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:355 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 getItemTestId={(statusId) => `dt-transfer-source-effect-${statusId}`}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:356 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 size="small"
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:357 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 className="justify-center"
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:358 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 locale={locale}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:359 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 atlas={statusIconAtlas}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:360 | 注意 UI/交互变更，需核对可用性与绑定 |                                             />
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:361 | 注意 UI/交互变更，需核对可用性与绑定 |                                         ) : (
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:362 | 注意 UI/交互变更，需核对可用性与绑定 |                                             <div className="text-sm text-slate-400">
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:363 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 {transferSourceCard.statusId}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:364 | 注意 UI/交互变更，需核对可用性与绑定 |                                             </div>
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:365 | 注意 UI/交互变更，需核对可用性与绑定 |                                         )
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:366 | 注意 UI/交互变更，需核对可用性与绑定 |                                     ) : (
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:367 | 注意 UI/交互变更，需核对可用性与绑定 |                                         <div className={`${canSelect ? '' : passiveBorderClassName} rounded-lg`}>
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:368 | 注意 UI/交互变更，需核对可用性与绑定 |                                             <SelectableEffectsContainer
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:369 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 effects={player.statusEffects ?? {}}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:370 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 tokens={player.tokens}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:371 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 highlightAll={false}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:372 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 size="small"
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:373 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 className="justify-center"
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:374 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 locale={locale}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:375 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 atlas={statusIconAtlas}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:376 | 注意 UI/交互变更，需核对可用性与绑定 |                                             />
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:377 | 注意 UI/交互变更，需核对可用性与绑定 |                                         </div>
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:378 | 注意 UI/交互变更，需核对可用性与绑定 |                                     )}
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:379 | 注意 UI/交互变更，需核对可用性与绑定 |                                 </div>
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:380 | 注意 UI/交互变更，需核对可用性与绑定 |                             );
ADD src/games/dicethrone/ui/InteractionOverlay.tsx:381 | 注意 UI/交互变更，需核对可用性与绑定 |                         })}
ADD src/games/dicethrone/ui/OpponentHeader.tsx:18 | 注意 UI/交互变更，需核对可用性与绑定 | type HeaderTone = 'enemy' | 'ally';
ADD src/games/dicethrone/ui/OpponentHeader.tsx:19 | 注意 UI/交互变更，需核对可用性与绑定 | 
ADD src/games/dicethrone/ui/OpponentHeader.tsx:20 | 注意 UI/交互变更，需核对可用性与绑定 | interface OpponentHeaderProps {
ADD src/games/dicethrone/ui/OpponentHeader.tsx:21 | 注意 UI/交互变更，需核对可用性与绑定 |     opponent: HeroState;
ADD src/games/dicethrone/ui/OpponentHeader.tsx:22 | 注意 UI/交互变更，需核对可用性与绑定 |     playerId?: string;
ADD src/games/dicethrone/ui/OpponentHeader.tsx:23 | 注意 UI/交互变更，需核对可用性与绑定 |     opponentName: string;
ADD src/games/dicethrone/ui/OpponentHeader.tsx:24 | 注意 UI/交互变更，需核对可用性与绑定 |     viewMode: ViewMode;
ADD src/games/dicethrone/ui/OpponentHeader.tsx:25 | 注意 UI/交互变更，需核对可用性与绑定 |     isOpponentShaking: boolean;
ADD src/games/dicethrone/ui/OpponentHeader.tsx:26 | 注意 UI/交互变更，需核对可用性与绑定 |     hitStopActive?: boolean;
ADD src/games/dicethrone/ui/OpponentHeader.tsx:27 | 注意 UI/交互变更，需核对可用性与绑定 |     hitStopConfig?: HitStopConfig;
ADD src/games/dicethrone/ui/OpponentHeader.tsx:28 | 注意 UI/交互变更，需核对可用性与绑定 |     shouldAutoObserve: boolean;
ADD src/games/dicethrone/ui/OpponentHeader.tsx:29 | 注意 UI/交互变更，需核对可用性与绑定 |     onToggleView: () => void;
ADD src/games/dicethrone/ui/OpponentHeader.tsx:30 | 注意 UI/交互变更，需核对可用性与绑定 |     headerError?: string | null;
ADD src/games/dicethrone/ui/OpponentHeader.tsx:31 | 注意 UI/交互变更，需核对可用性与绑定 |     opponentBuffRef?: RefObject<HTMLDivElement | null>;
ADD src/games/dicethrone/ui/OpponentHeader.tsx:32 | 注意 UI/交互变更，需核对可用性与绑定 |     opponentHpRef?: RefObject<HTMLDivElement | null>;
ADD src/games/dicethrone/ui/OpponentHeader.tsx:33 | 注意 UI/交互变更，需核对可用性与绑定 |     opponentCpRef?: RefObject<HTMLDivElement | null>;
ADD src/games/dicethrone/ui/OpponentHeader.tsx:34 | 注意 UI/交互变更，需核对可用性与绑定 |     statusIconAtlas?: StatusAtlases | null;
ADD src/games/dicethrone/ui/OpponentHeader.tsx:35 | 注意 UI/交互变更，需核对可用性与绑定 |     locale?: string;
ADD src/games/dicethrone/ui/OpponentHeader.tsx:36 | 注意 UI/交互变更，需核对可用性与绑定 |     containerRef?: RefObject<HTMLDivElement | null>;
ADD src/games/dicethrone/ui/OpponentHeader.tsx:37 | 注意 UI/交互变更，需核对可用性与绑定 |     tokenDefinitions?: TokenDef[];
ADD src/games/dicethrone/ui/OpponentHeader.tsx:38 | 注意 UI/交互变更，需核对可用性与绑定 |     damageFlashActive?: boolean;
ADD src/games/dicethrone/ui/OpponentHeader.tsx:39 | 注意 UI/交互变更，需核对可用性与绑定 |     damageFlashDamage?: number;
ADD src/games/dicethrone/ui/OpponentHeader.tsx:40 | 注意 UI/交互变更，需核对可用性与绑定 |     overrideHp?: number;
ADD src/games/dicethrone/ui/OpponentHeader.tsx:41 | 注意 UI/交互变更，需核对可用性与绑定 |     selected?: boolean;
ADD src/games/dicethrone/ui/OpponentHeader.tsx:42 | 注意 UI/交互变更，需核对可用性与绑定 |     observed?: boolean;
ADD src/games/dicethrone/ui/OpponentHeader.tsx:43 | 注意 UI/交互变更，需核对可用性与绑定 |     compact?: boolean;
ADD src/games/dicethrone/ui/OpponentHeader.tsx:44 | 注意 UI/交互变更，需核对可用性与绑定 |     tone?: HeaderTone;
ADD src/games/dicethrone/ui/OpponentHeader.tsx:45 | 注意 UI/交互变更，需核对可用性与绑定 |     containerClassName?: string;
ADD src/games/dicethrone/ui/OpponentHeader.tsx:46 | 注意 UI/交互变更，需核对可用性与绑定 |     disabled?: boolean;
ADD src/games/dicethrone/ui/OpponentHeader.tsx:47 | 注意 UI/交互变更，需核对可用性与绑定 |     testId?: string;
ADD src/games/dicethrone/ui/OpponentHeader.tsx:48 | 注意 UI/交互变更，需核对可用性与绑定 | }
ADD src/games/dicethrone/ui/OpponentHeader.tsx:52 | 注意 UI/交互变更，需核对可用性与绑定 |     playerId,
DEL src/games/dicethrone/ui/OpponentHeader.tsx:39 | 注意 UI/交互变更，需核对可用性与绑定 | }: {
DEL src/games/dicethrone/ui/OpponentHeader.tsx:40 | 注意 UI/交互变更，需核对可用性与绑定 |     opponent: HeroState;
DEL src/games/dicethrone/ui/OpponentHeader.tsx:41 | 注意 UI/交互变更，需核对可用性与绑定 |     opponentName: string;
DEL src/games/dicethrone/ui/OpponentHeader.tsx:42 | 注意 UI/交互变更，需核对可用性与绑定 |     viewMode: ViewMode;
DEL src/games/dicethrone/ui/OpponentHeader.tsx:43 | 注意 UI/交互变更，需核对可用性与绑定 |     isOpponentShaking: boolean;
DEL src/games/dicethrone/ui/OpponentHeader.tsx:44 | 注意 UI/交互变更，需核对可用性与绑定 |     hitStopActive?: boolean;
DEL src/games/dicethrone/ui/OpponentHeader.tsx:45 | 注意 UI/交互变更，需核对可用性与绑定 |     hitStopConfig?: HitStopConfig;
DEL src/games/dicethrone/ui/OpponentHeader.tsx:46 | 注意 UI/交互变更，需核对可用性与绑定 |     shouldAutoObserve: boolean;
DEL src/games/dicethrone/ui/OpponentHeader.tsx:47 | 注意 UI/交互变更，需核对可用性与绑定 |     onToggleView: () => void;
DEL src/games/dicethrone/ui/OpponentHeader.tsx:48 | 注意 UI/交互变更，需核对可用性与绑定 |     headerError?: string | null;
DEL src/games/dicethrone/ui/OpponentHeader.tsx:49 | 注意 UI/交互变更，需核对可用性与绑定 |     opponentBuffRef?: RefObject<HTMLDivElement | null>;
DEL src/games/dicethrone/ui/OpponentHeader.tsx:50 | 注意 UI/交互变更，需核对可用性与绑定 |     opponentHpRef?: RefObject<HTMLDivElement | null>;
DEL src/games/dicethrone/ui/OpponentHeader.tsx:51 | 注意 UI/交互变更，需核对可用性与绑定 |     opponentCpRef?: RefObject<HTMLDivElement | null>;
DEL src/games/dicethrone/ui/OpponentHeader.tsx:52 | 注意 UI/交互变更，需核对可用性与绑定 |     statusIconAtlas?: StatusAtlases | null;
DEL src/games/dicethrone/ui/OpponentHeader.tsx:53 | 注意 UI/交互变更，需核对可用性与绑定 |     locale?: string;
DEL src/games/dicethrone/ui/OpponentHeader.tsx:54 | 注意 UI/交互变更，需核对可用性与绑定 |     /** 对手悬浮窗容器引用（用于卡牌特写动画起点） */
DEL src/games/dicethrone/ui/OpponentHeader.tsx:55 | 注意 UI/交互变更，需核对可用性与绑定 |     containerRef?: RefObject<HTMLDivElement | null>;
DEL src/games/dicethrone/ui/OpponentHeader.tsx:56 | 注意 UI/交互变更，需核对可用性与绑定 |     /** Token 定义列表（用于显示堆叠上限） */
DEL src/games/dicethrone/ui/OpponentHeader.tsx:57 | 注意 UI/交互变更，需核对可用性与绑定 |     tokenDefinitions?: TokenDef[];
DEL src/games/dicethrone/ui/OpponentHeader.tsx:58 | 注意 UI/交互变更，需核对可用性与绑定 |     /** 受击 DamageFlash 是否激活 */
DEL src/games/dicethrone/ui/OpponentHeader.tsx:59 | 注意 UI/交互变更，需核对可用性与绑定 |     damageFlashActive?: boolean;
DEL src/games/dicethrone/ui/OpponentHeader.tsx:60 | 注意 UI/交互变更，需核对可用性与绑定 |     /** 受击伤害值（用于 DamageFlash 强度） */
DEL src/games/dicethrone/ui/OpponentHeader.tsx:61 | 注意 UI/交互变更，需核对可用性与绑定 |     damageFlashDamage?: number;
DEL src/games/dicethrone/ui/OpponentHeader.tsx:62 | 注意 UI/交互变更，需核对可用性与绑定 |     /** 视觉状态缓冲覆盖的 HP 值（飞行动画到达前冻结） */
DEL src/games/dicethrone/ui/OpponentHeader.tsx:63 | 注意 UI/交互变更，需核对可用性与绑定 |     overrideHp?: number;
DEL src/games/dicethrone/ui/OpponentHeader.tsx:64 | 注意 UI/交互变更，需核对可用性与绑定 | }) => {
ADD src/games/dicethrone/ui/OpponentHeader.tsx:71 | 注意 UI/交互变更，需核对可用性与绑定 |     selected = false,
ADD src/games/dicethrone/ui/OpponentHeader.tsx:72 | 注意 UI/交互变更，需核对可用性与绑定 |     observed,
ADD src/games/dicethrone/ui/OpponentHeader.tsx:73 | 注意 UI/交互变更，需核对可用性与绑定 |     compact = false,
ADD src/games/dicethrone/ui/OpponentHeader.tsx:74 | 注意 UI/交互变更，需核对可用性与绑定 |     tone = 'enemy',
ADD src/games/dicethrone/ui/OpponentHeader.tsx:75 | 注意 UI/交互变更，需核对可用性与绑定 |     containerClassName,
ADD src/games/dicethrone/ui/OpponentHeader.tsx:76 | 注意 UI/交互变更，需核对可用性与绑定 |     disabled = false,
ADD src/games/dicethrone/ui/OpponentHeader.tsx:77 | 注意 UI/交互变更，需核对可用性与绑定 |     testId,
ADD src/games/dicethrone/ui/OpponentHeader.tsx:78 | 注意 UI/交互变更，需核对可用性与绑定 | }: OpponentHeaderProps) => {
DEL src/games/dicethrone/ui/OpponentHeader.tsx:68 | 注意 UI/交互变更，需核对可用性与绑定 |     const containerClassName = isMobileNarrowViewport
ADD src/games/dicethrone/ui/OpponentHeader.tsx:82 | 注意 UI/交互变更，需核对可用性与绑定 |     const isObserved = observed ?? viewMode === 'opponent';
ADD src/games/dicethrone/ui/OpponentHeader.tsx:83 | 注意 UI/交互变更，需核对可用性与绑定 |     const defaultContainerClassName = isMobileNarrowViewport
ADD src/games/dicethrone/ui/OpponentHeader.tsx:86 | 注意 UI/交互变更，需核对可用性与绑定 |     const wrapperClassName = containerClassName ?? defaultContainerClassName;
ADD src/games/dicethrone/ui/OpponentHeader.tsx:87 | 注意 UI/交互变更，需核对可用性与绑定 | 
ADD src/games/dicethrone/ui/OpponentHeader.tsx:88 | 注意 UI/交互变更，需核对可用性与绑定 |     const accent = tone === 'ally'
ADD src/games/dicethrone/ui/OpponentHeader.tsx:89 | 注意 UI/交互变更，需核对可用性与绑定 |         ? {
ADD src/games/dicethrone/ui/OpponentHeader.tsx:90 | 注意 UI/交互变更，需核对可用性与绑定 |             active: 'bg-emerald-950/85 border-emerald-400/60 shadow-[0_0_14px_rgba(16,185,129,0.25)]',
ADD src/games/dicethrone/ui/OpponentHeader.tsx:91 | 注意 UI/交互变更，需核对可用性与绑定 |             selected: 'bg-slate-900/95 border-emerald-300/45 shadow-[0_0_10px_rgba(16,185,129,0.18)]',
ADD src/games/dicethrone/ui/OpponentHeader.tsx:92 | 注意 UI/交互变更，需核对可用性与绑定 |             idle: 'bg-slate-900/95 border-white/10 hover:bg-slate-800 hover:border-emerald-300/35',
ADD src/games/dicethrone/ui/OpponentHeader.tsx:93 | 注意 UI/交互变更，需核对可用性与绑定 |             text: isObserved || selected ? 'text-emerald-300' : 'text-slate-100',
ADD src/games/dicethrone/ui/OpponentHeader.tsx:94 | 注意 UI/交互变更，需核对可用性与绑定 |             badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/20',
ADD src/games/dicethrone/ui/OpponentHeader.tsx:95 | 注意 UI/交互变更，需核对可用性与绑定 |             eye: 'fill-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.9)]',
ADD src/games/dicethrone/ui/OpponentHeader.tsx:96 | 注意 UI/交互变更，需核对可用性与绑定 |         }
ADD src/games/dicethrone/ui/OpponentHeader.tsx:97 | 注意 UI/交互变更，需核对可用性与绑定 |         : {
ADD src/games/dicethrone/ui/OpponentHeader.tsx:98 | 注意 UI/交互变更，需核对可用性与绑定 |             active: 'bg-amber-900/80 border-amber-500/50 shadow-[0_0_14px_rgba(245,158,11,0.22)]',
ADD src/games/dicethrone/ui/OpponentHeader.tsx:99 | 注意 UI/交互变更，需核对可用性与绑定 |             selected: 'bg-slate-900/95 border-amber-300/45 shadow-[0_0_10px_rgba(245,158,11,0.16)]',
ADD src/games/dicethrone/ui/OpponentHeader.tsx:100 | 注意 UI/交互变更，需核对可用性与绑定 |             idle: 'bg-slate-900/95 border-white/10 hover:bg-slate-800 hover:border-amber-300/35',
ADD src/games/dicethrone/ui/OpponentHeader.tsx:101 | 注意 UI/交互变更，需核对可用性与绑定 |             text: isObserved || selected ? 'text-amber-400' : 'text-slate-100',
ADD src/games/dicethrone/ui/OpponentHeader.tsx:102 | 注意 UI/交互变更，需核对可用性与绑定 |             badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
ADD src/games/dicethrone/ui/OpponentHeader.tsx:103 | 注意 UI/交互变更，需核对可用性与绑定 |             eye: 'fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.9)]',
ADD src/games/dicethrone/ui/OpponentHeader.tsx:104 | 注意 UI/交互变更，需核对可用性与绑定 |         };
ADD src/games/dicethrone/ui/OpponentHeader.tsx:105 | 注意 UI/交互变更，需核对可用性与绑定 | 
ADD src/games/dicethrone/ui/OpponentHeader.tsx:106 | 注意 UI/交互变更，需核对可用性与绑定 |     const shellClassName = compact
ADD src/games/dicethrone/ui/OpponentHeader.tsx:107 | 注意 UI/交互变更，需核对可用性与绑定 |         ? 'px-[0.55vw] py-[0.28vw] rounded-[0.7vw]'
ADD src/games/dicethrone/ui/OpponentHeader.tsx:108 | 注意 UI/交互变更，需核对可用性与绑定 |         : 'px-[0.7vw] py-[0.3vw] rounded-[0.8vw]';
ADD src/games/dicethrone/ui/OpponentHeader.tsx:109 | 注意 UI/交互变更，需核对可用性与绑定 |     const bodyGapClassName = compact ? 'gap-[0.45vw]' : 'gap-[0.6vw]';
ADD src/games/dicethrone/ui/OpponentHeader.tsx:110 | 注意 UI/交互变更，需核对可用性与绑定 |     const portraitClassName = compact
ADD src/games/dicethrone/ui/OpponentHeader.tsx:111 | 注意 UI/交互变更，需核对可用性与绑定 |         ? 'w-[2.2vw] h-[3.2vw] rounded-[0.35vw]'
ADD src/games/dicethrone/ui/OpponentHeader.tsx:112 | 注意 UI/交互变更，需核对可用性与绑定 |         : 'w-[2.8vw] h-[4vw] rounded-[0.4vw]';
ADD src/games/dicethrone/ui/OpponentHeader.tsx:113 | 注意 UI/交互变更，需核对可用性与绑定 |     const nameClassName = compact
ADD src/games/dicethrone/ui/OpponentHeader.tsx:114 | 注意 UI/交互变更，需核对可用性与绑定 |         ? 'font-black text-[0.72vw] tracking-wider truncate max-w-[7.5vw]'
ADD src/games/dicethrone/ui/OpponentHeader.tsx:115 | 注意 UI/交互变更，需核对可用性与绑定 |         : 'font-black text-[0.9vw] tracking-wider truncate max-w-[10vw]';
ADD src/games/dicethrone/ui/OpponentHeader.tsx:116 | 注意 UI/交互变更，需核对可用性与绑定 |     const badgeClassName = compact
ADD src/games/dicethrone/ui/OpponentHeader.tsx:117 | 注意 UI/交互变更，需核对可用性与绑定 |         ? 'px-[0.24vw] py-[0.08vw] text-[0.48vw]'
ADD src/games/dicethrone/ui/OpponentHeader.tsx:118 | 注意 UI/交互变更，需核对可用性与绑定 |         : 'px-[0.3vw] py-[0.1vw] text-[0.55vw]';
ADD src/games/dicethrone/ui/OpponentHeader.tsx:119 | 注意 UI/交互变更，需核对可用性与绑定 |     const statClassName = compact ? 'text-[0.66vw]' : 'text-[0.75vw]';
ADD src/games/dicethrone/ui/OpponentHeader.tsx:120 | 注意 UI/交互变更，需核对可用性与绑定 |     const iconDotClassName = compact ? 'w-[0.42vw] h-[0.42vw]' : 'w-[0.5vw] h-[0.5vw]';
ADD src/games/dicethrone/ui/OpponentHeader.tsx:121 | 注意 UI/交互变更，需核对可用性与绑定 |     const handIconClassName = compact ? 'w-[0.62vw] h-[0.62vw]' : 'w-[0.7vw] h-[0.7vw]';
ADD src/games/dicethrone/ui/OpponentHeader.tsx:122 | 注意 UI/交互变更，需核对可用性与绑定 |     const shieldClassName = compact ? 'w-[0.95vw] h-[0.95vw]' : 'w-[1.1vw] h-[1.1vw]';
ADD src/games/dicethrone/ui/OpponentHeader.tsx:123 | 注意 UI/交互变更，需核对可用性与绑定 |     const shieldTextClassName = compact ? 'text-[0.42vw]' : 'text-[0.5vw]';
ADD src/games/dicethrone/ui/OpponentHeader.tsx:124 | 注意 UI/交互变更，需核对可用性与绑定 |     const eyeClassName = compact ? 'w-[1.25vw] h-[1.25vw]' : 'w-[1.6vw] h-[1.6vw]';
ADD src/games/dicethrone/ui/OpponentHeader.tsx:125 | 注意 UI/交互变更，需核对可用性与绑定 |     const buffMinHeightClassName = compact ? 'min-h-[1vw]' : 'min-h-[1.2vw]';
ADD src/games/dicethrone/ui/OpponentHeader.tsx:126 | 注意 UI/交互变更，需核对可用性与绑定 | 
ADD src/games/dicethrone/ui/OpponentHeader.tsx:127 | 注意 UI/交互变更，需核对可用性与绑定 |     const stateClassName = disabled
ADD src/games/dicethrone/ui/OpponentHeader.tsx:128 | 注意 UI/交互变更，需核对可用性与绑定 |         ? 'bg-slate-950/85 border-white/5 opacity-55 saturate-75'
ADD src/games/dicethrone/ui/OpponentHeader.tsx:129 | 注意 UI/交互变更，需核对可用性与绑定 |         : isObserved
ADD src/games/dicethrone/ui/OpponentHeader.tsx:130 | 注意 UI/交互变更，需核对可用性与绑定 |         ? accent.active
ADD src/games/dicethrone/ui/OpponentHeader.tsx:131 | 注意 UI/交互变更，需核对可用性与绑定 |         : selected
ADD src/games/dicethrone/ui/OpponentHeader.tsx:132 | 注意 UI/交互变更，需核对可用性与绑定 |             ? accent.selected
ADD src/games/dicethrone/ui/OpponentHeader.tsx:133 | 注意 UI/交互变更，需核对可用性与绑定 |             : accent.idle;
DEL src/games/dicethrone/ui/OpponentHeader.tsx:73 | 注意 UI/交互变更，需核对可用性与绑定 |         <div ref={containerRef} className={containerClassName}>
ADD src/games/dicethrone/ui/OpponentHeader.tsx:136 | 注意 UI/交互变更，需核对可用性与绑定 |         <div
ADD src/games/dicethrone/ui/OpponentHeader.tsx:137 | 注意 UI/交互变更，需核对可用性与绑定 |             ref={containerRef}
ADD src/games/dicethrone/ui/OpponentHeader.tsx:138 | 注意 UI/交互变更，需核对可用性与绑定 |             className={wrapperClassName}
ADD src/games/dicethrone/ui/OpponentHeader.tsx:139 | 注意 UI/交互变更，需核对可用性与绑定 |             data-testid={testId}
ADD src/games/dicethrone/ui/OpponentHeader.tsx:140 | 注意 UI/交互变更，需核对可用性与绑定 |             data-team-tone={tone}
ADD src/games/dicethrone/ui/OpponentHeader.tsx:141 | 注意 UI/交互变更，需核对可用性与绑定 |             data-player-id={playerId}
ADD src/games/dicethrone/ui/OpponentHeader.tsx:142 | 注意 UI/交互变更，需核对可用性与绑定 |         >
DEL src/games/dicethrone/ui/OpponentHeader.tsx:75 | 注意 UI/交互变更，需核对可用性与绑定 |                 <div className="px-[1.5vw] py-[0.5vw] bg-red-600/90 text-white font-bold text-[0.9vw] rounded-full shadow-2xl border border-red-400/50 backdrop-blur-md animate-in slide-in-from-top-4 pointer-events-auto flex items-center gap-[0.4vw]">
DEL src/games/dicethrone/ui/OpponentHeader.tsx:76 | 注意 UI/交互变更，需核对可用性与绑定 |                     <AlertTriangle className="w-[1.1vw] h-[1.1vw]" />
ADD src/games/dicethrone/ui/OpponentHeader.tsx:144 | 注意 UI/交互变更，需核对可用性与绑定 |                 <div className="px-[1.2vw] py-[0.4vw] bg-red-600/90 text-white font-bold text-[0.8vw] rounded-full shadow-2xl border border-red-400/50 backdrop-blur-md animate-in slide-in-from-top-4 pointer-events-auto flex items-center gap-[0.35vw]">
ADD src/games/dicethrone/ui/OpponentHeader.tsx:145 | 注意 UI/交互变更，需核对可用性与绑定 |                     <AlertTriangle className="w-[0.95vw] h-[0.95vw]" />
DEL src/games/dicethrone/ui/OpponentHeader.tsx:80 | 注意 UI/交互变更，需核对可用性与绑定 |             <div className="flex justify-center items-center gap-[1vw] pointer-events-auto">
ADD src/games/dicethrone/ui/OpponentHeader.tsx:149 | 注意 UI/交互变更，需核对可用性与绑定 | 
ADD src/games/dicethrone/ui/OpponentHeader.tsx:150 | 注意 UI/交互变更，需核对可用性与绑定 |             <div className="flex justify-center items-center pointer-events-auto">
DEL src/games/dicethrone/ui/OpponentHeader.tsx:84 | 注意 UI/交互变更，需核对可用性与绑定 |                         if (shouldAutoObserve) return;
ADD src/games/dicethrone/ui/OpponentHeader.tsx:154 | 注意 UI/交互变更，需核对可用性与绑定 |                         if (disabled || shouldAutoObserve) return;
DEL src/games/dicethrone/ui/OpponentHeader.tsx:87 | 注意 UI/交互变更，需核对可用性与绑定 |                     className={`
DEL src/games/dicethrone/ui/OpponentHeader.tsx:88 | 注意 UI/交互变更，需核对可用性与绑定 |                         relative overflow-visible group px-[0.7vw] py-[0.3vw] rounded-[0.8vw] shadow-lg cursor-pointer transition-all duration-300
DEL src/games/dicethrone/ui/OpponentHeader.tsx:89 | 注意 UI/交互变更，需核对可用性与绑定 |                         border
DEL src/games/dicethrone/ui/OpponentHeader.tsx:90 | 注意 UI/交互变更，需核对可用性与绑定 |                         ${viewMode === 'opponent'
DEL src/games/dicethrone/ui/OpponentHeader.tsx:91 | 注意 UI/交互变更，需核对可用性与绑定 |                             ? 'bg-amber-900/80 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
DEL src/games/dicethrone/ui/OpponentHeader.tsx:92 | 注意 UI/交互变更，需核对可用性与绑定 |                             : 'bg-slate-900/95 border-white/10 hover:bg-slate-800 hover:border-white/20'}
DEL src/games/dicethrone/ui/OpponentHeader.tsx:93 | 注意 UI/交互变更，需核对可用性与绑定 |                         ${isOpponentShaking ? '!border-red-500 !shadow-[0_0_12px_rgba(239,68,68,0.3)]' : ''}
DEL src/games/dicethrone/ui/OpponentHeader.tsx:94 | 注意 UI/交互变更，需核对可用性与绑定 |                     `}
ADD src/games/dicethrone/ui/OpponentHeader.tsx:157 | 注意 UI/交互变更，需核对可用性与绑定 |                     className={[
ADD src/games/dicethrone/ui/OpponentHeader.tsx:158 | 注意 UI/交互变更，需核对可用性与绑定 |                         'relative overflow-visible group shadow-lg transition-all duration-300 border',
ADD src/games/dicethrone/ui/OpponentHeader.tsx:159 | 注意 UI/交互变更，需核对可用性与绑定 |                         disabled ? 'cursor-not-allowed' : 'cursor-pointer',
ADD src/games/dicethrone/ui/OpponentHeader.tsx:160 | 注意 UI/交互变更，需核对可用性与绑定 |                         shellClassName,
ADD src/games/dicethrone/ui/OpponentHeader.tsx:161 | 注意 UI/交互变更，需核对可用性与绑定 |                         stateClassName,
ADD src/games/dicethrone/ui/OpponentHeader.tsx:162 | 注意 UI/交互变更，需核对可用性与绑定 |                         isOpponentShaking ? '!border-red-500 !shadow-[0_0_12px_rgba(239,68,68,0.3)]' : '',
ADD src/games/dicethrone/ui/OpponentHeader.tsx:163 | 注意 UI/交互变更，需核对可用性与绑定 |                     ].join(' ')}
DEL src/games/dicethrone/ui/OpponentHeader.tsx:101 | 注意 UI/交互变更，需核对可用性与绑定 |                         <div className="relative flex items-center gap-[0.6vw] overflow-visible">
DEL src/games/dicethrone/ui/OpponentHeader.tsx:102 | 注意 UI/交互变更，需核对可用性与绑定 |                             <div className="w-[2.8vw] h-[4vw] rounded-[0.4vw] border border-white/10 overflow-hidden relative bg-slate-950 shadow-inner">
ADD src/games/dicethrone/ui/OpponentHeader.tsx:170 | 注意 UI/交互变更，需核对可用性与绑定 |                         <div className={`relative flex items-center ${bodyGapClassName} overflow-visible`}>
ADD src/games/dicethrone/ui/OpponentHeader.tsx:171 | 注意 UI/交互变更，需核对可用性与绑定 |                             <div className={`${portraitClassName} border border-white/10 overflow-hidden relative bg-slate-950 shadow-inner`}>
DEL src/games/dicethrone/ui/OpponentHeader.tsx:104 | 注意 UI/交互变更，需核对可用性与绑定 |                                 <div className={`absolute inset-0 pointer-events-none bg-black/40 flex items-center justify-center backdrop-blur-[2px] transition-all duration-300 ${viewMode === 'opponent' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
DEL src/games/dicethrone/ui/OpponentHeader.tsx:105 | 注意 UI/交互变更，需核对可用性与绑定 |                                     <svg viewBox="0 0 24 24" className="w-[1.6vw] h-[1.6vw] fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.9)]">
ADD src/games/dicethrone/ui/OpponentHeader.tsx:173 | 注意 UI/交互变更，需核对可用性与绑定 |                                 <div className={`absolute inset-0 pointer-events-none bg-black/40 flex items-center justify-center backdrop-blur-[2px] transition-all duration-300 ${isObserved ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
ADD src/games/dicethrone/ui/OpponentHeader.tsx:174 | 注意 UI/交互变更，需核对可用性与绑定 |                                     <svg viewBox="0 0 24 24" className={`${eyeClassName} ${accent.eye}`}>
ADD src/games/dicethrone/ui/OpponentHeader.tsx:179 | 注意 UI/交互变更，需核对可用性与绑定 | 
DEL src/games/dicethrone/ui/OpponentHeader.tsx:111 | 注意 UI/交互变更，需核对可用性与绑定 |                                 <div className="flex items-center gap-[0.6vw]">
DEL src/games/dicethrone/ui/OpponentHeader.tsx:112 | 注意 UI/交互变更，需核对可用性与绑定 |                                     <span className={`font-black text-[0.9vw] tracking-wider truncate max-w-[10vw] ${viewMode === 'opponent' ? 'text-amber-400' : 'text-slate-100'}`}>
ADD src/games/dicethrone/ui/OpponentHeader.tsx:181 | 注意 UI/交互变更，需核对可用性与绑定 |                                 <div className={`flex items-center ${bodyGapClassName}`}>
ADD src/games/dicethrone/ui/OpponentHeader.tsx:182 | 注意 UI/交互变更，需核对可用性与绑定 |                                     <span className={`${nameClassName} ${accent.text}`}>
DEL src/games/dicethrone/ui/OpponentHeader.tsx:115 | 注意 UI/交互变更，需核对可用性与绑定 |                                     <span className="px-[0.3vw] py-[0.1vw] bg-amber-500/10 text-amber-500 text-[0.55vw] font-bold uppercase tracking-widest rounded border border-amber-500/20 shadow-sm">{heroLabel}</span>
ADD src/games/dicethrone/ui/OpponentHeader.tsx:185 | 注意 UI/交互变更，需核对可用性与绑定 |                                     <span className={`${badgeClassName} ${accent.badge} font-bold uppercase tracking-widest rounded border shadow-sm`}>
ADD src/games/dicethrone/ui/OpponentHeader.tsx:186 | 注意 UI/交互变更，需核对可用性与绑定 |                                         {heroLabel}
ADD src/games/dicethrone/ui/OpponentHeader.tsx:187 | 注意 UI/交互变更，需核对可用性与绑定 |                                     </span>
DEL src/games/dicethrone/ui/OpponentHeader.tsx:117 | 注意 UI/交互变更，需核对可用性与绑定 |                                     <div ref={opponentHpRef} className="flex items-center gap-[0.4vw] ml-[0.2vw]">
ADD src/games/dicethrone/ui/OpponentHeader.tsx:189 | 注意 UI/交互变更，需核对可用性与绑定 |                                     <div ref={opponentHpRef} className={`flex items-center gap-[0.3vw] ${compact ? 'ml-[0.05vw]' : 'ml-[0.2vw]'}`}>
DEL src/games/dicethrone/ui/OpponentHeader.tsx:119 | 注意 UI/交互变更，需核对可用性与绑定 |                                             <div className="w-[0.5vw] h-[0.5vw] bg-red-500 rounded-full shadow-[0_0_6px_rgba(239,68,68,0.4)]"></div>
DEL src/games/dicethrone/ui/OpponentHeader.tsx:120 | 注意 UI/交互变更，需核对可用性与绑定 |                                             <span className="text-red-400 font-bold text-[0.75vw]">{overrideHp ?? (opponent.resources[RESOURCE_IDS.HP] ?? 0)}</span>
ADD src/games/dicethrone/ui/OpponentHeader.tsx:191 | 注意 UI/交互变更，需核对可用性与绑定 |                                             <div className={`${iconDotClassName} bg-red-500 rounded-full shadow-[0_0_6px_rgba(239,68,68,0.4)]`} />
ADD src/games/dicethrone/ui/OpponentHeader.tsx:192 | 注意 UI/交互变更，需核对可用性与绑定 |                                             <span className={`text-red-400 font-bold ${statClassName}`}>{overrideHp ?? (opponent.resources[RESOURCE_IDS.HP] ?? 0)}</span>
DEL src/games/dicethrone/ui/OpponentHeader.tsx:123 | 注意 UI/交互变更，需核对可用性与绑定 |                                             <div className="w-[0.5vw] h-[0.5vw] bg-amber-500 rounded-full shadow-[0_0_6px_rgba(245,158,11,0.4)]"></div>
DEL src/games/dicethrone/ui/OpponentHeader.tsx:124 | 注意 UI/交互变更，需核对可用性与绑定 |                                             <span className="text-amber-500 font-bold text-[0.75vw]">{opponent.resources[RESOURCE_IDS.CP] ?? 0}</span>
ADD src/games/dicethrone/ui/OpponentHeader.tsx:195 | 注意 UI/交互变更，需核对可用性与绑定 |                                             <div className={`${iconDotClassName} bg-amber-500 rounded-full shadow-[0_0_6px_rgba(245,158,11,0.4)]`} />
ADD src/games/dicethrone/ui/OpponentHeader.tsx:196 | 注意 UI/交互变更，需核对可用性与绑定 |                                             <span className={`text-amber-500 font-bold ${statClassName}`}>{opponent.resources[RESOURCE_IDS.CP] ?? 0}</span>
DEL src/games/dicethrone/ui/OpponentHeader.tsx:127 | 注意 UI/交互变更，需核对可用性与绑定 |                                             <Layers className="w-[0.7vw] h-[0.7vw] text-sky-400 drop-shadow-[0_0_4px_rgba(56,189,248,0.5)]" />
DEL src/games/dicethrone/ui/OpponentHeader.tsx:128 | 注意 UI/交互变更，需核对可用性与绑定 |                                             <span className="text-sky-400 font-bold text-[0.75vw]">{opponent.hand.length}</span>
ADD src/games/dicethrone/ui/OpponentHeader.tsx:199 | 注意 UI/交互变更，需核对可用性与绑定 |                                             <Layers className={`${handIconClassName} text-sky-400 drop-shadow-[0_0_4px_rgba(56,189,248,0.5)]`} />
ADD src/games/dicethrone/ui/OpponentHeader.tsx:200 | 注意 UI/交互变更，需核对可用性与绑定 |                                             <span className={`text-sky-400 font-bold ${statClassName}`}>{opponent.hand.length}</span>
DEL src/games/dicethrone/ui/OpponentHeader.tsx:131 | 注意 UI/交互变更，需核对可用性与绑定 |                                             <div className="relative w-[1.1vw] h-[1.1vw] flex items-center justify-center">
ADD src/games/dicethrone/ui/OpponentHeader.tsx:203 | 注意 UI/交互变更，需核对可用性与绑定 |                                             <div className={`relative ${shieldClassName} flex items-center justify-center`}>
DEL src/games/dicethrone/ui/OpponentHeader.tsx:135 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 <span className="absolute inset-0 flex items-center justify-center text-[0.5vw] font-bold text-white drop-shadow-md z-10 pb-[1px]">
ADD src/games/dicethrone/ui/OpponentHeader.tsx:207 | 注意 UI/交互变更，需核对可用性与绑定 |                                                 <span className={`absolute inset-0 flex items-center justify-center font-bold text-white drop-shadow-md z-10 pb-[1px] ${shieldTextClassName}`}>
DEL src/games/dicethrone/ui/OpponentHeader.tsx:143 | 注意 UI/交互变更，需核对可用性与绑定 |                                 <div ref={opponentBuffRef} className="flex gap-[0.2vw] min-h-[1.2vw]">
ADD src/games/dicethrone/ui/OpponentHeader.tsx:215 | 注意 UI/交互变更，需核对可用性与绑定 |                                 <div ref={opponentBuffRef} className={`flex gap-[0.2vw] ${buffMinHeightClassName}`}>
DEL src/games/dicethrone/ui/OpponentHeader.tsx:162 | 注意 UI/交互变更，需核对可用性与绑定 | 
DEL src/games/dicethrone/ui/OpponentHeader.tsx:165 | 注意 UI/交互变更，需核对可用性与绑定 |                     {/* 受击时空裂隙 + 红脉冲 overlay */}
ADD src/games/dicethrone/ui/OpponentHeader.tsx:236 | 注意 UI/交互变更，需核对可用性与绑定 | 
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:29 | OK 测试/覆盖新增，需与主链保持一致 |                 'common.ally': '队友',
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:30 | OK 测试/覆盖新增，需与主链保持一致 |                 'common.enemy': '敌方',
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:74 | OK 测试/覆盖新增，需与主链保持一致 |     const fourPlayerNames: Record<PlayerId, string> = {
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:75 | OK 测试/覆盖新增，需与主链保持一致 |         '0': 'Host-P0',
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:76 | OK 测试/覆盖新增，需与主链保持一致 |         '1': 'Guest-P1',
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:77 | OK 测试/覆盖新增，需与主链保持一致 |         '2': 'Guest-P2',
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:78 | OK 测试/覆盖新增，需与主链保持一致 |         '3': 'Guest-P3',
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:79 | OK 测试/覆盖新增，需与主链保持一致 |     };
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:80 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:81 | OK 测试/覆盖新增，需与主链保持一致 |     const fourPlayerTeams: Record<PlayerId, string> = {
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:82 | OK 测试/覆盖新增，需与主链保持一致 |         '0': 'A',
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:83 | OK 测试/覆盖新增，需与主链保持一致 |         '1': 'B',
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:84 | OK 测试/覆盖新增，需与主链保持一致 |         '2': 'A',
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:85 | OK 测试/覆盖新增，需与主链保持一致 |         '3': 'B',
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:86 | OK 测试/覆盖新增，需与主链保持一致 |     };
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:87 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:88 | OK 测试/覆盖新增，需与主链保持一致 |     const fourPlayerOrder: PlayerId[] = ['0', '1', '2', '3'];
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:89 | OK 测试/覆盖新增，需与主链保持一致 | 
DEL src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:113 | 注意 删除/收口测试，覆盖减少需确认 |             expect(screen.getByText('自己')).toBeInTheDocument();
DEL src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:114 | 注意 删除/收口测试，覆盖减少需确认 |             expect(screen.getByText('对手')).toBeInTheDocument();
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:131 | OK 测试/覆盖新增，需与主链保持一致 |             expect(screen.getByTestId('dt-status-owner-0')).toHaveTextContent('自己');
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:132 | OK 测试/覆盖新增，需与主链保持一致 |             expect(screen.getByTestId('dt-status-owner-1')).toHaveTextContent('对手');
DEL src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:200 | 注意 删除/收口测试，覆盖减少需确认 |             expect(screen.getByText('自己')).toBeInTheDocument();
DEL src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:201 | 注意 删除/收口测试，覆盖减少需确认 |             expect(screen.getByText('对手')).toBeInTheDocument();
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:218 | OK 测试/覆盖新增，需与主链保持一致 |             expect(screen.getByTestId('dt-player-target-0')).toHaveTextContent('自己');
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:219 | OK 测试/覆盖新增，需与主链保持一致 |             expect(screen.getByTestId('dt-player-target-1')).toHaveTextContent('对手');
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:304 | OK 测试/覆盖新增，需与主链保持一致 |             expect(screen.getByTestId('dt-transfer-source-locked-0')).toBeInTheDocument();
DEL src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:288 | 注意 删除/收口测试，覆盖减少需确认 |         it('should exclude source player in phase 2', () => {
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:307 | OK 测试/覆盖新增，需与主链保持一致 |         it('should keep source player as locked card and hide first-stage owner cards in phase 2', () => {
DEL src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:307 | 注意 删除/收口测试，覆盖减少需确认 |             // 转移阶段2：状态选择区域和转移目标区域都会渲染
DEL src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:308 | 注意 删除/收口测试，覆盖减少需确认 |             // "对手" 可能出现多次（状态选择区域 + 转移目标区域）
DEL src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:309 | 注意 删除/收口测试，覆盖减少需确认 |             const opponentLabels = screen.queryAllByText('对手');
DEL src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:310 | 注意 删除/收口测试，覆盖减少需确认 |             expect(opponentLabels.length).toBeGreaterThanOrEqual(1);
DEL src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:311 | 注意 删除/收口测试，覆盖减少需确认 |             // 自己在状态选择区域中仍然显示，但转移目标区域排除了自己
DEL src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:312 | 注意 删除/收口测试，覆盖减少需确认 |             const selfLabels = screen.queryAllByText('自己');
DEL src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:313 | 注意 删除/收口测试，覆盖减少需确认 |             // 转移目标区域不包含自己，但状态选择区域可能包含
DEL src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:314 | 注意 删除/收口测试，覆盖减少需确认 |             expect(selfLabels.length).toBeLessThanOrEqual(opponentLabels.length);
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:326 | OK 测试/覆盖新增，需与主链保持一致 |             expect(screen.getByTestId('dt-transfer-source-locked-0')).toHaveAttribute('data-locked', 'true');
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:327 | OK 测试/覆盖新增，需与主链保持一致 |             expect(screen.getByTestId('dt-transfer-target-1')).toBeInTheDocument();
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:328 | OK 测试/覆盖新增，需与主链保持一致 |             expect(screen.queryByTestId('dt-status-owner-0')).not.toBeInTheDocument();
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:329 | OK 测试/覆盖新增，需与主链保持一致 |             expect(screen.queryByTestId('dt-status-owner-1')).not.toBeInTheDocument();
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:330 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:331 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:332 | OK 测试/覆盖新增，需与主链保持一致 |         it('4人模式下应为玩家目标卡片输出稳定标识与阵营信息', () => {
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:333 | OK 测试/覆盖新增，需与主链保持一致 |             const fourPlayerInteraction: InteractionDescriptor = {
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:334 | OK 测试/覆盖新增，需与主链保持一致 |                 id: 'test-4p-player',
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:335 | OK 测试/覆盖新增，需与主链保持一致 |                 type: 'selectPlayer',
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:336 | OK 测试/覆盖新增，需与主链保持一致 |                 sourceCardId: 'test-card',
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:337 | OK 测试/覆盖新增，需与主链保持一致 |                 playerId: '0',
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:338 | OK 测试/覆盖新增，需与主链保持一致 |                 titleKey: 'interaction.selectPlayerToRemoveAllStatus',
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:339 | OK 测试/覆盖新增，需与主链保持一致 |                 selectCount: 1,
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:340 | OK 测试/覆盖新增，需与主链保持一致 |                 targetPlayerIds: ['0', '1', '2', '3'],
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:341 | OK 测试/覆盖新增，需与主链保持一致 |                 selected: [],
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:342 | OK 测试/覆盖新增，需与主链保持一致 |             };
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:343 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:344 | OK 测试/覆盖新增，需与主链保持一致 |             const fourPlayerMockPlayers: Record<PlayerId, HeroState> = {
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:345 | OK 测试/覆盖新增，需与主链保持一致 |                 ...mockPlayers,
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:346 | OK 测试/覆盖新增，需与主链保持一致 |                 '2': {
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:347 | OK 测试/覆盖新增，需与主链保持一致 |                     characterId: 'paladin',
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:348 | OK 测试/覆盖新增，需与主链保持一致 |                     resources: { hp: 40, cp: 2 },
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:349 | OK 测试/覆盖新增，需与主链保持一致 |                     statusEffects: { shock: 1 },
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:350 | OK 测试/覆盖新增，需与主链保持一致 |                     tokens: {},
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:351 | OK 测试/覆盖新增，需与主链保持一致 |                     hand: [],
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:352 | OK 测试/覆盖新增，需与主链保持一致 |                     discard: [],
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:353 | OK 测试/覆盖新增，需与主链保持一致 |                     deck: [],
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:354 | OK 测试/覆盖新增，需与主链保持一致 |                     abilityLevels: {},
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:355 | OK 测试/覆盖新增，需与主链保持一致 |                 } as HeroState,
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:356 | OK 测试/覆盖新增，需与主链保持一致 |                 '3': {
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:357 | OK 测试/覆盖新增，需与主链保持一致 |                     characterId: 'pyromancer',
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:358 | OK 测试/覆盖新增，需与主链保持一致 |                     resources: { hp: 35, cp: 4 },
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:359 | OK 测试/覆盖新增，需与主链保持一致 |                     statusEffects: {},
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:360 | OK 测试/覆盖新增，需与主链保持一致 |                     tokens: { burn: 2 } as any,
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:361 | OK 测试/覆盖新增，需与主链保持一致 |                     hand: [],
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:362 | OK 测试/覆盖新增，需与主链保持一致 |                     discard: [],
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:363 | OK 测试/覆盖新增，需与主链保持一致 |                     deck: [],
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:364 | OK 测试/覆盖新增，需与主链保持一致 |                     abilityLevels: {},
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:365 | OK 测试/覆盖新增，需与主链保持一致 |                 } as HeroState,
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:366 | OK 测试/覆盖新增，需与主链保持一致 |             };
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:367 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:368 | OK 测试/覆盖新增，需与主链保持一致 |             render(
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:369 | OK 测试/覆盖新增，需与主链保持一致 |                 <InteractionOverlay
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:370 | OK 测试/覆盖新增，需与主链保持一致 |                     interaction={fourPlayerInteraction}
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:371 | OK 测试/覆盖新增，需与主链保持一致 |                     players={fourPlayerMockPlayers}
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:372 | OK 测试/覆盖新增，需与主链保持一致 |                     currentPlayerId="0"
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:373 | OK 测试/覆盖新增，需与主链保持一致 |                     playerNames={fourPlayerNames}
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:374 | OK 测试/覆盖新增，需与主链保持一致 |                     seatingOrder={fourPlayerOrder}
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:375 | OK 测试/覆盖新增，需与主链保持一致 |                     teamIdByPlayerId={fourPlayerTeams}
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:376 | OK 测试/覆盖新增，需与主链保持一致 |                     {...mockHandlers}
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:377 | OK 测试/覆盖新增，需与主链保持一致 |                 />
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:378 | OK 测试/覆盖新增，需与主链保持一致 |             );
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:379 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:380 | OK 测试/覆盖新增，需与主链保持一致 |             expect(screen.getByTestId('dt-player-target-0')).toHaveAttribute('data-team-tone', 'self');
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:381 | OK 测试/覆盖新增，需与主链保持一致 |             expect(screen.getByTestId('dt-player-target-2')).toHaveAttribute('data-team-tone', 'ally');
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:382 | OK 测试/覆盖新增，需与主链保持一致 |             expect(screen.getByTestId('dt-player-target-1')).toHaveAttribute('data-team-tone', 'enemy');
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:383 | OK 测试/覆盖新增，需与主链保持一致 |             expect(screen.getByText('Host-P0')).toBeInTheDocument();
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:384 | OK 测试/覆盖新增，需与主链保持一致 |             expect(screen.getByText('Guest-P2')).toBeInTheDocument();
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:385 | OK 测试/覆盖新增，需与主链保持一致 |             expect(screen.getByText('P3')).toBeInTheDocument();
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:386 | OK 测试/覆盖新增，需与主链保持一致 |         });
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:387 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:388 | OK 测试/覆盖新增，需与主链保持一致 |         it('4人转移第二阶段应保留锁定来源卡并保留其他候选人的稳定标识', () => {
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:389 | OK 测试/覆盖新增，需与主链保持一致 |             const phase2Interaction: InteractionDescriptor = {
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:390 | OK 测试/覆盖新增，需与主链保持一致 |                 ...transferInteraction,
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:391 | OK 测试/覆盖新增，需与主链保持一致 |                 transferConfig: {
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:392 | OK 测试/覆盖新增，需与主链保持一致 |                     sourcePlayerId: '2',
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:393 | OK 测试/覆盖新增，需与主链保持一致 |                     statusId: 'poison',
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:394 | OK 测试/覆盖新增，需与主链保持一致 |                 },
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:395 | OK 测试/覆盖新增，需与主链保持一致 |                 targetPlayerIds: ['0', '1', '2', '3'],
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:396 | OK 测试/覆盖新增，需与主链保持一致 |             };
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:397 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:398 | OK 测试/覆盖新增，需与主链保持一致 |             const fourPlayerMockPlayers: Record<PlayerId, HeroState> = {
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:399 | OK 测试/覆盖新增，需与主链保持一致 |                 ...mockPlayers,
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:400 | OK 测试/覆盖新增，需与主链保持一致 |                 '2': {
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:401 | OK 测试/覆盖新增，需与主链保持一致 |                     characterId: 'paladin',
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:402 | OK 测试/覆盖新增，需与主链保持一致 |                     resources: { hp: 40, cp: 2 },
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:403 | OK 测试/覆盖新增，需与主链保持一致 |                     statusEffects: { poison: 1 },
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:404 | OK 测试/覆盖新增，需与主链保持一致 |                     tokens: {},
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:405 | OK 测试/覆盖新增，需与主链保持一致 |                     hand: [],
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:406 | OK 测试/覆盖新增，需与主链保持一致 |                     discard: [],
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:407 | OK 测试/覆盖新增，需与主链保持一致 |                     deck: [],
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:408 | OK 测试/覆盖新增，需与主链保持一致 |                     abilityLevels: {},
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:409 | OK 测试/覆盖新增，需与主链保持一致 |                 } as HeroState,
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:410 | OK 测试/覆盖新增，需与主链保持一致 |                 '3': {
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:411 | OK 测试/覆盖新增，需与主链保持一致 |                     characterId: 'pyromancer',
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:412 | OK 测试/覆盖新增，需与主链保持一致 |                     resources: { hp: 35, cp: 4 },
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:413 | OK 测试/覆盖新增，需与主链保持一致 |                     statusEffects: {},
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:414 | OK 测试/覆盖新增，需与主链保持一致 |                     tokens: { burn: 2 } as any,
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:415 | OK 测试/覆盖新增，需与主链保持一致 |                     hand: [],
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:416 | OK 测试/覆盖新增，需与主链保持一致 |                     discard: [],
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:417 | OK 测试/覆盖新增，需与主链保持一致 |                     deck: [],
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:418 | OK 测试/覆盖新增，需与主链保持一致 |                     abilityLevels: {},
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:419 | OK 测试/覆盖新增，需与主链保持一致 |                 } as HeroState,
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:420 | OK 测试/覆盖新增，需与主链保持一致 |             };
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:421 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:422 | OK 测试/覆盖新增，需与主链保持一致 |             render(
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:423 | OK 测试/覆盖新增，需与主链保持一致 |                 <InteractionOverlay
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:424 | OK 测试/覆盖新增，需与主链保持一致 |                     interaction={phase2Interaction}
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:425 | OK 测试/覆盖新增，需与主链保持一致 |                     players={fourPlayerMockPlayers}
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:426 | OK 测试/覆盖新增，需与主链保持一致 |                     currentPlayerId="0"
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:427 | OK 测试/覆盖新增，需与主链保持一致 |                     playerNames={fourPlayerNames}
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:428 | OK 测试/覆盖新增，需与主链保持一致 |                     seatingOrder={fourPlayerOrder}
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:429 | OK 测试/覆盖新增，需与主链保持一致 |                     teamIdByPlayerId={fourPlayerTeams}
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:430 | OK 测试/覆盖新增，需与主链保持一致 |                     {...mockHandlers}
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:431 | OK 测试/覆盖新增，需与主链保持一致 |                 />
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:432 | OK 测试/覆盖新增，需与主链保持一致 |             );
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:433 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:434 | OK 测试/覆盖新增，需与主链保持一致 |             expect(screen.getByTestId('dt-transfer-source-locked-2')).toHaveAttribute('data-locked', 'true');
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:435 | OK 测试/覆盖新增，需与主链保持一致 |             expect(screen.getByTestId('dt-transfer-target-0')).toHaveAttribute('data-team-tone', 'self');
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:436 | OK 测试/覆盖新增，需与主链保持一致 |             expect(screen.getByTestId('dt-transfer-target-1')).toHaveAttribute('data-team-tone', 'enemy');
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:437 | OK 测试/覆盖新增，需与主链保持一致 |             expect(screen.getByTestId('dt-transfer-target-3')).toHaveAttribute('data-team-tone', 'enemy');
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:438 | OK 测试/覆盖新增，需与主链保持一致 |             expect(screen.queryByTestId('dt-status-owner-0')).not.toBeInTheDocument();
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:439 | OK 测试/覆盖新增，需与主链保持一致 |             expect(screen.queryByTestId('dt-status-owner-1')).not.toBeInTheDocument();
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:440 | OK 测试/覆盖新增，需与主链保持一致 |             expect(screen.queryByTestId('dt-status-owner-2')).not.toBeInTheDocument();
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:441 | OK 测试/覆盖新增，需与主链保持一致 |             expect(screen.queryByTestId('dt-status-owner-3')).not.toBeInTheDocument();
DEL src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:415 | 注意 删除/收口测试，覆盖减少需确认 |             expect(screen.getByText('自己')).toBeInTheDocument();
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:542 | OK 测试/覆盖新增，需与主链保持一致 |             expect(screen.getByTestId('dt-status-owner-0')).toBeInTheDocument();
ADD src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx:543 | OK 测试/覆盖新增，需与主链保持一致 |             expect(screen.queryByTestId('dt-status-owner-999')).not.toBeInTheDocument();
ADD src/games/dicethrone/ui/resolveMoves.ts:43 | 注意 UI/交互变更，需核对可用性与绑定 |     moveSeat: (playerId: string, targetSeatIndex: number) => void;
ADD src/games/dicethrone/ui/resolveMoves.ts:45 | 注意 UI/交互变更，需核对可用性与绑定 |     playerUnready: () => void;
ADD src/games/dicethrone/ui/resolveMoves.ts:86 | 注意 UI/交互变更，需核对可用性与绑定 |     moveSeat: (playerId, targetSeatIndex) => dispatch('MOVE_SEAT', { playerId, targetSeatIndex }),
ADD src/games/dicethrone/ui/resolveMoves.ts:88 | 注意 UI/交互变更，需核对可用性与绑定 |     playerUnready: () => dispatch('PLAYER_UNREADY', {}),
ADD src/games/dicethrone/ui/statusEffects.tsx:451 | 注意 UI/交互变更，需核对可用性与绑定 |     dataTestId,
ADD src/games/dicethrone/ui/statusEffects.tsx:462 | 注意 UI/交互变更，需核对可用性与绑定 |     dataTestId?: string;
ADD src/games/dicethrone/ui/statusEffects.tsx:498 | 注意 UI/交互变更，需核对可用性与绑定 |             data-testid={dataTestId}
ADD src/games/dicethrone/ui/statusEffects.tsx:547 | 注意 UI/交互变更，需核对可用性与绑定 |     getItemTestId,
ADD src/games/dicethrone/ui/statusEffects.tsx:559 | 注意 UI/交互变更，需核对可用性与绑定 |     getItemTestId?: (effectId: string) => string | undefined;
ADD src/games/dicethrone/ui/statusEffects.tsx:582 | 注意 UI/交互变更，需核对可用性与绑定 |                     dataTestId={getItemTestId?.(id)}
DEL src/server/__tests__/matchOccupancy.test.ts:2 | 注意 删除/收口测试，覆盖减少需确认 | import { hasOccupiedPlayers, isSeatOccupied, type PlayerSeat } from '../matchOccupancy';
ADD src/server/__tests__/matchOccupancy.test.ts:2 | OK 测试/覆盖新增，需与主链保持一致 | import {
ADD src/server/__tests__/matchOccupancy.test.ts:3 | OK 测试/覆盖新增，需与主链保持一致 |     areAllSeatsOccupied,
ADD src/server/__tests__/matchOccupancy.test.ts:4 | OK 测试/覆盖新增，需与主链保持一致 |     hasOccupiedPlayers,
ADD src/server/__tests__/matchOccupancy.test.ts:5 | OK 测试/覆盖新增，需与主链保持一致 |     isSeatOccupied,
ADD src/server/__tests__/matchOccupancy.test.ts:6 | OK 测试/覆盖新增，需与主链保持一致 |     isSupportedPlayerCount,
ADD src/server/__tests__/matchOccupancy.test.ts:7 | OK 测试/覆盖新增，需与主链保持一致 |     type PlayerSeat,
ADD src/server/__tests__/matchOccupancy.test.ts:8 | OK 测试/覆盖新增，需与主链保持一致 | } from '../matchOccupancy';
ADD src/server/__tests__/matchOccupancy.test.ts:26 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/server/__tests__/matchOccupancy.test.ts:27 | OK 测试/覆盖新增，需与主链保持一致 |     it('areAllSeatsOccupied: 所有座位都占满时才返回 true', () => {
ADD src/server/__tests__/matchOccupancy.test.ts:28 | OK 测试/覆盖新增，需与主链保持一致 |         expect(areAllSeatsOccupied(undefined)).toBe(false);
ADD src/server/__tests__/matchOccupancy.test.ts:29 | OK 测试/覆盖新增，需与主链保持一致 |         expect(areAllSeatsOccupied({ 0: {}, 1: { name: 'P1' } })).toBe(false);
ADD src/server/__tests__/matchOccupancy.test.ts:30 | OK 测试/覆盖新增，需与主链保持一致 |         expect(areAllSeatsOccupied({ 0: { name: 'P0' }, 1: { credentials: 'cred-1' } })).toBe(true);
ADD src/server/__tests__/matchOccupancy.test.ts:31 | OK 测试/覆盖新增，需与主链保持一致 |         expect(areAllSeatsOccupied({
ADD src/server/__tests__/matchOccupancy.test.ts:32 | OK 测试/覆盖新增，需与主链保持一致 |             0: { name: 'P0' },
ADD src/server/__tests__/matchOccupancy.test.ts:33 | OK 测试/覆盖新增，需与主链保持一致 |             1: { name: 'P1' },
ADD src/server/__tests__/matchOccupancy.test.ts:34 | OK 测试/覆盖新增，需与主链保持一致 |             2: { credentials: 'cred-2' },
ADD src/server/__tests__/matchOccupancy.test.ts:35 | OK 测试/覆盖新增，需与主链保持一致 |             3: { isConnected: true },
ADD src/server/__tests__/matchOccupancy.test.ts:36 | OK 测试/覆盖新增，需与主链保持一致 |         })).toBe(true);
ADD src/server/__tests__/matchOccupancy.test.ts:37 | OK 测试/覆盖新增，需与主链保持一致 |     });
ADD src/server/__tests__/matchOccupancy.test.ts:38 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/server/__tests__/matchOccupancy.test.ts:39 | OK 测试/覆盖新增，需与主链保持一致 |     it('isSupportedPlayerCount: 仅允许整数且在 min/max 区间内的人数', () => {
ADD src/server/__tests__/matchOccupancy.test.ts:40 | OK 测试/覆盖新增，需与主链保持一致 |         expect(isSupportedPlayerCount(2, 2, 4)).toBe(true);
ADD src/server/__tests__/matchOccupancy.test.ts:41 | OK 测试/覆盖新增，需与主链保持一致 |         expect(isSupportedPlayerCount(4, 2, 4)).toBe(true);
ADD src/server/__tests__/matchOccupancy.test.ts:42 | OK 测试/覆盖新增，需与主链保持一致 |         expect(isSupportedPlayerCount(3, 2, 4)).toBe(true);
ADD src/server/__tests__/matchOccupancy.test.ts:43 | OK 测试/覆盖新增，需与主链保持一致 |         expect(isSupportedPlayerCount(1, 2, 4)).toBe(false);
ADD src/server/__tests__/matchOccupancy.test.ts:44 | OK 测试/覆盖新增，需与主链保持一致 |         expect(isSupportedPlayerCount(5, 2, 4)).toBe(false);
ADD src/server/__tests__/matchOccupancy.test.ts:45 | OK 测试/覆盖新增，需与主链保持一致 |         expect(isSupportedPlayerCount(2.5, 2, 4)).toBe(false);
ADD src/server/__tests__/matchOccupancy.test.ts:46 | OK 测试/覆盖新增，需与主链保持一致 |         expect(isSupportedPlayerCount(Number.NaN, 2, 4)).toBe(false);
ADD src/server/__tests__/matchOccupancy.test.ts:47 | OK 测试/覆盖新增，需与主链保持一致 |     });
ADD src/server/__tests__/matchOccupancy.test.ts:48 | OK 测试/覆盖新增，需与主链保持一致 | 
ADD src/server/__tests__/matchOccupancy.test.ts:49 | OK 测试/覆盖新增，需与主链保持一致 |     it('isSupportedPlayerCount: 有显式 playerOptions 时按白名单校验', () => {
ADD src/server/__tests__/matchOccupancy.test.ts:50 | OK 测试/覆盖新增，需与主链保持一致 |         expect(isSupportedPlayerCount(2, 2, 4, [2, 4])).toBe(true);
ADD src/server/__tests__/matchOccupancy.test.ts:51 | OK 测试/覆盖新增，需与主链保持一致 |         expect(isSupportedPlayerCount(4, 2, 4, [2, 4])).toBe(true);
ADD src/server/__tests__/matchOccupancy.test.ts:52 | OK 测试/覆盖新增，需与主链保持一致 |         expect(isSupportedPlayerCount(3, 2, 4, [2, 4])).toBe(false);
ADD src/server/__tests__/matchOccupancy.test.ts:53 | OK 测试/覆盖新增，需与主链保持一致 |         expect(isSupportedPlayerCount(3, 2, 4, [2, 3, 4])).toBe(true);
ADD src/server/__tests__/matchOccupancy.test.ts:54 | OK 测试/覆盖新增，需与主链保持一致 |     });
ADD src/server/matchOccupancy.ts:16 | 注意 引擎/服务逻辑变更，需核对副作用 | 
ADD src/server/matchOccupancy.ts:17 | 注意 引擎/服务逻辑变更，需核对副作用 | export const areAllSeatsOccupied = (players?: Record<string, PlayerSeat> | null): boolean => {
ADD src/server/matchOccupancy.ts:18 | 注意 引擎/服务逻辑变更，需核对副作用 |     if (!players) return false;
ADD src/server/matchOccupancy.ts:19 | 注意 引擎/服务逻辑变更，需核对副作用 |     const seats = Object.values(players);
ADD src/server/matchOccupancy.ts:20 | 注意 引擎/服务逻辑变更，需核对副作用 |     return seats.length > 0 && seats.every(isSeatOccupied);
ADD src/server/matchOccupancy.ts:21 | 注意 引擎/服务逻辑变更，需核对副作用 | };
ADD src/server/matchOccupancy.ts:22 | 注意 引擎/服务逻辑变更，需核对副作用 | 
ADD src/server/matchOccupancy.ts:23 | 注意 引擎/服务逻辑变更，需核对副作用 | export const isSupportedPlayerCount = (
ADD src/server/matchOccupancy.ts:24 | 注意 引擎/服务逻辑变更，需核对副作用 |     numPlayers: number,
ADD src/server/matchOccupancy.ts:25 | 注意 引擎/服务逻辑变更，需核对副作用 |     minPlayers: number,
ADD src/server/matchOccupancy.ts:26 | 注意 引擎/服务逻辑变更，需核对副作用 |     maxPlayers: number,
ADD src/server/matchOccupancy.ts:27 | 注意 引擎/服务逻辑变更，需核对副作用 |     allowedPlayerCounts?: number[] | null,
ADD src/server/matchOccupancy.ts:28 | 注意 引擎/服务逻辑变更，需核对副作用 | ): boolean => {
ADD src/server/matchOccupancy.ts:29 | 注意 引擎/服务逻辑变更，需核对副作用 |     if (!Number.isInteger(numPlayers)) return false;
ADD src/server/matchOccupancy.ts:30 | 注意 引擎/服务逻辑变更，需核对副作用 |     if (allowedPlayerCounts && allowedPlayerCounts.length > 0) {
ADD src/server/matchOccupancy.ts:31 | 注意 引擎/服务逻辑变更，需核对副作用 |         return allowedPlayerCounts.includes(numPlayers);
ADD src/server/matchOccupancy.ts:32 | 注意 引擎/服务逻辑变更，需核对副作用 |     }
ADD src/server/matchOccupancy.ts:33 | 注意 引擎/服务逻辑变更，需核对副作用 |     return numPlayers >= minPlayers && numPlayers <= maxPlayers;
ADD src/server/matchOccupancy.ts:34 | 注意 引擎/服务逻辑变更，需核对副作用 | };
ADD task_plan.md:12 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Latest Update (2026-03-26)
ADD task_plan.md:13 | OK 文档/记录/证据，对运行逻辑无直接影响 | - Dice Throne 4人 / 2v2 攻击目标已完成“延后到 targetingRoll 再解析”的收口，OpenSpec `1.8` 已回填为 completed。
ADD task_plan.md:14 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 已修复 `targetingRoll -> defensiveRoll` 时唯一防御技能自动选择丢失的问题，避免进入防御阶段后报 `defense_ability_not_selected`。
ADD task_plan.md:15 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 已更新 4 人模式卡牌目标回归口径：测试先真实完成 `targetingRoll -> defensiveRoll`，不再依赖旧的“预写 defenderId”契约。
ADD task_plan.md:16 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 已补齐 2v2 队伍交替回合顺序：`getPlayerOrder/getNextPlayerId` 现在按“起始玩家所在队两手 → 敌队两手”轮转，同时 `Board.tsx` 顶部三窗继续使用 `getSeatingOrder`，避免 UI 顺序被 turn order 误带动。
ADD task_plan.md:17 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 已完成 OpenSpec 未勾选项审计并回填：`1.2`、`1.5`、`1.6`、`1.7`、`1.9`、`1.10`、`1.11`、`1.12`、`1.18` 已改为 completed；新增 4 人在线座位面板 E2E 后，`2.4` 也已完成。
ADD task_plan.md:18 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 当前仍待补的主要验证项是 `2.5-2.9`：目标交互、顶部三窗、目标面板、完整 2v2 主链路、同队响应窗口过滤。
ADD task_plan.md:19 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 当前验证结果：`flow.test.ts + rule-consistency.test.ts + boundaryEdgeCases.test.ts` 共 `149 passed`，`tsc --noEmit` 无输出。
ADD task_plan.md:264 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:265 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Addendum: 2026-03-25 Dice Throne 4 人/2v2 targetingRoll 目标选择收尾
ADD task_plan.md:266 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:267 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Goal
ADD task_plan.md:268 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 修复 4 人/2v2 模式下 `targetingRoll` 掷出 `5/6` 后，目标选择会重复创建交互并停留在 `targetingRoll` 的问题。
ADD task_plan.md:269 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 核对当前实现与测试口径，确认选择目标后的正确推进行为。
ADD task_plan.md:270 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:271 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Result
ADD task_plan.md:272 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 在 `src/games/dicethrone/domain/core-types.ts` 的 `PendingAttack` 上补充 `targetingSelectionResolved`，为目标选择建立稳定的“已完成”标记。
ADD task_plan.md:273 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 在 `src/games/dicethrone/domain/choiceEffects.ts` 中，`select-target:*` 选择后同时写回 `defenderId`、清理 `targetingSelectionPending`，并设置 `targetingSelectionResolved = true`。
ADD task_plan.md:274 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 在 `src/games/dicethrone/domain/reducer.ts` 与 `src/games/dicethrone/domain/systems.ts` 中，为 `targeting-roll` 的 `CHOICE_REQUESTED` 增加幂等保护；若目标选择已完成，则忽略重复请求。
ADD task_plan.md:275 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 在 `src/games/dicethrone/domain/flowHooks.ts` 中封住历史残留的 5/6 旧分支，确保选择目标后同一条命令链自动推进到 `defensiveRoll`。
ADD task_plan.md:276 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 更新 `src/games/dicethrone/__tests__/flow.test.ts`，将测试口径改为“选择目标后直接进入 `defensiveRoll`”。
ADD task_plan.md:277 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:278 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Validation
ADD task_plan.md:279 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/flow.test.ts -t "4 人模式 targetingRoll" --configLoader native`
ADD task_plan.md:280 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/flow.test.ts src/games/dicethrone/__tests__/rule-consistency.test.ts --configLoader native`
ADD task_plan.md:281 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `node D:\gongzuo\webgame\BoardGame\node_modules\typescript\lib\tsc.js --noEmit --pretty false`
ADD task_plan.md:282 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 结果：`109 passed`，`tsc` 无输出。
ADD task_plan.md:283 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:284 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Status
ADD task_plan.md:285 | OK 文档/记录/证据，对运行逻辑无直接影响 | - completed
ADD task_plan.md:286 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:287 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Addendum: 2026-03-28 DiceThrone 旧专项 E2E 收敛
ADD task_plan.md:288 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:289 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Goal
ADD task_plan.md:290 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 收敛 DiceThrone 玩家目标交互的旧专项 E2E 债务，避免 `simple-start` 已经拿到 12 条在线证据，但旧文件仍停留在 `No tests found`、旧 selector、旧流程口径。
ADD task_plan.md:291 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 保留一份仍有独立价值的共享交互 UI 契约 E2E，退役明显过时且与现役覆盖重复的旧专项文件。
ADD task_plan.md:292 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:293 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Plan
ADD task_plan.md:294 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 盘点 `dicethrone-status-interaction-complete.e2e.ts`、`dicethrone-status-removal.e2e.ts`、`dicethrone-status-interaction-cancel.e2e.ts`、`dicethrone-paladin-vengeance-select-player.e2e.ts` 的真实状态与保留价值。
ADD task_plan.md:295 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 将 `dicethrone-status-interaction-complete.e2e.ts` 升级为现役可运行的共享交互契约 E2E，并对齐当前 `dt-*` 选择器与 `sys.interaction.current` 包装结构。
ADD task_plan.md:296 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 正式退役 `dicethrone-status-removal.e2e.ts`、`dicethrone-status-interaction-cancel.e2e.ts`、`dicethrone-paladin-vengeance-select-player.e2e.ts`，同步清理 `playwright.config.ts` 中对应的 legacy ignore。
ADD task_plan.md:297 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 串行复跑 `dicethrone-status-interaction-complete.e2e.ts` 与 `dicethrone-simple-start.e2e.ts`，确认新套件已稳定通过；`simple-start` 则出现环境级 `skip / Vite 异常退出`，已登记为 runner 噪音而非代码回归。
ADD task_plan.md:298 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:299 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Validation
ADD task_plan.md:300 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `npm run test:e2e:ci:file -- e2e/dicethrone-status-interaction-complete.e2e.ts`
ADD task_plan.md:301 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts`
ADD task_plan.md:302 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player targeting roll: auto targets and choice owners stay correct in 2v2"`
ADD task_plan.md:303 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:304 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Status
ADD task_plan.md:305 | OK 文档/记录/证据，对运行逻辑无直接影响 | - completed
ADD task_plan.md:306 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:307 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Addendum: 2026-03-27 DiceThrone 联机导航重试与四宫格在线证据恢复
ADD task_plan.md:308 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:309 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Goal
ADD task_plan.md:310 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 修掉把联机 E2E 伪装成 `skip` 的真 blocker，并补回四宫格版本 `Transfer Status` 的在线证据。
ADD task_plan.md:311 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 确认 `setupDTOnlineMatchWithPlayers()` 返回 `null` 时，问题究竟在接口、导航还是角色页等待。
ADD task_plan.md:312 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:313 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Result
ADD task_plan.md:314 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 手动探针已确认 `/games/dicethrone/create`、`/claim-seat`、`/join` 正常，服务端不是本轮 skip 根因。
ADD task_plan.md:315 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 已复现并定位 `page.goto(/play/dicethrone/match/...) -> net::ERR_INSUFFICIENT_RESOURCES`，这才是 helper 吞错后导致 `skip` 的真实来源。
ADD task_plan.md:316 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] `e2e/helpers/dicethrone.ts` 已为联机 match 页跳转加入瞬时错误重试。
ADD task_plan.md:317 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 4 人 `Transfer Status` 单用例重新恢复为 `1 passed`。
ADD task_plan.md:318 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 整份 `e2e/dicethrone-simple-start.e2e.ts` 已恢复为 `8 passed`。
ADD task_plan.md:319 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 最新 `06-four-player-transfer-token-target-selection.png` 已确认四宫格在线结构成立。
ADD task_plan.md:320 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:321 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Validation
ADD task_plan.md:322 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player transfer token: enemy token can be transferred to ally with stable target metadata"`
ADD task_plan.md:323 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `npm run test:e2e:ci -- e2e/dicethrone-simple-start.e2e.ts`
ADD task_plan.md:324 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:325 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Status
ADD task_plan.md:326 | OK 文档/记录/证据，对运行逻辑无直接影响 | - completed
ADD task_plan.md:327 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:328 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Addendum: 2026-03-26 DiceThrone 4 人目标交互四宫格修正
ADD task_plan.md:329 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:330 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Goal
ADD task_plan.md:331 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 按用户反馈把 `Transfer Status` 第二阶段从“来源摘要 + 3 目标卡”改成更一致的四宫格。
ADD task_plan.md:332 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 保持“先选一个玩家，再选另一个玩家”的统一语义，不再把第一个玩家降格成异类说明块。
ADD task_plan.md:333 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:334 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Result
ADD task_plan.md:335 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] `InteractionOverlay.tsx` 已改为第二阶段四宫格：来源玩家保留在原位，作为锁定禁用卡显示。
ADD task_plan.md:336 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 来源卡新增稳定标识 `dt-transfer-source-locked-<pid>`，其余目标卡继续使用 `dt-transfer-target-<pid>`。
ADD task_plan.md:337 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] `InteractionOverlay.test.tsx` 已更新为“四宫格 + 来源锁定”的结构断言。
ADD task_plan.md:338 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] TypeScript 与组件测试已通过。
ADD task_plan.md:339 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [ ] 新的在线四宫格截图尚未补到。
ADD task_plan.md:340 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:341 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Validation
ADD task_plan.md:342 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `node .\node_modules\typescript\lib\tsc.js --noEmit --pretty false`
ADD task_plan.md:343 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx --configLoader native`
ADD task_plan.md:344 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player transfer token: enemy token can be transferred to ally with stable target metadata"`：本轮结果为 `skipped`
ADD task_plan.md:345 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `npm run test:e2e:ci -- e2e/dicethrone-simple-start.e2e.ts`：本轮结果为 `8 skipped`
ADD task_plan.md:346 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:347 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Status
ADD task_plan.md:348 | OK 文档/记录/证据，对运行逻辑无直接影响 | - completed
ADD task_plan.md:349 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:350 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Addendum: 2026-03-26 DiceThrone 4 人目标交互 UI 精简
ADD task_plan.md:351 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:352 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Goal
ADD task_plan.md:353 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 处理用户对 4 人目标交互 UI 的直接反馈：去掉重复选中框，解决第二阶段像“六个方框”的视觉噪音。
ADD task_plan.md:354 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 在不改动目标选择语义的前提下，仅重构 `InteractionOverlay` 的信息层级与卡片呈现。
ADD task_plan.md:355 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:356 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Result
ADD task_plan.md:357 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] `selectTargetStatus` 第二阶段已改为“来源摘要 + 目标卡片”结构，不再保留第一阶段整排来源卡。
ADD task_plan.md:358 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 已选目标不再外挂额外勾选框，统一只保留卡片自身高亮。
ADD task_plan.md:359 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] `InteractionOverlay` 里重复的友敌样式分支已抽到单一映射函数，便于后续继续收口多人交互 UI。
ADD task_plan.md:360 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 组件测试已补上结构断言，防止后续把第一阶段卡片重新带回第二阶段。
ADD task_plan.md:361 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 在线 4 人 `Transfer Status` 回归已通过，并复核最新截图符合“3 个目标卡”的视觉预期。
ADD task_plan.md:362 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:363 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Validation
ADD task_plan.md:364 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx --configLoader native`
ADD task_plan.md:365 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `node .\node_modules\typescript\lib\tsc.js --noEmit --pretty false`
ADD task_plan.md:366 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player transfer token: enemy token can be transferred to ally with stable target metadata"`
ADD task_plan.md:367 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:368 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Status
ADD task_plan.md:369 | OK 文档/记录/证据，对运行逻辑无直接影响 | - completed
ADD task_plan.md:370 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:371 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Addendum: 2026-03-26 DiceThrone 面向多人能力审计边界
ADD task_plan.md:372 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:373 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Goal
ADD task_plan.md:374 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 在 Batch 1 已补完 `Transfer Status` 与 `Consecrate` 在线证据后，收敛剩余“面向多人目标”能力的优先级，避免继续把精力花在更简单路径上。
ADD task_plan.md:375 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:376 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Result
ADD task_plan.md:377 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 已确认当前高风险玩家目标入口主要集中在 `paladin-vengeance-select-player`、`paladin-consecrate`、`remove-status-1`、`remove-all-status`、`transfer-status`。
ADD task_plan.md:378 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 更复杂的 `transfer-status` 与 `paladin-consecrate` 已有 4 人在线证据。
ADD task_plan.md:379 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 当前决策：`remove-status-1/remove-all-status` 这类更简单移除交互暂不优先补在线 E2E。
ADD task_plan.md:380 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:381 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Status
ADD task_plan.md:382 | OK 文档/记录/证据，对运行逻辑无直接影响 | - completed
ADD task_plan.md:383 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:384 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Addendum: 2026-03-26 DiceThrone 4 人任意玩家授 token 在线证据补强
ADD task_plan.md:385 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:386 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Goal
ADD task_plan.md:387 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 在 Batch 1 已完成的基础上，再补一条更强的在线证据，证明“任意玩家授 token”不是只停留在规则层和通用验证层。
ADD task_plan.md:388 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 以 `Consecrate` 作为代表性多人能力，覆盖 `tokenGrantConfigs` 多 token 授予。
ADD task_plan.md:389 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:390 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Result
ADD task_plan.md:391 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 新增在线 4 人 `Consecrate` 用例，host 可把 `Protect/Retribution/Crit/Accuracy` 同时授予队友。
ADD task_plan.md:392 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 补充 `rule-consistency.test.ts` 中 `GRANT_TOKENS + tokenGrantConfigs` 的正向 4 人验证。
ADD task_plan.md:393 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 更新证据文档与截图，当前 `dicethrone-simple-start.e2e.ts` 已扩展为 `8 passed`。
ADD task_plan.md:394 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:395 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Validation
ADD task_plan.md:396 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/rule-consistency.test.ts --configLoader native`
ADD task_plan.md:397 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player grant tokens: Consecrate can grant four tokens to ally with stable target metadata"`
ADD task_plan.md:398 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `npm run test:e2e:ci -- e2e/dicethrone-simple-start.e2e.ts`
ADD task_plan.md:399 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:400 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Status
ADD task_plan.md:401 | OK 文档/记录/证据，对运行逻辑无直接影响 | - completed
ADD task_plan.md:402 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:403 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Addendum: 2026-03-26 DiceThrone 4 人玩家目标交互 Batch 1 收口
ADD task_plan.md:404 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:405 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Goal
ADD task_plan.md:406 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 收口 OpenSpec `update-dicethrone-4p-player-target-interactions` 的 Batch 1：任意玩家授 token、任意玩家移除状态、状态 / 可移除 token 转移。
ADD task_plan.md:407 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 先补共享验证层与 4 人玩家选择 UI，再用 1 条代表性在线 E2E 把 `Transfer Status` 升级到 4 人版本。
ADD task_plan.md:408 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:409 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Result
ADD task_plan.md:410 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] `commandValidation.ts` 已收紧 `GRANT_TOKENS` 候选目标校验，并修正 `TRANSFER_STATUS` 为兼容真实在线双阶段 UI。
ADD task_plan.md:411 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] `InteractionOverlay.tsx` 已为 4 人玩家卡片与状态 / token 徽章输出稳定 `data-testid` / `data-team-tone` 元信息。
ADD task_plan.md:412 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 组件测试与规则测试已补齐：既覆盖 4 人敌我标识，也覆盖 `TRANSFER_STATUS` 在 `selectStatus` 权威态下的真实在线验证路径。
ADD task_plan.md:413 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 在线 E2E 已新增 4 人 `Transfer Status` 用例：敌方 `Crit` token 可转给队友，第二阶段来源玩家被排除，host 与队友页权威状态一致。
ADD task_plan.md:414 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] OpenSpec `update-dicethrone-4p-player-target-interactions/tasks.md` 已全部回填为 completed。
ADD task_plan.md:415 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:416 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Validation
ADD task_plan.md:417 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `node .\node_modules\typescript\lib\tsc.js --noEmit --pretty false`
ADD task_plan.md:418 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx src/games/dicethrone/__tests__/rule-consistency.test.ts --configLoader native`
ADD task_plan.md:419 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player transfer token: enemy token can be transferred to ally with stable target metadata"`
ADD task_plan.md:420 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `npm run test:e2e:ci -- e2e/dicethrone-simple-start.e2e.ts`
ADD task_plan.md:421 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:422 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Status
ADD task_plan.md:423 | OK 文档/记录/证据，对运行逻辑无直接影响 | - completed
ADD task_plan.md:424 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:425 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Addendum: 2026-03-26 DiceThrone 4 人玩家目标交互专项审计
ADD task_plan.md:426 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:427 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Goal
ADD task_plan.md:428 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 在 2v2 核心规则收口后，单独审计并补齐“面向玩家目标”的多人能力与交互。
ADD task_plan.md:429 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 采用新的 OpenSpec change 分批推进，避免继续污染已完成的 `add-dicethrone-2v2-team-mode`。
ADD task_plan.md:430 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:431 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Batch Strategy
ADD task_plan.md:432 | OK 文档/记录/证据，对运行逻辑无直接影响 | - Batch 1：任意玩家授 token、任意玩家移除状态、状态 / 可移除 token 转移。
ADD task_plan.md:433 | OK 文档/记录/证据，对运行逻辑无直接影响 | - Batch 2：其余基于 `selectPlayer` / `targetPlayerIds` 的多人技能与卡牌。
ADD task_plan.md:434 | OK 文档/记录/证据，对运行逻辑无直接影响 | - Batch 3：需要额外 UI/动画/特殊交互语义的长尾能力。
ADD task_plan.md:435 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:436 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Current Findings
ADD task_plan.md:437 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `customActions/common.ts` 与 `customActions/paladin.ts` 已经把多名玩家候选扩为 `Object.keys(state.players)`，说明共享入口并非完全 2 人写死。
ADD task_plan.md:438 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `InteractionOverlay.test.tsx` 与 `dicethrone-paladin-vengeance-select-player.e2e.ts` 仍主要按 `['0','1']` 与“自己/对手”两选项口径验证，不能证明 4 人版本正确。
ADD task_plan.md:439 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `validateGrantTokens` / `validateTransferStatus` 目前只校验“存在 pendingInteraction + playerId 匹配”，验证层过宽，需要纳入第一批高风险收口。
ADD task_plan.md:440 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:441 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Active Change
ADD task_plan.md:442 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `update-dicethrone-4p-player-target-interactions`
ADD task_plan.md:443 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:444 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Status
ADD task_plan.md:445 | OK 文档/记录/证据，对运行逻辑无直接影响 | - in_progress
ADD task_plan.md:446 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:447 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Addendum: 2026-03-25 Dice Throne 4人/2v2 targetingRoll 目标选择收尾（格式修正）
ADD task_plan.md:448 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:449 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Goal
ADD task_plan.md:450 | OK 文档/记录/证据，对运行逻辑无直接影响 | 修复 4 人/2v2 模式下 `targetingRoll` 掷出 `5/6` 后，目标选择会重复创建交互并停留在 `targetingRoll` 的问题；同时确认选择目标后的正确推进口径。
ADD task_plan.md:451 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:452 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Result
ADD task_plan.md:453 | OK 文档/记录/证据，对运行逻辑无直接影响 | 本轮收尾补上了 `pendingAttack.targetingSelectionResolved`，并在 `choiceEffects.ts`、`reducer.ts`、`systems.ts`、`flowHooks.ts` 上把目标选择完成态和重复 `CHOICE_REQUESTED` 的幂等保护接完整。`flow.test.ts` 也已同步改为“选择目标后直接进入 `defensiveRoll`”。
ADD task_plan.md:454 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:455 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Validation
ADD task_plan.md:456 | OK 文档/记录/证据，对运行逻辑无直接影响 | 已执行 `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/flow.test.ts -t "4 人模式 targetingRoll" --configLoader native`、`node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/flow.test.ts src/games/dicethrone/__tests__/rule-consistency.test.ts --configLoader native`、`node D:\gongzuo\webgame\BoardGame\node_modules\typescript\lib\tsc.js --noEmit --pretty false`。结果为 `109 passed`，`tsc` 无输出。
ADD task_plan.md:457 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:458 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Status
ADD task_plan.md:459 | OK 文档/记录/证据，对运行逻辑无直接影响 | completed
ADD task_plan.md:460 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:461 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Addendum: 2026-03-27 DiceThrone 2 人 Transfer Status 在线证据补齐
ADD task_plan.md:462 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:463 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Goal
ADD task_plan.md:464 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 确认共享 `InteractionOverlay` 改成“四宫格 + 锁定来源卡”后，2 人 `Transfer Status` 也同步吃到同一套 UI。
ADD task_plan.md:465 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 为 2 人联机场景补一条现役在线 E2E，不再只靠共享组件测试推断。
ADD task_plan.md:466 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:467 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Result
ADD task_plan.md:468 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 已确认 2 人与 4 人共用 `selectTargetStatus` 第二阶段渲染，2 人也会显示 `dt-transfer-source-locked-*` + `dt-transfer-target-*`。
ADD task_plan.md:469 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 已在 `e2e/dicethrone-simple-start.e2e.ts` 中新增 2 人 `Transfer Status` 在线用例。
ADD task_plan.md:470 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 直接 Playwright 探针已确认 `setupDTOnlineMatch()` 在当前服务环境下可以成功返回房间，不是 helper 完全失效。
ADD task_plan.md:471 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [ ] 现役 Playwright 运行链路里的 `skip` 根因尚未彻底收口。
ADD task_plan.md:472 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [ ] 2 人在线单用例通过与证据截图待补。
ADD task_plan.md:473 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:474 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Validation
ADD task_plan.md:475 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx --configLoader native`
ADD task_plan.md:476 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `node --import tsx -` 直接探针 `setupDTOnlineMatch()` 返回成功房间
ADD task_plan.md:477 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:478 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Status
ADD task_plan.md:479 | OK 文档/记录/证据，对运行逻辑无直接影响 | - in_progress
ADD task_plan.md:480 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:481 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Addendum: 2026-03-25 Dice Throne 4人/2v2 站位移动闭环与规范回填
ADD task_plan.md:482 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:483 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Goal
ADD task_plan.md:484 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 在已打通 `targetingRoll` 目标选择链路的基础上，补齐 4 人/2v2 开局前站位移动的最小可用闭环。
ADD task_plan.md:485 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 将本轮实现结果同步回 OpenSpec `tasks.md` 与 plan-with-files 三件套，避免实现进度只停留在代码层。
ADD task_plan.md:486 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:487 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Result
ADD task_plan.md:488 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 在领域层新增 `MOVE_SEAT` 命令与 `SEATING_MOVED` 事件，使用“移除玩家后按目标下标插入”的插入式站位模型更新 `seatingOrder`。
ADD task_plan.md:489 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 补齐站位校验：仅允许 `setup` 阶段、仅 4 人 team mode、仅房主操作、开始后锁定、目标下标必须合法、禁止移动到原位。
ADD task_plan.md:490 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 在 `SEATING_MOVED` reducer 中基于新 `seatingOrder` 重建 `teamIdByPlayerId`，确保左右对手与队伍归属随站位同步更新。
ADD task_plan.md:491 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 在选角界面右下区域接入站位面板：默认显示当前顺序，房主可“先选玩家，再点空位”，点已有玩家会给出本地提示，非房主只读。
ADD task_plan.md:492 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 顺手把此前 UI 已调用但领域层未打通的 `PLAYER_UNREADY` 完整接通。
ADD task_plan.md:493 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 同步更新 OpenSpec：已勾选 `1.3`、`1.4`、`1.13`、`2.1`、`2.2`。
ADD task_plan.md:494 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [ ] 手动走查类验证项（`2.4+`）仍未完成，本轮不冒进误勾。
ADD task_plan.md:495 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:496 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Validation
ADD task_plan.md:497 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `node D:\gongzuo\webgame\BoardGame\node_modules\typescript\lib\tsc.js --noEmit --pretty false`
ADD task_plan.md:498 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/flow.test.ts src/games/dicethrone/__tests__/rule-consistency.test.ts src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts --configLoader native`
ADD task_plan.md:499 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `openspec validate add-dicethrone-2v2-team-mode --strict --no-interactive`
ADD task_plan.md:500 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:501 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Status
ADD task_plan.md:502 | OK 文档/记录/证据，对运行逻辑无直接影响 | completed
ADD task_plan.md:503 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Addendum: 2026-03-25 Dice Throne 4人/2v2 验证补跑与收尾清理
ADD task_plan.md:504 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:505 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Goal
ADD task_plan.md:506 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 复核当前 worktree 中未提交的 Dice Throne 4 人/2v2 改动是否已达到可提交状态。
ADD task_plan.md:507 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 清理 `targetingRoll` 收尾中残留的明显死代码，避免把无效分支带入后续提交。
ADD task_plan.md:508 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:509 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Result
ADD task_plan.md:510 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 核对 `src/games/dicethrone/domain/flowHooks.ts`，确认 `targetingRoll` 的 5/6 分支里残留了一段 `if (true) { ... } else { ... }` 的死代码。
ADD task_plan.md:511 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 删除上述死代码，仅保留“目标已由选择交互写回后继续后续攻击流程”的真实路径。
ADD task_plan.md:512 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 重新执行 `node D:\gongzuo\webgame\BoardGame\node_modules\typescript\lib\tsc.js --noEmit --pretty false`，结果无输出。
ADD task_plan.md:513 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [ ] 在当前受限终端内重跑 Vitest 相关回归。
ADD task_plan.md:514 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:515 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Validation
ADD task_plan.md:516 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `node D:\gongzuo\webgame\BoardGame\node_modules\typescript\lib\tsc.js --noEmit --pretty false`
ADD task_plan.md:517 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:518 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Blocker
ADD task_plan.md:519 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 当前 Codex Windows 受限终端会在 Vitest 启动 worker / esbuild transform 时触发 `spawn EPERM`，默认 forks worker 与 `--pool threads --no-file-parallelism --maxWorkers 1` 两条路径都无法完成测试初始化，因此这轮无法在此环境内补跑 `flow.test.ts` / `rule-consistency.test.ts` / `boundaryEdgeCases.test.ts`。
ADD task_plan.md:520 | OK 文档/记录/证据，对运行逻辑无直接影响 | - Git 也因仓库 owner SID 与当前用户 SID 不同触发 `dubious ownership`；当前用 `git -c safe.directory=D:/gongzuo/webgame/BoardGame-wt-dicethrone-4p-team-mode ...` 绕过，未修改全局配置（`C:/Users/zhuagenbao/.gitconfig` 无写权限）。
ADD task_plan.md:521 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:522 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Status
ADD task_plan.md:523 | OK 文档/记录/证据，对运行逻辑无直接影响 | in_progress
ADD task_plan.md:524 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:525 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Addendum: 2026-03-25 Dice Throne 4人/2v2 验证 blocker 解除与整套回归
ADD task_plan.md:526 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:527 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Goal
ADD task_plan.md:528 | OK 文档/记录/证据，对运行逻辑无直接影响 | 确认当前 worktree 中的 Dice Throne 4 人/2v2 改动已经脱离此前误报的 Vitest `spawn EPERM` blocker，并补齐可提交级别的验证结论。
ADD task_plan.md:529 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:530 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Result
ADD task_plan.md:531 | OK 文档/记录/证据，对运行逻辑无直接影响 | 已重新跑通 4 人/2v2 `targetingRoll` 的 3 个核心回归、`tsc --noEmit`，以及整套 `npm run test:dicethrone`。当前结论是这批改动在本机环境可以正常执行 Vitest，不存在此前记录里的持续性测试阻塞。
ADD task_plan.md:532 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:533 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Validation
ADD task_plan.md:534 | OK 文档/记录/证据，对运行逻辑无直接影响 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/flow.test.ts src/games/dicethrone/__tests__/rule-consistency.test.ts src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts --configLoader native` 通过，结果为 `142 passed`。`node D:\gongzuo\webgame\BoardGame\node_modules\typescript\lib\tsc.js --noEmit --pretty false` 无输出。`npm run test:dicethrone` 通过，结果为 `96 passed file suites`、`1076 passed`、`3 skipped`。
ADD task_plan.md:535 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:536 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Status
ADD task_plan.md:537 | OK 文档/记录/证据，对运行逻辑无直接影响 | completed
ADD task_plan.md:538 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Addendum（2026-03-25）：DiceThrone 四人房服务端 / E2E 闭环
ADD task_plan.md:539 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:540 | OK 文档/记录/证据，对运行逻辑无直接影响 | > 当前 worktree：`D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode`
ADD task_plan.md:541 | OK 文档/记录/证据，对运行逻辑无直接影响 | > 下次继续时优先看这一节，不要先跳回下面历史任务。
ADD task_plan.md:542 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:543 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### 当前目标
ADD task_plan.md:544 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 收口 DiceThrone 四人 / 2v2 模式中与服务端建房、占座、加入、开局验证相关的实现与文档。
ADD task_plan.md:545 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 维护 OpenSpec `add-dicethrone-2v2-team-mode` 与 `planning-with-files` 三件套的最新状态。
ADD task_plan.md:546 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:547 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### 本轮已完成
ADD task_plan.md:548 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 重整 `e2e/helpers/dicethrone.ts`，清掉坏正则、乱码导致的语法错误与 `return` 后死代码。
ADD task_plan.md:549 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 重写 `e2e/dicethrone-simple-start.e2e.ts`，补齐 2 人与 4 人简单开局场景。
ADD task_plan.md:550 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 收紧服务端人数校验：有 `playerOptions` 时优先按白名单校验，DiceThrone 不再错误接受 3 人房。
ADD task_plan.md:551 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 抽出 `areAllSeatsOccupied()` 统一 waiting -> playing 判定，并补 `src/server/__tests__/matchOccupancy.test.ts`。
ADD task_plan.md:552 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 跑通 `node D:\gongzuo\webgame\BoardGame\node_modules\typescript\lib\tsc.js --noEmit --pretty false`。
ADD task_plan.md:553 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 跑通 `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player room: create claim-seat join and start successfully"`。
ADD task_plan.md:554 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 跑通 `npm run test:e2e:ci -- e2e/dicethrone-simple-start.e2e.ts`。
ADD task_plan.md:555 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 回填 OpenSpec `1.17` / `2.3`，并整理 `tasks.md` 格式。
ADD task_plan.md:556 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:557 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### 当前判断
ADD task_plan.md:558 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 服务端 4 人房的 `create -> claim-seat(host) -> join(guest1/2/3) -> status=playing` 闭环已被自动化验证覆盖。
ADD task_plan.md:559 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 当前 blocker 已从“E2E helper 语法损坏”转为“剩余 2v2 规则/战斗逻辑项尚未完成”。
ADD task_plan.md:560 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:561 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### 下一步
ADD task_plan.md:562 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 继续检查并推进 OpenSpec 仍未勾选的 `1.5-1.12`、`1.18`。
ADD task_plan.md:563 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 若要继续收口 UI / 交互链路，优先补 `2.4-2.9` 对应的手动走查或更细的 E2E。
ADD task_plan.md:564 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:565 | OK 文档/记录/证据，对运行逻辑无直接影响 | ---
ADD task_plan.md:566 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Addendum: 2026-03-26 DiceThrone 4 人 / 2v2 E2E 收口
ADD task_plan.md:567 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:568 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Goal
ADD task_plan.md:569 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 收口 OpenSpec `add-dicethrone-2v2-team-mode` 剩余验证项 `2.5-2.9`。
ADD task_plan.md:570 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 以现有 `e2e/dicethrone-simple-start.e2e.ts` 为唯一测试文件补齐 4 人 2v2 的目标交互、顶部三窗、目标面板、同队响应过滤、团队胜负 UI 证据。
ADD task_plan.md:571 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:572 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Result
ADD task_plan.md:573 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 在线 4 人顶部三窗链路已通过 E2E 断言，验证 `dt-top-header-1/2/3` 的 `data-team-tone` 与 `data-player-id`。
ADD task_plan.md:574 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] `Targeting Roll` 四个分支已通过 E2E 断言：`1/2` 自动锁左敌，`3/4` 自动锁右敌，`5` 由防守队选择，`6` 由进攻方选择。
ADD task_plan.md:575 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 目标面板截图时机已前移到面板可见时，证据截图真实展示 3 个纵向目标项。
ADD task_plan.md:576 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 同队响应过滤改为走稳定的“防守方确认掷骰后”链路，E2E 断言响应队列仅为 `['0']`，不会包含同队玩家 `2`。
ADD task_plan.md:577 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 2v2 主链路已通过 E2E 断言收口到团队胜负 UI，host 端显示 `Victory`，敌方端显示 `Defeat`。
ADD task_plan.md:578 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] OpenSpec `2.5-2.9` 已回填为 completed。
ADD task_plan.md:579 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:580 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Validation
ADD task_plan.md:581 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `node .\node_modules\typescript\lib\tsc.js --noEmit --pretty false`
ADD task_plan.md:582 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player 2v2 flow: response queue excludes teammate and defense chain reaches team victory UI"`
ADD task_plan.md:583 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `npm run test:e2e:ci -- e2e/dicethrone-simple-start.e2e.ts`
ADD task_plan.md:584 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:585 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Status
ADD task_plan.md:586 | OK 文档/记录/证据，对运行逻辑无直接影响 | - completed
ADD task_plan.md:587 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:588 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Addendum: 2026-03-27 DiceThrone 2 人联机 setup 顺序 / 直连游戏服修复
ADD task_plan.md:589 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:590 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Goal
ADD task_plan.md:591 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 把 2 人 `Transfer Status` 在线用例从“共享 UI 已改，但 Playwright 仍走 skip”推进到真实在线通过。
ADD task_plan.md:592 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 在不新建测试文件的前提下，补回 2 人第二阶段锁定来源卡的在线证据，并确认 helper 修复没有带坏 4 人主链路。
ADD task_plan.md:593 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:594 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Result
ADD task_plan.md:595 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 修正 `setupDTOnlineMatchWithPlayers()` 的联机时序：host 不再在房间未满员时提前等待选角页，而是等所有玩家都进入 match 页后再统一等待角色选择 UI。
ADD task_plan.md:596 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] `initContext()` 已支持显式 `gameServerBaseURL` override，DiceThrone 在线 helper 创建的浏览器上下文现在会把 `__FORCE_GAME_SERVER_URL__` 正确注入到 `20000`，不再出现 API 走 `20000`、浏览器页却连回 `18000` 的分叉。
ADD task_plan.md:597 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] `/test/*` 状态注入 helper 已改为优先跟随当前页面实际生效的 `__FORCE_GAME_SERVER_URL__`，避免 `get-state/inject-state` 继续打到错误端口。
ADD task_plan.md:598 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 2 人 `Transfer Status` 用例已补齐真实双阶段：先点第一阶段 `dt-status-effect-1-crit`，再断言第二阶段 `dt-transfer-source-locked-1` 与 `dt-transfer-target-0`。
ADD task_plan.md:599 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 2 人第二阶段在线截图已补充到证据文档。
ADD task_plan.md:600 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 已跑通显式 `6174/20000/21000` 环境下的 `dicethrone-simple-start.e2e.ts` 全文件回归，结果 `9 passed`。
ADD task_plan.md:601 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:602 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Validation
ADD task_plan.md:603 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `node .\node_modules\typescript\lib\tsc.js --noEmit --pretty false`
ADD task_plan.md:604 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `$env:PW_USE_DEV_SERVERS='true'; $env:PW_START_SERVERS='false'; $env:PW_HAS_EXPLICIT_TARGET='true'; $env:NODE_OPTIONS='--max-old-space-size=4096'; $env:VITE_DEV_PORT='6174'; $env:GAME_SERVER_PORT='20000'; $env:API_SERVER_PORT='21000'; node .\node_modules\@playwright\test\cli.js test e2e/dicethrone-simple-start.e2e.ts --grep "Online 2-player transfer token: transfer phase keeps locked source card and target card"`
ADD task_plan.md:605 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `$env:PW_USE_DEV_SERVERS='true'; $env:PW_START_SERVERS='false'; $env:PW_HAS_EXPLICIT_TARGET='true'; $env:NODE_OPTIONS='--max-old-space-size=4096'; $env:VITE_DEV_PORT='6174'; $env:GAME_SERVER_PORT='20000'; $env:API_SERVER_PORT='21000'; node .\node_modules\@playwright\test\cli.js test e2e/dicethrone-simple-start.e2e.ts --grep "Online 4-player transfer token: enemy token can be transferred to ally with stable target metadata"`
ADD task_plan.md:606 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `$env:PW_USE_DEV_SERVERS='true'; $env:PW_START_SERVERS='false'; $env:PW_HAS_EXPLICIT_TARGET='true'; $env:NODE_OPTIONS='--max-old-space-size=4096'; $env:VITE_DEV_PORT='6174'; $env:GAME_SERVER_PORT='20000'; $env:API_SERVER_PORT='21000'; node .\node_modules\@playwright\test\cli.js test e2e/dicethrone-simple-start.e2e.ts`
ADD task_plan.md:607 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:608 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Status
ADD task_plan.md:609 | OK 文档/记录/证据，对运行逻辑无直接影响 | - completed
ADD task_plan.md:610 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:611 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Addendum: 2026-03-27 DiceThrone remove-status 在线证据补齐
ADD task_plan.md:612 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:613 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Goal
ADD task_plan.md:614 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 把 `remove-status-1` 与 `remove-all-status` 从“已有规则层/组件层覆盖”推进到真实 4 人在线证据。
ADD task_plan.md:615 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 用默认 `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts` 口径证明 `dicethrone-simple-start.e2e.ts` 已扩展为完整的 11 条在线回归。
ADD task_plan.md:616 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:617 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Result
ADD task_plan.md:618 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] `remove-status-1` 用例已在 4 人在线场景中断言敌方 `Crit` 被清掉，且目标页权威态同步追平。
ADD task_plan.md:619 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] `remove-all-status` 用例已在 4 人在线场景中断言空目标禁用、敌方 `burn/crit` 被整组清空，且目标页权威态同步追平。
ADD task_plan.md:620 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 证据文档已补入 `08-four-player-remove-single-status-selection.png` 与 `09-four-player-remove-all-status-selection.png`。
ADD task_plan.md:621 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 默认整文件脚本已复跑为 `11 passed`，当前 `dicethrone-simple-start.e2e.ts` 覆盖 2 人 / 4 人 / 2v2 / 玩家目标交互主链路。
ADD task_plan.md:622 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:623 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Validation
ADD task_plan.md:624 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `node .\node_modules\typescript\lib\tsc.js --noEmit --pretty false`
ADD task_plan.md:625 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts`
ADD task_plan.md:626 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:627 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Status
ADD task_plan.md:628 | OK 文档/记录/证据，对运行逻辑无直接影响 | - completed
ADD task_plan.md:629 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:630 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Addendum: 2026-03-27 DiceThrone 玩家目标交互 Batch 1 spec 纠偏
ADD task_plan.md:631 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:632 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Goal
ADD task_plan.md:633 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 把 `update-dicethrone-4p-player-target-interactions` 的 spec 从“单一总括 requirement”纠正为真实的 Batch 1 requirement 集，避免把本轮范围误读成“所有多人玩家目标交互已全量审计”。
ADD task_plan.md:634 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 将 `Vengeance II` 这轮共享攻击流程修复与 4 人在线证据正式纳入 OpenSpec 与三件套。
ADD task_plan.md:635 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:636 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Result
ADD task_plan.md:637 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] `spec.md` 已拆成 4 个 Batch 1 requirement：任意玩家授 token、任意玩家移除状态、状态 / 可移除 token 转移、无单一敌方目标的无伤害技能流程兼容。
ADD task_plan.md:638 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] `tasks.md` 已回填 Batch 1 的真实实现与验证边界，明确纳入 `Transfer Status`、`Consecrate`、`Vengeance II`、`remove-status-1`、`remove-all-status`。
ADD task_plan.md:639 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] `evidence/dicethrone-simple-start-e2e-test.md` 已补入 4 人 `Vengeance II` 截图与分析，并将默认整文件覆盖更新为 12 条在线用例。
ADD task_plan.md:640 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] `findings.md` 已记录用户指出的 spec 边界问题，以及 `Vengeance II` 根因位于共享攻击流程而非单卡脚本。
ADD task_plan.md:641 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 已重新执行 OpenSpec / 规则回归 / 简单开局整文件 E2E，最终结果分别为 `valid`、`31 passed`、`12 passed`。
ADD task_plan.md:642 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 已修复当前 worktree 残缺的 `node_modules` 入口文件问题；`typescript` / `vitest` / `dotenv` / `playwright` 相关验证脚本恢复可执行。
ADD task_plan.md:643 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:644 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Validation
ADD task_plan.md:645 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `openspec validate update-dicethrone-4p-player-target-interactions --strict --no-interactive`
ADD task_plan.md:646 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/rule-consistency.test.ts --configLoader native`
ADD task_plan.md:647 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts`
ADD task_plan.md:648 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:649 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Status
ADD task_plan.md:650 | OK 文档/记录/证据，对运行逻辑无直接影响 | - completed
ADD task_plan.md:651 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:652 | OK 文档/记录/证据，对运行逻辑无直接影响 | ## Addendum: 2026-03-28 DiceThrone Batch 1 最终复核收口
ADD task_plan.md:653 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:654 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Goal
ADD task_plan.md:655 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 把 `update-dicethrone-4p-player-target-interactions` 从“文档与代码都已写完”推进到“当前 worktree 下验证命令也真实可执行且全绿”。
ADD task_plan.md:656 | OK 文档/记录/证据，对运行逻辑无直接影响 | - 收口 `Consecrate` 串跑时 ally 页权威态慢半拍导致的最后一个 E2E 抢跑问题。
ADD task_plan.md:657 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:658 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Result
ADD task_plan.md:659 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 当前 worktree 的依赖树已恢复到可执行状态，`typescript` / `vitest` / `dotenv` / `playwright` 相关入口不再缺失。
ADD task_plan.md:660 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] `scripts/infra/vitest-cli-safe.mjs` 已兼容新版 Vitest 包结构，规则回归命令恢复可执行。
ADD task_plan.md:661 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] `Consecrate` 用例已补齐 ally 页 token 追平等待，串跑时不再因多页广播慢半拍而误报失败。
ADD task_plan.md:662 | OK 文档/记录/证据，对运行逻辑无直接影响 | - [x] 已重新执行 `tsc`、OpenSpec、规则回归与 `simple-start` 整文件 E2E，最终结果分别为：无输出、`valid`、`31 passed`、`12 passed`。
ADD task_plan.md:663 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:664 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Validation
ADD task_plan.md:665 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `node .\node_modules\typescript\lib\tsc.js --noEmit --pretty false`
ADD task_plan.md:666 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `openspec validate update-dicethrone-4p-player-target-interactions --strict --no-interactive`
ADD task_plan.md:667 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/rule-consistency.test.ts --configLoader native`
ADD task_plan.md:668 | OK 文档/记录/证据，对运行逻辑无直接影响 | - `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts`
ADD task_plan.md:669 | OK 文档/记录/证据，对运行逻辑无直接影响 | 
ADD task_plan.md:670 | OK 文档/记录/证据，对运行逻辑无直接影响 | ### Status
ADD task_plan.md:671 | OK 文档/记录/证据，对运行逻辑无直接影响 | - completed
\n## 人工重点风险标注\n- 领域层新增 targetingRoll 但当时 commandValidation 未同步允许 targetingRoll 的 ROLL_DICE/CONFIRM_ROLL/TOGGLE_DIE_LOCK，导致 4 人流程 invalid_phase 回归。\n- 本次已在当前工作区修复（不属于该提交原始内容），详见修复记录。\n
