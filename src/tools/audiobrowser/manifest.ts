import type { GameManifestEntry } from '../../games/manifest.types';

const entry: GameManifestEntry = {
    id: 'audiobrowser',
    type: 'tool',
    enabled: true,
    titleKey: 'games.audiobrowser.title',
    descriptionKey: 'games.audiobrowser.description',
    category: 'tools',
    playersKey: 'games.audiobrowser.players',
    icon: 'AU',
    mobileProfile: 'none',
    shellTargets: ['pwa', 'app-webview', 'mini-program-webview'],
    ai: {
        capture: false,
        localAi: false,
        remoteAi: false,
    },
};

export const AUDIO_BROWSER_MANIFEST: GameManifestEntry = entry;

export default entry;
