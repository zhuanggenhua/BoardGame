import { describe, expect, it } from 'vitest';import { getQidahenEventCharacterTargetSelectionForCore, getQidahenEventOpponentHandChoiceSelectionForCore, QidahenDomain } from '../domain';

import { QIDAHEN_COMMANDS } from '../domain/commands';
import { getActionChoicesForFaction } from '../domain/factionActionWindow';import { getQidahenDirectActionIdForHandCard, resolveQidahenAtlas05OrdinaryHandCardIdentity } from '../domain/handCardIdentity';

import { buildDrawnHandCards, QIDAHEN_ATLAS05_TTS_DECK_SEQUENCE_BY_FACTION } from '../domain/handCardState';import { QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITIES, QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID } from '../domain/ordinaryHandCardIdentities';

import { getQidahenFortificationConfigs } from '../domain/regionConfig';
import { QIDAHEN_MAP_HEIGHT, QIDAHEN_MAP_REGION_SHAPES, QIDAHEN_MAP_WIDTH } from '../ui/mapRegions';import type { QidahenCore } from '../domain/types';
import { random, stateOf, apply, factionHandCards } from './helpers/paymentSelectionHarness';

describe('七大恨开局、地图与手牌真相源', () => {
it('地图区域定义与领域区域保持同源', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const coreRegionsById = new Map(core.regions.map((region) => [region.id, region]));

        for (const shape of QIDAHEN_MAP_REGION_SHAPES) {
            expect(coreRegionsById.has(shape.id), `${shape.id} 缺少领域区域`).toBe(true);
            expect(coreRegionsById.get(shape.id)?.name).toBe(shape.name);
            expect(shape.polygon.length).toBeGreaterThanOrEqual(3);
            for (const [x, y] of shape.polygon) {
                expect(x).toBeGreaterThanOrEqual(0);
                expect(x).toBeLessThanOrEqual(QIDAHEN_MAP_WIDTH);
                expect(y).toBeGreaterThanOrEqual(0);
                expect(y).toBeLessThanOrEqual(QIDAHEN_MAP_HEIGHT);
            }
        }

        expect(core.regions.length).toBeGreaterThan(QIDAHEN_MAP_REGION_SHAPES.length);
        expect(core.regions.find((region) => region.id === 'jinzhou')?.adjacentRegionIds.length).toBeGreaterThan(0);
    });

it('按当前阵营保留规则来源中的具体势力行动目录', () => {
        expect(getActionChoicesForFaction('ming').map((action) => action.label)).toEqual([
            '突袭作战',
            '征召军队',
            '赐印招安',
            '驱虎吞狼',
        ]);
        expect(getActionChoicesForFaction('mongol').map((action) => action.label)).toEqual([
            '突袭作战',
            '马市贸易',
            '大汗令箭',
        ]);
        expect(getActionChoicesForFaction('jin').map((action) => action.label)).toEqual([
            '突袭作战',
            '联姻诱降',
        ]);
    });

it('剧本一开局人物在场状态遵循规则设置', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);

        expect(core.factions.ming.characters.filter((character) => character.inPlay).map((character) => character.name)).toEqual([]);
        expect(core.factions.mongol.characters.filter((character) => character.inPlay).map((character) => character.name)).toEqual([
            '林丹·乎图克图',
        ]);
        expect(core.factions.jin.characters.filter((character) => character.inPlay).map((character) => character.name)).toEqual([
            '努尔哈赤',
            '额亦都',
        ]);
        expect(core.factions.jin.characters.find((character) => character.id === 'jin-fan-wencheng')?.inPlay).toBe(false);
    });

it('剧本一开局手牌数量遵循规则设置', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);

        expect(core.factions.ming.handCount).toBe(3);
        expect(core.factions.mongol.handCount).toBe(6);
        expect(core.factions.jin.handCount).toBe(10);
        expect(factionHandCards(core, 'ming').filter((card) => card.status === 'payable')).toHaveLength(3);
        expect(factionHandCards(core, 'mongol')).toHaveLength(6);
        expect(factionHandCards(core, 'jin')).toHaveLength(10);
    });

it('剧本一开局普通手牌按 TTS 真实牌堆顺序暴露 atlas05 图集引用，不用替代 UI 遮掉错误素材', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const allVisibleHandCards = [
            ...factionHandCards(core, 'ming'),
            ...factionHandCards(core, 'mongol'),
            ...factionHandCards(core, 'jin'),
        ];
        const expectedAtlasIndices = [
            ...QIDAHEN_ATLAS05_TTS_DECK_SEQUENCE_BY_FACTION.ming.slice(0, factionHandCards(core, 'ming').length),
            ...QIDAHEN_ATLAS05_TTS_DECK_SEQUENCE_BY_FACTION.mongol.slice(0, factionHandCards(core, 'mongol').length),
            ...QIDAHEN_ATLAS05_TTS_DECK_SEQUENCE_BY_FACTION.jin.slice(0, factionHandCards(core, 'jin').length),
        ];

        for (const [index, card] of allVisibleHandCards.entries()) {
            expect(card.previewRef).toMatchObject({
                type: 'atlas',
                atlasId: 'qidahen:atlas05-ordinary-hand-preview',
                index: expectedAtlasIndices[index],
            });
        }
    });

it('剧本一开局正式手牌会消费 atlas05 通过验收的普通手牌身份', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const allVisibleHandCards = [
            ...factionHandCards(core, 'ming'),
            ...factionHandCards(core, 'mongol'),
            ...factionHandCards(core, 'jin'),
        ];

        expect(allVisibleHandCards.every((card) => card.previewKind === 'unknown')).toBe(true);
        expect(allVisibleHandCards.every((card) => card.cardKind !== 'unknown')).toBe(true);
        const expectedInitialIdentities = [
            ...QIDAHEN_ATLAS05_TTS_DECK_SEQUENCE_BY_FACTION.ming.slice(0, factionHandCards(core, 'ming').length),
            ...QIDAHEN_ATLAS05_TTS_DECK_SEQUENCE_BY_FACTION.mongol.slice(0, factionHandCards(core, 'mongol').length),
            ...QIDAHEN_ATLAS05_TTS_DECK_SEQUENCE_BY_FACTION.jin.slice(0, factionHandCards(core, 'jin').length),
        ].map((atlasIndex) => QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITIES.find((identity) => (
            identity.atlasIndex === atlasIndex
        ))!);
        expect(allVisibleHandCards.map((card) => card.cardDefId)).toEqual(
            expectedInitialIdentities.map((identity) => identity.cardDefId),
        );
        expect(allVisibleHandCards.map((card) => card.label)).toEqual(
            expectedInitialIdentities.map((identity) => identity.displayName),
        );
        expect(allVisibleHandCards.map((card) => card.rulesSummary)).toEqual(
            expectedInitialIdentities.map((identity) => (
                QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[identity.cardDefId]
            )),
        );
        expect(factionHandCards(core, 'ming').map((card) => card.cardDefId)).toEqual([
            'qidahen-atlas05-1631-northeast-army',
            'qidahen-atlas05-1644-wuzhen-chaoha',
            'qidahen-atlas05-1643-silver',
            'qidahen-atlas05-1626-artillery-tech',
        ]);
        expect(factionHandCards(core, 'ming')[0]?.previewRef.index).toBeGreaterThanOrEqual(31);
        expect(factionHandCards(core, 'ming')[3]?.cardKind).toBe('armament');
        expect(factionHandCards(core, 'ming')[3]?.armamentId).toBe('artillery-tech');
        expect(factionHandCards(core, 'jin').some((card) => card.cardKind === 'armament')).toBe(true);
    });

it('正式局后续摸牌会继续沿当前势力 TTS 真实牌堆顺序发放普通手牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const drawn = buildDrawnHandCards(core, 'jin', 2);
        const nextCards = drawn.slice(-2);
        const firstDrawnIndex = QIDAHEN_ATLAS05_TTS_DECK_SEQUENCE_BY_FACTION.jin[10];
        const secondDrawnIndex = QIDAHEN_ATLAS05_TTS_DECK_SEQUENCE_BY_FACTION.jin[11];
        const firstDrawnIdentity = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITIES.find((identity) => (
            identity.atlasIndex === firstDrawnIndex
        ));
        const secondDrawnIdentity = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITIES.find((identity) => (
            identity.atlasIndex === secondDrawnIndex
        ));

        expect(nextCards).toHaveLength(2);
        expect(nextCards[0]?.previewRef).toMatchObject({
            type: 'atlas',
            atlasId: 'qidahen:atlas05-ordinary-hand-preview',
            index: firstDrawnIndex,
        });
        expect(nextCards[1]?.previewRef).toMatchObject({
            type: 'atlas',
            atlasId: 'qidahen:atlas05-ordinary-hand-preview',
            index: secondDrawnIndex,
        });
        expect(nextCards.map((card) => card.cardDefId)).toEqual([
            firstDrawnIdentity?.cardDefId,
            secondDrawnIdentity?.cardDefId,
        ]);
        expect(nextCards.map((card) => card.cardKind)).toEqual([
            firstDrawnIdentity?.cardKind,
            secondDrawnIdentity?.cardKind,
        ]);
    });

it('atlas05 普通手牌真相表只解析通过验收的事件、军备、战术和银两身份', () => {
        expect(QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITIES).toHaveLength(49);

        const eventCard = resolveQidahenAtlas05OrdinaryHandCardIdentity(0);
        expect(eventCard).toMatchObject({
            cardKind: 'event',
            armamentId: null,
            cardDefId: 'qidahen-atlas05-1600-counter-spy-plot',
            previewKind: 'unknown',
        });
        expect(getQidahenDirectActionIdForHandCard(eventCard!)).toBe('play-event-card');

        const sevenGrievancesCard = resolveQidahenAtlas05OrdinaryHandCardIdentity(9);
        expect(sevenGrievancesCard).toMatchObject({
            cardKind: 'event',
            armamentId: null,
            cardDefId: 'qidahen-atlas05-1609-seven-grievances',
            previewKind: 'unknown',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1609-seven-grievances'],
        });
        expect(getQidahenDirectActionIdForHandCard(sevenGrievancesCard!)).toBe('play-event-card');

        const armamentCard = resolveQidahenAtlas05OrdinaryHandCardIdentity(3);
        expect(armamentCard).toMatchObject({
            cardKind: 'armament',
            armamentId: 'infantry-armor',
            cardDefId: 'qidahen-atlas05-1603-infantry-armor',
            previewKind: 'unknown',
        });
        expect(getQidahenDirectActionIdForHandCard(armamentCard!)).toBe('upgrade-armament');

        const tacticCard = resolveQidahenAtlas05OrdinaryHandCardIdentity(2);
        expect(tacticCard).toMatchObject({
            cardKind: 'tactic',
            armamentId: null,
            cardDefId: 'qidahen-atlas05-1602-bayara',
            previewKind: 'unknown',
        });
        expect(getQidahenDirectActionIdForHandCard(tacticCard!)).toBeNull();

        const establishedMongolBannersCard = resolveQidahenAtlas05OrdinaryHandCardIdentity(7);
        expect(establishedMongolBannersCard).toMatchObject({
            cardKind: 'event',
            cardDefId: 'qidahen-atlas05-1607-establish-mongol-banners',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1607-establish-mongol-banners'],
        });

        const secondPassedArmamentCard = resolveQidahenAtlas05OrdinaryHandCardIdentity(19);
        expect(secondPassedArmamentCard).toMatchObject({
            cardKind: 'armament',
            armamentId: 'cavalry-armor',
            cardDefId: 'qidahen-atlas05-1619-cavalry-armor-alt',
            previewKind: 'unknown',
        });
        expect(getQidahenDirectActionIdForHandCard(secondPassedArmamentCard!)).toBe('upgrade-armament');

        const promotedEventCard = resolveQidahenAtlas05OrdinaryHandCardIdentity(23);
        expect(promotedEventCard).toMatchObject({
            cardKind: 'event',
            cardDefId: 'qidahen-atlas05-1623-mongol-nobles-congress',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1623-mongol-nobles-congress'],
        });

        const promotedFirstSilverCard = resolveQidahenAtlas05OrdinaryHandCardIdentity(24);
        expect(promotedFirstSilverCard).toMatchObject({
            cardKind: 'silver',
            armamentId: null,
            cardDefId: 'qidahen-atlas05-1624-silver',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1624-silver'],
        });
        expect(getQidahenDirectActionIdForHandCard(promotedFirstSilverCard!)).toBeNull();

        const promotedJadeCasketCard = resolveQidahenAtlas05OrdinaryHandCardIdentity(25);
        expect(promotedJadeCasketCard).toMatchObject({
            cardKind: 'event',
            cardDefId: 'qidahen-atlas05-1625-jade-casket-unearthed',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1625-jade-casket-unearthed'],
        });

        const promotedArmamentCard = resolveQidahenAtlas05OrdinaryHandCardIdentity(26);
        expect(promotedArmamentCard).toMatchObject({
            cardKind: 'armament',
            armamentId: 'artillery-tech',
            cardDefId: 'qidahen-atlas05-1626-artillery-tech',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1626-artillery-tech'],
        });
        expect(getQidahenDirectActionIdForHandCard(promotedArmamentCard!)).toBe('upgrade-armament');

        const promotedInfantryArmorAltCard = resolveQidahenAtlas05OrdinaryHandCardIdentity(27);
        expect(promotedInfantryArmorAltCard).toMatchObject({
            cardKind: 'armament',
            armamentId: 'infantry-armor',
            cardDefId: 'qidahen-atlas05-1627-infantry-armor-alt',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1627-infantry-armor-alt'],
        });
        expect(getQidahenDirectActionIdForHandCard(promotedInfantryArmorAltCard!)).toBe('upgrade-armament');

        const promotedTributeCard = resolveQidahenAtlas05OrdinaryHandCardIdentity(33);
        expect(promotedTributeCard).toMatchObject({
            cardKind: 'event',
            cardDefId: 'qidahen-atlas05-1633-tribute-edict',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1633-tribute-edict'],
        });

        const promotedGinsengCard = resolveQidahenAtlas05OrdinaryHandCardIdentity(30);
        expect(promotedGinsengCard).toMatchObject({
            cardKind: 'event',
            cardDefId: 'qidahen-atlas05-1630-ginseng-and-sable',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1630-ginseng-and-sable'],
        });

        const promotedNortheastArmyCard = resolveQidahenAtlas05OrdinaryHandCardIdentity(31);
        expect(promotedNortheastArmyCard).toMatchObject({
            cardKind: 'event',
            cardDefId: 'qidahen-atlas05-1631-northeast-army',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1631-northeast-army'],
        });

        const promotedPincerAdvanceCard = resolveQidahenAtlas05OrdinaryHandCardIdentity(32);
        expect(promotedPincerAdvanceCard).toMatchObject({
            cardKind: 'tactic',
            cardDefId: 'qidahen-atlas05-1632-pincer-advance',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1632-pincer-advance'],
        });

        const promotedMongolDroughtCard = resolveQidahenAtlas05OrdinaryHandCardIdentity(37);
        expect(promotedMongolDroughtCard).toMatchObject({
            cardKind: 'event',
            cardDefId: 'qidahen-atlas05-1637-mongol-drought-alt',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1637-mongol-drought-alt'],
        });

        const promotedChainCannonCard = resolveQidahenAtlas05OrdinaryHandCardIdentity(38);
        expect(promotedChainCannonCard).toMatchObject({
            cardKind: 'tactic',
            cardDefId: 'qidahen-atlas05-1638-chain-cannon-formation',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1638-chain-cannon-formation'],
        });

        const promotedCavalryFirearmCard = resolveQidahenAtlas05OrdinaryHandCardIdentity(39);
        expect(promotedCavalryFirearmCard).toMatchObject({
            cardKind: 'armament',
            armamentId: 'cavalry-firearm',
            cardDefId: 'qidahen-atlas05-1639-cavalry-firearm',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1639-cavalry-firearm'],
        });
        expect(getQidahenDirectActionIdForHandCard(promotedCavalryFirearmCard!)).toBe('upgrade-armament');

        const promotedJirinaiInfantryCard = resolveQidahenAtlas05OrdinaryHandCardIdentity(40);
        expect(promotedJirinaiInfantryCard).toMatchObject({
            cardKind: 'tactic',
            cardDefId: 'qidahen-atlas05-1640-jirinai-infantry',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1640-jirinai-infantry'],
        });

        const promotedRedCoatCannonCard = resolveQidahenAtlas05OrdinaryHandCardIdentity(34);
        expect(promotedRedCoatCannonCard).toMatchObject({
            cardKind: 'armament',
            armamentId: 'artillery-tech',
            cardDefId: 'qidahen-atlas05-1634-red-coat-cannon',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1634-red-coat-cannon'],
        });
        expect(getQidahenDirectActionIdForHandCard(promotedRedCoatCannonCard!)).toBe('upgrade-armament');

        const promotedSteadfastDefenseCard = resolveQidahenAtlas05OrdinaryHandCardIdentity(35);
        expect(promotedSteadfastDefenseCard).toMatchObject({
            cardKind: 'tactic',
            cardDefId: 'qidahen-atlas05-1635-steadfast-defense',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1635-steadfast-defense'],
        });

        const promotedChevalDeFriseCard = resolveQidahenAtlas05OrdinaryHandCardIdentity(36);
        expect(promotedChevalDeFriseCard).toMatchObject({
            cardKind: 'tactic',
            cardDefId: 'qidahen-atlas05-1636-cheval-de-frise',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1636-cheval-de-frise'],
        });

        const promotedInfantryCavalryCombinedCard = resolveQidahenAtlas05OrdinaryHandCardIdentity(28);
        expect(promotedInfantryCavalryCombinedCard).toMatchObject({
            cardKind: 'tactic',
            cardDefId: 'qidahen-atlas05-1628-infantry-cavalry-combined',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1628-infantry-cavalry-combined'],
        });

        const promotedCavalryArmorThirdCard = resolveQidahenAtlas05OrdinaryHandCardIdentity(41);
        expect(promotedCavalryArmorThirdCard).toMatchObject({
            cardKind: 'armament',
            armamentId: 'cavalry-armor',
            cardDefId: 'qidahen-atlas05-1641-cavalry-armor-third',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1641-cavalry-armor-third'],
        });
        expect(getQidahenDirectActionIdForHandCard(promotedCavalryArmorThirdCard!)).toBe('upgrade-armament');

        const promotedWesternBastionCard = resolveQidahenAtlas05OrdinaryHandCardIdentity(42);
        expect(promotedWesternBastionCard).toMatchObject({
            cardKind: 'armament',
            armamentId: 'western-bastion',
            cardDefId: 'qidahen-atlas05-1642-western-bastion',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1642-western-bastion'],
        });
        expect(getQidahenDirectActionIdForHandCard(promotedWesternBastionCard!)).toBe('upgrade-armament');

        const promotedSecondSilverCard = resolveQidahenAtlas05OrdinaryHandCardIdentity(43);
        expect(promotedSecondSilverCard).toMatchObject({
            cardKind: 'silver',
            armamentId: null,
            cardDefId: 'qidahen-atlas05-1643-silver',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1643-silver'],
        });
        expect(getQidahenDirectActionIdForHandCard(promotedSecondSilverCard!)).toBeNull();

        const promotedWuzhenChaohaCard = resolveQidahenAtlas05OrdinaryHandCardIdentity(44);
        expect(promotedWuzhenChaohaCard).toMatchObject({
            cardKind: 'tactic',
            cardDefId: 'qidahen-atlas05-1644-wuzhen-chaoha',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1644-wuzhen-chaoha'],
        });

        const promotedWarChariotFormationCard = resolveQidahenAtlas05OrdinaryHandCardIdentity(45);
        expect(promotedWarChariotFormationCard).toMatchObject({
            cardKind: 'tactic',
            cardDefId: 'qidahen-atlas05-1645-war-chariot-formation',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1645-war-chariot-formation'],
        });

        const promotedLinkedMusketsCard = resolveQidahenAtlas05OrdinaryHandCardIdentity(46);
        expect(promotedLinkedMusketsCard).toMatchObject({
            cardKind: 'armament',
            armamentId: 'long-barreled-musket',
            cardDefId: 'qidahen-atlas05-1646-linked-muskets',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1646-linked-muskets'],
        });
        expect(getQidahenDirectActionIdForHandCard(promotedLinkedMusketsCard!)).toBe('upgrade-armament');

        expect(resolveQidahenAtlas05OrdinaryHandCardIdentity(47)).toBeNull();

        const wuzhenChaohaSpecialCard = resolveQidahenAtlas05OrdinaryHandCardIdentity(50);
        expect(wuzhenChaohaSpecialCard).toMatchObject({
            cardKind: 'tactic',
            armamentId: null,
            cardDefId: 'qidahen-atlas05-1650-wuzhen-chaoha-special',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1650-wuzhen-chaoha-special'],
        });
        expect(getQidahenDirectActionIdForHandCard(wuzhenChaohaSpecialCard!)).toBeNull();

        const feignedRetreatCard = resolveQidahenAtlas05OrdinaryHandCardIdentity(60);
        expect(feignedRetreatCard).toMatchObject({
            cardKind: 'tactic',
            armamentId: null,
            cardDefId: 'qidahen-atlas05-1660-feigned-retreat-lure-enemy',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1660-feigned-retreat-lure-enemy'],
        });
        expect(getQidahenDirectActionIdForHandCard(feignedRetreatCard!)).toBeNull();
    });

it('剧本一开局已开发军备遵循规则设置', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);

        expect(core.factions.ming.armaments).toEqual([
            { id: 'artillery-tech', name: '火炮技术', level: 1 },
            { id: 'infantry-armor', name: '步兵铁甲', level: 0 },
            { id: 'cavalry-armor', name: '骑兵铁甲', level: 0 },
            { id: 'western-bastion', name: '西式棱堡', level: 0 },
            { id: 'long-barreled-musket', name: '长管火铳', level: 0 },
            { id: 'cavalry-firearm', name: '骑兵火器', level: 0 },
            { id: 'manzhou-banners', name: '满州八旗', level: 0 },
            { id: 'horse-breeding', name: '骏马育种', level: 0 },
            { id: 'mongol-banners', name: '蒙古八旗', level: 0 },
            { id: 'han-banners', name: '汉军八旗', level: 0 },
        ]);
        expect(core.factions.mongol.armaments).toEqual([
            { id: 'artillery-tech', name: '火炮技术', level: 0 },
            { id: 'infantry-armor', name: '步兵铁甲', level: 0 },
            { id: 'cavalry-armor', name: '骑兵铁甲', level: 1 },
            { id: 'western-bastion', name: '西式棱堡', level: 0 },
            { id: 'long-barreled-musket', name: '长管火铳', level: 0 },
            { id: 'cavalry-firearm', name: '骑兵火器', level: 0 },
            { id: 'manzhou-banners', name: '满州八旗', level: 0 },
            { id: 'horse-breeding', name: '骏马育种', level: 0 },
            { id: 'mongol-banners', name: '蒙古八旗', level: 0 },
            { id: 'han-banners', name: '汉军八旗', level: 0 },
        ]);
        expect(core.factions.jin.armaments).toEqual([
            { id: 'artillery-tech', name: '火炮技术', level: 0 },
            { id: 'infantry-armor', name: '步兵铁甲', level: 1 },
            { id: 'cavalry-armor', name: '骑兵铁甲', level: 0 },
            { id: 'western-bastion', name: '西式棱堡', level: 0 },
            { id: 'long-barreled-musket', name: '长管火铳', level: 0 },
            { id: 'cavalry-firearm', name: '骑兵火器', level: 0 },
            { id: 'manzhou-banners', name: '满州八旗', level: 0 },
            { id: 'horse-breeding', name: '骏马育种', level: 0 },
            { id: 'mongol-banners', name: '蒙古八旗', level: 0 },
            { id: 'han-banners', name: '汉军八旗', level: 0 },
        ]);
    });

it('会为关键借位区和高置信图区同时生成逻辑规则区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const regionsById = new Map(core.regions.map((region) => [region.id, region]));

        expect(regionsById.get('city-region-19')).toMatchObject({
            id: 'city-region-19',
            name: '敖汉部',
            isLogicalRegion: false,
        });
        expect(regionsById.get('city-region-24')).toMatchObject({
            id: 'city-region-24',
            name: '宣府',
            isLogicalRegion: false,
        });
        expect(regionsById.get('city-region-28')).toMatchObject({
            id: 'city-region-28',
            name: '顺天',
            isLogicalRegion: false,
        });
        expect(regionsById.get('city-region-28-jizhen')).toMatchObject({
            id: 'city-region-28-jizhen',
            name: '蓟镇',
            isLogicalRegion: false,
        });
        expect(regionsById.get('city-region-15-liaodong')).toMatchObject({
            id: 'city-region-15-liaodong',
            name: '辽东',
            isLogicalRegion: false,
        });

        expect(regionsById.get('liao-xi')).toMatchObject({
            id: 'liao-xi',
            name: '辽西',
            isLogicalRegion: true,
            primaryRuntimeRegionId: 'city-region-19-liaoxi',
            runtimeRegionIds: ['city-region-19-liaoxi'],
        });
        expect(regionsById.get('ning-yuan')).toMatchObject({
            id: 'ning-yuan',
            name: '宁远',
            isLogicalRegion: true,
            primaryRuntimeRegionId: 'city-region-24',
            runtimeRegionIds: ['city-region-24'],
        });
        expect(regionsById.get('ji-zhen')).toMatchObject({
            id: 'ji-zhen',
            name: '蓟镇',
            isLogicalRegion: true,
            primaryRuntimeRegionId: 'city-region-28-jizhen',
            runtimeRegionIds: ['city-region-28-jizhen'],
        });
        expect(regionsById.get('liao-bei')).toMatchObject({
            id: 'liao-bei',
            name: '辽北',
            isLogicalRegion: true,
            primaryRuntimeRegionId: 'city-region-15',
            runtimeRegionIds: ['city-region-15'],
        });
        expect(regionsById.get('liao-dong')).toMatchObject({
            id: 'liao-dong',
            name: '辽东',
            isLogicalRegion: true,
            primaryRuntimeRegionId: 'city-region-15-liaodong',
            runtimeRegionIds: ['city-region-15-liaodong'],
        });
        expect(regionsById.get('xuan-fu')).toMatchObject({
            id: 'xuan-fu',
            name: '宣府',
            isLogicalRegion: true,
            primaryRuntimeRegionId: 'city-region-24',
            runtimeRegionIds: ['city-region-24'],
        });
        expect(regionsById.get('shun-tian')).toMatchObject({
            id: 'shun-tian',
            name: '顺天',
            isLogicalRegion: true,
            primaryRuntimeRegionId: 'city-region-28',
            runtimeRegionIds: ['city-region-28'],
        });
        expect(regionsById.get('xuan-fu')?.troops).toBe(regionsById.get('city-region-24')?.troops);
        expect(regionsById.get('shun-tian')?.controller).toBe(regionsById.get('city-region-28')?.controller);
        expect(regionsById.get('liao-dong')?.population).toBe(regionsById.get('city-region-15-liaodong')?.population);
        const fortificationConfigs = getQidahenFortificationConfigs();
        expect(fortificationConfigs.find((fortification) => fortification.id === 'shanhaiguan')?.dependencyRegionId).toBe('ji-zhen');
        expect(fortificationConfigs.find((fortification) => fortification.id === 'ningyuan')?.dependencyRegionId).toBe('liao-xi');
        expect(fortificationConfigs.find((fortification) => fortification.id === 'jinzhou')?.dependencyRegionId).toBe('liao-xi');
    });

it('升级军备不能脱离已识别军备牌退回抽象势力行动按钮', () => {
        const validation = QidahenDomain.validate(stateOf(QidahenDomain.setup(['0', '1', '2'], random)), {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'upgrade-armament' },
        });

        expect(validation).toEqual({ valid: false, error: 'unknownPaymentCard' });
    });

it('从已识别军备手牌进入升级军备时，会把这张军备牌作为手牌行动来源锁进支付', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [armamentCard, paymentCard] = factionHandCards(core, 'ming');
        const mappedCore: QidahenCore = {
            ...core,
            handCards: core.handCards.map((card) => (
                card.id === armamentCard.id
                    ? {
                        ...card,
                        label: '火炮技术',
                        cardKind: 'armament' as const,
                        armamentId: 'artillery-tech' as const,
                        cardDefId: 'test-ming-artillery-tech',
                    }
                    : card
            )),
        };

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'upgrade-armament', sourceHandCardId: armamentCard.id },
        });

        expect(previewed.selectedHandActionCardId).toBe(armamentCard.id);
        expect(previewed.selectedPaymentCardIds).toEqual([armamentCard.id]);
        expect(previewed.payment).toMatchObject({
            required: 2,
            selected: 1,
            prompt: '需弃 2 / 已选 1',
        });

        const stillLocked = apply(previewed, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: armamentCard.id },
        });
        expect(stillLocked.selectedPaymentCardIds).toEqual([armamentCard.id]);

        const paid = apply(stillLocked, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: paymentCard.id },
        });
        expect(paid.selectedPaymentCardIds).toEqual([armamentCard.id, paymentCard.id]);
        expect(paid.payment).toMatchObject({
            required: 2,
            selected: 2,
            prompt: '需弃 2 / 已选 2',
        });

        const executed = apply(paid, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '0',
            payload: {},
        });
        expect(executed.factions.ming.armaments.find((armament) => armament.id === 'artillery-tech')?.level).toBe(2);
        expect(executed.factions.ming.armaments.find((armament) => armament.id === 'artillery-tech')?.sourceCardDefIds)
            .toContain('test-ming-artillery-tech');
        expect(executed.selectedHandActionCardId).toBeNull();
        expect(executed.handCards.some((card) => card.id === armamentCard.id)).toBe(false);
        expect(executed.handCards.some((card) => card.id === paymentCard.id)).toBe(false);
    });

it('atlas05 已核对军备牌全集都能直点升级军备并指向对应军备', () => {
        const armamentIdentities = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITIES
            .filter((identity) => identity.cardKind === 'armament');
        expect(armamentIdentities).toHaveLength(12);

        for (const identity of armamentIdentities) {
            const core = QidahenDomain.setup(['0', '1', '2'], random);
            const [sourceCard, paymentCard] = factionHandCards(core, 'ming');
            expect(sourceCard).toBeDefined();
            expect(paymentCard).toBeDefined();
            const mappedCore: QidahenCore = {
                ...core,
                factions: {
                    ...core.factions,
                    ming: {
                        ...core.factions.ming,
                        armaments: core.factions.ming.armaments.map((armament) => ({
                            ...armament,
                            level: armament.id === identity.armamentId ? 1 : 0,
                        })),
                    },
                },
                handCards: core.handCards.map((card) => (
                    card.id === sourceCard.id
                        ? {
                            ...card,
                            label: identity.displayName,
                            cardKind: identity.cardKind,
                            armamentId: identity.armamentId,
                            cardDefId: identity.cardDefId,
                            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[identity.cardDefId],
                        }
                        : card
                )),
            };
            const mappedSourceCard = mappedCore.handCards.find((card) => card.id === sourceCard.id)!;

            expect(getQidahenDirectActionIdForHandCard(mappedSourceCard)).toBe('upgrade-armament');

            const previewed = apply(mappedCore, {
                type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
                playerId: '0',
                payload: { actionId: 'upgrade-armament', sourceHandCardId: sourceCard.id },
            });
            const paid = apply(previewed, {
                type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
                playerId: '0',
                payload: { cardId: paymentCard.id },
            });
            const executed = apply(paid, {
                type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
                playerId: '0',
                payload: {},
            });

            expect(executed.factions.ming.armaments.find((armament) => armament.id === identity.armamentId)?.level).toBe(2);
            expect(executed.factions.ming.armaments.find((armament) => armament.id === identity.armamentId)?.sourceCardDefIds)
                .toContain(identity.cardDefId);
            expect(executed.lastSeasonSummary?.lines.join(' ')).toContain(identity.displayName);
        }
    });

it('atlas05 已确认事件牌全集都能从手牌本体进入执行事件入口，并拦截未闭合归属链', () => {
        const eventIdentities = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITIES
            .filter((identity) => identity.cardKind === 'event');
        expect(eventIdentities.length).toBeGreaterThan(0);

        for (const identity of eventIdentities) {
            const core = QidahenDomain.setup(['0', '1', '2'], random);
            const [sourceCard] = factionHandCards(core, 'ming');
            expect(sourceCard).toBeDefined();
            const mappedCore: QidahenCore = {
                ...core,
                handCards: core.handCards.map((card) => (
                    card.id === sourceCard.id
                        ? {
                            ...card,
                            label: identity.displayName,
                            cardKind: identity.cardKind,
                            armamentId: identity.armamentId,
                            cardDefId: identity.cardDefId,
                            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[identity.cardDefId],
                        }
                        : card
                )),
            };
            const mappedSourceCard = mappedCore.handCards.find((card) => card.id === sourceCard.id)!;
            const isCounterSpyPlot = identity.cardDefId === 'qidahen-atlas05-1600-counter-spy-plot';
            const isTributeEdict = identity.cardDefId === 'qidahen-atlas05-1633-tribute-edict';
            const requiredPaymentCount = isCounterSpyPlot ? 3 : isTributeEdict ? 2 : 1;

            expect(getQidahenDirectActionIdForHandCard(mappedSourceCard)).toBe('play-event-card');

            const previewed = apply(mappedCore, {
                type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
                playerId: '0',
                payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
            });
            expect(previewed.selectedHandActionCardId).toBe(sourceCard.id);
            expect(previewed.selectedPaymentCardIds).toEqual([sourceCard.id]);
            expect(previewed.payment).toMatchObject({
                required: requiredPaymentCount,
                selected: 1,
                prompt: `需弃 ${requiredPaymentCount} / 已选 1`,
            });

            const paymentCards = factionHandCards(previewed, 'ming')
                .filter((card) => card.id !== sourceCard.id)
                .slice(0, requiredPaymentCount - 1);
            const payable = paymentCards.reduce((nextState, paymentCard) => (
                apply(nextState, {
                    type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
                    playerId: '0',
                    payload: { cardId: paymentCard.id },
                })
            ), previewed);
            const executed = apply(payable, {
                type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
                playerId: '0',
                payload: {},
            });
            const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[identity.cardDefId];
            const isRemovedFromGameEvent = rulesSummary.includes('使用后移出游戏');
            const isPersistentEvent = rulesSummary.includes('持续事件');
            const requiresOpponentDiscardOwner = rulesSummary.includes('放入该对手弃牌堆');
            const isGinsengAndSable = identity.cardDefId === 'qidahen-atlas05-1630-ginseng-and-sable';
            const isMongolNoblesCongress = identity.cardDefId === 'qidahen-atlas05-1623-mongol-nobles-congress';
            const isPowerStruggleCoup = identity.cardDefId === 'qidahen-atlas05-1621-power-struggle-coup';
            const isDefeatInDetail = identity.cardDefId === 'qidahen-atlas05-1601-defeat-in-detail';
            const requiresUnimplementedTargetChoice = (rulesSummary.includes('指定并移除一张对手场上的人物牌') && !isCounterSpyPlot)
                || (rulesSummary.includes('执行两项效果之一') && !isMongolNoblesCongress && !isPowerStruggleCoup);
            const isNortheastArmy = identity.cardDefId === 'qidahen-atlas05-1631-northeast-army';
            const requiresUnimplementedTimingOrBoardTarget = isDefeatInDetail
                || (rulesSummary.includes('放置甲喇标记') && !isNortheastArmy);
            const doesNotEnterDiscardPile = isRemovedFromGameEvent || isPersistentEvent;

            if (isCounterSpyPlot) {
                expect(executed.turnPhase).toBe('event-character-target');
                expect(executed.handCards.some((card) => card.id === sourceCard.id)).toBe(true);
                expect(executed.discardPileCount).toBe(core.discardPileCount);
                expect(executed.factions.ming.discardPileCount).toBe(core.factions.ming.discardPileCount);
                expect(getQidahenEventCharacterTargetSelectionForCore(executed)).toMatchObject({
                    title: '反间计',
                    eventCardId: sourceCard.id,
                    eventCardDefId: identity.cardDefId,
                    ownerFactionId: 'ming',
                });
                continue;
            }

            if (isTributeEdict) {
                expect(executed.turnPhase).toBe('event-opponent-hand-choice');
                expect(executed.handCards.some((card) => card.id === sourceCard.id)).toBe(true);
                expect(executed.discardPileCount).toBe(core.discardPileCount);
                expect(executed.factions.ming.discardPileCount).toBe(core.factions.ming.discardPileCount);
                expect(getQidahenEventOpponentHandChoiceSelectionForCore(executed)).toMatchObject({
                    source: 'tribute-edict-opponent',
                    title: '封贡敕书',
                    eventCardId: sourceCard.id,
                    eventCardDefId: identity.cardDefId,
                    ownerFactionId: 'ming',
                });
                expect(executed.lastSeasonSummary?.title).toBe('封贡敕书');
                expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('由该对手选择执行赐印招安或驱虎吞狼');
                continue;
            }

            if (isPowerStruggleCoup) {
                expect(executed.turnPhase).toBe('open-gate-surrender');
                expect(executed.handCards.some((card) => card.id === sourceCard.id)).toBe(true);
                expect(executed.discardPileCount).toBe(core.discardPileCount);
                expect(executed.factions.ming.discardPileCount).toBe(core.factions.ming.discardPileCount);
                expect(executed.openGateSurrenderSelection).toMatchObject({
                    phase: 'choose-effects',
                    eventCardId: sourceCard.id,
                    eventCardDefId: identity.cardDefId,
                    ownerFactionId: 'ming',
                });
                expect(executed.lastSeasonSummary?.title).toBe('开门迎降');
                expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('选择只执行第一项、只执行第二项，或依次执行两项');
                expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('第一项由后金处理人物与部队损失');
                continue;
            }

            if (
                (requiresOpponentDiscardOwner && !isGinsengAndSable)
                || requiresUnimplementedTargetChoice
                || requiresUnimplementedTimingOrBoardTarget
            ) {
                expect(executed.handCards.some((card) => card.id === sourceCard.id)).toBe(true);
                expect(executed.discardPileCount).toBe(core.discardPileCount);
                expect(executed.factions.ming.discardPileCount).toBe(core.factions.ming.discardPileCount);
                expect(executed.lastSeasonSummary?.title).toBe('执行事件');
                expect(executed.lastSeasonSummary?.lines.join(' ')).toContain(identity.displayName);
                expect(executed.lastSeasonSummary?.lines.join(' ')).toMatch(/需要指定对手|需要目标选择|需要目标选择或二择一效果选择|需要特定打出时机或地图目标选择/);
                expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('本次未消耗手牌');
                expect(executed.actionLog[0]?.text).toContain(`尝试执行事件「${identity.displayName}」`);
                continue;
            }

            expect(executed.handCards.some((card) => card.id === sourceCard.id)).toBe(false);
            expect(executed.discardPileCount).toBe(core.discardPileCount + (doesNotEnterDiscardPile ? 0 : 1));
            expect(executed.factions.ming.discardPileCount).toBe(
                core.factions.ming.discardPileCount + (doesNotEnterDiscardPile ? 0 : 1),
            );
            expect(executed.lastSeasonSummary?.title).toBe('执行事件');
            expect(executed.lastSeasonSummary?.lines.join(' ')).toContain(`打出事件牌：${identity.displayName}`);
            expect(executed.lastSeasonSummary?.lines.join(' ')).toContain(rulesSummary);
            if (isMongolNoblesCongress) {
                expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('大明使用王公大会无效果');
            }
            if (isGinsengAndSable) {
                expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('大明使用人参貂皮无效果');
            }
            if (identity.cardDefId === 'qidahen-atlas05-1609-seven-grievances') {
                expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('大明使用七大恨无效果');
            }
            if (isPersistentEvent) {
                expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('持续事件：此牌未进入弃牌堆');
                expect(executed.actionLog[0]?.text).toContain('打出为持续事件，不进入弃牌堆');
                expect(executed.activeEventCards).toEqual(expect.arrayContaining([
                    expect.objectContaining({
                        cardDefId: identity.cardDefId,
                        label: identity.displayName,
                        ownerFactionId: 'ming',
                        rulesSummary,
                    }),
                ]));
            } else if (isRemovedFromGameEvent) {
                expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('使用后移出游戏：此牌未进入弃牌堆。');
                expect(executed.actionLog[0]?.text).toContain('打出并移出游戏');
            } else {
                expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('使用后进入当前势力弃牌堆。');
            }
            if (!isPersistentEvent) {
                expect(executed.activeEventCards.some((card) => card.cardDefId === identity.cardDefId)).toBe(false);
            }
            expect(executed.actionLog[0]?.text).toContain(`执行事件「${identity.displayName}」`);
        }
    });
});
