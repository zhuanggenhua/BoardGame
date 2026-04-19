import type { CSSProperties } from 'react';
import { HOME_V2_BOOK_SCENE, resolveArtboardRegion } from '../../ugc/runtime';

export const HOME_V2_TAB_ORDER = ['lobby', 'rooms', 'leaderboard', 'changelog', 'about'] as const;
export type HomeV2TabId = typeof HOME_V2_TAB_ORDER[number];

const HOME_V2_TAB_REGION_IDS: Record<HomeV2TabId, string> = {
    lobby: 'tabLobby',
    rooms: 'tabRooms',
    leaderboard: 'tabLeaderboard',
    changelog: 'tabChangelog',
    about: 'tabAbout',
};

function toPercent(value: number, total: number): string {
    return `${(value / total) * 100}%`;
}

function createRegionStyle(regionId: string): CSSProperties {
    const region = resolveArtboardRegion(HOME_V2_BOOK_SCENE.artboard, regionId);
    if (!region) {
        throw new Error(`Home V2 缺少命名区域: ${regionId}`);
    }

    return {
        left: toPercent(region.x, HOME_V2_BOOK_SCENE.artboard.baseWidth),
        top: toPercent(region.y, HOME_V2_BOOK_SCENE.artboard.baseHeight),
        width: toPercent(region.width, HOME_V2_BOOK_SCENE.artboard.baseWidth),
        height: toPercent(region.height, HOME_V2_BOOK_SCENE.artboard.baseHeight),
    };
}

export const HOME_V2_PAGE_ZONE_STYLES = {
    left: createRegionStyle('leftPage'),
    right: createRegionStyle('rightPage'),
} as const;

export const HOME_V2_BOOK_BODY_STYLES = {
    leftPage: {
        left: '10.49%',
        top: '13.61%',
        width: '31.25%',
        height: '69.17%',
    } satisfies CSSProperties,
    rightPage: {
        left: '58.04%',
        top: '13.61%',
        width: '31.25%',
        height: '69.17%',
    } satisfies CSSProperties,
} as const;

export function getHomeV2TabStyle(tabId: HomeV2TabId): CSSProperties {
    return createRegionStyle(HOME_V2_TAB_REGION_IDS[tabId]);
}
