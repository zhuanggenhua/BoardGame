import type { GameManifestEntry } from '../manifest.types';

const entry: GameManifestEntry = {
    id: 'tictactoe',
    type: 'game',
    enabled: true,
    titleKey: 'games.tictactoe.title',
    descriptionKey: 'games.tictactoe.description',
    category: 'abstract',
    playersKey: 'games.tictactoe.players',
    icon: '#',
    cursorTheme: 'tictactoe-neon',
};

export const TIC_TAC_TOE_MANIFEST: GameManifestEntry = entry;

export default entry;
