import type { GameSetupSelections } from '../../shared/gameSetupOptions';
import type { GameSetupSelectField } from '../manifest.types';
import type { PublicSetupSummary } from '../../shared/lobby';
import type {
    QidahenArmamentId,
    QidahenFactionId,
    QidahenScenarioChoiceSelections,
    QidahenScenarioId,
} from './domain/types';

export const QIDAHEN_SCENARIO_SETUP_FIELD = 'scenario' as const;
export const QIDAHEN_IN_MATCH_SCENARIO_VOTE_FIELD = 'qidahenInMatchScenarioVote' as const;
export const DEFAULT_QIDAHEN_SCENARIO_ID: QidahenScenarioId = 'post-sarhu-1619';

export const QIDAHEN_SCENARIO_SETUP_OPTIONS = [
    {
        value: 'post-sarhu-1619',
        labelKey: 'setup.scenario.postSarhu1619',
    },
    {
        value: 'shanhaiguan-1622',
        labelKey: 'setup.scenario.shanhaiguan1622',
    },
    {
        value: 'dingmao-rebellion-1627',
        labelKey: 'setup.scenario.dingmaoRebellion1627',
    },
] as const;

const QIDAHEN_SCENARIO_ID_SET = new Set<QidahenScenarioId>(
    QIDAHEN_SCENARIO_SETUP_OPTIONS.map((option) => option.value as QidahenScenarioId),
);

const QIDAHEN_ALLOWED_PLAYER_COUNTS_BY_SCENARIO: Record<QidahenScenarioId, readonly number[]> = {
    'post-sarhu-1619': [3],
    'shanhaiguan-1622': [3],
    'dingmao-rebellion-1627': [2],
};

export const QIDAHEN_PLAYER_OPTIONS: readonly number[] = Object.freeze(
    Array.from(new Set(Object.values(QIDAHEN_ALLOWED_PLAYER_COUNTS_BY_SCENARIO).flat()))
        .sort((left, right) => left - right),
);

export const QIDAHEN_MIN_PLAYERS = QIDAHEN_PLAYER_OPTIONS[0] ?? 2;
export const QIDAHEN_MAX_PLAYERS = QIDAHEN_PLAYER_OPTIONS[QIDAHEN_PLAYER_OPTIONS.length - 1] ?? 3;

const QIDAHEN_PLAYABLE_FACTIONS_BY_SCENARIO: Record<QidahenScenarioId, readonly QidahenFactionId[]> = {
    'post-sarhu-1619': ['ming', 'mongol', 'jin'],
    'shanhaiguan-1622': ['ming', 'mongol', 'jin'],
    'dingmao-rebellion-1627': ['ming', 'jin'],
};

export interface QidahenScenarioVoteMeta {
    scenarioId: QidahenScenarioId;
    label: string;
    supportedPlayerCounts: readonly number[];
    intro: string;
    overview: string;
}

const QIDAHEN_SCENARIO_VOTE_META_BY_ID: Record<QidahenScenarioId, QidahenScenarioVoteMeta> = {
    'post-sarhu-1619': {
        scenarioId: 'post-sarhu-1619',
        label: '剧本一：萨尔浒战后（1619）',
        supportedPlayerCounts: [3],
        intro: '三方都还在起势阶段。大明资源紧、蒙古机动强、后金手牌最厚，适合从最基础的三方节奏开始。',
        overview: '早期三方标准局，重点体验行动轮盘、区域牵制与后金手牌压力。',
    },
    'shanhaiguan-1622': {
        scenarioId: 'shanhaiguan-1622',
        label: '剧本二：山海关之议（1622）',
        supportedPlayerCounts: [3],
        intro: '三方势力都已进入更复杂的中盘。人物与军备前置抉择更多，适合作为标准三人联机剧本。',
        overview: '标准三人对局，人物和军备前置更多，中盘压迫感更强。',
    },
    'dingmao-rebellion-1627': {
        scenarioId: 'dingmao-rebellion-1627',
        label: '二人剧本：丁卯胡乱（1627）',
        supportedPlayerCounts: [2],
        intro: '二人正面对抗剧本。蒙古退场，大明与后金直接碰撞，整体节奏更快、更凶。',
        overview: '二人快节奏对抗，直接进入大明与后金的正面压力测试。',
    },
};

export interface QidahenPregameChoiceField {
    key: string;
    scenarioId: QidahenScenarioId;
    selectionType: 'character' | 'armament';
    field: GameSetupSelectField;
}

const createPregameChoiceField = (
    key: string,
    scenarioId: QidahenScenarioId,
    selectionType: 'character' | 'armament',
    labelKey: string,
    options: ReadonlyArray<{ value: string; labelKey: string }>,
): QidahenPregameChoiceField => ({
    key,
    scenarioId,
    selectionType,
    field: {
        type: 'select',
        labelKey,
        options: [...options],
        default: options[0]?.value ?? '',
    },
});

export const QIDAHEN_PREGAME_CHOICE_FIELDS: readonly QidahenPregameChoiceField[] = [
    createPregameChoiceField(
        'shanhaiguan-1622:ming:character:0',
        'shanhaiguan-1622',
        'character',
        'setup.pregameChoices.fields.shanhaiguan1622.mingCharacter',
        [
            { value: 'ming-wang-huazhen', labelKey: 'setup.pregameChoices.options.mingWangHuazhen' },
            { value: 'ming-xiong-tingbi', labelKey: 'setup.pregameChoices.options.mingXiongTingbi' },
        ],
    ),
    createPregameChoiceField(
        'shanhaiguan-1622:jin:character:0',
        'shanhaiguan-1622',
        'character',
        'setup.pregameChoices.fields.shanhaiguan1622.jinCharacter0',
        [
            { value: 'jin-eidu', labelKey: 'setup.pregameChoices.options.jinEidu' },
            { value: 'jin-fan-wencheng', labelKey: 'setup.pregameChoices.options.jinFanWencheng' },
        ],
    ),
    createPregameChoiceField(
        'shanhaiguan-1622:jin:character:1',
        'shanhaiguan-1622',
        'character',
        'setup.pregameChoices.fields.shanhaiguan1622.jinCharacter1',
        [
            { value: 'jin-amin', labelKey: 'setup.pregameChoices.options.jinAmin' },
            { value: 'jin-manggultai', labelKey: 'setup.pregameChoices.options.jinManggultai' },
        ],
    ),
    createPregameChoiceField(
        'shanhaiguan-1622:ming:armament:0',
        'shanhaiguan-1622',
        'armament',
        'setup.pregameChoices.fields.shanhaiguan1622.mingArmament0',
        [
            { value: 'cavalry-armor', labelKey: 'setup.pregameChoices.options.cavalryArmor' },
            { value: 'infantry-armor', labelKey: 'setup.pregameChoices.options.infantryArmor' },
            { value: 'artillery-tech', labelKey: 'setup.pregameChoices.options.artilleryTech' },
        ],
    ),
    createPregameChoiceField(
        'shanhaiguan-1622:ming:armament:1',
        'shanhaiguan-1622',
        'armament',
        'setup.pregameChoices.fields.shanhaiguan1622.mingArmament1',
        [
            { value: 'cavalry-firearm', labelKey: 'setup.pregameChoices.options.cavalryFirearm' },
            { value: 'long-barreled-musket', labelKey: 'setup.pregameChoices.options.longBarreledMusket' },
        ],
    ),
    createPregameChoiceField(
        'dingmao-rebellion-1627:jin:character:0',
        'dingmao-rebellion-1627',
        'character',
        'setup.pregameChoices.fields.dingmaoRebellion1627.jinCharacter0',
        [
            { value: 'jin-huangtaiji', labelKey: 'setup.pregameChoices.options.jinHuangtaiji' },
            { value: 'jin-amin', labelKey: 'setup.pregameChoices.options.jinAmin' },
            { value: 'jin-daisan', labelKey: 'setup.pregameChoices.options.jinDaisan' },
        ],
    ),
    createPregameChoiceField(
        'dingmao-rebellion-1627:jin:character:1',
        'dingmao-rebellion-1627',
        'character',
        'setup.pregameChoices.fields.dingmaoRebellion1627.jinCharacter1',
        [
            { value: 'jin-yanguli', labelKey: 'setup.pregameChoices.options.jinYanguli' },
            { value: 'jin-fan-wencheng', labelKey: 'setup.pregameChoices.options.jinFanWencheng' },
        ],
    ),
    createPregameChoiceField(
        'dingmao-rebellion-1627:ming:armament:0',
        'dingmao-rebellion-1627',
        'armament',
        'setup.pregameChoices.fields.dingmaoRebellion1627.mingArmament0',
        [
            { value: 'cavalry-firearm', labelKey: 'setup.pregameChoices.options.cavalryFirearm' },
            { value: 'long-barreled-musket', labelKey: 'setup.pregameChoices.options.longBarreledMusket' },
        ],
    ),
] as const;

const QIDAHEN_PREGAME_CHOICE_FIELD_KEY_SET = new Set(
    QIDAHEN_PREGAME_CHOICE_FIELDS.map((field) => field.key),
);

function asRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }
    return value as Record<string, unknown>;
}

function normalizeScenarioId(value: unknown): QidahenScenarioId | undefined {
    if (typeof value !== 'string' || !QIDAHEN_SCENARIO_ID_SET.has(value as QidahenScenarioId)) {
        return undefined;
    }
    return value as QidahenScenarioId;
}

function getPregameFieldValue(
    setupData: Record<string, unknown> | undefined,
    fieldKey: string,
): string | undefined {
    const topLevelValue = setupData?.[fieldKey];
    if (typeof topLevelValue === 'string') {
        return topLevelValue;
    }

    const setupSelections = asRecord(setupData?.setupSelections);
    const nestedValue = setupSelections?.[fieldKey];
    return typeof nestedValue === 'string' ? nestedValue : undefined;
}

function isValidPregameChoiceValue(
    field: QidahenPregameChoiceField,
    value: unknown,
): value is string {
    return typeof value === 'string'
        && (field.field.options ?? []).some((option) => option.value === value);
}

export function readQidahenScenarioId(setupData?: Record<string, unknown>): QidahenScenarioId {
    const topLevelScenario = normalizeScenarioId(setupData?.[QIDAHEN_SCENARIO_SETUP_FIELD]);
    if (topLevelScenario) {
        return topLevelScenario;
    }

    const legacyScenarioId = normalizeScenarioId(setupData?.scenarioId);
    if (legacyScenarioId) {
        return legacyScenarioId;
    }

    const setupSelections = asRecord(setupData?.setupSelections);
    const selectedScenario = normalizeScenarioId(setupSelections?.[QIDAHEN_SCENARIO_SETUP_FIELD]);
    if (selectedScenario) {
        return selectedScenario;
    }

    return DEFAULT_QIDAHEN_SCENARIO_ID;
}

export function shouldUseQidahenInMatchScenarioVote(
    setupData?: Record<string, unknown>,
): boolean {
    const topLevelFlag = setupData?.[QIDAHEN_IN_MATCH_SCENARIO_VOTE_FIELD];
    if (topLevelFlag === true || topLevelFlag === 'enabled') {
        return true;
    }
    const setupSelections = asRecord(setupData?.setupSelections);
    const nestedFlag = setupSelections?.[QIDAHEN_IN_MATCH_SCENARIO_VOTE_FIELD];
    return nestedFlag === true || nestedFlag === 'enabled';
}

export function shouldResolveQidahenScenarioChoiceGroups(
    setupData?: Record<string, unknown>,
): boolean {
    return readQidahenScenarioId(setupData) === DEFAULT_QIDAHEN_SCENARIO_ID;
}

export function getQidahenPregameChoiceFields(
    scenarioId: QidahenScenarioId,
): readonly QidahenPregameChoiceField[] {
    return QIDAHEN_PREGAME_CHOICE_FIELDS.filter((field) => field.scenarioId === scenarioId);
}

export function getQidahenAllowedPlayerCounts(
    scenarioId: QidahenScenarioId,
): readonly number[] {
    return QIDAHEN_ALLOWED_PLAYER_COUNTS_BY_SCENARIO[scenarioId];
}

export function getQidahenPlayableFactions(
    scenarioId: QidahenScenarioId,
): readonly QidahenFactionId[] {
    return QIDAHEN_PLAYABLE_FACTIONS_BY_SCENARIO[scenarioId];
}

export function getQidahenScenarioVoteMeta(
    scenarioId: QidahenScenarioId,
): QidahenScenarioVoteMeta {
    return {
        ...QIDAHEN_SCENARIO_VOTE_META_BY_ID[scenarioId],
        supportedPlayerCounts: [...QIDAHEN_SCENARIO_VOTE_META_BY_ID[scenarioId].supportedPlayerCounts],
    };
}

export function getQidahenScenarioIdsForPlayerCount(
    playerCount: number,
): QidahenScenarioId[] {
    return QIDAHEN_SCENARIO_SETUP_OPTIONS
        .map((option) => option.value)
        .filter((scenarioId): scenarioId is QidahenScenarioId => (
            QIDAHEN_ALLOWED_PLAYER_COUNTS_BY_SCENARIO[scenarioId as QidahenScenarioId]?.includes(playerCount)
        ));
}

export function applyQidahenPregameChoiceDefaults(
    rawSelections: GameSetupSelections,
): GameSetupSelections {
    const scenarioId = readQidahenScenarioId(rawSelections as Record<string, unknown>);
    const activeFields = getQidahenPregameChoiceFields(scenarioId);
    const nextSelections: GameSetupSelections = {};

    for (const [key, value] of Object.entries(rawSelections)) {
        if (!QIDAHEN_PREGAME_CHOICE_FIELD_KEY_SET.has(key)) {
            nextSelections[key] = value;
        }
    }

    for (const field of activeFields) {
        const currentValue = rawSelections[field.key];
        const fallbackValue = field.field.default ?? field.field.options?.[0]?.value ?? '';
        nextSelections[field.key] = isValidPregameChoiceValue(field, currentValue)
            ? currentValue
            : fallbackValue;
    }

    return nextSelections;
}

export function readQidahenScenarioChoiceSelections(
    setupData?: Record<string, unknown>,
): QidahenScenarioChoiceSelections {
    const characterChoiceSelections: Partial<Record<string, string[]>> = {};
    const armamentChoiceSelections: Partial<Record<string, QidahenArmamentId[]>> = {};

    for (const field of getQidahenPregameChoiceFields(readQidahenScenarioId(setupData))) {
        const selectedValue = getPregameFieldValue(setupData, field.key);
        if (!isValidPregameChoiceValue(field, selectedValue)) {
            continue;
        }

        if (field.selectionType === 'character') {
            characterChoiceSelections[field.key] = [selectedValue];
            continue;
        }

        armamentChoiceSelections[field.key] = [selectedValue as QidahenArmamentId];
    }

    const selections: QidahenScenarioChoiceSelections = {};
    if (Object.keys(characterChoiceSelections).length > 0) {
        selections.characterChoiceSelections = characterChoiceSelections;
    }
    if (Object.keys(armamentChoiceSelections).length > 0) {
        selections.armamentChoiceSelections = armamentChoiceSelections;
    }
    return selections;
}

export function buildQidahenPublicRoomSummary(
    setupData?: Record<string, unknown>,
): PublicSetupSummary {
    if (shouldUseQidahenInMatchScenarioVote(setupData)) {
        return {};
    }
    return {
        scenarioId: readQidahenScenarioId(setupData),
    };
}
