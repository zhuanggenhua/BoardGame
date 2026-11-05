// Resource identities shared by rule diagnostics and client rendering.
import type { HeroState } from './types';

const CHARACTER_ASSET_DIR: Record<string, string> = {
    cursed_pirate: 'cursed',
    artificer: 'artificial',
    vampire_lord: 'xixuegui',
    zhizhuxia: 'zhizhuxia',
};

const getCharacterAssetBase = (charId: string = 'monk') => `dicethrone/images/${CHARACTER_ASSET_DIR[charId] ?? charId}`;

const getPlayerBoardAssetName = (charId: string, playerBoardFace?: HeroState['playerBoardFace']) => {
    if (charId === 'cursed_pirate' && playerBoardFace === 'normal') {
        return 'human-player-board';
    }
    return 'player-board';
};

export const getPlayerBoardAssetPath = (charId: string = 'monk', playerBoardFace?: HeroState['playerBoardFace']) =>
    withExtension(`${getCharacterAssetBase(charId)}/${getPlayerBoardAssetName(charId, playerBoardFace)}`, charId);

const withExtension = (path: string, _charId: string) => path;

export const ASSETS = {
    PLAYER_BOARD: (charId: string = 'monk', playerBoardFace?: HeroState['playerBoardFace']) =>
        getPlayerBoardAssetPath(charId, playerBoardFace),
    TIP_BOARD: (charId: string = 'monk') => withExtension(`${getCharacterAssetBase(charId)}/tip`, charId),
    CARDS_ATLAS: (charId: string = 'monk') => withExtension(`${getCharacterAssetBase(charId)}/ability-cards`, charId),
    HAND_CARDS_ATLAS: (charId: string = 'monk') =>
        withExtension(`${getCharacterAssetBase(charId)}/hand-cards-atlas`, charId),
    DICE_SPRITE: (charId: string = 'monk') => `${getCharacterAssetBase(charId)}/dice`,
    EFFECT_ICONS: (charId: string = 'monk') =>
        withExtension(`${getCharacterAssetBase(charId)}/status-icons-atlas`, charId),
    CARD_BG: 'dicethrone/images/Common/card-background',
    AVATAR: 'dicethrone/images/Common/character-portraits',
    NEW_AVATAR: 'dicethrone/images/Common/characterhead2',
};

export const DICE_ATLAS: {
    cols: number;
    rows: number;
    faceMap: Record<number, { col: number; row: number }>;
} = {
    cols: 3,
    rows: 3,
    faceMap: {
        1: { col: 0, row: 2 },
        2: { col: 0, row: 1 },
        3: { col: 1, row: 2 },
        4: { col: 1, row: 1 },
        5: { col: 2, row: 1 },
        6: { col: 2, row: 2 },
    },
};
