/**
 * SmashUp E2E 测试：幽灵 + 鬼屋弃牌 bug 修复验证
 * 
 * 测试场景：
 * 1. 打出幽灵到鬼屋基地
 * 2. 幽灵 onPlay 触发：弃一张手牌（可跳过）
 * 3. 鬼屋 onMinionPlayed 触发：必须弃一张手牌
 * 4. 验证：第二次弃牌时不能选择第一次已弃掉的牌
 * 
 * 架构验证：optionsGenerator 动态生成选项，确保后续交互看到最新状态
 */

import { test, expect } from '@playwright/test';
import { 
    readCoreState, 
    applyCoreState,
    completeFactionSelection,
    waitForSmashUpUI,
} from './helpers/smashup';
import {
    initContext,
    getGameServerBaseURL,
    ensureGameServerAvailable,
    waitForMatchAvailable,
    seedMatchCredentials,
    joinMatchViaAPI,
} from './helpers/common';

const GAME_NAME = 'smashup';

/** 通过 API 创建 SmashUp 房间并注入凭据 */
async function createSmashUpRoomViaAPI(page: any): Promise<string | null> {
    try {
        const guestId = `su_e2e_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        await page.addInitScript(
            (id: string) => {
                localStorage.setItem('guest_id', id);
                sessionStorage.setItem('guest_id', id);
                document.cookie = `bg_guest_id=${encodeURIComponent(id)}; path=/; SameSite=Lax`;
            },
            guestId,
        );

        const base = getGameServerBaseURL();
        const res = await page.request.post(`${base}/games/${GAME_NAME}/create`, {
            data: { numPlayers: 2, setupData: { guestId, ownerKey: `guest:${guestId}`, ownerType: 'guest' } },
        });
        if (!res.ok()) return null;
        const resData = (await res.json().catch(() => null)) as { matchID?: string } | null;
        const matchID = resData?.matchID;
        if (!matchID) return null;

        const claimRes = await page.request.post(`${base}/games/${GAME_NAME}/${matchID}/claim-seat`, {
            data: { playerID: '0', playerName: 'Host-SU-E2E', guestId },
        });
        if (!claimRes.ok()) return null;
        const claimData = (await claimRes.json().catch(() => null)) as { playerCredentials?: string } | null;
        const credentials = claimData?.playerCredentials;
        if (!credentials) return null;

        await seedMatchCredentials(page, GAME_NAME, matchID, '0', credentials);
        return matchID;
    } catch {
        return null;
    }
}

test.describe('SmashUp: 幽灵 + 鬼屋弃牌修复', () => {
    test('打出幽灵到鬼屋基地，两次弃牌不能选择同一张牌', async ({ browser }, testInfo) => {
        test.setTimeout(90000); // 增加超时到 90 秒
        
        const baseURL = testInfo.project.use.baseURL as string | undefined;

        // 创建 Host context
        const hostContext = await browser.newContext({ baseURL });
        await initContext(hostContext, { storageKey: '__su_storage_reset' });
        const hostPage = await hostContext.newPage();

        await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
        await hostPage.waitForSelector('[data-game-id]', { timeout: 15000 }).catch(() => {});

        if (!(await ensureGameServerAvailable(hostPage))) {
            test.skip();
            return;
        }

        const matchId = await createSmashUpRoomViaAPI(hostPage);
        if (!matchId) {
            test.skip();
            return;
        }

        if (!(await waitForMatchAvailable(hostPage, GAME_NAME, matchId, 20000))) {
            await hostContext.close();
            test.skip();
            return;
        }

        await hostPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });

        // 创建 Guest context
        const guestContext = await browser.newContext({ baseURL });
        await initContext(guestContext, { storageKey: '__su_storage_reset_g' });
        const guestPage = await guestContext.newPage();

        await guestPage.goto('/', { waitUntil: 'domcontentloaded' });
        await guestPage.waitForSelector('[data-game-id]', { timeout: 15000 }).catch(() => {});

        const guestCredentials = await joinMatchViaAPI(guestPage, GAME_NAME, matchId, '1', 'Guest-SU-E2E');
        if (!guestCredentials) {
            await hostContext.close();
            await guestContext.close();
            test.skip();
            return;
        }
        await seedMatchCredentials(guestContext, GAME_NAME, matchId, '1', guestCredentials);
        await guestPage.goto(`/play/${GAME_NAME}/match/${matchId}?playerID=1`, { waitUntil: 'domcontentloaded' });

        try {
            // 完成派系选择
            await completeFactionSelection(hostPage, guestPage, [0, 1], [2, 3]);

            // 等待游戏棋盘加载
            await waitForSmashUpUI(hostPage);
            await hostPage.waitForTimeout(1000);

            // 注入测试状态：覆盖派系选择后的初始状态
            const testState = {
                phase: 'playCards',
                currentPlayerIndex: 0,
                players: {
                    '0': {
                        id: '0',
                        name: 'Player 1',
                        hand: [
                            { uid: 'ghost1', defId: 'ghost_ghost', type: 'minion', owner: '0' },
                            { uid: 'h1', defId: 'pirate_first_mate', type: 'minion', owner: '0' },
                            { uid: 'h2', defId: 'pirate_pirate_king', type: 'minion', owner: '0' },
                            { uid: 'h3', defId: 'pirate_swashbuckler', type: 'minion', owner: '0' },
                        ],
                        deck: [],
                        discard: [],
                        minionLimit: 1,
                        minionsPlayed: 0,
                        actionLimit: 1,
                        actionsPlayed: 0,
                        vp: 0,
                        factions: ['ghost', 'pirate'],
                    },
                    '1': {
                        id: '1',
                        name: 'Player 2',
                        hand: [],
                        deck: [],
                        discard: [],
                        minionLimit: 1,
                        minionsPlayed: 0,
                        actionLimit: 1,
                        actionsPlayed: 0,
                        vp: 0,
                        factions: ['ninja', 'dinosaur'],
                    },
                },
                bases: [
                    {
                        defId: 'base_haunted_house_al9000',
                        minions: [],
                        ongoingActions: [],
                    },
                    {
                        defId: 'base_the_homeworld',
                        minions: [],
                        ongoingActions: [],
                    },
                    {
                        defId: 'base_ninja_dojo',
                        minions: [],
                        ongoingActions: [],
                    },
                ],
                baseDeck: [],
            };

            await applyCoreState(hostPage, testState);
            await hostPage.waitForTimeout(500);

            // P0 打出幽灵到基地0
            await hostPage.click('[data-card-uid="ghost1"]');
            await hostPage.click('[data-base-index="0"]');

            // 等待第一个交互：幽灵弃牌
            await hostPage.waitForSelector('[data-testid="prompt-overlay"]', { timeout: 5000 });
            await hostPage.waitForTimeout(500);

            // 验证第一个交互的选项包含 h1, h2, h3
            const options1 = await hostPage.locator('[data-testid="prompt-overlay"] [data-option-id]').all();
            const options1Uids = await Promise.all(
                options1.map((opt: any) => opt.getAttribute('data-card-uid'))
            );
            console.log('第一个交互选项 UIDs:', options1Uids);
            expect(options1Uids.filter(Boolean).length).toBeGreaterThanOrEqual(3);

            // 选择弃掉 h1
            await hostPage.click('[data-option-id^="card-"][data-card-uid="h1"]');
            await hostPage.waitForTimeout(500);

            // 等待第二个交互：鬼屋弃牌
            await hostPage.waitForSelector('[data-testid="prompt-overlay"]', { timeout: 5000 });
            await hostPage.waitForTimeout(500);

            // 验证第二个交互的选项不包含 h1（已被弃掉）
            const options2 = await hostPage.locator('[data-testid="prompt-overlay"] [data-option-id]').all();
            const options2Uids = await Promise.all(
                options2.map((opt: any) => opt.getAttribute('data-card-uid'))
            );

            console.log('第二个交互选项 UIDs:', options2Uids);

            // 关键验证：h1 不应该在第二个交互的选项中
            expect(options2Uids).not.toContain('h1');
            expect(options2Uids).toContain('h2');
            expect(options2Uids).toContain('h3');

            // 选择弃掉 h2
            await hostPage.click('[data-option-id^="card-"][data-card-uid="h2"]');
            await hostPage.waitForTimeout(500);

            // 验证最终状态：h1 和 h2 在弃牌堆，h3 在手牌
            const finalState = await readCoreState(hostPage);
            const p0 = finalState.players['0'];

            expect(p0.hand.length).toBe(1);
            expect(p0.hand[0].uid).toBe('h3');

            expect(p0.discard.length).toBe(2);
            const discardUids = p0.discard.map((c: any) => c.uid);
            expect(discardUids).toContain('h1');
            expect(discardUids).toContain('h2');

            // 验证幽灵在基地上
            expect(finalState.bases[0].minions.length).toBe(1);
            expect(finalState.bases[0].minions[0].uid).toBe('ghost1');
        } finally {
            await hostContext.close().catch(() => {});
            await guestContext.close().catch(() => {});
        }
    });
});
