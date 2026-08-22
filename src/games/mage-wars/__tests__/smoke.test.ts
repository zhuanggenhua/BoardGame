import { describe, expect, test } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { RandomFn } from '../../../engine/types';
import { getCardPreviewGetter } from '../../../components/game/registry/cardPreviewRegistry';
import { getLazyRegistration } from '../../../components/common/media/cardAtlasRegistry';
import { mageWarsCriticalImageResolver } from '../criticalImageResolver';
import { MageWarsDomain } from '../domain';
import {
    getFormalStartingMageIdFromConfig,
    getFormalStartingZoneIdFromConfig,
    getPresetMageOrderFromConfig,
    getPresetSpellbookCountFromConfig,
    getPresetSpellbookEntriesFromConfig,
} from '../data/configPackage';
import { MAGE_IDS } from '../domain/ids';
import {
    MAGE_WARS_MAGES_ATLAS_ID,
    getMageWarsMagePreviewRef,
    getMageWarsRegisteredSpellCardIds,
    getMageWarsSpellCardName,
    getMageWarsSpellCardPreviewRef,
} from '../ui/cardAtlas';
import '../game';
import manifest from '../manifest';

const makeRandom = (): RandomFn => ({
    random: () => 0.5,
    d: (max: number) => Math.max(1, Math.ceil(max / 2)),
    range: (min: number, max: number) => Math.floor((min + max) / 2),
    shuffle: <T,>(array: T[]) => [...array],
});

const toCompressedAssetPath = (relativePath: string): string => {
    const withoutExtension = relativePath.replace(/\.(avif|webp|png|jpe?g|gif)$/i, '');
    const slashIndex = withoutExtension.lastIndexOf('/');
    const dir = slashIndex >= 0 ? withoutExtension.slice(0, slashIndex) : '';
    const filename = slashIndex >= 0 ? withoutExtension.slice(slashIndex + 1) : withoutExtension;
    return path.join(
        process.cwd(),
        'public',
        'assets',
        'i18n',
        'zh-CN',
        dir,
        'compressed',
        `${filename}.webp`,
    );
};

describe('mage-wars foundation', () => {
    test('manifest declares enabled foundation entry with required runtime metadata', () => {
        expect(manifest.id).toBe('mage-wars');
        expect(manifest.enabled).toBe(true);
        expect(manifest.statusTag).toBe('under_construction');
        expect(manifest.allowLocalMode).toBe(false);
        expect(manifest.playerOptions).toEqual([2]);
        expect(manifest.mobileProfile).toBe('landscape-adapted');
        expect(manifest.preferredOrientation).toBe('landscape');
        expect(manifest.mobileLayoutPreset).toBe('board-shell');
        expect(manifest.mobileBoardShellLayout).toEqual({
            designWidth: 1920,
        });
        expect(manifest.ai).toMatchObject({
            capture: true,
            localAi: false,
            remoteAi: false,
        });
    });

    test('setup creates two configured mages on the formal 4x3 arena contract', () => {
        const core = MageWarsDomain.setup(['0', '1'], makeRandom());

        expect(core.playerOrder).toEqual(['0', '1']);
        expect(core.currentPlayerId).toBe('0');
        expect(core.arenaMode).toBe('formal-4x3');
        expect(core.arena).toHaveLength(12);
        expect(core.objects).toEqual({});
        expect(core.arena.every((zone) => Array.isArray(zone.objectIds))).toBe(true);
        expect(core.players['0'].mageId).toBe(getFormalStartingMageIdFromConfig(0));
        expect(core.players['1'].mageId).toBe(getFormalStartingMageIdFromConfig(1));
        expect(core.players['0'].mageZoneId).toBe(getFormalStartingZoneIdFromConfig(0));
        expect(core.players['1'].mageZoneId).toBe(getFormalStartingZoneIdFromConfig(1));
        expect(core.players['0'].life).toBe(24);
        expect(core.players['0'].baseMeleeDice).toBe(3);
        expect(core.players['1'].mana).toBe(10);
        expect(core.players['0'].spellbookCount).toBe(67);
        expect(core.players['1'].spellbookCount).toBe(55);
        expect(core.players['0'].discardSpellCardIds).toEqual([]);
        expect(core.foundationStatus).toEqual({
            intakeComplete: true,
            openDesignArtifact: true,
            spellFxRequired: true,
            spellFxDriver: 'domain-events',
        });
    });

    test('critical image resolver preloads landed runtime assets through unified paths', () => {
        const result = mageWarsCriticalImageResolver({
            core: MageWarsDomain.setup(['0', '1'], makeRandom()),
            sys: { phase: 'planning' },
        });

        expect(result.phaseKey).toBe('mage-wars:planning');
        expect(result.critical).toContain('mage-wars/board/standard-arena');
        expect(result.critical).toContain('mage-wars/cards/mages/mages-core-atlas');
        expect(result.critical).toContain('mage-wars/cards/backs/spell-card-back');
        expect(result.warm).toContain('mage-wars/cards/spells/spell-attack-core-atlas');
        expect(result.warm).toContain('mage-wars/cards/spells/spell-equipment-core-atlas');

        for (const imagePath of [...result.critical, ...result.warm]) {
            expect(imagePath).not.toContain('/compressed/');
            expect(existsSync(toCompressedAssetPath(imagePath))).toBe(true);
        }
    });

    test('preset spellbook resources are sourced from the config package for all four standard starting spellbooks', () => {
        const presetMageOrder = getPresetMageOrderFromConfig();

        expect(presetMageOrder).toEqual([
            MAGE_IDS.BEASTMASTER_APPRENTICE,
            MAGE_IDS.PRIESTESS_APPRENTICE,
            MAGE_IDS.WARLOCK_APPRENTICE,
            MAGE_IDS.WIZARD_APPRENTICE,
        ]);

        expect(getPresetSpellbookCountFromConfig(MAGE_IDS.BEASTMASTER_APPRENTICE)).toBe(67);
        expect(getPresetSpellbookCountFromConfig(MAGE_IDS.PRIESTESS_APPRENTICE)).toBe(55);
        expect(getPresetSpellbookCountFromConfig(MAGE_IDS.WARLOCK_APPRENTICE)).toBe(59);
        expect(getPresetSpellbookCountFromConfig(MAGE_IDS.WIZARD_APPRENTICE)).toBe(59);

        for (const mageId of presetMageOrder) {
            expect(getPresetSpellbookEntriesFromConfig(mageId).every((entry) => entry.spellCardId > 0)).toBe(true);
        }
    });

    test('preset spell atlas preview refs are registered for all sourced cards', () => {
        const previewGetter = getCardPreviewGetter('mage-wars');
        expect(previewGetter).toBeDefined();

        const registeredSpellCardIds = getMageWarsRegisteredSpellCardIds();
        expect(registeredSpellCardIds).toHaveLength(150);
        expect(getMageWarsSpellCardName(1700)).toBe('火球术');
        expect(getMageWarsSpellCardPreviewRef(1700)).toEqual({
            type: 'atlas',
            atlasId: 'mage-wars:spell-attack-core-atlas',
            index: 0,
        });
        expect(previewGetter?.('3700')).toEqual({
            type: 'atlas',
            atlasId: 'mage-wars:spell-equipment-core-atlas',
            index: 0,
        });
        expect(getMageWarsSpellCardName(2218)).toBe('巢穴');
        expect(getMageWarsSpellCardPreviewRef(2218)).toEqual({
            type: 'atlas',
            atlasId: 'mage-wars:spell-conjuration-core-atlas',
            index: 18,
        });
        expect(getMageWarsSpellCardName(2908)).toBe('乌鸦魔宠胡金');
        expect(getMageWarsSpellCardPreviewRef(2908)).toEqual({
            type: 'atlas',
            atlasId: 'mage-wars:spell-creature-core-b-atlas',
            index: 8,
        });
        expect(getMageWarsSpellCardName(25700)).toBeNull();
        expect(getMageWarsSpellCardPreviewRef(25700)).toBeNull();
        expect(getMageWarsSpellCardName(2500)).toBeNull();
        expect(getMageWarsSpellCardPreviewRef(2500)).toBeNull();

        const spellbookCardIds = new Set<string>();
        for (const mageId of getPresetMageOrderFromConfig()) {
            for (const entry of getPresetSpellbookEntriesFromConfig(mageId)) {
                spellbookCardIds.add(String(entry.spellCardId));
            }
        }

        const missingRuntimeAtlasCardIds = new Set(['2303', '2500', '3800', '3801', '3802', '3803', '25700']);
        const previewableSpellbookCardIds = [...spellbookCardIds]
            .filter((cardId) => !missingRuntimeAtlasCardIds.has(cardId));

        expect(spellbookCardIds).toHaveLength(153);
        expect(registeredSpellCardIds).toEqual(expect.arrayContaining(previewableSpellbookCardIds));
        expect([...spellbookCardIds]
            .filter((cardId) => getMageWarsSpellCardPreviewRef(Number(cardId)) === null)
            .sort((left, right) => Number(left) - Number(right))).toEqual([...missingRuntimeAtlasCardIds]);
        for (const cardId of previewableSpellbookCardIds) {
            expect(previewGetter?.(cardId)).toMatchObject({ type: 'atlas' });
        }

        // 同名多候选的旧版/对照 frame 保留在 atlas 合同中，但不是当前预设法术书选用实例。
        for (const alternateCardId of ['1911', '3406', '3419']) {
            expect(spellbookCardIds.has(alternateCardId)).toBe(false);
            expect(getMageWarsSpellCardPreviewRef(alternateCardId)).toMatchObject({ type: 'atlas' });
        }
    });

    test('preset mage atlas preview refs use the official mage atlas', () => {
        expect(getLazyRegistration(MAGE_WARS_MAGES_ATLAS_ID)).toMatchObject({
            image: 'mage-wars/cards/mages/mages-core-atlas',
            grid: { rows: 4, cols: 7 },
        });
        expect(getMageWarsMagePreviewRef(MAGE_IDS.BEASTMASTER_APPRENTICE, 'card')).toEqual({
            type: 'atlas',
            atlasId: MAGE_WARS_MAGES_ATLAS_ID,
            index: 6,
        });
        expect(getMageWarsMagePreviewRef(MAGE_IDS.WIZARD_APPRENTICE, 'portrait')).toEqual({
            type: 'atlas',
            atlasId: MAGE_WARS_MAGES_ATLAS_ID,
            index: 2,
        });
    });
});
