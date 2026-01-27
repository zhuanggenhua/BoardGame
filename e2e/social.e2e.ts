import { test, expect } from '@playwright/test';

test.describe('Social Hub E2E', () => {

    // Mock Data
    const mockUser = {
        id: 'user_123',
        username: 'TestPlayer',
        email: 'test@example.com',
        emailVerified: true,
        lastOnline: new Date().toISOString()
    };

    const mockFriends = [
        {
            id: 'friend_001',
            username: 'BestFriend',
            avatar: 'avatar_1.png',
            online: true
        }
    ];

    const mockMessages = [
        {
            id: 'msg_1',
            from: 'friend_001',
            to: 'user_123',
            content: 'Hello! Want to play?',
            createdAt: new Date(Date.now() - 10000).toISOString(),
            read: true,
            type: 'text'
        }
    ];

    const mockConversations = [
        {
            userId: 'friend_001',
            username: 'BestFriend',
            avatar: 'avatar_1.png',
            online: true,
            lastMessage: {
                id: 'msg_1',
                from: 'friend_001',
                to: 'user_123',
                content: 'Hello! Want to play?',
                createdAt: new Date(Date.now() - 10000).toISOString(),
                read: true,
                type: 'text'
            },
            unreadCount: 1
        }
    ];

    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('i18nextLng', 'en');
        });
        const messagesStore = [...mockMessages];
        // 1. Mock API Responses
        await page.route('**/auth/me', async route => {
            await route.fulfill({ json: { user: mockUser } });
        });

        // Mock Login
        await page.route('**/auth/login', async route => {
            await route.fulfill({
                json: {
                    token: 'fake_jwt_token',
                    user: mockUser
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
                username: 'TestPlayer',
                email: 'test@example.com'
            }));
        });

        // Debug: Capture console logs and errors
        page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
        page.on('pageerror', err => console.log(`[Browser Error]: ${err.message}`));

        // 3. Go to Home
        await page.goto('/');
    });

    test('Should open Social Hub via Global HUD and view friend chat', async ({ page }) => {
        // 1. Wait for GlobalHUD to appear (bottom right fab)
        const fabContainer = page.locator('.fixed.bottom-8.right-8');
        const hudTrigger = fabContainer.locator('button').first();
        await expect(hudTrigger).toBeVisible();

        // 2. Expand HUD
        await hudTrigger.click();

        // 3. Click "Social" button in the menu
        const socialButton = page.getByRole('button').filter({ hasText: /Social|好友|社交/i }).first();
        await expect(socialButton).toBeVisible();
        await socialButton.click();

        // 4. Verify Modal Opened
        // Modal usually has a backdrop and container
        const modal = page.locator('div[role="dialog"]'); // Assuming modal uses role="dialog" or we use a generic selector
        // If headless UI doesn't use role="dialog" by default, fallback to class
        // Our ModalStack uses a simple div structure usually.
        // Let's look for text "Social" or "好友" as header in the modal.
        await expect(page.getByText(/Social|好友|社交/i).first()).toBeVisible();

        // 5. Switch to Friends Tab (if not already active)
        // Note: Skipping deep content verification to focus on HUD entry point connection
        // const friendsTab = page.locator('button, [role="tab"]').filter({ hasText: /Friends|好友/i }).first();
        // if (await friendsTab.isVisible()) {
        //      await friendsTab.click();
        // }

        // 6. Check Friend List (from mock)
        await expect(page.getByText('BestFriend')).toBeVisible();

        // 7. Open chat and verify history
        await page.getByRole('button', { name: /BestFriend/i }).click();
        await expect(page.locator('.whitespace-pre-wrap', { hasText: 'Hello! Want to play?' })).toBeVisible();

        // 8. Send a message and verify it appears
        const chatInput = page.getByPlaceholder('Type a message...');
        await expect(chatInput).toBeVisible();
        await chatInput.fill("Let's play later!");
        const [sendResponse] = await Promise.all([
            page.waitForResponse('**/auth/messages/send'),
            chatInput.press('Enter')
        ]);
        expect(sendResponse.ok()).toBeTruthy();
        await expect(page.locator('.whitespace-pre-wrap', { hasText: "Let's play later!" })).toBeVisible();
    });
});
