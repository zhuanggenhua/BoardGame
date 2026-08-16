import type { QidahenFactionId, QidahenHandCard } from './types';
import {
    QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITY_BY_INDEX,
    QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID,
} from './ordinaryHandCardIdentities';

export type QidahenHandCardPreviewKind =
    | 'unknown'
    | 'character'
    | 'scenario'
    | 'chronology'
    | 'card-back';

type QidahenFormalHandCardIdentity = Pick<
    QidahenHandCard,
    'cardKind' | 'armamentId' | 'cardDefId' | 'rulesSummary' | 'previewKind' | 'previewIdentityId'
>;

const knownPreviewCard = (
    cardKind: NonNullable<QidahenHandCard['cardKind']>,
    previewKind: NonNullable<QidahenHandCard['previewKind']>,
    cardDefId: string,
): QidahenFormalHandCardIdentity => ({
    cardKind,
    armamentId: null,
    cardDefId,
    rulesSummary: null,
    previewKind,
    previewIdentityId: cardDefId,
});

const QIDAHEN_PREVIEW_IDENTITY_BY_FACTION_INDEX: Record<
    QidahenFactionId,
    readonly QidahenFormalHandCardIdentity[]
> = {
    ming: [
        knownPreviewCard('character', 'character', 'ming-character-xiong-tingbi'),
        knownPreviewCard('character', 'character', 'ming-character-sun-chengzong'),
        knownPreviewCard('character', 'character', 'ming-character-sun-yuanhua'),
        knownPreviewCard('character', 'character', 'ming-character-mao-wenlong'),
        knownPreviewCard('character', 'character', 'ming-character-yang-hao'),
        knownPreviewCard('character', 'character', 'ming-character-wei-zhongxian'),
        knownPreviewCard('character', 'character', 'ming-character-yuan-chonghuan'),
        knownPreviewCard('character', 'character', 'ming-character-gao-di'),
        knownPreviewCard('character', 'character', 'ming-character-wang-huazhen-0'),
        knownPreviewCard('character', 'character', 'ming-character-wang-huazhen-1'),
        knownPreviewCard('character', 'character', 'ming-character-wang-huazhen-2'),
        knownPreviewCard('character', 'character', 'ming-character-wang-huazhen-3'),
        knownPreviewCard('character', 'character', 'ming-character-wang-huazhen-4'),
        knownPreviewCard('character', 'character', 'ming-character-gao-di-1'),
        knownPreviewCard('character', 'character', 'ming-character-gao-di-2'),
        knownPreviewCard('character', 'character', 'ming-character-gao-di-3'),
    ],
    mongol: [
        knownPreviewCard('scenario', 'scenario', 'mongol-scenario-dingmao-rebellion-1627'),
        knownPreviewCard('scenario', 'scenario', 'mongol-scenario-post-sarhu-1619'),
        knownPreviewCard('scenario', 'scenario', 'mongol-scenario-shanhaiguan-1622'),
        ...Array.from({ length: 13 }, (_, index) => (
            knownPreviewCard('chronology', 'chronology', `mongol-chronology-${index}`)
        )),
    ],
    jin: [
        knownPreviewCard('character', 'character', 'jin-character-yang-guli'),
        knownPreviewCard('character', 'character', 'jin-character-fan-wencheng'),
        knownPreviewCard('character', 'character', 'jin-character-amin-0'),
        knownPreviewCard('character', 'character', 'jin-character-manggultai'),
        knownPreviewCard('character', 'character', 'jin-character-eyidu'),
        knownPreviewCard('character', 'character', 'jin-character-daisan'),
        knownPreviewCard('character', 'character', 'jin-character-huangtaiji-0'),
        knownPreviewCard('character', 'character', 'jin-character-amin-1'),
        knownPreviewCard('character', 'character', 'jin-character-huangtaiji-1'),
        knownPreviewCard('character', 'character', 'jin-character-nurhaci'),
        ...Array.from({ length: 6 }, (_, index) => (
            knownPreviewCard('card-back', 'card-back', `jin-card-back-${index}`)
        )),
    ],
};

export const resolveQidahenFormalHandCardIdentity = (
    factionId: QidahenFactionId,
    previewIndex: number,
): QidahenFormalHandCardIdentity => {
    const identities = QIDAHEN_PREVIEW_IDENTITY_BY_FACTION_INDEX[factionId];
    const normalizedIndex = ((previewIndex % identities.length) + identities.length) % identities.length;
    const identity = identities[normalizedIndex];
    return {
        cardKind: identity.cardKind,
        armamentId: identity.armamentId,
        cardDefId: identity.cardDefId,
        previewKind: identity.previewKind,
        previewIdentityId: identity.previewIdentityId,
    };
};

export const resolveQidahenAtlas05OrdinaryHandCardIdentity = (
    atlasIndex: number,
): QidahenFormalHandCardIdentity | null => {
    const identity = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITY_BY_INDEX.get(atlasIndex);
    if (!identity) {
        return null;
    }
    const rulesSummaryByDefId: Readonly<Record<string, string>> = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID;
    return {
        cardKind: identity.cardKind,
        armamentId: identity.armamentId,
        cardDefId: identity.cardDefId,
        rulesSummary: rulesSummaryByDefId[identity.cardDefId] ?? null,
        previewKind: 'unknown',
        previewIdentityId: identity.cardDefId,
    };
};

export const getQidahenDirectActionIdForHandCard = (
    card: Pick<QidahenHandCard, 'cardKind' | 'armamentId' | 'cardDefId'>,
): string | null => {
    if (card.cardKind === 'armament' && card.armamentId) {
        return 'upgrade-armament';
    }
    if (card.cardKind === 'event' && card.cardDefId?.includes('khan-edict')) {
        return 'khan-edict';
    }
    if (card.cardKind === 'event' && card.cardDefId) {
        return 'play-event-card';
    }
    return null;
};

export type QidahenHandCardBadgeKind =
    | 'event'
    | 'armament'
    | 'tactic'
    | 'silver'
    | 'character'
    | 'scenario'
    | 'chronology'
    | 'card-back';

export const getQidahenHandCardBadgeKind = (
    card: Pick<QidahenHandCard, 'cardKind' | 'previewKind'>,
): QidahenHandCardBadgeKind | null => {
    if (card.cardKind && card.cardKind !== 'unknown') {
        return card.cardKind;
    }
    if (card.previewKind && card.previewKind !== 'unknown') {
        return card.previewKind;
    }
    return null;
};
