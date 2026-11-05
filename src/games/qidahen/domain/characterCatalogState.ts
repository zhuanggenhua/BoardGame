import type { QidahenCharacterState, QidahenFactionId } from './types';

type InitialCharacterSeed = {
    id: string;
    name: string;
    number: number | 'X';
    initialInPlay: boolean;
};

const factionOrder: QidahenFactionId[] = ['ming', 'mongol', 'jin'];

const initialCharacterSeedsByFaction: Record<QidahenFactionId, InitialCharacterSeed[]> = {
    ming: [
        { id: 'ming-mao-wenlong', name: '毛文龙', number: 10, initialInPlay: false },
        { id: 'ming-wang-huazhen', name: '王化贞', number: 10, initialInPlay: false },
        { id: 'ming-xiong-tingbi', name: '熊廷弼', number: 8, initialInPlay: false },
        { id: 'ming-wei-zhongxian', name: '魏忠贤', number: 12, initialInPlay: false },
        { id: 'ming-sun-chengzong', name: '孙承宗', number: 12, initialInPlay: false },
        { id: 'ming-gao-di', name: '高第', number: 10, initialInPlay: false },
        { id: 'ming-yuan-chonghuan', name: '袁崇焕', number: 'X', initialInPlay: false },
        { id: 'ming-sun-yuanhua', name: '孙元化', number: 12, initialInPlay: false },
        { id: 'ming-yang-gao', name: '杨镐', number: 6, initialInPlay: false },
    ],
    mongol: [
        { id: 'mongol-lindan-hutuktu', name: '林丹·乎图克图', number: 12, initialInPlay: true },
        { id: 'mongol-choghtu-taiji', name: '绰克图台吉', number: 'X', initialInPlay: false },
        { id: 'mongol-oba-taiji', name: '奥巴台吉', number: 8, initialInPlay: false },
        { id: 'mongol-qisai-noyan', name: '齐赛诺延', number: 12, initialInPlay: false },
        { id: 'mongol-gunchu-ketuji', name: '衮楚克图吉', number: 10, initialInPlay: false },
    ],
    jin: [
        { id: 'jin-nurhaci', name: '努尔哈赤', number: 'X', initialInPlay: true },
        { id: 'jin-eidu', name: '额亦都', number: 10, initialInPlay: true },
        { id: 'jin-fan-wencheng', name: '范文程', number: 10, initialInPlay: false },
        { id: 'jin-daisan', name: '代善', number: 'X', initialInPlay: false },
        { id: 'jin-amin', name: '阿敏', number: 10, initialInPlay: false },
        { id: 'jin-manggultai', name: '莽古尔泰', number: 8, initialInPlay: false },
        { id: 'jin-yanguli', name: '扬古利', number: 8, initialInPlay: false },
        { id: 'jin-huangtaiji', name: '皇太极', number: 'X', initialInPlay: false },
    ],
};

export const createInitialCharacterStates = (factionId: QidahenFactionId): QidahenCharacterState[] => (
    initialCharacterSeedsByFaction[factionId].map(({ initialInPlay, ...character }) => ({
        ...character,
        faction: factionId,
        inPlay: initialInPlay,
        removedFromGame: false,
        canHoldDefeatMarker: character.number !== 'X',
        defeatMarkers: 0,
    }))
);

export const getCharacterNameById = (
    factionId: QidahenFactionId,
    characterId: string,
): string => (
    initialCharacterSeedsByFaction[factionId].find((character) => character.id === characterId)?.name
    ?? factionOrder
        .flatMap((candidateFactionId) => initialCharacterSeedsByFaction[candidateFactionId])
        .find((character) => character.id === characterId)?.name
    ?? characterId
);
