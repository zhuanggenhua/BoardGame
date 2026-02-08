import type { GameManifestEntry } from '../manifest.types';

const entry: GameManifestEntry = {
    id: 'audiobrowser',
    type: 'tool',
    enabled: true,
    titleKey: 'games.audiobrowser.title',
    descriptionKey: 'games.audiobrowser.description',
    category: 'tools',
    playersKey: 'games.audiobrowser.players',
    icon: '🔊',
};

export const AUDIO_BROWSER_MANIFEST: GameManifestEntry = entry;

export default entry;
