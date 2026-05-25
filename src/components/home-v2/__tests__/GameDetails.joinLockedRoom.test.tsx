/* @vitest-environment happy-dom */

import { createElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Right as GameDetailsRight } from '../GameDetails';
import * as matchApi from '../../../services/matchApi';
import * as matchStatus from '../../../hooks/match/useMatchStatus';

const navigateMock = vi.fn();
const toastErrorMock = vi.fn();
const toastWarningMock = vi.fn();
const lockedMatches = [{
    matchID: 'match-locked-1',
    players: [
        { id: 0, name: 'Host' },
        { id: 1, name: undefined },
    ],
    totalSeats: 2,
    gameName: 'tictactoe',
    roomName: '加锁房间',
    ownerKey: 'owner-2',
    ownerType: 'guest',
    isLocked: true,
}];

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => options?.defaultValue ?? key,
        i18n: { language: 'zh-CN' },
    }),
}));

vi.mock('react-router-dom', () => ({
    useNavigate: () => navigateMock,
}));

vi.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({
        user: null,
        token: null,
    }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
    useToast: () => ({
        error: toastErrorMock,
        warning: toastWarningMock,
    }),
}));

vi.mock('../../../hooks/useLobbyMatchPresence', () => ({
    useLobbyMatchPresence: () => ({
        matches: lockedMatches,
        hasSnapshot: true,
    }),
}));

vi.mock('../../../hooks/ui/useHomeV2CompactLandscape', () => ({
    useHomeV2CompactLandscape: () => false,
}));

vi.mock('../../../hooks/match/ownerIdentity', () => ({
    getOrCreateGuestId: () => 'guest-1',
    getGuestName: () => 'Guest',
    getOwnerKey: () => 'owner-1',
    getOwnerType: () => 'guest',
}));

vi.mock('../../../hooks/match/useMatchStatus', () => ({
    claimSeat: vi.fn(),
    clearOwnerActiveMatch: vi.fn(),
    getOwnerActiveMatch: vi.fn(() => null),
    persistMatchCredentials: vi.fn(),
    setOwnerActiveMatch: vi.fn(),
}));

vi.mock('../../../api/review', () => ({
    fetchReviews: vi.fn(async () => []),
    fetchReviewStats: vi.fn(async () => null),
}));

vi.mock('../../../config/server', () => ({
    GAME_CHANGELOG_API_URL: 'http://test.example/game-changelogs',
    GAME_SERVER_URL: 'http://test.example',
}));

vi.mock('../../lobby/CreateRoomModal', () => ({
    CreateRoomModal: () => null,
}));

vi.mock('../../common/overlays/HomeV2PaperModalFrame', () => ({
    HomeV2PaperModalFrame: ({ children, dataTestId }: { children: React.ReactNode; dataTestId?: string }) => createElement('div', { 'data-testid': dataTestId }, children),
}));

vi.mock('../../common/PasswordField', () => ({
    PasswordField: ({
        value,
        onChange,
        toggleButtonTestId,
        ...props
    }: {
        value: string;
        onChange: (event: { target: { value: string } }) => void;
        toggleButtonTestId?: string;
        [key: string]: unknown;
    }) => createElement('div', null,
        createElement('input', {
            ...props,
            value,
            onChange: (event: Event) => {
                const target = event.target as HTMLInputElement;
                onChange({ target: { value: target.value } });
            },
        }),
        toggleButtonTestId
            ? createElement('button', { type: 'button', 'data-testid': toggleButtonTestId }, 'toggle')
            : null,
    ),
}));

vi.mock('../../lobby/gameDetailsContent', () => ({
    resolveGameAuthorName: () => '',
    resolveGameDisplayName: (game: { id: string }) => game.id,
    resolveGameDescription: () => 'desc',
}));

afterEach(() => {
    vi.clearAllMocks();
});

describe('HomeV2 GameDetails locked room join', () => {
    it('确认密码后会先 getMatch，再带密码 join，并导航到返回的座位', async () => {
        const getMatchSpy = vi.spyOn(matchApi, 'getMatch').mockResolvedValueOnce({
            matchID: 'match-locked-1',
            gameName: 'tictactoe',
            players: [
                { id: 0, name: 'Host' },
                { id: 1, name: undefined },
            ],
        });
        const joinMatchSpy = vi.spyOn(matchApi, 'joinMatch').mockResolvedValueOnce({
            playerID: '1',
            playerCredentials: 'cred-1',
        });

        render(createElement(GameDetailsRight, {
            game: {
                id: 'tictactoe',
                type: 'game',
                enabled: true,
                titleKey: 'games.tictactoe.title',
                descriptionKey: 'games.tictactoe.description',
                category: 'abstract',
                playersKey: 'games.tictactoe.players',
                icon: 'XO',
                playerOptions: [2],
            },
        }));

        fireEvent.click(screen.getByRole('button', { name: /加锁房间/ }));

        const passwordInput = await screen.findByTestId('home-v2-room-password-input');
        fireEvent.change(passwordInput, { target: { value: '654321' } });
        fireEvent.click(screen.getByTestId('home-v2-room-password-confirm'));

        await waitFor(() => {
            expect(getMatchSpy).toHaveBeenCalledWith('tictactoe', 'match-locked-1');
        });
        await waitFor(() => {
            expect(joinMatchSpy).toHaveBeenCalledWith('tictactoe', 'match-locked-1', expect.objectContaining({
                playerID: '1',
                playerName: 'Guest',
                data: expect.objectContaining({
                    guestId: 'guest-1',
                    password: '654321',
                }),
            }));
        });
        expect(vi.mocked(matchStatus.persistMatchCredentials)).toHaveBeenCalledWith('match-locked-1', expect.objectContaining({
            playerID: '1',
            credentials: 'cred-1',
            gameName: 'tictactoe',
        }));
        await waitFor(() => {
            expect(navigateMock).toHaveBeenCalledWith('/play/tictactoe/match/match-locked-1?playerID=1');
        });
    });
});
