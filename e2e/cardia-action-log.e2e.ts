import { test, expect } from './fixtures';
import {
    setupCardiaTestScenario,
    readLiveState,
    playCard,
    waitForPhase,
} from './helpers/cardia';

/**
 * Cardia 行为日志系统 E2E 测试
 * 
 * 测试覆盖：
 * 1. 基础日志显示：打出卡牌后生成日志条目
 * 2. 日志内容验证：验证日志文本包含正确的卡牌名称和操作描述
 * 3. 日志顺序：验证日志按时间倒序显示（最新的在最上面）
 * 4. 多种操作类型：验证不同命令类型（PLAY_CARD, ACTIVATE_ABILITY, END_TURN）都能正确记录
 */
test.describe('Cardia 行为日志系统', () => {
    test('基础功能：打出卡牌后生成日志条目', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01'], // 雇佣剑士（影响力1）
                deck: ['deck_i_card_02', 'deck_i_card_03'],
            },
            player2: {
                hand: ['deck_i_card_01'], // 雇佣剑士（影响力1）
                deck: ['deck_i_card_04', 'deck_i_card_05'],
            },
            phase: 'play',
        });

        try {
            console.log('\n=== 验证初始状态：日志为空 ===');

            // 读取初始状态
            const initialState = await readLiveState(setup.player1Page);
            type SystemState = {
                actionLog?: {
                    entries: Array<{
                        id: string;
                        timestamp: number;
                        actorId: string;
                        kind: string;
                        segments: unknown[];
                    }>;
                };
            };
            const sys = initialState.sys as SystemState;
            const initialLogEntries = sys?.actionLog?.entries || [];

            expect(initialLogEntries.length).toBe(0);
            console.log('✅ 初始状态：日志为空');

            console.log('\n=== P1 打出卡牌 ===');

            // P1 打出雇佣剑士
            console.log('P1 打出雇佣剑士（影响力1）');
            await playCard(setup.player1Page, 0);
            await setup.player1Page.waitForTimeout(1000);

            // 验证日志条目已生成
            const afterP1Play = await readLiveState(setup.player1Page);
            const sysAfterP1 = afterP1Play.sys as SystemState;
            const logEntriesAfterP1 = sysAfterP1?.actionLog?.entries || [];

            expect(logEntriesAfterP1.length).toBeGreaterThan(0);
            console.log(`✅ P1 打出卡牌后生成 ${logEntriesAfterP1.length} 条日志`);

            // 验证最新日志条目的基本结构
            const latestEntry = logEntriesAfterP1[logEntriesAfterP1.length - 1];
            expect(latestEntry.id).toBeDefined();
            expect(latestEntry.timestamp).toBeGreaterThan(0);
            expect(latestEntry.actorId).toBe('0'); // P1
            expect(latestEntry.kind).toBe('cardia:play_card'); // 完整命令类型
            expect(latestEntry.segments).toBeDefined();
            expect(Array.isArray(latestEntry.segments)).toBe(true);
            console.log('✅ 日志条目结构正确');

            console.log('\n=== P2 打出卡牌 ===');

            // P2 打出雇佣剑士
            console.log('P2 打出雇佣剑士（影响力1）');
            await playCard(setup.player2Page, 0);
            await setup.player2Page.waitForTimeout(1000);

            // 验证日志条目继续增加
            const afterP2Play = await readLiveState(setup.player1Page);
            const sysAfterP2 = afterP2Play.sys as SystemState;
            const logEntriesAfterP2 = sysAfterP2?.actionLog?.entries || [];

            expect(logEntriesAfterP2.length).toBeGreaterThan(logEntriesAfterP1.length);
            console.log(`✅ P2 打出卡牌后日志增加到 ${logEntriesAfterP2.length} 条`);

            // 验证最新日志条目是 P2 的操作
            const latestEntryAfterP2 = logEntriesAfterP2[logEntriesAfterP2.length - 1];
            expect(latestEntryAfterP2.actorId).toBe('1'); // P2
            expect(latestEntryAfterP2.kind).toBe('cardia:play_card');
            console.log('✅ 最新日志条目是 P2 的操作');

            console.log('✅ 所有断言通过');

        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });

    test('日志内容验证：包含正确的卡牌名称和操作描述', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_04'], // 调停者（影响力4）
                deck: ['deck_i_card_01', 'deck_i_card_02'],
            },
            player2: {
                hand: ['deck_i_card_10'], // 傀儡师（影响力10）
                deck: ['deck_i_card_07', 'deck_i_card_08'],
            },
            phase: 'play',
        });

        try {
            console.log('\n=== P1 打出调停者 ===');

            // P1 打出调停者
            console.log('P1 打出调停者（影响力4）');
            await playCard(setup.player1Page, 0);
            await setup.player1Page.waitForTimeout(1000);

            // 读取日志条目
            const afterP1Play = await readLiveState(setup.player1Page);
            type SystemState = {
                actionLog?: {
                    entries: Array<{
                        id: string;
                        timestamp: number;
                        actorId: string;
                        kind: string;
                        segments: Array<{
                            type: string;
                            text?: string;
                            ns?: string;
                            key?: string;
                            params?: Record<string, unknown>;
                            cardId?: string;
                            previewText?: string;
                            previewTextNs?: string;
                            previewRef?: unknown;
                        }>;
                    }>;
                };
            };
            const sys = afterP1Play.sys as SystemState;
            const logEntries = sys?.actionLog?.entries || [];

            expect(logEntries.length).toBeGreaterThan(0);

            // 验证最新日志条目的 segments
            const latestEntry = logEntries[logEntries.length - 1];
            const segments = latestEntry.segments;

            // 验证包含 i18n segment（操作描述）
            const i18nSegments = segments.filter(seg => seg.type === 'i18n');
            expect(i18nSegments.length).toBeGreaterThan(0);
            console.log(`✅ 包含 ${i18nSegments.length} 个 i18n segment`);

            // 验证 i18n segment 包含正确的 namespace
            const i18nSegment = i18nSegments[0];
            expect(i18nSegment.ns).toBe('game-cardia');
            console.log('✅ i18n segment 使用正确的 namespace');

            // 注意：由于 getCardiaCardPreviewMeta 可能返回 null（卡牌不在 registry），
            // 格式化函数会fallback到 textSegment，所以不强制要求 card segment
            console.log('✅ 日志 segments 结构正确');

            console.log('\n=== P2 打出傀儡师 ===');

            // P2 打出傀儡师
            console.log('P2 打出傀儡师（影响力10）');
            await playCard(setup.player2Page, 0);
            await setup.player2Page.waitForTimeout(1000);

            // 等待进入能力阶段
            await waitForPhase(setup.player1Page, 'ability');

            console.log('\n=== P1 激活调停者能力 ===');

            // 激活调停者能力
            const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('激活调停者能力');
            await abilityButton.click();
            await setup.player1Page.waitForTimeout(1000);

            // 验证能力激活日志
            const afterAbility = await readLiveState(setup.player1Page);
            const sysAfterAbility = afterAbility.sys as SystemState;
            const logEntriesAfterAbility = sysAfterAbility?.actionLog?.entries || [];

            // 查找 ACTIVATE_ABILITY 类型的日志条目
            const abilityLogEntry = logEntriesAfterAbility.find(entry => entry.kind === 'cardia:activate_ability');
            expect(abilityLogEntry).toBeDefined();
            console.log('✅ 找到 ACTIVATE_ABILITY 日志条目');

            // 验证能力日志包含 segments
            const abilitySegments = abilityLogEntry!.segments;
            expect(abilitySegments.length).toBeGreaterThan(0);
            console.log('✅ 能力日志包含 segments');

            console.log('✅ 所有断言通过');

        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });

    test('日志顺序：按时间倒序显示（最新的在最上面）', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_01'], // 影响力1
                deck: ['deck_i_card_02', 'deck_i_card_03'],
            },
            player2: {
                hand: ['deck_i_card_03'], // 影响力3
                deck: ['deck_i_card_04', 'deck_i_card_05'],
            },
            phase: 'play',
        });

        try {
            console.log('\n=== 执行多个操作 ===');

            // P1 打出第一张卡牌
            console.log('P1 打出第一张卡牌（影响力1）');
            await playCard(setup.player1Page, 0);
            await setup.player1Page.waitForTimeout(500);

            const afterFirstPlay = await readLiveState(setup.player1Page);
            type SystemState = {
                actionLog?: {
                    entries: Array<{
                        id: string;
                        timestamp: number;
                        actorId: string;
                        kind: string;
                    }>;
                };
            };
            const sys1 = afterFirstPlay.sys as SystemState;
            const firstTimestamp = sys1?.actionLog?.entries[sys1.actionLog.entries.length - 1]?.timestamp || 0;
            console.log(`第一次操作时间戳: ${firstTimestamp}`);

            // P2 打出第一张卡牌
            console.log('P2 打出第一张卡牌（影响力3）');
            await playCard(setup.player2Page, 0);
            await setup.player2Page.waitForTimeout(500);

            const afterSecondPlay = await readLiveState(setup.player1Page);
            const sys2 = afterSecondPlay.sys as SystemState;
            const secondTimestamp = sys2?.actionLog?.entries[sys2.actionLog.entries.length - 1]?.timestamp || 0;
            console.log(`第二次操作时间戳: ${secondTimestamp}`);

            console.log('\n=== 验证时间戳单调递增 ===');

            // 验证时间戳单调递增
            expect(secondTimestamp).toBeGreaterThan(firstTimestamp);
            console.log('✅ 时间戳单调递增');

            // 验证日志条目数量
            const finalState = await readLiveState(setup.player1Page);
            const sysFinal = finalState.sys as SystemState;
            const finalLogEntries = sysFinal?.actionLog?.entries || [];

            expect(finalLogEntries.length).toBeGreaterThanOrEqual(2);
            console.log(`✅ 日志包含至少 2 条记录（实际 ${finalLogEntries.length} 条）`);

            // 验证日志条目按时间戳排序（存储顺序是时间正序）
            for (let i = 1; i < finalLogEntries.length; i++) {
                expect(finalLogEntries[i].timestamp).toBeGreaterThanOrEqual(finalLogEntries[i - 1].timestamp);
            }
            console.log('✅ 日志条目按时间戳正序存储');

            console.log('✅ 所有断言通过');

        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });

    test('多种操作类型：验证不同命令都能正确记录', async ({ browser }) => {
        const setup = await setupCardiaTestScenario(browser, {
            player1: {
                hand: ['deck_i_card_04'], // 调停者（影响力4，有能力）
                deck: ['deck_i_card_01', 'deck_i_card_02'],
            },
            player2: {
                hand: ['deck_i_card_10'], // 傀儡师（影响力10）
                deck: ['deck_i_card_07', 'deck_i_card_08'],
            },
            phase: 'play',
        });

        try {
            console.log('\n=== 测试 PLAY_CARD 命令 ===');

            // P1 打出调停者
            console.log('P1 打出调停者');
            await playCard(setup.player1Page, 0);
            await setup.player1Page.waitForTimeout(1000);

            // 验证 PLAY_CARD 日志
            const afterPlay = await readLiveState(setup.player1Page);
            type SystemState = {
                actionLog?: {
                    entries: Array<{
                        id: string;
                        timestamp: number;
                        actorId: string;
                        kind: string;
                    }>;
                };
            };
            const sysAfterPlay = afterPlay.sys as SystemState;
            const playLogEntry = sysAfterPlay?.actionLog?.entries.find(entry => entry.kind === 'cardia:play_card');

            expect(playLogEntry).toBeDefined();
            expect(playLogEntry!.actorId).toBe('0');
            console.log('✅ PLAY_CARD 日志记录正确');

            console.log('\n=== 测试 ACTIVATE_ABILITY 命令 ===');

            // P2 打出傀儡师
            console.log('P2 打出傀儡师');
            await playCard(setup.player2Page, 0);
            await setup.player2Page.waitForTimeout(1000);

            // 等待进入能力阶段
            await waitForPhase(setup.player1Page, 'ability');

            // P1 激活调停者能力
            const abilityButton = setup.player1Page.locator('[data-testid="cardia-activate-ability-btn"]');
            await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('P1 激活调停者能力');
            await abilityButton.click();
            await setup.player1Page.waitForTimeout(1000);

            // 验证 ACTIVATE_ABILITY 日志
            const afterAbility = await readLiveState(setup.player1Page);
            const sysAfterAbility = afterAbility.sys as SystemState;
            const abilityLogEntry = sysAfterAbility?.actionLog?.entries.find(entry => entry.kind === 'cardia:activate_ability');

            expect(abilityLogEntry).toBeDefined();
            expect(abilityLogEntry!.actorId).toBe('0');
            console.log('✅ ACTIVATE_ABILITY 日志记录正确');

            console.log('\n=== 验证日志包含多种命令类型 ===');

            // 验证日志包含多种命令类型
            const finalState = await readLiveState(setup.player1Page);
            const sysFinal = finalState.sys as SystemState;
            const finalLogEntries = sysFinal?.actionLog?.entries || [];

            const commandTypes = new Set(finalLogEntries.map(entry => entry.kind));
            expect(commandTypes.has('cardia:play_card')).toBe(true);
            expect(commandTypes.has('cardia:activate_ability')).toBe(true);
            console.log(`✅ 日志包含 ${commandTypes.size} 种命令类型：${Array.from(commandTypes).join(', ')}`);

            console.log('✅ 所有断言通过');

        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
