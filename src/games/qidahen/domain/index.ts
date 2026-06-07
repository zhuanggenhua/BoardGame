import type { DomainCore, GameOverResult, PlayerId, RandomFn } from '../../../engine/types';
import { QIDAHEN_COMMANDS, validate } from './commands';
import { qidahenChronologyPreview, qidahenJinHandPreview, qidahenKoreaSpecialPreview, qidahenMingHandPreview, qidahenMongolHandPreview } from '../ui/cardAtlas';
import { QIDAHEN_MAP_HEIGHT, QIDAHEN_MAP_WIDTH } from '../ui/mapRegions';
import { getQidahenBoundaryTypeMeta, QIDAHEN_RUNTIME_REGION_DEFINITIONS } from '../ui/mapGraph';
import {
    QIDAHEN_FORTIFICATION_CONFIGS,
    QIDAHEN_LOGICAL_RULE_REGION_IDS,
    QIDAHEN_RULE_REGION_CONFIGS,
    getQidahenCapitalOwner,
    getQidahenInitialController,
    getQidahenInitialNote,
    getQidahenInitialPopulation,
    getQidahenInitialSpecialTroops,
    getQidahenInitialTroops,
    getQidahenKoreaTributeCards,
    getQidahenPrestigeCardBonus,
    getQidahenPrestigeCardBonusUnlock,
    isQidahenRuleRegionEquivalent,
    isQidahenKoreaRuntimeRegionId,
    resolveQidahenRuleRegionConfig,
    resolveQidahenPrimaryRuntimeRegionId,
    resolveQidahenRuntimeRegionIds,
} from './regionConfig';
import { getQidahenDirectedPassageRule } from './movement';
import {
    computeQidahenAttackPressure,
    computeQidahenCommittedTroops,
    getQidahenAttackRuleConfig,
    QIDAHEN_NEUTRAL_GARRISON_MAX_TROOPS,
} from './attackRules';
import {
    findQidahenReachableRuntimeRegions,
    getQidahenMovementProfile,
    type QidahenMovementProfileId,
} from './movement';
import { getQidahenWheelImmediateEffectConfig } from './wheelRules';
import type {
    QidahenCommand,
    QidahenActionChoice,
    QidahenArmamentId,
    QidahenArmamentState,
    QidahenBattleMode,
    QidahenBattleRoll,
    QidahenBattleRollPhase,
    QidahenBattleRolls,
    QidahenCasualtyPriority,
    QidahenCharacterState,
    QidahenCore,
    QidahenDiplomacyChoice,
    QidahenDiplomacyResolvedStep,
    QidahenDiplomacySelection,
    QidahenDriveTigerConsentSelection,
    QidahenEvent,
    QidahenFortificationMaintenanceMode,
    QidahenHandCard,
    QidahenInternalDispatchSelection,
    QidahenKhanEdictSelection,
    QidahenMaShiTradeSelection,
    QidahenRecruitSelection,
    QidahenFactionId,
    QidahenFactionState,
    QidahenFortificationState,
    QidahenGaoDiDispatchMode,
    QidahenGaoDiDispatchSelection,
    QidahenPaymentState,
    QidahenPendingTargetAction,
    QidahenPlunderSource,
    QidahenPostBattleChoice,
    QidahenPostBattleSelection,
    QidahenRetreatLossMode,
    QidahenSeasonSummary,
    QidahenSpecialTroopStack,
    QidahenTroopKind,
    QidahenVictoryStatus,
    QidahenWheelDispatchCandidate,
    QidahenWheelDispatchSelection,
    QidahenWheelMoveChoice,
    ResolvePendingActionCommand,
} from './types';

const factionOrder: QidahenFactionId[] = ['ming', 'mongol', 'jin'];
const factionDisplayNameById: Record<QidahenFactionId, string> = {
    ming: '大明',
    mongol: '蒙古',
    jin: '后金',
};
const wheelSectorOrder = [
    'wheel-reclaim',
    'wheel-military-farm',
    'wheel-recruit-train',
    'wheel-diplomacy',
    'wheel-hire',
    'wheel-attack',
    'wheel-midyear',
    'wheel-new-year',
];

const YEAR_SEQUENCE = [
    '天命四年 1619',
    '天命五年 1620',
    '天命六年 1621',
    '天命七年 1622',
    '天命八年 1623',
    '天命九年 1624',
    '天命十年 1625',
    '天命十一年 1626',
    '天聪元年 1627',
    '天聪二年 1628',
    '天聪三年 1629',
] as const;

type QidahenChronologyYearConfig = {
    previewIndex: number;
    factionOrder: QidahenFactionId[];
    source: 'confirmed' | 'inferred';
    characterAvailabilityByFaction: Record<QidahenFactionId, QidahenChronologyCharacterAvailability>;
};

type QidahenChronologyCharacterAvailability =
    | {
        mode: 'none';
        summary: string;
    }
    | {
        mode: 'exact';
        summary: string;
        characterIds: string[];
    }
    | {
        mode: 'representative';
        summary: string;
        characterIds: string[];
    };

const QIDAHEN_CHRONOLOGY_YEAR_CONFIGS: QidahenChronologyYearConfig[] = [
    {
        previewIndex: 1,
        factionOrder: ['mongol', 'jin', 'ming'],
        source: 'confirmed',
        characterAvailabilityByFaction: {
            ming: {
                mode: 'representative',
                summary: '任意人物牌',
                characterIds: [
                    'ming-gao-di',
                    'ming-xiong-tingbi',
                    'ming-yang-gao',
                    'ming-yuan-chonghuan',
                    'ming-sun-yuanhua',
                    'ming-mao-wenlong',
                    'ming-wang-huazhen',
                    'ming-feng-quan',
                ],
            },
            mongol: { mode: 'none', summary: '无' },
            jin: { mode: 'exact', summary: '莽古尔泰、代善、阿敏', characterIds: ['jin-manggultai', 'jin-daisan', 'jin-amin'] },
        },
    },
    {
        previewIndex: 3,
        factionOrder: ['ming', 'mongol', 'jin'],
        source: 'inferred',
        characterAvailabilityByFaction: {
            ming: { mode: 'exact', summary: '高第、熊廷弼、杨镐', characterIds: ['ming-gao-di', 'ming-xiong-tingbi', 'ming-yang-gao'] },
            mongol: { mode: 'representative', summary: '台吉中择一', characterIds: ['mongol-choghtu-taiji', 'mongol-oba-taiji'] },
            jin: {
                mode: 'representative',
                summary: '任意人物牌',
                characterIds: ['jin-daisan', 'jin-amin', 'jin-manggultai', 'jin-yanguli', 'jin-fan-wencheng', 'jin-huangtaiji'],
            },
        },
    },
    {
        previewIndex: 4,
        factionOrder: ['mongol', 'jin', 'ming'],
        source: 'inferred',
        characterAvailabilityByFaction: {
            ming: { mode: 'none', summary: '无' },
            mongol: { mode: 'representative', summary: '台吉中择一', characterIds: ['mongol-choghtu-taiji', 'mongol-oba-taiji'] },
            jin: {
                mode: 'representative',
                summary: '任意人物牌',
                characterIds: ['jin-daisan', 'jin-amin', 'jin-manggultai', 'jin-yanguli', 'jin-fan-wencheng', 'jin-huangtaiji'],
            },
        },
    },
    {
        previewIndex: 2,
        factionOrder: ['mongol', 'jin', 'ming'],
        source: 'confirmed',
        characterAvailabilityByFaction: {
            ming: { mode: 'none', summary: '无' },
            mongol: { mode: 'representative', summary: '台吉中择一', characterIds: ['mongol-choghtu-taiji', 'mongol-oba-taiji'] },
            jin: {
                mode: 'representative',
                summary: '任意人物牌',
                characterIds: ['jin-daisan', 'jin-amin', 'jin-manggultai', 'jin-yanguli', 'jin-fan-wencheng', 'jin-huangtaiji'],
            },
        },
    },
    {
        previewIndex: 5,
        factionOrder: ['mongol', 'ming', 'jin'],
        source: 'inferred',
        characterAvailabilityByFaction: {
            ming: { mode: 'exact', summary: '袁崇焕、孙元化、高第、王化贞', characterIds: ['ming-yuan-chonghuan', 'ming-sun-yuanhua', 'ming-gao-di', 'ming-wang-huazhen'] },
            mongol: { mode: 'exact', summary: '奥巴台吉', characterIds: ['mongol-oba-taiji'] },
            jin: { mode: 'exact', summary: '代善、额亦都、范文程', characterIds: ['jin-daisan', 'jin-eidu', 'jin-fan-wencheng'] },
        },
    },
    {
        previewIndex: 6,
        factionOrder: ['mongol', 'ming', 'jin'],
        source: 'inferred',
        characterAvailabilityByFaction: {
            ming: { mode: 'exact', summary: '熊廷弼、孙元化、毛文龙、冯铨', characterIds: ['ming-xiong-tingbi', 'ming-sun-yuanhua', 'ming-mao-wenlong', 'ming-feng-quan'] },
            mongol: { mode: 'exact', summary: '衮楚克图吉', characterIds: ['mongol-gunchu-ketuji'] },
            jin: { mode: 'exact', summary: '代善、额亦都、阿敏', characterIds: ['jin-daisan', 'jin-eidu', 'jin-amin'] },
        },
    },
    {
        previewIndex: 7,
        factionOrder: ['jin', 'ming', 'mongol'],
        source: 'inferred',
        characterAvailabilityByFaction: {
            ming: { mode: 'representative', summary: '阁党中择一', characterIds: ['ming-feng-quan', 'ming-gao-di', 'ming-wang-huazhen'] },
            mongol: {
                mode: 'representative',
                summary: '任意人物牌',
                characterIds: ['mongol-qisai-noyan', 'mongol-gunchu-ketuji', 'mongol-oba-taiji', 'mongol-choghtu-taiji'],
            },
            jin: { mode: 'none', summary: '无' },
        },
    },
    {
        previewIndex: 8,
        factionOrder: ['ming', 'jin', 'mongol'],
        source: 'inferred',
        characterAvailabilityByFaction: {
            ming: { mode: 'none', summary: '无' },
            mongol: { mode: 'exact', summary: '林丹·乎图克图、齐赛诺延、绰克图台吉', characterIds: ['mongol-lindan-hutuktu', 'mongol-qisai-noyan', 'mongol-choghtu-taiji'] },
            jin: { mode: 'exact', summary: '代善、额亦都、扬古利', characterIds: ['jin-daisan', 'jin-eidu', 'jin-yanguli'] },
        },
    },
    {
        previewIndex: 0,
        factionOrder: ['ming', 'jin', 'mongol'],
        source: 'confirmed',
        characterAvailabilityByFaction: {
            ming: { mode: 'none', summary: '无' },
            mongol: { mode: 'representative', summary: '台吉中择一', characterIds: ['mongol-choghtu-taiji', 'mongol-oba-taiji'] },
            jin: { mode: 'representative', summary: '贝勒中择一', characterIds: ['jin-daisan', 'jin-amin', 'jin-manggultai', 'jin-huangtaiji'] },
        },
    },
    {
        previewIndex: 9,
        factionOrder: ['jin', 'mongol', 'ming'],
        source: 'inferred',
        characterAvailabilityByFaction: {
            ming: {
                mode: 'representative',
                summary: '东林党中择一',
                characterIds: ['ming-yuan-chonghuan', 'ming-sun-yuanhua', 'ming-xiong-tingbi', 'ming-mao-wenlong'],
            },
            mongol: { mode: 'representative', summary: '台吉中择一', characterIds: ['mongol-choghtu-taiji', 'mongol-oba-taiji'] },
            jin: { mode: 'none', summary: '无' },
        },
    },
    {
        previewIndex: 10,
        factionOrder: ['jin', 'ming', 'mongol'],
        source: 'inferred',
        characterAvailabilityByFaction: {
            ming: {
                mode: 'representative',
                summary: '任意人物牌',
                characterIds: [
                    'ming-yuan-chonghuan',
                    'ming-sun-yuanhua',
                    'ming-xiong-tingbi',
                    'ming-mao-wenlong',
                    'ming-feng-quan',
                    'ming-gao-di',
                    'ming-wang-huazhen',
                    'ming-yang-gao',
                ],
            },
            mongol: { mode: 'exact', summary: '齐赛诺延、奥巴台吉、绰克图台吉', characterIds: ['mongol-qisai-noyan', 'mongol-oba-taiji', 'mongol-choghtu-taiji'] },
            jin: { mode: 'exact', summary: '扬古利、范文程', characterIds: ['jin-yanguli', 'jin-fan-wencheng'] },
        },
    },
];

const QIDAHEN_DIPLOMACY_MAX_TARGETS = 3;

const STATEFUL_REGION_NAME_OVERRIDES: Partial<Record<string, string>> = {
    'city-region-19': '辽西',
    'city-region-22': '东江',
    'city-region-18': '平壤',
    'city-region-29': '汉城',
    'song-jin': '皮岛',
};

const defaultActionIdByFaction: Record<QidahenFactionId, string> = {
    ming: 'grant-pardon',
    mongol: 'khan-edict',
    jin: 'marriage-subjugation',
};

type InitialCharacterSeed = {
    id: string;
    name: string;
    number: number | 'X';
    initialInPlay: boolean;
};

const initialCharacterSeedsByFaction: Record<QidahenFactionId, InitialCharacterSeed[]> = {
    ming: [
        { id: 'ming-mao-wenlong', name: '毛文龙', number: 1, initialInPlay: false },
        { id: 'ming-wang-huazhen', name: '王化贞', number: 2, initialInPlay: false },
        { id: 'ming-xiong-tingbi', name: '熊廷弼', number: 3, initialInPlay: false },
        { id: 'ming-gao-di', name: '高第', number: 'X', initialInPlay: false },
        { id: 'ming-yuan-chonghuan', name: '袁崇焕', number: 'X', initialInPlay: false },
        { id: 'ming-sun-yuanhua', name: '孙元化', number: 'X', initialInPlay: false },
        { id: 'ming-yang-gao', name: '杨镐', number: 'X', initialInPlay: false },
        { id: 'ming-feng-quan', name: '冯铨', number: 'X', initialInPlay: false },
    ],
    mongol: [
        { id: 'mongol-lindan-hutuktu', name: '林丹·乎图克图', number: 1, initialInPlay: true },
        { id: 'mongol-choghtu-taiji', name: '绰克图台吉', number: 2, initialInPlay: false },
        { id: 'mongol-oba-taiji', name: '奥巴台吉', number: 3, initialInPlay: false },
        { id: 'mongol-qisai-noyan', name: '齐赛诺延', number: 'X', initialInPlay: false },
        { id: 'mongol-gunchu-ketuji', name: '衮楚克图吉', number: 'X', initialInPlay: false },
    ],
    jin: [
        { id: 'jin-nurhaci', name: '努尔哈赤', number: 1, initialInPlay: true },
        { id: 'jin-eidu', name: '额亦都', number: 2, initialInPlay: true },
        { id: 'jin-fan-wencheng', name: '范文程', number: 3, initialInPlay: false },
        { id: 'jin-daisan', name: '代善', number: 'X', initialInPlay: false },
        { id: 'jin-amin', name: '阿敏', number: 'X', initialInPlay: false },
        { id: 'jin-manggultai', name: '莽古尔泰', number: 'X', initialInPlay: false },
        { id: 'jin-yanguli', name: '扬古利', number: 'X', initialInPlay: false },
        { id: 'jin-huangtaiji', name: '皇太极', number: 'X', initialInPlay: false },
    ],
};

const createInitialCharacterStates = (factionId: QidahenFactionId): QidahenCharacterState[] => (
    initialCharacterSeedsByFaction[factionId].map(({ initialInPlay, ...character }) => ({
        ...character,
        faction: factionId,
        inPlay: initialInPlay,
        removedFromGame: false,
        canHoldDefeatMarker: character.number !== 'X',
        defeatMarkers: 0,
    }))
);

const JIN_BEILE_CHARACTER_IDS = new Set([
    'jin-daisan',
    'jin-amin',
    'jin-manggultai',
    'jin-huangtaiji',
]);

const QISAI_NOYAN_HOMELAND_REGION_IDS = new Set([
    'city-region-10',
    'city-region-17',
    'city-region-19',
]);

const GUNCHU_KETUJI_HOMELAND_REGION_IDS = new Set([
    'city-region-17',
    'city-region-19',
]);

const OBA_TAIJI_HOMELAND_REGION_IDS = new Set([
    'city-region-3',
]);

const CHOGHTU_TAIJI_HOMELAND_REGION_IDS = new Set([
    'city-region-2',
]);

const LINDAN_HUTUKTU_HOMELAND_REGION_IDS = new Set([
    'city-region-8',
    'city-region-16',
]);

const LINDAN_HUTUKTU_INFLUENCE_REGION_IDS = new Set([
    'city-region-1',
    'city-region-2',
    'city-region-3',
    'city-region-6',
    'city-region-8',
    'city-region-10',
    'city-region-14',
    'city-region-16',
    'city-region-17',
    'city-region-19',
    'city-region-20',
    'city-region-26',
]);

const LINDAN_HUTUKTU_INFLUENCE_PRIORITY: string[] = [
    'city-region-8',
    'city-region-16',
    'city-region-6',
    'city-region-10',
    'city-region-17',
    'city-region-19',
    'city-region-1',
    'city-region-2',
    'city-region-3',
    'city-region-20',
    'city-region-26',
    'city-region-14',
];

const HAN_RUNTIME_REGION_IDS = new Set([
    'city-region-15',
    'city-region-22',
    'city-region-24',
    'city-region-25',
    'city-region-27',
    'city-region-28',
    'city-region-30',
    'city-region-31',
    'city-region-32',
    'city-region-33',
    'jinzhou',
    'song-jin',
]);

const DONGJIANG_RUNTIME_REGION_ID = 'city-region-22';

const hasActiveCharacter = (
    state: QidahenCore,
    factionId: QidahenFactionId,
    characterId: string,
): boolean => state.factions[factionId].characters.some((character) => character.id === characterId && character.inPlay);

const resolveMingCharacterConflict = (
    factions: QidahenCore['factions'],
): { factions: QidahenCore['factions']; removedMaoWenlong: boolean } => {
    const hasMaoWenlong = factions.ming.characters.some((character) => character.id === 'ming-mao-wenlong' && character.inPlay);
    const hasYuanChonghuan = factions.ming.characters.some((character) => character.id === 'ming-yuan-chonghuan' && character.inPlay);
    if (!hasMaoWenlong || !hasYuanChonghuan) {
        return { factions, removedMaoWenlong: false };
    }

    return {
        factions: {
            ...factions,
            ming: {
                ...factions.ming,
                characters: factions.ming.characters.map((character) => (
                    character.id === 'ming-mao-wenlong'
                        ? { ...character, inPlay: false }
                        : character
                )),
            },
        },
        removedMaoWenlong: true,
    };
};

const resolveJinHuangtaijiConflict = (
    factions: QidahenCore['factions'],
): { factions: QidahenCore['factions']; removedHuangtaiji: boolean } => {
    const jinCharacters = factions.jin.characters;
    const hasNurhaciInPlay = jinCharacters.some((character) => character.id === 'jin-nurhaci' && character.inPlay);
    const huangtaiji = jinCharacters.find((character) => character.id === 'jin-huangtaiji');
    if (hasNurhaciInPlay || !huangtaiji?.inPlay || huangtaiji.removedFromGame) {
        return { factions, removedHuangtaiji: false };
    }

    const hasOtherBeileInPlay = jinCharacters.some((character) => (
        character.id !== 'jin-huangtaiji'
        && JIN_BEILE_CHARACTER_IDS.has(character.id)
        && character.inPlay
    ));
    if (!hasOtherBeileInPlay) {
        return { factions, removedHuangtaiji: false };
    }

    return {
        factions: {
            ...factions,
            jin: {
                ...factions.jin,
                characters: jinCharacters.map((character) => (
                    character.id === 'jin-huangtaiji'
                        ? {
                            ...character,
                            inPlay: false,
                            removedFromGame: true,
                            defeatMarkers: 0,
                        }
                        : character
                )),
            },
        },
        removedHuangtaiji: true,
    };
};

const resolveJinDaisanConflict = (
    factions: QidahenCore['factions'],
): { factions: QidahenCore['factions']; removedDaisan: boolean } => {
    const jinCharacters = factions.jin.characters;
    const hasNurhaciInPlay = jinCharacters.some((character) => character.id === 'jin-nurhaci' && character.inPlay);
    const daisan = jinCharacters.find((character) => character.id === 'jin-daisan');
    if (hasNurhaciInPlay || !daisan?.inPlay) {
        return { factions, removedDaisan: false };
    }

    const hasOtherBeileInPlay = jinCharacters.some((character) => (
        character.id !== 'jin-daisan'
        && JIN_BEILE_CHARACTER_IDS.has(character.id)
        && character.inPlay
    ));
    if (!hasOtherBeileInPlay) {
        return { factions, removedDaisan: false };
    }

    return {
        factions: {
            ...factions,
            jin: {
                ...factions.jin,
                characters: jinCharacters.map((character) => (
                    character.id === 'jin-daisan'
                        ? {
                            ...character,
                            inPlay: false,
                            removedFromGame: false,
                            defeatMarkers: 0,
                        }
                        : character
                )),
            },
        },
        removedDaisan: true,
    };
};

const resolveNurhaciRemovedByYuanChonghuan = (
    factions: QidahenCore['factions'],
): { factions: QidahenCore['factions']; removedNurhaci: boolean } => {
    const hasYuanChonghuan = factions.ming.characters.some((character) => character.id === 'ming-yuan-chonghuan' && character.inPlay);
    const hasNurhaci = factions.jin.characters.some((character) => character.id === 'jin-nurhaci' && character.inPlay);
    if (!hasYuanChonghuan || !hasNurhaci) {
        return { factions, removedNurhaci: false };
    }

    return {
        factions: {
            ...factions,
            jin: {
                ...factions.jin,
                characters: factions.jin.characters.map((character) => (
                    character.id === 'jin-nurhaci'
                        ? {
                            ...character,
                            inPlay: false,
                            removedFromGame: true,
                            defeatMarkers: 0,
                        }
                        : character
                )),
            },
        },
        removedNurhaci: true,
    };
};

const getEffectiveHomelandController = (
    state: QidahenCore,
    regionId: string,
): QidahenFactionId | 'neutral' => {
    if (
        QISAI_NOYAN_HOMELAND_REGION_IDS.has(regionId)
        && hasActiveCharacter(state, 'mongol', 'mongol-qisai-noyan')
    ) {
        return 'mongol';
    }
    if (
        GUNCHU_KETUJI_HOMELAND_REGION_IDS.has(regionId)
        && hasActiveCharacter(state, 'mongol', 'mongol-gunchu-ketuji')
    ) {
        return 'mongol';
    }
    if (
        OBA_TAIJI_HOMELAND_REGION_IDS.has(regionId)
        && hasActiveCharacter(state, 'mongol', 'mongol-oba-taiji')
    ) {
        return 'mongol';
    }
    if (
        CHOGHTU_TAIJI_HOMELAND_REGION_IDS.has(regionId)
        && hasActiveCharacter(state, 'mongol', 'mongol-choghtu-taiji')
    ) {
        return 'mongol';
    }
    if (
        LINDAN_HUTUKTU_HOMELAND_REGION_IDS.has(regionId)
        && hasActiveCharacter(state, 'mongol', 'mongol-lindan-hutuktu')
    ) {
        return 'mongol';
    }
    return getQidahenInitialController(regionId);
};

const getAttackerDeckPlunderHandBonus = (
    state: QidahenCore,
    factionId: QidahenFactionId,
    plunderPopulation: number,
): number => (
    factionId === 'mongol' && hasActiveCharacter(state, 'mongol', 'mongol-gunchu-ketuji')
        ? Math.max(0, plunderPopulation)
        : 0
);

const getFanWenchengMidyearBonusDraw = (
    state: QidahenCore,
): { controlledHanRegionCount: number; bonusDrawCards: number } => {
    if (!hasActiveCharacter(state, 'jin', 'jin-fan-wencheng')) {
        return { controlledHanRegionCount: 0, bonusDrawCards: 0 };
    }
    const controlledHanRegionCount = state.regions.filter((region) => (
        !region.isLogicalRegion
        && HAN_RUNTIME_REGION_IDS.has(region.id)
        && region.controller === 'jin'
    )).length;
    return {
        controlledHanRegionCount,
        bonusDrawCards: controlledHanRegionCount * 2,
    };
};

const getQidahenCommandingFactionId = (
    attackerFactionId: QidahenFactionId,
    actionId: 'raid' | 'wheel-dispatch' | 'drive-tiger',
): QidahenFactionId => (
    actionId === 'drive-tiger' ? 'ming' : attackerFactionId
);

const getQidahenCharacterCommittedTroopLimit = (
    state: QidahenCore,
    attackerFactionId: QidahenFactionId,
    actionId: 'raid' | 'wheel-dispatch' | 'drive-tiger',
): number | null => {
    const commandingFactionId = getQidahenCommandingFactionId(attackerFactionId, actionId);
    if (commandingFactionId === 'ming' && hasActiveCharacter(state, 'ming', 'ming-yang-gao')) {
        return 10;
    }
    return null;
};

const computeEffectiveCommittedTroops = (
    state: QidahenCore,
    options: {
        attackerFactionId: QidahenFactionId;
        actionId: 'raid' | 'wheel-dispatch' | 'drive-tiger';
        availableTroops: number;
        boundaryUnitCap: number | null;
    },
): number => {
    const defaultCommittedTroops = computeQidahenCommittedTroops({
        availableTroops: options.availableTroops,
        boundaryUnitCap: options.boundaryUnitCap,
        actionId: options.actionId,
    });
    const characterCommittedTroopLimit = getQidahenCharacterCommittedTroopLimit(
        state,
        options.attackerFactionId,
        options.actionId,
    );
    if (characterCommittedTroopLimit == null) {
        return defaultCommittedTroops;
    }
    const normalizedAvailableTroops = Math.max(0, Math.floor(options.availableTroops));
    const normalizedBoundaryUnitCap = options.boundaryUnitCap == null
        ? characterCommittedTroopLimit
        : Math.min(characterCommittedTroopLimit, Math.max(0, Math.floor(options.boundaryUnitCap)));
    return Math.max(0, Math.min(normalizedAvailableTroops, normalizedBoundaryUnitCap));
};

const getQidahenFreeUpkeepSupport = (
    state: QidahenCore,
    factionId: QidahenFactionId,
    supportGap: number,
): number => (
    factionId === 'ming' && supportGap > 0 && hasActiveCharacter(state, 'ming', 'ming-wang-huazhen')
        ? 1
        : 0
);

const initialArmamentsByFaction: Record<QidahenFactionId, QidahenArmamentState[]> = {
    ming: [{ id: 'artillery-tech', name: '火炮技术', level: 1 }],
    mongol: [{ id: 'cavalry-armor', name: '骑兵铁甲', level: 1 }],
    jin: [{ id: 'infantry-armor', name: '步兵铁甲', level: 1 }],
};

const QIDAHEN_ARMAMENT_LOW_FIDELITY_MAX_LEVEL = 2;

const upgradeArmamentActionChoice: QidahenActionChoice = {
    id: 'upgrade-armament',
    label: '升级军备',
    cost: 2,
    detail: '打出军备牌并弃 1 张手牌，当前低保真先升级己方已开发军备。',
};

const createInitialArmamentStates = (factionId: QidahenFactionId): QidahenArmamentState[] => (
    initialArmamentsByFaction[factionId].map((armament) => ({ ...armament }))
);

const createFactionState = (
    id: QidahenFactionId,
    playerId: PlayerId,
    name: string,
    colorClass: string,
    vp: number,
    troops: number,
    grain: number,
    landTax: number,
): QidahenFactionState => ({
    id,
    playerId,
    name,
    colorClass,
    vp,
    troops,
    grain,
    landTax,
    handLimit: id === 'ming' ? 15 : 10,
    handCount: id === 'ming' ? 3 : id === 'mongol' ? 6 : 10,
    drawPileCount: 20,
    discardPileCount: id === 'ming' ? 7 : 0,
    actionDiamonds: id === 'jin' ? 2 : 3,
    defeatMarkers: 0,
    armaments: createInitialArmamentStates(id),
    characters: createInitialCharacterStates(id),
});

const actionChoiceCatalog: Record<QidahenFactionId, QidahenActionChoice[]> = {
    ming: [
        upgradeArmamentActionChoice,
        { id: 'raid', label: '突袭作战', cost: 1, detail: '弃 1 张手牌，执行进攻行动（不能执行调度）。' },
        { id: 'recruit', label: '征召军队', cost: 1, detail: '弃 1 张手牌，建立 6 个等级 2 部队、2 个等级 4 川兵；已研发火炮技术时可建立炮兵。' },
        { id: 'grant-pardon', label: '赐印招安', cost: 3, detail: '指定 1 个对手，将相邻部队改为大明控制。' },
        { id: 'drive-tiger', label: '驱虎吞狼', cost: 3, detail: '指定 1 个对手抽 6 张牌，并由大明指挥其部队。' },
    ],
    mongol: [
        upgradeArmamentActionChoice,
        { id: 'raid', label: '突袭作战', cost: 1, detail: '弃 1 张手牌，执行进攻行动（不能执行调度）。' },
        { id: 'ma-shi-trade', label: '马市贸易', cost: 1, detail: '弃 1 张手牌，大明选择建立 1-3 个部队，蒙古抽 2 倍张数的手牌。' },
        { id: 'khan-edict', label: '大汗令箭', cost: 1, detail: '弃 1 张手牌，执行征兵训练或外交雇佣，不需再支付花费。' },
    ],
    jin: [
        upgradeArmamentActionChoice,
        { id: 'raid', label: '突袭作战', cost: 1, detail: '弃 1 张手牌，执行进攻行动（不能执行调度）。' },
        { id: 'marriage-subjugation', label: '联姻诱降', cost: 2, detail: '弃 2 张手牌，指定邻近控制区域，触发对手支付或转控判定。' },
    ],
};

export const getActionChoicesForFaction = (factionId: QidahenFactionId): QidahenActionChoice[] => (
    actionChoiceCatalog[factionId].map((choice) => ({ ...choice }))
);

const getActionChoiceById = (actionId: string): QidahenActionChoice | undefined => (
    factionOrder.flatMap((factionId) => actionChoiceCatalog[factionId]).find((choice) => choice.id === actionId)
);

const getFactionIdByPlayerId = (state: QidahenCore, playerId: PlayerId): QidahenFactionId => (
    factionOrder.find((id) => state.factions[id].playerId === playerId) ?? 'ming'
);

const getCurrentFactionId = (state: QidahenCore): QidahenFactionId => (
    getFactionIdByPlayerId(state, state.currentPlayer)
);

const getActiveFactionTurnOrder = (state: QidahenCore): QidahenFactionId[] => {
    const chronologyOrder = state.currentFactionOrder;
    const hasValidChronologyOrder = (
        Array.isArray(chronologyOrder)
        && chronologyOrder.length === factionOrder.length
        && chronologyOrder.every((factionId) => factionOrder.includes(factionId))
        && new Set(chronologyOrder).size === factionOrder.length
    );
    // 当前开局基线仍保留既有剧本 opening；跨过首次新年后再切到纪年卡顺位。
    return hasValidChronologyOrder && state.currentYearIndex > 0
        ? [...chronologyOrder]
        : [...factionOrder];
};

const getDefaultActionIdForFaction = (factionId: QidahenFactionId): string => (
    defaultActionIdByFaction[factionId] ?? getActionChoicesForFaction(factionId)[0]?.id ?? 'raid'
);

const wheelMoveChoices: QidahenWheelMoveChoice[] = [
    { id: 'move-1-free', label: '免费走 1', steps: 1, drawText: '对手不抽牌' },
    { id: 'move-2-one-opponent', label: '一名对手抽 2，走 2', steps: 2, drawText: '蒙古抽 2' },
    { id: 'move-3-all-opponents', label: '所有对手抽 2，走 3', steps: 3, drawText: '蒙古、后金各抽 2' },
];

const QIDAHEN_FACTION_HAND_PREVIEW_COUNT = 16;

const factionHandPreviewById: Record<QidahenFactionId, (index: number) => QidahenHandCard['previewRef']> = {
    ming: qidahenMingHandPreview,
    mongol: qidahenMongolHandPreview,
    jin: qidahenJinHandPreview,
};

const wheelDispatchProfileIdByPosition: Partial<Record<string, QidahenMovementProfileId>> = {
    'wheel-diplomacy': 'dispatch-infantry',
    'wheel-hire': 'dispatch-cavalry',
};

const controlMarkerByFaction: Record<QidahenFactionId, string> = {
    ming: 'qidahen/markers/ming-control-diplomacy-marker-a',
    mongol: 'qidahen/markers/mongol-control-diplomacy-marker-a',
    jin: 'qidahen/markers/jin-control-diplomacy-marker-a',
};

const diplomacyMarkerImageByFaction: Record<QidahenFactionId, Record<'friendly' | 'vassal', string>> = {
    ming: {
        friendly: 'qidahen/markers/ming-control-diplomacy-marker-b',
        vassal: 'qidahen/markers/ming-control-diplomacy-marker-a',
    },
    mongol: {
        friendly: 'qidahen/markers/mongol-control-diplomacy-marker-b',
        vassal: 'qidahen/markers/mongol-control-diplomacy-marker-a',
    },
    jin: {
        friendly: 'qidahen/markers/jin-control-diplomacy-marker-b',
        vassal: 'qidahen/markers/jin-control-diplomacy-marker-a',
    },
};

const controlTokenByRegion: Record<string, string> = {
    'city-region-11': 'changbai-control',
    'city-region-13': 'jianzhou-control',
    'city-region-14': 'chahar-control',
    jinzhou: 'jinzhou-control',
    'song-jin': 'songjin-control',
};

const getYearLabelByIndex = (yearIndex: number): string => (
    YEAR_SEQUENCE[Math.max(0, Math.min(yearIndex, YEAR_SEQUENCE.length - 1))]
    ?? YEAR_SEQUENCE[YEAR_SEQUENCE.length - 1]
);

const getChronologyYearConfig = (yearIndex: number): QidahenChronologyYearConfig => (
    QIDAHEN_CHRONOLOGY_YEAR_CONFIGS[Math.max(0, Math.min(yearIndex, QIDAHEN_CHRONOLOGY_YEAR_CONFIGS.length - 1))]
    ?? QIDAHEN_CHRONOLOGY_YEAR_CONFIGS[QIDAHEN_CHRONOLOGY_YEAR_CONFIGS.length - 1]
);

const getChronologyPreviewIndex = (yearIndex: number): number => (
    getChronologyYearConfig(yearIndex).previewIndex
);

const getFactionOrderForYearIndex = (yearIndex: number): QidahenFactionId[] => (
    [...getChronologyYearConfig(yearIndex).factionOrder]
);

const getChronologyCharacterAvailabilityForYear = (
    yearIndex: number,
    factionId: QidahenFactionId,
): QidahenChronologyCharacterAvailability => (
    getChronologyYearConfig(yearIndex).characterAvailabilityByFaction[factionId]
);

const getCharacterNameById = (
    factionId: QidahenFactionId,
    characterId: string,
): string => (
    initialCharacterSeedsByFaction[factionId].find((character) => character.id === characterId)?.name
    ?? characterId
);

const selectChronologyRepresentativeCharacterIds = (
    characters: QidahenCharacterState[],
    rule: Extract<QidahenChronologyCharacterAvailability, { mode: 'representative' }>,
): string[] => {
    const activeCharacterIds = new Set(
        characters
            .filter((character) => character.inPlay || character.removedFromGame)
            .map((character) => character.id),
    );
    const nextCharacterId = rule.characterIds.find((characterId) => !activeCharacterIds.has(characterId));
    return nextCharacterId ? [nextCharacterId] : [];
};

const applyChronologyCharactersForYear = (
    factions: QidahenCore['factions'],
    yearIndex: number,
): {
    factions: QidahenCore['factions'];
    summaryLines: string[];
} => {
    let nextFactions = factions;
    const summaryLines: string[] = [];

    for (const factionId of factionOrder) {
        const rule = getChronologyCharacterAvailabilityForYear(yearIndex, factionId);
        const currentFaction = nextFactions[factionId];
        const currentCharacters = currentFaction.characters.length > 0
            ? currentFaction.characters
            : createInitialCharacterStates(factionId);

        let activatedCharacterIds: string[] = [];
        if (rule.mode === 'exact') {
            activatedCharacterIds = rule.characterIds;
        } else if (rule.mode === 'representative') {
            activatedCharacterIds = selectChronologyRepresentativeCharacterIds(currentCharacters, rule);
        }

        const activatedIdSet = new Set(activatedCharacterIds);
        const nextCharacters = currentCharacters.map((character) => (
            activatedIdSet.has(character.id) && !character.removedFromGame
                ? { ...character, inPlay: true }
                : character
        ));
        nextFactions = {
            ...nextFactions,
            [factionId]: {
                ...currentFaction,
                characters: nextCharacters,
            },
        };

        if (rule.mode === 'none') {
            summaryLines.push(`${currentFaction.name} 本年人物：无新增出场。`);
            continue;
        }

        if (rule.mode === 'exact') {
            const names = rule.characterIds.map((characterId) => getCharacterNameById(factionId, characterId));
            summaryLines.push(`${currentFaction.name} 本年人物：${names.join('、')}。`);
            continue;
        }

        if (activatedCharacterIds.length === 0) {
            summaryLines.push(`${currentFaction.name} 本年人物：${rule.summary}；候选人物已全部在场，无新增出场。`);
            continue;
        }

        summaryLines.push(`${currentFaction.name} 本年人物：${rule.summary}；当前启用 ${getCharacterNameById(factionId, activatedCharacterIds[0])}。`);
    }

    const mingConflictResolution = resolveMingCharacterConflict(nextFactions);
    nextFactions = mingConflictResolution.factions;
    if (mingConflictResolution.removedMaoWenlong) {
        summaryLines.push('大明人物冲突：毛文龙与袁崇焕同场，毛文龙离场。');
    }

    const nurhaciRemoval = resolveNurhaciRemovedByYuanChonghuan(nextFactions);
    nextFactions = nurhaciRemoval.factions;
    if (nurhaciRemoval.removedNurhaci) {
        summaryLines.push('人物克制：袁崇焕在场，努尔哈赤被移出游戏。');
    }

    const jinConflictResolution = resolveJinHuangtaijiConflict(nextFactions);
    nextFactions = jinConflictResolution.factions;
    if (jinConflictResolution.removedHuangtaiji) {
        summaryLines.push('后金人物冲突：皇太极与其他贝勒同场，被拣弃并直接自游戏中移除。');
    }

    const daisanConflictResolution = resolveJinDaisanConflict(nextFactions);
    nextFactions = daisanConflictResolution.factions;
    if (daisanConflictResolution.removedDaisan) {
        summaryLines.push('后金人物冲突：代善与其他贝勒同场，被拣弃并回到后金人物牌堆。');
    }

    return {
        factions: nextFactions,
        summaryLines,
    };
};

const buildYearCardSlots = (yearIndex: number): QidahenCore['yearCards'] => [
    { id: 'current-year', label: '今年纪年卡', previewRef: qidahenChronologyPreview(getChronologyPreviewIndex(yearIndex)) },
    { id: 'next-year', label: '下一年纪年', previewRef: qidahenChronologyPreview(getChronologyPreviewIndex(yearIndex + 1)) },
];

const getYearCardClaimCost = (handCount: number): number => Math.ceil(Math.max(0, handCount) / 2);

const getChronologyClaimPriority = (state: QidahenCore): QidahenFactionId[] => {
    const effectiveVpByFaction = Object.fromEntries(
        factionOrder.map((factionId) => [factionId, getQidahenEffectiveVpByFaction(state, factionId)]),
    ) as Record<QidahenFactionId, number>;
    const currentOrderIndexByFaction = Object.fromEntries(
        factionOrder.map((factionId) => {
            const orderIndex = state.currentFactionOrder.indexOf(factionId);
            return [factionId, orderIndex >= 0 ? orderIndex : factionOrder.indexOf(factionId)];
        }),
    ) as Record<QidahenFactionId, number>;

    return [...factionOrder].sort((left, right) => {
        const vpDiff = effectiveVpByFaction[right] - effectiveVpByFaction[left];
        if (vpDiff !== 0) {
            return vpDiff;
        }
        return currentOrderIndexByFaction[right] - currentOrderIndexByFaction[left];
    });
};

const inferTroopKindForStack = (stack: QidahenSpecialTroopStack): QidahenTroopKind => {
    if (stack.troopKind) {
        return stack.troopKind;
    }
    if (stack.id.includes('artillery') || stack.label.includes('炮')) {
        return 'artillery';
    }
    if (stack.id.includes('cavalry') || stack.label.includes('骑')) {
        return 'cavalry';
    }
    return 'infantry';
};

const normalizeSpecialTroopStack = (stack: QidahenSpecialTroopStack): QidahenSpecialTroopStack => ({
    ...stack,
    troopKind: inferTroopKindForStack(stack),
});

const mergeSpecialTroopStacks = (
    stacks: QidahenSpecialTroopStack[],
): QidahenSpecialTroopStack[] => {
    const merged = new Map<string, QidahenSpecialTroopStack>();
    for (const stack of stacks) {
        const previous = merged.get(stack.id);
        if (previous) {
            previous.count += stack.count;
            continue;
        }
        merged.set(stack.id, normalizeSpecialTroopStack(stack));
    }
    return Array.from(merged.values()).filter((stack) => stack.count > 0);
};

const addSpecialTroopStackToRegion = (
    region: QidahenCore['regions'][number],
    stack: QidahenSpecialTroopStack,
) => ({
    ...region,
    specialTroops: mergeSpecialTroopStacks([
        ...region.specialTroops,
        stack,
    ]),
});

const getRegularTroopKindForFaction = (factionId: QidahenFactionId): QidahenTroopKind => (
    factionId === 'mongol' ? 'cavalry' : 'infantry'
);

const troopKindLabelById: Record<QidahenTroopKind, string> = {
    infantry: '步兵',
    cavalry: '骑兵',
    artillery: '炮兵',
};

const buildRegularTroopStack = (
    factionId: QidahenFactionId,
    sourceId: string,
    count: number,
    level = 2,
): QidahenSpecialTroopStack => {
    const troopKind = getRegularTroopKindForFaction(factionId);
    return {
        id: `${factionId}-${sourceId}-regular-${troopKind}-lv${level}`,
        label: `${factionDisplayNameById[factionId]}${troopKindLabelById[troopKind]}`,
        faction: factionId,
        troopKind,
        count,
        level,
    };
};

const buildArtilleryTroopStack = (
    factionId: QidahenFactionId,
    sourceId: string,
    count: number,
    level = 1,
): QidahenSpecialTroopStack => ({
    id: `${factionId}-${sourceId}-regular-artillery-lv${clampTroopLevel(level)}`,
    label: `${factionDisplayNameById[factionId]}炮兵`,
    faction: factionId,
    troopKind: 'artillery',
    count,
    level: clampTroopLevel(level),
});

const trainArtilleryStacksToLevel = (
    region: QidahenCore['regions'][number],
    maxLevel: number,
): { region: QidahenCore['regions'][number]; trainedCount: number; targetLevel: number } => {
    const targetLevel = clampTroopLevel(maxLevel);
    if (targetLevel <= 1 || region.specialTroops.length === 0) {
        return { region, trainedCount: 0, targetLevel };
    }

    let trainedCount = 0;
    const specialTroops = region.specialTroops
        .map(normalizeSpecialTroopStack)
        .map((stack) => {
            if (stack.troopKind !== 'artillery' || stack.level >= targetLevel) {
                return stack;
            }
            trainedCount += stack.count;
            return {
                ...stack,
                id: stack.id.replace(/-lv\d+$/, `-lv${targetLevel}`),
                level: targetLevel,
            };
        });

    if (trainedCount <= 0) {
        return { region, trainedCount: 0, targetLevel };
    }

    return {
        region: {
            ...region,
            note: `${region.note} 轮盘征兵训练将 ${trainedCount} 个炮兵训练至 ${targetLevel} 级。`.trim(),
            specialTroops: mergeSpecialTroopStacks(specialTroops),
        },
        trainedCount,
        targetLevel,
    };
};

const trainSpecialTroopsOneStepForFaction = (
    region: QidahenCore['regions'][number],
    factionId: QidahenFactionId,
    artilleryMaxLevel: number,
): { region: QidahenCore['regions'][number]; trainedCount: number; trainedDetails: string[] } => {
    let trainedCount = 0;
    const trainedDetails: string[] = [];
    const specialTroops = region.specialTroops
        .map(normalizeSpecialTroopStack)
        .map((stack) => {
            if (stack.faction !== factionId) {
                return stack;
            }

            const maxLevel = stack.troopKind === 'artillery'
                ? clampTroopLevel(Math.max(1, artilleryMaxLevel))
                : 4;
            const nextLevel = Math.min(maxLevel, clampTroopLevel(stack.level + 1));
            if (nextLevel <= stack.level) {
                return stack;
            }

            trainedCount += stack.count;
            trainedDetails.push(`${stack.label} x${stack.count} 升至 ${nextLevel} 级`);
            return {
                ...stack,
                id: stack.id.replace(/-lv\d+$/, `-lv${nextLevel}`),
                level: nextLevel,
            };
        });

    if (trainedCount <= 0) {
        return { region, trainedCount: 0, trainedDetails: [] };
    }

    return {
        region: {
            ...region,
            note: `${region.note} 部队经免费训练后提升 1 级。`.trim(),
            specialTroops: mergeSpecialTroopStacks(specialTroops),
        },
        trainedCount,
        trainedDetails,
    };
};

const trainTroopsOneStepForFactionWithLimit = (
    region: QidahenCore['regions'][number],
    factionId: QidahenFactionId,
    artilleryMaxLevel: number,
    maxTroops: number,
): { region: QidahenCore['regions'][number]; trainedCount: number; trainedDetails: string[] } => {
    let remainingTroops = Math.max(0, Math.floor(maxTroops));
    if (remainingTroops <= 0) {
        return { region, trainedCount: 0, trainedDetails: [] };
    }

    let trainedCount = 0;
    const trainedDetails: string[] = [];
    const specialTroops = region.specialTroops.map(normalizeSpecialTroopStack);
    const originalSpecialTroopCount = specialTroops.reduce((sum, stack) => sum + stack.count, 0);
    const nextSpecialTroops: QidahenSpecialTroopStack[] = [];

    for (const stack of specialTroops) {
        if (stack.faction !== factionId) {
            nextSpecialTroops.push(stack);
            continue;
        }

        const maxLevel = stack.troopKind === 'artillery'
            ? clampTroopLevel(Math.max(1, artilleryMaxLevel))
            : 4;
        const nextLevel = Math.min(maxLevel, clampTroopLevel(stack.level + 1));
        if (remainingTroops <= 0 || nextLevel <= stack.level) {
            nextSpecialTroops.push(stack);
            continue;
        }

        const upgradedTroops = Math.min(stack.count, remainingTroops);
        const remainingCount = stack.count - upgradedTroops;
        if (remainingCount > 0) {
            nextSpecialTroops.push({
                ...stack,
                count: remainingCount,
            });
        }
        nextSpecialTroops.push({
            ...stack,
            id: stack.id.replace(/-lv\d+$/, `-lv${nextLevel}`),
            count: upgradedTroops,
            level: nextLevel,
        });
        trainedCount += upgradedTroops;
        remainingTroops -= upgradedTroops;
        trainedDetails.push(`${stack.label} x${upgradedTroops} 升至 ${nextLevel} 级`);
    }

    const genericTroops = region.controller === factionId
        ? Math.max(0, region.troops - originalSpecialTroopCount)
        : 0;
    if (remainingTroops > 0 && genericTroops > 0) {
        const upgradedTroops = Math.min(genericTroops, remainingTroops);
        const upgradedLevel = 3;
        const upgradedStack = buildRegularTroopStack(factionId, `${region.id}-xiong-tingbi`, upgradedTroops, upgradedLevel);
        nextSpecialTroops.push(upgradedStack);
        trainedCount += upgradedTroops;
        trainedDetails.push(`${upgradedStack.label} x${upgradedTroops} 升至 ${upgradedLevel} 级`);
    }

    if (trainedCount <= 0) {
        return { region, trainedCount: 0, trainedDetails: [] };
    }

    return {
        region: {
            ...region,
            note: `${region.note} 部队经熊廷弼免费训练后提升 1 级。`.trim(),
            specialTroops: mergeSpecialTroopStacks(nextSpecialTroops),
        },
        trainedCount,
        trainedDetails,
    };
};

const getMercenaryTroopCount = (region: Pick<QidahenCore['regions'][number], 'specialTroops'>): number => (
    region.specialTroops
        .filter((stack) => stack.id.includes('mercenary') || stack.label === '雇佣军')
        .reduce((sum, stack) => sum + stack.count, 0)
);

const hasNonMercenaryTroops = (
    region: Pick<QidahenCore['regions'][number], 'troops' | 'specialTroops'>,
): boolean => region.troops > getMercenaryTroopCount(region);

const NON_HAN_RUNTIME_REGION_IDS = new Set([
    'city-region-2',
    'city-region-3',
    'city-region-4',
    'city-region-5',
    'city-region-6',
    'city-region-7',
    'city-region-8',
    'city-region-9',
    'city-region-10',
    'city-region-11',
    'city-region-13',
    'city-region-14',
    'city-region-16',
    'city-region-17',
    'city-region-19',
    'city-region-20',
    'city-region-26',
    'xian-xing',
    'city-region-18',
    'city-region-29',
]);

const getRegularTroopCount = (region: Pick<QidahenCore['regions'][number], 'specialTroops'>, factionId: QidahenFactionId): number => (
    region.specialTroops
        .filter((stack) => stack.faction === factionId)
        .filter((stack) => !(stack.id.includes('mercenary') || stack.label.includes('雇佣')))
        .reduce((sum, stack) => sum + stack.count, 0)
);

interface QidahenCombatUnit {
    level: number;
    count: number;
    troopKind: QidahenTroopKind;
    factionId: QidahenFactionId | null;
    structured: boolean;
}

type QidahenBattleUnitSide = 'attacker' | 'defender';

const dieSidesByTroopLevel: Record<number, number> = {
    1: 6,
    2: 8,
    3: 10,
    4: 12,
};

const clampTroopLevel = (level: number): number => Math.max(1, Math.min(4, Math.floor(level)));

const getTroopDieSides = (level: number): number => dieSidesByTroopLevel[clampTroopLevel(level)] ?? 6;

const getArmamentLevel = (
    state: QidahenCore,
    factionId: QidahenFactionId | null,
    armamentId: QidahenArmamentId,
): number => {
    if (!factionId) {
        return 0;
    }
    return state.factions[factionId].armaments.find((armament) => armament.id === armamentId)?.level ?? 0;
};

const upgradeLowFidelityArmament = (
    armaments: QidahenArmamentState[],
): { armaments: QidahenArmamentState[]; upgradedArmament: QidahenArmamentState | null } => {
    const targetIndex = armaments.findIndex((armament) => armament.level < QIDAHEN_ARMAMENT_LOW_FIDELITY_MAX_LEVEL);
    if (targetIndex < 0) {
        return { armaments: armaments.map((armament) => ({ ...armament })), upgradedArmament: null };
    }

    const upgradedArmament = {
        ...armaments[targetIndex],
        level: armaments[targetIndex].level + 1,
    };
    const nextArmaments = armaments.map((armament, index) => (
        index === targetIndex ? upgradedArmament : { ...armament }
    ));

    return { armaments: nextArmaments, upgradedArmament };
};

const isSunYuanhuaEnabled = (state: QidahenCore): boolean => (
    hasActiveCharacter(state, 'ming', 'ming-sun-yuanhua')
    && hasActiveCharacter(state, 'ming', 'ming-yuan-chonghuan')
);

const hasUpgradableArmament = (
    state: QidahenCore,
    factionId: QidahenFactionId,
): boolean => (
    state.factions[factionId].armaments.some((armament) => armament.level < QIDAHEN_ARMAMENT_LOW_FIDELITY_MAX_LEVEL)
);

const getBattleRollArmamentBonus = (
    state: QidahenCore,
    unit: QidahenCombatUnit,
): number => {
    if (!unit.structured) {
        return 0;
    }
    if (unit.troopKind === 'infantry') {
        return getArmamentLevel(state, unit.factionId, 'infantry-armor');
    }
    if (unit.troopKind === 'cavalry') {
        return getArmamentLevel(state, unit.factionId, 'cavalry-armor');
    }
    return 0;
};

const getBattleRollCharacterBonus = (
    state: QidahenCore,
    unit: QidahenCombatUnit,
): number => {
    if (
        unit.structured
        && unit.factionId === 'ming'
        && unit.troopKind === 'artillery'
        && isSunYuanhuaEnabled(state)
    ) {
        return 2;
    }
    return 0;
};

const hasJinDefeatLossImmunity = (
    state: QidahenCore,
    factionId: QidahenFactionId,
): boolean => (
    factionId === 'jin' && hasActiveCharacter(state, 'jin', 'jin-daisan')
);

const getEffectiveCombatUnitLevel = (
    state: QidahenCore,
    unit: QidahenCombatUnit,
    side: QidahenBattleUnitSide,
): number => {
    let nextLevel = clampTroopLevel(unit.level);
    if (
        unit.structured
        && unit.factionId === 'jin'
        && unit.troopKind === 'infantry'
        && hasActiveCharacter(state, 'jin', 'jin-nurhaci')
    ) {
        nextLevel = clampTroopLevel(nextLevel + 1);
    }
    if (
        side === 'attacker'
        && unit.factionId === 'mongol'
        && unit.troopKind === 'cavalry'
        && hasActiveCharacter(state, 'mongol', 'mongol-qisai-noyan')
    ) {
        nextLevel = clampTroopLevel(nextLevel + 1);
    }
    return nextLevel;
};

const getSpecialTroopCount = (region: Pick<QidahenCore['regions'][number], 'specialTroops'>): number => (
    region.specialTroops.reduce((sum, stack) => sum + stack.count, 0)
);

const getArtilleryTroopCount = (region: Pick<QidahenCore['regions'][number], 'specialTroops'>): number => (
    region.specialTroops
        .map(normalizeSpecialTroopStack)
        .filter((stack) => stack.troopKind === 'artillery')
        .reduce((sum, stack) => sum + stack.count, 0)
);

const getBattleResolutionTroopCount = (
    region: Pick<QidahenCore['regions'][number], 'troops' | 'specialTroops'>,
): number => Math.max(0, region.troops - getArtilleryTroopCount(region));

const getMovableTroopCountForProfile = (
    region: Pick<QidahenCore['regions'][number], 'troops' | 'specialTroops'>,
    movementProfileId: QidahenMovementProfileId,
): number => {
    if (region.specialTroops.length === 0) {
        return region.troops;
    }

    const cavalryCount = region.specialTroops
        .map(normalizeSpecialTroopStack)
        .filter((stack) => stack.troopKind === 'cavalry')
        .reduce((sum, stack) => sum + stack.count, 0);
    if (movementProfileId === 'cavalry' || movementProfileId === 'dispatch-cavalry') {
        return Math.max(0, Math.min(region.troops, cavalryCount));
    }

    return Math.max(0, region.troops - cavalryCount);
};

const isTroopKindAllowedForMovementProfile = (
    troopKind: QidahenTroopKind,
    movementProfileId?: string | null,
): boolean => {
    if (movementProfileId === 'cavalry' || movementProfileId === 'dispatch-cavalry') {
        return troopKind === 'cavalry';
    }
    if (movementProfileId === 'infantry' || movementProfileId === 'dispatch-infantry') {
        return troopKind !== 'cavalry';
    }
    return true;
};

const sortByCasualtyPriority = <T extends { level: number }>(
    items: T[],
    priority: QidahenCasualtyPriority = 'highest-level',
): T[] => items.sort((left, right) => (
    priority === 'lowest-level'
        ? left.level - right.level
        : right.level - left.level
));

const buildCombatUnits = (
    region: Pick<QidahenCore['regions'][number], 'controller' | 'troops' | 'specialTroops'>,
): QidahenCombatUnit[] => {
    const specialUnits = region.specialTroops.map((stack) => ({
        level: Math.max(1, stack.level),
        count: Math.max(0, stack.count),
        troopKind: inferTroopKindForStack(stack),
        factionId: stack.faction,
        structured: true,
    }));
    const genericTroops = Math.max(0, region.troops - getSpecialTroopCount(region));
    return [
        ...specialUnits,
        ...(genericTroops > 0
            ? [{
                level: 2,
                count: genericTroops,
                troopKind: 'infantry' as const,
                factionId: region.controller === 'neutral' ? null : region.controller,
                structured: false,
            }]
            : []),
    ].filter((unit) => unit.count > 0);
};

const takeBattleUnits = (
    units: QidahenCombatUnit[],
    maxNonArtilleryTroops: number,
): QidahenCombatUnit[] => {
    const artilleryUnits = units
        .filter((unit) => unit.troopKind === 'artillery')
        .map((unit) => ({ ...unit, level: clampTroopLevel(unit.level) }));
    let remainingNonArtillery = Math.max(0, maxNonArtilleryTroops);
    const nonArtilleryUnits: QidahenCombatUnit[] = [];

    for (const unit of units
        .filter((item) => item.troopKind !== 'artillery')
        .sort((left, right) => right.level - left.level)) {
        if (remainingNonArtillery <= 0) {
            break;
        }
        const used = Math.min(unit.count, remainingNonArtillery);
        if (used > 0) {
            nonArtilleryUnits.push({
                ...unit,
                count: used,
                level: clampTroopLevel(unit.level),
            });
            remainingNonArtillery -= used;
        }
    }

    return [...artilleryUnits, ...nonArtilleryUnits].filter((unit) => unit.count > 0);
};

const buildCommittedBattleUnits = (
    sourceRegion: Pick<QidahenCore['regions'][number], 'controller' | 'troops' | 'specialTroops'>,
    committedTroops: number,
    maxNonArtilleryTroops: number,
    movementProfileId?: string | null,
): QidahenCombatUnit[] => {
    const committedSpecialTroops = takeCommittedSpecialTroopStacks(sourceRegion, committedTroops, movementProfileId);
    const committedSpecialCount = getSpecialTroopCount({ specialTroops: committedSpecialTroops });
    const committedGenericTroops = Math.max(0, committedTroops - committedSpecialCount);
    const units = [
        ...committedSpecialTroops.map((stack) => ({
            level: clampTroopLevel(stack.level),
            count: Math.max(0, stack.count),
            troopKind: inferTroopKindForStack(stack),
            factionId: stack.faction,
            structured: true,
        })),
        ...(committedGenericTroops > 0
            ? [{
                level: 2,
                count: committedGenericTroops,
                troopKind: 'infantry' as const,
                factionId: sourceRegion.controller === 'neutral' ? null : sourceRegion.controller,
                structured: false,
            }]
            : []),
    ];

    return takeBattleUnits(units, maxNonArtilleryTroops);
};

const rollCombatUnit = (
    random: RandomFn,
    state: QidahenCore,
    unit: QidahenCombatUnit,
    phase: QidahenBattleRollPhase,
    cityBattle: boolean,
    side: QidahenBattleUnitSide,
): QidahenBattleRoll[] => {
    const rolls: QidahenBattleRoll[] = [];
    const effectiveLevel = getEffectiveCombatUnitLevel(state, unit, side);
    for (let index = 0; index < unit.count; index += 1) {
        const dieSides = getTroopDieSides(effectiveLevel);
        const raw = random.d(dieSides);
        const armamentBonus = getBattleRollArmamentBonus(state, unit);
        const characterBonus = getBattleRollCharacterBonus(state, unit);
        const armoredValue = raw + armamentBonus + characterBonus;
        const value = cityBattle && phase === 'melee' && unit.troopKind === 'cavalry'
            ? Math.max(0, armoredValue - 1)
            : armoredValue;
        rolls.push({
            troopKind: unit.troopKind,
            level: effectiveLevel,
            dieSides,
            raw,
            value,
        });
    }
    return rolls;
};

const formatBattleRolls = (rolls: QidahenBattleRoll[]): string => (
    rolls.length > 0
        ? rolls.map((roll) => roll.raw === roll.value ? String(roll.value) : `${roll.raw}->${roll.value}`).join('/')
        : '-'
);

const battlePhaseLabelById: Record<QidahenBattleRollPhase, string> = {
    artillery: '炮兵',
    cavalry: '骑兵',
    infantry: '步兵',
    melee: '骑步',
};

const trimBattleUnitsBeforeCounterRoll = (
    units: QidahenCombatUnit[],
    preventedCount: number,
): QidahenCombatUnit[] => {
    let remainingPreventedCount = Math.max(0, preventedCount);
    return units
        .slice()
        .sort((left, right) => left.level - right.level)
        .map((unit) => {
            if (remainingPreventedCount <= 0) {
                return unit;
            }
            const prevented = Math.min(unit.count, remainingPreventedCount);
            remainingPreventedCount -= prevented;
            return {
                ...unit,
                count: unit.count - prevented,
            };
        })
        .filter((unit) => unit.count > 0);
};

const getEiduPriorityPhase = (
    state: QidahenCore,
    attackerUnits: QidahenCombatUnit[],
    defenderUnits: QidahenCombatUnit[],
    cityBattle: boolean,
): {
    phase: Extract<QidahenBattleRollPhase, 'artillery' | 'cavalry' | 'infantry'>;
    side: QidahenBattleUnitSide;
    note: string;
} | null => {
    const attackerHasEidu = attackerUnits.some((unit) => unit.factionId === 'jin') && hasActiveCharacter(state, 'jin', 'jin-eidu');
    const defenderHasEidu = defenderUnits.some((unit) => unit.factionId === 'jin') && hasActiveCharacter(state, 'jin', 'jin-eidu');
    if (!attackerHasEidu && !defenderHasEidu) {
        return null;
    }

    const prioritySide: QidahenBattleUnitSide = attackerHasEidu ? 'attacker' : 'defender';
    const ownUnits = prioritySide === 'attacker' ? attackerUnits : defenderUnits;
    const enemyUnits = prioritySide === 'attacker' ? defenderUnits : attackerUnits;
    const candidatePhases: Array<Extract<QidahenBattleRollPhase, 'artillery' | 'cavalry' | 'infantry'>> = cityBattle
        ? ['artillery']
        : ['artillery', 'cavalry', 'infantry'];

    const bestCandidate = candidatePhases
        .map((phase) => {
            const ownPower = ownUnits
                .filter((unit) => unit.troopKind === phase)
                .reduce((sum, unit) => sum + unit.level * unit.count, 0);
            const enemyPower = enemyUnits
                .filter((unit) => unit.troopKind === phase)
                .reduce((sum, unit) => sum + unit.level * unit.count, 0);
            return { phase, ownPower, enemyPower };
        })
        .filter((candidate) => candidate.ownPower > 0 && candidate.enemyPower > 0)
        .sort((left, right) => (
            (right.ownPower * 100 + right.enemyPower) - (left.ownPower * 100 + left.enemyPower)
        ))[0];

    if (!bestCandidate) {
        return null;
    }

    return {
        phase: bestCandidate.phase,
        side: prioritySide,
        note: `额亦都指定${troopKindLabelById[bestCandidate.phase]}先掷`,
    };
};

const rollBattleStage = (
    random: RandomFn,
    state: QidahenCore,
    phase: QidahenBattleRollPhase,
    attackerUnits: QidahenCombatUnit[],
    defenderUnits: QidahenCombatUnit[],
    cityBattle: boolean,
    eiduPriority: ReturnType<typeof getEiduPriorityPhase>,
) => {
    const accepts = (unit: QidahenCombatUnit) => (
        phase === 'melee'
            ? unit.troopKind === 'cavalry' || unit.troopKind === 'infantry'
            : unit.troopKind === phase
    );
    const stageAttackerUnits = attackerUnits.filter(accepts);
    const stageDefenderUnits = defenderUnits.filter(accepts);
    let attackerRolls: QidahenBattleRoll[] = [];
    let defenderRolls: QidahenBattleRoll[] = [];

    if (eiduPriority?.phase === phase && phase !== 'melee') {
        if (eiduPriority.side === 'attacker') {
            attackerRolls = stageAttackerUnits.flatMap((unit) => rollCombatUnit(random, state, unit, phase, cityBattle, 'attacker'));
            const preventedDefenderUnits = trimBattleUnitsBeforeCounterRoll(
                stageDefenderUnits,
                Math.floor(attackerRolls.reduce((sum, roll) => sum + roll.value, 0) / 3),
            );
            defenderRolls = preventedDefenderUnits.flatMap((unit) => rollCombatUnit(random, state, unit, phase, cityBattle, 'defender'));
        } else {
            defenderRolls = stageDefenderUnits.flatMap((unit) => rollCombatUnit(random, state, unit, phase, cityBattle, 'defender'));
            const preventedAttackerUnits = trimBattleUnitsBeforeCounterRoll(
                stageAttackerUnits,
                Math.floor(defenderRolls.reduce((sum, roll) => sum + roll.value, 0) / 3),
            );
            attackerRolls = preventedAttackerUnits.flatMap((unit) => rollCombatUnit(random, state, unit, phase, cityBattle, 'attacker'));
        }
    } else {
        attackerRolls = stageAttackerUnits
            .flatMap((unit) => rollCombatUnit(random, state, unit, phase, cityBattle, 'attacker'));
        defenderRolls = stageDefenderUnits
            .flatMap((unit) => rollCombatUnit(random, state, unit, phase, cityBattle, 'defender'));
    }
    const attackerTotal = attackerRolls.reduce((sum, roll) => sum + roll.value, 0);
    const defenderTotal = defenderRolls.reduce((sum, roll) => sum + roll.value, 0);

    return {
        phase,
        attackerRolls,
        defenderRolls,
        attackerTotal,
        defenderTotal,
        attackerDamage: Math.floor(attackerTotal / 3),
        defenderDamage: Math.floor(defenderTotal / 3),
        priorityNote: eiduPriority?.phase === phase ? eiduPriority.note : null,
    };
};

const buildBattleRollSummary = (stages: ReturnType<typeof rollBattleStage>[], cityBattle: boolean): string => {
    const stageTexts = stages.map((stage) => (
        `${battlePhaseLabelById[stage.phase]}${stage.priorityNote ? `(${stage.priorityNote})` : ''} 攻${formatBattleRolls(stage.attackerRolls)}=${stage.attackerTotal}/守${formatBattleRolls(stage.defenderRolls)}=${stage.defenderTotal}`
    ));
    const attackerDamage = stages.reduce((sum, stage) => sum + stage.attackerDamage, 0);
    const defenderDamage = stages.reduce((sum, stage) => sum + stage.defenderDamage, 0);
    return `战斗掷骰（${cityBattle ? '城战' : '野战'}）：${stageTexts.join('；')}。攻方造成 ${attackerDamage} 损伤，守方造成 ${defenderDamage} 损伤。`;
};

const createStructuredBattleRolls = (
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
    random: RandomFn,
    options: Pick<ResolvePendingActionCommand['payload'], 'defenderSortieBattle' | 'defenderHoldCity' | 'defenderCavalryEvasion' | 'attackerCavalryPlunder'>,
): QidahenBattleRolls | null => {
    if (options.defenderHoldCity || options.defenderCavalryEvasion || options.attackerCavalryPlunder) {
        return null;
    }
    if (pendingTargetAction.actionId !== 'raid' && pendingTargetAction.actionId !== 'wheel-dispatch' && pendingTargetAction.actionId !== 'drive-tiger') {
        return null;
    }

    const sourceRegion = getPendingActionSourceForceSnapshot(state, pendingTargetAction);
    const targetRegion = state.regions.find((region) => !region.isLogicalRegion && region.id === pendingTargetAction.targetRuntimeRegionId) ?? null;
    if (!sourceRegion || !targetRegion) {
        return null;
    }

    const battleMode = resolvePendingBattleMode(pendingTargetAction, targetRegion, options);
    const targetBattleRegion = getPendingActionDefenderForceSnapshot(targetRegion, pendingTargetAction, battleMode);
    const hasStructuredTroops = sourceRegion.specialTroops.length > 0 || targetBattleRegion.specialTroops.length > 0;
    if (!hasStructuredTroops) {
        return null;
    }

    const effectiveDefenderTroops = getEffectivePendingDefenderTroops(targetRegion, pendingTargetAction, battleMode);
    const defenderPressure = Math.max(1, Math.min(effectiveDefenderTroops, pendingTargetAction.battleWidth));
    const attackerUnits = buildCommittedBattleUnits(
        sourceRegion,
        pendingTargetAction.committedTroops,
        pendingTargetAction.attackPressure || pendingTargetAction.battleWidth,
        pendingTargetAction.movementProfileId,
    );
    const defenderUnits = takeBattleUnits(buildCombatUnits(targetBattleRegion), defenderPressure);
    if (attackerUnits.length === 0 && defenderUnits.length === 0) {
        return null;
    }

    const cityBattle = battleMode === 'city';
    const phases: QidahenBattleRollPhase[] = cityBattle
        ? ['artillery', 'melee']
        : ['artillery', 'cavalry', 'infantry'];
    const eiduPriority = getEiduPriorityPhase(state, attackerUnits, defenderUnits, cityBattle);
    const stages = phases
        .map((phase) => rollBattleStage(random, state, phase, attackerUnits, defenderUnits, cityBattle, eiduPriority))
        .filter((stage) => stage.attackerRolls.length > 0 || stage.defenderRolls.length > 0);
    const attackerDamage = stages.reduce((sum, stage) => sum + stage.attackerDamage, 0);
    const defenderDamage = stages.reduce((sum, stage) => sum + stage.defenderDamage, 0);

    return {
        cityBattle,
        stages,
        attackerDamage,
        defenderDamage,
        summary: buildBattleRollSummary(stages, cityBattle),
    };
};

const computeCombatPower = (
    region: Pick<QidahenCore['regions'][number], 'troops' | 'specialTroops'>,
    maxNonArtilleryTroops: number,
): number => {
    const units = buildCombatUnits(region);
    let remainingNonArtillery = Math.max(0, maxNonArtilleryTroops);
    let power = units
        .filter((unit) => unit.troopKind === 'artillery')
        .reduce((sum, unit) => sum + unit.level * unit.count, 0);

    for (const unit of units
        .filter((item) => item.troopKind !== 'artillery')
        .sort((left, right) => right.level - left.level)) {
        const used = Math.min(unit.count, remainingNonArtillery);
        power += used * unit.level;
        remainingNonArtillery -= used;
        if (remainingNonArtillery <= 0) {
            break;
        }
    }

    return power;
};

const applyCasualtyPriorityToRegion = (
    region: QidahenCore['regions'][number],
    troopLoss: number,
    movementProfileId?: string | null,
    casualtyPriority: QidahenCasualtyPriority = 'highest-level',
): QidahenCore['regions'][number] => {
    const remainingLoss = Math.max(0, troopLoss);
    if (remainingLoss <= 0 || region.specialTroops.length === 0) {
        return region;
    }

    let lossToAssign = remainingLoss;
    const specialTroops = sortByCasualtyPriority(region.specialTroops
        .slice()
        .map(normalizeSpecialTroopStack)
        .filter((stack) => stack.troopKind !== 'artillery')
        .filter((stack) => isTroopKindAllowedForMovementProfile(stack.troopKind, movementProfileId)), casualtyPriority)
        .map((stack) => {
            if (lossToAssign <= 0) {
                return stack;
            }
            const removed = Math.min(stack.count, lossToAssign);
            lossToAssign -= removed;
            return {
                ...stack,
                count: stack.count - removed,
            };
        });

    const nextSpecialTroops = mergeSpecialTroopStacks([
        ...region.specialTroops.filter((stack) => inferTroopKindForStack(stack) === 'artillery'),
        ...region.specialTroops
            .filter((stack) => inferTroopKindForStack(stack) !== 'artillery')
            .filter((stack) => !isTroopKindAllowedForMovementProfile(inferTroopKindForStack(stack), movementProfileId)),
        ...specialTroops,
    ]);
    const filteredForce = pruneUnsupportedRetreatArtillery(nextSpecialTroops, region.troops);

    return {
        ...region,
        troops: filteredForce.troops,
        specialTroops: filteredForce.specialTroops,
    };
};

const applyUpkeepAttritionToRegion = (
    region: QidahenCore['regions'][number],
    troopLoss: number,
    casualtyPriority: QidahenCasualtyPriority = 'lowest-level',
): {
    region: QidahenCore['regions'][number];
    removedDetails: string[];
} => {
    const remainingLoss = Math.max(0, troopLoss);
    if (remainingLoss <= 0 || region.specialTroops.length === 0) {
        return {
            region,
            removedDetails: remainingLoss > 0 ? [`未结构化部队 x${remainingLoss}`] : [],
        };
    }

    const genericTroops = Math.max(0, region.troops - getSpecialTroopCount(region));
    let specialLoss = Math.max(0, remainingLoss - genericTroops);
    const removedDetails: string[] = genericTroops > 0
        ? [`未结构化部队 x${Math.min(genericTroops, remainingLoss)}`]
        : [];
    if (specialLoss <= 0) {
        return {
            region,
            removedDetails,
        };
    }

    const specialTroops = sortByCasualtyPriority(
        region.specialTroops.slice().map(normalizeSpecialTroopStack),
        casualtyPriority,
    ).map((stack) => {
        if (specialLoss <= 0) {
            return stack;
        }
        const removed = Math.min(stack.count, specialLoss);
        specialLoss -= removed;
        if (removed > 0) {
            removedDetails.push(`${stack.label} x${removed}`);
        }
        return {
            ...stack,
            count: stack.count - removed,
        };
    });

    return {
        region: {
            ...region,
            specialTroops: mergeSpecialTroopStacks(specialTroops),
        },
        removedDetails,
    };
};

const applyCommittedTroopRemovalToRegion = (
    region: QidahenCore['regions'][number],
    committedTroops: number,
    movementProfileId?: string | null,
): QidahenCore['regions'][number] => {
    let remainingRemoval = Math.max(0, committedTroops);
    if (remainingRemoval <= 0 || region.specialTroops.length === 0) {
        return region;
    }

    const eligibleStacks = region.specialTroops
        .map(normalizeSpecialTroopStack)
        .filter((stack) => isTroopKindAllowedForMovementProfile(stack.troopKind, movementProfileId))
        .sort((left, right) => right.level - left.level)
        .map((stack) => {
            if (remainingRemoval <= 0) {
                return stack;
            }
            const removed = Math.min(stack.count, remainingRemoval);
            remainingRemoval -= removed;
            return {
                ...stack,
                count: stack.count - removed,
            };
        });

    return {
        ...region,
        specialTroops: mergeSpecialTroopStacks([
            ...region.specialTroops
                .map(normalizeSpecialTroopStack)
                .filter((stack) => !isTroopKindAllowedForMovementProfile(stack.troopKind, movementProfileId)),
            ...eligibleStacks,
        ]),
    };
};

const takeCommittedSpecialTroopStacks = (
    region: Pick<QidahenCore['regions'][number], 'specialTroops'>,
    committedTroops: number,
    movementProfileId?: string | null,
): QidahenSpecialTroopStack[] => {
    let remainingCommitted = Math.max(0, committedTroops);
    const committedStacks: QidahenSpecialTroopStack[] = [];

    for (const stack of region.specialTroops
        .map(normalizeSpecialTroopStack)
        .filter((item) => isTroopKindAllowedForMovementProfile(item.troopKind, movementProfileId))
        .sort((left, right) => right.level - left.level)) {
        if (remainingCommitted <= 0) {
            break;
        }
        const committedCount = Math.min(stack.count, remainingCommitted);
        if (committedCount > 0) {
            committedStacks.push({
                ...stack,
                count: committedCount,
            });
            remainingCommitted -= committedCount;
        }
    }

    return committedStacks;
};

const applyCasualtiesToSpecialStacks = (
    stacks: QidahenSpecialTroopStack[],
    troopLoss: number,
    casualtyPriority: QidahenCasualtyPriority = 'highest-level',
): QidahenSpecialTroopStack[] => {
    let remainingLoss = Math.max(0, troopLoss);
    const nextStacks = sortByCasualtyPriority(stacks
        .map(normalizeSpecialTroopStack)
        .filter((stack) => stack.troopKind !== 'artillery'), casualtyPriority)
        .map((stack) => {
            if (remainingLoss <= 0) {
                return stack;
            }
            const removed = Math.min(stack.count, remainingLoss);
            remainingLoss -= removed;
            return {
                ...stack,
                count: stack.count - removed,
            };
        });

    return mergeSpecialTroopStacks([
        ...stacks.map(normalizeSpecialTroopStack).filter((stack) => stack.troopKind === 'artillery'),
        ...nextStacks,
    ]);
};

const applyRoutDamageToSpecialStacks = (
    stacks: QidahenSpecialTroopStack[],
): {
    damagedTroops: number;
    removedTroops: number;
    specialTroops: QidahenSpecialTroopStack[];
} => {
    let damagedTroops = 0;
    let removedTroops = 0;
    const specialTroops = stacks
        .map(normalizeSpecialTroopStack)
        .map((stack) => {
            if (stack.troopKind === 'artillery') {
                return stack;
            }
            damagedTroops += stack.count;
            if (stack.level <= 1) {
                removedTroops += stack.count;
                return {
                    ...stack,
                    count: 0,
                };
            }
            return {
                ...stack,
                id: `${stack.id}-rout-lv${stack.level - 1}`,
                level: stack.level - 1,
            };
        });

    return {
        damagedTroops,
        removedTroops,
        specialTroops: mergeSpecialTroopStacks(specialTroops),
    };
};

const subtractSpecialTroopStacks = (
    stacks: QidahenSpecialTroopStack[],
    removalStacks: QidahenSpecialTroopStack[],
): QidahenSpecialTroopStack[] => {
    const remainingById = new Map<string, QidahenSpecialTroopStack>();
    for (const stack of stacks.map(normalizeSpecialTroopStack)) {
        const previous = remainingById.get(stack.id);
        if (previous) {
            previous.count += stack.count;
        } else {
            remainingById.set(stack.id, { ...stack });
        }
    }

    for (const removal of removalStacks.map(normalizeSpecialTroopStack)) {
        const previous = remainingById.get(removal.id);
        if (!previous) {
            continue;
        }
        previous.count = Math.max(0, previous.count - removal.count);
    }

    return mergeSpecialTroopStacks(Array.from(remainingById.values()));
};

const cityGarrisonTroopKindPriority = (troopKind: QidahenTroopKind): number => (
    troopKind === 'artillery' ? 0 : troopKind === 'cavalry' ? 1 : 2
);

const takePreferredCityGarrison = (
    region: Pick<QidahenCore['regions'][number], 'troops' | 'specialTroops'>,
    maxTroops: number,
): {
    shelteredTroops: number;
    shelteredSpecialTroops: QidahenSpecialTroopStack[];
    fieldTroops: number;
    fieldSpecialTroops: QidahenSpecialTroopStack[];
} => {
    let remainingShelterSlots = Math.max(0, maxTroops);
    const shelteredSpecialTroops: QidahenSpecialTroopStack[] = [];
    const sortedSpecialTroops = region.specialTroops
        .map(normalizeSpecialTroopStack)
        .slice()
        .sort((left, right) => (
            right.level - left.level
            || cityGarrisonTroopKindPriority(left.troopKind) - cityGarrisonTroopKindPriority(right.troopKind)
            || left.label.localeCompare(right.label, 'zh-CN')
        ));

    for (const stack of sortedSpecialTroops) {
        if (remainingShelterSlots <= 0) {
            break;
        }
        const taken = Math.min(stack.count, remainingShelterSlots);
        if (taken <= 0) {
            continue;
        }
        shelteredSpecialTroops.push({
            ...stack,
            count: taken,
        });
        remainingShelterSlots -= taken;
    }

    const mergedShelteredSpecialTroops = mergeSpecialTroopStacks(shelteredSpecialTroops);
    const shelteredSpecialCount = getSpecialTroopCount({ specialTroops: mergedShelteredSpecialTroops });
    const genericTroops = Math.max(0, region.troops - getSpecialTroopCount(region));
    const shelteredGenericTroops = Math.min(genericTroops, Math.max(0, maxTroops - shelteredSpecialCount));
    const shelteredTroops = Math.min(region.troops, shelteredSpecialCount + shelteredGenericTroops);

    return {
        shelteredTroops,
        shelteredSpecialTroops: mergedShelteredSpecialTroops,
        fieldTroops: Math.max(0, region.troops - shelteredTroops),
        fieldSpecialTroops: subtractSpecialTroopStacks(region.specialTroops, mergedShelteredSpecialTroops),
    };
};

const pruneUnsupportedRetreatArtillery = (
    stacks: QidahenSpecialTroopStack[],
    totalTroops: number,
): { troops: number; specialTroops: QidahenSpecialTroopStack[] } => {
    const normalizedStacks = mergeSpecialTroopStacks(stacks);
    const artilleryCount = normalizedStacks
        .filter((stack) => stack.troopKind === 'artillery')
        .reduce((sum, stack) => sum + stack.count, 0);

    if (artilleryCount <= 0) {
        return {
            troops: Math.max(0, totalTroops),
            specialTroops: normalizedStacks,
        };
    }

    const hasRetreatEscort = Math.max(0, totalTroops - artilleryCount) > 0;
    if (hasRetreatEscort) {
        return {
            troops: Math.max(0, totalTroops),
            specialTroops: normalizedStacks,
        };
    }

    return {
        troops: Math.max(0, totalTroops - artilleryCount),
        specialTroops: normalizedStacks.filter((stack) => stack.troopKind !== 'artillery'),
    };
};

const computeStructuredAttackerRout = (
    sourceRegion: QidahenCore['regions'][number] | null,
    committedTroops: number,
    attackerLosses: number,
    movementProfileId?: string | null,
    attackerCasualtyPriority: QidahenCasualtyPriority = 'highest-level',
): {
    damagedTroops: number;
    troopLoss: number;
    specialTroops: QidahenSpecialTroopStack[];
} | null => {
    if (!sourceRegion || sourceRegion.specialTroops.length === 0) {
        return null;
    }

    const committedSpecialTroops = takeCommittedSpecialTroopStacks(sourceRegion, committedTroops, movementProfileId);
    if (committedSpecialTroops.length === 0) {
        return null;
    }

    const committedSpecialCount = getSpecialTroopCount({ specialTroops: committedSpecialTroops });
    const committedGenericTroops = Math.max(0, committedTroops - committedSpecialCount);
    const afterBattleSpecialTroops = applyCasualtiesToSpecialStacks(
        committedSpecialTroops,
        attackerLosses,
        attackerCasualtyPriority,
    );
    const afterBattleSpecialCount = getSpecialTroopCount({ specialTroops: afterBattleSpecialTroops });
    const removedSpecialByBattle = Math.max(0, committedSpecialCount - afterBattleSpecialCount);
    const genericBattleLoss = Math.min(
        committedGenericTroops,
        Math.max(0, attackerLosses - removedSpecialByBattle),
    );
    const genericRoutLoss = Math.max(0, committedGenericTroops - genericBattleLoss);
    const routDamage = applyRoutDamageToSpecialStacks(afterBattleSpecialTroops);
    const specialTroops = mergeSpecialTroopStacks([
        ...subtractSpecialTroopStacks(sourceRegion.specialTroops, committedSpecialTroops),
        ...routDamage.specialTroops,
    ]);

    return {
        damagedTroops: routDamage.damagedTroops + genericRoutLoss,
        troopLoss: attackerLosses + routDamage.removedTroops + genericRoutLoss,
        specialTroops,
    };
};

const getSurvivingCommittedSpecialTroops = (
    sourceRegion: Pick<QidahenCore['regions'][number], 'specialTroops'> | null,
    committedTroops: number,
    attackerLosses: number,
    movementProfileId?: string | null,
    attackerCasualtyPriority: QidahenCasualtyPriority = 'highest-level',
): QidahenSpecialTroopStack[] => {
    if (!sourceRegion || sourceRegion.specialTroops.length === 0) {
        return [];
    }
    return applyCasualtiesToSpecialStacks(
        takeCommittedSpecialTroopStacks(sourceRegion, committedTroops, movementProfileId),
        attackerLosses,
        attackerCasualtyPriority,
    );
};

const getCommittedArtilleryTroopCount = (
    sourceRegion: Pick<QidahenCore['regions'][number], 'specialTroops'> | null,
    committedTroops: number,
    movementProfileId?: string | null,
): number => (
    sourceRegion
        ? getArtilleryTroopCount({
            specialTroops: takeCommittedSpecialTroopStacks(sourceRegion, committedTroops, movementProfileId),
        })
        : 0
);

const getCommittedCavalryTroopStacks = (
    sourceRegion: Pick<QidahenCore['regions'][number], 'specialTroops'> | null,
    committedTroops: number,
    movementProfileId?: string | null,
): QidahenSpecialTroopStack[] => (
    sourceRegion
        ? takeCommittedSpecialTroopStacks(sourceRegion, committedTroops, movementProfileId)
            .filter((stack) => stack.troopKind === 'cavalry')
        : []
);

const getCavalryPlunderCounterPower = (
    targetRegion: Pick<QidahenCore['regions'][number], 'troops' | 'specialTroops'>,
): number => (
    buildCombatUnits(targetRegion)
        .filter((unit) => unit.troopKind === 'artillery' || unit.troopKind === 'cavalry')
        .reduce((sum, unit) => sum + unit.level * unit.count, 0)
);

const getSurvivingDefenderRetreatSpecialTroops = (
    targetRegion: Pick<QidahenCore['regions'][number], 'specialTroops'>,
    defenderLosses: number,
    retreatLosses: number,
    defenderCasualtyPriority: QidahenCasualtyPriority = 'highest-level',
): QidahenSpecialTroopStack[] => {
    if (targetRegion.specialTroops.length === 0) {
        return [];
    }
    return applyCasualtiesToSpecialStacks(
        targetRegion.specialTroops,
        defenderLosses + retreatLosses,
        defenderCasualtyPriority,
    );
};

const computeStructuredDefenderRout = (
    targetRegion: Pick<QidahenCore['regions'][number], 'specialTroops'>,
    defenderLosses: number,
    remainingTroops: number,
    defenderCasualtyPriority: QidahenCasualtyPriority = 'highest-level',
): {
    damagedTroops: number;
    troopLoss: number;
    survivingTroops: number;
    specialTroops: QidahenSpecialTroopStack[];
} => {
    const afterBattleSpecialTroops = applyCasualtiesToSpecialStacks(
        targetRegion.specialTroops,
        defenderLosses,
        defenderCasualtyPriority,
    );
    const afterBattleSpecialCount = getSpecialTroopCount({ specialTroops: afterBattleSpecialTroops });
    const unstructuredRetreatTroops = Math.max(0, remainingTroops - afterBattleSpecialCount);
    const routDamage = applyRoutDamageToSpecialStacks(afterBattleSpecialTroops);
    const troopLoss = routDamage.removedTroops + unstructuredRetreatTroops;

    return {
        damagedTroops: routDamage.damagedTroops + unstructuredRetreatTroops,
        troopLoss,
        survivingTroops: Math.max(0, remainingTroops - troopLoss),
        specialTroops: routDamage.specialTroops,
    };
};

const addSpecialTroopStacksToRegion = (
    region: QidahenCore['regions'][number],
    stacks: QidahenSpecialTroopStack[],
): QidahenCore['regions'][number] => ({
    ...region,
    specialTroops: mergeSpecialTroopStacks([
        ...region.specialTroops,
        ...stacks,
    ]),
});

const createInitialFortifications = (): QidahenFortificationState[] => (
    QIDAHEN_FORTIFICATION_CONFIGS
        .slice()
        .sort((left, right) => left.autoPayPriority - right.autoPayPriority)
        .map((fortification) => ({
            id: fortification.id,
            label: fortification.label,
            maintenanceCost: fortification.maintenanceCost,
            ruined: false,
            dependencyRegionId: fortification.dependencyRegionId,
            dependencyLabel: fortification.dependencyLabel,
            ruleNote: fortification.ruleNote,
        }))
);

const toFactionLabel = (controller: QidahenFactionId | 'neutral') => (
    controller === 'ming' ? '大明' : controller === 'mongol' ? '蒙古' : controller === 'jin' ? '后金' : '中立'
);

const getRegionControlLabel = (
    region: Pick<QidahenCore['regions'][number], 'controller' | 'diplomacyMarkerFaction' | 'diplomacyMarkerSide'>,
) => {
    if (region.diplomacyMarkerFaction && region.diplomacyMarkerSide === 'friendly') {
        return `${toFactionLabel(region.diplomacyMarkerFaction)}友好`;
    }
    if (region.diplomacyMarkerFaction && region.diplomacyMarkerSide === 'vassal') {
        return `${toFactionLabel(region.diplomacyMarkerFaction)}附庸`;
    }
    return toFactionLabel(region.controller);
};

const isQidahenCityRuntimeRegion = (regionId: string): boolean => (
    resolveQidahenRuleRegionConfig(regionId).tags.includes('city')
);

const resolvePendingBattleMode = (
    pendingTargetAction: QidahenPendingTargetAction,
    targetRegion: QidahenCore['regions'][number],
    options: Pick<ResolvePendingActionCommand['payload'], 'defenderSortieBattle' | 'defenderHoldCity'> = {},
): QidahenBattleMode => {
    if (!isQidahenCityRuntimeRegion(targetRegion.id)) {
        return 'field';
    }
    if (options.defenderSortieBattle || options.defenderHoldCity) {
        return 'field';
    }
    return pendingTargetAction.battleMode ?? 'city';
};

const getBattleRegionSnapshot = (
    region: QidahenCore['regions'][number],
    battleMode: QidahenBattleMode = 'field',
): Pick<QidahenCore['regions'][number], 'controller' | 'troops' | 'population' | 'specialTroops'> => {
    if (battleMode === 'city' && region.cityState) {
        return {
            controller: region.controller,
            troops: region.cityState.troops,
            population: region.cityState.population,
            specialTroops: region.cityState.specialTroops,
        };
    }
    return {
        controller: region.controller,
        troops: region.troops,
        population: region.population,
        specialTroops: region.specialTroops,
    };
};

const getNonSiegedCityActionSourceSnapshot = (
    region: QidahenCore['regions'][number],
): Pick<QidahenCore['regions'][number], 'controller' | 'troops' | 'population' | 'specialTroops'> => {
    if (!region.cityState || region.siegeState || !isQidahenCityRuntimeRegion(region.id)) {
        return {
            controller: region.controller,
            troops: region.troops,
            population: region.population,
            specialTroops: region.specialTroops,
        };
    }

    return {
        controller: region.controller,
        troops: region.troops + region.cityState.troops,
        population: region.population + region.cityState.population,
        specialTroops: mergeSpecialTroopStacks([
            ...region.specialTroops,
            ...region.cityState.specialTroops,
        ]),
    };
};

const getFriendlyReceivingRegionSnapshot = (
    region: QidahenCore['regions'][number],
): Pick<QidahenCore['regions'][number], 'controller' | 'troops' | 'population' | 'specialTroops'> => {
    if (region.siegeState && region.cityState && isQidahenCityRuntimeRegion(region.id)) {
        return {
            controller: region.controller,
            troops: region.cityState.troops,
            population: region.cityState.population,
            specialTroops: region.cityState.specialTroops,
        };
    }
    return getNonSiegedCityActionSourceSnapshot(region);
};

const materializeNonSiegedCityActionSourceRegion = (
    region: QidahenCore['regions'][number],
): QidahenCore['regions'][number] => {
    if (!region.cityState || region.siegeState || !isQidahenCityRuntimeRegion(region.id)) {
        return region;
    }

    const sourceSnapshot = getNonSiegedCityActionSourceSnapshot(region);
    return {
        ...region,
        troops: sourceSnapshot.troops,
        population: sourceSnapshot.population,
        specialTroops: sourceSnapshot.specialTroops,
        cityState: null,
    };
};

const addTroopsToFriendlyBesiegedCityInterior = (
    region: QidahenCore['regions'][number],
    troops: number,
    specialTroops: QidahenSpecialTroopStack[],
    note: string,
): QidahenCore['regions'][number] => {
    if (!region.siegeState || !isQidahenCityRuntimeRegion(region.id)) {
        return addSpecialTroopStacksToRegion({
            ...region,
            troops: region.troops + troops,
            note,
        }, specialTroops);
    }

    return {
        ...region,
        cityState: {
            troops: (region.cityState?.troops ?? 0) + troops,
            population: region.cityState?.population ?? 0,
            specialTroops: mergeSpecialTroopStacks([
                ...(region.cityState?.specialTroops ?? []),
                ...specialTroops,
            ]),
        },
        note,
    };
};

const removeTroopsFromNonSiegedCityStateRegion = (
    region: QidahenCore['regions'][number],
    troopLoss: number,
    note: string,
): QidahenCore['regions'][number] => {
    if (!region.cityState || region.siegeState || !isQidahenCityRuntimeRegion(region.id) || region.troops > 0) {
        return applyCommittedTroopRemovalToRegion({
            ...region,
            troops: Math.max(0, region.troops - troopLoss),
            note,
        }, troopLoss);
    }

    const cityForce = applyCommittedTroopRemovalToRegion({
        ...region.cityState,
        troops: Math.max(0, region.cityState.troops - troopLoss),
        controller: region.controller,
        note,
    }, troopLoss);
    return {
        ...region,
        note,
        cityState: {
            troops: cityForce.troops,
            population: region.cityState.population,
            specialTroops: cityForce.specialTroops,
        },
    };
};

const getCityBesiegePlunderPopulationCap = (
    region: QidahenCore['regions'][number],
): number => {
    if (isQidahenKoreaRuntimeRegionId(region.id)) {
        return 0;
    }
    if (!isQidahenCityRuntimeRegion(region.id)) {
        return region.population;
    }
    if (region.cityState) {
        return Math.max(0, region.population);
    }
    return Math.max(0, region.population - 2);
};

const getCityPopulationState = (
    region: QidahenCore['regions'][number],
    battleMode: QidahenBattleMode = 'field',
): {
    insidePopulation: number;
    outsidePopulation: number;
    totalPopulation: number;
} => {
    if (!isQidahenCityRuntimeRegion(region.id)) {
        return {
            insidePopulation: 0,
            outsidePopulation: region.population,
            totalPopulation: region.population,
        };
    }
    if (battleMode === 'city') {
        if (region.cityState) {
            return {
                insidePopulation: region.cityState.population,
                outsidePopulation: region.population,
                totalPopulation: region.population + region.cityState.population,
            };
        }
        return {
            insidePopulation: region.population,
            outsidePopulation: 0,
            totalPopulation: region.population,
        };
    }
    if (region.cityState) {
        return {
            insidePopulation: region.cityState.population,
            outsidePopulation: region.population,
            totalPopulation: region.population + region.cityState.population,
        };
    }
    const insidePopulation = Math.min(2, region.population);
    return {
        insidePopulation,
        outsidePopulation: Math.max(0, region.population - insidePopulation),
        totalPopulation: region.population,
    };
};

const getPostBattlePlunderPopulationCap = (
    region: QidahenCore['regions'][number],
    battleMode: QidahenBattleMode,
    mode: QidahenPostBattleChoice['mode'],
): number => {
    if (isQidahenKoreaRuntimeRegionId(region.id)) {
        return 0;
    }
    if (!isQidahenCityRuntimeRegion(region.id)) {
        return region.population;
    }
    if (mode === 'besiege') {
        if (battleMode === 'city') {
            return getCityPopulationState(region, battleMode).outsidePopulation;
        }
        return getCityBesiegePlunderPopulationCap(region);
    }
    if (battleMode === 'city') {
        return getCityPopulationState(region, battleMode).totalPopulation;
    }
    return region.population;
};

const createRuntimeRegionSummaries = () => (
    QIDAHEN_RUNTIME_REGION_DEFINITIONS.map((region) => {
        const regionConfig = resolveQidahenRuleRegionConfig(region.id);
        const controller = getQidahenInitialController(region.id);
        const point = region.center ?? region.seed ?? { x: QIDAHEN_MAP_WIDTH / 2, y: QIDAHEN_MAP_HEIGHT / 2 };
        const initialNote = getQidahenInitialNote(region.id);
        return {
            id: region.id,
            name: STATEFUL_REGION_NAME_OVERRIDES[region.id] ?? regionConfig.name ?? region.name,
            isLogicalRegion: false,
            primaryRuntimeRegionId: region.id,
            runtimeRegionIds: [region.id],
            controller,
            diplomacyMarkerFaction: null,
            diplomacyMarkerSide: null,
            x: point.x / QIDAHEN_MAP_WIDTH,
            y: point.y / QIDAHEN_MAP_HEIGHT,
            troops: getQidahenInitialTroops(region.id),
            population: getQidahenInitialPopulation(region.id),
            controlLabel: getRegionControlLabel({
                controller,
                diplomacyMarkerFaction: null,
                diplomacyMarkerSide: null,
            }),
            note: initialNote
                ?? (isQidahenKoreaRuntimeRegionId(region.id)
                    ? `${regionConfig.name} · 朝鲜区域，默认用于朝贡与耗损结算样本。`
                    : `${regionConfig.name} · 邻接 ${region.adjacentRegionIds.length} 区 · 初始移动代价已按边界类型生成，可继续微调。`),
            siegeState: null,
            cityState: null,
            specialTroops: getQidahenInitialSpecialTroops(region.id),
            adjacentRegionIds: [...region.adjacentRegionIds],
            travelCostByRegionId: { ...region.travelCostByRegionId },
            movementCostByRegionId: { ...region.movementCostByRegionId },
            boundaryTypeByRegionId: { ...region.boundaryTypeByRegionId },
        };
    })
);

const appendLogicalRuleRegions = (runtimeRegions: QidahenCore['regions']): QidahenCore['regions'] => {
    const runtimeRegionsById = new Map(runtimeRegions.map((region) => [region.id, region]));
    const logicalRegions = QIDAHEN_RULE_REGION_CONFIGS
        .filter((config) => QIDAHEN_LOGICAL_RULE_REGION_IDS.has(config.id))
        .map((config) => {
            const members = config.runtimeRegionIds
                .map((runtimeRegionId) => runtimeRegionsById.get(runtimeRegionId))
                .filter((region): region is NonNullable<typeof region> => region != null);
            const primary = runtimeRegionsById.get(config.primaryRuntimeRegionId) ?? members[0];
            if (!primary || members.length === 0) {
                return null;
            }

            const adjacentRegionIds = Array.from(new Set(
                members.flatMap((region) => region.adjacentRegionIds),
            )).filter((regionId) => !config.runtimeRegionIds.includes(regionId)).sort();
            const movementCostByRegionId = adjacentRegionIds.reduce<Record<string, number>>((acc, regionId) => {
                const costs = members
                    .map((region) => region.movementCostByRegionId[regionId])
                    .filter((cost): cost is number => typeof cost === 'number' && Number.isFinite(cost));
                if (costs.length > 0) {
                    acc[regionId] = Math.min(...costs);
                }
                return acc;
            }, {});
            const travelCostByRegionId = adjacentRegionIds.reduce<Record<string, number>>((acc, regionId) => {
                const costs = members
                    .map((region) => region.travelCostByRegionId[regionId])
                    .filter((cost): cost is number => typeof cost === 'number' && Number.isFinite(cost));
                if (costs.length > 0) {
                    acc[regionId] = Math.min(...costs);
                }
                return acc;
            }, {});
            const boundaryTypeByRegionId = adjacentRegionIds.reduce<Record<string, string>>((acc, regionId) => {
                const type = members
                    .map((region) => region.boundaryTypeByRegionId[regionId])
                    .find((value): value is string => typeof value === 'string' && value.length > 0);
                if (type) {
                    acc[regionId] = type;
                }
                return acc;
            }, {});
            const x = members.reduce((sum, region) => sum + region.x, 0) / members.length;
            const y = members.reduce((sum, region) => sum + region.y, 0) / members.length;
            return {
                id: config.id,
                name: config.name,
                isLogicalRegion: true,
                primaryRuntimeRegionId: config.primaryRuntimeRegionId,
                runtimeRegionIds: [...config.runtimeRegionIds],
                controller: primary.controller,
                diplomacyMarkerFaction: primary.diplomacyMarkerFaction,
                diplomacyMarkerSide: primary.diplomacyMarkerSide,
                x,
                y,
                troops: members.reduce((sum, region) => sum + region.troops, 0),
                population: members.reduce((sum, region) => sum + region.population, 0),
                controlLabel: getRegionControlLabel(primary),
                note: `${config.name} · 规则兼容区，映射 ${config.runtimeRegionIds.join('、')}。`,
                siegeState: primary.siegeState
                    ? {
                        ...primary.siegeState,
                        attackerSpecialTroops: primary.siegeState.attackerSpecialTroops.map((stack) => ({ ...stack })),
                    }
                    : null,
                cityState: primary.cityState
                    ? {
                        ...primary.cityState,
                        specialTroops: primary.cityState.specialTroops.map((stack) => ({ ...stack })),
                    }
                    : null,
                specialTroops: mergeSpecialTroopStacks(members.flatMap((region) => region.specialTroops)),
                adjacentRegionIds,
                travelCostByRegionId,
                movementCostByRegionId,
                boundaryTypeByRegionId,
            };
        })
        .filter((region): region is NonNullable<typeof region> => region !== null);

    return [...runtimeRegions, ...logicalRegions];
};

const cloneRuntimeRegionsForRuleRefresh = (regions: QidahenCore['regions']) => (
    regions
        .filter((region) => !region.isLogicalRegion)
        .map((region) => {
            const base = QIDAHEN_RUNTIME_REGION_DEFINITIONS.find((item) => item.id === region.id);
            return {
                ...region,
                name: STATEFUL_REGION_NAME_OVERRIDES[region.id] ?? resolveQidahenRuleRegionConfig(region.id).name,
                specialTroops: region.specialTroops.map((stack) => ({ ...stack })),
                siegeState: region.siegeState
                    ? {
                        ...region.siegeState,
                        attackerSpecialTroops: region.siegeState.attackerSpecialTroops.map((stack) => ({ ...stack })),
                    }
                    : null,
                cityState: region.cityState
                    ? {
                        ...region.cityState,
                        specialTroops: region.cityState.specialTroops.map((stack) => ({ ...stack })),
                    }
                    : null,
                diplomacyMarkerFaction: region.diplomacyMarkerFaction,
                diplomacyMarkerSide: region.diplomacyMarkerSide,
                controlLabel: getRegionControlLabel(region),
                adjacentRegionIds: [...(base?.adjacentRegionIds ?? region.adjacentRegionIds)],
                travelCostByRegionId: { ...(base?.travelCostByRegionId ?? region.travelCostByRegionId) },
                movementCostByRegionId: { ...(base?.movementCostByRegionId ?? region.movementCostByRegionId) },
                boundaryTypeByRegionId: { ...(base?.boundaryTypeByRegionId ?? region.boundaryTypeByRegionId) },
            };
        })
);

const setDirectedBoundary = (
    runtimeRegions: QidahenCore['regions'],
    fromId: string,
    toId: string,
    boundaryType: Parameters<typeof getQidahenBoundaryTypeMeta>[0],
) => {
    const meta = getQidahenBoundaryTypeMeta(boundaryType);
    return runtimeRegions.map((region) => {
        if (region.id !== fromId || region.isLogicalRegion || !(toId in region.boundaryTypeByRegionId)) {
            return region;
        }
        return {
            ...region,
            boundaryTypeByRegionId: {
                ...region.boundaryTypeByRegionId,
                [toId]: boundaryType,
            },
            travelCostByRegionId: {
                ...region.travelCostByRegionId,
                [toId]: meta.travelCost,
            },
            movementCostByRegionId: {
                ...region.movementCostByRegionId,
                [toId]: meta.battleWidth,
            },
        };
    });
};

const setBidirectionalBoundary = (
    runtimeRegions: QidahenCore['regions'],
    leftId: string,
    rightId: string,
    boundaryType: Parameters<typeof getQidahenBoundaryTypeMeta>[0],
) => (
    setDirectedBoundary(
        setDirectedBoundary(runtimeRegions, leftId, rightId, boundaryType),
        rightId,
        leftId,
        boundaryType,
    )
);

const refreshRuntimeRegionRules = (
    regions: QidahenCore['regions'],
    fortifications: QidahenFortificationState[],
): QidahenCore['regions'] => {
    let runtimeRegions = cloneRuntimeRegionsForRuleRefresh(regions);
    const fortificationById = new Map(fortifications.map((item) => [item.id, item]));

    if (fortificationById.get('outer-wall')?.ruined) {
        runtimeRegions = setBidirectionalBoundary(runtimeRegions, 'city-region-20', 'city-region-24', 'plain');
    }

    if (fortificationById.get('shanhaiguan')?.ruined) {
        runtimeRegions = setBidirectionalBoundary(runtimeRegions, 'city-region-25', 'city-region-28', 'plain');
    }

    if (fortificationById.get('ningyuan')?.ruined) {
        runtimeRegions = setBidirectionalBoundary(runtimeRegions, 'jinzhou', 'city-region-24', 'plain');
    }

    if (fortificationById.get('jinzhou')?.ruined) {
        for (const adjacentRegionId of ['city-region-14', 'city-region-19', 'city-region-24', 'city-region-25']) {
            runtimeRegions = setBidirectionalBoundary(runtimeRegions, 'jinzhou', adjacentRegionId, 'plain');
        }
    }

    runtimeRegions = runtimeRegions.map((region) => ({
        ...region,
        controlLabel: getRegionControlLabel(region),
    }));

    return appendLogicalRuleRegions(runtimeRegions);
};

const countControlledRuntimeRegions = (regions: QidahenCore['regions'], factionId: QidahenFactionId): number => (
    regions.filter((region) => !region.isLogicalRegion && !isQidahenKoreaRuntimeRegionId(region.id) && region.controller === factionId).length
);

const buildSeasonSummary = (title: string, timestamp: number, lines: string[]): QidahenSeasonSummary => ({
    id: `season-${timestamp}`,
    title,
    lines,
});

const buildPendingActionResolutionSummary = (
    pendingTargetAction: QidahenPendingTargetAction,
    resolution: {
        regions: QidahenCore['regions'];
        logText: string;
        postBattleSelection: QidahenPostBattleSelection | null;
    },
    timestamp: number,
): QidahenSeasonSummary => {
    const targetRegion = resolution.regions.find((region) => (
        !region.isLogicalRegion && region.id === pendingTargetAction.targetRuntimeRegionId
    ));
    const title = pendingTargetAction.actionId === 'marriage-subjugation'
        ? '联姻诱降'
        : pendingTargetAction.actionId === 'drive-tiger'
            ? '驱虎吞狼'
            : pendingTargetAction.actionId === 'wheel-dispatch'
                ? '调度进攻'
                : '突袭作战';
    const lines = [resolution.logText];
    if (targetRegion?.note) {
        lines.push(targetRegion.note);
    }
    if (resolution.postBattleSelection?.summary) {
        lines.push(resolution.postBattleSelection.summary);
    }
    return buildSeasonSummary(title, timestamp, lines);
};

const buildPostBattleDecisionSummary = (
    selection: QidahenPostBattleSelection,
    resolution: {
        regions: QidahenCore['regions'];
        logText: string;
    },
    timestamp: number,
): QidahenSeasonSummary => {
    const targetRegion = resolution.regions.find((region) => (
        !region.isLogicalRegion && region.id === selection.targetRuntimeRegionId
    ));
    const lines = [resolution.logText];
    if (targetRegion?.note) {
        lines.push(targetRegion.note);
    }
    return buildSeasonSummary(selection.title, timestamp, lines);
};

const buildDrawnHandCards = (
    state: QidahenCore,
    factionId: QidahenFactionId,
    drawCards: number,
): QidahenCore['handCards'] => {
    if (drawCards <= 0) {
        return state.handCards;
    }
    const currentMaxIndex = state.handCards.reduce((max, card) => {
        const match = /hand-(\d+)/.exec(card.id);
        const parsed = match ? Number.parseInt(match[1], 10) : Number.NaN;
        return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
    }, 0);
    const factionCardCount = state.handCards.filter((card) => card.faction === factionId).length;
    const previewBase = (state.factions[factionId].discardPileCount ?? 0) + factionCardCount;
    const previewForFaction = factionHandPreviewById[factionId];
    const nextCards = Array.from({ length: drawCards }, (_, index) => ({
        id: `hand-${currentMaxIndex + index + 1}`,
        label: `${state.factions[factionId].name} 手牌 ${factionCardCount + index + 1}`,
        faction: factionId,
        previewRef: previewForFaction((previewBase + index) % QIDAHEN_FACTION_HAND_PREVIEW_COUNT),
        accent: factionId,
        status: 'payable' as const,
    }));
    return [...state.handCards, ...nextCards];
};

const buildInitialHandCards = (
    factions: QidahenCore['factions'],
): QidahenCore['handCards'] => {
    let nextId = 1;
    return factionOrder.flatMap((factionId) => {
        const previewForFaction = factionHandPreviewById[factionId];
        const visibleCardCount = factionId === 'ming'
            ? factions[factionId].handCount + 1
            : factions[factionId].handCount;
        return Array.from({ length: visibleCardCount }, (_, index) => {
            const cardId = `hand-${nextId}`;
            nextId += 1;
            return {
                id: cardId,
                label: `${factions[factionId].name} 手牌 ${index + 1}`,
                faction: factionId,
                previewRef: previewForFaction(index % QIDAHEN_FACTION_HAND_PREVIEW_COUNT),
                accent: factionId,
                status: index < factions[factionId].handCount ? 'payable' as const : 'idle' as const,
            };
        });
    });
};

const getFactionDrawPileCount = (
    state: QidahenCore,
    factionId: QidahenFactionId,
): number => Math.max(0, state.factions[factionId].drawPileCount ?? state.drawPileCount);

const drawFromFactionPile = (
    factions: QidahenCore['factions'],
    sourceFactionId: QidahenFactionId,
    requestedCards: number,
    discardGain = 0,
): { factions: QidahenCore['factions']; drawnCards: number } => {
    const sourceFaction = factions[sourceFactionId];
    const availableCards = Math.max(0, sourceFaction.drawPileCount ?? 0);
    const drawnCards = Math.max(0, Math.min(requestedCards, availableCards));
    if (drawnCards <= 0 && discardGain <= 0) {
        return { factions, drawnCards };
    }
    return {
        drawnCards,
        factions: {
            ...factions,
            [sourceFactionId]: {
                ...sourceFaction,
                drawPileCount: availableCards - drawnCards,
                discardPileCount: Math.max(0, sourceFaction.discardPileCount ?? 0) + Math.max(0, discardGain),
            },
        },
    };
};

const addFactionHandCards = (
    factions: QidahenCore['factions'],
    factionId: QidahenFactionId,
    handGain: number,
): QidahenCore['factions'] => {
    if (handGain <= 0) {
        return factions;
    }
    return {
        ...factions,
        [factionId]: {
            ...factions[factionId],
            handCount: factions[factionId].handCount + handGain,
        },
    };
};

const beginHandLimitDiscardIfNeeded = (
    state: QidahenCore,
    factionId: QidahenFactionId,
    timestamp: number,
): QidahenCore => {
    const faction = state.factions[factionId];
    const handLimit = Math.max(0, faction.handLimit);
    const excessCards = Math.max(0, faction.handCount - handLimit);
    if (excessCards <= 0) {
        return state;
    }

    const candidateCardIds = state.handCards
        .filter((card) => card.faction === factionId && card.status !== 'disabled')
        .map((card) => card.id);
    if (candidateCardIds.length < excessCards) {
        const removedCardIds = new Set(candidateCardIds);
        return {
            ...state,
            factions: {
                ...state.factions,
                [factionId]: {
                    ...faction,
                    handCount: handLimit,
                    discardPileCount: Math.max(0, faction.discardPileCount ?? 0) + excessCards,
                },
            },
            handCards: state.handCards.filter((card) => !removedCardIds.has(card.id)),
            actionLog: [
                {
                    id: `log-hand-limit-${timestamp}`,
                    faction: factionId,
                    text: `${faction.name} 手牌超过上限 ${handLimit}，实体手牌不足以选择，自动弃掉 ${excessCards} 张牌。`,
                },
                ...state.actionLog,
            ].slice(0, 6),
        };
    }

    return updateTurnLabel({
        ...state,
        turnPhase: 'hand-limit-discard',
        handLimitDiscardSelection: {
            factionId,
            factionName: faction.name,
            handLimit,
            handCount: faction.handCount,
            requiredDiscardCount: excessCards,
            candidateCardIds,
            selectedCardIds: [],
        },
        actionLog: [
            {
                id: `log-hand-limit-${timestamp}`,
                faction: factionId,
                text: `${faction.name} 手牌超过上限 ${handLimit}，需要选择弃掉 ${excessCards} 张牌。`,
            },
            ...state.actionLog,
        ].slice(0, 6),
    });
};

const toggleHandLimitDiscardCard = (
    selection: QidahenCore['handLimitDiscardSelection'],
    cardId: string,
): QidahenCore['handLimitDiscardSelection'] => {
    if (!selection || !selection.candidateCardIds.includes(cardId)) {
        return selection;
    }
    const selected = selection.selectedCardIds.includes(cardId)
        ? selection.selectedCardIds.filter((selectedId) => selectedId !== cardId)
        : selection.selectedCardIds.length >= selection.requiredDiscardCount
            ? selection.selectedCardIds
            : [...selection.selectedCardIds, cardId];
    return {
        ...selection,
        selectedCardIds: selected,
    };
};

const toggleGaoDiDispatchCard = (
    selection: QidahenCore['gaoDiDispatchSelection'],
    cardId: string,
): QidahenCore['gaoDiDispatchSelection'] => {
    if (!selection || !selection.candidateCardIds.includes(cardId)) {
        return selection;
    }
    return {
        ...selection,
        selectedCardId: selection.selectedCardId === cardId ? null : cardId,
    };
};

const buildSunYuanhuaTechSelection = (
    state: QidahenCore,
    selectedCardIds: string[] = [],
): QidahenCore['sunYuanhuaTechSelection'] => {
    if (!isSunYuanhuaEnabled(state) || !hasUpgradableArmament(state, 'ming')) {
        return null;
    }
    const candidateCardIds = state.handCards
        .filter((card) => card.faction === 'ming' && card.status !== 'disabled')
        .map((card) => card.id);
    if (candidateCardIds.length < 2) {
        return null;
    }
    return {
        source: 'sun-yuanhua',
        title: '孙元化弃牌科技',
        summary: '袁崇焕在场时，行动前可弃 2 张手牌，按当前低保真规则推进 1 次科技。',
        requiredCardCount: 2,
        candidateCardIds,
        selectedCardIds: selectedCardIds.filter((cardId) => candidateCardIds.includes(cardId)).slice(0, 2),
    };
};

const toggleSunYuanhuaTechCard = (
    selection: QidahenCore['sunYuanhuaTechSelection'],
    cardId: string,
): QidahenCore['sunYuanhuaTechSelection'] => {
    if (!selection || !selection.candidateCardIds.includes(cardId)) {
        return selection;
    }
    const selectedCardIds = selection.selectedCardIds.includes(cardId)
        ? selection.selectedCardIds.filter((selectedId) => selectedId !== cardId)
        : selection.selectedCardIds.length >= selection.requiredCardCount
            ? selection.selectedCardIds
            : [...selection.selectedCardIds, cardId];
    return {
        ...selection,
        selectedCardIds,
    };
};

const resolveHandLimitDiscard = (state: QidahenCore, timestamp: number): QidahenCore => {
    const selection = state.handLimitDiscardSelection;
    if (!selection || selection.selectedCardIds.length < selection.requiredDiscardCount) {
        return state;
    }
    const selectedCardIds = selection.selectedCardIds.slice(0, selection.requiredDiscardCount);
    const removedCardIds = new Set(selectedCardIds);
    const faction = state.factions[selection.factionId];
    return updateTurnLabel({
        ...state,
        turnPhase: 'action-window',
        handLimitDiscardSelection: null,
        factions: {
            ...state.factions,
            [selection.factionId]: {
                ...faction,
                handCount: Math.max(0, faction.handCount - selectedCardIds.length),
                discardPileCount: Math.max(0, faction.discardPileCount ?? 0) + selectedCardIds.length,
            },
        },
        handCards: state.handCards.filter((card) => !removedCardIds.has(card.id)),
        actionLog: [
            {
                id: `log-hand-limit-resolved-${timestamp}`,
                faction: selection.factionId,
                text: `${selection.factionName} 已按手牌上限弃掉 ${selectedCardIds.length} 张牌。`,
            },
            ...state.actionLog,
        ].slice(0, 6),
    });
};

const resolveSunYuanhuaTech = (
    state: QidahenCore,
    selection: NonNullable<QidahenCore['sunYuanhuaTechSelection']>,
    choiceId: 'confirm' | 'skip',
): Pick<QidahenCore, 'factions' | 'handCards' | 'discardPileCount'> & {
    selectedRegionId: string;
    summaryLines: string[];
    logText: string;
} => {
    if (choiceId === 'skip') {
        return {
            factions: state.factions,
            handCards: state.handCards,
            discardPileCount: state.discardPileCount,
            selectedRegionId: state.selectedRegionId,
            summaryLines: ['孙元化本次放弃弃牌打科技。'],
            logText: '孙元化本次放弃弃牌打科技。',
        };
    }

    if (selection.selectedCardIds.length < selection.requiredCardCount) {
        return {
            factions: state.factions,
            handCards: state.handCards,
            discardPileCount: state.discardPileCount,
            selectedRegionId: state.selectedRegionId,
            summaryLines: ['孙元化本次未完成弃牌打科技。'],
            logText: '孙元化本次未完成弃牌打科技。',
        };
    }

    const removedCardIds = new Set(selection.selectedCardIds.slice(0, selection.requiredCardCount));
    const upgradeResult = upgradeLowFidelityArmament(state.factions.ming.armaments);
    if (!upgradeResult.upgradedArmament) {
        return {
            factions: state.factions,
            handCards: state.handCards,
            discardPileCount: state.discardPileCount,
            selectedRegionId: state.selectedRegionId,
            summaryLines: ['大明当前没有可继续提升的科技。'],
            logText: '孙元化本次尝试打科技，但大明当前没有可继续提升的科技。',
        };
    }

    return {
        factions: {
            ...state.factions,
            ming: {
                ...state.factions.ming,
                handCount: Math.max(0, state.factions.ming.handCount - selection.requiredCardCount),
                discardPileCount: Math.max(0, state.factions.ming.discardPileCount ?? 0) + selection.requiredCardCount,
                armaments: upgradeResult.armaments,
            },
        },
        handCards: state.handCards.filter((card) => !removedCardIds.has(card.id)),
        discardPileCount: state.discardPileCount + selection.requiredCardCount,
        selectedRegionId: state.selectedRegionId,
        summaryLines: [
            '大明因孙元化弃 2 张手牌，打出 1 张科技。',
            `${upgradeResult.upgradedArmament.name} 升至 ${upgradeResult.upgradedArmament.level} 级。`,
        ],
        logText: `孙元化弃 2 张手牌，令大明 ${upgradeResult.upgradedArmament.name} 升至 ${upgradeResult.upgradedArmament.level} 级。`,
    };
};

const drawKoreaCardsForFaction = (
    factions: QidahenCore['factions'],
    koreaDeckCount: number,
    factionId: QidahenFactionId,
    requestedCards: number,
): { factions: QidahenCore['factions']; koreaDeckCount: number; drawnCards: number } => {
    const drawnCards = Math.max(0, Math.min(requestedCards, koreaDeckCount));
    return {
        factions: addFactionHandCards(factions, factionId, drawnCards),
        koreaDeckCount: Math.max(0, koreaDeckCount - drawnCards),
        drawnCards,
    };
};

const getEffectiveKoreaTributeCardsForFaction = (
    state: QidahenCore,
    factionId: QidahenFactionId,
    regionId: string,
): number => {
    const baseTributeCards = getQidahenKoreaTributeCards(regionId);
    if (baseTributeCards <= 0) {
        return 0;
    }
    return factionId === 'jin' && hasActiveCharacter(state, 'jin', 'jin-amin')
        ? baseTributeCards + 1
        : baseTributeCards;
};

const applyWheelImmediateEffect = (
    state: QidahenCore,
    factionId: QidahenFactionId,
    wheelPositionId: string,
    timestamp: number,
): QidahenCore => {
    const config = getQidahenWheelImmediateEffectConfig(wheelPositionId);
    if (!config) {
        return state;
    }

    const requiresRegularTroopPlacement = Math.max(0, config.troopDelta) > 0;
    const selectedRegion = state.regions.find((region) => (
        !region.isLogicalRegion
        && region.id === resolveQidahenPrimaryRuntimeRegionId(state.selectedRegionId)
        && (
            requiresRegularTroopPlacement
                ? canPlaceRegularTroopsInRegion(region, factionId)
                : isRegionControlledByFaction(region, factionId)
        )
    ));
    const fallbackRegionId = config.requiresFriendlyRegion
        ? (
            requiresRegularTroopPlacement
                ? getPreferredRegularTroopPlacementRegion(state, factionId)?.id
                : getPreferredSelectedRegionIdForFaction(state, factionId)
        )
        : state.selectedRegionId;
    const targetRegionId = selectedRegion?.id ?? fallbackRegionId;
    const targetRegion = state.regions.find((region) => !region.isLogicalRegion && region.id === targetRegionId);
    const drawCards = Math.max(0, Math.min(config.drawCards, getFactionDrawPileCount(state, factionId)));
    const summaryLines: string[] = [];

    const nextRegions = targetRegion
        ? refreshRuntimeRegionRules(
            state.regions
                .filter((region) => !region.isLogicalRegion)
                .map((region) => {
                    if (region.id !== targetRegion.id) {
                        return { ...region };
                    }
                    const actionTargetRegion = materializeNonSiegedCityActionSourceRegion(region);
                    const troopDelta = Math.max(0, config.troopDelta);
                    const populationDelta = Math.max(0, config.populationDelta);
                    if (populationDelta > 0) {
                        summaryLines.push(`${state.factions[factionId].name} 在 ${actionTargetRegion.name} 执行${config.label}，人口 +${populationDelta}。`);
                    }
                    if (troopDelta > 0) {
                        summaryLines.push(`${state.factions[factionId].name} 在 ${actionTargetRegion.name} 执行${config.label}，部队 +${troopDelta}。`);
                    }
                    const nextRegion = {
                        ...actionTargetRegion,
                        troops: actionTargetRegion.troops + troopDelta,
                        population: actionTargetRegion.population + populationDelta,
                        note: `${actionTargetRegion.name} 执行轮盘${config.label}后${troopDelta > 0 ? `部队 +${troopDelta}` : ''}${troopDelta > 0 && populationDelta > 0 ? '，' : ''}${populationDelta > 0 ? `人口 +${populationDelta}` : ''}。`,
                    };
                    const artilleryTraining = config.id === 'wheel-recruit-train'
                        ? trainArtilleryStacksToLevel(nextRegion, getArmamentLevel(state, factionId, 'artillery-tech'))
                        : { region: nextRegion, trainedCount: 0, targetLevel: 0 };
                    if (artilleryTraining.trainedCount > 0) {
                        summaryLines.push(`${state.factions[factionId].name} 在 ${actionTargetRegion.name} 执行${config.label}，训练 ${artilleryTraining.trainedCount} 个炮兵至等级 ${artilleryTraining.targetLevel}。`);
                    }
                    return troopDelta > 0
                        ? addSpecialTroopStackToRegion(artilleryTraining.region, buildRegularTroopStack(factionId, `wheel-${config.id}`, troopDelta))
                        : artilleryTraining.region;
                }),
            state.fortifications,
        )
        : state.regions;

    if (!targetRegion) {
        summaryLines.push(`${state.factions[factionId].name} 当前没有可结算轮盘${config.label}的己方区域。`);
    }
    if (drawCards > 0) {
        summaryLines.push(`${state.factions[factionId].name} 因轮盘${config.label}获得 ${drawCards} 张手牌。`);
    }
    if (summaryLines.length === 0) {
        summaryLines.push(`${state.factions[factionId].name} 执行轮盘${config.label}，当前无额外可见效果。`);
    }

    const drawnResult = drawFromFactionPile(state.factions, factionId, drawCards);
    const nextFactions = addFactionHandCards(drawnResult.factions, factionId, drawnResult.drawnCards);

    return {
        ...state,
        selectedRegionId: targetRegionId,
        regions: nextRegions,
        drawPileCount: state.drawPileCount - drawnResult.drawnCards,
        handCards: buildDrawnHandCards(state, factionId, drawnResult.drawnCards),
        lastSeasonSummary: buildSeasonSummary(config.summaryTitle, timestamp, summaryLines),
        factions: {
            ...nextFactions,
            [factionId]: {
                ...nextFactions[factionId],
                troops: state.factions[factionId].troops + Math.max(0, config.troopDelta),
            },
        },
        actionLog: [
            {
                id: `log-wheel-effect-${timestamp}`,
                faction: factionId,
                text: summaryLines[0] ?? `${state.factions[factionId].name} 执行轮盘${config.label}。`,
            },
            ...state.actionLog,
        ].slice(0, 6),
    };
};

const getHanseongController = (state: QidahenCore): QidahenFactionId | 'neutral' => (
    getQidahenRuleRegionController(state, 'shou-cheng')
);

const getQidahenRuleRegionController = (
    state: QidahenCore,
    ruleRegionId: string,
): QidahenFactionId | 'neutral' => {
    const runtimeRegionIds = resolveQidahenRuntimeRegionIds(ruleRegionId);
    const primaryRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(ruleRegionId);
    const primaryRuntimeRegion = state.regions.find((region) => !region.isLogicalRegion && region.id === primaryRuntimeRegionId);
    if (primaryRuntimeRegion) {
        return primaryRuntimeRegion.controller;
    }
    const runtimeRegion = state.regions.find((region) => !region.isLogicalRegion && runtimeRegionIds.includes(region.id));
    if (runtimeRegion) {
        return runtimeRegion.controller;
    }
    const logicalRegion = state.regions.find((region) => region.isLogicalRegion && region.id === ruleRegionId);
    return logicalRegion?.controller ?? 'neutral';
};

const syncSpecialRuleState = (state: QidahenCore): QidahenCore => {
    const hanseongInitialController = getQidahenInitialController('shou-cheng');
    const hanseongController = getHanseongController(state);
    const hanseongPrestigeUnlocked = state.hanseongPrestigeUnlocked
        || (hanseongInitialController !== 'neutral' && hanseongController !== hanseongInitialController);
    return hanseongPrestigeUnlocked === state.hanseongPrestigeUnlocked
        ? state
        : {
            ...state,
            hanseongPrestigeUnlocked,
        };
};

const canApplyPrestigeCardBonus = (state: QidahenCore, regionId: string): boolean => {
    const unlockMode = getQidahenPrestigeCardBonusUnlock(regionId);
    if (unlockMode === 'always') {
        return true;
    }
    if (unlockMode === 'after-initial-controller-lost' && isQidahenRuleRegionEquivalent(regionId, 'shou-cheng')) {
        return state.hanseongPrestigeUnlocked;
    }
    return unlockMode == null;
};

export const getQidahenPrestigeBonusByFaction = (state: QidahenCore): Record<QidahenFactionId, number> => {
    const bonusByFaction: Record<QidahenFactionId, number> = { ming: 0, mongol: 0, jin: 0 };
    for (const region of state.regions) {
        if (region.isLogicalRegion || region.controller === 'neutral') {
            continue;
        }
        const bonus = getQidahenPrestigeCardBonus(region.id);
        if (bonus <= 0 || !canApplyPrestigeCardBonus(state, region.id)) {
            continue;
        }
        bonusByFaction[region.controller] += bonus;
    }
    return bonusByFaction;
};

export const getQidahenEffectiveVpByFaction = (state: QidahenCore, factionId: QidahenFactionId): number => {
    const bonusByFaction = getQidahenPrestigeBonusByFaction(state);
    return state.factions[factionId].vp + bonusByFaction[factionId];
};

const findPrestigeWinner = (state: QidahenCore): QidahenVictoryStatus | null => {
    const bonusByFaction = getQidahenPrestigeBonusByFaction(state);
    for (const factionId of factionOrder) {
        const faction = state.factions[factionId];
        const effectiveVp = faction.vp + bonusByFaction[factionId];
        if (effectiveVp >= 3) {
            const bonusDetail = bonusByFaction[factionId] > 0
                ? `（含汉城等区域加成 ${bonusByFaction[factionId]}）`
                : '';
            return {
                winnerFactionId: factionId,
                winnerName: faction.name,
                condition: 'prestige',
                detail: `${faction.name} 已达到 ${effectiveVp} 点威望${bonusDetail}。`,
            };
        }
    }
    return null;
};

const findMilitaryWinner = (state: QidahenCore): QidahenVictoryStatus | null => {
    for (const region of state.regions) {
        if (region.isLogicalRegion || region.controller === 'neutral') {
            continue;
        }
        const capitalOwner = getQidahenCapitalOwner(region.id);
        if (!capitalOwner || region.controller === capitalOwner) {
            continue;
        }
        return {
            winnerFactionId: region.controller,
            winnerName: state.factions[region.controller].name,
            condition: 'military',
            detail: `${state.factions[region.controller].name} 已攻下 ${resolveQidahenRuleRegionConfig(region.id).name}（${state.factions[capitalOwner].name} 首都）。`,
        };
    }
    return null;
};

const findHegemonyWinner = (state: QidahenCore): QidahenVictoryStatus | null => {
    for (const factionId of factionOrder) {
        const controlled = countControlledRuntimeRegions(state.regions, factionId);
        if (controlled >= 16) {
            return {
                winnerFactionId: factionId,
                winnerName: state.factions[factionId].name,
                condition: 'hegemony',
                detail: `${state.factions[factionId].name} 在新年阶段控制 ${controlled} 个非朝鲜区域。`,
            };
        }
    }
    return null;
};

const applyVictoryStatus = (
    state: QidahenCore,
    options: {
        allowHegemony?: boolean;
    } = {},
): QidahenCore => {
    const nextState = syncSpecialRuleState(state);
    if (nextState.victoryStatus) {
        return nextState;
    }
    const victoryStatus = findMilitaryWinner(nextState)
        ?? findPrestigeWinner(nextState)
        ?? (options.allowHegemony ? findHegemonyWinner(nextState) : null);
    return victoryStatus
        ? { ...nextState, victoryStatus }
        : nextState;
};

const resolveQidahenGameOver = (state: QidahenCore): GameOverResult | undefined => {
    const winnerFactionId = state.victoryStatus?.winnerFactionId;
    if (!winnerFactionId) {
        return undefined;
    }
    return {
        winner: state.factions[winnerFactionId].playerId,
    };
};

const resolveMidyear = (
    state: QidahenCore,
    timestamp: number,
): Pick<QidahenCore, 'factions' | 'lastSeasonSummary'> => {
    let nextFactions = { ...state.factions };
    const landTaxGain: Record<QidahenFactionId, number> = { ming: 0, mongol: 0, jin: 0 };

    for (const region of state.regions) {
        if (region.isLogicalRegion || region.controller === 'neutral') {
            continue;
        }
        if (region.siegeState) {
            continue;
        }
        const totalPopulation = region.population + (region.cityState?.population ?? 0);
        const totalTroops = region.troops + (region.cityState?.troops ?? 0);
        if (totalPopulation > totalTroops) {
            landTaxGain[region.controller] += 1;
        }
    }

    for (const factionId of factionOrder) {
        if (landTaxGain[factionId] <= 0) {
            continue;
        }
        nextFactions[factionId] = {
            ...nextFactions[factionId],
            handCount: nextFactions[factionId].handCount + landTaxGain[factionId],
            landTax: nextFactions[factionId].landTax + landTaxGain[factionId],
        };
    }

    const canalDrawResult = drawFromFactionPile(nextFactions, 'ming', 5);
    nextFactions = addFactionHandCards(canalDrawResult.factions, 'ming', canalDrawResult.drawnCards);
    const fanWenchengBonus = getFanWenchengMidyearBonusDraw(state);
    const fanWenchengDrawResult = drawFromFactionPile(nextFactions, 'jin', fanWenchengBonus.bonusDrawCards);
    nextFactions = addFactionHandCards(fanWenchengDrawResult.factions, 'jin', fanWenchengDrawResult.drawnCards);
    const defeatMarkerResolution = resolveMidyearDefeatMarkers(nextFactions);
    nextFactions = defeatMarkerResolution.factions;

    const summaryLines = factionOrder.map((factionId) => {
        const gain = landTaxGain[factionId];
        return gain > 0
            ? `${nextFactions[factionId].name} 因土地税赋获得 ${gain} 张手牌。`
            : `${nextFactions[factionId].name} 本次年中未从土地税赋获得手牌。`;
    });

    summaryLines.push(
        canalDrawResult.drawnCards > 0
            ? `大明因江南漕运获得 ${canalDrawResult.drawnCards} 张手牌。`
            : '大明因普通牌堆不足，本次江南漕运未获得手牌。',
    );
    if (fanWenchengBonus.controlledHanRegionCount > 0) {
        summaryLines.push(
            fanWenchengDrawResult.drawnCards > 0
                ? `后金因范文程控制 ${fanWenchengBonus.controlledHanRegionCount} 个汉人区域，额外抽 ${fanWenchengDrawResult.drawnCards} 张手牌。`
                : `后金虽因范文程控制 ${fanWenchengBonus.controlledHanRegionCount} 个汉人区域可额外抽牌，但后金牌堆不足，本次未获得手牌。`,
        );
    }
    summaryLines.push(...defeatMarkerResolution.summaryLines);
    summaryLines.push(...factionOrder.map((factionId) => (
        `${nextFactions[factionId].name} 当前控制 ${countControlledRuntimeRegions(state.regions, factionId)} 个非朝鲜区域。`
    )));

    return {
        factions: nextFactions,
        lastSeasonSummary: buildSeasonSummary('年中结算', timestamp, summaryLines),
    };
};

const resolveNewYear = (
    state: QidahenCore,
    timestamp: number,
    maintenanceMode: QidahenFortificationMaintenanceMode = 'auto-pay',
    attritionPriority: QidahenCasualtyPriority = 'lowest-level',
): Pick<QidahenCore, 'currentYearIndex' | 'currentYear' | 'currentFactionOrder' | 'yearCards' | 'factions' | 'regions' | 'mapTokens' | 'fortifications' | 'koreaDeckCount' | 'lastSeasonSummary'> => {
    let nextFactions = { ...state.factions };
    let nextFortifications = state.fortifications.map((fortification) => ({ ...fortification }));
    let nextKoreaDeckCount = state.koreaDeckCount;
    const summaryLines: string[] = [];

    const koreaTributeByFaction: Record<QidahenFactionId, number> = { ming: 0, mongol: 0, jin: 0 };
    for (const region of state.regions) {
        if (region.isLogicalRegion || region.controller === 'neutral') {
            continue;
        }
        const tributeCards = getEffectiveKoreaTributeCardsForFaction(state, region.controller, region.id);
        if (tributeCards > 0) {
            koreaTributeByFaction[region.controller] += tributeCards;
        }
    }
    for (const factionId of factionOrder) {
        const tributeGain = koreaTributeByFaction[factionId];
        if (tributeGain > 0) {
            const drawResult = drawKoreaCardsForFaction(nextFactions, nextKoreaDeckCount, factionId, tributeGain);
            nextFactions = drawResult.factions;
            nextKoreaDeckCount = drawResult.koreaDeckCount;
            summaryLines.push(`${nextFactions[factionId].name} 因朝鲜朝贡获得 ${drawResult.drawnCards} 张朝鲜牌。`);
        }
    }

    let mingHandCount = nextFactions.ming.handCount;
    nextFortifications = nextFortifications.map((fortification) => {
        if (maintenanceMode === 'skip-all') {
            summaryLines.push(`大明放弃维护 ${fortification.label}，改为破败。`);
            return { ...fortification, ruined: true };
        }
        const dependencyHeld = fortification.dependencyRegionId == null
            || getQidahenRuleRegionController(state, fortification.dependencyRegionId) === 'ming';
        const canMaintain = dependencyHeld && mingHandCount >= fortification.maintenanceCost;
        if (canMaintain) {
            mingHandCount -= fortification.maintenanceCost;
            summaryLines.push(`大明维护 ${fortification.label}，支付 ${fortification.maintenanceCost} 张手牌。`);
            return { ...fortification, ruined: false };
        }

        if (!dependencyHeld && fortification.dependencyLabel) {
            summaryLines.push(`大明失去 ${fortification.dependencyLabel}，${fortification.label} 本轮无法修缮，改为破败。`);
        } else {
            summaryLines.push(`大明未能维护 ${fortification.label}，改为破败。`);
        }
        return { ...fortification, ruined: true };
    });
    nextFactions.ming = {
        ...nextFactions.ming,
        handCount: mingHandCount,
    };

    const upkeepByFaction: Record<QidahenFactionId, number> = { ming: 0, mongol: 0, jin: 0 };
    const nextRuntimeRegions = state.regions
        .filter((region) => !region.isLogicalRegion)
        .map((region) => ({
            ...region,
            specialTroops: region.specialTroops.map((stack) => ({ ...stack })),
            siegeState: region.siegeState
                ? {
                    ...region.siegeState,
                    attackerSpecialTroops: region.siegeState.attackerSpecialTroops.map((stack) => ({ ...stack })),
                }
                : null,
            cityState: region.cityState
                ? {
                    ...region.cityState,
                    specialTroops: region.cityState.specialTroops.map((stack) => ({ ...stack })),
                }
                : null,
        }));
    const applyCityStateUpkeep = (region: typeof nextRuntimeRegions[number], defaultAttritionReason: string) => {
        const cityDefenderFactionId = region.controller === 'neutral' ? null : region.controller;
        if (!region.cityState || !cityDefenderFactionId) {
            return;
        }
        const isKoreaRegion = isQidahenKoreaRuntimeRegionId(region.id);
        if (
            isKoreaRegion
            && cityDefenderFactionId === 'ming'
            && hasActiveCharacter(state, 'ming', 'ming-mao-wenlong')
        ) {
            return;
        }
        const isMingNonHanRegion = cityDefenderFactionId === 'ming' && NON_HAN_RUNTIME_REGION_IDS.has(region.id);
        const regularTroopCount = isMingNonHanRegion ? getRegularTroopCount(region.cityState, 'ming') : 0;
        const supportPopulation = isKoreaRegion
            ? 0
            : Math.max(0, region.cityState.population - regularTroopCount);
        const citySupportGap = Math.max(0, region.cityState.troops - supportPopulation);
        if (citySupportGap <= 0) {
            return;
        }
        const freeSupport = getQidahenFreeUpkeepSupport(state, cityDefenderFactionId, citySupportGap);
        const faction = nextFactions[cityDefenderFactionId];
        const payableGap = Math.max(0, citySupportGap - freeSupport);
        const paid = Math.min(faction.handCount, payableGap);
        const unresolved = payableGap - paid;
        if (freeSupport > 0) {
            summaryLines.push(`${toFactionLabel(cityDefenderFactionId)} 因王化贞在 ${region.name} 免费支持 ${freeSupport} 部队。`);
        }
        if (paid > 0) {
            upkeepByFaction[cityDefenderFactionId] += paid;
            nextFactions[cityDefenderFactionId] = {
                ...faction,
                handCount: faction.handCount - paid,
            };
        }
        if (unresolved > 0) {
            const attrition = applyUpkeepAttritionToRegion(region.cityState, unresolved, attritionPriority);
            region.cityState = {
                ...region.cityState,
                troops: Math.max(0, region.cityState.troops - unresolved),
                specialTroops: attrition.region.specialTroops,
            };
            const removedText = attrition.removedDetails.length > 0
                ? `（移除：${attrition.removedDetails.join('、')}）`
                : '';
            const priorityText = attritionPriority === 'highest-level' ? '高级先损' : '低级先损';
            const attritionReason = isKoreaRegion
                ? '朝鲜耗损'
                : isMingNonHanRegion && regularTroopCount > 0
                    ? '大漠耗损'
                    : defaultAttritionReason;
            const cityNote = `${region.name} 城内守军因${attritionReason}减员 ${unresolved}（${priorityText}）${removedText}。`;
            region.note = region.note ? `${region.note} ${cityNote}` : cityNote;
            summaryLines.push(`${toFactionLabel(cityDefenderFactionId)} 在 ${region.name} 触发${attritionReason}，城内守军无法补足 ${unresolved} 点补给，减员 ${unresolved}（${priorityText}）${removedText}。`);
        }
    };
    for (const region of nextRuntimeRegions) {
        if (region.siegeState) {
            const siegeFaction = region.siegeState.attackerFactionId;
            const supportGap = Math.max(0, region.siegeState.attackerTroops);
            if (supportGap > 0) {
                const freeSupport = getQidahenFreeUpkeepSupport(state, siegeFaction, supportGap);
                const faction = nextFactions[siegeFaction];
                const payableGap = Math.max(0, supportGap - freeSupport);
                const paid = Math.min(faction.handCount, payableGap);
                const unresolved = payableGap - paid;
                if (freeSupport > 0) {
                    summaryLines.push(`${toFactionLabel(siegeFaction)} 因王化贞在 ${region.name} 免费支持 ${freeSupport} 部队。`);
                }
                if (paid > 0) {
                    upkeepByFaction[siegeFaction] += paid;
                    nextFactions[siegeFaction] = {
                        ...faction,
                        handCount: faction.handCount - paid,
                    };
                }
                if (unresolved > 0) {
                    const attrition = applyUpkeepAttritionToRegion({
                        ...region,
                        troops: region.siegeState.attackerTroops,
                        specialTroops: region.siegeState.attackerSpecialTroops,
                    }, unresolved, attritionPriority);
                    region.siegeState = {
                        ...region.siegeState,
                        attackerTroops: Math.max(0, region.siegeState.attackerTroops - unresolved),
                        attackerSpecialTroops: attrition.region.specialTroops,
                    };
                    const removedText = attrition.removedDetails.length > 0
                        ? `（移除：${attrition.removedDetails.join('、')}）`
                        : '';
                    const priorityText = attritionPriority === 'highest-level' ? '高级先损' : '低级先损';
                    region.note = `${region.name} 仍由${toFactionLabel(region.controller)}控制，但${toFactionLabel(siegeFaction)}围城部队因围城耗损减员 ${unresolved}（${priorityText}）${removedText}。`;
                    summaryLines.push(`${toFactionLabel(siegeFaction)} 在 ${region.name} 触发围城耗损，无法补足 ${unresolved} 点补给，围城部队减员 ${unresolved}（${priorityText}）${removedText}。`);
                }
            }
            applyCityStateUpkeep(region, '守城耗损');
            continue;
        }
        const isKoreaRegion = isQidahenKoreaRuntimeRegionId(region.id);
        const isFriendlyNeutralRegion = region.controller === 'neutral'
            && region.diplomacyMarkerFaction != null
            && region.diplomacyMarkerSide === 'friendly';
        const attritionFactionId = isFriendlyNeutralRegion ? region.diplomacyMarkerFaction : region.controller;
        if (!attritionFactionId || attritionFactionId === 'neutral') {
            continue;
        }
        if (
            isKoreaRegion
            && attritionFactionId === 'ming'
            && hasActiveCharacter(state, 'ming', 'ming-mao-wenlong')
        ) {
            continue;
        }
        const isMingNonHanRegion = attritionFactionId === 'ming' && NON_HAN_RUNTIME_REGION_IDS.has(region.id);
        const regularTroopCount = isMingNonHanRegion ? getRegularTroopCount(region, 'ming') : 0;
        const supportPopulation = isKoreaRegion || isFriendlyNeutralRegion
            ? 0
            : Math.max(0, region.population - regularTroopCount);
        const supportGap = Math.max(0, region.troops - supportPopulation);
        if (supportGap <= 0) {
            applyCityStateUpkeep(region, '守城耗损');
            continue;
        }
        const freeSupport = getQidahenFreeUpkeepSupport(state, attritionFactionId, supportGap);
        const faction = nextFactions[attritionFactionId];
        const payableGap = Math.max(0, supportGap - freeSupport);
        const paid = Math.min(faction.handCount, payableGap);
        const unresolved = payableGap - paid;
        if (freeSupport > 0) {
            summaryLines.push(`${toFactionLabel(attritionFactionId)} 因王化贞在 ${region.name} 免费支持 ${freeSupport} 部队。`);
        }
        if (paid > 0) {
            upkeepByFaction[attritionFactionId] += paid;
            nextFactions[attritionFactionId] = {
                ...faction,
                handCount: faction.handCount - paid,
            };
        }
        if (unresolved > 0) {
            const attrition = applyUpkeepAttritionToRegion(region, unresolved, attritionPriority);
            region.specialTroops = attrition.region.specialTroops;
            region.troops = Math.max(0, region.troops - unresolved);
            const removedText = attrition.removedDetails.length > 0
                ? `（移除：${attrition.removedDetails.join('、')}）`
                : '';
            const priorityText = attritionPriority === 'highest-level' ? '高级先损' : '低级先损';
            const attritionReason = isKoreaRegion
                ? '朝鲜耗损'
                : isFriendlyNeutralRegion
                    ? '中立耗损'
                    : isMingNonHanRegion && regularTroopCount > 0
                        ? '大漠耗损'
                        : '兵力耗损';
            region.note = `${region.name} 因${attritionReason}损失 ${unresolved} 部队（${priorityText}）${removedText}。`;
            summaryLines.push(`${toFactionLabel(attritionFactionId)} 在 ${region.name} 触发${attritionReason}，无法补足 ${unresolved} 点补给，部队减员 ${unresolved}（${priorityText}）${removedText}。`);
        }
        applyCityStateUpkeep(region, '守城耗损');
    }
    for (const factionId of factionOrder) {
        if (upkeepByFaction[factionId] > 0) {
            summaryLines.push(`${nextFactions[factionId].name} 为兵力耗损额外支付 ${upkeepByFaction[factionId]} 张手牌。`);
        }
    }

    const chronologyClaimPriority = getChronologyClaimPriority({
        ...state,
        factions: nextFactions,
        fortifications: nextFortifications,
        regions: nextRuntimeRegions,
    });
    let chronologyWinner: QidahenFactionId | null = null;
    for (const factionId of chronologyClaimPriority) {
        const faction = nextFactions[factionId];
        const claimCost = getYearCardClaimCost(faction.handCount);
        if (claimCost > faction.handCount) {
            summaryLines.push(`${faction.name} 无法支付获得本年纪年卡所需的 ${claimCost} 张手牌，资格顺延。`);
            continue;
        }
        chronologyWinner = factionId;
        nextFactions[factionId] = {
            ...faction,
            handCount: faction.handCount - claimCost,
            vp: faction.vp + 1,
        };
        summaryLines.push(`${faction.name} 以 ${claimCost} 张手牌获得本年纪年卡，威望 +1。`);
        break;
    }
    if (chronologyWinner == null) {
        summaryLines.push('本年纪年卡无人获得。');
    }

    const currentYearIndex = Math.min(state.currentYearIndex + 1, YEAR_SEQUENCE.length - 1);
    const currentFactionOrder = getFactionOrderForYearIndex(currentYearIndex);
    const chronologyCharacters = applyChronologyCharactersForYear(nextFactions, currentYearIndex);
    const refreshedRegions = refreshRuntimeRegionRules(nextRuntimeRegions, nextFortifications);
    const nextMapTokens = syncControlTokensFromRegions(state.mapTokens, refreshedRegions);

    summaryLines.push(...chronologyCharacters.summaryLines);
    summaryLines.push(...factionOrder.map((factionId) => (
        `${chronologyCharacters.factions[factionId].name} 当前控制 ${countControlledRuntimeRegions(refreshedRegions, factionId)} 个非朝鲜区域。`
    )));
    summaryLines.push(`进入 ${getYearLabelByIndex(currentYearIndex)}。`);

    return {
        currentYearIndex,
        currentYear: getYearLabelByIndex(currentYearIndex),
        currentFactionOrder,
        yearCards: buildYearCardSlots(currentYearIndex),
        factions: chronologyCharacters.factions,
        regions: refreshedRegions,
        mapTokens: nextMapTokens,
        fortifications: nextFortifications,
        koreaDeckCount: nextKoreaDeckCount,
        lastSeasonSummary: buildSeasonSummary('新年结算', timestamp, summaryLines),
    };
};

const buildPaymentState = (selectedActionId: string, selectedCardCount = 0): QidahenPaymentState => {
    const action = getActionChoiceById(selectedActionId) ?? actionChoiceCatalog.ming[2];
    const selected = Math.min(selectedCardCount, action.cost);
    return {
        required: action.cost,
        selected,
        prompt: `需弃 ${action.cost} / 已选 ${selected}`,
    };
};

const togglePaymentCard = (state: QidahenCore, cardId: string): string[] => {
    const currentFactionId = getCurrentFactionId(state);
    const card = state.handCards.find((item) => item.id === cardId);
    if (!card || card.faction !== currentFactionId || card.status === 'disabled') {
        return state.selectedPaymentCardIds;
    }

    if (state.selectedPaymentCardIds.includes(cardId)) {
        return state.selectedPaymentCardIds.filter((selectedId) => selectedId !== cardId);
    }

    if (state.selectedPaymentCardIds.length >= state.payment.required) {
        return state.selectedPaymentCardIds;
    }

    return [...state.selectedPaymentCardIds, cardId];
};

const getAutoPaymentCardIds = (state: QidahenCore, actionId: string): string[] => {
    const action = getActionChoiceById(actionId);
    if (!action) return [];
    const currentFactionId = getCurrentFactionId(state);
    return state.handCards
        .filter((card) => card.faction === currentFactionId && card.status !== 'disabled')
        .slice(0, action.cost)
        .map((card) => card.id);
};

const advanceWheelPosition = (currentId: string, steps: number): string => {
    const index = Math.max(0, wheelSectorOrder.indexOf(currentId));
    return wheelSectorOrder[(index + steps) % wheelSectorOrder.length];
};

const buildWheelMoveSummary = (moveId: string): string => {
    const move = wheelMoveChoices.find((choice) => choice.id === moveId) ?? wheelMoveChoices[0];
    return `${move.label}：${move.drawText}`;
};

const buildTurnLabel = (
    roundNumber: number,
    factionName: string,
    turnPhase: QidahenCore['turnPhase'],
    wheelActionUsed: boolean,
    factionActionUsed: boolean,
    bonusFactionActionPending: boolean,
): string => {
    const pendingLabel = turnPhase === 'resolve-pending'
        ? '待结算'
        : turnPhase === 'hand-limit-discard'
            ? '检查手牌上限'
        : turnPhase === 'sun-yuanhua-tech-choice'
            ? '孙元化科技'
        : turnPhase === 'internal-dispatch-choice'
            ? '选择内部调度'
        : turnPhase === 'recruit-choice'
            ? '选择征召军队'
        : turnPhase === 'ma-shi-trade-choice'
            ? '选择马市贸易数量'
        : turnPhase === 'khan-edict-choice'
            ? '选择令箭效果'
        : turnPhase === 'drive-tiger-consent'
            ? '等待驱虎吞狼同意'
        : turnPhase === 'dispatch-targeting'
            ? '选择调度目标'
        : turnPhase === 'season-resolution'
            ? '岁时结算'
        : wheelActionUsed && factionActionUsed && !bonusFactionActionPending
            ? '回合收口'
        : wheelActionUsed
                ? '势力行动'
                : factionActionUsed && !bonusFactionActionPending
                    ? '轮盘行动'
                    : factionActionUsed
                        ? '势力行动'
                        : '行动窗口';
    return `第 ${roundNumber} 轮 · ${factionName} · ${pendingLabel}`;
};

const hasRemainingFactionAction = (state: QidahenCore, factionId = getCurrentFactionId(state)): boolean => {
    if (!state.factionActionUsed) {
        return true;
    }
    return factionId === 'jin'
        && hasActiveCharacter(state, 'jin', 'jin-huangtaiji')
        && state.bonusFactionActionAvailable
        && !state.bonusFactionActionUsed;
};

const isFactionActionTurnComplete = (state: QidahenCore, factionId = getCurrentFactionId(state)): boolean => (
    state.factionActionUsed && !hasRemainingFactionAction(state, factionId)
);

const isFactionActionSelectable = (
    state: QidahenCore,
    factionId: QidahenFactionId,
    actionId: string,
): boolean => (
    getActionChoicesForFaction(factionId).some((choice) => choice.id === actionId)
    && (!state.factionActionUsed || !hasRemainingFactionAction(state, factionId) || state.lastFactionActionId !== actionId)
);

const syncFactionActionWindow = (state: QidahenCore, factionId: QidahenFactionId): QidahenCore => {
    const actionChoices = getActionChoicesForFaction(factionId);
    const fallbackActionId = actionChoices.find((choice) => isFactionActionSelectable(state, factionId, choice.id))?.id
        ?? getDefaultActionIdForFaction(factionId);
    const selectedActionId = isFactionActionSelectable(state, factionId, state.selectedActionId)
        ? state.selectedActionId
        : fallbackActionId;
    return {
        ...state,
        actionChoices,
        selectedActionId,
        payment: buildPaymentState(selectedActionId, state.selectedPaymentCardIds.length),
    };
};

const buildCharacterActionWindowTriggerKey = (state: QidahenCore): string => (
    `${state.currentPlayer}:${state.roundNumber}:${Number(state.wheelActionUsed)}:${Number(state.factionActionUsed)}`
);

const buildCharacterActionWindowProgressKey = (
    triggerKey: string,
    handledEffectIds: Iterable<string>,
): string => `${triggerKey}|${[...handledEffectIds].sort().join(',')}`;

const parseCharacterActionWindowHandledEffectIds = (
    state: QidahenCore,
    triggerKey: string,
): Set<string> => {
    const progressKey = state.lastCharacterActionWindowTriggerKey;
    if (!progressKey?.startsWith(`${triggerKey}|`)) {
        return new Set();
    }
    const suffix = progressKey.slice(triggerKey.length + 1);
    return new Set(suffix.split(',').filter(Boolean));
};

const getLindanHutuktuInfluencePriority = (regionId: string): number => {
    const index = LINDAN_HUTUKTU_INFLUENCE_PRIORITY.indexOf(regionId);
    return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
};

const isEligibleForLindanFriendlyInfluence = (
    region: Pick<QidahenCore['regions'][number], 'id' | 'controller' | 'diplomacyMarkerFaction' | 'diplomacyMarkerSide' | 'troops' | 'specialTroops' | 'population' | 'siegeState' | 'cityState'>,
): boolean => (
    LINDAN_HUTUKTU_INFLUENCE_REGION_IDS.has(region.id)
    && region.controller === 'neutral'
    && region.diplomacyMarkerFaction == null
    && region.diplomacyMarkerSide == null
    && !hasNonMercenaryTroops(getNonSiegedCityActionSourceSnapshot(region as QidahenCore['regions'][number]))
);

const isEligibleForLindanVassalUpgrade = (
    region: Pick<QidahenCore['regions'][number], 'id' | 'diplomacyMarkerFaction' | 'diplomacyMarkerSide' | 'troops' | 'specialTroops' | 'population' | 'siegeState' | 'cityState' | 'controller'>,
): boolean => (
    LINDAN_HUTUKTU_INFLUENCE_REGION_IDS.has(region.id)
    && region.diplomacyMarkerFaction === 'mongol'
    && region.diplomacyMarkerSide === 'friendly'
    && !hasNonMercenaryTroops(getNonSiegedCityActionSourceSnapshot(region as QidahenCore['regions'][number]))
);

const findLindanHutuktuInfluenceTarget = (
    state: QidahenCore,
): {
    regionId: string;
    mode: 'place-friendly' | 'flip-vassal';
} | null => {
    const selectedRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(state.selectedRegionId);
    const selectedRegion = state.regions.find((region) => !region.isLogicalRegion && region.id === selectedRuntimeRegionId);
    if (selectedRegion && isEligibleForLindanFriendlyInfluence(selectedRegion)) {
        return { regionId: selectedRegion.id, mode: 'place-friendly' };
    }
    if (selectedRegion && isEligibleForLindanVassalUpgrade(selectedRegion)) {
        return { regionId: selectedRegion.id, mode: 'flip-vassal' };
    }

    const runtimeRegions = state.regions.filter((region) => !region.isLogicalRegion);
    const friendlyTarget = runtimeRegions
        .filter(isEligibleForLindanFriendlyInfluence)
        .sort((left, right) => (
            getLindanHutuktuInfluencePriority(left.id) - getLindanHutuktuInfluencePriority(right.id)
            || left.name.localeCompare(right.name, 'zh-CN')
        ))
        .at(0);
    if (friendlyTarget) {
        return { regionId: friendlyTarget.id, mode: 'place-friendly' };
    }

    const vassalTarget = runtimeRegions
        .filter(isEligibleForLindanVassalUpgrade)
        .sort((left, right) => (
            getLindanHutuktuInfluencePriority(left.id) - getLindanHutuktuInfluencePriority(right.id)
            || left.name.localeCompare(right.name, 'zh-CN')
        ))
        .at(0);
    return vassalTarget
        ? { regionId: vassalTarget.id, mode: 'flip-vassal' }
        : null;
};

const applyCharacterActionWindowEffectsWithFocus = (
    state: QidahenCore,
): { state: QidahenCore; forcedSelectedRegionId: string | null } => {
    if (state.turnPhase !== 'action-window') {
        return { state, forcedSelectedRegionId: null };
    }
    const triggerKey = buildCharacterActionWindowTriggerKey(state);
    if (state.lastCharacterActionWindowTriggerKey === triggerKey) {
        return { state, forcedSelectedRegionId: null };
    }

    const handledEffectIds = parseCharacterActionWindowHandledEffectIds(state, triggerKey);
    const syncProgress = (nextState: QidahenCore): QidahenCore => ({
        ...nextState,
        lastCharacterActionWindowTriggerKey: buildCharacterActionWindowProgressKey(triggerKey, handledEffectIds),
    });

    let nextState = syncProgress(state);
    let forcedSelectedRegionId: string | null = null;

    const currentFactionId = getCurrentFactionId(nextState);
    if (currentFactionId === 'ming') {
        if (!handledEffectIds.has('ming-conflict')) {
            const mingConflictResolution = resolveMingCharacterConflict(nextState.factions);
            if (mingConflictResolution.removedMaoWenlong) {
                nextState = {
                    ...nextState,
                    factions: mingConflictResolution.factions,
                    actionLog: [
                        {
                            id: `log-mao-wenlong-conflict-${triggerKey}`,
                            faction: 'ming',
                            text: '毛文龙与袁崇焕同场，毛文龙离场。',
                        },
                        ...nextState.actionLog,
                    ].slice(0, 6),
                };
            }
            handledEffectIds.add('ming-conflict');
            nextState = syncProgress(nextState);
        }

        if (!handledEffectIds.has('ming-mao-wenlong')) {
            if (hasActiveCharacter(nextState, 'ming', 'ming-mao-wenlong')) {
                const dongjiangRegion = nextState.regions.find((region) => !region.isLogicalRegion && region.id === DONGJIANG_RUNTIME_REGION_ID);
                if (dongjiangRegion) {
                    const actionDongjiangRegion = materializeNonSiegedCityActionSourceRegion(dongjiangRegion);
                    const trainingResult = trainSpecialTroopsOneStepForFaction(
                        actionDongjiangRegion,
                        'ming',
                        getArmamentLevel(nextState, 'ming', 'artillery-tech'),
                    );
                    if (trainingResult.trainedCount > 0) {
                        const updatedRegions = refreshRuntimeRegionRules(nextState.regions.map((region) => {
                            if (region.isLogicalRegion || region.id !== DONGJIANG_RUNTIME_REGION_ID) {
                                return region;
                            }
                            return {
                                ...trainingResult.region,
                                note: `${region.name} 因毛文龙免费训练东江部队 1 次。`,
                            };
                        }), nextState.fortifications);
                        nextState = {
                            ...nextState,
                            regions: updatedRegions,
                            actionLog: [
                                {
                                    id: `log-mao-wenlong-training-${triggerKey}`,
                                    faction: 'ming',
                                    text: `毛文龙在东江免费训练 ${trainingResult.trainedCount} 个部队：${trainingResult.trainedDetails.join('、')}。`,
                                },
                                ...nextState.actionLog,
                            ].slice(0, 6),
                        };
                        forcedSelectedRegionId = DONGJIANG_RUNTIME_REGION_ID;
                    }
                }
            }
            handledEffectIds.add('ming-mao-wenlong');
            nextState = syncProgress(nextState);
        }

        if (!handledEffectIds.has('ming-xiong-tingbi')) {
            if (hasActiveCharacter(nextState, 'ming', 'ming-xiong-tingbi')) {
                const trainingResolution = resolveXiongTingbiFreeTraining(nextState);
                if (trainingResolution) {
                    nextState = {
                        ...nextState,
                        regions: trainingResolution.regions,
                        actionLog: [
                            {
                                id: `log-xiong-tingbi-training-${triggerKey}`,
                                faction: 'ming',
                                text: trainingResolution.logText,
                            },
                            ...nextState.actionLog,
                        ].slice(0, 6),
                    };
                    forcedSelectedRegionId = trainingResolution.selectedRegionId;
                }
            }
            handledEffectIds.add('ming-xiong-tingbi');
            nextState = syncProgress(nextState);
        }

        if (!handledEffectIds.has('ming-sun-yuanhua')) {
            const sunYuanhuaTechSelection = buildSunYuanhuaTechSelection(
                nextState,
                nextState.sunYuanhuaTechSelection?.selectedCardIds ?? [],
            );
            handledEffectIds.add('ming-sun-yuanhua');
            nextState = syncProgress(nextState);
            if (sunYuanhuaTechSelection) {
                return {
                    state: {
                        ...nextState,
                        turnPhase: 'sun-yuanhua-tech-choice',
                        sunYuanhuaTechSelection,
                        actionLog: [
                            {
                                id: `log-sun-yuanhua-tech-${triggerKey}`,
                                faction: 'ming',
                                text: '孙元化可在行动前弃 2 张手牌，按当前低保真规则打出 1 张科技。',
                            },
                            ...nextState.actionLog,
                        ].slice(0, 6),
                    },
                    forcedSelectedRegionId,
                };
            }
        }

        if (!handledEffectIds.has('ming-gao-di')) {
            const gaoDiDispatchSelection = hasActiveCharacter(nextState, 'ming', 'ming-gao-di')
                ? buildGaoDiDispatchSelection(nextState, nextState.selectedRegionId, nextState.gaoDiDispatchSelection?.selectedCardId ?? null)
                : null;
            handledEffectIds.add('ming-gao-di');
            nextState = syncProgress(nextState);
            if (gaoDiDispatchSelection) {
                return {
                    state: {
                        ...nextState,
                        selectedRegionId: gaoDiDispatchSelection.sourceRegionId,
                        turnPhase: 'gao-di-dispatch-choice',
                        gaoDiDispatchSelection,
                        actionLog: [
                            {
                                id: `log-gao-di-dispatch-${triggerKey}`,
                                faction: 'ming',
                                text: `高第可在行动前弃 1 张手牌，调度 1 格内最多 6 个人口或部队；当前源区 ${gaoDiDispatchSelection.sourceRegionName}。`,
                            },
                            ...nextState.actionLog,
                        ].slice(0, 6),
                    },
                    forcedSelectedRegionId,
                };
            }
        }

        if (!handledEffectIds.has('ming-wang-huazhen')) {
            const internalDispatchSelection = hasActiveCharacter(nextState, 'ming', 'ming-wang-huazhen')
                ? buildWangHuazhenInternalDispatchSelection(nextState, nextState.selectedRegionId)
                : null;
            handledEffectIds.add('ming-wang-huazhen');
            nextState = syncProgress(nextState);
            if (internalDispatchSelection) {
                return {
                    state: {
                        ...nextState,
                        selectedRegionId: internalDispatchSelection.sourceRegionId,
                        turnPhase: 'internal-dispatch-choice',
                        internalDispatchSelection,
                        actionLog: [
                            {
                                id: `log-wang-huazhen-dispatch-${triggerKey}`,
                                faction: 'ming',
                                text: `王化贞可在行动前免费调度 2 个部队；当前源区 ${internalDispatchSelection.sourceRegionName}。`,
                            },
                            ...nextState.actionLog,
                        ].slice(0, 6),
                    },
                    forcedSelectedRegionId,
                };
            }
        }
        return { state: nextState, forcedSelectedRegionId };
    }

    if (currentFactionId === 'jin') {
        if (!handledEffectIds.has('jin-nurhaci-removed-by-yuan')) {
            const nurhaciRemoval = resolveNurhaciRemovedByYuanChonghuan(nextState.factions);
            if (nurhaciRemoval.removedNurhaci) {
                nextState = {
                    ...nextState,
                    factions: nurhaciRemoval.factions,
                    actionLog: [
                        {
                            id: `log-jin-nurhaci-removed-by-yuan-${triggerKey}`,
                            faction: 'jin',
                            text: '袁崇焕在场，努尔哈赤被移出游戏。',
                        },
                        ...nextState.actionLog,
                    ].slice(0, 6),
                };
            }
            handledEffectIds.add('jin-nurhaci-removed-by-yuan');
            nextState = syncProgress(nextState);
        }

        if (!handledEffectIds.has('jin-huangtaiji-conflict')) {
            const jinConflictResolution = resolveJinHuangtaijiConflict(nextState.factions);
            if (jinConflictResolution.removedHuangtaiji) {
                nextState = {
                    ...nextState,
                    factions: jinConflictResolution.factions,
                    actionLog: [
                        {
                            id: `log-jin-huangtaiji-conflict-${triggerKey}`,
                            faction: 'jin',
                            text: '皇太极与其他后金贝勒同场，被拣弃并直接自游戏中移除。',
                        },
                        ...nextState.actionLog,
                    ].slice(0, 6),
                };
            }
            handledEffectIds.add('jin-huangtaiji-conflict');
            nextState = syncProgress(nextState);
        }

        if (!handledEffectIds.has('jin-daisan-conflict')) {
            const daisanConflictResolution = resolveJinDaisanConflict(nextState.factions);
            if (daisanConflictResolution.removedDaisan) {
                nextState = {
                    ...nextState,
                    factions: daisanConflictResolution.factions,
                    actionLog: [
                        {
                            id: `log-jin-daisan-conflict-${triggerKey}`,
                            faction: 'jin',
                            text: '代善与其他后金贝勒同场，被拣弃并回到后金人物牌堆。',
                        },
                        ...nextState.actionLog,
                    ].slice(0, 6),
                };
            }
            handledEffectIds.add('jin-daisan-conflict');
            nextState = syncProgress(nextState);
        }
        return { state: nextState, forcedSelectedRegionId };
    }

    if (currentFactionId !== 'mongol') {
        return { state: nextState, forcedSelectedRegionId };
    }

    if (!handledEffectIds.has('mongol-lindan-hutuktu')) {
        if (hasActiveCharacter(nextState, 'mongol', 'mongol-lindan-hutuktu')) {
            const influenceTarget = findLindanHutuktuInfluenceTarget(nextState);
            if (influenceTarget) {
                const updatedRegions = refreshRuntimeRegionRules(nextState.regions.map((region) => {
                    if (region.isLogicalRegion || region.id !== influenceTarget.regionId) {
                        return region;
                    }
                    if (influenceTarget.mode === 'place-friendly') {
                        return {
                            ...region,
                            diplomacyMarkerFaction: 'mongol',
                            diplomacyMarkerSide: 'friendly',
                            note: `${region.name} 因林丹·乎图克图的大汗天威放置了蒙古友好标记。`,
                        };
                    }
                    return {
                        ...region,
                        controller: 'mongol',
                        diplomacyMarkerFaction: 'mongol',
                        diplomacyMarkerSide: 'vassal',
                        note: `${region.name} 因林丹·乎图克图的大汗天威将蒙古友好标记翻为附庸。`,
                    };
                }), nextState.fortifications);
                const targetRegion = updatedRegions.find((region) => !region.isLogicalRegion && region.id === influenceTarget.regionId);
                nextState = {
                    ...nextState,
                    regions: updatedRegions,
                    mapTokens: syncControlTokensFromRegions(nextState.mapTokens, updatedRegions),
                    actionLog: [
                        {
                            id: `log-lindan-hutuktu-${triggerKey}`,
                            faction: 'mongol',
                            text: influenceTarget.mode === 'place-friendly' && targetRegion
                                ? `林丹·乎图克图在 ${targetRegion.name} 放置了蒙古友好标记。`
                                : targetRegion
                                    ? `林丹·乎图克图将 ${targetRegion.name} 的蒙古友好标记翻为附庸。`
                                    : '林丹·乎图克图发动大汗天威，强化了蒙古区域影响力。',
                        },
                        ...nextState.actionLog,
                    ].slice(0, 6),
                };
                forcedSelectedRegionId = influenceTarget.regionId;
            }
        }
        handledEffectIds.add('mongol-lindan-hutuktu');
        nextState = syncProgress(nextState);
    }

    if (!handledEffectIds.has('mongol-choghtu-taiji')) {
        if (hasActiveCharacter(nextState, 'mongol', 'mongol-choghtu-taiji')) {
            const targetRegion = nextState.regions.find((region) => !region.isLogicalRegion && region.id === 'city-region-2');
            if (targetRegion && canPlaceRegularTroopsInRegion(targetRegion, 'mongol')) {
                const updatedRegions = refreshRuntimeRegionRules(nextState.regions.map((region) => {
                    if (region.isLogicalRegion || region.id !== targetRegion.id) {
                        return region;
                    }
                    const actionTargetRegion = materializeNonSiegedCityActionSourceRegion(region);
                    return addSpecialTroopStackToRegion({
                        ...actionTargetRegion,
                        troops: actionTargetRegion.troops + 2,
                        note: `${actionTargetRegion.name} 因绰克图台吉的漠北援军建立 2 个等级 2 骑兵。`,
                    }, {
                        id: 'mongol-choghtu-taiji-cavalry-lv2',
                        label: '蒙古骑兵',
                        faction: 'mongol',
                        troopKind: 'cavalry',
                        count: 2,
                        level: 2,
                    });
                }), nextState.fortifications);

                nextState = {
                    ...nextState,
                    selectedRegionId: nextState.selectedRegionId === targetRegion.id ? targetRegion.id : nextState.selectedRegionId,
                    factions: {
                        ...nextState.factions,
                        mongol: {
                            ...nextState.factions.mongol,
                            troops: nextState.factions.mongol.troops + 2,
                        },
                    },
                    regions: updatedRegions,
                    actionLog: [
                        {
                            id: `log-choghtu-taiji-${triggerKey}`,
                            faction: 'mongol',
                            text: `绰克图台吉在外喀尔喀部发动漠北援军，免费建立 2 个蒙古骑兵。`,
                        },
                        ...nextState.actionLog,
                    ].slice(0, 6),
                };
            }
        }
        handledEffectIds.add('mongol-choghtu-taiji');
        nextState = syncProgress(nextState);
    }
    return { state: nextState, forcedSelectedRegionId };
};

const applyCharacterActionWindowEffects = (state: QidahenCore): QidahenCore => (
    applyCharacterActionWindowEffectsWithFocus(state).state
);

const updateTurnLabel = (state: QidahenCore): QidahenCore => {
    const nextState = applyCharacterActionWindowEffects(state);
    const currentFactionId = getCurrentFactionId(nextState);
    return {
        ...nextState,
        turnLabel: buildTurnLabel(
            nextState.roundNumber,
            nextState.factions[currentFactionId].name,
            nextState.turnPhase,
            nextState.wheelActionUsed,
            nextState.factionActionUsed,
            !isFactionActionTurnComplete(nextState, currentFactionId) && nextState.factionActionUsed,
        ),
    };
};

const isRegionControlledByFaction = (
    region: Pick<QidahenCore['regions'][number], 'controller'>,
    factionId: QidahenFactionId,
): boolean => region.controller === factionId;

const isRegionUnderSiege = (
    region: Pick<QidahenCore['regions'][number], 'siegeState'>,
): boolean => region.siegeState != null;

const canPlaceRegularTroopsInRegion = (
    region: Pick<QidahenCore['regions'][number], 'controller' | 'diplomacyMarkerFaction' | 'diplomacyMarkerSide' | 'siegeState'>,
    factionId: QidahenFactionId,
): boolean => (
    isRegionControlledByFaction(region, factionId)
    && !isRegionUnderSiege(region)
    && !(region.diplomacyMarkerFaction === factionId && region.diplomacyMarkerSide === 'vassal')
);

const isRegionAvailableForNonDispatchAction = (
    region: Pick<QidahenCore['regions'][number], 'siegeState'>,
): boolean => !isRegionUnderSiege(region);

const getPreferredNonSiegedControlledRuntimeRegion = (
    state: QidahenCore,
    factionId: QidahenFactionId,
): QidahenCore['regions'][number] | null => (
    state.regions
        .filter((region) => (
            !region.isLogicalRegion
            && isRegionControlledByFaction(region, factionId)
            && isRegionAvailableForNonDispatchAction(region)
        ))
        .sort((left, right) => {
            const leftSource = getNonSiegedCityActionSourceSnapshot(left);
            const rightSource = getNonSiegedCityActionSourceSnapshot(right);
            return rightSource.troops - leftSource.troops || rightSource.population - leftSource.population;
        })
        .at(0)
        ?? null
);

const getPreferredControlledRuntimeRegion = (
    state: QidahenCore,
    factionId: QidahenFactionId,
): QidahenCore['regions'][number] | null => (
    state.regions
        .filter((region) => !region.isLogicalRegion && isRegionControlledByFaction(region, factionId))
        .sort((left, right) => {
            const leftSource = getFriendlyReceivingRegionSnapshot(left);
            const rightSource = getFriendlyReceivingRegionSnapshot(right);
            return rightSource.troops - leftSource.troops || rightSource.population - leftSource.population;
        })
        .at(0)
        ?? null
);

const isRegionSiegeAttackerSource = (
    region: Pick<QidahenCore['regions'][number], 'id' | 'siegeState'>,
    factionId: QidahenFactionId,
): boolean => region.siegeState?.attackerFactionId === factionId;

const getRegionSiegeAttackerForceSnapshot = (
    region: QidahenCore['regions'][number],
    factionId: QidahenFactionId,
): Pick<QidahenCore['regions'][number], 'controller' | 'troops' | 'specialTroops'> | null => (
    isRegionSiegeAttackerSource(region, factionId)
        ? {
            controller: factionId,
            troops: region.siegeState?.attackerTroops ?? 0,
            specialTroops: region.siegeState?.attackerSpecialTroops ?? [],
        }
        : null
);

const getPendingActionAttackerPositionRegionId = (
    pendingTargetAction: QidahenPendingTargetAction,
): string | null => pendingTargetAction.attackerPositionRegionId ?? pendingTargetAction.sourceRegionId;

const getPendingActionSourceForceSnapshot = (
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
): Pick<QidahenCore['regions'][number], 'controller' | 'troops' | 'specialTroops'> | null => {
    const positionRegionId = getPendingActionAttackerPositionRegionId(pendingTargetAction);
    if (!positionRegionId) {
        return null;
    }
    const positionRegion = state.regions.find((region) => !region.isLogicalRegion && region.id === positionRegionId) ?? null;
    if (!positionRegion) {
        return null;
    }
    return getRegionSiegeAttackerForceSnapshot(positionRegion, pendingTargetAction.attackerFactionId)
        ?? (() => {
            const sourceSnapshot = getNonSiegedCityActionSourceSnapshot(positionRegion);
            return {
                controller: sourceSnapshot.controller,
                troops: sourceSnapshot.troops,
                specialTroops: sourceSnapshot.specialTroops,
            };
        })();
};

const isFriendlySiegedCityTarget = (
    region: QidahenCore['regions'][number] | null | undefined,
    attackerFactionId: QidahenFactionId,
): region is QidahenCore['regions'][number] => Boolean(
    region
    && isQidahenCityRuntimeRegion(region.id)
    && isRegionFriendlyToFaction(region, attackerFactionId)
    && region.siegeState
    && region.siegeState.attackerFactionId !== attackerFactionId,
);

const isOwnSiegedCityReinforcementTarget = (
    region: QidahenCore['regions'][number] | null | undefined,
    attackerFactionId: QidahenFactionId,
): region is QidahenCore['regions'][number] => Boolean(
    region
    && isQidahenCityRuntimeRegion(region.id)
    && region.siegeState
    && region.siegeState.attackerFactionId === attackerFactionId,
);

const isFriendlyDispatchSupportTarget = (
    region: QidahenCore['regions'][number] | null | undefined,
    factionId: QidahenFactionId,
): region is QidahenCore['regions'][number] => Boolean(
    region
    && (
        (isRegionFriendlyToFaction(region, factionId) && isRegionAvailableForNonDispatchAction(region))
        || isOwnSiegedCityReinforcementTarget(region, factionId)
    ),
);

const getPendingActionDefenderForceSnapshot = (
    targetRegion: QidahenCore['regions'][number],
    pendingTargetAction: QidahenPendingTargetAction,
    battleMode: QidahenBattleMode,
): Pick<QidahenCore['regions'][number], 'controller' | 'troops' | 'specialTroops'> => {
    if (pendingTargetAction.targetKind === 'siege-attacker' && targetRegion.siegeState) {
        return {
            controller: targetRegion.siegeState.attackerFactionId,
            troops: targetRegion.siegeState.attackerTroops,
            specialTroops: targetRegion.siegeState.attackerSpecialTroops,
        };
    }
    return getBattleRegionSnapshot(targetRegion, battleMode);
};

const getEffectivePendingDefenderTroops = (
    targetRegion: QidahenCore['regions'][number],
    pendingTargetAction: QidahenPendingTargetAction,
    battleMode: QidahenBattleMode,
): number => {
    if (pendingTargetAction.targetKind === 'siege-attacker') {
        const defenderForce = getPendingActionDefenderForceSnapshot(targetRegion, pendingTargetAction, battleMode);
        return defenderForce.troops > 0 ? getBattleResolutionTroopCount(defenderForce) : 0;
    }
    return getEffectiveDefenderTroops(targetRegion, battleMode);
};

const getPreferredRegularTroopPlacementRegion = (
    state: QidahenCore,
    factionId: QidahenFactionId,
): QidahenCore['regions'][number] | null => (
    state.regions
        .filter((region) => !region.isLogicalRegion && canPlaceRegularTroopsInRegion(region, factionId))
        .sort((left, right) => {
            const leftSource = getNonSiegedCityActionSourceSnapshot(left);
            const rightSource = getNonSiegedCityActionSourceSnapshot(right);
            return rightSource.troops - leftSource.troops
                || rightSource.population - leftSource.population
                || left.name.localeCompare(right.name, 'zh-CN');
        })
        .at(0)
        ?? null
);

const isRegionFriendlyToFaction = (
    region: Pick<QidahenCore['regions'][number], 'controller' | 'diplomacyMarkerFaction'>,
    factionId: QidahenFactionId,
): boolean => (
    isRegionControlledByFaction(region, factionId)
    || region.diplomacyMarkerFaction === factionId
);

const formatTroopTransferDetails = (
    movedGenericTroops: number,
    movedSpecialTroops: QidahenSpecialTroopStack[],
): string => {
    const parts: string[] = [];
    if (movedGenericTroops > 0) {
        parts.push(`未结构化部队 x${movedGenericTroops}`);
    }
    for (const stack of movedSpecialTroops) {
        parts.push(`${stack.label} x${stack.count}（${stack.level}级）`);
    }
    return parts.join('、');
};

const formatGaoDiDispatchAmountLabel = (
    mode: QidahenGaoDiDispatchMode,
    amount: number,
): string => (
    mode === 'troops'
        ? `${amount} 个部队`
        : `${amount} 个人口`
);

const buildGaoDiDispatchSelection = (
    state: QidahenCore,
    selectedRegionId: string,
    selectedCardId: string | null = null,
): QidahenGaoDiDispatchSelection | null => {
    const runtimeRegions = state.regions.filter((region) => !region.isLogicalRegion);
    const candidateCardIds = state.handCards
        .filter((card) => card.faction === 'ming' && card.status !== 'disabled')
        .map((card) => card.id);
    if (candidateCardIds.length <= 0) {
        return null;
    }

    const buildCandidatesForSource = (sourceRegion: QidahenCore['regions'][number]) => {
        const actionSourceRegion = materializeNonSiegedCityActionSourceRegion(sourceRegion);
        const adjacentTargets = sourceRegion.adjacentRegionIds
            .map((regionId) => runtimeRegions.find((region) => region.id === regionId) ?? null)
            .filter((region): region is NonNullable<typeof region> => isFriendlyDispatchSupportTarget(region, 'ming'));
        const candidates: QidahenGaoDiDispatchSelection['candidates'] = [];

        for (const targetRegion of adjacentTargets) {
            const passage = getQidahenDirectedPassageRule(state, actionSourceRegion.id, targetRegion.id, 'ming');
            if (!passage?.usable) {
                continue;
            }
            const isSiegeReinforcementTarget = isOwnSiegedCityReinforcementTarget(targetRegion, 'ming');

            const maxTroops = Math.max(0, Math.min(6, actionSourceRegion.troops));
            for (let committedTroops = maxTroops; committedTroops >= 1; committedTroops -= 1) {
                const movedSpecialTroops = takeCommittedSpecialTroopStacks(actionSourceRegion, committedTroops);
                const movedSpecialTroopCount = getSpecialTroopCount({ specialTroops: movedSpecialTroops });
                const movedGenericTroops = Math.max(0, committedTroops - movedSpecialTroopCount);
                const detail = formatTroopTransferDetails(movedGenericTroops, movedSpecialTroops);
                candidates.push({
                    id: `gao-di:troops:${sourceRegion.id}:${targetRegion.id}:${committedTroops}`,
                    mode: 'troops',
                    targetRegionId: targetRegion.id,
                    targetRegionName: targetRegion.name,
                    totalTravelCost: passage.travelCost,
                    committedTroops,
                    committedPopulation: 0,
                    movedGenericTroops,
                    movedSpecialTroops,
                    resolutionHint: `${actionSourceRegion.name} → ${targetRegion.name} · ${isSiegeReinforcementTarget ? '增援围城' : '调度'} ${committedTroops} 个部队 · ${detail || '未结构化部队'} · 邻接 1 格`,
                    pathRegionIds: [actionSourceRegion.id, targetRegion.id],
                    pathLabel: `${actionSourceRegion.name} → ${targetRegion.name}`,
                });
            }

            if (isSiegeReinforcementTarget) {
                continue;
            }
            const maxPopulation = Math.max(0, Math.min(6, actionSourceRegion.population));
            for (let committedPopulation = maxPopulation; committedPopulation >= 1; committedPopulation -= 1) {
                candidates.push({
                    id: `gao-di:population:${sourceRegion.id}:${targetRegion.id}:${committedPopulation}`,
                    mode: 'population',
                    targetRegionId: targetRegion.id,
                    targetRegionName: targetRegion.name,
                    totalTravelCost: passage.travelCost,
                    committedTroops: 0,
                    committedPopulation,
                    movedGenericTroops: 0,
                    movedSpecialTroops: [],
                    resolutionHint: `${actionSourceRegion.name} → ${targetRegion.name} · 调度 ${committedPopulation} 个人口 · 邻接 1 格`,
                    pathRegionIds: [actionSourceRegion.id, targetRegion.id],
                    pathLabel: `${actionSourceRegion.name} → ${targetRegion.name}`,
                });
            }
        }

        return candidates.sort((left, right) => (
            left.targetRegionName.localeCompare(right.targetRegionName, 'zh-CN')
            || Number(left.mode === 'troops') - Number(right.mode === 'troops')
            || (right.committedTroops + right.committedPopulation) - (left.committedTroops + left.committedPopulation)
        ));
    };

    const selectedRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(selectedRegionId);
    const candidateSources = runtimeRegions
        .filter((region) => (
            region.controller === 'ming'
            && isRegionAvailableForNonDispatchAction(region)
            && (() => {
                const sourceSnapshot = getNonSiegedCityActionSourceSnapshot(region);
                return sourceSnapshot.troops > 0 || sourceSnapshot.population > 0;
            })()
        ))
        .sort((left, right) => {
            const leftSource = getNonSiegedCityActionSourceSnapshot(left);
            const rightSource = getNonSiegedCityActionSourceSnapshot(right);
            return Number(right.id === selectedRuntimeRegionId) - Number(left.id === selectedRuntimeRegionId)
                || Math.max(rightSource.troops, rightSource.population) - Math.max(leftSource.troops, leftSource.population)
                || rightSource.troops - leftSource.troops
                || rightSource.population - leftSource.population
                || left.name.localeCompare(right.name, 'zh-CN');
        });
    const sourceRegion = candidateSources.find((region) => buildCandidatesForSource(region).length > 0) ?? null;
    if (!sourceRegion) {
        return null;
    }

    const candidates = buildCandidatesForSource(sourceRegion);
    if (candidates.length <= 0) {
        return null;
    }

    return {
        source: 'gao-di',
        title: '高第弃牌调度',
        summary: '行动前弃 1 张手牌，可在友方相邻区域间调度 1 格，数量可在 1-6 之间选择。',
        sourceRegionId: sourceRegion.id,
        sourceRegionName: sourceRegion.name,
        maxTroops: Math.max(0, Math.min(6, getNonSiegedCityActionSourceSnapshot(sourceRegion).troops)),
        maxPopulation: Math.max(0, Math.min(6, getNonSiegedCityActionSourceSnapshot(sourceRegion).population)),
        candidateCardIds,
        selectedCardId: selectedCardId && candidateCardIds.includes(selectedCardId) ? selectedCardId : null,
        candidates,
    };
};

const buildWangHuazhenInternalDispatchSelection = (
    state: QidahenCore,
    selectedRegionId: string,
): QidahenInternalDispatchSelection | null => {
    const runtimeRegions = state.regions.filter((region) => !region.isLogicalRegion);
    const buildCandidatesForSource = (sourceRegion: QidahenCore['regions'][number]) => {
        const actionSourceRegion = materializeNonSiegedCityActionSourceRegion(sourceRegion);
        const maxTroops = Math.max(0, Math.min(2, actionSourceRegion.troops));
        if (maxTroops <= 0) {
            return [];
        }
        return sourceRegion.adjacentRegionIds
            .map((regionId) => runtimeRegions.find((region) => region.id === regionId) ?? null)
            .filter((region): region is NonNullable<typeof region> => isFriendlyDispatchSupportTarget(region, 'ming'))
            .map((targetRegion) => {
                const passage = getQidahenDirectedPassageRule(state, actionSourceRegion.id, targetRegion.id, 'ming');
                if (!passage?.usable) {
                    return null;
                }
                const isSiegeReinforcementTarget = isOwnSiegedCityReinforcementTarget(targetRegion, 'ming');
                const movedSpecialTroops = takeCommittedSpecialTroopStacks(actionSourceRegion, maxTroops);
                const movedSpecialTroopCount = getSpecialTroopCount({ specialTroops: movedSpecialTroops });
                const movedGenericTroops = Math.max(0, maxTroops - movedSpecialTroopCount);
                const detail = formatTroopTransferDetails(movedGenericTroops, movedSpecialTroops);
                return {
                    id: `wang-huazhen:${sourceRegion.id}:${targetRegion.id}`,
                    targetRegionId: targetRegion.id,
                    targetRegionName: targetRegion.name,
                    totalTravelCost: passage.travelCost,
                    committedTroops: maxTroops,
                    movedGenericTroops,
                    movedSpecialTroops,
                    resolutionHint: `${actionSourceRegion.name} → ${targetRegion.name} · ${isSiegeReinforcementTarget ? '增援围城' : '搬运'} ${maxTroops} 部队 · ${detail || '无可搬运部队'} · 耗${passage.travelCost}`,
                    pathRegionIds: [actionSourceRegion.id, targetRegion.id],
                    pathLabel: `${actionSourceRegion.name} → ${targetRegion.name}`,
                };
            })
            .filter((candidate): candidate is NonNullable<typeof candidate> => candidate != null)
            .sort((left, right) => (
                left.totalTravelCost - right.totalTravelCost
                || left.targetRegionName.localeCompare(right.targetRegionName, 'zh-CN')
            ));
    };

    const selectedRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(selectedRegionId);
    const candidateSources = runtimeRegions
        .filter((region) => (
            region.controller === 'ming'
            && isRegionAvailableForNonDispatchAction(region)
            && getNonSiegedCityActionSourceSnapshot(region).troops > 0
        ))
        .sort((left, right) => {
            const leftSource = getNonSiegedCityActionSourceSnapshot(left);
            const rightSource = getNonSiegedCityActionSourceSnapshot(right);
            return Number(right.id === selectedRuntimeRegionId) - Number(left.id === selectedRuntimeRegionId)
                || rightSource.troops - leftSource.troops
                || rightSource.population - leftSource.population
                || left.name.localeCompare(right.name, 'zh-CN');
        });
    const sourceRegion = candidateSources.find((region) => buildCandidatesForSource(region).length > 0) ?? null;
    if (!sourceRegion) {
        return null;
    }
    const candidates = buildCandidatesForSource(sourceRegion);
    if (candidates.length === 0) {
        return null;
    }
    return {
        source: 'wang-huazhen',
        title: '王化贞免费调度',
        summary: '行动前可免费调度 2 个部队。当前实现为友方相邻区域之间的正式内部调度，不走进攻链。',
        sourceRegionId: sourceRegion.id,
        sourceRegionName: sourceRegion.name,
        maxTroops: Math.max(0, Math.min(2, getNonSiegedCityActionSourceSnapshot(sourceRegion).troops)),
        candidates,
    };
};

const resolveXiongTingbiFreeTraining = (
    state: QidahenCore,
): { regions: QidahenCore['regions']; totalTrainedCount: number; selectedRegionId: string; summaryLines: string[]; logText: string } | null => {
    const artilleryMaxLevel = getArmamentLevel(state, 'ming', 'artillery-tech');
    const selectedRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(state.selectedRegionId);
    const runtimeRegions = state.regions.filter((region) => !region.isLogicalRegion);
    const nextRuntimeRegions = runtimeRegions.map((region) => ({
        ...region,
        specialTroops: region.specialTroops.map((stack) => ({ ...stack })),
    }));
    const candidateRegions = nextRuntimeRegions
        .filter((region) => {
            const sourceSnapshot = getNonSiegedCityActionSourceSnapshot(region);
            return region.controller === 'ming'
                || sourceSnapshot.specialTroops.some((stack) => stack.faction === 'ming');
        })
        .sort((left, right) => {
            const leftSource = getNonSiegedCityActionSourceSnapshot(left);
            const rightSource = getNonSiegedCityActionSourceSnapshot(right);
            return Number(right.id === selectedRuntimeRegionId) - Number(left.id === selectedRuntimeRegionId)
                || rightSource.troops - leftSource.troops
                || rightSource.population - leftSource.population
                || left.name.localeCompare(right.name, 'zh-CN');
        });

    let remainingTroops = 4;
    let totalTrainedCount = 0;
    let selectedRegionId: string | null = null;
    const summaryLines: string[] = [];
    for (const candidateRegion of candidateRegions) {
        if (remainingTroops <= 0) {
            break;
        }
        const actionTrainingRegion = materializeNonSiegedCityActionSourceRegion(candidateRegion);
        const trainingResult = trainTroopsOneStepForFactionWithLimit(actionTrainingRegion, 'ming', artilleryMaxLevel, remainingTroops);
        if (trainingResult.trainedCount <= 0) {
            continue;
        }
        const runtimeRegionIndex = nextRuntimeRegions.findIndex((region) => region.id === candidateRegion.id);
        if (runtimeRegionIndex >= 0) {
            nextRuntimeRegions[runtimeRegionIndex] = trainingResult.region;
        }
        remainingTroops -= trainingResult.trainedCount;
        totalTrainedCount += trainingResult.trainedCount;
        selectedRegionId ??= candidateRegion.id;
        summaryLines.push(`${candidateRegion.name}：${trainingResult.trainedDetails.join('、')}`);
    }

    if (totalTrainedCount <= 0) {
        return null;
    }

    return {
        regions: refreshRuntimeRegionRules(nextRuntimeRegions, state.fortifications),
        totalTrainedCount,
        selectedRegionId: selectedRegionId ?? state.selectedRegionId,
        summaryLines,
        logText: `熊廷弼在行动前免费训练 ${totalTrainedCount} 个部队：${summaryLines.join('；')}。`,
    };
};

const resolveGaoDiDispatch = (
    state: QidahenCore,
    selection: QidahenCore['gaoDiDispatchSelection'],
    choiceId: string,
): Pick<QidahenCore, 'regions' | 'mapTokens' | 'factions' | 'handCards' | 'discardPileCount'> & {
    selectedRegionId: string;
    summaryLines: string[];
    logText: string;
} => {
    if (choiceId === 'skip') {
        return {
            regions: state.regions,
            mapTokens: state.mapTokens,
            factions: state.factions,
            handCards: state.handCards,
            discardPileCount: state.discardPileCount,
            selectedRegionId: selection.sourceRegionId,
            summaryLines: ['高第本次放弃行动前调度。'],
            logText: '高第本次放弃行动前调度。',
        };
    }

    const choice = selection.candidates.find((candidate) => candidate.id === choiceId) ?? null;
    const selectedCardId = selection.selectedCardId;
    if (!choice || !selectedCardId) {
        return {
            regions: state.regions,
            mapTokens: state.mapTokens,
            factions: state.factions,
            handCards: state.handCards,
            discardPileCount: state.discardPileCount,
            selectedRegionId: selection.sourceRegionId,
            summaryLines: ['高第本次未完成弃牌调度。'],
            logText: '高第本次未完成弃牌调度。',
        };
    }

    const removedCardIds = new Set([selectedCardId]);
    const runtimeRegions = state.regions.filter((region) => !region.isLogicalRegion);
    const targetRuntimeRegion = runtimeRegions.find((region) => region.id === choice.targetRegionId) ?? null;
    const isSiegeReinforcementTarget = isOwnSiegedCityReinforcementTarget(targetRuntimeRegion, 'ming');
    const nextRuntimeRegions = runtimeRegions.map((region) => {
        if (region.id === selection.sourceRegionId) {
            const actionSourceRegion = materializeNonSiegedCityActionSourceRegion(region);
            if (choice.mode === 'population') {
                return {
                    ...actionSourceRegion,
                    population: Math.max(0, actionSourceRegion.population - choice.committedPopulation),
                    note: `${actionSourceRegion.name} 因高第弃牌调度，向 ${choice.targetRegionName} 调出 ${choice.committedPopulation} 个人口。`,
                };
            }
            return {
                ...applyCommittedTroopRemovalToRegion({
                    ...actionSourceRegion,
                    troops: Math.max(0, actionSourceRegion.troops - choice.committedTroops),
                    note: `${actionSourceRegion.name} 因高第弃牌调度，向 ${choice.targetRegionName} 调出 ${choice.committedTroops} 个部队。`,
                }, choice.committedTroops),
            };
        }
        if (region.id === choice.targetRegionId) {
            if (isSiegeReinforcementTarget && region.siegeState) {
                return {
                    ...region,
                    siegeState: {
                        ...region.siegeState,
                        attackerTroops: region.siegeState.attackerTroops + choice.committedTroops,
                        attackerSpecialTroops: mergeSpecialTroopStacks([
                            ...region.siegeState.attackerSpecialTroops,
                            ...choice.movedSpecialTroops,
                        ]),
                    },
                    note: `${region.name} 因高第弃牌调度，自 ${selection.sourceRegionName} 获得 ${choice.committedTroops} 个围城增援。`,
                };
            }
            const actionTargetRegion = materializeNonSiegedCityActionSourceRegion(region);
            if (choice.mode === 'population') {
                return {
                    ...actionTargetRegion,
                    population: actionTargetRegion.population + choice.committedPopulation,
                    note: `${actionTargetRegion.name} 因高第弃牌调度，自 ${selection.sourceRegionName} 接收 ${choice.committedPopulation} 个人口。`,
                };
            }
            return addSpecialTroopStacksToRegion({
                ...actionTargetRegion,
                troops: actionTargetRegion.troops + choice.committedTroops,
                note: `${actionTargetRegion.name} 因高第弃牌调度，自 ${selection.sourceRegionName} 接收 ${choice.committedTroops} 个部队。`,
            }, choice.movedSpecialTroops);
        }
        return region;
    });
    const nextRegions = refreshRuntimeRegionRules(nextRuntimeRegions, state.fortifications);
    const detail = choice.mode === 'troops'
        ? (formatTroopTransferDetails(choice.movedGenericTroops, choice.movedSpecialTroops) || '未结构化部队')
        : `${choice.committedPopulation} 个人口`;
    const dispatchAmountLabel = formatGaoDiDispatchAmountLabel(choice.mode, choice.committedTroops + choice.committedPopulation);
    const dispatchSummaryLabel = choice.mode === 'troops' && isSiegeReinforcementTarget
        ? ` 增援围城部队 ${dispatchAmountLabel}`
        : ` 调度 ${dispatchAmountLabel}`;
    return {
        selectedRegionId: choice.targetRegionId,
        regions: nextRegions,
        mapTokens: syncControlTokensFromRegions(state.mapTokens, nextRegions),
        factions: {
            ...state.factions,
            ming: {
                ...state.factions.ming,
                handCount: Math.max(0, state.factions.ming.handCount - 1),
                discardPileCount: Math.max(0, state.factions.ming.discardPileCount ?? 0) + 1,
            },
        },
        handCards: state.handCards.filter((card) => !removedCardIds.has(card.id)),
        discardPileCount: state.discardPileCount + 1,
        summaryLines: [
            `大明因高第弃 1 张手牌，自 ${selection.sourceRegionName} 向 ${choice.targetRegionName}${dispatchSummaryLabel}。`,
            choice.mode === 'troops'
                ? `调度细节：${detail}。`
                : `调度细节：${detail}。`,
        ],
        logText: `高第令 ${selection.sourceRegionName} 向 ${choice.targetRegionName}${dispatchSummaryLabel}，并弃 1 张手牌。`,
    };
};

const resolveInternalDispatch = (
    state: QidahenCore,
    selection: QidahenInternalDispatchSelection,
    choiceId: string,
): Pick<QidahenCore, 'regions' | 'mapTokens' | 'factions'> & {
    selectedRegionId: string;
    summaryLines: string[];
    logText: string;
} => {
    const choice = selection.candidates.find((candidate) => candidate.id === choiceId) ?? selection.candidates[0];
    if (!choice) {
        return {
            regions: state.regions,
            mapTokens: state.mapTokens,
            factions: state.factions,
            selectedRegionId: selection.sourceRegionId,
            summaryLines: ['王化贞本次未完成内部调度。'],
            logText: '王化贞本次未完成内部调度。',
        };
    }
    const runtimeRegions = state.regions.filter((region) => !region.isLogicalRegion);
    const targetRuntimeRegion = runtimeRegions.find((region) => region.id === choice.targetRegionId) ?? null;
    const isSiegeReinforcementTarget = isOwnSiegedCityReinforcementTarget(targetRuntimeRegion, 'ming');
    const nextRuntimeRegions = runtimeRegions.map((region) => {
        if (region.id === selection.sourceRegionId) {
            const actionSourceRegion = materializeNonSiegedCityActionSourceRegion(region);
            return {
                ...applyCommittedTroopRemovalToRegion({
                    ...actionSourceRegion,
                    troops: Math.max(0, actionSourceRegion.troops - choice.committedTroops),
                    note: `${actionSourceRegion.name} 因王化贞免费调度，向 ${choice.targetRegionName} 调出 ${choice.committedTroops} 个部队。`,
                }, choice.committedTroops),
            };
        }
        if (region.id === choice.targetRegionId) {
            if (isSiegeReinforcementTarget && region.siegeState) {
                return {
                    ...region,
                    siegeState: {
                        ...region.siegeState,
                        attackerTroops: region.siegeState.attackerTroops + choice.committedTroops,
                        attackerSpecialTroops: mergeSpecialTroopStacks([
                            ...region.siegeState.attackerSpecialTroops,
                            ...choice.movedSpecialTroops,
                        ]),
                    },
                    note: `${region.name} 因王化贞免费调度，自 ${selection.sourceRegionName} 获得 ${choice.committedTroops} 个围城增援。`,
                };
            }
            const actionTargetRegion = materializeNonSiegedCityActionSourceRegion(region);
            return addSpecialTroopStacksToRegion({
                ...actionTargetRegion,
                troops: actionTargetRegion.troops + choice.committedTroops,
                note: `${actionTargetRegion.name} 因王化贞免费调度，自 ${selection.sourceRegionName} 接收 ${choice.committedTroops} 个部队。`,
            }, choice.movedSpecialTroops);
        }
        return region;
    });
    const nextRegions = refreshRuntimeRegionRules(nextRuntimeRegions, state.fortifications);
    const detail = formatTroopTransferDetails(choice.movedGenericTroops, choice.movedSpecialTroops);
    const dispatchSummaryLabel = isSiegeReinforcementTarget
        ? ` 增援围城 ${choice.committedTroops} 个部队`
        : ` 调动 ${choice.committedTroops} 个部队`;
    return {
        selectedRegionId: choice.targetRegionId,
        regions: nextRegions,
        mapTokens: syncControlTokensFromRegions(state.mapTokens, nextRegions),
        factions: state.factions,
        summaryLines: [
            `大明因王化贞免费调度，自 ${selection.sourceRegionName} 向 ${choice.targetRegionName}${dispatchSummaryLabel}。`,
            detail ? `调度细节：${detail}。` : '调度细节：未结构化部队移动。',
        ],
        logText: `王化贞令 ${selection.sourceRegionName} 向 ${choice.targetRegionName}${isSiegeReinforcementTarget ? ` 免费增援围城 ${choice.committedTroops} 个部队` : ` 免费调度 ${choice.committedTroops} 个部队`}。`,
    };
};

const getPreferredSelectedRegionIdForFaction = (state: QidahenCore, factionId: QidahenFactionId): string => {
    const preferred = getPreferredRegularTroopPlacementRegion(state, factionId)
        ?? getPreferredNonSiegedControlledRuntimeRegion(state, factionId)
        ?? getPreferredControlledRuntimeRegion(state, factionId);
    return preferred?.id ?? state.selectedRegionId;
};

const getPreferredActionWindowSelectedRegionIdForFaction = (
    state: QidahenCore,
    factionId: QidahenFactionId,
): string => {
    const preferredSiegeRegion = state.regions
        .filter((region) => (
            !region.isLogicalRegion
            && region.siegeState?.attackerFactionId === factionId
            && region.siegeState.attackerTroops > 0
        ))
        .sort((left, right) => {
            const leftSource = getNonSiegedCityActionSourceSnapshot(left);
            const rightSource = getNonSiegedCityActionSourceSnapshot(right);
            return right.siegeState!.attackerTroops - left.siegeState!.attackerTroops
                || rightSource.troops - leftSource.troops
                || rightSource.population - leftSource.population
                || left.name.localeCompare(right.name, 'zh-CN');
        })
        .at(0);
    if (preferredSiegeRegion) {
        return preferredSiegeRegion.id;
    }
    return getPreferredSelectedRegionIdForFaction(state, factionId);
};

const getPreferredDispatchSelectedRegionIdForFaction = (
    state: QidahenCore,
    factionId: QidahenFactionId,
    movementProfileId: QidahenMovementProfileId,
    selectedRegionId: string,
): string => {
    const runtimeRegions = state.regions.filter((region) => !region.isLogicalRegion);
    const getRegionDispatchSourceSnapshot = (
        region: QidahenCore['regions'][number],
    ): Pick<QidahenCore['regions'][number], 'troops' | 'specialTroops'> | null => {
        const siegeSource = getRegionSiegeAttackerForceSnapshot(region, factionId);
        if (siegeSource) {
            return siegeSource;
        }
        if (region.controller !== factionId || !isRegionAvailableForNonDispatchAction(region)) {
            return null;
        }
        return materializeNonSiegedCityActionSourceRegion(region);
    };
    const getDispatchScore = (region: QidahenCore['regions'][number]): number => {
        const sourceSnapshot = getRegionDispatchSourceSnapshot(region);
        return sourceSnapshot ? getMovableTroopCountForProfile(sourceSnapshot, movementProfileId) : 0;
    };
    const compareDispatchRegion = (
        left: QidahenCore['regions'][number],
        right: QidahenCore['regions'][number],
    ) => {
        const leftScore = getDispatchScore(left);
        const rightScore = getDispatchScore(right);
        const leftSiegeTroops = left.siegeState?.attackerFactionId === factionId ? left.siegeState.attackerTroops : 0;
        const rightSiegeTroops = right.siegeState?.attackerFactionId === factionId ? right.siegeState.attackerTroops : 0;
        const leftSource = getNonSiegedCityActionSourceSnapshot(left);
        const rightSource = getNonSiegedCityActionSourceSnapshot(right);
        return rightScore - leftScore
            || rightSiegeTroops - leftSiegeTroops
            || rightSource.troops - leftSource.troops
            || rightSource.population - leftSource.population
            || left.name.localeCompare(right.name, 'zh-CN');
    };

    const selectedRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(selectedRegionId);
    const selectedRuntimeRegion = runtimeRegions.find((region) => region.id === selectedRuntimeRegionId) ?? null;
    if (selectedRuntimeRegion && getDispatchScore(selectedRuntimeRegion) > 0) {
        return selectedRuntimeRegion.id;
    }

    const preferredSiegeSourceRegion = runtimeRegions
        .filter((region) => region.siegeState?.attackerFactionId === factionId && getDispatchScore(region) > 0)
        .sort(compareDispatchRegion)
        .at(0);
    if (preferredSiegeSourceRegion) {
        return preferredSiegeSourceRegion.id;
    }

    const preferredControlledSourceRegion = runtimeRegions
        .filter((region) => region.controller === factionId && isRegionAvailableForNonDispatchAction(region) && getDispatchScore(region) > 0)
        .sort(compareDispatchRegion)
        .at(0);
    return preferredControlledSourceRegion?.id ?? selectedRegionId;
};

const syncControlTokensFromRegions = (mapTokens: QidahenCore['mapTokens'], regions: QidahenCore['regions']) => (
    [
        ...mapTokens
            .filter((token) => !token.id.startsWith('diplomacy-marker-'))
            .map((token) => {
                const regionId = Object.entries(controlTokenByRegion).find(([, tokenId]) => tokenId === token.id)?.[0];
                const nextRegion = regionId ? regions.find((region) => region.id === regionId) : undefined;
                if (!nextRegion || nextRegion.controller === 'neutral') return token;
                if (token.faction === nextRegion.controller) return token;
                return {
                    ...token,
                    faction: nextRegion.controller,
                    imageSrc: controlMarkerByFaction[nextRegion.controller],
                };
            }),
        ...regions
            .filter((region) => !region.isLogicalRegion && region.diplomacyMarkerFaction != null && region.diplomacyMarkerSide != null)
            .map((region) => ({
                id: `diplomacy-marker-${region.id}`,
                x: region.x,
                y: region.y,
                type: 'control' as const,
                faction: region.diplomacyMarkerFaction ?? 'neutral',
                imageSrc: region.diplomacyMarkerFaction && region.diplomacyMarkerSide
                    ? diplomacyMarkerImageByFaction[region.diplomacyMarkerFaction][region.diplomacyMarkerSide]
                    : undefined,
                size: 27,
            })),
    ]
);

const computeMarriageSubjugationPayCost = (state: QidahenCore, targetRegion: QidahenCore['regions'][number]): number => {
    const shanhaiguanAlive = !state.fortifications.find((fortification) => fortification.id === 'shanhaiguan')?.ruined;
    const exemptTroops = isQidahenRuleRegionEquivalent(targetRegion.id, 'liao-xi') && shanhaiguanAlive ? 2 : 0;
    const targetBattleRegion = getBattleRegionSnapshot(targetRegion, 'city');
    return Math.max(0, (targetBattleRegion.troops - exemptTroops) * 2);
};

const getMarriageSubjugationBlockedReason = (
    state: QidahenCore,
    selectedRegion: QidahenCore['regions'][number] | undefined,
): string | null => {
    if (!selectedRegion) {
        return '当前没有选中可执行联姻诱降的目标区域。';
    }
    const targetRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(selectedRegion.id);
    const targetRuntimeRegion = state.regions.find((region) => !region.isLogicalRegion && region.id === targetRuntimeRegionId);
    if (targetRuntimeRegion && isRegionUnderSiege(targetRuntimeRegion)) {
        return `${targetRuntimeRegion.name} 当前处于围城状态，只允许调度进攻，不能执行联姻诱降。`;
    }
    const targetConfig = resolveQidahenRuleRegionConfig(targetRuntimeRegionId);
    if (targetConfig.tags.includes('capital')) {
        return `${targetConfig.name} 属于首都区域，当前联姻诱降不能指定首都。`;
    }
    if (targetConfig.tags.includes('korea')) {
        return `${targetConfig.name} 位于朝鲜/长城以南区域，当前联姻诱降不能指定该区域。`;
    }
    if (targetConfig.tags.includes('south-of-wall')) {
        return `${targetConfig.name} 位于长城以南区域，当前联姻诱降不能指定该区域。`;
    }
    return null;
};

const getNeutralGarrisonTroops = (
    region: QidahenCore['regions'][number],
    battleMode: QidahenBattleMode = 'field',
): number => {
    const battleRegion = getBattleRegionSnapshot(region, battleMode);
    return battleRegion.controller === 'neutral' && battleRegion.troops <= 0
        ? Math.max(0, Math.min(battleRegion.population, QIDAHEN_NEUTRAL_GARRISON_MAX_TROOPS))
        : 0
};

const getEffectiveDefenderTroops = (
    region: QidahenCore['regions'][number],
    battleMode: QidahenBattleMode = 'field',
): number => {
    const battleRegion = getBattleRegionSnapshot(region, battleMode);
    return battleRegion.troops > 0 ? getBattleResolutionTroopCount(battleRegion) : getNeutralGarrisonTroops(region, battleMode);
};

const compareWheelDispatchCandidate = (
    left: QidahenWheelDispatchCandidate,
    right: QidahenWheelDispatchCandidate,
) => {
    const leftEnemy = left.defenderFactionId !== 'neutral' ? 0 : 1;
    const rightEnemy = right.defenderFactionId !== 'neutral' ? 0 : 1;
    return leftEnemy - rightEnemy
        || left.totalTravelCost - right.totalTravelCost
        || left.pathRegionIds.length - right.pathRegionIds.length
        || right.priorityTroops - left.priorityTroops
        || left.targetRegionName.localeCompare(right.targetRegionName, 'zh-CN');
};

const buildSiegeContinueDispatchSelection = (
    state: QidahenCore,
    attackerFactionId: QidahenFactionId,
    movementProfileId: QidahenMovementProfileId,
    selectedRegionId: string,
): QidahenWheelDispatchSelection | null => {
    const targetRegion = state.regions.find((region) => (
        !region.isLogicalRegion
        && region.id === resolveQidahenPrimaryRuntimeRegionId(selectedRegionId)
    ));
    if (
        !targetRegion
        || !isQidahenCityRuntimeRegion(targetRegion.id)
        || !targetRegion.siegeState
        || targetRegion.siegeState.attackerFactionId !== attackerFactionId
    ) {
        return null;
    }

    const sourceForce = getRegionSiegeAttackerForceSnapshot(targetRegion, attackerFactionId);
    if (!sourceForce) {
        return null;
    }
    const sourceAvailableTroops = getMovableTroopCountForProfile(sourceForce, movementProfileId);
    if (sourceAvailableTroops <= 0) {
        return null;
    }

    const passage = targetRegion.siegeState?.sourceRegionId
        ? getQidahenDirectedPassageRule(state, targetRegion.siegeState.sourceRegionId, targetRegion.id, attackerFactionId)
        : null;
    const boundaryUnitCap = passage?.unitCap ?? null;
    const battleWidth = passage?.battleWidth ?? 3;
    const attackBoundaryType = passage?.boundaryType ?? 'plain';
    const attackPressure = computeQidahenAttackPressure(
        computeEffectiveCommittedTroops(state, {
            attackerFactionId,
            actionId: 'wheel-dispatch',
            availableTroops: sourceAvailableTroops,
            boundaryUnitCap,
        }),
        battleWidth,
    );
    const committedTroops = computeEffectiveCommittedTroops(state, {
        attackerFactionId,
        actionId: 'wheel-dispatch',
        availableTroops: sourceAvailableTroops,
        boundaryUnitCap,
    });
    if (committedTroops <= 0 || attackPressure <= 0) {
        return null;
    }
    const boundaryLabel = passage?.boundaryLabel ?? getQidahenBoundaryTypeMeta(attackBoundaryType).label;

    return {
        attackerFactionId,
        sourceRegionId: targetRegion.siegeState.sourceRegionId,
        sourceRegionName: `${targetRegion.name}围城军`,
        movementProfileId,
        movementProfileLabel: getQidahenMovementProfile(movementProfileId).label,
        restriction: `轮盘进攻/调度 · ${getQidahenMovementProfile(movementProfileId).label}`,
        candidates: [{
            targetRegionId: targetRegion.id,
            targetRegionName: targetRegion.name,
            targetRuntimeRegionId: targetRegion.id,
            attackerPositionRegionId: targetRegion.id,
            defenderFactionId: targetRegion.controller,
            defenderLabel: targetRegion.controlLabel,
            totalTravelCost: 0,
            battleWidth,
            boundaryUnitCap,
            sourceAvailableTroops,
            committedTroops,
            attackPressure,
            attackBoundaryType,
            priorityTroops: targetRegion.siegeState.attackerTroops,
            resolutionHint: `${targetRegion.name} 围城续攻 · ${boundaryLabel} ${battleWidth} · 投${committedTroops}/压${attackPressure}${boundaryUnitCap ? `/限${boundaryUnitCap}` : ''}`,
            pathRegionIds: [targetRegion.id],
            pathLabel: `${targetRegion.name} 围城续攻`,
        }],
    };
};

const buildWheelDispatchSelection = (
    state: QidahenCore,
    attackerFactionId: QidahenFactionId,
    movementProfileId: QidahenMovementProfileId,
    selectedRegionId: string,
    actionId: 'wheel-dispatch' | 'drive-tiger' = 'wheel-dispatch',
): QidahenWheelDispatchSelection | null => {
    const siegeContinueSelection = buildSiegeContinueDispatchSelection(state, attackerFactionId, movementProfileId, selectedRegionId);
    if (siegeContinueSelection) {
        return siegeContinueSelection;
    }
    const sourceRegionBase = state.regions.find((region) => (
        !region.isLogicalRegion
        && region.id === resolveQidahenPrimaryRuntimeRegionId(selectedRegionId)
        && region.controller === attackerFactionId
    ));
    if (!sourceRegionBase) {
        return null;
    }
    const sourceRegion = materializeNonSiegedCityActionSourceRegion(sourceRegionBase);
    if (sourceRegion.troops <= 0) {
        return null;
    }

    const movementProfile = getQidahenMovementProfile(movementProfileId);
    const sourceAvailableTroops = getMovableTroopCountForProfile(sourceRegion, movementProfileId);
    if (sourceAvailableTroops <= 0) {
        return null;
    }
    const attackRule = getQidahenAttackRuleConfig(actionId);
    const reachableTargets = findQidahenReachableRuntimeRegions(state, sourceRegion.id, attackerFactionId, movementProfile.movementBudget)
        .filter((target) => {
            const targetRuntimeRegion = state.regions.find((region) => !region.isLogicalRegion && region.id === target.regionId);
            return targetRuntimeRegion
                ? (!isRegionFriendlyToFaction(targetRuntimeRegion, attackerFactionId) || isFriendlySiegedCityTarget(targetRuntimeRegion, attackerFactionId))
                : false;
        });
    if (reachableTargets.length === 0) {
        return null;
    }
    const candidates = reachableTargets
        .map((target): QidahenWheelDispatchCandidate | null => {
            const previousRegionId = target.pathRegionIds.at(-2) ?? sourceRegion.id;
            const finalPassage = getQidahenDirectedPassageRule(state, previousRegionId, target.regionId, attackerFactionId);
            const finalBoundaryType = finalPassage?.boundaryType ?? target.finalBoundaryType;
            const finalBoundaryLabel = finalPassage?.boundaryLabel ?? getQidahenBoundaryTypeMeta(finalBoundaryType).label;
            const targetRuntimeRegion = state.regions.find((region) => !region.isLogicalRegion && region.id === target.regionId);
            if (!targetRuntimeRegion) {
                return null;
            }
            const battleWidth = finalPassage?.battleWidth ?? sourceRegion.movementCostByRegionId[targetRuntimeRegion.id] ?? 3;
            const boundaryUnitCap = finalPassage?.unitCap ?? null;
            const committedTroops = computeEffectiveCommittedTroops(state, {
                attackerFactionId,
                actionId: attackRule.id,
                availableTroops: sourceAvailableTroops,
                boundaryUnitCap,
            });
            const attackPressure = computeQidahenAttackPressure(committedTroops, battleWidth);
            if (committedTroops <= 0 || attackPressure <= 0) {
                return null;
            }
            const pathLabel = target.pathRegionIds
                .map((regionId) => state.regions.find((region) => region.id === regionId)?.name ?? regionId)
                .join(' → ');
            const targetKind = isOwnSiegedCityReinforcementTarget(targetRuntimeRegion, attackerFactionId)
                ? 'siege-reinforce' as const
                : isFriendlySiegedCityTarget(targetRuntimeRegion, attackerFactionId)
                    ? 'siege-attacker' as const
                    : 'region' as const;
            const defenderFactionId = targetKind === 'siege-reinforce'
                ? attackerFactionId
                : targetKind === 'siege-attacker'
                    ? targetRuntimeRegion.siegeState!.attackerFactionId
                    : targetRuntimeRegion.controller;
            const priorityTroops = targetKind === 'siege-reinforce'
                ? targetRuntimeRegion.siegeState?.attackerTroops ?? 0
                : targetKind === 'siege-attacker'
                    ? targetRuntimeRegion.siegeState?.attackerTroops ?? 0
                    : getEffectiveDefenderTroops(targetRuntimeRegion, isQidahenCityRuntimeRegion(targetRuntimeRegion.id) ? 'city' : 'field');
            const battleMode = targetKind === 'siege-attacker' || targetKind === 'siege-reinforce'
                ? 'field' as const
                : isQidahenCityRuntimeRegion(targetRuntimeRegion.id) ? 'city' as const : 'field' as const;
            return {
                battleMode,
                targetKind,
                targetRegionId: targetRuntimeRegion.id,
                targetRegionName: targetRuntimeRegion.name,
                targetRuntimeRegionId: targetRuntimeRegion.id,
                defenderFactionId,
                defenderLabel: targetKind === 'siege-reinforce'
                    ? `${toFactionLabel(attackerFactionId)}围城军`
                    : isFriendlySiegedCityTarget(targetRuntimeRegion, attackerFactionId)
                    ? `${toFactionLabel(targetRuntimeRegion.siegeState!.attackerFactionId)}围城军`
                    : targetRuntimeRegion.controlLabel,
                totalTravelCost: target.totalTravelCost,
                battleWidth,
                boundaryUnitCap,
                sourceAvailableTroops,
                committedTroops,
                attackPressure,
                attackBoundaryType: finalBoundaryType,
                priorityTroops,
                resolutionHint: `${pathLabel} · 耗${target.totalTravelCost} · ${finalBoundaryLabel} ${battleWidth} · 投${committedTroops}/压${attackPressure}${boundaryUnitCap ? `/限${boundaryUnitCap}` : ''}${targetKind === 'siege-reinforce' ? ' · 增援围城' : isFriendlySiegedCityTarget(targetRuntimeRegion, attackerFactionId) ? ' · 解围' : ''}`,
                pathRegionIds: [...target.pathRegionIds],
                pathLabel,
            };
        })
        .filter((candidate): candidate is QidahenWheelDispatchCandidate => candidate !== null)
        .sort(compareWheelDispatchCandidate);
    if (candidates.length === 0) {
        return null;
    }

    return {
        attackerFactionId,
        sourceRegionId: sourceRegion.id,
        sourceRegionName: sourceRegion.name,
        movementProfileId,
        movementProfileLabel: movementProfile.label,
        restriction: `轮盘进攻/调度 · ${movementProfile.label}`,
        candidates,
    };
};

const buildWheelDispatchSelectionFromWheel = (
    state: QidahenCore,
    attackerFactionId: QidahenFactionId,
    wheelPositionId: string,
    selectedRegionId: string,
): QidahenWheelDispatchSelection | null => {
    const movementProfileId = wheelDispatchProfileIdByPosition[wheelPositionId];
    if (!movementProfileId) {
        return null;
    }
    return buildWheelDispatchSelection(
        state,
        attackerFactionId,
        movementProfileId,
        getPreferredDispatchSelectedRegionIdForFaction(state, attackerFactionId, movementProfileId, selectedRegionId),
        'wheel-dispatch',
    );
};

const buildMaShiTradeSelection = (
    state: QidahenCore,
    selectedRegionId: string,
): QidahenMaShiTradeSelection | null => {
    const selectedRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(selectedRegionId);
    const selectedRuntimeRegion = state.regions.find((region) => (
        !region.isLogicalRegion
        && region.id === selectedRuntimeRegionId
        && canPlaceRegularTroopsInRegion(region, 'ming')
    ));
    const targetRegion = selectedRuntimeRegion ?? getPreferredRegularTroopPlacementRegion(state, 'ming');
    if (!targetRegion) {
        return null;
    }

    const choices: QidahenMaShiTradeSelection['choices'] = ([1, 2, 3] as const).map((troopCount) => ({
        troopCount,
        label: `建立 ${troopCount} 个部队`,
        detail: `${targetRegion.name} 部队 +${troopCount}，蒙古抽 ${troopCount * 2} 张手牌。`,
    }));

    return {
        targetRegionId: targetRegion.id,
        targetRegionName: targetRegion.name,
        choices,
    };
};

const buildRecruitSelection = (
    state: QidahenCore,
    selectedRegionId: string,
    factionId: QidahenFactionId,
): QidahenRecruitSelection | null => {
    const selectedRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(selectedRegionId);
    const selectedRuntimeRegion = state.regions.find((region) => (
        !region.isLogicalRegion
        && region.id === selectedRuntimeRegionId
        && canPlaceRegularTroopsInRegion(region, factionId)
    ));
    const targetRegion = selectedRuntimeRegion ?? getPreferredRegularTroopPlacementRegion(state, factionId);
    if (!targetRegion) {
        return null;
    }

    const choices: QidahenRecruitSelection['choices'] = [
        {
            id: 'level-2-troops',
            label: '建立 6 个等级 2 部队',
            detail: `${targetRegion.name} 部队 +6。`,
            troopDelta: 6,
        },
        {
            id: 'level-4-chuanbing',
            label: '建立 2 个等级 4 川兵',
            detail: `${targetRegion.name} 部队 +2，并记录川兵 x2（4级）。`,
            troopDelta: 2,
        },
    ];

    const artilleryTechLevel = getArmamentLevel(state, factionId, 'artillery-tech');
    if (artilleryTechLevel > 0) {
        choices.push({
            id: 'level-1-artillery',
            label: '建立 1 个等级 1 炮兵',
            detail: `${targetRegion.name} 部队 +1，并记录炮兵 x1（1级）；火炮技术${artilleryTechLevel} 允许建立炮兵。`,
            troopDelta: 1,
        });
    }

    return {
        targetRegionId: targetRegion.id,
        targetRegionName: targetRegion.name,
        choices,
    };
};

const buildKhanEdictDispatchSelection = (
    state: QidahenCore,
    attackerFactionId: QidahenFactionId,
    selectedRegionId: string,
): QidahenWheelDispatchSelection | null => {
    const preferredRegionId = getPreferredDispatchSelectedRegionIdForFaction(
        state,
        attackerFactionId,
        'dispatch-cavalry',
        selectedRegionId,
    );
    const selection = buildWheelDispatchSelection(state, attackerFactionId, 'dispatch-cavalry', preferredRegionId, 'wheel-dispatch');
    return selection
        ? {
            ...selection,
            restriction: '大汗令箭 · 调骑 4（免支付）',
        }
        : null;
};

const buildKhanEdictSelection = (
    state: QidahenCore,
    attackerFactionId: QidahenFactionId,
    selectedRegionId: string,
): QidahenKhanEdictSelection | null => {
    const selectedRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(selectedRegionId);
    const selectedRuntimeRegion = state.regions.find((region) => !region.isLogicalRegion && region.id === selectedRuntimeRegionId);
    const recruitTargetRegion = selectedRuntimeRegion && canPlaceRegularTroopsInRegion(selectedRuntimeRegion, attackerFactionId)
        ? selectedRuntimeRegion
        : getPreferredRegularTroopPlacementRegion(state, attackerFactionId);
    const hireTargetRegion = selectedRuntimeRegion && canPlaceRegularTroopsInRegion(selectedRuntimeRegion, attackerFactionId)
        ? selectedRuntimeRegion
        : getPreferredRegularTroopPlacementRegion(state, attackerFactionId);
    const choices: QidahenKhanEdictSelection['choices'] = [];
    const preferredSourceRegion = selectedRuntimeRegion && canPlaceRegularTroopsInRegion(selectedRuntimeRegion, attackerFactionId)
        ? selectedRuntimeRegion
        : recruitTargetRegion ?? hireTargetRegion;

    if (recruitTargetRegion) {
        choices.push({
            id: 'recruit-train',
            label: '征兵训练',
            detail: `${recruitTargetRegion.name} 部队 +2（免支付）`,
        });
    }
    if (hireTargetRegion) {
        choices.push({
            id: 'hire-dispatch',
            label: '外交雇佣',
            detail: `进入 ${hireTargetRegion.name} 的外交/雇佣选择，可在结算雇佣军的同时处理相邻区域标记。`,
        });
    }
    if (choices.length === 0) {
        return null;
    }

    return {
        sourceRegionId: preferredSourceRegion?.id ?? null,
        sourceRegionName: preferredSourceRegion?.name ?? null,
        recruitTargetRegionId: recruitTargetRegion?.id ?? null,
        recruitTargetRegionName: recruitTargetRegion?.name ?? null,
        hireTargetRegionId: hireTargetRegion?.id ?? null,
        hireTargetRegionName: hireTargetRegion?.name ?? null,
        dispatchSourceRegionId: null,
        dispatchSourceRegionName: null,
        choices,
    };
};

const buildDiplomacyChoicesForTarget = (
    state: QidahenCore,
    actingFactionId: QidahenFactionId,
    sourceRegion: QidahenCore['regions'][number],
    targetRegion: QidahenCore['regions'][number] | null,
    carryState?: Pick<QidahenDiplomacySelection, 'remainingTargetCount' | 'resolvedSteps'>,
): { hint: string; choices: QidahenDiplomacyChoice[] } => {
    const remainingTargetCount = Math.max(0, carryState?.remainingTargetCount ?? QIDAHEN_DIPLOMACY_MAX_TARGETS);
    const hasResolvedSteps = (carryState?.resolvedSteps.length ?? 0) > 0;
    const choices: QidahenDiplomacyChoice[] = [{
        id: 'hire-only',
        label: hasResolvedSteps ? '结束并结算雇佣' : '只结算雇佣',
        detail: hasResolvedSteps
            ? `${sourceRegion.name} 建立 2 个等级 2 雇佣军，并结束本次外交。`
            : `${sourceRegion.name} 建立 2 个等级 2 雇佣军，不改相邻区域标记。`,
    }];
    if (!targetRegion) {
        return {
            hint: remainingTargetCount > 0
                ? `先从地图或候选列表选择一个邻近 ${sourceRegion.name} 的区域；当前还可执行 ${remainingTargetCount} 次外交操作。`
                : `当前 ${sourceRegion.name} 的外交操作已用尽，可直接结束并结算雇佣。`,
            choices,
        };
    }
    if (targetRegion.id === sourceRegion.id || !sourceRegion.adjacentRegionIds.includes(targetRegion.id)) {
        return {
            hint: `${targetRegion.name} 不邻近 ${sourceRegion.name}，当前不能执行外交。`,
            choices,
        };
    }
    if (isRegionUnderSiege(targetRegion)) {
        return {
            hint: `${targetRegion.name} 当前处于围城状态，只允许调度进攻，不能执行外交。`,
            choices,
        };
    }
    if (isQidahenKoreaRuntimeRegionId(targetRegion.id)) {
        return {
            hint: `${targetRegion.name} 属于朝鲜区域，当前不能执行外交。`,
            choices,
        };
    }
    if (hasNonMercenaryTroops(getNonSiegedCityActionSourceSnapshot(targetRegion))) {
        return {
            hint: `${targetRegion.name} 存在正规军，当前不能执行外交。`,
            choices,
        };
    }

    const effectiveHomelandController = getEffectiveHomelandController(state, targetRegion.id);
    const isHomelandWithoutMarker = effectiveHomelandController !== 'neutral'
        && targetRegion.controller === effectiveHomelandController
        && targetRegion.diplomacyMarkerFaction == null;
    if (isHomelandWithoutMarker) {
        return {
            hint: `${targetRegion.name} 是没有控制标记的本土区域，当前不能执行外交。`,
            choices,
        };
    }

    if (targetRegion.diplomacyMarkerFaction === actingFactionId && targetRegion.diplomacyMarkerSide === 'vassal') {
        return {
            hint: `${targetRegion.name} 当前已是${toFactionLabel(actingFactionId)}附庸，可直接只结算雇佣。`,
            choices,
        };
    }

    if (targetRegion.diplomacyMarkerFaction == null) {
        return {
            hint: `${targetRegion.name} 当前没有控制标记，可先放置 ${toFactionLabel(actingFactionId)}友好标记。`,
            choices: [
                ...choices,
                {
                    id: 'place-friendly',
                    label: '放置友好标记',
                    detail: `${targetRegion.name} 变为${toFactionLabel(actingFactionId)}友好，可供通行与驻守。`,
                },
            ],
        };
    }

    if (targetRegion.diplomacyMarkerFaction === actingFactionId && targetRegion.diplomacyMarkerSide === 'friendly') {
        return {
            hint: `${targetRegion.name} 当前已是${toFactionLabel(actingFactionId)}友好，可翻为附庸。`,
            choices: [
                ...choices,
                {
                    id: 'flip-vassal',
                    label: '翻为附庸',
                    detail: `${targetRegion.name} 变为${toFactionLabel(actingFactionId)}附庸，并视为控制区域。`,
                },
            ],
        };
    }

    return {
        hint: `${targetRegion.name} 当前存在${toFactionLabel(targetRegion.diplomacyMarkerFaction)}控制标记，可先移除。`,
        choices: [
            ...choices,
            {
                id: 'remove-marker',
                label: '移除控制标记',
                detail: `移除 ${targetRegion.name} 的现有控制标记；若是友好区且有雇佣军，也会一并移除。`,
            },
        ],
    };
};

const buildDiplomacySelection = (
    state: QidahenCore,
    actingFactionId: QidahenFactionId,
    selectedRegionId: string,
    source: QidahenDiplomacySelection['source'],
    pinnedSourceRegionId?: string | null,
    carryState?: Pick<QidahenDiplomacySelection, 'remainingTargetCount' | 'resolvedSteps'>,
): QidahenDiplomacySelection | null => {
    const sourceRegion = state.regions.find((region) => (
        !region.isLogicalRegion
        && region.id === (pinnedSourceRegionId ?? resolveQidahenPrimaryRuntimeRegionId(selectedRegionId))
        && canPlaceRegularTroopsInRegion(region, actingFactionId)
    )) ?? getPreferredRegularTroopPlacementRegion(state, actingFactionId);
    if (!sourceRegion) {
        return null;
    }

    const selectedRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(selectedRegionId);
    const selectedTargetRegion = state.regions.find((region) => (
        !region.isLogicalRegion
        && region.id === selectedRuntimeRegionId
        && region.id !== sourceRegion.id
    )) ?? null;
    const resolvedSteps = carryState?.resolvedSteps.map((step) => ({ ...step })) ?? [];
    const remainingTargetCount = Math.max(0, carryState?.remainingTargetCount ?? QIDAHEN_DIPLOMACY_MAX_TARGETS);
    const { hint, choices } = buildDiplomacyChoicesForTarget(
        state,
        actingFactionId,
        sourceRegion,
        selectedTargetRegion,
        { remainingTargetCount, resolvedSteps },
    );

    return {
        source,
        title: source === 'wheel-hire' ? '轮盘外交/雇佣' : '大汗令箭',
        sourceRegionId: sourceRegion.id,
        sourceRegionName: sourceRegion.name,
        hireRegionId: sourceRegion.id,
        hireRegionName: sourceRegion.name,
        targetRegionId: selectedTargetRegion?.id ?? null,
        targetRegionName: selectedTargetRegion?.name ?? null,
        candidateTargetRegionIds: sourceRegion.adjacentRegionIds.filter((regionId) => {
            const candidateRegion = state.regions.find((region) => !region.isLogicalRegion && region.id === regionId);
            return candidateRegion ? isRegionAvailableForNonDispatchAction(candidateRegion) : false;
        }),
        targetHint: hint,
        choices,
        maxTargetCount: QIDAHEN_DIPLOMACY_MAX_TARGETS,
        remainingTargetCount,
        resolvedSteps,
    };
};

const buildDriveTigerDispatchSelection = (
    state: QidahenCore,
    commanderFactionId: QidahenFactionId,
    selectedRegionId: string,
): QidahenWheelDispatchSelection | null => {
    const selectedRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(selectedRegionId);
    const selectedRuntimeRegion = state.regions.find((region) => !region.isLogicalRegion && region.id === selectedRuntimeRegionId);
    const targetFactionId = selectedRuntimeRegion?.siegeState?.attackerFactionId ?? selectedRuntimeRegion?.controller;
    if (
        !targetFactionId
        || targetFactionId === 'neutral'
        || targetFactionId === commanderFactionId
    ) {
        return null;
    }

    const preferredRegionId = getPreferredDispatchSelectedRegionIdForFaction(
        state,
        targetFactionId,
        'dispatch-cavalry',
        selectedRegionId,
    );
    const selection = buildWheelDispatchSelection(state, targetFactionId, 'dispatch-cavalry', preferredRegionId, 'drive-tiger');
    return selection
        ? {
            ...selection,
            restriction: `驱虎吞狼 · 指挥${state.factions[targetFactionId].name}调度进攻`,
        }
        : null;
};

const buildDriveTigerConsentSelection = (
    state: QidahenCore,
    commanderFactionId: QidahenFactionId,
    dispatchSelection: QidahenWheelDispatchSelection,
): QidahenDriveTigerConsentSelection => ({
    commanderFactionId,
    targetFactionId: dispatchSelection.attackerFactionId,
    targetFactionName: state.factions[dispatchSelection.attackerFactionId].name,
    dispatchSelection,
    choices: [
        {
            id: 'accept',
            label: '同意受指挥',
            detail: `${state.factions[dispatchSelection.attackerFactionId].name} 同意后，先抽 6 张手牌，再由大明指挥最多 ${getQidahenCharacterCommittedTroopLimit(state, dispatchSelection.attackerFactionId, 'drive-tiger') ?? 6} 个部队进行调度进攻。`,
        },
        {
            id: 'decline',
            label: '拒绝执行',
            detail: `${state.factions[dispatchSelection.attackerFactionId].name} 拒绝后，本次驱虎吞狼不生效，也不会抽牌。`,
        },
    ],
});

const buildPendingTargetActionFromWheelDispatchChoice = (
    selection: QidahenWheelDispatchSelection,
    candidate: QidahenWheelDispatchCandidate,
    options: {
        actionId?: 'wheel-dispatch' | 'drive-tiger';
        title?: string;
    } = {},
): QidahenPendingTargetAction => ({
    actionId: options.actionId ?? 'wheel-dispatch',
    battleMode: candidate.battleMode ?? (isQidahenCityRuntimeRegion(candidate.targetRuntimeRegionId) ? 'city' : 'field'),
    targetKind: candidate.targetKind ?? 'region',
    title: options.title ?? '调度进攻待结算',
    attackerFactionId: selection.attackerFactionId,
    sourceRegionId: selection.sourceRegionId,
    sourceRegionName: selection.sourceRegionName,
    attackerPositionRegionId: candidate.attackerPositionRegionId ?? null,
    targetRegionId: candidate.targetRegionId,
    targetRegionName: candidate.targetRegionName,
    targetRuntimeRegionId: candidate.targetRuntimeRegionId,
    defenderFactionId: candidate.defenderFactionId,
    defenderLabel: candidate.defenderLabel,
    restriction: selection.restriction,
    battleWidth: candidate.battleWidth,
    boundaryUnitCap: candidate.boundaryUnitCap,
    sourceAvailableTroops: candidate.sourceAvailableTroops,
    committedTroops: candidate.committedTroops,
    movementProfileId: selection.movementProfileId,
    attackPressure: candidate.attackPressure,
    attackBoundaryType: candidate.attackBoundaryType,
    resolutionHint: candidate.resolutionHint,
    defenderPayCost: null,
});

const buildPendingTargetAction = (
    state: QidahenCore,
    attackerFactionId: QidahenFactionId,
    actionId: 'raid' | 'marriage-subjugation',
    selectedRegion: QidahenCore['regions'][number] | undefined,
): QidahenPendingTargetAction | null => {
    if (!selectedRegion) {
        return null;
    }
    if (actionId === 'marriage-subjugation' && getMarriageSubjugationBlockedReason(state, selectedRegion)) {
        return null;
    }

    const resolvedSelectedRegion = (() => {
        if (actionId !== 'raid') {
            return selectedRegion;
        }
        const getRaidFallbackTargetSnapshot = (
            region: QidahenCore['regions'][number],
        ): Pick<QidahenCore['regions'][number], 'troops' | 'population'> => {
            if (isFriendlySiegedCityTarget(region, attackerFactionId) && region.siegeState) {
                return {
                    troops: region.siegeState.attackerTroops,
                    population: 0,
                };
            }
            const regionSnapshot = getNonSiegedCityActionSourceSnapshot(region);
            return {
                troops: regionSnapshot.troops,
                population: regionSnapshot.population,
            };
        };
        const selectedRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(selectedRegion.id);
        const selectedRuntimeRegion = state.regions.find((region) => region.id === selectedRuntimeRegionId && !region.isLogicalRegion);
        if (
            !selectedRuntimeRegion
            || selectedRuntimeRegion.controller !== attackerFactionId
            || !isRegionAvailableForNonDispatchAction(selectedRuntimeRegion)
        ) {
            return selectedRegion;
        }
        const fallbackTarget = selectedRuntimeRegion.adjacentRegionIds
            .map((regionId) => state.regions.find((region) => region.id === regionId && !region.isLogicalRegion))
            .filter((region): region is NonNullable<typeof region> => {
                if (
                    region == null
                ) {
                    return false;
                }
                const isFriendlySiegeTarget = isFriendlySiegedCityTarget(region, attackerFactionId);
                if (!isFriendlySiegeTarget && isRegionFriendlyToFaction(region, attackerFactionId)) {
                    return false;
                }
                if (!isFriendlySiegeTarget && !isRegionAvailableForNonDispatchAction(region)) {
                    return false;
                }
                const passage = getQidahenDirectedPassageRule(state, selectedRuntimeRegion.id, region.id, attackerFactionId);
                return Boolean(passage?.usable);
            })
            .sort((left, right) => {
                const leftSource = getRaidFallbackTargetSnapshot(left);
                const rightSource = getRaidFallbackTargetSnapshot(right);
                return rightSource.troops - leftSource.troops
                    || rightSource.population - leftSource.population
                    || left.name.localeCompare(right.name, 'zh-CN');
            })
            .at(0);
        return fallbackTarget ?? selectedRegion;
    })();

    const targetRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(resolvedSelectedRegion.id);
    const targetRuntimeRegion = state.regions.find((region) => region.id === targetRuntimeRegionId && !region.isLogicalRegion);
    const isFriendlySiegeTarget = isFriendlySiegedCityTarget(targetRuntimeRegion, attackerFactionId);
    if (
        !targetRuntimeRegion
        || (!isFriendlySiegeTarget && isRegionFriendlyToFaction(targetRuntimeRegion, attackerFactionId))
        || (!isFriendlySiegeTarget && !isRegionAvailableForNonDispatchAction(targetRuntimeRegion))
    ) {
        return null;
    }

    const sourceRegion = targetRuntimeRegion.adjacentRegionIds
        .map((regionId) => state.regions.find((region) => region.id === regionId && !region.isLogicalRegion))
        .filter((region): region is NonNullable<typeof region> => {
            if (
                region == null
                || !isRegionFriendlyToFaction(region, attackerFactionId)
                || !isRegionAvailableForNonDispatchAction(region)
            ) {
                return false;
            }
            const passage = getQidahenDirectedPassageRule(state, region.id, targetRuntimeRegionId, attackerFactionId);
            return Boolean(passage?.usable);
        })
        .map((region) => materializeNonSiegedCityActionSourceRegion(region))
        .sort((left, right) => right.troops - left.troops || left.name.localeCompare(right.name, 'zh-CN'))
        .at(0);
    if (!sourceRegion) {
        return null;
    }

    const directedPassage = getQidahenDirectedPassageRule(state, sourceRegion.id, targetRuntimeRegionId, attackerFactionId);
    if (!directedPassage) {
        return null;
    }
    const battleWidth = directedPassage?.battleWidth ?? sourceRegion.movementCostByRegionId[targetRuntimeRegionId] ?? 3;
    const attackBoundaryType = directedPassage?.boundaryType ?? sourceRegion.boundaryTypeByRegionId[targetRuntimeRegionId] ?? 'plain';
    const attackBoundaryLabel = directedPassage?.boundaryLabel ?? getQidahenBoundaryTypeMeta(attackBoundaryType).label;
    const defenderPayCost = actionId === 'marriage-subjugation'
        ? computeMarriageSubjugationPayCost(state, targetRuntimeRegion)
        : null;
    const boundaryUnitCap = directedPassage?.unitCap ?? null;
    const committedTroops = actionId === 'raid'
        ? computeEffectiveCommittedTroops(state, {
            attackerFactionId,
            actionId: 'raid',
            availableTroops: sourceRegion.troops,
            boundaryUnitCap,
        })
        : 0;
    const attackPressure = actionId === 'raid'
        ? computeQidahenAttackPressure(committedTroops, battleWidth)
        : 0;
    if (actionId === 'raid' && (committedTroops <= 0 || attackPressure <= 0)) {
        return null;
    }
    const targetKind = isFriendlySiegeTarget ? 'siege-attacker' as const : 'region' as const;
    const battleMode = targetKind === 'siege-attacker'
        ? 'field' as const
        : isQidahenCityRuntimeRegion(targetRuntimeRegionId) ? 'city' as const : 'field' as const;
    const defenderFactionId = targetKind === 'siege-attacker'
        ? targetRuntimeRegion.siegeState!.attackerFactionId
        : targetRuntimeRegion.controller;
    const defenderLabel = targetKind === 'siege-attacker'
        ? `${toFactionLabel(targetRuntimeRegion.siegeState!.attackerFactionId)}围城军`
        : targetRuntimeRegion.controlLabel;
    const resolutionHint = actionId === 'raid'
        ? `${sourceRegion.name} → ${resolvedSelectedRegion.name} · ${attackBoundaryLabel} ${battleWidth} · 投${committedTroops}/压${attackPressure}${boundaryUnitCap ? `/限${boundaryUnitCap}` : ''}${targetKind === 'siege-attacker' ? ' · 解围' : ''}`
        : `${sourceRegion.name} → ${resolvedSelectedRegion.name} · ${attackBoundaryLabel} ${battleWidth}`;

    return {
        actionId,
        battleMode,
        targetKind,
        title: actionId === 'raid' ? '突袭待结算' : '联姻待结算',
        attackerFactionId,
        sourceRegionId: sourceRegion.id,
        sourceRegionName: sourceRegion.name,
        targetRegionId: resolvedSelectedRegion.id,
        targetRegionName: resolvedSelectedRegion.name,
        targetRuntimeRegionId,
        defenderFactionId,
        defenderLabel,
        restriction: actionId === 'raid' ? '仅进攻行动' : '邻近控制区域',
        battleWidth,
        boundaryUnitCap,
        sourceAvailableTroops: sourceRegion.troops,
        committedTroops,
        movementProfileId: null,
        attackPressure,
        attackBoundaryType,
        resolutionHint,
        defenderPayCost,
    };
};

const buildPostBattleSelection = (
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
    targetRegion: QidahenCore['regions'][number],
    survivingTroops: number,
    attackerLosses: number,
    attackerCasualtyPriority: QidahenCasualtyPriority = 'highest-level',
): QidahenPostBattleSelection | null => {
    if (
        (pendingTargetAction.actionId !== 'raid' && pendingTargetAction.actionId !== 'wheel-dispatch' && pendingTargetAction.actionId !== 'drive-tiger')
        || !pendingTargetAction.sourceRegionId
        || survivingTroops <= 0
    ) {
        return null;
    }

    const retreatChoices = targetRegion.adjacentRegionIds
        .map((regionId) => state.regions.find((region) => !region.isLogicalRegion && region.id === regionId))
        .filter((region): region is NonNullable<typeof region> => region != null && isRegionFriendlyToFaction(region, pendingTargetAction.attackerFactionId))
        .sort((left, right) => (
            Number(right.id === pendingTargetAction.sourceRegionId) - Number(left.id === pendingTargetAction.sourceRegionId)
            || left.name.localeCompare(right.name, 'zh-CN')
        ));
    const isCityRegion = resolveQidahenRuleRegionConfig(targetRegion.id).tags.includes('city');
    const battleMode = pendingTargetAction.battleMode ?? (isCityRegion ? 'city' : 'field');
    const getPlunderPopulationCap = (mode: QidahenPostBattleChoice['mode']): number => {
        return getPostBattlePlunderPopulationCap(targetRegion, battleMode, mode);
    };
    const canPlunderDefenderDeck = targetRegion.controller !== 'neutral' && targetRegion.controller !== pendingTargetAction.attackerFactionId;
    const canBesiege = isCityRegion
        && targetRegion.controller !== 'neutral'
        && targetRegion.controller !== pendingTargetAction.attackerFactionId;
    if (pendingTargetAction.targetKind === 'siege-attacker') {
        return {
            actionId: pendingTargetAction.actionId,
            battleMode,
            targetKind: 'siege-attacker',
            attackerFactionId: pendingTargetAction.attackerFactionId,
            sourceRegionId: pendingTargetAction.sourceRegionId,
            sourceRegionName: pendingTargetAction.sourceRegionName ?? pendingTargetAction.sourceRegionId,
            attackerPositionRegionId: pendingTargetAction.attackerPositionRegionId ?? null,
            targetRegionId: pendingTargetAction.targetRegionId,
            targetRegionName: pendingTargetAction.targetRegionName,
            targetRuntimeRegionId: pendingTargetAction.targetRuntimeRegionId,
            committedTroops: pendingTargetAction.committedTroops,
            survivingTroops,
            attackerLosses,
            movementProfileId: pendingTargetAction.movementProfileId,
            attackerCasualtyPriority,
            originalController: targetRegion.controller,
            originalControlLabel: targetRegion.controlLabel,
            title: `${pendingTargetAction.targetRegionName} 解围待结算`,
            summary: `${pendingTargetAction.targetRegionName} 围城军已被压制，幸存 ${survivingTroops} 个援军可进驻解围。`,
            choices: [{
                id: 'occupy',
                mode: 'occupy',
                regionId: pendingTargetAction.targetRuntimeRegionId,
                plunderPopulation: 0,
                plunderSource: null,
                label: '解除围城并进驻',
                detail: `${survivingTroops} 个幸存援军进入 ${pendingTargetAction.targetRegionName}，解除围城。`,
            }],
        };
    }
    const addPlunderChoice = (choice: QidahenPostBattleChoice): QidahenPostBattleChoice[] => (
        (() => {
            const plunderPopulationCap = getPlunderPopulationCap(choice.mode);
            const plunderPopulationOptions = Array.from(
                { length: Math.max(0, plunderPopulationCap) },
                (_, index) => index + 1,
            );
            return plunderPopulationOptions.length > 0
            ? [
                choice,
                ...plunderPopulationOptions.flatMap((plunderPopulation) => {
                    const suffix = choice.mode === 'withdraw' && choice.regionId ? `:${choice.regionId}` : '';
                    const retreatLabel = choice.mode === 'occupy'
                        ? '占领'
                        : choice.mode === 'besiege'
                            ? '围城'
                            : `退回 ${state.regions.find((region) => region.id === choice.regionId)?.name ?? '友方区域'}`;
                    const attackerDeckChoice = {
                        ...choice,
                        id: `${choice.mode}-plunder-${plunderPopulation}${suffix}`,
                        plunderPopulation,
                        plunderSource: 'attacker' as const,
                        label: `劫掠 ${plunderPopulation} 人口并${retreatLabel}`,
                        detail: `移除 ${pendingTargetAction.targetRegionName} ${plunderPopulation} 人口；抽自己普通牌堆 ${plunderPopulation * 2} 张，手牌 +${plunderPopulation}、弃牌堆 +${plunderPopulation}。${choice.detail}`,
                    };
                    if (!canPlunderDefenderDeck) {
                        return [attackerDeckChoice];
                    }
                    return [
                        attackerDeckChoice,
                        {
                            ...choice,
                            id: `${choice.mode}-plunder-defender-${plunderPopulation}${suffix}`,
                            plunderPopulation,
                            plunderSource: 'defender' as const,
                            label: `劫掠 ${plunderPopulation} 人口，抽${toFactionLabel(targetRegion.controller)}牌堆并${retreatLabel}`,
                            detail: `移除 ${pendingTargetAction.targetRegionName} ${plunderPopulation} 人口；抽被占领者普通牌堆 ${plunderPopulation} 张进手牌。${choice.detail}`,
                        },
                    ];
                }),
            ]
            : [choice]
        })()
    );

    const choices = [
        ...addPlunderChoice({
            id: 'occupy',
            mode: 'occupy' as const,
            regionId: pendingTargetAction.targetRuntimeRegionId,
            plunderPopulation: 0,
            plunderSource: null,
            label: '占领该区',
            detail: `${survivingTroops} 个幸存部队留在 ${pendingTargetAction.targetRegionName}`,
        }),
        ...(canBesiege
            ? addPlunderChoice({
                id: 'besiege',
                mode: 'besiege' as const,
                regionId: pendingTargetAction.targetRuntimeRegionId,
                plunderPopulation: 0,
                plunderSource: null,
                label: '围城该区',
                detail: `${survivingTroops} 个幸存部队留在 ${pendingTargetAction.targetRegionName} 外围围城，区域仍由守方控制。`,
            })
            : []),
        ...retreatChoices.flatMap((region) => addPlunderChoice({
            id: `withdraw:${region.id}`,
            mode: 'withdraw' as const,
            regionId: region.id,
            plunderPopulation: 0,
            plunderSource: null,
            label: `退回 ${region.name}`,
            detail: `${survivingTroops} 个幸存部队撤回相邻友方区域，${pendingTargetAction.targetRegionName} 不改控`,
        })),
    ];

    return {
        actionId: pendingTargetAction.actionId,
        battleMode,
        targetKind: pendingTargetAction.targetKind ?? 'region',
        attackerFactionId: pendingTargetAction.attackerFactionId,
        sourceRegionId: pendingTargetAction.sourceRegionId,
        sourceRegionName: pendingTargetAction.sourceRegionName ?? pendingTargetAction.sourceRegionId,
        attackerPositionRegionId: pendingTargetAction.attackerPositionRegionId ?? null,
        targetRegionId: pendingTargetAction.targetRegionId,
        targetRegionName: pendingTargetAction.targetRegionName,
        targetRuntimeRegionId: pendingTargetAction.targetRuntimeRegionId,
        committedTroops: pendingTargetAction.committedTroops,
        survivingTroops,
        attackerLosses,
        movementProfileId: pendingTargetAction.movementProfileId ?? null,
        attackerCasualtyPriority,
        originalController: targetRegion.controller,
        originalControlLabel: targetRegion.controlLabel,
        title: '战后处理',
        summary: `${pendingTargetAction.targetRegionName} 已被突破，攻方损失 ${attackerLosses}，幸存 ${survivingTroops}，决定是否占领${canBesiege ? '、围城' : ''}或回退。`,
        choices,
    };
};

const findDefenderRetreatRegions = (
    state: QidahenCore,
    targetRegion: QidahenCore['regions'][number],
    defenderFactionId: QidahenFactionId,
): QidahenCore['regions'][number][] => (
    targetRegion.adjacentRegionIds
        .map((regionId) => state.regions.find((region) => !region.isLogicalRegion && region.id === regionId))
        .filter((region): region is NonNullable<typeof region> => region != null && isRegionFriendlyToFaction(region, defenderFactionId))
        .sort((left, right) => {
            const leftSource = getFriendlyReceivingRegionSnapshot(left);
            const rightSource = getFriendlyReceivingRegionSnapshot(right);
            return Number(isRegionControlledByFaction(right, defenderFactionId)) - Number(isRegionControlledByFaction(left, defenderFactionId))
                || rightSource.troops - leftSource.troops
                || rightSource.population - leftSource.population
                || left.name.localeCompare(right.name, 'zh-CN');
        })
);

const findAutoDefenderRetreatRegion = (
    state: QidahenCore,
    targetRegion: QidahenCore['regions'][number],
    defenderFactionId: QidahenFactionId,
): QidahenCore['regions'][number] | null => (
    findDefenderRetreatRegions(state, targetRegion, defenderFactionId)
        .at(0)
        ?? null
);

const getDefenderCavalryEvasion = (
    state: QidahenCore,
    targetRegion: QidahenCore['regions'][number],
    pendingTargetAction: QidahenPendingTargetAction,
    preferredRetreatRegionId?: string,
): {
    retreatRegion: QidahenCore['regions'][number];
    troops: number;
    specialTroops: QidahenSpecialTroopStack[];
} | null => {
    if (
        pendingTargetAction.actionId !== 'raid'
        && pendingTargetAction.actionId !== 'wheel-dispatch'
        && pendingTargetAction.actionId !== 'drive-tiger'
    ) {
        return null;
    }
    if (pendingTargetAction.defenderFactionId === 'neutral') {
        return null;
    }
    if (resolveQidahenRuleRegionConfig(targetRegion.id).tags.includes('city')) {
        return null;
    }

    const specialTroops = targetRegion.specialTroops
        .map(normalizeSpecialTroopStack)
        .filter((stack) => stack.troopKind === 'cavalry');
    const troops = getSpecialTroopCount({ specialTroops });
    if (troops <= 0) {
        return null;
    }

    const retreatRegions = findDefenderRetreatRegions(state, targetRegion, pendingTargetAction.defenderFactionId);
    const retreatRegion = retreatRegions.find((region) => region.id === preferredRetreatRegionId)
        ?? retreatRegions[0]
        ?? null;
    if (!retreatRegion) {
        return null;
    }

    return {
        retreatRegion,
        troops,
        specialTroops,
    };
};

const computeRetreatLoss = (survivingTroops: number, retreatLossMode: QidahenRetreatLossMode): number => (
    retreatLossMode === 'rout'
        ? Math.max(0, survivingTroops)
        : Math.min(1, Math.max(0, survivingTroops))
);

const computeStructuredBattleCasualties = (
    sourceRegion: QidahenCore['regions'][number] | null,
    targetRegion: Pick<QidahenCore['regions'][number], 'controller' | 'troops' | 'specialTroops'>,
    pendingTargetAction: QidahenPendingTargetAction,
    effectiveDefenderTroops: number,
    defenderPressure: number,
    fallbackDefenderLoss: number,
    fallbackAttackerLoss: number,
    battleRolls?: QidahenBattleRolls | null,
): {
    defenderLoss: number;
    attackerLoss: number;
    summary: string | null;
} => {
    const hasStructuredTroops = Boolean(sourceRegion?.specialTroops.length) || targetRegion.specialTroops.length > 0;
    if (!hasStructuredTroops || !sourceRegion) {
        return {
            defenderLoss: fallbackDefenderLoss,
            attackerLoss: fallbackAttackerLoss,
            summary: null,
        };
    }

    const committedArtilleryCount = getCommittedArtilleryTroopCount(
        sourceRegion,
        pendingTargetAction.committedTroops,
        pendingTargetAction.movementProfileId,
    );
    const committedBattleTroops = Math.max(0, pendingTargetAction.committedTroops - committedArtilleryCount);
    if (battleRolls) {
        return {
            defenderLoss: Math.max(0, Math.min(effectiveDefenderTroops, battleRolls.attackerDamage)),
            attackerLoss: Math.max(0, Math.min(committedBattleTroops, battleRolls.defenderDamage)),
            summary: battleRolls.summary,
        };
    }

    const attackPower = computeCombatPower(sourceRegion, pendingTargetAction.attackPressure || pendingTargetAction.battleWidth);
    const defenderPower = computeCombatPower(targetRegion, defenderPressure);
    const defenderLoss = effectiveDefenderTroops > 0
        ? Math.max(1, Math.min(effectiveDefenderTroops, Math.ceil(attackPower / 3)))
        : 0;
    const attackerLoss = Math.max(0, Math.min(committedBattleTroops, Math.ceil(defenderPower / 3)));

    return {
        defenderLoss,
        attackerLoss,
        summary: `等级损伤估算：攻方战力 ${attackPower} 造成 ${defenderLoss} 损伤，守方战力 ${defenderPower} 造成 ${attackerLoss} 损伤。`,
    };
};

const addDefeatMarkerToFaction = (
    factions: QidahenCore['factions'],
    factionId: QidahenFactionId,
): QidahenCore['factions'] => {
    const faction = factions[factionId];
    const characters = addDefeatMarkerToCharacters(
        faction.characters.length > 0 ? faction.characters : createInitialCharacterStates(factionId),
    );

    return {
        ...factions,
        [factionId]: {
            ...faction,
            defeatMarkers: (faction.defeatMarkers ?? 0) + 1,
            characters,
        },
    };
};

const addDefeatMarkerToCharacters = (characters: QidahenCharacterState[]): QidahenCharacterState[] => {
    const eligibleCharacters = characters
        .filter((character) => character.inPlay && character.canHoldDefeatMarker)
        .sort((left, right) => (
            left.defeatMarkers - right.defeatMarkers
            || Number(left.number === 'X') - Number(right.number === 'X')
            || Number(left.number) - Number(right.number)
            || left.name.localeCompare(right.name, 'zh-CN')
        ));
    const targetCharacterId = eligibleCharacters[0]?.id ?? null;

    return characters.map((character) => (
        character.id === targetCharacterId
            ? {
                ...character,
                defeatMarkers: character.defeatMarkers + 1,
            }
            : character
    ));
};

const getCharacterDefeatMarkerCount = (characters: QidahenCharacterState[]): number => (
    characters.reduce((sum, character) => sum + Math.max(0, character.defeatMarkers), 0)
);

const syncFactionCharactersToDefeatMarkerCount = (faction: QidahenFactionState): QidahenFactionState => {
    let nextFaction = {
        ...faction,
        characters: faction.characters.length > 0 ? faction.characters : createInitialCharacterStates(faction.id),
    };
    const characterMarkerCount = getCharacterDefeatMarkerCount(nextFaction.characters);
    const missingMarkers = Math.max(0, (nextFaction.defeatMarkers ?? 0) - characterMarkerCount);

    for (let index = 0; index < missingMarkers; index += 1) {
        nextFaction = {
            ...nextFaction,
            characters: addDefeatMarkerToCharacters(nextFaction.characters),
        };
    }

    return nextFaction;
};

const listMarkedCharacters = (characters: QidahenCharacterState[]): QidahenCharacterState[] => (
    characters
        .filter((character) => character.defeatMarkers > 0)
        .sort((left, right) => (
            Number(left.number === 'X') - Number(right.number === 'X')
            || Number(left.number) - Number(right.number)
            || left.name.localeCompare(right.name, 'zh-CN')
        ))
);

const getMidyearDefeatMarkerRoll = (factionId: QidahenFactionId, markerIndex: number): number => {
    const factionIndex = factionOrder.indexOf(factionId);
    return ((factionIndex + 1) * 3 + (markerIndex * 2)) % 6 + 1;
};

const resolveCharacterDefeatMarkerRolls = (
    factionId: QidahenFactionId,
    characters: QidahenCharacterState[],
    factions: QidahenCore['factions'],
): {
    characters: QidahenCharacterState[];
    rolls: number[];
    details: string[];
    removedCharacters: string[];
} => {
    let nextCharacters = characters;
    const rolls: number[] = [];
    const details: string[] = [];
    const removedCharacters: string[] = [];
    const lindanHutuktuActive = factionOrder.some((candidateFactionId) => (
        factions[candidateFactionId].characters.some((character) => character.id === 'mongol-lindan-hutuktu' && character.inPlay)
    ));
    const jinCharactersProtectedByDaisan = factions.jin.characters.some((character) => character.id === 'jin-daisan' && character.inPlay);

    for (const character of listMarkedCharacters(characters)) {
        const currentCharacter = nextCharacters.find((item) => item.id === character.id);
        if (!currentCharacter || !currentCharacter.inPlay || currentCharacter.defeatMarkers <= 0) {
            continue;
        }

        for (let markerIndex = 0; markerIndex < currentCharacter.defeatMarkers; markerIndex += 1) {
            const rawRoll = getMidyearDefeatMarkerRoll(factionId, rolls.length);
            const lindanPenaltyBlockedByDaisan = currentCharacter.faction === 'jin' && jinCharactersProtectedByDaisan;
            const effectiveRoll = lindanHutuktuActive && currentCharacter.id !== 'mongol-lindan-hutuktu' && !lindanPenaltyBlockedByDaisan
                ? Math.max(1, rawRoll - 1)
                : rawRoll;
            rolls.push(rawRoll);
            const removed = currentCharacter.number !== 'X' && effectiveRoll === Number(currentCharacter.number);
            details.push(`${currentCharacter.name}(${currentCharacter.number}) 掷 ${rawRoll}${effectiveRoll !== rawRoll ? `→${effectiveRoll}` : ''}${removed ? ' 离场' : ''}`);

            if (removed) {
                removedCharacters.push(currentCharacter.name);
                nextCharacters = nextCharacters.map((item) => (
                    item.id === currentCharacter.id
                        ? {
                            ...item,
                            inPlay: false,
                            defeatMarkers: 0,
                        }
                        : item
                ));
                break;
            }
        }

        nextCharacters = nextCharacters.map((item) => (
            item.id === currentCharacter.id
                ? {
                    ...item,
                    defeatMarkers: 0,
                }
                : item
        ));
    }

    return {
        characters: nextCharacters,
        rolls,
        details,
        removedCharacters,
    };
};

const resolveMidyearDefeatMarkers = (
    factions: QidahenCore['factions'],
): {
    factions: QidahenCore['factions'];
    summaryLines: string[];
} => {
    let nextFactions = factions;
    const markerSummaries: string[] = [];

    for (const factionId of factionOrder) {
        const syncedFaction = syncFactionCharactersToDefeatMarkerCount(nextFactions[factionId]);
        const markerCount = syncedFaction.defeatMarkers ?? 0;
        if (markerCount <= 0) {
            nextFactions = {
                ...nextFactions,
                [factionId]: syncedFaction,
            };
            continue;
        }
        const markerResolution = resolveCharacterDefeatMarkerRolls(factionId, syncedFaction.characters, nextFactions);
        const markerRolls = markerResolution.rolls.length > 0 ? markerResolution.rolls : [getMidyearDefeatMarkerRoll(factionId, 0)];
        const markerDetails = markerResolution.details.join('、');
        const removedSummary = markerResolution.removedCharacters.length > 0
            ? `，${markerResolution.removedCharacters.join('、')}离场`
            : '';
        nextFactions = {
            ...nextFactions,
            [factionId]: {
                ...syncedFaction,
                defeatMarkers: 0,
                characters: markerResolution.characters,
            },
        };
        markerSummaries.push(`${syncedFaction.name}处理 ${markerCount} 个战败标记，掷骰 ${markerRolls.join('/')}${markerDetails ? `（${markerDetails}）` : ''}${removedSummary}`);
    }

    const markerSummary = markerSummaries.length > 0
        ? `${markerSummaries.join('，')}，标记已移除`
        : '本次没有需要处理的战败标记';
    const summaryLine = `年中战败标记与人物判定：${markerSummary}；人物牌额外判定仍以低保真摘要保留。`;

    return {
        factions: nextFactions,
        summaryLines: [summaryLine],
    };
};

const buildFortificationMaintenanceSelection = (state: QidahenCore) => ({
    title: '新年防线维护',
    summary: `大明当前手牌 ${state.factions.ming.handCount} 张；可先选择尽量维护，也可本年放弃维护全部防线。`,
    choices: [
        {
            id: 'auto-pay' as const,
            label: '尽量维护防线',
            detail: '按当前防线优先级自动支付可负担的维护费，无法维护或依赖区域失守的防线改为破败。',
        },
        {
            id: 'skip-all' as const,
            label: '放弃维护全部防线',
            detail: '本年不支付防线维护费，外长城、内长城、山海关、宁远、锦州全部改为破败。',
        },
    ],
});

const resolvePostBattleDecision = (
    state: QidahenCore,
    selection: QidahenPostBattleSelection,
    choiceId: string,
): Pick<QidahenCore, 'regions' | 'mapTokens' | 'factions' | 'koreaDeckCount' | 'drawPileCount' | 'discardPileCount' | 'handCards'> & {
    logText: string;
    selectedRegionId: string;
} => {
    const choice = selection.choices.find((item) => item.id === choiceId) ?? selection.choices[0];
    const runtimeRegions = state.regions.filter((region) => !region.isLogicalRegion);
    const targetRegion = runtimeRegions.find((region) => region.id === selection.targetRuntimeRegionId);
    if (!choice || !targetRegion) {
        return {
            regions: state.regions,
            mapTokens: state.mapTokens,
            factions: state.factions,
            koreaDeckCount: state.koreaDeckCount,
            drawPileCount: state.drawPileCount,
            discardPileCount: state.discardPileCount,
            handCards: state.handCards,
            logText: `${state.factions[selection.attackerFactionId].name} 完成战后处理。`,
            selectedRegionId: state.selectedRegionId,
        };
    }

    const withdrawRegionId = choice.mode === 'withdraw' ? choice.regionId : null;
    const battleMode = selection.battleMode ?? (isQidahenCityRuntimeRegion(targetRegion.id) ? 'city' : 'field');
    const cityPopulationState = getCityPopulationState(targetRegion, battleMode);
    const plunderPopulationCap = getPostBattlePlunderPopulationCap(targetRegion, battleMode, choice.mode);
    const plunderPopulation = Math.min(choice.plunderPopulation, plunderPopulationCap);
    const occupiedPopulation = battleMode === 'city' && isQidahenCityRuntimeRegion(targetRegion.id)
        ? Math.max(0, cityPopulationState.totalPopulation - plunderPopulation)
        : Math.max(0, targetRegion.population - plunderPopulation);
    const besiegedOutsidePopulation = battleMode === 'city' && isQidahenCityRuntimeRegion(targetRegion.id)
        ? Math.max(0, cityPopulationState.outsidePopulation - plunderPopulation)
        : Math.max(0, targetRegion.population - plunderPopulation);
    const besiegedCityPopulation = battleMode === 'city' && isQidahenCityRuntimeRegion(targetRegion.id)
        ? cityPopulationState.insidePopulation
        : Math.max(0, Math.min(2, targetRegion.population));
    const withdrawnCityPopulation = battleMode === 'city' && isQidahenCityRuntimeRegion(targetRegion.id)
        ? Math.max(0, cityPopulationState.totalPopulation - plunderPopulation)
        : Math.max(0, targetRegion.population - plunderPopulation);
    const preservedCityState = battleMode === 'city' && isQidahenCityRuntimeRegion(targetRegion.id)
        ? {
            troops: targetRegion.cityState?.troops ?? 0,
            population: targetRegion.cityState?.population ?? 0,
            specialTroops: targetRegion.cityState?.specialTroops.map((stack) => ({ ...stack })) ?? [],
        }
        : null;
    const plunderSourceFactionId = choice.plunderSource === 'defender' && selection.originalController !== 'neutral'
        ? selection.originalController
        : selection.attackerFactionId;
    const plunderRequestedCards = plunderPopulation > 0
        ? choice.plunderSource === 'defender' ? plunderPopulation : plunderPopulation * 2
        : 0;
    const plunderAvailableCards = getFactionDrawPileCount(state, plunderSourceFactionId);
    const plunderDrawCards = Math.min(plunderRequestedCards, plunderAvailableCards);
    const attackerDeckPlunderHandBonus = choice.plunderSource === 'attacker'
        ? getAttackerDeckPlunderHandBonus(state, selection.attackerFactionId, plunderPopulation)
        : 0;
    const plunderHandGain = choice.plunderSource === 'defender'
        ? plunderDrawCards
        : Math.min(plunderPopulation + attackerDeckPlunderHandBonus, plunderDrawCards);
    const plunderDiscardGain = Math.max(0, plunderDrawCards - plunderHandGain);
    const plunderText = plunderPopulation > 0
        ? choice.plunderSource === 'defender'
            ? `并劫掠 ${selection.targetRegionName} ${plunderPopulation} 人口，抽${toFactionLabel(selection.originalController)}牌堆获得 ${plunderHandGain} 张手牌`
            : `并劫掠 ${selection.targetRegionName} ${plunderPopulation} 人口，获得 ${plunderHandGain} 张手牌、弃牌堆 +${plunderDiscardGain}${attackerDeckPlunderHandBonus > 0 ? '（含人物额外摸牌）' : ''}`
        : '';
    const sourceRemovalRegionId = selection.attackerPositionRegionId ?? selection.sourceRegionId;
    const sourceRegion = selection.attackerPositionRegionId
        ? getPendingActionSourceForceSnapshot(state, {
            actionId: selection.actionId,
            battleMode: selection.battleMode,
            targetKind: selection.targetKind,
            attackerFactionId: selection.attackerFactionId,
            sourceRegionId: selection.sourceRegionId,
            sourceRegionName: selection.sourceRegionName,
            attackerPositionRegionId: selection.attackerPositionRegionId,
            targetRegionId: selection.targetRegionId,
            targetRegionName: selection.targetRegionName,
            targetRuntimeRegionId: selection.targetRuntimeRegionId,
            defenderFactionId: selection.originalController,
            defenderLabel: selection.originalControlLabel,
            restriction: '',
            battleWidth: selection.survivingTroops,
            boundaryUnitCap: null,
            sourceAvailableTroops: selection.committedTroops,
            committedTroops: selection.committedTroops,
            movementProfileId: selection.movementProfileId,
            attackPressure: selection.survivingTroops,
            attackBoundaryType: 'plain',
            resolutionHint: '',
            defenderPayCost: null,
        })
        : (() => {
            const sourceRuntimeRegion = runtimeRegions.find((region) => region.id === sourceRemovalRegionId) ?? null;
            return sourceRuntimeRegion ? materializeNonSiegedCityActionSourceRegion(sourceRuntimeRegion) : null;
        })();
    const survivingSpecialTroops = getSurvivingCommittedSpecialTroops(
        sourceRegion,
        selection.committedTroops,
        selection.attackerLosses,
        selection.movementProfileId,
        selection.attackerCasualtyPriority,
    );
    const nextRuntimeRegions = runtimeRegions.map((region) => {
        if (region.id === sourceRemovalRegionId && sourceRemovalRegionId !== selection.targetRuntimeRegionId) {
            const sourceActionRegion = materializeNonSiegedCityActionSourceRegion(region);
            if (choice.mode === 'occupy' || choice.mode === 'besiege') {
                return applyCommittedTroopRemovalToRegion({
                    ...sourceActionRegion,
                    troops: Math.max(0, sourceActionRegion.troops - selection.committedTroops),
                    note: `${sourceActionRegion.name} 战后派出 ${selection.survivingTroops} 个幸存部队${choice.mode === 'occupy' ? '占领' : '围困'} ${selection.targetRegionName}。`,
                }, selection.committedTroops, selection.movementProfileId);
            }
            if (choice.mode === 'withdraw' && withdrawRegionId === sourceRemovalRegionId) {
                return applyCasualtyPriorityToRegion({
                    ...sourceActionRegion,
                    troops: Math.max(0, sourceActionRegion.troops - selection.attackerLosses),
                    note: `${sourceActionRegion.name} 战后回收幸存部队，但损失 ${selection.attackerLosses} 个部队。`,
                }, selection.attackerLosses, selection.movementProfileId, selection.attackerCasualtyPriority);
            }
            if (choice.mode === 'withdraw' && withdrawRegionId !== sourceRemovalRegionId) {
                return applyCommittedTroopRemovalToRegion({
                    ...sourceActionRegion,
                    troops: Math.max(0, sourceActionRegion.troops - selection.committedTroops),
                    note: `${sourceActionRegion.name} 战后撤出 ${selection.survivingTroops} 个幸存部队，改退回 ${state.regions.find((item) => item.id === withdrawRegionId)?.name ?? '友方区域'}。`,
                }, selection.committedTroops, selection.movementProfileId);
            }
            return region;
        }
        if (region.id === selection.targetRuntimeRegionId) {
            if (selection.targetKind === 'siege-attacker') {
                const relievedRegion = {
                    ...region,
                    controller: selection.originalController,
                    controlLabel: selection.originalControlLabel,
                    troops: selection.survivingTroops,
                    specialTroops: survivingSpecialTroops,
                    siegeState: null,
                    note: `${region.name} 围城已解除，${selection.survivingTroops} 个幸存援军进驻城外。`,
                };
                return {
                    ...relievedRegion,
                    controlLabel: getRegionControlLabel(relievedRegion),
                };
            }
            if (choice.mode === 'occupy') {
                const occupiedRegion = {
                    ...region,
                    controller: selection.attackerFactionId,
                    diplomacyMarkerFaction: selection.originalController === 'neutral' ? selection.attackerFactionId : null,
                    diplomacyMarkerSide: selection.originalController === 'neutral' ? 'vassal' as const : null,
                    population: occupiedPopulation,
                    troops: selection.survivingTroops,
                    siegeState: null,
                    cityState: null,
                    specialTroops: survivingSpecialTroops,
                    note: `${region.name} 被攻下后由 ${selection.originalController === 'neutral' ? `${toFactionLabel(selection.attackerFactionId)}附庸` : toFactionLabel(selection.attackerFactionId)} 占领，并进驻 ${selection.survivingTroops} 个幸存部队${plunderPopulation > 0 ? `，劫掠移除 ${plunderPopulation} 人口` : ''}。`,
                };
                return {
                    ...occupiedRegion,
                    controlLabel: getRegionControlLabel(occupiedRegion),
                };
            }
            if (choice.mode === 'besiege') {
                const besiegedRegion = {
                    ...region,
                    population: besiegedOutsidePopulation,
                    troops: 0,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: selection.attackerFactionId,
                        attackerTroops: selection.survivingTroops,
                        attackerSpecialTroops: survivingSpecialTroops,
                        sourceRegionId: selection.sourceRegionId,
                    },
                    cityState: isQidahenCityRuntimeRegion(region.id)
                        ? {
                            troops: preservedCityState?.troops ?? 0,
                            population: besiegedCityPopulation,
                            specialTroops: preservedCityState?.specialTroops ?? [],
                        }
                        : null,
                    note: `${region.name} 仍由${toFactionLabel(selection.originalController)}控制，但已被${toFactionLabel(selection.attackerFactionId)}围城；围城兵力 ${selection.survivingTroops}${plunderPopulation > 0 ? `，城外人口被劫掠 ${plunderPopulation}` : ''}。`,
                };
                return {
                    ...besiegedRegion,
                    controlLabel: getRegionControlLabel(besiegedRegion),
                };
            }
            const resetRegion = {
                ...region,
                controller: selection.originalController,
                diplomacyMarkerFaction: null,
                diplomacyMarkerSide: null,
                population: battleMode === 'city' && isQidahenCityRuntimeRegion(region.id) ? 0 : Math.max(0, region.population - plunderPopulation),
                troops: 0,
                siegeState: null,
                cityState: battleMode === 'city' && isQidahenCityRuntimeRegion(region.id)
                    ? {
                        troops: preservedCityState?.troops ?? 0,
                        population: withdrawnCityPopulation,
                        specialTroops: preservedCityState?.specialTroops ?? [],
                    }
                    : null,
                specialTroops: [],
                note: `${region.name} 守军溃散，但攻方选择不占领并战后回退${plunderPopulation > 0 ? `，劫掠移除 ${plunderPopulation} 人口` : ''}。`,
            };
            return {
                ...resetRegion,
                controlLabel: getRegionControlLabel(resetRegion),
            };
        }
        if (choice.mode === 'withdraw' && region.id === withdrawRegionId && withdrawRegionId !== sourceRemovalRegionId) {
            if (region.siegeState?.attackerFactionId === selection.attackerFactionId) {
                return {
                    ...region,
                    siegeState: {
                        ...region.siegeState,
                        attackerTroops: region.siegeState.attackerTroops + selection.survivingTroops,
                        attackerSpecialTroops: mergeSpecialTroopStacks([
                            ...region.siegeState.attackerSpecialTroops,
                            ...survivingSpecialTroops,
                        ]),
                    },
                    note: `${region.name} 在战后接收 ${selection.survivingTroops} 个撤回围城增援部队。`,
                };
            }
            const actionWithdrawRegion = materializeNonSiegedCityActionSourceRegion(region);
            return addSpecialTroopStacksToRegion({
                ...actionWithdrawRegion,
                troops: actionWithdrawRegion.troops + selection.survivingTroops,
                note: `${actionWithdrawRegion.name} 在战后接收 ${selection.survivingTroops} 个撤回部队。`,
            }, survivingSpecialTroops);
        }
        return region;
    });

    const nextRegions = refreshRuntimeRegionRules(nextRuntimeRegions, state.fortifications);
    const plunderDrawResult = drawFromFactionPile(
        state.factions,
        plunderSourceFactionId,
        plunderDrawCards,
        plunderDiscardGain,
    );
    const nextFactions = addFactionHandCards(
        plunderDrawResult.factions,
        selection.attackerFactionId,
        plunderHandGain,
    );
    const koreaOccupationCards = choice.mode === 'occupy'
        ? getEffectiveKoreaTributeCardsForFaction(state, selection.attackerFactionId, selection.targetRuntimeRegionId)
        : 0;
    const koreaDrawResult = drawKoreaCardsForFaction(
        nextFactions,
        state.koreaDeckCount,
        selection.attackerFactionId,
        koreaOccupationCards,
    );
    const koreaText = koreaDrawResult.drawnCards > 0
        ? `，攻陷朝鲜区域并抽朝鲜牌 ${koreaDrawResult.drawnCards} 张`
        : '';
    const selectedRegionId = choice.mode === 'withdraw'
        ? withdrawRegionId ?? selection.targetRuntimeRegionId
        : selection.targetRuntimeRegionId;
    return {
        regions: nextRegions,
        mapTokens: syncControlTokensFromRegions(state.mapTokens, nextRegions),
        factions: koreaDrawResult.factions,
        koreaDeckCount: koreaDrawResult.koreaDeckCount,
        drawPileCount: plunderSourceFactionId === 'ming' ? state.drawPileCount - plunderDrawCards : state.drawPileCount,
        discardPileCount: state.discardPileCount + plunderDiscardGain,
        handCards: buildDrawnHandCards(state, selection.attackerFactionId, plunderHandGain),
        selectedRegionId,
        logText: choice.mode === 'occupy'
            ? `${state.factions[selection.attackerFactionId].name} 战后占领 ${selection.targetRegionName}${plunderText ? `，${plunderText}` : ''}${koreaText}。`
            : choice.mode === 'besiege'
                ? `${state.factions[selection.attackerFactionId].name} 战后围城 ${selection.targetRegionName}${plunderText ? `，${plunderText}` : ''}。`
                : `${state.factions[selection.attackerFactionId].name} 战后放弃占领，撤回 ${state.regions.find((region) => region.id === withdrawRegionId)?.name ?? selection.sourceRegionName}${plunderText ? `，${plunderText}` : ''}。`,
    };
};

const resolveDiplomacyChoice = (
    state: QidahenCore,
    actingFactionId: QidahenFactionId,
    selection: QidahenDiplomacySelection,
    choiceId: QidahenDiplomacyChoice['id'],
): Pick<QidahenCore, 'regions' | 'mapTokens' | 'factions'> & {
    logText: string;
    summaryLines: string[] | null;
    selectedRegionId: string;
    diplomacySelection: QidahenDiplomacySelection | null;
} => {
    const runtimeRegions = state.regions.filter((region) => !region.isLogicalRegion);
    const targetRegion = selection.targetRegionId
        ? runtimeRegions.find((region) => region.id === selection.targetRegionId) ?? null
        : null;
    let selectedRegionId = selection.hireRegionId ?? state.selectedRegionId;
    let nextFactions = {
        ...state.factions,
    };
    let nextRuntimeRegions = runtimeRegions.map((region) => ({
        ...region,
        specialTroops: region.specialTroops.map((stack) => ({ ...stack })),
    }));
    const resolvedSteps = selection.resolvedSteps.map((step) => ({ ...step }));

    const finalizeResolution = (
        finalizedRegions: typeof nextRuntimeRegions,
        finalizedFactions: typeof nextFactions,
        finalSelectedRegionId: string,
        finalResolvedSteps: QidahenDiplomacyResolvedStep[],
    ) => {
        const sourceName = selection.hireRegionName ?? selection.sourceRegionName ?? '当前控制区';
        const hiredRegions = finalizedRegions.map((region) => {
            if (region.id !== selection.hireRegionId) {
                return region;
            }
            const actionHireRegion = materializeNonSiegedCityActionSourceRegion(region);
            return addSpecialTroopStackToRegion({
                ...actionHireRegion,
                troops: actionHireRegion.troops + 2,
                note: `${actionHireRegion.name} 经${selection.title}建立 2 个等级 2 雇佣军。`,
            }, {
                id: `${actingFactionId}-mercenary-lv2`,
                label: '雇佣军',
                faction: actingFactionId,
                troopKind: 'infantry',
                count: 2,
                level: 2,
            });
        });
        const nextRegions = refreshRuntimeRegionRules(hiredRegions, state.fortifications);
        const summaryLines = [
            `${state.factions[actingFactionId].name} 在 ${sourceName} 建立 2 个等级 2 雇佣军。`,
            ...(finalResolvedSteps.length > 0
                ? finalResolvedSteps.map((step) => `外交 ${step.index}：${step.summary}`)
                : ['当前未对相邻区域执行外交标记。']),
        ];
        const nextFinalFactions = {
            ...finalizedFactions,
            [actingFactionId]: {
                ...finalizedFactions[actingFactionId],
                troops: finalizedFactions[actingFactionId].troops + 2,
            },
        };
        const finalLogTail = finalResolvedSteps.length > 0
            ? finalResolvedSteps.map((step) => `外交${step.index}${step.summary}`).join('；')
            : '未对相邻区域执行外交标记';
        return {
            selectedRegionId: finalSelectedRegionId,
            regions: nextRegions,
            mapTokens: syncControlTokensFromRegions(state.mapTokens, nextRegions),
            factions: nextFinalFactions,
            summaryLines,
            diplomacySelection: null,
            logText: `${state.factions[actingFactionId].name} 完成${selection.title}：${finalLogTail}。`,
        };
    };

    if (choiceId === 'hire-only') {
        return finalizeResolution(nextRuntimeRegions, nextFactions, selectedRegionId, resolvedSteps);
    }

    if (!targetRegion) {
        return finalizeResolution(nextRuntimeRegions, nextFactions, selectedRegionId, resolvedSteps);
    }

    selectedRegionId = targetRegion.id;
    let stepSummary = '';
    let removedMercenaryTroops = 0;
    nextRuntimeRegions = nextRuntimeRegions.map((region) => {
        if (region.id !== targetRegion.id) {
            return region;
        }
        if (choiceId === 'place-friendly') {
            stepSummary = `${targetRegion.name} 已放置 ${toFactionLabel(actingFactionId)}友好标记，可供通行与驻守。`;
            return {
                ...region,
                diplomacyMarkerFaction: actingFactionId,
                diplomacyMarkerSide: 'friendly',
                note: `${region.name} 经${selection.title}转为 ${toFactionLabel(actingFactionId)}友好区域。`,
            };
        }
        if (choiceId === 'flip-vassal') {
            stepSummary = `${targetRegion.name} 已翻为 ${toFactionLabel(actingFactionId)}附庸，并视为控制区域。`;
            return {
                ...region,
                controller: actingFactionId,
                diplomacyMarkerFaction: actingFactionId,
                diplomacyMarkerSide: 'vassal',
                note: `${region.name} 经${selection.title}转为 ${toFactionLabel(actingFactionId)}附庸。`,
            };
        }

        const initialController = getEffectiveHomelandController(state, region.id);
        const topLevelRemovedMercenaryTroops = region.diplomacyMarkerSide === 'friendly' ? getMercenaryTroopCount(region) : 0;
        const cityStateRemovedMercenaryTroops = region.diplomacyMarkerSide === 'friendly' && region.cityState
            ? getMercenaryTroopCount(region.cityState)
            : 0;
        removedMercenaryTroops = topLevelRemovedMercenaryTroops + cityStateRemovedMercenaryTroops;
        if (removedMercenaryTroops > 0 && region.diplomacyMarkerFaction) {
            nextFactions = {
                ...nextFactions,
                [region.diplomacyMarkerFaction]: {
                    ...nextFactions[region.diplomacyMarkerFaction],
                    troops: Math.max(0, nextFactions[region.diplomacyMarkerFaction].troops - removedMercenaryTroops),
                },
            };
        }
        const clearedRegion = {
            ...region,
            controller: initialController,
            diplomacyMarkerFaction: null,
            diplomacyMarkerSide: null,
            troops: Math.max(0, region.troops - topLevelRemovedMercenaryTroops),
            specialTroops: region.specialTroops.filter((stack) => !(stack.id.includes('mercenary') || stack.label === '雇佣军')),
            cityState: region.cityState
                ? {
                    ...region.cityState,
                    troops: Math.max(0, region.cityState.troops - cityStateRemovedMercenaryTroops),
                    specialTroops: region.cityState.specialTroops.filter((stack) => !(stack.id.includes('mercenary') || stack.label === '雇佣军')),
                }
                : null,
            note: removedMercenaryTroops > 0
                ? `${region.name} 的控制标记被移除，并连带移除了 ${removedMercenaryTroops} 个雇佣军。`
                : `${region.name} 的控制标记已被移除。`,
        };
        stepSummary = initialController === 'neutral'
            ? `${targetRegion.name} 的控制标记已移除，区域回到中立。${removedMercenaryTroops > 0 ? ` 并移除 ${removedMercenaryTroops} 个雇佣军。` : ''}`
            : `${targetRegion.name} 的控制标记已移除，区域回归 ${toFactionLabel(initialController)}本土。${removedMercenaryTroops > 0 ? ` 并移除 ${removedMercenaryTroops} 个雇佣军。` : ''}`;
        return clearedRegion;
    });

    const refreshedRegions = refreshRuntimeRegionRules(nextRuntimeRegions, state.fortifications);
    const nextResolvedSteps: QidahenDiplomacyResolvedStep[] = [
        ...resolvedSteps,
        {
            index: resolvedSteps.length + 1,
            targetRegionId: targetRegion.id,
            targetRegionName: targetRegion.name,
            choiceId,
            summary: stepSummary,
        },
    ];
    const remainingTargetCount = Math.max(0, selection.remainingTargetCount - 1);
    if (remainingTargetCount <= 0) {
        return finalizeResolution(
            refreshedRegions.filter((region) => !region.isLogicalRegion).map((region) => ({
                ...region,
                specialTroops: region.specialTroops.map((stack) => ({ ...stack })),
            })),
            nextFactions,
            selectedRegionId,
            nextResolvedSteps,
        );
    }

    const nextSelection = buildDiplomacySelection(
        {
            ...state,
            regions: refreshedRegions,
        },
        actingFactionId,
        targetRegion.id,
        selection.source,
        selection.sourceRegionId,
        {
            remainingTargetCount,
            resolvedSteps: nextResolvedSteps,
        },
    );
    const continuedSelection = nextSelection ?? {
        ...selection,
        targetRegionId: null,
        targetRegionName: null,
        targetHint: `当前还可执行 ${remainingTargetCount} 次外交操作，或直接结束并结算雇佣。`,
        choices: [{
            id: 'hire-only',
            label: '结束并结算雇佣',
            detail: `${selection.hireRegionName ?? selection.sourceRegionName ?? '当前控制区'} 建立 2 个等级 2 雇佣军，并结束本次外交。`,
        }],
        remainingTargetCount,
        resolvedSteps: nextResolvedSteps,
    };
    return {
        selectedRegionId,
        regions: refreshedRegions,
        mapTokens: syncControlTokensFromRegions(state.mapTokens, refreshedRegions),
        factions: nextFactions,
        summaryLines: null,
        diplomacySelection: continuedSelection,
        logText: `${state.factions[actingFactionId].name} 完成第 ${nextResolvedSteps.length} 次外交：${stepSummary} 当前还可继续 ${remainingTargetCount} 次，或直接结束结算雇佣。`,
    };
};

const applyRequestedCommittedTroops = (
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
    requestedCommittedTroops?: number,
): QidahenPendingTargetAction => {
    if (
        requestedCommittedTroops == null
        || !Number.isFinite(requestedCommittedTroops)
        || (pendingTargetAction.actionId !== 'raid' && pendingTargetAction.actionId !== 'wheel-dispatch' && pendingTargetAction.actionId !== 'drive-tiger')
    ) {
        return pendingTargetAction;
    }

    const sourceRegion = getPendingActionSourceForceSnapshot(state, pendingTargetAction);
    const sourceAvailableTroops = sourceRegion
        ? pendingTargetAction.movementProfileId
            ? getMovableTroopCountForProfile(sourceRegion, pendingTargetAction.movementProfileId as QidahenMovementProfileId)
            : sourceRegion.troops
        : pendingTargetAction.sourceAvailableTroops;
    const maxCommittedTroops = computeEffectiveCommittedTroops(state, {
        attackerFactionId: pendingTargetAction.attackerFactionId,
        actionId: pendingTargetAction.actionId,
        availableTroops: Math.min(pendingTargetAction.sourceAvailableTroops, sourceAvailableTroops),
        boundaryUnitCap: pendingTargetAction.boundaryUnitCap,
    });
    if (maxCommittedTroops <= 0) {
        return pendingTargetAction;
    }

    const committedTroops = Math.max(1, Math.min(Math.floor(requestedCommittedTroops), maxCommittedTroops));
    if (committedTroops === pendingTargetAction.committedTroops) {
        return pendingTargetAction;
    }

    const attackPressure = computeQidahenAttackPressure(committedTroops, pendingTargetAction.battleWidth);
    return {
        ...pendingTargetAction,
        committedTroops,
        attackPressure,
        resolutionHint: `${pendingTargetAction.resolutionHint} · 实投${committedTroops}/压${attackPressure}`,
    };
};

const resolvePendingTargetAction = (
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
    retreatLossMode: QidahenRetreatLossMode = 'rear-guard',
    defenderSortieBattle = false,
    defenderHoldCity = false,
    defenderCavalryEvasion = false,
    attackerCavalryPlunder = false,
    attackerCavalryPlunderSource: QidahenPlunderSource = 'attacker',
    defenderCavalryEvasionPreferredRegionId?: string,
    attackerCasualtyPriority: QidahenCasualtyPriority = 'highest-level',
    defenderCasualtyPriority: QidahenCasualtyPriority = 'highest-level',
    battleRolls?: QidahenBattleRolls | null,
): Pick<QidahenCore, 'regions' | 'mapTokens' | 'factions' | 'drawPileCount' | 'discardPileCount' | 'handCards'> & {
    logText: string;
    selectedRegionId: string;
    postBattleSelection: QidahenPostBattleSelection | null;
    pendingTargetAction: QidahenPendingTargetAction | null;
} => {
    const runtimeRegions = state.regions.filter((region) => !region.isLogicalRegion);
    let logText = `${state.factions[pendingTargetAction.attackerFactionId].name} 完成 ${pendingTargetAction.title}。`;
    let selectedRegionId = pendingTargetAction.targetRuntimeRegionId;
    let factions = state.factions;
    let postBattleSelection: QidahenPostBattleSelection | null = null;
    let sourceTroopLoss = 0;
    let attackerRetreatRearGuardLoss = 0;
    let attackerRetreatEffectText = '';
    let attackerRetreatSourceNoteText = '';
    let attackerRetreatSpecialTroops: QidahenSpecialTroopStack[] | null = null;
    let defenderRetreatRegionId: string | null = null;
    let defenderRetreatTroops = 0;
    let defenderRetreatSpecialTroops: QidahenSpecialTroopStack[] = [];
    let defenderCavalryEvasionRegionId: string | null = null;
    let defenderCavalryEvasionTroops = 0;
    let defenderCavalryEvasionSpecialTroops: QidahenSpecialTroopStack[] = [];
    let drawPileCount = state.drawPileCount;
    let discardPileCount = state.discardPileCount;
    let handCards = state.handCards;
    let continuedPendingTargetAction: QidahenPendingTargetAction | null = null;
    const sourceRemovalRegionId = getPendingActionAttackerPositionRegionId(pendingTargetAction);

    if (pendingTargetAction.targetKind === 'siege-reinforce') {
        const targetRegion = runtimeRegions.find((region) => region.id === pendingTargetAction.targetRuntimeRegionId) ?? null;
        const sourceRuntimeRegion = sourceRemovalRegionId
            ? (() => {
                const sourceRegion = runtimeRegions.find((region) => region.id === sourceRemovalRegionId) ?? null;
                return sourceRegion ? materializeNonSiegedCityActionSourceRegion(sourceRegion) : null;
            })()
            : null;
        const movedSpecialTroops = getSurvivingCommittedSpecialTroops(
            sourceRuntimeRegion,
            pendingTargetAction.committedTroops,
            0,
            pendingTargetAction.movementProfileId,
            attackerCasualtyPriority,
        );
        const reinforcedRuntimeRegions = runtimeRegions.map((region) => {
            if (sourceRemovalRegionId && region.id === sourceRemovalRegionId && sourceRemovalRegionId !== pendingTargetAction.targetRuntimeRegionId) {
                const actionSourceRegion = materializeNonSiegedCityActionSourceRegion(region);
                return applyCommittedTroopRemovalToRegion({
                    ...actionSourceRegion,
                    troops: Math.max(0, actionSourceRegion.troops - pendingTargetAction.committedTroops),
                    note: `${actionSourceRegion.name} 调度 ${pendingTargetAction.committedTroops} 个部队增援 ${pendingTargetAction.targetRegionName} 的围城。`,
                }, pendingTargetAction.committedTroops, pendingTargetAction.movementProfileId);
            }
            if (
                targetRegion
                && region.id === pendingTargetAction.targetRuntimeRegionId
                && region.siegeState
                && region.siegeState.attackerFactionId === pendingTargetAction.attackerFactionId
            ) {
                return {
                    ...region,
                    siegeState: {
                        ...region.siegeState,
                        attackerTroops: region.siegeState.attackerTroops + pendingTargetAction.committedTroops,
                        attackerSpecialTroops: mergeSpecialTroopStacks([
                            ...region.siegeState.attackerSpecialTroops,
                            ...movedSpecialTroops,
                        ]),
                    },
                    note: `${region.name} 获得 ${pendingTargetAction.committedTroops} 个围城增援，不进入战斗。`,
                };
            }
            return region;
        });
        logText = `${state.factions[pendingTargetAction.attackerFactionId].name} 自 ${pendingTargetAction.sourceRegionName ?? '前线'} 调度 ${pendingTargetAction.committedTroops} 个部队增援 ${pendingTargetAction.targetRegionName} 的围城，不进入战斗。`;
        const refreshedRegions = refreshRuntimeRegionRules(reinforcedRuntimeRegions, state.fortifications);
        return {
            regions: refreshedRegions,
            mapTokens: syncControlTokensFromRegions(state.mapTokens, refreshedRegions),
            factions,
            drawPileCount,
            discardPileCount,
            handCards,
            logText,
            selectedRegionId,
            postBattleSelection: null,
            pendingTargetAction: null,
        };
    }

    const nextRuntimeRegions = runtimeRegions.map((region) => {
        if (region.id !== pendingTargetAction.targetRuntimeRegionId) {
            return region;
        }

        if (pendingTargetAction.actionId === 'raid' || pendingTargetAction.actionId === 'wheel-dispatch' || pendingTargetAction.actionId === 'drive-tiger') {
            const verb = pendingTargetAction.actionId === 'raid'
                ? '突袭'
                : pendingTargetAction.actionId === 'drive-tiger'
                    ? '驱虎吞狼调度进攻'
                    : '调度进攻';
            const isCityRegion = resolveQidahenRuleRegionConfig(region.id).tags.includes('city');
            const cityHoldDefense = defenderHoldCity && isCityRegion
                ? (() => {
                    const shelteredPopulation = Math.min(2, region.population);
                    const defense = takePreferredCityGarrison(region, 2);
                    return {
                        ...defense,
                        shelteredPopulation,
                    };
                })()
                : null;
            const baseBattleRegion = cityHoldDefense
                ? {
                    ...region,
                    troops: cityHoldDefense.fieldTroops,
                    specialTroops: cityHoldDefense.fieldSpecialTroops,
                    population: Math.max(0, region.population - cityHoldDefense.shelteredPopulation),
                    note: `${region.name} 守城避战，将 ${cityHoldDefense.shelteredTroops} 个部队与 ${cityHoldDefense.shelteredPopulation} 人口收入城中。`,
                }
                : region;
            const cavalryEvasion = defenderCavalryEvasion
                ? getDefenderCavalryEvasion(state, baseBattleRegion, pendingTargetAction, defenderCavalryEvasionPreferredRegionId)
                : null;
            const cavalryEvasionText = cavalryEvasion
                ? `，守方骑兵避战 ${cavalryEvasion.troops} 撤至 ${cavalryEvasion.retreatRegion.name}`
                : '';
            if (cavalryEvasion) {
                defenderCavalryEvasionRegionId = cavalryEvasion.retreatRegion.id;
                defenderCavalryEvasionTroops = cavalryEvasion.troops;
                defenderCavalryEvasionSpecialTroops = cavalryEvasion.specialTroops;
            }
            const battleRegion = cavalryEvasion
                ? {
                    ...baseBattleRegion,
                    troops: Math.max(0, baseBattleRegion.troops - cavalryEvasion.troops),
                    specialTroops: baseBattleRegion.specialTroops
                        .map(normalizeSpecialTroopStack)
                        .filter((stack) => stack.troopKind !== 'cavalry'),
                    note: `${baseBattleRegion.name} 守方骑兵 ${cavalryEvasion.troops} 避战撤至 ${cavalryEvasion.retreatRegion.name}。`,
                }
                : baseBattleRegion;
            const currentBattleMode = resolvePendingBattleMode(pendingTargetAction, region, {
                defenderSortieBattle,
                defenderHoldCity,
            });
            const battleRegionSnapshot = getPendingActionDefenderForceSnapshot(battleRegion, pendingTargetAction, currentBattleMode);
            const neutralGarrisonTroops = pendingTargetAction.targetKind === 'siege-attacker'
                ? 0
                : getNeutralGarrisonTroops(battleRegion, currentBattleMode);
            const effectiveDefenderTroops = getEffectivePendingDefenderTroops(battleRegion, pendingTargetAction, currentBattleMode);
            if (effectiveDefenderTroops <= 0 && battleRegionSnapshot.troops <= 0) {
                if (pendingTargetAction.targetKind === 'siege-attacker') {
                    postBattleSelection = buildPostBattleSelection(state, pendingTargetAction, battleRegion, pendingTargetAction.committedTroops, 0, attackerCasualtyPriority);
                    logText = `${state.factions[pendingTargetAction.attackerFactionId].name} 自 ${pendingTargetAction.sourceRegionName ?? '前线'} ${verb} ${battleRegion.name} 解围，围城军已空，等待战后进驻。`;
                    return {
                        ...battleRegion,
                        note: `${battleRegion.name} 围城军已空，等待友军进驻解围。`,
                    };
                }
                if (cityHoldDefense && cityHoldDefense.shelteredTroops > 0) {
                    continuedPendingTargetAction = {
                        ...pendingTargetAction,
                        battleMode: 'city',
                        title: `${pendingTargetAction.targetRegionName} 城战待结算`,
                        restriction: `${pendingTargetAction.restriction} · 守城避战后直接攻城`,
                        resolutionHint: `${pendingTargetAction.targetRegionName} 守军避战入城 ${cityHoldDefense.shelteredTroops}，攻方继续城战`,
                    };
                    logText = `${state.factions[pendingTargetAction.attackerFactionId].name} 自 ${pendingTargetAction.sourceRegionName ?? '前线'} ${verb} ${battleRegion.name}，守方守城避战收入城中 ${cityHoldDefense.shelteredTroops} 部队与 ${cityHoldDefense.shelteredPopulation} 人口${cavalryEvasionText}，城外无守军，直接进入城战。`;
                    return {
                        ...battleRegion,
                        troops: 0,
                        cityState: {
                            troops: cityHoldDefense.shelteredTroops,
                            population: cityHoldDefense.shelteredPopulation,
                            specialTroops: cityHoldDefense.shelteredSpecialTroops,
                        },
                        specialTroops: [],
                        note: `${battleRegion.name} 守方守城避战后退入城市，直接进入城战。`,
                    };
                }
                postBattleSelection = buildPostBattleSelection(state, pendingTargetAction, battleRegion, pendingTargetAction.committedTroops, 0, attackerCasualtyPriority);
                logText = `${state.factions[pendingTargetAction.attackerFactionId].name} 自 ${pendingTargetAction.sourceRegionName ?? '前线'} ${verb} ${battleRegion.name}${cavalryEvasionText}，投入 ${pendingTargetAction.committedTroops} 部队，区域无守军，等待战后处理。`;
                return {
                    ...battleRegion,
                    troops: 0,
                    note: `${battleRegion.name} 在${verb}后守军已空${cavalryEvasionText}，等待决定是否占领。`,
                };
            }
            const sourceRegion = getPendingActionSourceForceSnapshot(state, pendingTargetAction);
            const isCityBattle = currentBattleMode === 'city';
            if (pendingTargetAction.targetKind === 'siege-attacker') {
                const committedArtilleryCount = getCommittedArtilleryTroopCount(
                    sourceRegion,
                    pendingTargetAction.committedTroops,
                    pendingTargetAction.movementProfileId,
                );
                const committedBattleTroops = Math.max(0, pendingTargetAction.committedTroops - committedArtilleryCount);
                const defenderPressure = Math.max(1, Math.min(effectiveDefenderTroops, pendingTargetAction.battleWidth));
                const fallbackDefenderLoss = effectiveDefenderTroops > 0
                    ? Math.max(1, Math.min(effectiveDefenderTroops, pendingTargetAction.attackPressure || pendingTargetAction.battleWidth))
                    : 0;
                const fallbackAttackerLoss = Math.max(0, Math.min(committedBattleTroops, defenderPressure));
                const casualties = computeStructuredBattleCasualties(
                    sourceRegion,
                    battleRegionSnapshot,
                    pendingTargetAction,
                    effectiveDefenderTroops,
                    defenderPressure,
                    fallbackDefenderLoss,
                    fallbackAttackerLoss,
                    battleRolls,
                );
                const loss = casualties.defenderLoss;
                const attackerLoss = casualties.attackerLoss;
                const survivingAttackers = Math.max(0, pendingTargetAction.committedTroops - attackerLoss);
                const survivingAttackersForBattle = Math.max(0, survivingAttackers - committedArtilleryCount);
                const remainingDefenderTroops = Math.max(0, effectiveDefenderTroops - loss);
                const survivingSiegeSpecialTroops = applyCasualtiesToSpecialStacks(
                    battleRegionSnapshot.specialTroops,
                    loss,
                    defenderCasualtyPriority,
                );
                const attackerWinsBattle = survivingAttackersForBattle > remainingDefenderTroops;
                const structuredBattleText = casualties.summary ? ` ${casualties.summary}` : '';
                if (attackerWinsBattle && survivingAttackersForBattle > 0) {
                    postBattleSelection = buildPostBattleSelection(state, pendingTargetAction, battleRegion, survivingAttackers, attackerLoss, attackerCasualtyPriority);
                    logText = `${state.factions[pendingTargetAction.attackerFactionId].name} 自 ${pendingTargetAction.sourceRegionName ?? '前线'} ${verb} ${battleRegion.name} 解围，投入 ${pendingTargetAction.committedTroops} 部队，损失 ${attackerLoss}，击溃围城军，幸存 ${survivingAttackers} 等待进驻。${structuredBattleText}`;
                    return {
                        ...battleRegion,
                        siegeState: {
                            ...battleRegion.siegeState!,
                            attackerTroops: remainingDefenderTroops,
                            attackerSpecialTroops: survivingSiegeSpecialTroops,
                        },
                        note: `${battleRegion.name} 围城军被击溃，等待友军进驻解围。`,
                    };
                }
                const attackerSkipsDefeatLoss = hasJinDefeatLossImmunity(state, pendingTargetAction.attackerFactionId);
                const structuredAttackerRout = retreatLossMode === 'rout' && !attackerSkipsDefeatLoss
                    ? computeStructuredAttackerRout(
                        sourceRegion,
                        pendingTargetAction.committedTroops,
                        attackerLoss,
                        pendingTargetAction.movementProfileId,
                        attackerCasualtyPriority,
                    )
                    : null;
                if (structuredAttackerRout) {
                    attackerRetreatRearGuardLoss = Math.max(0, structuredAttackerRout.troopLoss - attackerLoss);
                    sourceTroopLoss = structuredAttackerRout.troopLoss;
                    attackerRetreatSpecialTroops = structuredAttackerRout.specialTroops;
                    attackerRetreatEffectText = structuredAttackerRout.damagedTroops > 0
                        ? `，撤退溃败损伤 ${structuredAttackerRout.damagedTroops}`
                        : '';
                    attackerRetreatSourceNoteText = structuredAttackerRout.damagedTroops > 0
                        ? `，其中撤退溃败损伤 ${structuredAttackerRout.damagedTroops}`
                        : '';
                } else {
                    attackerRetreatRearGuardLoss = attackerSkipsDefeatLoss ? 0 : computeRetreatLoss(survivingAttackers, retreatLossMode);
                    sourceTroopLoss = attackerLoss + attackerRetreatRearGuardLoss;
                    attackerRetreatEffectText = attackerSkipsDefeatLoss
                        ? '，撤退不执行部队损失惩罚'
                        : attackerRetreatRearGuardLoss > 0
                            ? `，撤退${retreatLossMode === 'rout' ? '溃败' : '断后'}损失 ${attackerRetreatRearGuardLoss}`
                            : '';
                    attackerRetreatSourceNoteText = attackerSkipsDefeatLoss
                        ? ''
                        : attackerRetreatRearGuardLoss > 0
                            ? `，其中撤退${retreatLossMode === 'rout' ? '溃败' : '断后'} ${attackerRetreatRearGuardLoss}`
                            : '';
                }
                factions = addDefeatMarkerToFaction(factions, pendingTargetAction.attackerFactionId);
                logText = `${state.factions[pendingTargetAction.attackerFactionId].name} 自 ${pendingTargetAction.sourceRegionName ?? '前线'} ${verb} ${battleRegion.name} 解围失败，围城军减员 ${loss}，攻方损失 ${attackerLoss}${attackerRetreatEffectText}；${state.factions[pendingTargetAction.attackerFactionId].name} 获得 1 个战败标记。${structuredBattleText}`;
                return {
                    ...battleRegion,
                    siegeState: {
                        ...battleRegion.siegeState!,
                        attackerTroops: remainingDefenderTroops,
                        attackerSpecialTroops: survivingSiegeSpecialTroops,
                    },
                    note: `${battleRegion.name} 围城军仍在，解围失败。`,
                };
            }
            if (
                attackerCavalryPlunder
                && sourceRegion
                && !isCityBattle
                && !isQidahenKoreaRuntimeRegionId(battleRegion.id)
                && battleRegion.population > 0
            ) {
                const committedCavalryStacks = getCommittedCavalryTroopStacks(
                    sourceRegion,
                    pendingTargetAction.committedTroops,
                    pendingTargetAction.movementProfileId,
                );
                const committedCavalryTroops = getSpecialTroopCount({ specialTroops: committedCavalryStacks });
                if (committedCavalryTroops > 0) {
                    const counterPower = getCavalryPlunderCounterPower(battleRegion);
                    const cavalryLoss = Math.min(committedCavalryTroops, Math.ceil(counterPower / 3));
                    const survivingCavalry = Math.max(0, committedCavalryTroops - cavalryLoss);
                    const plunderPopulation = Math.min(survivingCavalry, battleRegion.population);
                    const canPlunderDefenderDeck = (
                        attackerCavalryPlunderSource === 'defender'
                        && pendingTargetAction.defenderFactionId !== 'neutral'
                        && pendingTargetAction.defenderFactionId !== pendingTargetAction.attackerFactionId
                    );
                    const plunderSourceFactionId = canPlunderDefenderDeck
                        ? pendingTargetAction.defenderFactionId
                        : pendingTargetAction.attackerFactionId;
                    const requestedCards = canPlunderDefenderDeck
                        ? plunderPopulation
                        : plunderPopulation * 2;
                    const availableCards = getFactionDrawPileCount(state, plunderSourceFactionId);
                    const drawCards = Math.min(requestedCards, availableCards);
                    const attackerDeckPlunderHandBonus = canPlunderDefenderDeck
                        ? 0
                        : getAttackerDeckPlunderHandBonus(state, pendingTargetAction.attackerFactionId, plunderPopulation);
                    const handGain = canPlunderDefenderDeck
                        ? drawCards
                        : Math.min(plunderPopulation + attackerDeckPlunderHandBonus, drawCards);
                    const discardGain = canPlunderDefenderDeck ? 0 : Math.max(0, drawCards - handGain);
                    const drawResult = drawFromFactionPile(
                        factions,
                        plunderSourceFactionId,
                        drawCards,
                        discardGain,
                    );

                    factions = addFactionHandCards(drawResult.factions, pendingTargetAction.attackerFactionId, handGain);
                    drawPileCount = plunderSourceFactionId === 'ming'
                        ? Math.max(0, state.drawPileCount - drawCards)
                        : state.drawPileCount;
                    discardPileCount = state.discardPileCount + discardGain;
                    handCards = buildDrawnHandCards(state, pendingTargetAction.attackerFactionId, handGain);
                    sourceTroopLoss = cavalryLoss;
                    postBattleSelection = null;
                    const plunderDeckText = canPlunderDefenderDeck
                        ? `抽${toFactionLabel(pendingTargetAction.defenderFactionId)}牌堆获得 ${handGain} 张手牌`
                        : `抽自己牌堆获得 ${handGain} 张手牌、弃牌堆 +${discardGain}${attackerDeckPlunderHandBonus > 0 ? '（含人物额外摸牌）' : ''}`;
                    logText = `${state.factions[pendingTargetAction.attackerFactionId].name} 自 ${pendingTargetAction.sourceRegionName ?? '前线'} 以 ${committedCavalryTroops} 个骑兵劫掠 ${battleRegion.name}，先承受守方炮骑反击损失 ${cavalryLoss}，幸存 ${survivingCavalry} 个骑兵劫掠 ${plunderPopulation} 人口，${plunderDeckText} 后撤回。`;

                    return {
                        ...battleRegion,
                        population: Math.max(0, battleRegion.population - plunderPopulation),
                        note: `${battleRegion.name} 遭骑兵劫掠，移除 ${plunderPopulation} 人口；守军仍留在原地。`,
                    };
                }
            }
            const defenderPressure = Math.max(1, Math.min(effectiveDefenderTroops, pendingTargetAction.battleWidth));
            const fallbackDefenderLoss = effectiveDefenderTroops > 0
                ? Math.max(1, Math.min(effectiveDefenderTroops, pendingTargetAction.attackPressure || pendingTargetAction.battleWidth))
                : 0;
            const committedArtilleryCount = getCommittedArtilleryTroopCount(
                sourceRegion,
                pendingTargetAction.committedTroops,
                pendingTargetAction.movementProfileId,
            );
            const committedBattleTroops = Math.max(0, pendingTargetAction.committedTroops - committedArtilleryCount);
            const fallbackAttackerLoss = Math.max(0, Math.min(committedBattleTroops, defenderPressure));
            const casualties = computeStructuredBattleCasualties(
                sourceRegion,
                battleRegionSnapshot,
                pendingTargetAction,
                effectiveDefenderTroops,
                defenderPressure,
                fallbackDefenderLoss,
                fallbackAttackerLoss,
                battleRolls,
            );
            const loss = casualties.defenderLoss;
            const attackerLoss = casualties.attackerLoss;
            const survivingAttackers = Math.max(0, pendingTargetAction.committedTroops - attackerLoss);
            const survivingAttackersForBattle = Math.max(0, survivingAttackers - committedArtilleryCount);
            const remainingBattleTroops = Math.max(0, effectiveDefenderTroops - loss);
            const remainingTroops = Math.max(0, battleRegionSnapshot.troops > 0 ? battleRegionSnapshot.troops - loss : remainingBattleTroops);
            const fieldSurvivingSpecialTroops = applyCasualtiesToSpecialStacks(
                battleRegionSnapshot.specialTroops,
                loss,
                defenderCasualtyPriority,
            );
            const attackerWinsBattle = survivingAttackersForBattle > remainingBattleTroops;
            const captured = battleRegion.controller !== pendingTargetAction.attackerFactionId && attackerWinsBattle && survivingAttackersForBattle > 0;
            const battleOutcomeText = `以 ${survivingAttackersForBattle} 比 ${remainingBattleTroops} 压倒守军`;
            const defeatMarkerFactionId: QidahenFactionId | null = isCityBattle
                ? null
                : captured && battleRegion.controller !== 'neutral'
                    ? battleRegion.controller
                    : !captured
                        ? pendingTargetAction.attackerFactionId
                        : null;
            const defeatMarkerText = defeatMarkerFactionId
                ? `；${state.factions[defeatMarkerFactionId].name} 获得 1 个战败标记`
                : '';
            const structuredBattleText = casualties.summary ? ` ${casualties.summary}` : '';
            const defenderCanRetreat = captured
                && remainingTroops > 0
                && battleRegion.controller !== 'neutral'
                && !isCityBattle
                && !(isCityRegion && defenderSortieBattle);
            const defenderRetreatRegion = defenderCanRetreat
                ? findAutoDefenderRetreatRegion(state, battleRegion, battleRegion.controller)
                : null;
            const defenderSkipsDefeatLoss = hasJinDefeatLossImmunity(state, battleRegion.controller);
            const structuredDefenderRout = defenderRetreatRegion && retreatLossMode === 'rout' && battleRegionSnapshot.specialTroops.length > 0 && !defenderSkipsDefeatLoss
                ? computeStructuredDefenderRout(battleRegionSnapshot, loss, remainingTroops, defenderCasualtyPriority)
                : null;
            const defenderRetreatLoss = defenderSkipsDefeatLoss
                ? 0
                : structuredDefenderRout
                ? structuredDefenderRout.troopLoss
                : defenderRetreatRegion
                    ? computeRetreatLoss(remainingTroops, retreatLossMode)
                    : 0;
            const defenderRetreatEffectText = defenderSkipsDefeatLoss
                ? '不执行部队损失惩罚'
                : structuredDefenderRout
                ? `溃败损伤 ${structuredDefenderRout.damagedTroops}`
                : `${retreatLossMode === 'rout' ? '溃败' : '断后'}损失 ${defenderRetreatLoss}`;
            const fallbackDefenderRetreatSurvivors = Math.max(0, remainingTroops - defenderRetreatLoss);
            const effectiveDefenderRetreatSurvivors = structuredDefenderRout
                ? structuredDefenderRout.survivingTroops
                : fallbackDefenderRetreatSurvivors;
            if (defenderRetreatRegion && effectiveDefenderRetreatSurvivors > 0) {
                const retreatSpecialTroops = structuredDefenderRout
                    ? structuredDefenderRout.specialTroops
                    : getSurvivingDefenderRetreatSpecialTroops(
                        battleRegionSnapshot,
                        loss,
                        defenderRetreatLoss,
                        defenderCasualtyPriority,
                    );
                const filteredRetreatForce = pruneUnsupportedRetreatArtillery(
                    retreatSpecialTroops,
                    effectiveDefenderRetreatSurvivors,
                );
                if (filteredRetreatForce.troops > 0) {
                    defenderRetreatRegionId = defenderRetreatRegion.id;
                    defenderRetreatTroops = filteredRetreatForce.troops;
                    defenderRetreatSpecialTroops = filteredRetreatForce.specialTroops;
                }
            }
            if (captured) {
                if (cityHoldDefense && cityHoldDefense.shelteredTroops + remainingTroops > 0) {
                    const cityDefenderTroops = cityHoldDefense.shelteredTroops + remainingTroops;
                    const cityDefenderSpecialTroops = mergeSpecialTroopStacks([
                        ...cityHoldDefense.shelteredSpecialTroops,
                        ...fieldSurvivingSpecialTroops,
                    ]);
                    continuedPendingTargetAction = {
                        ...pendingTargetAction,
                        battleMode: 'city',
                        title: `${pendingTargetAction.targetRegionName} 城战待结算`,
                        restriction: `${pendingTargetAction.restriction} · 守城避战后继续攻城`,
                        committedTroops: survivingAttackers,
                        sourceAvailableTroops: survivingAttackers,
                        attackPressure: computeQidahenAttackPressure(survivingAttackers, pendingTargetAction.battleWidth),
                        resolutionHint: `${pendingTargetAction.targetRegionName} 城外野战后仍有 ${cityDefenderTroops} 守军退回城市，攻方幸存 ${survivingAttackers} 继续攻城`,
                    };
                    logText = `${state.factions[pendingTargetAction.attackerFactionId].name} 自 ${pendingTargetAction.sourceRegionName ?? '前线'} ${verb} ${battleRegion.name}，守方守城避战收入城中 ${cityHoldDefense.shelteredTroops} 部队与 ${cityHoldDefense.shelteredPopulation} 人口${cavalryEvasionText}，投入 ${pendingTargetAction.committedTroops} 部队，损失 ${attackerLoss}，${battleOutcomeText}，城外守军残部 ${remainingTroops} 退回城市，攻方幸存 ${survivingAttackers} 继续攻城。${structuredBattleText}`;
                    return {
                        ...battleRegion,
                        troops: 0,
                        cityState: {
                            troops: cityDefenderTroops,
                            population: cityHoldDefense.shelteredPopulation,
                            specialTroops: cityDefenderSpecialTroops,
                        },
                        specialTroops: [],
                        note: `${battleRegion.name} 守方守城避战后，城外残部退回城市；攻方继续攻城。`,
                    };
                }
                if (isCityRegion && defenderSortieBattle) {
                    continuedPendingTargetAction = {
                        ...pendingTargetAction,
                        battleMode: 'city',
                        title: `${pendingTargetAction.targetRegionName} 城战待结算`,
                        restriction: `${pendingTargetAction.restriction} · 守军出城野战后继续攻城`,
                        committedTroops: survivingAttackers,
                        sourceAvailableTroops: survivingAttackers,
                        attackPressure: computeQidahenAttackPressure(survivingAttackers, pendingTargetAction.battleWidth),
                        resolutionHint: `${pendingTargetAction.targetRegionName} 守军出城野战后退入城市，攻方幸存 ${survivingAttackers} 继续攻城`,
                    };
                } else {
                    postBattleSelection = buildPostBattleSelection(state, pendingTargetAction, battleRegion, survivingAttackers, attackerLoss, attackerCasualtyPriority);
                }
            } else {
                const attackerSkipsDefeatLoss = hasJinDefeatLossImmunity(state, pendingTargetAction.attackerFactionId);
                const structuredAttackerRout = retreatLossMode === 'rout' && !attackerSkipsDefeatLoss
                    ? computeStructuredAttackerRout(
                        sourceRegion,
                        pendingTargetAction.committedTroops,
                        attackerLoss,
                        pendingTargetAction.movementProfileId,
                        attackerCasualtyPriority,
                    )
                    : null;
                if (structuredAttackerRout) {
                    attackerRetreatRearGuardLoss = Math.max(0, structuredAttackerRout.troopLoss - attackerLoss);
                    sourceTroopLoss = structuredAttackerRout.troopLoss;
                    attackerRetreatSpecialTroops = structuredAttackerRout.specialTroops;
                    attackerRetreatEffectText = structuredAttackerRout.damagedTroops > 0
                        ? `，撤退溃败损伤 ${structuredAttackerRout.damagedTroops}`
                        : '';
                    attackerRetreatSourceNoteText = structuredAttackerRout.damagedTroops > 0
                        ? `，其中撤退溃败损伤 ${structuredAttackerRout.damagedTroops}`
                        : '';
                } else {
                    attackerRetreatRearGuardLoss = attackerSkipsDefeatLoss
                        ? 0
                        : computeRetreatLoss(survivingAttackers, retreatLossMode);
                    sourceTroopLoss = attackerLoss + attackerRetreatRearGuardLoss;
                    attackerRetreatEffectText = attackerSkipsDefeatLoss
                        ? '，撤退不执行部队损失惩罚'
                        : attackerRetreatRearGuardLoss > 0
                        ? `，撤退${retreatLossMode === 'rout' ? '溃败' : '断后'}损失 ${attackerRetreatRearGuardLoss}`
                        : '';
                    attackerRetreatSourceNoteText = attackerSkipsDefeatLoss
                        ? ''
                        : attackerRetreatRearGuardLoss > 0
                        ? `，其中撤退${retreatLossMode === 'rout' ? '溃败' : '断后'} ${attackerRetreatRearGuardLoss}`
                        : '';
                }
            }
            if (defeatMarkerFactionId) {
                factions = addDefeatMarkerToFaction(factions, defeatMarkerFactionId);
            }
            logText = captured
                ? isCityRegion && defenderSortieBattle
                    ? `${state.factions[pendingTargetAction.attackerFactionId].name} 自 ${pendingTargetAction.sourceRegionName ?? '前线'} ${verb} ${battleRegion.name}，守军出城野战${cavalryEvasionText}，投入 ${pendingTargetAction.committedTroops} 部队，损失 ${attackerLoss}，${battleOutcomeText}${remainingTroops > 0 ? `，守军残部 ${remainingTroops} 退回城市` : '，守军城外部队全灭'}，攻方幸存 ${survivingAttackers} 继续攻城${defeatMarkerText}。${structuredBattleText}`
                    : `${state.factions[pendingTargetAction.attackerFactionId].name} 自 ${pendingTargetAction.sourceRegionName ?? '前线'} ${verb} ${battleRegion.name}${cavalryEvasionText}，投入 ${pendingTargetAction.committedTroops} 部队，损失 ${attackerLoss}，${battleOutcomeText}${defenderRetreatRegion ? `，守军${defenderRetreatEffectText} 后${defenderRetreatTroops > 0 ? `撤至 ${defenderRetreatRegion.name}` : '无残部可撤'}` : remainingTroops > 0 && isCityBattle ? '，城中守军全灭' : remainingTroops > 0 ? '，守军无处可退被歼灭' : ''}后等待战后处理${defeatMarkerText}。${structuredBattleText}`
                : `${state.factions[pendingTargetAction.attackerFactionId].name} 自 ${pendingTargetAction.sourceRegionName ?? '前线'} ${verb} ${battleRegion.name}${cavalryEvasionText}，投入 ${pendingTargetAction.committedTroops} 部队，守军减员 ${loss}，攻方损失 ${attackerLoss}${attackerRetreatEffectText}${defeatMarkerText}。${structuredBattleText}`;
            if (cityHoldDefense && !captured) {
                return {
                    ...battleRegion,
                    troops: remainingTroops,
                    cityState: {
                        troops: cityHoldDefense.shelteredTroops,
                        population: cityHoldDefense.shelteredPopulation,
                        specialTroops: cityHoldDefense.shelteredSpecialTroops,
                    },
                    specialTroops: fieldSurvivingSpecialTroops,
                    note: `${battleRegion.name} 守方守城避战后，城内仍有 ${cityHoldDefense.shelteredTroops} 部队与 ${cityHoldDefense.shelteredPopulation} 人口；城外野战后剩余 ${remainingTroops} 部队继续守住该区。`,
                };
            }
            if (captured && isCityRegion && defenderSortieBattle) {
                return {
                    ...battleRegion,
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: remainingTroops,
                        population: battleRegion.population,
                        specialTroops: fieldSurvivingSpecialTroops,
                    },
                    note: `${battleRegion.name} 的守军出城野战后${remainingTroops > 0 ? `残余 ${remainingTroops} 个部队退回城市` : '城外部队全灭'}；攻方继续攻城。`,
                };
            }
            if (currentBattleMode === 'city') {
                const startedWithCityState = battleRegion.cityState != null;
                const waitingCityState = {
                    troops: 0,
                    population: battleRegionSnapshot.population,
                    specialTroops: [],
                };
                return {
                    ...battleRegion,
                    troops: captured
                        ? startedWithCityState ? battleRegion.troops : 0
                        : startedWithCityState ? battleRegion.troops : remainingTroops,
                    population: captured && !startedWithCityState ? 0 : battleRegion.population,
                    specialTroops: captured
                        ? startedWithCityState ? battleRegion.specialTroops : []
                        : startedWithCityState ? battleRegion.specialTroops : fieldSurvivingSpecialTroops,
                    cityState: captured
                        ? waitingCityState
                        : startedWithCityState
                            ? {
                                troops: remainingTroops,
                                population: battleRegionSnapshot.population,
                                specialTroops: fieldSurvivingSpecialTroops,
                            }
                            : null,
                    note: captured
                        ? remainingTroops > 0
                            ? `${battleRegion.name} 虽仍有 ${remainingTroops} 个守军残部，但因城战战败被全部移除；攻方等待决定是否占领。`
                            : `${battleRegion.name} 被${verb}突破${cavalryEvasionText}，等待决定是否占领。`
                        : `${battleRegion.name} 城中守军减少 ${loss}，攻方损失 ${attackerLoss}${attackerRetreatEffectText}。`,
                };
            }
            return applyCasualtyPriorityToRegion({
                ...battleRegion,
                troops: captured
                    ? isCityRegion && defenderSortieBattle
                        ? remainingTroops
                        : 0
                    : remainingTroops,
                specialTroops: captured
                    ? isCityRegion && defenderSortieBattle
                        ? applyCasualtiesToSpecialStacks(battleRegion.specialTroops, loss, defenderCasualtyPriority)
                        : []
                    : battleRegion.specialTroops,
                controller: captured ? battleRegion.controller : battleRegion.controller,
                controlLabel: captured ? battleRegion.controlLabel : battleRegion.controlLabel,
                note: captured
                    ? isCityRegion && defenderSortieBattle
                        ? `${battleRegion.name} 的守军出城野战后${remainingTroops > 0 ? `残余 ${remainingTroops} 个部队退回城市` : '城外部队全灭'}；攻方继续攻城。`
                        : remainingTroops > 0
                            ? defenderRetreatRegion
                                ? `${battleRegion.name} 的守军虽仍有 ${remainingTroops} 个部队，但兵力劣势${cavalryEvasionText}，撤退${defenderRetreatEffectText} 后${defenderRetreatTroops > 0 ? `撤退至 ${defenderRetreatRegion.name}` : '无残部可撤'}；攻方等待决定是否占领。`
                                : isCityBattle
                                    ? `${battleRegion.name} 虽仍有 ${remainingTroops} 个守军残部，但因城战战败被全部移除；攻方等待决定是否占领。`
                                    : `${battleRegion.name} 的守军虽仍有 ${remainingTroops} 个部队，但兵力劣势且无处可退，被全部移除；攻方等待决定是否占领。`
                            : `${battleRegion.name} 被${verb}突破${cavalryEvasionText}，等待决定是否占领。`
                    : neutralGarrisonTroops > 0 && battleRegion.troops <= 0
                        ? `${battleRegion.name} 因人口临时建立 ${neutralGarrisonTroops} 个中立守军，并在${verb}后剩余 ${remainingTroops}。`
                        : `${battleRegion.name} 在${verb}后守军减少 ${loss}${cavalryEvasionText}，攻方损失 ${attackerLoss}${attackerRetreatEffectText}。`,
            }, captured ? effectiveDefenderTroops : loss, null, defenderCasualtyPriority);
        }

        const defenderFactionId = pendingTargetAction.defenderFactionId;
        const actionTargetRegion = materializeNonSiegedCityActionSourceRegion(region);
        const requiredPayCost = pendingTargetAction.defenderPayCost ?? 0;
        const defenderPays = defenderFactionId !== 'neutral'
            && (requiredPayCost === 0 || state.factions[defenderFactionId].handCount >= requiredPayCost);

        if (defenderPays && defenderFactionId !== 'neutral') {
            factions = {
                ...factions,
                [defenderFactionId]: {
                    ...factions[defenderFactionId],
                    handCount: Math.max(0, factions[defenderFactionId].handCount - requiredPayCost),
                },
            };
            logText = `${region.controlLabel} 支付 ${requiredPayCost} 张手牌，守住 ${region.name}。`;
            return {
                ...region,
                note: `${region.name} 面对联姻诱降后支付代价维持控制。`,
            };
        }

        const convertedTroops = actionTargetRegion.troops > 0 ? 1 : 0;
        if (defenderFactionId !== 'neutral' && actionTargetRegion.troops > 0) {
            factions = {
                ...factions,
                [defenderFactionId]: {
                    ...factions[defenderFactionId],
                    troops: Math.max(0, factions[defenderFactionId].troops - actionTargetRegion.troops),
                },
                [pendingTargetAction.attackerFactionId]: {
                    ...factions[pendingTargetAction.attackerFactionId],
                    troops: factions[pendingTargetAction.attackerFactionId].troops + convertedTroops,
                },
            };
        }

        logText = `${state.factions[pendingTargetAction.attackerFactionId].name} 对 ${region.name} 发动联姻诱降，守军未能支付代价，区域改由其控制，并有 ${convertedTroops} 个部队转为其麾下。`;
        const convertedRegion = {
            ...actionTargetRegion,
            controller: pendingTargetAction.attackerFactionId,
            diplomacyMarkerFaction: null,
            diplomacyMarkerSide: null,
            troops: convertedTroops,
            specialTroops: [],
            note: convertedTroops > 0
                ? `${actionTargetRegion.name} 联姻失败后原守军全灭，仅余 1 个部队转为 ${toFactionLabel(pendingTargetAction.attackerFactionId)}。`
                : `${actionTargetRegion.name} 联姻失败后改由 ${toFactionLabel(pendingTargetAction.attackerFactionId)} 控制。`,
        };
        return {
            ...convertedRegion,
            controlLabel: getRegionControlLabel(convertedRegion),
        };
    });
    const adjustedRuntimeRegions = nextRuntimeRegions.map((region) => {
        if ((sourceTroopLoss > 0 || attackerRetreatSpecialTroops) && sourceRemovalRegionId && region.id === sourceRemovalRegionId) {
            if (
                pendingTargetAction.attackerPositionRegionId
                && region.id === pendingTargetAction.attackerPositionRegionId
                && region.siegeState?.attackerFactionId === pendingTargetAction.attackerFactionId
            ) {
                const siegeSourceRegion = {
                    ...region,
                    controller: pendingTargetAction.attackerFactionId,
                    troops: Math.max(0, region.siegeState.attackerTroops - sourceTroopLoss),
                    specialTroops: region.siegeState.attackerSpecialTroops,
                    note: `${region.name} 在${pendingTargetAction.actionId === 'raid' ? '突袭' : pendingTargetAction.actionId === 'drive-tiger' ? '驱虎吞狼调度进攻' : '调度进攻'}后损失 ${sourceTroopLoss} 个围城部队${attackerRetreatSourceNoteText}。`,
                };
                const lostSiegeSourceRegion = attackerRetreatSpecialTroops
                    ? {
                        ...siegeSourceRegion,
                        specialTroops: attackerRetreatSpecialTroops,
                    }
                    : applyCasualtyPriorityToRegion(
                        siegeSourceRegion,
                        sourceTroopLoss,
                        pendingTargetAction.movementProfileId,
                        attackerCasualtyPriority,
                    );
                const filteredRetreatForce = pruneUnsupportedRetreatArtillery(lostSiegeSourceRegion.specialTroops, lostSiegeSourceRegion.troops);
                return {
                    ...region,
                    note: lostSiegeSourceRegion.note,
                    siegeState: {
                        ...region.siegeState,
                        attackerTroops: filteredRetreatForce.troops,
                        attackerSpecialTroops: filteredRetreatForce.specialTroops,
                    },
                };
            }
            const baseLostRegion = {
                ...materializeNonSiegedCityActionSourceRegion(region),
                troops: Math.max(0, materializeNonSiegedCityActionSourceRegion(region).troops - sourceTroopLoss),
                note: `${region.name} 在${pendingTargetAction.actionId === 'raid' ? '突袭' : pendingTargetAction.actionId === 'drive-tiger' ? '驱虎吞狼调度进攻' : '调度进攻'}后损失 ${sourceTroopLoss} 个部队${attackerRetreatSourceNoteText}。`,
            };
            const lostRegion = attackerRetreatSpecialTroops
                ? {
                    ...baseLostRegion,
                    specialTroops: attackerRetreatSpecialTroops,
                }
                : applyCasualtyPriorityToRegion(
                    baseLostRegion,
                    sourceTroopLoss,
                    pendingTargetAction.movementProfileId,
                    attackerCasualtyPriority,
                );
            const filteredRetreatForce = pruneUnsupportedRetreatArtillery(lostRegion.specialTroops, lostRegion.troops);
            return {
                ...lostRegion,
                troops: filteredRetreatForce.troops,
                specialTroops: filteredRetreatForce.specialTroops,
            };
        }
        let nextRegion = region;
        if (defenderCavalryEvasionRegionId && defenderCavalryEvasionTroops > 0 && nextRegion.id === defenderCavalryEvasionRegionId) {
            const actionRetreatRegion = materializeNonSiegedCityActionSourceRegion(nextRegion);
            nextRegion = addTroopsToFriendlyBesiegedCityInterior(
                actionRetreatRegion,
                defenderCavalryEvasionTroops,
                defenderCavalryEvasionSpecialTroops,
                `${actionRetreatRegion.name} 接收 ${defenderCavalryEvasionTroops} 个避战骑兵。`,
            );
        }
        if (defenderRetreatRegionId && defenderRetreatTroops > 0 && region.id === defenderRetreatRegionId) {
            const actionRetreatRegion = materializeNonSiegedCityActionSourceRegion(nextRegion);
            nextRegion = addTroopsToFriendlyBesiegedCityInterior(
                actionRetreatRegion,
                defenderRetreatTroops,
                defenderRetreatSpecialTroops,
                `${actionRetreatRegion.name} 在相邻战场接收 ${defenderRetreatTroops} 个撤退守军。`,
            );
        }
        return nextRegion;
    });

    if (!continuedPendingTargetAction && !postBattleSelection && sourceRemovalRegionId && sourceTroopLoss > 0) {
        selectedRegionId = sourceRemovalRegionId;
    }

    const nextRegions = refreshRuntimeRegionRules(adjustedRuntimeRegions, state.fortifications);
    return {
        regions: nextRegions,
        mapTokens: syncControlTokensFromRegions(state.mapTokens, nextRegions),
        factions,
        drawPileCount,
        discardPileCount,
        handCards,
        logText,
        selectedRegionId,
        postBattleSelection,
        pendingTargetAction: continuedPendingTargetAction,
    };
};

const advanceTurnIfReady = (state: QidahenCore, timestamp: number): QidahenCore => {
    if (
        state.pendingTargetAction
        || state.postBattleSelection
        || state.recruitSelection
        || state.maShiTradeSelection
        || state.khanEdictSelection
        || state.diplomacySelection
        || state.fortificationMaintenanceSelection
        || state.handLimitDiscardSelection
        || state.gaoDiDispatchSelection
        || state.internalDispatchSelection
        || state.wheelDispatchSelection
        || !state.wheelActionUsed
        || !isFactionActionTurnComplete(state)
    ) {
        return updateTurnLabel(state);
    }

    const factionTurnOrder = getActiveFactionTurnOrder(state);
    const currentFactionId = getCurrentFactionId(state);
    const isImmediatePostNewYear = state.actionWheelPosition === 'wheel-new-year' && state.currentYearIndex > 0;
    const currentIndex = Math.max(0, factionTurnOrder.indexOf(currentFactionId));
    const nextFactionId = isImmediatePostNewYear
        ? factionTurnOrder[0]
        : factionTurnOrder[(currentIndex + 1) % factionTurnOrder.length];
    const wrapped = isImmediatePostNewYear || currentIndex === factionTurnOrder.length - 1;
    const roundNumber = wrapped ? state.roundNumber + 1 : state.roundNumber;
    const selectedActionId = getDefaultActionIdForFaction(nextFactionId);
    const nextState = {
        ...state,
        currentPlayer: state.factions[nextFactionId].playerId,
        roundNumber,
        turnPhase: 'action-window' as const,
        wheelActionUsed: false,
        factionActionUsed: false,
        bonusFactionActionAvailable: false,
        bonusFactionActionUsed: false,
        lastFactionActionId: null,
        selectedWheelMoveId: 'move-1-free',
        wheelMoveSummary: buildWheelMoveSummary('move-1-free'),
        selectedRegionId: getPreferredActionWindowSelectedRegionIdForFaction(state, nextFactionId),
        selectedActionId,
        selectedPaymentCardIds: [],
        recruitSelection: null,
        maShiTradeSelection: null,
        khanEdictSelection: null,
        diplomacySelection: null,
        driveTigerConsentSelection: null,
        fortificationMaintenanceSelection: null,
        handLimitDiscardSelection: null,
        sunYuanhuaTechSelection: null,
        gaoDiDispatchSelection: null,
        internalDispatchSelection: null,
        wheelDispatchSelection: null,
        pendingTargetAction: null,
        postBattleSelection: null,
        lastCharacterActionWindowTriggerKey: null,
        actionChoices: getActionChoicesForFaction(nextFactionId),
        payment: buildPaymentState(selectedActionId, 0),
        actionLog: [
            {
                id: `log-turn-${timestamp}`,
                faction: nextFactionId,
                text: `轮到 ${state.factions[nextFactionId].name} 行动。`,
            },
            ...state.actionLog,
        ].slice(0, 6),
    };
    return updateTurnLabel(beginHandLimitDiscardIfNeeded(nextState, nextFactionId, timestamp));
};

const createInitialCore = (playerIds: PlayerId[]): QidahenCore => {
    const normalizedPlayerIds = factionOrder.map((_, index) => playerIds[index] ?? String(index));
    const fortifications = createInitialFortifications();
    const regions = refreshRuntimeRegionRules(createRuntimeRegionSummaries(), fortifications);
    const currentYearIndex = 0;
    const factions: QidahenCore['factions'] = {
        ming: createFactionState('ming', normalizedPlayerIds[0], '大明', 'bg-[#8f2f24]', 0, 18, 12, 70),
        mongol: createFactionState('mongol', normalizedPlayerIds[1], '蒙古', 'bg-[#6f4c24]', 1, 16, 10, 65),
        jin: createFactionState('jin', normalizedPlayerIds[2], '后金', 'bg-[#244c6f]', 0, 17, 11, 75),
    };
    const currentFactionOrder = getFactionOrderForYearIndex(currentYearIndex);

    return {
        playerIds: normalizedPlayerIds,
        currentFactionOrder,
        currentPlayer: normalizedPlayerIds[0],
        roundNumber: 1,
        currentYearIndex,
        currentYear: getYearLabelByIndex(currentYearIndex),
        turnLabel: buildTurnLabel(1, '大明', 'action-window', false, false),
        turnPhase: 'action-window',
        wheelActionUsed: false,
        factionActionUsed: false,
        bonusFactionActionAvailable: false,
        bonusFactionActionUsed: false,
        lastFactionActionId: null,
        actionWheelPosition: 'wheel-military-farm',
        selectedWheelMoveId: 'move-2-one-opponent',
        wheelMoveChoices,
        wheelMoveSummary: buildWheelMoveSummary('move-2-one-opponent'),
        selectedRegionId: 'song-jin',
        selectedActionId: 'grant-pardon',
        selectedPaymentCardIds: [],
        recruitSelection: null,
        maShiTradeSelection: null,
        khanEdictSelection: null,
        diplomacySelection: null,
        driveTigerConsentSelection: null,
        fortificationMaintenanceSelection: null,
        handLimitDiscardSelection: null,
        gaoDiDispatchSelection: null,
        internalDispatchSelection: null,
        wheelDispatchSelection: null,
        pendingTargetAction: null,
        postBattleSelection: null,
        lastCharacterActionWindowTriggerKey: null,
        lastSeasonSummary: null,
        hanseongPrestigeUnlocked: false,
        victoryStatus: null,
        factions,
        regions,
        fortifications,
        actionChoices: getActionChoicesForFaction('ming'),
        yearCards: buildYearCardSlots(currentYearIndex),
        payment: buildPaymentState('grant-pardon'),
        koreaDeckCount: 12,
        koreaDiscardCount: 5,
        koreaDiscardPreviewRef: qidahenKoreaSpecialPreview(0),
        drawPileCount: 20,
        discardPileCount: 7,
        handCards: buildInitialHandCards(factions),
        mapTokens: [
            { id: 'jinzhou-pop', x: 0.628, y: 0.497, type: 'population', faction: 'neutral', value: 2 },
            { id: 'jinzhou-control', x: 0.647, y: 0.47, type: 'control', faction: 'jin', imageSrc: 'qidahen/markers/jin-control-diplomacy-marker-a', size: 29 },
            { id: 'changbai-control', x: 0.892, y: 0.285, type: 'control', faction: 'jin', imageSrc: 'qidahen/markers/jin-control-diplomacy-marker-a', size: 29 },
            { id: 'changbai-army', x: 0.876, y: 0.27, type: 'army', faction: 'jin', size: 32, value: 2 },
            { id: 'changbai-pop', x: 0.908, y: 0.27, type: 'population', faction: 'neutral', value: 2 },
            { id: 'jianzhou-control', x: 0.798, y: 0.34, type: 'control', faction: 'jin', imageSrc: 'qidahen/markers/jin-control-diplomacy-marker-a', size: 29 },
            { id: 'jianzhou-army', x: 0.782, y: 0.326, type: 'army', faction: 'jin', size: 34, value: 3 },
            { id: 'jianzhou-pop', x: 0.814, y: 0.326, type: 'population', faction: 'neutral', value: 2 },
            { id: 'chahar-control', x: 0.458, y: 0.4, type: 'control', faction: 'mongol', imageSrc: 'qidahen/markers/mongol-control-diplomacy-marker-a', size: 29 },
            { id: 'chahar-army', x: 0.442, y: 0.386, type: 'army', faction: 'mongol', size: 34, value: 3 },
            { id: 'chahar-pop', x: 0.474, y: 0.386, type: 'population', faction: 'neutral', value: 3 },
            { id: 'songjin-control', x: 0.592, y: 0.611, type: 'control', faction: 'ming', imageSrc: 'qidahen/markers/ming-control-diplomacy-marker-a', size: 29 },
            { id: 'songjin-army', x: 0.566, y: 0.632, type: 'army', faction: 'ming', imageSrc: 'qidahen/units/ming-regular-infantry-unit', size: 34, value: 2 },
            { id: 'shanhaiguan-army', x: 0.535, y: 0.59, type: 'army', faction: 'ming', imageSrc: 'qidahen/units/ming-regular-cavalry-unit', size: 34, value: 2 },
            { id: 'shoucheng-army', x: 0.863, y: 0.662, type: 'army', faction: 'ming', imageSrc: 'qidahen/units/ming-regular-infantry-unit', size: 36, value: 3 },
            { id: 'xianxing-army-1', x: 0.844, y: 0.545, type: 'army', faction: 'ming', imageSrc: 'qidahen/units/ming-regular-infantry-unit', size: 34, value: 3 },
            { id: 'xianxing-army-2', x: 0.883, y: 0.498, type: 'army', faction: 'ming', imageSrc: 'qidahen/units/ming-regular-infantry-unit', size: 34, value: 3 },
        ],
        routeLines: [
            {
                id: 'ming-route',
                tone: 'blue',
                points: [
                    { x: 0.57, y: 0.63 },
                    { x: 0.57, y: 0.73 },
                    { x: 0.76, y: 0.73 },
                    { x: 0.76, y: 0.64 },
                    { x: 0.845, y: 0.64 },
                ],
            },
            {
                id: 'target-route',
                tone: 'red',
                points: [
                    { x: 0.89, y: 0.40 },
                    { x: 0.86, y: 0.47 },
                    { x: 0.84, y: 0.55 },
                    { x: 0.84, y: 0.66 },
                ],
            },
        ],
        actionLog: [
            { id: 'log-1', faction: 'ming', text: '大明 进入势力行动并锁定赐印招安。' },
            { id: 'log-2', faction: 'jin', text: '后金 在 沿海据点 维持前线兵力。' },
        ],
    };
};

const now = () => Date.now();

export const QidahenDomain: DomainCore<QidahenCore, QidahenCommand, QidahenEvent> = {
    gameId: 'qidahen',

    setup: (playerIds: PlayerId[], _random: RandomFn): QidahenCore => createInitialCore(playerIds),

    validate,

    execute: (_state, command, _random): QidahenEvent[] => {
        switch (command.type) {
            case QIDAHEN_COMMANDS.SELECT_REGION:
                return [{
                    type: 'REGION_SELECTED',
                    payload: {
                        regionId: command.payload.regionId,
                        playerId: command.playerId,
                    },
                    sourceCommandType: command.type,
                    timestamp: now(),
                }];
            case QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION:
                return [{
                    type: 'PREVIEW_ACTION_CONFIRMED',
                    payload: {
                        actionId: command.payload.actionId,
                        playerId: command.playerId,
                    },
                    sourceCommandType: command.type,
                    timestamp: now(),
                }];
            case QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE:
                return [{
                    type: 'WHEEL_MOVE_SELECTED',
                    payload: {
                        moveId: command.payload.moveId,
                        playerId: command.playerId,
                    },
                    sourceCommandType: command.type,
                    timestamp: now(),
                }];
            case QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE:
                return [{
                    type: 'WHEEL_MOVE_EXECUTED',
                    payload: {
                        moveId: command.payload.moveId,
                        playerId: command.playerId,
                    },
                    sourceCommandType: command.type,
                    timestamp: now(),
                }];
            case QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD:
                return [{
                    type: 'PAYMENT_CARD_SELECTED',
                    payload: {
                        cardId: command.payload.cardId,
                        playerId: command.playerId,
                    },
                    sourceCommandType: command.type,
                    timestamp: now(),
                }];
            case QIDAHEN_COMMANDS.SELECT_HAND_LIMIT_DISCARD_CARD:
                return [{
                    type: 'HAND_LIMIT_DISCARD_CARD_SELECTED',
                    payload: {
                        cardId: command.payload.cardId,
                        playerId: command.playerId,
                    },
                    sourceCommandType: command.type,
                    timestamp: now(),
                }];
            case QIDAHEN_COMMANDS.SELECT_SUN_YUANHUA_TECH_CARD:
                return [{
                    type: 'SUN_YUANHUA_TECH_CARD_SELECTED',
                    payload: {
                        cardId: command.payload.cardId,
                        playerId: command.playerId,
                    },
                    sourceCommandType: command.type,
                    timestamp: now(),
                }];
            case QIDAHEN_COMMANDS.SELECT_GAO_DI_DISPATCH_CARD:
                return [{
                    type: 'GAO_DI_DISPATCH_CARD_SELECTED',
                    payload: {
                        cardId: command.payload.cardId,
                        playerId: command.playerId,
                    },
                    sourceCommandType: command.type,
                    timestamp: now(),
                }];
            case QIDAHEN_COMMANDS.RESOLVE_HAND_LIMIT_DISCARD:
                return [{
                    type: 'HAND_LIMIT_DISCARD_RESOLVED',
                    payload: {
                        playerId: command.playerId,
                    },
                    sourceCommandType: command.type,
                    timestamp: now(),
                }];
            case QIDAHEN_COMMANDS.RESOLVE_SUN_YUANHUA_TECH:
                return [{
                    type: 'SUN_YUANHUA_TECH_RESOLVED',
                    payload: {
                        playerId: command.playerId,
                        choiceId: command.payload.choiceId,
                    },
                    sourceCommandType: command.type,
                    timestamp: now(),
                }];
            case QIDAHEN_COMMANDS.RESOLVE_GAO_DI_DISPATCH:
                return [{
                    type: 'GAO_DI_DISPATCH_RESOLVED',
                    payload: {
                        playerId: command.playerId,
                        choiceId: command.payload.choiceId,
                    },
                    sourceCommandType: command.type,
                    timestamp: now(),
                }];
            case QIDAHEN_COMMANDS.RESOLVE_INTERNAL_DISPATCH:
                return [{
                    type: 'INTERNAL_DISPATCH_RESOLVED',
                    payload: {
                        playerId: command.playerId,
                        choiceId: command.payload.choiceId,
                    },
                    sourceCommandType: command.type,
                    timestamp: now(),
                }];
            case QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION:
                return [{
                    type: 'SELECTED_ACTION_EXECUTED',
                    payload: {
                        actionId: _state.core.selectedActionId,
                        cardIds: _state.core.selectedPaymentCardIds,
                        playerId: command.playerId,
                    },
                    sourceCommandType: command.type,
                    timestamp: now(),
                }];
            case QIDAHEN_COMMANDS.EXECUTE_ACTION:
                return [{
                    type: 'SELECTED_ACTION_EXECUTED',
                    payload: {
                        actionId: command.payload.actionId,
                        cardIds: getAutoPaymentCardIds(_state.core, command.payload.actionId),
                        playerId: command.playerId,
                    },
                    sourceCommandType: command.type,
                    timestamp: now(),
                }];
            case QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION: {
                const pendingTargetAction = _state.core.pendingTargetAction
                    ? applyRequestedCommittedTroops(
                        _state.core,
                        _state.core.pendingTargetAction,
                        command.payload.committedTroops,
                    )
                    : null;
                return [{
                    type: 'PENDING_ACTION_RESOLVED',
                    payload: {
                        playerId: command.playerId,
                        committedTroops: command.payload.committedTroops,
                        retreatLossMode: command.payload.retreatLossMode,
                        defenderSortieBattle: command.payload.defenderSortieBattle,
                        defenderHoldCity: command.payload.defenderHoldCity,
                        defenderCavalryEvasion: command.payload.defenderCavalryEvasion,
                        defenderCavalryEvasionRegionId: command.payload.defenderCavalryEvasionRegionId,
                        attackerCavalryPlunder: command.payload.attackerCavalryPlunder,
                        attackerCavalryPlunderSource: command.payload.attackerCavalryPlunderSource,
                        attackerCasualtyPriority: command.payload.attackerCasualtyPriority,
                        defenderCasualtyPriority: command.payload.defenderCasualtyPriority,
                        battleRolls: pendingTargetAction
                            ? createStructuredBattleRolls(_state.core, pendingTargetAction, _random, {
                                defenderSortieBattle: command.payload.defenderSortieBattle,
                                defenderHoldCity: command.payload.defenderHoldCity,
                                defenderCavalryEvasion: command.payload.defenderCavalryEvasion,
                                attackerCavalryPlunder: command.payload.attackerCavalryPlunder,
                            })
                            : null,
                    },
                    sourceCommandType: command.type,
                    timestamp: now(),
                }];
            }
            case QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION:
                return [{
                    type: 'POST_BATTLE_DECISION_RESOLVED',
                    payload: {
                        playerId: command.playerId,
                        choiceId: command.payload.choiceId,
                    },
                    sourceCommandType: command.type,
                    timestamp: now(),
                }];
            case QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE:
                return [{
                    type: 'KHAN_EDICT_CHOICE_RESOLVED',
                    payload: {
                        playerId: command.playerId,
                        choiceId: command.payload.choiceId,
                    },
                    sourceCommandType: command.type,
                    timestamp: now(),
                }];
            case QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE:
                return [{
                    type: 'DIPLOMACY_CHOICE_RESOLVED',
                    payload: {
                        playerId: command.playerId,
                        choiceId: command.payload.choiceId,
                    },
                    sourceCommandType: command.type,
                    timestamp: now(),
                }];
            case QIDAHEN_COMMANDS.RESOLVE_MA_SHI_TRADE_CHOICE:
                return [{
                    type: 'MA_SHI_TRADE_CHOICE_RESOLVED',
                    payload: {
                        playerId: command.playerId,
                        troopCount: command.payload.troopCount,
                    },
                    sourceCommandType: command.type,
                    timestamp: now(),
                }];
            case QIDAHEN_COMMANDS.RESOLVE_DRIVE_TIGER_CONSENT:
                return [{
                    type: 'DRIVE_TIGER_CONSENT_RESOLVED',
                    payload: {
                        playerId: command.playerId,
                        choiceId: command.payload.choiceId,
                    },
                    sourceCommandType: command.type,
                    timestamp: now(),
                }];
            case QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE:
                return [{
                    type: 'RECRUIT_CHOICE_RESOLVED',
                    payload: {
                        playerId: command.playerId,
                        choiceId: command.payload.choiceId,
                    },
                    sourceCommandType: command.type,
                    timestamp: now(),
                }];
            case QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE:
                return [{
                    type: 'FORTIFICATION_MAINTENANCE_RESOLVED',
                    payload: {
                        playerId: command.playerId,
                        choiceId: command.payload.choiceId,
                        attritionPriority: command.payload.attritionPriority,
                    },
                    sourceCommandType: command.type,
                    timestamp: now(),
                }];
            default:
                return [];
        }
    },

    reduce: (state, event): QidahenCore => {
        switch (event.type) {
            case 'REGION_SELECTED': {
                const actionWindowEffect = state.turnPhase === 'action-window'
                    ? applyCharacterActionWindowEffectsWithFocus(state)
                    : { state, forcedSelectedRegionId: null };
                const nextState = actionWindowEffect.state;
                let selectedRegionId = event.payload.regionId;
                if (nextState.recruitSelection) {
                    const rebuiltRecruitSelection = buildRecruitSelection(nextState, selectedRegionId, getCurrentFactionId(nextState));
                    selectedRegionId = rebuiltRecruitSelection?.targetRegionId ?? selectedRegionId;
                    return updateTurnLabel({
                        ...nextState,
                        selectedRegionId,
                        turnPhase: rebuiltRecruitSelection ? 'recruit-choice' : 'action-window',
                        recruitSelection: rebuiltRecruitSelection,
                    });
                }
                if (nextState.gaoDiDispatchSelection) {
                    const rebuiltGaoDiDispatchSelection = buildGaoDiDispatchSelection(
                        nextState,
                        selectedRegionId,
                        nextState.gaoDiDispatchSelection.selectedCardId,
                    );
                    return updateTurnLabel({
                        ...nextState,
                        selectedRegionId: rebuiltGaoDiDispatchSelection?.sourceRegionId ?? selectedRegionId,
                        turnPhase: rebuiltGaoDiDispatchSelection ? 'gao-di-dispatch-choice' : 'action-window',
                        gaoDiDispatchSelection: rebuiltGaoDiDispatchSelection,
                    });
                }
                if (nextState.internalDispatchSelection) {
                    const rebuiltInternalDispatchSelection = buildWangHuazhenInternalDispatchSelection(nextState, selectedRegionId);
                    return updateTurnLabel({
                        ...nextState,
                        selectedRegionId: rebuiltInternalDispatchSelection?.sourceRegionId ?? selectedRegionId,
                        turnPhase: rebuiltInternalDispatchSelection ? 'internal-dispatch-choice' : 'action-window',
                        internalDispatchSelection: rebuiltInternalDispatchSelection,
                    });
                }
                if (nextState.maShiTradeSelection) {
                    const rebuiltMaShiTradeSelection = buildMaShiTradeSelection(nextState, selectedRegionId);
                    selectedRegionId = rebuiltMaShiTradeSelection?.targetRegionId ?? selectedRegionId;
                    return updateTurnLabel({
                        ...nextState,
                        selectedRegionId,
                        turnPhase: rebuiltMaShiTradeSelection ? 'ma-shi-trade-choice' : 'action-window',
                        maShiTradeSelection: rebuiltMaShiTradeSelection,
                    });
                }
                if (nextState.khanEdictSelection) {
                    const rebuiltKhanEdictSelection = buildKhanEdictSelection(nextState, getCurrentFactionId(nextState), selectedRegionId);
                    return updateTurnLabel({
                        ...nextState,
                        selectedRegionId: rebuiltKhanEdictSelection?.sourceRegionId ?? selectedRegionId,
                        turnPhase: rebuiltKhanEdictSelection ? 'khan-edict-choice' : 'action-window',
                        khanEdictSelection: rebuiltKhanEdictSelection,
                    });
                }
                if (nextState.diplomacySelection) {
                    const rebuiltDiplomacySelection = buildDiplomacySelection(
                        nextState,
                        getCurrentFactionId(nextState),
                        selectedRegionId,
                        nextState.diplomacySelection.source,
                        nextState.diplomacySelection.sourceRegionId,
                        {
                            remainingTargetCount: nextState.diplomacySelection.remainingTargetCount,
                            resolvedSteps: nextState.diplomacySelection.resolvedSteps,
                        },
                    );
                    return updateTurnLabel({
                        ...nextState,
                        selectedRegionId: rebuiltDiplomacySelection?.targetRegionId ?? selectedRegionId,
                        turnPhase: rebuiltDiplomacySelection ? 'diplomacy-choice' : 'action-window',
                        diplomacySelection: rebuiltDiplomacySelection,
                    });
                }
                if (nextState.handLimitDiscardSelection) {
                    return updateTurnLabel({
                        ...nextState,
                        selectedRegionId: nextState.selectedRegionId,
                        turnPhase: 'hand-limit-discard',
                    });
                }
                if (nextState.sunYuanhuaTechSelection) {
                    return updateTurnLabel({
                        ...nextState,
                        selectedRegionId: nextState.selectedRegionId,
                        turnPhase: 'sun-yuanhua-tech-choice',
                    });
                }
                if (nextState.fortificationMaintenanceSelection) {
                    return updateTurnLabel({
                        ...nextState,
                        selectedRegionId: nextState.selectedRegionId,
                        turnPhase: nextState.turnPhase,
                    });
                }
                if (nextState.pendingTargetAction) {
                    return updateTurnLabel({
                        ...nextState,
                        selectedRegionId: nextState.pendingTargetAction.targetRuntimeRegionId,
                        turnPhase: 'resolve-pending',
                    });
                }
                if (nextState.driveTigerConsentSelection) {
                    return updateTurnLabel({
                        ...nextState,
                        selectedRegionId: nextState.driveTigerConsentSelection.dispatchSelection.sourceRegionId,
                        turnPhase: 'drive-tiger-consent',
                    });
                }
                if (nextState.postBattleSelection) {
                    return updateTurnLabel({
                        ...nextState,
                        selectedRegionId: nextState.postBattleSelection.targetRuntimeRegionId,
                        turnPhase: 'post-battle-decision',
                    });
                }
                if (!nextState.wheelDispatchSelection) {
                    return updateTurnLabel({
                        ...nextState,
                        selectedRegionId: actionWindowEffect.forcedSelectedRegionId ?? selectedRegionId,
                    });
                }

                const chosenTargetRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(selectedRegionId);
                const chosenTarget = nextState.wheelDispatchSelection.candidates.find((candidate) => (
                    candidate.targetRuntimeRegionId === chosenTargetRuntimeRegionId
                    || candidate.targetRegionId === selectedRegionId
                ));
                if (chosenTarget) {
                    const pendingActionMeta = nextState.selectedActionId === 'drive-tiger'
                        ? {
                            actionId: 'drive-tiger' as const,
                            title: '驱虎吞狼待结算',
                        }
                        : {
                            actionId: 'wheel-dispatch' as const,
                            title: '调度进攻待结算',
                        };
                    const pendingTargetAction = buildPendingTargetActionFromWheelDispatchChoice(
                        nextState.wheelDispatchSelection,
                        chosenTarget,
                        pendingActionMeta,
                    );
                    return updateTurnLabel({
                        ...nextState,
                        selectedRegionId: chosenTarget.targetRegionId,
                        turnPhase: 'resolve-pending',
                        wheelDispatchSelection: null,
                        pendingTargetAction,
                        actionLog: [
                            {
                                id: `log-wheel-dispatch-target-${event.timestamp}`,
                                faction: nextState.selectedActionId === 'drive-tiger'
                                    ? getCurrentFactionId(nextState)
                                    : nextState.wheelDispatchSelection.attackerFactionId,
                                text: nextState.selectedActionId === 'drive-tiger'
                                    ? `${nextState.factions[getCurrentFactionId(nextState)].name} 为 ${nextState.factions[nextState.wheelDispatchSelection.attackerFactionId].name} 锁定调度目标 ${chosenTarget.targetRegionName}（${chosenTarget.resolutionHint}）。`
                                    : `${nextState.factions[nextState.wheelDispatchSelection.attackerFactionId].name} 锁定调度目标 ${chosenTarget.targetRegionName}（${chosenTarget.resolutionHint}）。`,
                            },
                            ...nextState.actionLog,
                        ].slice(0, 6),
                    });
                }

                const attackerFactionId = nextState.wheelDispatchSelection.attackerFactionId;
                const movementProfileId = nextState.wheelDispatchSelection.movementProfileId as QidahenMovementProfileId;
                const rebuiltSelection = nextState.selectedActionId === 'khan-edict'
                    ? buildKhanEdictDispatchSelection(nextState, attackerFactionId, selectedRegionId)
                    : nextState.selectedActionId === 'drive-tiger'
                        ? buildDriveTigerDispatchSelection(nextState, getCurrentFactionId(nextState), selectedRegionId)
                        : buildWheelDispatchSelection(
                            nextState,
                            attackerFactionId,
                            movementProfileId,
                            getPreferredDispatchSelectedRegionIdForFaction(
                                nextState,
                                attackerFactionId,
                                movementProfileId,
                                selectedRegionId,
                            ),
                        );
                if (rebuiltSelection) {
                    return updateTurnLabel({
                        ...nextState,
                        selectedRegionId: rebuiltSelection.sourceRegionId,
                        turnPhase: 'dispatch-targeting',
                        wheelDispatchSelection: rebuiltSelection,
                        pendingTargetAction: null,
                    });
                }

                return updateTurnLabel({
                    ...nextState,
                    selectedRegionId,
                });
            }
            case 'PREVIEW_ACTION_CONFIRMED':
                if (getActionChoiceById(event.payload.actionId)) {
                    const currentFactionId = getCurrentFactionId(state);
                    return updateTurnLabel({
                    ...state,
                    selectedActionId: event.payload.actionId,
                    selectedPaymentCardIds: [],
                        recruitSelection: null,
                        maShiTradeSelection: null,
                        khanEdictSelection: null,
                        diplomacySelection: null,
                        driveTigerConsentSelection: null,
                        fortificationMaintenanceSelection: null,
                        handLimitDiscardSelection: null,
                        gaoDiDispatchSelection: null,
                        internalDispatchSelection: null,
                        wheelDispatchSelection: null,
                        pendingTargetAction: null,
                        postBattleSelection: null,
                        payment: buildPaymentState(event.payload.actionId),
                        actionLog: [
                            {
                                id: `log-${event.timestamp}`,
                                faction: currentFactionId,
                                text: `${state.factions[currentFactionId].name} 选择势力行动：${getActionChoiceById(event.payload.actionId)?.label ?? event.payload.actionId}。`,
                            },
                            ...state.actionLog,
                        ].slice(0, 6),
                    });
                }
                return {
                    ...state,
                    actionWheelPosition: event.payload.actionId,
                };
            case 'WHEEL_MOVE_SELECTED': {
                const move = wheelMoveChoices.find((item) => item.id === event.payload.moveId);
                if (!move) return state;
                return updateTurnLabel({
                    ...state,
                    selectedWheelMoveId: move.id,
                    wheelMoveSummary: buildWheelMoveSummary(move.id),
                });
            }
            case 'WHEEL_MOVE_EXECUTED': {
                const move = wheelMoveChoices.find((item) => item.id === event.payload.moveId);
                if (!move) return state;
                const nextWheelPosition = advanceWheelPosition(state.actionWheelPosition, move.steps);
                let wheelDrawFactions = state.factions;
                let wheelDrawHandCards = state.handCards;
                if (move.steps >= 2) {
                    const mongolDraw = drawFromFactionPile(wheelDrawFactions, 'mongol', 2);
                    wheelDrawFactions = addFactionHandCards(mongolDraw.factions, 'mongol', mongolDraw.drawnCards);
                    wheelDrawHandCards = buildDrawnHandCards(
                        { ...state, factions: wheelDrawFactions, handCards: wheelDrawHandCards },
                        'mongol',
                        mongolDraw.drawnCards,
                    );
                }
                if (move.steps >= 3) {
                    const jinDraw = drawFromFactionPile(wheelDrawFactions, 'jin', 2);
                    wheelDrawFactions = addFactionHandCards(jinDraw.factions, 'jin', jinDraw.drawnCards);
                    wheelDrawHandCards = buildDrawnHandCards(
                        { ...state, factions: wheelDrawFactions, handCards: wheelDrawHandCards },
                        'jin',
                        jinDraw.drawnCards,
                    );
                }
                let nextState: QidahenCore = {
                        ...state,
                        selectedWheelMoveId: move.id,
                        wheelActionUsed: true,
                        actionWheelPosition: nextWheelPosition,
                        wheelMoveSummary: buildWheelMoveSummary(move.id),
                        lastSeasonSummary: null,
                        diplomacySelection: null,
                        driveTigerConsentSelection: null,
                        wheelDispatchSelection: null,
                        postBattleSelection: null,
                        factions: wheelDrawFactions,
                        handCards: wheelDrawHandCards,
                };
                if (nextWheelPosition === 'wheel-midyear') {
                    const midyearResolution = resolveMidyear(nextState, event.timestamp);
                    nextState = {
                        ...nextState,
                        factions: midyearResolution.factions,
                        lastSeasonSummary: midyearResolution.lastSeasonSummary,
                        actionLog: [
                            {
                                id: `log-midyear-${event.timestamp}`,
                                faction: getCurrentFactionId(nextState),
                                text: '轮盘停在年中，已执行土地税赋与人物判定摘要。',
                            },
                            ...state.actionLog,
                        ].slice(0, 6),
                    };
                } else if (nextWheelPosition === 'wheel-new-year') {
                    nextState = {
                        ...nextState,
                        turnPhase: 'season-resolution',
                        selectedRegionId: 'song-jin',
                        fortificationMaintenanceSelection: buildFortificationMaintenanceSelection(nextState),
                        lastSeasonSummary: buildSeasonSummary('新年结算', event.timestamp, [
                            '轮盘停在新年，等待大明选择防线维护方式。',
                            `大明当前手牌 ${nextState.factions.ming.handCount} 张。`,
                        ]),
                        actionLog: [
                            {
                                id: `log-new-year-${event.timestamp}`,
                                faction: getCurrentFactionId(nextState),
                                text: '轮盘停在新年，等待大明选择防线维护方式。',
                            },
                            ...state.actionLog,
                        ].slice(0, 6),
                    };
                }

                const currentFactionId = getCurrentFactionId(nextState);
                if (nextWheelPosition === 'wheel-attack') {
                    const diplomacySelection = buildDiplomacySelection(
                        nextState,
                        currentFactionId,
                        nextState.selectedRegionId,
                        'wheel-hire',
                    );
                    if (diplomacySelection) {
                        nextState = {
                            ...nextState,
                            selectedRegionId: diplomacySelection.sourceRegionId,
                            turnPhase: 'diplomacy-choice',
                            diplomacySelection,
                            actionLog: [
                                {
                                    id: `log-wheel-diplomacy-${event.timestamp}`,
                                    faction: currentFactionId,
                                    text: `${nextState.factions[currentFactionId].name} 轮盘进入外交/雇佣，当前源区 ${diplomacySelection.sourceRegionName ?? '未锁定'}，等待选择外交目标。`,
                                },
                                ...nextState.actionLog,
                            ].slice(0, 6),
                        };
                    } else {
                        nextState = {
                            ...nextState,
                            lastSeasonSummary: buildSeasonSummary('轮盘外交/雇佣', event.timestamp, [
                                `${nextState.factions[currentFactionId].name} 当前没有可执行外交/雇佣的己方控制区域。`,
                            ]),
                        };
                    }
                } else {
                    nextState = applyWheelImmediateEffect(
                        nextState,
                        currentFactionId,
                        nextWheelPosition,
                        event.timestamp,
                    );
                }

                const wheelDispatchSelection = buildWheelDispatchSelectionFromWheel(
                    nextState,
                    currentFactionId,
                    nextWheelPosition,
                    nextState.selectedRegionId,
                );
                if (wheelDispatchSelection) {
                    nextState = {
                        ...nextState,
                        selectedRegionId: wheelDispatchSelection.sourceRegionId,
                        turnPhase: 'dispatch-targeting',
                        wheelDispatchSelection,
                        pendingTargetAction: null,
                        actionLog: [
                            {
                                id: `log-wheel-dispatch-${event.timestamp}`,
                                faction: currentFactionId,
                                text: `${nextState.factions[currentFactionId].name} 轮盘进入进攻/调度，当前源区 ${wheelDispatchSelection.sourceRegionName} · ${wheelDispatchSelection.movementProfileLabel}，可选目标 ${wheelDispatchSelection.candidates.length} 个。`,
                            },
                            ...nextState.actionLog,
                        ].slice(0, 6),
                    };
                }

                return advanceTurnIfReady(
                    applyVictoryStatus(nextState, { allowHegemony: nextWheelPosition === 'wheel-new-year' }),
                    event.timestamp,
                );
            }
            case 'PAYMENT_CARD_SELECTED': {
                const selectedPaymentCardIds = togglePaymentCard(state, event.payload.cardId);
                return updateTurnLabel({
                    ...state,
                    selectedPaymentCardIds,
                    payment: buildPaymentState(state.selectedActionId, selectedPaymentCardIds.length),
                });
            }
            case 'HAND_LIMIT_DISCARD_CARD_SELECTED': {
                return updateTurnLabel({
                    ...state,
                    handLimitDiscardSelection: toggleHandLimitDiscardCard(state.handLimitDiscardSelection, event.payload.cardId),
                });
            }
            case 'SUN_YUANHUA_TECH_CARD_SELECTED': {
                return updateTurnLabel({
                    ...state,
                    sunYuanhuaTechSelection: toggleSunYuanhuaTechCard(state.sunYuanhuaTechSelection, event.payload.cardId),
                });
            }
            case 'GAO_DI_DISPATCH_CARD_SELECTED': {
                return updateTurnLabel({
                    ...state,
                    gaoDiDispatchSelection: toggleGaoDiDispatchCard(state.gaoDiDispatchSelection, event.payload.cardId),
                });
            }
            case 'HAND_LIMIT_DISCARD_RESOLVED':
                return resolveHandLimitDiscard(state, event.timestamp);
            case 'SUN_YUANHUA_TECH_RESOLVED': {
                if (!state.sunYuanhuaTechSelection) {
                    return state;
                }
                const currentFactionId = getFactionIdByPlayerId(state, event.payload.playerId);
                const resolution = resolveSunYuanhuaTech(state, state.sunYuanhuaTechSelection, event.payload.choiceId);
                const resolvedState = applyVictoryStatus({
                    ...state,
                    selectedRegionId: resolution.selectedRegionId,
                    turnPhase: 'action-window',
                    recruitSelection: null,
                    maShiTradeSelection: null,
                    khanEdictSelection: null,
                    diplomacySelection: null,
                    driveTigerConsentSelection: null,
                    fortificationMaintenanceSelection: null,
                    handLimitDiscardSelection: null,
                    sunYuanhuaTechSelection: null,
                    gaoDiDispatchSelection: null,
                    internalDispatchSelection: null,
                    wheelDispatchSelection: null,
                    pendingTargetAction: null,
                    postBattleSelection: null,
                    factions: resolution.factions,
                    handCards: resolution.handCards,
                    discardPileCount: resolution.discardPileCount,
                    lastSeasonSummary: buildSeasonSummary('孙元化弃牌科技', event.timestamp, resolution.summaryLines),
                    actionLog: [
                        {
                            id: `log-sun-yuanhua-tech-${event.timestamp}`,
                            faction: currentFactionId,
                            text: resolution.logText,
                        },
                        ...state.actionLog,
                    ].slice(0, 6),
                });
                return advanceTurnIfReady(syncFactionActionWindow(resolvedState, currentFactionId), event.timestamp);
            }
            case 'GAO_DI_DISPATCH_RESOLVED': {
                if (!state.gaoDiDispatchSelection) {
                    return state;
                }
                const currentFactionId = getFactionIdByPlayerId(state, event.payload.playerId);
                const resolution = resolveGaoDiDispatch(state, state.gaoDiDispatchSelection, event.payload.choiceId);
                const selectionTitle = state.gaoDiDispatchSelection.title;
                const resolvedState = applyVictoryStatus({
                    ...state,
                    selectedRegionId: resolution.selectedRegionId,
                    turnPhase: 'action-window',
                    recruitSelection: null,
                    maShiTradeSelection: null,
                    khanEdictSelection: null,
                    diplomacySelection: null,
                    driveTigerConsentSelection: null,
                    fortificationMaintenanceSelection: null,
                    handLimitDiscardSelection: null,
                    gaoDiDispatchSelection: null,
                    internalDispatchSelection: null,
                    wheelDispatchSelection: null,
                    pendingTargetAction: null,
                    postBattleSelection: null,
                    regions: resolution.regions,
                    mapTokens: resolution.mapTokens,
                    factions: resolution.factions,
                    handCards: resolution.handCards,
                    discardPileCount: resolution.discardPileCount,
                    lastSeasonSummary: buildSeasonSummary(selectionTitle, event.timestamp, resolution.summaryLines),
                    actionLog: [
                        {
                            id: `log-gao-di-dispatch-${event.timestamp}`,
                            faction: currentFactionId,
                            text: resolution.logText,
                        },
                        ...state.actionLog,
                    ].slice(0, 6),
                });
                return advanceTurnIfReady(syncFactionActionWindow(resolvedState, currentFactionId), event.timestamp);
            }
            case 'INTERNAL_DISPATCH_RESOLVED': {
                if (!state.internalDispatchSelection) {
                    return state;
                }
                const currentFactionId = getFactionIdByPlayerId(state, event.payload.playerId);
                const resolution = resolveInternalDispatch(state, state.internalDispatchSelection, event.payload.choiceId);
                const resolvedState = applyVictoryStatus({
                    ...state,
                    selectedRegionId: resolution.selectedRegionId,
                    turnPhase: 'action-window',
                    recruitSelection: null,
                    maShiTradeSelection: null,
                    khanEdictSelection: null,
                    diplomacySelection: null,
                    driveTigerConsentSelection: null,
                    fortificationMaintenanceSelection: null,
                    handLimitDiscardSelection: null,
                    gaoDiDispatchSelection: null,
                    internalDispatchSelection: null,
                    wheelDispatchSelection: null,
                    pendingTargetAction: null,
                    postBattleSelection: null,
                    regions: resolution.regions,
                    mapTokens: resolution.mapTokens,
                    factions: resolution.factions,
                    lastSeasonSummary: buildSeasonSummary(state.internalDispatchSelection.title, event.timestamp, resolution.summaryLines),
                    actionLog: [
                        {
                            id: `log-internal-dispatch-${event.timestamp}`,
                            faction: currentFactionId,
                            text: resolution.logText,
                        },
                        ...state.actionLog,
                    ].slice(0, 6),
                });
                return advanceTurnIfReady(syncFactionActionWindow(resolvedState, currentFactionId), event.timestamp);
            }
            case 'FORTIFICATION_MAINTENANCE_RESOLVED': {
                if (!state.fortificationMaintenanceSelection) {
                    return state;
                }
                const newYearResolution = resolveNewYear(
                    state,
                    event.timestamp,
                    event.payload.choiceId,
                    event.payload.attritionPriority,
                );
                const nextState = {
                    ...state,
                    turnPhase: 'action-window' as const,
                    currentYearIndex: newYearResolution.currentYearIndex,
                    currentYear: newYearResolution.currentYear,
                    currentFactionOrder: newYearResolution.currentFactionOrder,
                    yearCards: newYearResolution.yearCards,
                    factions: newYearResolution.factions,
                    regions: newYearResolution.regions,
                    mapTokens: newYearResolution.mapTokens,
                    fortifications: newYearResolution.fortifications,
                    koreaDeckCount: newYearResolution.koreaDeckCount,
                    fortificationMaintenanceSelection: null,
                    lastSeasonSummary: newYearResolution.lastSeasonSummary,
                    actionLog: [
                        {
                            id: `log-new-year-${event.timestamp}`,
                            faction: getCurrentFactionId(state),
                            text: `大明选择${event.payload.choiceId === 'skip-all' ? '放弃维护全部防线' : '尽量维护防线'}，已执行新年结算。`,
                        },
                        ...state.actionLog,
                    ].slice(0, 6),
                };
                return advanceTurnIfReady(
                    applyVictoryStatus(nextState, { allowHegemony: true }),
                    event.timestamp,
                );
            }
            case 'SELECTED_ACTION_EXECUTED': {
                const currentFactionId = getFactionIdByPlayerId(state, event.payload.playerId);
                const currentFactionCardIds = new Set(
                    state.handCards
                        .filter((card) => card.faction === currentFactionId)
                        .map((card) => card.id),
                );
                const spentCardIds = event.payload.cardIds.filter((cardId) => currentFactionCardIds.has(cardId));
                const selectedCardIds = new Set(spentCardIds);
                const spentCardCount = spentCardIds.length;
                const actionLabel = getActionChoiceById(event.payload.actionId)?.label ?? event.payload.actionId;
                const selectedRegion = state.regions.find((region) => region.id === state.selectedRegionId);
                const marriageSubjugationBlockedReason = event.payload.actionId === 'marriage-subjugation'
                    ? getMarriageSubjugationBlockedReason(state, selectedRegion)
                    : null;
                if (marriageSubjugationBlockedReason) {
                    return updateTurnLabel({
                        ...state,
                        lastSeasonSummary: buildSeasonSummary('联姻诱降', event.timestamp, [
                            marriageSubjugationBlockedReason,
                        ]),
                        actionLog: [
                            {
                                id: `log-${event.timestamp}`,
                                faction: currentFactionId,
                                text: `${state.factions[currentFactionId].name} 尝试执行 ${actionLabel}，但 ${marriageSubjugationBlockedReason}`,
                            },
                            ...state.actionLog,
                        ].slice(0, 6),
                    });
                }
                const selectedRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(state.selectedRegionId);
                const recruitSelection = event.payload.actionId === 'recruit'
                    ? buildRecruitSelection(state, state.selectedRegionId, currentFactionId)
                    : null;
                const maShiTradeSelection = event.payload.actionId === 'ma-shi-trade'
                    ? buildMaShiTradeSelection(state, state.selectedRegionId)
                    : null;
                const khanEdictSelection = event.payload.actionId === 'khan-edict'
                    ? buildKhanEdictSelection(state, currentFactionId, state.selectedRegionId)
                    : null;
                const driveTigerDispatchSelection = event.payload.actionId === 'drive-tiger'
                    ? buildDriveTigerDispatchSelection(state, currentFactionId, state.selectedRegionId)
                    : null;
                const driveTigerConsentSelection = event.payload.actionId === 'drive-tiger' && driveTigerDispatchSelection
                    ? buildDriveTigerConsentSelection(state, currentFactionId, driveTigerDispatchSelection)
                    : null;
                const pendingTargetAction = (event.payload.actionId === 'raid' || event.payload.actionId === 'marriage-subjugation')
                    ? buildPendingTargetAction(
                        state,
                        currentFactionId,
                        event.payload.actionId as 'raid' | 'marriage-subjugation',
                        selectedRegion,
                    )
                    : null;
                const runtimeRegions = state.regions.filter((region) => !region.isLogicalRegion);
                const grantPardonSourceRegion = event.payload.actionId === 'grant-pardon'
                    ? runtimeRegions.find((region) => (
                        region.id === selectedRuntimeRegionId
                        && region.controller !== 'ming'
                        && getNonSiegedCityActionSourceSnapshot(region).troops > 0
                    ))
                    : null;
                const grantPardonDestinationRegion = grantPardonSourceRegion
                    ? grantPardonSourceRegion.adjacentRegionIds
                        .map((regionId) => runtimeRegions.find((region) => region.id === regionId))
                        .filter((region): region is NonNullable<typeof region> => region != null && region.controller === 'ming')
                        .sort((left, right) => {
                            const leftSource = getFriendlyReceivingRegionSnapshot(left);
                            const rightSource = getFriendlyReceivingRegionSnapshot(right);
                            return rightSource.troops - leftSource.troops
                                || rightSource.population - leftSource.population
                                || left.name.localeCompare(right.name, 'zh-CN');
                        })
                        .at(0)
                    : null;
                const paidHandCards = state.handCards.filter((card) => !selectedCardIds.has(card.id));
                let nextSelectedRegionId = state.selectedRegionId;
                const nextDrawPileCount = state.drawPileCount;
                const nextHandCards = paidHandCards;
                let nextLastSeasonSummary: QidahenSeasonSummary | null = null;
                const nextFactions: QidahenCore['factions'] = {
                    ...state.factions,
                    [currentFactionId]: {
                        ...state.factions[currentFactionId],
                        handCount: Math.max(0, state.factions[currentFactionId].handCount - spentCardCount),
                        discardPileCount: Math.max(0, state.factions[currentFactionId].discardPileCount ?? 0) + spentCardCount,
                    },
                };
                if (event.payload.actionId === 'upgrade-armament') {
                    const upgradeResult = upgradeLowFidelityArmament(nextFactions[currentFactionId].armaments);
                    nextFactions[currentFactionId] = {
                        ...nextFactions[currentFactionId],
                        armaments: upgradeResult.armaments,
                    };
                    const upgradedArmamentLine = upgradeResult.upgradedArmament
                        ? `${state.factions[currentFactionId].name}将${upgradeResult.upgradedArmament.name}升级到${upgradeResult.upgradedArmament.level}级。`
                        : `${state.factions[currentFactionId].name} 当前没有可升级军备。`;
                    nextLastSeasonSummary = buildSeasonSummary('升级军备', event.timestamp, [
                        `${upgradedArmamentLine} 当前为低保真研发入口，后续可接真实军备牌选择。`,
                    ]);
                }
                const nextRuntimeRegions = runtimeRegions.map((region) => {
                    if (event.payload.actionId === 'grant-pardon' && region.id === selectedRuntimeRegionId && region.controller !== 'ming') {
                        if (grantPardonSourceRegion && grantPardonDestinationRegion && region.id === grantPardonSourceRegion.id) {
                            nextSelectedRegionId = grantPardonDestinationRegion.id;
                            nextLastSeasonSummary = buildSeasonSummary('赐印招安', event.timestamp, [
                                `${grantPardonSourceRegion.name} 有 1 个部队被招安，转入 ${grantPardonDestinationRegion.name} 并成为大明部队。`,
                            ]);
                            return removeTroopsFromNonSiegedCityStateRegion(
                                region,
                                1,
                                `${region.name} 有 1 个部队经赐印招安后转入 ${grantPardonDestinationRegion.name}。`,
                            );
                        }
                        return region;
                    }
                    if (event.payload.actionId === 'grant-pardon' && grantPardonDestinationRegion && region.id === grantPardonDestinationRegion.id) {
                        const actionTargetRegion = materializeNonSiegedCityActionSourceRegion(region);
                        return addTroopsToFriendlyBesiegedCityInterior(
                            actionTargetRegion,
                            1,
                            [],
                            `${actionTargetRegion.name} 接收 1 个经赐印招安归化的大明部队。`,
                        );
                    }
                    return region;
                });
                if (recruitSelection?.targetRegionId) {
                    nextSelectedRegionId = recruitSelection.targetRegionId;
                }
                if (maShiTradeSelection?.targetRegionId) {
                    nextSelectedRegionId = maShiTradeSelection.targetRegionId;
                }
                if (event.payload.actionId === 'recruit' && !recruitSelection) {
                    nextLastSeasonSummary = buildSeasonSummary('征召军队', event.timestamp, [
                        '当前没有可执行征召军队的己方控制区域。',
                    ]);
                }
                if (event.payload.actionId === 'ma-shi-trade' && !maShiTradeSelection) {
                    nextLastSeasonSummary = buildSeasonSummary('马市贸易', event.timestamp, [
                        '当前没有可执行马市贸易的大明控制区域。',
                    ]);
                }
                const nextRegions = refreshRuntimeRegionRules(nextRuntimeRegions, state.fortifications);
                const nextMapTokens = syncControlTokensFromRegions(state.mapTokens, nextRegions);
                if (event.payload.actionId === 'grant-pardon' && grantPardonSourceRegion && grantPardonDestinationRegion) {
                    nextFactions.ming = {
                        ...nextFactions.ming,
                        troops: nextFactions.ming.troops + 1,
                    };
                    const sourceFactionId = grantPardonSourceRegion.controller;
                    if (sourceFactionId !== 'neutral') {
                        nextFactions[sourceFactionId] = {
                            ...nextFactions[sourceFactionId],
                            troops: Math.max(0, nextFactions[sourceFactionId].troops - 1),
                        };
                    }
                }
                if (khanEdictSelection?.sourceRegionId) {
                    nextSelectedRegionId = khanEdictSelection.sourceRegionId;
                }
                if (driveTigerConsentSelection?.dispatchSelection.sourceRegionId) {
                    nextSelectedRegionId = driveTigerConsentSelection.dispatchSelection.sourceRegionId;
                }
                if (pendingTargetAction?.targetRuntimeRegionId) {
                    nextSelectedRegionId = pendingTargetAction.targetRuntimeRegionId;
                }
                const actionLogText = recruitSelection
                    ? `${state.factions[currentFactionId].name} 执行 ${actionLabel}，弃 ${spentCardCount} 张牌，当前目标 ${recruitSelection.targetRegionName ?? '未锁定'}，进入建军选择。`
                    : maShiTradeSelection
                    ? `${state.factions[currentFactionId].name} 执行 ${actionLabel}，弃 ${spentCardCount} 张牌，当前目标 ${maShiTradeSelection.targetRegionName ?? '未锁定'}，进入建兵数量选择。`
                    : driveTigerConsentSelection
                    ? `${state.factions[currentFactionId].name} 执行 ${actionLabel}，弃 ${spentCardCount} 张牌，等待 ${driveTigerConsentSelection.targetFactionName} 决定是否同意受大明指挥。`
                    : pendingTargetAction
                        ? `${state.factions[currentFactionId].name} 执行 ${actionLabel}，弃 ${spentCardCount} 张牌，进入 ${pendingTargetAction.title}（${pendingTargetAction.resolutionHint}）。`
                        : nextLastSeasonSummary?.lines[0]
                            ? `${state.factions[currentFactionId].name} 执行 ${actionLabel}，弃 ${spentCardCount} 张牌。${nextLastSeasonSummary.lines[0]}`
                            : `${state.factions[currentFactionId].name} 执行 ${actionLabel}，弃 ${spentCardCount} 张牌。`;
                const finalActionLogText = khanEdictSelection
                    ? `${state.factions[currentFactionId].name} 执行 ${actionLabel}，弃 ${spentCardCount} 张牌，进入令箭效果选择。`
                    : recruitSelection
                        ? `${state.factions[currentFactionId].name} 执行 ${actionLabel}，弃 ${spentCardCount} 张牌，进入征召军队建军选择。`
                    : maShiTradeSelection
                        ? `${state.factions[currentFactionId].name} 执行 ${actionLabel}，弃 ${spentCardCount} 张牌，进入马市贸易建兵数量选择。`
                    : actionLogText;
                const hasHuangtaijiBonus = currentFactionId === 'jin' && hasActiveCharacter(state, 'jin', 'jin-huangtaiji');
                const usedBonusFactionAction = state.factionActionUsed && hasRemainingFactionAction(state, currentFactionId);
                const executedState = applyVictoryStatus({
                    ...state,
                    selectedRegionId: nextSelectedRegionId,
                    selectedActionId: event.payload.actionId,
                    selectedPaymentCardIds: [],
                    recruitSelection,
                    maShiTradeSelection,
                    khanEdictSelection,
                    diplomacySelection: null,
                    driveTigerConsentSelection,
                    wheelDispatchSelection: null,
                    postBattleSelection: null,
                    turnPhase: khanEdictSelection
                        ? 'khan-edict-choice'
                        : recruitSelection
                        ? 'recruit-choice'
                        : maShiTradeSelection
                        ? 'ma-shi-trade-choice'
                        : driveTigerConsentSelection
                        ? 'drive-tiger-consent'
                        : pendingTargetAction
                            ? 'resolve-pending'
                            : 'action-window',
                    factionActionUsed: true,
                    bonusFactionActionAvailable: hasHuangtaijiBonus,
                    bonusFactionActionUsed: usedBonusFactionAction,
                    lastFactionActionId: event.payload.actionId,
                    payment: buildPaymentState(event.payload.actionId, 0),
                    discardPileCount: state.discardPileCount + spentCardCount,
                    drawPileCount: nextDrawPileCount,
                    handCards: nextHandCards,
                    regions: nextRegions,
                    mapTokens: nextMapTokens,
                    factions: nextFactions,
                    pendingTargetAction,
                    lastSeasonSummary: nextLastSeasonSummary ?? state.lastSeasonSummary,
                    actionLog: [
                        {
                            id: `log-${event.timestamp}`,
                            faction: currentFactionId,
                            text: finalActionLogText,
                        },
                        ...state.actionLog,
                    ].slice(0, 6),
                });
                return advanceTurnIfReady(syncFactionActionWindow(executedState, currentFactionId), event.timestamp);
            }
            case 'PENDING_ACTION_RESOLVED': {
                if (!state.pendingTargetAction) {
                    return state;
                }
                const pendingTargetAction = applyRequestedCommittedTroops(
                    state,
                    state.pendingTargetAction,
                    event.payload.committedTroops,
                );
                const resolution = resolvePendingTargetAction(
                    state,
                    pendingTargetAction,
                    event.payload.retreatLossMode ?? 'rear-guard',
                    event.payload.defenderSortieBattle === true,
                    event.payload.defenderHoldCity === true,
                    event.payload.defenderCavalryEvasion === true,
                    event.payload.attackerCavalryPlunder === true,
                    event.payload.attackerCavalryPlunderSource ?? 'attacker',
                    event.payload.defenderCavalryEvasionRegionId,
                    event.payload.attackerCasualtyPriority ?? 'highest-level',
                    event.payload.defenderCasualtyPriority ?? 'highest-level',
                    event.payload.battleRolls,
                );
                const currentFactionId = getFactionIdByPlayerId(state, event.payload.playerId);
                const lastSeasonSummary = buildPendingActionResolutionSummary(
                    pendingTargetAction,
                    resolution,
                    event.timestamp,
                );
                const resolvedSelectedRegionId = resolution.selectedRegionId
                    ?? resolution.pendingTargetAction?.targetRuntimeRegionId
                    ?? resolution.postBattleSelection?.targetRuntimeRegionId
                    ?? pendingTargetAction.targetRuntimeRegionId;
                const resolvedState = applyVictoryStatus({
                    ...state,
                    selectedRegionId: resolvedSelectedRegionId,
                    turnPhase: resolution.pendingTargetAction
                        ? 'resolve-pending'
                        : resolution.postBattleSelection
                            ? 'post-battle-decision'
                            : 'action-window',
                    recruitSelection: null,
                    maShiTradeSelection: null,
                    khanEdictSelection: null,
                    diplomacySelection: null,
                    driveTigerConsentSelection: null,
                    wheelDispatchSelection: null,
                    pendingTargetAction: resolution.pendingTargetAction,
                    postBattleSelection: resolution.postBattleSelection,
                    regions: resolution.regions,
                    mapTokens: resolution.mapTokens,
                    factions: resolution.factions,
                    drawPileCount: resolution.drawPileCount,
                    discardPileCount: resolution.discardPileCount,
                    handCards: resolution.handCards,
                    lastSeasonSummary,
                    actionLog: [
                        {
                            id: `log-${event.timestamp}`,
                            faction: currentFactionId,
                            text: resolution.logText,
                        },
                        ...state.actionLog,
                    ].slice(0, 6),
                });
                return advanceTurnIfReady(syncFactionActionWindow(resolvedState, currentFactionId), event.timestamp);
            }
            case 'POST_BATTLE_DECISION_RESOLVED': {
                if (!state.postBattleSelection) {
                    return state;
                }
                const currentFactionId = getFactionIdByPlayerId(state, event.payload.playerId);
                const resolution = resolvePostBattleDecision(state, state.postBattleSelection, event.payload.choiceId);
                const lastSeasonSummary = buildPostBattleDecisionSummary(
                    state.postBattleSelection,
                    resolution,
                    event.timestamp,
                );
                const resolvedState = applyVictoryStatus({
                    ...state,
                    selectedRegionId: resolution.selectedRegionId,
                    turnPhase: 'action-window',
                    recruitSelection: null,
                    maShiTradeSelection: null,
                    khanEdictSelection: null,
                    diplomacySelection: null,
                    driveTigerConsentSelection: null,
                    postBattleSelection: null,
                    regions: resolution.regions,
                    mapTokens: resolution.mapTokens,
                    factions: resolution.factions,
                    koreaDeckCount: resolution.koreaDeckCount,
                    drawPileCount: resolution.drawPileCount,
                    discardPileCount: resolution.discardPileCount,
                    handCards: resolution.handCards,
                    lastSeasonSummary,
                    actionLog: [
                        {
                            id: `log-post-battle-${event.timestamp}`,
                            faction: currentFactionId,
                            text: resolution.logText,
                        },
                        ...state.actionLog,
                    ].slice(0, 6),
                });
                return advanceTurnIfReady(syncFactionActionWindow(resolvedState, currentFactionId), event.timestamp);
            }
            case 'DRIVE_TIGER_CONSENT_RESOLVED': {
                if (!state.driveTigerConsentSelection) {
                    return state;
                }
                const currentFactionId = getFactionIdByPlayerId(state, event.payload.playerId);
                if (event.payload.choiceId === 'decline') {
                    const declinedState = applyVictoryStatus({
                        ...state,
                        turnPhase: 'action-window',
                        diplomacySelection: null,
                        driveTigerConsentSelection: null,
                        wheelDispatchSelection: null,
                        lastSeasonSummary: buildSeasonSummary('驱虎吞狼', event.timestamp, [
                            `${state.factions[state.driveTigerConsentSelection.targetFactionId].name} 拒绝接受大明指挥，本次驱虎吞狼不生效。`,
                        ]),
                        actionLog: [
                            {
                                id: `log-drive-tiger-consent-${event.timestamp}`,
                                faction: currentFactionId,
                                text: `${state.factions[state.driveTigerConsentSelection.targetFactionId].name} 拒绝接受 ${state.factions[state.driveTigerConsentSelection.commanderFactionId].name} 指挥，驱虎吞狼未执行。`,
                            },
                            ...state.actionLog,
                        ].slice(0, 6),
                    });
                    return advanceTurnIfReady(syncFactionActionWindow(declinedState, currentFactionId), event.timestamp);
                }

                const acceptedSelection = state.driveTigerConsentSelection.dispatchSelection;
                const drawCards = Math.max(0, Math.min(getFactionDrawPileCount(state, acceptedSelection.attackerFactionId), 6));
                const drawResult = drawFromFactionPile(state.factions, acceptedSelection.attackerFactionId, drawCards);
                const nextFactions = addFactionHandCards(drawResult.factions, acceptedSelection.attackerFactionId, drawResult.drawnCards);
                const acceptedState = applyVictoryStatus({
                    ...state,
                    selectedRegionId: acceptedSelection.sourceRegionId,
                    turnPhase: 'dispatch-targeting',
                    diplomacySelection: null,
                    driveTigerConsentSelection: null,
                    wheelDispatchSelection: acceptedSelection,
                    drawPileCount: acceptedSelection.attackerFactionId === 'ming' ? state.drawPileCount - drawResult.drawnCards : state.drawPileCount,
                    handCards: buildDrawnHandCards(state, acceptedSelection.attackerFactionId, drawResult.drawnCards),
                    factions: nextFactions,
                    lastSeasonSummary: buildSeasonSummary('驱虎吞狼', event.timestamp, [
                        `${state.factions[state.driveTigerConsentSelection.targetFactionId].name} 同意接受大明指挥，并获得 ${drawResult.drawnCards} 张手牌。`,
                        `当前源区 ${acceptedSelection.sourceRegionName}，由大明指挥其执行调度进攻。`,
                    ]),
                    actionLog: [
                        {
                            id: `log-drive-tiger-consent-${event.timestamp}`,
                            faction: currentFactionId,
                            text: `${state.factions[state.driveTigerConsentSelection.targetFactionId].name} 同意接受 ${state.factions[state.driveTigerConsentSelection.commanderFactionId].name} 指挥，获得 ${drawResult.drawnCards} 张手牌，进入指挥调度目标选择。`,
                        },
                        ...state.actionLog,
                    ].slice(0, 6),
                });
                return advanceTurnIfReady(syncFactionActionWindow(acceptedState, currentFactionId), event.timestamp);
            }
            case 'RECRUIT_CHOICE_RESOLVED': {
                if (!state.recruitSelection?.targetRegionId) {
                    return state;
                }
                const currentFactionId = getFactionIdByPlayerId(state, event.payload.playerId);
                const choice = state.recruitSelection.choices.find((item) => item.id === event.payload.choiceId);
                if (!choice) {
                    return state;
                }
                const isChuanbing = choice.id === 'level-4-chuanbing';
                const isArtillery = choice.id === 'level-1-artillery';
                const grantedTroops = choice.troopDelta;
                const nextRuntimeRegions = state.regions
                    .filter((region) => !region.isLogicalRegion)
                    .map((region) => {
                        if (region.id !== state.recruitSelection?.targetRegionId) {
                            return region;
                        }
                        const actionTargetRegion = materializeNonSiegedCityActionSourceRegion(region);
                        const nextRegion = {
                            ...actionTargetRegion,
                            troops: actionTargetRegion.troops + grantedTroops,
                            note: isArtillery
                                ? `${actionTargetRegion.name} 执行征召军队后加入炮兵 x1（1级）；炮兵不能承受战斗损伤，也不计入胜负。`
                                : isChuanbing
                                ? `${actionTargetRegion.name} 执行征召军队后加入川兵 x2（4级），战斗会按结构化部队等级估算损伤。`
                                : `${actionTargetRegion.name} 执行征召军队后加入 ${grantedTroops} 个等级 2 大明步兵，战斗会按结构化部队等级估算损伤。`,
                        };
                        return isArtillery
                            ? addSpecialTroopStackToRegion(nextRegion, buildArtilleryTroopStack('ming', 'recruit', grantedTroops, 1))
                            : isChuanbing
                            ? addSpecialTroopStackToRegion(nextRegion, {
                                id: 'ming-chuanbing-lv4',
                                label: '川兵',
                                faction: 'ming',
                                troopKind: 'infantry',
                                count: 2,
                                level: 4,
                            })
                            : addSpecialTroopStackToRegion(nextRegion, buildRegularTroopStack('ming', 'recruit', grantedTroops));
                    });
                const nextRegions = refreshRuntimeRegionRules(nextRuntimeRegions, state.fortifications);
                const chuanbingLine = '川兵 x2（4级），战斗会按结构化部队等级估算损伤。';
                const artilleryLine = '炮兵 x1（1级）；火炮技术允许建立炮兵，炮兵不能承受战斗损伤，也不计入胜负。';
                const summaryLines = isArtillery
                    ? [
                        `${state.factions[currentFactionId].name} 在 ${state.recruitSelection.targetRegionName ?? '当前区域'} 征召军队，建立 1 个等级 1 炮兵。`,
                        artilleryLine,
                    ]
                    : isChuanbing
                    ? [
                        `${state.factions[currentFactionId].name} 在 ${state.recruitSelection.targetRegionName ?? '当前区域'} 征召军队，建立 2 个等级 4 川兵部队。`,
                        chuanbingLine,
                    ]
                    : [
                        `${state.factions[currentFactionId].name} 在 ${state.recruitSelection.targetRegionName ?? '当前区域'} 征召军队，建立 6 个等级 2 部队。`,
                    ];
                const resolvedState = applyVictoryStatus({
                    ...state,
                    selectedRegionId: state.recruitSelection.targetRegionId,
                    turnPhase: 'action-window',
                    recruitSelection: null,
                    maShiTradeSelection: null,
                    khanEdictSelection: null,
                    diplomacySelection: null,
                    driveTigerConsentSelection: null,
                    regions: nextRegions,
                    mapTokens: syncControlTokensFromRegions(state.mapTokens, nextRegions),
                    factions: {
                        ...state.factions,
                        [currentFactionId]: {
                            ...state.factions[currentFactionId],
                            troops: state.factions[currentFactionId].troops + grantedTroops,
                        },
                    },
                    lastSeasonSummary: buildSeasonSummary('征召军队', event.timestamp, summaryLines),
                    actionLog: [
                        {
                            id: `log-recruit-${event.timestamp}`,
                            faction: currentFactionId,
                            text: isChuanbing
                                ? `${state.factions[currentFactionId].name} 完成征召军队，${state.recruitSelection.targetRegionName ?? '目标区域'} 已记录 ${chuanbingLine}`
                                : isArtillery
                                ? `${state.factions[currentFactionId].name} 完成征召军队，${state.recruitSelection.targetRegionName ?? '目标区域'} 已记录 ${artilleryLine}`
                                : `${state.factions[currentFactionId].name} 完成征召军队，${state.recruitSelection.targetRegionName ?? '目标区域'} 建立 6 个等级 2 部队。`,
                        },
                        ...state.actionLog,
                    ].slice(0, 6),
                });
                return advanceTurnIfReady(syncFactionActionWindow(resolvedState, currentFactionId), event.timestamp);
            }
            case 'MA_SHI_TRADE_CHOICE_RESOLVED': {
                if (!state.maShiTradeSelection?.targetRegionId) {
                    return state;
                }
                const currentFactionId = getFactionIdByPlayerId(state, event.payload.playerId);
                const grantedTroops = event.payload.troopCount;
                const drawCards = Math.max(0, Math.min(getFactionDrawPileCount(state, currentFactionId), grantedTroops * 2));
                const drawResult = drawFromFactionPile(state.factions, currentFactionId, drawCards);
                const nextRuntimeRegions = state.regions
                    .filter((region) => !region.isLogicalRegion)
                    .map((region) => {
                        if (region.id !== state.maShiTradeSelection?.targetRegionId) {
                            return region;
                        }
                        const actionTargetRegion = materializeNonSiegedCityActionSourceRegion(region);
                        return addSpecialTroopStackToRegion({
                            ...actionTargetRegion,
                            troops: actionTargetRegion.troops + grantedTroops,
                            note: `${actionTargetRegion.name} 因马市贸易获得 ${grantedTroops} 个等级 2 大明步兵。`,
                        }, buildRegularTroopStack('ming', 'ma-shi-trade', grantedTroops));
                    });
                const nextRegions = refreshRuntimeRegionRules(nextRuntimeRegions, state.fortifications);
                const resolvedState = applyVictoryStatus({
                    ...state,
                    selectedRegionId: state.maShiTradeSelection.targetRegionId,
                    turnPhase: 'action-window',
                    recruitSelection: null,
                    maShiTradeSelection: null,
                    diplomacySelection: null,
                    driveTigerConsentSelection: null,
                    regions: nextRegions,
                    mapTokens: syncControlTokensFromRegions(state.mapTokens, nextRegions),
                    drawPileCount: currentFactionId === 'ming' ? state.drawPileCount - drawResult.drawnCards : state.drawPileCount,
                    handCards: buildDrawnHandCards(state, currentFactionId, drawResult.drawnCards),
                    factions: {
                        ...drawResult.factions,
                        ming: {
                            ...drawResult.factions.ming,
                            troops: state.factions.ming.troops + grantedTroops,
                        },
                        mongol: {
                            ...drawResult.factions.mongol,
                            handCount: state.factions.mongol.handCount + drawResult.drawnCards,
                        },
                    },
                    lastSeasonSummary: buildSeasonSummary('马市贸易', event.timestamp, [
                        `蒙古在 ${state.maShiTradeSelection.targetRegionName ?? '目标区域'} 发动马市贸易，大明选择建立 ${grantedTroops} 个部队。`,
                        drawResult.drawnCards > 0
                            ? `蒙古因马市贸易获得 ${drawResult.drawnCards} 张手牌。`
                            : '当前牌堆不足，蒙古未额外获得手牌。',
                    ]),
                    actionLog: [
                        {
                            id: `log-ma-shi-trade-${event.timestamp}`,
                            faction: currentFactionId,
                            text: `${state.factions[currentFactionId].name} 完成马市贸易，${state.maShiTradeSelection.targetRegionName ?? '目标区域'} 部队 +${grantedTroops}，蒙古抽 ${drawResult.drawnCards} 张牌。`,
                        },
                        ...state.actionLog,
                    ].slice(0, 6),
                });
                return advanceTurnIfReady(syncFactionActionWindow(resolvedState, currentFactionId), event.timestamp);
            }
            case 'KHAN_EDICT_CHOICE_RESOLVED': {
                if (!state.khanEdictSelection) {
                    return state;
                }
                const currentFactionId = getFactionIdByPlayerId(state, event.payload.playerId);
                if (event.payload.choiceId === 'hire-dispatch') {
                    const diplomacySelection = buildDiplomacySelection(
                        state,
                        currentFactionId,
                        state.selectedRegionId,
                        'khan-edict',
                        state.khanEdictSelection.hireTargetRegionId,
                    );
                    if (!diplomacySelection) {
                        return updateTurnLabel({
                            ...state,
                            recruitSelection: null,
                            maShiTradeSelection: null,
                            khanEdictSelection: null,
                            diplomacySelection: null,
                            driveTigerConsentSelection: null,
                            lastSeasonSummary: buildSeasonSummary('大汗令箭', event.timestamp, [
                                '当前没有可执行外交雇佣的蒙古控制区域。',
                            ]),
                        });
                    }

                    return updateTurnLabel({
                        ...state,
                        turnPhase: 'diplomacy-choice',
                        recruitSelection: null,
                        maShiTradeSelection: null,
                        khanEdictSelection: null,
                        diplomacySelection,
                        actionLog: [
                            {
                                id: `log-khan-edict-${event.timestamp}`,
                                faction: currentFactionId,
                                text: `${state.factions[currentFactionId].name} 选择大汗令箭的外交雇佣，当前源区 ${diplomacySelection.sourceRegionName ?? '未锁定'}，等待选择外交目标。`,
                            },
                            ...state.actionLog,
                        ].slice(0, 6),
                    });
                }

                const recruitTargetRegionId = state.khanEdictSelection.recruitTargetRegionId;
                if (!recruitTargetRegionId) {
                    return updateTurnLabel({
                        ...state,
                        recruitSelection: null,
                        maShiTradeSelection: null,
                        khanEdictSelection: null,
                        diplomacySelection: null,
                        driveTigerConsentSelection: null,
                        lastSeasonSummary: buildSeasonSummary('大汗令箭', event.timestamp, [
                            '当前没有可执行征兵训练的蒙古控制区域。',
                        ]),
                    });
                }
                const recruitConfig = getQidahenWheelImmediateEffectConfig('wheel-recruit-train');
                const troopDelta = recruitConfig?.troopDelta ?? 2;
                const nextRuntimeRegions = state.regions
                    .filter((region) => !region.isLogicalRegion)
                    .map((region) => {
                        if (region.id !== recruitTargetRegionId) {
                            return region;
                        }
                        const actionTargetRegion = materializeNonSiegedCityActionSourceRegion(region);
                        return addSpecialTroopStackToRegion({
                                ...actionTargetRegion,
                                troops: actionTargetRegion.troops + troopDelta,
                                note: `${actionTargetRegion.name} 经大汗令箭执行征兵训练后建立 ${troopDelta} 个等级 2 蒙古骑兵。`,
                            }, buildRegularTroopStack('mongol', 'khan-edict-recruit-train', troopDelta));
                    });
                const nextRegions = refreshRuntimeRegionRules(nextRuntimeRegions, state.fortifications);
                const resolvedState = applyVictoryStatus({
                    ...state,
                    selectedRegionId: recruitTargetRegionId,
                    turnPhase: 'action-window',
                    recruitSelection: null,
                    maShiTradeSelection: null,
                    khanEdictSelection: null,
                    diplomacySelection: null,
                    driveTigerConsentSelection: null,
                    regions: nextRegions,
                    mapTokens: syncControlTokensFromRegions(state.mapTokens, nextRegions),
                    factions: {
                        ...state.factions,
                        mongol: {
                            ...state.factions.mongol,
                            troops: state.factions.mongol.troops + troopDelta,
                        },
                    },
                    lastSeasonSummary: buildSeasonSummary('大汗令箭', event.timestamp, [
                        `${state.factions[currentFactionId].name} 选择征兵训练，${state.khanEdictSelection.recruitTargetRegionName ?? '当前控制区'} 建立 ${troopDelta} 个等级 2 蒙古骑兵。`,
                    ]),
                    actionLog: [
                        {
                            id: `log-khan-edict-${event.timestamp}`,
                            faction: currentFactionId,
                            text: `${state.factions[currentFactionId].name} 选择大汗令箭的征兵训练，${state.khanEdictSelection.recruitTargetRegionName ?? '当前控制区'} 建立 ${troopDelta} 个等级 2 蒙古骑兵。`,
                        },
                        ...state.actionLog,
                    ].slice(0, 6),
                });
                return advanceTurnIfReady(syncFactionActionWindow(resolvedState, currentFactionId), event.timestamp);
            }
            case 'DIPLOMACY_CHOICE_RESOLVED': {
                if (!state.diplomacySelection) {
                    return state;
                }
                const currentFactionId = getFactionIdByPlayerId(state, event.payload.playerId);
                const resolution = resolveDiplomacyChoice(
                    state,
                    currentFactionId,
                    state.diplomacySelection,
                    event.payload.choiceId,
                );
                if (resolution.diplomacySelection) {
                    return updateTurnLabel({
                        ...state,
                        selectedRegionId: resolution.selectedRegionId,
                        turnPhase: 'diplomacy-choice',
                        recruitSelection: null,
                        maShiTradeSelection: null,
                        khanEdictSelection: null,
                        diplomacySelection: resolution.diplomacySelection,
                        driveTigerConsentSelection: null,
                        wheelDispatchSelection: null,
                        regions: resolution.regions,
                        mapTokens: resolution.mapTokens,
                        factions: resolution.factions,
                        actionLog: [
                            {
                                id: `log-diplomacy-${event.timestamp}`,
                                faction: currentFactionId,
                                text: resolution.logText,
                            },
                            ...state.actionLog,
                        ].slice(0, 6),
                    });
                }
                const resolvedState = applyVictoryStatus({
                    ...state,
                    selectedRegionId: resolution.selectedRegionId,
                    turnPhase: 'action-window',
                    recruitSelection: null,
                    maShiTradeSelection: null,
                    khanEdictSelection: null,
                    diplomacySelection: null,
                    driveTigerConsentSelection: null,
                    wheelDispatchSelection: null,
                    regions: resolution.regions,
                    mapTokens: resolution.mapTokens,
                    factions: resolution.factions,
                    lastSeasonSummary: buildSeasonSummary(state.diplomacySelection.title, event.timestamp, resolution.summaryLines ?? []),
                    actionLog: [
                        {
                            id: `log-diplomacy-${event.timestamp}`,
                            faction: currentFactionId,
                            text: resolution.logText,
                        },
                        ...state.actionLog,
                    ].slice(0, 6),
                });
                return advanceTurnIfReady(syncFactionActionWindow(resolvedState, currentFactionId), event.timestamp);
            }
            default:
                return state;
        }
    },

    isGameOver: resolveQidahenGameOver,
};

export {
    findQidahenReachableRuntimeRegions,
    getQidahenAdjacentRuntimeRegions,
    getQidahenDirectedPassageRule,
    getQidahenDirectedTravelCost,
    getQidahenMovementProfile,
    QIDAHEN_MOVEMENT_PROFILES,
} from './movement';
export type { QidahenCasualtyPriority, QidahenCommand, QidahenCommandMap, QidahenCore, QidahenEvent } from './types';
