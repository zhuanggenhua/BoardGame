import { test, expect } from '@playwright/test';
import { setChineseLocale } from '../helpers/common';

const SOCIAL_MOBILE_CHAT_SCREENSHOT_PATH = 'test-results/evidence-screenshots/_shared/social-chat-mobile-input-visible.png';

test.describe('社交中心 E2E', () => {

    // Mock Data
    const mockUser = {
        id: 'user_123',
        username: '测试玩家',
        email: 'test@example.com',
        emailVerified: true,
        lastOnline: new Date().toISOString()
    };

    const mockFriends = [
        {
            id: 'friend_001',
            username: '好友甲',
            avatar: 'avatar_1.png',
            online: true
        }
    ];

    const mockMessages = [
        {
            id: 'msg_1',
            from: 'friend_001',
            to: 'user_123',
            content: '来一局吗？',
            createdAt: new Date(Date.now() - 10000).toISOString(),
            read: true,
            type: 'text'
        }
    ];

    const mockConversations = [
        {
            userId: 'friend_001',
            username: '好友甲',
            avatar: 'avatar_1.png',
            online: true,
            lastMessage: {
                id: 'msg_1',
                from: 'friend_001',
                to: 'user_123',
                content: '来一局吗？',
                createdAt: new Date(Date.now() - 10000).toISOString(),
                read: true,
                type: 'text'
            },
            unreadCount: 1
        }
    ];

    test.beforeEach(async ({ page }) => {
        await setChineseLocale(page);
        const messagesStore = [...mockMessages];
        // 1. Mock API Responses
        await page.route('**/auth/me', async route => {
            await route.fulfill({ json: { user: mockUser } });
        });

        // Mock Login
        await page.route('**/auth/login', async route => {
            await route.fulfill({
                json: {
                    success: true,
                    code: 'AUTH_LOGIN_OK',
                    message: '登录成功',
                    data: {
                        token: 'fake_jwt_token',
                        user: mockUser
                    }
                }
            });
        });

        // Mock Friends List
        await page.route('**/auth/friends', async route => {
            await route.fulfill({ json: { items: mockFriends, friends: mockFriends, total: 1 } });
        });

        // Mock Friend Requests (Fix for missing mock causing context error)
        await page.route('**/auth/friends/requests', async route => {
            await route.fulfill({ json: { items: [], requests: [], total: 0 } });
        });

        // Mock Messages for specific friend
        await page.route('**/auth/messages/conversations', async route => {
            await route.fulfill({ json: { conversations: mockConversations } });
        });

        await page.route('**/auth/messages/friend_001', async route => {
            await route.fulfill({ json: { messages: messagesStore, total: messagesStore.length } });
        });

        // Mock Send Message
        await page.route('**/auth/messages/send', async route => {
            const body = JSON.parse(route.request().postData() || '{}');
            const newMessage = {
                id: `msg_${Date.now()}`,
                from: 'user_123',
                to: body.toUserId,
                content: body.content,
                type: body.type || 'text',
                createdAt: new Date().toISOString(),
                read: false
            };
            messagesStore.push(newMessage);
            await route.fulfill({
                json: {
                    message: {
                        ...newMessage
                    }
                }
            });
        });

        await page.route('**/auth/messages/read/**', async route => {
            await route.fulfill({ json: { success: true } });
        });

        // 2. Simulate Login State
        await page.addInitScript(() => {
            localStorage.setItem('auth_token', 'fake_jwt_token');
            localStorage.setItem('auth_user', JSON.stringify({
                id: 'user_123',
                username: '测试玩家',
                email: 'test@example.com'
            }));
        });

        // Debug: Capture console logs and errors
        page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
        page.on('pageerror', err => console.log(`[Browser Error]: ${err.message}`));

        // 3. Go to Home
        await page.goto('/', { waitUntil: 'domcontentloaded' });
    });

    test('可以通过全局 HUD 打开社交并查看好友聊天', async ({ page }) => {
        // 1. Wait for GlobalHUD to appear
        const hudTrigger = page.locator('[data-testid="fab-menu"] [data-fab-id]').first();
        await expect(hudTrigger).toBeVisible();

        // 2. Expand HUD
        await hudTrigger.click();

        // 3. Click "Social" button in the menu
        const socialButton = page.locator('[data-fab-id="social"]');
        await expect(socialButton).toBeVisible();
        await socialButton.click();

        // 4. Verify Modal Opened
        // Modal usually has a backdrop and container
        // If headless UI doesn't use role="dialog" by default, fallback to class
        // Our ModalStack uses a simple div structure usually.
        // Let's look for text "Social" or "好友" as header in the modal.
        await expect(page.getByText(/好友|社交/i).first()).toBeVisible();

        // 5. Switch to Friends Tab (if not already active)
        // Note: Skipping deep content verification to focus on HUD entry point connection
        // const friendsTab = page.locator('button, [role="tab"]').filter({ hasText: /Friends|好友/i }).first();
        // if (await friendsTab.isVisible()) {
        //      await friendsTab.click();
        // }

        // 6. Check Friend List (from mock)
        await expect(page.getByText('好友甲')).toBeVisible();

        // 7. Open chat and verify history
        await page.getByRole('button', { name: /好友甲/i }).click();
        await expect(page.locator('.whitespace-pre-wrap', { hasText: '来一局吗？' })).toBeVisible();

        // 8. Send a message and verify it appears
        const chatInput = page.getByPlaceholder('输入消息...');
        await expect(chatInput).toBeVisible();
        await chatInput.fill('稍后再玩！');
        const [sendResponse] = await Promise.all([
            page.waitForResponse('**/auth/messages/send'),
            chatInput.press('Enter')
        ]);
        expect(sendResponse.ok()).toBeTruthy();
        await expect(page.locator('.whitespace-pre-wrap', { hasText: '稍后再玩！' })).toBeVisible();
    });

    test('移动端社交聊天输入聚焦后仍应保持可见', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        const hudTrigger = page.locator('[data-testid="fab-menu"] [data-fab-id]').first();
        await expect(hudTrigger).toBeVisible();
        await hudTrigger.click();

        const socialButton = page.locator('[data-fab-id="social"]');
        await expect(socialButton).toBeVisible();
        await socialButton.click();

        await expect(page.getByText('好友甲')).toBeVisible();
        await page.getByRole('button', { name: /好友甲/i }).click();

        const chatInput = page.getByPlaceholder('输入消息...');
        await expect(chatInput).toBeVisible();

        await page.evaluate(() => {
            const root = document.documentElement;
            root.style.setProperty('--runtime-viewport-height', '564px');
            root.style.setProperty('--keyboard-inset-height', '280px');
            root.dataset.keyboardVisible = 'true';
        });

        await chatInput.click();
        await chatInput.fill('移动端社交聊天输入可见性校验');
        await expect(chatInput).toHaveValue('移动端社交聊天输入可见性校验');

        const metrics = await chatInput.evaluate((node) => {
            const rect = node.getBoundingClientRect();
            const fontSize = Number.parseFloat(window.getComputedStyle(node).fontSize || '0');
            const runtimeViewportHeight = Number.parseFloat(
                window.getComputedStyle(document.documentElement).getPropertyValue('--runtime-viewport-height') || '0',
            );
            return {
                right: rect.right,
                bottom: rect.bottom,
                viewportWidth: window.innerWidth,
                runtimeViewportHeight,
                fontSize,
            };
        });

        expect(metrics.right).toBeLessThanOrEqual(metrics.viewportWidth);
        expect(metrics.bottom).toBeLessThanOrEqual(metrics.runtimeViewportHeight);
        expect(metrics.fontSize).toBeGreaterThanOrEqual(16);

        await page.screenshot({
            path: SOCIAL_MOBILE_CHAT_SCREENSHOT_PATH,
            fullPage: false,
        });
    });
});
