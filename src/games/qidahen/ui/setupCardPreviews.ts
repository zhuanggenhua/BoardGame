import type { CardPreviewRef } from '../../../core/types';
import type { QidahenArmamentId, QidahenFactionId, QidahenScenarioId } from '../domain/types';
import {
    qidahenAtlas05OrdinaryHandPreview,
    qidahenJinHandPreview,
    qidahenMingHandPreview,
    qidahenMongolHandPreview,
} from './cardAtlas';

const scenarioPreviewIndexById: Record<QidahenScenarioId, number> = {
    'dingmao-rebellion-1627': 0,
    'post-sarhu-1619': 1,
    'shanhaiguan-1622': 2,
};

const characterPreviewIndexById: Partial<Record<QidahenFactionId, Record<string, number>>> = {
    ming: {
        'ming-xiong-tingbi': 0,
        'ming-wang-huazhen': 8,
    },
    jin: {
        'jin-yanguli': 0,
        'jin-fan-wencheng': 1,
        'jin-amin': 2,
        'jin-manggultai': 3,
        'jin-eidu': 4,
        'jin-daisan': 5,
        'jin-huangtaiji': 6,
    },
};

const armamentPreviewIndexById: Partial<Record<QidahenArmamentId, number>> = {
    'infantry-armor': 3,
    'cavalry-armor': 10,
    'horse-breeding': 17,
    'artillery-tech': 26,
    'cavalry-firearm': 39,
    'western-bastion': 42,
    'long-barreled-musket': 46,
};

export const getQidahenScenarioCardPreview = (scenarioId: QidahenScenarioId): CardPreviewRef => (
    qidahenMongolHandPreview(scenarioPreviewIndexById[scenarioId])
);

export const getQidahenSetupCharacterPreview = (
    factionId: QidahenFactionId,
    characterId: string,
): CardPreviewRef | null => {
    const index = characterPreviewIndexById[factionId]?.[characterId];
    if (index == null) {
        return null;
    }
    if (factionId === 'ming') {
        return qidahenMingHandPreview(index);
    }
    if (factionId === 'jin') {
        return qidahenJinHandPreview(index);
    }
    return null;
};

export const getQidahenSetupArmamentPreview = (
    armamentId: QidahenArmamentId,
): CardPreviewRef | null => {
    const index = armamentPreviewIndexById[armamentId];
    return index == null ? null : qidahenAtlas05OrdinaryHandPreview(index);
};
