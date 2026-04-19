import { test, expect } from './fixtures';
import { setupOnlineMatch, readLiveState } from './helpers/cardia';

/**
 * Cardia 音频系统 E2E 测试
 * 
 * 测试目标：
 * 1. 验证音频配置正确加载
 * 2. 验证事件发射时音效被触发
 * 3. 排查音效未播放问题
 * 
 * 注意：音频系统通过 useGameAudio hook 初始化，不暴露到 window 对象
 */

test.describe('Cardia Audio System', () => {
    test('应该在游戏初始化时正确设置音频系统', async ({ browser }) => {
        const tempContext = await browser.newContext();
        const tempPage = await tempContext.newPage();
        
        // 监听浏览器控制台日志（捕获音频相关日志）
        const consoleLogs: string[] = [];
        tempPage.on('console', msg => {
            const text = msg.text();
            consoleLogs.push(text);
            // 打印所有日志以便调试
            console.log(`[Browser Console] ${text}`);
        });
        
        const setup = await setupOnlineMatch(tempPage);
        await setup.player1Page.waitForLoadState('networkidle');
        await setup.player1Page.waitForTimeout(3000); // 等待音频系统初始化

        // 截图：初始状态
        await setup.player1Page.screenshot({ 
            path: test.info().outputPath('game-initial-state.png'),
            fullPage: true 
        });

        // 完整诊断
        const diagnostics = await setup.player1Page.evaluate(() => {
            const state = (window as any).__BG_STATE__;
            const eventStream = state?.sys?.eventStream;
            
            return {
                // 游戏状态
                state: {
                    exists: !!state,
                    hasCore: !!state?.core,
                    hasSys: !!state?.sys,
                    phase: state?.sys?.phase,
                    currentPlayer: state?.core?.currentPlayerId,
                    player0Hand: state?.core?.players?.['0']?.hand?.length || 0,
                    player1Hand: state?.core?.players?.['1']?.hand?.length || 0,
                },
                // 事件流
                eventStream: {
                    exists: !!eventStream,
                    entriesCount: eventStream?.entries?.length || 0,
                    recentEvents: eventStream?.entries?.slice(-10).map((e: any) => e.event.type) || [],
                },
                // 音频系统
                audio: {
                    audioContextExists: typeof AudioContext !== 'undefined',
                    howlerExists: typeof (window as any).Howl !== 'undefined',
                    audioManagerExists: !!(window as any).__BG_AUDIO_MANAGER__,
                },
                // 浏览器环境
                browser: {
                    userAgent: navigator.userAgent,
                },
            };
        });

        console.log('=== 完整系统诊断 ===');
        console.log(JSON.stringify(diagnostics, null, 2));

        // 验证基本系统
        expect(diagnostics.state.exists).toBe(true);
        expect(diagnostics.audio.audioContextExists).toBe(true);
        expect(diagnostics.eventStream.exists).toBe(true);

        // 检查音频相关的控制台日志
        console.log('=== 音频相关控制台日志 ===');
        const audioLogs = consoleLogs.filter(log => 
            log.toLowerCase().includes('audio') || 
            log.toLowerCase().includes('sound') ||
            log.toLowerCase().includes('howler') ||
            log.toLowerCase().includes('bgm')
        );
        console.log(`找到 ${audioLogs.length} 条音频相关日志`);
        audioLogs.forEach(log => console.log(`  - ${log}`));

        // 检查是否有事件被发射
        console.log(`\n=== 事件流状态 ===`);
        console.log(`事件总数: ${diagnostics.eventStream.entriesCount}`);
        console.log(`最近事件: ${diagnostics.eventStream.recentEvents.join(', ')}`);

        await setup.cleanup();
    });

    test('诊断：检查 useGameAudio hook 是否正确初始化', async ({ browser }) => {
        const tempContext = await browser.newContext();
        const tempPage = await tempContext.newPage();
        
        // 监听所有控制台消息
        const allLogs: Array<{ type: string; text: string }> = [];
        tempPage.on('console', msg => {
            allLogs.push({ type: msg.type(), text: msg.text() });
        });
        
        const setup = await setupOnlineMatch(tempPage);
        await setup.player1Page.waitForLoadState('networkidle');
        await setup.player1Page.waitForTimeout(3000);

        // 检查 useGameAudio 相关的日志
        const audioHookLogs = allLogs.filter(log => 
            log.text.includes('useGameAudio') ||
            log.text.includes('AudioManager') ||
            log.text.includes('CARDIA_AUDIO_CONFIG')
        );

        console.log('=== useGameAudio Hook 相关日志 ===');
        console.log(`找到 ${audioHookLogs.length} 条相关日志`);
        audioHookLogs.forEach(log => {
            console.log(`[${log.type}] ${log.text}`);
        });

        // 检查是否有错误日志
        const errorLogs = allLogs.filter(log => log.type === 'error');
        console.log(`\n=== 错误日志 ===`);
        console.log(`找到 ${errorLogs.length} 条错误日志`);
        errorLogs.forEach(log => {
            console.log(`[ERROR] ${log.text}`);
        });

        await setup.player1Page.screenshot({ 
            path: test.info().outputPath('audio-hook-diagnostics.png'),
            fullPage: true 
        });

        await setup.cleanup();
    });
});
