/**
 * SmashUp Card Atlas 注册简单验证
 * 只验证 atlas 是否注册，不依赖页面渲染
 */

import { test } from '@playwright/test';

test('SmashUp card atlases registration check', async ({ page }) => {
    // 捕获控制台日志
    const consoleLogs: string[] = [];
    page.on('console', msg => {
        consoleLogs.push(msg.text());
    });
    
    // 访问首页（触发模块加载）
    await page.goto('/');
    
    // 等待页面加载完成
    await page.waitForTimeout(2000);
    
    // 检查 atlas 注册状态
    const registrationCheck = await page.evaluate(() => {
        // 动态 import SmashUp game 模块触发注册
        return import('/src/games/smashup/game.ts').then(() => {
            // 再 import CardPreview 获取注册表
            return import('/src/components/common/media/CardPreview.tsx').then((module) => {
                const { getCardAtlasSource } = module;
                
                const atlasIds = [
                    'smashup:cards1',
                    'smashup:cards2',
                    'smashup:cards3',
                    'smashup:cards4'
                ];
                
                const results: Record<string, { registered: boolean; hasImage: boolean; hasConfig: boolean }> = {};
                
                for (const id of atlasIds) {
                    const source = getCardAtlasSource(id);
                    results[id] = {
                        registered: source !== undefined,
                        hasImage: source?.image ? true : false,
                        hasConfig: source?.config ? true : false,
                    };
                }
                
                return results;
            });
        });
    });
    
    console.log('\n=== SmashUp Atlas 注册状态 ===');
    for (const [id, status] of Object.entries(registrationCheck)) {
        console.log(`${id}:`);
        console.log(`  注册: ${status.registered ? '✅' : '❌'}`);
        console.log(`  图片路径: ${status.hasImage ? '✅' : '❌'}`);
        console.log(`  配置: ${status.hasConfig ? '✅' : '❌'}`);
    }
    
    // 输出相关的控制台日志
    const relevantLogs = consoleLogs.filter(log => 
        log.includes('AtlasCard') || 
        log.includes('smashup') ||
        log.includes('registerCardAtlasSource')
    );
    
    if (relevantLogs.length > 0) {
        console.log('\n=== 相关控制台日志 ===');
        relevantLogs.forEach(log => console.log(log));
    }
});
