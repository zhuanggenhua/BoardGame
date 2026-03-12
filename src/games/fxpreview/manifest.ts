import type { GameManifestEntry } from '../manifest.types';

const entry: GameManifestEntry = {
    id: 'fxpreview',
    type: 'tool',
    enabled: true,
    titleKey: 'games.fxpreview.title',
    descriptionKey: 'games.fxpreview.description',
    category: 'tools',
    playersKey: 'games.fxpreview.players',
    icon: '🎬',
    mobileProfile: 'none',
    shellTargets: ['pwa'],
};

export const FX_PREVIEW_MANIFEST: GameManifestEntry = entry;

export default entry;
