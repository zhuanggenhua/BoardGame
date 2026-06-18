import type { GameManifestEntry } from '../../games/manifest.types';

const entry: GameManifestEntry = {
    id: 'fxpreview',
    type: 'tool',
    enabled: true,
    titleKey: 'games.fxpreview.title',
    descriptionKey: 'games.fxpreview.description',
    category: 'tools',
    playersKey: 'games.fxpreview.players',
    icon: 'FX',
    mobileProfile: 'none',
    shellTargets: ['pwa', 'app-webview', 'mini-program-webview'],
    ai: {
        capture: false,
        localAi: false,
        remoteAi: false,
    },
};

export const FX_PREVIEW_MANIFEST: GameManifestEntry = entry;

export default entry;
