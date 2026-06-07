import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { setAssetsBaseUrl } from '../../core/AssetLoader';
import type { GameConfig } from '../../config/games.config';
import type { GameManifestEntry } from '../../games/manifest.types';
import { ManifestGameThumbnail } from '../lobby/thumbnails';
import { OverviewSpread } from '../home-v2/LobbyDirectory';
import { GameDetailsLeft } from '../home-v2/GameDetails';

vi.mock('react-i18next', async () => {
    const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next');
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
            i18n: {
                language: 'zh-CN',
                resolvedLanguage: 'zh-CN',
            },
        }),
    };
});

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({
        user: null,
    }),
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
    return {
        ...actual,
        useNavigate: () => vi.fn(),
    };
});

const buildManifest = (override: Partial<GameManifestEntry> = {}): GameManifestEntry => ({
    id: 'demo',
    type: 'game',
    enabled: true,
    titleKey: 'games.demo.title',
    descriptionKey: 'games.demo.description',
    category: 'card',
    playersKey: 'games.demo.players',
    icon: '🎲',
    thumbnailPath: 'demo/thumbnails/cover',
    allowLocalMode: false,
    playerOptions: [2],
    tags: ['card_driven'],
    bestPlayers: [2],
    ai: {
        capture: false,
        localAi: false,
        remoteAi: false,
    },
    ...override,
});

const buildGame = (): GameConfig => {
    const manifest = buildManifest();
    return {
        ...manifest,
        thumbnail: <ManifestGameThumbnail manifest={manifest} />,
    };
};

describe('Home V2 thumbnails', () => {
    beforeEach(() => {
        setAssetsBaseUrl('/assets');
    });

    it('目录页卡片继续复用 manifest 缩略图链路', () => {
        const game = buildGame();
        const html = renderToStaticMarkup(
            <OverviewSpread
                games={[game]}
                activeCategory="all"
                onCategoryChange={() => undefined}
                onGameClick={() => undefined}
            />,
        );

        expect(html).toContain('src="/assets/i18n/zh-CN/demo/thumbnails/compressed/cover.webp"');
        expect(html).not.toContain('reference-thumbnails');
    });

    it('详情页缩略图继续复用 manifest 缩略图链路', () => {
        const game = buildGame();
        const html = renderToStaticMarkup(
            <GameDetailsLeft game={game} onBack={() => undefined} />,
        );

        expect(html).toContain('src="/assets/i18n/zh-CN/demo/thumbnails/compressed/cover.webp"');
        expect(html).not.toContain('reference-thumbnails');
    });
});
