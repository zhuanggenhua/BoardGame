/* @vitest-environment happy-dom */

import { createElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { OverviewSpread, type HomeV2ContinueMatch } from '../LobbyDirectory';
import { rankGamesForLobbyDirectory, sortGamesForLobbyDirectory } from '../lobbyDirectorySorting';

vi.mock('react-i18next', async () => {
    const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next');
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string, options?: Record<string, unknown>) => options?.defaultValue ?? key,
            i18n: { language: 'zh-CN', resolvedLanguage: 'zh-CN', changeLanguage: vi.fn() },
        }),
    };
});

vi.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({
        user: null,
    }),
}));

vi.mock('../../lobby/gameDetailsContent', () => ({
    resolveGameDisplayName: (game: { id: string }) => game.id,
}));

const baseGames = [{
    id: 'tictactoe',
    type: 'game',
    enabled: true,
    titleKey: 'games.tictactoe.title',
    descriptionKey: 'games.tictactoe.description',
    playersKey: 'games.tictactoe.players',
    category: 'abstract',
    playerOptions: [2],
    icon: 'XO',
}];

const buildGame = (id: string) => ({
    id,
    type: 'game',
    enabled: true,
    titleKey: `games.${id}.title`,
    descriptionKey: `games.${id}.description`,
    playersKey: `games.${id}.players`,
    category: 'abstract',
    playerOptions: [2],
    icon: id,
});

function renderOverview(continueMatch: HomeV2ContinueMatch | null, onDestroyContinueMatch = vi.fn()) {
    return render(createElement(OverviewSpread, {
        games: baseGames,
        activeCategory: 'all',
        onCategoryChange: vi.fn(),
        onGameClick: vi.fn(),
        onContinueMatch: vi.fn(),
        continueMatch,
        onDestroyContinueMatch,
    }));
}

describe('HomeV2 Overview continue match actions', () => {
    it('房主在首页总览态能看到销毁入口并触发回调', () => {
        const handleDestroy = vi.fn();
        const continueMatch: HomeV2ContinueMatch = {
            matchID: 'host-room-1',
            gameName: 'tictactoe',
            gameLabel: '井字棋',
            playerID: '0',
            playerLabel: '玩家 0',
            isHost: true,
        };

        renderOverview(continueMatch, handleDestroy);

        const destroyButton = screen.getByTestId('home-v2-continue-destroy-button');
        expect(destroyButton).toBeInTheDocument();

        fireEvent.click(destroyButton);
        expect(handleDestroy).toHaveBeenCalledWith(continueMatch);
    });

    it('非房主在首页总览态不显示销毁入口', () => {
        renderOverview({
            matchID: 'guest-room-1',
            gameName: 'tictactoe',
            gameLabel: '井字棋',
            playerID: '1',
            playerLabel: '玩家 1',
            isHost: false,
        });

        expect(screen.queryByTestId('home-v2-continue-destroy-button')).not.toBeInTheDocument();
    });
});

describe('HomeV2 Overview game ordering', () => {
    it('无热度数据时回退到固定精选顺序', () => {
        const ordered = sortGamesForLobbyDirectory([
            buildGame('tictactoe'),
            buildGame('smashup'),
            buildGame('cardia'),
            buildGame('dicethrone'),
        ], 'all');

        expect(ordered.map((game) => game.id)).toEqual(['dicethrone', 'cardia', 'smashup', 'tictactoe']);
    });

    it('有总时长数据时按热度降序排序，并对 gameId 大小写不敏感', () => {
        render(createElement(OverviewSpread, {
            games: [
                buildGame('cardia'),
                buildGame('smashup'),
                buildGame('tictactoe'),
            ],
            popularityByGameId: {
                TICTACTOE: 7200,
                smashup: 3600,
            },
            activeCategory: 'all',
            onCategoryChange: vi.fn(),
            onGameClick: vi.fn(),
        }));

        const renderedGameIds = Array.from(document.querySelectorAll<HTMLElement>('[data-game-id]'))
            .map((element) => element.dataset.gameId);

        expect(renderedGameIds).toEqual(['tictactoe', 'smashup', 'cardia']);
    });

    it('Dice Throne 热度最高时首页首位渲染 Dice Throne', () => {
        render(createElement(OverviewSpread, {
            games: [
                buildGame('cardia'),
                buildGame('dicethrone'),
                buildGame('smashup'),
            ],
            popularityByGameId: {
                cardia: 0.2,
                dicethrone: 0.9,
                smashup: 0.3,
            },
            activeCategory: 'all',
            onCategoryChange: vi.fn(),
            onGameClick: vi.fn(),
        }));

        const renderedGameIds = Array.from(document.querySelectorAll<HTMLElement>('[data-game-id]'))
            .map((element) => element.dataset.gameId);

        expect(renderedGameIds[0]).toBe('dicethrone');
    });

    it('实施中的游戏即使热度最高也排在已上线游戏后面', () => {
        const ordered = sortGamesForLobbyDirectory([
            buildGame('cardia'),
            {
                ...buildGame('qidahen'),
                statusTag: 'under_construction',
            },
            buildGame('smashup'),
        ], 'all', {
            qidahen: 999,
            cardia: 1,
            smashup: 0,
        });

        expect(ordered.map((game) => game.id)).toEqual(['cardia', 'smashup', 'qidahen']);
    });

    it('会输出可解释排序因子，并显示实施状态优先于热度生效', () => {
        const ranked = rankGamesForLobbyDirectory([
            buildGame('cardia'),
            {
                ...buildGame('qidahen'),
                statusTag: 'under_construction',
            },
        ], 'all', {
            qidahen: 1,
            cardia: 0,
        });

        expect(ranked.map(({ game }) => game.id)).toEqual(['cardia', 'qidahen']);
        expect(ranked[0].factors).toMatchObject({
            gameId: 'cardia',
            implementationStatusRank: 0,
            popularityScore: 0,
        });
        expect(ranked[1].factors).toMatchObject({
            gameId: 'qidahen',
            implementationStatusRank: 1,
            popularityScore: 1,
        });
    });

    it('会给当前在线最多的游戏显示经典同款热门标识', () => {
        render(createElement(OverviewSpread, {
            games: [
                buildGame('cardia'),
                buildGame('smashup'),
            ],
            mostPopularGameId: 'smashup',
            activeCategory: 'all',
            onCategoryChange: vi.fn(),
            onGameClick: vi.fn(),
        }));

        expect(screen.getByTestId('home-v2-hot-badge-smashup')).toBeInTheDocument();
        expect(screen.queryByTestId('home-v2-hot-badge-cardia')).not.toBeInTheDocument();
    });

    it('受控目录页码会渲染指定页，并通过分页按钮请求上层切页', () => {
        const handleCatalogPageChange = vi.fn();

        render(createElement(OverviewSpread, {
            games: ['game-1', 'game-2', 'game-3', 'game-4', 'game-5', 'game-6', 'game-7'].map(buildGame),
            activeCategory: 'all',
            catalogPageIndex: 1,
            onCatalogPageChange: handleCatalogPageChange,
            onCategoryChange: vi.fn(),
            onGameClick: vi.fn(),
        }));

        expect(screen.getByTestId('home-v2-catalog-page-label')).toHaveTextContent('2 / 2');
        expect(Array.from(document.querySelectorAll<HTMLElement>('[data-game-id]')).map((element) => element.dataset.gameId)).toEqual(['game-7']);

        fireEvent.click(screen.getByTestId('home-v2-catalog-prev-page'));

        expect(handleCatalogPageChange).toHaveBeenCalledWith(0);
    });
});
