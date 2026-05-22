import { describe, expect, it } from 'vitest';
import { getActionChoicesForFaction, QidahenDomain } from '../domain';
import { QIDAHEN_COMMANDS } from '../domain/commands';
import { QIDAHEN_MAP_HEIGHT, QIDAHEN_MAP_REGION_SHAPES, QIDAHEN_MAP_REGION_SHAPES_BY_ID, QIDAHEN_MAP_WIDTH } from '../ui/mapRegions';
import type { QidahenCommand, QidahenCore, QidahenEvent } from '../domain/types';
import type { MatchState } from '../../../engine/types';

const random = () => 0.5;

function stateOf(core: QidahenCore): MatchState<QidahenCore> {
    return { core, sys: {} as MatchState<QidahenCore>['sys'] };
}

function apply(core: QidahenCore, command: QidahenCommand): QidahenCore {
    const validation = QidahenDomain.validate(stateOf(core), command);
    expect(validation.valid).toBe(true);
    return QidahenDomain.execute(stateOf(core), command).reduce(
        (next, event) => QidahenDomain.reduce(next, event as QidahenEvent),
        core,
    );
}

describe('七大恨支付手牌选择', () => {
    it('地图区域定义与领域区域保持同源', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const coreRegionsById = new Map(core.regions.map((region) => [region.id, region]));

        for (const region of core.regions) {
            const shape = QIDAHEN_MAP_REGION_SHAPES_BY_ID.get(region.id);
            expect(shape, `${region.id} 缺少地图 polygon`).toBeDefined();
            expect(shape?.name).toBe(region.name);
        }

        for (const shape of QIDAHEN_MAP_REGION_SHAPES) {
            expect(coreRegionsById.has(shape.id), `${shape.id} 缺少领域区域`).toBe(true);
            expect(shape.polygon.length).toBeGreaterThanOrEqual(3);
            for (const [x, y] of shape.polygon) {
                expect(x).toBeGreaterThanOrEqual(0);
                expect(x).toBeLessThanOrEqual(QIDAHEN_MAP_WIDTH);
                expect(y).toBeGreaterThanOrEqual(0);
                expect(y).toBeLessThanOrEqual(QIDAHEN_MAP_HEIGHT);
            }
        }
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

    it('点击手牌会写入支付选择并更新支付提示', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-4' },
        });

        expect(next.selectedPaymentCardIds).toEqual(['hand-4']);
        expect(next.payment).toMatchObject({
            required: 3,
            selected: 1,
            prompt: '需弃 3 / 已选 1',
        });
    });

    it('切换行动会清空已选支付牌并按新花费重算', () => {
        const selected = apply(QidahenDomain.setup(['0', '1', '2'], random), {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-4' },
        });

        const next = apply(selected, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        });

        expect(next.selectedActionId).toBe('recruit');
        expect(next.selectedPaymentCardIds).toEqual([]);
        expect(next.payment).toMatchObject({
            required: 1,
            selected: 0,
            prompt: '需弃 1 / 已选 0',
        });
    });

    it('达到当前花费上限后不会继续增加支付牌', () => {
        const recruit = apply(QidahenDomain.setup(['0', '1', '2'], random), {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        });
        const first = apply(recruit, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-1' },
        });
        const second = apply(first, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-2' },
        });

        expect(second.selectedPaymentCardIds).toEqual(['hand-1']);
        expect(second.payment.prompt).toBe('需弃 1 / 已选 1');
    });

    it('确认执行后会清空已选牌、更新弃牌堆和当前玩家手牌数', () => {
        const recruit = apply(QidahenDomain.setup(['0', '1', '2'], random), {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        });
        const selected = apply(recruit, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-1' },
        });
        const next = apply(selected, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(next.selectedPaymentCardIds).toEqual([]);
        expect(next.payment).toMatchObject({
            required: 1,
            selected: 0,
            prompt: '需弃 1 / 已选 0',
        });
        expect(next.discardPileCount).toBe(8);
        expect(next.factions.ming.handCount).toBe(4);
        expect(next.factions.ming.troops).toBe(20);
        expect(next.regions.find((region) => region.id === 'shou-cheng')?.troops).toBe(5);
        expect(next.handCards).toHaveLength(5);
        expect(next.actionLog[0]?.text).toContain('执行 征召军队，弃 1 张牌');
    });

    it('直接点击行动会自动支付并结算，不需要先显示弃置数量', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        });

        expect(next.selectedActionId).toBe('recruit');
        expect(next.selectedPaymentCardIds).toEqual([]);
        expect(next.discardPileCount).toBe(8);
        expect(next.factions.ming.handCount).toBe(4);
        expect(next.factions.ming.troops).toBe(20);
        expect(next.regions.find((region) => region.id === 'shou-cheng')?.troops).toBe(5);
        expect(next.handCards).toHaveLength(5);
        expect(next.actionLog[0]?.text).toContain('执行 征召军队，弃 1 张牌');
    });

    it('赐印招安执行后会把目标区域转为大明控制', () => {
        const selectedRegion = apply(QidahenDomain.setup(['0', '1', '2'], random), {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'jinzhou' },
        });
        const first = apply(selectedRegion, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-1' },
        });
        const second = apply(first, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-2' },
        });
        const third = apply(second, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-3' },
        });
        const next = apply(third, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '0',
            payload: {},
        });

        const targetRegion = next.regions.find((region) => region.id === 'jinzhou');
        const targetControlToken = next.mapTokens.find((token) => token.id === 'jinzhou-control');
        expect(targetRegion?.controller).toBe('ming');
        expect(targetRegion?.controlLabel).toBe('大明');
        expect(targetControlToken?.faction).toBe('ming');
        expect(targetControlToken?.imageSrc).toBe('qidahen/markers/ming-control-diplomacy-marker-a');
        expect(next.discardPileCount).toBe(10);
        expect(next.factions.ming.handCount).toBe(2);
    });

    it('驱虎吞狼执行后会让目标对手抽 6 张牌', () => {
        const selectedRegion = apply(QidahenDomain.setup(['0', '1', '2'], random), {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'jinzhou' },
        });
        const action = apply(selectedRegion, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'drive-tiger' },
        });
        const first = apply(action, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-1' },
        });
        const second = apply(first, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-2' },
        });
        const third = apply(second, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-3' },
        });
        const next = apply(third, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(next.factions.jin.handCount).toBe(14);
        expect(next.discardPileCount).toBe(10);
        expect(next.factions.ming.handCount).toBe(2);
        expect(next.actionLog[0]?.text).toContain('执行 驱虎吞狼，弃 3 张牌');
    });

    it('突袭作战执行后会进入进攻待结算状态并记录目标区域', () => {
        const selectedRegion = apply(QidahenDomain.setup(['0', '1', '2'], random), {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'jinzhou' },
        });
        const action = apply(selectedRegion, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'raid' },
        });
        const first = apply(action, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-1' },
        });
        const next = apply(first, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(next.pendingTargetAction).toMatchObject({
            actionId: 'raid',
            title: '突袭待结算',
            targetRegionId: 'jinzhou',
            targetRegionName: '锦州',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '仅进攻行动',
        });
        expect(next.discardPileCount).toBe(8);
        expect(next.factions.ming.handCount).toBe(4);
        expect(next.actionLog[0]?.text).toContain('进入 突袭待结算');
    });

    it('联姻诱降执行后会进入目标结算状态并记录邻近区域', () => {
        const selectedRegion = apply(QidahenDomain.setup(['0', '1', '2'], random), {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'jinzhou' },
        });
        const action = apply(selectedRegion, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'marriage-subjugation' },
        });
        const first = apply(action, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-1' },
        });
        const second = apply(first, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-2' },
        });
        const next = apply(second, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(next.pendingTargetAction).toMatchObject({
            actionId: 'marriage-subjugation',
            title: '联姻待结算',
            targetRegionId: 'jinzhou',
            targetRegionName: '锦州',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '邻近控制区域',
        });
        expect(next.discardPileCount).toBe(9);
        expect(next.factions.ming.handCount).toBe(3);
        expect(next.actionLog[0]?.text).toContain('进入 联姻待结算');
    });
});
