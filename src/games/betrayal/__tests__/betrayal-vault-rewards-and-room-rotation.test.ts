import {
    applyBetrayalCommand,
    BETRAYAL_COMMANDS,
    createStartedFirstScenarioCore,
    setTestRoomDiscoveryDeck,
} from './helpers/firstScenarioRuntimeHarness';
import { resolveRoomTileRotationDegrees } from '../roomMapModel';
import { BETRAYAL_DISCOVERY_POOLS } from '../scenarioConfig';

describe('Betrayal feedback regressions', () => {
    it('金库的两个物品标记会真正获得两张物品牌', () => {
        let core = createStartedFirstScenarioCore();
        const vault = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find(
            (room) => room.visualId === 'vault',
        )!;

        setTestRoomDiscoveryDeck(core, [{ floor: 'ground', room: vault }]);
        core.drawOrder = ['item'];
        core.possessionOrderByKind.item = [
            { id: 'feedback-item-a', name: '反馈测试物品A', kind: 'item' },
            { id: 'feedback-item-b', name: '反馈测试物品B', kind: 'item' },
            { id: 'feedback-item-c', name: '反馈测试物品C', kind: 'item' },
        ];
        core.deckCounts.item = core.possessionOrderByKind.item.length;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.currentExplorer.inventory.filter((card) => (
            card.name === '反馈测试物品A' || card.name === '反馈测试物品B'
        ))).toHaveLength(2);
        expect(core.deckCounts.item).toBe(1);
        expect(core.latestDiscovery?.detail).toContain('反馈测试物品A');
        expect(core.latestDiscovery?.detail).toContain('反馈测试物品B');
    });

    it('正式地图使用已确认房间朝向旋转已发现房间图面', () => {
        expect(resolveRoomTileRotationDegrees({ orientationTurns: 2 }, true)).toBe(180);
        expect(resolveRoomTileRotationDegrees({ orientationTurns: 2 }, false)).toBeUndefined();
    });
});
