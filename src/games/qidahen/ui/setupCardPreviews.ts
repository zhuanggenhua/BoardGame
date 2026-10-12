import type { CardPreviewRef } from '../../../core/types';
import {
    QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITY_BY_INDEX,
    QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID,
} from '../domain/ordinaryHandCardIdentities';
import type { QidahenArmamentId, QidahenArmamentState, QidahenFactionId, QidahenScenarioId } from '../domain/types';
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

const armamentPreviewIndexById: Record<QidahenArmamentId, number> = {
    'infantry-armor': 3,
    'han-banners': 5,
    'manzhou-banners': 6,
    'mongol-banners': 7,
    'cavalry-armor': 10,
    'horse-breeding': 17,
    'artillery-tech': 26,
    'cavalry-firearm': 39,
    'western-bastion': 42,
    'long-barreled-musket': 46,
};

export interface QidahenArmamentInspectView {
    previewRef: CardPreviewRef;
    rulesSummary: string;
}

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

export const listQidahenDevelopedArmaments = (
    armaments: readonly QidahenArmamentState[],
): QidahenArmamentState[] => armaments.filter((armament) => armament.level > 0);

export const getQidahenArmamentInspectView = (
    armamentId: QidahenArmamentId,
): QidahenArmamentInspectView | null => {
    const previewRef = getQidahenSetupArmamentPreview(armamentId);
    if (!previewRef || previewRef.type !== 'atlas') {
        return null;
    }
    const identity = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITY_BY_INDEX.get(previewRef.index);
    if (!identity) {
        return null;
    }
    const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
        identity.cardDefId as keyof typeof QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID
    ];
    if (!rulesSummary) {
        return null;
    }
    return {
        previewRef,
        rulesSummary,
    };
};
