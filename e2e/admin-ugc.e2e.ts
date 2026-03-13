import { test, expect, type Page } from '@playwright/test';

type StoredUser = {
    id: string;
    username: string;
    role: 'user' | 'developer' | 'admin';
    banned: boolean;
    developerGameIds?: string[];
};

const ADMIN_E2E_TIMEOUT_MS = 90_000;
const ADMIN_NAVIGATION_TIMEOUT_MS = 60_000;
const HTML_NAVIGATION_HEADERS = {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
};

const setStoredAuth = async (page: Page, user: StoredUser) => {
    await page.addInitScript((storedUser) => {
        localStorage.setItem('i18nextLng', 'zh-CN');
        localStorage.setItem('auth_token', 'fake_admin_token');
        localStorage.setItem('auth_user', JSON.stringify(storedUser));
    }, user);
};

const gotoFrontendRoute = async (page: Page, targetPath: string) => {
    await expect.poll(async () => {
        try {
            const response = await page.request.get(targetPath, {
                failOnStatusCode: false,
                headers: HTML_NAVIGATION_HEADERS,
            });

            if (response.status() !== 200) {
                return `status:${response.status()}`;
            }

            const body = await response.text();
            return body.includes('<!doctype html>') ? 'ready' : 'not-html';
        } catch (error) {
            return `network:${error instanceof Error ? error.name : 'unknown'}`;
        }
    }, {
        timeout: ADMIN_NAVIGATION_TIMEOUT_MS,
        intervals: [500, 1000, 2000],
        message: `等待前端路由可访问: ${targetPath}`,
    }).toBe('ready');

    await page.goto(targetPath, { waitUntil: 'domcontentloaded' });
};

test.describe('后台管理 E2E', () => {
    test.describe.configure({ timeout: ADMIN_E2E_TIMEOUT_MS });

    test.beforeEach(async ({ page }) => {
        page.setDefaultNavigationTimeout(ADMIN_NAVIGATION_TIMEOUT_MS);
    });

    test('UGC 包列表/下架/删除流程', async ({ page }) => {
        await setStoredAuth(page, {
            id: 'admin_1',
            username: 'Admin',
            role: 'admin',
            banned: false,
        });

        const now = new Date().toISOString();
        let packages = [
            {
                packageId: 'ugc-pub-a',
                name: '测试 UGC 包 A',
                ownerId: 'user-a',
                status: 'published' as const,
                publishedAt: now,
                createdAt: now,
                updatedAt: now,
            },
            {
                packageId: 'ugc-draft-b',
                name: '测试 UGC 包 B',
                ownerId: 'user-b',
                status: 'draft' as const,
                publishedAt: null,
                createdAt: now,
                updatedAt: now,
            },
        ];

        await page.route('**/admin/ugc/packages**', async (route) => {
            const request = route.request();
            if (request.resourceType() === 'document') {
                return route.continue();
            }

            const url = new URL(request.url());
            const segments = url.pathname.split('/').filter(Boolean);

            if (request.method() === 'GET') {
                return route.fulfill({
                    status: 200,
                    json: {
                        items: packages,
                        page: 1,
                        limit: 10,
                        total: packages.length,
                    },
                });
            }

            if (request.method() === 'POST' && segments[segments.length - 1] === 'unpublish') {
                const packageId = segments[segments.length - 2];
                const target = packages.find((item) => item.packageId === packageId);
                if (!target) {
                    return route.fulfill({ status: 404, json: { error: 'not found' } });
                }
                target.status = 'draft';
                target.publishedAt = null;
                target.updatedAt = new Date().toISOString();
                return route.fulfill({ status: 200, json: { package: target } });
            }

            if (request.method() === 'DELETE') {
                const packageId = segments[segments.length - 1];
                packages = packages.filter((item) => item.packageId !== packageId);
                return route.fulfill({ status: 200, json: { deleted: true, assetsDeleted: 0 } });
            }

            return route.fulfill({ status: 404, json: { error: 'unknown route' } });
        });

        await gotoFrontendRoute(page, '/admin/ugc');
        await expect(page.getByRole('heading', { name: 'UGC 管理' })).toBeVisible();

        const publishedRow = page.locator('tr', { hasText: 'ugc-pub-a' });
        const draftRow = page.locator('tr', { hasText: 'ugc-draft-b' });

        await expect(publishedRow).toBeVisible();
        await expect(draftRow).toBeVisible();

        page.once('dialog', (dialog) => dialog.accept());
        await Promise.all([
            page.waitForResponse((response) => response.url().includes('/admin/ugc/packages/ugc-pub-a/unpublish') && response.status() === 200),
            publishedRow.getByRole('button', { name: '下架' }).click(),
        ]);

        await expect(publishedRow.getByText('草稿')).toBeVisible();

        page.once('dialog', (dialog) => dialog.accept());
        await Promise.all([
            page.waitForResponse((response) => response.url().includes('/admin/ugc/packages/ugc-draft-b') && response.request().method() === 'DELETE'),
            draftRow.getByRole('button', { name: '删除' }).click(),
        ]);

        await expect(page.locator('tr', { hasText: 'ugc-draft-b' })).toHaveCount(0);
    });

    test('用户管理列表可将用户设置为 developer 并分配多个游戏', async ({ page }) => {
        await setStoredAuth(page, {
            id: 'admin_1',
            username: 'Admin',
            role: 'admin',
            banned: false,
        });

        const now = new Date().toISOString();
        const user: {
            id: string;
            username: string;
            email: string;
            role: 'user' | 'developer' | 'admin';
            banned: boolean;
            createdAt: string;
            lastOnline: string;
            avatar: string;
            developerGameIds: string[];
        } = {
            id: 'user-role-1',
            username: '测试用户',
            email: 'user-role@example.com',
            role: 'user',
            banned: false,
            createdAt: now,
            lastOnline: now,
            avatar: '',
            developerGameIds: [] as string[],
        };

        await page.route('**/admin/users**', async (route) => {
            const request = route.request();
            if (request.resourceType() === 'document') {
                return route.continue();
            }

            const url = new URL(request.url());
            const segments = url.pathname.split('/').filter(Boolean);

            if (request.method() === 'GET' && segments[segments.length - 1] === 'users') {
                return route.fulfill({
                    status: 200,
                    json: {
                        items: [user],
                        page: 1,
                        limit: 10,
                        total: 1,
                    },
                });
            }

            if (request.method() === 'PATCH' && segments[segments.length - 1] === 'role') {
                const body = request.postDataJSON() as { role?: 'user' | 'developer' | 'admin'; developerGameIds?: string[] };
                user.role = (body.role ?? 'user') as typeof user.role;
                user.developerGameIds = body.role === 'developer' ? (body.developerGameIds ?? []) : [];
                return route.fulfill({
                    status: 200,
                    json: {
                        message: '用户角色已更新',
                        changed: true,
                        user: {
                            id: user.id,
                            username: user.username,
                            role: user.role,
                            developerGameIds: user.developerGameIds,
                        },
                    },
                });
            }

            return route.fulfill({ status: 404, json: { error: 'unknown users route' } });
        });

        await gotoFrontendRoute(page, '/admin/users');
        await expect(page.getByRole('heading', { name: '用户管理' })).toBeVisible();

        const row = page.locator('tr', { hasText: user.username });
        await expect(row).toBeVisible();

        await row.getByRole('button', { name: '角色设置' }).click();
        await expect(page.getByRole('heading', { name: '用户后台角色' })).toBeVisible();
        await expect(page.getByRole('button', { name: '关闭角色设置' })).toBeVisible();

        await page.getByRole('button', { name: '开发者' }).click();
        await page.locator('label', { hasText: '大杀四方' }).getByRole('checkbox').check();
        await page.locator('label', { hasText: '王权骰铸' }).getByRole('checkbox').check();

        await Promise.all([
            page.waitForResponse((response) => response.url().includes(`/admin/users/${user.id}/role`) && response.status() === 200),
            page.getByRole('button', { name: '保存角色' }).click(),
        ]);

        await expect(row.getByText('开发者 (2 个游戏)')).toBeVisible();
        await expect(page.getByText('已设为开发者，可管理 2 个游戏')).toBeVisible();
    });

    test('用户管理列表中未分配游戏的 developer 不再显示未分配标签', async ({ page }) => {
        await setStoredAuth(page, {
            id: 'admin_1',
            username: 'Admin',
            role: 'admin',
            banned: false,
        });

        const now = new Date().toISOString();
        const user = {
            id: 'user-role-legacy-1',
            username: '历史开发者',
            email: 'legacy-developer@example.com',
            role: 'developer' as const,
            banned: false,
            createdAt: now,
            lastOnline: now,
            avatar: '',
            developerGameIds: [] as string[],
        };

        await page.route('**/admin/users**', async (route) => {
            const request = route.request();
            if (request.resourceType() === 'document') {
                return route.continue();
            }

            const url = new URL(request.url());
            const segments = url.pathname.split('/').filter(Boolean);

            if (request.method() === 'GET' && segments[segments.length - 1] === 'users') {
                return route.fulfill({
                    status: 200,
                    json: {
                        items: [user],
                        page: 1,
                        limit: 10,
                        total: 1,
                    },
                });
            }

            return route.fulfill({ status: 404, json: { error: 'unknown users route' } });
        });

        await gotoFrontendRoute(page, '/admin/users');
        await expect(page.getByRole('heading', { name: '用户管理' })).toBeVisible();

        const row = page.locator('tr', { hasText: user.username });
        await expect(row).toBeVisible();
        await expect(row).toContainText('开发者');
        await expect(row).not.toContainText('未分配');
    });

    test('developer 访问非授权后台页会回退到更新日志页', async ({ page }) => {
        await setStoredAuth(page, {
            id: 'developer_1',
            username: 'Dev',
            role: 'developer',
            banned: false,
            developerGameIds: ['smashup'],
        });

        await page.route('**/admin/game-changelogs**', async (route) => {
            const request = route.request();
            if (request.resourceType() === 'document') {
                return route.continue();
            }

            return route.fulfill({
                status: 200,
                json: {
                    items: [],
                    availableGameIds: ['smashup'],
                },
            });
        });

        await gotoFrontendRoute(page, '/admin/users');

        await expect(page).toHaveURL(/\/admin\/changelogs$/);
        await expect(page.getByRole('heading', { name: '更新日志' })).toBeVisible();
        await expect(page.getByRole('button', { name: '新建更新日志' })).toBeVisible();
        await expect(page.getByRole('heading', { name: '用户管理' })).toHaveCount(0);
    });

    test('用户详情页展示近期对局记录和开发者可管理游戏', async ({ page }) => {
        await setStoredAuth(page, {
            id: 'admin_1',
            username: 'Admin',
            role: 'admin',
            banned: false,
        });

        const now = new Date().toISOString();
        const user = {
            id: 'developer-detail-1',
            username: '开发者用户',
            email: 'developer-detail@example.com',
            role: 'developer' as const,
            banned: false,
            createdAt: now,
            lastOnline: now,
            avatar: '',
            developerGameIds: ['smashup', 'dicethrone'],
        };

        await page.route('**/admin/users/**', async (route) => {
            const request = route.request();
            if (request.resourceType() === 'document') {
                return route.continue();
            }

            const url = new URL(request.url());
            const segments = url.pathname.split('/').filter(Boolean);
            const targetId = segments[segments.length - 1];

            if (request.method() === 'GET' && targetId === user.id) {
                return route.fulfill({
                    status: 200,
                    json: {
                        user,
                        stats: {
                            totalMatches: 1,
                            wins: 1,
                            winRate: 100,
                        },
                        recentMatches: [
                            {
                                matchID: 'match-user-1',
                                gameName: 'tictactoe',
                                result: 'win',
                                opponent: '对手甲',
                                endedAt: now,
                            },
                        ],
                    },
                });
            }

            return route.fulfill({ status: 404, json: { error: 'unknown user route' } });
        });

        await gotoFrontendRoute(page, `/admin/users/${user.id}`);
        await expect(page.getByRole('heading', { name: user.username })).toBeVisible();
        await expect(page.getByText('当前范围：2 个游戏')).toBeVisible();
        await expect(page.getByText('大杀四方')).toBeVisible();
        await expect(page.getByText('王权骰铸')).toBeVisible();
        await expect(page.locator('tr', { hasText: '对手甲' })).toBeVisible();
        await expect(page.locator('tr', { hasText: '对手甲' }).getByText('胜利')).toBeVisible();
    });
});
