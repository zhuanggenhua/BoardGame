import { createFrameSequence } from '../../../../components/common/animations';
import type { LayoutTransform } from '../../../utils/layout';
import type { UISceneDefinition } from '../types';

export type HomeV2SceneState =
    | 'open'
    | 'tabs'
    | 'overview'
    | 'flippingToDetail'
    | 'detail'
    | 'flippingToOverview';

const ARTBOARD_WIDTH = 896;
const ARTBOARD_HEIGHT = 720;
const HOME_V2_LOCAL_ASSET_ROOT = '/assets/common/images/home-v2';

const fullArtboardTransform: LayoutTransform = {
    anchor: { x: 0, y: 0 },
    pivot: { x: 0, y: 0 },
    offset: { x: 0, y: 0 },
    width: ARTBOARD_WIDTH,
    height: ARTBOARD_HEIGHT,
};

export const HOME_V2_BOOK_SCENE: UISceneDefinition = {
    id: 'home-v2-book-scene',
    presentation: {
        scaleMultiplier: 1.56,
        offsetYPct: 1,
    },
    artboard: {
        id: 'home-v2-book-artboard',
        baseWidth: ARTBOARD_WIDTH,
        baseHeight: ARTBOARD_HEIGHT,
        safeZones: {
            leftPage: { x: 149, y: 202, width: 280, height: 355, label: '左页安全区' },
            rightPage: { x: 468, y: 202, width: 280, height: 355, label: '右页安全区' },
            leftPageOverview: { x: 158, y: 216, width: 248, height: 312, label: '左页总览区' },
            spreadBody: { x: 158, y: 216, width: 577, height: 312, label: '首页总览区域' },
        },
        slots: {
            tabStrip: { x: 738, y: 0, width: 158, height: 720, label: '书签槽位' },
            tabLobby: { x: 806.4, y: 108, width: 53.76, height: 72, label: '大厅书签' },
            tabRooms: { x: 806.4, y: 187.2, width: 53.76, height: 72, label: '房间书签' },
            tabLeaderboard: { x: 806.4, y: 266.4, width: 53.76, height: 72, label: '榜单书签' },
            tabChangelog: { x: 806.4, y: 345.6, width: 53.76, height: 72, label: '更新书签' },
            tabAbout: { x: 806.4, y: 424.8, width: 53.76, height: 72, label: '关于书签' },
        },
        hitAreas: {
            prevPage: { x: 44, y: 122, width: 66, height: 472, label: '左页翻页热点' },
            nextPage: { x: 714, y: 122, width: 128, height: 472, label: '右页翻页热点' },
        },
        guides: {
            spine: { x: 438, y: 84, width: 20, height: 552, label: '书脊参考线' },
        },
    },
    nodes: [
        {
            id: 'book-idle-shell',
            prefabId: 'image',
            transform: fullArtboardTransform,
            zIndex: 0,
            visibleInStates: ['tabs', 'overview', 'flippingToDetail', 'detail', 'flippingToOverview'],
            props: {
                image: `${HOME_V2_LOCAL_ASSET_ROOT}/book-idle/1.png`,
                fit: 'contain',
            },
        },
        {
            id: 'book-open-sequence',
            prefabId: 'frame-sequence',
            transform: fullArtboardTransform,
            zIndex: 20,
            visibleInStates: ['open'],
            testId: 'home-v2-opening',
            props: {
                sequence: createFrameSequence(`${HOME_V2_LOCAL_ASSET_ROOT}/book-open`, 4, {
                    fps: 6,
                    holdLastFrame: true,
                    reducedMotionBehavior: 'last-frame',
                }),
                fit: 'contain',
                eventId: 'intro.open.complete',
            },
        },
        {
            id: 'book-tab-strip-ready',
            prefabId: 'book-tab-strip',
            transform: fullArtboardTransform,
            clipRegionId: 'tabStrip',
            zIndex: 10,
            visibleInStates: ['overview', 'detail'],
            props: {
                image: `${HOME_V2_LOCAL_ASSET_ROOT}/side-tabs-static/1.png`,
                fit: 'contain',
            },
        },
        {
            id: 'book-tab-strip-appear',
            prefabId: 'frame-sequence',
            transform: fullArtboardTransform,
            clipRegionId: 'tabStrip',
            zIndex: 20,
            visibleInStates: ['tabs'],
            testId: 'home-v2-opening',
            props: {
                sequence: createFrameSequence(`${HOME_V2_LOCAL_ASSET_ROOT}/side-tabs-appear`, 17, {
                    fps: 18,
                    holdLastFrame: true,
                    reducedMotionBehavior: 'last-frame',
                }),
                fit: 'contain',
                eventId: 'intro.tabs.complete',
            },
        },
        {
            id: 'home-v2-tab-lobby',
            prefabId: 'book-tab',
            regionId: 'tabLobby',
            zIndex: 30,
            visibleInStates: ['overview', 'detail'],
            props: {
                tabId: 'lobby',
                eventId: 'navigation.tab-select',
            },
        },
        {
            id: 'home-v2-tab-rooms',
            prefabId: 'book-tab',
            regionId: 'tabRooms',
            zIndex: 30,
            visibleInStates: ['overview', 'detail'],
            props: {
                tabId: 'rooms',
                eventId: 'navigation.tab-select',
            },
        },
        {
            id: 'home-v2-tab-leaderboard',
            prefabId: 'book-tab',
            regionId: 'tabLeaderboard',
            zIndex: 30,
            visibleInStates: ['overview', 'detail'],
            props: {
                tabId: 'leaderboard',
                eventId: 'navigation.tab-select',
            },
        },
        {
            id: 'home-v2-tab-changelog',
            prefabId: 'book-tab',
            regionId: 'tabChangelog',
            zIndex: 30,
            visibleInStates: ['overview', 'detail'],
            props: {
                tabId: 'changelog',
                eventId: 'navigation.tab-select',
            },
        },
        {
            id: 'home-v2-tab-about',
            prefabId: 'book-tab',
            regionId: 'tabAbout',
            zIndex: 30,
            visibleInStates: ['overview', 'detail'],
            props: {
                tabId: 'about',
                eventId: 'navigation.tab-select',
            },
        },
        {
            id: 'home-v2-hotspot-prev-page',
            prefabId: 'hotspot',
            regionId: 'prevPage',
            zIndex: 30,
            visibleInStates: ['overview', 'detail'],
            props: {
                label: '左页翻页热点',
                eventId: 'navigation.prev-page',
            },
        },
        {
            id: 'home-v2-hotspot-next-page',
            prefabId: 'hotspot',
            regionId: 'nextPage',
            zIndex: 30,
            visibleInStates: ['overview', 'detail'],
            props: {
                label: '右页翻页热点',
                eventId: 'navigation.next-page',
            },
        },
        {
            id: 'home-v2-page-flip-to-detail',
            prefabId: 'frame-sequence',
            transform: fullArtboardTransform,
            zIndex: 60,
            visibleInStates: ['flippingToDetail'],
            props: {
                sequence: createFrameSequence(`${HOME_V2_LOCAL_ASSET_ROOT}/page-flip-left`, 8, {
                    fps: 18,
                    holdLastFrame: true,
                    reducedMotionBehavior: 'last-frame',
                }),
                fit: 'contain',
                eventId: 'page.flip.to-detail.complete',
            },
        },
        {
            id: 'home-v2-page-flip-to-overview',
            prefabId: 'frame-sequence',
            transform: fullArtboardTransform,
            zIndex: 60,
            visibleInStates: ['flippingToOverview'],
            props: {
                sequence: createFrameSequence(`${HOME_V2_LOCAL_ASSET_ROOT}/page-flip-right`, 8, {
                    fps: 18,
                    holdLastFrame: true,
                    reducedMotionBehavior: 'last-frame',
                }),
                fit: 'contain',
                eventId: 'page.flip.to-overview.complete',
            },
        },
    ],
};
