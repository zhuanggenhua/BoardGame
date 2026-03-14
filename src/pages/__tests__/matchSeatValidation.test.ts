/* @vitest-environment happy-dom */
import { createElement } from 'react';
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as matchApi from '../../services/matchApi';
import { isMatchNotFoundError, useMatchStatus, validateStoredMatchSeat, type StoredMatchCredentials } from '../../hooks/match/useMatchStatus';

type Player = { id: number; name?: string | null };

const buildStored = (overrides?: Partial<StoredMatchCredentials>): StoredMatchCredentials => ({
    matchID: 'match-1',
    playerID: '0',
    playerName: 'Alice',
    ...overrides,
});

const buildPlayers = (players: Player[]): Player[] => players;

describe('validateStoredMatchSeat', () => {
    it('缺失本地信息时不清理', () => {
        expect(validateStoredMatchSeat(null, [], '0').shouldClear).toBe(false);
        expect(validateStoredMatchSeat(buildStored({ playerID: undefined }), [], '0').shouldClear).toBe(false);
    });

    it('playerID 不匹配时不清理', () => {
        const stored = buildStored({ playerID: '0' });
        expect(validateStoredMatchSeat(stored, buildPlayers([{ id: 0, name: 'Alice' }]), '1').shouldClear).toBe(false);
    });

    it('座位不存在时清理', () => {
        const stored = buildStored();
        const result = validateStoredMatchSeat(stored, buildPlayers([{ id: 1, name: 'Bob' }]), '0');
        expect(result.shouldClear).toBe(true);
        expect(result.reason).toBe('missing_seat');
    });

    it('座位为空时清理', () => {
        const stored = buildStored();
        const result = validateStoredMatchSeat(stored, buildPlayers([{ id: 0, name: '' }]), '0');
        expect(result.shouldClear).toBe(true);
        expect(result.reason).toBe('seat_empty');
    });

    it('昵称不一致时不清理（凭据才是认证手段）', () => {
        const stored = buildStored({ playerName: 'Alice' });
        const result = validateStoredMatchSeat(stored, buildPlayers([{ id: 0, name: 'Carol' }]), '0');
        expect(result.shouldClear).toBe(false);
    });

    it('昵称一致时不清理', () => {
        const stored = buildStored({ playerName: 'Alice' });
        const result = validateStoredMatchSeat(stored, buildPlayers([{ id: 0, name: 'Alice' }]), '0');
        expect(result.shouldClear).toBe(false);
    });

    it('本地无昵称时不做昵称校验', () => {
        const stored = buildStored({ playerName: undefined });
        const result = validateStoredMatchSeat(stored, buildPlayers([{ id: 0, name: 'Any' }]), '0');
        expect(result.shouldClear).toBe(false);
    });
});

describe('isMatchNotFoundError', () => {
    it('识别 404 异常对象', () => {
        expect(isMatchNotFoundError({ status: 404, message: 'Match not found' })).toBe(true);
    });

    it('识别带 404 文本的 Error', () => {
        expect(isMatchNotFoundError(new Error('404: Match not found'))).toBe(true);
    });

    it('忽略非 404 错误', () => {
        expect(isMatchNotFoundError(new Error('500: network error'))).toBe(false);
    });
});

describe('useMatchStatus 竞态保护', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        cleanup();
    });

    it('切换 matchID 后，旧请求 404 不会污染新房间状态', async () => {
        let rejectOldRequest!: (reason?: unknown) => void;
        const oldRequest = new Promise<never>((_, reject) => {
            rejectOldRequest = reject;
        });

        const getMatchSpy = vi.spyOn(matchApi, 'getMatch').mockImplementation(async (_gameName, matchID) => {
            if (matchID === 'old-match') {
                return oldRequest as never;
            }
            return {
                matchID: 'new-match',
                gameName: 'dicethrone',
                players: [{ id: 0, name: 'Alice', isConnected: true }],
            };
        });

        const { result, rerender } = renderHook(
            ({ id }) => useMatchStatus('dicethrone', id, '0'),
            { initialProps: { id: 'old-match' as string | undefined } }
        );

        await waitFor(() => {
            expect(getMatchSpy).toHaveBeenCalledWith('dicethrone', 'old-match');
        });

        rerender({ id: 'new-match' });

        await waitFor(() => {
            expect(getMatchSpy).toHaveBeenCalledWith('dicethrone', 'new-match');
        });

        await act(async () => {
            rejectOldRequest(new Error('404: Match not found'));
            await Promise.resolve();
        });

        await waitFor(() => {
            expect(result.current.matchID).toBe('new-match');
            expect(result.current.error).toBeNull();
            expect(result.current.isLoading).toBe(false);
        });
    });
});

describe('Home 活跃对局缺房确认', () => {
    let Home: typeof import('../Home').Home;
    let latestStoredMatch: StoredMatchCredentials | null;
    let storedMatch: StoredMatchCredentials | null;
    let lobbyPresenceState: {
        matches: Array<{ matchID: string; gameName: string; players: unknown[] }>;
        hasSnapshot: boolean;
        hasSeen: boolean;
        exists: boolean;
        isMissing: boolean;
    };
    let getMatchMock: ReturnType<typeof vi.fn>;
    let clearMatchCredentialsMock: ReturnType<typeof vi.fn>;
    let clearOwnerActiveMatchMock: ReturnType<typeof vi.fn>;
    let publishMatchCleanupNoticeMock: ReturnType<typeof vi.fn>;
    let markMatchCleanupNoticeSeenMock: ReturnType<typeof vi.fn>;
    let toastWarningMock: ReturnType<typeof vi.fn>;
    let toastErrorMock: ReturnType<typeof vi.fn>;
    let navigateMock: ReturnType<typeof vi.fn>;
    let setSearchParamsMock: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        vi.resetModules();

        latestStoredMatch = {
            matchID: 'match-1',
            playerID: '0',
            credentials: 'cred-1',
            gameName: 'tictactoe',
            updatedAt: 1,
        };
        storedMatch = latestStoredMatch;
        lobbyPresenceState = {
            matches: [{ matchID: 'match-1', gameName: 'tictactoe', players: [] }],
            hasSnapshot: true,
            hasSeen: true,
            exists: true,
            isMissing: false,
        };

        getMatchMock = vi.fn()
            .mockResolvedValueOnce({
                matchID: 'match-1',
                gameName: 'tictactoe',
                players: [{ id: 0, name: 'Alice', isConnected: true }],
            })
            .mockResolvedValueOnce({
                matchID: 'match-1',
                gameName: 'tictactoe',
                players: [{ id: 0, name: 'Alice', isConnected: true }],
            })
            .mockRejectedValueOnce(new Error('404: not found'));

        clearMatchCredentialsMock = vi.fn(() => {
            latestStoredMatch = null;
            storedMatch = null;
        });
        clearOwnerActiveMatchMock = vi.fn();
        publishMatchCleanupNoticeMock = vi.fn(() => ({
            matchID: 'match-1',
            reason: 'destroyed',
            timestamp: Date.now(),
            nonce: 'notice-1',
        }));
        markMatchCleanupNoticeSeenMock = vi.fn();
        toastWarningMock = vi.fn();
        toastErrorMock = vi.fn();
        navigateMock = vi.fn();
        setSearchParamsMock = vi.fn();

        vi.doMock('react-router-dom', () => ({
            useNavigate: () => navigateMock,
            useSearchParams: () => [new URLSearchParams(), setSearchParamsMock],
        }));

        vi.doMock('react-i18next', () => ({
            useTranslation: () => ({
                t: (key: string) => key,
                i18n: { resolvedLanguage: 'zh-CN', language: 'zh-CN' },
            }),
        }));

        vi.doMock('../../components/layout/CategoryPills', () => ({
            CategoryPills: () => null,
        }));
        vi.doMock('../../components/lobby/GameDetailsModal', () => ({
            GameDetailsModal: () => null,
        }));
        vi.doMock('../../components/lobby/GameList', () => ({
            GameList: () => null,
        }));
        vi.doMock('../../components/auth/AuthModal', () => ({
            AuthModal: () => null,
        }));
        vi.doMock('../../components/common/overlays/ConfirmModal', () => ({
            ConfirmModal: () => null,
        }));
        vi.doMock('../../components/common/i18n/LanguageSwitcher', () => ({
            LanguageSwitcher: () => null,
        }));
        vi.doMock('../../components/social/UserMenu', () => ({
            UserMenu: () => null,
        }));
        vi.doMock('../../components/common/SEO', () => ({
            SEO: () => null,
        }));

        vi.doMock('../../config/games.config', () => ({
            getGamesByCategory: () => [],
            getGameById: () => null,
            refreshUgcGames: vi.fn().mockResolvedValue(undefined),
            subscribeGameRegistry: () => () => undefined,
        }));

        vi.doMock('../../contexts/AuthContext', () => ({
            useAuth: () => ({
                user: null,
                token: null,
                logout: vi.fn(),
            }),
        }));

        vi.doMock('../../contexts/ModalStackContext', () => ({
            useModalStack: () => ({
                openModal: vi.fn(() => 'modal-1'),
                closeModal: vi.fn(),
            }),
        }));

        vi.doMock('../../contexts/ToastContext', () => ({
            useToast: () => ({
                warning: toastWarningMock,
                error: toastErrorMock,
            }),
        }));

        vi.doMock('../../hooks/routing/useUrlModal', () => ({
            useUrlModal: () => ({
                navigateAwayRef: { current: vi.fn() },
            }),
        }));

        vi.doMock('../../hooks/useLobbyStats', () => ({
            useLobbyStats: () => ({ mostPopularGameId: null }),
        }));

        vi.doMock('../../hooks/useLobbyMatchPresence', () => ({
            useLobbyMatchPresence: () => lobbyPresenceState,
        }));

        vi.doMock('../../core/cursor/useGlobalCursor', () => ({
            useGlobalCursor: () => undefined,
        }));

        vi.doMock('../../services/matchApi', () => ({
            getMatch: getMatchMock,
        }));

        vi.doMock('../../hooks/match/useMatchStatus', async () => {
            const actual = await vi.importActual<typeof import('../../hooks/match/useMatchStatus')>('../../hooks/match/useMatchStatus');
            return {
                ...actual,
                getLatestStoredMatchCredentials: () => latestStoredMatch,
                pruneStoredMatchCredentials: vi.fn(),
                getOwnerActiveMatch: () => null,
                clearMatchCredentials: clearMatchCredentialsMock,
                clearOwnerActiveMatch: clearOwnerActiveMatchMock,
                publishMatchCleanupNotice: publishMatchCleanupNoticeMock,
                readMatchCleanupNotice: () => null,
                hasSeenMatchCleanupNotice: () => false,
                markMatchCleanupNoticeSeen: markMatchCleanupNoticeSeenMock,
                isOwnerActiveMatchSuppressed: () => false,
                readStoredMatchCredentials: () => storedMatch,
            };
        });

        Home = (await import('../Home')).Home;
    });

    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('宽限期确认成功后会重置确认标记，后续真正销毁时仍会再次确认并清理', async () => {
        const { rerender } = render(createElement(Home));

        await screen.findByText('lobby:home.activeMatch.status');
        expect(getMatchMock).toHaveBeenCalledTimes(1);

        lobbyPresenceState = {
            ...lobbyPresenceState,
            matches: [],
            exists: false,
            isMissing: true,
        };
        rerender(createElement(Home));

        await waitFor(() => {
            expect(getMatchMock).toHaveBeenCalledTimes(2);
        });
        expect(clearMatchCredentialsMock).not.toHaveBeenCalled();
        expect(clearOwnerActiveMatchMock).not.toHaveBeenCalled();

        lobbyPresenceState = {
            ...lobbyPresenceState,
            matches: [{ matchID: 'match-1', gameName: 'tictactoe', players: [] }],
            exists: true,
            isMissing: false,
        };
        rerender(createElement(Home));

        lobbyPresenceState = {
            ...lobbyPresenceState,
            matches: [],
            exists: false,
            isMissing: true,
        };
        rerender(createElement(Home));

        await waitFor(() => {
            expect(getMatchMock).toHaveBeenCalledTimes(3);
            expect(clearMatchCredentialsMock).toHaveBeenCalledWith('match-1');
        });
        expect(clearOwnerActiveMatchMock).toHaveBeenCalledWith('match-1');
        expect(markMatchCleanupNoticeSeenMock).toHaveBeenCalled();
        expect(toastWarningMock).toHaveBeenCalledWith({ kind: 'i18n', key: 'error.roomDestroyed', ns: 'lobby' });
        await waitFor(() => {
            expect(screen.queryByText('lobby:home.activeMatch.status')).toBeNull();
        });
    });

    it('缺房确认遇到非 404 时会延迟重试，直到后续确认 404 再清理', async () => {
        vi.useFakeTimers();
        getMatchMock.mockReset()
            .mockResolvedValueOnce({
                matchID: 'match-1',
                gameName: 'tictactoe',
                players: [{ id: 0, name: 'Alice', isConnected: true }],
            })
            .mockRejectedValueOnce(new Error('500: transient error'))
            .mockRejectedValueOnce(new Error('404: not found'));

        try {
            const flushEffects = async () => {
                await act(async () => {
                    await Promise.resolve();
                });
                await act(async () => {
                    await Promise.resolve();
                });
            };

            const { rerender } = render(createElement(Home));
            await flushEffects();
            expect(getMatchMock).toHaveBeenCalledTimes(1);

            lobbyPresenceState = {
                ...lobbyPresenceState,
                matches: [],
                exists: false,
                isMissing: true,
            };
            rerender(createElement(Home));
            await flushEffects();
            expect(getMatchMock).toHaveBeenCalledTimes(2);
            expect(clearMatchCredentialsMock).not.toHaveBeenCalled();

            await act(async () => {
                await vi.advanceTimersByTimeAsync(1500);
            });
            await flushEffects();

            expect(getMatchMock).toHaveBeenCalledTimes(3);
            expect(clearMatchCredentialsMock).toHaveBeenCalledWith('match-1');
            expect(clearOwnerActiveMatchMock).toHaveBeenCalledWith('match-1');
            expect(toastWarningMock).toHaveBeenCalledWith({ kind: 'i18n', key: 'error.roomDestroyed', ns: 'lobby' });
        } finally {
            vi.useRealTimers();
        }
    });

    it('大厅快照持续更新时不会取消进行中的缺房确认', async () => {
        let rejectMissingCheck!: (reason?: unknown) => void;
        const pendingMissingCheck = new Promise<never>((_, reject) => {
            rejectMissingCheck = reject;
        });

        getMatchMock.mockReset()
            .mockResolvedValueOnce({
                matchID: 'match-1',
                gameName: 'tictactoe',
                players: [{ id: 0, name: 'Alice', isConnected: true }],
            })
            .mockImplementationOnce(() => pendingMissingCheck)
            .mockImplementation(() => new Promise(() => undefined));

        const { rerender } = render(createElement(Home));

        await screen.findByText('lobby:home.activeMatch.status');
        expect(getMatchMock).toHaveBeenCalledTimes(1);

        lobbyPresenceState = {
            ...lobbyPresenceState,
            matches: [],
            exists: false,
            isMissing: true,
        };
        rerender(createElement(Home));

        await waitFor(() => {
            expect(getMatchMock).toHaveBeenCalledTimes(2);
        });

        lobbyPresenceState = {
            ...lobbyPresenceState,
            matches: [{ matchID: 'match-2', gameName: 'tictactoe', players: [] }],
            exists: false,
            isMissing: true,
        };
        await act(async () => {
            rerender(createElement(Home));
            await Promise.resolve();
        });

        expect(getMatchMock).toHaveBeenCalledTimes(2);

        await act(async () => {
            rejectMissingCheck({ status: 404, message: 'Match not found' });
            await Promise.resolve();
        });

        await waitFor(() => {
            expect(clearMatchCredentialsMock).toHaveBeenCalledWith('match-1');
            expect(clearOwnerActiveMatchMock).toHaveBeenCalledWith('match-1');
        });
        expect(markMatchCleanupNoticeSeenMock).toHaveBeenCalled();
        expect(toastWarningMock).toHaveBeenCalledWith({ kind: 'i18n', key: 'error.roomDestroyed', ns: 'lobby' });
    });
});
