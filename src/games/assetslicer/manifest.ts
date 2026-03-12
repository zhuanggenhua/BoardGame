import type { GameManifestEntry } from '../manifest.types';

const entry: GameManifestEntry = {
    id: 'assetslicer',
    type: 'tool',
    enabled: true,
    titleKey: 'games.assetslicer.title',
    descriptionKey: 'games.assetslicer.description',
    category: 'tools',
    playersKey: 'games.assetslicer.players',
    icon: '✂️',
    mobileProfile: 'none',
    shellTargets: ['pwa'],
};

export const ASSET_SLICER_MANIFEST: GameManifestEntry = entry;

export default entry;
