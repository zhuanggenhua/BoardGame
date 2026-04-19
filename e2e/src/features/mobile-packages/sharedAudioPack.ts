export const SHARED_AUDIO_PACK_GAME_ID = 'common-audio';
export const SHARED_AUDIO_PACK_ID = 'common-audio';

export const isSharedAudioPackGameId = (gameId?: string) =>
    typeof gameId === 'string' && gameId.trim() === SHARED_AUDIO_PACK_GAME_ID;
