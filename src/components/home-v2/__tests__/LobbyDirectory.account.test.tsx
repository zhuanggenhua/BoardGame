import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GameConfig } from '../../../config/games.config';

let mockUser: {
    id: string;
    username: string;
    role: 'user' | 'developer' | 'admin';
    banned: boolean;
    feedbackPoints: number;
    avatar?: string;
} | null = null;

vi.mock('react-i18next', async () => {
    const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next');
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string, options?: string | { defaultValue?: string }) => {
                if (typeof options === 'string') {
                    return options;
                }
                return options?.defaultValue ?? key;
            },
            i18n: {
                language: 'zh-CN',
                resolvedLanguage: 'zh-CN',
            },
        }),
    };
});

vi.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({
        user: mockUser,
        logout: vi.fn(),
    }),
    isBackofficeRole: (role: string | undefined | null) => role === 'admin' || role === 'developer',
}));

vi.mock('../../../contexts/ModalStackContext', () => ({
    useModalStack: () => ({
        openModal: vi.fn(() => 'modal-id'),
        closeModal: vi.fn(),
    }),
}));

vi.mock('../../../contexts/SocialContext', () => ({
    useSocial: () => ({
        requests: [],
        unreadTotal: 0,
        ensureRealtimeConnection: vi.fn(),
    }),
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
    return {
        ...actual,
        useNavigate: () => vi.fn(),
    };
});

import { OverviewSpread } from '../LobbyDirectory';

const buildGame = (): GameConfig => ({
    id: 'demo',
    type: 'game',
    enabled: true,
    titleKey: 'games.demo.title',
    descriptionKey: 'games.demo.description',
    category: 'card',
    playersKey: 'games.demo.players',
    icon: '🎲',
    thumbnail: null,
    allowLocalMode: false,
    playerOptions: [2],
    tags: ['card_driven'],
    bestPlayers: [2],
    ai: {
        capture: false,
        localAi: false,
        remoteAi: false,
    },
});

describe('LobbyDirectory account entry', () => {
    beforeEach(() => {
        mockUser = null;
    });

    it('未登录时书本首页账户区继续显示登录入口', () => {
        const html = renderToStaticMarkup(
            <OverviewSpread
                games={[buildGame()]}
                activeCategory="all"
                onCategoryChange={() => undefined}
                onGameClick={() => undefined}
                onAccountClick={() => undefined}
            />,
        );

        expect(html).toContain('data-testid="home-v2-account-entry"');
        expect(html).toContain('登录');
        expect(html).not.toContain('data-testid="reward-points-badge"');
    });

    it('已登录时书本首页账户区应切换到用户菜单并显示积分', () => {
        mockUser = {
            id: 'user-1',
            username: '书友甲',
            role: 'user',
            banned: false,
            feedbackPoints: 12,
        };

        const html = renderToStaticMarkup(
            <OverviewSpread
                games={[buildGame()]}
                activeCategory="all"
                onCategoryChange={() => undefined}
                onGameClick={() => undefined}
                onAccountClick={() => undefined}
            />,
        );

        expect(html).toContain('data-testid="home-v2-account-entry"');
        expect(html).toContain('data-testid="reward-points-badge"');
        expect(html).toContain('书友甲');
        expect(html).toContain('12');
    });
});
