import { describe, expect, it } from 'vitest';
import type { GameImplementation } from '../../core/types';
import {
    getVisibleTutorialCatalogEntries,
    resolveTutorialCatalogForStage,
    resolveTutorialManifestForStage,
} from '../useMatchRoomRuntimeSetup';

describe('useMatchRoomRuntimeSetup tutorial stage helpers', () => {
    it('多章节教程在 /tutorial 且未指定 tutorialId 时，不回落到默认教程 manifest', () => {
        const implementation: GameImplementation = {
            engineConfig: {} as never,
            board: (() => null) as never,
            tutorialCatalog: {
                defaultTutorialId: 'basic-opening',
                tutorials: {
                    'basic-opening': {
                        manifest: { id: 'basic-opening', steps: [] },
                    },
                    'attack-and-battle': {
                        manifest: { id: 'attack-and-battle', steps: [] },
                    },
                },
            },
        };

        expect(resolveTutorialCatalogForStage(implementation)?.defaultTutorialId).toBe('basic-opening');
        expect(resolveTutorialManifestForStage({
            gameId: 'qidahen',
            isTutorialRoute: true,
            tutorialId: undefined,
            gameImplementation: implementation,
        })).toBeNull();
    });

    it('单章节教程仍允许 /tutorial 直接进入默认 manifest', () => {
        const implementation: GameImplementation = {
            engineConfig: {} as never,
            board: (() => null) as never,
            tutorial: { id: 'fantasyrealms-basic', steps: [] },
        };

        expect(resolveTutorialCatalogForStage(implementation)?.defaultTutorialId).toBe('fantasyrealms-basic');
        expect(resolveTutorialManifestForStage({
            gameId: 'fantasyrealms',
            isTutorialRoute: true,
            tutorialId: undefined,
            gameImplementation: implementation,
        })?.id).toBe('fantasyrealms-basic');
    });

    it('默认教程若被隐藏，则会回落到第一个可见教程 manifest', () => {
        const implementation: GameImplementation = {
            engineConfig: {} as never,
            board: (() => null) as never,
            tutorialCatalog: {
                defaultTutorialId: 'wheel-shared-cost',
                tutorials: {
                    'wheel-shared-cost': {
                        hiddenFromCatalog: true,
                        manifest: { id: 'wheel-shared-cost', steps: [] },
                    },
                    'basic-opening': {
                        manifest: { id: 'basic-opening', steps: [] },
                    },
                },
            },
        };

        expect(getVisibleTutorialCatalogEntries(resolveTutorialCatalogForStage(implementation))).toHaveLength(1);
        expect(resolveTutorialManifestForStage({
            gameId: 'qidahen',
            isTutorialRoute: true,
            tutorialId: undefined,
            gameImplementation: implementation,
        })?.id).toBe('basic-opening');
    });
});
