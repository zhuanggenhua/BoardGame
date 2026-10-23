import { describe, expect, it } from 'vitest';
import { QidahenDomain } from '../domain';
import { QIDAHEN_COMMANDS } from '../domain/commands';
import {
    beginQidahenWheelRecruitTrain,
    getQidahenWheelRecruitTrainChoices,
} from '../domain/wheelRecruitTrain';
import type { QidahenCore } from '../domain/types';
import {
    apply,
    factionHandCards,
    random,
    stateOf,
} from './helpers/paymentSelectionHarness';

const enterRecruitTrain = (core: QidahenCore): QidahenCore => apply({
    ...core,
    actionWheelPosition: 'wheel-military-farm',
    selectedRegionId: 'city-region-24',
}, {
    type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
    playerId: core.currentPlayer,
    payload: { moveId: 'move-1-free' },
});

const payOneCard = (core: QidahenCore): QidahenCore => {
    const factionId = core.currentPlayer === '0' ? 'ming' : core.currentPlayer === '1' ? 'mongol' : 'jin';
    const card = factionHandCards(core, factionId).find((candidate) => candidate.status !== 'disabled');
    expect(card).toBeTruthy();
    const selected = apply(core, {
        type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
        playerId: core.currentPlayer,
        payload: { cardId: card!.id },
    });
    return apply(selected, {
        type: QIDAHEN_COMMANDS.CONFIRM_WHEEL_RECRUIT_TRAIN_PAYMENT,
        playerId: core.currentPlayer,
        payload: {},
    });
};

const resolveChoice = (core: QidahenCore, choiceId: string): QidahenCore => apply(core, {
    type: QIDAHEN_COMMANDS.RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE,
    playerId: core.currentPlayer,
    payload: { choiceId },
});

describe('七大恨征兵训练交互', () => {
    it('轮盘落点先弃一张手牌，再由玩家选择本土征兵并建立一支二级正规军', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const pending = enterRecruitTrain(core);

        expect(pending.wheelRecruitTrainProgress).toMatchObject({
            source: 'wheel',
            phase: 'payment',
            paymentPurpose: 'initial',
            actionsCompleted: 0,
        });
        expect(pending.regions.find((region) => region.id === 'city-region-24')?.troops)
            .toBe(core.regions.find((region) => region.id === 'city-region-24')?.troops);
        expect(QidahenDomain.validate(stateOf(pending), {
            type: QIDAHEN_COMMANDS.CONFIRM_WHEEL_RECRUIT_TRAIN_PAYMENT,
            playerId: '0',
            payload: {},
        }).valid).toBe(false);

        const paid = payOneCard(pending);
        expect(paid.factions.ming.handCount).toBe(pending.factions.ming.handCount - 1);
        expect(paid.factions.ming.discardPileCount).toBe((pending.factions.ming.discardPileCount ?? 0) + 1);
        expect(paid.wheelRecruitTrainProgress?.phase).toBe('choose-action');

        const choosingRecruit = resolveChoice(paid, 'action:recruit');
        const recruitTargets = getQidahenWheelRecruitTrainChoices(choosingRecruit);
        const target = recruitTargets.find((choice) => choice.id === 'recruit:city-region-19-liaoxi');
        expect(target).toBeTruthy();
        expect(recruitTargets.every((choice) => choice.kind === 'recruit-target')).toBe(true);

        const recruited = resolveChoice(choosingRecruit, target!.id);
        const region = recruited.regions.find((candidate) => candidate.id === 'city-region-19-liaoxi');
        expect(recruited.wheelRecruitTrainProgress).toMatchObject({ phase: 'choose-action', actionsCompleted: 1 });
        expect(region?.troops).toBe((pending.regions.find((candidate) => candidate.id === 'city-region-19-liaoxi')?.troops ?? 0) + 1);
        expect(region?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({ faction: 'ming', troopClass: 'regular', count: 1, level: 2 }),
        ]));

        const finished = resolveChoice(recruited, 'finish');
        expect(finished.wheelRecruitTrainProgress).toBeNull();
        expect(finished.lastSeasonSummary?.title).toBe('轮盘征兵/训练');
        expect(finished.turnPhase).toBe('action-window');
        expect(finished.wheelActionUsed).toBe(true);
    });

    it('训练只能选一支本回合尚未训练的部队，炮兵等级受火炮技术限制', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const armedCore: QidahenCore = {
            ...core,
            factions: {
                ...core.factions,
                ming: {
                    ...core.factions.ming,
                    armaments: core.factions.ming.armaments.map((armament) => (
                        armament.id === 'artillery-tech' ? { ...armament, level: 2 } : armament
                    )),
                },
            },
            regions: core.regions.map((region) => region.id === 'city-region-24' ? {
                ...region,
                controller: 'ming',
                troops: 2,
                specialTroops: [
                    { id: 'ming-test-artillery-lv1', label: '大明炮兵', faction: 'ming', troopKind: 'artillery', count: 1, level: 1 },
                ],
                cityState: null,
                siegeState: null,
                diplomacyMarkerFaction: null,
                diplomacyMarkerSide: null,
            } : region),
        };
        const pending = enterRecruitTrain(armedCore);
        const paid = payOneCard(pending);
        const choosingTarget = resolveChoice(paid, 'action:train');
        const artillery = getQidahenWheelRecruitTrainChoices(choosingTarget)
            .find((choice) => choice.sourceStackId === 'ming-test-artillery-lv1');
        expect(artillery).toMatchObject({ level: 1, targetLevel: 2, troopKind: 'artillery' });

        const trained = resolveChoice(choosingTarget, artillery!.id);
        expect(trained.wheelRecruitTrainProgress).toMatchObject({ phase: 'choose-action', actionsCompleted: 1 });
        expect(trained.trainedTroopPieceIdsThisTurn).toContain(artillery!.pieceId);
        expect(getQidahenWheelRecruitTrainChoices(trained).some((choice) => (
            choice.pieceId === artillery!.pieceId
        ))).toBe(false);
        expect(trained.regions.find((region) => region.id === 'city-region-24')?.specialTroops)
            .toEqual(expect.arrayContaining([
                expect.objectContaining({ troopKind: 'artillery', level: 2 }),
            ]));
    });

    it('年中只能训练；额外弃牌增加一次额外训练，不占用四次基础行动', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const regionId = 'city-region-24';
        const withTroops: QidahenCore = {
            ...core,
            actionWheelPosition: 'wheel-midyear',
            regions: core.regions.map((region) => region.id === regionId ? {
                ...region,
                controller: 'ming',
                troops: 2,
                specialTroops: [],
                cityState: null,
                siegeState: null,
                diplomacyMarkerFaction: null,
                diplomacyMarkerSide: null,
            } : region),
        };
        const started = beginQidahenWheelRecruitTrain(withTroops, 'wheel', 1);
        const paid = payOneCard(started);
        const actions = getQidahenWheelRecruitTrainChoices(paid);
        expect(started.wheelRecruitTrainProgress?.trainingOnly).toBe(true);
        expect(actions.map((choice) => choice.id)).not.toContain('action:recruit');
        expect(actions.map((choice) => choice.id)).toContain('action:train');

        const trainingTarget = resolveChoice(resolveChoice(paid, 'action:train'), 'train:generic:field:city-region-24:1');
        expect(trainingTarget.wheelRecruitTrainProgress).toMatchObject({ actionsCompleted: 1, extraTrainingsCompleted: 0 });
        const extraPayment = resolveChoice(trainingTarget, 'extra-training');
        expect(extraPayment.wheelRecruitTrainProgress).toMatchObject({ phase: 'payment', paymentPurpose: 'extra' });
        const afterExtraPayment = payOneCard(extraPayment);
        expect(afterExtraPayment.wheelRecruitTrainProgress).toMatchObject({
            phase: 'extra-training-target',
            actionsCompleted: 1,
            extraTrainingsCompleted: 0,
        });
        const secondPiece = getQidahenWheelRecruitTrainChoices(afterExtraPayment)[0];
        expect(secondPiece?.pieceId).not.toBe('generic:field:city-region-24:1');
        const afterExtraTraining = resolveChoice(afterExtraPayment, secondPiece!.id);
        expect(afterExtraTraining.wheelRecruitTrainProgress).toMatchObject({
            phase: 'choose-action',
            actionsCompleted: 1,
            extraTrainingsCompleted: 1,
        });
    });

    it.each([
        ['大明普通步兵', 'ming', 'ming', 'infantry', 'regular', '大明正规步兵', false],
        ['蒙古正规骑兵', 'mongol', 'mongol', 'cavalry', 'regular', '蒙古正规骑兵', true],
        ['蒙古正规步兵', 'mongol', 'mongol', 'infantry', 'regular', '蒙古正规步兵', false],
        ['后金正规步兵', 'jin', 'jin', 'infantry', 'regular', '后金正规步兵', true],
        ['后金正规骑兵', 'jin', 'jin', 'cavalry', 'regular', '后金正规骑兵', false],
        ['大明川兵', 'ming', 'ming', 'infantry', 'regular', '大明川兵', true],
        ['雇佣步兵', 'ming', 'ming', 'infantry', 'auxiliary', '雇佣军', false],
    ] as const)(
        '%s 的等级 3 上限按规则判定',
        (_name, controllerFaction, originalFaction, troopKind, troopClass, label, canReachLevel4) => {
            const core = QidahenDomain.setup(['0', '1', '2'], random);
            const troopId = `training-cap-${label}`;
            const configuredCore: QidahenCore = {
                ...core,
                currentPlayer: controllerFaction === 'ming' ? '0' : controllerFaction === 'mongol' ? '1' : '2',
                trainedTroopPieceIdsThisTurn: [],
                regions: core.regions.map((region) => region.id === 'city-region-24' ? {
                    ...region,
                    controller: controllerFaction,
                    troops: 1,
                    cityState: null,
                    siegeState: null,
                    specialTroops: [{
                        id: troopId,
                        pieceIds: [`${troopId}:piece`],
                        label,
                        faction: controllerFaction,
                        originalFaction,
                        troopClass,
                        troopKind,
                        count: 1,
                        level: 3,
                    }],
                } : region),
            };
            const choosingTraining = resolveChoice(
                beginQidahenWheelRecruitTrain(configuredCore, 'wheel', 1, true),
                'action:train',
            );
            const candidates = getQidahenWheelRecruitTrainChoices(choosingTraining);
            expect(candidates.some((choice) => choice.pieceId === `${troopId}:piece`)).toBe(canReachLevel4);
            if (canReachLevel4) {
                expect(candidates.find((choice) => choice.pieceId === `${troopId}:piece`)).toMatchObject({
                    level: 3,
                    targetLevel: 4,
                });
            }
        },
    );

    it('炮兵训练上限不得超过火炮技术等级，未开发时不可训练', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const regionId = 'city-region-24';
        const artilleryCore: QidahenCore = {
            ...core,
            trainedTroopPieceIdsThisTurn: [],
            regions: core.regions.map((region) => region.id === regionId ? {
                ...region,
                controller: 'ming',
                troops: 1,
                cityState: null,
                siegeState: null,
                specialTroops: [{
                    id: 'training-cap-artillery',
                    pieceIds: ['training-cap-artillery:piece'],
                    label: '大明炮兵',
                    faction: 'ming',
                    originalFaction: 'ming',
                    troopClass: 'regular',
                    troopKind: 'artillery',
                    count: 1,
                    level: 1,
                }],
            } : region),
        };
        const atTechLevel = (techLevel: number) => {
            const state = {
                ...artilleryCore,
                factions: {
                    ...artilleryCore.factions,
                    ming: {
                        ...artilleryCore.factions.ming,
                        armaments: artilleryCore.factions.ming.armaments.map((armament) => (
                            armament.id === 'artillery-tech' ? { ...armament, level: techLevel } : armament
                        )),
                    },
                },
            };
            return getQidahenWheelRecruitTrainChoices(
                resolveChoice(beginQidahenWheelRecruitTrain(state, 'wheel', 1, true), 'action:train'),
            ).find((choice) => choice.pieceId === 'training-cap-artillery:piece');
        };

        expect(atTechLevel(0)).toBeUndefined();
        expect(atTechLevel(1)).toBeUndefined();
        expect(atTechLevel(2)).toMatchObject({ level: 1, targetLevel: 2 });
    });

    it('二人局由后金控制的蒙古雇佣骑兵可按组件例外升至 4 级', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const jinPlayerId = core.factions.jin.playerId;
        const twoPlayerCore: QidahenCore = {
            ...core,
            currentPlayer: jinPlayerId,
            factions: {
                ...core.factions,
                mongol: { ...core.factions.mongol, playerId: 'qidahen-neutral-mongol' },
            },
            regions: core.regions.map((region) => region.id === 'city-region-24' ? {
                ...region,
                controller: 'jin',
                troops: 1,
                cityState: null,
                siegeState: null,
                specialTroops: [{
                    id: 'jin-mongol-mercenary-cavalry',
                    pieceIds: ['jin-mongol-mercenary-cavalry:piece'],
                    label: '蒙古雇佣骑兵',
                    faction: 'jin',
                    originalFaction: 'mongol',
                    troopClass: 'auxiliary',
                    troopKind: 'cavalry',
                    count: 1,
                    level: 3,
                }],
            } : region),
        };
        const choices = getQidahenWheelRecruitTrainChoices(
            resolveChoice(beginQidahenWheelRecruitTrain(twoPlayerCore, 'wheel', 1, true), 'action:train'),
        );
        expect(choices.find((choice) => choice.pieceId === 'jin-mongol-mercenary-cavalry:piece'))
            .toMatchObject({ level: 3, targetLevel: 4 });
    });
});
