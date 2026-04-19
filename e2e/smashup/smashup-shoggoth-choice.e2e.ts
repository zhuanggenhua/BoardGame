/**
 * 大杀四方 - 修格斯（Shoggoth）消灭随从选择权 E2E 测试
 *
 * 卡牌描述：
 * "你只能将这张卡打出到你至少拥有6点力量的基地。
 *  每位其他玩家可以抽一张疯狂卡。
 *  消灭每个没这样做的玩家在这个基地的一个随从。"
 *
 * 关键点：当对手拒绝抽疯狂卡时，由修格斯的控制者（而非系统自动）选择消灭对方的哪个随从。
 */

import { test, expect } from '@playwright/test';
import {
    setupSUOnlineMatch,
    readFullState,
    applyCoreStateDirect,
    closeDebugPanel,
    waitForHandArea,
    clickHandCard,
    waitForPrompt,
    clickPromptOptionByText,
    makeCard,
    makeMinion,
    waitForMinionSelect,
    isMinionSelectMode,
    clickHighlightedMinionByIndex,
    type SUMatchSetup,
} from './smashup-debug-helpers';

/** 等待随从部署模式的基地高亮（ring-green-400） */
async function waitForDeployBaseSelect(page: import('@playwright/test').Page, timeout = 10000) {
    await page.waitForFunction(
        () => document.querySelectorAll('[class*="ring-green-400"]').length > 0,
        { timeout },
    );
}

/** 点击部署模式下高亮的基地 */
async function clickDeployBase(page: import('@playwright/test').Page, index = 0) {
    await page.evaluate((idx) => {
        const bases = document.querySelectorAll('[class*="ring-green-400"]');
        if (bases[idx]) (bases[idx] as HTMLElement).click();
    }, index);
    await page.waitForTimeout(500);
}

test.describe('SmashUp 修格斯消灭随从选择权', () => {
    test.setTimeout(180000);

    let setup: SUMatchSetup | null = null;

    test.afterEach(async () => {
        if (setup) {
            await setup.hostContext.close().catch(() => {});
            await setup.guestContext.close().catch(() => {});
            setup = null;
        }
    });

    test('对手拒绝抽疯狂卡时，修格斯控制者选择消灭对方哪个随从', async ({ browser, baseURL }, testInfo) => {
        // 创建联机对局：P0 选 elder_things + aliens，P1 选 pirates + ninjas
        setup = await setupSUOnlineMatch(browser, baseURL, ['elder_things', 'pirates', 'ninjas', 'aliens']);
        if (!setup) {
            test.skip(true, '游戏服务器不可用');
            return;
        }

        const { hostPage, guestPage } = setup;
        await waitForHandArea(hostPage);
        await waitForHandArea(guestPage);

        // 读取状态并注入测试场景
        const fullState = await readFullState(hostPage);
        const core = (fullState.core ?? fullState) as Record<string, unknown>;
        const players = core.players as Record<string, Record<string, unknown>>;
        const turnOrder = core.turnOrder as string[];

        // 确保 P0 是当前玩家
        core.currentPlayerIndex = 0;
        const hostPid = turnOrder[0];
        const guestPid = turnOrder[1];
        const hostPlayer = players[hostPid];

        const nextUid = (core.nextUid as number) ?? 100;

        // P0 手牌：修格斯
        const hostHand = hostPlayer.hand as any[];
        hostHand.length = 0;
        hostHand.push(makeCard(`card_${nextUid}`, 'elder_thing_shoggoth', 'minion', hostPid));

        // 基地0：P0 有一个 6 力量随从（满足修格斯打出条件），P1 有两个随从（力量不同）
        // 重要：必须使用高 breakpoint 的基地，否则打出修格斯后总力量(6+2+3+7=18)可能超过 breakpoint 触发记分
        const bases = core.bases as any[];
        bases[0].defId = 'base_factory'; // breakpoint=25，确保不会触发记分
        bases[0].minions = [
            makeMinion(`m_${nextUid + 1}`, 'alien_supreme_overlord', hostPid, hostPid, 6),
            makeMinion(`m_${nextUid + 2}`, 'pirate_first_mate', guestPid, guestPid, 2),
            makeMinion(`m_${nextUid + 3}`, 'pirate_saucy_wench', guestPid, guestPid, 3),
        ];
        bases[0].ongoingActions = []; // 清空持续行动卡，避免干扰
        // 清空其他基地的随从
        for (let i = 1; i < bases.length; i++) {
            bases[i].minions = [];
        }

        core.nextUid = nextUid + 10;
        hostPlayer.minionsPlayed = 0;
        hostPlayer.minionLimit = 1;

        await applyCoreStateDirect(hostPage, core);
        await closeDebugPanel(hostPage);
        await hostPage.waitForTimeout(2000);  // 增加等待时间，确保服务端同步

        // 验证状态注入后的随从数量
        const injectedState = await readFullState(hostPage);
        const injectedCore = (injectedState.core ?? injectedState) as Record<string, unknown>;
        const injectedBases = injectedCore.bases as any[];
        const injectedGuestMinions = injectedBases[0].minions.filter((m: any) => m.controller === guestPid);
        console.log('状态注入后，基地0上 P1 的随从数量:', injectedGuestMinions.length);
        console.log('状态注入后，基地0上 P1 的随从:', injectedGuestMinions.map((m: any) => m.defId));

        // 也在 guestPage 上验证状态同步
        const guestInjectedState = await readFullState(guestPage);
        const guestInjectedCore = (guestInjectedState.core ?? guestInjectedState) as Record<string, unknown>;
        const guestInjectedBases = guestInjectedCore.bases as any[];
        const guestInjectedGuestMinions = guestInjectedBases[0].minions.filter((m: any) => m.controller === guestPid);
        console.log('guestPage 状态注入后，基地0上 P1 的随从数量:', guestInjectedGuestMinions.length);
        console.log('guestPage 状态注入后，基地0上 P1 的随从:', guestInjectedGuestMinions.map((m: any) => m.defId));

        await hostPage.screenshot({ path: testInfo.outputPath('01-initial-state.png'), fullPage: true });

        // P0 打出修格斯
        await clickHandCard(hostPage, 0);
        await hostPage.waitForTimeout(500);

        // 选择基地打出（只有基地0满足条件）
        await waitForDeployBaseSelect(hostPage);
        await hostPage.screenshot({ path: testInfo.outputPath('02-base-select.png'), fullPage: true });
        await clickDeployBase(hostPage, 0);
        await hostPage.waitForTimeout(1500);

        await hostPage.screenshot({ path: testInfo.outputPath('03-shoggoth-played.png'), fullPage: true });

        // P1（guestPage）应该收到选择提示：抽疯狂卡或拒绝
        await waitForPrompt(guestPage);
        await guestPage.screenshot({ path: testInfo.outputPath('04-guest-madness-choice.png'), fullPage: true });

        // P1 选择拒绝（不抽疯狂卡）
        const declineResult = await clickPromptOptionByText(guestPage, /拒绝|Decline|不抽/i);
        expect(declineResult).toBe('clicked');
        await guestPage.waitForTimeout(2000);

        await guestPage.screenshot({ path: testInfo.outputPath('05-guest-declined.png'), fullPage: true });
        await hostPage.screenshot({ path: testInfo.outputPath('05b-host-after-guest-decline.png'), fullPage: true });

        // 检查当前状态：P1 的随从应该仍然有 2 个（等待 P0 选择消灭哪个）
        const midState = await readFullState(hostPage);
        const midCore = (midState.core ?? midState) as Record<string, unknown>;
        const midBases = midCore.bases as any[];
        const midGuestMinions = midBases[0].minions.filter((m: any) => m.controller === guestPid);
        console.log('P1 拒绝后，基地0上 P1 的随从数量:', midGuestMinions.length);
        console.log('P1 拒绝后，基地0上 P1 的随从:', midGuestMinions.map((m: any) => m.defId));
        expect(midGuestMinions.length).toBe(2);

        // 关键验证：P0（hostPage，修格斯控制者）应该看到高亮的随从选择界面
        // 而不是 PromptOverlay（因为选项包含 minionUid，Board.tsx 会隐藏 PromptOverlay 并高亮随从）
        await waitForMinionSelect(hostPage, 15000);
        await hostPage.screenshot({ path: testInfo.outputPath('06-host-destroy-choice.png'), fullPage: true });

        // 验证 P0 看到的是随从选择界面（高亮的随从）
        const hasMinionSelect = await isMinionSelectMode(hostPage);
        expect(hasMinionSelect).toBe(true);

        // P0 点击第二个高亮的随从（力量较高的 saucy_wench，力量3）
        // 这证明了选择权在 P0 手中
        await clickHighlightedMinionByIndex(hostPage, 1);
        await hostPage.waitForTimeout(1500);

        await hostPage.screenshot({ path: testInfo.outputPath('07-after-destroy.png'), fullPage: true });

        // 验证结果：P1 在基地0应该只剩一个随从
        const afterState = await readFullState(hostPage);
        const afterCore = (afterState.core ?? afterState) as Record<string, unknown>;
        const afterBases = afterCore.bases as any[];
        const guestMinionsOnBase0 = afterBases[0].minions.filter((m: any) => m.controller === guestPid);

        // P1 原本有 2 个随从，被消灭 1 个后应该剩 1 个
        expect(guestMinionsOnBase0.length).toBe(1);

        // 验证剩下的是力量较低的那个（first_mate，力量2）
        // 因为 P0 选择消灭了力量较高的 saucy_wench
        expect(guestMinionsOnBase0[0].defId).toBe('pirate_first_mate');
    });

    test('对手只有一个随从时，拒绝后直接消灭（无需选择）', async ({ browser, baseURL }, testInfo) => {
        setup = await setupSUOnlineMatch(browser, baseURL, ['elder_things', 'pirates', 'ninjas', 'aliens']);
        if (!setup) {
            test.skip(true, '游戏服务器不可用');
            return;
        }

        const { hostPage, guestPage } = setup;
        await waitForHandArea(hostPage);
        await waitForHandArea(guestPage);

        const fullState = await readFullState(hostPage);
        const core = (fullState.core ?? fullState) as Record<string, unknown>;
        const players = core.players as Record<string, Record<string, unknown>>;
        const turnOrder = core.turnOrder as string[];

        core.currentPlayerIndex = 0;
        const hostPid = turnOrder[0];
        const guestPid = turnOrder[1];
        const hostPlayer = players[hostPid];

        const nextUid = (core.nextUid as number) ?? 100;

        const hostHand = hostPlayer.hand as any[];
        hostHand.length = 0;
        hostHand.push(makeCard(`card_${nextUid}`, 'elder_thing_shoggoth', 'minion', hostPid));

        // P1 只有一个随从
        // 重要：必须使用高 breakpoint 的基地，否则打出修格斯后总力量可能超过 breakpoint 触发记分
        const bases = core.bases as any[];
        bases[0].defId = 'base_factory'; // breakpoint=25
        bases[0].minions = [
            makeMinion(`m_${nextUid + 1}`, 'alien_supreme_overlord', hostPid, hostPid, 6),
            makeMinion(`m_${nextUid + 2}`, 'pirate_first_mate', guestPid, guestPid, 2),
        ];
        bases[0].ongoingActions = [];
        for (let i = 1; i < bases.length; i++) {
            bases[i].minions = [];
        }

        core.nextUid = nextUid + 10;
        hostPlayer.minionsPlayed = 0;
        hostPlayer.minionLimit = 1;

        await applyCoreStateDirect(hostPage, core);
        await closeDebugPanel(hostPage);
        await hostPage.waitForTimeout(1000);

        // P0 打出修格斯
        await clickHandCard(hostPage, 0);
        await hostPage.waitForTimeout(500);
        await waitForDeployBaseSelect(hostPage);
        await clickDeployBase(hostPage, 0);
        await hostPage.waitForTimeout(1500);

        // P1 拒绝
        await waitForPrompt(guestPage);
        await clickPromptOptionByText(guestPage, /拒绝|Decline|不抽/i);
        await guestPage.waitForTimeout(1500);

        await hostPage.screenshot({ path: testInfo.outputPath('single-minion-after.png'), fullPage: true });

        // 只有一个随从时，应该直接消灭，P0 不需要选择
        // 验证 P1 的随从已被消灭
        const afterState = await readFullState(hostPage);
        const afterCore = (afterState.core ?? afterState) as Record<string, unknown>;
        const afterBases = afterCore.bases as any[];
        const guestMinionsOnBase0 = afterBases[0].minions.filter((m: any) => m.controller === guestPid);

        expect(guestMinionsOnBase0.length).toBe(0);
    });

    test('对手选择抽疯狂卡时，不消灭随从', async ({ browser, baseURL }, testInfo) => {
        setup = await setupSUOnlineMatch(browser, baseURL, ['elder_things', 'pirates', 'ninjas', 'aliens']);
        if (!setup) {
            test.skip(true, '游戏服务器不可用');
            return;
        }

        const { hostPage, guestPage } = setup;
        await waitForHandArea(hostPage);
        await waitForHandArea(guestPage);

        const fullState = await readFullState(hostPage);
        const core = (fullState.core ?? fullState) as Record<string, unknown>;
        const players = core.players as Record<string, Record<string, unknown>>;
        const turnOrder = core.turnOrder as string[];

        core.currentPlayerIndex = 0;
        const hostPid = turnOrder[0];
        const guestPid = turnOrder[1];
        const hostPlayer = players[hostPid];

        const nextUid = (core.nextUid as number) ?? 100;

        const hostHand = hostPlayer.hand as any[];
        hostHand.length = 0;
        hostHand.push(makeCard(`card_${nextUid}`, 'elder_thing_shoggoth', 'minion', hostPid));

        const bases = core.bases as any[];
        bases[0].defId = 'base_factory'; // breakpoint=25，确保不会触发记分
        bases[0].minions = [
            makeMinion(`m_${nextUid + 1}`, 'alien_supreme_overlord', hostPid, hostPid, 6),
            makeMinion(`m_${nextUid + 2}`, 'pirate_first_mate', guestPid, guestPid, 2),
            makeMinion(`m_${nextUid + 3}`, 'pirate_saucy_wench', guestPid, guestPid, 3),
        ];
        bases[0].ongoingActions = [];
        for (let i = 1; i < bases.length; i++) {
            bases[i].minions = [];
        }

        core.nextUid = nextUid + 10;
        hostPlayer.minionsPlayed = 0;
        hostPlayer.minionLimit = 1;

        await applyCoreStateDirect(hostPage, core);
        await closeDebugPanel(hostPage);
        await hostPage.waitForTimeout(1000);

        // P0 打出修格斯
        await clickHandCard(hostPage, 0);
        await hostPage.waitForTimeout(500);
        await waitForDeployBaseSelect(hostPage);
        await clickDeployBase(hostPage, 0);
        await hostPage.waitForTimeout(1500);

        // P1 选择抽疯狂卡
        await waitForPrompt(guestPage);
        await guestPage.screenshot({ path: testInfo.outputPath('draw-madness-choice.png'), fullPage: true });
        await clickPromptOptionByText(guestPage, /抽.*疯狂|Draw.*Madness/i);
        await guestPage.waitForTimeout(1500);

        await hostPage.screenshot({ path: testInfo.outputPath('draw-madness-after.png'), fullPage: true });

        // 验证 P1 的随从都还在
        const afterState = await readFullState(hostPage);
        const afterCore = (afterState.core ?? afterState) as Record<string, unknown>;
        const afterBases = afterCore.bases as any[];
        const guestMinionsOnBase0 = afterBases[0].minions.filter((m: any) => m.controller === guestPid);

        expect(guestMinionsOnBase0.length).toBe(2);
    });
});
