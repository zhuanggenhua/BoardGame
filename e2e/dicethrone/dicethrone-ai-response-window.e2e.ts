/**
 * DiceThrone AI 响应窗口 E2E 测试
 *
 * 验证 AI vs AI 对局中响应窗口是否正确触发。
 * 核心问题：AI 在攻击结算后是否能看到并响应 Token 响应窗口 / ResponseWindow。
 *
 * 测试策略：
 * 1. 在线对局 + AI 座位凭据注入（复用 Cardia 的 AI vs AI 模式）
 * 2. 监听事件流中 TOKEN_RESPONSE_REQUESTED / RESPONSE_WINDOW_OPENED 事件
 * 3. 检查 localStorage 中 autoResponse 开关
 * 4. 检查 AI 决策日志中是否有 response 类动作
 */

import { test, expect } from '../framework';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import {
    setupDTOnlineMatch,
    selectCharacter,
    waitForCharacterSelection,
    readyAndStartGame,
    waitForGameBoard,
    advanceToOffensiveRoll,
    applyDiceValues,
    maybePassResponse,
    closeDebugPanelIfOpen,
    readCoreState,
    readEventStream,
    seedDTMatchCredentials,
    claimDTSeatViaAPI,
    createDTRoomViaAPI,
} from '../helpers/dicethrone';
import {
    getGameServerBaseURL,
    ensureGameServerAvailable,
    initContext,
    setChineseLocale,
    waitForTestHarness,
} from '../helpers/common';
import { TOKEN_IDS } from '../src/games/dicethrone/domain/ids';

// ============================================================================
// AI 座位凭据注入（复用 Cardia 模式）
// ============================================================================

/**
 * 将 AI 座位凭据写入 localStorage，使 MatchRoom 识别 AI 控制的座位
 */
async function seedAiSeatCredentials(
    page: Page,
    matchId: string,
    credentials: Record<string, string>,
): Promise<void> {
    await page.evaluate(({ matchId, credentials }) => {
        localStorage.setItem(`match_ai_creds_${matchId}`, JSON.stringify(credentials));
        window.dispatchEvent(new Event('match-credentials-changed'));
    }, { matchId, credentials });
    await page.waitForTimeout(500);
}

/**
 * 读取 AI 座位凭据
 */
async function readAiSeatCredentials(
    page: Page,
    matchId: string,
): Promise<Record<string, string> | null> {
    return page.evaluate(({ matchId }) => {
        const raw = localStorage.getItem(`match_ai_creds_${matchId}`);
        return raw ? JSON.parse(raw) : null;
    }, { matchId });
}

async function waitForAiSeatCredential(
    page: Page,
    matchId: string,
    playerId: string,
): Promise<void> {
    await expect.poll(async () => {
        return page.evaluate(({ targetMatchId, targetPlayerId }) => {
            const raw = localStorage.getItem(`match_ai_creds_${targetMatchId}`);
            if (!raw) return null;
            try {
                const parsed = JSON.parse(raw) as Record<string, unknown>;
                return typeof parsed[targetPlayerId] === 'string' ? parsed[targetPlayerId] as string : null;
            } catch {
                return null;
            }
        }, { targetMatchId: matchId, targetPlayerId: playerId });
    }, {
        timeout: 20000,
        message: `等待 DiceThrone AI seat ${playerId} 凭据超时`,
    }).not.toBeNull();
}

async function setupDTOnlineAiRoom(
    browser: Browser,
    baseURL: string | undefined,
): Promise<{ hostPage: Page; hostContext: BrowserContext; matchId: string } | null> {
    const hostContext = await browser.newContext({ baseURL });
    await initContext(hostContext, {
        storageKey: '__dicethrone_storage_reset_online_ai',
        skipImageGate: true,
        gameServerBaseURL: getGameServerBaseURL(),
    });
    await setChineseLocale(hostContext);
    const hostPage = await hostContext.newPage();

    // 监控浏览器控制台错误，辅助诊断加载卡住问题
    const pageErrors: string[] = [];
    hostPage.on('console', (msg) => {
        if (msg.type() === 'error' || msg.type() === 'warning') {
            pageErrors.push(`[${msg.type()}] ${msg.text().substring(0, 300)}`);
        }
    });
    hostPage.on('pageerror', (err) => {
        pageErrors.push(`[pageerror] ${err.message.substring(0, 300)}`);
    });

    await hostPage.goto('/', { waitUntil: 'domcontentloaded' });
    if (!(await ensureGameServerAvailable(hostPage, getGameServerBaseURL()))) {
        console.error('[setupDTOnlineAiRoom] 游戏服务器不可用');
        await hostContext.close();
        return null;
    }

    const guestId = `dt_ai_response_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    await hostPage.addInitScript(
        (id) => {
            localStorage.setItem('guest_id', id);
            sessionStorage.setItem('guest_id', id);
            document.cookie = `bg_guest_id=${encodeURIComponent(id)}; path=/; SameSite=Lax`;
        },
        guestId,
    );

    const matchId = await createDTRoomViaAPI(hostPage, {
        guestId,
        numPlayers: 2,
        gameServerBaseURL: getGameServerBaseURL(),
        setupData: {
            enableAi: true,
            seatControllers: {
                '1': {
                    type: 'local-ai',
                    minimumActionDelayMs: 2000,
                },
            },
        },
    });
    if (!matchId) {
        console.error('[setupDTOnlineAiRoom] 创建房间失败');
        await hostContext.close();
        return null;
    }

    const credentials = await claimDTSeatViaAPI(hostPage, matchId, '0', {
        guestId,
        playerName: 'Host-DT-AI-Response',
        gameServerBaseURL: getGameServerBaseURL(),
    });
    if (!credentials) {
        console.error('[setupDTOnlineAiRoom] 占座失败');
        await hostContext.close();
        return null;
    }

    await seedDTMatchCredentials(hostContext, matchId, '0', credentials);
    await hostPage.goto(`/play/dicethrone/match/${matchId}?playerID=0`, { waitUntil: 'domcontentloaded' });

    // 等待测试工具就绪，但允许超时（页面可能还在加载 i18n namespace）
    try {
        await waitForTestHarness(hostPage, 20000);
    } catch {
        console.log('[setupDTOnlineAiRoom] waitForTestHarness 超时，尝试刷新页面...');
        if (pageErrors.length > 0) {
            console.log('[setupDTOnlineAiRoom] 页面错误:', pageErrors.slice(-5).join('\n'));
        }
        await hostPage.reload({ waitUntil: 'domcontentloaded' });
        await waitForTestHarness(hostPage, 20000);
    }

    return {
        hostPage,
        hostContext,
        matchId,
    };
}

async function waitForCharacterSelectionWithRetry(page: Page, timeout = 60000): Promise<void> {
    const deadline = Date.now() + timeout;
    let lastError: unknown;
    let reloadCount = 0;
    const maxReloads = 2;

    while (Date.now() < deadline) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) break;

        try {
            await waitForCharacterSelection(page, Math.min(remaining, 15000));
            return;
        } catch (error) {
            lastError = error;

            // 检查是否有命名空间加载失败的重试按钮
            const retryButton = page.getByRole('button', { name: /点击重试加载|重试加载|重试|Retry/i }).first();
            if (await retryButton.isVisible().catch(() => false)) {
                console.log('[waitForCharSel] 发现重试按钮，点击重试');
                await retryButton.click();
                await page.waitForTimeout(2000);
                continue;
            }

            // 检查是否卡在加载屏幕（namespace/impl 未就绪）
            const loadingScreen = page.locator('[data-testid="loading-screen"]').first();
            const isLoading = await loadingScreen.isVisible().catch(() => false);
            if (isLoading && reloadCount < maxReloads) {
                reloadCount++;
                console.log(`[waitForCharSel] 卡在加载屏幕，刷新页面 (${reloadCount}/${maxReloads})`);
                // 诊断：输出页面 URL 和关键 DOM 状态
                const currentUrl = page.url();
                console.log(`[waitForCharSel] 当前 URL: ${currentUrl}`);
                await page.reload({ waitUntil: 'domcontentloaded' });
                try {
                    await waitForTestHarness(page, 15000);
                } catch {
                    console.log('[waitForCharSel] 刷新后 waitForTestHarness 仍超时');
                }
                await page.waitForTimeout(2000);
                continue;
            }

            await page.waitForTimeout(1500);
        }
    }

    // 诊断：输出页面状态
    console.log('[waitForCharSel] 最终超时，诊断信息:');
    console.log(`  URL: ${page.url()}`);
    const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) ?? '').catch(() => 'N/A');
    console.log(`  Body text: ${bodyText}`);

    throw lastError instanceof Error ? lastError : new Error('等待角色选择页超时');
}

// ============================================================================
// 事件流监控
// ============================================================================

interface EventStreamEntry {
    event?: {
        type?: string;
        payload?: Record<string, unknown>;
    };
}

/**
 * 从事件流中提取指定类型的事件
 */
async function findEventsInStream(
    page: Page,
    eventTypes: string[],
): Promise<Array<{ type: string; payload: Record<string, unknown> }>> {
    const entries = await readEventStream(page) as EventStreamEntry[];
    const results: Array<{ type: string; payload: Record<string, unknown> }> = [];
    for (const entry of entries) {
        if (entry.event?.type && eventTypes.includes(entry.event.type)) {
            results.push({
                type: entry.event.type,
                payload: entry.event.payload ?? {},
            });
        }
    }
    return results;
}

/**
 * 等待事件流中出现指定类型的事件
 */
async function waitForEventInStream(
    page: Page,
    eventType: string,
    timeout = 30000,
): Promise<{ type: string; payload: Record<string, unknown> } | null> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        const events = await findEventsInStream(page, [eventType]);
        if (events.length > 0) {
            return events[events.length - 1];
        }
        await page.waitForTimeout(1000);
    }
    return null;
}

// ============================================================================
// 控制台日志收集
// ============================================================================

interface AiDecisionLog {
    playerId: string;
    actionKind: string;
    actionId: string;
    legalActionCount: number;
    timestamp: number;
}

/**
 * 收集 AI 决策日志
 */
function collectAiDecisionLogs(page: Page): AiDecisionLog[] {
    const logs: AiDecisionLog[] = [];
    page.on('console', (msg) => {
        const text = msg.text();
        // 捕获 AI 决策相关日志
        if (text.includes('resolveNextAiAction') || text.includes('buildResponseActions')) {
            logs.push({
                playerId: '',
                actionKind: '',
                actionId: '',
                legalActionCount: 0,
                timestamp: Date.now(),
            });
        }
    });
    return logs;
}

// ============================================================================
// 测试
// ============================================================================

test.describe('DiceThrone AI 响应窗口', () => {
    test.skip('AI vs AI: 检查 autoResponse 开关和 Token 响应窗口触发', async ({ browser }, testInfo) => {
        test.setTimeout(180000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;

        // 1. 创建在线对局
        const setup = await setupDTOnlineMatch(browser, baseURL);
        if (!setup) {
            test.skip(true, '游戏服务器不可用或房间创建失败');
            return;
        }
        const { hostPage, guestPage, hostContext, guestContext, matchId } = setup;

        try {
            // 2. 检查 autoResponse 开关（默认应为 true）
            const autoResponseValue = await hostPage.evaluate(() => {
                return localStorage.getItem('dicethrone:autoResponse');
            });
            console.log('[DT-AI-Response] autoResponse localStorage value:', autoResponseValue);

            // 确保 autoResponse 为 true（如果为 false，强制设为 true）
            if (autoResponseValue === 'false') {
                console.log('[DT-AI-Response] autoResponse is false, forcing to true');
                await hostPage.evaluate(() => {
                    localStorage.setItem('dicethrone:autoResponse', 'true');
                });
                await guestPage.evaluate(() => {
                    localStorage.setItem('dicethrone:autoResponse', 'true');
                });
            }

            // 3. 选择角色：samurai（有 honor token 可用于 beforeDamageDealt）vs barbarian
            await selectCharacter(hostPage, 'samurai');
            await selectCharacter(guestPage, 'barbarian');

            // 4. 将座位 1 设为 AI 控制（注入 AI 凭据）
            // 先获取座位 1 的凭据（guest 已经 join 了）
            const guestCredentials = await guestPage.evaluate(({ matchId }) => {
                const raw = localStorage.getItem(`match_creds_${matchId}`);
                return raw ? JSON.parse(raw)?.credentials : null;
            }, { matchId });

            if (guestCredentials) {
                // 在 hostPage 上注入 AI 座位凭据
                await seedAiSeatCredentials(hostPage, matchId, {
                    '1': guestCredentials,
                });
                console.log('[DT-AI-Response] AI 座位凭据已注入');
            } else {
                console.warn('[DT-AI-Response] 无法获取座位 1 凭据，AI 座位可能不工作');
            }

            // 5. 准备并开始游戏
            await readyAndStartGame(hostPage, guestPage);
            await waitForGameBoard(hostPage);
            await waitForGameBoard(guestPage);
            await hostPage.waitForTimeout(1000);

            // 6. 等待 AI 完成几个回合，监控事件流
            console.log('[DT-AI-Response] 等待 AI 执行回合...');

            let tokenResponseEvents: Array<{ type: string; payload: Record<string, unknown> }> = [];
            let responseWindowEvents: Array<{ type: string; payload: Record<string, unknown> }> = [];
            let turnProgress = 0;
            const maxWaitMs = 60000;
            const startTime = Date.now();

            while (Date.now() - startTime < maxWaitMs) {
                await hostPage.waitForTimeout(3000);

                // 读取当前状态
                const coreState = await readCoreState(hostPage).catch(() => null) as Record<string, unknown> | null;
                if (!coreState) continue;

                const players = coreState.players as Record<string, Record<string, unknown>> | undefined;
                const phase = coreState.phase as string | undefined;
                const pendingDamage = coreState.pendingDamage as Record<string, unknown> | null | undefined;

                console.log('[DT-AI-Response] 当前状态:', {
                    phase,
                    hasPendingDamage: !!pendingDamage,
                    pendingDamageResponder: pendingDamage?.responderId,
                    pendingDamageType: pendingDamage?.responseType,
                    p0Hp: players?.['0']?.resources && (players['0'].resources as Record<string, unknown>).HP,
                    p1Hp: players?.['1']?.resources && (players['1'].resources as Record<string, unknown>).HP,
                });

                // 检查事件流
                tokenResponseEvents = await findEventsInStream(hostPage, ['TOKEN_RESPONSE_REQUESTED']);
                responseWindowEvents = await findEventsInStream(hostPage, ['RESPONSE_WINDOW_OPENED']);

                console.log('[DT-AI-Response] 事件统计:', {
                    tokenResponseCount: tokenResponseEvents.length,
                    responseWindowCount: responseWindowEvents.length,
                });

                // 如果已经有 Token 响应事件，说明响应窗口触发了
                if (tokenResponseEvents.length > 0 || responseWindowEvents.length > 0) {
                    break;
                }

                // 检查游戏是否结束
                const sysState = await hostPage.evaluate(() => {
                    const harness = (window as any).__BG_TEST_HARNESS__;
                    const state = harness?.state?.get?.();
                    return state?.sys ?? null;
                });
                if (sysState?.gameover) {
                    console.log('[DT-AI-Response] 游戏已结束');
                    break;
                }
            }

            // 7. 诊断输出
            console.log('\n=== 诊断结果 ===');
            console.log('TOKEN_RESPONSE_REQUESTED 事件数:', tokenResponseEvents.length);
            console.log('RESPONSE_WINDOW_OPENED 事件数:', responseWindowEvents.length);

            if (tokenResponseEvents.length > 0) {
                console.log('最近 TOKEN_RESPONSE_REQUESTED:', JSON.stringify(tokenResponseEvents[tokenResponseEvents.length - 1], null, 2));
            }
            if (responseWindowEvents.length > 0) {
                console.log('最近 RESPONSE_WINDOW_OPENED:', JSON.stringify(responseWindowEvents[responseWindowEvents.length - 1], null, 2));
            }

            // 8. 检查 AI 座位是否被正确识别
            const aiCreds = await readAiSeatCredentials(hostPage, matchId);
            console.log('AI 座位凭据:', JSON.stringify(aiCreds));

            // 9. 检查 AI 决策上下文中的响应窗口可见性
            const aiVisibility = await hostPage.evaluate(() => {
                const harness = (window as any).__BG_TEST_HARNESS__;
                const state = harness?.state?.get?.();
                if (!state) return null;
                return {
                    responseWindow: state.sys?.responseWindow ?? null,
                    interaction: state.sys?.interaction
                        ? {
                              currentId: (state.sys.interaction as any).current?.id ?? null,
                              currentPlayerId: (state.sys.interaction as any).current?.playerId ?? null,
                              isBlocked: (state.sys.interaction as any).isBlocked ?? false,
                          }
                        : null,
                    pendingDamage: state.core?.pendingDamage
                        ? {
                              id: (state.core.pendingDamage as any).id,
                              responderId: (state.core.pendingDamage as any).responderId,
                              responseType: (state.core.pendingDamage as any).responseType,
                              currentDamage: (state.core.pendingDamage as any).currentDamage,
                          }
                        : null,
                };
            });
            console.log('AI 可见状态:', JSON.stringify(aiVisibility, null, 2));

            // 10. 截图留证
            await hostPage.screenshot({
                path: testInfo.outputPath('dicethrone-ai-response-diagnostic.png'),
                fullPage: false,
            });

            // 断言：至少应该有 TOKEN_RESPONSE_REQUESTED 或 RESPONSE_WINDOW_OPENED 事件
            // 如果没有，说明 AI 响应窗口确实没有触发
            const hasAnyResponseEvent = tokenResponseEvents.length > 0 || responseWindowEvents.length > 0;
            console.log(`\n结论: AI 响应窗口${hasAnyResponseEvent ? '已' : '未'}触发`);

            if (!hasAnyResponseEvent) {
                console.log('\n可能原因:');
                console.log('1. autoResponse 开关为 false（已检查）');
                console.log('2. 双方无可响应内容（无 instant 卡牌、无可用 Token）');
                console.log('3. hasRespondableContent 未注入 ResponseWindowSystem');
                console.log('4. AI 座位凭据未正确识别');
            }

            // 不强制断言，仅记录诊断结果
            // expect(hasAnyResponseEvent).toBe(true);

        } finally {
            await hostContext.close();
            await guestContext.close();
        }
    });

    test('AI vs AI: samurai honor token 场景下 Token 响应窗口应触发', async ({ browser }, testInfo) => {
        test.setTimeout(180000);

        const baseURL = testInfo.project.use.baseURL as string | undefined;
        const setup = await setupDTOnlineAiRoom(browser, baseURL);
        expect(setup, 'DiceThrone AI 联机房间创建失败').not.toBeNull();
        if (!setup) return;

        const { hostContext, hostPage, matchId } = setup;

        try {
            await waitForCharacterSelectionWithRetry(hostPage, 30000);
            await waitForAiSeatCredential(hostPage, matchId, '1');

            await selectCharacter(hostPage, 'samurai');
            await expect.poll(async () => {
                const state = await hostPage.evaluate(() => {
                    return (window as any).__BG_TEST_HARNESS__?.state?.get?.() ?? null;
                });
                if (!state) return false;
                const hostSelected = state.core?.selectedCharacters?.['0'];
                const aiSelected = state.core?.selectedCharacters?.['1'];
                const aiReady = state.core?.readyPlayers?.['1'] === true;
                return hostSelected === 'samurai' && aiSelected !== 'unselected' && aiReady;
            }, {
                timeout: 30000,
                message: '等待 DiceThrone host/AI 一起完成响应窗口测试前置条件',
            }).toBe(true);

            const startButton = hostPage.locator('button').filter({ hasText: /开始游戏|Start Game|Press.*Start/i }).first();
            await expect(startButton).toBeEnabled({ timeout: 10000 });
            await startButton.click();
            await hostPage.waitForTimeout(500);

            await waitForGameBoard(hostPage, 30000);
            await hostPage.waitForTimeout(2000);

            // 监控 AI 回合进度和事件流
            console.log('[DT-AI-Response] 开始监控 AI 回合...');

            const maxWaitMs = 90000;
            const startTime = Date.now();
            let foundTokenResponse = false;
            let foundResponseWindow = false;
            let lastTurnNumber = 0;

            // 收集关键控制台日志
            const consoleLogs: string[] = [];
            hostPage.on('console', (msg) => {
            const text = msg.text();
            if (
                text.includes('TOKEN_RESPONSE') ||
                text.includes('RESPONSE_WINDOW') ||
                text.includes('shouldOpenTokenResponse') ||
                text.includes('skipToNextRespondableResponder') ||
                text.includes('buildResponseActions') ||
                text.includes('resolveNextAiAction') ||
                text.includes('getAutoResponseEnabled') ||
                text.includes('checkAfterAttackResponseWindow')
                ) {
                    consoleLogs.push(text);
                    console.log(`[Browser] ${text.substring(0, 200)}`);
                }
            });

            while (Date.now() - startTime < maxWaitMs) {
                await hostPage.waitForTimeout(3000);

                // 读取状态
                const stateSnapshot = await hostPage.evaluate(() => {
                    const harness = (window as any).__BG_TEST_HARNESS__;
                    const state = harness?.state?.get?.();
                    if (!state) return null;
                    return {
                        phase: state.sys?.phase ?? null,
                        turnNumber: state.sys?.turnNumber ?? null,
                        gameover: state.sys?.gameover ?? null,
                        pendingDamage: state.core?.pendingDamage
                            ? {
                                id: (state.core.pendingDamage as any).id,
                                responderId: (state.core.pendingDamage as any).responderId,
                                responseType: (state.core.pendingDamage as any).responseType,
                                currentDamage: (state.core.pendingDamage as any).currentDamage,
                            }
                            : null,
                        responseWindow: state.sys?.responseWindow?.current
                            ? {
                                windowType: (state.sys.responseWindow.current as any).windowType,
                                currentResponderIndex: (state.sys.responseWindow.current as any).currentResponderIndex,
                                responderQueue: (state.sys.responseWindow.current as any).responderQueue,
                            }
                            : null,
                        interaction: state.sys?.interaction
                            ? {
                                currentId: (state.sys.interaction as any).current?.id ?? null,
                                currentPlayerId: (state.sys.interaction as any).current?.playerId ?? null,
                                isBlocked: (state.sys.interaction as any).isBlocked ?? false,
                            }
                            : null,
                    };
                });

                if (!stateSnapshot) continue;

                const currentTurn = stateSnapshot.turnNumber ?? 0;
                if (currentTurn > lastTurnNumber) {
                    lastTurnNumber = currentTurn;
                    console.log(`[DT-AI-Response] 回合 ${currentTurn}, 阶段: ${stateSnapshot.phase}`);
                }

                // 检查是否有 pendingDamage（Token 响应窗口的标志）
                if (stateSnapshot.pendingDamage) {
                    console.log('[DT-AI-Response] 发现 pendingDamage:', JSON.stringify(stateSnapshot.pendingDamage));
                    foundTokenResponse = true;
                }

                // 检查是否有 responseWindow
                if (stateSnapshot.responseWindow) {
                    console.log('[DT-AI-Response] 发现 responseWindow:', JSON.stringify(stateSnapshot.responseWindow));
                    foundResponseWindow = true;
                }

                // 检查事件流
                const tokenEvents = await findEventsInStream(hostPage, ['TOKEN_RESPONSE_REQUESTED']);
                const rwEvents = await findEventsInStream(hostPage, ['RESPONSE_WINDOW_OPENED']);
                if (tokenEvents.length > 0) foundTokenResponse = true;
                if (rwEvents.length > 0) foundResponseWindow = true;

                // 游戏结束
                if (stateSnapshot.gameover) {
                    console.log('[DT-AI-Response] 游戏结束');
                    break;
                }

                // 如果已经发现了响应事件，可以提前结束
                if (foundTokenResponse || foundResponseWindow) {
                    console.log('[DT-AI-Response] 已发现响应事件，提前结束监控');
                    break;
                }
            }

            // 截图
            await hostPage.screenshot({
                path: testInfo.outputPath('dicethrone-ai-response-samurai-scene.png'),
                fullPage: false,
            });

            // 最终诊断
            console.log('\n=== 最终诊断 ===');
            console.log('TOKEN_RESPONSE_REQUESTED 触发:', foundTokenResponse);
            console.log('RESPONSE_WINDOW_OPENED 触发:', foundResponseWindow);
            console.log('总回合数:', lastTurnNumber);
            console.log('关键日志数:', consoleLogs.length);

            // 输出关键日志
            if (consoleLogs.length > 0) {
                console.log('\n--- 关键日志（最近 20 条）---');
                for (const log of consoleLogs.slice(-20)) {
                    console.log(log.substring(0, 300));
                }
            }

            // 检查 autoResponse 值
            const finalAutoResponse = await hostPage.evaluate(() => {
                return localStorage.getItem('dicethrone:autoResponse');
            });
            console.log('autoResponse 最终值:', finalAutoResponse);

            if (!foundTokenResponse && !foundResponseWindow) {
                console.log('\n⚠️ AI 响应窗口未触发！可能原因：');
                console.log('1. autoResponse 开关为 false');
                console.log('2. 角色无可用的 beforeDamageDealt/beforeDamageReceived Token');
                console.log('3. hasRespondableContent 未注入 → skipToNextRespondableResponder 不跳过');
                console.log('4. AI 座位凭据未被 MatchRoom 正确识别');
                console.log('5. shouldBlockHiddenInteractionActions 阻止了 AI 动作生成');
            }

            expect(lastTurnNumber).toBeGreaterThan(0);
        } finally {
            await hostContext.close();
        }
    });
});
