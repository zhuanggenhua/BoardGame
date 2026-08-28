import {
    getMageWarsSpellCardFromConfig,
    getMageWarsSpellCardsFromConfig,
    getPresetSpellbookEntriesFromConfig,
    type MageWarsConfigSpellCard,
} from '../data/configPackage';
import { MAGE_IDS, type MageId } from './ids';
import type { MageWarsPlayerSpellbookEntry } from './spellbook';

export const MAGE_WARS_SPELLBOOK_POINT_LIMIT = 120;

export interface MageWarsSpellbookTrainingProfile {
    mageId: MageId;
    trainedSchools: readonly string[];
    opposedSchools: readonly string[];
    summary: string;
}

export interface MageWarsSpellbookCardCost {
    spellCardId: number;
    level: number;
    points: number;
    multiplier: 1 | 2 | 3;
    schools: readonly string[];
    reason: string;
    restrictionReason?: string;
}

export interface MageWarsSpellbookBuildSummary {
    pointLimit: number;
    pointsUsed: number;
    remainingPoints: number;
    cardCount: number;
    entryCount: number;
    overPointLimit: boolean;
}

const SCHOOL_ALIASES: Record<string, string> = {
    土: '土',
    土系: '土',
    水: '水流',
    水流: '水流',
    水系: '水流',
    火: '火焰',
    火系: '火焰',
    火焰: '火焰',
    风: '风力',
    风力: '风力',
    风系: '风力',
    空气: '风力',
    自然: '自然',
    黑暗: '黑暗',
    神圣: '圣光',
    圣光: '圣光',
    光明: '圣光',
    奥术: '奥术',
    超魔: '超魔',
    原力: '原力',
    战争: '战争',
    防御: '防御',
    心灵: '精神',
    精神: '精神',
    治疗: '治疗',
    闪电: '闪电',
    雷电: '闪电',
    毒素: '毒素',
    酸性: '酸性',
    霜冻: '霜冻',
    律令: '律令',
    战争图标: '战争',
    多元素: '多元素',
};

const NON_SCHOOL_TOKENS = new Set([
    '',
    '攻击',
    '结界',
    '生物',
    '魔物',
    '咒语',
    '装备',
    '武器',
    '墙体',
    '动物',
    '法师',
    '专用',
    '图标',
    'OR',
    'or',
]);

export const MAGE_WARS_SPELLBOOK_TRAINING_PROFILES: Record<MageId, MageWarsSpellbookTrainingProfile> = {
    [MAGE_IDS.BEASTMASTER_APPRENTICE]: {
        mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
        trainedSchools: ['自然'],
        opposedSchools: ['火焰'],
        summary: '自然受训；火焰相斥。',
    },
    [MAGE_IDS.PRIESTESS_APPRENTICE]: {
        mageId: MAGE_IDS.PRIESTESS_APPRENTICE,
        trainedSchools: ['圣光'],
        opposedSchools: ['黑暗'],
        summary: '圣光受训；黑暗相斥。',
    },
    [MAGE_IDS.WARLOCK_APPRENTICE]: {
        mageId: MAGE_IDS.WARLOCK_APPRENTICE,
        trainedSchools: ['火焰', '黑暗'],
        opposedSchools: ['圣光'],
        summary: '火焰、黑暗受训；圣光相斥。',
    },
    [MAGE_IDS.WIZARD_APPRENTICE]: {
        mageId: MAGE_IDS.WIZARD_APPRENTICE,
        trainedSchools: ['奥术', '风力'],
        opposedSchools: [],
        summary: '奥术与当前标准书元素方向受训。',
    },
};

function normalizeSchoolToken(token: string): string | undefined {
    const cleaned = token
        .replace(/[`"'“”‘’()（）[\]【】]/g, '')
        .trim();
    if (!cleaned || NON_SCHOOL_TOKENS.has(cleaned)) return undefined;
    return SCHOOL_ALIASES[cleaned];
}

function extractSchoolsFromLine(line: string | undefined): string[] {
    if (!line) return [];
    return line
        .split(/\/|、|，|,|&|＆|\+|或|\s+|\bor\b|\bOR\b/u)
        .map(normalizeSchoolToken)
        .filter((token): token is string => Boolean(token));
}

function unique(values: readonly string[]): string[] {
    return [...new Set(values)];
}

function getSpellLevel(spell: MageWarsConfigSpellCard): number {
    const level = spell.level ?? 1;
    return Number.isFinite(level) && level > 0 ? Math.ceil(level) : 1;
}

function spellHasTag(spell: MageWarsConfigSpellCard, tag: string): boolean {
    return spell.tags?.some((candidate) => candidate === tag || candidate.toLowerCase() === tag.toLowerCase()) === true;
}

function isNoviceSpell(spell: MageWarsConfigSpellCard): boolean {
    return spellHasTag(spell, '初级') || spell.rulesText?.includes('初级') === true;
}

function isEpicSpell(spell: MageWarsConfigSpellCard): boolean {
    return spellHasTag(spell, '史诗') || spellHasTag(spell, 'epic') || spell.rulesText?.includes('史诗') === true;
}

function getMageRestrictionReason(
    mageId: MageId,
    spell: MageWarsConfigSpellCard,
    profile: MageWarsSpellbookTrainingProfile,
): string | undefined {
    const text = `${spell.rulesText ?? ''} ${spell.attackOrTraitLine ?? ''}`;
    const mageSpecific: Array<[string, MageId, string]> = [
        ['限定兽王', MAGE_IDS.BEASTMASTER_APPRENTICE, '限定兽王；当前法师不可用'],
        ['限定女祭司', MAGE_IDS.PRIESTESS_APPRENTICE, '限定女祭司；当前法师不可用'],
        ['限定邪术师', MAGE_IDS.WARLOCK_APPRENTICE, '限定邪术师；当前法师不可用'],
        ['限定巫师', MAGE_IDS.WIZARD_APPRENTICE, '限定巫师；当前法师不可用'],
    ];
    const matchedMageRestriction = mageSpecific.find(([needle]) => text.includes(needle));
    if (matchedMageRestriction && matchedMageRestriction[1] !== mageId) {
        return matchedMageRestriction[2];
    }

    const schoolSpecific: Array<[string, string, string]> = [
        ['限定黑暗法师', '黑暗', '限定黑暗法师；当前法师不可用'],
        ['限定圣光法师', '圣光', '限定圣光法师；当前法师不可用'],
        ['限定神圣法师', '圣光', '限定神圣法师；当前法师不可用'],
        ['限定自然法师', '自然', '限定自然法师；当前法师不可用'],
        ['限定奥术法师', '奥术', '限定奥术法师；当前法师不可用'],
        ['限定火焰法师', '火焰', '限定火焰法师；当前法师不可用'],
    ];
    const matchedSchoolRestriction = schoolSpecific.find(([needle]) => text.includes(needle));
    if (matchedSchoolRestriction && !profile.trainedSchools.includes(matchedSchoolRestriction[1])) {
        return matchedSchoolRestriction[2];
    }

    return undefined;
}

function entriesEqual(left: readonly MageWarsPlayerSpellbookEntry[], right: readonly MageWarsPlayerSpellbookEntry[]): boolean {
    if (left.length !== right.length) return false;
    const serialize = (entries: readonly MageWarsPlayerSpellbookEntry[]) => entries
        .map((entry) => `${entry.spellCardId}:${entry.count}`)
        .sort()
        .join('|');
    return serialize(left) === serialize(right);
}

export function getMageWarsSpellbookTrainingProfile(mageId: MageId): MageWarsSpellbookTrainingProfile {
    return MAGE_WARS_SPELLBOOK_TRAINING_PROFILES[mageId];
}

export function getMageWarsSpellbookCandidateCards(): readonly MageWarsConfigSpellCard[] {
    return getMageWarsSpellCardsFromConfig();
}

export function getMageWarsSpellSchools(spell: MageWarsConfigSpellCard): readonly string[] {
    return unique([
        ...extractSchoolsFromLine(spell.schoolLine),
        ...extractSchoolsFromLine(spell.typeLine),
    ]);
}

export function getMageWarsSpellbookCopyLimitForCard(spellCardId: number): number {
    const spell = getMageWarsSpellCardFromConfig(spellCardId);
    if (!spell) return 0;
    if (isEpicSpell(spell)) return 1;
    return getSpellLevel(spell) === 1 ? 6 : 4;
}

export function getMageWarsSpellbookCardCost(mageId: MageId, spellCardId: number): MageWarsSpellbookCardCost | undefined {
    const spell = getMageWarsSpellCardFromConfig(spellCardId);
    if (!spell) return undefined;

    const profile = getMageWarsSpellbookTrainingProfile(mageId);
    const level = getSpellLevel(spell);
    const schools = getMageWarsSpellSchools(spell);
    const restrictionReason = getMageRestrictionReason(mageId, spell, profile);
    if (isNoviceSpell(spell)) {
        return {
            spellCardId,
            level,
            points: 1,
            multiplier: 1,
            schools,
            reason: '初级法术；需 1 点',
            restrictionReason,
        };
    }

    const trainedSchool = schools.find((school) => profile.trainedSchools.includes(school));
    if (trainedSchool) {
        return {
            spellCardId,
            level,
            points: level,
            multiplier: 1,
            schools,
            reason: `需 ${level} 点；${trainedSchool}受训 x1`,
            restrictionReason,
        };
    }

    const opposedSchool = schools.find((school) => profile.opposedSchools.includes(school));
    if (opposedSchool) {
        return {
            spellCardId,
            level,
            points: level * 3,
            multiplier: 3,
            schools,
            reason: `需 ${level * 3} 点；${opposedSchool}相斥 x3`,
            restrictionReason,
        };
    }

    return {
        spellCardId,
        level,
        points: level * 2,
        multiplier: 2,
        schools,
        reason: `需 ${level * 2} 点；未受训 x2`,
        restrictionReason,
    };
}

export function isMageWarsStandardPresetSpellbook(
    mageId: MageId,
    entries: readonly MageWarsPlayerSpellbookEntry[],
): boolean {
    return entriesEqual(entries, getPresetSpellbookEntriesFromConfig(mageId));
}

export function calculateMageWarsSpellbookBuildSummary(
    mageId: MageId,
    entries: readonly MageWarsPlayerSpellbookEntry[],
): MageWarsSpellbookBuildSummary {
    const cardCount = entries.reduce((total, entry) => total + entry.count, 0);
    const pointsUsed = isMageWarsStandardPresetSpellbook(mageId, entries)
        ? MAGE_WARS_SPELLBOOK_POINT_LIMIT
        : entries.reduce((total, entry) => {
            const cost = getMageWarsSpellbookCardCost(mageId, entry.spellCardId);
            return total + (cost?.points ?? 0) * entry.count;
        }, 0);

    return {
        pointLimit: MAGE_WARS_SPELLBOOK_POINT_LIMIT,
        pointsUsed,
        remainingPoints: MAGE_WARS_SPELLBOOK_POINT_LIMIT - pointsUsed,
        cardCount,
        entryCount: entries.length,
        overPointLimit: pointsUsed > MAGE_WARS_SPELLBOOK_POINT_LIMIT,
    };
}
