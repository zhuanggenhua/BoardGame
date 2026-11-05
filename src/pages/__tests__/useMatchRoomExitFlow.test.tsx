/* @vitest-environment happy-dom */
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMatchRoomExitFlow } from '../useMatchRoomExitFlow';

const mocks = vi.hoisted(() => ({
    clearMatchCredentials: vi.fn(),
    clearOwnerActiveMatch: vi.fn(),
    closeAll: vi.fn(),
    closeModal: vi.fn(),
    destroyMatch: vi.fn(),
    leaveMatch: vi.fn(),
    navigate: vi.fn(),
    notifyExitMatchErrorToast: vi.fn(),
    openModal: vi.fn(),
    suppressOwnerActiveMatch: vi.fn(),
    toastError: vi.fn(),
    toastWarning: vi.fn(),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('../../contexts/ModalStackContext', () => ({
    useModalStack: () => ({
        openModal: mocks.openModal,
        closeModal: mocks.closeModal,
        closeAll: mocks.closeAll,
    }),
}));

vi.mock('../../contexts/ToastContext', () => ({
    useToast: () => ({
        error: mocks.toastError,
        warning: mocks.toastWarning,
    }),
}));

vi.mock('../../hooks/match/useMatchStatus', () => ({
    clearMatchCredentials: mocks.clearMatchCredentials,
    clearOwnerActiveMatch: mocks.clearOwnerActiveMatch,
    destroyMatch: mocks.destroyMatch,
    leaveMatch: mocks.leaveMatch,
    suppressOwnerActiveMatch: mocks.suppressOwnerActiveMatch,
}));

vi.mock('../../components/lobby/roomActions', () => ({
    notifyExitMatchErrorToast: mocks.notifyExitMatchErrorToast,
}));

describe('useMatchRoomExitFlow', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('REST 房间状态确认不存在时会清理本地记录并返回大厅', async () => {
        renderHook(() => useMatchRoomExitFlow({
            gameId: 'dicethrone',
            matchId: 'VN_Zn4ofCG2',
            statusPlayerID: '0',
            credentials: 'player-credential',
            matchStatusIsHost: true,
            isTutorialRoute: false,
            shouldAutoJoin: false,
            isAutoJoining: false,
            autoJoinGraceActive: false,
            onlineTransportError: null,
            matchStatusErrorKind: 'not_found',
            navigate: mocks.navigate,
        }));

        await waitFor(() => {
            expect(mocks.clearMatchCredentials).toHaveBeenCalledWith('VN_Zn4ofCG2');
        });
        expect(mocks.clearOwnerActiveMatch).toHaveBeenCalledWith('VN_Zn4ofCG2');
        expect(mocks.suppressOwnerActiveMatch).toHaveBeenCalledWith('VN_Zn4ofCG2');
        expect(mocks.toastWarning).toHaveBeenCalledWith(
            { kind: 'i18n', key: 'error.roomDestroyed', ns: 'lobby' },
            undefined,
            { dedupeKey: 'matchRoom.missing.VN_Zn4ofCG2' },
        );
        expect(mocks.closeAll).toHaveBeenCalledWith({ skipOnClose: true });
        expect(mocks.navigate).toHaveBeenCalledWith('/?game=dicethrone', { replace: true });
    });
});
