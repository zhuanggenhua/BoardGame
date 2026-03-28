export type PlayerSeat = {
    name?: string;
    credentials?: string;
    isConnected?: boolean | null;
};

export const isSeatOccupied = (player?: PlayerSeat | null): boolean => {
    if (!player) return false;
    return Boolean(player.name || player.credentials || player.isConnected);
};

export const hasOccupiedPlayers = (players?: Record<string, PlayerSeat> | null): boolean => {
    if (!players) return false;
    return Object.values(players).some(isSeatOccupied);
};

export const areAllSeatsOccupied = (players?: Record<string, PlayerSeat> | null): boolean => {
    if (!players) return false;
    const seats = Object.values(players);
    return seats.length > 0 && seats.every(isSeatOccupied);
};

export const isSupportedPlayerCount = (
    numPlayers: number,
    minPlayers: number,
    maxPlayers: number,
    allowedPlayerCounts?: number[] | null,
): boolean => {
    if (!Number.isInteger(numPlayers)) return false;
    if (allowedPlayerCounts && allowedPlayerCounts.length > 0) {
        return allowedPlayerCounts.includes(numPlayers);
    }
    return numPlayers >= minPlayers && numPlayers <= maxPlayers;
};
