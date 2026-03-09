/**
 * 端口隔离验证测试
 * 
 * 验证 E2E 测试环境使用正确的端口（20000/21000），不与开发环境冲突
 */

import { test, expect } from '@playwright/test';
import { ensureGameServerAvailable, getGameServerBaseURL } from './helpers/common';

test.describe('端口隔离验证', () => {
    test('应该使用测试环境端口 20000', async () => {
        const gameServerUrl = getGameServerBaseURL();
        console.log('Game Server URL:', gameServerUrl);
        
        // 验证使用的是测试环境端口
        expect(gameServerUrl).toContain('20000');
        expect(gameServerUrl).not.toContain('18000');
    });

    test('应该能够访问测试环境的游戏服务器', async ({ page }) => {
        const gameServerUrl = getGameServerBaseURL();
        const guestId = `test_${Date.now()}`;

        await expect
            .poll(
                async () => ensureGameServerAvailable(page),
                {
                    timeout: 30000,
                    intervals: [500, 1000, 2000],
                    message: '等待测试环境游戏服务器就绪',
                },
            )
            .toBe(true);
        
        // 服务就绪后再创建一个房间，避免把“启动中的 ECONNREFUSED”误判为端口隔离失败
        const response = await page.request.post(`${gameServerUrl}/games/smashup/create`, {
            data: { 
                numPlayers: 2, 
                setupData: { 
                    guestId,
                    ownerKey: `guest:${guestId}`,
                    ownerType: 'guest'
                } 
            },
        });
        
        console.log('Response status:', response.status());
        console.log('Response URL:', response.url());
        
        // 验证服务器可访问（201 Created 或 200 OK）
        expect(response.ok() || response.status() === 201).toBeTruthy();
    });
});
