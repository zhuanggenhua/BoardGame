import type { QidahenArmamentId, QidahenArmamentState, QidahenFactionId } from './types';

const qidahenArmamentCatalog: readonly Pick<QidahenArmamentState, 'id' | 'name'>[] = [
    { id: 'artillery-tech', name: '火炮技术' },
    { id: 'infantry-armor', name: '步兵铁甲' },
    { id: 'cavalry-armor', name: '骑兵铁甲' },
    { id: 'western-bastion', name: '西式棱堡' },
    { id: 'long-barreled-musket', name: '长管火铳' },
    { id: 'cavalry-firearm', name: '骑兵火器' },
    { id: 'manzhou-banners', name: '满州八旗' },
    { id: 'horse-breeding', name: '骏马育种' },
    { id: 'mongol-banners', name: '蒙古八旗' },
    { id: 'han-banners', name: '汉军八旗' },
] as const;

const initialArmamentLevelsByFaction: Record<QidahenFactionId, Partial<Record<QidahenArmamentId, number>>> = {
    ming: { 'artillery-tech': 1 },
    mongol: { 'cavalry-armor': 1 },
    jin: { 'infantry-armor': 1 },
};

export const createInitialArmamentStates = (factionId: QidahenFactionId): QidahenArmamentState[] => (
    qidahenArmamentCatalog.map((armament) => ({
        ...armament,
        level: initialArmamentLevelsByFaction[factionId][armament.id] ?? 0,
    }))
);

export const getArmamentNameById = (armamentId: QidahenArmamentId): string => (
    qidahenArmamentCatalog.find((armament) => armament.id === armamentId)?.name
    ?? armamentId
);
