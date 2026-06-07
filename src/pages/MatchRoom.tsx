import { useTranslation } from 'react-i18next';
import { useLocation, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useDebug } from '../contexts/DebugContext';
import { useAuth } from '../contexts/AuthContext';
import { useModalStack } from '../contexts/ModalStackContext';
import { usePerformanceMonitor } from '../hooks/ui/usePerformanceMonitor';
import { MatchRoomBlockingGate } from './matchRoomBlockingState';
import { MatchRoomPageShell } from './matchRoomPageShell';
import { useMatchRoomPageModel } from './useMatchRoomPageModel';

export const MatchRoom = () => {
    usePerformanceMonitor();
    const { playerID: debugPlayerID, setPlayerID } = useDebug();
    const { gameId, matchId, tutorialId } = useParams();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { openModal, closeModal } = useModalStack();
    const { t: tLobby, i18n } = useTranslation('lobby');
    const { user, token } = useAuth();

    const model = useMatchRoomPageModel({
        gameId,
        matchId,
        tutorialId,
        pathname: location.pathname,
        searchParams,
        navigate,
        debugPlayerID,
        setPlayerID,
        openModal,
        closeModal,
        tLobby,
        i18n,
        userId: user?.id,
        username: user?.username,
        token,
    });

    if (model.blockingState.kind !== 'ready') {
        return (
            <MatchRoomBlockingGate state={model.blockingState} />
        );
    }

    return <MatchRoomPageShell shell={model.shell} />;
};
