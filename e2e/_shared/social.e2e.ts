import { test, expect } from '@playwright/test';
import { setChineseLocale } from '../helpers/common';

const SOCIAL_MOBILE_CHAT_SCREENSHOT_PATH = 'test-results/evidence-screenshots/_shared/social-chat-mobile-input-visible.png';
const E2E_AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyXzEyMyIsInVzZXJuYW1lIjoi5rWL6K-V546p5a62IiwiaWF0IjoxNzE2NTAwMDAwLCJleHAiOjQxMDI0NDQ4MDB9.sig';

async function openFriendsChatModal(page: import('@playwright/test').Page) {
    const trigger = page.getByTestId('user-menu-trigger');
    await expect(trigger).toBeVisible();
    await trigger.dispatchEvent('click');

    const friendsEntry = page.getByTestId('user-menu-friends-chat');
    await expect(friendsEntry).toBeVisible();
    await friendsEntry.dispatchEvent('click');
}

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
                        token: E2E_AUTH_TOKEN,
                        user: mockUser
                    }
                }
            });
        });

        await page.route('**/notifications', async route => {
            await route.fulfill({ json: { notifications: [] } });
        });

        await page.route('**/notifications/read-state', async route => {
            if (route.request().method() === 'POST') {
                await route.fulfill({ json: { success: true } });
                return;
            }
            await route.fulfill({ json: { lastSeenAt: null } });
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
        await page.addInitScript((token: string) => {
            localStorage.setItem('auth_token', token);
            localStorage.setItem('auth_user', JSON.stringify({
                id: 'user_123',
                username: '测试玩家',
                email: 'test@example.com',
                emailVerified: true,
                role: 'user',
                banned: false,
            }));
        }, E2E_AUTH_TOKEN);

        // Debug: Capture console logs and errors
        page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
        page.on('pageerror', err => console.log(`[Browser Error]: ${err.message}`));

        // 3. Go to Home
        await page.goto('/', { waitUntil: 'domcontentloaded' });
    });

    test('可以通过用户菜单打开社交并查看好友聊天', async ({ page }) => {
        await openFriendsChatModal(page);

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
        const sourceChatInput = page
            .getByTestId('friends-chat-modal-content')
            .locator('input[placeholder="输入消息..."]')
            .first();
        await expect(sourceChatInput).toBeVisible();
        await sourceChatInput.fill('稍后再玩！');
        const [sendResponse] = await Promise.all([
            page.waitForResponse('**/auth/messages/send'),
            sourceChatInput.press('Enter')
        ]);
        expect(sendResponse.ok()).toBeTruthy();
        await expect(page.locator('.whitespace-pre-wrap', { hasText: '稍后再玩！' })).toBeVisible();
    });

    test('移动端社交聊天输入聚焦后仍应保持可见', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        await openFriendsChatModal(page);

        await expect(page.getByText('好友甲')).toBeVisible();
        await page.getByRole('button', { name: /好友甲/i }).click();

        const sourceChatInput = page
            .getByTestId('friends-chat-modal-content')
            .locator('input[placeholder="输入消息..."]')
            .first();
        await expect(sourceChatInput).toBeVisible();

        await page.evaluate(() => {
            const root = document.documentElement;
            root.style.setProperty('--runtime-viewport-height', '564px');
            root.style.setProperty('--keyboard-inset-height', '280px');
            root.dataset.keyboardVisible = 'true';
        });

        await sourceChatInput.click();
        const mobileProxyInput = page.getByTestId('mobile-text-entry-proxy-input').last();
        let activeChatInput = sourceChatInput;

        await mobileProxyInput.waitFor({ state: 'visible', timeout: 3000 }).catch(() => undefined);
        const proxyEditable = await mobileProxyInput.isEditable().catch(() => false);
        if (proxyEditable) {
            activeChatInput = mobileProxyInput;
        } else {
            await expect(sourceChatInput).toBeEditable();
        }

        await activeChatInput.fill('移动端社交聊天输入可见性校验');
        await expect(activeChatInput).toHaveValue('移动端社交聊天输入可见性校验');

        const runtimeState = await page.evaluate(() => {
            const source = document.querySelector('[data-testid="friends-chat-modal-content"] input[placeholder="输入消息..."]') as HTMLInputElement | null;
            const proxy = document.querySelector('[data-testid="mobile-text-entry-proxy-input"]') as HTMLInputElement | null;
            const sendButton = source?.form?.querySelector('button[type="submit"], button') as HTMLButtonElement | null;
            return {
                sourceValue: source?.value ?? null,
                sourceReadOnly: source?.readOnly ?? null,
                proxyValue: proxy?.value ?? null,
                activeTag: document.activeElement?.tagName ?? null,
                sendDisabled: sendButton?.disabled ?? null,
            };
        });
        console.log('[social-mobile-debug]', JSON.stringify(runtimeState));

        const sendButton = page
            .getByTestId('friends-chat-modal-content')
            .locator('button[type="submit"]')
            .first();
        await sourceChatInput.focus();

        let sendRequest: Awaited<ReturnType<typeof page.waitForRequest>>;
        let sentByEnter = true;
        try {
            [sendRequest] = await Promise.all([
                page.waitForRequest((request) => {
                    return request.url().includes('/auth/messages/send') && request.method() === 'POST';
                }, { timeout: 6000 }),
                sourceChatInput.press('Enter'),
            ]);
        } catch {
            sentByEnter = false;
            [sendRequest] = await Promise.all([
                page.waitForRequest((request) => {
                    return request.url().includes('/auth/messages/send') && request.method() === 'POST';
                }, { timeout: 6000 }),
                sendButton.click(),
            ]);
        }
        console.log('[social-mobile-send-path]', sentByEnter ? 'enter' : 'button-fallback');
        expect(sendRequest.postDataJSON()).toMatchObject({
            toUserId: 'friend_001',
            content: '移动端社交聊天输入可见性校验',
            type: 'text',
        });
        await expect(page.locator('.whitespace-pre-wrap', { hasText: '移动端社交聊天输入可见性校验' })).toBeVisible();

        const metricsInput = await mobileProxyInput.isVisible().catch(() => false)
            ? mobileProxyInput
            : sourceChatInput;
        const metrics = await metricsInput.evaluate((node) => {
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
