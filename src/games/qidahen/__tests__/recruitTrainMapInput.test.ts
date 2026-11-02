import { describe, expect, it } from 'vitest';
import { QidahenDomain } from '../domain';
import { QIDAHEN_COMMANDS } from '../domain/commands';
import { beginQidahenWheelRecruitTrain, getQidahenWheelRecruitTrainChoices } from '../domain/wheelRecruitTrain';
import { syncQidahenCorePieceCollections } from '../domain/coreDerivedState';
import { getQidahenRecruitTrainMapInput } from '../ui/recruitTrainMapInput';
import { apply, random } from './helpers/paymentSelectionHarness';

function initial() {
    const setup = QidahenDomain.setup(['0', '1', '2'], random);
    return { ...setup, currentPlayer: setup.factions.ming.playerId, actionWheelPosition: 'wheel-recruit-train' };
}
const choose = (core: ReturnType<typeof initial>, choiceId: string) => apply(core, {
    type: QIDAHEN_COMMANDS.RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE, playerId: core.currentPlayer, payload: { choiceId },
});

describe('征兵训练的正式候选与地图本体对应', () => {
    it('点击具体兵牌只训练该实体，同地区其它部队不会被替代选择', () => {
        const core = choose(beginQidahenWheelRecruitTrain(initial(), 'wheel', 1, true), 'action:train');
        const input = getQidahenRecruitTrainMapInput(core);
        const token = core.mapTokens.find(item => item.pieceId && input.tokenIds.includes(item.id))!;
        const selected = input.choiceFor(token.regionId!, token.id)!;
        expect(selected.pieceId).toBe(token.pieceId);
        expect(input.choiceFor(token.regionId!)).toBeUndefined();
        const trained = choose(core, selected.id);
        expect(trained.pieces.find(piece => piece.id === token.pieceId)?.level).toBe(selected.targetLevel);
        for (const piece of core.pieces.filter(piece => piece.id !== token.pieceId)) {
            expect(trained.pieces.find(item => item.id === piece.id)?.level).toBe(piece.level);
        }
        const next = choose(trained, 'action:train');
        expect(getQidahenRecruitTrainMapInput(next).tokenIds).not.toContain(token.id);
    });

    it.each(['field', 'city'] as const)('%s 两支普通部队各自对应可见兵牌，训练后重新投影', location => {
        const setup = initial();
        const regionId = 'city-region-24';
        const cityRegion = setup.regions.find(region => region.cityState);
        if (!cityRegion || !cityRegion.cityState) throw new Error('预期测试棋盘包含城市区域');
        const city = cityRegion.cityState;
        const configured = syncQidahenCorePieceCollections({ ...setup, regions: setup.regions.map(region => region.id === regionId
            ? { ...region, controller: 'ming', troops: location === 'field' ? 2 : 0, specialTroops: [], siegeState: null,
                cityState: location === 'city' ? { ...city, controller: 'ming', troops: 2, specialTroops: [] } : null }
            : region) });
        const core = choose(beginQidahenWheelRecruitTrain(configured, 'wheel', 1, true), 'action:train');
        const input = getQidahenRecruitTrainMapInput(core);
        const tokens = core.mapTokens.filter(token => token.type === 'army' && token.regionId === regionId);
        const ids = tokens.map(token => input.choiceFor(regionId, token.id)?.id);
        expect(ids).toHaveLength(2);
        expect(ids.every(Boolean)).toBe(true);
        expect(new Set(ids).size).toBe(2);
        const trained = choose(core, ids[1]!);
        const next = choose(trained, 'action:train');
        const nextInput = getQidahenRecruitTrainMapInput(next);
        expect(nextInput.tokenIds.flatMap(id => nextInput.choiceFor(regionId, id)?.pieceId ?? [])).not.toContain(ids[1]!.slice('train:'.length));
    });

    it('建军地区集合与正式候选完全对应，不生成地图外的代理目标', () => {
        const core = choose(beginQidahenWheelRecruitTrain(initial(), 'wheel', 1, true), 'action:recruit');
        const input = getQidahenRecruitTrainMapInput(core);
        const choices = getQidahenWheelRecruitTrainChoices(core);
        expect(input.regionIds).toEqual(choices.map(choice => choice.regionId));
        for (const choice of choices) expect(input.choiceFor(choice.regionId!)?.id).toBe(choice.id);
        expect(input.choiceFor('not-a-region')).toBeUndefined();
        expect(input.tokenIds).toEqual([]);
    });
});
