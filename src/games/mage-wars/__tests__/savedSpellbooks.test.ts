import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAGE_IDS } from '../domain/ids';
import {
    deleteMageWarsSavedSpellbook,
    getMageWarsSavedSpellbookById,
    listMageWarsSavedSpellbooksForMage,
    loadMageWarsSavedSpellbooks,
    MAGE_WARS_SAVED_SPELLBOOKS_STORAGE_KEY,
    normalizeMageWarsSavedSpellbookEntries,
    normalizeMageWarsSavedSpellbooks,
    saveMageWarsSpellbookDraft,
    updateMageWarsSavedSpellbookDraft,
} from '../domain/savedSpellbooks';

describe('Mage Wars saved spellbooks', () => {
    beforeEach(() => {
        window.localStorage.clear();
        vi.useRealTimers();
    });

    it('normalizes duplicate and invalid spellbook entries without inventing cards', () => {
        expect(normalizeMageWarsSavedSpellbookEntries([
            { spellCardId: 2906, count: 4 },
            { spellCardId: 2906, count: 4 },
            { spellCardId: 999999, count: 2 },
            { spellCardId: 2819, count: -1 },
        ])).toEqual([{ spellCardId: 2906, count: 6 }]);
    });

    it('saves a named spellbook as a new local entry for the selected mage', () => {
        const saved = saveMageWarsSpellbookDraft({
            mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
            name: '  山猫测试书  ',
            entries: [
                { spellCardId: 2906, count: 1 },
                { spellCardId: 999999, count: 2 },
            ],
        });

        expect(saved).toMatchObject({
            mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
            name: '山猫测试书',
            entries: [{ spellCardId: 2906, count: 1 }],
        });
        expect(loadMageWarsSavedSpellbooks()).toEqual([saved]);
        expect(JSON.parse(window.localStorage.getItem(MAGE_WARS_SAVED_SPELLBOOKS_STORAGE_KEY) ?? '[]'))
            .toEqual([saved]);
    });

    it('does not show one mage saved spellbooks under another mage', () => {
        saveMageWarsSpellbookDraft({
            mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
            name: '兽王山猫书',
            entries: [{ spellCardId: 2906, count: 1 }],
        });
        saveMageWarsSpellbookDraft({
            mageId: MAGE_IDS.PRIESTESS_APPRENTICE,
            name: '女祭司骑士书',
            entries: [{ spellCardId: 2909, count: 1 }],
        });

        expect(listMageWarsSavedSpellbooksForMage(MAGE_IDS.BEASTMASTER_APPRENTICE).map((spellbook) => spellbook.name))
            .toEqual(['兽王山猫书']);
        expect(listMageWarsSavedSpellbooksForMage(MAGE_IDS.PRIESTESS_APPRENTICE).map((spellbook) => spellbook.name))
            .toEqual(['女祭司骑士书']);
    });

    it('loads, updates, and deletes a saved spellbook by id', () => {
        const saved = saveMageWarsSpellbookDraft({
            mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
            name: '兽王山猫书',
            entries: [{ spellCardId: 2906, count: 1 }],
        });

        expect(getMageWarsSavedSpellbookById(saved.id)).toMatchObject({
            mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
            name: '兽王山猫书',
            entries: [{ spellCardId: 2906, count: 1 }],
        });

        const updated = updateMageWarsSavedSpellbookDraft({
            id: saved.id,
            mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
            name: '兽王更新书',
            entries: [{ spellCardId: 2906, count: 3 }],
        });

        expect(updated).toMatchObject({
            id: saved.id,
            mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
            name: '兽王更新书',
            entries: [{ spellCardId: 2906, count: 3 }],
        });
        expect(listMageWarsSavedSpellbooksForMage(MAGE_IDS.BEASTMASTER_APPRENTICE)).toHaveLength(1);

        deleteMageWarsSavedSpellbook(saved.id);
        expect(getMageWarsSavedSpellbookById(saved.id)).toBeUndefined();
        expect(listMageWarsSavedSpellbooksForMage(MAGE_IDS.BEASTMASTER_APPRENTICE)).toEqual([]);
    });

    it('rejects updating a spellbook through the wrong mage scope', () => {
        const saved = saveMageWarsSpellbookDraft({
            mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
            name: '兽王山猫书',
            entries: [{ spellCardId: 2906, count: 1 }],
        });

        expect(() => updateMageWarsSavedSpellbookDraft({
            id: saved.id,
            mageId: MAGE_IDS.PRIESTESS_APPRENTICE,
            name: '错误归属',
            entries: [{ spellCardId: 2909, count: 1 }],
        })).toThrow('这本法术书不属于当前法师');
    });

    it('drops malformed stored records instead of leaking them into the builder', () => {
        expect(normalizeMageWarsSavedSpellbooks([
            {
                id: 'valid',
                mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
                name: '有效法术书',
                entries: [{ spellCardId: 2906, count: 1 }],
                createdAt: '2026-08-27T00:00:00.000Z',
                updatedAt: '2026-08-27T00:00:00.000Z',
            },
            {
                id: 'wrong-mage',
                mageId: 'not-a-mage',
                name: '非法法师',
                entries: [{ spellCardId: 2906, count: 1 }],
            },
            {
                id: 'empty',
                mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
                name: '空法术书',
                entries: [],
            },
        ])).toEqual([
            {
                id: 'valid',
                mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
                name: '有效法术书',
                entries: [{ spellCardId: 2906, count: 1 }],
                createdAt: '2026-08-27T00:00:00.000Z',
                updatedAt: '2026-08-27T00:00:00.000Z',
            },
        ]);
    });
});
