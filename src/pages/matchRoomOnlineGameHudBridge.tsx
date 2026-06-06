import { GameHUD } from '../components/game/framework/widgets/GameHUD';
import {
    useMatchRoomOnlineHudModel,
    type MatchRoomOnlineHudBridgeProps,
} from './useMatchRoomOnlineHudModel';

export const OnlineGameHudBridge = (props: MatchRoomOnlineHudBridgeProps) => {
    const hudModel = useMatchRoomOnlineHudModel(props);
    return <GameHUD {...hudModel} />;
};
