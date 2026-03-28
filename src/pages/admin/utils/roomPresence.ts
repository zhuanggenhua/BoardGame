import type { RoomPresencePlayer } from '../components/RoomPlayerStatusList';

export const summarizeRoomPlayers = (players: RoomPresencePlayer[]) => {
    const total = players.length;
    const connected = players.filter((player) => player.isConnected).length;
    return {
        total,
        connected,
        offline: Math.max(0, total - connected),
    };
};
