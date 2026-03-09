/**
 * SmashUp Card Atlas 注册验证测试
 * 验证所有 4 个 card atlases 是否正确注册
 */

import { test, expect } from '@playwright/test';

test('SmashUp card atlases should be registered', async ({ page }) => {
    // 访问 SmashUp 派系选择页面
    await page.goto('/play/smashup/local');
    
    // 等待页面加载
    await page.waitForTimeout(2000);
    
    // 注入检查脚本
    const registrationStatus = await page.evaluate(async () => {
        // 通过 Vite 源码路径动态加载模块，避免使用 require
        const { getCardAtlasSource } = await import('/src/components/common/media/CardPreview.tsx');
        
        const atlasIds = [
            'smashup:cards1',
            'smashup:cards2', 
            'smashup:cards3',
            'smashup:cards4'
        ];
        
        const results: Record<string, boolean> = {};
        
        for (const id of atlasIds) {
            const source = getCardAtlasSource(id);
            results[id] = source !== undefined;
        }
        
        return results;
    });
    
    console.log('Atlas Registration Status:', registrationStatus);
    
    // 验证所有 atlases 都已注册
    expect(registrationStatus['smashup:cards1']).toBe(true);
    expect(registrationStatus['smashup:cards2']).toBe(true);
    expect(registrationStatus['smashup:cards3']).toBe(true);
    expect(registrationStatus['smashup:cards4']).toBe(true);
});
