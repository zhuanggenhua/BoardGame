/* @vitest-environment happy-dom */

import { createElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { OverviewSpread, type HomeV2ContinueMatch } from '../LobbyDirectory';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => options?.defaultValue ?? key,
        i18n: { language: 'zh-CN', resolvedLanguage: 'zh-CN', changeLanguage: vi.fn() },
    }),
}));

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
